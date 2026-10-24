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
  establishCalls: number
  guardsAtEstablish: number[]
  waits: number
  defs: Map<string, unknown>
  fireCreated: (agent: unknown) => void
  gateSelf: { handle?: Handle }
  deps: Record<string, unknown>
  setHandlerFault: (event: string) => void
}

interface HarnessOptions {
  defs?: Map<string, unknown>
  proof?: unknown | (() => unknown)
  gate?: (input: unknown) => unknown
  ready?: boolean | (() => boolean)
  take?: boolean
  establish?: unknown | (() => unknown)
  gateDuring?: (self: { handle?: Handle }) => void
  feed?: () => unknown
  serviceGeneration?: () => unknown
}

function harness (opts: HarnessOptions = {}): Harness {
  const faulted = new Set<string>()
  const gateSelf: { handle?: Handle } = {}
  const h: Harness = {
    gateSelf,
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
    establishCalls: 0,
    guardsAtEstablish: [],
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
    scheduleServiceFeed: opts.feed ?? (() => FIXED_SERVICE),
    ...(opts.serviceGeneration === undefined ? {} : { serviceGeneration: opts.serviceGeneration }),
    establishNative: (entries: Array<{ name: string }>) => {
      h.establishCalls += 1
      // b6: the provisional handover deny must ALREADY stand when ACTIVE is
      // written — the window has no unguarded moment:
      h.guardsAtEstablish.push(h.guards.length)
      expect(entries.map((e) => e.name).sort()).toEqual(['schedule_delete', 'schedule_list'])
      if (opts.establish === undefined) return { ok: true }
      return typeof opts.establish === 'function' ? (opts.establish as () => unknown)() : opts.establish
    },
    nativeReady: () => (opts.ready === undefined ? true : typeof opts.ready === 'function' ? opts.ready() : opts.ready),
    takePaToken: () => { h.takes += 1; return opts.take !== false },
    settlePaToken: (exec: unknown) => { h.settles.push(exec) },
    onBinded: (input: unknown) => {
      h.gateCalls.push(input)
      opts.gateDuring?.(gateSelf)
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
  expect(h.guardsAtEstablish).toEqual([1])
  // provisional lifted on success; what stands is the ONE standing guard,
  // which (consume supplied) never denies — governance now lives in the hooks.
  expect(h.guards).toHaveLength(1)
  expect(h.guards[0]?.({ name: 'schedule_list', agent: AGENT })).toBeUndefined()
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
    expect(h.refusals[0]?.breakpoint?.kind).toBe('def-never-appeared')
    expect(h.establishCalls).toBe(0) // establishment waits for the def face, never before
    expect(h.gateCalls).toHaveLength(0)
  })

  it('(k) THE CORDIS 639 PROXY WORLD (root 2026-10-24 residual): raw reads answer a FRESH proxy per read and a FRESH method object per access — the PUBLIC provider GENERATION (the G6-0655 shape) is the currentness law; a replacement/non-ACTIVE generation INVALIDATES the bound capture', async () => {
    // The 639 tracker shape as root measured it (host.ts:2994-3000 was the
    // phantom-drift source): EVERY ctx.get read returns a new tracker proxy
    // and EVERY method access returns a new function object. An identity
    // comparison across reads was a guaranteed FALSE refusal (正向必拒).
    const target = makeService() as Record<string, unknown>
    const rawRead = (): Record<string, unknown> => new Proxy(target, {
      get: (t, key) => {
        const v = Reflect.get(t, key)
        if (typeof v === 'function') {
          const fn = (...args: unknown[]): unknown => (v as (...a: unknown[]) => unknown)(...args)
          return fn
        }
        return v
      },
    })
    // The bind-ONCE facade law (mirrors host.ts bindOnceScheduleFacade):
    // child.get bound ONCE at the generation boundary, functions bound ONCE.
    const bindOnceFacade = (svc: Record<string, unknown>): Record<string, unknown> => Object.freeze(Object.fromEntries(Object.keys(svc).map((key) => {
      const v = svc[key]
      return [key, typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(svc) : v]
    })))
    let generation: { id: number, service: unknown } | null = Object.freeze({ id: 1, service: bindOnceFacade(rawRead()) })
    // ANTI-FAKE-GREEN: the tracker world NEVER answers the same object twice,
    // while the generation facade's method handles ARE stable bound handles —
    // a plain-object-identity harness could not express this difference:
    expect(rawRead()).not.toBe(rawRead())
    const facade1 = generation.service as Record<string, unknown>
    expect(facade1.list).toBe(facade1.list)
    const face = (): unknown => generation
    const { h } = await bindOk({ feed: () => generation?.service, serviceGeneration: face })
    // POSITIVE: real dispatch through the proxy world — CURRENTNESS is the
    // generation, never the (never-reused) read identity; the facade is fed
    // to the gate as the service face (adapter assembly identity law holds
    // within one generation because the facade answers the SAME object).
    const gateInput = h.gateCalls[0] as { service: unknown }
    expect(gateInput.service).toBe(generation?.service)
    const exec = listener<ExecHandler>(h, 'tools/execute')
    expect(await exec({ name: 'schedule_list', agent: AGENT, callId: 'k-1', token: {} }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
    expect(h.notes.map((n) => n.event)).not.toContain('post-boundary-service-drift')
    // NEGATIVE 1 (replacement): the provider moved to a NEW generation — the
    // old capture is INVALIDATED, the call refuses with the typed lifecycle
    // drift and the PA seat is NEVER entered on the stale provider.
    generation = Object.freeze({ id: 2, service: bindOnceFacade(rawRead()) })
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'k-2', token: {} }, async () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'service-generation-drift' } })
    expect(h.consumeCalls).toBe(1)
    // NEGATIVE 2 (non-ACTIVE window): the lifecycle stops answering —
    // unknowable NEVER becomes allow-by-default (fail closed).
    generation = null
    await expect(exec({ name: 'schedule_list', agent: AGENT, callId: 'k-3', token: {} }, async () => 'DISPATCHED'))
      .rejects.toMatchObject({ breakpoint: { kind: 'service-lifecycle-unobservable' } })
    expect(h.consumeCalls).toBe(1)
    // SOURCE LAW: the host publishes exactly this shape — inject callback IS
    // the generation boundary, the facade binds ONCE, the FEED answers only
    // the CURRENT ACTIVE generation, and the fiber gate quotes the public
    // FiberState.ACTIVE (2). Zero private unwrap anywhere in the block.
    const here = dirname(fileURLToPath(import.meta.url))
    const host = readFileSync(join(here, '..', 'src', 'plugin', 'host.ts'), 'utf8')
    expect(host).toContain("ctx.inject(['schedule']")
    expect(host).toContain('bindOnceScheduleFacade')
    expect(host).toContain('scheduleServiceFeed: (): unknown => scheduleLifecycle.currentGeneration()?.service')
    expect(host).toContain('state !== 2')
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
    // b4 addendum: disposed WHILE the gate await runs — the keys the gate
    // just wrote are closed through the same pair-close path; no faces open.
    const mid = harness()
    const gateClose = (): void => { handleM.dispose() }
    mid.deps.onBinded = async (input: unknown) => {
      mid.gateCalls.push(input)
      // the pair is disposed WHILE this await runs — after the gate wrote
      // its keys, before the module could open any face:
      gateClose()
      await new Promise((resolve) => { setTimeout(resolve, 5) })
      return { ok: true }
    }
    const handleM = createScheduleBindAfterDef(mid.deps as never) as unknown as Handle
    handleM.start(AGENT)
    mid.fireCreated(AGENT)
    await flush()
    expect(handleM.isBound()).toBe(false)
    expect(mid.refusals[0]?.breakpoint?.kind).toBe('disposed-during-gate')
    expect(mid.closeCalls).toHaveLength(1)
    expect((mid.closeCalls[0] as { reason?: string })?.reason).toBe('disposed-during-gate')
    expect(mid.events.size).toBe(0)
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
    // def visible, establishment ran ONCE, but the ACTIVE tuple does not
    // answer → IMMEDIATE typed refusal (no stretched poll: zero waits)
    const closed = harness({ ready: false })
    const handle2 = createScheduleBindAfterDef(closed.deps as never)
    handle2.start(AGENT)
    closed.fireCreated(AGENT)
    await flush()
    expect(handle2.isBound()).toBe(false)
    expect(closed.events.size).toBe(0)
    expect(closed.gateCalls).toHaveLength(0)
    expect(closed.establishCalls).toBe(1) // ONCE — the b4 establishment law
    expect(closed.waits).toBe(0) // IMMEDIATE: the poll never stretches for the tuple
    expect(closed.refusals[0]?.breakpoint?.kind).toBe('native-tuple-not-active')
    // establishment REFUSED = typed refusal, once, no poll, no gate, no faces
    const refused = harness({ establish: () => ({ ok: false, detail: 'definition unreadable at the public seam' }) })
    const handle3 = createScheduleBindAfterDef(refused.deps as never)
    handle3.start(AGENT)
    refused.fireCreated(AGENT)
    await flush()
    expect(handle3.isBound()).toBe(false)
    expect(refused.establishCalls).toBe(1)
    expect(refused.waits).toBe(0)
    expect(refused.events.size).toBe(0)
    expect(refused.gateCalls).toHaveLength(0)
    expect(refused.refusals[0]?.breakpoint?.kind).toBe('native-bind-refused')
    expect(refused.refusals[0]?.message).toContain('unreadable at the public seam')
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

  it('(j) THE HANDOVER WINDOW (b6): the provisional deny (sameAgent, pair names ONLY) stands BEFORE ACTIVE is written, refuses calls through the whole awaited gate, hands over to governance on success, and on failure keeps refusing until dispose', async () => {
    let releaseGate: () => void = () => {}
    const gateOpen = new Promise<void>((resolve) => { releaseGate = resolve })
    const h = harness({ gate: async () => { await gateOpen; return { ok: true } } })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    await new Promise((resolve) => { setTimeout(resolve, 2) })
    // mid-window: ACTIVE is written, the gate is still awaited, hooks are NOT in
    expect(h.establishCalls).toBe(1)
    expect(h.guardsAtEstablish).toEqual([1]) // the shield was mounted BEFORE establish
    expect(handle.isBound()).toBe(false)
    const shield = h.guards[0]
    expect(shield).toBeDefined()
    expect(shield?.({ name: 'schedule_list', agent: AGENT })).toContain('provisional handover deny')
    expect(shield?.({ name: 'schedule_delete', agent: AGENT })).toContain('provisional handover deny')
    expect(shield?.({ name: 'schedule_list', agent: OTHER })).toBeUndefined() // sameAgent exact
    expect(shield?.({ name: 'bash', agent: AGENT })).toBeUndefined() // pair names ONLY
    // success: hooks go live synchronously, THEN the shield stands down
    releaseGate()
    await flush()
    expect(handle.isBound()).toBe(true)
    expect(h.guards).toHaveLength(1) // provisional gone; only the standing (non-denying) guard remains
    expect(h.guards[0]?.({ name: 'schedule_list', agent: AGENT })).toBeUndefined()
    const exec = listener<ExecHandler>(h, 'tools/execute')
    expect(await exec({ name: 'schedule_list', agent: AGENT, callId: 'j-1', token: {} }, async () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toBe(1)
    // failure AFTER the shield mounted: refused, and it KEEPS refusing until dispose
    const failed = harness({ establish: () => ({ ok: false, detail: 'bind refused' }) })
    const handleF = createScheduleBindAfterDef(failed.deps as never)
    handleF.start(AGENT)
    failed.fireCreated(AGENT)
    await flush()
    expect(handleF.isBound()).toBe(false)
    expect(failed.guardsAtEstablish).toEqual([1])
    expect(failed.guards).toHaveLength(1) // kept past the refusal…
    expect(failed.guards[0]?.({ name: 'schedule_list', agent: AGENT })).toContain('provisional handover deny')
    handleF.dispose()
    expect(failed.guards).toHaveLength(0) // …until exactly dispose
    // no public guard face = the establishment REFUSES before any ACTIVE write
    const bare = harness()
    delete bare.deps.registerGuard
    const handleB = createScheduleBindAfterDef(bare.deps as never)
    handleB.start(AGENT)
    bare.fireCreated(AGENT)
    await flush()
    expect(bare.establishCalls).toBe(0) // refusal PRECEDES establish
    expect(bare.gateCalls).toHaveLength(0)
    expect(bare.refusals[0]?.breakpoint?.kind).toBe('provisional-deny-unavailable')
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
    // residual 5: post-chain is OBSERVED, not refused; the OLD wording is gone
    expect(mod).toContain("note('post-boundary-pair-closed'")
    expect(mod).not.toContain('disposed-around-chain')
    expect(mod).not.toContain('service-identity-drift-post-body')
    expect(mod).not.toContain('zero-side-effect')
    expect(mod).not.toContain('native-never-active')
    // b4: explicit ONE establishment via the assembly's ORIGINAL bind/
    // verification, immediate tuple check, gate-await dispose closes the keys
    expect(ab).toContain('a5p1Guard.bindOwnTools(entries.map((entry) => entry.name))')
    expect(mod).toContain("throw breakpoint('native-bind-refused'")
    expect(mod).toContain("throw breakpoint('native-tuple-not-active'")
    expect(mod).toContain("deps.onBindClose?.({ reason: 'disposed-during-gate' })")
    expect(mod).toContain("throw breakpoint('disposed-during-gate'")
    // b6: the handover shield mounts BEFORE the ACTIVE write and lives outside
    // the face-list unwind (a pair-close never lifts it); audit origin wording
    expect(mod).toContain('provisional handover deny')
    expect(mod).toContain("throw breakpoint('provisional-deny-unavailable'")
    expect(mod.indexOf('registerProvisional((exec)')).toBeLessThan(mod.indexOf('deps.establishNative'))
    expect(ab).toContain('TEAM GOVERNANCE BINDING established')
    expect(ab).toContain('implementation registered by the ORIGINAL Schedule plugin')
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
