/**
 * Alpha.6 PR3′ (Lane 2) — the closed vocabularies of the single-flight review-wake scheduler.
 *
 * WHY THIS PACKAGE EXISTS AT ALL. Today a Member that needs a decision posts a control request, and
 * the plugin notifies the reviewer by enqueueing a `next-turn` message per request. One hundred
 * requests are one hundred model turns in a target that could have read all hundred cases in its first
 * turn. This package is the thing that turns "one hundred requests" into "one wake, then re-read".
 *
 * THE ONE LAW THAT HOLDS THIS PACKAGE TOGETHER (Alpha.6 goal 7, and PR #319 §8 SF-1…SF-4): a wake slot
 * is SCHEDULING state and nothing else. It is not an approval, not a case, not a decision, not a
 * permission. Nothing here may ever be read as evidence that a case exists or that anything was
 * decided — the reviewer re-reads the authoritative case list from ControlService/TeamDomain inside its
 * own turn, and the wake text carries a token and a pointer to "query your review work", never an
 * approval payload. The notification is allowed to be lost; the authoritative Case is not.
 *
 * Laws, numbered for the review:
 *  - L-1 SCHEDULING ONLY. No `allow`, no decision value, no mandate, no case payload appears in any
 *    type below. A reviewer reading this file should be able to confirm that by looking, not by trust.
 *  - L-2 SINGLE FLIGHT. At most one non-terminal slot per (rootSessionId, reviewerInstanceId,
 *    sessionGeneration); a request that arrives while one is outstanding merges, it does not deliver.
 *  - L-3 NO WAKE INTO AN EMPTY QUEUE. Reconciling with no ready work releases the slot and emits
 *    nothing. Not "usually not" — nothing.
 *  - L-4 A TURN ENDS ONLY ON A MATCHING `turn/end`. `whenIdle()` is not a completion fact and
 *    `agent/turn-stopping` runs before the durable `turn/end`; neither may advance the machine.
 *  - L-5 STOP IS STICKY. User Stop, Team close and reviewer dispose suspend the slot; no event the
 *    scheduler receives on its own may bring it back. Only an explicit human/Leader `resume` does.
 *  - L-6 NO CLOCK, NO I/O, NO HOST. Time arrives as an injected ISO instant in the context; the
 *    outside world is reached only through event kinds and effect descriptors. This module computes and
 *    refuses; it can touch nothing. Delivery lives in `live/agent-bindings.mjs` and is PR-I2 — a named
 *    Center-Interface PR, not this one.
 */
// --- phases -----------------------------------------------------------------------------------------
/**
 * The slot's lifecycle. `reconciling` is the only phase whose whole purpose is to ask a question of the
 * authoritative side before deciding; `suspended` is the only phase with no automatic exit.
 */
export const WAKE_PHASES = ['idle', 'reserved', 'queued', 'running', 'reconciling', 'backoff', 'suspended'];
/** Phases in which the slot holds an outstanding ask. L-2 is stated over exactly this set. */
export const WAKE_OUTSTANDING_PHASES = ['reserved', 'queued', 'running', 'reconciling', 'backoff'];
export function isOutstandingWake(phase) {
    return WAKE_OUTSTANDING_PHASES.includes(phase);
}
// --- events (what the outside world tells the kernel) ------------------------------------------------
export const WAKE_EVENT_KINDS = [
    'request',
    'delivery-accepted',
    'delivery-refused',
    'claimed',
    'turn-ended',
    'work-scan-completed',
    'withdraw-requested',
    'stop',
    'resume',
    'timer-elapsed',
    'recovery-observed',
];
/** Why a wake could not be delivered. Closed, because the retry ledger keys off it. */
export const WAKE_DELIVERY_FAILURES = ['send-failed', 'target-unresolvable', 'timeout'];
/** Why a slot was suspended. `no-progress` is the storm stop; the rest are the L-5 set. */
export const WAKE_SUSPEND_REASONS = ['user-stop', 'team-close', 'reviewer-disposed', 'no-progress', 'redeliver-budget'];
/** Where the wake message physically is, as observed on restart (PR #319 §9 recovery rule 2). */
export const WAKE_INBOX_OBSERVATIONS = ['unclaimed', 'claimed', 'absent'];
// --- effects (what the kernel asks the outside world to do; it never does any of it) ----------------
export const WAKE_EFFECT_KINDS = ['deliver-wake', 'withdraw-wake', 'scan-work', 'observe-turn'];
// --- refusals ----------------------------------------------------------------------------------------
/**
 * Closed refusal vocabulary. Every rejected transition answers with one of these and changes nothing;
 * there is no exception path out of the reducer, and "we could not tell" is never an implicit accept.
 */
export const WAKE_REFUSALS = [
    'WAKE_EVENT_MALFORMED',
    'WAKE_STALE_LEASE',
    'WAKE_FOREIGN_WRITER',
    'WAKE_NO_SLOT',
    'WAKE_SLOT_SUSPENDED',
    'WAKE_PHASE_UNEXPECTED',
    'WAKE_ID_MISMATCH',
    'WAKE_TURN_MISMATCH',
    'WAKE_FOREIGN_MESSAGE',
    'WAKE_BACKOFF_PENDING',
    'WAKE_TIMESTAMP_INVALID',
    'WAKE_NO_MESSAGE_TO_WITHDRAW',
    'WAKE_KEY_MISMATCH',
    'WAKE_SLOT_MALFORMED',
    'WAKE_SLOT_UNBRANDED',
    'WAKE_CONTEXT_INVALID',
];
//# sourceMappingURL=types.js.map