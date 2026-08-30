/**
 * P3-T3 — lifecycle property tests (TaskDoc §11.4 P3-T3: "property tests").
 *
 * Strategy: deterministic random walks over the §29 FSM. For a battery of
 * fixed seeds, a walk starts in CREATED and applies 50 random operations.
 * At every step the following invariants must hold (they are the "properties"):
 *
 *  - P1 the state is always one of the five contract lifecycle states;
 *  - P2 an operation succeeds IFF its rule lists the current state as a
 *    source (the operation-level property; the (state, target) pair being a
 *    legal edge is necessary but not sufficient — operations must not alias
 *    each other, e.g. RESTORE from RUNNING must NOT commit the SETTLE edge);
 *  - P3 on success the walk's record is a NEW frozen record in the rule's
 *    target state with `activityVersion = 1 + (successful operations so far)`
 *    — exactly one durable change per commit (D3);
 *  - P4 identity fields and `createdAt` never change along the walk;
 *  - P5 once the walk reaches DISPOSED (terminal, §29.5), every further
 *    operation fails with reason TERMINAL_STATE and the record is unchanged;
 *  - P6 determinism: the same seed produces the identical
 *    success/failure pattern and the same final state.
 *
 * A final coverage assertion verifies that across the battery every one of
 * the 9 legal (from, to) edges actually fired in some walk (the random
 * battery is sized so this is certain for the fixed seeds).
 *
 * Pure test: no I/O, no Agent/Session handle; the PRNG is a hand-rolled
 * deterministic mulberry32 (t3-helpers).
 * @module domain/test/t3-lifecycle-property
 */

import { describe, expect, it } from 'vitest'

import {
  MEMBER_LIFECYCLE_STATES,
  TEAM_CONTRACT_SCHEMA_VERSION,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js'
import {
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATIONS,
  LIFECYCLE_OPERATION_RULES,
  applyLifecycleOperation,
  isLifecycleTransitionError,
  isTerminalState,
} from '../lifecycle/src/index.js'
import type { LifecycleOperation } from '../lifecycle/src/index.js'
import { expectThrows, instanceId, makeMemberRecord, mulberry32, rootSessionId } from './t3-helpers.js'

const { CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED } = MEMBER_LIFECYCLE_STATES

const STATES: readonly MemberLifecycleState[] = [CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED]

const OPS: readonly LifecycleOperation[] = [
  LIFECYCLE_OPERATIONS.ADMIT_WORK,
  LIFECYCLE_OPERATIONS.SETTLE,
  LIFECYCLE_OPERATIONS.ARCHIVE,
  LIFECYCLE_OPERATIONS.RESTORE,
  LIFECYCLE_OPERATIONS.DISPOSE,
]

const SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
const STEPS_PER_SEED = 50

const ROOT = rootSessionId('session-root-p3t3-prop')
const WALKER_ID = instanceId('inst-walker')

/** The ground-truth legal edges (independent of the module under test). */
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

interface WalkStep {
  from: MemberLifecycleState
  op: LifecycleOperation
  ok: boolean
}

interface WalkResult {
  /** One entry per attempted operation. */
  steps: readonly WalkStep[]
  finalState: MemberLifecycleState
  finalActivityVersion: number
}

/**
 * Run one deterministic walk from CREATED: `stepsPerSeed` random operations.
 * Enforces the per-step invariants P1–P5 as it goes (a violation throws and
 * fails the test).
 */
function runWalk(seed: number, stepsPerSeed: number): WalkResult {
  const rng = mulberry32(seed)
  let record = makeMemberRecord(ROOT, WALKER_ID, { lifecycle: CREATED })
  const steps: WalkStep[] = []
  let disposedAt = -1

  for (let i = 0; i < stepsPerSeed; i += 1) {
    const opIndex = Math.floor(rng() * OPS.length)
    const op = OPS[opIndex] as LifecycleOperation
    const from = record.lifecycle
    const rule = LIFECYCLE_OPERATION_RULES[op]
    const legal = rule.sources.includes(from)

    let ok = true
    if (legal) {
      const next = applyLifecycleOperation(record, op)
      // P1
      expect(STATES.includes(next.lifecycle)).toBe(true)
      // P3: NEW frozen record, target state, exactly one durable change.
      expect(next).not.toBe(record)
      expect(Object.isFrozen(next)).toBe(true)
      expect(next.lifecycle).toBe(rule.target)
      expect(next.activityVersion).toBe(record.activityVersion + 1)
      // P4: identity + createdAt stable.
      expect(next.rootSessionId).toBe(record.rootSessionId)
      expect(next.instanceId).toBe(record.instanceId)
      expect(next.templateId).toBe(record.templateId)
      expect(next.label).toBe(record.label)
      expect(next.childSessionId).toBe(record.childSessionId)
      expect(next.createdAt).toBe(record.createdAt)
      expect(next.schemaVersion).toBe(TEAM_CONTRACT_SCHEMA_VERSION)
      record = next
      if (rule.target === DISPOSED) disposedAt = i
    } else {
      ok = false
      const threw = expectThrows(
        () => applyLifecycleOperation(record, op),
        isLifecycleTransitionError,
        `rejection of ${op} from ${from} (seed ${seed}, step ${i})`,
      )
      const err = threw as { reason: string; from: MemberLifecycleState; to: MemberLifecycleState; code: string }
      expect(err.from).toBe(from)
      expect(err.to).toBe(rule.target)
      if (from === DISPOSED) {
        // P5: after the terminal state, everything is a terminal rejection.
        expect(err.reason).toBe('TERMINAL_STATE')
        expect(err.code).toBe(LIFECYCLE_DOMAIN_ERROR_CODES.TERMINAL_STATE)
      } else {
        expect(err.reason).toBe('ILLEGAL_TRANSITION')
        expect(err.code).toBe(LIFECYCLE_DOMAIN_ERROR_CODES.ILLEGAL_TRANSITION)
      }
      // the record is untouched
      expect(record.lifecycle).toBe(from)
      expect(record.activityVersion).toBe(1 + (steps.filter((s) => s.ok).length))
    }
    steps.push({ from, op, ok })
    // P5 (state part): once disposed, the state stays disposed.
    if (disposedAt !== -1) {
      expect(record.lifecycle).toBe(DISPOSED)
      expect(isTerminalState(record.lifecycle)).toBe(true)
    }
  }

  // P3 (global): activityVersion = 1 + number of successful commits.
  const successes = steps.filter((s) => s.ok).length
  expect(record.activityVersion).toBe(1 + successes)
  return { steps, finalState: record.lifecycle, finalActivityVersion: record.activityVersion }
}

describe('P3-T3 lifecycle property tests: random walks over the §29 FSM', () => {
  it('P1–P5 hold at every step for every seed of the battery', () => {
    let totalSteps = 0
    for (const seed of SEEDS) {
      const result = runWalk(seed, STEPS_PER_SEED)
      totalSteps += result.steps.length
      expect(result.steps.length).toBe(STEPS_PER_SEED)
      expect(STATES.includes(result.finalState)).toBe(true)
    }
    expect(totalSteps).toBe(SEEDS.length * STEPS_PER_SEED)
  })

  it('P6: identical seeds produce identical success/failure patterns and final states', () => {
    const patternOf = (seed: number): readonly (0 | 1)[] =>
      runWalk(seed, STEPS_PER_SEED).steps.map((s) => (s.ok ? 1 : 0))
    for (const seed of [1, 7, 25]) {
      expect(patternOf(seed)).toEqual(patternOf(seed))
    }
    // and different (fixed) seeds must not accidentally all collapse to one pattern
    const patterns = new Set(SEEDS.slice(0, 5).map((s) => JSON.stringify(patternOf(s))))
    expect(patterns.size).toBeGreaterThan(1)
  })

  it('coverage: across the battery, all 9 legal (from, to) edges actually fired', () => {
    const fired = new Set<string>()
    for (const seed of SEEDS) {
      const result = runWalk(seed, STEPS_PER_SEED)
      for (const step of result.steps) {
        if (!step.ok) continue
        const target = LIFECYCLE_OPERATION_RULES[step.op].target
        fired.add(`${step.from}->${target}`)
      }
    }
    for (const [from, to] of LEGAL_EDGES) {
      expect(fired.has(`${from}->${to}`)).toBe(true)
    }
    // and no illegal (from, to) pair ever fired on a "successful" step
    const allPairs = new Set<string>()
    for (const from of STATES) {
      for (const to of STATES) allPairs.add(`${from}->${to}`)
    }
    for (const pair of fired) {
      expect(LEGAL_EDGES.some(([f, t]) => `${f}->${t}` === pair)).toBe(true)
    }
    expect(allPairs.size).toBe(25)
  })

  it('every walk that reaches DISPOSED stays there for all remaining steps (terminal lock)', () => {
    let terminalWalks = 0
    for (const seed of SEEDS) {
      const result = runWalk(seed, STEPS_PER_SEED)
      const disposeIndex = result.steps.findIndex((s) => s.ok && s.from !== DISPOSED && LIFECYCLE_OPERATION_RULES[s.op].target === DISPOSED)
      if (disposeIndex === -1) continue
      terminalWalks += 1
      for (let i = disposeIndex + 1; i < result.steps.length; i += 1) {
        const step = result.steps[i] as WalkStep
        expect(step.from).toBe(DISPOSED)
        expect(step.ok).toBe(false)
      }
    }
    expect(terminalWalks).toBeGreaterThan(0)
  })
})
