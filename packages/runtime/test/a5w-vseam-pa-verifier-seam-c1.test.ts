/**
 * a5w-vseam-pa-verifier-seam-c1 — the Control-side PA verifier is assembled
 * WITH the subtree containment seam (product assembly gap closed 2026-10-31,
 * real UTC; LEG-SEMANTICS-INVESTIGATION 乙 ruling, §6 minimal-fix list).
 *
 * DEFECT EVIDENCE (bw7 real boot, dev/agent-workflow/evidence/
 * a5w-bootwave-20261030/c2/run-bw7.json + LEG-SEMANTICS-INVESTIGATION.md):
 * the PA ask row for a governed `read_image` call (effect set
 * tool-invoke + read + domain-ref, template carrying a subtree ask rule)
 * was answered ALLOW by the Leader over the durable channel and the ledger
 * committed a persistent DENY with `ok:true` — reason `pa-authority-drift`.
 * Root cause: `createPaEffectsVerifier`'s pure-core re-derivation called
 * `evaluateEffectSetExpansion` / `planEffectSetApproval` /
 * `verifyEffectSetApproval` WITHOUT the `SubtreeContains` seam, while the
 * very same world had already mounted its plane WITH `a5PlaneSubtreeContains`
 * (#508). No seam + a subtree rule = the domain law's `undeterminable` arm
 * (authority-envelope matcherCovers) → scope undetermined → set unapprovable
 * → the resolve gate read that as drift → the allow became a durable deny.
 *
 * WHAT THIS SUITE PINS (C1, fixture-level over the REAL durable control
 * plane — real ControlService, real TeamDomain ledger rows, NO boot, NO host,
 * NO ports; the world lives under tests/homes/<line>-<stamp>, TEST_METHODS
 * §7, destroyed in afterAll):
 *  V1  (the fix, both gates): the incident-shaped world (subtree ask rule +
 *      multi-effect set WITH a `read` effect) resolved allow by the Human
 *      ADMIN lands as a durable ALLOW (decision.reason stays UNSETTLED-free /
 *      undefined — gate 1) AND the consumption fact appears
 *      (`control-allow-consumed`, state.consumptions=1 — gate 2). The
 *      verifier answers `covered` at BOTH stages.
 *  V1o (observability): every pa-verifier observation row the port emits
 *      carries stage/gate/outcome/detail + rootSessionId/instanceId — the
 *      exact fields the mount-routed observations channel needs to make the
 *      verdict visible in the instance log (the bw7 world had NOTHING).
 *  V2  (the dual, fail-closed law does NOT weaken): the SAME incident-shaped
 *      manifest over a verifier whose deps carry NO seam entry still commits
 *      a durable DENY with reason `pa-authority-drift` at the resolve gate
 *      (service.ts resolve arm; investigation §3.2) with ZERO consumption,
 *      and its detail names the EXPANSION plane at the read effect — the
 *      exact bw7 fingerprint, now proven offline.
 *  VG  (two gates, one port): flip the seam OFF between the resolve gate
 *      (allow committed) and the guard gate — the guard refuses with
 *      `pa-authority-drift` and ZERO consumption; restore the seam and the
 *      SAME one-shot allow consumes exactly once. Both gates consulted the
 *      SAME verifier instance (service resolve :2754 / recheckConsumedAuthority
 *      :3605), each pinned separately.
 *  VE  (seam reaches ALL THREE pure-core calls, not just the expansion):
 *      a policy WITHOUT file rules but with an envelope subtree rule that
 *      does NOT cover the call (elsewhere root) is NEUTRAL with the seam
 *      (coverage false → rule inert → allow + consumed) and POISON without
 *      it (undeterminable → the APPROVAL-plane re-derivation refuses →
 *      drift) — the discriminator is the seam alone, pinning the
 *      planEffectSetApproval/verifyEffectSetApproval threading.
 *  VA  (ask-path zero regression): the `ask_user_question` shape
 *      (tool-invoke + domain-ref, NO file-class effect) approves and consumes
 *      with the seam installed but NEVER CONSULTED (predicate call count 0)
 *      — exactly why bw7's ask row survived while the image row died.
 *  P   (source pins against a silently reverted wiring): the bridge threads
 *      `subtreeContains` into all three pure-core calls; root.ts composes
 *      the verifier WITH `resolveSubtreeContains` + `onObserve` over the
 *      published mount; the plane's mount face exposes `subtreeContains`;
 *      publishPaMount carries `subtreeContains` + `onObserve`. The registry
 *      file stays byte-frozen (u6-pr4 E1): the 12-field PaCallFacts
 *      contract is CLOSED — the seam is mount face, never a fact, and the
 *      mount entry's typed face takes it through the open index signature.
 *
 * @module packages/runtime/test/a5w-vseam-pa-verifier-seam-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
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
  createControlService,
} from '../control/index.js'
import { PA_CONTROL_MANIFEST_SCHEMA } from '../control/types.js'
import type {
  ControlDecisionRecord,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { AuthorityDocumentSlot, AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import { createProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { EffectSetApprovalPlan } from '../tool-admission/approval-case.js'
import {
  PA_CONTROL_ACTION_NAME,
  createPaControlLeg,
  createPaEffectsVerifier,
  paCorrelation,
} from '../operation-permission/pa-control-bridge.js'
import type {
  PaControlBridgeDeps,
  PaControlLegInput,
  PaControlLegResult,
  PaEffectsVerifierDeps,
} from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  humanCaller,
  memberCaller,
  p6t4Seed,
} from './p6t4-helpers.js'
import { loadGlueModule } from './t12a-live-bridge.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests', 'homes', `a5w-vseam-${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
// The subtree ROOT of the incident rule, and a location OUTSIDE it (never
// covered by the root's law; the shared-prefix sibling `/…-evil` is the
// spoof the law refuses — #508 N2 keeps the boundary, this suite only needs
// the inside/outside pair).
const WS = join(WORLD, 'workspace')
const OUTSIDE = join(WORLD, 'outside')

// ── the real durable world (real TeamDomain + real ControlServices) ─────
mkdirSync(ROOT_DIR, { recursive: true })
mkdirSync(WS, { recursive: true })
mkdirSync(OUTSIDE, { recursive: true })

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
const WORKER = P6T4_SEEDS.worker.instanceId

afterAll(async () => {
  await domain.close()
  rmSync(WORLD, { recursive: true, force: true })
})

// ── the plane-identical containment seam ────────────────────────────────
// Top-level await: the realm fixtures below are built during collection and
// their mint-side assemblies are assembled WITH this predicate already live.
const glue = await loadGlueModule() as unknown as {
  a5PlaneSubtreeContains: (a: unknown, b?: unknown) => boolean
}
const glueSeam = glue.a5PlaneSubtreeContains
if (typeof glueSeam !== 'function') throw new Error('a5PlaneSubtreeContains missing from the glue module — the seam source itself moved')

/** The ONE predicate every seam-enabled world consults — the REAL glue
 *  function, wrapped ONLY to count consultations (the ask-path pin VA). */
let seamCalls = 0
function countedSeam(root: string, child: string): boolean {
  seamCalls += 1
  return glueSeam(root, child) === true
}

// ── the call-level facts fake (a5-m1-auth-bridge shape, real reads) ─────
interface RealmTruth {
  readonly assembly: ProductionAdmissionAssembly
  readonly documents: () => AuthorityEnvelopeDocuments
  generation: number
}
function factSlot(slot: AuthorityDocumentSlot): PaCallFactsCeilingSlot | undefined {
  if (typeof slot !== 'object') return undefined
  if (!('status' in slot)) return slot
  if (slot.status === 'unavailable') return undefined
  return slot
}
const realmTruths = new Map<string, RealmTruth>()
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
    requestedEffects: effects.value,
  })
  const livePlan = truth.assembly.planApproval(request)
  if (!livePlan.ok) return undefined
  const ceiling = truth.documents()
  const hard = factSlot(ceiling.teamHardEnvelope)
  const mutation = factSlot(ceiling.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  return {
    policySource: { staticLayerRefs: ['a5w-vseam-tpl:directive-policy'], overlayGeneration: 0 },
    realmId: manifest.realmId,
    ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
    policyDocument: truth.assembly.policyDocument(),
    denySources: truth.assembly.denySources(),
    effects: effects.value,
    member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
    beneficiaryAuthority: 'member',
    binding: binding.value,
    blueprint: {
      revision: String(blueprint.revision),
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

// ── the two verifier worlds + their services (one shared domain) ────────
/** realm → the seam this "mount" answers with. A realm present in this map
 *  is a mount that PUBLISHED its subtree seam (the fixed product world);
 *  removing it simulates a mount that carries no seam — the resolver then
 *  answers `undefined` exactly like the root composition reading an absent
 *  mount member. */
const seamWorlds = new Map<string, () => (root: string, child: string) => boolean>()

const v1Rows: Array<Readonly<Record<string, unknown>> & { stage: string }> = []
const v2Rows: Array<Readonly<Record<string, unknown>> & { stage: string }> = []

/** World 1 (production shape post-fix): deps carry the seam RESOLVER. */
const verifierWithSeam = createPaEffectsVerifier({
  readCallFacts: fakeReadCallFacts,
  resolveSubtreeContains: ({ manifest }) => seamWorlds.get(manifest.realmId)?.(),
  onObserve: (row) => { v1Rows.push(row) },
})
/** World 2 (the dual, bw7 shape): the SAME adapter, deps carry NO seam
 *  entry at all. Fail-closed: subtree coverage stays undeterminable. */
const verifierWithoutSeam = createPaEffectsVerifier({
  readCallFacts: fakeReadCallFacts,
  onObserve: (row) => { v2Rows.push(row) },
})

const serviceSeam: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: verifierWithSeam,
})
const serviceNoSeam: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: verifierWithoutSeam,
})

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

async function waitRow(
  svc: ControlService,
  isNew: (row: ControlRequestRecord) => boolean,
  timeoutMs = 20_000,
): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const st = await svc.listControlState(P6T4_ROOT)
    const found = st.requests.find(isNew)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error('the durable control row never appeared')
    await sleep(25)
  }
}

function makeLeg(svc: ControlService, extra: Partial<PaControlBridgeDeps> = {}) {
  return createPaControlLeg({
    controlService: svc,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    beneficiaryAuthority: 'member',
    ...extra,
  })
}

// ── fixture builders ─────────────────────────────────────────────────────
const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
/** The bw7 incident rule shape: a subtree ASK rule for read_image over the
 *  member workspace (bootwave template `read_image @ <ws>` subtree arm). */
function subtreeAskPolicy(rootPath: string): TemplatePermissionPolicy {
  return {
    default: 'ask',
    allow: [],
    ask: [{ tool: 'read_image', resource: { kind: 'subtree', path: rootPath } }],
    deny: [],
  } as unknown as TemplatePermissionPolicy
}
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})

let realmSeq = 0

/** A mount-shaped assembly: the SAME production entry the plane uses,
 *  assembled WITH the seam (the production truth since #508 — the mint side
 *  always had it; this suite is about the Control-side verifier). */
function seamAssembly(
  permissionPolicy: TemplatePermissionPolicy,
  documentsFor: (realmId: string) => AuthorityEnvelopeDocuments,
): { assembly: ProductionAdmissionAssembly; realm: string } {
  const realmId = `a5w-vseam-r-${String(realmSeq++)}`
  const documents = (): AuthorityEnvelopeDocuments => documentsFor(realmId)
  const built = createProductionAdmissionAssembly({
    permissionPolicy,
    realmId,
    templateId: 'a5w-vseam-tpl',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => Date.now(),
    authorityGeneration: () => 0,
    beneficiaryAuthority: 'member',
    documents,
    subtreeContains: (root, child) => glueSeam(root, child) === true,
    onObserve: () => {},
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.error.message}`)
  realmTruths.set(realmId, { assembly: built.value, documents, generation: 0 })
  return { assembly: built.value, realm: realmId }
}

interface SeamFixture {
  readonly input: PaControlLegInput
  readonly plan: EffectSetApprovalPlan
  readonly correlation: string
  readonly digest: string
}

/** The governed `read_image` effect set the incident row carried
 *  (packages/tools/fs-family/src/image-executor.mjs:157-169): tool-invoke +
 *  the path read + the attachment-store domain-ref. */
function imageEffects(realmId: string, childPath: string): unknown[] {
  return [
    { kind: 'tool-invoke', toolName: 'read_image', resource: null },
    { kind: 'read', resource: { realmId, kind: 'absolute-path', canonicalLocator: childPath, rights: ['read'] } },
    { kind: 'domain-ref', domainAuthorityId: 'attachment-store', resource: null },
  ]
}
/** The governed `ask_user_question` effect set (ask-executor.mjs:126-131):
 *  NO file-class effect — the seam must never be consulted for it. */
function askEffects(): unknown[] {
  return [
    { kind: 'tool-invoke', toolName: 'ask_user_question', resource: null },
    { kind: 'domain-ref', domainAuthorityId: 'user-interaction', resource: null },
  ]
}

function seamFixture(
  ctx: { assembly: ProductionAdmissionAssembly; realm: string },
  callId: string,
  effectsClaim: unknown[],
  toolName: string,
): SeamFixture {
  const bindingParsed = parseToolBinding({
    bindingId: `vseam-row:${callId}`,
    agentScopeKey: `vseam:${callId}`,
    toolName,
    definitionIdentity: `vseam:${callId}:${toolName}`,
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
  const effectsParsed = parseRequestedEffectSet(effectsClaim)
  if (!effectsParsed.ok) throw new Error(`effects refused: ${JSON.stringify(effectsParsed.problems)}`)
  const member = Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER })
  const request: AdmissionRequest = Object.freeze({
    binding: bindingParsed.value,
    member,
    callId,
    realmId: ctx.realm,
    parametersFingerprint: canonicalJsonFingerprint({ call: callId }),
    requestedEffects: effectsParsed.value as RequestedEffectSet,
  })
  const planned = ctx.assembly.planApproval(request)
  if (!planned.ok) throw new Error(`plan refused: ${planned.error.message}`)
  const input = Object.freeze({ realmId: ctx.realm, member, callId, request, plan: planned.value, assembly: ctx.assembly })
  const digest = canonicalJsonFingerprint(manifestBytes({ input, plan: planned.value, correlation: '', digest: '' }))
  return {
    input,
    plan: planned.value,
    correlation: paCorrelation(planned.value.approvalCaseId, callId),
    digest,
  }
}

/** The exact manifest BYTES the bridge puts on the row (mirrored from
 *  a5-m1-auth-bridge for the direct-drive legs). */
function manifestBytes(fixture: SeamFixture): Record<string, unknown> {
  const req = fixture.input.request
  const plan = fixture.plan
  const toolEffect = (req.requestedEffects as RequestedEffectSet).effects.find((e) => e.kind === 'tool-invoke')
  return JSON.parse(JSON.stringify({
    schema: PA_CONTROL_MANIFEST_SCHEMA,
    approvalCaseId: plan.approvalCaseId,
    authorityScope: {
      operationClass: 'tool-invoke',
      matcher: { kind: 'exact', resource: `${fixture.input.realmId}|tool:${String(toolEffect?.toolName ?? 'read_image')}` },
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

function resolve(caller: ActionCaller, svc: ControlService, requestId: string, decision: 'allow' | 'deny'): Promise<ControlDecisionRecord> {
  return svc.resolveControl({ rootSessionId: P6T4_ROOT, caller, requestId, decision })
}

// ── V1: the fix — subtree rule + read effect, seam threaded, both gates ──
describe('V1 (the fix): seam-threaded verifier lands the incident ask as ALLOW and consumes it (both gates)', () => {
  const ctx = seamAssembly(subtreeAskPolicy(WS), () => EMPTY_DOCS)
  seamWorlds.set(ctx.realm, () => countedSeam)
  const fixture = seamFixture(ctx, 'v1-img-call', imageEffects(ctx.realm, `${WS}/nested/bootwave-good.png`), 'read_image')
  let row: ControlRequestRecord
  let res: PaControlLegResult
  const rowsBefore = () => v1Rows.length

  it('the incident effect set MINTS (the mint side already had the seam since #508): 3 effects, required leader', () => {
    expect(fixture.plan.requiredAuthority).toBe('leader')
    expect(fixture.plan.perEffectRequired).toEqual(['leader', 'leader', 'leader'])
  })

  it('resolve(allow) → the durable row records ALLOW (decision.reason carries no drift) and the leg approves', async () => {
    const leg = makeLeg(serviceSeam)
    const pending = leg(fixture.input)
    row = await waitRow(serviceSeam, (r) => r.correlation === fixture.correlation)
    expect(row.status).toBe('pending')
    const before = rowsBefore()
    res = await (async () => {
      const record = await resolve(humanCaller(), serviceSeam, row.requestId, 'allow')
      expect(record.decision).toBe('allow')
      // §3.2 law: a drift would have REWRITTEN this row to deny+reason.
      expect(record.reason).toBeUndefined()
      return await pending
    })()
    expect(res.decision).toBe('approve')
    if (res.decision !== 'approve') return
    expect(res.requestId).toBe(row.requestId)
    expect(res.approval.reviewerAuthority).toBe('human-user')
    expect(res.approval.requiredAuthorityAtCreation).toBe('leader')
    // GATE 2 pin: the consumption fact (`control-allow-consumed`) exists.
    const st = await serviceSeam.listControlState(P6T4_ROOT)
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
    const decision = st.decisions.find((d) => d.requestId === row.requestId)
    expect(decision?.decision).toBe('allow')
    expect(decision?.reason).toBeUndefined()
    // the seam WAS consulted (the read effect hits the subtree rule)
    expect(seamCalls).toBeGreaterThan(0)
    // V1o: BOTH gates emitted a covered observation through onObserve
    const mine = v1Rows.slice(before).filter((r) => r.requestId === row.requestId)
    expect(mine.some((r) => r.stage === 'pa-verifier' && r.gate === 'resolve' && r.outcome === 'covered')).toBe(true)
    expect(mine.some((r) => r.stage === 'pa-verifier' && r.gate === 'guard' && r.outcome === 'covered')).toBe(true)
    for (const r of mine) {
      expect(r.rootSessionId).toBe(P6T4_ROOT)
      expect(r.instanceId).toBe(WORKER)
    }
  })
})

// ── V2: the dual — a deps world WITHOUT the seam still DENIES fail-closed ─
describe('V2 (the dual, fail-closed law intact): the same manifest without any seam dependency DENIES with pa-authority-drift', () => {
  const ctx = seamAssembly(subtreeAskPolicy(WS), () => EMPTY_DOCS)
  // NOTE: the realm is deliberately NOT in seamWorlds — and the verifier
  // itself has no seam entry at all: the bw7 world, reproduced offline.
  const fixture = seamFixture(ctx, 'v2-img-call', imageEffects(ctx.realm, `${WS}/nested/bootwave-good.png`), 'read_image')
  let row: ControlRequestRecord
  let res: PaControlLegResult

  it('the row mints (the mint side has the seam) — the drift is purely Control-side', () => {
    expect(fixture.plan.requiredAuthority).toBe('leader')
  })

  it('resolve(allow) → the row commits a durable DENY reason pa-authority-drift, ZERO consumption; the leg denies', async () => {
    const leg = makeLeg(serviceNoSeam)
    const pending = leg(fixture.input)
    row = await waitRow(serviceNoSeam, (r) => r.correlation === fixture.correlation)
    const before = v2Rows.length
    const record = await resolve(humanCaller(), serviceNoSeam, row.requestId, 'allow')
    // The allow ANSWER stays ok:true at the HTTP surface; the ledger truth:
    expect(record.decision).toBe('deny')
    expect(record.reason).toBe('pa-authority-drift')
    // §3.4: the drift rides the EXPANSION plane at the read effect (index 1)
    // — the undeterminable subtree coverage poisons the whole set.
    const drift = v2Rows.slice(before).find((r) => r.requestId === row.requestId && r.outcome === 'drift')
    expect(drift).not.toBeUndefined()
    expect(drift?.gate).toBe('resolve')
    expect(String(drift?.detail)).toContain('expansion plane')
    expect(String(drift?.detail)).toContain('effect 1')
    res = await pending
    expect(res.decision).toBe('deny')
    const st = await serviceNoSeam.listControlState(P6T4_ROOT)
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
  })
})

// ── VG: two gates, ONE port — the guard gate answers the same question ───
describe('VG (two gates one port): seam lost AFTER the resolve gate → guard blocks with ZERO consumption; restored → consumes ONCE', () => {
  const ctx = seamAssembly(subtreeAskPolicy(WS), () => EMPTY_DOCS)
  seamWorlds.set(ctx.realm, () => countedSeam)
  const fixture = seamFixture(ctx, 'vg-img-call', imageEffects(ctx.realm, `${WS}/nested/two-gates.png`), 'read_image')
  let row: ControlRequestRecord

  it('requestControl → resolve allow (gate 1 covered) → seam OFF → guard blocks pa-authority-drift, zero consumption → seam ON → the same allow consumes once', async () => {
    const bytes = manifestBytes(fixture)
    row = await serviceSeam.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'read_image',
      correlation: fixture.correlation,
      operationFingerprint: fixture.digest,
      reviewPayload: bytes as never,
      reviewPayloadDigest: fixture.digest,
    })
    const allowed = await resolve(humanCaller(), serviceSeam, row.requestId, 'allow')
    expect(allowed.decision).toBe('allow')
    expect(allowed.reason).toBeUndefined()
    // The mount loses its seam between the gates (simulated teardown /
    // pre-fix mount): the SAME verifier now re-derives without coverage.
    seamWorlds.delete(ctx.realm)
    const scope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'read_image',
      correlation: fixture.correlation,
      operationFingerprint: fixture.digest,
    }
    const blocked = await serviceSeam.guardOperation(scope)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed === false) expect(blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.PA_AUTHORITY_DRIFT)
    expect(blocked.requestId).toBe(row.requestId)
    const st1 = await serviceSeam.listControlState(P6T4_ROOT)
    expect(st1.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
    // restore the seam: the drift did NOT burn the one-shot allow.
    seamWorlds.set(ctx.realm, () => countedSeam)
    const ok = await serviceSeam.guardOperation(scope)
    expect(ok.allowed).toBe(true)
    const st2 = await serviceSeam.listControlState(P6T4_ROOT)
    expect(st2.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
  })
})

// ── VE: the seam reaches the APPROVAL-plane calls too, not just expansion ─
describe('VE (three pure-core calls, one seam): an envelope subtree rule is inert WITH the seam and poison WITHOUT it', () => {
  /** A `read`-class envelope rule over an ELSEWHERE root: with the seam the
   *  coverage question is answered FALSE (rule inert — nothing narrows, the
   *  positive leg runs); without it the SAME question is UNDETERMINABLE and
   *  the approval-plane re-derivation refuses the plan → drift. The policy
   *  itself carries NO file rule, so the expansion plane alone cannot be
   *  what flips this world — only the plan/verify threading can. */
  function elsewhereDocs(realmId: string): AuthorityEnvelopeDocuments {
    return {
      teamHardEnvelope: {
        rules: [{
          operationClass: 'read',
          matcher: { kind: 'subtree', resource: `${realmId}|${OUTSIDE}` },
          maximumEffect: 'ask',
        }],
      },
      permissionMutationEnvelope: { status: 'absent' as const },
    }
  }

  it('WITH the seam threaded: mint → resolve allow → approve + consumed (the not-covering subtree rule answered by the predicate)', async () => {
    const ctx = seamAssembly(DIRECT_POLICY, (realm) => elsewhereDocs(realm))
    seamWorlds.set(ctx.realm, () => countedSeam)
    const fixture = seamFixture(ctx, 've-img-seamed', imageEffects(ctx.realm, `${WS}/ok.txt`), 'read_image')
    const leg = makeLeg(serviceSeam)
    const pending = leg(fixture.input)
    const row = await waitRow(serviceSeam, (r) => r.correlation === fixture.correlation)
    const record = await resolve(humanCaller(), serviceSeam, row.requestId, 'allow')
    expect(record.decision).toBe('allow')
    expect(record.reason).toBeUndefined()
    const res = await pending
    expect(res.decision).toBe('approve')
    const st = await serviceSeam.listControlState(P6T4_ROOT)
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
  })

  it('WITHOUT any seam dependency: the same world drifts at the resolve gate (approval plane, not expansion)', async () => {
    const ctx = seamAssembly(DIRECT_POLICY, (realm) => elsewhereDocs(realm))
    // realm NOT in seamWorlds AND the service rides the seam-less verifier.
    const fixture = seamFixture(ctx, 've-img-unseamed', imageEffects(ctx.realm, `${WS}/ok.txt`), 'read_image')
    const bytes = manifestBytes(fixture)
    const row = await serviceNoSeam.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      kind: 'leader-approval',
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'read_image',
      correlation: fixture.correlation,
      operationFingerprint: fixture.digest,
      reviewPayload: bytes as never,
      reviewPayloadDigest: fixture.digest,
    })
    const record = await resolve(humanCaller(), serviceNoSeam, row.requestId, 'allow')
    expect(record.decision).toBe('deny')
    expect(record.reason).toBe('pa-authority-drift')
    const st = await serviceNoSeam.listControlState(P6T4_ROOT)
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(0)
  })
})

// ── VA: the ask path never consults the seam (zero regression) ───────────
describe('VA (ask path, zero regression): no file-class effect → the seam is never consulted, allow + consumed stand', () => {
  const ctx = seamAssembly(DIRECT_POLICY, () => EMPTY_DOCS)
  seamWorlds.set(ctx.realm, () => countedSeam)
  const fixture = seamFixture(ctx, 'va-ask-call', askEffects(), 'ask_user_question')
  let row: ControlRequestRecord
  let res: PaControlLegResult
  let callsBefore = 0

  it('resolve(allow) → approve + consumed, and the seam predicate call count did not move', async () => {
    callsBefore = seamCalls
    const leg = makeLeg(serviceSeam)
    const pending = leg(fixture.input)
    row = await waitRow(serviceSeam, (r) => r.correlation === fixture.correlation)
    const record = await resolve(humanCaller(), serviceSeam, row.requestId, 'allow')
    expect(record.decision).toBe('allow')
    expect(record.reason).toBeUndefined()
    res = await pending
    expect(res.decision).toBe('approve')
    const st = await serviceSeam.listControlState(P6T4_ROOT)
    expect(st.consumptions.filter((c) => c.requestId === row.requestId).length).toBe(1)
    expect(seamCalls).toBe(callsBefore)
  })
})

// ── P: source pins (a silently reverted wiring is the regression class) ──
describe('P (source pins): the seam arrives through the mount face end to end; the 12-field facts contract is untouched', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url).href), 'utf8')

  it('P1: the bridge threads subtreeContains into ALL THREE pure-core calls and declares the resolver entry', () => {
    const src = read('../operation-permission/pa-control-bridge.ts')
    expect(src).toContain('readonly resolveSubtreeContains?:')
    expect(src).toContain('evaluateEffectSetExpansion(facts.effects, facts.realmId, facts.policyDocument, subtreeContains)')
    // plan + verify receive it as a contract member (closed-shape call):
    const planCall = src.slice(src.indexOf('const planned = planEffectSetApproval({'))
    expect(planCall.slice(0, 1200)).toContain('subtreeContains')
    const verifyCall = src.slice(src.indexOf('const presented = verifyEffectSetApproval({'))
    expect(verifyCall.slice(0, 1600)).toContain('subtreeContains')
  })

  it('P2: root.ts composes the verifier WITH the mount-resolved seam AND onObserve (the observations channel)', () => {
    const src = read('../src/plugin/root.ts')
    const composition = src.slice(src.indexOf('createPaEffectsVerifier({'))
    expect(composition.slice(0, 3000)).toContain('resolveSubtreeContains:')
    expect(composition.slice(0, 3000)).toContain('onObserve:')
  })

  it('P3: publishPaMount carries the mount seam + the per-instance onObserve sink (same-channel law as the bridge leg)', () => {
    const src = read('../src/plugin/live/agent-bindings.mjs')
    const call = src.slice(src.indexOf('publishPaMount(String(teamRoot), String(instanceId), {'))
    expect(call.slice(0, 3000)).toContain('subtreeContains: a5PlaneValue.subtreeContains')
    expect(call.slice(0, 3000)).toContain('onObserve:')
  })

  it('P4: the plane MOUNT FACE exposes the seam it was assembled with', () => {
    const src = read('../src/plugin/live/team-tool-plane.mjs')
    // The pin lives in the RETURNED VALUE OBJECT (the mount face), not in
    // the internal call sites that already carried the expression: slice
    // from the builder's success return and require the mount member.
    const face = src.slice(src.indexOf('  return {\n    ok: true,\n    value: {'))
    expect(face.length).toBeGreaterThan(0)
    expect(face.slice(0, 4000)).toContain('a5w-vseam')
    expect(face.slice(0, 4000)).toContain('subtreeContains')
  })

  it('P5: the 12-field facts contract stays CLOSED (no seam member enters PaCallFacts); the mount entry face is open by design', () => {
    // The registry file itself is byte-FROZEN for this round (u6-pr4 E1 pins
    // its digest; the seam is documented where it ARRIVES — P2/P3/P4 pin
    // those comments). What must hold: the FACTS projection never grows a
    // seam member, and the mount record's typed face carries the extra
    // members through its open index signature, NOT a contract change.
    const src = read('../src/plugin/live/pa-mount-registry.mjs')
    // The seam is a MOUNT member, never a fact: the facts table must not
    // grow a subtreeContains key (12-field law, 9e AUTH ruling 3).
    const factsReturn = src.slice(src.indexOf('return {'), src.indexOf('THE PUBLIC CALL-LEVEL ENTRY'))
    expect(factsReturn).not.toContain('subtreeContains:')
    const face = read('../src/plugin/live/pa-mount-registry.d.mts')
    expect(face).toContain('readonly [key: string]: unknown')
    // The frozen registry answers subtree questions through NONE of its
    // twelve fact fields — the seam route is entirely mount face + root
    // composition (P2/P3), so this file needed no edit at all.
    expect(src).not.toContain('a5w-vseam')
  })
})
