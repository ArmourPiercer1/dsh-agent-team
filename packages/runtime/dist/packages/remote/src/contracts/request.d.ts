/**
 * The Remote contract v1 request envelope.
 *
 * Every request the client sends through the seam (`POST
 * /<channel>/<endpoint>`, body `{ type: 'client-request', rpcId, method,
 * payload }` — P2-T6 characterization) carries, in `payload`, exactly:
 *
 * ```
 * { "version": <positive integer in SUPPORTED_REMOTE_CONTRACT_VERSIONS>,
 *   "params":  { ...the method's closed param object... } }
 * ```
 *
 * The envelope is CLOSED: unknown top-level fields are rejected
 * (`malformed-request`). Per-method `params` validation lives in
 * `params.ts` — VERSION-AWARE (TCM vNext §15.3): each method's closed
 * field set depends on the request `version` (v1 and v2 of `team.create`
 * differ; `team.admitInitialWork` is v2-only). The envelope parse itself
 * only checks that `version` is a supported integer (`1 | 2`); the
 * version-specific semantics are the param parser's job, so a v1 request
 * to a v2-only method is rejected AFTER this parse, as a typed
 * `method-version-unsupported`.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/request
 */
import { type RemoteSafeRecord } from './remote-safe.js';
/** The closed top-level fields of a remote request envelope. */
export declare const REMOTE_REQUEST_FIELDS: readonly ["params", "version"];
/** A parsed remote request envelope (version + closed params object). */
export interface RemoteRequest {
    /** The remote contract version the client declared (supported). */
    readonly version: number;
    /** The method's param object (per-method validation is separate). */
    readonly params: RemoteSafeRecord;
}
/**
 * Parse the `payload` of one remote request into the typed envelope.
 * @param payload - the raw seam payload (the client's `payload` field).
 * @returns the parsed envelope (lossless-JSON-safe by construction).
 * @throws {RemoteContractError} `malformed-request` when the payload is not
 *   a lossless-JSON-safe closed record, when `version` is missing or not a
 *   positive integer, when `params` is missing or not an object, or when an
 *   unknown top-level field is present; `contract-version-unsupported` when
 *   `version` is a positive integer outside the supported set.
 */
export declare function parseRemoteRequest(payload: unknown): RemoteRequest;
//# sourceMappingURL=request.d.ts.map