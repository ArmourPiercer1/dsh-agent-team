/**
 * A4-PR3 lane A — durable approval-case ESCALATION (Alpha.4 plan Task 3,
 * lane A; ADR A1-10, A1-12, A2-1, A2-8, A3-3, A3-12, A5-5, A5-16).
 *
 * The scenario this file exists for: a reviewer who cannot decide raises the
 * case to the next rung of the ladder. Four laws carry it, and each had a
 * silent-failure mode no test in the repository could see before this file:
 *
 * 1. **The escalation terminal row is a `deny` carrying reason `escalated`**
 *    (A5-5). `parseDecisionPayload` (control/service.ts:727-730 in the plan's
 *    citation) DROPS any decision row whose `reason` is outside the closed
 *    `CONTROL_DECISION_REASON_VALUES`, so an `escalated` deny written before
 *    the vocabulary carried that value vanishes at read time: the leg looks
 *    PENDING forever, the inline waiter never settles, and nothing is red.
 *    `describe('the escalated-reason read gate')` pins that hazard using ONLY
 *    pre-PR3 production surface — first as an enumeration pin, then as a
 *    round-trip through the PRODUCTION reader and the PRODUCTION waiter
 *    (preflight no-red finding 2).
 * 2. **`escalate` is never a decision value** (A2-1, A3-3): it is a reviewer
 *    action recorded as an additive leg fact (`control-escalation-recorded`,
 *    A3-12(ii)). A row spelling it as a fourth decision value must produce
 *    ZERO guard authorization, and the guard dispatch is exhaustive with a
 *    typed refusal default (A2-1) — pinned behaviourally and structurally.
 * 3. **An escalated leg can never authorize, and the risen leg can**
 *    (A1-10: leg identity is `f(approvalCaseId, legOrdinal,
 *    previousRequestId)`; escalation never reuses the parent request id).
 * 4. **A case with no reachable reviewer terminates synchronously**
 *    (A1-12 / spec 11.6: never a fake PENDING Admin item — audit F2 makes the
 *    termination durable by writing a leg row that is born DECIDED).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * scenarios run at module level with top-level await; `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CONTROL_CASE_OUTCOMES,
  CONTROL_CASE_OUTCOME_VALUES,
  CONTROL_CASE_TERMINAL_OUTCOMES,
  CONTROL_DECISION_REASONS,
  CONTROL_DECISION_VALUES,
  CONTROL_DECISION_VALUE_VALUES,
  CONTROL_ESCALATION_SUCCESSOR,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_LEG_TERMINAL_REASON_VALUES,
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
  CONTROL_REVIEW_ACTIONS,
  CONTROL_REVIEW_ACTION_VALUES,
  CONTROL_UNRESOLVABLE_AUTHORITIES,
  hasAuthorityResolver,
  isProposalAuthorityPosition,
} from '../control/index.js'
import { CONTROL_DECISION_REASON_VALUES } from '../control/types.js'
import type {
  ApprovalCaseIdentityInput,
  ControlDecisionRecord,
  ControlLegTerminalReason,
  ControlEscalationRecord,
  ControlGuardVerdict,
  ControlRequestRecord,
} from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  assertControlCode,
  controlFacts,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
  restartP6T1World,
  writeRawControlFact,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)
const HERE = dirname(fileURLToPath(import.meta.url))

/** The service source, for the two STRUCTURAL pins in this file. A source
 *  scan is the only way to pin a shape that is unreachable by construction
 *  (the read gate drops the row before the guard could see it), and A5-16
 *  requires every guard here to assert positively — both patterns are the
 *  established one (`a4pr0a-fact-type-closed-set.test.ts`, X7-R3). */
const SERVICE_SOURCE = readFileSync(join(HERE, '../control/service.ts'), 'utf8')

/**
 * One refusal expectation captured WITHOUT aborting the module-level
 * scenario. `captureError` throws when the call under test succeeds, which
 * would kill the whole file — a production mutation must colour the
 * assertion that owns the law, not erase every later test in the suite.
 *
 * @param fn - the call expected to be refused.
 * @returns whether it threw, the error, and (when it did not) the value.
 */
async function refusal(
  fn: () => Promise<unknown>,
): Promise<{ readonly threw: boolean; readonly error?: unknown; readonly value?: unknown }> {
  try {
    return { threw: false, value: await fn() }
  } catch (error) {
    return { threw: true, error }
  }
}

/**
 * The block reason of a guard verdict, with the ALLOWED branch spelled out so
 * the closed union narrows honestly. Reading `.reason` directly is a type
 * error on the allowed arm — and a test that asserted a reason without naming
 * the allowed case would pass on a verdict that allowed for the wrong reason.
 *
 * @param verdict - the verdict the guard returned.
 * @returns the block reason, or `'ALLOWED'` when the verdict allowed.
 */
function blockReasonOf(verdict: ControlGuardVerdict): string {
  return verdict.allowed === true ? 'ALLOWED' : verdict.reason
}

/**
 * The scope snapshot a decision row carries, spelled the way the production
 * writer spells it (`scopeOf` in control/service.ts) — the raw-write tests
 * must not invent a shape the reader would reject.
 *
 * @param request - the durable request record the decision closes.
 * @returns the scope snapshot for the decision payload.
 */
function decisionScopeOf(request: ControlRequestRecord): Record<string, unknown> {
  return {
    rootSessionId: P6T4_ROOT,
    subject: request.subject,
    targetInstanceId: request.targetInstanceId ?? WORKER_ID,
    actionName: request.actionName,
    correlation: request.correlation,
    ...(request.toolName !== undefined ? { toolName: request.toolName } : {}),
    ...(request.operationFingerprint !== undefined
      ? { operationFingerprint: request.operationFingerprint }
      : {}),
  }
}

/**
 * One approval-case leg raised through the production request path.
 *
 * @param service - the control service under test.
 * @param overrides - the per-scenario overrides.
 * @returns the created leg plus the operation scope it authorizes.
 */
async function requestLeg(
  service: ReturnType<typeof createP6T4Service>,
  overrides: {
    readonly correlation: string
    readonly reviewAuthority?: 'member' | 'leader' | 'human-user' | 'human-admin'
    readonly requiredAuthorityAtCreation?: 'member' | 'leader' | 'human-user'
    readonly operationFingerprint?: string
  },
): Promise<{ readonly leg: ControlRequestRecord; readonly scope: ReturnType<typeof makeScope> }> {
  // The leg is fingerprint-bound (spec 11.1 requires exactly one
  // fingerprint), so the guard query must carry the SAME fingerprint — an
  // approval bound to one fingerprint never authorizes another.
  const operationFingerprint = overrides.operationFingerprint ?? `fp-${overrides.correlation}`
  const scope = makeScope({ correlation: overrides.correlation, operationFingerprint })
  const outcome = await service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: overrides.reviewAuthority ?? 'leader',
    requiredAuthorityAtCreation: overrides.requiredAuthorityAtCreation ?? 'leader',
    identity: {
      subject: { kind: 'instance', instanceId: WORKER_ID },
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
      operationFingerprint,
      correlation: scope.correlation,
    },
    actionName: scope.actionName,
    toolName: scope.toolName,
    summary: 'a4p3 approval leg',
  })
  if (outcome.kind !== 'leg') {
    throw new Error(`requestLeg: the case terminated synchronously (${outcome.kind})`)
  }
  return { leg: outcome.leg, scope }
}

// --- the escalated-reason read gate (RED before the vocabulary exists) -----------------

const hazard = await (async () => {
  const world = await createP6T4World('a4p3-hz-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-a4p3-hazard' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    // The escalation terminal deny, written EXACTLY as A5-5 specifies it and
    // appended raw: this is the row the escalation writer writes, and the
    // read gate is what decides whether it exists at all.
    const sequence = await writeRawControlFact(world, 'control-decision-recorded', {
      requestId: request.requestId,
      decision: CONTROL_DECISION_VALUES.DENY,
      decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
      scope: decisionScopeOf(request),
      requestSequence: request.requestSequence,
      reason: 'escalated',
      note: 'a4p3 escalated close',
    })
    const state = await service.listControlState(P6T4_ROOT)
    // The PRODUCTION waiter, bounded: if the row is invisible the poll never
    // settles, so the abort fires first and its typed rejection IS the hang
    // made observable (an unbounded wait would hang the suite instead).
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60)
    type Waiter =
      | { readonly kind: 'settled'; readonly decision: ControlDecisionRecord }
      | { readonly kind: 'never-settled'; readonly code: string }
    let waiter: Waiter
    try {
      const decision = await service.awaitControlDecision({
        rootSessionId: P6T4_ROOT,
        requestId: request.requestId,
        signal: controller.signal,
      })
      waiter = { kind: 'settled', decision }
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'unknown'
      waiter = { kind: 'never-settled', code }
    } finally {
      clearTimeout(timer)
    }
    const guard = await service.guardOperation(scope)
    return {
      sequence,
      state,
      waiter,
      guard,
      requestId: request.requestId,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('the escalated-reason read gate (A5-5, preflight no-red finding 2)', () => {
  it('the closed decision-reason vocabulary carries `escalated` beside `external-policy`', () => {
    // No test enumerated this vocabulary before PR3, and an unpinned reason
    // is not "merely undocumented" — it is a dropped row.
    expect([...CONTROL_DECISION_REASON_VALUES].sort()).toEqual(['escalated', 'external-policy'])
  })

  it('an escalated terminal deny survives the production reader', () => {
    const decision = hazard.state.decisions.find((row) => row.requestId === hazard.requestId)
    expect(decision, 'the escalated deny row must be readable').toBeDefined()
    expect(decision?.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(decision?.reason).toBe('escalated')
  })

  it('the inline waiter settles on the escalated deny instead of hanging', () => {
    expect(hazard.waiter.kind).toBe('settled')
    if (hazard.waiter.kind === 'settled') {
      expect(hazard.waiter.decision.reason).toBe('escalated')
      expect(hazard.waiter.decision.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    }
  })

  it('the escalated deny authorizes nothing at the guard', () => {
    expect((hazard.guard as ControlGuardVerdict).allowed).toBe(false)
    expect(hazard.state.consumptions).toHaveLength(0)
  })
})

// --- escalation legs -------------------------------------------------------------------

const escalation = await (async () => {
  const world = await createP6T4World('a4p3-esc-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const { leg, scope } = await requestLeg(service, { correlation: 'corr-a4p3-esc-1' })
    const before = await service.listControlState(P6T4_ROOT)
    const outcome = await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: leg.requestId,
      reason: 'the leader cannot decide for the beneficiary',
    })
    const after = await service.listControlState(P6T4_ROOT)
    const read = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: leg.approvalCaseId ?? 'missing-case-id',
    })
    const guardAfterEscalation = await service.guardOperation(scope)
    const ledgerAfterEscalation = world.domain.repositories.ledger.list().length
    // Spec 11.4 / ADR A1-10 + 24.5 — the principal who already acted on leg 1
    // has handed the case up: they may not take the risen leg (an
    // escalated-away reviewer cannot return and allow).
    const risenByOldReviewer =
      outcome.nextLeg === undefined
        ? { threw: false, value: 'no-risen-leg' as const }
        : await refusal(() =>
            service.escalateApprovalLeg({
              rootSessionId: P6T4_ROOT,
              caller: leaderCaller(),
              requestId: outcome.nextLeg?.requestId ?? '',
            }),
          )
    const ledgerAfterOldAttempt = world.domain.repositories.ledger.list().length
    // The closed leg is closed: a later allow by the SAME reviewer is refused.
    const lateResolve = await refusal(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: leg.requestId,
        decision: 'allow',
      }),
    )
    // …and the risen leg, decided by the Human User, DOES authorize the
    // operation exactly once (the guard must consult the case's CURRENT leg,
    // not the first row it finds for the scope).
    const nextLeg = outcome.nextLeg
    const allowed =
      nextLeg === undefined
        ? undefined
        : await service.resolveControl({
            rootSessionId: P6T4_ROOT,
            caller: humanCaller(),
            requestId: nextLeg.requestId,
            decision: 'allow',
          })
    const guardAfterAllow = nextLeg === undefined ? undefined : await service.guardOperation(scope)
    const guardSecond = nextLeg === undefined ? undefined : await service.guardOperation(scope)
    const stateAfterAllow = await service.listControlState(P6T4_ROOT)
    const facts = world.domain.repositories.ledger
      .list()
      .filter((entry) => entry.factType === 'control-escalation-recorded')
    // A restart reconstructs the whole chain (Task 3's restart duty; the
    // sibling p6t4-restart test covers the same shape for a decided chain).
    const restarted = await restartP6T1World(world)
    let reopened: readonly ControlRequestRecord[] = []
    let reopenedCase: typeof read = read
    try {
      const fresh = createP6T4Service(restarted)
      const state = await fresh.listControlState(P6T4_ROOT)
      reopened = state.requests.filter((r) => r.approvalCaseId !== undefined)
      reopenedCase = await fresh.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: leg.approvalCaseId ?? 'missing-case-id',
      })
    } finally {
      await destroyP6T1World(restarted)
    }
    return {
      leg,
      outcome,
      before,
      after,
      read,
      reopenedCase,
      reopened,
      guardAfterEscalation,
      guardAfterAllow: guardAfterAllow as ControlGuardVerdict,
      guardSecond,
      stateAfterAllow,
      facts,
      lateResolve,
      allowed,
      risenByOldReviewer,
      ledgerAfterEscalation,
      ledgerAfterOldAttempt,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('an escalation closes the current leg and raises the next one (A5-5, A1-10)', () => {
  it('writes exactly one control-escalation-recorded leg fact with the frozen A3-12(ii) payload', () => {
    expect(escalation.facts).toHaveLength(1)
    const payload = escalation.facts[0]?.payload as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual([
      'approvalCaseId',
      'escalatedBy',
      'legOrdinal',
      'previousRequestId',
      'reason',
    ])
    expect(payload['previousRequestId']).toBe(escalation.leg.requestId)
    expect(payload['legOrdinal']).toBe(escalation.leg.legOrdinal)
    expect(payload['approvalCaseId']).toBe(escalation.leg.approvalCaseId)
  })

  it('the DURABLE payload is five members; the DERIVED record adds exactly two (audit F12)', () => {
    // The two claims are different and both are pinned, because they were
    // previously conflated: the FROZEN WIRE payload (ADR A3-12(ii)) carries five
    // members and nothing else, while the record the service hands back adds the
    // two read-side members the payload cannot carry — the row's own ledger
    // sequence and its fact time. Pinning only "five" would let a projection
    // lose `escalationSequence` (which PR5 orders the timeline by) in silence.
    const payload = escalation.facts[0]?.payload as Record<string, unknown>
    const payloadKeys = Object.keys(payload).sort()
    expect(payloadKeys).toEqual([
      'approvalCaseId',
      'escalatedBy',
      'legOrdinal',
      'previousRequestId',
      'reason',
    ])
    expect(Object.keys(escalation.outcome.escalation).sort()).toEqual(
      [...payloadKeys, 'createdAt', 'escalationSequence'].sort(),
    )
    // And neither added member is a placeholder.
    expect(escalation.outcome.escalation.escalationSequence).toBe(escalation.facts[0]?.sequence)
    expect(escalation.outcome.escalation.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    )
  })

  it('closes the escalating leg with a deny carrying reason `escalated`', () => {
    const closing = escalation.after.decisions.find((d) => d.requestId === escalation.leg.requestId)
    expect(closing?.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(closing?.reason).toBe('escalated')
    expect(escalation.outcome.terminalDecision.decisionSequence).toBe(closing?.decisionSequence)
  })

  it('raises a NEW leg: same case, next ordinal, risen authority, never the parent id (A1-10)', () => {
    const next = escalation.outcome.nextLeg
    expect(next, 'a risen leg must exist').toBeDefined()
    expect(next?.approvalCaseId).toBe(escalation.leg.approvalCaseId)
    expect(next?.legOrdinal).toBe((escalation.leg.legOrdinal ?? 1) + 1)
    expect(next?.requestId).not.toBe(escalation.leg.requestId)
    expect(next?.previousRequestId).toBe(escalation.leg.requestId)
    expect(next?.reviewAuthority).toBe(CONTROL_ESCALATION_SUCCESSOR['leader'])
    expect(next?.status).toBe('pending')
    // The frozen case identity is CARRIED by the risen leg, never re-decided.
    expect(next?.requestedEffect).toBe(escalation.leg.requestedEffect)
    expect(next?.operationFingerprint).toBe(escalation.leg.operationFingerprint)
    expect(next?.beneficiaryAuthority).toBe(escalation.leg.beneficiaryAuthority)
    expect(next?.correlation).toBe(escalation.leg.correlation)
    // A risen leg is a risen leg: a NEW durable row, not a rewritten one.
    expect(escalation.after.requests.filter((r) => r.approvalCaseId !== undefined)).toHaveLength(2)
  })

  it('an escalated case authorizes nothing while its current leg is the closed one', () => {
    // The reason is asserted, not just the boolean: `no-request` would mean
    // the guard never found the leg at all, and the case would be passing
    // for the wrong reason. `request-pending` is the honest verdict: the
    // closed leg authorizes nothing and the CASE's current leg is the risen
    // one, which nobody has decided yet.
    const verdict = escalation.guardAfterEscalation as ControlGuardVerdict
    expect(verdict.allowed).toBe(false)
    expect(blockReasonOf(verdict)).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(escalation.after.consumptions).toHaveLength(0)
  })

  it('the risen leg decided by the risen reviewer authorizes the operation exactly once', () => {
    expect(escalation.allowed?.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect((escalation.guardAfterAllow as ControlGuardVerdict).allowed).toBe(true)
    expect(escalation.guardSecond?.allowed).toBe(false)
    expect(
      escalation.guardSecond === undefined ? 'missing' : blockReasonOf(escalation.guardSecond),
    ).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(escalation.stateAfterAllow.consumptions).toHaveLength(1)
  })

  it('the escalated-away reviewer cannot take the risen leg, with zero side effects (spec 11.4)', () => {
    assertControlCode(escalation.risenByOldReviewer.error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
    expect(escalation.ledgerAfterOldAttempt).toBe(escalation.ledgerAfterEscalation)
  })

  it('the closed leg can never be decided again (terminal legs stay terminal)', () => {
    assertControlCode(escalation.lateResolve.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED)
    expect(escalation.before.decisions).toHaveLength(0)
  })

  it('the case state reads the whole chain, and a restart reconstructs it', () => {
    expect(escalation.read.kind).toBe('case')
    if (escalation.read.kind !== 'case') return
    const state = escalation.read.state
    expect(state.legs.map((row) => row.legOrdinal)).toEqual([1, 2])
    expect(state.escalations).toHaveLength(1)
    const escalationRow = state.escalations[0] as ControlEscalationRecord
    expect(escalationRow.previousRequestId).toBe(escalation.leg.requestId)
    expect(state.identity.approvalCaseId).toBe(escalation.leg.approvalCaseId)
    // The escalated-away reviewer is in the case's acted-on set (24.5).
    expect(state.reviewedBy).toHaveLength(1)
    // A fresh service over the reopened store sees the same chain.
    expect(escalation.reopenedCase.kind).toBe('case')
    if (escalation.reopenedCase.kind === 'case') {
      expect(escalation.reopenedCase.state.legs.map((row) => row.legOrdinal)).toEqual([1, 2])
      expect(escalation.reopenedCase.state.escalations).toHaveLength(1)
    }
    expect(escalation.reopened).toHaveLength(2)
  })
})

// --- refusals, top-of-ladder, and the A1-12 synchronous close --------------------------

const refusals = await (async () => {
  const world = await createP6T4World('a4p3-esc-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const decided = await requestLeg(service, { correlation: 'corr-a4p3-refuse-1' })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: decided.leg.requestId,
      decision: 'deny',
    })
    const factsBefore = world.domain.repositories.ledger.list().length
    const afterDecided = await refusal(() =>
      service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: decided.leg.requestId,
      }),
    )
    const factsAfter = world.domain.repositories.ledger.list().length
    // An abandoned leg is closed: escalating it would fabricate a new
    // reviewer for a request the caller already gave up on.
    const abandoned = await requestLeg(service, { correlation: 'corr-a4p3-abandon' })
    await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: abandoned.leg.requestId,
      reason: 'the caller gave up',
    })
    const ledgerBeforeAbandonedEscalate = world.domain.repositories.ledger.list().length
    const escalateAbandoned = await refusal(() =>
      service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: abandoned.leg.requestId,
      }),
    )
    const ledgerAfterAbandonedEscalate = world.domain.repositories.ledger.list().length
    // The close is reported BEFORE the authority question (the same ordering
    // `resolveControl` documents for an abandoned request): a caller who is
    // not even a resolver still learns that the leg is abandoned, and the
    // abandon verdict can never be masked by a role error.
    const escalateAbandonedByOutsider = await refusal(() =>
      service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        requestId: abandoned.leg.requestId,
      }),
    )
    // A legacy row (no case identity) has no case to rise.
    const legacy = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'instance.message.send',
      toolName: 'team_send_message',
      correlation: 'corr-a4p3-legacy-escalate',
    })
    const legacyEscalate = await refusal(() =>
      service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: legacy.requestId,
      }),
    )
    // A leg at the top rung cannot be written at all (A1-12).
    let noAdminCaseId = 'unknown-case'
    const noAdminLeg = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'human-admin',
      requiredAuthorityAtCreation: 'human-admin',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4p3-noadmin',
        correlation: 'corr-a4p3-noadmin',
      },
      actionName: 'instance.message.send',
      toolName: 'team_send_message',
    })
    if (noAdminLeg.kind !== 'leg') noAdminCaseId = noAdminLeg.approvalCaseId
    const caseRows = world.domain.repositories.ledger.list()
    // A Human-User leg CAN be written, and escalating it has nowhere to rise.
    const topLeg = await requestLeg(service, {
      correlation: 'corr-a4p3-top',
      reviewAuthority: 'human-user',
      requiredAuthorityAtCreation: 'human-user',
    })
    const risesToAdmin = await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: topLeg.leg.requestId,
    })
    // With NO risen leg the case's current leg IS the escalated one, so the
    // guard must report the `escalated` deny (the exact row A5-5 writes) —
    // never `request-pending`, which would mean a phantom open leg.
    const guardAfterTop = await service.guardOperation(topLeg.scope)
    const consumptionsAfterTop = (await service.listControlState(P6T4_ROOT)).consumptions.length
    const stateAfterTop = await service.listControlState(P6T4_ROOT)
    const topCaseId = topLeg.leg.approvalCaseId ?? 'unknown-case'
    const pendingTopCase = stateAfterTop.requests.filter(
      (row) => row.status === 'pending' && row.approvalCaseId === topCaseId,
    ).length
    // An identity that breaks the exactly-one-fingerprint rule is refused.
    const badIdentity = await refusal(() =>
      service.requestApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        reviewAuthority: 'leader',
        requiredAuthorityAtCreation: 'leader',
        identity: {
          subject: { kind: 'instance', instanceId: WORKER_ID },
          beneficiaryAuthority: 'member',
          requestedEffect: 'ask',
          correlation: 'corr-a4p3-bad-identity',
        },
        actionName: 'instance.message.send',
        toolName: 'team_send_message',
      }),
    )
    return {
      decided,
      afterDecided,
      factsBefore,
      factsAfter,
      legacyEscalate,
      escalateAbandoned,
      escalateAbandonedByOutsider,
      ledgerDeltaAbandoned: ledgerAfterAbandonedEscalate - ledgerBeforeAbandonedEscalate,
      noAdminLeg,
      caseRows: caseRows.filter((entry) => (entry.payload as { approvalCaseId?: string }).approvalCaseId === noAdminCaseId).length,
      risesToAdmin,
      guardAfterTop: guardAfterTop as ControlGuardVerdict,
      consumptionsAfterTop,
      pendingAfterTop: pendingTopCase,
      pendingTotal: stateAfterTop.requests.filter((r) => r.status === 'pending').length,
      badIdentity,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('escalation refuses what it must and terminates what cannot be reviewed', () => {
  it('refuses to escalate a terminal leg, with zero durable side effects', () => {
    assertControlCode(refusals.afterDecided.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED)
    expect(refusals.factsAfter).toBe(refusals.factsBefore)
  })

  it('refuses to escalate an abandoned leg, with zero durable side effects', () => {
    assertControlCode(refusals.escalateAbandoned.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(refusals.ledgerDeltaAbandoned).toBe(0)
  })

  it('an abandoned leg reports the abandon even to a caller who is not a resolver', () => {
    assertControlCode(refusals.escalateAbandonedByOutsider.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
  })

  it('refuses to escalate a pre-Alpha.4 row (no case to rise)', () => {
    assertControlCode(refusals.legacyEscalate.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
  })

  it('refuses an identity without exactly one fingerprint (spec 11.1, A1-15)', () => {
    assertControlCode(refusals.badIdentity.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
  })

  it('a leg whose reviewer cannot exist terminates synchronously, durably and never pending (A1-12)', () => {
    expect(refusals.noAdminLeg.kind).toBe(CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE)
    // A1-12 REDEFINED by audit F2: "zero leg rows" was an unobservable
    // termination. The close now writes a leg row that is BORN TERMINAL plus its
    // terminal deny, so the case is auditable and awaitable; 21.10's actual
    // prohibition — never a PENDING Admin item — is pinned on the next line.
    expect(refusals.caseRows).toBe(1)
    expect(CONTROL_UNRESOLVABLE_AUTHORITIES).toEqual(['human-admin'])
  })

  it('a rise to Human Admin writes the closing leg only and reports authority-unavailable (spec 11.6)', () => {
    expect(refusals.risesToAdmin.nextLeg).toBeUndefined()
    expect(refusals.risesToAdmin.caseOutcome).toBe(CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE)
    expect(refusals.pendingAfterTop).toBe(0)
    expect(refusals.consumptionsAfterTop).toBe(0)
    // The escalated deny is what the guard reports — the terminal row is
    // readable, and it denies (A5-5 and the read gate above).
    expect(refusals.guardAfterTop.allowed).toBe(false)
    expect(blockReasonOf(refusals.guardAfterTop)).toBe(CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY)
  })
})

// --- escalate is never a decision value (A2-1) -----------------------------------------

const foreign = await (async () => {
  const world = await createP6T4World('a4p3-esc-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-a4p3-foreign' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    // A durable row spelling `escalate` as if it were a decision value — the
    // exact corruption A2-1 forbids, injected at the only input where it can
    // exist (the read gate drops it: that IS the other half of the law, and
    // the guard's refusal default is the third).
    await writeRawControlFact(world, 'control-decision-recorded', {
      requestId: request.requestId,
      decision: 'escalate',
      decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
      scope: decisionScopeOf(request),
      requestSequence: request.requestSequence,
    })
    const verdict = await service.guardOperation(scope)
    const after = await service.listControlState(P6T4_ROOT)
    return { verdict, after, request }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('escalate is never an authorization value (A2-1, A3-3)', () => {
  it('`escalate` is a reviewer action and is absent from the decision vocabulary', () => {
    expect([...CONTROL_REVIEW_ACTION_VALUES].sort()).toEqual(['allow', 'deny', 'escalate'])
    expect(CONTROL_DECISION_VALUE_VALUES).not.toContain(CONTROL_REVIEW_ACTIONS.ESCALATE)
    expect(CONTROL_DECISION_VALUE_VALUES).toEqual(['allow', 'deny', 'stale-denied'])
  })

  it('a durable row carrying `escalate` as its decision authorizes nothing', () => {
    expect((foreign.verdict as ControlGuardVerdict).allowed).toBe(false)
    expect(foreign.after.consumptions).toHaveLength(0)
  })

  it('the production reader drops the row outright (the first of the three gates)', () => {
    // Pinned directly: relaxing `parseDecisionPayload`'s value gate would
    // widen the durable decision vocabulary for EVERY consumer, and the
    // guard's refusal default alone would quietly absorb the difference.
    expect(foreign.after.decisions.some((d) => d.requestId === foreign.request.requestId)).toBe(false)
  })

  it('the guard decision dispatch is exhaustive with a typed refusal default', () => {
    // The structural half of A2-1: the shape that made an unknown decision
    // value an IMPLICIT approval was `if stale-denied / if deny`, a comment
    // and a fall-through. A `switch` with a refusing `default` is what the
    // mutation proof flips (deleting the default re-colours this leg).
    expect(SERVICE_SOURCE).toMatch(/switch \(decision\.payload\.decision\) \{/)
    expect(SERVICE_SOURCE).toMatch(
      /default: \{\s*return \{\s*allowed: false,\s*reason: CONTROL_GUARD_BLOCK_REASONS\.DECISION_UNRECOGNIZED/,
    )
  })
})

// --- the terminal outcome an operation ends with (A2-8) ---------------------------------

const terminal = await (async () => {
  const world = await createP6T4World('a4p3-esc-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const { leg, scope } = await requestLeg(service, { correlation: 'corr-a4p3-terminal' })
    const close = await service.appendTerminalOutcome({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: leg.requestId,
      terminalReason: 'resolver-unavailable',
      note: 'the reviewer identity disappeared',
    })
    const verdict = await service.guardOperation(scope)
    const state = await service.listControlState(P6T4_ROOT)
    const consumptions = state.consumptions.length
    const second = await refusal(() =>
      service.appendTerminalOutcome({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: leg.requestId,
        terminalReason: 'authority-drift',
      }),
    )
    const outsideVocabulary = await refusal(() =>
      service.appendTerminalOutcome({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: leg.requestId,
        terminalReason: 'i-decided-so' as 'authority-drift',
      }),
    )
    // Deliberately driven from the MEMBERSHIP list (the closed vocabulary as
    // the reader sees it) rather than the typed keys, so the mapping is proven
    // total over the published list and not over a narrowed copy of it.
    const values = CONTROL_LEG_TERMINAL_REASON_VALUES.map((reason) =>
      service.terminalDecisionValueFor(reason as ControlLegTerminalReason),
    )
    return { close, verdict, consumptions, second, outsideVocabulary, values, state }
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- the closed vocabularies this lane freezes -----------------------------------------

// --- the durable zero-review case and the identity lookup (audit F2 / F3) -------------
//
// A case that can produce no REVIEWABLE leg still has to leave a durable
// trace, or the termination is unobservable: `appendTerminalOutcome` needs a
// requestId to close, the open-case list skips rows with no case identity, and
// Task 4 lane C's "record the case terminal outcome" would have nothing to
// call (audit F2). The close writes a leg row that is BORN terminal (it is
// never open for review, so acceptance 21.10's "no fake pending Admin request"
// still holds) plus its terminal deny, in one transaction.
//
// `findApprovalCaseByIdentity` is the other half: a case is identified by its
// frozen identity (A2-7: derived, never caller-chosen), and a DECIDED case is
// invisible to the only list, so without a lookup a second implementer cannot
// get from a fingerprint to the case that owns it (audit F3).
const zeroLeg = await (async () => {
  const world = await createP6T4World('a4p3-zeroleg-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const identityOf = (tag: string): ApprovalCaseIdentityInput => ({
      subject: { kind: 'instance', instanceId: WORKER_ID },
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
      operationFingerprint: `fp-a4p3-zeroleg-${tag}`,
      correlation: `corr-a4p3-zeroleg-${tag}`,
    })
    const adminIdentity = identityOf('admin')
    const adminScope = makeScope({
      correlation: adminIdentity.correlation,
      operationFingerprint: adminIdentity.operationFingerprint ?? 'fp',
    })
    // (1) the A1-12 path itself: a case whose reviewer cannot exist.
    const adminLeg = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'human-admin',
      requiredAuthorityAtCreation: 'human-admin',
      identity: adminIdentity,
      actionName: adminScope.actionName,
      toolName: adminScope.toolName,
    })
    const adminCaseId =
      adminLeg.kind === 'leg' ? 'unexpected-leg' : adminLeg.approvalCaseId
    const adminRead = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: adminCaseId,
    })
    const adminGuard = await service.guardOperation(adminScope)
    const adminRows = {
      requests: controlFacts(world, 'control-request-recorded').length,
      decisions: controlFacts(world, 'control-decision-recorded').length,
    }
    const pendingAfterAdmin = (await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT }))
      .length
    // (2) the public close, on a case that was never opened at all.
    const closeIdentity = identityOf('close')
    const closeScope = makeScope({
      correlation: closeIdentity.correlation,
      operationFingerprint: closeIdentity.operationFingerprint ?? 'fp',
    })
    const closeArgs = {
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      identity: closeIdentity,
      carrier: {
        kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        reviewAuthority: 'human-admin' as const,
        actionName: closeScope.actionName,
        toolName: closeScope.toolName,
      },
      terminalReason: 'resolver-unavailable' as const,
      note: 'the admission plane found no resolver for the required rung',
    }
    const closed = await service.closeApprovalCaseWithoutLeg(closeArgs)
    const retry = await service.closeApprovalCaseWithoutLeg(closeArgs)
    const closedRead = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: closed.approvalCaseId,
    })
    const closedGuard = await service.guardOperation(closeScope)
    const rowsAfterClose = {
      requests: controlFacts(world, 'control-request-recorded').length,
      decisions: controlFacts(world, 'control-decision-recorded').length,
    }
    const pendingAfterClose = (await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT }))
      .length
    // An OPEN case: a reviewable leg belongs to `appendTerminalOutcome`, so the
    // zero-review close must refuse it rather than preempt a reviewer.
    const openIdentity = identityOf('open')
    const openScope = makeScope({
      correlation: openIdentity.correlation,
      operationFingerprint: openIdentity.operationFingerprint ?? 'fp',
    })
    const openCase = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: openIdentity,
      actionName: openScope.actionName,
      toolName: openScope.toolName,
    })
    const openCaseId = openCase.kind === 'leg' ? (openCase.leg.approvalCaseId ?? 'missing') : 'missing'
    // (3) who may close, and what a close may never do.
    const memberAttempt = await refusal(() =>
      service.closeApprovalCaseWithoutLeg({
        ...closeArgs,
        identity: identityOf('member'),
        caller: memberCaller(WORKER_ID),
      }),
    )
    const openCaseAttempt = await refusal(() =>
      service.closeApprovalCaseWithoutLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        approvalCaseId: openCaseId,
        terminalReason: 'resolver-unavailable',
      }),
    )
    // Closing an already-closed case BY ID is the same durable event.
    const byId = await service.closeApprovalCaseWithoutLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      approvalCaseId: closed.approvalCaseId,
      terminalReason: 'resolver-unavailable',
    })
    const missingCaseAttempt = await refusal(() =>
      service.closeApprovalCaseWithoutLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        approvalCaseId: 'case-never-opened',
        terminalReason: 'resolver-unavailable',
      }),
    )
    // (4) the identity lookup, including a case the list cannot see.
    const found = await service.findApprovalCaseByIdentity({
      rootSessionId: P6T4_ROOT,
      identity: adminIdentity,
    })
    const absent = await service.findApprovalCaseByIdentity({
      rootSessionId: P6T4_ROOT,
      identity: identityOf('never-opened'),
    })
    return {
      adminLeg,
      adminCaseId,
      adminRead,
      adminGuard,
      adminRows,
      pendingAfterAdmin,
      closed,
      retry,
      closedRead,
      closedGuard,
      rowsAfterClose,
      pendingAfterClose,
      memberAttempt,
      openCaseAttempt,
      byId,
      missingCaseAttempt,
      found,
      absent,
      adminIdentity,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('a case with no reviewable leg is still durable and still authorizes nothing (audit F2)', () => {
  it('the A1-12 path leaves a readable case and nothing pending', () => {
    expect(zeroLeg.adminLeg.kind).toBe(CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE)
    // The termination is OBSERVABLE: the case reads back, it does not vanish.
    expect(zeroLeg.adminRead.kind).toBe('case')
    if (zeroLeg.adminRead.kind !== 'case') return
    expect(zeroLeg.adminRead.state.status).toBe('decided')
    expect(zeroLeg.adminRead.state.legs.length).toBe(1)
    // Born terminal: one leg row and its terminal deny, written together.
    expect(zeroLeg.adminRows).toEqual({ requests: 1, decisions: 1 })
    // 21.10: never a pending Admin item, and the deny authorizes nothing.
    expect(zeroLeg.pendingAfterAdmin).toBe(0)
    expect((zeroLeg.adminGuard as ControlGuardVerdict).allowed).toBe(false)
    expect(blockReasonOf(zeroLeg.adminGuard as ControlGuardVerdict)).toBe(
      CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY,
    )
  })

  it('the public close writes one case, is idempotent, and never authorizes', () => {
    expect(zeroLeg.closed.terminalDecision.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(zeroLeg.closed.terminalDecision.terminalReason).toBe('resolver-unavailable')
    // The retry is the same durable event, not a second row.
    expect(zeroLeg.retry.terminalDecision.decisionSequence).toBe(
      zeroLeg.closed.terminalDecision.decisionSequence,
    )
    expect(zeroLeg.rowsAfterClose).toEqual({ requests: 2, decisions: 2 })
    expect(zeroLeg.pendingAfterClose).toBe(0)
    expect(zeroLeg.closedRead.kind).toBe('case')
    // A close can only ever DENY, so it can never be consumed as an allow.
    expect((zeroLeg.closedGuard as ControlGuardVerdict).allowed).toBe(false)
  })

  it('a member cannot close somebody else\'s case, and an open leg is appendTerminalOutcome\'s', () => {
    assertControlCode(
      zeroLeg.memberAttempt.error,
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    // No new error code exists in the frozen table for "wrong entry point for
    // this case", and `control/errors.ts` is not this lane\'s file: the refusal
    // is MALFORMED with the rule named in its detail (disclosed deviation).
    assertControlCode(
      zeroLeg.openCaseAttempt.error,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    assertControlCode(
      zeroLeg.missingCaseAttempt.error,
      CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
    )
    // Closing a closed case by id is the same event, not a second row.
    expect(zeroLeg.byId.terminalDecision.decisionSequence).toBe(
      zeroLeg.closed.terminalDecision.decisionSequence,
    )
    expect(zeroLeg.byId.approvalCaseId).toBe(zeroLeg.closed.approvalCaseId)
  })
})

describe('a case is found by its frozen identity, decided or not (audit F3)', () => {
  it('a terminated case is reachable from the identity that produced it', () => {
    expect(zeroLeg.found).toEqual({ kind: 'found', approvalCaseId: zeroLeg.adminCaseId })
  })

  it('an identity that never produced a case is reported as absent, not guessed', () => {
    expect(zeroLeg.absent.kind).toBe('none')
  })
})

describe('the frozen PR3 leg vocabularies (A2-8, A5-16)', () => {
  it('the terminal-reason vocabulary is closed and adds no new status or decision value', () => {
    expect([...CONTROL_LEG_TERMINAL_REASON_VALUES].sort()).toEqual([
      'authority-drift',
      'resolver-unavailable',
      'resource-identity-drift',
    ])
  })

  it('the escalation successor table is exhaustive over the ladder and never re-spells it', () => {
    expect(CONTROL_ESCALATION_SUCCESSOR).toEqual({
      member: 'leader',
      leader: 'human-user',
      'human-user': 'human-admin',
      'human-admin': null,
    })
    expect(isProposalAuthorityPosition('human-user')).toBe(true)
    expect(isProposalAuthorityPosition('owner')).toBe(false)
    expect(isProposalAuthorityPosition(undefined)).toBe(false)
  })

  it('every terminal reason maps to a deny — a close cannot mint authority (A2-8)', () => {
    expect(terminal.values).toEqual(
      CONTROL_LEG_TERMINAL_REASON_VALUES.map(() => CONTROL_DECISION_VALUES.DENY),
    )
    expect(terminal.values).not.toContain(CONTROL_DECISION_VALUES.ALLOW)
  })

  it('a terminal outcome round-trips through the production reader with its reason', () => {
    const row = terminal.state.decisions.find((d) => d.requestId === terminal.close.requestId)
    expect(row, 'the terminal row must survive the read gate').toBeDefined()
    expect(row?.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(row?.terminalReason).toBe('resolver-unavailable')
    expect(terminal.close.terminalReason).toBe('resolver-unavailable')
  })

  it('a terminal outcome authorizes nothing and is written at most once', () => {
    expect((terminal.verdict as ControlGuardVerdict).allowed).toBe(false)
    expect(terminal.consumptions).toBe(0)
    assertControlCode(terminal.second.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED)
  })

  it('a terminalReason outside the closed set is refused, not stored', () => {
    assertControlCode(terminal.outsideVocabulary.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
  })

  it('`escalated` is a frozen CASE OUTCOME, and every terminal outcome is one (audit F7)', () => {
    // One vocabulary feeds the caller-visible `caseOutcome` and the terminal
    // table, so a second implementer switches on names instead of literals.
    expect(CONTROL_CASE_OUTCOME_VALUES).toEqual(['escalated', 'authority-unavailable'])
    expect(CONTROL_CASE_OUTCOMES.AUTHORITY_UNAVAILABLE).toBe(
      CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE,
    )
    for (const outcome of Object.values(CONTROL_CASE_TERMINAL_OUTCOMES)) {
      expect(CONTROL_CASE_OUTCOME_VALUES).toContain(outcome)
    }
    // And the A2-1 boundary holds: a case outcome is not a decision value.
    expect(CONTROL_DECISION_VALUE_VALUES).not.toContain(CONTROL_CASE_OUTCOMES.ESCALATED)
  })

  it('the escalated reason is a decision REASON, and the ladder names come from the owner', () => {
    expect(CONTROL_DECISION_REASONS.ESCALATED).toBe('escalated')
    expect(CONTROL_DECISION_VALUE_VALUES).not.toContain('escalated')
    expect(CONTROL_ESCALATION_SUCCESSOR['human-user']).toBe('human-admin')
    expect(hasAuthorityResolver('human-admin')).toBe(false)
    expect(hasAuthorityResolver('leader')).toBe(true)
  })
})
