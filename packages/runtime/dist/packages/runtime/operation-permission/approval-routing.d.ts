/**
 * approval-routing.ts — A4-PR4 lane A: WHO must approve a concrete operation.
 *
 * THE QUESTION THIS MODULE ANSWERS, and the one it deliberately does not.
 * The permission plane already answered "is this operation allowed, asked
 * about, or denied" (permission-resolver.ts, the merged dynamic lane). When
 * that answer is ASK, something else has to say which rung of the authority
 * ladder has to sign — and until now that sentence was written by one
 * expression in the adapter: `isLeader ? 'user-approval' : 'leader-approval'`
 * (spec §10.1 names exactly this as the thing to replace). That expression
 * confuses two different facts: the ROLE of whoever happens to be holding the
 * keyboard, and the AUTHORITY the operation requires. This module computes
 * the second. The carrier kind the durable row wears is then DERIVED from it
 * (spec §10.1.4: the legacy request kind survives as a compatibility carrier,
 * never as semantic authority).
 *
 * THE THREE ARMS, in the order the spec's §7.4 walk produces them:
 *
 *  1. `approval-required` — a named rung must sign. `requiredAuthority` is
 *     that rung; `carrierKind` is the legacy request kind that carries it:
 *     Leader → `leader-approval`, Human User / Human Admin → `user-approval`.
 *     The carrier is a DISPLAY/COMPATIBILITY fact: the review authority that
 *     may act is `requiredAuthority`, recorded on the leg, and a carrier that
 *     disagrees with it is a bug in the caller, not a second opinion.
 *  2. `direct` — the initiator already holds the rung the operation requires
 *     over its own beneficiary (spec §7.3's `direct` arm: "the Leader may
 *     commit this now"). No case is opened, because a case would ask a rung
 *     to approve what the acting rung already holds — and §21.4 forbids a
 *     self/same-level allow. `packages/tools/src/guard.ts` proceeds on a
 *     `no-request` verdict, so the end-cap guard does not second-guess it.
 *  3. `authority-undetermined` — the documents could not answer. This arm
 *     carries NO position, by construction: the evaluator's undetermined arm
 *     has no `requiredAuthority` field (ADR A1-7: naming a reviewer for a
 *     scope nobody is authorized to sign routes a case that cannot be
 *     decided), and `AuthorityBindingError` refusals propagate for the same
 *     reason. The caller denies and writes NOTHING durable. An unavailable
 *     document is never folded into "no rule", and "no rule" is never folded
 *     into "no authority" — the two directions A5-16 and §21.4 keep apart.
 *
 * THE LADDER IS NOT RE-DECIDED HERE. `evaluateAuthorityCeiling` is the one
 * implementation of the walk (`governance/runtime-authority.ts`); the one
 * ordering is `AUTHORITY_RANK` behind it. This module adds no rung, no
 * ranking, and no document reading: it supplies the OPERATION-plane question
 * (which operation class, which canonical resource, effect `allow`) and
 * translates the answer into the vocabulary the pre-execute pipeline speaks.
 * In particular it never reads `teamHardEnvelope` — the plane owns the
 * three-way document slot, and this module receives it (a reader in every
 * judge is the shape A5-12 refuses).
 *
 * WHY `desiredEffect` IS FIXED TO `allow`. An operation ask asks "may this
 * run", and `allow` is the only effect that means it. Passing the permission
 * plane's own `ask` would ask a different question ("may a reviewer be
 * asked?") and answer it with a reviewer — the effect asked about is the
 * EFFECT, not the lane that raised the question.
 *
 * Purity: same facts, same answer. No I/O, no clock, no service, no lock.
 * The one exception is the tail's {@link createOperationApprovalFactsReader},
 * which is not a judge but the ADAPTER the production root uses to hand this
 * lane its facts: it calls exactly one injected port, maps, and adds no
 * authority reasoning of its own. Everything above it stays pure.
 *
 * @module @dsh-agent-team/runtime/operation-permission/approval-routing
 */
import type { AuthorityEnvelopeDocuments, AuthorityEvaluationEvidence, SubtreeContains } from '../governance/index.js';
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js';
import type { ControlRequestKind } from '../control/index.js';
/**
 * The authority facts of ONE operation, as the permission plane supplies them
 * (the plane is the only v3 switch, ADR A5-12, and the only canonicalizer of
 * the declared documents).
 *
 * `undefined` at the CALL SITE (not a field here) is the not-v3 answer and
 * belongs to the caller-visible routing arm `legacy`, because a module that
 * models "the plane had nothing to say" as a field of the facts invites a
 * later reader to fill it in.
 */
export interface OperationApprovalFacts {
    /** Whose authority the operation would raise — the instance the operation
     *  runs ON, not whoever is holding the keyboard (spec §7.4). */
    readonly beneficiaryAuthority: ProposalAuthorityPosition;
    /** The three-way document slot pair, produced by the plane. Never two
     *  `| undefined` fields: `unavailable` must not be foldable into `absent`
     *  (correction X7-R5, ADR A5-16). */
    readonly documents: AuthorityEnvelopeDocuments;
    /** The filesystem truth a subtree-shaped rule needs. ABSENT means those
     *  questions are unanswerable, which the algebra reports as `undetermined`
     *  (ADR A1-6) — the honest reading, not a guess. */
    readonly subtreeContains?: SubtreeContains;
}
/** One operation's routing question. */
export interface OperationApprovalRoutingInput {
    /** The operation class as the documents name it (the tool name). */
    readonly operationClass: string;
    /** The CANONICAL resource key of this concrete invocation (never a display
     *  path: display changes must not change authority). */
    readonly resourceKey: string;
    /** Who is acting. Spec §7.3's `direct` arm is unreachable without it. */
    readonly initiatorAuthority: ProposalAuthorityPosition;
    /** The plane's answer for this instance, or `undefined` when the Team is
     *  not on the v3 authority documents. */
    readonly facts: OperationApprovalFacts | undefined;
}
/**
 * Why an operation's required authority could not be determined. A closed
 * set of DIAGNOSES: none of them is an authority, none of them is a
 * permission denial, and the caller renders each as the same fail-closed
 * outcome with a different reason.
 *
 * `AUTHORITY_UNAVAILABLE` is named with the frozen durable vocabulary
 * (`CONTROL_CASE_TERMINAL_OUTCOMES`) rather than a new string: the case that
 * terminates because no rung can sign and the ask that cannot name a signer
 * are the same fact about the ladder, and a second spelling of it is a second
 * vocabulary. No new code is minted here.
 */
export declare const OPERATION_APPROVAL_REFUSAL_REASONS: {
    /** The evaluator answered `undetermined` (an unanswerable containment
     *  question, or a narrowing that cannot be decided for this scope). */
    readonly CEILING_UNDETERMINED: "ceiling-undetermined";
    /** A document this ladder rung is BOUND BY could not be read
     *  (`AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE`). A missing document is not an
     *  empty one. */
    readonly DOCUMENT_UNAVAILABLE: "authority-document-unavailable";
    /** A defect in the evaluation input or the documents
     *  (`AUTHORITY_BINDING_DEFECT`) — including the Human Admin ask, which has
     *  no upper rung and therefore no reviewer to name. */
    readonly DOCUMENT_BINDING_DEFECT: "authority-binding-defect";
    /** The plane's facts arrived in a shape this module cannot ask about at
     *  all (a fault in the wiring, never a governance answer). */
    readonly FACTS_MALFORMED: "authority-facts-malformed";
};
/** One refusal reason. */
export type OperationApprovalRefusalReason = (typeof OPERATION_APPROVAL_REFUSAL_REASONS)[keyof typeof OPERATION_APPROVAL_REFUSAL_REASONS];
/** Every refusal reason, for membership pins. */
export declare const OPERATION_APPROVAL_REFUSAL_REASON_VALUES: readonly string[];
/** The legacy request kind that CARRIES a required rung (spec §10.1.4). */
export type OperationApprovalCarrier = ControlRequestKind;
/** The legacy request kind of one required rung, or `undefined`. */
export declare function operationApprovalCarrier(requiredAuthority: ProposalAuthorityPosition): OperationApprovalCarrier | undefined;
/** The routing decision, one arm per spec §7.3 plus the pre-v3 passthrough. */
export type OperationApprovalRouting = {
    /** The Team is not on the v3 authority documents: the frozen
     *  `isLeader ? user-approval : leader-approval` routing stands,
     *  byte-identically, until PR7 retires it. */
    readonly kind: 'legacy';
    readonly reason: 'not-authority-v3';
} | {
    readonly kind: 'direct';
    readonly requiredAuthority: ProposalAuthorityPosition;
    /** Echoed from the facts so the caller never re-reads the plane to
     *  build a durable identity (a re-read is a second answer). */
    readonly beneficiaryAuthority: ProposalAuthorityPosition;
    readonly evidence: AuthorityEvaluationEvidence;
} | {
    readonly kind: 'approval-required';
    readonly requiredAuthority: ProposalAuthorityPosition;
    /** The case identity's beneficiary, echoed from the SAME facts this
     *  decision was computed from (spec §11.1: the identity is frozen at
     *  creation, so it must come from the evaluation, not a later read). */
    readonly beneficiaryAuthority: ProposalAuthorityPosition;
    /** The durable row's legacy carrier (compatibility, not authority). */
    readonly carrierKind: OperationApprovalCarrier;
    readonly evidence: AuthorityEvaluationEvidence;
} | {
    readonly kind: 'authority-undetermined';
    readonly reason: OperationApprovalRefusalReason;
    /** The fail-closed diagnostic (free text, never authority data). */
    readonly detail: string;
};
/**
 * Route one concrete operation ask to the minimum authority that may sign it
 * (spec §7.2-§7.4, §10.1, acceptance §21.4).
 *
 * @param input - the operation, the acting rung, and the plane's authority
 *   facts for the beneficiary (`undefined` = not v3).
 * @returns the routing arm; only `approval-required` names a durable carrier,
 *   and no arm ever names an authority the documents did not produce.
 */
export declare function routeOperationApproval(input: OperationApprovalRoutingInput): OperationApprovalRouting;
/** What a fresh re-derivation says about an approval already on the record. */
export type OperationApprovalRecheck = 
/** The recorded review authority still covers what the documents require. */
{
    readonly kind: 'still-covered';
}
/**
 * The documents now require a HIGHER rung than the one that signed. The
 * allow is not wrong — it was true when it was written — it is about an
 * invocation that no longer exists to be authorized. The caller must not
 * execute, and must not consume the one-shot: a stale invocation that
 * burns an allow converts a drift into a second denial the human never
 * voted on.
 */
 | {
    readonly kind: 'stale';
    readonly requiredNow: ProposalAuthorityPosition;
}
/**
 * The fresh documents cannot answer, so the coverage question cannot be
 * confirmed. Fail closed: "could not confirm" is not "confirmed".
 */
 | {
    readonly kind: 'undetermined';
    readonly reason: OperationApprovalRefusalReason;
    readonly detail: string;
};
/**
 * Re-derive the required authority at the moment of execution and compare it
 * with the rung that actually signed (spec §12.1's "fresh authority recheck",
 * ADR A1-14: an approval is not a standing grant).
 *
 * The comparison is `isHigherAuthority` — THE ladder ordering
 * (`AUTHORITY_RANK` behind it), never a locally re-spelled rank list. A
 * second ordering is the defect X7-R3 names, and in this particular place it
 * would decide who may execute.
 *
 * A pre-v3 fresh answer is `still-covered` by definition: there is no
 * document-backed requirement to drift against, and inventing one would
 * change v1/v2 behavior, which PR7 owns.
 *
 * @param input.reviewAuthority - the rung recorded on the durable leg.
 * @param input.fresh - the routing recomputed from freshly read facts.
 * @returns whether the recorded approval still covers this invocation.
 */
export declare function recheckOperationApproval(input: {
    readonly reviewAuthority: ProposalAuthorityPosition;
    readonly fresh: OperationApprovalRouting;
}): OperationApprovalRecheck;
/**
 * The ONE port {@link createOperationApprovalFactsReader} needs: the
 * authority-ceiling context reader the production host already builds for the
 * mutation lane (`createAuthorityCeilingReader` in `src/plugin/permission-plane.ts`,
 * injected into the root as `permissionAuthorityCeiling`). Its declared return
 * is `PermissionAuthorityCeilingContext`, whose `beneficiaryAuthority` is
 * `RuntimeAuthority` — which IS `ProposalAuthorityPosition` (an alias, not a
 * re-spelling: `governance/runtime-authority.ts:81`) — and whose `documents`
 * is the same `AuthorityEnvelopeDocuments` this lane consumes. The structural
 * subset below is declared HERE rather than imported so this lane keeps zero
 * new import surface: the extra `initiatorAuthority` field of the real context
 * is simply not consumed (the adapter passes the initiator the pre-execute
 * pipeline already verified, not one re-derived from a keyboard role).
 */
export type OperationApprovalCeilingPort = (teamSessionId: string, memberInstanceId: string, actor: 'leader' | 'human') => Promise<{
    readonly beneficiaryAuthority: ProposalAuthorityPosition;
    readonly documents: AuthorityEnvelopeDocuments;
} | undefined>;
/** The reader the pre-execute adapter's `operationApprovalRouting` port calls. */
export type OperationApprovalFactsReader = (input: {
    readonly teamSessionId: string;
    readonly memberInstanceId: string;
    /** Whether the install this operation belongs to IS the Team's Leader. */
    readonly actingAsLeader: boolean;
}) => Promise<OperationApprovalFacts | undefined>;
/**
 * Adapt the existing authority-ceiling context reader into the OPERATION-plane
 * facts the router consumes (Task 4's "both authority envelopes" input), so the
 * routing has exactly one source for the documents — the plane's reader, the
 * same one the mutation lane reads. A second reader would be the A5-12 shape
 * this repo refuses (a reader in every judge), and it would be a second answer.
 *
 * TWO RULES, both pinned in `test/a4p4-operation-approval-authority.test.ts`:
 *
 * 1. **A pre-v3 read is `undefined`, and `undefined` is the legacy arm.** The
 *    port answers `undefined` when the bound Blueprint is not schema v3 (or its
 *    binding is unknown), and that maps to
 *    {@link OperationApprovalRouting}'s `legacy` arm downstream — the frozen
 *    v1/v2 `isLeader ? 'user-approval' : 'leader-approval'` routing, which PR7
 *    owns. This adapter never converts an unknown binding into a v3 answer.
 * 2. **A Leader install is NEVER routed off these facts.** The only production
 *    reader available here fixes the BENEFICIARY to `member` (it is the
 *    mutation lane's reader: `permission-plane.ts:821`). Evaluating the
 *    Leader's own ask against a member-beneficiary document set would start the
 *    ladder walk at `rungAbove('member')` and could answer that the Leader
 *    needs only Leader sign-off — i.e. it would UNDER-ask, the one direction
 *    this lane is not allowed to move in. So the Leader install gets
 *    `undefined` = the frozen routing, and the member install — whose
 *    beneficiary genuinely IS the member instance — gets the real documents.
 *
 * The `actor` argument selects only the context's `initiatorAuthority`, which
 * this adapter discards by design (see {@link OperationApprovalCeilingPort});
 * it is passed because the port demands it, never read as authority here.
 *
 * @param deps.ceiling - the injected ceiling-context reader.
 * @returns the facts reader for the pre-execute adapter's routing port.
 */
export declare function createOperationApprovalFactsReader(deps: {
    readonly ceiling: OperationApprovalCeilingPort;
}): OperationApprovalFactsReader;
//# sourceMappingURL=approval-routing.d.ts.map