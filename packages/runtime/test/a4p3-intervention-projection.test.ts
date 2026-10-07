/**
 * A4-PR3 lane B + lane C — the legal-action DERIVATION, the frozen terminal
 * case outcomes, and the Intervention PROJECTION (Alpha.4 plan Task 3 lanes
 * B and C; spec §11.5, §11.6, §12, §14, §24.2; ADR A1-7, A1-12, A1-17, A2-8,
 * A5-2, A5-6, A5-7, X8).
 *
 * The file is deliberately split in two halves because the lane has two
 * obligations that fail differently:
 *
 * - **The law** (pure derivation): what a reviewer may do, and which terminal
 *   outcome a terminated invocation reports. `authority-unavailable` and
 *   `authority-undetermined` naming one failure is the silent-confusion ADR
 *   X8 restored `authority-undetermined` to prevent, and it can only be seen
 *   by pinning the tables.
 * - **The boundary** (projection): the projection reads durable Control state
 *   and cannot authorize anything. That is pinned behaviourally (mutating a
 *   projected item leaves the guard verdict identical), structurally (every
 *   item leaves the projection deep-frozen), and architecturally in
 *   `a4p3-intervention-lane-hygiene.test.ts`, which WALKS the edges (plan Task 3's
 *   named `Test create` file; audit F4/F11 — the pinned list that lived here
 *   silently dropped any file the checkout did not carry),
 *   import-edge pin, folded into this file because the lane's own file list
 *   names no separate hygiene test).
 *
 * Lane C also owns two host-fold duties the PR3 pre-flight assigned to it
 * (ADR X8): the escalation row must not break the read plane, and
 * `pendingControlCount` must stop counting an abandoned request as pending —
 * the count is what the UI shows, and no test asserted it under abandonment
 * (no-red finding 3).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * scenarios run at module level with top-level await; `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_CASE_TERMINAL_OUTCOMES,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlGuardVerdict } from '../control/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  CONTROL_ROW_SHAPES,
  INTERVENTION_ACTIONS,
  INTERVENTION_ACTION_VALUES,
  INTERVENTION_DERIVATION_REASONS,
  INTERVENTION_KIND_VALUES,
  INTERVENTION_RESPONSE_BEHAVIORS,
  INTERVENTION_STATUS_VALUES,
  TERMINAL_AUTHORIZATIONS,
  TERMINAL_AUTHORITY_STATES,
  TERMINAL_EXECUTIONS,
  TERMINAL_MUTATION_EFFECTS,
  TERMINAL_MUTATION_OUTCOMES,
  TERMINAL_MUTATION_OUTCOME_VALUES,
  TERMINAL_OPERATION_OUTCOMES,
  TERMINAL_OPERATION_OUTCOME_VALUES,
  controlRowShapeOf,
  deriveInterventionItem,
  deriveInterventionItems,
  deriveLegalActions,
  deriveTerminalMutationOutcome,
  deriveTerminalOperationOutcome,
  projectInterventions,
  projectZeroLegTermination,
  strictRowProblem,
} from '../intervention/index.js'
import type { RequiredAuthorityFacts, RequiredAuthorityReaderInput } from '../intervention/index.js'
import type { ApprovalCaseState } from '../control/index.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4Service,
  constantAuthorityRecheck,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)


/**
 * The authority point every operation case carries from A4-PR7 Task 7.0 onward
 * (ADR A1-14), plus the constant consumption-point recheck. This file's subject
 * is the READ-ONLY projection (which actions a viewer may take on a case), so
 * the recheck answers `still-sufficient`: before PR7 the consumption point asked
 * no authority question at all, and that is what this constant restores. The
 * authority law itself is `a4p7-a1-14-consumption-revalidation.test.ts`.
 */
const AUTHORITY_SCOPE = {
  operationClass: 'fs.write',
  matcher: { kind: 'exact', resource: 'a4p3-fixture:fileA' },
} as const
const RECHECK = constantAuthorityRecheck()
const SERVICE_OPTIONS = { authorityRevalidation: RECHECK.port }

const ESCALATION_FACT_TYPE = 'control-escalation-recorded'

/** The template rows production injects through `readPortDeps`
 *  (`src/plugin/root.ts:2969`) — copied from
 *  `a4pr0a-abandon-projection-closure.test.ts:57` so the host fold under test
 *  is read exactly as the composition root reads it. */
const PORT_DEPS = {
  templates: () =>
    [
      { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
    ] as never,
  policyState: () => 'default' as const,
}

/** The frozen ledger-summary slice of the projection (contracts v1). */
interface LedgerSummary {
  readonly totalEntries: number
  readonly byCategory: Record<string, number>
  readonly pendingControlCount: number
}

/** Read the LEDGER SUMMARY for the world's root through the PRODUCTION read
 *  port (the same channel `team.getProjection` uses). */
function readLedgerSummary(domain: never): LedgerSummary {
  const source = createTeamDomainReadPort(domain, PORT_DEPS).readProjectionSource(
    parseRootSessionId(P6T4_ROOT),
  )
  return source.ledger as unknown as LedgerSummary
}

/** One facts bag with everything permissive, overridden per case. */
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

/** The five lanes the plan names as the lane-B RED list. */
function actionSet(overrides: Partial<RequiredAuthorityFacts>): readonly string[] {
  return deriveLegalActions(facts(overrides)).actions
}

// --- the durable half: one real case, projected -------------------------------

const durable = await (async () => {
  const world = await createP6T4World('a4p3-proj-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world, SERVICE_OPTIONS)
    const identity = {
      subject: { kind: 'instance', instanceId: WORKER_ID } as const,
      beneficiaryAuthority: 'member' as const,
      requestedEffect: 'ask' as const,
    }
    const scope = makeScope({
      correlation: 'corr-a4p3-proj-1',
      operationFingerprint: 'fp-a4p3-proj-1',
      authorityScope: AUTHORITY_SCOPE,
    })
    const created = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: { ...identity, operationFingerprint: 'fp-a4p3-proj-1',
        authorityScope: AUTHORITY_SCOPE,
        correlation: scope.correlation },
      actionName: scope.actionName,
      toolName: scope.toolName,
      summary: 'a4p3 projected case',
    })
    if (created.kind !== 'leg') throw new Error('the projected case must have a leg')
    const approvalCaseId = created.leg.approvalCaseId ?? 'missing'

    /** A reader that answers exactly one way, and records what it was asked. */
    const seen: RequiredAuthorityReaderInput[] = []
    const reader = (input: RequiredAuthorityReaderInput): RequiredAuthorityFacts => {
      seen.push(input)
      return facts({ requiredAuthority: 'leader' })
    }
    const projectOpen = () =>
      projectInterventions({ rootSessionId: P6T4_ROOT, control: service, reader })
    const openItems = await projectOpen()
    const openNoReader = await projectInterventions({ rootSessionId: P6T4_ROOT, control: service })
    // Audit F6: a reader that CANNOT ANSWER must not be answered on its
    // behalf. The old wrapper synthesized a fact bag whose `requiredAuthority`
    // was the leg's own rung, so the item published an authority nobody read
    // and still offered `deny` - a fabricated authority with a real-looking
    // action set.
    const throwingItems = await projectInterventions({
      rootSessionId: P6T4_ROOT,
      control: service,
      reader: () => {
        throw new Error('the ceiling store is unavailable')
      },
    })
    // The guard verdict the projection must NEVER be able to change.
    const guardBefore = await service.guardOperation(scope)
    // A1-17's behavioural half: mutate the projected item, then re-ask.
    const first = openItems[0]
    let mutationAttempt: 'threw' | 'silently-ignored' | 'mutated' = 'mutated'
    if (first !== undefined) {
      try {
        ;(first as { status: string }).status = 'open'
        ;(first as unknown as { legalActions: string[] }).legalActions.push('allow')
        mutationAttempt =
          first.legalActions.length === (openItems[0]?.legalActions.length ?? 0) ? 'silently-ignored' : 'mutated'
      } catch {
        mutationAttempt = 'threw'
      }
    }
    const guardAfterMutation = await service.guardOperation(scope)

    // Escalate: the SAME item, risen.
    await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: created.leg.requestId,
      reason: 'the leader cannot decide for the member',
    })
    const escalatedItems = await projectOpen()
    // A second case, decided by the Human User: resolved + informational.
    const secondScope = makeScope({
      correlation: 'corr-a4p3-proj-2',
      operationFingerprint: 'fp-a4p3-proj-2',
      authorityScope: AUTHORITY_SCOPE,
    })
    const second = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: { ...identity, operationFingerprint: 'fp-a4p3-proj-2',
        authorityScope: AUTHORITY_SCOPE,
        correlation: secondScope.correlation },
      actionName: secondScope.actionName,
      toolName: secondScope.toolName,
    })
    if (second.kind !== 'leg') throw new Error('the second case must have a leg')
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: second.leg.requestId,
      decision: 'deny',
    })
    // A third case, abandoned by its caller: the item goes stale.
    const thirdScope = makeScope({
      correlation: 'corr-a4p3-proj-3',
      operationFingerprint: 'fp-a4p3-proj-3',
      authorityScope: AUTHORITY_SCOPE,
    })
    const third = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: { ...identity, operationFingerprint: 'fp-a4p3-proj-3',
        authorityScope: AUTHORITY_SCOPE,
        correlation: thirdScope.correlation },
      actionName: thirdScope.actionName,
      toolName: thirdScope.toolName,
    })
    if (third.kind !== 'leg') throw new Error('the third case must have a leg')
    await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: third.leg.requestId,
      reason: 'the caller gave up',
    })
    const allItems = await projectOpen()
    const secondCaseId = second.leg.approvalCaseId ?? 'missing'
    const secondRead = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: secondCaseId,
    })
    if (secondRead.kind !== 'case') {
      throw new Error(`the decided case must read back as a case, got ${secondRead.kind}`)
    }
    const decidedItems = await deriveInterventionItems([secondRead.state], reader)
    const thirdCaseId = third.leg.approvalCaseId ?? 'missing'
    // The abandoned case, read back and derived (audit F9): `resolved` and
    // `stale` have NO producer inside `projectInterventions`, which reads only
    // the OPEN cases - they are reachable through the case read plus
    // `deriveInterventionItems`, and that is the call path PR6 must take.
    const thirdRead = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: thirdCaseId,
    })
    if (thirdRead.kind !== 'case') {
      throw new Error(`the abandoned case must read back as a case, got ${thirdRead.kind}`)
    }
    // An abandoned leg is terminal, so the reader is never consulted; the facts
    // bag is supplied only to satisfy the signature.
    const abandonedItems = await deriveInterventionItems([thirdRead.state], () => facts())
    // Audit F16: 14.1's `createdAt` is a durable instant or the item does not
    // exist. The first implementation filled it from `identity.correlation` — a
    // routing token written into an ISO-8601 field. No durable row can produce
    // that shape today (every ledger entry carries a time), so the fixture
    // STRIPS the real read's instants: the pin is that the derivation refuses
    // rather than invents a time.
    const noInstantState = {
      ...thirdRead.state,
      legs: thirdRead.state.legs.map((row) => ({ ...row, createdAt: undefined })),
      currentLeg:
        thirdRead.state.currentLeg === undefined
          ? undefined
          : { ...thirdRead.state.currentLeg, createdAt: undefined },
    } as unknown as ApprovalCaseState
    const noInstantItem = await deriveInterventionItem(noInstantState, () => facts())
    // The host fold: an escalation row must not break the read plane, and the
    // abandoned request must not be counted as pending.
    const projection = readLedgerSummary(world.domain as never)
    const controlCount = projection.byCategory['control'] ?? 0
    const escalationRows = world.domain.repositories.ledger
      .list()
      .filter((entry) => entry.factType === ESCALATION_FACT_TYPE).length
    const openCaseIds = (await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })).map(
      (summary) => summary.state.identity.approvalCaseId,
    )
    const guardOfAbandoned = await service.guardOperation(thirdScope)
    return {
      approvalCaseId,
      openItems,
      throwingItems,
      abandonedItems,
      openNoReader,
      escalatedItems,
      allItems,
      decidedItems,
      noInstantItem,
      seen,
      first: openItems[0],
      mutationAttempt,
      guardBefore,
      guardAfterMutation,
      guardOfAbandoned,
      projection,
      controlCount,
      escalationRows,
      openCaseIds,
      secondCaseId,
      thirdCaseId,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- the frozen vocabularies (no-red finding 6) --------------------------------

describe('the frozen PR3 outcome and action vocabularies', () => {
  it('the operation terminal-outcome vocabulary is closed and keeps both authority failures distinct', () => {
    expect([...TERMINAL_OPERATION_OUTCOME_VALUES]).toEqual([
      'execution-succeeded',
      'execution-unavailable',
      'stale',
      'denied',
      'authority-unavailable',
      'authority-undetermined',
    ])
  })

  it('the mutation terminal-outcome vocabulary is closed', () => {
    expect([...TERMINAL_MUTATION_OUTCOME_VALUES]).toEqual([
      'mutation-committed',
      'mutation-no-change',
      'mutation-stale',
      'denied',
      'authority-unavailable',
      'authority-undetermined',
    ])
  })

  it('the reviewer-action vocabulary is allow/deny/escalate and is not the decision vocabulary', () => {
    expect([...INTERVENTION_ACTION_VALUES].sort()).toEqual(['allow', 'deny', 'escalate'])
    expect(INTERVENTION_KIND_VALUES).toEqual(['approval', 'warning', 'error'])
    // §14.1's status set, unchanged: PR3 adds no sixth status (an abandoned
    // leg maps to `stale`, see projection.ts).
    expect([...INTERVENTION_STATUS_VALUES]).toEqual([
      'open',
      'acknowledged',
      'resolved',
      'authority-unavailable',
      'stale',
    ])
  })
})

// --- the legality law (spec §11.5) --------------------------------------------

describe('the legal-action law (spec §11.5, ADR A5-2)', () => {
  it('an insufficient reviewer may deny or escalate, and may never allow', () => {
    expect(actionSet({ reviewerAtOrAboveRequiredAuthority: false })).toEqual([
      INTERVENTION_ACTIONS.ESCALATE,
      INTERVENTION_ACTIONS.DENY,
    ])
    expect(actionSet({ desiredEffectWithinGrantCeiling: false })).toEqual([
      INTERVENTION_ACTIONS.ESCALATE,
      INTERVENTION_ACTIONS.DENY,
    ])
  })

  it('a sufficient non-admin reviewer may allow, escalate or deny', () => {
    expect(actionSet({})).toEqual([
      INTERVENTION_ACTIONS.ALLOW,
      INTERVENTION_ACTIONS.ESCALATE,
      INTERVENTION_ACTIONS.DENY,
    ])
  })

  it('a top-of-ladder reviewer may allow or deny only (no rung above)', () => {
    // Human Admin is the top of `CONTROL_ESCALATION_SUCCESSOR`: its successor
    // is null, so there is nobody to raise the case to. Top-of-ladder is a
    // statement about the LADDER, not about resolvers.
    expect(actionSet({ requiredAuthority: 'human-admin' })).toEqual([
      INTERVENTION_ACTIONS.ALLOW,
      INTERVENTION_ACTIONS.DENY,
    ])
    expect(
      deriveLegalActions(facts({ requiredAuthority: 'human-admin' })).reasons,
    ).toContain(INTERVENTION_DERIVATION_REASONS.TOP_OF_LADDER)
  })

  it('a HUMAN-USER leg keeps escalate although Alpha.4 has no Admin resolver (spec 21.5, audit F1)', () => {
    // The two axes answer different questions. The escalate clause of 11.5 is
    // `reviewAuthority < human-admin`, which a Human-User leg SATISFIES;
    // `hasAuthorityResolver('human-admin') === false` says only that the RISE
    // will not mint a leg - per A1-12 / 11.6 the case then terminates
    // `authority-unavailable`, which is a CONSEQUENCE of a legal act, not a
    // reason to hide the act. A reviewer who may not escalate cannot recuse.
    expect(actionSet({ requiredAuthority: 'human-user' })).toEqual([
      INTERVENTION_ACTIONS.ALLOW,
      INTERVENTION_ACTIONS.ESCALATE,
      INTERVENTION_ACTIONS.DENY,
    ])
    expect(
      deriveLegalActions(facts({ requiredAuthority: 'human-user' })).reasons,
    ).not.toContain(INTERVENTION_DERIVATION_REASONS.TOP_OF_LADDER)
  })

  it('insufficient reach at the top of the ladder leaves DENY alone', () => {
    // The half of 11.5 the Human-User case does not exercise: an insufficient
    // reviewer with nowhere to rise has exactly one honest act.
    expect(
      actionSet({ requiredAuthority: 'human-admin', reviewerAtOrAboveRequiredAuthority: false }),
    ).toEqual([INTERVENTION_ACTIONS.DENY])
  })

  it('an undetermined ceiling never makes allow legal, and is reported as undetermined (A5-2)', () => {
    const derivation = deriveLegalActions(facts({ ceilingUndetermined: true }))
    expect(derivation.actions).not.toContain(INTERVENTION_ACTIONS.ALLOW)
    expect(derivation.reasons).toContain(INTERVENTION_DERIVATION_REASONS.CEILING_UNDETERMINED)
  })

  it('a principal who already acted on the case has no legal action at all (spec §11.4)', () => {
    expect(actionSet({ principalAlreadyActed: true })).toEqual([])
    expect(deriveLegalActions(facts({ principalAlreadyActed: true })).reasons).toEqual([
      INTERVENTION_DERIVATION_REASONS.REVIEWER_ALREADY_ACTED,
    ])
  })

  it('a leg whose rung has no resolver offers nothing (ADR A1-12)', () => {
    expect(actionSet({ resolverExists: false })).toEqual([])
  })

  it('requiredAuthorityAtCreation is provenance only: it is not an input to the law (spec §11.2)', () => {
    // The field does not exist on the facts bag at all, so no caller can
    // make legality depend on the creation-time value. The key set is pinned
    // because a future "convenience" field would silently re-open the hole.
    expect(Object.keys(facts()).sort()).toEqual([
      'ceilingUndetermined',
      'desiredEffectWithinGrantCeiling',
      'principalAlreadyActed',
      'requiredAuthority',
      'resolverExists',
      'reviewerAtOrAboveRequiredAuthority',
    ])
    // `successorHasResolver` is DELIBERATELY absent (audit F1): whether the
    // rung above EXISTS is a property of the frozen ladder, readable from
    // `requiredAuthority`; whether a rung has a RESOLVER is build availability.
    // The first decides escalate legality (spec 11.5), the second only what the
    // act then DOES (ADR A1-12). Conflating them - which is what the removed
    // key did - deleted `escalate` from every Human-User leg, contradicting
    // spec 21.5. The reader owes rung identity and CURRENT-rung availability,
    // and nothing else.
  })
})

// --- the terminal outcome tables (spec §12, §24.2) ----------------------------

describe('the terminal outcome tables', () => {
  it('an undetermined ceiling is absorbing: it outranks every other axis (A5-2)', () => {
    for (const authorization of Object.values(TERMINAL_AUTHORIZATIONS)) {
      expect(
        deriveTerminalOperationOutcome({
          authorization,
          authority: TERMINAL_AUTHORITY_STATES.UNDETERMINED,
          execution: TERMINAL_EXECUTIONS.SUCCEEDED,
        }),
      ).toBe(TERMINAL_OPERATION_OUTCOMES.AUTHORITY_UNDETERMINED)
      expect(
        deriveTerminalMutationOutcome({
          authorization,
          authority: TERMINAL_AUTHORITY_STATES.UNDETERMINED,
          effect: TERMINAL_MUTATION_EFFECTS.CHANGED,
        }),
      ).toBe(TERMINAL_MUTATION_OUTCOMES.AUTHORITY_UNDETERMINED)
    }
  })

  it('an approved operation cannot execute its way past a missing resolver', () => {
    expect(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.ALLOWED,
        authority: TERMINAL_AUTHORITY_STATES.UNAVAILABLE,
        execution: TERMINAL_EXECUTIONS.SUCCEEDED,
      }),
    ).toBe(TERMINAL_OPERATION_OUTCOMES.AUTHORITY_UNAVAILABLE)
  })

  it('unavailable and undetermined are DIFFERENT outcomes (ADR A1-7, X8)', () => {
    expect(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.NONE,
        authority: TERMINAL_AUTHORITY_STATES.UNAVAILABLE,
        execution: TERMINAL_EXECUTIONS.UNAVAILABLE,
      }),
    ).not.toBe(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.NONE,
        authority: TERMINAL_AUTHORITY_STATES.UNDETERMINED,
        execution: TERMINAL_EXECUTIONS.UNAVAILABLE,
      }),
    )
  })

  it('the remaining cells are the decision, then staleness, then execution', () => {
    const resolved = TERMINAL_AUTHORITY_STATES.RESOLVED
    expect(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.DENIED,
        authority: resolved,
        execution: TERMINAL_EXECUTIONS.UNAVAILABLE,
      }),
    ).toBe(TERMINAL_OPERATION_OUTCOMES.DENIED)
    expect(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.STALE,
        authority: resolved,
        execution: TERMINAL_EXECUTIONS.UNAVAILABLE,
      }),
    ).toBe(TERMINAL_OPERATION_OUTCOMES.STALE)
    expect(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.ALLOWED,
        authority: resolved,
        execution: TERMINAL_EXECUTIONS.UNAVAILABLE,
      }),
    ).toBe(TERMINAL_OPERATION_OUTCOMES.EXECUTION_UNAVAILABLE)
    expect(
      deriveTerminalOperationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.ALLOWED,
        authority: resolved,
        execution: TERMINAL_EXECUTIONS.SUCCEEDED,
      }),
    ).toBe(TERMINAL_OPERATION_OUTCOMES.EXECUTION_SUCCEEDED)
  })

  it('an approved mutation that changed nothing reports mutation-no-change (acceptance 21.6)', () => {
    expect(
      deriveTerminalMutationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.ALLOWED,
        authority: TERMINAL_AUTHORITY_STATES.RESOLVED,
        effect: TERMINAL_MUTATION_EFFECTS.NO_CHANGE,
      }),
    ).toBe(TERMINAL_MUTATION_OUTCOMES.MUTATION_NO_CHANGE)
    expect(
      deriveTerminalMutationOutcome({
        authorization: TERMINAL_AUTHORIZATIONS.STALE,
        authority: TERMINAL_AUTHORITY_STATES.RESOLVED,
        effect: TERMINAL_MUTATION_EFFECTS.CHANGED,
      }),
    ).toBe(TERMINAL_MUTATION_OUTCOMES.MUTATION_STALE)
  })
})

// --- the strict / legacy discriminator (ADR X8) -------------------------------

describe('the strict / legacy row discriminator', () => {
  it('`approvalCaseId` presence alone selects the strict shape', () => {
    expect(controlRowShapeOf({})).toBe(CONTROL_ROW_SHAPES.LEGACY)
    expect(controlRowShapeOf({ approvalCaseId: 'case-1' })).toBe(CONTROL_ROW_SHAPES.STRICT)
  })

  it('a strict row missing reviewAuthority is corrupt, never defaulted', () => {
    expect(strictRowProblem({ approvalCaseId: 'case-1', legOrdinal: 1 })).toBe('missing-review-authority')
    expect(strictRowProblem({ approvalCaseId: 'case-1', legOrdinal: 1, reviewAuthority: 'leader' })).toBeUndefined()
    expect(strictRowProblem({ approvalCaseId: 'case-1', reviewAuthority: 'leader' })).toBe('missing-leg-ordinal')
  })

  it('a legacy row is never judged by the strict rules', () => {
    expect(strictRowProblem({})).toBeUndefined()
  })
})

// --- the projection over durable Control state (lane C) ----------------------

describe('the intervention projection over durable Control state', () => {
  it('projects one item per open CASE, bound to the operation fingerprint', () => {
    expect(durable.openItems).toHaveLength(1)
    const item = durable.openItems[0]
    expect(item?.interventionId).toBe(`int-${durable.approvalCaseId}`)
    expect(item?.status).toBe('open')
    expect(item?.responseBehavior).toBe(INTERVENTION_RESPONSE_BEHAVIORS.WAIT_FOR_RESPONSE)
    expect(item?.blockScope).toEqual({ kind: 'operation', operationFingerprint: 'fp-a4p3-proj-1' })
    expect(item?.source).toMatchObject({ kind: 'control-case', id: durable.approvalCaseId, legOrdinal: 1 })
    expect(item?.legalActions).toEqual([
      INTERVENTION_ACTIONS.ALLOW,
      INTERVENTION_ACTIONS.ESCALATE,
      INTERVENTION_ACTIONS.DENY,
    ])
  })

  it('asks the injected reader for the CURRENT leg, never a caller-supplied authority', () => {
    const asked = durable.seen[0]
    expect(asked?.legOrdinal).toBe(1)
    expect(asked?.reviewAuthority).toBe('leader')
    expect(asked?.requestedEffect).toBe('ask')
    expect(asked?.operationFingerprint).toBe('fp-a4p3-proj-1')
    expect(Object.keys(asked ?? {})).not.toContain('requiredAuthorityAtCreation')
  })

  it('a reader that THROWS yields no legal actions and no published authority (spec §18.3, audit F6)', () => {
    const item = durable.throwingItems[0]
    if (item === undefined) throw new Error('the open case must still project')
    expect(item.legalActions).toEqual([])
    // The fabrication the audit named: `requiredAuthority` came from the leg,
    // not from a reader. Absent facts means an ABSENT field, never the rung
    // the durable row happens to name.
    expect('requiredAuthority' in item).toBe(false)
    // The leg's own durable rung is not a fabrication - it is a read - so it
    // stays, and the reason says why nothing is offered.
    expect(item.derivationReasons).toContain(
      INTERVENTION_DERIVATION_REASONS.CEILING_UNDETERMINED,
    )
    expect(item.status).toBe('open')
  })

  it('offers NO legal action when no reader is wired (spec §18.3)', () => {
    expect(durable.openNoReader[0]?.legalActions).toEqual([])
    expect(durable.openNoReader[0]?.requiredAuthority).toBeUndefined()
  })

  it('an escalated case keeps the SAME item id at the risen leg and authority', () => {
    expect(durable.escalatedItems).toHaveLength(1)
    const item = durable.escalatedItems[0]
    expect(item?.interventionId).toBe(`int-${durable.approvalCaseId}`)
    expect(item?.source.legOrdinal).toBe(2)
    expect(item?.currentReviewAuthority).toBe('human-user')
    expect(item?.status).toBe('open')
  })

  it('a decided case is resolved and informational, holding nothing back', () => {
    const item = durable.decidedItems[0]
    expect(item?.status).toBe('resolved')
    expect(item?.responseBehavior).toBe(INTERVENTION_RESPONSE_BEHAVIORS.INFORMATIONAL)
    expect(item?.blockScope).toBeNull()
    expect(item?.legalActions).toEqual([])
  })

  it('an abandoned leg maps to `stale` and drops out of the open projection', () => {
    const abandoned = durable.allItems.find((item) => item.source.id === durable.thirdCaseId)
    // The open-case read no longer carries it, so the projection does not either:
    // the item is only reachable through the case read (PR6 surfaces it).
    expect(abandoned).toBeUndefined()
    expect(durable.openCaseIds).not.toContain(durable.thirdCaseId)
    // Derived from the REAL abandoned case: a synthetic `{ legs: [] }` fixture
    // would pin a shape the durable plane cannot produce (an abandonment
    // requires a leg row, and 14.1's `createdAt` has to come from one).
    const derived = durable.abandonedItems
    expect(derived.length).toBe(1)
    expect(derived[0]?.status).toBe('stale')
    expect(derived[0]?.derivationReasons).toContain(INTERVENTION_DERIVATION_REASONS.LEG_ABANDONED)
  })

  it('a zero-leg A1-12 case projects as one informational authority-unavailable item', () => {
    const item = projectZeroLegTermination({
      approvalCaseId: 'case-a1-12',
      requiredAuthority: 'human-admin',
      fingerprint: 'fp-a1-12',
      observedAt: '2026-09-01T09:00:00Z',
    })
    expect(item.status).toBe('authority-unavailable')
    expect(item.responseBehavior).toBe(INTERVENTION_RESPONSE_BEHAVIORS.INFORMATIONAL)
    expect(item.blockScope).toBeNull()
    expect(item.legalActions).toEqual([])
    // And a real A1-12 termination wrote a leg row that is DECIDED on arrival
    // (audit F2), so nothing is pending anywhere the projection can see (21.10).
    expect(durable.openCaseIds.length).toBeGreaterThanOrEqual(1)
    expect(CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE).toBe('authority-unavailable')
  })

  it('the projection carries no authority: mutating an item cannot change a guard verdict', () => {
    // (1) every item is deep-frozen, so the mutation is not even expressible
    expect(Object.isFrozen(durable.first)).toBe(true)
    expect(durable.mutationAttempt).not.toBe('mutated')
    // (2) and the guard verdict — the only thing an authority would change —
    // is identical before and after the attempt.
    expect((durable.guardBefore as ControlGuardVerdict).allowed).toBe(false)
    expect(JSON.stringify(durable.guardAfterMutation)).toBe(JSON.stringify(durable.guardBefore))
    expect((durable.guardOfAbandoned as ControlGuardVerdict).allowed).toBe(false)
  })
})

// --- the host fold: registration and the pending count (lane C duties) --------

describe('an instant is never invented (spec §14.1, audit F16)', () => {
  it('a case state whose rows carry no createdAt projects NO item', () => {
    // Not `createdAt: ''`, not the correlation token, not `new Date()`: the item
    // does not exist. A frozen field with a fabricated value is worse than an
    // absent item, because the client cannot tell the two apart.
    expect(durable.noInstantItem).toBeUndefined()
  })
})

describe('the host fold over the new fact type', () => {
  it('an escalation row does not break the read plane and lands in `control`', () => {
    expect(durable.escalationRows).toBe(1)
    const byCategory = durable.projection.byCategory
    expect(byCategory['control']).toBe(durable.controlCount)
    // The escalation row is counted EXACTLY once, in `control` (X8-R3).
    expect(byCategory['policy'] ?? 0).toBe(0)
    expect(
      Object.values(byCategory).reduce((total, value) => total + value, 0),
    ).toBe(durable.projection.totalEntries)
  })

  it('`pendingControlCount` does not count an abandoned request as pending (X8 duty)', () => {
    // The world holds exactly one still-open leg (the escalated case's leg 2);
    // the abandoned third case must not inflate the count.
    const abandonedIds = durable.openCaseIds
    expect(abandonedIds).toHaveLength(1)
    expect(durable.projection.pendingControlCount).toBe(1)
  })
})
