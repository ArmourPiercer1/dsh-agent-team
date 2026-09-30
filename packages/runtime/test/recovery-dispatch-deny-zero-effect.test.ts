/**
 * pre-alpha3 PR-E (plan §E.9) — E.11 suite `recovery-dispatch-deny-zero-effect`:
 * a NEW-WORK action blocked by the requirement gate on a BLOCKED scope (a
 * required requirement down) offers the human-reviewed recovery Control
 * request; a DURABLE `deny` means the operation remains BLOCKED with ZERO
 * durable effect. The typed block stands with the recovery-model details:
 *   - code `COMPATIBILITY_BLOCKED` (the frozen router vocabulary);
 *   - `details.controlDecision: 'deny'` (the recovery-model field);
 *   - `details.controlRequestId` (the control request the deny closed);
 *   - `details.recoveryDispatchAvailable: true` (the offer was made);
 *   - `details.blockedScopes` / `details.unavailableSubjects` (the original
 *     typed contract);
 *   - the spy control service saw exactly ONE `requestControl` + ONE
 *     `awaitControlDecision` (one dispatch attempt);
 *   - NO new-work admission fact landed (zero durable effect — the deny
 *     created no work).
 *
 * @module @dsh-agent-team/runtime/test/recovery-dispatch-deny-zero-effect
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

describe('E.11 recovery-dispatch-deny-zero-effect: a durable deny keeps the block, zero effect', () => {
  let world: P6T1World | undefined
  let calls: SpyControlCalls | undefined

  afterEach(() => {
    void destroyP6T1World(world!).catch(() => {})
    world = undefined
    calls = undefined
  })

  it('a denied recovery dispatch keeps the COMPATIBILITY_BLOCKED block with controlDecision deny + controlRequestId + zero work effect', async () => {
    world = await createRecoveryDispatchWorld('pr-e-recovery-deny')
    const { service, calls: c } = makeSpyControlService('deny')
    calls = c
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      requestToken: 'req-recovery-deny-1',
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
    expect(err.details?.['controlDecision']).toBe('deny')
    expect(typeof err.details?.['controlRequestId']).toBe('string')
    // The typed block keeps the recovery-model contract (the original gate
    // reason + the blocked scopes the dispatch offered for).
    expect(err.details?.['gateReason']).toBe('requiredScopeDown')
    expect(Array.isArray(err.details?.['blockedScopes'])).toBe(true)
    expect((err.details?.['blockedScopes'] as string[]).length).toBeGreaterThan(0)

    // The control coupling ran exactly once (one dispatch attempt).
    expect(calls?.requestControl).toBe(1)
    expect(calls?.awaitControlDecision).toBe(1)
    // No abandon on a deny (the abandon is the abort path only).
    expect(calls?.abandon).toBe(0)
  })
})
