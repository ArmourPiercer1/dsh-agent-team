import { readFileSync, writeFileSync } from 'node:fs'
const F = 'packages/runtime/src/plugin/live/team-tool-plane.mjs'
const lines = readFileSync(F, 'utf8').split('\n')
const A = 148, B = 289 // 1-based inclusive
if (!/The read row's OWN presentation face/.test(lines[A - 1])) throw new Error('A mismatch: ' + lines[A - 1])
if (lines[B - 1] !== '}') throw new Error('B mismatch: ' + lines[B - 1])
const repl = [
  "// ── The read row's OWN presentation face MOVED (U6 PR2) ─────────────────",
  '// The Alpha.5 READ-slice presentation law (the pin639 read-envelope mirror,',
  '// the render/presentationMeta contract, the decline-on-anything-dishonest',
  '// presentResult) now lives in the FS family lane —',
  '// `packages/tools/fs-family/src/read-presentation.mjs` — placed through the',
  '// family row builder at the mount (and re-exported by plane-effect-backends',
  "// for its pinned consumers). Mirror-not-import still holds: the host module",
  '// sits behind its own public tool; the governed row\'s face is a',
  '// family-owned plugin artifact.',
]
lines.splice(A - 1, B - A + 1, ...repl)
writeFileSync(F, lines.join('\n'))
console.log('CUT-OK removed', B - A + 1, 'lines')
