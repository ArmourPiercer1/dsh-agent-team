/**
 * pre-alpha3 W3-D (review fix F9, guide §8) — the cross-agent execution
 * TRIGGER (send-message) is gated on the requirement gate, and its recovery
 * re-run escalates to synchronous Human Review.
 *
 * WHAT THIS PROVES (guide §8.3, cases 1–7):
 *
 *   1. A blocked Leader send-message offers the recovery Human Review
 *      (user-approval kind + the normalized review payload + a new
 *      per-attempt correlation) — the trigger is gated like new work.
 *   2. `deny` → the typed zero-effect block stands (COMPATIBILITY_BLOCKED +
 *      `controlDecision: 'deny'`) and NO recipient input (the effect did not
 *      run — no coordination fact).
 *   3. `allow` → the re-run (recovery marker) delivers EXACTLY ONE recipient
 *      input (one coordination fact).
 *   4. `abort` → the abandonment is durable (`abandonControlRequest`) + the
 *      typed zero-effect block (`controlDecision: 'abandoned'`) + NO
 *      recipient input.
 *   5. Normal mode (no scope down) send-message needs NO extra approval
 *      (the gate allows — no control coupling).
 *   6. report-progress is STILL pure coordination (never gated, no dispatch).
 *   7. request-control / resolve-control are UNHARMED (the control plane is
 *      always allowed, no recovery dispatch).
 *
 * The gate consults on the trigger's impact (`crossAgentTrigger` — the
 * closed class added by F9), referencing the Team scope + the recipient's
 * template scope; the `gateAction` blocks the trigger if ANY evaluated scope
 * is down. The recovery re-run reuses the existing `dispatchRecoveryIfOffered`
 * inline Control coupling (the synchronous Human Review).
 *
 * @module test/recovery-send-message-review
 */

import { afterEach, describe, expect, it } from 'vitest'

import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import { makeActionRequest, createP6T2World } from './p6t2-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  createRecoveryDispatchRuntime,
  createRecoveryDispatchWorld,
  makeSpyControlService,
  recoveryWorkerInstanceId,
  type SpyControlCalls,
} from './recovery-dispatch-helpers.js'

function sendMessageRequest(token: string, body: string) {
  const recipient = recoveryWorkerInstanceId()
  return makeActionRequest({
    action: 'send-message',
    targetInstanceId: recipient,
    payload: { recipientInstanceId: recipient, subject: 'sync', body },
    requestToken: token,
  })
}

function capture(
  outcome: unknown,
): { readonly ok: boolean; readonly kind?: string; readonly code?: string; readonly details?: Record<string, unknown> } {
  if (typeof outcome === 'object' && outcome !== null) {
    const o = outcome as {
      effect?: { kind?: string; factRecipient?: string }
      code?: string
      details?: Record<string, unknown>
    }
    // The success outcome carries the durable effect (the `kind`); a
    // rejection is a TeamRuntimeError (the `code` / `details`, no effect).
    return { ok: true, kind: o.effect?.kind, code: o.code, details: o.details }
  }
  return { ok: false }
}

describe('W3-D recovery-send-message-review: the F9 cross-agent trigger', () => {
  let world: P6T1World | undefined
  let calls: SpyControlCalls | undefined

  afterEach(() => {
    if (world !== undefined) {
      void destroyP6T1World(world).catch(() => {})
    }
    world = undefined
    calls = undefined
  })

  it('1. a blocked Leader send-message offers the recovery Human Review (user-approval + review payload)', async () => {
    world = await createRecoveryDispatchWorld('w3d-rev-review')
    const { service, calls: c } = makeSpyControlService('allow')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    await runtime.performAction(sendMessageRequest('req-w3d-review-1', 'recovery review')).then(
      () => undefined,
      (error: unknown) => error,
    )
    // The Human Review offer ran exactly once.
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
    expect(calls?.abandon).toBe(0)
    expect(calls?.lastKind).toBe('user-approval')
    expect(typeof calls?.lastReviewPayloadDigest).toBe('string')
    expect((calls?.lastReviewPayloadDigest as string).length).toBeGreaterThan(0)
    // The correlation is NEW per attempt. (fix-control-authz D —
    // DISCLOSED MASKING-TEST ADJUSTMENT: the old pin
    // `recovery:req-w3d-review-1:1` asserted the BUGGY process-local
    // counter identity — the `:1` suffix a COLD-RESTART retry of the same
    // token could re-derive to directly re-arm a stale approval (the D
    // finding; target-design §11.3 forbids approval replay). The attempt
    // identity is now a restart-unique nonce (a UUID).)
    expect(calls?.lastCorrelation).toMatch(
      /^recovery:req-w3d-review-1:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('2. deny → the typed zero-effect block stands and NO recipient input', async () => {
    world = await createRecoveryDispatchWorld('w3d-rev-deny')
    const { service, calls: c } = makeSpyControlService('deny')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const outcome = await runtime.performAction(sendMessageRequest('req-w3d-deny-1', 'deny')).then(
      (result) => result,
      (error: unknown) => error,
    )
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
    // The typed zero-effect block (COMPATIBILITY_BLOCKED + deny).
    expect((outcome as { code?: string }).code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect((outcome as { details?: Record<string, unknown> }).details?.['controlDecision']).toBe('deny')
    // NO recipient input (the effect did not run — no coordination fact).
    expect(capture(outcome).kind).not.toBe('fact-recorded')
  })

  it('3. allow → the re-run delivers EXACTLY ONE recipient input', async () => {
    world = await createRecoveryDispatchWorld('w3d-rev-allow')
    const { service, calls: c } = makeSpyControlService('allow')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const outcome = await runtime.performAction(sendMessageRequest('req-w3d-allow-1', 'allow')).then(
      (result) => result,
      (error: unknown) => error,
    )
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
    // The re-run (recovery marker) was admitted → exactly one coordination
    // fact (the recipient input).
    expect(capture(outcome).kind).toBe('fact-recorded')
  })

  it('4. abort → abandonment durable + the typed zero-effect block + NO recipient input', async () => {
    world = await createRecoveryDispatchWorld('w3d-rev-abort')
    const { service, calls: c } = makeSpyControlService('abort')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const outcome = await runtime.performAction(sendMessageRequest('req-w3d-abort-1', 'abort')).then(
      (result) => result,
      (error: unknown) => error,
    )
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
    expect(calls?.abandon).toBe(1)
    // The typed zero-effect block (COMPATIBILITY_BLOCKED + abandoned).
    expect((outcome as { code?: string }).code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect((outcome as { details?: Record<string, unknown> }).details?.['controlDecision']).toBe('abandoned')
    // NO recipient input.
    expect(capture(outcome).kind).not.toBe('fact-recorded')
  })

  it('5. normal mode (no scope down) send-message needs NO extra approval', async () => {
    world = await createP6T2World('w3d-normal', ['leader', 'worker'])
    const { service, calls: c } = makeSpyControlService('allow')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const outcome = await runtime.performAction(sendMessageRequest('req-w3d-normal-1', 'normal')).then(
      (result) => result,
      (error: unknown) => error,
    )
    // No control coupling (no scope down → no dispatch).
    expect(calls?.requestControl).toBe(0)
    // The send-message succeeded (recorded a coordination fact).
    expect(capture(outcome).kind).toBe('fact-recorded')
  })

  it('6. report-progress is STILL pure coordination (never gated, no dispatch)', async () => {
    world = await createRecoveryDispatchWorld('w3d-report-progress')
    const { service, calls: c } = makeSpyControlService('allow')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'report-progress',
      targetInstanceId: recoveryWorkerInstanceId(),
      payload: { status: 'in-progress', note: 'progress update' },
      requestToken: 'req-w3d-report-1',
    })
    await runtime.performAction(request).then(
      (result) => result,
      (error: unknown) => error,
    )
    // No control coupling (report-progress is coordination, always allowed).
    expect(calls?.requestControl).toBe(0)
  })

  it('7. request-control is UNHARMED (the control plane is always allowed, no dispatch)', async () => {
    world = await createRecoveryDispatchWorld('w3d-request-control')
    const { service, calls: c } = makeSpyControlService('allow')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'request-control',
      targetInstanceId: recoveryWorkerInstanceId(),
      payload: { reason: 'control-plane check' },
      requestToken: 'req-w3d-control-1',
    })
    await runtime.performAction(request).then(
      (result) => result,
      (error: unknown) => error,
    )
    // No recovery-dispatch control coupling (request-control is the control
    // plane itself — always allowed, never a recovery trigger).
    expect(calls?.requestControl).toBe(0)
  })
})
