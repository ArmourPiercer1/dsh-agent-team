/**
 * P7-T4 — the repeat reconciliation (idempotency; Architecture §35.2 — the
 * recognition/reconciliation is a pure function of the durable state, and
 * repeated reconciliation is idempotent):
 *
 * - P1 — root fork: the first run creates the sidecar (2 writes); the
 *   SECOND and THIRD runs recognize it (`root-fork-already-reconciled`, 0
 *   writes each) and the child record is byte-identical (same
 *   createdAt/generation/snapshot) across all runs;
 * - P2 — root fork across the process-restart model (DevPlan §18.5): the
 *   sidecar survives the restart and the re-run is a no-op (0 writes);
 * - P3 — member fork: repeat runs stay `member-fork` with 0 writes and
 *   create nothing;
 * - P4 — ordinary fork: repeat runs stay `ordinary-fork` with 0 writes;
 * - P5 — an already-reconciled child record with a FOREIGN snapshot
 *   fails closed (invariant 10 is re-verified on every recognition);
 * - P6 — an already-reconciled child record at generation 2 fails closed
 *   (the fork-established TeamSession is a generation-1 record).
 *
 * The durable layer is REAL: the P4 repositories over the testkit
 * `FileStorageSeam` and the real fork-reconciliation port adapter.
 *
 * @module @dsh-agent-team/runtime/test/p7t4-repeat-reconcile
 */

import { describe, expect, it } from 'vitest'
import {
  FORK_RECONCILIATION_ERROR_CODES,
  isForkReconciliationError,
  reconcileForkSidecar,
} from '../fork-reconciliation/index.js'
import type { ForkReconciliationResult } from '../fork-reconciliation/index.js'
import type { TeamSessionRecordDto } from '../../contracts/src/index.js'
import {
  P7T4_FIXTURE,
  createForkWorld,
  destroyWorld,
  restartForkWorld,
  seedMemberChild,
  seedOrdinaryBinding,
  seedRootBindingOnly,
  seedChildTeamSession,
  seedTeamRoot,
} from './p7t4-helpers.js'
import type { P7T4World } from './p7t4-helpers.js'

const ROOT = String(P7T4_FIXTURE.rootSessionId)
const CHILD = String(P7T4_FIXTURE.forkChildSessionId)
const MEMBER_CHILD = String(P7T4_FIXTURE.memberChildSessionId)
const ORDINARY_PARENT = String(P7T4_FIXTURE.ordinaryParentSessionId)
const INSTANCE_ID = String(P7T4_FIXTURE.instanceId)

async function runReconcile(
  world: P7T4World,
  input: { parentSessionId: string; childSessionId: string },
): Promise<{ result: ForkReconciliationResult | undefined; error: unknown }> {
  const ports = { teamDomain: world.teamDomain, now: () => world.clock.now() }
  try {
    return { result: await reconcileForkSidecar(input, ports), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error
    ? ((error as { code: unknown }).code as string | undefined)
    : undefined
}

// ── P1 — root fork: the idempotent re-runs ───────────────────────────────
const p1 = await (async () => {
  const world = await createForkWorld('p7t4-repeat-p1')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint, {
      defaultWorkspace: P7T4_FIXTURE.defaultWorkspace,
    })
    const base0 = world.seam.writeCount
    const run1 = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    const after1 = world.repositories.teamSessions.get(CHILD) as
      | TeamSessionRecordDto
      | undefined
    const base1 = world.seam.writeCount
    const run2 = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    const mid = world.seam.writeCount
    const run3 = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    const after3 = world.repositories.teamSessions.get(CHILD) as
      | TeamSessionRecordDto
      | undefined
    return {
      run1,
      run2,
      run3,
      writesRun1: world.seam.writeCount - base0,
      writesRun2: mid - base1,
      writesRun3: world.seam.writeCount - mid,
      recordAfter1: after1,
      recordAfter3: after3,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── P2 — root fork: idempotent across the process-restart model ──────────
const p2 = await (async () => {
  const world = await createForkWorld('p7t4-repeat-p2')
  let current: P7T4World = world
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    const run1 = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    current = await restartForkWorld(world)
    const base2 = current.seam.writeCount
    const run2 = await runReconcile(current, { parentSessionId: ROOT, childSessionId: CHILD })
    return {
      run1,
      run2,
      writesRun2: current.seam.writeCount - base2,
      finalRecord: current.repositories.teamSessions.get(CHILD) as
        | TeamSessionRecordDto
        | undefined,
      finalBinding: current.repositories.sessionBindings.get(CHILD),
    }
  } finally {
    await destroyWorld(current)
  }
})()

// ── P3 — member fork: the idempotent re-runs ─────────────────────────────
const p3 = await (async () => {
  const world = await createForkWorld('p7t4-repeat-p3')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    const base0 = world.seam.writeCount
    const run1 = await runReconcile(world, { parentSessionId: MEMBER_CHILD, childSessionId: CHILD })
    const base1 = world.seam.writeCount
    const run2 = await runReconcile(world, { parentSessionId: MEMBER_CHILD, childSessionId: CHILD })
    return {
      run1,
      run2,
      writesRun1: world.seam.writeCount - base0,
      writesRun2: world.seam.writeCount - base1,
      childBinding: world.repositories.sessionBindings.get(CHILD),
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── P4 — ordinary fork: the idempotent re-runs ───────────────────────────
const p4 = await (async () => {
  const world = await createForkWorld('p7t4-repeat-p4')
  try {
    const base0 = world.seam.writeCount
    const run1 = await runReconcile(world, { parentSessionId: ORDINARY_PARENT, childSessionId: CHILD })
    const base1 = world.seam.writeCount
    const run2 = await runReconcile(world, { parentSessionId: ORDINARY_PARENT, childSessionId: CHILD })
    return {
      run1,
      run2,
      writesRun1: world.seam.writeCount - base0,
      writesRun2: world.seam.writeCount - base1,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── P5 — already-reconciled with a FOREIGN snapshot (fail closed) ────────
const p5 = await (async () => {
  const world = await createForkWorld('p7t4-repeat-p5')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedChildTeamSession(world, CHILD, P7T4_FIXTURE.blueprintOther)
    await seedRootBindingOnly(world, CHILD)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── P6 — already-reconciled at generation 2 (fail closed) ────────────────
const p6 = await (async () => {
  const world = await createForkWorld('p7t4-repeat-p6')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedChildTeamSession(world, CHILD, P7T4_FIXTURE.blueprint, { generation: 2 })
    await seedRootBindingOnly(world, CHILD)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P7-T4 P1 — the root-fork re-runs are idempotent', () => {
  it('the first run creates the sidecar (root-fork-reconciled, 2 writes)', () => {
    expect(p1.run1.error).toBe(undefined)
    expect(p1.run1.result?.outcome).toBe('root-fork-reconciled')
    expect(p1.run1.result?.durableWrites).toBe(2)
    expect(p1.writesRun1).toBe(2)
  })

  it('the second and third runs recognize it: already-reconciled with 0 writes each', () => {
    expect(p1.run2.error).toBe(undefined)
    expect(p1.run2.result?.outcome).toBe('root-fork-already-reconciled')
    expect(p1.run2.result?.durableWrites).toBe(0)
    expect(p1.writesRun2).toBe(0)
    expect(p1.run3.error).toBe(undefined)
    expect(p1.run3.result?.outcome).toBe('root-fork-already-reconciled')
    expect(p1.run3.result?.durableWrites).toBe(0)
    expect(p1.writesRun3).toBe(0)
  })

  it('the child TeamSession record is byte-identical across the runs', () => {
    expect(p1.recordAfter3).toEqual(p1.recordAfter1)
    expect(p1.recordAfter1?.generation).toBe(1)
    expect(p1.recordAfter1?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(p1.recordAfter1?.createdAt).toBe(P7T4_FIXTURE.forkCreatedAt)
  })
})

describe('P7-T4 P2 — the root-fork sidecar survives the process restart', () => {
  it('the re-run after the restart is a no-op recognition (0 writes), state intact', () => {
    expect(p2.run1.result?.outcome).toBe('root-fork-reconciled')
    expect(p2.run2.error).toBe(undefined)
    expect(p2.run2.result?.outcome).toBe('root-fork-already-reconciled')
    expect(p2.run2.result?.durableWrites).toBe(0)
    expect(p2.writesRun2).toBe(0)
    expect(p2.finalRecord?.rootSessionId).toBe(CHILD)
    expect(p2.finalRecord?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(p2.finalBinding?.kind).toBe('team-root')
  })
})

describe('P7-T4 P3/P4 — the member-fork and ordinary-fork re-runs are no-ops', () => {
  it('P3 repeats the member fork: member-fork, 0 writes, nothing created', () => {
    expect(p3.run1.result?.outcome).toBe('member-fork')
    expect(p3.run2.result?.outcome).toBe('member-fork')
    expect(p3.writesRun1).toBe(0)
    expect(p3.writesRun2).toBe(0)
    expect(p3.childBinding).toBe(undefined)
  })

  it('P4 repeats the ordinary fork: ordinary-fork, 0 writes', () => {
    expect(p4.run1.result?.outcome).toBe('ordinary-fork')
    expect(p4.run2.result?.outcome).toBe('ordinary-fork')
    expect(p4.writesRun1).toBe(0)
    expect(p4.writesRun2).toBe(0)
  })
})

describe('P7-T4 P5/P6 — the recognition re-verifies the fork invariants (fail closed)', () => {
  it('P5 rejects an already-reconciled child record that binds a different snapshot', () => {
    expect(p5.run.result).toBe(undefined)
    expect(isForkReconciliationError(p5.run.error)).toBe(true)
    expect(errorCode(p5.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(p5.writeDelta).toBe(0)
  })

  it('P6 rejects an already-reconciled child record that is not generation 1', () => {
    expect(p6.run.result).toBe(undefined)
    expect(isForkReconciliationError(p6.run.error)).toBe(true)
    expect(errorCode(p6.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(p6.writeDelta).toBe(0)
  })
})
