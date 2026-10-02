#!/usr/bin/env node


// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// src/tools/auth.ts
import crypto from "crypto";
import os from "os";
import path2 from "path";
import QRCode from "qrcode";

// src/utils/http.ts
import axios from "axios";

// src/config.ts
var SERVER_VERSION = "1.1.0";
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
    "User-Agent": `zmp-mcp/${SERVER_VERSION}`
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
import { URL as URL2 } from "url";
function escapeHtml(v) {
  return v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function startLocalOAuthServer(options) {
  const port = options.port || 8085;
  const timeoutMs = options.timeoutMs || 12e4;
  return new Promise((resolveStart, rejectStart) => {
    let server2;
    const callbackPromise = new Promise((resolveCallback, rejectCallback) => {
      let timeoutHandle;
      server2 = http.createServer((req, res) => {
        try {
          const reqUrl = new URL2(req.url || "/", `http://localhost:${port}`);
          if (reqUrl.pathname === "/oauth/callback" || reqUrl.pathname === "/callback") {
            const params = {};
            reqUrl.searchParams.forEach((val, key) => {
              params[key] = val;
            });
            const code = params["code"] || params["authorization_code"];
            const state = params["state"];
            const error = params["error"];
            const errorDescription = params["error_description"];
            const ok = !error;
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ok ? "X\xE1c th\u1EF1c th\xE0nh c\xF4ng" : "X\xE1c th\u1EF1c th\u1EA5t b\u1EA1i"}</title>
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
    <div class="icon">${ok ? "\u2713" : "\u2715"}</div>
    <h1>${ok ? "X\xE1c th\u1EF1c Zalo th\xE0nh c\xF4ng!" : "X\xE1c th\u1EF1c Zalo th\u1EA5t b\u1EA1i"}</h1>
    <p>${ok ? "Th\xF4ng tin x\xE1c th\u1EF1c \u0111\xE3 \u0111\u01B0\u1EE3c chuy\u1EC3n t\u1EF1 \u0111\u1ED9ng v\u1EC1 AI Assistant (Claude, Codex, Antigravity). B\u1EA1n c\xF3 th\u1EC3 \u0111\xF3ng c\u1EEDa s\u1ED5 n\xE0y." : escapeHtml(errorDescription || error || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh")}</p>
    <div class="badge">Session ID: ${escapeHtml(state || "OK")}</div>
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
function publicSessionInfo(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([k]) => !/jwt|token|secret|refresh|key/i.test(k)));
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
          return {
            success: true,
            message: "Zalo mobile scan verified! Access token saved to .env (ZMP_TOKEN).",
            tokenSaved: true,
            envPath: path2.join(projectDir, ".env"),
            session: publicSessionInfo(res.data.data)
          };
        }
        return {
          success: true,
          message: "Zalo mobile scan verified. No projectDir given, so the token is returned once: store it with zmp_set_token and do not share it.",
          tokenSaved: false,
          token,
          session: publicSessionInfo(res.data.data)
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
      const qrImagePath = path2.join(os.tmpdir(), `zmp-login-qr-${Date.now()}.png`);
      await QRCode.toFile(qrImagePath, verifyUrl, { margin: 2, scale: 6 });
      const initialResult = {
        success: true,
        zmpsk,
        verifyUrl,
        qrImagePath,
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
    let state = "";
    if (zaloAppId) {
      state = crypto.randomBytes(16).toString("hex");
      authUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${zaloAppId}&redirect_uri=${encodeURIComponent(serverInstance.callbackUrl)}&state=${state}`;
    }
    const callbackData = await serverInstance.waitForCallback();
    if (state && callbackData.state !== state) {
      return {
        success: false,
        authUrl,
        callbackUrl: serverInstance.callbackUrl,
        error: "state_mismatch",
        message: "OAuth callback rejected: state does not match the authorization request."
      };
    }
    void projectDir;
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
import path3 from "path";
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
  fs2.writeFileSync(path3.join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");
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
  fs2.writeFileSync(path3.join(targetDir, "app-config.json"), JSON.stringify(appConfig, null, 2), "utf8");
  fs2.writeFileSync(path3.join(targetDir, "app.json"), JSON.stringify(appConfig, null, 2), "utf8");
  const zmpConfig = {
    name: appName,
    title: appTitle,
    framework: "react",
    template
  };
  fs2.writeFileSync(path3.join(targetDir, "zmp.json"), JSON.stringify(zmpConfig, null, 2), "utf8");
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
  fs2.writeFileSync(path3.join(targetDir, "vite.config.js"), viteConfig, "utf8");
  const srcDir = path3.join(targetDir, "src");
  const pagesDir = path3.join(srcDir, "pages", "index");
  const cssDir = path3.join(srcDir, "css");
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
  fs2.writeFileSync(path3.join(cssDir, "app.scss"), appScss, "utf8");
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
  fs2.writeFileSync(path3.join(pagesDir, "index.jsx"), indexJsx, "utf8");
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
  fs2.writeFileSync(path3.join(srcDir, "app.jsx"), appJsx, "utf8");
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
  fs2.writeFileSync(path3.join(targetDir, "index.html"), indexHtml, "utf8");
  if (appId) {
    fs2.writeFileSync(path3.join(targetDir, ".env"), `APP_ID=${appId}
`, "utf8");
  }
  const gitignore = `node_modules
www
dist
.env
.DS_Store
`;
  fs2.writeFileSync(path3.join(targetDir, ".gitignore"), gitignore, "utf8");
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
import path5 from "path";
import fs4 from "fs";

// src/utils/files.ts
import fs3 from "fs";
import path4 from "path";
import archiver from "archiver";
function getAllFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs3.existsSync(dir)) return results;
  const list = fs3.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path4.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else {
      results.push(path4.relative(baseDir, fullPath).replace(/\\/g, "/"));
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
    const fullPath = path4.join(outputDir, relPath);
    const stat = fs3.statSync(fullPath);
    totalBytes += stat.size;
    const sizeMB = stat.size / (1024 * 1024);
    if (sizeMB > ZALO_CONFIG.LIMITS.maxFileSizeMB) {
      result.oversizedFiles.push({ file: relPath, sizeMB: parseFloat(sizeMB.toFixed(2)) });
      result.valid = false;
    }
    const ext = path4.extname(relPath).toLowerCase();
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
  const rootConfigPath = path4.join(projectDir, "app-config.json");
  const rootAppJsonPath = path4.join(projectDir, "app.json");
  const outConfigPath = path4.join(projectDir, outputDirName, "app-config.json");
  const assetsDir = path4.join(projectDir, outputDirName, "assets");
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
  if (fs3.existsSync(path4.join(projectDir, outputDirName))) {
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
    const pkgPath = path5.join(projectDir, "package.json");
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
    const validation = validateOutputDir(path5.join(projectDir, outputDirName));
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
import path6 from "path";
function validateProject(projectDir, outputDirName = "www") {
  const issues = [];
  const warnings = [];
  const passed = [];
  const rootConfigPath = path6.join(projectDir, "app-config.json");
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
  const zmpConfigPath = path6.join(projectDir, "zmp.json");
  if (!fs5.existsSync(zmpConfigPath)) {
    warnings.push("Missing zmp.json in project root.");
  } else {
    passed.push("zmp.json exists.");
  }
  const outDir = path6.join(projectDir, outputDirName);
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
import path7 from "path";
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
  const outDir = path7.join(projectDir, outputDirName);
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

// src/tools/webhook.ts
import http2 from "http";

// src/utils/signature.ts
import crypto2 from "crypto";
function buildMiniAppConcatenatedContent(data, apiKey) {
  const sortedKeys = Object.keys(data).filter((k) => k !== "signature" && k !== "mac" && k !== "x-zevent-signature").sort();
  let concatenated = "";
  for (const key of sortedKeys) {
    const val = data[key];
    if (val !== void 0 && val !== null) {
      if (typeof val === "object") {
        concatenated += JSON.stringify(val);
      } else {
        concatenated += String(val);
      }
    }
  }
  concatenated += apiKey;
  return { content: concatenated, sortedKeys };
}
function generateMiniAppWebhookSignature(data, apiKey) {
  const { content } = buildMiniAppConcatenatedContent(data, apiKey);
  return crypto2.createHash("sha256").update(content, "utf8").digest("hex");
}
function verifyMiniAppWebhookSignature(data, apiKey, receivedSignature) {
  const { content, sortedKeys } = buildMiniAppConcatenatedContent(data, apiKey);
  const expectedSignature = crypto2.createHash("sha256").update(content, "utf8").digest("hex");
  const cleanReceived = (receivedSignature || "").trim().toLowerCase();
  const isValid = cleanReceived === expectedSignature.toLowerCase();
  return {
    isValid,
    expectedSignature,
    calculatedContent: content,
    sortedKeys
  };
}
function generateOAWebhookSignature(params) {
  const dataStr = typeof params.data === "string" ? params.data : JSON.stringify(params.data);
  const raw = `${params.appId}${dataStr}${params.timestamp}${params.oaSecretKey}`;
  return crypto2.createHash("sha256").update(raw, "utf8").digest("hex");
}
function verifyOAWebhookSignature(params) {
  const expectedSignature = generateOAWebhookSignature(params);
  const cleanReceived = (params.receivedSignature || "").trim().toLowerCase();
  const isValid = cleanReceived === expectedSignature.toLowerCase();
  return {
    isValid,
    expectedSignature
  };
}

// src/tools/webhook.ts
var activeListener = null;
async function verifyWebhookTool(params) {
  const type = params.type || (params.oaSecretKey ? "oa" : "miniapp");
  if (type === "miniapp") {
    const apiKey = params.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: "Missing required apiKey for Zalo Mini App Open API signature."
      };
    }
    if (params.receivedSignature) {
      const result = verifyMiniAppWebhookSignature(params.payload, apiKey, params.receivedSignature);
      return {
        success: true,
        type: "miniapp",
        isValid: result.isValid,
        expectedSignature: result.expectedSignature,
        receivedSignature: params.receivedSignature,
        sortedKeys: result.sortedKeys,
        calculatedContent: result.calculatedContent,
        message: result.isValid ? "Signature is VALID. The webhook request comes genuinely from Zalo Platform." : "Signature MISMATCH. Check if payload fields or API Key are correct."
      };
    } else {
      const signature = generateMiniAppWebhookSignature(params.payload, apiKey);
      return {
        success: true,
        type: "miniapp",
        generatedSignature: signature,
        algorithm: "sha256(sorted_fields_values + apiKey)",
        note: "Pass this in x-zevent-signature header when testing your webhook endpoint."
      };
    }
  } else {
    const oaSecretKey = params.oaSecretKey;
    const appId = params.appId || String(params.payload.appId || "");
    const timestamp = params.timestamp || params.payload.timestamp || Date.now();
    if (!oaSecretKey || !appId) {
      return {
        success: false,
        error: "Missing oaSecretKey or appId for Zalo OA Webhook verification."
      };
    }
    if (params.receivedSignature) {
      const result = verifyOAWebhookSignature({
        appId,
        data: params.payload,
        timestamp,
        oaSecretKey,
        receivedSignature: params.receivedSignature
      });
      return {
        success: true,
        type: "oa",
        isValid: result.isValid,
        expectedSignature: result.expectedSignature,
        receivedSignature: params.receivedSignature
      };
    } else {
      const signature = generateOAWebhookSignature({
        appId,
        data: params.payload,
        timestamp,
        oaSecretKey
      });
      return {
        success: true,
        type: "oa",
        generatedSignature: signature,
        algorithm: "sha256(appId + data + timeStamp + OAsecretKey)"
      };
    }
  }
}
async function manageWebhookListener(params) {
  if (params.action === "stop") {
    if (!activeListener) {
      return { success: true, message: "No active webhook listener server running." };
    }
    await new Promise((resolve) => activeListener.server.close(() => resolve()));
    const port2 = activeListener.port;
    activeListener = null;
    return { success: true, message: `Webhook listener on port ${port2} has been stopped.` };
  }
  if (params.action === "status") {
    if (!activeListener) {
      return {
        running: false,
        message: 'No webhook listener currently running. Use action: "start" to launch one.'
      };
    }
    return {
      running: true,
      port: activeListener.port,
      apiKeyConfigured: Boolean(activeListener.apiKey),
      totalEventsReceived: activeListener.logs.length,
      recentEvents: activeListener.logs.slice(-10),
      tunnelTip: `Expose port ${activeListener.port} to the internet using: ngrok http ${activeListener.port} or cloudflared tunnel.`
    };
  }
  if (params.action === "clear_logs") {
    if (activeListener) {
      activeListener.logs = [];
    }
    return { success: true, message: "Webhook logs cleared." };
  }
  if (activeListener) {
    return {
      running: true,
      port: activeListener.port,
      message: `Webhook listener is already running on port ${activeListener.port}. Use action "stop" first if you wish to change port.`,
      tunnelTip: `Expose port ${activeListener.port} to the internet using: ngrok http ${activeListener.port}`
    };
  }
  const port = params.port || 8086;
  const apiKey = params.apiKey;
  const logs = [];
  const server2 = http2.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-zevent-signature, authorization");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          service: "zmp-mcp Webhook Listener",
          status: "ready",
          eventsReceived: logs.length,
          recentEvents: logs.slice(-5)
        })
      );
      return;
    }
    if (req.method === "POST") {
      let rawBody = "";
      req.on("data", (chunk) => {
        rawBody += chunk;
      });
      req.on("end", () => {
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
        const signatureHeader = req.headers["x-zevent-signature"] || req.headers["x-event-signature"] || req.headers["signature"];
        let verification = { checked: false };
        if (apiKey && parsedBody && typeof parsedBody === "object") {
          if (signatureHeader) {
            const vRes = verifyMiniAppWebhookSignature(parsedBody, apiKey, signatureHeader);
            verification = {
              checked: true,
              isValid: vRes.isValid,
              expectedSignature: vRes.expectedSignature
            };
          } else {
            verification = {
              checked: true,
              isValid: false,
              expectedSignature: generateMiniAppWebhookSignature(parsedBody, apiKey)
            };
          }
        }
        const entry = {
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
          method: req.method || "POST",
          url: req.url || "/",
          headers: req.headers,
          signatureHeader,
          body: parsedBody,
          verification
        };
        logs.push(entry);
        if (logs.length > 50) logs.shift();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: 0,
            message: "Success",
            receivedEvent: parsedBody?.event || "unknown"
          })
        );
      });
      return;
    }
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: 405, message: "Method Not Allowed" }));
  });
  await new Promise((resolve, reject) => {
    server2.listen(port, () => resolve());
    server2.on("error", (err) => reject(err));
  });
  activeListener = {
    server: server2,
    port,
    apiKey,
    logs
  };
  return {
    success: true,
    running: true,
    port,
    apiKeyConfigured: Boolean(apiKey),
    endpoint: `http://localhost:${port}/api/zalo-webhook`,
    message: `Webhook listener server started on port ${port}.`,
    tunnelTip: `Run "ngrok http ${port}" or "cloudflared tunnel --url http://localhost:${port}" to get a public HTTPS URL for Zalo Developer Portal.`
  };
}
function getWebhookIntegrationGuide() {
  return {
    title: "Zalo Mini App Webhook Integration Guide",
    portalUrl: "https://mini.zalo.me/developers",
    steps: [
      "1. Truy c\u1EADp https://mini.zalo.me/developers -> Ch\u1ECDn \u1EE9ng d\u1EE5ng Mini App c\u1EE7a b\u1EA1n.",
      '2. V\xE0o m\u1EE5c "Open APIS" \u1EDF menu b\xEAn tr\xE1i -> ch\u1ECDn "Qu\u1EA3n l\xFD APIs".',
      '3. T\xECm tr\u01B0\u1EDDng "Webhook URL" v\xE0 \u0111i\u1EC1n URL m\xE1y ch\u1EE7 webhook (b\u1EAFt bu\u1ED9c giao th\u1EE9c HTTPS).',
      "4. C\u1EA5u h\xECnh IP Whitelist: Khai b\xE1o \u0111\u1ECBa ch\u1EC9 IP c\xF4ng khai c\u1EE7a m\xE1y ch\u1EE7 backend \u0111\u1EC3 Zalo cho ph\xE9p g\u1EEDi webhook.",
      '5. L\u1EA5y "API Key" (d\xE0nh cho \u0111\u1ED1i t\xE1c gi\u1EA3i ph\xE1p ho\u1EB7c nh\xE0 ph\xE1t tri\u1EC3n) \u0111\u1EC3 ti\u1EBFn h\xE0nh x\xE1c th\u1EF1c ch\u1EEF k\xFD (Signature).'
    ],
    signatureVerificationRule: {
      header: "x-zevent-signature",
      algorithm: "sha256(content + apiKey)",
      contentRule: "S\u1EAFp x\u1EBFp t\u1EA5t c\u1EA3 c\xE1c field keys trong payload JSON theo b\u1EA3ng ch\u1EEF c\xE1i (A-Z), gh\xE9p c\xE1c gi\xE1 tr\u1ECB l\u1EA1i th\xE0nh chu\u1ED7i, sau \u0111\xF3 n\u1ED1i th\xEAm apiKey v\xE0 hash sha256."
    },
    commonEvents: [
      {
        name: "user.revoke.consent",
        description: "Ng\u01B0\u1EDDi d\xF9ng r\xFAt l\u1EA1i quy\u1EC1n \u0111\u1ED3ng \xFD ho\u1EB7c y\xEAu c\u1EA7u x\xF3a d\u1EEF li\u1EC7u c\xE1 nh\xE2n theo Ngh\u1ECB \u0111\u1ECBnh 13/2023/N\u0110-CP. M\xE1y ch\u1EE7 c\u1EA7n x\xF3a ho\u1EB7c \u1EA9n th\xF4ng tin t\u01B0\u01A1ng \u1EE9ng.",
        samplePayload: {
          appId: "2522725584854781271",
          event: "user.revoke.consent",
          timestamp: 17274384e5,
          userId: "zalo_user_id_here"
        }
      },
      {
        name: "version_review_status",
        description: "Th\xF4ng b\xE1o k\u1EBFt qu\u1EA3 x\xE9t duy\u1EC7t phi\xEAn b\u1EA3n Mini App (\u0110\xE3 duy\u1EC7t ho\u1EB7c B\u1ECB t\u1EEB ch\u1ED1i).",
        samplePayload: {
          appId: "2522725584854781271",
          event: "app_version_status",
          version: "5",
          status: "APPROVED",
          timestamp: 17274384e5
        }
      },
      {
        name: "payment_status",
        description: "Th\xF4ng b\xE1o tr\u1EA1ng th\xE1i thanh to\xE1n \u0111\u01A1n h\xE0ng t\u1EEB Zalo Checkout SDK.",
        samplePayload: {
          appId: "2522725584854781271",
          event: "payment_callback",
          orderId: "ORDER_123456",
          transId: "ZALO_TRANS_789",
          amount: 5e4,
          status: "SUCCESS",
          timestamp: 17274384e5
        }
      }
    ],
    responseRequirements: {
      status: 200,
      format: { error: 0, message: "Success" },
      timeout: "Ph\u1EA3i ph\u1EA3n h\u1ED3i trong v\xF2ng 2 gi\xE2y. N\u1EBFu th\u1EA5t b\u1EA1i, Zalo s\u1EBD retry sau 30s, 5m, 15m, 30m, 1h."
    }
  };
}

// src/tools/audit.ts
import fs7 from "fs";
import path8 from "path";
import axios2 from "axios";
async function auditWebEndpoint(targetUrl, findings) {
  const urlObj = new URL(targetUrl);
  if (urlObj.protocol !== "https:") {
    findings.push({
      owaspCategory: "A02:2021 - Cryptographic Failures",
      title: "Insecure Transport Protocol (HTTP)",
      severity: "CRITICAL",
      description: `Target endpoint uses unencrypted HTTP protocol (${targetUrl}). Webhook payloads and user data can be intercepted.`,
      location: targetUrl,
      recommendation: "Enforce HTTPS for all production APIs and Mini App endpoints. Obtain a valid TLS/SSL certificate."
    });
  }
  try {
    const res = await axios2.get(targetUrl, {
      validateStatus: () => true,
      timeout: 1e4,
      headers: {
        "User-Agent": "zmp-mcp-security-audit/1.0"
      }
    });
    const headers = res.headers;
    if (!headers["strict-transport-security"] && urlObj.protocol === "https:") {
      findings.push({
        owaspCategory: "A05:2021 - Security Misconfiguration",
        title: "Missing HSTS (Strict-Transport-Security) Header",
        severity: "MEDIUM",
        description: "Server does not advertise HSTS header. Browsers may be susceptible to SSL-stripping man-in-the-middle attacks.",
        location: targetUrl,
        recommendation: "Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
      });
    }
    if (!headers["x-content-type-options"]) {
      findings.push({
        owaspCategory: "A05:2021 - Security Misconfiguration",
        title: "Missing X-Content-Type-Options Header",
        severity: "LOW",
        description: 'Missing "X-Content-Type-Options: nosniff". Browsers may attempt to MIME-sniff response content, opening XSS risks.',
        location: targetUrl,
        recommendation: 'Configure server to return "X-Content-Type-Options: nosniff".'
      });
    }
    if (!headers["x-frame-options"] && !headers["content-security-policy"]) {
      findings.push({
        owaspCategory: "A05:2021 - Security Misconfiguration",
        title: "Missing Clickjacking Protection (X-Frame-Options / CSP)",
        severity: "MEDIUM",
        description: "Missing X-Frame-Options or Content-Security-Policy with frame-ancestors. Endpoint could be framed for clickjacking.",
        location: targetUrl,
        recommendation: `Add "X-Frame-Options: DENY" (or SAMEORIGIN) or CSP "frame-ancestors 'none'".`
      });
    }
    const serverHeader = headers["server"] || "";
    const poweredBy = headers["x-powered-by"] || "";
    if (serverHeader.match(/(apache\/\d|nginx\/\d|php\/\d|express)/i) || poweredBy) {
      findings.push({
        owaspCategory: "A05:2021 - Security Misconfiguration",
        title: "Detailed Server Version / Banner Disclosure",
        severity: "LOW",
        description: `Server leaks specific software versions (${serverHeader || poweredBy}). Facilitates attacker fingerprinting.`,
        location: "HTTP Response Headers",
        recommendation: "Disable Server banner tokens and remove X-Powered-By header."
      });
    }
    const corsOrigin = headers["access-control-allow-origin"];
    const corsCreds = headers["access-control-allow-credentials"];
    if (corsOrigin === "*" && corsCreds === "true") {
      findings.push({
        owaspCategory: "A01:2021 - Broken Access Control",
        title: "Critical CORS Misconfiguration (Wildcard with Credentials)",
        severity: "CRITICAL",
        description: 'Access-Control-Allow-Origin is set to wildcard "*" while Access-Control-Allow-Credentials is true.',
        location: "CORS Headers",
        recommendation: 'Explicitly specify trusted origins instead of wildcard "*" when credentials are permitted.'
      });
    } else if (corsOrigin === "*") {
      findings.push({
        owaspCategory: "A01:2021 - Broken Access Control",
        title: "Wildcard CORS Origin Policy",
        severity: "INFO",
        description: "Access-Control-Allow-Origin: * allows any web origin to read responses.",
        location: "CORS Headers",
        recommendation: "If this API handles private user data, restrict CORS to authorized domains only."
      });
    }
    if (res.status === 500) {
      const dataStr = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      if (dataStr.includes("Stack trace") || dataStr.includes("Exception") || dataStr.includes("SQLSTATE")) {
        findings.push({
          owaspCategory: "A09:2021 - Security Logging and Monitoring Failures",
          title: "Detailed Exception / Stack Trace Exposure on 500 Error",
          severity: "HIGH",
          description: "Server returned raw stack trace or database error message to client.",
          location: targetUrl,
          recommendation: "Sanitize error outputs in production. Log full traces internally and return generic error envelopes."
        });
      }
    }
  } catch (err) {
    findings.push({
      owaspCategory: "A05:2021 - Security Misconfiguration",
      title: "Endpoint Unreachable or Connection Refused",
      severity: "HIGH",
      description: `Failed to connect to ${targetUrl}: ${err.message}`,
      location: targetUrl,
      recommendation: "Verify server is running, firewall ports are open, and DNS resolves properly."
    });
  }
}
function auditProjectSource(projectDir, findings) {
  if (!fs7.existsSync(projectDir)) {
    findings.push({
      owaspCategory: "A05:2021 - Security Misconfiguration",
      title: "Project Directory Not Found",
      severity: "HIGH",
      description: `Directory does not exist: ${projectDir}`,
      recommendation: "Provide a valid project directory path."
    });
    return;
  }
  const sensitiveFiles = [".env", ".env.local", "id_rsa", "private.key", "credentials.json"];
  for (const sFile of sensitiveFiles) {
    const sPath = path8.join(projectDir, sFile);
    if (fs7.existsSync(sPath)) {
      const gitIgnorePath = path8.join(projectDir, ".gitignore");
      const gitIgnoreContent = fs7.existsSync(gitIgnorePath) ? fs7.readFileSync(gitIgnorePath, "utf8") : "";
      if (!gitIgnoreContent.includes(sFile)) {
        findings.push({
          owaspCategory: "A07:2021 - Identification and Authentication Failures",
          title: `Sensitive Environment File Not in .gitignore (${sFile})`,
          severity: "HIGH",
          description: `Found ${sFile} in project directory, but it is not explicitly listed in .gitignore. Risk of accidental credential commit.`,
          location: sPath,
          recommendation: `Add "${sFile}" to .gitignore immediately and revoke any committed keys.`
        });
      }
    }
  }
  function scanDir(dir, depth = 0) {
    if (depth > 6) return;
    const entries = fs7.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (["node_modules", "dist", "build", "www", ".git"].includes(entry.name)) continue;
      const fullPath = path8.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(jsx?|tsx?|php|json|html)$/i.test(entry.name)) {
        auditFileContent(fullPath, findings);
      }
    }
  }
  scanDir(projectDir);
}
function auditFileContent(filePath, findings) {
  const relPath = path8.basename(filePath);
  const content = fs7.readFileSync(filePath, "utf8");
  const secretPatterns = [
    { regex: /AIzaSy[0-9A-Za-z_-]{33}/g, name: "Google API Key" },
    { regex: /sk_live_[0-9a-zA-Z]{24}/g, name: "Stripe Secret Key" },
    { regex: /(bearer\s+eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/gi, name: "Hardcoded JWT Access Token" },
    { regex: /(apiKey|api_secret|oaSecretKey|secretKey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi, name: "Hardcoded Secret / API Key" }
  ];
  for (const { regex, name } of secretPatterns) {
    if (regex.test(content) && !filePath.includes(".example.") && !filePath.includes("test")) {
      findings.push({
        owaspCategory: "A07:2021 - Identification and Authentication Failures",
        title: `Hardcoded Credential Detected: ${name}`,
        severity: "CRITICAL",
        description: `Found potential hardcoded credential (${name}) directly in source code.`,
        location: relPath,
        recommendation: "Extract secrets to environment variables (.env) and never hardcode credentials in code."
      });
    }
  }
  if (/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g.test(content)) {
    findings.push({
      owaspCategory: "A03:2021 - Injection",
      title: "Dangerous Inner HTML Injection (XSS Vulnerability)",
      severity: "HIGH",
      description: 'Found usage of "dangerouslySetInnerHTML". Unsanitized dynamic user input passed here can execute malicious scripts.',
      location: relPath,
      recommendation: "Sanitize HTML input using DOMPurify before rendering, or prefer safe React text children."
    });
  }
  if (/\beval\s*\(/.test(content)) {
    findings.push({
      owaspCategory: "A03:2021 - Injection",
      title: "Usage of eval() Execution Sink",
      severity: "CRITICAL",
      description: "Found call to eval(). Arbitrary JavaScript execution risk.",
      location: relPath,
      recommendation: "Refactor code to avoid eval(). Use JSON.parse() for data serialization."
    });
  }
  const insecureHttpMatches = content.match(/http:\/\/(?!(localhost|127\.0\.0\.1|0\.0\.0\.0))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (insecureHttpMatches && insecureHttpMatches.length > 0 && !filePath.includes("test")) {
    findings.push({
      owaspCategory: "A02:2021 - Cryptographic Failures",
      title: "Plaintext HTTP Request URL in Codebase",
      severity: "MEDIUM",
      description: `Found plaintext HTTP URLs (${insecureHttpMatches.slice(0, 3).join(", ")}). Insecure transport can cause mixed-content blocking.`,
      location: relPath,
      recommendation: "Upgrade all external resource and API URLs to HTTPS."
    });
  }
  if (content.includes("x-zevent-signature") && content.includes("verify") === false && filePath.includes("webhook")) {
    findings.push({
      owaspCategory: "A08:2021 - Software and Data Integrity Failures",
      title: "Unverified Webhook Signature",
      severity: "HIGH",
      description: "Webhook code references x-zevent-signature but does not appear to perform constant-time cryptographic verification.",
      location: relPath,
      recommendation: "Verify incoming webhook signatures using sha256(content + apiKey) and constant-time string comparison."
    });
  }
}
async function runOwaspAudit(params) {
  const findings = [];
  if (params.url) {
    await auditWebEndpoint(params.url, findings);
  }
  if (params.projectDir) {
    auditProjectSource(params.projectDir, findings);
  }
  let score = 100;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;
  const owaspCategories = [
    "A01:2021 - Broken Access Control",
    "A02:2021 - Cryptographic Failures",
    "A03:2021 - Injection",
    "A04:2021 - Insecure Design",
    "A05:2021 - Security Misconfiguration",
    "A06:2021 - Vulnerable and Outdated Components",
    "A07:2021 - Identification and Authentication Failures",
    "A08:2021 - Software and Data Integrity Failures",
    "A09:2021 - Security Logging and Monitoring Failures",
    "A10:2021 - Server-Side Request Forgery (SSRF)"
  ];
  const owaspCompliance = {};
  for (const cat of owaspCategories) {
    owaspCompliance[cat] = { status: "PASS", count: 0 };
  }
  for (const f of findings) {
    if (f.severity === "CRITICAL") {
      score -= 25;
      criticalCount++;
    } else if (f.severity === "HIGH") {
      score -= 15;
      highCount++;
    } else if (f.severity === "MEDIUM") {
      score -= 8;
      mediumCount++;
    } else if (f.severity === "LOW") {
      score -= 3;
      lowCount++;
    } else {
      infoCount++;
    }
    if (owaspCompliance[f.owaspCategory]) {
      owaspCompliance[f.owaspCategory].count++;
      if (["CRITICAL", "HIGH"].includes(f.severity)) {
        owaspCompliance[f.owaspCategory].status = "FAIL";
      } else if (owaspCompliance[f.owaspCategory].status !== "FAIL") {
        owaspCompliance[f.owaspCategory].status = "WARNING";
      }
    }
  }
  score = Math.max(0, Math.min(100, score));
  let grade = "A+";
  if (score >= 95) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    target: {
      url: params.url,
      projectDir: params.projectDir
    },
    securityScore: score,
    grade,
    summary: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      info: infoCount,
      total: findings.length
    },
    findings,
    owaspCompliance
  };
}

// src/policy/engine.ts
import fs8 from "fs";
import path9 from "path";
var CODE_EXT = /\.(jsx?|tsx?|vue|svelte|html)$/i;
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "www", "build", ".git", ".zmp", "coverage"]);
var MAX_FILE_BYTES = 1024 * 1024;
var ZALO_HOSTS = /^(https?:)?\/\/([a-z0-9-]+\.)*(zalo\.me|zaloapp\.com|zalo\.vn|zdn\.vn|zaloplatforms\.com)(\/|$)/i;
var MANUAL_CHECKS = [
  "Logo: n\u1EC1n m\xE0u \u0111\u1EB7c (kh\xF4ng trong su\u1ED1t), kh\xF4ng ch\u1EE9a S\u0110T hay QR, kh\xF4ng d\xF9ng logo th\u01B0\u01A1ng hi\u1EC7u kh\xE1c.",
  "T\xEAn tr\xEAn trang qu\u1EA3n l\xFD Mini App kh\u1EDBp t\xEAn trong app-config.json.",
  "M\xF4 t\u1EA3 tr\xEAn trang qu\u1EA3n l\xFD: kh\xF4ng \u0111\u1EC3 tr\u1ED1ng, kh\xF4ng ch\u1EE9a link, \u0111\xFAng ch\u1EE9c n\u0103ng.",
  "M\u1ECDi n\xFAt b\u1EA5m ho\u1EA1t \u0111\u1ED9ng th\u1EADt, kh\xF4ng m\xE0n h\xECnh tr\u1EAFng, t\u1EA3i d\u01B0\u1EDBi 10 gi\xE2y.",
  "D\u1EEF li\u1EC7u hi\u1EC3n th\u1ECB l\xE0 th\u1EADt (\u0111\u1ECBa ch\u1EC9, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i, gi\xE1), kh\xF4ng ph\u1EA3i d\u1EEF li\u1EC7u b\u1ECBa.",
  "Ng\xE0nh \u0111\u1EB7c th\xF9 (d\u01B0\u1EE3c, m\u1EF9 ph\u1EA9m, t\xE0i ch\xEDnh) c\xF3 gi\u1EA5y ph\xE9p; chi\u1EBFn d\u1ECBch c\xF3 ng\xE0y k\u1EBFt th\xFAc."
];
function listFiles(dir, out = []) {
  if (!fs8.existsSync(dir)) return out;
  for (const entry of fs8.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) listFiles(path9.join(dir, entry.name), out);
    } else if (CODE_EXT.test(entry.name)) {
      const full = path9.join(dir, entry.name);
      if (fs8.statSync(full).size <= MAX_FILE_BYTES) out.push(full);
    }
  }
  return out;
}
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
}
function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}
function blockFrom(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}
function checkTitle(title) {
  const out = [];
  const t = title.trim();
  if (!t) {
    out.push({ ruleId: "NAME_EMPTY", severity: "ERROR", message: "T\xEAn Mini App (app.title) \u0111ang \u0111\u1EC3 tr\u1ED1ng." });
    return out;
  }
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length > 3 && letters === letters.toLocaleUpperCase("vi")) {
    out.push({ ruleId: "NAME_ALL_CAPS", severity: "ERROR", message: `T\xEAn "${t}" vi\u1EBFt hoa to\xE0n b\u1ED9.` });
  }
  if (/\bzalo\b/i.test(t) || /mini\s*-?\s*app/i.test(t)) {
    out.push({ ruleId: "NAME_BANNED_WORDS", severity: "ERROR", message: `T\xEAn "${t}" ch\u1EE9a t\u1EEB c\u1EA5m "Zalo" ho\u1EB7c "Mini App".` });
  } else if (/\bapps?\b/i.test(t)) {
    out.push({ ruleId: "NAME_BANNED_WORDS", severity: "ERROR", message: `T\xEAn "${t}" ch\u1EE9a t\u1EEB c\u1EA5m "App".` });
  } else if (/app\b/i.test(t)) {
    out.push({
      ruleId: "NAME_BANNED_WORDS",
      severity: "WARNING",
      message: `T\xEAn "${t}" c\xF3 ch\u1EEF "App" d\xEDnh trong th\u01B0\u01A1ng hi\u1EC7u; ng\u01B0\u1EDDi duy\u1EC7t c\xF3 th\u1EC3 coi l\xE0 ch\u1EE9a t\u1EEB c\u1EA5m "App".`
    });
  }
  if (/[#$@!~%^&*+=<>?\\|{}[\]]/.test(t) || new RegExp("\\p{Extended_Pictographic}", "u").test(t)) {
    out.push({ ruleId: "NAME_SPECIAL_CHARS", severity: "ERROR", message: `T\xEAn "${t}" ch\u1EE9a k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t ho\u1EB7c emoji.` });
  }
  const GENERIC = /^(tra|cứu|quy|đổi|mã|bưu|chính|điện|zip|code|postal|việt|nam|toàn|quốc|online|mua|sắm|thời|trang|đặt|vé|xem|phim|giao|hàng|tin|tức|bán|lẻ|thanh|toán|giá|xăng|dầu|và|,)$/i;
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (!/\s[-–|:]\s/.test(t) && words.every((w) => GENERIC.test(w))) {
    out.push({
      ruleId: "NAME_GENERIC_KEYWORD",
      severity: "ERROR",
      message: `T\xEAn "${t}" ch\u1EC9 g\u1ED3m t\u1EEB kho\xE1 chung, thi\u1EBFu ch\u1EE7 th\u1EC3 s\u1EDF h\u1EEFu (c\xF4ng th\u1EE9c: [Ch\u1EE7 th\u1EC3] - [Ch\u1EE9c n\u0103ng]).`
    });
  }
  return out;
}
var CODE_RULES = [
  {
    ruleId: "CONTENT_EXTERNAL_LINK",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /<a\b[^>]*\bhref\s*=\s*\{?\s*[`'"]((?:https?:)?\/\/[^`'"]+)[`'"][^>]*>/gi,
    message: "Th\u1EBB <a> tr\u1ECF ra website ngo\xE0i: ng\u01B0\u1EDDi d\xF9ng b\u1ECB \u0111\u01B0a kh\u1ECFi Mini App. D\xF9ng openWebview c\u1EE7a zmp-sdk ho\u1EB7c nh\xFAng n\u1ED9i dung.",
    ignore: (m) => ZALO_HOSTS.test(m[1])
  },
  {
    ruleId: "CONTENT_EXTERNAL_LINK",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /\bwindow\.open\s*\(/g,
    message: "window.open m\u1EDF tr\xECnh duy\u1EC7t ngo\xE0i. D\xF9ng openWebview c\u1EE7a zmp-sdk."
  },
  {
    ruleId: "CONTENT_EXTERNAL_LINK",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /\b(?:window\.)?location(?:\.href)?\s*=\s*[`'"]((?:https?:)?\/\/[^`'"]+)/g,
    message: "\u0110i\u1EC1u h\u01B0\u1EDBng th\u1EB3ng sang website ngo\xE0i b\u1EB1ng location.href.",
    ignore: (m) => ZALO_HOSTS.test(m[1])
  },
  {
    ruleId: "CONTENT_OPEN_OUT_APP",
    category: "4. N\u1ED9i dung",
    severity: "WARNING",
    pattern: /\bopenOutApp\s*\(/g,
    message: "openOutApp \u0111\u01B0a ng\u01B0\u1EDDi d\xF9ng ra kh\u1ECFi Zalo; ch\u1EC9 d\xF9ng khi th\u1EADt c\u1EA7n v\xE0 kh\xF4ng v\xEC m\u1EE5c \u0111\xEDch k\xE9o ng\u01B0\u1EDDi d\xF9ng sang app kh\xE1c."
  },
  {
    ruleId: "CONTENT_3RD_PARTY_LOGIN",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /(accounts\.google\.com|facebook\.com\/v\d|appleid\.apple\.com|signInWithPopup|GoogleAuthProvider|FacebookAuthProvider)/g,
    message: "\u0110\u0103ng nh\u1EADp b\u1EB1ng Google/Facebook/Apple b\u1ECB c\u1EA5m; d\xF9ng x\xE1c th\u1EF1c c\u1EE7a Zalo."
  },
  {
    ruleId: "CONTENT_UNAUTHORIZED_ADS",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /(adsbygoogle|googlesyndication|doubleclick\.net|admob|adcolony|unityads)/gi,
    message: "M\u1EA1ng qu\u1EA3ng c\xE1o b\xEAn ngo\xE0i b\u1ECB c\u1EA5m trong Mini App."
  },
  {
    ruleId: "CONTENT_CASHOUT",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /(rút tiền|rut tien|trả thưởng|tra thuong|đổi thưởng tiền mặt|cash\s*out)/gi,
    message: "T\xEDnh n\u0103ng r\xFAt ti\u1EC1n / tr\u1EA3 th\u01B0\u1EDFng ti\u1EC1n m\u1EB7t b\u1ECB c\u1EA5m."
  },
  {
    ruleId: "PERF_DEMO_CONTENT",
    category: "5. Hi\u1EC7u su\u1EA5t",
    severity: "WARNING",
    // \b không hiểu chữ có dấu ("đ"), nên chặn biên từ bằng lookaround Unicode
    pattern: /[`'">][^`'"<\n]*?(?<![\p{L}\p{N}])(demo|coming soon|lorem ipsum|đang phát triển|sắp ra mắt|dữ liệu mẫu|vị trí mẫu|dữ liệu giả|test data)(?![\p{L}\p{N}])[^`'"<\n]*/giu,
    message: 'Ch\u1EEF hi\u1EC3n th\u1ECB mang t\xEDnh demo / d\u1EEF li\u1EC7u m\u1EABu: ng\u01B0\u1EDDi duy\u1EC7t t\u1EEB ch\u1ED1i t\xEDnh n\u0103ng "ch\u01B0a ho\xE0n thi\u1EC7n".'
  },
  {
    ruleId: "SEC_EVAL",
    category: "7. B\u1EA3o m\u1EADt",
    severity: "ERROR",
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(/g,
    message: "eval / new Function b\u1ECB c\u1EA5m."
  },
  {
    ruleId: "SEC_INSECURE_HTTP",
    category: "7. B\u1EA3o m\u1EADt",
    severity: "WARNING",
    pattern: /[`'"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])[^`'"\s]+/g,
    message: "K\u1EBFt n\u1ED1i HTTP kh\xF4ng m\xE3 ho\xE1; d\xF9ng HTTPS."
  }
];
var PERMISSION_CALL = /\b(getPhoneNumber|getUserInfo|authorize|getLocation|requestCameraPermission|navigator\.geolocation\.(?:getCurrentPosition|watchPosition))\s*\(/;
function checkPermissionsOnLoad(src, rel) {
  const out = [];
  const re = /\buseEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  let m;
  while (m = re.exec(src)) {
    const body = blockFrom(src, m.index + m[0].length - 1);
    const after = src.slice(m.index + m[0].length - 1 + body.length, m.index + m[0].length - 1 + body.length + 40);
    if (!/^\s*(,\s*\[\s*\]\s*)?\)/.test(after)) continue;
    const call = PERMISSION_CALL.exec(body);
    if (call) {
      out.push({
        ruleId: "PERM_ON_LOAD",
        category: "6. Xin quy\u1EC1n",
        severity: "ERROR",
        message: `Xin quy\u1EC1n (${call[1]}) ngay khi m\u1EDF app. Ch\u1EC9 xin khi ng\u01B0\u1EDDi d\xF9ng b\u1EA5m v\xE0o t\xEDnh n\u0103ng c\u1EA7n quy\u1EC1n.`,
        file: rel,
        line: lineOf(src, m.index + m[0].length - 1 + call.index)
      });
    }
  }
  return out;
}
function checkPayment(allSrc) {
  const cta = /[`'">]\s*(mua ngay|đặt hàng|thanh toán ngay|thêm vào giỏ|checkout)\s*[`'"<]/i;
  const sdk = /\b(Payment\.createOrder|createOrder|purchase)\s*\(/;
  if (cta.test(allSrc) && !sdk.test(allSrc)) {
    return {
      ruleId: "PAYMENT_NO_CHECKOUT_SDK",
      category: "8. Thanh to\xE1n",
      severity: "ERROR",
      message: 'C\xF3 n\xFAt mua / thanh to\xE1n nh\u01B0ng kh\xF4ng d\xF9ng Checkout SDK c\u1EE7a Zalo. T\xEDch h\u1EE3p Checkout SDK, ho\u1EB7c \u0111\u1ED5i n\xFAt sang "Li\xEAn h\u1EC7".'
    };
  }
  return null;
}
function readTitle(file, kind) {
  if (!fs8.existsSync(file)) return null;
  const raw = fs8.readFileSync(file, "utf8");
  if (kind === "html") return /<title>([^<]*)<\/title>/i.exec(raw)?.[1].trim() ?? null;
  try {
    return JSON.parse(raw)?.app?.title ?? null;
  } catch {
    return null;
  }
}
function runPolicyAudit(projectDir) {
  const root = path9.resolve(projectDir);
  const findings = [];
  const passed = [];
  const configPath = path9.join(root, "app-config.json");
  let appTitle = null;
  if (!fs8.existsSync(configPath)) {
    findings.push({ ruleId: "CONFIG_MISSING", category: "2. T\xEAn", severity: "ERROR", message: "Kh\xF4ng c\xF3 app-config.json." });
  } else {
    appTitle = readTitle(configPath, "json");
    if (appTitle === null) {
      findings.push({ ruleId: "CONFIG_INVALID", category: "2. T\xEAn", severity: "ERROR", message: "app-config.json l\u1ED7i JSON ho\u1EB7c thi\u1EBFu app.title.", file: "app-config.json" });
    } else {
      const nameIssues = checkTitle(appTitle).map((f) => ({ ...f, category: "2. T\xEAn", file: "app-config.json" }));
      findings.push(...nameIssues);
      if (!nameIssues.length) passed.push(`T\xEAn "${appTitle}" \u0111\u1EA1t c\xE1c lu\u1EADt t\u1EF1 \u0111\u1ED9ng (vi\u1EBFt hoa, t\u1EEB c\u1EA5m, k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t, ch\u1EE7 th\u1EC3).`);
      const others = [
        ["app.json", readTitle(path9.join(root, "app.json"), "json")],
        ["index.html <title>", readTitle(path9.join(root, "index.html"), "html")]
      ];
      const mismatched = others.filter(([, v]) => v !== null && v.trim() !== appTitle.trim());
      if (mismatched.length) {
        findings.push({
          ruleId: "NAME_INCONSISTENT",
          category: "2. T\xEAn",
          severity: "WARNING",
          message: `T\xEAn kh\xF4ng th\u1ED1ng nh\u1EA5t: app-config.json "${appTitle}" \u2260 ${mismatched.map(([k, v]) => `${k} "${v}"`).join(", ")}.`
        });
      } else passed.push("T\xEAn th\u1ED1ng nh\u1EA5t gi\u1EEFa app-config.json, app.json v\xE0 index.html.");
    }
  }
  const files = listFiles(path9.join(root, "src"));
  const indexHtml = path9.join(root, "index.html");
  if (fs8.existsSync(indexHtml)) files.push(indexHtml);
  let allSrc = "";
  for (const file of files) {
    const rel = path9.relative(root, file).replace(/\\/g, "/");
    const src = stripComments(fs8.readFileSync(file, "utf8"));
    allSrc += "\n" + src;
    for (const rule of CODE_RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      while (m = rule.pattern.exec(src)) {
        if (rule.ignore?.(m, src)) continue;
        const line = lineOf(src, m.index);
        findings.push({
          ruleId: rule.ruleId,
          category: rule.category,
          severity: rule.severity,
          message: rule.message,
          file: rel,
          line,
          snippet: src.split("\n")[line - 1].trim().slice(0, 140)
        });
      }
    }
    findings.push(...checkPermissionsOnLoad(src, rel));
  }
  const payment = checkPayment(allSrc);
  if (payment) findings.push(payment);
  const hit = (id) => findings.some((f) => f.ruleId === id);
  const codeChecks = [
    ["CONTENT_EXTERNAL_LINK", "Kh\xF4ng \u0111i\u1EC1u h\u01B0\u1EDBng ra website ngo\xE0i."],
    ["CONTENT_3RD_PARTY_LOGIN", "Kh\xF4ng \u0111\u0103ng nh\u1EADp Google/Facebook/Apple."],
    ["CONTENT_UNAUTHORIZED_ADS", "Kh\xF4ng c\xF3 m\u1EA1ng qu\u1EA3ng c\xE1o ngo\xE0i."],
    ["CONTENT_CASHOUT", "Kh\xF4ng c\xF3 r\xFAt ti\u1EC1n / tr\u1EA3 th\u01B0\u1EDFng."],
    ["PERF_DEMO_CONTENT", "Kh\xF4ng c\xF3 ch\u1EEF demo / d\u1EEF li\u1EC7u m\u1EABu."],
    ["PERM_ON_LOAD", "Kh\xF4ng xin quy\u1EC1n ngay khi m\u1EDF app."],
    ["SEC_EVAL", "Kh\xF4ng d\xF9ng eval."],
    ["SEC_INSECURE_HTTP", "Kh\xF4ng c\xF3 k\u1EBFt n\u1ED1i HTTP kh\xF4ng m\xE3 ho\xE1."],
    ["PAYMENT_NO_CHECKOUT_SDK", "Kh\xF4ng c\xF3 n\xFAt mua thi\u1EBFu Checkout SDK."]
  ];
  for (const [id, label] of codeChecks) if (!hit(id)) passed.push(label);
  const errors = findings.filter((f) => f.severity === "ERROR").length;
  const warnings = findings.length - errors;
  const verdict = errors ? `C\xF3 ${errors} vi ph\u1EA1m c\u1EA7n s\u1EEDa tr\u01B0\u1EDBc khi g\u1EEDi duy\u1EC7t.` : warnings ? `Kh\xF4ng c\xF3 vi ph\u1EA1m ch\u1EAFc ch\u1EAFn; c\xF2n ${warnings} c\u1EA3nh b\xE1o c\u1EA7n xem v\xE0 ${MANUAL_CHECKS.length} m\u1EE5c ki\u1EC3m tay.` : `Kh\xF4ng ph\xE1t hi\u1EC7n vi ph\u1EA1m t\u1EF1 \u0111\u1ED9ng; c\xF2n ${MANUAL_CHECKS.length} m\u1EE5c ph\u1EA3i ki\u1EC3m tay tr\u01B0\u1EDBc khi g\u1EEDi duy\u1EC7t.`;
  return {
    projectDir: root,
    appTitle,
    summary: { errors, warnings, filesScanned: files.length },
    findings,
    passed,
    manualChecks: MANUAL_CHECKS,
    verdict
  };
}
function formatPolicyReport(r, color = true) {
  const c = (code, s) => color ? `\x1B[${code}m${s}\x1B[0m` : s;
  const lines = [c("1;36", "ZMP POLICY AUDIT \u2014 Ch\xEDnh s\xE1ch ki\u1EC3m duy\u1EC7t Zalo Mini App"), `D\u1EF1 \xE1n: ${r.projectDir}`, `T\xEAn app: ${r.appTitle ?? "(kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c)"}`, ""];
  for (const p of r.passed) lines.push(`${c("32", "\u2714")} ${p}`);
  if (r.findings.length) lines.push("");
  for (const f of r.findings) {
    const tag = f.severity === "ERROR" ? c("31", "\u2716 VI PH\u1EA0M") : c("33", "\u25B2 C\u1EA2NH B\xC1O");
    const loc = f.file ? c("2", ` (${f.file}${f.line ? `:${f.line}` : ""})`) : "";
    lines.push(`${tag} [${f.ruleId}] ${f.message}${loc}`);
    if (f.snippet) lines.push(c("2", `    ${f.snippet}`));
  }
  lines.push("", c("1", "C\u1EA7n ki\u1EC3m tay:"));
  for (const m of r.manualChecks) lines.push(`  \u2610 ${m}`);
  lines.push("", c(r.summary.errors ? "1;31" : "1;32", r.verdict));
  return lines.join("\n");
}

// src/policy/cli.ts
function runPolicyCli(argv) {
  const json = argv.includes("--json");
  const dir = argv.find((a) => !a.startsWith("--")) || process.cwd();
  const report = runPolicyAudit(dir);
  console.log(json ? JSON.stringify(report, null, 2) : formatPolicyReport(report, process.stdout.isTTY));
  return report.summary.errors ? 1 : 0;
}

// src/index.ts
var server = new McpServer({
  name: "zmp-mcp",
  version: SERVER_VERSION
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
server.tool(
  "zmp_verify_webhook",
  "Verify or generate Zalo Webhook signatures (supports Zalo Mini App Open API sha256 sorted fields and Zalo OA Webhooks).",
  {
    payload: z.record(z.any()).describe("The JSON payload object received in the webhook request."),
    apiKey: z.string().optional().describe("Zalo Mini App Open API Key (or Partner API Key)."),
    oaSecretKey: z.string().optional().describe("Zalo Official Account (OA) Secret Key (if verifying OA webhook)."),
    appId: z.string().optional().describe("Zalo App ID."),
    timestamp: z.union([z.number(), z.string()]).optional().describe("Optional event timestamp."),
    receivedSignature: z.string().optional().describe("Signature received in the x-zevent-signature header. If omitted, generates test signature."),
    type: z.enum(["miniapp", "oa"]).optional().describe('Webhook type: "miniapp" (default) or "oa".')
  },
  async ({ payload, apiKey, oaSecretKey, appId, timestamp, receivedSignature, type }) => {
    const res = await verifyWebhookTool({
      payload,
      apiKey,
      oaSecretKey,
      appId,
      timestamp,
      receivedSignature,
      type
    });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_manage_webhook_listener",
  "Start, stop, check status, or clear logs of a local Zalo Webhook receiver server for local testing and debugging.",
  {
    action: z.enum(["start", "stop", "status", "clear_logs"]).describe("Action to perform on the listener."),
    port: z.number().optional().describe("Local port to listen on (default: 8086)."),
    apiKey: z.string().optional().describe("Optional API Key to auto-verify incoming x-zevent-signature.")
  },
  async ({ action, port, apiKey }) => {
    const res = await manageWebhookListener({ action, port, apiKey });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_get_webhook_docs",
  "Get comprehensive technical documentation, event schemas (Decree 13 user deletion, version review, payment), and integration guide for Zalo Mini App Webhook.",
  {},
  async () => {
    const res = getWebhookIntegrationGuide();
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_owasp_audit",
  "Perform comprehensive OWASP Top 10 security audit on a live Web/Webhook endpoint (headers, TLS, CORS, info disclosure) or project codebase (hardcoded secrets, XSS, insecure transport).",
  {
    url: z.string().optional().describe("Target HTTP/HTTPS URL to scan for OWASP Top 10 vulnerabilities."),
    projectDir: z.string().optional().describe("Target project directory to statically analyze for security flaws.")
  },
  async ({ url, projectDir }) => {
    const res = await runOwaspAudit({ url, projectDir });
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
server.tool(
  "zmp_policy_audit",
  'Audit a Zalo Mini App project against the official Zalo Mini App censorship policy: app name rules (no "Zalo"/"Mini App"/"App", no ALL CAPS, no emoji, owner prefix, consistent across app-config/app.json/index.html), external links (<a href>, window.open, location.href), permission requests on load, 3rd-party login, ads, cash-out, demo/sample content, eval, insecure HTTP, purchase buttons without Checkout SDK. Returns findings with file:line plus the checks that must be done by hand.',
  {
    projectDir: z.string().describe("Absolute path to the Zalo Mini App project directory (containing app-config.json and src/).")
  },
  async ({ projectDir }) => {
    const res = runPolicyAudit(projectDir);
    return {
      content: [{ type: "text", text: JSON.stringify(res, null, 2) }]
    };
  }
);
async function main() {
  if (process.argv[2] === "audit") {
    process.exitCode = runPolicyCli(process.argv.slice(3));
    return;
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((error) => {
  console.error("Fatal error in zmp-mcp server:", error);
  process.exit(1);
});
