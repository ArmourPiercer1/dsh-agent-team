/**
 * A5M2-G1-QUERY-WIRING (card A5M2-G1-WIRE) — the REAL wiring candidate for
 * the pure-query G1 subset over the MATURE, already-audited adapter module
 * (g1-surface-adapters.mjs rev.6, reused VERBATIM). This spec owns the
 * ASSEMBLY facts the lane spec could not reach — it does NOT re-prove the
 * adapter laws (the 59-leg a5m2-g1-surface-adapters spec owns those):
 *
 *  (a) the factory over the REAL adapter module yields the pure-query subset
 *      (DERIVED from the frozen spec table: capture 'tool' + non-empty
 *      declared obligations all `right:'read'` => records 53/54/85) and the
 *      rows + definitions carry the CAPTURED NATIVE DESCRIPTION BYTES, the
 *      captured parameters face, and a working classify -> admit -> delegate
 *      composition (real effect grammar parses through the domain's own
 *      parser; the inspect list answer comes back topology-constrained);
 *  (b) family entries are keyed by the RUNTIME placement identity — the test's
 *      feed is backed by the REAL `definitionIdentityOf` mint (pb §6, the
 *      same algebra the seam and the Guard speak); the key equals
 *      definitionIdentityOf(the definition the factory emitted), is never the
 *      capture-side identity string, passes the PRODUCTION registry's own
 *      `registerA5GovernedFamily` shape law, and a silent/moved feed THROWS
 *      (never a guessed key, never a silent skip — the agent-bindings law);
 *  (c) non-query rows are NOT emitted (11 records absent from every surface;
 *      a capture presented for one refuses P_G1_WIRE_NON_SUBSET_CAPTURE);
 *  (d) an unobservable-facts row stays declared/INACTIVE VERBATIM: the
 *      declared row's classify/delegate refusal bytes deep-equal the
 *      reference row mounted DIRECTLY by the adapter module (same mount
 *      deps), an inspect row without its trustedTopology source answers the
 *      module's own P_G1_TRUSTED_TOPOLOGY_ABSENT verbatim with zero native
 *      entry, and a declared row gets NO definition and NO registration;
 *  (e) the module's import closure is asserted from its SOURCE TEXT: the
 *      static closure is exactly ['./g1-surface-adapters.mjs'], there is no
 *      dynamic import, and no lane-private or immature-resource specifier
 *      (plane/glue/registry/host-baseline/tool-dispatch/control/g2/g3/todo/
 *      write/image) appears — behaviorally reinforced: presenting a
 *      dependency/plugin resource arm or a non-whitelisted port refuses
 *      P_G1_WIRE_ARM_NOT_ACCEPTED at the factory;
 *  (f) ROOT 8b4 CENTRALIZATION: THE CAPTURED DEFINITION TRAVELS COMPLETE.
 *      Every presentation face of the captured native definition (output
 *      {schema, render}, compiled parameters, presentCall, isConcurrencySafe,
 *      timeoutMs, every face) rides into the placed definition VERBATIM by
 *      REFERENCE — ONLY execute is replaced; and the emitted definitions are
 *      verified through the REAL registration minimum entry (真实 register
 *      最低入口核): the pristine baseline's ToolRuntime over a real Cordis
 *      Context (Context + SystemPrompt + ToolRuntime plugins — the host's own
 *      test idiom) ACCEPTS them and stores them verbatim, REJECTS the
 *      hand-fabricated minimal shape (a definition without the mandatory
 *      output face), and REJECTS the duplicate the way the real entry does.
 *      The capture-side identity string never appears as a registration key
 *      (leg (b)) — placed and captured identities stay visibly separate.
 *
 * DISCLOSED STAND-INS (the adapter spec owns the REAL halves): native faces
 * are the REAL host `defineTool` products (compiled by the pristine 639
 * schema compiler, accepted by the REAL host validator) whose EXECUTE BODIES
 * are recorded test doubles mirroring the pinned host law shape — the cordis
 * pair's real delegation rides the live inspect topology, not a unit lane;
 * the `admit` seam is the PLANE'S seat (paAdmit walk — integrator line) stood
 * in by a recording double. This spec is NOT C2: no Host, no network. Windows
 * dimensions: not run on this Linux harness, never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-query-wiring
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'

// ── the two REAL production modules under spec (hand-cast, house idiom) ───
type ClassifyResult = { ok: boolean; code?: string; detail?: string; plan?: unknown; effects?: unknown }
type DelegateResult = { ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }
type AdapterRow = {
  name: string
  familyId: string
  recordIndex: number
  capturePresent: boolean
  descriptionFrom: string
  description: string | null
  parameters: Record<string, unknown> | null
  definitionIdentity: string | null
  nativeFaceRef: string
  classify: (args: unknown, callId: unknown) => ClassifyResult
  delegate: (plan: unknown, ctx?: { exec?: unknown }) => Promise<DelegateResult>
}
type AdapterModule = {
  A5_G1_FAMILY_GROUP: string
  A5_G1_ADAPTER_REVISION: number
  A5_G1_CONTROL_ADAPTER_REVISION: number
  A5_G1_RECORD_SPECS: Record<string, { recordIndex: number; family: string; capture: string; nativeFaceRef: string; obligations?: Array<{ right: string }> }>
  g1SurfaceAdapterNames: () => string[]
  mountG1SurfaceAdapter: (name: string, deps?: Record<string, unknown>) => AdapterRow
}
type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: unknown; render: unknown; presentationMeta?: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type Registration = { name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }
type WiringValue = {
  ok: true
  group: string
  revision: number
  adapterRevision: number
  providerId: string
  subset: Array<{ name: string; recordIndex: number; familyId: string }>
  placementNames: string[]
  definitions: Definition[]
  rows: Record<string, { status: string; reason?: string; row: AdapterRow; definition?: Definition }>
  declared: Array<{ name: string; recordIndex: number; familyId: string; status: string; reason: string }>
  rowOf: (name: string) => AdapterRow | undefined
  familyRegistrations: () => Registration[]
}
type WiringResult = WiringValue | { ok: false; code: string; message: string }
type WiringModule = {
  A5_G1_QUERY_WIRING_GROUP: string
  A5_G1_QUERY_WIRING_REVISION: number
  A5_G1_QUERY_WIRING_CODES: {
    readonly INPUT_INVALID: string
    readonly ARM_NOT_ACCEPTED: string
    readonly NON_SUBSET_CAPTURE: string
    readonly ADMISSION_ABSENT: string
    readonly PLACEMENT_KEY_ABSENT: string
    readonly PLACEMENT_KEY_MOVED: string
  }
  g1PureQuerySubset: () => Array<{ name: string; recordIndex: number; familyId: string }>
  createG1QueryWiring: (input?: Record<string, unknown>) => WiringResult
}

const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as AdapterModule
const WIRE = (await import(new URL('../src/plugin/live/governed-families/g1-query-wiring.mjs', import.meta.url).href)) as WiringModule
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}

// ── the REAL registration entry from the pristine baseline (r9 pattern; fail
//    closed): the emitted defs face the REAL ToolRuntime.register minimum
//    entry (真实 register 最低入口核), never a fabricated registration shape.
//    ONE consistent module set: both services must resolve the SAME cordis
//    realpath (pnpm links share realpath), else the DI symbols would not be
//    the same modules and the harness would test a split brain. ──
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const TOOLS_LIB = HOST_PKG('core', 'tools', 'lib', 'index.js')
const SYS_PROMPT_LIB = HOST_PKG('core', 'system-prompt', 'lib', 'index.js')
if (!existsSync(TOOLS_LIB)) throw new Error(`pristine tools lib absent (${TOOLS_LIB}); failing closed`)
if (!existsSync(SYS_PROMPT_LIB)) throw new Error(`pristine system-prompt lib absent (${SYS_PROMPT_LIB}); failing closed`)
const CORDIS_FROM_TOOLS = createRequire(pathToFileURL(TOOLS_LIB)).resolve('@deepseek-ai/cordis')
const CORDIS_FROM_SYS_PROMPT = createRequire(pathToFileURL(SYS_PROMPT_LIB)).resolve('@deepseek-ai/cordis')
if (CORDIS_FROM_TOOLS !== CORDIS_FROM_SYS_PROMPT) {
  throw new Error(`host module set splits across cordis copies (${CORDIS_FROM_TOOLS} != ${CORDIS_FROM_SYS_PROMPT}); failing closed`)
}
type HostToolsLib = {
  default: unknown // the ToolRuntime plugin/service
  defineTool: (options: Record<string, unknown>) => Record<string, unknown>
  assertSupportedJsonSchema: (schema: unknown) => void
}
type HostContext = {
  plugin: (plugin: unknown, config?: Record<string, unknown>) => Promise<void>
  tools: {
    register: (definition: Record<string, unknown>) => () => void
    get: (name: string) => Record<string, unknown> | undefined
  }
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as HostToolsLib
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_FROM_TOOLS).href)) as unknown as { Context: new () => HostContext }
const HOST_CONTEXT_CTOR = HOST_CORDIS.Context
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
/** The host's own minimal harness idiom (core/tools/tests/ptc.spec.ts):
 *  a real Context, SystemPrompt, then the ToolRuntime service. */
async function realRegistrationHarness(): Promise<HostContext> {
  const ctx = new HOST_CONTEXT_CTOR()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  return ctx
}

// ── fixtures: the trusted CONFIG faces + CURRENT-facts ports (the same
//    shapes the adapter spec pins; the closed-root legs there own forgery) ──
const PROVIDER = 'g1-wire'
const TRUSTED = {
  memberAgentId: 'agent-member-1',
  sessionHeaderId: 'session-header-77',
  realmId: 'realm-wire',
  owner: 'owner-root-1',
  profileId: 'profile-live-1',
}
const BINDINGS = () => ({ bindingId: 'binding-3', bindingRevision: 7, policyGeneration: 3, authorityGeneration: 2 })
const TOPOLOGY = {
  current: () => ({
    topologyRevision: 9,
    topologyDigest: 'sha256;toponine',
    allowed: [
      { platform: 'host', provider: 'host-providers', method: 'list' },
      { platform: 'client', provider: 'slot-tree', method: 'list_slots' },
    ],
  }),
}
const GOOD_ARGS: Record<string, Record<string, unknown>> = {
  cordis_inspect_list: {},
  cordis_inspect_query: { platform: 'host', provider: 'host-providers', method: 'list' },
  team_list_pending_control: { rootSessionId: 'root-1', requestToken: 'tok-1' },
}
/** The CAPTURED native description bytes — distinctive so byte-identity is
 *  a real assertion, never a coincidence of an empty string. */
const CAPTURED_DESCRIPTIONS: Record<string, string> = {
  cordis_inspect_list: 'CAPTURED-G1-BYTES\tlist §3 enumerate — 保留原生 \u00b6 rev6',
  cordis_inspect_query: 'CAPTURED-G1-BYTES\tquery read-one-method — 保留原生 \u00b6 rev6',
  team_list_pending_control: 'CAPTURED-G1-BYTES\tpending read — 保留原生 \u00b6 rev6',
}

/** The captured answer DTOs as REAL host output schemas in the host's VALUE
 *  schema DSL (every object face declares additionalProperties explicitly and
 *  `required` is not a value-DSL keyword — both laws measured, not guessed).
 *  The delegate answers ride these faces verbatim; registration validates the
 *  SCHEMA, dispatch is out of lane. */
const OUTPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  cordis_inspect_list: {
    type: 'object',
    properties: {
      providers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            id: { type: 'string' },
            methods: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false } },
          },
          additionalProperties: false,
        },
      },
      excludedUnauthorizedProviders: { type: 'integer' },
    },
    additionalProperties: false,
  },
  cordis_inspect_query: { type: 'object', properties: { payload: { type: 'string' } }, additionalProperties: false },
  team_list_pending_control: {
    type: 'object',
    properties: {
      requests: { type: 'array', items: { type: 'object', properties: {}, additionalProperties: true } },
      limit: { type: 'integer' },
    },
    additionalProperties: false,
  },
}
const DEFAULT_OUTPUT_SCHEMA = { type: 'object', properties: {}, additionalProperties: true }

type NativeCall = { args: unknown; exec: unknown }
/** The captured native face as the REAL host `defineTool` product (the
 *  pristine 639 schema compiler builds the parameters/output faces and the
 *  host validator owns their semantics) — only the EXECUTE BODY is the
 *  disclosed recording double. Every presentation face (presentCall,
 *  isConcurrencySafe, timeoutMs) is carried: this is what a real capture
 *  hands the wiring, and the COMPLETE-definition-travel legs below measure
 *  that the wiring drops none of it. */
function makeNative(name: string, body?: (args: unknown, exec: unknown) => Promise<unknown>): { native: Record<string, unknown>; calls: NativeCall[] } {
  const calls: NativeCall[] = []
  const run = async (args: unknown, exec: unknown): Promise<unknown> => {
    calls.push({ args, exec })
    if (name === 'cordis_inspect_list') {
      return {
        providers: [
          { platform: 'host', id: 'host-providers', methods: [{ name: 'list' }, { name: 'not-authorized-method' }] },
          { platform: 'client', id: 'rogue-unauthorized', methods: [{ name: 'list_slots' }] },
        ],
      }
    }
    if (name === 'cordis_inspect_query') return { payload: 'topology-authorized-answer' }
    return { requests: [], limit: 50 }
  }
  const native = HOST_TOOLS.defineTool({
    name,
    description: CAPTURED_DESCRIPTIONS[name] ?? `CAPTURED-G1-BYTES\t${name} — 保留原生 \u00b6 rev6`,
    parameters: {},
    output: {
      schema: OUTPUT_SCHEMAS[name] ?? DEFAULT_OUTPUT_SCHEMA,
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ title: name }),
    isConcurrencySafe: () => true,
    timeoutMs: 60000,
    execute: body ?? run,
  })
  return { native, calls }
}

/** A world: subset captures (default: all three), live placement feed backed
 *  by the REAL mint algebra, a recording admit seam. `mint()` performs the
 *  seam's install pass for the placed defs (the mount moment). */
function makeWorld(over: {
  captures?: string[]
  noPorts?: boolean
  admit?: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>
} = {}) {
  const captureNames = over.captures ?? ['cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control']
  const natives = new Map<string, { native: Record<string, unknown>; calls: NativeCall[] }>()
  const captured: Record<string, unknown> = {}
  for (const name of captureNames) {
    const double = makeNative(name)
    natives.set(name, double)
    captured[name] = { native: double.native, definitionIdentity: `capture-side-id-${name}` }
  }
  const minted = new Map<string, string>()
  const feedNamesConsulted: string[] = []
  const admissionCalls: Array<Record<string, unknown>> = []
  const wiringResult = WIRE.createG1QueryWiring({
    providerId: PROVIDER,
    captured,
    placementFeed: (name: string) => {
      feedNamesConsulted.push(name)
      const identity = minted.get(name)
      return identity === undefined ? undefined : { definitionIdentity: identity, realmId: TRUSTED.realmId }
    },
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ...((over.noPorts ?? false) ? {} : { ports: { trustedTopology: TOPOLOGY } }),
    admit: async (ctx: Record<string, unknown>) => {
      admissionCalls.push(ctx)
      return over.admit === undefined ? { ok: true } : over.admit(ctx)
    },
  })
  const mint = () => {
    if (wiringResult.ok !== true) return
    for (const definition of wiringResult.definitions) {
      minted.set(definition.name, String(definitionIdentityOf(definition)))
    }
  }
  return { wiringResult, natives, minted, mint, feedNamesConsulted, admissionCalls }
}
function unwrap(result: WiringResult): WiringValue {
  if (result.ok !== true) throw new Error(`wiring assembly must answer ok (fixture): ${JSON.stringify(result)}`)
  return result
}

const SUBSET = ['cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control']

describe('a5m2-g1-query-wiring: the pure-query G1 wiring candidate over the VERBATIM adapter module', () => {
  describe('(a) the REAL adapter module behind the factory: derived subset + captured description bytes', () => {
    it('the subset is DERIVED from the frozen spec table (capture tool + all-read declared obligations) and equals records 53/54/85 in recordIndex order', () => {
      const derived = WIRE.g1PureQuerySubset()
      expect(derived.map((entry) => entry.name)).toEqual(SUBSET)
      expect(derived.map((entry) => entry.recordIndex)).toEqual([53, 54, 85])
      expect(derived.map((entry) => entry.familyId)).toEqual(['B-INSPECT', 'B-INSPECT', 'B-CONTROL'])
      // recompute the law straight off the adapter's own frozen table
      const hand = Object.entries(G1.A5_G1_RECORD_SPECS)
        .filter(([, spec]) => spec.capture === 'tool'
          && Array.isArray(spec.obligations) && spec.obligations.length > 0
          && spec.obligations.every((o) => o.right === 'read'))
        .map(([name, spec]) => ({ name, recordIndex: spec.recordIndex, familyId: spec.family }))
        .sort((a, b) => a.recordIndex - b.recordIndex)
      expect(derived).toEqual(hand)
      // and the law really excludes a WRITE row despite its read obligations
      expect(G1.A5_G1_RECORD_SPECS.skill?.obligations?.some((o) => o.right === 'write')).toBe(true)
      expect(WIRE.A5_G1_QUERY_WIRING_GROUP).toBe(G1.A5_G1_FAMILY_GROUP)
      expect(WIRE.A5_G1_QUERY_WIRING_REVISION).toBe(1)
    })

    it('every emitted definition and row carries the CAPTURED native description bytes and the captured parameters face', () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      expect(wiring.ok).toBe(true)
      expect(wiring.adapterRevision).toBe(G1.A5_G1_ADAPTER_REVISION)
      expect(wiring.providerId).toBe(PROVIDER)
      expect(wiring.placementNames).toEqual(SUBSET)
      expect(wiring.definitions.length).toBe(3)
      for (const definition of wiring.definitions) {
        const double = world.natives.get(definition.name)
        expect(double, `capture for ${definition.name}`).toBeDefined()
        // byte-identity with the captured native face (not a copy of a copy)
        expect(definition.description).toBe(CAPTURED_DESCRIPTIONS[definition.name])
        const row = wiring.rowOf(definition.name)
        expect(row, `row for ${definition.name}`).toBeDefined()
        expect(row?.description).toBe(double?.native.description)
        expect(row?.descriptionFrom).toBe('native')
        expect(row?.capturePresent).toBe(true)
        expect(row?.definitionIdentity).toBe(`capture-side-id-${definition.name}`)
        // the parameters face is the CAPTURED object (identity-tie law)
        expect(definition.parameters).toBe(row?.parameters)
        expect(Object.isFrozen(definition)).toBe(true)
      }
    })

    it('the CAPTURED definition travels COMPLETE (root 8b4 law): every presentation face rides verbatim BY REFERENCE, ONLY execute is replaced', () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      for (const definition of wiring.definitions) {
        const native = world.natives.get(definition.name)?.native
        expect(native, `capture for ${definition.name}`).toBeDefined()
        // no face added, NO FACE DROPPED: the key sets agree
        expect(Object.keys(definition).sort()).toEqual(Object.keys(native as Record<string, unknown>).sort())
        for (const face of Object.keys(native as Record<string, unknown>)) {
          if (face === 'execute') continue
          expect(definition[face], `captured face '${face}' must ride the placed def verbatim by reference`).toBe((native as Record<string, unknown>)[face])
        }
        // the mandatory canonical output face — schema + render are the CAPTURED bytes
        expect(definition.output).toBe((native as { output: unknown }).output)
        expect(typeof definition.output.render).toBe('function')
        expect(definition.output.schema).toBe((native as { output: { schema: unknown } }).output.schema)
        // the presentation faces survive (they are the captured references)
        expect(definition.presentCall).toBe((native as { presentCall: unknown }).presentCall)
        expect(definition.isConcurrencySafe).toBe((native as { isConcurrencySafe: unknown }).isConcurrencySafe)
        expect(definition.timeoutMs).toBe((native as { timeoutMs: unknown }).timeoutMs)
        // ONLY execute is replaced by the wired classify -> admit -> delegate body
        expect(definition.execute).not.toBe((native as { execute: unknown }).execute)
        expect(typeof definition.execute).toBe('function')
        // the top level is the wiring's own frozen object; nested CAPTURED
        // faces are NOT re-frozen in place (they belong to the capture and the
        // real registry keeps the same references) — no host-object mutation
        expect(Object.isFrozen(definition)).toBe(true)
        expect(Object.isFrozen(definition.output)).toBe(false)
      }
    })

    it('rows ARE the module rows: classify answers the module\'s closed grammar (REAL effect parse); def.execute runs classify -> admit -> delegate and the captured native runs EXACTLY once with the plan-frozen args', async () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      const row = wiring.rowOf('cordis_inspect_list')
      const classified = row?.classify({}, 'call-direct')
      expect(classified?.ok, JSON.stringify(classified)).toBe(true)
      const parsed = parseRequestedEffectSet((classified as { effects?: unknown }).effects as never)
      expect(parsed.ok === true ? [] : (parsed as unknown as { problems: Array<{ detail: string }> }).problems).toEqual([])

      // full composition through the definition face
      const listDef = wiring.definitions.find((d) => d.name === 'cordis_inspect_list')
      expect(listDef).toBeDefined()
      const exec = { callId: 'call-list-1', token: Symbol('exec-list'), agent: { id: 'agent-member-1' } }
      const value = await listDef?.execute({}, exec)
      const calls = world.natives.get('cordis_inspect_list')?.calls ?? []
      expect(calls.length).toBe(1)
      // the value is the module's topology-CONSTRAINED answer, verbatim
      expect(value).toMatchObject({ excludedUnauthorizedProviders: 1 })
      const providers = (value as { providers: Array<{ id: string; methods: Array<{ name: string }> }> }).providers
      expect(providers.map((p) => p.id)).toEqual(['host-providers'])
      expect(providers[0]?.methods.map((m) => m.name)).toEqual(['list'])
      // the admit seam is ASKED, once, with the classify facts, BEFORE native entry
      expect(world.admissionCalls.length).toBe(1)
      const ctx = world.admissionCalls[0] as Record<string, unknown>
      expect(ctx.name).toBe('cordis_inspect_list')
      expect(ctx.recordIndex).toBe(53)
      expect(ctx.familyId).toBe('B-INSPECT')
      expect((ctx.classified as { ok?: boolean }).ok).toBe(true)
      // the native saw the PLAN's frozen clone under the exec identity
      expect(calls[0]?.exec).toBe(exec)

      // query row: authorized triple runs; the answer rides verbatim
      const queryDef = wiring.definitions.find((d) => d.name === 'cordis_inspect_query')
      const queryValue = await queryDef?.execute(GOOD_ARGS.cordis_inspect_query, { callId: 'call-q-1', agent: {} })
      expect(queryValue).toEqual({ payload: 'topology-authorized-answer' })
      expect(world.natives.get('cordis_inspect_query')?.calls.length).toBe(1)

      // control read row: pure ledger read on own-layer scope
      const pendingDef = wiring.definitions.find((d) => d.name === 'team_list_pending_control')
      const pendingValue = await pendingDef?.execute(GOOD_ARGS.team_list_pending_control, { callId: 'call-p-1', agent: {} })
      expect(pendingValue).toEqual({ requests: [], limit: 50 })
    })

    it('no unadmitted path: an admit refusal throws with the admission\'s OWN bytes and ZERO native entry; admit absent refuses the assembly', async () => {
      const denied = makeWorld({ admit: async () => ({ ok: false, code: 'PA_DENY', detail: 'the plane refused this walk' }) })
      const wiring = unwrap(denied.wiringResult)
      const listDef = wiring.definitions.find((d) => d.name === 'cordis_inspect_list')
      await expect(listDef?.execute({}, { callId: 'call-deny', agent: {} })).rejects.toThrow(/PA_DENY/)
      expect(denied.natives.get('cordis_inspect_list')?.calls.length).toBe(0)

      const noAdmit = WIRE.createG1QueryWiring({
        captured: {}, placementFeed: () => undefined, trusted: TRUSTED, bindingFacts: BINDINGS,
      })
      expect(noAdmit.ok).toBe(false)
      expect(noAdmit.ok === false && noAdmit.code).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.ADMISSION_ABSENT)
    })

    it('classify refusals ride the definition edge verbatim (unknown parameter) — zero admit calls, zero native entry', async () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      const pendingDef = wiring.definitions.find((d) => d.name === 'team_list_pending_control')
      await expect(pendingDef?.execute({ rootSessionId: 'root-1', requestToken: 'tok-1', memberAgentId: 'forged' }, { callId: 'call-f', agent: {} }))
        .rejects.toThrow(/P_G1_CLASSIFY_UNKNOWN_PARAMETER/)
      expect(world.admissionCalls.length).toBe(0)
      expect(world.natives.get('team_list_pending_control')?.calls.length).toBe(0)
    })
  })

  describe('(b) family entries key on the RUNTIME placement identity (definitionIdentityOf), never a hand-spelled key', () => {
    it('registrations equal definitionIdentityOf(the emitted, placed definitions), flow through the PRODUCTION registry, and are never the capture-side identity', () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      world.mint() // the seam's install pass for the placed defs (mount moment)
      const registrations = wiring.familyRegistrations()
      expect(registrations.map((r) => r.name)).toEqual(SUBSET)
      for (const registration of registrations) {
        const definition = wiring.definitions.find((d) => d.name === registration.name)
        // THE key IS the runtime mint of the placed definition (pb §6 algebra)
        expect(registration.definitionIdentity).toBe(String(definitionIdentityOf(definition)))
        expect(registration.definitionIdentity).toMatch(/^def#\d+$/)
        // ...and never the capture-side string the mount was bound with
        expect(registration.definitionIdentity).not.toBe(`capture-side-id-${registration.name}`)
        expect(registration.entry).toEqual({
          familyId: registration.name === 'team_list_pending_control' ? 'B-CONTROL' : 'B-INSPECT',
          // FAMILY revision (root LIMITED BUILD ORDER 2026-10-25): the
          // B-CONTROL wire format moved with the full pairing — the record-
          // 85 row's registration answers 8 beside its mint; B-INSPECT stays 7.
          adapterRevision: registration.name === 'team_list_pending_control' ? G1.A5_G1_CONTROL_ADAPTER_REVISION : G1.A5_G1_ADAPTER_REVISION,
          providerIdentity: PROVIDER,
        })
        // the PRODUCTION registry accepts the entry AS-IS (its own shape law)
        REGISTRY.registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
        expect(REGISTRY.a5GovernedFamilyFor(registration.definitionIdentity)).toEqual(registration.entry)
      }
      // distinct placed definitions mint distinct keys
      expect(new Set(registrations.map((r) => r.definitionIdentity)).size).toBe(3)
    })

    it('a silent feed THROWS (no guessed key, no silent skip); a moved identity THROWS (a placed identity does not float)', () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      // NOT minted yet — the mount moment has not happened
      expect(() => wiring.familyRegistrations()).toThrow(new RegExp(WIRE.A5_G1_QUERY_WIRING_CODES.PLACEMENT_KEY_ABSENT))
      world.mint()
      expect(wiring.familyRegistrations().length).toBe(3)
      const first = wiring.familyRegistrations()[0]
      expect(first).toBeDefined()
      world.minted.set('cordis_inspect_list', 'def#999999-moved')
      expect(() => wiring.familyRegistrations()).toThrow(new RegExp(WIRE.A5_G1_QUERY_WIRING_CODES.PLACEMENT_KEY_MOVED))
    })

    it('declared/INACTIVE records are NEVER consulted for a family key', () => {
      const world = makeWorld({ captures: ['cordis_inspect_list'] })
      const wiring = unwrap(world.wiringResult)
      world.mint()
      const registrations = wiring.familyRegistrations()
      expect(registrations.map((r) => r.name)).toEqual(['cordis_inspect_list'])
      expect(world.feedNamesConsulted.every((name) => SUBSET.includes(name))).toBe(true)
      expect(registrations.some((r) => r.name === 'team_list_pending_control')).toBe(false)
    })
  })

  describe('(c) non-query rows are NOT emitted', () => {
    it('all 11 non-query records are absent from subset/definitions/registrations; presenting a capture for one REFUSES the assembly', () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      world.mint()
      const nonQuery = G1.g1SurfaceAdapterNames().filter((name) => !SUBSET.includes(name))
      expect(nonQuery.length).toBe(11)
      expect(nonQuery).toContain('plugin_manager')
      expect(nonQuery).toContain('load_workspace_dependencies')
      expect(nonQuery).toContain('present')
      expect(nonQuery).toContain('surface:domain_family')
      const emitted = new Set<string>([
        ...wiring.subset.map((entry) => entry.name),
        ...wiring.placementNames,
        ...Object.keys(wiring.rows),
        ...wiring.declared.map((entry) => entry.name),
        ...wiring.familyRegistrations().map((r) => r.name),
      ])
      for (const name of nonQuery) expect(emitted.has(name), `emitted non-query row: ${name}`).toBe(false)
      // families + indices on the emitted registrations stay inside the subset
      const registrations = wiring.familyRegistrations()
      expect(new Set(registrations.map((r) => r.entry.familyId))).toEqual(new Set(['B-INSPECT', 'B-CONTROL']))
      expect(new Set(registrations.map((r) => r.recordIndex))).toEqual(new Set([53, 54, 85]))
      // presenting a non-query capture is a config defect, refused
      const smuggled = makeNative('present')
      const refused = WIRE.createG1QueryWiring({
        captured: { present: { native: smuggled.native, definitionIdentity: 'x' } },
        placementFeed: () => undefined,
        trusted: TRUSTED,
        bindingFacts: BINDINGS,
        admit: async () => ({ ok: true }),
      })
      expect(refused.ok).toBe(false)
      expect(refused.ok === false && refused.code).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.NON_SUBSET_CAPTURE)
    })
  })

  describe('(d) unobservable facts stay declared/INACTIVE VERBATIM (the module\'s own bytes, no invented arm)', () => {
    it('a capture-absent subset row mounts as the module\'s OWN native-less row: refusal bytes deep-equal the reference row the adapter module mounts directly; no definition, no registration', async () => {
      const world = makeWorld({ captures: ['cordis_inspect_list', 'cordis_inspect_query'] })
      const wiring = unwrap(world.wiringResult)
      world.mint()
      const name = 'team_list_pending_control'
      const row = wiring.rowOf(name)
      expect(row).toBeDefined()
      expect(row?.capturePresent).toBe(false)
      expect(row?.description).toBeNull()
      expect(row?.descriptionFrom).toBe('none')
      // VERBATIM: deep-equal the reference row mounted DIRECTLY by the module
      const reference = G1.mountG1SurfaceAdapter(name, {
        native: undefined, providerId: PROVIDER, trusted: TRUSTED, bindingFacts: BINDINGS, ports: { trustedTopology: TOPOLOGY },
      })
      const wiredClassify = row?.classify(GOOD_ARGS[name], 'call-x')
      const referenceClassify = reference.classify(GOOD_ARGS[name], 'call-x')
      expect(JSON.parse(JSON.stringify(wiredClassify))).toEqual(JSON.parse(JSON.stringify(referenceClassify)))
      expect(wiredClassify?.code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
      const wiredDelegate = await row?.delegate({ callId: 'call-x' }, { exec: {} })
      const referenceDelegate = await reference.delegate({ callId: 'call-x' }, { exec: {} })
      expect(JSON.parse(JSON.stringify(wiredDelegate))).toEqual(JSON.parse(JSON.stringify(referenceDelegate)))
      expect(wiredDelegate?.code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
      // honest report + zero placement
      const declaredEntry = wiring.declared.find((entry) => entry.name === name)
      expect(declaredEntry).toMatchObject({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', familyId: 'B-CONTROL', recordIndex: 85 })
      expect(wiring.rows[name]?.status).toBe('DECLARED-INACTIVE')
      expect(wiring.definitions.some((d) => d.name === name)).toBe(false)
      expect(wiring.familyRegistrations().some((r) => r.name === name)).toBe(false)
    })

    it('a captured inspect row whose CURRENT-facts source is absent answers the module\'s OWN P_G1_TRUSTED_TOPOLOGY_ABSENT verbatim, with zero native entry through the definition edge', async () => {
      const world = makeWorld({ noPorts: true })
      const wiring = unwrap(world.wiringResult)
      const row = wiring.rowOf('cordis_inspect_list')
      const reference = G1.mountG1SurfaceAdapter('cordis_inspect_list', {
        native: makeNative('cordis_inspect_list').native,
        providerId: PROVIDER,
        definitionIdentity: 'reference-capture-id',
        trusted: TRUSTED,
        bindingFacts: BINDINGS,
        ports: {},
      })
      const wiredClassify = row?.classify({}, 'call-topo')
      const referenceClassify = reference.classify({}, 'call-topo')
      expect(JSON.parse(JSON.stringify(wiredClassify))).toEqual(JSON.parse(JSON.stringify(referenceClassify)))
      expect(wiredClassify?.code).toBe('P_G1_TRUSTED_TOPOLOGY_ABSENT')
      const listDef = wiring.definitions.find((d) => d.name === 'cordis_inspect_list')
      await expect(listDef?.execute({}, { callId: 'call-topo-2', agent: {} })).rejects.toThrow(/P_G1_TRUSTED_TOPOLOGY_ABSENT/)
      expect(world.admissionCalls.length).toBe(0)
      expect(world.natives.get('cordis_inspect_list')?.calls.length).toBe(0)
    })

    it('the FACTORY itself carries no resource arm: controlledInstall / installFace / hostEscalation and every non-whitelisted port refuse P_G1_WIRE_ARM_NOT_ACCEPTED', () => {
      const base = {
        placementFeed: () => undefined,
        trusted: TRUSTED,
        bindingFacts: BINDINGS,
        admit: async () => ({ ok: true }),
      }
      // CONSOLIDATED CARD 2026-10-25 (user 09:03:32: 只管理安装动作即可):
      // 'controlledInstall' (B-DEPENDENCY) stays refused everywhere, by the
      // top-level byte law UNTOUCHED. installFace/hostEscalation became a
      // named arms bag: the top-level spellings are unknown inputs (the
      // candidate takes no resource key at the top), and the bag itself is
      // ARM_NOT_ACCEPTED unless the mounted row set is exactly B-PLUGIN.
      {
        const refused = WIRE.createG1QueryWiring({ ...base, controlledInstall: { present: true } })
        expect(refused.ok).toBe(false)
        expect(refused.ok === false && refused.code).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.ARM_NOT_ACCEPTED)
      }
      for (const arm of ['installFace', 'hostEscalation']) {
        const refused = WIRE.createG1QueryWiring({ ...base, [arm]: { present: true } })
        expect(refused.ok, arm).toBe(false)
        expect(refused.ok === false && refused.code, arm).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.INPUT_INVALID)
        const armed = WIRE.createG1QueryWiring({ ...base, arms: { [arm]: { present: true } } })
        expect(armed.ok, arm).toBe(false)
        expect(armed.ok === false && armed.code, arm).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.ARM_NOT_ACCEPTED)
        expect(armed.ok === false && armed.message, arm).toContain('exactly the B-PLUGIN supply')
      }
      for (const port of ['pluginFacts', 'dependencyFacts', 'trustedCatalog', 'domainPortRegistry']) {
        const refused = WIRE.createG1QueryWiring({ ...base, ports: { trustedTopology: TOPOLOGY, [port]: { current: () => ({}) } } })
        expect(refused.ok, port).toBe(false)
        expect(refused.ok === false && refused.code, port).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.ARM_NOT_ACCEPTED)
      }
      // half-captures and unknown inputs are config defects too — and the
      // HALF is measured against the REAL registration minimum-entry shape
      // law: the pre-8b4 fabricated face (no output face at all) and a broken
      // render both never reach a definition, never reach the real entry.
      const fabricatedHalfNative = {
        name: 'cordis_inspect_list',
        description: 'fabricated — no output face (the shape the real registration entry refuses)',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({}),
      }
      const halfCapture = WIRE.createG1QueryWiring({
        ...base,
        captured: { cordis_inspect_list: { native: fabricatedHalfNative, definitionIdentity: 'x' } },
      })
      expect(halfCapture.ok).toBe(false)
      expect(halfCapture.ok === false && halfCapture.code).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.INPUT_INVALID)
      const fullCapture = makeNative('cordis_inspect_list')
      const brokenRender = {
        native: { ...(fullCapture.native as Record<string, unknown>), output: { ...((fullCapture.native as { output: Record<string, unknown> }).output as Record<string, unknown>), render: 'not-a-function' } },
        definitionIdentity: 'x',
      }
      const renderRefused = WIRE.createG1QueryWiring({ ...base, captured: { cordis_inspect_list: brokenRender } })
      expect(renderRefused.ok).toBe(false)
      expect(renderRefused.ok === false && renderRefused.code).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.INPUT_INVALID)
      const unknownKey = WIRE.createG1QueryWiring({ ...base, definitionIdentity: 'hand-spelled-key' })
      expect(unknownKey.ok).toBe(false)
      expect(unknownKey.ok === false && unknownKey.code).toBe(WIRE.A5_G1_QUERY_WIRING_CODES.INPUT_INVALID)
    })
  })

  describe('(e) import closure asserted from the SOURCE TEXT: one project edge, zero lane-private / immature-arm imports', () => {
    // (global-URL vs node:url URL typing clash - path joins instead, same file)
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/governed-families/g1-query-wiring.mjs'), 'utf8')
    it('the static import closure is exactly [./g1-surface-adapters.mjs] and there is no dynamic import', () => {
      const statics: string[] = []
      const importRe = /^\s*import\s+(?:[\s\S]*?)\s*from\s*'([^']+)'/gm
      for (let m = importRe.exec(source); m !== null; m = importRe.exec(source)) {
        statics.push(String(m[1]))
      }
      expect([...new Set(statics)].sort()).toEqual(['./g1-surface-adapters.mjs'])
      // every `import` line is static; no bare/dynamic import expression exists
      const dynamic = source.match(/(^|[^.\w])import\s*\(/m)
      expect(dynamic).toBeNull()
    })

    it('no lane-private or immature-resource module specifier appears anywhere in the source', () => {
      const banned = [
        'team-tool-plane', 'agent-bindings', 'pre-execute-adapter', 'pa-mount-registry',
        'tool-dispatch', '/control/', 'kernel', 'todo\\.mjs', 'write\\.mjs', 'image\\.mjs',
        'g2-', 'g3-', 'deepseek-harness-test-use', 'node_modules', '@deepseek-ai',
      ]
      for (const pattern of banned) {
        const re = new RegExp(`from\\s*'[^']*${pattern}[^']*'`)
        expect(re.test(source), `forbidden import specifier reaches the source: ${pattern}`).toBe(false)
        expect(source, `forbidden specifier string appears as a module edge: ${pattern}`).not.toMatch(new RegExp(`import\\s*\\(\\s*'[^']*${pattern}`))
      }
    })

    it('the one project edge RESOLVES to the audited adapter module, and the rows are genuinely ITS rows', () => {
      // the factory's mounted rows answer with the module's OWN frozen shape
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      for (const name of SUBSET) {
        const row = wiring.rowOf(name)
        expect(Object.isFrozen(row)).toBe(true)
        expect(row?.nativeFaceRef).toBe(G1.A5_G1_RECORD_SPECS[name]?.nativeFaceRef)
        expect(typeof row?.classify).toBe('function')
        expect(typeof row?.delegate).toBe('function')
      }
      // the frozen group constant flows from the adapter module itself
      expect(wiring.group).toBe(WIRE.A5_G1_QUERY_WIRING_GROUP)
    })
  })

  describe('(f) the REAL registration entry (真实 register 最低入口核): emitted defs face the pristine host ToolRuntime.register, never a fabricated registration shape', () => {
    it('the REAL registration minimum entry ACCEPTS every emitted definition and stores it verbatim — captured output face and all; the same entry REFUSES the hand-fabricated half shape and the duplicate, as the host spells it', async () => {
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      const ctx = await realRegistrationHarness()
      const disposers: Array<() => void> = []
      try {
        for (const definition of wiring.definitions) {
          disposers.push(ctx.tools.register(definition as unknown as Record<string, unknown>))
          const stored = ctx.tools.get(definition.name)
          // stored VERBATIM: the registry holds the emitted object itself…
          expect(stored).toBe(definition)
          // …whose output face is still the CAPTURED object (the placed def
          // carries the captured bytes into the real registry, not a copy)
          expect((stored as { output: unknown }).output).toBe((world.natives.get(definition.name)?.native as { output: unknown }).output)
          // the real entry's own duplicate law fires on the second insert
          expect(() => ctx.tools.register(definition as unknown as Record<string, unknown>)).toThrow(/already registered/)
        }
        // the pre-8b4 fabricated shape (name/description/parameters/execute
        // and NO output face) could never have been placed: the REAL entry
        // refuses it with its own TypeError — this leg is the measured bite
        // of "keep the CAPTURED definition complete, replace only execute".
        expect(() => ctx.tools.register({
          name: 'fabricated-half-shape',
          description: 'hand-built minimal def',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          execute: async () => ({}),
        })).toThrow(/must declare output \{ schema, render, presentationMeta\? \}/)
      } finally {
        for (const dispose of disposers) dispose()
      }
    })

    it('the entry law itself is pinned from the pristine baseline SOURCE, and the REAL host validator accepts every captured output schema', () => {
      const hostSource = readFileSync(HOST_PKG('core', 'tools', 'src', 'index.ts'), 'utf8')
      // the minimum-entry checks register() performs before any layer effect
      expect(hostSource).toContain('must declare output { schema, render, presentationMeta? }')
      expect(hostSource).toContain('assertSupportedJsonSchema(output.schema)')
      expect(hostSource).toContain('timeoutMs must be a positive finite number')
      const world = makeWorld()
      const wiring = unwrap(world.wiringResult)
      for (const definition of wiring.definitions) {
        expect(() => HOST_TOOLS.assertSupportedJsonSchema(definition.output.schema), `host validator on ${definition.name} output schema`).not.toThrow()
        expect(() => HOST_TOOLS.assertSupportedJsonSchema(definition.parameters as never), `host validator on ${definition.name} parameters`).not.toThrow()
      }
    })
  })
})
