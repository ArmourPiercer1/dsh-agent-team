/**
 * P6-T2 — the TeamRuntime: ONE unified authority facade for every
 * runtime/control action against EXISTING team members
 * (acceptance: "TeamRuntime 是控制动作统一 authority facade").
 *
 * Every later Team tool (P6-T6) and the UI Remote (P8) expresses its action
 * as a call through `performAction` — there is no second admission path.
 * Member CREATION is still exclusively the P6-T1 ActivationProvider's job
 * (invariant 26): this facade CALLS the provider for follow-up/delegate
 * creation and never bypasses or re-implements it.
 *
 * The documented enforcement order (each step before the next; a failure
 * throws the closed TeamRuntimeError code and has ZERO durable side
 * effects until the effect phase):
 *
 *   1. VALIDATE the request shape (closed action vocabulary, per-action
 *      required fields) — REQUEST_MALFORMED / ACTION_UNKNOWN;
 *   2. RESOLVE the target instance — instanceId-first
 *      `(rootSessionId, instanceId)` addressing ONLY (invariant 18); label/
 *      template tokens are REJECTED (invariant 19) — TEAM_SESSION_NOT_FOUND
 *      / TEAM_ROOT_BINDING_MISSING / BLUEPRINT_UNRESOLVED /
 *      BLUEPRINT_HASH_MISMATCH / ACTION_ADDRESSING_REJECTED /
 *      INSTANCE_NOT_FOUND;
 *   3. RESOLVE the caller identity + role from the durable TeamDomain
 *      (human / leader / member) — CALLER_NOT_FOUND / CALLER_ROLE_STALE;
 *   4. CALLER AUTHORITY + mutation envelope — the closed role set (members
 *      cannot create/delegate, invariant 37) then the envelope bounds (leader: team
 *      envelope; member: template envelope intersect team envelope,
 *      further narrowed by the instance overlay; human: not team-envelope-
 *      bounded, invariant 34) — CALLER_AUTHORITY_DENIED /
 *      ENVELOPE_OUT_OF_BOUNDS;
 *   5. COMPATIBILITY/ADMISSION gate for NEW WORK only (invariant 50) —
 *      COMPATIBILITY_BLOCKED;
 *   6. QUOTA — enforced solely inside the ActivationProvider for the
 *      creation/delegate effects (single source of truth; the provider
 *      serializes per team) — QUOTA_EXCEEDED_*;
 *   7. EFFECT — the durable writes under the per-team lock (fresh views;
 *      state first, evidence second — see action-router/effects.ts). For
 *      the full-wiring WORK chain the effect is three-phased (INV-9.1,
 *      repair-r1 F3-A): Phase A (admission) stays under the lock TOGETHER
 *      with the gate (step 5); the lock is then released and Phase B
 *      (delivery — the member's turn, no shared lock) + Phase C
 *      (settlement — re-acquired WITHOUT the request signal) run outside
 *      it. See `work-execution.ts` for the topology.
 */
import { checkCallerRoleAuthority, callerEnvelope, enforceCompatibilityGate, enforceEnvelope, isNewWorkAdmission, resolveCaller, resolveTeamAndTarget, validateActionRequest, workExecutionModeOf, } from '../admission/index.js';
import { executeEffect, executeEffectLocked, isWorkChainStage, withTeamLock, asAbortLike } from './effects.js';
import { scanWorkStatus } from './work-execution.js';
/**
 * Work-completion wake-up (plan §8) — the durable terminal observation:
 * after a DETACHED (`execution: 'async'`) work unit's Phase B/C settles
 * (fulfilled OR rejected — N3 throw-after-settle makes both land on a
 * durable read), re-read the durable work status and notify ONLY when
 * the terminal settlement fact exists.
 *
 * The SOLE terminal authority is `entry.settledSequence !== undefined`
 * (plan §10) — never the promise outcome, never the member lifecycle,
 * never "a memberResult exists": a unit whose settlement fact did not
 * commit (a durable write fault) is still `running` here and must NOT
 * be reported as settled (plan §12), and a fail-closed
 * `WORK_DELIVERY_FAILED` settlement IS terminal (the fail-closed fact
 * is durable before the throw — plan §11) and MUST notify.
 *
 * This helper never swallows: a scan or notification fault PROPAGATES
 * to the caller (the router's observer swallows it as a liveness
 * failure — plan §13).
 */
async function notifyAsyncWorkCompletionIfTerminal(args) {
    const { notifier } = args;
    if (notifier === undefined)
        return;
    const entry = scanWorkStatus(args.repositories, args.rootSessionId, [args.requestToken])[0];
    if (entry === undefined || entry.settledSequence === undefined)
        return;
    await notifier.notifyWorkCompletion({
        rootSessionId: args.rootSessionId,
        requestToken: args.requestToken,
        // The receipt-carried instance id (captured at the async branch —
        // plan §9) is authoritative; the durable fact is the fallback (the
        // same value the admission fact records).
        instanceId: args.instanceId ?? entry.instanceId ?? '',
        ...(args.taskSummary !== undefined ? { taskSummary: args.taskSummary } : {}),
        targets: [{ kind: 'leader' }],
    });
}
/**
 * Create the TeamRuntime over the injected ports.
 *
 * @param options - the TeamDomain (durable authority), the P6-T1
 *   ActivationProvider (the sole creation path), the blueprint catalog, the
 *   environment/external policy fact ports, and the deterministic clock.
 * @returns the facade (the per-team effect lock map is the installed
 *   shared coordinator chain when `options.teamLocks` is given, otherwise
 *   owned by the returned closure — one map per runtime instance).
 *
 *   issue #1 / CCR-2: the returned facade additionally exposes
 *   `inFlightDetachedWork` — the READONLY set of this runtime's async
 *   detached continuations (in-flight Phase B/C of `execution: 'async'`
 *   work admissions). It is NOT part of the frozen `TeamRuntime`
 *   interface (the interface stays CCR-1 stable for fakes): it exists
 *   for test observability and a future shutdown drain.
 */
export function createTeamRuntime(options) {
    // P8-S5B (CR-8): the per-team chain is the SHARED coordinator map when
    // the production root installs one (team-mutating operations across the
    // router / activity / lifecycle modules serialize on ONE chain per
    // team); otherwise a private map (the P6-T2 default, unchanged).
    const teamLocks = options.teamLocks ?? new Map();
    const repositories = options.teamDomain.repositories;
    // issue #1 / CCR-2: the async detached continuations of THIS runtime
    // (one entry per in-flight Phase B/C of an `execution: 'async'` work
    // admission; removed on settlement or fail-closed throw).
    const inFlightDetachedWork = new Set();
    async function performAction(request) {
        // Step 1 — validate the request shape (closed action vocabulary).
        const spec = validateActionRequest(request);
        // Step 2 — resolve team + target (instanceId-first addressing).
        const resolved = resolveTeamAndTarget(repositories, options.blueprintCatalog, request, spec);
        const rootSessionId = resolved.rootSessionId;
        const blueprint = resolved.bound.blueprint;
        // Step 3 — resolve the caller identity + role.
        const caller = resolveCaller(repositories, rootSessionId, request.caller);
        // Step 4 — role authority, then the mutation envelope.
        checkCallerRoleAuthority(spec, caller);
        const overrides = repositories.overrides.list(rootSessionId);
        const envelope = callerEnvelope(blueprint, caller, overrides);
        enforceEnvelope(spec, envelope);
        // Step 5/6/7 — the effect phase. For NEW WORK admissions the
        // compatibility gate and Phase A of the work effect (the admission:
        // fresh read, dedup scan, CAS + admission fact, activity-interval
        // open) run in ONE team-chain acquisition (P8-S5B, CR-8/R5, preserved
        // by INV-9.1): the gate may re-probe inline (a durable compatibility
        // write), so a racing new-work admission for the same team cannot
        // interleave its own re-probe into this consultation's
        // read→probe→re-read→admit window. Non-new-work actions keep the
        // documented order: steps 1–4 outside the lock, the effect alone
        // inside it. (Quota inside the provider for creation; durable writes
        // under the per-team lock.)
        const ctx = {
            repositories,
            activationProvider: options.activationProvider,
            externalPolicyFacts: options.externalPolicyFacts,
            now: options.now,
            spec,
            request,
            rootSessionId,
            caller,
            blueprint,
            lifecycleCommit: options.lifecycleCommit,
            workDelivery: options.workDelivery,
            workActivity: options.workActivity,
            lifecyclePorts: options.lifecyclePorts,
            teamLocks,
            ...(resolved.target !== undefined ? { target: resolved.target } : {}),
        };
        const staged = isNewWorkAdmission(spec)
            ? await withTeamLock(teamLocks, rootSessionId, async () => {
                const environmentFacts = await options.environmentFacts();
                await enforceCompatibilityGate(repositories, blueprint, rootSessionId, environmentFacts, options.now);
                return executeEffectLocked(ctx);
            }, asAbortLike(request.signal))
            : await executeEffect(teamLocks, ctx);
        // INV-9.1 (repair-r1 F3-A): a full-wiring work admission returns the
        // STAGED chain — Phase A completed inside the acquisition above and
        // the chain is now RELEASED. `complete` runs Phase B (delivery: NO
        // shared lock — the member's own team tools, e.g.
        // `team_report_progress`, re-enter this facade and take the SAME
        // chain while the turn runs: the F3 deadlock removed) and Phase C
        // (settlement: re-acquires the SAME chain WITHOUT the request signal
        // — N6/H4: a request aborted during delivery still gets its
        // fail-closed settlement committed) outside it. Every other effect
        // (and the P6-T2 evidence wiring) is plain data — no staging.
        //
        // issue #1 / CCR-2 + CCR-4: the async execution mode DETACHES the
        // continuation — `performAction` returns the durable admission
        // receipt (CCR-3's terminal state is read back through
        // `work-status` / `team_collect`), and Phase B/C runs in the
        // background WITHOUT the caller's signal (the ownership transferred
        // at the admission commit). The detached continuation owns its
        // fail-closed settlement (committed inside `complete` before any
        // throw); its throw is OBSERVED here and never rethrown (no caller
        // awaits it — the unhandled-rejection must not escape). The sync
        // path (the default — CCR-1) completes the chain inline with the
        // request signal, byte-identical to the alpha.2 behavior.
        let effect;
        if (isWorkChainStage(staged)) {
            if (workExecutionModeOf(request) === 'async') {
                const task = staged.complete(undefined);
                inFlightDetachedWork.add(task);
                // Work-completion wake-up (plan §7.2): the completion observer runs
                // on BOTH the fulfillment and the rejection settlement — N3:
                // `completeWorkChainAfterAdmission` throws `WORK_DELIVERY_FAILED`
                // AFTER its fail-closed settle, so the detached promise rejects on
                // a DURABLY SETTLED unit and still must notify. The observer:
                //   1. removes the task from `inFlightDetachedWork` (unchanged
                //      Phase B/C observability contract — settlement or fail-closed
                //      throw);
                //   2. fires the best-effort completion notification (plan §8):
                //      re-read the durable work status, notify only when the
                //      terminal settlement fact exists. The notification promise
                //      is NEVER added to `inFlightDetachedWork` (plan §7.2 note):
                //      the set stays Phase B/C only (no new in-flight surface, no
                //      new lifecycle dependency).
                // A scan or delivery fault is a liveness failure only (plan §13):
                // swallowed here — never rethrown, never mutating the settled work,
                // never retried (the durable fact + `team_collect` are the recovery
                // paths). Absent port → pure deletion (the pre-wake-up behavior).
                const receiptEffect = staged.receipt;
                const receiptInstanceId = receiptEffect.kind === 'work-admitted' || receiptEffect.kind === 'member-activated'
                    ? receiptEffect.instanceId
                    : undefined;
                const payloadTaskSummary = typeof request.payload?.['taskSummary'] === 'string'
                    ? request.payload['taskSummary']
                    : undefined;
                const notifier = options.workCompletionNotification;
                const observeCompletion = () => {
                    inFlightDetachedWork.delete(task);
                    if (notifier === undefined)
                        return;
                    void notifyAsyncWorkCompletionIfTerminal({
                        repositories,
                        rootSessionId,
                        requestToken: request.requestToken,
                        instanceId: receiptInstanceId,
                        taskSummary: payloadTaskSummary,
                        notifier,
                    }).catch(() => {
                        // plan §13: diagnostic-only liveness fault. The router has no
                        // logger dependency (minimal change); the durable settlement
                        // fact + `team_collect` read-back are the recovery paths.
                    });
                };
                void task.then(observeCompletion, observeCompletion);
                effect = staged.receipt;
            }
            else {
                effect = await staged.complete(request.signal);
            }
        }
        else {
            effect = staged;
        }
        return {
            status: 'executed',
            action: spec.name,
            rootSessionId,
            callerRole: caller.role,
            ...(resolved.target !== undefined
                ? { targetInstanceId: resolved.target.instanceId }
                : {}),
            effect,
            requestToken: request.requestToken,
        };
    }
    return { performAction, inFlightDetachedWork };
}
//# sourceMappingURL=router.js.map