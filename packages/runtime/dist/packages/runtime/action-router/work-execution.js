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
import { applyLifecycleOperation, isLifecycleTransitionError, LIFECYCLE_OPERATIONS, } from '../../domain/lifecycle/src/index.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js';
import { WORK_DELIVERY_STATUSES } from '../admission/types.js';
import { isActivityError } from '../activity/errors.js';
import { ACTIVITY_ERROR_CODES } from '../activity/errors.js';
import { asAbortLike, commitDurableFact, withTeamLock } from './effects.js';
/** The durable fact families (same contract as `effects.ts`). */
const FACT_WORK_ADMITTED = 'team-work-admitted';
const FACT_LIFECYCLE_CHANGED = 'member-lifecycle-changed';
/** The fixed activity lane of admitted work units (one interval per
 *  requestToken correlation on this subject). */
export const WORK_ACTIVITY_SUBJECT = 'work-unit';
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
export const WORK_RESULT_CODE_REPLAYED = 'WORK_REPLAYED';
const WORK_REPLAY_MESSAGE = 'work unit already settled (settlement fact present); original result not re-reported';
/**
 * Scan the TeamLedger for the work-unit facts of one requestToken.
 *
 * The scan is a full ledger walk (the ledger is per-root and small at
 * team scale; there is no token index in the frozen storage schema).
 * Entries are keyed by `String(sequence)`, so existence (not scan order)
 * is what matters; when several entries match (a resume repaired a fact
 * after an earlier partial write), the MINIMUM sequence wins.
 */
export function scanWorkUnitFacts(repositories, rootSessionId, requestToken) {
    let admitted;
    let settled;
    for (const entry of repositories.ledger.list()) {
        if (entry.rootSessionId !== rootSessionId)
            continue;
        // TCM-M3: the creation-time Root initial work facts (the Root
        // strategy's durable side — the `team-work-admitted` facts carrying
        // `targetKind: 'root'` plus the terminal `team-root-work-delivered`
        // facts) are NOT member work units: the Root scanner
        // (`root-initial-work.ts`) owns them. Skipping the discriminator here
        // keeps a same-token Root fact from being resumed (or settled) by a
        // member chain — the token-collision guard.
        if (entry.payload['targetKind'] === 'root')
            continue;
        if (entry.payload['requestToken'] !== requestToken)
            continue;
        if (entry.factType === FACT_WORK_ADMITTED) {
            if (admitted === undefined || entry.sequence < admitted.sequence) {
                admitted = { sequence: entry.sequence, payload: entry.payload };
            }
        }
        else if (entry.factType === FACT_LIFECYCLE_CHANGED &&
            entry.payload['to'] === 'SETTLED') {
            if (settled === undefined || entry.sequence < settled.sequence) {
                settled = { sequence: entry.sequence, payload: entry.payload };
            }
        }
    }
    return { admitted, settled };
}
/** The caller ref recorded in the work facts (same shape as effects.ts). */
function callerRef(caller) {
    if (caller.role === 'human') {
        return { kind: 'human', humanId: caller.humanId };
    }
    return { kind: 'instance', instanceId: caller.callerMember?.instanceId, role: caller.role };
}
/**
 * One CAS lifecycle transition through the injected port. The chain
 * REQUIRES the port (R3): an absent port fails closed with
 * LIFECYCLE_COMMIT_UNAVAILABLE and ZERO durable writes.
 */
async function casTransition(deps, expectedActivityVersion, from, operation, to) {
    const port = deps.lifecycleCommit;
    if (port === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE, `TeamRuntime: the work chain of '${deps.action}' requires the lifecycle commit port; no port is injected`, { action: deps.action, instanceId: deps.instanceId, operation });
    }
    try {
        await port.commitTransition({
            rootSessionId: deps.rootSessionId,
            instanceId: deps.instanceId,
            expectedActivityVersion,
            from,
            operation,
            to,
        });
    }
    catch (error) {
        throw durableFailure('lifecycle transition commit', error, {
            instanceId: deps.instanceId,
            expectedActivityVersion,
            from,
            operation,
            to,
        });
    }
}
/** Wrap a durable-protocol fault into the closed effect-phase code. */
function durableFailure(phase, error, details) {
    const downstream = typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
        ? error.code
        : error instanceof Error
            ? error.message
            : String(error);
    return new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, `TeamRuntime: durable ${phase} failed: ${downstream}`, { phase, ...details });
}
/** A lossless-JSON description of a delivery fault (for the settle fact). */
function describeFailure(error) {
    if (error instanceof TeamRuntimeError) {
        return { code: error.code, message: error.message };
    }
    if (isActivityError(error)) {
        return { code: error.code, message: error.message };
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = error.code;
        const message = error instanceof Error ? error.message : String(error);
        return typeof code === 'string' ? { code, message } : { message };
    }
    return { message: error instanceof Error ? error.message : String(error) };
}
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
export async function admitWorkLocked(deps) {
    const { repositories, rootSessionId, instanceId, requestToken } = deps;
    if (deps.workDelivery === undefined || deps.workActivity === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE, 'TeamRuntime: the work chain requires the workDelivery and workActivity ports; none injected', { action: deps.action, instanceId });
    }
    const fresh = repositories.memberInstances.get(rootSessionId, instanceId);
    if (fresh === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND, `TeamRuntime: work chain target '${instanceId}' has no member record`, { instanceId });
    }
    const childSessionId = fresh.childSessionId;
    // --- the dedup scan (retry protocol, module docs) ------------------------
    const facts = scanWorkUnitFacts(repositories, rootSessionId, requestToken);
    if (facts.settled !== undefined) {
        // The work unit completed durably on an earlier attempt: REPLAY.
        const admitted = facts.admitted;
        if (admitted === undefined) {
            // Unreachable in this pipeline (the settlement fact is only ever
            // written after the admission fact of the same token) — honest
            // internal invariant, never a caller-reachable rejection.
            throw new Error(`TeamRuntime internal invariant: settlement fact ${facts.settled.sequence} without its admission fact (token '${requestToken}')`);
        }
        const fromLifecycle = admitted.payload['fromLifecycle'] ?? fresh.lifecycle;
        return {
            kind: 'replay',
            result: {
                mode: 'replay',
                instanceId,
                childSessionId,
                fromLifecycle,
                lifecycleCommitted: admitted.payload['lifecycleCommitted'] === true,
                sequence: admitted.sequence,
                settled: true,
                settledSequence: facts.settled.sequence,
                // v2 D2 (frozen by C1): the replay re-reports nothing — the SAME
                // synthesized unavailable result for every replay (existing durable
                // state only; no re-delivery, no second business report).
                memberResult: {
                    requestToken,
                    status: 'unavailable',
                    error: { code: WORK_RESULT_CODE_REPLAYED, message: WORK_REPLAY_MESSAGE },
                },
            },
        };
    }
    const mode = facts.admitted !== undefined ? 'resume' : 'full';
    // --- admission (full mode only: resume reuses the durable admission) ----
    let lifecycleCommitted = false;
    const fromLifecycle = fresh.lifecycle;
    let sequence;
    if (mode === 'full') {
        if (fresh.lifecycle !== 'RUNNING') {
            let next;
            try {
                next = applyLifecycleOperation(fresh, LIFECYCLE_OPERATIONS.ADMIT_WORK);
            }
            catch (error) {
                if (isLifecycleTransitionError(error)) {
                    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED, `TeamRuntime: ${String(error)}`, {
                        instanceId,
                        from: fresh.lifecycle,
                        requested: 'RUNNING',
                        operation: LIFECYCLE_OPERATIONS.ADMIT_WORK,
                    });
                }
                throw error;
            }
            // STATE FIRST (R3: required — both the state and the fact below
            // commit, or the action fails before either).
            await casTransition(deps, fresh.activityVersion, fresh.lifecycle, LIFECYCLE_OPERATIONS.ADMIT_WORK, next.lifecycle);
            lifecycleCommitted = true;
        }
        // EVIDENCE SECOND (R2: the fact carries the exact model-visible
        // content + the caller ref + the token — no default inheritance).
        sequence = await commitDurableFact(repositories, rootSessionId, deps.now, FACT_WORK_ADMITTED, {
            action: deps.action,
            caller: callerRef(deps.caller),
            targetInstanceId: instanceId,
            childSessionId,
            fromLifecycle,
            lifecycleCommitted,
            prompt: deps.prompt,
            ...(deps.attachedContext !== undefined ? { attachedContext: deps.attachedContext } : {}),
            ...(deps.taskSummary !== undefined ? { taskSummary: deps.taskSummary } : {}),
            requestToken,
            at: deps.now(),
        });
    }
    else {
        // resume: the admission fact (and its sequence) is the durable one.
        sequence = facts.admitted?.sequence ?? 0;
    }
    // --- interval open (tolerate already-open: a resume may find the
    //     crashed attempt's interval still open) ------------------------------
    try {
        await deps.workActivity.openInterval({
            rootSessionId,
            instanceId,
            subject: WORK_ACTIVITY_SUBJECT,
            requestToken,
            correlation: requestToken,
            note: `work-unit ${mode} (token ${requestToken})`,
        });
    }
    catch (error) {
        if (!(isActivityError(error) && error.code === ACTIVITY_ERROR_CODES.ACTIVITY_INTERVAL_ALREADY_OPEN)) {
            // Phase A is still inside its acquisition: the fail-closed settle
            // runs inline (the caller holds the chain), then the mapped fault.
            await failClosedSettle(deps, error);
            throw durableFailure('activity interval open', error, { instanceId, requestToken });
        }
    }
    return { kind: 'admitted', mode, childSessionId, fromLifecycle, lifecycleCommitted, sequence };
}
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
export async function deliverWork(deps, admitted) {
    const { rootSessionId, instanceId, requestToken } = deps;
    const workDelivery = deps.workDelivery;
    if (workDelivery === undefined) {
        // Unreachable after a successful Phase A (which fails closed on an
        // absent port) — the typed guard keeps the direct seam honest.
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE, 'TeamRuntime: the work chain requires the workDelivery port; none injected', { action: deps.action, instanceId });
    }
    return workDelivery.deliver({
        rootSessionId,
        instanceId,
        childSessionId: admitted.childSessionId,
        requestToken,
        prompt: deps.prompt,
        ...(deps.attachedContext !== undefined ? { attachedContext: deps.attachedContext } : {}),
        ...(deps.signal !== undefined ? { signal: deps.signal } : {}),
    });
}
/**
 * Phase C (settlement) of the work chain (INV-9.1): the activity-interval
 * close + `settleAdmittedWork` (the single production settlement owner)
 * for a SUCCESSFUL delivery. Takes no lock of its own: the caller owns
 * the Phase C acquisition (WITHOUT the request signal — N6).
 */
export async function settleWorkLocked(deps, admitted, delivered) {
    await closeIntervalTolerated(deps);
    const settle = await settleAdmittedWork(deps, { memberResult: delivered });
    return {
        mode: admitted.mode,
        instanceId: deps.instanceId,
        childSessionId: admitted.childSessionId,
        fromLifecycle: admitted.fromLifecycle,
        lifecycleCommitted: admitted.lifecycleCommitted,
        sequence: admitted.sequence,
        settled: settle.to === 'SETTLED',
        ...(settle.sequence !== undefined ? { settledSequence: settle.sequence } : {}),
        // v2 D2 (frozen by C1): carry the port's normalized member result for
        // this execution (at-least-once: a resume carries the FRESH result).
        memberResult: delivered,
    };
}
/**
 * The Phase C acquisition (INV-9.1 / N6): re-acquire the shared chain
 * for the settlement WITHOUT the request signal — a request aborted
 * during delivery still gets its settlement committed (Phase C
 * durability after abort). With no chain installed (the direct test
 * seam) the work runs as-is.
 */
async function acquirePhaseC(deps, work) {
    if (deps.teamLocks === undefined)
        return work();
    return withTeamLock(deps.teamLocks, deps.rootSessionId, work);
}
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
export async function completeWorkChainAfterAdmission(deps, admitted) {
    let delivered;
    try {
        // Phase B — no shared lock (INV-9.1); the request signal may abort
        // the live delivery.
        delivered = await deliverWork(deps, admitted);
    }
    catch (error) {
        // R6/N6: fail-closed settlement FIRST (re-acquired WITHOUT the
        // request signal — N6/H4), then the typed throw (N3). The interval
        // close stays INSIDE the same Phase C acquisition, before the settle
        // (the pre-fix order: evidence close, then state + evidence settle).
        await acquirePhaseC(deps, async () => {
            await closeIntervalTolerated(deps);
            await failClosedSettle(deps, error);
        });
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED, `TeamRuntime: work delivery to '${admitted.childSessionId}' of '${deps.instanceId}' failed: ${error instanceof Error ? error.message : String(error)}`, {
            instanceId: deps.instanceId,
            childSessionId: admitted.childSessionId,
            requestToken: deps.requestToken,
            cause: describeFailure(error),
        });
    }
    return (await acquirePhaseC(deps, () => settleWorkLocked(deps, admitted, delivered)));
}
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
export async function executeWorkChain(deps) {
    // Phase A — under the shared chain WITH the request signal (an abort
    // while waiting rejects with the abort reason and admits nothing).
    const phaseA = deps.teamLocks === undefined
        ? await admitWorkLocked(deps)
        : await withTeamLock(deps.teamLocks, deps.rootSessionId, () => admitWorkLocked(deps), asAbortLike(deps.signal));
    if (phaseA.kind === 'replay')
        return phaseA.result;
    // Phase B + Phase C — the chain is RELEASED during delivery.
    return completeWorkChainAfterAdmission(deps, phaseA);
}
/** Close the interval, tolerating a close-without-open (crash window). */
async function closeIntervalTolerated(deps) {
    const workActivity = deps.workActivity;
    if (workActivity === undefined)
        return;
    try {
        await workActivity.closeInterval({
            rootSessionId: deps.rootSessionId,
            instanceId: deps.instanceId,
            subject: WORK_ACTIVITY_SUBJECT,
            requestToken: deps.requestToken,
            correlation: deps.requestToken,
        });
    }
    catch (error) {
        if (!(isActivityError(error) &&
            error.code === ACTIVITY_ERROR_CODES.ACTIVITY_INTERVAL_NOT_OPEN)) {
            // An interval-close fault is a durable-protocol fault: surface it
            // (the settlement below still runs for the delivery-failure path's
            // caller — here it propagates to the chain's fail-closed handling).
            throw durableFailure('activity interval close', error, {
                instanceId: deps.instanceId,
                requestToken: deps.requestToken,
            });
        }
    }
}
/**
 * The R6 fail-closed settlement: RUNNING -> SETTLED through the port, with
 * a settlement fact carrying `workOutcome: 'delivery-failed'`. If the
 * settlement itself faults (port/CAS fault), the original fault is
 * rethrown after the settlement error is attached to `details` — the
 * caller-visible failure is the ORIGINAL chain fault.
 */
async function failClosedSettle(deps, original) {
    try {
        await settleAdmittedWork(deps, { failClosed: true, failure: original });
    }
    catch (settleError) {
        const cause = settleError instanceof Error ? settleError.message : String(settleError);
        const originalMessage = original instanceof Error ? original.message : String(original);
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, `TeamRuntime: the fail-closed settlement after '${originalMessage}' ALSO failed: ${cause}`, {
            phase: 'fail-closed settlement',
            instanceId: deps.instanceId,
            requestToken: deps.requestToken,
            originalCause: describeFailure(original),
        });
    }
}
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
export async function settleAdmittedWork(deps, options = {}) {
    const { repositories, rootSessionId, instanceId } = deps;
    const fresh = repositories.memberInstances.get(rootSessionId, instanceId);
    if (fresh === undefined) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND, `TeamRuntime: settlement target '${instanceId}' has no member record`, { instanceId });
    }
    const workOutcome = options.failClosed === true ? 'delivery-failed' : 'settled';
    if (fresh.lifecycle === 'SETTLED' || fresh.lifecycle === 'ARCHIVED' || fresh.lifecycle === 'DISPOSED') {
        // Convergence: no state commit. In the SETTLED case the state half
        // already committed earlier (crash window) — repair the missing
        // evidence fact exactly once (the caller scanned: it is absent).
        if (fresh.lifecycle === 'SETTLED') {
            const sequence = await commitDurableFact(repositories, rootSessionId, deps.now, FACT_LIFECYCLE_CHANGED, 
            // The original transition was RUNNING -> SETTLED (the state half
            // committed before the crash) — the repaired fact records that.
            settleFactPayload(deps, 'RUNNING', workOutcome, options.failure, options.memberResult));
            return { committed: false, to: 'SETTLED', sequence };
        }
        return { committed: false, to: fresh.lifecycle };
    }
    // RUNNING: the only remaining settlement case (CREATED is unreachable —
    // a work unit is admitted to RUNNING before it can settle).
    const next = applyLifecycleOperation(fresh, LIFECYCLE_OPERATIONS.SETTLE);
    await casTransition(deps, fresh.activityVersion, fresh.lifecycle, LIFECYCLE_OPERATIONS.SETTLE, next.lifecycle);
    const sequence = await commitDurableFact(repositories, rootSessionId, deps.now, FACT_LIFECYCLE_CHANGED, settleFactPayload(deps, fresh.lifecycle, workOutcome, options.failure, options.memberResult));
    return { committed: true, to: next.lifecycle, sequence };
}
/** The settlement fact payload (lossless JSON; no undefined values). */
function settleFactPayload(deps, from, workOutcome, failure, memberResult) {
    return {
        action: deps.action,
        caller: callerRef(deps.caller),
        instanceId: deps.instanceId,
        from,
        to: 'SETTLED',
        workOutcome,
        ...(failure !== undefined ? { failure: describeFailure(failure) } : {}),
        // issue #1 / CCR-5: the durable member result (lossless JSON) — the
        // work-status read-back serves it verbatim across a restart.
        ...(memberResult !== undefined ? { memberResult } : {}),
        requestToken: deps.requestToken,
        at: deps.now(),
    };
}
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
export const WORK_STATUS_CODES = {
    TOKEN_UNKNOWN: 'WORK_TOKEN_UNKNOWN',
    RESULT_NOT_PERSISTED: 'WORK_RESULT_NOT_PERSISTED',
    DELIVERY_FAILED: 'WORK_DELIVERY_FAILED',
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
export function scanWorkStatus(repositories, rootSessionId, requestTokens) {
    const seen = new Set();
    const entries = [];
    for (const requestToken of requestTokens) {
        if (seen.has(requestToken))
            continue;
        seen.add(requestToken);
        entries.push(scanWorkStatusToken(repositories, rootSessionId, requestToken));
    }
    return entries;
}
/** One token's entry (see {@link scanWorkStatus} for the contract). */
function scanWorkStatusToken(repositories, rootSessionId, requestToken) {
    const facts = scanWorkUnitFacts(repositories, rootSessionId, requestToken);
    const admitted = facts.admitted;
    const settled = facts.settled;
    if (admitted === undefined && settled === undefined) {
        return {
            requestToken,
            status: 'unavailable',
            error: {
                code: WORK_STATUS_CODES.TOKEN_UNKNOWN,
                message: `no work-unit facts for token '${requestToken}' in this root (never admitted, or a Root initial-work fact this read does not own)`,
            },
        };
    }
    const instanceId = admitted?.payload['targetInstanceId'] ??
        settled?.payload['instanceId'];
    if (settled === undefined) {
        // Admitted only: the async continuation is in flight (or crashed
        // before settlement — a same-token re-delegate RESUMES the unit;
        // the retry protocol, module docs).
        return {
            requestToken,
            status: 'running',
            ...(instanceId !== undefined ? { instanceId } : {}),
            admittedSequence: admitted?.sequence,
            resumePossible: true,
        };
    }
    const persisted = settled.payload['memberResult'];
    if (isPersistedMemberResult(persisted)) {
        return {
            requestToken,
            status: persisted.status,
            ...(instanceId !== undefined ? { instanceId } : {}),
            ...(admitted !== undefined ? { admittedSequence: admitted.sequence } : {}),
            settledSequence: settled.sequence,
            memberResult: persisted,
        };
    }
    const workOutcome = settled.payload['workOutcome'] === 'delivery-failed' ? 'delivery-failed' : 'settled';
    const code = workOutcome === 'delivery-failed' ? WORK_STATUS_CODES.DELIVERY_FAILED : WORK_STATUS_CODES.RESULT_NOT_PERSISTED;
    return {
        requestToken,
        status: 'unavailable',
        ...(instanceId !== undefined ? { instanceId } : {}),
        ...(admitted !== undefined ? { admittedSequence: admitted.sequence } : {}),
        settledSequence: settled.sequence,
        workOutcome,
        error: {
            code,
            message: workOutcome === 'delivery-failed'
                ? 'the work unit settled fail-closed (delivery fault); no member result was persisted'
                : 'the work unit durably settled but its settlement fact carries no persisted memberResult (pre-CCR-5 history)',
        },
    };
}
/**
 * The persisted memberResult guard (issue #1 / CCR-5): the lossless JSON
 * read back from the durable fact must be the closed WorkDeliveryResult
 * shape (requestToken + a closed status) before it is served verbatim.
 */
function isPersistedMemberResult(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const candidate = value;
    if (typeof candidate['requestToken'] !== 'string')
        return false;
    if (typeof candidate['status'] !== 'string')
        return false;
    return WORK_DELIVERY_STATUSES.includes(candidate['status']);
}
//# sourceMappingURL=work-execution.js.map