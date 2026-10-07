/**
 * control-abandon-without-resolve-envelope.test.ts — pre-alpha3 review
 * F3: abandon is the CONTROL INTERNAL close authority — INDEPENDENT of
 * the `resolve-control` mutation envelope.
 *
 * The PR-D defect under repair: `abandonControlRequest` reused
 * `RESOLVE_CONTROL_SPEC` (the action spec + the `resolve-control`
 * envelope check), so a caller that may REQUEST a review (e.g. the
 * Recovery Leader of a reduced team envelope carrying `request-control`
 * but NOT `resolve-control`) could never ABANDON its own waiting
 * review — "request review" was possible, "wait for the human to
 * close" was the only exit. The PR-E live kit hit exactly this and
 * worked around it by granting the fixture Leader `resolve-control`.
 *
 * The fix under test (the narrow `mayAbandon` authority):
 * - human  → may abandon any request;
 * - leader → may abandon any of the current Team's requests (including
 *   the review it requested itself in the inline coupling);
 * - member → only its OWN request (the requester ref's instance id);
 * and the close path performs NO envelope check and consults NO bound
 * blueprint (no new Team tool permission or mutation op is exposed —
 * the rule is enforced inside the control service over the resolved
 * caller).
 *
 * The fixture world (deliberate): the team envelope carries
 * `request-control` but NOT `resolve-control` — and neither does the
 * worker template. This is the reduced-envelope shape the Recovery
 * Leader runs under. The human is not envelope-bound (invariant 34)
 * and is the only resolver reachable for the kinds under test.
 *
 * Scenarios:
 * S1: the Leader WITHOUT resolve-control: the request succeeds (the
 *     request-control op IS in its envelope), the SAME Leader's resolve
 *     is rejected ENVELOPE_OUT_OF_BOUNDS (the op is really absent — the
 *     PR-D gap), the aborted inline wait is durably ABANDONED by the
 *     wait bridge itself (the coupling-aware cascade — the control-
 *     INTERNAL close authority, no resolve-control op, no bound
 *     blueprint), so the Leader's explicit follow-up abandon is the
 *     exactly-once REJECTION (the terminal mark is already durable —
 *     the #42 "wait aborted → abandonControlRequest" sequence lands on
 *     the second attempt), the late human allow is rejected
 *     CONTROL_REQUEST_ABANDONED with ZERO durable effect (no decision
 *     fact, no consumption fact), the durable abandon fact is present
 *     exactly once (the terminal mark, reason `wait-aborted`), the
 *     derived request status is `abandoned`, and a SECOND explicit
 *     abandon is rejected.
 * S2: a member self-abandons its OWN pending request (no
 *     resolve-control in the envelope) — success; the liveness
 *     notification of the request was delivered (the request path's
 *     telemetry is intact next to the close authority).
 * S3: a member may NOT abandon a sibling's request
 *     (CONTROL_RESOLVER_NOT_AUTHORIZED) — and the request stays
 *     closable by its own requester afterwards.
 * S4: the human may abandon any request (the Leader's pending review).
 * S5: the allow-invalidating path + operation permission intact: a
 *     pre-abandon durable allow is closed by the self-abandon (the
 *     last-mile guard blocks the EXACT scope with request-abandoned —
 *     zero effect over the old allow, nothing consumed); a FRESH
 *     request on the same scope is still requestable, allowable and
 *     guard-executable (the abandon closed the request, not the
 *     operation's permission).
 *
 * Test pattern of this repo (the plain-node shim's `it` is
 * synchronous): every async scenario runs at MODULE level (top-level
 * await) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_ERROR_CODES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type {
  ControlAbandonmentRecord,
  ControlDecisionRecord,
  ControlGuardVerdict,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  expectRuntimeRejection,
  humanCaller,
  leaderCaller,
  memberCaller,
  type P6T4SeedName,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER2_ID = String(P6T4_SEEDS.worker2.instanceId)

/** The sleep used to let the wait bridge observe the abort (the module
 *  pattern of the wait-bridge suites). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A4-PR7 §7.4 (lane B-runtime-semantics-A): this fixture document rides the
// supported version, and the two envelope documents that version REQUIRES are
// declared — in their zero form `rules: []`, which is a POSITION: on the
// expansion plane a no-match answers `no-authority` (the document claims no
// expansion authority for its Leader), on the approval plane a no-match is
// identity (it removes no rung). The zeros are honest here rather than
// convenient: this world is built root-direct, and the only production producer
// of `permissionAuthorityCeiling` is the plugin host, so no ceiling reader ever
// consults these documents. (The same disposition covers every document below.)
/**
 * The reduced-envelope fixture: the team envelope carries
 * `request-control` but NOT `resolve-control` (and the worker template
 * carries no `resolve-control` either) — the shape where the PR-D
 * abandon defect bit (request yes / abandon no). The human is never
 * envelope-bound (invariant 34).
 */
const NOE_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 3',
  'blueprintId: CTLNOE-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the CTLNOE team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the CTLNOE work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - request-control',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The CTLNOE default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  '---',
].join('\n')

/** The reduced-envelope world (the P6-T4 world with the fixture above). */
function createNoeWorld(
  basename: string,
  seedNames: readonly P6T4SeedName[],
): Promise<P6T1World> {
  return createP6T4World(basename, seedNames, { blueprintSource: NOE_BLUEPRINT_SOURCE })
}

/**
 * Wire the control service with a RECORDING request-notification port
 * (the liveness telemetry next to the close authority) — the same port
 * family the service takes in production.
 */
function createNoeService(
  world: P6T1World,
  notifications: ControlRequestRecord[],
): ControlService {
  return createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 5,
    requestNotification: {
      async notifyLeaderRequest(request: ControlRequestRecord): Promise<void> {
        notifications.push(request)
      },
    },
  })
}

// --- scenario 1: the Leader WITHOUT resolve-control (the core F3 shape) -------------
let s1: {
  readonly resolveRejectedCode: string
  readonly waitAbortedCode: string
  readonly explicitAbandonCode: string
  readonly lateAllowCode: string
  readonly secondAbandonCode: string
  readonly abandonFacts: number
  readonly cascadeAbandonReason: string | undefined
  readonly decisionFacts: number
  readonly consumptionFacts: number
  readonly requestStatus: string
  readonly stateAbandonments: number
}
{
  const world = await createNoeWorld('ctl-noe-s1', ['leader', 'worker'])
  try {
    const service = createNoeService(world, [])
    // (1) The Leader may REQUEST (request-control IS in its envelope).
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'team', rootSessionId: P6T4_ROOT },
      actionName: 'delegate',
      toolName: 'team.delegate',
      correlation: 'corr-noe-s1',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // (2) The SAME Leader may NOT RESOLVE — the resolve-control op is
    // really absent from its envelope (the PR-D gap the close
    // authority must not inherit).
    const resolveRejected = await expectRuntimeRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    // (3) The inline wait is aborted (the recovery-dispatch abort path).
    const ac = new AbortController()
    const waitP = service.awaitControlDecision({
      rootSessionId: P6T4_ROOT,
      requestId: request.requestId,
      signal: ac.signal,
    })
    await sleep(12)
    ac.abort()
    const waitAborted = await expectControlRejection(
      () => waitP,
      CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED,
    )
    // (4) THE CASCADE (pre-alpha3 PR-D, D.4): the aborted INLINE wait
    // has already durably ABANDONED the request — the control-INTERNAL
    // close authority, no resolve-control op, no bound blueprint (the
    // Leader's own wait-abort closed its own waiting review; the PR-D
    // defect, closed). The Leader's explicit follow-up abandon is
    // therefore the exactly-once REJECTION (the terminal mark is
    // already durable — the #42 "wait aborted → abandonControlRequest"
    // sequence lands on the second attempt).
    const explicitAbandon = await expectControlRejection(
      () =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          reason: 'leader aborted its own recovery review',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    // (5) The late allow is rejected by the terminal mark.
    const late = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    // (6) The terminal mark is written exactly once (the second
    // explicit abandon is rejected too).
    const second = await expectControlRejection(
      () =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
    )
    // (7) Durable state: one abandon fact (the cascade's, reason
    // `wait-aborted`), zero decision/consumption facts, derived status
    // abandoned.
    const state = await service.listControlState(P6T4_ROOT)
    const stateAbandonments = state.abandonments.filter(
      (a) => a.requestId === request.requestId,
    )
    s1 = {
      resolveRejectedCode: resolveRejected.code,
      waitAbortedCode: waitAborted.code,
      explicitAbandonCode: explicitAbandon.code,
      lateAllowCode: late.code,
      secondAbandonCode: second.code,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      cascadeAbandonReason: stateAbandonments[0]?.reason,
      decisionFacts: controlFacts(world, 'control-decision-recorded').length,
      consumptionFacts: controlFacts(world, 'control-allow-consumed').length,
      requestStatus: state.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
      stateAbandonments: stateAbandonments.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: a member self-abandons its own request (no resolve-control) --------
let s2: {
  readonly abandonment: ControlAbandonmentRecord
  readonly notifications: number
  readonly requestStatus: string
}
{
  const world = await createNoeWorld('ctl-noe-s2', ['leader', 'worker'])
  try {
    const notifications: ControlRequestRecord[] = []
    const service = createNoeService(world, notifications)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-noe-s2',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    const abandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
      reason: 'worker aborted its own review',
    })
    const state = await service.listControlState(P6T4_ROOT)
    s2 = {
      abandonment,
      notifications: notifications.length,
      requestStatus: state.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: a member may NOT abandon a sibling's request ------------------------
let s3: {
  readonly crossRejectedCode: string
  readonly ownAbandonment: ControlAbandonmentRecord
  readonly abandonFacts: number
}
{
  const world = await createNoeWorld('ctl-noe-s3', ['leader', 'worker', 'worker2'])
  try {
    const service = createNoeService(world, [])
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER2_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER2_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-noe-s3',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // A DIFFERENT member may not abandon worker2's request.
    const crossRejected = await expectControlRejection(
      () =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          requestId: request.requestId,
        }),
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    // ...and its own requester may still close it (the request was never
    // touched by the rejected cross-abandon).
    const ownAbandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER2_ID),
      requestId: request.requestId,
    })
    s3 = {
      crossRejectedCode: crossRejected.code,
      ownAbandonment,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: the human may abandon any request -----------------------------------
let s4: {
  readonly abandonment: ControlAbandonmentRecord
  readonly requestStatus: string
}
{
  const world = await createNoeWorld('ctl-noe-s4', ['leader', 'worker'])
  try {
    const service = createNoeService(world, [])
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      subject: { kind: 'team', rootSessionId: P6T4_ROOT },
      actionName: 'delegate',
      toolName: 'team.delegate',
      correlation: 'corr-noe-s4',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    const abandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      reason: 'the human closed the waiting review',
    })
    const state = await service.listControlState(P6T4_ROOT)
    s4 = {
      abandonment,
      requestStatus: state.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: allow-invalidating close + operation permission intact --------------
let s5: {
  readonly preAbandonAllow: ControlDecisionRecord
  readonly abandonment: ControlAbandonmentRecord
  readonly verdict: { readonly allowed: boolean; readonly reason?: string }
  readonly consumptionFacts: number
  readonly freshGuard: { readonly allowed: boolean; readonly reason?: string }
}
{
  const world = await createNoeWorld('ctl-noe-s5', ['leader', 'worker'])
  try {
    const service = createNoeService(world, [])
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-noe-s5',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // The human durably allows ...
    const preAbandonAllow = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    // ... and the member self-abandons (the allow-invalidating path —
    // a DECIDED request may still be abandoned).
    const abandonment = await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
      reason: 'aborted after the human allowed',
    })
    // The EXACT scope of the old allow is blocked by the terminal mark
    // (zero effect over the durable pre-abandon allow; nothing consumed).
    const verdict = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-noe-s5',
    })
    // Captured BEFORE the fresh flow below (whose guard consumes the
    // fresh allow): the abandon closed the old allow without consuming
    // it — zero consumption facts at this point.
    const consumptionFactsAfterAbandon = controlFacts(world, 'control-allow-consumed').length
    // The operation PERMISSION is intact: a FRESH request on the same
    // scope (a new correlation = a new request) is requestable,
    // allowable and guard-executable.
    const fresh = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-noe-s5-fresh',
    })
    const freshAllow = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: fresh.requestId,
      decision: 'allow',
    })
    void freshAllow
    const freshGuard = await service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-noe-s5-fresh',
    })
    s5 = {
      preAbandonAllow,
      abandonment,
      verdict: { allowed: verdict.allowed, reason: verdict.allowed ? undefined : verdict.reason },
      consumptionFacts: consumptionFactsAfterAbandon,
      freshGuard: {
        allowed: freshGuard.allowed,
        reason: freshGuard.allowed ? undefined : freshGuard.reason,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------

describe('F3: abandon is the control-internal close authority (no resolve-control envelope)', () => {
  it('S1: the Leader WITHOUT resolve-control — request ok, resolve rejected ENVELOPE_OUT_OF_BOUNDS, the aborted inline wait durably ABANDONED itself (the control-internal close)', () => {
    // The resolve-control op is really absent from the Leader's envelope:
    // the SAME caller that may request is refused the decision ...
    expect(s1.resolveRejectedCode).toBe(TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS)
    // ... the aborted inline wait is typed CONTROL_WAIT_ABORTED ...
    expect(s1.waitAbortedCode).toBe(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED)
    // ... and the wait bridge's cascade closed the Leader's own waiting
    // review — the control-INTERNAL close authority (no resolve-control
    // op, no bound blueprint; the explicit follow-up abandon is the
    // exactly-once rejection over the cascade's terminal mark).
    expect(s1.explicitAbandonCode).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
  })

  it('S1: the cascade terminal mark — exactly once, reason wait-aborted', () => {
    expect(s1.cascadeAbandonReason).toBe('wait-aborted')
    expect(s1.abandonFacts).toBe(1)
    expect(s1.stateAbandonments).toBe(1)
  })

  it('S1: after the abandon the late allow is CONTROL_REQUEST_ABANDONED with ZERO durable effect; the mark is exactly once', () => {
    expect(s1.lateAllowCode).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(s1.secondAbandonCode).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(s1.decisionFacts).toBe(0)
    expect(s1.consumptionFacts).toBe(0)
    expect(s1.abandonFacts).toBe(1)
    expect(s1.stateAbandonments).toBe(1)
    expect(s1.requestStatus).toBe('abandoned')
  })

  it('S2: a member self-abandons its own pending request (no resolve-control) — success; the liveness notification was delivered', () => {
    expect(s2.abandonment.reason).toBe('worker aborted its own review')
    expect(s2.requestStatus).toBe('abandoned')
    expect(s2.notifications).toBe(1)
  })

  it('S3: a member may not abandon a sibling\'s request (CONTROL_RESOLVER_NOT_AUTHORIZED); its own requester may still close it', () => {
    expect(s3.crossRejectedCode).toBe(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
    expect(s3.ownAbandonment.requestId).toBeDefined()
    expect(s3.abandonFacts).toBe(1)
  })

  it('S4: the human may abandon any request (the Leader\'s pending review)', () => {
    expect(s4.abandonment.reason).toBe('the human closed the waiting review')
    expect(s4.requestStatus).toBe('abandoned')
  })

  it('S5: the pre-abandon durable allow is closed by the self-abandon (guard request-abandoned, nothing consumed) ...', () => {
    expect(s5.preAbandonAllow.decision).toBe('allow')
    expect(s5.abandonment.requestId).toBeDefined()
    expect(s5.verdict.allowed).toBe(false)
    expect(s5.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED)
    expect(s5.consumptionFacts).toBe(0)
  })

  it('S5: ... and the operation permission is intact (a fresh request on the same scope is requestable/allowable/executable)', () => {
    expect(s5.freshGuard.allowed).toBe(true)
  })
})
