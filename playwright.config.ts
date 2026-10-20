import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_BROWSER_PATH ??
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    },
    headless: true,
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
