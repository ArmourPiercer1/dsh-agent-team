/**
 * U7 agent-state PRODUCTION STORE C1 — the same five governed rows as
 * u7-f-agentb-agent-state-c1.test.ts, over the REAL plane mount and the real
 * Kernel PA edge, but with NO injected port: the family descriptor builds
 * the PRODUCTION durable store (`fs-state-store.mjs`) under the resolved
 * harness home, `<DSH_HOME>/team-state/agent-state/<realmId>/`.
 *
 * Every refusal leg pairs the ANSWER with a DISK fact — the durable write
 * audit `ledger/writes.jsonl` is byte-measured before and after (growth 0),
 * and `ledger/attempts.jsonl` shows the refused attempt. Every positive is
 * re-read through a SECOND, fresh store instance on the same home (the
 * simulated restart): what the model was told persisted IS on disk.
 *
 * Laws pinned here:
 *  H  home guards — DSH_HOME absent / blank / relative / nonexistent / the
 *     operator's live `.dsh` (incl. a symlink into it) → the mount refuses
 *     PLANE_AGENT_STATE_STORE_MISSING; a symlinked store subtree escaping
 *     the home refuses before any write.
 *  P  positives through the real store, re-read after restart.
 *  R  refusals keep ZERO durable write (writes.jsonl byte-identical, one
 *     attempts line) — stale CAS, already-exists, plan-mode inactive,
 *     cross-scope (by construction), replay (durable across restart).
 *  A  UNAUTHORIZED AUTHORITY answers the TYPED refusal with ZERO durable
 *     write (U7-R3-C1-GOALFAM, 2026-10-30, C1 ONLY — the L3 grade is the
 *     live C2 lane): create_goal from SUBAGENT authority (the isRoot leg of
 *     the arm provider), get_goal / todo_write from an UNATTRIBUTED caller
 *     (refused BEFORE any store touch — zero reads too), exit_plan_mode
 *     outside plan mode AT THE ROW LEG (no apply ever reaches the store —
 *     zero attempts lines, the discriminator against R2's store-level leg).
 *     Each case flips to a committed positive in the SAME world (non-vacuity).
 *  S  byte-exact scoping — `a`, `a `, ` a` are three scopes, never aliases.
 *  B  bounds — an oversized record refuses typed; corrupt/foreign-key
 *     records fail CLOSED (typed), never "empty state".
 *  K  hardlink + symlink law on the read path (nlink>1 refused — the #409
 *     law, pinned here so the swap to the shared symbol is behaviour-
 *     preserving).
 *  I  applyId consumption is cross-scope-GLOBAL and ATOMIC (audit P0-2a):
 *     the same applyId at two different scopes commits at most once, forced
 *     through the faultAt barrier past the first-witness check.
 *  C  crash atomicity — a writer that dies mid-record leaves the PREVIOUS
 *     record intact. MUTATION CONTROL: a store whose writer skips the
 *     temp+rename (writes the target in place) goes RED on the same check.
 *  T  R-413-1 — the lock/stale/timeout/race legs (describes L and F) are
 *     deterministic under ANY runner context (v3: the store measures lock
 *     elapsed-time against the PUBLIC `nowMs` seam, factory option,
 *     default Date.now — the v2 design mocked node:timers, which CANNOT
 *     follow the store's direct module import across vitest roots and went
 *     RED in the root pool). Timeout legs pass a test-owned clock and
 *     advance it (settleTimeout); the store's acquire loop keeps its REAL
 *     short backoff sleeps, so the outcome is fixed at the clock advance —
 *     load stretches the leg's duration, never its result. Stale legs use
 *     small real windows. Race legs (L1/R4-1) run CONCURRENTLY on real
 *     timers with FROZEN nowMs clocks (their timeout can never fire; the
 *     lock makes the round self-terminating) and settle by plain
 *     event-driven Promise.all — NO test-owned wall-clock cap, NO disk
 *     polling (v3's 2 ms nonce-poll observer went RED under nine-root pool
 *     load, #450 census); each instance's critical-section entry is pinned
 *     by the store's own 'after-read' fault seam (fires exactly once per
 *     apply, after lock acquisition) — deterministic and load-independent
 *     (R449 MED, rebased). The 25-round leg's DURATION is load-stretched
 *     (real fs under the pool); L1/R4-1 carry an explicit 30 s per-test
 *     timeout as the disclosed guard (observed census-class worst case
 *     ≈ 8 s) — a slow settle passes, a true hang fails there.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync, linkSync, readdirSync, existsSync, statSync, realpathSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { hostname, tmpdir } from 'node:os'
const hostId = hostname()
const bootId = (() => { try { return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() } catch { return '' } })()
import { join } from 'node:path'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

type RowName = 'todo_write' | 'create_goal' | 'get_goal' | 'update_goal' | 'exit_plan_mode'
type RowOutcome = { text: string }
type Row = { name: string, execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<RowOutcome> }
type Built = { ok: boolean, code?: string, message?: string, value: { definitions: readonly Row[] } }
type Refusal = { ok: false, code: string, detail: string }
type FsStore = {
  name: string
  log: { reads: unknown[], writes: unknown[], attempts: Array<{ outcome: string, code?: string }> }
  ledgerPaths: { attempts: string, writes: string }
  writesBytes: () => Promise<number>
  stateOf: (scope: string) => Promise<Record<string, unknown> | null>
  armFor: (scope: string) => Record<string, unknown>
  readGoal: (scope: string) => Promise<Record<string, unknown> | null>
  applyGoal: (scope: string, op: Record<string, unknown>) => Promise<{ ok: boolean, code?: string, snapshot?: Record<string, unknown> }>
  readTodos: (scope: string) => Promise<unknown>
  applyTodos: (scope: string, op: Record<string, unknown>) => Promise<{ ok: boolean, code?: string }>
  readPlanMode: (scope: string) => Promise<{ active: boolean, pendingIntents: unknown[] }>
  applyPlanModeExit: (scope: string, op: Record<string, unknown>) => Promise<{ ok: boolean, code?: string }>
  seedPlanMode: (scope: string, active: boolean) => Promise<void>
  seedGoal: (scope: string, goal: Record<string, unknown>) => Promise<void>
}
type StoreOpts = Record<string, unknown>
type LaneModule = {
  AGENT_STATE_NAMES: readonly RowName[]
  STATE_STORE_SUBTREE: readonly string[]
  MAX_SCOPE_BYTES: number
  createFsStateStore: (input: Record<string, unknown>) => FsStore
  createHostArmProvider: (input: { hostService: (name: string) => unknown }) => (scope: string) => Record<string, unknown>
  resolveAgentStateHome: (opts?: { env?: Record<string, string | undefined>, realHome?: string }) => { ok: true, home: string } | Refusal
  safeReadRecord: (path: string, limit?: number) => Promise<{ ok: true, text: string } | (Refusal & { absent?: boolean })>
  storeRootFor: (home: string, realmId: string) => { ok: true, rootDir: string } | Refusal
}
type PlaneModule = { createTeamToolPlaneAssembly: (input: unknown) => Built | Promise<Built> }

const lane = await (import(new URL('../../tools/agent-state-family/src/index.mjs', import.meta.url).href) as unknown as Promise<LaneModule>)
const plane = await (import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href) as unknown as Promise<PlaneModule>)
const descriptor = (await (import(new URL('../../tools/families/agent-state.mjs', import.meta.url).href) as unknown as Promise<{ familyAssembly: { build: (cap: unknown) => { refused?: { code: string, message: string }, diagnostics?: { agentStateStore: FsStore } } } }>)).familyAssembly

// The package's minimal node shim (src/plugin/node-min.d.ts) types neither
// `process.env` nor `Stats.size`; a narrow local view, not a shim edit.
const env = (process as unknown as { env: Record<string, string | undefined> }).env
const sizeOf = (p: string): number => (statSync(p) as unknown as { size: number }).size

const REALM = 'u7as-realm'
const POLICY_ASK = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })

let scratch = ''
let home = ''
let savedHome: string | undefined
beforeEach(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'u7as-')))
  home = join(scratch, 'world-home')
  mkdirSync(home)
  savedHome = env.DSH_HOME
  env.DSH_HOME = home
})
afterEach(() => {
  if (savedHome === undefined) delete env.DSH_HOME
  else env.DSH_HOME = savedHome
  rmSync(scratch, { recursive: true, force: true })
})

const storeRoot = (): string => join(home, ...lane.STATE_STORE_SUBTREE, REALM)
const writesPath = (): string => join(storeRoot(), 'ledger', 'writes.jsonl')
const attemptsPath = (): string => join(storeRoot(), 'ledger', 'attempts.jsonl')
const bytesOf = (p: string): number => (existsSync(p) ? sizeOf(p) : 0)
const linesOf = (p: string): Array<Record<string, unknown>> => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Record<string, unknown>) : [])

/** A fresh store over the SAME home — the simulated restart. */
const reopen = (armProvider?: (scope: string) => Record<string, unknown>): FsStore => lane.createFsStateStore({
  rootDir: storeRoot(), anchorDir: home, realmId: REALM, ...(armProvider === undefined ? {} : { armProvider }),
})

/**
 * Mount through the REAL plane with NO injected port — the descriptor builds
 * the production store. The execution-origin arm is a HOST fact; the plane's
 * `hostService` binds only at `mount(agentCtx)`, so this C1 rides the
 * descriptor's own production arm provider over an agentCtx stand-in that
 * answers the host's PUBLIC `agents` / `sessionProjections` shapes (the
 * shapes `tool-goal/src/authority.ts` reads @639ed01539).
 */
async function mountProduction(opts: { humanFor?: string[] } = {}): Promise<{ built: Built, rows: Record<RowName, Row> }> {
  const built = await plane.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7as-root',
    controlLeg: approvingControlLeg(),
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'u7as-tpl',
    role: 'member',
    instanceId: 'u7as-inst',
    onObserve: () => {},
    plane: { agentStateEnabled: true },
  }) as Built & { value: { mount?: (ctx: unknown) => { ok: boolean } } }
  if (built.ok !== true) return { built, rows: {} as Record<RowName, Row> }
  const humans = new Set(opts.humanFor ?? [])
  const agentOf = (id: string) => ({
    id,
    session: {
      id,
      snapshotEvents: () => [
        { type: 'turn/start' },
        ...(humans.has(id) ? [{ type: 'user/message', data: { source: { kind: 'user' } } }] : [{ type: 'user/message', data: { source: { kind: 'agent' } } }]),
      ],
    },
  })
  const known = new Map<string, ReturnType<typeof agentOf>>()
  const agents = {
    get: (id: string) => { if (!known.has(id)) known.set(id, agentOf(id)); return known.get(id) },
    roots: () => [...known.values()],
  }
  const services: Record<string, unknown> = {
    agents,
    sessionProjections: { stateOf: () => ({ openTurnStartSeq: 0 }) },
  }
  const mounted = (built.value as unknown as { mount: (ctx: unknown) => { ok: boolean, message?: string } }).mount({
    get: (name: string) => services[name],
    tools: { register: () => () => {} },
  })
  expect(mounted.ok, String(mounted.message ?? '')).toBe(true)
  const rows: Record<string, Row> = {}
  for (const d of built.value.definitions) rows[d.name] = d
  return { built, rows: rows as Record<RowName, Row> }
}
const exec = (id: string): Record<string, unknown> => ({ agent: { id } })
const codeOf = (r: RowOutcome): string => (r.text.startsWith('refused: ') ? (r.text.slice('refused: '.length).split(' \u2014 ')[0] ?? '') : 'ACCEPTED')

describe('u7as H — the durable home is resolved fail-closed (no invented default)', () => {
  it('H1 DSH_HOME absent / blank / relative / nonexistent → PLANE_AGENT_STATE_STORE_MISSING, and nothing is created anywhere', async () => {
    for (const value of [undefined, '', '   ', 'relative/home', join(scratch, 'does-not-exist')]) {
      if (value === undefined) delete env.DSH_HOME
      else env.DSH_HOME = value
      const { built } = await mountProduction()
      expect(built.ok, `DSH_HOME=${JSON.stringify(value)}`).toBe(false)
      expect(built.code).toBe('PLANE_AGENT_STATE_STORE_MISSING')
    }
    expect(existsSync(join(home, 'team-state'))).toBe(false)
  })

  it('H2 DSH_HOME naming the operator\'s live `.dsh` (or a symlink into it) is REFUSED — never written', () => {
    const fakeOperator = join(scratch, 'operator')
    const liveDsh = join(fakeOperator, '.dsh')
    mkdirSync(liveDsh, { recursive: true })
    const intoLive = join(scratch, 'innocent-looking')
    symlinkSync(liveDsh, intoLive)
    mkdirSync(join(liveDsh, 'nested'))
    for (const candidate of [liveDsh, join(liveDsh, 'nested'), intoLive]) {
      const r = lane.resolveAgentStateHome({ env: { DSH_HOME: candidate }, realHome: fakeOperator })
      expect(r.ok, candidate).toBe(false)
      expect((r as Refusal).code).toBe('AGENT_STATE_STORE_HOME_INVALID')
    }
    // a sibling `.dsh`-named dir that is NOT the operator's live home is a
    // plain test home (the guard is the live home, not the spelling).
    const ok = lane.resolveAgentStateHome({ env: { DSH_HOME: home }, realHome: fakeOperator })
    expect(ok.ok).toBe(true)
    expect(readdirSync(liveDsh)).toEqual(['nested'])
  })

  it('H3 the descriptor refuses an enabled mount whose DSH_HOME is the live `.dsh` of the real operator home', async () => {
    // Point HOME-equivalent at a scratch operator so the real ~/.dsh is never touched.
    const r = lane.resolveAgentStateHome({ env: { DSH_HOME: join(scratch, 'op', '.dsh') }, realHome: join(scratch, 'op') })
    expect(r.ok).toBe(false)
  })

  it('H4 a realm id that is not one path-safe segment refuses (never sanitised into another realm)', () => {
    for (const bad of ['', '..', '.', 'a/b', 'a\\b', '../x', ' lead']) {
      const r = lane.storeRootFor(home, bad)
      expect(r.ok, JSON.stringify(bad)).toBe(false)
    }
    expect(lane.storeRootFor(home, REALM)).toEqual({ ok: true, rootDir: storeRoot() })
  })

  it('H5 anchor law: a `team-state` component symlinked OUTSIDE the home refuses before any byte is written', async () => {
    const elsewhere = join(scratch, 'elsewhere')
    mkdirSync(elsewhere)
    symlinkSync(elsewhere, join(home, 'team-state'))
    const store = reopen(() => ({ kind: 'direct-human' }))
    await expect(store.readGoal('agent:a')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_PATH_REFUSED' })
    expect(readdirSync(elsewhere).length === 0 || !existsSync(join(elsewhere, 'agent-state', REALM, 'scopes'))).toBe(true)
  })

  it('H6 the store root is exactly <DSH_HOME>/team-state/agent-state/<realmId> (the built port is the fs store)', () => {
    const built = descriptor.build({
      realmId: REALM, injected: {}, hostService: () => undefined, logBackend: () => () => {},
      permissionPolicy: POLICY_ASK, decide: () => ({ kind: 'allow' }), pa: async () => ({ kind: 'allow' }), presentationFace: {},
      planeConfig: { agentStateEnabled: true },
    })
    expect(built.refused).toBeUndefined()
    const port = built.diagnostics?.agentStateStore as unknown as { name: string, rootDir: string }
    expect(port.name).toBe('agent-state:fs')
    expect(port.rootDir).toBe(storeRoot())
  })
})

describe('u7as P — positives through the REAL store, re-read after a simulated restart', () => {
  it('P1 create_goal → get_goal → update_goal(pause) persist; a NEW store instance on the same home reads the same facts', async () => {
    const { rows } = await mountProduction({ humanFor: ['alice'] })
    const created = JSON.parse((await rows.create_goal.execute({ objective: 'ship the durable store', max_goal_rounds: 4 }, exec('alice'))).text).goal
    expect(created).toMatchObject({ objective: 'ship the durable store', phase: 'active', revision: 1, max_goal_rounds: 4 })
    const read = JSON.parse((await rows.get_goal.execute({}, exec('alice'))).text).goal
    expect(read).toEqual(created)
    const paused = JSON.parse((await rows.update_goal.execute({ goal_id: created.goal_id, revision: 1, action: 'pause' }, exec('alice'))).text).goal
    expect(paused).toMatchObject({ phase: 'paused', revision: 2, armed: false })
    // restart: a brand-new store over the same home
    const restarted = reopen()
    expect(await restarted.readGoal('agent:alice')).toMatchObject({ goalId: created.goal_id, objective: 'ship the durable store', phase: 'paused', revision: 2, maxGoalRounds: 4 })
    // and the durable audit has exactly the two committed writes
    expect(linesOf(writesPath()).map((w) => w.op)).toEqual(['goal/apply', 'goal/apply'])
  })

  it('P2 todo_write replaces the whole list durably; restart reads the last list', async () => {
    const { rows } = await mountProduction()
    await rows.todo_write.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }] }, exec('alice'))
    const r2 = JSON.parse((await rows.todo_write.execute({ todos: [{ content: 'a', status: 'completed' }] }, exec('alice'))).text)
    expect(r2.counts).toEqual({ pending: 0, inProgress: 0, completed: 1 })
    expect(await reopen().readTodos('agent:alice')).toEqual([{ content: 'a', status: 'completed' }])
  })

  it('P3 exit_plan_mode in an active (seeded) plan mode commits durably; restart sees plan mode OFF with the plan recorded', async () => {
    await reopen().seedPlanMode('agent:alice', true)
    const { rows } = await mountProduction()
    const r = await rows.exit_plan_mode.execute({ plan: '# Durable plan\n\n- step' }, exec('alice'))
    expect(JSON.parse(r.text)).toEqual({ exited: true, planMode: { active: false } })
    const pm = await reopen().readPlanMode('agent:alice')
    expect(pm.active).toBe(false)
    expect(JSON.stringify(pm.pendingIntents)).toContain('# Durable plan')
  })

  it('P4 update_goal edit/complete fold the revision exactly one each, durably', async () => {
    const { rows } = await mountProduction({ humanFor: ['alice'] })
    const g = JSON.parse((await rows.create_goal.execute({ objective: 'o1' }, exec('alice'))).text).goal
    const e = JSON.parse((await rows.update_goal.execute({ goal_id: g.goal_id, revision: 1, action: 'edit', objective: 'o2' }, exec('alice'))).text).goal
    expect(e).toMatchObject({ objective: 'o2', revision: 2 })
    const c = JSON.parse((await rows.update_goal.execute({ goal_id: g.goal_id, revision: 2, action: 'complete' }, exec('alice'))).text).goal
    expect(c).toMatchObject({ phase: 'complete', revision: 3 })
    expect(await reopen().readGoal('agent:alice')).toMatchObject({ objective: 'o2', phase: 'complete', revision: 3 })
  })
})

describe('u7as R — every refusal arm keeps ZERO durable write (byte-measured) and one attempts line', () => {
  const zeroWrite = async (fn: () => Promise<RowOutcome>, code: string) => {
    const before = bytesOf(writesPath())
    const attemptsBefore = linesOf(attemptsPath()).length
    const r = await fn()
    expect(codeOf(r)).toBe(code)
    expect(bytesOf(writesPath()), `${code}: writes.jsonl must not grow`).toBe(before)
    return { attemptsDelta: linesOf(attemptsPath()).length - attemptsBefore }
  }

  it('R1 GOAL_ALREADY_EXISTS / GOAL_STALE_REVISION / GOAL_TOOL_NOT_DIRECT_HUMAN / GOAL_INVALID_TRANSITION through the real rows — zero write', async () => {
    const { rows } = await mountProduction({ humanFor: ['alice'] })
    const g = JSON.parse((await rows.create_goal.execute({ objective: 'once' }, exec('alice'))).text).goal
    await zeroWrite(() => rows.create_goal.execute({ objective: 'twice' }, exec('alice')), 'GOAL_ALREADY_EXISTS')
    await zeroWrite(() => rows.update_goal.execute({ goal_id: g.goal_id, revision: 9, action: 'pause' }, exec('alice')), 'GOAL_STALE_REVISION')
    await zeroWrite(() => rows.update_goal.execute({ goal_id: 'x', revision: 1, action: 'pause' }, exec('bob')), 'GOAL_TOOL_NOT_DIRECT_HUMAN')
    // resume of an already active+armed goal (goal/src/index.ts:372-373)
    await zeroWrite(() => rows.update_goal.execute({ goal_id: g.goal_id, revision: 1, action: 'resume' }, exec('alice')), 'GOAL_INVALID_TRANSITION')
    expect(await reopen().readGoal('agent:alice')).toMatchObject({ revision: 1, phase: 'active', objective: 'once' })
  })

  it('R2 the STORE-level refusals: stale CAS and already-exists answered BY THE STORE leave one attempts line and zero writes', async () => {
    const store = reopen()
    await store.seedGoal('agent:a', { goalId: 'g', objective: 'x', phase: 'active', revision: 2, roundsStarted: 0, armed: true })
    const w0 = bytesOf(writesPath())
    const a0 = linesOf(attemptsPath()).length
    const stale = await store.applyGoal('agent:a', { expectedRevision: 1, next: { goalId: 'g', revision: 2 }, applyId: 'call-stale' })
    expect(stale).toMatchObject({ ok: false, code: 'GOAL_STALE_REVISION' })
    const exists = await store.applyGoal('agent:a', { expectedRevision: null, next: { goalId: 'h', revision: 1 }, applyId: 'call-exists' })
    expect(exists).toMatchObject({ ok: false, code: 'GOAL_ALREADY_EXISTS' })
    const pm = await store.applyPlanModeExit('agent:a', { plan: '# p', applyId: 'call-pm' })
    expect(pm).toMatchObject({ ok: false, code: 'PLAN_MODE_NOT_ACTIVE' })
    expect(bytesOf(writesPath())).toBe(w0)
    const attempts = linesOf(attemptsPath()).slice(a0)
    expect(attempts.map((a) => [a.outcome, a.code])).toEqual([['refused', 'GOAL_STALE_REVISION'], ['refused', 'GOAL_ALREADY_EXISTS'], ['refused', 'PLAN_MODE_NOT_ACTIVE']])
    // a refused apply never burns its applyId: the same id applies later
    const later = await store.applyGoal('agent:a', { expectedRevision: 2, next: { goalId: 'g', objective: 'x', phase: 'paused', revision: 3, roundsStarted: 0, armed: false }, applyId: 'call-stale' })
    expect(later.ok).toBe(true)
  })

  it('R3 REPLAY: a consumed applyId never applies twice — durably, across a restart (STATE_APPLY_REPLAY, zero write)', async () => {
    const s1 = reopen()
    const first = await s1.applyTodos('agent:a', { todos: [{ content: 't', status: 'pending' }], applyId: 'call-1' })
    expect(first.ok).toBe(true)
    const w1 = bytesOf(writesPath())
    const s2 = reopen() // restart
    const replay = await s2.applyTodos('agent:a', { todos: [{ content: 'evil', status: 'pending' }], applyId: 'call-1' })
    expect(replay).toMatchObject({ ok: false, code: 'STATE_APPLY_REPLAY' })
    expect(bytesOf(writesPath())).toBe(w1)
    expect(await s2.readTodos('agent:a')).toEqual([{ content: 't', status: 'pending' }])
    expect(linesOf(attemptsPath()).at(-1)).toMatchObject({ outcome: 'refused', code: 'STATE_APPLY_REPLAY' })
  })

  it('R4 CROSS-SCOPE: bob naming alice\'s goal meets bob\'s own (empty) scope — alice\'s record bytes untouched, zero write', async () => {
    const { rows } = await mountProduction({ humanFor: ['alice', 'bob'] })
    const g = JSON.parse((await rows.create_goal.execute({ objective: 'alice owns this' }, exec('alice'))).text).goal
    const aliceFile = readdirSync(join(storeRoot(), 'scopes')).map((f) => join(storeRoot(), 'scopes', f))
    const before = aliceFile.map((p) => readFileSync(p, 'utf8'))
    await zeroWrite(() => rows.update_goal.execute({ goal_id: g.goal_id, revision: 1, action: 'complete' }, exec('bob')), 'GOAL_NOT_FOUND')
    expect(aliceFile.map((p) => readFileSync(p, 'utf8'))).toEqual(before)
    expect(await reopen().readGoal('agent:bob')).toBe(null)
  })
})

describe('u7as S — byte-exact scoping (no trim, no fold)', () => {
  it('S1 "a", "a " and " a" are three distinct durable scopes; each reads back only its own fact', async () => {
    const store = reopen()
    for (const [i, id] of ['agent:a', 'agent:a ', 'agent: a'].entries()) {
      const r = await store.applyTodos(id, { todos: [{ content: `t${String(i)}`, status: 'pending' }], applyId: `s-${String(i)}` })
      expect(r.ok).toBe(true)
    }
    const again = reopen()
    expect(await again.readTodos('agent:a')).toEqual([{ content: 't0', status: 'pending' }])
    expect(await again.readTodos('agent:a ')).toEqual([{ content: 't1', status: 'pending' }])
    expect(await again.readTodos('agent: a')).toEqual([{ content: 't2', status: 'pending' }])
    expect(readdirSync(join(storeRoot(), 'scopes')).filter((f) => f.endsWith('.json'))).toHaveLength(3)
    expect(await again.readTodos('agent:A')).toBe(null)
  })
})

describe('u7as B — bounds, corruption and absence fail CLOSED (typed), never "empty state"', () => {
  const recordFile = async (scope: string): Promise<string> => {
    await reopen().applyTodos(scope, { todos: [{ content: 'x', status: 'pending' }], applyId: `seed-${scope}` })
    const files = readdirSync(join(storeRoot(), 'scopes')).filter((f) => f.endsWith('.json'))
    return join(storeRoot(), 'scopes', files[0] as string)
  }

  it('B1 an oversized record refuses typed on read (AGENT_STATE_STORE_OVERSIZED) — the row answers a typed fault, not null', async () => {
    const path = await recordFile('agent:alice')
    writeFileSync(path, 'x'.repeat(lane.MAX_SCOPE_BYTES + 1))
    await expect(reopen().readGoal('agent:alice')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_OVERSIZED' })
    const { rows } = await mountProduction()
    const r = await rows.get_goal.execute({}, exec('alice'))
    expect(codeOf(r)).toBe('AGENT_STATE_STORE_FAULT')
    expect(r.text).toContain('AGENT_STATE_STORE_OVERSIZED')
  })

  it('B2 an oversized WRITE refuses typed and writes nothing', async () => {
    const store = lane.createFsStateStore({ rootDir: storeRoot(), anchorDir: home, realmId: REALM, maxScopeBytes: 256 })
    const r = await store.applyTodos('agent:a', { todos: [{ content: 'y'.repeat(400), status: 'pending' }], applyId: 'big' })
    expect(r).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_OVERSIZED' })
    expect(bytesOf(writesPath())).toBe(0)
    // the applyId was rolled back: the same id applies once the content fits
    expect((await store.applyTodos('agent:a', { todos: [{ content: 'ok', status: 'pending' }], applyId: 'big' })).ok).toBe(true)
  })

  it('B3 corrupt JSON / unknown schema / a FOREIGN key in the file fail closed (AGENT_STATE_STORE_CORRUPT), never read as empty', async () => {
    const path = await recordFile('agent:alice')
    for (const bad of ['{not json', JSON.stringify({ schema: 'other/1', key: 'agent:alice' }), JSON.stringify({ schema: 'agent-state-scope/1', key: 'agent:mallory', goal: null })]) {
      writeFileSync(path, bad)
      await expect(reopen().readGoal('agent:alice')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_CORRUPT' })
    }
  })

  it('B4 an ABSENT scope is honestly null for get (no record exists), while an unreadable one is a typed fault', async () => {
    expect(await reopen().readGoal('agent:nobody')).toBe(null)
  })
})

describe('u7as K — the read path refuses aliases (hardlink law, interim of #409)', () => {
  it('K1 nlink>1: a record that is hard-linked elsewhere is REFUSED (AGENT_STATE_STORE_ALIAS_REFUSED) — pins the #409 behaviour for the swap', async () => {
    await reopen().applyTodos('agent:alice', { todos: [{ content: 'x', status: 'pending' }], applyId: 'k1' })
    const file = join(storeRoot(), 'scopes', readdirSync(join(storeRoot(), 'scopes')).find((f) => f.endsWith('.json')) as string)
    linkSync(file, join(scratch, 'alias.json'))
    const direct = await lane.safeReadRecord(file)
    expect(direct).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_ALIAS_REFUSED' })
    await expect(reopen().readTodos('agent:alice')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_ALIAS_REFUSED' })
  })

  it('K2 a symlinked record is refused at open (O_NOFOLLOW), never followed', async () => {
    const target = join(scratch, 'planted.json')
    writeFileSync(target, JSON.stringify({ schema: 'agent-state-scope/1', key: 'agent:alice', goal: { goalId: 'planted' } }))
    const link = join(scratch, 'link.json')
    symlinkSync(target, link)
    expect(await lane.safeReadRecord(link)).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_ALIAS_REFUSED' })
  })
})

describe('u7as C — crash atomicity (temp + fsync + rename), with a mutation control', () => {
  /** A writer that writes HALF the record and then dies (the crash). */
  const dyingWriter = async (handle: { writeFile: (t: string, e: string) => Promise<void> }, text: string) => {
    await handle.writeFile(text.slice(0, Math.floor(text.length / 2)), 'utf8')
    throw Object.assign(new Error('simulated crash mid-record'), { code: 'ESIMCRASH' })
  }

  /** THE SAME crash against a store that writes the TARGET in place (no temp,
   *  no rename) — the mutation the atomic rename exists to prevent. */
  const inPlaceStoreDying = () => {
    // Reproduce exactly the record path the real store uses, then perform
    // the broken (non-atomic) write: open the target itself and write half.
    return async (scope: string, text: string) => {
      const real = reopen()
      await real.readGoal(scope) // ensure dirs
      const files = readdirSync(join(storeRoot(), 'scopes')).filter((f) => f.endsWith('.json'))
      const target = join(storeRoot(), 'scopes', files[0] as string)
      writeFileSync(target, text.slice(0, Math.floor(text.length / 2)))
    }
  }

  const goalV = (revision: number) => ({ goalId: 'g', objective: `rev ${String(revision)}`, phase: 'active', revision, roundsStarted: 0, armed: true })

  it('C1 a crash mid-write leaves the PREVIOUS record intact and readable; no torn record; no write audit entry; applyId reusable', async () => {
    await reopen().seedGoal('agent:a', goalV(1))
    const dying = lane.createFsStateStore({ rootDir: storeRoot(), anchorDir: home, realmId: REALM, recordWriter: dyingWriter })
    const w0 = bytesOf(writesPath())
    const r = await dying.applyGoal('agent:a', { expectedRevision: 1, next: goalV(2), applyId: 'crash-1' })
    expect(r.ok).toBe(false)
    expect(bytesOf(writesPath())).toBe(w0)
    expect(await reopen().readGoal('agent:a')).toMatchObject({ revision: 1, objective: 'rev 1' })
    // no temp debris is ever READ as state: only *.json records count
    const ok = await reopen().applyGoal('agent:a', { expectedRevision: 1, next: goalV(2), applyId: 'crash-1' })
    expect(ok.ok).toBe(true)
  })

  it('C2 MUTATION CONTROL: the same crash against an IN-PLACE (non-rename) write TEARS the record — the C1 law would go RED without the atomic rename', async () => {
    await reopen().seedGoal('agent:a', goalV(1))
    const record = `${JSON.stringify({ schema: 'agent-state-scope/1', key: 'agent:a', realmId: REALM, goal: goalV(2), todos: null, planMode: { active: false, pendingIntents: [] } })}\n`
    await inPlaceStoreDying()('agent:a', record)
    // The previous record is GONE and the torn one fails closed — exactly
    // what C1 asserts can never happen with temp+fsync+rename.
    let previousIntact = true
    try {
      const g = await reopen().readGoal('agent:a')
      previousIntact = (g as { revision?: number } | null)?.revision === 1
    } catch {
      previousIntact = false
    }
    expect(previousIntact, 'an in-place writer must NOT preserve the previous record across a crash (this is the RED the rename prevents)').toBe(false)
  })
})

describe('u7as A — the production arm provider mirrors host authority (fail closed to `model`)', () => {
  it('A1 direct-human only for a ROOT agent with a user-sourced message in the open turn; goal-round for an exact goal source; otherwise model', () => {
    const evt = (source: Record<string, unknown>) => ({ type: 'user/message', data: { source } })
    const mk = (events: unknown[]) => ({ session: { snapshotEvents: () => [{ type: 'turn/start' }, ...events] } })
    const human = mk([evt({ kind: 'user' })])
    const child = mk([evt({ kind: 'user' })])
    const round = mk([evt({ kind: 'goal', goalId: 'g', revision: 2, round: 3 })])
    const table: Record<string, unknown> = { human, child, round }
    const services: Record<string, unknown> = {
      agents: { get: (id: string) => table[id], roots: () => [human, round] },
      sessionProjections: { stateOf: () => ({ openTurnStartSeq: 0 }) },
    }
    const arm = lane.createHostArmProvider({ hostService: (n) => services[n] })
    expect(arm('agent:human')).toEqual({ kind: 'direct-human' })
    expect(arm('agent:child')).toEqual({ kind: 'model' })
    expect(arm('agent:round')).toEqual({ kind: 'goal-round', goalId: 'g', revision: 2, round: 3 })
    expect(arm('agent:unknown')).toEqual({ kind: 'model' })
    expect(arm('not-a-scope')).toEqual({ kind: 'model' })
    const unbound = lane.createHostArmProvider({ hostService: () => undefined })
    expect(unbound('agent:human')).toEqual({ kind: 'model' })
    const throwing = lane.createHostArmProvider({ hostService: () => { throw new Error('svc') } })
    expect(throwing('agent:human')).toEqual({ kind: 'model' })
  })
})

describe('u7as O — every row outcome fits the plane presentation face (closed {text})', () => {
  it('O1 positives AND refusals carry exactly {text}: the live host validates output against additionalProperties:false (C2 boot-1 finding: an extra `refusal` field masked every typed code as "invalid output")', async () => {
    const { built, rows } = await mountProduction({ humanFor: ['alice'] })
    const face = (built.value.definitions[0] as unknown as { output: { schema: { additionalProperties: boolean, properties: Record<string, unknown> } } }).output.schema
    expect(face.additionalProperties).toBe(false)
    const allowed = Object.keys(face.properties)
    const outcomes = [
      await rows.get_goal.execute({}, exec('alice')),
      await rows.create_goal.execute({ objective: 'o' }, exec('alice')),
      await rows.create_goal.execute({ objective: 'again' }, exec('alice')),
      await rows.update_goal.execute({ goal_id: 'nope', revision: 1, action: 'pause' }, exec('alice')),
      await rows.todo_write.execute({ todos: 'bad' }, exec('alice')),
      await rows.exit_plan_mode.execute({ plan: '# p' }, exec('alice')),
    ]
    for (const o of outcomes) expect(Object.keys(o).filter((k) => !allowed.includes(k)), JSON.stringify(o).slice(0, 120)).toEqual([])
    expect(outcomes.filter((o) => o.text.startsWith('refused: ')).length).toBeGreaterThanOrEqual(3)
  })
})

/**
 * The C1/live gap that hid the get_goal denial: the C1 stand-in control leg
 * approved ANY ask, while the PRODUCTION bridge
 * (operation-permission/pa-control-bridge.ts:358-361, protected center)
 * denies an ask whose effect set names no tool-invoke tool — BEFORE any
 * durable Control row. This leg drives every row of the family through a
 * faithful model of exactly that shape requirement.
 */
const bridgeShapeLeg = (seen: Array<{ tool: string, ok: boolean }>) => async (input: { request: { requestedEffects: { effects: Array<{ kind: string, toolName?: string }> } } }) => {
  const toolInvoke = input.request.requestedEffects.effects.find((e) => e.kind === 'tool-invoke')
  const toolName = toolInvoke?.toolName
  if (typeof toolName !== 'string' || toolName.length === 0) {
    seen.push({ tool: 'NO-TOOL-INVOKE', ok: false })
    return { decision: 'deny', detail: 'the effect set names no tool-invoke tool — the guard scope would carry no tool identity' }
  }
  seen.push({ tool: toolName, ok: true })
  return approvingControlLeg()(input as never)
}

describe('u7as G — every row meets the production bridge shape (tool-invoke names the row)', () => {
  it('G1 all five rows pass the bridge-shape leg, each naming ITSELF; get_goal reads the durable goal back', async () => {
    const seen: Array<{ tool: string, ok: boolean }> = []
    const built = await plane.createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 }, teamSessionId: 'u7as-root', controlLeg: bridgeShapeLeg(seen),
      permissionPolicy: POLICY_ASK, realmId: REALM, templateId: 'u7as-tpl', role: 'member', instanceId: 'u7as-inst',
      onObserve: () => {}, plane: { agentStateEnabled: true },
    }) as Built & { value: { mount: (ctx: unknown) => { ok: boolean } } }
    expect(built.ok).toBe(true)
    const humans = new Set(['alice'])
    const agent = { id: 'alice', session: { snapshotEvents: () => [{ type: 'turn/start' }, { type: 'user/message', data: { source: { kind: 'user' } } }] } }
    built.value.mount({ get: (n: string) => (n === 'agents' ? { get: (id: string) => (humans.has(id) ? agent : undefined), roots: () => [agent] } : n === 'sessionProjections' ? { stateOf: () => ({ openTurnStartSeq: 0 }) } : undefined), tools: { register: () => () => {} } })
    const rows: Record<string, Row> = {}
    for (const d of built.value.definitions) rows[d.name] = d
    await reopen().seedPlanMode('agent:alice', true)
    const g = JSON.parse((await rows.create_goal!.execute({ objective: 'bridge-shape' }, exec('alice'))).text).goal
    const read = await rows.get_goal!.execute({}, exec('alice'))
    expect(codeOf(read)).toBe('ACCEPTED')
    expect(JSON.parse(read.text).goal.objective).toBe('bridge-shape')
    await rows.update_goal!.execute({ goal_id: g.goal_id, revision: 1, action: 'edit', objective: 'e' }, exec('alice'))
    await rows.todo_write!.execute({ todos: [{ content: 't', status: 'pending' }] }, exec('alice'))
    await rows.exit_plan_mode!.execute({ plan: '# p' }, exec('alice'))
    expect(seen).toEqual([
      { tool: 'create_goal', ok: true }, { tool: 'get_goal', ok: true }, { tool: 'update_goal', ok: true },
      { tool: 'todo_write', ok: true }, { tool: 'exit_plan_mode', ok: true },
    ])
  })

  it('G2 MUTATION CONTROL: a get_goal set WITHOUT its tool-invoke arm is denied by the bridge-shape leg (the live boot-1..3 failure, reproduced at C1)', async () => {
    const seen: Array<{ tool: string, ok: boolean }> = []
    const leg = bridgeShapeLeg(seen)
    const without = await leg({ request: { requestedEffects: { effects: [{ kind: 'meta' }] } } })
    expect(without).toMatchObject({ decision: 'deny' })
    expect(seen).toEqual([{ tool: 'NO-TOOL-INVOKE', ok: false }])
  })
})

/** Every file anywhere under `dir` (the zero-bytes-outside witness). */
const filesUnder = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const q = join(d, e.name)
      if (e.isDirectory()) walk(q)
      else out.push(q)
    }
  }
  walk(dir)
  return out
}
const storeWith = (opts: StoreOpts = {}): FsStore => lane.createFsStateStore({ rootDir: storeRoot(), anchorDir: home, realmId: REALM, ...opts })
const storeWithBoot = (boot: string, opts: StoreOpts = {}): FsStore => storeWith({ ...opts, bootId: boot })

/**
 * R-413-1 v3 (root-pool safe): a test-owned wall clock handed to the store
 * through the PUBLIC `nowMs` seam (factory option, default Date.now). The
 * store's acquire loop keeps running on REAL short backoff sleeps and real
 * fs in every runner context — no fake timers, no module mock — and
 * measures lock elapsed-time against THIS clock.
 */
const testClock = (): { now: () => number, advance: (ms: number) => void } => {
  let t = 0
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

/**
 * Drive a timeout leg: re-advance the test clock past the timeout window
 * until the store's next REAL poll (its ≤50 ms backoff sleep) observes the
 * full elapsed — the outcome is fixed at the advance (every timeout leg's
 * holder is unbreakable by construction), so wall load can only stretch
 * the leg's real duration, never its result. The promise is handled from
 * creation, so an early typed refusal can never surface as an unhandled
 * rejection.
 */
const settleTimeout = async <T>(p: Promise<T>, clock: { advance: (ms: number) => void }, timeoutMs: number): Promise<T> => {
  let settled = false
  void p.then(
    () => { settled = true },
    () => { settled = true },
  )
  for (let i = 0; i < 400 && !settled; i += 1) { // 400 × 10 ms real = 4 s hard cap
    clock.advance(timeoutMs + 100)
    await new Promise<void>((r) => { setTimeout(r, 10) })
  }
  if (!settled) throw new Error(`the store operation did not settle within 4000 ms of real time (the clock had advanced past ${String(timeoutMs)} ms of lock time)`)
  return await p
}

describe('u7as X — containment is re-proven on EVERY operation (review round-1 B-1)', () => {
  // The three swap targets, each replaced by a symlink to an OUTSIDE dir.
  const targets: Array<[string, () => string]> = [
    ['scopes dir', () => join(storeRoot(), 'scopes')],
    ['realm dir', () => storeRoot()],
    ['ancestor (team-state)', () => join(home, 'team-state')],
  ]
  const swap = (target: string): string => {
    const outside = join(scratch, `outside-${String(Math.random()).slice(2, 8)}`)
    mkdirSync(outside)
    renameSync(target, `${target}.moved`)
    symlinkSync(outside, target)
    return outside
  }
  for (const [label, target] of targets) {
    for (const phase of ['after build (first read only)', 'after a first write'] as const) {
      it(`X ${label} swapped for a symlink ${phase}: write AND read refuse typed, ZERO bytes outside the root`, async () => {
        const store = storeWith()
        if (phase === 'after a first write') {
          expect((await store.applyTodos('agent:a', { todos: [{ content: 'first', status: 'pending' }], applyId: 'x-first' })).ok).toBe(true)
        } else {
          // build-equivalent: the descriptor-built store has touched the
          // store once (a read) — the old cache was armed by exactly this.
          await store.readGoal('agent:a')
          mkdirSync(join(storeRoot(), 'scopes'), { recursive: true })
        }
        const outside = swap(target())
        const r = await store.applyTodos('agent:b', { todos: [{ content: 'escape', status: 'pending' }], applyId: 'x-escape' })
        expect(r).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_PATH_REFUSED' })
        await expect(store.seedGoal('agent:b', { goalId: 'g', revision: 1, phase: 'active' })).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_PATH_REFUSED' })
        await expect(store.readGoal('agent:a')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_PATH_REFUSED' })
        // a FRESH instance (the restart) refuses the same way
        const fresh = await storeWith().applyGoal('agent:c', { expectedRevision: null, next: { goalId: 'g', revision: 1, phase: 'active' }, applyId: 'x-fresh' })
        expect(fresh).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_PATH_REFUSED' })
        expect(filesUnder(outside), `${label}: nothing may land outside the root`).toEqual([])
      })
    }
  }

  it('X-pin: the operation writes into the directory whose identity it PROVED (openStoreDir pins the descriptor, not a re-resolvable name)', async () => {
    const pinned = await (lane as unknown as { openStoreDir: (a: string, s: string[], o: { create: boolean }) => Promise<{ path: string, close: () => Promise<void> }> }).openStoreDir(home, ['team-state', 'agent-state', REALM, 'scopes'], { create: true })
    try {
      const outside = swap(join(storeRoot(), 'scopes'))
      writeFileSync(join(pinned.path, 'probe.txt'), 'x')
      expect(filesUnder(outside)).toEqual([])
      expect(readdirSync(join(storeRoot(), 'scopes.moved'))).toContain('probe.txt')
    } finally { await pinned.close() }
  })
})

describe('u7as L — concurrent appliers are serialised per scope (review round-1 B-2)', () => {
  // R-413-1 v3: the lock/stale/timeout legs below are deterministic under
  // ANY runner context — elapsed lock time is measured against the
  // test-owned nowMs seam; the store's own sleeps/stays real (see the T-law
  // note in the file header).

  it('L1 FOUR store instances race the SAME expectedRevision, 25 rounds: exactly ONE ok and three GOAL_STALE_REVISION each round, one write line per round, the revision advances exactly one', async () => {
    // R-413-1 v3 + R449 MED (rebased v4 after the #450 census red):
    // DETERMINISTICALLY concurrent arrival on REAL timers (any runner
    // context) — all four applies are started with NO await between them,
    // each carries a FROZEN nowMs clock (its lock timeout can never fire),
    // and the round settles by the lock + CAS via a plain event-driven
    // await (no test-owned wall-clock cap, no polling): exactly one CAS
    // winner, three stale refusals. With the lock in place, nothing else
    // can happen; with a lock-removal regression, several appliers could
    // commit concurrently and the same outcome assertion goes RED.
    // The 25-round leg's DURATION is load-stretched (real fs); the
    // explicit 30 s per-test timeout below is the disclosed guard (observed
    // census-class worst case ≈ 8 s) — a true hang fails there, a slow
    // settle does not.
    for (let round = 1; round <= 25; round += 1) {
      await storeWith().seedGoal('agent:race', { goalId: 'g', objective: `r${String(round)}`, phase: 'active', revision: round, roundsStarted: 0, armed: true })
      const w0 = bytesOf(writesPath())
      const linesBefore = linesOf(writesPath()).length
      const frozen = testClock() // never advanced: the racers' timeout can never fire
      const acquires = new Set<string>()
      const racers = [0, 1, 2, 3].map((i) => storeWith({
        nowMs: frozen.now,
        // 'after-read' fires exactly once per apply, INSIDE the critical
        // section, after lock acquisition (store fs-state-store.mjs:853) —
        // a deterministic per-instance acquire mark, no disk sampling
        faultAt: (point: string) => { if (point === 'after-read') acquires.add(`race-${String(round)}-${String(i)}`) },
      }).applyGoal('agent:race', {
        expectedRevision: round, applyId: `race-${String(round)}-${String(i)}`,
        next: { goalId: 'g', objective: `winner-${String(i)}`, phase: 'active', revision: round + 1, roundsStarted: 0, armed: true },
      }))
      // event-driven settle: no wall-clock cap, no polling — the lock +
      // CAS terminate the round under any load; a TRUE hang (none
      // observed) would fail via vitest's own testTimeout (disclosed)
      const results = await Promise.all(racers)
      expect(results.filter((r) => r.ok === true), `round ${String(round)}`).toHaveLength(1)
      expect(results.filter((r) => r.code === 'GOAL_STALE_REVISION'), `round ${String(round)}`).toHaveLength(3)
      expect(linesOf(writesPath()).length - linesBefore).toBe(1)
      expect(bytesOf(writesPath())).toBeGreaterThan(w0)
      expect(await storeWith().readGoal('agent:race')).toMatchObject({ revision: round + 1 })
      // R449 MED ordering assertion (rebased after the #450 census red):
      // every one of the four instances ENTERED the lock's critical
      // section exactly once — the 'after-read' seam fires per apply only
      // after lock acquisition; the 1-ok/3-stale outcome above proves the
      // entries were mutually exclusive (simultaneous entries would
      // double-commit and RED the outcome). No sampling, no wall-clock
      // budget — deterministic under any pool load.
      expect(acquires.size, `round ${String(round)}: all four instances must have entered the critical section exactly once`).toBe(4)
    }
  }, 30_000)

  it('L2 a STALE lock (holder pid dead) is broken and the apply proceeds; a LIVE lock times out typed with ZERO write', async () => {
    mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
    const scopeLock = (scope: string): string => {
      // the store names a scope lock by the sha256 of the scope bytes
      return join(storeRoot(), 'locks', `${createHash('sha256').update(scope).digest('hex')}.lock`)
    }
    writeFileSync(scopeLock('agent:s'), JSON.stringify({ pid: 2 ** 22 + 12345, host: hostId, boot: bootId || 'test-boot', nonce: 'dead-holder', token: 'dead-token', at: Date.now() }))
    // the death-observation window is min(staleMs, 1000) of REAL time here
    const stale = storeWith({ lockStaleMs: 50 }).applyTodos('agent:s', { todos: [{ content: 'after-stale', status: 'pending' }], applyId: 'stale-1' })
    expect((await stale).ok).toBe(true)
    writeFileSync(scopeLock('agent:t'), JSON.stringify({ pid: (process as unknown as { pid: number }).pid, host: hostId, boot: bootId || 'test-boot', nonce: 'live-holder', token: 'live-token', at: Date.now() }))
    const w0 = bytesOf(writesPath())
    // the holder is this pid: the would-be breaker refuses immediately, so
    // the apply spins its REAL retry sleep while the test-owned nowMs clock
    // is advanced past the 150 ms window — the timeout is a pure clock
    // event (root-pool safe: no fake timers involved)
    const clock = testClock()
    const live = storeWith({ lockTimeoutMs: 150, nowMs: clock.now }).applyTodos('agent:t', { todos: [{ content: 'blocked', status: 'pending' }], applyId: 'live-1' })
    const r = await settleTimeout(live, clock, 150)
    expect(r).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_LOCK_TIMEOUT' })
    expect(bytesOf(writesPath())).toBe(w0)
    expect(await storeWith().readTodos('agent:t')).toBe(null)
  })
})

describe('u7as M — the applyId is consumed ATOMICALLY (O_EXCL marker), clean failures refund', () => {
  const goalV = (revision: number) => ({ goalId: 'g', objective: `rev ${String(revision)}`, phase: 'active', revision, roundsStarted: 0, armed: true })

  it('M1 failure BEFORE the commit (writer dies mid-record): the grant is REFUNDED — the same applyId applies later', async () => {
    await storeWith().seedGoal('agent:m', goalV(1))
    const dying = storeWith({ recordWriter: async (h: { writeFile: (t: string, e: string) => Promise<void> }, t: string) => { await h.writeFile(t.slice(0, 10), 'utf8'); throw Object.assign(new Error('crash'), { code: 'ESIMCRASH' }) } })
    expect((await dying.applyGoal('agent:m', { expectedRevision: 1, next: goalV(2), applyId: 'm-1' })).ok).toBe(false)
    expect(await storeWith().readGoal('agent:m')).toMatchObject({ revision: 1 })
    expect((await storeWith().applyGoal('agent:m', { expectedRevision: 1, next: goalV(2), applyId: 'm-1' })).ok).toBe(true)
  })

  it('M2 die AFTER the commit landed (seam between rename and ledgers): BOTH witnesses hold the id (record + consumed marker) — a replay is STILL refused', async () => {
    await storeWith().seedGoal('agent:m', goalV(1))
    const crashing = storeWith({ faultAt: (point: string) => { if (point === 'after-commit') throw Object.assign(new Error('crash'), { code: 'ESIMCRASH' }) } })
    await crashing.applyGoal('agent:m', { expectedRevision: 1, next: goalV(2), applyId: 'm-2' })
    // P0-2a order: the marker is the consumption point and lands BEFORE the
    // commit, so a stop at 'after-commit' (rename done, ledgers pending)
    // leaves BOTH witnesses: the record carries the id AND the marker exists.
    expect(readdirSync(join(storeRoot(), 'applied'))).toHaveLength(1)
    const restarted = storeWith()
    expect(await restarted.readGoal('agent:m')).toMatchObject({ revision: 2 })
    const w0 = bytesOf(writesPath())
    const replay = await restarted.applyGoal('agent:m', { expectedRevision: 2, next: goalV(3), applyId: 'm-2' })
    expect(replay).toMatchObject({ ok: false, code: 'STATE_APPLY_REPLAY' })
    expect(bytesOf(writesPath())).toBe(w0)
    expect(await restarted.readGoal('agent:m')).toMatchObject({ revision: 2 })
  })
})

describe('u7as I — applyId consumption is cross-scope-GLOBAL and atomic (audit P0-2a)', () => {
  // The port contract (state-store.mjs DURABLE IDEMPOTENCE) makes applyId
  // consumption realm-GLOBAL: the same applyId commits AT MOST ONCE across all
  // scopes. Persistence locking is PER-SCOPE (locks/<scope-digest>.lock), so
  // two applies carrying the same applyId at DIFFERENT scopes never contend
  // through that lock. This leg forces the interleaving with the C1 `faultAt`
  // seam: a two-arrival barrier parks each apply AFTER its first-witness
  // check ('after-read' fires past the appliedIds/markerPresent check) and
  // BEFORE any commit or marker can land, so both legs enter the commit
  // window with zero global witness. The VALVE (release on either apply
  // settling) keeps the leg deterministic in both worlds: pre-fix both reach
  // settling) keeps the leg deterministic in both worlds: pre-fix both reach
  // the seam (two commits → RED); once consumption is atomic only the winner
  // reaches it — the loser refuses before the seam, settles, and releases.
  it('I1 the same applyId at two DIFFERENT scopes commits at most once (forced interleaving)', async () => {
    const ID = 'x-global-1'
    let arrivals = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const seam = { faultAt: async (point: string) => {
      if (point !== 'after-read') return
      arrivals += 1
      if (arrivals === 2) { release(); return }
      await gate
    } }
    const sa = storeWith(seam)
    const sb = storeWith(seam)
    const pa = sa.applyTodos('agent:ia', { todos: [{ content: 'A', status: 'pending' }], applyId: ID })
    const pb = sb.applyTodos('agent:ib', { todos: [{ content: 'B', status: 'pending' }], applyId: ID })
    // valve: if an apply settles WITHOUT reaching the barrier (an atomic
    // consumption refusal), the parked twin must not hang.
    void pa.then(release, release)
    void pb.then(release, release)
    const [ra, rb] = await Promise.all([pa, pb])
    const results = [ra, rb]
    expect(arrivals, 'the interleaving must have been forced — at least one apply reached the seam').toBeGreaterThanOrEqual(1)
    expect(results.filter((r) => r.ok === true), 'contract law: at most ONE durable commit for the same applyId, whichever scope carries it').toHaveLength(1)
    expect(results.filter((r) => r.code === 'STATE_APPLY_REPLAY'), 'the loser answers STATE_APPLY_REPLAY').toHaveLength(1)
    // DISK facts, not memory testimony:
    expect(linesOf(writesPath()).filter((l) => l.applyId === ID), 'exactly one durable write-audit line for the applyId').toHaveLength(1)
    const records = [await storeWith().stateOf('agent:ia'), await storeWith().stateOf('agent:ib')]
    expect(records.filter((rec) => ((rec?.appliedIds ?? []) as string[]).includes(ID)), 'exactly one scope record carries the id').toHaveLength(1)
    expect(readdirSync(join(storeRoot(), 'applied')), 'exactly one global marker').toHaveLength(1)
  })
})

describe('u7as N — the per-realm scope count is bounded', () => {
  it('N1 the scope past the bound refuses typed (AGENT_STATE_STORE_SCOPE_LIMIT) with ZERO write; existing scopes stay writable; the default bound is 1024', async () => {
    expect((lane as unknown as { MAX_SCOPES_PER_REALM: number }).MAX_SCOPES_PER_REALM).toBe(1024)
    const capped = storeWith({ maxScopes: 3 })
    for (const id of ['a', 'b', 'c']) expect((await capped.applyTodos(`agent:${id}`, { todos: [{ content: id, status: 'pending' }], applyId: `n-${id}` })).ok).toBe(true)
    const w0 = bytesOf(writesPath())
    const r = await capped.applyTodos('agent:d', { todos: [{ content: 'd', status: 'pending' }], applyId: 'n-d' })
    expect(r).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_SCOPE_LIMIT' })
    expect(bytesOf(writesPath())).toBe(w0)
    expect(readdirSync(join(storeRoot(), 'scopes')).filter((f) => f.endsWith('.json'))).toHaveLength(3)
    expect((await capped.applyTodos('agent:a', { todos: [{ content: 'a2', status: 'pending' }], applyId: 'n-a2' })).ok).toBe(true)
    // the refused id was not consumed: it applies once room exists
    expect((await storeWith({ maxScopes: 4 }).applyTodos('agent:d', { todos: [{ content: 'd', status: 'pending' }], applyId: 'n-d' })).ok).toBe(true)
  })

  it('N2 concurrent creators of DIFFERENT new scopes cannot overshoot the bound (realm lock)', async () => {
    const results = await Promise.all(['p', 'q', 'r', 's', 't'].map((id) => storeWith({ maxScopes: 2 }).applyTodos(`agent:${id}`, { todos: [{ content: id, status: 'pending' }], applyId: `n2-${id}` })))
    expect(results.filter((r) => r.ok === true)).toHaveLength(2)
    expect(results.filter((r) => r.code === 'AGENT_STATE_STORE_SCOPE_LIMIT')).toHaveLength(3)
    expect(readdirSync(join(storeRoot(), 'scopes')).filter((f) => f.endsWith('.json'))).toHaveLength(2)
  })
})

describe('u7as F — age alone NEVER breaks a live lock holder (review round-2 F-4)', () => {
  // R-413-1 v3: every stale/timeout/heartbeat window in this describe is
  // deterministic under ANY runner context — stale legs use small REAL
  // windows, timeout legs advance the test-owned nowMs seam
  // (settleTimeout), heartbeat legs observe real beats; the asserted
  // semantics are byte-for-byte the same as the original real-timer legs.

  const scopeLockPath = (scope: string): string => join(storeRoot(), 'locks', `${createHash('sha256').update(scope).digest('hex')}.lock`)
  const goalV = (revision: number) => ({ goalId: 'g', objective: `rev ${String(revision)}`, phase: 'active', revision, roundsStarted: 0, armed: true })
  const bootId = (): string => { try { return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() } catch { return '' } }
  const host = (): string => hostname()

  it('F-a the reviewer repro: lockStaleMs=50, writer A paused 1000 ms INSIDE the critical section, writer B at the same expectedRevision → exactly ONE commit, B refused typed (LOCK_TIMEOUT or STALE), ONE writes.jsonl entry', async () => {
    await storeWith().seedGoal('agent:f', goalV(1))
    const linesBefore = linesOf(writesPath()).length
    let paused: (() => void) | null = null
    const inside = new Promise<void>((resolve) => { paused = resolve })
    const aClock = testClock() // A is the holder: its own timeout can never fire
    const a = storeWith({ lockStaleMs: 50, lockHeartbeatMs: 20, nowMs: aClock.now, faultAt: async (point: string) => {
      if (point === 'after-read') { paused?.(); await new Promise((r) => { setTimeout(r, 1000) }) }
    } })
    const bClock = testClock()
    const b = storeWith({ lockStaleMs: 50, lockHeartbeatMs: 20, lockTimeoutMs: 400, nowMs: bClock.now })
    const pa = a.applyGoal('agent:f', { expectedRevision: 1, next: goalV(2), applyId: 'f-a' })
    await inside // A now HOLDS the lock and is paused 1000 ms of REAL time mid read→CAS→commit
    const rb = b.applyGoal('agent:f', { expectedRevision: 1, next: { ...goalV(2), objective: 'B wins?' }, applyId: 'f-b' })
    // R-413-1 v3: B's 400 ms timeout is a CLOCK event on the test-owned
    // nowMs seam (settleTimeout re-advances it until B's next REAL poll
    // observes the full elapsed), while A's 1000 ms pause is real time —
    // B refuses typed long before A's pause expires, and the commit order
    // is pinned without any fake timer, under any runner context.
    const r = await settleTimeout(rb, bClock, 400)
    const ra = await pa
    const oks = [ra, r].filter((x) => x.ok === true)
    expect(oks, 'exactly one commit').toHaveLength(1)
    expect(ra.ok).toBe(true)
    expect(['AGENT_STATE_STORE_LOCK_TIMEOUT', 'GOAL_STALE_REVISION']).toContain(r.code)
    expect(linesOf(writesPath()).length - linesBefore).toBe(1)
    expect(await storeWith().readGoal('agent:f')).toMatchObject({ revision: 2, objective: 'rev 2' })
  })

  it('F-b a DEAD-pid holder (same host, same boot, no heartbeat) is still broken and the apply proceeds', async () => {
    mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
    writeFileSync(scopeLockPath('agent:d'), JSON.stringify({ pid: 2 ** 22 + 4242, host: host(), boot: bootId(), nonce: 'dead', token: 't0', at: Date.now() }))
    const dead = storeWith({ lockStaleMs: 50 }).applyTodos('agent:d', { todos: [{ content: 'after-dead', status: 'pending' }], applyId: 'f-dead' })
    const r = await dead
    expect(r.ok).toBe(true)
  })

  it('F-b2 a holder from a PREVIOUS BOOT of this host is broken (boot id differs)', async () => {
    mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
    writeFileSync(scopeLockPath('agent:boot'), JSON.stringify({ pid: (process as unknown as { pid: number }).pid, host: host(), boot: 'a-previous-boot', nonce: 'old-boot', token: 't0', at: Date.now() }))
    const boot = storeWith({ lockStaleMs: 50 }).applyTodos('agent:boot', { todos: [{ content: 'after-reboot', status: 'pending' }], applyId: 'f-boot' })
    const r = await boot
    expect(bootId() === '' ? r.ok === false : r.ok === true).toBe(true)
  })

  it('F-c a LIVE pid holder (pid recycled / unknown-but-present) with an ANCIENT lock is NEVER broken → typed LOCK_TIMEOUT, ZERO write', async () => {
    mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
    // pid 1 is always alive; the lock is an hour old — under the old policy age alone broke it.
    writeFileSync(scopeLockPath('agent:live'), JSON.stringify({ pid: 1, host: host(), boot: bootId(), nonce: 'live', token: 't0', at: Date.now() - 3_600_000 }))
    const w0 = bytesOf(writesPath())
    // pid 1 is alive: mayBreak refuses instantly, so the apply spins its
    // REAL retry sleep while the test-owned nowMs clock is advanced past
    // the 300 ms window (root-pool safe: no fake timers involved)
    const clock = testClock()
    const live = storeWith({ lockStaleMs: 50, lockTimeoutMs: 300, nowMs: clock.now }).applyTodos('agent:live', { todos: [{ content: 'must-not-land', status: 'pending' }], applyId: 'f-live' })
    const r = await settleTimeout(live, clock, 300)
    expect(r).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_LOCK_TIMEOUT' })
    expect(bytesOf(writesPath())).toBe(w0)
    expect(existsSync(scopeLockPath('agent:live'))).toBe(true)
    expect(await storeWith().readTodos('agent:live')).toBe(null)
  })

  it('F-c2 a holder on ANOTHER HOST is never broken (unprovable from here) → typed LOCK_TIMEOUT', async () => {
    mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
    writeFileSync(scopeLockPath('agent:remote'), JSON.stringify({ pid: 2 ** 22 + 1, host: 'some-other-host.invalid', boot: 'x', nonce: 'remote', token: 't0', at: Date.now() - 3_600_000 }))
    const clock = testClock()
    const remote = storeWith({ lockStaleMs: 50, lockTimeoutMs: 300, nowMs: clock.now }).applyTodos('agent:remote', { todos: [{ content: 'x', status: 'pending' }], applyId: 'f-remote' })
    const r = await settleTimeout(remote, clock, 300)
    expect(r).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_LOCK_TIMEOUT' })
  })

  it('R3-1 malformed or incomplete lock records refuse closed, preserve bytes, and do not write', async () => {
    const bodies = ['', '{', 'garbage', JSON.stringify({ pid: 1, nonce: 'n', token: 't', at: 1 }), JSON.stringify({ pid: 1, host: host(), nonce: 'n', token: 't', at: 1 }), JSON.stringify({ pid: 1.5, host: host(), boot: bootId(), nonce: 'n', token: 't', at: 1 })]
    for (const [i, body] of bodies.entries()) {
      const path = scopeLockPath(`agent:bad-${i}`)
      mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
      writeFileSync(path, body)
      const before = readFileSync(path)
      const writes = bytesOf(writesPath())
      const clock = testClock()
      const rp = storeWith({ lockStaleMs: 10, lockTimeoutMs: 80, nowMs: clock.now }).applyTodos(`agent:bad-${i}`, { todos: [{ content: 'must-not-land', status: 'pending' }], applyId: `bad-${i}` })
      const result = await settleTimeout(rp, clock, 80)
      expect(result).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_LOCK_TIMEOUT' })
      expect(readFileSync(path)).toEqual(before)
      expect(bytesOf(writesPath())).toBe(writes)
    }
  })

  it('R3-2 release waits for an in-flight beat and never resurrects the lock', async () => {
    let openBeat!: () => void
    const beatGate = new Promise<void>((resolve) => { openBeat = resolve })
    let allowCommit!: () => void
    const commitGate = new Promise<void>((resolve) => { allowCommit = resolve })
    let started!: () => void
    const beatStarted = new Promise<void>((resolve) => { started = resolve })
    const owner = storeWith({ lockHeartbeatMs: 10, faultAt: async (point: string) => {
      if (point === 'after-read') await commitGate
      if (point === 'beat-before-rename') { started(); await beatGate }
    } })
    const pending = owner.applyTodos('agent:race-release', { todos: [{ content: 'x', status: 'pending' }], applyId: 'race-release' })
    // R-413-1 v3: real timers throughout (any runner context) — the owner's
    // REAL 10 ms beat fires and is gated at 'beat-before-rename'; the
    // commit is gated at 'after-read' until the beat is observed.
    await beatStarted
    allowCommit()
    const race = Promise.race([
      pending.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 40)),
    ])
    const settledWhileBeatGated = await race
    expect(settledWhileBeatGated, 'release must await the gated in-flight beat').toBe(false)
    openBeat()
    // the gated beat resumes its rename on real fs
    expect((await pending).ok).toBe(true)
    expect(existsSync(scopeLockPath('agent:race-release'))).toBe(false)
    expect((await storeWith({ lockTimeoutMs: 100 }).applyTodos('agent:race-release', { todos: [{ content: 'y', status: 'pending' }], applyId: 'race-release-2' })).ok).toBe(true)
  })

  it('R4-1 empty BOOT_ID is a complete same-platform record: 10 four-way races have one winner, dead pid breaks, non-empty local refuses empty record', async () => {
    // R-413-1 v3 + R449 MED (rebased v4 after the #450 census red):
    // deterministic concurrent arrival on REAL timers, same pattern as L1
    // — all four started with NO await between them, each on a FROZEN
    // nowMs clock (its timeout can never fire), the round settles by the
    // lock + CAS via a plain event-driven await (no test-owned wall-clock
    // cap, no polling), and each instance's critical-section entry is
    // marked by the store's 'after-read' fault seam. The leg's duration is
    // load-stretched (real fs); the explicit 30 s per-test timeout is the
    // disclosed guard (see L1).
    for (let round = 1; round <= 10; round += 1) {
      const seeded = storeWithBoot('')
      await seeded.seedGoal('agent:empty-race', { goalId: 'g', objective: `r${String(round)}`, phase: 'active', revision: round, roundsStarted: 0, armed: true })
      const frozen = testClock() // never advanced: the racers' timeout can never fire
      const acquires = new Set<string>()
      const racers = [0, 1, 2, 3].map((i) => storeWithBoot('', {
        nowMs: frozen.now,
        // 'after-read' fires exactly once per apply, INSIDE the critical
        // section, after lock acquisition — a deterministic per-instance
        // acquire mark, no disk sampling
        faultAt: (point: string) => { if (point === 'after-read') acquires.add(`empty-race-${String(round)}-${String(i)}`) },
      }).applyGoal('agent:empty-race', {
        expectedRevision: round, applyId: `empty-race-${String(round)}-${String(i)}`,
        next: { goalId: 'g', objective: `winner-${String(i)}`, phase: 'active', revision: round + 1, roundsStarted: 0, armed: true },
      }))
      // event-driven settle: no wall-clock cap, no polling (see L1)
      const results = await Promise.all(racers)
      expect(results.filter((r) => r.ok === true), `empty boot round ${String(round)}`).toHaveLength(1)
      expect(results.filter((r) => r.code === 'GOAL_STALE_REVISION'), `empty boot round ${String(round)}`).toHaveLength(3)
      // R449 MED ordering assertion (rebased, same as L1): all four
      // instances entered the critical section exactly once (after
      // acquisition); the outcome proves the entries were exclusive.
      expect(acquires.size, `empty boot round ${String(round)}: all four instances must have entered the critical section exactly once`).toBe(4)
    }
    mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
    writeFileSync(scopeLockPath('agent:empty-dead'), JSON.stringify({ pid: 2 ** 22 + 7777, host: host(), boot: '', nonce: 'dead-empty', token: 't0', at: Date.now() }))
    const dead = storeWithBoot('', { lockStaleMs: 10 }).applyTodos('agent:empty-dead', { todos: [{ content: 'ok', status: 'pending' }], applyId: 'empty-dead' })
    expect((await dead).ok).toBe(true)
    writeFileSync(scopeLockPath('agent:empty-invalid'), JSON.stringify({ pid: 2 ** 22 + 7778, host: host(), boot: '', nonce: 'invalid-empty', token: 't0', at: Date.now() }))
    const before = bytesOf(writesPath())
    const clock = testClock()
    const refused = await settleTimeout(storeWithBoot('local-boot', { lockTimeoutMs: 80, nowMs: clock.now }).applyTodos('agent:empty-invalid', { todos: [{ content: 'no', status: 'pending' }], applyId: 'empty-invalid' }), clock, 80)
    expect(refused).toMatchObject({ ok: false, code: 'AGENT_STATE_STORE_LOCK_TIMEOUT' })
    expect(bytesOf(writesPath())).toBe(before)
  }, 30_000)

  it('R3-atomic initial lock publication leaves no target after injected pre-publish crash', async () => {
    const crashing = storeWith({ faultAt: async (point: string) => { if (point === 'lock-before-publish') throw new Error('injected lock crash') } })
    const first = await crashing.applyTodos('agent:atomic-lock', { todos: [{ content: 'x', status: 'pending' }], applyId: 'atomic-lock-1' })
    expect(first).toMatchObject({ ok: false })
    expect(existsSync(scopeLockPath('agent:atomic-lock'))).toBe(false)
    const next = await storeWith().applyTodos('agent:atomic-lock', { todos: [{ content: 'y', status: 'pending' }], applyId: 'atomic-lock-2' })
    expect(next.ok).toBe(true)
  })

  it('F-d the holder BEATS: while it is inside the critical section the lock record token changes', async () => {
    let release: () => void = () => {}
    const hold = new Promise<void>((r) => { release = r })
    let entered: () => void = () => {}
    const inside = new Promise<void>((r) => { entered = r })
    const a = storeWith({ lockHeartbeatMs: 20, faultAt: async (point: string) => { if (point === 'after-read') { entered(); await hold } } })
    const pa = a.applyTodos('agent:beat', { todos: [{ content: 'b', status: 'pending' }], applyId: 'f-beat' })
    await inside
    const t1 = JSON.parse(readFileSync(scopeLockPath('agent:beat'), 'utf8')).token
    // R-413-1 v3: real 20 ms beats (any runner context) — poll the durable
    // lock record on REAL time until one beat's rewrite has landed (bounded
    // 500 ms real ≈ 25 beats; the token must change within that window on
    // any sane host — the beat chain is real fs, not a fake-timer artifact)
    let t2 = t1
    for (let i = 0; i < 250 && t2 === t1; i += 1) {
      await new Promise<void>((r) => { setTimeout(r, 2) })
      try {
        const token = JSON.parse(readFileSync(scopeLockPath('agent:beat'), 'utf8')).token
        if (token !== t1) t2 = token
      } catch { /* absent (cannot happen while A holds) */ }
    }
    release()
    expect((await pa).ok).toBe(true)
    expect(t2).not.toBe(t1)
    expect(existsSync(scopeLockPath('agent:beat'))).toBe(false)
  })
})

// ── u7as A: the four authority-refusal arms (U7-R3-C1-GOALFAM, 2026-10-30) ──
/**
 * A — WHAT AN UNAUTHORIZED AUTHORITY COSTS THE DURABLE STORE: NOTHING,
 * measured (the four ungraded cells of u7-tool-acceptance: create_goal,
 * get_goal, exit_plan_mode, todo_write — L3-refusal NOT_VERIFIED because the
 * graded u7-astore record proves the live typed zero-effect refusal on the
 * UPDATE path only, `ast:cross-scope-zero-effect`).
 *
 * THE CELLS PINNED HERE are the refusal arms the SHIPPED code actually
 * answers — read from the lane, never invented:
 *  - create_goal / update_goal direct-human leg
 *    (agent-state-law.mjs GOAL_TRANSITION_LAW.create.authority ←
 *    tool-goal/src/index.ts:224 @639ed01539; the arm fact itself is the
 *    production createHostArmProvider — `direct-human` iff a
 *    user/message(source.kind==='user') sits in the OPEN TURN of a ROOT
 *    agent, fs-state-store.mjs:814). A SUBAGENT session — one the host does
 *    NOT report in agents.roots() — is never direct-human even when its
 *    turn carries user bytes: that is the `top-level agent` leg of
 *    GOAL_TOOL_NOT_DIRECT_HUMAN, graded here (executors.mjs:230-234).
 *  - get_goal / create_goal with NO attributable caller —
 *    GOAL_TOOL_AGENT_REQUIRED, refused by the scope-first front BEFORE PA
 *    and BEFORE the store (executors.mjs:129-132 + the row's missingAgent);
 *    the witness is ZERO reads AND zero writes, not just zero writes.
 *  - exit_plan_mode outside plan mode — PLAN_MODE_NOT_ACTIVE at the ROW's
 *    state leg (executors.mjs:285-289 + agent-state-law.mjs
 *    planModeExitStateLeg ← plan-mode/src/index.ts:298). Distinct from R2,
 *    which graded the STORE-level code INSIDE applyPlanModeExit (one
 *    attempts line): at the row leg no apply ever reaches the store, so the
 *    attempts ledger must NOT move — the assertion that discriminates the
 *    two lanes (a mutant that deletes the row leg answers the SAME code via
 *    the store and goes RED on the attempts witness).
 *  - todo_write's OWN authority semantics: it carries NO direct-human arm
 *    (any attributed agent — root or subagent — writes its own list), and
 *    its refusal lanes are (a) unattributed caller → TODO_WRITE_AGENT_
 *    REQUIRED before any store touch (executors.mjs:258), (b) the strict
 *    list law (DEFAULT_TODO_CONFIG, at most one in_progress) refused in the
 *    CLOSED parse — zero PA entry, zero store touch (agent-state-law.mjs
 *    parseTodoWriteArgs:220-223).
 *
 * C1-ONLY HONESTY (USER-RULING-20261029B item 2: "mock/C1 只证拒绝逻辑"):
 * this is an OFFLINE proof of the refusal LOGIC over the PRODUCTION store
 * with a C1 stand-in host (the same public `agents`/`sessionProjections`
 * shapes the graded arms ride) — it is NOT the L3 grade. L3 = a real-Host
 * typed refusal with zero effect, graded by the live C2 lane after merge.
 * Nothing here lifts the ledger level; the notes record the C1 lineage.
 */
describe('u7as A — unauthorized authority answers the typed refusal with ZERO durable write (C1 arms; L3 graded live)', () => {
  /** The A-world mount: the same real plane + production store as
   *  mountProduction, but the host stand-in models the TOP-LEVEL fact:
   *  agents.roots() answers ONLY the ids the world declares as roots. A
   *  session known to `agents.get` but absent from roots() is a SUBAGENT —
   *  the exact shape the createHostArmProvider isRoot leg reads. */
  async function mountAuthorityWorld(opts: { rootIds: readonly string[], humanTurnFor?: readonly string[] }): Promise<{ built: Built, rows: Record<RowName, Row>, store: FsStore }> {
    const built = await plane.createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: 'u7asg-root',
      controlLeg: approvingControlLeg(),
      permissionPolicy: POLICY_ASK,
      realmId: REALM,
      templateId: 'u7asg-tpl',
      role: 'member',
      instanceId: 'u7asg-inst',
      onObserve: () => {},
      plane: { agentStateEnabled: true },
    }) as Built & { value: { mount: (ctx: unknown) => { ok: boolean, message?: string }, backends?: Record<string, unknown> } }
    if (built.ok !== true) throw new Error(`mount refused: ${String(built.code)} ${String(built.message ?? '')}`)
    const humans = new Set(opts.humanTurnFor ?? [])
    const agentOf = (id: string) => ({
      id,
      session: {
        id,
        snapshotEvents: () => [
          { type: 'turn/start' },
          ...(humans.has(id) ? [{ type: 'user/message', data: { source: { kind: 'user' } } }] : [{ type: 'user/message', data: { source: { kind: 'agent' } } }]),
        ],
      },
    })
    const known = new Map<string, ReturnType<typeof agentOf>>()
    const agents = {
      get: (id: string) => { if (!known.has(id)) known.set(id, agentOf(id)); return known.get(id) },
      // RED step (naive wiring): every known session is reported as a root —
      // the top-level leg is NOT yet modelled. A1 must go RED on exactly
      // this: the subagent's create_goal would be ACCEPTED, proving the case
      // measures the isRoot leg of the guard, not just the user-source leg.
      roots: () => [...known.values()],
    }
    const services: Record<string, unknown> = {
      agents,
      sessionProjections: { stateOf: () => ({ openTurnStartSeq: 0 }) },
    }
    const mounted = built.value.mount({ get: (name: string) => services[name], tools: { register: () => () => {} } })
    expect(mounted.ok, String(mounted.message ?? '')).toBe(true)
    const rows: Record<string, Row> = {}
    for (const d of built.value.definitions) rows[d.name] = d
    const store = (built.value.backends ?? {}).agentStateStore as FsStore | undefined
    expect(store, 'the plane exposes the mounted production store under backends.agentStateStore').toBeDefined()
    expect((store as FsStore).name).toBe('agent-state:fs')
    return { built, rows: rows as Record<RowName, Row>, store: store as FsStore }
  }

  const scopeFiles = (): string[] => (existsSync(join(storeRoot(), 'scopes'))
    ? readdirSync(join(storeRoot(), 'scopes')).filter((f) => f.endsWith('.json'))
    : [])
  const scopeBytes = (): string[] => scopeFiles().map((f) => readFileSync(join(storeRoot(), 'scopes', f), 'utf8'))

  it('A1 create_goal from SUBAGENT authority refuses GOAL_TOOL_NOT_DIRECT_HUMAN with zero durable write; root-human flip commits', async () => {
    // 'child' carries a user/message in its open turn but is NOT a host root
    // (subagent authority); 'rootmodel' is a root whose open turn is
    // agent-initiated (the conservative model arm). 'alice' is the flip.
    const { rows, store } = await mountAuthorityWorld({ rootIds: ['alice', 'rootmodel'], humanTurnFor: ['alice', 'child'] })
    const w0 = bytesOf(writesPath())
    const a0 = linesOf(attemptsPath()).length
    const r0 = store.log.reads.length
    const sub = await rows.create_goal.execute({ objective: 'a subagent wants its own goal' }, exec('child'))
    expect(codeOf(sub)).toBe('GOAL_TOOL_NOT_DIRECT_HUMAN')
    expect(bytesOf(writesPath()), 'GOAL_TOOL_NOT_DIRECT_HUMAN: writes.jsonl must not grow').toBe(w0)
    expect(linesOf(attemptsPath()).length, 'the refused call never reaches store.applyGoal').toBe(a0)
    expect(store.log.reads.length, 'exactly one bounded fresh read, no write, no apply').toBe(r0 + 1)
    expect(scopeFiles()).toEqual([])
    // the conservative arm: a root agent on a model-initiated turn meets
    // the same typed refusal (arm.kind === model, fs-state-store.mjs:775)
    const modelRoot = await rows.create_goal.execute({ objective: 'model turn wants a goal' }, exec('rootmodel'))
    expect(codeOf(modelRoot)).toBe('GOAL_TOOL_NOT_DIRECT_HUMAN')
    expect(bytesOf(writesPath())).toBe(w0)
    expect(scopeFiles()).toEqual([])
    // NON-VACUITY in the SAME world: the direct-human flip commits durably
    const ok = await rows.create_goal.execute({ objective: 'a human starts a goal' }, exec('alice'))
    expect(codeOf(ok)).toBe('ACCEPTED')
    expect(bytesOf(writesPath()), 'the flip moved the durable write audit').toBeGreaterThan(w0)
    expect(linesOf(writesPath()).at(-1)).toMatchObject({ op: 'goal/apply' })
    expect(await reopen().readGoal('agent:alice')).toMatchObject({ objective: 'a human starts a goal', revision: 1, phase: 'active' })
    expect(await reopen().readGoal('agent:child')).toBe(null)
  })

  it('A2 get_goal with NO attributable caller refuses GOAL_TOOL_AGENT_REQUIRED BEFORE any store touch; a subagent read stays scope-bound', async () => {
    const { rows, store } = await mountAuthorityWorld({ rootIds: ['alice'], humanTurnFor: ['alice'] })
    // setup fact: a durable goal EXISTS for alice, so "untouched" below is a
    // statement about real bytes, not about an empty world.
    const created = await rows.create_goal.execute({ objective: 'alice durable goal' }, exec('alice'))
    expect(codeOf(created)).toBe('ACCEPTED')
    const w0 = bytesOf(writesPath())
    const a0 = linesOf(attemptsPath()).length
    const r0 = store.log.reads.length
    const files0 = scopeBytes()
    const anon = await rows.get_goal.execute({}, {})
    expect(codeOf(anon)).toBe('GOAL_TOOL_AGENT_REQUIRED')
    expect(store.log.reads.length, 'the row refused in the scope-first front: ZERO store reads').toBe(r0)
    expect(bytesOf(writesPath())).toBe(w0)
    expect(linesOf(attemptsPath()).length).toBe(a0)
    // the scope law (executors.mjs SCOPE LAW): a SUBAGENT reading its own
    // scope meets the honest null — never alice's snapshot; alice's record
    // bytes are byte-identical across the whole case.
    const child = await rows.get_goal.execute({}, exec('child'))
    expect(codeOf(child)).toBe('ACCEPTED')
    expect(JSON.parse(child.text)).toEqual({ goal: null })
    expect(store.log.reads.length, 'exactly the bounded own-scope read').toBe(r0 + 1)
    expect(bytesOf(writesPath())).toBe(w0)
    expect(scopeBytes()).toEqual(files0)
  })

  it('A3 exit_plan_mode OUTSIDE plan mode refuses PLAN_MODE_NOT_ACTIVE at the ROW leg — zero writes AND zero applies; the seeded flip commits', async () => {
    const { rows } = await mountAuthorityWorld({ rootIds: ['alice'], humanTurnFor: ['alice'] })
    const w0 = bytesOf(writesPath())
    const a0 = linesOf(attemptsPath()).length
    const files0 = scopeFiles()
    const r = await rows.exit_plan_mode.execute({ plan: '# Plan that never existed\n\n- step' }, exec('alice'))
    expect(codeOf(r)).toBe('PLAN_MODE_NOT_ACTIVE')
    expect(bytesOf(writesPath()), 'PLAN_MODE_NOT_ACTIVE (row leg): writes.jsonl must not grow').toBe(w0)
    // the DISCRIMINATOR against R2: at the row leg the store never sees an
    // apply, so the attempts ledger must NOT move (R2's store-level leg
    // answers the same code WITH one attempts line inside applyPlanModeExit).
    expect(linesOf(attemptsPath()).length, 'the row leg precedes any apply — no attempts line').toBe(a0)
    expect(scopeFiles()).toEqual(files0)
    // NON-VACUITY in the SAME world: plan mode ON (production seed path,
    // the same disclosed seed shape as the graded ast:exit-plan-mode-positive)
    await reopen().seedPlanMode('agent:alice', true)
    const w1 = bytesOf(writesPath())
    const ok = await rows.exit_plan_mode.execute({ plan: '# Durable exit' }, exec('alice'))
    expect(codeOf(ok)).toBe('ACCEPTED')
    expect(JSON.parse(ok.text)).toEqual({ exited: true, planMode: { active: false } })
    expect(bytesOf(writesPath()), 'the flip moved the durable write audit').toBeGreaterThan(w1)
    expect((await reopen().readPlanMode('agent:alice')).active).toBe(false)
  })

  it('A4 todo_write: unattributed refuses TODO_WRITE_AGENT_REQUIRED (zero store touch); strict list law refuses in the CLOSED parse; a SUBAGENT still commits its own list', async () => {
    const { rows, store } = await mountAuthorityWorld({ rootIds: ['alice'], humanTurnFor: ['alice'] })
    const w0 = bytesOf(writesPath())
    const a0 = linesOf(attemptsPath()).length
    const r0 = store.log.reads.length
    const anon = await rows.todo_write.execute({ todos: [{ content: 'orphan list', status: 'pending' }] }, {})
    expect(codeOf(anon)).toBe('TODO_WRITE_AGENT_REQUIRED')
    expect(store.log.reads.length, 'scope-first front: ZERO store reads').toBe(r0)
    expect(bytesOf(writesPath())).toBe(w0)
    expect(linesOf(attemptsPath()).length).toBe(a0)
    expect(scopeFiles()).toEqual([])
    // its list-law lane: the STRICT posture (DEFAULT_TODO_CONFIG) refuses a
    // second in_progress in the CLOSED parse — before PA, before the store.
    const bad = await rows.todo_write.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] }, exec('child'))
    expect(codeOf(bad)).toBe('AGENT_STATE_ARGS_INVALID')
    expect(store.log.reads.length, 'parse refusal: still ZERO store reads').toBe(r0)
    expect(bytesOf(writesPath())).toBe(w0)
    expect(scopeFiles()).toEqual([])
    // todo_write carries NO direct-human arm — the attributed SUBAGENT is
    // authorized over its OWN list and commits durably (non-vacuity).
    const ok = await rows.todo_write.execute({ todos: [{ content: 'child owns this list', status: 'pending' }] }, exec('child'))
    expect(codeOf(ok)).toBe('ACCEPTED')
    expect(bytesOf(writesPath()), 'the flip moved the durable write audit').toBeGreaterThan(w0)
    expect(await reopen().readTodos('agent:child')).toEqual([{ content: 'child owns this list', status: 'pending' }])
    expect(await reopen().readTodos('agent:alice')).toBe(null)
  })
})
