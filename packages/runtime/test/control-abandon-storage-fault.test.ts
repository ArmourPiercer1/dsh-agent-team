/**
 * control-abandon-storage-fault.test.ts — pre-alpha3 review F2 (the
 * #41-side contract): when the ABANDON's durable write fails, the
 * control service must surface the TYPED failure — it may NEVER claim
 * the request was abandoned unless the close fact is durable.
 *
 * This is the contract the #42 recovery dispatch relies on: its abort
 * path calls `abandonControlRequest` after the wait aborts, and the
 * frozen rule (guide §3.3) is
 *
 *   wait aborted → abandonControlRequest
 *     → durable commit succeeds → typed "recovery abandoned"
 *     → durable commit fails   → the typed close/storage failure
 *                                 PROPAGATES (never a best-effort
 *                                 swallow, never a false "abandoned")
 *
 * The #41 side under test here: `abandonControlRequest`'s own
 * fault mapping — the service wraps the two durable write steps
 * (`ledger.allocateSequence` / `ledger.put`) in the facade's closed
 * effect-phase code TEAM_RUNTIME_DURABLE_WRITE_FAILED (a store failure
 * is infrastructure, not a control-plane rejection), and a closed
 * domain surfaces the storage layer's typed NOT_OPEN closure signal
 * from the read phase.
 *
 * Fault injection (guide §3.4 — allocateSequence fail / ledger put
 * fail / domain closed / duplicate-identity fault):
 * S1: `ledger.allocateSequence` fails → DURABLE_WRITE_FAILED
 *     (stage 'ledger sequence allocation');
 * S2: `ledger.put` fails with the storage layer's duplicate-identity
 *     fault (RECORD_DUPLICATE, 'duplicate-ledger-entry' — the exact
 *     typed error an occupied sequence raises) → DURABLE_WRITE_FAILED
 *     (stage 'ledger put (control-request-abandoned)');
 * S3: the TeamDomain closes → the typed NOT_OPEN closure signal
 *     (the read phase fails before any write is attempted).
 *
 * In every fault scenario the assertions (guide §3.4):
 *   - the abandon call is REJECTED (no "abandoned" result is returned);
 *   - ZERO `control-request-abandoned` facts were written;
 *   - the request is STILL `pending` (the terminal mark was never
 *     claimed);
 *   - the test can LATER resolve the request (S1/S2 — the failed
 *     abandon neither consumed nor closed it).
 *
 * (The success path — abort → abandonment durable → later allow
 * returns CONTROL_REQUEST_ABANDONED with zero work effect — is the
 * companion control-abandon-without-resolve-envelope.test.ts S1.)
 *
 * Test pattern of this repo (the plain-node shim's `it` is
 * synchronous): every async scenario runs at MODULE level (top-level
 * await) and captures its results; the `it` bodies are pure
 * synchronous assertions.
 *
 * Matchers: toBe/toEqual (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/control-abandon-storage-fault
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  isTeamRuntimeError,
} from '../admission/index.js'
import type { TeamRuntimeError } from '../admission/index.js'
import {
  TEAM_DOMAIN_ERROR_CODES,
  isTeamDomainError,
  teamDomainError,
} from '../../storage/schema/errors.js'
import type { TeamDomainError } from '../../storage/schema/errors.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  memberCaller,
} from './p6t4-helpers.js'
import { createControlService } from '../control/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** Capture the outcome of one async call (never rejects the module). */
async function capture(fn: () => Promise<unknown>): Promise<
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
> {
  try {
    return { ok: true, value: await fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

// --- scenario 1: ledger.allocateSequence fails ------------------------------------------
let s1: {
  readonly rejected: boolean
  readonly error: unknown
  readonly abandonFacts: number
  readonly statusAfterFault: string
  readonly laterResolveOk: boolean
  readonly laterResolveStatus: string
}
{
  const world = await createP6T4World('ctl-fault-s1', ['leader', 'worker'])
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-fault-s1',
    })

    // Fault injection: the sequence allocation step fails (the service
    // holds the same repositories object — the patched method is what
    // the abandon write path calls).
    const ledger = world.domain.repositories.ledger
    const originalAllocate = ledger.allocateSequence.bind(ledger)
    ledger.allocateSequence = async () => {
      throw new Error('injected: the ledger sequence allocation failed')
    }
    let result: { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
    try {
      result = await capture(() =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          reason: 'the human closed the waiting review',
        }),
      )
    } finally {
      ledger.allocateSequence = originalAllocate
    }
    // The failed abandon must not claim the terminal mark: the request
    // is STILL PENDING after the faulted abandon ...
    const stateAfterFault = await service.listControlState(P6T4_ROOT)
    // ... and is still resolvable later (the failed abandon neither
    // consumed nor closed it).
    const laterResolve = await capture(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: request.requestId,
        decision: 'allow',
      }),
    )
    const state = await service.listControlState(P6T4_ROOT)
    s1 = {
      rejected: result.ok === false,
      error: result.ok === false ? result.error : result.value,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      statusAfterFault: stateAfterFault.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
      laterResolveOk: laterResolve.ok,
      laterResolveStatus: state.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: ledger.put fails (the duplicate-identity fault) ------------------------
let s2: {
  readonly rejected: boolean
  readonly error: unknown
  readonly abandonFacts: number
  readonly statusAfterFault: string
  readonly laterResolveOk: boolean
  readonly laterResolveStatus: string
}
{
  const world = await createP6T4World('ctl-fault-s2', ['leader', 'worker'])
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-fault-s2',
    })

    // Fault injection: the put step fails with the storage layer's
    // duplicate-identity fault — the EXACT typed error an occupied
    // ledger sequence raises (guide §3.4 'duplicate/identity fault').
    const ledger = world.domain.repositories.ledger
    const originalPut = ledger.put.bind(ledger)
    ledger.put = async () => {
      throw teamDomainError(
        'RECORD_DUPLICATE',
        'ledger sequence 99 is already occupied',
        { store: 'ledger', key: '99', problem: 'duplicate-ledger-entry' },
      )
    }
    let result: { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
    try {
      result = await capture(() =>
        service.abandonControlRequest({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          reason: 'the human closed the waiting review',
        }),
      )
    } finally {
      ledger.put = originalPut
    }
    // The failed put must not claim the terminal mark: the request is
    // STILL PENDING after the faulted abandon ...
    const stateAfterFault = await service.listControlState(P6T4_ROOT)
    // ... and is still resolvable later.
    const laterResolve = await capture(() =>
      service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: request.requestId,
        decision: 'allow',
      }),
    )
    const state = await service.listControlState(P6T4_ROOT)
    s2 = {
      rejected: result.ok === false,
      error: result.ok === false ? result.error : result.value,
      abandonFacts: controlFacts(world, 'control-request-abandoned').length,
      statusAfterFault: stateAfterFault.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
      laterResolveOk: laterResolve.ok,
      laterResolveStatus: state.requests.find((r) => r.requestId === request.requestId)?.status ?? '',
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: the TeamDomain closes (the NOT_OPEN closure signal) --------------------
let s3: {
  readonly rejected: boolean
  readonly error: unknown
}
{
  const world = await createP6T4World('ctl-fault-s3', ['leader', 'worker'])
  try {
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-fault-s3',
    })
    // The agent closes the durable domain under the abandon.
    await world.domain.close()
    const result = await capture(() =>
      service.abandonControlRequest({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: request.requestId,
        reason: 'the human closed the waiting review',
      }),
    )
    s3 = { rejected: result.ok === false, error: result.ok === false ? result.error : result.value }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------

describe('F2 (#41 side): a failed abandon durable write is a typed failure — never a claimed abandon', () => {
  it('S1: the allocateSequence fault surfaces DURABLE_WRITE_FAILED (stage ledger sequence allocation), zero abandon facts, the request stays pending and resolvable', () => {
    expect(s1.rejected).toBe(true)
    expect(isTeamRuntimeError(s1.error)).toBe(true)
    const error = s1.error as TeamRuntimeError
    expect(error.code).toBe(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED)
    expect((error.details as Record<string, unknown>)['stage']).toBe('ledger sequence allocation')
    expect(s1.abandonFacts).toBe(0)
    // The failed abandon never claimed the terminal mark ...
    expect(s1.statusAfterFault).toBe('pending')
    // ... and the test can LATER resolve it (guide §3.4).
    expect(s1.laterResolveOk).toBe(true)
    expect(s1.laterResolveStatus).toBe('decided')
  })

  it('S2: the duplicate-identity put fault surfaces DURABLE_WRITE_FAILED (stage ledger put (control-request-abandoned)), zero abandon facts, the request stays pending and resolvable', () => {
    expect(s2.rejected).toBe(true)
    expect(isTeamRuntimeError(s2.error)).toBe(true)
    const error = s2.error as TeamRuntimeError
    expect(error.code).toBe(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED)
    expect((error.details as Record<string, unknown>)['stage']).toBe('ledger put (control-request-abandoned)')
    expect(s2.abandonFacts).toBe(0)
    expect(s2.statusAfterFault).toBe('pending')
    expect(s2.laterResolveOk).toBe(true)
    expect(s2.laterResolveStatus).toBe('decided')
  })

  it('S3: the closed domain surfaces the storage NOT_OPEN closure signal — the read phase fails before any write is attempted (no abandoned claim)', () => {
    expect(s3.rejected).toBe(true)
    expect(isTeamDomainError(s3.error)).toBe(true)
    const error = s3.error as TeamDomainError
    expect(error.code).toBe(TEAM_DOMAIN_ERROR_CODES.NOT_OPEN)
  })

  it('the closed CONTROL_* vocabulary is untouched by the fault mapping (the typed failures are facade/storage codes, not control rejections)', () => {
    expect(isTeamRuntimeError(s1.error as unknown)).toBe(true)
    expect(isTeamRuntimeError(s2.error as unknown)).toBe(true)
    expect(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED).not.toBe(
      TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
    )
  })
})
