/**
 * P6-T2 C1/C2/C3 — quota boundary semantics (documented step 5: enforced
 * INSIDE the ActivationProvider's step-7 admission, the single source of
 * truth — the router owns no counters).
 *
 * MUST-TEST coverage: the boundary itself. With the P6-T2 quotas
 * (team 4, per-template 2):
 * - at the exact limit the admission is IN-BOUNDARY (count+1 = limit is
 *   allowed, `count+1 > limit` rejects);
 * - one over the limit is REJECTED (QUOTA_EXCEEDED_*);
 * - the outcome is DETERMINISTIC: racing attempts serialize behind the
 *   per-team lock and cannot over-consume (C3: exactly one of four
 *   parallel template-boundary attempts admits).
 */

import { describe, expect, it } from 'vitest'
import {
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { TeamRuntimeActionOutcome } from '../admission/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import {
  assertRuntimeCode,
  createP6T2Runtime,
  createP6T2World,
  makeActionRequest,
  memberList,
  membersByTemplate,
  p6t2Seed,
} from './p6t2-helpers.js'

interface QuotaCase {
  readonly code: string
  readonly details?: Record<string, unknown>
  readonly newWrites: number
}

function activatedOf(outcome: TeamRuntimeActionOutcome): {
  readonly instanceId: string
  readonly templateId: string
  readonly childSessionId: string
  readonly replayed: boolean
} {
  const effect = outcome.effect
  if (effect.kind !== 'member-activated') {
    throw new Error(
      `activatedOf: expected member-activated effect, got '${effect.kind}'`,
    )
  }
  return {
    instanceId: effect.instanceId,
    templateId: effect.templateId,
    childSessionId: effect.childSessionId,
    replayed: effect.replayed,
  }
}

// ---------------------------------------------------------------------------
// C1 — the TEAM boundary (maxInstances: 4, seeded team total 3)
// ---------------------------------------------------------------------------
let c1: {
  readonly first: {
    readonly effectKind: string
    readonly instanceId?: string
    readonly templateId?: string
    readonly teamTotalAfter: number
  }
  readonly second: QuotaCase & {
    readonly teamTotalAfter: number
    readonly scoutCountAfter: number
  }
}
{
  const world = await createP6T2World('p6t2x-c1', ['leader', 'worker', 'worker2'])
  try {
    const runtime = createP6T2Runtime(world)

    const firstOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        payload: { label: 'scout-a', prompt: 'p6t2 c1 scout-a prompt' },
        requestToken: 'tok-p6t2-c1a',
      }),
    )
    const first = activatedOf(firstOutcome)
    const firstTotal = memberList(world).length

    const beforeSecond = world.seam.writeCount
    let second: QuotaCase & { teamTotalAfter: number; scoutCountAfter: number }
    try {
      await runtime.performAction(
        makeActionRequest({
          action: 'delegate',
          delegationTemplateId: 'scout',
          payload: { label: 'scout-b', prompt: 'p6t2 c1 scout-b prompt' },
          requestToken: 'tok-p6t2-c1b',
        }),
      )
      throw new Error('C1b: the over-limit admission was not rejected')
    } catch (error) {
      const checked = assertRuntimeCode(
        error,
        TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_INSTANCES,
      )
      second = {
        code: checked.code,
        details: checked.details,
        newWrites: world.seam.writeCount - beforeSecond,
        teamTotalAfter: memberList(world).length,
        scoutCountAfter: membersByTemplate(world, 'scout').length,
      }
    }

    c1 = {
      first: {
        effectKind: firstOutcome.effect.kind,
        instanceId: first.instanceId,
        templateId: first.templateId,
        teamTotalAfter: firstTotal,
      },
      second,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// C2 — the TEMPLATE boundary (per-template maxInstances: 2, seeded scout 1).
// The scout template is fresh_per_delegation, so a templateId delegation
// always CREATES (a non-fresh template with an active instance would instead
// CONTINUE the existing instance — the create path cannot be exercised).
// The team quota stays in-bound the whole time (max 3+1 = 4 ≤ 4), so the
// rejection can only come from the per-template check.
// ---------------------------------------------------------------------------
let c2: {
  readonly first: { readonly effectKind: string; readonly scoutCountAfter: number }
  readonly second: QuotaCase & { readonly scoutCountAfter: number }
}
{
  const world = await createP6T2World('p6t2x-c2', ['leader'], {
    seedMembers: [p6t2Seed('scout')],
  })
  try {
    const runtime = createP6T2Runtime(world)

    const firstOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        payload: { label: 'scout-a', prompt: 'p6t2 c1 scout-a prompt' },
        requestToken: 'tok-p6t2-c2a',
      }),
    )
    if (firstOutcome.effect.kind !== 'member-activated') {
      throw new Error(
        `C2a: expected member-activated, got '${firstOutcome.effect.kind}'`,
      )
    }

    const beforeSecond = world.seam.writeCount
    let second: QuotaCase & { scoutCountAfter: number }
    try {
      await runtime.performAction(
        makeActionRequest({
          action: 'delegate',
          delegationTemplateId: 'scout',
          payload: { label: 'scout-b', prompt: 'p6t2 c1 scout-b prompt' },
          requestToken: 'tok-p6t2-c2b',
        }),
      )
      throw new Error('C2b: the over-limit admission was not rejected')
    } catch (error) {
      const checked = assertRuntimeCode(
        error,
        TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
      )
      second = {
        code: checked.code,
        details: checked.details,
        newWrites: world.seam.writeCount - beforeSecond,
        scoutCountAfter: membersByTemplate(world, 'scout').length,
      }
    }

    c2 = {
      first: {
        effectKind: firstOutcome.effect.kind,
        scoutCountAfter: membersByTemplate(world, 'scout').length,
      },
      second,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// C3 — racing attempts at the template boundary (no over-consumption).
// Same fresh_per_delegation (scout) create path as C2: four parallel
// template-boundary delegations serialize behind the per-team lock.
// ---------------------------------------------------------------------------
const RACE_LABELS = ['race-r1', 'race-r2', 'race-r3', 'race-r4']
let c3: {
  readonly activatedCount: number
  readonly quotaRejectionCount: number
  readonly unexpectedRejections: string[]
  readonly scoutCount: number
  readonly teamTotal: number
  readonly presentRaceLabels: string[]
}
{
  const world = await createP6T2World('p6t2x-c3', ['leader'], {
    seedMembers: [p6t2Seed('scout')],
  })
  try {
    const runtime = createP6T2Runtime(world)
    const settled = await Promise.allSettled(
      RACE_LABELS.map((label, index) =>
        runtime.performAction(
          makeActionRequest({
            action: 'delegate',
            delegationTemplateId: 'scout',
            payload: { label, prompt: `p6t2 c3 race ${label} prompt` },
            requestToken: `tok-p6t2-c3r${index + 1}`,
          }),
        ),
      ),
    )

    let activatedCount = 0
    let quotaRejectionCount = 0
    const unexpectedRejections: string[] = []
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value.effect.kind === 'member-activated') activatedCount += 1
        else unexpectedRejections.push(`unexpected effect '${outcome.value.effect.kind}'`)
      } else {
        const checked = assertRuntimeCode(
          outcome.reason,
          TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
        )
        if (checked.code === TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES) {
          quotaRejectionCount += 1
        }
      }
    }

    const members = memberList(world)
    c3 = {
      activatedCount,
      quotaRejectionCount,
      unexpectedRejections,
      scoutCount: membersByTemplate(world, 'scout').length,
      teamTotal: members.length,
      presentRaceLabels: RACE_LABELS.filter((label) =>
        members.some((member) => member.label === label),
      ),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T2 C1: the team quota boundary (maxInstances: 4)', () => {
  it('at the exact limit the admission is IN-BOUNDARY (3+1 = 4 is allowed)', () => {
    expect(c1.first.effectKind).toBe('member-activated')
    expect(c1.first.templateId).toBe('scout')
    expect(
      c1.first.instanceId !== undefined && c1.first.instanceId.startsWith('inst-'),
    ).toBe(true)
    expect(c1.first.teamTotalAfter).toBe(4)
  })

  it('one over the limit is REJECTED with QUOTA_EXCEEDED_TEAM_INSTANCES, zero writes', () => {
    expect(c1.second.code).toBe(TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_INSTANCES)
    expect((c1.second.details ?? {})['source']).toBe('activation-provider')
    expect(c1.second.newWrites).toBe(0)
    expect(c1.second.teamTotalAfter).toBe(4)
    expect(c1.second.scoutCountAfter).toBe(1)
  })
})

describe('P6-T2 C2: the per-template quota boundary (per-template maxInstances: 2)', () => {
  it('at the exact template limit the admission is IN-BOUNDARY (scout 1+1 = 2 is allowed; team 3+0 = 3 ≤ 4 in-bound)', () => {
    expect(c2.first.effectKind).toBe('member-activated')
    expect(c2.first.scoutCountAfter).toBe(2)
  })

  it('one over the template limit is REJECTED with QUOTA_EXCEEDED_TEMPLATE_INSTANCES (team quota still in-bound), zero writes', () => {
    expect(c2.second.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
    )
    expect((c2.second.details ?? {})['source']).toBe('activation-provider')
    expect(c2.second.newWrites).toBe(0)
    expect(c2.second.scoutCountAfter).toBe(2)
  })
})

describe('P6-T2 C3: racing attempts cannot over-consume the quota', () => {
  it('exactly one of four parallel template-boundary attempts admits', () => {
    expect(c3.unexpectedRejections).toEqual([])
    expect(c3.activatedCount).toBe(1)
    expect(c3.quotaRejectionCount).toBe(3)
  })

  it('the final state is deterministic: exactly one new scout, no over-consumption', () => {
    expect(c3.scoutCount).toBe(2)
    expect(c3.teamTotal).toBe(3)
    // The winner is async-interleaving dependent: the FINAL STATE (one new
    // scout, from exactly one of the four race labels) is what is
    // deterministic — not which label won.
    expect(c3.presentRaceLabels.length).toBe(1)
    expect(
      c3.presentRaceLabels.length > 0 &&
        RACE_LABELS.includes(c3.presentRaceLabels[0] ?? ''),
    ).toBe(true)
  })
})
