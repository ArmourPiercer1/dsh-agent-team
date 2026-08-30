/**
 * P3-T6 / G3 criterion 3 — "lifecycle transition matrix fixed".
 *
 * The §29 FSM is frozen data in the pure lifecycle module. This suite
 * re-derives the expected matrix from the frozen operation rules and
 * asserts:
 *
 * 1. the operation rules literal (5 operations, exact sources/targets);
 * 2. the derived transition matrix equals the expected 9-edge literal
 *    (9 of 25 state pairs legal);
 * 3. `canTransition` / `legalTargets` / `assertTransitionLegal` agree with
 *    the matrix over ALL 25 ordered state pairs;
 * 4. all 9 legal edges commit: a new frozen record, `activityVersion + 1`,
 *    input record untouched;
 * 5. all 16 illegal pairs reject with the typed
 *    `LifecycleTransitionError` — `LIFECYCLE_TERMINAL_STATE` from DISPOSED,
 *    `LIFECYCLE_ILLEGAL_TRANSITION` otherwise;
 * 6. the full 5×5 operation × state sweep of `applyLifecycleOperation`
 *    matches the rules exactly (9 commits, 16 typed rejections);
 * 7. RESTORE lands in SETTLED only (frozen 3A — never to RUNNING);
 * 8. DISPOSE is terminal: nothing leaves DISPOSED (invariant: §29.5).
 */

import { describe, expect, it } from 'vitest'

import { MEMBER_LIFECYCLE_STATES } from '../../contracts/src/index.js'
import type { MemberLifecycleState, MemberInstanceRecordDto } from '../../contracts/src/index.js'
import { createMemberInstance } from '../../domain/member/src/index.js'
import type { MemberInstance } from '../../domain/member/src/index.js'
import {
  LIFECYCLE_OPERATION_RULES,
  LIFECYCLE_OPERATION_VALUES,
  LIFECYCLE_TRANSITION_MATRIX,
  applyLifecycleOperation,
  assertTransitionLegal,
  canTransition,
  isTerminalState,
  legalTargets,
  transitionMemberLifecycle,
} from '../../domain/lifecycle/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import { T6_ROOT_SESSION_ID, T6_CREATED_AT, t6InstanceIdAt, t6ChildSessionIdAt } from '../domain/src/index.js'
import { expectCode, expectNoThrow, isDeepFrozen, mulberry32 } from './t6-helpers.js'

const STATES = Object.values(MEMBER_LIFECYCLE_STATES) as MemberLifecycleState[]

/** The expected frozen 9-edge transition matrix (G3-3 literal). */
const EXPECTED_MATRIX: Record<MemberLifecycleState, readonly MemberLifecycleState[]> = {
  CREATED: ['RUNNING', 'DISPOSED'],
  RUNNING: ['SETTLED', 'DISPOSED'],
  SETTLED: ['RUNNING', 'ARCHIVED', 'DISPOSED'],
  ARCHIVED: ['SETTLED', 'DISPOSED'],
  DISPOSED: [],
}

/** The expected frozen operation rules (the §29 FSM in operation form). */
const EXPECTED_RULES: Record<
  LifecycleOperation,
  { sources: readonly MemberLifecycleState[]; target: MemberLifecycleState }
> = {
  ADMIT_WORK: { sources: ['CREATED', 'SETTLED'], target: 'RUNNING' },
  SETTLE: { sources: ['RUNNING'], target: 'SETTLED' },
  ARCHIVE: { sources: ['SETTLED'], target: 'ARCHIVED' },
  RESTORE: { sources: ['ARCHIVED'], target: 'SETTLED' },
  DISPOSE: { sources: ['CREATED', 'RUNNING', 'SETTLED', 'ARCHIVED'], target: 'DISPOSED' },
}

function createFreshRecord(instanceIndex: number): MemberInstanceRecordDto {
  const instance: MemberInstance = createMemberInstance(
    {
      rootSessionId: T6_ROOT_SESSION_ID,
      instanceId: `inst-t6l${String(instanceIndex).padStart(2, '0')}`,
      templateId: 'researcher',
      label: 'Lifecycle',
      childSessionId: `session-child-t6l-${String(instanceIndex).padStart(2, '0')}`,
      createdAt: T6_CREATED_AT,
    },
    [],
  )
  return instance.record
}

/** Materialize a fresh record currently in lifecycle state `state`. */
function recordInState(state: MemberLifecycleState): MemberInstanceRecordDto {
  const rand = mulberry32(99000 + STATES.indexOf(state))
  const index = 1 + Math.floor(rand() * 50)
  let record = createFreshRecord(index)
  if (state === 'CREATED') return record
  if (state === 'DISPOSED') return transitionMemberLifecycle(record, 'DISPOSED')
  record = transitionMemberLifecycle(record, 'RUNNING')
  if (state === 'RUNNING') return record
  record = transitionMemberLifecycle(record, 'SETTLED')
  if (state === 'SETTLED') return record
  return transitionMemberLifecycle(record, 'ARCHIVED')
}

describe('P3-T6 G3-3: lifecycle transition matrix fixed', () => {
  it('the operation rules are the frozen §29 FSM literal', () => {
    expect(LIFECYCLE_OPERATION_VALUES).toEqual([
      'ADMIT_WORK',
      'SETTLE',
      'ARCHIVE',
      'RESTORE',
      'DISPOSE',
    ])
    expect(LIFECYCLE_OPERATION_RULES).toEqual(EXPECTED_RULES)
  })

  it('the derived transition matrix equals the expected 9-edge literal', () => {
    expect(LIFECYCLE_TRANSITION_MATRIX).toEqual(EXPECTED_MATRIX)
    let legalEdges = 0
    for (const from of STATES) {
      for (const to of STATES) {
        if (canTransition(from, to)) legalEdges++
      }
    }
    expect(legalEdges).toBe(9)
  })

  it('canTransition / legalTargets / assertTransitionLegal agree with the matrix over all 25 pairs', () => {
    for (const from of STATES) {
      expect(legalTargets(from)).toEqual(EXPECTED_MATRIX[from])
      for (const to of STATES) {
        const expected = EXPECTED_MATRIX[from].includes(to)
        expect(canTransition(from, to)).toBe(expected)
        if (expected) {
          expectNoThrow(() => assertTransitionLegal(from, to), `legal ${from}→${to}`)
        } else {
          expectCode(
            () => assertTransitionLegal(from, to),
            from === 'DISPOSED' ? 'LIFECYCLE_TERMINAL_STATE' : 'LIFECYCLE_ILLEGAL_TRANSITION',
            `illegal ${from}→${to}`,
          )
        }
      }
    }
  })

  it('all 9 legal edges commit: new frozen record, activityVersion + 1, input untouched', () => {
    for (const from of STATES) {
      for (const to of EXPECTED_MATRIX[from]) {
        const before = recordInState(from)
        const after = transitionMemberLifecycle(before, to)
        expect(after.lifecycle).toBe(to)
        expect(after.activityVersion).toBe(before.activityVersion + 1)
        expect(isDeepFrozen(after)).toBe(true)
        expect(before.lifecycle).toBe(from)
        expect(before.activityVersion).toBe(after.activityVersion - 1)
        expect(after.rootSessionId).toBe(before.rootSessionId)
        expect(after.instanceId).toBe(before.instanceId)
        expect(after.templateId).toBe(before.templateId)
        expect(after.childSessionId).toBe(before.childSessionId)
      }
    }
  })

  it('all 16 illegal pairs reject with the typed LifecycleTransitionError', () => {
    for (const from of STATES) {
      for (const to of STATES) {
        if (canTransition(from, to)) continue
        const record = recordInState(from)
        const error = expectCode(
          () => transitionMemberLifecycle(record, to),
          from === 'DISPOSED' ? 'LIFECYCLE_TERMINAL_STATE' : 'LIFECYCLE_ILLEGAL_TRANSITION',
          `illegal ${from}→${to}`,
        )
        const err = error as { from?: unknown; to?: unknown }
        expect(err.from).toBe(from)
        expect(err.to).toBe(to)
      }
    }
  })

  it('the full 5×5 operation × state sweep of applyLifecycleOperation matches the rules', () => {
    let commits = 0
    let rejections = 0
    for (const state of STATES) {
      const record = recordInState(state)
      for (const op of LIFECYCLE_OPERATION_VALUES) {
        const rule = LIFECYCLE_OPERATION_RULES[op as LifecycleOperation]
        if (rule.sources.includes(state)) {
          const after = applyLifecycleOperation(record, op as LifecycleOperation)
          expect(after.lifecycle).toBe(rule.target)
          commits++
        } else {
          expectCode(
            () => applyLifecycleOperation(record, op as LifecycleOperation),
            state === 'DISPOSED' ? 'LIFECYCLE_TERMINAL_STATE' : 'LIFECYCLE_ILLEGAL_TRANSITION',
            `op ${op} @ ${state}`,
          )
          rejections++
        }
      }
    }
    expect(commits).toBe(9)
    expect(rejections).toBe(16)
  })

  it('RESTORE lands in SETTLED only (frozen 3A — never to RUNNING)', () => {
    const fromArchived = recordInState('ARCHIVED')
    const restored = applyLifecycleOperation(fromArchived, 'RESTORE')
    expect(restored.lifecycle).toBe('SETTLED')
    expect(canTransition('ARCHIVED', 'RUNNING')).toBe(false)
    expectCode(
      () => assertTransitionLegal('ARCHIVED', 'RUNNING'),
      'LIFECYCLE_ILLEGAL_TRANSITION',
      'RESTORE must not jump to RUNNING',
    )
  })

  it('DISPOSED is terminal: nothing leaves it, isTerminalState holds only for DISPOSED', () => {
    for (const state of STATES) {
      expect(isTerminalState(state)).toBe(state === 'DISPOSED')
    }
    const disposed = recordInState('DISPOSED')
    for (const op of LIFECYCLE_OPERATION_VALUES) {
      expectCode(
        () => applyLifecycleOperation(disposed, op as LifecycleOperation),
        'LIFECYCLE_TERMINAL_STATE',
        `op ${op} on DISPOSED`,
      )
    }
    expect(t6InstanceIdAt(1)).toBe('inst-m01')
  })
})
