/**
 * a5m2-schedule-bind-after-def.test.ts — THE BIND-AFTER-DEF LAW (CENTER
 * 00:3x + ROOT run_code-PROVEN lessons; tier 接线未测). Hook route, ZERO own
 * registration: the FIRST read of the native pair only AFTER agent/created
 * settled; ONLY original definition objects bind (bind-moment re-read); the
 * three core/tools waterfalls run sameAgent govern-then-next; the FINAL PA
 * consume + live re-check live AT the tools/execute BODY boundary (the
 * run_code D2 lesson: pre-execute must NOT consume a ticket and leave the
 * downstream Ask stages uncovered) — one consume per one native dispatch;
 * the guard stays deny-only defense-in-depth; family registration runs on
 * the ORIGINAL paths (definitionIdentityOf + registerA5GovernedFamily) at
 * the bind moment — no parallel placement source.
 *
 * Legs (a)-(e) are the card's five gates; leg (f) pins the placement-path
 * and body-boundary laws (root run_code card) as source-level law, the
 * settled readFileSync precedent of the sibling wiring spec.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createScheduleBindAfterDef } from '../src/plugin/live/governed-families/schedule-bind-after-def.mjs'

const AGENT = Object.freeze({ id: 'member-agent' })
const OTHER = Object.freeze({ id: 'other-agent' })

function makeDef (name: string) {
  return { name, description: `desc-${name}`, parameters: { type: 'object' }, output: {} }
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

interface Harness {
  events: Map<string, Array<(...args: never[]) => unknown>>
  guards: Array<(exec: unknown) => string | undefined>
  disposal: string[]
  notes: Array<Record<string, unknown>>
  refusals: Array<Error & { breakpoint?: { kind: string; expected?: string; actual?: string } }>
  consumeCalls: unknown[][]
  bindeds: Array<{ agent: unknown, definitions: Array<{ name: string, definition: unknown }> }>
  defs: Map<string, unknown>
  fireCreated: (agent: unknown) => void
  deps: Record<string, unknown>
}

function harness (opts: { defs?: Map<string, unknown>, service?: unknown, consumeAtBody?: boolean, readOverride?: (name: string, n: number) => unknown } = {}): Harness {
  const h: Harness = {
    events: new Map(),
    guards: [],
    disposal: [],
    notes: [],
    refusals: [],
    consumeCalls: [],
    bindeds: [],
    defs: opts.defs ?? new Map<string, unknown>([['schedule_list', makeDef('schedule_list')], ['schedule_delete', makeDef('schedule_delete')]]),
    fireCreated: () => {},
    deps: {},
  }
  let reads = 0
  const svc = opts.service ?? makeService() // PINNED: a fresh object per read is the drift leg's own subject
  let createdListener: ((p: { agent: unknown }) => void) | null = null
  h.fireCreated = (agent) => { createdListener?.({ agent }) }
  h.deps = {
    readToolDefinition: (name: string) => {
      reads += 1
      if (opts.readOverride) return opts.readOverride(name, reads)
      return h.defs.get(name)
    },
    subscribeAgentCreated: (fn: (p: { agent: unknown }) => void) => {
      createdListener = fn
      return () => { createdListener = null; h.disposal.push('created') }
    },
    agentEvents: {
      on: (event: string, handler: (...args: never[]) => unknown) => {
        const arr = h.events.get(event) ?? []
        arr.push(handler)
        h.events.set(event, arr)
        return () => { h.events.set(event, arr.filter((entry) => entry !== handler)); h.disposal.push(`event:${event}`) }
      },
    },
    registerGuard: (fn: (exec: unknown) => string | undefined) => {
      h.guards.push(fn)
      return () => { h.guards.splice(h.guards.indexOf(fn), 1); h.disposal.push('guard') }
    },
    scheduleServiceFeed: () => svc,
    consumePaAtBody: opts.consumeAtBody === false ? undefined : (exec: unknown, definition: unknown) => {
      h.consumeCalls.push([exec, definition])
      return true
    },
    onBinded: (row: { agent: unknown, definitions: Array<{ name: string, definition: unknown }> }) => { h.bindeds.push(row) },
    onBindRefused: (error: Error & { breakpoint?: { kind: string } }) => { h.refusals.push(error) },
    observe: (row: Record<string, unknown>) => { h.notes.push(row) },
  }
  return h
}

async function bindOk () {
  const h = harness()
  const handle = createScheduleBindAfterDef(h.deps as never)
  handle.start(AGENT)
  h.fireCreated(AGENT)
  expect(handle.isBound()).toBe(true)
  return { h, handle }
}

describe('a5m2 schedule bind-after-def (CENTER 00:3x + run_code law)', () => {
  it('(a) no-def-yet = NO binding and a typed refusal — never a silent allow: created over an absent pair leaves zero waterfall listeners and hands the refuse owner the exact breakpoint', () => {
    const h = harness({ defs: new Map() })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    h.fireCreated(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    expect(h.refusals).toHaveLength(1)
    expect(h.refusals[0].breakpoint?.kind).toBe('def-absent-post-created')
    expect(h.refusals[0].breakpoint?.expected).toContain('schedule_list')
    expect(h.notes.map((n) => n.event)).toContain('bind-refused')
  })

  it('(b) exact-def identity binds post-created — a look-alike copy at the bind-moment re-read REFUSES the whole bind (no listener survives it)', () => {
    const original = { list: makeDef('schedule_list'), delete: makeDef('schedule_delete') }
    const defs = new Map<string, unknown>([['schedule_list', original.list], ['schedule_delete', original.delete]])
    const h = harness({
      defs,
      readOverride: (name, n) => (n > 2 && name === 'schedule_list' ? { ...original.list } : defs.get(name)),
    })
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    expect(handle.isBound()).toBe(false)
    expect(h.events.size).toBe(0)
    expect(h.refusals).toHaveLength(1)
    expect(h.refusals[0].breakpoint?.kind).toBe('def-identity-drift')
  })

  it('(c) pre-execute consumes NOTHING (the D2 law); the final PA consume sits AT the execute body boundary — a missing witness refuses the body BEFORE dispatch, one owned call consumes exactly once', async () => {
    // pre-execute never consumes: bind with a live consume spy, fire pre-execute
    const { h } = await bindOk()
    const pre = h.events.get('tools/pre-execute')![0] as (e: unknown, next: () => unknown) => unknown
    expect(pre({ name: 'schedule_list', agent: AGENT, callId: 'call-1' }, () => 'NEXT')).toBe('NEXT')
    expect(h.consumeCalls).toHaveLength(0)
    // and next() still runs downstream Ask stages (the waterfall was not eaten)
    // body boundary WITHOUT a witness = refusal, zero consume, zero dispatch
    const bare = harness({ consumeAtBody: false })
    const bareHandle = createScheduleBindAfterDef(bare.deps as never)
    bareHandle.start(AGENT)
    bare.fireCreated(AGENT)
    const bareExec = bare.events.get('tools/execute')![0] as (e: unknown, next: () => unknown) => Promise<unknown>
    let dispatched = 0
    await expect(bareExec({ name: 'schedule_list', agent: AGENT, callId: 'call-2' }, () => { dispatched += 1; return 'DISPATCHED' })).rejects.toMatchObject({
      code: 'a5m2-schedule-bind-breakpoint',
      breakpoint: { kind: 'pa-not-consumed' },
    })
    expect(dispatched).toBe(0)
    expect(bare.notes.map((n) => n.event)).toContain('pa-not-consumed')
    // WITH the witness: exactly ONE consume for the one native dispatch
    const exec = h.events.get('tools/execute')![0] as (e: unknown, next: () => unknown) => Promise<unknown>
    expect(await exec({ name: 'schedule_delete', agent: AGENT, callId: 'call-3' }, () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toHaveLength(1)
    expect(h.notes.map((n) => n.event)).toContain('pa-consumed-at-body')
    // foreign agent / foreign name consume NOTHING (sameAgent scope exact)
    expect(await exec({ name: 'schedule_list', agent: OTHER, callId: 'call-4' }, () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(await exec({ name: 'bash', agent: AGENT, callId: 'call-5' }, () => 'DISPATCHED')).toBe('DISPATCHED')
    expect(h.consumeCalls).toHaveLength(1)
  })

  it('(d) drift at execute = typed refusal BEFORE the consume and BEFORE the body; steady identity passes with the witness taken', async () => {
    let live = makeService()
    const h = harness()
    h.deps.scheduleServiceFeed = () => live
    const handle = createScheduleBindAfterDef(h.deps as never)
    handle.start(AGENT)
    h.fireCreated(AGENT)
    const exec = h.events.get('tools/execute')![0] as (e: unknown, next: () => unknown) => Promise<unknown>
    expect(await exec({ name: 'schedule_list', agent: AGENT }, () => 'DISPATCHED')).toBe('DISPATCHED')
    live = makeService() // the service object replaced underneath the bind
    let nextDuringDrift = 0
    await expect(exec({ name: 'schedule_list', agent: AGENT }, () => { nextDuringDrift += 1; return 'DISPATCHED' })).rejects.toMatchObject({
      code: 'a5m2-schedule-bind-breakpoint',
      breakpoint: { kind: 'service-identity-drift' },
    })
    expect(nextDuringDrift).toBe(0)
    // drift refused BEFORE consume: the witness count did not grow on the drift leg
    expect(h.consumeCalls).toHaveLength(1)
  })

  it('(e) dispose removes ALL three waterfall listeners, the guard and the created subscription (zero residue, re-bind clean)', async () => {
    const { h, handle } = await bindOk()
    expect(h.events.get('tools/pre-execute')).toHaveLength(1)
    expect(h.events.get('tools/execute')).toHaveLength(1)
    expect(h.events.get('tools/post-execute')).toHaveLength(1)
    expect(h.guards).toHaveLength(1)
    handle.dispose()
    expect(handle.isBound()).toBe(false)
    expect(h.events.get('tools/pre-execute')).toHaveLength(0)
    expect(h.events.get('tools/execute')).toHaveLength(0)
    expect(h.events.get('tools/post-execute')).toHaveLength(0)
    expect(h.guards).toHaveLength(0)
    expect(h.disposal).toContain('created')
    handle.start(AGENT)
    h.fireCreated(AGENT)
    expect(handle.isBound()).toBe(true)
    handle.dispose()
  })

  it('(f) placement-path law (root run_code card): the ORIGINAL paths only — paPlacementNameOf resolves the governed pair ONLY through the new mount-declared input (zero flip), the bind-moment family registration runs on definitionIdentityOf + registerA5GovernedFamily with PREFLIGHT-before-write, and NO early tools.get capture survives; the plane input is scheduleEnabled-gated and registers NO definitions', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8')
    const ab = read('..', 'src', 'plugin', 'live', 'agent-bindings.mjs')
    const ttp = read('..', 'src', 'plugin', 'live', 'team-tool-plane.mjs')
    // 1) bind-moment family registration on the ORIGINAL canonical faces
    expect(ab).toContain('definitionIdentityOf(entry.definition)')
    expect(ab).toContain('registerA5GovernedFamily(registration.identity')
    expect(ab).toContain('a5GovernedFamilyFor(identity)')
    expect(ab).toContain('family-registration ROLLED BACK')
    // 2) the retired early-capture law is GONE: no scheduleNatives loop, no
    // setup-time pair fetch survives in the mount.
    expect(ab).not.toContain('scheduleNatives')
    expect(ab).not.toContain('no native ${scheduleName} definition')
    // 3) plane input: scheduleEnabled-gated, zero placement — and the pair is
    // carried ONLY as governed NAMES (no definitions, no backends.schedule).
    expect(ab).toContain('scheduleGovernedNames: planeCfg?.scheduleEnabled === true')
    expect(ab).not.toContain('{ schedule: a5ScheduleInject }')
    // 4) the ORIGINAL placement-name source grew the zero-flip arm — nothing
    // parallel: exactly one scheduleGovernedNames resolution in paPlacementNameOf.
    expect(ttp).toContain('const scheduleGovernedNames = Array.isArray(input.scheduleGovernedNames)')
    expect(ttp).toContain('if (scheduleGovernedNames !== null && scheduleGovernedNames.includes(spelling)) return spelling')
    // 5) the bind module consumes ONLY at the execute body boundary — the
    // pre-execute listener body contains no consume call (D2 law, module face).
    const mod = read('..', 'src', 'plugin', 'live', 'governed-families', 'schedule-bind-after-def.mjs')
    const preBody = mod.slice(mod.indexOf("events.on('tools/pre-execute'"), mod.indexOf("events.on('tools/execute'"))
    expect(preBody).not.toContain('consumePa')
    const execBody = mod.slice(mod.indexOf("events.on('tools/execute'"), mod.indexOf("events.on('tools/post-execute'"))
    expect(execBody).toContain('consumePaAtBody ?? deps.consumePa')
    // consume happens AFTER the live service re-check (live recheck AT the boundary)
    expect(execBody.indexOf('live !== serviceAtBind')).toBeLessThan(execBody.indexOf('consumePaAtBody'))
  })
})
