/**
 * Alpha.6 PR2a — pure ReviewCapability facts and capability evidence.
 *
 * A capability says "this real principal may perform this entry action on this
 * current leg, under this Blueprint". It does NOT say the operation may
 * execute: PA/Grant/Guard remain the execution authority, and this module has
 * no I/O, no clock and no service handle.
 *
 * @module @dsh-agent-team/runtime/review-authority/types
 */
/** The only entry actions a capability candidate may be minted for. */
export const REVIEW_CAPABILITY_ENTRIES = ['allow', 'deny', 'escalate', 'terminal-close'];
/** The two sources of review authority. Handoff/takeover is NOT a source. */
export const REVIEW_CAPABILITY_SOURCES = ['native', 'blueprint-officer'];
/**
 * Nominal capability candidate. The private constructor is the only path in
 * this module; a caller cannot mint one by shaping an object, and PA may
 * accept this type as its "trusted candidate" without re-validating raw
 * caller data.
 */
export class ReviewCapabilityCandidate {
    capability;
    // A parameter property (`private constructor(readonly capability: ...)`) is
    // TypeScript-only syntax that Node's strip-only type loader rejects, and the
    // World factory imports this module as source (not through dist). Writing the
    // field out keeps the same nominal guarantee — the constructor is still the
    // only way to build one — while staying runnable as plain ESM.
    constructor(capability) {
        this.capability = capability;
    }
    /** @internal — only `evaluateReviewCapability` calls this. */
    static of(capability) {
        return new ReviewCapabilityCandidate(Object.freeze(capability));
    }
}
/** The closed refusal vocabulary. */
export const REVIEW_CAPABILITY_REFUSALS = [
    'reviewer-not-member',
    'officer-not-resolved',
    'reviewer-not-current-officer',
    'officer-template-mismatch',
    'operation-owner-unknown',
    'operation-tool-unknown',
    'operation-owner-is-officer',
    'leader-exception',
    'fixed-leader-or-human-category',
    'requires-human',
    'case-not-pending',
    'leg-not-leader-rung',
    'not-ordinary-ask',
    'transfer-overrides-delegation',
    'blueprint-routing-absent',
    'blueprint-mismatch',
    'authority-generation-mismatch',
    'scope-mismatch',
    'effect-set-mismatch',
    'escalation-successor-not-human',
    'officer-acted-on-earlier-leg',
    'terminal-close-not-delegable',
    'entry-not-allowed',
];
//# sourceMappingURL=types.js.map