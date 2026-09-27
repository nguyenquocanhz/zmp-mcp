import QRCode from 'qrcode';
import { createZaloApiClient } from '../utils/http.js';
import { loadEnv, saveEnv } from '../utils/env.js';
import { ZALO_CONFIG } from '../config.js';
import { startLocalOAuthServer } from '../utils/oauth-server.js';

export async function getLoginStatus(projectDir: string, explicitToken?: string) {
  const env = loadEnv(projectDir);
  const token = explicitToken || env.token;

  if (!token) {
    return {
      isLoggedIn: false,
      message: 'No ZMP_TOKEN found. Run zmp_request_login_qr or set ZMP_TOKEN in .env.',
    };
  }

  const client = createZaloApiClient(token);
  try {
    const res = await client.get(ZALO_CONFIG.ENDPOINTS.checkLoginStatus);
    if (res.data && res.data.err === 0) {
      return {
        isLoggedIn: true,
        user: res.data.data,
        message: 'Successfully authenticated with Zalo Developer Platform.',
      };
    } else {
      return {
        isLoggedIn: false,
        error: res.data ? res.data.msg : 'Invalid session',
        message: 'ZMP_TOKEN expired or unauthorized.',
      };
    }
  } catch (err: any) {
    return {
      isLoggedIn: false,
      error: err.response?.data?.msg || err.message,
      message: 'Failed to verify login status with Zalo API.',
    };
  }
}

export async function pollLoginStatus(params: {
  zmpsk: string;
  projectDir?: string;
  timeoutSec?: number;
}) {
  const { zmpsk, projectDir, timeoutSec = 60 } = params;
  const client = createZaloApiClient();
  const startTime = Date.now();
  const maxTime = timeoutSec * 1000;

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
          message: 'Zalo mobile scan verified! Access token saved to .env.',
          token,
          data: res.data.data,
        };
      }
    } catch {
      // Keep polling on non-terminal errors
    }

    // Wait 2 seconds between checks
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return {
    success: false,
    error: `Login verification timed out after ${timeoutSec} seconds. Please scan and authorize again.`,
  };
}

export async function requestLoginQr(params: {
  projectDir?: string;
  appId?: string;
  waitForScan?: boolean;
  timeoutSec?: number;
} = {}) {
  const { projectDir, appId: explicitAppId, waitForScan = false, timeoutSec = 60 } = params;
  const env = projectDir ? loadEnv(projectDir) : {};
  const appId = explicitAppId || env.appId || '';

  const client = createZaloApiClient();
  try {
    const url = appId
      ? `${ZALO_CONFIG.ENDPOINTS.requestLogin}?appId=${encodeURIComponent(appId)}`
      : ZALO_CONFIG.ENDPOINTS.requestLogin;

    const res = await client.get(url);
    if (res.data && res.data.err === 0) {
      const data = res.data.data;
      const verifyUrl = data.loginUrl || `https://developers.zalo.me/tools/cli-login?code=${data.code}`;
      const zmpsk = data.zmpsk || data.code;

      const dataUrl = await QRCode.toDataURL(verifyUrl, { margin: 2, scale: 6 });
      const terminalQr = await QRCode.toString(verifyUrl, { type: 'terminal', small: true });

      const initialResult = {
        success: true,
        zmpsk,
        verifyUrl,
        terminalQr,
        qrDataUrl: dataUrl,
        instructions:
          'Scan this QR code with your mobile Zalo app to authorize CLI developer access.',
      };

      if (waitForScan && zmpsk) {
        const pollResult = await pollLoginStatus({ zmpsk, projectDir, timeoutSec });
        return {
          ...initialResult,
          scanResult: pollResult,
        };
      }

      return initialResult;
    } else {
      return {
        success: false,
        error: res.data?.msg || 'Could not initiate login session',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.msg || err.message,
    };
  }
}

export async function startOAuthCallback(params: {
  port?: number;
  timeoutSec?: number;
  projectDir?: string;
  zaloAppId?: string;
}) {
  const { port = 8085, timeoutSec = 120, projectDir, zaloAppId } = params;
  const timeoutMs = timeoutSec * 1000;

  try {
    const serverInstance = await startLocalOAuthServer({ port, timeoutMs });

    let authUrl = '';
    if (zaloAppId) {
      const state = Math.random().toString(36).substring(7);
      authUrl = `https://oauth.zaloapp.com/v4/permission?app_id=${zaloAppId}&redirect_uri=${encodeURIComponent(serverInstance.callbackUrl)}&state=${state}`;
    }

    // Wait for the browser callback in the background
    const callbackData = await serverInstance.waitForCallback();

    if (callbackData.code && projectDir) {
      // Automatically save authorization code if requested
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
      message: callbackData.error
        ? `OAuth failed: ${callbackData.errorDescription || callbackData.error}`
        : 'OAuth callback received successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function setProjectToken(projectDir: string, appId?: string, token?: string) {
  saveEnv(projectDir, { appId, token });
  return {
    success: true,
    message: `Updated environment configuration in ${projectDir}/.env`,
    appId,
    hasToken: !!token,
  };
}
