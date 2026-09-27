import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getLoginStatus, requestLoginQr, setProjectToken } from './tools/auth.js';
import { getAppInfo, createAppProject } from './tools/project.js';
import { buildProject, syncConfig } from './tools/build.js';
import { validateProject } from './tools/validate.js';
import { deployApp } from './tools/deploy.js';

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
  'Request a new developer login session and generate a QR code for Zalo authorization.',
  {},
  async () => {
    const res = await requestLoginQr();
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

// 3. zmp_set_token
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in zmp-mcp server:', error);
  process.exit(1);
});
