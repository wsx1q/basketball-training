import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const url = process.argv[2];
if (!url?.startsWith("https://"))
  throw Error("Supply the HTTPS deployment URL.");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_BROWSER_PATH ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(url);
  if (response.status() !== 200)
    throw Error(`Deployment HTTP ${response.status()}`);
  await page.getByRole("button", { name: "开始训练", exact: true }).waitFor();
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  if (scope !== url) throw Error(`Incorrect SW scope ${scope}`);
  await page.reload();
  await page.getByRole("button", { name: "开始训练", exact: true }).waitFor();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("button", { name: "完成杠铃深蹲第1组", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "取消完成杠铃深蹲第1组", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 390)
    throw Error("Mobile horizontal overflow");
  await page.screenshot({
    path: "test-results/mobile-workout.png",
    fullPage: false,
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: HTTPS deployment, repository subpath, SW scope, offline reload, persisted workout, desktop and mobile layout.",
  );
} finally {
  await browser.close();
}
