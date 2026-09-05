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
import { REMOTE_CATEGORIES, isRemoteMethod, remoteCategoryOf, } from '../contracts/catalog.js';
import { REMOTE_CONTRACT_ERROR_CODES, isRemoteContractError, remoteContractError, } from '../contracts/errors.js';
import { parseRemoteMethodParams } from '../contracts/params.js';
import { parseRemoteRequest } from '../contracts/request.js';
import { buildRemoteError, buildRemoteSuccess, } from '../contracts/response.js';
import { REMOTE_CONTRACT_VERSION } from '../contracts/version.js';
import { createRemoteCatalogHandler } from './catalog.js';
import { createRemoteCompatibilityHandler } from './compatibility.js';
import { createRemoteHandoffHandler } from './handoff.js';
import { createRemoteIntentHandler } from './intent.js';
import { createRemoteLegacyHandler } from './legacy.js';
import { createRemoteMemberHandler } from './member.js';
import { createRemoteOverrideHandler } from './override.js';
import { createRemotePolicyStateHandler } from './policy-state.js';
import { createRemoteTeamHandler } from './team.js';
/** Wire the twelve ports into the nine category handlers. */
function buildCategoryHandlers(deps) {
    return {
        [REMOTE_CATEGORIES.CATALOG]: createRemoteCatalogHandler(deps.catalog),
        [REMOTE_CATEGORIES.INTENT]: createRemoteIntentHandler(deps.intent),
        [REMOTE_CATEGORIES.TEAM]: createRemoteTeamHandler({
            teamCreate: deps.teamCreate,
            projection: deps.projection,
            ledger: deps.ledger,
        }),
        [REMOTE_CATEGORIES.MEMBER]: createRemoteMemberHandler({
            admission: deps.admission,
            lifecycle: deps.lifecycle,
        }),
        [REMOTE_CATEGORIES.OVERRIDE]: createRemoteOverrideHandler(deps.override),
        [REMOTE_CATEGORIES.POLICY_STATE]: createRemotePolicyStateHandler(deps.policyState),
        [REMOTE_CATEGORIES.COMPATIBILITY]: createRemoteCompatibilityHandler(deps.compatibility),
        [REMOTE_CATEGORIES.HANDOFF]: createRemoteHandoffHandler(deps.handoff),
        [REMOTE_CATEGORIES.LEGACY]: createRemoteLegacyHandler(deps.legacy),
    };
}
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
export const REMOTE_BACKING_ERROR_CODES = [
    // runtime/admission — TEAM_RUNTIME_* (P6-T2 unified runtime facade)
    'TEAM_RUNTIME_REQUEST_MALFORMED',
    'TEAM_RUNTIME_ACTION_UNKNOWN',
    'TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED',
    'TEAM_RUNTIME_INSTANCE_NOT_FOUND',
    'TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND',
    'TEAM_RUNTIME_TEAM_ROOT_BINDING_MISSING',
    'TEAM_RUNTIME_BLUEPRINT_UNRESOLVED',
    'TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH',
    'TEAM_RUNTIME_CALLER_NOT_FOUND',
    'TEAM_RUNTIME_CALLER_ROLE_STALE',
    'TEAM_RUNTIME_CALLER_AUTHORITY_DENIED',
    'TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS',
    'TEAM_RUNTIME_COMPATIBILITY_BLOCKED',
    'TEAM_RUNTIME_WORK_STATE_REJECTED',
    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_INSTANCES',
    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_CONCURRENT',
    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES',
    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_CONCURRENT',
    'TEAM_RUNTIME_DELEGATION_TARGET_UNRESOLVED',
    'TEAM_RUNTIME_LIFECYCLE_TRANSITION_REJECTED',
    'TEAM_RUNTIME_LIFECYCLE_COMMIT_UNAVAILABLE',
    'TEAM_RUNTIME_LIFECYCLE_NOT_QUIESCENT',
    'TEAM_RUNTIME_LIFECYCLE_LIVE_EFFECT_FAILED',
    'TEAM_RUNTIME_POLICY_RESOLUTION_FAILED',
    'TEAM_RUNTIME_DURABLE_WRITE_FAILED',
    'TEAM_RUNTIME_WORK_DELIVERY_FAILED',
    // runtime/compatibility — COMPATIBILITY_* (P7-T1)
    'COMPATIBILITY_NEW_WORK_BLOCKED',
    'COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE',
    'COMPATIBILITY_ACK_TARGET_NOT_WARNING',
    'COMPATIBILITY_WORK_UNKNOWN',
    'COMPATIBILITY_WORK_ALREADY_SETTLED',
    'COMPATIBILITY_UNBRIDGEABLE_REQUIREMENT',
    // runtime/lifecycle — LIFECYCLE_* (the runtime lifecycle service)
    'LIFECYCLE_INVALID_INPUT',
    'LIFECYCLE_MEMBER_NOT_FOUND',
    'LIFECYCLE_LEADER_NOT_OPERABLE',
    'LIFECYCLE_ILLEGAL_STATE',
    'LIFECYCLE_NOT_QUIESCENT',
    'LIFECYCLE_LIVE_EFFECT_FAILED',
    'LIFECYCLE_DURABLE_STATE_FAILED',
    // runtime/mutation — the mutation service codes
    'MALFORMED_MUTATION_INPUT',
    'EXTERNAL_HARD_REJECTED',
    'UNAUTHORIZED_TRANSITION',
    'IMMUTABLE_CREATION_FIELD',
    'UNKNOWN_INSTANCE',
    'OVERRIDE_IDENTITY_CONFLICT',
    'OVERRIDE_GENERATION_CONFLICT',
    'UNAUTHORIZED_MUTATION',
    // runtime/handoff — HANDOFF_* (the handoff service)
    'HANDOFF_REQUEST_MALFORMED',
    'HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
    'HANDOFF_SUMMARIZATION_FAILED',
    'HANDOFF_TEAM_CREATION_FAILED',
    'HANDOFF_SOURCE_HISTORY_ACCESS_DENIED',
    'HANDOFF_OPERATION_UNKNOWN',
    'HANDOFF_OPERATION_NOT_DECIDABLE',
    'HANDOFF_OPERATION_ALREADY_FINALIZED',
    // domain/member — MEMBER_DOMAIN_* (the member domain rules)
    'CONTEXT_POLICY_UNKNOWN',
    'DELEGATION_TARGET_INVALID',
    'DELEGATION_TARGET_AMBIGUOUS',
    'DELEGATION_TARGET_DISPOSED',
    'INSTANCE_ID_RESERVED',
    'WORKSPACE_MUTATION_FORBIDDEN',
    // domain/lifecycle — the lifecycle domain rules
    'LIFECYCLE_TERMINAL_STATE',
    'LIFECYCLE_ILLEGAL_TRANSITION',
    // storage/schema — TEAM_DOMAIN_* (the TeamDomain sidecar layer)
    'TEAM_DOMAIN_EXISTS',
    'SCHEMA_STAMP_MISSING',
    'SCHEMA_STAMP_MISMATCH',
    'SCHEMA_VERSION_MISMATCH',
    'RECORD_INVALID',
    'RECORD_DUPLICATE',
    'NOT_OPEN',
    'SEAM_FAILURE',
    // contracts v1 — the frozen identity/DTO rules (TEAM_CONTRACT_ERROR_CODES)
    'INVALID_SESSION_ID',
    'INVALID_ROOT_SESSION_ID',
    'INVALID_CHILD_SESSION_ID',
    'INVALID_INSTANCE_ID',
    'INVALID_TEMPLATE_ID',
    'INVALID_BLUEPRINT_ID',
    'INVALID_BLUEPRINT_REVISION',
    'INVALID_BLUEPRINT_CONTENT_HASH',
    'IDENTITY_SCOPE_MISMATCH',
    'DUPLICATE_INSTANCE_ID',
    'DUPLICATE_TEAM_SESSION',
    'SESSION_ALREADY_BOUND',
    'MEMBER_NOT_FOUND',
    'LEGACY_MEMBER_ID_REJECTED',
    'LEGACY_TEAM_SESSION_EVENT_REJECTED',
    'SCHEMA_VERSION_UNSUPPORTED',
    'MALFORMED_DTO',
    'REMOTE_VALUE_NOT_JSON',
    'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
    // s6-principal — S6_PRINCIPAL_ERROR_CODES (A32 spoof rejections)
    'TEAM_REMOTE_FOREIGN_TEAM',
    'TEAM_REMOTE_PRINCIPAL_INVALID',
    // s6-remote — S6_REMOTE_ERROR_CODES (A31 remote-facing codes)
    'TEAM_REMOTE_LEDGER_PAGE_REJECTED',
    'TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT',
    'TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED',
    'TEAM_REMOTE_POLICY_STATE_UNKNOWN',
    'TEAM_REMOTE_CATALOG_REVISION_MALFORMED',
    'TEAM_REMOTE_LEDGER_ENTRY_MALFORMED',
    'TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
    'TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE',
    'TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED',
    'TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH',
];
/** The closed set form of {@link REMOTE_BACKING_ERROR_CODES} (O(1) lookup). */
export const REMOTE_BACKING_ERROR_CODE_SET = new Set(REMOTE_BACKING_ERROR_CODES);
/**
 * Invariant 4b gate (T12-H4): is `code` a member of the closed
 * backing-service vocabulary? Anything else degrades to `internal-error`.
 */
export function isRemoteBackingErrorCode(code) {
    return typeof code === 'string' && REMOTE_BACKING_ERROR_CODE_SET.has(code);
}
/**
 * Map any failure value to a typed error result (invariants 4/5).
 * @param error - the thrown value (boundary error, typed domain error, or
 *   anything else).
 * @param ctx - the per-request provenance context (method/endpoint/version/
 *   token echo as far as parsing got).
 */
function toRemoteErrorResult(error, ctx) {
    // Invariant 4a: the remote layer's own typed errors keep their code —
    // boundary codes and the mirrored frozen P3 ID codes (deviations D-1/D-3).
    if (isRemoteContractError(error)) {
        const details = error.details;
        const field = details !== undefined && typeof details['field'] === 'string' ? details['field'] : undefined;
        const reason = details !== undefined && typeof details['reason'] === 'string'
            ? details['reason']
            : undefined;
        return buildRemoteError(error.code, error.message, ctx, { field, reason });
    }
    // Invariant 4b (T12-H4): ONLY an error whose string `code` is a member of
    // the closed backing vocabulary passes through with code + message; the
    // source identity rides under details.cause (never its stack, never a live
    // object — lossless-checked under cause.details). An `Error` with an
    // out-of-vocabulary `code` (a Node ENOENT with a path in the message, a
    // synthetic code, …) is NOT a typed domain error — invariant 5 below maps
    // it to internal-error with a generic message and no leak.
    if (error instanceof Error) {
        const typed = error;
        if (isRemoteBackingErrorCode(typed.code)) {
            return buildRemoteError(typed.code, typed.message, ctx, {
                reason: 'domain-error',
                cause: { code: typed.code, message: typed.message },
                sourceDetails: typed.details,
            });
        }
    }
    // Invariant 5: an untyped throw — generic message, no leak.
    return buildRemoteError(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR, 'internal error in remote handler', ctx, { reason: 'untyped-error' });
}
/**
 * Create the throw-proof dispatcher for one deps object.
 * @param deps - the twelve backing ports (injected; no global state).
 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
 */
export function createRemoteDispatcher(deps) {
    const handlers = buildCategoryHandlers(deps);
    return (endpoint, payload) => {
        let ctx = {
            method: endpoint,
            endpoint,
            contractVersion: REMOTE_CONTRACT_VERSION,
            requestToken: null,
        };
        let response;
        try {
            // Invariant 1: unknown endpoint (checked before the envelope).
            if (!isRemoteMethod(endpoint)) {
                throw remoteContractError(REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD, `endpoint '${endpoint}' is not a method of the closed Remote contract v1 catalog`, { reason: 'unknown-endpoint' });
            }
            // Invariant 2: the request envelope (closed: version + params).
            const request = parseRemoteRequest(payload);
            ctx = { ...ctx, contractVersion: request.version };
            // Invariant 3: the method's closed param schema.
            const parsed = parseRemoteMethodParams(endpoint, request.params);
            ctx = { ...ctx, requestToken: parsed.requestToken };
            // Invariants 4/5: the category handler (the backing port call).
            const outcome = handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params);
            // Invariant 6: lossless check + provenance on the success value.
            response = buildRemoteSuccess(outcome.data, {
                ...ctx,
                projectionGeneration: outcome.projectionGeneration ?? null,
                effectSequence: outcome.effectSequence ?? null,
            });
        }
        catch (error) {
            response = toRemoteErrorResult(error, ctx);
        }
        // Invariant 7: the promise never rejects.
        return Promise.resolve(response);
    };
}
//# sourceMappingURL=dispatch.js.map