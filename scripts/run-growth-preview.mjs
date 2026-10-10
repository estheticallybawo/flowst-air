import { spawn } from "node:child_process";

// A production build in Preview mode, without inherited application credentials.
const env = {};
for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE"])
  if (process.env[key]) env[key] = process.env[key];
Object.assign(env, {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  NUXT_AIR_GROWTH_PREVIEW: "true",
  NUXT_PUBLIC_AIR_GROWTH_PREVIEW: "true",
  HOST: "127.0.0.1",
  PORT: "4324",
});
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  cwd: process.cwd(), env, stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));
