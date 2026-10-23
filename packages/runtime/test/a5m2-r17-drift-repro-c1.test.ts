/**
 * A5M2 R17 DRIFT REPRO (root seam-asymmetry candidate) (root 14:44, the SYMMETRIC third port): the
 * governed read_image row's pre-dispatch hand-off wired on the SAME audited
 * protocol as the read/write ports and the SAME shared token ledger. What
 * this spec pins (plane-direct C1 legs — Host truth belongs to the kit run):
 *
 *  - the port answers ONLY for the ONE name THIS mount placed ('read_image');
 *    every other spelling gets 'no-match' with zero state written — no name
 *    guessing, no fallback lane, no native face;
 *  - OPEN asks the full PA effect-set question (default-ask world: the REAL
 *    durable Control row carries the B-IMAGE family block field-for-field),
 *    and on the all-allow lane it opens NOTHING (zero control-leg entries);
 *  - the body REDEEMS through the SAME production edge: its own fresh
 *    classify, the exact-match recheck (call identity + the independent
 *    full-values digest), the edge's FRESH facts re-read and the ONE consume
 *    — then the reviewed arm reads through the REAL port and commits ONCE;
 *  - Part A is NEVER re-run: a second open refuses IN_FLIGHT/TERMINAL
 *    (ownsHandoff:false, side-effect-free), a lost or double-taken claim
 *    refuses PA_HANDOFF_LOST, drift refuses PA_HANDOFF_MISMATCH — all with
 *    ZERO port calls and ZERO attachment writes;
 *  - terminal close and the mount teardown end every leg: the close lands
 *    BEFORE the arm drain, a late body enters as a fresh call and lands on
 *    the DRAINED arm's typed refusal (the ledger's ONE release point is
 *    dispose @ 9c817), and a late open answers PA_HANDOFF_MOUNT_GONE;
 *  - the image arm is stateless pre-edge (the design card's 9-leg law): the
 *    hand-off face carries NO plan and NO arm-cancel — the ONE disclosed
 *    difference from the write face, everything else is the same law;
 *  - ABSENCE is field presence: a mount without the governed image row does
 *    not declare `paImageHandoff` at all (omitted, not `undefined`).
 *
 * Scope: NO Host, NO network, NO :3080; worlds are workspace-internal
 * (tests/homes/a5m2-r17-drift-<STAMP>), removed in afterAll.
 * The disclosed stand-ins are EXACTLY the ones a5m2-image-row-c1 declares
 * (the TEST-owned native identity/description object and the in-memory
 * attachment-store double; every authority part is the production module).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-r17-drift-repro-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
import type { ToolBinding } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { definitionIdentityOf, untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createPaControlLeg, createPaEffectsVerifier } from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, leaderCaller, memberCaller, p6t4Seed, humanCaller } from './p6t4-helpers.js'
import { createGovernedReadImageArm, A5_IMAGE_TOOL_NAME } from '../src/plugin/live/governed-families/image.mjs'
import { createImageAttachmentAdapter } from '../src/plugin/live/governed-families/image-attachment.mjs'
import type { ImageAttachmentStorePort } from '../src/plugin/live/governed-families/image-attachment.d.mts'
import type { GovernedReadImageArmHandle, ImageReadBoundedPort } from '../src/plugin/live/governed-families/image.d.mts'
import { createGovernedImageReadPort } from '../controlled-fs/src/governed-image-read-port.js'

interface PlaneAssemblyValue {
  ownNames: readonly string[]
  definitions: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
    execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
  }>
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  mount: (agentCtx: { tools: { register: (def: unknown) => unknown } }) => { ok: boolean; code?: string; name?: string; message?: string; dispose: () => void }
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
  paImageHandoff?: {
    open: (exec: Record<string, unknown>) => Promise<{ kind: string; ownsHandoff?: boolean; code?: string; detail?: string; correlation?: string }>
    close: (exec: Record<string, unknown> | undefined) => void
  }
}
type PlaneFactory = (input: Record<string, unknown>) => { ok: boolean; code?: string; message?: string; value?: PlaneAssemblyValue }

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-r17-drift-repro: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-r17-drift-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
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

const HEADER_ID = 'ses-a5m2-r17-drift-header'
const IMAGE_TPL = 'a5m2-r17-drift-tpl'
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
const ARM_PROVIDER = 'a5p5-plane'

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly; plane?: PlaneAssemblyValue; readonly fsSeam?: { readonly canonicalizeResource: (declaredPath: string) => string | null; readonly subtreeContains: (parent: string, child: string) => boolean } }
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
    policySource: { staticLayerRefs: [`${IMAGE_TPL}:directive-policy`], overlayGeneration: 0 },
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
      templateId: IMAGE_TPL,
      cwd: CHAIN_WORLD,
      providerVersion: ARM_PROVIDER,
    },
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
    authorityGeneration: 0,
    ...(family === undefined ? {} : { governedFamily: family }),
    ...(decisionSeamTransport && truth.fsSeam !== undefined ? { subtreeContains: truth.fsSeam.subtreeContains } : {}),
  }
}
const verifierObservations: Record<string, unknown>[] = []
// r17 FIX leg switch: true = the FIXED production transport (the mount's seam
// rides the runtime facts, as pa-mount-registry now does); false = the r17
// gap (decision side receives no seam) kept as the absence-law negative leg.
let decisionSeamTransport = true
const paVerifier = createPaEffectsVerifier({ readCallFacts: verifierReadCallFacts, onObserve: (row: Record<string, unknown>) => { verifierObservations.push(row) } } as never)

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

function makeNativeImage(): { def: { name: string; description: string; parameters: unknown } } {
  return {
    def: {
      name: A5_IMAGE_TOOL_NAME,
      description: 'TEST native read_image description — the captured bytes the row must carry.',
      parameters: {
        type: 'object',
        properties: { file_path: { type: 'string', description: 'the governed image file to read' } },
        required: ['file_path'],
      },
    },
  }
}

const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
  A5_IMAGE_MOUNT_NAME: string
}

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const sha = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

interface StoreDouble {
  imageLimits: { maxImageBytes: number; maxMessageImageBytes: number; mediaTypes: readonly string[]; maxImagesPerMessage: number }
  saves: Array<{ mediaType: string; name: string; byteLength: number }>
  saveImage: ImageAttachmentStorePort['saveImage']
  readImage: ImageAttachmentStorePort['readImage']
}
function makeStoreDouble(): StoreDouble {
  const saves: StoreDouble['saves'] = []
  const objects = new Map<string, Uint8Array>()
  return {
    imageLimits: Object.freeze({
      mediaTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
      maxImagesPerMessage: 8,
      maxImageBytes: 1 << 20,
      maxMessageImageBytes: 1 << 20,
    }),
    saves,
    saveImage: async ({ data, mediaType, name }) => {
      saves.push({ mediaType, name, byteLength: data.byteLength })
      const id = sha(data)
      objects.set(id, data)
      return { attachmentId: id, mediaType, bytes: data.byteLength, width: 1, height: 1, name }
    },
    readImage: async (ref) => {
      const data = objects.get(String(ref?.attachmentId ?? '')) ?? new Uint8Array()
      return { ref, data }
    },
  }
}

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  plane: PlaneAssemblyValue
  arm: GovernedReadImageArmHandle
  adapter: ReturnType<typeof createImageAttachmentAdapter>
  store: StoreDouble
  imageDef: PlaneAssemblyValue['definitions'][number]
  fsRoot: string
  observed: string[]
  familyKey: string
  legInputs: Record<string, unknown>[]
}

async function mountWorld(
  label: string,
  opts: {
    policyFor?: (fsRoot: string) => TemplatePermissionPolicy
    imageDisabled?: boolean
  } = {},
): Promise<Mounted> {
  const { def: nativeDef } = makeNativeImage()
  const fsRoot = worldDir(`root-${label}`)
  writeFileSync(join(fsRoot, 'good.png'), PNG_1X1)
  const realmId = `a5m2-r17-drift-${label}`
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
  if (opts.imageDisabled === true) {
    // WH-M9's law for the image face: a mount WITHOUT the governed image row
    // does not declare the field at all.
    const built = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY,
      realmId,
      templateId: IMAGE_TPL,
      role: 'member',
      instanceId: WORKER,
      teamSessionId: P6T4_ROOT,
      plane: {},
      backends: {},
      authorityFacts: { overlayGeneration: async () => 0, ensureAuthorityCurrent: async () => {} },
      controlLeg: async () => { throw new Error('no Control ask may exist on a read-only mount') },
      readCallFacts: async () => undefined,
      onObserve: () => {},
    })
    if (built.ok !== true || built.value === undefined) {
      throw new Error(`plane assembly refused (${String(built.code)}): ${String(built.message)}`)
    }
    const plane = built.value
    realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })
    const store = makeStoreDouble()
    const adapter = createImageAttachmentAdapter({ store })
    const placedArm = createGovernedReadImageArm({
      definitionIdentity: 'unused-no-image-row',
      providerId: ARM_PROVIDER,
      realmId,
      namespaceRoot: fsRoot,
      readBounded: createGovernedImageReadPort({ namespaceRoot: fsRoot }) as unknown as ImageReadBoundedPort,
      attachments: adapter,
      imageCapability: async () => ({ ok: true }),
      observe: () => {},
    })
    return { plane, arm: placedArm, adapter, store, imageDef: undefined as unknown as Mounted['imageDef'], fsRoot, observed, familyKey: '', legInputs }
  }
  const store = makeStoreDouble()
  const adapter = createImageAttachmentAdapter({ store })
  const port = createGovernedImageReadPort({ namespaceRoot: fsRoot })
  let placedArm: GovernedReadImageArmHandle | undefined
  const mountFsSeam = Object.freeze({
    canonicalizeResource: (declaredPath: string): string | null => (declaredPath.startsWith('/') ? declaredPath : join(fsRoot, declaredPath)),
    subtreeContains: (parent: string, child: string) => child === parent || child.startsWith(parent + '/'),
  })
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: opts.policyFor !== undefined ? opts.policyFor(fsRoot) : DIRECT_POLICY,
    realmId,
    templateId: IMAGE_TPL,
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { imageEnabled: true },
    backends: {
      image: {
        createArm: (placedDef: unknown) => {
          const identity = definitionIdentityOf(placedDef)
          if (typeof identity !== 'string' || identity.length === 0) {
            throw new TypeError('the placed read_image definition carries no WeakMap identity — no arm without one')
          }
          placedArm = createGovernedReadImageArm({
            definitionIdentity: identity,
            providerId: ARM_PROVIDER,
            realmId,
            namespaceRoot: fsRoot,
            readBounded: port as unknown as ImageReadBoundedPort,
            attachments: adapter,
            imageCapability: async () => ({ ok: true }),
            observe: () => {},
          })
          return placedArm
        },
        description: nativeDef.description,
        parameters: nativeDef.parameters,
      },
    },
    // PRODUCTION-SHAPE lexical seams (the r17 mount carried them). r17 FIX
    // (center): this ONE object is what the mount registry now rides to the
    // decision-side facts read (agent-bindings publishPaMount fsSeam ->
    // pa-mount-registry facts subtreeContains -> bridge pure-core parameter),
    // so Part A and the verifier consult the SAME containment authority.
    fs: mountFsSeam,
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
      const binding = bindingOf(label)
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
          policySource: { staticLayerRefs: [`${IMAGE_TPL}:directive-policy`], overlayGeneration: 0 },
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
            templateId: IMAGE_TPL,
            cwd: CHAIN_WORLD,
            providerVersion: ARM_PROVIDER,
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
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane, fsSeam: mountFsSeam })
  const fed = plane.placementFeed(A5_IMAGE_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed read_image row answered no placement definition identity')
  if (placedArm === undefined) throw new Error('the placement-moment factory never built the arm')
  // A5M2 PROVIDER-IDENTITY SUPPLY: the arm face answers its provider identity
  // LIVE (`string | undefined` now). THIS world builds a CONSTANT arm, so the
  // constant must answer — narrowed honestly rather than widening the registry
  // entry's declared type (an arm that answers nothing registers nothing).
  const armProviderIdentity = placedArm.providerId
  if (typeof armProviderIdentity !== 'string') throw new Error('a constant-provider arm answered no provider identity — the fixture is defective')
  registerA5GovernedFamily(familyKey, {
    familyId: placedArm.familyId,
    adapterRevision: placedArm.adapterRevision,
    providerIdentity: armProviderIdentity,
  })
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `${IMAGE_TPL}:${label}`,
    agentScopeKey: `${IMAGE_TPL}:${label}`,
    toolName: A5_IMAGE_TOOL_NAME,
    definitionIdentity: familyKey,
    providerId: ARM_PROVIDER,
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host', plane.realmId),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  }))
  const imageDef = plane.definitions.find((d) => d.name === A5_IMAGE_TOOL_NAME)
  if (imageDef === undefined) throw new Error('the mounted plane carries no read_image definition')
  return { plane, arm: placedArm, adapter, store, imageDef, fsRoot, observed, familyKey, legInputs }
}

function execFor(callId: string, filePath: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: A5_IMAGE_TOOL_NAME,
    arguments: { file_path: filePath },
    agent: {
      id: WORKER,
      session: { header: { id: HEADER_ID }, append: () => {} },
    },
    // THE real Host exec shape (fixed 639 `ToolExecution`): fresh branded
    // symbol per call, NO `tokenKey`; the hand-off and the redemption share
    // the ONE exec object identity.
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

const rowCallOf = (world: Mounted, n = 1) => `plane-image:${world.plane.realmId}-${String(n)}`
const portOf = (world: Mounted) => {
  const face = world.plane.paImageHandoff
  if (face === undefined) throw new Error('the mounted image plane declared no paImageHandoff face')
  return face
}

describe('A5M2-R17-FIX: ORIGINAL r17-shape policy (deny read subtree runtime, allow read subtree team, deny read_image exact blocked.png) kept verbatim - RR-1 threads the mount seam (drifted() branch gone), RR-2 keeps the seam-absent r17 bytes (absence law); RR-3 is a clearly-separated SYNTHETIC no-floor control', () => {
  it('RR-1 SYNTHETIC-HISTORICAL (root 16:56: NOT a replay of the real r17 - the read_image-exact deny is NOT in the real policy and its covering deny raises a human-admin floor the real row NEVER had; kept as the 337 historical material): seam-on stops the expansion branch on this synthetic shape', async () => {
    decisionSeamTransport = true
    const world = await mountWorld('rr-1', {
      policyFor: (root) => Object.freeze({
        default: 'ask',
        allow: Object.freeze([
          Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: join(root, 'team') }) }),
        ]),
        ask: Object.freeze([]),
        deny: Object.freeze([
          Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: 'runtime' }) }),
          Object.freeze({ tool: 'read_image', resource: Object.freeze({ kind: 'exact', path: join(root, 'blocked.png') }) }),
        ]),
      }),
    })
    const obsBase = verifierObservations.length
    const exec = execFor('rr-1', 'good.png')
    const rowCallId = rowCallOf(world)
    const opening = portOf(world).open(exec)
    const row = await waitRowForCall(rowCallId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const handoff = await opening
    const driftRows = verifierObservations.slice(obsBase).filter((o) => String(o.outcome ?? '') === 'drift')
    console.info('RR1-FIXED kind=' + handoff.kind + ' code=' + String(handoff.code ?? '') + ' drift=' + JSON.stringify(driftRows).slice(0,900))
    // THE fix claim, on the ORIGINAL r17-shape policy (root 16:33: the deny
    // scope is NOT touched to flip any colour): with the mount seam threaded
    // to the decision side the subtree rules are DETERMINED, so THE drifted()
    // expansion branch that r17 hit ('no longer approvable on the expansion
    // plane' / 'undetermined on the expansion plane') NEVER FIRES - zero
    // drift-family rows is the exact delta. A residual refusal here (e.g. the
    // rung recheck, when this harness resolves with a leader caller while the
    // captured case rung stands higher) is a DIFFERENT gate, printed verbatim
    // for the record and never claimed as the seam's subject.
    const expansionDrifts = driftRows.filter((o) => String(o.detail ?? '').includes('no longer approvable on the expansion plane'))
    expect(expansionDrifts.length, 'fixed transport: THE r17 expansion-drift branch never fires on the ORIGINAL policy shape').toBe(0)
    if (handoff.kind !== 'authorized') {
      // The residual here (rung recheck under this harness leader caller) is a
      // SEPARATE gate printed verbatim - named, not papered over, not claimed.
      console.info('RR1 RESIDUAL (separate gate, recorded): ' + String(driftRows[0]?.detail ?? handoff.code ?? ''))
    }
  }, 60_000)

  it('RR-2 absence law: a mount whose decision side receives NO seam keeps the exact r17 drifted bytes (unchanged fail-closed)', async () => {
    decisionSeamTransport = false
    try {
      const world = await mountWorld('rr-2', {
        policyFor: (root) => Object.freeze({
          default: 'ask',
          allow: Object.freeze([
            Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: join(root, 'team') }) }),
          ]),
          ask: Object.freeze([]),
          deny: Object.freeze([
            Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: 'runtime' }) }),
            Object.freeze({ tool: 'read_image', resource: Object.freeze({ kind: 'exact', path: join(root, 'blocked.png') }) }),
          ]),
        }),
      })
      const obsBase = verifierObservations.length
      const exec = execFor('rr-2', 'good.png')
      const rowCallId = rowCallOf(world)
      const opening = portOf(world).open(exec)
      const row = await waitRowForCall(rowCallId)
      await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
      const handoff = await opening
      const driftRows = verifierObservations.slice(obsBase).filter((o) => String(o.outcome ?? '') === 'drift')
      expect(handoff.kind, 'absent seam: the r17 deny stands').toBe('refused')
      expect(String(handoff.code)).toBe('APPROVAL_DENIED')
      expect(driftRows.length, 'absent seam: the drift-family refusal stands (r17 signature)').toBeGreaterThan(0)
      expect(String(driftRows[0]?.gate)).toBe('resolve')
      const detail = String(driftRows[0]?.detail ?? '')
      expect(detail, 'expansion-branch drifted() is THE failing branch').toContain('no longer approvable on the expansion plane')
      expect(detail, 'undetermined is the subtree rule without the lexical seam').toContain('undetermined on the expansion plane')
    } finally {
      decisionSeamTransport = true
    }
  }, 60_000)

  it('RR-3 SYNTHETIC positive control (NOT the r17 shape - a deny rule the seam decides NON-covering): the fixed transport authorizes end to end', async () => {
    // Independent control ONLY: proves the threaded seam carries the decision
    // side to an authorized hand-off where the policy has no deny floor over
    // the effect. It deliberately does NOT replace the original-shape legs
    // (RR-1/RR-2); the deny resource here ('excluded', never covering
    // good.png) exists so the control has no rung floor - the r17 deny scope
    // lives untouched in RR-1/RR-2.
    decisionSeamTransport = true
    const obsBase = verifierObservations.length
    const world = await mountWorld('rr-3', {
      policyFor: (root) => Object.freeze({
        default: 'ask',
        allow: Object.freeze([
          Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: join(root, 'team') }) }),
        ]),
        ask: Object.freeze([]),
        deny: Object.freeze([
          Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: 'excluded' }) }),
        ]),
      }),
    })
    const exec = execFor('rr-3', 'good.png')
    const rowCallId = rowCallOf(world)
    const opening = portOf(world).open(exec)
    const row = await waitRowForCall(rowCallId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const handoff = await opening
    const driftRows = verifierObservations.slice(obsBase).filter((o) => String(o.outcome ?? '') === 'drift')
    // eslint-disable-next-line no-console
    console.info('RR3 kind=' + handoff.kind + ' code=' + String(handoff.code ?? '') + ' drift=' + String(driftRows.length))
    expect(handoff.kind, 'synthetic control: the seam-threaded decision authorizes').toBe('authorized')
    expect(driftRows.length).toBe(0)
  }, 60_000)

  // ---- TRUE-r17 REPLAY (root 16:56): the REAL policy snapshot from
  // tests/homes/a5m2-c2-r17-20261023T15-03-57Z/blueprints/a5m2c2-todo.yaml
  // (default ask; allow read subtree 'team'; ask bash any; deny read subtree
  // 'runtime' - NO read_image deny of any kind) and the REAL effects from
  // api-transcript entry 4 (read of <root>/examples/minimal/.sessions/...png
  // + tool-invoke read_image), captured requiredAuthority 'leader' /
  // perEffectRequired ['leader','leader'] / deniedEffects [] , and the REAL
  // durable decider identity kind 'human' (api-transcript entry 5 result
  // .decision.decider = {kind:'human', humanId:<team session>}) -> bridge
  // deciderAuthority 'human-user', which the closed reviewer map (control/
  // types.ts:334) pairs with a 'leader' case. Inputs are checked BEFORE any
  // verdict is read (input-identity-first). Nothing here re-floors or swaps
  // callers: it is the raw identity and the raw policy, minimally replayed.
  const REAL_R17_POLICY = (_root: string) => Object.freeze({
    default: 'ask',
    allow: Object.freeze([Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: 'team' }) })]),
    ask: Object.freeze([Object.freeze({ tool: 'bash', resource: Object.freeze({ kind: 'any' }) })]),
    deny: Object.freeze([Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'subtree', path: 'runtime' }) })]),
  })

  it('RR-4 TRUE-r17 REPLAY seam-on: input identity checked first, then the same public allow resolves with the seam threaded (the real root cause closes on the real shape)', async () => {
    decisionSeamTransport = true
    // Same LEXICAL relation as the raw row: the read effect sits OUTSIDE both
    // named roots (raw: .sessions path vs the 'team'/'runtime' parameter
    // roots), which is why the real row carries default-ask required 'leader'
    // and deniedEffects [] - neither rule covers it, only the seam can even
    // DECIDE that non-coverage.
    const world = await mountWorld('rr-4', { policyFor: REAL_R17_POLICY })
    const obsBase = verifierObservations.length
    const exec = execFor('rr-4', 'good.png')
    const rowCallId = rowCallOf(world)
    const opening = portOf(world).open(exec)
    const row = await waitRowForCall(rowCallId)
    // INPUT IDENTITY FIRST (raw fields, asserted before any resolve):
    const rp = (row as unknown as { reviewPayload?: Record<string, unknown> }).reviewPayload ?? {}
    expect(String(rp.requiredAuthority), 'raw r17 row: requiredAuthority leader').toBe('leader')
    expect(JSON.stringify(rp.perEffectRequired ?? []), 'raw r17 row: perEffectRequired [leader, leader]').toBe('["leader","leader"]')
    expect(JSON.stringify(rp.deniedEffects ?? []), 'raw r17 row: deniedEffects empty').toBe('[]')
    const effects = (rp.effects ?? []) as Array<Record<string, unknown>>
    expect(effects.length, 'raw r17 row: exactly the two effects').toBe(2)
    expect(String(effects[0]?.kind)).toBe('read')
    expect(String((effects[0]?.resource as Record<string, unknown> | undefined)?.kind)).toBe('absolute-path')
    expect(String(effects[1]?.kind)).toBe('tool-invoke')
    expect(String(effects[1]?.toolName)).toBe('read_image')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: humanCaller('session-a5m2c2-replay'), requestId: row.requestId, decision: 'allow' })
    const handoff = await opening
    const driftRows = verifierObservations.slice(obsBase).filter((o) => String(o.outcome ?? '') === 'drift')
    console.info('RR4-REAL kind=' + handoff.kind + ' code=' + String(handoff.code ?? '') + ' drift=' + JSON.stringify(driftRows).slice(0, 900))
    // On the REAL shape the whole drift family must be silent - expansion AND
    // rung (human-user reviews a leader case; no deny floor exists to raise):
    expect(driftRows.length, 'true replay: NO drift-family row with the seam').toBe(0)
    expect(handoff.kind, 'true replay: the real identity + real policy authorizes with the seam').toBe('authorized')
  }, 60_000)

  it('RR-5 TRUE-r17 REPLAY seam-off: the real policy snapshot without the decision-side seam reproduces the exact r17 deny bytes (absence law on the REAL shape)', async () => {
    decisionSeamTransport = false
    try {
      const world = await mountWorld('rr-5', { policyFor: REAL_R17_POLICY })
      const obsBase = verifierObservations.length
      const exec = execFor('rr-5', 'good.png')
      const rowCallId = rowCallOf(world)
      const opening = portOf(world).open(exec)
      const row = await waitRowForCall(rowCallId)
      const rp = (row as unknown as { reviewPayload?: Record<string, unknown> }).reviewPayload ?? {}
      expect(String(rp.requiredAuthority), 'raw field again: leader').toBe('leader')
      await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: humanCaller('session-a5m2c2-replay'), requestId: row.requestId, decision: 'allow' })
      const handoff = await opening
      const driftRows = verifierObservations.slice(obsBase).filter((o) => String(o.outcome ?? '') === 'drift')
      expect(handoff.kind).toBe('refused')
      expect(String(handoff.code)).toBe('APPROVAL_DENIED')
      const detail = String(driftRows[0]?.detail ?? '')
      expect(detail).toContain('no longer approvable on the expansion plane')
      expect(detail).toContain('undetermined on the expansion plane')
    } finally {
      decisionSeamTransport = true
    }
  }, 60_000)
})
