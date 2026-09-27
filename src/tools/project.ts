import fs from 'fs';
import path from 'path';
import { createZaloApiClient } from '../utils/http.js';
import { loadEnv } from '../utils/env.js';
import { ZALO_CONFIG } from '../config.js';

export async function getAppInfo(projectDir: string, explicitAppId?: string, explicitToken?: string) {
  const env = loadEnv(projectDir);
  const token = explicitToken || env.token;
  const appId = explicitAppId || env.appId;

  if (!token) {
    return {
      success: false,
      error: 'Missing ZMP_TOKEN. Authenticate first.',
    };
  }

  const client = createZaloApiClient(token);
  try {
    const res = await client.get(`${ZALO_CONFIG.ENDPOINTS.getAppInfo}?appId=${appId || ''}`);
    return {
      success: res.data?.err === 0,
      data: res.data?.data,
      message: res.data?.msg,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.msg || err.message,
    };
  }
}

export async function createAppProject(params: {
  targetDir: string;
  appName: string;
  appTitle: string;
  appId?: string;
  template?: 'zaui-blank' | 'zaui-tabs' | 'blank';
}) {
  const { targetDir, appName, appTitle, appId = '', template = 'zaui-blank' } = params;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Create package.json
  const packageJson = {
    name: appName,
    version: '1.0.0',
    private: true,
    description: `Zalo Mini App - ${appTitle}`,
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'zmp-sdk': '^2.41.0',
      'zmp-ui': '^1.11.0',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.0',
      sass: '^1.77.0',
      vite: '^5.4.0',
    },
  };
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');

  // Create app-config.json
  const appConfig = {
    app: {
      appId: appId,
      title: appTitle,
      headerColor: '#0068FF',
      statusBarColor: '#0068FF',
      textColor: 'white',
    },
    template: {
      type: template,
      name: template,
    },
    pages: ['pages/index/index'],
    listSyncableEvent: [],
    permission: {},
  };
  fs.writeFileSync(path.join(targetDir, 'app-config.json'), JSON.stringify(appConfig, null, 2), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'app.json'), JSON.stringify(appConfig, null, 2), 'utf8');

  // Create zmp.json
  const zmpConfig = {
    name: appName,
    title: appTitle,
    framework: 'react',
    template: template,
  };
  fs.writeFileSync(path.join(targetDir, 'zmp.json'), JSON.stringify(zmpConfig, null, 2), 'utf8');

  // Create vite.config.js
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: './',
  base: './',
  plugins: [react()],
  build: {
    outDir: 'www',
    emptyOutDir: true,
  },
});
`;
  fs.writeFileSync(path.join(targetDir, 'vite.config.js'), viteConfig, 'utf8');

  // Create src structure
  const srcDir = path.join(targetDir, 'src');
  const pagesDir = path.join(srcDir, 'pages', 'index');
  const cssDir = path.join(srcDir, 'css');
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.mkdirSync(cssDir, { recursive: true });

  // CSS with dark mode + select/option rule compliance
  const appScss = `:root {
  --bg-page: #f4f5f7;
  --bg-card: #ffffff;
  --text-primary: #141415;
  --text-secondary: #767a7f;
  --border-color: #e4e6eb;
}

[data-theme='dark'] {
  --bg-page: #18191a;
  --bg-card: #242526;
  --text-primary: #e4e6eb;
  --text-secondary: #b0b3b8;
  --border-color: #3a3b3c;
}

/* User Rule: Explicit dark mode styling for select & option */
[data-theme='dark'] select option {
  background-color: var(--bg-card);
  color: var(--text-primary);
}

body {
  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 0;
}
`;
  fs.writeFileSync(path.join(cssDir, 'app.scss'), appScss, 'utf8');

  // index.jsx
  const indexJsx = `import React, { useState, useEffect } from 'react';
import { Page, Box, Text, Button, Icon } from 'zmp-ui';

export default function HomePage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    const dark = saved === 'dark';
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = !isDark ? 'dark' : 'light';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <Page className="page">
      <Box p={4} m={4} style={{ backgroundColor: 'var(--bg-card)', borderRadius: 12 }}>
        <Text.Title size="large">${appTitle}</Text.Title>
        <Text size="normal" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          Zalo Mini App created with zmp-mcp
        </Text>
        <Box mt={4}>
          <Button
            size="medium"
            variant="secondary"
            onClick={toggleTheme}
            prefixIcon={<Icon icon="zi-wallpaper" />}
          >
            {isDark ? 'Chế độ Sáng' : 'Chế độ Tối'}
          </Button>
        </Box>
      </Box>
    </Page>
  );
}
`;
  fs.writeFileSync(path.join(pagesDir, 'index.jsx'), indexJsx, 'utf8');

  // app.jsx
  const appJsx = `import React from 'react';
import { App, ZMPRouter, AnimationRoutes, Route } from 'zmp-ui';
import HomePage from './pages/index/index';
import './css/app.scss';

export default function MyApp() {
  return (
    <App>
      <ZMPRouter>
        <AnimationRoutes>
          <Route path="/" element={<HomePage />} />
        </AnimationRoutes>
      </ZMPRouter>
    </App>
  );
}
`;
  fs.writeFileSync(path.join(srcDir, 'app.jsx'), appJsx, 'utf8');

  // index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>${appTitle}</title>
    <script>
      (function() {
        var theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import React from 'react';
      import ReactDOM from 'react-dom/client';
      import MyApp from './src/app.jsx';
      ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(MyApp));
    </script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtml, 'utf8');

  // .env
  if (appId) {
    fs.writeFileSync(path.join(targetDir, '.env'), `APP_ID=${appId}\n`, 'utf8');
  }

  // .gitignore
  const gitignore = `node_modules
www
dist
.env
.DS_Store
`;
  fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignore, 'utf8');

  return {
    success: true,
    message: `Zalo Mini App project created successfully at ${targetDir}`,
    template,
    appTitle,
    appId,
  };
}
