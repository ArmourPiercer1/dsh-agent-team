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
 *  S  byte-exact scoping — `a`, `a `, ` a` are three scopes, never aliases.
 *  B  bounds — an oversized record refuses typed; corrupt/foreign-key
 *     records fail CLOSED (typed), never "empty state".
 *  K  hardlink + symlink law on the read path (nlink>1 refused — the #409
 *     law, pinned here so the swap to the shared symbol is behaviour-
 *     preserving).
 *  C  crash atomicity — a writer that dies mid-record leaves the PREVIOUS
 *     record intact. MUTATION CONTROL: a store whose writer skips the
 *     temp+rename (writes the target in place) goes RED on the same check.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync, linkSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
