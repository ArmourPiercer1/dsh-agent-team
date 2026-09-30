/**
 * pre-alpha3 W3-E (review fix F2, guide §3) — the recovery-dispatch abandon
 * commit is NOT best-effort: a REAL durable-commit failure of
 * `abandonControlRequest` must surface as the typed close/storage failure
 * (the router must NOT claim `abandoned` — the request is still PENDING and
 * later resolvable), while a CONCURRENT abandon (`CONTROL_REQUEST_ABANDONED`)
 * keeps the zero-effect claim (the terminal mark is already durable).
 *
 * WHAT THIS PROVES (guide §3.4):
 *
 *   S1 (FAULT): the `abandonControlRequest` durable commit fails (the
 *       `allocateSequence()` / ledger `put()` / domain-closed /
 *       duplicate-identity fault class — modeled here as the closed
 *       `DURABLE_WRITE_FAILED` typed failure) → the typed close/storage
 *       failure SURFACES (the router propagates it, does NOT claim
 *       `abandoned`). Because the abandon did not land, the request is still
 *       PENDING and later resolvable (a property of the durable control
 *       plane — pinned by `control-abandon-storage-fault.test.ts`).
 *   S2 (CONCURRENT-ABANDON): the `abandonControlRequest` reports the request
 *       was ALREADY abandoned (`CONTROL_REQUEST_ABANDONED`) → the terminal
 *       mark is already durable, so the router KEEPS the zero-effect claim
 *       (throws the typed `COMPATIBILITY_BLOCKED` + `controlDecision:
 *       'abandoned'`).
 *   S3 (SUCCESS): the `abandonControlRequest` durable commit SUCCEEDS → the
 *       router throws the typed `COMPATIBILITY_BLOCKED` +
 *       `controlDecision: 'abandoned'` (zero durable work effect). A later
 *       `allow` against the durable terminal mark returns
 *       `CONTROL_REQUEST_ABANDONED` (pinned by
 *       `control-abandon-storage-fault.test.ts`).
 *
 * The F2 fix (router `dispatchRecoveryIfOffered`): the abandon try/catch no
 * longer swallows — it propagates the `abandonError` UNLESS it is a
 * `ControlError` with code `CONTROL_REQUEST_ABANDONED` (the concurrent
 * abandon, which keeps the claim).
 *
 * @module test/recovery-abandon-commit-fault
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  TEAM_RUNTIME_ERROR_CODES,
  isTeamRuntimeError,
  TeamRuntimeError,
} from '../admission/index.js'
import { ControlError, CONTROL_ERROR_CODES } from '../control/index.js'
import type { ControlService } from '../control/index.js'
import { P6T2_ROOT, makeActionRequest } from './p6t2-helpers.js'
import { destroyP6T1World, type P6T1World } from './p6t1-helpers.js'
import {
  createRecoveryDispatchRuntime,
  createRecoveryDispatchWorld,
  makeSpyControlService,
  recoveryWorkerInstanceId,
} from './recovery-dispatch-helpers.js'

/** The configurable abandon-commit behavior of the spy. */
type AbandonBehavior = 'succeed' | 'fault' | 'concurrent-abandon'

interface AbandonSpyCalls {
  requestControl: number
  awaitControlDecision: number
  abandon: number
}

/**
 * Build a control service whose wait ALWAYS aborts (`CONTROL_WAIT_ABORTED` —
 * the abandon path) and whose `abandonControlRequest` behaves per
 * `abandonBehavior` (the fault under test).
 */
function makeAbandonSpy(abandonBehavior: AbandonBehavior): {
  readonly service: ControlService
  readonly calls: AbandonSpyCalls
} {
  const calls: AbandonSpyCalls = { requestControl: 0, awaitControlDecision: 0, abandon: 0 }
  let sequence = 0
  const service = {
    async requestControl() {
      calls.requestControl += 1
      sequence += 1
      return { requestId: `cr-abandon-${sequence}`, rootSessionId: P6T2_ROOT } as never
    },
    async awaitControlDecision() {
      calls.awaitControlDecision += 1
      // The wait aborts → the router takes the abandon path.
      throw new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED, 'the recovery wait aborted')
    },
    async abandonControlRequest() {
      calls.abandon += 1
      if (abandonBehavior === 'fault') {
        // A REAL durable-commit failure (the closed `DURABLE_WRITE_FAILED`
        // typed failure — the `allocateSequence()` / ledger `put()` /
        // domain-closed / duplicate-identity fault class).
        throw new TeamRuntimeError(
          TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
          'injected: the durable abandon commit failed',
          { stage: 'ledger put (control-request-abandoned)' },
        )
      }
      if (abandonBehavior === 'concurrent-abandon') {
        // A CONCURRENT abandon (the request was already abandoned — the
        // terminal mark is already durable).
        throw new ControlError(
          CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED,
          'the request was already abandoned',
        )
      }
      return {} as never
    },
    // Typed stubs — the router never calls these on the recovery-dispatch path.
    async resolveControl() {
      throw new Error('not implemented in the abandon-commit spy')
    },
    async listControlState() {
      return { requests: [], decisions: [], consumptions: [], abandonments: [] } as never
    },
    async guardOperation() {
      throw new Error('not implemented in the abandon-commit spy')
    },
    async checkExternalOperation() {
      throw new Error('not implemented in the abandon-commit spy')
    },
  }
  return { service: service as unknown as ControlService, calls }
}

function assertTypedAbandoned(error: unknown): void {
  expect(isTeamRuntimeError(error)).toBe(true)
  const e = error as TeamRuntimeError
  expect(e.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  expect(e.details?.['controlDecision']).toBe('abandoned')
}

describe('W3-E recovery-abandon-commit-fault: the F2 no-swallow abandon', () => {
  let world: P6T1World | undefined

  afterEach(() => {
    if (world !== undefined) {
      void destroyP6T1World(world).catch(() => {})
    }
    world = undefined
  })

  it('S1 (FAULT): the real abandon-commit failure SURFACES — the router does NOT claim abandoned', async () => {
    world = await createRecoveryDispatchWorld('w3e-fault')
    const { service, calls } = makeAbandonSpy('fault')
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      payload: { prompt: 'recovery abort fault' },
      requestToken: 'req-w3e-fault-1',
    })
    const error = await runtime.performAction(request).then(
      (result) => result,
      (e: unknown) => e,
    )
    // The abandon path ran (the wait aborted → the abandon was attempted).
    expect(calls.requestControl).toBe(1)
    expect(calls.awaitControlDecision).toBe(1)
    expect(calls.abandon).toBe(1)
    // The REAL durable-commit failure SURFACES (the typed close/storage
    // failure) — the router does NOT claim `abandoned`.
    expect(isTeamRuntimeError(error)).toBe(true)
    expect((error as TeamRuntimeError).code).toBe(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED)
    expect((error as TeamRuntimeError).code).not.toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  })

  it('S2 (CONCURRENT-ABANDON): the already-abandoned request KEEPS the zero-effect claim', async () => {
    world = await createRecoveryDispatchWorld('w3e-concurrent')
    const { service, calls } = makeAbandonSpy('concurrent-abandon')
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      payload: { prompt: 'recovery abort concurrent' },
      requestToken: 'req-w3e-concurrent-1',
    })
    const error = await runtime.performAction(request).then(
      (result) => result,
      (e: unknown) => e,
    )
    expect(calls.requestControl).toBe(1)
    expect(calls.awaitControlDecision).toBe(1)
    expect(calls.abandon).toBe(1)
    // The terminal mark is already durable (the concurrent abandon) → the
    // router KEEPS the zero-effect claim (the typed `abandoned`).
    assertTypedAbandoned(error)
  })

  it('S3 (SUCCESS): the durable abandon commit → the typed abandoned (zero work effect)', async () => {
    world = await createRecoveryDispatchWorld('w3e-success')
    const { service, calls } = makeAbandonSpy('succeed')
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      payload: { prompt: 'recovery abort success' },
      requestToken: 'req-w3e-success-1',
    })
    const error = await runtime.performAction(request).then(
      (result) => result,
      (e: unknown) => e,
    )
    expect(calls.requestControl).toBe(1)
    expect(calls.awaitControlDecision).toBe(1)
    expect(calls.abandon).toBe(1)
    // The durable abandon landed → the typed `abandoned` (zero durable work
    // effect; a later allow against the terminal mark returns
    // CONTROL_REQUEST_ABANDONED — pinned by control-abandon-storage-fault).
    assertTypedAbandoned(error)
  })

  it('S4 (REGRESSION): a NORMAL allow still admits the re-run (the F2 fix does not touch the allow path)', async () => {
    // Guard against over-reach: the F2 fix only changes the ABANDON path. The
    // allow path (the durable abandon is NOT attempted) is untouched — a
    // reviewed allow still admits the re-run.
    world = await createRecoveryDispatchWorld('w3e-allow')
    const { service, calls } = makeSpyControlService('allow')
    const runtime = createRecoveryDispatchRuntime(world, service)
    const request = makeActionRequest({
      action: 'follow-up',
      targetInstanceId: recoveryWorkerInstanceId(),
      payload: { prompt: 'recovery allow regression' },
      requestToken: 'req-w3e-allow-1',
    })
    const outcome = await runtime.performAction(request).then(
      (result) => result,
      (e: unknown) => e,
    )
    // No abandon was attempted (the allow path).
    expect(calls.abandon).toBe(0)
    // The re-run was admitted (a durable effect — not a block).
    expect(isTeamRuntimeError(outcome)).toBe(false)
  })
})
