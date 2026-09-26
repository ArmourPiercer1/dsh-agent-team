/**
 * The model overlay's typed error channel (PR #30 review-supplement P2-1).
 *
 * The bound template's `modelPreference` has THREE distinct semantics that
 * the derivation MUST keep apart:
 *
 * - ABSENT preference → `undefined` (the model cell stays `unspecified`,
 *   the deployment `staticModel` fallback applies at the consumer — the
 *   documented legacy behavior);
 * - PRESENT + VALID preference → the template/static model value (the
 *   allow grant);
 * - PRESENT + MALFORMED preference → a TYPED ERROR (this module). A token
 *   that bypassed the Blueprint strong validation (a synthetic / hand-built
 *   template) must FAIL LOUD at setup / activation / inspect — it must
 *   NEVER be disguised as "absent" and silently fall back to the
 *   `staticModel` baseline.
 *
 * {@link InvalidTemplateModelPreferenceError} carries the model-layer code
 * `INVALID_TEMPLATE_MODEL_PREFERENCE` plus the `templateId` and the raw
 * token so a caller can branch on `code` (and the
 * {@link isInvalidTemplateModelPreferenceError} guard) without parsing the
 * message — the same discipline as the frozen contracts-v1 / binder error
 * codes. Boundaries that already have a closed error vocabulary (activation,
 * live agent setup, inspect-config) MAY wrap it into their own code, keeping
 * this error on `cause` so the model-layer code travels the cause chain.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/model/errors
 */
/** The closed error-code vocabulary of the model overlay (P2-1). */
export declare const MODEL_ERROR_CODES: {
    /**
     * A bound template declares a `modelPreference` token that is PRESENT but
     * malformed (it failed the strict v1 token grammar). The model cell cannot
     * be derived; this is a fail-loud error — never a silent `staticModel`
     * fallback, never disguised as an absent preference.
     */
    readonly INVALID_TEMPLATE_MODEL_PREFERENCE: "INVALID_TEMPLATE_MODEL_PREFERENCE";
};
/** One closed model-overlay error code. */
export type ModelErrorCode = (typeof MODEL_ERROR_CODES)[keyof typeof MODEL_ERROR_CODES];
/**
 * The fail-loud error for a PRESENT-but-MALFORMED template
 * `modelPreference`.
 *
 * Thrown by `initialTemplateModelGrantOf` when the template's token is
 * present but fails the strict v1 grammar — so the setup / activation /
 * inspect boundary fails loud instead of silently substituting the
 * deployment `staticModel` baseline.
 */
export declare class InvalidTemplateModelPreferenceError extends Error {
    /** The closed model-overlay error code. */
    readonly code: ModelErrorCode;
    /**
     * Structured context (no live references): the offending template's id and
     * the raw token as declared in the Blueprint.
     */
    readonly details: {
        readonly templateId: string;
        readonly token: string;
    };
    constructor(details: {
        readonly templateId: string;
        readonly token: string;
    });
}
/**
 * Type guard: `true` iff `value` is an `Error` carrying the
 * `INVALID_TEMPLATE_MODEL_PREFERENCE` code.
 * @param value - the value to check.
 */
export declare function isInvalidTemplateModelPreferenceError(value: unknown): value is InvalidTemplateModelPreferenceError;
//# sourceMappingURL=errors.d.ts.map