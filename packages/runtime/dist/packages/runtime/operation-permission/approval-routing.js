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
import { AUTHORITY_CEILING_ERROR_CODES, evaluateAuthorityCeiling, isHigherAuthority, } from '../governance/index.js';
import { CONTROL_REQUEST_KINDS } from '../control/index.js';
import { isShellOperationClass } from '../../domain/authority-envelope/src/index.js';
// ---------------------------------------------------------------------------
// The refusal vocabulary
// ---------------------------------------------------------------------------
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
export const OPERATION_APPROVAL_REFUSAL_REASONS = {
    /** The evaluator answered `undetermined` (an unanswerable containment
     *  question, or a narrowing that cannot be decided for this scope). */
    CEILING_UNDETERMINED: 'ceiling-undetermined',
    /**
     * A SHELL-class scope whose command fingerprint was not supplied (RULING 4).
     * The documents can only narrow a shell invocation by `fingerprint` exactly, so
     * an ask that cannot name the command cannot see its own narrowing; answering
     * from the tool key alone would report a ceiling no author declared. A wiring
     * fault on this plane is reported as undetermined - never as a denial, and never
     * as a guessed rung - which is the convention this module already keeps for
     * malformed facts.
     */
    SHELL_POINT_MISSING: 'shell-point-missing',
    /** A document this ladder rung is BOUND BY could not be read
     *  (`AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE`). A missing document is not an
     *  empty one. */
    DOCUMENT_UNAVAILABLE: 'authority-document-unavailable',
    /** A defect in the evaluation input or the documents
     *  (`AUTHORITY_BINDING_DEFECT`) — including the Human Admin ask, which has
     *  no upper rung and therefore no reviewer to name. */
    DOCUMENT_BINDING_DEFECT: 'authority-binding-defect',
    /** The plane's facts arrived in a shape this module cannot ask about at
     *  all (a fault in the wiring, never a governance answer). */
    FACTS_MALFORMED: 'authority-facts-malformed',
};
/** Every refusal reason, for membership pins. */
export const OPERATION_APPROVAL_REFUSAL_REASON_VALUES = Object.values(OPERATION_APPROVAL_REFUSAL_REASONS);
/**
 * The carrier table. Two legacy kinds exist because the durable vocabulary
 * predates the ladder; three rungs above the beneficiary do not fit into two
 * names, which is exactly why the carrier is not the authority. Human Admin
 * rides `user-approval` because that is the human-carrier of this vocabulary
 * — and in Alpha.4 no Human Admin resolver exists, so a case that lands there
 * is closed by the control plane as `authority-unavailable` rather than left
 * pending (ADR A1-12). A Member required-rung has no carrier because it
 * cannot occur: the walk starts at the rung ABOVE the beneficiary, so the
 * beneficiary's own rung is never the answer.
 */
const CARRIER_BY_REQUIRED_AUTHORITY = {
    leader: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    'human-user': CONTROL_REQUEST_KINDS.USER_APPROVAL,
    'human-admin': CONTROL_REQUEST_KINDS.USER_APPROVAL,
};
/** The legacy request kind of one required rung, or `undefined`. */
export function operationApprovalCarrier(requiredAuthority) {
    return CARRIER_BY_REQUIRED_AUTHORITY[requiredAuthority];
}
// ---------------------------------------------------------------------------
// The routing
// ---------------------------------------------------------------------------
/** Read the `code`/`problem` of a thrown value without importing the error
 *  class (the ceiling module is not an importable dependency of this lane —
 *  the barrel carries the vocabulary, not the class). */
function codeOf(error) {
    if (typeof error !== 'object' || error === null)
        return undefined;
    const code = error.code;
    return typeof code === 'string' ? code : undefined;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * The CANDIDATE POINTS that name one approval scope (A4-PR7 RULING 4).
 *
 * ONE FUNCTION, BOTH SITES. The ask and the consumption recheck each need the set
 * of shapes their scope question arrives in, and they must agree about it: the
 * consumption question is "does the rung that signed still cover what the human
 * was shown?", and if each site derived its own set the recheck could silently ask
 * a question the ask never asked - the false-pass failure wearing the recheck's
 * clothes. So the set is derived here, from the point plus the command fingerprint,
 * and `a4p7-v3-cutover-acceptance.test.ts` ASSERTS the two sites agree instead of
 * trusting that both callers remembered.
 *
 * WHY A SET AT ALL: the documents pair a shell-class rule with a `fingerprint`
 * matcher EXACTLY (`blueprint/src/validate.ts:699`: no subtree, no any, no path)
 * while this plane names an operation by its TOOL-level exact key
 * (`canonical-operation.ts:14`). Asking only the tool key makes every shell
 * narrowing answer `{covers:false, undeterminable:false}` - DECISIVE, not
 * absorbing - so the narrowing contributes nothing to the meet and the rung shown
 * to a human can only come out LOWER than the author declared. Asking both shapes
 * and meeting the answers closes that without changing what a document means.
 *
 * The file-class answer is the point alone: a file-class rule is exact or subtree,
 * and both already answer the exact question - so a set of one is the whole law
 * there, and no existing file-class routing moves.
 *
 * @param point - the scope's primary point (at the ask, the tool-level exact key;
 *   at consumption, the persisted `authorityScope` verbatim, kind included).
 * @param commandFingerprint - the canonical operation identity: required for the
 *   shell class, meaningless elsewhere.
 * @returns the candidate points, plus a refusal reason when a shell-class scope
 *   cannot name its command (a wiring fault, never a silent narrowing-free pass).
 *   The contract on that combination is strict: when `refused` is set, the
 *   accompanying `points` list is a DIAGNOSTIC of the shape that could not be
 *   completed, NOT a candidate set — both call sites check `refused` FIRST and
 *   return, because evaluating the lone tool-level point of a shell-class scope
 *   answers with a decisive non-coverage no author declared. Pinned by
 *   `test/a4p7-v3-cutover-acceptance.test.ts` GROUP F.
 */
export function operationApprovalCandidatePoints(input) {
    const { point, commandFingerprint } = input;
    if (!isShellOperationClass(point.operationClass)) {
        return { points: [point.matcher] };
    }
    if (point.matcher.kind === 'fingerprint') {
        // The point already names the command. Adding the tool key would only widen
        // the question with a shape no shell-class rule can answer, so it is not a
        // candidate: more candidates is not automatically more conservative.
        return { points: [point.matcher] };
    }
    if (commandFingerprint === undefined || commandFingerprint.length === 0) {
        return {
            points: [point.matcher],
            refused: OPERATION_APPROVAL_REFUSAL_REASONS.SHELL_POINT_MISSING,
        };
    }
    return { points: [point.matcher, { kind: 'fingerprint', resource: commandFingerprint }] };
}
/**
 * Route one concrete operation ask to the minimum authority that may sign it
 * (spec §7.2-§7.4, §10.1, acceptance §21.4).
 *
 * @param input - the operation, the acting rung, and the plane's authority
 *   facts for the beneficiary (`undefined` = not v3).
 * @returns the routing arm; only `approval-required` names a durable carrier,
 *   and no arm ever names an authority the documents did not produce.
 */
export function routeOperationApproval(input) {
    const { facts } = input;
    if (facts === undefined) {
        return { kind: 'legacy', reason: 'not-authority-v3' };
    }
    const { beneficiaryAuthority, documents } = facts;
    if (typeof beneficiaryAuthority !== 'string' ||
        documents === null ||
        typeof documents !== 'object') {
        // A malformed fact object is a wiring fault. It is reported as
        // undetermined — never as a permission denial, and never as a guessed
        // rung — because the alternative is to route a case on garbage input.
        return {
            kind: 'authority-undetermined',
            reason: OPERATION_APPROVAL_REFUSAL_REASONS.FACTS_MALFORMED,
            detail: 'the authority facts for this instance are malformed (no beneficiary position or no document slot)',
        };
    }
    // RULING 4: the scope question is asked once per candidate SHAPE and the
    // answers are MET (highest rung governs, `undetermined` absorbs). See
    // `operationApprovalCandidatePoints` for why the shapes differ and why a
    // decisive cross-shape false made the single-shape question permissive.
    const candidates = operationApprovalCandidatePoints({
        point: { operationClass: input.operationClass, matcher: { kind: 'exact', resource: input.resourceKey } },
        ...(input.commandFingerprint !== undefined ? { commandFingerprint: input.commandFingerprint } : {}),
    });
    if (candidates.refused !== undefined) {
        return {
            kind: 'authority-undetermined',
            reason: candidates.refused,
            detail: `the ${input.operationClass} scope on ${input.resourceKey} is shell-class, so its narrowing can only be ` +
                'declared as a command fingerprint; no canonical operation identity was supplied, and answering from ' +
                'the tool key alone would report a ceiling no author declared',
        };
    }
    // Every refusal PAST the candidate gate names both candidate shapes: a human
    // reading a refusal has to be able to tell WHICH shape the ceiling could not
    // decide, and the consumption point's question is about what this human was
    // shown -- so `recheckPersistedOperationAuthority` names them in its refusals
    // too, in the same words. The gate refusal above is the deliberate exception:
    // it cannot name a shape it was never allowed to ask about.
    const candidateDetail = candidates.points.length > 1
        ? ` (candidates: ${candidates.points.map((m) => `${m.kind} ${m.resource}`).join(', ')})`
        : '';
    const evaluations = [];
    for (const matcher of candidates.points) {
        try {
            evaluations.push(evaluateAuthorityCeiling({
                beneficiaryAuthority,
                initiatorAuthority: input.initiatorAuthority,
                operationClass: input.operationClass,
                // One candidate SHAPE of the same concrete invocation: the tool-level
                // exact key is this plane's canonical name for an operation
                // (`canonical-operation.ts:14`), the fingerprint is the shape the
                // documents use for a shell-class narrowing (`validate.ts:699`).
                matcher,
                desiredEffect: 'allow',
                documents,
                ...(facts.subtreeContains !== undefined ? { subtreeContains: facts.subtreeContains } : {}),
            }));
        }
        catch (error) {
            const code = codeOf(error);
            const reason = code === AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE
                ? OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_UNAVAILABLE
                : OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT;
            return {
                kind: 'authority-undetermined',
                reason,
                detail: `${messageOf(error)}${candidateDetail}`,
            };
        }
    }
    // ABSORPTION LAW: a candidate that cannot answer outranks one that can. If one
    // shape's containment question is unanswerable, the SCOPE's ceiling is
    // unanswerable; returning the shape that did answer would be conservative by
    // name only - the same failure as returning a rung nobody declared.
    const undecided = evaluations.find((e) => e.outcome === 'undetermined');
    if (undecided !== undefined) {
        return {
            kind: 'authority-undetermined',
            reason: OPERATION_APPROVAL_REFUSAL_REASONS.CEILING_UNDETERMINED,
            detail: `the authority ceiling for ${input.operationClass} on ${input.resourceKey} could not be ` +
                `decided (rungs consulted: ${undecided.evidence.consideredRoles.join(', ') || 'none'})` +
                candidateDetail,
        };
    }
    // MEET over the candidates: the governing answer is the HIGHEST rung any
    // candidate requires. Order-independent, and never below what the tool key
    // alone would have said - so the set closes the shell gap without ever
    // widening a scope (file-class scopes have one candidate and move not at all).
    const firstEvaluation = evaluations[0];
    if (firstEvaluation === undefined) {
        // Unreachable by construction: `candidates.points` always carries the primary
        // point, and each candidate either pushed an evaluation or returned above.
        // Stated as a refusal rather than a cast, the way this module treats every
        // other field the compiler cannot see past.
        return {
            kind: 'authority-undetermined',
            reason: OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT,
            detail: `no candidate evaluation was produced for this scope${candidateDetail}`,
        };
    }
    let evaluation = firstEvaluation;
    for (const other of evaluations.slice(1)) {
        if (other.requiredAuthority === undefined || evaluation.requiredAuthority === undefined) {
            continue;
        }
        if (isHigherAuthority(other.requiredAuthority, evaluation.requiredAuthority)) {
            evaluation = other;
        }
    }
    const requiredAuthority = evaluation.requiredAuthority;
    if (requiredAuthority === undefined) {
        // Unreachable by the evaluator's own type (the arm carries no position
        // only when undetermined, which returned above). Stated as a refusal
        // rather than a cast, because the alternative is minting a routing
        // instruction out of a missing field.
        return {
            kind: 'authority-undetermined',
            reason: OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT,
            detail: `the evaluator answered with a decided outcome but no required authority${candidateDetail}`,
        };
    }
    if (evaluation.outcome === 'direct') {
        return {
            kind: 'direct',
            requiredAuthority,
            beneficiaryAuthority,
            evidence: evaluation.evidence,
        };
    }
    const carrierKind = operationApprovalCarrier(requiredAuthority);
    if (carrierKind === undefined) {
        // The required rung has no legacy carrier (today: a rung at or below the
        // beneficiary, which the walk cannot produce). Refusing beats inventing
        // a carrier — an invented one would be authority minted by the adapter.
        return {
            kind: 'authority-undetermined',
            reason: OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT,
            detail: `the required authority '${requiredAuthority}' has no request-kind carrier`,
        };
    }
    return {
        kind: 'approval-required',
        requiredAuthority,
        beneficiaryAuthority,
        carrierKind,
        evidence: evaluation.evidence,
    };
}
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
export function recheckOperationApproval(input) {
    const { fresh } = input;
    if (fresh.kind === 'legacy' || fresh.kind === 'direct') {
        return { kind: 'still-covered' };
    }
    if (fresh.kind === 'authority-undetermined') {
        return { kind: 'undetermined', reason: fresh.reason, detail: fresh.detail };
    }
    if (isHigherAuthority(fresh.requiredAuthority, input.reviewAuthority)) {
        return { kind: 'stale', requiredNow: fresh.requiredAuthority };
    }
    return { kind: 'still-covered' };
}
// ---------------------------------------------------------------------------
// The consumption-point recheck (A4-PR7 Task 7.0, ADR A1-14)
// ---------------------------------------------------------------------------
/**
 * Re-run the ceiling for a PERSISTED authority point, at the moment the
 * one-shot allow is about to be spent.
 *
 * WHY THIS IS A SEPARATE FUNCTION AND NOT A CALL TO
 * {@link recheckOperationApproval}. The PR4 recheck takes the FRESH ROUTING —
 * it re-derives the rung from the operation the caller is holding right now.
 * That is the right question at the ask, and the wrong one at the consumption
 * point: the consumption point's question is about the scope the human ACTUALLY
 * approved, which is the durable row's, not the live call's. Reconstructing a
 * routing verdict here would need the caller-role routing the v3 lane exists to
 * retire, and — decisively — the routing builds its scope question as
 * `{kind:'exact', resource}` (its own comment says an operation is one concrete
 * target). A row whose point is a `fingerprint` matcher would be evaluated
 * against a question it was never asked, and a mismatch of matcher KIND reads
 * as "no rule covers this", which on this plane means "no narrowing", which
 * means an authority RISE would be reported as still-covered. This function
 * asks the persisted question, with the persisted kind.
 *
 * The `initiatorAuthority` the walk demands is filled with `reviewAuthority`,
 * and the fill is not a convenience: the question at this point is exactly
 * "can the rung that signed still sign this scope?", and the evaluator's
 * `direct` arm IS that predicate (`mayReview(initiator, beneficiary,
 * required)`). So `direct` and `approval-required(<= reviewAuthority)` both
 * mean covered, and only a strictly higher required rung means otherwise.
 *
 * `facts === undefined` is NOT a pass. At the ask it means "this Team is not on
 * the v3 documents, use the frozen routing"; at a consumption point there is no
 * frozen routing to fall back to — the row was minted by the v3 lane, so a
 * fresh read that cannot produce documents cannot CONFIRM the rung, and
 * "could not confirm" is not "confirmed" (`undetermined`, fail closed).
 *
 * @param input.reviewAuthority - the rung recorded on the durable leg.
 * @param input.beneficiaryAuthority - the durable identity's beneficiary.
 * @param input.authorityScope - the point persisted with the case.
 * @param input.facts - the plane's facts, read NOW (not the ask's).
 * @returns whether the recorded approval still covers the persisted point.
 */
export function recheckPersistedOperationAuthority(input) {
    const undetermined = (reason, detail) => ({ kind: 'undetermined', reason, detail });
    const { facts } = input;
    if (facts === undefined) {
        return undetermined(OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_UNAVAILABLE, 'the authority-ceiling context for this instance could not be read at the consumption point');
    }
    if (typeof facts.beneficiaryAuthority !== 'string' ||
        facts.documents === null ||
        typeof facts.documents !== 'object') {
        return undetermined(OPERATION_APPROVAL_REFUSAL_REASONS.FACTS_MALFORMED, 'the fresh authority facts are malformed (no beneficiary position or no document slot)');
    }
    if (facts.beneficiaryAuthority !== input.beneficiaryAuthority) {
        // The row says the operation raises one rung, the plane says another. Which
        // one is right is an authority question, and this module does not answer
        // authority questions by picking a side.
        return undetermined(OPERATION_APPROVAL_REFUSAL_REASONS.FACTS_MALFORMED, `the durable identity's beneficiary '${input.beneficiaryAuthority}' disagrees with the fresh facts' '${facts.beneficiaryAuthority}'`);
    }
    // RULING 4 at the consumption point: the SAME derivation as the ask, over the
    // persisted point plus the row's command fingerprint. The persisted point stays
    // first and keeps its kind - it is the shape the human was shown - and the
    // fingerprint joins only where the class admits it.
    const candidates = operationApprovalCandidatePoints({
        point: input.authorityScope,
        ...(input.commandFingerprint !== undefined ? { commandFingerprint: input.commandFingerprint } : {}),
    });
    // A refusal is TERMINAL here, exactly as it is at the ASK. The helper answers a
    // shell-class scope that cannot name its command with `refused` AND its primary
    // point, and that primary point is a SHAPE NO SHELL RULE CAN COVER
    // (`authority-envelope.ts:218-222`: cross-shape coverage is a decisive
    // `{covers:false}`). Evaluating it would therefore not be "the narrower
    // question" — it would be an answer the documents never gave, and it is exactly
    // how a rise on a shell command becomes a `still-covered`. So the point that
    // accompanies a refusal is a diagnostic of what could not be named, never a
    // candidate to evaluate; no call site consults `points` while `refused` is set.
    if (candidates.refused !== undefined) {
        return undetermined(candidates.refused, `the persisted ${input.authorityScope.operationClass} scope is shell-class and its row supplies no usable ` +
            'command fingerprint, so the coverage question the ask asked cannot be re-asked here; answering from the ' +
            'persisted tool-level point alone would report a ceiling no author declared');
    }
    // The same candidate naming the ASK puts in its refusals, for the same reason:
    // the consumption refusal is shown to a human as the reason their approval did
    // not spend, and "which shape could not be decided" is the question they can
    // actually act on.
    const candidateDetail = candidates.points.length > 1
        ? ` (candidates: ${candidates.points.map((m) => `${m.kind} ${m.resource}`).join(', ')})`
        : '';
    const evaluations = [];
    for (const matcher of candidates.points) {
        try {
            evaluations.push(evaluateAuthorityCeiling({
                beneficiaryAuthority: input.beneficiaryAuthority,
                initiatorAuthority: input.reviewAuthority,
                operationClass: input.authorityScope.operationClass,
                // The PERSISTED point, kind included, plus the shapes its class admits.
                // This is the whole reason the durable field carries a matcher kind
                // rather than a bare resource.
                matcher,
                desiredEffect: 'allow',
                documents: facts.documents,
                ...(facts.subtreeContains !== undefined ? { subtreeContains: facts.subtreeContains } : {}),
            }));
        }
        catch (error) {
            const code = codeOf(error);
            return undetermined(code === AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE
                ? OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_UNAVAILABLE
                : OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT, `${messageOf(error)}${candidateDetail}`);
        }
    }
    const undecided = evaluations.find((e) => e.outcome === 'undetermined');
    if (undecided !== undefined) {
        return undetermined(OPERATION_APPROVAL_REFUSAL_REASONS.CEILING_UNDETERMINED, `the ceiling for ${input.authorityScope.operationClass} on ${input.authorityScope.matcher.resource} ` +
            `could not be decided at the consumption point (rungs consulted: ` +
            `${undecided.evidence.consideredRoles.join(', ') || 'none'})${candidateDetail}`);
    }
    // The same meet as the ask: the HIGHEST rung any candidate requires is what
    // the recorded approval has to still cover, so a narrowing that only the
    // fingerprint shape can express is no longer invisible at consumption.
    const firstEvaluation = evaluations[0];
    if (firstEvaluation === undefined) {
        return undetermined(OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT, 'no candidate evaluation was produced for the persisted scope' + candidateDetail);
    }
    let evaluation = firstEvaluation;
    for (const other of evaluations.slice(1)) {
        if (other.requiredAuthority === undefined || evaluation.requiredAuthority === undefined) {
            continue;
        }
        if (isHigherAuthority(other.requiredAuthority, evaluation.requiredAuthority)) {
            evaluation = other;
        }
    }
    const requiredNow = evaluation.requiredAuthority;
    if (requiredNow === undefined) {
        return undetermined(OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT, 'the evaluator answered with a decided outcome but no required authority' + candidateDetail);
    }
    if (isHigherAuthority(requiredNow, input.reviewAuthority)) {
        return { kind: 'stale', requiredNow };
    }
    return { kind: 'still-covered' };
}
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
export function createOperationApprovalFactsReader(deps) {
    return async (input) => {
        if (input.actingAsLeader)
            return undefined;
        const context = await deps.ceiling(input.teamSessionId, input.memberInstanceId, 'leader');
        if (context === undefined)
            return undefined;
        return {
            beneficiaryAuthority: context.beneficiaryAuthority,
            documents: context.documents,
        };
    };
}
//# sourceMappingURL=approval-routing.js.map