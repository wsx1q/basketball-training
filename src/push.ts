import { openDB } from "idb";
import { useCallback, useEffect, useRef, useState } from "react";

export const PUSH_API =
  import.meta.env.VITE_PUSH_API ||
  "https://court-rest-push-wsx1997125.pages.dev";
type Settings = { enabled: boolean; token: string; revision: number };
async function timed<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(Error("通知服务响应超时，请确认已更新应用并联网后重试。")),
          12000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
const database = () =>
  openDB("court-training", 1, {
    upgrade(db) {
      db.createObjectStore("app");
    },
  });
const storeSettings = async (value: Settings) => {
  await (await database()).put("app", value, "push-settings");
};
async function loadSettings(): Promise<Settings> {
  return (
    (await (await database()).get("app", "push-settings")) ?? {
      enabled: false,
      token: btoa(
        String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, ""),
      revision: 0,
    }
  );
}
export async function pushRequest(
  path: string,
  token?: string,
  body?: unknown,
) {
  const response = await fetch(`${PUSH_API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json().catch(() => {
    throw Error("提醒服务暂时不可用，请联网后重试。");
  });
  if (!response.ok) throw Error(data.error || "提醒服务连接失败。");
  return data;
}
export function isIPhoneBrowser() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return (
    ios &&
    !matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  );
}
export const pushSupported = () =>
  typeof Notification !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

export function usePushReminder(restEnd: number | null, loaded: boolean) {
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("未开启后台通知"),
    [failure, setFailure] = useState(""),
    [initialized, setInitialized] = useState(false),
    [reconnect, setReconnect] = useState(0);
  const config = useRef<Settings | null>(null),
    queue = useRef(Promise.resolve()),
    requestId = useRef(0),
    rest = useRef(restEnd);
  rest.current = restEnd;
  useEffect(() => {
    let live = true;
    loadSettings()
      .then((value) => {
        if (!live) return;
        config.current = value;
        setEnabled(value.enabled);
        setInitialized(true);
      })
      .catch(() => setFailure("无法保存通知设置，请检查浏览器存储权限。"));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const retry = () => setReconnect((n) => n + 1);
    addEventListener("online", retry);
    return () => removeEventListener("online", retry);
  }, []);
  const sync = useCallback((dueAt: number | null) => {
    const id = ++requestId.current;
    setStatus(
      dueAt && dueAt > Date.now() ? "正在安排联网提醒…" : "正在取消旧提醒…",
    );
    setFailure("");
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (id !== requestId.current || !config.current?.enabled) return;
        if (!navigator.onLine)
          throw Error("当前离线，后台提醒未同步。联网后会自动重试。");
        if (!pushSupported() || Notification.permission !== "granted")
          throw Error("通知权限不可用，请在系统设置中允许通知。");
        const registration = await timed(navigator.serviceWorker.ready);
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription)
          throw Error("通知订阅已失效，请关闭再重新开启后台通知。");
        if (id !== requestId.current) return;
        const target = dueAt && dueAt > Date.now() ? dueAt : null;
        const revision = Math.max(Date.now(), config.current.revision + 1);
        config.current = { ...config.current, revision };
        await storeSettings(config.current);
        const result = await pushRequest("/reminder", config.current.token, {
          revision,
          dueAt: target,
          ...(target ? { subscription: subscription.toJSON() } : {}),
        });
        if (id !== requestId.current) return;
        if (result.stale)
          throw Error("另一窗口已更新提醒，请刷新并只使用一个训练窗口。");
        setStatus(
          target
            ? "已安排，到点发送系统通知"
            : "后台通知已开启，勾组后自动安排",
        );
      })
      .catch((e) => {
        if (id === requestId.current) {
          setStatus("后台提醒未同步");
          setFailure(e instanceof Error ? e.message : "提醒安排失败，请重试。");
        }
      });
  }, []);
  useEffect(() => {
    if (loaded && initialized && enabled) sync(restEnd);
  }, [restEnd, enabled, loaded, initialized, reconnect, sync]);
  async function enable() {
    setFailure("");
    if (isIPhoneBrowser()) {
      setFailure("请先在 Safari 中添加到主屏幕，再从主屏幕打开并开启通知。");
      return;
    }
    if (!pushSupported()) {
      setFailure(
        "当前浏览器不支持后台推送。iPhone 请使用 iOS 16.4 或更新系统，并从主屏幕启动。",
      );
      return;
    }
    if (!navigator.onLine) {
      setFailure("开启通知需要联网。");
      return;
    }
    setBusy(true);
    try {
      // Request directly from the button gesture, before network or service-worker awaits (iOS requirement).
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw Error(
          "通知未获允许。请到 iPhone 设置 → 通知 → COURT 中开启后重试。",
        );
      const { publicKey } = await pushRequest("/public-key");
      const registration = await timed(navigator.serviceWorker.ready);
      let subscription = await registration.pushManager.getSubscription();
      const key = Uint8Array.from(
        atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      if (!subscription)
        subscription = await timed(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          }),
        );
      const settings = config.current ?? (await loadSettings());
      config.current = { ...settings, enabled: true };
      await storeSettings(config.current);
      setEnabled(true);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "开启通知失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setFailure("");
    ++requestId.current;
    try {
      const settings = config.current ?? (await loadSettings());
      config.current = {
        ...settings,
        enabled: false,
        revision: Math.max(Date.now(), settings.revision + 1),
      };
      await storeSettings(config.current);
      setEnabled(false);
      setStatus("正在关闭后台通知…");
      let cancelled = true;
      try {
        await pushRequest("/reminder", settings.token, {
          revision: config.current.revision,
          dueAt: null,
        });
      } catch {
        cancelled = false;
      }
      if ("serviceWorker" in navigator) {
        const reg = await timed(navigator.serviceWorker.ready);
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      setStatus("后台通知已关闭");
      if (!cancelled)
        setFailure(
          "未能确认服务端取消结果；已尝试退订。恢复联网后请再点“重试取消”，本地倒计时不受影响。",
        );
    } catch {
      setFailure("关闭通知未完成，请联网后重试取消。");
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    if (!config.current?.enabled) return;
    if (rest.current && rest.current > Date.now()) {
      setFailure("请先暂停当前休息计时，再测试通知，避免覆盖正式提醒。");
      return;
    }
    setBusy(true);
    setFailure("");
    ++requestId.current;
    try {
      await queue.current.catch(() => {});
      const reg = await timed(navigator.serviceWorker.ready),
        subscription = await reg.pushManager.getSubscription();
      if (!subscription) throw Error("订阅已失效，请重新开启后台通知。");
      const revision = Math.max(Date.now(), config.current.revision + 1);
      config.current = { ...config.current, revision };
      await storeSettings(config.current);
      const result = await pushRequest("/reminder", config.current.token, {
        revision,
        dueAt: Date.now() + 10000,
        subscription: subscription.toJSON(),
      });
      if (result.stale)
        throw Error("提醒已被另一窗口更新，请只使用一个训练窗口。");
      setStatus("测试已安排：现在切去看视频，约 10 秒后查看通知");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "测试发送失败。");
    } finally {
      setBusy(false);
    }
  }
  return {
    enabled,
    busy,
    status,
    failure,
    initialized,
    enable,
    disable,
    test,
    retry: () => sync(rest.current),
  };
}
