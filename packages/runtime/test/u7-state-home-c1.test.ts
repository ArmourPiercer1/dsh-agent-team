/**
 * U7 STATE-HOME C1 — deterministic multi-home governed state-store suite
 * (R-STATE-HOME-1, 2026-10-31 archive round).
 *
 * PROVENANCE: this is the PoC test of PR #463 (design note
 * `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/R-STATE-HOME-1-POC-20261030.md`,
 * executable reference `dev/agent-workflow/evidence/u7r3-state-home-463arch-20261031/run-poc.mjs`,
 * head `2229c1bcbe19382786fb34c41262dd240f1a083d`) converted into the formal C1
 * suite per USER-RULING-20261031 §2 Q6 ("deterministic PoC tests promoted into
 * the formal C1 suite, as an independent PR, existing regression tests kept").
 * PR #463 itself is NOT merged and this promotion is NOT production-merge
 * authorization (ruling §2 disposition; canonical ruling file carried by
 * PR #478 until merged). The existing regression lineage
 * (`u7-agentstate-fs-store-c1.test.ts`, `u7-f-agentb-agent-state-c1.test.ts`)
 * stays untouched beside this file.
 *
 * WHAT THIS PROVES (offline, zero boot, public API only): through the ONE
 * governed resolution entry `resolveAgentStateHome` + `storeRootFor` +
 * `createFsStateStore` (imported through the package public index, no
 * injected internals, no kernel), across THREE explicitly declared state
 * homes:
 *   A  home governance — absolute-or-refuse, never invents a default when
 *      `DSH_HOME` is unset, refuses relative paths and the operator's live
 *      `~/.dsh` home (the guard itself is untouched, see SANDBOX note);
 *   B  per-realm derivation is a closed single-segment spelling (a realm id
 *      cannot name another directory);
 *   C  HOME + REALM ISOLATION — same realmId + same scope in different homes
 *      never see each other; the zero-durable-write witness (writesBytes=0)
 *      holds on the untouched home; the REPLAY DOMAIN is per-home (a consumed
 *      `applyId` refuses `STATE_APPLY_REPLAY` in one home and is a fresh fact
 *      in another);
 *   D  ANCHOR LAW across homes — a root under home A cannot be constructed
 *      against home B's anchor (`AGENT_STATE_STORE_PATH_REFUSED`, zero writes);
 *   E  RELOCATABLE DIGEST — the subtree digest over sorted
 *      (subtree-relative path, sha256(file bytes)) pairs never embeds the
 *      absolute home path: a byte copy to a new home digests identical, the
 *      relocated store reads the record back, and the consumed-grant refusal
 *      travels with the bytes;
 *   F  CENSUS — one walk over a parent directory enumerates every home's
 *      resolution state, per-realm scope/applied/lock counts, both ledger
 *      byte counts and the relocatable digest.
 *
 * NON-SUBSTITUTION LAW (USER-RULING-20261031 §2 Q6 + §4 boundary law):
 * this is C1 — deterministic offline proof of the seam LOGIC on EXPLICITLY
 * DECLARED TEST HOMES only. It does NOT upgrade any L3/L4 cell, does NOT
 * substitute for the production default-Home C2, and does NOT close
 * R-STATE-HOME-1: that closure requires the six live-Host C2 scenarios
 * (default formal Home with `DSH_HOME` unset, explicitly specified Home,
 * World isolation, restart recovery, illegal-path refusal, persisted
 * read-back). Nothing here touches `packages/tools/families/agent-state.mjs`,
 * `DSH_HOME` production semantics, or any Centre/Host interface.
 *
 * SANDBOX / TEST-SCOPE NOTE: worlds are created under a run-local `mkdtemp`
 * scratch inside the OS temp dir (lineage convention, cf. `u7as-` scratch in
 * `u7-agentstate-fs-store-c1.test.ts`). `resolveAgentStateHome` is always
 * driven with an EXPLICIT `env` object and a FAKE operator `realHome` inside
 * the scratch — `process.env` is never mutated and the real `~/.dsh` is never
 * consulted, written, or removed.
 *
 * DATED SCOPE AMENDMENT (narrowing ruling, 2026-10-31 late; USER-RULING-20261031
 * §2 narrowed): the upstream trusted home is REUSED (upstream 639ed01539
 * `resolveDshHome = configured ?? DSH_HOME ?? ~/.dsh`,
 * packages/util/home-paths/src/index.ts:87-92; profile-boot.ts:293/298 supplies
 * `profileContext.home`) — no new home system, no upstream changes. The
 * plugin's EXTRA restrictions pinned by legs A2 (`AGENT_STATE_STORE_HOME_MISSING`
 * on unset `DSH_HOME`) and A4 (refusal of the operator live `~/.dsh`) are
 * asserted here as the CURRENT store behavior and the FUTURE TEST-WORLD policy;
 * post-narrowing the PRODUCTION policy differs — the separate product PR removes
 * these extra restrictions where they conflict with the production default
 * behavior, and the production/test policy split keeps the `~/.dsh` refusal for
 * TEST WORLDS only. Do NOT read A2/A4 as endorsing a production refusal. Design
 * prep: `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`
 * (design lane task branch); implementation follows as its own product PR with
 * the two mandated verifications V1 (pure-function equivalence against upstream
 * `resolveDshHome`) + V2 (isolated-temp-OS-HOME pristine boot).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'

type ResHome = { ok: true, home: string } | { ok: false, code: string }
type ResRoot = { ok: true, rootDir: string } | { ok: false, code: string }
type GoalRecord = Record<string, unknown> | null
type TodoRecord = Array<Record<string, unknown>> | null
type ApplyResult = { ok: boolean, code?: string, audit?: string }
type FsStore = {
  applyGoal: (scope: string, input: { expectedRevision: null, next: Record<string, unknown>, applyId: string }) => Promise<ApplyResult>
  applyTodos: (scope: string, input: { todos: Array<{ content: string, status: string }>, applyId: string }) => Promise<ApplyResult>
  readGoal: (scope: string) => Promise<GoalRecord>
  readTodos: (scope: string) => Promise<TodoRecord>
  writesBytes: () => Promise<number | bigint>
}
type LaneModule = {
  createFsStateStore: (opts: { rootDir: string, anchorDir: string, realmId: string, bootId?: string }) => FsStore
  resolveAgentStateHome: (opts: { env: Record<string, string | undefined>, realHome?: string }) => ResHome
  storeRootFor: (home: string, realmId: string) => ResRoot
  ledgerBytes: (dir: string, filename?: string) => Promise<number | bigint>
  STATE_STORE_SUBTREE: readonly string[]
}

// PUBLIC entry = the family package index, the same import the lineage spec
// (`u7-agentstate-fs-store-c1.test.ts`) uses under vitest. No product src is
// modified by this file; it drives the existing public surface only.
const lane = await import(new URL('../../tools/agent-state-family/src/index.mjs', import.meta.url).href) as unknown as LaneModule
const { createFsStateStore, resolveAgentStateHome, storeRootFor, ledgerBytes, STATE_STORE_SUBTREE } = lane

const REALM_1 = 'u7sh-realm-1'
const REALM_2 = 'u7sh-realm-2'
const SCOPE = 'agent:u7sh-agent-1' // the exact shape executors.mjs#scopeOf mints
const GOAL = { goalId: 'goal-u7sh-1', revision: 1, phase: 'active', objective: 'R-STATE-HOME-1 C1 claim' }
const TODOS = [{ content: 'u7sh-task', status: 'pending' }]

const sha256File = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex')

/** Relocatable subtree digest: over SORTED (subtree-relative path, sha256 of
 *  file bytes) pairs. The absolute home path NEVER enters — the same bytes
 *  under any declared home digest the same. */
function digestStateSubtree(home: string): { digest: string | null, files: number, absent: boolean } {
  const base = join(home, ...STATE_STORE_SUBTREE)
  const rows: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) rows.push(`${relative(base, p).split(sep).join('/')} ${sha256File(p)}`)
    }
  }
  try { walk(base) } catch { return { digest: null, files: 0, absent: true } }
  return { digest: createHash('sha256').update(rows.join('\n') + '\n').digest('hex'), files: rows.length, absent: false }
}

type CensusRealm = { realmId: string, scopeRecords: number, appliedMarkers: number, locks: number, writesLedgerBytes: number, attemptsLedgerBytes: number }
type CensusHome = { home: string, stateHome: 'RESOLVED' | 'UNRESOLVED', reason?: string, realms?: CensusRealm[], subtree?: { digest: string | null, files: number, absent: boolean } }

/** The census view: one walk of a parent directory, per home → per realm. */
async function censusStateHomes(parent: string, opHomeName: string): Promise<CensusHome[]> {
  const out: CensusHome[] = []
  for (const name of readdirSync(parent).sort()) {
    const home = join(parent, name)
    if (!statSync(home).isDirectory() || name === opHomeName) continue
    const res = resolveAgentStateHome({ env: { DSH_HOME: home }, realHome: join(parent, opHomeName) })
    if (res.ok !== true) { out.push({ home: name, stateHome: 'UNRESOLVED', reason: res.code }); continue }
    const realms: CensusRealm[] = []
    const realmBase = join(home, ...STATE_STORE_SUBTREE)
    let dirs: string[] = []
    try { dirs = readdirSync(realmBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) } catch { /* no state yet */ }
    for (const realmId of dirs.sort()) {
      const count = (sub: string): number => { try { return readdirSync(join(realmBase, realmId, sub)).length } catch { return 0 } }
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

let scratch = ''
let HOME_A = '' // the "production-style" declared home
let HOME_B = '' // the "test world" home (same realm ids on purpose)
let HOME_C = '' // relocation target (pre-populated by byte copy)
let OP_HOME = '' // FAKE operator home — the real ~/.dsh is never consulted
const openStore = (home: string, realmId: string): FsStore => {
  const res = resolveAgentStateHome({ env: { DSH_HOME: home }, realHome: OP_HOME })
  if (res.ok !== true) throw new Error(`home resolution failed: ${res.code}`)
  const root = storeRootFor(res.home, realmId)
  if (root.ok !== true) throw new Error(`root derivation failed: ${root.code}`)
  return createFsStateStore({ rootDir: root.rootDir, anchorDir: res.home, realmId, bootId: 'u7sh-boot-1' })
}
let storeA!: FsStore
let storeA2!: FsStore
let storeB!: FsStore

beforeAll(() => {
  // realpathSync(mkdtempSync(...)) — the lineage convention: /tmp may be a
  // symlink, and the store's anchor law is real-path strict, so homes are
  // pinned to their real path before any store is opened.
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'u7sh-')))
  HOME_A = join(scratch, 'home-alpha')
  HOME_B = join(scratch, 'home-beta')
  HOME_C = join(scratch, 'home-gamma')
  OP_HOME = join(scratch, 'op-home')
  for (const d of [HOME_A, HOME_B, HOME_C, OP_HOME]) mkdirSync(d, { recursive: true })
  storeA = openStore(HOME_A, REALM_1)
  storeA2 = openStore(HOME_A, REALM_2)
  storeB = openStore(HOME_B, REALM_1)
})

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('u7-state-home-c1 — governed homes, isolation, anchor law, relocatable digest, census (offline)', () => {
  /* A — home resolution is the single governed entry */
  it('A1 declared absolute home resolves', () => {
    const okA = resolveAgentStateHome({ env: { DSH_HOME: HOME_A }, realHome: OP_HOME })
    expect(okA.ok).toBe(true)
  })
  // SCOPE (dated 2026-10-31 narrowing ruling): A2 pins the store's CURRENT
  // never-invent behavior as the TEST-WORLD policy. Production default-Home
  // resolution follows the reused upstream trusted home (header AMENDMENT); the
  // product PR will relax this leg's production counterpart — the assertion here
  // is not a claim that production must refuse an unset env.
  it('A2 unset DSH_HOME refuses (never invents a default)', () => {
    const missing = resolveAgentStateHome({ env: {}, realHome: OP_HOME })
    expect(missing.ok === false && missing.code === 'AGENT_STATE_STORE_HOME_MISSING', missing.ok === false ? missing.code : 'resolved').toBe(true)
  })
  it('A3 relative home refuses (never resolved against cwd)', () => {
    const rel = resolveAgentStateHome({ env: { DSH_HOME: 'relative/home' }, realHome: OP_HOME })
    expect(rel.ok === false && rel.code === 'AGENT_STATE_STORE_HOME_INVALID', rel.ok === false ? rel.code : 'resolved').toBe(true)
  })
  // SCOPE (dated 2026-10-31 narrowing ruling): A4 pins the `~/.dsh` refusal as
  // the TEST-WORLD policy (the production/test policy split keeps it for test
  // worlds only). Post-narrowing the production default IS the upstream
  // `~/.dsh` trusted home — this leg must not be read as a production-refusal
  // endorsement (header AMENDMENT).
  it('A4 operator live harness home refuses', () => {
    mkdirSync(join(OP_HOME, '.dsh'), { recursive: true })
    const live = resolveAgentStateHome({ env: { DSH_HOME: join(OP_HOME, '.dsh') }, realHome: OP_HOME })
    expect(live.ok === false && live.code === 'AGENT_STATE_STORE_HOME_INVALID', live.ok === false ? live.code : 'resolved').toBe(true)
  })

  /* B — per-realm derivation is a closed single-segment spelling */
  it('B1 realm derives its directory under the declared home', () => {
    const root = storeRootFor(HOME_A, REALM_1)
    expect(root.ok === true && root.rootDir === join(HOME_A, ...STATE_STORE_SUBTREE, REALM_1), root.ok === true ? root.rootDir : root.code).toBe(true)
  })
  it('B2 realm id cannot name another directory', () => {
    const bad = storeRootFor(HOME_A, '../evil')
    expect(bad.ok === false && bad.code === 'AGENT_STATE_STORE_REALM_INVALID', bad.ok === false ? bad.code : 'resolved').toBe(true)
  })

  /* C — two homes, same realm, same scope: ISOLATION through the public API only */
  it('C1 home A records the goal (apply ok + read back)', async () => {
    const applied = await storeA.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'u7sh-apply-1' })
    const back = await storeA.readGoal(SCOPE)
    expect(applied.ok === true && back?.objective === GOAL.objective, `audit=${applied.audit ?? 'n/a'} code=${applied.code ?? 'ok'}`).toBe(true)
  })
  it('C2 home A todos applied', async () => {
    const todos = await storeA.applyTodos(SCOPE, { todos: TODOS, applyId: 'u7sh-apply-2' })
    const back = await storeA.readTodos(SCOPE)
    expect(todos.ok === true && back?.length === 1, `audit=${todos.audit ?? 'n/a'} code=${todos.code ?? 'ok'}`).toBe(true)
  })
  it('C3 realm isolation INSIDE one home (same scope → goals absent; two REALM directories materialise)', async () => {
    const todosR2 = await storeA2.applyTodos(SCOPE, { todos: [{ content: 'realm2-task', status: 'pending' }], applyId: 'u7sh-apply-r2' })
    expect(todosR2.ok === true && (await storeA2.readGoal(SCOPE)) === null && (await storeA2.readTodos(SCOPE))?.length === 1).toBe(true)
  })
  it('C4 HOME isolation (same realmId + same scope in home B → absent)', async () => {
    expect(await storeB.readGoal(SCOPE)).toBe(null)
  })
  it('C5 home B stayed at zero durable writes', async () => {
    expect(Number(await storeB.writesBytes())).toBe(0)
  })
  it('C6 replay domain is PER-HOME: home A refuses the consumed applyId', async () => {
    const replayA = await storeA.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'u7sh-apply-1' })
    expect(replayA.ok === false && replayA.code === 'STATE_APPLY_REPLAY', replayA.code ?? 'ok').toBe(true)
  })
  it('C7 the same applyId is a DIFFERENT fact in home B (per-home replay domain, applies fresh)', async () => {
    const replayB = await storeB.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'u7sh-apply-1' })
    expect(replayB.ok, replayB.code ?? 'ok').toBe(true)
  })

  /* D — the anchor law: a root cannot be opened against another home */
  it('D1 cross-home rooting refuses (root under A, anchor B)', () => {
    const root = storeRootFor(HOME_A, REALM_1)
    if (root.ok !== true) throw new Error(`B1 precondition broken: ${root.code}`)
    let code = 'NO-THROW'
    try { createFsStateStore({ rootDir: root.rootDir, anchorDir: HOME_B, realmId: REALM_1 }) }
    catch (e) { code = (e as { code?: string })?.code ?? String(e) }
    expect(code).toBe('AGENT_STATE_STORE_PATH_REFUSED')
  })

  /* E — relocatable digest: byte copy of the state subtree to a new home */
  it('E1 home A and home B digests differ (different state, different digest)', () => {
    const dA = digestStateSubtree(HOME_A)
    const dB = digestStateSubtree(HOME_B)
    expect(dA.digest !== null && dB.digest !== null && dA.digest !== dB.digest, `A=${dA.digest?.slice(0, 16)} (${String(dA.files)} files) B=${dB.digest?.slice(0, 16)} (${String(dB.files)} files)`).toBe(true)
  })
  it('E2 digest is RELOCATABLE: byte-copied subtree under a new home digests identical', () => {
    const dA = digestStateSubtree(HOME_A)
    cpSync(join(HOME_A, ...STATE_STORE_SUBTREE), join(HOME_C, ...STATE_STORE_SUBTREE), { recursive: true })
    expect(digestStateSubtree(HOME_C).digest).toBe(dA.digest)
  })
  it('E3 relocated home reads the record back through a fresh public store instance', async () => {
    const storeC = openStore(HOME_C, REALM_1)
    const goalC = await storeC.readGoal(SCOPE)
    expect(goalC !== null && JSON.stringify(goalC) === JSON.stringify(await storeA.readGoal(SCOPE)), `objective=${String(goalC?.objective ?? 'null')}`).toBe(true)
  })
  it('E4 the relocated home keeps the consumed-grant refusal (applied/ markers travelled with the bytes)', async () => {
    const storeC = openStore(HOME_C, REALM_1)
    const replayC = await storeC.applyGoal(SCOPE, { expectedRevision: null, next: GOAL, applyId: 'u7sh-apply-1' })
    expect(replayC.ok === false && replayC.code === 'STATE_APPLY_REPLAY', replayC.code ?? 'ok').toBe(true)
  })

  /* F — census: one walk enumerates every home / realm / ledger / digest */
  it('F1 census enumerates both homes with per-realm scope counts and digests', async () => {
    const census = await censusStateHomes(scratch, 'op-home')
    const alpha = census.find((h) => h.home === 'home-alpha')
    const beta = census.find((h) => h.home === 'home-beta')
    expect(alpha?.realms?.length).toBe(2)
    expect(beta?.realms?.length).toBe(1)
    expect(alpha?.subtree?.digest ?? null).not.toBeNull()
    expect(alpha?.realms?.[0]?.scopeRecords).toBe(1)
  })
  it('F2 census ledger bytes witness the durable writes (A>0, B>0 after C7)', async () => {
    const census = await censusStateHomes(scratch, 'op-home')
    const alpha = census.find((h) => h.home === 'home-alpha')
    const beta = census.find((h) => h.home === 'home-beta')
    expect((alpha?.realms?.[0]?.writesLedgerBytes ?? 0) > 0).toBe(true)
    expect((beta?.realms?.[0]?.writesLedgerBytes ?? 0) > 0).toBe(true)
  })
})
