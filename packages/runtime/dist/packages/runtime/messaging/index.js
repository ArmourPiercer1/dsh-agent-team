/**
 * P6-T3 — messaging-coordination: instance-addressed team send/relay over
 * the P6-T2 TeamRuntime facade.
 *
 * Composition:
 *   - `types.ts`      — the request/outcome vocabulary, the session input
 *                       port, the fact families, the coordinator surface;
 *   - `errors.ts`     — the closed messaging error codes (the facade's
 *                       TeamRuntimeError codes propagate unmapped);
 *   - `mediation.ts`  — the pure, documented, fail-closed member→member
 *                       mediation rule (direct for human/leader/
 *                       member→leader; peer-direct only under the
 *                       per-sender overlay grant `messagingPeerDirect`;
 *                       everything else mediated via the leader);
 *   - `coordinator.ts`— the coordinator: facade admission + durable intent
 *                       fact, delivery of ordinary attributed input, the
 *                       confirmation fact, and the restart-recovery scan.
 *
 * The two-record split (Architecture §23/§24; TaskDoc P6-T3):
 *   (A) TeamDomain LEDGER — the coordination row: the facade's
 *       `team-coordination-recorded` intent fact (who → whom, instanceIds,
 *       correlation token) + this module's `team-message-delivered`
 *       confirmation fact (the delivery/result correlation);
 *   (B) the target Session receives ONLY ordinary attributed input through
 *       the injected `SessionInputPort` (no Team-specific DSH SessionEvent
 *       vocabulary exists anywhere — invariant 42).
 *
 * Message identity is instanceId-first (invariant 18/19): addressing is
 * `(rootSessionId, instanceId)`; label/template tokens are rejected by the
 * facade. Admission (authority/envelope/quota) is NEVER re-implemented
 * here — every send routes through `TeamRuntime.performAction`.
 *
 * @module messaging (P6-T3)
 */
export { MESSAGING_DELIVERY_MODES, MESSAGING_FACT_COORDINATION, MESSAGING_FACT_DELIVERED, PENDING_DELIVERY_SKIP_REASONS, } from './types.js';
export { MESSAGING_ERROR_CODES, MESSAGING_ERROR_CODE_VALUES, MessagingError, isMessagingError, } from './errors.js';
export { DELIVERY_PLAN_REASONS, PEER_DIRECT_GRANT_KEY, decideDeliveryPlan, peerDirectGranted, renderRelayText, } from './mediation.js';
export { createMessagingCoordinator } from './coordinator.js';
//# sourceMappingURL=index.js.map