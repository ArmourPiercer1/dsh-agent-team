/**
 * P7-T4 — the crash-during-sidecar matrix (DevPlan §20.4; the P4-T5
 * fault-injection precedent): a crash between the two crash-safe writes of
 * the root-fork sidecar (record first, `team-root` binding second) is
 * durable-safe — the committed prefix survives the restart, and a re-run
 * of `reconcileForkSidecar` completes the sidecar idempotently.
 *
 * Scenarios (top-level-await pattern; REAL seam faults via the testkit
 * `FileStorageSeam.armCrashAfterWrites`):
 *
 * - C1 — crash at the FIRST write (the TeamSession record): nothing is
 *   committed (0 durable writes, a `team_sessions` crash-leftover `.tmp`
 *   file); after the process-restart model (NEW seam, SAME scratch dir) a
 *   re-run creates the full sidecar (2 writes) and the state is complete;
 * - C2 — crash at the SECOND write (the `team-root` binding): the record
 *   is committed and the binding is missing (the crash-window state);
 *   after the restart a re-run rolls forward with exactly ONE durable
 *   write (the missing binding only) and the committed record is
 *   untouched (same bytes: same createdAt/generation/snapshot).
 *
 * The reconciler propagates the seam failure unwrapped (the repository's
 * `SEAM_FAILURE` classification) — it is NOT a fork-reconciliation code:
 * the call fails closed and a later re-run succeeds.
 *
 * @module @dsh-agent-team/runtime/test/p7t4-crash-sidecar
 */

import { describe, expect, it } from 'vitest'
import {
  isForkReconciliationError,
  reconcileForkSidecar,
} from '../fork-reconciliation/index.js'
import type { ForkReconciliationResult } from '../fork-reconciliation/index.js'
import type { SessionBindingDto, TeamSessionRecordDto } from '../../contracts/src/index.js'
import { listFiles } from '../../testkit/fault-injection/file-seam.mjs'
import {
  P7T4_FIXTURE,
  createForkWorld,
  destroyWorld,
  restartForkWorld,
  seedTeamRoot,
} from './p7t4-helpers.js'
import type { P7T4World } from './p7t4-helpers.js'

const ROOT = String(P7T4_FIXTURE.rootSessionId)
const CHILD = String(P7T4_FIXTURE.forkChildSessionId)
const DOMAIN = 'team_domain'

async function runReconcile(
  world: P7T4World,
): Promise<{ result: ForkReconciliationResult | undefined; error: unknown }> {
  const ports = { teamDomain: world.teamDomain, now: () => world.clock.now() }
  try {
    return {
      result: await reconcileForkSidecar(
        { parentSessionId: ROOT, childSessionId: CHILD },
        ports,
      ),
      error: undefined,
    }
  } catch (error) {
    return { result: undefined, error }
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error
    ? ((error as { code: unknown }).code as string | undefined)
    : undefined
}

function tmpLeftovers(world: P7T4World): string[] {
  return listFiles(world.seam.dirFor(DOMAIN)).filter((f) => f.endsWith('.tmp')).sort()
}

// ── C1 — crash at the FIRST sidecar write (the TeamSession record) ───────
const c1 = await (async () => {
  const world = await createForkWorld('p7t4-crash-c1')
  let current: P7T4World = world
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint, {
      defaultWorkspace: P7T4_FIXTURE.defaultWorkspace,
    })
    const base = world.seam.writeCount
    // The NEXT write (the sidecar record) crashes mid-atomic-write.
    world.seam.armCrashAfterWrites(base)
    const run = await runReconcile(world)
    const crash = {
      run,
      writeDelta: world.seam.writeCount - base,
      recordAfterCrash: world.repositories.teamSessions.get(CHILD) as
        | TeamSessionRecordDto
        | undefined,
      bindingAfterCrash: world.repositories.sessionBindings.get(CHILD) as
        | SessionBindingDto
        | undefined,
      tmpFiles: tmpLeftovers(world),
    }
    // The process-restart model: a NEW seam over the SAME scratch dir.
    world.seam.clearCrash()
    current = await restartForkWorld(world)
    const base2 = current.seam.writeCount
    const rerun = await runReconcile(current)
    return {
      ...crash,
      rerun,
      rerunWriteDelta: current.seam.writeCount - base2,
      finalRecord: current.repositories.teamSessions.get(CHILD) as
        | TeamSessionRecordDto
        | undefined,
      finalBinding: current.repositories.sessionBindings.get(CHILD) as
        | SessionBindingDto
        | undefined,
      finalChildMembers: current.repositories.memberInstances.list(CHILD).length,
    }
  } finally {
    await destroyWorld(current)
  }
})()

// ── C2 — crash at the SECOND sidecar write (the team-root binding) ───────
const c2 = await (async () => {
  const world = await createForkWorld('p7t4-crash-c2')
  let current: P7T4World = world
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint, {
      defaultWorkspace: P7T4_FIXTURE.defaultWorkspace,
    })
    const base = world.seam.writeCount
    // Write #1 (the sidecar record) commits; the NEXT write (the binding)
    // crashes mid-atomic-write.
    world.seam.armCrashAfterWrites(base + 1)
    const run = await runReconcile(world)
    const crash = {
      run,
      writeDelta: world.seam.writeCount - base,
      recordAfterCrash: world.repositories.teamSessions.get(CHILD) as
        | TeamSessionRecordDto
        | undefined,
      bindingAfterCrash: world.repositories.sessionBindings.get(CHILD) as
        | SessionBindingDto
        | undefined,
      tmpFiles: tmpLeftovers(world),
    }
    // The process-restart model: a NEW seam over the SAME scratch dir.
    world.seam.clearCrash()
    current = await restartForkWorld(world)
    const base2 = current.seam.writeCount
    const rerun = await runReconcile(current)
    return {
      ...crash,
      rerun,
      rerunWriteDelta: current.seam.writeCount - base2,
      finalRecord: current.repositories.teamSessions.get(CHILD) as
        | TeamSessionRecordDto
        | undefined,
      finalBinding: current.repositories.sessionBindings.get(CHILD) as
        | SessionBindingDto
        | undefined,
    }
  } finally {
    await destroyWorld(current)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P7-T4 C1 — crash at the FIRST sidecar write (the record)', () => {
  it('the call fails closed with the seam SEAM_FAILURE (not a fork-reconciliation code)', () => {
    expect(c1.run.result).toBe(undefined)
    expect(c1.run.error instanceof Error).toBe(true)
    expect(isForkReconciliationError(c1.run.error)).toBe(false)
    expect(errorCode(c1.run.error)).toBe('SEAM_FAILURE')
  })

  it('commits NOTHING: no child record, no child binding, 0 durable writes', () => {
    expect(c1.recordAfterCrash).toBe(undefined)
    expect(c1.bindingAfterCrash).toBe(undefined)
    expect(c1.writeDelta).toBe(0)
  })

  it('leaves exactly one crash-leftover tmp file for the team_sessions table', () => {
    expect(c1.tmpFiles.length).toBe(1)
    expect(c1.tmpFiles[0]?.startsWith('team_sessions.json.')).toBe(true)
  })

  it('after the restart the re-run creates the full sidecar (2 writes) and the state is complete', () => {
    expect(c1.rerun.error).toBe(undefined)
    expect(c1.rerun.result?.outcome).toBe('root-fork-reconciled')
    expect(c1.rerun.result?.durableWrites).toBe(2)
    expect(c1.rerunWriteDelta).toBe(2)
    expect(c1.finalRecord?.rootSessionId).toBe(CHILD)
    expect(c1.finalRecord?.generation).toBe(1)
    expect(c1.finalRecord?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(c1.finalBinding?.kind).toBe('team-root')
    expect(c1.finalBinding?.sessionId).toBe(CHILD)
    expect(c1.finalChildMembers).toBe(0)
  })
})

describe('P7-T4 C2 — crash at the SECOND sidecar write (the binding)', () => {
  it('the call fails closed with the seam SEAM_FAILURE (not a fork-reconciliation code)', () => {
    expect(c2.run.result).toBe(undefined)
    expect(c2.run.error instanceof Error).toBe(true)
    expect(isForkReconciliationError(c2.run.error)).toBe(false)
    expect(errorCode(c2.run.error)).toBe('SEAM_FAILURE')
  })

  it('the committed prefix SURVIVES: the child record is durable, the binding is missing', () => {
    expect(c2.recordAfterCrash?.rootSessionId).toBe(CHILD)
    expect(c2.recordAfterCrash?.generation).toBe(1)
    expect(c2.recordAfterCrash?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(c2.recordAfterCrash?.defaultWorkspace).toBe(P7T4_FIXTURE.defaultWorkspace)
    expect(c2.recordAfterCrash?.createdAt).toBe(P7T4_FIXTURE.forkCreatedAt)
    expect(c2.bindingAfterCrash).toBe(undefined)
    expect(c2.writeDelta).toBe(1)
  })

  it('leaves exactly one crash-leftover tmp file for the session_bindings table', () => {
    expect(c2.tmpFiles.length).toBe(1)
    expect(c2.tmpFiles[0]?.startsWith('session_bindings.json.')).toBe(true)
  })

  it('after the restart the re-run rolls forward with EXACTLY ONE write (the missing binding)', () => {
    expect(c2.rerun.error).toBe(undefined)
    expect(c2.rerun.result?.outcome).toBe('root-fork-reconciled')
    expect(c2.rerun.result?.durableWrites).toBe(1)
    expect(c2.rerunWriteDelta).toBe(1)
    expect(c2.finalBinding?.kind).toBe('team-root')
    expect(c2.finalBinding?.sessionId).toBe(CHILD)
  })

  it('the committed record is untouched by the roll-forward (same identity stamp)', () => {
    expect(c2.finalRecord?.createdAt).toBe(P7T4_FIXTURE.forkCreatedAt)
    expect(c2.finalRecord?.generation).toBe(1)
    expect(c2.finalRecord?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(c2.finalRecord?.defaultWorkspace).toBe(P7T4_FIXTURE.defaultWorkspace)
  })
})
