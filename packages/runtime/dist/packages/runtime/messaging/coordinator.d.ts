/**
 * P6-T3 — the messaging coordinator: instance-addressed send/relay over the
 * P6-T2 TeamRuntime facade with the two-record split and restart recovery.
 *
 * ## Flow of `sendTeamMessage` (documented rulings below)
 *
 * 1. **Module input validation** (zero writes): the request shape, the
 *    non-empty body/token/ids, the caller form.
 * 2. **Self-send policy** (zero writes): an instance caller addressing its
 *    OWN instance is rejected with `MESSAGING_SELF_SEND_REJECTED` (defined
 *    policy — self-talk is not team coordination; the check resolves the
 *    recipient token first so a label that would resolve to the caller's
 *    own instance cannot smuggle a self-send past it — labels are rejected
 *    by the facade anyway, so the check is exact and complete on instance
 *    tokens).
 * 3. **The P6-T2 facade** (`TeamRuntime.performAction`, action
 *    `send-message`): steps 0–5 (request validation, instanceId-first team
 *    + target resolution — label/template tokens REJECTED, invariant 19 —
 *    caller identity/role, role authority + mutation envelope, the
 *    compatibility gate) and the durable **intent fact**
 *    `team-coordination-recorded` (step 6, under the facade's own
 *    per-team lock). Any rejection is a `TeamRuntimeError` with ZERO
 *    durable writes — it propagates UNMAPPED (the facade stays the single
 *    authority; this module never re-implements admission).
 * 4. **Delivery phase** — THREE lock-scope acquisitions of the
 *    COORDINATOR's per-team lock (the exported `withTeamLock` seam, its
 *    own lock map, so the two lock owners compose: the facade serializes
 *    its effects, the coordinator serializes its delivery decisions and
 *    its confirmation commits). INV-9.1 (repair-r1 F3-C — the
 *    private-chain extension of the F3-A rule): no chain, shared or
 *    private, may be held across a turn it observes. The port call (the
 *    recipient's ENTIRE model execution) therefore runs with the private
 *    chain RELEASED, so a `team_send_message` issued by the recipient
 *    inside the message-triggered turn re-enters this same coordinator
 *    and acquires the chain freely (pre-fix it queued behind the outer
 *    send's own pending tail — the H2 self-deadlock):
 *      - **Phase A** (chain held): the durable intent fact is read and
 *        validated; the delivery plan is re-derived from the intent
 *        (`payload.caller` + `payload.recipientInstanceId`) + the FRESH
 *        override records (same pure rule as recovery — one code path);
 *        the delivery target record is read fresh and must be
 *        work-accepting (CREATED/RUNNING/SETTLED, the facade's live set —
 *        `WORK_ACCEPTING_STATES`), else `MESSAGING_TARGET_NOT_LIVE`; the
 *        relay attribution + text are rendered (pure).
 *      - **Phase B** (chain RELEASED — no lock held): the attributed
 *        input is submitted through the injected `SessionInputPort`
 *        (commit-or-throws); a rejection is `MESSAGING_DELIVERY_FAILED`
 *        and the intent fact REMAINS durable (Architecture §24.2 orders
 *        the intent before the delivery — the coordination is recoverable).
 *      - **Phase C** (chain re-acquired — the SAME private chain): the
 *        **confirmation fact** `team-message-delivered` is committed
 *        through the ledger repository (sequence allocated through the
 *        atomic counter on the domain write chain — concurrent confirms
 *        can never interleave writes); if a confirmation for the SAME
 *        intent is already durable (the at-least-once redelivery race the
 *        released Phase B makes possible) the commit CONVERGES on the
 *        existing fact (exactly-once on the TeamLedger — R3); a commit
 *        failure is `MESSAGING_LEDGER_WRITE_FAILED` (the input may
 *        already have been delivered — at-least-once, detectable through
 *        the correlation token).
 *
 * ## Documented rulings (the semantics this module is accountable for)
 *
 * - **R1 (single authoritative record):** the durable intent fact is the
 *   single authoritative record of the coordination (who → whom,
 *   instanceIds, token); the delivery plan is NOT persisted inside it
 *   (the facade's fact payload is closed) and is RE-DERIVED from it plus
 *   the current durable governance state at delivery time. An overlay
 *   written between the intent and the delivery therefore changes the
 *   delivery PATH but never the coordination (same sender, same recipient,
 *   same content); the confirmation fact records the path actually taken.
 * - **R2 (intent survives delivery failure):** a delivery failure after
 *   the intent fact leaves the intent fact durable WITHOUT a confirmation
 *   fact — a *pending delivery*. The intent is the team-wide fact (the
 *   coordination happened); the input to the session is at-least-once.
 * - **R3 (restart recovery):** `recoverPendingDeliveries` scans the
 *   durable ledger for `send-message` intents lacking a confirmation fact
 *   (matched by `requestToken`), in intent-fact sequence order, and
 *   re-delivers each (fresh plan, fresh target view, fresh delivery,
 *   confirmation commit). It is exactly-once on the TeamLedger (one
 *   confirmation per pending intent) and at-least-once on the session
 *   input (a crash between the input write and the confirmation commit
 *   redelivers — detectable through the correlation token). The
 *   exactly-once-on-ledger property is enforced in Phase C under the
 *   private chain: two concurrent deliveries of the same pending intent
 *   (now possible because Phase B holds no chain) both re-deliver the
 *   input (the documented at-least-once residue) but only the first
 *   commits a confirmation — the second converges on the existing fact
 *   and reports it.
 * - **R4 (dead targets at recovery are skipped):** a pending delivery
 *   whose (re-derived) target record is missing or not work-accepting is
 *   SKIPPED with the closed reason (`delivery-target-missing` /
 *   `delivery-target-not-live`) and stays pending: a later restore +
 *   recovery delivers it; a DISPOSED target is skipped permanently (the
 *   intent fact is the durable record of the coordination).
 * - **R5 (recovery aborts on hard failure):** a delivery or confirmation
 *   failure during recovery aborts the scan with the typed error;
 *   deliveries confirmed earlier in the run stay durable, the rest stay
 *   pending for the next scan.
 * - **R6 (ordering):** the coordinator's delivery DECISIONS (Phase A —
 *   plan + liveness + the recovery's scan/skip verdicts) and its
 *   CONFIRMATION COMMITS (Phase C) run under its own per-team lock; the
 *   session input port call (Phase B — the recipient's model execution)
 *   runs with the chain released (INV-9.1). The ledger sequence is the
 *   team-order authority (invariant 44) — the session-input order of two
 *   concurrent (or re-entering) sends may interleave, the ledger does
 *   not.
 * - **R7 (no Team SessionEvents, invariant 42):** the module creates
 *   exactly two record kinds — the facade's ledger intent row and its own
 *   ledger confirmation row — plus ordinary attributed input on the target
 *   session. Nothing else.
 *
 * @module messaging (P6-T3)
 */
import type { MessagingCoordinator, MessagingCoordinatorOptions } from './types.js';
/**
 * Create the P6-T3 messaging coordinator.
 *
 * @param options - the injected wiring (facade + TeamDomain + session
 *  input port + clock).
 * @returns the messaging surface.
 */
export declare function createMessagingCoordinator(options: MessagingCoordinatorOptions): MessagingCoordinator;
//# sourceMappingURL=coordinator.d.ts.map