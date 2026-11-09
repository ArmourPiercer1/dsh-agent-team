/**
 * Alpha.6 PR3 — the constructor-time input error.
 *
 * The reducer REFUSES malformed events and invalid transitions via the
 * `refused` outcome (no throw); only building the initial latch from a
 * structurally invalid key throws, because there is no state to return.
 *
 * @module @dsh-agent-team/runtime/review-wake/errors
 */
export const REVIEW_WAKE_INPUT_ERROR_CODE = 'invalid-key';
export class ReviewWakeInputError extends Error {
    code = REVIEW_WAKE_INPUT_ERROR_CODE;
    constructor(message) {
        super(message);
        this.name = 'ReviewWakeInputError';
    }
}
//# sourceMappingURL=errors.js.map