import crypto from 'crypto';

/**
 * Zalo Mini App Open API Webhook Signature Specification:
 * 1. Extract all fields in payload (excluding signature keys if present).
 * 2. Sort field keys alphabetically (A-Z).
 * 3. Concatenate the string representations of their values + API Key.
 * 4. Compute SHA-256 hex digest.
 */
export function buildMiniAppConcatenatedContent(data: Record<string, any>, apiKey: string): { content: string; sortedKeys: string[] } {
  const sortedKeys = Object.keys(data)
    .filter((k) => k !== 'signature' && k !== 'mac' && k !== 'x-zevent-signature')
    .sort();

  let concatenated = '';
  for (const key of sortedKeys) {
    const val = data[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object') {
        concatenated += JSON.stringify(val);
      } else {
        concatenated += String(val);
      }
    }
  }

  concatenated += apiKey;
  return { content: concatenated, sortedKeys };
}

export function generateMiniAppWebhookSignature(data: Record<string, any>, apiKey: string): string {
  const { content } = buildMiniAppConcatenatedContent(data, apiKey);
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function verifyMiniAppWebhookSignature(
  data: Record<string, any>,
  apiKey: string,
  receivedSignature: string
): {
  isValid: boolean;
  expectedSignature: string;
  calculatedContent: string;
  sortedKeys: string[];
} {
  const { content, sortedKeys } = buildMiniAppConcatenatedContent(data, apiKey);
  const expectedSignature = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const cleanReceived = (receivedSignature || '').trim().toLowerCase();
  const isValid = cleanReceived === expectedSignature.toLowerCase();

  return {
    isValid,
    expectedSignature,
    calculatedContent: content,
    sortedKeys,
  };
}

/**
 * Zalo Official Account (OA) Webhook Signature:
 * signature = sha256(appId + data + timeStamp + OAsecretKey)
 */
export function generateOAWebhookSignature(params: {
  appId: string;
  data: string | Record<string, any>;
  timestamp: number | string;
  oaSecretKey: string;
}): string {
  const dataStr = typeof params.data === 'string' ? params.data : JSON.stringify(params.data);
  const raw = `${params.appId}${dataStr}${params.timestamp}${params.oaSecretKey}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function verifyOAWebhookSignature(params: {
  appId: string;
  data: string | Record<string, any>;
  timestamp: number | string;
  oaSecretKey: string;
  receivedSignature: string;
}): {
  isValid: boolean;
  expectedSignature: string;
} {
  const expectedSignature = generateOAWebhookSignature(params);
  const cleanReceived = (params.receivedSignature || '').trim().toLowerCase();
  const isValid = cleanReceived === expectedSignature.toLowerCase();
  return {
    isValid,
    expectedSignature,
  };
}
