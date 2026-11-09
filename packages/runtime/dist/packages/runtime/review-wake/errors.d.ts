/**
 * Alpha.6 PR3 — the constructor-time input error.
 *
 * The reducer REFUSES malformed events and invalid transitions via the
 * `refused` outcome (no throw); only building the initial latch from a
 * structurally invalid key throws, because there is no state to return.
 *
 * @module @dsh-agent-team/runtime/review-wake/errors
 */
export declare const REVIEW_WAKE_INPUT_ERROR_CODE: "invalid-key";
export type ReviewWakeInputErrorCode = typeof REVIEW_WAKE_INPUT_ERROR_CODE;
export declare class ReviewWakeInputError extends Error {
    readonly code: ReviewWakeInputErrorCode;
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map