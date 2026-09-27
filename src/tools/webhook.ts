import http from 'http';
import {
  generateMiniAppWebhookSignature,
  verifyMiniAppWebhookSignature,
  generateOAWebhookSignature,
  verifyOAWebhookSignature,
} from '../utils/signature.js';

interface WebhookLogEntry {
  id: string;
  receivedAt: string;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  signatureHeader?: string;
  body: any;
  verification?: {
    checked: boolean;
    isValid?: boolean;
    expectedSignature?: string;
  };
}

let activeListener: {
  server: http.Server;
  port: number;
  apiKey?: string;
  logs: WebhookLogEntry[];
} | null = null;

/**
 * 1. Verify or Generate Webhook Signature
 */
export async function verifyWebhookTool(params: {
  payload: Record<string, any>;
  apiKey?: string;
  oaSecretKey?: string;
  appId?: string;
  timestamp?: number | string;
  receivedSignature?: string;
  type?: 'miniapp' | 'oa';
}) {
  const type = params.type || (params.oaSecretKey ? 'oa' : 'miniapp');

  if (type === 'miniapp') {
    const apiKey = params.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'Missing required apiKey for Zalo Mini App Open API signature.',
      };
    }

    if (params.receivedSignature) {
      const result = verifyMiniAppWebhookSignature(params.payload, apiKey, params.receivedSignature);
      return {
        success: true,
        type: 'miniapp',
        isValid: result.isValid,
        expectedSignature: result.expectedSignature,
        receivedSignature: params.receivedSignature,
        sortedKeys: result.sortedKeys,
        calculatedContent: result.calculatedContent,
        message: result.isValid
          ? 'Signature is VALID. The webhook request comes genuinely from Zalo Platform.'
          : 'Signature MISMATCH. Check if payload fields or API Key are correct.',
      };
    } else {
      const signature = generateMiniAppWebhookSignature(params.payload, apiKey);
      return {
        success: true,
        type: 'miniapp',
        generatedSignature: signature,
        algorithm: 'sha256(sorted_fields_values + apiKey)',
        note: 'Pass this in x-zevent-signature header when testing your webhook endpoint.',
      };
    }
  } else {
    // OA Webhook
    const oaSecretKey = params.oaSecretKey;
    const appId = params.appId || String(params.payload.appId || '');
    const timestamp = params.timestamp || params.payload.timestamp || Date.now();

    if (!oaSecretKey || !appId) {
      return {
        success: false,
        error: 'Missing oaSecretKey or appId for Zalo OA Webhook verification.',
      };
    }

    if (params.receivedSignature) {
      const result = verifyOAWebhookSignature({
        appId,
        data: params.payload,
        timestamp,
        oaSecretKey,
        receivedSignature: params.receivedSignature,
      });
      return {
        success: true,
        type: 'oa',
        isValid: result.isValid,
        expectedSignature: result.expectedSignature,
        receivedSignature: params.receivedSignature,
      };
    } else {
      const signature = generateOAWebhookSignature({
        appId,
        data: params.payload,
        timestamp,
        oaSecretKey,
      });
      return {
        success: true,
        type: 'oa',
        generatedSignature: signature,
        algorithm: 'sha256(appId + data + timeStamp + OAsecretKey)',
      };
    }
  }
}

/**
 * 2. Start or Inspect Local Webhook Listener Server
 */
export async function manageWebhookListener(params: {
  action: 'start' | 'stop' | 'status' | 'clear_logs';
  port?: number;
  apiKey?: string;
}) {
  if (params.action === 'stop') {
    if (!activeListener) {
      return { success: true, message: 'No active webhook listener server running.' };
    }
    await new Promise<void>((resolve) => activeListener!.server.close(() => resolve()));
    const port = activeListener.port;
    activeListener = null;
    return { success: true, message: `Webhook listener on port ${port} has been stopped.` };
  }

  if (params.action === 'status') {
    if (!activeListener) {
      return {
        running: false,
        message: 'No webhook listener currently running. Use action: "start" to launch one.',
      };
    }
    return {
      running: true,
      port: activeListener.port,
      apiKeyConfigured: Boolean(activeListener.apiKey),
      totalEventsReceived: activeListener.logs.length,
      recentEvents: activeListener.logs.slice(-10),
      tunnelTip: `Expose port ${activeListener.port} to the internet using: ngrok http ${activeListener.port} or cloudflared tunnel.`,
    };
  }

  if (params.action === 'clear_logs') {
    if (activeListener) {
      activeListener.logs = [];
    }
    return { success: true, message: 'Webhook logs cleared.' };
  }

  // action: 'start'
  if (activeListener) {
    return {
      running: true,
      port: activeListener.port,
      message: `Webhook listener is already running on port ${activeListener.port}. Use action "stop" first if you wish to change port.`,
      tunnelTip: `Expose port ${activeListener.port} to the internet using: ngrok http ${activeListener.port}`,
    };
  }

  const port = params.port || 8086;
  const apiKey = params.apiKey;
  const logs: WebhookLogEntry[] = [];

  const server = http.createServer((req, res) => {
    // CORS headers for local debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-zevent-signature, authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          service: 'zmp-mcp Webhook Listener',
          status: 'ready',
          eventsReceived: logs.length,
          recentEvents: logs.slice(-5),
        })
      );
      return;
    }

    if (req.method === 'POST') {
      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk;
      });

      req.on('end', () => {
        let parsedBody: any = null;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }

        const signatureHeader =
          (req.headers['x-zevent-signature'] as string) ||
          (req.headers['x-event-signature'] as string) ||
          (req.headers['signature'] as string);

        let verification: WebhookLogEntry['verification'] = { checked: false };
        if (apiKey && parsedBody && typeof parsedBody === 'object') {
          if (signatureHeader) {
            const vRes = verifyMiniAppWebhookSignature(parsedBody, apiKey, signatureHeader);
            verification = {
              checked: true,
              isValid: vRes.isValid,
              expectedSignature: vRes.expectedSignature,
            };
          } else {
            verification = {
              checked: true,
              isValid: false,
              expectedSignature: generateMiniAppWebhookSignature(parsedBody, apiKey),
            };
          }
        }

        const entry: WebhookLogEntry = {
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          receivedAt: new Date().toISOString(),
          method: req.method || 'POST',
          url: req.url || '/',
          headers: req.headers,
          signatureHeader,
          body: parsedBody,
          verification,
        };

        logs.push(entry);
        if (logs.length > 50) logs.shift(); // keep last 50 events

        // Standard Zalo Webhook response: HTTP 200 OK within 2 seconds
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 0,
            message: 'Success',
            receivedEvent: parsedBody?.event || 'unknown',
          })
        );
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 405, message: 'Method Not Allowed' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, () => resolve());
    server.on('error', (err) => reject(err));
  });

  activeListener = {
    server,
    port,
    apiKey,
    logs,
  };

  return {
    success: true,
    running: true,
    port,
    apiKeyConfigured: Boolean(apiKey),
    endpoint: `http://localhost:${port}/api/zalo-webhook`,
    message: `Webhook listener server started on port ${port}.`,
    tunnelTip: `Run "ngrok http ${port}" or "cloudflared tunnel --url http://localhost:${port}" to get a public HTTPS URL for Zalo Developer Portal.`,
  };
}

/**
 * 3. Technical Integration Guide
 */
export function getWebhookIntegrationGuide() {
  return {
    title: 'Zalo Mini App Webhook Integration Guide',
    portalUrl: 'https://mini.zalo.me/developers',
    steps: [
      '1. Truy cập https://mini.zalo.me/developers -> Chọn ứng dụng Mini App của bạn.',
      '2. Vào mục "Open APIS" ở menu bên trái -> chọn "Quản lý APIs".',
      '3. Tìm trường "Webhook URL" và điền URL máy chủ webhook (bắt buộc giao thức HTTPS).',
      '4. Cấu hình IP Whitelist: Khai báo địa chỉ IP công khai của máy chủ backend để Zalo cho phép gửi webhook.',
      '5. Lấy "API Key" (dành cho đối tác giải pháp hoặc nhà phát triển) để tiến hành xác thực chữ ký (Signature).',
    ],
    signatureVerificationRule: {
      header: 'x-zevent-signature',
      algorithm: 'sha256(content + apiKey)',
      contentRule:
        'Sắp xếp tất cả các field keys trong payload JSON theo bảng chữ cái (A-Z), ghép các giá trị lại thành chuỗi, sau đó nối thêm apiKey và hash sha256.',
    },
    commonEvents: [
      {
        name: 'user.revoke.consent',
        description:
          'Người dùng rút lại quyền đồng ý hoặc yêu cầu xóa dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. Máy chủ cần xóa hoặc ẩn thông tin tương ứng.',
        samplePayload: {
          appId: '2522725584854781271',
          event: 'user.revoke.consent',
          timestamp: 1727438400000,
          userId: 'zalo_user_id_here',
        },
      },
      {
        name: 'version_review_status',
        description: 'Thông báo kết quả xét duyệt phiên bản Mini App (Đã duyệt hoặc Bị từ chối).',
        samplePayload: {
          appId: '2522725584854781271',
          event: 'app_version_status',
          version: '5',
          status: 'APPROVED',
          timestamp: 1727438400000,
        },
      },
      {
        name: 'payment_status',
        description: 'Thông báo trạng thái thanh toán đơn hàng từ Zalo Checkout SDK.',
        samplePayload: {
          appId: '2522725584854781271',
          event: 'payment_callback',
          orderId: 'ORDER_123456',
          transId: 'ZALO_TRANS_789',
          amount: 50000,
          status: 'SUCCESS',
          timestamp: 1727438400000,
        },
      },
    ],
    responseRequirements: {
      status: 200,
      format: { error: 0, message: 'Success' },
      timeout: 'Phải phản hồi trong vòng 2 giây. Nếu thất bại, Zalo sẽ retry sau 30s, 5m, 15m, 30m, 1h.',
    },
  };
}
