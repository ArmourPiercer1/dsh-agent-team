/**
 * The Remote contract v1 response envelope + provenance.
 *
 * The dispatcher (see `handlers/dispatch.ts`) returns exactly one of:
 *
 * ```
 * // success — every value carries provenance (G8):
 * { "ok": true,
 *   "value": { "data": <typed method value>,
 *              "provenance": {
 *                "origin": "team-remote",
 *                "method": "<catalog method>",
 *                "endpoint": "<seam endpoint>",
 *                "contractVersion": 1,
 *                "requestToken": "<echo>" | null,
 *                "projectionGeneration": <number> | null,
 *                "effectSequence": <number> | null
 *              } } }
 *
 * // failure — typed code + message, never a raw exception:
 * { "ok": false,
 *   "error": { "code": "<closed code>",
 *              "message": "<wire message>",
 *              "details": { "method", "endpoint", "contractVersion",
 *                           "requestToken", "field"? , "reason"?, "cause"? } } }
 * ```
 *
 * Provenance semantics (design note §5):
 * - `origin` — the fixed package origin marker (`team-remote`), so UI state
 *   can attribute its source;
 * - `method` / `endpoint` — the catalog method that served the request
 *   (they are equal by construction);
 * - `contractVersion` — the version that served the request;
 * - `requestToken` — request echo for the token-carrying methods
 *   (member.create/send/followup, handoff.create) — the client matches
 *   async replies to its own logical operations (Architecture §18.2);
 * - `projectionGeneration` — the whole-projection generation
 *   (team.getProjection): the client detects stale responses by comparing
 *   against its last accepted generation for the same team session
 *   (the frozen `isStaleTeamProjection` discipline, P8-T1);
 * - `effectSequence` — the durable effect sequence when the underlying
 *   action has one (admission outcomes).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/response
 */
import { REMOTE_CONTRACT_VERSION } from './version.js';
import { assertRemoteSafeJsonValue, toRemoteSafeDetail, } from './remote-safe.js';
/** The fixed origin marker of the Remote surface. */
export const REMOTE_ORIGIN = 'team-remote';
/**
 * Build a success result: lossless-JSON-checks `data` and attaches the
 * provenance block.
 * @param data - the typed method value (checked before the reply is built).
 * @param ctx - the per-request provenance context.
 * @throws {RemoteContractError} `internal-error` when `data` is not
 *   lossless-JSON safe (a backing port returned an unsafe value).
 */
export function buildRemoteSuccess(data, ctx) {
    const checkedData = assertRemoteSafeJsonValue(data, 'value.data');
    const provenance = {
        origin: REMOTE_ORIGIN,
        method: ctx.method,
        endpoint: ctx.endpoint,
        contractVersion: ctx.contractVersion,
        requestToken: ctx.requestToken,
        projectionGeneration: ctx.projectionGeneration === undefined ? null : ctx.projectionGeneration,
        effectSequence: ctx.effectSequence === undefined ? null : ctx.effectSequence,
    };
    return { ok: true, value: { data: checkedData, provenance } };
}
/**
 * Build an error result: typed code + message + structured details (with
 * the provenance fields folded into `details` so the client can attribute
 * the failure).
 * @param code - the closed error code.
 * @param message - the wire message.
 * @param ctx - the per-request provenance context.
 * @param extra - optional extra detail fields (`field`, `reason`, `cause`,
 *   and the source error's details, lossless-checked under `cause.details`).
 */
export function buildRemoteError(code, message, ctx, extra) {
    const details = {
        method: ctx.method,
        endpoint: ctx.endpoint,
        contractVersion: ctx.contractVersion,
        requestToken: ctx.requestToken,
        ...(extra?.field !== undefined ? { field: extra.field } : {}),
        ...(extra?.reason !== undefined ? { reason: extra.reason } : {}),
        ...(extra?.cause !== undefined
            ? {
                cause: {
                    code: extra.cause.code,
                    message: extra.cause.message,
                    ...(extra.sourceDetails !== undefined
                        ? { details: toRemoteSafeDetail(extra.sourceDetails) }
                        : {}),
                },
            }
            : {}),
    };
    return { ok: false, error: { code, message, details } };
}
/** The contract version constant re-exported for response builders. */
export { REMOTE_CONTRACT_VERSION as REMOTE_SERVED_VERSION };
//# sourceMappingURL=response.js.map