import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import ts from "typescript";
import { resolve } from "node:path";
const file = "push-server/wrangler.jsonc";
const parsed = ts.parseConfigFileTextToJson(file, await readFile(file, "utf8"));
if (parsed.error) throw Error("Invalid push server configuration.");
const config = parsed.config;
const cli = resolve("node_modules/wrangler/bin/wrangler.js");
async function run(args, input, cwd = process.cwd()) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      stdio: [input ? "pipe" : "inherit", "inherit", "inherit"],
      windowsHide: true,
      cwd,
    });
    if (input) child.stdin.end(input);
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`Wrangler exited ${code}`)),
    );
  });
}
if (!config.vars.VAPID_PUBLIC_KEY) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = await crypto.subtle.exportKey("raw", pair.publicKey),
    priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
  config.vars.VAPID_PUBLIC_KEY = Buffer.from(pub).toString("base64url");
  // Store only the public key in source. The private key goes directly to Cloudflare stdin.
  await run(
    ["secret", "put", "VAPID_PRIVATE_KEY", "--config", file],
    priv.d + "\n",
  );
  await writeFile(file, JSON.stringify(config, null, 2) + "\n");
}
await run(["deploy", "--config", file]);
await run(
  [
    "pages",
    "deploy",
    "public",
    "--project-name",
    "court-rest-push-wsx1997125",
    "--branch",
    "main",
    "--commit-dirty=true",
  ],
  undefined,
  resolve("push-server/gateway"),
);
