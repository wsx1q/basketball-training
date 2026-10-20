import assert from "node:assert/strict";
const api = process.argv[2] ?? "https://court-rest-push-wsx1997125.pages.dev";
const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
  "base64url",
);
async function request(path, body) {
  const response = await fetch(api + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: "https://wsx1q.github.io",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://wsx1q.github.io",
  );
  return response.json();
}
const key = await request("/public-key");
assert.match(key.publicKey, /^[A-Za-z0-9_-]{87}$/);
const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const subscription = {
  endpoint: "https://web.push.apple.com/court-invalid-smoke-test",
  keys: {
    p256dh: Buffer.from(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    ).toString("base64url"),
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
      "base64url",
    ),
  },
};
let revision = Date.now();
try {
  const dueAt = Date.now() + 60000;
  assert.equal(
    (await request("/reminder", { revision, dueAt, subscription })).status,
    "scheduled",
  );
  assert.equal((await request("/status")).dueAt, dueAt);
  assert.equal(
    (await request("/reminder", { revision: revision - 1, dueAt: null })).stale,
    true,
  );
} finally {
  assert.equal(
    (await request("/reminder", { revision: ++revision, dueAt: null })).status,
    "cancelled",
  );
}
assert.equal((await request("/status")).status, "cancelled");
console.log(
  "PASS: live HTTPS key, CORS, authenticated per-device scheduling, persisted status, stale update rejection and cancellation. No notification was sent.",
);
