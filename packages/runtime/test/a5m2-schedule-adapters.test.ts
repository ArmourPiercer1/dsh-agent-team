/**
 * A5M2-SCHEDULE-ADAPTERS — the B-SCHEDULE family spec (census records 30
 * schedule_create / 31 schedule_delete / 32 schedule_list / 33
 * schedule_update; family B-SCHEDULE, ownerRole SERVICE, mountCondition
 * declared_mount; contract M0-B-FAMILY-TARGET-CONTRACTS.md §B-SCHEDULE).
 *
 * The legs assert the ADAPTER's real contracts against the REAL published
 * Host interface @639ed01539 (pristine tests/deepseek-harness-test-use):
 *
 *  (a) the frozen dispatch facts (records 30/31/32/33, B-SCHEDULE,
 *      declared_mount) AND a measurement against the REAL published
 *      ScheduleService: the port-law table's arity equals the real
 *      prototype arity (create 3 / list 1 / catalog 0 / history 1 /
 *      delete 2 / update 2), and the module's import closure is exactly
 *      ['node:crypto'] — zero lane-private imports, zero host imports, no
 *      dynamic import (asserted from SOURCE TEXT);
 *  (b) declared_mount honesty: no declared proof ⇒ four honest DECLARED rows
 *      (typed refusal bytes, zero port entry, NO definitions, NO
 *      registrations, presented captures REPORTED-ignored, never silently
 *      dropped); a missing capture is per-record CAPTURE_ABSENT; a foreign
 *      capture, a half-capture, a capture without the liveNative re-read, a
 *      partial port, and an unknown input key are assembly refusals;
 *  (c) THE REAL CAPTURED DEFINITION TRAVELS COMPLETE: the four natives are
 *      the REAL published defineTool products (the pristine schedule lib's
 *      own registerScheduleTools run against the REAL Context+SystemPrompt+
 *      ToolRuntime, captured through ctx.tools.get — the production capture
 *      seam). Every captured face rides into the placed definition verbatim
 *      BY REFERENCE with ONLY execute replaced, and the emitted definitions
 *      pass the REAL registration minimum entry (真实 register 最低入口核):
 *      accepted + stored verbatim by the real ToolRuntime, while the
 *      hand-fabricated half-shape is refused by the real entry itself and
 *      the duplicate law holds;
 *  (d) classify mirrors the captured tool bodies' OWN argument law as
 *      model-visible VALUES (invalid_selector/invalid_prompt/invalid_rule/
 *      frequency_too_high bytes measured from tools.ts) with ZERO port
 *      entry; every plan is frozen, fingerprinted, gap-carrying (rev-2 gap
 *      set: TIMER_ARM/TRIGGER_GOVERNANCE/PLAN_ONCE_MEMO/PERSISTENCE_ORDER),
 *      and carries the contract §B-SCHEDULE TARGET (root ①: owner session +
 *      taskId + revision + action; timer namespace+effect SERVICE-labelled;
 *      destination session + wake labelled service-owned);
 *  (e) dispatch answers the REAL service contract: exact port tuples
 *      (sessionId read from the BOUND owner Agent by reference, the create
 *      request = the classified args, the live exec.signal by reference, the
 *      CAS `expected` record by reference), the published scheduleView
 *      projection (state/deliveryMode), the update two-step
 *      list→catalog ended/not-found split with zero update entry, the L6
 *      error-VALUE mirror through `instanceof` the REAL published
 *      ScheduleInputError (root ③ — a duck error wearing a closed code maps
 *      to internal_error and NEVER leaks its message bytes), and the plan
 *      MEMO law (consumed/foreign/stale plans refuse with zero port entry;
 *      the copy-reuse boundary is PINNED honestly — consumedProof is the
 *      center PA edge, root ④);
 *  (f) governance edges: the host identity-refusal VALUE for a caller that
 *      is not the BOUND owner Agent OBJECT (root ②: a look-alike object
 *      carrying the SAME id/header/session bytes is refused exactly like the
 *      host refuses it — tools.ts:438/:457/:481/:509 reference law), the
 *      per-tool HOST CHECK ORDER (delete answers the invalid_rule VALUE
 *      before the identity check), the pre-abort internal_error VALUE with
 *      zero port entry, definition/port drift refusals INCLUDING the live
 *      ctx.schedule re-read (root ②: a replaced service object refuses; the
 *      old constant self-compare is gone) and the update post-await
 *      re-verify (a service replaced during the list await refuses with
 *      ZERO update entry), the drain new-call-prohibition, and the required
 *      admit seam (a refusal throws with the refusing side's OWN bytes,
 *      zero port entry);
 *  (g) the registration face: keys are the placement feed's RUNTIME
 *      identities (backed by the REAL definitionIdentityOf mint over the
 *      emitted definitions — never the capture-side string), the frozen
 *      entry passes the PRODUCTION registry's own registerA5GovernedFamily
 *      shape law, and a silent/moved feed THROWS.
 *
 * DISCLOSED STAND-INS: the schedule-service port, the admit seam, the
 * placement feed, the liveNative feed, the liveScheduleService re-read feed
 * and the owner Agent stand-in are lane-side doubles (production: the live
 * ctx.schedule, the plane PA walk, the pb §6 placement seam, the member's
 * REAL live Agent object bound at placement exactly like the host's
 * registerScheduleTools(rootCtx, toolCtx, agent)). The ScheduleInputError
 * used by the L6 legs is the REAL published class — not a double. The captured natives' EXECUTE BODIES are never
 * run by anything here — the rows dispatch to the port, and the capture
 * stand-in's own schedule recorder must stay EMPTY for the whole spec
 * (zero native entry). This spec is NOT C2: no Host, no network; C2/C3
 * (real trigger, restart, cancel-then-no-wake) stay with the record
 * acceptance. Windows dimensions: not run, never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-schedule-adapters
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'

// ── the production module under spec (hand-cast, house idiom) ─────────────
type PlanTarget = { contract: string; owner: { kind: string; sessionId: string }; action: string; taskId: string | null; revision: string; timer: { namespace: string; effect: string }; destination: { sessionId: string; path: string; wake: string } }
type Plan = { rowName: string; recordIndex: number; operation: string; target: PlanTarget; args: Record<string, unknown>; toolError?: { code: string; message: string }; parametersFingerprint: string; namedGaps: Record<string, string> }
type ClassifyResult = { ok: boolean; code?: string; detail?: string; plan?: Plan }
type DelegateResult = { ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }
type Row = {
  name: string
  familyId: string
  recordIndex: number
  mountCondition: string
  active: boolean
  capturePresent: boolean
  description: string | null
  parameters: Record<string, unknown> | null
  definitionIdentity: string | null
  classify: (args: unknown) => ClassifyResult
  delegate: (plan: Plan, ctx?: { exec?: unknown }) => Promise<DelegateResult>
}
type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: unknown; render: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type Registration = { name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }
type AssemblyValue = {
  ok: true
  familyId: string
  revision: number
  mountCondition: string
  providerId: string
  declaredProof: boolean
  placementNames: string[]
  definitions: Definition[]
  rows: Record<string, { status: string; reason: string; row: Row; definition?: Definition; captureDefinitionIdentity?: string }>
  declared: Array<{ name: string; recordIndex: number; familyId: string; status: string; reason: string; captureReportedIgnored: boolean }>
  rowOf: (name: string) => Row | undefined
  drain: () => { event: string; semantics: string }
  inFlight: () => { dispatches: number; refuses: number }
  familyRegistrations: () => Registration[]
}
type AssemblyResult = AssemblyValue | { ok: false; code: string; message: string }
type AdapterModule = {
  A5_B_SCHEDULE_FAMILY_ID: string
  A5_B_SCHEDULE_ADAPTER_REVISION: number
  A5_B_SCHEDULE_MOUNT_CONDITION: string
  A5_B_SCHEDULE_RECORD_SPECS: Record<string, { recordIndex: number; operation: string }>
  A5_B_SCHEDULE_TOOL_NAMES: string[]
  A5_B_SCHEDULE_SERVICE_METHODS: Record<string, { arity: number; signature: string }>
  A5_B_SCHEDULE_TOOL_ERROR_CODES: string[]
  A5_B_SCHEDULE_CODES: Record<string, string>
  A5_B_SCHEDULE_NAMED_GAPS: Record<string, string>
  scheduleView: (record: Record<string, unknown>, now: number) => Record<string, unknown>
  createScheduleAdapterAssembly: (input?: Record<string, unknown>) => AssemblyResult
}

const ADAPTER_PATH = new URL('../src/plugin/live/governed-families/schedule-adapters.mjs', import.meta.url)
const ADAPTER = (await import(ADAPTER_PATH.href)) as AdapterModule
const CODES = ADAPTER.A5_B_SCHEDULE_CODES

const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}

// ── the REAL published Host faces from the pristine baseline (fail closed) ─
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const TOOLS_LIB = HOST_PKG('core', 'tools', 'lib', 'index.js')
const SYS_PROMPT_LIB = HOST_PKG('core', 'system-prompt', 'lib', 'index.js')
const SCHEDULE_LIB = HOST_PKG('schedule', 'schedule', 'lib', 'index.js')
if (!existsSync(TOOLS_LIB)) throw new Error(`pristine tools lib absent (${TOOLS_LIB}); failing closed`)
if (!existsSync(SYS_PROMPT_LIB)) throw new Error(`pristine system-prompt lib absent (${SYS_PROMPT_LIB}); failing closed`)
if (!existsSync(SCHEDULE_LIB)) throw new Error(`pristine schedule lib absent (${SCHEDULE_LIB}); failing closed`)
// ONE consistent module set: every consumer must resolve the SAME cordis.
const CORDIS_PATHS = [TOOLS_LIB, SYS_PROMPT_LIB, SCHEDULE_LIB].map((lib) => createRequire(pathToFileURL(lib)).resolve('@deepseek-ai/cordis'))
if (new Set(CORDIS_PATHS).size !== 1) {
  throw new Error(`host module set splits across cordis copies (${CORDIS_PATHS.join(' != ')}); failing closed`)
}
type HostContext = {
  plugin: (plugin: unknown, config?: Record<string, unknown>) => Promise<void>
  tools: {
    register: (definition: Record<string, unknown>) => () => void
    get: (name: string) => Record<string, unknown> | undefined
  }
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as { default: unknown }
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_PATHS[0] as string).href)) as unknown as { Context: new () => HostContext }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
const HOST_SCHEDULE = (await import(pathToFileURL(SCHEDULE_LIB).href)) as unknown as {
  registerScheduleTools: (rootCtx: unknown, toolCtx: unknown, agent: unknown) => () => void
  ScheduleService?: { prototype: Record<string, (...args: unknown[]) => unknown> }
  default?: { prototype: Record<string, (...args: unknown[]) => unknown> }
}

/** The host's own minimal harness idiom (core/tools/tests/ptc.spec.ts):
 *  a real Context, SystemPrompt, then the ToolRuntime service. */
async function realRegistrationHarness(): Promise<HostContext> {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  return ctx
}

/** Capture the FOUR REAL published natives: the pristine schedule lib's own
 *  registerScheduleTools run against the REAL registration harness; the
 *  capture stand-in's schedule recorder must stay EMPTY for the whole spec
 *  (zero native entry — the governed rows dispatch to the PORT, never to
 *  the captured bodies). */
const NATIVE_SCHEDULE_CALLS: string[] = []
const nativeScheduleStandIn = {
  schedule: Object.fromEntries(['create', 'list', 'catalog', 'history', 'delete', 'update'].map((m) => [m, async () => {
    NATIVE_SCHEDULE_CALLS.push(m)
    throw new Error(`the captured native body must NEVER execute in this lane (method ${m})`)
  }])),
}
const nativeAgentStandIn = { id: 'native-owner-agent', session: { id: 'native-session', header: { id: 'native-header' } } }
async function captureRealNatives(): Promise<Record<string, Definition>> {
  const hostCtx = await realRegistrationHarness()
  const dispose = HOST_SCHEDULE.registerScheduleTools(nativeScheduleStandIn, hostCtx, nativeAgentStandIn)
  const defs: Record<string, Definition> = {}
  for (const name of ADAPTER.A5_B_SCHEDULE_TOOL_NAMES) {
    const def = hostCtx.tools.get(name)
    if (def === undefined) throw new Error(`the REAL host registered no tool '${name}' — baseline drift; failing closed`)
    defs[name] = def as unknown as Definition
  }
  dispose()
  return defs
}
const REAL_NATIVES = await captureRealNatives()

// ── lane-side doubles: port, admit, liveNative, placement feed ────────────
// ROOT ②: the owner law is the host's REFERENCE identity — the bound Agent
// OBJECT. The fixture's CAPTURED_AGENT is the double for the member's REAL
// live Agent (production: the object registerScheduleTools binds,
// tools.ts:405/:411); a look-alike object with the SAME id/header/session
// BYTES must be refused exactly like the host refuses it (438/457/481/509).
const LIVE_SESSION_ID = 'session-live-1'
const CAPTURED_AGENT: Record<string, unknown> = {
  id: 'agent-member-7',
  session: { id: LIVE_SESSION_ID, header: { id: 'session-header-42' } },
}
/** A DIFFERENT Agent object carrying the SAME id/header/session bytes — the
 *  ② case id-string pairing wrongly accepted: reference identity must refuse
 *  it exactly like the host (tools.ts:438/:457/:481/:509). */
const lookalikeAgent = (): Record<string, unknown> => ({
  id: CAPTURED_AGENT['id'],
  session: { id: LIVE_SESSION_ID, header: { id: (CAPTURED_AGENT['session'] as { header: { id: string } }).header.id } },
})
const liveExec = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  agent: CAPTURED_AGENT,
  callId: 'call-1',
  signal: new AbortController().signal,
  ...over,
})
// The REAL published error class (root ③): the L6 mirror and these legs run
// `instanceof` against the SAME class identity the host bodies throw
// (export src/index.ts:36). Not a double.
const SCHEDULE_INPUT_ERROR = (HOST_SCHEDULE as Record<string, unknown>)['ScheduleInputError']
if (typeof SCHEDULE_INPUT_ERROR !== 'function') {
  throw new Error('the published schedule lib exports no ScheduleInputError class — baseline drift; failing closed')
}
const HostInputError = SCHEDULE_INPUT_ERROR as unknown as new (code: string, message: string) => Error

type PortCall = { method: string; args: unknown[] }
type PortState = {
  records: Array<Record<string, unknown>>
  catalogEntries: Array<Record<string, unknown>>
  createRecord: Record<string, unknown> | null
  updateResult: Record<string, unknown> | null
  throwOn: { method: string; error: unknown } | null
}
function makePort() {
  const calls: PortCall[] = []
  const state: PortState = {
    records: [],
    catalogEntries: [],
    createRecord: null,
    updateResult: null,
    throwOn: null,
  }
  const rec = (method: string) => async (...args: unknown[]): Promise<unknown> => {
    calls.push({ method, args })
    if (state.throwOn !== null && state.throwOn.method === method) throw state.throwOn.error
    if (method === 'list') return state.records
    if (method === 'catalog') return state.catalogEntries
    if (method === 'create') return state.createRecord ?? state.records[0]
    if (method === 'delete') return { id: (args[0] as { id: string }).id, deleted: true }
    if (method === 'update') return state.updateResult
    throw new Error(`unexpected port method ${method}`)
  }
  const port: Record<string, unknown> = {
    create: rec('create'),
    list: rec('list'),
    catalog: rec('catalog'),
    history: rec('history'),
    delete: rec('delete'),
    update: rec('update'),
  }
  return { port, calls, state }
}

function captureFor(defs: Record<string, Definition>, names: string[] = ADAPTER.A5_B_SCHEDULE_TOOL_NAMES): Record<string, { native: Definition; definitionIdentity: string }> {
  return Object.fromEntries(names.map((n) => [n, { native: defs[n] as Definition, definitionIdentity: `capture-side-identity-${n}` }]))
}

type Fixture = {
  assembly: AssemblyValue
  port: Record<string, unknown>
  calls: PortCall[]
  state: PortState
  admitCalls: Array<Record<string, unknown>>
  natives: Record<string, Definition>
  setNative: (name: string, def: Definition) => void
}
async function mountFixture(overrides: Record<string, unknown> = {}): Promise<Fixture> {
  const { port, calls, state } = makePort()
  const admitCalls: Array<Record<string, unknown>> = []
  const natives = { ...REAL_NATIVES }
  const admit = overrides['admit'] ?? (async (ctx: Record<string, unknown>) => { admitCalls.push(ctx); return { ok: true } })
  const result = ADAPTER.createScheduleAdapterAssembly({
    declaredService: { present: true, facts: { mount: 'declared-schedule-service' } },
    captured: captureFor(natives),
    liveNative: (name: string) => natives[name],
    scheduleService: port,
    liveScheduleService: () => port,
    capturedAgent: CAPTURED_AGENT,
    ScheduleInputError: HostInputError,
    placementFeed: () => undefined,
    admit,
    ...overrides,
  })
  if (result.ok !== true) throw new Error(`fixture assembly refused: ${JSON.stringify(result)}`)
  return { assembly: result, port, calls, state, admitCalls, natives, setNative: (name, def) => { natives[name] = def } }
}

const GOOD_ARGS: Record<string, Record<string, unknown>> = {
  schedule_create: { prompt: 'stretch at the desk', title: 'stretch', after_seconds: 120 },
  schedule_delete: { id: 'task-1' },
  schedule_list: {},
  schedule_update: { id: 'task-1', every_seconds: 3600 },
}
const futureAt = (): string => new Date(Date.now() + 3_600_000).toISOString()
const pastAt = (): string => new Date(Date.now() - 30_000).toISOString()
const afterRecord = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'task-1', kind: 'after', title: 'stretch', prompt: 'stretch at the desk',
  scheduledAt: futureAt(), afterSeconds: 120, ...over,
})

/* ═════════════════ (a) frozen dispatch facts + REAL interface measurements */
describe('a5m2-schedule-adapters (a): frozen dispatch facts + the REAL published ScheduleService', () => {
  it('carries exactly the four B-SCHEDULE records 30/31/32/33, declared_mount, revision 2', () => {
    expect(ADAPTER.A5_B_SCHEDULE_FAMILY_ID).toBe('B-SCHEDULE')
    expect(ADAPTER.A5_B_SCHEDULE_MOUNT_CONDITION).toBe('declared_mount')
    expect(ADAPTER.A5_B_SCHEDULE_ADAPTER_REVISION).toBe(2)
    expect(ADAPTER.A5_B_SCHEDULE_TOOL_NAMES).toEqual(['schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update'])
    expect(Object.keys(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS)).toHaveLength(4)
    expect(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS.schedule_create).toEqual({ recordIndex: 30, operation: 'schedule-create' })
    expect(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS.schedule_delete).toEqual({ recordIndex: 31, operation: 'schedule-delete' })
    expect(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS.schedule_list).toEqual({ recordIndex: 32, operation: 'schedule-list' })
    expect(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS.schedule_update).toEqual({ recordIndex: 33, operation: 'schedule-update' })
    expect(Object.isFrozen(ADAPTER.A5_B_SCHEDULE_RECORD_SPECS)).toBe(true)
  })
  it("the port-law arity table EQUALS the REAL published ScheduleService prototype arity", () => {
    const Svc = HOST_SCHEDULE.ScheduleService ?? HOST_SCHEDULE.default
    if (Svc === undefined) throw new Error('the published schedule lib answers no ScheduleService class — baseline drift; failing closed')
    for (const [method, spec] of Object.entries(ADAPTER.A5_B_SCHEDULE_SERVICE_METHODS)) {
      const real = Svc.prototype[method]
      if (typeof real !== 'function') throw new Error(`ScheduleService.prototype.${method} must exist on the published class — baseline drift, failing closed`)
      expect(real.length, `${method}: published arity vs the adapter port table`).toBe(spec.arity)
    }
  })
  it('imports EXACTLY node:crypto — zero lane-private, zero host imports, no dynamic import (SOURCE TEXT)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'schedule-adapters.mjs'), 'utf8')
    const statics = [...source.matchAll(/^\s*import\s[^;\n]*from\s*'([^']+)'/gm)].map((m) => m[1] as string)
    expect(statics).toEqual(['node:crypto'])
    expect(/import\s*\(/.test(source)).toBe(false)
    for (const banned of ['pa-mount-registry', 'team-tool-plane', 'agent-bindings', 'tool-dispatch', '@deepseek-ai', './g1-', './g2-', './g3-', './g5-', './g6-', './todo', './write', './image']) {
      expect(statics.some((s) => s.includes(banned)), `banned import edge ${banned}`).toBe(false)
    }
  })
})

/* ═════════════════════════ (b) declared_mount honesty + assembly refusals */
describe('a5m2-schedule-adapters (b): declared_mount honesty and assembly gate', () => {
  it('no declared proof ⇒ four honest DECLARED rows: typed refusals, zero port, NO defs, NO registrations, captures REPORTED-ignored', async () => {
    const { port } = makePort()
    const result = ADAPTER.createScheduleAdapterAssembly({
      declaredService: undefined,
      captured: captureFor(REAL_NATIVES),
      liveNative: (name: string) => REAL_NATIVES[name],
      scheduleService: port,
      liveScheduleService: () => port,
      capturedAgent: CAPTURED_AGENT,
      ScheduleInputError: HostInputError,
      placementFeed: () => undefined,
      admit: async () => ({ ok: true }),
    })
    expect(result.ok).toBe(true)
    const assembly = result as AssemblyValue
    expect(assembly.definitions).toHaveLength(0)
    expect(assembly.placementNames).toEqual([])
    expect(assembly.familyRegistrations()).toEqual([])
    expect(assembly.declared).toHaveLength(4)
    expect(assembly.declared.every((d) => d.status === 'DECLARED-INACTIVE' && d.reason === 'declared-mount-absent' && d.captureReportedIgnored === true)).toBe(true)
    for (const name of ADAPTER.A5_B_SCHEDULE_TOOL_NAMES) {
      const row = assembly.rowOf(name) as Row
      expect(row.active).toBe(false)
      expect(row.description).toBeNull()
      const classified = row.classify(GOOD_ARGS[name] as Record<string, unknown>)
      expect(classified.ok).toBe(false)
      expect(classified.code).toBe(CODES.DECLARED_MOUNT_ABSENT)
      const delegated = await row.delegate({} as Plan)
      expect(delegated.code).toBe(CODES.DECLARED_MOUNT_ABSENT)
    }
    expect(NATIVE_SCHEDULE_CALLS).toEqual([])
  })
  it('declared proof but a missing capture ⇒ that ONE row CAPTURE_ABSENT, the other three ACTIVE', () => {
    const fixture = mountFixtureSync({ omitCapture: 'schedule_update' })
    expect(fixture.assembly.placementNames).toEqual(['schedule_create', 'schedule_delete', 'schedule_list'])
    const missing = fixture.assembly.rows.schedule_update as { status: string; reason: string }
    expect(missing.status).toBe('DECLARED-INACTIVE')
    expect(missing.reason).toBe('capture-absent')
    expect((fixture.assembly.rowOf('schedule_update') as Row).classify({ id: 'x' }).code).toBe(CODES.CAPTURE_ABSENT)
    expect(fixture.assembly.declared).toEqual([
      { name: 'schedule_update', recordIndex: 33, familyId: 'B-SCHEDULE', status: 'DECLARED-INACTIVE', reason: 'capture-absent', captureReportedIgnored: false },
    ])
  })
  it('assembly refusals: foreign capture, half-capture, capture without liveNative, partial port, unknown input key, missing owner/service-re-read/error-class', () => {
    const { port } = makePort()
    const base = {
      scheduleService: port,
      liveScheduleService: () => port,
      capturedAgent: CAPTURED_AGENT,
      ScheduleInputError: HostInputError,
      placementFeed: () => undefined,
      admit: async () => ({ ok: true }),
    }
    const foreign = ADAPTER.createScheduleAdapterAssembly({ ...base, captured: { todo_write: captureFor(REAL_NATIVES, ['schedule_create']).schedule_create } })
    expect(foreign).toMatchObject({ ok: false, code: CODES.NON_FAMILY_CAPTURE })
    const halfNative = { ...REAL_NATIVES.schedule_create } as Record<string, unknown>
    delete halfNative['output']
    const half = ADAPTER.createScheduleAdapterAssembly({ ...base, captured: { schedule_create: { native: halfNative as Definition, definitionIdentity: 'x' } }, liveNative: () => halfNative })
    expect(half).toMatchObject({ ok: false, code: CODES.CAPTURE_INCOMPLETE })
    const noLive = ADAPTER.createScheduleAdapterAssembly({ ...base, captured: captureFor(REAL_NATIVES, ['schedule_list']) })
    expect(noLive).toMatchObject({ ok: false, code: CODES.LIVE_NATIVE_ABSENT })
    const partialPort = { ...port }
    delete partialPort['catalog']
    const partial = ADAPTER.createScheduleAdapterAssembly({ ...base, scheduleService: partialPort, liveScheduleService: () => partialPort, captured: captureFor(REAL_NATIVES, ['schedule_list']), liveNative: (n: string) => REAL_NATIVES[n] as Definition })
    expect(partial).toMatchObject({ ok: false, code: CODES.PORT_METHOD_ABSENT })
    const unknownKey = ADAPTER.createScheduleAdapterAssembly({ ...base, bogus: 1 })
    expect(unknownKey).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    const noAdmit = ADAPTER.createScheduleAdapterAssembly({ ...base, admit: undefined, captured: captureFor(REAL_NATIVES, ['schedule_list']), liveNative: (n: string) => REAL_NATIVES[n] as Definition })
    expect(noAdmit).toMatchObject({ ok: false, code: CODES.ADMISSION_ABSENT })
    // ROOT ②③ REQUIRED inputs — an owner Agent object, the live service
    // re-read, and the published error class are non-negotiable.
    const noOwner = ADAPTER.createScheduleAdapterAssembly({ ...base, capturedAgent: undefined })
    expect(noOwner).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    const badOwner = ADAPTER.createScheduleAdapterAssembly({ ...base, capturedAgent: { memberAgentId: 'agent-member-7' } })
    expect(badOwner).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    const noServiceReRead = ADAPTER.createScheduleAdapterAssembly({ ...base, liveScheduleService: undefined })
    expect(noServiceReRead).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    const noErrorClass = ADAPTER.createScheduleAdapterAssembly({ ...base, ScheduleInputError: undefined })
    expect(noErrorClass).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    // the live re-read must answer the bound port, or the mount is split.
    const splitMount = ADAPTER.createScheduleAdapterAssembly({ ...base, liveScheduleService: () => ({ ...port }) })
    expect(splitMount).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
  })
})

// sync helper for the capture-absent variant (mountFixture is async only for
// uniformity; the factory itself is synchronous)
function mountFixtureSync(over: { omitCapture?: string } = {}): Fixture {
  const { port, calls, state } = makePort()
  const natives = { ...REAL_NATIVES }
  const names = ADAPTER.A5_B_SCHEDULE_TOOL_NAMES.filter((n) => n !== over.omitCapture)
  const result = ADAPTER.createScheduleAdapterAssembly({
    declaredService: { present: true },
    captured: captureFor(natives, names),
    liveNative: (name: string) => natives[name] as Definition | undefined,
    scheduleService: port,
    liveScheduleService: () => port,
    capturedAgent: CAPTURED_AGENT,
    ScheduleInputError: HostInputError,
    placementFeed: () => undefined,
    admit: async () => ({ ok: true }),
  })
  if (result.ok !== true) throw new Error(`sync fixture refused: ${JSON.stringify(result)}`)
  return { assembly: result, port, calls, state, admitCalls: [], natives, setNative: (name, def) => { natives[name] = def } }
}

/* ═════════════════ (c) the REAL captured definition travels COMPLETE + the
                      REAL registration minimum entry (RED-FIRST proof leg) */
describe('a5m2-schedule-adapters (c): REAL natives captured through the REAL registry; only execute is replaced', () => {
  it('the four natives are the REAL published defineTool products (name/description/parameters/output/execute present)', () => {
    for (const name of ADAPTER.A5_B_SCHEDULE_TOOL_NAMES) {
      const def = REAL_NATIVES[name] as Definition
      expect(def.name).toBe(name)
      expect(typeof def.description).toBe('string')
      expect(def.description.length).toBeGreaterThan(20)
      expect(typeof def.parameters).toBe('object')
      expect(typeof def.output?.schema).not.toBe('undefined')
      expect(typeof def.output?.render).toBe('function')
      expect(typeof def.execute).toBe('function')
    }
    // the published CREATE description bytes are distinctive — never a fixture echo
    expect((REAL_NATIVES.schedule_create as Definition).description).toContain('after_seconds, at, every_seconds, daily, weekly, or cron')
  })
  it('placed definitions carry EVERY captured face VERBATIM BY REFERENCE — ONLY execute is replaced', async () => {
    const fixture = await mountFixture()
    expect(fixture.assembly.definitions).toHaveLength(4)
    for (const placed of fixture.assembly.definitions) {
      const captured = REAL_NATIVES[placed.name] as Definition
      for (const face of Object.keys(captured)) {
        if (face === 'execute') {
          expect(placed.execute, `${placed.name}: execute must be REPLACED, never the captured body`).not.toBe(captured.execute)
          expect(typeof placed.execute).toBe('function')
          continue
        }
        expect(placed[face], `${placed.name}: face '${face}' must ride by reference`).toBe(captured[face])
      }
      // no face invented beyond the capture
      expect(Object.keys(placed).sort()).toEqual(Object.keys(captured).sort())
    }
  })
  it('REAL registration entry (真实 register 最低入口核): the real ToolRuntime ACCEPTS the placed defs and stores them verbatim, REFUSES the hand-fabricated half-shape and the duplicate', async () => {
    const fixture = await mountFixture()
    const ctx = await realRegistrationHarness()
    for (const placed of fixture.assembly.definitions) {
      expect(() => ctx.tools.register(placed as unknown as Record<string, unknown>)).not.toThrow()
      const stored = ctx.tools.get(placed.name) as Record<string, unknown>
      expect(stored).toBeDefined()
      expect((stored as unknown as Definition).output).toBe(placed.output) // verbatim face, same reference
      expect((stored as unknown as Definition).parameters).toBe(placed.parameters)
    }
    expect(() => ctx.tools.register({
      name: 'schedule_half_fabricated',
      description: 'hand-fabricated pre-8b4 half-shape — no output face',
      parameters: { id: { type: 'string' } },
      execute: async () => ({}),
    })).toThrow()
    expect(() => ctx.tools.register(fixture.assembly.definitions[0] as unknown as Record<string, unknown>)).toThrow()
    expect(NATIVE_SCHEDULE_CALLS).toEqual([])
  })
})

/* ═════════════════════════ (d) classify mirrors the captured body's OWN law */
describe('a5m2-schedule-adapters (d): the tool-parameter law mirror runs at classify, as VALUES, with zero port entry', () => {
  it('schedule_create: selector count, unknown keys, prompt/title rules, interval floors — each a VALUE with the captured bytes', async () => {
    const fixture = await mountFixture()
    const row = fixture.assembly.rowOf('schedule_create') as Row
    const lawOf = (args: Record<string, unknown>): { code?: string; message?: string; plan?: Plan } => {
      const result = row.classify(args)
      if (result.ok === true) return { plan: result.plan }
      return {}
    }
    const expectToolError = (args: Record<string, unknown>, code: string, message?: string): void => {
      const result = row.classify(args)
      expect(result.ok, `expected a plan carrying toolError ${code}`).toBe(true)
      expect((result.plan as Plan).toolError?.code).toBe(code)
      if (message !== undefined) expect((result.plan as Plan).toolError?.message).toBe(message)
    }
    expectToolError({ prompt: 'p', title: 't' }, 'invalid_selector', 'schedule_create accepts exactly one of after_seconds, at, every_seconds, daily, weekly, or cron.')
    expectToolError({ prompt: 'p', title: 't', after_seconds: 60, every_seconds: 120 }, 'invalid_selector')
    expectToolError({ prompt: 'p', title: 't', after_seconds: 60, bogus: 1 }, 'invalid_selector')
    expectToolError({ prompt: '   ', title: 't', after_seconds: 60 }, 'invalid_prompt', 'prompt must be non-empty after trimming.')
    expectToolError({ prompt: 'p', title: '  ', after_seconds: 60 }, 'invalid_prompt', 'title is required and must be non-empty after trimming.')
    expectToolError({ prompt: 'p', title: 'x'.repeat(121), after_seconds: 60 }, 'invalid_prompt', 'title must be at most 120 characters.')
    expectToolError({ prompt: 'p', title: 't', after_seconds: 0 }, 'invalid_rule', 'after_seconds must be a positive safe integer.')
    expectToolError({ prompt: 'p', title: 't', after_seconds: 2.5 }, 'invalid_rule')
    expectToolError({ prompt: 'p', title: 't', every_seconds: 59 }, 'frequency_too_high', 'every_seconds must be at least 60.')
    expectToolError({ prompt: 'p', title: 't', every_seconds: 1.5 }, 'invalid_rule', 'every_seconds must be a safe integer.')
    // clean legs: after_seconds AND the cron selector classify into service plans
    for (const args of [GOOD_ARGS.schedule_create, { prompt: 'p', title: 't', cron: { expression: '*/15 9-17 * * 1-5', time_zone: 'Asia/Shanghai' } }]) {
      const classified = row.classify(args)
      expect(classified.ok).toBe(true)
      expect((classified.plan as Plan).toolError).toBeUndefined()
      expect((classified.plan as Plan).operation).toBe('schedule-create')
    }
    expect(lawOf({ prompt: 'p', title: 't' })).not.toHaveProperty('code')
    expect(fixture.calls).toEqual([]) // classify touched the port ZERO times
  })
  it('every plan is frozen, snapshot-equal, fingerprint-stable, and carries the NAMED GAPS verbatim', async () => {
    const fixture = await mountFixture()
    const row = fixture.assembly.rowOf('schedule_create') as Row
    const first = row.classify(GOOD_ARGS.schedule_create)
    const second = row.classify(GOOD_ARGS.schedule_create)
    const plan = first.plan as Plan
    expect(Object.isFrozen(plan)).toBe(true)
    expect(plan.args).toEqual(GOOD_ARGS.schedule_create)
    expect(plan.parametersFingerprint).toBe((second.plan as Plan).parametersFingerprint)
    expect(plan.parametersFingerprint.startsWith('sha256:')).toBe(true)
    expect(plan.namedGaps).toEqual(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS)
    // REV-2 GAP SET (root ①③④): the trigger gap names the EXACT missing
    // public interface; the plan-once boundary is stated; the retired duck-
    // class gap (instanceof is now real) and old PER_TRIGGER wording are gone.
    expect(Object.keys(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS).sort()).toEqual(['PERSISTENCE_ORDER', 'PLAN_ONCE_MEMO', 'TIMER_ARM', 'TRIGGER_GOVERNANCE'])
    expect(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS.TRIGGER_GOVERNANCE).toContain('EXACT MISSING PUBLIC INTERFACE')
    expect(ADAPTER.A5_B_SCHEDULE_NAMED_GAPS.PLAN_ONCE_MEMO).toContain('CENTER PA wiring obligation')
  })
  it('every plan carries the contract §B-SCHEDULE TARGET (root ①): owner+taskId+revision+action, timer delta, destination+wake', async () => {
    const fixture = await mountFixture()
    const create = fixture.assembly.rowOf('schedule_create') as Row
    const createPlan = (create.classify(GOOD_ARGS.schedule_create) as { plan: Plan }).plan
    expect(Object.isFrozen(createPlan.target)).toBe(true)
    expect(createPlan.target.owner).toEqual({ kind: 'bound-live-agent-reference', sessionId: LIVE_SESSION_ID })
    expect(createPlan.target.action).toBe('schedule-create')
    expect(createPlan.target.taskId).toBeNull() // the service mints the id at commit
    expect(createPlan.target.revision).toContain('service-mints-id-on-commit')
    expect(createPlan.target.timer.effect).toContain('SERVICE-side')
    expect(createPlan.target.timer.effect).toContain('arm')
    expect(createPlan.target.destination.sessionId).toBe(LIVE_SESSION_ID) // NO cross-session target
    expect(createPlan.target.destination.wake).toContain('NOT licensed by this invocation')
    expect(createPlan.target.contract).toContain('B-SCHEDULE')
    const del = fixture.assembly.rowOf('schedule_delete') as Row
    const delPlan = (del.classify(GOOD_ARGS.schedule_delete) as { plan: Plan }).plan
    expect(delPlan.target.taskId).toBe('task-1')
    expect(delPlan.target.action).toBe('schedule-delete')
    expect(delPlan.target.timer.effect).toContain('disarm-on-durable-record-state')
    const upd = fixture.assembly.rowOf('schedule_update') as Row
    const updPlan = (upd.classify(GOOD_ARGS.schedule_update) as { plan: Plan }).plan
    expect(updPlan.target.taskId).toBe('task-1')
    expect(updPlan.target.revision).toContain('cas-expected-record')
    expect(updPlan.target.timer.effect).toContain('re-align')
    // a plan carrying a TOOL ERROR has no valid taskId (the id law failed)
    const badDel = (del.classify({ id: ' bad' }) as { plan: Plan }).plan
    expect(badDel.target.taskId).toBeNull()
  })
  it('schedule_delete/update/list mirror their own bodies: id law, selector count, empty-parameter face', async () => {
    const fixture = await mountFixture()
    const del = fixture.assembly.rowOf('schedule_delete') as Row
    for (const badId of ['', ' x', 'x ']) {
      const result = del.classify({ id: badId })
      expect((result.plan as Plan).toolError?.code).toBe('invalid_rule')
      expect((result.plan as Plan).toolError?.message).toBe('schedule_delete id must be non-empty without surrounding whitespace.')
    }
    expect((del.classify({ id: 'task-1' }).plan as Plan).toolError).toBeUndefined()
    const upd = fixture.assembly.rowOf('schedule_update') as Row
    expect((upd.classify({ id: 'task-1' }).plan as Plan).toolError?.code).toBe('invalid_selector')
    expect((upd.classify({ id: 'task-1', at: '2030-01-01T00:00:00Z', cron: { expression: '* * * * *', time_zone: 'UTC' } }).plan as Plan).toolError?.code).toBe('invalid_selector')
    expect((upd.classify({ id: 'task-1', title: '  ' }).plan as Plan).toolError?.code).toBe('invalid_prompt')
    expect((upd.classify({ id: 'task-1', title: 'renamed' }).plan as Plan).toolError).toBeUndefined()
    const list = fixture.assembly.rowOf('schedule_list') as Row
    expect((list.classify({}).plan as Plan).toolError).toBeUndefined()
    expect((list.classify({ id: 'sneak' }).plan as Plan).toolError?.code).toBe('invalid_selector')
    expect(fixture.calls).toEqual([])
  })
})

/* ═════════════════════════════ (e) dispatch answers the REAL contract */
describe('a5m2-schedule-adapters (e): exact port tuples, published projection, CAS two-step, error-VALUE mirror, plan-once', () => {
  it('schedule_list: list({sessionId: LIVE session id}) once; the published scheduleView projection rides', async () => {
    const fixture = await mountFixture()
    fixture.state.records = [afterRecord(), afterRecord({ id: 'task-0', scheduledAt: pastAt() })]
    const row = fixture.assembly.rowOf('schedule_list') as Row
    const classified = row.classify({}) as { plan: Plan }
    const settled = await row.delegate(classified.plan, { exec: liveExec() })
    expect(settled.ok).toBe(true)
    expect(settled.settled).toBe('service')
    expect(fixture.calls).toEqual([{ method: 'list', args: [{ sessionId: LIVE_SESSION_ID }] }])
    const value = settled.value as Array<Record<string, unknown>>
    expect(value.map((v) => v.state)).toEqual(['scheduled', 'overdue'])
    expect(value.every((v) => v.deliveryMode === 'host')).toBe(true)
    expect(Object.isFrozen(value)).toBe(true)
    expect(NATIVE_SCHEDULE_CALLS).toEqual([])
  })
  it('schedule_create: create(liveSessionId, classified args, LIVE signal by reference); the committed record projects', async () => {
    const fixture = await mountFixture()
    fixture.state.createRecord = afterRecord({ id: 'task-new' })
    const row = fixture.assembly.rowOf('schedule_create') as Row
    const classified = row.classify(GOOD_ARGS.schedule_create) as { plan: Plan }
    const exec = liveExec()
    const settled = await row.delegate(classified.plan, { exec })
    expect(settled.ok).toBe(true)
    expect(fixture.calls).toHaveLength(1)
    const call = fixture.calls[0] as PortCall
    expect(call.method).toBe('create')
    expect(call.args[0]).toBe(LIVE_SESSION_ID)
    expect(call.args[1]).toEqual(GOOD_ARGS.schedule_create)
    expect(call.args[2]).toBe(exec['signal']) // by reference — never a stand-in
    const value = settled.value as Record<string, unknown>
    expect(value.id).toBe('task-new')
    expect(value.state).toBe('scheduled')
    expect(value.deliveryMode).toBe('host')
  })
  it('schedule_delete: delete({sessionId,id}, signal); the published ScheduleDeleteResult rides verbatim', async () => {
    const fixture = await mountFixture()
    const row = fixture.assembly.rowOf('schedule_delete') as Row
    const exec = liveExec()
    const settled = await row.delegate((row.classify(GOOD_ARGS.schedule_delete) as { plan: Plan }).plan, { exec })
    expect(fixture.calls).toEqual([{ method: 'delete', args: [{ sessionId: LIVE_SESSION_ID, id: 'task-1' }, exec['signal']] }])
    expect(settled.value).toEqual({ id: 'task-1', deleted: true })
  })
  it('schedule_update CAS: list→find→update with the port-owned expected record BY REFERENCE; change/title/prompt mapped; record projects', async () => {
    const fixture = await mountFixture()
    const expected = afterRecord()
    fixture.state.records = [expected]
    fixture.state.updateResult = { id: 'task-1', updated: true, record: afterRecord({ scheduledAt: futureAt() }) }
    const row = fixture.assembly.rowOf('schedule_update') as Row
    const exec = liveExec()
    const settled = await row.delegate((row.classify(GOOD_ARGS.schedule_update) as { plan: Plan }).plan, { exec })
    expect(settled.ok).toBe(true)
    expect((fixture.calls[0] as PortCall).method).toBe('list')
    const updateCall = fixture.calls[1] as PortCall
    expect(updateCall.method).toBe('update')
    const request = updateCall.args[0] as Record<string, unknown>
    expect(request.sessionId).toBe(LIVE_SESSION_ID)
    expect(request.id).toBe('task-1')
    expect(request.expected).toBe(expected) // by reference — the record THIS dispatch read
    expect(request.change).toEqual({ kind: 'every', every_seconds: 3600 })
    expect(updateCall.args[1]).toBe(exec['signal'])
    expect((settled.value as Record<string, unknown>).state).toBe('scheduled')
    // the row never froze the port-owned record
    expect(Object.isFrozen(expected)).toBe(false)
  })
  it('schedule_update not-found: zero update entry; catalog decides schedule_ended vs schedule_not_found', async () => {
    const endedMount = await mountFixture()
    endedMount.state.records = []
    endedMount.state.catalogEntries = [{ sessionId: LIVE_SESSION_ID, id: 'task-gone' }]
    const row1 = endedMount.assembly.rowOf('schedule_update') as Row
    const r1 = await row1.delegate((row1.classify({ id: 'task-gone', title: 'x' }) as { plan: Plan }).plan, { exec: liveExec() })
    expect(r1.value).toEqual({ id: 'task-gone', updated: false, code: 'schedule_ended' })
    expect(endedMount.calls.map((c) => c.method)).toEqual(['list', 'catalog'])

    const goneMount = await mountFixture()
    goneMount.state.records = []
    goneMount.state.catalogEntries = [{ sessionId: 'other-session', id: 'task-gone' }]
    const row2 = goneMount.assembly.rowOf('schedule_update') as Row
    const r2 = await row2.delegate((row2.classify({ id: 'task-gone', title: 'x' }) as { plan: Plan }).plan, { exec: liveExec() })
    expect(r2.value).toEqual({ id: 'task-gone', updated: false, code: 'schedule_not_found' })
    expect(goneMount.calls.map((c) => c.method)).toEqual(['list', 'catalog'])
  })
  it('L6 error-VALUE mirror (root ③): instanceof the REAL published ScheduleInputError maps {code,message}; a DUCK carrying a closed code maps internal_error WITHOUT leaking its message; NEVER a re-raise', async () => {
    const fixture = await mountFixture()
    const row = fixture.assembly.rowOf('schedule_create') as Row
    fixture.state.throwOn = { method: 'create', error: new HostInputError('not_future', 'target must be strictly future') }
    const first = await row.delegate((row.classify(GOOD_ARGS.schedule_create) as { plan: Plan }).plan, { exec: liveExec() })
    expect(first).toMatchObject({ ok: true, settled: 'service-error-value', value: { code: 'not_future', message: 'target must be strictly future' } })
    // A FOREIGN error wearing a closed code is NOT a ScheduleInputError: the
    // host maps it to internal_error, and its internal message never reaches
    // the model (the retired duck path would have leaked these bytes).
    fixture.state.throwOn = { method: 'create', error: { code: 'not_future', message: 'INTERNAL-STORAGE-DETAIL /absolute/path/secret' } }
    const duck = await row.delegate((row.classify(GOOD_ARGS.schedule_create) as { plan: Plan }).plan, { exec: liveExec() })
    expect(duck).toMatchObject({ ok: true, settled: 'service-error-value', value: { code: 'internal_error', message: 'The schedule operation failed.' } })
    expect(JSON.stringify(duck)).not.toContain('INTERNAL-STORAGE-DETAIL')
    fixture.state.throwOn = { method: 'create', error: new Error('storage exploded') }
    const second = await row.delegate((row.classify(GOOD_ARGS.schedule_create) as { plan: Plan }).plan, { exec: liveExec() })
    expect(second).toMatchObject({ ok: true, settled: 'service-error-value', value: { code: 'internal_error', message: 'The schedule operation failed.' } })
  })
  it('plan MEMO (L8/④): consumed/foreign/stale plans refuse with zero port entry; the COPY-REUSE boundary is pinned honestly (consumedProof is the center PA edge)', async () => {
    const fixture = await mountFixture()
    fixture.state.records = [afterRecord()]
    const listRow = fixture.assembly.rowOf('schedule_list') as Row
    const plan = (listRow.classify({}) as { plan: Plan }).plan
    const first = await listRow.delegate(plan, { exec: liveExec() })
    expect(first.ok).toBe(true)
    const callsAfterFirst = fixture.calls.length
    const replay = await listRow.delegate(plan, { exec: liveExec() })
    expect(replay.code).toBe(CODES.ALREADY_DISPATCHED)
    expect(replay.detail).toContain('INTERNAL MEMO')
    const deleteRow = fixture.assembly.rowOf('schedule_delete') as Row
    const foreign = await deleteRow.delegate(plan, { exec: liveExec() })
    expect(foreign.code).toBe(CODES.NOT_OWN_PLAN)
    const tampered = { ...plan, parametersFingerprint: 'sha256:tampered' } as Plan
    const stale = await listRow.delegate(tampered, { exec: liveExec() })
    expect(stale.code).toBe(CODES.PLAN_STALE)
    // PINNED BOUNDARY (root ④): the memo covers the plan OBJECT. A caller
    // that copies the fields re-dispatches (full law re-run) — the row
    // claims NO once-closure; the real consumedProof is the plane's
    // consume-for-execution edge (center PA wiring). This assertion exists
    // so the boundary can never silently drift into a false "once" claim.
    const copied = { ...plan } as Plan
    const again = await listRow.delegate(copied, { exec: liveExec() })
    expect(again.ok).toBe(true)
    expect(fixture.calls).toHaveLength(callsAfterFirst + 1)
  })
})

/* ══════════════════════════════════ (f) governance edges + host ORDER */
describe('a5m2-schedule-adapters (f): bound-owner identity, host check order, drift + live re-read, drain, the admit seat', () => {
  const dispatch = async (fixture: Fixture, name: string, args: Record<string, unknown>, exec: Record<string, unknown>): Promise<DelegateResult> => {
    const row = fixture.assembly.rowOf(name) as Row
    const classified = row.classify(args)
    if (classified.ok !== true) throw new Error(`fixture classify refused: ${JSON.stringify(classified)}`)
    return row.delegate(classified.plan as Plan, { exec })
  }
  it('a caller that is not the BOUND owner Agent OBJECT answers the host identity-refusal VALUE for all four tools — zero port entry (root ②: REFERENCE law, not id strings)', async () => {
    const fixture = await mountFixture()
    for (const name of ADAPTER.A5_B_SCHEDULE_TOOL_NAMES) {
      const missing = await dispatch(fixture, name, GOOD_ARGS[name] as Record<string, unknown>, { callId: 'c' })
      expect(missing, name).toMatchObject({ ok: true, settled: 'tool-law-value', value: { code: 'internal_error' } })
      // THE ② CASE: a DIFFERENT Agent object carrying the SAME id/header/
      // session bytes — an id-string pairing would accept it; the host's
      // reference law (exec.agent !== agent, tools.ts:438/:457/:481/:509)
      // refuses it, and so does this row.
      const lookalike = liveExec({ agent: lookalikeAgent() })
      expect(await dispatch(fixture, name, GOOD_ARGS[name] as Record<string, unknown>, lookalike), name).toMatchObject({ value: { code: 'internal_error' } })
      const impostor = liveExec({ agent: { id: 'agent-impostor', session: { id: LIVE_SESSION_ID, header: { id: 'session-header-42' } } } })
      expect(await dispatch(fixture, name, GOOD_ARGS[name] as Record<string, unknown>, impostor), name).toMatchObject({ value: { code: 'internal_error' } })
    }
    expect(fixture.calls).toEqual([])
    // control: the bound object's OWN reference passes the same edge.
    fixture.state.records = [afterRecord()]
    const listRow = fixture.assembly.rowOf('schedule_list') as Row
    expect((await listRow.delegate((listRow.classify({}) as { plan: Plan }).plan, { exec: liveExec() })).ok).toBe(true)
  })
  it('HOST CHECK ORDER: delete answers the invalid_rule VALUE even with a wrong caller (id law first); create answers internal_error first — the values cannot swap', async () => {
    const fixture = await mountFixture()
    // THE look-alike caller (same bytes, other object): even stronger than a
    // named impostor — delete's id law still runs FIRST (tools.ts:476-479).
    const wrongAgent = { callId: 'c', agent: lookalikeAgent(), signal: new AbortController().signal }
    const del = await dispatch(fixture, 'schedule_delete', { id: ' bad' }, wrongAgent)
    expect(del).toMatchObject({ value: { code: 'invalid_rule', message: 'schedule_delete id must be non-empty without surrounding whitespace.' } })
    const create = await dispatch(fixture, 'schedule_create', { prompt: '  ', title: 't', after_seconds: 60 }, wrongAgent)
    expect(create).toMatchObject({ value: { code: 'internal_error' } })
  })
  it('a PRE-ABORTED signal refuses with the internal_error VALUE and zero port entry (host aborted→internal_error)', async () => {
    const fixture = await mountFixture()
    fixture.state.records = [afterRecord()]
    const controller = new AbortController()
    controller.abort()
    const exec = liveExec({ signal: controller.signal })
    for (const name of ['schedule_create', 'schedule_list', 'schedule_update', 'schedule_delete']) {
      const settled = await dispatch(fixture, name, GOOD_ARGS[name] as Record<string, unknown>, exec)
      expect(settled, name).toMatchObject({ ok: true, settled: 'tool-law-value', value: { code: 'internal_error' } })
    }
    expect(fixture.calls).toEqual([])
  })
  it('L7 drift refusals: liveNative answering a different object refuses DEFINITION_DRIFT; a rebound port method refuses PORT_DRIFT; a service OBJECT replaced after mount refuses PORT_DRIFT — all zero port', async () => {
    const fixture = await mountFixture()
    fixture.setNative('schedule_list', { ...REAL_NATIVES.schedule_list } as Definition)
    const row = fixture.assembly.rowOf('schedule_list') as Row
    const drifted = await row.delegate((row.classify({}) as { plan: Plan }).plan, { exec: liveExec() })
    expect(drifted.code).toBe(CODES.DEFINITION_DRIFT)
    fixture.setNative('schedule_list', REAL_NATIVES.schedule_list as Definition)
    fixture.port['list'] = async () => [] // rebound underneath the frozen bind
    const rebound = await row.delegate((row.classify({}) as { plan: Plan }).plan, { exec: liveExec() })
    expect(rebound.code).toBe(CODES.PORT_DRIFT)
    expect(fixture.calls).toEqual([])
  })
  it('live ctx.schedule re-read (root ②): a replaced service OBJECT refuses at entry with zero port; a replacement surfacing DURING the update list await re-verifies and leaves ZERO update entry', async () => {
    // Built directly (not via mountFixture) so the liveScheduleService feed
    // closes over the SAME port the assembly binds — the split-mount guard at
    // assembly time must pass, then the flip happens only at dispatch.
    const { port, calls, state } = makePort()
    let flip = false
    const result = ADAPTER.createScheduleAdapterAssembly({
      declaredService: { present: true },
      captured: captureFor(REAL_NATIVES),
      liveNative: (name: string) => REAL_NATIVES[name] as Definition,
      scheduleService: port,
      liveScheduleService: () => (flip ? { ...port } : port), // a NEW object when flipped
      capturedAgent: CAPTURED_AGENT,
      ScheduleInputError: HostInputError,
      placementFeed: () => undefined,
      admit: async () => ({ ok: true }),
    })
    if (result.ok !== true) throw new Error(`re-read fixture refused: ${JSON.stringify(result)}`)
    const assembly = result
    const listRow = assembly.rowOf('schedule_list') as Row
    flip = true
    const atEntry = await listRow.delegate((listRow.classify({}) as { plan: Plan }).plan, { exec: liveExec() })
    expect(atEntry.code).toBe(CODES.PORT_DRIFT)
    expect(calls).toEqual([])
    flip = false
    // UPDATE POST-AWAIT RE-VERIFY: flip the live read WHILE the list await is
    // in flight (a getter fires exactly when the port reads state.records);
    // the re-verify after the await must refuse before port.update — zero
    // update entry, the drift never commits.
    state.updateResult = { id: 'task-1', updated: true, record: afterRecord({ scheduledAt: futureAt() }) }
    Object.defineProperty(state, 'records', { configurable: true, get: () => { flip = true; return [afterRecord()] } })
    const updRow = assembly.rowOf('schedule_update') as Row
    const settled = await updRow.delegate((updRow.classify(GOOD_ARGS.schedule_update) as { plan: Plan }).plan, { exec: liveExec() })
    expect(settled.code).toBe(CODES.PORT_DRIFT)
    expect(settled.detail).toContain('post-await re-verify')
    expect(calls.map((c) => c.method)).toEqual(['list']) // list ran; update NEVER entered
  })
  it('L9 drain = new-call prohibition: later classify refuses DRAINING with zero port entry; committed writes stay as they are', async () => {
    const fixture = await mountFixture()
    fixture.state.records = [afterRecord()]
    const row = fixture.assembly.rowOf('schedule_list') as Row
    const before = await row.delegate((row.classify({}) as { plan: Plan }).plan, { exec: liveExec() })
    expect(before.ok).toBe(true)
    const committed = fixture.calls.length
    const drained = fixture.assembly.drain()
    expect(drained.event).toBe('b-schedule:drain')
    expect(row.classify({}).code).toBe(CODES.DRAINING)
    expect(fixture.calls).toHaveLength(committed)
  })
  it('L10 the placed execute runs classify → admit → dispatch: an admit refusal THROWS the refusing side\'s bytes with zero port entry; an admit pass returns the service value', async () => {
    const fixture = await mountFixture()
    fixture.state.createRecord = afterRecord({ id: 'task-created' })
    const def = fixture.assembly.definitions.find((d) => d.name === 'schedule_create') as Definition
    await expect(def.execute(GOOD_ARGS.schedule_create, liveExec())).resolves.toMatchObject({ id: 'task-created', deliveryMode: 'host' })
    expect(fixture.admitCalls[0]).toMatchObject({ name: 'schedule_create', recordIndex: 30, familyId: 'B-SCHEDULE' })
    const deniedMount = await mountFixture({ admit: async () => ({ ok: false, code: 'PA_DENIED', detail: 'the plane refused' }) })
    deniedMount.state.createRecord = afterRecord()
    const deniedDef = deniedMount.assembly.definitions.find((d) => d.name === 'schedule_create') as Definition
    await expect(deniedDef.execute(GOOD_ARGS.schedule_create, liveExec())).rejects.toThrow(/PA_DENIED/)
    expect(deniedMount.calls).toEqual([])
    expect(NATIVE_SCHEDULE_CALLS).toEqual([])
  })
})

/* ═══════════════════════════════════ (g) registration face (UNWIRED) */
describe('a5m2-schedule-adapters (g): placement-keyed registrations, production shape law, never a guessed key', () => {
  it('keys are the REAL definitionIdentityOf of the PLACED defs (never the capture string); entries pass the PRODUCTION registry shape law', async () => {
    const feed = (name: string) => {
      const placed = fedMount.assembly.definitions.find((d) => d.name === name) as Definition
      return { definitionIdentity: definitionIdentityOf(placed as unknown as Record<string, unknown>) as string }
    }
    const fedMount = await mountFixture({ placementFeed: feed })
    const registrations = fedMount.assembly.familyRegistrations()
    expect(registrations.map((r) => r.name)).toEqual(['schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update'])
    for (const registration of registrations) {
      const placed = fedMount.assembly.definitions.find((d) => d.name === registration.name) as Definition
      expect(registration.definitionIdentity).toBe(definitionIdentityOf(placed as unknown as Record<string, unknown>))
      expect(registration.definitionIdentity).not.toBe(`capture-side-identity-${registration.name}`)
      expect(registration.entry).toEqual({ familyId: 'B-SCHEDULE', adapterRevision: 2, providerIdentity: 'b-schedule' })
      expect(() => REGISTRY.registerA5GovernedFamily(registration.definitionIdentity, registration.entry)).not.toThrow()
      expect(REGISTRY.a5GovernedFamilyFor(registration.definitionIdentity)).toEqual(registration.entry)
      expect(() => REGISTRY.registerA5GovernedFamily(registration.definitionIdentity, registration.entry)).not.toThrow() // idempotent
    }
  })
  it('a silent feed THROWS PLACEMENT_KEY_ABSENT; a moved identity THROWS PLACEMENT_KEY_MOVED; declared mounts register nothing', async () => {
    const silent = await mountFixture() // feed always undefined
    expect(() => silent.assembly.familyRegistrations()).toThrow(/P_B_SCHEDULE_PLACEMENT_KEY_ABSENT/)
    let flips = 0
    const moved = await mountFixture({
      placementFeed: (name: string) => {
        flips += 1
        const placed = moved.assembly.definitions.find((d) => d.name === name) as Definition
        return { definitionIdentity: `${definitionIdentityOf(placed as unknown as Record<string, unknown>)}${flips > 4 ? '-moved' : ''}` as string }
      },
    })
    expect(() => moved.assembly.familyRegistrations()).not.toThrow()
    expect(() => moved.assembly.familyRegistrations()).toThrow(/P_B_SCHEDULE_PLACEMENT_KEY_MOVED/)
    const declaredPort = makePort().port
    const declaredMount = ADAPTER.createScheduleAdapterAssembly({
      scheduleService: declaredPort,
      liveScheduleService: () => declaredPort,
      capturedAgent: CAPTURED_AGENT,
      ScheduleInputError: HostInputError,
      placementFeed: () => ({ definitionIdentity: 'never-consulted' }),
      admit: async () => ({ ok: true }),
    }) as AssemblyValue
    expect(declaredMount.familyRegistrations()).toEqual([])
  })
})
