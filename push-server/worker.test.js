import { beforeEach, describe, it, expect, vi } from "vitest";
import worker, { RestReminder, validateJob } from "./worker";

async function keyPair() {
  const key = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  return {
    publicKey: Buffer.from(
      await crypto.subtle.exportKey("raw", key.publicKey),
    ).toString("base64url"),
    privateKey: (await crypto.subtle.exportKey("jwk", key.privateKey)).d,
  };
}
async function fixture() {
  const vapid = await keyPair(),
    receiver = await keyPair();
  const subscription = {
    endpoint: "https://web.push.apple.com/test-subscription",
    keys: {
      p256dh: receiver.publicKey,
      auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
        "base64url",
      ),
    },
  };
  const values = new Map();
  let alarm = null;
  const storage = {
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => {
      values.set(key, structuredClone(value));
    },
    setAlarm: async (date) => {
      alarm = date;
    },
    deleteAll: async () => values.clear(),
    deleteAlarm: async () => {
      alarm = null;
    },
  };
  const ctx = { storage, blockConcurrencyWhile: (fn) => fn() };
  const env = {
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
  };
  const object = new RestReminder(ctx, env);
  const post = async (input) =>
    (
      await object.fetch(
        new Request("https://internal/reminder", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      )
    ).json();
  return {
    object,
    post,
    subscription,
    values,
    storage,
    env,
    getAlarm: () => alarm,
  };
}
beforeEach(() => vi.unstubAllGlobals());
describe("休息推送服务", () => {
  it("只接受有效推送服务和短期时间，拒绝内网/任意URL/无效密钥", async () => {
    const f = await fixture();
    const job = {
      revision: 1,
      dueAt: Date.now() + 60000,
      subscription: f.subscription,
    };
    expect(validateJob(job).subscription.endpoint).toContain("push.apple.com");
    for (const endpoint of [
      "http://127.0.0.1/a",
      "https://example.com/a",
      "https://web.push.apple.com.evil.com/a",
      "https://web.push.apple.com:8443/a",
    ])
      expect(() =>
        validateJob({
          ...job,
          subscription: { ...job.subscription, endpoint },
        }),
      ).toThrow();
    expect(() => validateJob({ ...job, dueAt: Date.now() - 1 })).toThrow();
    expect(() =>
      validateJob({ ...job, dueAt: Date.now() + 7200000 }),
    ).toThrow();
    expect(() =>
      validateJob({
        ...job,
        subscription: {
          ...job.subscription,
          keys: { p256dh: "bad", auth: "bad" },
        },
      }),
    ).toThrow();
    expect(validateJob({ revision: 2, dueAt: null })).toEqual({
      revision: 2,
      dueAt: null,
    });
  });
  it("新提醒覆盖旧提醒，乱序请求不能覆盖新提醒；暂停清除订阅", async () => {
    const f = await fixture(),
      time = Date.now();
    await f.post({
      revision: 1,
      dueAt: time + 90000,
      subscription: f.subscription,
    });
    await f.post({
      revision: 3,
      dueAt: time + 180000,
      subscription: f.subscription,
    });
    expect(
      (
        await f.post({
          revision: 2,
          dueAt: time + 10000,
          subscription: f.subscription,
        })
      ).stale,
    ).toBe(true);
    expect(f.getAlarm()).toBe(time + 180000);
    await f.post({ revision: 4, dueAt: null });
    expect(f.values.get("job").subscription).toBeUndefined();
    expect(f.values.get("job").status).toBe("cancelled");
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    await f.object.alarm();
    expect(send).not.toHaveBeenCalled();
  });
  it("真实生成加密Web Push和VAPID签名，到点仅发送一次并清除订阅", async () => {
    const f = await fixture();
    await f.post({
      revision: 1,
      dueAt: Date.now() - 10,
      subscription: f.subscription,
    });
    const send = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", send);
    await f.object.alarm();
    expect(send).toHaveBeenCalledOnce();
    const [url, payload] = send.mock.calls[0];
    expect(url).toBe(f.subscription.endpoint);
    expect(payload.headers["content-encoding"]).toBe("aes128gcm");
    expect(payload.headers.authorization).toMatch(/^vapid /);
    expect(payload.headers.urgency).toBe("high");
    expect(payload.headers.ttl).toBe("60");
    expect(payload.redirect).toBe("manual");
    expect(JSON.stringify(payload)).not.toContain("杠铃");
    expect(f.values.get("job").status).toBe("sent");
    expect(f.values.get("job").subscription).toBeUndefined();
    await f.object.alarm();
    expect(send).toHaveBeenCalledOnce();
  });
  it("失效订阅不重试，临时失败最多两次重试，过期通知不补发", async () => {
    const f = await fixture();
    const send = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", send);
    await f.post({
      revision: 1,
      dueAt: Date.now() - 10,
      subscription: f.subscription,
    });
    await f.object.alarm();
    expect(f.values.get("job").attempts).toBe(1);
    await f.object.alarm();
    await f.object.alarm();
    expect(send).toHaveBeenCalledTimes(3);
    expect(f.values.get("job").status).toBe("failed");
    expect(f.values.get("job").subscription).toBeUndefined();
    await f.post({
      revision: 2,
      dueAt: Date.now() - 61000,
      subscription: f.subscription,
    });
    await f.object.alarm();
    expect(send).toHaveBeenCalledTimes(3);
    send.mockImplementation(async () => new Response(null, { status: 410 }));
    await f.post({
      revision: 3,
      dueAt: Date.now() - 10,
      subscription: f.subscription,
    });
    await f.object.alarm();
    expect(f.values.get("job").status).toBe("expired");
    const job = f.values.get("job");
    job.expiresAt = Date.now() - 1;
    await f.storage.put("job", job);
    await f.object.alarm();
    expect(f.values.size).toBe(0);
    expect(f.getAlarm()).toBe(null);
  });
  it("发送期间新安排的提醒不会被旧请求的完成回调删除", async () => {
    const f = await fixture();
    await f.post({
      revision: 1,
      dueAt: Date.now() - 10,
      subscription: f.subscription,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await f.post({
          revision: 2,
          dueAt: Date.now() + 90000,
          subscription: f.subscription,
        });
        return new Response(null, { status: 201 });
      }),
    );
    await f.object.alarm();
    expect(f.values.get("job").revision).toBe(2);
    expect(f.values.get("job").status).toBe("scheduled");
  });
  it("API要求允许来源和设备凭证，不把训练记录转发至存储", async () => {
    const f = await fixture();
    const token = "x".repeat(43);
    const env = {
      ...f.env,
      REMINDERS: {
        idFromName: (x) => x,
        get: () => ({ fetch: (r) => f.object.fetch(r) }),
      },
    };
    expect(
      (await worker.fetch(new Request("https://api/public-key"), env)).status,
    ).toBe(403);
    const headers = { Origin: "https://wsx1q.github.io" };
    expect(
      (await worker.fetch(new Request("https://api/status", { headers }), env))
        .status,
    ).toBe(401);
    const response = await worker.fetch(
      new Request("https://api/reminder", {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          revision: 1,
          dueAt: Date.now() + 10000,
          subscription: f.subscription,
          workouts: "must not store",
        }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      headers.Origin,
    );
    expect(f.values.get("job").workouts).toBeUndefined();
  });
});
