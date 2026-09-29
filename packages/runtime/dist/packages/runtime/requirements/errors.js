/**
 * pre-alpha3 PR-E (plan §E.4) — the closed error vocabulary of the
 * RequirementAuthority module.
 *
 * Every failure of the module is a {@link RequirementError} with a stable
 * `code` and plain-JSON `details` (the established runtime error-class
 * pattern, mirroring {@link @dsh-agent-team/runtime/compatibility/errors}
 * `CompatibilityError`). Durable-write failures raised by the injected
 * repositories pass through unchanged — this module never rewraps them.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/runtime/requirements/errors
 */
/** The closed RequirementAuthority error-code vocabulary. */
export const REQUIREMENT_ERROR_CODES = {
    /** A scope key is malformed (a template scope with no templateId, or a team scope with one). */
    MALFORMED_SCOPE: 'REQUIREMENT_MALFORMED_SCOPE',
    /** The same requirementId is declared in more than one scope (ambiguous binding). */
    DUPLICATE_REQUIREMENT_SCOPE: 'REQUIREMENT_DUPLICATE_SCOPE',
    /** A degradation consent targets a requirement that is not OPTIONAL (complete must be false). */
    CONSENT_TARGET_NOT_OPTIONAL: 'REQUIREMENT_CONSENT_TARGET_NOT_OPTIONAL',
    /** A degradation consent is presented for a requirement that is not unmet in the current evaluation. */
    CONSENT_TARGET_SATISFIED: 'REQUIREMENT_CONSENT_TARGET_SATISFIED',
    /** A template-availability entry names a template that is not in the bound blueprint. */
    UNKNOWN_TEMPLATE: 'REQUIREMENT_UNKNOWN_TEMPLATE',
    /** The action-impact mapping was asked for an unknown action name. */
    UNKNOWN_ACTION: 'REQUIREMENT_UNKNOWN_ACTION',
    /** A durable fact row is present but malformed (fail closed). */
    MALFORMED_FACT: 'REQUIREMENT_MALFORMED_FACT',
};
/** Every code value, for closed-set membership tests. */
export const REQUIREMENT_ERROR_CODE_VALUES = Object.values(REQUIREMENT_ERROR_CODES);
/**
 * One RequirementAuthority failure (stable code + plain-JSON details).
 */
export class RequirementError extends Error {
    /** The stable closed code. */
    code;
    /** Plain-JSON failure details (never a live object). */
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'RequirementError';
        this.code = code;
        if (details !== undefined) {
            this.details = details;
        }
    }
}
/** Type guard: is `value` a {@link RequirementError}? */
export function isRequirementError(value) {
    return value instanceof RequirementError;
}
//# sourceMappingURL=errors.js.map