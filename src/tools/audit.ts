import fs from 'fs';
import path from 'path';
import axios from 'axios';

export interface AuditFinding {
  owaspCategory: string; // e.g. "A05:2021 - Security Misconfiguration"
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description: string;
  location?: string;
  recommendation: string;
}

export interface AuditReport {
  timestamp: string;
  target: {
    url?: string;
    projectDir?: string;
  };
  securityScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  findings: AuditFinding[];
  owaspCompliance: Record<string, { status: 'PASS' | 'WARNING' | 'FAIL'; count: number }>;
}

/**
 * 1. Web Endpoint Security Audit (Headers, TLS, CORS, Info Disclosure)
 */
async function auditWebEndpoint(targetUrl: string, findings: AuditFinding[]): Promise<void> {
  const urlObj = new URL(targetUrl);

  // A02: Cryptographic Failures - Protocol Check
  if (urlObj.protocol !== 'https:') {
    findings.push({
      owaspCategory: 'A02:2021 - Cryptographic Failures',
      title: 'Insecure Transport Protocol (HTTP)',
      severity: 'CRITICAL',
      description: `Target endpoint uses unencrypted HTTP protocol (${targetUrl}). Webhook payloads and user data can be intercepted.`,
      location: targetUrl,
      recommendation: 'Enforce HTTPS for all production APIs and Mini App endpoints. Obtain a valid TLS/SSL certificate.',
    });
  }

  try {
    const res = await axios.get(targetUrl, {
      validateStatus: () => true,
      timeout: 10000,
      headers: {
        'User-Agent': 'zmp-mcp-security-audit/1.0',
      },
    });

    const headers = res.headers;

    // A05: Security Misconfiguration - Security Headers
    if (!headers['strict-transport-security'] && urlObj.protocol === 'https:') {
      findings.push({
        owaspCategory: 'A05:2021 - Security Misconfiguration',
        title: 'Missing HSTS (Strict-Transport-Security) Header',
        severity: 'MEDIUM',
        description: 'Server does not advertise HSTS header. Browsers may be susceptible to SSL-stripping man-in-the-middle attacks.',
        location: targetUrl,
        recommendation: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
      });
    }

    if (!headers['x-content-type-options']) {
      findings.push({
        owaspCategory: 'A05:2021 - Security Misconfiguration',
        title: 'Missing X-Content-Type-Options Header',
        severity: 'LOW',
        description: 'Missing "X-Content-Type-Options: nosniff". Browsers may attempt to MIME-sniff response content, opening XSS risks.',
        location: targetUrl,
        recommendation: 'Configure server to return "X-Content-Type-Options: nosniff".',
      });
    }

    if (!headers['x-frame-options'] && !headers['content-security-policy']) {
      findings.push({
        owaspCategory: 'A05:2021 - Security Misconfiguration',
        title: 'Missing Clickjacking Protection (X-Frame-Options / CSP)',
        severity: 'MEDIUM',
        description: 'Missing X-Frame-Options or Content-Security-Policy with frame-ancestors. Endpoint could be framed for clickjacking.',
        location: targetUrl,
        recommendation: 'Add "X-Frame-Options: DENY" (or SAMEORIGIN) or CSP "frame-ancestors \'none\'".',
      });
    }

    // A05: Technology Stack Disclosure
    const serverHeader = (headers['server'] as string) || '';
    const poweredBy = (headers['x-powered-by'] as string) || '';
    if (serverHeader.match(/(apache\/\d|nginx\/\d|php\/\d|express)/i) || poweredBy) {
      findings.push({
        owaspCategory: 'A05:2021 - Security Misconfiguration',
        title: 'Detailed Server Version / Banner Disclosure',
        severity: 'LOW',
        description: `Server leaks specific software versions (${serverHeader || poweredBy}). Facilitates attacker fingerprinting.`,
        location: 'HTTP Response Headers',
        recommendation: 'Disable Server banner tokens and remove X-Powered-By header.',
      });
    }

    // A01: Broken Access Control - Overly Permissive CORS
    const corsOrigin = headers['access-control-allow-origin'] as string;
    const corsCreds = headers['access-control-allow-credentials'] as string;
    if (corsOrigin === '*' && corsCreds === 'true') {
      findings.push({
        owaspCategory: 'A01:2021 - Broken Access Control',
        title: 'Critical CORS Misconfiguration (Wildcard with Credentials)',
        severity: 'CRITICAL',
        description: 'Access-Control-Allow-Origin is set to wildcard "*" while Access-Control-Allow-Credentials is true.',
        location: 'CORS Headers',
        recommendation: 'Explicitly specify trusted origins instead of wildcard "*" when credentials are permitted.',
      });
    } else if (corsOrigin === '*') {
      findings.push({
        owaspCategory: 'A01:2021 - Broken Access Control',
        title: 'Wildcard CORS Origin Policy',
        severity: 'INFO',
        description: 'Access-Control-Allow-Origin: * allows any web origin to read responses.',
        location: 'CORS Headers',
        recommendation: 'If this API handles private user data, restrict CORS to authorized domains only.',
      });
    }

    // A09: Security Logging & Error Handling
    if (res.status === 500) {
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (dataStr.includes('Stack trace') || dataStr.includes('Exception') || dataStr.includes('SQLSTATE')) {
        findings.push({
          owaspCategory: 'A09:2021 - Security Logging and Monitoring Failures',
          title: 'Detailed Exception / Stack Trace Exposure on 500 Error',
          severity: 'HIGH',
          description: 'Server returned raw stack trace or database error message to client.',
          location: targetUrl,
          recommendation: 'Sanitize error outputs in production. Log full traces internally and return generic error envelopes.',
        });
      }
    }
  } catch (err: any) {
    findings.push({
      owaspCategory: 'A05:2021 - Security Misconfiguration',
      title: 'Endpoint Unreachable or Connection Refused',
      severity: 'HIGH',
      description: `Failed to connect to ${targetUrl}: ${err.message}`,
      location: targetUrl,
      recommendation: 'Verify server is running, firewall ports are open, and DNS resolves properly.',
    });
  }
}

/**
 * 2. Source Code & Configuration Audit (Static Analysis)
 */
function auditProjectSource(projectDir: string, findings: AuditFinding[]): void {
  if (!fs.existsSync(projectDir)) {
    findings.push({
      owaspCategory: 'A05:2021 - Security Misconfiguration',
      title: 'Project Directory Not Found',
      severity: 'HIGH',
      description: `Directory does not exist: ${projectDir}`,
      recommendation: 'Provide a valid project directory path.',
    });
    return;
  }

  // 1. Check for committed sensitive files
  const sensitiveFiles = ['.env', '.env.local', 'id_rsa', 'private.key', 'credentials.json'];
  for (const sFile of sensitiveFiles) {
    const sPath = path.join(projectDir, sFile);
    if (fs.existsSync(sPath)) {
      // Check if git tracks it
      const gitIgnorePath = path.join(projectDir, '.gitignore');
      const gitIgnoreContent = fs.existsSync(gitIgnorePath) ? fs.readFileSync(gitIgnorePath, 'utf8') : '';
      if (!gitIgnoreContent.includes(sFile)) {
        findings.push({
          owaspCategory: 'A07:2021 - Identification and Authentication Failures',
          title: `Sensitive Environment File Not in .gitignore (${sFile})`,
          severity: 'HIGH',
          description: `Found ${sFile} in project directory, but it is not explicitly listed in .gitignore. Risk of accidental credential commit.`,
          location: sPath,
          recommendation: `Add "${sFile}" to .gitignore immediately and revoke any committed keys.`,
        });
      }
    }
  }

  // 2. Scan source code files recursively (max depth 5, skip node_modules, dist, .git)
  function scanDir(dir: string, depth: number = 0) {
    if (depth > 6) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (['node_modules', 'dist', 'build', 'www', '.git'].includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(jsx?|tsx?|php|json|html)$/i.test(entry.name)) {
        auditFileContent(fullPath, findings);
      }
    }
  }

  scanDir(projectDir);
}

function auditFileContent(filePath: string, findings: AuditFinding[]): void {
  const relPath = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // A07: Hardcoded Secrets / Tokens
  const secretPatterns = [
    { regex: /AIzaSy[0-9A-Za-z_-]{33}/g, name: 'Google API Key' },
    { regex: /sk_live_[0-9a-zA-Z]{24}/g, name: 'Stripe Secret Key' },
    { regex: /(bearer\s+eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/gi, name: 'Hardcoded JWT Access Token' },
    { regex: /(apiKey|api_secret|oaSecretKey|secretKey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi, name: 'Hardcoded Secret / API Key' },
  ];

  for (const { regex, name } of secretPatterns) {
    if (regex.test(content) && !filePath.includes('.example.') && !filePath.includes('test')) {
      findings.push({
        owaspCategory: 'A07:2021 - Identification and Authentication Failures',
        title: `Hardcoded Credential Detected: ${name}`,
        severity: 'CRITICAL',
        description: `Found potential hardcoded credential (${name}) directly in source code.`,
        location: relPath,
        recommendation: 'Extract secrets to environment variables (.env) and never hardcode credentials in code.',
      });
    }
  }

  // A03: Injection & XSS (React / Frontend)
  if (/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g.test(content)) {
    findings.push({
      owaspCategory: 'A03:2021 - Injection',
      title: 'Dangerous Inner HTML Injection (XSS Vulnerability)',
      severity: 'HIGH',
      description: 'Found usage of "dangerouslySetInnerHTML". Unsanitized dynamic user input passed here can execute malicious scripts.',
      location: relPath,
      recommendation: 'Sanitize HTML input using DOMPurify before rendering, or prefer safe React text children.',
    });
  }

  if (/\beval\s*\(/.test(content)) {
    findings.push({
      owaspCategory: 'A03:2021 - Injection',
      title: 'Usage of eval() Execution Sink',
      severity: 'CRITICAL',
      description: 'Found call to eval(). Arbitrary JavaScript execution risk.',
      location: relPath,
      recommendation: 'Refactor code to avoid eval(). Use JSON.parse() for data serialization.',
    });
  }

  // A02: Insecure HTTP links in source code
  const insecureHttpMatches = content.match(/http:\/\/(?!(localhost|127\.0\.0\.1|0\.0\.0\.0))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (insecureHttpMatches && insecureHttpMatches.length > 0 && !filePath.includes('test')) {
    findings.push({
      owaspCategory: 'A02:2021 - Cryptographic Failures',
      title: 'Plaintext HTTP Request URL in Codebase',
      severity: 'MEDIUM',
      description: `Found plaintext HTTP URLs (${insecureHttpMatches.slice(0, 3).join(', ')}). Insecure transport can cause mixed-content blocking.`,
      location: relPath,
      recommendation: 'Upgrade all external resource and API URLs to HTTPS.',
    });
  }

  // A08: Software & Data Integrity Failures - Missing Webhook Signature
  if (content.includes('x-zevent-signature') && content.includes('verify') === false && filePath.includes('webhook')) {
    findings.push({
      owaspCategory: 'A08:2021 - Software and Data Integrity Failures',
      title: 'Unverified Webhook Signature',
      severity: 'HIGH',
      description: 'Webhook code references x-zevent-signature but does not appear to perform constant-time cryptographic verification.',
      location: relPath,
      recommendation: 'Verify incoming webhook signatures using sha256(content + apiKey) and constant-time string comparison.',
    });
  }
}

/**
 * Main OWASP Top 10 Audit Runner
 */
export async function runOwaspAudit(params: {
  url?: string;
  projectDir?: string;
}): Promise<AuditReport> {
  const findings: AuditFinding[] = [];

  // 1. Audit web endpoint if provided
  if (params.url) {
    await auditWebEndpoint(params.url, findings);
  }

  // 2. Audit local project if provided
  if (params.projectDir) {
    auditProjectSource(params.projectDir, findings);
  }

  // Calculate score
  let score = 100;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;

  const owaspCategories = [
    'A01:2021 - Broken Access Control',
    'A02:2021 - Cryptographic Failures',
    'A03:2021 - Injection',
    'A04:2021 - Insecure Design',
    'A05:2021 - Security Misconfiguration',
    'A06:2021 - Vulnerable and Outdated Components',
    'A07:2021 - Identification and Authentication Failures',
    'A08:2021 - Software and Data Integrity Failures',
    'A09:2021 - Security Logging and Monitoring Failures',
    'A10:2021 - Server-Side Request Forgery (SSRF)',
  ];

  const owaspCompliance: Record<string, { status: 'PASS' | 'WARNING' | 'FAIL'; count: number }> = {};
  for (const cat of owaspCategories) {
    owaspCompliance[cat] = { status: 'PASS', count: 0 };
  }

  for (const f of findings) {
    if (f.severity === 'CRITICAL') {
      score -= 25;
      criticalCount++;
    } else if (f.severity === 'HIGH') {
      score -= 15;
      highCount++;
    } else if (f.severity === 'MEDIUM') {
      score -= 8;
      mediumCount++;
    } else if (f.severity === 'LOW') {
      score -= 3;
      lowCount++;
    } else {
      infoCount++;
    }

    if (owaspCompliance[f.owaspCategory]) {
      owaspCompliance[f.owaspCategory].count++;
      if (['CRITICAL', 'HIGH'].includes(f.severity)) {
        owaspCompliance[f.owaspCategory].status = 'FAIL';
      } else if (owaspCompliance[f.owaspCategory].status !== 'FAIL') {
        owaspCompliance[f.owaspCategory].status = 'WARNING';
      }
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: AuditReport['grade'] = 'A+';
  if (score >= 95) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return {
    timestamp: new Date().toISOString(),
    target: {
      url: params.url,
      projectDir: params.projectDir,
    },
    securityScore: score,
    grade,
    summary: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      info: infoCount,
      total: findings.length,
    },
    findings,
    owaspCompliance,
  };
}
