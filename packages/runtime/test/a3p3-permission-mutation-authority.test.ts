/**
 * Alpha.3 PR3 — the PERMISSION MUTATION path of the GovernanceMutationService
 * (implementation plan "PR3: Governance Mutation Integration"; ADR §1/§5/§6/§7;
 * design §2/§3.4/§4/§5).
 *
 * What is pinned here, in the plan's own words (plan PR3 "Tests"):
 *
 *   - Leader inside envelope;            (expansion WITH coverage commits)
 *   - Leader outside envelope;           (expansion WITHOUT coverage refuses, zero write)
 *   - Human exceeding envelope;          (ADR §7: may exceed; Human provenance; no
 *                                         permanent priority — the refusal never
 *                                         consults actor beyond the authority check)
 *   - Leader recovery after Human;       (tightening yes without envelope — D1 pins
 *                                         BOTH directions; expansion beyond the
 *                                         envelope still no)
 *   - CAS conflict.                      (expectedGeneration -> typed conflict, NO
 *                                         partial write)
 *
 * plus the coordinator's added pins: ADR §6 lane arithmetic in BOTH directions
 * (deny->ask, deny->allow, ask->allow need expansion authority; allow->ask,
 * allow->deny, ask->deny need NONE), exec EXACT-canonical-fingerprint-only
 * (design §5: no subtree, no any), snapshot-per-mutation through the PR1
 * persistence-only port (ADR §1/§5: the durable write is the PR1 store, so the
 * REAL durable world from `permission-overlay-helpers` is the fixture), the
 * unified PermissionMutation shape (design §3.4: grant_instance /
 * update_permission / revoke_permission are ONE shape), and provenance
 * (actor/mutationId/reason carried; timestamp from the injected clock).
 *
 * The service under test is the SAME class instance surface as the legacy
 * methods (coordinator D1: the authority is EXTENDED, never forked — there is
 * no second mutation class): `mutatePermission` is additive on
 * {@link createGovernanceMutationService}, serialized on the SAME shared
 * per-team chain, and it commits through the PR1
 * {@link PermissionOverlayRepositoryPort} and nothing else.
 *
 * Offline, host-free: the durable leg is the testkit FileStorageSeam scratch
 * world (the real PR1 persistence gates run underneath every commit).
 *
 * @module @dsh-agent-team/runtime/test/a3p3-permission-mutation-authority
 */

import { describe, expect, it } from 'vitest'
// A4-PR1: the grammar this kernel speaks is now DECLARED in the domain leaf and
// imported here — the module under test and this import must be one instantiation.
import * as domainEnvelope from '../../domain/authority-envelope/src/index.js'
import * as kernel from '../governance/permission-mutation.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  PERMISSION_MUTATION_ERROR_CODES,
  PERMISSION_EFFECT_PRECEDENCE,
  PERMISSION_MUTATION_KINDS,
  isPermissionMutationError,
  parsePermissionMutationEnvelope,
  permissionEffectDirection,
  type GovernanceMutationService,
  type GovernanceMutationServiceDeps,
  type PermissionMutationEnvelope,
  type PermissionStaticLayerFacts,
  type GovernancePermissionMutationArgs,
  type PermissionResourceMatcher,
} from '../governance/index.js'
/** A4-PR7 §7.5: this suite's world now DECLARES a Team authority ceiling instead of
 *  leaving the ceiling unaskable. Read the comment in that helper before changing
 *  anything here — the short version is that the 13 legs this repaired all live on
 *  the LEADER carrier and the ladder, which the declared ceiling deliberately does
 *  not touch, and no assertion in this file was edited to accommodate it. */
import { ceilingOverCells, declaredCeilingReader } from './a4p7-ceiling-world-helpers.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type {
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
} from '../governance/types.js'
// PRE-EXISTING lint debt, repaired in passing by A4-PR1 (the PR1 gate lints
// EVERY touched file, and this one was already dirty at base `3c310342`). The
// import is not dead weight: the module header at :34 links the type, and
// TSDoc resolves that link through this import — so it is kept and silenced,
// not deleted.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import {
  FIXTURE_INSTANCE_ID,
  FIXTURE_TEAM_SESSION_ID,
  openWorld,
  type World,
} from './permission-overlay-helpers.js'

// ---------------------------------------------------------------------------
// The in-memory world for the LEGACY lanes (the capability overrides store is
// never consulted by the permission path — the throwing PolicyReader proves it)
// ---------------------------------------------------------------------------

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}

class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}

class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}

/** The policy reader the PERMISSION path must NEVER consult (external hard
 *  facts are the capability plane's ceiling, `service.ts` writeTimeChecks; the
 *  §6 envelope is the permission plane's only bound). Every method throws, so
 *  a consult fails the test that owns it. */
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope(): never {
    throw new Error('the permission-mutation path must not read the capability envelope')
  },
  readTemplatePolicy(): never {
    throw new Error('the permission-mutation path must not read template policy')
  },
  readExternalFacts(): never {
    throw new Error('the permission-mutation path must not read external hard facts')
  },
}

// ---------------------------------------------------------------------------
// Fixtures (canonical identities are OPAQUE strings — the A2 contract: this
// suite never parses them, only compares them)
// ---------------------------------------------------------------------------

const FILE_KEY = 'file:/srv/worlds/a3p3/out.txt'
const FILE_KEY_OUTSIDE = 'file:/srv/worlds/other/elsewhere.txt'
const SUBTREE_ROOT = 'file:/srv/worlds/a3p3'
const NESTED_SUBTREE_ROOT = 'file:/srv/worlds/a3p3/sub'
const EXEC_FINGERPRINT = `sha256:${'a'.repeat(64)}`
const OTHER_EXEC_FINGERPRINT = `sha256:${'b'.repeat(64)}`

const NOW_A = '2026-10-05T10:00:00.000Z'

const LEADER = { kind: 'leader' } as const
const HUMAN = { kind: 'operator' } as const
const MEMBER = { kind: 'member', instanceId: FIXTURE_INSTANCE_ID } as const

function exact(key: string): PermissionResourceMatcher {
  return { kind: 'exact', resource: key }
}
function subtree(root: string): PermissionResourceMatcher {
  return { kind: 'subtree', resource: root }
}
function fingerprint(fp: string): PermissionResourceMatcher {
  return { kind: 'fingerprint', resource: fp }
}

/** The structural-containment double: the SAME canonical-key namespace, so a
 *  prefix-under-root comparison is the deterministic test algebra. Production
 *  wiring will inject the pinned public containment seam instead (this PR has
 *  zero production wiring). */
function keyContainment(root: string, child: string): boolean {
  return child === root || child.startsWith(`${root}/`)
}

/**
 * THE AUTHORITY WORLD THIS SUITE'S LEGS PRESUPPOSED BUT NEVER DECLARED (§7.5
 * prerequisite 3). Cells, not a wildcard — see `ceilingOverCells` for why the
 * domain algebra has no document-level `any`. Two rules deliberately stay OUT:
 *   * `OTHER_EXEC_FINGERPRINT` — "an exec expansion is covered ONLY by the
 *     identical fingerprint (no subtree, no any)" is a refusal leg, and the whole
 *     point of its refusal is that no document reaches the other fingerprint;
 *   * `operationClass: 'pwsh'` — the only pwsh drives here are refusal/malformed
 *     legs ("a DIFFERENT shell tool is a different authority identity", A2C-1), so
 *     declaring pwsh authority would delete the leg's meaning to buy its green.
 * The two `subtree` cells appear only in a world that WIRED the containment
 * predicate, because a subtree-vs-exact question without one is undecidable and
 * would make every exact cell of that class undetermined. Production always wires
 * the predicate (`src/plugin/permission-plane.ts:234-251` over `fsContainsKeys`);
 * the predicate-less worlds here are the fixtures' own choice, and the leg at
 * :470 exists to pin what that choice means.
 */
function CEILING_CELLS(withContainment: boolean): PermissionMutationEnvelope {
  const cells: { operationClass: string; matcher: PermissionResourceMatcher }[] = [
    { operationClass: 'write', matcher: exact(FILE_KEY) },
    { operationClass: 'write', matcher: exact(FILE_KEY_OUTSIDE) },
    { operationClass: 'read', matcher: exact(FILE_KEY) },
    { operationClass: 'bash', matcher: fingerprint(EXEC_FINGERPRINT) },
  ]
  if (withContainment) {
    cells.push(
      { operationClass: 'write', matcher: subtree(SUBTREE_ROOT) },
      { operationClass: 'write', matcher: subtree(NESTED_SUBTREE_ROOT) },
    )
  }
  return ceilingOverCells(cells)
}

interface World0 {
  readonly world: World
  readonly service: GovernanceMutationService
  readonly clock: { now: string }
  close(): Promise<void>
}

async function openServiceWorld(options: {
  envelope?: PermissionMutationEnvelope | (() => PermissionMutationEnvelope)
  subtreeContains?: (root: string, child: string) => boolean
  staticFacts?: PermissionStaticLayerFacts
}): Promise<World0> {
  const world = await openWorld(`a3p3-${Math.random().toString(36).slice(2, 8)}`)
  const clock = { now: NOW_A }
  const envelope =
    options.envelope === undefined
      ? undefined
      : typeof options.envelope === 'function'
        ? options.envelope
        : () => options.envelope as PermissionMutationEnvelope
  const deps: GovernanceMutationServiceDeps = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => clock.now,
    permissionLane: {
      overlay: world.port,
      ...(envelope === undefined ? {} : { permissionEnvelope: () => envelope() }),
      ...(options.subtreeContains === undefined ? {} : { subtreeContains: options.subtreeContains }),
      // Design v2: these legs measure the EXPANSION-coded semantics over a
      // KNOWN lower answer, so the fixture injects the DECLARED-NONE facts
      // (`{ layers: [] }` = decidable deny fallback — never conflated with
      // unknown, which types as EFFECT_CONTEXT_UNAVAILABLE and is pinned in
      // a3p3-revoke-reveal-semantics.test.ts instead).
      staticLayers: () => options.staticFacts ?? { layers: [] },
      // A4-PR7 §7.5 prerequisite 3 — THE WORLD THIS SUITE NEVER DECLARED. Before
      // that commit a lane with no `authorityCeiling` port skipped the ceiling gate
      // entirely, so every seeding `grant` below (`mut-seed-ask`, `mut-seed-allow`,
      // …) raised authority through an open gate: this suite was establishing its
      // preconditions by BYPASSING the law, not by passing it. The declared world is
      // the classes this suite drives, at `allow`, with the SAME carrier document the
      // lane injects — so the v3 gate cannot say anything on the carrier axis that
      // Alpha.3's coverage law above did not already say, `EMPTY envelope` legs still
      // refuse in the Leader path, and the ladder still decides who may rise.
      authorityCeiling: declaredCeilingReader({
        hardCeiling: CEILING_CELLS(options.subtreeContains !== undefined),
        ...(envelope === undefined ? {} : { carrier: () => envelope() }),
      }),
    },
  }
  return {
    world,
    clock,
    service: createGovernanceMutationService(deps),
    close: async () => {
      await world.store.close()
      world.destroy()
    },
  }
}

function grant(
  rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[],
  extra: Partial<GovernancePermissionMutationArgs> = {},
): GovernancePermissionMutationArgs {
  return {
    authority: LEADER,
    teamSessionId: FIXTURE_TEAM_SESSION_ID,
    memberInstanceId: FIXTURE_INSTANCE_ID,
    kind: 'grant_instance',
    mutationId: `mut-${Math.random().toString(36).slice(2, 10)}`,
    reason: 'fixture grant',
    rules,
    ...extra,
  }
}

const ENVELOPE_ALLOW_FILE: PermissionMutationEnvelope = {
  rules: [{ operationClass: 'write', matcher: exact(FILE_KEY), maximumEffect: 'allow' }],
}

// ---------------------------------------------------------------------------

describe('the §6 lane arithmetic (both directions, pinned in the kernel)', () => {
  it('deny->ask, deny->allow, ask->allow are EXPANSIONS; the reverse are TIGHTENINGS', () => {
    expect(permissionEffectDirection('deny', 'ask')).toBe('expansion')
    expect(permissionEffectDirection('deny', 'allow')).toBe('expansion')
    expect(permissionEffectDirection('ask', 'allow')).toBe('expansion')
    expect(permissionEffectDirection('allow', 'ask')).toBe('tightening')
    expect(permissionEffectDirection('allow', 'deny')).toBe('tightening')
    expect(permissionEffectDirection('ask', 'deny')).toBe('tightening')
    expect(permissionEffectDirection('allow', 'allow')).toBe('identity')
    // The ladder itself (ADR §6: deny < ask < allow on the expansion axis).
    expect(PERMISSION_EFFECT_PRECEDENCE.deny).toBeLessThan(PERMISSION_EFFECT_PRECEDENCE.ask)
    expect(PERMISSION_EFFECT_PRECEDENCE.ask).toBeLessThan(PERMISSION_EFFECT_PRECEDENCE.allow)
  })

  it('the unified mutation model carries exactly the three kinds (design §3.4)', () => {
    expect([...PERMISSION_MUTATION_KINDS].sort()).toEqual([
      'grant_instance',
      'revoke_permission',
      'update_permission',
    ])
  })
})

describe('Leader mutation inside the envelope (plan PR3)', () => {
  it('an ask->allow expansion covered by maximumEffect=allow commits a new snapshot', async () => {
    const w = await openServiceWorld({ envelope: ENVELOPE_ALLOW_FILE })
    try {
      // Seed: the pair stands at `ask` (a Human seed keeps the fixture short).
      const seeded = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'ask' }], {
          authority: HUMAN,
          mutationId: 'mut-seed-ask',
        }),
      )
      expect(seeded.changed).toBe(true)
      const result = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          expectedGeneration: seeded.changed ? seeded.snapshot.metadata.generation : undefined,
          mutationId: 'mut-expand-allow',
        }),
      )
      expect(result.changed).toBe(true)
      if (!result.changed) throw new Error('unreachable')
      expect(result.snapshot.metadata.generation).toBe(2)
      // The derived PR1 key grammar `<team>#<instance>#<generation>` (schema
      // permission-overlay.ts permissionOverlaySnapshotKey).
      expect(result.snapshot.metadata.previousSnapshotId).toBe(
        `${FIXTURE_TEAM_SESSION_ID}#${FIXTURE_INSTANCE_ID}#1`,
      )
      expect(result.snapshot.state.rules).toEqual([
        { operation: 'write', resource: `exact:${FILE_KEY}`, effect: 'allow' },
      ])
      expect(result.snapshot.provenance.actor).toBe('leader')
      expect(result.snapshot.provenance.mutationId).toBe('mut-expand-allow')
      expect(result.snapshot.provenance.timestamp).toBe(NOW_A)
    } finally {
      await w.close()
    }
  })

  it('a from-absence GRANT is an expansion measured from the DECLARED-NONE deny fallback (known fact, not a masquerade)', async () => {
    const w = await openServiceWorld({ envelope: ENVELOPE_ALLOW_FILE })
    try {
      const ok = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          mutationId: 'mut-grant-inside',
        }),
      )
      expect(ok.changed).toBe(true)
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'read', matcher: exact(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-grant-uncovered-class',
          }),
        )
        .catch((error: unknown) => error)
      expect(isPermissionMutationError(denied)).toBe(true)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w.close()
    }
  })

  it('TIGHTENINGS need NO expansion authority: all three, with an EMPTY envelope', async () => {
    const w = await openServiceWorld({ envelope: { rules: [] } })
    try {
      // Seed at allow through HUMAN (Human may seed what the Leader may not).
      await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          authority: HUMAN,
          mutationId: 'mut-seed-allow',
        }),
      )
      // allow -> ask, then ask -> deny, then deny stays: every leader step is
      // a tightening and needs no envelope rule at all.
      const t1 = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'ask' }], {
          mutationId: 'mut-t-allow-ask',
        }),
      )
      expect(t1.changed).toBe(true)
      const t2 = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'deny' }], {
          mutationId: 'mut-t-ask-deny',
        }),
      )
      expect(t2.changed).toBe(true)
      // deny -> allow would be the expansion the empty envelope refuses.
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-t-deny-allow-refused',
          }),
        )
        .catch((error: unknown) => error)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w.close()
    }
  })
})

describe('Leader mutation OUTSIDE the envelope (plan PR3)', () => {
  it('an expansion the envelope does not cover is refused and writes NOTHING', async () => {
    const w = await openServiceWorld({
      envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE_KEY), maximumEffect: 'ask' }] },
    })
    try {
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-outside-ceiling',
          }),
        )
        .catch((error: unknown) => error)
      expect(isPermissionMutationError(denied)).toBe(true)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
      // ZERO WRITE: the durable chain is untouched.
      const latest = await w.world.port.latest({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(latest).toBeUndefined()
      const history = await w.world.port.history({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(history).toHaveLength(0)
    } finally {
      await w.close()
    }
  })

  it('a maxEffect ceiling is a CEILING: ask covers deny->ask but never ask->allow', async () => {
    const w = await openServiceWorld({
      envelope: { rules: [{ operationClass: 'write', matcher: exact(FILE_KEY), maximumEffect: 'ask' }] },
    })
    try {
      const ok = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'ask' }], {
          mutationId: 'mut-ceiling-ask-ok',
        }),
      )
      expect(ok.changed).toBe(true)
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-ceiling-allow-refused',
          }),
        )
        .catch((error: unknown) => error)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w.close()
    }
  })

  it('exact envelope rules do not cover wider matchers; subtree roots cover what they contain', async () => {
    // (a) envelope exact K does NOT cover a subtree grant under K.
    const w1 = await openServiceWorld({ envelope: ENVELOPE_ALLOW_FILE, subtreeContains: keyContainment })
    try {
      const denied = await w1.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: subtree(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-exact-not-cover-subtree',
          }),
        )
        .catch((error: unknown) => error)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w1.close()
    }
    // (b) envelope subtree R covers an exact grant the containment says is below R.
    const w2 = await openServiceWorld({
      envelope: { rules: [{ operationClass: 'write', matcher: subtree(SUBTREE_ROOT), maximumEffect: 'allow' }] },
      subtreeContains: keyContainment,
    })
    try {
      const ok = await w2.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          mutationId: 'mut-subtree-covers-exact',
        }),
      )
      expect(ok.changed).toBe(true)
      const outside = await w2.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY_OUTSIDE), effect: 'allow' }], {
            mutationId: 'mut-subtree-outside',
          }),
        )
        .catch((error: unknown) => error)
      expect((outside as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w2.close()
    }
  })

  it('a subtree envelope matcher with NO injected containment refuses typed fail-closed (round 2: unknown coverage is CONTEXT, never a label on coverage nobody can judge)', async () => {
    const w = await openServiceWorld({
      envelope: { rules: [{ operationClass: 'write', matcher: subtree(SUBTREE_ROOT), maximumEffect: 'allow' }] },
    })
    try {
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-no-containment-port',
          }),
        )
        .catch((error: unknown) => error)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    } finally {
      await w.close()
    }
  })

  it('a MALFORMED envelope refuses a change-mutation that rises NOTHING (parse precedes classification — fail-closed has no decidable escape hatch)', async () => {
    const w = await openServiceWorld({
      envelope: {
        rules: [{ operationClass: 'write', matcher: exact(FILE_KEY), maximumEffect: 'permitted' }],
      } as unknown as PermissionMutationEnvelope, // maximumEffect outside the closed set
    })
    try {
      await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          authority: HUMAN,
          mutationId: 'seed-malformed-norise',
        }),
      )
      const before = await w.world.port.latest({ teamSessionId: 'session-root-1', memberInstanceId: 'inst-alpha' })
      // Pure tightening (overlay answers both sides): no rise ANYWHERE — still
      // refused, because the authority document is malformed, not absent.
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'deny' }], {
            mutationId: 'mut-malformed-norise',
          }),
        )
        .catch((error: unknown) => error)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_ENVELOPE)
      const after = await w.world.port.latest({ teamSessionId: 'session-root-1', memberInstanceId: 'inst-alpha' })
      expect(after?.metadata.generation).toBe(before?.metadata.generation)
    } finally {
      await w.close()
    }
  })
})

describe('Human mutation (ADR §7)', () => {
  it('may exceed the Leader envelope and records Human provenance', async () => {
    const w = await openServiceWorld({ envelope: { rules: [] } })
    try {
      const result = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          authority: HUMAN,
          mutationId: 'mut-human-beyond',
          reason: 'operator decision beyond the leader envelope',
        }),
      )
      expect(result.changed).toBe(true)
      if (!result.changed) throw new Error('unreachable')
      expect(result.snapshot.provenance.actor).toBe('human')
      expect(result.snapshot.provenance.reason).toBe('operator decision beyond the leader envelope')
    } finally {
      await w.close()
    }
  })

  it('creates NO permanent priority: the Leader recovers by tightening without any envelope, and still cannot expand beyond it', async () => {
    const w = await openServiceWorld({ envelope: { rules: [] } })
    try {
      await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          authority: HUMAN,
          mutationId: 'mut-human-grant',
        }),
      )
      // Recovery (tightening): no envelope needed — ADR §6/§7, D1.
      const tightened = await w.service.mutatePermission(
        {
          authority: LEADER,
          teamSessionId: FIXTURE_TEAM_SESSION_ID,
          memberInstanceId: FIXTURE_INSTANCE_ID,
          kind: 'update_permission',
          mutationId: 'mut-leader-recover',
          reason: 'leader recovery after human grant',
          rules: [{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'deny' }],
          expectedGeneration: 1,
        },
      )
      expect(tightened.changed).toBe(true)
      if (!tightened.changed) throw new Error('unreachable')
      expect(tightened.snapshot.provenance.actor).toBe('leader')
      // Re-expansion by the Leader (the human's own grant stands above the
      // recovery): the empty envelope still refuses — Human provenance bought
      // no permanent expansion room.
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
            mutationId: 'mut-leader-re-expand-refused',
          }),
        )
        .catch((error: unknown) => error)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w.close()
    }
  })
})

describe('CAS conflict (plan PR3)', () => {
  it('a stale expectedGeneration is a typed conflict with NO partial write', async () => {
    const w = await openServiceWorld({ envelope: { rules: [] } })
    try {
      await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          authority: HUMAN,
          mutationId: 'mut-cas-1',
        }),
      )
      await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'ask' }], {
          authority: HUMAN,
          mutationId: 'mut-cas-2',
        }),
      )
      const conflict = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'deny' }], {
            authority: HUMAN,
            mutationId: 'mut-cas-stale',
            expectedGeneration: 1,
          }),
        )
        .catch((error: unknown) => error)
      expect(isPermissionMutationError(conflict)).toBe(true)
      expect((conflict as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.GENERATION_CONFLICT)
      // Nothing was written by the refused call: still exactly generations 1-2.
      const history = await w.world.port.history({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(history.map((s) => s.metadata.generation)).toEqual([1, 2])
      const latest = await w.world.port.latest({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(latest?.state.rules[0]?.effect).toBe('ask')
    } finally {
      await w.close()
    }
  })
})

describe('snapshot-per-mutation through the persistence-only port (ADR §1/§5)', () => {
  it('every state-changing mutation appends exactly ONE FULL snapshot; the no-op writes none', async () => {
    const w = await openServiceWorld({ envelope: ENVELOPE_ALLOW_FILE, subtreeContains: keyContainment })
    try {
      const g1 = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
          mutationId: 'mut-snap-1',
        }),
      )
      expect(g1.changed).toBe(true)
      // A second pair rides the SAME chain — the snapshot is FULL, not a delta.
      const g2 = await w.service.mutatePermission(
        {
          authority: HUMAN,
          teamSessionId: FIXTURE_TEAM_SESSION_ID,
          memberInstanceId: FIXTURE_INSTANCE_ID,
          kind: 'grant_instance',
          mutationId: 'mut-snap-2',
          reason: 'second pair',
          rules: [{ operationClass: 'read', matcher: exact(FILE_KEY), effect: 'ask' }],
        },
      )
      expect(g2.changed).toBe(true)
      if (!g2.changed) throw new Error('unreachable')
      expect(g2.snapshot.state.rules).toHaveLength(2)
      // Re-applying the same desired state changes nothing: no snapshot, no
      // generation bump (the repo's byte-identical idempotency stays unseen).
      const noop = await w.service.mutatePermission(
        {
          authority: HUMAN,
          teamSessionId: FIXTURE_TEAM_SESSION_ID,
          memberInstanceId: FIXTURE_INSTANCE_ID,
          kind: 'update_permission',
          mutationId: 'mut-snap-3-noop',
          reason: 'same desired state',
          rules: [{ operationClass: 'read', matcher: exact(FILE_KEY), effect: 'ask' }],
        },
      )
      expect(noop.changed).toBe(false)
      const history = await w.world.port.history({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(history.map((s) => s.metadata.generation)).toEqual([1, 2])
      expect(history[1]?.metadata.previousSnapshotId).toBe(history[0]?.snapshotId)
    } finally {
      await w.close()
    }
  })

  it('revoke_permission produces the unified snapshot WITHOUT the addressed pairs and needs no expansion authority', async () => {
    const w = await openServiceWorld({ envelope: { rules: [] } })
    try {
      await w.service.mutatePermission(
        grant(
          [
            { operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' },
            { operationClass: 'read', matcher: exact(FILE_KEY), effect: 'ask' },
          ],
          { authority: HUMAN, mutationId: 'mut-revoke-seed' },
        ),
      )
      const revoked = await w.service.mutatePermission({
        authority: LEADER,
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
        kind: 'revoke_permission',
        mutationId: 'mut-revoke-1',
        reason: 'take the write grant back',
        // A revoke addresses the pair WITH the effect standing there — a
        // carried effect that does not match the durable one is a stale view
        // and refuses (the staleness signal beside the CAS).
        rules: [{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }],
      })
      expect(revoked.changed).toBe(true)
      if (!revoked.changed) throw new Error('unreachable')
      expect(revoked.snapshot.state.rules).toEqual([
        { operation: 'read', resource: `exact:${FILE_KEY}`, effect: 'ask' },
      ])
      expect(revoked.snapshot.metadata.generation).toBe(2)
    } finally {
      await w.close()
    }
  })
})

describe('exec exactness (design §5)', () => {
  it('exec rules carry EXACT canonical fingerprints ONLY: subtree and any matchers are malformed', async () => {
    const w = await openServiceWorld({ envelope: { rules: [] } })
    try {
      const badSubtree = await w.service
        .mutatePermission(
          grant([{ operationClass: 'bash', matcher: subtree(SUBTREE_ROOT), effect: 'deny' }], {
            authority: HUMAN,
            mutationId: 'mut-exec-subtree',
          }),
        )
        .catch((error: unknown) => error)
      expect(isPermissionMutationError(badSubtree)).toBe(true)
      expect((badSubtree as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION)
      const anyish = await w.service
        .mutatePermission(
          grant([{ operationClass: 'pwsh', matcher: { kind: 'any' as never, resource: '' } as never, effect: 'deny' }], {
            authority: HUMAN,
            mutationId: 'mut-exec-any',
          }),
        )
        .catch((error: unknown) => error)
      expect((anyish as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION)
      // The file classes are the mirror image: a fingerprint matcher on `write`
      // is outside the fs grammar and malformed too.
      const fsFingerprint = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: fingerprint(EXEC_FINGERPRINT), effect: 'deny' }], {
            authority: HUMAN,
            mutationId: 'mut-fs-fingerprint',
          }),
        )
        .catch((error: unknown) => error)
      expect((fsFingerprint as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION)
    } finally {
      await w.close()
    }
  })

  it('an exec expansion is covered ONLY by the identical fingerprint (no subtree, no any)', async () => {
    const envelope: PermissionMutationEnvelope = {
      rules: [{ operationClass: 'bash', matcher: fingerprint(EXEC_FINGERPRINT), maximumEffect: 'allow' }],
    }
    const w = await openServiceWorld({ envelope })
    try {
      const ok = await w.service.mutatePermission(
        grant([{ operationClass: 'bash', matcher: fingerprint(EXEC_FINGERPRINT), effect: 'allow' }], {
          mutationId: 'mut-exec-exact-ok',
        }),
      )
      expect(ok.changed).toBe(true)
      const other = await w.service
        .mutatePermission(
          grant([{ operationClass: 'bash', matcher: fingerprint(OTHER_EXEC_FINGERPRINT), effect: 'allow' }], {
            mutationId: 'mut-exec-other-refused',
          }),
        )
        .catch((error: unknown) => error)
      expect((other as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
      // A DIFFERENT shell tool is a different authority identity (A2C-1).
      const pwsh = await w.service
        .mutatePermission(
          grant([{ operationClass: 'pwsh', matcher: fingerprint(EXEC_FINGERPRINT), effect: 'allow' }], {
            mutationId: 'mut-exec-pwsh-refused',
          }),
        )
        .catch((error: unknown) => error)
      expect((pwsh as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    } finally {
      await w.close()
    }
  })

  it('an envelope rule that MISPAIRS matcher kind and operation class is malformed (never silently inert)', () => {
    let bad: unknown = null
    try {
      // The kernel validates the envelope at the lane boundary; a bash rule
      // with an exact file matcher is a mispair and refuses at parse time.
      parsePermissionMutationEnvelope({
        rules: [{ operationClass: 'bash', matcher: exact(FILE_KEY), maximumEffect: 'allow' }],
      })
    } catch (error) {
      bad = error
    }
    expect(isPermissionMutationError(bad)).toBe(true)
    expect((bad as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_ENVELOPE)
  })
})

describe('authority and configuration boundaries', () => {
  it('a member authority on the permission lane is UNAUTHORIZED with zero write', async () => {
    const w = await openServiceWorld({ envelope: ENVELOPE_ALLOW_FILE })
    try {
      const denied = await w.service
        .mutatePermission(
          grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'allow' }], {
            authority: MEMBER,
            mutationId: 'mut-member-refused',
          }),
        )
        .catch((error: unknown) => error)
      expect(isPermissionMutationError(denied)).toBe(true)
      expect((denied as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.UNAUTHORIZED_ACTOR)
      const history = await w.world.port.history({
        teamSessionId: FIXTURE_TEAM_SESSION_ID,
        memberInstanceId: FIXTURE_INSTANCE_ID,
      })
      expect(history).toHaveLength(0)
    } finally {
      await w.close()
    }
  })

  it('without permissionLane deps the method fails typed NOT_CONFIGURED and the legacy methods still work', async () => {
    const deps: GovernanceMutationServiceDeps = {
      chain: createTeamOperationCoordinator(),
      overrides: new NoopOverrides(),
      transitions: new NoopTransitions(),
      transitionCommit: new NoopCommit(),
      policy: NEVER_CONSULTED,
      registeredMembers: async () => [],
      policyStates: () => ['default'],
      now: () => NOW_A,
    }
    const service = createGovernanceMutationService(deps)
    const refused = await service
      .mutatePermission(
        grant([{ operationClass: 'write', matcher: exact(FILE_KEY), effect: 'deny' }], {
          authority: HUMAN,
          mutationId: 'mut-unconfigured',
        }),
      )
      .catch((error: unknown) => error)
    expect(isPermissionMutationError(refused)).toBe(true)
    expect((refused as { code: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.NOT_CONFIGURED)
    // The legacy surface is exactly the three PR-A methods plus the additive
    // fourth; `switchPolicyState` (the cheapest legacy method to exercise)
    // keeps its pre-PR3 behavior on a service built WITHOUT the new deps —
    // the dependency field is optional by construction, so the production
    // root.ts wiring compiles and behaves byte-unchanged.
    const legacy = await service.switchPolicyState({
      actor: { kind: 'human' },
      rootSessionId: FIXTURE_TEAM_SESSION_ID,
      target: { stateId: 'default' },
    })
    expect(legacy.changed).toBe(false)
    if (legacy.changed) throw new Error('unreachable')
    expect(legacy.reason).toBe('no-change')
  })

  it('a nested-subtree grant is covered only by a subtree envelope root the containment accepts', async () => {
    const w = await openServiceWorld({
      envelope: { rules: [{ operationClass: 'write', matcher: subtree(SUBTREE_ROOT), maximumEffect: 'allow' }] },
      subtreeContains: keyContainment,
    })
    try {
      const ok = await w.service.mutatePermission(
        grant([{ operationClass: 'write', matcher: subtree(NESTED_SUBTREE_ROOT), effect: 'allow' }], {
          mutationId: 'mut-nested-subtree-ok',
        }),
      )
      expect(ok.changed).toBe(true)
      if (!ok.changed) throw new Error('unreachable')
      expect(ok.snapshot.state.rules).toEqual([
        { operation: 'write', resource: `subtree:${NESTED_SUBTREE_ROOT}`, effect: 'allow' },
      ])
    } finally {
      await w.close()
    }
  })
})

// ---------------------------------------------------------------------------
// A4-PR1 (ADR A3-9/A1-18). The authority grammar this kernel speaks was moved
// DOWN into `packages/domain/authority-envelope` — the same vocabulary the v3
// Blueprint hash carrier is written in — and the Alpha.3 names above survived as
// ALIASES. Two facts are pinned here because both are invisible from outside and
// both are the kind that "still work" after being broken:
//   1. the alias is IDENTITY, not a structural copy. A copy agrees today and
//      drifts tomorrow, and this vocabulary is bound into a content hash: the
//      drift would not be a failing test, it would be a stored document whose
//      meaning moved under it.
//   2. the two parsers stay TWO. `parseAuthorityEnvelope` (domain) reads the
//      DECLARED AST shape — `{ kind: 'exact', path }`, `{ kind: 'fingerprint',
//      fingerprint }` — because that is the shape a hash binds; this module's
//      parser reads the canonical RUNTIME shape — `{ kind, resource }` — because
//      that is what a coverage comparison over canonical identities consumes.
//      Neither can replace the other, and the collapse between them happens
//      exactly once, in `src/plugin/permission-plane.ts` (correction X5-E2).
// ---------------------------------------------------------------------------

describe('the grammar is ONE shared domain leaf, and the two parsers stay two (A4-PR1)', () => {
  it('the kernel names ARE the domain vocabulary, not a compatible re-declaration', () => {
    expect(kernel.matcherCovers).toBe(domainEnvelope.matcherCovers)
    expect(kernel.PERMISSION_EFFECT_PRECEDENCE).toBe(domainEnvelope.AUTHORITY_EFFECT_PRECEDENCE)
    expect(kernel.PERMISSION_RESOURCE_MATCHER_KINDS).toBe(domainEnvelope.AUTHORITY_MATCHER_KINDS)
    // The envelope this kernel produces is the document the ceiling algebra
    // consumes — so a rule that parses here is readable there without a
    // transformation, which is what "one grammar, two documents" has to mean.
    const parsed = parsePermissionMutationEnvelope({
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/a' }, maximumEffect: 'ask' }],
    })
    expect(domainEnvelope.narrowingForApproval(parsed, { operationClass: 'write', matcher: { kind: 'exact', resource: '/work/a' } }).status).toBe('decided')
  })

  it('this parser refuses the DECLARED AST shape it is not allowed to read', () => {
    const astShaped = {
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', path: '/work/a' }, maximumEffect: 'ask' }],
    }
    expect(() => parsePermissionMutationEnvelope(astShaped)).toThrowError(
      expect.objectContaining({
        code: PERMISSION_MUTATION_ERROR_CODES.MALFORMED_ENVELOPE,
        details: expect.objectContaining({ problem: 'matcher-resource-empty' }),
      }),
    )
    // …and the domain parser refuses the RUNTIME shape right back. Both
    // directions, or a silent one-sided coercion could be "fixed" by deleting
    // one of these two refusals.
    const runtimeShaped = {
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/a' }, maximumEffect: 'ask' }],
    }
    const refusal = domainEnvelope.parseAuthorityEnvelope(runtimeShaped)
    expect(refusal.ok).toBe(false)
    if (refusal.ok) return
    expect(refusal.problems.map((entry) => entry.problem)).toContain('matcher-identity-missing')
    // And the AST shape it DOES accept, verbatim, without any canonicalization
    // — no workspace exists at this layer to canonicalize against (ADR A2-3).
    const accepted = domainEnvelope.parseAuthorityEnvelope(astShaped)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.envelope).toEqual(astShaped)
  })
})
