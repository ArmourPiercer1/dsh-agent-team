import { PA_FAMILY_TARGET_RULES, assertPaFamilyTargetRuleLegality, validatePaFamilyTargetAgainstRule } from '../control/types.js'
import { g2ApprovedTargetMismatches } from '../src/plugin/host.js'
/**
 * A5M2-G2-WIRE C1 (G2 lane, root ruling 15:28; wiring + assembly legs ONLY):
 * the EXTERNAL-CONNECTION family (WEB / MCP / BROWSER) wired into the
 * PRODUCTION plane along the established governed-row pattern — the closed
 * consumption keys, the typed fail-closed injection points, the placement-
 * moment rowset build, the mount-time family registration keyed by the RUNTIME
 * placement identity (the agent-bindings law, performed here through the
 * plane's OWN placementFeed), the ONE shared PA walk (open -> the REAL final
 * edge -> consumedProof — no parallel permission path, no generic
 * tool-invoke pseudo-governance), the shared token ledger's single-flight law
 * and the reviewed consumption edge `consumeG2ApprovedPlan` as the ONE entry
 * to any row body.
 *
 * FOUR-TIER HONESTY (no fifth tier). These are ASSEMBLY-LEVEL legs: they
 * never reach 已测试 by definition. Per-surface truth, stated where the
 * evidence stops:
 *  - WEB: NOT WIRED. The mount path and the typed injection point exist and
 *    refuse everything this world can supply (pinned verbatim below). The
 *    named blocker is the real Team-only FIXED provider: WEB global/env
 *    per-realm composition is FORBIDDEN (configured-id flip,
 *    DSH_WEB_SEARCH_PROVIDER / DSH_WEB_FETCH_PROVIDER, per-realm composition
 *    bypass), and no Team-scoped fixed provider object exists here — the
 *    plane's fail-closed point accepts ONLY a createG2WebProviderSeam product
 *    (brand-verified) and mounts NOTHING otherwise.
 *  - MCP: the plane row mounts, registers, walks the real PA path and carries
 *    its B-MCP family block at full value (pinned). The durable family row
 *    lands at a NAMED CENTER BLOCKER this branch does not own: the PA family
 *    target-rule table (`PA_FAMILY_TARGET_RULES`, control/types.ts) carries no
 *    B-MCP entry, so the leg refuses the claim BEFORE any durable row, grant,
 *    consume or native entry — the exact landing point is pinned verbatim in
 *    the walk leg. Until the center registers the B-MCP target structure
 *    (the M0 §3 closed-set schema is the source; the flat rule grammar needs a
 *    center design decision for the per-operation variance), an approved MCP
 *    consumption cannot land — correctly, by fail-closed design.
 *  - BROWSER: NOT WIRED — PINNED BLOCKED by the root ruling: the Team
 *    assembly component (g2-team-assembly.mjs, the BROWSER port) is review-
 *    BLOCKED on lifecycle defects and its owner is fixing it on their own
 *    card; this branch never edits it and never implies browser-row
 *    readiness. What lands here is the honest wiring skeleton: the gate, the
 *    typed injection point, and the module's own honest declared_mount
 *    INACTIVE rows refusing every call verbatim (bundle-off default). The
 *    root gap list rides below as the pinned blocker note.
 *
 * Disclosed stand-ins (the lane specs own the REAL halves): the native
 * definitions the trio/six rows capture are TEST-owned objects (production:
 * the owning assembly's `tools.get(name, scope)` reads); the B-MCP
 * `declaredService` proof is the assembly-owner-side stand-in (production:
 * the connection-owning assembly supplies it from approved config). What THIS
 * spec proves is the WIRING law: what mounts, what registers, what walks, and
 * exactly which honest refusals stand where a real provider/proof/rule is
 * absent.
 *
 * Scope: NO Host, NO network, NO :3080; worlds are workspace-internal and
 * removed after.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g2-wire-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
import { parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { ToolBinding, RequestedEffectSet, AdmissionRequest } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlService } from '../control/index.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { untestedAssurance, definitionIdentityOf } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import {
  createPaControlLeg,
  createPaEffectsVerifier,
} from '../operation-permission/pa-control-bridge.js'
import type {
  PaControlLegInput,
  PaControlLegResult,
  PaEffectsVerifierDeps,
} from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_NOW,
  P6T4_ROOT,
  memberCaller,
  p6t4Seed, leaderCaller,} from './p6t4-helpers.js'

/** THE PINNED BROWSER BLOCKER (root ruling after the center review of
 *  6f9aec97). Recorded for this wire spec, NOT fixed here — the original G2
 *  component owner fixes g2-team-assembly.mjs on their own card. This branch
 *  never stages, merges or implies a browser row riding the unfixed
 *  component, and NEVER escalates it to Host/C2 tier. */
const G2_BROWSER_ASSEMBLY_BLOCKED = [
  'PINNED BLOCKED (root ruling): the Team BROWSER assembly component (g2-team-assembly.mjs createG2TeamBrowserPort) is review-BLOCKED on lifecycle defects;',
  'browser: direct openNativeBrowser connect -> Stagehand.create failure leaves no cleanup and execute ignores signal — cancel half-open per the public worker/real-connection ownership;',
  'attach without an owned Chromium may not fake cleanup;',
  'makeTransport must derive endpoint/spawn/config from ONE source;',
  'MCP pending connect not counted in close/inflight; failure has no rollback; concurrent reconnect overwrites client / swallows close failures / premature closed — needs serialized rotation, per-generation tracking, failure ownership;',
  'real Team-SCOPED register+close binding, never server-name matching.',
].join(' ')

interface PlaneAssemblyValue {
  ownNames: readonly string[]
  definitions: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
    execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
  }>
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
}
interface PlaneResult {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssemblyValue
}
type PlaneFactory = (input: Record<string, unknown>) => PlaneResult

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g2-wire: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-g2-wire-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

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
  registerA5GovernedFamily: (definitionIdentity: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (definitionIdentity: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}
const familyTable = registryModule.A5_GOVERNED_FAMILIES
const registerA5GovernedFamily = registryModule.registerA5GovernedFamily
const a5GovernedFamilyFor = registryModule.a5GovernedFamilyFor
const PLANE_PROVIDER = 'a5p5-plane'

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
    policySource: { staticLayerRefs: ['a5m2-g2-wire-tpl:directive-policy'], overlayGeneration: 0 },
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
      templateId: 'a5m2-g2-wire-tpl',
      cwd: CHAIN_WORLD,
      providerVersion: PLANE_PROVIDER,
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
const paVerifier = createPaEffectsVerifier({ readCallFacts: verifierReadCallFacts })

const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: paVerifier,
})

async function stateNow() {
  return service.listControlState(P6T4_ROOT)
}

// the leader's allow, found through the durable row (the todo-round idiom:
// the row is discovered by the plane's OWN callId in its reviewPayload —
// never by a spec-side re-derivation).
const approvedRowCallIds = new Set<string>()
async function approveRowForCall(callId: string): Promise<void> {
  const deadline = Date.now() + 3000
  for (;;) {
    if (!approvedRowCallIds.has(callId)) {
      const found = (await stateNow()).requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === callId)
      if (found !== undefined) {
        approvedRowCallIds.add(callId)
        await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: (found as { requestId: string }).requestId, decision: 'allow' })
        return
      }
    }
    if (Date.now() > deadline) throw new Error(`no durable PA row appeared for ${callId}`)
    await new Promise((r) => setTimeout(r, 5))
  }
}

// ── the committed G2 family modules (the reviewed candidates this wiring
//    mounts — imported, NEVER edited by this branch) ────────────────────────
const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
  A5_G2_WEB_MOUNT_NAMES: readonly string[]
  A5_G2_MCP_MOUNT_NAMES: readonly string[]
  A5_G2_BROWSER_MOUNT_NAMES: readonly string[]
}
const { A5_G2_WEB_MOUNT_NAMES, A5_G2_MCP_MOUNT_NAMES, A5_G2_BROWSER_MOUNT_NAMES } = planeModule
const G2A = (await import(new URL('../src/plugin/live/governed-families/g2-connector-adapters.mjs', import.meta.url).href)) as {
  A5_G2_FAMILY: Record<'web' | 'mcp' | 'browser', string>
  A5_G2_ADAPTER_REVISION: number
  A5_G2_TYPED_CODES: Record<string, string>
  A5_G2_NAMED_BLOCKERS: Record<'WEB' | 'MCP' | 'BROWSER', string>
  A5_G2_REGISTRATION_SCHEMAS: Record<string, unknown>
  createG2McpResourceAdapters: (deps: Record<string, unknown>) => Record<string, G2Row>
  createG2BrowserAdapters: (deps: Record<string, unknown>) => Record<string, G2Row>
}
const SEAMS = (await import(new URL('../src/plugin/live/governed-families/g2-provider-seams.mjs', import.meta.url).href)) as {
  G2_SEAM_BRAND: symbol
  consumeG2ApprovedPlan: (input: Record<string, unknown>) => Promise<Record<string, unknown>>
}
interface G2Row {
  familyId: string
  adapterRevision: number
  toolName: string
  operation: string
  mountCondition: string
  providerId: string
  active?: boolean
  registrationSchema: unknown
  classify: (args: unknown) => Promise<Record<string, unknown>> | Record<string, unknown>
  invoke: (args: unknown, exec: Record<string, unknown>) => Promise<Record<string, unknown>>
  drain: () => void
}

// ── TEST-owned native stand-ins (disclosed; the lane specs own the REAL
//    host bodies). The row must enter exactly the captured OBJECT; the
//    stand-ins record their entries so "zero native entry" is measured. ─────
interface CapturedCall { args: Record<string, unknown>; exec: Record<string, unknown> }
function makeNativeStandIn(name: string): { def: { name: string; description: string; execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown> }; calls: CapturedCall[] } {
  const calls: CapturedCall[] = []
  const def = {
    name,
    description: `TEST native ${name} description — the captured bytes the governed row must carry verbatim.`,
    execute(args: Record<string, unknown>, exec: Record<string, unknown>) {
      calls.push({ args, exec })
      return Promise.resolve({ text: `mcp-native:${name}` })
    },
  }
  return { def, calls }
}

const MCP_SERVER = 'g2w-server'
// The host StdioConfig shape @639ed01539: `command` is the argv ARRAY.
const MCP_DECLARED = Object.freeze({
  present: true as const,
  serverName: MCP_SERVER,
  transport: 'stdio',
  command: ['/usr/bin/true', '-stdio'],
})

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(key: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(key)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  plane: PlaneAssemblyValue
  rows: G2Row[]
  nativeCalls: Record<string, CapturedCall[]>
  legInputs: Record<string, unknown>[]
  legResults: PaControlLegResult[]
  observed: string[]
  registered: Record<string, string>
  mount: Record<string, unknown> | null
}
interface MountOpts {
  declared?: Record<string, unknown> | undefined
  inactive?: boolean
  surface?: 'mcp' | 'browser'
  familyGate?: 'g2McpEnabled' | 'g2BrowserEnabled'
  /** The production G2 TEAM MOUNT owns the rowset on this path: the signed
   *  ports + adapters ride the mount's OWN backends face, over the SAME
   *  readNative capture the plane sees (the mount places the SAME natives). */
  mountFactory?: (ctx: { readNative: (name: string) => { name: string; description: string; execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown> } | undefined }) => Promise<Record<string, unknown>>
  mountBackendKey?: 'g2Mcp' | 'g2Browser'
}
async function mountWorld(label: string, opts: MountOpts = {}): Promise<Mounted> {
  const surface = opts.surface ?? 'mcp'
  const gateKey = opts.familyGate ?? 'g2McpEnabled'
  const names = surface === 'mcp' ? A5_G2_MCP_MOUNT_NAMES : A5_G2_BROWSER_MOUNT_NAMES
  const natives: Record<string, ReturnType<typeof makeNativeStandIn>> = {}
  for (const n of names) natives[n] = makeNativeStandIn(n)
  const nativeOf = (n: string): ReturnType<typeof makeNativeStandIn> => {
    const nat = natives[n]
    if (nat === undefined) throw new Error(`no native stand-in allocated for ${n}`)
    return nat
  }
  const readNative = (name: string) => nativeOf(name).def
  let rows: G2Row[] = []
  const descriptions: Record<string, string> = {}
  for (const n of names) descriptions[n] = nativeOf(n).def.description
  let mount: Record<string, unknown> | null = null
  let createRowset: () => G2Row[] = () => {
    const built = surface === 'mcp'
      ? G2A.createG2McpResourceAdapters({
        realmId: `a5m2-g2-wire-${label}`,
        providerId: PLANE_PROVIDER,
        readNative,
        definitionIdentityOf,
        ...(opts.inactive === true ? {} : { declaredService: opts.declared ?? MCP_DECLARED }),
      })
      : G2A.createG2BrowserAdapters({
        realmId: `a5m2-g2-wire-${label}`,
        providerId: PLANE_PROVIDER,
        readNative,
        definitionIdentityOf,
        ...(opts.inactive === true ? {} : { declaredService: opts.declared ?? {} }),
      })
    rows = names.map((n) => built[n]).filter((r): r is G2Row => r !== undefined)
    if (surface === 'mcp' && opts.inactive !== true) {
      // the stdio trio answers the DECLARED server identity only; keep the
      // rowset closed to the three records.
      return rows
    }
    return rows
  }
  if (opts.mountFactory !== undefined) {
    mount = await opts.mountFactory({ readNative })
    const refused = mount as { ok?: boolean; code?: string; message?: string }
    if (refused.ok !== true) throw new Error(`the G2 team mount refused (${String(refused.code)}): ${String(refused.message)}`)
    const be = (mount as { backends?: Record<string, { createRowset: () => G2Row[]; descriptions: Record<string, string> }> }).backends?.[opts.mountBackendKey ?? 'g2Mcp']
    if (be === undefined) throw new Error('the G2 team mount answered no backend for this surface')
    createRowset = be.createRowset
    for (const n of names) {
      const captured = be.descriptions[n]
      if (typeof captured === 'string' && captured.length > 0) descriptions[n] = captured
    }
    rows = createRowset()
  }
  const realmId = `a5m2-g2-wire-${label}`
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
  const legResults: PaControlLegResult[] = []
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-g2-wire-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { [gateKey]: true },
    backends: { [surface === 'mcp' ? 'g2Mcp' : 'g2Browser']: { createRowset, descriptions } },
    authorityFacts: {
      overlayGeneration: async () => 0,
      ensureAuthorityCurrent: async () => {},
    },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput as Record<string, unknown>)
      const result = await createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
      legResults.push(result)
      return result
    },
    readCallFacts: async (input: Record<string, unknown>) => {
      const truth = realmTruths.get(String(input.realmId))
      if (truth === undefined) return undefined
      if (String(input.rootSessionId) !== P6T4_ROOT) return undefined
      const durable = repos.memberInstances.get(P6T4_ROOT, String(input.instanceId))
      if (durable === undefined) return undefined
      // The call's row identity: the tool-invoke effect carries the mounted
      // tool name (the readCallFacts seam speaks the plane's own fields — no
      // invented parameter is read).
      const effectList = (input.requestedEffects as { effects?: Array<{ kind?: string; toolName?: string }> } | undefined)?.effects ?? []
      const toolName = String(effectList.find((e) => e?.kind === 'tool-invoke')?.toolName ?? '')
      const binding = bindingOf(`${label}:${toolName}`)
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
          policySource: { staticLayerRefs: ['a5m2-g2-wire-tpl:directive-policy'], overlayGeneration: 0 },
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
            templateId: 'a5m2-g2-wire-tpl',
            cwd: CHAIN_WORLD,
            providerVersion: PLANE_PROVIDER,
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
  const registered: Record<string, string> = {}
  for (const name of names) {
    const fed = plane.placementFeed(name)
    const identity = String(fed?.definitionIdentity ?? '')
    if (identity.length === 0) throw new Error(`the placed ${name} row answered no placement definition identity`)
    // THE mount-time registration write — the PRODUCTION function (the
    // agent-bindings law), keyed by the runtime identity the seam minted.
    registerA5GovernedFamily(identity, {
      familyId: rows.find((r) => r.toolName === name)?.familyId ?? '',
      adapterRevision: rows.find((r) => r.toolName === name)?.adapterRevision ?? -1,
      providerIdentity: rows.find((r) => r.toolName === name)?.providerId ?? '',
    })
    registered[name] = identity
    const parsed = parseToolBinding({
      bindingId: `a5m2-g2-wire:${label}:${name}`,
      agentScopeKey: `a5m2-g2-wire:${label}:${name}`,
      toolName: name,
      definitionIdentity: identity,
      providerId: PLANE_PROVIDER,
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host', plane.realmId),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    if (!parsed.ok) throw new Error(`binding fixture refused: ${JSON.stringify(parsed)}`)
    bindingFixtures.set(`${label}:${name}`, parsed)
  }
  const nativeCalls: Record<string, CapturedCall[]> = {}
  for (const n of names) nativeCalls[n] = nativeOf(n).calls
  return { plane, rows, nativeCalls, legInputs, legResults, observed, registered, mount }
}

function execFor(callId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: { id: WORKER },
    // THE real Host exec shape (fixed 639 ToolExecution): one branded symbol
    // per execution; NO tokenKey (that field does not exist on the public
    // surface). Replay legs reuse the SAME exec object.
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

const basePlaneInput = (realmId: string, plane: Record<string, unknown> = {}): Record<string, unknown> => ({
  permissionPolicy: DIRECT_POLICY,
  realmId,
  templateId: 'a5m2-g2-wire-tpl',
  role: 'member',
  instanceId: WORKER,
  teamSessionId: P6T4_ROOT,
  plane,
})

describe('A5M2-G2-WIRE C1: the external-connection family mounts on the governed-row pattern, fail-closed everywhere a real provider/proof/rule is absent', () => {
  it('zero-flip law: no key and explicit-false are byte-identical worlds; none of the eleven G2 spellings mounts', () => {
    const off = planeModule.createTeamToolPlaneAssembly(basePlaneInput('a5m2-g2-wire-off'))
    expect(off.ok, JSON.stringify(off.message)).toBe(true)
    const explicitOff = planeModule.createTeamToolPlaneAssembly(basePlaneInput('a5m2-g2-wire-off2', {
      g2WebEnabled: false, g2McpEnabled: false, g2BrowserEnabled: false,
    }))
    expect(explicitOff.ok, JSON.stringify(explicitOff.message)).toBe(true)
    expect(explicitOff.value?.ownNames).toEqual(off.value?.ownNames)
    for (const spelling of [...A5_G2_WEB_MOUNT_NAMES, ...A5_G2_MCP_MOUNT_NAMES, ...A5_G2_BROWSER_MOUNT_NAMES]) {
      expect(off.value?.ownNames.includes(spelling), spelling).toBe(false)
    }
  })

  it('closed-key pairing BOTH directions on every surface + a non-boolean gate is a config defect on the existing refusal grammar', () => {
    const surfaces: Array<[string, string, string]> = [
      ['g2WebEnabled', 'g2Web', 'G2_WEB_INJECT_INVALID'],
      ['g2McpEnabled', 'g2Mcp', 'G2_MCP_INJECT_INVALID'],
      ['g2BrowserEnabled', 'g2Browser', 'G2_BROWSER_INJECT_INVALID'],
    ]
    const inject = { createRowset: () => [{ toolName: 'x', familyId: 'X', adapterRevision: 1, providerId: PLANE_PROVIDER, mountCondition: 'always', registrationSchema: { type: 'object' }, classify: () => ({}), invoke: async () => ({}), drain: () => {} }], descriptions: { x: 'd' } }
    for (const [key, injectKey, code] of surfaces) {
      // (a) key on, no injection -> refuse (nothing may mask native names with nothing behind it)
      const halfA = planeModule.createTeamToolPlaneAssembly(basePlaneInput(`a5m2-g2-wire-halfA-${injectKey}`, { [key]: true }))
      expect(halfA.ok).toBe(false)
      expect(halfA.code).toBe(code)
      expect(String(halfA.message)).toContain('there is no fallback row and no silent disable')
      // (b) injection, key off -> refuse (config law, not wiring)
      const halfB = planeModule.createTeamToolPlaneAssembly({
        ...basePlaneInput(`a5m2-g2-wire-halfB-${injectKey}`),
        backends: { [injectKey]: { createRowset: () => [], descriptions: {} } },
      })
      expect(halfB.ok).toBe(false)
      expect(halfB.code).toBe(code)
      expect(String(halfB.message)).toContain('the gate is config law, not wiring')
      // (c) non-boolean gate -> the EXISTING refusal grammar
      const badGate = planeModule.createTeamToolPlaneAssembly({
        ...basePlaneInput(`a5m2-g2-wire-badGate-${injectKey}`, { [key]: 'yes' }),
        backends: { [injectKey]: inject },
      })
      expect(badGate.ok).toBe(false)
      expect(badGate.code).toBe('PLANE_CONFIG_INCOMPLETE')
    }
  })

  it('WEB is a fail-closed TYPED injection point, not a route: the named Team-only FIXED provider blocker and the seam-brand law refuse every web mount this world can supply', () => {
    const descriptions = { web_search: 'TEST native web_search description.', web_fetch: 'TEST native web_fetch description.' }
    const webRow = (toolName: string): Record<string, unknown> => ({
      toolName, familyId: G2A.A5_G2_FAMILY.web, adapterRevision: G2A.A5_G2_ADAPTER_REVISION,
      providerId: PLANE_PROVIDER, mountCondition: 'always',
      registrationSchema: G2A.A5_G2_REGISTRATION_SCHEMAS[toolName],
      classify: () => ({ ok: false }), invoke: async () => ({ ok: false }), drain: () => {},
    })
    // (a) injection WITHOUT the Team-only fixed provider lanes: named-blocker refusal, forbidden routes quoted
    const noLanes = planeModule.createTeamToolPlaneAssembly({
      ...basePlaneInput('a5m2-g2-wire-web-nolanes', { g2WebEnabled: true }),
      backends: { g2Web: { createRowset: () => [webRow('web_search'), webRow('web_fetch')], descriptions } },
    })
    expect(noLanes.ok).toBe(false)
    expect(noLanes.code).toBe('G2_WEB_INJECT_INVALID')
    expect(String(noLanes.message)).toContain('teamFixedWebProviderLanes is required')
    expect(String(noLanes.message)).toContain('WEB global/env per-realm composition is FORBIDDEN')
    expect(String(noLanes.message)).toContain('DSH_WEB_SEARCH_PROVIDER')
    // (b) a lane whose provider is NOT a createG2WebProviderSeam product (no brand): refused at the row check
    const unbranded = planeModule.createTeamToolPlaneAssembly({
      ...basePlaneInput('a5m2-g2-wire-web-unbranded', { g2WebEnabled: true }),
      backends: {
        g2Web: {
          createRowset: () => [webRow('web_search')],
          descriptions,
          teamFixedWebProviderLanes: {
            web_search: {
              provider: { id: 'hand-made', available: () => true, search: async () => ({}) },
              registrationLaw: { configuredProviderIdMustEqual: 'hand-made' },
              stats: () => ({}),
            },
          },
        },
      },
    })
    expect(unbranded.ok).toBe(false)
    expect(unbranded.code).toBe('G2_WEB_INJECT_INVALID')
    expect(String(unbranded.message)).toContain('createG2WebProviderSeam product')
    expect(String(unbranded.message)).toContain('never a hand-made stand-in')
    // (c) the seams module carries the brand the check reads (no invented constant)
    expect(typeof SEAMS.G2_SEAM_BRAND).toBe('symbol')
    // (d) a BROWSER/MCP injection carrying the WEB-only lane face is a contract confusion
    const confused = planeModule.createTeamToolPlaneAssembly({
      ...basePlaneInput('a5m2-g2-wire-web-confused', { g2McpEnabled: true }),
      backends: { g2Mcp: { createRowset: () => [], descriptions: {}, teamFixedWebProviderLanes: {} } },
    })
    expect(confused.ok).toBe(false)
    expect(confused.code).toBe('G2_MCP_INJECT_INVALID')
    expect(String(confused.message)).toContain('B-WEB-only face')
  })

  it('rowset contract refusals: the factory throw rides VERBATIM; empty/async rowsets, cross-family or non-closed names, a foreign providerIdentity and missing captured descriptions all refuse the mount', () => {
    const blocker = new Error('NAMED BLOCKER: no Team-scoped fixed provider is suppliable in this world — refusing the mount instead of substituting')
    const thrown = planeModule.createTeamToolPlaneAssembly({
      ...basePlaneInput('a5m2-g2-wire-rowset-throw', { g2WebEnabled: true }),
      backends: { g2Web: { createRowset: () => { throw blocker }, descriptions: {}, teamFixedWebProviderLanes: { web_search: {}, web_fetch: {} } } },
    })
    expect(thrown.ok).toBe(false)
    expect(thrown.code).toBe('G2_WEB_INJECT_INVALID')
    expect(String(thrown.message)).toContain(blocker.message)
    const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
      toolName: 'list_mcp_resources', familyId: G2A.A5_G2_FAMILY.mcp, adapterRevision: G2A.A5_G2_ADAPTER_REVISION,
      providerId: PLANE_PROVIDER, mountCondition: 'declared_mount',
      registrationSchema: G2A.A5_G2_REGISTRATION_SCHEMAS.list_mcp_resources,
      classify: () => ({ ok: false }), invoke: async () => ({ ok: false }), drain: () => {},
      ...over,
    })
    const mountWith = (realm: string, createRowset: () => unknown, descriptions: Record<string, string> = { list_mcp_resources: 'TEST captured bytes.' }) =>
      planeModule.createTeamToolPlaneAssembly({
        ...basePlaneInput(realm, { g2McpEnabled: true }),
        backends: { g2Mcp: { createRowset, descriptions } },
      })
    const empty = mountWith('a5m2-g2-wire-rowset-empty', () => [])
    expect(empty.ok).toBe(false)
    expect(String(empty.message)).toContain('no non-empty rowset array')
    const async = mountWith('a5m2-g2-wire-rowset-async', () => Promise.resolve([row()]))
    expect(async.ok).toBe(false)
    expect(String(async.message)).toContain('must answer synchronously')
    const crossFamily = mountWith('a5m2-g2-wire-rowset-cross', () => [row({ toolName: 'web_fetch', familyId: G2A.A5_G2_FAMILY.web })])
    expect(crossFamily.ok).toBe(false)
    expect(String(crossFamily.message)).toContain('closed B-MCP spellings')
    const invented = mountWith('a5m2-g2-wire-rowset-invented', () => [row({ toolName: 'do_everything' })])
    expect(invented.ok).toBe(false)
    expect(String(invented.message)).toContain('closed B-MCP spellings')
    const foreign = mountWith('a5m2-g2-wire-rowset-foreign', () => [row({ providerId: 'someone-else' })])
    expect(foreign.ok).toBe(false)
    expect(String(foreign.message)).toContain('providerIdentity is not')
    const noDescription = mountWith('a5m2-g2-wire-rowset-nodesc', () => [row()], {})
    expect(noDescription.ok).toBe(false)
    expect(String(noDescription.message)).toContain('captured native description')
    const twice = mountWith('a5m2-g2-wire-rowset-twice', () => [row(), row()])
    expect(twice.ok).toBe(false)
    expect(String(twice.message)).toContain('one name, one placement')
  })

  it('BROWSER surface: PINNED BLOCKED — the root lifecycle-gap note rides this spec verbatim; only the module\u2019s own honest declared_mount INACTIVE six mount, every call refuses typed, zero native entry', async () => {
    // The blocker note is PINNED (recorded for the center; fixed by the G2
    // component owner on their own card — never on this branch).
    for (const clause of [
      'review-BLOCKED on lifecycle defects',
      'openNativeBrowser connect -> Stagehand.create failure leaves no cleanup',
      'execute ignores signal',
      'attach without an owned Chromium may not fake cleanup',
      'ONE source',
      'serialized rotation, per-generation tracking, failure ownership',
      'never server-name matching',
    ]) {
      expect(G2_BROWSER_ASSEMBLY_BLOCKED, clause).toContain(clause)
    }
    // The module\u2019s own BROWSER named blocker exists and stays honest.
    expect(G2A.A5_G2_NAMED_BLOCKERS.BROWSER).toContain('zero-launch')
    const world = await mountWorld('browser-inactive', { surface: 'browser', familyGate: 'g2BrowserEnabled', inactive: true })
    expect(world.rows.length).toBe(6)
    for (const row of world.rows) {
      expect(row.active, row.toolName).toBe(false)
      expect(row.mountCondition).toBe('declared_mount')
      const def = world.plane.definitions.find((d) => d.name === row.toolName)
      expect(def, row.toolName).toBeDefined()
      await expect(def?.execute({ instruction: 'x', url: 'https://a.example' }, execFor(`browser-${row.toolName}`))).rejects.toThrow(/P_G2_DECLARED_MOUNT_ABSENT/)
      await expect(def?.execute({ instruction: 'x' }, execFor(`browser2-${row.toolName}`))).rejects.toThrow(
        new RegExp(`${row.toolName}: declared_mount is unproven \\(the experimental stagehand provider is not declared present by the owning assembly; the bundle is off by default\\): the six rows stay unmounted and substitute nothing`),
      )
      expect(world.nativeCalls[row.toolName]?.length ?? 0).toBe(0)
    }
    // nothing was asked, nothing was authorized, nothing ran.
    const state = await stateNow()
    expect(state.requests.length).toBe(0)
  })

  it('MCP declared_mount ABSENT: the trio mounts at the native spellings as honest INACTIVE rows; classify refuses P_G2_DECLARED_MOUNT_ABSENT with the module wording VERBATIM; zero rows, zero native entry', async () => {
    const world = await mountWorld('mcp-inactive', { inactive: true })
    const state0 = await stateNow()
    for (const name of [...A5_G2_MCP_MOUNT_NAMES]) {
      const def = world.plane.definitions.find((d) => d.name === name)
      expect(def, name).toBeDefined()
      // the captured native description bytes + the closed registration face
      expect(def?.description).toBe(`TEST native ${name} description — the captured bytes the governed row must carry verbatim.`)
      expect(def?.parameters).toEqual(G2A.A5_G2_REGISTRATION_SCHEMAS[name])
      await expect(def?.execute({ server: MCP_SERVER }, execFor(`inactive-${name}`))).rejects.toThrow(
        new RegExp(`refused-g2 P_G2_DECLARED_MOUNT_ABSENT — ${name}: declared_mount is unproven \\(no present flag\\): the MCP server this trio would speak for is not declared present by the owning assembly — nothing mounts and nothing is substituted \\(zero rows, zero grants, zero native entry\\)`),
      )
      expect(world.nativeCalls[name]?.length ?? 0).toBe(0)
    }
    const state1 = await stateNow()
    expect(state1.requests.length).toBe(state0.requests.length)
    // the mount-time family registration STILL stands for every placed name:
    // keyed by the runtime placement identity, frozen, answering the B-MCP
    // family (the mount registers; the row refuses — the two facts are
    // independent and both honest).
    for (const name of [...A5_G2_MCP_MOUNT_NAMES]) {
      const fed = world.plane.placementFeed(name)
      const identity = String(fed?.definitionIdentity ?? '')
      expect(identity.length).toBeGreaterThan(0)
      expect(world.registered[name]).toBe(identity)
      expect(familyTable[identity]).toEqual({ familyId: G2A.A5_G2_FAMILY.mcp, adapterRevision: G2A.A5_G2_ADAPTER_REVISION, providerIdentity: PLANE_PROVIDER })
      expect(Object.isFrozen(familyTable[identity])).toBe(true)
      expect(a5GovernedFamilyFor(identity)).toBe(familyTable[identity])
    }
  })

  it('MCP ACTIVE trio: the row walks the ONE PA path carrying its B-MCP family block at FULL value and lands at the named CENTER blocker (no PA_FAMILY_TARGET_RULES entry) BEFORE any durable row, grant, consume or native entry; single-flight law rides the shared ledger', async () => {
    const world = await mountWorld('mcp-active')
    const def = world.plane.definitions.find((d) => d.name === 'list_mcp_resources')
    expect(def).toBeDefined()
    // (a) exec-token-unbound: zero classify, zero walk, zero row.
    await expect(def?.execute({ server: MCP_SERVER }, { agent: { id: WORKER } })).rejects.toThrow(/refused-g2 exec-token-unbound/)
    // (b) the walk: a REAL token, one flight. Since the family-rules lane
    //     LANDED the B-MCP rule map (f1e0c92ec cherry-pick) and this lane
    //     landed the D1-D3 flat mint (adapter revision 2), the claim PASSES
    //     the typed target law; the leader's allow consumes it and the row's
    //     captured-native dispatch fires — the FIRST end-to-end green on this
    //     family. The un-mounted world's row is the DEFAULT rowset: its
    //     connectionIncarnation is the honest 'unobserved' and D2 keeps the
    //     full blocker text as the reason.
    const exec1 = execFor('active-1')
    const running = def?.execute({ server: MCP_SERVER }, exec1) as Promise<Record<string, unknown>>
    await approveRowForCall(`plane-g2:${world.plane.realmId}-1`)
    const outcome = await running
    expect(outcome).toBeDefined()
    expect(world.legInputs.length).toBe(1)
    const legInput = world.legInputs[0] as Record<string, Record<string, unknown>>
    expect(String(legInput.callId)).toBe(`plane-g2:${world.plane.realmId}-1`)
    expect(legInput.family).toEqual(expect.objectContaining({
      familyId: G2A.A5_G2_FAMILY.mcp,
      adapterRevision: G2A.A5_G2_ADAPTER_REVISION,
      providerIdentity: PLANE_PROVIDER,
    }))
    const manifest = legInput.family?.targetManifest as Record<string, unknown>
    expect(manifest.mcpVariant).toBe('stdio:list')
    expect(manifest.operation).toBe('resources/list')
    expect(manifest.server).toBe(MCP_SERVER)
    expect(manifest.cursor).toBeNull()
    expect(manifest.connectionIncarnation).toBe('unobserved')
    expect(String(manifest.connectionIncarnationReason)).toContain('NAMED BLOCKER (B-MCP)')
    expect(manifest.domainAuthorityId).toBeNull()
    expect(String(world.legResults[0]?.decision)).toBe('approve')
    expect(world.nativeCalls.list_mcp_resources?.length ?? 0).toBe(1)
    // (c) exec-token-replay on the SHARED ledger: the SPENT token never
    //     re-arms; a consumed call is never re-run by a replayed token.
    await expect(def?.execute({ server: MCP_SERVER }, exec1)).rejects.toThrow(/refused-g2 exec-token-replay/)
    expect(world.legInputs.length).toBe(1)
    expect(world.nativeCalls.list_mcp_resources?.length ?? 0).toBe(1)
  })

  it('the server-identity law survives the wiring: an undeclared server swap refuses INSIDE the row before the walk (zero leg, zero row, zero native entry)', async () => {
    const world = await mountWorld('mcp-identity')
    const def = world.plane.definitions.find((d) => d.name === 'read_mcp_resource')
    expect(def).toBeDefined()
    const state0 = await stateNow()
    await expect(def?.execute({ server: 'a-different-server', uri: 'mcp://x' }, execFor('identity-1'))).rejects.toThrow(
      /refused-g2 P_G2_CLASSIFY_INVALID_ARGUMENTS — .*is not the declared server of this mount/,
    )
    expect(world.legInputs.length).toBe(0)
    const state = await stateNow()
    expect(state.requests.length).toBe(state0.requests.length)
    expect(world.nativeCalls.read_mcp_resource?.length ?? 0).toBe(0)
  })

  it('drain law through the mounted def: after the row drains, a fresh token\u2019s call refuses P_G2_DRAINING with zero walk, zero row and zero native entry (an entered body is never rewound)', async () => {
    const world = await mountWorld('mcp-drain')
    const row = world.rows.find((r) => r.toolName === 'list_mcp_resources')
    row?.drain()
    const def = world.plane.definitions.find((d) => d.name === 'list_mcp_resources')
    const state0 = await stateNow()
    await expect(def?.execute({ server: MCP_SERVER }, execFor('drain-1'))).rejects.toThrow(/refused-g2 P_G2_DRAINING/)
    expect(world.legInputs.length).toBe(0)
    expect(world.nativeCalls.list_mcp_resources?.length ?? 0).toBe(0)
    const state = await stateNow()
    expect(state.requests.length).toBe(state0.requests.length)
  })
})

const MOUNT = (await import(new URL('../src/plugin/live/governed-families/g2-team-mount.mjs', import.meta.url).href)) as {
  createG2TeamMount: (input: Record<string, unknown>) => Promise<Record<string, unknown>>
}

interface StandInSdk {
  Client: new (_i: unknown, _o: unknown) => unknown
  makeTransport: (target: Record<string, unknown>) => Record<string, unknown>
  connects: unknown[]
  sends: unknown[]
  clientCalls: Array<{ method: string; params: unknown; options: Record<string, unknown> | undefined }>
  transports: Array<{ closed: boolean; target: Record<string, unknown> }>
}
function makeStandInSdk(): StandInSdk {
  const connects: unknown[] = []
  const sends: unknown[] = []
  const clientCalls: Array<{ method: string; params: unknown; options: Record<string, unknown> | undefined }> = []
  const transports: Array<{ closed: boolean; target: Record<string, unknown> }> = []
  // DISCLOSED stand-in for the pinned @modelcontextprotocol/client 2.0.0:
  // implements the REAL generation dispatch trio the seam requires
  // (g2-provider-seams.mjs:498 @this tree; the host maps them at
  // mcp-client connection.ts:373-381 @639ed01539). The REAL-SDK legs are the
  // owner's venue (kernel checkout, 17/17); THIS venue proves the mount law.
  class ClientStandIn {
    onclose: (() => void) | null = null
    constructor(_info: unknown, _opts: unknown) {}
    async connect(transport: Record<string, unknown>): Promise<void> {
      connects.push(transport)
      const start = transport.start as (() => Promise<void>) | undefined
      if (typeof start === 'function') await start()
    }
    async close(): Promise<void> {}
    async listResources(params: unknown, options?: Record<string, unknown>) {
      clientCalls.push({ method: 'listResources', params, options })
      return { resources: [{ uri: 'mcp://res/42', name: 'res-42' }] }
    }
    async listResourceTemplates(params: unknown, options?: Record<string, unknown>) {
      clientCalls.push({ method: 'listResourceTemplates', params, options })
      return { resourceTemplates: [] }
    }
    async readResource(params: unknown, options?: Record<string, unknown>) {
      clientCalls.push({ method: 'readResource', params, options })
      return { contents: [{ uri: 'mcp://res/42', text: 'res-42-body' }] }
    }
  }
  const makeTransport = (target: Record<string, unknown>): Record<string, unknown> => {
    const rec = { closed: false, target }
    transports.push(rec)
    return {
      start: async () => {},
      send: (frame: unknown) => { sends.push(frame) },
      close: async () => { rec.closed = true },
    }
  }
  return { Client: ClientStandIn, makeTransport, connects, sends, clientCalls, transports }
}

describe('A5M2-G2-WIRE mount legs round-17: the signed Team ports behind the plane faces — Team-only face binding, REAL dispatch on the generation, the generation tie at consume, awaited cleanup', () => {
  it('the absent world stays honest: no mounts, and WEB answers the SIGNED route gap verbatim (no global/env route rides)', async () => {
    const m = (await MOUNT.createG2TeamMount({ realmId: 'r', providerId: PLANE_PROVIDER, readNative: () => undefined, definitionIdentityOf })) as { ok: boolean; backends: Record<string, unknown>; webRouteGap: Record<string, string>; dispose: () => Promise<{ ok: boolean }> }
    expect(m.ok).toBe(true)
    expect(Object.keys(m.backends)).toEqual([])
    expect(m.webRouteGap.publicFaces).toContain('registerSearchProvider')
    expect(m.webRouteGap.gap).toContain('CORE_SEAM_BLOCKER')
    expect(m.backends.g2Web).toBeUndefined()
    expect((await m.dispose()).ok).toBe(true)
  })

  it('refusal laws AWAIT their cleanup: no PASSED scope face means NO registration (never a global lookup) and the half-built port is really closed; attach without cdpEndpoint and a browser mount without the REQUIRED callResource mapping refuse CONFIG_INCOMPLETE', async () => {
    const sdk = makeStandInSdk()
    const noFace = (await MOUNT.createG2TeamMount({
      realmId: 'r', providerId: PLANE_PROVIDER, readNative: (n: string) => ({ name: n, description: 'd', execute: async () => ({}) }), definitionIdentityOf,
      mcpMount: { declaredSurfaceConfig: { ...MCP_DECLARED }, resourceServerName: MCP_SERVER, entries: { Client: sdk.Client }, makeTransport: sdk.makeTransport, toolCallTimeoutMs: 1234    },
    })) as { ok: boolean; code?: string; message?: string }
    expect(noFace.ok).toBe(false)
    expect(noFace.code).toBe('P_G2_ASM_FACE_INCOMPLETE')
    expect(sdk.transports.length).toBe(0)
    const badAttach = (await MOUNT.createG2TeamMount({
      realmId: 'r', providerId: PLANE_PROVIDER, readNative: (n: string) => ({ name: n, description: 'd', execute: async () => ({}) }), definitionIdentityOf,
      browserMount: { mode: 'attach', nativeConfig: {}, entries: { launchChromium: async () => ({}), openBrowserWorker: async () => ({}) }, consumeApproval: async () => 'consumed', callResource: async () => ({}) },
    })) as { ok: boolean; code?: string }
    expect(badAttach.ok).toBe(false)
    expect(badAttach.code).toBe('P_G2_ASM_CONFIG_INCOMPLETE')
    const noMap = (await MOUNT.createG2TeamMount({
      realmId: 'r', providerId: PLANE_PROVIDER, readNative: (n: string) => ({ name: n, description: 'd', execute: async () => ({}) }), definitionIdentityOf,
      browserMount: { mode: 'launch', nativeConfig: {}, entries: { launchChromium: async () => ({}), openBrowserWorker: async () => ({}) }, consumeApproval: async () => 'consumed' },
    })) as { ok: boolean; code?: string; message?: string }
    expect(noMap.ok).toBe(false)
    expect(noMap.code).toBe('P_G2_ASM_CONFIG_INCOMPLETE')
    expect(String(noMap.message)).toContain('callResource')
  })

  it('MCP mount, REAL dispatch: the Team-scoped register binds the PASSED face; the FIRST generation is up BEFORE placement (gen-1 rides the approved question); an approved call DISPATCHES on the mount generation client (uri verbatim, the approved 1234ms timeout in options, ZERO captured-native entry); the flat rev-2 target carries mcpVariant/spawn/cursor/connection at FULL value with no fingerprint; a rotation to gen-2 REFUSES consume on the generation tie; dispose closes for real', async () => {
    const sdk = makeStandInSdk()
    const faceCalls: Array<{ server: string; provider: Record<string, unknown> }> = []
    let disposers = 0
    const face = {
      register: (server: string, provider: Record<string, unknown>) => {
        faceCalls.push({ server, provider })
        return () => { disposers += 1 }
      },
    }
    let portsRef: Record<string, { stats: () => Record<string, unknown>; request: (req: unknown, exec: unknown) => Promise<unknown> }> = {}
    const world = await mountWorld('mount-active', {
      mountFactory: async ({ readNative }) => {
        const m = (await MOUNT.createG2TeamMount({
          realmId: 'a5m2-g2-wire-mount-active', providerId: PLANE_PROVIDER, readNative, definitionIdentityOf,
          scopeFaces: { mcpResources: face },
          mcpMount: { declaredSurfaceConfig: { ...MCP_DECLARED }, resourceServerName: MCP_SERVER, entries: { Client: sdk.Client }, makeTransport: sdk.makeTransport, toolCallTimeoutMs: 1234 },
        })) as Record<string, unknown>
        if (m.ok !== true) throw new Error(`mount refused: ${String(m.code)} ${String(m.message)}`)
        portsRef = m.ports as typeof portsRef
        return m
      },
    })
    expect(faceCalls.length).toBe(1)
    expect(faceCalls[0]?.server).toBe(MCP_SERVER)
    expect(sdk.connects.length).toBe(1)
    expect(portsRef.mcp!.stats().generation).toBe('gen-1')
    const read = world.plane.definitions.find((d) => d.name === 'read_mcp_resource')
    expect(world.rows.length).toBe(3)
    // POSITIVE DISPATCH through the ONE PA path: approve, then the mount's
    // TEAM-BOUND invoke answers on the approved generation's client.
    const callId = `plane-g2:${world.plane.realmId}-1`
    const running = read?.execute({ server: MCP_SERVER, uri: 'mcp://res/42' }, execFor('mount-1')) as Promise<Record<string, unknown>>
    await approveRowForCall(callId)
    const outcome = await running
    const contents = (outcome as { contents?: Array<{ text?: string }> }).contents
    expect(contents?.[0]?.text).toBe('res-42-body')
    expect(sdk.clientCalls.length).toBe(1)
    expect(sdk.clientCalls[0]?.method).toBe('readResource')
    expect((sdk.clientCalls[0]?.params as Record<string, unknown>).uri).toBe('mcp://res/42')
    expect(sdk.clientCalls[0]?.options?.timeout).toBe(1234)
    // the captured native was NEVER the door: zero native entries.
    for (const n of ['list_mcp_resources', 'read_mcp_resource', 'list_mcp_resource_templates']) expect(world.nativeCalls[n]?.length ?? 0).toBe(0)
    // the FLAT rev-2 target (D1/D2/D3), machine-pinned fingerprint-free.
    const manifest = (world.legInputs[0] as { family?: { targetManifest?: Record<string, unknown> } }).family?.targetManifest as Record<string, unknown>
    expect(manifest.mcpVariant).toBe('stdio:read')
    expect(manifest.operation).toBe('resources/read')
    expect(manifest.record).toBe('surface:mcp_stdio')
    expect(manifest.transport).toBe('stdio')
    expect(manifest.spawnArgv0).toBe('/usr/bin/true')
    expect(manifest.spawnArgCount).toBe(1)
    expect(manifest.spawnCwd).toBe('') // the RAW empty string survives (no falsy normalization)
    expect(manifest.connectionIncarnation).toBe('gen-1')
    expect(manifest.connectionIncarnationReason).toBeNull() // D2: a real gen up => measured absence, null
    expect(manifest.domainAuthorityId).toBeNull()
    expect(manifest.uriVerbatim).toBe('mcp://res/42')
    expect(typeof manifest.uriOpacity).toBe('string')
    expect('surface' in manifest).toBe(false)
    expect('cursor' in manifest).toBe(false) // cursor is STRUCTURALLY out on read groups
    for (const key of Object.keys(manifest)) expect(key.toLowerCase()).not.toContain('fingerprint')
    // cursor variants: raw value binds; ABSENCE emits null (D2), never a
    // missing key, and the null NEVER rides the native leg.
    const list = world.plane.definitions.find((d) => d.name === 'list_mcp_resources')
    const running2 = list?.execute({ server: MCP_SERVER, cursor: 'page-2' }, execFor('mount-2')) as Promise<unknown>
    await approveRowForCall(`plane-g2:${world.plane.realmId}-2`)
    await running2
    const manifest2 = (world.legInputs[1] as { family?: { targetManifest?: Record<string, unknown> } }).family?.targetManifest as Record<string, unknown>
    expect(manifest2.mcpVariant).toBe('stdio:list')
    expect(manifest2.cursor).toBe('page-2')
    const running3 = list?.execute({ server: MCP_SERVER }, execFor('mount-3')) as Promise<unknown>
    await approveRowForCall(`plane-g2:${world.plane.realmId}-3`)
    await running3
    const manifest3 = (world.legInputs[2] as { family?: { targetManifest?: Record<string, unknown> } }).family?.targetManifest as Record<string, unknown>
    expect(manifest3.cursor).toBeNull()
    expect(sdk.clientCalls.length).toBe(3)
    // THE GENERATION TIE (root 19:31 item 3): rotate underneath the mount —
    // an approval against gen-1 now REFUSES consume on the drift law.
    const rotated = (portsRef.mcp as unknown as { reconnect: () => Promise<unknown> })
    await rotated.reconnect()
    expect(portsRef.mcp!.stats().generation).toBe('gen-2')
    const callsBefore = sdk.clientCalls.length
    // the drift refusal sits AT CONSUME: the approval still lands (the
    // target facts are unchanged), the generation tie refuses the BODY.
    const running4 = read?.execute({ server: MCP_SERVER, uri: 'mcp://res/43' }, execFor('mount-4')) as Promise<unknown>
    await approveRowForCall(`plane-g2:${world.plane.realmId}-4`)
    await expect(running4).rejects.toThrow(/GENERATION_DRIFT|P_G2_EDGE_REFUSED/)
    expect(sdk.clientCalls.length).toBe(callsBefore) // zero forwarding on drift
    // close-drain: the bound face unregisters, the owned generations close,
    // and afterwards the port refuses SCOPE_CLOSED.
    const mount = world.mount as { dispose: () => Promise<{ ok: boolean; failures: string[] }> }
    const closed = await mount.dispose()
    expect(closed, JSON.stringify(closed.failures)).toEqual({ ok: true, failures: [] })
    expect(disposers).toBe(1)
    const after = portsRef.mcp!.stats()
    expect(after.disposed).toBe(true)
    expect(after.transportsClosed).toBe(2) // gen-1 and gen-2 both really closed
    await expect(portsRef.mcp!.request({ server: MCP_SERVER, method: 'resources/list' }, {})).rejects.toThrow(/SCOPE_CLOSED/)
  })

  it('BROWSER mount supply leg: the row actuates through the SIGNED port lease (consumeApproval -> worker -> callResource mapping), never through the captured native; the PLANE leg stays fail-closed at the still-unregistered B-BROWSER target rule (a different lane — no fake green)', async () => {
    const workerCalls: Array<{ resource: unknown; method: unknown; args: unknown }> = []
    const approvals: string[] = []
    const factsSeen: Record<string, unknown>[] = []
    const world = await mountWorld('browser-supply', {
      surface: 'browser',
      familyGate: 'g2BrowserEnabled',
      mountBackendKey: 'g2Browser',
      mountFactory: async ({ readNative }) => {
        const m = (await MOUNT.createG2TeamMount({
          realmId: 'a5m2-g2-wire-browser-supply', providerId: PLANE_PROVIDER, readNative, definitionIdentityOf,
          browserMount: {
            mode: 'launch', nativeConfig: {},
            declaredServiceFacts: { modelOrigin: 'https://model.example.invalid' },
            entries: { launchChromium: async () => ({ pid: 4242, endpoint: 'http://127.0.0.1:9222', close: async () => {} }), openBrowserWorker: async () => ({ tab: 't1', close: async () => {} }) },
            consumeApproval: async (facts: Record<string, unknown>) => { approvals.push(String(facts.toolName)); factsSeen.push(facts); return 'consumed' },
            callResource: async (resource: unknown, method: unknown, args: unknown) => { workerCalls.push({ resource, method, args }); return { ok: true, acted: String(method) } },
          },
        })) as Record<string, unknown>
        if (m.ok !== true) throw new Error(`browser mount refused: ${String(m.code)} ${String(m.message)}`)
        return m
      },
    })
    expect(world.rows.length).toBe(6)
    // supply routing (invoke level — the governance walk is the PLANE leg
    // below): the port lease runs the caller mapping on the OPENED worker.
    const row = world.rows.find((r) => r.toolName === 'stagehand_navigate')
    const acted = await row!.invoke({ url: 'https://example.invalid' }, { agent: { id: WORKER }, g2ApprovedCallId: 'plane-g2:w-browser-supply-7', g2ConsumedProof: { grant: { grantId: 'gr-7' } } })
    expect(acted).toEqual({ ok: true, value: { ok: true, acted: 'navigate' } })
    expect(workerCalls.length).toBe(1)
    expect(workerCalls[0]?.method).toBe('navigate')
    expect(workerCalls[0]?.resource).toBeDefined() // the OPENED worker chain rides the mapping (the port's own open law shapes it)
    expect(approvals).toEqual(['stagehand_navigate'])
    expect(factsSeen[0]?.approvedCallId).toBe('plane-g2:w-browser-supply-7') // the ONE correlation fact rides the lease facts
    expect((factsSeen[0]?.consumedProof as { grant?: { grantId?: string } })?.grant?.grantId).toBe('gr-7') // the kernel witness struct rides unchanged
    expect(world.nativeCalls.stagehand_navigate?.length ?? 0).toBe(0)
    // the PLANE leg (updated @ root 21:57 table round): the B-BROWSER rule
    // EXISTS now (this lane's table entry) — the walk fail-closes on the
    // rowset's OLD hand-written nested claim (no flat browserVariant mint
    // until the adapters' browser mint joins the table, the same pairing
    // law B-MCP followed). Closed refusal, zero worker entry beyond the
    // invoke-level proof above — still no fake green.
    const def = world.plane.definitions.find((d) => d.name === 'stagehand_observe')
    // root 22:26: the REAL mint claims now VALIDATE at the table inside
    // the walk — the walk moves PAST the target law to the durable
    // approval boundary (proven by the walk blocking there until the
    // caller's abort; it no longer refuses at the target). Bounded, no
    // approval is minted here, zero entry — still no fake green.
    const ac = new AbortController()
    const timed = globalThis.setTimeout(() => ac.abort(), 250)
    await expect(def?.execute({ instruction: 'what is on this page' }, execFor('browser-1', { signal: ac.signal }))).rejects.toThrow(/cancelled|refused-g2/)
    globalThis.clearTimeout(timed)
    expect(world.nativeCalls.stagehand_observe ?? []).toHaveLength(0)
    const mount = world.mount as { dispose: () => Promise<{ ok: boolean }> }
    expect((await mount.dispose()).ok).toBe(true)
  })
})

/* ROOT 21:14 — exact-shape legs over the REAL assembly transportTarget
 * shape (:273-278 spawn.{argv0,args,cwd}/endpointUrl FULL URL). The
 * comparator the host factory consumes, tested directly: no 13-leg
 * double-proof, no Host. */
describe('A5M2-G2-WIRE round-22: the same-source comparator over the REAL transportTarget shape', () => {
  const STDIO_REC = { serverName: 'g2w-server', transport: 'stdio', command: '/usr/bin/true', args: ['-a', '-b'], cwd: '' }
  const HTTP_REC = { serverName: 'g2w-http', transport: 'streamable-http', url: 'https://mcp.example.invalid/v1/mcp?session=42' }
  it('positive: the real stdio target (argv0, EVERY arg, RAW empty cwd) and the real http FULL URL (origin+path+query) bind clean', () => {
    expect(g2ApprovedTargetMismatches({ server: 'g2w-server', transport: 'stdio', spawn: { argv0: '/usr/bin/true', args: ['-a', '-b'], cwd: '' } }, STDIO_REC)).toEqual([])
    expect(g2ApprovedTargetMismatches({ server: 'g2w-http', transport: 'streamable-http', endpointUrl: 'https://mcp.example.invalid/v1/mcp?session=42' }, HTTP_REC)).toEqual([])
  })
  it('negative: SAME arg COUNT different args and SAME origin different path/query both mismatch BEFORE construction', () => {
    const badArgs = g2ApprovedTargetMismatches({ server: 'g2w-server', transport: 'stdio', spawn: { argv0: '/usr/bin/true', args: ['-a', '-x'], cwd: '' } }, STDIO_REC)
    expect(badArgs.some((m: string) => m.includes('args[1]'))).toBe(true)
    const badPath = g2ApprovedTargetMismatches({ server: 'g2w-http', transport: 'streamable-http', endpointUrl: 'https://mcp.example.invalid/v2/mcp?session=42' }, HTTP_REC)
    expect(badPath.some((m: string) => m.includes('path'))).toBe(true)
    const badQuery = g2ApprovedTargetMismatches({ server: 'g2w-http', transport: 'streamable-http', endpointUrl: 'https://mcp.example.invalid/v1/mcp?session=43' }, HTTP_REC)
    expect(badQuery.some((m: string) => m.includes('query'))).toBe(true)
  })
})

/* ROOT 21:24 — the consumed RELAY unit legs. DISCLOSED service stand-in
 * speaking the REAL control vocabulary VERBATIM from runtime/control:
 * status 'pending'|'decided'|'abandoned' (service.ts:1861) and decision
 * 'allow'|'deny'|'stale-denied' (types.ts CONTROL_DECISION_VALUES). The
 * relay is a pure adapter — the real-service end-to-end ride is the
 * Host-acceptance venue (stated, not claimed). */
describe('A5M2-G2-WIRE round-25: createG2ConsumedRelay — relay, not PA proof, not second grant', () => {
  const fakeService = (record: Record<string, unknown> | null, decision?: string) => ({
    listControlState: async () => ({ requests: record === null ? [] : [record] }),
    awaitControlDecision: async () => { if (decision === undefined) throw new Error('CONTROL_REQUEST_NOT_FOUND'); return { requestId: 'r1', decision } },
  })
  it('the SAME call\'s decided allow relays to consumed; deny/stale-denied/abandoned/pending-timeout/absent-correlation all refuse fail-closed', async () => {
    const ok = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService({ correlation: 'plane-g2:r-1', requestId: 'r1', status: 'decided' }, 'allow'), rootSessionId: 'rt', deadlineMs: 100 })
    expect(await ok({ approvedCallId: 'plane-g2:r-1', toolName: 'stagehand_navigate' })).toBe('consumed')
    const deny = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService({ correlation: 'plane-g2:r-1', requestId: 'r1', status: 'decided' }, 'deny'), rootSessionId: 'rt', deadlineMs: 100 })
    expect(await deny({ approvedCallId: 'plane-g2:r-1' })).toBe('refused')
    const stale = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService({ correlation: 'plane-g2:r-1', requestId: 'r1', status: 'decided' }, 'stale-denied'), rootSessionId: 'rt', deadlineMs: 100 })
    expect(await stale({ approvedCallId: 'plane-g2:r-1' })).toBe('refused')
    const aband = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService({ correlation: 'plane-g2:r-1', requestId: 'r1', status: 'abandoned' }), rootSessionId: 'rt', deadlineMs: 100 })
    expect(await aband({ approvedCallId: 'plane-g2:r-1' })).toBe('refused')
    const pend = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService({ correlation: 'plane-g2:r-1', requestId: 'r1', status: 'pending' }), rootSessionId: 'rt', deadlineMs: 60, pollMs: 20 })
    expect(await pend({ approvedCallId: 'plane-g2:r-1' })).toBe('refused')
    const noCorr = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService(null), rootSessionId: 'rt', deadlineMs: 40, pollMs: 10 })
    expect(await noCorr({ toolName: 'stagehand_navigate' })).toBe('refused')
    const missing = (MOUNT as unknown as { createG2ConsumedRelay: (i: Record<string, unknown>) => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedRelay({ getService: () => fakeService(null), rootSessionId: 'rt', deadlineMs: 40, pollMs: 10 })
    expect(await missing({ approvedCallId: 'plane-g2:r-9' })).toBe('refused')
  })
})

/* ROOT 21:34 — the Browser approval boundary: kernel-witness shape only. */
describe('A5M2-G2-WIRE round-26: createG2ConsumedProofApproval — the real final PA proof is the boundary', () => {
  it('the kernel one-shot witness ({grant:{grantId}}) answers consumed; anything else refuses fail-closed (no correlation substitute, no Control read)', async () => {
    const boundary = (MOUNT as unknown as { createG2ConsumedProofApproval: () => (f: Record<string, unknown>) => Promise<string> }).createG2ConsumedProofApproval()
    expect(await boundary({ consumedProof: { grant: { grantId: 'gr-1' } } })).toBe('consumed')
    expect(await boundary({})).toBe('refused')
    expect(await boundary({ consumedProof: null })).toBe('refused')
    expect(await boundary({ consumedProof: { grant: null } })).toBe('refused')
    expect(await boundary({ consumedProof: { grant: { grantId: '' } } })).toBe('refused')
    expect(await boundary({ approvedCallId: 'plane-g2:r-1' })).toBe('refused')
  })
})

/* ROOT 22:26 pairing card — the table mirrors the REAL mint (names,
 * browser-* operations, full targets kept IN the manifest), and the
 * real mint now rides the same flat leaves. No value moved to body
 * facts, nothing deleted to fit the table. */
describe('A5M2-G2-WIRE round-28: B-BROWSER table <-> REAL mint one-for-one', () => {
  const rule = () => {
    const entry = PA_FAMILY_TARGET_RULES['B-BROWSER']
    if (entry === undefined) throw new Error('B-BROWSER table entry missing')
    return entry
  }
  const realNavigate = {
    browserVariant: 'launch:navigate', record: 'surface:browser_owned', operation: 'browser-navigate', mode: 'launch',
    connectionIncarnation: 'gen-1', providerReSelectionLaw: 'the mount generation owns the Stagehand provider for this Team realm; a captured native handle re-selecting or replacing the provider is gone — incarnation rotation stale-proofs prior approvals (B-BROWSER re-selection law @639ed01539)', connectionIncarnationReason: null,
    domainAuthorityId: null, businessObligations: [{ service: 'browser', action: 'navigate', right: 'connect', entry: 'x' }],
    url: 'https://target.example.invalid/deep?q=1', destinationOrigin: 'https://target.example.invalid', pageId: null,
  }
  const realObserveAttach = { ...realNavigate, browserVariant: 'attach:observe', operation: 'browser-observe', mode: 'attach', modelDestinationOrigin: 'https://model.example.invalid', instructionDigest: 'a'.repeat(64), attachEndpointOrigin: 'http://127.0.0.1:9222', attachNote: 'attached browser may also be changed by its user (native GUIDANCE); incarnation re-check belongs to the owned provider (§5.5)' }
  delete (realObserveAttach as Record<string, unknown>).url
  delete (realObserveAttach as Record<string, unknown>).destinationOrigin
  it('the REAL launch:navigate and attach:observe manifests validate against the entry (full targets IN the approval manifest); module-load legality holds', () => {
    expect(() => assertPaFamilyTargetRuleLegality('B-BROWSER', rule())).not.toThrow()
    expect(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), realNavigate)).toBeUndefined()
    expect(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), realObserveAttach)).toBeUndefined()
  })
  it('lossless negatives: dropping url/pageId-null/domainAuthorityId-null refuses; a bare digest without modelDestinationOrigin refuses; launch mode with an attach variant refuses (bound literal)', () => {
    const noUrl = { ...realNavigate } as Record<string, unknown>
    delete noUrl.url
    expect(String(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), noUrl))).toContain('url')
    const noPage = { ...realNavigate } as Record<string, unknown>
    delete noPage.pageId
    expect(String(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), noPage))).toContain('pageId')
    const noDa = { ...realNavigate } as Record<string, unknown>
    delete noDa.domainAuthorityId
    expect(String(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), noDa))).toContain('domainAuthorityId')
    const digestOnly = { ...realObserveAttach } as Record<string, unknown>
    delete digestOnly.modelDestinationOrigin
    expect(String(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), digestOnly))).toContain('modelDestinationOrigin')
    expect(String(validatePaFamilyTargetAgainstRule('B-BROWSER', rule(), { ...realNavigate, mode: 'attach' }))).toContain('mode')
  })
})
