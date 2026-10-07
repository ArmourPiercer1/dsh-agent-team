# A4-PR3 — Interface Freeze (plan Task 3 line 367)

Branch `feat/a4-pr3-control-termination`, worktree `.worktrees/a4-pr3`, base `c2ed78a2`.
Frozen by the A4-PR3 writer. **A name that is absent from this file is not frozen**
and must not be relied on across the PR boundary. PR4 (operation plane) and PR5
(mutation plane) may build on everything below; both were the reason the freeze
exists, so each entry names its file, its export site, and its exact signature.

> **AMENDED after the parent audit (F1-F16). §9 supersedes anything in §1-§8
> that contradicts it**, and the individual sentences §9 correct in place are
> marked `(amended F<n>)`. The original text is left in place everywhere else so
> the audit trail is readable: this file is the freeze a later lane relies on, so
> a silent rewrite would be worse than a visible correction.

Status at amendment time: `a4p3-approval-escalation.test.ts` **37/37**,
`a4p3-approval-case.test.ts` 17/17, `a4p3-intervention-projection.test.ts`
**32/32**, `a4p3-intervention-lane-hygiene.test.ts` **9/9 (new file)**,
`control-legacy-row-compat.test.ts` 5/5, `p6t4-restart.test.ts` 4/4,
`f9-control-exactly-once.test.ts` 10/10, client `ledger-adapter.test.ts` 32/32,
`a4pr0a-fact-type-closed-set.test.ts` **9/9 — with an edit** (see §8.5, amended
F5), `a3p3-governance-lane-hygiene.test.ts` 17/17 without an edit.

---

## 1. Lane A — `packages/runtime/control/types.ts`

Value exports (all also re-exported from `control/index.ts`, the only export
site PR4/PR5 should import from). **Anchoring rule (amended F13): entries are
anchored by SYMBOL, never by line number.** The first version of this file cited
`:249-259`-style ranges; 87 of them were already stale at freeze time, and a
stale anchor is worse than none because it reads as verified. Grep the symbol.

| Export | Shape |
| --- | --- |
| `CONTROL_DECISION_REASONS.ESCALATED` (`:CONTROL_DECISION_REASONS`) | `'escalated'` — **added to the closed `CONTROL_DECISION_REASONS`**, key order preserved (inserted after `EXTERNAL_POLICY`). |
| `CONTROL_REVIEW_ACTIONS` / type `ControlReviewAction` / `CONTROL_REVIEW_ACTION_VALUES` (:249-259) | `allow \| deny \| escalate` — the reviewer-action vocabulary of the Control plane. Distinct from the durable `CONTROL_DECISION_VALUES`, which stays its frozen **three** members `allow \| deny \| stale-denied` — escalation is **not** a decision value (amended F8: this row used to say two). |
| `CONTROL_ESCALATION_SUCCESSOR` (:282) | `Record<ProposalAuthorityPosition, ProposalAuthorityPosition \| null>` = `member → leader → human-user → human-admin → null`. **Routing, not ranking**: `AUTHORITY_RANK` stays the single ordering of the ladder (ADR X7-R3). |
| `isProposalAuthorityPosition(value): value is ProposalAuthorityPosition` (:304) | closed-ladder guard. |
| `controlEscalationSuccessor(position): ProposalAuthorityPosition \| null` (:318) | the successor lookup. |
| `CONTROL_UNRESOLVABLE_AUTHORITIES: readonly ProposalAuthorityPosition[]` (:341) | `['human-admin']` — **availability**, not ranking. |
| `hasAuthorityResolver(position): boolean` (:351) | the availability gate. It is NOT `successor === null`: a `human-user` leg must be writable while rising *from* it is not possible. Only ever REMOVES a leg (A1-12). |
| `CONTROL_LEG_TERMINAL_REASONS` / type `ControlLegTerminalReason` / `..._VALUES` (:368-387) | `authority-drift \| resource-identity-drift \| resolver-unavailable`. |
| `ApprovalCaseIdentity` (:407), `ApprovalCaseIdentityInput = Omit<…, 'approvalCaseId'>` (:429) | the frozen §11.1 identity; `approvalCaseId` is derived, never caller-chosen (A2-7). Exactly one of `operationFingerprint` / `mutationProposalFingerprint` (A1-15). |
| `APPROVAL_CASE_IDENTITY_PROBLEMS` / type `ApprovalCaseIdentityProblem` (:432-448) | `fingerprint-cardinality \| operation-fingerprint-required \| mutation-proposal-fingerprint-required \| authority-position-unknown \| effect-unknown \| subject-malformed`. |
| `ControlEscalationRecord` | the `control-escalation-recorded` row. **Two different claims, both pinned (amended F12):** the DURABLE WIRE payload is exactly `{ approvalCaseId, legOrdinal, previousRequestId, escalatedBy, reason }` (A3-12(ii)); the **derived record** the service returns is that payload **plus** exactly `escalationSequence` and `createdAt`, which the payload cannot carry. `escalationSequence` is the row's own ledger sequence (PR5 orders a timeline by it) and `createdAt` is the row's ISO-8601 fact time; both are pinned against the ledger row, so a projection cannot drop them or fake them. `previousRequestId` is the only parent pointer (A3-12(iii)). |
| `ApprovalCaseState` (:483) | `{ identity, legs[], escalations[], currentLeg?, status: 'open'\|'decided'\|'abandoned', terminalDecision?, reviewedBy: ControlCallerRef[] }`. Derived view only (A1-17). `reviewedBy` is the durable backing for "an escalated-away reviewer cannot come back and allow" (24.5). |
| `APPROVAL_CASE_READ_PROBLEMS` / type `ApprovalCaseReadProblem` (:509-523) | `not-found \| leg-ordinal \| review-authority \| identity-disagreement \| chain-broken`. |
| `ApprovalCaseReadOutcome` (:527) | `{ kind: 'case', state } \| { kind: 'problem', problem, approvalCaseId, sequence?, detail }` — corrupt is reported, never defaulted (A2-9). |
| `CONTROL_CASE_TERMINAL_OUTCOMES` / type `ControlCaseTerminalOutcome` | `authority-unavailable` only. A **result**, not a status. |
| `CONTROL_CASE_OUTCOMES` / type `ControlCaseOutcome` / `CONTROL_CASE_OUTCOME_VALUES` (amended F7) | `escalated \| authority-unavailable` — **the one frozen vocabulary that feeds `ControlEscalationOutcome.caseOutcome`**. `escalated` is in no other vocabulary: not a decision value, not a status, not a terminal reason. `CONTROL_CASE_OUTCOMES.AUTHORITY_UNAVAILABLE` **is** `CONTROL_CASE_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE`, and the containment (every terminal outcome is a case outcome) is pinned, so the two tables cannot drift. |
| `ControlCaseClosure` (amended F2) | `{ approvalCaseId, leg, terminalDecision }` — what a zero-review close returns: the derived case id, the **born-terminal** leg row it wrote, and the terminal `deny` it wrote with it. |
| `ApprovalCaseIdentityLookup` (amended F3) | `{ kind: 'found', approvalCaseId } \| { kind: 'none' }` — the answer of `findApprovalCaseByIdentity`. |
| `ControlRequestLegOutcome` (:555) | `{ kind: 'leg', leg } \| { kind: 'authority-unavailable', approvalCaseId, reviewAuthority, requiredAuthority, detail }`. |
| `ControlEscalationOutcome` | `{ escalation, terminalDecision, nextLeg?, caseOutcome: ControlCaseOutcome }` (amended F7: the cell was a bare literal union). |
| `ApprovalCaseSummary` (:580) | `{ state, carrierKind }`. |

Additive **durable row fields** (frozen names; every one is optional, and a
pre-Alpha.4 row keeps its exact old meaning):

- `ControlRequestRecord` gains EIGHT fields: `approvalCaseId?`, `legOrdinal?`,
  `reviewAuthority?`, `requiredAuthorityAtCreation?`, `beneficiaryAuthority?`,
  `requestedEffect?`, `previousRequestId?`, `mutationProposalFingerprint?`
  (`types.ts:810-846`). `operationFingerprint?` is NOT new — it is a pre-PR3
  scope leaf PR3 reuses as the case's operation identity, which is why
  `requestApprovalLeg` demands it (A1-15).
- `ControlDecisionRecord`: `terminalReason?: ControlLegTerminalReason`.
- `CONTROL_GUARD_BLOCK_REASONS.DECISION_UNRECOGNIZED = 'decision-unrecognized'`
  — the exhaustive-`switch` refusal in the guard (see §6).

## 2. Lane A — `packages/runtime/control/service.ts`

New fact type (local const `FACT_ESCALATION`, `service.ts`): `control-escalation-recorded`.
Registered in **both** category maps in this commit (§5). Not in
`INTERNAL_FACT_TYPES` (that registration is PR6's, §8).

`ControlService` gains exactly **eight** members (declared in `control/types.ts`,
implemented as factory operations and returned from the factory `return` in
`control/service.ts`; anchored by symbol per §1's rule — amended F2/F3: the first
version said **six** and cited six line numbers, all of which had already moved):

```ts
requestApprovalLeg(input: {
  rootSessionId: string
  caller: ActionCaller
  kind: ControlRequestKind
  reviewAuthority: ProposalAuthorityPosition
  requiredAuthorityAtCreation: ProposalAuthorityPosition
  identity: ApprovalCaseIdentityInput
  actionName: string
  toolName?: string
  capabilityDomain?: CapabilityName
  summary?: string
  executionCoupling?: ControlExecutionCoupling
}): Promise<ControlRequestLegOutcome>

escalateApprovalLeg(input: {
  rootSessionId: string
  caller: ActionCaller
  requestId: string
  reason?: string
}): Promise<ControlEscalationOutcome>

readApprovalCaseState(input: {
  rootSessionId: string
  approvalCaseId: string
}): Promise<ApprovalCaseReadOutcome>

listOpenApprovalCases(input: {
  rootSessionId: string
  subject?: ControlSubject
}): Promise<readonly ApprovalCaseSummary[]>

appendTerminalOutcome(input: {
  rootSessionId: string
  caller: ActionCaller
  requestId: string
  terminalReason: ControlLegTerminalReason
  note?: string
}): Promise<ControlDecisionRecord>

terminalDecisionValueFor(terminalReason: ControlLegTerminalReason): ControlDecisionValue

closeApprovalCaseWithoutLeg(input: {
  rootSessionId: string
  caller: ActionCaller
  approvalCaseId?: string
  identity?: ApprovalCaseIdentityInput
  carrier?: {
    kind: ControlRequestKind
    reviewAuthority: ProposalAuthorityPosition
    actionName: string
    toolName?: string
  }
  terminalReason: ControlLegTerminalReason
  note?: string
}): Promise<ControlCaseClosure>

findApprovalCaseByIdentity(input: {
  rootSessionId: string
  identity: ApprovalCaseIdentityInput
  kind?: ControlRequestKind
}): Promise<ApprovalCaseIdentityLookup>
```

**Exactly one of `approvalCaseId` / `identity`** is required. `carrier` is
required with `identity` and forbidden with `approvalCaseId`. The audit's frozen
shape carried neither `carrier` nor `actionName`, and that shape cannot write a
leg row: a leg row must say which rung could not review it and which operation the
case is about. Inventing either is the fabrication this lane exists to avoid, so
the caller supplies them — **disclosed deviation from the audit's literal
signature, in the direction of more truth, forced by F2's own requirement that the
termination be durable.**

Semantics PR4/PR5 depend on:

- **`requestApprovalLeg`** writes leg 1 only. If `!hasAuthorityResolver(reviewAuthority)`
  it terminates the case **durably** and then returns the `authority-unavailable`
  outcome (A1-12, **amended F2**): the case gets its leg row and its terminal
  `deny` in one transaction, the row being **born terminal**, so acceptance
  21.10 still holds — the case never appears in `listOpenApprovalCases`, never in
  the host fold's `pendingControlCount`, and the guard reports the durable deny —
  while the termination becomes observable, auditable, closable, and awaitable by
  A5-5's inline waiter. The previous behaviour ("writes **zero rows**") made the
  termination unreportable: `appendTerminalOutcome` needs a requestId, the case
  read needs a leg row, and the open-case list skips rows with no case identity.
  Idempotency is keyed on the case id + ordinal, so a retry of the same
  invocation returns the SAME leg (A1-10).
- **`closeApprovalCaseWithoutLeg`** is the frozen public path to that same durable
  close, for a caller that knows the case cannot produce a reviewable leg **before**
  asking for it (F2). `identity` form: derives the case id, writes
  `legOrdinal 1` + its terminal deny if nothing exists, and is **idempotent on the
  case** — a retry returns the closure the first call wrote, read back from the
  ledger, with zero new rows. `approvalCaseId` form: an already-terminal case
  returns its existing closure; a case with an **open** leg is REFUSED
  (`CONTROL_REQUEST_MALFORMED`, detail naming the rule: that leg is
  `appendTerminalOutcome`'s); a case with no rows is `CONTROL_REQUEST_NOT_FOUND`.
  The caller must be a resolver of `carrier.kind` (`CONTROL_RESOLVER_ROLES`, the
  same table the resolve path uses) — the only authority gate is that one, and the
  asymmetry that makes it sufficient is that a close can only ever write a `deny`.
  `requestApprovalLeg`'s A1-12 branch and this member share one writer
  (`closeZeroReviewCaseLocked`, renamed `closeZeroReviewCaseTransactionally` at
  §11 R3 — it ACQUIRES the lock, which `*Locked` elsewhere in the file does not
  mean), so there is exactly one durable shape. Its retry path now also COMPLETES
  a close that a `ledger.put` fault left half-written (§11 R3).
- **`findApprovalCaseByIdentity`** resolves a frozen identity to its case
  (A2-7): the id is **derived** by the same `approvalCaseIdOf` the writer uses and
  then **verified** against the durable rows — `state.requests` AND
  `state.corruptLegs`, so a case whose legs all failed the strict parser is still
  `found` (§11 R2) — and it answers `none` only for a case that does not exist (F3 — without it, a lane holding a fingerprint
  had no frozen path back to a case that `listOpenApprovalCases` cannot show,
  because a decided case is by definition not open).
- **`escalateApprovalLeg`** writes THREE rows in one lock-held transaction:
  the terminal `deny` decision with reason `escalated` (A5-5), the
  `control-escalation-recorded` fact, and the risen leg — unless the successor
  rung is absent or unresolvable, in which case the third write is skipped and
  `caseOutcome: 'authority-unavailable'` (spec §11.6). The risen leg is written
  by the lock-held writer (`writeLegRowLocked`, `service.ts:3400`), never by
  re-entering `requestControl` — `withTeamLock` is **not** reentrant.
  Refusals (zero side effects): unknown request, already decided, **abandoned**
  (checked before the resolver-role check), pre-Alpha.4 row, caller outside the
  kind's resolver roles, caller already in `reviewedBy`.
- **The leg key** (amended F14): a request row's id is the scope-keyed
  `requestId`, and the scope half is
  `(rootSessionId, subject, actionName, toolName, correlation, operationFingerprint)`
  — every leg of one case shares it. The leg half is
  `approvalCaseId\u0000legOrdinal` (`legOrdinal 0`-less, `''` for a row that
  belongs to no case), which is why `writeLegRowLocked` exists and why leg 2 is not
  swallowed by leg 1's idempotent return. Consequence PR4/PR5 must rely on: after a
  rise, **a retry of leg 1 returns the case's CURRENT leg** (leg 2), not leg 1 —
  the retry is idempotent per CASE, and the leg it returns is the one still open
  for review (pinned by `MUT-16`, which made the retry return the first leg).
- **`terminalDecisionValueFor`** is the frozen mapping and returns `'deny'` for
  every reason (A2-8). A terminal close can never mint an `allow` (pinned by
  `MUT-31`, which made one).
- The guard consults **each case's current leg** (highest `legOrdinal`), so an
  escalated-away leg cannot be the one an `allow` lands on. A decision row whose
  `decision` value is outside `CONTROL_DECISION_VALUES` is refused with
  `decision-unrecognized` **and** dropped by the reader — two independent gates.
- `escalated` **is** in `CONTROL_DECISION_REASONS`. If it ever is removed,
  `parseDecisionPayload` drops the row at read time, the deny vanishes and an
  inline waiter hangs — this is RED-01 (`red-captures/RED-01-escalated-reason-read-gate.txt`).

## 3. Lane B — `packages/runtime/intervention/types.ts`

Vocabulary (export sites are these line numbers; the barrel
`intervention/index.ts` re-exports every name):

`INTERVENTION_KINDS` / `InterventionKind` / `INTERVENTION_KIND_VALUES` (:51-61) ·
`INTERVENTION_RESPONSE_BEHAVIORS` / `InterventionResponseBehavior` (:70-76) ·
`INTERVENTION_STATUSES` / `InterventionStatus` / `INTERVENTION_STATUS_VALUES`
(:95-107) = `open | acknowledged | resolved | authority-unavailable | stale` ·
`InterventionBlockScope` (:116) = `null | { kind: 'configuration-operation', … } |
{ kind: 'operation', operationFingerprint } | { kind: 'subject-new-work', … } |
{ kind: 'team-new-work', … }` · `INTERVENTION_ACTIONS` / `InterventionAction` /
`INTERVENTION_ACTION_VALUES` (:130-140) · `INTERVENTION_DERIVATION_REASONS` /
`InterventionDerivationReason` (:145-165) = `leg-open | leg-decided |
leg-abandoned | reviewer-already-acted | no-resolver | ceiling-undetermined |
insufficient-reach | top-of-ladder` · `INTERVENTION_SOURCE_KINDS` /
`InterventionSourceKind` · `InterventionSource` — `carrierKind?: ControlRequestKind`
(amended F15: it was `string`, which let the carrier lane drift out of the frozen
control vocabulary; the projection fills it from the leg row's own `kind`) ·
`InterventionItem` (:199) — the frozen §14.1 field set **plus**
`derivationReasons`.

The injected-reader contract PR4 implements (this is the whole coupling between
the intervention law and the ceiling algebra):

```ts
interface RequiredAuthorityFacts {          // SIX members (amended F1: was seven)
  requiredAuthority: ProposalAuthorityPosition
  reviewerAtOrAboveRequiredAuthority: boolean
  desiredEffectWithinGrantCeiling: boolean
  ceilingUndetermined: boolean
  principalAlreadyActed: boolean
  resolverExists: boolean
}
interface RequiredAuthorityReaderInput {
  approvalCaseId: string
  legOrdinal: number
  reviewAuthority: ProposalAuthorityPosition
  beneficiaryAuthority: ProposalAuthorityPosition
  requestedEffect: PermissionOverlayEffect
  subject: ControlSubject
  actionName: string
  operationFingerprint?: string
  mutationProposalFingerprint?: string
}
type RequiredAuthorityReader =
  (input: RequiredAuthorityReaderInput) => RequiredAuthorityFacts | undefined | Promise<RequiredAuthorityFacts | undefined>
```

**`successorHasResolver` is GONE (amended F1).** It was the seventh member, and it
made the law unrepresentable: legality of `escalate` was computed as
`facts.successorHasResolver`, so a `human-user` leg — whose successor `human-admin`
exists in the frozen ladder but has no resolver in Alpha.4 — was evaluated at the
TOP of the ladder and lost `escalate`, contradicting spec §21.5 ("insufficient
reviewer: deny/escalate only; sufficient **non-admin** reviewer:
allow/escalate/deny; Admin: allow/deny only"). Escalate legality is now derived
from the **frozen ladder** the owner exports:

```ts
const mayEscalate = controlEscalationSuccessor(facts.requiredAuthority) !== null
```

so the reader supplies **rung identity and current-rung availability only**, and no
lane can re-rank the ladder by answering a boolean. The answer to "which conjunct
does PR4 implement" is: **none of them** — PR4 stops being able to get this wrong.
A reader may be **absent**, return `undefined`, or return a **`Promise`** (amended
F1/F6): the derivation awaits, and absence is reported as
`ceiling-undetermined` — never as a guessed authority and never as a `deny`.

**`requiredAuthorityAtCreation` is deliberately absent** — it is provenance
only and must never drive legality (spec §11.2; pinned by a key-set assertion).
The bag carries **no ranks and no ordering**: comparing rungs is the reader's
job. Lane B imports `ProposalAuthorityPosition` and `PermissionOverlayEffect`
**type-only**; it does not and must not import `grantCeiling`,
`AuthorityCeilingScope`, `RuntimeAuthority`, `authorityRank` or `mayReview`
(amended F13 for the attribution: `a3p3-governance-lane-hygiene.test.ts` pins
`RuntimeAuthority` consumers to **4 files** in its consumer walk, with the ban
carried by its SURFACE rows and that walk — the sentence "sanctioned route: none"
is **plan prose**, not a string that file contains, and the `:763` anchor was the
`RuntimeAuthority` count assertion. The pin stayed green with no edit.)

## 4. Lane B — `packages/runtime/intervention/derivation.ts`

Frozen outcome vocabularies (ADR X8; A5-2):

```ts
TERMINAL_OPERATION_OUTCOMES = {            // :62, type :72, values :76
  EXECUTION_SUCCEEDED: 'execution-succeeded', EXECUTION_UNAVAILABLE: 'execution-unavailable',
  STALE: 'stale', DENIED: 'denied',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable', AUTHORITY_UNDETERMINED: 'authority-undetermined'
}
TERMINAL_MUTATION_OUTCOMES = {             // :86, type :96, values :100
  MUTATION_COMMITTED: 'mutation-committed', MUTATION_NO_CHANGE: 'mutation-no-change',
  MUTATION_STALE: 'mutation-stale', DENIED: 'denied',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable', AUTHORITY_UNDETERMINED: 'authority-undetermined'
}
```

The axes a caller reports, and the two total tables:

```ts
TERMINAL_AUTHORIZATIONS = { ALLOWED, DENIED, STALE, NONE }              // :105
TERMINAL_AUTHORITY_STATES = { RESOLVED, UNAVAILABLE, UNDETERMINED }     // :115
TERMINAL_EXECUTIONS = { SUCCEEDED, UNAVAILABLE }                        // :125
TERMINAL_MUTATION_EFFECTS = { CHANGED, NO_CHANGE }                      // :133
deriveTerminalOperationOutcome(input: TerminalOperationInput): TerminalOperationOutcome  // :168
deriveTerminalMutationOutcome(input: TerminalMutationInput): TerminalMutationOutcome     // :192
```

Precedence is part of the contract: **authority → decision → execution**.
`authority-undetermined` is absorbing (an `allow` never outranks it, A5-2), and
`authority-unavailable` ≠ `authority-undetermined` (A1-7: a missing Admin is not
an undecidable ceiling).

The strict/legacy discriminator (X8) and the law:

```ts
CONTROL_ROW_SHAPES = { STRICT: 'strict', LEGACY: 'legacy' }             // :222
controlRowShapeOf(row: ControlRowDiscriminee): ControlRowShape          // :242
strictRowProblem(row): 'missing-review-authority' | 'missing-leg-ordinal' | undefined // :255
deriveLegalActions(facts: RequiredAuthorityFacts): LegalActionDerivation
deriveInterventionItem(caseState, reader?): Promise<InterventionItem | undefined>
deriveInterventionItems(caseStates, reader?): Promise<readonly InterventionItem[]>
deriveZeroLegAuthorityUnavailableItem(input): InterventionItem          // :510
currentLegOf(caseState: ApprovalCaseState): ControlRequestRecord | undefined // :539
```

The §11.5 law as implemented: `ceilingUndetermined` → `allow` illegal (never
coerced into `deny`); `!reviewerAtOrAboveRequiredAuthority ||
!desiredEffectWithinGrantCeiling` → `escalate? | deny`; sufficient non-top →
`allow | escalate? | deny`; top of ladder → `allow | deny`; `principalAlreadyActed`
or `!resolverExists` → `[]`. `escalate?` means "only when
`controlEscalationSuccessor(requiredAuthority) !== null`" — the frozen ladder, not a
reader-supplied availability boolean (amended F1). A `human-user` reviewer therefore
KEEPS `escalate` even though Alpha.4 has no Admin resolver; the rung exists, and
`authority-unavailable` is what a rise into it produces (spec §11.6). `escalate` grants **zero** execution authority and is
never consulted by a write path.

Discriminator rule: `approvalCaseId` presence selects `strict`; in `strict`, a
missing `reviewAuthority`/`legOrdinal` is a **typed problem**, never defaulted
(A2-9). A legacy row is never judged by the strict rules.

## 5. Lane C — `packages/runtime/intervention/projection.ts` + host/client folds

```ts
interface InterventionControlSource {          // :49 — the structural slice of ControlService the projection may read
  listOpenApprovalCases(input: { rootSessionId: string; subject?: ControlSubject }):
    Promise<readonly ApprovalCaseSummary[]>
}
interface InterventionSourceAdapter {           // :62 — the seam PR6 fills (Compatibility / GovernanceWarning); unwired here
  readonly source: string
  project(input: { rootSessionId: string; subject?: ControlSubject }): Promise<readonly InterventionItem[]>
}
freezeItem(item: InterventionItem): InterventionItem                       // :87 — deep-frozen
projectInterventions(input: ProjectInterventionsInput): Promise<readonly InterventionItem[]> // :115
projectZeroLegTermination(input: { approvalCaseId, requiredAuthority, fingerprint?, observedAt }): InterventionItem // :166
```

`projectInterventions` reads Control state **only**; one item per **case**
(`interventionId = 'int-' + approvalCaseId`, stable across legs — acceptance
21.9); a missing/throwing reader yields **no** legal actions, never a guess
(spec §18.3). **Status mapping lives in `derivation.ts`, not `projection.ts`**
(amended F9 — `projection.ts` only reads open cases, folds adapters and deep-freezes):
pending + resolver → `open` + `wait-for-response` + the operation block scope;
A1-12 zero-resolver → `authority-unavailable` + `informational` + `blockScope:
null`; decided → `resolved`; **abandoned → `stale`** (§14.1 offers no
`abandoned`; a sixth status would fork the vocabulary).

**Who can actually produce each status (amended F9):**
`projectInterventions` reads `listOpenApprovalCases`, so on its own it can produce
**only `open` and `authority-unavailable`**. `resolved` and `stale` have exactly one
producer — the case read plus the derivation:
`readApprovalCaseState` → `deriveInterventionItem(s)`, which is why both are
exercised that way in the test rather than through the projection.
`acknowledged` has **no producer in Alpha.4 at all**: nothing writes an
acknowledgement, so PR6 either adds the durable act that earns it or the status
stays unreachable. Naming this here is the point — a later lane that "wires the
projection" and sees four statuses in the vocabulary will otherwise assume four
producers.

Host fold `packages/runtime/src/plugin/projection-source.ts`:
`FACT_CONTROL_ESCALATION_RECORDED = 'control-escalation-recorded'` mapped to
category **`control`** (X8-R3's correction of A5-6's `policy` rationale). And the
X8-assigned duty is fixed here: **`pendingControlCount` now excludes abandoned
requests** (new `abandonedRequestIds` fold over `control-request-abandoned`,
mirroring the service's terminal-mark precedence), and the comment that used to
*claim* that parity is rewritten to state what the code does. Pinned by
`a4p3-intervention-projection.test.ts` and proven non-vacuous by
`red-captures/MUT-13-pending-count-abandon-blind.txt`.

Client mirror `packages/client/src/model/ledger-adapter.ts`:
`'control-escalation-recorded': 'control'`, registered in the same commit
(A5-22). The **value** is pinned by `ledger-adapter.test.ts` because
`a4pr0a-fact-type-closed-set.test.ts` C3 compares only the two maps' **key
sets** (no-red finding 1; RED-03).

## 6. What PR4 / PR5 may call, and what they must not

May: every symbol in §1-§5 via `packages/runtime/control/index.js` and
`packages/runtime/intervention/index.js`; `terminalDecisionValueFor` for any
close the reviewer did not choose; `deriveTerminal*Outcome` to name their
terminal outcome; `projectZeroLegTermination` when a request terminates
synchronously.

Must not: import `intervention/**` from the evaluator, the authority kernel,
`control/service.ts`, or the operation guard (A1-17 — pinned by the **walked** edge pins in
`a4p3-intervention-lane-hygiene.test.ts`, amended F4/F11); treat a projected item as authority
(items leave the projection deep-frozen, and the guard verdict is proven
byte-identical after a mutation attempt); add a **fourth** member to
`CONTROL_DECISION_VALUES` (which is `allow | deny | stale-denied` — amended F8)
or a fourth `ControlRequestStatus`; name the ladder with `RuntimeAuthority`
(use `ProposalAuthorityPosition` type-only); add a new fact type without
registering it in BOTH maps and pinning the client's **value**.

## 7. Error codes

`CONTROL_ERROR_CODES` is unchanged — `control/errors.ts` is not in Task 3's
`Files:` list, so PR3 adds **zero** new error codes. Every new refusal is either
an existing code (`CONTROL_REQUEST_ABANDONED`, `CONTROL_RESOLVER_NOT_AUTHORIZED`,
`CONTROL_REQUEST_DECIDED`, `CONTROL_REQUEST_NOT_FOUND`, …) or a closed **result
union** member (`ControlRequestLegOutcome`, `ControlEscalationOutcome`,
`ApprovalCaseReadOutcome`, `ApprovalCaseIdentityProblem`).

## 8. Disclosures and deviations (all deliberate, all in the PR body)

1. **X8: "PR3 produces outcome vocabulary and derivation only."** PR3 supplies
   the vocabularies, the derivation law, and the additive `terminalReason`
   decision-row field, reusing already-registered fact types. Durable recording
   behind a real execution/mutation and the registration files that surface the
   outcomes are PR4/PR5 lane C / PR6.
2. **Interim rendering disclosure.** `control-escalation-recorded` is in both
   category maps but **not** in `INTERNAL_FACT_TYPES`, which PR6 owns (A5-7).
   Until PR6, escalation and abandonment rows render as **generic Events**; the
   Intervention items above are the server-side truth PR6 will surface. Recorded
   in `intervention/index.ts` and pinned as a disclosure in the projection test.
3. `authority-unavailable` is **retained** as a terminal `InterventionStatus`
   (spec §14.1 and §11.6 freeze it; the ADR contains no ruling removing it —
   X8-R3 corrects only the fact *category*). It is terminal and never
   `wait-for-response`.
4. **(amended F4 — the original disclosure 4 was factually false.)** It claimed
   the lane named no separate hygiene test file. Plan line 305 **does** name one:
   `Test create: packages/runtime/test/a4p3-intervention-lane-hygiene.test.ts`.
   Folding the pin into the projection test did not satisfy a named `Files:`
   entry. The file now **exists**, holds the A1-17 edge pins, and the folded copies
   were **removed** from the projection test. A false disclosure in a freeze is
   worse than the missing file it described.
5. **(split per amendment F5 — the original claimed both conditional files needed
   no edit, and half of that was refuted.)**
   - `a3p3-governance-lane-hygiene.test.ts` needed **no** edit, and that half is
     true: no new `RuntimeAuthority` consumer appeared, so its 4-file consumer pin
     stayed green untouched (17/17).
   - `a4pr0a-fact-type-closed-set.test.ts` **was edited**, because the plan's line
     for it is a **duty**, not a blocker: "A4-4/A5-16 **positive containment** for
     `control-escalation-recorded`". The guard was green without the edit precisely
     because it does not name the row: C1 is a floor plus a `.has()` list, and
     C2/C3 compare **key sets**. Containment is now asserted positively — C3
     requires the row in **both** maps, C4 requires the host **category value** to
     be `control` (key presence alone would pass a row filed under `policy`), and
     the client's value stays pinned in `ledger-adapter.test.ts`. Proven
     non-vacuous by `MUT-28` (renaming the host constant turns five of the nine
     tests red).
6. `packages/contracts/src/projection/ledger.ts` untouched: the eight frozen
   categories already cover the row, and `CONTROL_*` vocabularies are runtime-side.
7. `packages/runtime/intervention/**` is **not** added to
   `packages/runtime/tsconfig.build.json` (A4-6 zero-dist posture, restated for
   PR3 at plan line 302). `control/**` IS in the include, so `control/**` edits
   co-commit `dist/packages/runtime/control/*` in the same commit (A5-19).

## 9. Amendments at audit time (F1-F16) — this section supersedes §1-§8

The parent audit read the freeze read-only and returned sixteen findings. Every
one is dispositioned below; the ones that changed code or the frozen surface are
marked **code**, and each carries the RED or mutation proof that backs it.

| # | Finding | Disposition | Proof |
| --- | --- | --- | --- |
| F1 | `mayEscalate = facts.successorHasResolver` made a human-user leg compute at the top of the ladder (spec §21.5 violated) | **code.** `RequiredAuthorityFacts` drops `successorHasResolver` (7 → 6 members); legality reads the frozen ladder | RED `RED-05-F1-escalate-legality.txt`; `MUT-20a` (escalate never legal) 4 red, `MUT-20b` (always legal) 2 red |
| F2 | no frozen path made a zero-leg termination durable | **code.** `closeApprovalCaseWithoutLeg` + `ControlCaseClosure`; the A1-12 branch now writes a born-terminal leg + terminal deny through the same locked writer; "six members" → **eight** | RED `RED-06-F2-F3-close-path-and-identity-lookup.txt`; `MUT-21` (close removed) 4 red, `MUT-22` (open leg preempted) 1 red, `MUT-23` (authority gate removed) 1 red, `MUT-31` (close mints `allow`) 1 red, `MUT-32` (close not idempotent) 1 red |
| F3 | PR5 could not map a fingerprint to a case (`approvalCaseIdOf` private) | **code.** `findApprovalCaseByIdentity` exported, derived-then-verified | same RED-06; `MUT-24` (unverified lookup) 1 red |
| F4 | disclosure 4 was false — plan line 305 names `a4p3-intervention-lane-hygiene.test.ts` | **test.** File created; the folded pins removed from the projection test | §8.4 rewritten; 9/9 green |
| F5 | the a4pr0a containment duty was unmet while claimed as "no edit needed" | **test.** positive containment in C3 and C4 | `MUT-28` 5 red |
| F6 | the throwing reader fabricated `requiredAuthority` and offered `deny` | **code** (already amended before this round). Absence yields no actions and no published authority | `MUT-26` (re-synthesizing bag) 1 red |
| F7 | `caseOutcome` was a bare literal union; `escalated` in no frozen vocabulary | **code.** `CONTROL_CASE_OUTCOMES` feeds both; containment pinned | `MUT-27` (name drift) 1 red |
| F8 | §1 and §6 described `CONTROL_DECISION_VALUES` as two members | **doc.** both now read `allow \| deny \| stale-denied` | text |
| F9 | the status mapping was attributed to `projection.ts`; no call path named | **doc + test.** mapping attributed to `derivation.ts`; `resolved`/`stale` attributed to `readApprovalCaseState → deriveInterventionItems`; `acknowledged` has no producer | §5, §9 |
| F10 | PR4 needs the p4t6 number | **hand-off.** the recomputed pin is **995** — NOT the 994 this freeze first handed over, because F4's own remedy added a scannable file (`packages/runtime/test/a4p3-intervention-lane-hygiene.test.ts` is the eighth entry of `SCANNED_PATHS_A4PR3`: `987 + 8 = 995`, `expect(SCANNED_PATHS_A4PR3.length).toBe(995 - 987)`); follow the `SCANNED_PATHS_A4PRn` pattern: add your own list, extend the total, do not renumber | `gates/p4t6-GREEN.txt` |
| F11 | the edge pin was a hand-maintained 7-file list with `catch { continue }` | **test.** both directions are directory walks now, with count floors and named anchor files | `MUT-29` (a reverse edge added inside the walk) 1 red |
| F12 | payload-exactly-five conflated with the derived record | **test.** the two claims are separate; `escalationSequence` and `createdAt` pinned against the ledger row | `a4p3-approval-escalation.test.ts` |
| F13 | line-number anchors (87 stale) and a mis-attributed quote | **doc.** symbol anchors; the `RuntimeAuthority` ban attributed to a3p3's SURFACE rows + consumer walk, "sanctioned route: none" marked as plan prose | §1, §3 |
| F14 | the leg key was not stated | **doc.** `approvalCaseId\u0000legOrdinal` inside the scope-keyed requestId; a retry after a rise returns the CURRENT leg | `MUT-16` |
| F15 | `InterventionSource.carrierKind` was `string` | **code** (done before this round). It is `ControlRequestKind` | barrel surface pin |
| F16 | `createdAt: identity.correlation` fabricated a timestamp | **code + test.** no item when no durable instant | `MUT-25a` was an **invalid** flip (its replacement broke the syntax, so the suite failed to load — recorded, not counted); `MUT-25b` re-runs it validly |
| **R** | (not an audit finding) `control/service.ts` was destroyed by this writer at 08:48 and rebuilt | **see §10** — the frozen surface is unchanged; the reconstruction's five known textual/behavioural differences, the fidelity count and the full re-proof are in §10 | `red-captures/reproof-after-rebuild/` |

Three "Test update" files named by the plan —
`control-legacy-row-compat.test.ts`, `p6t4-restart.test.ts`,
`f9-control-exactly-once.test.ts` — **are** modified in this worktree
(`git status --porcelain` shows all three, with new scenarios `S5`, `s4`, `s3`).
The audit's statement that they "do not appear in your working diff" was true of
an earlier state and is no longer.

---

Two further rows are consequences of this round, recorded so the register is the
whole story:

* **F4's remedy moved the p4t6 pin** from 994 to **995** (the lane-hygiene spec is
  the eighth `SCANNED_PATHS_A4PR3` entry). PR4 works from 995.
* **A new pin exists**: `refuses to authorize on a row the case read refuses, even
  with a durable allow (A2-9)` in `a4p3-approval-case.test.ts` (18 tests in that
  file now), proved by `MUT-33-strict-leg-row-rule-removed`. It is the pin that
  caught the one place where the rebuilt file was weaker than the destroyed one.

---

## 10. Reconstruction disclosure — `control/service.ts` was destroyed and rebuilt

This is the most important section of this file. It does not change any frozen
signature; it changes the **provenance** of the file that implements them.

**What happened.** At 08:48, while capturing the evidence for a mutation proof,
this writer ran a Python heredoc of the shape
`io.open(p, 'w').write(io.open(p).read().replace(...))`. Python evaluates the
outer `open(p, 'w')` — which truncates the file to zero bytes — **before** the
inner read. `packages/runtime/control/service.ts` went to 0 bytes, and every
A4-PR3 edit to it that was not committed was destroyed (the working diff against
HEAD showed `2781 deletions`). No commit had ever been made in this worktree, so
nothing was in the object database.

**Recovery attempts, all negative (each was actually run, none is assumed):**

| attempt | result |
| --- | --- |
| `git checkout -- control/service.ts` | the **pre-PR3** file (2781 lines, zero PR3 symbols) |
| `packages/runtime/dist/.../control/service.js` (07:51 build) | zero PR3 symbols |
| `service.js.map` | no `sourcesContent` |
| `.tsbuildinfo` | does not exist |
| `.vite/vitest/*/results.json` | no source text |
| `git fsck --lost-found` | 12 dangling blobs, none of them this file |
| stream scan of `git cat-file --batch-all-objects --batch` (32,148 objects) for `requestApprovalLeg` / `closeZeroReviewCaseLocked` | `NO HITS` |

**What the rebuild was made from.** HEAD, plus these surviving artefacts, each
used verbatim rather than retyped where possible: `.tmp-xdg/pr3-ops.ts` (an
08:07 fragment holding the whole appended operations region, 828 lines);
`.tmp-xdg/edit-f23-service.py` (the F2/F3 operations, the export lines and the
A1-12 durable branch as literal patch text); `.tmp-xdg/edit-f7.py` and
`.tmp-xdg/edit-f2-prose.py` (the frozen-vocabulary wiring and the corrected
A1-12 comment); the needles in `pr3-mutate-v2.py` / `-lanebc.py` / `-batch3.py`
(verbatim fragments of the guard, the reader gate, the corrupt-leg bucket, the
retry-returns-current-leg block); the untouched `control/types.ts`,
`control/index.ts`, `control/leader-notification.ts`, `intervention/**` (all
verified byte-identical to their post-incident backups) and the 157-test suite.

**Fidelity measurement.** 778 of the 809 non-blank fragment lines are present in
the rebuilt file **verbatim**; the 31 that are not are exactly the intended
post-08:07 deltas (indexed-access guards, the read-back leg writer, the F1/F2/F7
amendments) — nothing else moved.

**Where the rebuilt file is known to differ from the destroyed one.**

1. `loadControlState`: the corrupt-leg bucket is an `else if` **inside** the
   `control-request-recorded` branch (the destroyed file's exact nesting could
   not be recovered; behaviour is the same and `MUT-14` is re-proven).
2. `writeLegRowLocked` returns the row **read back** from the ledger. The
   destroyed version assembled a `LedgerEntry` literal, which does not typecheck
   against `LedgerEntry` (`RootSessionId` / `RemoteSafeRecord`) — evidence that
   the destroyed file had a looser shape here, not that behaviour differed.
3. The strict rule "a row that names a case must carry `legOrdinal` and
   `reviewAuthority`" is now enforced in `parseRequestPayload`, where the
   destroyed file enforced it through the corrupt-leg classifier. The rebuilt
   file is **stricter**: such a row is invisible to the guard, not merely
   unreportable. This was found by mutation — the first re-run of `MUT-15` came
   back **green**, which was a real weakening, and it is what prompted the new
   pin and `MUT-33`.
4. `listOpenApprovalCases` has no `corrupt[]` accumulator, so **`MUT-19` is not
   re-provable against the rebuilt file** — its target construct does not exist.
   The law it pinned (a corrupt case is never listed as open, and the healthy
   cases still list) is covered by `MUT-17` (re-proven) and by the new pin
   `refuses to authorize on a row the case read refuses, even with a durable
   allow (A2-9)`.
5. Comment prose inside the reconstructed regions may differ from the destroyed
   wording. Every frozen name, signature, vocabulary member and durable payload
   shape is unchanged, because those live in `types.ts` and the freeze, which
   survived.

**Re-proof.** Every mutation of every batch was re-run against the rebuilt file;
the raw output is in `red-captures/reproof-after-rebuild/` (the original captures
stay in `red-captures/`, since evidence is append-only, but they describe the
destroyed file). `MUT-19` is the single flip that could not be re-run, and
`MUT-15` was green on the first re-run and red after the fix — both facts are in
the PR body.

---

## 11. Amendments at fidelity-review time (R1-R4) — this section supersedes §9 where they differ

The fidelity review's verdict was **TRUST WITH CORRECTIONS**: the rebuild was
faithful, four findings blocked merge. All four are fixed in production code, each
with a raw RED capture (`red-captures/RED-07…`, `red-captures/RED-08…`) and a
production-only mutation proof (`red-captures/reproof-review-fixes/`,
`MUT-34`…`MUT-45`). **Zero new error codes**; the frozen surface keeps its shape,
with two additions inside already-frozen signatures (R2's refusal, R4's refusal),
both typed from the existing vocabulary.

### R1 — the escalated-away law has one home, and it is on the DECISION path

`assertNoActOnEarlierLeg` (in `control/service.ts`, beside `sameCallerRef`) is the
single place this law lives. Its three callers are `escalateApprovalLeg`,
`resolveControl` and `appendTerminalOutcome` — each **after the role gate and
before the envelope and before any write**, so a refusal never needs authority the
caller had not already used and leaves the ledger byte-unchanged. Its basis is the
case's OWN durable rows: a decision by this caller on a lower-ordinal leg, or an
escalation fact this caller wrote for a lower-ordinal leg. It deliberately does not
read the derived `reviewedBy` view (which still has no write-path consumer): a law
resting on a display value is not a law. Pre-Alpha.4 rows carry no case id and are
untouched by it.

Proofs: `MUT-34`/`MUT-35`/`MUT-36` remove the call at one entrance each;
`MUT-37`/`MUT-38` kill one durable basis each — both bases are driven **alone**,
from raw rows, because today's writers co-write them and a co-written pair hides
either branch; `MUT-39` broadens the law to every principal and is reported
**CAUGHT-COARSE**: that mutant is over-broad by construction, so it also refuses
legitimate reviewers and crashed both lane modules instead of colouring one
assertion. The precise positive-side pin is
`the law binds the principal who acted — a fresh reviewer still decides`. The
anti-divergence pin the review asked for lives in lane A:
`resolveControl, appendTerminalOutcome and escalateApprovalLeg agree`, which
compares the three verdicts as data rather than re-asserting the refusal.

**The review's direct question — did the pre-destruction file touch
`resolveControl`? Answer: CANNOT TELL.** The rebuilt body is byte-identical to
HEAD's (184 lines), and no surviving artifact — the 08:07 fragment, the patch
scripts, the driver needles, the vitest transform cache, a scan of every object in
the git store — contains a single line of it; the freeze never named it either.
Because no test of mine drove `resolveControl(escalated-away reviewer, risen leg)`,
no captured result distinguishes "it was never touched" from "it was touched and
the touch was lost". That is the honest limit of the evidence, and it is why R1 is
now pinned by tests rather than by recollection.

### R2 — the identity route and the idempotent retry stop collapsing a corrupt case

* `findApprovalCaseByIdentity` verifies the derived id against `state.requests`
  **and** `state.corruptLegs`. Answering `none` for a case the ledger holds was the
  SF1/X7-R5 double-case collapse relocated: this is the only frozen route from a
  fingerprint back to a case id, and `listOpenApprovalCases` cannot show a corrupt
  case. `found` here means "the ledger has this case", **not** "the case is
  usable" — the read that follows names the typed problem.
* `requestApprovalLeg`'s current-leg retry now **refuses** a `problem` read
  (`CONTROL_REQUEST_MALFORMED`, detail naming the problem) instead of concluding
  "no current leg" and handing back the closed first leg, which an inline waiter
  would then wait on forever. The frozen return union has no arm for a corrupt
  read, so the corruption surfaces as a typed throw; the precedent inside these
  paths is `writeLegRowLocked`'s read-back failure. This amends F14's wording: a
  retry after a rise returns the CURRENT leg **or refuses** — never a superseded
  one.

Proofs: `MUT-40` (lookup blind to the corrupt bucket), `MUT-41` (retry answers a
corrupt case with a closed leg — this flip IS the pre-fix code, so the RED for this
half of R2 is a mutation capture, `RED-08` covering the rest).

### R3 — "one lock-held transaction" is serialization; the close reconciles, the rise discloses

* **Rename:** `closeZeroReviewCaseLocked` → **`closeZeroReviewCaseTransactionally`**.
  It acquires the per-team lock itself, so its callers must not hold it
  (`withTeamLock` is not reentrant); a `*Locked` helper elsewhere in the file still
  means "the caller holds the lock", and that distinction was the lie being told.
* **The close reconciles its own partial state.** A fault between the leg write and
  the deny left an open leg on a rung with no resolver — reviewable by nobody, and
  the retry was refused by it, so the fake-pending state acceptance 21.10 forbids
  was permanent. Such a leg is now COMPLETED by the retry: the same locked writer
  writes the missing `deny` and returns the closure. The recorded `terminalReason`
  is the retry's, which is the only one the ledger was ever told. A leg whose rung
  CAN review it still refuses (that leg is `appendTerminalOutcome`'s). Proofs:
  `MUT-42` (the old refusal returns), `MUT-43` (reconciling a reviewable leg steals
  a review — the pre-existing `an open leg is appendTerminalOutcome's` pin dies).
* **Disclosed, not reconciled:** a fault between write 2 and write 3 of
  `escalateApprovalLeg` leaves the case **decided** with reason `escalated`, the
  `control-escalation-recorded` fact durable, and **no risen leg**. The state is
  survivable and fail-closed: the leg is denied, nothing is consumable, the case is
  readable and not open, no authority is minted, and the caller's
  `DURABLE_WRITE_FAILED` retry is refused `CONTROL_REQUEST_DECIDED`. Recovery is a
  NEW case on the same identity, not a retry of this one. PR5 must render an
  escalation with no successor leg as "the rise failed" — never as "awaiting
  <successor>". This lane does not reconcile it, because a repair would have to
  distinguish it from a top-of-ladder escalation, which legitimately has no risen
  leg. The behaviour is pinned so that changing it later is a deliberate act:
  `the retry is refused DECIDED — this lane does NOT reconcile a faulted rise`.

### R4 — a risen leg carries the case's frozen identity or the rise is refused

The three invented values (`requiredAuthorityAtCreation ?? successor`,
`beneficiaryAuthority ?? successor`, `requestedEffect ?? 'ask'`) are gone. The
identity is copied from the parent leg row and verified **before any write**; a row
that carries none is refused `CONTROL_REQUEST_MALFORMED` naming the fields.
Invention was not the safe option here: `beneficiaryAuthority` participates in the
derived case id, so an invented one makes the legs of one case disagree and the
case read answers `IDENTITY_DISAGREEMENT` — the rise would have destroyed the case
it was advancing (ADR A2-9: refusal, not invention). Only a rise that actually
mints a leg requires one; the top of the ladder and a no-resolver successor
terminate as before. Proof: `MUT-44`.

### Items the review asked to carry

| item | amendment |
| --- | --- |
| `kind` default | `findApprovalCaseByIdentity` and `closeApprovalCaseWithoutLeg` default `kind` to `CONTROL_REQUEST_KINDS.LEADER_APPROVAL` when the caller omits it, and `kind` participates in the derived id. PR4/PR5 must pass `kind` explicitly whenever the carrier is not `leader-approval`, or they will look up (or write) a different case than they named. |
| `reviewPayload` on the rise | the risen leg does not carry `reviewPayload` / `reviewPayloadDigest`. **Not reachable today**: `requestApprovalLeg` accepts no reviewPayload, so no case leg can ever hold one. If PR5 widens that input, the rise MUST forward both fields — recorded now so the evidence attached to a case cannot be silently dropped at the rung that most needs it. |
| read-back asymmetry | `writeLegRowLocked` re-reads its row and fails (`DURABLE_WRITE_FAILED`) when the durable row disagrees with what it wrote; the pre-existing `requestControl({leg})` entrance does not. Reachable when PR4/PR5 widen the vocabulary. Disclosed, not changed: that function is HEAD's and this lane's budget is zero. |
| current-leg law | one home now: `currentLegOf` / `isLaterLegThan` — highest leg ordinal, ties to the LATER durable row, used by `guardOperation`'s candidate filter AND by `buildApprovalCaseState`. The two rules this replaced disagreed on equal ordinals and only the duplicate-ordinal refusal hid it. Proof: `MUT-45` against the new pin `the guard does not proceed on the row the reader refused`. |
| "refuses to authorize" is not "blocked" | the strict leg-row rule IS on the guard path (via the shared parser, so there is no A2-9 divergence between reader and guard), but its verdict for an unreadable row is `no-request`, and `packages/tools/src/guard.ts` maps `no-request` to **proceed** (a pre-existing, documented deviation: the tool layer hosts the whole team surface, not one guarded operation). A strict-row refusal therefore removes the control plane's authorization; it does not by itself stop the tool. PR4/PR5 must never describe a `no-request` verdict as a blocked operation. |
