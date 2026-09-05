/**
 * Start Team from Here — the handoff contract (TaskDoc §11.8 P7-T5;
 * DevPlan §20.5; Architecture §34).
 *
 * Frozen spec, verbatim (the authority for every semantic below):
 *
 * DevPlan §20.5:
 *
 * ```text
 * ordinary Session A
 * → freeze canonical surface
 * → one-shot summary
 * → new TeamIntent
 * → new Root B
 * ```
 *
 * "B 不获得 A live history/search." (B gains no live history/search on A.)
 *
 * Architecture §34.2 (one-shot handoff):
 *
 * ```text
 * Source Session A
 * ↓
 * read frozen current canonical surface
 * ↓
 * one-shot summarize/compress
 * ↓
 * frozen sourced handoff context
 * ↓
 * TeamIntent / new TeamSession B
 * ```
 *
 * Architecture §34.3 (live link explicitly forbidden), after creation:
 *
 * ```text
 * B cannot history_read(A)
 * B cannot search A
 * B does not share A live memory
 * B does not reread A later
 * changes in A do not mutate B handoff
 * ```
 *
 * "`sourceSessionId` 可以作为 provenance/navigation metadata，但不是读取
 * 授权。" (sourceSessionId may serve as provenance/navigation metadata,
 * but it is NOT a read grant.)
 *
 * Architecture §34.4 (handoff summarizer): the summarization route must
 * not depend on the Blueprint Leader model or any Member model — it is a
 * Host/Team creation auxiliary capability. A failure must be surfaced
 * explicitly (Retry / Continue without handoff / Cancel); it must never
 * be silently pretended as a successful handoff.
 *
 * Module rules this file encodes:
 *
 * - the handoff module owns NO MemberInstance/TeamSession creation path
 *   of its own: team creation is delegated to the injected
 *   {@link HandoffTeamCreationPort} (the public Team creation entry; in
 *   production the P6-T1 ActivationProvider public entry — the committed
 *   static scan `packages/runtime/test/p7t5-no-creation-scan.mjs` proves
 *   the module source never imports a creation path);
 * - the source is read through the injected {@link HandoffSourceSurfacePort}
 *   (the public session query/read surface) EXACTLY ONCE per operation
 *   (snapshot once); nothing in the module re-reads the source later
 *   (B does not reread A later);
 * - the frozen handoff context is DETACHED (a deep lossless-JSON copy)
 *   and deep-frozen: later changes in the source do not mutate the
 *   handoff (§34.3);
 * - the handoff context is PURE DATA (lossless JSON, no functions, no
 *   live handles): the target receives NO read grant on the source —
 *   `sourceSessionId` is provenance/navigation metadata only (§34.3);
 * - the one-shot summarization route is an injected
 *   {@link HandoffSummarizerPort} (never the Leader/Member model —
 *   §34.4), and its failure is surfaced with the explicit triad
 *   Retry / Continue without handoff / Cancel (§34.4).
 *
 * Pure contracts module: no I/O, no `node:` builtins, no live Agent,
 * no host environment assumptions.
 * @module @dsh-agent-team/runtime/handoff/types
 */
/**
 * The explicit decision options of a failed one-shot summarization
 * (Architecture §34.4, the verbatim triad: Retry / Continue without
 * handoff / Cancel).
 */
export const HANDOFF_DECISION_OPTIONS = {
    /** Re-run the one-shot summarization from the FROZEN snapshot (the
     *  source is NOT re-read — snapshot once). */
    RETRY: 'retry',
    /** Create the new team WITHOUT the handoff context (the TeamIntent
     *  carries no handoff provenance — §7.2 optional provenance). */
    CONTINUE_WITHOUT_HANDOFF: 'continue-without-handoff',
    /** Abandon the operation; no team is created. */
    CANCEL: 'cancel',
};
//# sourceMappingURL=types.js.map