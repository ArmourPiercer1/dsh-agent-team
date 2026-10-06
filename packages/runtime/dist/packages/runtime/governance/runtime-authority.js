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
import { AUTHORITY_EFFECT_PRECEDENCE, } from '../../domain/authority-envelope/src/index.js';
import { AUTHORITY_RANK, boundDocumentNames, grantCeiling, mayReview, AuthorityBindingError, AUTHORITY_CEILING_ERROR_CODES, } from './authority-ceiling.js';
/** The rung immediately above one on the ladder, derived from `AUTHORITY_RANK`
 *  rather than from a second literal list — a `successor` table would be a second
 *  ordering, and the whole point of X7-R3 is that there is exactly one. */
function rungAbove(position) {
    const target = AUTHORITY_RANK[position] + 1;
    for (const [candidate, rank] of Object.entries(AUTHORITY_RANK)) {
        if (rank === target)
            return candidate;
    }
    return undefined;
}
/** Does a decided ceiling reach the desired effect? `no-authority` does NOT —
 *  there is no effect it authorizes — and `undetermined` is never asked this
 *  question, because the caller short-circuits on it first. */
function ceilingReaches(ceiling, desired) {
    if (ceiling.status !== 'decided')
        return false;
    return AUTHORITY_EFFECT_PRECEDENCE[ceiling.effect] >= AUTHORITY_EFFECT_PRECEDENCE[desired];
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
export function evaluateAuthorityCeiling(input) {
    const { beneficiaryAuthority, initiatorAuthority, operationClass, matcher, desiredEffect, documents } = input;
    // Boundary re-check. The three fields below are required by the type, so for a
    // typed caller this is dead code; every one of them is live for a value that
    // arrived from a proposal ROW or a cast, which is where the compiler stops.
    // A missing `desiredEffect` is the dangerous one: `undefined` compares below
    // every effect, so `ceilingReaches` would answer `true` for the very first rung
    // and hand back the ladder default as an authorization.
    for (const [field, value] of [
        ['beneficiaryAuthority', beneficiaryAuthority],
        ['initiatorAuthority', initiatorAuthority],
        ['desiredEffect', desiredEffect],
        ['operationClass', operationClass],
        ['matcher', matcher],
        ['documents', documents],
    ]) {
        if (value === undefined || value === null) {
            throw new AuthorityBindingError(AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT, 'document-slot-missing', `evaluateAuthorityCeiling: ${field} is required and was ${String(value)}; no field of an authority evaluation has a default, because a defaulted effect or an omitted document silently widens the answer`);
        }
    }
    const scope = { operationClass, matcher };
    const first = rungAbove(beneficiaryAuthority);
    if (first === undefined) {
        // A Human Admin ask. There is no rung above the top of the ladder, and a
        // position may not approve its own elevation, so NO reviewer exists — which
        // is a defective INPUT, not an outcome: the three arms of §7.3 all presuppose
        // a candidate reviewer. Refusing keeps the vocabulary honest, and it is
        // unreachable in production because Alpha.4 ships no Human Admin constructor
        // (ADR A1-3); a later Alpha that adds one must add a row here first.
        throw new AuthorityBindingError(AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT, 'ask-has-no-upper-rung', 'a Human Admin ask has no rung above it, so no reviewer position exists to evaluate');
    }
    const ceilingByRole = {};
    const boundDocumentsByRole = {};
    const consideredRoles = [];
    const roseBecauseInsufficient = [];
    let requiredAuthority;
    for (const rung of ladderFrom(first)) {
        consideredRoles.push(rung);
        boundDocumentsByRole[rung] = boundDocumentNames(rung);
        // Throws `AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE` for a document this rung IS
        // bound by. That refusal PROPAGATES: it is the terminal
        // `authority-unavailable` outcome, and this evaluator has no arm for it.
        const ceiling = grantCeiling(rung, documents, scope, input.subtreeContains);
        ceilingByRole[rung] = ceiling;
        if (ceiling.status === 'undetermined') {
            return {
                outcome: 'undetermined',
                ceilingByRole,
                ceilingUndetermined: true,
                evidence: { consideredRoles, boundDocumentsByRole, roseBecauseInsufficient },
            };
        }
        if (ceilingReaches(ceiling, desiredEffect)) {
            requiredAuthority = rung;
            break;
        }
        roseBecauseInsufficient.push(rung);
    }
    // The loop always terminates with a position: the top rung binds NO document,
    // so its ceiling is `CEILING_IDENTITY` (`decided('allow')`), which reaches every
    // effect. That is why no "nothing reached it" arm exists here, and why the
    // A1-12 termination question never arises on a decided ladder.
    const required = requiredAuthority;
    if (required === undefined) {
        throw new AuthorityBindingError(AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT, 'no-rung-reached-effect', 'no rung on the closed ladder reached the desired effect, which the identity ceiling at the top makes impossible — the ladder was edited under the evaluator');
    }
    return {
        outcome: mayReview(initiatorAuthority, beneficiaryAuthority, required) ? 'direct' : 'approval-required',
        requiredAuthority: required,
        ceilingByRole,
        ceilingUndetermined: false,
        evidence: { consideredRoles, boundDocumentsByRole, roseBecauseInsufficient },
    };
}
/** The rungs from one (inclusive) to the top, in ladder order. Derived from the
 *  rank map, so the walk cannot outlive an added rung. */
function ladderFrom(start) {
    const from = AUTHORITY_RANK[start];
    return Object.entries(AUTHORITY_RANK)
        .filter(([, rank]) => rank >= from)
        .sort((a, b) => a[1] - b[1])
        .map(([position]) => position);
}
//# sourceMappingURL=runtime-authority.js.map