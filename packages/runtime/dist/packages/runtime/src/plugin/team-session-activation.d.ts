/**
 * team-session-activation — the Team session-activation fence for the DSH
 * 0.1.7-rc.1 restart-recovery repair (C1 guide §3/§7.2/§8; supplement
 * guide §1 INV-1..INV-7 / §2.1).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * A restarted host can have TWO activation sources for the SAME Team-owned
 * session: the Team glue (boot / `ensureLiveAgent` / the child factory /
 * the dynamic-root start) and the ordinary (non-Team) SessionController
 * resume path (an "open in ordinary mode" click, a plain session resume
 * from the UI). DSH 0.1.7 makes `agent/created` an AWAITED serial event
 * (the listener's rejection propagates into the create/resume and the
 * AgentLoop rolls the unpublished agent back into `agent/disposed`) — that
 * awaited seam is the fence's veto point: exactly ONE of the two activation
 * sources may own a Team-managed session, and the Team is its owner.
 *
 * OWNERSHIP MODEL (supplement guide §1 — the PASS authority is CAUSAL)
 * --------------------------------------------------------------------
 * - INV-2/3: a Team activation is identified at `agent/created` by its
 *   EXACT Agent object (the `claimOwnedGeneration` claim the Team glue's
 *   `AgentSetup` wrapper registers when it receives the real
 *   `setupAgent` — setup provably runs BEFORE the `agent/created`
 *   announce in the 0.1.7 lifecycle, Commit-4 defect evidence). The
 *   ref-counted `ownedDepth` guard is NO LONGER a PASS authority — it
 *   only (a) books the nested `runOwned` lifetime and (b) gates claim
 *   acceptance (a claim made OUTSIDE a `runOwned` guard is ignored —
 *   the claim API cannot be abused from outside the Team glue).
 * - INV-4: "ownership resolver not bound" is CLASSIFICATION PENDING, not
 *   "unmanaged": `agent/created` before the resolver bind AWAITs the
 *   `ownershipReady` barrier (racing the row-stop), then classifies.
 *   Ordinary sessions resolve unmanaged and pass (upstream-equivalent);
 *   Team sessions are then vetoed. An exact matching claim is
 *   SELF-PROVING and skips the wait (the glue's own activation never
 *   blocks on the domain open).
 * - INV-5: rollback completion is OBSERVABLE AFTER THE RECORD IS GONE:
 *   each session carries a monotonic `completedEpoch`; a veto mints
 *   epoch N on its record, the exact disposal bumps `completedEpoch` to
 *   N and clears `current`. The Agent object is NOT retained long-term
 *   (tombstone = the epoch). `recoverWriterConflict(afterEpoch,
 *   deadlineMs)` returns true as soon as `completedEpoch > afterEpoch`
 *   — including for a rollback that COMPLETED BEFORE the Team resume's
 *   writer-held catch runs (the TOCTOU the pre-supplement "delete on
 *   dispose" model missed).
 * - INV-6: recovery is ONE ABSOLUTE DEADLINE: `deadline = now() +
 *   timeoutMs` is computed once (by the glue); both stages (record
 *   appearance + exact disposal) consume only `deadline - now()` —
 *   the wait can never stretch to two full windows.
 *
 * THE FIVE INVARIANTS (C1 guide §2.2, INV-A..E, fence half)
 * ---------------------------------------------------------
 * - INV-A: the only LEGAL activations of a Team-managed session are
 *   (1) the Team glue's EXACT claimed generation and (2) an explicit
 *   one-shot ordinary permit (`permitOrdinaryOnce`, C1 guide §10.1) —
 *   every other activation is vetoed at `agent/created` (C1 guide §8.1).
 * - INV-B: no handle adoption / forgery: a vetoed activation is NEVER
 *   adopted into `liveAgents`; the glue refuses to resume a session whose
 *   writer is held unless the fence CONFIRMS the conflicting activation
 *   was a Team-managed foreign activation that has been intercepted and
 *   rolled back (exact generation disposed / its epoch completed).
 * - INV-C: the rollback barrier is EXACT-GENERATION: an
 *   `agent/disposed` settles the barrier only for the very Agent object
 *   the fence vetoed (C1 guide §8.2 — a stale disposer must never unlock
 *   a later generation).
 * - INV-D: no retry before observing the full veto → disposed →
 *   writer-released sequence (C1 guide §7.2: exactly ONE writer conflict
 *   + fence-confirmed foreign activation + exact generation disposed;
 *   no while-retry, no sleep, no backoff, no lock deletion —
 *   `recoverWriterConflict` is the ONLY wait the glue may perform, and
 *   it is bounded by a single absolute deadline).
 * - INV-E: the fence is process-local: no TeamDomain writes, no durable
 *   state, nothing survives a backend restart (the permits are
 *   process-local by contract, C1 guide §3.1/§10.1).
 *
 * STATE
 * -----
 * - `ownedDepthBySession: Map<string, number>` — a REF-COUNT (never a
 *   plain Set): the same session's activation may nest (helper
 *   composition), the teardown decrements in `finally`, and an inner
 *   completion must never clear the outer guard (test A4). Bookkeeping +
 *   claim-acceptance gate ONLY — never a PASS authority (supplement
 *   guide §2.1-B).
 * - `ownedGenerationBySession: Map<string, TeamActivationAgent>` — the
 *   exact Team generation claim per session (supplement INV-3). One
 *   claim per session (the glue's per-SID single-flight guarantees one
 *   in-flight activation); consumed at the PASS, released on setup
 *   failure, cleared at close.
 * - `rollbackStates: Map<string, SessionRollbackState>` — per session:
 *   `{ nextEpoch, completedEpoch, current? }` (supplement INV-5 — the
 *   epoch/tombstone model replacing the old delete-on-dispose record).
 * - `ordinaryPermits: Map<string, { expiresAt }>` — the one-shot
 *   ordinary activation permits (C1 guide §3.1/§10.1): process-local,
 *   single-use, TTL-bounded (default 30 s — inside the guide's suggested
 *   10–30 s window), consumed at `agent/created` (NOT at the permit
 *   call), and the exact Team claim takes priority over a permit (a
 *   Team-owned activation never consumes an ordinary permit).
 *
 * CLOSE SEMANTICS (test A8; supplement §2.1-E)
 * --------------------------------------------
 * `close()` (the row-stop backstop): a new `runOwned` REJECTS (the row is
 * stopping — no new Team-owned activation is accepted); the
 * ownership-ready waiters settle (they wake and pass through the closed
 * check); every rollback barrier resolves; every record waiter ends with
 * `undefined`; generation claims, ordinary permits and guard ref-counts
 * are cleared; no dangling promise or timer survives (every deferred is
 * resolved and every timer cleared). `beforeAgentCreated` after `close()`
 * is a NO-OP PASS-THROUGH (the row is being torn down; the upstream
 * rollback of a late ordinary activation is the upstream's own concern —
 * the fence keeps no state past the row).
 *
 * Scanned by the P4-T6 zero-Team-SessionEvent audit (zero denylist
 * vocabulary — this module carries none).
 *
 * @module @dsh-agent-team/runtime/plugin/team-session-activation
 */
/**
 * The upstream `agent/created` payload's start source (the frozen
 * `SessionStartSource` of @deepseek-ai/dsh-agent — mirrored structurally
 * so this module stays import-free of the upstream package). The fence
 * applies the SAME ownership rule to EVERY source (C1 guide §8.1: the
 * real emitters are `startup` / `resume`; `clear` / `compact` are
 * reserved — a future emitter must not bypass the owner fence either).
 */
export type TeamSessionStartSource = 'startup' | 'resume' | 'clear' | 'compact';
/**
 * The structural projection of the upstream Agent the fence keys on: the
 * fence reads ONLY the shared id and compares Agent identity by object
 * equality (the exact-generation rule, C1 guide §8.2 / supplement INV-3).
 */
export interface TeamActivationAgent {
    readonly id: string;
}
/** The `agent/created` payload the host listener forwards to the fence. */
export interface TeamAgentCreatedInput {
    readonly agent: TeamActivationAgent;
    readonly source: TeamSessionStartSource;
    /**
     * The upstream AbortSignal of the activation (carried for interface
     * fidelity with the awaited serial payload — the fence's decision is
     * total for a live activation: it either passes or vetoes; an aborted
     * activation is the upstream's own no-op, so the signal is accepted and
     * not consumed).
     */
    readonly signal?: AbortSignal;
}
/**
 * The veto error (C1 guide §8.1): the stable, greppable message the
 * upstream AgentLoop surfaces when the fence intercepts a foreign
 * activation of a Team-managed session. It deliberately does NOT
 * masquerade as the upstream `SessionAlreadyOwnedError` (C1 guide §8.1:
 * "不要把它冒充 SessionAlreadyOwnedError") — the two failures are
 * different failures (a writer conflict vs. a fenced activation) and the
 * S6 diagnostic maps each onto its own closed code.
 */
export declare class TeamSessionActivationInterceptedError extends Error {
    constructor(sessionId: string);
}
/**
 * The closed-fence error: `runOwned` after `close()` (the row is stopping
 * — no new Team-owned activation is accepted, test A8).
 */
export declare class TeamSessionActivationClosedError extends Error {
    constructor();
}
/** The public fence surface (C1 guide §3 + supplement §2.1). */
export interface TeamSessionActivationFence {
    /**
     * Wrap one Team glue create/resume (C1 guide §6.1): the ownership guard
     * is held for the WHOLE AWAITED operation lifetime (ref-counted —
     * nested calls on the same session compose, the inner completion never
     * clears the outer guard). The guard books the lifetime and gates
     * `claimOwnedGeneration` acceptance — it is NOT itself the PASS
     * authority (supplement INV-3: the exact claim is). REJECTS after
     * `close()`.
     */
    runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T>;
    /**
     * The host's AWAITED `agent/created` listener body (C1 guide §8.1 +
     * supplement §2.1-B decision order):
     *   1. closed → pass-through (row teardown);
     *   2. resolver unbound → AWAIT `ownershipReady` (classification
     *      PENDING — never "unmanaged"), unless the exact Team claim for
     *      this session is already present (the claim is self-proving);
     *   3. classify: unmanaged → pass (ordinary sessions pass
     *      upstream-equivalently, even after waiting for the bind);
     *   4. exact claimed Team generation → consume the claim + pass;
     *   5. valid one-shot ordinary permit → consume + pass (an EXPIRED
     *      permit is dropped and falls through);
     *   6. foreign Team-managed activation → mint the epoch rollback
     *      record + THROW {@link TeamSessionActivationInterceptedError}
     *      (the upstream rejects the create/resume and rolls the
     *      unpublished agent back).
     */
    beforeAgentCreated(input: TeamAgentCreatedInput): Promise<void>;
    /**
     * The Team glue's generation claim (supplement INV-3): register the
     * EXACT Agent object the glue's `AgentSetup` wrapper received as
     * `setupAgent` — the object 0.1.7 will later announce through
     * `agent/created` (setup runs before the announce: Commit-4 in-host
     * evidence). ACCEPTED ONLY while a `runOwned` guard is held for the
     * session (claim-acceptance gate — an external caller without the
     * guard gets no pass authority); a re-claim replaces the previous
     * one (the glue's per-SID single-flight keeps at most one in-flight
     * claim per session in practice). Consumed at the PASS, released via
     * {@link releaseOwnedGeneration} on setup failure, cleared at close.
     */
    claimOwnedGeneration(sessionId: string, agent: TeamActivationAgent): void;
    /**
     * The setup-failure claim release (supplement §2.2-C: "setup 失败时
     * claim 不泄漏"): drops the claim iff it still holds THIS Agent
     * object (a claim already consumed by the PASS or replaced is
     * untouched). No-op when absent.
     */
    releaseOwnedGeneration(sessionId: string, agent: TeamActivationAgent): void;
    /**
     * The host's `agent/disposed` listener body (C1 guide §8.2): settles
     * the rollback barrier ONLY for the exact Agent object the fence
     * vetoed (strict generation — a stale/other-generation disposer is
     * ignored), bumps the session's `completedEpoch` to the record's
     * epoch and clears `current` (the tombstone survives — supplement
     * INV-5).
     */
    onAgentDisposed(agent: TeamActivationAgent): void;
    /**
     * The `ensureLiveAgent` pre-resume barrier (C1 guide §7): wait for a
     * DECLARED foreign rollback of this session to complete (no pending
     * record → return immediately). Settles on row-stop too (a closed
     * fence leaves no dangling wait).
     */
    awaitRollback(sessionId: string): Promise<void>;
    /**
     * The completed-rollback epoch of a session (supplement INV-5): the
     * highest epoch whose exact generation the fence observed disposed.
     * The glue snapshots this BEFORE its first resume and passes it as
     * `afterEpoch` to {@link recoverWriterConflict} — a completed rollback
     * with `epoch > afterEpoch` proves the writer was released even though
     * the record is already gone (the TOCTOU fix).
     */
    getRollbackEpoch(sessionId: string): number;
    /**
     * The writer-conflict recovery wait (C1 guide §7.2 — the ONLY wait the
     * glue may perform on a `SessionAlreadyOwnedError`; supplement
     * INV-5/INV-6): resolves `true` iff (a) a rollback record for the
     * session with `epoch > afterEpoch` appears (the fence intercepted the
     * foreign activation that holds the writer) AND (b) the exact foreign
     * generation is disposed (the writer released) — or `completedEpoch`
     * already exceeds `afterEpoch` (the handoff COMPLETED before this
     * call: true immediately, no waiting). ALL waits share ONE absolute
     * deadline (`deadlineMs`, an epoch-ms timestamp computed by the glue
     * as `Date.now() + timeoutMs` — each stage consumes only
     * `deadline - now()`, never a fresh window). Event-driven (no
     * sleep/backoff/polling); `false` on deadline, on row-stop, or when no
     * qualifying fence-vetoed activation appears — the glue then
     * propagates the original error (NO retry).
     * @param options.afterEpoch - the epoch baseline snapshotted before the
     *   first resume (default 0).
     * @param options.deadlineMs - the ABSOLUTE deadline as an epoch-ms
     *   timestamp (default: `now() + writerConflictTimeoutMs`).
     */
    recoverWriterConflict(sessionId: string, options?: {
        afterEpoch?: number;
        deadlineMs?: number;
    }): Promise<boolean>;
    /**
     * Arm the one-shot ordinary activation permit (C1 guide §10.1, D3
     * ordinary mode): process-local, single-use, TTL-bounded, consumed at
     * `agent/created` — NEVER at this call (the permit survives until the
     * native open either activates the agent or the TTL expires; a failed
     * open needs no explicit revocation). Re-arming replaces the previous
     * permit (a fresh TTL). The exact Team claim takes priority: a claimed
     * Team activation of the same session passes via the claim and leaves
     * the permit unconsumed.
     */
    permitOrdinaryOnce(sessionId: string): void;
    /**
     * Bind the durable Team-ownership resolver (C1 guide §4.2 — the host
     * binds it right after the domain open, before any Team activation):
     * `(sessionId) => owningRootSessionId | undefined` (unmanaged →
     * `undefined`). Binding ALSO settles the `ownershipReady` barrier
     * (supplement INV-4): every `agent/created` that was pending
     * classification wakes and classifies now. Until a resolver is bound,
     * sessions are CLASSIFICATION PENDING (never "unmanaged" —
     * `beforeAgentCreated` awaits the bind), with the single exception of
     * an exact Team claim (self-proving — it passes without waiting).
     * Later calls replace the resolver (the barrier stays settled).
     */
    bindOwnershipResolver(resolver: (sessionId: string) => string | undefined): void;
    /** The row-stop (idempotent — C1 guide §3, test A8; see the close semantics in the module docs). */
    close(): void;
}
/** The construction inputs of the fence (all optional; the production host passes none or the test clock). */
export interface TeamSessionActivationFenceOptions {
    /** The injectable clock (ms epoch) — test determinism for the permit TTL (A7) and the recovery deadline (A15). Default: `Date.now`. */
    readonly now?: () => number;
    /**
     * The ordinary-permit TTL in ms (C1 guide §3.1: "建议 TTL 10–30 s").
     * Default: 30_000.
     */
    readonly ordinaryPermitTtlMs?: number;
    /**
     * The default bounded window of {@link TeamSessionActivationFence.recoverWriterConflict}
     * in ms (used only when the caller passes no absolute deadline).
     * Default: 10_000.
     */
    readonly writerConflictTimeoutMs?: number;
}
/** Default ordinary-permit TTL (C1 guide §3.1 window: 10–30 s). */
export declare const DEFAULT_ORDINARY_PERMIT_TTL_MS = 30000;
/** Default writer-conflict recovery window. */
export declare const DEFAULT_WRITER_CONFLICT_TIMEOUT_MS = 10000;
/**
 * Create the Team session-activation fence (C1 guide §3 factory). Pure
 * state machine — no services, no repositories, no timers beyond the
 * bounded recovery windows (all cleared on settle/close).
 */
export declare function createTeamSessionActivationFence(options?: TeamSessionActivationFenceOptions): TeamSessionActivationFence;
//# sourceMappingURL=team-session-activation.d.ts.map