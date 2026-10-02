# ZMP-MCP 🚀

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.30.1-green.svg)](https://modelcontextprotocol.io)
[![Zalo Mini App](https://img.shields.io/badge/Zalo%20Mini%20App-Platform-0068FF.svg)](https://miniapp.zaloplatforms.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ZMP-MCP** is an official-grade [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server engineered for **Zalo Mini App (ZMP)** development, automated validation, and cloud deployment.

It bridges AI Coding Assistants (**Antigravity**, **Claude Desktop**, **Cursor**, **VS Code / Cline**, **Windsurf**) directly with the Zalo Mini App Platform ecosystem.

---

## 🌟 Highlights & Solved Problems

- 🔄 **Bulletproof Cloud Deployment**: Natively handles chunked uploads via Zalo Developer API. Fixes the notorious `The 'versionStatus' is invalid` bug by enforcing standard `TESTING` / `DEVELOPMENT` statuses.
- ⚡ **Zero-Config Asset Synchronization**: Automatically inspects Vite / Webpack build outputs and synchronizes `listCSS`, `listSyncJS`, and `listAsyncJS` into `app-config.json` and `app.json`. Eliminates the common *"No asset defined"* deployment error.
- 🛡️ **Pre-flight Validation**: Automatically checks bundle size constraints (max 10MB zip, max 3MB per file) and validates file extensions against Zalo's strict whitelist (`.css`, `.js`, `.json`, `.png`, `.woff2`, etc.) before uploading.
- 🔐 **Developer Authentication**: Generate QR codes for mobile Zalo scanning directly in the terminal, check login status, and manage project `.env` tokens seamlessly.
- 🎨 **Modern Project Scaffolding**: Create production-ready Zalo Mini Apps with React 18, ZAUi, Vite, and Dark Mode zero-flicker compliance out of the box.

---

## 🛠️ Available MCP Tools

| Tool Name | Description |
| :--- | :--- |
| `zmp_get_login_status` | Check authentication status and developer identity with Zalo Platform. |
| `zmp_request_login_qr` | Request login session, generate QR code & link; optionally wait/poll until user scans. |
| `zmp_wait_for_login` | Poll for mobile Zalo QR confirmation and automatically persist `ZMP_TOKEN` into `.env`. |
| `zmp_start_oauth_callback` | Launch local HTTP OAuth server (e.g. `http://localhost:8085/oauth/callback`) to catch redirect codes with HTML feedback. |
| `zmp_set_token` | Safely write or update `APP_ID` and `ZMP_TOKEN` in the project `.env`. |
| `zmp_get_app_info` | Query Mini App metadata, quotas, and versions from Zalo API. |
| `zmp_create_app` | Scaffold a clean Zalo Mini App project template with Vite, React 18, and ZAUi. |
| `zmp_build` | Build project for production and automatically sync assets with `app-config.json`. |
| `zmp_sync_config` | Synchronize CSS/JS bundles from build output (`www/assets`) into `app-config.json` and `app.json`. |
| `zmp_validate_project` | Run pre-flight linting on `app-config.json`, file size quotas, and asset extensions. |
| `zmp_deploy` | Upload bundle to Zalo Cloud with chunked Resumable protocol, testing quota tracking, and instant preview links. |
| `zmp_verify_webhook` | Verify or generate Zalo Webhook signatures (`x-zevent-signature`, SHA-256 sorted fields, Decree 13 user deletion). |
| `zmp_manage_webhook_listener` | Start or manage a local webhook listener server with auto-signature checking for tunnels (ngrok/cloudflare). |
| `zmp_get_webhook_docs` | Get comprehensive technical documentation, event schemas, and integration guide for Zalo Mini App Webhook. |
| `zmp_owasp_audit` | Perform comprehensive OWASP Top 10 security audit on live Web/Webhook endpoints and local codebases. |
| `zmp_policy_audit` | Audit a project against the Zalo Mini App censorship policy: name rules, external links, permission requests on load, 3rd-party login, ads, cash-out, demo content, eval, HTTP, purchase without Checkout SDK. Returns `file:line` findings plus checks that must be done by hand. |

---

## 🛡️ Policy Audit CLI

The same censorship-policy engine as `zmp_policy_audit` runs from the command line. It exits with code 1 when there is a violation, so CI can block a non-compliant build:

```bash
npx -y github:nguyenquocanhz/zmp-mcp audit ./my-mini-app        # text report
npx -y github:nguyenquocanhz/zmp-mcp audit ./my-mini-app --json # JSON report
```

`npm run build` also emits `dist/zmp-audit.cjs`, a dependency-free copy you can drop into a Mini App project as `zmp-audit.js` to run offline (`node zmp-audit.js`). Edit the rules in `src/policy/engine.ts`, never the copy.

---

## 🚀 Quickstart & Setup (Zero Configuration via npx)

No need to clone or hardcode local paths. You can execute `zmp-mcp` directly via **npx**:

```bash
npx -y github:nguyenquocanhz/zmp-mcp
```

---

### Configuration for AI Clients

#### 1. Claude Code CLI & Claude Desktop

**Via Claude Code CLI:**
```bash
/mcp add zmp-mcp npx -y github:nguyenquocanhz/zmp-mcp
```

**Via `claude_desktop_config.json`:**
```json
{
  "mcpServers": {
    "zmp-mcp": {
      "command": "npx",
      "args": ["-y", "github:nguyenquocanhz/zmp-mcp"]
    }
  }
}
```

#### 2. OpenAI Codex CLI & Desktop

**Via Codex CLI:**
```bash
codex mcp add zmp-mcp -- npx -y github:nguyenquocanhz/zmp-mcp
```

**Via `~/.codex/config.toml`:**
```toml
[mcp_servers."zmp-mcp"]
command = "npx"
args = [ "-y", "github:nguyenquocanhz/zmp-mcp" ]
```

#### 3. Antigravity / Gemini CLI

Add to `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "zmp-mcp": {
      "command": "npx",
      "args": ["-y", "github:nguyenquocanhz/zmp-mcp"]
    }
  }
}
```

#### 4. Cursor / Windsurf

In Cursor settings under **Features > MCP Servers**:
- **Name**: `zmp-mcp`
- **Type**: `command`
- **Command**: `npx -y github:nguyenquocanhz/zmp-mcp`

---

## 💡 Typical Agent Workflows

### 1. Create a New Zalo Mini App
> *"Agent, create a new Zalo Mini App named `coffee-shop` titled 'Quán Cà Phê Zalo' with template `zaui-blank` in `D:/Projects/coffee-shop`."*

The agent calls `zmp_create_app` to generate the complete project with Dark Mode, ZAUi layout, and Vite setup.

### 2. Validate & Build
> *"Build the project and make sure all assets are registered in `app-config.json`."*

The agent executes `zmp_build`, producing the bundle and automatically mapping `assets/index.xxx.css` and `assets/index.xxx.js` into `app-config.json`.

### 3. Deploy to Testing
> *"Deploy this mini app as a Testing version with description 'Release v1.0.0'."*

The agent executes `zmp_deploy`, packaging `www/`, uploading chunks to `https://zmp-api.developers.zalo.me/app/upload-chunk`, and returning the test URL (`https://zalo.me/s/...`) with quota report.

### 4. Webhook Verification & Local Testing (Decree 13 Compliance)
> *"Start a webhook listener to test Zalo user data deletion events and verify signatures."*

The agent executes `zmp_manage_webhook_listener` (with action: `start`, port: `8086`), giving you a ready-to-test endpoint for tunneling (`ngrok http 8086`) and verifying signatures with `zmp_verify_webhook`.

---

## 📄 License

MIT © [Nguyen Quoc Anh](https://github.com/nguyenquocanhz)
