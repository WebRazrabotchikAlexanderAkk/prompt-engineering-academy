import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './tests/static',
  timeout: 60000,
  workers: 1,
  reporter: 'line',
  outputDir: join(tmpdir(), 'pea-static-browser-results'),
  use: { baseURL: 'http://127.0.0.1:4323/acceptance-preview/', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/static-preview.mjs',
    url: 'http://127.0.0.1:4323/acceptance-preview/',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1' || !process.env.CI,
    timeout: 120000,
  },
  projects: [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }],
});
