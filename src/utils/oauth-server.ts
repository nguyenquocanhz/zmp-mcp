import http from 'http';
import { URL } from 'url';

/** Tham số trên URL callback do bên ngoài kiểm soát: escape trước khi chèn vào HTML */
function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export interface OAuthCallbackResult {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  rawParams: Record<string, string>;
}

export function startLocalOAuthServer(options: {
  port?: number;
  timeoutMs?: number;
}): Promise<{
  port: number;
  callbackUrl: string;
  waitForCallback: () => Promise<OAuthCallbackResult>;
  close: () => void;
}> {
  const port = options.port || 8085;
  const timeoutMs = options.timeoutMs || 120000; // 2 minutes timeout

  return new Promise((resolveStart, rejectStart) => {
    let server: http.Server;

    const callbackPromise = new Promise<OAuthCallbackResult>((resolveCallback, rejectCallback) => {
      let timeoutHandle: NodeJS.Timeout;

      server = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://localhost:${port}`);

          if (reqUrl.pathname === '/oauth/callback' || reqUrl.pathname === '/callback') {
            const params: Record<string, string> = {};
            reqUrl.searchParams.forEach((val, key) => {
              params[key] = val;
            });

            const code = params['code'] || params['authorization_code'];
            const state = params['state'];
            const error = params['error'];
            const errorDescription = params['error_description'];
            const ok = !error;

            // Return nice HTML page to user
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ok ? 'Xác thực thành công' : 'Xác thực thất bại'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f4f6f8;
      color: #1a1a1a;
    }
    .card {
      background: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      text-align: center;
      max-width: 440px;
      width: 90%;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #e8f3ff;
      color: #0068FF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px 0;
      color: #0068FF;
    }
    p {
      color: #5e6c84;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .badge {
      display: inline-block;
      padding: 8px 16px;
      background: #f0f2f5;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '✓' : '✕'}</div>
    <h1>${ok ? 'Xác thực Zalo thành công!' : 'Xác thực Zalo thất bại'}</h1>
    <p>${ok
      ? 'Thông tin xác thực đã được chuyển tự động về AI Assistant (Claude, Codex, Antigravity). Bạn có thể đóng cửa sổ này.'
      : escapeHtml(errorDescription || error || 'Lỗi không xác định')}</p>
    <div class="badge">Session ID: ${escapeHtml(state || 'OK')}</div>
  </div>
</body>
</html>
            `);

            clearTimeout(timeoutHandle);
            setTimeout(() => {
              server.close();
            }, 1000);

            resolveCallback({
              code,
              state,
              error,
              errorDescription,
              rawParams: params,
            });
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          }
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error: ' + e.message);
          rejectCallback(e);
        }
      });

      timeoutHandle = setTimeout(() => {
        server.close();
        rejectCallback(new Error(`OAuth callback timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      server.on('error', (err) => {
        clearTimeout(timeoutHandle);
        rejectStart(err);
      });

      server.listen(port, () => {
        const callbackUrl = `http://localhost:${port}/oauth/callback`;
        resolveStart({
          port,
          callbackUrl,
          waitForCallback: () => callbackPromise,
          close: () => {
            clearTimeout(timeoutHandle);
            server.close();
          },
        });
      });
    });
  });
}
