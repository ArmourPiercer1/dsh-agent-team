/**
 * P7-T2 — the closed error vocabulary of the runtime mutation module.
 *
 * Every failure of the module is a {@link MutationError} with a stable
 * `code` and plain-JSON `details` (consumer discipline: branch on `code`,
 * never on `message` text — the same rule as the frozen policy domain's
 * {@link PolicyResolutionError} and the established runtime pattern of the
 * P6/P7 error classes).
 *
 * Code reuse (frozen-domain single-sourcing — no parallel taxonomy):
 *
 * - `MEMBER_SELF_ESCALATION` / `LEADER_OUT_OF_ENVELOPE` /
 *   `IDENTITY_SCOPE_MISMATCH` — the EXACT code strings of the frozen
 *   policy domain (`POLICY_ERROR_CODES`, Architecture §42 invariants 36/37
 *   and the contracts-v1 identity-boundary code): the mutation intake
 *   rejects the same violations the frozen resolver would fail-closed on
 *   at resolution time, so both surfaces speak one vocabulary;
 * - `MALFORMED_MUTATION_INPUT` — this module's own structural code for
 *   malformed mutation requests (unknown capability, bad value shape,
 *   bad state target);
 * - `EXTERNAL_HARD_REJECTED` — Architecture §19.2/§19.5: an escalation
 *   beyond the external hard facts (host ceiling / capability absence) is
 *   rejected — no Team actor, human override included, may bypass them;
 * - `UNAUTHORIZED_TRANSITION` — Architecture §20.4 / invariant 40: a
 *   PolicyState transition by an ordinary member (only explicit human /
 *   authorized-leader transitions exist in vNext);
 * - `IMMUTABLE_CREATION_FIELD` — Architecture §21.2/§21.6: workspace is
 *   immutable after first RUNNING, contextPolicy is immutable after
 *   creation — a post-creation illegal change is a typed rejection;
 * - `UNKNOWN_INSTANCE` — the addressed MemberInstance was never registered
 *   with the module (no creation fields on record).
 *
 * @module @dsh-agent-team/runtime/mutation/errors
 */
import { POLICY_ERROR_CODES } from '../../domain/policy/src/index.js';
/** The closed mutation error-code vocabulary. */
export const MUTATION_ERROR_CODES = {
    /** Malformed mutation request (structural; see module doc). */
    MALFORMED_MUTATION_INPUT: 'MALFORMED_MUTATION_INPUT',
    /**
     * Invariant 37: a member-origin autonomy mutation that grants items
     * outside the Team autonomy envelope (reused frozen-domain code string).
     */
    MEMBER_SELF_ESCALATION: POLICY_ERROR_CODES.MEMBER_SELF_ESCALATION,
    /**
     * Invariant 36: a leader-origin autonomy mutation that crosses the Team
     * autonomy envelope (reused frozen-domain code string).
     */
    LEADER_OUT_OF_ENVELOPE: POLICY_ERROR_CODES.LEADER_OUT_OF_ENVELOPE,
    /**
     * Cross-scope member identity (reused contracts-v1 / policy-domain code
     * string): the acting member does not belong to the addressed
     * TeamSession (invariant 18).
     */
    IDENTITY_SCOPE_MISMATCH: POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH,
    /**
     * An escalation beyond the external hard facts: the mutation grants
     * items the host hard policy denies / excludes, or targets a capability
     * the substrate probe reports absent (Architecture §19.2/§19.5,
     * invariant 35 — a stored override cannot create a removed capability).
     */
    EXTERNAL_HARD_REJECTED: 'EXTERNAL_HARD_REJECTED',
    /**
     * Architecture §20.4 / invariant 40: the transition source is neither an
     * explicit human nor an authorized leader.
     */
    UNAUTHORIZED_TRANSITION: 'UNAUTHORIZED_TRANSITION',
    /**
     * Architecture §21.2/§21.6: an illegal post-creation change of a
     * creation field (workspace after first RUNNING; contextPolicy after
     * creation).
     */
    IMMUTABLE_CREATION_FIELD: 'IMMUTABLE_CREATION_FIELD',
    /** The addressed MemberInstance has no registered creation fields. */
    UNKNOWN_INSTANCE: 'UNKNOWN_INSTANCE',
    /**
     * P8-S4B: the (kind, recordId, scope, rootSessionId, instanceId) identity
     * already exists in the durable overrides store — the same slot record
     * cannot be re-admitted under the same recordId (a new mutation issues a
     * NEW recordId at the next generation; v1 keeps one durable record per
     * slot identity).
     */
    OVERRIDE_IDENTITY_CONFLICT: 'OVERRIDE_IDENTITY_CONFLICT',
    /**
     * P8-S4B: optimistic generation conflict — the caller expected a
     * different current winner generation than the durable store holds.
     */
    OVERRIDE_GENERATION_CONFLICT: 'OVERRIDE_GENERATION_CONFLICT',
    /**
     * P8-S4B: the mutation authority cannot produce the requested record —
     * the (authority kind, record kind, scope, origin, target instance)
     * combination is not authorized (a member cannot issue team scope or
     * overlay another instance; an agent authority cannot issue a human
     * override; the operator channel issues human overrides only).
     */
    UNAUTHORIZED_MUTATION: 'UNAUTHORIZED_MUTATION',
};
/** Every code value, in declaration order (deterministic). */
export const MUTATION_ERROR_CODE_VALUES = [
    MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
    MUTATION_ERROR_CODES.MEMBER_SELF_ESCALATION,
    MUTATION_ERROR_CODES.LEADER_OUT_OF_ENVELOPE,
    MUTATION_ERROR_CODES.IDENTITY_SCOPE_MISMATCH,
    MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED,
    MUTATION_ERROR_CODES.UNAUTHORIZED_TRANSITION,
    MUTATION_ERROR_CODES.IMMUTABLE_CREATION_FIELD,
    MUTATION_ERROR_CODES.UNKNOWN_INSTANCE,
    MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT,
    MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT,
    MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION,
];
/**
 * The typed error thrown by the mutation service for every mutation-plane
 * failure. Escalation failures are typed errors, never silent (TaskDoc
 * P7-T2 acceptance: 非法 escalation 被拒).
 */
export class MutationError extends Error {
    /** The closed mutation error code. */
    code;
    /**
     * Machine-readable details. Known keys: `capability` (the affected cell),
     * `field` (the malformed input path), `problem` (short structural
     * reason), `outOfEnvelopeItems` / `envelopeItems` (the envelope
     * intersection at failure time), `outOfHardItems` (items beyond the
     * external hard allow-list), `hardReason` (`hardDeny` |
     * `outsideHardAllowList` | `capabilityMissing`), `instanceId` (the
     * unknown instance), `field` + `state` (the creation-field rule
     * violated), `actor` (the unauthorized transition source), `recordId`
     * (the conflicting / admitted override identity), `expectedGeneration` /
     * `actualGeneration` (the optimistic generation mismatch).
     */
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'MutationError';
        this.code = code;
        if (details !== undefined) {
            this.details = details;
        }
    }
}
/** Type guard: is `value` a {@link MutationError}? */
export function isMutationError(value) {
    if (!(value instanceof MutationError))
        return false;
    return typeof value.code === 'string' && MUTATION_ERROR_CODE_VALUES.includes(value.code);
}
//# sourceMappingURL=errors.js.map