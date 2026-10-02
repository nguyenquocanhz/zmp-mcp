/**
 * Điểm vào cho bản CLI đứng riêng (dist/zmp-audit.cjs). Bản này được chép vào từng dự án
 * Mini App làm `zmp-audit.js`, chạy offline, không cần cài zmp-mcp.
 */
import { runPolicyCli } from './cli.js';

process.exitCode = runPolicyCli(process.argv.slice(2));
