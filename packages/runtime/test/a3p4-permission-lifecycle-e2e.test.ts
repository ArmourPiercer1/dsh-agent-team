/**
 * Alpha.3 PR4 — the permission LIFECYCLE lane, end to end (implementation
 * plan "PR4: Grant/Revoke/Lifecycle"; ADR §2/§3/§5/§7/§8; design §5/§6).
 *
 * This is the plan's PR4 test list, driven through the REAL service entry and
 * the REAL lifecycle path — not through kernel units:
 *
 *   - exact grant;                    (leg A/B: a NEW snapshot, then the
 *                                      effective decision answering `allow`
 *                                      with the overlay authority)
 *   - subtree grant;                  (leg C: the containment predicate
 *                                      injected through the production lane,
 *                                      PLUS the contrast leg — the same
 *                                      subtree mutation against a lane with
 *                                      NO predicate is refused typed, zero
 *                                      write: the merged PR3 gate)
 *   - exec exact grant;               (leg D: exact canonical fingerprint,
 *                                      and a DIFFERENT fingerprint stays
 *                                      unaffected — design §6 "exec
 *                                      fingerprint isolation")
 *   - revoke history;                 (leg E: revoke creates a snapshot, the
 *                                      OLD overlay is byte-identical, the new
 *                                      one is latest, and the effective
 *                                      effect DROPS per resolver recompute)
 *   - archive;                        (leg F: ARCHIVED cannot execute — the
 *                                      overlay stays retained as the
 *                                      authority, execution is refused)
 *   - dispose;                        (leg G: DISPOSED never executes and a
 *                                      mutation against it is refused typed)
 *   - restore;                        (legs H/I: the SAME instance returns
 *                                      with the CURRENT latest overlay —
 *                                      revoked-during-archive stays revoked —
 *                                      and a pure restore writes NOTHING)
 *   - no inheritance;                 (leg J: an instance created after the
 *                                      grants has zero permissions)
 *   - typed lifecycle errors;         (leg K: restore-of-not-archived and
 *                                      dispose-of-terminal propagate the
 *                                      frozen FSM's typed refusals verbatim)
 *
 * NOTHING here is stubbed that the plan asks to be real: the mutation goes
 * through `GovernanceMutationService.mutatePermission` (the ONE authority),
 * the snapshots land in the durable `permission_overlays` store of the real
 * TeamDomain (the testkit file seam), the lifecycle transitions run the REAL
 * `createLifecycleService` over the REAL `member-instances` rows (the P7-T3
 * world, whose Restore is the frozen single-commit G7 procedure), and the
 * effective decision is produced by the merged read plane (PR2 assembler +
 * the frozen Alpha.2 resolver for the file class; the governance kernel's own
 * effective-answer algebra for the exec fingerprint class).
 *
 * Offline, host-free: no port, no model, no network.
 *
 * @module @dsh-agent-team/runtime/test/a3p4-permission-lifecycle-e2e
 */

import { describe, expect, it } from 'vitest'
import { parseChildSessionId, parseInstanceId } from '../../contracts/src/index.js'
import { destroyDir, FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import type { PermissionOverlaySnapshot } from '../../storage/schema/permission-overlay.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
/** A4-PR7 §7.5: this suite's lane now DECLARES the Team authority ceiling its
 *  grant/revoke/archive/restore drives presuppose. See `a4p7-ceiling-world-helpers`
 *  for why the declaration is a cell set, never an `any` wildcard. */
import { ceilingOverCells, declaredCeilingReader } from './a4p7-ceiling-world-helpers.js'
import {
  PERMISSION_MUTATION_ERROR_CODES,
  createGovernanceMutationService,
  parsePermissionResourceText,
  permissionEffectiveAnswer,
  renderPermissionResourceText,
  type GovernanceMutationService,
  type GovernanceMutationServiceDeps,
  type GovernancePermissionMutationArgs,
  type PermissionMutationEnvelope,
  type PermissionResourceMatcher,
} from '../governance/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import { createPermissionLifecycleMutationLane, createPermissionDecisionLane } from '../permission-lifecycle/index.js'
// The production assembly helper: the faulting-containment leg below drives
// the SAME mapping the host entry installs (a containment FAULT is the
// kernel's typed UNKNOWN coverage, never a `false` verdict).
import { createPermissionGovernanceLane } from '../src/plugin/permission-plane.js'
import {
  PERMISSION_LIFECYCLE_ERROR_CODES,
  PermissionLifecycleError,
} from '../permission-lifecycle/types.js'
import type {
  MemberLifecycleReaderPort,
  PermissionDecisionLane,
  PermissionLifecycleMutationLane,
} from '../permission-lifecycle/types.js'
import { evaluatePermissionLifecycleGate } from '../permission-lifecycle/decision-lane.js'
import type { CanonicalRule, CanonicalRules } from '../operation-permission/permission-resolver.js'
import type { CanonicalOperation, PermissionTool } from '../operation-permission/types.js'
import type { EffectivePermissionStaticLayer } from '../effective-policy/permission-assembler.js'
import {
  LIFECYCLE_RUNTIME_ERROR_CODES,
  isLifecycleRuntimeError,
} from '../lifecycle/index.js'
import {
  P7T3_FIXTURE,
  P7T3_SPEC_A,
  P7T3_SPEC_B,
  createLifecycleWorld,
  type P7T3World,
} from './p7t3-helpers.js'

// ---------------------------------------------------------------------------
// The canonical-identity algebra of this world (the A5 adapter's job in
// production: the test owns a deterministic stand-in, exactly as the PR3
// specs do — the authority NEVER parses or builds keys of its own).
// ---------------------------------------------------------------------------

/** One canonical file key (opaque to the lane; `/`-nested by construction). */
const KEY_A = 'vol-root/src/a.ts'
const KEY_B = 'vol-root/src/nested/b.ts'
const KEY_OUTSIDE = 'vol-other/src/c.ts'
const ROOT_DIR = 'vol-root/src'

const FP_A = `sha256:${'a'.repeat(64)}`
const FP_B = `sha256:${'b'.repeat(64)}`

/** The deterministic containment algebra (identity contains itself). */
function keyContains(root: string, child: string): boolean {
  return root === child || child.startsWith(`${root}/`)
}

function fileOperation(tool: PermissionTool, key: string): CanonicalOperation {
  return { tool, resource: { kind: 'file', key, display: `display:${key}` }, fingerprint: `sha256:${'f'.repeat(64)}` }
}

function execOperation(fingerprint: string): CanonicalOperation {
  return { tool: 'bash', resource: { kind: 'tool', key: 'bash', display: 'bash' }, fingerprint }
}

function exact(key: string): PermissionResourceMatcher {
  return { kind: 'exact', resource: key }
}

function subtree(key: string): PermissionResourceMatcher {
  return { kind: 'subtree', resource: key }
}

function fingerprint(fp: string): PermissionResourceMatcher {
  return { kind: 'fingerprint', resource: fp }
}

/** The static template layer of the fixture template (canonical form). */
function templateLayer(
  lanes: Partial<CanonicalRules>,
  fallback: 'ask' | 'deny' = 'ask',
): EffectivePermissionStaticLayer {
  return {
    label: 'p7t3worker',
    default: fallback,
    rules: { allow: lanes.allow ?? [], ask: lanes.ask ?? [], deny: lanes.deny ?? [] },
  }
}

function exactRule(tool: PermissionTool, key: string): CanonicalRule {
  return { tool, resource: { kind: 'exact', key } }
}

// ---------------------------------------------------------------------------
// The world: real TeamDomain + real lifecycle service + real overlay store +
// the real GovernanceMutationService with the PR4 permission lane wired.
// ---------------------------------------------------------------------------

const NOW = '2026-10-05T10:00:00.000Z'
/** The human surface (ADR §7): the operator authority, recorded as actor
 *  `human` in provenance — no envelope, no permanent priority. */
const HUMAN = { kind: 'operator' } as const
/** The Leader surface (ADR §6): expansion only inside its envelope. */
const LEADER = { kind: 'leader' } as const

class NoopOverrides implements OverrideStorePort {
  async list(): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(): Promise<void> {}
}
class NoopTransitions {
  listTransitions(): readonly PolicyStateTransitionRecord[] {
    return []
  }
  appendTransition(): void {}
}
class NoopCommit {
  async commit(): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope() {
    throw new Error('the static policy reader must not be consulted by the permission lane')
  },
  readTemplatePolicy() {
    throw new Error('the static policy reader must not be consulted by the permission lane')
  },
  readExternalFacts() {
    throw new Error('the static policy reader must not be consulted by the permission lane')
  },
}

/** One wired PR4 world. */
interface LaneWorld {
  readonly lifecycle: P7T3World
  readonly governance: GovernanceMutationService
  readonly lane: PermissionLifecycleMutationLane
  readonly decisions: PermissionDecisionLane
  readonly overlay: PermissionOverlayRepositoryPort
  readonly members: MemberLifecycleReaderPort
  readonly teamSessionId: string
  readonly instanceA: string
  readonly instanceB: string
  history(instanceId: string): Promise<readonly PermissionOverlaySnapshot[]>
  latest(instanceId: string): Promise<PermissionOverlaySnapshot | undefined>
  /** Seed one MORE MemberInstance (the no-inheritance leg). */
  addMember(label: string): Promise<string>
  close(): Promise<void>
}

/**
 * Open one PR4 world.
 * @param options.predicate - inject the subtree containment predicate into
 *   the production permission lane (the parent ruling: the production lane
 *   MUST supply it); omit it to pin the merged PR3 typed refusal instead.
 */
async function openLaneWorld(
  options: {
    /** `true`/omitted = the working predicate; `false` = ABSENT; `'throws'` =
     *  the PRODUCTION wrapper over a predicate that FAULTS. */
    predicate?: boolean | 'throws'
    envelope?: PermissionMutationEnvelope
  } = {},
): Promise<LaneWorld> {
  const lifecycle = await createLifecycleWorld(
    `a3p4-${Math.random().toString(36).slice(2, 8)}`,
    {
      seedMembers: [
        { label: P7T3_SPEC_A.label, lifecycle: 'SETTLED' },
        { label: P7T3_SPEC_B.label, lifecycle: 'SETTLED' },
      ],
    },
  )
  const teamSessionId = String(lifecycle.target(P7T3_SPEC_A.label).rootSessionId)
  // The durable overlay store of the SAME TeamDomain medium (the tenth
  // team_domain table), opened over the world's own scratch dir.
  const overlaySeam = new FileStorageSeam(lifecycle.scratchDir)
  const store = await openPermissionOverlayStore(overlaySeam)
  const overlay = createPermissionOverlayRepositoryPort({ repository: store.repository })

  const members: MemberLifecycleReaderPort = {
    readLifecycle: (scopedTeam, instanceId) =>
      lifecycle.domain.repositories.memberInstances.get(scopedTeam, instanceId)?.lifecycle,
  }

  const deps: GovernanceMutationServiceDeps = {
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
    permissionLane: {
      overlay,
      // The DECLARED-NONE lower facts of the fixture template (a KNOWN deny
      // fallback — never conflated with UNKNOWN, whose typed refusal PR3
      // pins); the decision-plane legs supply their own real static layers.
      staticLayers: () => ({ layers: [] }),
      ...(options.envelope === undefined
        ? {}
        : { permissionEnvelope: () => options.envelope as PermissionMutationEnvelope }),
      // A4-PR7 §7.5 prerequisite 3 — THE AUTHORITY WORLD THIS SUITE NEVER HAD. Every
      // leg here opens by GRANTING authority (a write/read/exec allow) and then
      // exercises a lifecycle law over it (revoke, archive, restore, inheritance);
      // before that commit the grant sailed through a ceiling gate that had no reader
      // to consult, so the lifecycle law was being tested on authority the fixture
      // never established. The declared world covers this suite's own cells and stops
      // there: no `subtree` cell for the shell class (the leg at :658 exists to pin
      // that the kernel refuses one), and no `subtree` cells at all in a world whose
      // predicate is absent or faulting, where a subtree-vs-exact question is
      // undecidable and would un-decide every exact cell of the class.
      authorityCeiling: declaredCeilingReader({
        hardCeiling: ceilingOverCells([
          { operationClass: 'write', matcher: { kind: 'exact', resource: KEY_A } },
          { operationClass: 'write', matcher: { kind: 'exact', resource: KEY_B } },
          { operationClass: 'write', matcher: { kind: 'exact', resource: KEY_OUTSIDE } },
          { operationClass: 'read', matcher: { kind: 'exact', resource: KEY_A } },
          { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_A } },
          { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_B } },
          ...(options.predicate === undefined || options.predicate === true
            ? [
                { operationClass: 'write', matcher: { kind: 'subtree' as const, resource: ROOT_DIR } },
                { operationClass: 'read', matcher: { kind: 'subtree' as const, resource: ROOT_DIR } },
              ]
            : []),
        ]),
        ...(options.envelope === undefined
          ? {}
          : { carrier: () => options.envelope as PermissionMutationEnvelope }),
      }),
      ...(options.predicate === 'throws'
        ? createPermissionGovernanceLane({
            overlay,
            staticLayers: () => ({ layers: [] }),
            // The provider is OFFLINE: the production wrapper must surface
            // this as the kernel's typed UNKNOWN coverage, never as a
            // negative verdict.
            fsContainsKeys: () => {
              throw new Error('the fs provider is offline (injected fault)')
            },
          })
        : options.predicate === false
          ? {}
          : { subtreeContains: (root: string, child: string) => keyContains(root, child) }),
    },
  }
  const governance = createGovernanceMutationService(deps)

  const lane = createPermissionLifecycleMutationLane({
    governance,
    members,
    overlay,
    lifecycle: {
      restore: (target) =>
        lifecycle.service.restoreMember({
          rootSessionId: target.rootSessionId,
          instanceId: target.instanceId,
        }),
    },
  })

  const decisions = createPermissionDecisionLane({
    overlay,
    members,
    decodeResource: parsePermissionResourceText,
    effectiveAnswer: (query) => permissionEffectiveAnswer(query),
  })

  const instanceA = String(lifecycle.target(P7T3_SPEC_A.label).instanceId)
  const instanceB = String(lifecycle.target(P7T3_SPEC_B.label).instanceId)

  return {
    lifecycle,
    governance,
    lane,
    decisions,
    overlay,
    members,
    teamSessionId,
    instanceA,
    instanceB,
    history: (instanceId) => overlay.history({ teamSessionId, memberInstanceId: instanceId }),
    latest: (instanceId) => overlay.latest({ teamSessionId, memberInstanceId: instanceId }),
    async addMember(label: string): Promise<string> {
      // A brand-new MemberInstance of the SAME team (the no-inheritance leg):
      // a fresh identity, no overlay rows, lifecycle SETTLED.
      const instanceId = parseInstanceId(`inst-${label}`)
      await lifecycle.domain.repositories.memberInstances.put({
        rootSessionId: P7T3_FIXTURE.rootSessionId,
        instanceId,
        templateId: P7T3_FIXTURE.templateId,
        label,
        childSessionId: parseChildSessionId(`session-child-${label}`),
        lifecycle: 'SETTLED',
        createdAt: P7T3_FIXTURE.createdAt,
        activityVersion: 1,
      })
      return String(instanceId)
    },
    async close(): Promise<void> {
      await store.close()
      await lifecycle.domain.close()
      destroyDir(lifecycle.scratchDir)
    },
  }
}

/** One grant/revoke argument pair against the fixture instance A. */
function mutationArgs(
  world: LaneWorld,
  rules: GovernancePermissionMutationArgs['rules'],
  extra: Partial<GovernancePermissionMutationArgs> = {},
): GovernancePermissionMutationArgs {
  return {
    authority: HUMAN,
    teamSessionId: world.teamSessionId,
    memberInstanceId: world.instanceA,
    kind: 'grant_instance',
    mutationId: `mut-${Math.random().toString(36).slice(2, 10)}`,
    reason: 'pr4 lifecycle lane leg',
    rules,
    ...extra,
  }
}

const STATIC_NONE = { template: templateLayer({}, 'ask') }

// ---------------------------------------------------------------------------

describe('PR4 leg A/B — an exact grant produces a NEW snapshot and the effective decision honors it', () => {
  it('grant_instance appends generation 1 through the ONE authority and `latest` reads it back durably', async () => {
    const world = await openLaneWorld()
    try {
      const result = await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      expect(result.changed).toBe(true)
      if (result.changed !== true) throw new Error('unreachable')
      expect(result.snapshot.metadata.generation).toBe(1)
      expect(result.snapshot.metadata.previousSnapshotId).toBeNull()
      expect(result.snapshot.identity).toEqual({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
      })
      expect(result.snapshot.state.rules).toEqual([
        { operation: 'write', resource: `exact:${KEY_A}`, effect: 'allow' },
      ])
      // Human provenance is recorded (ADR §7: audit only, no precedence).
      expect(result.snapshot.provenance.actor).toBe('human')
      const latest = await world.latest(world.instanceA)
      expect(latest?.snapshotId).toBe(result.snapshot.snapshotId)
      // The authority NEVER appends through anything but the PR1 port: the
      // lane exposes no append/delete member at all.
      expect(Object.keys(world.lane).sort()).toEqual(['grantInstance', 'restore', 'revoke'])
    } finally {
      await world.close()
    }
  })

  it('the effective answer is `allow` from the overlay layer, and a different key is untouched', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      const granted = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts: STATIC_NONE,
      })
      expect(granted.kind).toBe('effective')
      if (granted.kind !== 'effective') throw new Error('unreachable')
      expect(granted.plane).toBe('file')
      expect(granted.effect).toBe('allow')
      expect(granted.winningLayer).toBe('overlay')
      expect(granted.overlayGeneration).toBe(1)
      expect(granted.lifecycleState).toBe('SETTLED')
      // The assembler's full Stage-2 decision names the snapshot authority.
      expect(granted.effective?.provenance?.overlayAuthority?.generation).toBe(1)
      expect(granted.effective?.overriddenLower).toEqual([])

      // The SAME authority says nothing about another file.
      const other = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_OUTSIDE),
        staticFacts: STATIC_NONE,
      })
      expect(other.kind).toBe('effective')
      if (other.kind !== 'effective') throw new Error('unreachable')
      expect(other.effect).toBe('ask')
      expect(other.source).toBe('default')
      expect(other.winningLayer).toBeNull()
    } finally {
      await world.close()
    }
  })

  it('the overlay layer overrides a static DENY of the same pair (layer precedence, never flattening)', async () => {
    const world = await openLaneWorld()
    try {
      const staticFacts = {
        template: templateLayer({ deny: [exactRule('write', KEY_A)] }, 'deny'),
      }
      const before = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts,
      })
      expect(before.kind === 'effective' && before.effect).toBe('deny')
      expect(before.kind === 'effective' && before.winningLayer).toBe('template')

      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      const after = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts,
      })
      expect(after.kind === 'effective' && after.effect).toBe('allow')
      if (after.kind !== 'effective') throw new Error('unreachable')
      // The lower deny is not erased — it is reported as overridden.
      expect(after.effective?.overriddenLower.map((entry) => entry.layer)).toEqual(['template'])
    } finally {
      await world.close()
    }
  })
})

describe('PR4 leg C — the subtree grant rides the injected containment predicate', () => {
  it('a subtree grant answers for a DESCENDANT key through the per-decision verdict', async () => {
    const world = await openLaneWorld()
    try {
      const result = await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'read', matcher: subtree(ROOT_DIR), effect: 'allow' }]),
      )
      expect(result.changed).toBe(true)
      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('read', KEY_B),
        staticFacts: STATIC_NONE,
        containment: (rootKey, target) => keyContains(rootKey, target.key),
      })
      expect(decision.kind === 'effective' && decision.effect).toBe('allow')
      expect(decision.kind === 'effective' && decision.winningLayer).toBe('overlay')
      expect(decision.kind === 'effective' && decision.effective?.provenance?.rule.resource.kind).toBe('subtree')

      // Outside the subtree the verdict is a DECIDED non-match (false), so
      // the rule does not apply and the static default answers.
      const outside = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('read', KEY_OUTSIDE),
        staticFacts: STATIC_NONE,
        containment: (rootKey, target) => keyContains(rootKey, target.key),
      })
      expect(outside.kind === 'effective' && outside.effect).toBe('ask')
    } finally {
      await world.close()
    }
  })

  it('a subtree ENVELOPE with no injected containment refuses the Leader mutation TYPED, zero write (the merged PR3 gate this lane inherits)', async () => {
    // The predicate is not optional in production precisely because of this
    // leg: a subtree question the lane cannot judge is UNKNOWN coverage, and
    // unknown coverage is never labeled expansion or tightening (the round-2
    // ruling, pinned for the kernel in a3p3 — pinned HERE for the PR4 entry).
    const envelope: PermissionMutationEnvelope = {
      rules: [{ operationClass: 'write', matcher: subtree(ROOT_DIR), maximumEffect: 'allow' }],
    }
    const world = await openLaneWorld({ predicate: false, envelope })
    try {
      const error = await world.lane
        .grantInstance(
          mutationArgs(
            world,
            [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }],
            { authority: LEADER, mutationId: 'mut-no-containment-port' },
          ),
        )
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect((error as { code?: string }).code).toBe(
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
      expect(await world.history(world.instanceA)).toEqual([])
    } finally {
      await world.close()
    }
  })

  it('the SAME Leader mutation commits once the lane supplies the containment predicate (production MUST supply it)', async () => {
    const envelope: PermissionMutationEnvelope = {
      rules: [{ operationClass: 'write', matcher: subtree(ROOT_DIR), maximumEffect: 'allow' }],
    }
    const world = await openLaneWorld({ envelope })
    try {
      const result = await world.lane.grantInstance(
        mutationArgs(
          world,
          [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }],
          { authority: LEADER, mutationId: 'mut-with-containment-port' },
        ),
      )
      expect(result.changed).toBe(true)
      if (result.changed !== true) throw new Error('the Leader grant must commit inside its envelope')
      expect(result.snapshot.provenance.actor).toBe('leader')
      // And the decision plane honors the Leader's grant.
      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts: STATIC_NONE,
      })
      expect(decision.kind === 'effective' && decision.effect).toBe('allow')
    } finally {
      await world.close()
    }
  })

  it('a FAULTING containment predicate is UNKNOWN coverage, not a negative verdict: typed refusal, zero write', async () => {
    // The containment authority can be present and still FAIL (the fs service
    // is gone mid-round). Reading that as "not contained" would silently
    // relabel a covered region as uncovered and let a Leader subtree grant
    // through on a fault, so the production wrapper in
    // `src/plugin/permission-plane.ts` maps the fault to the kernel's OWN
    // typed `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE`. This leg drives THAT
    // wrapper (not a hand-rolled stand-in), pinning the mapping the host
    // entry actually installs.
    const envelope: PermissionMutationEnvelope = {
      rules: [{ operationClass: 'write', matcher: subtree(ROOT_DIR), maximumEffect: 'allow' }],
    }
    const world = await openLaneWorld({ predicate: 'throws', envelope })
    try {
      const error = await world.lane
        .grantInstance(
          mutationArgs(
            world,
            [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }],
            { authority: LEADER, mutationId: 'mut-faulting-containment' },
          ),
        )
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect((error as { code?: string }).code).toBe(
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
      // Zero write: a round whose coverage cannot be judged appends nothing.
      expect(await world.history(world.instanceA)).toEqual([])
    } finally {
      await world.close()
    }
  })

  it('an UNJUDGED subtree rule keeps the frozen lane asymmetry (a deny is never dropped, an allow never invented)', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [
          { operationClass: 'read', matcher: subtree(ROOT_DIR), effect: 'allow' },
          { operationClass: 'write', matcher: subtree(ROOT_DIR), effect: 'deny' },
        ]),
      )
      const request = (tool: PermissionTool) => ({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation(tool, KEY_B),
        staticFacts: STATIC_NONE,
        // NO containment for this decision: every subtree rule is unknown.
      })
      const allowSide = await world.decisions.decide(request('read'))
      expect(allowSide.kind === 'effective' && allowSide.effect).toBe('ask')
      const denySide = await world.decisions.decide(request('write'))
      expect(denySide.kind === 'effective' && denySide.effect).toBe('deny')
    } finally {
      await world.close()
    }
  })
})

describe('PR4 leg D — exec is EXACT canonical fingerprint only', () => {
  it('an exec grant answers its OWN fingerprint and no other (design §6 isolation)', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'bash', matcher: fingerprint(FP_A), effect: 'allow' }]),
      )
      const granted = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: execOperation(FP_A),
        staticFacts: STATIC_NONE,
      })
      expect(granted.kind === 'effective' && granted.plane).toBe('exec')
      expect(granted.kind === 'effective' && granted.effect).toBe('allow')
      expect(granted.kind === 'effective' && granted.winningLayer).toBe('overlay')

      const other = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: execOperation(FP_B),
        staticFacts: STATIC_NONE,
      })
      expect(other.kind === 'effective' && other.effect).toBe('ask')
      expect(other.kind === 'effective' && other.source).toBe('default')
    } finally {
      await world.close()
    }
  })

  it('the kernel refuses a subtree matcher on a shell class (design §5: no subtree, no any)', async () => {
    const world = await openLaneWorld()
    try {
      const error = await world.lane
        .grantInstance(mutationArgs(world, [{ operationClass: 'bash', matcher: subtree(ROOT_DIR), effect: 'allow' }]))
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect((error as { code?: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION)
      expect(await world.history(world.instanceA)).toEqual([])
    } finally {
      await world.close()
    }
  })
})

describe('PR4 leg E — revoke creates a snapshot; history keeps the old authority; the effect drops', () => {
  it('revoke appends generation 2, leaves generation 1 byte-identical, and the decision recomputes', async () => {
    const world = await openLaneWorld()
    try {
      const staticFacts = {
        template: templateLayer({ deny: [exactRule('write', KEY_A)] }, 'deny'),
      }
      const granted = await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      if (granted.changed !== true) throw new Error('the grant must change the overlay')
      const generationOne = granted.snapshot
      const before = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts,
      })
      expect(before.kind === 'effective' && before.effect).toBe('allow')

      const revoked = await world.lane.revoke(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      expect(revoked.changed).toBe(true)
      if (revoked.changed !== true) throw new Error('unreachable')
      expect(revoked.snapshot.metadata.generation).toBe(2)
      expect(revoked.snapshot.metadata.previousSnapshotId).toBe(generationOne.snapshotId)
      expect(revoked.snapshot.state.rules).toEqual([])

      // History is AUDIT ONLY and append-only: both rows, ascending, the old
      // one untouched (no delete, no rewrite of a durable truth).
      const history = await world.history(world.instanceA)
      expect(history.map((snapshot) => snapshot.metadata.generation)).toEqual([1, 2])
      expect(JSON.parse(JSON.stringify(history[0]))).toEqual(JSON.parse(JSON.stringify(generationOne)))
      expect(Object.isFrozen(history[0])).toBe(true)

      // The effective effect DROPS back to the static deny (the revoke
      // revealed what the grant had been overriding).
      const after = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts,
      })
      expect(after.kind === 'effective' && after.effect).toBe('deny')
      expect(after.kind === 'effective' && after.winningLayer).toBe('template')
      expect(after.kind === 'effective' && after.overlayGeneration).toBe(2)
    } finally {
      await world.close()
    }
  })

  it('renewing the same desired state is a NO-OP (no snapshot, no generation bump)', async () => {
    const world = await openLaneWorld()
    try {
      const rules = [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }] as const
      await world.lane.grantInstance(mutationArgs(world, rules))
      const again = await world.lane.grantInstance(mutationArgs(world, rules, { mutationId: 'mut-repeat' }))
      expect(again.changed).toBe(false)
      expect(await world.history(world.instanceA)).toHaveLength(1)
    } finally {
      await world.close()
    }
  })
})

describe('PR4 legs F/G — ARCHIVED and DISPOSED never execute', () => {
  it('ARCHIVED: execution is refused, the overlay stays the retained authority', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      const target = world.lifecycle.target(P7T3_SPEC_A.label)
      const archived = await world.lifecycle.service.archiveMember(target)
      expect(archived.member.lifecycle).toBe('ARCHIVED')

      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts: STATIC_NONE,
      })
      expect(decision.kind).toBe('refused')
      expect(decision.kind === 'refused' && decision.code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_ARCHIVED,
      )
      expect(decision.kind === 'refused' && decision.lifecycleState).toBe('ARCHIVED')
      // RETAINED: the authority is still there, unmodified, and readable.
      const latest = await world.latest(world.instanceA)
      expect(latest?.metadata.generation).toBe(1)
      expect(latest?.state.rules).toHaveLength(1)
    } finally {
      await world.close()
    }
  })

  it('DISPOSED: execution is refused, and a mutation against a terminal instance is refused typed (zero write)', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      const target = world.lifecycle.target(P7T3_SPEC_A.label)
      const disposed = await world.lifecycle.service.disposeMember(target)
      expect(disposed.member.lifecycle).toBe('DISPOSED')

      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts: STATIC_NONE,
      })
      expect(decision.kind === 'refused' && decision.code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_TERMINAL,
      )

      const error = await world.lane
        .grantInstance(mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_B), effect: 'allow' }]))
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(PermissionLifecycleError)
      expect((error as PermissionLifecycleError).code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.TARGET_TERMINAL,
      )
      // ZERO WRITE, and the history proves the GMS was never reached.
      const history = await world.history(world.instanceA)
      expect(history.map((snapshot) => snapshot.metadata.generation)).toEqual([1])
    } finally {
      await world.close()
    }
  })

  it('an instance with no durable row is its OWN state (never RUNNING, never ARCHIVED)', async () => {
    const world = await openLaneWorld()
    try {
      const ghost = String(parseInstanceId('inst-ghost'))
      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: ghost,
        operation: fileOperation('write', KEY_A),
        staticFacts: STATIC_NONE,
      })
      expect(decision.kind === 'refused' && decision.code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_STATE_UNKNOWN,
      )
      expect(evaluatePermissionLifecycleGate(undefined).allowed).toBe(false)
      expect(evaluatePermissionLifecycleGate('RUNNING').allowed).toBe(true)
      expect(evaluatePermissionLifecycleGate('CREATED').allowed).toBe(true)
      expect(evaluatePermissionLifecycleGate('SETTLED').allowed).toBe(true)
    } finally {
      await world.close()
    }
  })
})

describe('PR4 legs H/I — restore: the SAME instance, the CURRENT latest overlay, zero permission write', () => {
  it('revoked during ARCHIVE stays revoked after restore (no replay, no resurrection)', async () => {
    const world = await openLaneWorld()
    try {
      const staticFacts = {
        template: templateLayer({ deny: [exactRule('write', KEY_A)] }, 'deny'),
      }
      // 1. grant the allow.
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      // 2. archive it.
      const target = world.lifecycle.target(P7T3_SPEC_A.label)
      await world.lifecycle.service.archiveMember(target)
      // 3. revoke WHILE archived (the overlay is retained, so this is
      //    meaningful — ADR §8).
      const revoked = await world.lane.revoke(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      expect(revoked.changed).toBe(true)
      if (revoked.changed !== true) throw new Error('unreachable')
      const generationAtRestore = revoked.snapshot

      // 4. restore the SAME instance through the lifecycle lane (the EXISTING
      //    single lifecycle path; ARCHIVED -> SETTLED, one durable commit).
      const restored = await world.lane.restore({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
      })
      expect(restored.member.lifecycle).toBe('SETTLED')
      expect(restored.member.instanceId).toBe(target.instanceId)
      expect(restored.steps).toEqual(['commit-restore'])
      // NO permission write happened: the current authority is UNCHANGED.
      expect(restored.wroteSnapshot).toBe(false)
      expect(restored.mutation).toBeUndefined()
      expect(restored.overlay?.snapshotId).toBe(generationAtRestore.snapshotId)
      expect(await world.history(world.instanceA)).toHaveLength(2)
      // The durable row really moved (the lifecycle commit is the real one).
      expect(
        world.lifecycle.domain.repositories.memberInstances
          .get(world.teamSessionId, world.instanceA)
          ?.lifecycle,
      ).toBe('SETTLED')

      // 5. the same instance continues, with the CURRENT latest overlay: the
      //    revoked grant stays revoked and the static deny answers again.
      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts,
      })
      expect(decision.kind === 'effective' && decision.effect).toBe('deny')
      expect(decision.kind === 'effective' && decision.overlayGeneration).toBe(2)
      expect(decision.kind === 'effective' && decision.lifecycleState).toBe('SETTLED')
    } finally {
      await world.close()
    }
  })

  it('a GENUINE rule change at restore time is one ordinary mutation through the authority', async () => {
    const world = await openLaneWorld()
    try {
      const target = world.lifecycle.target(P7T3_SPEC_A.label)
      await world.lifecycle.service.archiveMember(target)
      const restored = await world.lane.restore({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        ruleChange: {
          authority: HUMAN,
          kind: 'grant_instance',
          mutationId: 'mut-at-restore',
          reason: 're-granted at restore (a genuine change, not a decorative write)',
          rules: [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }],
        },
      })
      expect(restored.member.lifecycle).toBe('SETTLED')
      expect(restored.wroteSnapshot).toBe(true)
      expect(restored.mutation?.changed).toBe(true)
      const history = await world.history(world.instanceA)
      expect(history.map((snapshot) => snapshot.metadata.generation)).toEqual([1])
      expect(history[0]?.provenance.reason).toContain('genuine change')
      // And the decision plane honors it for the restored instance.
      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
        staticFacts: STATIC_NONE,
      })
      expect(decision.kind === 'effective' && decision.effect).toBe('allow')
    } finally {
      await world.close()
    }
  })

  it('restore performs NO permission write even when a grant was already standing (the no-op rule)', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      await world.lifecycle.service.archiveMember(world.lifecycle.target(P7T3_SPEC_A.label))
      const restored = await world.lane.restore({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        ruleChange: {
          authority: HUMAN,
          kind: 'grant_instance',
          mutationId: 'mut-same-desired-state',
          reason: 'the same desired state again: the authority answers no-change, no snapshot',
          rules: [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }],
        },
      })
      expect(restored.mutation?.changed).toBe(false)
      expect(restored.wroteSnapshot).toBe(false)
      expect(await world.history(world.instanceA)).toHaveLength(1)
    } finally {
      await world.close()
    }
  })
})

describe('PR4 leg J — no inheritance', () => {
  it('a MemberInstance created AFTER the grants has zero permissions', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [
          { operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' },
          { operationClass: 'read', matcher: subtree(ROOT_DIR), effect: 'allow' },
        ]),
      )
      const fresh = await world.addMember('fresh')
      // The new instance has NO overlay at all — not an empty snapshot, no
      // row (nothing to inherit, nothing replayed from another identity).
      expect(await world.latest(fresh)).toBeUndefined()
      expect(await world.history(fresh)).toEqual([])

      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: fresh,
        operation: fileOperation('write', KEY_A),
        staticFacts: { template: templateLayer({}, 'deny') },
        containment: (rootKey, target) => keyContains(rootKey, target.key),
      })
      expect(decision.kind === 'effective' && decision.effect).toBe('deny')
      expect(decision.kind === 'effective' && decision.overlayGeneration).toBeNull()
      expect(decision.kind === 'effective' && decision.source).toBe('default')

      // Instance B of the SAME team, same template: also nothing.
      const sibling = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceB,
        operation: fileOperation('write', KEY_A),
        staticFacts: { template: templateLayer({}, 'deny') },
      })
      expect(sibling.kind === 'effective' && sibling.effect).toBe('deny')
      // ...and the addressed instance still has its own authority.
      expect((await world.latest(world.instanceA))?.metadata.generation).toBe(1)
    } finally {
      await world.close()
    }
  })
})

describe('PR4 leg K — the frozen lifecycle FSM owns the error channel', () => {
  it('restore of a NOT-ARCHIVED instance is the typed LIFECYCLE_ILLEGAL_STATE, before any write', async () => {
    const world = await openLaneWorld()
    try {
      // instance B is SETTLED (never archived).
      const error = await world.lane
        .restore({ teamSessionId: world.teamSessionId, memberInstanceId: world.instanceB })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect(isLifecycleRuntimeError(error)).toBe(true)
      expect((error as { code?: string }).code).toBe(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_ILLEGAL_STATE)
      expect(await world.history(world.instanceB)).toEqual([])
      expect(
        world.lifecycle.domain.repositories.memberInstances
          .get(world.teamSessionId, world.instanceB)
          ?.lifecycle,
      ).toBe('SETTLED')
    } finally {
      await world.close()
    }
  })

  it('dispose of a TERMINAL instance is the typed LIFECYCLE_ILLEGAL_STATE (the FSM, not this lane)', async () => {
    const world = await openLaneWorld()
    try {
      const target = world.lifecycle.target(P7T3_SPEC_B.label)
      await world.lifecycle.service.disposeMember(target)
      const error = await world.lifecycle.service
        .disposeMember(target)
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect(isLifecycleRuntimeError(error)).toBe(true)
      expect((error as { code?: string }).code).toBe(LIFECYCLE_RUNTIME_ERROR_CODES.LIFECYCLE_ILLEGAL_STATE)
    } finally {
      await world.close()
    }
  })

  it('restore without a wired lifecycle path refuses typed (never a substitute transition)', async () => {
    const world = await openLaneWorld()
    try {
      const unwired = createPermissionLifecycleMutationLane({
        governance: world.governance,
        members: world.members,
        overlay: world.overlay,
      })
      const error = await unwired
        .restore({ teamSessionId: world.teamSessionId, memberInstanceId: world.instanceA })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect((error as PermissionLifecycleError).code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.RESTORE_UNCONFIGURED,
      )
    } finally {
      await world.close()
    }
  })
})

describe('PR4 leg L — the read plane refuses instead of guessing', () => {
  it('no static facts from the decision site = UNKNOWN, typed, no decision', async () => {
    const world = await openLaneWorld()
    try {
      await world.lane.grantInstance(
        mutationArgs(world, [{ operationClass: 'write', matcher: exact(KEY_A), effect: 'allow' }]),
      )
      const decision = await world.decisions.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: fileOperation('write', KEY_A),
      })
      expect(decision.kind === 'refused' && decision.code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.STATIC_FACTS_UNKNOWN,
      )
    } finally {
      await world.close()
    }
  })

  it('an overlay carrier the grammar cannot read refuses typed (a rule is never silently dropped)', async () => {
    const world = await openLaneWorld()
    try {
      // Write a row the PR1 store accepts (a free-form resource string is a
      // legitimate PR1 carrier — the MUTATION grammar is what restricts it),
      // then read it back through the decision lane.
      const appended = await world.overlay.append({
        identity: { teamSessionId: world.teamSessionId, memberInstanceId: world.instanceA },
        state: { rules: [{ operation: 'write', resource: 'not-a-carrier', effect: 'allow' }] },
        metadata: { generation: 1, previousSnapshotId: null },
        provenance: { actor: 'human', mutationId: 'mut-legacy', timestamp: NOW, reason: 'foreign carrier' },
      })
      expect(appended.metadata.generation).toBe(1)
      const error = await world.decisions
        .decide({
          teamSessionId: world.teamSessionId,
          memberInstanceId: world.instanceA,
          operation: fileOperation('write', KEY_A),
          staticFacts: STATIC_NONE,
        })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(PermissionLifecycleError)
      expect((error as PermissionLifecycleError).code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.OVERLAY_VIEW_UNDECODABLE,
      )
    } finally {
      await world.close()
    }
  })

  it('the exec plane refuses typed when the kernel algebra is not injected', async () => {
    const world = await openLaneWorld()
    try {
      const blind = createPermissionDecisionLane({
        overlay: world.overlay,
        members: world.members,
        decodeResource: parsePermissionResourceText,
      })
      const decision = await blind.decide({
        teamSessionId: world.teamSessionId,
        memberInstanceId: world.instanceA,
        operation: execOperation(FP_A),
        staticFacts: STATIC_NONE,
      })
      expect(decision.kind === 'refused' && decision.code).toBe(
        PERMISSION_LIFECYCLE_ERROR_CODES.EXEC_PLANE_UNAVAILABLE,
      )
    } finally {
      await world.close()
    }
  })
})

describe('PR4 lane hygiene — the lane owns no second authority and no delete', () => {
  it('the carrier round-trip the lane relies on is the kernel grammar (rendered by PR3, decoded by PR3)', () => {
    const matcher: PermissionResourceMatcher = { kind: 'subtree', resource: ROOT_DIR }
    const text = renderPermissionResourceText(matcher)
    expect(text).toBe(`subtree:${ROOT_DIR}`)
    expect(parsePermissionResourceText(text)).toEqual(matcher)
    // A key that itself contains a colon stays OPAQUE (prefix at the FIRST
    // colon; the rest is never parsed).
    const odd = { kind: 'exact', resource: 'workspace:vol/a:b' } as const
    expect(parsePermissionResourceText(renderPermissionResourceText(odd))).toEqual(odd)
  })
})
