import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    clean: true,
    dts: true,
    banner: {
      js: '#!/usr/bin/env node\n',
    },
  },
  {
    // Bản CLI kiểm duyệt đứng riêng, chép vào dự án Mini App làm zmp-audit.js (CommonJS, không phụ thuộc)
    entry: { 'zmp-audit': 'src/policy/standalone.ts' },
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    target: 'node18',
    clean: false,
    banner: {
      js: '#!/usr/bin/env node\n// Sinh tự động từ zmp-mcp (src/policy). Đừng sửa tay: sửa trong zmp-mcp rồi build lại.',
    },
  },
]);
