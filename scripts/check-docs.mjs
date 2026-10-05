import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
const files = fs.readdirSync(root).filter((f) => f.endsWith(".md"));
function walk(dir) {
  for (const item of fs.readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const p = dir + "/" + item.name;
    if (item.isDirectory()) walk(p);
    else if (p.endsWith(".md")) files.push(p);
  }
}
walk("docs");
let checked = 0,
  errors = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|app:|codex:|#)/.test(href)) continue;
    const destination = decodeURIComponent(href.split("#")[0]);
    const target = path.resolve(root, path.dirname(file), destination);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target))
      errors.push(file + ": broken/outside file link " + destination);
    checked++;
  }
}
const generated = spawnSync(
  process.execPath,
  ["scripts/generate-docs.mjs", "--check"],
  { cwd: root, encoding: "utf8" },
);
if (generated.status !== 0)
  errors.push(generated.stderr.trim() || "Generated reference check failed");
if (errors.length) {
  errors.forEach((e) => console.error(e));
  process.exitCode = 1;
} else
  console.log(
    "Documentation checks passed: " +
      files.length +
      " Markdown files, " +
      checked +
      " local file links. " +
      generated.stdout.trim(),
  );
