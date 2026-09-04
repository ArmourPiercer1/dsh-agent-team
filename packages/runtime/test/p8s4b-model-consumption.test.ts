/**
 * P8-S4B M6 — unit tests for the durable MODEL CONSUMPTION (DevPlan P8-S
 * §18.1: the model must-close — the in-flight turn stays A, the authorized
 * mutation A->B, the NEXT real request uses B, and a host restart keeps B
 * because the selection re-reads the durable truth).
 *
 *  - D1 parseModelItem: the `provider/model` item vocabulary, fail-closed
 *     on everything malformed;
 *  - D2 the consumer rule over the REAL frozen stack: unspecified -> the
 *     world provider default (baseline); allow -> the durable item wins;
 *     malformed item -> unavailable; explicit deny / external -> no model
 *     (never silently allowed);
 *  - D3 pending-next-boundary carries the not-yet-applied durable records;
 *  - D4 the in-flight capture semantics of the TeamModelSelectionAdapter
 *     over a durable-backed source: beginRequest N captures A; a
 *     concurrent select(B) leaves the in-flight request A; the NEXT
 *     beginRequest captures B (the live "turn N stays A / turn N+1 is B"
 *     boundary, proven at the unit level — the static harness world's
 *     in-flight window is too short for a reliable live overlap).
 *
 * v1 envelope ruling (frozen resolver + `resolveActivationPolicy`): the
 * v1 activation context resolves with EMPTY blueprint/template envelopes,
 * so an autonomy-overlay GRANT is out-of-envelope and fails closed —
 * only DENYs (and human overrides, which invariant 34 exempts from the
 * envelope) can grant a cell. The grant fixtures below use
 * `human-override` accordingly.
 *
 * @module @dsh-agent-team/runtime/test/p8s4b-model-consumption
 */

import { describe, expect, it } from 'vitest'
import { resolveActivationPolicy } from '../activation/index.js'
import {
  modelConsumptionView,
  parseModelItem,
  resolveDurableModelSelection,
  TeamModelSelectionAdapter,
  type ModelSelection,
  type ModelSelectionSource,
} from '../agent-setup/model/index.js'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'

const ROOT = 'session-p8s4btest'
const INSTANCE = 'inst-p8s4btest1'
const EMPTY_EXTERNAL = { hard: {}, capabilityExists: {} }
const BASELINE: ModelSelection = { provider: 'p6t6-static', model: 'p6t6-model-v1' }
const MODEL_B = 'p6t6-static/p6t6-model-v2'

function override(
  recordId: string,
  values: Record<string, unknown>,
  generation = 1,
  kind: 'autonomy-overlay' | 'human-override' = 'autonomy-overlay',
): GovernanceOverrideRecord {
  const base: Record<string, unknown> = {
    schemaVersion: 1,
    kind,
    recordId,
    scope: 'team',
    rootSessionId: ROOT,
    values,
    generation,
    updatedAt: '2026-08-31T00:00:00.000Z',
  }
  if (kind === 'autonomy-overlay') base['origin'] = 'leader'
  return parseGovernanceOverride(base)
}

const rAllowB = override('p8s4b-md-allow', { model: { kind: 'allow', items: [MODEL_B] } }, 1, 'human-override')
const rAllowBad = override('p8s4b-md-bad', { model: { kind: 'allow', items: ['no-slash-item'] } }, 1, 'human-override')
const rDeny = override('p8s4b-md-deny', { model: { kind: 'deny' } }, 2)

const vBaseline = modelConsumptionView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [], external: EMPTY_EXTERNAL }),
  BASELINE,
)
const vAllowB = modelConsumptionView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rAllowB], external: EMPTY_EXTERNAL }),
  BASELINE,
  { overrides: [{ recordId: rAllowB.recordId, kind: rAllowB.kind, scope: rAllowB.scope, generation: rAllowB.generation, updatedAt: rAllowB.updatedAt, values: rAllowB.values }], appliedRecordIds: [rAllowB.recordId] },
)
const vAllowBPending = modelConsumptionView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rAllowB], external: EMPTY_EXTERNAL }),
  BASELINE,
  { overrides: [{ recordId: rAllowB.recordId, kind: rAllowB.kind, scope: rAllowB.scope, generation: rAllowB.generation, updatedAt: rAllowB.updatedAt, values: rAllowB.values }] },
)
const vBadItem = modelConsumptionView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rAllowBad], external: EMPTY_EXTERNAL }),
  BASELINE,
)
const vDeny = modelConsumptionView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rDeny], external: EMPTY_EXTERNAL }),
  BASELINE,
)
const vExternalMissing = modelConsumptionView(
  resolveActivationPolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    overrides: [rAllowB],
    external: { hard: {}, capabilityExists: { model: false } },
  }),
  BASELINE,
)

const fullBoundary = resolveDurableModelSelection({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllowB],
  external: EMPTY_EXTERNAL,
  baseline: BASELINE,
})

// D4 — the in-flight capture over a durable-backed source.
class DurableBackedSource implements ModelSelectionSource {
  private selection: ModelSelection | undefined
  current(): ModelSelection | undefined {
    return this.selection
  }
  select(next: ModelSelection): void {
    this.selection = next
  }
}
const source = new DurableBackedSource()
const MODEL_A: ModelSelection = { provider: 'p6t6-static', model: 'p6t6-model-v1' }
const MODEL_B_SELECTION: ModelSelection = { provider: 'p6t6-static', model: 'p6t6-model-v2' }
source.select(MODEL_A)
const adapter = new TeamModelSelectionAdapter(source)
const SID = 'session-p8s4btest-child'
adapter.install(SID)
const requestN = adapter.beginRequest(SID)
const selectionAtN = requestN.selection
source.select(MODEL_B_SELECTION)
const selectionAtNAfterMutation = requestN.selection
const requestN1 = adapter.beginRequest(SID)
const selectionAtN1 = requestN1.selection
requestN.complete()
requestN1.complete()
adapter.drop(SID)

describe('P8-S4B M6 durable model consumption', () => {
  it('D1 parses provider/model at the first slash', () => {
    expect(parseModelItem('p6t6-static/p6t6-model-v2')).toEqual({ provider: 'p6t6-static', model: 'p6t6-model-v2' })
    expect(parseModelItem('a/b/c')).toEqual({ provider: 'a', model: 'b/c' })
  })

  it('D1 fails closed on malformed items', () => {
    expect(parseModelItem('no-slash')).toBe(undefined)
    expect(parseModelItem('/model')).toBe(undefined)
    expect(parseModelItem('provider/')).toBe(undefined)
    expect(parseModelItem('')).toBe(undefined)
  })

  it('D2 the unspecified cell keeps the world provider default', () => {
    expect(vBaseline.selection).toEqual(BASELINE)
    expect(vBaseline.source.layer).toBe('unspecified')
    expect(vBaseline.deniedBy).toEqual({ by: 'team', reason: 'unspecifiedFailClosed' })
    expect(vBaseline.unavailable).toBe(false)
  })

  it('D2 an authorized mutation to B makes the next request use B', () => {
    expect(vAllowB.selection).toEqual({ provider: 'p6t6-static', model: 'p6t6-model-v2' })
    expect(vAllowB.source).toEqual({ layer: 'humanOverride', origin: 'human', recordId: 'p8s4b-md-allow' })
    expect(vAllowB.deniedBy).toBe(undefined)
  })

  it('D2 a malformed durable item is unavailable, never guessed', () => {
    expect(vBadItem.selection).toBe(undefined)
    expect(vBadItem.unavailable).toBe(true)
  })

  it('D2 an explicit team deny removes the model entirely', () => {
    expect(vDeny.selection).toBe(undefined)
    expect(vDeny.unavailable).toBe(false)
    expect(vDeny.deniedBy).toEqual({
      by: 'team',
      reason: 'teamDeny',
      layer: 'templateOverlay',
      origin: 'leader',
      recordId: 'p8s4b-md-deny',
    })
  })

  it('D2 an absent capability removes the model with unavailable provenance', () => {
    expect(vExternalMissing.selection).toBe(undefined)
    expect(vExternalMissing.unavailable).toBe(true)
    expect(vExternalMissing.deniedBy).toEqual({ by: 'external', reason: 'capabilityMissing' })
  })

  it('D3 pending-next-boundary carries the not-yet-applied record', () => {
    expect(vAllowB.pendingNextBoundary).toEqual([])
    expect(vAllowBPending.pendingNextBoundary.length).toBe(1)
    expect(vAllowBPending.pendingNextBoundary[0]?.recordId).toBe('p8s4b-md-allow')
  })

  it('D3 the full boundary resolution re-derives B from the durable truth', () => {
    expect(fullBoundary.view.selection).toEqual({ provider: 'p6t6-static', model: 'p6t6-model-v2' })
    expect(fullBoundary.view.source.recordId).toBe('p8s4b-md-allow')
  })

  it('D4 the in-flight request N keeps A across a concurrent select(B)', () => {
    expect(selectionAtN).toEqual(MODEL_A)
    expect(selectionAtNAfterMutation).toEqual(MODEL_A)
  })

  it('D4 the next request N+1 uses B', () => {
    expect(selectionAtN1).toEqual(MODEL_B_SELECTION)
  })
})
