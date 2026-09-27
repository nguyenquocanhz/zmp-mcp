import fs from 'fs';
import path from 'path';
import { validateOutputDir } from '../utils/files.js';

export function validateProject(projectDir: string, outputDirName: string = 'www') {
  const issues: string[] = [];
  const warnings: string[] = [];
  const passed: string[] = [];

  // 1. Check app-config.json
  const rootConfigPath = path.join(projectDir, 'app-config.json');
  if (!fs.existsSync(rootConfigPath)) {
    issues.push('Missing app-config.json in project root.');
  } else {
    try {
      const config = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
      if (!config.app?.appId) {
        warnings.push('appId is missing or empty in app-config.json.');
      } else {
        passed.push(`Valid Mini App ID: ${config.app.appId}`);
      }
      if (!config.pages || config.pages.length === 0) {
        issues.push('pages array is empty in app-config.json.');
      }
      if (!config.listAsyncJS && !config.listSyncJS) {
        warnings.push('No script entry (listAsyncJS/listSyncJS) defined in app-config.json. Run zmp_sync_config.');
      }
      passed.push('app-config.json format is valid JSON.');
    } catch (e: any) {
      issues.push(`app-config.json syntax error: ${e.message}`);
    }
  }

  // 2. Check zmp.json
  const zmpConfigPath = path.join(projectDir, 'zmp.json');
  if (!fs.existsSync(zmpConfigPath)) {
    warnings.push('Missing zmp.json in project root.');
  } else {
    passed.push('zmp.json exists.');
  }

  // 3. Check output directory
  const outDir = path.join(projectDir, outputDirName);
  const outValidation = validateOutputDir(outDir);
  if (!outValidation.valid) {
    if (outValidation.oversizedFiles.length > 0) {
      issues.push(
        `Files exceeding 3MB limit: ${outValidation.oversizedFiles.map((f) => `${f.file} (${f.sizeMB}MB)`).join(', ')}`
      );
    }
    if (outValidation.invalidExtensionFiles.length > 0) {
      issues.push(`Files with disallowed extensions: ${outValidation.invalidExtensionFiles.join(', ')}`);
    }
    if (outValidation.missingRequiredFiles.length > 0) {
      issues.push(`Missing required files in build: ${outValidation.missingRequiredFiles.join(', ')}`);
    }
  } else if (fs.existsSync(outDir)) {
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
      checkedOutputDir: outDir,
    },
  };
}
