import { test, expect } from "@playwright/test";

test("粉色跟练：独立模板、次数与大卡、链接快照、离线保存和体重曲线", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("button", { name: "完成杠铃深蹲第1组", exact: true })
    .click();
  await page.getByRole("button", { name: "结束训练", exact: true }).click();
  await page
    .getByRole("button", { name: "女生版 · 粉色跟练", exact: true })
    .click();
  await expect(page.locator(".app")).toHaveClass(/pink-mode/);
  await expect(page.locator(".stat").first()).toContainText("00");
  await page.getByRole("button", { name: "编辑模板", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "编辑训练模板" });
  await editor.getByLabel("模板名称", { exact: true }).fill("我的有氧跟练");
  await editor
    .getByLabel("模板跟练链接", { exact: true })
    .fill("https://example.com/course");
  const exercise = editor.locator("fieldset").first();
  await exercise.getByLabel("动作名称", { exact: true }).fill("有氧课程");
  await exercise.getByLabel("组数", { exact: true }).fill("2");
  await exercise.getByLabel("每组次数 / 秒", { exact: true }).fill("12");
  await exercise
    .getByLabel("动作跟练链接", { exact: true })
    .fill("https://example.com/movement");
  await editor.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "打开跟练", exact: true }),
  ).toHaveAttribute("href", "https://example.com/course");
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "有氧课程第1组消耗大卡", exact: true })
    .fill("80");
  await page
    .getByRole("spinbutton", { name: "有氧课程第2组消耗大卡", exact: true })
    .fill("55.5");
  await page
    .getByRole("spinbutton", { name: "有氧课程第2组次", exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "完成有氧课程第1组", exact: true })
    .click();
  await page
    .getByRole("button", { name: "完成有氧课程第2组", exact: true })
    .click();
  await page
    .getByRole("button", { name: "给有氧课程添加一组", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "有氧课程第3组消耗大卡",
      exact: true,
    }),
  ).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "有氧课程第3组次", exact: true }),
  ).toHaveValue("10");
  await page
    .getByLabel("本次跟练链接", { exact: true })
    .fill("https://example.com/today");
  await page.getByRole("button", { name: "保存链接", exact: true }).click();
  await page.getByRole("button", { name: "篮球版", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "女生版 · 粉色跟练" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("status").filter({ hasText: "请先结束当前训练" }),
  ).toBeVisible();
  await expect(page.locator("footer")).toContainText("数据仅保存在当前设备");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/pink-mode/);
  await expect(
    page.getByRole("spinbutton", {
      name: "有氧课程第2组消耗大卡",
      exact: true,
    }),
  ).toHaveValue("55.5");
  await expect(
    page.getByRole("link", { name: "打开跟练", exact: true }),
  ).toHaveAttribute("href", "https://example.com/today");
  await page.getByRole("button", { name: "结束训练", exact: true }).click();
  await expect(page.locator(".history-list")).toContainText("135.5 大卡");
  await page.locator(".history-list>button").click();
  await expect(page.getByRole("dialog")).toContainText("55.5 大卡");
  await expect(
    page.getByRole("link", { name: "打开本次跟练" }),
  ).toHaveAttribute("href", "https://example.com/today");
  await page.getByRole("button", { name: "关闭详情" }).click();
  await page.getByRole("button", { name: "进步", exact: true }).click();
  await page.getByLabel("记录日期", { exact: true }).fill("2026-10-19");
  await page.getByLabel("体重 kg", { exact: true }).fill("55");
  await page.getByLabel("体重备注", { exact: true }).fill("晨起");
  await page.getByRole("button", { name: "保存体重", exact: true }).click();
  await page.getByLabel("记录日期", { exact: true }).fill("2026-10-20");
  await page.getByLabel("体重 kg", { exact: true }).fill("54.8");
  await page.getByRole("button", { name: "保存体重", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "按日期记录的体重变化曲线" }),
  ).toBeVisible();
  await expect(page.locator(".weight-summary")).toContainText("-0.2");
  await expect(page.locator(".weight-record")).toHaveCount(2);
  await page.getByLabel("体重 kg", { exact: true }).fill("54.9");
  await page.getByRole("button", { name: "保存体重", exact: true }).click();
  await expect(page.locator(".weight-record")).toHaveCount(2);
  await expect(page.locator(".weight-summary")).toContainText("54.9");
  await page.screenshot({
    path: "test-results/pink-weight.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "篮球版", exact: true }).click();
  await page.getByRole("button", { name: "历史", exact: true }).click();
  await expect(page.locator(".history-list>button")).toHaveCount(1);
  await expect(page.locator(".history-list")).toContainText("325 kg");
  await page
    .getByRole("button", { name: "女生版 · 粉色跟练", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "打开跟练", exact: true }),
  ).toHaveAttribute("href", "https://example.com/course");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/pink-training.png",
    fullPage: false,
  });
  expect(errors).toEqual([]);
});

test("新版完整备份包含两个模式和体重；旧版备份可恢复，新建跟练模板可保存", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "女生版 · 粉色跟练", exact: true })
    .click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "新建跟练模板", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "编辑训练模板" });
  await editor.getByLabel("模板名称", { exact: true }).fill("第二个跟练模板");
  await editor.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.locator(".template-list>div")).toHaveCount(2);
  await page.getByRole("button", { name: "进步", exact: true }).click();
  await page.getByLabel("记录日期", { exact: true }).fill("2026-10-20");
  await page.getByLabel("体重 kg", { exact: true }).fill("62.3");
  await page.getByRole("button", { name: "保存体重", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const file = await downloaded;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const value = JSON.parse(Buffer.concat(chunks).toString());
  expect(value.version).toBe(2);
  expect(value.data.plans).toHaveLength(4);
  expect(value.data.wellness.plans).toHaveLength(2);
  expect(value.data.mode).toBe("wellness");
  expect(value.data.bodyWeights).toEqual([
    { date: "2026-10-20", kg: 62.3, note: "" },
  ]);
  const legacy = {
    app: "court-training",
    version: 1,
    data: {
      plans: value.data.plans,
      sessions: [],
      restEnd: null,
      restDuration: 90,
    },
  };
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacy)),
    });
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(page.locator(".app")).not.toHaveClass(/pink-mode/);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles((await file.path())!);
  await expect(page.getByRole("dialog")).toContainText("2 个跟练模板");
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(page.locator(".app")).toHaveClass(/pink-mode/);
  await expect(page.locator(".template-list>div")).toHaveCount(2);
  await page.getByRole("button", { name: "进步", exact: true }).click();
  await expect(page.locator(".weight-summary")).toContainText("62.3");
});
