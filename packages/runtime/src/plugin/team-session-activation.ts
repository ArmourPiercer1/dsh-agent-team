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
export type TeamSessionStartSource =
  | 'startup'
  | 'resume'
  | 'clear'
  | 'compact'

/**
 * The structural projection of the upstream Agent the fence keys on: the
 * fence reads ONLY the shared id and compares Agent identity by object
 * equality (the exact-generation rule, C1 guide §8.2 / supplement INV-3).
 */
export interface TeamActivationAgent {
  readonly id: string
}

/** The `agent/created` payload the host listener forwards to the fence. */
export interface TeamAgentCreatedInput {
  readonly agent: TeamActivationAgent
  readonly source: TeamSessionStartSource
  /**
   * The upstream AbortSignal of the activation (carried for interface
   * fidelity with the awaited serial payload — the fence's decision is
   * total for a live activation: it either passes or vetoes; an aborted
   * activation is the upstream's own no-op, so the signal is accepted and
   * not consumed).
   */
  readonly signal?: AbortSignal
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
export class TeamSessionActivationInterceptedError extends Error {
  constructor(sessionId: string) {
    super(
      `dsh-agent-team: intercepted foreign Agent activation for Team-managed session "${sessionId}"`,
    )
    this.name = 'TeamSessionActivationInterceptedError'
  }
}

/**
 * The closed-fence error: `runOwned` after `close()` (the row is stopping
 * — no new Team-owned activation is accepted, test A8).
 */
export class TeamSessionActivationClosedError extends Error {
  constructor() {
    super(
      'dsh-agent-team: the Team session activation fence is closed (row stop) — no new Team-owned activation is accepted',
    )
    this.name = 'TeamSessionActivationClosedError'
  }
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
  runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T>

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
  beforeAgentCreated(input: TeamAgentCreatedInput): Promise<void>

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
  claimOwnedGeneration(sessionId: string, agent: TeamActivationAgent): void

  /**
   * The setup-failure claim release (supplement §2.2-C: "setup 失败时
   * claim 不泄漏"): drops the claim iff it still holds THIS Agent
   * object (a claim already consumed by the PASS or replaced is
   * untouched). No-op when absent.
   */
  releaseOwnedGeneration(sessionId: string, agent: TeamActivationAgent): void

  /**
   * The host's `agent/disposed` listener body (C1 guide §8.2): settles
   * the rollback barrier ONLY for the exact Agent object the fence
   * vetoed (strict generation — a stale/other-generation disposer is
   * ignored), bumps the session's `completedEpoch` to the record's
   * epoch and clears `current` (the tombstone survives — supplement
   * INV-5).
   */
  onAgentDisposed(agent: TeamActivationAgent): void

  /**
   * The `ensureLiveAgent` pre-resume barrier (C1 guide §7): wait for a
   * DECLARED foreign rollback of this session to complete (no pending
   * record → return immediately). Settles on row-stop too (a closed
   * fence leaves no dangling wait).
   */
  awaitRollback(sessionId: string): Promise<void>

  /**
   * The completed-rollback epoch of a session (supplement INV-5): the
   * highest epoch whose exact generation the fence observed disposed.
   * The glue snapshots this BEFORE its first resume and passes it as
   * `afterEpoch` to {@link recoverWriterConflict} — a completed rollback
   * with `epoch > afterEpoch` proves the writer was released even though
   * the record is already gone (the TOCTOU fix).
   */
  getRollbackEpoch(sessionId: string): number

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
  recoverWriterConflict(
    sessionId: string,
    options?: { afterEpoch?: number; deadlineMs?: number },
  ): Promise<boolean>

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
  permitOrdinaryOnce(sessionId: string): void

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
  bindOwnershipResolver(resolver: (sessionId: string) => string | undefined): void

  /** The row-stop (idempotent — C1 guide §3, test A8; see the close semantics in the module docs). */
  close(): void
}

/** The construction inputs of the fence (all optional; the production host passes none or the test clock). */
export interface TeamSessionActivationFenceOptions {
  /** The injectable clock (ms epoch) — test determinism for the permit TTL (A7) and the recovery deadline (A15). Default: `Date.now`. */
  readonly now?: () => number
  /**
   * The ordinary-permit TTL in ms (C1 guide §3.1: "建议 TTL 10–30 s").
   * Default: 30_000.
   */
  readonly ordinaryPermitTtlMs?: number
  /**
   * The default bounded window of {@link TeamSessionActivationFence.recoverWriterConflict}
   * in ms (used only when the caller passes no absolute deadline).
   * Default: 10_000.
   */
  readonly writerConflictTimeoutMs?: number
}

/** Default ordinary-permit TTL (C1 guide §3.1 window: 10–30 s). */
export const DEFAULT_ORDINARY_PERMIT_TTL_MS = 30_000

/** Default writer-conflict recovery window. */
export const DEFAULT_WRITER_CONFLICT_TIMEOUT_MS = 10_000

/**
 * A settled-once deferred (the `PromiseWithResolvers` shape — hand-rolled:
 * the repo's TS lib is ES2022, which predates `Promise.withResolvers`).
 */
interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
  readonly settled: boolean
}

function createDeferred<T>(): Deferred<T> {
  let resolveFn: (value: T) => void = () => undefined
  let rejectFn: (error: unknown) => void = () => undefined
  let settled = false
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    rejectFn = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
  })
  return {
    promise,
    get settled() {
      return settled
    },
    resolve: resolveFn,
    reject: rejectFn,
  }
}

/** One vetoed foreign activation (the rollback record, C1 guide §3.1). */
interface RollbackRecord {
  /** The EXACT Agent object the fence vetoed (strict-generation key). */
  readonly agent: TeamActivationAgent
  /** Resolves when the exact agent is disposed (C1 guide §8.2) or the fence closes. */
  readonly disposed: Deferred<void>
  /** The monotonically increasing epoch this veto minted (supplement INV-5). */
  readonly epoch: number
}

/**
 * The per-session rollback state (supplement INV-5 — the
 * epoch/tombstone model): `current` holds the PENDING veto (exact Agent
 * object, bounded by the single-writer invariant — at most one per
 * session); `completedEpoch` is the tombstone — the highest epoch whose
 * exact generation the fence observed disposed, retained AFTER `current`
 * is cleared so a post-completion recovery can still observe the
 * handoff. The Agent object is never retained long-term.
 */
interface SessionRollbackState {
  nextEpoch: number
  completedEpoch: number
  current?: RollbackRecord
}

/**
 * Create the Team session-activation fence (C1 guide §3 factory). Pure
 * state machine — no services, no repositories, no timers beyond the
 * bounded recovery windows (all cleared on settle/close).
 */
export function createTeamSessionActivationFence(
  options: TeamSessionActivationFenceOptions = {},
): TeamSessionActivationFence {
  const now: () => number = options.now ?? Date.now
  const permitTtlMs =
    options.ordinaryPermitTtlMs === undefined ? DEFAULT_ORDINARY_PERMIT_TTL_MS : options.ordinaryPermitTtlMs
  const defaultWriterConflictTimeoutMs =
    options.writerConflictTimeoutMs === undefined
      ? DEFAULT_WRITER_CONFLICT_TIMEOUT_MS
      : options.writerConflictTimeoutMs

  // ── closure state ────────────────────────────────────────────────────────

  /** The Team activation guard per session — a REF-COUNT (test A4):
   *  lifetime bookkeeping + claim-acceptance gate, NEVER a PASS authority. */
  const ownedDepthBySession = new Map<string, number>()

  /** The exact Team generation claim per session (supplement INV-3). */
  const ownedGenerationBySession = new Map<string, TeamActivationAgent>()

  /** The per-session rollback state (supplement INV-5). */
  const rollbackStates = new Map<string, SessionRollbackState>()

  /** In-flight "a qualifying rollback record appeared" waiters. */
  type RecordWaiter = (record: RollbackRecord | undefined) => void
  const recordWaiters = new Map<string, Set<RecordWaiter>>()

  /** The one-shot ordinary activation permits (C1 guide §3.1). */
  const ordinaryPermits = new Map<string, { readonly expiresAt: number }>()

  /** The row-stop gate (set once, never cleared). */
  let closed = false

  /** The bound durable-ownership resolver (C1 guide §4.2). */
  let ownershipResolver: ((sessionId: string) => string | undefined) | undefined

  /**
   * The ownership-ready barrier (supplement INV-4): resolves when the
   * resolver is bound (or the fence closes). `agent/created` before the
   * bind AWAITs this — classification pending, never "unmanaged".
   */
  const ownershipReady = createDeferred<void>()

  /** Resolves at `close()` — the close signal every bounded wait races. */
  const closedDeferred = createDeferred<void>()

  // ── helpers ─────────────────────────────────────────────────────────────

  function rollbackState(sid: string): SessionRollbackState {
    let state = rollbackStates.get(sid)
    if (state === undefined) {
      state = { nextEpoch: 0, completedEpoch: 0 }
      rollbackStates.set(sid, state)
    }
    return state
  }

  /**
   * Wait for a rollback record of `sid` with `epoch > afterEpoch` to
   * appear (or observe a current one that already qualifies). Resolves
   * with the record, or `undefined` on deadline / row-stop (no record
   * can appear after close). Bounded + event-driven; a NON-qualifying
   * (stale-epoch) appearance is observed and the wait continues.
   */
  function awaitRecordAfterEpoch(
    sid: string,
    afterEpoch: number,
    budgetMs: number,
  ): Promise<RollbackRecord | undefined> {
    if (closed) return Promise.resolve(undefined)
    const existing = rollbackStates.get(sid)?.current
    if (existing !== undefined && existing.epoch > afterEpoch) {
      return Promise.resolve(existing)
    }
    if (budgetMs <= 0) return Promise.resolve(undefined)
    return new Promise<RollbackRecord | undefined>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      let finished = false
      const finish: RecordWaiter = (record) => {
        if (finished) return
        // A NON-QUALIFYING (stale-epoch) appearance: observe and keep
        // waiting. An explicit `undefined` (the deadline fired or the row
        // stopped) ENDS the wait with no record — it must resolve, never
        // be swallowed (the swallow hung every no-record bounded wait:
        // the A14/G6 shapes).
        if (record !== undefined && record.epoch <= afterEpoch) return
        finished = true
        if (timer !== undefined) clearTimeout(timer)
        const waiters = recordWaiters.get(sid)
        if (waiters !== undefined) {
          waiters.delete(finish)
          if (waiters.size === 0) recordWaiters.delete(sid)
        }
        resolve(record)
      }
      timer = setTimeout(() => finish(undefined), budgetMs)
      let waiters = recordWaiters.get(sid)
      if (waiters === undefined) {
        waiters = new Set()
        recordWaiters.set(sid, waiters)
      }
      waiters.add(finish)
    })
  }

  /**
   * Wait for ONE rollback record's exact-generation disposal within the
   * remaining budget. `true` iff the exact agent was disposed (the
   * writer released); `false` on deadline or row-stop.
   */
  function awaitDisposal(record: RollbackRecord, budgetMs: number): Promise<boolean> {
    if (closed) return Promise.resolve(false)
    if (record.disposed.settled) return Promise.resolve(true)
    if (budgetMs <= 0) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      let finished = false
      const finish = (value: boolean): void => {
        if (finished) return
        finished = true
        if (timer !== undefined) clearTimeout(timer)
        resolve(value)
      }
      timer = setTimeout(() => finish(false), budgetMs)
      void record.disposed.promise.then(() => finish(true))
      void closedDeferred.promise.then(() => finish(false))
    })
  }

  /** Notify the in-flight record waits of `sid` that a record appeared. */
  function notifyRecordAppeared(sid: string, record: RollbackRecord): void {
    const waiters = recordWaiters.get(sid)
    if (waiters === undefined) return
    for (const waiter of [...waiters]) waiter(record)
  }

  // ── the fence surface ────────────────────────────────────────────────────

  return {
    async runOwned<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
      const sid = String(sessionId)
      if (closed) {
        // test A8: a new runOwned after close REJECTS (async rejection —
        // the caller's `await` sees it in its own catch).
        throw new TeamSessionActivationClosedError()
      }
      ownedDepthBySession.set(sid, (ownedDepthBySession.get(sid) ?? 0) + 1)
      try {
        // COMMIT-4 DEFECT FIX (0.1.7 real-host kit, World A boot-gate
        // FATAL, evidence/restart-017rc1/commit4/DEFECT-c1-runOwned-guard-
        // lifetime.md): `runOwned` MUST be async and `return await
        // operation()` — a SYNCHRONOUS `return operation()` fires the
        // `finally` decrement the moment the operation PROMISE IS
        // RETURNED (after the operation's synchronous prefix only), while
        // the 0.1.7 AWAITED-serial `agent/created` seam fires several
        // AWAITED hops later. With `await`, the guard spans the
        // operation's FULL AWAITED LIFETIME (regression test A9 pins the
        // real host shape — including that a claim minted after awaited
        // hops is only ACCEPTED while the guard still spans them).
        return await operation()
      } finally {
        // C1 guide §3.1 pseudocode, verbatim semantics: decrement in
        // finally (AFTER the operation settles — the async/await is what
        // makes "finally = teardown of the activation lifetime" true);
        // the inner completion never clears the outer guard (test A4).
        const next = (ownedDepthBySession.get(sid) ?? 1) - 1
        if (next === 0) ownedDepthBySession.delete(sid)
        else ownedDepthBySession.set(sid, next)
      }
    },

    claimOwnedGeneration(sessionId: string, agent: TeamActivationAgent): void {
      const sid = String(sessionId)
      if (closed) return // no state past the row
      // Claim-acceptance gate (supplement §2.1-B: ownedDepth is kept to
      // "防止 claim API 被 Team glue 外部滥用"): a claim is only valid
      // while the Team glue's ownership guard is held (every glue
      // create/resume runs under `runOwned`); an external caller without
      // the guard registers nothing (its activation is then a plain
      // foreign activation — vetoed).
      if ((ownedDepthBySession.get(sid) ?? 0) === 0) return
      ownedGenerationBySession.set(sid, agent)
    },

    releaseOwnedGeneration(sessionId: string, agent: TeamActivationAgent): void {
      const sid = String(sessionId)
      // Setup-failure cleanup (supplement §2.2-C): drop the claim iff it
      // still holds THIS Agent object — a consumed (PASS) or replaced
      // claim is untouched; absent is a no-op.
      if (ownedGenerationBySession.get(sid) === agent) {
        ownedGenerationBySession.delete(sid)
      }
    },

    async beforeAgentCreated(input: TeamAgentCreatedInput): Promise<void> {
      const sid = String(input.agent.id)
      // (1) Row-stop: the fence keeps no state past the row — a late
      // activation is the upstream's own teardown concern (no-op
      // pass-through; the row's own agents are disposed by the row
      // backstop).
      if (closed) return
      // (2) ownership classification (supplement INV-4): "resolver not
      // bound" is CLASSIFICATION PENDING, never "unmanaged". The exact
      // Team claim is SELF-PROVING (the glue's own activation — it may
      // precede the domain-open bind in a test/factory world) and skips
      // the wait; everything else AWAITs the bind (or the row-stop).
      const claim = ownedGenerationBySession.get(sid)
      const claimMatches = claim !== undefined && claim === input.agent
      if (ownershipResolver === undefined && !claimMatches) {
        await Promise.race([ownershipReady.promise, closedDeferred.promise])
        if (closed) return
      }
      if (ownershipResolver === undefined) {
        // Reached only on the claim-skip path (the wait above was
        // skipped for a self-proving claim): the row stopped before the
        // bind, or a world that never binds. Pass-through (the claim is
        // self-proving — the glue's own activation); consume the claim
        // so no state leaks.
        if (claimMatches) ownedGenerationBySession.delete(sid)
        return
      }
      // (3) unmanaged → pass (the ordinary session continues
      // upstream-equivalently — even after having waited for the bind).
      const owner = ownershipResolver(sid)
      if (owner === undefined) return
      // (4) the EXACT claimed Team generation (supplement INV-3 — the
      // CAUSAL pass authority, replacing the old ownedDepth window) →
      // consume the claim + pass. The claim takes PRIORITY over an
      // ordinary permit (the Team-owned activation never consumes the
      // permit — C1 guide §3.1).
      if (claimMatches) {
        ownedGenerationBySession.delete(sid)
        return
      }
      // (5) a VALID one-shot ordinary permit → consume + pass.
      // Consumption happens HERE (at agent/created — C1 guide §3.1); an
      // EXPIRED permit is dropped and falls through to the foreign
      // branch (test A7: expiry removes the bypass, it is not a pass).
      const permit = ordinaryPermits.get(sid)
      if (permit !== undefined) {
        if (now() < permit.expiresAt) {
          ordinaryPermits.delete(sid)
          return
        }
        ordinaryPermits.delete(sid)
      }
      // (6) foreign activation of a Team-managed session: mint the
      // EXACT-GENERATION + EPOCH rollback record, then reject the
      // activation (the awaited serial rejection propagates into the
      // create/resume; the AgentLoop rolls the unpublished agent back and
      // emits agent/disposed, which the onAgentDisposed barrier settles —
      // C1 guide §8.2). All sources (`startup` / `resume` / the reserved
      // `clear` / `compact`) take the SAME rule (C1 guide §8.1).
      const state = rollbackState(sid)
      const epoch = state.nextEpoch + 1
      state.nextEpoch = epoch
      if (state.current !== undefined) {
        // Defensive: a concurrent/late record for the same session (the
        // upstream single-writer invariant makes two live foreign
        // generations impossible) — settle the stale barrier (its
        // supersession IS a released writer: only one foreign generation
        // can hold the session) and tombstone its epoch; the new
        // generation supersedes it.
        state.completedEpoch = Math.max(state.completedEpoch, state.current.epoch)
        state.current.disposed.resolve()
      }
      const disposed = createDeferred<void>()
      const record: RollbackRecord = { agent: input.agent, disposed, epoch }
      state.current = record
      notifyRecordAppeared(sid, record)
      throw new TeamSessionActivationInterceptedError(sid)
    },

    onAgentDisposed(agent: TeamActivationAgent): void {
      // C1 guide §8.2, verbatim semantics: the barrier settles ONLY for
      // the exact Agent object the fence vetoed — a stale/other-
      // generation disposer must never unlock a later generation (test
      // A5). The completion is TOMBSTONED: `completedEpoch` advances to
      // the record's epoch and survives the `current` clear (supplement
      // INV-5 — test A13).
      const sid = String(agent.id)
      const state = rollbackStates.get(sid)
      if (state === undefined || state.current === undefined) return
      if (state.current.agent !== agent) return
      const record = state.current
      state.completedEpoch = Math.max(state.completedEpoch, record.epoch)
      state.current = undefined
      record.disposed.resolve()
    },

    async awaitRollback(sessionId: string): Promise<void> {
      const sid = String(sessionId)
      const record = rollbackStates.get(sid)?.current
      if (record === undefined) return
      // Race the exact-generation disposal against the row-stop: a closed
      // fence settles every wait (no dangling await outlives the row —
      // test A8/G4).
      await Promise.race([record.disposed.promise, closedDeferred.promise])
    },

    getRollbackEpoch(sessionId: string): number {
      return rollbackStates.get(String(sessionId))?.completedEpoch ?? 0
    },

    async recoverWriterConflict(
      sessionId: string,
      options?: { afterEpoch?: number; deadlineMs?: number },
    ): Promise<boolean> {
      const sid = String(sessionId)
      if (closed) return false
      const afterEpoch = options?.afterEpoch ?? 0
      // ONE absolute deadline (supplement INV-6): the glue passes
      // `Date.now() + timeoutMs`; absent, the fence mints it here. Both
      // stages below consume ONLY `deadline - now()`.
      const deadline =
        options?.deadlineMs ?? now() + defaultWriterConflictTimeoutMs
      // (a) the handoff may already be COMPLETE — the rollback finished
      // BEFORE this call (the TOCTOU: veto → disposed → writer released,
      // then the Team resume's writer-held rejection reached its catch).
      // The tombstone answers it without waiting (test A13: immediate
      // true; test A14: a stale completed epoch never unlocks a NEW
      // conflict — `completedEpoch > afterEpoch` is the exact test).
      if ((rollbackStates.get(sid)?.completedEpoch ?? 0) > afterEpoch) return true
      // (b) otherwise the fence must confirm a NEW rollback record with
      // `epoch > afterEpoch` (the fence intercepted the foreign
      // activation that holds the writer). A writer conflict with NO
      // qualifying fence-vetoed activation (e.g. a handle predating the
      // fence, or a non-Team writer) is NOT recoverable: the bounded wait
      // ends, `false` — the glue propagates the original error, NO retry
      // (C1 guide §7.2).
      const record = await awaitRecordAfterEpoch(sid, afterEpoch, deadline - now())
      if (record === undefined) return false
      // (c) the EXACT foreign generation must be disposed (the writer
      // released) — strict generation, same barrier as awaitRollback —
      // within the SAME absolute deadline's remaining budget.
      return awaitDisposal(record, deadline - now())
    },

    permitOrdinaryOnce(sessionId: string): void {
      const sid = String(sessionId)
      if (closed) return // no state past the row: a post-close permit is dead
      ordinaryPermits.set(sid, { expiresAt: now() + permitTtlMs })
    },

    bindOwnershipResolver(resolver: (sessionId: string) => string | undefined): void {
      ownershipResolver = resolver
      // Supplement INV-4: binding settles the classification-pending
      // waiters (every `agent/created` that was awaiting wakes and
      // classifies now — ordinary → unmanaged → pass, Team-managed →
      // claim/permit/veto).
      ownershipReady.resolve()
    },

    close(): void {
      if (closed) return
      closed = true
      // (1) settle the ownership-ready waiters (supplement §2.1-E): they
      // wake, see `closed`, and pass through — no dangling await.
      ownershipReady.resolve()
      // (2) settle every rollback barrier: resolve the pending exact-
      // generation disposals (the awaitRollback / recoverWriterConflict
      // waiters settle — no dangling promise, test A8).
      for (const state of rollbackStates.values()) {
        if (state.current !== undefined) state.current.disposed.resolve()
      }
      // (3) terminate the in-flight conflict waits: no record can appear
      // after the row-stop — every record waiter ends with `undefined`.
      for (const waiters of recordWaiters.values()) {
        for (const waiter of [...waiters]) waiter(undefined)
      }
      recordWaiters.clear()
      // (4) clear the generation claims + drop the pending permits
      // (never consumed after the row-stop) + the guard ref-counts (an
      // in-flight runOwned's finally decrement is still safe: the Map
      // read falls back to 1).
      ownedGenerationBySession.clear()
      ordinaryPermits.clear()
      ownedDepthBySession.clear()
      // (5) settle the close gate (the last bounded waits race it).
      closedDeferred.resolve()
    },
  }
}
