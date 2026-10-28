/**
 * Engine kiểm duyệt chính sách Zalo Mini App (tĩnh, không cần mạng).
 * Nguồn chính sách: https://miniapp.zaloplatforms.com/documents/zalo-mini-app-censorship-policy/
 *
 * Engine chỉ báo những gì đọc được từ code và cấu hình. Logo, mô tả trên trang quản lý,
 * giấy phép ngành nghề... phải kiểm bằng mắt: chúng nằm trong `manualChecks`, và báo cáo
 * không bao giờ nói "sẵn sàng 100%" khi còn mục kiểm tay.
 */
import fs from 'fs';
import path from 'path';

export type Severity = 'ERROR' | 'WARNING';

export interface PolicyFinding {
  ruleId: string;
  category: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  snippet?: string;
}

export interface PolicyReport {
  projectDir: string;
  appTitle: string | null;
  summary: { errors: number; warnings: number; filesScanned: number };
  findings: PolicyFinding[];
  passed: string[];
  manualChecks: string[];
  verdict: string;
}

const CODE_EXT = /\.(jsx?|tsx?|vue|svelte|html)$/i;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'www', 'build', '.git', '.zmp', 'coverage']);
const MAX_FILE_BYTES = 1024 * 1024; // file dữ liệu khổng lồ (vd: danh sách mã bưu chính) không phải UI

// Domain được phép điều hướng tới mà không rời hệ sinh thái Zalo
const ZALO_HOSTS = /^(https?:)?\/\/([a-z0-9-]+\.)*(zalo\.me|zaloapp\.com|zalo\.vn|zdn\.vn|zaloplatforms\.com)(\/|$)/i;

const MANUAL_CHECKS = [
  'Logo: nền màu đặc (không trong suốt), không chứa SĐT hay QR, không dùng logo thương hiệu khác.',
  'Tên trên trang quản lý Mini App khớp tên trong app-config.json.',
  'Mô tả trên trang quản lý: không để trống, không chứa link, đúng chức năng.',
  'Mọi nút bấm hoạt động thật, không màn hình trắng, tải dưới 10 giây.',
  'Dữ liệu hiển thị là thật (địa chỉ, số điện thoại, giá), không phải dữ liệu bịa.',
  'Ngành đặc thù (dược, mỹ phẩm, tài chính) có giấy phép; chiến dịch có ngày kết thúc.',
];

function listFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) listFiles(path.join(dir, entry.name), out);
    } else if (CODE_EXT.test(entry.name)) {
      const full = path.join(dir, entry.name);
      if (fs.statSync(full).size <= MAX_FILE_BYTES) out.push(full);
    }
  }
  return out;
}

/** Thay comment bằng khoảng trắng (giữ nguyên số dòng) để không bắt nhầm chữ trong comment */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
}

function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

/** Thân hàm bắt đầu tại dấu `{` ở vị trí `open`, tính theo cặp ngoặc */
function blockFrom(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

// ─── Luật về tên (Mục 2 của chính sách) ───

export function checkTitle(title: string): Array<Omit<PolicyFinding, 'category'>> {
  const out: Array<Omit<PolicyFinding, 'category'>> = [];
  const t = title.trim();
  if (!t) {
    out.push({ ruleId: 'NAME_EMPTY', severity: 'ERROR', message: 'Tên Mini App (app.title) đang để trống.' });
    return out;
  }
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length > 3 && letters === letters.toLocaleUpperCase('vi')) {
    out.push({ ruleId: 'NAME_ALL_CAPS', severity: 'ERROR', message: `Tên "${t}" viết hoa toàn bộ.` });
  }
  if (/\bzalo\b/i.test(t) || /mini\s*-?\s*app/i.test(t)) {
    out.push({ ruleId: 'NAME_BANNED_WORDS', severity: 'ERROR', message: `Tên "${t}" chứa từ cấm "Zalo" hoặc "Mini App".` });
  } else if (/\bapps?\b/i.test(t)) {
    out.push({ ruleId: 'NAME_BANNED_WORDS', severity: 'ERROR', message: `Tên "${t}" chứa từ cấm "App".` });
  } else if (/app\b/i.test(t)) {
    out.push({
      ruleId: 'NAME_BANNED_WORDS',
      severity: 'WARNING',
      message: `Tên "${t}" có chữ "App" dính trong thương hiệu; người duyệt có thể coi là chứa từ cấm "App".`,
    });
  }
  if (/[#$@!~%^&*+=<>?\\|{}[\]]/.test(t) || /\p{Extended_Pictographic}/u.test(t)) {
    out.push({ ruleId: 'NAME_SPECIAL_CHARS', severity: 'ERROR', message: `Tên "${t}" chứa ký tự đặc biệt hoặc emoji.` });
  }
  // Tên chỉ toàn từ khoá chung, không có chủ thể: không có dấu ngăn "Chủ thể - Chức năng" và mọi từ đều là từ chung
  const GENERIC = /^(tra|cứu|quy|đổi|mã|bưu|chính|điện|zip|code|postal|việt|nam|toàn|quốc|online|mua|sắm|thời|trang|đặt|vé|xem|phim|giao|hàng|tin|tức|bán|lẻ|thanh|toán|giá|xăng|dầu|và|,)$/i;
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (!/\s[-–|:]\s/.test(t) && words.every((w) => GENERIC.test(w))) {
    out.push({
      ruleId: 'NAME_GENERIC_KEYWORD',
      severity: 'ERROR',
      message: `Tên "${t}" chỉ gồm từ khoá chung, thiếu chủ thể sở hữu (công thức: [Chủ thể] - [Chức năng]).`,
    });
  }
  return out;
}

// ─── Luật về code (Mục 4–8) ───

interface CodeRule {
  ruleId: string;
  category: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  /** Bỏ qua kết quả khớp nếu trả về true */
  ignore?: (match: RegExpExecArray, src: string) => boolean;
}

const CODE_RULES: CodeRule[] = [
  {
    ruleId: 'CONTENT_EXTERNAL_LINK',
    category: '4. Nội dung',
    severity: 'ERROR',
    pattern: /<a\b[^>]*\bhref\s*=\s*\{?\s*[`'"]((?:https?:)?\/\/[^`'"]+)[`'"][^>]*>/gi,
    message: 'Thẻ <a> trỏ ra website ngoài: người dùng bị đưa khỏi Mini App. Dùng openWebview của zmp-sdk hoặc nhúng nội dung.',
    ignore: (m) => ZALO_HOSTS.test(m[1]),
  },
  {
    ruleId: 'CONTENT_EXTERNAL_LINK',
    category: '4. Nội dung',
    severity: 'ERROR',
    pattern: /\bwindow\.open\s*\(/g,
    message: 'window.open mở trình duyệt ngoài. Dùng openWebview của zmp-sdk.',
  },
  {
    ruleId: 'CONTENT_EXTERNAL_LINK',
    category: '4. Nội dung',
    severity: 'ERROR',
    pattern: /\b(?:window\.)?location(?:\.href)?\s*=\s*[`'"]((?:https?:)?\/\/[^`'"]+)/g,
    message: 'Điều hướng thẳng sang website ngoài bằng location.href.',
    ignore: (m) => ZALO_HOSTS.test(m[1]),
  },
  {
    ruleId: 'CONTENT_OPEN_OUT_APP',
    category: '4. Nội dung',
    severity: 'WARNING',
    pattern: /\bopenOutApp\s*\(/g,
    message: 'openOutApp đưa người dùng ra khỏi Zalo; chỉ dùng khi thật cần và không vì mục đích kéo người dùng sang app khác.',
  },
  {
    ruleId: 'CONTENT_3RD_PARTY_LOGIN',
    category: '4. Nội dung',
    severity: 'ERROR',
    pattern: /(accounts\.google\.com|facebook\.com\/v\d|appleid\.apple\.com|signInWithPopup|GoogleAuthProvider|FacebookAuthProvider)/g,
    message: 'Đăng nhập bằng Google/Facebook/Apple bị cấm; dùng xác thực của Zalo.',
  },
  {
    ruleId: 'CONTENT_UNAUTHORIZED_ADS',
    category: '4. Nội dung',
    severity: 'ERROR',
    pattern: /(adsbygoogle|googlesyndication|doubleclick\.net|admob|adcolony|unityads)/gi,
    message: 'Mạng quảng cáo bên ngoài bị cấm trong Mini App.',
  },
  {
    ruleId: 'CONTENT_CASHOUT',
    category: '4. Nội dung',
    severity: 'ERROR',
    pattern: /(rút tiền|rut tien|trả thưởng|tra thuong|đổi thưởng tiền mặt|cash\s*out)/gi,
    message: 'Tính năng rút tiền / trả thưởng tiền mặt bị cấm.',
  },
  {
    ruleId: 'PERF_DEMO_CONTENT',
    category: '5. Hiệu suất',
    severity: 'WARNING',
    // \b không hiểu chữ có dấu ("đ"), nên chặn biên từ bằng lookaround Unicode
    pattern: /[`'">][^`'"<\n]*?(?<![\p{L}\p{N}])(demo|coming soon|lorem ipsum|đang phát triển|sắp ra mắt|dữ liệu mẫu|vị trí mẫu|dữ liệu giả|test data)(?![\p{L}\p{N}])[^`'"<\n]*/giu,
    message: 'Chữ hiển thị mang tính demo / dữ liệu mẫu: người duyệt từ chối tính năng "chưa hoàn thiện".',
  },
  {
    ruleId: 'SEC_EVAL',
    category: '7. Bảo mật',
    severity: 'ERROR',
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(/g,
    message: 'eval / new Function bị cấm.',
  },
  {
    ruleId: 'SEC_INSECURE_HTTP',
    category: '7. Bảo mật',
    severity: 'WARNING',
    pattern: /[`'"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])[^`'"\s]+/g,
    message: 'Kết nối HTTP không mã hoá; dùng HTTPS.',
  },
];

// Hàm xin quyền: gọi ngay khi mở app (useEffect chạy lúc mount) là vi phạm Mục 6
const PERMISSION_CALL = /\b(getPhoneNumber|getUserInfo|authorize|getLocation|requestCameraPermission|navigator\.geolocation\.(?:getCurrentPosition|watchPosition))\s*\(/;

function checkPermissionsOnLoad(src: string, rel: string): PolicyFinding[] {
  const out: PolicyFinding[] = [];
  const re = /\buseEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const body = blockFrom(src, m.index + m[0].length - 1);
    const after = src.slice(m.index + m[0].length - 1 + body.length, m.index + m[0].length - 1 + body.length + 40);
    // Chỉ effect chạy lúc mount: mảng phụ thuộc rỗng hoặc không có
    if (!/^\s*(,\s*\[\s*\]\s*)?\)/.test(after)) continue;
    const call = PERMISSION_CALL.exec(body);
    if (call) {
      out.push({
        ruleId: 'PERM_ON_LOAD',
        category: '6. Xin quyền',
        severity: 'ERROR',
        message: `Xin quyền (${call[1]}) ngay khi mở app. Chỉ xin khi người dùng bấm vào tính năng cần quyền.`,
        file: rel,
        line: lineOf(src, m.index + m[0].length - 1 + call.index),
      });
    }
  }
  return out;
}

// Mục 8: có nút mua / thanh toán mà không dùng Checkout SDK
function checkPayment(allSrc: string): PolicyFinding | null {
  const cta = /[`'">]\s*(mua ngay|đặt hàng|thanh toán ngay|thêm vào giỏ|checkout)\s*[`'"<]/i;
  const sdk = /\b(Payment\.createOrder|createOrder|purchase)\s*\(/;
  if (cta.test(allSrc) && !sdk.test(allSrc)) {
    return {
      ruleId: 'PAYMENT_NO_CHECKOUT_SDK',
      category: '8. Thanh toán',
      severity: 'ERROR',
      message: 'Có nút mua / thanh toán nhưng không dùng Checkout SDK của Zalo. Tích hợp Checkout SDK, hoặc đổi nút sang "Liên hệ".',
    };
  }
  return null;
}

function readTitle(file: string, kind: 'json' | 'html'): string | null {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  if (kind === 'html') return /<title>([^<]*)<\/title>/i.exec(raw)?.[1].trim() ?? null;
  try {
    return (JSON.parse(raw)?.app?.title ?? null) as string | null;
  } catch {
    return null;
  }
}

export function runPolicyAudit(projectDir: string): PolicyReport {
  const root = path.resolve(projectDir);
  const findings: PolicyFinding[] = [];
  const passed: string[] = [];

  // 1. Cấu hình và tên
  const configPath = path.join(root, 'app-config.json');
  let appTitle: string | null = null;
  if (!fs.existsSync(configPath)) {
    findings.push({ ruleId: 'CONFIG_MISSING', category: '2. Tên', severity: 'ERROR', message: 'Không có app-config.json.' });
  } else {
    appTitle = readTitle(configPath, 'json');
    if (appTitle === null) {
      findings.push({ ruleId: 'CONFIG_INVALID', category: '2. Tên', severity: 'ERROR', message: 'app-config.json lỗi JSON hoặc thiếu app.title.', file: 'app-config.json' });
    } else {
      const nameIssues = checkTitle(appTitle).map((f) => ({ ...f, category: '2. Tên', file: 'app-config.json' }));
      findings.push(...nameIssues);
      if (!nameIssues.length) passed.push(`Tên "${appTitle}" đạt các luật tự động (viết hoa, từ cấm, ký tự đặc biệt, chủ thể).`);

      // Cùng một tên ở mọi nơi người dùng và người duyệt nhìn thấy
      const others: Array<[string, string | null]> = [
        ['app.json', readTitle(path.join(root, 'app.json'), 'json')],
        ['index.html <title>', readTitle(path.join(root, 'index.html'), 'html')],
      ];
      const mismatched = others.filter(([, v]) => v !== null && v.trim() !== appTitle!.trim());
      if (mismatched.length) {
        findings.push({
          ruleId: 'NAME_INCONSISTENT',
          category: '2. Tên',
          severity: 'WARNING',
          message: `Tên không thống nhất: app-config.json "${appTitle}" ≠ ${mismatched.map(([k, v]) => `${k} "${v}"`).join(', ')}.`,
        });
      } else passed.push('Tên thống nhất giữa app-config.json, app.json và index.html.');
    }
  }

  // 2. Code
  const files = listFiles(path.join(root, 'src'));
  const indexHtml = path.join(root, 'index.html');
  if (fs.existsSync(indexHtml)) files.push(indexHtml);

  let allSrc = '';
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    allSrc += '\n' + src;

    for (const rule of CODE_RULES) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(src))) {
        if (rule.ignore?.(m, src)) continue;
        const line = lineOf(src, m.index);
        findings.push({
          ruleId: rule.ruleId,
          category: rule.category,
          severity: rule.severity,
          message: rule.message,
          file: rel,
          line,
          snippet: src.split('\n')[line - 1].trim().slice(0, 140),
        });
      }
    }
    findings.push(...checkPermissionsOnLoad(src, rel));
  }

  const payment = checkPayment(allSrc);
  if (payment) findings.push(payment);

  const hit = (id: string) => findings.some((f) => f.ruleId === id);
  const codeChecks: Array<[string, string]> = [
    ['CONTENT_EXTERNAL_LINK', 'Không điều hướng ra website ngoài.'],
    ['CONTENT_3RD_PARTY_LOGIN', 'Không đăng nhập Google/Facebook/Apple.'],
    ['CONTENT_UNAUTHORIZED_ADS', 'Không có mạng quảng cáo ngoài.'],
    ['CONTENT_CASHOUT', 'Không có rút tiền / trả thưởng.'],
    ['PERF_DEMO_CONTENT', 'Không có chữ demo / dữ liệu mẫu.'],
    ['PERM_ON_LOAD', 'Không xin quyền ngay khi mở app.'],
    ['SEC_EVAL', 'Không dùng eval.'],
    ['SEC_INSECURE_HTTP', 'Không có kết nối HTTP không mã hoá.'],
    ['PAYMENT_NO_CHECKOUT_SDK', 'Không có nút mua thiếu Checkout SDK.'],
  ];
  for (const [id, label] of codeChecks) if (!hit(id)) passed.push(label);

  const errors = findings.filter((f) => f.severity === 'ERROR').length;
  const warnings = findings.length - errors;
  const verdict = errors
    ? `Có ${errors} vi phạm cần sửa trước khi gửi duyệt.`
    : warnings
      ? `Không có vi phạm chắc chắn; còn ${warnings} cảnh báo cần xem và ${MANUAL_CHECKS.length} mục kiểm tay.`
      : `Không phát hiện vi phạm tự động; còn ${MANUAL_CHECKS.length} mục phải kiểm tay trước khi gửi duyệt.`;

  return {
    projectDir: root,
    appTitle,
    summary: { errors, warnings, filesScanned: files.length },
    findings,
    passed,
    manualChecks: MANUAL_CHECKS,
    verdict,
  };
}

/** Báo cáo dạng chữ cho terminal */
export function formatPolicyReport(r: PolicyReport, color = true): string {
  const c = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines = [c('1;36', 'ZMP POLICY AUDIT — Chính sách kiểm duyệt Zalo Mini App'), `Dự án: ${r.projectDir}`, `Tên app: ${r.appTitle ?? '(không đọc được)'}`, ''];
  for (const p of r.passed) lines.push(`${c('32', '✔')} ${p}`);
  if (r.findings.length) lines.push('');
  for (const f of r.findings) {
    const tag = f.severity === 'ERROR' ? c('31', '✖ VI PHẠM') : c('33', '▲ CẢNH BÁO');
    const loc = f.file ? c('2', ` (${f.file}${f.line ? `:${f.line}` : ''})`) : '';
    lines.push(`${tag} [${f.ruleId}] ${f.message}${loc}`);
    if (f.snippet) lines.push(c('2', `    ${f.snippet}`));
  }
  lines.push('', c('1', 'Cần kiểm tay:'));
  for (const m of r.manualChecks) lines.push(`  ☐ ${m}`);
  lines.push('', c(r.summary.errors ? '1;31' : '1;32', r.verdict));
  return lines.join('\n');
}
