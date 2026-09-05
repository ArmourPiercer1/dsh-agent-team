/**
 * P8-S6 A32 — the production server-side principal derivation
 * (plan §20.3; closes CR-4).
 *
 * The {@link ServerPrincipalDerivation} seam implementation: it derives the
 * team calling authority from ONE parsed remote request. The remote contract
 * v1 surface is EXTERNAL (an untrusted browser); the client's `caller` /
 * `actor` fields are CLAIMS, never trusted. The host derives the principal
 * from its own durable identity:
 *
 * - Human authority → the host-known operator principal, identified by an
 *   OWNED root session — the bound root OR any TeamSession root this host
 *   durably owns (P9-S8: teams created after boot through `team.create` /
 *   `handoff.create` are addressable with their own root identity channel).
 *   A client-claimed `humanId` of a root the host does not own is a spoof
 *   and is rejected.
 * - Leader/Member authority → the Session + TeamDomain identity: the
 *   claimed instance must resolve to a durable member row of one of the
 *   host's owned roots (the leader through its durable leader row; a member
 *   never through the leader row).
 *
 * Every rejection is a typed {@link TeamPluginError} (a string `code`), so
 * the remote dispatcher's pass-through invariant (a typed domain error keeps
 * its code + message; the source identity rides under `details.cause`)
 * reports the boundary violation to the caller instead of acting on the
 * spoofed claim.
 *
 * Read-only: the derivation only READS the durable member rows (to resolve
 * instance claims); it never writes.
 *
 * T12-B4 — the trusted PrincipalContext: the transport (the DSH web seam)
 * provides NO per-caller identity at the plugin handler boundary; every
 * call that reaches a mounted handler has already passed the connection
 * gate (HMAC-signed per-home cookie + loopback/Host fence + same-origin,
 * enforced 401/403 upstream of dispatch; the host binds 127.0.0.1 only).
 * The authority basis of every derivation is therefore "the single
 * anonymous authenticated OPERATOR of this DSH_HOME," recorded by a
 * {@link ServerPrincipalContext} token — never by the payload's `caller` /
 * `actor` claims, which remain CLAIMS that only select/validate scope
 * against host-owned durable facts (A32, unchanged).
 * @module @dsh-agent-team/runtime/plugin/s6-principal
 */
import type { ActionCaller } from '../../admission/index.js';
import type { RemoteRequest } from '../../../remote/src/contracts/request.js';
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js';
/** The stable server-side principal rejection codes (CR-4 boundary). */
export declare const S6_PRINCIPAL_ERROR_CODES: {
    /** The request addresses a TeamSession this host is not bound to. */
    readonly FOREIGN_TEAM: "TEAM_REMOTE_FOREIGN_TEAM";
    /** A client-claimed principal that does not resolve to a durable identity. */
    readonly PRINCIPAL_INVALID: "TEAM_REMOTE_PRINCIPAL_INVALID";
};
export type S6PrincipalErrorCode = (typeof S6_PRINCIPAL_ERROR_CODES)[keyof typeof S6_PRINCIPAL_ERROR_CODES];
/**
 * The closed transport vocabulary of the server principal context.
 * The ONLY supported transport is the DSH web seam's connection gate
 * (the authenticated-operator gate upstream of dispatch).
 */
export declare const SERVER_PRINCIPAL_TRANSPORTS: {
    /** The DSH web seam's connection gate: HMAC-signed per-home cookie +
     *  loopback/Host fence + same-origin, enforced 401/403 BEFORE dispatch;
     *  the host binds 127.0.0.1 only. */
    readonly CONNECTION_GATE: "connection-gate";
};
export type ServerPrincipalTransport = (typeof SERVER_PRINCIPAL_TRANSPORTS)[keyof typeof SERVER_PRINCIPAL_TRANSPORTS];
/**
 * The trusted PrincipalContext of the server (T12-B4) — the seam contract
 * for every call that reaches a mounted remote handler.
 *
 * Authority model:
 *
 * 1. **The gate is upstream.** No authenticated principal can reach a
 *    mounted handler unauthenticated: the transport enforces 401/403
 *    BEFORE dispatch (the connection gate). The context records that basis
 *    — it is NOT a per-caller identity, and it carries none.
 * 2. **The operator class is the trust ceiling.** The transport provides
 *    NO per-caller identity at the plugin handler boundary: one anonymous
 *    authenticated OPERATOR per DSH_HOME. No finer-grained caller class
 *    exists, so no payload claim can be granted more than the operator
 *    ceiling.
 * 3. **Per-request scope comes from host-owned durable facts only.** The
 *    payload's `caller` / `actor` fields are CLAIMS: they select/validate
 *    scope against the bound root session and the durable member rows
 *    (A32). An inconsistent claim is a typed rejection under the EXISTING
 *    `TEAM_REMOTE_PRINCIPAL_INVALID` / `TEAM_REMOTE_FOREIGN_TEAM` codes —
 *    claims NEVER grant authority, and no new wire code is introduced.
 *
 * The token carries NO identity data (no per-caller ids, no accounts, no
 * cookie parsing): it is a basis record and a structural trust marker,
 * verified by {@link isServerPrincipalContext} on the derivation path.
 */
export interface ServerPrincipalContext {
    /** The transport that mounted the handler (the closed vocabulary). */
    readonly transport: ServerPrincipalTransport;
    /** The trust ceiling: the single authenticated operator class. */
    readonly operatorClass: 'operator';
}
/**
 * Structural trust guard for a {@link ServerPrincipalContext} token.
 * A token is trusted only when it structurally carries the
 * connection-gate basis AND the operator ceiling — a forged or partial
 * object (a missing field, a different transport) is NOT trusted, and
 * every consumer that consults the context fails closed on it.
 */
export declare function isServerPrincipalContext(value: unknown): value is ServerPrincipalContext;
/**
 * Create the trusted PrincipalContext for the transport that mounted the
 * remote handler (T12-B4).
 *
 * Only the connection gate is a supported transport: it is the sole
 * authority basis under which a derivation may run (see the
 * {@link ServerPrincipalContext} authority model). Any other transport
 * value is rejected at creation with the existing typed code — there is
 * no wire-visible consequence, the context never crosses the wire.
 *
 * @param options - the closed transport vocabulary entry.
 * @returns the frozen, identity-free basis token.
 */
export declare function createServerPrincipalContext(options: {
    readonly transport: ServerPrincipalTransport;
}): ServerPrincipalContext;
/** The construction inputs of the production principal derivation. */
export interface ServerPrincipalDerivationOptions {
    /** The bound root session id (this host's boot root TeamSession). */
    readonly rootSessionId: string;
    /**
     * P9-S8 — the durable-ownership predicate over TeamSession roots (the
     * roots this host durably owns). The claim checks accept a principal id
     * of the bound root OR of any owned root, so teams created after boot
     * through `team.create` / `handoff.create` are addressable with their
     * own human identity (invariant 9: the team's root session id). Absent:
     * the T12 single-root semantics (bound root only). A claimed id neither
     * bound nor owned is still a spoof (fail-closed).
     */
    readonly isOwnedRoot?: (teamSessionId: string) => boolean;
    /** The durable member rows (to resolve instance claims). */
    readonly repositories: TeamDomainRepositories;
    /** The bound leader's instance id (the leader authority). */
    readonly leaderInstanceId: string;
    /** T12-B4 — the trusted PrincipalContext of the transport that mounted
     *  this derivation (the connection-gate authority basis). OPTIONAL so
     *  the pre-B4 installation keeps its exact A32 behavior; when present
     *  it is consulted on EVERY derivation (construction fail-fast + per
     *  call, before any payload claim is read). A broken token is a typed
     *  rejection under the existing `TEAM_REMOTE_PRINCIPAL_INVALID` code —
     *  no new wire code. */
    readonly principalContext?: ServerPrincipalContext;
}
/**
 * Build the production {@link ServerPrincipalDerivation}.
 *
 * T12-B4: when installed with a {@link ServerPrincipalContext} (the
 * production remote surfaces do), the context is consulted on the
 * derivation path itself — at construction (fail-fast: a broken token is
 * impossible to install) and on EVERY call (the live token is re-verified
 * BEFORE any payload claim is read). The context is the transport's
 * authority basis; the payload claims only select/validate scope (A32).
 *
 * @param options - the bound root + the durable member rows + the leader
 *   id + (optionally) the trusted principal context.
 * @returns the derivation: `(method, request) => ActionCaller`.
 */
export declare function createServerPrincipalDerivation(options: ServerPrincipalDerivationOptions): (input: {
    readonly method: string;
    readonly request: RemoteRequest;
}) => ActionCaller;
//# sourceMappingURL=s6-principal.d.ts.map