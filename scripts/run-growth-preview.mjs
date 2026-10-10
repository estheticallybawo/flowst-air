import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// Exercise production authentication even with obsolete guest/auth flags enabled.
// Browser account/provider responses are explicit fixtures; server anonymous checks
// are real. No provider/storage credentials are inherited.
const env = {};
for (const key of [
  "PATH",
  "Path",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
])
  if (process.env[key]) env[key] = process.env[key];
Object.assign(env, {
  NODE_ENV: "production",
  NUXT_PUBLIC_AIRS_GUEST_ENABLED: "true",
  NUXT_PUBLIC_AUTH_REQUIRED: "false",
  NUXT_AIRS_GUEST_SECRET: randomBytes(32).toString("hex"),
  HOST: "127.0.0.1",
  PORT: "4324",
});
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
