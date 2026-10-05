import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// No dotenv or application config. Only Node/OS necessities and a dedicated optional read token.
const env = Object.fromEntries(
  [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "AIR_GITHUB_READ_TOKEN",
    "AMINA_GITHUB_READ_TOKEN",
  ]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
const child = spawn(
  process.execPath,
  ["--import", "tsx", "mcp/github-study.ts", "--stdio"],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
child.on("error", () => {
  process.stderr.write(
    "Unable to start the GitHub Study MCP. Run npm ci first.\n",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
