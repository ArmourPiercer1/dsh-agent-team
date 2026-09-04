/**
 * P7-T4 — the ordinary fork (DevPlan §20.4; Architecture §35.1/§35.2): a
 * native fork of a session that carries no Team binding (unbound or
 * `ordinary`) reconciles to `ordinary-fork` — the child is an ordinary
 * independent session; the TeamDomain sidecar is untouched (0 durable
 * writes, no rows created or modified).
 *
 * Scenarios (top-level-await pattern):
 *
 * - O1 — the unbound parent (no row at all): `ordinary-fork` / `unbound`;
 * - O2 — the `ordinary` parent (a durably recorded plain session):
 *   `ordinary-fork` / `ordinary`;
 * - O3 — the fork child already carries an `ordinary` row (fail closed: a
 *   freshly minted fork child has no row);
 * - O4 — the fork child already carries a `team-member` row (fail closed:
 *   a fork child is never adopted into a Team);
 * - O5 — invalid input: an empty parent id (no effect).
 *
 * The durable layer is REAL: the P4 repositories over the testkit
 * `FileStorageSeam` and the real fork-reconciliation port adapter.
 *
 * @module @dsh-agent-team/runtime/test/p7t4-ordinary-fork
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
  seedOrdinaryBinding,
  seedTeamRoot,
} from './p7t4-helpers.js'
import type { P7T4World } from './p7t4-helpers.js'

const ROOT = String(P7T4_FIXTURE.rootSessionId)
const ORDINARY_PARENT = String(P7T4_FIXTURE.ordinaryParentSessionId)
const CHILD = String(P7T4_FIXTURE.forkChildSessionId)
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

// ── O1 — the unbound parent ──────────────────────────────────────────────
const o1 = await (async () => {
  const world = await createForkWorld('p7t4-ordinary-o1')
  try {
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ORDINARY_PARENT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      totalRows:
        world.repositories.sessionBindings.listByKind('ordinary').length +
        world.repositories.sessionBindings.listByKind('team-root').length +
        world.repositories.sessionBindings.listByKind('team-member').length +
        world.repositories.teamSessions.list().length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── O2 — the ordinary parent ─────────────────────────────────────────────
const o2 = await (async () => {
  const world = await createForkWorld('p7t4-ordinary-o2')
  try {
    await seedOrdinaryBinding(world, ORDINARY_PARENT)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ORDINARY_PARENT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      childBinding: world.repositories.sessionBindings.get(CHILD),
      childTeamSession: world.repositories.teamSessions.get(CHILD),
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── O3 — the fork child already carries an ordinary row ──────────────────
const o3 = await (async () => {
  const world = await createForkWorld('p7t4-ordinary-o3')
  try {
    await seedOrdinaryBinding(world, CHILD)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ORDINARY_PARENT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── O4 — the fork child already carries a team-member row ────────────────
const o4 = await (async () => {
  const world = await createForkWorld('p7t4-ordinary-o4')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, CHILD, INSTANCE_ID)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ORDINARY_PARENT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── O5 — invalid input: the empty parent id ──────────────────────────────
const o5 = await (async () => {
  const world = await createForkWorld('p7t4-ordinary-o5')
  try {
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: '', childSessionId: CHILD })
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

describe('P7-T4 O1/O2 — the ordinary fork (the sidecar stays untouched)', () => {
  it('O1 resolves an unbound parent to ordinary-fork / unbound with 0 writes', () => {
    expect(o1.run.error).toBe(undefined)
    const result = assertOutcome(o1.run.result, 'ordinary-fork')
    expect(result.parentBinding).toBe('unbound')
    expect(result.durableWrites).toBe(0)
    expect(o1.writeDelta).toBe(0)
  })

  it('O1 creates no rows at all (the sidecar was already empty and stays empty)', () => {
    expect(o1.totalRows).toBe(0)
  })

  it('O2 resolves an ordinary parent to ordinary-fork / ordinary with 0 writes', () => {
    expect(o2.run.error).toBe(undefined)
    const result = assertOutcome(o2.run.result, 'ordinary-fork')
    expect(result.parentBinding).toBe('ordinary')
    expect(result.durableWrites).toBe(0)
    expect(o2.writeDelta).toBe(0)
  })

  it('O2 creates nothing for the child (no binding row, no TeamSession record)', () => {
    expect(o2.childBinding).toBe(undefined)
    expect(o2.childTeamSession).toBe(undefined)
  })
})

describe('P7-T4 O3/O4/O5 — contradictory state and invalid input (no effect)', () => {
  it('O3 rejects a fork child that already carries an ordinary row', () => {
    expect(o3.run.result).toBe(undefined)
    expect(isForkReconciliationError(o3.run.error)).toBe(true)
    expect(errorCode(o3.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(o3.writeDelta).toBe(0)
  })

  it('O4 rejects a fork child that already carries a team-member row (no adoption)', () => {
    expect(o4.run.result).toBe(undefined)
    expect(isForkReconciliationError(o4.run.error)).toBe(true)
    expect(errorCode(o4.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(o4.writeDelta).toBe(0)
  })

  it('O5 rejects an empty parent session id with FORK_INVALID_INPUT', () => {
    expect(o5.run.result).toBe(undefined)
    expect(isForkReconciliationError(o5.run.error)).toBe(true)
    expect(errorCode(o5.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_INVALID_INPUT)
    expect(o5.writeDelta).toBe(0)
  })
})
