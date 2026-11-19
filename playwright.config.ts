import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1,
  timeout: 30000, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4389', browserName: 'chromium', viewport: {width:1360,height:900}, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm exec tsx tests/browser/server.ts', url: 'http://127.0.0.1:4389/api/workspace', reuseExistingServer: false, timeout: 15000, gracefulShutdown: {signal:'SIGTERM',timeout:5000} },
});
