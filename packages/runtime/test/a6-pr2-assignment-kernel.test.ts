/**
 * Alpha.6 PR2′ (Lane 2) — the review router and the assignment fact family, tested as law.
 *
 * THE SHAPE OF THIS FILE follows PR0's: the majority of the legs are NEGATIONS. This lane exists to put
 * a Member in front of a queue that only the Leader may empty, inside a governance system whose value
 * is that Members decide nothing; the useful test is therefore the one that plants exactly one widening
 * and demands the typed refusal. Positives are few and narrow: the delegation works for one bound
 * officer on one bound case at one epoch, and nothing else.
 *
 * THREE PINS here are load-bearing beyond this lane's own arithmetic:
 *  - the **mirror pin** (§A-1) reads `src/plugin/projection-source.ts` and requires the three fact-type
 *    literals to be booked, under `team`, against the lane's own constants. The ledger is append-only:
 *    an unmapped `factType` does not fail a build, it breaks `team.getProjection` forever for every Team
 *    that writes the fact. `control-request-abandoned` and `artifact-read-granted` are both in that
 *    file's history, and both were found after shipping.
 *  - the **never-wider-than-admission pin** (§A-4) drives adversarial inputs through PR0's
 *    `evaluateReviewAdmission` and this router together, and fails if the router ever routes a case the
 *    admission gate would refuse. That property is the whole reason the router calls into PR0 instead of
 *    re-implementing a check.
 *  - the **closed-vocabulary pin** (§A-9) requires every refusal code to be producible and every
 *    produced code to be declared, in both directions, because this phase has already been burned twice
 *     by a vocabulary with an unreachable member and once by a hand-copied list that drifted from the
 *     source it copied.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { LEADER_INSTANCE_ID, MEMBER_LIFECYCLE_STATES } from '../../contracts/src/index.js'
import {
  evaluateReviewAdmission,
  parseReviewPlan,
  type ReviewCaseView,
  type ReviewMandate,
  type ReviewPlan,
} from '../review-mandate/index.js'
import {
  REVIEW_ASSIGNMENT_FACT_TYPES,
  REVIEW_ASSIGNMENT_FACT_TYPE_VALUES,
  REVIEW_ASSIGNMENT_FORBIDDEN_CATEGORIES,
  REVIEW_ASSIGNMENT_FROZEN_CATEGORY,
  REVIEW_ASSIGNMENT_PAYLOAD_FIELDS,
  REVIEW_ASSIGNMENT_REFUSALS,
  REVIEW_MEMBER_LIFECYCLE_STATE_VALUES,
  REVIEW_ROUTER_ELIGIBLE_LIFECYCLES,
  REVIEW_ROUTER_REASON_CODES,
  checkAssignmentMutation,
  decodeAssignmentPayload,
  encodeAssignmentFact,
  foldReviewAssignmentRows,
  isReviewAssignmentFactType,
  maySubmitFor,
  planHandoff,
  planRetirement,
  routeReviewCase,
  supersededTargetsOf,
  type ReviewAssignment,
  type ReviewAssignmentRefusal,
  type ReviewAssignmentRow,
  type ReviewAssignmentState,
  type ReviewAssignmentTarget,
  type ReviewRoutingDecision,
  type ReviewRoutingInput,
  type ReviewerCandidate,
} from '../review-assignment/index.js'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECTION_SOURCE = join(RUNTIME_ROOT, 'src', 'plugin', 'projection-source.ts')

const ROOT = 'team-root-01'
const CASE_ID = 'case-1f2e3d4c'
const LEG = 'req-9a8b7c'
const CASE_VERSION = 'casever-0001'
const OFFICER = 'inst-officer-1'
const OFFICER_REF = 'instance:inst-officer-1'
const WORKER_REF = 'instance:inst-worker-9'
const FINGERPRINT = 'ab12cd34ef560718293a4b5c6d7e8f90'
const OTHER_FINGERPRINT = '0f9e8d7c6b5a43210fedcba987654321'
const DIGEST_64 = 'd4e5f6a7b8c90123456789abcdef0123456789abcdef0123456789abcdef0123'

// --- fixtures ---------------------------------------------------------------------------------------

function plan(overrides: Record<string, unknown> = {}): ReviewPlan {
  // Overrides go into the RAW DOCUMENT and are re-parsed. PR0 brands a parsed plan on purpose: a spread
  // copy of a parsed plan never met the parser, and a fixture that spread would test the unbranded
  // refusal in every leg instead of the thing it means to test.
  const result = parseReviewPlan({
    rootSessionId: ROOT,
    blueprintDigest: DIGEST_64,
    epoch: 7,
    reviewerInstanceId: OFFICER,
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: FINGERPRINT }],
    expiresAtIso: null,
    ...overrides,
  })
  if (!result.ok) throw new Error(`fixture plan refused: ${result.failure.code}`)
  return result.plan
}

function caseView(overrides: Partial<ReviewCaseView> = {}): ReviewCaseView {
  return {
    approvalCaseId: CASE_ID,
    requestKind: 'leader-approval',
    legReviewAuthority: 'leader',
    legOrdinal: 1,
    currentLegOrdinal: 1,
    actedCallerRefs: [],
    requesterCallerRef: WORKER_REF,
    beneficiaryCallerRef: null,
    subjectCallerRef: null,
    actionName: 'fs:write',
    effectScopeFingerprint: FINGERPRINT,
    ...overrides,
  }
}

function mandate(overrides: Partial<ReviewMandate> = {}): ReviewMandate {
  return {
    approvalCaseId: CASE_ID,
    legOrdinal: 1,
    reviewerInstanceId: OFFICER,
    planEpoch: 7,
    actionName: 'fs:write',
    decisions: ['allow', 'deny'],
    effectScopeFingerprint: FINGERPRINT,
    revoked: false,
    generation: 1,
    ...overrides,
  }
}

function candidate(overrides: Partial<ReviewerCandidate> = {}): ReviewerCandidate {
  return {
    instanceId: OFFICER,
    callerRef: OFFICER_REF,
    lifecycle: MEMBER_LIFECYCLE_STATES.RUNNING,
    isLeaderInstance: false,
    ...overrides,
  }
}

function routingInput(overrides: Partial<ReviewRoutingInput> = {}): ReviewRoutingInput {
  return {
    rootSessionId: ROOT,
    currentLegRequestId: LEG,
    caseVersion: CASE_VERSION,
    caseView: caseView(),
    plan: plan(),
    mandate: mandate(),
    candidates: [candidate()],
    current: null,
    currentEpoch: 7,
    nowIso: '2026-10-31T09:00:00Z',
    planRevoked: false,
    ...overrides,
  }
}

function assignmentFor(
  epoch: number,
  target: ReviewAssignmentTarget = { kind: 'instance', instanceId: OFFICER },
  leg: string = LEG,
): ReviewAssignment {
  return {
    rootSessionId: ROOT,
    approvalCaseId: CASE_ID,
    currentLegRequestId: leg,
    target,
    assignmentEpoch: epoch,
    reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
    basedOnCaseVersion: CASE_VERSION,
    actorCallerRef: OFFICER_REF,
  }
}

/** Encode a valid row, or throw — the leg is about the fold, so an encoding failure is a fixture bug. */
function row(
  kind: 'created' | 'transferred' | 'retired',
  epoch: number,
  previousEpoch: number,
  target: ReviewAssignmentTarget = { kind: 'instance', instanceId: OFFICER },
  sequence: number = epoch,
  leg: string = LEG,
): ReviewAssignmentRow {
  const encoded = encodeAssignmentFact(kind, assignmentFor(epoch, target, leg), previousEpoch)
  if (!encoded.ok) throw new Error(`fixture row refused: ${encoded.refusal} ${encoded.detail}`)
  return { ledgerSequence: sequence, factType: REVIEW_ASSIGNMENT_FACT_TYPES[kind], payload: encoded.value }
}

function fold(rows: readonly ReviewAssignmentRow[]): ReviewAssignmentState {
  return foldReviewAssignmentRows(rows, ROOT, CASE_ID)
}

const EMPTY_STATE: ReviewAssignmentState = fold([])

function officerCaller() {
  return { instanceId: OFFICER, callerRef: OFFICER_REF, isLeaderInstance: false }
}

// --- A-1 an assignment never grants authority ---------------------------------------------------------

describe('A-1 the assignment fact cannot carry authority', () => {
  it('round-trips a created fact through exactly the closed field set', () => {
    const encoded = encodeAssignmentFact('created', assignmentFor(1), 0)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(Object.keys(encoded.value).sort()).toEqual([...REVIEW_ASSIGNMENT_PAYLOAD_FIELDS].sort())
    const decoded = decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, encoded.value)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.value).toEqual(encoded.value)
  })

  it('refuses a payload that carries reviewAuthority, and names the authority law rather than the schema', () => {
    const smuggled = {
      rootSessionId: ROOT,
      approvalCaseId: CASE_ID,
      currentLegRequestId: LEG,
      targetKind: 'instance',
      targetInstanceId: OFFICER,
      assignmentEpoch: 1,
      previousEpoch: 0,
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: CASE_VERSION,
      actorCallerRef: OFFICER_REF,
      reviewAuthority: 'leader',
    }
    const decoded = decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, smuggled)
    expect(decoded.ok).toBe(false)
    if (decoded.ok) return
    expect(decoded.refusal).toBe('REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT')
  })

  it('refuses every authority-bearing key shape a well-meaning writer might reach for', () => {
    const keys = [
      'reviewAuthority',
      'requiredAuthorityAtCreation',
      'rung',
      'legRung',
      'permission',
      'permissions',
      'grant',
      'grantId',
      'allow',
      'allowOnce',
      'deny',
      'decision',
      'decisionValue',
      'mandateId',
      'mandateGeneration',
      'effectSet',
      'effectScopeFingerprint',
    ]
    const produced = new Set<string>()
    for (const key of keys) {
      const base = encodeAssignmentFact('created', assignmentFor(1), 0)
      if (!base.ok) throw new Error('fixture broken')
      const smuggled = { ...base.value, [key]: 'anything' }
      const decoded = decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, smuggled)
      expect(decoded.ok, `${key} slipped through`).toBe(false)
      if (!decoded.ok) produced.add(decoded.refusal)
    }
    // Not one of them is reported as a generic unknown field: an attempt to grant authority is
    // reported as what it is.
    expect(produced).toEqual(new Set(['REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT']))

    // THE PART THAT MAKES THE LIST ABOVE HONEST (review F-11). The keys above are the spellings the lane's
    // author thought of, which is exactly the set a marker list tends to match and no wider — the review
    // found `approvedBy`, `escalatedTo`, `signoffInstance`, `scope` and `role` landing on the generic
    // `FIELD_UNKNOWN` instead, bending the lane's promise that an authority attempt is named AS SUCH
    // (nothing was ever smuggled either way: every undeclared key is refused). So this second half does not
    // trust the list above or the list in `facts.ts`: it reads the marker array out of the source and
    // demands that EVERY marker inside it be reachable through a real decode. A marker nobody can hit, or a
    // marker added without a shape to prove it, fails here instead of in someone's head at review time.
    const factsSource = readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'facts.ts'), 'utf8')
    const markerBlock = /const AUTHORITY_BEARING_KEY_MARKERS: readonly string\[\] = \[([\s\S]*?)\]/.exec(factsSource)
    expect(markerBlock, 'the marker list is no longer a literal array this leg can read').not.toBeNull()
    // Strip comments BEFORE pairing quotes: the block's own prose contains apostrophes ("the lane's
    // author"), and a naive quote pairing pairs one of those with a real quote and reads nonsense. This
    // bit the leg on its first run, which is a good argument for deriving the list at all.
    const markerBody = (markerBlock?.[1] ?? '').replace(/^[ \t]*\/\/[^\n]*$/gm, '')
    const markers = [...markerBody.matchAll(/'([^']+)'/g)].map((match) => match[1] as string)
    expect(markers.length).toBeGreaterThanOrEqual(17)
    // The eight words the review named, required by name so a future tidy-up cannot delete a guard by
    // deleting its entry.
    for (const word of ['approv', 'escalat', 'authoriz', 'permit', 'veto', 'signoff', 'scope', 'role']) {
      expect(markers, `the marker ${word} disappeared from the guard`).toContain(word)
    }
    const reached = new Set<string>()
    for (const marker of markers) {
      const base = encodeAssignmentFact('created', assignmentFor(1), 0)
      if (!base.ok) throw new Error('fixture broken')
      const decoded = decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, { ...base.value, [`x${marker}Y`]: true })
      expect(decoded.ok, `a payload key containing "${marker}" was accepted`).toBe(false)
      if (!decoded.ok) reached.add(decoded.refusal)
      expect(
        decoded.ok ? '' : decoded.refusal,
        `a key containing "${marker}" answered ${decoded.ok ? 'nothing' : decoded.refusal} instead of the authority code`,
      ).toBe('REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT')
    }
    expect(reached).toEqual(new Set(['REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT']))
    // The exemption that makes the above possible, pinned so it cannot widen: a DECLARED field whose name
    // contains a marker is legal, because it is a closed typed identifier and not a capability.
    const legal = encodeAssignmentFact('created', assignmentFor(1), 0)
    expect(legal.ok).toBe(true)
    if (legal.ok) {
      expect(decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, legal.value).ok, 'approvalCaseId is a declared field, not an authority claim').toBe(true)
    }
  })

  it('still refuses an ordinary unknown field, with the unknown-field code', () => {
    const base = encodeAssignmentFact('created', assignmentFor(1), 0)
    if (!base.ok) throw new Error('fixture broken')
    const decoded = decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, { ...base.value, note: 'x' })
    expect(decoded.ok).toBe(false)
    if (decoded.ok) return
    expect(decoded.refusal).toBe('REVIEW_ASSIGNMENT_FIELD_UNKNOWN')
  })

  it('refuses a payload missing any field of the closed set', () => {
    for (const field of REVIEW_ASSIGNMENT_PAYLOAD_FIELDS) {
      const base = encodeAssignmentFact('created', assignmentFor(1), 0)
      if (!base.ok) throw new Error('fixture broken')
      const stripped: Record<string, unknown> = { ...base.value }
      delete stripped[field]
      const decoded = decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, stripped)
      expect(decoded.ok, `missing ${field} accepted`).toBe(false)
      if (!decoded.ok) expect(decoded.refusal).toBe('REVIEW_ASSIGNMENT_INPUT_MALFORMED')
    }
  })

  it('books all three fact types in the frozen category table, under `team` and never under an authority category', () => {
    const source = readFileSync(PROJECTION_SOURCE, 'utf8')
    expect(source).not.toBe('')
    expect(REVIEW_ASSIGNMENT_FROZEN_CATEGORY).toBe('team')
    expect(REVIEW_ASSIGNMENT_FORBIDDEN_CATEGORIES).toContain('control')
    for (const factType of REVIEW_ASSIGNMENT_FACT_TYPE_VALUES) {
      // The map holds the module's own constant names, so the pin is two hops: the literal must be
      // declared as a constant, and THAT constant must be the key of a map entry. A pin that looked for
      // the literal inside the map would pass on nothing and fail on the real thing.
      const declared = new RegExp(`const\\s+(FACT_[A-Z0-9_]+)\\s*=\\s*'${factType}'`).exec(source)
      expect(declared, `${factType} is not declared as a mirrored constant in the projection module`).not.toBeNull()
      const name = declared?.[1] as string
      const entry = new RegExp(`\\[${name}\\s*,\\s*'([a-z]+)'\\s*\\]`).exec(source)
      expect(entry, `${name} is not an entry of FACT_TYPE_CATEGORY — the fold would throw forever`).not.toBeNull()
      expect(entry?.[1], `${factType} booked under the wrong category`).toBe(REVIEW_ASSIGNMENT_FROZEN_CATEGORY)
      expect(REVIEW_ASSIGNMENT_FORBIDDEN_CATEGORIES).not.toContain(entry?.[1])
    }
  })

  it('keeps the fact names exactly as PR #319 §6 specified them', () => {
    // The design left the naming to S0 to confirm; this is the pin that keeps a later "cleanup" from
    // renaming a fact type on an append-only ledger.
    expect(REVIEW_ASSIGNMENT_FACT_TYPES).toEqual({
      created: 'review-assignment-created',
      transferred: 'review-assignment-transferred',
      retired: 'review-assignment-retired',
    })
    expect(REVIEW_ASSIGNMENT_FACT_TYPE_VALUES.every((value) => /^[a-z0-9][a-z0-9-]{0,127}$/.test(value))).toBe(true)
    expect(isReviewAssignmentFactType('control-escalation-recorded')).toBe(false)
  })
})

// --- A-2 one current handler, by CAS -------------------------------------------------------------------

describe('A-2 exactly one current handler per case, changed only by CAS', () => {
  it('folds a single created row into a live epoch-1 assignment', () => {
    const state = fold([row('created', 1, 0)])
    expect(state.live).toBe(true)
    expect(state.epochApplied).toBe(1)
    expect(state.unreconciled).toBe(false)
    expect(state.assignment?.target).toEqual({ kind: 'instance', instanceId: OFFICER })
  })

  it('refuses a second created row instead of replacing the handler', () => {
    // Both rows are individually well-formed created facts; only the fold knows the first one already
    // stands. A "second created" row that encode itself refuses would test the encoder, not the law.
    const state = fold([row('created', 1, 0), row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 2)])
    expect(state.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_ALREADY_ACTIVE'])
    expect(state.epochApplied).toBe(1)
    expect(state.unreconciled).toBe(true)
  })

  it('cannot encode a created row that replaces anything other than epoch 0', () => {
    const encoded = encodeAssignmentFact('created', assignmentFor(2), 1)
    expect(encoded.ok).toBe(false)
    if (encoded.ok) return
    expect(encoded.refusal).toBe('REVIEW_ASSIGNMENT_SEQUENCE_INVALID')
  })

  it('cannot encode an epoch that is not previousEpoch + 1', () => {
    const encoded = encodeAssignmentFact('transferred', assignmentFor(5, { kind: 'leader' }), 1)
    expect(encoded.ok).toBe(false)
    if (encoded.ok) return
    expect(encoded.refusal).toBe('REVIEW_ASSIGNMENT_SEQUENCE_INVALID')
  })

  it('drops a transfer that lost the CAS race and changes nothing', () => {
    const state = fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'instance', instanceId: 'inst-other-1' })])
    expect(state.live).toBe(true)
    // The loser states epoch 1 as its predecessor, which the family left behind when the first transfer
    // applied. It is well-formed on its own terms — encode would take it — and only the folded state can
    // tell that it arrived too late.
    const late = fold([
      row('created', 1, 0),
      row('transferred', 2, 1, { kind: 'instance', instanceId: 'inst-other-1' }, 2),
      row('transferred', 2, 1, { kind: 'leader' }, 3),
    ])
    expect(late.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_EPOCH_CONFLICT'])
    expect(late.epochApplied).toBe(2)
    expect(late.assignment?.target).toEqual({ kind: 'instance', instanceId: 'inst-other-1' })
  })

  it('refuses a transfer to the target that already holds the case', () => {
    const state = fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'instance', instanceId: OFFICER })])
    expect(state.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_TARGET_UNCHANGED'])
    expect(state.epochApplied).toBe(1)
  })

  it('applies created → transferred → transferred to an epoch-3 leader assignment', () => {
    const state = fold([
      row('created', 1, 0),
      row('transferred', 2, 1, { kind: 'instance', instanceId: 'inst-other-1' }, 2),
      row('transferred', 3, 2, { kind: 'leader' }, 3),
    ])
    expect(state.epochApplied).toBe(3)
    expect(state.live).toBe(true)
    expect(state.assignment?.target).toEqual({ kind: 'leader' })
    expect(state.diagnostics).toEqual([])
  })

  it('retires a case without erasing who used to hold it', () => {
    const state = fold([row('created', 1, 0), row('retired', 2, 1, { kind: 'instance', instanceId: OFFICER }, 2)])
    expect(state.live).toBe(false)
    expect(state.epochApplied).toBe(2)
    expect(state.assignment?.target).toEqual({ kind: 'instance', instanceId: OFFICER })
    expect(supersededTargetsOf(state)).toEqual([{ kind: 'instance', instanceId: OFFICER }])
  })

  it('refuses a second retirement', () => {
    const state = fold([
      row('created', 1, 0),
      row('retired', 2, 1, { kind: 'instance', instanceId: OFFICER }, 2),
      row('retired', 3, 2, { kind: 'instance', instanceId: OFFICER }, 3),
    ])
    expect(state.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT'])
    expect(state.epochApplied).toBe(2)
  })

  it('refuses a transfer or retirement before anything was created', () => {
    // An orphan transfer names epoch 1 as its predecessor, and the family has no epoch at all, so the
    // honest diagnosis is the epoch conflict. `NO_ACTIVE_ASSIGNMENT` is the code for a row that names the
    // CURRENT epoch of a case whose handler has already been retired — that path has its own leg below,
    // and collapsing the two would hide which of the two races happened.
    const orphan = fold([row('transferred', 2, 1, { kind: 'leader' })])
    expect(orphan.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_EPOCH_CONFLICT'])
    expect(orphan.epochApplied).toBe(0)
    expect(orphan.assignment).toBeNull()
  })

  it('reports out-of-order rows instead of folding a family in the wrong order', () => {
    const state = fold([row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 5), row('transferred', 2, 1, { kind: 'leader' }, 4)])
    expect(state.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_SEQUENCE_INVALID'])
    expect(state.assignment?.target).toEqual({ kind: 'instance', instanceId: OFFICER })
  })

  it('reports a row that belongs to another Team and never applies it', () => {
    const foreign = encodeAssignmentFact(
      'created',
      { ...assignmentFor(1), rootSessionId: 'team-root-OTHER' },
      0,
    )
    if (!foreign.ok) throw new Error('fixture broken')
    const state = fold([
      row('created', 1, 0),
      { ledgerSequence: 2, factType: REVIEW_ASSIGNMENT_FACT_TYPES.transferred, payload: { ...foreign.value, approvalCaseId: CASE_ID, assignmentEpoch: 2, previousEpoch: 1, targetKind: 'leader', targetInstanceId: null } },
    ])
    expect(state.diagnostics[0]?.refusal).toBe('REVIEW_ASSIGNMENT_CROSS_TEAM_ROW')
    expect(state.epochApplied).toBe(1)
  })

  it('ignores a row of ANOTHER case without a diagnostic, because the honest reader folds one ledger per case', () => {
    // Review F-3 changed this law, so the reason belongs next to the assertion. A durable reader has one
    // shape available to it: read the OPENED team's ledger once (`repositories.ledger.list()`), then fold
    // it once per case — there is no per-case index, and inventing one is the mistake PR3′ §2 refuses for
    // wake slots. The first version of the fold answered `CASE_MISMATCH` for every foreign-case row of this
    // family, so that reader marked EVERY case `unreconciled`, and since every consumer refuses an
    // unreconciled view the whole feature would have been dead on arrival — refusing every wake in every
    // team that turned it on. Nothing crosses case boundaries here anyway: the epoch chain, the target and
    // the leg all come from rows of the case being folded. So silence is correct for a foreign CASE, while
    // a foreign TEAM stays loud (the next-but-one leg): the opened repository cannot contain one by accident.
    const base = encodeAssignmentFact('created', assignmentFor(1), 0)
    if (!base.ok) throw new Error('fixture broken')
    const otherOpen = encodeAssignmentFact('created', { ...assignmentFor(1), approvalCaseId: 'case-OTHER' }, 0)
    if (!otherOpen.ok) throw new Error('fixture broken')
    // One team ledger, two cases interleaved, exactly as `repositories.ledger.list()` would hand it over.
    const ledger: ReviewAssignmentRow[] = [
      row('created', 1, 0),
      { ledgerSequence: 2, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: otherOpen.value },
      {
        ledgerSequence: 3,
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.transferred,
        // A transfer to the LEADER: transferring to the same target the other case's row already names
        // would be refused as `TARGET_UNCHANGED`, and this fixture is about cross-case silence, not about
        // that law (which has its own leg).
        payload: {
          ...base.value,
          approvalCaseId: 'case-OTHER',
          targetKind: 'leader',
          targetInstanceId: null,
          assignmentEpoch: 2,
          previousEpoch: 1,
        },
      },
    ]

    const mine = foldReviewAssignmentRows(ledger, ROOT, CASE_ID)
    expect(mine.diagnostics).toEqual([])
    expect(mine.unreconciled).toBe(false)
    expect(mine.epochApplied).toBe(1)

    // And nothing is lost, only elsewhere: the same three rows folded for the case the other two name
    // reach epoch 2 cleanly. A-7 forbids losing a row of this family; it never promised that each case's
    // fold reports every row of every case.
    const theirs = foldReviewAssignmentRows(ledger, ROOT, 'case-OTHER')
    expect(theirs.diagnostics).toEqual([])
    expect(theirs.unreconciled).toBe(false)
    expect(theirs.epochApplied).toBe(2)

    // The ordering rule that makes the two views above possible, in both directions. FOREIGN rows do not
    // move this family's sequence watermark — so reading the ledger back to front still folds this case
    // correctly, because the only row of ours is untouched. And our OWN rows fed out of order ARE
    // diagnosed: the protection is about this family's order, which is the only order the fold claims.
    expect(foldReviewAssignmentRows([...ledger].reverse(), ROOT, CASE_ID).diagnostics).toEqual([])
    expect(
      foldReviewAssignmentRows(
        // Same two rows, same epoch chain, ledger order inverted: created at sequence 2, the transfer
        // that must follow it at sequence 1.
        [row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 2), row('transferred', 2, 1, { kind: 'leader' }, 1)],
        ROOT,
        CASE_ID,
      ).diagnostics.map((d) => d.refusal),
    ).toEqual(['REVIEW_ASSIGNMENT_SEQUENCE_INVALID'])
  })

  it('ignores every other fact family without a diagnostic — the fold needs no second index', () => {
    const interleaved: ReviewAssignmentRow[] = [
      { ledgerSequence: 1, factType: 'control-request-recorded', payload: { requestId: 'req-x' } },
      row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 2),
      { ledgerSequence: 3, factType: 'control-escalation-recorded', payload: { requestId: 'req-x' } },
      { ledgerSequence: 4, factType: 'team-coordination-recorded', payload: {} },
      row('transferred', 2, 1, { kind: 'leader' }, 5),
    ]
    const state = fold(interleaved)
    expect(state.diagnostics).toEqual([])
    expect(state.unreconciled).toBe(false)
    expect(state.epochApplied).toBe(2)
  })

  it('agrees with its own pre-flight check: the writer is told yes exactly when the fold would apply the row', () => {
    // The pre-flight is a convenience, the fold is the law. If the two ever disagree, a caller either
    // burns sequence numbers on rows that are refused or, worse, is told "no" about a row that would
    // have applied. This leg walks the disagreement in both directions over every state shape.
    const officerTarget: ReviewAssignmentTarget = { kind: 'instance', instanceId: OFFICER }
    const scenarios: readonly {
      readonly name: string
      readonly base: readonly ReviewAssignmentRow[]
      readonly kind: 'created' | 'transferred' | 'retired'
      readonly target: ReviewAssignmentTarget
    }[] = [
      { name: 'fresh / created', base: [], kind: 'created', target: officerTarget },
      { name: 'fresh / transferred', base: [], kind: 'transferred', target: { kind: 'leader' } },
      { name: 'live / created again', base: [row('created', 1, 0)], kind: 'created', target: officerTarget },
      { name: 'live / transferred to the Leader', base: [row('created', 1, 0)], kind: 'transferred', target: { kind: 'leader' } },
      { name: 'live / transferred to the same target', base: [row('created', 1, 0)], kind: 'transferred', target: officerTarget },
      {
        name: 'retired / retired again',
        base: [row('created', 1, 0), row('retired', 2, 1, officerTarget, 2)],
        kind: 'retired',
        target: officerTarget,
      },
      {
        name: 'unreconciled / transferred',
        base: [{ ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: 'not a record' }],
        kind: 'transferred',
        target: { kind: 'leader' },
      },
    ]
    for (const scenario of scenarios) {
      const state = fold(scenario.base)
      const preflight = checkAssignmentMutation(state, scenario.kind, scenario.target, LEG)
      const epoch = preflight.ok ? preflight.value.assignmentEpoch : state.epochApplied + 1
      let appended = state
      let encodable = true
      try {
        appended = fold([...scenario.base, row(scenario.kind, epoch, state.epochApplied, scenario.target, 1_000)])
      } catch {
        encodable = false // the writer could not even build the row; the fold never saw it
      }
      const applied = encodable && appended.epochApplied === epoch && appended.diagnostics.length === state.diagnostics.length
      expect(applied, `${scenario.name}: pre-flight said ${preflight.ok ? 'yes' : preflight.refusal}, the fold said ${applied}`).toBe(preflight.ok)
    }
  })
})

// --- A-3 a superseded target may not submit -------------------------------------------------------------

describe('A-3 the superseded target is refused, and so is everyone else', () => {
  const handedOff = fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'leader' }, 2)])

  it('refuses the officer after a handoff moved the case to the Leader', () => {
    const answer = maySubmitFor(handedOff, officerCaller(), 2)
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_STALE_TARGET')
  })

  it('accepts the Leader at the current epoch', () => {
    const answer = maySubmitFor(handedOff, { instanceId: LEADER_INSTANCE_ID, callerRef: 'instance:inst-leader', isLeaderInstance: true }, 2)
    expect(answer.ok).toBe(true)
  })

  it('refuses an unrelated Member even when it presents the right epoch', () => {
    const answer = maySubmitFor(handedOff, { instanceId: 'inst-random-3', callerRef: 'instance:inst-random-3', isLeaderInstance: false }, 2)
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_STALE_TARGET')
  })

  it('refuses the CURRENT target when it presents an epoch it already lost', () => {
    const assigned = fold([row('created', 1, 0)])
    const answer = maySubmitFor(assigned, officerCaller(), 0)
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_STALE_TARGET')
  })

  it('refuses everyone after a retirement', () => {
    const retired = fold([row('created', 1, 0), row('retired', 2, 1, { kind: 'instance', instanceId: OFFICER }, 2)])
    expect(maySubmitFor(retired, officerCaller(), 2).ok).toBe(false)
    const answer = maySubmitFor(retired, officerCaller(), 2)
    expect(!answer.ok && answer.refusal).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')
    expect(maySubmitFor(retired, { instanceId: LEADER_INSTANCE_ID, callerRef: 'instance:inst-leader', isLeaderInstance: true }, 2).ok).toBe(false)
  })

  it('refuses the Leader target claim of an instance the host says IS the Leader, and vice versa', () => {
    const assigned = fold([row('created', 1, 0)])
    // The officer presenting itself as the Leader gets nothing: the Leader identity comes from the host.
    expect(maySubmitFor(assigned, { instanceId: OFFICER, callerRef: OFFICER_REF, isLeaderInstance: true }, 1).ok).toBe(false)
    const leaderCase = fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'leader' }, 2)])
    expect(maySubmitFor(leaderCase, { instanceId: OFFICER, callerRef: OFFICER_REF, isLeaderInstance: true }, 2).ok).toBe(false)
  })

  it('refuses on an unreconciled fold rather than reading "no handler" out of a broken read', () => {
    const broken = fold([
      row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 1),
      { ledgerSequence: 2, factType: REVIEW_ASSIGNMENT_FACT_TYPES.transferred, payload: 42 },
    ])
    expect(broken.unreconciled).toBe(true)
    const answer = maySubmitFor(broken, officerCaller(), 1)
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE')
  })
})

// --- A-4 / A-5 the router is deterministic and fails closed to the Leader -------------------------------

describe('A-4 the router routes one bound officer or leaves the case with the Leader', () => {
  it('assigns the plan-bound officer at epoch 1 when plan, mandate and lifecycle all line up', () => {
    const answer = routeReviewCase(routingInput())
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value).toEqual({
      kind: 'assign',
      target: { kind: 'instance', instanceId: OFFICER },
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      expectedPreviousEpoch: 0,
      assignmentEpoch: 1,
    } satisfies ReviewRoutingDecision)
  })

  it('is deterministic: the same inputs twice, and the same inputs with the candidate list reversed', () => {
    const first = routeReviewCase(routingInput({ candidates: [candidate(), { ...candidate(), instanceId: 'inst-zzz-9', callerRef: 'instance:inst-zzz-9' }] }))
    const second = routeReviewCase(routingInput({ candidates: [{ ...candidate(), instanceId: 'inst-zzz-9', callerRef: 'instance:inst-zzz-9' }, candidate()] }))
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value).toEqual(first.value)
    expect(routeReviewCase(routingInput())).toEqual(first)
  })

  it('routes to a SETTLED officer, because that is the state a wake is delivered to', () => {
    const answer = routeReviewCase(routingInput({ candidates: [candidate({ lifecycle: MEMBER_LIFECYCLE_STATES.SETTLED })] }))
    expect(answer.ok && answer.value.kind).toBe('assign')
    expect(REVIEW_ROUTER_ELIGIBLE_LIFECYCLES).toEqual([MEMBER_LIFECYCLE_STATES.RUNNING, MEMBER_LIFECYCLE_STATES.SETTLED])
  })

  it('leaves the case with the Leader for every state an instance cannot be routed in', () => {
    const notRoutable = REVIEW_MEMBER_LIFECYCLE_STATE_VALUES.filter(
      (state) => !REVIEW_ROUTER_ELIGIBLE_LIFECYCLES.includes(state),
    )
    expect(notRoutable.length).toBeGreaterThan(0)
    for (const lifecycle of notRoutable) {
      const answer = routeReviewCase(routingInput({ candidates: [candidate({ lifecycle })] }))
      expect(answer.ok, `${lifecycle} produced a refusal`).toBe(true)
      if (!answer.ok) continue
      expect(answer.value.kind, `${lifecycle} routed anyway`).toBe('leaveWithLeader')
      if (answer.value.kind === 'leaveWithLeader') {
        expect(answer.value.reasonCode).toBe('LEADER_NO_ELIGIBLE_REVIEWER')
        expect(answer.value.detail).toContain(lifecycle)
      }
    }
  })

  it('leaves a leg-less row with the Leader instead of fabricating a case', () => {
    const answer = routeReviewCase(routingInput({ caseView: caseView({ approvalCaseId: undefined }) }))
    expect(answer.ok && answer.value.kind === 'leaveWithLeader' && answer.value.reasonCode).toBe('LEADER_NO_APPROVAL_CASE_ID')
  })

  it('leaves a stale leg with the Leader', () => {
    const answer = routeReviewCase(routingInput({ caseView: caseView({ legOrdinal: 1, currentLegOrdinal: 2 }) }))
    expect(answer.ok && answer.value.kind === 'leaveWithLeader' && answer.value.reasonCode).toBe('LEADER_LEG_NOT_CURRENT')
  })

  it('treats the plan as a hard precondition: absent, and a hand-built unbranded copy, both leave it alone', () => {
    const absent = routeReviewCase(routingInput({ plan: null }))
    expect(absent.ok && absent.value.kind === 'leaveWithLeader' && absent.value.reasonCode).toBe('LEADER_PLAN_ABSENT')
    const parsed = plan()
    const unbranded = { ...parsed } as ReviewPlan
    const copied = routeReviewCase(routingInput({ plan: unbranded }))
    expect(copied.ok && copied.value.kind === 'leaveWithLeader' && copied.value.reasonCode).toBe('LEADER_PLAN_ABSENT')
    expect(parsed).toEqual(unbranded)
  })

  it('leaves the case with the Leader when the plan belongs to another epoch', () => {
    const answer = routeReviewCase(routingInput({ currentEpoch: 8 }))
    expect(answer.ok && answer.value.kind === 'leaveWithLeader' && answer.value.reasonCode).toBe('LEADER_PLAN_EPOCH_STALE')
  })

  it('refuses rather than routes when the plan belongs to another Team', () => {
    const answer = routeReviewCase(routingInput({ plan: plan({ rootSessionId: 'team-root-OTHER' }) }))
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE')
  })

  it('answers the mandate law with a distinct reason for absent, revoked and non-covering', () => {
    const widenings: readonly (readonly [string, Partial<ReviewRoutingInput>])[] = [
      ['absent', { mandate: null }],
      ['revoked', { mandate: mandate({ revoked: true }) }],
      ['other case', { mandate: mandate({ approvalCaseId: 'case-OTHER' }) }],
      ['other leg', { mandate: mandate({ legOrdinal: 2 }) }],
      ['other action', { mandate: mandate({ actionName: 'fs:read' }) }],
      ['other effect set', { mandate: mandate({ effectScopeFingerprint: OTHER_FINGERPRINT }) }],
      ['older plan epoch', { mandate: mandate({ planEpoch: 6 }) }],
    ]
    const seen = new Set<string>()
    for (const [name, overrides] of widenings) {
      const answer = routeReviewCase(routingInput(overrides))
      expect(answer.ok, name).toBe(true)
      if (!answer.ok) continue
      expect(answer.value.kind, name).toBe('leaveWithLeader')
      if (answer.value.kind === 'leaveWithLeader') seen.add(answer.value.reasonCode)
    }
    expect([...seen].sort()).toEqual(['LEADER_MANDATE_ABSENT', 'LEADER_MANDATE_NOT_COVERING', 'LEADER_MANDATE_REVOKED'])
  })

  it('leaves the case with the Leader when the host snapshot does not contain the bound officer', () => {
    const answer = routeReviewCase(routingInput({ candidates: [{ ...candidate(), instanceId: 'inst-someone-else', callerRef: 'instance:inst-someone-else' }] }))
    expect(answer.ok && answer.value.kind === 'leaveWithLeader' && answer.value.reasonCode).toBe('LEADER_NO_ELIGIBLE_REVIEWER')
  })

  it('refuses loudly when the plan-bound officer turns out to BE the Leader instance', () => {
    const answer = routeReviewCase(routingInput({ candidates: [candidate({ isLeaderInstance: true })] }))
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_TARGET_IS_LEADER_INSTANCE')
  })

  it('never routes a case the officer has a hand in — requester, beneficiary or subject', () => {
    const selfInterests: readonly (readonly [string, Partial<ReviewCaseView>])[] = [
      ['requester', { requesterCallerRef: OFFICER_REF }],
      ['beneficiary', { beneficiaryCallerRef: OFFICER_REF }],
      ['subject', { subjectCallerRef: OFFICER_REF }],
    ]
    for (const [name, overrides] of selfInterests) {
      const answer = routeReviewCase(routingInput({ caseView: caseView(overrides) }))
      expect(answer.ok, name).toBe(true)
      if (!answer.ok) continue
      expect(answer.value.kind, `the officer was routed its own ${name} case`).toBe('leaveWithLeader')
    }
  })

  it('refuses a candidate snapshot it cannot trust: a duplicate, a bad id, an unknown lifecycle', () => {
    const broken: readonly (readonly [string, ReviewerCandidate[]])[] = [
      ['duplicate', [candidate(), candidate()]],
      ['bad id', [candidate({ instanceId: 'inst officer!' })]],
      ['unknown lifecycle', [candidate({ lifecycle: 'SLEEPING' })]],
      ['empty caller ref', [candidate({ callerRef: '' })]],
    ]
    for (const [name, candidates] of broken) {
      const answer = routeReviewCase(routingInput({ candidates }))
      expect(answer.ok, `${name} was routed anyway`).toBe(false)
      if (!answer.ok) expect(answer.refusal, name).toBe('REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED')
    }
  })

  it('refuses rather than guesses when the folded assignment view is broken', () => {
    const broken = fold([{ ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: null }])
    expect(broken.unreconciled).toBe(true)
    const answer = routeReviewCase(routingInput({ current: broken }))
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE')
    expect(answer.detail).toContain('unreconciled')
  })

  it('refuses input that is not input at all', () => {
    const broken: readonly (readonly [string, Partial<ReviewRoutingInput>])[] = [
      ['bad root', { rootSessionId: 'team root' }],
      ['bad leg id', { currentLegRequestId: '' }],
      ['bad case version', { caseVersion: '' }],
      ['no case view', { caseView: null as unknown as ReviewCaseView }],
      ['candidates not an array', { candidates: null as unknown as ReviewerCandidate[] }],
      ['no clock supplied', { nowIso: '' }],
      ['bad epoch', { currentEpoch: -1 }],
      ['other team current view', { current: foldReviewAssignmentRows([], 'team-root-OTHER', CASE_ID) }],
    ]
    for (const [name, overrides] of broken) {
      const answer = routeReviewCase(routingInput(overrides))
      expect(answer.ok, `${name} produced a decision`).toBe(false)
      if (!answer.ok) expect(answer.refusal, name).toBe('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE')
    }
  })

  it('keeps an existing assignment to the same officer without burning an epoch', () => {
    const current = fold([row('created', 1, 0)])
    const answer = routeReviewCase(routingInput({ current }))
    expect(answer.ok && answer.value).toEqual({
      kind: 'keep',
      target: { kind: 'instance', instanceId: OFFICER },
      reasonCode: 'ROUTER_ALREADY_ASSIGNED',
      assignmentEpoch: 1,
    })
  })

  it('does NOT steal a case the Leader took over by handoff', () => {
    // The law this leg exists for: a handoff is a decision that the Leader's global information is
    // needed. A later wake is not a new argument, and re-routing on it would silently reverse the
    // Leader's decision every time the officer's mandate happened to still cover the case.
    const current = fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'leader' }, 2)])
    const answer = routeReviewCase(routingInput({ current }))
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value.kind).toBe('leaveWithLeader')
    if (answer.value.kind === 'leaveWithLeader') {
      expect(answer.value.reasonCode).toBe('ROUTER_ALREADY_ASSIGNED')
      expect(answer.value.leaderAlreadyTarget).toBe(true)
      expect(answer.value.expectedPreviousEpoch).toBe(2)
    }
  })

  it('reassigns when the plan binds a different officer, at the next epoch', () => {
    // The reason code used to claim the old target had become INELIGIBLE; the router never evaluates the
    // old target at all, it only compares the plan's bound officer with the current target (review F-7).
    // A reason code may state what the code checked, and this phase has already deleted vocabulary for less.
    const current = fold([row('created', 1, 0, { kind: 'instance', instanceId: 'inst-old-officer' })])
    const answer = routeReviewCase(routingInput({ current }))
    expect(answer.ok && answer.value).toEqual({
      kind: 'assign',
      target: { kind: 'instance', instanceId: OFFICER },
      reasonCode: 'ROUTER_PLAN_BINDS_DIFFERENT_OFFICER',
      expectedPreviousEpoch: 1,
      assignmentEpoch: 2,
    })
  })

  it('leaves the case with the Leader when the case has moved to a new leg — a router cannot order what its writer cannot write', () => {
    // REVIEW F-1, and this is the leg that used to PIN the bug: it asserted `assign` at epoch 2 for a
    // family standing on an old leg. Three row kinds is all this lane has, and none can express "assign
    // this case's NEW leg": `created` may only replace epoch 0, `transferred` and `retired` both need a
    // LIVE assignment standing on the SAME leg. The decision the old leg demanded was one PR-I1 could not
    // execute, and executing it by force produces a permanent diagnostic, a permanently `unreconciled`
    // view, and a case whose wakes and submissions are refused forever — the router would have manufactured
    // a wedged case out of a routine leg escalation. The Leader keeps the case, which is the pre-Alpha.6
    // answer. If PR-I1 wants cross-leg assignment it must ADD the row kind that carries it, in the open,
    // and then this leg may be inverted on purpose — with a writer that proves it.
    const current = fold([row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 1, 'req-OLD-leg')])
    // A new leg means a new mandate: without it the router correctly refuses for the mandate law and the
    // leg-transition law never gets exercised.
    const answer = routeReviewCase(
      routingInput({ current, caseView: caseView({ legOrdinal: 2, currentLegOrdinal: 2 }), mandate: mandate({ legOrdinal: 2 }) }),
    )
    expect(answer.ok && answer.value.kind).toBe('leaveWithLeader')
    if (!answer.ok || answer.value.kind !== 'leaveWithLeader') return
    expect(answer.value.reasonCode).toBe('LEADER_LEG_MOVED')
    // The second half of the law, and the half that would have caught the bug the day it was written: on a
    // state the router refuses on this ground, EVERY row kind the lane owns is refused by the lane's own
    // pre-flight. Router `assign` and writer refusal may never both be true of the same state.
    for (const kind of ['created', 'transferred', 'retired'] as const) {
      const door = checkAssignmentMutation(
        current,
        kind,
        kind === 'created' ? { kind: 'instance', instanceId: OFFICER } : { kind: 'leader' },
        'req-NEW-leg',
      )
      expect(door.ok, `the pre-flight would let a ${kind} row through for a leg the family cannot express`).toBe(false)
    }
  })

  it('leaves a retired case with the Leader instead of resurrecting it, and the pre-flight agrees', () => {
    // Review F-1's second shape, which had no leg at all before the review. Retirement is a fact in the
    // ledger: re-opening the case would need a `created` row replacing epoch 0, which the epoch law forbids
    // once the family has advanced. A wake is not an argument with the ledger.
    const current = fold([row('created', 1, 0), row('retired', 2, 1, { kind: 'leader' }, 2)])
    expect(current.live).toBe(false)
    const answer = routeReviewCase(routingInput({ current }))
    expect(answer.ok && answer.value.kind).toBe('leaveWithLeader')
    if (!answer.ok || answer.value.kind !== 'leaveWithLeader') return
    expect(answer.value.reasonCode).toBe('LEADER_ASSIGNMENT_RETIRED')
    for (const kind of ['created', 'transferred', 'retired'] as const) {
      const door = checkAssignmentMutation(current, kind, { kind: 'instance', instanceId: OFFICER }, LEG)
      expect(door.ok, `a retired case accepted a ${kind} row`).toBe(false)
    }
  })

  it('refuses to route a case from a view folded for a different case of the same team', () => {
    // Round-2 review NF-6. F-1's law — a router may not order what its own writer cannot write — is
    // worthless if the state being routed is somebody else's history. A view folded for another case of the
    // SAME team passes the team check, is well-formed, and carries an `epochApplied` from a different epoch
    // chain, so the decision would be computed from another case's assignment and the row it orders would
    // conflict in this case's fold forever. The writer cannot catch it: `checkAssignmentMutation` receives a
    // state and no case id, so the fold's (team, case) scope must be honoured at the one door that can see
    // both sides. Pre-existing, and closed here rather than deferred, because one comparison is cheaper than
    // a contract note nobody reads.
    const otherRow = encodeAssignmentFact(
      'created',
      { ...assignmentFor(1), approvalCaseId: 'case-OTHER-IN-TEAM' },
      0,
    )
    if (!otherRow.ok) throw new Error('fixture broken')
    const otherCase = foldReviewAssignmentRows(
      [{ ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: otherRow.value }],
      ROOT,
      'case-OTHER-IN-TEAM',
    )
    expect(otherCase.assignment).not.toBeNull() // a perfectly well-formed view of a real case
    expect(otherCase.unreconciled).toBe(false)
    const answer = routeReviewCase(routingInput({ current: otherCase }))
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE')
    expect(answer.detail).toContain('case-OTHER-IN-TEAM')
    // And the honest shape still routes: the same input with the view folded for THIS case.
    const mine = routeReviewCase(routingInput({ current: fold([row('created', 1, 0)]) }))
    expect(mine.ok).toBe(true)
  })

  it('never routes a case the admission gate would refuse, for any widening tried here', () => {
    // THE pin of this lane: router ⊆ PR0's admission. For each input below, PR0 is asked whether the
    // officer may decide, and if it refuses every decision value the router must not assign either.
    const widenings: readonly (readonly [string, Partial<ReviewRoutingInput>])[] = [
      ['plan revoked', { planRevoked: true }],
      ['plan expired', { nowIso: '2027-01-01T00:00:00Z', plan: plan({ expiresAtIso: '2026-11-01T00:00:00Z' }) }],
      ['epoch behind the plan', { plan: plan({ epoch: 9 }), currentEpoch: 9, mandate: mandate({ planEpoch: 9 }) }],
      ['human rung on the leg', { caseView: caseView({ legReviewAuthority: 'human-user' }) }],
      ['member rung on the leg', { caseView: caseView({ legReviewAuthority: 'member' }) }],
      ['officer already acted', { caseView: caseView({ actedCallerRefs: [OFFICER_REF] }) }],
      ['non-delegable request kind', { caseView: caseView({ requestKind: 'envelope-mutation' }) }],
      ['effect fingerprint outside the plan', { caseView: caseView({ effectScopeFingerprint: OTHER_FINGERPRINT }), mandate: mandate({ effectScopeFingerprint: OTHER_FINGERPRINT }) }],
      ['action the plan does not name', { caseView: caseView({ actionName: 'shell:exec' }), mandate: mandate({ actionName: 'shell:exec' }) }],
    ]
    for (const [name, overrides] of widenings) {
      const merged = routingInput(overrides)
      const admitted = (['allow', 'deny'] as const).some((decisionValue) =>
        evaluateReviewAdmission({
          caller: { role: 'member', instanceId: OFFICER, callerRef: OFFICER_REF, rootSessionId: ROOT, isLeaderInstance: false },
          attempt: {
            decision: decisionValue,
            actionName: merged.caseView.actionName,
            effectScopeFingerprint: merged.caseView.effectScopeFingerprint,
          },
          caseView: merged.caseView,
          plan: merged.plan ?? undefined,
          mandate: merged.mandate ?? undefined,
          currentEpoch: merged.currentEpoch,
          nowIso: merged.nowIso,
          planRevoked: merged.planRevoked,
        }).admitted,
      )
      const routed = routeReviewCase(merged)
      if (routed.ok && routed.value.kind === 'assign') {
        expect(admitted, `the router routed "${name}" which PR0 refuses`).toBe(true)
      }
      if (!admitted) {
        expect(routed.ok && routed.value.kind !== 'assign', `the router assigned "${name}"`).toBe(true)
      }

      // THE SAME INPUT, ONE STATE APART (review F-8). The case is already assigned to the officer this
      // plan binds, so the answer the router wants to give is `keep`. `keep` is a routing decision like any
      // other — it leaves the case parked on the member PR0 has just refused, and a parked case is a case
      // whose wakes keep arriving at a door that cannot open — so it is gated by the same law, not by the
      // accident of which line of the router runs first. In the first version of this file the ordering
      // happened to be right and nothing said so; a refactor that lifted the existing-assignment block
      // above the admission call kept all 64 legs green.
      const rerouted = routeReviewCase(routingInput({ ...overrides, current: fold([row('created', 1, 0)]) }))
      if (!admitted) {
        expect(
          rerouted.ok && rerouted.value.kind !== 'assign' && rerouted.value.kind !== 'keep',
          `the router parked "${name}" on an officer PR0 refuses (answered ${rerouted.ok ? rerouted.value.kind : 'refusal'})`,
        ).toBe(true)
      }
    }
    // Positive controls, so neither loop can pass by refusing everything.
    const control = routeReviewCase(routingInput())
    expect(control.ok && control.value.kind).toBe('assign')
    const kept = routeReviewCase(routingInput({ current: fold([row('created', 1, 0)]) }))
    expect(kept.ok && kept.value.kind, 'a live assignment bound to the officer this plan binds must still answer keep').toBe('keep')
  })
})

// --- A-6 handoff is not escalation -----------------------------------------------------------------------

describe('A-6 a handoff moves the target and nothing else', () => {
  const request = {
    rootSessionId: ROOT,
    approvalCaseId: CASE_ID,
    currentLegRequestId: LEG,
    basedOnCaseVersion: CASE_VERSION,
    reasonCode: 'LEADER_GLOBAL_INFORMATION_NEEDED',
    actorCallerRef: OFFICER_REF,
  }

  it('prepares a transferred fact at the next epoch, with no control-plane effects and no rung change', () => {
    const state = fold([row('created', 1, 0)])
    const prepared = planHandoff(state, request)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.value.factType).toBe(REVIEW_ASSIGNMENT_FACT_TYPES.transferred)
    expect(prepared.value.plan.assignmentEpoch).toBe(2)
    expect(prepared.value.plan.expectedPreviousEpoch).toBe(1)
    expect(prepared.value.payload.targetKind).toBe('leader')
    expect(prepared.value.payload.targetInstanceId).toBeNull()
    expect(prepared.value.plan.controlServiceEffects).toEqual([])
    expect(prepared.value.plan.rungChanged).toBe(false)
  })

  it('carries no authority vocabulary in the durable row, and its plan is the pinned empty shape', () => {
    const state = fold([row('created', 1, 0)])
    const prepared = planHandoff(state, request)
    if (!prepared.ok) throw new Error('fixture broken')
    const markers = ['authority', 'rung', 'permission', 'grant', 'allow', 'deny', 'decision', 'mandate', 'effect']
    // (1) the ROW. This is what is written to an append-only ledger and read back by every future
    // projection, so it gets zero tolerance: no field name may even resemble authority vocabulary.
    const rowOffenders = Object.keys(prepared.value.payload).filter((key) =>
      markers.some((marker) => key.toLowerCase().includes(marker)),
    )
    expect(rowOffenders).toEqual([])
    expect(decodeAssignmentPayload(prepared.value.factType, prepared.value.payload).ok).toBe(true)
    // (2) the PLAN. It has two fields whose NAMES contain authority words, and both are assertions that
    // nothing happened rather than carriers of something: `controlServiceEffects: []` and
    // `rungChanged: false`. They are typed `readonly []` and `false`, so they cannot be populated at all
    // (A-6 as a compile error), and the leg pins the plan to its exact closed shape so a third field
    // cannot appear quietly. A scan that only looked at names would either flag these two or have to
    // list them, and a list is weaker than a type — that difference is why (1) and (2) are separate.
    expect(Object.keys(prepared.value.plan).sort()).toEqual([
      'actorCallerRef',
      'approvalCaseId',
      'assignmentEpoch',
      'basedOnCaseVersion',
      'controlServiceEffects',
      'currentLegRequestId',
      'expectedPreviousEpoch',
      'factType',
      'reasonCode',
      'rootSessionId',
      'rungChanged',
    ])
    expect(prepared.value.plan.controlServiceEffects).toEqual([])
    expect(prepared.value.plan.rungChanged).toBe(false)
  })

  it('applied to the fold, the handoff leaves the case with the Leader and locks the old officer out', () => {
    const state = fold([row('created', 1, 0)])
    const prepared = planHandoff(state, request)
    if (!prepared.ok) throw new Error('fixture broken')
    const after = fold([
      row('created', 1, 0),
      { ledgerSequence: 2, factType: prepared.value.factType, payload: prepared.value.payload },
    ])
    expect(after.assignment?.target).toEqual({ kind: 'leader' })
    expect(after.epochApplied).toBe(2)
    expect(maySubmitFor(after, officerCaller(), 2).ok).toBe(false)
    expect(maySubmitFor(after, { instanceId: LEADER_INSTANCE_ID, callerRef: 'instance:inst-leader', isLeaderInstance: true }, 2).ok).toBe(true)
  })

  it('refuses a handoff with nothing to hand off, or with the case already upstairs', () => {
    const nothing = planHandoff(EMPTY_STATE, request)
    expect(nothing.ok).toBe(false)
    if (!nothing.ok) expect(nothing.refusal).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')
    const already = planHandoff(fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'leader' }, 2)]), request)
    expect(already.ok).toBe(false)
    if (!already.ok) expect(already.refusal).toBe('REVIEW_ASSIGNMENT_TARGET_UNCHANGED')
  })

  it('answers both plan functions the same way when the ledger cannot be read, and never "nothing to do"', () => {
    // Round-2 review NF-4, against the F-10 fix. The null door in `planRetirement` used to answer
    // `NO_ACTIVE_ASSIGNMENT` for an UNRECONCILED view with no assignment, while `planHandoff` answered
    // `ROW_UNPARSEABLE` for the same input — and the shape is reachable on its own: one created row that
    // fails to apply leaves exactly `assignment === null, unreconciled === true`. The two answers are not
    // interchangeable. "Nothing to retire" is a fact about the case; "re-read the ledger" is a fact about
    // the reading; A-7 exists because conflating them turns a broken read into a case nobody handles.
    // The shape is a created row that cannot even be ordered (the F-2 shape): nothing applies, so
    // `assignment === null`, and the family is broken, so `unreconciled === true`. That combination is the
    // whole question, and it is reachable without a broken encoder — the row above is legal output of the
    // only writer this lane has, and it is the ledger, not the writer, that arrived unreadable.
    const brokenCreated = encodeAssignmentFact('created', assignmentFor(1), 0)
    if (!brokenCreated.ok) throw new Error('fixture broken')
    const unreadable = fold([
      {
        ledgerSequence: '7' as unknown as number,
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.created,
        payload: brokenCreated.value,
      },
    ])
    expect(unreadable.assignment).toBeNull()
    expect(unreadable.unreconciled).toBe(true)
    const unreadableAnswers = [
      ['handoff', planHandoff(unreadable, request)] as const,
      ['retirement', planRetirement(unreadable, { ...request, reasonCode: 'CASE_CLOSED' })] as const,
    ]
    for (const [name, answer] of unreadableAnswers) {
      expect(answer.ok, name).toBe(false)
      if (answer.ok) continue
      expect(answer.refusal, name).toBe('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE')
    }

    // The clean empty view still says the boring true thing, in both doors.
    const emptyAnswers = [
      ['handoff', planHandoff(EMPTY_STATE, request)] as const,
      ['retirement', planRetirement(EMPTY_STATE, { ...request, reasonCode: 'CASE_CLOSED' })] as const,
    ]
    for (const [name, answer] of emptyAnswers) {
      expect(answer.ok, name).toBe(false)
      if (answer.ok) continue
      expect(answer.refusal, name).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')
    }
  })

  it('refuses a handoff written against a leg the family has moved past', () => {
    const state = fold([row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 1, 'req-OLD')])
    const answer = planHandoff(state, request)
    expect(answer.ok).toBe(false)
    if (answer.ok) return
    expect(answer.refusal).toBe('REVIEW_ASSIGNMENT_LEG_MISMATCH')
  })

  it('retires a case, and the retirement carries the same emptiness', () => {
    const state = fold([row('created', 1, 0)])
    const retired = planRetirement(state, { ...request, reasonCode: 'CASE_CLOSED' })
    expect(retired.ok).toBe(true)
    if (!retired.ok) return
    expect(retired.value.factType).toBe(REVIEW_ASSIGNMENT_FACT_TYPES.retired)
    expect(retired.value.plan.controlServiceEffects).toEqual([])
    expect(retired.value.plan.rungChanged).toBe(false)
    const after = fold([
      row('created', 1, 0),
      { ledgerSequence: 2, factType: retired.value.factType, payload: retired.value.payload },
    ])
    expect(after.live).toBe(false)
    expect(maySubmitFor(after, officerCaller(), 2).ok).toBe(false)
  })

  it('does not implement, import or name the escalation write path anywhere in the lane', () => {
    // The other half of A-6: `escalateApprovalLeg` is the ONLY thing that raises a leg, and it lives in
    // the protected center. This lane neither calls it nor shadows it.
    const laneFiles = ['types.ts', 'facts.ts', 'router.ts', 'handoff.ts', 'index.ts']
    for (const file of laneFiles) {
      const source = readFileSync(join(RUNTIME_ROOT, 'review-assignment', file), 'utf8')
      expect(source, `${file} mentions the escalation write path`).not.toMatch(/escalateApprovalLeg\s*\(/)
    }
  })
})

// --- A-7 a row we cannot read is a diagnostic ------------------------------------------------------------

describe('A-7 an unreadable row is reported forever, never treated as an empty queue', () => {
  it('records the diagnostic, keeps applying later rows, and marks the view unreconciled', () => {
    const state = fold([
      { ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: 'a string is not a payload' },
      row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 2),
    ])
    expect(state.diagnostics).toHaveLength(1)
    expect(state.diagnostics[0]?.refusal).toBe('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE')
    expect(state.diagnostics[0]?.ledgerSequence).toBe(1)
    expect(state.live).toBe(true)
    expect(state.unreconciled).toBe(true)
  })

  it('refuses every consumer of the broken view', () => {
    const broken = fold([{ ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: {} }])
    expect(broken.unreconciled).toBe(true)
    expect(maySubmitFor(broken, officerCaller(), 1).ok).toBe(false)
    expect(checkAssignmentMutation(broken, 'transferred', { kind: 'leader' }, LEG).ok).toBe(false)
    expect(routeReviewCase(routingInput({ current: broken })).ok).toBe(false)
  })

  it('does not invent diagnostics for rows of a case it was not asked about', () => {
    // The companion of the A-2 leg above, at the other end of the same law: folding a ledger for a case it
    // does not belong to yields an EMPTY, CLEAN view — no diagnostic, no `unreconciled` flag.
    // `assignment === null` with `unreconciled === false` is the state "this case has no assignment", which
    // is exactly what the Leader needs to hear, and it is the state every team that never enabled Alpha.6
    // stands in forever.
    const state = foldReviewAssignmentRows([row('created', 1, 0)], ROOT, 'case-NOT-THIS-ONE')
    expect(state.diagnostics).toEqual([])
    expect(state.unreconciled).toBe(false)
    expect(state.assignment).toBeNull()
  })

  it('diagnoses a row of THIS family whose ledgerSequence is not a safe integer — A-7 has no silent hole', () => {
    // Review F-2, reproduced before it was fixed: the fold used to `continue` on a malformed sequence
    // BEFORE asking whether the row belonged to this family, so the rows A-7 exists to protect were the
    // ones that vanished quietly — `diagnostics: []`, `unreconciled: false`, `epochApplied: 0`, as if the
    // assignment had never been written. A case whose handler row cannot be read must LOOK broken, because
    // the alternative is a queue that looks empty.
    const encoded = encodeAssignmentFact('created', assignmentFor(1), 0)
    if (!encoded.ok) throw new Error('fixture broken')
    for (const broken of [Number.NaN, Number.POSITIVE_INFINITY, 2.5, '7', null, undefined]) {
      const state = fold([
        { ledgerSequence: broken as unknown as number, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: encoded.value },
      ])
      expect(state.diagnostics.map((d) => d.refusal), `sequence ${String(broken)}`).toEqual([
        'REVIEW_ASSIGNMENT_SEQUENCE_MALFORMED',
      ])
      expect(state.unreconciled, `sequence ${String(broken)}`).toBe(true)
      expect(state.assignment).toBeNull()
    }
    // A foreign family with the same broken sequence stays silent: this fold answers for its own rows.
    const foreign = fold([{ ledgerSequence: Number.NaN, factType: 'control-request-recorded', payload: {} }])
    expect(foreign.diagnostics).toEqual([])
    expect(foreign.unreconciled).toBe(false)
  })

  it("keeps another case's broken sequence out of this view, and keeps an unreadable row loud", () => {
    // Round-2 review NF-1, against the fix for F-2. The malformed-sequence test used to run BEFORE case
    // scope, so one unreadable row anywhere in the team's ledger marked EVERY case of that team
    // `unreconciled` — and every consumer refuses an unreconciled view, which is the refuse-every-wake-in-
    // every-team shape F-3 was about, reached through a different door. The sequence check now runs after
    // ownership is settled. What is NOT allowed to go quiet is a row that does not decode: an undecodable
    // payload has no readable owner, so the fold cannot prove it is not this case's row, and A-7 forbids
    // losing a row it cannot rule out. Silence is for rows positively identified as somebody else's.
    const own = encodeAssignmentFact('created', assignmentFor(1), 0)
    const other = encodeAssignmentFact(
      'created',
      { ...assignmentFor(1), approvalCaseId: 'case-OTHER-IN-TEAM' },
      0,
    )
    if (!own.ok || !other.ok) throw new Error('fixture broken')

    const foreignCaseBrokenSequence: readonly ReviewAssignmentRow[] = [
      { ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: own.value },
      {
        ledgerSequence: '7' as unknown as number,
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.created,
        payload: other.value,
      },
    ]
    const clean = fold(foreignCaseBrokenSequence)
    expect(clean.diagnostics).toEqual([])
    expect(clean.unreconciled).toBe(false)
    expect(clean.epochApplied).toBe(1)

    // Same row, this case: ownership is settled, so the broken sequence is this view's problem (F-2).
    const ownCaseBrokenSequence: readonly ReviewAssignmentRow[] = [
      {
        ledgerSequence: '7' as unknown as number,
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.created,
        payload: own.value,
      },
    ]
    const mine = fold(ownCaseBrokenSequence)
    expect(mine.diagnostics.map((d) => d.refusal)).toEqual(['REVIEW_ASSIGNMENT_SEQUENCE_MALFORMED'])
    expect(mine.unreconciled).toBe(true)

    // A row naming another case that cannot be decoded stays loud, because "another case" is a claim this
    // row cannot make.
    const unreadableOwner: readonly ReviewAssignmentRow[] = [
      {
        ledgerSequence: 2,
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.created,
        payload: { ...assignmentFor(1), approvalCaseId: 'case-OTHER-IN-TEAM', smuggled: 'x' },
      },
    ]
    const loud = fold(unreadableOwner)
    expect(loud.diagnostics.length).toBe(1)
    expect(loud.unreconciled).toBe(true)
  })
})

// --- A-8 no clock, no I/O, no host ------------------------------------------------------------------------

describe('A-8 the lane computes and refuses, and touches nothing', () => {
  it('reads no clock, no entropy, no environment and no filesystem', () => {
    const laneFiles = ['types.ts', 'facts.ts', 'router.ts', 'handoff.ts', 'index.ts']
    for (const file of laneFiles) {
      const source = readFileSync(join(RUNTIME_ROOT, 'review-assignment', file), 'utf8')
      expect(source, `${file} reads a clock`).not.toMatch(/\bDate\s*\.\s*(now|parse)\s*\(/)
      expect(source, `${file} reads entropy`).not.toMatch(/\bMath\s*\.\s*random\b/)
      expect(source, `${file} touches the environment`).not.toMatch(/\bprocess\./)
      expect(source, `${file} touches the filesystem`).not.toMatch(/\bnode:fs\b|\breadFileSync\b/)
    }
  })

  it('imports only contracts, PR0 and itself — and no node: builtin of any kind', () => {
    // `node:crypto` used to be in this allow-list. It belonged to PR3′'s lane, which derives wake ids and
    // genuinely needs entropy; this lane derives nothing, and a lane must not acquire its neighbour's
    // permissions by inheritance (review F-9a). Sibling names are DERIVED from the module list so the
    // closed set exists once.
    const laneModules = ['types', 'facts', 'router', 'handoff', 'writer']
    // Two lists of the same closed set is a drift hazard, and this file just paid for it: PR-I1a added
    // `writer.ts` to the hygiene spec's module list and this leg failed, which is the loud direction. The
    // quiet direction is someone adding a module HERE and letting the hygiene spec's floor go stale, so the
    // lists are now compared rather than trusted — the hygiene spec's own declarations are read out of its
    // source, comments stripped, and required to name exactly what this leg allows.
    const hygiene = readFileSync(join(RUNTIME_ROOT, 'test', 'a6-pr2-lane-hygiene.test.ts'), 'utf8')
    const declared = (name: string): string[] => {
      const block = new RegExp(`const ${name}(?::[^=]+)?\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(hygiene)
      expect(block, `${name} moved out of the hygiene spec — re-read it, do not guess`).not.toBeNull()
      // Quoted names only, on any layout: `FOUNDING_MODULES` is written on one line and
      // `EXTRA_MODULES_ALLOWED` one per line with a rationale comment, and both shapes must keep working.
      return [...(block?.[1] ?? '').matchAll(/'([\w.]+)'/g)].map((match) => match[1] as string)
    }
    // The hygiene list names the barrel too; this leg walks the barrel separately below, so the comparison
    // adds it rather than dropping the check.
    expect([...declared('FOUNDING_MODULES'), ...declared('EXTRA_MODULES_ALLOWED')].map((file) => file.replace(/\.ts$/, '')).sort())
      .toEqual([...laneModules, 'index'].sort())
    const allowed = new RegExp(
      `^(?:\\.\\./\\.\\./contracts/src/index\\.js|\\.\\./review-mandate/index\\.js|\\./(?:${laneModules.join('|')})\\.js)$`,
    )
    for (const file of [...laneModules.map((module) => `${module}.ts`), 'index.ts']) {
      const source = readFileSync(join(RUNTIME_ROOT, 'review-assignment', file), 'utf8')
      // All three quote styles, plus dynamic forms. The first version captured `from '…'` only, which made
      // the whole floor invisible to `import os from "node:os"` — a leg that cannot see the thing it
      // forbids is worse than no leg, because it is reported as a pass.
      const specifiers = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"`]([^'"`\n]+)['"`]/g)]
        .map((match) => match[1] as string)
      if (file !== 'index.ts') {
        expect(specifiers.length, `${file} declares no imports at all — the capture is blind, not clean`).toBeGreaterThan(0)
      }
      for (const specifier of specifiers) {
        expect(allowed.test(specifier), `${file} imports ${specifier}`).toBe(true)
      }
      expect(source, `${file} reaches for a node: builtin`).not.toMatch(/node:/)
    }
    // The capture is demonstrated on the shape that escaped it, so it cannot rot back to one quote style.
    expect([...'import os from "node:os"'.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"`]([^'"`\n]+)['"`]/g)].map((m) => m[1])).toEqual(['node:os'])
  })
})

// --- A-9 the closed vocabularies, in both directions ---------------------------------------------------------

describe('A-9 every refusal code is reachable and every produced code is declared', () => {
  it('produces every declared refusal code, and produces nothing outside the list', () => {
    const produced = new Set<ReviewAssignmentRefusal>()
    const record = (answer: { ok: false; refusal: ReviewAssignmentRefusal } | { ok: true }): void => {
      if (!answer.ok) produced.add(answer.refusal)
    }

    record(encodeAssignmentFact('created', { ...assignmentFor(1), rootSessionId: 'not hygienic' }, 0))
    record(encodeAssignmentFact('created', { ...assignmentFor(1), reasonCode: 'lowercase_reason' }, 0))
    record(encodeAssignmentFact('created', assignmentFor(3), 1))
    record(decodeAssignmentPayload('review-assignment-created', 7))
    record(decodeAssignmentPayload('review-assignment-created', { note: 'x' }))
    record(decodeAssignmentPayload('review-assignment-created', { [REVIEW_ASSIGNMENT_PAYLOAD_FIELDS[0] as string]: ROOT }))
    const encodedGood = encodeAssignmentFact('created', assignmentFor(1), 0)
    if (!encodedGood.ok) throw new Error('fixture broken')
    record(decodeAssignmentPayload(REVIEW_ASSIGNMENT_FACT_TYPES.created, { ...encodedGood.value, reviewAuthority: 'leader' }))
    record(maySubmitFor(EMPTY_STATE, officerCaller(), 0))
    record(maySubmitFor(fold([row('created', 1, 0)]), { instanceId: 'inst-x', callerRef: 'instance:inst-x', isLeaderInstance: false }, 1))
    record(maySubmitFor(fold([{ ledgerSequence: 1, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: 1 }]), officerCaller(), 0))
    record(checkAssignmentMutation(fold([row('created', 1, 0)]), 'created', { kind: 'instance', instanceId: OFFICER }, LEG))
    record(checkAssignmentMutation(fold([row('created', 1, 0)]), 'transferred', { kind: 'instance', instanceId: OFFICER }, LEG))
    record(checkAssignmentMutation(fold([row('created', 1, 0)]), 'transferred', { kind: 'instance', instanceId: OFFICER }, 'req-OTHER'))
    record(foldFirstDiagnostic([row('created', 1, 0), row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 2)]))
    record(foldFirstDiagnostic([row('transferred', 2, 1, { kind: 'leader' })]))
    record(foldFirstDiagnostic([row('created', 1, 0), row('transferred', 3, 2, { kind: 'leader' }, 2)]))
    const foreignRoot = encodeAssignmentFact('transferred', { ...assignmentFor(2, { kind: 'leader' }), rootSessionId: 'team-root-OTHER' }, 1)
    if (!foreignRoot.ok) throw new Error('fixture broken')
    record(foldFirstDiagnostic([
      row('created', 1, 0),
      { ledgerSequence: 2, factType: REVIEW_ASSIGNMENT_FACT_TYPES.transferred, payload: { ...foreignRoot.value, approvalCaseId: CASE_ID } },
    ]))
    record(foldFirstDiagnostic([row('created', 1, 0), row('transferred', 2, 1, { kind: 'instance', instanceId: OFFICER }, 2)]))
    // The hole review F-2 found, kept shut from the vocabulary side too: SEQUENCE_MALFORMED must have a
    // producer, or the closed list is lying again in the other direction.
    record(foldFirstDiagnostic([{ ledgerSequence: Number.NaN, factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: encodedGood.value }]))
    record(foldFirstDiagnostic([row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 9), row('transferred', 2, 1, { kind: 'leader' }, 8)]))
    record(routeReviewCase(routingInput({ rootSessionId: 'bad root' })))
    record(routeReviewCase(routingInput({ candidates: [candidate(), candidate()] })))
    record(routeReviewCase(routingInput({ candidates: [candidate({ isLeaderInstance: true })] })))

    for (const code of REVIEW_ASSIGNMENT_REFUSALS) {
      expect(produced.has(code), `refusal ${code} is declared but nothing can produce it`).toBe(true)
    }
    const declared = new Set<string>(REVIEW_ASSIGNMENT_REFUSALS)
    for (const code of produced) {
      expect(declared.has(code), `the kernel produced ${code}, which is not in the closed list`).toBe(true)
    }
    expect(produced.size).toBe(REVIEW_ASSIGNMENT_REFUSALS.length)
  })

  it('emits only declared reason codes, and every declared reason code is reachable', () => {
    const produced = new Set<string>()
    const collect = (answer: { ok: true; value: ReviewRoutingDecision } | { ok: false }): void => {
      if (answer.ok) produced.add(answer.value.reasonCode)
    }
    collect(routeReviewCase(routingInput()))
    collect(routeReviewCase(routingInput({ current: fold([row('created', 1, 0)]) })))
    collect(routeReviewCase(routingInput({ current: fold([row('created', 1, 0, { kind: 'instance', instanceId: 'inst-old' })]) })))
    collect(routeReviewCase(routingInput({ current: fold([row('created', 1, 0), row('transferred', 2, 1, { kind: 'leader' }, 2)]) })))
    collect(routeReviewCase(routingInput({ caseView: caseView({ approvalCaseId: undefined }) })))
    collect(routeReviewCase(routingInput({ caseView: caseView({ legOrdinal: 1, currentLegOrdinal: 2 }) })))
    collect(routeReviewCase(routingInput({ plan: null })))
    collect(routeReviewCase(routingInput({ currentEpoch: 8 })))
    collect(routeReviewCase(routingInput({ mandate: null })))
    collect(routeReviewCase(routingInput({ mandate: mandate({ revoked: true }) })))
    collect(routeReviewCase(routingInput({ mandate: mandate({ actionName: 'fs:read' }) })))
    collect(routeReviewCase(routingInput({ candidates: [] })))
    collect(routeReviewCase(routingInput({ candidates: [candidate({ lifecycle: MEMBER_LIFECYCLE_STATES.DISPOSED })] })))
    // F-1's two new refusals, produced through the public entry point rather than by poking an internal.
    const movedLeg = fold([row('created', 1, 0, { kind: 'instance', instanceId: OFFICER }, 1, 'req-OLD-leg')])
    collect(routeReviewCase(routingInput({ current: movedLeg, caseView: caseView({ legOrdinal: 2, currentLegOrdinal: 2 }), mandate: mandate({ legOrdinal: 2 }) })))
    collect(routeReviewCase(routingInput({ current: fold([row('created', 1, 0), row('retired', 2, 1, { kind: 'leader' }, 2)]) })))

    for (const code of REVIEW_ROUTER_REASON_CODES) {
      expect(produced.has(code), `reason code ${code} is declared but unreachable`).toBe(true)
    }
    const declared = new Set<string>(REVIEW_ROUTER_REASON_CODES)
    for (const code of produced) {
      expect(declared.has(code), `the router emitted ${code}, which is not declared`).toBe(true)
    }
  })
})

function foldFirstDiagnostic(rows: readonly ReviewAssignmentRow[]): { ok: false; refusal: ReviewAssignmentRefusal } | { ok: true } {
  const state = fold(rows)
  const first = state.diagnostics[0]
  if (first === undefined) return { ok: true }
  return { ok: false, refusal: first.refusal }
}
