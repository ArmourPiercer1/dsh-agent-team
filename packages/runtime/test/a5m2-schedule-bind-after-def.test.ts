/**
 * a5m2-schedule-bind-after-def.test.ts — THE BIND-AFTER-DEF LAW, card #2
 * (tier 接线未测; unit-level against doubles — mocks 不替生产). Hook route,
 * ZERO own registration. Encoded gates: (1) bound ONLY on canonical gate
 * {ok:true}, with pair-close + gate-key deletion on every failure (addendum
 * A); (2) the body-boundary proof is the RAW plane-edge answer with its
 * one-shot consumedProof — NEVER a boolean (不能bool true); (3) the
 * around-chain boundary: checks run last-moment before exactly-one next(),
 * and the live face is verified again after the full downstream chain
 * (addendum B); (4) per-dispatch CURRENT def/execute/service/list/delete
 * identity; (5) the created event is not a settled proof — binding rides the
 * bounded published-def safe point.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createScheduleBindAfterDef } from '../src/plugin/live/governed-families/schedule-bind-after-def.mjs'

const AGENT = Object.freeze({ id: 'member-agent' })
const OTHER = Object.freeze({ id: 'other-agent' })

type Handler = (exec: unknown, next: () => unknown) => unknown
type ExecHandler = (exec: unknown, next: () => unknown) => Promise<unknown>

function makeDef (name: string) {
  return { name, description: `desc-${name}`, parameters: { type: 'object' }, output: {}, execute: async () => ({ content: [] }) }
}

function makeService () {
  return {
    list: async () => [],
    delete: async () => ({ ok: true }),
    create: async () => ({}),
    update: async () => ({}),
    catalog: async () => [],
    history: async () => [],
  }
}

const GOOD_PROOF = Object.freeze({ kind: 'allow', consumedProof: Object.freeze({ grant: Object.freeze({ grantId: 'grant-1' }) }) })
const FIXED_SERVICE = makeService()

interface Harness {
  events: Map<string, Handler[]>
  guards: Array<(exec: unknown) => string | undefined>
  disposal: string[]
  notes: Array<Record<string, unknown>>
  refusals: Array<Error & { breakpoint?: { kind: string } }>
  consumeCalls: number
  gateCalls: unknown[]
  closeCalls: unknown[]
  waits: number
  defs: Map<string, unknown>
  fireCreated: (agent: unknown) => Promise<void>
  deps: Record<string, unknown>
  setHandlerFault: (event: string) => void
}

interface HarnessOptions {
  defs?: Map<string, unknown>
  proof?: unknown | (() => unknown)
  gate?: (input: unknown) => unknown
}

function harness (opts: HarnessOptions = {}): Harness {
  const faulted = new Set<string>()
  const h: Harness = {
    events: new Map(),
    guards: [],
    disposal: [],
    notes: [],
    refusals: [],
    consumeCalls: 0,
    gateCalls: [],
    closeCalls: [],
    waits: 0,
    defs: opts.defs ?? new Map<string, unknown>([['schedule_list', makeDef('schedule_list')], ['schedule_delete', makeDef('schedule_delete')]]),
    fireCreated: async () => {},
    deps: {},
    setHandlerFault: (event) => { faulted.add(event) },
  }
  let createdListener: ((p: { agent: unknown }) => unknown) | null = null
  h.fireCreated = async (agent) => { await createdListener?.({ agent }) }
  h.deps = {
    readToolDefinition: (name: string) => h.defs.get(name),
    subscribeAgentCreated: (fn: (p: { agent: unknown }) => unknown) => {
      createdListener = fn
      return () => { createdListener = null; h.disposal.push('created') }
    },
    agentEvents: {
      on: (event: string, handler: (...args: never[]) => unknown) => {
        if (faulted.has(event)) throw new Error(`registration fault for ${event}`)
        const arr = h.events.get(event) ?? []
        arr.push(handler as Handler)
        h.events.set(event, arr)
        return () => { h.events.set(event, arr.filter((entry) => entry !== (handler as Handler))); h.disposal.push(`event:${event}`) }
      },
    },
    registerGuard: (fn: (exec: unknown) => string | undefined) => {
      h.guards.push(fn)
      return () => { h.guards.splice(h.guards.indexOf(fn), 1); h.disposal.push('guard') }
    },
    scheduleServiceFeed: () => FIXED_SERVICE,
    onBinded: (input: unknown) => {
      h.gateCalls.push(input)
      if (opts.gate === undefined) return { ok: true }
      if (input === 'never') return { ok: true }
      const answer = opts.gate(input)
      if (answer === 'throw') throw new Error('gate exploded')
      return answer
    },
    onBindClose: (info: unknown) => { h.closeCalls.push(info) },
    consumePaAtBody: () => {
      h.consumeCalls += 1
      const proof = opts.proof === undefined ? GOOD_PROOF : opts.proof
      return typeof proof === 'function' ? (proof as () => unknown)() : proof
    },
    onBindRefused: (error: Error & { breakpoint?: { kind: string } }) => { h.refusals.push(error) },
    wait: async () => { h.waits += 1 },
    defSettleAttempts: 3,
    defSettleTickMs: 1,
    observe: (row: Record<string, unknown>) => { h.notes.push(row) },
  }
  return h
}

function listener<H>(h: Harness, event: string): H {
  const arr = h.events.get(event)
  const fn = arr === undefined ? undefined : arr[0]
  if (typeof fn !== 'function') throw new Error(`no listener registered for ${event}`)
  return fn as H
}

async function bindOk (opts: HarnessOptions = {}): Promise<{ h: Harness, handle: { isBound: () => boolean, dispose: () => void, start: (a: unknown) => void } }> {
  const h = harness(opts)
  const raw = createScheduleBindAfterDef(h.deps as never)
  raw.start(AGENT)
  await h.fireCreated(AGENT)
  expect(raw.isBound()).toBe(true)
  return { h, handle: raw as unknown as { isBound: () => boolean, dispose: () => void, start: (a: unknown) => void } }
}

describe('a5m2 schedule bind-after-def (card #2 + addenda A/B)', () => {
  it('(a) no def at the safe point = bounded window, typed refusal, zero listeners, gate NEVER called — never a silent allow', async () => {
    const h = harness({ defs: new Map() })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    await h.fireCreated(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    expect(h.waits).toBe(3) // bounded attempts, all spent
    expect(h.refusals).toHaveLength(1)
    expect(h.refusals[0]?.breakpoint?.kind).toBe('def-never-appeared')
    expect(h.gateCalls).toHaveLength(0)
  })

  it('(b) look-alike copy at the bind-moment re-read refuses the whole bind BEFORE the gate', async () => {
    const list = makeDef('schedule_list')
    const defs = new Map<string, unknown>([['schedule_list', list], ['schedule_delete', makeDef('schedule_delete')]])
    let reads = 0
    const h = harness({ defs })
    h.deps.readToolDefinition = (name: string) => {
      reads += 1
      // each attempt reads the pair then re-reads it; poison the SECOND read
      // of schedule_list (the re-read pass) with a look-alike copy.
      return (reads === 3 && name === 'schedule_list') ? { ...list } : defs.get(name)
    }
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    await h.fireCreated(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    expect(h.gateCalls).toHaveLength(0)
    expect(h.refusals[0]?.breakpoint?.kind).toBe('def-identity-drift')
  })

  it('(c) the gate opens exactly once with the ORIGINAL defs; pre-execute consumes NOTHING; the body accepts ONLY the raw plane proof — bool, missing witness, deny and cancelled all refuse with zero dispatch; the good proof dispatches with exactly ONE consume', async () => {
    const { h } = await bindOk()
    expect(h.gateCalls).toHaveLength(1)
    const gateInput = h.gateCalls[0] as { definitions: Array<{ name: string }> }
    expect(gateInput.definitions.map((d) => d.name).sort()).toEqual(['schedule_delete', 'schedule_list'])
    const pre = listener<Handler>(h, 'tools/pre-execute')
    expect(pre({ name: 'schedule_list', agent: AGENT, callId: 'call-1' }, () => 'NEXT')).toBe('NEXT')
    expect(h.consumeCalls).toBe(0)

    // boolean proof = the forbidden shape (不能bool true)
    const boolHarness = await bindOk({ proof: true })
    let dispatched = 0
    await expect(listener<ExecHandler>(boolHarness.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-b' }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-consume-proof-invalid' } })
    expect(dispatched).toBe(0)
    expect(boolHarness.h.consumeCalls).toBe(1) // the edge ran; its BOOL answer was rejected

    // allow without the one-shot witness
    const noWitness = await bindOk({ proof: { kind: 'allow' } })
    await expect(listener<ExecHandler>(noWitness.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-w' }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-consume-proof-missing' } })

    // deny and cancelled answers
    const denied = await bindOk({ proof: { kind: 'deny', code: 'GRANT_STALE' } })
    await expect(listener<ExecHandler>(denied.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-d' }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-edge-refused' } })
    const cancelled = await bindOk({ proof: { kind: 'allow', cancelled: true, stage: 'edge' } })
    await expect(listener<ExecHandler>(cancelled.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-c' }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-cancelled' } })

    // the good proof: exactly one consume, exactly one dispatch
    const exec = listener<ExecHandler>(h, 'tools/execute')
    expect(await exec({ name: 'schedule_delete', agent: AGENT, callId: 'call-3', arguments: { id: 'task-1' } }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
    expect(h.notes.map((n) => n.event)).toContain('bound-after-def')
    // foreign agent / foreign name consume NOTHING (sameAgent scope exact)
    expect(await exec({ name: 'schedule_list', agent: OTHER, callId: 'call-4' }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(await exec({ name: 'bash', agent: AGENT, callId: 'call-5' }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
  })

  it('(d) per-dispatch identity: service swap, same-object METHOD swap and def swap all refuse BEFORE any consume, zero dispatch', async () => {
    const holder: { service: ReturnType<typeof makeService> } = { service: makeService() }
    const h = harness()
    h.deps.scheduleServiceFeed = () => holder.service
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    await h.fireCreated(AGENT)
    const exec = listener<ExecHandler>(h, 'tools/execute')
    expect(await exec({ name: 'schedule_list', agent: AGENT, callId: 'd-0' }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
    const boundService = holder.service
    const boundList = boundService.list
    // (1) service object swap → refuses BEFORE the consume
    holder.service = makeService()
    let dispatched = 0
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-1' }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'service-identity-drift' } })
    expect(h.consumeCalls).toBe(1)
    // (2) SAME object, swapped list METHOD → method identity drift
    holder.service = boundService
    boundService.list = async () => []
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-2' }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'service-method-drift' } })
    expect(h.consumeCalls).toBe(1)
    boundService.list = boundList
    // (3) def swapped underneath the bind → def/execute identity drift
    h.defs.set('schedule_list', makeDef('schedule_list'))
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-3' }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'native-definition-drift' } })
    expect(h.consumeCalls).toBe(1)
    expect(dispatched).toBe(0)
    // around-chain law (B): the pair closing while the downstream chain runs
    // refuses ACCEPTANCE of the settled result (exactly-one next still ran).
    const h2 = harness({ proof: () => { setTimeout(() => { handle2.dispose() }, 0); return GOOD_PROOF } })
    const handle2 = createScheduleBindAfterDef(h2.deps as never)
    handle2.start(AGENT)
    await h2.fireCreated(AGENT)
    const exec2 = listener<ExecHandler>(h2, 'tools/execute')
    await expect(exec2({ name: 'schedule_list', agent: AGENT, callId: 'd-4' }, async () => { await new Promise((r) => { setTimeout(r, 5) }); return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'disposed-around-chain' } })
  })

  it('(e) dispose closes everything; dispose DURING the consume refuses the body (consumption stays settled); no consume supply = body refuses AND the guard denies', async () => {
    const { h, handle } = await bindOk()
    expect(h.events.get('tools/pre-execute')).toHaveLength(1)
    expect(h.events.get('tools/execute')).toHaveLength(1)
    expect(h.events.get('tools/post-execute')).toHaveLength(1)
    expect(h.guards).toHaveLength(1)
    // dispose while the consume is in flight (the SELF handle, via holder):
    const self: { handle?: { dispose: () => void } } = {}
    const h2 = harness({ proof: () => { self.handle?.dispose(); return GOOD_PROOF } })
    const handle2 = createScheduleBindAfterDef(h2.deps as never)
    self.handle = handle2 as unknown as { dispose: () => void }
    handle2.start(AGENT)
    await h2.fireCreated(AGENT)
    const exec2 = listener<ExecHandler>(h2, 'tools/execute')
    let dispatched = 0
    await expect(exec2({ name: 'schedule_list', agent: AGENT, callId: 'e-1' }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'disposed-during-consume' } })
    expect(dispatched).toBe(0)
    // full teardown of the first bind:
    handle.dispose()
    expect(handle.isBound()).toBe(false)
    expect(h.events.get('tools/pre-execute')).toHaveLength(0)
    expect(h.events.get('tools/execute')).toHaveLength(0)
    expect(h.events.get('tools/post-execute')).toHaveLength(0)
    expect(h.guards).toHaveLength(0)
    expect(h.disposal).toContain('created')
    // no consume supply = fail-closed body refusal AND deny-only guard
    const h3 = harness()
    delete h3.deps.consumePaAtBody
    const handle3 = createScheduleBindAfterDef(h3.deps as never)
    handle3.start(AGENT)
    await h3.fireCreated(AGENT)
    const exec3 = listener<ExecHandler>(h3, 'tools/execute')
    await expect(exec3({ name: 'schedule_list', agent: AGENT, callId: 'e-2' }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'plane-edge-unwired' } })
    expect(h3.guards[0]?.({ name: 'schedule_list', agent: AGENT })).toContain('governed deny')
    expect(h3.guards[0]?.({ name: 'schedule_list', agent: OTHER })).toBeUndefined()
  })

  it('(f) canonical gate law (A): {ok:false}/throw refuse the bind with ZERO listeners and NO pair to close; gate SUCCESS + registration fault CLOSES the pair and deletes the gate keys via onBindClose', async () => {
    const refused = harness({ gate: () => ({ ok: false }) })
    const handleR = createScheduleBindAfterDef(refused.deps as never)
    handleR.start(AGENT)
    await refused.fireCreated(AGENT)
    expect(refused.events.size).toBe(0)
    expect(refused.refusals[0]?.breakpoint?.kind).toBe('canonical-bind-refused')
    expect(refused.closeCalls).toHaveLength(0) // nothing was written — nothing to close
    const exploded = harness({ gate: () => 'throw' })
    const handleE = createScheduleBindAfterDef(exploded.deps as never)
    handleE.start(AGENT)
    await exploded.fireCreated(AGENT)
    expect(exploded.refusals[0]?.breakpoint?.kind).toBe('canonical-bind-fault')
    expect(exploded.events.size).toBe(0)
    // gate succeeded, face registration faults → pair closed, faces unwound
    const h = harness()
    h.setHandlerFault('tools/post-execute')
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    await h.fireCreated(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.refusals[0]?.breakpoint?.kind).toBe('bind-registration-fault')
    expect(h.closeCalls).toHaveLength(1)
    expect(h.events.get('tools/execute') ?? []).toHaveLength(0)
    expect(h.events.get('tools/pre-execute') ?? []).toHaveLength(0)
    expect(h.disposal).toContain('event:tools/pre-execute')
    expect(h.disposal).toContain('event:tools/execute')
  })

  it('(g) created is an EVENT, not a settled proof: the bounded published-def safe point binds when the def appears (zero waits on the fast path)', async () => {
    const h = harness({ defs: new Map() })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    const pending = h.fireCreated(AGENT)
    // the def appears while the safe point waits (the ORIGINAL Schedule
    // listener completed late): the bind succeeds at a later attempt.
    h.defs.set('schedule_list', makeDef('schedule_list'))
    h.defs.set('schedule_delete', makeDef('schedule_delete'))
    await pending
    expect(handle.isBound()).toBe(true)
    expect(h.waits).toBeGreaterThanOrEqual(1)
    expect(h.gateCalls).toHaveLength(1)
    expect(h.events.get('tools/execute')).toHaveLength(1)
  })

  it('(h) placement-path + real-supply law at the sources (readFileSync precedent): the wiring consumes the SAME a5PlaneValue.paAdmit closure with the COMPLETE construction binding (D2), builds the REAL arms through the existing wiring/adapters faces, gates bound on {ok:true} with pair-close deletion, and the module never accepts a boolean witness', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8')
    const ab = read('..', 'src', 'plugin', 'live', 'agent-bindings.mjs')
    const ttp = read('..', 'src', 'plugin', 'live', 'team-tool-plane.mjs')
    const mod = read('..', 'src', 'plugin', 'live', 'governed-families', 'schedule-bind-after-def.mjs')
    // REAL supply on the sibling closure, existing claim, existing arms:
    expect(ab).toContain('pa.paAdmit.open(walk)')
    expect(ab).toContain('pa.paAdmit.edge(Object.freeze(')
    expect(ab).toContain('createGovernedScheduleArm({')
    expect(ab).toContain('createScheduleWiring({')
    expect(ab).toContain('parseRequestedEffectSet(classified.effects)')
    // D2: the COMPLETE construction binding rides the edge verbatim:
    expect(ab).toContain('placementName: opened.placementName')
    expect(ab).toContain('paConstructionBinding: opened.paConstructionBinding')
    // gate + pair-close (A):
    expect(ab).toContain('the family write threw for')
    expect(ab).toContain('pair CLOSED for')
    expect(ab).toContain('{ ok: true, arms: arms.size, families: identities.length }')
    // retired shapes STAY retired:
    expect(ab).not.toContain('a5ScheduleInject')
    expect(ab).not.toContain('scheduleNatives')
    expect(ab).not.toContain('{ schedule: a5ScheduleInject }')
    // the ORIGINAL placement source carries exactly ONE governed arm:
    expect(ttp.match(/if \(scheduleGovernedNames !== null && scheduleGovernedNames\.includes\(spelling\)\) return spelling/g)).toHaveLength(1)
    // module: the proof is never a boolean; the witness law:
    expect(mod).toContain("typeof answer !== 'object'")
    expect(mod).toContain("typeof proof.grant.grantId !== 'string'")
    const preBody = mod.slice(mod.indexOf("events.on('tools/pre-execute'"), mod.indexOf("events.on('tools/execute'"))
    expect(preBody).not.toContain('consumePaAtBody')
    const execBody = mod.slice(mod.indexOf("events.on('tools/execute'"), mod.indexOf("events.on('tools/post-execute'"))
    // live recheck AFTER the consume and before next (post-consume bounds):
    expect(execBody.indexOf('await deps.consumePaAtBody')).toBeLessThan(execBody.indexOf('cancelled-before-body'))
    expect(execBody.indexOf('cancelled-before-body')).toBeLessThan(execBody.lastIndexOf('verifyLive(agent, exec.name'))
    // exactly-one next + around-chain post checks:
    expect(execBody.match(/await next\(\)/g)).toHaveLength(1)
    expect(execBody).toContain('disposed-around-chain')
    expect(execBody).toContain('service-identity-drift-post-body')
  })
})
