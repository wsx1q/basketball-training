import { buildPushPayload } from "@block65/webcrypto-web-push";

const APP_URL = "https://wsx1q.github.io/basketball-training/";
const ORIGINS = new Set([
  "https://wsx1q.github.io",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
]);
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function validateJob(body, now = Date.now()) {
  if (!body || !Number.isSafeInteger(body.revision) || body.revision <= 0)
    throw Error("无效的提醒版本。");
  if (body.dueAt === null) return { revision: body.revision, dueAt: null };
  if (
    !Number.isSafeInteger(body.dueAt) ||
    body.dueAt <= now ||
    body.dueAt > now + 3601000
  )
    throw Error("提醒时间必须在未来一小时内。");
  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 2048)
    throw Error("无效的通知订阅。");
  const endpoint = new URL(sub.endpoint),
    host = endpoint.hostname;
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    (endpoint.port && endpoint.port !== "443") ||
    !(
      host === "fcm.googleapis.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".notify.windows.com")
    )
  )
    throw Error("不支持的推送服务地址。");
  const decode = (s, len) => {
    if (typeof s !== "string" || !/^[A-Za-z0-9_-]+$/.test(s)) return false;
    try {
      return (
        Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        ).length === len
      );
    } catch {
      return false;
    }
  };
  if (!decode(sub.keys?.p256dh, 65) || !decode(sub.keys?.auth, 16))
    throw Error("通知订阅密钥无效。");
  return {
    revision: body.revision,
    dueAt: body.dueAt,
    subscription: {
      endpoint: endpoint.href,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    },
  };
}
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health")
      return new Response("court-rest-push ready");
    const origin = request.headers.get("Origin");
    if (!ORIGINS.has(origin)) return json({ error: "不允许的来源。" }, 403);
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    };
    const cors = (response) =>
      new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...headers },
      });
    if (request.method === "OPTIONS")
      return cors(new Response(null, { status: 204 }));
    const path = new URL(request.url).pathname;
    if (path === "/public-key" && request.method === "GET")
      return cors(json({ publicKey: env.VAPID_PUBLIC_KEY }));
    if (!["/reminder", "/status"].includes(path))
      return cors(json({ error: "Not found" }, 404));
    if (!(
      (path === "/reminder" && request.method === "POST") ||
      (path === "/status" && request.method === "GET")
    ))
      return cors(json({ error: "Method not allowed" }, 405));
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      return cors(json({ error: "缺少设备凭证。" }, 401));
    if (Number(request.headers.get("Content-Length")) > 8192)
      return cors(json({ error: "请求过大。" }, 413));
    let body;
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > 8192) return cors(json({ error: "请求过大。" }, 413));
      try {
        body = validateJob(JSON.parse(raw));
      } catch (e) {
        return cors(json({ error: e.message || "请求格式错误。" }, 400));
      }
    }
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(token),
      );
      const id = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const stub = env.REMINDERS.get(env.REMINDERS.idFromName(id));
      return cors(
        await stub.fetch(
          new Request(
            `https://internal${path}`,
            request.method === "POST"
              ? { method: "POST", body: JSON.stringify(body) }
              : { method: "GET" },
          ),
        ),
      );
    } catch {
      return cors(json({ error: "提醒服务暂时不可用，请重试。" }, 503));
    }
  },
};

// One short-lived alarm per device. No workout names, weights, or history enter this service.
export class RestReminder {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const current = await this.ctx.storage.get("job");
      if (request.method === "GET")
        return json({
          status: current?.status ?? "idle",
          dueAt: current?.dueAt ?? null,
          revision: current?.revision ?? 0,
        });
      const input = await request.json();
      if (current && input.revision <= current.revision)
        return json({
          status: current.status,
          dueAt: current.dueAt,
          revision: current.revision,
          stale: true,
        });
      const job = {
        ...input,
        status: input.dueAt === null ? "cancelled" : "scheduled",
        attempts: 0,
        expiresAt: (input.dueAt ?? Date.now()) + 3600000,
      };
      await this.ctx.storage.put("job", job);
      await this.ctx.storage.setAlarm(input.dueAt ?? job.expiresAt);
      return json({
        status: job.status,
        dueAt: job.dueAt,
        revision: job.revision,
      });
    });
  }
  async alarm() {
    const job = await this.ctx.storage.get("job");
    if (!job) return;
    if (job.status !== "scheduled") {
      if (Date.now() >= job.expiresAt) {
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
      } else await this.ctx.storage.setAlarm(job.expiresAt);
      return;
    }
    if (job.dueAt > Date.now()) {
      await this.ctx.storage.setAlarm(job.dueAt);
      return;
    }
    let outcome = "failed",
      retry = false;
    if (Date.now() - job.dueAt < 60000) {
      try {
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              title: "COURT · 休息结束",
              body: "准备好下一组，点击返回训练。",
              dueAt: job.dueAt,
              tag: `court-rest-${job.revision}`,
            }),
            options: { ttl: 60, urgency: "high" },
          },
          job.subscription,
          {
            subject: APP_URL,
            publicKey: this.env.VAPID_PUBLIC_KEY,
            privateKey: this.env.VAPID_PRIVATE_KEY,
          },
        );
        const response = await fetch(job.subscription.endpoint, {
          ...payload,
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        });
        outcome = response.ok
          ? "sent"
          : response.status === 404 || response.status === 410
            ? "expired"
            : "failed";
        retry =
          !response.ok && (response.status === 429 || response.status >= 500);
      } catch {
        retry = true;
      }
    }
    // A cancellation or newer set may have arrived while the push request was in flight.
    await this.ctx.blockConcurrencyWhile(async () => {
      const current = await this.ctx.storage.get("job");
      if (current?.revision !== job.revision) return;
      if (retry && job.attempts < 2 && Date.now() - job.dueAt < 45000) {
        await this.ctx.storage.put("job", {
          ...job,
          attempts: job.attempts + 1,
        });
        await this.ctx.storage.setAlarm(Date.now() + 3000 * (job.attempts + 1));
      } else {
        const { subscription, ...metadata } = job;
        await this.ctx.storage.put("job", { ...metadata, status: outcome });
        await this.ctx.storage.setAlarm(job.expiresAt);
      }
    });
  }
}
