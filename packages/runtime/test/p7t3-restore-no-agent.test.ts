/**
 * p7t3-restore-no-agent — the RESTORE procedure (DevPlan §20.3; Architecture
 * §30.2 frozen 3A; the G7 criterion "Restore does not create/resume Agent").
 *
 * The structural guarantee: Restore commits the single durable edge
 * `ARCHIVED → SETTLED` and has, by construction, ZERO live-runtime contact —
 * no admission-close, no interrupt, no descendant drain, no residency
 * release, and no Agent create/resume call of any kind. The G7 NEGATIVE
 * test asserts the call surface (`resumeAgent` / `createAgent`) was never
 * touched, and that a pre-existing live residency is left UNTOUCHED.
 *
 * Top-level-await pattern; the `it` bodies assert only over captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t3-restore-no-agent
 */

import { expect, it } from 'vitest'
import { LIFECYCLE_RUNTIME_ERROR_CODES as CODES, LIFECYCLE_STEP_NAMES as S } from '../lifecycle/index.js'
import {
  captureError,
  createLifecycleWorld,
  destroyWorld,
  p7t3TargetForLabel,
  runtimeErrorFields,
} from './p7t3-helpers.js'

const RESTORE_STEPS = [S.COMMIT_RESTORE]

// R1 — restore an ARCHIVED member: exactly one step (the durable commit),
// zero live contact, +1 activity, durable consistent.
const r1 = await (async () => {
  const world = await createLifecycleWorld('p7t3-r1', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
  })
  try {
    const result = await world.service.restoreMember(world.target('p7t3-worker-a'))
    const durable = world.recordFor('p7t3-worker-a')
    return {
      steps: [...result.steps],
      resultLifecycle: result.member.lifecycle,
      resultAv: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      clockKinds: world.clock.kinds(),
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('R1 restore ARCHIVED: exactly [commit-restore], zero live contact, +1 activity', () => {
  expect(r1.steps).toEqual(RESTORE_STEPS)
  expect(r1.resultLifecycle).toBe('SETTLED')
  expect(r1.resultAv).toBe(2)
  expect(r1.durableLifecycle).toBe('SETTLED')
  expect(r1.durableAv).toBe(2)
  expect(r1.clockKinds).toEqual(['commit'])
  expect(r1.admissionCalls).toBe(0)
  expect(r1.interruptCalls).toBe(0)
  expect(r1.drainCalls).toBe(0)
  expect(r1.dropCalls).toBe(0)
  expect(r1.commitOps).toEqual(['RESTORE:ARCHIVED->SETTLED'])
})

// R2 — the G7 NEGATIVE: the call surface (`resumeAgent` / `createAgent`) is
// never touched, and a pre-existing live residency is left UNTOUCHED (not
// dropped).
const r2 = await (async () => {
  const world = await createLifecycleWorld('p7t3-r2', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED', resident: true }],
  })
  try {
    const result = await world.service.restoreMember(world.target('p7t3-worker-a'))
    const childSession = result.member.childSessionId
    return {
      steps: [...result.steps],
      admissionResume: world.admission.resumeAgentCalls,
      admissionCreate: world.admission.createAgentCalls,
      activityResume: world.activity.resumeAgentCalls,
      activityCreate: world.activity.createAgentCalls,
      descendantsResume: world.descendants.resumeAgentCalls,
      descendantsCreate: world.descendants.createAgentCalls,
      residencyResume: world.residency.resumeAgentCalls,
      residencyCreate: world.residency.createAgentCalls,
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
      residencyStillPresent: world.residency.hasResidency(childSession),
      commitCalls: world.commit.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('R2 G7 negative: resume/create call surface never touched, pre-existing residency left intact', () => {
  expect(r2.steps).toEqual(RESTORE_STEPS)
  expect(r2.admissionResume).toBe(0)
  expect(r2.admissionCreate).toBe(0)
  expect(r2.activityResume).toBe(0)
  expect(r2.activityCreate).toBe(0)
  expect(r2.descendantsResume).toBe(0)
  expect(r2.descendantsCreate).toBe(0)
  expect(r2.residencyResume).toBe(0)
  expect(r2.residencyCreate).toBe(0)
  expect(r2.admissionCalls).toBe(0)
  expect(r2.interruptCalls).toBe(0)
  expect(r2.drainCalls).toBe(0)
  expect(r2.dropCalls).toBe(0)
  expect(r2.residencyStillPresent).toBe(true)
  expect(r2.commitCalls).toBe(1)
})

// R3 — the illegal-source matrix: restore is legal from ARCHIVED ONLY. From
// CREATED / RUNNING / SETTLED / DISPOSED it is rejected BEFORE any effect.
const r3 = await (async () => {
  const world = await createLifecycleWorld('p7t3-r3', {
    seedMembers: [
      { label: 'p7t3-worker-a', lifecycle: 'CREATED' },
      { label: 'p7t3-worker-b', lifecycle: 'RUNNING' },
      { label: 'p7t3-worker-c', lifecycle: 'SETTLED' },
      { label: 'p7t3-worker-d', lifecycle: 'DISPOSED' },
    ],
  })
  try {
    const probe = async (label: string, from: string) => {
      const error = await captureError(() => world.service.restoreMember(world.target(label)))
      const fields = runtimeErrorFields(error)
      return {
        from,
        isLifecycle: fields.isLifecycle,
        code: fields.code,
        detailFrom: fields.from,
        durableLifecycle: world.recordFor(label)?.lifecycle ?? null,
      }
    }
    const created = await probe('p7t3-worker-a', 'CREATED')
    const running = await probe('p7t3-worker-b', 'RUNNING')
    const settled = await probe('p7t3-worker-c', 'SETTLED')
    const disposed = await probe('p7t3-worker-d', 'DISPOSED')
    return {
      created,
      running,
      settled,
      disposed,
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
      commitCalls: world.commit.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('R3 restore illegal-source matrix (CREATED/RUNNING/SETTLED/DISPOSED): ILLEGAL_STATE, zero effects', () => {
  expect(r3.created.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(r3.created.isLifecycle).toBe(true)
  expect(r3.created.detailFrom).toBe('CREATED')
  expect(r3.created.durableLifecycle).toBe('CREATED')
  expect(r3.running.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(r3.running.isLifecycle).toBe(true)
  expect(r3.running.detailFrom).toBe('RUNNING')
  expect(r3.running.durableLifecycle).toBe('RUNNING')
  expect(r3.settled.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(r3.settled.isLifecycle).toBe(true)
  expect(r3.settled.detailFrom).toBe('SETTLED')
  expect(r3.settled.durableLifecycle).toBe('SETTLED')
  expect(r3.disposed.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(r3.disposed.isLifecycle).toBe(true)
  expect(r3.disposed.detailFrom).toBe('DISPOSED')
  expect(r3.disposed.durableLifecycle).toBe('DISPOSED')
  expect(r3.admissionCalls).toBe(0)
  expect(r3.interruptCalls).toBe(0)
  expect(r3.drainCalls).toBe(0)
  expect(r3.dropCalls).toBe(0)
  expect(r3.commitCalls).toBe(0)
})

// R4 — an unknown member (MEMBER_NOT_FOUND) is rejected with zero effects.
const r4 = await (async () => {
  const world = await createLifecycleWorld('p7t3-r4', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
  })
  try {
    const error = await captureError(() =>
      world.service.restoreMember(p7t3TargetForLabel('p7t3-worker-b')),
    )
    const fields = runtimeErrorFields(error)
    return {
      ...fields,
      admissionCalls: world.admission.calls.length,
      commitCalls: world.commit.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('R4 restore unknown member: MEMBER_NOT_FOUND, zero effects', () => {
  expect(r4.code).toBe(CODES.LIFECYCLE_MEMBER_NOT_FOUND)
  expect(r4.isLifecycle).toBe(true)
  expect(r4.admissionCalls).toBe(0)
  expect(r4.commitCalls).toBe(0)
})

// R5 — a double restore: the first lands (ARCHIVED→SETTLED), the second is
// rejected (SETTLED forbids RESTORE) with no double activity increment.
const r5 = await (async () => {
  const world = await createLifecycleWorld('p7t3-r5', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    const first = await world.service.restoreMember(target)
    const secondError = await captureError(() => world.service.restoreMember(target))
    const fields = runtimeErrorFields(secondError)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      firstLifecycle: first.member.lifecycle,
      firstAv: first.member.activityVersion,
      secondFields: fields,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitCalls: world.commit.calls.length,
      admissionCalls: world.admission.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('R5 double restore: first SETTLED, second ILLEGAL_STATE (from SETTLED), no double increment', () => {
  expect(r5.firstLifecycle).toBe('SETTLED')
  expect(r5.firstAv).toBe(2)
  expect(r5.secondFields.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(r5.secondFields.isLifecycle).toBe(true)
  expect(r5.secondFields.from).toBe('SETTLED')
  expect(r5.durableLifecycle).toBe('SETTLED')
  expect(r5.durableAv).toBe(2)
  expect(r5.commitCalls).toBe(1)
  expect(r5.admissionCalls).toBe(0)
})

// R6 — a commit fault: the durable write fails (phase write, step
// commit-restore), the member stays ARCHIVED, zero live contact, and a
// retry succeeds.
const r6 = await (async () => {
  const world = await createLifecycleWorld('p7t3-r6', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    world.commit.failNext = new Error('restore commit fault')
    const error = await captureError(() => world.service.restoreMember(target))
    const fields = runtimeErrorFields(error)
    const afterFirst = world.recordFor('p7t3-worker-a')
    const retry = await world.service.restoreMember(target)
    const afterRetry = world.recordFor('p7t3-worker-a')
    return {
      fields,
      afterFirstLifecycle: afterFirst?.lifecycle ?? null,
      afterFirstAv: afterFirst?.activityVersion ?? -1,
      retryLifecycle: retry.member.lifecycle,
      retryAv: retry.member.activityVersion,
      afterRetryLifecycle: afterRetry?.lifecycle ?? null,
      afterRetryAv: afterRetry?.activityVersion ?? -1,
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
      commitCalls: world.commit.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('R6 restore commit fault: DURABLE_STATE_FAILED (write/commit-restore), stays ARCHIVED, retry OK', () => {
  expect(r6.fields.code).toBe(CODES.LIFECYCLE_DURABLE_STATE_FAILED)
  expect(r6.fields.isLifecycle).toBe(true)
  expect(r6.fields.phase).toBe('write')
  expect(r6.fields.step).toBe('commit-restore')
  expect(r6.afterFirstLifecycle).toBe('ARCHIVED')
  expect(r6.afterFirstAv).toBe(1)
  expect(r6.retryLifecycle).toBe('SETTLED')
  expect(r6.retryAv).toBe(2)
  expect(r6.afterRetryLifecycle).toBe('SETTLED')
  expect(r6.afterRetryAv).toBe(2)
  expect(r6.admissionCalls).toBe(0)
  expect(r6.interruptCalls).toBe(0)
  expect(r6.drainCalls).toBe(0)
  expect(r6.dropCalls).toBe(0)
  expect(r6.commitCalls).toBe(2)
})
