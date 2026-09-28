/**
 * p01-team-scoped-overlay.test.ts — PR #35 second follow-up P0-1: the
 * Team-scoped live-residency overlay (guide §3.1 — the two-team leader
 * collision).
 *
 * Instance ids are WITHIN-team identities: every team's leader is
 * `inst-leader` (and member instance ids may recur across teams). The
 * OLD host-wide merged snapshot (the pre-fix
 * `createLiveResidencyOverlay.snapshot()` over the bound root + every
 * owned root) was UNSOUND: Team A's resident `inst-leader` and Team B's
 * cold `inst-leader` collided in one host-wide map, polluting the other
 * team's projection `members[].liveActivity`, its `readState.liveToken`,
 * and the projection `liveToken`.
 *
 * This unit drives the REAL production overlay
 * (`createLiveResidencyOverlay`) + the REAL projection service
 * (`createProjectionService`) + the REAL token functions over a two-team
 * world where the leader id collides:
 *
 *  - per-team snapshots: `snapshot(TEAM_A).get('inst-leader')` reports
 *    A's residency (resident) and `snapshot(TEAM_B).get('inst-leader')`
 *    reports B's (cold) — NOT merely token(A) !== token(B);
 *  - per-team projections: A's frame shows its leader resident, B's
 *    frame shows its leader cold (the cross-team pollution is gone);
 *  - per-team token-frame consistency: the read-state-path token (durable
 *    rows + the team's own snapshot) equals the same-snapshot-path token
 *    (computed from the team's own projection members) — and the two
 *    teams' tokens differ because their semantic live states differ.
 *
 * Test pattern of this repo: every scenario runs at MODULE level
 * (top-level await); the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/p01-team-scoped-overlay
 */

import { describe, expect, it } from 'vitest'

import {
  createLiveResidencyOverlay,
} from '../src/plugin/s6-live-overlay.js'
import { createProjectionService } from '../projection/index.js'
import type {
  TeamDomainProjectionSource,
  TeamDomainReadPort,
  LiveResidencyOverlayPort,
} from '../projection/index.js'
import {
  computeLiveTokenFromProjectedMembers,
  computeTeamLiveToken,
  type ProjectedLiveMember,
} from '../src/plugin/live-token.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import type { InstanceId } from '../../contracts/src/index.js'

// --- the two-team world (the leader id collides: both teams are inst-leader) ----

const TEAM_A = 'session-p01-team-a'
const TEAM_B = 'session-p01-team-b'
const FIXED_NOW = '2026-09-28T00:00:00.000Z'

/** The durable member-instance rows of ONE team (repository shape: the
 *  leader row carries NO childSessionId key (a v2-shaped row — the
 *  overlay's fallback resolves it to the requested teamSessionId); the
 *  worker row carries its durable child session). */
function memberRows(teamSessionId: string, workerChildSessionId: string) {
  return [
    {
      instanceId: LEADER_INSTANCE_ID as string,
      templateId: 'leader',
      label: 'p01-leader',
      lifecycle: 'CREATED',
      createdAt: '2026-09-28T00:00:00.000Z',
    },
    {
      instanceId: 'inst-p01worker',
      templateId: 'worker',
      label: 'p01-worker',
      childSessionId: workerChildSessionId,
      lifecycle: 'CREATED',
      createdAt: '2026-09-28T00:00:00.000Z',
    },
  ]
}

const ROWS_A = memberRows(TEAM_A, 'session-child-p01-a')
const ROWS_B = memberRows(TEAM_B, 'session-child-p01-b')

/** The fake TeamDomain repositories: the durable member rows per team. */
const fakeRepos = {
  memberInstances: {
    list(teamSessionId: string) {
      if (teamSessionId === TEAM_A) return ROWS_A
      if (teamSessionId === TEAM_B) return ROWS_B
      return []
    },
  },
}

/** The live glue: ONLY Team A's leader session (A's root — the leader's
 *  child session IS the root) is live; everything else is cold. */
const fakeLive = {
  hasLive(sessionId: string) {
    return sessionId === TEAM_A
  },
  isResuming() {
    return false
  },
}

const FIXED_LEDGER = {
  latestSequence: 0,
  totalEntries: 0,
  byCategory: {
    team: 0,
    member: 0,
    lifecycle: 0,
    message: 0,
    control: 0,
    policy: 0,
    compatibility: 0,
    progress: 0,
  },
  pendingControlCount: 0,
}

const FIXED_EFFECTIVE_CONFIG = {
  model: { value: null, source: 'blueprint', state: 'unavailable' },
  workspace: { value: null, source: 'instance-creation', state: 'locked' },
  permissions: {},
  autonomy: { value: null, source: 'blueprint', state: 'inherited' },
}

/** One valid minimal projection SOURCE for a team (the read port's
 *  output): the durable member rows (leader + worker) + the closed
 *  identity/admission/ledger facts. */
function projectionSource(teamSessionId: string, workerChildSessionId: string): TeamDomainProjectionSource {
  return {
    teamSessionId: teamSessionId as never,
    blueprint: {
      blueprintId: `BP-P01-${teamSessionId === TEAM_A ? 'A' : 'B'}`,
      revision: '1',
      contentHash: 'p01-content-hash-0000',
    },
    defaultWorkspace: `ws-p01-${teamSessionId === TEAM_A ? 'a' : 'b'}`,
    createdAt: '2026-09-28T00:00:00.000Z',
    generation: 3,
    root: {
      policyState: 'default',
      admission: 'OPEN',
      compatibility: {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'fp-req',
        environmentFingerprint: 'fp-env',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      },
      creationBudgetConsumed: 0,
    },
    templates: [
      { kind: 'leader', templateId: 'leader', displayName: 'Leader', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'fresh_per_delegation' },
    ],
    members: [
      {
        instanceId: LEADER_INSTANCE_ID,
        templateId: 'leader',
        label: 'p01-leader',
        lifecycle: 'CREATED',
        createdAt: '2026-09-28T00:00:00.000Z',
        contextPolicy: 'persistent',
        effectiveConfig: FIXED_EFFECTIVE_CONFIG,
      },
      {
        instanceId: 'inst-p01worker' as never,
        templateId: 'worker',
        label: 'p01-worker',
        childSessionId: workerChildSessionId as never,
        lifecycle: 'CREATED',
        createdAt: '2026-09-28T00:00:00.000Z',
        contextPolicy: 'fresh_per_delegation',
        effectiveConfig: FIXED_EFFECTIVE_CONFIG,
      },
    ],
    ledger: FIXED_LEDGER,
  } as unknown as TeamDomainProjectionSource
}

const fakeReadPort: TeamDomainReadPort = {
  readProjectionSource(teamSessionId) {
    const id = String(teamSessionId)
    if (id === TEAM_A) return projectionSource(TEAM_A, 'session-child-p01-a')
    if (id === TEAM_B) return projectionSource(TEAM_B, 'session-child-p01-b')
    throw new Error(`P01 guard: unexpected readProjectionSource(${id})`)
  },
}

// --- the real production pipeline over the two-team world -----------------------

const P01 = await (async () => {
  const overlay: LiveResidencyOverlayPort = createLiveResidencyOverlay({
    repositories: fakeRepos as never,
    live: fakeLive as never,
    now: () => FIXED_NOW,
  })
  const service = createProjectionService(fakeReadPort, overlay, {
    clock: () => FIXED_NOW,
    schemaVersion: 1,
  })

  // Per-team snapshots (the Team-scoped reads — the collision case).
  const snapA = overlay.snapshot(TEAM_A as never)
  const snapB = overlay.snapshot(TEAM_B as never)

  // Per-team projections (the real fold over the real service).
  const projA = service.project(TEAM_A as never)
  const projB = service.project(TEAM_B as never)

  // The two independent token derivations per team:
  //  - read-state path: durable member rows (instance ids) + the team's
  //    OWN snapshot (the production liveToken closure's shape);
  //  - same-snapshot path: the team's OWN projection members (the v6
  //    projection's shape).
  const durableRowsA = [{ instanceId: LEADER_INSTANCE_ID as string }, { instanceId: 'inst-p01worker' }]
  const durableRowsB = [{ instanceId: LEADER_INSTANCE_ID as string }, { instanceId: 'inst-p01worker' }]
  const tokenAProbe = computeTeamLiveToken(durableRowsA, {
    get: (id) => snapA.get(id as never),
  })
  const tokenBProbe = computeTeamLiveToken(durableRowsB, {
    get: (id) => snapB.get(id as never),
  })
  const projMembersA = projA.members.map((member) => ({
    instanceId: member.instanceId,
    liveActivity: member.liveActivity,
  })) as unknown as readonly ProjectedLiveMember[]
  const projMembersB = projB.members.map((member) => ({
    instanceId: member.instanceId,
    liveActivity: member.liveActivity,
  })) as unknown as readonly ProjectedLiveMember[]
  const tokenAProjection = computeLiveTokenFromProjectedMembers(projMembersA)
  const tokenBProjection = computeLiveTokenFromProjectedMembers(projMembersB)

  return { snapA, snapB, projA, projB, tokenAProbe, tokenBProbe, tokenAProjection, tokenBProjection }
})()

function leaderOf(projection: { members: ReadonlyArray<{ instanceId: string; liveActivity: { residency: string; lastActivityAt?: string } | null }> }) {
  const leader = projection.members.find((member) => member.instanceId === LEADER_INSTANCE_ID)
  expect(leader).toBeDefined()
  if (leader === undefined) throw new Error('P0-1 guard: no leader row')
  return leader
}

// ---------------------------------------------------------------------------
// §3.1 the two-team leader collision
// ---------------------------------------------------------------------------

describe('P0-1 the Team-scoped overlay: the two-team leader collision (guide §3.1)', () => {
  it('per-team snapshots: Team A inst-leader is RESIDENT (its root session is live) and Team B inst-leader is COLD — the same instance id is a different live fact per team', () => {
    const leaderA = P01.snapA.get(LEADER_INSTANCE_ID)
    expect(leaderA).toEqual({ residency: 'resident', lastActivityAt: FIXED_NOW })
    const leaderB = P01.snapB.get(LEADER_INSTANCE_ID)
    expect(leaderB).toEqual({ residency: 'cold' })
  })

  it('per-team snapshots: the workers (a second colliding pair) are both cold and present in both team maps', () => {
    const WORKER_ID = 'inst-p01worker' as InstanceId
    expect(P01.snapA.get(WORKER_ID)).toEqual({ residency: 'cold' })
    expect(P01.snapB.get(WORKER_ID)).toEqual({ residency: 'cold' })
    expect(P01.snapA.size).toBe(2)
    expect(P01.snapB.size).toBe(2)
  })

  it('per-team projections: A frame shows its leader resident and B frame shows its leader cold (the cross-team pollution of the host-wide merge is gone)', () => {
    expect(leaderOf(P01.projA).liveActivity).toEqual({ residency: 'resident', lastActivityAt: FIXED_NOW })
    expect(leaderOf(P01.projB).liveActivity).toEqual({ residency: 'cold' })
    // The worker cells are unaffected (both cold — the leader is the
    // discriminating fact).
    const workerA = P01.projA.members.find((member) => member.instanceId === 'inst-p01worker')
    const workerB = P01.projB.members.find((member) => member.instanceId === 'inst-p01worker')
    expect(workerA?.liveActivity).toEqual({ residency: 'cold' })
    expect(workerB?.liveActivity).toEqual({ residency: 'cold' })
  })

  it('token-frame consistency per team: the read-state-path token (durable rows + the team snapshot) equals the same-snapshot-path token (the team projection members) — one live state, two derivations', () => {
    expect(P01.tokenAProbe).toBe(P01.tokenAProjection)
    expect(P01.tokenBProbe).toBe(P01.tokenBProjection)
    expect(P01.tokenAProbe.startsWith('lt-v1-')).toBe(true)
  })

  it('the two teams answer DIFFERENT tokens because their semantic live states differ (the leader residency is the discriminating pair)', () => {
    expect(P01.tokenAProbe).not.toBe(P01.tokenBProbe)
    expect(P01.tokenAProjection).not.toBe(P01.tokenBProjection)
  })

  it('the projections stay DURABLE-stable: the same generation for both teams and the live overlay never touches the generation', () => {
    expect(P01.projA.generation).toBe(3)
    expect(P01.projB.generation).toBe(3)
  })
})
