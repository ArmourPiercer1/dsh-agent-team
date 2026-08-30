/**
 * P6-T2 A1 — instanceId-first addressing and the resolution steps of the
 * documented enforcement order (step 0 validation, step 1 team/target,
 * step 2 caller).
 *
 * Every rejection in this suite happens in the RESOLUTION phase (pure
 * reads over the TeamDomain) — the fail-closed contract (zero durable
 * side effects on any rejection, invariant 41) is asserted with a per
 * action seam write-count before/after measurement.
 */

import { describe, expect, it } from 'vitest'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { TeamRuntimeActionRequest } from '../admission/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_SEEDS,
  createP6T2Runtime,
  createP6T2World,
  expectRejection,
  leaderCaller,
  makeActionRequest,
  memberCaller,
  p6t2Seed,
} from './p6t2-helpers.js'

/** A seeded member in the terminal DISPOSED lifecycle (stale caller). */
const STALE_DISPOSED: Partial<MemberInstanceRecordDto> = {
  instanceId: parseInstanceId('inst-p6t2stale01'),
  templateId: parseTemplateId('worker'),
  label: 'disposed-worker',
  childSessionId: parseChildSessionId('session-child-p6t2-stale'),
  lifecycle: 'DISPOSED',
}

/** A seeded member in the ARCHIVED lifecycle (stale caller). */
const STALE_ARCHIVED: Partial<MemberInstanceRecordDto> = {
  instanceId: parseInstanceId('inst-p6t2archv01'),
  templateId: parseTemplateId('scout'),
  label: 'archived-scout',
  childSessionId: parseChildSessionId('session-child-p6t2-archv'),
  lifecycle: 'ARCHIVED',
}

/** A TeamSession root that has a record but NO team-root binding. */
const ORPHAN_ROOT = 'session-root-p6t2-orphan'

interface A1Case {
  readonly code: string
  readonly details?: Record<string, unknown>
  readonly newWrites: number
}

interface A1Positive {
  readonly effectKind: string
  readonly targetInstanceId?: string
  readonly fromLifecycle?: string
  readonly lifecycleCommitted?: boolean
  readonly newWrites: number
}

let a1: {
  readonly unknownTarget: A1Case
  readonly templateAddressing: A1Case
  readonly labelAddressing: A1Case
  readonly notAnInstanceId: A1Case
  readonly missingTeam: A1Case
  readonly orphanBinding: A1Case
  readonly unknownCaller: A1Case
  readonly staleCallerDisposed: A1Case
  readonly staleCallerArchived: A1Case
  readonly missingTargetField: A1Case
  readonly unknownAction: A1Case
  readonly positive: A1Positive
}
{
  const world = await createP6T2World('p6t2x-a1', ['leader', 'worker'], {
    seedMembers: [p6t2Seed('scout', { lifecycle: 'SETTLED' }), STALE_DISPOSED, STALE_ARCHIVED],
  })
  try {
    const runtime = createP6T2Runtime(world)
    const run = async (
      request: TeamRuntimeActionRequest,
      code: string,
    ): Promise<A1Case> => {
      const before = world.seam.writeCount
      const rejection = await expectRejection(runtime, request, code)
      return {
        code: rejection.code,
        details: rejection.details,
        newWrites: world.seam.writeCount - before,
      }
    }
    const workerId = P6T2_SEEDS.worker.instanceId
    const scoutId = P6T2_SEEDS.scout.instanceId

    const a1Base = {
      unknownTarget: await run(
        makeActionRequest({
          targetInstanceId: 'inst-p6t2unknown1',
          requestToken: 'tok-p6t2-a1',
        }),
        TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
      ),
      templateAddressing: await run(
        makeActionRequest({
          targetInstanceId: 'worker',
          requestToken: 'tok-p6t2-a2',
        }),
        TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
      ),
      labelAddressing: await run(
        makeActionRequest({
          targetInstanceId: 'existing-worker',
          requestToken: 'tok-p6t2-a3',
        }),
        TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
      ),
      notAnInstanceId: await run(
        makeActionRequest({
          targetInstanceId: 'bogus-token',
          requestToken: 'tok-p6t2-a4',
        }),
        TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
      ),
      missingTeam: await run(
        makeActionRequest({
          rootSessionId: 'session-root-p6t2-none',
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-a5',
        }),
        TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
      ),
      unknownCaller: await run(
        makeActionRequest({
          caller: memberCaller('inst-nosuchp6t2'),
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-a7',
        }),
        TEAM_RUNTIME_ERROR_CODES.CALLER_NOT_FOUND,
      ),
      staleCallerDisposed: await run(
        makeActionRequest({
          caller: memberCaller('inst-p6t2stale01'),
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-a8',
        }),
        TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
      ),
      staleCallerArchived: await run(
        makeActionRequest({
          caller: memberCaller('inst-p6t2archv01'),
          targetInstanceId: workerId,
          requestToken: 'tok-p6t2-a9',
        }),
        TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
      ),
      missingTargetField: await run(
        makeActionRequest({
          requestToken: 'tok-p6t2-a10',
        }),
        TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
      ),
      unknownAction: await run(
        makeActionRequest({
          action: 'explode-the-team',
          requestToken: 'tok-p6t2-a11',
        }),
        TEAM_RUNTIME_ERROR_CODES.ACTION_UNKNOWN,
      ),
    }

    // The orphan-binding record is planted AFTER the missing-team check
    // (its put is one deliberate write, excluded from the per-action
    // baseline).
    await world.domain.repositories.teamSessions.put({
      rootSessionId: parseRootSessionId(ORPHAN_ROOT),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId(String(world.blueprint.blueprintId)),
        revision: parseBlueprintRevision(String(world.blueprint.revision)),
        contentHash: parseBlueprintContentHash(String(world.blueprint.contentHash)),
      }),
      defaultWorkspace: 'C:/agent-team/work/p6t2',
      createdAt: '2026-08-30T08:00:00Z',
      generation: 1,
    })
    const orphanBinding = await run(
      makeActionRequest({
        rootSessionId: ORPHAN_ROOT,
        caller: leaderCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-a6',
      }),
      TEAM_RUNTIME_ERROR_CODES.TEAM_ROOT_BINDING_MISSING,
    )

    const beforePositive = world.seam.writeCount
    const positiveOutcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: scoutId,
        requestToken: 'tok-p6t2-a12',
      }),
    )
    const effect = positiveOutcome.effect
    const positive: A1Positive = {
      effectKind: effect.kind,
      ...(effect.kind === 'work-admitted'
        ? {
            targetInstanceId: positiveOutcome.targetInstanceId,
            fromLifecycle: effect.fromLifecycle,
            lifecycleCommitted: effect.lifecycleCommitted,
          }
        : {}),
      newWrites: world.seam.writeCount - beforePositive,
    }
    a1 = { ...a1Base, orphanBinding, positive }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T2 A1: instanceId-first addressing — resolution rejections are pure reads', () => {
  it('a token that parses but has no member record -> INSTANCE_NOT_FOUND, zero writes', () => {
    expect(a1.unknownTarget.code).toBe(TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND)
    expect(a1.unknownTarget.newWrites).toBe(0)
  })

  it('a template id as target is REJECTED, classified, zero writes (invariant 19)', () => {
    expect(a1.templateAddressing.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    expect(a1.templateAddressing.details?.['kind']).toBe('template-id')
    expect(a1.templateAddressing.newWrites).toBe(0)
  })

  it('a member label as target is REJECTED, classified, zero writes (invariant 19)', () => {
    expect(a1.labelAddressing.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    expect(a1.labelAddressing.details?.['kind']).toBe('member-label')
    expect(a1.labelAddressing.newWrites).toBe(0)
  })

  it('an unparseable token is REJECTED (not re-interpreted), zero writes', () => {
    expect(a1.notAnInstanceId.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED,
    )
    expect(a1.notAnInstanceId.details?.['kind']).toBe('not-an-instance-id')
    expect(a1.notAnInstanceId.newWrites).toBe(0)
  })

  it('a root without a TeamSession record -> TEAM_SESSION_NOT_FOUND, zero writes', () => {
    expect(a1.missingTeam.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
    )
    expect(a1.missingTeam.newWrites).toBe(0)
  })

  it('a TeamSession record without the team-root binding -> TEAM_ROOT_BINDING_MISSING, zero writes', () => {
    expect(a1.orphanBinding.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.TEAM_ROOT_BINDING_MISSING,
    )
    expect(a1.orphanBinding.newWrites).toBe(0)
  })

  it('an unknown instance caller -> CALLER_NOT_FOUND, zero writes', () => {
    expect(a1.unknownCaller.code).toBe(TEAM_RUNTIME_ERROR_CODES.CALLER_NOT_FOUND)
    expect(a1.unknownCaller.newWrites).toBe(0)
  })

  it('a DISPOSED caller -> CALLER_ROLE_STALE (details.lifecycle), zero writes', () => {
    expect(a1.staleCallerDisposed.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
    )
    expect(a1.staleCallerDisposed.details?.['lifecycle']).toBe('DISPOSED')
    expect(a1.staleCallerDisposed.newWrites).toBe(0)
  })

  it('an ARCHIVED caller -> CALLER_ROLE_STALE (details.lifecycle), zero writes', () => {
    expect(a1.staleCallerArchived.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
    )
    expect(a1.staleCallerArchived.details?.['lifecycle']).toBe('ARCHIVED')
    expect(a1.staleCallerArchived.newWrites).toBe(0)
  })

  it('an instance-targeted action without targetInstanceId -> REQUEST_MALFORMED, zero writes', () => {
    expect(a1.missingTargetField.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
    )
    expect(a1.missingTargetField.newWrites).toBe(0)
  })

  it('an unknown action name -> ACTION_UNKNOWN, zero writes', () => {
    expect(a1.unknownAction.code).toBe(TEAM_RUNTIME_ERROR_CODES.ACTION_UNKNOWN)
    expect(a1.unknownAction.newWrites).toBe(0)
  })

  it('the positive control: a valid instanceId target executes (SETTLED work admission without a commit port)', () => {
    expect(a1.positive.effectKind).toBe('work-admitted')
    expect(a1.positive.targetInstanceId).toBe(P6T2_SEEDS.scout.instanceId)
    expect(a1.positive.fromLifecycle).toBe('SETTLED')
    expect(a1.positive.lifecycleCommitted).toBe(false)
    expect(a1.positive.newWrites).toBeGreaterThan(0)
  })
})
