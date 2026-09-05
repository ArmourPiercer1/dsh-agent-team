/**
 * P8-T4 push model — shared wire/state types of the client-side sync engine.
 *
 * Push model (plan §21.4, "correctness first"): the server side is the
 * frozen P8-T3 contract v1 surface — `team.getProjection` (whole
 * generation: the full `RemoteProjectionValue` + `generation`) and
 * `team.getLedgerPage` (versioned paging). "Push" is therefore a
 * versioned state + deterministic pull: every projection the client
 * receives carries a monotonic generation, and the client applies a
 * frame only when it is strictly newer than the applied generation
 * (Gate G8: a new state must never be overwritten by a stale response).
 *
 * This module is the vocabulary shared by the pure engine modules
 * (`generation`, `pull`, `reconnect`, `ledger-page`) and by the test
 * client / fake server fixtures (`test/p8t4-*`). It defines no behavior.
 *
 * Frozen authorities mirrored here (no redefinition):
 *   - `RemoteResponse` / `RemoteProvenance` (contracts/response)
 *   - `RemoteProjectionValue` / `RemoteLedgerPageValue` (contracts/types)
 *   - stale rule: `isStaleTeamProjection` (packages/contracts, P8-T1)
 *   - reconnect state + backoff bounds (P2-T6 characterization R1–R2)
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/types
 */
import type { RemoteLedgerPageValue, RemoteProjectionValue } from '../contracts/types.js';
import type { RemoteProvenance, RemoteResponse } from '../contracts/response.js';
/**
 * One client→server seam message. The `payload` is the frozen request
 * envelope `{ version, params }` (contracts/request) — the transport
 * carries the envelope opaquely; the server half parses it with the
 * frozen `parseRemoteRequest`.
 */
export interface SeamClientRequest {
    /** The transport-level correlation id (monotonic per client). */
    readonly rpcId: number;
    /** The catalog endpoint (e.g. `team.getProjection`). */
    readonly method: string;
    /** The frozen request envelope `{ version, params }`. */
    readonly payload: Record<string, unknown>;
}
/** One server→client seam message: the frozen `RemoteResponse` result. */
export interface SeamServerResponse {
    /** The correlation id of the answered request. */
    readonly rpcId: number;
    /** The frozen dispatcher result (typed success or typed error). */
    readonly result: RemoteResponse;
}
/**
 * The transport abstraction the engine talks to. A real deployment binds
 * this to the host seam (the `REMOTE_RPC_CHANNEL` connection); the test
 * fixture binds it to the fake server. Transport-level failure (channel
 * loss) is signalled by REJECTING with `PushTransportLossError` — the
 * ONLY rejection kind the engine must special-case; every RPC-level
 * outcome arrives as a typed `RemoteResponse` and never rejects (frozen
 * dispatcher invariant: the promise never rejects).
 */
export interface RemotePushTransport {
    send(request: SeamClientRequest): Promise<SeamServerResponse>;
}
/**
 * The sentinel thrown by a transport when the seam channel is lost.
 * Carries no state, no stack-dependent detail: the engine maps it to the
 * `reconnecting` state + backoff (P2-T6 R1–R2). Never serialized, never
 * sent across the wire — transport failure is a channel property, not a
 * message.
 */
export declare class PushTransportLossError extends Error {
    constructor(message?: string);
}
/**
 * One whole-projection frame as the client consumes it: the frozen
 * projection DTO plus the provenance block that carries the same
 * generation (G8 staleness/origin detection).
 */
export interface RemotePushFrame {
    readonly projection: RemoteProjectionValue;
    readonly provenance: RemoteProvenance;
}
/**
 * The closed verdict of one incoming frame against the applied state:
 *   - `apply`     — strictly newer generation: replace the applied state
 *   - `duplicate` — same generation: idempotent, no state change, the
 *                   invalidation event fires only once (first application)
 *   - `stale`     — older generation: rejected (G8: never overwrite)
 *   - `foreign`   — different teamSessionId: rejected (not this client's
 *                   team)
 */
export type FrameVerdict = 'apply' | 'duplicate' | 'stale' | 'foreign';
/** The applied-state identity the verdict is decided against. */
export interface AppliedProjectionIdentity {
    readonly teamSessionId: string;
    /** `null` before the first frame was applied. */
    readonly generation: number | null;
}
/** The closed assessment of one pull (`sync`) outcome. */
export type ProjectionSyncStatus = FrameVerdict
/** A typed RPC error result arrived (the channel was fine). */
 | 'rpc-error'
/** The channel was lost; the client moved to `reconnecting`. */
 | 'transport-loss'
/**
 * Success result, but the frame is internally inconsistent (missing /
 * non-positive generation, or the data generation disagrees with the
 * provenance generation): rejected, never applied.
 */
 | 'inconsistent';
/** The deterministic assessment of one pulled projection response. */
export interface ProjectionSyncAssessment {
    readonly status: ProjectionSyncStatus;
    /** For `rpc-error`: the frozen typed error code (pass-through). */
    readonly code?: string;
    /** The generation of the received frame, when one was present. */
    readonly receivedGeneration: number | null;
}
/** The two seam states (P2-T6: `connected` / `reconnecting`). */
export type ReconnectState = 'connected' | 'reconnecting';
/**
 * The full client lifecycle state: the two seam states plus `stopped`
 * (before the first start, or after `stop()`). The state-change sink
 * reports transitions between the two seam states only (the frozen
 * vocabulary); `stopped` is a lifecycle fact, not a seam state.
 */
export type PushClientState = 'stopped' | ReconnectState;
/**
 * The exponential backoff configuration (P2-T6 formula):
 * `cap(attempt) = min(maxMs, baseMs · factor^(attempt−1))`, `attempt`
 * starts at 1 on the first loss.
 */
export interface PushBackoffConfig {
    /** The base delay in milliseconds (P2-T6 fixture: 20). */
    readonly baseMs: number;
    /** The growth factor per attempt (P2-T6 fixture: 2). */
    readonly factor: number;
    /** The hard cap in milliseconds (the cap never exceeds this). */
    readonly maxMs: number;
}
/** One scheduled backoff, as recorded in the client log. */
export interface PushBackoffEntry {
    /** The loss attempt number (1-based). */
    readonly attempt: number;
    /** `min(maxMs, baseMs · factor^(attempt−1))`. */
    readonly capMs: number;
    /** The concrete delay within `[capMs/2, capMs]` (P2-T6 R2 bounds). */
    readonly delayMs: number;
    /** The client clock time the backoff was scheduled. */
    readonly atMs: number;
}
/** One anchored page request (the frozen `team.getLedgerPage` params). */
export interface PageAnchorRequest {
    /** The exclusive lower bound: only entries with `sequence > afterSequence`. */
    readonly afterSequence: number;
    /** The page size (frozen bounds: 1..500, default 50). */
    readonly limit: number;
}
/**
 * The closed set of page-rejection reasons (shape violations of the
 * frozen D-5 slicing contract, plus client-side correlation rejections):
 *   - `anchor-mismatch`         — the page answers an anchor other than
 *                                 the tracker's current cursor (a stale /
 *                                 duplicate in-flight response)
 *   - `sequence-before-anchor`  — an entry does not sit after the anchor
 *   - `not-strictly-ascending`  — entry sequences are not strictly
 *                                 ascending
 *   - `page-exceeds-limit`      — more entries than the requested limit
 *   - `cursor-mismatch`         — `nextAfterSequence` is not the last
 *                                 included sequence (or set on an empty
 *                                 page)
 *   - `non-terminal-page-short` — a page with a cursor carries fewer than
 *                                 `limit` entries (the frozen slicer sets
 *                                 the cursor only when a full page remains
 *                                 over)
 *   - `total-negative`          — `total` is negative
 *   - `total-decreased`         — `total` shrank vs. the last seen total
 *                                 (the ledger is append-only)
 *   - `rpc-error`               — the pull itself returned a typed error
 *                                 result
 *   - `rpc-id-mismatch`         — the seam response does not correlate to
 *                                 the page request (uncorrelated pages are
 *                                 never applied)
 *   - `transport-loss`          — the seam channel was lost during the
 *                                 page pull
 */
export type PageRejectReason = 'anchor-mismatch' | 'sequence-before-anchor' | 'not-strictly-ascending' | 'page-exceeds-limit' | 'cursor-mismatch' | 'non-terminal-page-short' | 'total-negative' | 'total-decreased' | 'rpc-error' | 'rpc-id-mismatch' | 'transport-loss';
/** The deterministic check result of one page against its anchor. */
export type PageCheckResult = {
    readonly ok: true;
    readonly entriesCount: number;
    readonly total: number;
} | {
    readonly ok: false;
    readonly reason: PageRejectReason;
};
/** The report of one `fetchPage` round trip. */
export interface PageFetchReport {
    /** The correlation id of the page request. */
    readonly rpcId: number;
    /** Whether the page was accepted into the tracker (cursor advanced). */
    readonly ok: boolean;
    /** The rejection reason, when `ok` is false. */
    readonly reason: PageRejectReason | null;
    /** The received page value (null on `rpc-error`). */
    readonly page: RemoteLedgerPageValue | null;
}
//# sourceMappingURL=types.d.ts.map