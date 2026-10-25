import { readFileSync, writeFileSync } from 'node:fs'
const F = 'packages/runtime/src/plugin/live/team-tool-plane.mjs'
const lines = readFileSync(F, 'utf8').split('\n')
const A = 1602, B = 1658
if (!lines[A - 1].includes('const baseDefs = readExecutor === null ? defs')) throw new Error('A mismatch: ' + lines[A - 1])
if (lines[B - 1] !== '  ])') throw new Error('B mismatch: ' + lines[B - 1])
const repl = [
  '  // U6 PR2: the read row DEFINITION is the family\'s — moved VERBATIM to',
  '  // `fs-family/src/read-row.mjs` (name/description/parameters/execute',
  '  // transport/presentation face all come from the family lane; the',
  '  // takeover-spelling law keeps the Gate 0b-validated native name).',
  '  const readRowDef = readExecutor === null ? null : buildReadRowDefinition({ readName, readExecutor })',
  '  const baseDefs = readRowDef === null ? defs : Object.freeze([...defs, readRowDef])',
]
lines.splice(A - 1, B - A + 1, ...repl)
writeFileSync(F, lines.join('\n'))
console.log('ROWDEF-OK')
