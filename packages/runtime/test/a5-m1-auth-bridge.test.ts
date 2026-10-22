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
 *    reclaimed, never later reported as unconsumed (C5 + A1).
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
import { PA_CONTROL_MANIFEST_SCHEMA, parsePaControlManifest } from '../control/types.js'
import type {
  ControlDecisionRecord,
  ControlRequestRecord,
  ControlService,
  ControlWaitSignal,
} from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import { authorityRank } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
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

// The trusted wiring the ALL-EFFECTS verifier re-derives through: one
// landing assembly per PA realm — exactly the facts the leg used. The
// service's resolve gate and guard gate both ask THIS port, inside the
// same per-team lock, before the decision and before the consumption.
const assemblies = new Map<string, ProductionAdmissionAssembly>()
const paVerifier = createPaEffectsVerifier({
  assemblyFor: (manifest) => assemblies.get(manifest.realmId),
  beneficiaryOf: (manifest) => (manifest.member.teamSessionId === P6T4_ROOT ? 'member' : undefined),
})

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
  assemblies.set(realmId, built.value)
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
