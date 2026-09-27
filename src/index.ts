import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  getLoginStatus,
  requestLoginQr,
  pollLoginStatus,
  startOAuthCallback,
  setProjectToken,
} from './tools/auth.js';
import { getAppInfo, createAppProject } from './tools/project.js';
import { buildProject, syncConfig } from './tools/build.js';
import { validateProject } from './tools/validate.js';
import { deployApp } from './tools/deploy.js';
import {
  verifyWebhookTool,
  manageWebhookListener,
  getWebhookIntegrationGuide,
} from './tools/webhook.js';
import { runOwaspAudit } from './tools/audit.js';

// Initialize MCP Server
const server = new McpServer({
  name: 'zmp-mcp',
  version: '1.0.0',
});

// 1. zmp_get_login_status
server.tool(
  'zmp_get_login_status',
  'Check authentication status with Zalo Mini App Platform for a given project directory or token.',
  {
    projectDir: z.string().describe('Absolute path to the Zalo Mini App project directory (containing .env).'),
    token: z.string().optional().describe('Optional explicit ZMP_TOKEN to verify.'),
  },
  async ({ projectDir, token }) => {
    const res = await getLoginStatus(projectDir, token);
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 2. zmp_request_login_qr
server.tool(
  'zmp_request_login_qr',
  'Request a new developer login session and generate a QR code for Zalo authorization. Can optionally wait/poll until scanned.',
  {
    projectDir: z.string().optional().describe('Optional path to project directory to auto-save ZMP_TOKEN upon scan.'),
    appId: z.string().optional().describe('Optional Zalo Mini App ID.'),
    waitForScan: z.boolean().optional().describe('Whether to block and poll until user scans QR on mobile (default: false).'),
    timeoutSec: z.number().optional().describe('Timeout in seconds for scanning (default: 60).'),
  },
  async ({ projectDir, appId, waitForScan, timeoutSec }) => {
    const res = await requestLoginQr({ projectDir, appId, waitForScan, timeoutSec });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 3. zmp_wait_for_login
server.tool(
  'zmp_wait_for_login',
  'Poll and wait for user to confirm mobile Zalo QR scan authorization, then automatically save ZMP_TOKEN into .env.',
  {
    zmpsk: z.string().describe('Session key (zmpsk) returned by zmp_request_login_qr.'),
    projectDir: z.string().describe('Project directory where .env should be updated with the token.'),
    timeoutSec: z.number().optional().describe('Polling timeout in seconds (default: 60).'),
  },
  async ({ zmpsk, projectDir, timeoutSec }) => {
    const res = await pollLoginStatus({ zmpsk, projectDir, timeoutSec });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 4. zmp_start_oauth_callback
server.tool(
  'zmp_start_oauth_callback',
  'Start a local HTTP OAuth callback server (e.g. http://localhost:8085/oauth/callback) to capture redirect code/token.',
  {
    port: z.number().optional().describe('Local port to listen on (default: 8085).'),
    timeoutSec: z.number().optional().describe('Timeout waiting for redirect callback (default: 120s).'),
    projectDir: z.string().optional().describe('Optional project directory to save received token/code.'),
    zaloAppId: z.string().optional().describe('Optional Zalo App ID to construct authorization URL.'),
  },
  async ({ port, timeoutSec, projectDir, zaloAppId }) => {
    const res = await startOAuthCallback({ port, timeoutSec, projectDir, zaloAppId });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 5. zmp_set_token
server.tool(
  'zmp_set_token',
  'Save or update APP_ID and ZMP_TOKEN in the project local .env file.',
  {
    projectDir: z.string().describe('Absolute path to the Zalo Mini App project directory.'),
    appId: z.string().optional().describe('Zalo Mini App ID.'),
    token: z.string().optional().describe('Zalo developer access token (ZMP_TOKEN).'),
  },
  async ({ projectDir, appId, token }) => {
    const res = await setProjectToken(projectDir, appId, token);
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 4. zmp_get_app_info
server.tool(
  'zmp_get_app_info',
  'Retrieve Mini App metadata, quotas, and versions from Zalo Developer API.',
  {
    projectDir: z.string().describe('Absolute path to the project directory.'),
    appId: z.string().optional().describe('Optional Mini App ID override.'),
    token: z.string().optional().describe('Optional token override.'),
  },
  async ({ projectDir, appId, token }) => {
    const res = await getAppInfo(projectDir, appId, token);
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 5. zmp_create_app
server.tool(
  'zmp_create_app',
  'Scaffold a new production-ready Zalo Mini App project with React 18, ZAUI, Vite, and Dark Mode zero-flicker.',
  {
    targetDir: z.string().describe('Target directory where the new project should be created.'),
    appName: z.string().describe('Project name in slug form (e.g. my-mini-app).'),
    appTitle: z.string().describe('Display title of the Mini App in Vietnamese or English.'),
    appId: z.string().optional().describe('Optional Zalo Mini App ID to pre-configure.'),
    template: z.enum(['zaui-blank', 'zaui-tabs', 'blank']).optional().describe('Template type.'),
  },
  async ({ targetDir, appName, appTitle, appId, template }) => {
    const res = await createAppProject({ targetDir, appName, appTitle, appId, template });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 6. zmp_build
server.tool(
  'zmp_build',
  'Build the Zalo Mini App project and automatically synchronize bundle assets with app-config.json.',
  {
    projectDir: z.string().describe('Absolute path to the project directory.'),
    outputDirName: z.string().optional().describe('Build output directory name (default: "www").'),
    autoSyncAssets: z.boolean().optional().describe('Whether to auto sync listCSS/listAsyncJS (default: true).'),
  },
  async ({ projectDir, outputDirName, autoSyncAssets }) => {
    const res = await buildProject({ projectDir, outputDirName, autoSyncAssets });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 7. zmp_sync_config
server.tool(
  'zmp_sync_config',
  'Synchronize CSS and JS build assets into app-config.json and app.json to prevent "No asset defined" errors.',
  {
    projectDir: z.string().describe('Absolute path to the project directory.'),
    outputDirName: z.string().optional().describe('Build output folder (default: "www").'),
  },
  async ({ projectDir, outputDirName }) => {
    const res = await syncConfig({ projectDir, outputDirName });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 8. zmp_validate_project
server.tool(
  'zmp_validate_project',
  'Validate project configuration, app-config.json format, bundle size limits (10MB/3MB), and allowed file extensions.',
  {
    projectDir: z.string().describe('Absolute path to the project directory.'),
    outputDirName: z.string().optional().describe('Output folder to inspect (default: "www").'),
  },
  async ({ projectDir, outputDirName }) => {
    const res = validateProject(projectDir, outputDirName);
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 9. zmp_deploy
server.tool(
  'zmp_deploy',
  'Deploy Zalo Mini App to Zalo Cloud with automatic asset synchronization, chunked upload, and testing quota tracking.',
  {
    projectDir: z.string().describe('Absolute path to the project directory.'),
    versionStatus: z
      .enum(['TESTING', 'DEVELOPMENT'])
      .optional()
      .describe('Version status type (default: "TESTING" so you can submit for review).'),
    description: z.string().optional().describe('Release notes or version description.'),
    outputDirName: z.string().optional().describe('Build output folder to deploy (default: "www").'),
    explicitToken: z.string().optional().describe('Optional token override.'),
    devMode: z.boolean().optional().describe('Whether to deploy to development server (default: false).'),
  },
  async ({ projectDir, versionStatus, description, outputDirName, explicitToken, devMode }) => {
    const res = await deployApp({
      projectDir,
      versionStatus,
      description,
      outputDirName,
      explicitToken,
      devMode,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 10. zmp_verify_webhook
server.tool(
  'zmp_verify_webhook',
  'Verify or generate Zalo Webhook signatures (supports Zalo Mini App Open API sha256 sorted fields and Zalo OA Webhooks).',
  {
    payload: z.record(z.any()).describe('The JSON payload object received in the webhook request.'),
    apiKey: z.string().optional().describe('Zalo Mini App Open API Key (or Partner API Key).'),
    oaSecretKey: z.string().optional().describe('Zalo Official Account (OA) Secret Key (if verifying OA webhook).'),
    appId: z.string().optional().describe('Zalo App ID.'),
    timestamp: z.union([z.number(), z.string()]).optional().describe('Optional event timestamp.'),
    receivedSignature: z
      .string()
      .optional()
      .describe('Signature received in the x-zevent-signature header. If omitted, generates test signature.'),
    type: z.enum(['miniapp', 'oa']).optional().describe('Webhook type: "miniapp" (default) or "oa".'),
  },
  async ({ payload, apiKey, oaSecretKey, appId, timestamp, receivedSignature, type }) => {
    const res = await verifyWebhookTool({
      payload,
      apiKey,
      oaSecretKey,
      appId,
      timestamp,
      receivedSignature,
      type,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 11. zmp_manage_webhook_listener
server.tool(
  'zmp_manage_webhook_listener',
  'Start, stop, check status, or clear logs of a local Zalo Webhook receiver server for local testing and debugging.',
  {
    action: z.enum(['start', 'stop', 'status', 'clear_logs']).describe('Action to perform on the listener.'),
    port: z.number().optional().describe('Local port to listen on (default: 8086).'),
    apiKey: z.string().optional().describe('Optional API Key to auto-verify incoming x-zevent-signature.'),
  },
  async ({ action, port, apiKey }) => {
    const res = await manageWebhookListener({ action, port, apiKey });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 12. zmp_get_webhook_docs
server.tool(
  'zmp_get_webhook_docs',
  'Get comprehensive technical documentation, event schemas (Decree 13 user deletion, version review, payment), and integration guide for Zalo Mini App Webhook.',
  {},
  async () => {
    const res = getWebhookIntegrationGuide();
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 13. zmp_owasp_audit
server.tool(
  'zmp_owasp_audit',
  'Perform comprehensive OWASP Top 10 security audit on a live Web/Webhook endpoint (headers, TLS, CORS, info disclosure) or project codebase (hardcoded secrets, XSS, insecure transport).',
  {
    url: z.string().optional().describe('Target HTTP/HTTPS URL to scan for OWASP Top 10 vulnerabilities.'),
    projectDir: z.string().optional().describe('Target project directory to statically analyze for security flaws.'),
  },
  async ({ url, projectDir }) => {
    const res = await runOwaspAudit({ url, projectDir });
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in zmp-mcp server:', error);
  process.exit(1);
});
