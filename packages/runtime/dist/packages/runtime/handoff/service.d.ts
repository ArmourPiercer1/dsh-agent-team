/**
 * Start Team from Here — the handoff service
 * (TaskDoc §11.8 P7-T5; DevPlan §20.5; Architecture §34).
 *
 * The frozen one-shot flow (DevPlan §20.5 / Architecture §34.2):
 *
 * ```text
 * ordinary Session A
 * → freeze canonical surface      (EXACTLY ONE read, §34.2 stage 1)
 * → one-shot summary              (injected §34.4 auxiliary capability)
 * → new TeamIntent                (staged fields + optional provenance,
 *                                   Architecture §7.2)
 * → new Root B / TeamSession B    (DELEGATED to the injected public Team
 *                                   creation entry — the module owns no
 *                                   creation path of its own)
 * ```
 *
 * The §34.3 live-link prohibitions, enforced here:
 *
 * - **snapshot once** — the source surface port is called exactly once
 *   per operation; a same-token replay and a summarization `retry`
 *   re-use the frozen snapshot and never re-read the source;
 * - **B does not reread A later** — the module keeps no accessor that
 *   re-reads the source; the frozen context is the complete source
 *   knowledge of the new team;
 * - **changes in A do not mutate B handoff** — the snapshot is a DETACHED
 *   deep lossless-JSON copy, deep-frozen at materialization;
 * - **B cannot history_read(A) / B cannot search A** —
 *   {@link HandoffService.querySourceHistoryFromTarget} ALWAYS rejects
 *   with `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED`; the presented context
 *   token never grants anything;
 * - **`sourceSessionId` is provenance/navigation metadata, not a read
 *   grant** — the context is pure lossless-JSON data (no functions, no
 *   handles), checked structurally by the tests.
 *
 * The §34.4 failure rule, enforced here: a failed one-shot summarization
 * is CARRIED on the observable state as `awaiting-decision` with the
 * explicit triad Retry / Continue without handoff / Cancel — never thrown
 * away silently, never pretended as a successful handoff. A failed team
 * creation (after the context is frozen) is carried as `creation-failed`;
 * a re-invocation retries the creation idempotently (same stable
 * intentToken, Architecture §18.2).
 *
 * State discipline: the operation registry is IN-MEMORY and
 * process-lifetime — the module owns no durable state; TeamDomain
 * remains the only durable boundary (Architecture §42 invariant 41).
 *
 * Pure orchestration module: no I/O, no `node:` builtins, no live
 * Agent, no creation-path import (see `p7t5-no-creation-scan.mjs`).
 * @module @dsh-agent-team/runtime/handoff/service
 */
import type { HandoffDecisionOption, HandoffOperationRef, HandoffOperationState, HandoffOperationView, HandoffPorts, SourceHistoryQuery, StartTeamFromHereRequest } from './types.js';
/** The handoff service surface (the only public behavior of the module). */
export interface HandoffService {
    /**
     * Start one start-team-from-here operation (DevPlan §20.5 flow).
     *
     * Fresh operation: reads the source canonical surface exactly once,
     * freezes + detaches it, one-shot summarizes it, then creates the new
     * team through the public Team creation entry (delegated).
     *
     * Same-token replay: idempotent — returns the stored state marked
     * `replayed: true` and re-reads NOTHING (completed /
     * completed-without-handoff / canceled / awaiting-decision); a
     * `creation-failed` operation re-drives ONLY the team creation (same
     * stable intentToken) and reports the new state.
     *
     * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED` on an invalid
     *   request; `HANDOFF_SOURCE_SURFACE_UNAVAILABLE` when the source read
     *   fails or delivers a non lossless-JSON surface (the operation
     *   leaves no trace — a later call with the same token is a fresh
     *   operation).
     */
    startTeamFromHere(request: StartTeamFromHereRequest): Promise<HandoffOperationState>;
    /**
     * Resolve an `awaiting-decision` operation with one explicit decision
     * (Architecture §34.4 triad):
     *
     * - `retry` — re-run the one-shot summarization from the FROZEN
     *   snapshot (the source is NOT re-read) and create the team on
     *   success;
     * - `continue-without-handoff` — create the team WITHOUT the handoff
     *   context (the TeamIntent carries no handoff provenance, §7.2);
     * - `cancel` — abandon the operation; no team is created.
     *
     * A decision is one-shot: after it is taken, the operation is
     * finalized (or awaiting again after a failed `retry`).
     *
     * @throws {HandoffError} `HANDOFF_REQUEST_MALFORMED` on an invalid
     *   ref/decision; `HANDOFF_OPERATION_UNKNOWN` for a never-started
     *   operation; `HANDOFF_OPERATION_NOT_DECIDABLE` for a
     *   `creation-failed` state (re-drive it via `startTeamFromHere`);
     *   `HANDOFF_OPERATION_ALREADY_FINALIZED` for a completed / canceled
     *   state.
     */
    resolveHandoffDecision(ref: HandoffOperationRef, decision: HandoffDecisionOption): Promise<HandoffOperationState>;
    /**
     * The target-side source-history guard (Architecture §34.3): ANY
     * attempt by the target team to history-read or search the source
     * session is ALWAYS rejected with
     * `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED` — the handoff boundary
     * carries no read path to the source at all, and the presented
     * context token grants nothing.
     *
     * @param contextToken - the token of the handoff context the target
     *   holds (provenance only — never a read grant).
     * @param query - the attempted source-side query (recorded on the
     *   rejection detail).
     * @throws {HandoffError} `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED` always
     *   (after `HANDOFF_REQUEST_MALFORMED` for a structurally invalid
     *   argument).
     */
    querySourceHistoryFromTarget(contextToken: string, query: SourceHistoryQuery): Promise<never>;
    /**
     * BQ-17 (P8-S7-R4 W2): the READ-ONLY view of one handoff operation —
     * the source Session provenance, the snapshot/summary status, the
     * failure choices/state, and the created team identity. A pure
     * registry read: NO mutation, NO I/O, no source re-read; an unknown
     * (sourceSessionId, requestToken) pair reports `known: false` with a
     * null state (NOT an error — the pair is a valid query shape).
     */
    describeOperation(sourceSessionId: string, requestToken: string): HandoffOperationView;
}
/** One handoff service instance over one fixed port set. */
export declare function createHandoffService(ports: HandoffPorts): HandoffService;
//# sourceMappingURL=service.d.ts.map