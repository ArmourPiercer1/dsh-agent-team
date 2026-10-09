/**
 * a4-w2-rebuild-guarantees.test.ts — the REBUILD-SUCCESS JUDGEMENT, pinned as
 * tests (A4-PR7 W2 lane B, human ruling 5-B round 2026-10-09, warning-first).
 *
 * RULING 5-B decided that an UNATTRIBUTABLE corrupt approval record does not
 * block execution, and that the recovery path REUSES THE EXISTING LIFECYCLE —
 * no new recovery system. This suite pins what "the rebuild worked" means on
 * the existing public interfaces, and writes no new mechanism:
 *
 *   Case 1 (dispose semantics) — disposing a Member through the REAL lifecycle
 *     service (`packages/runtime/lifecycle/dispose.ts`, the same path the
 *     Remote `member.dispose` handler drives) moves the instance to the
 *     terminal `DISPOSED` state and LEAVES EVERY CONTROL-FACT LEDGER ROW
 *     INTACT (`Dispose: quiesce → DISPOSED terminal (历史不删除)`). The folded
 *     quota facts ride the same dispose: a DISPOSED row still occupies
 *     `maxInstances` (`packages/runtime/activation/checks.ts#countTeamQuota`
 *     — `teamTotal += 1` is unconditional; only `isActiveLifecycle` feeds
 *     `teamActive`), refused with the EXISTING code
 *     `ACTIVATION_QUOTA_TEAM_MAX_INSTANCES`.
 *
 *   Case 2 (clean dynamic overlay on the rebuilt instance) — the dynamic
 *     permission overlay lives in the durable `permission_overlays` store,
 *     keyed by `(teamSessionId, memberInstanceId)` with the highest
 *     generation as the winner (`packages/runtime/permission-governance/
 *     overlay-repository.ts:73-77` — `latest(identity)` reads through to
 *     `repository.latest(identity.teamSessionId, identity.memberInstanceId)`;
 *     the port's member set is exactly `append`/`latest`/`history` with the
 *     generation CAS at the store). A NEW member (new instanceId, new
 *     creation-request token) therefore answers `latest(...) === undefined` —
 *     that IS "the dynamic overlay state is clean"; it does NOT inherit the
 *     disposed member's overlay rows. NOTE for the reader: the blueprint's
 *     BASELINE permission layer is a DIFFERENT layer (static layers /
 *     envelopes), not overlay inheritance — "no overlay rows" must not be
 *     misread as "no permissions".
 *
 *   Case 2b (a disposed member's leg does not contaminate the rebuilt team) —
 *     member A leaves a PENDING control request; A is disposed; member B
 *     calls the same (actionName, toolName, correlation) with a DIFFERENT
 *     instance id. The service plane answers `no-request` and the TOOL PLANE
 *     (`packages/tools/src/guard.ts#consultGuard`, which maps `no-request`
 *     to proceed — the one reason it proceeds) answers `{ proceed: true }`.
 *     A positive control first proves the leg really guards its OWN scope
 *     (`request-pending` on both planes), so the proceed is not vacuous. The
 *     disposition of A's still-listed pending leg (`listControlState()`
 *     requests) is RECORDED as measured for W1, not silently re-shaped.
 *
 *   Case 3 (warnings do not vanish on rebuild) — two refused FACT_REQUEST
 *     rows are injected through the raw writer: one UNATTRIBUTABLE (discloses
 *     none of the five members → `disclosesMember: false`, the RULING 5-B
 *     class) and one ATTRIBUTABLE TO THE DISPOSED MEMBER (it writes
 *     `actionName` as a non-empty scalar AND carries A's instance subject;
 *     measured at `corruptLegDisclosesMember`, service.ts:1204-1223, a row
 *     discloses a member via ANY of the four scalar members OR a parseable
 *     subject OR a non-empty legacy `targetInstanceId` — so this row measures
 *     `disclosesMember: true`). Disposing A and rebuilding the member leaves
 *     BOTH entries in `listControlState().corruptLegs` with the SAME
 *     sequences and the SAME flags — the warning is a Team-ledger fact, and
 *     instance disposal does not clean it.
 *
 *   Case 4 (maxConcurrent is a DISPOSED-sensitive bound) — the same team, one
 *     RUNNING member: the third live activation is refused with the EXISTING
 *     `ACTIVATION_QUOTA_TEAM_MAX_CONCURRENT` (the bound bites while all rows
 *     are live, so the case-4 acceptance below is not the product of an
 *     absent bound); after disposing one member through the lifecycle
 *     service, a fresh activation is ACCEPTED — the active count dropped
 *     because of the dispose.
 *
 * NOT CLAIMED / NOT VERIFIED by this suite (see FINDINGS):
 * - the Remote `member.dispose` wire itself (owned by another lane); this
 *   suite drives the lifecycle service the handler wraps;
 * - restart-survival of any capture (single-process worlds; the durable-store
 *   restart model is pinned by the P6/P4 suites);
 * - any production composition wiring for the governance permission lane
 *   (the lane deps here are the a3p3 fixture pattern: real chain + real
 *   overlay store + noop legacy lanes);
 * - that unattributable legs SHOULD or SHOULD NOT block (RULING 5-B keeps
 *   them non-blocking and reserved to the human; `a4-corrupt-leg-guard.test
 *   .ts` W8-b/W12-c pin the execution effect — this lane pins only the
 *   survival of the WARNING across dispose+rebuild).
 *
 * Top-level-await pattern (plain-node shim): worlds are built, scenarios run,
 * observables are captured into plain snapshots, worlds are destroyed in
 * `finally`; `it` bodies assert synchronously over captured data.
 *
 * @module @dsh-agent-team/runtime/test/a4-w2-rebuild-guarantees
 */
import { describe, expect, it } from 'vitest'
import {
  createP6T4World,
  createP6T4Service,
  controlFacts,
  writeRawControlFact,
  leaderCaller,
  memberCaller,
  destroyP6T1World,
  P6T4_ROOT,
  P6T4_BLUEPRINT_SOURCE,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { makeRequest, assertActivationCode } from './p6t1-helpers.js'
import {
  P7T3Clock,
  P7T3CommitFake,
  P7T3AdmissionFake,
  P7T3ActivityFake,
  P7T3DescendantsFake,
  P7T3ResidencyFake,
} from './p7t3-helpers.js'
import { createLifecycleService } from '../lifecycle/index.js'
import type { LifecyclePorts, LifecycleService } from '../lifecycle/index.js'
import { ACTIVATION_ERROR_CODES } from '../activation/index.js'
import { CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KINDS } from '../control/index.js'
import type { ControlOperationScope } from '../control/index.js'
import { consultGuard } from '../../tools/src/index.js'
import { createGovernanceMutationService } from '../governance/index.js'
import type {
  GovernanceMutationServiceDeps,
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
} from '../governance/types.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { ActivationResult } from '../activation/types.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'

// ---------------------------------------------------------------------------
// Shared plumbing (test-side wiring over the REAL durable world — no product
// code, no new mechanism anywhere below).
// ---------------------------------------------------------------------------

/** The frozen clock of every scenario (deterministic provenance stamps). */
const W2_NOW = '2026-10-09T09:00:00Z'

/** The lifecycle service over one P6-T4 world's REAL TeamDomain, wired with
 *  the established P7-T3 commit/quiescence fakes (the same delete+re-put
 *  commit-over-real-repositories pattern the P7-T3 suites use). */
function wireLifecycle(world: P6T1World): LifecycleService {
  const clock = new P7T3Clock()
  const ports: LifecyclePorts = {
    teamDomain: world.domain,
    commit: new P7T3CommitFake(clock, world.domain),
    admission: new P7T3AdmissionFake(clock),
    activity: new P7T3ActivityFake(clock),
    descendants: new P7T3DescendantsFake(clock),
    residency: new P7T3ResidencyFake(clock),
  }
  return createLifecycleService(ports)
}

/** The team-quotas-tightened derivative of the P6-T4 blueprint (Case 1/4):
 *  ONLY the team block moves (`maxInstances 4→3`, `maxConcurrent 4→2`); the
 *  per-template `members` block and every other reviewed fixture line stay.
 *  The containment checks below fail fast if a replacement ever misses. */
const QUOTA_BLUEPRINT_SOURCE = P6T4_BLUEPRINT_SOURCE
  .replace('blueprintId: P6T4-BP', 'blueprintId: A4W2-REBUILD-BP')
  .replace('maxInstances: 4', 'maxInstances: 3')
  .replace('maxConcurrent: 4', 'maxConcurrent: 2')
if (
  !QUOTA_BLUEPRINT_SOURCE.includes('maxInstances: 3') ||
  !QUOTA_BLUEPRINT_SOURCE.includes('maxConcurrent: 2') ||
  QUOTA_BLUEPRINT_SOURCE.includes('maxInstances: 4')
) {
  throw new Error('a4-w2 quota blueprint derivative: a quota replacement did not apply')
}

/** Narrow an ActivationResult to the committed arm (fail loud otherwise). */
function activated(result: ActivationResult, label: string): { instanceId: string } {
  if (result.kind !== 'activated') {
    throw new Error(`${label}: activation did not commit (kind=${result.kind})`)
  }
  return { instanceId: String(result.instanceId) }
}

/** JSON snapshot of a ledger-row list (deep invariance across a dispose is
 *  asserted over this plain capture, never over live row objects). */
function ledgerJson(rows: readonly { sequence: number; factType: string; payload: unknown }[]): string {
  return JSON.stringify(rows.map((r) => ({ sequence: r.sequence, factType: r.factType, payload: r.payload })))
}

/** The identity fields this suite pins as UNCHANGED by a dispose. */
function identityFields(row: MemberInstanceRecordDto): string {
  return JSON.stringify({
    instanceId: String(row.instanceId),
    templateId: String(row.templateId),
    label: row.label,
    childSessionId: String(row.childSessionId),
    createdAt: row.createdAt,
  })
}

// ---------------------------------------------------------------------------
// Case 1 — dispose semantics: DISPOSED terminal, control ledger intact, and
// the folded quota facts riding the same dispose (maxInstances occupancy,
// maxConcurrent release).
// ---------------------------------------------------------------------------

const S1 = await (async () => {
  const world = await createP6T4World('a4-w2-rebuild-alloc', ['leader'], {
    blueprintSource: QUOTA_BLUEPRINT_SOURCE,
  })
  try {
    const control = createP6T4Service(world)
    const lifecycle = wireLifecycle(world)

    const a = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-alloc-a' })),
      'S1/A',
    )

    // Two attributed control facts exist BEFORE the dispose: one request row
    // and one decision row, counted with the existing helper.
    const request = await control.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(a.instanceId),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: a.instanceId,
      actionName: 'team.a4w2.deploy',
      toolName: 'bash',
      correlation: 'corr-a4-w2-alloc',
    })
    const decision = await control.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
      note: 'a4-w2 fixture decision',
    })

    const requestRowsBefore = controlFacts(world, 'control-request-recorded')
    const decisionRowsBefore = controlFacts(world, 'control-decision-recorded')
    const memberRowBefore = world.domain.repositories.memberInstances.get(P6T4_ROOT, a.instanceId)
    if (memberRowBefore === undefined) throw new Error('S1: member row vanished before dispose')
    const identityBefore = identityFields(memberRowBefore)

    // The dispose: the REAL lifecycle service, one durable commit.
    const dispose = await lifecycle.disposeMember({ rootSessionId: P6T4_ROOT, instanceId: a.instanceId })

    const requestRowsAfter = controlFacts(world, 'control-request-recorded')
    const decisionRowsAfter = controlFacts(world, 'control-decision-recorded')
    const memberRowAfter = world.domain.repositories.memberInstances.get(P6T4_ROOT, a.instanceId)
    if (memberRowAfter === undefined) throw new Error('S1: dispose DELETED the member row')

    // Quota fact A (folded): maxConcurrent released by the dispose — the
    // second live worker is admitted with A's DISPOSED row still in place
    // (without the dispose the same activation is refused CONCURRENT — that
    // contrast is Case 4's world, S1b).
    const b = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-alloc-b' })),
      'S1/B',
    )

    // Quota fact B (folded): DISPOSED still occupies maxInstances — the team
    // is at 3 committed rows (leader + DISPOSED A + B) under maxInstances=3,
    // so the NEXT activation is refused with the existing team code even
    // though only 2 rows are live.
    const writesBeforeC = world.seam.writeCount
    let cRejection: { code: string; details?: Record<string, unknown> }
    try {
      await world.provider.activate(makeRequest({ templateId: 'scribe', requestToken: 'tok-a4-w2-alloc-c' }))
      throw new Error('S1: the over-quota activation was NOT refused')
    } catch (error) {
      cRejection = assertActivationCode(error, ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_INSTANCES)
    }
    const writesAfterC = world.seam.writeCount

    return {
      aId: a.instanceId,
      bId: b.instanceId,
      requestId: request.requestId,
      decisionId: decision.requestId,
      requestCountBefore: requestRowsBefore.length,
      requestCountAfter: requestRowsAfter.length,
      decisionCountBefore: decisionRowsBefore.length,
      decisionCountAfter: decisionRowsAfter.length,
      requestRowsJsonBefore: ledgerJson(requestRowsBefore),
      requestRowsJsonAfter: ledgerJson(requestRowsAfter),
      decisionRowsJsonBefore: ledgerJson(decisionRowsBefore),
      decisionRowsJsonAfter: ledgerJson(decisionRowsAfter),
      disposeLifecycle: dispose.member.lifecycle,
      disposeLastStep: dispose.steps[dispose.steps.length - 1],
      memberRowAfterLifecycle: memberRowAfter.lifecycle,
      identityBefore,
      identityAfter: identityFields(memberRowAfter),
      cCode: cRejection.code,
      cDetails: cRejection.details,
      refusalZeroWrites: writesBeforeC === writesAfterC,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('a4-w2 Case 1: dispose is instance rebuild, not history cleanup', () => {
  it('the disposed member reaches the terminal DISPOSED state through ONE durable dispose commit', () => {
    expect(S1.disposeLifecycle).toBe('DISPOSED')
    expect(S1.memberRowAfterLifecycle).toBe('DISPOSED')
    expect(S1.disposeLastStep).toBe('commit-dispose')
  })
  it('the member row survives with its identity fields verbatim (历史不删除)', () => {
    expect(S1.identityAfter).toBe(S1.identityBefore)
  })
  it('the control-fact ledger rows survive the dispose — counts AND contents unchanged', () => {
    expect(S1.requestCountBefore).toBe(1)
    expect(S1.requestCountAfter).toBe(S1.requestCountBefore)
    expect(S1.decisionCountBefore).toBe(1)
    expect(S1.decisionCountAfter).toBe(S1.decisionCountBefore)
    expect(S1.requestRowsJsonAfter).toBe(S1.requestRowsJsonBefore)
    expect(S1.decisionRowsJsonAfter).toBe(S1.decisionRowsJsonBefore)
  })
  it('folded quota fact: a DISPOSED row still occupies maxInstances (existing team code, zero durable writes on refusal)', () => {
    expect(S1.cCode).toBe(ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_INSTANCES)
    expect(S1.cDetails).toMatchObject({ maxInstances: 3, current: 3 })
    expect(S1.refusalZeroWrites).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Case 4 — maxConcurrent is a dispose-sensitive bound: the bound bites while
// all rows are live (contrast refusal), and one dispose releases it.
// ---------------------------------------------------------------------------

const S1B = await (async () => {
  const world = await createP6T4World('a4-w2-concurrent', ['leader'], {
    blueprintSource: QUOTA_BLUEPRINT_SOURCE,
  })
  try {
    const lifecycle = wireLifecycle(world)
    const w1 = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-conc-w1' })),
      'S1b/W1',
    )
    // Contrast: leader + W1 are live and the team-wide active bound is
    // maxConcurrent=2, so the next activation (a third live row) is refused.
    // Without this leg the acceptance below could be the product of an
    // absent bound.
    let contrast: { code: string; details?: Record<string, unknown> }
    try {
      await world.provider.activate(makeRequest({ templateId: 'scout', requestToken: 'tok-a4-w2-conc-w2' }))
      throw new Error('S1b: the over-concurrency activation was NOT refused')
    } catch (error) {
      contrast = assertActivationCode(error, ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_CONCURRENT)
    }
    // The dispose: one member leaves the active set.
    const dispose = await lifecycle.disposeMember({ rootSessionId: P6T4_ROOT, instanceId: w1.instanceId })
    const w3b = activated(
      await world.provider.activate(makeRequest({ templateId: 'scribe', requestToken: 'tok-a4-w2-conc-w3b' })),
      'S1b/W3b',
    )
    return {
      contrastCode: contrast.code,
      contrastDetails: contrast.details,
      disposeLifecycle: dispose.member.lifecycle,
      acceptedAfterDispose: w3b.instanceId,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('a4-w2 Case 4: maxConcurrent counts live rows, and dispose releases it', () => {
  it('while all rows are live the bound bites (existing team CONCURRENT code)', () => {
    expect(S1B.contrastCode).toBe(ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_CONCURRENT)
    expect(S1B.contrastDetails).toMatchObject({ maxConcurrent: 2, active: 2 })
  })
  it('after disposing one member through the lifecycle path a fresh activation is accepted (active count dropped)', () => {
    expect(S1B.disposeLifecycle).toBe('DISPOSED')
    expect(typeof S1B.acceptedAfterDispose).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// Case 2 — the rebuilt member starts from a CLEAN dynamic overlay: the store
// is keyed by (teamSessionId, memberInstanceId) and answers `undefined` for
// the new identity; the disposed member's rows remain (history, not garbage).
// ---------------------------------------------------------------------------

/** The legacy (capability-plane) deps the permission lane never consults —
 *  the a3p3 fixture pattern: a consult is a bug, so it throws. */
const NEVER_CONSULTED_POLICY: PolicyReader = {
  readBlueprintEnvelope(): never {
    throw new Error('a4-w2: the permission-mutation path must not read the capability envelope')
  },
  readTemplatePolicy(): never {
    throw new Error('a4-w2: the permission-mutation path must not read template policy')
  },
  readExternalFacts(): never {
    throw new Error('a4-w2: the permission-mutation path must not read external hard facts')
  },
}

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}

class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}

class NoopTransitionCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}

function wireGovernance(overlay: PermissionOverlayRepositoryPort): ReturnType<
  typeof createGovernanceMutationService
> {
  const deps: GovernanceMutationServiceDeps = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopTransitionCommit(),
    policy: NEVER_CONSULTED_POLICY,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => W2_NOW,
    permissionLane: { overlay },
  }
  return createGovernanceMutationService(deps)
}

const W2_FILE_KEY = 'file:/srv/a4-w2-rebuild/target.txt'

const S2 = await (async () => {
  const world = await createP6T4World('a4-w2-overlay-clean', ['leader'])
  try {
    const overlay = createPermissionOverlayRepositoryPort({
      repository: world.domain.repositories.permissionOverlays,
    })
    const governance = wireGovernance(overlay)
    const lifecycle = wireLifecycle(world)

    const a = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-overlay-a' })),
      'S2/A',
    )

    // One DYNAMIC overlay grant addressed to A (the operator lane — no
    // envelope is needed for a human mutation; the Leader ceiling law is not
    // this suite's subject).
    const grant = await governance.mutatePermission({
      authority: { kind: 'operator' },
      kind: 'grant_instance',
      mutationId: 'mut-a4-w2-overlay-a',
      teamSessionId: P6T4_ROOT,
      memberInstanceId: a.instanceId,
      reason: 'a4-w2 rebuild-guarantee fixture grant',
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: W2_FILE_KEY }, effect: 'allow' }],
      expectedGeneration: 0,
    })
    const latestA = await overlay.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: a.instanceId })
    const historyABefore = await overlay.history({ teamSessionId: P6T4_ROOT, memberInstanceId: a.instanceId })

    await lifecycle.disposeMember({ rootSessionId: P6T4_ROOT, instanceId: a.instanceId })
    const b = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-overlay-b' })),
      'S2/B',
    )

    const latestB = await overlay.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: b.instanceId })
    const historyB = await overlay.history({ teamSessionId: P6T4_ROOT, memberInstanceId: b.instanceId })
    const latestAAfter = await overlay.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: a.instanceId })
    const historyAAfter = await overlay.history({ teamSessionId: P6T4_ROOT, memberInstanceId: a.instanceId })

    return {
      aId: a.instanceId,
      bId: b.instanceId,
      grantChanged: grant.changed,
      grantGeneration: grant.changed ? grant.snapshot.metadata.generation : undefined,
      grantMember: grant.changed ? String(grant.snapshot.identity.memberInstanceId) : undefined,
      grantSnapshotCarriesA: grant.changed ? String(grant.snapshot.snapshotId).includes(a.instanceId) : false,
      latestAGen: latestA?.metadata.generation,
      historyABeforeLen: historyABefore.length,
      latestB: latestB === undefined ? ('undefined' as const) : ('present' as const),
      historyBLen: historyB.length,
      latestAGenAfterRebuild: latestAAfter?.metadata.generation,
      historyAAfterLen: historyAAfter.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('a4-w2 Case 2: the rebuilt member inherits no dynamic permission overlay', () => {
  it('the disposed member had a real overlay snapshot at its own identity (the premise)', () => {
    expect(S2.grantChanged).toBe(true)
    expect(S2.grantGeneration).toBe(1)
    expect(S2.grantMember).toBe(S2.aId)
    expect(S2.grantSnapshotCarriesA).toBe(true)
    expect(S2.latestAGen).toBe(1)
    expect(S2.historyABeforeLen).toBe(1)
  })
  it('the rebuilt member (new instanceId + new creation request) answers latest === undefined and history === []', () => {
    expect(S2.bId).not.toBe(S2.aId)
    expect(S2.latestB).toBe('undefined')
    expect(S2.historyBLen).toBe(0)
  })
  it('the disposed member keeps its overlay rows untouched (history, not garbage)', () => {
    expect(S2.latestAGenAfterRebuild).toBe(1)
    expect(S2.historyAAfterLen).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Case 2b — a disposed member's pending leg does not reach the rebuilt team:
// asserted on the TOOL PLANE (the plane where `no-request` becomes proceed),
// with the service-plane verdict recorded next to it.
// ---------------------------------------------------------------------------

const W2_ACT = 'team.a4w2.scoped-action'
const W2_TOOL = 'bash'
const W2_CORR = 'corr-a4-w2-shared-scope'

const S3 = await (async () => {
  const world = await createP6T4World('a4-w2-guard-isolation', ['leader'])
  try {
    const control = createP6T4Service(world)
    const lifecycle = wireLifecycle(world)
    const a = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-guard-a' })),
      'S3/A',
    )
    const b = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-guard-b' })),
      'S3/B',
    )

    const request = await control.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(a.instanceId),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: a.instanceId,
      actionName: W2_ACT,
      toolName: W2_TOOL,
      correlation: W2_CORR,
    })

    const scope = (instanceId: string): ControlOperationScope => ({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: instanceId,
      actionName: W2_ACT,
      toolName: W2_TOOL,
      correlation: W2_CORR,
    })

    // Positive control BEFORE the dispose: the leg really guards its own
    // scope, on BOTH planes (without this, B's proceed would be vacuous).
    const selfVerdictBefore = await control.guardOperation(scope(a.instanceId))
    const selfDecisionBefore = await consultGuard(control, scope(a.instanceId))

    await lifecycle.disposeMember({ rootSessionId: P6T4_ROOT, instanceId: a.instanceId })

    // W1 observation (RECORDED, not re-shaped): does A's pending leg survive
    // in the read plane after the dispose?
    const stateAfter = await control.listControlState(P6T4_ROOT)
    const aLegStillListed = stateAfter.requests.some((r) => r.requestId === request.requestId)

    // The law: the rebuilt/other member at the same (action, tool,
    // correlation) is NOT blocked by A's leg — service plane `no-request`,
    // tool plane `proceed`.
    const bVerdict = await control.guardOperation(scope(b.instanceId))
    const bDecision = await consultGuard(control, scope(b.instanceId))

    // The disposed member's own scope after the dispose (recorded boundary):
    // the liveness check answers before any request matching.
    const aVerdictAfter = await control.guardOperation(scope(a.instanceId))
    const aDecisionAfter = await consultGuard(control, scope(a.instanceId))

    return {
      selfVerdictBefore,
      selfDecisionBefore,
      requestsCountAfterDispose: stateAfter.requests.length,
      aLegStillListed,
      bVerdict,
      bDecision,
      aVerdictAfter,
      aDecisionAfter,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('a4-w2 Case 2b: a disposed member leaves no grip on the same scope', () => {
  it('positive control — the pending leg guards its OWN scope on both planes before the dispose', () => {
    expect(S3.selfVerdictBefore.allowed).toBe(false)
    if (S3.selfVerdictBefore.allowed === true) throw new Error('positive control: expected a refusal')
    expect(S3.selfVerdictBefore.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(S3.selfDecisionBefore.proceed).toBe(false)
  })
  it('member B at the same (actionName, toolName, correlation) is not blocked by A leg — tool plane proceeds, service plane answers no-request', () => {
    expect(S3.bDecision).toEqual({ proceed: true })
    expect(S3.bVerdict.allowed).toBe(false)
    if (S3.bVerdict.allowed === true) throw new Error('B verdict: expected the no-request refusal')
    expect(S3.bVerdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
  })
  it('RECORDED (W1 observation): A pending leg remains listed in listControlState after the dispose', () => {
    expect(S3.aLegStillListed).toBe(true)
    expect(S3.requestsCountAfterDispose).toBeGreaterThanOrEqual(1)
  })
  it('RECORDED (boundary): the disposed member own scope answers target-stale on both planes', () => {
    expect(S3.aVerdictAfter.allowed).toBe(false)
    if (S3.aVerdictAfter.allowed === true) throw new Error('A-after: expected a refusal')
    expect(S3.aVerdictAfter.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    expect(S3.aDecisionAfter).toEqual({ proceed: false, reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE })
  })
})

// ---------------------------------------------------------------------------
// Case 3 — the warning does not vanish on rebuild: both corrupt-leg entries
// (unattributable + attributable-to-the-disposed-member) survive dispose +
// rebuild with identical sequences and identical disclosure flags.
// ---------------------------------------------------------------------------

const W2_DAMAGE_REQUEST_ID = 'req-a4-w2-damaged-attributable'

const S4 = await (async () => {
  const world = await createP6T4World('a4-w2-corrupt-survival', ['leader'])
  try {
    const control = createP6T4Service(world)
    const lifecycle = wireLifecycle(world)
    const a = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-corrupt-a' })),
      'S4/A',
    )

    // Row (a) — UNATTRIBUTABLE: refused by the strict reader (no requestId,
    // no kind, no requester…) AND disclosing none of the members the
    // candidacy algebra compares.
    const seqA = await writeRawControlFact(world, 'control-request-recorded', {
      summary: 'a4-w2 damaged leg — no member is readable',
    })
    // Row (b) — ATTRIBUTABLE TO MEMBER A: the strict reader refuses it (no
    // requester), while it still writes `actionName` (a non-empty scalar the
    // disclosure predicate reads — and the identity of the operation is A's)
    // AND carries A's parseable instance subject.
    const seqB = await writeRawControlFact(world, 'control-request-recorded', {
      requestId: W2_DAMAGE_REQUEST_ID,
      kind: 'leader-approval',
      subject: { kind: 'instance', instanceId: a.instanceId },
      actionName: 'team.a4w2.damaged-operation',
      toolName: W2_TOOL,
      correlation: 'corr-a4-w2-damaged',
    })

    const before = await control.listControlState(P6T4_ROOT)
    const corruptBefore = before.corruptLegs.map((c) => ({
      sequence: c.sequence,
      ...(c.requestId !== undefined ? { requestId: c.requestId } : {}),
      disclosesMember: c.disclosesMember,
    }))

    await lifecycle.disposeMember({ rootSessionId: P6T4_ROOT, instanceId: a.instanceId })
    const b = activated(
      await world.provider.activate(makeRequest({ requestToken: 'tok-a4-w2-corrupt-b' })),
      'S4/B',
    )

    const after = await control.listControlState(P6T4_ROOT)
    const corruptAfter = after.corruptLegs.map((c) => ({
      sequence: c.sequence,
      ...(c.requestId !== undefined ? { requestId: c.requestId } : {}),
      disclosesMember: c.disclosesMember,
    }))

    return {
      aId: a.instanceId,
      bId: b.instanceId,
      seqA,
      seqB,
      corruptBefore,
      corruptAfter,
      corruptRequestRowsBefore: controlFacts(world, 'control-request-recorded').length,
      corruptRequestRowsAfter: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('a4-w2 Case 3: corrupt-leg warnings do not vanish on rebuild', () => {
  it('both damaged rows are reported before the dispose, with the measured flags', () => {
    expect(S4.corruptBefore).toEqual([
      { sequence: S4.seqA, disclosesMember: false },
      { sequence: S4.seqB, requestId: W2_DAMAGE_REQUEST_ID, disclosesMember: true },
    ])
  })
  it('dispose + rebuild leaves the corruptLegs entries and their sequences UNCHANGED (and the rows in the ledger)', () => {
    expect(S4.bId).not.toBe(S4.aId)
    expect(S4.corruptAfter).toEqual(S4.corruptBefore)
    expect(S4.corruptRequestRowsBefore).toBe(2)
    expect(S4.corruptRequestRowsAfter).toBe(S4.corruptRequestRowsBefore)
  })
})
