#!/usr/bin/env node
/**
 * sentinel.mjs — A5WORLD-SAFETY sentinel (2026-10-23 ruling).
 *
 * PROVES (no Host ever starts — every runtime primitive is a tripwire that
 * throws if touched) that the patched a5m2-todo-c2 entry cannot repeat the
 * 2026-10-23 incident class in a disposable fixture repository:
 *   S1 import            — importing the kit must NOT execute main
 *   S2 arg-law matrix    — missing/empty/'.'/'..'/absolute/traversal/homes-root/
 *                          nested/.worktrees/symlinked --world are all refused
 *                          BEFORE any filesystem touch
 *   S3 post-registration failure path — with a valid fresh world, a downstream
 *                          preflight failure (missing pin) performs ZERO
 *                          deletions outside the registered world (the
 *                          'df misread -> recursive teardown' class)
 *   S4 static law        — the entry contains no rmSync/rm -rf/prune/df call
 *                          sites (the preserved-source truth: teardown deletes
 *                          nothing at all); cleanup, wherever it exists, must
 *                          pass assertCleanupTarget (unit-checked here).
 *
 * Every scenario compares a full before/after manifest (path|sha256) of the
 * fixture: ANY missing path = violation; additions restricted to an explicit
 * allow-list. Usage: node sentinel.mjs <fixture-root-dir> <kit-src> <guard-src>
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, writeFileSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const [FIX, KIT_SRC, GUARD_SRC] = process.argv.slice(2)
if (!FIX || !KIT_SRC || !GUARD_SRC) { console.error('usage: sentinel.mjs <fixture> <kit-src> <guard-src>'); process.exit(2) }
const ROOT = resolve(FIX)
const violations = []
const results = []

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
function manifest(dir) {
  const out = new Map()
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isSymbolicLink()) { out.set(p, 'symlink:' + readFileSyncSafe(p)); continue }
      if (e.isDirectory()) { out.set(p, 'dir'); walk(p) } else if (e.isFile()) out.set(p, sha(p))
    }
  }
  walk(dir)
  return out
}
function readFileSyncSafe(p) { try { return readlinkSync(p) } catch { return '?' } }

function diff(before, after, allowAdd) {
  const missing = [], added = [], changed = []
  for (const [p, h] of before) { if (!after.has(p)) missing.push(relative(ROOT, p)); else if (after.get(p) !== h) changed.push(relative(ROOT, p)) }
  for (const p of after.keys()) if (!before.has(p)) added.push(relative(ROOT, p))
  const badAdd = added.filter((a) => !allowAdd.some((g) => a === g || a.startsWith(g + '/')))
  return { missing, added, badAdd, changed }
}

// ── fixture build ───────────────────────────────────────────────────────────
rmSync(ROOT, { recursive: true, force: true })
mkdirSync(join(ROOT, 'tests', 'kits', 'a5m2-todo-c2'), { recursive: true })
mkdirSync(join(ROOT, 'tests', 'kits', 'lib'), { recursive: true })
cpSync(KIT_SRC, join(ROOT, 'tests', 'kits', 'a5m2-todo-c2', 'a5m2-todo-c2.mjs'))
cpSync(GUARD_SRC, join(ROOT, 'tests', 'kits', 'lib', 'world-safety.mjs'))
// tripwire stubs: NOTHING may boot, mock, or capture
const WT = join(ROOT, '.worktrees', 'a5-m2-int')
mkdirSync(join(WT, 'tests', 'paths.d'), { recursive: true })
writeFileSync(join(WT, 'tests', 'paths.mjs'), `export const CLIENT_COMMIT_HASH='sentinel00'; export const TEST_USE_BASELINE_SHA='${'0'.repeat(40)}'\n`)
mkdirSync(join(WT, 'packages', 'tools', 'harness'), { recursive: true })
writeFileSync(join(WT, 'packages', 'tools', 'harness', 'mock-deepseek.mjs'), `export async function startMockModel(){ throw new Error('TRIPWIRE: mock must never start in sentinel runs') }\n`)
mkdirSync(join(WT, 'tests', 'characterization', 'lib'), { recursive: true })
writeFileSync(join(WT, 'tests', 'characterization', 'lib', 'instance.mjs'), `export class DshInstance{ constructor(){ throw new Error('TRIPWIRE: DshInstance must never be constructed in sentinel runs') } static rowInDump(){ return false } }\n`)
writeFileSync(join(WT, 'tests', 'characterization', 'lib', 'util.mjs'), `export function logTail(){ return '' }\nexport async function portInUse(){ return false }\nexport async function waitForPortFree(){ return true }\n`)
writeFileSync(join(WT, 'tests', 'characterization', 'lib', 'tree-clean.mjs'), `export async function captureGitState(){ throw new Error('TRIPWIRE: captureGitState must never run in sentinel runs') }\n`)
// decoys: the exact loss pattern of the incident
mkdirSync(join(WT, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib'), { recursive: true })
writeFileSync(join(WT, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib', 'bin.js'), 'DECOY-INT-BIN must survive\n')
writeFileSync(join(WT, 'tests', 'deepseek-harness-test-use', 'MUST-SURVIVE.txt'), 'decoy int file\n')
mkdirSync(join(ROOT, 'admin-decoy', 'sub'), { recursive: true })
writeFileSync(join(ROOT, 'admin-decoy', 'MUST-SURVIVE.txt'), 'decoy admin file\n')
writeFileSync(join(ROOT, 'admin-decoy', 'sub', 'MUST-SURVIVE2.txt'), 'decoy admin nested\n')
writeFileSync(join(ROOT, 'MUST-SURVIVE-REPO.txt'), 'repo root sentinel\n')
mkdirSync(join(ROOT, 'tests', 'homes', 'w-ok'), { recursive: true })
writeFileSync(join(ROOT, 'tests', 'homes', 'w-ok', 'MUST-SURVIVE-WORLD.txt'), 'registered world content\n')
mkdirSync(join(ROOT, 'tests', 'homes', 'sibling-world'), { recursive: true })
writeFileSync(join(ROOT, 'tests', 'homes', 'sibling-world', 'MUST-SURVIVE.txt'), 'sibling world\n')
symlinkSync(join(ROOT, 'admin-decoy'), join(ROOT, 'tests', 'homes', 'w-symlink'))
// pre-create the evidence ancestor chain so RUN_DIR additions are precisely measurable
mkdirSync(join(ROOT, 'dev', 'agent-workflow', 'evidence', 'a5m2-todo-c2'), { recursive: true })
const KIT = join(ROOT, 'tests', 'kits', 'a5m2-todo-c2', 'a5m2-todo-c2.mjs')

const BASE = manifest(ROOT)

function runCase(name, args, { expectFail = true, allowAdd = [] } = {}) {
  const r = spawnSync(process.execPath, [KIT, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 })
  const out = (r.stdout + '\n' + r.stderr).replace(/\033\[[0-9;]*m/g, '')
  const failed = r.status !== 0
  const after = manifest(ROOT)
  const d = diff(BASE, after, allowAdd)
  const ok = (failed === expectFail) && d.missing.length === 0 && d.badAdd.length === 0 && d.changed.length === 0 && !out.includes('TRIPWIRE')
  results.push({ case: name, exit: r.status, refusedOrExpected: failed === expectFail, deleted: d.missing, badAdds: d.badAdd, changed: d.changed, tripwire: out.includes('TRIPWIRE'), note: out.split('\n').filter((l) => /FATAL|entry-safety|imported as a module/.test(l))[0] ?? '' })
  if (!ok) violations.push(`${name}: FAIL deleted=[${d.missing.join(',')}] badAdds=[${d.badAdd.join(',')}] changed=[${d.changed.join(',')}] tripwire=${out.includes('TRIPWIRE')}`)
}

// S1 import — must not execute main
{
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify('file://' + KIT)}); console.log('IMPORT-COMPLETED-NO-MAIN')`], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 })
  const out = r.stdout + r.stderr
  const after = manifest(ROOT)
  const d = diff(BASE, after, [])
  const ok = r.status === 0 && out.includes('IMPORT-COMPLETED-NO-MAIN') && out.includes('imported as a module') && d.missing.length === 0 && d.badAdd.length === 0 && d.changed.length === 0
  results.push({ case: 'S1 import (no main)', exit: r.status, ok, deleted: d.missing, badAdds: d.badAdd, changed: d.changed })
  if (!ok) violations.push(`S1: import executed side effects or did not inert-guard: ${out.slice(0, 300)}`)
}

// S2 arg-law matrix — every row must REFUSE and delete/change nothing
const matrix = [
  ['no --world', []],
  ['empty world', ['--world', '']],
  ['dot', ['--world', '.']],
  ['dotdot', ['--world', '..']],
  ['homes root', ['--world', 'tests/homes']],
  ['homes prefix root', ['--world', 'tests/homes/']],
  ['nested path (worktree int)', ['--world', '.worktrees/a5-m2-int']],
  ['nested escaped', ['--world', 'tests/homes/../../admin-decoy']],
  ['absolute repo', ['--world', ROOT]],
  ['absolute root', ['--world', '/']],
  ['symlink world', ['--world', 'tests/homes/w-symlink']],
  ['bare dotdot name', ['--world', '..hidden']],
  ['flag-shaped', ['--world', '-rf']],
  ['backslash nested', ['--world', 'tests\\homes\\w-ok\\..\\sibling-world']],
]
for (const [name, a] of matrix) runCase(`S2 ${name}`, a, { expectFail: true })

// S3 post-registration preflight failure: valid fresh world, pin missing ->
// downstream death; ZERO deletions outside allowed evidence additions.
runCase('S3 valid-world preflight failure (pin missing)', ['--world', 'tests/homes/w-ok', '--fixture', 'todo'],
  { expectFail: true, allowAdd: ['dev/agent-workflow/evidence/a5m2-todo-c2'] })
// S3b stale world (not fresh): must die before touching world contents
runCase('S3b stale world', ['--world', 'tests/homes/w-ok', '--fixture', 'todo'],
  { expectFail: true, allowAdd: ['dev/agent-workflow/evidence/a5m2-todo-c2'] })

// S4 static law: no recursive-delete / df surface in the entry
{
  const src = readFileSync(KIT, 'utf8')
  const bad = []
  if (/rmSync\s*\(/.test(src)) bad.push('rmSync call')
  if (/rm\s+-rf/.test(src)) bad.push('rm -rf')
  if (/\bprune\b/.test(src)) bad.push('prune')
  if (/['"]df['"]|\bdf -/.test(src)) bad.push('df')
  results.push({ case: 'S4 static law (no rm/prune/df call sites)', ok: bad.length === 0, found: bad })
  if (bad.length) violations.push(`S4: forbidden delete/disk call sites: ${bad.join(',')}`)
}

// S5 guard unit: assertCleanupTarget refuses parent fallback + symlink swap
{
  const mod = await import('file://' + join(ROOT, 'tests', 'kits', 'lib', 'world-safety.mjs'))
  const { parseWorldArg, assertCleanupTarget } = mod
  const homesRoot = join(ROOT, 'tests', 'homes')
  const reg = parseWorldArg({ repoRoot: ROOT, homesRoot, worldArg: 'tests/homes/w-ok' })
  const t = []
  const check = (name, fn, wantThrow) => {
    try { fn(); t.push([name, wantThrow ? 'NO-THROW(BAD)' : 'ok']) } catch { t.push([name, wantThrow ? 'ok(threw)' : 'THREW(BAD)']) }
  }
  check('inside registered world passes', () => assertCleanupTarget({ registered: reg.homeReal, target: join(reg.homeReal, 'blueprints'), repoRoot: ROOT, homesRoot, cwd: ROOT }), false)
  check('parent fallback throws', () => assertCleanupTarget({ registered: reg.homeReal, target: homesRoot, repoRoot: ROOT, homesRoot, cwd: ROOT }), true)
  check('repo root throws', () => assertCleanupTarget({ registered: reg.homeReal, target: ROOT, repoRoot: ROOT, homesRoot, cwd: ROOT }), true)
  check('sibling world throws', () => assertCleanupTarget({ registered: reg.homeReal, target: join(homesRoot, 'sibling-world'), repoRoot: ROOT, homesRoot, cwd: ROOT }), true)
  check('no-registered throws', () => assertCleanupTarget({ registered: '', target: reg.homeReal, repoRoot: ROOT, homesRoot, cwd: ROOT }), true)
  const bad5 = t.filter(([, v]) => v.includes('BAD'))
  results.push({ case: 'S5 guard units (no-parent-fallback)', ok: bad5.length === 0, detail: Object.fromEntries(t) })
  if (bad5.length) violations.push(`S5: ${JSON.stringify(bad5)}`)
}

const finalManifest = manifest(ROOT)
const finalDiff = diff(BASE, finalManifest, ['dev/agent-workflow/evidence/a5m2-todo-c2'])
const report = { at: new Date().toISOString(), root: ROOT, scenarios: results, finalDeleted: finalDiff.missing, finalChanged: finalDiff.changed, finalBadAdds: finalDiff.badAdd, violations, verdict: violations.length === 0 && finalDiff.missing.length === 0 ? 'PASS — ZERO out-of-bounds deletion' : 'FAIL' }
writeFileSync(join(dirname(ROOT), 'sentinel-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exit(report.verdict.startsWith('PASS') ? 0 : 1)
