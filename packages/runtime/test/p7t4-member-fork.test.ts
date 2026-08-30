/**
 * P7-T4 — the member fork (DevPlan §20.4; Architecture §35.3, invariant
 * 62): a native fork of a Member's durable child session stays an ORDINARY
 * independent AgentSession — NOT a new MemberInstance, NOT a member of the
 * original Team, NOT a new TeamSession, NOT a Leader; no Team binding is
 * ever inferred; the TeamDomain sidecar is untouched (0 durable writes).
 *
 * Scenarios (top-level-await pattern):
 *
 * - M1 — the member fork positive path (0 writes, nothing created for the
 *   child, the parent team's member set is unchanged);
 * - M2 — the fork child already carries an `ordinary` row (fail closed:
 *   a freshly minted fork child has no row; nothing is re-pointed,
 *   invariant 24);
 * - M3 — the fork child is already a member child of the SAME team (fail
 *   closed: a fork child is never adopted as a MemberInstance);
 * - M4 — the fork child already carries a `team-root` row (fail closed:
 *   a member fork never establishes a TeamSession, §20.4).
 *
 * The durable layer is REAL: the P4 repositories over the testkit
 * `FileStorageSeam` and the real fork-reconciliation port adapter.
 *
 * @module @dsh-agent-team/runtime/test/p7t4-member-fork
 */

import { describe, expect, it } from 'vitest'
import {
  FORK_RECONCILIATION_ERROR_CODES,
  isForkReconciliationError,
  reconcileForkSidecar,
} from '../fork-reconciliation/index.js'
import type { ForkReconciliationResult } from '../fork-reconciliation/index.js'
import {
  P7T4_FIXTURE,
  assertOutcome,
  createForkWorld,
  destroyWorld,
  seedMemberChild,
  seedMemberInstance,
  seedOrdinaryBinding,
  seedRootBindingOnly,
  seedTeamRoot,
} from './p7t4-helpers.js'
import type { P7T4World } from './p7t4-helpers.js'

const ROOT = String(P7T4_FIXTURE.rootSessionId)
const MEMBER_CHILD = String(P7T4_FIXTURE.memberChildSessionId)
const CHILD = String(P7T4_FIXTURE.forkChildSessionId)
const OTHER_CHILD = String(P7T4_FIXTURE.otherChildSessionId)
const INSTANCE_ID = String(P7T4_FIXTURE.instanceId)
const INSTANCE_ID_B = 'inst-p7t4beta'

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

// ── M1 — the member fork positive path ───────────────────────────────────
const m1 = await (async () => {
  const world = await createForkWorld('p7t4-member-m1')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    await seedMemberInstance(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: MEMBER_CHILD, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      childBinding: world.repositories.sessionBindings.get(CHILD),
      childTeamSession: world.repositories.teamSessions.get(CHILD),
      teamMembers: world.repositories.memberInstances.list(ROOT).length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── M2 — the fork child already carries an ordinary row ──────────────────
const m2 = await (async () => {
  const world = await createForkWorld('p7t4-member-m2')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    await seedOrdinaryBinding(world, CHILD)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: MEMBER_CHILD, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── M3 — the fork child is already a member child of the same team ───────
const m3 = await (async () => {
  const world = await createForkWorld('p7t4-member-m3')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    await seedMemberChild(world, ROOT, CHILD, INSTANCE_ID_B)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: MEMBER_CHILD, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── M4 — the fork child already carries a team-root row ──────────────────
const m4 = await (async () => {
  const world = await createForkWorld('p7t4-member-m4')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    await seedRootBindingOnly(world, CHILD)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: MEMBER_CHILD, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      otherChildUnbound: world.repositories.sessionBindings.get(OTHER_CHILD),
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P7-T4 M1 — the member fork (ordinary independent session)', () => {
  it('resolves the fork as a plain member fork: no TeamSession, no binding, 0 writes', () => {
    expect(m1.run.error).toBe(undefined)
    const result = assertOutcome(m1.run.result, 'member-fork')
    expect(result.parentRootSessionId).toBe(ROOT)
    expect(result.durableWrites).toBe(0)
    expect(m1.writeDelta).toBe(0)
  })

  it('creates NOTHING for the child (no binding row, no TeamSession record)', () => {
    expect(m1.childBinding).toBe(undefined)
    expect(m1.childTeamSession).toBe(undefined)
  })

  it('does not adopt the child as a MemberInstance of the original team (invariant 62)', () => {
    expect(m1.teamMembers).toBe(1)
  })
})

describe('P7-T4 M2/M3/M4 — contradictory fork-child states (fail closed)', () => {
  it('M2 rejects a fork child that already carries an ordinary row (no re-pointing, invariant 24)', () => {
    expect(m2.run.result).toBe(undefined)
    expect(isForkReconciliationError(m2.run.error)).toBe(true)
    expect(errorCode(m2.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(m2.writeDelta).toBe(0)
  })

  it('M3 rejects a fork child that is already a member child of the same team', () => {
    expect(m3.run.result).toBe(undefined)
    expect(isForkReconciliationError(m3.run.error)).toBe(true)
    expect(errorCode(m3.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(m3.writeDelta).toBe(0)
  })

  it('M4 rejects a fork child that already carries a team-root row (a member fork never establishes a TeamSession)', () => {
    expect(m4.run.result).toBe(undefined)
    expect(isForkReconciliationError(m4.run.error)).toBe(true)
    expect(errorCode(m4.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(m4.writeDelta).toBe(0)
  })
})
