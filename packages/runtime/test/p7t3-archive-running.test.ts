/**
 * p7t3-archive-running — the ARCHIVE procedure (DevPlan §20.3; Architecture
 * §30.1). Mandatory test item "archive running" + the settle-then-archive
 * order + the crash-window (SETTLE committed, ARCHIVE commit faults) retry
 * semantics + the illegal-state matrix + the fail-closed prologue.
 *
 * Top-level-await pattern: each world is built, the scenario executed, the
 * observables captured into a plain snapshot, the world destroyed in
 * `finally`; the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t3-archive-running
 */

import { expect, it } from 'vitest'
import { LIFECYCLE_RUNTIME_ERROR_CODES as CODES, LIFECYCLE_STEP_NAMES as S } from '../lifecycle/index.js'
import {
  P7T3_FIXTURE,
  captureError,
  createLifecycleWorld,
  destroyWorld,
  p7t3TargetForLabel,
  runtimeErrorFields,
} from './p7t3-helpers.js'

const ARCHIVE_RUNNING_STEPS = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_SETTLE,
  S.COMMIT_ARCHIVE,
]
const ARCHIVE_SETTLED_STEPS = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_ARCHIVE,
]

// A1 — archive a RUNNING member: settle-then-archive, quiesce FIRST, +2
// activity, durable consistent with the result, residency released.
const a1 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a1', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    const result = await world.service.archiveMember(target)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      steps: [...result.steps],
      settledCommitted: result.settledCommitted,
      residencyDropped: result.residencyDropped,
      drained: result.drained,
      resultLifecycle: result.member.lifecycle,
      resultAv: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      identityVerbatim:
        durable !== undefined &&
        durable.rootSessionId === target.rootSessionId &&
        durable.instanceId === target.instanceId &&
        durable.templateId === result.member.templateId &&
        durable.label === 'p7t3-worker-a' &&
        durable.childSessionId === result.member.childSessionId &&
        durable.createdAt === P7T3_FIXTURE.createdAt,
      clockKinds: world.clock.kinds(),
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
      residencyAfter: world.residency.hasResidency(result.member.childSessionId),
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A1 archive RUNNING: settle-then-archive, quiesce first, +2 activity, durable consistent', () => {
  expect(a1.steps).toEqual(ARCHIVE_RUNNING_STEPS)
  expect(a1.settledCommitted).toBe(true)
  expect(a1.residencyDropped).toBe(true)
  expect(a1.resultLifecycle).toBe('ARCHIVED')
  expect(a1.resultAv).toBe(3)
  expect(a1.durableLifecycle).toBe('ARCHIVED')
  expect(a1.durableAv).toBe(3)
  expect(a1.identityVerbatim).toBe(true)
  expect(a1.residencyAfter).toBe(false)
  expect(a1.clockKinds).toEqual([
    'admission.close',
    'activity.interrupt',
    'descendants.drain',
    'residency.drop',
    'commit',
    'commit',
  ])
  expect(a1.commitOps).toEqual(['SETTLE:RUNNING->SETTLED', 'ARCHIVE:SETTLED->ARCHIVED'])
  expect(a1.admissionCalls).toBe(1)
  expect(a1.interruptCalls).toBe(1)
  expect(a1.drainCalls).toBe(1)
  expect(a1.drained).toBe(0)
})

// A2 — archive an already-SETTLED member: the direct edge (one commit, no
// settle), +1 activity.
const a2 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a2', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'SETTLED' }],
  })
  try {
    const result = await world.service.archiveMember(world.target('p7t3-worker-a'))
    const durable = world.recordFor('p7t3-worker-a')
    return {
      steps: [...result.steps],
      settledCommitted: result.settledCommitted,
      resultLifecycle: result.member.lifecycle,
      resultAv: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A2 archive SETTLED: direct edge (one commit, no settle), +1 activity', () => {
  expect(a2.steps).toEqual(ARCHIVE_SETTLED_STEPS)
  expect(a2.settledCommitted).toBe(false)
  expect(a2.resultLifecycle).toBe('ARCHIVED')
  expect(a2.resultAv).toBe(2)
  expect(a2.durableLifecycle).toBe('ARCHIVED')
  expect(a2.durableAv).toBe(2)
  expect(a2.commitOps).toEqual(['ARCHIVE:SETTLED->ARCHIVED'])
})

// A3 — a non-quiescent drain aborts BEFORE any durable write and does NOT
// release the residency (the §30.1 forbidden order is structural).
const a3 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a3', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
    drainReport: { drained: 2, quiescent: false },
  })
  try {
    const error = await captureError(() => world.service.archiveMember(world.target('p7t3-worker-a')))
    const fields = runtimeErrorFields(error)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      ...fields,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitCalls: world.commit.calls.length,
      residencyIntact: world.residency.hasResidency(durable?.childSessionId ?? 'none'),
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A3 archive with non-quiescent drain: NOT_QUIESCENT, zero writes, residency NOT released', () => {
  expect(a3.isLifecycle).toBe(true)
  expect(a3.code).toBe(CODES.LIFECYCLE_NOT_QUIESCENT)
  expect(a3.step).toBe('wait-quiescence')
  expect(a3.drained).toBe(2)
  expect(a3.durableLifecycle).toBe('RUNNING')
  expect(a3.durableAv).toBe(1)
  expect(a3.commitCalls).toBe(0)
  expect(a3.residencyIntact).toBe(true)
  expect(a3.admissionCalls).toBe(1)
  expect(a3.interruptCalls).toBe(1)
  expect(a3.drainCalls).toBe(1)
  expect(a3.dropCalls).toBe(0)
})

// A4 — a live-port fault (interrupt) aborts before the remaining steps and
// before any durable write.
const a4 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a4', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    world.activity.failNext = new Error('interrupt fault')
    const error = await captureError(() => world.service.archiveMember(world.target('p7t3-worker-a')))
    const fields = runtimeErrorFields(error)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      ...fields,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitCalls: world.commit.calls.length,
      residencyIntact: world.residency.hasResidency(durable?.childSessionId ?? 'none'),
      admissionCalls: world.admission.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A4 archive with interrupt fault: LIVE_EFFECT_FAILED at interrupt, no drain/release/commit', () => {
  expect(a4.isLifecycle).toBe(true)
  expect(a4.code).toBe(CODES.LIFECYCLE_LIVE_EFFECT_FAILED)
  expect(a4.step).toBe('interrupt')
  expect(a4.durableLifecycle).toBe('RUNNING')
  expect(a4.durableAv).toBe(1)
  expect(a4.commitCalls).toBe(0)
  expect(a4.residencyIntact).toBe(true)
  expect(a4.admissionCalls).toBe(1)
  expect(a4.drainCalls).toBe(0)
  expect(a4.dropCalls).toBe(0)
})

// A5 — the crash window: the SETTLE commit lands, the ARCHIVE commit faults
// → the member is durably SETTLED; retrying re-plans from SETTLED (a no-op
// settle) and commits only ARCHIVE.
const a5 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a5', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    world.commit.failCallNumber(2, new Error('archive commit fault'))
    const firstError = await captureError(() => world.service.archiveMember(target))
    const firstFields = runtimeErrorFields(firstError)
    const afterFirst = world.recordFor('p7t3-worker-a')
    const firstCommitCalls = world.commit.calls.length
    const retry = await world.service.archiveMember(target)
    const afterRetry = world.recordFor('p7t3-worker-a')
    return {
      firstFields,
      firstDurableLifecycle: afterFirst?.lifecycle ?? null,
      firstDurableAv: afterFirst?.activityVersion ?? -1,
      firstCommitCalls,
      retrySteps: [...retry.steps],
      retrySettledCommitted: retry.settledCommitted,
      retryLifecycle: retry.member.lifecycle,
      retryAv: retry.member.activityVersion,
      finalDurableLifecycle: afterRetry?.lifecycle ?? null,
      finalDurableAv: afterRetry?.activityVersion ?? -1,
      totalCommitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A5 archive crash window: SETTLE durable, ARCHIVE commit fault, retry archives without settle', () => {
  expect(a5.firstFields.isLifecycle).toBe(true)
  expect(a5.firstFields.code).toBe(CODES.LIFECYCLE_DURABLE_STATE_FAILED)
  expect(a5.firstFields.phase).toBe('write')
  expect(a5.firstFields.step).toBe('commit-archive')
  expect(a5.firstDurableLifecycle).toBe('SETTLED')
  expect(a5.firstDurableAv).toBe(2)
  expect(a5.firstCommitCalls).toBe(2)
  expect(a5.retrySteps).toEqual(ARCHIVE_SETTLED_STEPS)
  expect(a5.retrySettledCommitted).toBe(false)
  expect(a5.retryLifecycle).toBe('ARCHIVED')
  expect(a5.retryAv).toBe(3)
  expect(a5.finalDurableLifecycle).toBe('ARCHIVED')
  expect(a5.finalDurableAv).toBe(3)
  expect(a5.totalCommitOps).toEqual([
    'SETTLE:RUNNING->SETTLED',
    'ARCHIVE:SETTLED->ARCHIVED',
    'ARCHIVE:SETTLED->ARCHIVED',
  ])
})

// A6 — the illegal-state matrix: archiving CREATED / ARCHIVED / DISPOSED is
// rejected BEFORE any live effect (zero live calls, zero commits, durable
// unchanged).
const a6 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a6', {
    seedMembers: [
      { label: 'p7t3-worker-a', lifecycle: 'CREATED' },
      { label: 'p7t3-worker-b', lifecycle: 'ARCHIVED' },
      { label: 'p7t3-worker-c', lifecycle: 'DISPOSED' },
    ],
  })
  try {
    const probe = async (label: string, from: string) => {
      const error = await captureError(() => world.service.archiveMember(world.target(label)))
      const fields = runtimeErrorFields(error)
      const durable = world.recordFor(label)
      return {
        from,
        isLifecycle: fields.isLifecycle,
        code: fields.code,
        detailFrom: fields.from,
        detailTo: fields.to,
        durableLifecycle: durable?.lifecycle ?? null,
      }
    }
    const created = await probe('p7t3-worker-a', 'CREATED')
    const archived = await probe('p7t3-worker-b', 'ARCHIVED')
    const disposed = await probe('p7t3-worker-c', 'DISPOSED')
    return {
      created,
      archived,
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

it('A6 archive illegal-state matrix (CREATED/ARCHIVED/DISPOSED): ILLEGAL_STATE, zero effects', () => {
  expect(a6.created.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(a6.created.isLifecycle).toBe(true)
  expect(a6.created.detailFrom).toBe('CREATED')
  expect(a6.created.durableLifecycle).toBe('CREATED')
  expect(a6.archived.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(a6.archived.isLifecycle).toBe(true)
  expect(a6.archived.detailFrom).toBe('ARCHIVED')
  expect(a6.archived.durableLifecycle).toBe('ARCHIVED')
  expect(a6.disposed.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(a6.disposed.isLifecycle).toBe(true)
  expect(a6.disposed.detailFrom).toBe('DISPOSED')
  expect(a6.disposed.durableLifecycle).toBe('DISPOSED')
  expect(a6.admissionCalls).toBe(0)
  expect(a6.interruptCalls).toBe(0)
  expect(a6.drainCalls).toBe(0)
  expect(a6.dropCalls).toBe(0)
  expect(a6.commitCalls).toBe(0)
})

// A7 — the fail-closed prologue: an unknown member (MEMBER_NOT_FOUND) and an
// invalid identity (INVALID_INPUT) are rejected with zero effects.
const a7 = await (async () => {
  const world = await createLifecycleWorld('p7t3-a7', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING' }],
  })
  try {
    const unknownError = await captureError(() =>
      world.service.archiveMember(p7t3TargetForLabel('p7t3-worker-b')),
    )
    const unknownFields = runtimeErrorFields(unknownError)
    const invalidError = await captureError(() =>
      world.service.archiveMember({
        rootSessionId: world.target('p7t3-worker-a').rootSessionId,
        instanceId: 'bad id!',
      }),
    )
    const invalidFields = runtimeErrorFields(invalidError)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      unknown: unknownFields,
      invalid: invalidFields,
      durableLifecycle: durable?.lifecycle ?? null,
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      commitCalls: world.commit.calls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A7 prologue: MEMBER_NOT_FOUND (unknown) + INVALID_INPUT (bad identity), zero effects', () => {
  expect(a7.unknown.code).toBe(CODES.LIFECYCLE_MEMBER_NOT_FOUND)
  expect(a7.unknown.isLifecycle).toBe(true)
  expect(a7.invalid.code).toBe(CODES.LIFECYCLE_INVALID_INPUT)
  expect(a7.invalid.isLifecycle).toBe(true)
  expect(a7.invalid.field).toBe('instanceId')
  expect(a7.durableLifecycle).toBe('RUNNING')
  expect(a7.admissionCalls).toBe(0)
  expect(a7.interruptCalls).toBe(0)
  expect(a7.drainCalls).toBe(0)
  expect(a7.commitCalls).toBe(0)
})
