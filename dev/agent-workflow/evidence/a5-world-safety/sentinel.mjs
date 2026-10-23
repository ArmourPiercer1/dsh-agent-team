#!/usr/bin/env node
/**
 * sentinel.mjs (v2) — A5 world-safety sentinel, root-1805-BLOCK remediation.
 *
 * Changes vs v1 (root 1805 independent review):
 *   - NEVER rmSync()s a caller-supplied path: the fixture lives in a fresh
 *     mkdtemp directory THIS run exclusively creates (and leaves for patrol).
 *   - adds the real legs the v1 suite lacked: import-with-invalid-CLI-argv
 *     (must not execute main AND must not exit the importer), cleanup-time
 *     cross-sibling ancestor symlink, prefix-lookalike (w-1 vs w-10), dangling
 *     chain, registered-directory replacement (dev/ino identity drift), a
 *     .worktrees-segmented homes root, launcher FOREIGN-LOCK leg (fixed
 *     launcher must leave a foreign lock byte-identical; v1 deleted it),
 *     pre-acquisition failure (zero cleanup), and a REAL init-failure teardown
 *     leg (boot hits the mock tripwire; only this run's own acquired lock is
 *     removed; DshInstance tripwire must never fire).
 *   - HONEST SCOPE: kit S3 is "downstream failure swallowed by main().catch —
 *     teardown never executed". v1's claim that this was df-equivalent and of
 *     a stale-world branch (S3b) is RETIRED: the kit's dieFatal/stale path is
 *     UNREACHABLE in a fixture (pinned tgz sha cannot be forged); freshness/
 *     lock/teardown coverage now runs on the LAUNCHER entry (L5–L7) with a
 *     disposable git shim; boot primitives are tripwires everywhere.
 *
 * Modes:  node sentinel.mjs <fixture-parent-dir> <entry-src> <guard-src> [--entry kit|launcher]
 * Verdict: PASS only if every scenario holds AND the final manifest has ZERO
 * deletions/changes outside the allow-list prefixes.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, cpSync, mkdirSync, writeFileSync, readFileSync, readdirSync, readlinkSync, mkdtempSync, rmSync, symlinkSync, renameSync, rmdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const em = argv.indexOf('--entry')
const entryMode = em === -1 ? 'kit' : argv[em + 1]
const pos = em === -1 ? argv : argv.filter((_, i) => i !== em && i !== em + 1)
const [FIX_PARENT, SRC_SRC, GUARD_SRC] = pos
if (!FIX_PARENT || !SRC_SRC || !GUARD_SRC || !['kit', 'launcher'].includes(entryMode)) {
  console.error('usage: sentinel.mjs <fixture-parent> <entry-src> <guard-src> [--entry kit|launcher]')
  process.exit(2)
}
// EXCLUSIVE fixture: fresh mkdtemp created by THIS run; nothing pre-deleted.
const ROOT = mkdtempSync(join(resolve(FIX_PARENT), 'fixture-'))
const violations = []
const results = []

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
function manifest(dir) {
  const out = new Map()
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isSymbolicLink()) { try { out.set(p, 'symlink:' + readlinkSync(p)) } catch { out.set(p, 'symlink:?') } continue }
      if (e.isDirectory()) { out.set(p, 'dir'); walk(p) } else if (e.isFile()) out.set(p, sha(p))
    }
  }
  walk(dir)
  return out
}
function diff(before, after, allowAdd) {
  const allowed = (p) => allowAdd.some((g) => p === g || p.startsWith(g + '/'))
  const missing = [], added = [], changed = []
  for (const [p, h] of before) {
    const rel = relative(ROOT, p)
    if (!after.has(p)) missing.push(rel)
    else if (after.get(p) !== h && !allowed(rel)) changed.push(rel)
  }
  for (const p of after.keys()) if (!before.has(p)) added.push(relative(ROOT, p))
  const badAdd = added.filter((a) => !allowed(a))
  return { missing, added, badAdd, changed }
}
function rmTree(p) { // NEVER follows symlinks; only for fixture dirs this run created
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const q = join(p, e.name)
    if (e.isSymbolicLink()) rmSync(q)
    else if (e.isDirectory()) rmTree(q)
    else rmSync(q)
  }
  rmdirSync(p)
}

// ── fixture build ───────────────────────────────────────────────────────────
const SRC_ABS = resolve(SRC_SRC)
const HOMES = join(ROOT, 'tests', 'homes')
const WT = join(ROOT, '.worktrees', 'a5-m2-int')
const EV = join(ROOT, 'dev', 'agent-workflow', 'evidence')
mkdirSync(join(ROOT, 'tests', 'kits', 'a5m2-todo-c2'), { recursive: true })
mkdirSync(join(ROOT, 'tests', 'kits', 'lib'), { recursive: true })
mkdirSync(join(EV, 'a5m2-todo-c2'), { recursive: true })
mkdirSync(join(EV, 'apar'), { recursive: true })
mkdirSync(join(EV, 'apar-ev'), { recursive: true })
mkdirSync(join(ROOT, 'bin'), { recursive: true })
if (entryMode === 'kit') cpSync(SRC_ABS, join(ROOT, 'tests', 'kits', 'a5m2-todo-c2', 'a5m2-todo-c2.mjs'))
else cpSync(SRC_ABS, join(EV, 'apar', 'launch-world-infra.mjs'))
cpSync(resolve(GUARD_SRC), join(ROOT, 'tests', 'kits', 'lib', 'world-safety.mjs'))
const ENTRY_FILE = entryMode === 'kit' ? join(ROOT, 'tests', 'kits', 'a5m2-todo-c2', 'a5m2-todo-c2.mjs') : join(EV, 'apar', 'launch-world-infra.mjs')
writeFileSync(join(ROOT, 'import-probe.mjs'), `try { await import(${JSON.stringify('file://' + ENTRY_FILE)}); console.log('IMPORT-RESOLVED') } catch (e) { console.log('IMPORT-THREW:' + String(e?.message ?? e)) }\n`)
// tripwire stubs (worktree-level + repo-level): nothing may ever boot/mock/capture
const TW = {
  paths: `export const CLIENT_COMMIT_HASH='sentinel00'; export const TEST_USE_BASELINE_SHA='${'0'.repeat(40)}'\n`,
  mock: `export async function startMockModel(){ throw new Error('TRIPWIRE: mock must never start in sentinel runs') }\n`,
  instance: `export class DshInstance{ constructor(){ throw new Error('TRIPWIRE: DshInstance must never be constructed in sentinel runs') } static rowInDump(){ return false } }\n`,
  util: `export function logTail(){ return '' }\nexport async function portInUse(){ return false }\nexport async function waitForPortFree(){ return true }\n`,
  treeclean: `export async function captureGitState(){ throw new Error('TRIPWIRE: captureGitState must never run in sentinel runs') }\n`,
}
for (const base of [join(WT, 'tests', 'characterization', 'lib'), join(ROOT, 'tests', 'characterization', 'lib')]) {
  mkdirSync(base, { recursive: true })
  writeFileSync(join(base, 'instance.mjs'), TW.instance)
  writeFileSync(join(base, 'util.mjs'), TW.util)
  writeFileSync(join(base, 'tree-clean.mjs'), TW.treeclean)
}
mkdirSync(join(WT, 'tests'), { recursive: true }); writeFileSync(join(WT, 'tests', 'paths.mjs'), TW.paths)
mkdirSync(join(WT, 'packages', 'tools', 'harness'), { recursive: true }); writeFileSync(join(WT, 'packages', 'tools', 'harness', 'mock-deepseek.mjs'), TW.mock)
mkdirSync(join(ROOT, 'packages', 'tools', 'harness'), { recursive: true }); writeFileSync(join(ROOT, 'packages', 'tools', 'harness', 'mock-deepseek.mjs'), TW.mock)
if (entryMode === 'launcher') {
  // disposable git shim: the launcher's HEAD wall is a hard product pin a fixture
  // can never hash-match; the shim passes THAT wall so freshness/lock/teardown
  // legs actually execute. Product code unchanged; shim lives only in this fixture.
  writeFileSync(join(ROOT, 'bin', 'git'), `#!/bin/sh\ncase "$*" in\n *"rev-parse HEAD"*) echo 639ed015397290b3745d163aafe02ffee4aa3f84; exit 0;;\n *"status --porcelain"*) exit 0;;\nesac\nexec /usr/bin/git "$@"\n`)
  chmodSync(join(ROOT, 'bin', 'git'), 0o755)
}
// decoys: the exact loss pattern of the incident
mkdirSync(join(WT, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib'), { recursive: true })
writeFileSync(join(WT, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib', 'bin.js'), 'DECOY-INT-BIN must survive\n')
writeFileSync(join(WT, 'tests', 'deepseek-harness-test-use', 'MUST-SURVIVE.txt'), 'decoy int file\n')
mkdirSync(join(ROOT, 'admin-decoy', 'sub'), { recursive: true })
writeFileSync(join(ROOT, 'admin-decoy', 'MUST-SURVIVE.txt'), 'decoy admin file\n')
writeFileSync(join(ROOT, 'admin-decoy', 'sub', 'MUST-SURVIVE2.txt'), 'decoy admin nested\n')
writeFileSync(join(ROOT, 'MUST-SURVIVE-REPO.txt'), 'repo root sentinel\n')
mkdirSync(HOMES, { recursive: true })
mkdirSync(join(HOMES, 'sibling-world'), { recursive: true })
writeFileSync(join(HOMES, 'sibling-world', 'MUST-SURVIVE.txt'), 'sibling world\n')
symlinkSync(join(ROOT, 'admin-decoy'), join(HOMES, 'w-symlink'))
const mountStub = (w) => {
  for (const p of [
    join(w, 'install-249eb65ec', 'package', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
    join(w, 'install-249eb65ec', 'package', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
    join(w, 'install-249eb65ec', 'package', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
    join(w, 'mount-helper-root', 'package', 'packages', 'tools', 'harness', 'plugin.mjs'),
  ]) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, 'mount stub\n') }
  writeFileSync(join(w, 'MUST-SURVIVE-WORLD.txt'), 'registered world content\n')
}
mkdirSync(join(HOMES, 'w-ok'), { recursive: true }); mountStub(join(HOMES, 'w-ok'))
if (entryMode === 'launcher') {
  // FOREIGN lock decoy: the launcher must refuse AND leave it byte-identical
  writeFileSync(join(HOMES, 'w-ok.lock'), JSON.stringify({ world: 'foreign-owner', pid: 999999, note: 'decoy foreign lock — must survive byte-identical' }, null, 2))
  mkdirSync(join(HOMES, 'w-stale', 'storages'), { recursive: true }); mountStub(join(HOMES, 'w-stale'))
  mkdirSync(join(HOMES, 'w-run'), { recursive: true }); mountStub(join(HOMES, 'w-run'))
}
const BASE = manifest(ROOT)

const LAUNCH_ENV = entryMode === 'launcher' ? { ...process.env, PATH: join(ROOT, 'bin') + ':' + process.env.PATH } : process.env
const EV_ALLOW = entryMode === 'kit' ? ['dev/agent-workflow/evidence/a5m2-todo-c2'] : ['dev/agent-workflow/evidence/apar-ev']
const BASE_ARGS = entryMode === 'kit' ? [] : ['--lane', 'wl', '--host-port', '3991', '--mock-port', '3992', '--nonce', '9001', '--evidence', 'dev/agent-workflow/evidence/apar-ev']

function runCase(name, args, { expectFail = true, allowAdd = [], expectTripwire = null, env = null } = {}) {
  const r = spawnSync(process.execPath, [ENTRY_FILE, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 90_000, env: env ?? LAUNCH_ENV })
  const out = (r.stdout + '\n' + r.stderr).replace(/\033\[[0-9;]*m/g, '')
  const failed = r.status !== 0
  const d = diff(BASE, manifest(ROOT), allowAdd)
  const tw = out.includes('TRIPWIRE')
  const twOk = expectTripwire === null ? !tw : out.includes(expectTripwire)
  const noBoot = !out.includes('TRIPWIRE: DshInstance')
  const ok = (failed === expectFail) && d.missing.length === 0 && d.badAdd.length === 0 && d.changed.length === 0 && twOk && noBoot
  results.push({ case: name, exit: r.status, refusedOrExpected: failed === expectFail, deleted: d.missing, badAdds: d.badAdd, changed: d.changed, tripwireExpected: expectTripwire, tripwireSeen: tw, note: out.split('\n').filter((l) => /FATAL|entry-safety|locked|fresh|SHUTDOWN/.test(l))[0]?.slice(0, 160) ?? '' })
  if (!ok) violations.push(`${name}: FAIL deleted=[${d.missing.join(',')}] badAdds=[${d.badAdd.join(',')}] changed=[${d.changed.join(',')}] tw=${tw}(expect ${expectTripwire})`)
}

// S1 import with INVALID CLI argv — must neither execute main nor exit the importer
{
  const r = spawnSync(process.execPath, [join(ROOT, 'import-probe.mjs'), '--fixture', 'bogus', '--world', '..'], { cwd: ROOT, encoding: 'utf8', timeout: 90_000, env: LAUNCH_ENV })
  const out = r.stdout + r.stderr
  const d = diff(BASE, manifest(ROOT), [])
  const resolvedCleanly = entryMode === 'kit' ? out.includes('IMPORT-RESOLVED') : out.includes('IMPORT-THREW:launch-world-infra')
  const inert = out.includes('imported as a module')
  const ok = r.status === 0 && resolvedCleanly && inert && d.missing.length === 0 && d.badAdd.length === 0 && d.changed.length === 0
  results.push({ case: `S1 import + invalid argv [${entryMode}] (no main, no exit, zero fs)`, exit: r.status, ok, deleted: d.missing, badAdds: d.badAdd, changed: d.changed, out: out.slice(0, 220) })
  if (!ok) violations.push(`S1: import not inert/catchable with invalid argv: rc=${r.status} ${out.slice(0, 300)}`)
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
for (const [name, a] of matrix) runCase(`S2 ${name}`, [...BASE_ARGS, ...a], { expectFail: true })

if (entryMode === 'kit') {
  // S3 (HONEST SCOPE): downstream preflight failure after RUN_DIR creation; the
  // throw is swallowed by main().catch — dieFatal/teardown NEVER runs in a
  // fixture. Proven: failure path is non-destructive (zero deletions, additions
  // only under the run dir). v1's teardown/df-equivalence + S3b claims are RETIRED.
  runCase('S3 downstream failure via main().catch (NO teardown executed; df/stale claim retired)', ['--world', 'tests/homes/w-ok', '--fixture', 'todo'],
    { expectFail: true, allowAdd: ['dev/agent-workflow/evidence/a5m2-todo-c2'] })
} else {
  for (const [which, p] of [['host-port', 3080], ['host-port', 3180], ['host-port', 3181], ['host-port', 3182], ['host-port', 3186], ['mock-port', 3497], ['mock-port', 3500]]) {
    const base = [...BASE_ARGS, '--world', 'tests/homes/w-run']
    base[which === 'host-port' ? 3 : 5] = String(p)
    runCase(`L3 forbidden ${which} ${p}`, base, { expectFail: true })
  }
  // L4 (no shim): the provenance wall itself stands — HEAD mismatch dies before
  // lock acquisition, zero cleanup, zero out-of-bounds writes.
  runCase('L4 provenance wall (HEAD mismatch, no shim): fatal pre-acquisition', [...BASE_ARGS, '--world', 'tests/homes/w-run'],
    { expectFail: true, allowAdd: EV_ALLOW, env: { ...process.env, PATH: '/usr/bin:/bin' } })
  runCase('L5 foreign lock: fatal, foreign lock UNTOUCHED (acquisition discipline)', [...BASE_ARGS, '--world', 'tests/homes/w-ok'],
    { expectFail: true, allowAdd: EV_ALLOW })
  runCase('L6 not-fresh world: fatal before acquisition, no lock created', [...BASE_ARGS, '--world', 'tests/homes/w-stale'],
    { expectFail: true, allowAdd: EV_ALLOW })
  runCase('L7 acquired lock + boot-tripwire teardown (own lock removed, no DshInstance)', [...BASE_ARGS, '--world', 'tests/homes/w-run'],
    { expectFail: true, allowAdd: [...EV_ALLOW, 'tests/homes/w-run'], expectTripwire: 'TRIPWIRE: mock' })
}

// S4 static law: no recursive-delete / df surface in the entry
{
  const src = readFileSync(ENTRY_FILE, 'utf8')
  const bad = []
  if (entryMode === 'kit') {
    if (/rmSync\s*\(/.test(src)) bad.push('rmSync call')
  } else {
    for (const line of src.split('\n').filter((l) => /rmSync\s*\(/.test(l))) {
      if (!/lockOwned/.test(line) || !/stateOwned/.test(line)) bad.push(`rmSync outside acquisition flags: ${line.trim()}`)
    }
  }
  if (/rmSync\([^)]*recursive:\s*true/.test(src) || /rmdirSync\([^)]*recursive/.test(src)) bad.push('recursive DELETE flag')
  if (/rm\s+-rf/.test(src)) bad.push('rm -rf')
  if (/\bprune\b/.test(src)) bad.push('prune')
  if (/['"]df['"]|\bdf -/.test(src)) bad.push('df')
  results.push({ case: `S4 static law (${entryMode}: delete sites gated/absent; no prune/df)`, ok: bad.length === 0, found: bad })
  if (bad.length) violations.push(`S4: ${bad.join(' | ')}`)
}

// S5 guard units (in-process; disposable w-unit* worlds under allow-listed prefix)
{
  const { parseWorldArg, assertCleanupTarget } = await import('file://' + join(ROOT, 'tests', 'kits', 'lib', 'world-safety.mjs'))
  const CTX = { repoRoot: ROOT, homesRoot: HOMES, cwd: ROOT }
  const t = []
  const check = (name, fn, wantThrow) => {
    try { fn(); t.push([name, wantThrow ? 'NO-THROW(BAD)' : 'ok']) } catch (e) { t.push([name, wantThrow ? 'ok(threw)' : `THREW(BAD):${String(e?.message).slice(0, 90)}`]) }
  }
  check('parent fallback throws', () => assertCleanupTarget({ registered: join(HOMES, 'w-ok'), target: HOMES, ...CTX }), true)
  check('repo root throws', () => assertCleanupTarget({ registered: join(HOMES, 'w-ok'), target: ROOT, ...CTX }), true)
  check('sibling world throws', () => assertCleanupTarget({ registered: join(HOMES, 'w-ok'), target: join(HOMES, 'sibling-world'), ...CTX }), true)
  check('no-registered throws', () => assertCleanupTarget({ registered: '', target: join(HOMES, 'w-ok'), ...CTX }), true)
  mkdirSync(join(HOMES, 'w-unit1'), { recursive: true }); mkdirSync(join(HOMES, 'w-unit10'), { recursive: true })
  const r1 = parseWorldArg({ ...CTX, worldArg: 'w-unit1' })
  check('inside registered passes', () => assertCleanupTarget({ registered: r1.homeReal, identity: r1.identity, target: join(r1.homeReal, 'blueprints'), ...CTX }), false)
  check('prefix-lookalike sibling (w-unit10 vs w-unit1) throws', () => assertCleanupTarget({ registered: r1.homeReal, identity: r1.identity, target: join(HOMES, 'w-unit10'), ...CTX }), true)
  symlinkSync(join(HOMES, 'nope-none'), join(HOMES, 'w-unit-dangling'))
  check('dangling symlink world parse throws', () => parseWorldArg({ ...CTX, worldArg: 'w-unit-dangling' }), true)
  const r2 = parseWorldArg({ ...CTX, worldArg: 'w-unit1' })
  renameSync(join(HOMES, 'w-unit1'), join(HOMES, 'w-unit1-moved'))
  symlinkSync(join(HOMES, 'sibling-world'), join(HOMES, 'w-unit1'))
  check('world swapped to sibling symlink: cleanup throws', () => assertCleanupTarget({ registered: r2.homeReal, identity: r2.identity, target: join(r2.homeReal, 'blueprints'), ...CTX }), true)
  rmSync(join(HOMES, 'w-unit1')) // unlink the SYMLINK only — never follow it
  rmTree(join(HOMES, 'w-unit1-moved'))
  mkdirSync(join(HOMES, 'w-unit3'), { recursive: true })
  const r3 = parseWorldArg({ ...CTX, worldArg: 'w-unit3' })
  const rSib = parseWorldArg({ ...CTX, worldArg: 'sibling-world' })
  check('identity drift (deterministic: foreign identity vs this path) throws', () => assertCleanupTarget({ registered: r3.homeReal, identity: rSib.identity, target: join(r3.homeReal, 'sub'), ...CTX }), true)
  rmdirSync(join(HOMES, 'w-unit3'))
  const t0 = Date.now(); while (Date.now() - t0 < 5) { /* ensure ctimeMs crosses */ }
  mkdirSync(join(HOMES, 'w-unit3')) // same path, brand-new dir (inode may even be recycled; ctime/identity must catch it)
  check('registered dir replaced (recreated same path) throws', () => assertCleanupTarget({ registered: r3.homeReal, identity: r3.identity, target: join(r3.homeReal, 'sub'), ...CTX }), true)
  check('.worktrees-segmented homes root refused', () => parseWorldArg({ ...CTX, worldArg: 'x', homesRoot: join(WT, 'tests', 'homes') }), true)
  const bad5 = t.filter(([, v]) => v.includes('BAD'))
  results.push({ case: 'S5 guard units (strict containment / identity / dangling / .worktrees)', ok: bad5.length === 0, detail: Object.fromEntries(t) })
  if (bad5.length) violations.push(`S5: ${JSON.stringify(bad5)}`)
}

const finalDiff = diff(BASE, manifest(ROOT), [...EV_ALLOW, 'tests/homes/w-unit1', 'tests/homes/w-unit10', 'tests/homes/w-unit3', 'tests/homes/w-unit-dangling', 'tests/homes/w-ok', 'tests/homes/w-run'])
const report = {
  at: new Date().toISOString(), entry: entryMode, fixtureRoot: ROOT, scenarios: results,
  finalDeleted: finalDiff.missing, finalChanged: finalDiff.changed, finalBadAdds: finalDiff.badAdd, violations,
  verdict: violations.length === 0 && finalDiff.missing.length === 0 && finalDiff.changed.length === 0 ? 'PASS — ZERO out-of-bounds deletion' : 'FAIL',
}
writeFileSync(join(HERE, entryMode === 'kit' ? 'sentinel-report.json' : `sentinel-report-${entryMode}.json`), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ entry: entryMode, verdict: report.verdict, scenarios: results.length, violations: report.violations, finalDeleted: report.finalDeleted, finalChanged: report.finalChanged, finalBadAdds: report.finalBadAdds, fixture: ROOT }, null, 2))
process.exit(report.verdict.startsWith('PASS') ? 0 : 1)
