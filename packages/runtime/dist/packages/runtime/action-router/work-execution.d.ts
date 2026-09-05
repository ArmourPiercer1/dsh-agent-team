/**
 * P8-S3 — the work execution chain (closure plan §16.2, R1–R6).
 *
 * This module owns the vertical execution chain of one admitted work unit:
 *
 *   dedup scan -> required+CAS ADMIT_WORK (CREATED/SETTLED -> RUNNING) ->
 *   `team-work-admitted` fact (prompt / attachedContext / caller / token) ->
 *   activity interval open (correlation = requestToken) ->
 *   model-visible delivery through the WorkDeliveryPort (submit + observe
 *   the child session's turn completion) ->
 *   activity interval close ->
 *   `settleAdmittedWork` (R5: the single production settlement owner) ->
 *   RUNNING -> SETTLED CAS + `member-lifecycle-changed` fact.
 *
 * The chain runs INSIDE the router's per-team lock (the caller is
 * `runEffect`, which serializes every effect of one team) — it takes no
 * lock of its own, and the injected `WorkActivityPort` is the in-facade
 * interval writer (guarded commit only, no facade stage, no second lock
 * map), so no re-entrant lock is ever acquired.
 *
 * RETRY PROTOCOL (requestToken = the stable operation identity; the
 * visible/deduped at-least-once contract, closure plan §CR2):
 *
 * - a `member-lifecycle-changed` fact with `to: 'SETTLED'` for the token
 *   EXISTS -> the work unit already completed durably: the call is a
 *   REPLAY (zero writes, zero delivery, `replayed: true`);
 * - only the `team-work-admitted` fact EXISTS -> the chain crashed between
 *   admission and settlement: the call RESUMES (no re-admission, no
 *   duplicate fact; delivery is attempted again — at-least-once on the
 *   model-visible session input, the delivered text carries the
 *   requestToken so the model can dedupe; settlement converges, see
 *   `settleAdmittedWork`);
 * - NEITHER exists -> the FULL chain.
 *
 * The TeamLedger itself is exactly-once per logical work unit: the replay
 * branch writes nothing, and the resume branch writes at most the missing
 * settlement fact (crash-window repair) plus the interval rows it still
 * owes.
 *
 * FAIL-CLOSED (R6): any fault between the admission commit and the
 * settlement (interval write fault, delivery failure, settlement fault)
 * settles the member RUNNING -> SETTLED through the same lifecycle commit
 * port — the frozen FSM has no RUNNING -> CREATED edge, and a fake RUNNING
 * success is never left behind. Delivery failures surface as
 * `WORK_DELIVERY_FAILED`; the settlement fact carries
 * `workOutcome: 'delivery-failed'` plus the fault description.
 */
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { LifecycleCommitPort, WorkActivityPort, WorkDeliveryPort } from '../admission/types.js';
import type { ResolvedCaller } from '../admission/resolve.js';
/** The fixed activity lane of admitted work units (one interval per
 *  requestToken correlation on this subject). */
export declare const WORK_ACTIVITY_SUBJECT = "work-unit";
/**
 * Everything one work chain execution needs (read-phase outputs + the
 * injected work ports). The caller MUST already hold the router's
 * per-team lock for `rootSessionId`.
 */
export interface WorkChainDeps {
    readonly repositories: TeamDomainRepositories;
    /** The lifecycle transition commit port (REQUIRED by the chain: the
     *  R3 rule — an absent port fails closed before any durable write). */
    readonly lifecycleCommit?: LifecycleCommitPort;
    /** The model-visible delivery port (REQUIRED by the chain). */
    readonly workDelivery?: WorkDeliveryPort;
    /** The in-facade activity interval writer (REQUIRED by the chain). */
    readonly workActivity?: WorkActivityPort;
    readonly now: () => string;
    readonly rootSessionId: string;
    readonly instanceId: string;
    /** The action label recorded in the facts (`delegate` / `follow-up`). */
    readonly action: string;
    readonly caller: ResolvedCaller;
    readonly requestToken: string;
    /** The exact model-visible work prompt (R2: never inherited). */
    readonly prompt: string;
    readonly attachedContext?: string;
    readonly taskSummary?: string;
}
/** The durable work-unit facts found by the dedup scan (min sequence each). */
export interface WorkUnitFacts {
    readonly admitted?: {
        readonly sequence: number;
        readonly payload: Record<string, unknown>;
    };
    readonly settled?: {
        readonly sequence: number;
        readonly payload: Record<string, unknown>;
    };
}
/** The chain outcome (lossless JSON; mapped to the action effect). */
export interface WorkChainResult {
    /** `full` (admitted + settled this call), `resume` (prior admission
     *  recovered; delivered + settled this call) or `replay` (zero writes,
     *  zero delivery). */
    readonly mode: 'full' | 'resume' | 'replay';
    readonly instanceId: string;
    readonly childSessionId: string;
    /** The lifecycle observed at this execution's fresh read (replay: the
     *  original admission's `fromLifecycle` from the durable fact). */
    readonly fromLifecycle: MemberInstanceRecordDto['lifecycle'];
    /** True when the ADMIT_WORK transition was durably committed by THIS
     *  execution (false: already RUNNING, resume, or replay of an attempt
     *  that found the target RUNNING). */
    readonly lifecycleCommitted: boolean;
    /** The durable sequence of the `team-work-admitted` fact (the original
     *  one on resume/replay). */
    readonly sequence: number;
    /** True when the work unit reached the durable SETTLED state (this
     *  execution, or the replayed attempt). */
    readonly settled: boolean;
    /** The durable sequence of the settlement fact (when written or
     *  already present). */
    readonly settledSequence?: number;
}
/**
 * The settlement outcome of {@link settleAdmittedWork}.
 * `committed` is true only when the RUNNING -> SETTLED state transition
 * was durably committed by this call; `sequence` is the settlement fact's
 * durable sequence (always present once settlement is complete).
 */
export interface SettleOutcome {
    readonly committed: boolean;
    readonly to: MemberInstanceRecordDto['lifecycle'];
    readonly sequence?: number;
}
/**
 * Scan the TeamLedger for the work-unit facts of one requestToken.
 *
 * The scan is a full ledger walk (the ledger is per-root and small at
 * team scale; there is no token index in the frozen storage schema).
 * Entries are keyed by `String(sequence)`, so existence (not scan order)
 * is what matters; when several entries match (a resume repaired a fact
 * after an earlier partial write), the MINIMUM sequence wins.
 */
export declare function scanWorkUnitFacts(repositories: TeamDomainRepositories, rootSessionId: string, requestToken: string): WorkUnitFacts;
/**
 * Execute the full work chain for one admitted work request.
 *
 * @param deps - the chain dependencies (ports, identity, model-visible
 *        content). The caller must hold the router's per-team lock.
 * @returns the chain outcome (see {@link WorkChainResult}).
 * @throws WORK_DELIVERY_FAILED (fail-closed settlement already performed)
 *   on any delivery fault; LIFECYCLE_COMMIT_UNAVAILABLE (zero writes) when
 *   the port is absent; DURABLE_WRITE_FAILED on durable protocol faults.
 */
export declare function executeWorkChain(deps: WorkChainDeps): Promise<WorkChainResult>;
/**
 * The SINGLE production settlement owner of admitted work (R5).
 *
 * Convergence rules on the FRESH durable record:
 * - RUNNING -> CAS RUNNING -> SETTLED through the injected lifecycle
 *   commit port (STATE FIRST), then the `member-lifecycle-changed` fact
 *   (EVIDENCE SECOND, `workOutcome: 'settled'` or `'delivery-failed'`);
 * - SETTLED -> the state half already committed (crash between the state
 *   commit and the fact): commit ONLY the missing settlement fact (the
 *   caller's dedup scan proves the fact is absent for this token) — no
 *   state commit, no duplicate fact;
 * - any other lifecycle (terminal/ARCHIVED) -> no commit (the work unit
 *   cannot settle on a member that left the work state; the fact trail of
 *   the admission remains for audit).
 *
 * @param deps - the chain dependencies (the port is REQUIRED here: this
 *   function only runs when a RUNNING record still owes its settlement,
 *   where the port is present by the chain's precondition).
 * @param options - `failClosed: true` marks a fail-closed settlement
 *   (the fact carries `workOutcome: 'delivery-failed'` + the fault);
 *   `failure` is the fault being recorded.
 * @returns the settlement outcome.
 */
export declare function settleAdmittedWork(deps: WorkChainDeps, options?: {
    readonly failClosed?: boolean;
    readonly failure?: unknown;
}): Promise<SettleOutcome>;
//# sourceMappingURL=work-execution.d.ts.map