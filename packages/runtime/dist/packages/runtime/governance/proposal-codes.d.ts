/**
 * A4-PR0 — the governance proposal lane's CLOSED error-code table (ADR A4-1).
 *
 * WHY A LANE-LOCAL TABLE. ADR A4-1 forbids this lane to reuse another lane's
 * error vocabulary: `PERMISSION_MUTATION_ERROR_CODES` belongs to the durable
 * permission-mutation kernel, and importing it here would (a) create the
 * second write path ADR §1 forbids by making the proposal substrate depend on
 * the kernel that owns it, and (b) let a proposal-code and a mutation-code
 * collide in a caller's `catch`, where the two mean different things — a
 * malformed PROPOSAL says nothing about whether a MUTATION would have been
 * accepted. The shape below is deliberately the kernel's shape (a frozen
 * lookup, one exported union type, one error class carrying `code` +
 * `details`, one `is…` guard) so the lane reads like its neighbours without
 * sharing their names.
 *
 * THE TABLE IS CLOSED AND SMALL ON PURPOSE. Two codes exist because two
 * things can be wrong at this boundary, and they are different KINDS of wrong
 * (ADR A4-7):
 *
 *  - `MALFORMED_PROPOSAL` — a CALLER asked for a write the durable record
 *    cannot honestly carry. That is a refusal: nothing was written, and the
 *    caller may fix its input and try again.
 *  - `CORRUPT_RECORD` — the DURABLE MEDIUM holds a row that claims to be a
 *    proposal and is not. That is not a refusal and not an absence: the row is
 *    still there, still listed, and the reader reports it beside the sound
 *    rows (a caller that hides it turns corruption into "no proposal").
 *
 * A third code for "the overlay moved" deliberately does NOT live here: the
 * proposal substrate never reads the overlay (ADR A4-3 — the revalidation that
 * turns a stale base pair into a `mutation-stale` outcome is PR5's, inside the
 * mutation path that owns the overlay), and a code for a check this module
 * cannot perform would be a dead name (ADR A3-14).
 *
 * @module @dsh-agent-team/runtime/governance/proposal-codes
 */
/** Every proposal-lane error code (the closed set; iteration is the audit). */
export declare const GOVERNANCE_PROPOSAL_ERROR_CODE_VALUES: readonly ["GOVERNANCE_PROPOSAL_MALFORMED", "GOVERNANCE_PROPOSAL_CORRUPT_RECORD"];
/**
 * The lane's error codes. The lookup is named like its siblings
 * (`PERMISSION_MUTATION_ERROR_CODES`, `CONTROL_ERROR_CODES`) so a caller
 * reaches for the right table by name; the VALUES above are the same strings,
 * exported separately because the tests and the closed-set guard enumerate
 * them.
 */
export declare const GOVERNANCE_PROPOSAL_ERROR_CODES: Readonly<{
    /** The proposed record cannot be carried durably (identity, vocabulary,
     *  the base pair, an unknown field). Zero write, zero allocation. */
    readonly MALFORMED_PROPOSAL: "GOVERNANCE_PROPOSAL_MALFORMED";
    /** A durable row of this fact type is not a proposal record: a typed
     *  OUTCOME (never a throw, never an omission) naming path/field/sequence. */
    readonly CORRUPT_RECORD: "GOVERNANCE_PROPOSAL_CORRUPT_RECORD";
}>;
/** One proposal-lane error code. */
export type GovernanceProposalErrorCode = (typeof GOVERNANCE_PROPOSAL_ERROR_CODES)[keyof typeof GOVERNANCE_PROPOSAL_ERROR_CODES];
/**
 * A proposal-lane failure. `details` always carries the triple that makes the
 * refusal actionable — `problem`, `field`, `path` — so a caller never has to
 * parse a message to learn which field of which path it got wrong.
 */
export declare class GovernanceProposalError extends Error {
    /** The closed error code. */
    readonly code: GovernanceProposalErrorCode;
    /** Lossless context (never a live caller object). */
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: GovernanceProposalErrorCode, message: string, details?: Record<string, unknown>);
}
/** Is `error` a {@link GovernanceProposalError}? */
export declare function isGovernanceProposalError(error: unknown): error is GovernanceProposalError;
//# sourceMappingURL=proposal-codes.d.ts.map