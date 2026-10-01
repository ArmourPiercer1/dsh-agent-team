/**
 * fix-control-authz B (P1) — the REAL-chain regression for the
 * approval-payload / execution-snapshot inconsistency.
 *
 * The defect (target-design §11.2/§11.3: the review payload carries the
 * COMPLETE normalized invocation and the UI + execution share ONE frozen
 * object): the router's recovery dispatch built a review payload that
 * DROPPED the work content (`payload.prompt` / `attachedContext`, the
 * message recipient+body, `requestToken`, `execution`, the delegation
 * identity) and — after a durable `allow` — re-ran the ORIGINAL mutable
 * request instead of the reviewed snapshot: a mutation of
 * `request.payload.prompt` while the approval was pending would be the
 * payload that actually executes, and the review digest was blind to the
 * work content (two work items differing only in the prompt hashed
 * identically).
 *
 * What this proves (the finding's repro, over the REAL ControlService +
 * REAL router — the full work-chain wiring, the recording delivery port
 * is the model-visible delivery seam):
 *   S1: the durable inline request FULLY represents the workDelivery
 *       (distinctive prompt + attachedContext in the review payload,
 *       requestToken / subject / root, the digest consistent with the
 *       durable payload);
 *   S2: changing ONLY the prompt changes the digest (digest sensitivity
 *       to the work content — the old payloads hashed identically);
 *   S3: mutating `request.payload.prompt` while the approval is pending
 *       → execution uses the reviewed immutable snapshot (the delivery
 *       port receives the ORIGINAL prompt; the mutated payload is never
 *       executed).
 *
 * @module @dsh-agent-team/runtime/test/fix-control-authz-b-frozen-snapshot
 */

import { afterEach, describe, expect, it } from 'vitest'

import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import { canonicalJsonStringify } from '../../contracts/src/index.js'
import { sha256Hex } from '../../domain/blueprint/src/index.js'
import {
  AUTHZ_ROOT,
  AUTHZ_WORKER,
  authzFacts,
  authzFollowUp,
  authzHumanCaller,
  createAuthzWorld,
  destroyAuthzWorld,
  sleep,
  waitForControlRequests,
  withTimeout,
  type AuthzWorld,
} from './fix-control-authz-helpers.js'

const DISTINCTIVE_PROMPT = 'B-repro prompt — distinctive work instruction (original)'
const DISTINCTIVE_CONTEXT = 'B-repro attached context (original)'
const MUTATED_PROMPT = 'B-MUTATED-DURING-WAIT — must never be executed'

let world: AuthzWorld | undefined

afterEach(async () => {
  if (world !== undefined) {
    await destroyAuthzWorld(world)
  }
  world = undefined
})

describe('fix-control-authz B — the frozen review snapshot is the single source', () => {
  it('S1+S2: the durable row fully represents the workDelivery; a prompt-only change changes the digest; deny ⇒ zero effect', async () => {
    world = await createAuthzWorld('authz-b-1')
    // --- attempt 1 (the distinctive work content) -------------------------
    const promise1 = withTimeout(
      world.runtime.performAction(
        authzFollowUp({
          requestToken: 'tok-b-1',
          payload: { prompt: DISTINCTIVE_PROMPT, attachedContext: DISTINCTIVE_CONTEXT },
        }),
      ),
      20_000,
      'the recovery follow-up attempt 1',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const state1 = await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'attempt-1 row')
    const row1 = state1.requests.find((r) => String(r.correlation).startsWith('recovery:tok-b-1:'))
    expect(row1).toBeDefined()
    expect(row1?.executionCoupling).toBe('inline')
    expect(row1?.status).toBe('pending')

    // The review payload FULLY represents the workDelivery (spec §11.3:
    // the complete normalized invocation the UI shows and the execution
    // uses).
    const payload1 = (row1?.reviewPayload ?? {}) as Record<string, unknown>
    expect(payload1['rootSessionId']).toBe(AUTHZ_ROOT)
    expect(payload1['requestToken']).toBe('tok-b-1')
    expect(payload1['action']).toBe('follow-up')
    expect(payload1['toolName']).toBe('follow-up')
    expect(payload1['subject']).toEqual({ kind: 'instance', instanceId: AUTHZ_WORKER })
    const args1 = payload1['arguments'] as Record<string, unknown>
    expect(args1['prompt']).toBe(DISTINCTIVE_PROMPT)
    expect(args1['attachedContext']).toBe(DISTINCTIVE_CONTEXT)

    // The durable digest is the digest of the durable payload (the
    // review identity the UI shows — consistent, not of a different
    // object).
    expect(row1?.reviewPayloadDigest).toBe(
      `sha256:${sha256Hex(canonicalJsonStringify(row1?.reviewPayload))}`,
    )

    // --- attempt 2 (SAME work except the prompt — the digest must move) --
    const promise2 = withTimeout(
      world.runtime.performAction(
        authzFollowUp({
          requestToken: 'tok-b-2',
          payload: { prompt: `${DISTINCTIVE_PROMPT} (CHANGED)`, attachedContext: DISTINCTIVE_CONTEXT },
        }),
      ),
      20_000,
      'the recovery follow-up attempt 2',
    ).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    const state2 = await withTimeout(waitForControlRequests(world.control, 2), 15_000, 'attempt-2 row')
    const row2 = state2.requests.find((r) => String(r.correlation).startsWith('recovery:tok-b-2:'))
    expect(row2).toBeDefined()
    const args2 = ((row2?.reviewPayload ?? {}) as Record<string, unknown>)['arguments'] as Record<string, unknown>
    expect(args2['prompt']).toBe(`${DISTINCTIVE_PROMPT} (CHANGED)`)
    // Digest sensitivity: prompt-only change ⇒ different digest (the old
    // payloads dropped the prompt and hashed identically).
    expect(row2?.reviewPayloadDigest).not.toBe(row1?.reviewPayloadDigest)

    // --- deny both: the typed zero-effect block, zero work ---------------
    for (const row of [row1, row2]) {
      if (row === undefined) continue
      await world.control.resolveControl({
        rootSessionId: AUTHZ_ROOT,
        caller: authzHumanCaller(),
        requestId: String(row.requestId),
        decision: 'deny',
      })
    }
    const o1 = await promise1
    const o2 = await promise2
    for (const o of [o1, o2]) {
      expect(o.ok).toBe(false)
      const err = o.ok === false ? (o as { error: unknown }).error : undefined
      expect((err as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
      expect(((err as { details?: Record<string, unknown> }).details ?? {})['controlDecision']).toBe('deny')
    }
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(0)
    expect(world.deliveryCalls.length).toBe(0)
  })

  it('S3: a pending-approval payload mutation NEVER executes — the frozen snapshot is what runs', async () => {
    world = await createAuthzWorld('authz-b-3')
    // The MUTABLE request object (a caller can mutate its own request
    // while the approval is pending — the old code re-ran exactly this
    // object).
    const request = authzFollowUp({
      requestToken: 'tok-b-3',
      payload: { prompt: DISTINCTIVE_PROMPT, attachedContext: DISTINCTIVE_CONTEXT },
    })
    const promise = withTimeout(
      world.runtime.performAction(request),
      20_000,
      'the recovery follow-up (the mutation-during-wait repro)',
    )
    await withTimeout(waitForControlRequests(world.control, 1), 15_000, 'the durable request row')
    // The mutation lands WHILE THE APPROVAL IS PENDING (after the
    // dispatch snapshot, before the decision).
    ;(request.payload as Record<string, unknown>)['prompt'] = MUTATED_PROMPT
    ;(request.payload as Record<string, unknown>)['attachedContext'] = 'B-MUTATED-CONTEXT — must never be executed'
    await sleep(15) // let the mutation sit while the waiter polls
    // The HUMAN approves the review (the reviewed snapshot — not the
    // mutated object).
    const state = await world.control.listControlState(AUTHZ_ROOT)
    const row = state.requests.find((r) => String(r.correlation).startsWith('recovery:tok-b-3:'))
    expect(row).toBeDefined()
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'allow',
    })
    const outcome = await promise
    // The reviewed snapshot executed: exactly one delivery, the ORIGINAL
    // prompt + context (the mutation is never observed by the execution).
    expect(world.deliveryCalls.length).toBe(1)
    expect(world.deliveryCalls[0]?.prompt).toBe(DISTINCTIVE_PROMPT)
    expect(world.deliveryCalls[0]?.attachedContext).toBe(DISTINCTIVE_CONTEXT)
    expect(world.deliveryCalls[0]?.prompt).not.toBe(MUTATED_PROMPT)
    expect(authzFacts(world.world, 'team-work-admitted').length).toBe(1)
    const result = outcome as { readonly effect: { readonly kind: string } }
    expect(result.effect.kind).toBe('work-admitted')
  })
})
