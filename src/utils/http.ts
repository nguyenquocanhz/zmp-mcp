import axios, { AxiosInstance } from 'axios';
import { ZALO_CONFIG } from '../config.js';

export function createZaloApiClient(token?: string, devMode: boolean = false): AxiosInstance {
  const baseURL = devMode ? ZALO_CONFIG.API_DOMAIN.dev : ZALO_CONFIG.API_DOMAIN.prod;
  const headers: Record<string, string> = {
    'cache-control': 'no-cache',
    'User-Agent': 'zmp-mcp/1.0.0',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return axios.create({
    baseURL,
    headers,
    timeout: 30000,
  });
}

export async function uploadChunkOctet(params: {
  targetUrl: string;
  token: string;
  identifier: string;
  chunkNumber: number;
  totalChunks: number;
  chunkSize: number;
  currentChunkSize: number;
  totalSize: number;
  fileName: string;
  chunkBuffer: Buffer;
}) {
  const query = new URLSearchParams({
    resumableChunkNumber: params.chunkNumber.toString(),
    resumableChunkSize: params.chunkSize.toString(),
    resumableCurrentChunkSize: params.currentChunkSize.toString(),
    resumableTotalSize: params.totalSize.toString(),
    resumableType: 'application/x-zip-compressed',
    resumableIdentifier: params.identifier,
    resumableFilename: params.fileName,
    resumableRelativePath: params.fileName,
    resumableTotalChunks: params.totalChunks.toString(),
  });

  const fullUrl = `${params.targetUrl}?${query.toString()}`;

  const response = await axios.post(fullUrl, params.chunkBuffer, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/octet-stream',
    },
    timeout: 60000,
  });

  return response.data;
}
