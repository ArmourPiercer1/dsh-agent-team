// Ad-hoc (NOT committed): self-scan of the import surface of the 12 new
// P7-T5 files.
//
// v2 (this version): parses each file with the TypeScript compiler AST
// (typescript.createSourceFile) and reads ONLY real import/export
// declarations. v1 regexed the raw file text, which produced false
// positives from the synthetic POSITIVE_SAMPLE / NEGATIVE_SAMPLE string
// literals inside p7t5-no-creation-scan.test.ts (sample lines such as
// "import { readFileSync } from 'node:fs'" are DATA, not imports).
//
// Rules:
//   .ts / .d.mts — static import/export specifiers may only be `vitest`
//                  (the test shim) or intra-repo relative (`./` / `../`);
//   .mjs         — same, plus `node:` builtins (repo convention: only
//                  .mjs files may import node: builtins);
//   all files    — zero dynamic `import(...)` expressions and zero
//                  `require(...)` calls.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

console.log('# typescript ' + ts.version)

const files = [
  'packages/runtime/handoff/types.ts',
  'packages/runtime/handoff/errors.ts',
  'packages/runtime/handoff/service.ts',
  'packages/runtime/handoff/index.ts',
  'packages/runtime/test/p7t5-helpers.ts',
  'packages/runtime/test/p7t5-snapshot-once.test.ts',
  'packages/runtime/test/p7t5-source-mutate.test.ts',
  'packages/runtime/test/p7t5-target-inspect.test.ts',
  'packages/runtime/test/p7t5-failure-before-root-create.test.ts',
  'packages/runtime/test/p7t5-no-creation-scan.test.ts',
  'packages/runtime/test/p7t5-no-creation-scan.mjs',
  'packages/runtime/test/p7t5-no-creation-scan.d.mts',
]

let bad = 0
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const kind = f.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.ES2022, true, kind)
  const specs = new Set()
  for (const stmt of sf.statements) {
    let spec = null
    if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier) spec = stmt.moduleSpecifier
    else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier) spec = stmt.moduleSpecifier
    if (spec !== null && ts.isStringLiteral(spec)) specs.add(spec.text)
  }
  let dynamic = 0
  const walk = (node) => {
    if (node.kind === ts.SyntaxKind.ImportExpression) dynamic += 1
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      dynamic += 1
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  const isTs = f.endsWith('.ts') || f.endsWith('.d.mts')
  const allowed = (s) =>
    s.startsWith('./') || s.startsWith('../') || (isTs ? s === 'vitest' : s.startsWith('node:'))
  const list = [...specs].sort()
  console.log(
    f + ' :: ' + (list.length ? list.join(', ') : '(no imports)') +
      (dynamic > 0 ? ' [DYNAMIC: ' + dynamic + ']' : ''),
  )
  for (const s of list) {
    if (!allowed(s)) {
      console.log('  VIOLATION: ' + s)
      bad += 1
    }
  }
  if (dynamic > 0) {
    console.log('  VIOLATION: dynamic module loading present')
    bad += 1
  }
}
console.log(bad === 0 ? 'SPECIFIER SELF-SCAN: PASS' : 'SPECIFIER SELF-SCAN: FAIL (' + bad + ')')
