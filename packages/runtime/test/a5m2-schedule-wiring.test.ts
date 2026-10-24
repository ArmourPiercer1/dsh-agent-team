/**
 * a5m2-schedule-wiring.test.ts — the CONTROLLED WIRING spec for the B-SCHEDULE
 * list/delete subset (root 17:38 on the f541 narrow-PASSed adapter rev 2:
 * list/delete may enter controlled wiring; create/update may NOT be enabled).
 *
 * This spec owns the ASSEMBLY facts the adapter spec could not reach — it
 * does NOT re-prove the adapter laws (the 29-leg a5m2-schedule-adapters spec
 * owns those against the owner's module):
 *
 *  (a) the factory over the REAL adapter module mounts list/delete ONLY:
 *      the captured definition travels COMPLETE with ONLY execute replaced
 *      (every face by REFERENCE), and create/update stay the adapter's own
 *      honest DECLARED-INACTIVE capture-absent rows — no definition, no
 *      registration, typed refusal with zero port entry — while the adapter
 *      module keeps all four record specs and placed-def faces (required
 *      deliverables, not deletable);
 *  (b) THE THREE CAPTURE LAWS ARE REQUIRED FACTORY INPUTS and are FORWARDED
 *      verbatim: omitting capturedAgent, liveScheduleService or
 *      ScheduleInputError answers the ADAPTER's own P_B_SCHEDULE_INPUT_INVALID
 *      (this wiring adds no gate that could mask it). Behaviorally: the owner
 *      law is REFERENCE identity (an id/session-bytes look-alike Agent object
 *      settles the host's own internal_error VALUE with zero port entry), and
 *      the error mirror maps ONLY through `instanceof` the injected class — a
 *      same-name duck settles internal_error, never its internal bytes;
 *  (c) THE SUBSET IS CLOSED: a schedule_create or schedule_update capture is
 *      refused P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE BEFORE the adapter sees
 *      it (never silently dropped, never half-mounted); their claims fall
 *      closed — no registration key ever enters the production registry for
 *      them, while the family-target grammar itself is REGISTERED at this
 *      base (see (g)) — create/update fall closed on the closed capture and
 *      the closed key set alone;
 *  (d) REGISTRATION LAW through the PRODUCTION registry: family keys are the
 *      RUNTIME placement identities (the test's feed is backed by the REAL
 *      `definitionIdentityOf` mint), never the capture-side strings; a silent
 *      feed THROWS P_B_SCHEDULE_PLACEMENT_KEY_ABSENT with the registry left
 *      untouched; a moved identity THROWS P_B_SCHEDULE_PLACEMENT_KEY_MOVED;
 *      a conflicting claim on a placed key throws (the registry's own law);
 *  (e) the claim edge mints the LOSSLESS FLAT projection of the adapter's
 *      MEASURED plan.target — the eleven leaves, key-for-key identical for
 *      list and delete, taskId exactly as measured (null for list and for
 *      id-law-refused delete, the exact validated id for an admitted delete),
 *      destination session === owner session (C1) — ONE admission per plan
 *      object at this edge; only {ok:true} reaches the dispatch (a refusal
 *      settles the call typed with ZERO port entry, a commit dispatches
 *      exactly once); the same plan object never dispatches twice (the
 *      adapter's INTERNAL MEMO refusal, named gap PLAN_ONCE_MEMO — the
 *      durable one-shot consumed-proof is the plane's consume-for-execution
 *      edge and is claimed nowhere here);
 *  (f) C1 at the row face: the list row's parameters are the captured closed
 *      face (a caller-passed sessionId is refused with zero admission), and
 *      the service-call sessionId is the BOUND owner's — never a caller string;
 *  (g) GRAMMAR-STATE PIN (re-anchored per root 23:09 at int a985a3401):
 *      the signed family-chain landing put the closed 'B-SCHEDULE' rule
 *      into PA_FAMILY_TARGET_RULES (TEN families at this base since the
 *      joint batch landed B-SUBAGENT at cc6a0f643; the
 *      nullableString/stringArray kinds carry the measured taskId leaf —
 *      the round-3 escalation was SIGNED, not worked around). The mint →
 *      durable-pending path is therefore OPEN: validatePaFamilyTarget
 *      ACCEPTS BOTH minted shapes (list taskId null, delete the exact
 *      validated id) — the eleven lossless leaves pass the signed rule
 *      instead of denying. B-TERMINAL is STILL not here (G3 BLOCKED);
 *      unknown-family refusal stays asserted. Wiring is proved at this
 *      file's factory level; the real-plane pass-through lives in
 *      a5m2-schedule-production.test.ts; end-to-end on Host is claimed
 *      nowhere (候选接线未测).
 *
 * DISCLOSED STAND-INS: the native faces are hand-minted COMPLETE captures
 * (name/description/parameters/output{schema,render}/execute — the real
 * registration minimum-entry shape the adapter gate mirrors; the pristine-
 * host face proofs are owned by the adapter spec); the schedule port is the
 * spec's double and no real trigger/timer/host leg exists anywhere here —
 * those dimensions stay the adapter's named gaps, carried verbatim.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'

type Claim = { familyId: string; adapterRevision: number; providerIdentity: string; targetManifest: Record<string, unknown> }
type AdmitCtx = { name: string; recordIndex: number; familyId: string; classified: { ok: boolean; code?: string; plan?: Record<string, unknown> }; exec: unknown; targetManifest?: Record<string, unknown>; family?: Claim }
type Row = {
  name: string
  active: boolean
  capturePresent: boolean
  description: string | null
  parameters: Record<string, unknown> | null
  namedGaps: Record<string, string>
  classify: (args: unknown) => { ok: boolean; code?: string; detail?: string; plan?: Record<string, unknown> }
  delegate: (plan: Record<string, unknown>, ctx?: { exec?: unknown }) => Promise<{ ok?: boolean; code?: string; settled?: string; value?: unknown }>
}
type Definition = { [face: string]: unknown; name: string; description: string; parameters?: Record<string, unknown>; output: { schema: unknown; render: unknown }; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> }
type Wiring = {
  ok: true
  familyId: string
  wiringRevision: number
  adapterRevision: number
  providerId: string
  subset: Array<{ name: string; recordIndex: number; familyId: string }>
  definitions: Definition[]
  rows: Record<string, { status: string; reason?: string; row: Row; definition?: Definition }>
  declared: Array<{ name: string; status: string; reason: string }>
  rowOf: (name: string) => Row | undefined
  drain: () => { event: string; semantics: string }
  inFlight: () => { dispatches: number; refuses: number }
  familyRegistrations: () => Array<{ name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }>
  mountGovernedFamilies: () => Array<{ name: string; definitionIdentity: string; entry: { familyId: string } }>
  claimStats: () => { admits: number; admissionRefusals: number; admittedOnce: number; claimMintRefusals: number }
}
type Refusal = { ok: false; code: string; message: string }
type WiringModule = {
  A5_B_SCHEDULE_WIRING_REVISION: number
  A5_B_SCHEDULE_WIRING_CODES: Record<string, string>
  A5_B_SCHEDULE_WIRING_SUBSET: Array<{ name: string; recordIndex: number; familyId: string }>
  createScheduleWiring: (input?: Record<string, unknown>) => Wiring | Refusal
}

const WIRING_MODULE = (await import(new URL('../src/plugin/live/governed-families/schedule-wiring.mjs', import.meta.url).href)) as WiringModule
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/schedule-adapters.mjs', import.meta.url).href)) as {
  A5_B_SCHEDULE_FAMILY_ID: string
  A5_B_SCHEDULE_ADAPTER_REVISION: number
  A5_B_SCHEDULE_RECORD_SPECS: Record<string, { recordIndex: number; operation: string }>
  A5_B_SCHEDULE_TOOL_NAMES: string[]
  A5_B_SCHEDULE_NAMED_GAPS: Record<string, string>
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  A5_GOVERNED_FAMILIES: Record<string, { familyId: string; adapterRevision: number; providerIdentity: string }>
  registerA5GovernedFamily: (key: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}

const WIRE_CODES = WIRING_MODULE.A5_B_SCHEDULE_WIRING_CODES
const FAMILY = ADAPTER.A5_B_SCHEDULE_FAMILY_ID

// A lane-local ScheduleInputError CLASS IDENTITY — the L6 mirror law is about
// the injected CLASS, not the name (the REAL published class pairing is owned
// by the adapter spec, which mounts the pristine schedule lib).
class LaneScheduleInputError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}
class LaneDuckError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; this.name = 'ScheduleInputError' } }

let sessionCounter = 0
function makeWorld (over: Record<string, unknown> = {}) {
  sessionCounter += 1
  const ownerSessionId = `wire-session-${sessionCounter}`
  const capturedAgent = Object.freeze({ id: `wire-agent-${sessionCounter}`, session: Object.freeze({ id: ownerSessionId }) })
  const serviceCalls: Array<{ method: string; args: unknown }> = []
  const portBehaviour = (over.port as Record<string, (args: unknown) => unknown> | undefined) ?? {}
  const service: Record<string, unknown> = {
    create: async () => ({}),
    list: async (req: unknown) => { serviceCalls.push({ method: 'list', args: req }); return typeof portBehaviour.list === 'function' ? portBehaviour.list(req) : [] },
    catalog: async () => [],
    history: async () => [],
    delete: async (req: unknown) => { serviceCalls.push({ method: 'delete', args: req }); return typeof portBehaviour.delete === 'function' ? portBehaviour.delete(req) : { deleted: true } },
    update: async () => ({}),
  }
  const natives: Record<string, Definition> = {}
  const mkNative = (name: string) => (natives[name] = Object.freeze({
    name,
    description: `captured ${name} description bytes`,
    parameters: Object.freeze({ type: 'object', properties: Object.freeze({}) }),
    output: Object.freeze({ schema: Object.freeze({ type: 'object' }), render: (v: unknown) => JSON.stringify(v) }),
    execute: async () => ({}),
  }) as unknown as Definition)
  const events: Array<Record<string, unknown>> = []
  const admitsSeen: AdmitCtx[] = []
  const { port: _portBehaviour, admit: _rawAdmit, ...forwardedOver } = over
  const admit = typeof over.admit === 'function'
    ? async (ctx: AdmitCtx) => { admitsSeen.push(ctx); return (over.admit as (c: AdmitCtx) => Promise<{ ok: boolean }>)(ctx) }
    : async (ctx: AdmitCtx) => { admitsSeen.push(ctx); return { ok: true } }
  const base: Record<string, unknown> = {
    providerId: 'a5m2-wire-lane',
    declaredService: Object.freeze({ present: true }),
    captured: Object.freeze({
      schedule_list: { native: mkNative('schedule_list'), definitionIdentity: `capture-side-list-${sessionCounter}` },
      schedule_delete: { native: mkNative('schedule_delete'), definitionIdentity: `capture-side-delete-${sessionCounter}` },
    }),
    liveNative: (name: string) => natives[name],
    scheduleService: service,
    liveScheduleService: () => service,
    capturedAgent,
    ScheduleInputError: LaneScheduleInputError,
    placementFeed: (name: string) => ({ definitionIdentity: `feed-${name}-${sessionCounter}` }),
    admit,
    observe: (row: Record<string, unknown>) => { events.push(row) },
    ...forwardedOver,
  }
  return { base, events, admitsSeen, serviceCalls, natives, ownerSessionId, capturedAgent, service }
}
const unwrap = (result: Wiring | Refusal): Wiring => {
  if (result.ok !== true) throw new Error(`assembly refused: ${JSON.stringify(result)}`)
  return result
}
const portCalls = (events: Array<Record<string, unknown>>) => events.filter((e) => e.event === 'b-schedule:port-call')
const execFor = (agent: unknown) => ({ agent, signal: new AbortController().signal })

describe('a5m2-schedule-wiring — the controlled list/delete wiring over the real adapter', () => {
  describe('(a) the assembly mounts the subset ONLY', () => {
    it('list/delete mount ACTIVE; every captured face rides BY REFERENCE and only execute is replaced', () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      expect(wiring.ok).toBe(true)
      expect(wiring.familyId).toBe(FAMILY)
      expect(wiring.adapterRevision).toBe(ADAPTER.A5_B_SCHEDULE_ADAPTER_REVISION)
      expect(wiring.definitions.map((d) => d.name).sort()).toEqual(['schedule_delete', 'schedule_list'])
      for (const definition of wiring.definitions) {
        const native = world.natives[definition.name]!
        expect(definition.description).toBe(native.description)
        expect(definition.parameters).toBe(native.parameters)
        expect(definition.output).toBe(native.output)
        expect(definition.execute).not.toBe(native.execute)
      }
      expect(wiring.rows.schedule_list!.status).toBe('ACTIVE')
      expect(wiring.rows.schedule_delete!.status).toBe('ACTIVE')
    })
    it('create/update stay the adapter\u2019s honest declared/INACTIVE rows: no definition, no registration, typed refusal with zero port entry — and the adapter module keeps all four record specs (deliverable intact)', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      expect(Object.keys(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS).sort()).toEqual(['schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update'])
      expect(ADAPTER.A5_B_SCHEDULE_TOOL_NAMES).toHaveLength(4)
      expect(wiring.rows.schedule_create!.status).toBe('DECLARED-INACTIVE')
      expect(wiring.rows.schedule_update!.status).toBe('DECLARED-INACTIVE')
      expect(wiring.declared.map((d) => d.name).sort()).toEqual(['schedule_create', 'schedule_update'])
      const refused = wiring.rowOf('schedule_create')!.classify({})
      expect(refused.ok).toBe(false)
      expect(String(refused.code)).toBe('P_B_SCHEDULE_CAPTURE_ABSENT')
      const delegated = await wiring.rowOf('schedule_update')!.delegate({} as never)
      expect(delegated.ok).toBe(false)
      expect(portCalls(world.events)).toHaveLength(0)
      expect(wiring.definitions.map((d) => d.name)).not.toContain('schedule_create')
    })
    it('the import closure is exactly {schedule-adapters, pa-mount-registry} (source text), no dynamic import, no lane-private or immature-resource specifier', () => {
      const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'schedule-wiring.mjs'), 'utf8')
      const statics = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => String(m[1]))
      expect(statics.slice().sort()).toEqual(['../pa-mount-registry.mjs', './schedule-adapters.mjs'])
      expect(source).not.toMatch(/\bimport\s*\(/)
      for (const banned of ['team-tool-plane', 'glue', 'pa-control-bridge', 'control/types', 'g1-', 'g2-', 'g3-', 'todo.mjs', 'write.mjs', 'image', 'dist/', 'tool-dispatch']) {
        expect(statics.some((s) => s.includes(banned)), `closure carries ${banned}`).toBe(false)
      }
    })
  })

  describe('(b) the three capture laws are REQUIRED factory inputs — the refusal is the adapter\u2019s own bytes', () => {
    it('omitting capturedAgent / liveScheduleService / ScheduleInputError each answers P_B_SCHEDULE_INPUT_INVALID (the wiring adds no masking gate)', () => {
      for (const key of ['capturedAgent', 'liveScheduleService', 'ScheduleInputError']) {
        const world = makeWorld()
        delete world.base[key]
        const result = WIRING_MODULE.createScheduleWiring(world.base)
        expect(result.ok, `omit ${key}`).toBe(false)
        expect((result as Refusal).code, `omit ${key}`).toBe('P_B_SCHEDULE_INPUT_INVALID')
      }
    })
    it('the owner law is REFERENCE identity: an id/session-bytes LOOK-ALIKE Agent settles the host\u2019s internal_error VALUE with zero port entry; the bound object itself dispatches', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      const listDef = wiring.definitions.find((d) => d.name === 'schedule_list')!
      const lookAlike = { id: world.capturedAgent.id, session: { id: world.ownerSessionId } }
      const answer = (await listDef.execute({}, execFor(lookAlike))) as { code?: string }
      expect(answer.code).toBe('internal_error')
      expect(portCalls(world.events)).toHaveLength(0)
      const mine = await listDef.execute({}, execFor(world.capturedAgent))
      expect(Array.isArray(mine)).toBe(true)
      expect(portCalls(world.events)).toHaveLength(1)
    })
    it('the error mirror is instanceof the INJECTED class identity: an injected-class throw maps its own code, a same-name DUCK settles internal_error (no internal bytes)', async () => {
      const realThrow = makeWorld({ port: { list: () => { throw new LaneScheduleInputError('invalid_rule', 'internal detail bytes must never travel') } } })
      const wiringReal = unwrap(WIRING_MODULE.createScheduleWiring(realThrow.base))
      const realAnswer = (await wiringReal.definitions.find((d) => d.name === 'schedule_list')!.execute({}, execFor(realThrow.capturedAgent))) as { code?: string; message?: string }
      expect(realAnswer.code).toBe('invalid_rule')
      const duckThrow = makeWorld({ port: { list: () => { throw new LaneDuckError('invalid_rule', 'internal detail bytes') } } })
      const wiringDuck = unwrap(WIRING_MODULE.createScheduleWiring(duckThrow.base))
      const duckAnswer = (await wiringDuck.definitions.find((d) => d.name === 'schedule_list')!.execute({}, execFor(duckThrow.capturedAgent))) as { code?: string; message?: string }
      expect(duckAnswer.code).toBe('internal_error')
      expect(JSON.stringify(duckAnswer)).not.toContain('internal detail bytes')
    })
  })

  describe('(c) the subset is closed by the root ruling', () => {
    it('a schedule_create or schedule_update capture is refused P_B_SCHEDULE_WIRE_NON_SUBSET_CAPTURE BEFORE the adapter sees it', () => {
      for (const name of ['schedule_create', 'schedule_update']) {
        const world = makeWorld()
        const captured = { ...(world.base.captured as Record<string, unknown>), [name]: { native: world.natives.schedule_list, definitionIdentity: 'capture-side-extra' } }
        const result = WIRING_MODULE.createScheduleWiring({ ...world.base, captured })
        expect(result.ok, name).toBe(false)
        expect((result as Refusal).code, name).toBe(WIRE_CODES.NON_SUBSET_CAPTURE)
        expect((result as Refusal).message).toContain('may NOT be enabled')
      }
    })
    it('their claims fall closed: the registry answers NO key for them, and the family gate would deny', () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      wiring.mountGovernedFamilies()
      expect(REGISTRY.a5GovernedFamilyFor(`capture-side-list-${sessionCounter}`)).toBeUndefined()
      expect(REGISTRY.a5GovernedFamilyFor('capture-side-extra')).toBeUndefined()
      const keys = Object.keys(REGISTRY.A5_GOVERNED_FAMILIES).filter((k) => k.endsWith(`-${sessionCounter}`))
      expect(keys.sort()).toEqual([`feed-schedule_delete-${sessionCounter}`, `feed-schedule_list-${sessionCounter}`])
    })
  })

  describe('(d) registration law through the PRODUCTION registry', () => {
    it('family keys are the RUNTIME placement identities minted off the SAME published def objects that mount and execute — never a first-set identity riding a second-set body (root 303)', () => {
      const world = makeWorld()
      // ONE wiring owns the whole lifecycle and the feed answers THAT
      // wiring's own definitions (late-bound map, installed before any
      // registration read). The root law: the identity a registration
      // carries and the definition whose execute actually runs are the SAME
      // object — a second assembly with look-alike defs is the exact drift
      // this leg forbids, so no second createScheduleWiring call exists
      // anywhere on this path.
      const minted = new Map<string, string>()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring({
        ...world.base,
        placementFeed: (name: string) => ({ definitionIdentity: minted.get(name) }),
      }))
      for (const d of wiring.definitions) minted.set(d.name, String(definitionIdentityOf(d as never)))
      const registrations = wiring.familyRegistrations()
      expect(registrations.map((r) => r.name).sort()).toEqual(['schedule_delete', 'schedule_list'])
      const defByName = new Map(wiring.definitions.map((d) => [d.name, d]))
      for (const registration of registrations) {
        expect(registration.definitionIdentity).toBe(minted.get(registration.name))
        expect(registration.definitionIdentity).not.toContain('capture-side')
        expect(registration.entry).toEqual({ familyId: FAMILY, adapterRevision: ADAPTER.A5_B_SCHEDULE_ADAPTER_REVISION, providerIdentity: 'a5m2-wire-lane' })
        // THE same-object law: the identity IS definitionIdentityOf of the
        // very definition this wiring publishes — the one the plane would
        // execute. Registration and execution share the one object.
        expect(String(definitionIdentityOf(defByName.get(registration.name) as never)), registration.name).toBe(registration.definitionIdentity)
      }
      const mounted = wiring.mountGovernedFamilies()
      expect(mounted).toHaveLength(2)
      for (const registration of registrations) {
        expect(REGISTRY.a5GovernedFamilyFor(registration.definitionIdentity)).toEqual(registration.entry)
      }
    })
    it('a silent placement feed THROWS (no guessed key, no silent skip) and the registry is left untouched', () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring({ ...world.base, placementFeed: () => undefined }))
      const before = Object.keys(REGISTRY.A5_GOVERNED_FAMILIES).length
      expect(() => wiring.mountGovernedFamilies()).toThrow(/P_B_SCHEDULE_PLACEMENT_KEY_ABSENT/)
      expect(Object.keys(REGISTRY.A5_GOVERNED_FAMILIES)).toHaveLength(before)
    })
    it('a moved placement identity THROWS on the second mount read (identities do not float)', () => {
      const world = makeWorld()
      let reads = 0
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring({
        ...world.base,
        placementFeed: (name: string) => ({ definitionIdentity: reads++ === 0 ? `feed-${name}-${sessionCounter}` : 'drifted-identity' }),
      }))
      wiring.familyRegistrations()
      expect(() => wiring.familyRegistrations()).toThrow(/P_B_SCHEDULE_PLACEMENT_KEY_MOVED/)
    })
    it('a conflicting claim on EITHER key refuses the WHOLE family write BEFORE any key enters (root 308 atomicity: the second conflict never leaves the first)', () => {
      const world = makeWorld()
      const minted = new Map<string, string>()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring({ ...world.base, placementFeed: (name: string) => ({ definitionIdentity: minted.get(name) }) }))
      for (const d of wiring.definitions) minted.set(d.name, String(definitionIdentityOf(d as never)))
      // The conflict sits on the SECOND written key (registration order is
      // list → delete). A one-by-one writer would leave the first entry
      // behind HERE; the lane PREFLIGHTS every key before writing any, and
      // the rollback backstop unwinds only this writer's own keys.
      const doomed = String(minted.get('schedule_delete'))
      REGISTRY.registerA5GovernedFamily(doomed, { familyId: 'B-OTHER', adapterRevision: 1, providerIdentity: 'other' })
      const before = Object.keys(REGISTRY.A5_GOVERNED_FAMILIES).length
      expect(() => wiring.mountGovernedFamilies()).toThrow(/P_B_SCHEDULE_REGISTRATION_CONFLICT/)
      expect(Object.keys(REGISTRY.A5_GOVERNED_FAMILIES)).toHaveLength(before)
      expect(REGISTRY.a5GovernedFamilyFor(String(minted.get('schedule_list')))).toBeUndefined()
      // the foreign prior claim is untouched — rollback unwinds the WRITER's
      // own uncommitted keys, never someone else's entry
      expect(REGISTRY.a5GovernedFamilyFor(doomed)?.familyId).toBe('B-OTHER')
    })
  })

  describe('(e) the claim edge: lossless measured projection, one admission per plan, refusal/commit settle', () => {
    it('both operations mint the SAME eleven measured leaves; taskId rides exactly as measured (null for list, the exact id for delete); destination session === owner session (C1)', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      const listDef = wiring.definitions.find((d) => d.name === 'schedule_list')!
      const deleteDef = wiring.definitions.find((d) => d.name === 'schedule_delete')!
      await listDef.execute({}, execFor(world.capturedAgent))
      await deleteDef.execute({ id: 'task-exact-1' }, execFor(world.capturedAgent))
      expect(world.admitsSeen).toHaveLength(2)
      const listClaim = world.admitsSeen[0]!.family!
      const deleteClaim = world.admitsSeen[1]!.family!
      expect(listClaim.familyId).toBe(FAMILY)
      expect(listClaim.adapterRevision).toBe(ADAPTER.A5_B_SCHEDULE_ADAPTER_REVISION)
      expect(listClaim.providerIdentity).toBe('a5m2-wire-lane')
      expect(Object.keys(listClaim.targetManifest).sort()).toEqual(Object.keys(deleteClaim.targetManifest).sort())
      expect(Object.keys(listClaim.targetManifest).sort()).toEqual(['action', 'contract', 'destinationPath', 'destinationSessionId', 'destinationWake', 'ownerKind', 'ownerSessionId', 'revision', 'taskId', 'timerEffect', 'timerNamespace'])
      expect(listClaim.targetManifest.taskId).toBeNull()
      expect(deleteClaim.targetManifest.taskId).toBe('task-exact-1')
      expect(listClaim.targetManifest.ownerKind).toBe('bound-live-agent-reference')
      for (const claim of [listClaim, deleteClaim]) {
        expect(claim.targetManifest.ownerSessionId).toBe(world.ownerSessionId)
        expect(claim.targetManifest.destinationSessionId).toBe(world.ownerSessionId)
        expect(typeof claim.targetManifest.contract).toBe('string')
        expect(String(claim.targetManifest.contract).length).toBeGreaterThan(0)
      }
      expect(listClaim.targetManifest.action).toBe('schedule-list')
      expect(deleteClaim.targetManifest.action).toBe('schedule-delete')
      expect(wiring.claimStats()).toEqual({ admits: 2, admissionRefusals: 0, admittedOnce: 2, claimMintRefusals: 0 })
    })
    it('refusal settles the call typed with ZERO port entry; commit dispatches exactly once', async () => {
      const refusedWorld = makeWorld({ admit: async () => ({ ok: false, code: 'ADMISSION_REFUSED', detail: 'the world says no' }) })
      const refused = unwrap(WIRING_MODULE.createScheduleWiring(refusedWorld.base))
      let thrown: { code?: string } | null = null
      try { await refused.definitions[0]!.execute({}, execFor(refusedWorld.capturedAgent)) } catch (error) { thrown = error as { code?: string } }
      expect(thrown?.code).toBe('ADMISSION_REFUSED')
      expect(portCalls(refusedWorld.events)).toHaveLength(0)
      expect(refused.inFlight()).toEqual({ dispatches: 0, refuses: 0 })
      expect(refused.claimStats().admissionRefusals).toBe(1)
      const commitWorld = makeWorld()
      const committed = unwrap(WIRING_MODULE.createScheduleWiring(commitWorld.base))
      await committed.definitions.find((d) => d.name === 'schedule_list')!.execute({}, execFor(commitWorld.capturedAgent))
      expect(portCalls(commitWorld.events)).toHaveLength(1)
      expect(committed.inFlight().dispatches).toBe(1)
    })
    it('the same plan object never dispatches twice (adapter INTERNAL MEMO refusal verbatim; the durable consumed-proof stays the plane edge — PLAN_ONCE_MEMO)', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      const row = wiring.rowOf('schedule_list')!
      const classified = row.classify({})
      expect(classified.ok).toBe(true)
      const first = await row.delegate(classified.plan!, { exec: execFor(world.capturedAgent) })
      expect(first.ok).toBe(true)
      const second = await row.delegate(classified.plan!, { exec: execFor(world.capturedAgent) })
      expect(second.ok).toBe(false)
      expect(String(second.code)).toBe('P_B_SCHEDULE_ALREADY_DISPATCHED')
      expect(portCalls(world.events)).toHaveLength(1)
    })
    it('a delete whose id law fails still rides its claim with taskId null (measured) and settles the tool-law VALUE with zero port entry', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      const deleteDef = wiring.definitions.find((d) => d.name === 'schedule_delete')!
      const value = (await deleteDef.execute({ id: '  ' }, execFor(world.capturedAgent))) as { code?: string }
      expect(value.code).toBe('invalid_rule')
      expect(world.admitsSeen).toHaveLength(1)
      expect(world.admitsSeen[0]!.family!.targetManifest.taskId).toBeNull()
      expect(portCalls(world.events)).toHaveLength(0)
    })
  })

  describe('(f) C1 at the row face: the service sessionId is the bound owner, never a caller string', () => {
    it('a caller-supplied sessionId never becomes the service session: the list law answers invalid_selector with ZERO port entry and its claim still carries the bound owner; the port read carries the bound owner session; delete carries owner + EXACT id', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      const listDef = wiring.definitions.find((d) => d.name === 'schedule_list')!
      const answer = (await listDef.execute({ sessionId: 'someone-elses-session' }, execFor(world.capturedAgent))) as { code?: string }
      expect(answer.code).toBe('invalid_selector')
      expect(portCalls(world.events)).toHaveLength(0)
      expect(world.admitsSeen[0]!.family!.targetManifest.ownerSessionId).toBe(world.ownerSessionId)
      expect(world.admitsSeen[0]!.family!.targetManifest.destinationSessionId).toBe(world.ownerSessionId)
      await listDef.execute({}, execFor(world.capturedAgent))
      expect(world.serviceCalls[0]).toEqual({ method: 'list', args: { sessionId: world.ownerSessionId } })
      await wiring.definitions.find((d) => d.name === 'schedule_delete')!.execute({ id: 'task-exact-2' }, execFor(world.capturedAgent))
      expect(world.serviceCalls[1]).toEqual({ method: 'delete', args: { sessionId: world.ownerSessionId, id: 'task-exact-2' } })
    })
  })

  describe('(g) GRAMMAR-STATE PIN: mount+registration+consumption are wired; the B-SCHEDULE table is REGISTERED at this base — both minted shapes PASS the signed rule (the mint to durable-pending path is open)', () => {
    it('PA_FAMILY_TARGET_RULES answers the eleven landed families (re-anchored at the joint merge: the int batch landed B-SUBAGENT at cc6a0f643 — ten by name; B-TERMINAL JOINS from the a5m2-wire-g3 additive entry, root 20:38 闭表补齐, riding directly after B-INSPECT) and validatePaFamilyTarget ACCEPTS both minted shapes: the lossless eleven leaves with taskId null (list) and the exact validated id (delete)', async () => {
      expect(Object.keys(PA_FAMILY_TARGET_RULES)).toEqual(['B-SESSION', 'B-IMAGE', 'B-BROWSER', 'B-WEB', 'B-WRITE', 'B-CONTROL', 'B-PLUGIN', 'B-INSPECT', 'B-TERMINAL', 'B-PTC', 'B-SCHEDULE', 'B-SESSION-QUERY', 'B-MCP', 'B-TEAM', 'B-SUBAGENT'] /* census sync (this lane's B-PTC round): B-BROWSER/B-WEB rode in on the G2 re-anchor merge and these two pins never refreshed (pre-existing int drift, reported); B-PTC joins after B-TERMINAL per root 04:4x 闭表补齐 */)
      expect(PA_FAMILY_TARGET_RULES['B-TERMINAL' as keyof typeof PA_FAMILY_TARGET_RULES]).toBeDefined()
      expect(PA_FAMILY_TARGET_RULES['B-SUBAGENT']).toBeDefined()
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      await wiring.definitions.find((d) => d.name === 'schedule_list')!.execute({}, execFor(world.capturedAgent))
      await wiring.definitions.find((d) => d.name === 'schedule_delete')!.execute({ id: 'task-exact-3' }, execFor(world.capturedAgent))
      expect(world.admitsSeen).toHaveLength(2)
      const taskIds = world.admitsSeen.map((seen) => String((seen.family!.targetManifest as Record<string, unknown>).taskId))
      expect(taskIds).toEqual(['null', 'task-exact-3'])
      for (const seen of world.admitsSeen) {
        expect(validatePaFamilyTarget(FAMILY, seen.family!.targetManifest)).toBeUndefined()
      }
    })
  })

  describe('(h) honest boundaries: named gaps verbatim, no revocation overclaim, drain passthrough', () => {
    it('every active row carries the adapter\u2019s named gaps BY REFERENCE verbatim (TRIGGER_GOVERNANCE + PLAN_ONCE_MEMO ride every plan)', () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      for (const name of ['schedule_list', 'schedule_delete']) {
        expect(wiring.rowOf(name)!.namedGaps).toBe(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS)
        expect(Object.keys(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS)).toContain('TRIGGER_GOVERNANCE')
        expect(Object.keys(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS)).toContain('PLAN_ONCE_MEMO')
      }
      const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'schedule-wiring.mjs'), 'utf8')
      expect(source).not.toMatch(/auto[- ]revoc/i)
      expect(source).toContain('status === \'active\'')
    })
    it('drain is the adapter\u2019s new-call prohibition verbatim and lands on every dispatch edge', async () => {
      const world = makeWorld()
      const wiring = unwrap(WIRING_MODULE.createScheduleWiring(world.base))
      const drained = wiring.drain()
      expect(drained.event).toBe('b-schedule:drain')
      let thrown: { code?: string } | null = null
      try { await wiring.definitions[0]!.execute({}, execFor(world.capturedAgent)) } catch (error) { thrown = error as { code?: string } }
      expect(thrown?.code).toBe('P_B_SCHEDULE_DRAINING')
      expect(portCalls(world.events)).toHaveLength(0)
    })
  })
})
