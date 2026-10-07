/**
 * A4 escalate-act truth (`fix/a4-escalate-receipt-truth`) — what an `escalate`
 * act REALLY does at a `human-user` leg in a build with no Human Admin
 * resolver, measured through the PRODUCTION entry and pinned as a record.
 *
 * THE MEASUREMENT (raw prints below, captured to
 * `dev/agent-workflow/evidence/a4-escalate-truth/`): the v8 `intervention.act`
 * escalate arm is driven through the real dispatcher (`createS6RemoteDispatcher`
 * + `createS6RemotePorts` + the real server-principal derivation), over the
 * REAL durable ControlService, behind the same escalate closure root.ts:3661
 * installs in production (same call, same return). The successor of
 * `human-user` is `human-admin`, and
 * `CONTROL_UNRESOLVABLE_AUTHORITIES = ['human-admin']`
 * (`control/types.ts:341`, `hasAuthorityResolver` :352) means the service
 * mints NO risen leg: `escalateApprovalLeg` closes the leg (terminal `deny`
 * reason `escalated`), records the escalation fact, skips the risen leg, and
 * returns `caseOutcome: 'authority-unavailable'` (`control/service.ts:4267-4272`,
 * ADR A1-12 / spec 11.6). The case CLOSES — it is not destroyed: every leg
 * row stays durable (audit F2's durability law), nothing is pending, nothing
 * consumes, and the inline waiter settles on the deny (A5-5).
 *
 * THE DEFECT THIS FILE PINS AND FIXES (ledger half): the terminate branch wrote
 * its terminal deny WITHOUT `terminalReason`, while the closed vocabulary
 * already contains `resolver-unavailable` ("No resolver exists for the
 * authority this case needs (ADR A1-12, spec 11.6)", `control/types.ts`
 * CONTROL_LEG_TERMINAL_REASONS) and the born-terminal twin close
 * (`requestApprovalLeg` -> `closeZeroReviewCaseTransactionally`,
 * `service.ts:4013`) already stamps it. `ControlDecisionRecord.terminalReason`
 * (A2-8) is the declared destination for exactly this close; the escalation
 * close silently omitted it, so the durable record read only
 * `deny · escalated` — indistinguishable from a rise for every reader that
 * does not also hold the case fold.
 *
 * THE BLOCKER THIS FILE PINS BUT DOES NOT FIX (receipt half): the act lane
 * discards the service outcome and answers `{ outcome: 'escalated' }`
 * (`src/plugin/s6-remote.ts:3770-3776`) even when the case terminated. The
 * truthful value cannot be expressed: `REMOTE_INTERVENTION_ACT_OUTCOMES`
 * (`packages/remote/src/contracts/types.ts:485-490`) is the CLOSED v8 wire set
 * `['decided','escalated','acknowledged','already-acknowledged']` — adding a
 * termination value changes what the frozen v8 `intervention.act` may return
 * (both lanes re-validate against the set: `s6-remote.ts:4472`,
 * `remote/src/handlers/intervention.ts:202`). Wire-version decisions belong to
 * the coordinator and the human, so the misrepresenting receipt is pinned
 * EXACTLY AS IT IS, with the disclosure below: this pin exists to go red when
 * that decision lands, not to bless the value.
 *
 * The offer of `escalate` at this leg is a settled decision, not a defect:
 * `intervention/derivation.ts:310-317` reads the offer off the FROZEN
 * successor table, never off resolver availability (2026-10-08 ruling; the
 * hide-the-button proposal is withdrawn). Nothing here changes the derivation.
 */
import { describe, expect, it } from 'vitest'

import { CONTROL_REQUEST_KINDS } from '../control/index.js'
import type { ControlEscalationOutcome } from '../control/index.js'
import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { REMOTE_CONTRACT_VERSION_V8 } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  constantAuthorityRecheck,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'
import type { RequiredAuthorityFacts } from '../intervention/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The A1-14 authority point every v3 operation case carries (fixture value). */
const AUTHORITY_SCOPE = {
  operationClass: 'fs.write',
  matcher: { kind: 'exact', resource: 'a4-esc-truth:fileA' },
} as const

function facts(overrides: Partial<RequiredAuthorityFacts> = {}): RequiredAuthorityFacts {
  return {
    requiredAuthority: 'human-user',
    reviewerAtOrAboveRequiredAuthority: true,
    desiredEffectWithinGrantCeiling: true,
    ceilingUndetermined: false,
    principalAlreadyActed: false,
    resolverExists: true,
    ...overrides,
  }
}

function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error(`expected success, got ${JSON.stringify(response.error)}`)
  return response.value.data as unknown as Record<string, unknown>
}

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('expected a typed error, got success')
  return response.error as unknown as Record<string, unknown>
}

/** One request/decision/escalation row the durable ledger carries for a case. */
interface CaseRow {
  readonly factType: string
  readonly payload: Record<string, unknown>
}

const MEASUREMENT = await (async () => {
  const world = await createP6T4World('a4-esc-truth-1', ['leader', 'worker'])
  try {
    const control = createP6T4Service(world, {
      authorityRevalidation: constantAuthorityRecheck().port,
    })
    const scope = makeScope({
      correlation: 'corr-a4-esc-truth-wire',
      operationFingerprint: 'fp-a4-esc-truth-wire',
      authorityScope: AUTHORITY_SCOPE,
    })
    // THE case the wire lane escalates: a leg whose reviewer IS the Human
    // User (so it is OPEN and reviewable — `hasAuthorityResolver('human-user')`
    // is true), from which the frozen ladder's ONLY successor is Human Admin.
    const wireCase = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'human-user',
      requiredAuthorityAtCreation: 'human-user',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4-esc-truth-wire',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-esc-truth-wire',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 escalate-act truth: wire-lane case',
    })
    if (wireCase.kind !== 'leg') throw new Error('the human-user leg must be open')
    const wireCaseId = wireCase.leg.approvalCaseId ?? 'missing'
    const wireLegRequestId = wireCase.leg.requestId

    // The SAME escalation driven at the service level, for the caller-visible
    // outcome the wire receipt discards (measurement of what the receipt
    // SHOULD be allowed to say).
    const serviceCase = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'human-user',
      requiredAuthorityAtCreation: 'human-user',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4-esc-truth-direct',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-esc-truth-direct',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 escalate-act truth: service-level case',
    })
    if (serviceCase.kind !== 'leg') throw new Error('the second human-user leg must be open')
    const serviceCaseId = serviceCase.leg.approvalCaseId ?? 'missing'

    // The CONTROL arm of the fix: a leg whose successor HAS a resolver (a
    // `leader` leg rising to Human User) must NOT gain a terminalReason —
    // absence keeps its A2-8 meaning (the case continues at the rung above).
    const risenCase = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4-esc-truth-risen',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-esc-truth-risen',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 escalate-act truth: risen-control case',
    })
    if (risenCase.kind !== 'leg') throw new Error('the leader leg must be open')
    const risenCaseId = risenCase.leg.approvalCaseId ?? 'missing'
    const risenOutcome: ControlEscalationOutcome = await control.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: risenCase.leg.requestId,
    })

    // The PRODUCTION assembly (root.ts:3659-3669): the control source is the
    // SAME service, and the escalate closure is the SAME one-liner — call the
    // service, return its record. The lane's law is what is under test.
    const opts = {
      rootSessionId: P6T4_ROOT,
      repositories: { teamSessions: { get: () => ({}) } } as never,
      interventionControl: control,
      interventionEscalate: async (args: {
        rootSessionId: string
        caller: { kind: string; humanId?: string }
        requestId: string
        reason?: string
      }) =>
        (await control.escalateApprovalLeg({
          rootSessionId: args.rootSessionId,
          caller: args.caller as never,
          requestId: args.requestId,
          ...(args.reason !== undefined ? { reason: args.reason } : {}),
        })) as never,
      requiredAuthorityFacts: async () => facts(),
    } as unknown as S6RemoteOptions
    const ports = createS6RemotePorts(opts)
    const principal: ServerPrincipalDerivation = createServerPrincipalDerivation({
      rootSessionId: P6T4_ROOT,
      repositories: world.domain.repositories,
      leaderInstanceId: 'inst-leader',
    })
    const dispatch = createS6RemoteDispatcher(ports, principal)
    const v8 = (endpoint: string, params: Record<string, unknown>): Promise<RemoteResponse> =>
      dispatch(endpoint as never, { version: REMOTE_CONTRACT_VERSION_V8, params } as never)

    const listBefore = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const act = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${wireCaseId}`,
      action: 'escalate',
      note: 'above my rung — send it up',
    })
    const listAfter = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const getAfter = await v8('intervention.get', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${wireCaseId}`,
    })
    const directOutcome: ControlEscalationOutcome = await control.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: serviceCase.leg.requestId,
    })

    const stateAfter = await control.listControlState(P6T4_ROOT)
    const ledgerRows = world.domain.repositories.ledger.list()
    const wireCaseRows: CaseRow[] = ledgerRows
      .filter((entry) => {
        const payload = entry.payload as Record<string, unknown>
        return (
          payload['approvalCaseId'] === wireCaseId ||
          payload['requestId'] === wireLegRequestId ||
          payload['previousRequestId'] === wireLegRequestId
        )
      })
      .map((entry) => ({ factType: entry.factType, payload: entry.payload as Record<string, unknown> }))
    const directCaseRows: CaseRow[] = ledgerRows
      .filter((entry) => {
        const payload = entry.payload as Record<string, unknown>
        return (
          payload['approvalCaseId'] === serviceCaseId ||
          payload['requestId'] === serviceCase.leg.requestId ||
          payload['previousRequestId'] === serviceCase.leg.requestId
        )
      })
      .map((entry) => ({ factType: entry.factType, payload: entry.payload as Record<string, unknown> }))
    const risenCaseRows: CaseRow[] = ledgerRows
      .filter((entry) => {
        const payload = entry.payload as Record<string, unknown>
        return (
          payload['approvalCaseId'] === risenCaseId ||
          payload['requestId'] === risenCase.leg.requestId ||
          payload['previousRequestId'] === risenCase.leg.requestId
        )
      })
      .map((entry) => ({ factType: entry.factType, payload: entry.payload as Record<string, unknown> }))

    const itemsOf = (response: RemoteResponse): Record<string, unknown>[] =>
      (dataOf(response)['items'] as Record<string, unknown>[] | undefined) ?? []

    return {
      wireCaseId,
      wireLegRequestId,
      itemBefore: itemsOf(listBefore).find(
        (item) => item['interventionId'] === `int-${wireCaseId}`,
      ),
      act,
      listAfterIds: itemsOf(listAfter).map((item) => item['interventionId']),
      getAfter,
      directOutcome,
      stateAfter: {
        pendingForCases: stateAfter.requests.filter(
          (row) =>
            row.status === 'pending' &&
            (row.approvalCaseId === wireCaseId || row.approvalCaseId === serviceCaseId),
        ).length,
        legRowsForWireCase: stateAfter.requests.filter(
          (row) => row.approvalCaseId === wireCaseId,
        ).length,
        consumptions: stateAfter.consumptions.length,
      },
      wireCaseRows,
      directCaseRows,
      risenCaseId,
      risenOutcome,
      risenCaseRows,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

const BANNER = '=== A4-ESCALATE-TRUTH MEASUREMENT ==='

describe('a4 escalate-act truth: escalate at a human-user leg closes the case and must be recorded as closing it', () => {
  it('offer: the human-user leg projects escalate — the offer reads off the FROZEN ladder, never off resolver availability (settled 2026-10-08 ruling; NOT touched by this fix)', () => {
    const legal = (MEASUREMENT.itemBefore?.['legalActions'] as readonly string[] | undefined) ?? []
    console.info(`${BANNER} legalActions offered on the human-user leg before the act: ${JSON.stringify(legal)}`)
    expect(MEASUREMENT.itemBefore).toBeDefined()
    expect(legal).toContain('escalate')
  })

  it('MEASURED RECEIPT (disclosed misrepresentation, pinned as tripwire): the wire answers outcome "escalated" although no successor took the case — the truthful value is outside the CLOSED v8 set REMOTE_INTERVENTION_ACT_OUTCOMES (remote/src/contracts/types.ts:485-490); adding one is a wire-version decision the writer may not make (BLOCKER reported)', () => {
    console.info(`${BANNER} intervention.act wire response: ${JSON.stringify(MEASUREMENT.act)}`)
    expect(MEASUREMENT.act.ok).toBe(true)
    expect(dataOf(MEASUREMENT.act)['outcome']).toBe('escalated')
  })

  it('service-level truth the receipt discards: caseOutcome is "authority-unavailable" and no leg rose (A1-12, spec 11.6)', () => {
    console.info(
      `${BANNER} escalateApprovalLeg return (discarded by s6-remote.ts:3770-3776): ` +
        `caseOutcome=${MEASUREMENT.directOutcome.caseOutcome} nextLeg=${MEASUREMENT.directOutcome.nextLeg === undefined ? 'ABSENT' : 'PRESENT'}`,
    )
    expect(MEASUREMENT.directOutcome.caseOutcome).toBe('authority-unavailable')
    expect(MEASUREMENT.directOutcome.nextLeg).toBeUndefined()
  })

  it('the case is CLOSED, not destroyed: the leg row stays durable, exactly one closing deny and one escalation fact join, no second leg, nothing pending, zero consumption', () => {
    const factTypes = MEASUREMENT.wireCaseRows.map((row) => row.factType).sort()
    console.info(
      `${BANNER} durable ledger rows for the wire case after the act: ${JSON.stringify(
        MEASUREMENT.wireCaseRows.map((row) => ({
          factType: row.factType,
          decision: row.payload['decision'],
          reason: row.payload['reason'],
          terminalReason: row.payload['terminalReason'],
          legOrdinal: row.payload['legOrdinal'],
        })),
      )}`,
    )
    expect(factTypes).toEqual([
      'control-decision-recorded',
      'control-escalation-recorded',
      'control-request-recorded',
    ].sort())
    // THE leg row did NOT vanish from the durable store (audit F2): the audit
    // paraphrase "the leg row vanishes" describes the OPEN projection, not the
    // ledger. Exactly one leg row (ordinal 1) — no risen leg was minted.
    const legRows = MEASUREMENT.wireCaseRows.filter(
      (row) => row.factType === 'control-request-recorded',
    )
    expect(legRows).toHaveLength(1)
    expect(legRows[0]?.payload['legOrdinal']).toBe(1)
    expect(MEASUREMENT.stateAfter.legRowsForWireCase).toBe(1)
    expect(MEASUREMENT.stateAfter.pendingForCases).toBe(0)
    expect(MEASUREMENT.stateAfter.consumptions).toBe(0)
    const decision = MEASUREMENT.wireCaseRows.find(
      (row) => row.factType === 'control-decision-recorded',
    )
    expect(decision?.payload['decision']).toBe('deny')
    expect(decision?.payload['reason']).toBe('escalated')
  })

  it('DURABLE TRUTH (the fix): the closing deny carries terminalReason "resolver-unavailable" — the A2-8 destination field for an unavailable-resolver close, which the born-terminal twin (service.ts:4013) stamped and this branch omitted', () => {
    const decision = MEASUREMENT.wireCaseRows.find(
      (row) => row.factType === 'control-decision-recorded',
    )
    const directDecision = MEASUREMENT.directCaseRows.find(
      (row) => row.factType === 'control-decision-recorded',
    )
    console.info(
      `${BANNER} terminalReason on the wire-lane closing deny: ${JSON.stringify(
        decision?.payload['terminalReason'],
      )}; on the service-lane closing deny: ${JSON.stringify(directDecision?.payload['terminalReason'])}`,
    )
    expect(decision?.payload['terminalReason']).toBe('resolver-unavailable')
    expect(directDecision?.payload['terminalReason']).toBe('resolver-unavailable')
  })

  it('CONTROL arm of the fix: a RISEN escalation (leader leg -> Human User) writes no terminalReason and mints leg 2 — absence keeps its A2-8 meaning, the stamp is bound to the terminate branch only', () => {
    const decision = MEASUREMENT.risenCaseRows.find(
      (row) => row.factType === 'control-decision-recorded',
    )
    const legRows = MEASUREMENT.risenCaseRows.filter(
      (row) => row.factType === 'control-request-recorded',
    )
    console.info(
      `${BANNER} risen case: caseOutcome=${MEASUREMENT.risenOutcome.caseOutcome} ` +
        `nextLeg=${MEASUREMENT.risenOutcome.nextLeg === undefined ? 'ABSENT' : `leg ${String(MEASUREMENT.risenOutcome.nextLeg.legOrdinal)}`} ` +
        `closing-deny terminalReason=${JSON.stringify(decision?.payload['terminalReason'])} legRows=${String(legRows.length)}`,
    )
    expect(MEASUREMENT.risenOutcome.caseOutcome).toBe('escalated')
    expect(MEASUREMENT.risenOutcome.nextLeg?.legOrdinal).toBe(2)
    expect(decision?.payload['decision']).toBe('deny')
    expect(decision?.payload['reason']).toBe('escalated')
    expect(decision?.payload['terminalReason']).toBeUndefined()
  })

  it('re-read law: the decided case leaves the open projection (the panel row disappears; get answers INTERVENTION_NOT_FOUND) — tripwire: wiring projectZeroLegTermination (projection.ts:163, production-uncalled today) into this read will redden this pin and must be re-reviewed, not renumbered', () => {
    console.info(
      `${BANNER} intervention.list ids after the act: ${JSON.stringify(MEASUREMENT.listAfterIds)}; ` +
        `intervention.get after the act: ${JSON.stringify(errorOf(MEASUREMENT.getAfter))}`,
    )
    expect(MEASUREMENT.listAfterIds).not.toContain(`int-${MEASUREMENT.wireCaseId}`)
    expect(errorOf(MEASUREMENT.getAfter)['code']).toBe('INTERVENTION_NOT_FOUND')
  })
})
