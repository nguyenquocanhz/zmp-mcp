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
| `zmp_request_login_qr` | Request a login session and generate an ASCII QR code & verification link for Zalo mobile authorization. |
| `zmp_set_token` | Safely write or update `APP_ID` and `ZMP_TOKEN` in the project `.env`. |
| `zmp_get_app_info` | Query Mini App metadata, quotas, and versions from Zalo API. |
| `zmp_create_app` | Scaffold a clean Zalo Mini App project template with Vite, React 18, and ZAUi. |
| `zmp_build` | Build project for production and automatically sync assets with `app-config.json`. |
| `zmp_sync_config` | Synchronize CSS/JS bundles from build output (`www/assets`) into `app-config.json` and `app.json`. |
| `zmp_validate_project` | Run pre-flight linting on `app-config.json`, file size quotas, and asset extensions. |
| `zmp_deploy` | Upload bundle to Zalo Cloud with chunked Resumable protocol, testing quota tracking, and instant preview links. |

---

## 🚀 Quickstart & Setup

### 1. Installation

Clone and install dependencies:

```bash
git clone https://github.com/nguyenquocanhz/zmp-mcp.git
cd zmp-mcp
npm install
npm run build
```

---

### 2. Configuration for AI Clients

#### Claude Desktop

Add to your `claude_desktop_config.json` (`%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "zmp-mcp": {
      "command": "node",
      "args": ["D:/zmp-mcp/dist/index.js"]
    }
  }
}
```

#### Antigravity / Gemini CLI

Add to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "zmp-mcp": {
      "command": "node",
      "args": ["D:/zmp-mcp/dist/index.js"]
    }
  }
}
```

#### Cursor / Windsurf

In Cursor settings under **Features > MCP Servers**:
- **Name**: `zmp-mcp`
- **Type**: `command`
- **Command**: `node D:/zmp-mcp/dist/index.js`

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

---

## 📄 License

MIT © [Nguyen Quoc Anh](https://github.com/nguyenquocanhz)
