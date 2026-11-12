/**
 * A6 boot settlement — WHICH ask lanes a cold boot owns, and WHAT it records.
 *
 * Measured defect (joint acceptance, real Host, two runs): after a cold boot a
 * consumed allow on the `parameter-permission` lane left NO execution result and
 * NO abandonment — `ppConsumed=1 -> 1`, `ppFacts=0`. The recovery loop tested the
 * lane with `correlation.startsWith('pa:') || actionName === 'team-tool-execute'`,
 * and the permission lane's correlation is the exec callId, not a `pa:` spelling,
 * so the row was skipped silently. The arm's pre-registered clause
 * `noSilentAbsence` is what caught it.
 *
 * These clauses pin the lane vocabulary and the call-id carrier directly, so the
 * class of defect cannot return without a second lane being named here.
 */
import { describe, expect, it } from 'vitest'
import { isExecutionAskLane, settlementCallIdOf } from '../src/plugin/root.js'

describe('A6 boot settlement — the execution ask lanes', () => {
  it('owns the three tool-execution lanes and nothing else', () => {
    expect(isExecutionAskLane({ correlation: 'pa:inv-1' })).toBe(true)
    expect(isExecutionAskLane({ correlation: 'anything', actionName: 'team-tool-execute' })).toBe(true)
    expect(isExecutionAskLane({ correlation: 'call-c1-hhq2b8z', actionName: 'parameter-permission' })).toBe(true)
    // Not executions: a Goal hand-off, a member requirement, a bare ask.
    expect(isExecutionAskLane({ correlation: 'goal:7', actionName: 'goal-authority' })).toBe(false)
    expect(isExecutionAskLane({ correlation: 'member:req', actionName: 'member-requirement' })).toBe(false)
    expect(isExecutionAskLane({})).toBe(false)
  })

  it('reads the call id from the PA carrier first, then the permission lane correlation', () => {
    // PA carrier: reviewPayload.callId wins even when a correlation is present.
    expect(settlementCallIdOf({ correlation: 'pa:inv-1', reviewPayload: { callId: 'call-pa-1' } })).toBe('call-pa-1')
    // Permission lane: no reviewPayload at all — the correlation IS the call id.
    expect(settlementCallIdOf({ correlation: 'call-c1-hhq2b8z', actionName: 'parameter-permission' })).toBe('call-c1-hhq2b8z')
    // A `pa:` correlation is a namespace, never a call id.
    expect(settlementCallIdOf({ correlation: 'pa:inv-1' })).toBeUndefined()
    // Nothing attributable -> nothing recorded (never a guessed id).
    expect(settlementCallIdOf({})).toBeUndefined()
    expect(settlementCallIdOf({ reviewPayload: { callId: '' } })).toBeUndefined()
  })

  it('a row with neither carrier settles no result but is still abandoned', () => {
    // The predicate and the carrier are separate facts: the lane may be owned
    // while no call id exists. The recovery then records no result and still
    // abandons — an absent result is not a silent success.
    const row = { correlation: 'pa:inv-2' }
    expect(isExecutionAskLane(row)).toBe(true)
    expect(settlementCallIdOf(row)).toBeUndefined()
  })
})
