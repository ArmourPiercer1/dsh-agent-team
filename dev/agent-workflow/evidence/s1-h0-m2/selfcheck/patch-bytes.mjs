// Pure byte comparison against the REAL helper output (no Host): mountRows writes the profile
// patch layer; the appended config layers come from the M1 runner's exported constant.
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { DshInstance } from '../../s1-h0-m1/instance.mjs'
import { EXT_CONTRIBUTOR_ROWS } from '../../s1-h0-m1/m1-run.mjs'
import { buildPatchText, PATCH_HEADER_LINES, PROBE_ROWS } from '../m2-run.mjs'

const scratch = new URL('./patch-scratch/', import.meta.url).pathname
rmSync(scratch, { recursive: true, force: true })
const home = join(scratch, 'home')
mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
const inst = new DshInstance({ hostTree: '/nonexistent-host-tree', dshHome: home, port: 3180, clientCommitHash: '639ed01539', logDir: scratch })
inst.mountRows(PROBE_ROWS.map((r) => ({ ...r })), [...PATCH_HEADER_LINES])
const actual = readFileSync(inst.patchFile, 'utf8') + EXT_CONTRIBUTOR_ROWS
const expected = buildPatchText()
const h = (x) => createHash('sha256').update(x).digest('hex')
console.log(`mountRows_bytes=${Buffer.byteLength(actual)} buildPatchText_bytes=${Buffer.byteLength(expected)} identical=${actual === expected}`)
console.log(`actual_sha=${h(actual)}`)
console.log(`expected_sha=${h(expected)}`)
console.log('--- actual bytes ---\n' + actual + '--- end ---')
if (actual !== expected) {
  const a = actual.split('\n'); const b = expected.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) { console.log(`first diff line ${i + 1}:\n  actual  : ${JSON.stringify(a[i])}\n  expected: ${JSON.stringify(b[i])}`); break }
  process.exit(1)
}
rmSync(scratch, { recursive: true, force: true })
console.log('PATCH BYTE EQUALITY OK (scratch removed)')
