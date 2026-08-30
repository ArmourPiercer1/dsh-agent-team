/**
 * p7t3-descendant-drain — the descendant-drain step (DevPlan §20.3 step 3,
 * the public descendant seam) + the quiescence observation, and the
 * process-restart model (the durable records survive; the ephemeral
 * residency and every live fake do not).
 *
 * Top-level-await pattern; the `it` bodies assert only over captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t3-descendant-drain
 */

import { expect, it } from 'vitest'
import { LIFECYCLE_RUNTIME_ERROR_CODES as CODES, LIFECYCLE_STEP_NAMES as S } from '../lifecycle/index.js'
import {
  captureError,
  createLifecycleWorld,
  destroyWorld,
  restartLifecycleWorld,
  runtimeErrorFields,
} from './p7t3-helpers.js'

// D1 — a nested drain (two resident descendants) is observed once, at the
// exact child session, in the exact step position.
const d1 = await (async () => {
  const world = await createLifecycleWorld('p7t3-d1', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
    drainReport: { drained: 2, quiescent: true },
  })
  try {
    const childSession = world.recordFor('p7t3-worker-a')?.childSessionId ?? 'none'
    const result = await world.service.archiveMember(world.target('p7t3-worker-a'))
    return {
      drained: result.drained,
      drainCalls: world.descendants.calls.length,
      drainChildSession: world.descendants.calls[0]?.childSessionId ?? 'none',
      expectedChildSession: childSession,
      drainStepIndex: [...result.steps].indexOf(S.DRAIN_DESCENDANTS),
      steps: [...result.steps],
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('D1 nested drain: called once at the member child session, report observed, correct step position', () => {
  expect(d1.drained).toBe(2)
  expect(d1.drainCalls).toBe(1)
  expect(d1.drainChildSession).toBe(d1.expectedChildSession)
  expect(d1.expectedChildSession).not.toBe('none')
  expect(d1.drainStepIndex).toBe(2)
  expect(d1.steps).toEqual([
    S.CLOSE_ADMISSION,
    S.INTERRUPT,
    S.DRAIN_DESCENDANTS,
    S.WAIT_QUIESCENCE,
    S.RELEASE_RESIDENCY,
    S.COMMIT_SETTLE,
    S.COMMIT_ARCHIVE,
  ])
  expect(d1.commitOps).toEqual(['SETTLE:RUNNING->SETTLED', 'ARCHIVE:SETTLED->ARCHIVED'])
})

// D2 — a non-quiescent drain report (residual activity) is the quiescence
// NEGATIVE: NOT_QUIESCENT, zero durable writes, the member untouched.
const d2 = await (async () => {
  const world = await createLifecycleWorld('p7t3-d2', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
    drainReport: { drained: 1, quiescent: false },
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
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('D2 non-quiescent drain: NOT_QUIESCENT (drained=1), durable RUNNING untouched', () => {
  expect(d2.code).toBe(CODES.LIFECYCLE_NOT_QUIESCENT)
  expect(d2.isLifecycle).toBe(true)
  expect(d2.step).toBe('wait-quiescence')
  expect(d2.drained).toBe(1)
  expect(d2.malformed).toBe(false)
  expect(d2.durableLifecycle).toBe('RUNNING')
  expect(d2.durableAv).toBe(1)
  expect(d2.commitCalls).toBe(0)
  expect(d2.residencyIntact).toBe(true)
})

// D3 — a non-resident SETTLED member with an empty drain: the residency
// release is a no-op (not dropped), the direct archive edge commits once.
const d3 = await (async () => {
  const world = await createLifecycleWorld('p7t3-d3', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'SETTLED' }],
  })
  try {
    const result = await world.service.archiveMember(world.target('p7t3-worker-a'))
    return {
      residencyDropped: result.residencyDropped,
      drained: result.drained,
      steps: [...result.steps],
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
      dropCalls: world.residency.dropCalls.length,
      dropDropped: world.residency.dropCalls[0]?.dropped ?? true,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('D3 non-resident SETTLED: residency release no-op (not dropped), direct archive commits once', () => {
  expect(d3.residencyDropped).toBe(false)
  expect(d3.drained).toBe(0)
  expect(d3.steps).toEqual([
    S.CLOSE_ADMISSION,
    S.INTERRUPT,
    S.DRAIN_DESCENDANTS,
    S.WAIT_QUIESCENCE,
    S.RELEASE_RESIDENCY,
    S.COMMIT_ARCHIVE,
  ])
  expect(d3.commitOps).toEqual(['ARCHIVE:SETTLED->ARCHIVED'])
  expect(d3.dropCalls).toBe(1)
  expect(d3.dropDropped).toBe(false)
})

// D4 — a drain fault aborts BEFORE the residency release and before any
// durable write.
const d4 = await (async () => {
  const world = await createLifecycleWorld('p7t3-d4', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    world.descendants.failNext = new Error('drain fault')
    const error = await captureError(() => world.service.archiveMember(world.target('p7t3-worker-a')))
    const fields = runtimeErrorFields(error)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      ...fields,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitCalls: world.commit.calls.length,
      residencyIntact: world.residency.hasResidency(durable?.childSessionId ?? 'none'),
      dropCalls: world.residency.dropCalls.length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('D4 drain fault: LIVE_EFFECT_FAILED at drain-descendants, no release/commit, residency intact', () => {
  expect(d4.code).toBe(CODES.LIFECYCLE_LIVE_EFFECT_FAILED)
  expect(d4.isLifecycle).toBe(true)
  expect(d4.step).toBe('drain-descendants')
  expect(d4.durableLifecycle).toBe('RUNNING')
  expect(d4.durableAv).toBe(1)
  expect(d4.commitCalls).toBe(0)
  expect(d4.residencyIntact).toBe(true)
  expect(d4.dropCalls).toBe(0)
})

// D5 — the process-restart model: an archived member's durable state
// survives a restart; the ephemeral residency and live fakes do not; a
// re-archive after restart is rejected with ZERO new live/commit effects.
const d5 = await (async () => {
  const world = await createLifecycleWorld('p7t3-d5', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  await world.service.archiveMember(world.target('p7t3-worker-a'))
  const childSession = world.recordFor('p7t3-worker-a')?.childSessionId ?? 'none'
  const binding = world.domain.repositories.sessionBindings.get(childSession)
  const teamSession = world.domain.repositories.teamSessions.get('session-root-p7t3')
  const clockCountBeforeRestart = world.clock.events.length
  const restarted = await restartLifecycleWorld(world)
  try {
    const afterRestart = restarted.recordFor('p7t3-worker-a')
    const error = await captureError(() =>
      restarted.service.archiveMember(restarted.target('p7t3-worker-a')),
    )
    const fields = runtimeErrorFields(error)
    return {
      afterRestartLifecycle: afterRestart?.lifecycle ?? null,
      afterRestartAv: afterRestart?.activityVersion ?? -1,
      residencyEmpty: afterRestart !== undefined ? !restarted.residency.hasResidency(afterRestart.childSessionId) : false,
      freshCommitCalls: restarted.commit.calls.length,
      freshDrainCalls: restarted.descendants.calls.length,
      newClockEvents: restarted.clock.events.length - clockCountBeforeRestart,
      fields,
      bindingKind: binding?.kind ?? null,
      teamSessionPresent: teamSession !== undefined,
      finalDurable: restarted.recordFor('p7t3-worker-a')?.lifecycle ?? null,
    }
  } finally {
    await destroyWorld(restarted)
  }
})()

it('D5 restart model: durable ARCHIVED survives, ephemeral residency gone, re-archive zero new effects', () => {
  expect(d5.afterRestartLifecycle).toBe('ARCHIVED')
  expect(d5.afterRestartAv).toBe(3)
  expect(d5.residencyEmpty).toBe(true)
  expect(d5.freshCommitCalls).toBe(0)
  expect(d5.freshDrainCalls).toBe(0)
  expect(d5.newClockEvents).toBe(0)
  expect(d5.fields.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(d5.fields.from).toBe('ARCHIVED')
  expect(d5.bindingKind).toBe('team-member')
  expect(d5.teamSessionPresent).toBe(true)
  expect(d5.finalDurable).toBe('ARCHIVED')
})
