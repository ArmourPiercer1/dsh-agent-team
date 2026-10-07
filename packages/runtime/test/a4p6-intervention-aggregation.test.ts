/**
 * A4-PR6 §6.A/6.B — the AGGREGATION law: one `intervention.list` projection
 * carries BOTH planes (control items first, then the governance-warning
 * adapter), and the planes stay disjoint in the merged list — a reviewer
 * item never carries `acknowledge`, a warning item never carries
 * `allow|deny|escalate`, and a reader failure on the CONTROL plane cannot
 * silence or reshape the WARNING plane (plane isolation under failure).
 *
 * Honesty note (freeze discipline): the warning source adapter shipped with
 * the 6.0 interface freeze (plan-named), so this named file PINS behavior
 * written slightly before it; the RED weight for every law below is carried
 * by the recorded mutation flips (flip the plane tags, the order, or the
 * ack fold and this file goes red — reported in the PR evidence).
 *
 * The CONTROL half runs on the REAL durable ControlService (p6t4 world) —
 * no hand-crafted case state, no fake authority fold.
 */
import { describe, expect, it } from 'vitest'

import { CONTROL_REQUEST_KINDS } from '../control/index.js'
import {
  INTERVENTION_ACTIONS,
  createGovernanceWarningSourceAdapter,
  projectInterventions,
} from '../intervention/index.js'
import type {
  InterventionItem,
  RequiredAuthorityFacts,
} from '../intervention/index.js'
import { createGovernanceWarningService } from '../governance-warning/service.js'
import type { GovernanceWarningDocumentView } from '../governance-warning/service.js'
import type { GovernanceEnvelopeView } from '../governance-warning/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

function facts(overrides: Partial<RequiredAuthorityFacts> = {}): RequiredAuthorityFacts {
  return {
    requiredAuthority: 'leader',
    reviewerAtOrAboveRequiredAuthority: true,
    desiredEffectWithinGrantCeiling: true,
    ceilingUndetermined: false,
    principalAlreadyActed: false,
    resolverExists: true,
    ...overrides,
  }
}

// --- the warning half: real service over a minimal durable double ----------

function envelope(
  rules: readonly (readonly [string, 'deny' | 'ask' | 'allow', 'exact' | 'subtree' | 'fingerprint', string])[],
): GovernanceEnvelopeView {
  return {
    rules: rules.map(([operationClass, effect, matcherKind, matcherKey]) => ({
      operationClass,
      effect,
      matcherKind,
      matcherKey,
    })),
  }
}

function makeWarningService() {
  const rows: { rootSessionId: string; factType: string; payload: Record<string, unknown>; createdAt: string }[] = []
  let clock = 0
  const now = () => new Date(Date.UTC(2026, 9, 21, 12, 0, clock++)).toISOString()
  const service = createGovernanceWarningService({
    writer: {
      writeObserved: async (rootSessionId, payload) => {
        rows.push({ rootSessionId, factType: 'governance-warning-observed', payload, createdAt: now() })
      },
      writeAcknowledged: async (rootSessionId, payload) => {
        rows.push({ rootSessionId, factType: 'governance-warning-acknowledged', payload, createdAt: now() })
      },
    },
    reader: {
      list: async (rootSessionId, factTypes) =>
        rows
          .filter((row) => row.rootSessionId === rootSessionId && factTypes.includes(row.factType as never))
          .map((row) => ({ factType: row.factType, payload: row.payload, createdAt: row.createdAt })),
    },
    docs: {
      async read(): Promise<GovernanceWarningDocumentView> {
        return {
          stage: 'v3',
          hardStatus: 'declared',
          blueprintContentHash: 'sha256:agg-hash',
          // Leader claims ALLOW over `work`; the Human hard ceiling DENIES it.
          leader: envelope([['file.write', 'allow', 'subtree', 'work']]),
          hard: envelope([['file.write', 'deny', 'subtree', 'work']]),
        }
      },
    },
    contains: (parent, point) => point === parent || point.startsWith(`${parent}/`),
    now,
  })
  return { service }
}

// The snapshot is a STRUCTURAL superset of the lane's source view (that is
// the no-import-edge design): the fold rides through with zero mapping.
const warningAdapterReader = (service: ReturnType<typeof makeWarningService>['service']) => ({
  list: (rootSessionId: string) => service.listWarnings(rootSessionId),
})

const AGG = await (async () => {
  const world = await createP6T4World('a4p6-agg-1', ['leader', 'worker'])
  try {
    const control = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-a4p6-agg', operationFingerprint: 'fp-a4p6-agg' })
    const created = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4p6-agg',
        correlation: scope.correlation,
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4p6 aggregated case',
    })
    if (created.kind !== 'leg') throw new Error('the aggregated case must have a leg')

    const { service } = makeWarningService()
    const gate = await service.checkStart(P6T4_ROOT) // mints the warning
    if (gate.status !== 'warning-required') throw new Error(`expected a warning, got ${gate.status}`)
    const warningId = gate.warningId
    const interventionId = gate.interventionId
    const adapters = [createGovernanceWarningSourceAdapter(warningAdapterReader(service))]
    const reader = () => Promise.resolve(facts())

    const merged = await projectInterventions({ rootSessionId: P6T4_ROOT, control, adapters, reader })
    const throwing = await projectInterventions({
      rootSessionId: P6T4_ROOT,
      control,
      adapters,
      reader: () => {
        throw new Error('ceiling unreadable')
      },
    })
    const afterAck = await service.acknowledge({
      teamSessionId: P6T4_ROOT,
      interventionId,
      callerPrincipalId: 'human-operator:test',
    })
    const merged2 = await projectInterventions({ rootSessionId: P6T4_ROOT, control, adapters, reader })
    return {
      merged,
      merged2,
      throwing,
      afterAck,
      warningId,
      interventionId,
      approvalInterventionId: `int-${created.leg.approvalCaseId ?? 'missing'}`,
      caller: leaderCaller(),
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

function warningItem(items: readonly InterventionItem[]): InterventionItem {
  const found = items.filter((item) => item.kind === 'warning')
  expect(found).toHaveLength(1)
  return found[0] as InterventionItem
}

describe('A4-PR6 aggregation — one list, two planes, zero vocabulary bleed', () => {
  it('control items come FIRST, the warning rides the same projection', () => {
    expect(AGG.merged.length).toBeGreaterThanOrEqual(2)
    const firstWarning = AGG.merged.findIndex((item) => item.kind === 'warning')
    const lastControl = AGG.merged.map((i) => i.kind).lastIndexOf('approval')
    expect(lastControl).toBeLessThan(firstWarning)
  })

  it('the warning item is informational forever and speaks ONLY {acknowledge}', () => {
    const item = warningItem(AGG.merged)
    expect(item.interventionId).toBe(AGG.interventionId)
    expect(item.responseBehavior).toBe('informational')
    expect(item.blockScope).toBeNull()
    expect([...item.legalActions]).toEqual(['acknowledge'])
    for (const reviewerAction of Object.values(INTERVENTION_ACTIONS)) {
      expect(item.legalActions).not.toContain(reviewerAction)
    }
    expect(item.source.kind).toBe('governance-warning')
    expect(item.source.id).toBe(AGG.warningId)
  })

  it('the reviewer item speaks the reviewer plane and NEVER {acknowledge}', () => {
    const item = AGG.merged.find((i) => i.interventionId === AGG.approvalInterventionId)
    expect(item).toBeDefined()
    // PR3 derivation law: an open approval leg the caller may wait on is
    // `wait-for-response` — the LAW this test needs is that the CONTROL arm
    // is never `informational` (only warnings are) and the WARNING arm is
    // never `wait-for-response`.
    expect(item?.responseBehavior).toBe('wait-for-response')
    expect(item?.responseBehavior).not.toBe('informational')
    expect(item?.legalActions.length).toBeGreaterThan(0)
    for (const action of item?.legalActions ?? []) {
      expect(Object.values(INTERVENTION_ACTIONS)).toContain(action)
    }
    expect(item?.legalActions).not.toContain('acknowledge')
  })

  it('acknowledgement reshapes the warning arm only (status flips, actions empty; the control arm is untouched)', () => {
    expect(AGG.afterAck.kind).toBe('acknowledged')
    const before = warningItem(AGG.merged)
    const after = warningItem(AGG.merged2)
    expect(before.status).toBe('open')
    expect(after.status).toBe('acknowledged')
    expect([...after.legalActions]).toEqual([])
    expect(after.fingerprint).toBe(before.fingerprint) // the SAME item, folded
    const controlBefore = AGG.merged.filter((i) => i.kind === 'approval')
    const controlAfter = AGG.merged2.filter((i) => i.kind === 'approval')
    expect(controlAfter.map((i) => i.legalActions)).toEqual(controlBefore.map((i) => i.legalActions))
  })

  it('plane isolation: a reader failure silences the CONTROL actions, never the WARNING plane', () => {
    const item = warningItem(AGG.throwing)
    expect([...item.legalActions]).toEqual(['acknowledge']) // warning survives the control-plane failure
    const control = AGG.throwing.filter((i) => i.kind === 'approval')
    expect(control.length).toBeGreaterThanOrEqual(1)
    for (const c of control) expect([...c.legalActions]).toEqual([])
  })

  it('warnings are TEAM-scoped: a subject-filtered projection still carries them', async () => {
    // (rebuild the world slice only if needed — reuse the durable service via
    // a fresh projection over the SAME service is not possible after teardown,
    // so the law is asserted on the projection contract directly here)
    const { service } = makeWarningService()
    await service.checkStart('team-other')
    const adapter = createGovernanceWarningSourceAdapter(warningAdapterReader(service))
    const items = await adapter.project({
      rootSessionId: 'team-other',
      subject: { kind: 'instance', instanceId: WORKER_ID },
    })
    expect(items).toHaveLength(1) // team-level items ignore the subject filter (they are the TEAM's)
  })
})
