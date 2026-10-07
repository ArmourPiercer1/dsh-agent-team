/**
 * A4-PR7 follow-up `feat/a4-surface-authority-unavailable` (A1-12 "the told
 * half") — an escalate-terminate close must reach the OPERATOR as a terminal
 * InterventionItem with status `authority-unavailable`, on the read plane.
 *
 * THE OTHER HALF IS ALREADY MERGED (PR #118, `master 0862c273`): the durable
 * record stamps `terminalReason: resolver-unavailable` on the closing deny,
 * and the coordinator's round-3 record says the field "rides
 * `team.getLedgerPage` … yet no rendered path reads it: the ledger still says
 * `deny · escalated`. Recorded, not yet told." This file is the telling:
 * spec §11.6 requires the terminate to "surface typed Admin-required result
 * AND InterventionItem", and plan §6.D requires "Once a leg escalates, the
 * old leg is visibly terminal and no action remains on it"
 * (alpha4-implementation-plan.md:651). The vocabulary is NOT new:
 * `authority-unavailable` is a frozen v8 intervention ITEM STATUS
 * (`remote/src/contracts/types.ts:438`), the shared port validator accepts it
 * (`remote/src/handlers/intervention.ts:105`, applied at
 * `src/plugin/s6-remote.ts:2226`), the runtime type doc says the value exists
 * precisely for §11.6 (`intervention/types.ts:80-91`), and the client already
 * renders an action-less row as terminal with NO affordance
 * (`client/src/model/team-interventions.ts:69-72`). Only the PRODUCER was
 * missing. This lane wires the producer with ZERO contract values added.
 *
 * THE RULE, stated once (this lane's law):
 *   A DECIDED approval case whose terminal decision carries
 *   `terminalReason: resolver-unavailable` (the A2-8 destination field for an
 *   A1-12 close — written by BOTH the escalate-terminate branch of
 *   `escalateApprovalLeg` and the born-terminal `requestApprovalLeg` close)
 *   is projected, in `intervention.list`, as exactly one terminal item:
 *   status `authority-unavailable`, `informational`, `legalActions: []`,
 *   `blockScope: null`. An ordinary allow/deny close (no `terminalReason`)
 *   is NOT surfaced by this rule — that plane is unchanged. A risen
 *   escalation is an OPEN case: it surfaces (once) as its risen leg, never
 *   as a terminal item.
 *
 * WHAT THIS FILE DOES NOT TOUCH (deliberate, each stated where it bites):
 *  - the act receipt (`{outcome:'escalated'}` misreport) — pinned by
 *    `a4-escalate-act-truth.test.ts`; adding a truthful value there is a
 *    wire-version decision for the human (closed set at
 *    `remote/src/contracts/types.ts:485-490`);
 *  - `intervention.get` is NOT an independent fetch read — it searches the
 *    projection set (`src/plugin/s6-remote.ts:3667-3680`), so the surfaced
 *    terminal row now answers `get` as a consequence of the list change,
 *    with no separate law touched. The "decided vs never existed"
 *    conflation survives for ORDINARY closes (still unprojected, still
 *    `INTERVENTION_NOT_FOUND`) — a fetch-semantics question outside the
 *    projection/list plane, measured here and reported as a follow-up;
 *  - durable rows: this is a read-side view. The zero-writes leg below
 *    measures that `intervention.list` appends nothing;
 *  - torn window: the open read and the decided read run under SEPARATE
 *    team locks, so one case can appear OPEN in one snapshot and DECIDED
 *    in the other. The final leg pins what the projection owes the
 *    operator then: exactly one item, the open snapshot winning, and the
 *    act lane (fresh open re-read) still refusing the truly-decided id.
 *
 * Offline, host-free, at the PRODUCTION entry, on the same assembly pattern
 * PR #118 established: real durable `ControlService`, real v8 dispatcher
 * (`createS6RemoteDispatcher` + `createS6RemotePorts`), real server-principal
 * derivation, same escalate closure root.ts installs in production.
 *
 * @module @dsh-agent-team/runtime/test/a4-surface-authority-unavailable
 */
import { describe, expect, it } from 'vitest'

import { CONTROL_REQUEST_KINDS } from '../control/index.js'
import type { ApprovalCaseState } from '../control/index.js'
import { projectInterventions } from '../intervention/index.js'
import type { InterventionControlSource } from '../intervention/index.js'
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
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'
import type { RequiredAuthorityFacts } from '../intervention/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The A1-14 authority point every v3 operation case carries (fixture value). */
const AUTHORITY_SCOPE = {
  operationClass: 'fs.write',
  matcher: { kind: 'exact', resource: 'a4-surface:fileA' },
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

function itemsOf(response: RemoteResponse): Record<string, unknown>[] {
  return (dataOf(response)['items'] as Record<string, unknown>[] | undefined) ?? []
}

function itemFor(items: readonly Record<string, unknown>[], caseId: string) {
  return items.find((item) => item['interventionId'] === `int-${caseId}`)
}

const MEASUREMENT = await (async () => {
  const world = await createP6T4World('a4-surface-1', ['leader', 'worker'])
  try {
    const control = createP6T4Service(world, {
      authorityRevalidation: constantAuthorityRecheck().port,
    })
    const scope = makeScope({
      correlation: 'corr-a4-surface',
      operationFingerprint: 'fp-a4-surface-wire',
      authorityScope: AUTHORITY_SCOPE,
    })

    // (A) THE escalate-terminate case: a `human-user` leg whose only ladder
    // successor is `human-admin`, which has no resolver in this build.
    const terminateCase = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'human-user',
      requiredAuthorityAtCreation: 'human-user',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4-surface-wire',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-surface',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 surface: wire-lane escalate-terminate case',
    })
    if (terminateCase.kind !== 'leg') throw new Error('the human-user leg must be open')
    const terminateCaseId = terminateCase.leg.approvalCaseId ?? 'missing'

    // (B) THE risen escalation: a `leader` leg whose successor `human-user`
    // HAS a resolver. The escalation must surface the NEW pending leg and
    // must NOT be marked terminal.
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
        operationFingerprint: 'fp-a4-surface-risen',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-surface-risen',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 surface: risen-escalation case',
    })
    if (risenCase.kind !== 'leg') throw new Error('the leader leg must be open')
    const risenCaseId = risenCase.leg.approvalCaseId ?? 'missing'
    await control.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: risenCase.leg.requestId,
    })

    // (C) THE born-terminal zero-review close (`closeZeroReviewCaseTransactionally`,
    // service.ts ~:4010): a case created AT `human-admin` never opens a leg;
    // it is born DECIDED with `terminalReason: resolver-unavailable`. The new
    // rule must surface it consistently — the same terminal item shape — not
    // silently differently from the escalate-terminate close.
    const bornTerminalOutcome = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'human-admin',
      requiredAuthorityAtCreation: 'human-admin',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4-surface-born',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-surface-born',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 surface: born-terminal zero-review case',
    })
    if (bornTerminalOutcome.kind !== 'authority-unavailable') {
      throw new Error(`the human-admin case must terminate at birth, got ${bornTerminalOutcome.kind}`)
    }
    const bornTerminalCaseId = bornTerminalOutcome.approvalCaseId

    // (D) THE control arm: an ORDINARY decided close (a reviewer's allow, no
    // `terminalReason`). This plane is NOT widened by this lane: an ordinary
    // close still leaves the list exactly as before.
    const ordinaryCase = await control.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-a4-surface-ordinary',
        authorityScope: AUTHORITY_SCOPE,
        correlation: 'corr-a4-surface-ordinary',
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4 surface: ordinary allow-decided control case',
    })
    if (ordinaryCase.kind !== 'leg') throw new Error('the second leader leg must be open')
    const ordinaryCaseId = ordinaryCase.leg.approvalCaseId ?? 'missing'

    // THE production assembly (root.ts:3659-3669): the control source is the
    // SAME service; the escalate closure is the SAME one-liner.
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
      interventionId: `int-${terminateCaseId}`,
      action: 'escalate',
      note: 'above my rung — send it up',
    })

    // Allow the ordinary case AFTER the wire escalate, so the decided set is
    // complete before the FINAL list read.
    await control.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: ordinaryCase.leg.requestId,
      decision: 'allow',
    })

    const listAfter = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const itemsAfter = itemsOf(listAfter)

    // ZERO-WRITES proof: a bare list call appends nothing to the durable
    // ledger (this is a read-side view, not another write).
    const ledgerBefore = world.domain.repositories.ledger.list().length
    const listAgain = await v8('intervention.list', { teamSessionId: P6T4_ROOT })
    const ledgerAfter = world.domain.repositories.ledger.list().length

    // Acting ON the terminal item by id must stay refused (fail closed): the
    // act lane re-reads OPEN cases only, and a terminated case is not one.
    const actOnTerminal = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${terminateCaseId}`,
      action: 'deny',
    })
    const getAfter = await v8('intervention.get', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${terminateCaseId}`,
    })
    const getOrdinary = await v8('intervention.get', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${ordinaryCaseId}`,
    })

    // The structural fake: a control source that implements ONLY the open
    // read (the pre-existing `InterventionControlSource` shape). Absence of
    // the terminated read is fail-safe: the projection is then exactly the
    // open set — never a crash, never a synthesized terminal item.
    const fakeControl = {
      listOpenApprovalCases: async (input: { readonly rootSessionId: string }) =>
        control.listOpenApprovalCases(input),
    }
    const fakeProjected = await projectInterventions({
      rootSessionId: P6T4_ROOT,
      control: fakeControl,
    })

    // The generic decided-case read (control lane): EVERY decided case, with
    // the vocabulary FILTER belonging to the intervention lane, not here.
    const decidedRead =
      typeof (control as unknown as {
        listDecidedApprovalCases?: (input: { readonly rootSessionId: string }) => Promise<
          readonly { state: { identity: { approvalCaseId: string }; status: string } }[]
        >
      }).listDecidedApprovalCases === 'function'
        ? await (
            control as unknown as {
              listDecidedApprovalCases: (input: { readonly rootSessionId: string }) => Promise<
                readonly { state: { identity: { approvalCaseId: string }; status: string } }[]
              >
            }
          ).listDecidedApprovalCases({ rootSessionId: P6T4_ROOT })
        : null

    // THE TORN WINDOW (review round 1, the dedupe pin): the open read and
    // the decided read run under SEPARATE team locks, so a terminate that
    // lands BETWEEN them hands the projection one case twice — OPEN in the
    // first snapshot, DECIDED+stamped in the second. The dedupe must surface
    // EXACTLY ONE item, and it must keep the OPEN snapshot (open precedence:
    // a display never fabricates a terminal close the open fold did not see,
    // and never shows the same case twice). The fake below reproduces that
    // window on the REAL decided fold of the wire case: the open-side view
    // is the same durable rows as the fold saw one lock window earlier.
    const tornDecided = await control.listDecidedApprovalCases({ rootSessionId: P6T4_ROOT })
    const tornDecidedEntry = tornDecided.find(
      (summary) => summary.state.identity.approvalCaseId === terminateCaseId,
    )
    const tornDecidedState = tornDecidedEntry?.state
    const tornOpenState: ApprovalCaseState | undefined =
      tornDecidedState === undefined
        ? undefined
        : { ...tornDecidedState, status: 'open', terminalDecision: undefined }
    const tornCarrierKind = tornDecidedEntry?.carrierKind
    const tornControl: InterventionControlSource = {
      listOpenApprovalCases: async () =>
        tornOpenState !== undefined && tornCarrierKind !== undefined
          ? [{ state: tornOpenState, carrierKind: tornCarrierKind }]
          : [],
      listDecidedApprovalCases: async () =>
        tornDecidedEntry !== undefined ? [tornDecidedEntry] : [],
    }
    const tornProjected = await projectInterventions({
      rootSessionId: P6T4_ROOT,
      control: tornControl,
      reader: async () => facts(),
    })
    // The display may be one window stale; the ACT lane never is — it
    // re-reads OPEN cases fresh, so acting on the truly-decided id stays
    // refused whatever the projection happened to show.
    const actAllowOnTorn = await v8('intervention.act', {
      teamSessionId: P6T4_ROOT,
      interventionId: `int-${terminateCaseId}`,
      action: 'allow',
    })

    // The born-terminal twin must surface CONSISTENTLY with the
    // escalate-terminate close: same status/responseBehavior/legalActions.
    return {
      terminateCaseId,
      risenCaseId,
      bornTerminalCaseId,
      ordinaryCaseId,
      beforeIds: itemsOf(listBefore).map((item) => item['interventionId']),
      act,
      itemsAfter,
      afterIds: itemsAfter.map((item) => item['interventionId']),
      listAgainOk: listAgain.ok,
      ledgerDelta: ledgerAfter - ledgerBefore,
      actOnTerminal,
      getAfter,
      getOrdinary,
      fakeIds: fakeProjected.map((item) => item.interventionId),
      tornDecidedSeen: tornDecidedEntry !== undefined,
      tornIds: tornProjected.map((item) => item.interventionId),
      tornItem: tornProjected.find(
        (item) => item.interventionId === `int-${terminateCaseId}`,
      ) as unknown as Record<string, unknown> | undefined,
      actAllowOnTorn,
      decidedRead,
      terminateItem: itemFor(itemsAfter, terminateCaseId),
      risenItems: itemsAfter.filter((item) => item['interventionId'] === `int-${risenCaseId}`),
      bornItem: itemFor(itemsAfter, bornTerminalCaseId),
      ordinaryItem: itemFor(itemsAfter, ordinaryCaseId),
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

const BANNER = '=== A4-SURFACE MEASUREMENT ==='

/** The terminal cell this lane makes visible: the §11.6 close, told. */
function expectTerminalItem(item: Record<string, unknown> | undefined, label: string) {
  expect(item, `${label}: the terminated case must be listed at all`).toBeDefined()
  expect(item?.['status'], `${label}: status`).toBe('authority-unavailable')
  expect(item?.['responseBehavior'], `${label}: responseBehavior`).toBe('informational')
  expect(item?.['legalActions'], `${label}: legalActions (no affordance)`).toEqual([])
  expect(item?.['blockScope'], `${label}: blockScope (nothing held)`).toBeNull()
  expect(item?.['kind'], `${label}: kind`).toBe('approval')
  const reasons = (item?.['derivationReasons'] as readonly string[] | undefined) ?? []
  expect(reasons, `${label}: derivationReasons must say why`).toContain('no-resolver')
  expect(typeof item?.['createdAt'], `${label}: createdAt must be a durable instant`).toBe('string')
}

describe('a4-surface: an A1-12 escalate-terminate close is TOLD as a terminal authority-unavailable item (spec 11.6; plan 6.D:651; the PR #118 recorded-half gets its rendered half)', () => {
  it('precondition: the human-user leg is listed OPEN before the act, and the terminate case is not yet terminal', () => {
    console.info(`${BANNER} list ids before the act: ${JSON.stringify(MEASUREMENT.beforeIds)}`)
    const before = MEASUREMENT.beforeIds
    expect(before).toContain(`int-${MEASUREMENT.terminateCaseId}`)
    expect(before).toContain(`int-${MEASUREMENT.ordinaryCaseId}`)
    // The risen case is listed once (its risen leg), the born-terminal case
    // is not decided-at-read-time yet only in the old world — under the new
    // rule it IS visible; this leg pins the OPEN ones only.
    expect(before).toContain(`int-${MEASUREMENT.risenCaseId}`)
  })

  it('THE TELLING: after the escalate terminates the case, intervention.list carries the case as a TERMINAL authority-unavailable item — informational, zero legal actions, nothing held, no-resolver named', () => {
    console.info(
      `${BANNER} list ids after the act: ${JSON.stringify(MEASUREMENT.afterIds)}; ` +
        `terminate item: ${JSON.stringify(MEASUREMENT.terminateItem)}`,
    )
    expect(MEASUREMENT.act.ok).toBe(true)
    expectTerminalItem(MEASUREMENT.terminateItem, 'escalate-terminate close')
    // The item still names the leg it terminated on — the visible terminal
    // OLD leg (plan 6.D), read off the durable close, never synthesized.
    const source = MEASUREMENT.terminateItem?.['source'] as Record<string, unknown>
    expect(source['kind']).toBe('control-case')
    expect(source['id']).toBe(MEASUREMENT.terminateCaseId)
    expect(source['legOrdinal']).toBe(1)
    expect(typeof source['requestId']).toBe('string')
  })

  it('a RISEN escalation is NOT terminal: the risen leg surfaces (exactly one item, open, with affordances) and the case never gains the authority-unavailable cell', () => {
    console.info(`${BANNER} risen items: ${JSON.stringify(MEASUREMENT.risenItems)}`)
    expect(MEASUREMENT.risenItems).toHaveLength(1)
    const risen = MEASUREMENT.risenItems[0] as Record<string, unknown>
    expect(risen['status']).toBe('open')
    expect(risen['responseBehavior']).toBe('wait-for-response')
    const actions = (risen['legalActions'] as readonly string[] | undefined) ?? []
    expect(actions).toContain('allow')
    expect(MEASUREMENT.afterIds.indexOf(`int-${MEASUREMENT.risenCaseId}`))
      .toBe(MEASUREMENT.afterIds.lastIndexOf(`int-${MEASUREMENT.risenCaseId}`))
  })

  it('the born-terminal zero-review close surfaces CONSISTENTLY with the escalate-terminate close (same terminal cells), not silently differently', () => {
    console.info(`${BANNER} born-terminal item: ${JSON.stringify(MEASUREMENT.bornItem)}`)
    expectTerminalItem(MEASUREMENT.bornItem, 'born-terminal zero-review close')
    const born = MEASUREMENT.bornItem as Record<string, unknown>
    const terminated = MEASUREMENT.terminateItem as Record<string, unknown>
    for (const cell of ['status', 'responseBehavior', 'kind'] as const) {
      expect(born[cell], `consistency on '${cell}'`).toBe(terminated[cell])
    }
    expect(born['legalActions']).toEqual([])
  })

  it('CONTROL arm (this lane widens NOTHING else): an ordinary allow-decided case (no terminalReason) still leaves the list exactly as before', () => {
    console.info(`${BANNER} ordinary decided item present? ${String(MEASUREMENT.ordinaryItem === undefined)}`)
    expect(MEASUREMENT.beforeIds).toContain(`int-${MEASUREMENT.ordinaryCaseId}`)
    expect(MEASUREMENT.ordinaryItem).toBeUndefined()
    expect(MEASUREMENT.afterIds).not.toContain(`int-${MEASUREMENT.ordinaryCaseId}`)
  })

  it('read-side only: a bare intervention.list appends ZERO durable rows (the PR #118 pinned rows stay the only writes)', () => {
    console.info(`${BANNER} ledger rows appended by one list call: ${String(MEASUREMENT.ledgerDelta)}`)
    expect(MEASUREMENT.listAgainOk).toBe(true)
    expect(MEASUREMENT.ledgerDelta).toBe(0)
  })

  it('fail-closed act on the terminal item: acting by id on a terminated case stays refused (the act lane re-reads OPEN cases only)', () => {
    console.info(`${BANNER} act-on-terminal: ${JSON.stringify(errorOf(MEASUREMENT.actOnTerminal))}`)
    expect(errorOf(MEASUREMENT.actOnTerminal)['code']).toBe('INTERVENTION_NOT_FOUND')
  })

  it('fetch semantics MEASURED (claim corrected): intervention.get SEARCHES THE PROJECTION SET (s6-remote.ts:3667-3680), it is not an independent decided-refusal read — so the surfaced terminal row now answers get too; the decided-vs-never-existed conflation the follow-up report carries survives for ORDINARY closes, pinned here', () => {
    console.info(`${BANNER} get-after on the surfaced terminal id: ok=${MEASUREMENT.getAfter.ok}`)
    // (a) the terminated case is NOW projected, so get tells it — the same
    // item, cell for cell, no second law anywhere.
    expect(MEASUREMENT.getAfter.ok).toBe(true)
    const got = dataOf(MEASUREMENT.getAfter)['item'] as Record<string, unknown>
    expect(got['interventionId']).toBe(`int-${MEASUREMENT.terminateCaseId}`)
    expect(got['status']).toBe('authority-unavailable')
    expect(got['legalActions']).toEqual([])
    // (b) the ORDINARY decided case is still not projected, and get still
    // answers its id with INTERVENTION_NOT_FOUND — "decided" and "never
    // existed" remain one answer for it. THAT is the fetch-semantics
    // question this lane deliberately does NOT change (reported follow-up).
    const getOrdinary = MEASUREMENT.getOrdinary
    console.info(`${BANNER} get on the ordinary decided id: ${JSON.stringify(errorOf(getOrdinary))}`)
    expect(errorOf(getOrdinary)['code']).toBe('INTERVENTION_NOT_FOUND')
  })

  it('absence is fail-safe: a control source WITHOUT the terminated read (the pre-existing structural shape) projects exactly the open set — no crash, no synthesized terminal row', () => {
    console.info(`${BANNER} fake-control projection ids: ${JSON.stringify(MEASUREMENT.fakeIds)}`)
    expect(MEASUREMENT.fakeIds).toContain(`int-${MEASUREMENT.risenCaseId}`)
    expect(MEASUREMENT.fakeIds).not.toContain(`int-${MEASUREMENT.terminateCaseId}`)
    expect(MEASUREMENT.fakeIds).not.toContain(`int-${MEASUREMENT.bornTerminalCaseId}`)
    expect(MEASUREMENT.fakeIds).not.toContain(`int-${MEASUREMENT.ordinaryCaseId}`)
  })

  it('torn-window dedupe (the two control reads run under SEPARATE locks): one case appearing in the OPEN snapshot AND the DECIDED snapshot surfaces EXACTLY ONE item, the OPEN snapshot wins, and the act lane — re-reading OPEN fresh — still refuses acting on the truly-decided id', () => {
    console.info(`${BANNER} torn-window projection ids: ${JSON.stringify(MEASUREMENT.tornIds)}`)
    expect(
      MEASUREMENT.tornDecidedSeen,
      'the decided read must carry the torn case for the window to be real',
    ).toBe(true)
    // EXACTLY ONE. Neutralize the dedupe in projection.ts and THIS line is
    // the one that reddens: the decided snapshot joins the set and the same
    // interventionId surfaces a second (terminal) time.
    expect(MEASUREMENT.tornIds).toEqual([`int-${MEASUREMENT.terminateCaseId}`])
    // OPEN PRECEDENCE: the surviving surface is the wait-for-response leg
    // with its affordances — never the authority-unavailable cell. (A
    // dedupe that kept the decided snapshot instead would answer
    // authority-unavailable here; showing either twice is already fatal.)
    const torn = MEASUREMENT.tornItem
    expect(torn?.['status'], 'torn window: the OPEN snapshot must win').toBe('open')
    expect(torn?.['responseBehavior']).toBe('wait-for-response')
    expect(torn?.['legalActions'] as readonly string[]).toContain('escalate')
    expect(
      (torn?.['derivationReasons'] as readonly string[] | undefined) ?? [],
    ).not.toContain('no-resolver')
    // Staleness is DISPLAY-only: the act plane re-validates against a fresh
    // OPEN read, and this case is durably decided — so the act stays refused.
    console.info(
      `${BANNER} act 'allow' on the truly-decided id: ${JSON.stringify(errorOf(MEASUREMENT.actAllowOnTorn))}`,
    )
    expect(errorOf(MEASUREMENT.actAllowOnTorn)['code']).toBe('INTERVENTION_NOT_FOUND')
  })

  it('the generic decided read lives in CONTROL and carries EVERY decided case (the resolver-unavailable FILTER is the intervention lane law, not a control-lane opinion)', () => {
    console.info(`${BANNER} decided read: ${JSON.stringify(MEASUREMENT.decidedRead?.map((s) => s.state.identity.approvalCaseId))}`)
    expect(MEASUREMENT.decidedRead, 'control must expose listDecidedApprovalCases').not.toBeNull()
    const ids = (MEASUREMENT.decidedRead ?? []).map((summary) => summary.state.identity.approvalCaseId)
    expect([...ids].sort()).toEqual(
      [MEASUREMENT.terminateCaseId, MEASUREMENT.bornTerminalCaseId, MEASUREMENT.ordinaryCaseId].sort(),
    )
    for (const summary of MEASUREMENT.decidedRead ?? []) {
      expect(summary.state.status).toBe('decided')
    }
    // The human reviewer reading the plane must still be able to act — this
    // read is a read: it grants nothing and writes nothing (ledger delta
    // above is measured on the wire arm).
    expect(ids).not.toContain(MEASUREMENT.risenCaseId)
  })
})
