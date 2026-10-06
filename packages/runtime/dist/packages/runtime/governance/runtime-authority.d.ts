/**
 * THE RUNTIME AUTHORITY MODEL: the one name for "who is acting", and the
 * minimum-authority evaluator that consumes it (plan Task 2 lane A; spec §7.2-§7.4,
 * ADR X2/X5-E1/A5-1/A5-2/A1-7).
 *
 * ---------------------------------------------------------------------------
 * `RuntimeAuthority` IS NOT A RE-SPELLED UNION (correction X7-R3)
 * ---------------------------------------------------------------------------
 *
 * It is `ProposalAuthorityPosition` under the name the governance prose uses:
 *
 *     import type { ProposalAuthorityPosition } from './proposal-store.js'
 *     export type RuntimeAuthority = ProposalAuthorityPosition
 *
 * PR0 froze the ladder at `proposal-store.ts:148-151` precisely so that no second
 * spelling could exist, and PR2's evaluator is the module a reader would expect
 * to own one — so this file is where the temptation lives, and where it is
 * refused. A re-spelled `'member' | 'leader' | 'human-user' | 'human-admin'` is
 * STRUCTURALLY ASSIGNABLE to `ProposalAuthorityPosition` in both directions, so
 * the mutual-assignability assertion PR0 asked for passes on it and proves
 * nothing; the only guard that can see the violation is a source scan plus
 * positive containment of the rank map's keys, and `a4p2-authority-ceiling.test.ts`
 * carries both — each with its offender INJECTED, because a scan pattern that has
 * never matched anything is not a guard, it is a comment (correction X9).
 *
 * The rank ORDER lives in `authority-ceiling.ts` as `AUTHORITY_RANK`, next to the
 * `mayReview` that consumes it (X5-E1 moved that pair there); the ladder VALUES
 * live in `proposal-store.ts`. This module holds neither copy, which is why it can
 * import from both without a cycle: the dependency runs one way, here.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE EVALUATOR ANSWERS, AND WHAT IT MUST NEVER ANSWER
 * ---------------------------------------------------------------------------
 *
 * "What is the MINIMUM authority this elevation needs, and what was the evidence"
 * — spec §7.3. It is a pure function of the documents and the ladder: no storage,
 * no clock, no case row, no mutation snapshot (those belong to PR3/PR4/PR5).
 *
 * Two things it must not do, both of which its output shape makes impossible:
 *  - It does not report availability. "No Human Admin exists to sign this" is a
 *    fact about the RESOLVER, and spec §7.3 assigns it to the orchestration layer;
 *    an evaluator that answered `admin-unavailable` would be read as an outcome
 *    and minted into a proposal.
 *  - It does not return `requiredAuthority` alongside an undetermined ceiling
 *    (spec §24.2, ADR A1-7): the terminal `authority-undetermined` outcome must
 *    not carry a position, because a position is a routing instruction and
 *    "we could not evaluate the documents" is not one.
 *
 * @module @dsh-agent-team/runtime/governance/runtime-authority
 */
import { type AuthorityEffect, type AuthorityResourceMatcher, type EffectiveCeiling, type SubtreeContains } from '../../domain/authority-envelope/src/index.js';
import { type AuthorityDocumentName, type AuthorityEnvelopeDocuments } from './authority-ceiling.js';
import type { ProposalAuthorityPosition } from './proposal-store.js';
/**
 * The authority of a principal acting in the runtime, as the governance layer
 * names it. NOT a new union — PR0's closed set, under this name (see the module
 * header; correction X7-R3). Every parameter that means "which rung" is spelled
 * with this type from here on, including PR3's `ApprovalCase` legs and PR5's
 * proposal routing.
 */
export type RuntimeAuthority = ProposalAuthorityPosition;
/** The evaluator's terminal answer. ADR A1-7 keeps these three apart from each
 *  other and from the mutation lane's `authority-unavailable`, which this module
 *  cannot even express: an unreadable document REFUSES out of `grantCeiling` with
 *  `AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE` and never arrives here as a value. */
export type AuthorityEvaluationOutcome = 'direct' | 'approval-required' | 'undetermined';
/** The evidence the evaluation is built from — the audit trail PR3 records on the
 *  case and PR5 records on the proposal, computed rather than asserted. */
export interface AuthorityEvaluationEvidence {
    /** The rungs consulted, lowest first. */
    readonly consideredRoles: readonly RuntimeAuthority[];
    /** WHICH documents bound each consulted rung. Positional, so a reviewer can see
     *  at a glance that the Human User's row never names
     *  `permissionMutationEnvelope` (spec §7.4.1, ADR A5-1) — the row that a
     *  beneficiary-keyed matrix cannot show. */
    readonly boundDocumentsByRole: Partial<Record<RuntimeAuthority, readonly AuthorityDocumentName[]>>;
    /** The rungs SKIPPED because their decided ceiling was strictly below the
     *  desired effect. Empty whenever the ladder default sufficed, which is the
     *  shape of "an absent rule imposes no narrowing". */
    readonly roseBecauseInsufficient: readonly RuntimeAuthority[];
}
/** The shape spec §7.3 defines. `requiredAuthority` is ABSENT — not `undefined`
 *  spelled three ways — on the undetermined arm, so a caller that reads it
 *  unconditionally gets a compile error instead of a routing instruction minted
 *  out of an unevaluable document. */
export interface AuthorityEvaluation {
    readonly outcome: AuthorityEvaluationOutcome;
    readonly requiredAuthority?: RuntimeAuthority;
    readonly ceilingByRole: Partial<Record<RuntimeAuthority, EffectiveCeiling>>;
    readonly ceilingUndetermined: boolean;
    readonly evidence: AuthorityEvaluationEvidence;
}
/** Every field is required and none has a default. A defaulted
 *  `desiredEffect` would evaluate the ladder against `deny` — the effect that
 *  every ceiling trivially reaches — and return "the ladder default may sign
 *  this" for an input the caller forgot to complete; a missing document slot
 *  would be read as `absent`, i.e. as a document that narrows nothing. Both are
 *  silently PERMISSIVE, which is why the type makes them unrepresentable and
 *  {@link evaluateAuthorityCeiling} re-checks them at the boundary. */
export interface AuthorityEvaluationInput {
    /** Whose authority is being elevated. Selects the ladder default — "a Member
     *  ask starts at Leader; a Leader's own expansion starts at Human User"
     *  (spec §7.4) — and nothing else. Never selects the documents (ADR A5-1). */
    readonly beneficiaryAuthority: RuntimeAuthority;
    /** Who is acting. Spec §7.2 lists the conceptual inputs and this is the one
     *  they omit, because §7.3's `direct` arm is otherwise UNREACHABLE: nothing
     *  derivable from the beneficiary alone distinguishes "the Leader may commit
     *  this now" from "a Human User must sign it first", and shipping an outcome arm
     *  no input can produce is the defect class this PR was told to avoid. With it,
     *  `direct` means `mayReview(initiator, beneficiary, requiredAuthority)` —
     *  which, because every rung above the required one is capped by a SUBSET of
     *  what capped the required one, also means the initiator's own ceiling
     *  reaches. */
    readonly initiatorAuthority: RuntimeAuthority;
    readonly operationClass: string;
    /** The RUNTIME canonical matcher form. `buildAuthorityEnvelope`
     *  (`src/plugin/permission-plane.ts:468`) is the only AST→runtime
     *  canonicalization in the repository (correction X5-E2); the `*Ast` types stay
     *  hash-bound to the declared document and never reach this boundary. */
    readonly matcher: AuthorityResourceMatcher;
    readonly desiredEffect: AuthorityEffect;
    /** The THREE-WAY slot pair, not two `AuthorityEnvelope | undefined`s: this is
     *  the component that must not fold `unavailable` into `absent` (correction
     *  X7-R5, ADR A5-16). An unreadable document refuses; an absent one narrows
     *  nothing on this plane. */
    readonly documents: AuthorityEnvelopeDocuments;
    /** The filesystem truth the subtree questions need. ABSENT here means the
     *  questions are unanswerable, which the algebra reports as `undetermined` —
     *  and `undetermined` is absorbing, so the whole evaluation comes back
     *  `undetermined` rather than optimistically decided (ADR A1-6/A5-2). */
    readonly subtreeContains?: SubtreeContains;
}
/**
 * The minimum authority an elevation requires (plan Task 2 Produces, spec §7.2-
 * §7.4). Pure: same documents, same answer.
 *
 * The walk is the spec's pseudo-code (§7.4:304-316) and the RISE is the only
 * thing that can move it: start at the rung above the beneficiary, and climb while
 * that rung's APPROVAL ceiling is decided-but-below the desired effect. Two
 * consequences worth stating because they are the reviewable part:
 *
 *  - An ABSENT document never causes a rise. On the approval plane it contributes
 *    the identity, so a v1/v2 Team (no hard ceiling at all) answers a Member ask
 *    at Leader exactly as spec §7.4.1's first case requires. "No rule" is not
 *    "no authority" here, and only here does that sentence have a consequence.
 *  - An UNDETERMINED narrowing ENDS the walk as `undetermined`, and the answer
 *    carries no position. A scope whose containment cannot be decided has no
 *    approvable set, so naming a reviewer for it would route a case that nobody
 *    is authorized to sign (ADR A1-7, spec §24.2).
 *
 * This is the APPROVAL plane. The caller that decides whether an initiator may
 * WRITE NOW consults `expansionCeiling` as well, and the two numbers are not
 * interchangeable (correction X7-R5): fusing them dead-locks every Leader approval
 * in a Team whose hard ceiling is the documented `{ rules: [] }`, and lets a Leader
 * expand what no document ever granted.
 */
export declare function evaluateAuthorityCeiling(input: AuthorityEvaluationInput): AuthorityEvaluation;
//# sourceMappingURL=runtime-authority.d.ts.map