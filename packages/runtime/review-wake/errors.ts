/**
 * Alpha.6 PR3 — the constructor-time input error.
 *
 * The reducer REFUSES malformed events and invalid transitions via the
 * `refused` outcome (no throw); only building the initial latch from a
 * structurally invalid key throws, because there is no state to return.
 *
 * @module @dsh-agent-team/runtime/review-wake/errors
 */

export const REVIEW_WAKE_INPUT_ERROR_CODE = 'invalid-key' as const
export type ReviewWakeInputErrorCode = typeof REVIEW_WAKE_INPUT_ERROR_CODE

export class ReviewWakeInputError extends Error {
  readonly code: ReviewWakeInputErrorCode = REVIEW_WAKE_INPUT_ERROR_CODE

  constructor(message: string) {
    super(message)
    this.name = 'ReviewWakeInputError'
  }
}
