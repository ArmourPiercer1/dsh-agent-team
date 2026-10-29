const next = await import('../../../../scripts/eb3-family-boundaries.mjs')
const FIX = 'packages/tools/search-family/src/x.mjs'
const cases = [
  ['multiline literal dynamic import', "const m = await import(\n  '../../agent-control-family/src/index.mjs'\n)\n", 'cross'],
  ['template with substitution', 'const m = await import(`../../agent-control-family/src/${n}.mjs`)\n', 'computed'],
  ['template static backtick spec', 'const m = await import(`../../agent-control-family/src/index.mjs`)\n', 'cross'],
  ['prose with quotes', `export const NOTE = "do not write from 'evil' or import('evil') in prose"\n`, 'clean'],
  ['import.meta guarded', "const u = new URL('./x', import.meta.url)\n", 'clean'],
  ['side-effect import', "import '../../agent-control-family/src/index.mjs'\n", 'cross'],
  ['export-star', "export * from '../../agent-control-family/src/index.mjs'\n", 'cross'],
  ['require literal', "const r = require('../../agent-control-family/src/index.mjs')\n", 'cross'],
  ['member from not keyword', "const xs = Array.from('../../agent-control-family/src/index.mjs')\n", 'clean'],
  ['computed concat', "const prefix = '../'\nconst m = await import(prefix + 'x')\n", 'computed'],
]
let bad = 0
for (const [name, src, want] of cases) {
  const out = {}
  for (const engine of ['ast', 'regex']) {
    const f = next.checkFamilyBoundaries({ files: new Map([[FIX, src]]), engine }).findings
    const got = f.length === 0 ? 'clean' : f[0].code === 'COMPUTED_DYNAMIC_IMPORT' ? 'computed' : (f[0].detail.includes('agent-control') ? 'cross' : 'other')
    out[engine] = `${got}${f[0]?.line !== undefined ? '@L' + String(f[0].line) : ''}`
  }
  const ok = out.ast.split('@')[0] === want && out.regex.split('@')[0] === want
  if (!ok) bad++
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}: ast=${out.ast} regex=${out.regex} (want ${want})`)
}
console.log(bad === 0 ? 'ALL OK' : `${bad} BAD`)
