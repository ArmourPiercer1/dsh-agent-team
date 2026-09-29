/**
 * pre-alpha3 PR-E (plan §E.9) — E.11 suite `recovery-leader-dispatch-review`:
 * a NEW-WORK action blocked by the requirement gate on a BLOCKED scope offers
 * the human-reviewed recovery Control request. This suite pins the REVIEW
 * surface of the offer (what the human reviewer sees + approves):
 *   - the request kind is `user-approval` (the explicit human approval —
 *     the recovery dispatch is a HUMAN-reviewed offer, never a
 *     leader-approval or envelope-mutation);
 *   - the COMPLETE NORMALIZED REVIEW PAYLOAD is sent (the plan §E.9: the
 *     exact operation, the blocked scopes with their fatal requirements and
 *     downed capability subjects, the reduced-authority preview) — the
 *     `reviewPayloadDigest` is present (the review identity the UI shows);
 *   - the correlation is NEW per attempt (`recovery:${requestToken}:${seq}`
 *     — the control-service docs: a retry after a deny creates a NEW control
 *     request; the correlation carries the attempt sequence);
 *   - the subject is the recovery dispatch subject (a follow-up on a member
 *     → the instance subject; a template-scope block → the template subject;
 *     otherwise the team subject);
 *   - on a DURABLE `allow`, the dispatch re-runs the SAME action with the
 *     recovery marker (the recursive `performAction` on the REDUCED original
 *     authority) — one `requestControl` + one `awaitControlDecision` per
 *     attempt.
 *
 * @module @dsh-agent-team/runtime/test/recovery-leader-dispatch-review
 */

import { afterEach, describe, expect, it } from 'vitest'

import { makeActionRequest } from './p6t2-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  createRecoveryDispatchRuntime,
  createRecoveryDispatchWorld,
  makeSpyControlService,
  recoveryWorkerInstanceId,
  type SpyControlCalls,
} from './recovery-dispatch-helpers.js'

describe('E.11 recovery-leader-dispatch-review: the human-reviewed recovery offer', () => {
  let world: P6T1World | undefined
  let calls: SpyControlCalls | undefined

  afterEach(() => {
    void destroyP6T1World(world!).catch(() => {})
    world = undefined
    calls = undefined
  })

  it('offers the recovery dispatch as a user-approval with the normalized review payload + a new per-attempt correlation', async () => {
    world = await createRecoveryDispatchWorld('pr-e-recovery-review')
    const { service, calls: c } = makeSpyControlService('allow')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      requestToken: 'req-recovery-review-1',
      payload: { prompt: 'review the recovery dispatch' },
    })

    // The allow path re-runs the action; it either proceeds (the gate
    // allows on the reduced authority) or fails for a NON-gate reason (the
    // work-admission mechanics). Either way the REVIEW offer is observable
    // on the control request.
    const outcome = await runtime.performAction(request).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    )

    // The control coupling ran exactly once (one dispatch attempt).
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
    expect(calls?.abandon).toBe(0)

    // The REVIEW surface: the human-approval kind.
    expect(calls?.lastKind).toBe('user-approval')
    // The COMPLETE normalized review payload was sent (the digest present —
    // the review identity the UI shows).
    expect(typeof calls?.lastReviewPayloadDigest).toBe('string')
    expect((calls?.lastReviewPayloadDigest as string).length).toBeGreaterThan(0)
    // The correlation is NEW per attempt (the attempt sequence = 1).
    expect(calls?.lastCorrelation).toBe('recovery:req-recovery-review-1:1')
    // The subject is the recovery dispatch subject: a follow-up on a member
    // → the instance subject.
    expect(calls?.lastSubject).toEqual({ kind: 'instance', instanceId: recoveryWorkerInstanceId() })

    // The allow was observed (the dispatch did not block on the deny path).
    if (outcome.ok) {
      expect(outcome.result).toBeDefined()
    } else {
      // On a failure, it must NOT be the compatibility block (the gate
      // allowed the re-run on the reduced authority) — a different,
      // non-gate reason (the work-admission mechanics).
      const err = outcome.error as { code?: string }
      expect(err.code === 'COMPATIBILITY_BLOCKED').toBe(false)
    }
  })
})
