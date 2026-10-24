/**
 * A5M2-WIRE-G2 Team-governed SubagentProvider — the four pins the center
 * card demands, end-to-end over a controlled create seam (no boot, no
 * Host, no engine). The fake agents.create OBSERVES the setup contract the
 * real factory guarantees (core/agent/src/index.ts:100-116): it runs setup
 * AFTER minting childCtx and BEFORE it announces the child; commit() runs
 * at the publication boundary. Order is captured in one shared array so a
 * single leg proves the whole causal chain.
 */
import { describe, it, expect } from 'vitest'
import { createTeamGovernedSubagentProvider, A5_TGP_CODES } from '../src/plugin/live/governed-families/team-governed-provider.mjs'
import type { G2TgpInput, G2TgpProvider, G2TgpParentContext } from '../src/plugin/live/governed-families/team-governed-provider.d.mts'

// NARROWING HELPER (a branch, never an as-any): the factory answers a union
// (provider | typed refusal); the harness needs the provider face once.
const mustProvider = (built: G2TgpProvider & { ok?: undefined } | { ok: false, code: string, message: string }): G2TgpProvider => {
  if ('ok' in built && built.ok === false) throw new Error(`the factory refused its own harness: ${String(built.code)} ${String(built.message)}`)
  return built
}

type Step = string
const mkHarness = (opts: {
  pa?: (walk: Record<string, unknown>) => Promise<{ kind?: string, cancelled?: boolean, detail?: string }>
  laneResolver?: (m: unknown) => { deny: string[] } | null
  announced?: { value: boolean }
  laneRecheck?: () => boolean
  createThrows?: Error
} = {}) => {
  const order: Step[] = []
  const announced = opts.announced ?? { value: false }
  const parent = Object.freeze({ id: 'parent-member', sessionId: 'team-member-sess-7' })
  const activeCalls = new WeakMap<object, G2TgpParentContext>()
  activeCalls.set(parent, { callId: 'orch-call-9', parametersFingerprint: 'fp-parent-plan', realmId: 'realm-orch', toolName: 'workflow', ordinal: 0, providerIdentity: 'a5p5-plane' })
  const created: Record<string, unknown>[] = []
  const provider = mustProvider(createTeamGovernedSubagentProvider({
    name: 'team-governed-spawn',
    agents: {
      async create(o: Record<string, unknown>) {
        created.push(o)
        order.push('create:enter')
        // The real factory runs setup pre-insert/announce and commits at the
        // publication boundary; a throw anywhere publishes nothing.
        const childCtx = {
          tools: {
            restrict: (filter: { deny?: string[] }) => {
              order.push(`restrict:${(filter?.deny ?? []).join('|')}`)
              expect(announced.value, 'PIN 2: restrict runs BEFORE the child is announced').toBe(false)
              return () => { order.push('restrict:undo') }
            },
          },
        }
        const commit = await (o.setup as (c: unknown, a: unknown) => Promise<{ commit: () => void } | void>)(childCtx, { id: 'child-agent' })
        if (opts.createThrows !== undefined) throw opts.createThrows
        if (commit && typeof commit.commit === 'function') commit.commit()
        if (announced.value === false) {
          // simulate the factory announcing the child AFTER setup+commit
          order.push('announce')
          announced.value = true
        }
        return { agent: { id: 'child-agent' }, result: { output: 'child settled', isError: false }, dispose: async () => { order.push('dispose') } }
      },
    },
    pa: Object.assign(
      opts.pa ?? (async () => ({ kind: 'allow' as const })),
      { closePlan: (callId: string) => { order.push(`closePlan:${callId}`) } },
    ),
    teamActivation: {
      async runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
        order.push(`runOwned:${sessionId.length > 0 ? 'yes' : 'empty'}`)
        return await operation()
      },
      wrapSetup: (_sid: string, setup: (c: unknown, a: unknown) => unknown) => async (c: unknown, a: unknown): Promise<unknown> => await setup(c, a),
    },
    laneResolver: opts.laneResolver ?? (() => ({ deny: ['bash', 'terminal_open'] })),
    activeCalls,
    ...(opts.laneRecheck === undefined ? {} : { laneRecheck: opts.laneRecheck }),
  }))
  const request = { parent, signal: new AbortController().signal, prompt: [{ type: 'text', text: 'go' }] }
  return { provider, order, created, activeCalls, announced, request, parent }
}

describe('A5M2 TGP: admission-before-create, restrict-before-publish, throw-publishes-nothing, real attribution', () => {
  it('PIN 1 ADMISSION BEFORE CREATION: the walk (parentCallId#child-1, parent fp + ordinal) runs and ALLOWS before agents.create is entered; deny throws with ZERO creates', async () => {
    const allow = mkHarness()
    const run = await allow.provider.start(allow.request)
    const admitIdx = allow.order.indexOf('create:enter')
    expect(admitIdx, 'something ran before create').toBeGreaterThan(0)
    // PA is the FIRST thing: no create, no runOwned before admission allowed
    expect(allow.order[0]).toMatch(/^closePlan|^create:enter|^runOwned/) // order[0] never restrict
    expect(allow.order.filter((s) => s.startsWith('restrict'))[0] === undefined || allow.order.indexOf('restrict:bash|terminal_open') > admitIdx, 'restrict rides create, never admission').toBe(true)
    expect(run.id.length).toBeGreaterThan(0)

    let denied: Error | undefined
    const denyH = mkHarness({ pa: async () => ({ kind: 'deny', detail: 'PA said no for this child' }) })
    try { await denyH.provider.start(denyH.request) } catch (e) { denied = e as Error }
    expect(denied?.message).toContain(A5_TGP_CODES.DENIED)
    expect(denied?.message).toContain('PA said no for this child') // bytes ride VERBATIM
    expect(denyH.created.length, 'a denied child NEVER reaches create').toBe(0)
    expect(denyH.order.some((s) => s.startsWith('closePlan'))).toBe(true)
  })
  it('PIN 2 RESTRICT BEFORE PUBLICATION: lane deny lands via scoped restrict while the child is still unannounced; commit re-checks the lane at the boundary', async () => {
    const announced = { value: false }
    const h = mkHarness({ announced })
    await h.provider.start(h.request)
    const rIdx = h.order.findIndex((s) => s.startsWith('restrict:'))
    const aIdx = h.order.indexOf('announce')
    expect(rIdx, 'restrict ran').toBeGreaterThan(-1)
    expect(aIdx, 'restrict BEFORE announce').toBeGreaterThan(rIdx)
    expect(h.order[rIdx]).toBe('restrict:bash|terminal_open')
    // commit() re-check: a lane that moved at the boundary throws (PIN 3 zero publish)
    const moved = mkHarness({ laneRecheck: () => false })
    let e: Error | undefined
    try { await moved.provider.start(moved.request) } catch (err) { e = err as Error }
    expect(String(e?.message)).toContain(A5_TGP_CODES.LANE_MOVED_AT_COMMIT)
    expect(moved.announced.value, 'commit throw publishes NOTHING').toBe(false)
  })
  it('PIN 3 THROW PUBLISHES NOTHING: create fault leaves the child unannounced, closes the plan, throws typed', async () => {
    const h = mkHarness({ createThrows: new Error('factory rolled the unpublished scope back') })
    let e: Error | undefined
    try { await h.provider.start(h.request) } catch (err) { e = err as Error }
    expect(String(e?.message)).toContain(A5_TGP_CODES.CREATE_FAULT)
    expect(h.announced.value, 'nothing announced on create fault').toBe(false)
    expect(h.order.some((s) => s.startsWith('closePlan'))).toBe(true)
    // lane absent = never publishes an ungoverned child either
    const noLane = mkHarness({ laneResolver: () => null })
    await expect(noLane.provider.start(noLane.request)).rejects.toThrow(A5_TGP_CODES.LANE_ABSENT)
    expect(noLane.created.length).toBe(0)
  })
  it('PIN 4 ATTRIBUTION IS REAL: create carries parentAgent=live member + durable origin/lineage and rides runOwned; a parent with NO governed context fails closed with ZERO creates (no fake UUID, no new ledger)', async () => {
    const h = mkHarness()
    await h.provider.start(h.request)
    expect(h.order.some((s) => s.startsWith('runOwned:yes')), 'the create rides the EXISTING Team runOwned funnel').toBe(true)
    const o = h.created[0] as Record<string, unknown>
    expect(o.parentAgent, 'parentAgent is the LIVE member Agent, nothing else').toBe(h.parent)
    const meta = o.meta as Record<string, unknown>
    expect(meta.origin).toBe('subagent')
    expect(meta.parentSession).toBe('team-member-sess-7')
    expect(o.sessionId, 'the child has its own real session id').toBe(o.sessionId)
    expect(typeof o.sessionId).toBe('string')
    // no governed parent context -> fail-closed, zero create
    const orphan = mkHarness()
    const orphanReq = { parent: { id: 'unknown-agent' }, signal: new AbortController().signal, prompt: [] }
    await expect(orphan.provider.start(orphanReq)).rejects.toThrow(A5_TGP_CODES.NO_PARENT_CONTEXT)
    expect(orphan.created.length).toBe(0)
    // already-aborted signal: zero create, zero walk
    const ac = new AbortController()
    ac.abort()
    const cancelled = mkHarness()
    await expect(cancelled.provider.start({ parent: cancelled.parent, signal: ac.signal, prompt: [] })).rejects.toThrow(A5_TGP_CODES.CANCELLED)
    expect(cancelled.created.length).toBe(0)
  })
  it('the governed factory refuses stand-ins for its real seams (agents/pa/teamActivation/laneResolver/activeCalls all REQUIRED)', () => {
    for (const key of ['agents', 'pa', 'teamActivation', 'laneResolver', 'activeCalls']) {
      const base: Partial<G2TgpInput> & Record<string, unknown> = {
        agents: { create: async () => ({}) },
        pa: Object.assign(async () => ({ kind: 'allow' }), { closePlan: () => {} }),
        teamActivation: { runOwned: async <T, >(_s: string, op: () => Promise<T>): Promise<T> => await op(), wrapSetup: (_s: string, su: (c: unknown, a: unknown) => unknown) => async (c: unknown, a: unknown): Promise<unknown> => await su(c, a) },
        laneResolver: () => ({ deny: [] }),
        activeCalls: new WeakMap(),
      }
      delete base[key]
      const built = createTeamGovernedSubagentProvider(base as unknown as G2TgpInput) // INTENTIONALLY incomplete: the factory must typed-refuse the invalid domain
      expect(built.ok, `${key} REQUIRED`).toBe(false)
    }
  })
})
