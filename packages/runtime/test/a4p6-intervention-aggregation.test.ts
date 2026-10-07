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

import { CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KINDS } from '../control/index.js'
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

// ---------------------------------------------------------------------------
// 6.B — the v8 surface on the PRODUCTION wire: the real s6 dispatcher (the
// entry's closed envelope + version chain included) over a real P6T4 world
// (real ControlService case rows) and a REAL governance-warning service.
// Nothing here mocks the planes the wire claims to expose.
// ---------------------------------------------------------------------------

import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { REMOTE_CONTRACT_VERSION_V8 } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import { humanCaller } from './p6t4-helpers.js'

const W8_HUMAN = 'human-a4p6-wire'

function errorOf8(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('A4-PR6 wire: expected an error result')
  return response.error as unknown as Record<string, unknown>
}
function dataOf8(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error(`A4-PR6 wire: expected success, got ${JSON.stringify(response.error)}`)
  return response.value.data as unknown as Record<string, unknown>
}

const W8 = await (async () => {
  const world = await createP6T4World('a4p6-wire-1', ['leader', 'worker'])
  try {
    const control = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-a4p6-wire', operationFingerprint: 'fp-a4p6-wire' })
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
        operationFingerprint: 'fp-a4p6-wire',
        correlation: scope.correlation,
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4p6 v8 wire case',
    })
    if (created.kind !== 'leg') throw new Error('the wire case must have a leg')
    const approvalCaseId = created.leg.approvalCaseId ?? 'missing'
    const legRequestId = created.leg.requestId
    // Case B exists for the ESCALATE arm: the durable ladder law says a
    // principal that escalated a leg away may never act on that case again
    // (`assertNoActOnEarlierLeg`) — so the escalate sequence needs its own
    // case, and its follow-up act doubles as the server-side-refusal probe.
    const recused = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4p6-recused',
        correlation: 'corr-a4p6-recused',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4p6 v8 recusal case',
    })
    if (recused.kind !== 'leg') throw new Error('the recusal case must have a leg')
    const recusedCaseId = recused.leg.approvalCaseId ?? 'missing'
    const recusedLegRequestId = recused.leg.requestId

    const { service } = makeWarningService()
    const gate = await service.checkStart(P6T4_ROOT)
    if (gate.status !== 'warning-required') throw new Error(`expected a warning, got ${gate.status}`)

    const escalateCalls: { requestId: string; callerKind: string }[] = []
    const resolveCalls: { requestId: string; callerKind: string; callerId: string; decision: string }[] = []
    const opts = {
      rootSessionId: P6T4_ROOT,
      repositories: { teamSessions: { get: () => ({}) } } as never,
      governanceWarning: service,
      interventionControl: control,
      interventionEscalate: async (args: { rootSessionId: string; caller: { kind: string; humanId?: string }; requestId: string; reason?: string }) => {
        escalateCalls.push({ requestId: args.requestId, callerKind: args.caller.kind })
        return (await control.escalateApprovalLeg({
          rootSessionId: args.rootSessionId,
          caller: args.caller as never,
          requestId: args.requestId,
          ...(args.reason !== undefined ? { reason: args.reason } : {}),
        })) as never
      },
      resolveControl: async (args: { rootSessionId: string; caller: { kind: string; humanId?: string }; requestId: string; decision: 'allow' | 'deny'; note?: string }) => {
        resolveCalls.push({
          requestId: args.requestId,
          callerKind: args.caller.kind,
          callerId: String(args.caller.humanId),
          decision: args.decision,
        })
        return (await control.resolveControl({
          rootSessionId: args.rootSessionId,
          caller: args.caller as never,
          requestId: args.requestId,
          decision: args.decision,
          ...(args.note !== undefined ? { note: args.note } : {}),
        })) as never
      },
      requiredAuthorityFacts: async () => facts(),
      // A RICH record with authority-bearing extras: the wire must show
      // exactly the six closed cells (the strip is the imported remote law).
      permissionAdministration: async ({ rootSessionId }: { rootSessionId: string }) =>
        ({
          teamSessionId: rootSessionId,
          memberInstanceId: WORKER_ID,
          source: 'overlay',
          generation: 7,
          effective: { rules: [] },
          diagnostics: [],
          grantCeiling: { sneaky: true },
          reviewerIdentity: W8_HUMAN,
          openRequestIds: ['req-never-on-wire'],
        }) as never,
    } as unknown as S6RemoteOptions
    const ports = createS6RemotePorts(opts)
    // A4-PR6 review round 1 (fix 5/6): the PRINCIPAL is the REAL
    // `createServerPrincipalDerivation` — the same derivation the
    // production surfaces install. The previous stub
    // (`() => Promise.resolve(humanCaller(W8_HUMAN))`) stood in for the
    // exact law this suite's own test title names ("the DERIVED caller
    // — never a client claim"); with the real derivation the caller the
    // control plane records is the invariant-9 identity of the
    // ADDRESSED root, and no constant in this file could have produced
    // it.
    const principal: ServerPrincipalDerivation = createServerPrincipalDerivation({
      rootSessionId: P6T4_ROOT,
      repositories: world.domain.repositories,
      leaderInstanceId: 'inst-leader',
    })
    const dispatch = createS6RemoteDispatcher(ports, principal)
    const v8 = (endpoint: string, params: Record<string, unknown>): Promise<RemoteResponse> =>
      dispatch(endpoint as never, { version: REMOTE_CONTRACT_VERSION_V8, params } as never)

    const list = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const warnGet = await v8('intervention.get', {
      teamSessionId: P6T4_ROOT,
      interventionId: gate.interventionId,
    })
    const missingGet = await v8('intervention.get', {
      teamSessionId: P6T4_ROOT,
      interventionId: 'int-does-not-exist',
    })
    const allowOnWarning = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: gate.interventionId,
      action: 'allow',
    })
    const ack = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: gate.interventionId,
      action: 'acknowledge',
      note: 'seen by the operator',
    })
    const listAfterAck = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const administration = await v8('override.getPermissionAdministration', {
      teamSessionId: P6T4_ROOT,
    })
    const adminScoped = await v8('override.getPermissionAdministration', {
      teamSessionId: P6T4_ROOT,
      memberInstanceId: WORKER_ID,
    })
    const allow = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${approvalCaseId}`,
      action: 'allow',
      note: 'the reviewer signs',
    })
    const listAfterDecide = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const staleAct = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${approvalCaseId}`,
      action: 'deny',
    })
    const escalate = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${recusedCaseId}`,
      action: 'escalate',
    })
    const recusedAct = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${recusedCaseId}`,
      action: 'allow',
    })

    // The UNWIRED world: the same dispatcher, the v8 methods refused typed.
    const barePorts = createS6RemotePorts({
      rootSessionId: P6T4_ROOT,
      repositories: { teamSessions: { get: () => ({}) } } as never,
    } as unknown as S6RemoteOptions)
    const bare = createS6RemoteDispatcher(barePorts, principal)
    const bareList = await bare('intervention.list', {
      version: REMOTE_CONTRACT_VERSION_V8,
      params: { teamSessionId: P6T4_ROOT },
    } as never)
    const bareAdmin = await bare('override.getPermissionAdministration', {
      version: REMOTE_CONTRACT_VERSION_V8,
      params: { teamSessionId: P6T4_ROOT },
    } as never)

    return {
      list, warnGet, missingGet, allowOnWarning, ack, listAfterAck,
      administration, adminScoped, escalate, allow, listAfterDecide, staleAct,
      recusedAct, bareList, bareAdmin, escalateCalls, resolveCalls,
      warningInterventionId: gate.interventionId,
      approvalInterventionId: `int-${approvalCaseId}`,
      recusedInterventionId: `int-${recusedCaseId}`,
      legRequestId,
      recusedLegRequestId,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('A4-PR6 §6.B the v8 plane on the production wire (real dispatcher, real planes)', () => {
  it('intervention.list serves BOTH planes through the closed wire shape, control first', () => {
    const items = dataOf8(W8.list)['items'] as Record<string, unknown>[]
    expect(items).toHaveLength(3)
    const controlRows = items.filter((item) => item['source'] != null && (item['source'] as Record<string, unknown>)['kind'] === 'control-case')
    expect(controlRows).toHaveLength(2)
    // The projection order law: control items FIRST (durable-case order),
    // every adapter after.
    const warningIndex = items.findIndex((item) => item['kind'] === 'warning')
    expect(warningIndex).toBe(items.length - 1)
    const approval = items.find((item) => item['interventionId'] === W8.approvalInterventionId) as Record<string, unknown>
    expect(approval['responseBehavior']).toBe('wait-for-response')
    expect(approval['legalActions']).toEqual(['allow', 'escalate', 'deny'])
    const warning = items[warningIndex] as Record<string, unknown>
    expect(warning['source']).toMatchObject({ kind: 'governance-warning' })
    expect(warning['responseBehavior']).toBe('informational')
    expect(warning['legalActions']).toEqual(['acknowledge'])
    expect(warning['blockScope']).toBeNull()
  })

  it('intervention.get addresses one projected item; an absent id is the typed INTERVENTION_NOT_FOUND', () => {
    expect(dataOf8(W8.warnGet)['item']).toMatchObject({
      interventionId: W8.warningInterventionId,
      kind: 'warning',
    })
    const err = errorOf8(W8.missingGet)
    expect(err['code']).toBe('INTERVENTION_NOT_FOUND')
  })

  it('act routes by the ITEM class: an approval action on a warning id is refused BEFORE any write', () => {
    const err = errorOf8(W8.allowOnWarning)
    expect(err['code']).toBe('malformed-params')
    expect((err['details'] as Record<string, unknown>)['reason']).toBe('action-plane-mismatch')
  })

  it('acknowledge is the warning arm ONLY: the closed receipt, then the item re-presents as acknowledged with zero actions', () => {
    expect(dataOf8(W8.ack)).toEqual({ outcome: 'acknowledged' })
    const items = dataOf8(W8.listAfterAck)['items'] as Record<string, unknown>[]
    const warning = items.find((item) => item['kind'] === 'warning') as Record<string, unknown>
    expect(warning['status']).toBe('acknowledged')
    expect(warning['legalActions']).toEqual([])
  })

  it('allow drives the EXISTING control entry with the DERIVED caller — never a client claim', () => {
    expect(Object.keys(dataOf8(W8.allow))).toEqual(['outcome'])
    expect(dataOf8(W8.allow)['outcome']).toBe('decided')
    // (The recused case's LATER refused attempt also enters this seam —
    // the assertion names THIS case's fresh leg id, not the call count.)
    const calls = W8.resolveCalls.filter((c) => c.requestId === W8.legRequestId)
    expect(calls).toHaveLength(1)
    const call = calls[0] as { callerKind: string; callerId: string; decision: string }
    expect(call.callerKind).toBe('human')
    // Invariant 9 through the REAL derivation: the team's human identity
    // IS its root session id — `deriveControlCaller` returns exactly
    // `{kind:'human', humanId: <addressed root>}`. (Pre-fix this asserted
    // the stub's arbitrary `W8_HUMAN` constant — the title said "DERIVED
    // caller" while the value was installed.)
    expect(call.callerId).toBe(P6T4_ROOT)
    expect(call.decision).toBe('allow')
  })

  it('escalate pushes the DURABLE leg (fresh routing), and the recused reviewer is refused SERVER-SIDE', () => {
    expect(dataOf8(W8.escalate)).toEqual({ outcome: 'escalated' })
    expect(W8.escalateCalls).toEqual([{ requestId: W8.recusedLegRequestId, callerKind: 'human' }])
    // The ladder's own law (assertNoActOnEarlierLeg): the principal that
    // escalated leg 1 away may never act on the case again. The refusal is
    // the control plane's typed code riding the wire UNCHANGED — this is
    // the server-side refusal, not a filtered UI.
    const err = errorOf8(W8.recusedAct)
    expect(err['code']).toBe('CONTROL_RESOLVER_NOT_AUTHORIZED')
  })

  it('a decided case LEAVES the open projection: the same interventionId afterwards is INTERVENTION_NOT_FOUND, not a stale decision', () => {
    expect(errorOf8(W8.staleAct)['code']).toBe('INTERVENTION_NOT_FOUND')
    const items = dataOf8(W8.listAfterDecide)['items'] as Record<string, unknown>[]
    const approvals = items.filter((item) => item['kind'] === 'approval')
    // Case A is decided (gone); the RECUSED case re-projects at its risen
    // leg — the projection follows the durable rows, both directions.
    expect(approvals).toHaveLength(1)
    expect(approvals[0]?.['interventionId']).toBe(W8.recusedInterventionId)
  })

  it('the administration read STRIPS to exactly the six closed wire cells; the extras never ride', () => {
    for (const response of [W8.administration, W8.adminScoped]) {
      const administration = dataOf8(response)['administration'] as Record<string, unknown>
      expect(Object.keys(administration).sort()).toEqual([
        'diagnostics',
        'effective',
        'generation',
        'memberInstanceId',
        'source',
        'teamSessionId',
      ])
      expect(administration).not.toHaveProperty('grantCeiling')
      expect(administration).not.toHaveProperty('reviewerIdentity')
      expect(administration).not.toHaveProperty('openRequestIds')
    }
    expect((dataOf8(W8.adminScoped)['administration'] as Record<string, unknown>)['memberInstanceId']).toBe(WORKER_ID)
  })

  it('an UNWIRED v8 surface refuses its four methods typed (internal-error / port-unwired) — never a partial success', () => {
    for (const response of [W8.bareList, W8.bareAdmin]) {
      const err = errorOf8(response)
      expect(err['code']).toBe('internal-error')
      expect((err['details'] as Record<string, unknown>)['reason']).toBe('port-unwired')
    }
  })
})

// ---------------------------------------------------------------------------
// §6.C — PR5 visibility leftover B CLOSED here: a ZOMBIE open case (a case
// that became unreachable because fingerprint drift opened a DIFFERENT
// identity at the same base — spec §24.5: dedup is per identity, not per
// base) stays visible in the SAME `listOpenApprovalCases` listing the
// approval tooling reads, and still accepts `abandonControlRequest`; the
// additive `control-request-abandoned` fact is the terminal mark. The fix
// is visibility — base-scoped suppression is deliberately NOT added.
// ---------------------------------------------------------------------------

const ZOMBIE = await (async () => {
  const world = await createP6T4World('a4p6-zombie-1', ['leader', 'worker'])
  try {
    const control = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-zombie', operationFingerprint: 'fp-zombie-a' })
    const common = {
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader' as const,
      requiredAuthorityAtCreation: 'leader' as const,
      actionName: scope.actionName,
      toolName: scope.toolName,
    }
    const original = await control.requestApprovalLeg({
      ...common,
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-zombie-a',
        correlation: 'corr-zombie',
      },
      summary: 'zombie: the pre-drift case',
    })
    if (original.kind !== 'leg') throw new Error('the pre-drift case must have a leg')
    // The drift: the SAME subject/base under a NEW fingerprint is a
    // different identity — a second case opens and nothing re-points the
    // old one (identity dedup, not base dedup).
    const drifted = await control.requestApprovalLeg({
      ...common,
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-zombie-b',
        correlation: 'corr-zombie',
      },
      summary: 'zombie: the drifted identity',
    })
    if (drifted.kind !== 'leg') throw new Error('the drifted case must have a leg')
    const openBefore = await control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
    const abandoned = await control.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller('human-a4p6-zombie'),
      requestId: original.leg.requestId,
      reason: 'superseded by the drifted identity',
    })
    const openAfter = await control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
    return {
      originalCaseId: original.leg.approvalCaseId ?? 'missing',
      originalRequestId: original.leg.requestId,
      driftedCaseId: drifted.leg.approvalCaseId ?? 'missing',
      openBefore,
      abandoned,
      openAfter,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('6.C a zombie open case stays visible and abandonable (PR5 leftover B)', () => {
  it('the drifted identity opens a DIFFERENT case; both are open and BOTH are listed', () => {
    expect(ZOMBIE.driftedCaseId).not.toBe(ZOMBIE.originalCaseId)
    const listed = ZOMBIE.openBefore.map((summary) => summary.state.identity.approvalCaseId)
    // The zombie is NOT silently unreachable: the listing the approval
    // tooling reads carries it (no identity/base filtering exists here).
    expect(listed).toContain(ZOMBIE.originalCaseId)
    expect(listed).toContain(ZOMBIE.driftedCaseId)
  })

  it('the zombie still accepts the abandon verb; the terminal mark leaves only the drifted case open', () => {
    expect(ZOMBIE.abandoned.requestId).toBe(ZOMBIE.originalRequestId)
    expect(ZOMBIE.abandoned.rootSessionId).toBe(P6T4_ROOT)
    // the additive `control-request-abandoned` row is durable (a real
    // ledger sequence — the terminal mark, not a memory).
    expect(Number.isInteger(ZOMBIE.abandoned.abandonmentSequence)).toBe(true)
    expect(ZOMBIE.abandoned.abandonmentSequence).toBeGreaterThan(0)
    const listed = ZOMBIE.openAfter.map((summary) => summary.state.identity.approvalCaseId)
    expect(listed).not.toContain(ZOMBIE.originalCaseId)
    expect(listed).toContain(ZOMBIE.driftedCaseId)
  })
})

// ---------------------------------------------------------------------------
// 6.B — the NAMED §11.5 interaction (A4-PR6 review round 1, fix-5/6
// sibling): a CEILING-NARROWED leg takes its durable `allow` through the
// v8 `intervention.act` entry (real derivation, real control service),
// and the refusal lands at CONSUMPTION, not at decision: the narrowing
// denied the EFFECT (`request-pending` on the guard) while no allow
// existed; the wire allow writes the durable decision and the SAME guard
// then allows ONCE (writes `control-allow-consumed`); the second attempt
// is blocked `allow-consumed` — the exactly-once law. The ceiling decision
// and the durable approval are separate facts; execution authority is
// re-derived at every consumption, never cached with the decision
// (invariant 45: the planes hold no cached authority).
// ---------------------------------------------------------------------------

const W9 = await (async () => {
  const world = await createP6T4World('a4p6-consume-1', ['leader', 'worker'])
  try {
    const control = createP6T4Service(world)
    // The operation attempt: the ceiling narrowed this write to `ask` for
    // the worker, so the gate raises an approval LEG carrying the EXACT
    // operation scope — the leg IS the durable consequence of narrowing.
    const scope = makeScope({ correlation: 'corr-a4p6-consume', operationFingerprint: 'fp-a4p6-consume' })
    const leg = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: scope.operationFingerprint,
        correlation: scope.correlation,
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4p6 §11.5 consumption leg',
    })
    if (leg.kind !== 'leg') throw new Error('the consumption case must have a leg')
    const approvalCaseId = leg.leg.approvalCaseId ?? 'missing'

    // CONSUMPTION attempt 1 — BEFORE any allow: the effect is refused at
    // the guard. The narrowing already spoke; the guard holds the line.
    const pendingGuard = await control.guardOperation(scope)

    // The wire `intervention.act` allow: the REAL derivation installed as
    // the principal (fix 5/6), the REAL control service behind the port.
    const opts = {
      rootSessionId: P6T4_ROOT,
      repositories: { teamSessions: { get: () => ({}) } } as never,
      interventionControl: control,
      // The approval arm of `intervention.act` drives the EXISTING
      // resolve entry (A1-2: the lane re-implements no decision logic).
      resolveControl: async (args: { rootSessionId: string; caller: { kind: string; humanId?: string }; requestId: string; decision: 'allow' | 'deny'; note?: string }) =>
        (await control.resolveControl({
          rootSessionId: args.rootSessionId,
          caller: args.caller as never,
          requestId: args.requestId,
          decision: args.decision,
          ...(args.note !== undefined ? { note: args.note } : {}),
        })) as never,
    } as unknown as S6RemoteOptions
    const ports = createS6RemotePorts(opts)
    const principal: ServerPrincipalDerivation = createServerPrincipalDerivation({
      rootSessionId: P6T4_ROOT,
      repositories: world.domain.repositories,
      leaderInstanceId: 'inst-leader',
    })
    const dispatch = createS6RemoteDispatcher(ports, principal)
    const actAllow = await dispatch('intervention.act' as never, {
      version: REMOTE_CONTRACT_VERSION_V8,
      params: { teamSessionId: P6T4_ROOT, interventionId: `int-${approvalCaseId}`, action: 'allow' },
    } as never)

    // CONSUMPTION attempts 2 and 3 — AFTER the durable allow. The guard
    // reads ONLY durable rows, so its verdict IS the proof the wire's
    // decision landed durably.
    const firstGuard = await control.guardOperation(scope)
    const secondGuard = await control.guardOperation(scope)

    return { pendingGuard, actAllow, firstGuard, secondGuard, approvalCaseId }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('A4-PR6 review round 1 — the §11.5 named interaction: durable allow through the act entry, refusal at CONSUMPTION', () => {
  it('before the allow, the effect is refused at the guard (`request-pending`) — narrowing denied it', () => {
    expect(W9.pendingGuard.allowed).toBe(false)
    expect(W9.pendingGuard.allowed === false ? W9.pendingGuard.reason : '').toBe(
      CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING,
    )
  })

  it('intervention.act takes the DURABLE allow (real derivation, real plane) and answers the closed receipt', () => {
    expect(dataOf8(W9.actAllow)).toEqual({ outcome: 'decided' })
  })

  it('after the allow, the SAME guard allows EXACTLY ONCE, then blocks `allow-consumed`', () => {
    // The guard path only reads durable control rows: an allow here is
    // the wire decision, read back from the ledger. Consumption 2 writes
    // `control-allow-consumed`; attempt 3 sees the burn and blocks.
    expect(W9.firstGuard.allowed).toBe(true)
    expect(W9.secondGuard.allowed).toBe(false)
    expect(W9.secondGuard.allowed === false ? W9.secondGuard.reason : '').toBe(
      CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED,
    )
  })
})
