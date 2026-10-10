import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// Exercise the production application with normal guest auth. Data reads in the
// browser tests are intercepted fixtures; no provider/storage credentials are inherited.
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
