/**
 * CLI kiểm duyệt chính sách: `zmp-audit [thư mục] [--json]`
 * Thoát mã 1 khi có vi phạm, để CI chặn được bản build không đạt.
 */
import { runPolicyAudit, formatPolicyReport } from './engine.js';

export function runPolicyCli(argv: string[]): number {
  const json = argv.includes('--json');
  const dir = argv.find((a) => !a.startsWith('--')) || process.cwd();
  const report = runPolicyAudit(dir);
  console.log(json ? JSON.stringify(report, null, 2) : formatPolicyReport(report, process.stdout.isTTY));
  return report.summary.errors ? 1 : 0;
}
