import QRCode from 'qrcode';
import { createZaloApiClient } from '../utils/http.js';
import { loadEnv, saveEnv } from '../utils/env.js';
import { ZALO_CONFIG } from '../config.js';

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

export async function requestLoginQr() {
  const client = createZaloApiClient();
  try {
    const res = await client.get(ZALO_CONFIG.ENDPOINTS.requestLogin);
    if (res.data && res.data.err === 0) {
      const code = res.data.data.code;
      const verifyUrl = `https://developers.zalo.me/tools/cli-login?code=${code}`;

      // Generate Data URL and Terminal ASCII
      const dataUrl = await QRCode.toDataURL(verifyUrl, { margin: 2, scale: 6 });
      const terminalQr = await QRCode.toString(verifyUrl, { type: 'terminal', small: true });

      return {
        success: true,
        code,
        verifyUrl,
        terminalQr,
        qrDataUrl: dataUrl,
        instructions:
          'Open your Zalo mobile app, scan this QR code or navigate to verifyUrl to authorize CLI access.',
      };
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

export async function setProjectToken(projectDir: string, appId?: string, token?: string) {
  saveEnv(projectDir, { appId, token });
  return {
    success: true,
    message: `Updated environment configuration in ${projectDir}/.env`,
    appId,
    hasToken: !!token,
  };
}
