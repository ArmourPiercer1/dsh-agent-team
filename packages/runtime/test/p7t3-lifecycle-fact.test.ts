/**
 * p7t3-lifecycle-fact — the durable evidence of the standalone lifecycle
 * service (UI doc §27.2; the bug #9 fix): every COMMITTED standalone
 * operation commits exactly ONE `member-lifecycle-changed` evidence — the
 * ledger append is the generation-advancing durable write that keeps the
 * post-op projection strictly newer than the pre-op frame — the REJECTED
 * operation commits NONE, and a world WITHOUT an evidence port is
 * unchanged (the optional port keeps the ledger-free P7-T3 worlds green).
 *
 * Top-level-await pattern: each world is built, the scenario executed, the
 * observables captured into a plain snapshot, the world destroyed in
 * `finally`; the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t3-lifecycle-fact
 */

import { expect, it } from 'vitest'
import { LIFECYCLE_RUNTIME_ERROR_CODES as CODES, LIFECYCLE_STEP_NAMES as S } from '../lifecycle/index.js'
import type { LifecycleEvidenceArgs, LifecycleEvidencePort } from '../lifecycle/index.js'
import {
  P7T3_FIXTURE,
  captureError,
  createLifecycleWorld,
  destroyWorld,
  restartLifecycleWorld,
  runtimeErrorFields,
} from './p7t3-helpers.js'

/** Assert-value helper (narrowing): the value is neither null nor undefined. */
function defined<T>(value: T, label: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error(`lifecycle-fact guard: ${label}`)
}

/** One recorded evidence call, copied out of the recorder (plain JSON). */
interface CallSnapshot {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly operation: 'archive' | 'restore' | 'dispose'
  readonly from: string
  readonly to: string
  readonly steps: readonly string[]
}

/** The captured call surface of one scenario (the recorder may be empty). */
interface CallsSnapshot {
  readonly count: number
  readonly first: CallSnapshot | null
}

/** Deep-copy the recorder's calls into plain snapshots (no live refs). */
function snapshotCalls(recorder: EvidenceRecorder): CallsSnapshot {
  const firstRaw = recorder.calls[0]
  return {
    count: recorder.calls.length,
    first:
      firstRaw === undefined
        ? null
        : {
            rootSessionId: firstRaw.rootSessionId,
            instanceId: firstRaw.instanceId,
            operation: firstRaw.operation,
            from: firstRaw.from,
            to: firstRaw.to,
            steps: [...firstRaw.steps],
          },
  }
}

/** One recording evidence port (the durable binding under assertion). */
class EvidenceRecorder implements LifecycleEvidencePort {
  readonly calls: LifecycleEvidenceArgs[] = []
  async commitLifecycleChanged(args: LifecycleEvidenceArgs): Promise<number> {
    this.calls.push(args)
    return this.calls.length
  }
}

const SETTLED_ARCHIVE_STEPS = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_ARCHIVE,
]
const RUNNING_ARCHIVE_STEPS = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_SETTLE,
  S.COMMIT_ARCHIVE,
]
const DISPOSE_STEPS = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_DISPOSE,
]

// A1 — archive from SETTLED: ONE evidence, SETTLED → ARCHIVED, the
// direct six-step trace, the durable row consistent.
const a1 = await (async () => {
  const evidence = new EvidenceRecorder()
  const world = await createLifecycleWorld('p7t3lf-a1', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'SETTLED' }],
    evidence,
  })
  try {
    const target = world.target('p7t3-worker-a')
    const result = await world.service.archiveMember(target)
    return {
      instanceId: target.instanceId,
      calls: snapshotCalls(evidence),
      to: result.member.lifecycle,
      durable: world.recordFor('p7t3-worker-a')?.lifecycle,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A1 — archive from SETTLED commits exactly ONE evidence (SETTLED → ARCHIVED, six steps)', () => {
  expect(a1.calls.count).toBe(1)
  const first = a1.calls.first
  defined(first, 'the evidence call is missing')
  expect(first.rootSessionId).toBe(String(P7T3_FIXTURE.rootSessionId))
  expect(first.instanceId).toBe(a1.instanceId)
  expect(first.operation).toBe('archive')
  expect(first.from).toBe('SETTLED')
  expect(first.to).toBe('ARCHIVED')
  expect([...first.steps]).toEqual(SETTLED_ARCHIVE_STEPS)
  expect(a1.to).toBe('ARCHIVED')
  expect(a1.durable).toBe('ARCHIVED')
})

// A2 — archive from RUNNING: settle-then-archive is ONE operation, so
// exactly ONE evidence (never one per internal commit), RUNNING →
// ARCHIVED, the seven-step trace.
const a2 = await (async () => {
  const evidence = new EvidenceRecorder()
  const world = await createLifecycleWorld('p7t3lf-a2', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
    evidence,
  })
  try {
    const result = await world.service.archiveMember(world.target('p7t3-worker-a'))
    return {
      calls: snapshotCalls(evidence),
      settledCommitted: result.settledCommitted,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A2 — archive from RUNNING commits exactly ONE evidence (RUNNING → ARCHIVED, seven steps)', () => {
  expect(a2.calls.count).toBe(1)
  const first = a2.calls.first
  defined(first, 'the evidence call is missing')
  expect(first.operation).toBe('archive')
  expect(first.from).toBe('RUNNING')
  expect(first.to).toBe('ARCHIVED')
  expect([...first.steps]).toEqual(RUNNING_ARCHIVE_STEPS)
  expect(a2.settledCommitted).toBe(true)
})

// A3 — restore from ARCHIVED: the single COMMIT_RESTORE step, exactly
// ONE evidence, ARCHIVED → SETTLED.
const a3 = await (async () => {
  const evidence = new EvidenceRecorder()
  const world = await createLifecycleWorld('p7t3lf-a3', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
    evidence,
  })
  try {
    const result = await world.service.restoreMember(world.target('p7t3-worker-a'))
    return {
      calls: snapshotCalls(evidence),
      to: result.member.lifecycle,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A3 — restore from ARCHIVED commits exactly ONE evidence (ARCHIVED → SETTLED, one step)', () => {
  expect(a3.calls.count).toBe(1)
  const first = a3.calls.first
  defined(first, 'the evidence call is missing')
  expect(first.operation).toBe('restore')
  expect(first.from).toBe('ARCHIVED')
  expect(first.to).toBe('SETTLED')
  expect([...first.steps]).toEqual([S.COMMIT_RESTORE])
  expect(a3.to).toBe('SETTLED')
})

// A4 — dispose from SETTLED: the quiesce + the DISPOSED terminal commit,
// exactly ONE evidence (the `to: 'DISPOSED'` fact the projection's
// `disposedAt` anchor needs), SETTLED → DISPOSED.
const a4 = await (async () => {
  const evidence = new EvidenceRecorder()
  const world = await createLifecycleWorld('p7t3lf-a4', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'SETTLED' }],
    evidence,
  })
  try {
    const result = await world.service.disposeMember(world.target('p7t3-worker-a'))
    return {
      calls: snapshotCalls(evidence),
      to: result.member.lifecycle,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A4 — dispose from SETTLED commits exactly ONE evidence (SETTLED → DISPOSED, six steps)', () => {
  expect(a4.calls.count).toBe(1)
  const first = a4.calls.first
  defined(first, 'the evidence call is missing')
  expect(first.operation).toBe('dispose')
  expect(first.from).toBe('SETTLED')
  expect(first.to).toBe('DISPOSED')
  expect([...first.steps]).toEqual(DISPOSE_STEPS)
  expect(a4.to).toBe('DISPOSED')
})

// A5 — archive from CREATED: the dry-run legality rejects BEFORE any
// commit — ZERO evidence, ZERO commits.
const a5 = await (async () => {
  const evidence = new EvidenceRecorder()
  const world = await createLifecycleWorld('p7t3lf-a5', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'CREATED' }],
    evidence,
  })
  try {
    const error = await captureError(() => world.service.archiveMember(world.target('p7t3-worker-a')))
    const fields = runtimeErrorFields(error)
    return {
      code: fields.code,
      evidenceCalls: evidence.calls.length,
      commitCalls: world.commit.calls.length,
      durable: world.recordFor('p7t3-worker-a')?.lifecycle,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A5 — rejected archive (CREATED) commits ZERO evidence and ZERO commits', () => {
  expect(a5.code).toBe(CODES.LIFECYCLE_ILLEGAL_STATE)
  expect(a5.evidenceCalls).toBe(0)
  expect(a5.commitCalls).toBe(0)
  expect(a5.durable).toBe('CREATED')
})

// A6 — a world WITHOUT the optional evidence port: the operation still
// commits the transition (the port is optional; the ledger-free worlds
// keep the P7-T3 behavior).
const a6 = await (async () => {
  const world = await createLifecycleWorld('p7t3lf-a6', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'SETTLED' }],
  })
  try {
    const result = await world.service.archiveMember(world.target('p7t3-worker-a'))
    return {
      hasPort: world.ports.evidence !== undefined,
      to: result.member.lifecycle,
      durable: world.recordFor('p7t3-worker-a')?.lifecycle,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A6 — the world without an evidence port archives as before (optional port)', () => {
  expect(a6.hasPort).toBe(false)
  expect(a6.to).toBe('ARCHIVED')
  expect(a6.durable).toBe('ARCHIVED')
})

// A7 — the process-restart model: the evidence port is CARRIED across
// the generation (a restarted world over the same scratch dir still
// commits its evidence), so a crash-restarted host never loses the fact.
const a7 = await (async () => {
  const evidence = new EvidenceRecorder()
  const world = await createLifecycleWorld('p7t3lf-a7', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'SETTLED' }],
    evidence,
  })
  try {
    const restarted = await restartLifecycleWorld(world)
    const result = await restarted.service.archiveMember(restarted.target('p7t3-worker-a'))
    return {
      carried: restarted.ports.evidence === evidence,
      calls: snapshotCalls(evidence),
      to: result.member.lifecycle,
    }
  } finally {
    await destroyWorld(world)
  }
})()

it('A7 — the evidence port survives a restart (one evidence on the restarted world)', () => {
  expect(a7.carried).toBe(true)
  expect(a7.calls.count).toBe(1)
  const first = a7.calls.first
  defined(first, 'the evidence call is missing')
  expect(first.from).toBe('SETTLED')
  expect(first.to).toBe('ARCHIVED')
  expect(a7.to).toBe('ARCHIVED')
})
