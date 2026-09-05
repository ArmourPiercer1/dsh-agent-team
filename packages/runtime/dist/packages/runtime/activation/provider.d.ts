/**
 * ActivationProvider — the SOLE entry point for every new MemberInstance
 * creation (Architecture invariant 26) and the full admission/provisioning
 * order (DevPlan 19.2): resolve TeamSession → resolve immutable Blueprint →
 * resolve template → caller authority → admission → compatibility → quota →
 * policy → overlay bounds → workspace+context fields → allocate instanceId
 * (INSIDE the stable operation identity, per the journal protocol) → journal
 * prepare → create child Agent+Session → bind TeamDomain → commit
 * MemberInstance → publish projection.
 *
 * Human, leader-explicit, and leader-delegate requests all funnel through the
 * same provider; there is no separate per-source creation path.
 *
 * Crash model (Architecture §18, DevPlan §17.3): the provider's admission is
 * ONCE per logical activation. The stable operation identity
 * `(rootSessionId, source, requestToken) → (instanceId, operationId,
 * idempotencyKey)` makes retries converge:
 *   - no durable operation row  → the full admission+provisioning order runs
 *   - PREPARED operation        → roll-forward through the provisioning
 *     coordinator (idempotent effects, no re-admission)
 *   - COMMITTED operation       → durable result is replayed (idempotent no-op
 *     at the journal; binder + projection re-applied, `replayed: true`)
 *   - FAILED operation          → ABANDONED (the journal protocol never
 *     roll-forwards a FAILED row): the provider fails loudly with
 *     OPERATION_FAILED; a retry must use a new logical operation (new
 *     requestToken).
 *
 * Admit-once consequence: quota and policy re-checks run ONLY on the new
 * path. A retry of an already-admitted activation never re-runs admission —
 * the durable admitted content (the journal intent payload) is authoritative.
 *
 * `activate(request)` and `recoverActivation(request)` share one entry:
 * `recoverActivation` documents the intent (recover a crashed/abandoned
 * activation) but executes the same converge-or-create order, so a recovery
 * request whose token has no durable operation row simply performs the fresh
 * activation.
 *
 * The `now` port is reserved for future projection timestamping; the v1
 * provider does not consume it (durable timestamps come from the TeamDomain
 * records themselves).
 */
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js';
import type { ActivationPorts, ActivationProvider } from './types.js';
import { ACTIVATION_SOURCES, ACTIVATION_SOURCE_VALUES } from './types.js';
/**
 * Create an ActivationProvider over the given ports.
 *
 * The provider is bound to the given `teamDomain` instance for its lifetime:
 * after a domain restart the caller rebuilds the provider with the reopened
 * domain (the per-team coordinator cache references the domain).
 *
 * All durable writes for one team are serialized behind a per-team promise
 * chain so that concurrent activations of the same team see each other's
 * in-flight reservations in the quota and instance-id collision checks.
 */
export declare function createActivationProvider(ports: ActivationPorts): ActivationProvider;
/**
 * Re-exported here for provider consumers that need the TeamDomain type when
 * assembling ports (type-only; the provider itself only needs
 * `teamDomain.repositories` + the coordinator's `domain` port).
 */
export type { TeamDomain as ActivationTeamDomain } from '../../storage/repositories/index.js';
/**
 * TeamDomainError re-throw guard: durable protocol problems surface as
 * ActivationError with the matching provider code; anything else is
 * re-thrown UNWRAPPED (the caller sees the exact downstream fault).
 *
 * Exported for the test surface (and future provider siblings) that assemble
 * errors around the coordinator.
 */
export declare function mapActivationDurableError(error: unknown, context: Record<string, unknown>): unknown;
/** The leader instance id (re-exported for request construction). */
export { LEADER_INSTANCE_ID };
/** The closed activation source vocabulary (re-exported for callers). */
export { ACTIVATION_SOURCES, ACTIVATION_SOURCE_VALUES };
//# sourceMappingURL=provider.d.ts.map