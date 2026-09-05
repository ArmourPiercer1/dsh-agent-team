/**
 * The throw-proof dispatcher of the Remote contract v1 (design note §6).
 *
 * The dispatcher is the single entry point the seam invokes per request:
 * `(endpoint, payload) => Promise<RemoteResponse>`. It enforces the seven
 * dispatcher invariants (design note §6, all unit-tested):
 *
 * 1. unknown endpoint → `unknown-method` error result (never a throw) —
 *    checked BEFORE the envelope, so an unknown endpoint always reports
 *    `unknown-method` even with a garbage payload;
 * 2. envelope parse failure → `malformed-request` /
 *    `contract-version-unsupported`;
 * 3. param validation failure → `malformed-params` (with `field` in
 *    details) or the mirrored frozen P3 ID codes (deviation D-1/D-3);
 * 4. typed domain error whose string `code` is a member of the CLOSED
 *    backing vocabulary ({@link REMOTE_BACKING_ERROR_CODE_SET}) →
 *    pass-through code + message, source identity under `details.cause`
 *    (never the raw exception); an `Error` with an out-of-vocabulary `code`
 *    (a Node `ENOENT`, a synthetic code, …) is NOT a typed domain error and
 *    degrades to invariant 5 (T12-H4);
 * 5. untyped throw from a port → `internal-error`, generic message, no
 *    leak;
 * 6. the success value passes a lossless-JSON check before the reply is
 *    built (otherwise `internal-error`);
 * 7. the returned promise never rejects — the outermost try/catch turns
 *    every failure path into an error result, so the seam never sees a
 *    handler throw (the P2-T6 500 class, designed out).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/dispatch
 */
import { type RemoteResponse } from '../contracts/response.js';
import type { RemoteHandlerDeps } from './ports.js';
/** One request of the public seam: endpoint + raw payload. */
export type RemoteDispatcher = (endpoint: string, payload: unknown) => Promise<RemoteResponse>;
/**
 * The CLOSED backing-service error-code vocabulary invariant 4b may pass
 * through (T12-H4).
 *
 * Invariant 4 originally passed through ANY thrown `Error` carrying its own
 * non-empty string `code`. That was a leak: a plain `Error` — a Node
 * filesystem failure with `code: 'ENOENT'` and a path in the message, a
 * hand-rolled error with an ad-hoc code — rode its code AND its raw message
 * onto the wire. Invariant 4b now accepts only the explicitly-enumerated
 * closed codes below: the stable string-code vocabularies of the backing
 * services a remote handler port can run into.
 *
 * This package is pure (no runtime/domain/storage dependency), so the values
 * are literals rather than imported class constants — the closed set is
 * visible in exactly ONE place, at the wire boundary:
 *
 * - runtime/admission `TEAM_RUNTIME_ERROR_CODES` (the unified runtime facade);
 * - runtime/compatibility `COMPATIBILITY_ERROR_CODES`;
 * - runtime/lifecycle `LIFECYCLE_RUNTIME_ERROR_CODES`;
 * - runtime/mutation `MUTATION_ERROR_CODES`;
 * - runtime/handoff `HANDOFF_ERROR_CODES`;
 * - domain/member `MEMBER_DOMAIN_ERROR_CODES`;
 * - domain/lifecycle `LIFECYCLE_DOMAIN_ERROR_CODES`;
 * - storage/schema `TEAM_DOMAIN_ERROR_CODES` (the TeamDomain sidecar layer);
 * - contracts v1 `TEAM_CONTRACT_ERROR_CODES` (the frozen identity/DTO rules);
 * - the S6 plugin's remote-facing codes (s6-principal `S6_PRINCIPAL_ERROR_CODES`
 *   + s6-remote `S6_REMOTE_ERROR_CODES`), which the production dispatcher
 *   raises inside its handlers.
 *
 * Maintenance rule: when a backing module introduces a NEW closed code that
 * must reach a remote caller, add its literal here and re-verify the
 * dispatcher tests. Generic platform codes (ENOENT, ECONNRESET, …) and every
 * ad-hoc code stay OUT on purpose: they carry filesystem paths and host
 * internals that must not reach an external browser.
 */
export declare const REMOTE_BACKING_ERROR_CODES: readonly ["TEAM_RUNTIME_REQUEST_MALFORMED", "TEAM_RUNTIME_ACTION_UNKNOWN", "TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED", "TEAM_RUNTIME_INSTANCE_NOT_FOUND", "TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND", "TEAM_RUNTIME_TEAM_ROOT_BINDING_MISSING", "TEAM_RUNTIME_BLUEPRINT_UNRESOLVED", "TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH", "TEAM_RUNTIME_CALLER_NOT_FOUND", "TEAM_RUNTIME_CALLER_ROLE_STALE", "TEAM_RUNTIME_CALLER_AUTHORITY_DENIED", "TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS", "TEAM_RUNTIME_COMPATIBILITY_BLOCKED", "TEAM_RUNTIME_WORK_STATE_REJECTED", "TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_INSTANCES", "TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_CONCURRENT", "TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES", "TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_CONCURRENT", "TEAM_RUNTIME_DELEGATION_TARGET_UNRESOLVED", "TEAM_RUNTIME_LIFECYCLE_TRANSITION_REJECTED", "TEAM_RUNTIME_LIFECYCLE_COMMIT_UNAVAILABLE", "TEAM_RUNTIME_LIFECYCLE_NOT_QUIESCENT", "TEAM_RUNTIME_LIFECYCLE_LIVE_EFFECT_FAILED", "TEAM_RUNTIME_POLICY_RESOLUTION_FAILED", "TEAM_RUNTIME_DURABLE_WRITE_FAILED", "TEAM_RUNTIME_WORK_DELIVERY_FAILED", "COMPATIBILITY_NEW_WORK_BLOCKED", "COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE", "COMPATIBILITY_ACK_TARGET_NOT_WARNING", "COMPATIBILITY_WORK_UNKNOWN", "COMPATIBILITY_WORK_ALREADY_SETTLED", "COMPATIBILITY_UNBRIDGEABLE_REQUIREMENT", "LIFECYCLE_INVALID_INPUT", "LIFECYCLE_MEMBER_NOT_FOUND", "LIFECYCLE_LEADER_NOT_OPERABLE", "LIFECYCLE_ILLEGAL_STATE", "LIFECYCLE_NOT_QUIESCENT", "LIFECYCLE_LIVE_EFFECT_FAILED", "LIFECYCLE_DURABLE_STATE_FAILED", "MALFORMED_MUTATION_INPUT", "EXTERNAL_HARD_REJECTED", "UNAUTHORIZED_TRANSITION", "IMMUTABLE_CREATION_FIELD", "UNKNOWN_INSTANCE", "OVERRIDE_IDENTITY_CONFLICT", "OVERRIDE_GENERATION_CONFLICT", "UNAUTHORIZED_MUTATION", "HANDOFF_REQUEST_MALFORMED", "HANDOFF_SOURCE_SURFACE_UNAVAILABLE", "HANDOFF_SUMMARIZATION_FAILED", "HANDOFF_TEAM_CREATION_FAILED", "HANDOFF_SOURCE_HISTORY_ACCESS_DENIED", "HANDOFF_OPERATION_UNKNOWN", "HANDOFF_OPERATION_NOT_DECIDABLE", "HANDOFF_OPERATION_ALREADY_FINALIZED", "CONTEXT_POLICY_UNKNOWN", "DELEGATION_TARGET_INVALID", "DELEGATION_TARGET_AMBIGUOUS", "DELEGATION_TARGET_DISPOSED", "INSTANCE_ID_RESERVED", "WORKSPACE_MUTATION_FORBIDDEN", "LIFECYCLE_TERMINAL_STATE", "LIFECYCLE_ILLEGAL_TRANSITION", "TEAM_DOMAIN_EXISTS", "SCHEMA_STAMP_MISSING", "SCHEMA_STAMP_MISMATCH", "SCHEMA_VERSION_MISMATCH", "RECORD_INVALID", "RECORD_DUPLICATE", "NOT_OPEN", "SEAM_FAILURE", "INVALID_SESSION_ID", "INVALID_ROOT_SESSION_ID", "INVALID_CHILD_SESSION_ID", "INVALID_INSTANCE_ID", "INVALID_TEMPLATE_ID", "INVALID_BLUEPRINT_ID", "INVALID_BLUEPRINT_REVISION", "INVALID_BLUEPRINT_CONTENT_HASH", "IDENTITY_SCOPE_MISMATCH", "DUPLICATE_INSTANCE_ID", "DUPLICATE_TEAM_SESSION", "SESSION_ALREADY_BOUND", "MEMBER_NOT_FOUND", "LEGACY_MEMBER_ID_REJECTED", "LEGACY_TEAM_SESSION_EVENT_REJECTED", "SCHEMA_VERSION_UNSUPPORTED", "MALFORMED_DTO", "REMOTE_VALUE_NOT_JSON", "TEAM_PERSONA_COMPLETE_PRESET_CONFLICT", "TEAM_REMOTE_FOREIGN_TEAM", "TEAM_REMOTE_PRINCIPAL_INVALID", "TEAM_REMOTE_LEDGER_PAGE_REJECTED", "TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT", "TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED", "TEAM_REMOTE_POLICY_STATE_UNKNOWN", "TEAM_REMOTE_CATALOG_REVISION_MALFORMED", "TEAM_REMOTE_LEDGER_ENTRY_MALFORMED", "TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE", "TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE", "TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED", "TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH"];
/** The closed set form of {@link REMOTE_BACKING_ERROR_CODES} (O(1) lookup). */
export declare const REMOTE_BACKING_ERROR_CODE_SET: ReadonlySet<string>;
/**
 * Invariant 4b gate (T12-H4): is `code` a member of the closed
 * backing-service vocabulary? Anything else degrades to `internal-error`.
 */
export declare function isRemoteBackingErrorCode(code: unknown): code is string;
/**
 * Create the throw-proof dispatcher for one deps object.
 * @param deps - the twelve backing ports (injected; no global state).
 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
 */
export declare function createRemoteDispatcher(deps: RemoteHandlerDeps): RemoteDispatcher;
//# sourceMappingURL=dispatch.d.ts.map