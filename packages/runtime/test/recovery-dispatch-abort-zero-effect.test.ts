/**
 * pre-alpha3 PR-E (plan §E.9/§E.10) — E.11 suite
 * `recovery-dispatch-abort-zero-effect`: a NEW-WORK action blocked by the
 * requirement gate offers the human-reviewed recovery Control request; when
 * the wait ABORTS (the human cancels / the control plane closes — the typed
 * `CONTROL_WAIT_ABORTED` / `CONTROL_WAIT_CLOSED`), the router:
 *   1. performs the BEST-EFFORT `abandonControlRequest` (the inline abort
 *      path, plan §E.10 — the abandon call's rejection is swallowed; the
 *      abandon is an OFFER of the close, never a failure of the block);
 *   2. throws the typed ZERO-EFFECT block: code `COMPATIBILITY_BLOCKED` +
 *      `details.controlDecision: 'abandoned'` + `details.controlRequestId`
 *      (the operation remains blocked, no durable effect).
 * The suite pins the abandon call (exactly one) + the zero-effect block +
 * no new-work admission fact.
 *
 * @module @dsh-agent-team/runtime/test/recovery-dispatch-abort-zero-effect
 */

import { afterEach, describe, expect, it } from 'vitest'

import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
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

describe('E.11 recovery-dispatch-abort-zero-effect: an aborted wait keeps the block, zero effect', () => {
  let world: P6T1World | undefined
  let calls: SpyControlCalls | undefined

  afterEach(() => {
    void destroyP6T1World(world!).catch(() => {})
    world = undefined
    calls = undefined
  })

  it('an aborted recovery wait abandons the request (best-effort) + keeps the block with controlDecision abandoned + zero work effect', async () => {
    world = await createRecoveryDispatchWorld('pr-e-recovery-abort')
    const { service, calls: c } = makeSpyControlService('abort')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      requestToken: 'req-recovery-abort-1',
      payload: { prompt: 'recover the blocked scope' },
    })

    const rejected = await runtime.performAction(request).then(
      () => {
        throw new Error('expected a rejection, but the action succeeded')
      },
      (error: unknown) => error,
    )

    expect(rejected).toBeDefined()
    const err = rejected as { code: string; details?: Record<string, unknown> }
    expect(err.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(err.details?.['controlDecision']).toBe('abandoned')
    expect(typeof err.details?.['controlRequestId']).toBe('string')
    // The typed block keeps the recovery-model contract.
    expect(err.details?.['gateReason']).toBe('requiredScopeDown')
    expect(Array.isArray(err.details?.['blockedScopes'])).toBe(true)
    expect((err.details?.['blockedScopes'] as string[]).length).toBeGreaterThan(0)

    // The best-effort abandon ran exactly once (the abort path).
    expect(calls?.abandon).toBe(1)
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
  })
})
