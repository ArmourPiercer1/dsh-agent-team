/**
 * mutation-proof-round1.mjs — review round 1 (2026-10-28): every fix gets exactly
 * one mutation, and each mutation must be KILLED by the leg added for it.
 *
 * The mutations are applied to the IMPLEMENTATION only (never to a test), each
 * file is restored from an in-memory byte copy, and the restore is verified by
 * sha256 before the next mutation runs. A mutation that survives is reported and
 * the script exits non-zero — a green suite after a mutation means the new leg
 * does not actually pin the fix.
 *
 *   F8  the CLI's fail-closed exit code                      → T18
 *   F5  the provisioning-source trust gate                   → T19
 *   F6  the pre-write write-scope validation                 → T20
 *   F7  the pinned mode (apply + verify)                     → T21
 *   F1  the pre-flight record brand                          → T15 / T16 / T22
 *
 * Run: node dev/agent-workflow/evidence/u7-sbx-20261028/mutation-proof-round1.mjs
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const SUITE = 'tests/world-factory/host-sandbox-assets.test.mjs'
const CLI = 'tests/world-factory/provision-host-sandbox.mjs'
const LIB = 'tests/world-factory/lib/host-sandbox-assets.mjs'

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

const MUTATIONS = [
  {
    id: 'F8', file: CLI, legs: 'T18',
    what: 'the FAIL-CLOSED printer exits 1 (the code the CLI documents as "environment")',
    from: '  process.exit(2)\n}',
    to: '  process.exit(1)\n}',
  },
  {
    id: 'F5', file: LIB, legs: 'T19',
    what: 'the source-tree trust gate is not applied (the pre-F5 behaviour: any path, imported for layout)',
    from: '  src.realTree = assertTrustedSourceTree(src.tree, { repoRoot }).realTree',
    to: '  src.realTree = resolve(src.tree) // MUTANT: trust gate removed',
  },
  {
    id: 'F6', file: LIB, legs: 'T20',
    what: 'the pre-write path validation is skipped (only the post-publish bin/ check remains)',
    from: '  for (const rel of [...relPaths, pinned.launcher]) {',
    to: '  for (const rel of [...relPaths, pinned.launcher].filter((r) => manifestAssetPathIsSafe(r))) { // MUTANT: hostile keys skip the pre-write check',
  },
  {
    id: 'F7', file: LIB, legs: 'T21',
    what: 'the staged file is chmodded to a hardcoded 0o755 instead of the pinned mode',
    from: '      chmodSync(stage, f.modeBits)',
    to: '      chmodSync(stage, 0o755) // MUTANT: pinned mode ignored',
  },
  {
    id: 'F1', file: LIB, legs: 'T15, T16, T22',
    what: 'isSandboxPreflightRecord accepts any matching SHAPE (the pre-F1 behaviour: a forgery opens ENV_BLOCK)',
    from: '  if (!PREFLIGHT_RECORDS.has(value)) return false\n',
    to: '  // MUTANT: brand check removed\n',
  },
]

const runSuite = () => {
  const r = spawnSync(process.execPath, ['--test', SUITE], { cwd: REPO, encoding: 'utf8' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const num = (k) => Number(String(out.match(new RegExp(`\\u2139\\s+${k}\\s+(\\d+)`))?.[1] ?? '?'))
  const failed = [...out.matchAll(/^✖ (T\d+)/gm)].map((m) => m[1])
  return { status: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), failed: [...new Set(failed)].sort() }
}

const baseline = runSuite()
console.log(`baseline suite    : tests=${baseline.tests} pass=${baseline.pass} fail=${baseline.fail} (exit ${baseline.status})`)
if (baseline.fail !== 0) { console.error('refusing to mutate: the suite is not green to begin with'); process.exit(2) }

const originals = new Map()
const results = []
for (const m of MUTATIONS) {
  if (!originals.has(m.file)) originals.set(m.file, readFileSync(join(REPO, m.file), 'utf8'))
  const source = originals.get(m.file)
  const hits = source.split(m.from).length - 1
  if (hits !== 1) {
    results.push({ ...m, error: `anchor matched ${hits} times, expected exactly 1` })
    continue
  }
  writeFileSync(join(REPO, m.file), source.replace(m.from, m.to))
  const run = runSuite()
  // restore from the byte copy and prove the restore is exact
  writeFileSync(join(REPO, m.file), source)
  const restored = readFileSync(join(REPO, m.file), 'utf8')
  const restoreOk = sha(restored) === sha(source)
  results.push({ ...m, run, restoreOk })
  console.log(`${m.id.padEnd(3)} ${m.file.split('/').pop().padEnd(28)} fail=${String(run.fail).padStart(2)} killed=${run.fail > 0} legs=[${run.failed.join(',')}] restored=${restoreOk ? 'sha-ok' : 'DRIFT'}`)
  console.log(`    mutation      : ${m.what}`)
}

const after = runSuite()
console.log(`suite after revert: tests=${after.tests} pass=${after.pass} fail=${after.fail} (exit ${after.status})`)

let bad = 0
for (const r of results) {
  if (r.error) { console.log(`!! ${r.id}: ${r.error}`); bad += 1; continue }
  if (r.run.fail === 0) { console.log(`!! ${r.id}: MUTATION SURVIVED — the new leg does not pin the fix`); bad += 1 }
  if (!r.restoreOk) { console.log(`!! ${r.id}: restore drift after revert`); bad += 1 }
}
const expected = { F8: 'T18', F5: 'T19', F6: 'T20', F7: 'T21', F1: 'T22' }
for (const r of results) {
  if (r.error) continue
  const want = expected[r.id]
  if (!r.run.failed.includes(want)) { console.log(`!! ${r.id}: the leg that must die is ${want}; killed [${r.run.failed.join(',')}]`); bad += 1 }
}
console.log(bad === 0 ? `MUTATION-PROOF pass: ${results.length}/${results.length} mutations killed, every new leg died, suite restored to ${after.pass}/${after.tests}` : `MUTATION-PROOF FAIL: ${bad} problem(s)`)
process.exit(bad === 0 ? 0 : 1)
