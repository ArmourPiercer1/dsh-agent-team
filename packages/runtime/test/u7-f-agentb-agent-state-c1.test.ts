/**
 * U7-F B C1 — the AGENT-STATE family over the REAL chain: a real plane
 * mount (the REAL reviewed family set — this family is in the reviewed
 * manifest), the plane's own lane verdict + the Kernel's PA admission edge
 * (admit → ask → the C1 stand-in landing leg that mints the grant through
 * the real `assembly.issueApprovedGrant` → the one-shot consume inside the
 * edge), and the family's rows executing over the INJECTED recording
 * state-store port. Every refusal leg pairs the ANSWER with the STORE FACT
 * (the recording log + the byte-compare of untouched scopes), never with a
 * guard light alone — the u7-9a honesty discipline, composed for state.
 *
 * Pinned laws proven here (per the task):
 *  READ vs MUTATION split — visible in the contribution's declared arms
 *    AND in every per-call PA request (E1): `get_goal` requests the
 *    metadata `meta` arm ONLY; the four mutators request their own
 *    `tool-invoke` arm + the `meta` arm of the state they observe.
 *  SCOPE — the state scope is the CALLING agent (`exec.agent.id`), never
 *    an argument: a call that names ANOTHER agent's goal (S1, planted)
 *    answers the typed CAS refusal with ZERO touches on the foreign scope
 *    (the recording store's own log proves zero reach).
 *  TRANSITIONS — the full pinned table (T1) answers typed refusals
 *    (GOAL_ALREADY_EXISTS / GOAL_INVALID_TRANSITION / GOAL_STALE_REVISION /
 *    GOAL_NOT_FOUND / GOAL_TOOL_* / GOAL_TOOL_BLOCK_THRESHOLD) with ZERO
 *    durable writes; every applied transition advances the revision
 *    EXACTLY ONE (fold law).
 *  IDEMPOTENCE — a consumed grant never applies twice: in-flight token
 *    replay refused, settled token settles CANCELLED (R1a/R1b), a re-driven
 *    mutation with a fresh call meets the advanced revision (R1d), and the
 *    store's applyId ledger refuses a double apply outright (R1c).
 *  BOUNDED READS — get_goal performs exactly ONE snapshot read of the
 *    CALLER's scope (P1).
 *  FAIL CLOSED — default-deny template: every call refuses
 *    IO_POLICY_UNSUPPORTED / template-default-deny with ZERO store access
 *    and ZERO PA entry (D1); the denying leg settles deny with the body
 *    never run (D2); an enabled family without its store never mounts (M1).
 */
import { describe, it, expect } from 'vitest'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'

// The untyped .mjs faces ride the u7-9a discipline: dynamic import + an
// explicit `as` shape (no ambient any).
type RowName = 'todo_write' | 'create_goal' | 'get_goal' | 'update_goal' | 'exit_plan_mode'
type LogEntry = { op: string, scope: string, key: string, applyId?: string }
type AttemptEntry = LogEntry & { outcome: 'applied' | 'refused', code?: string }
type ScopeState = {
  goal: Record<string, unknown> | null
  todos: Array<Record<string, unknown>> | null
  planMode: { active: boolean, pendingIntents: Array<Record<string, unknown>> }
}
type RecordingStore = {
  log: { reads: LogEntry[], writes: LogEntry[], attempts: AttemptEntry[] }
  setArm: (scope: string, arm: Record<string, unknown>) => void
  seed: (scope: string, patch: Partial<{ goal: Record<string, unknown> | null, todos: Array<Record<string, unknown>> | null, planMode: ScopeState['planMode'] }>) => void
  stateOf: (scope: string) => ScopeState | null
  armFor: (scope: string) => Record<string, unknown>
  readGoal: (scope: string) => Promise<Record<string, unknown> | null>
  applyGoal: (scope: string, op: Record<string, unknown>) => Promise<{ ok: boolean, code?: string, detail?: string, snapshot?: Record<string, unknown> }>
  readTodos: (scope: string) => Promise<Array<Record<string, unknown>> | null>
  applyTodos: (scope: string, op: { todos: Array<Record<string, unknown>>, applyId: string }) => Promise<{ ok: boolean, code?: string, detail?: string }>
  readPlanMode: (scope: string) => Promise<ScopeState['planMode']>
  applyPlanModeExit: (scope: string, op: Record<string, unknown>) => Promise<{ ok: boolean, code?: string, detail?: string }>
}
type LaneModule = {
  createRecordingStateStore: () => RecordingStore
  buildAgentStateContribution: (input: { rowDefinitions: unknown[] }) => { effects: { kinds: readonly string[] }, definition: { outputContractDigest: string } }
  buildAgentStateRowDefinitions: (input: Record<string, unknown>) => unknown[]
  AGENT_STATE_NAMES: readonly RowName[]
  AGENT_STATE_EFFECT_ARMS: Record<'todo_write' | 'create_goal' | 'get_goal' | 'update_goal' | 'exit_plan_mode', readonly string[]>
  GOAL_TRANSITION_LAW: {
    hostPin: string
    cas: { cite: string }
    fold: { cite: string }
    actions: Record<'edit' | 'pause' | 'resume' | 'complete' | 'blocked', { phase: { from: readonly string[] } }>
  }
}
type PlaneModule = { createTeamToolPlaneAssembly: (input: unknown) => Built | Promise<Built> }
const lanePromise = import(new URL('../../tools/agent-state-family/src/index.mjs', import.meta.url).href) as unknown as Promise<LaneModule>
const planePromise = import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href) as unknown as Promise<PlaneModule>
const { createRecordingStateStore, buildAgentStateContribution, buildAgentStateRowDefinitions, AGENT_STATE_NAMES, AGENT_STATE_EFFECT_ARMS, GOAL_TRANSITION_LAW } = await lanePromise
const planeModule = await planePromise

const REALM = 'u7fb-realm'
const fsInstance = { fs: 'u7fb-ctl', rootDir: '/u7fb-root', realmId: REALM, kind: 'absolute-path' }
const POLICY_ASK = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const POLICY_DENY = Object.freeze({ default: 'deny', allow: [], ask: [], deny: [] })

type RowOutcome = { text: string, refusal?: { code: string, detail: string } }
type Row = { name: string, execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<RowOutcome> }
type PlaneValue = {
  definitions: readonly Row[]
  kernelGuard: { owns(n: string): boolean, identityFor(n: string): string | null }
  centerKernel: { familyIds: readonly string[], registry: { view(): { candidates: readonly { familyId: string, origin: string }[] } } }
}
type Built = { ok: boolean, code?: string, message?: string, value: PlaneValue }

async function mount(opts: {
  policy?: Record<string, unknown>
  leg?: unknown
  agentStateEnabled?: boolean | undefined
  store?: unknown
} = {}): Promise<Built> {
  return await planeModule.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7fb-root',
    controlLeg: opts.leg ?? approvingControlLeg(),
    permissionPolicy: opts.policy ?? POLICY_ASK,
    realmId: REALM,
    templateId: 'u7fb-tpl',
    role: 'member',
    instanceId: 'u7fb-inst',
    onObserve: () => {},
    ...(opts.store === undefined ? {} : { backends: { agentState: opts.store } }),
    plane: {
      fsInstance,
      ...(opts.agentStateEnabled === undefined ? {} : { agentStateEnabled: opts.agentStateEnabled }),
    },
  }) as Built
}

const rowsOf = (built: Built): Record<RowName, Row> => {
  const out: Record<string, Row> = {}
  for (const d of built.value.definitions) out[d.name] = d
  for (const n of AGENT_STATE_NAMES) {
    if (out[n] === undefined) throw new Error(`row ${n} absent from the mount (the five rows must place together)`)
  }
  return out as Record<RowName, Row>
}
const execFor = (agentId: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ agent: { id: agentId }, ...extra })
const refusedAs = (r: RowOutcome): { code: string, detail: string } => {
  expect(r.text.startsWith('refused: ')).toBe(true)
  const body = r.text.slice('refused: '.length)
  return { code: body.split(' \u2014 ')[0] ?? '', detail: body }
}
const seededGoal = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  goalId: id, objective: `objective of ${id}`, phase: 'active', revision: 1, roundsStarted: 0, armed: true, ...over,
})

describe('u7fb M — the mount law', () => {
  it('Z0 zero flip: with the key ABSENT the family places nothing and owns nothing (byte-identical to the key=false mount)', async () => {
    const absent = await mount({})
    expect(absent.ok, `mount refused: ${String(absent.code)} ${String(absent.message ?? '')}`).toBe(true)
    const off = await mount({ agentStateEnabled: false })
    expect(off.ok).toBe(true)
    const names = (b: Built) => b.value.definitions.map((d) => d.name)
    expect(names(absent)).toEqual(names(off))
    for (const n of AGENT_STATE_NAMES) {
      expect(names(absent)).not.toContain(n)
      expect(absent.value.kernelGuard.owns(n)).toBe(false)
    }
  })

  it('M1 enabled + store mounted: all five rows place, the kernel owns them, the contribution registers from the reviewed manifest', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    expect(built.ok, `mount refused: ${String(built.code)} ${String(built.message ?? '')}`).toBe(true)
    const rows = rowsOf(built)
    for (const n of AGENT_STATE_NAMES) {
      expect(rows[n], `row ${n} placed`).toBeDefined()
      expect(built.value.kernelGuard.owns(n)).toBe(true)
      expect(built.value.kernelGuard.identityFor(n)).toBeTruthy()
    }
    expect(built.value.centerKernel.registry.view().candidates.some((c) => c.familyId === 'dsh.agent-state-family')).toBe(true)
    expect(built.value.centerKernel.familyIds).toContain('dsh.agent-state-family')
  })

  it('M2 enabled WITHOUT the store port: the whole assembly refuses (PLANE_AGENT_STATE_STORE_MISSING) — an enabled family with no durable face never mounts', async () => {
    const built = await mount({ agentStateEnabled: true })
    expect(built.ok).toBe(false)
    expect(built.code).toBe('PLANE_AGENT_STATE_STORE_MISSING')
  })
})

describe('u7fb P — authorized positives (ask-default template, real grant, durable fact in the store)', () => {
  it('P1 get_goal on an empty scope: honest {goal:null}, exactly ONE bounded read, zero writes', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    const rows = rowsOf(built)
    const r = await rows.get_goal.execute({}, execFor('alice'))
    expect(JSON.parse(r.text)).toEqual({ goal: null })
    expect(store.log.writes).toEqual([])
    expect(store.log.reads).toEqual([{ op: 'goal/read', scope: 'agent:alice', key: 'agent:alice/goal' }])
  })

  it('P2 create_goal on the direct-human arm: revision 1, phase active, armed — the durable fact is in the store', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const rows = rowsOf(built)
    const r = await rows.create_goal.execute({ objective: 'ship U7-F B', max_goal_rounds: 5 }, execFor('alice'))
    expect(JSON.parse(r.text).goal).toMatchObject({ objective: 'ship U7-F B', phase: 'active', revision: 1, rounds_started: 0, max_goal_rounds: 5, armed: true })
    const persisted = store.stateOf('agent:alice')?.goal
    expect(persisted).toMatchObject({ objective: 'ship U7-F B', phase: 'active', revision: 1, roundsStarted: 0, maxGoalRounds: 5, armed: true })
    expect(store.log.writes.filter((w) => w.op === 'goal/apply')).toHaveLength(1)
  })

  it('P3 get_goal reads the created goal BACK through the same governed row (durable fact read back)', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const rows = rowsOf(built)
    const created = JSON.parse((await rows.create_goal.execute({ objective: 'read me back' }, execFor('alice'))).text).goal
    const read = JSON.parse((await rows.get_goal.execute({}, execFor('alice'))).text).goal
    expect(read).toEqual(created)
  })

  it('P4 todo_write: whole-list replacement lands; the receipt counts; a second call REPLACES (final list = the last call)', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    const rows = rowsOf(built)
    const r1 = await rows.todo_write.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }] }, execFor('alice'))
    expect(JSON.parse(r1.text).counts).toEqual({ pending: 1, inProgress: 1, completed: 0 })
    const r2 = await rows.todo_write.execute({ todos: [{ content: 'a', status: 'completed' }] }, execFor('alice'))
    expect(JSON.parse(r2.text).todos).toEqual([{ content: 'a', status: 'completed' }])
    expect(store.stateOf('agent:alice')?.todos).toEqual([{ content: 'a', status: 'completed' }])
    expect(store.log.writes.filter((w) => w.op === 'todos/apply')).toHaveLength(2)
  })

  it('P5 exit_plan_mode in active plan mode: the approved plan commits post-consume (plan mode off, plan recorded)', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { planMode: { active: true, pendingIntents: [] } })
    const built = await mount({ agentStateEnabled: true, store })
    const rows = rowsOf(built)
    const r = await rows.exit_plan_mode.execute({ plan: '# Ship U7-F\n\n- do it' }, execFor('alice'))
    expect(JSON.parse(r.text)).toEqual({ exited: true, planMode: { active: false } })
    const pm = store.stateOf('agent:alice')?.planMode
    expect(pm?.active).toBe(false)
    expect(pm?.pendingIntents).toHaveLength(1)
    expect(String(pm?.pendingIntents[0]?.plan)).toContain('# Ship U7-F')
  })

  it('P6 the positive transition legs: pause (direct human), edit, complete (direct human), blocked (exact goal round at/over the minimum), resume from blocked', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    const rows = rowsOf(built)
    store.seed('agent:alice', { goal: seededGoal('g1') })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const paused = JSON.parse((await rows.update_goal.execute({ goal_id: 'g1', revision: 1, action: 'pause' }, execFor('alice'))).text).goal
    expect(paused).toMatchObject({ phase: 'paused', revision: 2 })
    store.seed('agent:alice', { goal: seededGoal('g1', { revision: 3 }) })
    const edited = JSON.parse((await rows.update_goal.execute({ goal_id: 'g1', revision: 3, action: 'edit', objective: 'new objective' }, execFor('alice'))).text).goal
    expect(edited).toMatchObject({ objective: 'new objective', revision: 4 })
    store.seed('agent:alice', { goal: seededGoal('g1', { revision: 5 }) })
    const done = JSON.parse((await rows.update_goal.execute({ goal_id: 'g1', revision: 5, action: 'complete' }, execFor('alice'))).text).goal
    expect(done).toMatchObject({ phase: 'complete', revision: 6, armed: false })
    store.seed('agent:alice', { goal: seededGoal('g1', { revision: 2, roundsStarted: 3 }) })
    store.setArm('agent:alice', { kind: 'goal-round', goalId: 'g1', revision: 2, round: 3 })
    const blocked = JSON.parse((await rows.update_goal.execute({ goal_id: 'g1', revision: 2, action: 'blocked', blocked_reason: 'the same gate keeps failing' }, execFor('alice'))).text).goal
    expect(blocked).toMatchObject({ phase: 'blocked', revision: 3, armed: false, blocked_reason: 'the same gate keeps failing' })
    store.seed('agent:alice', { goal: seededGoal('g1', { phase: 'blocked', revision: 4 }) })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const resumed = JSON.parse((await rows.update_goal.execute({ goal_id: 'g1', revision: 4, action: 'resume' }, execFor('alice'))).text).goal
    expect(resumed).toMatchObject({ phase: 'active', revision: 5, armed: true })
  })
})

describe('u7fb E — the read/mutation split is REAL in the per-call PA request', () => {
  it('E1 every call requests EXACTLY the declared arms: get_goal = meta only (no mutation arm); mutators = own tool-invoke + meta', async () => {
    const store = createRecordingStateStore()
    const seen: { tool: string; arms: string[] }[] = []
    const tokenFor = (a: string): string => (a === 'tool-invoke' ? 'tool-invoke' : 'meta')
    const sorted = (xs: string[]): string[] => [...xs].sort()
    const leg = async (input: { request: { requestedEffects: { effects: { kind: string; toolName?: string }[] } } }) => {
      seen.push({
        tool: String(input.request.requestedEffects.effects.find((e) => e.kind === 'tool-invoke')?.toolName ?? 'get_goal'),
        arms: sorted(input.request.requestedEffects.effects.map((e) => e.kind)),
      })
      return approvingControlLeg()(input as never)
    }
    const built = await mount({ agentStateEnabled: true, store, leg })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const rows = rowsOf(built)
    await rows.get_goal.execute({}, execFor('alice'))
    await rows.create_goal.execute({ objective: 'x' }, execFor('alice'))
    await rows.update_goal.execute({ goal_id: 'nope', revision: 1, action: 'pause' }, execFor('alice'))
    await rows.todo_write.execute({ todos: [{ content: 'a', status: 'pending' }] }, execFor('alice'))
    await rows.exit_plan_mode.execute({ plan: '# p' }, execFor('alice'))
    expect(seen).toEqual([
      { tool: 'get_goal', arms: sorted(AGENT_STATE_EFFECT_ARMS.get_goal.map(tokenFor)) },
      { tool: 'create_goal', arms: sorted(AGENT_STATE_EFFECT_ARMS.create_goal.map(tokenFor)) },
      { tool: 'update_goal', arms: sorted(AGENT_STATE_EFFECT_ARMS.update_goal.map(tokenFor)) },
      { tool: 'todo_write', arms: sorted(AGENT_STATE_EFFECT_ARMS.todo_write.map(tokenFor)) },
      { tool: 'exit_plan_mode', arms: sorted(AGENT_STATE_EFFECT_ARMS.exit_plan_mode.map(tokenFor)) },
    ])
    // The mutation-bearing tool-invoke arm NEVER appears in the read's set:
    expect(seen[0]?.arms).not.toContain('tool-invoke')
  })

  it('E2 per-row declared-vs-requested exactness (review R1 F-3): the contribution union is DERIVED from the per-row table, and each row requests EXACTLY its declared arms', async () => {
    // #404/#406 failure class: a family-wide UNION hides row-granularity
    // drift. The closed governance schema (protected center) fixes
    // `$.effects` to {declared,kinds,targets} — so the declared face here
    // is (a) the contribution's union, now DERIVED from the ONE per-row
    // arms table (never an independent literal), (b) the per-row table
    // itself, which the contribution binds through its outputContractDigest
    // (rows:[{name,arms}]), and (c) THIS test pinning each row's OBSERVED
    // PA request to its declared row arms — exact, per row.
    const store = createRecordingStateStore()
    const contribution = buildAgentStateContribution({
      rowDefinitions: buildAgentStateRowDefinitions({
        realmId: REALM, policy: POLICY_ASK, store,
        decide: async () => ({ decision: 'allow' }), pa: async () => ({ decision: 'allow' }),
      }),
    })
    const kindOf = (token: string): string => (token === 'tool-invoke' ? 'tool-invoke' : token.split(':')[0] as string)
    const sorted = (xs: readonly string[]): string[] => [...xs].sort()
    // (a) The declared union == exactly the kinds the per-row rows declare.
    const derivedUnion = [...new Set(Object.values(AGENT_STATE_EFFECT_ARMS).flat().map(kindOf))].sort()
    expect(sorted(contribution.effects.kinds), 'declared union must be DERIVED from the per-row table').toEqual(derivedUnion)
    // (b) The per-row arms are digest-bound by the contribution.
    expect(contribution.definition.outputContractDigest).toMatch(/^[0-9a-f]{64}$/)
    // (c) Requested face through the REAL PA edge, per row — exact multiset.
    const seen: { tool: string; arms: string[] }[] = []
    const leg = async (input: { request: { requestedEffects: { effects: { kind: string; toolName?: string }[] } } }) => {
      seen.push({
        tool: String(input.request.requestedEffects.effects.find((e) => e.kind === 'tool-invoke')?.toolName ?? 'get_goal'),
        arms: sorted(input.request.requestedEffects.effects.map((e) => e.kind)),
      })
      return approvingControlLeg()(input as never)
    }
    const built = await mount({ agentStateEnabled: true, store, leg })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const rows = rowsOf(built)
    await rows.get_goal.execute({}, execFor('alice'))
    await rows.create_goal.execute({ objective: 'x' }, execFor('alice'))
    await rows.update_goal.execute({ goal_id: 'nope', revision: 1, action: 'pause' }, execFor('alice'))
    await rows.todo_write.execute({ todos: [{ content: 'a', status: 'pending' }] }, execFor('alice'))
    await rows.exit_plan_mode.execute({ plan: '# p' }, execFor('alice'))
    expect(seen).toHaveLength(AGENT_STATE_NAMES.length)
    for (const { tool, arms } of seen) {
      expect(arms, `requested arms of ${tool} === declared row arms`).toEqual(sorted(AGENT_STATE_EFFECT_ARMS[tool as RowName].map(kindOf)))
    }
  })
})

describe('u7fb S — the scope law (planted cross-scope)', () => {
  it('S1a get_goal reads the CALLER only: bob\'s planted goal is never touched', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:bob', { goal: seededGoal('goal-bob', { revision: 2 }) })
    const before = JSON.parse(JSON.stringify(store.stateOf('agent:bob')))
    const built = await mount({ agentStateEnabled: true, store })
    const r = await rowsOf(built).get_goal.execute({}, execFor('alice'))
    expect(JSON.parse(r.text)).toEqual({ goal: null })
    expect(store.log.reads.every((x) => x.scope === 'agent:alice')).toBe(true)
    expect(store.stateOf('agent:bob')).toEqual(before)
  })

  it('S1b planted cross-scope WRITE — update_goal NAMING bob\'s exact goal_id+revision still answers the typed CAS refusal with ZERO reach into bob\'s scope', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:bob', { goal: seededGoal('goal-bob', { revision: 2 }) })
    const before = JSON.parse(JSON.stringify(store.stateOf('agent:bob')))
    const built = await mount({ agentStateEnabled: true, store })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const r = await rowsOf(built).update_goal.execute({ goal_id: 'goal-bob', revision: 2, action: 'pause' }, execFor('alice'))
    // alice has no goal: the CALLER's own fresh state decides — GOAL_NOT_FOUND.
    expect(refusedAs(r).code).toBe('GOAL_NOT_FOUND')
    expect(store.log.writes).toEqual([])
    expect(store.log.reads.every((x) => x.scope === 'agent:alice')).toBe(true)
    expect(store.stateOf('agent:bob')).toEqual(before)
  })

  it('S1c planted cross-scope WRITE with the caller holding her OWN goal: the stale-ref sentence names only the CALLER\'s current; bob stays byte-identical', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { goal: seededGoal('goal-alice') })
    store.seed('agent:bob', { goal: seededGoal('goal-bob', { revision: 7 }) })
    const before = JSON.parse(JSON.stringify(store.stateOf('agent:bob')))
    const built = await mount({ agentStateEnabled: true, store })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const r = await rowsOf(built).update_goal.execute({ goal_id: 'goal-bob', revision: 7, action: 'complete' }, execFor('alice'))
    const refusal = refusedAs(r)
    expect(refusal.code).toBe('GOAL_STALE_REVISION')
    expect(refusal.detail).toContain('current is "goal-alice" revision 1')
    expect(store.log.writes).toEqual([])
    expect(store.log.reads.every((x) => x.scope === 'agent:alice')).toBe(true)
    expect(store.stateOf('agent:bob')).toEqual(before)
  })

  it('S2 whitespace-distinct identities are DISTINCT scopes (review R1 F-2): "a", "a ", " a" never alias; cross-access refuses with zero reach', async () => {
    // The host mints opaque branded ids verbatim (commands.ts:109) and
    // resolves agents by exact Map lookup (commands.ts:450) — there is NO
    // trimming/canonicalisation law on the identity path. A scope key
    // "a" after trim() would silently alias "a " / " a" onto the SAME
    // durable goal state. Byte-exact scope derivation keeps them apart.
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    const rows = rowsOf(built)
    store.setArm('agent:a', { kind: 'direct-human' })
    store.setArm('agent:a ', { kind: 'direct-human' })
    const created = JSON.parse((await rows.create_goal.execute({ objective: 'a owns this' }, execFor('a'))).text).goal
    expect(created).toMatchObject({ phase: 'active', revision: 1 })
    const goalId = String((store.stateOf('agent:a')?.goal as { goalId?: string } | null)?.goalId ?? created.goalId)
    // The whitespace siblings READ THEIR OWN (empty) state — never a's.
    expect(JSON.parse((await rows.get_goal.execute({}, execFor('a '))).text)).toEqual({ goal: null })
    expect(JSON.parse((await rows.get_goal.execute({}, execFor(' a'))).text)).toEqual({ goal: null })
    // And their WRITE naming a's exact goal_id+revision is refused against
    // their OWN fresh state (GOAL_NOT_FOUND) with zero reach into a's scope.
    const aBefore = JSON.parse(JSON.stringify(store.stateOf('agent:a')))
    const writesBefore = store.log.writes.length
    const cross = await rows.update_goal.execute({ goal_id: goalId, revision: 1, action: 'pause' }, execFor('a '))
    expect(refusedAs(cross).code).toBe('GOAL_NOT_FOUND')
    expect(store.log.writes).toHaveLength(writesBefore)
    expect(store.stateOf('agent:a')).toEqual(aBefore)
    // Three scopes, byte-distinct, all observed separately in the store log.
    const scopes = [...new Set(store.log.reads.map((x) => x.scope))].sort()
    expect(scopes).toEqual(['agent: a', 'agent:a', 'agent:a '])
  })
})

describe('u7fb T — the FULL pinned transition table: typed refusals, zero durable writes', () => {
  const seed = seededGoal('g1')
  const dh = { kind: 'direct-human' } as const
  const model = { kind: 'model' } as const
  type Leg = { name: string; row?: 'create_goal' | 'update_goal'; goal?: Record<string, unknown> | null; arm: Record<string, unknown>; args: Record<string, unknown>; code: string }
  const LEGS: Leg[] = [
    { name: 'create over an ACTIVE current', row: 'create_goal', goal: seed, arm: dh, args: { objective: 'second' }, code: 'GOAL_ALREADY_EXISTS' },
    { name: 'pause from paused', goal: { ...seed, phase: 'paused' }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'pause' }, code: 'GOAL_INVALID_TRANSITION' },
    { name: 'block from paused', goal: { ...seed, phase: 'paused' }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'blocked', blocked_reason: 'r' }, code: 'GOAL_INVALID_TRANSITION' },
    { name: 'complete from complete', goal: { ...seed, phase: 'complete' }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'complete' }, code: 'GOAL_INVALID_TRANSITION' },
    // Review R2 pin: the host resumable set is ['active','paused','blocked']
    // (tests/deepseek-harness-test-use/packages/goal/goal/src/index.ts:368 —
    // a COMPLETE goal is never resumable); our resume refusal from complete
    // mirrors it, typed, with zero durable writes.
    { name: 'resume from complete (host resumable set, index.ts:368)', goal: { ...seed, phase: 'complete' }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'resume' }, code: 'GOAL_INVALID_TRANSITION' },
    { name: 'resume from paused (the USER\'s act)', goal: { ...seed, phase: 'paused' }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'resume' }, code: 'GOAL_TOOL_RESUME_PAUSED' },
    { name: 'resume of an already active+armed goal', goal: { ...seed, armed: true }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'resume' }, code: 'GOAL_INVALID_TRANSITION' },
    { name: 'resume on an exhausted round budget', goal: { ...seed, armed: false, roundsStarted: 2, maxGoalRounds: 2 }, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'resume' }, code: 'GOAL_INVALID_TRANSITION' },
    { name: 'edit from the MODEL arm', goal: seed, arm: model, args: { goal_id: 'g1', revision: 1, action: 'edit', objective: 'nope' }, code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' },
    { name: 'pause from the MODEL arm', goal: seed, arm: model, args: { goal_id: 'g1', revision: 1, action: 'pause' }, code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' },
    { name: 'create from the MODEL arm', row: 'create_goal', goal: null, arm: model, args: { objective: 'nope' }, code: 'GOAL_TOOL_NOT_DIRECT_HUMAN' },
    { name: 'complete from the MODEL arm', goal: seed, arm: model, args: { goal_id: 'g1', revision: 1, action: 'complete' }, code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY' },
    { name: 'blocked from the MODEL arm', goal: seed, arm: model, args: { goal_id: 'g1', revision: 1, action: 'blocked', blocked_reason: 'r' }, code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY' },
    { name: 'complete via a WRONG goal-round (round mismatch)', goal: { ...seed, roundsStarted: 2 }, arm: { kind: 'goal-round', goalId: 'g1', revision: 1, round: 1 }, args: { goal_id: 'g1', revision: 1, action: 'complete' }, code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY' },
    { name: 'complete via a WRONG goal-round (revision mismatch)', goal: seed, arm: { kind: 'goal-round', goalId: 'g1', revision: 9, round: 0 }, args: { goal_id: 'g1', revision: 1, action: 'complete' }, code: 'GOAL_TOOL_NO_COMPLETION_AUTHORITY' },
    { name: 'blocked below the round threshold (exact round 2, below min 3)', goal: { ...seed, roundsStarted: 2 }, arm: { kind: 'goal-round', goalId: 'g1', revision: 1, round: 2 }, args: { goal_id: 'g1', revision: 1, action: 'blocked', blocked_reason: 'r' }, code: 'GOAL_TOOL_BLOCK_THRESHOLD' },
    { name: 'wrong revision (stale)', goal: { ...seed, revision: 4 }, arm: dh, args: { goal_id: 'g1', revision: 3, action: 'pause' }, code: 'GOAL_STALE_REVISION' },
    { name: 'wrong id (stale)', goal: seed, arm: dh, args: { goal_id: 'other-goal', revision: 1, action: 'pause' }, code: 'GOAL_STALE_REVISION' },
    { name: 'update with NO current goal', goal: null, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'pause' }, code: 'GOAL_NOT_FOUND' },
    { name: 'edit without a replacement', goal: seed, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'edit' }, code: 'GOAL_INVALID_EDIT' },
    { name: 'edit wearing blocked_reason', goal: seed, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'edit', objective: 'x', blocked_reason: 'r' }, code: 'GOAL_TOOL_INVALID_UPDATE' },
    { name: 'pause wearing objective', goal: seed, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'pause', objective: 'x' }, code: 'GOAL_TOOL_INVALID_UPDATE' },
    { name: 'complete wearing blocked_reason', goal: seed, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'complete', blocked_reason: 'r' }, code: 'GOAL_TOOL_INVALID_UPDATE' },
    { name: 'blocked without a reason', goal: seed, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'blocked' }, code: 'GOAL_TOOL_INVALID_UPDATE' },
    { name: 'unknown action', goal: seed, arm: dh, args: { goal_id: 'g1', revision: 1, action: 'abort' }, code: 'GOAL_TOOL_INVALID_UPDATE' },
  ]
  for (const leg of LEGS) {
    it(`T1 · ${leg.name} → ${leg.code} with ZERO durable writes`, async () => {
      const store = createRecordingStateStore()
      if (leg.goal !== undefined) store.seed('agent:alice', { goal: leg.goal })
      store.setArm('agent:alice', leg.arm)
      const built = await mount({ agentStateEnabled: true, store })
      const before = JSON.parse(JSON.stringify(store.stateOf('agent:alice')))
      const r = await rowsOf(built)[leg.row ?? 'update_goal'].execute(leg.args, execFor('alice'))
      expect(refusedAs(r).code).toBe(leg.code)
      expect(store.log.writes).toEqual([])
      expect(store.stateOf('agent:alice')).toEqual(before)
    })
  }

  // Review R2 pin (finding REJECTED, host law cited): complete(...) at
  // tests/deepseek-harness-test-use/packages/goal/goal/src/index.ts:390-399
  // transitions from ['active','paused','blocked'] to phase 'complete',
  // disarmed — our allowed set mirrors it EXACTLY, so complete FROM BLOCKED
  // MUST SUCCEED, with exactly ONE durable write. This leg exists so a
  // future "fix" that narrows the set (the rejected review suggestion) is
  // caught RED here instead of shipping a regression.
  it('T2 · complete from BLOCKED SUCCEEDS with EXACTLY ONE durable write (host law index.ts:390-399 — do-not-narrow pin)', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { goal: seededGoal('g1', { phase: 'blocked', armed: false }) })
    store.setArm('agent:alice', dh)
    const built = await mount({ agentStateEnabled: true, store })
    const r = await rowsOf(built).update_goal.execute({ goal_id: 'g1', revision: 1, action: 'complete' }, execFor('alice'))
    expect(r.isError ?? false).toBe(false)
    expect(JSON.parse(r.text).goal).toMatchObject({ goal_id: 'g1', phase: 'complete', revision: 2 })
    expect(store.stateOf('agent:alice')?.goal).toMatchObject({ phase: 'complete', armed: false })
    const applied = store.log.attempts.filter((a) => a.outcome === 'applied')
    expect(applied).toHaveLength(1)
    expect(store.log.writes.filter((w) => w.op === 'goal/apply')).toHaveLength(1)
  })
})

describe('u7fb R — durable writes are idempotent under replay', () => {
  it('R1a an in-flight execution token cannot own a second call', async () => {
    const store = createRecordingStateStore()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const leg = async (input: never) => { await gate; return approvingControlLeg()(input) }
    const built = await mount({ agentStateEnabled: true, store, leg })
    const token = { t: 1 }
    const first = rowsOf(built).todo_write.execute({ todos: [{ content: 'a', status: 'pending' }] }, execFor('alice', { token }))
    await new Promise((r) => setTimeout(r, 10))
    const second = await rowsOf(built).todo_write.execute({ todos: [{ content: 'b', status: 'pending' }] }, execFor('alice', { token }))
    expect(refusedAs(second).code).toBe('exec-token-replay')
    release()
    await first
    expect(store.stateOf('agent:alice')?.todos).toEqual([{ content: 'a', status: 'pending' }])
  })

  it('R1b a SETTLED token re-used settles CANCELLED through the PA edge — the durable fact never applies twice', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store })
    const token = { t: 2 }
    const first = await rowsOf(built).todo_write.execute({ todos: [{ content: 'a', status: 'pending' }] }, execFor('alice', { token }))
    expect(JSON.parse(first.text).counts.pending).toBe(1)
    const replay = await rowsOf(built).todo_write.execute({ todos: [{ content: 'a', status: 'pending' }] }, execFor('alice', { token }))
    expect(refusedAs(replay).code).toBe('CANCELLED')
    expect(store.log.writes.filter((w) => w.op === 'todos/apply')).toHaveLength(1)
  })

  it('R1c the store\'s own ledger refuses a repeated applyId outright (a consumed grant never applies twice)', async () => {
    const store = createRecordingStateStore()
    const a = await store.applyTodos('agent:alice', { todos: [{ content: 'x', status: 'pending' }], applyId: 'call-1' })
    const b = await store.applyTodos('agent:alice', { todos: [{ content: 'y', status: 'pending' }], applyId: 'call-1' })
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(false)
    expect(b.code).toBe('STATE_APPLY_REPLAY')
    expect(store.stateOf('agent:alice')?.todos).toEqual([{ content: 'x', status: 'pending' }])
  })

  it('R1d a re-driven mutation under a FRESH call meets the advanced revision (single fold), never a double transition', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { goal: seededGoal('g1') })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const built = await mount({ agentStateEnabled: true, store })
    const rows = rowsOf(built)
    const pause = JSON.parse((await rows.update_goal.execute({ goal_id: 'g1', revision: 1, action: 'pause' }, execFor('alice'))).text).goal
    expect(pause).toMatchObject({ phase: 'paused', revision: 2 })
    const replay = await rows.update_goal.execute({ goal_id: 'g1', revision: 1, action: 'pause' }, execFor('alice'))
    expect(refusedAs(replay).code).toBe('GOAL_STALE_REVISION')
    expect(store.stateOf('agent:alice')?.goal).toMatchObject({ revision: 2, phase: 'paused' })
    expect(store.log.writes.filter((w) => w.op === 'goal/apply')).toHaveLength(1)
  })
})

describe('u7fb W — the store audit law: a REFUSED apply is an attempt, never a write (review R1 F-1)', () => {
  // Review R1 F-1 (Medium): the recording store used to push `log.writes`
  // BEFORE the replay / CAS / plan-active checks, so a refused call was
  // recorded as a durable write — the exact opposite of the zero-write
  // refusal law the C1 legs assert, and it made those legs unfalsifiable
  // at the store face. Law now: `log.writes` is the durable-write audit —
  // an entry EXISTS IFF the mutation committed; `log.attempts` is the
  // attempt ledger — one entry per apply call, outcome 'applied' | 'refused'.
  const writesOf = (store: RecordingStore, op: string) => store.log.writes.filter((w) => w.op === op)
  const attemptsOf = (store: RecordingStore, op: string) => store.log.attempts.filter((a) => a.op === op)

  it('W1 goal replay: the consumed grant refuses with writes UNCHANGED and a refused attempt present', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { goal: seededGoal('g1') })
    const next = seededGoal('g1', { revision: 2, phase: 'paused' })
    const first = await store.applyGoal('agent:alice', { expectedRevision: 1, next, applyId: 'call-1' })
    expect(first.ok).toBe(true)
    const writesAfterCommit = writesOf(store, 'goal/apply').length
    const again = await store.applyGoal('agent:alice', { expectedRevision: 2, next, applyId: 'call-1' })
    expect(again.ok).toBe(false)
    expect(again.code).toBe('STATE_APPLY_REPLAY')
    expect(writesOf(store, 'goal/apply')).toHaveLength(writesAfterCommit)
    expect(attemptsOf(store, 'goal/apply').map((a) => a.outcome)).toEqual(['applied', 'refused'])
    expect(attemptsOf(store, 'goal/apply')[1]?.code).toBe('STATE_APPLY_REPLAY')
    expect(store.stateOf('agent:alice')?.goal).toMatchObject({ revision: 2, phase: 'paused' })
  })

  it('W2 stale revision: ZERO writes, one refused attempt, the stored revision byte-still current', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { goal: seededGoal('g1', { revision: 3 }) })
    const r = await store.applyGoal('agent:alice', { expectedRevision: 1, next: seededGoal('g1', { revision: 2 }), applyId: 'call-x' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('GOAL_STALE_REVISION')
    expect(writesOf(store, 'goal/apply')).toHaveLength(0)
    expect(attemptsOf(store, 'goal/apply')).toHaveLength(1)
    expect(attemptsOf(store, 'goal/apply')[0]).toMatchObject({ outcome: 'refused', code: 'GOAL_STALE_REVISION', scope: 'agent:alice' })
    expect(store.stateOf('agent:alice')?.goal).toMatchObject({ revision: 3 })
  })

  it('W3 already-exists (create form): ZERO writes, one refused attempt', async () => {
    const store = createRecordingStateStore()
    store.seed('agent:alice', { goal: seededGoal('g1') })
    const r = await store.applyGoal('agent:alice', { expectedRevision: null, next: seededGoal('g2'), applyId: 'call-c' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('GOAL_ALREADY_EXISTS')
    expect(writesOf(store, 'goal/apply')).toHaveLength(0)
    expect(attemptsOf(store, 'goal/apply').map((a) => a.outcome)).toEqual(['refused'])
  })

  it('W4 todos replay: the first call commits (one write), the replay refuses (writes UNCHANGED, attempts 2)', async () => {
    const store = createRecordingStateStore()
    const first = await store.applyTodos('agent:alice', { todos: [{ content: 'x', status: 'pending' }], applyId: 'call-1' })
    expect(first.ok).toBe(true)
    const replay = await store.applyTodos('agent:alice', { todos: [{ content: 'y', status: 'pending' }], applyId: 'call-1' })
    expect(replay.ok).toBe(false)
    expect(replay.code).toBe('STATE_APPLY_REPLAY')
    expect(writesOf(store, 'todos/apply')).toHaveLength(1)
    expect(attemptsOf(store, 'todos/apply').map((a) => a.outcome)).toEqual(['applied', 'refused'])
    expect(store.stateOf('agent:alice')?.todos).toEqual([{ content: 'x', status: 'pending' }])
  })

  it('W5 plan-mode exit on an INACTIVE scope: ZERO writes, one refused attempt; once active the same call commits', async () => {
    const store = createRecordingStateStore()
    const refused = await store.applyPlanModeExit('agent:alice', { plan: '# p', applyId: 'call-p' })
    expect(refused.ok).toBe(false)
    expect(refused.code).toBe('PLAN_MODE_NOT_ACTIVE')
    expect(writesOf(store, 'plan-mode/apply')).toHaveLength(0)
    expect(attemptsOf(store, 'plan-mode/apply').map((a) => a.outcome)).toEqual(['refused'])
    store.seed('agent:alice', { planMode: { active: true, pendingIntents: [] } })
    const ok = await store.applyPlanModeExit('agent:alice', { plan: '# p', applyId: 'call-p2' })
    expect(ok.ok).toBe(true)
    expect(writesOf(store, 'plan-mode/apply')).toHaveLength(1)
    expect(attemptsOf(store, 'plan-mode/apply').map((a) => a.outcome)).toEqual(['refused', 'applied'])
  })
})

describe('u7fb U/D — fail-closed refusals with ZERO reach', () => {
  it('U1 every row refuses an unknown parameter BEFORE admission and BEFORE the store (zero PA, zero reads, zero writes)', async () => {
    const store = createRecordingStateStore()
    const legAudit: string[] = []
    const leg = async (input: never) => { legAudit.push('entered'); return approvingControlLeg()(input) }
    const built = await mount({ agentStateEnabled: true, store, leg })
    const rows = rowsOf(built)
    store.setArm('agent:alice', { kind: 'direct-human' })
    store.seed('agent:alice', { planMode: { active: true, pendingIntents: [] } })
    const calls: [Row, unknown][] = [
      [rows.todo_write, { todos: [{ content: 'a', status: 'pending' }], escalate: true }],
      [rows.todo_write, { todos: [{ content: 'a', status: 'pending', owner: 'bob' }] }],
      [rows.create_goal, { objective: 'x', agent_id: 'bob' }],
      [rows.get_goal, { agent_id: 'bob' }],
      [rows.update_goal, { goal_id: 'g1', revision: 1, action: 'pause', force: true }],
      [rows.exit_plan_mode, { plan: '# p', approved: true }],
    ]
    for (const [row, args] of calls) {
      const r = await row.execute(args, execFor('alice'))
      expect(refusedAs(r).code, `${row.name} unknown-field`).toBe('AGENT_STATE_ARGS_UNKNOWN')
    }
    expect(legAudit).toEqual([])
    expect(store.log.reads).toEqual([])
    expect(store.log.writes).toEqual([])
  })

  it('D1 default-DENY template: every agent-state call answers the kernel\'s own grammar (IO_POLICY_UNSUPPORTED / template-default-deny) with zero PA and zero store access', async () => {
    const store = createRecordingStateStore()
    const legAudit: string[] = []
    const leg = async (input: never) => { legAudit.push('entered'); return approvingControlLeg()(input) }
    const built = await mount({ agentStateEnabled: true, store, policy: POLICY_DENY, leg })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const rows = rowsOf(built)
    const calls: [Row, unknown][] = [
      [rows.get_goal, {}],
      [rows.create_goal, { objective: 'x' }],
      [rows.update_goal, { goal_id: 'g', revision: 1, action: 'pause' }],
      [rows.todo_write, { todos: [{ content: 'a', status: 'pending' }] }],
      [rows.exit_plan_mode, { plan: '# p' }],
    ]
    for (const [row, args] of calls) {
      const r = await row.execute(args, execFor('alice'))
      const refusal = refusedAs(r)
      expect(refusal.code, row.name).toBe('IO_POLICY_UNSUPPORTED')
      expect(refusal.detail).toContain('template-default-deny')
    }
    expect(legAudit).toEqual([])
    expect(store.log.reads).toEqual([])
    expect(store.log.writes).toEqual([])
  })

  it('D2 the DENYING leg: the request settles deny, the body never runs, nothing persists', async () => {
    const store = createRecordingStateStore()
    const built = await mount({ agentStateEnabled: true, store, leg: denyingControlLeg() })
    store.setArm('agent:alice', { kind: 'direct-human' })
    const r = await rowsOf(built).create_goal.execute({ objective: 'never' }, execFor('alice'))
    expect(refusedAs(r).code).toBe('APPROVAL_DENIED')
    expect(store.stateOf('agent:alice')?.goal ?? null).toBe(null)
    expect(store.log.writes).toEqual([])
  })
})

describe('u7fb L — the pinned law table itself', () => {
  it('L1 the transition table carries the host pin and a host citation on EVERY leg (the pin IS the table test)', () => {
    expect(GOAL_TRANSITION_LAW.hostPin).toBe('639ed015397290b3745d163aafe02ffee4aa3f84')
    const citeShape = /^[a-z/._-]+\.ts:\d+(-\d+)?$/
    const walk = (v: unknown, path: string): void => {
      if (v === null || typeof v !== 'object') return
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        if (k === 'cite') expect(String(child), path).toMatch(citeShape)
        else if (k === 'cas' || k === 'fold') { /* checked below */ }
        else walk(child, `${path}.${k}`)
      }
    }
    walk(GOAL_TRANSITION_LAW, 'law')
    expect(GOAL_TRANSITION_LAW.cas.cite).toMatch(citeShape)
    expect(GOAL_TRANSITION_LAW.fold.cite).toMatch(citeShape)
    // The pinned phase sets ARE the host's (goal/src/index.ts :353/:368/:396/:413-414):
    expect(GOAL_TRANSITION_LAW.actions.pause.phase.from).toEqual(['active'])
    expect(GOAL_TRANSITION_LAW.actions.resume.phase.from).toEqual(['active', 'paused', 'blocked'])
    expect(GOAL_TRANSITION_LAW.actions.complete.phase.from).toEqual(['active', 'paused', 'blocked'])
    expect(GOAL_TRANSITION_LAW.actions.blocked.phase.from).toEqual(['active'])
    // host-tools.json (sha 35e2a63c…) names the same five mounted definitions:
    expect([...AGENT_STATE_NAMES].sort()).toEqual(['create_goal', 'exit_plan_mode', 'get_goal', 'todo_write', 'update_goal'])
  })
})
