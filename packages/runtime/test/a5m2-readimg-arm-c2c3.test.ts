/**
 * a5m2-readimg-arm-c2c3 — M2-READIMG-01 lane boundaries of the GOVERNED
 * B-IMAGE arm REVISION 2 (center fix card; the blocked revision-1 file's
 * history stands in git at `e329ad05…`, never edited retroactively).
 *
 * WHAT "REAL A" MEANS HERE (root 07:38 ruling; 五项一次修完 item 1): the
 * positive-path receipt is NOT handcrafted — it is the durable chain's own
 * answer: REAL createProductionAdmissionAssembly (landing edges) + REAL
 * createControlService (durable TeamDomain rows) + REAL createPaControlLeg
 * (request → durable row → LEADER ALLOW decision → fresh recheck → mint →
 * guardOperation check-and-reserve). The DURABLE CONTROL-SIDE consume
 * refuses a replay on the same correlation at the chain, so no second
 * execution authority exists IN THIS LANE'S WORLD. Control consume is NOT
 * PA consume: the unified PA final edge and the execToken CONCURRENCY
 * single flight are CENTER's law and are NOT_PROVEN here (root ruling on
 * f3864b24 — vocabulary kept exact on purpose). The arm itself holds NO
 * ledger (measured by what it does NOT own: no WeakMap, no per-id
 * ownership, no identity self-report).
 *
 * THE FS-PROC PORT IS CENTER'S (root ruling): the production `readBounded`
 * (M1-verified read binary boundary: same-FD re-anchor, O_NOFOLLOW,
 * final-FD, cap+1, cancellation inside the port) is CENTER's shared face,
 * injected by the assembly. THIS FILE injects a CONTRACT DOUBLE implementing
 * exactly the ruled port shape (cap+1 stop on the real file, a SEQUENTIAL
 * consumed-view replay guard, port's own refusal words verbatim from
 * plane-effect-backends) to prove the ARM's consumption discipline against
 * the contract. The double's consumed set is a sequential lane guard only —
 * NOT concurrent single flight (that law is CENTER's, see above); the
 * port's internal same-FD race law is likewise CENTER's leg — NOT_VERIFIED
 * here.
 *
 * NOT_PROVEN (disclosed, asserted nowhere):
 *  - the attach-vision session-log ride + render face (Host dispatch leg);
 *  - the durable cross-restart entitlement ledger (in-life binding only);
 *  - the placement masking of the native spelling under the real Guard/
 *    Control/PA mount (CENTER's mount round);
 *  - what remains open on the family plane is NOT the field carriage: the
 *    center carries the block TODAY (f696e6f2 — createPaControlLeg refuses a
 *    registered family's missing/incomplete/mismatched carrier BEFORE the
 *    durable row; parsePaManifestFamilyBlock keeps all four fields at FULL
 *    VALUE; PA_FAMILY_TARGET_RULES['B-IMAGE'] pins the typed-plan shape).
 *    The earlier "projection strips the fields" claim in this file's rev-2
 *    header was WRONG: the fixture simply never passed `input.family` and
 *    never registered `governedFamilies`, so it walked the unbound legacy
 *    row path. What IS NOT_PROVEN stays the production placement masking of
 *    the native spelling under the real mount (CENTER's round);
 *  - the real normalize re-encode divergence: this checkout answers
 *    `INVALID_IMAGE` for a metadata-bearing PNG (no sharp in the lane;
 *    measured) — the lane pins the dual-hash LAW (source digest and store
 *    identity are separate facts, pass-through equality pinned) and records
 *    the divergence itself as NOT_VERIFIED-at-lane.
 *
 * Worlds: tests/homes/m2-readimg-arm-<UTC-stamp>/ (TEST_METHODS §7, deleted
 * in afterAll). Synthetic self-generated images only. CORE PATCH BUDGET 0:
 * the host tree is only ever READ through absolute-path artifact-plane
 * imports; zero bytes written there. Fail-closed: a missing pristine host
 * tree THROWS, never a skip.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-readimg-arm-c2c3
 */
import { describe, expect, it, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { open as fsOpen, stat as fsStat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree, homeRoot } from '../../../tests/paths.mjs'
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
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import { createProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { EffectSetApprovalPlan } from '../tool-admission/approval-case.js'
import {
  createPaControlLeg,
  createPaEffectsVerifier,
  paCorrelation,
} from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaControlLegResult, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { leaderCaller, memberCaller, P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, p6t4Seed } from './p6t4-helpers.js'
import { createGovernedReadImageArm, A5_IMAGE_ADAPTER_REVISION, A5_IMAGE_FAMILY_ID, A5_IMAGE_MANIFEST_SCHEMA, A5_IMAGE_TYPED_CODES } from '../src/plugin/live/governed-families/image.mjs'
import { createImageAttachmentAdapter, A5_IMAGE_ATTACHMENT_CODES } from '../src/plugin/live/governed-families/image-attachment.mjs'
import type { ImageAttachmentStorePort } from '../src/plugin/live/governed-families/image-attachment.d.mts'
import type {
  GovernedReadImageArmHandle,
  ImageCallFacts,
  ImageConsumptionReceipt,
  ImageReadBoundedOutcome,
  ImageReadBoundedPort,
} from '../src/plugin/live/governed-families/image.d.mts'

// ── artifact-plane plumbing (host tree READ-only) ────────────────────────
interface LooseFiber { dispose?: () => Promise<void> }
interface LooseCtx {
  plugin: (p: unknown, cfg?: Record<string, unknown>) => Promise<LooseFiber>
  get: (name: string) => Record<string, unknown> | undefined
  tools: { execute: (input: Record<string, unknown>) => Promise<{ isError?: boolean; content?: { type?: unknown; text?: unknown }[] }> }
  llm: { registerAdapter: (providers: readonly string[], adapter: object) => unknown }
  dispose?: () => Promise<void>
}

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('m2-readimg-arm: no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST = testUseTree(REPO)
function hostLib(rel: string): string {
  const abs = join(HOST, 'packages', rel, 'lib/index.js')
  if (!existsSync(abs)) throw new Error(`m2-readimg-arm: pristine host lib absent (${abs}); failing closed`)
  return pathToFileURL(abs).href
}
const CORDIS_LIB = join(HOST, 'vendor/cordis/lib/index.js')
if (!existsSync(CORDIS_LIB)) throw new Error(`m2-readimg-arm: vendored cordis lib absent (${CORDIS_LIB}); failing closed`)

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const PNG_3X3 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEElEQVR4nGP4z8AAQQxYWACPjgj4kWPEuQAAAABJRU5ErkJggg==', 'base64')
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')

const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `m2-readimg-arm-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function countObjects(storeRoot: string): number {
  const objectsDir = join(storeRoot, 'objects')
  if (!existsSync(objectsDir)) return 0
  let n = 0
  for (const shard of readdirSync(objectsDir, { withFileTypes: true })) {
    if (shard.isDirectory()) n += readdirSync(join(objectsDir, shard.name)).length
  }
  return n
}

// ── the REAL durable chain (a5-m1-auth-bridge pattern, minimal subset) ───
const CHAIN_WORLD = join(WORLD_ROOT, 'chain')
mkdirSync(join(CHAIN_WORLD, 'root'), { recursive: true })
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
for (const name of ['leader', 'worker', 'scribe'] as const) {
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
afterAll(async () => { await domain.close() })

const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})

const ARM_DEFINITION = 'defn-pin639-read_image@fixture'
const ARM_PROVIDER = 'a5p5-plane'

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly }
const realmTruths = new Map<string, RealmTruth>()

/** The one-shot FACTS shape of CENTER's `readCallFacts` (the B dependency
 *  table) — same laws as the registered spec's fake: durable attribution,
 *  live plan, closed parses; never a partial answer. */
const fakeReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
  const truth = realmTruths.get(input.manifest.realmId)
  if (truth === undefined) return undefined
  const manifest = input.manifest
  if (input.rootSessionId !== P6T4_ROOT) return undefined
  const durable = repos.memberInstances.get(P6T4_ROOT, manifest.member.instanceId)
  if (durable === undefined) return undefined
  const binding = parseToolBinding({ ...manifest.binding })
  if (!binding.ok) return undefined
  const effects = parseRequestedEffectSet(manifest.effects)
  if (!effects.ok) return undefined
  const request: AdmissionRequest = Object.freeze({
    binding: binding.value,
    member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) }),
    callId: manifest.callId,
    realmId: manifest.realmId,
    parametersFingerprint: manifest.parametersFingerprint,
    requestedEffects: effects.value as RequestedEffectSet,
  })
  const livePlan = truth.assembly.planApproval(request)
  if (!livePlan.ok) return undefined
  return {
    policySource: { staticLayerRefs: ['a5m2-readimg-tpl:directive-policy'], overlayGeneration: 0 },
    realmId: manifest.realmId,
    ceiling: {
      teamHardEnvelope: EMPTY_DOCS.teamHardEnvelope as unknown as PaCallFactsCeilingSlot,
      permissionMutationEnvelope: EMPTY_DOCS.permissionMutationEnvelope as unknown as PaCallFactsCeilingSlot,
    },
    policyDocument: truth.assembly.policyDocument(),
    denySources: truth.assembly.denySources(),
    effects: effects.value as RequestedEffectSet,
    member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
    beneficiaryAuthority: 'member',
    binding: binding.value,
    blueprint: {
      revision: String(blueprint.revision),
      contentHash: String(blueprint.contentHash),
      // the plan's template identity is the assembly's declared template
      templateId: 'a5m2-readimg-tpl',
      cwd: CHAIN_WORLD,
      providerVersion: 'a5p5-plane',
    },
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
    authorityGeneration: 0,
    // CURRENT governed-family registration (center f696e6f2 point 3): the
    // guard compares the row's block against THIS field-by-field — moved
    // adapter / moved provider / vanished registration is drift, deny.
    governedFamily: {
      familyId: A5_IMAGE_FAMILY_ID,
      adapterRevision: A5_IMAGE_ADAPTER_REVISION,
      providerIdentity: ARM_PROVIDER,
    },
  }
}
const paVerifier = createPaEffectsVerifier({ readCallFacts: fakeReadCallFacts })

const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: paVerifier,
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
async function waitRow(isNew: (row: ControlRequestRecord) => boolean, timeoutMs = 20_000): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = (await service.listControlState(P6T4_ROOT)).requests.find(isNew)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error('the durable control row never appeared')
    await sleep(25)
  }
}

let realmSeq = 0
function makeAssembly(): { assembly: ProductionAdmissionAssembly; realm: string } {
  const realmId = `a5m2-img-r-${String(realmSeq++)}`
  const built = createProductionAdmissionAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-readimg-tpl',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => Date.now(),
    authorityGeneration: () => 0,
    beneficiaryAuthority: 'member',
    onObserve: () => {},
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.error.message}`)
  realmTruths.set(realmId, { assembly: built.value })
  return { assembly: built.value, realm: realmId }
}

interface ChainCase {
  input: PaControlLegInput
  plan: EffectSetApprovalPlan
  callFacts: ImageCallFacts
  correlation: string
}

/** The leg input for ONE governed read_image call over `canonicalTarget`.
 *  The EFFECTS are the ARM'S OWN classify output (never a second claim). */
function chainCase(arm: GovernedReadImageArmHandle, ctx: { assembly: ProductionAdmissionAssembly; realm: string }, callId: string, filePath: string, canonicalTarget: string): ChainCase {
  const classified = arm.classify({ file_path: filePath })
  if (classified.ok !== true) throw new Error(`classify refused in fixture: ${classified.code}`)
  const bindingParsed = parseToolBinding({
    bindingId: `img:${callId}`,
    agentScopeKey: `img:${callId}`,
    toolName: 'read_image',
    definitionIdentity: ARM_DEFINITION,
    providerId: ARM_PROVIDER,
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'confined-subprocess',
    assurance: untestedAssurance('team-trusted-extension', 'confined-subprocess', ctx.realm),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  })
  if (!bindingParsed.ok) throw new Error(`binding refused: ${JSON.stringify(bindingParsed.problems)}`)
  const effectsParsed = parseRequestedEffectSet((classified.effects as { effects: unknown[] }).effects ?? classified.effects)
  if (!effectsParsed.ok) throw new Error(`effects refused: ${JSON.stringify(effectsParsed.problems)}`)
  const member = Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER })
  const request: AdmissionRequest = Object.freeze({
    binding: bindingParsed.value,
    member,
    callId,
    realmId: ctx.realm,
    parametersFingerprint: canonicalJsonFingerprint({ file_path: filePath }),
    requestedEffects: effectsParsed.value as RequestedEffectSet,
  })
  const planned = ctx.assembly.planApproval(request)
  if (!planned.ok) throw new Error(`plan refused: ${planned.error.message}`)
  // THE FAMILY CARRIER IS PART OF THE CALL (center f696e6f2): the leg input
  // carries the four fields and the registration is keyed on the definition
  // identity — the durable row then holds the block at FULL VALUE.
  const rawTarget = JSON.parse(JSON.stringify(classified.targetManifest)) as NonNullable<PaControlLegInput['family']>['targetManifest']
  const input: PaControlLegInput = Object.freeze({
    realmId: ctx.realm,
    member,
    callId,
    request,
    plan: planned.value,
    assembly: ctx.assembly,
    family: {
      familyId: A5_IMAGE_FAMILY_ID,
      adapterRevision: A5_IMAGE_ADAPTER_REVISION,
      providerIdentity: ARM_PROVIDER,
      targetManifest: rawTarget,
    },
  })
  const callFacts: ImageCallFacts = {
    member: { teamSessionId: P6T4_ROOT, instanceId: WORKER },
    callId,
    authorityGeneration: planned.value.authorityGeneration,
    definitionIdentity: ARM_DEFINITION,
    providerIdentity: ARM_PROVIDER,
    // THE CONSUMPTION EXECUTION CONTEXT: every driven case here is an ASK
    // world case (a durable approval case exists); world (a) all-allow is
    // exercised by its own leg.
    approval: 'ask',
  }
  void canonicalTarget
  return { input, plan: planned.value, callFacts, correlation: paCorrelation(planned.value.approvalCaseId, callId) }
}

/** Drive the REAL chain to an approve receipt (human allow, guard-consumed). */
/** The plane's BOUND-family registration (center discriminator, keyed on
 *  the trusted definition identity — never on a caller-chosen name). */
const GOVERNED: Record<string, { familyId: string, adapterRevision: number, providerIdentity: string }> = {
  [ARM_DEFINITION]: { familyId: A5_IMAGE_FAMILY_ID, adapterRevision: A5_IMAGE_ADAPTER_REVISION, providerIdentity: ARM_PROVIDER },
}

function makeLeg(): ReturnType<typeof createPaControlLeg> {
  return createPaControlLeg({
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    beneficiaryAuthority: 'member',
    governedFamilies: GOVERNED,
  })
}

async function approve(c: ChainCase): Promise<PaControlLegResult> {
  const leg = makeLeg()
  const pending = leg(c.input)
  const row = await waitRow((r) => r.correlation === c.correlation)
  try {
    // THE DECIDER IS THE LEADER (carrier default: member ask ->
    // leader-approval; the registered spec resolves the same shape with
    // leaderCaller). A wrong-rung reviewer gets no allow written — the
    // measured first failure of this revision was exactly that.
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller() as ActionCaller, requestId: row.requestId, decision: 'allow' })
  } catch (error) {
    // The replay of an already-decided case hits the DURABLE single-decision
    // law ("the first decision is authoritative") — the leg proceeds on the
    // first decision; the guard's consumption fact is what refuses it below.
    const code = (error as { code?: string }).code
    if (code !== 'CONTROL_REQUEST_DECIDED' && !/already carries a durable decision/.test(String((error as Error)?.message ?? ''))) throw error
  }
  return await pending
}

// ── the CENTER port CONTRACT DOUBLE (disclosed: production face is CENTER's) ─
interface PortHandle { port: ImageReadBoundedPort; counters: { calls: number }; grants: string[] }
function makePort(opts: {
  hangUntilAbort?: boolean
  refuse?: { code: string; detail: string }
  /** abort the invocation's signal AFTER the bytes are read, BEFORE return —
   *  the arm's commit-boundary re-check must catch it (fix card 3). */
  abortBeforeReturn?: { controller: AbortController }
  oneShotGrants?: boolean
} = {}): PortHandle {
  const counters = { calls: 0 }
  const grants: string[] = []
  const consumed = new Set<string>()
  const port: ImageReadBoundedPort = async (grantRef, { maxBytes, signal }) => {
    counters.calls += 1
    // a closure on purpose: abort state MUTATES asynchronously, so the
    // property-access narrowing TS keeps across awaits must not decide this
    const aborted = (): boolean => signal?.aborted === true
    const grantId = String(grantRef.grant?.grantId ?? '')
    grants.push(grantId)
    if (opts.oneShotGrants === true && consumed.has(grantId)) {
      // SEQUENTIAL consumed view IN THIS DOUBLE only — a lane replay guard.
      // It is NOT concurrent single flight: that law (execToken / unified PA
      // final edge) belongs to CENTER and is not claimed anywhere here.
      return { ok: false, code: 'grant-consumed', detail: `grant ${grantId} is spent: the double's sequential consumed view refuses the sequential replay (the real consumed-view law is CENTER's)` }
    }
    if (opts.refuse !== undefined) return { ...opts.refuse, ok: false }
    if (opts.hangUntilAbort === true) {
      // the listener must REJECT — a throw inside an EventTarget callback is
      // an uncaught event error, never a rejection (measured rev-1 fact).
      await new Promise<void>((resolve, reject) => {
        const onAbort = (): void => {
          const e = new Error('aborted during the content read')
          e.name = 'AbortError'
          reject(e)
        }
        if (signal?.aborted === true) onAbort()
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    if (aborted()) {
      const e = new Error('aborted before the read')
      e.name = 'AbortError'
      throw e
    }
    // the ruled cap+1 stop ON ONE HANDLE (the double reads the real file the
    // way the port contract answers: never more than cap+1 bytes).
    const st = await fsStat(grantRef.canonicalLocator)
    const kind = st.isFile() ? 'file' : st.isDirectory() ? 'directory' : 'unknown'
    const want = Math.min(st.size, maxBytes + 1)
    const buffer = new Uint8Array(want)
    const handle = await fsOpen(grantRef.canonicalLocator, 'r')
    let read = 0
    try {
      while (read < want) {
        if (aborted()) {
          const e = new Error('aborted during the content read')
          e.name = 'AbortError'
          throw e
        }
        const { bytesRead } = await handle.read(buffer, read, want - read, read)
        if (bytesRead === 0) break
        read += bytesRead
      }
    } finally { await handle.close() }
    if (opts.abortBeforeReturn !== undefined) opts.abortBeforeReturn.controller.abort()
    consumed.add(grantId)
    const outcome: ImageReadBoundedOutcome = { ok: true, value: { bytes: buffer.subarray(0, read), observedKind: kind, byteLength: read } }
    return outcome
  }
  return { port, counters, grants }
}

// ── arm worlds (real attachment store; port double) ──────────────────────
function asStorePort(svc: Record<string, unknown> | undefined): ImageAttachmentStorePort {
  if (svc === undefined || typeof svc.saveImage !== 'function' || typeof svc.readImage !== 'function' || typeof svc.imageLimits !== 'object') {
    throw new Error('m2-readimg-arm: the real attachment service did not mount — failing closed')
  }
  // BIND the receivers (measured rev-1 fact: bare extraction loses the
  // service `this` — "Cannot read properties of undefined (reading 'run')").
  return {
    saveImage: (svc.saveImage as ImageAttachmentStorePort['saveImage']).bind(svc),
    readImage: (svc.readImage as ImageAttachmentStorePort['readImage']).bind(svc),
    imageLimits: svc.imageLimits as ImageAttachmentStorePort['imageLimits'],
  }
}

interface ArmWorld {
  govRoot: string
  outsideDir: string
  arm: GovernedReadImageArmHandle
  adapter: ReturnType<typeof createImageAttachmentAdapter>
  port: PortHandle
  ctx: { assembly: ProductionAdmissionAssembly; realm: string }
  storeRoot: string
  objects: () => number
  dispose: () => Promise<void>
}

async function armWorld(storeConfig: Record<string, unknown> = {}, portOpts: Parameters<typeof makePort>[0] = {}): Promise<ArmWorld> {
  const dir = worldDir('arm')
  const govRoot = join(dir, 'gov')
  const outsideDir = join(dir, 'outside')
  mkdirSync(govRoot, { recursive: true })
  mkdirSync(outsideDir, { recursive: true })
  const cordisMod = await import(pathToFileURL(CORDIS_LIB).href)
  const attachmentLocalMod = await import(hostLib('attachment/attachment-local'))
  const ctx: LooseCtx = new cordisMod.Context()
  const storeFiber = await ctx.plugin(attachmentLocalMod.default, { dshHome: join(dir, 'home'), ...storeConfig })
  const storeSvc = ctx.get('attachments')
  const adapter = createImageAttachmentAdapter({ store: asStorePort(storeSvc) })
  const port = makePort(portOpts)
  // the assembly realm carries the durable row; the arm answers IN IT (the
  // F effect and the consumption tie both bind it).
  const realm = makeAssembly()
  const arm = createGovernedReadImageArm({
    definitionIdentity: ARM_DEFINITION,
    providerId: ARM_PROVIDER,
    realmId: realm.realm,
    namespaceRoot: govRoot,
    readBounded: port.port,
    attachments: adapter,
  })
  const storeRoot = typeof storeSvc?.root === 'string' ? storeSvc.root : ''
  if (storeRoot.length === 0) throw new Error('m2-readimg-arm: store root missing — failing closed')
  return {
    govRoot,
    outsideDir,
    arm,
    adapter,
    port,
    ctx: realm,
    storeRoot,
    objects: () => countObjects(storeRoot),
    dispose: async () => { await storeFiber.dispose?.(); await ctx.dispose?.() },
  }
}

const cloneManifest = (receipt: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify((receipt as { manifest?: unknown }).manifest ?? {})) as Record<string, unknown>

/** Narrow a classify REFUSAL (the typed-code legs all assert refusals). */
function refusedClassify(r: ReturnType<GovernedReadImageArmHandle['classify']>): { code: string, detail: string } {
  if (r.ok === true) throw new Error('fixture: classify unexpectedly accepted the input')
  return r
}

// ── the untouched NATIVE face (pre-fix repro) ────────────────────────────
interface NativeWorld { readAbs: (absPath: string) => Promise<{ isError: boolean; text: string }>; dispose: () => Promise<void> }
async function nativeWorld(cwd: string): Promise<NativeWorld> {
  const cordisMod = await import(pathToFileURL(CORDIS_LIB).href)
  const toolsMod = await import(hostLib('core/tools'))
  const llmMod = await import(hostLib('llm/llm'))
  const spMod = await import(hostLib('core/system-prompt'))
  const fsLocalMod = await import(hostLib('fs/fs-local'))
  const fsPolicyMod = await import(hostLib('fs/fs-observation-policy'))
  const attachmentLocalMod = await import(hostLib('attachment/attachment-local'))
  const toolFsMod = await import(hostLib('fs/tool-fs'))
  const ctx: LooseCtx = new cordisMod.Context()
  await ctx.plugin(spMod.default)
  await ctx.plugin(toolsMod.default, { mode: 'native' })
  await ctx.plugin(fsLocalMod.default, { cwd })
  await ctx.plugin(fsPolicyMod)
  await ctx.plugin(attachmentLocalMod.default, { dshHome: join(cwd, 'home') })
  await ctx.plugin(llmMod.default)
  class CatalogAdapter extends llmMod.LlmAdapter {
    listModels(_provider: string): readonly Record<string, unknown>[] {
      return [{ provider: 'visual', id: 'vision-model', name: 'Vision', inputModalities: ['text', 'image'] }]
    }
    resolveModel(provider: string, model: string): Promise<Record<string, unknown>> {
      return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text', 'image'] })
    }
    stream(): never { throw new Error('m2-readimg-arm fixture never streams') }
  }
  ctx.llm.registerAdapter(['visual'], new CatalogAdapter())
  await ctx.plugin(toolFsMod)
  const agent = {
    options: {},
    session: {
      header: { cwd },
      requestHeader: () => ({ config: { provider: 'visual', model: 'vision-model' } }),
      deriveMessages: () => [],
      append: () => undefined,
    },
  }
  return {
    readAbs: async (absPath) => {
      const r = await ctx.tools.execute({
        signal: new AbortController().signal,
        callId: llmMod.ToolCallId('arm-native-1'),
        name: 'read_image',
        arguments: { file_path: absPath },
        agent,
      })
      return { isError: r.isError === true, text: (r.content ?? []).filter((b) => b?.type === 'text').map((b) => (typeof b.text === 'string' ? b.text : '')).join('') }
    },
    dispose: async () => { await ctx.dispose?.() },
  }
}

// ═══ the legs ═══
describe('a5m2-readimg arm rev2 — real strict-chain consumption over the durable center (real chain + real store; CENTER port = contract double)', () => {
  it('C2 positive on the REAL chain (ask world): durable approve receipt (row + LEADER allow decision + durable check-and-reserve) executes through the arm to one capped read and one commit; the receipt separates sourceSha256 from the store identity; the same-namespace reference is byte-exact; the second leg attempt on the same correlation dies at the durable consumption fact', async () => {
    const w = await armWorld({}, { oneShotGrants: true })
    try {
      const target = join(w.govRoot, 'photo.png')
      writeFileSync(target, PNG_1X1)
      const c = chainCase(w.arm, w.ctx, 'img-pos-1', 'photo.png', target)
      const receipt = await approve(c)
      expect(receipt.decision, JSON.stringify(receipt)).toBe('approve')
      const approveReceipt = receipt as Extract<PaControlLegResult, { decision: 'approve' }>
      // the manifest is the DURABLE row's own class — not a fixture handoff
      expect(approveReceipt.manifest?.schema).toBe(A5_IMAGE_MANIFEST_SCHEMA)
      expect(approveReceipt.manifest?.approvalCaseId).toBe(c.plan.approvalCaseId)
      expect(approveReceipt.manifest?.parametersFingerprint).toBe(canonicalJsonFingerprint({ file_path: 'photo.png' }))
      const ran = await w.arm.execute({ file_path: 'photo.png' }, approveReceipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(ran.ok, ran.detail).toBe(true)
      const image = ran.value?.image
      expect(image?.mediaType).toBe('image/png')
      // fix card 5: two SEPARATE facts; pass-through pins the equality
      expect(image?.sourceSha256).toBe(sha(PNG_1X1))
      expect(image?.normalizedEqualsSource).toBe(true)
      // measured pin639 form: the store's attachmentId is `sha256:<hex>`,
      // the hex being the source digest for a pass-through save
      expect(image?.attachmentId).toBe(`sha256:${sha(PNG_1X1)}`)
      expect(existsSync(join(w.storeRoot, 'objects', sha(PNG_1X1).slice(0, 2), sha(PNG_1X1)))).toBe(true)
      // THE REAL CHAIN CARRIES THE FAMILY BLOCK (f696e6f2): leg input.family
      // + governedFamilies registration → the DURABLE row's own manifest.
      expect(approveReceipt.manifest?.familyId).toBe(A5_IMAGE_FAMILY_ID)
      expect(approveReceipt.manifest?.adapterRevision).toBe(A5_IMAGE_ADAPTER_REVISION)
      expect(approveReceipt.manifest?.providerIdentity).toBe(ARM_PROVIDER)
      expect(JSON.stringify((approveReceipt.manifest?.targetManifest as Record<string, unknown> | undefined)?.canonicalTarget)).toBe(JSON.stringify(target))
      expect('disclosure' in ran).toBe(false) // the pending-release is DELETED
      // one read, one commit — no second fact face
      expect(w.port.counters.calls).toBe(1)
      expect(w.adapter.stats().commits).toBe(1)
      // reference back into the minting namespace: byte-exact
      const ns = {
        realmId: String(approveReceipt.manifest?.realmId),
        teamSessionId: String(approveReceipt.manifest?.member.teamSessionId),
        instanceId: String(approveReceipt.manifest?.member.instanceId),
      }
      const ref = await w.arm.reference(String(image?.attachmentId), ns)
      expect(ref.ok).toBe(true)
      expect(Buffer.compare(Buffer.from(ref.bytes as Uint8Array), Buffer.from(PNG_1X1))).toBe(0)
      // CORRELATION-LEVEL SINGLE FLIGHT at the durable edge: replay the leg.
      const replay = await approve(c)
      expect(replay.decision).toBe('deny')
      if (replay.decision !== 'deny') throw new Error('fixture: the replay must deny')
      expect(String(replay.detail)).toMatch(/guard|consum/i)
      // still exactly one committed object and one execution
      expect(w.objects()).toBe(1)
      expect(w.adapter.stats().commits).toBe(1)
    } finally { await w.dispose() }
  }, 30_000)

  it('no receipt, no execution: undefined/deny/manifest-less/grant-less receipts all refuse typed with ZERO port calls', async () => {
    const w = await armWorld()
    try {
      const target = join(w.govRoot, 'photo.png')
      writeFileSync(target, PNG_1X1)
      const c = chainCase(w.arm, w.ctx, 'img-rec-1', 'photo.png', target)
      const approveReceipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const noReceipt = await w.arm.execute({ file_path: 'photo.png' }, undefined, c.callFacts)
      expect(noReceipt.code).toBe(A5_IMAGE_TYPED_CODES.RECEIPT_INCOMPLETE)
      const denyReceipt = await w.arm.execute({ file_path: 'photo.png' }, { decision: 'deny' }, c.callFacts)
      expect(denyReceipt.code).toBe(A5_IMAGE_TYPED_CODES.RECEIPT_INCOMPLETE)
      const noManifest = { ...approveReceipt, manifest: undefined } as unknown as ImageConsumptionReceipt
      expect((await w.arm.execute({ file_path: 'photo.png' }, noManifest, c.callFacts)).code).toBe(A5_IMAGE_TYPED_CODES.RECEIPT_INCOMPLETE)
      const noGrant = { ...approveReceipt, grant: undefined } as unknown as ImageConsumptionReceipt
      expect((await w.arm.execute({ file_path: 'photo.png' }, noGrant, c.callFacts)).code).toBe(A5_IMAGE_TYPED_CODES.RECEIPT_INCOMPLETE)
      expect(w.port.counters.calls).toBe(0)
      expect(w.adapter.stats().storeCalls).toBe(0)
    } finally { await w.dispose() }
  }, 30_000)

  it('the five-way binding refuses PAIR BY PAIR on the real durable manifest (callId / member / authorityGeneration / definition / provider), zero port calls each', async () => {
    const w = await armWorld()
    try {
      const target = join(w.govRoot, 'photo.png')
      writeFileSync(target, PNG_1X1)
      const c = chainCase(w.arm, w.ctx, 'img-bind-1', 'photo.png', target)
      const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const cases: Array<(m: Record<string, unknown>) => void> = [
        (m) => { m.callId = 'someone-elses-call' },
        (m) => { (m.member as Record<string, unknown>).instanceId = String(p6t4Seed('scribe').instanceId) },
        (m) => { m.authorityGeneration = 99 },
        (m) => { (m.binding as Record<string, unknown>).definitionIdentity = 'defn-forged' },
        (m) => { (m.binding as Record<string, unknown>).providerId = 'def-provider' },
      ]
      for (const mutate of cases) {
        const m = cloneManifest(receipt)
        mutate(m)
        const forged = { decision: 'approve', requestId: receipt.requestId, grant: receipt.grant, manifest: m } as unknown as ImageConsumptionReceipt
        const ran = await w.arm.execute({ file_path: 'photo.png' }, forged, c.callFacts)
        expect(ran.code, JSON.stringify(mutate)).toBe(A5_IMAGE_TYPED_CODES.CONSUMPTION_BINDING_MISMATCH)
      }
      // and the call-side swap: wrong trusted facts refuse too
      const swapped: ImageCallFacts = { ...c.callFacts, callId: 'other-call' }
      expect((await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, swapped)).code).toBe(A5_IMAGE_TYPED_CODES.CONSUMPTION_BINDING_MISMATCH)
      expect(w.port.counters.calls).toBe(0)
      expect(w.adapter.stats().storeCalls).toBe(0)
    } finally { await w.dispose() }
  }, 30_000)

  it('approved target ≠ executed target refuses typed (swap the arguments after approval; the tie runs on TODAY\'S projected effects)', async () => {
    const w = await armWorld()
    try {
      const a = join(w.govRoot, 'a.png')
      const b = join(w.govRoot, 'b.png')
      writeFileSync(a, PNG_1X1)
      writeFileSync(b, PNG_3X3)
      const c = chainCase(w.arm, w.ctx, 'img-tie-1', 'a.png', a)
      const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const ran = await w.arm.execute({ file_path: 'b.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.TARGET_TIE_MISMATCH)
      expect(w.port.counters.calls).toBe(0)
    } finally { await w.dispose() }
  }, 30_000)

  it('family carrier is REQUIRED for a bound call and compared FIELD BY FIELD: the real chain carries the block (f696e6f2); a stripped carrier fails closed (NO pending release); ANY typed-plan field drift refuses beyond the four carrier values; the leg refuses a missing carrier BEFORE the row', async () => {
    const w = await armWorld()
    try {
      const target = join(w.govRoot, 'photo.png')
      writeFileSync(target, PNG_1X1)
      const c = chainCase(w.arm, w.ctx, 'img-fam-1', 'photo.png', target)
      const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const ran = await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(ran.ok, ran.detail).toBe(true)
      // STRIPPED carrier (a legacy/unbound row shape cannot execute a bound
      // call): refused as an incomplete receipt — the rev-2 "pending
      // release" is deleted per the root ruling on f3864b24.
      const stripped = cloneManifest(receipt)
      delete stripped.familyId
      delete stripped.adapterRevision
      delete stripped.providerIdentity
      delete stripped.targetManifest
      const ranStripped = await w.arm.execute({ file_path: 'photo.png' }, { decision: 'approve', requestId: receipt.requestId, grant: receipt.grant, manifest: stripped } as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(ranStripped.code).toBe(A5_IMAGE_TYPED_CODES.RECEIPT_INCOMPLETE)
      // FIELD-BY-FIELD plan equality BEYOND the four carrier values: each
      // tamper rides a fresh real approval so every attempt is clean.
      const tampers: Array<{ name: string, run: (m: Record<string, unknown>) => void }> = [
        { name: 'familyId', run: (m) => { m.familyId = 'B-WEB' } },
        { name: 'adapterRevision', run: (m) => { m.adapterRevision = 1 } },
        { name: 'providerIdentity', run: (m) => { m.providerIdentity = 'def-provider' } },
        { name: 'byteCap', run: (m) => { const tm = { ...(m.targetManifest as Record<string, unknown>) }; tm.byteCap = Number(tm.byteCap) + 1; m.targetManifest = tm } },
        { name: 'declaredMediaType', run: (m) => { const tm = { ...(m.targetManifest as Record<string, unknown>) }; tm.declaredMediaType = 'image/gif'; m.targetManifest = tm } },
        { name: 'businessObligations', run: (m) => { const tm = { ...(m.targetManifest as Record<string, unknown>) }; const obs = [...(tm.businessObligations as Array<Record<string, unknown>>)]; obs[0] = { ...obs[0], right: 'write-everything' }; tm.businessObligations = obs; m.targetManifest = tm } },
        { name: 'missingPlanField', run: (m) => { const tm = { ...(m.targetManifest as Record<string, unknown>) }; delete tm.byteCapSource; m.targetManifest = tm } },
        { name: 'extraPlanField', run: (m) => { const tm = { ...(m.targetManifest as Record<string, unknown>) }; tm.unregisteredField = 'ride-along'; m.targetManifest = tm } },
      ]
      for (const [i, tamper] of tampers.entries()) {
        const cc = chainCase(w.arm, w.ctx, `img-fam-t-${String(i)}`, 'photo.png', target)
        const r = await approve(cc) as Extract<PaControlLegResult, { decision: 'approve' }>
        const m = cloneManifest(r)
        tamper.run(m)
        const ranT = await w.arm.execute({ file_path: 'photo.png' }, { decision: 'approve', requestId: r.requestId, grant: r.grant, manifest: m } as unknown as ImageConsumptionReceipt, cc.callFacts)
        expect(ranT.code, tamper.name).toBe(A5_IMAGE_TYPED_CODES.FAMILY_FACTS_MISMATCH)
      }
      // THE CENTER EDGE (witnessed, not implemented here): a REGISTERED
      // family whose leg input carries NO carrier is denied BEFORE the
      // durable row — zero durable write, no approval can exist.
      const cNo = chainCase(w.arm, w.ctx, 'img-fam-nocarrier', 'photo.png', target)
      const inputNo = { ...cNo.input } as PaControlLegInput
      delete (inputNo as { family?: unknown }).family
      const preRow = await makeLeg()(inputNo)
      expect(preRow.decision).toBe('deny')
      if (preRow.decision !== 'deny') throw new Error('fixture: the center must deny')
      expect(String(preRow.detail)).toContain('family-review-facts-missing')
    } finally { await w.dispose() }
  }, 120_000)

  it('world (a) all-allow is a LEGAL world (root ruling on f3864b24 item 1): no Control row, no requestId, receipt undefined EXECUTES on the trusted consumption context; a receipt presented there is a synthesized approval and refuses; an unclassified context never reaches a backend', async () => {
    const w = await armWorld()
    try {
      const target = join(w.govRoot, 'photo.png')
      writeFileSync(target, PNG_1X1)
      const rowsBefore = (await service.listControlState(P6T4_ROOT)).requests.length
      const facts: ImageCallFacts = {
        member: { teamSessionId: P6T4_ROOT, instanceId: WORKER },
        callId: 'img-allow-1',
        authorityGeneration: 0,
        definitionIdentity: ARM_DEFINITION,
        providerIdentity: ARM_PROVIDER,
        approval: 'all-allow',
      }
      const ran = await w.arm.execute({ file_path: 'photo.png' }, undefined, facts)
      expect(ran.ok, ran.detail).toBe(true)
      expect(w.port.counters.calls).toBe(1)
      expect(w.adapter.stats().commits).toBe(1)
      // no Control row was ever needed or created by this execution
      expect((await service.listControlState(P6T4_ROOT)).requests.length).toBe(rowsBefore)
      // a receipt in world (a) can only be SYNTHESIZED: 伪 requestId/占位 id
      // are refused — the all-allow fact is the ABSENCE, never a fake approve
      const forged = { decision: 'approve', requestId: 'ctrl-placeholder-0', grant: { grantId: 'grant-placeholder' } } as unknown as ImageConsumptionReceipt
      expect((await w.arm.execute({ file_path: 'photo.png' }, forged, facts)).code).toBe(A5_IMAGE_TYPED_CODES.RECEIPT_INCOMPLETE)
      // no context, no backend: the arm never guesses the world
      const noCtx = { ...facts } as Partial<ImageCallFacts>
      delete noCtx.approval
      expect((await w.arm.execute({ file_path: 'photo.png' }, undefined, noCtx as ImageCallFacts)).code).toBe(A5_IMAGE_TYPED_CODES.CONSUMPTION_CONTEXT_UNKNOWN)
    } finally { await w.dispose() }
  }, 30_000)

  it('capacity lands at READ time: the port answers the cap+1 fact against a 32-byte deployment cap and the arm refuses BEFORE the commit — zero objects', async () => {
    const w = await armWorld({ maxImageBytes: 32 })
    try {
      const target = join(w.govRoot, 'big.png')
      writeFileSync(target, PNG_1X1) // 69 bytes > 32
      const c = chainCase(w.arm, w.ctx, 'img-cap-1', 'big.png', target)
      const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const ran = await w.arm.execute({ file_path: 'big.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.READ_TOO_LARGE)
      expect(ran.detail).toContain('33 bytes') // cap+1, exactly what the port stops at
      expect(w.adapter.stats().storeCalls).toBe(0)
      expect(w.objects()).toBe(0)
    } finally { await w.dispose() }
  }, 30_000)

  it('the port refusal comes back VERBATIM (ANCHOR-DRIFT / fd-recycled are the CENTER law\'s words, not remapped), zero attachment writes', async () => {
    for (const refusal of [
      { code: 'ANCHOR-DRIFT', detail: 'the resolved target differs from the approved lexical target; this call is stale and runs nothing' },
      { code: 'fd-recycled', detail: 'fd 42 is not a lane-held handle for this descriptor (a recycled number is never trusted)' },
    ]) {
      const w = await armWorld({}, { refuse: refusal })
      try {
        const target = join(w.govRoot, 'photo.png')
        writeFileSync(target, PNG_1X1)
        const c = chainCase(w.arm, w.ctx, `img-drift-${refusal.code}`, 'photo.png', target)
        const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
        const ran = await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
        expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.PORT_REFUSAL)
        expect(ran.portCode).toBe(refusal.code)
        expect(ran.detail).toContain(refusal.detail)
        expect(w.adapter.stats().storeCalls).toBe(0)
      } finally { await w.dispose() }
    }
  }, 60_000)

  it('cancellation at all three points is zero-write: pre-flight (0 port calls), mid-read (AbortError), and AFTER the read BEFORE the commit (the commit-boundary re-check catches it)', async () => {
    {
      const w = await armWorld()
      try {
        const target = join(w.govRoot, 'photo.png')
        writeFileSync(target, PNG_1X1)
        const c = chainCase(w.arm, w.ctx, 'img-can-1', 'photo.png', target)
        const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
        const ac = new AbortController()
        ac.abort()
        const ran = await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts, ac.signal)
        expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.CANCELLED)
        expect(w.port.counters.calls).toBe(0)
      } finally { await w.dispose() }
    }
    {
      const w = await armWorld({}, { hangUntilAbort: true })
      try {
        const target = join(w.govRoot, 'photo.png')
        writeFileSync(target, PNG_1X1)
        const c = chainCase(w.arm, w.ctx, 'img-can-2', 'photo.png', target)
        const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
        const ac = new AbortController()
        const running = w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts, ac.signal)
        await sleep(25)
        ac.abort()
        const ran = await running
        expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.CANCELLED)
        expect(w.adapter.stats().storeCalls).toBe(0)
      } finally { await w.dispose() }
    }
    {
      const controller = new AbortController()
      const w = await armWorld({}, { abortBeforeReturn: { controller } })
      try {
        const target = join(w.govRoot, 'photo.png')
        writeFileSync(target, PNG_1X1)
        const c = chainCase(w.arm, w.ctx, 'img-can-3', 'photo.png', target)
        const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
        const ran = await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts, controller.signal)
        expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.CANCELLED_BEFORE_COMMIT)
        expect(w.adapter.stats().storeCalls).toBe(0)
        expect(w.objects()).toBe(0)
      } finally { await w.dispose() }
    }
  }, 60_000)

  it('no ledger, by construction: replaying the same receipt double-calls the PORT (whose SEQUENTIAL consumed-view guard refuses the sequential replay — concurrency single flight is CENTER\'s execToken law, not claimed here) and the store commits once; the arm owns no WeakMap/stat/readFile/ticket face', async () => {
    const w = await armWorld({}, { oneShotGrants: true })
    try {
      const target = join(w.govRoot, 'photo.png')
      writeFileSync(target, PNG_1X1)
      const c = chainCase(w.arm, w.ctx, 'img-replay-1', 'photo.png', target)
      const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const first = await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(first.ok, first.detail).toBe(true)
      const second = await w.arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(second.code).toBe(A5_IMAGE_TYPED_CODES.PORT_REFUSAL)
      expect(second.portCode).toBe('grant-consumed')
      expect(w.objects()).toBe(1)
      // the rev-1 faces are GONE (structural witness on the runtime file)
      const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'image.mjs'), 'utf8')
      expect(src).not.toMatch(/WeakMap/)
      expect(src).not.toMatch(/readFile/)
      expect(src).not.toMatch(/from 'node:fs'/)
      expect(src).not.toMatch(/resolveAnchoredPath/)
      expect(Object.keys(w.arm)).not.toContain('prepare')
      expect(Object.keys(w.arm)).not.toContain('cancel')
    } finally { await w.dispose() }
  }, 30_000)

  it('ownership is NEVER content-addressed: two namespaces committing identical bytes get TWO independent entitlements over ONE store object (positive control), a foreign namespace never fetches (zero store calls, negative control), and the original owner keeps working after the second mint (no owner overwrite — the rev-1 defect)', async () => {
    const w = await armWorld()
    try {
      const nsA = { realmId: 'realm-x', teamSessionId: 'team-x', instanceId: 'inst-a' }
      const nsB = { realmId: 'realm-x', teamSessionId: 'team-x', instanceId: 'inst-b' }
      const nsC = { realmId: 'realm-x', teamSessionId: 'team-x', instanceId: 'inst-c' }
      const a = await w.adapter.commitImage({ bytes: PNG_1X1, mediaType: 'image/png', name: 'same.png', namespace: nsA })
      expect(w.objects()).toBe(1)
      const b = await w.adapter.commitImage({ bytes: PNG_1X1, mediaType: 'image/png', name: 'same.png', namespace: nsB })
      expect(b.attachmentId).toBe(a.attachmentId) // the store dedupes OBJECTS
      expect(w.objects()).toBe(1) // one object — a store FEATURE, not deduped ownership
      expect(w.adapter.stats().commits).toBe(2) // two independent entitlements
      // positive control: both owners fetch the shared object, byte-exact
      const ra = await w.adapter.referenceImage({ attachmentId: a.attachmentId, namespace: nsA })
      const rb = await w.adapter.referenceImage({ attachmentId: b.attachmentId, namespace: nsB })
      expect(ra.ok && rb.ok).toBe(true)
      expect(Buffer.compare(Buffer.from(ra.bytes as Uint8Array), Buffer.from(PNG_1X1))).toBe(0)
      // negative control: a third namespace never fetches through this face
      const storeCallsBefore = w.adapter.stats().storeCalls
      const rc = await w.adapter.referenceImage({ attachmentId: a.attachmentId, namespace: nsC })
      expect(rc.code).toBe(A5_IMAGE_ATTACHMENT_CODES.NAMESPACE_MISMATCH)
      expect(w.adapter.stats().storeCalls).toBe(storeCallsBefore) // ZERO store calls
      expect(w.adapter.stats().refusedForeignNamespace).toBe(1)
      const unknown = await w.adapter.referenceImage({ attachmentId: sha(Buffer.from('never-minted')), namespace: nsA })
      expect(unknown.code).toBe(A5_IMAGE_ATTACHMENT_CODES.UNKNOWN_ATTACHMENT)
      expect(w.adapter.stats().storeCalls).toBe(storeCallsBefore)
      // re-commit of the SAME (namespace, attachmentId): ONE fact, ONE
      // counter name (root ruling item 3): commits counts the attempt,
      // recommits counts the already-held entitlement — stats speaks the
      // same names the code increments (no `recomputes` ghost key).
      const commitsBefore = w.adapter.stats().commits
      await w.adapter.commitImage({ bytes: PNG_1X1, mediaType: 'image/png', name: 'same.png', namespace: nsA })
      const afterRe = w.adapter.stats()
      expect(afterRe.commits).toBe(commitsBefore + 1)
      expect(afterRe.recommits).toBe(1)
      expect(Object.keys(afterRe)).not.toContain('recomputes')
      expect(w.objects()).toBe(1)
    } finally { await w.dispose() }
    // reference verifies the COMMITTED NORMALIZED OBJECT ONLY (root ruling
    // item 3): a store answering different bytes on re-read is drift —
    // refused, never served. (The lying port below is a contract probe of
    // THIS ADAPTER's verification law; the real store's integrity is the
    // store's own leg.)
    {
      const driftAdapter = createImageAttachmentAdapter({ store: {
        saveImage: async (input) => ({ attachmentId: `sha256:${sha(input.data)}`, mediaType: input.mediaType, bytes: input.data.byteLength }),
        readImage: async () => ({ data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }),
        imageLimits: { maxImageBytes: 1 << 20, maxMessageImageBytes: 1 << 20 },
      } })
      const committed = await driftAdapter.commitImage({ bytes: PNG_1X1, mediaType: 'image/png', name: 'x.png', namespace: { realmId: 'realm-d', teamSessionId: 'team-d', instanceId: 'inst-d' } })
      const drift = await driftAdapter.referenceImage({ attachmentId: committed.attachmentId, namespace: { realmId: 'realm-d', teamSessionId: 'team-d', instanceId: 'inst-d' } })
      expect(drift.code).toBe(A5_IMAGE_ATTACHMENT_CODES.COMMIT_DRIFT)
      expect(drift.bytes).toBeUndefined() // never served
    }
  })

  it('the store owns the image law and the boundary law: a dimension-capped deployment refuses PRE-WRITE (store law code, no sideEffectPossible); a codeless throw is an UNRESOLVED boundary (sideEffectPossible stays true, never downgraded, nothing deleted)', async () => {
    {
      const w = await armWorld({ maxImageDimension: 2 })
      try {
        const target = join(w.govRoot, 'three.png')
        writeFileSync(target, PNG_3X3)
        const c = chainCase(w.arm, w.ctx, 'img-law-1', 'three.png', target)
        const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
        const ran = await w.arm.execute({ file_path: 'three.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
        expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.STORE_LAW_REFUSED)
        // pin639 measured arm text (the dimension law, verbatim)
        expect(ran.detail).toContain('Image exceeds the configured per-side pixel limit.')
        expect(ran.sideEffectPossible).toBeUndefined() // deterministic pre-write refusal
        expect(w.objects()).toBe(0)
      } finally { await w.dispose() }
    }
    {
      // dying store mid-commit: the boundary is UNRESOLVED — sideEffectPossible
      const dir = worldDir('dying')
      const cordisMod = await import(pathToFileURL(CORDIS_LIB).href)
      const attachmentLocalMod = await import(hostLib('attachment/attachment-local'))
      const ctx: LooseCtx = new cordisMod.Context()
      const fiber = await ctx.plugin(attachmentLocalMod.default, { dshHome: join(dir, 'home') })
      const svc = ctx.get('attachments')
      if (svc === undefined) throw new Error('store did not mount')
      const adapter = createImageAttachmentAdapter({
        store: {
          saveImage: async () => { const e = new Error('store volume vanished mid-write') as Error & { code?: string }; e.code = 'ATTACHMENT_WRITE_FAILED'; throw e },
          readImage: asStorePort(svc).readImage,
          imageLimits: asStorePort(svc).imageLimits,
        },
      })
      const port = makePort({})
      // direct arm against the dying adapter (the boundary law is the arm's)
      const realm = makeAssembly()
      const govRoot = join(dir, 'gov')
      mkdirSync(govRoot, { recursive: true })
      writeFileSync(join(govRoot, 'photo.png'), PNG_1X1)
      const arm = createGovernedReadImageArm({ definitionIdentity: ARM_DEFINITION, providerId: ARM_PROVIDER, realmId: realm.realm, namespaceRoot: govRoot, readBounded: port.port, attachments: adapter })
      const c = chainCase(arm, realm, 'img-dying-1', 'photo.png', join(govRoot, 'photo.png'))
      const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
      const ran = await arm.execute({ file_path: 'photo.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.STORE_UNAVAILABLE)
      expect(ran.sideEffectPossible).toBe(true) // never downgraded
      await fiber.dispose?.()
      await ctx.dispose?.()
    }
    {
      // normalize attempt at THIS checkout (no sharp): the store's probe
      // refuses a metadata-bearing PNG pre-write — the lane records exactly
      // what the real store answers and pins the arm's law-code split. The
      // true source≠normalized divergence is NOT_VERIFIED at this lane.
      const crcTable: number[] = []
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0 } // table built fully before use
      const crc32 = (b: Uint8Array): number => { let c = 0xFFFFFFFF; for (const x of b) c = (crcTable[(c ^ x) & 0xFF] ?? 0) ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
      const type = Buffer.from('tEXt')
      const data = Buffer.concat([Buffer.from('Comment'), Buffer.from([0]), Buffer.from('m2-readimg-normalize-attempt')])
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
      const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([type, data])))
      const iend = PNG_1X1.subarray(PNG_1X1.length - 12)
      const metaPng = Buffer.concat([PNG_1X1.subarray(0, 8), len, type, data, crcBuf, iend])
      const w = await armWorld()
      try {
        const target = join(w.govRoot, 'meta.png')
        writeFileSync(target, metaPng)
        const c = chainCase(w.arm, w.ctx, 'img-norm-1', 'meta.png', target)
        const receipt = await approve(c) as Extract<PaControlLegResult, { decision: 'approve' }>
        const ran = await w.arm.execute({ file_path: 'meta.png' }, receipt as unknown as ImageConsumptionReceipt, c.callFacts)
        // measured at this checkout: probe refuses non-pass-through inputs
        // INVALID_IMAGE pre-write → deterministic law refusal, zero objects.
        expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.STORE_LAW_REFUSED)
        expect(ran.detail).toContain('INVALID_IMAGE')
        expect(w.objects()).toBe(0)
      } finally { await w.dispose() }
    }
  }, 60_000)

  it('classify stays PURE-LEXICAL (root ruling: 审批前一律纯 lexical): closed argument root, traversal refuses before any fs act, undeclared media refuses, and the frozen I+F effect set parses through the domain itself', async () => {
    const w = await armWorld()
    try {
      expect(refusedClassify(w.arm.classify({ file_path: 'photo.png', offset: 1 })).code).toBe(A5_IMAGE_TYPED_CODES.UNKNOWN_PARAMETER)
      const escape = refusedClassify(w.arm.classify({ file_path: '../../outside/secret.png' }))
      expect(escape.code).toBe(A5_IMAGE_TYPED_CODES.TARGET_OUTSIDE_GOVERNED_ROOT)
      expect(String(escape.detail)).toContain('BEFORE any filesystem call')
      expect(refusedClassify(w.arm.classify({ file_path: 'README' })).code).toBe(A5_IMAGE_TYPED_CODES.UNDECLARED_MEDIA_TYPE)
      expect(refusedClassify(w.arm.classify({ file_path: 'notes.txt' })).code).toBe(A5_IMAGE_TYPED_CODES.UNDECLARED_MEDIA_TYPE)
      const good = w.arm.classify({ file_path: 'photo.png' })
      if (good.ok !== true) throw new Error('fixture classify failed')
      const parsed = parseRequestedEffectSet((good.effects as { effects: unknown[] }).effects ?? good.effects)
      expect(parsed.ok).toBe(true)
      expect(JSON.parse(JSON.stringify((good.effects as { effects: unknown[] }).effects ?? good.effects))).toEqual([
        { kind: 'tool-invoke', toolName: 'read_image', resource: null },
        { kind: 'read', resource: { realmId: w.ctx.realm, kind: 'absolute-path', canonicalLocator: join(w.govRoot, 'photo.png'), rights: ['read'] } },
      ])
      expect(w.port.counters.calls).toBe(0)
    } finally { await w.dispose() }
  })

  it('DRAINING is terminal and faceless: after drain every stage refuses typed and the handle exposes no native/fallback/delegate face', async () => {
    const w = await armWorld()
    try {
      w.arm.drain()
      const r = w.arm.classify({ file_path: 'photo.png' })
      expect(r.ok).toBe(false)
      expect('code' in r && r.code).toBe(A5_IMAGE_TYPED_CODES.DRAINING)
      const keys = Object.keys(w.arm).join(',').toLowerCase()
      expect(keys).not.toMatch(/native|fallback|delegate|prepare|cancel/)
      // THE REFERENCE LEG IS A BACKEND CALL TOO (root ruling item 3): after
      // drain it refuses typed with zero store calls.
      const ns = { realmId: 'r', teamSessionId: 't', instanceId: 'i' }
      const refRefused = await w.arm.reference('sha256:anything', ns)
      expect(refRefused.code).toBe(A5_IMAGE_TYPED_CODES.DRAINING)
      expect(w.adapter.stats().storeCalls).toBe(0)
    } finally { await w.dispose() }
    // and a pre-aborted signal refuses the reference leg before any call
    {
      const w2 = await armWorld()
      try {
        const ac = new AbortController()
        ac.abort()
        const refCancelled = await w2.arm.reference('sha256:anything', { realmId: 'r', teamSessionId: 't', instanceId: 'i' }, ac.signal)
        expect(refCancelled.code).toBe(A5_IMAGE_TYPED_CODES.CANCELLED)
        expect(w2.adapter.stats().storeCalls).toBe(0)
      } finally { await w2.dispose() }
    }
  })

  it('assembly fails closed: no port, no arm; no store, no arm (缺 store 只算条件不可用 — never a fallback face, never a half-wired mount)', () => {
    const port = makePort({}).port
    expect(() => createGovernedReadImageArm({ definitionIdentity: 'd', providerId: 'p', realmId: 'r', namespaceRoot: '/tmp', readBounded: undefined as unknown as ImageReadBoundedPort, attachments: createImageAttachmentAdapter({ store: { saveImage: async () => ({}), readImage: async () => new Uint8Array(), imageLimits: { maxImageBytes: 1, maxMessageImageBytes: 1 } } }) })).toThrow(TypeError)
    expect(() => createGovernedReadImageArm({ definitionIdentity: 'd', providerId: 'p', realmId: 'r', namespaceRoot: '/tmp', readBounded: port, attachments: undefined as never })).toThrow(TypeError)
  })

  it('row-7 contrast — pre-fix repro vs post-fix typed refusal: the UNTOUCHED native face reads an out-of-root absolute image SUCCESSFULLY (the measured primary gap, alive at pin639), while the governed arm refuses the SAME absolute target with zero port calls', async () => {
    const w = await armWorld()
    let native: NativeWorld | null = null
    try {
      const victim = join(w.outsideDir, 'outside-secret.png')
      writeFileSync(victim, PNG_1X1)
      native = await nativeWorld(w.govRoot)
      const nativeRun = await native.readAbs(victim)
      // THE PRE-FIX FACT (reproduced green on the untouched host face):
      expect(nativeRun.isError).toBe(false)
      expect(nativeRun.text).toContain('<type>image</type>')
      // POST-FIX, same absolute target, governed arm: pure-lexical refusal.
      const escaped = w.arm.classify({ file_path: victim })
      expect(escaped.ok).toBe(false)
      expect('code' in escaped && escaped.code).toBe(A5_IMAGE_TYPED_CODES.TARGET_OUTSIDE_GOVERNED_ROOT)
      expect(w.port.counters.calls).toBe(0)
      expect(w.adapter.stats().storeCalls).toBe(0)
    } finally {
      if (native !== null) await native.dispose()
      await w.dispose()
    }
  }, 60_000)
})
