/**
 * P8-S4B M6 — unit tests for the §18.3 backend-truth CELL PROVENANCE
 * derivation (DevPlan P8-S §18.3: the projection must later be able to read
 * effective / source / suppressed / unavailable / deniedBy / pending next
 * boundary — this task owns the backend truth only).
 *
 * Every fixture flows through the REAL frozen stack: durable records are
 * built with the storage `parseGovernanceOverride`, resolved with the
 * frozen `resolveActivationPolicy` (selectPolicyOverrides + the P3-T4
 * resolver), and `cellProvenance` maps the result onto the six §18.3
 * fields:
 *
 *  - P1 the empty-team baseline: unspecified -> fail-closed deny with
 *     `deniedBy: team/unspecifiedFailClosed`, no source record;
 *  - P2 a human-override allow: source provenance (layer/origin/recordId)
 *     + granted effective value (v1 envelope ruling: autonomy-overlay
 *     GRANTS fail closed in the empty-envelope activation context; only
 *     denials and human overrides can grant a cell);
 *  - P3 pending-next-boundary: durable records admitting the cell minus
 *     the session's applied record ids;
 *  - P4 an explicit team (autonomy) deny: `deniedBy` with full team
 *     provenance;
 *  - P5 the external stage wins: capabilityMissing / externalHardDeny /
 *     externalHardRemovedAll, each with its frozen reason;
 *  - P6 the human-override and instance-overlay slots carry their own
 *     layer/origin provenance (and the instance layer outranks the team
 *     overlay layer for the addressed instance);
 *  - P7 recordAdmitsCapability: the values-key predicate.
 *
 * @module @dsh-agent-team/runtime/test/p8s4b-cell-provenance
 */

import { describe, expect, it } from 'vitest'
import { resolveActivationPolicy } from '../activation/index.js'
import {
  cellProvenance,
  recordAdmitsCapability,
  type CellProvenance,
  type DurableOverrideRef,
} from '../mutation/index.js'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'

const ROOT = 'session-p8s4btest'
const INSTANCE = 'inst-p8s4btest1'
const EMPTY_EXTERNAL = { hard: {}, capabilityExists: {} }

function override(
  recordId: string,
  values: Record<string, unknown>,
  extra?: {
    kind?: 'autonomy-overlay' | 'human-override'
    scope?: 'team' | 'instance'
    instanceId?: string
    origin?: 'leader' | 'member'
    generation?: number
  },
): GovernanceOverrideRecord {
  const kind = extra?.kind ?? 'autonomy-overlay'
  const base: Record<string, unknown> = {
    schemaVersion: 1,
    kind,
    recordId,
    scope: extra?.scope ?? 'team',
    rootSessionId: ROOT,
    values,
    generation: extra?.generation ?? 1,
    updatedAt: '2026-08-31T00:00:00.000Z',
  }
  if (extra?.instanceId !== undefined) base['instanceId'] = extra.instanceId
  if (kind === 'autonomy-overlay') base['origin'] = extra?.origin ?? 'leader'
  return parseGovernanceOverride(base)
}

function refOf(record: GovernanceOverrideRecord): DurableOverrideRef {
  return {
    recordId: record.recordId,
    kind: record.kind,
    scope: record.scope,
    generation: record.generation,
    updatedAt: record.updatedAt,
    values: record.values,
  }
}

const allowModel = { model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] } }
const denyModel = { model: { kind: 'deny' } }

const empty = resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [], external: EMPTY_EXTERNAL })
const provEmpty: CellProvenance = cellProvenance(empty, 'model')

const rAllow = override('p8s4b-cp-allow', allowModel, { kind: 'human-override' })
const allowPolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllow],
  external: EMPTY_EXTERNAL,
})
const provAllow: CellProvenance = cellProvenance(allowPolicy, 'model', {
  overrides: [refOf(rAllow)],
  appliedRecordIds: ['p8s4b-cp-allow'],
})
const provAllowPending: CellProvenance = cellProvenance(allowPolicy, 'model', { overrides: [refOf(rAllow)] })

const rDeny = override('p8s4b-cp-deny', denyModel)
const denyPolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rDeny],
  external: EMPTY_EXTERNAL,
})
const provDeny: CellProvenance = cellProvenance(denyPolicy, 'model')

const missingPolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllow],
  external: { hard: {}, capabilityExists: { model: false } },
})
const provMissing: CellProvenance = cellProvenance(missingPolicy, 'model')

const hardDenyPolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllow],
  external: { hard: { model: { kind: 'deny' } }, capabilityExists: {} },
})
const provHardDeny: CellProvenance = cellProvenance(hardDenyPolicy, 'model')

const removedAllPolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllow],
  external: { hard: { model: { kind: 'allow', items: ['some-other-model'] } }, capabilityExists: {} },
})
const provRemovedAll: CellProvenance = cellProvenance(removedAllPolicy, 'model')

const rHuman = override('p8s4b-cp-human', allowModel, { kind: 'human-override' })
const humanPolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rHuman],
  external: EMPTY_EXTERNAL,
})
const provHuman: CellProvenance = cellProvenance(humanPolicy, 'model')

const rInstance = override('p8s4b-cp-instance', denyModel, { scope: 'instance', instanceId: INSTANCE, origin: 'member' })
const rTeamDeny = override('p8s4b-cp-teamdeny', denyModel)
const instancePolicy = resolveActivationPolicy({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rTeamDeny, rInstance],
  external: EMPTY_EXTERNAL,
})
const provInstance: CellProvenance = cellProvenance(instancePolicy, 'model')

const valuesWith = { model: 'x' }
const valuesWithout = { mcp: { kind: 'deny' } }

describe('P8-S4B M6 cell provenance (§18.3 backend truth)', () => {
  it('P1 the empty-team baseline fails closed with the unspecified marker', () => {
    expect(provEmpty.effective).toEqual({ kind: 'deny' })
    expect(provEmpty.source).toEqual({ layer: 'unspecified', origin: 'static', recordId: null })
    expect(provEmpty.unavailable).toBe(false)
    expect(provEmpty.deniedBy).toEqual({ by: 'team', reason: 'unspecifiedFailClosed' })
    expect(provEmpty.pendingNextBoundary).toEqual([])
    expect(provEmpty.suppressed).toEqual([])
  })

  it('P2 a human-override allow carries the winning layer/origin/record provenance', () => {
    expect(provAllow.effective).toEqual({ kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] })
    expect(provAllow.source).toEqual({ layer: 'humanOverride', origin: 'human', recordId: 'p8s4b-cp-allow' })
    expect(provAllow.deniedBy).toBe(undefined)
    expect(provAllow.unavailable).toBe(false)
  })

  it('P3 pending-next-boundary is the admitting records minus the applied ids', () => {
    expect(provAllow.pendingNextBoundary).toEqual([])
    expect(provAllowPending.pendingNextBoundary).toEqual([
      {
        recordId: 'p8s4b-cp-allow',
        kind: 'human-override',
        scope: 'team',
        generation: 1,
        updatedAt: '2026-08-31T00:00:00.000Z',
        values: { model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] } },
      },
    ])
  })

  it('P4 an explicit team (autonomy) deny denies with full provenance', () => {
    expect(provDeny.effective).toEqual({ kind: 'deny' })
    expect(provDeny.deniedBy).toEqual({
      by: 'team',
      reason: 'teamDeny',
      layer: 'templateOverlay',
      origin: 'leader',
      recordId: 'p8s4b-cp-deny',
    })
  })

  it('P5 an absent capability denies with capabilityMissing + unavailable', () => {
    expect(provMissing.effective).toEqual({ kind: 'deny' })
    expect(provMissing.unavailable).toBe(true)
    expect(provMissing.deniedBy).toEqual({ by: 'external', reason: 'capabilityMissing' })
  })

  it('P5 an external hard deny wins with externalHardDeny', () => {
    expect(provHardDeny.effective).toEqual({ kind: 'deny' })
    expect(provHardDeny.unavailable).toBe(false)
    expect(provHardDeny.deniedBy).toEqual({ by: 'external', reason: 'externalHardDeny' })
  })

  it('P5 an external allow-list that removes everything wins with externalHardRemovedAll', () => {
    expect(provRemovedAll.effective).toEqual({ kind: 'deny' })
    expect(provRemovedAll.deniedBy).toEqual({ by: 'external', reason: 'externalHardRemovedAll' })
  })

  it('P6 a human override carries the humanOverride layer and human origin', () => {
    expect(provHuman.source).toEqual({ layer: 'humanOverride', origin: 'human', recordId: 'p8s4b-cp-human' })
    expect(provHuman.effective).toEqual({ kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] })
  })

  it('P6 an instance overlay determines the cell layer for the addressed instance', () => {
    expect(provInstance.source).toEqual({ layer: 'instanceOverlay', origin: 'member', recordId: 'p8s4b-cp-instance' })
    expect(provInstance.effective).toEqual({ kind: 'deny' })
  })

  it('P7 recordAdmitsCapability keys on the values payload', () => {
    expect(recordAdmitsCapability({ values: valuesWith }, 'model')).toBe(true)
    expect(recordAdmitsCapability({ values: valuesWithout }, 'model')).toBe(false)
    expect(recordAdmitsCapability({ values: valuesWithout }, 'mcp')).toBe(true)
  })
})
