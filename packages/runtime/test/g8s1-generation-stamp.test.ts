/**
 * G8-S1 (gate supplement 1 for G8-REVIEW) — the generation-stamp E2E:
 * real runtime path → projection → pull verdict (attempt 2, adjudication R60).
 *
 * Covers the brief §7 S1-A items that only the runtime level can prove:
 *
 *  - POSITIVE: a fresh P6-T2 world seeds `team_sessions.generation` at 1;
 *    three sequential `delegate` actions through the REAL action router
 *    (the real runtime mutation path) each append exactly one durable
 *    ledger fact and each advance the generation by exactly one — the
 *    stamp walks strictly 1 → 2 → 3 → 4 in lockstep with the ledger count;
 *  - the projection service (over a pre-adapter source stand-in built from
 *    the REAL TeamDomain rows) carries the stamp verbatim as the
 *    whole-projection `generation`; a NEW client re-pull (applied identity
 *    `null`) against the frozen remote frame verdicts `apply` (never
 *    `duplicate`); the applied body equals the latest durable state
 *    (members / ledger / generation all mirror the real durable rows, and
 *    the whole DTO equals a freshly recomputed fold);
 *  - NEGATIVE: a same-token `delegate` replay is the durable idempotent
 *    replay (`replayed: true`) and advances the stamp NOTHING (no double
 *    advance, zero new seam writes); the stamp observed across the whole
 *    sequence never decreases (monotonic);
 *  - HOOK B: a compatibility probe write (`replaceState` — the only durable
 *    writer of the compat state, which never passes through a ledger fact)
 *    advances the generation by exactly one per durable write.
 *
 * Honest stand-in note: the production TeamDomain →
 * `TeamDomainProjectionSource` read adapter is a later task; this test
 * builds the bounded source directly from the real durable rows (the
 * generation is carried VERBATIM from the seeded row, the members and the
 * ledger summary are computed from the real repositories) so the
 * stamp → projection → verdict chain is proven end to end over REAL state.
 *
 * House pattern of the runtime package: async world construction at the
 * top level; every `it` asserts the captured constants synchronously.
 */

import { describe, expect, it } from 'vitest'
import {
  LEADER_INSTANCE_ID,
  isContextPolicy,
  parseTeamSessionId,
} from '../../contracts/src/index.js'
import type {
  ContextPolicy,
  EffectiveConfigDto,
  TeamProjectionDto,
  TeamSessionId,
} from '../../contracts/src/index.js'
import {
  createProjectionService,
  projectTeam,
} from '../projection/index.js'
import type {
  DurableLedgerSummary,
  DurableMemberRow,
  DurableTemplateRow,
  TeamDomainProjectionSource,
  TeamDomainReadPort,
} from '../projection/index.js'
import { PROBE_TRIGGERS } from '../compatibility/index.js'
import { PROVISION_INTENT_TYPE } from '../../storage/provisioning/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  createP6T2Runtime,
  createP6T2World,
  makeActionRequest,
  P6T2_ROOT,
} from './p6t2-helpers.js'
import {
  createP7T1World,
  destroyP7T1World,
} from './p7t1-helpers.js'
import {
  REMOTE_CONTRACT_VERSION,
  assessProjectionSync,
  buildRemoteSuccess,
} from '../../remote/src/index.js'
import type { AppliedProjectionIdentity } from '../../remote/src/push/index.js'
import type { RemoteResponse } from '../../remote/src/contracts/response.js'

/** The deterministic produced-at stamp (the service clock). */
const G8S1_GENERATED_AT = '2026-08-31T12:30:00.000Z'

/** The three sequential delegates of the positive path (distinct tokens). */
const DELEGATES = [
  { token: 'tok-g8s1-d1', templateId: 'scout', label: 'g8s1-scout-1' },
  { token: 'tok-g8s1-d2', templateId: 'scout', label: 'g8s1-scout-2' },
  { token: 'tok-g8s1-d3', templateId: 'worker', label: 'g8s1-worker-1' },
] as const

function generationOf(world: P6T1World): number {
  const row = world.domain.repositories.teamSessions.get(P6T2_ROOT)
  if (row === undefined) {
    throw new Error('g8s1: the seeded team_sessions row is missing')
  }
  return row.generation
}

/** Resolve a template's frozen contextPolicy (default `persistent`). */
function contextPolicyOf(
  template: { readonly templateId: unknown; readonly contextPolicy?: string },
): ContextPolicy {
  const policy = template.contextPolicy ?? 'persistent'
  if (!isContextPolicy(policy)) {
    throw new Error(
      `g8s1: template '${String(template.templateId)}' carries unknown contextPolicy '${policy}'`,
    )
  }
  return policy
}

/**
 * The deterministic four-lane effective-config view for the stand-in source
 * (structurally the P8-T2 raw builder shape; the real per-instance resolver
 * is a later task and out of scope for the stamp E2E).
 */
function g8s1EffectiveConfig(defaultWorkspace: string): EffectiveConfigDto {
  return {
    model: { value: 'qwen3.8-27b', source: 'blueprint', state: 'inherited' },
    workspace: { value: defaultWorkspace, source: 'instance-creation', state: 'locked' },
    permissions: {
      Bash: { value: 'allowed', source: 'policy-state', state: 'inherited' },
      Web: { value: null, source: 'external-hard-policy', state: 'denied' },
    },
    autonomy: { value: 'web-search', source: 'autonomy-overlay', state: 'suppressed' },
  }
}

/** The template rows of the bound snapshot (exactly one leader). */
function templateRowsOf(world: P6T1World): DurableTemplateRow[] {
  const rows: DurableTemplateRow[] = []
  const leader = world.blueprint.leader
  rows.push({
    kind: 'leader',
    templateId: leader.templateId,
    displayName: leader.displayName ?? 'Leader',
    contextPolicy: contextPolicyOf(leader),
  })
  for (const template of world.blueprint.members) {
    rows.push({
      kind: 'member',
      templateId: template.templateId,
      displayName: template.displayName ?? String(template.templateId),
      ...(template.description !== undefined ? { description: template.description } : {}),
      contextPolicy: contextPolicyOf(template),
    })
  }
  return rows
}

/** Every durable member row (the LeaderInstance row carries NO childSessionId, invariant 14). */
function memberRowsOf(world: P6T1World, defaultWorkspace: string): DurableMemberRow[] {
  const policyByTemplate = new Map<string, ContextPolicy>()
  policyByTemplate.set(String(world.blueprint.leader.templateId), contextPolicyOf(world.blueprint.leader))
  for (const template of world.blueprint.members) {
    policyByTemplate.set(String(template.templateId), contextPolicyOf(template))
  }
  const rows: DurableMemberRow[] = []
  for (const record of world.domain.repositories.memberInstances.list(P6T2_ROOT)) {
    const isLeader = String(record.instanceId) === LEADER_INSTANCE_ID
    const templateId = String(record.templateId)
    const contextPolicy = policyByTemplate.get(templateId)
    if (contextPolicy === undefined) {
      throw new Error(`g8s1: no template contextPolicy for member template '${templateId}'`)
    }
    rows.push({
      instanceId: record.instanceId,
      templateId: record.templateId,
      label: record.label,
      lifecycle: record.lifecycle,
      createdAt: record.createdAt,
      contextPolicy,
      effectiveConfig: g8s1EffectiveConfig(defaultWorkspace),
      ...(isLeader ? {} : { childSessionId: record.childSessionId }),
      ...(record.workspace !== undefined ? { workspace: record.workspace } : {}),
      ...(record.groupId !== undefined ? { groupId: record.groupId } : {}),
    })
  }
  return rows
}

/** The ledger summary computed from the real durable entries. */
function ledgerSummaryOf(entries: readonly LedgerEntry[]): DurableLedgerSummary {
  const byCategory = {
    team: 0,
    member: 0,
    lifecycle: 0,
    message: 0,
    control: 0,
    policy: 0,
    compatibility: 0,
    progress: 0,
  }
  let latestSequence = 0
  for (const entry of entries) {
    if (entry.sequence > latestSequence) {
      latestSequence = entry.sequence
    }
    // The stand-in category map: the provision facts (the only fact family
    // this E2E writes) are `member` lifecycle facts (UI §27.4).
    if (entry.factType === PROVISION_INTENT_TYPE) {
      byCategory.member += 1
    }
  }
  return {
    latestSequence,
    totalEntries: entries.length,
    byCategory,
    pendingControlCount: 0,
  }
}

/**
 * Build the bounded projection source from the REAL durable rows (the
 * pre-adapter stand-in; the generation is verbatim from the seeded row).
 */
function buildRealSource(world: P6T1World): TeamDomainProjectionSource {
  const repositories = world.domain.repositories
  const teamRow = repositories.teamSessions.get(P6T2_ROOT)
  if (teamRow === undefined) {
    throw new Error('g8s1: the seeded team_sessions row is missing')
  }
  return {
    teamSessionId: parseTeamSessionId(P6T2_ROOT),
    blueprint: teamRow.blueprint,
    defaultWorkspace: teamRow.defaultWorkspace,
    createdAt: teamRow.createdAt,
    generation: teamRow.generation,
    root: {
      // `default` is the P6-T2 blueprint's only policy state; the compat
      // summary is the deterministic stand-in (no probe ran in this world).
      policyState: 'default',
      admission: 'OPEN',
      compatibility: {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'req-g8s1',
        environmentFingerprint: 'env-g8s1',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      },
      creationBudgetConsumed: 0,
    },
    templates: templateRowsOf(world),
    members: memberRowsOf(world, teamRow.defaultWorkspace ?? 'C:/agent-team/work/g8s1'),
    ledger: ledgerSummaryOf(repositories.ledger.list()),
  }
}

/** Wrap one projection in the frozen success frame (the server shape of team.getProjection). */
function pullFrame(projection: TeamProjectionDto): RemoteResponse {
  return buildRemoteSuccess(
    { projection },
    {
      method: 'team.getProjection',
      endpoint: 'team.getProjection',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: projection.generation,
    },
  )
}

// ---------------------------------------------------------------------------
// World 1 — the positive E2E + the same-token replay negative (P6-T2).
// ---------------------------------------------------------------------------

let w1: {
  readonly seedGeneration: number
  readonly stamps: number[]
  readonly counts: number[]
  readonly instanceIds: string[]
  readonly replay: {
    readonly effectKind: string
    readonly replayed: boolean
    readonly instanceId: string
    readonly stampBefore: number
    readonly stampAfter: number
    readonly countAfter: number
    readonly newWrites: number
  }
  readonly projection: TeamProjectionDto
  readonly recomputed: TeamProjectionDto
  readonly assessments: {
    readonly fresh: ReturnType<typeof assessProjectionSync>
    readonly equalStamp: ReturnType<typeof assessProjectionSync>
    readonly stalePull: ReturnType<typeof assessProjectionSync>
  }
  readonly realMemberIds: string[]
  readonly realGeneration: number
  readonly realSummary: DurableLedgerSummary
}

{
  const world = await createP6T2World('g8s1-rt', ['leader'])
  try {
    const repositories = world.domain.repositories
    const seedGeneration = generationOf(world)
    const runtime = createP6T2Runtime(world)

    const stamps: number[] = [seedGeneration]
    const counts: number[] = [repositories.ledger.entryCount()]
    const instanceIds: string[] = []
    for (const step of DELEGATES) {
      const outcome = await runtime.performAction(
        makeActionRequest({
          action: 'delegate',
          delegationTemplateId: step.templateId,
          // P8-S3 R2 conformance: the work request carries an explicit prompt.
          payload: { label: step.label, prompt: 'g8s1 stamp probe' },
          requestToken: step.token,
        }),
      )
      const effect = outcome.effect
      if (effect.kind !== 'member-activated' || effect.replayed) {
        throw new Error(
          `g8s1: delegate '${step.token}' did not activate a fresh member (kind '${effect.kind}')`,
        )
      }
      instanceIds.push(effect.instanceId)
      stamps.push(generationOf(world))
      counts.push(repositories.ledger.entryCount())
    }

    // The same-token replay: the durable idempotent path (no new fact, no
    // new stamp advance, no new seam write).
    const stampBefore = generationOf(world)
    const beforeReplayWrites = world.seam.writeCount
    const replayOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        // P8-S3 R2 conformance: the work request carries an explicit prompt.
        payload: { label: 'g8s1-scout-1', prompt: 'g8s1 stamp probe' },
        requestToken: 'tok-g8s1-d1',
      }),
    )
    const replayEffect = replayOutcome.effect
    if (replayEffect.kind !== 'member-activated') {
      throw new Error(`g8s1: replay effect kind '${replayEffect.kind}'`)
    }
    const replay = {
      effectKind: replayEffect.kind,
      replayed: replayEffect.replayed,
      instanceId: replayEffect.instanceId,
      stampBefore,
      stampAfter: generationOf(world),
      countAfter: repositories.ledger.entryCount(),
      newWrites: world.seam.writeCount - beforeReplayWrites,
    }

    // The projection over the real world (cold service: no live overlay).
    const source = buildRealSource(world)
    const port: TeamDomainReadPort = {
      readProjectionSource(teamSessionId: TeamSessionId): TeamDomainProjectionSource {
        void teamSessionId
        return source
      },
    }
    const service = createProjectionService(port, null, { clock: () => G8S1_GENERATED_AT })
    const projection = service.project(parseTeamSessionId(P6T2_ROOT))
    const recomputed = projectTeam(buildRealSource(world), null, G8S1_GENERATED_AT)

    // The pull verdicts (the NEW client, then the equal-stamp re-pull, then
    // the stale pull that a push frame could have superseded).
    const frame = pullFrame(projection)
    const freshClient: AppliedProjectionIdentity | null = null
    const fresh = assessProjectionSync(freshClient, frame)
    const equalStamp = assessProjectionSync({ teamSessionId: P6T2_ROOT, generation: projection.generation }, frame)
    const stalePull = assessProjectionSync({ teamSessionId: P6T2_ROOT, generation: projection.generation + 1 }, frame)

    w1 = {
      seedGeneration,
      stamps,
      counts,
      instanceIds,
      replay,
      projection,
      recomputed,
      assessments: { fresh, equalStamp, stalePull },
      realMemberIds: repositories.memberInstances
        .list(P6T2_ROOT)
        .map((member) => String(member.instanceId))
        .sort(),
      realGeneration: generationOf(world),
      realSummary: ledgerSummaryOf(repositories.ledger.list()),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// World 2 — hook B: the compatibility replaceState advances the stamp.
// ---------------------------------------------------------------------------

let w2: { readonly seed: number; readonly afterProbe1: number; readonly afterProbe2: number }

{
  const handle = await createP7T1World('g8s1-hookb')
  try {
    const repositories = handle.world.domain.repositories
    const root = P6T2_ROOT // the P7-T1 world is the P6-T1 fixture world
    const seed = repositories.teamSessions.get(root)?.generation
    if (seed === undefined) {
      throw new Error('g8s1: the P7-T1 world did not seed its team_sessions row')
    }
    await handle.prober.probe(PROBE_TRIGGERS.NEW_ACTIVATION)
    const afterProbe1 = repositories.teamSessions.get(root)?.generation
    await handle.prober.probe(PROBE_TRIGGERS.MEMBER_COLD_RESUME)
    const afterProbe2 = repositories.teamSessions.get(root)?.generation
    if (afterProbe1 === undefined || afterProbe2 === undefined) {
      throw new Error('g8s1: the team_sessions row vanished after the probes')
    }
    w2 = { seed, afterProbe1, afterProbe2 }
  } finally {
    await destroyP7T1World(handle)
  }
}

describe('G8-S1 generation stamp — the real runtime path (P6-T2 action router)', () => {
  it('seeds generation 1 and walks the stamp strictly 1→2→3→4 in lockstep with the ledger count (three real-router delegates)', () => {
    expect(w1.seedGeneration).toBe(1)
    expect(w1.stamps).toEqual([1, 2, 3, 4])
    expect(w1.counts).toEqual([0, 1, 2, 3])
    for (let i = 1; i < w1.stamps.length; i += 1) {
      const current = w1.stamps[i]
      const previous = w1.stamps[i - 1]
      if (current === undefined || previous === undefined) {
        throw new Error('g8s1: stamp sequence hole')
      }
      expect(current).toBeGreaterThan(previous)
    }
    expect(w1.instanceIds.length).toBe(3)
    expect(new Set(w1.instanceIds).size).toBe(3)
  })

  it('carries the stamp verbatim into the projection; a NEW client re-pull verdicts apply (not duplicate)', () => {
    expect(w1.projection.generation).toBe(4)
    expect(String(w1.projection.teamSessionId)).toBe(P6T2_ROOT)
    expect(w1.assessments.fresh.status).toBe('apply')
    expect(w1.assessments.fresh.receivedGeneration).toBe(4)
    expect(w1.assessments.equalStamp.status).toBe('duplicate')
    expect(w1.assessments.equalStamp.receivedGeneration).toBe(4)
    expect(w1.assessments.stalePull.status).toBe('stale')
  })

  it('the applied body equals the latest durable state (members, ledger, generation mirror the real rows; the DTO equals a fresh fold)', () => {
    expect(w1.projection.generation).toBe(w1.realGeneration)
    const projectedIds = w1.projection.members
      .map((member) => String(member.instanceId))
      .sort()
    expect(projectedIds).toEqual(w1.realMemberIds)
    expect(w1.projection.ledger).toEqual(w1.realSummary)
    expect(w1.projection).toEqual(w1.recomputed)
  })

  it('a same-token delegate replay advances nothing (idempotent: no double stamp advance, zero new seam writes)', () => {
    expect(w1.replay.effectKind).toBe('member-activated')
    expect(w1.replay.replayed).toBe(true)
    expect(w1.replay.instanceId).toBe(w1.instanceIds[0])
    expect(w1.replay.stampBefore).toBe(4)
    expect(w1.replay.stampAfter).toBe(4)
    expect(w1.replay.countAfter).toBe(3)
    expect(w1.replay.newWrites).toBe(0)
  })
})

describe('G8-S1 generation stamp — hook B (the compatibility replaceState)', () => {
  it('each durable compatibility write advances the generation by exactly one', () => {
    expect(w2.seed).toBe(1)
    expect(w2.afterProbe1).toBe(2)
    expect(w2.afterProbe2).toBe(3)
  })
})
