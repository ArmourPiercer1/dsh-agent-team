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
export declare const REQUIREMENT_ERROR_CODES: {
    /** A scope key is malformed (a template scope with no templateId, or a team scope with one). */
    readonly MALFORMED_SCOPE: "REQUIREMENT_MALFORMED_SCOPE";
    /** The same requirementId is declared in more than one scope (ambiguous binding). */
    readonly DUPLICATE_REQUIREMENT_SCOPE: "REQUIREMENT_DUPLICATE_SCOPE";
    /** A degradation consent targets a requirement that is not OPTIONAL (complete must be false). */
    readonly CONSENT_TARGET_NOT_OPTIONAL: "REQUIREMENT_CONSENT_TARGET_NOT_OPTIONAL";
    /** A degradation consent is presented for a requirement that is not unmet in the current evaluation. */
    readonly CONSENT_TARGET_SATISFIED: "REQUIREMENT_CONSENT_TARGET_SATISFIED";
    /** A template-availability entry names a template that is not in the bound blueprint. */
    readonly UNKNOWN_TEMPLATE: "REQUIREMENT_UNKNOWN_TEMPLATE";
    /** The action-impact mapping was asked for an unknown action name. */
    readonly UNKNOWN_ACTION: "REQUIREMENT_UNKNOWN_ACTION";
    /** A durable fact row is present but malformed (fail closed). */
    readonly MALFORMED_FACT: "REQUIREMENT_MALFORMED_FACT";
};
/** One of the closed RequirementAuthority error codes. */
export type RequirementErrorCode = (typeof REQUIREMENT_ERROR_CODES)[keyof typeof REQUIREMENT_ERROR_CODES];
/** Every code value, for closed-set membership tests. */
export declare const REQUIREMENT_ERROR_CODE_VALUES: readonly string[];
/**
 * One RequirementAuthority failure (stable code + plain-JSON details).
 */
export declare class RequirementError extends Error {
    /** The stable closed code. */
    readonly code: RequirementErrorCode;
    /** Plain-JSON failure details (never a live object). */
    readonly details?: Record<string, unknown>;
    constructor(code: RequirementErrorCode, message: string, details?: Record<string, unknown>);
}
/** Type guard: is `value` a {@link RequirementError}? */
export declare function isRequirementError(value: unknown): value is RequirementError;
//# sourceMappingURL=errors.d.ts.map