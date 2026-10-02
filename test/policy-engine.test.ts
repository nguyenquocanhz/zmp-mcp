import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runPolicyAudit, checkTitle, stripComments } from '../src/policy/engine.js';

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zmp-policy-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

const config = (title: string) => JSON.stringify({ app: { title } });
const ids = (r: ReturnType<typeof runPolicyAudit>, severity?: string) =>
  r.findings.filter((f) => !severity || f.severity === severity).map((f) => f.ruleId).sort();

test('bắt đủ các lỗi từng lọt qua zmp-audit.js cũ', () => {
  const dir = makeProject({
    'app-config.json': config('WrenApp - Tra cứu bưu chính và Giá xăng'),
    'app.json': config('WrenApp - Tra cứu bưu chính và Giá xăng'),
    'index.html': '<html><head><title>WrenApp - Tra cứu mã bưu chính</title></head></html>',
    'src/Stations.jsx': `
      export function Stations({ st }) {
        useEffect(() => {
          navigator.geolocation.getCurrentPosition(() => {});
        }, []);
        return (
          <div>
            <button>📍 Chọn vị trí mẫu: Q. Bình Tân</button>
            <a
              href={\`https://www.google.com/maps/dir/?api=1&destination=\${st.lat}\`}
              target="_blank"
            >Chỉ đường</a>
          </div>
        );
      }`,
  });
  const r = runPolicyAudit(dir);
  const found = ids(r);
  assert.ok(found.includes('NAME_BANNED_WORDS'), 'chữ App dính trong WrenApp');
  assert.ok(found.includes('NAME_INCONSISTENT'), 'tên lệch giữa app-config và index.html');
  assert.ok(found.includes('CONTENT_EXTERNAL_LINK'), 'link Google Maps target=_blank');
  assert.ok(found.includes('PERF_DEMO_CONTENT'), 'chữ "vị trí mẫu"');
  assert.ok(found.includes('PERM_ON_LOAD'), 'xin vị trí trong useEffect lúc mount (nhiều dòng)');
  assert.ok(r.summary.errors >= 2);
  const link = r.findings.find((f) => f.ruleId === 'CONTENT_EXTERNAL_LINK')!;
  assert.equal(link.file, 'src/Stations.jsx');
  assert.equal(link.line, 9);
});

test('dự án sạch: không có lỗi, nhưng vẫn còn mục kiểm tay', () => {
  const dir = makeProject({
    'app-config.json': config('Wren - Tra cứu bưu chính, giá xăng'),
    'app.json': config('Wren - Tra cứu bưu chính, giá xăng'),
    'index.html': '<html><head><title>Wren - Tra cứu bưu chính, giá xăng</title></head></html>',
    'src/App.jsx': `
      import { openWebview } from 'zmp-sdk';
      // window.open('https://bi-bo-qua-vi-nam-trong-comment.com')
      /* <a href="https://cung-trong-comment.com" target="_blank">x</a> */
      const API = 'https://zaloapp.vietcode.io.vn/api';
      const DEV = 'http://localhost:8088/api';
      export function App() {
        const [pos, setPos] = useState(null);
        useEffect(() => { fetch(API); }, []);
        const locate = () => navigator.geolocation.getCurrentPosition(setPos);
        return (
          <div>
            <a href="https://zalo.me/s/123">Mở OA</a>
            <button onClick={locate}>Tìm cây xăng gần tôi</button>
            <button onClick={() => openWebview({ url: 'https://maps.google.com' })}>Chỉ đường</button>
          </div>
        );
      }`,
  });
  const r = runPolicyAudit(dir);
  assert.deepEqual(ids(r), []);
  assert.equal(r.summary.errors, 0);
  assert.ok(r.manualChecks.length > 0);
  assert.match(r.verdict, /kiểm tay/);
  assert.doesNotMatch(r.verdict, /100%/);
});

test('useEffect có phụ thuộc không tính là xin quyền lúc mở app', () => {
  const dir = makeProject({
    'app-config.json': config('Wren - Bản đồ'),
    'src/A.jsx': `useEffect(() => {
      if (wantGps) navigator.geolocation.getCurrentPosition(cb);
    }, [wantGps]);`,
  });
  assert.ok(!ids(runPolicyAudit(dir)).includes('PERM_ON_LOAD'));
});

test('nút mua thiếu Checkout SDK', () => {
  const base = { 'app-config.json': config('Wren - Cửa hàng') };
  const noSdk = runPolicyAudit(makeProject({ ...base, 'src/A.jsx': '<button>Mua ngay</button>' }));
  assert.ok(ids(noSdk).includes('PAYMENT_NO_CHECKOUT_SDK'));
  const withSdk = runPolicyAudit(
    makeProject({ ...base, 'src/A.jsx': '<button onClick={() => Payment.createOrder(o)}>Mua ngay</button>' })
  );
  assert.ok(!ids(withSdk).includes('PAYMENT_NO_CHECKOUT_SDK'));
});

test('eval, HTTP không mã hoá, đăng nhập Google', () => {
  const r = runPolicyAudit(
    makeProject({
      'app-config.json': config('Wren - Công cụ'),
      'src/a.js': `eval(x); fetch('http://api.example.com/x'); location.href = "https://accounts.google.com/o/oauth2";`,
    })
  );
  const found = ids(r);
  for (const id of ['SEC_EVAL', 'SEC_INSECURE_HTTP', 'CONTENT_3RD_PARTY_LOGIN', 'CONTENT_EXTERNAL_LINK']) {
    assert.ok(found.includes(id), id);
  }
});

test('luật tên', () => {
  const rule = (t: string) => checkTitle(t).map((f) => `${f.ruleId}:${f.severity}`);
  assert.deepEqual(rule('Wren - Tra cứu bưu chính, giá xăng'), []);
  assert.ok(rule('TRA CỨU MÃ BƯU CHÍNH').includes('NAME_ALL_CAPS:ERROR'));
  assert.ok(rule('Zalo Shop - Mua sắm').includes('NAME_BANNED_WORDS:ERROR'));
  assert.ok(rule('Wren Mini App').includes('NAME_BANNED_WORDS:ERROR'));
  assert.ok(rule('Wren App - Tra cứu').includes('NAME_BANNED_WORDS:ERROR'));
  assert.ok(rule('WrenApp - Tra cứu').includes('NAME_BANNED_WORDS:WARNING'));
  assert.ok(rule('Wren - Tra cứu 🔥').includes('NAME_SPECIAL_CHARS:ERROR'));
  assert.ok(rule('Tra cứu mã bưu chính').includes('NAME_GENERIC_KEYWORD:ERROR'));
  assert.ok(rule('').includes('NAME_EMPTY:ERROR'));
});

test('bỏ comment nhưng giữ số dòng và giữ URL trong chuỗi', () => {
  const src = "a // x\nconst u = 'https://x.vn';\n/* b\nc */ d";
  const out = stripComments(src);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.ok(out.includes("'https://x.vn'"));
  assert.ok(!out.includes('// x'));
});
