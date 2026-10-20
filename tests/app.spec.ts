import { test, expect } from "@playwright/test";
test("真实训练、刷新持久化、计时、历史、曲线与离线", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "开始训练", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "杠铃深蹲第1组重量", exact: true })
    .fill("67.5");
  await page
    .getByRole("button", { name: "完成杠铃深蹲第1组", exact: true })
    .click();
  await expect(page.locator(".timer-face strong")).toHaveText(/02:5\d|03:00/);
  await expect(
    page.getByRole("button", { name: "取消完成杠铃深蹲第1组", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator(".connection")).toContainText("离线已就绪");
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第1组重量", exact: true }),
  ).toHaveValue("67.5");
  await expect(
    page.getByRole("button", { name: "取消完成杠铃深蹲第1组", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "结束并保存", exact: true }).click();
  await expect(page.locator(".history-list>button")).toHaveCount(1);
  await page.locator(".history-list>button").click();
  await expect(page.getByRole("dialog")).toContainText("67.5 kg × 5");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "力量进步", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "每次训练最大完成重量曲线" }),
  ).toBeVisible();
  await expect(page.locator(".chart-summary")).toContainText("67.5");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "开始训练", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "训练历史", exact: true }).click();
  await expect(page.locator(".history-list>button")).toHaveCount(1);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
test("移动端布局、备份导出与恢复及恶意文件校验", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "开始训练", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const file = await d;
  expect(file.suggestedFilename()).toMatch(/court-backup/);
  const path = await file.path();
  await page.locator("input[type=file]").first().setInputFiles(path!);
  await expect(page.getByRole("dialog")).toContainText("4 个模板");
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999}'),
    });
  await expect(page.getByRole("alert")).toContainText("不是受支持");
  await page.getByRole("button", { name: "关闭错误" }).click();
  await page.getByRole("button", { name: "训练", exact: true }).click();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("模板编辑保存、离线持久化，不改写当前训练与历史", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("button", { name: "完成杠铃深蹲第1组", exact: true })
    .click();
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  await page
    .getByRole("button", { name: "编辑第1周 周一｜下肢力量+弹跳", exact: true })
    .click();
  let editor = page.getByRole("dialog", { name: "编辑训练模板" });
  await editor
    .getByLabel("模板名称", { exact: true })
    .fill("第1周 周一｜我的下肢训练");
  const squat = editor.getByRole("group", {
    name: "02 · 杠铃深蹲",
    exact: true,
  });
  await squat.getByLabel("组数", { exact: true }).fill("4");
  await squat.getByLabel("每组次数 / 秒", { exact: true }).fill("6");
  await squat.getByLabel("重量 kg", { exact: true }).fill("75");
  await squat.getByLabel("组间休息（秒）", { exact: true }).fill("90");
  await editor.getByRole("button", { name: "保存模板", exact: true }).click();
  await page.getByRole("button", { name: "训练计划", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第1组重量", exact: true }),
  ).toHaveValue("65");
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第1组次", exact: true }),
  ).toHaveValue("5");
  await expect(page.locator(".session-progress")).toContainText("1 / 11");
  await page.getByRole("button", { name: "结束并保存", exact: true }).click();
  await page.locator(".history-list>button").click();
  await expect(page.getByRole("dialog")).toContainText("65 kg × 5");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".workout-title h2")).toHaveText(
    "第1周 周一｜我的下肢训练",
  );
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第4组重量", exact: true }),
  ).toHaveValue("75");
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第1组次", exact: true }),
  ).toHaveValue("6");
  await page
    .getByRole("button", { name: "完成杠铃深蹲第1组", exact: true })
    .click();
  await expect(page.locator(".timer-face strong")).toHaveText(/01:2\d|01:30/);
});

test("移动端编辑可取消、增删和排序动作，保存后写入备份", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "编辑模板", exact: true }).click();
  let editor = page.getByRole("dialog", { name: "编辑训练模板" });
  await editor.getByLabel("模板名称", { exact: true }).fill("不保存的修改");
  await editor.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".workout-title h2")).toHaveText(
    "第1周 周一｜下肢力量+弹跳",
  );
  await page.getByRole("button", { name: "编辑模板", exact: true }).click();
  editor = page.getByRole("dialog", { name: "编辑训练模板" });
  await editor
    .getByRole("button", { name: "下移第1个动作", exact: true })
    .click();
  await expect(editor.locator("fieldset").first()).toContainText(
    "01 · 杠铃深蹲",
  );
  await editor.getByRole("button", { name: "添加动作", exact: true }).click();
  await expect(editor.locator("fieldset")).toHaveCount(6);
  await editor
    .getByRole("button", { name: "删除第6个动作", exact: true })
    .click();
  await expect(editor.locator("fieldset")).toHaveCount(5);
  await editor
    .getByRole("group", { name: "01 · 杠铃深蹲", exact: true })
    .getByLabel("重量 kg", { exact: true })
    .fill("72.5");
  expect(await editor.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await editor.getByRole("button", { name: "保存模板", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const file = await downloaded;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const saved = JSON.parse(Buffer.concat(chunks).toString());
  expect(saved.data.plans[0].exercises[0]).toMatchObject({
    id: "squat",
    weight: 72.5,
  });
  await page
    .getByRole("button", { name: "编辑第1周 周一｜下肢力量+弹跳", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/mobile-editor.png",
    fullPage: false,
  });
});

test("训练临时加组：继承输入、离线保存、备份与历史保留，模板不变", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "杠铃深蹲第3组重量", exact: true })
    .fill("72.5");
  await page
    .getByRole("spinbutton", { name: "杠铃深蹲第3组次", exact: true })
    .fill("6");
  await page
    .getByRole("button", { name: "给杠铃深蹲添加一组", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第4组重量", exact: true }),
  ).toHaveValue("72.5");
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第4组次", exact: true }),
  ).toHaveValue("6");
  await expect(
    page.getByRole("button", { name: "完成杠铃深蹲第4组", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".session-progress")).toContainText("0 / 12");
  await expect(page.locator(".timer-face small")).toHaveText("准备好下一组");
  await page
    .getByRole("button", { name: "完成杠铃深蹲第4组", exact: true })
    .click();
  await expect(page.locator(".session-progress")).toContainText("1 / 12");
  await expect(page.locator("footer")).toContainText("数据仅保存在当前设备");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第4组重量", exact: true }),
  ).toHaveValue("72.5");
  await expect(
    page.getByRole("button", { name: "取消完成杠铃深蹲第4组", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "结束并保存", exact: true }).click();
  await page.locator(".history-list>button").click();
  await expect(page.getByRole("dialog")).toContainText("第 4 组：72.5 kg × 6");
  await page.screenshot({ path: "test-results/added-set-history.png" });
  expect(
    (await page.getByRole("dialog").boundingBox())!.width,
  ).toBeLessThanOrEqual(350);
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "进步", exact: true }).click();
  await expect(page.locator(".chart-summary")).toContainText("72.5");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const file = await download;
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles((await file.path())!);
  await expect(page.getByRole("dialog")).toContainText("1 条训练记录");
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await page.getByRole("button", { name: "训练", exact: true }).click();
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第3组重量", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "杠铃深蹲第4组重量", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
