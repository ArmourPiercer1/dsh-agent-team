/**
 * fix-control-authz H (P2) — the REAL-chain regression for the recovery
 * send-message pre-review rejection (CONTROL_REQUEST_MALFORMED).
 *
 * The production path: the messaging coordinator (`sendTeamMessage`)
 * addresses the RECIPIENT through `targetInstanceId` (the instance-first
 * facade addressing) while carrying the recipient in
 * `payload.recipientInstanceId`; the recovery dispatch subjected a
 * send-message to a TEMPLATE subject (the recipient's template) while
 * STILL passing `targetInstanceId` — a combination the REAL control
 * validator rejects fail-closed (a non-instance subject must not carry a
 * targetInstanceId), so the recovery send-message NEVER reached review.
 * The pre-existing `recovery-send-message-review` suite masked the defect
 * with a lenient spy control service (no subject/targetInstanceId
 * agreement validation); this suite drives the REAL ControlService +
 * REAL router with a legal sender (the Leader) and a legal recipient
 * (the seeded worker member).
 *
 * What this proves (the finding's expected outcomes):
 *   S1: a blocked Leader send-message creates a DURABLE inline approval
 *       request that FULLY represents the message (recipient instance
 *       subject + the body/subject in the review payload); `deny` ⇒ the
 *       typed zero-effect block + ZERO delivery;
 *   S2: `allow` ⇒ EXACTLY ONE delivery (one coordination fact, one
 *       session-input call, the body preserved);
 *   S3: `abort` ⇒ the durable abandon + the typed zero-effect block +
 *       ZERO delivery.
 *
 * @module @dsh-agent-team/runtime/test/fix-control-authz-h-send-message
 */

import { afterEach, describe, expect, it } from 'vitest'

import { isControlError, CONTROL_ERROR_CODES } from '../control/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import { createMessagingCoordinator } from '../messaging/index.js'
import type { SessionInputPort } from '../messaging/index.js'
import {
  AUTHZ_ROOT,
  AUTHZ_WORKER,
  authzFacts,
  authzHumanCaller,
  createAuthzWorld,
  destroyAuthzWorld,
  makeActionRequest,
  sleep,
  waitForControlRequests,
  withTimeout,
  type AuthzWorld,
} from './fix-control-authz-helpers.js'
import { P6T2_NOW } from './p6t2-helpers.js'

let world: AuthzWorld | undefined
let sessionInputCalls: unknown[] = []

afterEach(async () => {
  if (world !== undefined) {
    await destroyAuthzWorld(world)
  }
  world = undefined
  sessionInputCalls = []
})

/** Wire the REAL messaging coordinator over the authz world with a
 *  recording session-input port (the delivery-count channel). */
function coordinatorOf(authz: AuthzWorld) {
  const sessionInput: SessionInputPort = {
    async submitAttributedInput(input: unknown): Promise<void> {
      sessionInputCalls.push(input)
    },
  }
  return createMessagingCoordinator({
    teamRuntime: authz.runtime,
    teamDomain: authz.world.domain,
    sessionInput,
    now: () => P6T2_NOW,
  })
}

function sendMessageRequest(token: string, body: string, subject: string) {
  return {
    rootSessionId: AUTHZ_ROOT,
    caller: makeActionRequest({}).caller,
    recipientInstanceId: AUTHZ_WORKER,
    body,
    subject,
    requestToken: token,
  }
}

/** Capture one outcome (never rejects the test body). */
function capture(promise: Promise<unknown>): Promise<
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  )
}

function asDetails(error: unknown): Record<string, unknown> | undefined {
  const err = error as { details?: Record<string, unknown> }
  return err?.details
}

describe('fix-control-authz H — the recovery send-message reaches review over the REAL chain', () => {
  it('S1: a blocked Leader send-message creates the durable inline request (recipient instance subject + the full message in the review payload); deny ⇒ typed zero-effect block + ZERO delivery', async () => {
    world = await createAuthzWorld('authz-h-1')
    const coordinator = coordinatorOf(world)
    const promise = capture(
      withTimeout(
        coordinator.sendTeamMessage(
          sendMessageRequest('tok-h-1', 'H-repro message body (distinctive)', 'H-repro subject'),
        ),
        20_000,
        'the recovery send-message offer (the real control round-trip)',
      ),
    )
    // The durable inline approval request is created (the RED failure of
    // the old code: the real validator rejected the offer as
    // CONTROL_REQUEST_MALFORMED and NO row was ever written).
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 4_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-h-1:'))
    expect(row).toBeDefined()
    expect(row?.executionCoupling).toBe('inline')
    expect(row?.kind).toBe('user-approval')
    expect(row?.status).toBe('pending')
    // The subject is the RECIPIENT INSTANCE (the consistency the real
    // validator requires — a template subject + targetInstanceId is
    // CONTROL_REQUEST_MALFORMED).
    expect(row?.subject).toEqual({ kind: 'instance', instanceId: AUTHZ_WORKER })
    // The review payload carries the FULL message (the human reviews what
    // will actually be delivered).
    const payload = (row?.reviewPayload ?? {}) as Record<string, unknown>
    expect(payload['requestToken']).toBe('tok-h-1')
    const arguments_ = payload['arguments'] as Record<string, unknown>
    expect(arguments_['body']).toBe('H-repro message body (distinctive)')
    expect(arguments_['subject']).toBe('H-repro subject')
    expect(arguments_['recipientInstanceId']).toBe(AUTHZ_WORKER)
    expect(typeof row?.reviewPayloadDigest).toBe('string')

    // The HUMAN denies the review (user-approval: human-only resolver).
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'deny',
    })
    const outcome = await promise
    // The typed zero-effect block (the operation remains blocked).
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('deny')
    expect(asDetails(error)?.['controlRequestId']).toBe(row?.requestId)
    // ZERO delivery: no coordination fact, no session input.
    expect(authzFacts(world.world, 'team-coordination-recorded').length).toBe(0)
    expect(sessionInputCalls.length).toBe(0)
  })

  it('S2: allow ⇒ EXACTLY ONE delivery (one coordination fact, one session-input call, the body preserved)', async () => {
    world = await createAuthzWorld('authz-h-2')
    const coordinator = coordinatorOf(world)
    const promise = capture(
      withTimeout(
        coordinator.sendTeamMessage(sendMessageRequest('tok-h-2', 'H-allow message body', 'H-allow')),
        20_000,
        'the recovery send-message (the allow path)',
      ),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 4_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-h-2:'))
    expect(row).toBeDefined()
    await world.control.resolveControl({
      rootSessionId: AUTHZ_ROOT,
      caller: authzHumanCaller(),
      requestId: String(row?.requestId),
      decision: 'allow',
    })
    const outcome = await promise
    // The coordinator delivered exactly once (the facade effect + the
    // delivery phase).
    expect(outcome.ok).toBe(true)
    const delivered = outcome.ok === true ? (outcome.value as { readonly status: string }) : undefined
    expect(delivered?.status).toBe('delivered')
    expect(authzFacts(world.world, 'team-coordination-recorded').length).toBe(1)
    expect(sessionInputCalls.length).toBe(1)
    // The body is preserved in the attributed input (the delivery shows
    // what was reviewed).
    const inputText = JSON.stringify(sessionInputCalls[0])
    expect(inputText).toContain('H-allow message body')
  })

  it('S3: abort ⇒ the durable abandon + the typed zero-effect block + ZERO delivery (real router + real control)', async () => {
    world = await createAuthzWorld('authz-h-3')
    const ac = new AbortController()
    const promise = capture(
      withTimeout(
        world.runtime.performAction(
          makeActionRequest({
            action: 'send-message',
            targetInstanceId: AUTHZ_WORKER,
            requestToken: 'tok-h-3',
            payload: { recipientInstanceId: AUTHZ_WORKER, subject: 'H-abort', body: 'H-abort message body' },
            signal: ac.signal,
          }),
        ),
        20_000,
        'the recovery send-message (the abort path)',
      ),
    )
    const { requests } = await withTimeout(waitForControlRequests(world.control, 1), 4_000, 'the durable request row')
    const row = requests.find((r) => String(r.correlation).startsWith('recovery:tok-h-3:'))
    expect(row).toBeDefined()
    await sleep(20) // let the waiter park (a parked poll)
    ac.abort()
    const outcome = await promise
    expect(outcome.ok).toBe(false)
    const error = outcome.ok === false ? outcome.error : undefined
    expect((error as { code?: string })?.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(asDetails(error)?.['controlDecision']).toBe('abandoned')
    // The durable abandon mark is present (the terminal close).
    const state = await world.control.listControlState(AUTHZ_ROOT)
    expect(state.abandonments.some((a) => a.requestId === row?.requestId)).toBe(true)
    // ZERO delivery.
    expect(authzFacts(world.world, 'team-coordination-recorded').length).toBe(0)
  })

  it('the old-code defect is a real-validator rejection (evidence guard: a template subject + targetInstanceId is CONTROL_REQUEST_MALFORMED)', async () => {
    world = await createAuthzWorld('authz-h-guard')
    // The shape the BUGGY subject mapping produced (a template subject
    // carrying the recipient targetInstanceId): the REAL validator
    // rejects it — this is why the recovery send-message never reached
    // review.
    const rejected = await world.control.requestControl({
      rootSessionId: AUTHZ_ROOT,
      caller: makeActionRequest({}).caller,
      kind: 'user-approval',
      subject: { kind: 'template', templateId: 'worker' },
      targetInstanceId: AUTHZ_WORKER,
      actionName: 'send-message',
      correlation: 'recovery:h-guard:1',
    }).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(rejected).toBeDefined()
    expect(isControlError(rejected)).toBe(true)
    expect((rejected as { code: string }).code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(authzFacts(world.world, 'control-request-recorded').length).toBe(0)
  })
})
