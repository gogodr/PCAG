import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-production', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173/?sample=1' } },
    { name: 'chromium-development', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5175/?sample=1' } },
  ],
  webServer: [
    { command: 'npm run preview:creator', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    { command: 'npm run preview:player', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
    { command: 'npm run dev:creator:web -- --port 5175 --mode smoke', url: 'http://127.0.0.1:5175', reuseExistingServer: false },
    { command: 'npm run dev:player -- --port 5176 --mode smoke', url: 'http://127.0.0.1:5176', reuseExistingServer: false },
  ],
});
