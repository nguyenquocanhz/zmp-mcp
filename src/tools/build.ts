import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { syncAppConfigAssets, validateOutputDir } from '../utils/files.js';

const execAsync = promisify(exec);

export async function buildProject(params: {
  projectDir: string;
  outputDirName?: string;
  autoSyncAssets?: boolean;
}) {
  const { projectDir, outputDirName = 'www', autoSyncAssets = true } = params;

  if (!fs.existsSync(projectDir)) {
    return {
      success: false,
      error: `Project directory does not exist: ${projectDir}`,
    };
  }

  try {
    // Try building with vite or npm run build
    let buildCmd = 'npx vite build';
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts?.build) {
        buildCmd = 'npm run build';
      }
    }

    const { stdout, stderr } = await execAsync(buildCmd, { cwd: projectDir });

    let syncedAssets: any = null;
    if (autoSyncAssets) {
      syncedAssets = syncAppConfigAssets(projectDir, outputDirName);
    }

    const validation = validateOutputDir(path.join(projectDir, outputDirName));

    return {
      success: true,
      buildOutput: stdout,
      buildError: stderr,
      syncedAssets: syncedAssets ? {
        listCSS: syncedAssets.listCSS,
        listAsyncJS: syncedAssets.listAsyncJS,
      } : null,
      validation,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr,
    };
  }
}

export async function syncConfig(params: { projectDir: string; outputDirName?: string }) {
  const { projectDir, outputDirName = 'www' } = params;
  try {
    const config = syncAppConfigAssets(projectDir, outputDirName);
    return {
      success: true,
      message: 'Successfully synchronized app-config.json and app.json with output build assets.',
      listCSS: config.listCSS || [],
      listAsyncJS: config.listAsyncJS || [],
      listSyncJS: config.listSyncJS || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}
