import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/source-e2e', workers: 1, fullyParallel: false, timeout: 90_000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4322', channel: 'chrome' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 5'] } }],
  webServer: process.env.AIR_REUSE_FIXTURE_SERVER === 'true' ? undefined : { command: 'node scripts/run-source-fixtures.mjs', url: 'http://127.0.0.1:4322/auth/sign-in', timeout: 900_000, reuseExistingServer: false },
})
