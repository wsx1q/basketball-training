import { test, expect } from "@playwright/test";

test("推送开关、安排、暂停取消、网络错误和重连", async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
    Notification.requestPermission = async () => "granted";
    const subscription = {
      toJSON: () => ({
        endpoint: "https://web.push.apple.com/test-only",
        keys: { p256dh: "test-only", auth: "test-only" },
      }),
      unsubscribe: async () => true,
    };
    PushManager.prototype.getSubscription = async () =>
      subscription as unknown as PushSubscription;
    PushManager.prototype.subscribe = async () =>
      subscription as unknown as PushSubscription;
  });
  const jobs: Record<string, any>[] = [];
  await page.route("**/public-key", (route) =>
    route.fulfill({
      json: {
        publicKey:
          "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    }),
  );
  await page.route("**/reminder", async (route) => {
    const body = route.request().postDataJSON();
    jobs.push(body);
    await route.fulfill({
      json: {
        status: body.dueAt ? "scheduled" : "cancelled",
        dueAt: body.dueAt,
        revision: body.revision,
      },
    });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  await page.getByRole("button", { name: "开启后台通知", exact: true }).click();
  await expect(page.locator(".push-status")).toContainText("后台通知已开启");
  await page.getByRole("button", { name: "10 秒后测试通知" }).click();
  await expect(page.locator(".push-status")).toContainText("测试已安排");
  expect(jobs.at(-1)?.dueAt).toBeGreaterThan(Date.now() + 5000);
  await page.getByRole("button", { name: "训练计划", exact: true }).click();
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page.getByRole("button", { name: "开始休息", exact: true }).click();
  await expect(page.locator(".push-link")).toContainText("已安排");
  await page.getByRole("button", { name: "结束训练", exact: true }).click();
  await expect(page.locator(".push-link")).toContainText("后台通知已开启");
  expect(jobs.at(-1)?.dueAt).toBeNull();
  await page.getByRole("button", { name: "开始训练", exact: true }).click();
  await page
    .getByRole("button", { name: "完成杠铃深蹲第1组", exact: true })
    .click();
  await expect(page.locator(".push-link")).toContainText("已安排");
  expect(jobs.at(-1)?.dueAt).toBeGreaterThan(Date.now() + 175000);
  expect(Object.keys(jobs.at(-1)!).sort()).toEqual([
    "dueAt",
    "revision",
    "subscription",
  ]);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.locator(".push-link")).toContainText("后台通知已开启");
  expect(jobs.at(-1)?.dueAt).toBeNull();
  const revisions = jobs.map((job) => job.revision);
  expect(new Set(revisions).size).toBe(revisions.length);
  await context.setOffline(true);
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator(".timer-note .push-failure")).toContainText(
    "当前离线",
  );
  await context.setOffline(false);
  await expect(page.locator(".push-link")).toContainText("已安排");
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  await page.getByRole("button", { name: "关闭后台通知" }).click();
  await expect(page.locator(".push-status")).toContainText("后台通知已关闭");
  expect(jobs.at(-1)?.dueAt).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: "数据与设置", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "开启后台通知", exact: true }),
  ).toBeVisible();
});

test("服务工作线程收到推送时显示系统通知，点击返回训练", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const source = await (await fetch("./push-sw.js")).text();
    const listeners: Record<string, Function> = {};
    const notifications: any[] = [];
    let focused = false,
      closed = false;
    const client = {
      url: location.href,
      focus: async () => {
        focused = true;
      },
      postMessage: () => {},
    };
    const fake = {
      registration: {
        scope: location.href,
        showNotification: async (...args: any[]) => notifications.push(args),
      },
      clients: { matchAll: async () => [client], openWindow: async () => {} },
      addEventListener: (type: string, cb: Function) => {
        listeners[type] = cb;
      },
    };
    new Function("self", source)(fake);
    await new Promise((resolve) =>
      listeners.push({
        data: { json: () => ({ tag: "court-rest-test", dueAt: Date.now() }) },
        waitUntil: (promise: Promise<void>) => promise.then(resolve),
      }),
    );
    await new Promise((resolve) =>
      listeners.notificationclick({
        notification: {
          close: () => {
            closed = true;
          },
        },
        waitUntil: (promise: Promise<void>) => promise.then(resolve),
      }),
    );
    return { notifications, focused, closed };
  });
  expect(result.notifications).toHaveLength(1);
  expect(result.notifications[0][0]).toBe("COURT · 休息结束");
  expect(result.notifications[0][1].tag).toBe("court-rest-test");
  expect(result.focused).toBe(true);
  expect(result.closed).toBe(true);
});
