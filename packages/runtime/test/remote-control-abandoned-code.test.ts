/**
 * remote-control-abandoned-code.test.ts — pre-alpha3 review F12: the
 * remote boundary must pass `CONTROL_REQUEST_ABANDONED` through
 * UNMAPPED (invariant 4b) — it is a reachable `team.resolveControl`
 * code, not an internal error.
 *
 * The defect under repair: the PR-D D.4 terminal-mark code
 * (packages/runtime/control/errors.ts) was missing from the closed
 * `REMOTE_BACKING_ERROR_CODE_SET` in packages/remote/src/handlers/
 * dispatch.ts, so a late allow of an ABANDONED request — the exact
 * zero-effect outcome of the recovery-dispatch abort path — reached a
 * remote caller downgraded to `internal-error` (invariant 5) instead
 * of its typed code. The S6 production dispatcher and the pure remote
 * dispatcher share the SINGLE set definition, so the backfill covers
 * both boundaries.
 *
 * The test drives the REAL S6 production dispatcher
 * (`createS6RemoteDispatcher`) with the REAL control service behind the
 * `teamResolveControl` port: a pending request is abandoned durably,
 * then a v4 `team.resolveControl` (allow) lands on the terminal mark.
 * The response must carry `error.code === CONTROL_REQUEST_ABANDONED`
 * (never `internal-error`) with the 4b provenance (the typed cause
 * under `details.cause`). A positive control (a fresh pending request
 * resolved over the same wire) proves the wiring itself serves the
 * decision.
 *
 * Test pattern of this repo (the plain-node shim's `it` is
 * synchronous): every async scenario runs at MODULE level (top-level
 * await) and captures its results; the `it` bodies are pure
 * synchronous assertions.
 *
 * Matchers: toBe/toEqual (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/remote-control-abandoned-code
 */

import { describe, expect, it } from 'vitest'

import { createS6RemoteDispatcher } from '../src/plugin/s6-remote.js'
import type { S6RemotePorts } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import type { ActionCaller } from '../admission/index.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION_V4,
} from '../../remote/src/index.js'
import type { RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'
// The single shared closed-set definition (the index re-exports only the
// dispatcher factory — the set is imported from its source, exactly as
// the S6 production dispatcher does).
import { REMOTE_BACKING_ERROR_CODE_SET } from '../../remote/src/handlers/dispatch.js'
import {
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlDecisionRecord } from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const HUMAN_ID = 'human-p6t4-owner'

/** Extract the typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('F12 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Extract the success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('F12 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

// Module level (top-level await): drive the REAL production dispatcher
// over the REAL control service and capture the scenario results.
const F12 = await (async () => {
  const world = await createP6T4World('ctl-f12-remote', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)

    // (0) Positive control: a fresh pending request resolved over the
    // v4 wire (the wiring serves the decision; the human principal is
    // HOST-DERIVED — the wire carries no caller fields, U3).
    const positiveRequest = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-f12-positive',
    })
    const humanPrincipal: ServerPrincipalDerivation = () =>
      ({ kind: 'human', humanId: HUMAN_ID }) satisfies ActionCaller
    const ports: S6RemotePorts = {
      teamResolveControl: {
        resolveControl(
          teamSessionId: string,
          requestId: string,
          decision: 'allow' | 'deny',
          note: string | undefined,
          caller: ActionCaller,
        ): Promise<RemoteSafeRecord> {
          // The durable ControlDecision record IS remote-safe (the same
          // record the production S6 port hands to the wire).
          return Promise.resolve(
            service.resolveControl({
              rootSessionId: teamSessionId,
              caller,
              requestId,
              decision,
              ...(note !== undefined ? { note } : {}),
            }) as unknown as Promise<RemoteSafeRecord>,
          )
        },
      },
    } as unknown as S6RemotePorts
    const dispatch = createS6RemoteDispatcher(ports, humanPrincipal)

    const positiveResponse = await dispatch('team.resolveControl', {
      version: REMOTE_CONTRACT_VERSION_V4,
      params: {
        teamSessionId: P6T4_ROOT,
        requestId: positiveRequest.requestId,
        decision: 'allow',
      },
    })

    // (1) The F12 scenario: request → durable abandon → late allow
    // over the SAME v4 wire.
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-f12-abandoned',
    })
    await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(HUMAN_ID),
      requestId: request.requestId,
      reason: 'the human closed the waiting review',
    })
    const lateAllowResponse = await dispatch('team.resolveControl', {
      version: REMOTE_CONTRACT_VERSION_V4,
      params: {
        teamSessionId: P6T4_ROOT,
        requestId: request.requestId,
        decision: 'allow',
      },
    })

    return {
      positiveOk: positiveResponse.ok,
      positiveDecision: (
        dataOf(positiveResponse) as unknown as { decision: ControlDecisionRecord }
      ).decision.decision,
      lateResponse: lateAllowResponse,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------

describe('F12: CONTROL_REQUEST_ABANDONED passes the remote boundary UNMAPPED (invariant 4b)', () => {
  it('the closed backing set carries the terminal-mark code (the single shared definition)', () => {
    expect(REMOTE_BACKING_ERROR_CODE_SET.has('CONTROL_REQUEST_ABANDONED')).toBe(true)
  })

  it('the positive control: a fresh pending request is resolved over the v4 wire (the wiring serves the decision)', () => {
    expect(F12.positiveOk).toBe(true)
    expect(F12.positiveDecision).toBe('allow')
  })

  it('the late allow of an abandoned request is a typed CONTROL_REQUEST_ABANDONED — never internal-error', () => {
    expect(F12.lateResponse.ok).toBe(false)
    const error = errorOf(F12.lateResponse)
    expect(error['code']).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(error['code']).not.toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
  })

  it('the 4b provenance rides the error: the typed cause under details.cause (no stack, no live object)', () => {
    const error = errorOf(F12.lateResponse)
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)
    expect(typeof cause['message']).toBe('string')
  })
})
