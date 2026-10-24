/**
 * A5M2-G1-WIRE (root ruling 15:28: 工具适配不等待中心接线) — the committed
 * G1 captured-native-delegate adapter rows WIRED into the production tool
 * plane along the established governed-row pattern, assembly level.
 *
 * What this spec proves (and NOTHING more):
 *  - the closed `g1Enabled` key + `backends.g1` injection obey the SAME
 *    pairing law as todo/write/image (both directions refused; a non-boolean
 *    gate is a config defect; zero flip with the key absent);
 *  - Gate 0f keeps the four-tier law in CODE: the PURE-QUERY trio
 *    (`cordis_inspect_list` 53, `cordis_inspect_query` 54,
 *    `team_list_pending_control` 85) is the closed placement table; the other
 *    eleven records stay declared/INACTIVE and a mount that tries to place
 *    one is refused, as is a declared (no-capture) row — measured at BOTH
 *    levels (the module's own refusal and the plane's refusal);
 *  - placement at the FIXED native spellings carries the CAPTURED native
 *    description/parameters bytes verbatim (the captures are built with the
 *    REAL host `defineTool` from the pinned baseline, so `parameters` is the
 *    canonical JSON Schema the host face publishes — never re-lifted), and
 *    the placement feed answers the RUNTIME (placed-def) definition identity
 *    the seam minted for each placed row — strictly separate from the
 *    capture-side identity the adapter's review payload carries;
 *  - the wired trio walks THIS plane's ONE PA admission (shared token
 *    ledger, ONE correlation per flight, the real durable Control row through
 *    the real ControlService, the REAL open plus the fresh final edge's
 *    consumedProof as the ONLY door to the row body — admit `ok` alone is
 *    never a consumption, exactly the G2-wire precedent — the ONE-shot
 *    consumption, the fresh recheck at the edge), and the BODY is the
 *    adapter row's own `delegate` entering the captured native face exactly
 *    once — including the CURRENT-facts law: a topology that moves during
 *    the approval wait refuses AFTER consumption with zero native entry;
 *  - exception paths leave NO residue: a refused call creates no row and
 *    never enters native, a cancelled call creates no row, the consumed
 *    stale plan never enters native and never re-runs, every refusal/cancel
 *    settles its token;
 *  - ENABLEMENT (root 17:55, strict variant source 7529218e5): the two
 *    B-INSPECT rows are registered at MOUNT time keyed by the RUNTIME
 *    placement identity (the `publishPaMount` / `placementFeed` /
 *    `registerA5GovernedFamily` law the agent-bindings mount moment runs) and
 *    their walk carries the FULL family block; the non-enabled
 *    `team_list_pending_control` row keeps its plain PA walk with ZERO
 *    movement; and the two root-required fixed points are pinned over that
 *    SAME real chain — (1) SAME-CALL IDENTITY (the durable record, the
 *    registered definition identity and the minted variant leaf all trace to
 *    ONE classify/plan call; moved/mixed-origin feeds refuse before anything
 *    durable) and (2) STALE-REVISION REFUSAL (a durable approval carrying the
 *    retired adapterRevision 6 refuses CONSUMPTION at the PA walk, pinned
 *    drifted wording, zero consumption — retired encodings are never
 *    silently translated; the pre-variant shape's refusal is a GRAMMAR fact
 *    at the validator, measured but never claimed as a consumption event);
 *  - the three pre-existing target rules (B-SESSION/B-WRITE/B-IMAGE) are
 *    byte-identical: their own targets still pass, the B-INSPECT leaves are
 *    refused as foreign keys there;
 *  - the MOUNT-ARM section (center 01:1x/01:4x; agent-bindings `g1PureQuery`
 *    block) drives the G1-WIRE lane's REAL production assembly module
 *    (`createG1QueryAssembly` → `place()` → `registerAfterPublish()`) through
 *    a seam bag that MIRRORS the block's seams one-for-one (live scoped
 *    registry reads, the per-row live binding-facts reader law, the five
 *    trusted TARGETS facts, the placement feed answering the RUNTIME identity
 *    of the placed def, the plane's REAL paAdmit funnel): the minted
 *    `def#N`-class identities are the REAL `definitionIdentityOf` mints, the
 *    family rows are written through the PRODUCTION registry table, and the
 *    wired def then walks the SAME real ControlService chain end to end. The
 *    arm block itself lives inside `createAgentBindings`, which no in-repo
 *    spec has ever driven (it needs a live Host agent ctx — the
 *    a5m2-provider-identity-c1 FP-B disclosure, verbatim law): so the block's
 *    OWN code is pinned at source level there, and its runtime behavior on a
 *    real Host mount stays a Host verification point, never a claim here.
 *
 * Disclosure (the lane/bridge specs own the REAL halves): the native
 * definitions are host-`defineTool` products whose bodies mirror the pinned
 * published law (tool-cordis index.ts: the list answers
 * `{ providers: ctx.cordisInspect.list() }`; the team pending list mirrors
 * listPendingControlSpec's `pending-control-listed` shape and the Leader-
 * only law is owned by the lane spec) — the REAL host registry answers are
 * Host-side acceptance (接线未测 until the Host window runs; assembly legs
 * never mint 已测试). NO Host, NO network, NO :3080; worlds are
 * workspace-internal and removed after.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-wire-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createBlueprintCatalog, parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { canonicalJsonFingerprint, parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { ToolBinding } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { parsePaControlManifest, validatePaFamilyTarget } from '../control/types.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { definitionIdentityOf, untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import {
  createPaControlLeg,
  createPaEffectsVerifier,
} from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_NOW,
  P6T4_ROOT,
  leaderCaller,
  memberCaller,
  p6t4Seed,
} from './p6t4-helpers.js'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g1-wire: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-g1-wire-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── REAL host products from the pristine baseline (r9 pattern; fail closed) ─
const HOST_TOOLS_LIB = join(REPO, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
if (!existsSync(HOST_TOOLS_LIB)) throw new Error(`pristine host tools lib absent (${HOST_TOOLS_LIB}); failing closed`)
const HOST_TOOLS = (await import(pathToFileURL(HOST_TOOLS_LIB).href)) as unknown as {
  defineTool: (options: Record<string, unknown>) => HostNativeDef
  validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
}
interface HostNativeDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => unknown[] }
  execute: (args: never, exec: Record<string, unknown>) => Promise<unknown>
}

// ── the plane + the committed G1 adapter module (hand-cast per convention) ─
const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => PlaneResult
  A5_G1_PURE_QUERY_MOUNT_NAMES: readonly ['cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control']
}
const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as {
  A5_G1_RECORD_SPECS: Record<string, { family: string; recordIndex: number; capture: string }>
  A5_G1_ADAPTER_REVISION: number
  mountG1SurfaceAdapter: (recordName: string, deps: Record<string, unknown>) => G1Row
}
interface G1Classified {
  ok: boolean
  code?: string
  detail?: string
  plan?: unknown
  effects?: unknown
  parametersFingerprint?: string
  reviewPayload?: {
    familyId: string
    adapterRevision: number
    providerIdentity: string
    definitionIdentity: string | null
    targetManifest: Record<string, unknown>
  }
}
interface G1Row {
  name: string
  familyId: string
  recordIndex: number
  capturePresent: boolean
  description: string | null
  parameters: Record<string, unknown> | null
  definitionIdentity: string | null
  classify: (args: unknown, callId: string) => G1Classified
  delegate: (plan: unknown, ctx: { exec?: Record<string, unknown> }) => Promise<{ ok: boolean; code?: string; detail?: string; value?: unknown; settled?: string }>
}

interface PlaneAssemblyValue {
  ownNames: readonly string[]
  definitions: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
    output?: { schema: unknown; render: unknown }
    execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
  }>
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
  backends: { g1?: G1Row[] }
  g1PlacementTruth: () => ReadonlyArray<{ recordName: string; familyId: string; recordIndex: number; state: string; why?: string; adapterRevision?: number }>
}
interface PlaneResult {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssemblyValue
}

// ── the ONE durable world (real TeamDomain rows + real ControlService) ────
const CHAIN_WORLD = worldDir('chain')
const seam = new FileStorageSeam(CHAIN_WORLD)
const domain = await createTeamDomain(seam)
const blueprint = parseBlueprint(P6T4_BLUEPRINT_SOURCE)
const catalog = createBlueprintCatalog([blueprint])
const repos = domain.repositories
await repos.teamSessions.put({
  rootSessionId: P6T1_FIXTURE.rootSessionId,
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId(String(blueprint.blueprintId)),
    revision: parseBlueprintRevision(String(blueprint.revision)),
    contentHash: parseBlueprintContentHash(String(blueprint.contentHash)),
  }),
  defaultWorkspace: P6T1_FIXTURE.defaultWorkspace,
  createdAt: P6T1_FIXTURE.createdAt,
  generation: 1,
})
await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: P6T1_FIXTURE.rootSessionId })
const WORKER = String(p6t4Seed('worker').instanceId)
for (const name of ['leader', 'worker'] as const) {
  const seed = p6t4Seed(name)
  await repos.memberInstances.put({
    rootSessionId: P6T1_FIXTURE.rootSessionId,
    instanceId: parseInstanceId(String(seed.instanceId)),
    templateId: parseTemplateId(String(seed.templateId)),
    label: String(seed.label),
    childSessionId: parseChildSessionId(String(seed.childSessionId)),
    lifecycle: 'RUNNING',
    createdAt: P6T1_FIXTURE.createdAt,
    activityVersion: 1,
  })
}

const HEADER_ID = 'ses-a5m2-g1-header'
const PROVIDER_ID = 'a5p5-plane'
const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})
function factSlot(slot: unknown): PaCallFactsCeilingSlot | undefined {
  if (slot === null || typeof slot !== 'object') return undefined
  if ('status' in (slot as Record<string, unknown>) && (slot as { status?: string }).status === 'unavailable') return undefined
  return slot as PaCallFactsCeilingSlot
}

const registryModule = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  A5_GOVERNED_FAMILIES: Record<string, { familyId: string; adapterRevision: number; providerIdentity: string }>
  a5GovernedFamilyFor: (definitionIdentity: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
  registerA5GovernedFamily: (definitionIdentity: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
}
const familyTable = registryModule.A5_GOVERNED_FAMILIES
const a5GovernedFamilyFor = registryModule.a5GovernedFamilyFor
const registerA5GovernedFamily = registryModule.registerA5GovernedFamily

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly; plane?: PlaneAssemblyValue }
const realmTruths = new Map<string, RealmTruth>()

const verifierReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
  const truth = realmTruths.get(input.manifest.realmId)
  if (truth === undefined) return undefined
  if (input.rootSessionId !== P6T4_ROOT) return undefined
  const durable = repos.memberInstances.get(P6T4_ROOT, input.manifest.member.instanceId)
  if (durable === undefined) return undefined
  const binding = parseToolBinding({ ...input.manifest.binding })
  if (!binding.ok) return undefined
  const effects = parseRequestedEffectSet(input.manifest.effects)
  if (!effects.ok) return undefined
  const request: AdmissionRequest = Object.freeze({
    binding: binding.value,
    member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) }),
    callId: input.manifest.callId,
    realmId: input.manifest.realmId,
    parametersFingerprint: input.manifest.parametersFingerprint,
    requestedEffects: effects.value as RequestedEffectSet,
  })
  const livePlan = truth.assembly.planApproval(request)
  if (!livePlan.ok) return undefined
  const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
  const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  const family = a5GovernedFamilyFor(String(binding.value.definitionIdentity))
  return {
    policySource: { staticLayerRefs: ['a5m2-g1-wire-tpl:directive-policy'], overlayGeneration: 0 },
    realmId: input.manifest.realmId,
    ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
    policyDocument: truth.assembly.policyDocument(),
    denySources: truth.assembly.denySources(),
    effects: effects.value as RequestedEffectSet,
    member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
    beneficiaryAuthority: 'member',
    binding: binding.value,
    blueprint: {
      revision: String(blueprint.revision),
      contentHash: String(blueprint.contentHash),
      templateId: 'a5m2-g1-wire-tpl',
      cwd: CHAIN_WORLD,
      providerVersion: PROVIDER_ID,
    },
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
    authorityGeneration: 0,
    ...(family === undefined ? {} : { governedFamily: family }),
  }
}
// The verifier's own observe stream: the ONLY place the drift WORDING is
// emitted on this chain (the durable row carries the closed reason constant,
// never prose), so the exact pinned detail must come from here.
const verifierObserved: Array<Record<string, unknown>> = []
const paVerifier = createPaEffectsVerifier({
  readCallFacts: verifierReadCallFacts,
  onObserve: (row) => { verifierObserved.push(row as unknown as Record<string, unknown>) },
})

const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: paVerifier,
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
async function stateNow() {
  return service.listControlState(P6T4_ROOT)
}
async function waitRowForCall(callId: string, timeoutMs = 20_000): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = (await stateNow()).requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === callId)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error(`the durable control row for ${callId} never appeared`)
    await sleep(25)
  }
}

// ── the REAL host face products (defineTool @ the pinned baseline) ─────────
// The captures the adapter rows govern are built with the host's OWN
// defineTool, so `parameters` is the canonical JSON Schema the pinned face
// publishes (never re-lifted) and `output { schema, render }` is the pair the
// injection carries (the adapter row captures description/parameters, not
// output — the plane invents none, so the integrator supplies the CAPTURED
// pair, verbatim from the same product).
const INSPECT_LIST_DESCRIPTION = 'List every Cordis Inspect Provider currently known to the Host (pinned face mirror).'
const INSPECT_QUERY_DESCRIPTION = 'Run a read-only query declared by an Inspect Provider (pinned face mirror).'
const PENDING_LIST_DESCRIPTION = 'List this Team unresolved approvals across every carrier (lane face mirror; Leader-only law owned by the lane spec).'

interface InspectTopology { topologyRevision: number; topologyDigest: string; allowed: Array<{ platform: string; provider: string; method: string }> }

interface NativeCall { args: Record<string, unknown>; exec: Record<string, unknown> }
interface TrioBag<T> { cordis_inspect_list: T; cordis_inspect_query: T; team_list_pending_control: T }

function makeCaptures(topology: () => InspectTopology) {
  const nativeCalls: TrioBag<NativeCall[]> = {
    cordis_inspect_list: [], cordis_inspect_query: [], team_list_pending_control: [],
  }
  const PROVIDERS = [
    { platform: 'host', id: 'dsh_compute', purpose: 'compute', methods: [{ name: 'compute_health' }, { name: 'compute_list_jobs' }] },
    { platform: 'host', id: 'rogue-provider', purpose: 'unauthorized', methods: [{ name: 'anything' }] },
  ]
  const listDef = HOST_TOOLS.defineTool({
    name: 'cordis_inspect_list',
    description: INSPECT_LIST_DESCRIPTION,
    parameters: {},
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: JSON.stringify(v) }] },
    execute(_args: Record<string, unknown>, _exec: Record<string, unknown>) {
      nativeCalls.cordis_inspect_list.push({ args: {}, exec: _exec })
      // The pinned host law (tool-cordis index.ts): the REAL list enumerates
      // ALL providers; the row's constraint is the adapter's own work.
      return Promise.resolve({ providers: PROVIDERS.map((p) => ({ ...p })) })
    },
  })
  const queryDef = HOST_TOOLS.defineTool({
    name: 'cordis_inspect_query',
    description: INSPECT_QUERY_DESCRIPTION,
    parameters: {
      platform: { type: 'string', required: true, enum: ['host', 'client'], description: 'Runtime platform that owns the Provider.' },
      provider: { type: 'string', required: true, description: 'Exact Provider ID returned by cordis_inspect_list.' },
      method: { type: 'string', required: true, description: 'Exact method name declared by the Provider manifest.' },
      input: { type: 'json', description: 'Optional query input.' },
    },
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: JSON.stringify(v) }] },
    async execute(args: { platform: string; provider: string; method: string }, exec: Record<string, unknown>) {
      nativeCalls.cordis_inspect_query.push({ args: { ...args }, exec })
      return { platform: args.platform, provider: args.provider, method: args.method, answer: 'provider-answer' }
    },
  })
  const pendingDef = HOST_TOOLS.defineTool({
    name: 'team_list_pending_control',
    description: PENDING_LIST_DESCRIPTION,
    parameters: {
      rootSessionId: { type: 'string', required: true, description: 'The Team root session id.' },
      requestToken: { type: 'string', required: true, description: 'The invocation request token.' },
      limit: { type: 'integer', description: 'Optional page size.' },
    },
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: JSON.stringify(v) }] },
    async execute(args: { rootSessionId: string; limit?: number }, exec: Record<string, unknown>) {
      nativeCalls.team_list_pending_control.push({ args: { ...args }, exec })
      // Mirror of listPendingControlSpec's published return (tools.ts:1186-
      // 1191): the ledger page rides the same shape; the REAL ledger + the
      // Leader-only caller law are owned by the lane spec.
      const page = [{ requestId: 'req-mirror-1', status: 'pending', requestSequence: 1 }]
      const limit = args.limit ?? 50
      return { status: 'pending-control-listed', rootSessionId: args.rootSessionId, pending: page.slice(0, limit), count: Math.min(page.length, limit), truncated: page.length > limit }
    },
  })
  void topology
  return { defs: { cordis_inspect_list: listDef, cordis_inspect_query: queryDef, team_list_pending_control: pendingDef }, nativeCalls }
}

const TOPOLOGY_BASE: InspectTopology = {
  topologyRevision: 9,
  topologyDigest: 'sha256;toponine',
  allowed: [
    { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
    { platform: 'host', provider: 'dsh_compute', method: 'compute_list_jobs' },
    { platform: 'client', provider: 'page', method: 'activity' },
  ],
}

const TRUSTED_FOR = (realmId: string) => ({
  memberAgentId: WORKER,
  sessionHeaderId: HEADER_ID,
  realmId,
  owner: P6T4_ROOT,
  profileId: 'profile-a5m2-g1',
})
const BINDING_FACTS = (label: string) => () => ({
  bindingId: `a5m2-g1-wire:${label}`,
  bindingRevision: 1,
  policyGeneration: 0,
  authorityGeneration: 0,
})

type PlaneDef = PlaneAssemblyValue['definitions'][number]
interface Mounted {
  plane: PlaneAssemblyValue
  defs: TrioBag<PlaneDef>
  nativeDefs: TrioBag<HostNativeDef>
  nativeCalls: TrioBag<NativeCall[]>
  topology: { current: InspectTopology }
  observed: string[]
  legInputs: Record<string, unknown>[]
  familyKeys: TrioBag<string>
}
const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(key: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(key)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

async function mountWorld(label: string, over: { plane?: Record<string, unknown>; backends?: Record<string, unknown>; topologyStart?: InspectTopology; g1Rows?: 'mounted' | 'none' } = {}): Promise<Mounted> {
  const realmId = `a5m2-g1-wire-${label}`
  const topology = { current: over.topologyStart ?? structuredClone(TOPOLOGY_BASE) }
  const { defs: nativeDefs, nativeCalls } = makeCaptures(() => topology.current)
  const ports = { trustedTopology: { current: () => topology.current } }
  // `g1Rows: 'none'` builds the SAME real chain (control leg, readCallFacts,
  // verifier) WITHOUT the plane's own g1 row injection: the MOUNT-ARM world —
  // there the rows are placed by the G1-WIRE production assembly module
  // through the registry face, and only its PA seat consults this plane's
  // paAdmit funnel (agent-bindings g1PureQuery route, center 01:4x).
  const entries = over.g1Rows === 'none' ? [] : (['cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control'] as const).map((recordName) => {
    const row = G1.mountG1SurfaceAdapter(recordName, {
      native: nativeDefs[recordName],
      providerId: PROVIDER_ID,
      definitionIdentity: `a5p5-plane@639ed01539#${recordName}`,
      trusted: TRUSTED_FOR(realmId),
      bindingFacts: BINDING_FACTS(label),
      ...(recordName === 'team_list_pending_control' ? {} : { ports }),
    })
    return { row, output: nativeDefs[recordName].output }
  })
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-g1-wire-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: over.g1Rows === 'none' ? { ...(over.plane ?? {}) } : { g1Enabled: true, ...(over.plane ?? {}) },
    backends: over.g1Rows === 'none' ? { ...(over.backends ?? {}) } : { g1: { rows: entries }, ...(over.backends ?? {}) },
    authorityFacts: {
      overlayGeneration: async () => 0,
      ensureAuthorityCurrent: async () => {},
    },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput as Record<string, unknown>)
      return createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
    },
    readCallFacts: async (input: Record<string, unknown>) => {
      const truth = realmTruths.get(String(input.realmId))
      if (truth === undefined) return undefined
      if (String(input.rootSessionId) !== P6T4_ROOT) return undefined
      const durable = repos.memberInstances.get(P6T4_ROOT, String(input.instanceId))
      if (durable === undefined) return undefined
      const binding = bindingOf(`${label}:${String(input.placementName ?? '')}`)
      if (binding === undefined) return undefined
      const rawEffects = (input.requestedEffects as { effects?: unknown[] } | undefined)?.effects ?? input.requestedEffects
      const effects = parseRequestedEffectSet(rawEffects as unknown[])
      if (!effects.ok) return undefined
      const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
      const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
      if (hard === undefined || mutation === undefined) return undefined
      const family = a5GovernedFamilyFor(String(binding.definitionIdentity))
      const livePlan = truth.plane?.livePaPlan.get(String(input.callId))
      return {
        kind: livePlan === undefined ? 'no-approval-question' : 'call-facts',
        facts: {
          policySource: { staticLayerRefs: ['a5m2-g1-wire-tpl:directive-policy'], overlayGeneration: 0 },
          realmId: String(input.realmId),
          ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
          policyDocument: truth.assembly.policyDocument(),
          denySources: truth.assembly.denySources(),
          effects: (livePlan?.requestedEffects as RequestedEffectSet | undefined) ?? (effects.value as RequestedEffectSet),
          member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
          beneficiaryAuthority: 'member',
          binding,
          blueprint: {
            revision: String(blueprint.revision),
            contentHash: String(blueprint.contentHash),
            templateId: 'a5m2-g1-wire-tpl',
            cwd: CHAIN_WORLD,
            providerVersion: PROVIDER_ID,
          },
          ...(livePlan === undefined ? {} : {
            planSnapshot: {
              approvalCaseId: livePlan.approvalCaseId,
              effectSetFingerprint: livePlan.effectSetFingerprint,
              perEffectRequired: livePlan.perEffectRequired,
            },
          }),
          authorityGeneration: 0,
          ...(family === undefined ? {} : { governedFamily: family }),
        },
      }
    },
    onObserve: (row: string) => { observed.push(String(row)) },
  })
  if (built.ok !== true || built.value === undefined) {
    throw new Error(`plane assembly refused (${String(built.code)}): ${String(built.message)}`)
  }
  const plane = built.value
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })
  const defs = {
    cordis_inspect_list: undefined as unknown as PlaneDef,
    cordis_inspect_query: undefined as unknown as PlaneDef,
    team_list_pending_control: undefined as unknown as PlaneDef,
  } satisfies TrioBag<PlaneDef>
  const familyKeys = {
    cordis_inspect_list: '',
    cordis_inspect_query: '',
    team_list_pending_control: '',
  } satisfies TrioBag<string>
  for (const recordName of over.g1Rows === 'none' ? [] : ['cordis_inspect_list', 'cordis_inspect_query', 'team_list_pending_control'] as const) {
    const fed = plane.placementFeed(recordName)
    const identity = String(fed?.definitionIdentity ?? '')
    if (identity.length === 0) throw new Error(`the placed ${recordName} row answered no placement definition identity`)
    // PLACED-def identity (the seam minted it AFTER plane construction) —
    // strictly separate from the CAPTURE-side identity the adapter carries
    // (`a5p5-plane@639ed01539#<name>` above); family/registration keys are
    // ALWAYS the placed-def identity, never the capture identity.
    familyKeys[recordName] = identity
    // ENABLEMENT (root 17:55 INSPECT ENABLEMENT): the two B-INSPECT rows are
    // registered AT MOUNT TIME keyed by the RUNTIME placement identity — the
    // same law the todo/image wire worlds and agent-bindings publishPaMount
    // run (never the capture-side identity, never a hand-spelled key).
    // team_list_pending_control (B-CONTROL) is NOT enabled: the pending row
    // stays unregistered and its walk stays the plain PA row.
    if (recordName === 'cordis_inspect_list' || recordName === 'cordis_inspect_query') {
      registerA5GovernedFamily(identity, {
        familyId: 'B-INSPECT',
        adapterRevision: G1.A5_G1_ADAPTER_REVISION,
        providerIdentity: PROVIDER_ID,
      })
    }
    // The binding tuple is the ordinary plane placement binding.
    bindingFixtures.set(`${label}:${recordName}`, parseToolBinding({
      bindingId: `a5m2-g1-wire:${label}`,
      agentScopeKey: `a5m2-g1-wire:${label}`,
      toolName: recordName,
      definitionIdentity: identity,
      providerId: PROVIDER_ID,
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host', plane.realmId),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    }))
    const def = plane.definitions.find((d) => d.name === recordName)
    if (def === undefined) throw new Error(`the mounted plane carries no ${recordName} definition`)
    defs[recordName] = def
  }
  return { plane, defs, nativeDefs, nativeCalls, topology, observed, legInputs, familyKeys }
}

function execFor(callId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: { id: WORKER, session: { header: { id: HEADER_ID } } },
    token: Symbol(`exec-${callId}`),
    // The real 639 public ToolExecution carries a callId too — the adapter
    // row's swapped-execution guard compares against it.
    callId: `toolu-${callId}`,
    ...over,
  }
}

describe('A5M2-G1-WIRE C1: the pure-query adapter rows mount, walk the ONE PA path, and enter the captured native face once (assembly legs: 接线未测 pending Host, never 已测试)', () => {
  it('gate law: zero flip without the key, closed-key pairing both directions, non-boolean gate refused', () => {
    const bare = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY,
      realmId: 'a5m2-g1-wire-bare',
      templateId: 'a5m2-g1-wire-tpl',
      role: 'member',
      instanceId: WORKER,
      teamSessionId: P6T4_ROOT,
    })
    expect(bare.ok).toBe(true)
    const plane = bare.value as PlaneAssemblyValue
    for (const name of planeModule.A5_G1_PURE_QUERY_MOUNT_NAMES) {
      expect(plane.ownNames).not.toContain(name)
    }
    const truth = plane.g1PlacementTruth()
    expect(truth).toHaveLength(14)
    expect(truth.filter((t) => t.state === 'unplaced')).toHaveLength(3)
    expect(truth.filter((t) => t.state === 'declared')).toHaveLength(11)
    expect(truth.every((t) => t.state === 'placed' || (typeof t.why === 'string' && t.why.length > 0))).toBe(true)

    const gateOnly = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'r-gateonly', templateId: 't', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { g1Enabled: true },
    })
    expect(gateOnly.ok).toBe(false)
    expect(gateOnly.code).toBe('G1_ROW_INJECT_INVALID')
    expect(String(gateOnly.message)).toContain('nothing behind them')

    const injectOnly = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'r-injectonly', templateId: 't', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      backends: { g1: { rows: [{ row: { name: 'cordis_inspect_list' }, output: { schema: {}, render: () => [] } }] } },
    })
    expect(injectOnly.ok).toBe(false)
    expect(injectOnly.code).toBe('G1_ROW_INJECT_INVALID')
    expect(String(injectOnly.message)).toContain('config law, not wiring')

    const badGate = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'r-badgate', templateId: 't', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { g1Enabled: 'yes' },
    })
    expect(badGate.ok).toBe(false)
    expect(badGate.code).toBe('PLANE_CFG_INVALID')
  })

  it('Gate 0f keeps the eleven rows declared/INACTIVE: the module refusal and the plane refusal are both measured', async () => {
    // MODULE level: the declared posture the module spells — a no-capture row
    // refuses every call, typed, zero native entry, no re-resolution.
    const declared = G1.mountG1SurfaceAdapter('cordis_inspect_list', {
      providerId: PROVIDER_ID,
      trusted: TRUSTED_FOR('realm-declared'),
      bindingFacts: BINDING_FACTS('declared'),
    })
    expect(declared.capturePresent).toBe(false)
    const refusal = declared.classify({}, 'call-declared')
    expect(refusal.ok).toBe(false)
    expect(refusal.code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
    const delegRefusal = await declared.delegate(refusal.plan ?? {}, { exec: {} })
    expect(delegRefusal.ok).toBe(false)
    expect(delegRefusal.code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')

    // MODULE level: the dependency arm stays CLOSED as the module spells it
    // (record 25 named gap: the exported controlled-install path is not
    // mounted anywhere this tree can observe): refuse typed, zero native entry.
    const depNative = HOST_TOOLS.defineTool({
      name: 'load_workspace_dependencies',
      description: 'mirror',
      parameters: {},
      output: { schema: { type: 'json' }, render: () => [] },
      execute: () => Promise.resolve({ unexpected: true }),
    })
    const depRow = G1.mountG1SurfaceAdapter('load_workspace_dependencies', {
      native: depNative,
      providerId: PROVIDER_ID,
      definitionIdentity: 'a5p5-plane@639ed01539#load_workspace_dependencies',
      trusted: TRUSTED_FOR('realm-dep'),
      bindingFacts: BINDING_FACTS('dep'),
      ports: { dependencyFacts: { current: () => ({ sourceLocator: '/srv/src', rootLocator: '/srv/root' }) } },
    })
    const depPlan = depRow.classify({}, 'call-dep')
    expect(depPlan.ok).toBe(true)
    const depRun = await depRow.delegate(depPlan.plan, { exec: {} })
    expect(depRun.ok).toBe(false)
    expect(depRun.code).toBe('P_G1_DEPENDENCY_ARM_CLOSED')

    // PLANE level: injecting a declared row is refused — a declared row is
    // never placed as a live tool.
    const planeDeclared = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'r-declared', templateId: 't', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { g1Enabled: true },
      backends: { g1: { rows: [{ row: declared, output: { schema: {}, render: () => [] } }] } },
    })
    expect(planeDeclared.ok).toBe(false)
    expect(planeDeclared.code).toBe('G1_ROW_INJECT_INVALID')
    expect(String(planeDeclared.message)).toContain('DECLARED/INACTIVE')

    // PLANE level: a CAPTURED row outside the pure-query set (plugin_manager,
    // whose Host escalation chain is unobservable here) is refused by name.
    const pmNative = HOST_TOOLS.defineTool({
      name: 'plugin_manager',
      description: 'mirror',
      parameters: { action: { type: 'string', required: true } },
      output: { schema: { type: 'json' }, render: () => [] },
      execute: () => Promise.resolve({}),
    })
    const pmRow = G1.mountG1SurfaceAdapter('plugin_manager', {
      native: pmNative,
      providerId: PROVIDER_ID,
      definitionIdentity: 'a5p5-plane@639ed01539#plugin_manager',
      trusted: TRUSTED_FOR('realm-pm'),
      bindingFacts: BINDING_FACTS('pm'),
    })
    expect(pmRow.capturePresent).toBe(true)
    const planePm = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'r-pm', templateId: 't', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { g1Enabled: true },
      backends: { g1: { rows: [{ row: pmRow, output: pmNative.output }] } },
    })
    expect(planePm.ok).toBe(false)
    expect(planePm.code).toBe('G1_ROW_INJECT_INVALID')
    expect(String(planePm.message)).toContain('PURE-QUERY placement set')
  })

  it('Gate 0f validates rows against the FROZEN dispatch index: no guessed names, no disagreeing rows, no invented faces', () => {
    const base = { permissionPolicy: DIRECT_POLICY, templateId: 't', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT }
    const outFace = { schema: {}, render: () => [] }
    const guessed = planeModule.createTeamToolPlaneAssembly({
      ...base, realmId: 'r-guess', plane: { g1Enabled: true },
      backends: { g1: { rows: [{ row: { name: 'cordis_inspect', familyId: 'B-INSPECT', recordIndex: 53, capturePresent: true, description: 'x', parameters: {}, classify: () => ({}), delegate: async () => ({ ok: true }) }, output: outFace }] } },
    })
    expect(guessed.ok).toBe(false)
    expect(String(guessed.message)).toContain('not one of the 14 frozen G1 records')

    const disagreeing = planeModule.createTeamToolPlaneAssembly({
      ...base, realmId: 'r-disagree', plane: { g1Enabled: true },
      backends: { g1: { rows: [{ row: { name: 'team_list_pending_control', familyId: 'B-SKILL', recordIndex: 85, capturePresent: true, description: 'x', parameters: {}, classify: () => ({}), delegate: async () => ({ ok: true }) }, output: outFace }] } },
    })
    expect(disagreeing.ok).toBe(false)
    expect(String(disagreeing.message)).toContain('must MATCH the frozen index entry')

    const noRender = planeModule.createTeamToolPlaneAssembly({
      ...base, realmId: 'r-norender', plane: { g1Enabled: true },
      backends: { g1: { rows: [{ row: { name: 'cordis_inspect_list', familyId: 'B-INSPECT', recordIndex: 53, capturePresent: true, description: 'x', parameters: {}, classify: () => ({}), delegate: async () => ({ ok: true }) }, output: { schema: {} } }] } },
    })
    expect(noRender.ok).toBe(false)
    expect(String(noRender.message)).toContain('output face')

    const emptyRows = planeModule.createTeamToolPlaneAssembly({
      ...base, realmId: 'r-empty', plane: { g1Enabled: true },
      backends: { g1: { rows: [] } },
    })
    expect(emptyRows.ok).toBe(false)
    expect(String(emptyRows.message)).toContain('NON-EMPTY')
  })

  it('placement: the trio mounts at the FIXED native spellings, carries the captured faces verbatim, and the feed answers the runtime identity', async () => {
    const world = await mountWorld('place')
    for (const name of planeModule.A5_G1_PURE_QUERY_MOUNT_NAMES) {
      expect(world.plane.ownNames).toContain(name)
    }
    const listDef = world.defs.cordis_inspect_list
    expect(listDef.description).toBe(INSPECT_LIST_DESCRIPTION)
    // The canonical JSON Schema the host defineTool produced — mounted BY
    // REFERENCE (the SAME object the capture carries), never re-lifted,
    // never plane-invented; the description rides verbatim too.
    expect(listDef.parameters).toBe(world.nativeDefs.cordis_inspect_list.parameters)
    expect(listDef.description).toBe(world.nativeDefs.cordis_inspect_list.description)
    expect(typeof listDef.parameters).toBe('object')
    expect(listDef.output).toBeDefined()
    const identities: string[] = planeModule.A5_G1_PURE_QUERY_MOUNT_NAMES.map((name) => world.familyKeys[name])
    expect(new Set(identities).size).toBe(3)
    expect(identities.every((id) => id.length > 0)).toBe(true)
    // placed vs captured identity STRICTLY separated: the feed answers the
    // RUNTIME placed-def identity, never the capture-side string.
    expect(identities.some((id) => id === 'a5p5-plane@639ed01539#cordis_inspect_list')).toBe(false)
    // ENABLEMENT registration state: the two B-INSPECT rows are registered
    // AT MOUNT TIME keyed by the PLACED identity; the pending row (B-CONTROL,
    // not enabled) is not; the capture-side identity never carries a
    // registration (that would be a second, drift-prone key).
    expect(a5GovernedFamilyFor(world.familyKeys.cordis_inspect_list)).toEqual({ familyId: 'B-INSPECT', adapterRevision: G1.A5_G1_ADAPTER_REVISION, providerIdentity: PROVIDER_ID })
    expect(a5GovernedFamilyFor(world.familyKeys.cordis_inspect_query)).toEqual({ familyId: 'B-INSPECT', adapterRevision: G1.A5_G1_ADAPTER_REVISION, providerIdentity: PROVIDER_ID })
    expect(a5GovernedFamilyFor(world.familyKeys.team_list_pending_control)).toBeUndefined()
    expect(a5GovernedFamilyFor('a5p5-plane@639ed01539#cordis_inspect_list')).toBeUndefined()
    const truth = world.plane.g1PlacementTruth()
    expect(truth.filter((t) => t.state === 'placed')).toHaveLength(3)
    expect(truth.filter((t) => t.state === 'placed').every((t) => t.adapterRevision === G1.A5_G1_ADAPTER_REVISION)).toBe(true)
    expect(truth.filter((t) => t.state === 'declared')).toHaveLength(11)
    expect(world.plane.backends.g1).toHaveLength(3)
  })

  it('cordis_inspect_list end to end: real durable row, allow, ONE consumption, the captured native entered ONCE, the answer constrained to the authorized topology', async () => {
    const world = await mountWorld('list')
    const correlation = `plane-g1:${world.plane.realmId}-cordis_inspect_list-1`
    const running = world.defs.cordis_inspect_list.execute({}, execFor('call-list'))
    const row = await waitRowForCall(correlation)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest).toBeDefined()
    expect(String(manifest?.callId)).toBe(correlation)
    // ENABLED INSPECT pair (root 17:55): the walk carries the family block
    // and the DURABLE row carries it at FULL VALUE — the rev-7 discriminated
    // target, byte-exact against the grammar's bound constants (measured via
    // the pinned validator in the grammar-facts leg). The block, the
    // fingerprint and the plan all come from the SAME classify call.
    expect(manifest?.familyId).toBe('B-INSPECT')
    expect(manifest?.adapterRevision).toBe(G1.A5_G1_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(PROVIDER_ID)
    expect(manifest?.targetManifest).toEqual({
      topologyRevision: TOPOLOGY_BASE.topologyRevision,
      topologyDigest: TOPOLOGY_BASE.topologyDigest,
      inspectVariant: 'list',
      listLaw: 'the real list enumerates ALL providers; the row constrains that answer to the CURRENT authorized topology — unauthorized providers never appear',
      trustedMemberAgentId: WORKER,
      trustedSessionHeaderId: HEADER_ID,
      trustedRealmId: world.plane.realmId,
      trustedOwner: P6T4_ROOT,
      trustedProfileId: 'profile-a5m2-g1',
    })
    expect(world.legInputs[0]).toHaveProperty('family')
    expect(String(manifest?.parametersFingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(JSON.stringify(manifest?.effects)).toContain('cordis_inspect_list')
    expect(row.status).toBe('pending')

    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = (await running) as { providers: Array<{ id: string; methods: Array<{ name: string }> }>; excludedUnauthorizedProviders: number }
    expect(value.excludedUnauthorizedProviders).toBe(1)
    expect(value.providers.map((p) => p.id)).toEqual(['dsh_compute'])
    expect(value.providers[0]?.methods.map((m) => m.name)).toEqual(['compute_health', 'compute_list_jobs'])
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(1)
    const state = await stateNow()
    expect(state.consumptions.filter((c) => String(c.requestId) === String(row.requestId))).toHaveLength(1)
    expect(world.observed.some((o) => o.includes('a5m2-g1-row: review') && o.includes('family=B-INSPECT'))).toBe(true)
  })

  it('cordis_inspect_query end to end on an authorized triple; an unauthorized triple is refused before admission with zero row and zero native entry', async () => {
    const world = await mountWorld('query')
    // unauthorized first: the refusal must never reach admission.
    const before = (await stateNow()).requests.length
    await expect(world.defs.cordis_inspect_query.execute(
      { platform: 'host', provider: 'rogue-provider', method: 'anything' },
      execFor('call-bad'),
    )).rejects.toThrow(/P_G1_INSPECT_TARGET_NOT_AUTHORIZED/)
    expect((await stateNow()).requests.length).toBe(before)
    expect(world.nativeCalls.cordis_inspect_query).toHaveLength(0)

    // ONE flight, ONE correlation id — and the refused attempt above was
    // still a flight: it spent `-1` at the ledger before classify refused.
    // The authorized call is therefore the SECOND allocation on this mount.
    const correlation = `plane-g1:${world.plane.realmId}-cordis_inspect_query-2`
    const running = world.defs.cordis_inspect_query.execute(
      { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
      execFor('call-query'),
    )
    const row = await waitRowForCall(correlation)
    // The minted variant leaf on the DURABLE row is the grammar-selected
    // 'query-host' variant, the triple bound to THIS call's args at full
    // value (same-call origin — see the fixed-point legs).
    const qManifest = parsePaControlManifest(row.reviewPayload)
    expect(qManifest?.familyId).toBe('B-INSPECT')
    expect(qManifest?.targetManifest).toMatchObject({
      inspectVariant: 'query-host',
      queryPlatform: 'host',
      queryProvider: 'dsh_compute',
      queryMethod: 'compute_health',
    })
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = (await running) as { provider: string; answer: string }
    expect(value).toMatchObject({ platform: 'host', provider: 'dsh_compute', method: 'compute_health', answer: 'provider-answer' })
    expect(world.nativeCalls.cordis_inspect_query).toHaveLength(1)
  })

  it('team_list_pending_control end to end: the pending-queue read runs on the consumed plan and the ledger page comes back verbatim', async () => {
    const world = await mountWorld('pending')
    const correlation = `plane-g1:${world.plane.realmId}-team_list_pending_control-1`
    const running = world.defs.team_list_pending_control.execute(
      { rootSessionId: P6T4_ROOT, requestToken: 'tok-1', limit: 10 },
      execFor('call-pending'),
    )
    const row = await waitRowForCall(correlation)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(String(manifest?.callId)).toBe(correlation)
    // ZERO MOVEMENT for the non-enabled row: the B-CONTROL target grammar has
    // LANDED (root 17:40, flat trusted leaves — the grammar-facts leg pins the
    // record-85 payload against it), but B-CONTROL ENABLEMENT was NOT part of
    // the root 17:55 INSPECT ruling and the row is not registered, so NO
    // family block rides its walk and the durable row carries none. Enabling
    // it later is the SAME pair of moves this lane ran for INSPECT:
    // register the placed identity, then carry the block.
    expect(manifest?.familyId).toBeUndefined()
    expect(world.legInputs[0]).not.toHaveProperty('family')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = (await running) as { status: string; pending: unknown[]; count: number }
    expect(value).toMatchObject({ status: 'pending-control-listed', count: 1 })
    expect(world.nativeCalls.team_list_pending_control[0]?.args).toEqual({ rootSessionId: P6T4_ROOT, requestToken: 'tok-1', limit: 10 })
    const state = await stateNow()
    expect(state.consumptions.filter((c) => String(c.requestId) === String(row.requestId))).toHaveLength(1)
  })

  it('CURRENT-facts law on the production walk: topology moving DURING the approval wait refuses after consumption with zero native entry', async () => {
    const world = await mountWorld('stale')
    const correlation = `plane-g1:${world.plane.realmId}-cordis_inspect_list-1`
    const running = world.defs.cordis_inspect_list.execute({}, execFor('call-stale'))
    const row = await waitRowForCall(correlation)
    // The CURRENT authorized topology moves while the human decides — the
    // approved question is no longer the question the plan answers.
    world.topology.current = { ...structuredClone(TOPOLOGY_BASE), topologyRevision: 10, topologyDigest: 'sha256;topoten' }
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await expect(running).rejects.toThrow(/P_G1_TRUSTED_FACTS_STALE/)
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(0)
    const state = await stateNow()
    // The consumption stands (the edge really consumed the approval); the
    // stale plan never entered native — never re-approvable, never re-run.
    expect(state.consumptions.filter((c) => String(c.requestId) === String(row.requestId))).toHaveLength(1)
  })

  it('the shared token law: unbound token, in-flight replay and settled replay all refuse with zero extra row and zero native entry', async () => {
    const world = await mountWorld('token')
    await expect(world.defs.cordis_inspect_list.execute({}, { agent: { id: WORKER } }))
      .rejects.toThrow(/exec-token-unbound/)

    const sharedExec = execFor('call-shared')
    const running = world.defs.cordis_inspect_list.execute({}, sharedExec)
    await expect(world.defs.cordis_inspect_list.execute({}, sharedExec))
      .rejects.toThrow(/exec-token-replay/)
    const row = await waitRowForCall(`plane-g1:${world.plane.realmId}-cordis_inspect_list-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    // settled token: never re-armed.
    await expect(world.defs.cordis_inspect_list.execute({}, sharedExec))
      .rejects.toThrow(/exec-token-replay/)
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(1)
  })

  it('a signal already aborted answers cancelled at the PA edge: zero Control row, zero native entry', async () => {
    const world = await mountWorld('cancel')
    const before = (await stateNow()).requests.length
    const aborted = { aborted: true, addEventListener: () => {}, removeEventListener: () => {} }
    await expect(world.defs.cordis_inspect_list.execute({}, execFor('call-cancel', { signal: aborted })))
      .rejects.toThrow(/cancelled/)
    expect((await stateNow()).requests.length).toBe(before)
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(0)
  })

  it('the grammar facts at rev 7 are MEASURED at the validator: the rev-7 payloads PASS, the retired shapes deny with the pinned wordings, the three existing rules stay byte-identical', () => {
    // GRAMMAR facts at the validator — structure checks only. NOTHING here
    // is empirical consumption evidence (that is the two fixed-point legs);
    // per root the old source-shape refusal is named exactly as what it is.
    const listTarget = {
      topologyRevision: 9,
      topologyDigest: 'sha256;toponine',
      inspectVariant: 'list',
      listLaw: 'the real list enumerates ALL providers; the row constrains that answer to the CURRENT authorized topology — unauthorized providers never appear',
      trustedMemberAgentId: 'inst-1',
      trustedSessionHeaderId: 'hdr-1',
      trustedRealmId: 'realm-x',
      trustedOwner: 'root-1',
      trustedProfileId: 'prof-1',
    }
    // The rev-7 minted payloads PASS (measured, not assumed).
    expect(validatePaFamilyTarget('B-INSPECT', listTarget)).toBeUndefined()
    expect(validatePaFamilyTarget('B-INSPECT', {
      topologyRevision: 9, topologyDigest: 'sha256;toponine',
      inspectVariant: 'query-host', queryPlatform: 'host', queryProvider: 'dsh_compute', queryMethod: 'compute_health',
      trustedMemberAgentId: 'inst-1', trustedSessionHeaderId: 'hdr-1', trustedRealmId: 'realm-x', trustedOwner: 'root-1', trustedProfileId: 'prof-1',
    })).toBeUndefined()
    // The retired PRE-VARIANT shape (rev-6 encoding: nested topology) denies
    // with the absent-discriminant-side wording — the flat leaves are
    // required by the typed plan now.
    expect(validatePaFamilyTarget('B-INSPECT', {
      topology: { topologyRevision: 9, topologyDigest: 'd' },
      queryClaim: { platform: 'host', provider: 'p', method: 'm' },
      trusted: { memberAgentId: 'i' },
    })).toBe('topologyRevision: required by the B-INSPECT typed plan, absent')
    // Closed-set extra key; prototype-named discriminant; variant↔platform
    // pairing; the B-CONTROL legacy nested envelope — all pinned wordings.
    expect(validatePaFamilyTarget('B-INSPECT', { ...listTarget, rogue: 1 }))
      .toBe('rogue: not part of the B-INSPECT typed plan')
    expect(validatePaFamilyTarget('B-INSPECT', { ...listTarget, inspectVariant: 'toString' }))
      .toBe("inspectVariant: 'toString' selects no B-INSPECT variant group")
    expect(validatePaFamilyTarget('B-INSPECT', {
      topologyRevision: 9, topologyDigest: 'd',
      inspectVariant: 'query-host', queryPlatform: 'client', queryProvider: 'p', queryMethod: 'm',
      trustedMemberAgentId: 'i', trustedSessionHeaderId: 'h', trustedRealmId: 'r', trustedOwner: 'o', trustedProfileId: 'p',
    })).toBe("queryPlatform: not the 'query-host' variant constant of the B-INSPECT typed plan")
    expect(validatePaFamilyTarget('B-CONTROL', { trusted: { memberAgentId: 'i', sessionHeaderId: 'h', realmId: 'r', owner: 'o', profileId: 'p' } }))
      .toBe('trustedMemberAgentId: required by the B-CONTROL typed plan, absent')
    expect(validatePaFamilyTarget('B-CONTROL', {
      trustedMemberAgentId: 'i', trustedSessionHeaderId: 'h', trustedRealmId: 'r', trustedOwner: 'o', trustedProfileId: 'p',
    })).toBeUndefined()
    // The three EXISTING rules byte-identical: B-SESSION's own law still
    // accepts its own target and refuses the B-INSPECT leaves as extra keys
    // (no variant grammar reached, no rule moved).
    expect(validatePaFamilyTarget('B-SESSION', {
      operation: 'todo-list', agentId: 'a', sessionHeaderId: 'h', todosDigest: 'sha256:t',
      counts: { pending: 1, inProgress: 0, completed: 2 }, allowParallelPolicy: false, paramFingerprint: 'sha256:p',
    })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SESSION', {
      operation: 'todo-list', agentId: 'a', sessionHeaderId: 'h', todosDigest: 'sha256:t',
      counts: { pending: 1, inProgress: 0, completed: 2 }, allowParallelPolicy: false, paramFingerprint: 'sha256:p',
      inspectVariant: 'list', listLaw: 'x',
    })).toBe('inspectVariant: not part of the B-SESSION typed plan')
  })

  it('FIXED POINT 1 — SAME-CALL IDENTITY: the durable row, the registered definition identity and the minted variant leaf come from ONE classify/plan call; moved/mixed-origin feeds refuse with zero row', async () => {
    const world = await mountWorld('fixedpoint-1')
    // The positive half: run the REAL chain once and pin that every durable
    // identity traces back to the single classify call that answered this
    // execute — the row's own bytes, not a reconstruction.
    const correlation = `plane-g1:${world.plane.realmId}-cordis_inspect_list-1`
    const running = world.defs.cordis_inspect_list.execute({}, execFor('call-fp1'))
    const row = await waitRowForCall(correlation)
    const manifest = parsePaControlManifest(row.reviewPayload)
    const listRow = (world.plane.backends.g1 as G1Row[]).find((r) => r.name === 'cordis_inspect_list') as G1Row
    const sameCall = listRow.classify({}, 'call-fp1')
    expect(sameCall.ok).toBe(true)
    // (a) the registration key IS the placement identity the feed answers,
    //     and the durable record's binding tuple carries the SAME identity —
    //     never the capture-side string.
    const fed = String(world.plane.placementFeed('cordis_inspect_list')?.definitionIdentity ?? '')
    expect(String(manifest?.binding?.definitionIdentity)).toBe(fed)
    expect(a5GovernedFamilyFor(fed)).toEqual({
      familyId: 'B-INSPECT', adapterRevision: G1.A5_G1_ADAPTER_REVISION, providerIdentity: PROVIDER_ID,
    })
    expect(a5GovernedFamilyFor('a5p5-plane@639ed01539#cordis_inspect_list')).toBeUndefined()
    // (b) the minted variant leaf and target bytes on the durable row equal
    //     the review payload of the row's OWN classify over the same args —
    //     one classify, byte-exact (the plane adds nothing, translates nothing).
    expect(manifest?.targetManifest).toEqual(sameCall.reviewPayload?.targetManifest)
    expect(manifest?.targetManifest).toMatchObject({ inspectVariant: 'list' })
    // (c) the parameters fingerprint on the durable row is the fingerprint
    //     the SAME classify computed for these args (full-value, not a name).
    expect(String(manifest?.parametersFingerprint)).toBe(String(sameCall.parametersFingerprint))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(1)

    // The negatives ride a REAL walk's own leg inputs (produced by two
    // DENIED real walks — zero consumptions spent), so every probe below is
    // the same shape the production walk carries.
    const denyWalk = world.defs.cordis_inspect_list.execute({}, execFor('call-fp1-deny'))
    const denyRow = await waitRowForCall(`plane-g1:${world.plane.realmId}-cordis_inspect_list-2`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: denyRow.requestId, decision: 'deny' })
    await expect(denyWalk).rejects.toThrow(/APPROVAL_DENIED/)
    const inspectLegInput = world.legInputs[world.legInputs.length - 1] as Record<string, unknown>
    const pendWalk = world.defs.team_list_pending_control.execute({ rootSessionId: P6T4_ROOT, requestToken: 'tok-fp1' }, execFor('call-fp1-pend'))
    // ONE counter for the whole mount: this is the THIRD flight on it
    // (positive list -1, denied list -2, pending -3).
    const pendRow = await waitRowForCall(`plane-g1:${world.plane.realmId}-team_list_pending_control-3`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: pendRow.requestId, decision: 'deny' })
    await expect(pendWalk).rejects.toThrow(/APPROVAL_DENIED/)
    const pendingLegInput = world.legInputs[world.legInputs.length - 1] as Record<string, unknown>
    const probeLeg = (legInput: Record<string, unknown>, probeCallId: string, family: Record<string, unknown> | undefined) => createPaControlLeg({
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
      governedFamilies: familyTable,
    })({
      ...legInput,
      callId: probeCallId,
      ...(family === undefined ? {} : { family }),
    } as unknown as PaControlLegInput)
    const good = inspectLegInput.family as Record<string, unknown>
    const moved: Array<[string, Record<string, unknown>, Record<string, unknown>, string]> = [
      // the whole block moved onto the NON-enabled binding's real walk:
      ['fp1-moved-identity', pendingLegInput, good, 'family-claim-on-unregistered-binding'],
      // the provider leaf mixed in from elsewhere:
      ['fp1-moved-provider', inspectLegInput, { ...good, providerIdentity: 'other-plane' }, 'family-provider-identity-mismatch'],
      // the family leaf mixed in from elsewhere:
      ['fp1-moved-family', inspectLegInput, { ...good, familyId: 'B-SESSION' }, 'family-mismatch'],
      // the revision leaf mixed in from elsewhere:
      ['fp1-moved-revision', inspectLegInput, { ...good, adapterRevision: G1.A5_G1_ADAPTER_REVISION - 1 }, 'family-adapter-revision-mismatch'],
      // the minted variant leaf moved to a prototype name (own-key law):
      ['fp1-moved-leaf', inspectLegInput, { ...good, targetManifest: { ...(good.targetManifest as Record<string, unknown>), inspectVariant: 'toString' } }, 'family-target-invalid'],
    ]
    for (const [probeCallId, legInput, family, expectString] of moved) {
      const res = await probeLeg(legInput, probeCallId, family)
      expect(JSON.stringify(res), probeCallId).toContain(expectString)
    }
    const state = await stateNow()
    for (const [probeCallId] of moved) {
      expect(state.requests.some((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === probeCallId), probeCallId).toBe(false)
    }
  })

  it('FIXED POINT 2 — STALE-REVISION REFUSAL: a durable approval carrying the retired adapterRevision 6 REFUSES consumption at the PA walk (pinned drifted wording, zero consumption); the pre-variant shape never even reaches durable (grammar fact)', async () => {
    const world = await mountWorld('fixedpoint-2')
    // Produce one REAL leg input through a denied walk (the shape the
    // production walk carries, zero consumptions spent).
    const denyWalk = world.defs.cordis_inspect_list.execute({}, execFor('call-fp2-deny'))
    const denyRow = await waitRowForCall(`plane-g1:${world.plane.realmId}-cordis_inspect_list-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: denyRow.requestId, decision: 'deny' })
    await expect(denyWalk).rejects.toThrow(/APPROVAL_DENIED/)
    const legInput = world.legInputs[world.legInputs.length - 1] as Record<string, unknown>
    const good = legInput.family as Record<string, unknown>
    const probeLeg = (probeCallId: string, family: Record<string, unknown>) => createPaControlLeg({
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
      governedFamilies: familyTable,
    })({ ...legInput, callId: probeCallId, family } as unknown as PaControlLegInput)

    // GRAMMAR FACT (at the leg, pre-durable): a PRE-VARIANT (rev-6 nested)
    // target on the CURRENT revision cannot even create the row — retired
    // encodings are never translated. Pinned; this is structure, not a
    // consumption claim.
    const preVariant = await probeLeg('fp2-pre-variant', {
      familyId: 'B-INSPECT',
      adapterRevision: G1.A5_G1_ADAPTER_REVISION,
      providerIdentity: PROVIDER_ID,
      targetManifest: {
        topology: { topologyRevision: TOPOLOGY_BASE.topologyRevision, topologyDigest: TOPOLOGY_BASE.topologyDigest },
        queryClaim: { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
        trusted: { memberAgentId: WORKER, sessionHeaderId: HEADER_ID, realmId: world.plane.realmId, owner: P6T4_ROOT, profileId: 'profile-a5m2-g1' },
      },
    })
    expect(JSON.stringify(preVariant)).toContain('family-target-invalid: topologyRevision: required by the B-INSPECT typed plan, absent')

    // THE EMPIRICAL CONSUMPTION REFUSAL: mint a durable approval that
    // genuinely carries the RETIRED adapterRevision 6 (the block matches a
    // registration temporarily at 6 — a mount still on the retired build),
    // let the human allow it with the CURRENT truth (7) restored BEFORE the
    // decision lands, and pin that consumption itself refuses.
    // The registry refuses a SECOND claim on one identity (a re-mount is a
    // config defect, never a paper-over), so the temporary retired-mount
    // state is written as delete-then-register and restored the same way.
    const listKey = world.familyKeys.cordis_inspect_list
    const register7 = () => {
      delete familyTable[listKey]
      registerA5GovernedFamily(listKey, { familyId: 'B-INSPECT', adapterRevision: G1.A5_G1_ADAPTER_REVISION, providerIdentity: PROVIDER_ID })
    }
    const register6 = () => {
      delete familyTable[listKey]
      registerA5GovernedFamily(listKey, { familyId: 'B-INSPECT', adapterRevision: G1.A5_G1_ADAPTER_REVISION - 1, providerIdentity: PROVIDER_ID })
    }
    register6()
    try {
      const stale = probeLeg('fp2-rev6-row', { ...good, adapterRevision: G1.A5_G1_ADAPTER_REVISION - 1 })
      const row = await waitRowForCall('fp2-rev6-row')
      expect(parsePaControlManifest(row.reviewPayload)?.adapterRevision).toBe(G1.A5_G1_ADAPTER_REVISION - 1)
      // The retired encoding is retired: the CURRENT registration goes back
      // to the module truth BEFORE the human decides.
      register7()
      // The decision gate (the first gate that fronts the consumption write)
      // converts the stale-revision allow into a DURABLE DENY carrying the
      // closed reason — never a silent skip, never an allow.
      const decision = await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
      expect(JSON.stringify(decision)).toContain('pa-authority-drift')
      const res = await stale.catch((error: unknown) => ({ refused: String((error as Error)?.message ?? error) }))
      // The walk never reaches a spent approval: it reads the durable deny.
      expect(JSON.stringify(res)).toContain('the approval was denied')
      // The pinned drifted wording itself, observed at the PA walk's verifier
      // gate for exactly this row — the refusal says WHY, in the grammar's
      // own words, and says nothing else moved.
      expect(verifierObserved.filter((o) => String(o.requestId) === String(row.requestId)
        && o.gate === 'resolve' && o.outcome === 'drift'
        && o.detail === 'the family adapter moved (approved revision 6, current 7)')).toHaveLength(1)
      const state = await stateNow()
      // The approval died unconsumed: ZERO consumption rows for it — the
      // retired revision is never silently translated into a fresh one.
      expect(state.consumptions.filter((c) => String(c.requestId) === String(row.requestId))).toHaveLength(0)
    } finally {
      register7()
    }
    expect(a5GovernedFamilyFor(listKey)).toEqual({ familyId: 'B-INSPECT', adapterRevision: G1.A5_G1_ADAPTER_REVISION, providerIdentity: PROVIDER_ID })
    // Zero native entry for the stale flight: the probe walks the bridge, and
    // the plane never reached delegate on this flight — the world's native
    // count is exactly the one real allow-flight it never ran (zero here).
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(0)
  })

  it('the adapter swapped-execution guard stays live under the plane identity law: a foreign host callId refuses the consumed-plan entry with zero native', async () => {
    const world = await mountWorld('swap')
    const row = (world.plane.backends.g1 as G1Row[]).find((r) => r.name === 'cordis_inspect_list') as G1Row
    const classified = row.classify({}, 'call-owned')
    expect(classified.ok).toBe(true)
    const refusal = await row.delegate(classified.plan, { exec: { callId: 'call-foreign' } })
    expect(refusal.ok).toBe(false)
    expect(refusal.code).toBe('P_G1_NOT_OWN_PLAN')
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(0)
    // …and the SAME row under a MATCHING host callId does enter — the plane
    // classifies with the host call identity when the execution carries one
    // (the durable identity stays the ledger allocation, pinned by the list
    // leg above): re-classify and delegate with the matching identity.
    const classified2 = row.classify({}, 'call-owned-2')
    const ran = await row.delegate(classified2.plan, { exec: { callId: 'call-owned-2' } })
    expect(ran.ok).toBe(true)
    expect(world.nativeCalls.cordis_inspect_list).toHaveLength(1)
  })

  it('the row fingerprint is the full-VALUE parameters fingerprint the walk carries (same args move it, different args move it)', async () => {
    const world = await mountWorld('fingerprint')
    const args = { rootSessionId: P6T4_ROOT, requestToken: 'tok-fp' }
    const running = world.defs.team_list_pending_control.execute(args, execFor('call-fp'))
    const row = await waitRowForCall(`plane-g1:${world.plane.realmId}-team_list_pending_control-1`)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(String(manifest?.parametersFingerprint)).toBe(`sha256:${canonicalJsonFingerprint(args).replace(/^sha256:/, '')}`.replace(/^sha256:sha256:/, 'sha256:'))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    // A different value is a DIFFERENT question.
    const world2 = world
    const other = await (async () => {
      const r = world2.defs.team_list_pending_control.execute({ ...args, requestToken: 'tok-fp-OTHER' }, execFor('call-fp-2')).catch(() => undefined)
      const r2 = await waitRowForCall(`plane-g1:${world2.plane.realmId}-team_list_pending_control-2`)
      const m = parsePaControlManifest(r2.reviewPayload)
      void r
      return m
    })()
    expect(String(other?.parametersFingerprint)).not.toBe(String(manifest?.parametersFingerprint))
  })
})

// ── MOUNT-ARM (center 01:1x/01:4x): the agent-bindings G1 block's production
// half. The block itself lives inside `createAgentBindings` and needs a live
// Host agent ctx — no in-repo spec has ever driven that (the
// a5m2-provider-identity-c1 FP-B disclosure, verbatim law), so this section
// (a) drives the G1-WIRE lane's PRODUCTION assembly module through a seam bag
// that MIRRORS the block's seams one-for-one, over the SAME real chain as the
// section above (real ControlService, real PA walk, real family table), and
// (b) pins the block's own code at source level. Disclosed harness stands:
// the registry double enforces the 639 single-placement law (the REAL host
// registration entry is pinned by the pair's a5m2-g1-query-assembly spec);
// the dispatcher surface double answers the entryOf shape the block's live
// binding-facts reader reads (the REAL guard surface law is owned by
// a5m2-provider-identity-c1); `bind()` here stands for the Guard's
// bindOwnTools step, and `bindingFixtures` is this suite's placement-binding
// stand (a mountWorld law) keyed by the arm's minted identity. 接线未测
// pending Host; these assembly legs never mint 已测试.
const ARM_ASM = (await import(new URL('../src/plugin/live/governed-families/g1-query-assembly.mjs', import.meta.url).href)) as {
  A5_G1_QUERY_ASSEMBLY_CODES: Record<string, string>
  createG1QueryAssembly: (mount: Record<string, unknown>) => ArmAssembly
}
const ARM_WIRE = (await import(new URL('../src/plugin/live/governed-families/g1-query-wiring.mjs', import.meta.url).href)) as {
  g1PureQuerySubset: () => ReadonlyArray<{ name: string; recordIndex: number; familyId: string }>
}
interface ArmRegistration { name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }
interface ArmAssembly {
  ok: boolean
  code?: string
  message?: string
  wiring?: { definitions: Array<{ name: string; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> }>; declared: Array<{ name: string; status: string; reason: string }>; placementNames: readonly string[]; rowOf?: (name: string) => { familyId: string } | undefined }
  captures?: Record<string, { status: string; definitionIdentity: string; recordIndex: number; familyId: string }>
  place: () => Array<() => void>
  registerAfterPublish: () => ArmRegistration[]
}
interface ArmWorld {
  plane: PlaneAssemblyValue
  nativeCalls: TrioBag<NativeCall[]>
  topology: { current: InspectTopology }
  observed: string[]
  legInputs: Record<string, unknown>[]
  assemblies: ArmAssembly[]
  observations: string[]
  scopeLayer: Map<string, { name: string; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> }>
  dispatcherEntries: Map<string, { verified: boolean; binding: { status: string; bindingId: string; revision: number; policyGeneration: number; authorityGeneration: number } }>
  keys: Map<string, string>
  registrations: ArmRegistration[]
  publish: () => ArmRegistration[]
  armBinding: (name: string) => void
}
let armSeq = 0
async function mountArmWorld(opts: { cfgTopology?: boolean } = {}): Promise<ArmWorld> {
  const label = `arm-${String(++armSeq)}`
  const world = await mountWorld(label, { g1Rows: 'none' })
  const { defs: nativeDefs, nativeCalls } = makeCaptures(() => world.topology.current)
  const globalLayer = new Map<string, HostNativeDef>(Object.entries(nativeDefs))
  const scopeLayer = new Map<string, ArmAssembly['wiring'] extends undefined ? never : { name: string; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> }>()
  const dispatcherEntries = new Map<string, { verified: boolean; binding: { status: string; bindingId: string; revision: number; policyGeneration: number; authorityGeneration: number } }>()
  const observations: string[] = []
  const assemblies: ArmAssembly[] = []
  const keys = new Map<string, string>()
  // The block's seams, mirrored one-for-one (the agent-bindings G1 block is
  // the shape under test; the module under test is the REAL production one).
  const registryGet = (name: string): unknown => scopeLayer.get(name) ?? globalLayer.get(name)
  const registryRegister = (definition: { name?: string; execute?: unknown; output?: { schema?: unknown; render?: unknown } }): (() => void) => {
    // the 639 single-placement + minimum-entry law (disclosed double; the
    // REAL registration entry is pinned by the pair's assembly spec).
    if (typeof definition?.name !== 'string') throw new Error('refused: definition without a name')
    if (scopeLayer.has(definition.name)) throw new Error(`refused: '${definition.name}' is already registered in this layer (one name, one placement)`)
    if (typeof definition.execute !== 'function' || definition.output?.schema === undefined || typeof definition.output?.render !== 'function') {
      throw new Error(`refused: '${definition.name}' is not registration-ready (the minimum-entry law)`)
    }
    scopeLayer.set(definition.name, definition as { name: string; execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown> })
    return () => { scopeLayer.delete(definition.name as string) }
  }
  const g1PlaneSeam = {
    placementFeed: (name: string) => {
      const placed = registryGet(name)
      const identity = placed === undefined || placed === null ? null : definitionIdentityOf(placed as never)
      return identity === null || identity === undefined ? undefined : Object.freeze({ definitionIdentity: identity, realmId: world.plane.realmId })
    },
    paAdmit: (walk: unknown) => (world.plane as unknown as { paAdmit: (w: unknown) => Promise<unknown> }).paAdmit(walk),
  }
  const bindingFactsFor = (name: string) => (): Record<string, unknown> => {
    const entry = dispatcherEntries.get(name)
    const binding = entry?.binding
    if (entry?.verified !== true || binding?.status !== 'ACTIVE'
      || typeof binding.bindingId !== 'string' || binding.bindingId.length === 0
      || !Number.isInteger(binding.revision) || !Number.isInteger(binding.policyGeneration) || !Number.isInteger(binding.authorityGeneration)) {
      throw new Error(`refused-g1 binding-facts-unreadable — '${name}' answers no verified ACTIVE dispatcher binding`)
    }
    return { bindingId: binding.bindingId, bindingRevision: binding.revision, policyGeneration: binding.policyGeneration, authorityGeneration: binding.authorityGeneration }
  }
  const trusted = { memberAgentId: WORKER, sessionHeaderId: HEADER_ID, realmId: world.plane.realmId, owner: P6T4_ROOT, profileId: 'profile-a5m2-g1' }
  const cfgTopology = opts.cfgTopology !== false
  // THE BLOCK'S LOOP, mirrored: derive the subset, supply ONLY the enabled
  // families, one assembly per supplied row, arm refusal = typed throw.
  for (const entry of ARM_WIRE.g1PureQuerySubset()) {
    if (entry.familyId !== 'B-INSPECT') {
      observations.push(`a5m2-g1: row '${entry.name}' (record ${String(entry.recordIndex)}, ${entry.familyId}) SUPPLY-GATED — family enablement not authorized (root 17:55: B-INSPECT only)`)
      continue
    }
    const assembly = ARM_ASM.createG1QueryAssembly({
      providerId: PROVIDER_ID,
      registry: {
        get: (name: string) => (name === entry.name ? registryGet(name) : undefined),
        register: registryRegister,
      },
      runtimeAgent: { id: WORKER, session: { header: { id: HEADER_ID } } },
      plane: () => g1PlaneSeam,
      trusted,
      bindingFacts: bindingFactsFor(entry.name),
      ...(cfgTopology ? { topology: { current: () => world.topology.current } } : {}),
      observe: (row: Record<string, unknown>) => { observations.push(`a5m2-g1: ${String(row?.event ?? 'observe')} ${String(row?.name ?? '')}`) },
    })
    if (assembly.ok !== true) {
      throw Object.assign(new Error(`alpha5-g1-arm-mount-refused: ${String(assembly.code)} — ${String(assembly.message)}`), { code: 'alpha5-g1-arm-mount-refused' })
    }
    assembly.place()
    for (const name of assembly.wiring?.placementNames ?? []) {
      // the Guard's bind step (harness stand for bindOwnTools): the placed
      // def's placement becomes a verified ACTIVE dispatcher binding.
      dispatcherEntries.set(name, {
        verified: true,
        binding: { status: 'ACTIVE', bindingId: `a5m2-g1-arm:${label}:${name}`, revision: 1, policyGeneration: 0, authorityGeneration: 0 },
      })
    }
    assemblies.push(assembly)
  }
  const publish = (): ArmRegistration[] => {
    const out: ArmRegistration[] = []
    for (const assembly of assemblies) {
      for (const registration of assembly.registerAfterPublish()) {
        if (registration.entry.familyId !== 'B-INSPECT') {
          throw new Error(`arm law broken: a SUPPLY-GATED family reached the table (${registration.name})`)
        }
        keys.set(registration.name, registration.definitionIdentity)
        out.push(registration)
      }
    }
    return out
  }
  const armBinding = (name: string): void => {
    // This suite's placement-binding stand, keyed by the ARM-MINTED identity
    // (the mountWorld bindingFixtures law; the arm route carries no plane
    // placement, so the stand resolves through the call's own tool name).
    const identity = keys.get(name)
    if (identity === undefined) throw new Error(`no arm registration for ${name} yet`)
    bindingFixtures.set(`${label}:`, parseToolBinding({
      bindingId: `a5m2-g1-arm:${label}:${name}`,
      agentScopeKey: `a5m2-g1-wire:${label}`,
      toolName: name,
      definitionIdentity: identity,
      providerId: PROVIDER_ID,
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host', world.plane.realmId),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    }))
  }
  return { plane: world.plane, nativeCalls, topology: world.topology, observed: world.observed, legInputs: world.legInputs, assemblies, observations, scopeLayer, dispatcherEntries, keys, registrations: [], publish, armBinding }
}

describe('A5M2-G1-WIRE MOUNT-ARM: the agent-bindings g1PureQuery block supplies the enabled rows, the production module mints and registers, and the wired defs walk the ONE PA chain (assembly legs: 接线未测 pending Host, never 已测试)', () => {
  it('arm supply law: the enabled family set arms only the B-INSPECT pair; the derived subset stays DECLARED-INACTIVE; 85 (B-CONTROL) is never assembled, placed or registered', async () => {
    const arm = await mountArmWorld()
    expect(arm.assemblies).toHaveLength(2)
    const subset = ARM_WIRE.g1PureQuerySubset()
    expect(subset.map((e) => e.name)).toContain('team_list_pending_control')
    expect(subset.find((e) => e.name === 'team_list_pending_control')?.familyId).toBe('B-CONTROL')
    expect(arm.observations.some((o) => o.includes("row 'team_list_pending_control'") && o.includes('SUPPLY-GATED'))).toBe(true)
    // every assembly mounts the full derived subset; the names THIS assembly
    // does not supply are its own honest DECLARED-INACTIVE rows.
    for (const assembly of arm.assemblies) {
      const declaredNames = (assembly.wiring?.declared ?? []).map((d) => `${d.name}:${d.status}:${d.reason}`)
      expect(declaredNames.some((d) => d.startsWith('team_list_pending_control:DECLARED-INACTIVE:'))).toBe(true)
    }
    // placed + registered = exactly the enabled pair; 85 appears nowhere.
    expect([...arm.scopeLayer.keys()].sort()).toEqual(['cordis_inspect_list', 'cordis_inspect_query'])
    const registrations = arm.publish()
    expect(registrations.map((r) => r.name).sort()).toEqual(['cordis_inspect_list', 'cordis_inspect_query'])
    for (const registration of registrations) {
      expect(registration.entry.familyId).toBe('B-INSPECT')
      expect(registration.entry.adapterRevision).toBe(G1.A5_G1_ADAPTER_REVISION)
      expect(registration.entry.providerIdentity).toBe(PROVIDER_ID)
    }
    expect(Object.keys(familyTable).some((k) => String(k).includes('team_list_pending_control'))).toBe(false)
  })

  it('REAL mint, PRODUCTION registration: the keys are the real definitionIdentityOf mints of the PLACED defs (never the g1-capture@ strings), the ONE table answers verbatim, and the write is idempotent', async () => {
    const arm = await mountArmWorld()
    const registrations = arm.publish()
    expect(registrations).toHaveLength(2)
    for (const registration of registrations) {
      const placed = arm.scopeLayer.get(registration.name)
      expect(placed).toBeDefined()
      // THE REAL MINTER over the definition the layer actually holds — the
      // registration key IS the runtime identity of the placed def.
      expect(registration.definitionIdentity).toBe(String(definitionIdentityOf(placed as never)))
      expect(registration.definitionIdentity.startsWith('g1-capture@')).toBe(false)
      const readBack = a5GovernedFamilyFor(registration.definitionIdentity)
      expect(readBack).toEqual({
        familyId: 'B-INSPECT',
        adapterRevision: G1.A5_G1_ADAPTER_REVISION,
        providerIdentity: PROVIDER_ID,
      })
      // the capture-side identity stays visible, namespaced and reversible —
      // and never a table key.
      const captureEntry = arm.assemblies.flatMap((a) => Object.values(a.captures ?? {})).find((c) => c.definitionIdentity.includes(registration.name))
      expect(captureEntry?.definitionIdentity.startsWith(`g1-capture@${PROVIDER_ID}@${registration.name}#`)).toBe(true)
      expect(JSON.parse(captureEntry!.definitionIdentity.slice(captureEntry!.definitionIdentity.indexOf('#') + 1)) as Record<string, unknown>).toMatchObject({ familyId: 'B-INSPECT' })
      expect(Object.keys(familyTable).includes(captureEntry!.definitionIdentity)).toBe(false)
    }
    // idempotent by the registry's own law (same three fields re-register).
    const again = arm.publish()
    expect(again.map((r) => r.definitionIdentity)).toEqual(registrations.map((r) => r.definitionIdentity))
  })

  it('the wired def walks the SAME real chain: durable row carries the rev-7 family block at FULL VALUE keyed by the EXEC callId, leader allow, ONE consumption, the captured native entered ONCE, the answer topology-constrained', async () => {
    const arm = await mountArmWorld()
    arm.publish()
    arm.armBinding('cordis_inspect_list')
    const def = arm.scopeLayer.get('cordis_inspect_list')
    expect(def).toBeDefined()
    const callId = 'toolu-call-arm-list'
    const running = def!.execute({}, { agent: { id: WORKER, session: { header: { id: HEADER_ID } } }, token: Symbol(callId), callId })
    const row = await waitRowForCall(callId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(String(manifest?.callId)).toBe(callId)
    expect(manifest?.familyId).toBe('B-INSPECT')
    expect(manifest?.adapterRevision).toBe(G1.A5_G1_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(PROVIDER_ID)
    expect(manifest?.targetManifest).toMatchObject({
      inspectVariant: 'list',
      trustedMemberAgentId: WORKER,
      trustedSessionHeaderId: HEADER_ID,
      trustedRealmId: arm.plane.realmId,
      trustedOwner: P6T4_ROOT,
      trustedProfileId: 'profile-a5m2-g1',
    })
    expect(row.status).toBe('pending')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = (await running) as { providers: Array<{ id: string }>; excludedUnauthorizedProviders: number }
    expect(value.providers.map((p) => p.id)).toEqual(['dsh_compute'])
    expect(value.excludedUnauthorizedProviders).toBe(1)
    expect(arm.nativeCalls.cordis_inspect_list).toHaveLength(1)
    const state = await stateNow()
    expect(state.consumptions.filter((c) => String(c.requestId) === String(row.requestId))).toHaveLength(1)
  })

  it('the query row on the arm: an authorized triple answers through the consumed plan; an unauthorized triple refuses at classify with zero row and zero native entry', async () => {
    const arm = await mountArmWorld()
    arm.publish()
    arm.armBinding('cordis_inspect_query')
    const def = arm.scopeLayer.get('cordis_inspect_query')
    const before = (await stateNow()).requests.length
    const refused = await def!.execute(
      { platform: 'host', provider: 'rogue-provider', method: 'anything' },
      { agent: { id: WORKER, session: { header: { id: HEADER_ID } } }, token: Symbol('arm-q-bad'), callId: 'toolu-call-arm-q-bad' },
    ).then(() => undefined, (error: unknown) => String((error as Error).message))
    expect(String(refused)).toContain('P_G1_INSPECT_TARGET_NOT_AUTHORIZED')
    expect(String(refused)).toContain('54·B-INSPECT')
    expect((await stateNow()).requests.length).toBe(before)
    expect(arm.nativeCalls.cordis_inspect_query).toHaveLength(0)
    const callId = 'toolu-call-arm-q-ok'
    const running = def!.execute(
      { platform: 'host', provider: 'dsh_compute', method: 'compute_health' },
      { agent: { id: WORKER, session: { header: { id: HEADER_ID } } }, token: Symbol(callId), callId },
    )
    const row = await waitRowForCall(callId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = (await running) as { answer: string }
    expect(value.answer).toBe('provider-answer')
    expect(arm.nativeCalls.cordis_inspect_query).toHaveLength(1)
  })

  it('topology absent (no integrator supply): the rows still mount, place and register, but every call refuses the module\u2019s OWN trusted-topology posture before admission — zero native entry, zero row', async () => {
    const arm = await mountArmWorld({ cfgTopology: false })
    const registrations = arm.publish()
    expect(registrations).toHaveLength(2)
    arm.armBinding('cordis_inspect_list')
    const def = arm.scopeLayer.get('cordis_inspect_list')
    const before = (await stateNow()).requests.length
    const refusal = await def!.execute({}, { agent: { id: WORKER, session: { header: { id: HEADER_ID } } }, token: Symbol('arm-notopo'), callId: 'toolu-call-arm-notopo' })
      .then(() => undefined, (error: unknown) => String((error as Error).message))
    expect(String(refusal)).toMatch(/TRUSTED_TOPOLOGY/)
    expect(arm.nativeCalls.cordis_inspect_list).toHaveLength(0)
    expect((await stateNow()).requests.length).toBe(before)
  })

  it('the block at source level: closed gate and refusal code, B-INSPECT-only supply, one assembly per row with the live per-row binding reader, place before the Guard bind, registration after publish, no plane g1 injection, no fabricated topology', () => {
    const src = readFileSync(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
    const start = src.indexOf("A5M2-G1-WIRE MOUNT-ARM (this lane's block; center")
    const end = src.indexOf('(B-SUBAGENT-CONTROL-WIRING: the wiring section stands BEFORE the plane build', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)
    expect(block).toContain("planeCfg?.g1PureQuery")
    expect(block).toContain('alpha5-g1-arm-mount-refused')
    expect(block).toContain("entry.familyId !== 'B-INSPECT'")
    expect(block).toContain('SUPPLY-GATED')
    expect(block).toContain('createG1QueryAssembly({')
    expect(block).toContain('g1PureQuerySubset()')
    // one assembly per supplied row; the registry seam answers ONLY this row.
    expect(block).toContain('name === entry.name ? agentCtx.tools.get(name, agent) : undefined')
    // the todo arm's live binding-facts law, per row, fail closed.
    expect(block).toContain('dispatcher?.surface?.entryOf?.(entry.name)')
    expect(block).toContain('binding-facts-unreadable')
    // no plane g1 row injection in this block; the plane's own route untouched
    // (code-level law: the block's prose may NAME the plane's own seam, it
    // never FORWARDS it — no assignment/forwarding site for either token).
    expect(block).not.toMatch(/g1Enabled\s*[:=]/)
    expect(block).not.toMatch(/backends\s*[:=]\s*\{[^}]*g1/)
    // the trusted TARGETS five facts, all real; the seam bag stays minimal.
    for (const fact of ['memberAgentId: g1MemberAgentId', 'sessionHeaderId: g1SessionHeaderId', 'realmId: a5PlaneRealmId', 'owner: String(teamRoot)', 'profileId: g1ProfileId']) {
      expect(block).toContain(fact)
    }
    expect(block).toContain('trustedTopology')
    // placement feeds the Guard's own-tool bind list BEFORE the bind runs.
    expect(block).toContain('a5PlaneOwnNames.push(name)')
    expect(block).toContain('a5PlaneOwnedNames.push(name)')
    expect(src.indexOf('const ownNames = [...selectedTeamToolNames, ...a5PlaneOwnNames]'))
      .toBeGreaterThan(src.indexOf('const g1Disposers'))
    // the registration rides the shared post-publish fill point, before the
    // mount publish, with the refusal-not-guess law.
    const pub = src.indexOf('const published = a5p1Guard.publish()')
    const reg = src.indexOf('g1Assembly.registerAfterPublish()')
    const mountPub = src.indexOf('paMountIdentity = publishPaMount(')
    expect(pub).toBeGreaterThan(-1)
    expect(reg).toBeGreaterThan(pub)
    expect(reg).toBeLessThan(mountPub)
    // the assembly module is imported, never restated; the adapter module is
    // never reached directly from this file.
    expect(src).toContain("import { createG1QueryAssembly } from './governed-families/g1-query-assembly.mjs'")
    expect(src).toContain("import { g1PureQuerySubset } from './governed-families/g1-query-wiring.mjs'")
    expect(src).not.toContain("from './governed-families/g1-surface-adapters.mjs'")
  })
})
