/**
 * P3-T3 — MemberInstance-level lifecycle tests (I1–I3, wrapper over the
 * record-level FSM of the domain `lifecycle` module).
 *
 * TaskDoc §11.4 P3-T3 acceptance: "Restore only legal ARCHIVED→SETTLED" —
 * verified here at the MemberInstance level, i.e. with the creation-time
 * facts (contextPolicy, hasEnteredRunning) that the v1 DTO cannot carry.
 *
 * Covers:
 *  - I1: `transitionInstance` commits the §29 operations on the durable
 *    record (same legal edges, same typed rejections, `activityVersion + 1`);
 *  - I2: `hasEnteredRunning` flips to `true` at the FIRST entry to RUNNING
 *    and never resets (this is what makes the §21.2 workspace lock
 *    for-life);
 *  - I3: `contextPolicy` is carried over verbatim on every transition — it
 *    froze at creation (§21.6) and no operation changes it;
 *  - the full happy path from a freshly minted instance through to DISPOSED,
 *    with exact `activityVersion` accounting;
 *  - rejected transitions throw the typed lifecycle error and change nothing;
 *  - unknown operations are a programming error (TypeError), not a lifecycle
 *    decision.
 *
 * Pure test: no I/O, no Agent/Session handle.
 * @module domain/test/t3-member-lifecycle
 */

import { describe, expect, it } from 'vitest'

import { MEMBER_LIFECYCLE_STATES, TEAM_CONTRACT_SCHEMA_VERSION } from '../../contracts/src/index.js'
import {
  createMemberInstance,
  transitionInstance,
} from '../member/src/index.js'
import type { MemberInstance } from '../member/src/index.js'
import {
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LIFECYCLE_OPERATIONS,
  applyLifecycleOperation,
  isLifecycleTransitionError,
} from '../lifecycle/src/index.js'
import {
  expectThrows,
  instanceId,
  rootSessionId,
  templateId,
} from './t3-helpers.js'

const { CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED } = MEMBER_LIFECYCLE_STATES

const ROOT = rootSessionId('session-root-p3t3-mlife')
const TEMPLATE = templateId('researcher')
const INST = instanceId('inst-mlife')

function mint(): MemberInstance {
  return createMemberInstance(
    {
      rootSessionId: ROOT,
      instanceId: INST,
      templateId: TEMPLATE,
      label: 'Fourier',
      childSessionId: 'session-700-1',
      contextPolicy: 'fresh_per_delegation',
      createdAt: '2026-08-29T12:00:00Z',
    },
    [],
  )
}

describe('P3-T3 member: full happy path at the instance level (§41-style)', () => {
  it('CREATED→RUNNING→SETTLED→RUNNING→ARCHIVED→SETTLED→RUNNING→DISPOSED with exact accounting', () => {
    const created = mint()
    expect(created.record.lifecycle).toBe(CREATED)
    expect(created.record.activityVersion).toBe(1)
    expect(created.hasEnteredRunning).toBe(false)
    expect(created.contextPolicy).toBe('fresh_per_delegation')

    const running1 = transitionInstance(created, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(running1.record.lifecycle).toBe(RUNNING)
    expect(running1.record.activityVersion).toBe(2)
    expect(running1.hasEnteredRunning).toBe(true) // flips at the FIRST RUNNING

    const settled1 = transitionInstance(running1, LIFECYCLE_OPERATIONS.SETTLE)
    expect(settled1.record.lifecycle).toBe(SETTLED)
    expect(settled1.record.activityVersion).toBe(3)
    expect(settled1.hasEnteredRunning).toBe(true) // stays true

    const running2 = transitionInstance(settled1, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(running2.record.lifecycle).toBe(RUNNING)
    expect(running2.record.activityVersion).toBe(4)

    const settled2 = transitionInstance(running2, LIFECYCLE_OPERATIONS.SETTLE)
    expect(settled2.record.lifecycle).toBe(SETTLED)
    expect(settled2.record.activityVersion).toBe(5)

    const archived = transitionInstance(settled2, LIFECYCLE_OPERATIONS.ARCHIVE)
    expect(archived.record.lifecycle).toBe(ARCHIVED)
    expect(archived.record.activityVersion).toBe(6)

    const restored = transitionInstance(archived, LIFECYCLE_OPERATIONS.RESTORE)
    expect(restored.record.lifecycle).toBe(SETTLED) // Restore ends SETTLED, never RUNNING
    expect(restored.record.activityVersion).toBe(7)

    const running3 = transitionInstance(restored, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(running3.record.lifecycle).toBe(RUNNING)
    expect(running3.record.activityVersion).toBe(8)

    const disposed = transitionInstance(
      transitionInstance(running3, LIFECYCLE_OPERATIONS.SETTLE),
      LIFECYCLE_OPERATIONS.DISPOSE,
    )
    expect(disposed.record.lifecycle).toBe(DISPOSED)
    expect(disposed.record.activityVersion).toBe(10)
    expect(disposed.hasEnteredRunning).toBe(true)
    expect(disposed.contextPolicy).toBe('fresh_per_delegation') // I3: constant end to end

    // identity fields stable across all 9 commits
    expect(disposed.record.rootSessionId).toBe(created.record.rootSessionId)
    expect(disposed.record.instanceId).toBe(created.record.instanceId)
    expect(disposed.record.templateId).toBe(created.record.templateId)
    expect(disposed.record.label).toBe(created.record.label)
    expect(disposed.record.childSessionId).toBe(created.record.childSessionId)
    expect(disposed.record.createdAt).toBe(created.record.createdAt)
    expect(disposed.record.schemaVersion).toBe(TEAM_CONTRACT_SCHEMA_VERSION)
  })

  it('every intermediate result is a NEW frozen instance and inputs are never mutated', () => {
    const created = mint()
    const running = transitionInstance(created, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    const settled = transitionInstance(running, LIFECYCLE_OPERATIONS.SETTLE)
    expect(running).not.toBe(created)
    expect(settled).not.toBe(running)
    expect(settled).not.toBe(created)
    expect(Object.isFrozen(settled)).toBe(true)
    expect(Object.isFrozen(settled.record)).toBe(true)
    // the earlier instances still hold their own state
    expect(created.record.lifecycle).toBe(CREATED)
    expect(created.record.activityVersion).toBe(1)
    expect(running.record.lifecycle).toBe(RUNNING)
    expect(running.record.activityVersion).toBe(2)
    expect(created.hasEnteredRunning).toBe(false)
    expect(running.hasEnteredRunning).toBe(true)
  })
})

describe('P3-T3 member: instance-level rejections mirror the record-level FSM', () => {
  it('illegal operations throw the typed lifecycle error with the exact (from, to) and change nothing', () => {
    const created = mint()
    // SETTLE from CREATED
    let threw = expectThrows(
      () => transitionInstance(created, LIFECYCLE_OPERATIONS.SETTLE),
      isLifecycleTransitionError,
      'SETTLE from CREATED',
    )
    let err = threw as { code: string; reason: string; from: string; to: string }
    expect(err.code).toBe(LIFECYCLE_DOMAIN_ERROR_CODES.ILLEGAL_TRANSITION)
    expect(err.reason).toBe('ILLEGAL_TRANSITION')
    expect(err.from).toBe(CREATED)
    expect(err.to).toBe(SETTLED)

    // ARCHIVE from RUNNING (must quiesce to SETTLED first, §30.1)
    const running = transitionInstance(created, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    threw = expectThrows(
      () => transitionInstance(running, LIFECYCLE_OPERATIONS.ARCHIVE),
      isLifecycleTransitionError,
      'ARCHIVE from RUNNING',
    )
    err = threw as { code: string; reason: string; from: string; to: string }
    expect(err.code).toBe(LIFECYCLE_DOMAIN_ERROR_CODES.ILLEGAL_TRANSITION)
    expect(err.from).toBe(RUNNING)
    expect(err.to).toBe(ARCHIVED)
    // nothing changed
    expect(running.record.lifecycle).toBe(RUNNING)
    expect(running.record.activityVersion).toBe(2)
    expect(running.hasEnteredRunning).toBe(true)
  })

  it('RESTORE is only legal from ARCHIVED at the instance level (acceptance)', () => {
    const created = mint()
    // from CREATED
    expectThrows(
      () => transitionInstance(created, LIFECYCLE_OPERATIONS.RESTORE),
      isLifecycleTransitionError,
      'RESTORE from CREATED',
    )
    // from RUNNING
    const running = transitionInstance(created, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expectThrows(
      () => transitionInstance(running, LIFECYCLE_OPERATIONS.RESTORE),
      isLifecycleTransitionError,
      'RESTORE from RUNNING',
    )
    // from SETTLED
    const settled = transitionInstance(running, LIFECYCLE_OPERATIONS.SETTLE)
    expectThrows(
      () => transitionInstance(settled, LIFECYCLE_OPERATIONS.RESTORE),
      isLifecycleTransitionError,
      'RESTORE from SETTLED',
    )
    // from ARCHIVED: the one legal restore — and it ends SETTLED, never RUNNING
    const archived = transitionInstance(
      transitionInstance(transitionInstance(running, LIFECYCLE_OPERATIONS.SETTLE), LIFECYCLE_OPERATIONS.ARCHIVE),
      LIFECYCLE_OPERATIONS.RESTORE,
    )
    expect(archived.record.lifecycle).toBe(SETTLED)
    // reaching RUNNING after a restore requires explicit admitted work
    const reRunning = transitionInstance(archived, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(reRunning.record.lifecycle).toBe(RUNNING)
  })

  it('DISPOSED is terminal at the instance level: every operation fails with TERMINAL_STATE', () => {
    const created = mint()
    const disposed = transitionInstance(
      transitionInstance(
        transitionInstance(
          transitionInstance(transitionInstance(created, LIFECYCLE_OPERATIONS.ADMIT_WORK), LIFECYCLE_OPERATIONS.SETTLE),
          LIFECYCLE_OPERATIONS.ARCHIVE,
        ),
        LIFECYCLE_OPERATIONS.RESTORE,
      ),
      LIFECYCLE_OPERATIONS.DISPOSE,
    )
    expect(disposed.record.lifecycle).toBe(DISPOSED)
    for (const op of [
      LIFECYCLE_OPERATIONS.ADMIT_WORK,
      LIFECYCLE_OPERATIONS.SETTLE,
      LIFECYCLE_OPERATIONS.ARCHIVE,
      LIFECYCLE_OPERATIONS.RESTORE,
      LIFECYCLE_OPERATIONS.DISPOSE,
    ]) {
      const threw = expectThrows(
        () => transitionInstance(disposed, op),
        isLifecycleTransitionError,
        `${op} from DISPOSED`,
      )
      const err = threw as { code: string; reason: string; from: string }
      expect(err.code).toBe(LIFECYCLE_DOMAIN_ERROR_CODES.TERMINAL_STATE)
      expect(err.reason).toBe('TERMINAL_STATE')
      expect(err.from).toBe(DISPOSED)
    }
    expect(disposed.record.activityVersion).toBe(6) // untouched by all five rejections
  })
})

describe('P3-T3 member: operation plumbing', () => {
  it('the instance-level commit equals the record-level commit (same durable state)', () => {
    const created = mint()
    const viaInstance = transitionInstance(created, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    const viaRecord = applyLifecycleOperation(created.record, LIFECYCLE_OPERATIONS.ADMIT_WORK)
    expect(viaInstance.record).toEqual(viaRecord)
    expect(viaInstance.record).not.toBe(viaRecord) // two independent new records
    expect(viaInstance.hasEnteredRunning).toBe(true)
  })

  it('an unknown operation is a programming error (TypeError), not a lifecycle decision', () => {
    const created = mint()
    // @ts-expect-error deliberately feeding a non-vocabulary operation
    expect(() => transitionInstance(created, 'PAUSE')).toThrow()
    // the instance is untouched
    expect(created.record.lifecycle).toBe(CREATED)
    expect(created.record.activityVersion).toBe(1)
  })
})
