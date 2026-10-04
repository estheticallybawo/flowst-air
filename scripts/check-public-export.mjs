import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root,'EXPORT_MANIFEST.json'),'utf8'))
const paths = [...new Set([...manifest.files.map(f => f.path), 'EXPORT_MANIFEST.json', 'docs/generated/public-paths.txt'])].sort()
fs.writeFileSync(path.join(root,'docs/generated/public-paths.txt'), paths.map(p => ':(literal)' + p).join('\n') + '\n')
if (process.argv.includes('--paths-only')) { console.log('Generated explicit staging path list: ' + paths.length + ' files.'); process.exit(0) }
const problems = [], secretPatterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, /\bgsk_[A-Za-z0-9]{30,}\b/]
for (const f of manifest.files) {
  const resolved = path.resolve(root, f.path)
  if (!resolved.startsWith(root + path.sep) || /(?:^|\/)(?:\.git|\.aws|\.vercel|node_modules|\.output|test-results|playwright-report)(?:\/|$)/.test(f.path) || /(?:^|\/)\.env/.test(f.path) && f.path !== '.env.example') { problems.push('Disallowed export path: ' + f.path); continue }
  if (!fs.existsSync(resolved) || fs.lstatSync(resolved).isSymbolicLink()) { problems.push('Missing or symlink export: ' + f.path); continue }
  const b = fs.readFileSync(resolved)
  if (b.length !== f.bytes || crypto.createHash('sha256').update(b).digest('hex') !== f.sha256) problems.push('Manifest mismatch: ' + f.path)
  if (/\.(?:md|ts|mjs|vue|json|toml|txt|css|svg)$/.test(f.path) || f.path === '.env.example') {
    b.toString('utf8').split(/\r?\n/).forEach((line,i) => { if (secretPatterns.some(re => re.test(line))) problems.push('Potential credential at ' + f.path + ':' + (i+1) + ' (value withheld)') })
  }
}
const git = spawnSync('git', ['ls-files','--cached','--others','--exclude-standard','-z'], {cwd:root,encoding:'utf8'})
if (git.status !== 0) problems.push('Cannot compare Git candidate files')
else {
  const candidates = git.stdout.split('\0').filter(Boolean), allowed = new Set(paths)
  for (const p of candidates) if (!allowed.has(p)) problems.push('Unreviewed Git candidate: ' + p)
  for (const p of paths) if (!candidates.includes(p)) problems.push('Allowlisted file missing/ignored by Git: ' + p)
}
if (problems.length) { problems.forEach(p => console.error(p)); process.exitCode=1 }
else console.log('Public export checks passed: ' + paths.length + ' explicit files; hashes/Git candidates match; no scanned credential patterns found. Manual content and asset-rights review still required. No publication performed.')
