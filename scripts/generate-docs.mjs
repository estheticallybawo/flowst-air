import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from 'typescript'
const root = path.resolve(import.meta.dirname, '..')
const inputs = ['server/services/studyRepository.ts', 'server/services/sources/store.ts', 'server/services/airsContext.ts']
const rows = [], fingerprints = []
const cell = value => '<code>' + value.replace(/\s+/g, ' ').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;') + '</code>'
for (const file of inputs) {
  const content = fs.readFileSync(path.join(root, file), 'utf8')
  fingerprints.push('- ' + file + ': ' + crypto.createHash('sha256').update(content).digest('hex'))
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const fields = new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(source).replace(/^['"]|['"]$/g, ''), p.initializer.getText(source)]))
      if (fields.has('pk') && fields.has('sk')) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        rows.push('| [' + file + ':' + line + '](../../' + file + '#L' + line + ') | ' + cell(fields.get('pk')) + ' | ' + cell(fields.get('sk')) + ' | ' + cell(['gsi2pk','gsi2sk'].filter(k => fields.has(k)).map(k => k + '=' + fields.get(k)).join('; ') || 'Not present in this object') + ' |')
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const text = ['# Generated storage access-pattern catalog', '', 'Status: static extraction of current code, not deployed table introspection or a complete physical schema. Regenerate with npm run docs:generate; do not hand-edit.', '', 'Application table uses pk/sk. Owner listing uses GSI2 where shown in code. Draft retention uses expiresAt; expiry units and application checks must be read in each record implementation. This catalog does not infer TTL policy or cloud provisioning from field names.', '', 'Proposed Kai/longitudinal entities are not added here unless implemented in these modules. Extraction parses TypeScript without executing application code, accessing credentials or calling a provider.', '', '| Source location | Partition key | Sort key | Index fields on same object |', '| --- | --- | --- | --- |', ...rows, '', '## Source fingerprints', '', ...fingerprints, ''].join('\n')
const target = path.join(root, 'docs/generated/db-schema.md')
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) { console.error('Generated storage reference is stale. Run npm run docs:generate.'); process.exitCode = 1 }
  else console.log('Generated storage reference is current (' + rows.length + ' key objects).')
} else { fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, text); console.log('Generated storage reference: ' + rows.length + ' key objects.') }
