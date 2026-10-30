#!/usr/bin/env node
/**
 * run-poc.mjs — R-STATE-HOME-1 bounded PoC (2026-10-30, lane u7r3-statehome-poc).
 *
 * PURPOSE (USER-RULING-20261029B item 4 — direction approved, PoC first, nothing merges):
 * drive the EXISTING PUBLIC API of `packages/tools/agent-state-family` (imported
 * only through its package index — no product src changes, no kernel, no injected
 * internals) from TWO DIFFERENT STATE HOMES and demonstrate, byte-wise:
 *
 *   A. HOME RESOLUTION stays the single governed entry (absolute, existing,
 *      never the operator live ~/.dsh, never invented);
 *   B. ISOLATION — same realmId + same scope in two homes never see each other;
 *      the replay domain (applied/ markers) is per-home too;
 *   C. ANCHOR LAW — a store rooted in one home cannot be opened against
 *      another home's anchor (typed zero-write refusal);
 *   D. RELOCATABLE DIGEST — a subtree digest computed over (subtree-relative
 *      path, content sha256) is invariant under byte copy of the state subtree
 *      to another home, and the relocated store reads the record back;
 *   E. CENSUS — one walk over a parent directory enumerates every home's
 *      realms, scope records, applied markers, ledger bytes and digest.
 *
 * The state-home convention under test is exactly what R-STATE-HOME-1 names:
 * state rooted at a DECLARED home dir, per-realm layout `<home>/team-state/
 * agent-state/<realmId>/`, digestable, census-visible. Everything here uses
 * the public exports (`resolveAgentStateHome`, `storeRootFor`,
 * `createFsStateStore`, `STATE_STORE_SUBTREE`, `ledgerBytes`).
 *
 * SANDBOX NOTE: all worlds live INSIDE this workspace (workspace-write
 * constraint, TEST_METHODS §7 spirit); a FAKE operator home is passed to
 * resolveAgentStateHome so the real ~/.dsh is never consulted or touched.
 *
 * Exit 0 = every check PASS; exit 1 = any check FAIL (honest, never coerced).
 */
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
// PUBLIC entry = the package index as the PRODUCTION runtime loads it — the
// tracked dist mirror `packages/runtime/dist/packages/tools/agent-state-family/
// src/index.mjs`. (The src tree re-exports executors.mjs, whose governance
// import resolves only inside the built tree; the state-store and the package
// index are byte-identical src↔dist — `diff -q` verified — so this import
// exercises the same public surface the family mount uses in production.)
import {
  createFsStateStore,
  resolveAgentStateHome,
  storeRootFor,
  ledgerBytes,
  STATE_STORE_SUBTREE,
} from '../../../../packages/runtime/dist/packages/tools/agent-state-family/src/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORLDS = join(HERE, 'worlds')
const REALM_1 = 'poc-realm-1'
const REALM_2 = 'poc-realm-2'
const SCOPE = 'agent:poc-agent-1' // the exact shape executors.mjs#scopeOf mints
const GOAL = { goalId: 'goal-poc-1', revision: 1, phase: 'active', objective: 'R-STATE-HOME-1 PoC claim' }
const TODOS = [{ content: 'poc-task', status: 'pending' }]

/* ------------------------------------------------------------------ harness */
const checks = []
const facts = {}
const check = (id, name, pass, detail) => {
  checks.push({ id, name, pass: pass === true, detail })
  console.log(`CHECK ${id.padEnd(4)} ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/** Relocatable subtree digest: over SORTED (subtree-relative path, sha256 of
 *  file bytes) pairs. The absolute home path NEVER enters — that is the whole
 *  point: the same bytes under any declared home digest the same. */
function digestStateSubtree(home) {
  const base = join(home, ...STATE_STORE_SUBTREE)
  const rows = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) rows.push(`${relative(base, p).split(sep).join('/')} ${sha256File(p)}`)
    }
  }
  try { walk(base) } catch { return { digest: null, files: 0, absent: true } }
  return { digest: createHash('sha256').update(rows.join('\n') + '\n').digest('hex'), files: rows.length, absent: false }
}

/** The census view: one walk of a parent directory, per home → per realm. */
async function censusStateHomes(parent) {
  const out = []
  for (const name of readdirSync(parent).sort()) {
    const home = join(parent, name)
    if (!statSync(home).isDirectory() || name === 'op-home') continue
    const res = resolveAgentStateHome({ env: { DSH_HOME: home }, realHome: join(parent, 'op-home') })
    if (res.ok !== true) { out.push({ home: name, stateHome: 'UNRESOLVED', reason: res.code }); continue }
    const realms = []
    const realmBase = join(home, ...STATE_STORE_SUBTREE)
    let dirs = []
    try { dirs = readdirSync(realmBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) } catch { /* no state yet */ }
    for (const realmId of dirs.sort()) {
      const count = (sub) => { try { return readdirSync(join(realmBase, realmId, sub)).length } catch { return 0 } }
      realms.push({
        realmId,
        scopeRecords: count('scopes'),
        appliedMarkers: count('applied'),
        locks: count('locks'),
        writesLedgerBytes: Number(await ledgerBytes(join(realmBase, realmId, 'ledger'), 'writes.jsonl')),
        attemptsLedgerBytes: Number(await ledgerBytes(join(realmBase, realmId, 'ledger'), 'attempts.jsonl')),
      })
    }
    out.push({ home: name, stateHome: 'RESOLVED', realms, subtree: digestStateSubtree(home) })
  }
  return out
}

const openStore = (home, realmId) => {
  const res = resolveAgentStateHome({ env: { DSH_HOME: home }, realHome: join(WORLDS, 'op-home') })
  if (res.ok !== true) throw new Error(`home resolution failed: ${res.code}`)
  const root = storeRootFor(res.home, realmId)
  if (root.ok !== true) throw new Error(`root derivation failed: ${root.code}`)
  return createFsStateStore({ rootDir: root.rootDir, anchorDir: res.home, realmId, bootId: 'poc-boot-1' })
}

/* --------------------------------------------------------------------- run */
rmSync(WORLDS, { recursive: true, force: true })
const HOME_A = join(WORLDS, 'home-alpha') // the "production-style" declared home
const HOME_B = join(WORLDS, 'home-beta')  // the "test world" home (same realm ids on purpose)
const HOME_C = join(WORLDS, 'home-gamma') // relocation target (pre-populated by byte copy)
const OP_HOME = join(WORLDS, 'op-home')   // FAKE operator home — real ~/.dsh is never consulted
for (const d of [HOME_A, HOME_B, HOME_C, OP_HOME]) mkdirSync(d, { recursive: true })

console.log(`# R-STATE-HOME-1 PoC run ${new Date().toISOString()}`)
console.log(`# package API = packages/runtime/dist/packages/tools/agent-state-family/src/index.mjs (public exports only; src↔dist byte-identical for this package)`)
console.log(`# homes: alpha=${HOME_A} beta=${HOME_B} gamma(relocation-target)=${HOME_C}`)
console.log(`# layout under each home: ${STATE_STORE_SUBTREE.join('/')}/<realmId>/`)
console.log('')

/* A — home resolution is the single governed entry */
{
  const okA = resolveAgentStateHome({ env: { DSH_HOME: HOME_A }, realHome: OP_HOME })
  check('A1', 'declared absolute home resolves', okA.ok === true, `home=${okA.ok === true ? okA.home : okA.code}`)
  const missing = resolveAgentStateHome({ env: {}, realHome: OP_HOME })
  check('A2', 'unset DSH_HOME refuses (never invents a default)', missing.ok === false && missing.code === 'AGENT_STATE_STORE_HOME_MISSING', missing.code)
  const rel = resolveAgentStateHome({ env: { DSH_HOME: 'relative/home' }, realHome: OP_HOME })
  check('A3', 'relative home refuses (never resolved against cwd)', rel.ok === false && rel.code === 'AGENT_STATE_STORE_HOME_INVALID', rel.code)
  mkdirSync(join(OP_HOME, '.dsh'), { recursive: true })
  const live = resolveAgentStateHome({ env: { DSH_HOME: join(OP_HOME, '.dsh') }, realHome: OP_HOME })
  check('A4', 'operator live harness home refuses', live.ok === false && live.code === 'AGENT_STATE_STORE_HOME_INVALID', live.code)
}

/* B — per-realm derivation is a closed single-segment spelling */
{
  const root = storeRootFor(HOME_A, REALM_1)
  check('B1', 'realm derives its directory under the declared home',
    root.ok === true && root.rootDir === join(HOME_A, ...STATE_STORE_SUBTREE, REALM_1), root.ok === true ? root.rootDir : root.code)
  const bad = storeRootFor(HOME_A, '../evil')
  check('B2', 'realm id cannot name another directory', bad.ok === false && bad.code === 'AGENT_STATE_STORE_REALM_INVALID', bad.code)
}

/* C — two homes, same realm, same scope: ISOLATION through the public API only */
const storeA = openStore(HOME_A, REALM_1)
const storeA2 = openStore(HOME_A, REALM_2)
const storeB = openStore(HOME_B, REALM_1)
{
  const applied = await storeA.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'poc-apply-1' })
  check('C1', 'home A records the goal (apply ok + read back)', applied.ok === true && (await storeA.readGoal(SCOPE))?.objective === GOAL.objective,
    `audit=${applied?.audit ?? 'n/a'}`)
  const todos = await storeA.applyTodos(SCOPE, { todos: TODOS, applyId: 'poc-apply-2' })
  check('C2', 'home A todos applied', todos.ok === true && (await storeA.readTodos(SCOPE))?.length === 1, `audit=${todos?.audit ?? 'n/a'}`)

  const todosR2 = await storeA2.applyTodos(SCOPE, { todos: [{ content: 'realm2-task', status: 'pending' }], applyId: 'poc-apply-r2' })
  check('C3', 'realm isolation INSIDE one home (same scope → goals absent; two REALM directories materialise)',
    todosR2.ok === true && (await storeA2.readGoal(SCOPE)) === null && (await storeA2.readTodos(SCOPE))?.length === 1)
  check('C4', 'HOME isolation (same realmId + same scope in home B → absent)', (await storeB.readGoal(SCOPE)) === null)
  check('C5', 'home B stayed at zero durable writes', Number(await storeB.writesBytes()) === 0, `writesBytes=${String(await storeB.writesBytes())}`)

  const replayA = await storeA.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'poc-apply-1' })
  check('C6', 'replay domain is PER-HOME: home A refuses the consumed applyId', replayA.ok === false && replayA.code === 'STATE_APPLY_REPLAY', replayA.code)
  const replayB = await storeB.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'poc-apply-1' })
  check('C7', 'the same applyId is a DIFFERENT fact in home B (per-home replay domain, applies fresh)', replayB.ok === true, replayB.code ?? 'ok')
}

/* D — the anchor law: a root cannot be opened against another home */
{
  const rootA = storeRootFor(HOME_A, REALM_1).rootDir
  let code = 'NO-THROW'
  try { createFsStateStore({ rootDir: rootA, anchorDir: HOME_B, realmId: REALM_1 }) }
  catch (e) { code = e?.code ?? String(e) }
  check('D1', 'cross-home rooting refuses (root under A, anchor B)', code === 'AGENT_STATE_STORE_PATH_REFUSED', code)
}

/* E — relocatable digest: byte copy of the state subtree to a new home */
{
  const dA = digestStateSubtree(HOME_A)
  const dB = digestStateSubtree(HOME_B)
  check('E1', 'home A and home B digests differ (different state, different digest)',
    dA.digest !== null && dB.digest !== null && dA.digest !== dB.digest, `A=${dA.digest?.slice(0, 16)}… (${String(dA.files)} files)  B=${dB.digest?.slice(0, 16)}… (${String(dB.files)} files)`)

  cpSync(join(HOME_A, ...STATE_STORE_SUBTREE), join(HOME_C, ...STATE_STORE_SUBTREE), { recursive: true })
  const dC = digestStateSubtree(HOME_C)
  check('E2', 'digest is RELOCATABLE: byte-copied subtree under a new home digests identical',
    dC.digest === dA.digest, `C=${dC.digest?.slice(0, 16)}… vs A=${dA.digest?.slice(0, 16)}…  equal=${String(dC.digest === dA.digest)}`)

  const storeC = openStore(HOME_C, REALM_1)
  const goalC = await storeC.readGoal(SCOPE)
  check('E3', 'relocated home reads the record back through a fresh public store instance',
    goalC !== null && JSON.stringify(goalC) === JSON.stringify(await storeA.readGoal(SCOPE)), `objective=${goalC?.objective ?? 'null'}`)

  let replayC = await storeC.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'poc-apply-1' })
  check('E4', 'the relocated home keeps the consumed-grant refusal (applied/ markers travelled with the bytes)',
    replayC.ok === false && replayC.code === 'STATE_APPLY_REPLAY', replayC.code)
}

/* F — census: one walk enumerates every home / realm / ledger / digest */
{
  const census = await censusStateHomes(WORLDS)
  facts.census = census
  console.log('')
  console.log('CENSUS (one walk over the worlds parent):')
  console.log('home        state-home  realm          scopes  applied  locks  writesB  attemptsB  subtree-digest')
  for (const h of census) {
    if (h.stateHome !== 'RESOLVED') { console.log(`${h.home.padEnd(11)}  ${h.stateHome} (${h.reason})`); continue }
    if (h.realms.length === 0) { console.log(`${h.home.padEnd(11)}  ${h.stateHome}   (no state yet)`.padEnd(80) + ` ${h.subtree.digest ?? '—'}`); continue }
    for (const r of h.realms) {
      console.log(`${h.home.padEnd(11)}  ${h.stateHome.padEnd(11)}  ${r.realmId.padEnd(14)}  ${String(r.scopeRecords).padEnd(7)}  ${String(r.appliedMarkers).padEnd(7)}  ${String(r.locks).padEnd(5)}  ${String(r.writesLedgerBytes).padEnd(7)}  ${String(r.attemptsLedgerBytes).padEnd(9)}  ${h.subtree.digest?.slice(0, 16)}…`)
    }
  }
  const alpha = census.find((h) => h.home === 'home-alpha')
  const beta = census.find((h) => h.home === 'home-beta')
  check('F1', 'census enumerates both homes with per-realm scope counts and digests',
    alpha?.realms?.length === 2 && beta?.realms?.length === 1 && alpha.subtree.digest !== null,
    `alpha realms=${String(alpha?.realms?.length)} (r1 scopes=${alpha?.realms?.[0]?.scopeRecords}) beta realms=${String(beta?.realms?.length)}`)
  check('F2', 'census ledger bytes witness the durable writes (A>0, B>0 after C7)',
    (alpha?.realms?.[0]?.writesLedgerBytes ?? 0) > 0 && (beta?.realms?.[0]?.writesLedgerBytes ?? 0) > 0)
}

/* ------------------------------------------------------------------ verdict */
const failed = checks.filter((c) => !c.pass)
facts.checks = checks
console.log('')
console.log(`VERDICT: ${String(checks.length - failed.length)}/${String(checks.length)} checks PASS${failed.length > 0 ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}`)
try {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(HERE, 'poc-receipt.json'), JSON.stringify({ ranAt: new Date().toISOString(), node: process.version, verdict: failed.length === 0 ? 'PASS' : 'FAIL', facts }, null, 1) + '\n', 'utf8')
  console.log(`receipt written: ${join(HERE, 'poc-receipt.json')}`)
} catch (e) { console.log(`receipt write failed: ${String(e)}`) }
process.exit(failed.length === 0 ? 0 : 1)
