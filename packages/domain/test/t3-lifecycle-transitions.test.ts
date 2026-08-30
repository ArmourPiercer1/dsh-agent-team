/**
 * P3-T3 — lifecycle transition TABLE tests (Architecture §29 FSM, §30).
 *
 * TaskDoc §11.4 P3-T3 requires: "invalid transition matrix — every illegal
 * (from, to) pair rejected with a typed error". This file covers the full
 * 5×5 state space:
 *
 *  - the frozen legal edge set (9 of 25 pairs) as an independent data
 *    constant, cross-checked against the derived
 *    {@link LIFECYCLE_TRANSITION_MATRIX};
 *  - `canTransition` / `legalTargets` / `isTerminalState` agree with it;
 *  - every legal pair commits: NEW frozen record, target state,
 *    `activityVersion + 1` (D3), identity + `createdAt` preserved (D2),
 *    input never mutated;
 *  - every illegal pair (16) throws a typed `LifecycleTransitionError` with
 *    the exact (from, to), the exact reason, and a code DISJOINT from the
 *    frozen contracts error vocabulary (it must not be a TeamContractError);
 *  - acceptance semantics: **Restore is ONLY legal ARCHIVED→SETTLED**
 *    (§30.2 frozen 3A — never to RUNNING), Archive commits only from the
 *    quiescent SETTLED state (§30.1), DISPOSED is terminal (§29.5), and a
 *    full §41.6-style path commits end to end.
 *
 * Pure test: no I/O, no Agent/Session handle.
 * @module domain/test/t3-lifecycle-transitions
 */

import { describe, expect, it } from 'vitest'

import {
  MEMBER_LIFECYCLE_STATES,
  TEAM_CONTRACT_SCHEMA_VERSION,
  isTeamContractError,
} from '../../contracts/src/index.js'
import type {
  MemberInstanceRecordDto,
  MemberLifecycleState,
} from '../../contracts/src/index.js'
import {
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATIONS,
  LIFECYCLE_OPERATION_RULES,
  LIFECYCLE_TRANSITION_MATRIX,
  applyLifecycleOperation,
  canTransition,
  isLifecycleTransitionError,
  isTerminalState,
  legalTargets,
  transitionMemberLifecycle,
} from '../lifecycle/src/index.js'
import type { LifecycleOperation } from '../lifecycle/src/index.js'
import { expectThrows, instanceId, makeMemberRecord, rootSessionId } from './t3-helpers.js'

const { CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED } = MEMBER_LIFECYCLE_STATES

const STATES: readonly MemberLifecycleState[] = [CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED]

/** Every operation, in vocabulary order (typed, for the 5×5 op sweep). */
const ALL_OPERATIONS: readonly LifecycleOperation[] = [
  LIFECYCLE_OPERATIONS.ADMIT_WORK,
  LIFECYCLE_OPERATIONS.SETTLE,
  LIFECYCLE_OPERATIONS.ARCHIVE,
  LIFECYCLE_OPERATIONS.RESTORE,
  LIFECYCLE_OPERATIONS.DISPOSE,
]

const ROOT = rootSessionId('session-root-p3t3-life')

/** A distinct instance id per state keeps each fixture record unambiguous. */
const STATE_INSTANCE_ID: Record<MemberLifecycleState, ReturnType<typeof instanceId>> = {
  CREATED: instanceId('inst-created'),
  RUNNING: instanceId('inst-running'),
  SETTLED: instanceId('inst-settled'),
  ARCHIVED: instanceId('inst-archived'),
  DISPOSED: instanceId('inst-disposed'),
}

function recordIn(state: MemberLifecycleState): MemberInstanceRecordDto {
  return makeMemberRecord(ROOT, STATE_INSTANCE_ID[state], { lifecycle: state })
}

/**
 * The frozen legal edge set (Architecture §29) — the "transition table".
 * Independent from the module under test (which derives its matrix from the
 * operation rules): this constant is the ground truth both must agree with.
 */
const LEGAL_EDGES: ReadonlyArray<readonly [MemberLifecycleState, MemberLifecycleState]> = [
  [CREATED, RUNNING],
  [CREATED, DISPOSED],
  [RUNNING, SETTLED],
  [RUNNING, DISPOSED],
  [SETTLED, RUNNING],
  [SETTLED, ARCHIVED],
  [SETTLED, DISPOSED],
  [ARCHIVED, SETTLED],
  [ARCHIVED, DISPOSED],
]

function isLegalPair(from: MemberLifecycleState, to: MemberLifecycleState): boolean {
  return LEGAL_EDGES.some(([f, t]) => f === from && t === to)
}

/** Structural view of the typed error for field-level assertions. */
interface TransitionErrorShape {
  code: string
  reason: 'TERMINAL_STATE' | 'ILLEGAL_TRANSITION'
  from: MemberLifecycleState
  to: MemberLifecycleState
  name: string
}

describe('P3-T3 lifecycle transition matrix (Architecture §29)', () => {
  it('the derived matrix equals exactly the 9 legal §29 edges', () => {
    expect(LIFECYCLE_TRANSITION_MATRIX[CREATED]).toEqual([RUNNING, DISPOSED])
    expect(LIFECYCLE_TRANSITION_MATRIX[RUNNING]).toEqual([SETTLED, DISPOSED])
    expect(LIFECYCLE_TRANSITION_MATRIX[SETTLED]).toEqual([RUNNING, ARCHIVED, DISPOSED])
    expect(LIFECYCLE_TRANSITION_MATRIX[ARCHIVED]).toEqual([SETTLED, DISPOSED])
    expect(LIFECYCLE_TRANSITION_MATRIX[DISPOSED]).toEqual([])
  })

  it('DISPOSED is the only terminal state', () => {
    for (const state of STATES) {
      expect(isTerminalState(state)).toBe(state === DISPOSED)
    }
  })

  it('canTransition agrees with the frozen legal edge set for all 25 (from, to) pairs', () => {
    let legalSeen = 0
    let illegalSeen = 0
    for (const from of STATES) {
      for (const to of STATES) {
        expect(canTransition(from, to)).toBe(isLegalPair(from, to))
        if (isLegalPair(from, to)) legalSeen += 1
        else illegalSeen += 1
      }
    }
    expect(legalSeen).toBe(9)
    expect(illegalSeen).toBe(16)
  })

  it('legalTargets lists exactly the legal edge targets for every state', () => {
    for (const from of STATES) {
      const expected = LEGAL_EDGES.filter(([f]) => f === from).map(([, t]) => t)
      expect(legalTargets(from)).toEqual(expected)
    }
  })
})

describe('P3-T3 lifecycle: every legal (from, to) pair commits', () => {
  it('all 9 legal pairs succeed: target state, activityVersion + 1, identity preserved, input untouched', () => {
    let checked = 0
    for (const [from, to] of LEGAL_EDGES) {
      const record = recordIn(from)
      const committed = transitionMemberLifecycle(record, to)
      checked += 1
      expect(committed.lifecycle).toBe(to)
      expect(committed.activityVersion).toBe(record.activityVersion + 1)
      // D2: identity fields and createdAt preserved verbatim.
      expect(committed.rootSessionId).toBe(record.rootSessionId)
      expect(committed.instanceId).toBe(record.instanceId)
      expect(committed.templateId).toBe(record.templateId)
      expect(committed.label).toBe(record.label)
      expect(committed.childSessionId).toBe(record.childSessionId)
      expect(committed.createdAt).toBe(record.createdAt)
      expect(committed.schemaVersion).toBe(TEAM_CONTRACT_SCHEMA_VERSION)
      // D2/D3: a NEW frozen record; the input was never mutated.
      expect(committed).not.toBe(record)
      expect(Object.isFrozen(committed)).toBe(true)
      expect(record.lifecycle).toBe(from)
      expect(record.activityVersion).toBe(1)
    }
    expect(checked).toBe(9)
  })

  it('every legal edge is reachable by its operation(s) with the same commit semantics', () => {
    for (const [from, to] of LEGAL_EDGES) {
      const owners = ALL_OPERATIONS.filter((op) => {
        const rule = LIFECYCLE_OPERATION_RULES[op]
        return rule.sources.includes(from) && rule.target === to
      })
      expect(owners.length).toBeGreaterThan(0)
      for (const op of owners) {
        const record = recordIn(from)
        const next = applyLifecycleOperation(record, op)
        expect(next.lifecycle).toBe(to)
        expect(next.activityVersion).toBe(record.activityVersion + 1)
        expect(next.instanceId).toBe(record.instanceId)
      }
    }
  })
})

describe('P3-T3 lifecycle: every illegal (from, to) pair is rejected with a typed error', () => {
  it('all 16 illegal pairs throw LifecycleTransitionError with exact from/to/reason/code', () => {
    let checked = 0
    for (const from of STATES) {
      for (const to of STATES) {
        if (isLegalPair(from, to)) continue
        checked += 1
        const record = recordIn(from)
        const threw = expectThrowsLifecycle(
          () => transitionMemberLifecycle(record, to),
          `LifecycleTransitionError for ${from} -> ${to}`,
        )
        const err = threw as TransitionErrorShape
        expect(err.from).toBe(from)
        expect(err.to).toBe(to)
        const isTerminalRejection = from === DISPOSED
        expect(err.reason).toBe(isTerminalRejection ? 'TERMINAL_STATE' : 'ILLEGAL_TRANSITION')
        expect(err.code).toBe(
          isTerminalRejection
            ? LIFECYCLE_DOMAIN_ERROR_CODES.TERMINAL_STATE
            : LIFECYCLE_DOMAIN_ERROR_CODES.ILLEGAL_TRANSITION,
        )
        // Disjoint from the frozen contracts error vocabulary.
        expect(isTeamContractError(threw)).toBe(false)
        // The record was untouched.
        expect(record.lifecycle).toBe(from)
        expect(record.activityVersion).toBe(1)
      }
    }
    expect(checked).toBe(16)
  })

  it('self-transitions are illegal for all five states (with the right reason split)', () => {
    for (const from of STATES) {
      const record = recordIn(from)
      const threw = expectThrowsLifecycle(
        () => transitionMemberLifecycle(record, from),
        `self-transition ${from} -> ${from}`,
      )
      const err = threw as TransitionErrorShape
      expect(err.from).toBe(from)
      expect(err.to).toBe(from)
      expect(err.reason).toBe(from === DISPOSED ? 'TERMINAL_STATE' : 'ILLEGAL_TRANSITION')
      expect(err.code).toBe(
        from === DISPOSED
          ? LIFECYCLE_DOMAIN_ERROR_CODES.TERMINAL_STATE
          : LIFECYCLE_DOMAIN_ERROR_CODES.ILLEGAL_TRANSITION,
      )
    }
  })
})

describe('P3-T3 lifecycle: operation-level rules (§29/§30)', () => {
  it('operation rules encode the frozen §29/§30 sources and targets', () => {
    expect(LIFECYCLE_OPERATION_RULES[LIFECYCLE_OPERATIONS.ADMIT_WORK]).toEqual({
      sources: [CREATED, SETTLED],
      target: RUNNING,
    })
    expect(LIFECYCLE_OPERATION_RULES[LIFECYCLE_OPERATIONS.SETTLE]).toEqual({
      sources: [RUNNING],
      target: SETTLED,
    })
    expect(LIFECYCLE_OPERATION_RULES[LIFECYCLE_OPERATIONS.ARCHIVE]).toEqual({
      sources: [SETTLED],
      target: ARCHIVED,
    })
    expect(LIFECYCLE_OPERATION_RULES[LIFECYCLE_OPERATIONS.RESTORE]).toEqual({
      sources: [ARCHIVED],
      target: SETTLED,
    })
    expect(LIFECYCLE_OPERATION_RULES[LIFECYCLE_OPERATIONS.DISPOSE]).toEqual({
      sources: [CREATED, RUNNING, SETTLED, ARCHIVED],
      target: DISPOSED,
    })
  })

  it('5×5 operation sweep: succeeds iff the state is a legal source of that operation', () => {
    for (const from of STATES) {
      for (const op of ALL_OPERATIONS) {
        const rule = LIFECYCLE_OPERATION_RULES[op]
        const record = recordIn(from)
        if (rule.sources.includes(from)) {
          const next = applyLifecycleOperation(record, op)
          expect(next.lifecycle).toBe(rule.target)
          expect(next.activityVersion).toBe(record.activityVersion + 1)
        } else {
          expectThrowsLifecycle(() => applyLifecycleOperation(record, op), `${op} from ${from}`)
        }
      }
    }
  })
})

describe('P3-T3 lifecycle: acceptance semantics', () => {
  it('Restore is ONLY legal from ARCHIVED to SETTLED (Architecture §30.2 frozen 3A)', () => {
    // the one legal restore
    const archived = recordIn(ARCHIVED)
    const restored = applyLifecycleOperation(archived, LIFECYCLE_OPERATIONS.RESTORE)
    expect(restored.lifecycle).toBe(SETTLED)
    expect(restored.activityVersion).toBe(archived.activityVersion + 1)
    // never to RUNNING directly (no model call / turn / Agent residency for restore)
    expect(canTransition(ARCHIVED, RUNNING)).toBe(false)
    // restore from any other state is rejected
    for (const from of [CREATED, RUNNING, SETTLED, DISPOSED]) {
      expectThrowsLifecycle(
        () => applyLifecycleOperation(recordIn(from), LIFECYCLE_OPERATIONS.RESTORE),
        `RESTORE from ${from}`,
      )
    }
    // pair-level truth: SETTLED has exactly two incoming sources — RUNNING (via SETTLE) and ARCHIVED (via RESTORE)
    for (const from of STATES) {
      expect(canTransition(from, SETTLED)).toBe(from === RUNNING || from === ARCHIVED)
    }
  })

  it('Archive commits only from the quiescent SETTLED state (§30.1)', () => {
    const settled = recordIn(SETTLED)
    const archived = applyLifecycleOperation(settled, LIFECYCLE_OPERATIONS.ARCHIVE)
    expect(archived.lifecycle).toBe(ARCHIVED)
    expect(archived.activityVersion).toBe(settled.activityVersion + 1)
    for (const from of [CREATED, RUNNING, ARCHIVED, DISPOSED]) {
      expectThrowsLifecycle(
        () => applyLifecycleOperation(recordIn(from), LIFECYCLE_OPERATIONS.ARCHIVE),
        `ARCHIVE from ${from}`,
      )
    }
  })

  it('Dispose is legal from every non-terminal state; DISPOSED accepts nothing (§29.5/§30.4)', () => {
    for (const from of [CREATED, RUNNING, SETTLED, ARCHIVED]) {
      const record = recordIn(from)
      const next = applyLifecycleOperation(record, LIFECYCLE_OPERATIONS.DISPOSE)
      expect(next.lifecycle).toBe(DISPOSED)
      expect(next.activityVersion).toBe(record.activityVersion + 1)
    }
    for (const to of STATES) {
      expectThrowsLifecycle(
        () => transitionMemberLifecycle(recordIn(DISPOSED), to),
        `DISPOSED -> ${to}`,
      )
    }
  })

  it('a full §41.6-style path commits: RUNNING→SETTLE→ARCHIVE→RESTORE→ADMIT_WORK', () => {
    const record = recordIn(RUNNING)
    const settled = applyLifecycleOperation(record, LIFECYCLE_OPERATIONS.SETTLE)
    expect(settled.lifecycle).toBe(SETTLED)
    const archived = applyLifecycleOperation(settled, LIFECYCLE_OPERATIONS.ARCHIVE)
    expect(archived.lifecycle).toBe(ARCHIVED)
    const restored = applyLifecycleOperation(archived, LIFECYCLE_OPERATIONS.RESTORE)
    expect(restored.lifecycle).toBe(SETTLED)
    const running = applyLifecycleOperation(restored, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(running.lifecycle).toBe(RUNNING)
    expect(running.activityVersion).toBe(record.activityVersion + 4)
  })
})

/** Shim has no argument-taking toThrow, so typed errors are captured + asserted. */
function expectThrowsLifecycle(fn: () => unknown, label: string): unknown {
  return expectThrows(fn, (e) => isLifecycleTransitionError(e), label)
}
