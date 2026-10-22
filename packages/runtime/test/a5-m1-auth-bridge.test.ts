/**
 * a5m1-auth-bridge — the M1 AUTH leg: the FROZEN-A PA ⇄ Control bridge
 * (`operation-permission/pa-control-bridge.ts`) driven over the REAL durable
 * control plane (packages/runtime/control — real ControlService, real
 * TeamDomain ledger rows; NO mocked service anywhere: the pass-through
 * wrappers only INTERLEAVE real service calls or drive real seams; the one
 * explicitly-FORGED verdict (C4) is named as such and never reached the
 * real service).
 *
 * PR358 review fix (root-approved 5-set, AUTH item 1 + item 4) — the added
 * laws this suite pins, on top of the original frozen-A obligations:
 *  - the durable row carries the COMPLETE strict PA operation manifest
 *    (approvalCaseId + authorityScope + the binding/member/request facts
 *    field by field); the SERVICE RECOMPUTES the canonical digest and binds
 *    it to BOTH `reviewPayloadDigest` and `operationFingerprint` — the row
 *    identity is the PAYLOAD-INTEGRITY digest while the PARAMETER
 *    fingerprint rides the manifest as an independent execution-side field
 *    (C1 pins every refusal direction — missing digest, digest drift,
 *    fingerprint≠digest, an incomplete manifest — each with ZERO rows);
 *  - resolve and guard answer the SAME all-Effects verification inside the
 *    same per-team lock: one effect's ceiling drifting makes BOTH refuse —
 *    the resolve gate denies durably (`pa-authority-drift`, A5/C2), the
 *    guard gate blocks with ZERO consumption and does NOT burn the allow
 *    (C3), and the bridge's own rung layer is the first-line catch when the
 *    drift rides the leg (A5b);
 *  - no verifier facts = no coverage: the verify port answers a manifest
 *    row it cannot verify as `authority-undetermined` — never a pre-submit
 *    green light;
 *  - a guard verdict must PAIR to its row (requestId + decisionSequence):
 *    a foreign pairing denies with zero consumption (C4);
 *  - parameter-level cancellation (item 4): a cancel after the decision
 *    settles `unsettled` with ZERO mint; a cancel between mint and durable
 *    guard denies with the grant NOT handed back (zero PA consumption,
 *    zero body); a consumption that DID happen is retained forever — never
 *    reclaimed, never later reported as unconsumed (C5 + A1);
 *  - PR358 f5 (root ruling, AUTH short delta): the durable READ-BACK is a
 *    TRICHOTOMY (`paManifestClassOf`, control/types.ts): old-world rows
 *    (no marker, no digest binding) skip both gates byte-identically
 *    (compat, never called PA coverage); valid rows ride the verifier;
 *    THIS-CLASS damaged rows — marker present but the strict parse fails,
 *    OR the PA digest binding (operationFingerprint ≡ a present
 *    reviewPayloadDigest) surviving a stripped/moved marker — NEVER
 *    re-read as legacy: resolve commits a durable DENY and guard blocks
 *    with ZERO consumption, both `authority-undetermined`, with or
 *    without an injected verifier (describe D);
 *  - PR358 f5: `createPaGuardVerifyPort` is NON-PRODUCTION — a test-only
 *    thin mirror with the SAME verifier REQUIRED and the class call
 *    DELEGATED to the service's classifier; production's one entry is the
 *    root injecting the one verifier into `createControlService`
 *
 * Original frozen-A acceptance (all still here): durable row + verbatim
 * manifest + real resolve/approve/deny/unsettled, REUSE under one scope key
 * (no second row, no second spend), the guard-refusal last-mile deny with
 * the grant withheld, the double-mint refusal on a repeat, the no-row
 * refuse, the pure verify port, and the plane-integration legs (one real
 * landlock team_bash body behind one durable approval; a denied run
 * zero-body; one governed read body).
 *
 * World: `tests/homes/a5m1-auth-<ts>` (TEST_METHODS §7 temporary world,
 * workspace-internal, destroyed in `afterAll`).
 *
 * @module @dsh-agent-team/runtime/test/a5-m1-auth-bridge
 */
import { describe, it, expect, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
import {
  canonicalJsonFingerprint,
  parseRequestedEffectSet,
  parseToolBinding,
} from '../../domain/tool-governance/src/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import {
  CONTROL_GUARD_BLOCK_REASONS,
  ControlError,
  createControlService,
} from '../control/index.js'
import { PA_CONTROL_MANIFEST_SCHEMA, paManifestClassOf, parsePaControlManifest } from '../control/types.js'
import type {
  ControlDecisionRecord,
  ControlRequestRecord,
  ControlService,
  ControlWaitSignal,
} from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import { authorityRank } from '../governance/authority-ceiling.js'
import type { AuthorityDocumentSlot, AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { ControlCallerRef, PaCallFactsCeilingSlot } from '../control/types.js'
import type { RuntimeAuthority } from '../governance/runtime-authority.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import { createProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { EffectSetApprovalPlan } from '../tool-admission/approval-case.js'
import {
  PA_CONTROL_ACTION_NAME,
  createPaControlLeg,
  createPaEffectsVerifier,
  createPaGuardVerifyPort,
  paCorrelation,
} from '../operation-permission/pa-control-bridge.js'
import type {
  PaControlBridgeDeps,
  PaControlLegInput,
  PaControlLegResult,
  PaControlServiceLike,
  PaEffectsVerifierDeps,
} from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  humanCaller,
  leaderCaller,
  memberCaller,
  p6t4Seed,
} from './p6t4-helpers.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5m1-auth-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')

// ── the real durable world (real TeamDomain + real ControlService) ──────
mkdirSync(ROOT_DIR, { recursive: true })
mkdirSync(OUTSIDE_DIR, { recursive: true })
writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')

const seam = new FileStorageSeam(WORLD)
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
await repos.sessionBindings.put({
  kind: 'team-root',
  schemaVersion: 1,
  sessionId: P6T1_FIXTURE.rootSessionId,
})
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

// PR358-B (CCR-358a): the fake CALL-LEVEL FACTS adapter — the test-side
// shape of the CENTER's `readCallFacts` (the B dependency table). Every
// member is a REAL read in this world: the realm's live documents holder
// (the SAME live closure the assembly reads — drift flips flip both sides
// of the plane), the assembly's own policy / deny-source projections, the
// mount plane's LIVE plan for this call (planSnapshot), the binding and
// effect set re-canonicalized through the domain's OWN parsers, and the
// DURABLE member attribution from the real repository — never the manifest
// self-report. No realm answer, a refused round trip, an unattributed
// member, or a poisoned seam ⇒ `undefined` (never a partial table) ⇒ the
// gate answers `authority-undetermined`. The trusted beneficiary is the
// fixture's durable attribution: every mount here belongs to a member.
interface RealmTruth {
  readonly assembly: ProductionAdmissionAssembly
  readonly documents: () => AuthorityEnvelopeDocuments
  generation: number
  throwFacts?: boolean
  bindingRevisionBump?: number
}
/** Fold one ceiling-module slot into the FACTS contract: a document, a
 *  `declared` document, or a stated absence. `unavailable` does NOT fold —
 *  the caller turns that into undefined FACTS (undetermined), never into
 *  a slot value the verifier would have to interpret. */
function factSlot(slot: AuthorityDocumentSlot): PaCallFactsCeilingSlot | undefined {
  if (typeof slot !== 'object') return undefined
  if (!('status' in slot)) return slot
  if (slot.status === 'unavailable') return undefined
  return slot
}
const realmTruths = new Map<string, RealmTruth>()
// Named (not inlined) so the injection-seam pin (E4) can mint REAL facts
// for its `input.facts` attempts — the very same fake the main verifier
// rides, so the sealed/opened contrast isolates ONLY the flag.
const fakeReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
    const truth = realmTruths.get(input.manifest.realmId)
    if (truth === undefined) return undefined
    if (truth.throwFacts === true) throw new Error('the call-level facts adapter exploded (test seam)')
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
      requestedEffects: effects.value,
    })
    const livePlan = truth.assembly.planApproval(request)
    if (!livePlan.ok) return undefined
    // `unavailable` is NOT carried into the facts contract: a slot whose
    // read faulted answers UNDEFINED facts (fail closed at the gate) —
    // never a slot value the verifier would have to interpret. (The
    // CENTER's adapter rides the same law; this fake demonstrates it.)
    const ceiling = truth.documents()
    const hard = factSlot(ceiling.teamHardEnvelope)
    const mutation = factSlot(ceiling.permissionMutationEnvelope)
    if (hard === undefined || mutation === undefined) return undefined
    return {
      // the fixture's static layer + the durable overlay store (EMPTY for
      // every realm here — the stated real state, never a synthesized gen).
      policySource: { staticLayerRefs: ['a5m1-auth-tpl:directive-policy'], overlayGeneration: 0 },
      realmId: manifest.realmId,
      ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
      policyDocument: truth.assembly.policyDocument(),
      denySources: truth.assembly.denySources(),
      effects: effects.value,
      member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
      beneficiaryAuthority: 'member',
      binding: truth.bindingRevisionBump === undefined
        ? binding.value
        : { ...binding.value, revision: truth.bindingRevisionBump },
      blueprint: {
        revision: Number(blueprint.revision),
        contentHash: String(blueprint.contentHash),
        templateId: String(durable.templateId),
        cwd: ROOT_DIR,
        providerVersion: 'a5p5-plane',
      },
      planSnapshot: {
        approvalCaseId: livePlan.value.approvalCaseId,
        effectSetFingerprint: livePlan.value.effectSetFingerprint,
        perEffectRequired: livePlan.value.perEffectRequired,
      },
      authorityGeneration: truth.generation,
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

const WORKER = P6T4_SEEDS.worker.instanceId
const SCRIBE = P6T4_SEEDS.scribe.instanceId

afterAll(async () => {
  await domain.close()
  rmSync(WORLD, { recursive: true, force: true })
})

// ── helpers ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function state() {
  return service.listControlState(P6T4_ROOT)
}

async function waitRow(
  isNew: (row: ControlRequestRecord) => boolean,
  timeoutMs = 20_000,
): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = (await state()).requests.find(isNew)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error('the durable control row never appeared')
    await sleep(25)
  }
}

async function resolve(
  caller: ActionCaller,
  requestId: string,
  decision: 'allow' | 'deny',
): Promise<ControlDecisionRecord> {
  return service.resolveControl({ rootSessionId: P6T4_ROOT, caller, requestId, decision })
}

function makeLeg(extra: Partial<PaControlBridgeDeps> = {}) {
  return createPaControlLeg({
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    beneficiaryAuthority: 'member',
    ...extra,
  })
}

const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})

/** A ceiling flip for ONE approval scope: `'tool-invoke|<realm>|tool:x'`
 *  or `'read|<realm>|<locator>'` (the effectApprovalScope vocabularies). */
function narrowDocs(scopedResource: string): AuthorityEnvelopeDocuments {
  const cut = scopedResource.indexOf('|')
  return {
    teamHardEnvelope: {
      rules: [{
        operationClass: scopedResource.slice(0, cut),
        matcher: { kind: 'exact' as const, resource: scopedResource.slice(cut + 1) },
        maximumEffect: 'ask' as const,
      }],
    },
    permissionMutationEnvelope: { status: 'absent' as const },
  }
}

let realmSeq = 0

/** Each fixture assembly gets its OWN realm (the verifier re-derives per
 *  realm; unique realms keep every describe fully independent). */
function directAssembly(
  documents?: () => AuthorityEnvelopeDocuments,
  realm?: string,
): { assembly: ProductionAdmissionAssembly; realm: string } {
  const realmId = realm ?? `a5m1-auth-r-${String(realmSeq++)}`
  const built = createProductionAdmissionAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m1-auth-tpl',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => Date.now(),
    authorityGeneration: () => 0,
    beneficiaryAuthority: 'member',
    ...(documents === undefined ? {} : { documents }),
    onObserve: () => {},
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.error.message}`)
  realmTruths.set(realmId, {
    assembly: built.value,
    documents: documents ?? ((): AuthorityEnvelopeDocuments => EMPTY_DOCS),
    generation: 0,
  })
  return { assembly: built.value, realm: realmId }
}

interface DirectFixture {
  readonly input: PaControlLegInput
  readonly plan: EffectSetApprovalPlan
  readonly correlation: string
}

function directFixture(
  ctx: { assembly: ProductionAdmissionAssembly; realm: string },
  callId: string,
  callerInstance = WORKER,
  effectsClaim?: unknown,
): DirectFixture {
  const bindingParsed = parseToolBinding({
    bindingId: `auth-row:${callId}`,
    agentScopeKey: `auth:${callId}`,
    toolName: 'team_bash',
    definitionIdentity: `auth:${callId}:team_bash`,
    providerId: 'a5p5-plane',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'confined-subprocess',
    assurance: untestedAssurance('team-trusted-extension', 'confined-subprocess', ctx.realm),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  })
  if (!bindingParsed.ok) throw new Error(`binding refused: ${JSON.stringify(bindingParsed.problems)}`)
  const effectsParsed = parseRequestedEffectSet(effectsClaim ?? [
    { kind: 'tool-invoke', toolName: 'team_bash', resource: null },
  ])
  if (!effectsParsed.ok) throw new Error(`effects refused: ${JSON.stringify(effectsParsed.problems)}`)
  const member = Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: callerInstance })
  const request: AdmissionRequest = Object.freeze({
    binding: bindingParsed.value,
    member,
    callId,
    realmId: ctx.realm,
    parametersFingerprint: canonicalJsonFingerprint({ command: `auth-${callId}` }),
    requestedEffects: effectsParsed.value as RequestedEffectSet,
  })
  const planned = ctx.assembly.planApproval(request)
  if (!planned.ok) throw new Error(`plan refused: ${planned.error.message}`)
  return {
    input: Object.freeze({ realmId: ctx.realm, member, callId, request, plan: planned.value, assembly: ctx.assembly }),
    plan: planned.value,
    correlation: paCorrelation(planned.value.approvalCaseId, callId),
  }
}

/** The exact manifest BYTES the bridge puts on the row (mirrored here for
 *  the service-boundary tests — C1/C3 forge on top of these). */
function manifestBytes(fixture: DirectFixture): Record<string, unknown> {
  const req = fixture.input.request
  const plan = fixture.plan
  const toolEffect = (req.requestedEffects as RequestedEffectSet).effects.find((e) => e.kind === 'tool-invoke')
  return JSON.parse(JSON.stringify({
    schema: PA_CONTROL_MANIFEST_SCHEMA,
    approvalCaseId: plan.approvalCaseId,
    authorityScope: {
      operationClass: 'tool-invoke',
      matcher: { kind: 'exact', resource: `${fixture.input.realmId}|tool:${String(toolEffect?.toolName ?? 'team_bash')}` },
    },
    requiredAuthority: plan.requiredAuthority,
    perEffectRequired: plan.perEffectRequired,
    deniedEffects: plan.deniedEffects,
    effectSetFingerprint: plan.effectSetFingerprint,
    authorityGeneration: plan.authorityGeneration,
    realmId: fixture.input.realmId,
    callId: req.callId,
    parametersFingerprint: req.parametersFingerprint,
    effects: (req.requestedEffects as RequestedEffectSet).effects,
    binding: req.binding,
    member: { teamSessionId: fixture.input.member.teamSessionId, instanceId: fixture.input.member.instanceId },
  })) as Record<string, unknown>
}

const manifestOf = (row: ControlRequestRecord): Record<string, unknown> =>
  row.reviewPayload as Record<string, unknown>

function probeFor(fixture: DirectFixture, row: ControlRequestRecord, parametersFingerprint?: string) {
  return {
    targetInstanceId: WORKER,
    actionName: PA_CONTROL_ACTION_NAME,
    toolName: 'team_bash',
    correlation: fixture.correlation,
    // A5-M1: the row identity is the PAYLOAD-INTEGRITY digest — the probe
    // addresses the row by it; the parameter fingerprint rides separately.
    operationFingerprint: String(row.operationFingerprint ?? row.reviewPayloadDigest),
    ...(parametersFingerprint === undefined ? {} : { parametersFingerprint }),
  }
}

function verifyPort() {
  return createPaGuardVerifyPort({
    controlService: service,
    rootSessionId: P6T4_ROOT,
    verifier: paVerifier,
  })
}

const asSignal = (controller: AbortController): ControlWaitSignal =>
  controller.signal as unknown as ControlWaitSignal

// ── A. the bridge over the real durable control plane (direct drive) ────

describe('A1 (positive leg + reuse): durable row → verified real allow → minted+guard-consumed grant', () => {
  const ctx = directAssembly()
  const fixture = directFixture(ctx, 'a1-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult
  let resB: PaControlLegResult

  it('creates ONE durable row for the PA case, carrying the COMPLETE strict manifest, identity-bound to the service-recomputed digest', async () => {
    expect(fixture.plan.requiredAuthority).toBe('leader')
    const leg = makeLeg()
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    expect(rowA.kind).toBe('leader-approval')
    expect(rowA.targetInstanceId).toBe(WORKER)
    expect(rowA.status).toBe('pending')
    const digest = canonicalJsonFingerprint(manifestBytes(fixture))
    // identity law: operationFingerprint === reviewPayloadDigest === the
    // service-recomputed digest of the payload bytes; the parameters
    // fingerprint is a SEPARATE manifest field.
    expect(rowA.reviewPayloadDigest).toBe(digest)
    expect(rowA.operationFingerprint).toBe(digest)
    const manifest = manifestOf(rowA)
    expect(manifest.schema).toBe(PA_CONTROL_MANIFEST_SCHEMA)
    expect(manifest.approvalCaseId).toBe(fixture.plan.approvalCaseId)
    expect(manifest.authorityScope).toEqual({
      operationClass: 'tool-invoke',
      matcher: { kind: 'exact', resource: `${fixture.input.realmId}|tool:team_bash` },
    })
    expect(manifest.requiredAuthority).toBe('leader')
    expect(manifest.effectSetFingerprint).toBe(fixture.plan.effectSetFingerprint)
    expect(manifest.authorityGeneration).toBe(0)
    expect(manifest.deniedEffects).toEqual([])
    expect(manifest.perEffectRequired).toEqual(['leader'])
    expect((manifest.effects as unknown[]).length).toBe(1)
    expect(manifest.parametersFingerprint).toBe(fixture.input.request.parametersFingerprint)
    // binding/member snapshots, field by field
    const binding = manifest.binding as Record<string, unknown>
    expect(binding.bindingId).toBe(fixture.input.request.binding.bindingId)
    expect(binding.definitionIdentity).toBe(fixture.input.request.binding.definitionIdentity)
    expect(typeof binding.assurance).toBe('object')
    expect(manifest.member).toEqual({ teamSessionId: P6T4_ROOT, instanceId: WORKER })
    // the strict parser (the service's own re-read) accepts the row bytes
    expect(parsePaControlManifest(rowA.reviewPayload)).not.toBeUndefined()
    await resolve(humanCaller(), rowA.requestId, 'allow')
    resA = await pending
  })

  it('returns the full frozen-A success shape (approval from REAL decider, grant minted + guard-consumed)', async () => {
    expect(resA.decision).toBe('approve')
    if (resA.decision !== 'approve') return
    expect(resA.requestId).toBe(rowA.requestId)
    expect(resA.approval.approvalCaseId).toBe(fixture.plan.approvalCaseId)
    expect(resA.approval.reviewerAuthority).toBe('human-user') // the REAL decider's rung
    expect(resA.approval.beneficiaryAuthority).toBe('member')
    expect(resA.approval.requiredAuthorityAtCreation).toBe('leader')
    expect(resA.approval.effectSetFingerprint).toBe(fixture.plan.effectSetFingerprint)
    expect(resA.approval.authorityGenerationAtCreation).toBe(0)
    expect(resA.approval.deniedEffectsAtCreation).toEqual([])
    expect(typeof resA.grant.grantId).toBe('string')
    expect(resA.grant.singleUse).toBe(true)
    const st = await state()
    expect(st.requests.filter((r) => r.correlation === fixture.correlation).length).toBe(1)
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(1)
    // the durable allow carried NO special reason (the verifier COVERED)
    const decision = st.decisions.find((d) => d.requestId === rowA.requestId)
    expect(decision?.reason).toBeUndefined()
    // ROOT 9e carriage pin: the approve leg hands back the DURABLE mint's
    // manifest, identical to the row it rode (strict re-parse of the row
    // bytes) and value-bound to the row's digest pairing — the plane's
    // final edge re-reads THIS call's level facts against exactly these.
    const durableRow = st.requests.find((r) => r.correlation === fixture.correlation)
    expect(resA.manifest).not.toBeUndefined()
    const carried = resA.manifest as NonNullable<typeof resA.manifest>
    expect(canonicalJsonFingerprint(durableRow?.reviewPayload)).toBe(durableRow?.reviewPayloadDigest)
    expect(durableRow?.operationFingerprint).toBe(durableRow?.reviewPayloadDigest)
    expect(carried).toEqual(parsePaControlManifest(durableRow?.reviewPayload))
  })

  it('REUSES the same requestId on a repeat of the same invocation (no second row, no second spend)', async () => {
    resB = await makeLeg()(fixture.input)
    expect(resB.requestId).toBe(rowA.requestId)
    // The allow is already guard-consumed; the repeat lands on the PA
    // double-mint refusal (same callId → same grantId) — deny, no grant.
    expect(resB.decision).toBe('deny')
    const st = await state()
    expect(st.requests.filter((r) => r.correlation === fixture.correlation).length).toBe(1)
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(1)
  })

  it('the verify port mirrors the SPENT allow (consumption outranks verification) and never touches the ledger', async () => {
    const port = verifyPort()
    const probe = probeFor(fixture, rowA, fixture.input.request.parametersFingerprint)
    const v1 = await port.verify(probe)
    const v2 = await port.verify(probe)
    expect(v1.allowed).toBe(false)
    if (v1.allowed === false) expect(v1.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(v2).toEqual(v1)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(1)
  })
})

describe('A2 (deny leg): a durable deny denies with zero consumption and zero grant', () => {
  const ctx = directAssembly()
  const fixture = directFixture(ctx, 'a2-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('the LEADER denies a leader-approval ask; the leg returns deny, nothing lands', async () => {
    const leg = makeLeg()
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    await resolve(leaderCaller(), rowA.requestId, 'deny')
    resA = await pending
    expect(resA.decision).toBe('deny')
    expect(resA.requestId).toBe(rowA.requestId)
    expect((resA as { grant?: unknown }).grant).toBeUndefined()
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    const v = await verifyPort().verify(probeFor(fixture, rowA, fixture.input.request.parametersFingerprint))
    expect(v.allowed).toBe(false)
    if (v.allowed === false) expect(v.reason).toBe('decision-deny')
  })
})

describe('A3 (unsettled leg + verified positive): an expired wait never decides, never mints', () => {
  const ctx = directAssembly()
  const fixture = directFixture(ctx, 'a3-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('a bounded wait that expires settles `unsettled` with the row still pending (zero decision, zero mint)', async () => {
    const leg = makeLeg({ waitTimeoutMs: 40 })
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    resA = await pending
    expect(resA.decision).toBe('unsettled')
    expect(resA.requestId).toBe(rowA.requestId)
    expect((resA as { grant?: unknown }).grant).toBeUndefined()
    const st = await state()
    expect(st.requests.filter((r) => r.correlation === fixture.correlation).length).toBe(1)
    expect(st.decisions.filter((d) => d.requestId === rowA.requestId).length).toBe(0)
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    expect((await state()).requests.find((r) => r.requestId === rowA.requestId)?.status).toBe('pending')
  })

  it('a pre-aborted signal still leaves the durable row (resolvable later) and answers unsettled', async () => {
    const aborted = new AbortController()
    aborted.abort()
    const fixtureB = directFixture(ctx, 'a3b-call')
    const leg = makeLeg({ signal: () => asSignal(aborted) })
    const resB = await leg(fixtureB.input)
    expect(resB.decision).toBe('unsettled')
    expect(typeof resB.requestId).toBe('string')
    const st = await state()
    expect(st.requests.filter((r) => r.correlation === fixtureB.correlation).length).toBe(1)
  })

  it('the VERIFIED port answers the UNCONSUMED allow WITHOUT consuming (two calls, zero side effects)', async () => {
    const decisionRecord = await resolve(leaderCaller(), rowA.requestId, 'allow')
    expect(decisionRecord.decision).toBe('allow') // covered: the resolve gate let it through
    const port = verifyPort()
    const probe = probeFor(fixture, rowA, fixture.input.request.parametersFingerprint)
    const v1 = await port.verify(probe)
    const v2 = await port.verify(probe)
    expect(v1.allowed).toBe(true)
    if (!v1.allowed) return
    expect(v1.requestId).toBe(rowA.requestId)
    expect(v1.decisionSequence).toBeGreaterThan(0)
    expect(v2).toEqual(v1)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    // the parameter fact is bound too: a probe with foreign parameters is
    // a different invocation, never a mirror hit.
    const foreign = await port.verify(probeFor(fixture, rowA, canonicalJsonFingerprint({ command: 'not-this-call' })))
    expect(foreign.allowed).toBe(false)
    if (foreign.allowed === false) expect(foreign.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH)
  })
})

describe('A4 (guard-refusal leg): the consumed allow cannot be spent twice — the grant is not returned', () => {
  const ctx = directAssembly()
  const fixture = directFixture(ctx, 'a4-call')
  let resA: PaControlLegResult
  let rowA: ControlRequestRecord

  it('a competing real guardOperation consumption makes the bridge deny; zero grant leaks back', async () => {
    // The wrapper is a pure pass-through to the REAL service; the hook only
    // INTERLEAVES another REAL guardOperation at the decision point
    // (deterministic race: the allow gets consumed before the bridge
    // arrives). No fake authority exists anywhere on this path.
    let armed = true
    const hooked: PaControlServiceLike = {
      requestControl: (a) => service.requestControl(a),
      awaitControlDecision: async (i) => {
        const d = await service.awaitControlDecision(i)
        if (armed) {
          armed = false
          const st = await service.listControlState(P6T4_ROOT)
          const row = st.requests.find((r) => r.correlation === fixture.correlation)
          if (row === undefined) throw new Error('fixture: the durable row vanished')
          const verdict = await service.guardOperation({
            rootSessionId: P6T4_ROOT,
            targetInstanceId: WORKER,
            actionName: PA_CONTROL_ACTION_NAME,
            toolName: 'team_bash',
            correlation: fixture.correlation,
            operationFingerprint: row.operationFingerprint,
          })
          if (!verdict.allowed) throw new Error(`fixture pre-consumption failed: ${verdict.reason}`)
        }
        return d
      },
      guardOperation: (s) => service.guardOperation(s),
      listControlState: (r) => service.listControlState(r),
    }
    const leg = createPaControlLeg({
      controlService: hooked,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
    })
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    resA = await pending
    expect(resA.decision).toBe('deny')
    expect(resA.requestId).toBe(rowA.requestId)
    if (resA.decision === 'deny') expect(String(resA.detail)).toMatch(/last-mile guard blocked/)
    expect((resA as { grant?: unknown }).grant).toBeUndefined()
    const st = await state()
    // exactly ONE consumption fact — the competing one; the bridge spent nothing.
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(1)
  })
})

describe('A5 (resolve-gate drift): a risen requirement DENIES the allow durably at the decision gate', () => {
  let narrowed = false
  const holder = { realm: 'a5m1-auth-realm-a5' }
  const ctx = directAssembly(
    () => (narrowed ? narrowDocs(`tool-invoke|${holder.realm}|tool:team_bash`) : EMPTY_DOCS),
    holder.realm,
  )
  const fixture = directFixture(ctx, 'a5-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('flip AFTER the ask, resolve attempts allow → the verifier denies (reason pa-authority-drift), zero consumption', async () => {
    expect(fixture.plan.requiredAuthority).toBe('leader')
    const leg = makeLeg()
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    narrowed = true
    const decisionRecord = await resolve(leaderCaller(), rowA.requestId, 'allow')
    // The resolve gate refused the ALLOW: what stands durably is a DENY
    // carrying the closed drift reason (never a fourth decision value).
    expect(decisionRecord.decision).toBe('deny')
    expect(decisionRecord.reason).toBe('pa-authority-drift')
    resA = await pending
    expect(resA.decision).toBe('deny')
    expect(resA.requestId).toBe(rowA.requestId)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    // No allow was ever written — the port mirrors the deny (there is no
    // unspent allow to preserve: the drift arrived BEFORE the decision).
    const v = await verifyPort().verify(probeFor(fixture, rowA, fixture.input.request.parametersFingerprint))
    expect(v.allowed).toBe(false)
    if (v.allowed === false) expect(v.reason).toBe('decision-deny')
    // and the FRESH derivation really rose (the drift is a real fact):
    const freshPlan = fixture.input.assembly.planApproval(fixture.input.request)
    expect(freshPlan.ok).toBe(true)
    if (freshPlan.ok) {
      expect(authorityRank(freshPlan.value.requiredAuthority)).toBeGreaterThan(authorityRank('leader'))
    }
  })
})

describe('A5b (bridge rung layer at the guard moment): drift AFTER the allow → deny, allow retained unspent', () => {
  let flipped = false
  const holder = { realm: 'a5m1-auth-realm-a5b' }
  const ctx = directAssembly(
    () => (flipped ? narrowDocs(`tool-invoke|${holder.realm}|tool:team_bash`) : EMPTY_DOCS),
    holder.realm,
  )
  const fixture = directFixture(ctx, 'a5b-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('the authority rises between the decision and the bridge: the leg denies; the durable allow stays exactly as written', async () => {
    // The flip rides the wrapper: it lands AFTER the real decision is
    // durable and BEFORE the bridge resumes — the deterministic "drift
    // during the lock-wait" interleave at the bridge's own rung layer.
    const hooked: PaControlServiceLike = {
      requestControl: (a) => service.requestControl(a),
      awaitControlDecision: async (i) => {
        const d = await service.awaitControlDecision(i)
        flipped = true
        return d
      },
      guardOperation: (s) => service.guardOperation(s),
      listControlState: (r) => service.listControlState(r),
    }
    const leg = createPaControlLeg({
      controlService: hooked,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
    })
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    resA = await pending
    expect(resA.decision).toBe('deny')
    expect(resA.requestId).toBe(rowA.requestId)
    if (resA.decision === 'deny') expect(String(resA.detail)).toMatch(/rose/)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    // The allow is RETAINED (never reclaimed); the verified port answers
    // what the guard WOULD answer now: the coverage has drifted.
    const v = await verifyPort().verify(probeFor(fixture, rowA, fixture.input.request.parametersFingerprint))
    expect(v.allowed).toBe(false)
    if (v.allowed === false) expect(v.reason).toBe('pa-authority-drift')
  })
})

describe('A6 (no-row refuse): a refused requestControl means no row, no decision, no grant', () => {
  it('the scribe (no request-control) never gets a row; the leg denies without a requestId', async () => {
    const ctx = directAssembly()
    const fixture = directFixture(ctx, 'a6-call')
    const leg = createPaControlLeg({
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(SCRIBE),
      beneficiaryAuthority: 'member',
    })
    const res = await leg(fixture.input)
    expect(res.decision).toBe('deny')
    expect(res.requestId).toBeUndefined()
    const st = await state()
    expect(st.requests.filter((r) => r.correlation === fixture.correlation).length).toBe(0)
  })
})

// ── C. the PR358 fix laws (manifest integrity + double gate + pairing + cancel) ──

describe('C1 (manifest integrity): the service RECOMPUTES the digest; every defect writes ZERO rows', () => {
  const ctx = directAssembly()
  const fixture = directFixture(ctx, 'c1-call')

  async function rowsFor(correlation: string): Promise<number> {
    return (await state()).requests.filter((r) => r.correlation === correlation).length
  }

  async function expectMalformed(
    label: string,
    mode: { kind: 'drop-digest' } | { kind: 'drop-fingerprint' } | { kind: 'wrong-digest' } | { kind: 'fingerprint-not-digest' } | { kind: 'bytes'; bytes: Record<string, unknown> },
  ): Promise<void> {
    const before = await rowsFor(fixture.correlation)
    const bytes = manifestBytes(fixture)
    let digest: string | undefined = canonicalJsonFingerprint(bytes)
    let payload: Record<string, unknown> = bytes
    let fingerprint: string | undefined = digest
    if (mode.kind === 'drop-digest') digest = undefined
    else if (mode.kind === 'drop-fingerprint') fingerprint = undefined
    else if (mode.kind === 'wrong-digest') digest = 'sha256-definitely-not-the-canonical-digest'
    else if (mode.kind === 'fingerprint-not-digest') fingerprint = fixture.input.request.parametersFingerprint
    else payload = mode.bytes
    try {
      await service.requestControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        kind: 'leader-approval',
        targetInstanceId: WORKER,
        actionName: PA_CONTROL_ACTION_NAME,
        toolName: 'team_bash',
        correlation: fixture.correlation,
        ...(fingerprint === undefined ? {} : { operationFingerprint: fingerprint }),
        reviewPayload: payload as never,
        ...(digest === undefined ? {} : { reviewPayloadDigest: digest }),
      })
      throw new Error(`${label}: requestControl should have refused`)
    } catch (error: unknown) {
      expect(error, label).toBeInstanceOf(ControlError)
      expect((error as ControlError).code, label).toBe('CONTROL_REQUEST_MALFORMED')
    }
    expect(await rowsFor(fixture.correlation), label).toBe(before)
  }

  it('the honest bytes ARE accepted (positive control), identity-bound to the recomputed digest', async () => {
    const bytes = manifestBytes(fixture)
    const digest = canonicalJsonFingerprint(bytes)
    const row = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: digest,
      reviewPayload: bytes as never,
      reviewPayloadDigest: digest,
    })
    expect(row.operationFingerprint).toBe(digest)
    expect(row.reviewPayloadDigest).toBe(digest)
  })

  it('missing digest → malformed, zero rows', async () => {
    await expectMalformed('missing-digest', { kind: 'drop-digest' })
  })

  it('digest drift → malformed, zero rows', async () => {
    await expectMalformed('wrong-digest', { kind: 'wrong-digest' })
  })

  it('operationFingerprint ≠ the recomputed digest (e.g. the parameters fingerprint) → malformed, zero rows', async () => {
    await expectMalformed('fingerprint-not-digest', { kind: 'fingerprint-not-digest' })
    await expectMalformed('drop-fingerprint', { kind: 'drop-fingerprint' })
  })

  it('an INCOMPLETE manifest (no authorityScope / empty perEffectRequired / no member) → malformed, zero rows', async () => {
    const { authorityScope: _omitScope, ...withoutScope } = manifestBytes(fixture)
    await expectMalformed('no-authorityScope', { kind: 'bytes', bytes: withoutScope })
    await expectMalformed('short-perEffectRequired', { kind: 'bytes', bytes: { ...manifestBytes(fixture), perEffectRequired: [] } })
    const { member: _omitMember, ...withoutMember } = manifestBytes(fixture)
    await expectMalformed('no-member', { kind: 'bytes', bytes: withoutMember })
  })
})

describe('C2 (single-effect drift at the resolve gate): one drifted effect denies the WHOLE allow', () => {
  let narrowed = false
  const realm = 'a5m1-auth-realm-c2'
  const locator = '/srv/a5m1-auth/notes.txt'
  const ctx = directAssembly(
    () => (narrowed ? narrowDocs(`read|${realm}|${locator}`) : EMPTY_DOCS),
    realm,
  )
  const fixture = directFixture(ctx, 'c2-call', WORKER, [
    { kind: 'tool-invoke', toolName: 'team_bash', resource: null },
    { kind: 'read', resource: { realmId: realm, kind: 'absolute-path', canonicalLocator: locator, rights: ['read'] } },
  ])
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('the FULL set starts leader-required; flipping ONE effect ceiling rises only that entry; the allow is denied durably', async () => {
    expect(fixture.plan.perEffectRequired).toEqual(['leader', 'leader'])
    const leg = makeLeg()
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    narrowed = true
    // the drift is SINGLE-effect on the fresh derivation:
    const fresh = fixture.input.assembly.planApproval(fixture.input.request)
    expect(fresh.ok).toBe(true)
    if (fresh.ok) {
      // the effects array is CANONICALLY sorted (read < tool-invoke): the
      // flipped READ effect is entry 0 and rose; the tool-invoke effect is
      // entry 1 and stayed 'leader' — a genuinely single-effect drift.
      expect(fresh.value.perEffectRequired[1]).toBe('leader')
      expect(authorityRank(fresh.value.perEffectRequired[0] as RuntimeAuthority)).toBeGreaterThan(authorityRank('leader'))
    }
    const decisionRecord = await resolve(leaderCaller(), rowA.requestId, 'allow')
    expect(decisionRecord.decision).toBe('deny')
    expect(decisionRecord.reason).toBe('pa-authority-drift')
    resA = await pending
    expect(resA.decision).toBe('deny')
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
  })
})

describe('C3 (drift during the lock-wait, service level): the guard gate refuses with ZERO consumption, the allow is not burned', () => {
  let narrowed = false
  const realm = 'a5m1-auth-realm-c3'
  const ctx = directAssembly(
    () => (narrowed ? narrowDocs(`tool-invoke|${realm}|tool:team_bash`) : EMPTY_DOCS),
    realm,
  )
  const fixture = directFixture(ctx, 'c3-call')

  it('requestControl(marker) → verified allow → drift → guard blocks (pa-authority-drift, zero consumption) → facts restored → guard allows ONCE', async () => {
    const bytes = manifestBytes(fixture)
    const digest = canonicalJsonFingerprint(bytes)
    const rowA = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: digest,
      reviewPayload: bytes as never,
      reviewPayloadDigest: digest,
    })
    const allowed = await resolve(leaderCaller(), rowA.requestId, 'allow')
    expect(allowed.decision).toBe('allow')
    narrowed = true
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: digest,
    }
    const blocked = await service.guardOperation(scope)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.PA_AUTHORITY_DRIFT)
    // the block PAIRS to the row (the verdict names the decision):
    expect(blocked.requestId).toBe(rowA.requestId)
    const st1 = await state()
    expect(st1.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    // the drift did NOT burn the one-shot: restore the facts, the SAME
    // allow consumes (the refusal's zero-effect discipline, proven).
    narrowed = false
    const ok = await service.guardOperation(scope)
    expect(ok.allowed).toBe(true)
    if (ok.allowed) {
      expect(ok.requestId).toBe(rowA.requestId)
      expect(ok.decisionSequence).toBeGreaterThan(0)
    }
    const st2 = await state()
    expect(st2.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(1)
  })
})

describe('C4 (foreign guard verdict): an allowed verdict not PAIRED to the row authorizes nothing', () => {
  const ctx = directAssembly()
  const fixture = directFixture(ctx, 'c4-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('a forged {allowed, requestId≠row} verdict (the real guard is never reached) → deny, zero consumption', async () => {
    const forged: PaControlServiceLike = {
      requestControl: (a) => service.requestControl(a),
      awaitControlDecision: (i) => service.awaitControlDecision(i),
      // FORGED on purpose: the bridge must not trust an `allowed` that
      // names a different row — and must never hand the minted grant back.
      guardOperation: async () => ({ allowed: true, requestId: 'ctrl-foreign-000', decisionSequence: 0 }),
      listControlState: (r) => service.listControlState(r),
    }
    const leg = createPaControlLeg({
      controlService: forged,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
    })
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    resA = await pending
    expect(resA.decision).toBe('deny')
    if (resA.decision === 'deny') expect(String(resA.detail)).toMatch(/foreign pairing/)
    expect((resA as { grant?: unknown }).grant).toBeUndefined()
    const st = await state()
    // the real guard was NEVER called: zero consumption, the allow stands.
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
  })
})

describe('C5 (item 4: parameter-level cancellation): cancel before consume → zero PA consumption, zero body; consumed state retained', () => {
  const ctx = directAssembly()
  // ONE fixture per scenario: a scenario that reused a fixture would ride a
  // row already DECIDED by the previous scenario (the first decision is
  // authoritative) — separate callIds keep the rows independent.

  it('a pre-aborted INPUT signal: unsettled, the row stays pending, zero decision zero mint', async () => {
    const fixture = directFixture(ctx, 'c5a-call')
    const ctrl = new AbortController()
    ctrl.abort()
    const res = await makeLeg()({ ...fixture.input, signal: asSignal(ctrl) })
    expect(res.decision).toBe('unsettled')
    expect(typeof res.requestId).toBe('string')
    const st = await state()
    const row = st.requests.find((r) => r.correlation === fixture.correlation)
    expect(row).not.toBeUndefined()
    expect(row?.status).toBe('pending')
    expect(st.decisions.filter((d) => d.requestId === row?.requestId).length).toBe(0)
  })

  it('a cancel AFTER the decision: unsettled, zero mint (observe-proven), zero consumption; the allow is RETAINED unspent', async () => {
    const fixture = directFixture(ctx, 'c5b-call')
    const ctrl = new AbortController()
    const rows: Record<string, unknown>[] = []
    const hooked: PaControlServiceLike = {
      requestControl: (a) => service.requestControl(a),
      awaitControlDecision: async (i) => {
        const d = await service.awaitControlDecision(i)
        ctrl.abort() // the host exec/token cancel lands the moment the decision arrives
        return d
      },
      guardOperation: (s) => service.guardOperation(s),
      listControlState: (r) => service.listControlState(r),
    }
    const leg = createPaControlLeg({
      controlService: hooked,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
      signal: () => asSignal(ctrl),
      onObserve: (row) => { rows.push(row) },
    })
    const pending = leg(fixture.input)
    const rowA = await waitRow((r) => r.correlation === fixture.correlation)
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    const res = await pending
    expect(res.decision).toBe('unsettled')
    expect(res.requestId).toBe(rowA.requestId)
    expect(rows.some((r) => r.stage === 'grant-minted')).toBe(false)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    expect(st.abandonments.filter((a) => a.requestId === rowA.requestId).length).toBe(0)
    // truthful retention: the allow stands, unspent, verifiably.
    const v = await verifyPort().verify(probeFor(fixture, rowA, fixture.input.request.parametersFingerprint))
    expect(v.allowed).toBe(true)
  })

  it('a cancel AFTER the mint, before the durable guard: deny, the minted grant is NOT returned; consumption stays ZERO and the durable truth is untouched', async () => {
    const fixture = directFixture(ctx, 'c5c-call')
    const ctrl = new AbortController()
    const rows: Record<string, unknown>[] = []
    const leg = createPaControlLeg({
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
      signal: () => asSignal(ctrl),
      onObserve: (row) => {
        rows.push(row)
        if (row.stage === 'grant-minted') ctrl.abort() // cancel inside the mint→guard window
      },
    })
    const pending = leg(fixture.input)
    const rowA = await waitRow((r) => r.correlation === fixture.correlation)
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    const res = await pending
    expect(rows.some((r) => r.stage === 'grant-minted')).toBe(true)
    expect(rows.some((r) => r.stage === 'guard-consumed')).toBe(false)
    expect(res.decision).toBe('deny')
    if (res.decision === 'deny') expect(String(res.detail)).toMatch(/cancelled after the grant was minted/)
    expect((res as { grant?: unknown }).grant).toBeUndefined()
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    // NOTHING was consumed and nothing was faked: the row's durable truth
    // is still an unspent allow (a later spend path is C3's proven law;
    // the cancel itself changed no consumption fact).
    const v = await verifyPort().verify(probeFor(fixture, rowA, fixture.input.request.parametersFingerprint))
    expect(v.allowed).toBe(true)
  })

  it('a consumption that DID happen stays consumed — never later reported as unconsumed', async () => {
    // The retention mirror of the above: A1's spent row answers
    // ALLOW_CONSUMED on every re-probe, forever (never reclaimed) — pinned
    // in A1 itself. The shared PORT law shown here: probes NEVER write, so
    // any probe (even one for a scope with no row at all) leaves the
    // consumption facts byte-identical.
    const st = await state()
    const consumedFacts = st.consumptions.length
    const v = await verifyPort().verify({
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: 'pa:nonexistent-case:never',
      operationFingerprint: 'sha256:never-written',
    })
    expect(v.allowed).toBe(false)
    if (v.allowed === false) expect(v.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect((await state()).consumptions.length).toBe(consumedFacts)
  })
})

// ── D. PR358 f5: the STRICT durable READ-BACK trichotomy (fail closed) ────
//
// THE LAWS THIS DESCRIBE PINS (the criterion block in control/types.ts is
// the field-level contract; the corrupt criterion fields are):
//  (1) MARKER: `reviewPayload` object with `schema === v2` → this class;
//      strict parse fails ⇒ corrupt, passes ⇒ valid;
//  (2) DIGEST BINDING (the marker-stripped tell): marker absent but
//      `reviewPayloadDigest` (non-empty string) ≡ `operationFingerprint` —
//      the PA row-identity pairing requestControl alone enforces — while
//      the reviewPayload is no longer a valid v2 manifest ⇒ corrupt;
//  (3) NEITHER (no marker, no binding) → not-effect-set: BOTH gates skip,
//      byte-identical legacy behaviour (COMPAT PIN — not PA coverage; the
//      legitimate D.3 row: opaque payload + own digest, no/≠ fingerprint,
//      stays old-world, pinned by a).
// DISCLOSED BOUNDARY (g): a row bearing the digest binding fails closed
// even when its payload holds no PA bytes at all — the pairing alone is
// the PA row identity, indistinguishable from a stripped-marker PA row;
// fail closed by law, never reported as PA coverage. Full erasure of ALL
// three fields is indistinguishable from a pre-M1 row (RULING 5-B mirror)
// and is NOT claimed detectable.
//
// THE TAMPER SIMULATION: the ledger is append-only (no rewrite exists), so
// the forger APPENDS the exact bytes a tampered ledger would carry — the
// request/decision payloads cloned from REAL service-written rows and then
// damaged. This models "committed strict, re-read damaged" for the gates,
// which see nothing but the durable rows anyway.

const WORLD2 = join(REPO, 'tests/homes', `a5m1-auth-noverifier-${Date.now().toString(36)}`)
mkdirSync(join(WORLD2, 'root'), { recursive: true })
const seam2 = new FileStorageSeam(WORLD2)
const domain2 = await createTeamDomain(seam2)
const repos2 = domain2.repositories
await repos2.teamSessions.put({
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
await repos2.sessionBindings.put({
  kind: 'team-root',
  schemaVersion: 1,
  sessionId: P6T1_FIXTURE.rootSessionId,
})
for (const name of ['leader', 'worker', 'scribe'] as const) {
  const seed = p6t4Seed(name)
  await repos2.memberInstances.put({
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
// THE POINT OF WORLD 2: NO `paEffectsVerifier` is injected anywhere — the
// corrupt-row fail-closed must not depend on a verifier existing.
const serviceNoVerifier: ControlService = createControlService({
  teamDomain: domain2,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
})

afterAll(async () => {
  await domain2.close()
  rmSync(WORLD2, { recursive: true, force: true })
})

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const LEDGER_FACT_REQUEST = 'control-request-recorded'
const LEDGER_FACT_DECISION = 'control-decision-recorded'

function ledgerPayloadOf(
  ledger: typeof repos.ledger,
  factType: string,
  requestId: string,
): Record<string, unknown> {
  for (const entry of ledger.list()) {
    if (entry.factType !== factType) continue
    if ((entry.payload as { requestId?: unknown }).requestId === requestId) {
      return cloneJson(entry.payload as Record<string, unknown>)
    }
  }
  throw new Error(`fixture: no durable ${factType} for ${requestId}`)
}

async function appendDurableFact(
  ledger: typeof repos.ledger,
  factType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const sequence = await ledger.allocateSequence()
  await ledger.put({
    schemaVersion: 2, // fence L1253 adjudication evidence: durable LEDGER-ROW envelope version (`ledger.put` row envelope — sequence/rootSessionId/factType/payload/createdAt, ZERO blueprint document fields); the ledger-row signature rides the head line (outer-line-evidence ⇒ UNKNOWN by design). NOT a blueprint document version.
    sequence,
    rootSessionId: P6T4_ROOT,
    factType,
    payload,
    createdAt: P6T4_NOW,
  })
  return sequence
}

interface ForgedRow {
  readonly requestId: string
  readonly correlation: string
  readonly digest: string
  readonly paramsFp: string
}

async function forgeTamperedRow(
  fixture: DirectFixture,
  tag: string,
  tamper: (rowPayload: Record<string, unknown>) => void,
  opts: { readonly withAllow: boolean; readonly ledger: typeof repos.ledger },
): Promise<ForgedRow> {
  const bytes = manifestBytes(fixture)
  const digest = canonicalJsonFingerprint(bytes)
  const real = await service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    kind: 'leader-approval',
    targetInstanceId: WORKER,
    actionName: PA_CONTROL_ACTION_NAME,
    toolName: 'team_bash',
    correlation: fixture.correlation,
    operationFingerprint: digest,
    reviewPayload: bytes as never,
    reviewPayloadDigest: digest,
  })
  const allow = await resolve(humanCaller(), real.requestId, 'allow')
  // d) the VALID path is unchanged: the un-damaged strict row still rides
  // the verifier flow to a real allow (and world 1 HAS the verifier).
  expect(allow.decision, `forge(${tag}): the valid row must resolve allow`).toBe('allow')
  const rowPayload = ledgerPayloadOf(repos.ledger, LEDGER_FACT_REQUEST, real.requestId)
  const forgedId = `ctrl-d-forged-${tag}`
  const forgedCorr = `${fixture.correlation}:tampered:${tag}`
  rowPayload['requestId'] = forgedId
  rowPayload['correlation'] = forgedCorr
  tamper(rowPayload)
  const seq = await appendDurableFact(opts.ledger, LEDGER_FACT_REQUEST, rowPayload)
  if (opts.withAllow) {
    const dec = ledgerPayloadOf(repos.ledger, LEDGER_FACT_DECISION, real.requestId)
    dec['requestId'] = forgedId
    dec['requestSequence'] = seq
    ;(dec['scope'] as Record<string, unknown>)['correlation'] = forgedCorr
    await appendDurableFact(opts.ledger, LEDGER_FACT_DECISION, dec)
  }
  return { requestId: forgedId, correlation: forgedCorr, digest, paramsFp: String(bytes.parametersFingerprint) }
}

const stripMarker = (rowPayload: Record<string, unknown>): void => {
  delete (rowPayload['reviewPayload'] as Record<string, unknown>)['schema']
}
const breakManifestField = (rowPayload: Record<string, unknown>): void => {
  delete (rowPayload['reviewPayload'] as Record<string, unknown>)['authorityScope']
}
// item-4: a damage that STAYS schema-valid — the payload is swapped while
// the row's digest fields keep pointing at the original bytes.
const swapCallId = (rowPayload: Record<string, unknown>): void => {
  const p = rowPayload['reviewPayload'] as Record<string, unknown>
  p['callId'] = `${String(p['callId'])}:value-swapped-under-stale-digest`
}

async function guardForged(svc: ControlService, forged: ForgedRow) {
  return svc.guardOperation({
    rootSessionId: P6T4_ROOT,
    targetInstanceId: WORKER,
    actionName: PA_CONTROL_ACTION_NAME,
    toolName: 'team_bash',
    correlation: forged.correlation,
    operationFingerprint: forged.digest,
  })
}

describe('D (PR358 f5 trichotomy): a THIS-CLASS damaged row never re-reads as a legacy row', () => {
  const ctx = directAssembly()

  it('a) old-world rows (no digest no marker; and the D.3 opaque shape) keep BOTH gates byte-identical — COMPAT pin, not PA coverage', async () => {
    // The minimal old-world row: no reviewPayload, no digest, no marker.
    const plainCorr = 'a5m1-d-plain-row'
    const plain = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: 'a5m1-d-legacy-action',
      correlation: plainCorr,
    })
    const d1 = await resolve(humanCaller(), plain.requestId, 'allow')
    expect(d1.decision).toBe('allow')
    expect(d1.reason).toBeUndefined()
    const ok1 = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER,
      actionName: 'a5m1-d-legacy-action',
      correlation: plainCorr,
    })
    expect(ok1.allowed).toBe(true)
    // The D.3 shape: opaque reviewPayload + its OWN digest; the row carries
    // no operationFingerprint (or one that is the OPERATION identity, ≠ the
    // payload digest). A legitimate review-aid row — NOT a stripped
    // manifest. Both gates must skip it exactly as pre-M1.
    const d3Corr = 'a5m1-d-d3-row'
    const d3 = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: 'a5m1-d-legacy-action',
      correlation: d3Corr,
      operationFingerprint: 'sha256:operation-identity-not-the-payload-digest',
      reviewPayload: { reviewedInvocation: { command: 'legacy-recovery-view' } } as never,
      reviewPayloadDigest: 'sha256:opaque-view-digest',
    })
    const d2 = await resolve(humanCaller(), d3.requestId, 'allow')
    expect(d2.decision).toBe('allow')
    expect(d2.reason).toBeUndefined()
    const ok2 = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER,
      actionName: 'a5m1-d-legacy-action',
      correlation: d3Corr,
      operationFingerprint: 'sha256:operation-identity-not-the-payload-digest',
    })
    expect(ok2.allowed).toBe(true)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === plain.requestId).length).toBe(1)
    expect(st.consumptions.filter((c) => c.requestId === d3.requestId).length).toBe(1)
  })

  it('b) marker present + broken manifest field ⇒ corrupt ⇒ resolve DENIES durably, guard blocks ZERO consumption (fail-closed comes from the PA gate, not the row reader)', async () => {
    // resolve gate: the pending damaged row + an ALLOW attempt.
    const f1 = await forgeTamperedRow(directFixture(ctx, 'd-b1-call'), 'b1', breakManifestField, { withAllow: false, ledger: repos.ledger })
    const decisionRecord = await resolve(humanCaller(), f1.requestId, 'allow')
    expect(decisionRecord.decision).toBe('deny')
    expect(decisionRecord.reason).toBe('authority-undetermined')
    const st1 = await state()
    // the row is READABLE at the row level (it sits in `requests`, not
    // `corruptLegs`) — the fail-closed is the PA gate's, not a parse skip:
    expect(st1.requests.some((r) => r.requestId === f1.requestId)).toBe(true)
    expect(st1.corruptLegs.some((l) => l.requestId === f1.requestId)).toBe(false)
    // guard gate: a durable allow on the damaged row does NOT execute.
    const f2 = await forgeTamperedRow(directFixture(ctx, 'd-b2-call'), 'b2', breakManifestField, { withAllow: true, ledger: repos.ledger })
    const blocked = await guardForged(service, f2)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed === false) {
      expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
      expect(blocked.requestId).toBe(f2.requestId)
    }
    const st2 = await state()
    expect(st2.consumptions.filter((c) => c.requestId === f2.requestId).length).toBe(0)
  })

  it('c) marker STRIPPED while the digest binding survives ⇒ corrupt ⇒ BOTH gates fail closed — never an ordinary old row', async () => {
    // resolve gate.
    const f1 = await forgeTamperedRow(directFixture(ctx, 'd-c1-call'), 'c1', stripMarker, { withAllow: false, ledger: repos.ledger })
    const st1 = await state()
    const row1 = st1.requests.find((r) => r.requestId === f1.requestId)
    expect(row1).not.toBeUndefined()
    // the tamper is EXACTLY what the criterion names: schema moved away,
    // reviewPayloadDigest present and ≡ operationFingerprint (the PA row
    // identity binding left standing):
    expect((row1?.reviewPayload as Record<string, unknown>)['schema']).toBeUndefined()
    expect(row1?.reviewPayloadDigest).toBe(f1.digest)
    expect(row1?.operationFingerprint).toBe(f1.digest)
    const decisionRecord = await resolve(humanCaller(), f1.requestId, 'allow')
    expect(decisionRecord.decision).toBe('deny')
    expect(decisionRecord.reason).toBe('authority-undetermined')
    // guard gate + the NON-PRODUCTION test mirror answer undetermined too.
    const f2 = await forgeTamperedRow(directFixture(ctx, 'd-c2-call'), 'c2', stripMarker, { withAllow: true, ledger: repos.ledger })
    const blocked = await guardForged(service, f2)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
    expect((await state()).consumptions.filter((c) => c.requestId === f2.requestId).length).toBe(0)
    const v = await verifyPort().verify({
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: f2.correlation,
      operationFingerprint: f2.digest,
    })
    expect(v.allowed).toBe(false)
    if (v.allowed === false) expect(v.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
  })

  it('d) the VALID path is unchanged: the un-damaged forged twin resolves allow and consumes exactly once', async () => {
    const f = await forgeTamperedRow(directFixture(ctx, 'd-d1-call'), 'd1', () => {}, { withAllow: false, ledger: repos.ledger })
    const decisionRecord = await resolve(humanCaller(), f.requestId, 'allow')
    expect(decisionRecord.decision).toBe('allow')
    expect(decisionRecord.reason).toBeUndefined()
    const ok = await guardForged(service, f)
    expect(ok.allowed).toBe(true)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === f.requestId).length).toBe(1)
  })

  it('e) no verifier anywhere: the corrupt row fails closed the same (the deny/block is not a verifier answer)', async () => {
    const state2 = async () => serviceNoVerifier.listControlState(P6T4_ROOT)
    const f1 = await forgeTamperedRow(directFixture(ctx, 'd-e1-call'), 'e1', stripMarker, { withAllow: false, ledger: repos2.ledger })
    const denied = await serviceNoVerifier.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: f1.requestId,
      decision: 'allow',
    })
    expect(denied.decision).toBe('deny')
    expect(denied.reason).toBe('authority-undetermined')
    const f2 = await forgeTamperedRow(directFixture(ctx, 'd-e2-call'), 'e2', breakManifestField, { withAllow: true, ledger: repos2.ledger })
    const blocked = await guardForged(serviceNoVerifier, f2)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
    const st = await state2()
    expect(st.consumptions.filter((c) => c.requestId === f2.requestId).length).toBe(0)
    // the forged rows really are in WORLD 2 and readable there:
    expect(st.requests.some((r) => r.requestId === f2.requestId)).toBe(true)
  })

  it('f) the classifier itself: the criterion fields, pinned field-by-field', () => {
    const bytes = manifestBytes(directFixture(ctx, 'd-f-call'))
    // (1) marker + strict parse passes + the row's OWN value pairing
    // re-computes → valid, manifest attached (item-4: a marker-bearing row
    // without the pairing the write law creates is damage, not validity).
    const fp = canonicalJsonFingerprint(bytes)
    const pairing = { reviewPayloadDigest: fp, operationFingerprint: fp }
    const valid = paManifestClassOf({ ...pairing, reviewPayload: bytes as never })
    expect(valid.state).toBe('valid')
    if (valid.state === 'valid') expect(valid.manifest.realmId).toBe(bytes.realmId)
    // item-4 counter-examples: schema-valid payload, pairing NOT re-locked.
    // (a) no pairing at all → corrupt (never went through the write law).
    expect(paManifestClassOf({ reviewPayload: bytes as never }).state).toBe('corrupt')
    // (b) a STALE digest — the payload was damaged while staying
    // schema-valid, the digest was never recomputed → corrupt.
    const { callId: _old, ...rest } = bytes
    const restBytes = { ...rest, callId: 'd-f-call:payload-swapped-while-valid' }
    expect(paManifestClassOf({
      ...pairing,
      reviewPayload: restBytes as never,
    }).state).toBe('corrupt')
    // (c) digest matches the payload, operationFingerprint diverges (the
    // row identity is broken) → corrupt.
    expect(paManifestClassOf({
      reviewPayloadDigest: fp,
      operationFingerprint: 'sha256:operation-identity-diverged',
      reviewPayload: bytes as never,
    }).state).toBe('corrupt')
    // (1) marker + damaged field → corrupt (the marker alone binds the class).
    const { authorityScope: _dropScope, ...damaged } = bytes
    expect(paManifestClassOf({ reviewPayload: damaged as never }).state).toBe('corrupt')
    // (2) marker stripped, digest binding survives → corrupt (all payload
    // shapes that are not a valid v2 manifest are the same fact).
    const binding = { reviewPayloadDigest: 'sha256:D', operationFingerprint: 'sha256:D' }
    expect(paManifestClassOf({ ...binding, reviewPayload: damaged as never }).state).toBe('corrupt')
    expect(paManifestClassOf({ ...binding, reviewPayload: { note: 'opaque' } as never }).state).toBe('corrupt')
    expect(paManifestClassOf({ ...binding, reviewPayload: [1, 2] as never }).state).toBe('corrupt')
    // (3) NOT this class: no marker, no binding (the legacy/D.3 surface).
    expect(paManifestClassOf({}).state).toBe('not-effect-set')
    expect(paManifestClassOf({ reviewPayload: { note: 'opaque' } as never }).state).toBe('not-effect-set')
    expect(paManifestClassOf({ reviewPayload: { note: 'opaque' } as never, reviewPayloadDigest: 'sha256:D' }).state).toBe('not-effect-set')
    expect(paManifestClassOf({
      reviewPayload: { note: 'opaque' } as never,
      reviewPayloadDigest: 'sha256:D',
      operationFingerprint: 'sha256:OTHER-operation-identity',
    }).state).toBe('not-effect-set')
    // empty-string pairing binds nothing.
    expect(paManifestClassOf({ reviewPayload: { note: 'opaque' } as never, reviewPayloadDigest: '', operationFingerprint: '' }).state).toBe('not-effect-set')
  })

  it('g) documented boundary: digest-bearing parity binds the class even with no PA bytes in the payload (fail closed by law; never PA coverage)', async () => {
    // A row whose operationFingerprint ≡ its reviewPayloadDigest carries the
    // PA row-identity pairing — indistinguishable FROM THE BYTES ALONE from
    // a PA row whose marker was stripped after commit. The classifier binds
    // it to this class and both gates fail closed. This is a DAMAGE
    // classification, not a coverage claim: such a row is not "PA-approved
    // old-world", it is unreadable-as-anything-else.
    const pair = 'sha256:parity-pair-string'
    const row = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: 'a5m1-d-legacy-action',
      correlation: 'a5m1-d-parity-row',
      operationFingerprint: pair,
      reviewPayload: { opaque: 'no PA bytes at all' } as never,
      reviewPayloadDigest: pair,
    })
    const denied = await resolve(humanCaller(), row.requestId, 'allow')
    expect(denied.decision).toBe('deny')
    expect(denied.reason).toBe('authority-undetermined')
  })

  it('h) item-4 VALUE check: a schema-VALID payload swap under a stale digest re-reads as damage at BOTH gates', async () => {
    // The damage item-4 names: strict parse would happily PASS this row —
    // only the digest VALUE re-computation sees it (a forged ledger write
    // swapped the manifest while leaving the pairing fields pointing at
    // the original bytes). The verifier is never consulted for it.
    const f1 = await forgeTamperedRow(directFixture(ctx, 'd-h1-call'), 'h1', swapCallId, { withAllow: false, ledger: repos.ledger })
    const row1 = (await state()).requests.find((r) => r.requestId === f1.requestId)
    expect(row1).not.toBeUndefined()
    // the tamper really is schema-valid:
    expect((row1?.reviewPayload as Record<string, unknown>)['schema']).toBe(PA_CONTROL_MANIFEST_SCHEMA)
    expect(row1?.reviewPayloadDigest).toBe(f1.digest)
    const decisionRecord = await resolve(humanCaller(), f1.requestId, 'allow')
    expect(decisionRecord.decision).toBe('deny')
    expect(decisionRecord.reason).toBe('authority-undetermined')
    // guard gate: a durable allow riding the swapped row does NOT execute.
    const f2 = await forgeTamperedRow(directFixture(ctx, 'd-h2-call'), 'h2', swapCallId, { withAllow: true, ledger: repos.ledger })
    const blocked = await guardForged(service, f2)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
    expect((await state()).consumptions.filter((c) => c.requestId === f2.requestId).length).toBe(0)
  })
})

// ── E. PR358-B (CCR-358a): the call-level FACTS adapter at both gates ───
//
// The async-orchestration contract, tested at the SERVICE gates (not a
// direct port poke): undefined facts, a throwing adapter, and a
// facts-vs-manifest source mismatch each answer at BOTH the resolve and
// the guard gate, and NONE of them writes anything but the closed durable
// fact the deviation itself names: the resolve deviation is the
// invariant-45 durable DENY (a fact, not a side effect), the guard
// deviation is a block with ZERO consumption.

async function forgeValidRow(fixture: DirectFixture) {
  const bytes = manifestBytes(fixture)
  const digest = canonicalJsonFingerprint(bytes)
  const row = await service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    kind: 'leader-approval',
    targetInstanceId: WORKER,
    actionName: PA_CONTROL_ACTION_NAME,
    toolName: 'team_bash',
    correlation: fixture.correlation,
    operationFingerprint: digest,
    reviewPayload: bytes as never,
    reviewPayloadDigest: digest,
  })
  return { row, digest }
}

function guardScope(fixture: DirectFixture, digest: string) {
  return {
    rootSessionId: P6T4_ROOT,
    targetInstanceId: WORKER,
    actionName: PA_CONTROL_ACTION_NAME,
    toolName: 'team_bash',
    correlation: fixture.correlation,
    operationFingerprint: digest,
  }
}

describe('E1 (facts undefined ⇒ undetermined at BOTH gates): undefined facts are never a pass, never a consumption', () => {
  const realm = 'a5m1-auth-realm-e1'
  const ctx = directAssembly(undefined, realm)

  it('resolve gate: the ALLOW attempt on a valid PA row whose facts cannot be read DENIES durably (authority-undetermined), zero consumption', async () => {
    const fixture = directFixture(ctx, 'e1-resolve-call')
    const { row, digest } = await forgeValidRow(fixture)
    expect(digest).not.toBe('')
    const saved = realmTruths.get(realm)
    expect(saved).not.toBeUndefined()
    realmTruths.delete(realm) // the plane stops answering for this realm
    try {
      const decided = await resolve(leaderCaller(), row.requestId, 'allow')
      expect(decided.decision).toBe('deny')
      expect(decided.reason).toBe('authority-undetermined')
    } finally {
      realmTruths.set(realm, saved as RealmTruth)
    }
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
  })

  it('guard gate: facts gone AFTER the allow ⇒ block authority-undetermined, ZERO consumption; restored ⇒ the SAME allow consumes ONCE', async () => {
    const fixture = directFixture(ctx, 'e1-guard-call')
    const { row, digest } = await forgeValidRow(fixture)
    const allowed = await resolve(leaderCaller(), row.requestId, 'allow')
    expect(allowed.decision).toBe('allow')
    const saved = realmTruths.get(realm)
    expect(saved).not.toBeUndefined()
    realmTruths.delete(realm)
    try {
      const blocked = await service.guardOperation(guardScope(fixture, digest))
      expect(blocked.allowed).toBe(false)
      if (blocked.allowed === false) {
        expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
        expect(blocked.requestId).toBe(row.requestId)
      }
      const st = await state()
      expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
    } finally {
      realmTruths.set(realm, saved as RealmTruth)
    }
    const ok = await service.guardOperation(guardScope(fixture, digest))
    expect(ok.allowed).toBe(true)
    const st2 = await state()
    expect(st2.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
  })
})

describe('E2 (facts adapter THROWS ⇒ undetermined, zero writes): the await deviation is fail-closed, never a pass', () => {
  const realm = 'a5m1-auth-realm-e2'
  const ctx = directAssembly(undefined, realm)

  it('resolve gate: a throwing facts adapter DENIES durably (authority-undetermined)', async () => {
    const fixture = directFixture(ctx, 'e2-resolve-call')
    const { row } = await forgeValidRow(fixture)
    const truth = realmTruths.get(realm)
    expect(truth).not.toBeUndefined()
    const poison = truth as RealmTruth
    poison.throwFacts = true
    try {
      const decided = await resolve(leaderCaller(), row.requestId, 'allow')
      expect(decided.decision).toBe('deny')
      expect(decided.reason).toBe('authority-undetermined')
    } finally {
      delete poison.throwFacts
    }
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
  })

  it('guard gate: the throw AFTER the allow blocks with ZERO consumption; the same allow survives to consume ONCE', async () => {
    const fixture = directFixture(ctx, 'e2-guard-call')
    const { row, digest } = await forgeValidRow(fixture)
    const allowed = await resolve(leaderCaller(), row.requestId, 'allow')
    expect(allowed.decision).toBe('allow')
    const truth = realmTruths.get(realm) as RealmTruth
    truth.throwFacts = true
    try {
      const blocked = await service.guardOperation(guardScope(fixture, digest))
      expect(blocked.allowed).toBe(false)
      if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
      const st = await state()
      expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
    } finally {
      delete truth.throwFacts
    }
    const ok = await service.guardOperation(guardScope(fixture, digest))
    expect(ok.allowed).toBe(true)
  })
})

describe('E3 (facts-vs-manifest source mismatch ⇒ DRIFT): the approval covers the facts it was granted over', () => {
  const realm = 'a5m1-auth-realm-e3'
  const ctx = directAssembly(undefined, realm)

  it('the CURRENT binding reports a moved revision after the row ⇒ the ALLOW denies durably (pa-authority-drift), zero consumption', async () => {
    const fixture = directFixture(ctx, 'e3-binding-call')
    const { row } = await forgeValidRow(fixture)
    const truth = realmTruths.get(realm) as RealmTruth
    truth.bindingRevisionBump = 99
    try {
      const decided = await resolve(leaderCaller(), row.requestId, 'allow')
      expect(decided.decision).toBe('deny')
      expect(decided.reason).toBe('pa-authority-drift')
    } finally {
      delete truth.bindingRevisionBump
    }
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
  })

  it('the drift arriving AFTER the allow blocks the guard with ZERO consumption; restored facts consume ONCE', async () => {
    const fixture = directFixture(ctx, 'e3-guard-call')
    const { row, digest } = await forgeValidRow(fixture)
    const allowed = await resolve(leaderCaller(), row.requestId, 'allow')
    expect(allowed.decision).toBe('allow')
    const truth = realmTruths.get(realm) as RealmTruth
    truth.bindingRevisionBump = 99
    try {
      const blocked = await service.guardOperation(guardScope(fixture, digest))
      expect(blocked.allowed).toBe(false)
      if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.PA_AUTHORITY_DRIFT)
      const st = await state()
      expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
    } finally {
      delete truth.bindingRevisionBump
    }
    const ok = await service.guardOperation(guardScope(fixture, digest))
    expect(ok.allowed).toBe(true)
  })
})

describe('E4 (the input.facts pre-answer is a TEST seam, default CLOSED): a production-shaped wiring cannot be fed facts through the input', () => {
  const realm = 'a5m1-auth-realm-e4'
  const ctx = directAssembly(undefined, realm)

  it('no flag ⇒ input.facts is IGNORED and the adapter is the only source; allowFactsInjection:true ⇒ the held facts are honoured, the adapter is never consulted', async () => {
    const fixture = directFixture(ctx, 'e4-call')
    const manifest = parsePaControlManifest(manifestBytes(fixture))
    expect(manifest).not.toBeUndefined()
    const m = manifest as NonNullable<typeof manifest>
    // The REAL decider for these E-block rows: the row is a leader-approval
    // row targeting WORKER, resolved by the LEADER — the exact
    // ControlCallerRef the service's `callerRefOf` produces at the resolve
    // gate (instance + durable role), not a copy of the helper's shape.
    const decider: ControlCallerRef = {
      kind: 'instance',
      instanceId: String(P6T4_SEEDS.leader.instanceId),
      role: 'leader',
    }
    // REAL facts from the shared fake — the combination the restored E1/E2
    // guard flows ride to a live allow, so if honoured it MUST cover.
    const facts = await fakeReadCallFacts({
      rootSessionId: P6T4_ROOT,
      requestId: 'e4-req',
      manifest: m,
      decider,
      stage: 'resolve',
    })
    expect(facts).not.toBeUndefined()
    const held = facts as NonNullable<typeof facts>
    // (1) the PRODUCTION shape: the flag was never opened. The injected
    // facts change NOTHING — the verifier still asks the adapter, and the
    // adapter's undefined lands the closed undetermined answer.
    let adapterAsked = false
    const sealed = createPaEffectsVerifier({
      readCallFacts: async () => {
        adapterAsked = true
        return undefined
      },
    })
    const sealedVerdict = await sealed({
      stage: 'resolve',
      rootSessionId: P6T4_ROOT,
      requestId: 'e4-req',
      manifest: m,
      decider,
      facts: held,
    })
    expect(adapterAsked).toBe(true)
    expect(sealedVerdict.ok).toBe(false)
    if (!sealedVerdict.ok) expect(sealedVerdict.reason).toBe('authority-undetermined')
    // (2) the TEST seam explicitly opened: the held facts are honoured and
    // the adapter is NEVER consulted — a throwing adapter proves the input
    // answer bypassed it entirely, and the coverage verdict is the real
    // pure-core walk over exactly those facts.
    const opened = createPaEffectsVerifier({
      readCallFacts: async () => {
        throw new Error('the adapter must not be consulted while the seam supplies the facts')
      },
      allowFactsInjection: true,
    })
    const openedVerdict = await opened({
      stage: 'resolve',
      rootSessionId: P6T4_ROOT,
      requestId: 'e4-req',
      manifest: m,
      decider,
      facts: held,
    })
    expect(openedVerdict).toEqual({ ok: true })
  })
})

// ── B. plane integration: the real leg on the real production edge ──────

interface Definition { name: string; execute: (raw: unknown) => Promise<{ text?: string }> }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
  backends: Record<string, { execCount?: () => number }>
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}

const planeRow: PlaneRow = await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href) as PlaneRow
const PLANE_REALM = 'a5m1-auth-plane-realm'

// The verifier's mirror of the plane's OWN assembly (same trusted wiring:
// same policy object, realm, template, role, generation, beneficiary) —
// the resolve/guard gates re-derive coverage through EXACTLY these facts.
directAssembly(undefined, PLANE_REALM)

function buildPlane(controlLeg: (input: PaControlLegInput) => Promise<PaControlLegResult>) {
  const built = planeRow.createTeamToolPlaneAssembly({
    permissionPolicy: Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }),
    realmId: PLANE_REALM,
    templateId: 'a5m1-auth-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    controlLeg,
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'a5m1-auth-ctl', rootDir: ROOT_DIR, realmId: PLANE_REALM, kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
      cwdRoot: ROOT_DIR,
    },
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code}`)
  return built.value
}

const plane = buildPlane(createPaControlLeg({
  controlService: service,
  rootSessionId: P6T4_ROOT,
  caller: memberCaller(WORKER),
  beneficiaryAuthority: 'member',
}))

const def = (name: string): Definition => {
  const d = plane.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`definition ${name} missing (${plane.ownNames.join(',')})`)
  return d
}

async function runTool(name: string, args: Record<string, unknown>): Promise<{ threw: boolean; text: string }> {
  try {
    const r = await def(name).execute(args)
    return { threw: false, text: String(r.text ?? JSON.stringify(r)) }
  } catch (error: unknown) {
    return { threw: true, text: String((error as Error)?.message ?? error) }
  }
}

describe('B (plane integration): ask → durable approval → exactly one body', () => {
  it('team_bash: one real approval (human decider) → ONE body through the real landlock launcher', async () => {
    const before = new Set((await state()).requests.map((r) => r.requestId))
    const running = runTool('team_bash', { command: 'printf auth-bridge-body' })
    const row = await waitRow((r) => !before.has(r.requestId))
    expect(row.kind).toBe('leader-approval')
    expect(row.targetInstanceId).toBe(WORKER)
    expect(String(row.correlation)).toMatch(/^pa:tadm:/)
    const manifest = manifestOf(row)
    expect(manifest.schema).toBe(PA_CONTROL_MANIFEST_SCHEMA)
    expect(String(manifest.approvalCaseId)).toMatch(/^tadm:/)
    expect(String(row.operationFingerprint)).toBe(String(row.reviewPayloadDigest))
    expect((manifest.effects as unknown[]).length).toBeGreaterThan(0)
    // the binding snapshot is faithful: the plane's ToolBinding carries the
    // BACKEND tool name ('bash'), the row's toolName the plane tool ('team_bash').
    expect((manifest.binding as Record<string, unknown>).toolName).toBe('bash')
    await resolve(humanCaller(), row.requestId, 'allow')
    const outcome = await running
    expect(outcome.threw).toBe(false)
    expect(outcome.text).toContain('auth-bridge-body')
    expect(plane.backends.shell?.execCount?.()).toBe(1)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
  }, 120_000)

  it('team_bash: a durable DENY on the next run stays zero-body', async () => {
    const before = new Set((await state()).requests.map((r) => r.requestId))
    const running = runTool('team_bash', { command: 'printf must-not-run' })
    const row = await waitRow((r) => !before.has(r.requestId))
    await resolve(leaderCaller(), row.requestId, 'deny')
    const outcome = await running
    expect(outcome.text).toMatch(/APPROVAL_DENIED/)
    expect(plane.backends.shell?.execCount?.()).toBe(1)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
  }, 60_000)

  it('read: one real approval (leader decider) → the governed read body once', async () => {
    writeFileSync(join(ROOT_DIR, 'notes.txt'), 'AUTH-BRIDGE-READ-BODY\n')
    const before = new Set((await state()).requests.map((r) => r.requestId))
    const running = runTool('read', { file_path: join(ROOT_DIR, 'notes.txt') })
    const row = await waitRow((r) => !before.has(r.requestId))
    expect(row.kind).toBe('leader-approval')
    const manifest = manifestOf(row)
    expect((manifest.effects as unknown[]).length).toBeGreaterThanOrEqual(2) // tool-invoke + read (+ meta)
    await resolve(leaderCaller(), row.requestId, 'allow')
    const outcome = await running
    expect(outcome.threw).toBe(false)
    expect(outcome.text).toContain('AUTH-BRIDGE-READ-BODY')
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
  }, 60_000)
})
