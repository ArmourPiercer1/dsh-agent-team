/**
 * A5-M2 IMAGE PA HAND-OFF (root 14:44, the SYMMETRIC third port): the
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
 * (tests/homes/a5m2-image-handoff-<STAMP>), removed in afterAll.
 * The disclosed stand-ins are EXACTLY the ones a5m2-image-row-c1 declares
 * (the TEST-owned native identity/description object and the in-memory
 * attachment-store double; every authority part is the production module).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-image-handoff-c1
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
import { parsePaControlManifest } from '../control/types.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { definitionIdentityOf, untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createPaControlLeg, createPaEffectsVerifier } from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, leaderCaller, memberCaller, p6t4Seed } from './p6t4-helpers.js'
import { createGovernedReadImageArm, A5_IMAGE_ADAPTER_REVISION, A5_IMAGE_FAMILY_ID, A5_IMAGE_OPERATION, A5_IMAGE_TOOL_NAME } from '../src/plugin/live/governed-families/image.mjs'
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
if (REPO === null) throw new Error('a5m2-image-handoff: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-image-handoff-${STAMP}`)
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

const HEADER_ID = 'ses-a5m2-image-handoff-header'
const IMAGE_TPL = 'a5m2-image-handoff-tpl'
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
  const realmId = `a5m2-image-handoff-${label}`
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
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })
  const fed = plane.placementFeed(A5_IMAGE_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed read_image row answered no placement definition identity')
  if (placedArm === undefined) throw new Error('the placement-moment factory never built the arm')
  registerA5GovernedFamily(familyKey, {
    familyId: placedArm.familyId,
    adapterRevision: placedArm.adapterRevision,
    providerIdentity: placedArm.providerId,
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

function allowPolicyFor(targetPath: string): TemplatePermissionPolicy {
  return Object.freeze({
    default: 'ask',
    allow: Object.freeze([
      Object.freeze({ tool: 'read_image', resource: Object.freeze({ kind: 'any' }) }),
      Object.freeze({ tool: 'read_image', resource: Object.freeze({ kind: 'exact', path: targetPath }) }),
    ]),
    ask: Object.freeze([]),
    deny: Object.freeze([]),
  })
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

describe('A5-M2 IMAGE PA HAND-OFF — the pre-dispatch open asks the full question at PA; the body redeems through the same fresh edge; every non-redemption refuses with zero port calls', () => {
  it('IH-M1 the production A->B leg: open authorizes on the all-allow lane with NOTHING opened at the old front door; the body redeems the claim, re-reads fresh, consumes ONCE and commits one attachment', async () => {
    const world = await mountWorld('ih-m1', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const target = join(world.fsRoot, 'good.png')
    const exec = execFor('ih-m1', 'good.png')
    const before = (await stateNow()).requests.length
    const handoff = await portOf(world).open(exec)
    expect(handoff.kind, 'the port owns its own mounted name').toBe('authorized')
    expect(handoff.correlation).toBe(rowCallOf(world))
    // The all-allow answer asks NOTHING: zero control-leg entries — the old
    // front door is opened NOTHING for this name and no row stands anywhere.
    expect(world.legInputs.length).toBe(0)
    expect((await stateNow()).requests.length).toBe(before)
    expect(world.plane.livePaPlan.size).toBe(0)
    expect(world.arm.stats()).toMatchObject({ consumed: 0, portCalls: 0, commits: 0 })
    // THE REDEMPTION: the body's own fresh classify re-derives the SAME
    // independent digest, skips its own Part A, and walks the SAME edge.
    const value = (await world.imageDef.execute({ file_path: 'good.png' }, exec)) as {
      path: string
      image: { attachmentId: string; mediaType: string; bytes: number }
    }
    expect(value.path).toBe(target)
    expect(value.image.attachmentId).toBe(sha(PNG_1X1))
    expect(value.image.mediaType).toBe('image/png')
    expect(world.store.saves).toEqual([{ mediaType: 'image/png', name: 'good.png', byteLength: PNG_1X1.byteLength }])
    expect(world.arm.stats()).toMatchObject({ consumed: 1, portCalls: 1, commits: 1 })
    expect(world.adapter.stats()).toMatchObject({ commits: 1, storeCalls: 1 })
    expect((await stateNow()).requests.length).toBe(before)
    // Idempotent terminal close + a terminal token is never re-armed.
    expect(() => portOf(world).close(exec)).not.toThrow()
    const again = await portOf(world).open(exec)
    expect(again.kind).toBe('refused')
    expect(again.code).toBe('PA_HANDOFF_TERMINAL')
    expect(again.ownsHandoff).toBe(false)
  })

  it('IH-A1 the ASK lane: the pre-dispatch open waits on the REAL durable PA row (B-IMAGE family manifest field-for-field), the human allow releases it, and the body redeems with the fresh recheck and the ONE consume', async () => {
    const world = await mountWorld('ih-a1')
    const target = join(world.fsRoot, 'good.png')
    const exec = execFor('ih-a1', 'good.png')
    const rowCallId = rowCallOf(world)
    const opening = portOf(world).open(exec)
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest, 'the row must parse as a strict PA manifest with its family block').toBeDefined()
    expect(manifest?.familyId).toBe(A5_IMAGE_FAMILY_ID)
    expect(manifest?.adapterRevision).toBe(A5_IMAGE_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(ARM_PROVIDER)
    expect(manifest?.targetManifest).toMatchObject({
      operation: A5_IMAGE_OPERATION,
      realmId: world.plane.realmId,
      canonicalTarget: target,
      declaredMediaType: 'image/png',
      byteCapSource: 'attachment-store-limits:min(maxImageBytes,maxMessageImageBytes)',
    })
    expect(String(manifest?.callId)).toBe(rowCallId)
    expect(String(manifest?.parametersFingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    const handoff = await (async () => {
      await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
      return await opening
    })()
    expect(handoff.kind).toBe('authorized')
    expect(handoff.correlation).toBe(rowCallId)
    const value = (await world.imageDef.execute({ file_path: 'good.png' }, exec)) as { image: { attachmentId: string } }
    expect(value.image.attachmentId).toBe(sha(PNG_1X1))
    // ONE question, ONE consume: the redemption created NO second row and the
    // approval the human answered was spent exactly once.
    expect(world.legInputs.length).toBe(1)
    const finalState = await stateNow()
    expect(finalState.requests.length).toBe(1)
    expect(finalState.consumptions.filter((c) => String(c.requestId) === String(row.requestId)).length).toBe(1)
    expect(world.store.saves.length).toBe(1)
    expect(world.arm.stats()).toMatchObject({ consumed: 1, portCalls: 1, commits: 1 })
    const finalRow = finalState.requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === rowCallId)
    expect(finalRow, 'the approval row stands (durable fact, never erased)').toBeDefined()
    expect(String(finalRow?.status ?? ''), 'the row settled to its terminal decided state').toMatch(/decided|allow|consumed|resolved|approved|closed/i)
  })

  it('IH-M2 close BEFORE the body: the claim dies with the close, the token is terminal, the late body refuses as a replay — zero port calls, zero attachment writes', async () => {
    const world = await mountWorld('ih-m2', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const exec = execFor('ih-m2', 'good.png')
    const handoff = await portOf(world).open(exec)
    expect(handoff.kind).toBe('authorized')
    portOf(world).close(exec)
    await expect(world.imageDef.execute({ file_path: 'good.png' }, exec)).rejects.toThrow(/exec-token-replay/)
    expect(world.store.saves.length).toBe(0)
    expect(world.arm.stats()).toMatchObject({ portCalls: 0, commits: 0 })
    const again = await portOf(world).open(exec)
    expect(again.kind).toBe('refused')
    expect(again.code).toBe('PA_HANDOFF_TERMINAL')
    expect(again.ownsHandoff).toBe(false)
  })

  it('IH-M3 a second open on an in-flight token refuses IN_FLIGHT side-effect-free (ownsHandoff:false, nothing asked, no answer reused); the first flight still redeems', async () => {
    const world = await mountWorld('ih-m3', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const exec = execFor('ih-m3', 'good.png')
    await portOf(world).open(exec)
    const legInputsBefore = world.legInputs.length
    const second = await portOf(world).open(exec)
    expect(second.kind).toBe('refused')
    expect(second.code).toBe('PA_HANDOFF_IN_FLIGHT')
    expect(second.ownsHandoff).toBe(false)
    expect(world.legInputs.length).toBe(legInputsBefore)
    const value = (await world.imageDef.execute({ file_path: 'good.png' }, exec)) as { image: { attachmentId: string } }
    expect(value.image.attachmentId).toBe(sha(PNG_1X1))
  })

  it('IH-M3b a double redemption races into exactly one take: the second body refuses PA_HANDOFF_LOST synchronously — Part A is never re-run, no fallback lane serves the read_image', async () => {
    const world = await mountWorld('ih-m3b', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const exec = execFor('ih-m3b', 'good.png')
    await portOf(world).open(exec)
    const first = world.imageDef.execute({ file_path: 'good.png' }, exec)
    const second = world.imageDef.execute({ file_path: 'good.png' }, exec)
    await expect(second).rejects.toThrow(/PA_HANDOFF_LOST/)
    const value = (await first) as { image: { attachmentId: string } }
    expect(value.image.attachmentId).toBe(sha(PNG_1X1))
    expect(world.store.saves.length).toBe(1)
  })

  it('IH-M4 a close landing MID-WALK voids the leg: the after-await re-check drops the answer (PA_HANDOFF_CLOSED, ownsHandoff:true — the leg owns its own cleanup), zero port calls', async () => {
    const world = await mountWorld('ih-m4', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const exec = execFor('ih-m4', 'good.png')
    const opening = portOf(world).open(exec)
    portOf(world).close(exec)
    const handoff = await opening
    expect(handoff.kind).toBe('refused')
    expect(handoff.code).toBe('PA_HANDOFF_CLOSED')
    expect(handoff.ownsHandoff).toBe(true)
    expect(world.store.saves.length).toBe(0)
    const again = await portOf(world).open(exec)
    expect(again.code).toBe('PA_HANDOFF_TERMINAL')
    await expect(world.imageDef.execute({ file_path: 'good.png' }, exec)).rejects.toThrow(/exec-token-replay/)
  })

  it('IH-M5 the mount teardown ends every flight: the unspent claim dies (closeAll lands BEFORE the arm drain), the late body enters fresh and lands on the DRAINED arm, a late open answers MOUNT_GONE, zero writes', async () => {
    const world = await mountWorld('ih-m5', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const ctx = { tools: { register: () => ({ dispose: () => {} }) } }
    const mounted = world.plane.mount(ctx)
    expect(mounted.ok, JSON.stringify(mounted)).toBe(true)
    const exec = execFor('ih-m5', 'good.png')
    const handoff = await portOf(world).open(exec)
    expect(handoff.kind).toBe('authorized')
    mounted.dispose()
    // The ledger's ONE release point is dispose (root ruling @ 9c817): after
    // it the token is no longer a used identity, so the late body enters as a
    // fresh call and the DRAINED arm refuses it — zero attachment writes, and
    // there is no native fallback to fall back to.
    await expect(world.imageDef.execute({ file_path: 'good.png' }, exec)).rejects.toThrow(/P_IMAGE_DRAINING/)
    expect(world.store.saves.length).toBe(0)
    const again = await portOf(world).open(exec)
    expect(again.kind).toBe('refused')
    expect(again.code).toBe('PA_HANDOFF_MOUNT_GONE')
    expect(again.ownsHandoff).toBe(false)
    expect(world.plane.livePaPlan.size).toBe(0)
  })

  it('IH-M6 drift at the redemption refuses PA_HANDOFF_MISMATCH with zero port calls: the claim answers the APPROVED question only (the independent digest covers the ORIGINAL parameters)', async () => {
    const world = await mountWorld('ih-m6', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    writeFileSync(join(world.fsRoot, 'alt.png'), Buffer.from([...PNG_1X1, 0x00]))
    const exec = execFor('ih-m6', 'good.png')
    const handoff = await portOf(world).open(exec)
    expect(handoff.kind).toBe('authorized')
    await expect(world.imageDef.execute({ file_path: 'alt.png' }, exec)).rejects.toThrow(/PA_HANDOFF_MISMATCH/)
    expect(world.store.saves.length).toBe(0)
    expect(world.arm.stats()).toMatchObject({ portCalls: 0, commits: 0 })
    await expect(world.imageDef.execute({ file_path: 'good.png' }, exec)).rejects.toThrow(/exec-token-replay/)
  })

  it('IH-M7 the port answers ONLY for its own mounted name: every other spelling (and a non-object exec) is no-match with ZERO state written', async () => {
    const world = await mountWorld('ih-m7', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    for (const other of [{ name: 'write' }, { name: 'read' }, { name: 'bash' }, {}]) {
      const answer = await portOf(world).open({ ...other, token: Symbol('other'), arguments: { file_path: 'good.png' } })
      expect(answer.kind, JSON.stringify(other)).toBe('no-match')
    }
    expect((await portOf(world).open(null as unknown as Record<string, unknown>)).kind).toBe('no-match')
    expect(world.legInputs.length).toBe(0)
    expect(world.store.saves.length).toBe(0)
    // a no-match exec touched no ledger state: its own token stays usable by
    // the row it belongs to (nothing was armed for it here).
    const clean = execFor('ih-m7-clean', 'good.png')
    await expect(world.imageDef.execute({ file_path: 'good.png' }, clean)).resolves.toBeDefined()
  })

  it('IH-M8 an unbound exec on the governed name REFUSES in place (PA_HANDOFF_UNBOUND, ownsHandoff:false) — never a fallback to the pre-hand-off lane', async () => {
    const world = await mountWorld('ih-m8', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    for (const bad of [{ name: A5_IMAGE_TOOL_NAME }, { name: A5_IMAGE_TOOL_NAME, token: 'not-a-token' }]) {
      const answer = await portOf(world).open({ ...bad, arguments: { file_path: 'good.png' } })
      expect(answer.kind, JSON.stringify(bad)).toBe('refused')
      expect(answer.code).toBe('PA_HANDOFF_UNBOUND')
      expect(answer.ownsHandoff).toBe(false)
    }
    expect(world.legInputs.length).toBe(0)
    expect(world.store.saves.length).toBe(0)
  })

  it('IH-M9 a mount without the governed image row does NOT declare the capability: the field is OMITTED (presence law), never set to undefined', async () => {
    const world = await mountWorld('ih-m9', { imageDisabled: true })
    expect('paImageHandoff' in world.plane).toBe(false)
  })
})
