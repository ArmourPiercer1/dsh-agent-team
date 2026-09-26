/**
 * team-session-activation — the Team session-activation fence for the DSH
 * 0.1.7-rc.1 restart-recovery repair (guide §3 / §7.2 / §8).
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
 * THE FIVE INVARIANTS (guide §2.2, INV-A..E, fence half)
 * -------------------------------------------------------
 * - INV-A: the only LEGAL activations of a Team-managed session are
 *   (1) the Team glue under its ownership guard (`runOwned`) and
 *   (2) an explicit one-shot ordinary permit (`permitOrdinaryOnce`,
 *   guide §10.1) — every other activation is vetoed at `agent/created`
 *   (guide §8.1).
 * - INV-B: no handle adoption / forgery: a vetoed activation is NEVER
 *   adopted into `liveAgents`; the glue refuses to resume a session whose
 *   writer is held unless the fence CONFIRMS the conflicting activation
 *   was a Team-managed foreign activation that has been intercepted and
 *   rolled back (exact generation disposed).
 * - INV-C: the rollback barrier is EXACT-GENERATION: an
 *   `agent/disposed` settles the barrier only for the very Agent object
 *   the fence vetoed (guide §8.2 — a stale disposer must never unlock a
 *   later generation).
 * - INV-D: no retry before observing the full veto → disposed →
 *   writer-released sequence (guide §7.2: exactly ONE writer conflict +
 *   fence-confirmed foreign activation + exact generation disposed; no
 *   while-retry, no sleep, no backoff, no lock deletion, no blanket
 *   retry — `recoverWriterConflict` is the ONLY wait the glue may
 *   perform, and it is bounded + event-driven).
 * - INV-E: the fence is process-local: no TeamDomain writes, no durable
 *   state, nothing survives a backend restart (the permits are
 *   process-local by contract, guide §3.1/§10.1).
 *
 * STATE (guide §3.1)
 * ------------------
 * - `ownedDepthBySession: Map<string, number>` — a REF-COUNT (never a
 *   plain Set): the same session's activation may nest (helper
 *   composition), the teardown decrements in `finally`, and an inner
 *   completion must never clear the outer guard (test A4).
 * - `foreignRollbacks: Map<string, { agent, disposed }>` — the vetoed
 *   foreign activation per session, keyed by EXACT Agent object (guide
 *   §8.2: `if (record.agent !== disposedAgent) return`).
 * - `ordinaryPermits: Map<string, { expiresAt }>` — the one-shot
 *   ordinary activation permits (guide §3.1/§10.1): process-local,
 *   single-use, TTL-bounded (default 30 s — inside the guide's suggested
 *   10–30 s window), consumed at `agent/created` (NOT at the permit call),
 *   and the Team activation marker (`ownedDepth > 0`) takes priority over
 *   a permit (a Team-owned activation never consumes an ordinary permit).
 *
 * CLOSE SEMANTICS (test A8)
 * -------------------------
 * `close()` (the row-stop backstop): a new `runOwned` REJECTS (the row is
 * stopping — no new Team-owned activation is accepted); every in-flight
 * waiter settles (rollback barriers resolve, writer-conflict waits resolve
 * `false`, record-appearance waits terminate); no dangling promise is left
 * (every deferred is resolved and every timer cleared). `beforeAgentCreated`
 * after `close()` is a NO-OP PASS-THROUGH (the row is being torn down; the
 * upstream rollback of a late ordinary activation is the upstream's own
 * concern — the fence keeps no state past the row).
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
 * applies the SAME ownership rule to EVERY source (guide §8.1: the real
 * emitters are `startup` / `resume`; `clear` / `compact` are reserved — a
 * future emitter must not bypass the owner fence either).
 */
export type TeamSessionStartSource = 'startup' | 'resume' | 'clear' | 'compact';
/**
 * The structural projection of the upstream Agent the fence keys on: the
 * fence reads ONLY the shared id and compares Agent identity by object
 * equality (the exact-generation rule, guide §8.2).
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
 * The veto error (guide §8.1): the stable, greppable message the upstream
 * AgentLoop surfaces when the fence intercepts a foreign activation of a
 * Team-managed session. It deliberately does NOT masquerade as the
 * upstream `SessionAlreadyOwnedError` (guide §8.1: "不要把它冒充
 * SessionAlreadyOwnedError") — the two failures are different failures
 * (a writer conflict vs. a fenced activation) and the S6 diagnostic maps
 * each onto its own closed code.
 */
export declare class TeamSessionActivationInterceptedError extends Error {
    constructor(sessionId: string);
}
/**
 * The closed-fence error: `runOwned` after `close()` (the row is stopping —
 * no new Team-owned activation is accepted, test A8).
 */
export declare class TeamSessionActivationClosedError extends Error {
    constructor();
}
/** The public fence surface (guide §3 interface, `permitOrdinaryOnce` concrete). */
export interface TeamSessionActivationFence {
    /**
     * Wrap one Team glue create/resume (guide §6.1): the ownership guard is
     * held for the whole operation (ref-counted — nested calls on the same
     * session compose, the inner completion never clears the outer guard).
     * A `beforeAgentCreated` that observes `ownedDepth > 0` for the session
     * passes (the Team's own activation, INV-A(1)). REJECTS after `close()`.
     */
    runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T>;
    /**
     * The host's AWAITED `agent/created` listener body (guide §8.1). Order:
     * ownership-unmanaged → pass; Team-owned (ownedDepth > 0) → pass;
     * valid one-shot ordinary permit → consume + pass; otherwise → create
     * the exact-generation rollback record and THROW
     * {@link TeamSessionActivationInterceptedError} (the upstream rejects
     * the create/resume and rolls the unpublished agent back).
     */
    beforeAgentCreated(input: TeamAgentCreatedInput): Promise<void>;
    /**
     * The host's `agent/disposed` listener body (guide §8.2): settles the
     * rollback barrier ONLY for the exact Agent object the fence vetoed
     * (strict generation — a stale/other-generation disposer is ignored).
     */
    onAgentDisposed(agent: TeamActivationAgent): void;
    /**
     * The `ensureLiveAgent` pre-resume barrier (guide §7): wait for a
     * DECLARED foreign rollback of this session to complete (no record →
     * return immediately). Settles on row-stop too (a closed fence leaves
     * no dangling wait).
     */
    awaitRollback(sessionId: string): Promise<void>;
    /**
     * The writer-conflict recovery wait (guide §7.2 — the ONLY wait the
     * glue may perform on a `SessionAlreadyOwnedError`): resolves `true`
     * iff, within the bounded window, (a) a rollback record for the session
     * appears (the fence intercepted the foreign activation that holds the
     * writer) AND (b) the exact foreign generation is disposed (the writer
     * is released). Event-driven (no sleep/backoff/polling); `false` on
     * timeout, on row-stop, or when no fence-vetoed activation appears —
     * the glue then propagates the original error (NO retry).
     * @param options.timeoutMs - the bounded window (default: the fence's
     *   `writerConflictTimeoutMs`, 10 s).
     */
    recoverWriterConflict(sessionId: string, options?: {
        timeoutMs?: number;
    }): Promise<boolean>;
    /**
     * Arm the one-shot ordinary activation permit (guide §10.1, D3 ordinary
     * mode): process-local, single-use, TTL-bounded, consumed at
     * `agent/created` — NEVER at this call (the permit survives until the
     * native open either activates the agent or the TTL expires; a failed
     * open needs no explicit revocation). Re-arming replaces the previous
     * permit (a fresh TTL). The Team activation marker takes priority: a
     * `runOwned` activation of the same session passes via the guard and
     * leaves the permit unconsumed.
     */
    permitOrdinaryOnce(sessionId: string): void;
    /**
     * Bind the durable Team-ownership resolver (guide §4.2 — the host binds
     * it right after the domain open, before any Team activation):
     * `(sessionId) => owningRootSessionId | undefined` (unmanaged →
     * `undefined`). Until a resolver is bound, every session is
     * UNCLASSIFIABLE → `beforeAgentCreated` passes (the only activations
     * reachable before the bind are either ordinary sessions or the Team's
     * own — the latter pass via the `ownedDepth` guard anyway). Later calls
     * replace the resolver.
     */
    bindOwnershipResolver(resolver: (sessionId: string) => string | undefined): void;
    /** The row-stop (idempotent — guide §3, test A8; see the close semantics in the module docs). */
    close(): void;
}
/** The construction inputs of the fence (all optional; the production host passes none or the test clock). */
export interface TeamSessionActivationFenceOptions {
    /** The injectable clock (ms epoch) — test determinism for the permit TTL (A7). Default: `Date.now`. */
    readonly now?: () => number;
    /**
     * The ordinary-permit TTL in ms (guide §3.1: "建议 TTL 10–30 s").
     * Default: 30_000.
     */
    readonly ordinaryPermitTtlMs?: number;
    /**
     * The default bounded window of {@link TeamSessionActivationFence.recoverWriterConflict}
     * in ms. Default: 10_000.
     */
    readonly writerConflictTimeoutMs?: number;
}
/** Default ordinary-permit TTL (guide §3.1 window: 10–30 s). */
export declare const DEFAULT_ORDINARY_PERMIT_TTL_MS = 30000;
/** Default writer-conflict recovery window. */
export declare const DEFAULT_WRITER_CONFLICT_TIMEOUT_MS = 10000;
/**
 * Create the Team session-activation fence (guide §3 factory). Pure state
 * machine — no services, no repositories, no timers beyond the bounded
 * recovery windows (all cleared on settle/close).
 */
export declare function createTeamSessionActivationFence(options?: TeamSessionActivationFenceOptions): TeamSessionActivationFence;
//# sourceMappingURL=team-session-activation.d.ts.map