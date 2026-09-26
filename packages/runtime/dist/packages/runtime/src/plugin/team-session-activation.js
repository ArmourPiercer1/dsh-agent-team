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
 * The veto error (guide §8.1): the stable, greppable message the upstream
 * AgentLoop surfaces when the fence intercepts a foreign activation of a
 * Team-managed session. It deliberately does NOT masquerade as the
 * upstream `SessionAlreadyOwnedError` (guide §8.1: "不要把它冒充
 * SessionAlreadyOwnedError") — the two failures are different failures
 * (a writer conflict vs. a fenced activation) and the S6 diagnostic maps
 * each onto its own closed code.
 */
export class TeamSessionActivationInterceptedError extends Error {
    constructor(sessionId) {
        super(`dsh-agent-team: intercepted foreign Agent activation for Team-managed session "${sessionId}"`);
        this.name = 'TeamSessionActivationInterceptedError';
    }
}
/**
 * The closed-fence error: `runOwned` after `close()` (the row is stopping —
 * no new Team-owned activation is accepted, test A8).
 */
export class TeamSessionActivationClosedError extends Error {
    constructor() {
        super('dsh-agent-team: the Team session activation fence is closed (row stop) — no new Team-owned activation is accepted');
        this.name = 'TeamSessionActivationClosedError';
    }
}
/** Default ordinary-permit TTL (guide §3.1 window: 10–30 s). */
export const DEFAULT_ORDINARY_PERMIT_TTL_MS = 30_000;
/** Default writer-conflict recovery window. */
export const DEFAULT_WRITER_CONFLICT_TIMEOUT_MS = 10_000;
function createDeferred() {
    let resolveFn = () => undefined;
    let rejectFn = () => undefined;
    let settled = false;
    const promise = new Promise((resolve, reject) => {
        resolveFn = (value) => {
            if (settled)
                return;
            settled = true;
            resolve(value);
        };
        rejectFn = (error) => {
            if (settled)
                return;
            settled = true;
            reject(error);
        };
    });
    return {
        promise,
        get settled() {
            return settled;
        },
        resolve: resolveFn,
        reject: rejectFn,
    };
}
/**
 * Create the Team session-activation fence (guide §3 factory). Pure state
 * machine — no services, no repositories, no timers beyond the bounded
 * recovery windows (all cleared on settle/close).
 */
export function createTeamSessionActivationFence(options = {}) {
    const now = options.now ?? Date.now;
    const permitTtlMs = options.ordinaryPermitTtlMs === undefined ? DEFAULT_ORDINARY_PERMIT_TTL_MS : options.ordinaryPermitTtlMs;
    const defaultWriterConflictTimeoutMs = options.writerConflictTimeoutMs === undefined
        ? DEFAULT_WRITER_CONFLICT_TIMEOUT_MS
        : options.writerConflictTimeoutMs;
    // ── closure state (guide §3.1) ──────────────────────────────────────────
    /** The Team activation guard per session — a REF-COUNT (test A4). */
    const ownedDepthBySession = new Map();
    /** The vetoed foreign activations per session (exact-generation records). */
    const foreignRollbacks = new Map();
    const recordWaiters = new Map();
    /** The one-shot ordinary activation permits (guide §3.1). */
    const ordinaryPermits = new Map();
    /** The row-stop gate (set once, never cleared). */
    let closed = false;
    /** The bound durable-ownership resolver (guide §4.2; unbound = unclassifiable). */
    let ownershipResolver;
    /** Resolves at `close()` — the close signal every bounded wait races. */
    const closedDeferred = createDeferred();
    // ── helpers ─────────────────────────────────────────────────────────────
    /**
     * Wait for a rollback record of `sid` to appear (or observe one that
     * already exists). Resolves with the record, or `undefined` on timeout /
     * row-stop (no record can appear after close). Bounded + event-driven.
     */
    function awaitRecordAppearance(sid, timeoutMs) {
        if (closed)
            return Promise.resolve(undefined);
        const existing = foreignRollbacks.get(sid);
        if (existing !== undefined)
            return Promise.resolve(existing);
        return new Promise((resolve) => {
            let timer;
            let finished = false;
            const finish = (record) => {
                if (finished)
                    return;
                finished = true;
                if (timer !== undefined)
                    clearTimeout(timer);
                const waiters = recordWaiters.get(sid);
                if (waiters !== undefined) {
                    waiters.delete(finish);
                    if (waiters.size === 0)
                        recordWaiters.delete(sid);
                }
                resolve(record);
            };
            if (timeoutMs > 0) {
                timer = setTimeout(() => finish(undefined), timeoutMs);
            }
            let waiters = recordWaiters.get(sid);
            if (waiters === undefined) {
                waiters = new Set();
                recordWaiters.set(sid, waiters);
            }
            waiters.add(finish);
        });
    }
    /**
     * Wait for ONE rollback record's exact-generation disposal within the
     * bounded window. `true` iff the exact agent was disposed (the writer
     * released); `false` on timeout or row-stop.
     */
    function awaitDisposal(record, timeoutMs) {
        if (closed)
            return Promise.resolve(false);
        return new Promise((resolve) => {
            let timer;
            let finished = false;
            const finish = (value) => {
                if (finished)
                    return;
                finished = true;
                if (timer !== undefined)
                    clearTimeout(timer);
                resolve(value);
            };
            if (timeoutMs > 0) {
                timer = setTimeout(() => finish(false), timeoutMs);
            }
            void record.disposed.promise.then(() => finish(true));
            void closedDeferred.promise.then(() => finish(false));
        });
    }
    /** Notify the in-flight record waits of `sid` that a record appeared. */
    function notifyRecordAppeared(sid, record) {
        const waiters = recordWaiters.get(sid);
        if (waiters === undefined)
            return;
        for (const waiter of [...waiters])
            waiter(record);
    }
    // ── the fence surface (guide §3) ────────────────────────────────────────
    return {
        async runOwned(sessionId, operation) {
            const sid = String(sessionId);
            if (closed) {
                // test A8: a new runOwned after close REJECTS (async rejection —
                // the caller's `await` sees it in its own catch).
                throw new TeamSessionActivationClosedError();
            }
            ownedDepthBySession.set(sid, (ownedDepthBySession.get(sid) ?? 0) + 1);
            try {
                // COMMIT-4 DEFECT FIX (0.1.7 real-host kit, World A boot-gate FATAL,
                // evidence/restart-017rc1/commit4/DEFECT-c1-runOwned-guard-lifetime.md):
                // `runOwned` MUST be async and `return await operation()` — a
                // SYNCHRONOUS `return operation()` fires the `finally` decrement
                // the moment the operation PROMISE IS RETURNED (after the
                // operation's synchronous prefix only), while the 0.1.7
                // AWAITED-serial `agent/created` seam fires several AWAITED hops
                // later (in-host verified: createAgent → setupAndPublish →
                // initializeAgent → runMaintenance → publish → announce →
                // ctx.serial) — the fence then read ownedDepth=0 for the Team's
                // OWN activation and vetoed it (bootstrap FATAL on every fresh
                // home). With `await`, the guard spans the operation's FULL
                // AWAITED LIFETIME (regression test A9 pins the real host shape).
                return await operation();
            }
            finally {
                // guide §3.1 pseudocode, verbatim semantics: decrement in finally
                // (AFTER the operation settles — the async/await is what makes
                // "finally = teardown of the activation lifetime" true); the
                // inner completion never clears the outer guard (test A4).
                const next = (ownedDepthBySession.get(sid) ?? 1) - 1;
                if (next === 0)
                    ownedDepthBySession.delete(sid);
                else
                    ownedDepthBySession.set(sid, next);
            }
        },
        async beforeAgentCreated(input) {
            const sid = String(input.agent.id);
            // Row-stop: the fence keeps no state past the row — a late
            // activation is the upstream's own teardown concern (no-op pass-
            // through; the row's own agents are disposed by the row backstop).
            if (closed)
                return;
            // (guide §8.1) 1. ownership classification: unmanaged → pass.
            // (unbound resolver → unclassifiable → pass: only ordinary sessions
            // and the Team's own activations are reachable before the bind.)
            const owner = ownershipResolver?.(sid);
            if (owner === undefined)
                return;
            // (guide §8.1) 2. the Team's own activation (the runOwned guard) →
            // pass. The marker takes PRIORITY over an ordinary permit (the
            // Team-owned activation never consumes the permit — guide §3.1).
            if ((ownedDepthBySession.get(sid) ?? 0) > 0)
                return;
            // (guide §8.1) 3. a VALID one-shot ordinary permit → consume + pass.
            // Consumption happens HERE (at agent/created — guide §3.1: "agent/
            // created 消费，而不是 openOrdinaryMode 调用完成就消费"); an EXPIRED
            // permit is dropped and falls through to the foreign branch (test
            // A7: expiry removes the bypass, it is not a pass).
            const permit = ordinaryPermits.get(sid);
            if (permit !== undefined) {
                if (now() < permit.expiresAt) {
                    ordinaryPermits.delete(sid);
                    return;
                }
                ordinaryPermits.delete(sid);
            }
            // (guide §8.1) 4. foreign activation of a Team-managed session:
            // create the EXACT-GENERATION rollback record, then reject the
            // activation (the awaited serial rejection propagates into the
            // create/resume; the AgentLoop rolls the unpublished agent back and
            // emits agent/disposed, which the onAgentDisposed barrier settles —
            // guide §8.2). All sources (`startup` / `resume` / the reserved
            // `clear` / `compact`) take the SAME rule (guide §8.1).
            const existing = foreignRollbacks.get(sid);
            if (existing !== undefined) {
                // Defensive: a concurrent/late record for the same session (the
                // upstream single-writer invariant makes two live foreign
                // generations impossible) — settle the stale record so no
                // promise dangles; the new generation supersedes it.
                existing.disposed.resolve();
            }
            const disposed = createDeferred();
            const record = { agent: input.agent, disposed };
            foreignRollbacks.set(sid, record);
            notifyRecordAppeared(sid, record);
            throw new TeamSessionActivationInterceptedError(sid);
        },
        onAgentDisposed(agent) {
            // guide §8.2, verbatim semantics: the barrier settles ONLY for the
            // exact Agent object the fence vetoed — a stale/other-generation
            // disposer must never unlock a later generation (test A5).
            const sid = String(agent.id);
            const record = foreignRollbacks.get(sid);
            if (record === undefined)
                return;
            if (record.agent !== agent)
                return;
            foreignRollbacks.delete(sid);
            record.disposed.resolve();
        },
        async awaitRollback(sessionId) {
            const sid = String(sessionId);
            const record = foreignRollbacks.get(sid);
            if (record === undefined)
                return;
            // Race the exact-generation disposal against the row-stop: a closed
            // fence settles every wait (no dangling await outlives the row —
            // test A8/G4).
            await Promise.race([record.disposed.promise, closedDeferred.promise]);
        },
        async recoverWriterConflict(sessionId, options) {
            const sid = String(sessionId);
            if (closed)
                return false;
            const timeoutMs = options?.timeoutMs === undefined ? defaultWriterConflictTimeoutMs : options.timeoutMs;
            // (a) the fence must FIRST confirm the conflicting activation was a
            // Team-managed FOREIGN activation it intercepted (a record for this
            // session appears — or already exists). A writer conflict with NO
            // fence-vetoed activation (e.g. a handle predating the fence, or a
            // non-Team writer) is NOT recoverable: the bounded wait ends, `false`
            // — the glue propagates the original error, NO retry (guide §7.2).
            const record = await awaitRecordAppearance(sid, timeoutMs);
            if (record === undefined)
                return false;
            // (b) the EXACT foreign generation must be disposed (the writer
            // released) — strict generation, same barrier as awaitRollback.
            return awaitDisposal(record, timeoutMs);
        },
        permitOrdinaryOnce(sessionId) {
            const sid = String(sessionId);
            if (closed)
                return; // no state past the row: a post-close permit is dead
            ordinaryPermits.set(sid, { expiresAt: now() + permitTtlMs });
        },
        bindOwnershipResolver(resolver) {
            ownershipResolver = resolver;
        },
        close() {
            if (closed)
                return;
            closed = true;
            // (1) settle every rollback barrier: resolve the dangling exact-
            // generation disposals (the awaitRollback / recoverWriterConflict
            // waiters settle — no dangling promise, test A8).
            for (const record of foreignRollbacks.values())
                record.disposed.resolve();
            foreignRollbacks.clear();
            // (2) terminate the in-flight conflict waits: no record can appear
            // after the row-stop — every record waiter ends with `undefined`.
            for (const waiters of recordWaiters.values()) {
                for (const waiter of [...waiters])
                    waiter(undefined);
            }
            recordWaiters.clear();
            // (3) drop the pending permits (never consumed after the row-stop)
            // and the guard ref-counts (an in-flight runOwned's finally
            // decrement is still safe: the Map read falls back to 1).
            ordinaryPermits.clear();
            ownedDepthBySession.clear();
            // (4) settle the close gate (the last bounded waits race it).
            closedDeferred.resolve();
        },
    };
}
//# sourceMappingURL=team-session-activation.js.map