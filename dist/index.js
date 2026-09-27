#!/usr/bin/env node


// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// src/tools/auth.ts
import QRCode from "qrcode";

// src/utils/http.ts
import axios from "axios";

// src/config.ts
var ZALO_CONFIG = {
  API_DOMAIN: {
    prod: "https://zmp-api.developers.zalo.me/",
    dev: "https://dev-zmp-api.developers.zalo.me/"
  },
  ZDN_URL: {
    prod: "https://h5.zdn.vn/zapps/",
    dev: "https://dev.h5.zalo.me/zapps/"
  },
  ENDPOINTS: {
    requestLogin: "admin/request-login",
    checkLoginStatus: "admin/get-login-status",
    requestUpload: "app/request-upload",
    uploadChunk: "app/upload-chunk",
    getAppInfo: "app/get-info"
  },
  LIMITS: {
    maxZipSizeMB: 10,
    maxFileSizeMB: 3,
    quotas: {
      development: 300,
      testing: 60
    },
    allowedExtensions: [
      ".css",
      ".js",
      ".json",
      ".ttf",
      ".woff",
      ".svg",
      ".swf",
      ".jpg",
      ".jpeg",
      ".png",
      ".woff2",
      ".eot",
      ".otf",
      ".plist",
      ".mp3",
      ".wav",
      ".gif",
      ".cconb",
      ".wasm",
      ".webp"
    ]
  }
};

// src/utils/http.ts
function createZaloApiClient(token, devMode = false) {
  const baseURL = devMode ? ZALO_CONFIG.API_DOMAIN.dev : ZALO_CONFIG.API_DOMAIN.prod;
  const headers = {
    "cache-control": "no-cache",
    "User-Agent": "zmp-mcp/1.0.0"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return axios.create({
    baseURL,
    headers,
    timeout: 3e4
  });
}
async function uploadChunkOctet(params) {
  const query = new URLSearchParams({
    resumableChunkNumber: params.chunkNumber.toString(),
    resumableChunkSize: params.chunkSize.toString(),
    resumableCurrentChunkSize: params.currentChunkSize.toString(),
    resumableTotalSize: params.totalSize.toString(),
    resumableType: "application/x-zip-compressed",
    resumableIdentifier: params.identifier,
    resumableFilename: params.fileName,
    resumableRelativePath: params.fileName,
    resumableTotalChunks: params.totalChunks.toString()
  });
  const fullUrl = `${params.targetUrl}?${query.toString()}`;
  const response = await axios.post(fullUrl, params.chunkBuffer, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/octet-stream"
    },
    timeout: 6e4
  });
  return response.data;
}

// src/utils/env.ts
import fs from "fs";
import path from "path";
function loadEnv(projectDir) {
  const envPath = path.join(projectDir, ".env");
  const result = {
    appId: process.env.APP_ID,
    token: process.env.ZMP_TOKEN
  };
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === "APP_ID") result.appId = val;
        if (key === "ZMP_TOKEN") result.token = val;
      }
    }
  }
  return result;
}
function saveEnv(projectDir, values) {
  const envPath = path.join(projectDir, ".env");
  let currentContent = "";
  if (fs.existsSync(envPath)) {
    currentContent = fs.readFileSync(envPath, "utf8");
  }
  const lines = currentContent ? currentContent.split(/\r?\n/) : [];
  let foundAppId = false;
  let foundToken = false;
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("APP_ID=") && values.appId) {
      foundAppId = true;
      return `APP_ID=${values.appId}`;
    }
    if (trimmed.startsWith("ZMP_TOKEN=") && values.token) {
      foundToken = true;
      return `ZMP_TOKEN=${values.token}`;
    }
    return line;
  });
  if (!foundAppId && values.appId) {
    newLines.push(`APP_ID=${values.appId}`);
  }
  if (!foundToken && values.token) {
    newLines.push(`ZMP_TOKEN=${values.token}`);
  }
  fs.writeFileSync(envPath, newLines.join("\n"), "utf8");
}

// src/utils/oauth-server.ts
import http from "http";
import { URL } from "url";
function startLocalOAuthServer(options) {
  const port = options.port || 8085;
  const timeoutMs = options.timeoutMs || 12e4;
  return new Promise((resolveStart, rejectStart) => {
    let server2;
    const callbackPromise = new Promise((resolveCallback, rejectCallback) => {
      let timeoutHandle;
      server2 = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url || "/", `http://localhost:${port}`);
          if (reqUrl.pathname === "/oauth/callback" || reqUrl.pathname === "/callback") {
            const params = {};
            reqUrl.searchParams.forEach((val, key) => {
              params[key] = val;
            });
            const code = params["code"] || params["authorization_code"];
            const state = params["state"];
            const error = params["error"];
            const errorDescription = params["error_description"];
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zalo Mini App - X\xE1c Th\u1EF1c Th\xE0nh C\xF4ng</title>
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
    <div class="icon">\u2713</div>
    <h1>X\xE1c th\u1EF1c Zalo th\xE0nh c\xF4ng!</h1>
    <p>Th\xF4ng tin x\xE1c th\u1EF1c \u0111\xE3 \u0111\u01B0\u1EE3c chuy\u1EC3n t\u1EF1 \u0111\u1ED9ng v\u1EC1 AI Assistant (Claude, Codex, Antigravity). B\u1EA1n c\xF3 th\u1EC3 \u0111\xF3ng c\u1EEDa s\u1ED5 n\xE0y.</p>
    <div class="badge">Session ID: ${state || "OK"}</div>
  </div>
</body>
</html>
            `);
            clearTimeout(timeoutHandle);
            setTimeout(() => {
              server2.close();
            }, 1e3);
            resolveCallback({
              code,
              state,
              error,
              errorDescription,
              rawParams: params
            });
          } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
          }
        } catch (e) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error: " + e.message);
          rejectCallback(e);
        }
      });
      timeoutHandle = setTimeout(() => {
        server2.close();
        rejectCallback(new Error(`OAuth callback timed out after ${timeoutMs / 1e3}s`));
      }, timeoutMs);
      server2.on("error", (err) => {
        clearTimeout(timeoutHandle);
        rejectStart(err);
      });
      server2.listen(port, () => {
        const callbackUrl = `http://localhost:${port}/oauth/callback`;
        resolveStart({
          port,
          callbackUrl,
          waitForCallback: () => callbackPromise,
          close: () => {
            clearTimeout(timeoutHandle);
            server2.close();
          }
        });
      });
    });
  });
}

// src/tools/auth.ts
async function getLoginStatus(projectDir, explicitToken) {
  const env = loadEnv(projectDir);
  const token = explicitToken || env.token;
  if (!token) {
    return {
      isLoggedIn: false,
      message: "No ZMP_TOKEN found. Run zmp_request_login_qr or set ZMP_TOKEN in .env."
    };
  }
  const client = createZaloApiClient(token);
  try {
    const res = await client.get(ZALO_CONFIG.ENDPOINTS.checkLoginStatus);
    if (res.data && res.data.err === 0) {
      return {
        isLoggedIn: true,
        user: res.data.data,
        message: "Successfully authenticated with Zalo Developer Platform."
      };
    } else {
      return {
        isLoggedIn: false,
        error: res.data ? res.data.msg : "Invalid session",
        message: "ZMP_TOKEN expired or unauthorized."
      };
    }
  } catch (err) {
    return {
      isLoggedIn: false,
      error: err.response?.data?.msg || err.message,
      message: "Failed to verify login status with Zalo API."
    };
  }
}
async function pollLoginStatus(params) {
  const { zmpsk, projectDir, timeoutSec = 60 } = params;
  const client = createZaloApiClient();
  const startTime = Date.now();
  const maxTime = timeoutSec * 1e3;
  while (Date.now() - startTime < maxTime) {
    try {
      const res = await client.get(
        `${ZALO_CONFIG.ENDPOINTS.checkLoginStatus}?zmpsk=${encodeURIComponent(zmpsk)}`
      );
      if (res.data && res.data.err >= 0 && res.data.data?.jwt) {
        const token = res.data.data.jwt;
        if (projectDir) {
          saveEnv(projectDir, { token });
        }
        return {
          success: true,
          message: "Zalo mobile scan verified! Access token saved to .env.",
          token,
          data: res.data.data
        };
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  return {
    success: false,
    error: `Login verification timed out after ${timeoutSec} seconds. Please scan and authorize again.`
  };
}
async function requestLoginQr(params = {}) {
  const { projectDir, appId: explicitAppId, waitForScan = false, timeoutSec = 60 } = params;
  const env = projectDir ? loadEnv(projectDir) : {};
  const appId = explicitAppId || env.appId || "";
  const client = createZaloApiClient();
  try {
    const url = appId ? `${ZALO_CONFIG.ENDPOINTS.requestLogin}?appId=${encodeURIComponent(appId)}` : ZALO_CONFIG.ENDPOINTS.requestLogin;
    const res = await client.get(url);
    if (res.data && res.data.err === 0) {
      const data = res.data.data;
      const verifyUrl = data.loginUrl || `https://developers.zalo.me/tools/cli-login?code=${data.code}`;
      const zmpsk = data.zmpsk || data.code;
      const dataUrl = await QRCode.toDataURL(verifyUrl, { margin: 2, scale: 6 });
      const terminalQr = await QRCode.toString(verifyUrl, { type: "terminal", small: true });
      const initialResult = {
        success: true,
        zmpsk,
        verifyUrl,
        terminalQr,
        qrDataUrl: dataUrl,
        instructions: "Scan this QR code with your mobile Zalo app to authorize CLI developer access."
      };
      if (waitForScan && zmpsk) {
        const pollResult = await pollLoginStatus({ zmpsk, projectDir, timeoutSec });
        return {
          ...initialResult,
          scanResult: pollResult
        };
      }
      return initialResult;
    } else {
      return {
        success: false,
        error: res.data?.msg || "Could not initiate login session"
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.msg || err.message
    };
  }
}
async function startOAuthCallback(params) {
  const { port = 8085, timeoutSec = 120, projectDir, zaloAppId } = params;
  const timeoutMs = timeoutSec * 1e3;
  try {
    const serverInstance = await startLocalOAuthServer({ port, timeoutMs });
    let authUrl = "";
    if (zaloAppId) {
      const state = Math.random().toString(36).substring(7);
      authUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${zaloAppId}&redirect_uri=${encodeURIComponent(serverInstance.callbackUrl)}&state=${state}`;
    }
    const callbackData = await serverInstance.waitForCallback();
    if (callbackData.code && projectDir) {
      saveEnv(projectDir, { token: callbackData.code });
    }
    return {
      success: !callbackData.error,
      authUrl,
      callbackUrl: serverInstance.callbackUrl,
      code: callbackData.code,
      state: callbackData.state,
      error: callbackData.error,
      errorDescription: callbackData.errorDescription,
      message: callbackData.error ? `OAuth failed: ${callbackData.errorDescription || callbackData.error}` : "OAuth callback received successfully!"
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
async function setProjectToken(projectDir, appId, token) {
  saveEnv(projectDir, { appId, token });
  return {
    success: true,
    message: `Updated environment configuration in ${projectDir}/.env`,
    appId,
    hasToken: !!token
  };
}

// src/tools/project.ts
import fs2 from "fs";
import path2 from "path";
async function getAppInfo(projectDir, explicitAppId, explicitToken) {
  const env = loadEnv(projectDir);
  const token = explicitToken || env.token;
  const appId = explicitAppId || env.appId;
  if (!token) {
    return {
      success: false,
      error: "Missing ZMP_TOKEN. Authenticate first."
    };
  }
  const client = createZaloApiClient(token);
  try {
    const res = await client.get(`${ZALO_CONFIG.ENDPOINTS.getAppInfo}?appId=${appId || ""}`);
    return {
      success: res.data?.err === 0,
      data: res.data?.data,
      message: res.data?.msg
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.msg || err.message
    };
  }
}
async function createAppProject(params) {
  const { targetDir, appName, appTitle, appId = "", template = "zaui-blank" } = params;
  if (!fs2.existsSync(targetDir)) {
    fs2.mkdirSync(targetDir, { recursive: true });
  }
  const packageJson = {
    name: appName,
    version: "1.0.0",
    private: true,
    description: `Zalo Mini App - ${appTitle}`,
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview"
    },
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      "zmp-sdk": "^2.41.0",
      "zmp-ui": "^1.11.0"
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.3.0",
      sass: "^1.77.0",
      vite: "^5.4.0"
    }
  };
  fs2.writeFileSync(path2.join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");
  const appConfig = {
    app: {
      appId,
      title: appTitle,
      headerColor: "#0068FF",
      statusBarColor: "#0068FF",
      textColor: "white"
    },
    template: {
      type: template,
      name: template
    },
    pages: ["pages/index/index"],
    listSyncableEvent: [],
    permission: {}
  };
  fs2.writeFileSync(path2.join(targetDir, "app-config.json"), JSON.stringify(appConfig, null, 2), "utf8");
  fs2.writeFileSync(path2.join(targetDir, "app.json"), JSON.stringify(appConfig, null, 2), "utf8");
  const zmpConfig = {
    name: appName,
    title: appTitle,
    framework: "react",
    template
  };
  fs2.writeFileSync(path2.join(targetDir, "zmp.json"), JSON.stringify(zmpConfig, null, 2), "utf8");
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: './',
  base: './',
  plugins: [react()],
  build: {
    outDir: 'www',
    emptyOutDir: true,
  },
});
`;
  fs2.writeFileSync(path2.join(targetDir, "vite.config.js"), viteConfig, "utf8");
  const srcDir = path2.join(targetDir, "src");
  const pagesDir = path2.join(srcDir, "pages", "index");
  const cssDir = path2.join(srcDir, "css");
  fs2.mkdirSync(pagesDir, { recursive: true });
  fs2.mkdirSync(cssDir, { recursive: true });
  const appScss = `:root {
  --bg-page: #f4f5f7;
  --bg-card: #ffffff;
  --text-primary: #141415;
  --text-secondary: #767a7f;
  --border-color: #e4e6eb;
}

[data-theme='dark'] {
  --bg-page: #18191a;
  --bg-card: #242526;
  --text-primary: #e4e6eb;
  --text-secondary: #b0b3b8;
  --border-color: #3a3b3c;
}

/* User Rule: Explicit dark mode styling for select & option */
[data-theme='dark'] select option {
  background-color: var(--bg-card);
  color: var(--text-primary);
}

body {
  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
}
`;
  fs2.writeFileSync(path2.join(cssDir, "app.scss"), appScss, "utf8");
  const indexJsx = `import React, { useState, useEffect } from 'react';
import { Page, Box, Text, Button, Icon } from 'zmp-ui';

export default function HomePage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    const dark = saved === 'dark';
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = !isDark ? 'dark' : 'light';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <Page className="page">
      <Box p={4} m={4} style={{ backgroundColor: 'var(--bg-card)', borderRadius: 12 }}>
        <Text.Title size="large">${appTitle}</Text.Title>
        <Text size="normal" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          Zalo Mini App created with zmp-mcp
        </Text>
        <Box mt={4}>
          <Button
            size="medium"
            variant="secondary"
            onClick={toggleTheme}
            prefixIcon={<Icon icon="zi-wallpaper" />}
          >
            {isDark ? 'Ch\u1EBF \u0111\u1ED9 S\xE1ng' : 'Ch\u1EBF \u0111\u1ED9 T\u1ED1i'}
          </Button>
        </Box>
      </Box>
    </Page>
  );
}
`;
  fs2.writeFileSync(path2.join(pagesDir, "index.jsx"), indexJsx, "utf8");
  const appJsx = `import React from 'react';
import { App, ZMPRouter, AnimationRoutes, Route } from 'zmp-ui';
import HomePage from './pages/index/index';
import './css/app.scss';

export default function MyApp() {
  return (
    <App>
      <ZMPRouter>
        <AnimationRoutes>
          <Route path="/" element={<HomePage />} />
        </AnimationRoutes>
      </ZMPRouter>
    </App>
  );
}
`;
  fs2.writeFileSync(path2.join(srcDir, "app.jsx"), appJsx, "utf8");
  const indexHtml = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>${appTitle}</title>
    <script>
      (function() {
        var theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import React from 'react';
      import ReactDOM from 'react-dom/client';
      import MyApp from './src/app.jsx';
      ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(MyApp));
    </script>
  </body>
</html>
`;
  fs2.writeFileSync(path2.join(targetDir, "index.html"), indexHtml, "utf8");
  if (appId) {
    fs2.writeFileSync(path2.join(targetDir, ".env"), `APP_ID=${appId}
`, "utf8");
  }
  const gitignore = `node_modules
www
dist
.env
.DS_Store
`;
  fs2.writeFileSync(path2.join(targetDir, ".gitignore"), gitignore, "utf8");
  return {
    success: true,
    message: `Zalo Mini App project created successfully at ${targetDir}`,
    template,
    appTitle,
    appId
  };
}

// src/tools/build.ts
import { exec } from "child_process";
import { promisify } from "util";
import path4 from "path";
import fs4 from "fs";

// src/utils/files.ts
import fs3 from "fs";
import path3 from "path";
import archiver from "archiver";
function getAllFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs3.existsSync(dir)) return results;
  const list = fs3.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path3.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else {
      results.push(path3.relative(baseDir, fullPath).replace(/\\/g, "/"));
    }
  }
  return results;
}
function validateOutputDir(outputDir) {
  const result = {
    valid: true,
    totalSizeMB: 0,
    oversizedFiles: [],
    invalidExtensionFiles: [],
    missingRequiredFiles: [],
    warnings: []
  };
  if (!fs3.existsSync(outputDir)) {
    result.valid = false;
    result.warnings.push(`Output directory not found: ${outputDir}`);
    return result;
  }
  const files = getAllFiles(outputDir);
  if (!files.includes("app-config.json")) {
    result.missingRequiredFiles.push("app-config.json");
    result.valid = false;
  }
  let totalBytes = 0;
  for (const relPath of files) {
    const fullPath = path3.join(outputDir, relPath);
    const stat = fs3.statSync(fullPath);
    totalBytes += stat.size;
    const sizeMB = stat.size / (1024 * 1024);
    if (sizeMB > ZALO_CONFIG.LIMITS.maxFileSizeMB) {
      result.oversizedFiles.push({ file: relPath, sizeMB: parseFloat(sizeMB.toFixed(2)) });
      result.valid = false;
    }
    const ext = path3.extname(relPath).toLowerCase();
    if (!ZALO_CONFIG.LIMITS.allowedExtensions.includes(ext)) {
      if (relPath === "index.html") {
        result.warnings.push(
          "index.html will NOT be served directly by Zalo. Ensure your JS/CSS entry points are registered in app-config.json"
        );
      } else {
        result.invalidExtensionFiles.push(relPath);
        result.valid = false;
      }
    }
  }
  result.totalSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
  if (result.totalSizeMB > ZALO_CONFIG.LIMITS.maxZipSizeMB) {
    result.valid = false;
    result.warnings.push(
      `Total bundle size (${result.totalSizeMB} MB) exceeds maximum allowed limit (${ZALO_CONFIG.LIMITS.maxZipSizeMB} MB)`
    );
  }
  return result;
}
async function zipDirectory(dir) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const buffers = [];
    archive.on("data", (data) => buffers.push(data));
    archive.on("end", () => resolve(Buffer.concat(buffers)));
    archive.on("error", (err) => reject(err));
    archive.directory(dir, false);
    archive.finalize();
  });
}
function syncAppConfigAssets(projectDir, outputDirName = "www") {
  const rootConfigPath = path3.join(projectDir, "app-config.json");
  const rootAppJsonPath = path3.join(projectDir, "app.json");
  const outConfigPath = path3.join(projectDir, outputDirName, "app-config.json");
  const assetsDir = path3.join(projectDir, outputDirName, "assets");
  if (!fs3.existsSync(rootConfigPath)) {
    throw new Error(`app-config.json not found in project root: ${projectDir}`);
  }
  const config = JSON.parse(fs3.readFileSync(rootConfigPath, "utf8"));
  if (fs3.existsSync(outConfigPath)) {
    try {
      const outConfig = JSON.parse(fs3.readFileSync(outConfigPath, "utf8"));
      if (outConfig.listCSS) config.listCSS = outConfig.listCSS;
      if (outConfig.listSyncJS) config.listSyncJS = outConfig.listSyncJS;
      if (outConfig.listAsyncJS) config.listAsyncJS = outConfig.listAsyncJS;
    } catch {
    }
  }
  if ((!config.listCSS || config.listCSS.length === 0) && fs3.existsSync(assetsDir)) {
    const assetFiles = fs3.readdirSync(assetsDir);
    config.listCSS = assetFiles.filter((f) => f.endsWith(".css")).map((f) => `assets/${f}`);
    config.listAsyncJS = assetFiles.filter((f) => f.endsWith(".js")).map((f) => `assets/${f}`);
    if (!config.listSyncJS) config.listSyncJS = [];
  }
  fs3.writeFileSync(rootConfigPath, JSON.stringify(config, null, 2), "utf8");
  if (fs3.existsSync(rootAppJsonPath) || !fs3.existsSync(rootAppJsonPath)) {
    fs3.writeFileSync(rootAppJsonPath, JSON.stringify(config, null, 2), "utf8");
  }
  if (fs3.existsSync(path3.join(projectDir, outputDirName))) {
    fs3.writeFileSync(outConfigPath, JSON.stringify(config, null, 2), "utf8");
  }
  return config;
}

// src/tools/build.ts
var execAsync = promisify(exec);
async function buildProject(params) {
  const { projectDir, outputDirName = "www", autoSyncAssets = true } = params;
  if (!fs4.existsSync(projectDir)) {
    return {
      success: false,
      error: `Project directory does not exist: ${projectDir}`
    };
  }
  try {
    let buildCmd = "npx vite build";
    const pkgPath = path4.join(projectDir, "package.json");
    if (fs4.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs4.readFileSync(pkgPath, "utf8"));
      if (pkg.scripts?.build) {
        buildCmd = "npm run build";
      }
    }
    const { stdout, stderr } = await execAsync(buildCmd, { cwd: projectDir });
    let syncedAssets = null;
    if (autoSyncAssets) {
      syncedAssets = syncAppConfigAssets(projectDir, outputDirName);
    }
    const validation = validateOutputDir(path4.join(projectDir, outputDirName));
    return {
      success: true,
      buildOutput: stdout,
      buildError: stderr,
      syncedAssets: syncedAssets ? {
        listCSS: syncedAssets.listCSS,
        listAsyncJS: syncedAssets.listAsyncJS
      } : null,
      validation
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr
    };
  }
}
async function syncConfig(params) {
  const { projectDir, outputDirName = "www" } = params;
  try {
    const config = syncAppConfigAssets(projectDir, outputDirName);
    return {
      success: true,
      message: "Successfully synchronized app-config.json and app.json with output build assets.",
      listCSS: config.listCSS || [],
      listAsyncJS: config.listAsyncJS || [],
      listSyncJS: config.listSyncJS || []
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

// src/tools/validate.ts
import fs5 from "fs";
import path5 from "path";
function validateProject(projectDir, outputDirName = "www") {
  const issues = [];
  const warnings = [];
  const passed = [];
  const rootConfigPath = path5.join(projectDir, "app-config.json");
  if (!fs5.existsSync(rootConfigPath)) {
    issues.push("Missing app-config.json in project root.");
  } else {
    try {
      const config = JSON.parse(fs5.readFileSync(rootConfigPath, "utf8"));
      if (!config.app?.appId) {
        warnings.push("appId is missing or empty in app-config.json.");
      } else {
        passed.push(`Valid Mini App ID: ${config.app.appId}`);
      }
      if (!config.pages || config.pages.length === 0) {
        issues.push("pages array is empty in app-config.json.");
      }
      if (!config.listAsyncJS && !config.listSyncJS) {
        warnings.push("No script entry (listAsyncJS/listSyncJS) defined in app-config.json. Run zmp_sync_config.");
      }
      passed.push("app-config.json format is valid JSON.");
    } catch (e) {
      issues.push(`app-config.json syntax error: ${e.message}`);
    }
  }
  const zmpConfigPath = path5.join(projectDir, "zmp.json");
  if (!fs5.existsSync(zmpConfigPath)) {
    warnings.push("Missing zmp.json in project root.");
  } else {
    passed.push("zmp.json exists.");
  }
  const outDir = path5.join(projectDir, outputDirName);
  const outValidation = validateOutputDir(outDir);
  if (!outValidation.valid) {
    if (outValidation.oversizedFiles.length > 0) {
      issues.push(
        `Files exceeding 3MB limit: ${outValidation.oversizedFiles.map((f) => `${f.file} (${f.sizeMB}MB)`).join(", ")}`
      );
    }
    if (outValidation.invalidExtensionFiles.length > 0) {
      issues.push(`Files with disallowed extensions: ${outValidation.invalidExtensionFiles.join(", ")}`);
    }
    if (outValidation.missingRequiredFiles.length > 0) {
      issues.push(`Missing required files in build: ${outValidation.missingRequiredFiles.join(", ")}`);
    }
  } else if (fs5.existsSync(outDir)) {
    passed.push(`Output bundle size is valid: ${outValidation.totalSizeMB} MB (Limit: 10 MB).`);
  }
  warnings.push(...outValidation.warnings);
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    passed,
    details: {
      totalSizeMB: outValidation.totalSizeMB,
      checkedOutputDir: outDir
    }
  };
}

// src/tools/deploy.ts
import fs6 from "fs";
import path6 from "path";
async function deployApp(params) {
  const {
    projectDir,
    versionStatus = "TESTING",
    description = "Deployed via zmp-mcp",
    outputDirName = "www",
    explicitToken,
    devMode = false
  } = params;
  const env = loadEnv(projectDir);
  const token = explicitToken || env.token;
  if (!token) {
    return {
      success: false,
      error: "Missing ZMP_TOKEN. Authenticate first or provide explicitToken."
    };
  }
  const outDir = path6.join(projectDir, outputDirName);
  if (!fs6.existsSync(outDir)) {
    return {
      success: false,
      error: `Output build directory does not exist: ${outDir}. Please run zmp_build first.`
    };
  }
  const syncedConfig = syncAppConfigAssets(projectDir, outputDirName);
  const validation = validateOutputDir(outDir);
  if (!validation.valid) {
    return {
      success: false,
      error: "Build output failed validation checks.",
      validation
    };
  }
  const zipBuffer = await zipDirectory(outDir);
  const client = createZaloApiClient(token, devMode);
  const appName = syncedConfig.app?.title || "Zalo Mini App";
  const queryParams = new URLSearchParams({
    name: appName,
    desc: description,
    config: JSON.stringify(syncedConfig),
    versionStatus
    // Must be 'TESTING' or 'DEVELOPMENT'
  });
  let requestUploadRes;
  try {
    requestUploadRes = await client.get(
      `${ZALO_CONFIG.ENDPOINTS.requestUpload}?${queryParams.toString()}`
    );
  } catch (err) {
    return {
      success: false,
      error: `Request upload API failed: ${err.response?.data?.msg || err.message}`
    };
  }
  if (!requestUploadRes.data || requestUploadRes.data.err !== 0) {
    return {
      success: false,
      error: requestUploadRes.data?.msg || "Failed to request upload identifier from Zalo.",
      rawResponse: requestUploadRes.data
    };
  }
  const uploadData = requestUploadRes.data.data;
  const identifier = uploadData.identifier;
  const nextVersion = uploadData.nextVersion;
  const quotas = uploadData.uploadConstraints?.currentUploadCount;
  const chunkSize = 500 * 1024;
  const totalSize = zipBuffer.length;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const targetUrl = `${devMode ? ZALO_CONFIG.API_DOMAIN.dev : ZALO_CONFIG.API_DOMAIN.prod}${ZALO_CONFIG.ENDPOINTS.uploadChunk}`;
  let lastResponse = null;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunkBuffer = zipBuffer.subarray(start, end);
    try {
      lastResponse = await uploadChunkOctet({
        targetUrl,
        token,
        identifier,
        chunkNumber: i + 1,
        totalChunks,
        chunkSize,
        currentChunkSize: chunkBuffer.length,
        totalSize,
        fileName: "www.zip",
        chunkBuffer
      });
      if (lastResponse && lastResponse.err < 0) {
        return {
          success: false,
          error: `Error uploading chunk ${i + 1}/${totalChunks}: ${lastResponse.msg}`,
          rawResponse: lastResponse
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Network error on chunk ${i + 1}/${totalChunks}: ${err.response?.data?.msg || err.message}`
      };
    }
  }
  const deployedInfo = lastResponse?.data || {};
  const appId = syncedConfig.app?.appId || env.appId;
  const appUrl = deployedInfo.appUrl || `https://zalo.me/s/${appId}/?env=${versionStatus}&version=${deployedInfo.versionId || nextVersion}`;
  return {
    success: true,
    message: `Successfully deployed version to Zalo Mini App Cloud (${versionStatus})!`,
    versionId: deployedInfo.versionId || nextVersion,
    appUrl,
    versionStatus,
    description,
    quotas: {
      current: quotas,
      limits: ZALO_CONFIG.LIMITS.quotas
    },
    bundleSizeKB: Math.round(totalSize / 1024)
  };
}

// src/index.ts
var server = new McpServer({
  name: "zmp-mcp",
  version: "1.0.0"
});
server.tool(
  "zmp_get_login_status",
  "Check authentication status with Zalo Mini App Platform for a given project directory or token.",
  {
    projectDir: z.string().describe("Absolute path to the Zalo Mini App project directory (containing .env)."),
    token: z.string().optional().describe("Optional explicit ZMP_TOKEN to verify.")
  },
  async ({ projectDir, token }) => {
    const res = await getLoginStatus(projectDir, token);
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_request_login_qr",
  "Request a new developer login session and generate a QR code for Zalo authorization. Can optionally wait/poll until scanned.",
  {
    projectDir: z.string().optional().describe("Optional path to project directory to auto-save ZMP_TOKEN upon scan."),
    appId: z.string().optional().describe("Optional Zalo Mini App ID."),
    waitForScan: z.boolean().optional().describe("Whether to block and poll until user scans QR on mobile (default: false)."),
    timeoutSec: z.number().optional().describe("Timeout in seconds for scanning (default: 60).")
  },
  async ({ projectDir, appId, waitForScan, timeoutSec }) => {
    const res = await requestLoginQr({ projectDir, appId, waitForScan, timeoutSec });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_wait_for_login",
  "Poll and wait for user to confirm mobile Zalo QR scan authorization, then automatically save ZMP_TOKEN into .env.",
  {
    zmpsk: z.string().describe("Session key (zmpsk) returned by zmp_request_login_qr."),
    projectDir: z.string().describe("Project directory where .env should be updated with the token."),
    timeoutSec: z.number().optional().describe("Polling timeout in seconds (default: 60).")
  },
  async ({ zmpsk, projectDir, timeoutSec }) => {
    const res = await pollLoginStatus({ zmpsk, projectDir, timeoutSec });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_start_oauth_callback",
  "Start a local HTTP OAuth callback server (e.g. http://localhost:8085/oauth/callback) to capture redirect code/token.",
  {
    port: z.number().optional().describe("Local port to listen on (default: 8085)."),
    timeoutSec: z.number().optional().describe("Timeout waiting for redirect callback (default: 120s)."),
    projectDir: z.string().optional().describe("Optional project directory to save received token/code."),
    zaloAppId: z.string().optional().describe("Optional Zalo App ID to construct authorization URL.")
  },
  async ({ port, timeoutSec, projectDir, zaloAppId }) => {
    const res = await startOAuthCallback({ port, timeoutSec, projectDir, zaloAppId });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_set_token",
  "Save or update APP_ID and ZMP_TOKEN in the project local .env file.",
  {
    projectDir: z.string().describe("Absolute path to the Zalo Mini App project directory."),
    appId: z.string().optional().describe("Zalo Mini App ID."),
    token: z.string().optional().describe("Zalo developer access token (ZMP_TOKEN).")
  },
  async ({ projectDir, appId, token }) => {
    const res = await setProjectToken(projectDir, appId, token);
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_get_app_info",
  "Retrieve Mini App metadata, quotas, and versions from Zalo Developer API.",
  {
    projectDir: z.string().describe("Absolute path to the project directory."),
    appId: z.string().optional().describe("Optional Mini App ID override."),
    token: z.string().optional().describe("Optional token override.")
  },
  async ({ projectDir, appId, token }) => {
    const res = await getAppInfo(projectDir, appId, token);
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_create_app",
  "Scaffold a new production-ready Zalo Mini App project with React 18, ZAUI, Vite, and Dark Mode zero-flicker.",
  {
    targetDir: z.string().describe("Target directory where the new project should be created."),
    appName: z.string().describe("Project name in slug form (e.g. my-mini-app)."),
    appTitle: z.string().describe("Display title of the Mini App in Vietnamese or English."),
    appId: z.string().optional().describe("Optional Zalo Mini App ID to pre-configure."),
    template: z.enum(["zaui-blank", "zaui-tabs", "blank"]).optional().describe("Template type.")
  },
  async ({ targetDir, appName, appTitle, appId, template }) => {
    const res = await createAppProject({ targetDir, appName, appTitle, appId, template });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_build",
  "Build the Zalo Mini App project and automatically synchronize bundle assets with app-config.json.",
  {
    projectDir: z.string().describe("Absolute path to the project directory."),
    outputDirName: z.string().optional().describe('Build output directory name (default: "www").'),
    autoSyncAssets: z.boolean().optional().describe("Whether to auto sync listCSS/listAsyncJS (default: true).")
  },
  async ({ projectDir, outputDirName, autoSyncAssets }) => {
    const res = await buildProject({ projectDir, outputDirName, autoSyncAssets });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_sync_config",
  'Synchronize CSS and JS build assets into app-config.json and app.json to prevent "No asset defined" errors.',
  {
    projectDir: z.string().describe("Absolute path to the project directory."),
    outputDirName: z.string().optional().describe('Build output folder (default: "www").')
  },
  async ({ projectDir, outputDirName }) => {
    const res = await syncConfig({ projectDir, outputDirName });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_validate_project",
  "Validate project configuration, app-config.json format, bundle size limits (10MB/3MB), and allowed file extensions.",
  {
    projectDir: z.string().describe("Absolute path to the project directory."),
    outputDirName: z.string().optional().describe('Output folder to inspect (default: "www").')
  },
  async ({ projectDir, outputDirName }) => {
    const res = validateProject(projectDir, outputDirName);
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_deploy",
  "Deploy Zalo Mini App to Zalo Cloud with automatic asset synchronization, chunked upload, and testing quota tracking.",
  {
    projectDir: z.string().describe("Absolute path to the project directory."),
    versionStatus: z.enum(["TESTING", "DEVELOPMENT"]).optional().describe('Version status type (default: "TESTING" so you can submit for review).'),
    description: z.string().optional().describe("Release notes or version description."),
    outputDirName: z.string().optional().describe('Build output folder to deploy (default: "www").'),
    explicitToken: z.string().optional().describe("Optional token override."),
    devMode: z.boolean().optional().describe("Whether to deploy to development server (default: false).")
  },
  async ({ projectDir, versionStatus, description, outputDirName, explicitToken, devMode }) => {
    const res = await deployApp({
      projectDir,
      versionStatus,
      description,
      outputDirName,
      explicitToken,
      devMode
    });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((error) => {
  console.error("Fatal error in zmp-mcp server:", error);
  process.exit(1);
});
