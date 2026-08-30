/**
 * p7t3-dispose-race — the DISPOSE procedure (DevPlan §20.3; Architecture
 * §30.4, §29.5 DISPOSED terminal; 历史不删除) + the per-team lock race
 * semantics: a concurrent double-dispose commits exactly ONCE (the loser
 * re-reads the durable state the winner wrote and is rejected as
 * `LIFECYCLE_ILLEGAL_STATE`), and the archive-vs-dispose orderings follow
 * the frozen §29 FSM (ARCHIVED→DISPOSED is legal; DISPOSED is terminal).
 *
 * History preservation (历史不删除): the DISPOSED record and its session
 * bindings are NOT deleted — the durable row stays readable with its
 * identity fields verbatim across a process restart.
 *
 * Top-level-await pattern; the `it` bodies assert only over captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t3-dispose-race
 */

import { expect, it } from 'vitest'
import { LIFECYCLE_RUNTIME_ERROR_CODES as CODES, LIFECYCLE_STEP_NAMES as S } from '../lifecycle/index.js'
import type { DisposeMemberResult } from '../lifecycle/index.js'
import {
  P7T3_FIXTURE,
  captureError,
  createLifecycleWorld,
  destroyWorld,
  restartLifecycleWorld,
  runtimeErrorFields,
} from './p7t3-helpers.js'

const DISPOSE_STEPS = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_DISPOSE,
]

// X1 — the dispose race: two concurrent disposeMember calls on the SAME
// team. Exactly one commits (DISPOSED); the loser observes the durable
// DISPOSED the winner wrote and is rejected ILLEGAL_STATE — every live
// effect and the durable commit run exactly ONCE in total.
const x1 = await (async () => {
  const world = await createLifecycleWorld('p7t3-x1', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    const results = await Promise.allSettled([
      world.service.disposeMember(target),
      world.service.disposeMember(target),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    const winner =
      fulfilled.length === 1 ? (fulfilled[0] as PromiseFulfilledResult<DisposeMemberResult>).value : undefined
    const loser =
      rejected.length === 1 ? runtimeErrorFields((rejected[0] as PromiseRejectedResult).reason) : undefined
    const durable = world.recordFor('p7t3-worker-a')
    return {
      fulfilledCount: fulfilled.length,
      rejectedCount: rejected.length,
      winnerLifecycle: winner?.member.lifecycle ?? null,
      winnerAv: winner?.member.activityVersion ?? -1,
      winnerSteps: winner ? [...winner.steps] : [],
      loserCode: loser?.code ?? null,
      loserFrom: loser?.from ?? null,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
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

it('X1 dispose race: exactly one commits DISPOSED, loser ILLEGAL_STATE, each effect runs once', () => {
  expect(x1.fulfilledCount).toBe(1)
  expect(x1.rejectedCount).toBe(1)
  expect(x1.winnerLifecycle).toBe('DISPOSED')
  expect(x1.winnerAv).toBe(2)
  expect(x1.winnerSteps).toEqual(DISPOSE_STEPS)
  expect(x1.loserCode).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(x1.loserFrom).toBe('DISPOSED')
  expect(x1.durableLifecycle).toBe('DISPOSED')
  expect(x1.durableAv).toBe(2)
  expect(x1.admissionCalls).toBe(1)
  expect(x1.interruptCalls).toBe(1)
  expect(x1.drainCalls).toBe(1)
  expect(x1.dropCalls).toBe(1)
  expect(x1.commitOps).toEqual(['DISPOSE:RUNNING->DISPOSED'])
})

// X2a — archive FIRST then dispose: BOTH succeed (the frozen §29 FSM has a
// direct ARCHIVED→DISPOSED edge).
const x2a = await (async () => {
  const world = await createLifecycleWorld('p7t3-x2a', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    const archive = await world.service.archiveMember(target)
    const dispose = await world.service.disposeMember(target)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      archiveLifecycle: archive.member.lifecycle,
      disposeLifecycle: dispose.member.lifecycle,
      disposeAv: dispose.member.activityVersion,
      disposeSteps: [...dispose.steps],
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('X2a archive-then-dispose: both succeed (frozen ARCHIVED→DISPOSED edge)', () => {
  expect(x2a.archiveLifecycle).toBe('ARCHIVED')
  expect(x2a.disposeLifecycle).toBe('DISPOSED')
  expect(x2a.disposeAv).toBe(4)
  expect(x2a.disposeSteps).toEqual(DISPOSE_STEPS)
  expect(x2a.durableLifecycle).toBe('DISPOSED')
  expect(x2a.durableAv).toBe(4)
  expect(x2a.commitOps).toEqual([
    'SETTLE:RUNNING->SETTLED',
    'ARCHIVE:SETTLED->ARCHIVED',
    'DISPOSE:ARCHIVED->DISPOSED',
  ])
})

// X2b — dispose FIRST then archive: the archive is rejected (DISPOSED is
// terminal) with zero further effects.
const x2b = await (async () => {
  const world = await createLifecycleWorld('p7t3-x2b', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    const dispose = await world.service.disposeMember(target)
    const error = await captureError(() => world.service.archiveMember(target))
    const fields = runtimeErrorFields(error)
    const durable = world.recordFor('p7t3-worker-a')
    return {
      disposeLifecycle: dispose.member.lifecycle,
      fields,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      admissionCalls: world.admission.calls.length,
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('X2b dispose-then-archive: archive rejected ILLEGAL_STATE (from DISPOSED), no further effects', () => {
  expect(x2b.disposeLifecycle).toBe('DISPOSED')
  expect(x2b.fields.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(x2b.fields.from).toBe('DISPOSED')
  expect(x2b.durableLifecycle).toBe('DISPOSED')
  expect(x2b.durableAv).toBe(2)
  expect(x2b.admissionCalls).toBe(1)
  expect(x2b.commitOps).toEqual(['DISPOSE:RUNNING->DISPOSED'])
})

// X3 — history preservation (历史不删除): after dispose the record and its
// bindings are NOT deleted — readable with identity verbatim, durable
// across a process restart; terminal re-operations are all rejected.
const x3 = await (async () => {
  const world = await createLifecycleWorld('p7t3-x3', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  const target = world.target('p7t3-worker-a')
  const childSession = world.recordFor('p7t3-worker-a')?.childSessionId ?? 'none'
  await world.service.disposeMember(target)
  const recordAfter = world.recordFor('p7t3-worker-a')
  const binding = world.domain.repositories.sessionBindings.get(childSession)
  const teamSession = world.domain.repositories.teamSessions.get('session-root-p7t3')
  const bindingKind = binding?.kind ?? null
  const bindingInstanceId =
    binding !== undefined && binding.kind === 'team-member' ? binding.instanceId : null
  const restarted = await restartLifecycleWorld(world)
  try {
    const recordRestarted = restarted.recordFor('p7t3-worker-a')
    const redFields = runtimeErrorFields(
      await captureError(() => restarted.service.disposeMember(restarted.target('p7t3-worker-a'))),
    )
    const rerFields = runtimeErrorFields(
      await captureError(() => restarted.service.restoreMember(restarted.target('p7t3-worker-a'))),
    )
    const reaFields = runtimeErrorFields(
      await captureError(() => restarted.service.archiveMember(restarted.target('p7t3-worker-a'))),
    )
    return {
      recordLifecycle: recordAfter?.lifecycle ?? null,
      recordAv: recordAfter?.activityVersion ?? -1,
      identityVerbatim:
        recordAfter !== undefined &&
        recordAfter.rootSessionId === target.rootSessionId &&
        recordAfter.instanceId === target.instanceId &&
        recordAfter.templateId === P7T3_FIXTURE.templateId &&
        recordAfter.label === 'p7t3-worker-a' &&
        recordAfter.childSessionId === childSession &&
        recordAfter.createdAt === P7T3_FIXTURE.createdAt,
      bindingKind,
      bindingInstanceId,
      teamSessionPresent: teamSession !== undefined,
      recordRestartedLifecycle: recordRestarted?.lifecycle ?? null,
      recordRestartedAv: recordRestarted?.activityVersion ?? -1,
      redFields,
      rerFields,
      reaFields,
    }
  } finally {
    await destroyWorld(restarted)
  }
})()

it('X3 history preserved: DISPOSED record + bindings survive (verbatim, across restart); terminal re-ops rejected', () => {
  expect(x3.recordLifecycle).toBe('DISPOSED')
  expect(x3.recordAv).toBe(2)
  expect(x3.identityVerbatim).toBe(true)
  expect(x3.bindingKind).toBe('team-member')
  expect(x3.bindingInstanceId).not.toBe(null)
  expect(x3.teamSessionPresent).toBe(true)
  expect(x3.recordRestartedLifecycle).toBe('DISPOSED')
  expect(x3.recordRestartedAv).toBe(2)
  expect(x3.redFields.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(x3.redFields.from).toBe('DISPOSED')
  expect(x3.rerFields.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(x3.rerFields.from).toBe('DISPOSED')
  expect(x3.reaFields.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(x3.reaFields.from).toBe('DISPOSED')
})

// X4 — dispose a CREATED member (the direct edge, no settle pair), +1
// activity.
const x4 = await (async () => {
  const world = await createLifecycleWorld('p7t3-x4', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'CREATED' }],
  })
  try {
    const result = await world.service.disposeMember(world.target('p7t3-worker-a'))
    const durable = world.recordFor('p7t3-worker-a')
    return {
      steps: [...result.steps],
      lifecycle: result.member.lifecycle,
      av: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('X4 dispose CREATED: direct edge (one commit), +1 activity', () => {
  expect(x4.steps).toEqual(DISPOSE_STEPS)
  expect(x4.lifecycle).toBe('DISPOSED')
  expect(x4.av).toBe(2)
  expect(x4.durableLifecycle).toBe('DISPOSED')
  expect(x4.durableAv).toBe(2)
  expect(x4.commitOps).toEqual(['DISPOSE:CREATED->DISPOSED'])
})

// X5 — dispose an ARCHIVED member (the direct edge), +1 activity.
const x5 = await (async () => {
  const world = await createLifecycleWorld('p7t3-x5', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
  })
  try {
    const result = await world.service.disposeMember(world.target('p7t3-worker-a'))
    const durable = world.recordFor('p7t3-worker-a')
    return {
      steps: [...result.steps],
      lifecycle: result.member.lifecycle,
      av: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      durableAv: durable?.activityVersion ?? -1,
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('X5 dispose ARCHIVED: direct edge (one commit), +1 activity', () => {
  expect(x5.steps).toEqual(DISPOSE_STEPS)
  expect(x5.lifecycle).toBe('DISPOSED')
  expect(x5.av).toBe(2)
  expect(x5.durableLifecycle).toBe('DISPOSED')
  expect(x5.durableAv).toBe(2)
  expect(x5.commitOps).toEqual(['DISPOSE:ARCHIVED->DISPOSED'])
})
