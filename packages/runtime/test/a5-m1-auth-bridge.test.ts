/**
 * a5-m1-auth-bridge — the M1 AUTH leg: the FROZEN-A PA ⇄ Control bridge
 * (`operation-permission/pa-control-bridge.ts`) driven over the REAL durable
 * control plane (packages/runtime/control — real ControlService, real
 * TeamDomain ledger rows; NO mocked service anywhere: the pass-through
 * wrapper in the guard-refusal leg only INTERLEAVES real service calls, it
 * fabricates nothing).
 *
 * Acceptance mapping (frozen A / PR355 thin center):
 *  - positive leg (direct): the seam creates a durable `leader-approval`
 *    request row keyed by the PA case + callId correlation, carrying the
 *    STRICT manifest verbatim (all Effects, requiredAuthority,
 *    perEffectRequired, deniedEffects, effectSetFingerprint,
 *    authorityGeneration) as the lossless reviewPayload + digest; a real
 *    resolve(allow, concrete decider) settles the wait; the bridge returns
 *    {approve, requestId, approval, grant} with the grant minted through
 *    `issueApprovedGrant` AND guardOperation-consumed (one durable
 *    consumption fact);
 *  - REUSE: a second call for the SAME invocation (same case + callId)
 *    reuses the SAME requestId (idempotent scope key — no second row),
 *    lands on the PA double-mint refusal, and never spends the allow twice;
 *  - deny leg: a durable deny denies, zero consumption, zero grant;
 *  - unsettled leg: a bounded wait that expires settles `unsettled` with the
 *    row still pending — zero decision, zero mint, zero consumption;
 *  - pure verify port (createPaGuardVerifyPort): read-only over the durable
 *    state — it answers allow/pending/allow-consumed/decision-deny WITHOUT
 *    consuming (consumption count is asserted unchanged across two calls);
 *  - guard-refusal leg: with the allow consumed by a competing real
 *    guardOperation (deterministic interleave), the bridge's own guard
 *    answers `allow-consumed` and the leg DENIES — the minted grant is
 *    never handed back;
 *  - rung-rise leg: after the allow, the authority plane is re-read (the
 *    pre-execute-adapter (4c') transcription); a risen required rung makes
 *    the old decision unusable — deny with ZERO consumption (the durable
 *    allow stays exactly as written, provable through the verify port);
 *  - no-row refuse: a caller the facade refuses never gets a row, and
 *    without a row the bridge never reaches a decision or a grant (no
 *    approved-by-default).
 *  - plane integration: through `createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root', controlLeg:
 *    createPaControlLeg({ controlService }) })`, one team_bash run reaches
 *    ONE body behind a real durable approval (real landlock launcher), and
 *    one governed read run reaches its body behind its own approval; a
 *    denied second bash run stays zero-body.
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
import type { AdmissionRequest, GovernanceResult, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import {
  CONTROL_GUARD_BLOCK_REASONS,
  createControlService,
} from '../control/index.js'
import type {
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import { authorityRank } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import { createProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { EffectSetApprovalPlan } from '../tool-admission/approval-case.js'
import {
  PA_CONTROL_ACTION_NAME,
  createPaControlLeg,
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

const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
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
): Promise<void> {
  await service.resolveControl({ rootSessionId: P6T4_ROOT, caller, requestId, decision })
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

// The direct fixture: a hand-built admission request over the REAL
// production assembly (the same public edges the plane mounts).
const REALM = 'a5m1-auth-realm'
const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})

function directAssembly(documents?: () => AuthorityEnvelopeDocuments): ProductionAdmissionAssembly {
  const built = createProductionAdmissionAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId: REALM,
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
  return built.value
}

interface DirectFixture {
  readonly input: PaControlLegInput
  readonly plan: EffectSetApprovalPlan
  readonly correlation: string
}

function directFixture(assembly: ProductionAdmissionAssembly, callId: string, callerInstance = WORKER): DirectFixture {
  const bindingParsed = parseToolBinding({
    bindingId: `auth-row:${callId}`,
    agentScopeKey: `auth:${callId}`,
    toolName: 'team_bash',
    definitionIdentity: `auth:${callId}:team_bash`,
    providerId: 'a5p5-plane',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'confined-subprocess',
    assurance: untestedAssurance('team-trusted-extension', 'confined-subprocess', REALM),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  })
  if (!bindingParsed.ok) throw new Error(`binding refused: ${JSON.stringify(bindingParsed.problems)}`)
  const effectsParsed: ReturnType<typeof parseRequestedEffectSet> = parseRequestedEffectSet([
    { kind: 'tool-invoke', toolName: 'team_bash', resource: null },
  ])
  if (!effectsParsed.ok) throw new Error(`effects refused: ${JSON.stringify(effectsParsed.problems)}`)
  const member = Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: callerInstance })
  const request: AdmissionRequest = Object.freeze({
    binding: bindingParsed.value,
    member,
    callId,
    realmId: REALM,
    parametersFingerprint: canonicalJsonFingerprint({ command: `auth-${callId}` }),
    requestedEffects: effectsParsed.value as RequestedEffectSet,
  })
  const planned = assembly.planApproval(request)
  if (!planned.ok) throw new Error(`plan refused: ${planned.error.message}`)
  return {
    input: Object.freeze({ realmId: REALM, member, callId, request, plan: planned.value, assembly }),
    plan: planned.value,
    correlation: paCorrelation(planned.value.approvalCaseId, callId),
  }
}

const manifestOf = (row: ControlRequestRecord): Record<string, unknown> =>
  row.reviewPayload as Record<string, unknown>

// ── A. the bridge over the real durable control plane (direct drive) ────

describe('A1 (positive leg + reuse): durable row → real allow → minted+guard-consumed grant', () => {
  const assembly = directAssembly()
  const fixture = directFixture(assembly, 'a1-call')
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult
  let resB: PaControlLegResult

  it('creates ONE durable row for the PA case, carrying the strict manifest verbatim', async () => {
    expect(fixture.plan.requiredAuthority).toBe('leader')
    const leg = makeLeg()
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    expect(rowA.kind).toBe('leader-approval')
    expect(rowA.targetInstanceId).toBe(WORKER)
    expect(rowA.operationFingerprint).toBe(fixture.input.request.parametersFingerprint)
    expect(rowA.status).toBe('pending')
    const manifest = manifestOf(rowA)
    expect(manifest.schema).toBe('a5m1.pa-control-manifest.v1')
    expect(manifest.approvalCaseId).toBe(fixture.plan.approvalCaseId)
    expect(manifest.requiredAuthority).toBe('leader')
    expect(manifest.effectSetFingerprint).toBe(fixture.plan.effectSetFingerprint)
    expect(manifest.authorityGeneration).toBe(0)
    expect(manifest.deniedEffects).toEqual([])
    expect(manifest.perEffectRequired).toEqual(['leader'])
    expect((manifest.effects as unknown[]).length).toBe(1)
    expect(typeof rowA.reviewPayloadDigest).toBe('string')
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

  it('the pure verify port mirrors the spent allow WITHOUT touching the ledger', async () => {
    const port = createPaGuardVerifyPort({ controlService: service, rootSessionId: P6T4_ROOT })
    const probe = {
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: fixture.input.request.parametersFingerprint,
    }
    const v1 = await port.verify(probe)
    const v2 = await port.verify(probe)
    expect(v1.allowed).toBe(false)
    if (v1.allowed === false) expect(v1.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(v1).toEqual(v2)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(1)
  })
})

describe('A2 (deny leg): a durable deny denies with zero consumption and zero grant', () => {
  const assembly = directAssembly()
  const fixture = directFixture(assembly, 'a2-call')
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
    const port = createPaGuardVerifyPort({ controlService: service, rootSessionId: P6T4_ROOT })
    const v = await port.verify({
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: fixture.input.request.parametersFingerprint,
    })
    expect(v.allowed).toBe(false)
    if (v.allowed === false) expect(v.reason).toBe('decision-deny')
  })
})

describe('A3 (unsettled leg + pure-verify positive): an expired wait never decides, never mints', () => {
  const assembly = directAssembly()
  const fixture = directFixture(assembly, 'a3-call')
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
    const fixtureB = directFixture(assembly, 'a3b-call')
    const leg = makeLeg({ signal: () => aborted.signal })
    const resB = await leg(fixtureB.input)
    expect(resB.decision).toBe('unsettled')
    expect(typeof resB.requestId).toBe('string')
    const st = await state()
    expect(st.requests.filter((r) => r.correlation === fixtureB.correlation).length).toBe(1)
  })

  it('the pure verify port answers the UNCONSUMED allow WITHOUT consuming (two calls, zero side effects)', async () => {
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    const port = createPaGuardVerifyPort({ controlService: service, rootSessionId: P6T4_ROOT })
    const probe = {
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: fixture.input.request.parametersFingerprint,
    }
    const v1 = await port.verify(probe)
    const v2 = await port.verify(probe)
    expect(v1.allowed).toBe(true)
    if (!v1.allowed) return
    expect(v1.requestId).toBe(rowA.requestId)
    expect(v1.decisionSequence).toBeGreaterThan(0)
    expect(v2).toEqual(v1)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
  })
})

describe('A4 (guard-refusal leg): the consumed allow cannot be spent twice — the grant is not returned', () => {
  const assembly = directAssembly()
  const fixture = directFixture(assembly, 'a4-call')
  let resA: PaControlLegResult
  let rowA: ControlRequestRecord

  it('a competing real guardOperation consumption makes the bridge deny; zero grant leaks back', async () => {
    // The wrapper is a pure pass-through to the REAL service; the hook only
    // INTERLEAVES another REAL guardOperation at the decision point
    // (deterministic race: the allow gets consumed before the bridge
    // arrives). No fake authority exists anywhere on this path.
    const exactScope = {
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: fixture.input.request.parametersFingerprint,
    }
    let armed = true
    const hooked: PaControlServiceLike = {
      requestControl: (a) => service.requestControl(a),
      awaitControlDecision: async (i) => {
        const d = await service.awaitControlDecision(i)
        if (armed) {
          armed = false
          const verdict = await service.guardOperation(exactScope)
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

describe('A5 (rung-rise leg): a risen required rung makes the fresh allow unusable (zero consumption)', () => {
  const fixture = (() => {
    let narrowed = false
    const assembly = directAssembly(() => (narrowed
      ? {
          teamHardEnvelope: {
            rules: [{
              operationClass: 'tool-invoke',
              matcher: { kind: 'exact' as const, resource: `${REALM}|tool:team_bash` },
              maximumEffect: 'ask' as const,
            }],
          },
          permissionMutationEnvelope: { status: 'absent' as const },
        }
      : EMPTY_DOCS))
    const captured = directFixture(assembly, 'a5-call')
    return { ...captured, narrow: () => { narrowed = true } }
  })()
  let rowA: ControlRequestRecord
  let resA: PaControlLegResult

  it('after the allow the re-derived rung RISES → deny, the durable allow stays unspent', async () => {
    expect(fixture.plan.requiredAuthority).toBe('leader')
    const leg = makeLeg()
    const pending = leg(fixture.input)
    rowA = await waitRow((r) => r.correlation === fixture.correlation)
    fixture.narrow()
    await resolve(leaderCaller(), rowA.requestId, 'allow')
    resA = await pending
    expect(resA.decision).toBe('deny')
    expect(resA.requestId).toBe(rowA.requestId)
    if (resA.decision === 'deny') expect(String(resA.detail)).toMatch(/rose/)
    const st = await state()
    expect(st.consumptions.filter((c) => c.requestId === rowA.requestId).length).toBe(0)
    // The rung law lives with the bridge/kernel, NOT with the durable plane:
    // the verify port honestly reports the allow it can see as unspent.
    const port = createPaGuardVerifyPort({ controlService: service, rootSessionId: P6T4_ROOT })
    const v = await port.verify({
      targetInstanceId: WORKER,
      actionName: PA_CONTROL_ACTION_NAME,
      toolName: 'team_bash',
      correlation: fixture.correlation,
      operationFingerprint: fixture.input.request.parametersFingerprint,
    })
    expect(v.allowed).toBe(true)
    const freshPlan = fixture.input.assembly.planApproval(fixture.input.request)
    expect(freshPlan.ok).toBe(true)
    if (freshPlan.ok) {
      expect(authorityRank(freshPlan.value.requiredAuthority)).toBeGreaterThan(authorityRank('leader'))
    }
  })
})

describe('A6 (no-row refuse): a refused requestControl means no row, no decision, no grant', () => {
  it('the scribe (no request-control) never gets a row; the leg denies without a requestId', async () => {
    const assembly = directAssembly()
    const fixture = directFixture(assembly, 'a6-call')
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

function buildPlane(controlLeg: (input: PaControlLegInput) => Promise<PaControlLegResult>) {
  const built = planeRow.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
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
    expect(manifest.schema).toBe('a5m1.pa-control-manifest.v1')
    expect(String(manifest.approvalCaseId)).toMatch(/^tadm:/)
    expect((manifest.effects as unknown[]).length).toBeGreaterThan(0)
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
