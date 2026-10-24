/**
 * A5M2 G5 — L7 drift law against the REAL Cordis proxy shape (root
 * source-review card, 2026-10-24, after live window bash-6224 refused a
 * HEALTHY allow-consumed dispatch with P_G5_GOAL_CAPTURE_DRIFT).
 *
 * Source facts (read-only, fixed 639 @639ed01539):
 *  - GoalService extends TypertRemoteService (packages/goal/goal/src/index.ts:240),
 *    so every instance carries the PUBLIC `typertRemote` binding produced by
 *    bindTypertRemote — Object.freeze({ service, serviceKey, namespace })
 *    (packages/typert/protocol/src/index.ts:150-178).
 *  - Context reads re-wrap every FUNCTION property read in a FRESH shadow
 *    method Proxy (vendor/cordis/src/utils.ts createTraceable/createShadowMethod
 *    :157-197) — on such a face `wrapper ===` is never true across reads, so
 *    the former frozen-wrapper law false-refused every dispatch.
 *
 * The narrow law under test (g5-goal-service.mjs, this worktree):
 *  - REAL-FACE mode (public binding present): per-dispatch fresh verification
 *    against the binding's REAL service object and the REAL public method
 *    identities; refuse missing binding / provider swap / real-method swap.
 *  - DIRECT-FACE mode (no public binding): the ORIGINAL strict frozen-wrapper
 *    law, verbatim.
 *  - Execution always goes through the live face (never service.execute).
 * No Host, no new packages: pure in-process shapes mimicking the fixed 639
 * proxy behavior.
 * @module @dsh-agent-team/runtime/test/a5m2-g5-goal-service-drift-proxy
 */
import { describe, expect, it } from 'vitest'

const G5 = (await import(new URL('../src/plugin/live/governed-families/g5-goal-service.mjs', import.meta.url).href)) as {
  createG5GoalServiceAdapter: (input: Record<string, unknown>) => Record<string, { active: boolean; invoke: (args: Record<string, unknown>, exec: unknown) => Promise<{ ok?: boolean; code?: string; detail?: unknown }> }>
}

const DRIFT = 'P_G5_GOAL_CAPTURE_DRIFT'
const EXEC = Object.freeze({ agent: Object.freeze({ id: 'agent-g5-drift' }) })

const view = (phase: string) => Object.freeze({
  id: 'goal-1',
  revision: 1,
  objective: 'drift law',
  phase,
  maxGoalRounds: 256,
})

/** The REAL GoalService shape: own frozen typertRemote binding + methods. */
class RealGoalService {
  typertRemote: { service: RealGoalService; serviceKey: string; namespace: string }
  constructor() {
    // bindTypertRemote @639: Object.freeze({ service, serviceKey, namespace })
    this.typertRemote = Object.freeze({ service: this, serviceKey: 'goals', namespace: 'goals' })
  }
  get() { return view('active') }
  create() { return view('active') }
  update() { return view('active') }
  edit() { return view('active') }
  pause() { return view('paused') }
  resume() { return view('active') }
  complete() { return view('complete') }
  block() { return view('blocked') }
  disarm() { return view('active') }
}

/**
 * A face that mimics the fixed-639 Context read law: every FUNCTION read
 * answers a FRESH shadow-method Proxy (apply passes through to the real
 * instance); data properties (typertRemote) answer the raw stable value —
 * exactly createTraceable's get-handler shape (utils.ts:157-197).
 */
function shadowFace(service: object) {
  return new Proxy(service, {
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        return new Proxy(value as (...args: unknown[]) => unknown, {
          apply: (fn, _thisArg, args) => Reflect.apply(fn as (...a: unknown[]) => unknown, service, args),
        })
      }
      return value
    },
  })
}

function def(name: string, description: string) {
  return {
    name,
    description,
    parameters: { type: 'object', properties: {}, required: [] },
    output: { schema: { type: 'object', properties: {}, required: [] }, render: () => [] },
    execute: async () => { throw new Error('NATIVE BODY MUST NOT BE ENTERED by a G5 real-service row') },
  }
}

function realWorld(face: object) {
  const defs: Record<string, unknown> = {
    get_goal: def('get_goal', 'Read the current session goal, including the id and revision that update_goal requires.'),
    create_goal: def('create_goal', 'Create a persisted goal that keeps this session working across automatic continuation rounds.'),
    update_goal: def('update_goal', 'Update the current goal.'),
  }
  return G5.createG5GoalServiceAdapter({
    realmId: 'realm-g5-drift',
    providerId: 'assembly-g5-drift',
    readNative: (name: string) => defs[name],
    goals: face,
  })
}

describe('a5m2-g5 L7 drift law — real 639 proxy shapes', () => {
  it('REAL-FACE: repeated dispatches through fresh per-read shadow wrappers serve — no false drift', async () => {
    const service = new RealGoalService()
    const adapter = realWorld(shadowFace(service))
    expect(adapter.get_goal.active).toBe(true)
    const first = await adapter.get_goal.invoke({}, EXEC)
    expect(first.ok).toBe(true)
    const second = await adapter.get_goal.invoke({}, EXEC)
    expect(second.ok).toBe(true)
    // The wrappers genuinely differ per read — the shape that produced the
    // bash-6224 false positive is exercised, not simulated away.
    expect((service as { get?: unknown }).get !== (service as { get?: unknown }).get).toBe(false) // raw reads are stable
    const face = shadowFace(service)
    expect((face as { get?: unknown }).get === (face as { get?: unknown }).get).toBe(false) // shadow reads are fresh
  })

  it('REAL-FACE: a swapped provider behind the binding refuses typed drift, zero further port entry', async () => {
    const service = new RealGoalService()
    const face = shadowFace(service)
    const adapter = realWorld(face)
    expect((await adapter.get_goal.invoke({}, EXEC)).ok).toBe(true)
    // Provider swap: the public binding now answers a DIFFERENT real service.
    const other = new RealGoalService()
    Object.defineProperty(service, 'typertRemote', { value: Object.freeze({ service: other, serviceKey: 'goals', namespace: 'goals' }), writable: true, configurable: true })
    const refused = await adapter.get_goal.invoke({}, EXEC)
    expect(refused.code).toBe(DRIFT)
    expect(String(refused.detail)).toContain('different real service')
  })

  it('REAL-FACE: replacement of the REAL public method refuses typed drift', async () => {
    const service = new RealGoalService()
    const adapter = realWorld(shadowFace(service))
    expect((await adapter.get_goal.invoke({}, EXEC)).ok).toBe(true)
    ;(service as { get?: unknown }).get = function replaced() { return view('active') }
    const refused = await adapter.get_goal.invoke({}, EXEC)
    expect(refused.code).toBe(DRIFT)
    expect(String(refused.detail)).toContain('was replaced underneath the frozen bind')
  })

  it('REAL-FACE: a gutted face that stops answering the frozen public binding refuses typed drift', async () => {
    const service = new RealGoalService()
    const adapter = realWorld(shadowFace(service))
    expect((await adapter.get_goal.invoke({}, EXEC)).ok).toBe(true)
    Object.defineProperty(service, 'typertRemote', { value: undefined, writable: true, configurable: true })
    const refused = await adapter.get_goal.invoke({}, EXEC)
    expect(refused.code).toBe(DRIFT)
    expect(String(refused.detail)).toContain('frozen public typertRemote binding')
  })

  it('DIRECT-FACE stand-ins keep the ORIGINAL strict frozen-wrapper law verbatim', async () => {
    const goals: Record<string, unknown> = {
      get: () => view('active'),
      create: () => view('active'),
      update: () => view('active'),
      edit: () => view('active'),
      pause: () => view('paused'),
      resume: () => view('active'),
      complete: () => view('complete'),
      block: () => view('blocked'),
    }
    const adapter = realWorld(goals)
    expect((await adapter.get_goal.invoke({}, EXEC)).ok).toBe(true)
    goals.get = () => view('active') // rebound underneath the frozen bind
    const refused = await adapter.get_goal.invoke({}, EXEC)
    expect(refused.code).toBe(DRIFT)
    expect(String(refused.detail)).toContain('was rebound underneath the frozen bind')
  })
})
