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
 * LOCK TOPOLOGY (INV-9.1, repair-r1 F3-A: the three-phase lock split).
 * The chain is ONE logical operation in THREE lock-scope phases — the
 * shared per-team chain (the router's `teamLocks` map; the production
 * root wires the same map into the activity ledger's guarded commit, the
 * lifecycle service and the Root initial-work authority) is NEVER held
 * across the model-visible turn:
 *
 *   Phase A `admitWorkLocked` — fresh read + dedup scan +
 *     (replay | CAS + admission fact) + activity-interval open. Runs
 *     UNDER the chain acquisition, WITH the request signal (an abort
 *     while waiting rejects with the abort reason and admits nothing).
 *     On the router-mediated new-work path the acquisition is the
 *     router's own: the compatibility gate AND Phase A run in ONE
 *     acquisition (the CR-8/R5 rule is preserved — a racing new-work
 *     consultation cannot interleave its re-probe into this
 *     consultation's read→probe→re-read→admit window).
 *   Phase B `deliverWork` — the WorkDeliveryPort call ONLY. Runs
 *     WITHOUT the shared chain (the chain is released before delivery
 *     starts), with the request signal (an abort cancels the live
 *     turn — the pre-fix behavior). This is what frees the team while
 *     the member's turn runs: the member's own team tools (e.g.
 *     `team_report_progress` — the F3 hang) re-enter the router's
 *     facade and acquire the SAME chain; they must not queue behind
 *     the delivery that started them (the deadlock this split removes).
 *   Phase C `settleWorkLocked` — activity-interval close +
 *     `settleAdmittedWork` / fail-closed settlement. RE-ACQUIRES the
 *     same chain (strictly sequential with every other team-mutating
 *     op) WITHOUT the request signal: a request aborted during delivery
 *     still gets its fail-closed settlement committed (N6/H4 — Phase C
 *     durability after abort).
 *
 * On a delivery fault Phase C (fail-closed) runs FIRST and the
 * `WORK_DELIVERY_FAILED` throw comes AFTER the settlement is durable
 * (N3: throw-after-settle — never a fake RUNNING, and the leader's
 * typed rejection always lands on a settled member).
 *
 * `executeWorkChain` is the three-phase orchestrator (the direct test
 * seam): with `teamLocks` installed it performs the Phase A / Phase C
 * acquisitions itself; the router-mediated path instead runs Phase A
 * inline inside the router's gate acquisition and completes Phase B/C
 * through `completeWorkChainAfterAdmission` after the lock is released.
 * Both paths share the SAME phase bodies — one admission algorithm, one
 * delivery call, one settlement owner. The injected `WorkActivityPort`
 * is the in-facade interval writer (guarded commit only, no facade
 * stage, no second lock map), so no re-entrant lock is ever acquired.
 *
 * OVERLAP SEMANTICS (H3, documented): Phase B holds no chain, so a
 * second work unit for the SAME instance MAY be admitted (its own
 * Phase A) while the first unit's delivery is still in flight: both
 * units carry their own admission fact and their own interval
 * (correlation = their own requestToken — the interval guard's
 * per-correlation invariant is untouched). At Phase C both settle
 * through the SAME fresh-read convergence (`settleAdmittedWork`): the
 * first to settle commits the RUNNING -> SETTLED transition; the other
 * converges on the fresh record (already SETTLED -> it writes only its
 * own settlement fact, the crash-window repair branch, no state
 * commit). Both settlement facts are durable, the member ends
 * durably SETTLED, and no RUNNING state survives — the overlap is a
 * documented, convergent interleave, not a race the chain must hide.
 * (The Root initial-work closure — `root-initial-work.ts` — keeps its
 * own one-shot acquisition and is outside this seam: repair-r1 F3-B.)
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
 * RESULT PROPAGATION (v2 D2, frozen by task C1): the chain carries the
 * WorkDeliveryPort's normalized minimal member result
 * (`WorkDeliveryResult`) through the `WorkChainResult.memberResult`:
 *
 * - full / resume: `memberResult` IS the port's result for THIS execution
 *   (at-least-once: a resume re-delivers and carries the FRESH result);
 * - replay: the port is never called; the chain SYNTHESIZES the SAME
 *   explicit result for every replay — `status: 'unavailable'` with
 *   `error.code: 'WORK_REPLAYED'` (existing durable state only: the
 *   settlement fact's presence; no re-delivery, no second business
 *   report, no storage change);
 * - fail-closed delivery fault: the chain THROWS — no result is formed
 *   (the throw is the signal; the fail-closed settlement fact stands).
 *
 * The control-plane `settled` stays SEPARATE: it never implies
 * `memberResult.status === 'succeeded'`.
 *
 * SETTLEMENT-FACT PERSISTENCE (issue #1 / CCR-5): the settlement fact
 * (`member-lifecycle-changed`, `to: 'SETTLED'`) carries the durable
 * `memberResult` whenever the settlement call holds one — the full/resume
 * settlement persists the port's normalized result, and the crash-window
 * repair of the SAME settlement persists it too. The fail-closed
 * delivery-failure settlement carries NONE (no member result exists — the
 * fault description is the record). This is what makes the CCR-3
 * `work-status` read-back durable across a restart: the terminal result
 * survives without any live handle, and `scanWorkStatus` serves it
 * verbatim (a pre-addendum settlement fact without a persisted result
 * degrades to `unavailable` + the diagnostic code, never a business
 * status).
 *
 * TCM-M3 boundary: facts carrying `targetKind: 'root'` (the creation-time
 * Root initial work — the Root strategy's durable side, see
 * `root-initial-work.ts`) are SKIPPED by this scan: a member chain never
 * resumes or settles a Root initial-work unit, even when a member request
 * collides with its requestToken (the token-collision guard).
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
import type { LifecycleCommitPort, WorkActivityPort, WorkDeliveryPort, WorkDeliveryResult, WorkStatusEntry } from '../admission/types.js';
import type { ResolvedCaller } from '../admission/resolve.js';
/** The fixed activity lane of admitted work units (one interval per
 *  requestToken correlation on this subject). */
export declare const WORK_ACTIVITY_SUBJECT = "work-unit";
/**
 * The frozen replay synthesis of the minimal member result (v2 D2, task
 * C1): a requestToken that is already durably settled re-reports nothing —
 * the chain synthesizes this SAME explicit result for every replay (using
 * only the existing durable state — the settlement fact's presence; no
 * re-delivery, no second business report, no storage change). The
 * original business result is deliberately NOT re-served (plan §1.3:
 * replay 不重复 delivery、不重复业务报告; the full transcript is out of
 * scope). `settled: true` alone is never mapped to `succeeded`.
 */
export declare const WORK_RESULT_CODE_REPLAYED = "WORK_REPLAYED";
/**
 * Everything one work chain execution needs (read-phase outputs + the
 * injected work ports).
 *
 * Lock scope (INV-9.1): the phase BODIES (`admitWorkLocked`,
 * `deliverWork`, `settleWorkLocked`) take no lock of their own — the
 * caller owns the acquisition boundary. With `teamLocks` installed,
 * `executeWorkChain` performs the Phase A acquisition (with the request
 * signal) and the Phase C acquisition (without it) on that map; the
 * router-mediated path holds the router's gate acquisition across
 * Phase A and re-acquires for Phase C through
 * `completeWorkChainAfterAdmission`. `teamLocks` is absent ONLY in the
 * direct test seam (the `runChainDirect` shape): the phases then run
 * without the shared chain (the test world is single-threaded per
 * world).
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
    /** Transient cancellation signal for the live delivery; never durable. */
    readonly signal?: unknown;
    /** The shared per-team operation chain (the router's `teamLocks` map —
     *  the same map the production root wires into the activity ledger's
     *  guarded commit, the lifecycle service and the Root initial-work
     *  authority; INV-9.1). Present: `executeWorkChain` acquires it for
     *  Phase A (WITH the request signal) and re-acquires it for Phase C
     *  (WITHOUT the request signal); Phase B never holds it. Absent: the
     *  direct test seam runs the phases without the shared chain. */
    readonly teamLocks?: Map<string, Promise<unknown>>;
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
    /** v2 D2 (frozen by C1): the minimal member result of this execution —
     *  full/resume: the WorkDeliveryPort's normalized result for THIS
     *  attempt; replay: the synthesized unavailable/WORK_REPLAYED result
     *  (identical for every replay, see the module docs). Absent only on
     *  the fail-closed delivery-failure path, where the chain throws
     *  instead of returning. `settled` above stays control-plane and never
     *  implies `memberResult.status === 'succeeded'`. */
    readonly memberResult?: WorkDeliveryResult;
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
 * Phase A (admission) of the work chain (INV-9.1): the fresh read, the
 * dedup scan, the replay shortcut, the (full-mode) CAS + admission fact,
 * and the activity-interval open — the complete pre-delivery durable
 * half. Takes NO lock of its own: the caller owns the acquisition
 * boundary (the router's gate acquisition on the mediated path; the
 * orchestrator's own Phase A acquisition with the request signal on the
 * direct seam).
 *
 * @param deps - the chain dependencies (ports, identity, model-visible
 *   content).
 * @returns `replay` — the unit completed durably on an earlier attempt:
 *   the chain is DONE (zero writes, zero delivery; no Phase B/C) — or
 *   `admitted` — the unit is durably admitted and owes Phase B/C.
 * @throws LIFECYCLE_COMMIT_UNAVAILABLE (zero writes) when the ports are
 *   absent; INSTANCE_NOT_FOUND when the target vanished;
 *   LIFECYCLE_TRANSITION_REJECTED on an illegal ADMIT_WORK edge;
 *   DURABLE_WRITE_FAILED on durable protocol faults (an interval-open
 *   fault fails the unit closed FIRST and rethrows the mapped fault).
 */
export declare function admitWorkLocked(deps: WorkChainDeps): Promise<WorkChainPhaseA>;
/**
 * The Phase A outcome (INV-9.1): `replay` — the chain is DONE with the
 * synthesized result (no Phase B/C); `admitted` — the unit is durably
 * admitted (fact + interval open; full mode: CAS committed) and owes
 * Phase B (delivery) + Phase C (settlement).
 */
export type WorkChainPhaseA = {
    readonly kind: 'replay';
    readonly result: WorkChainResult;
} | {
    readonly kind: 'admitted';
    readonly mode: 'full' | 'resume';
    readonly childSessionId: string;
    readonly fromLifecycle: MemberInstanceRecordDto['lifecycle'];
    readonly lifecycleCommitted: boolean;
    readonly sequence: number;
};
/**
 * Phase B (delivery) of the work chain (INV-9.1): the WorkDeliveryPort
 * call ONLY — the model-visible prompt/context goes to the member's
 * child session and the turn's completion is observed. Runs WITHOUT the
 * shared per-team chain (the member's own team tools can re-enter the
 * router's facade on the same chain during this window — the F3 hang the
 * split removes), with the request signal (an abort cancels the live
 * turn; the pre-fix behavior). Takes no lock of its own.
 *
 * @throws on any delivery/observation fault (fail-closed settlement is
 *   the caller's job — see {@link completeWorkChainAfterAdmission}).
 */
export declare function deliverWork(deps: WorkChainDeps, admitted: {
    readonly childSessionId: string;
}): Promise<WorkDeliveryResult>;
/**
 * Phase C (settlement) of the work chain (INV-9.1): the activity-interval
 * close + `settleAdmittedWork` (the single production settlement owner)
 * for a SUCCESSFUL delivery. Takes no lock of its own: the caller owns
 * the Phase C acquisition (WITHOUT the request signal — N6).
 */
export declare function settleWorkLocked(deps: WorkChainDeps, admitted: {
    readonly mode: 'full' | 'resume';
    readonly childSessionId: string;
    readonly fromLifecycle: MemberInstanceRecordDto['lifecycle'];
    readonly lifecycleCommitted: boolean;
    readonly sequence: number;
}, delivered: WorkDeliveryResult): Promise<WorkChainResult>;
/**
 * Phase B + Phase C of an ALREADY-ADMITTED unit (INV-9.1): the delivery
 * WITHOUT the shared chain, then the settlement re-acquired on the SAME
 * chain WITHOUT the request signal. Shared by the `executeWorkChain`
 * orchestrator (direct seam) and the router-mediated staged path (where
 * Phase A ran inside the router's gate acquisition and the lock is
 * released before this is called).
 *
 * @throws WORK_DELIVERY_FAILED (fail-closed settlement already committed
 *   — N3: throw-after-settle) on any delivery fault; DURABLE_WRITE_FAILED
 *   when the fail-closed settlement ITSELF faults (the original fault in
 *   `details`); DURABLE_WRITE_FAILED on durable protocol faults.
 */
export declare function completeWorkChainAfterAdmission(deps: WorkChainDeps, admitted: Extract<WorkChainPhaseA, {
    readonly kind: 'admitted';
}>): Promise<WorkChainResult>;
/**
 * Execute the full work chain for one admitted work request — the
 * THREE-PHASE ORCHESTRATOR (INV-9.1, module docs): Phase A under the
 * chain (with the request signal) → Phase B without the chain → Phase C
 * re-acquired (without the request signal). With `teamLocks` absent
 * (the direct test seam) the phases run without the shared chain.
 *
 * @param deps - the chain dependencies (ports, identity, model-visible
 *        content, the optional shared chain).
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
 *   `failure` is the fault being recorded; `memberResult` (issue #1 /
 *   CCR-5) is the durable member result persisted INTO the settlement
 *   fact (the full/resume settlement and the crash-window repair of the
 *   same carry it; the fail-closed path carries none — no result exists).
 * @returns the settlement outcome.
 */
export declare function settleAdmittedWork(deps: WorkChainDeps, options?: {
    readonly failClosed?: boolean;
    readonly failure?: unknown;
    readonly memberResult?: WorkDeliveryResult;
}): Promise<SettleOutcome>;
/**
 * The closed diagnostic codes of the CCR-3 `work-status` read (issue #1)
 * — the `unavailable` entries WITHOUT a persisted memberResult:
 *
 * - `WORK_TOKEN_UNKNOWN`: no work-unit fact for the token in this root
 *   (never admitted, or a Root initial-work fact the member scanner
 *   intentionally skips — TCM-M3);
 * - `WORK_RESULT_NOT_PERSISTED`: the unit durably settled but the
 *   settlement fact predates the CCR-5 addendum (no persisted
 *   memberResult — the pre-fix history; the control-plane outcome stays
 *   visible through `workOutcome`);
 * - `WORK_DELIVERY_FAILED`: the unit settled fail-closed
 *   (`workOutcome: 'delivery-failed'`) — a delivery fault, never a
 *   business result.
 */
export declare const WORK_STATUS_CODES: {
    readonly TOKEN_UNKNOWN: "WORK_TOKEN_UNKNOWN";
    readonly RESULT_NOT_PERSISTED: "WORK_RESULT_NOT_PERSISTED";
    readonly DELIVERY_FAILED: "WORK_DELIVERY_FAILED";
};
/**
 * The CCR-3 work-status read (issue #1): the durable state of the given
 * requestTokens in this root, in INPUT ORDER (duplicates collapsed to the
 * first occurrence).
 *
 * A pure read: it walks the ledger (one per-root pass per token, through
 * {@link scanWorkUnitFacts} — the ledger is small at team scale) and
 * writes nothing, delivers nothing, and touches no live object. The
 * terminal business statuses (`succeeded` / `failed` / `unavailable`)
 * are served ONLY from the CCR-5 persisted `memberResult` of the
 * settlement fact — `settled: true` alone is never mapped to a business
 * status (the v2 D2/C1 rule, unchanged).
 */
export declare function scanWorkStatus(repositories: TeamDomainRepositories, rootSessionId: string, requestTokens: readonly string[]): WorkStatusEntry[];
//# sourceMappingURL=work-execution.d.ts.map