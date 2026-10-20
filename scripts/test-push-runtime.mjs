import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(
  realpathSync("node_modules/wrangler/package.json"),
);
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const esbuild = require("esbuild");
const source = (await readFile("push-server/worker.js", "utf8")).replace(
  /} catch \{\s*retry = true;/g,
  "} catch (error) { console.error(error.name, error.message); retry = true;",
);
const bundle = await esbuild.build({
  stdin: {
    contents: source,
    resolveDir: resolve("push-server"),
    sourcefile: "worker.js",
  },
  bundle: true,
  format: "esm",
  write: false,
  platform: "browser",
});
const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const pub = Buffer.from(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  ).toString("base64url"),
  priv = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d;
const subscription = {
  endpoint: "https://web.push.apple.com/test",
  keys: {
    p256dh: pub,
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
      "base64url",
    ),
  },
};
let sends = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: "2026-10-19",
        bindings: { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv },
        durableObjects: {
          REMINDERS: { className: "RestReminder", useSQLite: true },
        },
        outboundService: async (request) => {
          sends++;
          assert.equal(request.headers.get("content-encoding"), "aes128gcm");
          assert.equal(request.headers.get("urgency"), "high");
          assert.equal((await request.arrayBuffer()).byteLength, 4096);
          return new Response(null, { status: 201 });
        },
      },
    ],
  }),
);
const headers = {
  Origin: "https://wsx1q.github.io",
  Authorization: "Bearer " + "t".repeat(43),
};
async function request(path, body) {
  const response = await mf.dispatchFetch("https://test" + path, {
    headers,
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, 200);
  return response.json();
}
try {
  await request("/reminder", {
    revision: 1,
    dueAt: Date.now() + 1000,
    subscription,
  });
  let status;
  for (let i = 0; i < 80; i++) {
    status = await request("/status");
    if (status.status === "sent" || status.status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(
    status.status,
    "sent",
    `Alarm status ${status.status}, sends ${sends}`,
  );
  assert.equal(sends, 1);
  await request("/reminder", {
    revision: 2,
    dueAt: Date.now() + 1000,
    subscription,
  });
  await request("/reminder", { revision: 3, dueAt: null });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(sends, 1);
  console.log(
    "PASS: Workers runtime, SQLite alarm, encrypted Web Push, and cancellation prevented second send.",
  );
} finally {
  await mf.dispose();
}
