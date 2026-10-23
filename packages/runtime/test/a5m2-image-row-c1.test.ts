/**
 * A5M2-IMAGE-ROW (B-IMAGE vertical, CENTER): the governed `read_image` row
 * MOUNTED and WIRED end to end on the real plane, over the three central-card
 * faces the INT round `0bda4ab24` shipped:
 *
 *  - the row mounts at the FIXED native spelling 'read_image' behind the
 *    closed `imageEnabled` key + the injected `backends.image.createArm`
 *    FACTORY (central-card ②): the arm is built AT THE PLACEMENT MOMENT over
 *    the def THIS plane actually places, binding its definitionIdentity
 *    through the REAL `definitionIdentityOf` WeakMap algebra (never a
 *    hand-spelled string); pairing law BOTH directions is config law, not
 *    wiring, and a factory that throws (no store — 缺 store 只算条件不可用)
 *    refuses the ASSEMBLY (IMAGE_ARM_INJECT_INVALID), never a half-wired row;
 *  - identity law three-way (卡③ C1): the arm's bound identity, the binding
 *    fixture and the mount-time family registration ALL take
 *    `plane.placementFeed('read_image').definitionIdentity` — the same
 *    `def#N` the Guard compares, proven by the identity leg
 *    (arm.definitionIdentity === placementFeed answer);
 *  - the parametersFingerprint is INDEPENDENT and FULL-ARGUMENT (卡③): two
 *    spellings of the same governed file ('./good.png' vs 'good.png') are two
 *    DIFFERENT walk fingerprints over one identical approved target;
 *  - `output.render` answers the NATIVE two-block shape (卡①): the envelope
 *    text AND the {type:'image', attachment} block;
 *  - the nine design-card legs (DESIGN-ROW-495aeb): all-allow happy (no
 *    Control row by construction, the REAL policy-admitted grant at the
 *    consumption point), ask→real allow (durable strict manifest carries the
 *    B-IMAGE family block field-for-field), deny, exec-token replay, dispose
 *    DRAINING through the REAL mount teardown, cap+1 READ_TOO_LARGE (the
 *    FACT measured at read time, refused BEFORE any commit), the symlinked
 *    root re-pointed after bind (the port's realpath AGREEMENT refuses at the
 *    execution edge), the no-store assembly refusal, and the pure-lexical
 *    refusals (undeclared mediaType / closed argument set) plus the
 *    new-file edge (zero attachment writes, the port's own words verbatim);
 *  - every refusal leg counts: the arm's OWN stats (portCalls/commits) and
 *    the store double's saves — "拒绝 ⇒ 0 读取 + 0 附件写" is arithmetic,
 *    not prose; the session log stays EMPTY on every leg (this row reads a
 *    file and commits an attachment; it appends nothing anywhere).
 *
 * Real parts (no substitutes): the REAL arm (governed-families/image.mjs
 * rev.2), the REAL production read port (controlled-fs governed-image-read-
 * port over a REAL workspace-internal root), the REAL adapter
 * (governed-families/image-attachment.mjs rev.2) over an in-memory store
 * double in the MEASURED pin639 shape (saveImage({data,mediaType,name}) ->
 * {attachmentId…} content-addressed pass-through, readImage(ref,signal) ->
 * {ref,data}, frozen imageLimits — the a5m2-readimg-arm-c2c3 double form),
 * the REAL ControlService durable row + one-shot consume witness, the REAL
 * pa-control leg, the ONE production family table (registry-owned
 * registerA5GovernedFamily keyed by the RUNTIME placement identity — the
 * spec owns NO table).
 *
 * Disclosed stand-ins: the native `read_image` definition here is a TEST-owned
 * object (identity + description + parameters bytes the row must carry; its
 * execute is NEVER re-entered — the reviewed arm is the body); the attachment
 * STORE is the in-memory double (the durable attachment-local store is the
 * component round's proven face — a5m2-readimg-c1).
 *
 * Scope: NO Host, NO network, NO :3080; worlds are workspace-internal
 * (tests/homes/a5m2-image-row-<STAMP>), removed in afterAll (TEST_METHODS §7).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-image-row-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
import type { GovernedReadImageArmHandle, ImageReadBoundedOutcome, ImageReadBoundedPort } from '../src/plugin/live/governed-families/image.d.mts'
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
}
interface PlaneResult {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssemblyValue
}
type PlaneFactory = (input: Record<string, unknown>) => PlaneResult

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-image-row: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-image-row-${STAMP}`)
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

const HEADER_ID = 'ses-a5m2-image-header'
const IMAGE_TPL = 'a5m2-image-asm-tpl'
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

/** THE PRODUCTION registration table (the todo/write rounds' law, unchanged). */
const registryModule = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  A5_GOVERNED_FAMILIES: Record<string, { familyId: string; adapterRevision: number; providerIdentity: string }>
  registerA5GovernedFamily: (definitionIdentity: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (definitionIdentity: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
  readPaCallFacts: (input: Record<string, unknown>) => Promise<unknown>
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

// ── the TEST-owned native definition (identity + description + parameters
//    bytes ONLY — its execute is NEVER re-entered: the reviewed arm is the
//    body; the parameters face rides the injection face directly, the def the
//    plane places is the face the three-way identity tie stands on) ─────────
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

// ── the synthetic image + the store double (the measured pin639 form, the
//    a5m2-readimg-arm-c2c3 shape: content-addressed pass-through ids) ───────
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
/** A DIFFERENT byte string sharing the .png spelling (the swap leg's stand-B
 *  object: were the read to follow the re-pointed root, THIS content would
 *  reach the store — commits=0 proves it did not). */
const PNG_ALT = Buffer.from([...PNG_1X1, 0x00])
const sha = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

interface StoreDouble {
  imageLimits: { maxImageBytes: number; maxMessageImageBytes: number; mediaTypes: readonly string[]; maxImagesPerMessage: number }
  saves: Array<{ mediaType: string; name: string; byteLength: number }>
  saveImage: ImageAttachmentStorePort['saveImage']
  readImage: ImageAttachmentStorePort['readImage']
}
function makeStoreDouble(
  limits: { maxImageBytes?: number; maxMessageImageBytes?: number } = {},
  normalize: { width: number; height: number; originalWidth: number; originalHeight: number } | undefined = undefined,
): StoreDouble {
  const maxImageBytes = limits.maxImageBytes ?? (1 << 20)
  const maxMessageImageBytes = limits.maxMessageImageBytes ?? (1 << 20)
  const saves: StoreDouble['saves'] = []
  const objects = new Map<string, Uint8Array>()
  return {
    imageLimits: Object.freeze({
      // the REAL attachment store's public limits face (pin639 shape): the
      // declared mediaTypes, the per-message quota, the two byte caps.
      mediaTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
      maxImagesPerMessage: 8,
      maxImageBytes,
      maxMessageImageBytes,
    }),
    saves,
    saveImage: async ({ data, mediaType, name }) => {
      saves.push({ mediaType, name, byteLength: data.byteLength })
      if (normalize !== undefined) {
        // NORMALIZED store (233ba item ②): the store downscales to a DIFFERENT
        // object whose identity is NOT the source digest (normalizedEqualsSource
        // must read false) and whose receipt answers the REDUCED width/height
        // PLUS originalDimensions (the pre-scale raster, pin639 shape).
        const normalized = new Uint8Array([0x4e, 0x4f, 0x52, 0x4d]) // 'NORM'
        const id = sha(normalized)
        objects.set(id, normalized)
        return {
          attachmentId: id, mediaType, bytes: normalized.byteLength,
          width: normalize.width, height: normalize.height, name,
          originalDimensions: { width: normalize.originalWidth, height: normalize.originalHeight },
        }
      }
      const id = sha(data)
      objects.set(id, data)
      // MEASURED pin639 form: the pass-through object's attachmentId IS the
      // source digest, `sha256:<hex>`.
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

/** One mounted world: a unique realm, the REAL production port + REAL
 *  adapter over the store double, and the arm built by the injected FACTORY
 *  at the PLACEMENT MOMENT over the def this plane actually places — its
 *  definitionIdentity through the REAL definitionIdentityOf WeakMap algebra
 *  (卡③ C1 core: the factory and placementFeed call it on the SAME def
 *  object, so the ids are one value by construction). The mount-time family
 *  registration and the binding fixture BOTH take the plane's own
 *  placementFeed answer (the agent-bindings law); the spec owns no table and
 *  spells no identity by hand. */
async function mountWorld(
  label: string,
  opts: {
    policyFor?: (fsRoot: string) => TemplatePermissionPolicy
    limits?: { maxImageBytes?: number; maxMessageImageBytes?: number }
    fsRootOverride?: string
    // 233ba item ①: the image-capability probe the placing assembly injects.
    // Default ADMITS (the other dimensions stay under test unchanged); refusal
    // legs inject the two NATIVE refusal shapes.
    imageCapability?: (signal: AbortSignal | undefined) => Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal?: { code?: string; detail?: string } }>
    // 233ba item ②: make the store double NORMALIZE (downscale) — its receipt
    // then answers reduced width/height + originalDimensions, exactly the
    // pin639 store's reduced-raster shape.
    storeNormalize?: { width: number; height: number; originalWidth: number; originalHeight: number }
  } = {},
): Promise<Mounted> {
  const { def: nativeDef } = makeNativeImage()
  const fsRoot = opts.fsRootOverride ?? worldDir(`root-${label}`)
  if (opts.fsRootOverride === undefined) writeFileSync(join(fsRoot, 'good.png'), PNG_1X1)
  const store = makeStoreDouble(opts.limits, opts.storeNormalize)
  const adapter = createImageAttachmentAdapter({ store })
  const port = createGovernedImageReadPort({ namespaceRoot: fsRoot })
  const realmId = `a5m2-image-asm-${label}`
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
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
            throw new TypeError('the placed read_image definition carries no WeakMap identity — no arm without one (never a hand-spelled string)')
          }
          placedArm = createGovernedReadImageArm({
            definitionIdentity: identity,
            providerId: ARM_PROVIDER,
            realmId,
            namespaceRoot: fsRoot,
            readBounded: port as unknown as ImageReadBoundedPort,
            attachments: adapter,
            imageCapability: opts.imageCapability ?? (async () => ({ ok: true })),
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
      // The PLANE-side call facts — the SPEC WIRING of the registry's shared
      // read law (mirrors the todo/write rounds verbatim; the CURRENT binding
      // tuple, effects through the domain parser, the live plan under THIS
      // call's correlation, the durable attribution, governedFamily through
      // the registry's own accessor).
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

/** The all-allow world's policy: the tool-invoke arm through the whole-tool
 *  rule, the read effect through the exact-path rule over THIS world's
 *  target (the kernel's projection law; default stays `ask` — the frozen
 *  grammar has no allow-default). */
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

function execFor(callId: string, events: Array<{ type: string; data: unknown }>, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: {
      id: WORKER,
      session: {
        header: { id: HEADER_ID },
        append: (type: string, data: unknown) => { events.push({ type, data }) },
      },
    },
    // THE real Host exec shape (fixed 639 `ToolExecution`): fresh branded
    // symbol per call, NO `tokenKey`; replay legs reuse the SAME exec object.
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

const rowCallOf = (world: Mounted, n = 1) => `plane-image:${world.plane.realmId}-${String(n)}`

describe('A5M2-IMAGE-ROW: the read_image row mounts at the placement moment, registers by the runtime identity, walks the one PA path, reads through the real port, commits once, renders two blocks', () => {
  it('leg 1 (all-allow happy): real run -> attachmentId; NO Control row by construction; one port read, one commit; the session log stays empty', async () => {
    const world = await mountWorld('pos-allow', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    expect(world.plane.ownNames.includes(A5_IMAGE_TOOL_NAME)).toBe(true)
    const target = join(world.fsRoot, 'good.png')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    const value = (await world.imageDef.execute({ file_path: 'good.png' }, execFor('call-allow', events))) as {
      path: string
      image: { attachmentId: string; sourceSha256: string; normalizedEqualsSource: boolean; mediaType: string; bytes: number }
    }
    expect(value.path).toBe(target)
    expect(value.image.attachmentId).toBe(sha(PNG_1X1))
    // SOURCE digest (bare hex) and the store's normalized identity are
    // SEPARATE facts (fix card 5) — pass-through makes them coincide here.
    expect(value.image.sourceSha256).toBe(sha(PNG_1X1).slice('sha256:'.length))
    expect(value.image.normalizedEqualsSource).toBe(true)
    expect(value.image.mediaType).toBe('image/png')
    expect(value.image.bytes).toBe(PNG_1X1.byteLength)
    // this row commits an attachment; it appends NOTHING to any session log.
    expect(events.length).toBe(0)
    // world (a) by construction: the all-allow lane creates NO Control row.
    expect((await stateNow()).requests.length).toBe(before)
    expect(world.arm.stats()).toMatchObject({ consumed: 1, portCalls: 1, commits: 1, consumptionRefused: 0 })
    expect(world.store.saves).toEqual([{ mediaType: 'image/png', name: 'good.png', byteLength: PNG_1X1.byteLength }])
    expect(world.adapter.stats()).toMatchObject({ commits: 1, storeCalls: 1 })
  })

  it('leg 2 (ask -> real allow): the durable strict manifest carries the B-IMAGE family block field-for-field; one consume witness; bytes land once through the real port', async () => {
    const world = await mountWorld('pos-ask')
    const events: Array<{ type: string; data: unknown }> = []
    const rowCallId = rowCallOf(world)
    const target = join(world.fsRoot, 'good.png')
    const running = world.imageDef.execute({ file_path: 'good.png' }, execFor('call-ask', events))
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
    // identity end-to-end: leg input, request and durable row speak the ONE
    // ledger allocation; the fingerprint is the row's OWN classify answer.
    expect(world.legInputs.length).toBe(1)
    const legInput = world.legInputs[0] as { callId?: string; request?: { callId?: string; parametersFingerprint?: string } }
    expect(legInput.callId).toBe(rowCallId)
    expect(legInput.request?.callId).toBe(rowCallId)
    expect(String(legInput.request?.parametersFingerprint ?? '')).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(String(manifest?.callId)).toBe(rowCallId)
    expect(String(manifest?.parametersFingerprint)).toBe(String(legInput.request?.parametersFingerprint))
    // the effects carry the read effect against the anchored target (the
    // closed vocabulary, the plane realm inside the resource).
    const effectList = (manifest?.effects as { effects?: Array<{ kind: string; resource?: { canonicalLocator?: string } | null }> } | undefined)?.effects ?? []
    expect(JSON.stringify(effectList)).toContain('"read"')
    expect(JSON.stringify(effectList)).toContain('good.png')

    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = (await running) as { path: string; image: { attachmentId: string } }
    expect(value.path).toBe(target)
    expect(value.image.attachmentId).toBe(sha(PNG_1X1))
    expect(events.length).toBe(0)
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
    expect(world.arm.stats()).toMatchObject({ consumed: 1, portCalls: 1, commits: 1 })
    expect(world.store.saves.length).toBe(1)
    expect(world.adapter.stats()).toMatchObject({ commits: 1, storeCalls: 1 })
  })

  it('leg 3 (deny): the real durable answer refuses the call; zero port calls, zero attachment writes', async () => {
    const world = await mountWorld('deny')
    const events: Array<{ type: string; data: unknown }> = []
    const running = world.imageDef.execute({ file_path: 'good.png' }, execFor('call-deny', events))
    const row = await waitRowForCall(rowCallOf(world))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'deny' })
    await expect(running).rejects.toThrow(/refused-image APPROVAL_DENIED/)
    expect(world.arm.stats().portCalls).toBe(0)
    expect(world.arm.stats().commits).toBe(0)
    expect(world.store.saves.length).toBe(0)
    expect(world.adapter.stats().storeCalls).toBe(0)
    expect(events.length).toBe(0)
  })

  it('leg 4 (exec-token replay): a settled token never re-arms — one row, one flight, the second call dies at the ledger', async () => {
    const world = await mountWorld('replay')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    const exec = execFor('call-replay', events)
    const running = world.imageDef.execute({ file_path: 'good.png' }, exec)
    const row = await waitRowForCall(rowCallOf(world))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    await expect(world.imageDef.execute({ file_path: 'good.png' }, exec)).rejects.toThrow(/refused-image exec-token-replay/)
    expect((await stateNow()).requests.length).toBe(before + 1)
    expect(world.arm.stats()).toMatchObject({ consumed: 1, portCalls: 1, commits: 1 })
    expect(world.store.saves.length).toBe(1)
    expect(events.length).toBe(0)
  })

  it('leg 5 (dispose): the REAL mount teardown drains the placement-moment arm — after dispose a new call refuses DRAINING with zero rows and zero backend reach', async () => {
    const world = await mountWorld('dispose')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    const ctx = { tools: { register: () => () => {} } }
    const mounted = world.plane.mount(ctx)
    expect(mounted.ok, JSON.stringify(mounted)).toBe(true)
    mounted.dispose()
    await expect(world.imageDef.execute({ file_path: 'good.png' }, execFor('call-drain', events)))
      .rejects.toThrow(/P_IMAGE_DRAINING/)
    expect((await stateNow()).requests.length).toBe(before)
    expect(world.arm.stats()).toMatchObject({ portCalls: 0, commits: 0 })
    expect(world.store.saves.length).toBe(0)
    expect(readFileSync(join(world.fsRoot, 'good.png'))).toEqual(PNG_1X1)
    expect(events.length).toBe(0)
  })

  it('leg 6 (cap+1): the oversized read answers the measured FACT, the arm refuses READ_TOO_LARGE BEFORE any commit — zero attachment writes', async () => {
    const world = await mountWorld('cap', { limits: { maxImageBytes: 32 } })
    const events: Array<{ type: string; data: unknown }> = []
    writeFileSync(join(world.fsRoot, 'big.png'), Buffer.alloc(40, 0x62))
    const running = world.imageDef.execute({ file_path: 'big.png' }, execFor('call-cap', events))
    const row = await waitRowForCall(rowCallOf(world))
    // the APPROVED fact already carries the cap the port enforces at read time.
    const legInput = world.legInputs[0] as { family?: { targetManifest?: { byteCap?: number } } }
    expect(legInput.family?.targetManifest?.byteCap).toBe(32)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await expect(running).rejects.toThrow(/P_IMAGE_READ_TOO_LARGE/)
    expect(world.arm.stats()).toMatchObject({ portCalls: 1, commits: 0 })
    expect(world.store.saves.length).toBe(0)
    expect(world.adapter.stats().storeCalls).toBe(0)
    expect(events.length).toBe(0)
  })

  it('leg 7 (symlink root re-pointed after bind): the port\'s realpath AGREEMENT refuses at the execution edge — stand-B\'s existing image never commits', async () => {
    // The root rides a SYMLINK: bind resolves through it (the port freezes
    // the then-current real root); a later re-point makes the current stand
    // differ from the approved agreement — the execution edge refuses, it
    // never re-derives approval. rootB ALSO carries a readable good.png: if
    // the edge failed to detect the swap, THIS image would reach the store,
    // so commits=0 can only mean the refusal fired (not an absent file).
    const base = worldDir('swap-base')
    const rootA = join(base, 'rootA')
    const rootB = join(base, 'rootB')
    mkdirSync(rootA, { recursive: true })
    mkdirSync(rootB, { recursive: true })
    writeFileSync(join(rootA, 'good.png'), PNG_1X1)
    writeFileSync(join(rootB, 'good.png'), PNG_ALT)
    const linkRoot = join(base, 'root')
    symlinkSync(rootA, linkRoot)
    const world = await mountWorld('swap', { fsRootOverride: linkRoot })
    // RE-POINT the root BEFORE the approval is answered.
    rmSync(linkRoot)
    symlinkSync(rootB, linkRoot)
    const events: Array<{ type: string; data: unknown }> = []
    const running = world.imageDef.execute({ file_path: 'good.png' }, execFor('call-swap', events))
    const row = await waitRowForCall(rowCallOf(world))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const failure = await running.then(() => null, (error) => error)
    if (failure === null) throw new Error('the swapped-root image read must refuse')
    expect(String(failure.message)).toContain('P_IMAGE_PORT_REFUSAL')
    expect(String(failure.message)).toContain('ANCHOR-DRIFT')
    expect(world.arm.stats()).toMatchObject({ portCalls: 1, commits: 0 })
    expect(world.store.saves.length).toBe(0)
    expect(world.adapter.stats().storeCalls).toBe(0)
    // ZERO FS facts moved at BOTH stands.
    expect(readFileSync(join(rootA, 'good.png'))).toEqual(PNG_1X1)
    expect(readFileSync(join(rootB, 'good.png'))).toEqual(PNG_ALT)
    expect(events.length).toBe(0)
  })

  it('leg 8 (no store = conditionally unavailable, refused at the ASSEMBLY): the factory throw answers IMAGE_ARM_INJECT_INVALID — never half-wired, never silent; pairing law both directions', () => {
    const { def: nativeDef } = makeNativeImage()
    const noStore = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-image-asm-nostore', templateId: IMAGE_TPL, role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { imageEnabled: true },
      backends: { image: {
        createArm: (placedDef: unknown) => {
          // 缺 store: the adapter constructor throws — the factory's throw
          // must refuse the whole assembly, not half a row.
          const adapter = createImageAttachmentAdapter({ store: undefined as unknown as ImageAttachmentStorePort })
          return createGovernedReadImageArm({
            definitionIdentity: definitionIdentityOf(placedDef) ?? '',
            providerId: ARM_PROVIDER,
            realmId: 'a5m2-image-asm-nostore',
            namespaceRoot: WORLD_ROOT,
            readBounded: async () => ({ ok: false, code: 'unreachable', detail: 'never reached — the assembly refuses first' }) as ImageReadBoundedOutcome,
            attachments: adapter,
            imageCapability: async () => ({ ok: true }),
          })
        },
        description: nativeDef.description,
        parameters: nativeDef.parameters,
      } },
    })
    expect(noStore.ok, JSON.stringify(noStore.message)).toBe(false)
    expect(noStore.code).toBe('IMAGE_ARM_INJECT_INVALID')
    expect(String(noStore.message)).toContain('createArm refused the placed definition')
    // pairing law BOTH directions (config law, not wiring):
    const halfA = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-image-asm-half-a', templateId: IMAGE_TPL, role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { imageEnabled: true },
    })
    expect(halfA.ok).toBe(false)
    expect(halfA.code).toBe('IMAGE_ARM_INJECT_INVALID')
    const halfB = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-image-asm-half-b', templateId: IMAGE_TPL, role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      backends: { image: { createArm: () => { throw new Error('the gate is off — this factory must never run') }, description: nativeDef.description, parameters: nativeDef.parameters } },
    })
    expect(halfB.ok).toBe(false)
    expect(halfB.code).toBe('IMAGE_ARM_INJECT_INVALID')
    const badGate = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-image-asm-bad-gate', templateId: IMAGE_TPL, role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { imageEnabled: 'yes' },
    })
    expect(badGate.ok).toBe(false)
    // MEASURED: the image gate's non-boolean config defect answers its OWN
    // typed code PLANE_CFG_INVALID (the write gate's spelling is
    // PLANE_CONFIG_INCOMPLETE — the two gates refuse config defects with
    // different codes; both fail closed, recorded for the center).
    expect(badGate.code).toBe('PLANE_CFG_INVALID')
  })

  it('leg 9 (pure-lexical refusals + the new-file edge): undeclared mediaType and the closed argument set die BEFORE admission (zero rows); the absent file dies at the port with zero attachment writes', async () => {
    const world = await mountWorld('lex')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    await expect(world.imageDef.execute({ file_path: 'noext' }, execFor('call-noext', events)))
      .rejects.toThrow(/P_IMAGE_CLASSIFY_UNDECLARED_MEDIA_TYPE/)
    await expect(world.imageDef.execute({ file_path: 'good.png', zoom: 2 }, execFor('call-unknown', events)))
      .rejects.toThrow(/P_IMAGE_CLASSIFY_UNKNOWN_PARAMETER/)
    // A brand-new file passes PURE-LEX classify (no stat is an approval-time
    // fact — root ruling) and the EXECUTION edge answers with the PORT'S own
    // words: zero attachment writes, zero bytes. THE CORRELATION IS -3: the
    // row allocates its correlation BEFORE classify (the single-flight ledger
    // never sees a hole), so the two pure-lexical refusals above each burned
    // one sequence number.
    const running = world.imageDef.execute({ file_path: 'ghost.png' }, execFor('call-ghost', events))
    const row = await waitRowForCall(rowCallOf(world, 3))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const failure = await running.then(() => null, (error) => error)
    if (failure === null) throw new Error('the absent-target read must refuse')
    expect(String(failure.message)).toContain('P_IMAGE_PORT_REFUSAL')
    expect(String(failure.message)).toContain('target-unreadable')
    expect((await stateNow()).requests.length).toBe(before + 1)
    expect(world.arm.stats()).toMatchObject({ portCalls: 1, commits: 0 })
    expect(world.store.saves.length).toBe(0)
    expect(world.adapter.stats().storeCalls).toBe(0)
    expect(events.length).toBe(0)
  })

  it('card ① (render): output.render hands the NATIVE two blocks — the text envelope AND the {type:image, attachment} block', async () => {
    const world = await mountWorld('render', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const target = join(world.fsRoot, 'good.png')
    const value = (await world.imageDef.execute({ file_path: 'good.png' }, execFor('call-render', []))) as Record<string, unknown>
    const renderFace = world.imageDef as unknown as { output?: { render?: (args: unknown, v: unknown) => Array<Record<string, unknown>> } }
    expect(typeof renderFace.output?.render).toBe('function')
    const blocks = renderFace.output?.render?.({ file_path: 'good.png' }, value)
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks?.length).toBe(2)
    expect(blocks?.[0]?.type).toBe('text')
    expect(String(blocks?.[0]?.text)).toContain('<path>')
    expect(String(blocks?.[0]?.text)).toContain(target)
    expect(String(blocks?.[0]?.text)).toContain('<type>image</type>')
    expect(blocks?.[1]?.type).toBe('image')
    const attachment = blocks?.[1]?.attachment as Record<string, unknown>
    expect(attachment.attachmentId).toBe(sha(PNG_1X1))
    expect(attachment.mediaType).toBe('image/png')
    expect(Number.isInteger(attachment.bytes)).toBe(true)
    expect(Number.isInteger(attachment.width)).toBe(true)
    expect(Number.isInteger(attachment.height)).toBe(true)
    // 1:1 store: no normalization happened, so the ref carries NO
    // originalDimensions (its presence would LIE about a reduction) — the
    // field is conditional exactly like the host's ref (pin639).
    expect(attachment.originalDimensions).toBeUndefined()
    // …and the text envelope carries NO downscale clause for a 1:1 read.
    expect(String(blocks?.[0]?.text)).not.toContain('downscaled from')
  })

  it('card ③ (full-argument fingerprint): two spellings of ONE governed file are TWO fingerprints over one identical approved target', async () => {
    const world = await mountWorld('fp')
    const events: Array<{ type: string; data: unknown }> = []
    const first = world.imageDef.execute({ file_path: './good.png' }, execFor('call-fp-1', events))
    const row1 = await waitRowForCall(rowCallOf(world, 1))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row1.requestId, decision: 'deny' })
    await expect(first).rejects.toThrow(/APPROVAL_DENIED/)
    const second = world.imageDef.execute({ file_path: 'good.png' }, execFor('call-fp-2', events))
    const row2 = await waitRowForCall(rowCallOf(world, 2))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row2.requestId, decision: 'deny' })
    await expect(second).rejects.toThrow(/APPROVAL_DENIED/)
    expect(world.legInputs.length).toBe(2)
    // the file's own one-read cast idiom (see the byteCap/callId legs): the
    // length guard above is the fact; the cast only carries it past tsc.
    const [leg1, leg2] = world.legInputs as [Record<string, unknown>, Record<string, unknown>]
    const fpOf = (legInput: Record<string, unknown>) => String((legInput.request as { parametersFingerprint?: string }).parametersFingerprint ?? '')
    const fp1 = fpOf(leg1)
    const fp2 = fpOf(leg2)
    expect(fp1).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(fp2).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(fp1).not.toBe(fp2)
    // …over the SAME approved target (the difference is the ORIGINAL
    // parameter spelling, not a different file).
    const targetOf = (legInput: Record<string, unknown>) => String((legInput.family as { targetManifest?: { canonicalTarget?: string } }).targetManifest?.canonicalTarget ?? '')
    expect(targetOf(leg1)).toBe(join(world.fsRoot, 'good.png'))
    expect(targetOf(leg2)).toBe(join(world.fsRoot, 'good.png'))
    expect(events.length).toBe(0)
  })

  it('card ②/③ (identity): the placement-moment arm binds the REAL def#N — arm identity === placementFeed identity === the family key === the binding fixture; the registration rides the ONE production table', async () => {
    const world = await mountWorld('identity')
    const fed = world.plane.placementFeed(A5_IMAGE_TOOL_NAME)
    expect(fed?.definitionIdentity).toBeDefined()
    expect(world.arm.definitionIdentity).toBe(fed?.definitionIdentity)
    expect(world.arm.definitionIdentity).toBe(world.familyKey)
    // the WeakMap algebra's own form — never a hand-spelled 'sha256:…' string.
    expect(world.arm.definitionIdentity).toMatch(/^def#\d+$/)
    const binding = bindingOf('identity')
    expect(binding?.definitionIdentity).toBe(world.arm.definitionIdentity)
    expect(binding?.toolName).toBe(A5_IMAGE_TOOL_NAME)
    expect(a5GovernedFamilyFor(world.familyKey)).toBe(familyTable[world.familyKey])
    expect(familyTable[world.familyKey]).toEqual({ familyId: A5_IMAGE_FAMILY_ID, adapterRevision: A5_IMAGE_ADAPTER_REVISION, providerIdentity: ARM_PROVIDER })
    expect(Object.isFrozen(familyTable[world.familyKey])).toBe(true)
  })

  // ── 233ba narrow-review fixed points (root ruling 2026-10-23) ──────────
  it('leg 10 (item ① route gate, unknown route): the refusal is native\'s FIRST sentence and the count proves it ran PRE-RESOURCE — zero port calls, zero saves', async () => {
    const world = await mountWorld('gate-route', {
      policyFor: (root) => allowPolicyFor(join(root, 'good.png')),
      imageCapability: async () => ({ ok: false, refusal: { code: 'P_IMAGE_ROUTE_UNRESOLVED', detail: 'the current model route could not be resolved (the requestHeader config and the agent options answer no provider/model, or the public llm service carries no resolveModelInfo face)' } }),
    })
    const events: Array<{ type: string; data: unknown }> = []
    await expect(world.imageDef.execute({ file_path: 'good.png' }, execFor('call-gate-route', events)))
      .rejects.toThrow(/cannot read "good\.png" as an image: the current model route could not be resolved/)
    expect(world.arm.stats()).toMatchObject({ portCalls: 0, commits: 0, consumed: 0, consumptionRefused: 1 })
    expect(world.adapter.stats().storeCalls).toBe(0)
    expect(world.store.saves.length).toBe(0)
    expect(events.length).toBe(0)
  })

  it('leg 11 (item ① route gate, non-image model): native\'s SECOND refusal sentence rides verbatim; a pure-lexical classify refusal never even reaches the probe', async () => {
    const world = await mountWorld('gate-model', {
      policyFor: (root) => allowPolicyFor(join(root, 'good.png')),
      imageCapability: async () => ({ ok: false, refusal: { code: 'P_IMAGE_MODEL_NOT_IMAGE_CAPABLE', detail: 'model "text-only-1" does not declare image input; switch to an image-capable model to read images' } }),
    })
    const events: Array<{ type: string; data: unknown }> = []
    await expect(world.imageDef.execute({ file_path: 'good.png' }, execFor('call-gate-model', events)))
      .rejects.toThrow(/model "text-only-1" does not declare image input; switch to an image-capable model to read images/)
    expect(world.arm.stats()).toMatchObject({ portCalls: 0, commits: 0, consumed: 0 })
    expect(world.adapter.stats().storeCalls).toBe(0)
    expect(events.length).toBe(0)
    // the gate sits AFTER the pure argument checks (native :240-255 run first):
    // a closed-set violation dies at classify without ever touching the route.
    let probeCalls = 0
    const counted = await mountWorld('gate-model-args', {
      policyFor: (root) => allowPolicyFor(join(root, 'good.png')),
      imageCapability: async () => { probeCalls += 1; return { ok: true } },
    })
    await expect(counted.imageDef.execute({ file_path: 'good.png', bogus: 1 } as Record<string, unknown>, execFor('call-gate-args', events)))
      .rejects.toThrow(/P_IMAGE_CLASSIFY_UNKNOWN_PARAMETER/)
    expect(probeCalls).toBe(0)
    expect(counted.arm.stats()).toMatchObject({ portCalls: 0, commits: 0 })
  })

  it('leg 12 (item ② normalization): the store\'s reduced-raster receipt rides through — normalized dims, source digest, originalDimensions, WITHOUT a second source read', async () => {
    const world = await mountWorld('norm', {
      policyFor: (root) => allowPolicyFor(join(root, 'good.png')),
      storeNormalize: { width: 32, height: 20, originalWidth: 4096, originalHeight: 2560 },
    })
    const events: Array<{ type: string; data: unknown }> = []
    const value = (await world.imageDef.execute({ file_path: 'good.png' }, execFor('call-norm', events))) as unknown as {
      image: {
        attachmentId: string
        sourceSha256: string
        normalizedEqualsSource: boolean
        width?: number
        height?: number
        originalDimensions?: { width: number; height: number }
      }
    }
    // the store DID reduce: identity != source digest, the flag states it,
    // and the ORIGINAL raster the receipt named rides through verbatim —
    // recovered from the receipt, never by re-opening the source file.
    expect(value.image.normalizedEqualsSource).toBe(false)
    expect(value.image.sourceSha256).toBe(sha(PNG_1X1).slice('sha256:'.length))
    expect(value.image.attachmentId).not.toBe(sha(PNG_1X1))
    expect(value.image.width).toBe(32)
    expect(value.image.height).toBe(20)
    expect(value.image.originalDimensions).toEqual({ width: 4096, height: 2560 })
    expect(world.arm.stats()).toMatchObject({ portCalls: 1, commits: 1 })
    expect(world.adapter.stats()).toMatchObject({ storeCalls: 1 })
    expect(events.length).toBe(0)
    // THE RENDER EDGE (root narrow review on ea12, item ①): the reduced
    // coords AND the original frame ride the plane's REAL output.render into
    // the model-facing attachment block — not just the raw execute value.
    const renderFace = world.imageDef as unknown as { output?: { render?: (a: unknown, v: unknown) => Array<Record<string, unknown>> } }
    const blocks = renderFace.output?.render?.({ file_path: 'good.png' }, value)
    const attachment = blocks?.[1]?.attachment as Record<string, unknown>
    expect(blocks?.[1]?.type).toBe('image')
    expect(attachment.width).toBe(32)
    expect(attachment.height).toBe(20)
    expect(attachment.originalDimensions).toEqual({ width: 4096, height: 2560 })
    expect(attachment.attachmentId).toBe(value.image.attachmentId)
    // THE TEXT ENVELOPE (root proof 12:04 — the serializers ride the frame
    // INSIDE the text): native's downscale clause verbatim — the original
    // dimensions and the coordinate multiplier (both axes round equal here:
    // 4096/32 = 2560/20 = 128.00 → the single-multiplier form).
    expect(String(blocks?.[0]?.text)).toContain('image/png image, 32x20 px')
    expect(String(blocks?.[0]?.text)).toContain('(downscaled from 4096x2560 px; multiply coordinates by 128.00 to locate features in the original file)')
  })

  it('leg 13 (item ② drain window during the capability probe): a dispose that lands WHILE the probe awaits still refuses before the port — the re-arm of the drain verdict after the await', async () => {
    // The probe is the ONE async edge between the entry drain check and the
    // execution checks. A deferred probe holds the call there; drain() then
    // flips the mount. When the probe finally answers ADMIT, the post-await
    // re-check must still refuse DRAINING — zero port calls, zero saves.
    const probeGate = { resolve: (_v: { ok: true }) => {}, promise: null as unknown as Promise<{ ok: true }> }
    probeGate.promise = new Promise<{ ok: true }>((resolve) => { probeGate.resolve = resolve })
    const world = await mountWorld('drain-window', {
      policyFor: (root) => allowPolicyFor(join(root, 'good.png')),
      imageCapability: () => probeGate.promise,
    })
    const events: Array<{ type: string; data: unknown }> = []
    const running = world.imageDef.execute({ file_path: 'good.png' }, execFor('call-drain-window', events))
    // the row's pre-arm edges are awaited — a macrotask tick is the honest
    // "still in flight, probe unresolved" moment.
    await new Promise((resolve) => setTimeout(resolve, 10))
    world.arm.drain()
    probeGate.resolve({ ok: true })
    await expect(running).rejects.toThrow(/P_IMAGE_DRAINING/)
    expect(world.arm.stats()).toMatchObject({ portCalls: 0, commits: 0, consumed: 0 })
    expect(world.adapter.stats().storeCalls).toBe(0)
    expect(world.store.saves.length).toBe(0)
    expect(events.length).toBe(0)
  })

  // r9 same-source scan (root ruling 12:29): the image output face obeys the
  // same canonical registration law — proven against the REAL Host639
  // assertSupportedJsonSchema (tools.register's own schema check).
  it('r9: the governed image output face is a canonical host registration face', async () => {
    const world = await mountWorld('canon-face', { policyFor: (root) => allowPolicyFor(join(root, 'good.png')) })
    const schema = (world.imageDef as unknown as { output?: { schema?: Record<string, unknown> } }).output?.schema
    if (schema === undefined) throw new Error('the image placement carries no output face')
    const hostTools = join(REPO, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
    if (!existsSync(hostTools)) throw new Error(`pristine host lib absent (${hostTools}); failing closed`)
    const host = (await import(pathToFileURL(hostTools).href)) as unknown as {
      assertSupportedJsonSchema: (schema: unknown) => void
    }
    expect(() => host.assertSupportedJsonSchema(schema)).not.toThrow()
    expect(schema.required).toEqual(['path', 'image'])
    expect(Object.values(schema.properties as Record<string, Record<string, unknown>>).some((p) => Object.hasOwn(p, 'required'))).toBe(false)
  })
})
