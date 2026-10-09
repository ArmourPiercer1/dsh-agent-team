/**
 * a4w1-corrupt-legs.test.ts — A4-PR7 W1 (remote contract v9): the
 * corrupt-leg visibility read `team.listCorruptControlLegs` on the
 * GENERIC dispatcher, closed wire, closed params.
 *
 * RULING 5-B (warning-first): this read is VISIBILITY ONLY. Nothing here
 * touches execution; the file pins the SHAPE of the disclosure — the
 * exact count, the bounded list, the per-row real `disclosesMember`
 * cell — and the refusals around it. The wire law is the exported
 * `corruptControlLegsValue` function, shared by BOTH dispatchers (the
 * s6 production lane imports it by path — the `validateItem`
 * precedent), so what this file pins is what production serves.
 *
 * Laws pinned:
 *  1. the closed response: `{ corruption: { teamSessionId, corruptCount,
 *     truncated, legs } }`; `corruptCount` is the EXACT service count
 *     (the client never counts); legs keep the SERVICE order and slice
 *     at `REMOTE_CORRUPT_CONTROL_LEGS_CAP`, `truncated` says so;
 *  2. version gate: v1–v8 refuse the v9-only method with the typed
 *     `method-version-unsupported` BEFORE any port runs;
 *  3. closed params: exactly `{ teamSessionId }` — any smuggle is
 *     `malformed-params` + reason `unknown-field` before the port;
 *  4. an unwired port is a typed `internal-error` refusal with reason
 *     `port-unwired` — NEVER a silently empty report (an empty report
 *     would tell the human "nothing is corrupt" on the strength of a
 *     wiring gap);
 *  5. a malformed port row is a typed `internal-error` + reason
 *     `port-contract` — the handler never patches an invented cell and
 *     never passes an unknown field through;
 *  6. zero corruption is a WELL-FORMED report (`corruptCount: 0`, empty
 *     legs, `truncated: false`) — the bar hides because the ledger is
 *     clean, not because the read failed.
 *
 * @module @dsh-agent-team/remote/test/a4w1-corrupt-legs
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION_V8,
  REMOTE_CORRUPT_CONTROL_LEGS_CAP,
} from '../src/index.js'
import { expectError, makeDispatcher } from './p8t3-helpers.js'

const SID = 's'.repeat(24)

/** One wire request envelope of contract v9. */
function v9Wire(params: Record<string, unknown>): Record<string, unknown> {
  return { version: 9, params }
}

/** A fake corruption port over a fixed list, counting the calls. */
function corruptionPort(
  corruptLegs: readonly Record<string, unknown>[] | (() => readonly Record<string, unknown>[]),
): { port: { listCorruptLegs: (request: { teamSessionId: string }) => { corruptLegs: never[] } }; calls: string[] } {
  const calls: string[] = []
  return {
    port: {
      listCorruptLegs(request) {
        calls.push(`list:${request.teamSessionId}`)
        const legs = typeof corruptLegs === 'function' ? corruptLegs() : corruptLegs
        return { corruptLegs: legs as never[] }
      },
    },
    calls,
  }
}

/** The corruption cell of a success response. */
function corruptionOf(response: Awaited<ReturnType<ReturnType<typeof makeDispatcher>['dispatch']>>) {
  if (!response.ok) throw new Error(`expected success, got: ${JSON.stringify(response.error)}`)
  return (response.value.data as Record<string, unknown>)['corruption']
}

describe('A4-PR7 W1 (contract v9): team.listCorruptControlLegs', () => {
  it('serves the closed corruption cell, service order verbatim', async () => {
    const legs = [
      { sequence: 12, disclosesMember: false },
      { sequence: 31, disclosesMember: true, requestId: 'req-a4w1-31' },
      { sequence: 44, disclosesMember: true, approvalCaseId: 'case-a4w1-44' },
    ]
    const { port, calls } = corruptionPort(legs)
    const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
    const response = await dispatch('team.listCorruptControlLegs', v9Wire({ teamSessionId: SID }))
    expect(corruptionOf(response)).toEqual({
      teamSessionId: SID,
      corruptCount: 3,
      truncated: false,
      legs,
    })
    expect(calls).toEqual([`list:${SID}`])
  })

  it('the list is BOUNDED and honest: corruptCount stays exact, legs slice at the cap, truncated says so', async () => {
    const legs = Array.from({ length: REMOTE_CORRUPT_CONTROL_LEGS_CAP + 5 }, (_, i) => ({
      sequence: i + 1,
      disclosesMember: false,
    }))
    const { port } = corruptionPort(legs)
    const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
    const corruption = corruptionOf(
      await dispatch('team.listCorruptControlLegs', v9Wire({ teamSessionId: SID })),
    ) as Record<string, unknown>
    expect(corruption['corruptCount']).toBe(legs.length)
    expect((corruption['legs'] as unknown[]).length).toBe(REMOTE_CORRUPT_CONTROL_LEGS_CAP)
    expect(corruption['truncated']).toBe(true)
    // the head of the SERVICE order — never a re-sort, never a sample.
    expect((corruption['legs'] as Record<string, unknown>[])[0]?.['sequence']).toBe(1)
  })

  it('zero corruption is a well-formed report, not an error', async () => {
    const { port } = corruptionPort([])
    const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
    expect(corruptionOf(await dispatch('team.listCorruptControlLegs', v9Wire({ teamSessionId: SID })))).toEqual({
      teamSessionId: SID,
      corruptCount: 0,
      truncated: false,
      legs: [],
    })
  })

  it('v1–v8 refuse the v9-only method typed, before any port runs', async () => {
    const { port, calls } = corruptionPort([])
    const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
    for (const version of [1, 2, 3, 4, 5, 6, 7, REMOTE_CONTRACT_VERSION_V8]) {
      const { error } = expectError(
        await dispatch('team.listCorruptControlLegs', { version, params: { teamSessionId: SID } }),
      )
      expect(error.code, `v${String(version)}`).toBe('method-version-unsupported')
    }
    expect(calls.length, 'a version-refused request never reaches the port').toBe(0)
  })

  it('the param set is CLOSED: any smuggle or omission is malformed-params before the port', async () => {
    const { port, calls } = corruptionPort([])
    const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
    const badParams: Record<string, unknown>[] = [
      { teamSessionId: SID, asRole: 'human-admin' },
      { teamSessionId: SID, limit: 5 },
      { teamSessionId: SID, cursor: '0' },
      { },
    ]
    for (const params of badParams) {
      const { error } = expectError(await dispatch('team.listCorruptControlLegs', v9Wire(params)))
      expect(error.code, JSON.stringify(params)).toBe('malformed-params')
      if (Object.keys(params).length > 0) {
        expect((error.details as unknown as Record<string, unknown>)['reason']).toBe('unknown-field')
      }
    }
    expect(calls.length).toBe(0)
  })

  it('an UNWIRED corruption port is a typed refusal — never a silently empty report', async () => {
    const { dispatch } = makeDispatcher({})
    const { error } = expectError(
      await dispatch('team.listCorruptControlLegs', v9Wire({ teamSessionId: SID })),
    )
    expect(error.code).toBe('internal-error')
    expect((error.details as unknown as Record<string, unknown>)['reason']).toBe('port-unwired')
  })

  it('a malformed port row is a typed port-contract refusal — the handler never patches, never passes through', async () => {
    const malformed: Record<string, unknown>[] = [
      { sequence: 0, disclosesMember: false },
      { sequence: 5 },
      { sequence: 5, disclosesMember: 'yes' },
      { sequence: 5, disclosesMember: false, extra: 'x' },
      { sequence: 5, disclosesMember: false, requestId: '' },
    ]
    for (const leg of malformed) {
      const { port } = corruptionPort([leg])
      const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
      const { error } = expectError(
        await dispatch('team.listCorruptControlLegs', v9Wire({ teamSessionId: SID })),
      )
      expect(error.code, JSON.stringify(leg)).toBe('internal-error')
      expect((error.details as unknown as Record<string, unknown>)['reason'], JSON.stringify(leg)).toBe('port-contract')
    }
    const { port } = corruptionPort((() => 42 as unknown as readonly Record<string, unknown>[]))
    const { dispatch } = makeDispatcher({ teamControlCorruption: port as never })
    const { error } = expectError(
      await dispatch('team.listCorruptControlLegs', v9Wire({ teamSessionId: SID })),
    )
    expect(error.code).toBe('internal-error')
    expect((error.details as unknown as Record<string, unknown>)['reason']).toBe('port-contract')
  })
})
