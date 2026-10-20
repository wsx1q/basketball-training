/* Imported by the generated Workbox service worker, including when the app is closed. */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data?.json() ?? {};
      } catch {}
      await self.registration.showNotification("COURT · 休息结束", {
        body: "准备好下一组，点击返回训练。",
        icon: new URL("icon-192.png", self.registration.scope).href,
        badge: new URL("icon-192.png", self.registration.scope).href,
        tag: typeof payload.tag === "string" ? payload.tag : "court-rest",
        data: { url: self.registration.scope },
      });
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows)
        client.postMessage({ type: "COURT_REST_PUSH", dueAt: payload.dueAt });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = self.registration.scope;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) => client.url.startsWith(url));
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "COURT_OPEN_TRAINING" });
      } else await self.clients.openWindow(url);
    })(),
  );
});
