import { test, expect } from "@playwright/test";

test("自选配色即时预览、离线保留、备份携带，篮球版独立且可恢复默认", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "女生版 · 粉色跟练", exact: true })
    .click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const color = page.getByLabel("页面背景", { exact: true });
  await color.fill("#ffeedd");
  await expect(page.locator(".app")).toHaveCSS(
    "background-color",
    "rgb(255, 238, 221)",
  );
  await page
    .getByLabel("重点色 · 按钮与计时环", { exact: true })
    .fill("#334455");
  await expect(
    page.getByRole("button", { name: "导出 JSON", exact: true }),
  ).toHaveCSS("background-color", "rgb(51, 68, 85)");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(
    JSON.parse(Buffer.concat(chunks).toString()).data.themeColors.accent,
  ).toBe("#334455");
  await expect(page.getByText("数据仅保存在当前设备", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".app")).toHaveCSS(
    "background-color",
    "rgb(255, 238, 221)",
  );
  await page.getByRole("button", { name: "篮球版", exact: true }).click();
  await expect(page.locator(".app")).not.toHaveClass(/custom-colors/);
  await page
    .getByRole("button", { name: "女生版 · 粉色跟练", exact: true })
    .click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(color).toHaveValue("#ffeedd");
  await page.getByRole("button", { name: "恢复默认配色", exact: true }).click();
  await expect(page.locator(".app")).not.toHaveClass(/custom-colors/);
  await expect(color).toHaveValue("#fff2f7");
});
