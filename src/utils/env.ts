import fs from 'fs';
import path from 'path';

export interface ZmpEnv {
  appId?: string;
  token?: string;
}

export function loadEnv(projectDir: string): ZmpEnv {
  const envPath = path.join(projectDir, '.env');
  const result: ZmpEnv = {
    appId: process.env.APP_ID,
    token: process.env.ZMP_TOKEN,
  };

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === 'APP_ID') result.appId = val;
        if (key === 'ZMP_TOKEN') result.token = val;
      }
    }
  }

  return result;
}

export function saveEnv(projectDir: string, values: { appId?: string; token?: string }) {
  const envPath = path.join(projectDir, '.env');
  let currentContent = '';
  if (fs.existsSync(envPath)) {
    currentContent = fs.readFileSync(envPath, 'utf8');
  }

  const lines = currentContent ? currentContent.split(/\r?\n/) : [];
  let foundAppId = false;
  let foundToken = false;

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('APP_ID=') && values.appId) {
      foundAppId = true;
      return `APP_ID=${values.appId}`;
    }
    if (trimmed.startsWith('ZMP_TOKEN=') && values.token) {
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

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
}
