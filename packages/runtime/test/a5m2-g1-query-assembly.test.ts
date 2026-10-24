/**
 * A5M2-G1-WIRE PA ASSEMBLY (center 01:1x continuation; split 01:4x — this
 * spec + g1-query-assembly.mjs/.d.mts + g1-query-wiring.mjs/.d.mts are the
 * G1-WIRE lane's exclusive files; the agent-bindings mount-arm block and its
 * spec belong to lane 44ece).
 *
 * This spec owns the ASSEMBLY facts of the mount-side production line over
 * the wiring candidate:
 *  (A) evidence law: every missing/ill-shaped mount seam refuses
 *      P_G1_ASM_EVIDENCE_ABSENT at arm — no half-mounted line;
 *  (B) captures are LIVE readings of a REAL host registry (pristine 639
 *      ToolRuntime over a real Cordis Context — the ptc.spec harness idiom),
 *      and the CAPTURE-SIDE mint is the signed FULL REVERSIBLE canonical JSON
 *      (JSON.parse reads the observed facts back — a digest leg would fail
 *      it), namespaced 'g1-capture@...' and never a def#N;
 *  (C) a subset name the registry does not answer stays an honest
 *      DECLARED/INACTIVE row (no def, no capture, no registration), the
 *      B-INSPECT rows without their topology answer the adapter's OWN
 *      P_G1_TRUSTED_TOPOLOGY_ABSENT verbatim with zero PA walk and zero
 *      native entry, and the B-CONTROL row keeps serving;
 *  (D) the PA seat walks the PRODUCTION shape (plane :2586-2600): realmId,
 *      exec.callId, the classify-side parametersFingerprint untouched,
 *      effects parsed through the domain's OWN parser before the walk, the
 *      reviewPayload's four P-adds at FULL VALUE, the exec signal by
 *      reference; allow admits (native runs EXACTLY once, topology-constrained
 *      answer), deny/allow+cancelled/no-funnel/vanished-plane each refuse with
 *      their own typed bytes and ZERO native entry;
 *  (E) placement happens through a REAL registration entry: place() registers
 *      every wired def into a second REAL ToolRuntime (the agent-scope twin
 *      disclosed below), stored verbatim with the captured output face;
 *      unplace() disposes exactly; the ROOT P2 focus leg (b656 review) drives
 *      a REAL same-layer collision mid-list: per-item disposer recording,
 *      rollback of only this call's items, the host's original error rethrown
 *      intact, retry-able state, no fake cleanup;
 *  (F) registerAfterPublish(): BEFORE the seam's install pass it THROWS the
 *      wiring's P_G1_WIRE_PLACEMENT_KEY_ABSENT (no guess, no skip); AFTER,
 *      with the feed backed by the REAL definitionIdentityOf mint of the
 *      PLACED defs, the ONE production table answers each def#N key with
 *      exactly {familyId, adapterRevision, providerIdentity} — keys distinct,
 *      NEVER the capture-side mint, and the call is idempotent per the
 *      registry's same-entry law;
 *  (G) the import closure asserted from SOURCE TEXT: exactly the wiring edge,
 *      the production registry edge, and the domain parser edge — no direct
 *      adapter edge, no node:, no host baseline, no lane-private specifier.
 *
 * DISCLOSED STAND-INS: the plane handle is a recording double for the REAL
 * team-tool-plane seams (the plane's own paAdmit body is owned by the plane's
 * specs — this lane pins the WALK SHAPE its callers must carry and the
 * answer mapping); capture-side lives on one real ToolRuntime, placement runs
 * on a second real ToolRuntime standing in for the agent-scoped layer of the
 * same host (one Context cannot register the governed name over its native
 * globally — production placement is agent-scoped). Native execute bodies are
 * recorded doubles on REAL defineTool products. This spec is NOT C2 and the
 * line is 接线未测 (无 Host): until the 44ece mount-arm block calls it inside
 * the agent-bindings G1 arm, no production session runs it. Windows legs: not
 * run, never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-query-assembly
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'
// Type-only: the REAL exported code shapes of the two modules under test —
// the spec's earlier local `Record<string, string>` restatement widened every
// lookup to `string | undefined` under noUncheckedIndexedAccess and lost the
// literals. `typeof` of the d.mts declares keeps the spec pinned to the
// shipped shapes (an export rename or code drift fails HERE, at compile time).
import type { A5_G1_QUERY_ASSEMBLY_CODES } from '../src/plugin/live/governed-families/g1-query-assembly.d.mts'
import type { A5_G1_QUERY_WIRING_CODES } from '../src/plugin/live/governed-families/g1-query-wiring.d.mts'

type Walk = { realmId: string; callId: string; parametersFingerprint: unknown; requestedEffects: unknown; toolName: string; family: Record<string, unknown>; signal: AbortSignal | undefined }
type AssemblyValue = {
  ok: true
  revision: number
  providerId: string
  definitions: Array<{ name: string; description: string; output: { schema: unknown; render: unknown }; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> }>
  placementNames: string[]
  declared: Array<{ name: string; status: string; reason: string }>
  rowOf: (name: string) => { definitionIdentity: string | null; classify: (args: unknown, callId: unknown) => { ok: boolean; code?: string; effects?: unknown; parametersFingerprint?: string; reviewPayload?: Record<string, unknown> } } | undefined
  captures: Record<string, { status: string; definitionIdentity: string; recordIndex: number; familyId: string }>
  topologyMounted: boolean
  place: () => (() => void)[]
  unplace: () => void
  registerAfterPublish: () => Array<{ name: string; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }>
}
type AssemblyResult = AssemblyValue | { ok: false; code: string; message: string }
type AssemblyModule = {
  A5_G1_QUERY_ASSEMBLY_REVISION: number
  A5_G1_QUERY_ASSEMBLY_CODES: typeof A5_G1_QUERY_ASSEMBLY_CODES
  createG1QueryAssembly: (mount?: Record<string, unknown>) => AssemblyResult
}

const ASM = (await import(new URL('../src/plugin/live/governed-families/g1-query-assembly.mjs', import.meta.url).href)) as AssemblyModule
const WIRE = (await import(new URL('../src/plugin/live/governed-families/g1-query-wiring.mjs', import.meta.url).href)) as { A5_G1_QUERY_WIRING_CODES: typeof A5_G1_QUERY_WIRING_CODES }
const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as { A5_G1_ADAPTER_REVISION: number; A5_G1_CONTROL_ADAPTER_REVISION: number }
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  a5GovernedFamilyFor: (key: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}

// ── REAL host registration entries from the pristine baseline (r9 pattern;
//    fail closed; one consistent module set asserted by cordis realpath) ──
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
  default: unknown
  defineTool: (options: Record<string, unknown>) => Record<string, unknown>
}
type HostContext = {
  plugin: (plugin: unknown, config?: Record<string, unknown>) => Promise<void>
  tools: { register: (definition: Record<string, unknown>) => () => void; get: (name: string) => Record<string, unknown> | undefined }
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as HostToolsLib
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_FROM_TOOLS).href)) as unknown as { Context: new () => HostContext }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
async function realRegistryHarness(): Promise<HostContext> {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  return ctx
}

// ── fixtures (same faces the wiring spec pins; the adapter's closed grammar
//    owns the arg laws) ──
const SUBSET = ['cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control']
const TRUSTED = {
  memberAgentId: 'agent-member-1',
  sessionHeaderId: 'session-header-77',
  realmId: 'realm-asm',
  owner: 'owner-root-1',
  profileId: 'profile-live-1',
}
const BINDINGS = () => ({ bindingId: 'binding-9', bindingRevision: 12, policyGeneration: 4, authorityGeneration: 3 })
const TOPOLOGY = {
  current: () => ({
    topologyRevision: 4,
    topologyDigest: 'sha256;topofour',
    allowed: [
      { platform: 'host', provider: 'host-providers', method: 'list' },
      { platform: 'client', provider: 'slot-tree', method: 'list_slots' },
    ],
  }),
}
const DESCRIPTIONS: Record<string, string> = {
  cordis_inspect_list: 'CAPTURED-ASM-BYTES\tlist §3 enumerate — 保留原生 \u00b6 asm',
  cordis_inspect_query: 'CAPTURED-ASM-BYTES\tquery read-one-method — 保留原生 \u00b6 asm',
  team_list_pending_control: 'CAPTURED-ASM-BYTES\tpending read — 保留原生 \u00b6 asm',
}
const OUTPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  cordis_inspect_list: {
    type: 'object',
    properties: {
      providers: { type: 'array', items: { type: 'object', properties: { platform: { type: 'string' }, id: { type: 'string' }, methods: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false } } }, additionalProperties: false } },
      excludedUnauthorizedProviders: { type: 'integer' },
    },
    additionalProperties: false,
  },
  cordis_inspect_query: { type: 'object', properties: { payload: { type: 'string' } }, additionalProperties: false },
  team_list_pending_control: { type: 'object', properties: { requests: { type: 'array', items: { type: 'object', properties: {}, additionalProperties: true } }, limit: { type: 'integer' } }, additionalProperties: false },
}

/** REAL defineTool product whose EXECUTE BODY is a recorded double (the same
 *  disclosed stand-in law as the wiring spec). */
function makeNative(name: string): { native: Record<string, unknown>; calls: Array<{ args: unknown; exec: unknown }> } {
  const calls: Array<{ args: unknown; exec: unknown }> = []
  const native = HOST_TOOLS.defineTool({
    name,
    description: DESCRIPTIONS[name] as string,
    parameters: {},
    output: {
      schema: OUTPUT_SCHEMAS[name],
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: () => ({ title: name }),
    timeoutMs: 60000,
    async execute(args: unknown, exec: unknown) {
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
    },
  })
  return { native, calls }
}

let providerSeq = 0
/** A world: natives live on a REAL ToolRuntime (the capture source); the
 *  assembly mounts over the live get(); placement registers on a SECOND real
 *  ToolRuntime (the disclosed agent-scope twin); the plane handle records the
 *  production walks and its placementFeed answers the REAL mint of the placed
 *  defs after `publish()`. */
async function makeWorld(over: {
  captureNames?: string[]
  noTopology?: boolean
  paAnswer?: (walk: Walk) => Promise<{ kind: string; code?: string; detail?: string; cancelled?: boolean }>
} = {}) {
  const providerId = `g1-asm-p${(providerSeq += 1)}`
  const captureCtx = await realRegistryHarness()
  const placedCtx = await realRegistryHarness()
  const natives = new Map<string, { native: Record<string, unknown>; calls: Array<{ args: unknown; exec: unknown }> }>()
  for (const name of over.captureNames ?? SUBSET) {
    const double = makeNative(name)
    natives.set(name, double)
    captureCtx.tools.register(double.native)
  }
  const walks: Walk[] = []
  const minted = new Map<string, string>()
  let publishCount = 0
  const planeHandle = {
    placementFeed: (name: string) => {
      const identity = minted.get(name)
      return identity === undefined ? undefined : { definitionIdentity: identity, realmId: TRUSTED.realmId }
    },
    paAdmit: async (walk: Walk) => {
      walks.push(walk)
      return over.paAnswer === undefined ? { kind: 'allow' } : await over.paAnswer(walk)
    },
  }
  const result = ASM.createG1QueryAssembly({
    providerId,
    registry: {
      get: (name: string) => captureCtx.tools.get(name),
      register: (definition: AssemblyValue['definitions'][number]) => placedCtx.tools.register(definition as unknown as Record<string, unknown>),
    },
    plane: () => planeHandle,
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ...(over.noTopology === true ? {} : { topology: TOPOLOGY }),
  })
  /** the seam's install pass: mint the placed defs' runtime identities. */
  const publish = () => {
    publishCount += 1
    for (const name of SUBSET) {
      const stored = placedCtx.tools.get(name)
      if (stored !== undefined && stored !== null) minted.set(name, String(definitionIdentityOf(stored)))
    }
  }
  return { providerId, result, natives, walks, minted, publish, planeHandle, captureCtx, placedCtx, publishCount: () => publishCount }
}
function unwrap(result: AssemblyResult): AssemblyValue {
  if (result.ok !== true) throw new Error(`assembly must answer ok (fixture): ${JSON.stringify(result)}`)
  return result
}
const EXEC = { callId: 'call-asm-1', agent: { id: 'agent-member-1' } }

describe('a5m2-g1-query-assembly: the mount-side PA production line over the wiring candidate', () => {
  describe('(A) evidence law: no half-mounted line', () => {
    it('every missing or ill-shaped mount seam refuses P_G1_ASM_EVIDENCE_ABSENT at arm', async () => {
      const world = await makeWorld()
      const base = {
        providerId: 'g1-asm-evidence',
        registry: { get: () => undefined },
        plane: () => ({ placementFeed: () => undefined }),
        trusted: TRUSTED,
        bindingFacts: BINDINGS,
      }
      void world
      const noProvider = ASM.createG1QueryAssembly({ ...base, providerId: '' })
      expect(noProvider.ok).toBe(false)
      expect(noProvider.ok === false && noProvider.code).toBe(ASM.A5_G1_QUERY_ASSEMBLY_CODES.EVIDENCE_ABSENT)
      for (const [label, mount] of [
        ['no registry', { ...base, registry: undefined }],
        ['plane not a reader', { ...base, plane: {} }],
        ['plane without placementFeed', { ...base, plane: () => ({}) }],
        ['trusted without realmId', { ...base, trusted: { ...TRUSTED, realmId: '' } }],
        ['bindingFacts dead', { ...base, bindingFacts: 7 }],
        ['topology snapshot not a reader', { ...base, topology: { current: 'frozen' } }],
      ] as const) {
        const refused = ASM.createG1QueryAssembly(mount as unknown as Record<string, unknown>)
        expect(refused.ok, label).toBe(false)
        expect(refused.ok === false && refused.code, label).toBe(ASM.A5_G1_QUERY_ASSEMBLY_CODES.EVIDENCE_ABSENT)
      }
    })

    it('a live registry answering a REGISTRATION-INCOMPLETE face refuses P_G1_ASM_CAPTURE_HALF_FACE (never demoted, never bound)', () => {
      const half = { name: 'cordis_inspect_list', description: 'no output face', execute: async () => ({}) }
      const refused = ASM.createG1QueryAssembly({
        providerId: 'g1-asm-half',
        registry: { get: (name: string) => (name === 'cordis_inspect_list' ? half : undefined) },
        plane: () => ({ placementFeed: () => undefined }),
        trusted: TRUSTED,
        bindingFacts: BINDINGS,
      })
      expect(refused.ok).toBe(false)
      expect(refused.ok === false && refused.code).toBe(ASM.A5_G1_QUERY_ASSEMBLY_CODES.CAPTURE_HALF_FACE)
    })
  })

  describe('(B) captures are LIVE real-registry readings; the capture mint is full reversible canonical JSON', () => {
    it('every subset capture came from the live host registry (object identity holds) and its mint reads the observed facts back', async () => {
      const world = await makeWorld()
      const assembly = unwrap(world.result)
      expect(assembly.revision).toBe(ASM.A5_G1_QUERY_ASSEMBLY_REVISION)
      expect(assembly.topologyMounted).toBe(true)
      expect(Object.keys(assembly.captures).sort()).toEqual([...SUBSET].sort())
      for (const name of SUBSET) {
        const capture = assembly.captures[name]
        // honest narrowing (and a sharper fact than toBeDefined): the fixture
        // registered this name, so a missing capture is a broken world.
        if (capture === undefined) throw new Error(`the live registry must have answered '${name}' — the fixture registered it`)
        expect(capture.status).toBe('CAPTURED')
        // the mint is NAMESPACED apart from the placement keys
        expect(capture.definitionIdentity.startsWith(`g1-capture@${world.providerId}@${name}#`)).toBe(true)
        expect(/^def#\d+$/.test(capture.definitionIdentity)).toBe(false)
        // FULL REVERSIBLE (the signed mint law): the observed facts parse back
        const observed = JSON.parse(capture.definitionIdentity.slice(capture.definitionIdentity.indexOf('#') + 1)) as Record<string, unknown>
        expect(observed.description).toBe(DESCRIPTIONS[name])
        expect(observed.familyId).toBe(name === 'team_list_pending_control' ? 'B-CONTROL' : 'B-INSPECT')
        expect(observed.recordIndex).toBe(name === 'team_list_pending_control' ? 85 : name === 'cordis_inspect_list' ? 53 : 54)
        expect(observed.timeoutMs).toBe(60000)
        expect(observed.parameters).not.toBeNull()
        // the row carries the CAPTURE-SIDE identity (the adapter mount law)…
        expect(assembly.rowOf(name)?.definitionIdentity).toBe(capture.definitionIdentity)
        // …and the captured face is the live registry object, not a copy
        expect(assembly.rowOf(name)).toBeDefined()
        const live = world.captureCtx.tools.get(name)
        expect(live).toBe(world.natives.get(name)?.native)
      }
    })
  })

  describe('(C) honest declared rows and the adapter\'s own refusals', () => {
    it('a subset name the registry does not answer stays DECLARED (no def, no capture, no registration) while the captured rows serve', async () => {
      const world = await makeWorld({ captureNames: ['cordis_inspect_list', 'cordis_inspect_query'] })
      const assembly = unwrap(world.result)
      expect(assembly.declared.map((entry) => entry.name)).toEqual(['team_list_pending_control'])
      expect(assembly.definitions.map((d) => d.name)).toEqual(['cordis_inspect_list', 'cordis_inspect_query'])
      expect(assembly.captures.team_list_pending_control).toBeUndefined()
      assembly.place()
      world.publish()
      const registrations = assembly.registerAfterPublish()
      expect(registrations.map((r) => r.name)).toEqual(['cordis_inspect_list', 'cordis_inspect_query'])
    })

    it('without the topology supply the B-INSPECT row answers the module\'s OWN P_G1_TRUSTED_TOPOLOGY_ABSENT (zero PA walk, zero native entry) while B-CONTROL still serves through a real walk', async () => {
      const world = await makeWorld({ captureNames: ['cordis_inspect_list', 'team_list_pending_control'], noTopology: true })
      const assembly = unwrap(world.result)
      expect(assembly.topologyMounted).toBe(false)
      const listDef = assembly.definitions.find((d) => d.name === 'cordis_inspect_list')
      await expect(listDef?.execute({}, EXEC)).rejects.toThrow(/P_G1_TRUSTED_TOPOLOGY_ABSENT/)
      expect(world.walks.length).toBe(0)
      expect(world.natives.get('cordis_inspect_list')?.calls.length).toBe(0)
      const pendingDef = assembly.definitions.find((d) => d.name === 'team_list_pending_control')
      const value = await pendingDef?.execute({ rootSessionId: 'root-1', requestToken: 'tok-1' }, { callId: 'call-asm-2', agent: {} })
      expect(value).toEqual({ requests: [], limit: 50 })
      expect(world.walks.length).toBe(1)
    })
  })

  describe('(D) the PA seat walks the PRODUCTION shape and the answer mapping is fail-closed', () => {
    it('allow: the walk carries realmId, exec.callId, the classify-side fingerprint, parser-approved effects, the four P-adds at FULL VALUE, and the exec signal by reference; the native runs EXACTLY ONCE', async () => {
      const world = await makeWorld()
      const assembly = unwrap(world.result)
      const controller = new AbortController()
      const exec = { ...EXEC, callId: 'call-walk-1', signal: controller.signal }
      const value = await assembly.definitions.find((d) => d.name === 'cordis_inspect_list')?.execute({}, exec)
      expect(world.walks.length).toBe(1)
      const walk = world.walks[0] as Walk
      expect(walk.realmId).toBe(TRUSTED.realmId)
      expect(walk.callId).toBe('call-walk-1')
      expect(walk.toolName).toBe('cordis_inspect_list')
      expect(walk.signal).toBe(controller.signal)
      const recomputed = assembly.rowOf('cordis_inspect_list')?.classify({}, 'call-walk-1')
      expect(recomputed?.ok).toBe(true)
      expect(walk.parametersFingerprint).toBe(recomputed?.parametersFingerprint)
      const parsed = parseRequestedEffectSet(recomputed?.effects as never)
      expect(parsed.ok === true ? JSON.stringify(walk.requestedEffects) : 'UNPARSED').toBe(JSON.stringify((parsed as { value: unknown }).value))
      const payload = recomputed?.reviewPayload as Record<string, unknown>
      expect(walk.family).toEqual({
        familyId: payload.familyId,
        adapterRevision: payload.adapterRevision,
        providerIdentity: payload.providerIdentity,
        targetManifest: payload.targetManifest,
      })
      expect((walk.family as { familyId: string }).familyId).toBe('B-INSPECT')
      expect((walk.family as { adapterRevision: number }).adapterRevision).toBe(G1.A5_G1_ADAPTER_REVISION)
      expect((walk.family as { providerIdentity: string }).providerIdentity).toBe(world.providerId)
      // admitted: the native ran exactly once, the answer is topology-constrained
      expect(value).toMatchObject({ excludedUnauthorizedProviders: 1 })
      expect(world.natives.get('cordis_inspect_list')?.calls.length).toBe(1)
    })

    it('deny / allow+cancelled / a plane that lost its paAdmit funnel each refuse with their OWN typed bytes and ZERO native entry', async () => {
      const denied = await makeWorld({ paAnswer: async () => ({ kind: 'deny', code: 'PA_DENY_ASM', detail: 'the plane refused this walk' }) })
      const deniedAssembly = unwrap(denied.result)
      await expect(deniedAssembly.definitions[0]?.execute({}, EXEC)).rejects.toThrow(/PA_DENY_ASM/)
      expect(denied.natives.get('cordis_inspect_list')?.calls.length).toBe(0)

      const cancelled = await makeWorld({ paAnswer: async () => ({ kind: 'allow', cancelled: true }) })
      const cancelledAssembly = unwrap(cancelled.result)
      await expect(cancelledAssembly.definitions[0]?.execute({}, EXEC)).rejects.toThrow(/PA_WALK_CANCELLED/)
      expect(cancelled.natives.get('cordis_inspect_list')?.calls.length).toBe(0)

      const noFunnel = await makeWorld()
      const noFunnelAssembly = unwrap(noFunnel.result)
      // the plane handle loses its paAdmit between mount and call (a broken
      // mount, not a stub-walk invitation)
      const savedAdmit = noFunnel.planeHandle.paAdmit
      Reflect.deleteProperty(noFunnel.planeHandle, 'paAdmit')
      await expect(noFunnelAssembly.definitions[0]?.execute({}, EXEC)).rejects.toThrow(new RegExp(ASM.A5_G1_QUERY_ASSEMBLY_CODES.PA_FUNNEL_ABSENT))
      expect(noFunnel.natives.get('cordis_inspect_list')?.calls.length).toBe(0)
      Reflect.set(noFunnel.planeHandle, 'paAdmit', savedAdmit)
    })
  })

  describe('(E) placement through a REAL registration entry', () => {
    it('place() registers every wired def into the real entry (stored verbatim, captured output face intact); unplace() disposes exactly; re-place works', async () => {
      const world = await makeWorld()
      const assembly = unwrap(world.result)
      const disposers = assembly.place()
      expect(disposers.length).toBe(3)
      for (const definition of assembly.definitions) {
        const stored = world.placedCtx.tools.get(definition.name)
        expect(stored).toBe(definition)
        expect((stored as { output: unknown }).output).toBe(world.natives.get(definition.name)?.native.output)
      }
      assembly.unplace()
      expect(world.placedCtx.tools.get('cordis_inspect_list')).toBeUndefined()
      const again = assembly.place()
      expect(again.length).toBe(3)
      expect(world.placedCtx.tools.get('cordis_inspect_list')).toBeDefined()
      assembly.unplace()
    })

    it('ROOT P2 focus (REAL ToolRuntime same-layer collision): a mid-list "already registered" rolls back ONLY this call\'s completed registrations, keeps the host\'s original error intact, and re-place completes once the collision is cleared', async () => {
      const world = await makeWorld()
      const assembly = unwrap(world.result)
      // a REAL collision in the SAME placement layer: the host's own
      // registration law refuses the second same-name entry mid-list.
      const collider = world.placedCtx.tools.register(makeNative('cordis_inspect_query').native)
      let thrown: unknown
      try {
        assembly.place()
      } catch (error) {
        thrown = error
      }
      // the ORIGINAL host error survives untouched (no replacement, no reword)
      expect((thrown as Error).message).toMatch(/already registered/i)
      // the first successful item's disposer was NOT lost: it was rolled back
      expect(world.placedCtx.tools.get('cordis_inspect_list')).toBeUndefined()
      // rollback touched only THIS call's items: the collider stands untouched
      expect(world.placedCtx.tools.get('cordis_inspect_query')).toBeDefined()
      // no fake state: nothing was left claimed, a retry re-attempts the whole list…
      expect(() => assembly.place()).toThrow(/already registered/i)
      expect(world.placedCtx.tools.get('cordis_inspect_list')).toBeUndefined()
      // …and completes once the collision lifts
      collider()
      const again = assembly.place()
      expect(again.length).toBe(3)
      expect(world.placedCtx.tools.get('cordis_inspect_query')).toBe(assembly.definitions[1])
      assembly.unplace()
    })
  })

  describe('(F) registerAfterPublish: the true mint, the ONE table, the never-crossing namespaces', () => {
    it('BEFORE the install pass it THROWS P_G1_WIRE_PLACEMENT_KEY_ABSENT (never guesses); AFTER the real mint, the family table answers every def#N key with exactly the frozen trio — never the capture mint — and the call is idempotent', async () => {
      const world = await makeWorld()
      const assembly = unwrap(world.result)
      assembly.place()
      // NOT published yet: the feed answers no identity — throw, never guess
      expect(() => assembly.registerAfterPublish()).toThrow(new RegExp(WIRE.A5_G1_QUERY_WIRING_CODES.PLACEMENT_KEY_ABSENT))
      world.publish()
      const registrations = assembly.registerAfterPublish()
    expect(registrations.map((r) => r.name)).toEqual(SUBSET)
      for (const registration of registrations) {
        expect(registration.definitionIdentity).toMatch(/^def#\d+$/)
        const stored = world.placedCtx.tools.get(registration.name)
        expect(registration.definitionIdentity).toBe(String(definitionIdentityOf(stored)))
        expect(registration.definitionIdentity).not.toBe(assembly.captures[registration.name]?.definitionIdentity)
        expect(registration.entry).toEqual({
          familyId: registration.name === 'team_list_pending_control' ? 'B-CONTROL' : 'B-INSPECT',
          // FAMILY revision (root LIMITED BUILD ORDER 2026-10-25): the
          // B-CONTROL wire format moved with the full pairing — the record-
          // 85 row's registration answers 8 beside its mint; B-INSPECT stays 7.
          adapterRevision: registration.name === 'team_list_pending_control' ? G1.A5_G1_CONTROL_ADAPTER_REVISION : G1.A5_G1_ADAPTER_REVISION,
          providerIdentity: world.providerId,
        })
        // the PRODUCTION table read-back (single fill point)
        expect(REGISTRY.a5GovernedFamilyFor(registration.definitionIdentity)).toEqual(registration.entry)
      }
      expect(new Set(registrations.map((r) => r.definitionIdentity)).size).toBe(3)
      // idempotent per the registry's same-entry law
      const second = assembly.registerAfterPublish()
      expect(second.map((r) => r.definitionIdentity)).toEqual(registrations.map((r) => r.definitionIdentity))
    })
  })

  describe('(G) import closure asserted from the SOURCE TEXT', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/governed-families/g1-query-assembly.mjs'), 'utf8')
    it('the static closure is exactly [wiring, production registry, domain parser] — no adapter edge, no node:, no dynamic import', () => {
      const statics = [...source.matchAll(/^\s*import\s+(?:[\s\S]*?)\s*from\s*'([^']+)'/gm)].map((m) => String(m[1]))
      expect([...new Set(statics)].sort()).toEqual([
        '../../../../../domain/tool-governance/src/index.js',
        '../pa-mount-registry.mjs',
        './g1-query-wiring.mjs',
      ])
      expect(source.match(/(^|[^.\w])import\s*\(/m)).toBeNull()
    })

    it('no lane-private, adapter-direct, host-baseline, or node: specifier reaches the source', () => {
      const banned = [
        'g1-surface-adapters', 'team-tool-plane', 'agent-bindings', 'pre-execute-adapter',
        'tool-dispatch', '/control/', 'todo\\.mjs', 'write\\.mjs', 'image\\.mjs',
        'g2-', 'g3-', 'deepseek-harness-test-use', 'node:', '@deepseek-ai',
      ]
      for (const pattern of banned) {
        const re = new RegExp(`from\\s*'[^']*${pattern}[^']*'`)
        expect(re.test(source), `forbidden import specifier reaches the source: ${pattern}`).toBe(false)
      }
    })
  })
})
