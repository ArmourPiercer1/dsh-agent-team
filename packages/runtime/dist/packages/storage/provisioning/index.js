/**
 * The durable member-provisioning protocol (TaskDoc §11.5 P4-T4).
 *
 * The NARROW public-surface adapter (ruling R20) for the provisioning
 * state machine `ALLOCATED → CHILD_SESSION_CREATED → CHILD_BOUND →
 * INSTANCE_COMMITTED`, built by composition over its P4 dependencies —
 * the P4-T1 repositories, the P4-T2 operation journal, and the P4-T3
 * SessionBindingService — with exactly ONE external effect behind the
 * injected {@link AgentFactoryAdapter} (the deterministic in-memory fake
 * in this task; the real Agent-runtime binding is P5):
 *
 * - `adapter` — the narrow adapter interface for the one external effect
 *   (create the member's durable child Session), with the idempotency
 *   contract a crash-safe re-drive requires;
 * - `stages` — the durable stage vocabulary (the internal provisioning
 *   state of Architecture §18, derived from TeamDomain state);
 * - `diagnostics` — the closed provisioning diagnostic vocabulary (the
 *   Diagnosable Orphan of Development Plan §17.4, never a silent loss);
 * - `identity` — the deterministic operation/idempotency identity
 *   derivation (the stable operation identity of Architecture §18.2);
 * - `fake-adapter` — the deterministic in-memory adapter implementation
 *   with scriptable failure injection (the only implementation in P4);
 * - `coordinator` — the durable provisioning state machine itself
 *   (self-ensuring stages, roll-forward recovery, orphan scan).
 *
 * No module in this package imports any host backend or live Agent: the
 * repositories (and through them the injected storage seam) are the only
 * state boundary, and the adapter is the only external-effect boundary.
 *
 * @module @dsh-agent-team/storage/provisioning
 */
export * from './adapter.js';
export * from './stages.js';
export * from './diagnostics.js';
export * from './identity.js';
export * from './fake-adapter.js';
export * from './coordinator.js';
//# sourceMappingURL=index.js.map