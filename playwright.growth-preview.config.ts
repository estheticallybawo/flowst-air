import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/growth-preview",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4324", channel: "chrome" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "node scripts/run-growth-preview.mjs",
    url: "http://127.0.0.1:4324/airs",
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
