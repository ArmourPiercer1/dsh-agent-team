/**
 * P6-T3 — messaging-coordination types: the instance-addressed send/relay
 * surface built OVER the P6-T2 TeamRuntime facade (never beside it).
 *
 * The two-record split (TaskDoc P6-T3; Architecture §23/§24):
 *
 * (A) The TeamDomain LEDGER row — the team-wide coordination fact. The P6-T2
 *     facade records `team-coordination-recorded` (who → whom, instanceIds,
 *     the correlation token) under its own per-team lock after the full
 *     documented admission order (steps 0–5). This module NEVER re-implements
 *     admission: every send is routed through
 *     `TeamRuntime.performAction({ action: 'send-message', ... })`.
 *
 * (B) The target Session receives ONLY ordinary attributed input through the
 *     injected {@link SessionInputPort} (the real public Session input API
 *     integrates at P6-T6; unit tests use a recording fake). The attribution
 *     carries the correlation (`requestToken` + the intent fact's ledger
 *     `sequence`) so delivery/result correlation reconciles against the
 *     ledger; receiving a relay grants NO shared-history access (the input
 *     is ordinary first-person input in the target's own DSH Session).
 *
 * After a successful delivery the module commits a confirmation fact
 * (`team-message-delivered`) closing the delivery/result correlation in the
 * ledger. Durability semantics (documented rulings, see `coordinator.ts`):
 * exactly-once per logical delivery on the TeamLedger; at-least-once on the
 * session input (a crash between the input write and the confirmation commit
 * is redelivered by restart recovery and is detectable through the
 * correlation token).
 *
 * Message identity is instanceId-first (invariant 18/19):
 * `(rootSessionId, instanceId)` is the ONLY addressing vocabulary; a label
 * or template token is rejected by the facade (the module itself rejects
 * nothing the facade does not reject — it forwards the token and lets the
 * facade classify it).
 *
 * No Team-specific DSH SessionEvent vocabulary exists anywhere (invariant
 * 42): the records are (A) TeamLedger rows and (B) ordinary session input —
 * nothing else.
 *
 * Pure types: no I/O.
 * @module messaging (P6-T3)
 */
// --- fact families -------------------------------------------------------------
/**
 * The intent fact family (recorded by the P6-T2 facade for `send-message`;
 * the module never writes this family itself).
 */
export const MESSAGING_FACT_COORDINATION = 'team-coordination-recorded';
/**
 * The delivery-confirmation fact family (recorded by THIS module after a
 * successful delivery; the delivery/result correlation row of the ledger).
 */
export const MESSAGING_FACT_DELIVERED = 'team-message-delivered';
// --- delivery modes ----------------------------------------------------------------
/** The two frozen delivery modes of the documented mediation rule. */
export const MESSAGING_DELIVERY_MODES = {
    /** The attributed input goes to the RECIPIENT's own bound session. */
    DIRECT: 'direct',
    /**
     * The attributed input goes to the LEADER's bound session (the mediated
     * default for ungranted member→member traffic; the leader acknowledges /
     * relays itself — the runtime never auto-forwards).
     */
    MEDIATED: 'mediated',
};
/** The closed skip reasons of the restart-recovery scan. */
export const PENDING_DELIVERY_SKIP_REASONS = {
    /** The (re-derived) delivery target record no longer exists. */
    DELIVERY_TARGET_MISSING: 'delivery-target-missing',
    /** The delivery target exists but is not work-accepting (ARCHIVED/
     *  DISPOSED). A later restore + recovery delivers it; a DISPOSED target
     *  is skipped permanently (the intent fact is the durable record). */
    DELIVERY_TARGET_NOT_LIVE: 'delivery-target-not-live',
};
//# sourceMappingURL=types.js.map