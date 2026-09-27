import fs from 'fs';
import path from 'path';
import { createZaloApiClient, uploadChunkOctet } from '../utils/http.js';
import { loadEnv } from '../utils/env.js';
import { syncAppConfigAssets, validateOutputDir, zipDirectory } from '../utils/files.js';
import { ZALO_CONFIG } from '../config.js';

export async function deployApp(params: {
  projectDir: string;
  versionStatus?: 'TESTING' | 'DEVELOPMENT';
  description?: string;
  outputDirName?: string;
  explicitToken?: string;
  devMode?: boolean;
}) {
  const {
    projectDir,
    versionStatus = 'TESTING',
    description = 'Deployed via zmp-mcp',
    outputDirName = 'www',
    explicitToken,
    devMode = false,
  } = params;

  const env = loadEnv(projectDir);
  const token = explicitToken || env.token;

  if (!token) {
    return {
      success: false,
      error: 'Missing ZMP_TOKEN. Authenticate first or provide explicitToken.',
    };
  }

  const outDir = path.join(projectDir, outputDirName);
  if (!fs.existsSync(outDir)) {
    return {
      success: false,
      error: `Output build directory does not exist: ${outDir}. Please run zmp_build first.`,
    };
  }

  // 1. Sync assets into app-config.json
  const syncedConfig = syncAppConfigAssets(projectDir, outputDirName);

  // 2. Validate output directory
  const validation = validateOutputDir(outDir);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Build output failed validation checks.',
      validation,
    };
  }

  // 3. Compress directory to zip buffer
  const zipBuffer = await zipDirectory(outDir);

  // 4. Request upload identifier from Zalo API
  const client = createZaloApiClient(token, devMode);
  const appName = syncedConfig.app?.title || 'Zalo Mini App';
  const queryParams = new URLSearchParams({
    name: appName,
    desc: description,
    config: JSON.stringify(syncedConfig),
    versionStatus: versionStatus, // Must be 'TESTING' or 'DEVELOPMENT'
  });

  let requestUploadRes;
  try {
    requestUploadRes = await client.get(
      `${ZALO_CONFIG.ENDPOINTS.requestUpload}?${queryParams.toString()}`
    );
  } catch (err: any) {
    return {
      success: false,
      error: `Request upload API failed: ${err.response?.data?.msg || err.message}`,
    };
  }

  if (!requestUploadRes.data || requestUploadRes.data.err !== 0) {
    return {
      success: false,
      error: requestUploadRes.data?.msg || 'Failed to request upload identifier from Zalo.',
      rawResponse: requestUploadRes.data,
    };
  }

  const uploadData = requestUploadRes.data.data;
  const identifier = uploadData.identifier;
  const nextVersion = uploadData.nextVersion;
  const quotas = uploadData.uploadConstraints?.currentUploadCount;

  // 5. Upload Chunks
  const chunkSize = 500 * 1024; // 500 KB per chunk
  const totalSize = zipBuffer.length;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const targetUrl = `${devMode ? ZALO_CONFIG.API_DOMAIN.dev : ZALO_CONFIG.API_DOMAIN.prod}${ZALO_CONFIG.ENDPOINTS.uploadChunk}`;

  let lastResponse: any = null;
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
        fileName: 'www.zip',
        chunkBuffer,
      });

      if (lastResponse && lastResponse.err < 0) {
        return {
          success: false,
          error: `Error uploading chunk ${i + 1}/${totalChunks}: ${lastResponse.msg}`,
          rawResponse: lastResponse,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Network error on chunk ${i + 1}/${totalChunks}: ${err.response?.data?.msg || err.message}`,
      };
    }
  }

  const deployedInfo = lastResponse?.data || {};
  const appId = syncedConfig.app?.appId || env.appId;
  const appUrl =
    deployedInfo.appUrl ||
    `https://zalo.me/s/${appId}/?env=${versionStatus}&version=${deployedInfo.versionId || nextVersion}`;

  return {
    success: true,
    message: `Successfully deployed version to Zalo Mini App Cloud (${versionStatus})!`,
    versionId: deployedInfo.versionId || nextVersion,
    appUrl,
    versionStatus,
    description,
    quotas: {
      current: quotas,
      limits: ZALO_CONFIG.LIMITS.quotas,
    },
    bundleSizeKB: Math.round(totalSize / 1024),
  };
}
