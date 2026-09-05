/**
 * P8-S7-R4 A28 wiring — the two pure halves of the handoff production
 * ports (Architecture §34.2 stage 1 + §34.4):
 *
 * - {@link readCanonicalSourceSurface} — the EXACTLY-ONE freeze read of
 *   the source session's canonical surface, through the DSH public
 *   `sessionQuery` service (the public session-read authority — no
 *   private upstream import; the service arrives through an injected
 *   port).
 * - {@link summarizeSourceSurface} — the one-shot NON-MODEL
 *   deterministic digest of a frozen surface (no model call, no I/O,
 *   no clock read: the digest is a pure function of the frozen input).
 *
 * Both return lossless-JSON (remote-safe) values, so the results cross
 * into the frozen handoff context as pure data — never as a live handle
 * (Architecture §34.3: after creation B cannot reread A; the surface
 * read happens exactly once, at handoff start).
 *
 * Pure module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected {@link SessionQueryPort}).
 * @module @dsh-agent-team/runtime/plugin/handoff-surface
 */
import type { HandoffSummary, SourceCanonicalSurface } from '../../handoff/types.js';
/** A structural view of one model-facing content block (the text half). */
export interface HandoffContentBlockView {
    readonly type: string;
    readonly text?: string;
}
/** A structural view of one model message (the content half). */
export interface HandoffMessageView {
    readonly content: readonly HandoffContentBlockView[];
}
/** A structural view of one canonical-surface event (the payload half). */
export interface HandoffSurfaceEventView {
    readonly type: string;
    readonly seq: number;
    readonly time: number;
    readonly data: unknown;
}
/** A structural view of one session header (the identity + creation half). */
export interface HandoffSessionHeaderView {
    readonly id: string;
    readonly createdAt: number;
}
/** A structural view of `sessionQuery.readSurface`'s observation. */
export interface HandoffSurfaceSnapshotView {
    readonly session: HandoffSessionHeaderView;
    readonly capturedThroughSeq: number | null;
    readonly events: readonly HandoffSurfaceEventView[];
}
/** A structural view of one batch title-observation result (per-session isolated failure). */
export type HandoffTitleObservationResultView = {
    readonly status: 'fulfilled';
    readonly value: {
        readonly session?: HandoffSessionHeaderView;
        readonly title?: {
            readonly title: string;
        };
    };
} | {
    readonly status: 'rejected';
    readonly reason: unknown;
};
/**
 * The public session-read authority as consumed by the handoff wiring —
 * the DSH `sessionQuery` service's two read-only methods.
 */
export interface SessionQueryPort {
    /**
     * Read one session's current model surface from one corpus observation.
     * @param sessionId - the session to read (live-preferred).
     * @returns the cloned header, the capture bound, and the current surface.
     * @throws when source resolution fails or the surface is invalid.
     */
    readSurface(sessionId: string): Promise<HandoffSurfaceSnapshotView>;
    /**
     * Fold titles for the given sessions from one corpus observation.
     * Operational failures stay isolated per session (a `rejected` result,
     * not a thrown error, for a per-session failure).
     * @param sessionIds - the sessions to observe (input order preserved).
     * @returns one ordered result per requested session.
     */
    readTitleSnapshots(sessionIds: readonly string[]): Promise<readonly HandoffTitleObservationResultView[]>;
}
/**
 * Freeze the source session's canonical surface (Architecture §34.2,
 * first stage) — the handoff operation's EXACTLY-ONE read of the source:
 *
 * - `readSurface` is called exactly once (the surface fold is the
 *   authority for what B may know about A);
 * - the title is a best-effort navigation aid (a per-session title
 *   rejection or a titleless log yields `null` and never fails the
 *   handoff);
 * - the result is a lossless-JSON value (messages keep their model-
 *   visible text only; no live handles cross).
 *
 * @param query - the public session-read authority (DSH `sessionQuery`).
 * @param sourceSessionId - the ordinary source DSH session id.
 * @returns the frozen canonical surface.
 * @throws when the surface read itself fails (the handoff operation
 *   then reports its creation-failure triad per Architecture §34.4).
 */
export declare function readCanonicalSourceSurface(query: SessionQueryPort, sourceSessionId: string): Promise<SourceCanonicalSurface>;
/**
 * Produce the one-shot handoff summary (Architecture §34.2 stage 2,
 * §34.4) — a PURE deterministic function of the frozen surface: no
 * model call, no I/O, no clock read, no randomness. The same frozen
 * surface always yields the same summary (idempotent re-runs of the
 * handoff operation therefore never observe a drifting digest).
 *
 * @param surface - the frozen canonical source surface.
 * @returns the one-line title plus the bounded context bullets.
 */
export declare function summarizeSourceSurface(surface: SourceCanonicalSurface): HandoffSummary;
//# sourceMappingURL=handoff-surface.d.ts.map