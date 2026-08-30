/**
 * P7-T4 — the root-fork sidecar (DevPlan §20.4; Architecture §35.1/§35.2):
 * a native fork of a Team root session is reconciled into a NEW TeamSession
 * for the fork child with the SAME immutable Blueprint snapshot (invariant
 * 10) and EMPTY MemberInstances, in the crash-safe order (record before
 * `team-root` binding); `session.fork` is never patched (zero-core).
 *
 * Scenarios (top-level-await pattern, plain-node shim: `it` bodies are
 * synchronous and assert only over captured snapshots):
 *
 * - R1 — the fresh root fork (the full positive path, write ordering);
 * - R2 — the parent team has no defaultWorkspace (the child record has none);
 * - R3 — the parent team HAS members (they are NOT copied to the child);
 * - R4/R5/R6 — invalid input (malformed parent / malformed child /
 *   parent === child): `FORK_INVALID_INPUT`, no effect;
 * - R7 — parent `team-root` binding without its record (fail closed);
 * - R8/R9 — child already bound / child with member rows (fail closed);
 * - R10/R11/R12 — child sidecar states contradicting the fork fact
 *   (binding without record, foreign snapshot, generation ≠ 1; fail closed).
 *
 * The durable layer is REAL: the P4 repositories over the testkit
 * `FileStorageSeam` and the real fork-reconciliation port adapter.
 *
 * @module @dsh-agent-team/runtime/test/p7t4-root-fork
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
  seedChildTeamSession,
  seedTeamRoot,
} from './p7t4-helpers.js'
import type { P7T4World } from './p7t4-helpers.js'

const ROOT = String(P7T4_FIXTURE.rootSessionId)
const CHILD = String(P7T4_FIXTURE.forkChildSessionId)
const MEMBER_CHILD = String(P7T4_FIXTURE.memberChildSessionId)
const OTHER_CHILD = String(P7T4_FIXTURE.otherChildSessionId)
const INSTANCE_ID = String(P7T4_FIXTURE.instanceId)

/** One reconciler run: the result or the thrown error (never both). */
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

/** The closed error code of a captured error (undefined when absent). */
function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error
    ? ((error as { code: unknown }).code as string | undefined)
    : undefined
}

// ── R1 — the fresh root fork (the full positive path) ───────────────────
const r1 = await (async () => {
  const world = await createForkWorld('p7t4-root-r1')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint, {
      defaultWorkspace: P7T4_FIXTURE.defaultWorkspace,
    })
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      lastWriteTables: world.seam.writeLog.slice(-2).map((entry) => entry.table),
      repoRecord: world.repositories.teamSessions.get(CHILD),
      repoBinding: world.repositories.sessionBindings.get(CHILD),
      repoChildMembers: world.repositories.memberInstances.list(CHILD).length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── R2 — the parent team has no defaultWorkspace ─────────────────────────
const r2 = await (async () => {
  const world = await createForkWorld('p7t4-root-r2')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      repoRecord: world.repositories.teamSessions.get(CHILD),
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── R3 — the parent team HAS members (not copied) ────────────────────────
const r3 = await (async () => {
  const world = await createForkWorld('p7t4-root-r3')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    await seedMemberInstance(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      parentMembers: world.repositories.memberInstances.list(ROOT).length,
      childMembers: world.repositories.memberInstances.list(CHILD).length,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── R4 — invalid input: malformed parent id ──────────────────────────────
const r4 = await (async () => {
  const world = await createForkWorld('p7t4-root-r4')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    const base = world.seam.writeCount
    const run = await runReconcile(world, {
      parentSessionId: 'bad parent id',
      childSessionId: CHILD,
    })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── R5 — invalid input: malformed child id (too long) ────────────────────
const r5 = await (async () => {
  const world = await createForkWorld('p7t4-root-r5')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    const base = world.seam.writeCount
    const run = await runReconcile(world, {
      parentSessionId: ROOT,
      childSessionId: 'x'.repeat(300),
    })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── R6 — invalid input: parent === child ─────────────────────────────────
const r6 = await (async () => {
  const world = await createForkWorld('p7t4-root-r6')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: ROOT })
    return {
      run,
      writeDelta: world.seam.writeCount - base,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ── R7 — parent team-root binding without its record (fail closed) ───────
const r7 = await (async () => {
  const world = await createForkWorld('p7t4-root-r7')
  try {
    await seedRootBindingOnly(world, ROOT)
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

// ── R8 — the fork child already carries an `ordinary` row (fail closed) ──
const r8 = await (async () => {
  const world = await createForkWorld('p7t4-root-r8')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedOrdinaryBinding(world, CHILD)
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

// ── R9 — the fork child root already carries member rows (fail closed) ───
const r9 = await (async () => {
  const world = await createForkWorld('p7t4-root-r9')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberInstance(world, CHILD, OTHER_CHILD, INSTANCE_ID)
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

// ── R10 — the child has a team-root binding without a record ─────────────
const r10 = await (async () => {
  const world = await createForkWorld('p7t4-root-r10')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
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

// ── R11 — the child record carries a FOREIGN snapshot (fail closed) ──────
const r11 = await (async () => {
  const world = await createForkWorld('p7t4-root-r11')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedChildTeamSession(world, CHILD, P7T4_FIXTURE.blueprintOther)
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

// ── R12 — the child record is at generation 2 (fail closed) ──────────────
const r12 = await (async () => {
  const world = await createForkWorld('p7t4-root-r12')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedChildTeamSession(world, CHILD, P7T4_FIXTURE.blueprint, { generation: 2 })
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
// Assertions (synchronous `it` bodies over the captured snapshots)
// ---------------------------------------------------------------------------

describe('P7-T4 R1 — the fresh root fork', () => {
  it('reconciles into a NEW TeamSession for the child (TeamSessionId = child id, invariant 9)', () => {
    expect(r1.run.error).toBe(undefined)
    const result = assertOutcome(r1.run.result, 'root-fork-reconciled')
    expect(result.parentRootSessionId).toBe(ROOT)
    expect(r1.repoRecord?.rootSessionId).toBe(CHILD)
    expect(r1.repoRecord?.generation).toBe(1)
  })

  it('binds the SAME immutable Blueprint snapshot as the parent team (invariant 10)', () => {
    expect(r1.repoRecord?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    const result = assertOutcome(r1.run.result, 'root-fork-reconciled')
    expect(result.blueprintSnapshot).toEqual(P7T4_FIXTURE.blueprint)
  })

  it('inherits the parent team defaultWorkspace and stamps the injected-clock createdAt', () => {
    expect(r1.repoRecord?.defaultWorkspace).toBe(P7T4_FIXTURE.defaultWorkspace)
    expect(r1.repoRecord?.createdAt).toBe(P7T4_FIXTURE.forkCreatedAt)
  })

  it('commits the child team-root binding row (the child id IS the TeamSession id)', () => {
    expect(r1.repoBinding?.kind).toBe('team-root')
    expect(r1.repoBinding?.sessionId).toBe(CHILD)
    const result = assertOutcome(r1.run.result, 'root-fork-reconciled')
    expect(result.childBinding.kind).toBe('team-root')
    expect(result.childBinding.sessionId).toBe(CHILD)
  })

  it('leaves the child team with EMPTY MemberInstances and applies exactly 2 durable writes', () => {
    expect(r1.repoChildMembers).toBe(0)
    const result = assertOutcome(r1.run.result, 'root-fork-reconciled')
    expect(result.memberCount).toBe(0)
    expect(result.durableWrites).toBe(2)
    expect(r1.writeDelta).toBe(2)
  })

  it('applies the writes in the CRASH-SAFE order: record before binding', () => {
    expect(r1.lastWriteTables).toEqual(['team_sessions', 'session_bindings'])
  })
})

describe('P7-T4 R2 — root fork without a parent defaultWorkspace', () => {
  it('creates the child record WITHOUT a defaultWorkspace (2 writes, exact snapshot)', () => {
    expect(r2.run.error).toBe(undefined)
    const result = assertOutcome(r2.run.result, 'root-fork-reconciled')
    expect(result.durableWrites).toBe(2)
    expect(r2.writeDelta).toBe(2)
    expect(r2.repoRecord?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(r2.repoRecord?.defaultWorkspace).toBe(undefined)
  })
})

describe('P7-T4 R3 — root fork of a team that HAS members', () => {
  it('ends in EMPTY MemberInstances: the parent members are NOT copied', () => {
    expect(r3.run.error).toBe(undefined)
    const result = assertOutcome(r3.run.result, 'root-fork-reconciled')
    expect(result.memberCount).toBe(0)
    expect(r3.childMembers).toBe(0)
    expect(r3.parentMembers).toBe(1)
    expect(r3.writeDelta).toBe(2)
  })
})

describe('P7-T4 R4/R5/R6 — invalid fork input (no effect)', () => {
  it('R4 rejects a malformed parent session id with FORK_INVALID_INPUT', () => {
    expect(r4.run.result).toBe(undefined)
    expect(r4.run.error instanceof Error).toBe(true)
    expect(isForkReconciliationError(r4.run.error)).toBe(true)
    expect(errorCode(r4.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_INVALID_INPUT)
    expect(r4.writeDelta).toBe(0)
  })

  it('R5 rejects a malformed child session id with FORK_INVALID_INPUT', () => {
    expect(r5.run.result).toBe(undefined)
    expect(isForkReconciliationError(r5.run.error)).toBe(true)
    expect(errorCode(r5.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_INVALID_INPUT)
    expect(r5.writeDelta).toBe(0)
  })

  it('R6 rejects parent === child with FORK_INVALID_INPUT (a fork mints a NEW session)', () => {
    expect(r6.run.result).toBe(undefined)
    expect(isForkReconciliationError(r6.run.error)).toBe(true)
    expect(errorCode(r6.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_INVALID_INPUT)
    expect(r6.writeDelta).toBe(0)
  })
})

describe('P7-T4 R7/R8/R9 — contradictory durable state (fail closed, no effect)', () => {
  it('R7 rejects a parent team-root binding without its TeamSession record', () => {
    expect(r7.run.result).toBe(undefined)
    expect(isForkReconciliationError(r7.run.error)).toBe(true)
    expect(errorCode(r7.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(r7.writeDelta).toBe(0)
  })

  it('R8 rejects a fork child that already carries an ordinary binding row', () => {
    expect(r8.run.result).toBe(undefined)
    expect(isForkReconciliationError(r8.run.error)).toBe(true)
    expect(errorCode(r8.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(r8.writeDelta).toBe(0)
  })

  it('R9 rejects a fork child root that already carries MemberInstance rows', () => {
    expect(r9.run.result).toBe(undefined)
    expect(isForkReconciliationError(r9.run.error)).toBe(true)
    expect(errorCode(r9.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(r9.writeDelta).toBe(0)
  })
})

describe('P7-T4 R10/R11/R12 — contradictory child sidecar states (fail closed)', () => {
  it('R10 rejects a child team-root binding without its TeamSession record', () => {
    expect(r10.run.result).toBe(undefined)
    expect(isForkReconciliationError(r10.run.error)).toBe(true)
    expect(errorCode(r10.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(r10.writeDelta).toBe(0)
  })

  it('R11 rejects a child record that binds a different Blueprint snapshot (invariant 10)', () => {
    expect(r11.run.result).toBe(undefined)
    expect(isForkReconciliationError(r11.run.error)).toBe(true)
    expect(errorCode(r11.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(r11.writeDelta).toBe(0)
  })

  it('R12 rejects a child record that is not the generation-1 fork record', () => {
    expect(r12.run.result).toBe(undefined)
    expect(isForkReconciliationError(r12.run.error)).toBe(true)
    expect(errorCode(r12.run.error)).toBe(FORK_RECONCILIATION_ERROR_CODES.FORK_STATE_CONFLICT)
    expect(r12.writeDelta).toBe(0)
  })
})
