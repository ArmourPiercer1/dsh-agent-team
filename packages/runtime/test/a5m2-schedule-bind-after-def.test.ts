/**
 * a5m2-schedule-bind-after-def.test.ts — THE BIND-AFTER-DEF LAW, card #2 +
 * ROOT re-review residuals (tier 接线未测; unit-level against doubles —
 * mocks 不替生产). Laws: the created handler NEVER blocks the serial queue
 * (detached bounded safe point, root residual 1); readiness = def face +
 * the REAL ACTIVE tuple via nativeReady (residual 2); the ONE-FLIGHT token
 * reuses the plane's existing ledger via take→PA→next→finally (residual 3);
 * EXECUTE identity compares the SAVED bind-time reference (residual 4); the
 * true-native boundary is the ORDERING LAW (latest-subscribed = innermost,
 * cordis events.ts:229-243) — post-chain drift is OBSERVED, never a
* post-next refusal dressed as zero side effects (residual 5); bound ONLY on
 * canonical gate {ok:true} with pair-close (A); the proof is the RAW
 * plane-edge answer with its one-shot witness — NEVER a boolean; per-
 * dispatch CURRENT def/service/method identity.
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

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0) })
}

interface Harness {
  events: Map<string, Handler[]>
  guards: Array<(exec: unknown) => string | undefined>
  disposal: string[]
  notes: Array<Record<string, unknown>>
  refusals: Array<Error & { breakpoint?: { kind: string } }>
  consumeCalls: number
  gateCalls: unknown[]
  closeCalls: unknown[]
  takes: number
  settles: unknown[]
  waits: number
  defs: Map<string, unknown>
  fireCreated: (agent: unknown) => void
  deps: Record<string, unknown>
  setHandlerFault: (event: string) => void
}

interface HarnessOptions {
  defs?: Map<string, unknown>
  proof?: unknown | (() => unknown)
  gate?: (input: unknown) => unknown
  ready?: boolean | (() => boolean)
  take?: boolean
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
    takes: 0,
    settles: [],
    waits: 0,
    defs: opts.defs ?? new Map<string, unknown>([['schedule_list', makeDef('schedule_list')], ['schedule_delete', makeDef('schedule_delete')]]),
    fireCreated: () => {},
    deps: {},
    setHandlerFault: (event) => { faulted.add(event) },
  }
  let createdListener: ((p: { agent: unknown }) => unknown) | null = null
  h.fireCreated = (agent) => { createdListener?.({ agent }) }
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
    nativeReady: () => (opts.ready === undefined ? true : typeof opts.ready === 'function' ? opts.ready() : opts.ready),
    takePaToken: () => { h.takes += 1; return opts.take !== false },
    settlePaToken: (exec: unknown) => { h.settles.push(exec) },
    onBinded: (input: unknown) => {
      h.gateCalls.push(input)
      if (opts.gate === undefined) return { ok: true }
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

interface Handle { isBound: () => boolean, dispose: () => void, start: (a: unknown) => void }

async function bindOk (opts: HarnessOptions = {}): Promise<{ h: Harness, handle: Handle }> {
  const h = harness(opts)
  const handle = createScheduleBindAfterDef(h.deps as never) as unknown as Handle
  handle.start(AGENT)
  h.fireCreated(AGENT)
  await flush()
  expect(handle.isBound()).toBe(true)
  return { h, handle }
}

describe('a5m2 schedule bind-after-def (card #2 + root residuals)', () => {
  it('(a) no def at the safe point = bounded window, typed refusal, zero listeners, gate NEVER called — and the created handler returned SYNCHRONOUSLY (serial queue never blocked)', async () => {
    const h = harness({ defs: new Map() })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    const returned = h.fireCreated(AGENT)
    // residual 1: the serial announce must not await our poll — the handler
    // answers undefined synchronously and the safe point runs DETACHED.
    expect(returned).toBeUndefined()
    await flush()
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    expect(h.waits).toBe(3) // bounded attempts, all spent
    expect(h.refusals).toHaveLength(1)
    expect(h.refusals[0]?.breakpoint?.kind).toBe('native-never-active')
    expect(h.gateCalls).toHaveLength(0)
  })

  it('(b) look-alike copy at the bind-moment re-read refuses the whole bind BEFORE the gate', async () => {
    const list = makeDef('schedule_list')
    const defs = new Map<string, unknown>([['schedule_list', list], ['schedule_delete', makeDef('schedule_delete')]])
    let reads = 0
    const h = harness({ defs })
    h.deps.readToolDefinition = (name: string) => {
      reads += 1
      return (reads === 3 && name === 'schedule_list') ? { ...list } : defs.get(name)
    }
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    await flush()
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    expect(h.gateCalls).toHaveLength(0)
    expect(h.refusals[0]?.breakpoint?.kind).toBe('def-identity-drift')
  })

  it('(c) the gate opens exactly once with the ORIGINAL defs; pre-execute consumes NOTHING; the body accepts ONLY the raw plane proof — bool, missing witness, deny and cancelled all refuse with zero dispatch; the good proof dispatches with exactly ONE consume; the token flight takes BEFORE PA and settles FINALLY on BOTH outcomes', async () => {
    const { h } = await bindOk()
    expect(h.gateCalls).toHaveLength(1)
    const gateInput = h.gateCalls[0] as { definitions: Array<{ name: string }> }
    expect(gateInput.definitions.map((d) => d.name).sort()).toEqual(['schedule_delete', 'schedule_list'])
    const pre = listener<Handler>(h, 'tools/pre-execute')
    expect(pre({ name: 'schedule_list', agent: AGENT, callId: 'call-1' }, () => 'NEXT')).toBe('NEXT')
    expect(h.consumeCalls).toBe(0)

    const boolHarness = await bindOk({ proof: true })
    let dispatched = 0
    await expect(listener<ExecHandler>(boolHarness.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-b', token: {} }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-consume-proof-invalid' } })
    expect(dispatched).toBe(0)
    expect(boolHarness.h.consumeCalls).toBe(1)
    // the refused flight SETTLED its token (never left armed, never re-armed):
    expect(boolHarness.h.settles).toHaveLength(1)

    const noWitness = await bindOk({ proof: { kind: 'allow' } })
    await expect(listener<ExecHandler>(noWitness.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-w', token: {} }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-consume-proof-missing' } })
    const denied = await bindOk({ proof: { kind: 'deny', code: 'GRANT_STALE' } })
    await expect(listener<ExecHandler>(denied.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-d', token: {} }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-edge-refused' } })
    const cancelled = await bindOk({ proof: { kind: 'allow', cancelled: true, stage: 'edge' } })
    await expect(listener<ExecHandler>(cancelled.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-c', token: {} }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-cancelled' } })

    const exec = listener<ExecHandler>(h, 'tools/execute')
    expect(await exec({ name: 'schedule_delete', agent: AGENT, callId: 'call-3', token: {}, arguments: { id: 'task-1' } }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
    expect(h.takes).toBe(1)
    expect(h.settles).toHaveLength(1)
    expect(h.notes.map((n) => n.event)).toContain('bound-after-def')
    // residual 3: a REPLAYED token (the plane ledger answers the take false)
    // refuses BEFORE any PA entry — zero consume, nothing taken, nothing to settle:
    const replay = await bindOk({ take: false })
    await expect(listener<ExecHandler>(replay.h, 'tools/execute')({ name: 'schedule_list', agent: AGENT, callId: 'c-r', token: {} }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'pa-token-replay' } })
    expect(replay.h.consumeCalls).toBe(0) // zero PA entry on a replay
    expect(replay.h.settles).toHaveLength(0) // no take = nothing to settle
    // foreign agent / foreign name consume NOTHING (sameAgent scope exact)
    expect(await exec({ name: 'schedule_list', agent: OTHER, callId: 'call-5', token: {} }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(await exec({ name: 'bash', agent: AGENT, callId: 'call-6', token: {} }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
  })

  it('(d) per-dispatch identity: service swap, same-object METHOD swap, def swap and IN-PLACE execute swap all refuse BEFORE any consume; post-chain drift is OBSERVED, not a post-next refusal', async () => {
    const holder: { service: ReturnType<typeof makeService> } = { service: makeService() }
    const h = harness()
    h.deps.scheduleServiceFeed = () => holder.service
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    await flush()
    const boundDef = h.defs.get('schedule_list')
    const exec = listener<ExecHandler>(h, 'tools/execute')
    expect(await exec({ name: 'schedule_list', agent: AGENT, callId: 'd-0', token: {} }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
    const boundService = holder.service
    const boundList = boundService.list
    holder.service = makeService()
    let dispatched = 0
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-1', token: {} }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'service-identity-drift' } })
    expect(h.consumeCalls).toBe(1) // drift refuses BEFORE the consume
    holder.service = boundService
    boundService.list = async () => []
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-2', token: {} }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'service-method-drift' } })
    expect(h.consumeCalls).toBe(1)
    boundService.list = boundList
    h.defs.set('schedule_list', makeDef('schedule_list'))
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-3', token: {} }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'native-definition-drift' } })
    expect(h.consumeCalls).toBe(1)
    // residual 4: the SAME def object, IN-PLACE swapped execute — the saved
    // bind-time reference catches it (a same-object self-compare never could).
    h.defs.set('schedule_list', boundDef)
    ;(boundDef as { execute: unknown }).execute = async () => ({ content: [] })
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'd-4', token: {} }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'native-execute-drift' } })
    expect(h.consumeCalls).toBe(1)
    expect(dispatched).toBe(0)
  })

  it('(e) dispose closes everything; dispose DURING the consume refuses the body (consumption stays settled, token settles); no consume supply = body refuses AND the guard denies', async () => {
    const { h, handle } = await bindOk()
    expect(h.events.get('tools/pre-execute')).toHaveLength(1)
    expect(h.events.get('tools/execute')).toHaveLength(1)
    expect(h.events.get('tools/post-execute')).toHaveLength(1)
    expect(h.guards).toHaveLength(1)
    const self: { handle?: Handle } = {}
    const h2 = harness({ proof: () => { self.handle?.dispose(); return GOOD_PROOF } })
    const handle2 = createScheduleBindAfterDef(h2.deps as never) as unknown as Handle
    self.handle = handle2
    handle2.start(AGENT)
    h2.fireCreated(AGENT)
    await flush()
    const exec2 = listener<ExecHandler>(h2, 'tools/execute')
    let dispatched = 0
    await expect(exec2({ name: 'schedule_list', agent: AGENT, callId: 'e-1', token: {} }, () => { dispatched += 1; return 'DISPATCHED' }))
      .rejects.toMatchObject({ breakpoint: { kind: 'disposed-during-consume' } })
    expect(dispatched).toBe(0)
    expect(h2.settles).toHaveLength(1) // the refused flight settled its token
    handle.dispose()
    expect(handle.isBound()).toBe(false)
    expect(h.events.get('tools/pre-execute')).toHaveLength(0)
    expect(h.events.get('tools/execute')).toHaveLength(0)
    expect(h.events.get('tools/post-execute')).toHaveLength(0)
    expect(h.guards).toHaveLength(0)
    expect(h.disposal).toContain('created')
    const h3 = harness()
    delete h3.deps.consumePaAtBody
    const handle3 = createScheduleBindAfterDef(h3.deps as never) as unknown as Handle
    handle3.start(AGENT)
    h3.fireCreated(AGENT)
    await flush()
    const exec3 = listener<ExecHandler>(h3, 'tools/execute')
    await expect(exec3({ name: 'schedule_list', agent: AGENT, callId: 'e-2', token: {} }, () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'plane-edge-unwired' } })
    expect(h3.guards[0]?.({ name: 'schedule_list', agent: AGENT })).toContain('governed deny')
    expect(h3.guards[0]?.({ name: 'schedule_list', agent: OTHER })).toBeUndefined()
  })

  it('(f) canonical gate law (A): {ok:false}/throw refuse the bind with ZERO listeners and NO pair to close; gate SUCCESS + registration fault CLOSES the pair and deletes the gate keys via onBindClose', async () => {
    const refused = harness({ gate: () => ({ ok: false }) })
    const handleR = createScheduleBindAfterDef(refused.deps as never)
    handleR.start(AGENT)
    refused.fireCreated(AGENT)
    await flush()
    expect(refused.events.size).toBe(0)
    expect(refused.refusals[0]?.breakpoint?.kind).toBe('canonical-bind-refused')
    expect(refused.closeCalls).toHaveLength(0) // nothing was written — nothing to close
    const exploded = harness({ gate: () => 'throw' })
    const handleE = createScheduleBindAfterDef(exploded.deps as never)
    handleE.start(AGENT)
    exploded.fireCreated(AGENT)
    await flush()
    expect(exploded.refusals[0]?.breakpoint?.kind).toBe('canonical-bind-fault')
    expect(exploded.events.size).toBe(0)
    const h = harness()
    h.setHandlerFault('tools/post-execute')
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    await flush()
    expect(handle.isBound()).toBe(false)
    expect(h.refusals[0]?.breakpoint?.kind).toBe('bind-registration-fault')
    expect(h.closeCalls).toHaveLength(1)
    expect(h.events.get('tools/execute') ?? []).toHaveLength(0)
    expect(h.events.get('tools/pre-execute') ?? []).toHaveLength(0)
    expect(h.disposal).toContain('event:tools/pre-execute')
    expect(h.disposal).toContain('event:tools/execute')
  })

  it('(g) created is an EVENT: the detached safe point binds when the def appears AND the real ACTIVE tuple answers; def visible but NO tuple keeps the pair CLOSED (residual 2)', async () => {
    // def appears late + ready true → bind at a later attempt
    const h = harness({ defs: new Map() })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    h.defs.set('schedule_list', makeDef('schedule_list'))
    h.defs.set('schedule_delete', makeDef('schedule_delete'))
    await flush()
    expect(handle.isBound()).toBe(true)
    expect(h.waits).toBeGreaterThanOrEqual(1)
    expect(h.gateCalls).toHaveLength(1)
    // def visible immediately but the ACTIVE tuple NEVER answers → closed pair
    const closed = harness({ ready: false })
    const handle2 = createScheduleBindAfterDef(closed.deps as never)
    handle2.start(AGENT)
    closed.fireCreated(AGENT)
    await flush()
    expect(handle2.isBound()).toBe(false)
    expect(closed.events.size).toBe(0)
    expect(closed.gateCalls).toHaveLength(0)
    expect(closed.refusals[0]?.breakpoint?.kind).toBe('native-never-active')
  })

  it('(h) ordering law (residual 5): with a later-closing pair, the SETTLED result passes through and the fact is OBSERVED — no post-next refusal pretending to undo a run body', async () => {
    const self: { handle?: Handle } = {}
    const h = harness()
    const handle = createScheduleBindAfterDef(h.deps as never) as unknown as Handle
    self.handle = handle
    handle.start(AGENT)
    h.fireCreated(AGENT)
    await flush()
    const exec = listener<ExecHandler>(h, 'tools/execute')
    const result = await exec({ name: 'schedule_list', agent: AGENT, callId: 'h-1', token: {} }, async () => {
      self.handle?.dispose() // the pair closes while the inner chain runs
      return 'DISPATCHED'
    })
    expect(result).toBe('DISPATCHED')
    expect(h.notes.map((n) => n.event)).toContain('post-boundary-pair-closed')
    expect(h.settles).toHaveLength(1)
  })

  it('(i) source law (readFileSync precedent): serial-queue-safe created handler, REAL ACTIVE-tuple reader (no private map), the SAME plane ledger face for take/settle (no new ledger), bind-time execute refs, ordering-law observation — all pinned where they must live', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8')
    const ab = read('..', 'src', 'plugin', 'live', 'agent-bindings.mjs')
    const ttp = read('..', 'src', 'plugin', 'live', 'team-tool-plane.mjs')
    const mod = read('..', 'src', 'plugin', 'live', 'governed-families', 'schedule-bind-after-def.mjs')
    // residual 1: detached safe point, serial queue untouched
    expect(mod).toContain('void bindAfterDefSafePoint(agent)')
    expect(mod).not.toMatch(/subscribeAgentCreated\(\(\{ agent \}\) => \{[\s\S]{0,400}?return run\b/)
    // residual 2: REAL tuple reader; private map RETIRED
    expect(ab).toContain('a5ScheduleSurfaceEntry')
    expect(ab).toContain('surface.entryOf(name)')
    expect(ab).toContain("binding.status !== 'ACTIVE'")
    expect(ab).toContain('definitionIdentityOf(definition)')
    expect(ab).not.toContain('a5SchedulePlacement')
    // residual 3: the SAME governedTokenLedger, narrow face; no second ledger
    expect(ttp).toContain('paTokenLedger: Object.freeze({')
    expect((ttp.match(/governedTokenLedger/g) ?? []).length).toBeGreaterThan(6)
    expect(ab).toContain('a5PlaneValue?.paTokenLedger')
    expect(mod).toContain("throw breakpoint('pa-token-replay'")
    expect(mod).toContain('deps.settlePaToken?.(exec)')
    // residual 4: saved bind-time execute reference
    expect(mod).toContain('bindMethods.executes.set(name, def.execute)')
    expect(mod).toContain("current.execute !== bindMethods.executes.get(name)")
    // residual 5: post-chain is OBSERVED, not refused
    expect(mod).toContain("note('post-boundary-pair-closed'")
    expect(mod).not.toContain('disposed-around-chain')
    expect(mod).not.toContain('service-identity-drift-post-body')
    // earlier laws still stand:
    expect(ab).toContain('pa.paAdmit.open(walk)')
    expect(ab).toContain('pa.paAdmit.edge(Object.freeze(')
    expect(ab).toContain('placementName: opened.placementName')
    expect(ab).toContain('paConstructionBinding: opened.paConstructionBinding')
    expect(ab).not.toContain('a5ScheduleInject')
    expect(ab).not.toContain('scheduleNatives')
    expect(ttp.match(/if \(scheduleGovernedNames !== null && scheduleGovernedNames\.includes\(spelling\)\) return spelling/g)).toHaveLength(1)
    expect(mod).toContain("typeof answer !== 'object'")
    const preBody = mod.slice(mod.indexOf("events.on('tools/pre-execute'"), mod.indexOf("events.on('tools/execute'"))
    expect(preBody).not.toContain('consumePaAtBody')
    const execBody = mod.slice(mod.indexOf("events.on('tools/execute'"), mod.indexOf("events.on('tools/post-execute'"))
    expect(execBody.indexOf('await deps.consumePaAtBody')).toBeLessThan(execBody.indexOf('cancelled-before-body'))
    expect(execBody.match(/await next\(\)/g)).toHaveLength(1)
  })
})
