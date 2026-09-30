/**
 * pre-alpha3 PR-C §C.5 — the unified runtime capability status (plan §C.5):
 * the EPHEMERAL 4-axis view of one capability + the closed materialization
 * vocabulary (`not-applicable | pending | mounted | failed`).
 *
 * Locks the derivation contract:
 * - cold → `not-applicable` (derived from liveness, never a fabricated
 *   failure — a cold member's capabilities are not-applicable, never
 *   `failed`);
 * - resuming → `pending` (it will be mounted);
 * - resident → `mounted` (a live fiber) / `failed` (an isolated failure slot)
 *   / `pending` (the reconcile has not yet run for this capability).
 *
 * Pure test: the derivation is a pure function over liveness + the slot.
 */
import { describe, expect, it } from 'vitest'
import {
  deriveMaterializationStatus,
  MATERIALIZATION_STATES,
  MATERIALIZATION_STATE_VALUES,
  MEMBER_LIVENESS,
  POLICY_AXIS,
  SUPPLY_AXIS,
  type RuntimeCapabilityStatus,
} from '../readiness/index.js'

describe('PR-C C.5 — the unified runtime capability status', () => {
  it('the materialization vocabulary is exactly not-applicable | pending | mounted | failed (closed 4-set)', () => {
    expect([...MATERIALIZATION_STATE_VALUES].sort()).toEqual(
      ['failed', 'mounted', 'not-applicable', 'pending'],
    )
    expect(MATERIALIZATION_STATES.notApplicable).toBe('not-applicable')
    expect(MATERIALIZATION_STATES.pending).toBe('pending')
    expect(MATERIALIZATION_STATES.mounted).toBe('mounted')
    expect(MATERIALIZATION_STATES.failed).toBe('failed')
  })

  it('a COLD member is not-applicable (derived from liveness, never a fabricated failure — even with a stale slot)', () => {
    expect(deriveMaterializationStatus({ liveness: MEMBER_LIVENESS.cold })).toBe('not-applicable')
    // A stale `failed` slot never fabricates a failure for a cold member.
    expect(
      deriveMaterializationStatus({
        liveness: MEMBER_LIVENESS.cold,
        slot: { status: 'failed', attempts: 3, lastAttemptAt: 1, reason: 'down' },
      }),
    ).toBe('not-applicable')
  })

  it('a RESUMING member is pending (it will be mounted)', () => {
    expect(deriveMaterializationStatus({ liveness: MEMBER_LIVENESS.resuming })).toBe('pending')
  })

  it('a RESIDENT member with a mounted slot is mounted', () => {
    expect(
      deriveMaterializationStatus({
        liveness: MEMBER_LIVENESS.resident,
        slot: { status: 'mounted', attempts: 1, lastAttemptAt: 1 },
      }),
    ).toBe('mounted')
  })

  it('a RESIDENT member with a failed slot is failed (the isolated per-server failure)', () => {
    expect(
      deriveMaterializationStatus({
        liveness: MEMBER_LIVENESS.resident,
        slot: { status: 'failed', attempts: 2, lastAttemptAt: 1, reason: 'beta down' },
      }),
    ).toBe('failed')
  })

  it('a RESIDENT member with NO slot yet is pending (the reconcile has not run for this capability)', () => {
    expect(deriveMaterializationStatus({ liveness: MEMBER_LIVENESS.resident })).toBe('pending')
  })

  it('the 4-axis status shape carries the policy / supply / readiness / materialization axes', () => {
    const status: RuntimeCapabilityStatus = {
      capabilityType: 'mcpServer',
      capabilityName: 'alpha',
      policy: POLICY_AXIS.allowed,
      supply: SUPPLY_AXIS.configured,
      readiness: 'reachable',
      materialization: MATERIALIZATION_STATES.mounted,
    }
    expect(status.policy).toBe('allowed')
    expect(status.supply).toBe('configured')
    expect(status.readiness).toBe('reachable')
    expect(status.materialization).toBe('mounted')
    // The readiness axis is the 3-state probe verdict (unknown | reachable |
    // unreachable) — distinct from the materialization axis.
    const cold: RuntimeCapabilityStatus = { ...status, readiness: 'unknown', materialization: MATERIALIZATION_STATES.notApplicable }
    expect(cold.materialization).toBe('not-applicable')
  })
})
