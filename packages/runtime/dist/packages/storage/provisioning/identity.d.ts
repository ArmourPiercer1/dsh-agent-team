/**
 * Deterministic identity helpers for the provisioning state machine
 * (TaskDoc §11.5 P4-T4).
 *
 * The frozen operation row key is `op-<1..32 [a-z0-9]>` (P4-T1
 * `OPERATION_ID_PATTERN`) and the operations store is GLOBAL across teams
 * (the journal is team-scoped, but the row key is not). A member's
 * operation identity therefore must incorporate BOTH components of the
 * member runtime identity (invariant 18: `(rootSessionId, instanceId)`) so
 * that the same instance id under two different teams never collides in the
 * global operations store.
 *
 * Session ids are opaque (up to 255 chars) and cannot be concatenated into
 * the 32-char operation suffix, so a SHORT DETERMINISTIC TOKEN of the
 * identity is used. The token is a base36 (i.e. `[a-z0-9]`) rendering of an
 * iterated FNV-1a 32-bit hash: pure, dependency-free (no `node:` builtin,
 * no `crypto`), stable across processes and restarts, and collision-safe
 * for the identity space of one TeamSession.
 *
 * These helpers are the ONLY place the operation/idempotency identity is
 * derived: the coordinator (and the tests) must go through them so that a
 * re-drive of the same logical provisioning ALWAYS reconstructs the same
 * durable identity (Architecture §18.2 stable operation identity).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/provisioning/identity
 */
/**
 * A deterministic `[a-z0-9]` token of `s`: the concatenation of several
 * FNV-1a passes (different seeds) rendered in base36, truncated to
 * `length`. Pure and stable; NOT cryptographic (identity disambiguation
 * only, within one TeamSession's member space).
 * @param s - the string to tokenize.
 * @param length - the token length (must be >= 1 and <= 56 for this scheme).
 */
export declare function deterministicToken(s: string, length: number): string;
/**
 * The durable operation id of one member provisioning: `op-` + a
 * deterministic 24-char token of the member runtime identity
 * `(rootSessionId, instanceId)`. Incorporating the root prevents cross-team
 * collision in the global operations store.
 * @param rootSessionId - the team (root session id).
 * @param instanceId - the member instance id.
 */
export declare function provisioningOperationId(rootSessionId: string, instanceId: string): string;
/**
 * The idempotency key of one member provisioning: the caller's logical
 * operation identity (Architecture §18.2). It binds the member identity to
 * the ALLOCATION token so that re-driving the same logical allocation
 * reconstructs the same key, while a DIFFERENT allocation of the same
 * instance (a different token) is a loud `idempotency-conflict` (the journal
 * rejects the same operationId under a different key).
 * @param rootSessionId - the team (root session id).
 * @param instanceId - the member instance id.
 * @param allocationToken - the caller's allocation identity for this instance.
 */
export declare function provisioningIdempotencyKey(rootSessionId: string, instanceId: string, allocationToken: string): string;
//# sourceMappingURL=identity.d.ts.map