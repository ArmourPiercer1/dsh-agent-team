/**
 * A4-PR6 (stage 6.0) — the GovernanceWarning vocabulary, FROZEN.
 *
 * What this module is: the closed vocabulary for the ONE non-blocking
 * governance diagnostic Alpha.4 admits — the envelope-consistency warning
 * (spec §15). It is a DIAGNOSTIC about the three-way relation between the
 * blueprint's declared leader envelope, the Team hard envelope and the
 * effective evaluation; it is NOT authority, NOT a ControlRequest, and NOT a
 * status the Team waits in (spec §15.0, ADR A5-10; the warning mints no
 * `ControlRequest` row, no leg, and no entry in the decision vocabulary —
 * pinned by `packages/runtime/test/a4p6-governance-warning.test.ts`).
 *
 * THREE action vocabularies exist in this lane and they are DISTINCT sets
 * (the coordination ruling on the vocabulary-drift class):
 *
 * - {@link INTERVENTION_ACTIONS} (`intervention/types.ts`) — the REVIEWER
 *   plane: `allow | deny | escalate`. `acknowledge` never enters it.
 * - {@link CONTROL_DECISION_VALUES} (`control/types.ts`) — the decision
 *   plane written to durable decision rows. `acknowledge` never enters it.
 * - {@link GOVERNANCE_WARNING_ACTIONS} (this module) — the WARNING plane:
 *   exactly `acknowledge`. A warning ack changes reminder state only; it
 *   never affects the authority evaluator and never clears
 *   `migration-required` (plan §6.A, A5-10).
 *
 * The shared rendering surface (`InterventionItem.legalActions`) is a UNION
 * of the plane-specific vocabularies, never a fourth global vocabulary
 * (stated again at the widened type in `intervention/types.ts`).
 *
 * Pure vocabulary module: no I/O, no imports from the plugin layer, no
 * imports from `intervention/**` (the intervention-lane import law runs the
 * other direction).
 *
 * @module @dsh-agent-team/runtime/governance-warning/types
 */
// ---------------------------------------------------------------------------
// durable fact types (6.C registration: host FACT_TYPE_CATEGORY + client
// category map + INTERNAL_FACT_TYPES — all three owners, same commit; the
// category VALUE is `policy` and is pinned as a value, not just a key)
// ---------------------------------------------------------------------------
/**
 * The two durable fact types this lane writes (append-only ledger history):
 *
 * - `governance-warning-observed` — one observation of a mismatch /
 *   undetermined diagnostic, bound to a config+runtime fingerprint
 *   (spec §15.4). Dedup is FINGERPRINT-keyed: a repeat observation updates
 *   count/time in the folded projection, it does not mint a second warning.
 * - `governance-warning-acknowledged` — the acknowledgement of a warning
 *   FINGERPRINT by a principal (spec §15.5). Reminder state only.
 */
export const GOVERNANCE_WARNING_FACT_TYPES = Object.freeze({
    OBSERVED: 'governance-warning-observed',
    ACKNOWLEDGED: 'governance-warning-acknowledged',
});
/** Every warning fact-type value, for closed-set membership checks. */
export const GOVERNANCE_WARNING_FACT_TYPE_VALUES = Object.values(GOVERNANCE_WARNING_FACT_TYPES);
// ---------------------------------------------------------------------------
// diagnostic verdicts
// ---------------------------------------------------------------------------
/**
 * The consistency verdicts of the envelope-consistency diagnostic
 * (spec §15.3). Only `mismatch` and `undetermined` mint warnings;
 * `consistent` writes NOTHING durable (pinned 6.A).
 *
 * `undetermined` absorbs: a comparison that cannot decide (unreadable
 * canonicalisation context, undetermined matcher cell) must never be
 * reported as `consistent` (A5-2's absorbing-cell law, mirrored here).
 */
export const GOVERNANCE_WARNING_VERDICTS = Object.freeze({
    CONSISTENT: 'consistent',
    MISMATCH: 'mismatch',
    UNDETERMINED: 'undetermined',
});
/** The verdicts that mint a warning (everything except `consistent`). */
export const GOVERNANCE_WARNING_MINTING_VERDICTS = Object.freeze([GOVERNANCE_WARNING_VERDICTS.MISMATCH, GOVERNANCE_WARNING_VERDICTS.UNDETERMINED]);
/**
 * The closed warning KINDS. Alpha.4 has exactly one kind — the
 * envelope-consistency diagnostic (spec §15). The source-kind slot in the
 * intervention projection (`governance-warning`) maps 1:1 onto this.
 */
export const GOVERNANCE_WARNING_KINDS = Object.freeze({
    ENVELOPE_CONSISTENCY: 'envelope-consistency',
});
// ---------------------------------------------------------------------------
// the WARNING action vocabulary (distinct from the reviewer + decision planes)
// ---------------------------------------------------------------------------
/**
 * The WARNING-plane action vocabulary: exactly `acknowledge`.
 *
 * It is NOT a reviewer action (it never resolves an approval case) and NOT a
 * decision value (it never lands in a `ControlDecisionRecord`). The v8 wire
 * `intervention.act` admits the UNION of this set with the reviewer actions
 * and routes by the item's SOURCE KIND server-side; the item's plane decides
 * which entry point the action reaches (6.B).
 */
export const GOVERNANCE_WARNING_ACTIONS = Object.freeze({
    ACKNOWLEDGE: 'acknowledge',
});
/** Every warning-plane action value, for closed-set membership checks. */
export const GOVERNANCE_WARNING_ACTION_VALUES = Object.values(GOVERNANCE_WARNING_ACTIONS);
// ---------------------------------------------------------------------------
// the start-gate outcome (plan §6.A; consumed at exactly the two
// `team.create` sites after the durable bind and before `startRootAgent()`,
// and at `ensureRootLive` after its fail-closed preflight)
// ---------------------------------------------------------------------------
/**
 * The closed start-gate outcomes:
 *
 * - `open` — start proceeds (this includes the v1/v2 BRIDGE window: PR6
 *   keeps today's bridge behaviour; PR7 7.2 replaces it, plan:603).
 * - `warning-required` — the durable Team root EXISTS and stays NOT LIVE;
 *   the Leader does not start. Acknowledgement re-enters the SAME gate
 *   through the existing `ensureRootLive` / open path — never bypasses it.
 * - `corrupt` — start blocked; NOT acknowledgeable (unreadable/corrupt
 *   authority documents fail closed, plan:602).
 * - `migration-required` — reserved for the v1/v2 cutover (PR7 7.2).
 *   **No acknowledgement clears this outcome, in PR6 or after** (plan:594).
 *   The arm exists, is unit-pinned as ack-immune, and is UNREACHABLE in PR6
 *   (the bridge keeps v1/v2 start alive) — disclosed.
 */
export const GOVERNANCE_START_STATUSES = Object.freeze({
    OPEN: 'open',
    WARNING_REQUIRED: 'warning-required',
    CORRUPT: 'corrupt',
    MIGRATION_REQUIRED: 'migration-required',
});
/** The closed set of corruption reasons for the `corrupt` outcome. */
export const GOVERNANCE_START_CORRUPT_REASONS = Object.freeze({
    AUTHORITY_DOCUMENT_UNREADABLE: 'authority-document-unreadable',
    AUTHORITY_DOCUMENT_CORRUPT: 'authority-document-corrupt',
});
//# sourceMappingURL=types.js.map