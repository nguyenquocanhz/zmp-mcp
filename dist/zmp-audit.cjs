#!/usr/bin/env node
// Sinh tự động từ zmp-mcp (src/policy). Đừng sửa tay: sửa trong zmp-mcp rồi build lại.
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/policy/engine.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var CODE_EXT = /\.(jsx?|tsx?|vue|svelte|html)$/i;
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "www", "build", ".git", ".zmp", "coverage"]);
var MAX_FILE_BYTES = 1024 * 1024;
var ZALO_HOSTS = /^(https?:)?\/\/([a-z0-9-]+\.)*(zalo\.me|zaloapp\.com|zalo\.vn|zdn\.vn|zaloplatforms\.com)(\/|$)/i;
var MANUAL_CHECKS = [
  "Logo: n\u1EC1n m\xE0u \u0111\u1EB7c (kh\xF4ng trong su\u1ED1t), kh\xF4ng ch\u1EE9a S\u0110T hay QR, kh\xF4ng d\xF9ng logo th\u01B0\u01A1ng hi\u1EC7u kh\xE1c.",
  "T\xEAn tr\xEAn trang qu\u1EA3n l\xFD Mini App kh\u1EDBp t\xEAn trong app-config.json.",
  "M\xF4 t\u1EA3 tr\xEAn trang qu\u1EA3n l\xFD: kh\xF4ng \u0111\u1EC3 tr\u1ED1ng, kh\xF4ng ch\u1EE9a link, \u0111\xFAng ch\u1EE9c n\u0103ng.",
  "M\u1ECDi n\xFAt b\u1EA5m ho\u1EA1t \u0111\u1ED9ng th\u1EADt, kh\xF4ng m\xE0n h\xECnh tr\u1EAFng, t\u1EA3i d\u01B0\u1EDBi 10 gi\xE2y.",
  "D\u1EEF li\u1EC7u hi\u1EC3n th\u1ECB l\xE0 th\u1EADt (\u0111\u1ECBa ch\u1EC9, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i, gi\xE1), kh\xF4ng ph\u1EA3i d\u1EEF li\u1EC7u b\u1ECBa.",
  "Ng\xE0nh \u0111\u1EB7c th\xF9 (d\u01B0\u1EE3c, m\u1EF9 ph\u1EA9m, t\xE0i ch\xEDnh) c\xF3 gi\u1EA5y ph\xE9p; chi\u1EBFn d\u1ECBch c\xF3 ng\xE0y k\u1EBFt th\xFAc."
];
function listFiles(dir, out = []) {
  if (!import_fs.default.existsSync(dir)) return out;
  for (const entry of import_fs.default.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) listFiles(import_path.default.join(dir, entry.name), out);
    } else if (CODE_EXT.test(entry.name)) {
      const full = import_path.default.join(dir, entry.name);
      if (import_fs.default.statSync(full).size <= MAX_FILE_BYTES) out.push(full);
    }
  }
  return out;
}
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
}
function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}
function blockFrom(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}
function checkTitle(title) {
  const out = [];
  const t = title.trim();
  if (!t) {
    out.push({ ruleId: "NAME_EMPTY", severity: "ERROR", message: "T\xEAn Mini App (app.title) \u0111ang \u0111\u1EC3 tr\u1ED1ng." });
    return out;
  }
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length > 3 && letters === letters.toLocaleUpperCase("vi")) {
    out.push({ ruleId: "NAME_ALL_CAPS", severity: "ERROR", message: `T\xEAn "${t}" vi\u1EBFt hoa to\xE0n b\u1ED9.` });
  }
  if (/\bzalo\b/i.test(t) || /mini\s*-?\s*app/i.test(t)) {
    out.push({ ruleId: "NAME_BANNED_WORDS", severity: "ERROR", message: `T\xEAn "${t}" ch\u1EE9a t\u1EEB c\u1EA5m "Zalo" ho\u1EB7c "Mini App".` });
  } else if (/\bapps?\b/i.test(t)) {
    out.push({ ruleId: "NAME_BANNED_WORDS", severity: "ERROR", message: `T\xEAn "${t}" ch\u1EE9a t\u1EEB c\u1EA5m "App".` });
  } else if (/app\b/i.test(t)) {
    out.push({
      ruleId: "NAME_BANNED_WORDS",
      severity: "WARNING",
      message: `T\xEAn "${t}" c\xF3 ch\u1EEF "App" d\xEDnh trong th\u01B0\u01A1ng hi\u1EC7u; ng\u01B0\u1EDDi duy\u1EC7t c\xF3 th\u1EC3 coi l\xE0 ch\u1EE9a t\u1EEB c\u1EA5m "App".`
    });
  }
  if (/[#$@!~%^&*+=<>?\\|{}[\]]/.test(t) || new RegExp("\\p{Extended_Pictographic}", "u").test(t)) {
    out.push({ ruleId: "NAME_SPECIAL_CHARS", severity: "ERROR", message: `T\xEAn "${t}" ch\u1EE9a k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t ho\u1EB7c emoji.` });
  }
  const GENERIC = /^(tra|cứu|quy|đổi|mã|bưu|chính|điện|zip|code|postal|việt|nam|toàn|quốc|online|mua|sắm|thời|trang|đặt|vé|xem|phim|giao|hàng|tin|tức|bán|lẻ|thanh|toán|giá|xăng|dầu|và|,)$/i;
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (!/\s[-–|:]\s/.test(t) && words.every((w) => GENERIC.test(w))) {
    out.push({
      ruleId: "NAME_GENERIC_KEYWORD",
      severity: "ERROR",
      message: `T\xEAn "${t}" ch\u1EC9 g\u1ED3m t\u1EEB kho\xE1 chung, thi\u1EBFu ch\u1EE7 th\u1EC3 s\u1EDF h\u1EEFu (c\xF4ng th\u1EE9c: [Ch\u1EE7 th\u1EC3] - [Ch\u1EE9c n\u0103ng]).`
    });
  }
  return out;
}
var CODE_RULES = [
  {
    ruleId: "CONTENT_EXTERNAL_LINK",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /<a\b[^>]*\bhref\s*=\s*\{?\s*[`'"]((?:https?:)?\/\/[^`'"]+)[`'"][^>]*>/gi,
    message: "Th\u1EBB <a> tr\u1ECF ra website ngo\xE0i: ng\u01B0\u1EDDi d\xF9ng b\u1ECB \u0111\u01B0a kh\u1ECFi Mini App. D\xF9ng openWebview c\u1EE7a zmp-sdk ho\u1EB7c nh\xFAng n\u1ED9i dung.",
    ignore: (m) => ZALO_HOSTS.test(m[1])
  },
  {
    ruleId: "CONTENT_EXTERNAL_LINK",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /\bwindow\.open\s*\(/g,
    message: "window.open m\u1EDF tr\xECnh duy\u1EC7t ngo\xE0i. D\xF9ng openWebview c\u1EE7a zmp-sdk."
  },
  {
    ruleId: "CONTENT_EXTERNAL_LINK",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /\b(?:window\.)?location(?:\.href)?\s*=\s*[`'"]((?:https?:)?\/\/[^`'"]+)/g,
    message: "\u0110i\u1EC1u h\u01B0\u1EDBng th\u1EB3ng sang website ngo\xE0i b\u1EB1ng location.href.",
    ignore: (m) => ZALO_HOSTS.test(m[1])
  },
  {
    ruleId: "CONTENT_OPEN_OUT_APP",
    category: "4. N\u1ED9i dung",
    severity: "WARNING",
    pattern: /\bopenOutApp\s*\(/g,
    message: "openOutApp \u0111\u01B0a ng\u01B0\u1EDDi d\xF9ng ra kh\u1ECFi Zalo; ch\u1EC9 d\xF9ng khi th\u1EADt c\u1EA7n v\xE0 kh\xF4ng v\xEC m\u1EE5c \u0111\xEDch k\xE9o ng\u01B0\u1EDDi d\xF9ng sang app kh\xE1c."
  },
  {
    ruleId: "CONTENT_3RD_PARTY_LOGIN",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /(accounts\.google\.com|facebook\.com\/v\d|appleid\.apple\.com|signInWithPopup|GoogleAuthProvider|FacebookAuthProvider)/g,
    message: "\u0110\u0103ng nh\u1EADp b\u1EB1ng Google/Facebook/Apple b\u1ECB c\u1EA5m; d\xF9ng x\xE1c th\u1EF1c c\u1EE7a Zalo."
  },
  {
    ruleId: "CONTENT_UNAUTHORIZED_ADS",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /(adsbygoogle|googlesyndication|doubleclick\.net|admob|adcolony|unityads)/gi,
    message: "M\u1EA1ng qu\u1EA3ng c\xE1o b\xEAn ngo\xE0i b\u1ECB c\u1EA5m trong Mini App."
  },
  {
    ruleId: "CONTENT_CASHOUT",
    category: "4. N\u1ED9i dung",
    severity: "ERROR",
    pattern: /(rút tiền|rut tien|trả thưởng|tra thuong|đổi thưởng tiền mặt|cash\s*out)/gi,
    message: "T\xEDnh n\u0103ng r\xFAt ti\u1EC1n / tr\u1EA3 th\u01B0\u1EDFng ti\u1EC1n m\u1EB7t b\u1ECB c\u1EA5m."
  },
  {
    ruleId: "PERF_DEMO_CONTENT",
    category: "5. Hi\u1EC7u su\u1EA5t",
    severity: "WARNING",
    // \b không hiểu chữ có dấu ("đ"), nên chặn biên từ bằng lookaround Unicode
    pattern: /[`'">][^`'"<\n]*?(?<![\p{L}\p{N}])(demo|coming soon|lorem ipsum|đang phát triển|sắp ra mắt|dữ liệu mẫu|vị trí mẫu|dữ liệu giả|test data)(?![\p{L}\p{N}])[^`'"<\n]*/giu,
    message: 'Ch\u1EEF hi\u1EC3n th\u1ECB mang t\xEDnh demo / d\u1EEF li\u1EC7u m\u1EABu: ng\u01B0\u1EDDi duy\u1EC7t t\u1EEB ch\u1ED1i t\xEDnh n\u0103ng "ch\u01B0a ho\xE0n thi\u1EC7n".'
  },
  {
    ruleId: "SEC_EVAL",
    category: "7. B\u1EA3o m\u1EADt",
    severity: "ERROR",
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(/g,
    message: "eval / new Function b\u1ECB c\u1EA5m."
  },
  {
    ruleId: "SEC_INSECURE_HTTP",
    category: "7. B\u1EA3o m\u1EADt",
    severity: "WARNING",
    pattern: /[`'"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])[^`'"\s]+/g,
    message: "K\u1EBFt n\u1ED1i HTTP kh\xF4ng m\xE3 ho\xE1; d\xF9ng HTTPS."
  }
];
var PERMISSION_CALL = /\b(getPhoneNumber|getUserInfo|authorize|getLocation|requestCameraPermission|navigator\.geolocation\.(?:getCurrentPosition|watchPosition))\s*\(/;
function checkPermissionsOnLoad(src, rel) {
  const out = [];
  const re = /\buseEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  let m;
  while (m = re.exec(src)) {
    const body = blockFrom(src, m.index + m[0].length - 1);
    const after = src.slice(m.index + m[0].length - 1 + body.length, m.index + m[0].length - 1 + body.length + 40);
    if (!/^\s*(,\s*\[\s*\]\s*)?\)/.test(after)) continue;
    const call = PERMISSION_CALL.exec(body);
    if (call) {
      out.push({
        ruleId: "PERM_ON_LOAD",
        category: "6. Xin quy\u1EC1n",
        severity: "ERROR",
        message: `Xin quy\u1EC1n (${call[1]}) ngay khi m\u1EDF app. Ch\u1EC9 xin khi ng\u01B0\u1EDDi d\xF9ng b\u1EA5m v\xE0o t\xEDnh n\u0103ng c\u1EA7n quy\u1EC1n.`,
        file: rel,
        line: lineOf(src, m.index + m[0].length - 1 + call.index)
      });
    }
  }
  return out;
}
function checkPayment(allSrc) {
  const cta = /[`'">]\s*(mua ngay|đặt hàng|thanh toán ngay|thêm vào giỏ|checkout)\s*[`'"<]/i;
  const sdk = /\b(Payment\.createOrder|createOrder|purchase)\s*\(/;
  if (cta.test(allSrc) && !sdk.test(allSrc)) {
    return {
      ruleId: "PAYMENT_NO_CHECKOUT_SDK",
      category: "8. Thanh to\xE1n",
      severity: "ERROR",
      message: 'C\xF3 n\xFAt mua / thanh to\xE1n nh\u01B0ng kh\xF4ng d\xF9ng Checkout SDK c\u1EE7a Zalo. T\xEDch h\u1EE3p Checkout SDK, ho\u1EB7c \u0111\u1ED5i n\xFAt sang "Li\xEAn h\u1EC7".'
    };
  }
  return null;
}
function readTitle(file, kind) {
  if (!import_fs.default.existsSync(file)) return null;
  const raw = import_fs.default.readFileSync(file, "utf8");
  if (kind === "html") return /<title>([^<]*)<\/title>/i.exec(raw)?.[1].trim() ?? null;
  try {
    return JSON.parse(raw)?.app?.title ?? null;
  } catch {
    return null;
  }
}
function runPolicyAudit(projectDir) {
  const root = import_path.default.resolve(projectDir);
  const findings = [];
  const passed = [];
  const configPath = import_path.default.join(root, "app-config.json");
  let appTitle = null;
  if (!import_fs.default.existsSync(configPath)) {
    findings.push({ ruleId: "CONFIG_MISSING", category: "2. T\xEAn", severity: "ERROR", message: "Kh\xF4ng c\xF3 app-config.json." });
  } else {
    appTitle = readTitle(configPath, "json");
    if (appTitle === null) {
      findings.push({ ruleId: "CONFIG_INVALID", category: "2. T\xEAn", severity: "ERROR", message: "app-config.json l\u1ED7i JSON ho\u1EB7c thi\u1EBFu app.title.", file: "app-config.json" });
    } else {
      const nameIssues = checkTitle(appTitle).map((f) => ({ ...f, category: "2. T\xEAn", file: "app-config.json" }));
      findings.push(...nameIssues);
      if (!nameIssues.length) passed.push(`T\xEAn "${appTitle}" \u0111\u1EA1t c\xE1c lu\u1EADt t\u1EF1 \u0111\u1ED9ng (vi\u1EBFt hoa, t\u1EEB c\u1EA5m, k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t, ch\u1EE7 th\u1EC3).`);
      const others = [
        ["app.json", readTitle(import_path.default.join(root, "app.json"), "json")],
        ["index.html <title>", readTitle(import_path.default.join(root, "index.html"), "html")]
      ];
      const mismatched = others.filter(([, v]) => v !== null && v.trim() !== appTitle.trim());
      if (mismatched.length) {
        findings.push({
          ruleId: "NAME_INCONSISTENT",
          category: "2. T\xEAn",
          severity: "WARNING",
          message: `T\xEAn kh\xF4ng th\u1ED1ng nh\u1EA5t: app-config.json "${appTitle}" \u2260 ${mismatched.map(([k, v]) => `${k} "${v}"`).join(", ")}.`
        });
      } else passed.push("T\xEAn th\u1ED1ng nh\u1EA5t gi\u1EEFa app-config.json, app.json v\xE0 index.html.");
    }
  }
  const files = listFiles(import_path.default.join(root, "src"));
  const indexHtml = import_path.default.join(root, "index.html");
  if (import_fs.default.existsSync(indexHtml)) files.push(indexHtml);
  let allSrc = "";
  for (const file of files) {
    const rel = import_path.default.relative(root, file).replace(/\\/g, "/");
    const src = stripComments(import_fs.default.readFileSync(file, "utf8"));
    allSrc += "\n" + src;
    for (const rule of CODE_RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      while (m = rule.pattern.exec(src)) {
        if (rule.ignore?.(m, src)) continue;
        const line = lineOf(src, m.index);
        findings.push({
          ruleId: rule.ruleId,
          category: rule.category,
          severity: rule.severity,
          message: rule.message,
          file: rel,
          line,
          snippet: src.split("\n")[line - 1].trim().slice(0, 140)
        });
      }
    }
    findings.push(...checkPermissionsOnLoad(src, rel));
  }
  const payment = checkPayment(allSrc);
  if (payment) findings.push(payment);
  const hit = (id) => findings.some((f) => f.ruleId === id);
  const codeChecks = [
    ["CONTENT_EXTERNAL_LINK", "Kh\xF4ng \u0111i\u1EC1u h\u01B0\u1EDBng ra website ngo\xE0i."],
    ["CONTENT_3RD_PARTY_LOGIN", "Kh\xF4ng \u0111\u0103ng nh\u1EADp Google/Facebook/Apple."],
    ["CONTENT_UNAUTHORIZED_ADS", "Kh\xF4ng c\xF3 m\u1EA1ng qu\u1EA3ng c\xE1o ngo\xE0i."],
    ["CONTENT_CASHOUT", "Kh\xF4ng c\xF3 r\xFAt ti\u1EC1n / tr\u1EA3 th\u01B0\u1EDFng."],
    ["PERF_DEMO_CONTENT", "Kh\xF4ng c\xF3 ch\u1EEF demo / d\u1EEF li\u1EC7u m\u1EABu."],
    ["PERM_ON_LOAD", "Kh\xF4ng xin quy\u1EC1n ngay khi m\u1EDF app."],
    ["SEC_EVAL", "Kh\xF4ng d\xF9ng eval."],
    ["SEC_INSECURE_HTTP", "Kh\xF4ng c\xF3 k\u1EBFt n\u1ED1i HTTP kh\xF4ng m\xE3 ho\xE1."],
    ["PAYMENT_NO_CHECKOUT_SDK", "Kh\xF4ng c\xF3 n\xFAt mua thi\u1EBFu Checkout SDK."]
  ];
  for (const [id, label] of codeChecks) if (!hit(id)) passed.push(label);
  const errors = findings.filter((f) => f.severity === "ERROR").length;
  const warnings = findings.length - errors;
  const verdict = errors ? `C\xF3 ${errors} vi ph\u1EA1m c\u1EA7n s\u1EEDa tr\u01B0\u1EDBc khi g\u1EEDi duy\u1EC7t.` : warnings ? `Kh\xF4ng c\xF3 vi ph\u1EA1m ch\u1EAFc ch\u1EAFn; c\xF2n ${warnings} c\u1EA3nh b\xE1o c\u1EA7n xem v\xE0 ${MANUAL_CHECKS.length} m\u1EE5c ki\u1EC3m tay.` : `Kh\xF4ng ph\xE1t hi\u1EC7n vi ph\u1EA1m t\u1EF1 \u0111\u1ED9ng; c\xF2n ${MANUAL_CHECKS.length} m\u1EE5c ph\u1EA3i ki\u1EC3m tay tr\u01B0\u1EDBc khi g\u1EEDi duy\u1EC7t.`;
  return {
    projectDir: root,
    appTitle,
    summary: { errors, warnings, filesScanned: files.length },
    findings,
    passed,
    manualChecks: MANUAL_CHECKS,
    verdict
  };
}
function formatPolicyReport(r, color = true) {
  const c = (code, s) => color ? `\x1B[${code}m${s}\x1B[0m` : s;
  const lines = [c("1;36", "ZMP POLICY AUDIT \u2014 Ch\xEDnh s\xE1ch ki\u1EC3m duy\u1EC7t Zalo Mini App"), `D\u1EF1 \xE1n: ${r.projectDir}`, `T\xEAn app: ${r.appTitle ?? "(kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c)"}`, ""];
  for (const p of r.passed) lines.push(`${c("32", "\u2714")} ${p}`);
  if (r.findings.length) lines.push("");
  for (const f of r.findings) {
    const tag = f.severity === "ERROR" ? c("31", "\u2716 VI PH\u1EA0M") : c("33", "\u25B2 C\u1EA2NH B\xC1O");
    const loc = f.file ? c("2", ` (${f.file}${f.line ? `:${f.line}` : ""})`) : "";
    lines.push(`${tag} [${f.ruleId}] ${f.message}${loc}`);
    if (f.snippet) lines.push(c("2", `    ${f.snippet}`));
  }
  lines.push("", c("1", "C\u1EA7n ki\u1EC3m tay:"));
  for (const m of r.manualChecks) lines.push(`  \u2610 ${m}`);
  lines.push("", c(r.summary.errors ? "1;31" : "1;32", r.verdict));
  return lines.join("\n");
}

// src/policy/cli.ts
function runPolicyCli(argv) {
  const json = argv.includes("--json");
  const dir = argv.find((a) => !a.startsWith("--")) || process.cwd();
  const report = runPolicyAudit(dir);
  console.log(json ? JSON.stringify(report, null, 2) : formatPolicyReport(report, process.stdout.isTTY));
  return report.summary.errors ? 1 : 0;
}

// src/policy/standalone.ts
process.exitCode = runPolicyCli(process.argv.slice(2));
