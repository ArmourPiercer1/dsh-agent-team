/**
 * A4-PR3 lane A — the approval CASE identity law and the case reads (Alpha.4
 * plan Task 3 lane A; spec §11.1, §11.2, §11.4, §11.6; ADR A1-10, A1-11,
 * A1-15, A2-7, A2-9, A5-5).
 *
 * Two things are pinned here that nothing else can:
 *
 * 1. **The identity law is enforced at the writer.** §11.1 freezes the case
 *    identity as `{ approvalCaseId, subject, beneficiaryAuthority,
 *    requestedEffect, exactly one fingerprint, correlation }`, and A1-15 says
 *    an `allow` recorded without an operation fingerprint may not be consumed.
 *    The cheapest place to honour that is to never write such a row, so every
 *    refusal below is asserted to leave the ledger byte-unchanged: a refusal
 *    that wrote a half-identity row would create exactly the case A1-15
 *    forbids, and the guard would then be deciding on a corrupted identity.
 * 2. **The case reads are strict.** A2-9: an authority-bearing read never
 *    guesses. Each corrupt durable shape gets its own typed
 *    `ApprovalCaseReadProblem` — produced by writing the row RAW, because the
 *    production writer cannot produce these shapes (that is the point) and the
 *    reader must still refuse them rather than default them.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * scenarios run at module level with top-level await; `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  APPROVAL_CASE_IDENTITY_PROBLEMS,
  APPROVAL_CASE_READ_PROBLEMS,
  CONTROL_DECISION_VALUES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ApprovalCaseIdentityInput } from '../control/index.js'
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
const SUBJECT = { kind: 'instance', instanceId: WORKER_ID } as const

/** Run `fn`, capturing a throw instead of aborting the module (a module-level
 *  throw would report "no tests" and hide every other scenario). */
async function refusal(
  fn: () => Promise<unknown>,
): Promise<{ readonly threw: boolean; readonly error?: unknown; readonly value?: unknown }> {
  try {
    return { threw: false, value: await fn() }
  } catch (error) {
    return { threw: true, error }
  }
}

/** The smallest legal identity bag, overridden per case. */
function identity(overrides: Partial<ApprovalCaseIdentityInput> = {}): ApprovalCaseIdentityInput {
  return {
    subject: SUBJECT,
    beneficiaryAuthority: 'member',
    requestedEffect: 'ask',
    operationFingerprint: 'fp-a4p3-case',
    correlation: 'corr-a4p3-case',
    ...overrides,
  }
}

/** Ask for one leg through the production path. */
function legRequest(
  service: ReturnType<typeof createP6T4Service>,
  overrides: {
    readonly correlation: string
    readonly operationFingerprint?: string
    readonly mutationProposalFingerprint?: string
    readonly kind?: (typeof CONTROL_REQUEST_KINDS)[keyof typeof CONTROL_REQUEST_KINDS]
    readonly reviewAuthority?: 'member' | 'leader' | 'human-user' | 'human-admin'
    readonly identity?: ApprovalCaseIdentityInput
  },
) {
  const correlation = overrides.correlation
  return service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: overrides.kind ?? CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: overrides.reviewAuthority ?? 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity:
      overrides.identity ??
      identity({
        correlation,
        ...(overrides.operationFingerprint !== undefined
          ? { operationFingerprint: overrides.operationFingerprint }
          : {}),
        ...(overrides.mutationProposalFingerprint !== undefined
          ? {
              operationFingerprint: undefined,
              mutationProposalFingerprint: overrides.mutationProposalFingerprint,
            }
          : {}),
      }),
    actionName: 'write-file',
    toolName: 'fs.write',
    summary: 'a4p3 case leg',
    executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
  })
}

// --- the identity law at the writer ------------------------------------------------

const identityLaw = await (async () => {
  const world = await createP6T4World('a4p3-id-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const before = controlFacts(world).length
    const both = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-both',
        identity: identity({
          correlation: 'corr-both',
          operationFingerprint: 'fp-both',
          mutationProposalFingerprint: 'mp-both',
        }),
      }),
    )
    const neither = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-neither',
        identity: identity({ correlation: 'corr-neither', operationFingerprint: undefined }),
      }),
    )
    const mutationKindWithoutMutation = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-mkind',
        kind: CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION,
        identity: identity({ correlation: 'corr-mkind' }),
      }),
    )
    const operationKindWithEmptyFingerprint = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-empty',
        identity: identity({ correlation: 'corr-empty', operationFingerprint: '' }),
      }),
    )
    const unknownEffect = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-effect',
        identity: identity({ correlation: 'corr-effect', requestedEffect: 'grant-everything' as 'ask' }),
      }),
    )
    const unknownBeneficiary = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-benef',
        identity: identity({ correlation: 'corr-benef', beneficiaryAuthority: 'founder' as 'member' }),
      }),
    )
    const malformedSubject = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-subject',
        identity: identity({ correlation: 'corr-subject', subject: { kind: 'workspace' } as never }),
      }),
    )
    const offLadderReviewer = await refusal(() =>
      legRequest(service, {
        correlation: 'corr-ladder',
        reviewAuthority: 'chair' as 'leader',
      }),
    )
    const afterRefusals = controlFacts(world).length
    // The legal pair: an operation case and a mutation case.
    const operationCase = await legRequest(service, {
      correlation: 'corr-op',
      operationFingerprint: 'fp-op',
    })
    const mutationCase = await legRequest(service, {
      correlation: 'corr-mut',
      kind: CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION,
      mutationProposalFingerprint: 'mp-mut',
    })
    // A retry of the same invocation: same case, same leg, ONE row.
    const retry = await legRequest(service, { correlation: 'corr-op', operationFingerprint: 'fp-op' })
    // The same operation under another correlation is a DIFFERENT case
    // (correlation is an identity element, not metadata).
    const otherCorrelation = await legRequest(service, {
      correlation: 'corr-op-2',
      operationFingerprint: 'fp-op',
    })
    const rows = controlFacts(world, 'control-request-recorded').map(
      (entry) => entry.payload as Record<string, unknown>,
    )
    return {
      both,
      neither,
      mutationKindWithoutMutation,
      operationKindWithEmptyFingerprint,
      unknownEffect,
      unknownBeneficiary,
      malformedSubject,
      offLadderReviewer,
      before,
      afterRefusals,
      operationCase,
      mutationCase,
      retry,
      otherCorrelation,
      rows,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- the case reads: healthy, escalated, restart ------------------------------------

const healthy = await (async () => {
  const world = await createP6T4World('a4p3-case-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const created = await legRequest(service, { correlation: 'corr-healthy', operationFingerprint: 'fp-healthy' })
    if (created.kind !== 'leg') throw new Error('the healthy case must produce a leg')
    const approvalCaseId = created.leg.approvalCaseId ?? 'missing'
    const openRead = await service.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
    const openList = await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
    const foreignList = await service.listOpenApprovalCases({
      rootSessionId: P6T4_ROOT,
      subject: { kind: 'instance', instanceId: 'inst-not-in-this-team' },
    })
    const scopedList = await service.listOpenApprovalCases({
      rootSessionId: P6T4_ROOT,
      subject: SUBJECT,
    })
    // Escalate: the same case, one more leg, the acting principal recorded.
    const escalated = await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: created.leg.requestId,
      reason: 'the leader declines to decide for the member',
    })
    const risenRead = await service.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
    const openAfterEscalation = await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
    // The Human User decides: the case is terminal, so it leaves the list.
    const nextRequestId = escalated.nextLeg?.requestId ?? 'missing'
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: nextRequestId,
      decision: 'allow',
    })
    const decidedRead = await service.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
    const decidedList = await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
    // Restart the SAME durable store: the chain must reconstruct.
    const restarted = await restartP6T1World(world)
    try {
      const restartedService = createP6T4Service(restarted)
      const restartedRead = await restartedService.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId,
      })
      const retriedLeg = await legRequest(restartedService, {
        correlation: 'corr-healthy',
        operationFingerprint: 'fp-healthy',
      })
      const rowsBeforeRetry = controlFacts(restarted, 'control-request-recorded').length
      return {
        rowsBeforeRetry,
        openRead,
        openList,
        foreignList,
        scopedList,
        risenRead,
        openAfterEscalation,
        decidedRead,
        decidedList,
        restartedRead,
        retriedLeg,
        approvalCaseId,
        firstRequestId: created.leg.requestId,
        nextRequestId,
        rowsAfterRetry: controlFacts(restarted, 'control-request-recorded').length,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
  } finally {
    /* the restarted world owns the store now; destroyed above */
  }
})()

// --- the corrupt durable shapes: one typed problem each ---------------------------

/** One corrupt-shape scenario: build a real case, then break its rows raw. */
const corrupt = await (async () => {
  const world = await createP6T4World('a4p3-case-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const read = (approvalCaseId: string) =>
      service.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })

    // (a) a leg row with a case id and no legOrdinal.
    const noOrdinal = await legRequest(service, { correlation: 'corr-x1', operationFingerprint: 'fp-x1' })
    if (noOrdinal.kind !== 'leg') throw new Error('x1 needs a leg')
    const noOrdinalCase = noOrdinal.leg.approvalCaseId ?? 'missing'
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-no-ordinal',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      correlation: 'corr-x1',
      operationFingerprint: 'fp-x1',
      approvalCaseId: noOrdinalCase,
      reviewAuthority: 'leader',
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
    })

    // (b) a leg row whose review authority is off the ladder.
    const offLadder = await legRequest(service, { correlation: 'corr-x2', operationFingerprint: 'fp-x2' })
    if (offLadder.kind !== 'leg') throw new Error('x2 needs a leg')
    const offLadderCase = offLadder.leg.approvalCaseId ?? 'missing'
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-off-ladder',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      correlation: 'corr-x2',
      operationFingerprint: 'fp-x2',
      approvalCaseId: offLadderCase,
      legOrdinal: 2,
      reviewAuthority: 'chief-executive',
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
    })

    // (c) a second leg that disagrees about the frozen identity.
    const disagree = await legRequest(service, { correlation: 'corr-x3', operationFingerprint: 'fp-x3' })
    if (disagree.kind !== 'leg') throw new Error('x3 needs a leg')
    const disagreeCase = disagree.leg.approvalCaseId ?? 'missing'
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-disagree',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      correlation: 'corr-x3',
      operationFingerprint: 'fp-x3',
      approvalCaseId: disagreeCase,
      legOrdinal: 2,
      reviewAuthority: 'human-user',
      // The identity is frozen at creation (A1-10): a risen leg that reports
      // a different beneficiary is corrupt, not "the beneficiary changed".
      beneficiaryAuthority: 'leader',
      requestedEffect: 'ask',
    })

    // (d) a duplicated leg ordinal.
    const duplicate = await legRequest(service, { correlation: 'corr-x4', operationFingerprint: 'fp-x4' })
    if (duplicate.kind !== 'leg') throw new Error('x4 needs a leg')
    const duplicateCase = duplicate.leg.approvalCaseId ?? 'missing'
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-duplicate',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      correlation: 'corr-x4',
      operationFingerprint: 'fp-x4',
      approvalCaseId: duplicateCase,
      legOrdinal: 1,
      reviewAuthority: 'leader',
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
    })

    // (e) the open list must survive all four corrupt cases (it lists the
    // healthy ones instead of throwing or silently dropping everything).
    const healthyCase = await legRequest(service, { correlation: 'corr-x5', operationFingerprint: 'fp-x5' })
    if (healthyCase.kind !== 'leg') throw new Error('x5 needs a leg')
    const healthyCaseId = healthyCase.leg.approvalCaseId ?? 'missing'
    const list = await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })

    // (f) an unknown case id is `not-found`, and the guard refuses to build a
    // verdict on a corrupt case: the operation stays blocked.
    const missing = await read('case-does-not-exist')
    const guardOfCorrupt = await service.guardOperation(
      makeScope({ correlation: 'corr-x2', operationFingerprint: 'fp-x2' }),
    )

    // (g) the sharpest corrupt shape: the ONLY row of a case, unusable (no
    // legOrdinal) and carrying a durable ALLOW. A lenient reader would see a
    // current leg with an unconsumed allow and let the guard burn an approval
    // minted on a row the case read itself refuses — so the row must be
    // invisible to the guard, not merely unlistable.
    const unusableCase = 'case-a4p3-unusable-ordinal'
    const unusableSequence = await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-unusable-ordinal',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      correlation: 'corr-x6',
      operationFingerprint: 'fp-x6',
      approvalCaseId: unusableCase,
      reviewAuthority: 'leader',
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
    })
    await writeRawControlFact(world, 'control-decision-recorded', {
      requestId: 'req-raw-unusable-ordinal',
      decision: CONTROL_DECISION_VALUES.ALLOW,
      decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
      scope: {
        rootSessionId: P6T4_ROOT,
        subject: SUBJECT,
        targetInstanceId: WORKER_ID,
        actionName: 'write-file',
        correlation: 'corr-x6',
        operationFingerprint: 'fp-x6',
      },
      requestSequence: unusableSequence,
    })
    const guardOfUnusable = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      correlation: 'corr-x6',
      operationFingerprint: 'fp-x6',
    })
    const unusable = await read(unusableCase)
    const consumptionsOfUnusable = (await service.listControlState(P6T4_ROOT)).consumptions.filter(
      (row) => row.requestId === 'req-raw-unusable-ordinal',
    ).length
    return {
      unusable,
      guardOfUnusable,
      consumptionsOfUnusable,
      noOrdinal: await read(noOrdinalCase),
      offLadder: await read(offLadderCase),
      disagree: await read(disagreeCase),
      duplicate: await read(duplicateCase),
      missing,
      list,
      healthyCaseId,
      guardOfCorrupt,
      corruptCaseIds: [noOrdinalCase, offLadderCase, disagreeCase, duplicateCase],
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- the assertions ----------------------------------------------------------------

describe('the approval case identity law (spec §11.1, A1-15, A2-7)', () => {
  it('refuses a case carrying BOTH fingerprints, with zero durable side effects', () => {
    assertControlCode(identityLaw.both.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(String(identityLaw.both.error)).toContain(APPROVAL_CASE_IDENTITY_PROBLEMS.FINGERPRINT_CARDINALITY)
    expect(identityLaw.neither.threw).toBe(true)
    expect(String(identityLaw.neither.error)).toContain(
      APPROVAL_CASE_IDENTITY_PROBLEMS.FINGERPRINT_CARDINALITY,
    )
    expect(identityLaw.afterRefusals).toBe(identityLaw.before)
  })

  it('refuses a mutation-kind case with no mutation fingerprint and an operation case with an empty one', () => {
    // The mutation-kind refusal is the MORE SPECIFIC problem: a mutation case
    // missing its proposal fingerprint is reported as such, not as a generic
    // cardinality complaint (the writer knows which half is missing).
    expect(String(identityLaw.mutationKindWithoutMutation.error)).toContain(
      APPROVAL_CASE_IDENTITY_PROBLEMS.MUTATION_FINGERPRINT_REQUIRED,
    )
    expect(String(identityLaw.operationKindWithEmptyFingerprint.error)).toContain(
      APPROVAL_CASE_IDENTITY_PROBLEMS.FINGERPRINT_CARDINALITY,
    )
  })

  it('refuses every non-closed-set vocabulary value in the identity', () => {
    expect(String(identityLaw.unknownEffect.error)).toContain(
      APPROVAL_CASE_IDENTITY_PROBLEMS.EFFECT_UNKNOWN,
    )
    expect(String(identityLaw.unknownBeneficiary.error)).toContain(
      APPROVAL_CASE_IDENTITY_PROBLEMS.AUTHORITY_POSITION_UNKNOWN,
    )
    expect(String(identityLaw.malformedSubject.error)).toContain(
      APPROVAL_CASE_IDENTITY_PROBLEMS.SUBJECT_MALFORMED,
    )
    expect(assertControlCode(identityLaw.offLadderReviewer.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED))
    expect(String(identityLaw.offLadderReviewer.error)).toContain('reviewAuthority')
    expect(identityLaw.afterRefusals).toBe(identityLaw.before)
  })

  it('derives the case id from the identity and keeps the caller out of it (A2-7)', () => {
    const operation = identityLaw.operationCase
    const mutation = identityLaw.mutationCase
    if (operation.kind !== 'leg' || mutation.kind !== 'leg') {
      throw new Error(`both cases must produce legs: ${operation.kind} / ${mutation.kind}`)
    }
    expect(operation.leg.approvalCaseId).toMatch(/^case-[0-9a-z]{24}$/)
    expect(mutation.leg.approvalCaseId).toMatch(/^case-[0-9a-z]{24}$/)
    expect(operation.leg.approvalCaseId).not.toBe(mutation.leg.approvalCaseId)
    expect(operation.leg.legOrdinal).toBe(1)
    expect(operation.leg.reviewAuthority).toBe('leader')
    expect(operation.leg.beneficiaryAuthority).toBe('member')
    expect(operation.leg.requestedEffect).toBe('ask')
    expect(mutation.leg.mutationProposalFingerprint).toBe('mp-mut')
    expect(mutation.leg.operationFingerprint).toBeUndefined()
  })

  it('is idempotent per invocation and separates cases by correlation', () => {
    const retry = identityLaw.retry
    const operation = identityLaw.operationCase
    const other = identityLaw.otherCorrelation
    if (operation.kind !== 'leg' || retry.kind !== 'leg' || other.kind !== 'leg') {
      throw new Error('the retry path must produce legs')
    }
    expect(retry.leg.requestId).toBe(operation.leg.requestId)
    expect(retry.leg.approvalCaseId).toBe(operation.leg.approvalCaseId)
    expect(other.leg.approvalCaseId).not.toBe(operation.leg.approvalCaseId)
    // ONE row per invocation, even after the retry (A1-10 idempotency).
    const rowsForOp = identityLaw.rows.filter((row) => row['operationFingerprint'] === 'fp-op')
    expect(rowsForOp.length).toBe(2) // 'corr-op' and 'corr-op-2' — distinct cases
    const rowsForCorrOp = identityLaw.rows.filter((row) => row['correlation'] === 'corr-op')
    expect(rowsForCorrOp.length).toBe(1)
  })
})

describe('the approval case reads (A1-11, A2-9)', () => {
  it('reads an open case: one leg, no escalations, nothing reviewed yet', () => {
    const read = healthy.openRead
    if (read.kind !== 'case') throw new Error(`the open case must read as a case, got ${read.kind}`)
    expect(read.state.identity.approvalCaseId).toBe(healthy.approvalCaseId)
    expect(read.state.legs.map((leg) => leg.legOrdinal)).toEqual([1])
    expect(read.state.currentLeg?.requestId).toBe(healthy.firstRequestId)
    expect(read.state.status).toBe('open')
    expect(read.state.reviewedBy).toEqual([])
    expect(read.state.escalations).toEqual([])
  })

  it('lists the open case, honours the subject filter, and never lists another subject', () => {
    expect(healthy.openList.map((summary) => summary.state.identity.approvalCaseId)).toEqual([
      healthy.approvalCaseId,
    ])
    expect(healthy.openList[0]?.carrierKind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(healthy.foreignList).toEqual([])
    expect(healthy.scopedList.map((summary) => summary.state.identity.approvalCaseId)).toEqual([
      healthy.approvalCaseId,
    ])
  })

  it('carries the risen leg in the SAME case and records who already acted', () => {
    const read = healthy.risenRead
    if (read.kind !== 'case') throw new Error(`the risen case must read as a case, got ${read.kind}`)
    expect(read.state.identity.approvalCaseId).toBe(healthy.approvalCaseId)
    expect(read.state.legs.map((leg) => leg.legOrdinal)).toEqual([1, 2])
    expect(read.state.currentLeg?.legOrdinal).toBe(2)
    expect(read.state.currentLeg?.reviewAuthority).toBe('human-user')
    expect(read.state.escalations.map((row) => row.legOrdinal)).toEqual([1])
    // The durable backing of "the escalated-away reviewer cannot come back and
    // allow" (spec §11.4, ADR 24.5): the set is of PRINCIPALS. The ref's
    // optional role leaf is not pinned here — identity is kind + instanceId.
    expect(read.state.reviewedBy.length).toBe(1)
    expect(read.state.reviewedBy[0]).toMatchObject({ kind: 'instance', instanceId: LEADER_ID })
    expect(read.state.status).toBe('open')
    // A1-11: the pending list is ONE entry per case, not per leg.
    expect(healthy.openAfterEscalation.length).toBe(1)
  })

  it('leaves a decided case out of the open list but keeps it readable', () => {
    const read = healthy.decidedRead
    if (read.kind !== 'case') throw new Error(`the decided case must read as a case, got ${read.kind}`)
    expect(read.state.status).toBe('decided')
    expect(read.state.terminalDecision?.decision).toBe('allow')
    expect(healthy.decidedList).toEqual([])
  })

  it('reconstructs the whole chain from the durable rows after a restart', () => {
    const read = healthy.restartedRead
    if (read.kind !== 'case') throw new Error(`the case must survive the restart, got ${read.kind}`)
    expect(read.state.legs.map((leg) => leg.legOrdinal)).toEqual([1, 2])
    expect(read.state.escalations.length).toBe(1)
    expect(read.state.terminalDecision?.decision).toBe('allow')
    // The retry after the restart returns the CURRENT leg, never a new row.
    const retried = healthy.retriedLeg
    if (retried.kind !== 'leg') throw new Error('the retry must return a leg')
    expect(retried.leg.legOrdinal).toBe(2)
    expect(healthy.rowsAfterRetry).toBe(healthy.rowsBeforeRetry)
  })
})

describe('the corrupt durable shapes are reported, never defaulted (A2-9)', () => {
  it('names a leg row without a leg ordinal as a leg-ordinal problem', () => {
    expect(corrupt.noOrdinal.kind).toBe('problem')
    if (corrupt.noOrdinal.kind !== 'problem') return
    expect(corrupt.noOrdinal.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.LEG_ORDINAL)
    expect(corrupt.noOrdinal.approvalCaseId).toBeTruthy()
  })

  it('names an off-ladder review authority as a review-authority problem', () => {
    if (corrupt.offLadder.kind !== 'problem') {
      throw new Error(`an off-ladder leg must be a problem, got ${corrupt.offLadder.kind}`)
    }
    expect(corrupt.offLadder.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.REVIEW_AUTHORITY)
  })

  it('names two legs that disagree about the frozen identity as an identity disagreement', () => {
    if (corrupt.disagree.kind !== 'problem') {
      throw new Error(`a disagreeing leg must be a problem, got ${corrupt.disagree.kind}`)
    }
    expect(corrupt.disagree.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.IDENTITY_DISAGREEMENT)
  })

  it('names a duplicated ordinal as a broken chain', () => {
    if (corrupt.duplicate.kind !== 'problem') {
      throw new Error(`a duplicated ordinal must be a problem, got ${corrupt.duplicate.kind}`)
    }
    expect(corrupt.duplicate.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.CHAIN_BROKEN)
  })

  it('reports an unknown case as not-found', () => {
    if (corrupt.missing.kind !== 'problem') {
      throw new Error(`an unknown case must be a problem, got ${corrupt.missing.kind}`)
    }
    expect(corrupt.missing.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.NOT_FOUND)
  })

  it('lists the healthy case anyway: one corrupt case does not poison the read plane', () => {
    expect(corrupt.list.map((summary) => summary.state.identity.approvalCaseId)).toEqual([
      corrupt.healthyCaseId,
    ])
  })

  it('refuses to authorize on a row the case read refuses, even with a durable allow (A2-9)', () => {
    // The row is corrupt (no ordinal), the case names that corruption, and the
    // guard does not see the row at all: no allow, and — decisively — no
    // consumption fact, so nothing is burned on a row nobody can read.
    if (corrupt.unusable.kind !== 'problem') {
      throw new Error(`the unusable leg must be a problem, got ${corrupt.unusable.kind}`)
    }
    expect(corrupt.unusable.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.LEG_ORDINAL)
    const verdict = corrupt.guardOfUnusable
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed === true) return
    expect(verdict.reason).toBe('no-request')
    expect(corrupt.consumptionsOfUnusable).toBe(0)
  })

  it('refuses to authorize an operation whose case is corrupt', () => {
    const verdict = corrupt.guardOfCorrupt
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed === true) return
    // The corrupt leg is PENDING, so the honest verdict is that the case's
    // current leg is undecided — never an allow derived from a row the reader
    // had to reject.
    expect(verdict.reason).toBe('request-pending')
  })
})

// --- the A2-9 pin, on the ENTRANCES (fidelity review #1) -------------------------------

/** The error code a captured refusal carries, as data (so a comparison of the
 *  three entrances is one assertion over one captured set). */
function codeOfCaptured(captured: { readonly error?: unknown }): string {
  if (captured.error === undefined) return 'no-error'
  const code = (captured.error as { readonly code?: unknown }).code
  return typeof code === 'string' ? code : 'no-error'
}

/**
 * A2-9 is the law that ONE durable fact gets ONE verdict wherever it is
 * consulted — the pin above applies it to the reads, this one to the
 * entrances. Finding #1 was that law breaking in the other direction: the
 * escalate entrance refused a principal that `resolveControl` and
 * `appendTerminalOutcome` both accepted, because the case law had been written
 * into one function's body instead of into a rule all three consult. So this
 * does not re-assert the refusal (the escalation lane owns that assertion): it
 * pins that the three entrances CANNOT disagree, by driving the same principal
 * against the same risen leg at each of them and comparing the verdicts as
 * data.
 */
const entrances = await (async () => {
  const world = await createP6T4World('a4p3-case-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const outcome = await legRequest(service, {
      correlation: 'corr-a4p3-entrances',
      operationFingerprint: 'fp-x8',
    })
    const leg = outcome.kind === 'leg' ? outcome.leg : undefined
    const caseId = leg?.approvalCaseId ?? 'missing-case-id'
    await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: leg?.requestId ?? 'missing-leg',
      reason: 'above my reach',
    })
    const read = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: caseId,
    })
    const risen = read.kind === 'case' ? read.state.currentLeg : undefined
    const requestId = risen?.requestId ?? 'missing-risen-leg'
    const factsBefore = world.domain.repositories.ledger.list().length
    const decide = await refusal(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId,
        decision: 'allow',
      }),
    )
    const terminalise = await refusal(() =>
      service.appendTerminalOutcome({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId,
        terminalReason: 'resource-identity-drift',
      }),
    )
    const riseAgain = await refusal(() =>
      service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId,
        reason: 'try to rise it again',
      }),
    )
    const factsAfter = world.domain.repositories.ledger.list().length
    const guard = await service.guardOperation(
      makeScope({ correlation: 'corr-a4p3-entrances', operationFingerprint: 'fp-x8' }),
    )
    // The refusal is PERSONAL, not global: the rung the case rose to still acts.
    const byRisenReviewer = await refusal(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId,
        decision: 'allow',
      }),
    )
    return {
      leg,
      risen,
      decide,
      terminalise,
      riseAgain,
      factsBefore,
      factsAfter,
      guard,
      byRisenReviewer,
      codes: [codeOfCaptured(decide), codeOfCaptured(terminalise), codeOfCaptured(riseAgain)],
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('one durable fact, one verdict at every entrance (A2-9 across entrances)', () => {
  it('the scenario reached a risen leg to test against', () => {
    expect(entrances.leg?.approvalCaseId, 'no first leg was opened').toBeDefined()
    expect(entrances.risen?.requestId, 'the case did not rise').toBeDefined()
  })

  it('resolveControl, appendTerminalOutcome and escalateApprovalLeg agree', () => {
    const refusal1 = CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED
    expect(entrances.codes).toEqual([refusal1, refusal1, refusal1])
  })

  it('no entrance wrote anything, and the operation stayed unauthorized', () => {
    expect(entrances.factsAfter).toBe(entrances.factsBefore)
    expect(entrances.guard.allowed).toBe(false)
  })

  it('the refusal binds the principal who acted, not every principal', () => {
    expect(entrances.byRisenReviewer.threw).toBe(false)
    expect((entrances.byRisenReviewer.value as { decision: string }).decision).toBe(
      CONTROL_DECISION_VALUES.ALLOW,
    )
  })
})

// --- a corrupt case is never answered with a superseded leg (review #2, second half) ---

/**
 * The smaller collapse the fidelity review counted next to the identity one:
 * the idempotent retry of `requestApprovalLeg` reads the case to find its
 * CURRENT leg, and when that read reports a problem the code concluded "there
 * is no current leg" and handed back the leg `requestControl` had just returned
 * idempotently — the CLOSED FIRST leg of a risen case. An inline waiter
 * told to wait on a terminal row never wakes, while the case sits at another
 * authority. A2-9: the corruption is reported, not answered with a guess.
 */
const superseded = await (async () => {
  const world = await createP6T4World('a4p3-case-5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const first = await legRequest(service, { correlation: 'corr-x9', operationFingerprint: 'fp-x9' })
    const leg = first.kind === 'leg' ? first.leg : undefined
    const caseId = leg?.approvalCaseId ?? 'missing-case-id'
    await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: leg?.requestId ?? 'missing-leg',
      reason: 'above my reach',
    })
    // The case as a whole is now unreadable: one of its rows has a case id and
    // no leg ordinal, so the read reports a typed problem.
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-supersede',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-x9',
      operationFingerprint: 'fp-x9',
      approvalCaseId: caseId,
      reviewAuthority: 'leader',
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
    })
    const factsBefore = world.domain.repositories.ledger.list().length
    const retry = await refusal(() =>
      legRequest(service, { correlation: 'corr-x9', operationFingerprint: 'fp-x9' }),
    )
    const factsAfter = world.domain.repositories.ledger.list().length
    const read = await service.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId: caseId })
    return {
      caseId,
      retry,
      factsBefore,
      factsAfter,
      read,
      handedBack: retry.value as { kind?: string; leg?: { status?: string } } | undefined,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('an idempotent retry on a corrupt case refuses instead of handing back a closed leg', () => {
  it('the case is corrupt (the read names the problem the retry must not paper over)', () => {
    expect(superseded.read.kind).toBe('problem')
  })

  it('the retry is refused typed, naming that problem', () => {
    expect(superseded.retry.threw, 'the retry answered a corrupt case with a leg').toBe(true)
    assertControlCode(superseded.retry.error, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    const message = String((superseded.retry.error as { message?: string } | undefined)?.message ?? '')
    expect(message).toContain(APPROVAL_CASE_READ_PROBLEMS.LEG_ORDINAL)
  })

  it('no leg is handed back, and nothing is written', () => {
    expect(superseded.handedBack).toBeUndefined()
    expect(superseded.factsAfter).toBe(superseded.factsBefore)
  })
})

// --- one current-leg law, so the guard cannot outrun the reader -----------------------

/**
 * The file used to hold TWO rules for "which leg of a case is current" — the
 * guard's candidate filter kept the FIRST row of an equal ordinal, the case
 * read's sorted tail kept the LAST — and the duplicate-ordinal refusal is what
 * hid the difference. This is the shape where they part: a case with two rows
 * at ordinal 1, the EARLIER one carrying a durable allow. The reader refuses
 * the case (broken chain); under the first-wins rule the guard nevertheless
 * consulted the earlier row and let the operation proceed on a row nobody can
 * read. One law, one home (`currentLegOf`), so the guard cannot outrun the
 * reader (A2-9).
 */
const tieBreak = await (async () => {
  const world = await createP6T4World('a4p3-case-6', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const first = await legRequest(service, { correlation: 'corr-x10', operationFingerprint: 'fp-x10' })
    const leg = first.kind === 'leg' ? first.leg : undefined
    const caseId = leg?.approvalCaseId ?? 'missing-case-id'
    const allowed = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: leg?.requestId ?? 'missing-leg',
      decision: 'allow',
    })
    // The duplicate, LATER in the ledger, same ordinal, same scope.
    await writeRawControlFact(world, 'control-request-recorded', {
      requestId: 'req-raw-tie',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-x10',
      operationFingerprint: 'fp-x10',
      approvalCaseId: caseId,
      legOrdinal: 1,
      reviewAuthority: 'leader',
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
    })
    const read = await service.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId: caseId })
    const guard = await service.guardOperation(
      makeScope({ correlation: 'corr-x10', operationFingerprint: 'fp-x10' }),
    )
    const state = await service.listControlState(P6T4_ROOT)
    return {
      allowed,
      read,
      guard,
      consumptions: state.consumptions.filter((row) => row.requestId === leg?.requestId).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('the guard uses the case read’s current-leg law (one law, one home)', () => {
  it('the scenario really built the split: a durable allow and a broken chain', () => {
    expect(tieBreak.allowed.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    if (tieBreak.read.kind !== 'problem') {
      throw new Error('the duplicated ordinal must be a broken chain')
    }
    expect(tieBreak.read.problem).toBe(APPROVAL_CASE_READ_PROBLEMS.CHAIN_BROKEN)
  })

  it('the guard does not proceed on the row the reader refused', () => {
    expect(tieBreak.guard.allowed).toBe(false)
    if (tieBreak.guard.allowed === true) return
    expect(tieBreak.guard.reason).toBe('request-pending')
  })

  it('and it burns no approval doing so', () => {
    expect(tieBreak.consumptions).toBe(0)
  })
})
