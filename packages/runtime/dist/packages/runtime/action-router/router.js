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
import { actionImpactOf, checkCallerRoleAuthority, callerEnvelope, enforceEnvelope, enforceRequirementGate, isNewWorkAdmission, resolveCaller, resolveTeamAndTarget, validateActionRequest, workExecutionModeOf, } from '../admission/index.js';
import { ACTION_IMPACT_CLASSES } from '../requirements/index.js';
import { ACTIVATION_ERROR_CODES } from '../activation/index.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError, isTeamRuntimeError, } from '../admission/errors.js';
import { CONTROL_ERROR_CODES, CONTROL_EXECUTION_COUPLINGS, CONTROL_REQUEST_KINDS, isControlError, } from '../control/index.js';
import { sha256Hex } from '../../domain/blueprint/src/index.js';
import { canonicalJsonStringify } from '../../contracts/src/index.js';
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
 * pre-alpha3 PR-E (plan §E.9) — the target template id of one NEW WORK
 * request (for the requirement impact's scopeRefs): the follow-up's
 * addressed member template, the delegate's named template (or the
 * addressed member's template in the instance-first form), the
 * create-member's named template; `undefined` when the action names no
 * template (the Team scope only).
 */
function newWorkTargetTemplateId(request, spec, resolved, repositories) {
    if (request.action === 'follow-up') {
        return resolved.target !== undefined ? String(resolved.target.templateId) : undefined;
    }
    if (request.action === 'delegate') {
        if (request.delegationTemplateId !== undefined) {
            return String(request.delegationTemplateId);
        }
        if (request.delegationInstanceId !== undefined) {
            const member = repositories.memberInstances.get(resolved.rootSessionId, String(request.delegationInstanceId));
            return member !== undefined ? String(member.templateId) : undefined;
        }
        return undefined;
    }
    // pre-alpha3 W3-D (review fix F9, guide §8): send-message is a cross-agent
    // execution trigger — its work targets the RECIPIENT's template (the wake
    // delivers input to that member). The gate then blocks the trigger if the
    // recipient's template scope (or the team scope) is down.
    if (request.action === 'send-message') {
        const recipientInstanceId = request.payload?.['recipientInstanceId'];
        if (recipientInstanceId !== undefined) {
            // The lookup is a BEST-EFFORT template reference for the gate: an
            // unresolvable / malformed recipient token must NOT pre-empt the
            // effect's addressing rejection (resolveInstanceToken raises
            // ACTION_ADDRESSING_REJECTED) with a domain parse error.
            try {
                const recipient = repositories.memberInstances.get(resolved.rootSessionId, String(recipientInstanceId));
                return recipient !== undefined ? String(recipient.templateId) : undefined;
            }
            catch {
                return undefined;
            }
        }
        return undefined;
    }
    // create-member: the named template.
    return request.delegationTemplateId !== undefined ? String(request.delegationTemplateId) : undefined;
}
/**
 * pre-alpha3 PR-E (plan §E.9) — the CANONICAL Control subject of one
 * recovery dispatch: the concrete work unit the human reviews — the
 * instance for follow-up, the named template for delegate/create-member,
 * the team when no narrower scope is named. (A template/team subject must
 * NOT carry `targetInstanceId` — the control facade rejects the
 * combination fail-closed.)
 */
function recoveryDispatchSubject(request, targetTemplateId, rootSessionId) {
    if (request.action === 'follow-up' && request.targetInstanceId !== undefined) {
        return { kind: 'instance', instanceId: String(request.targetInstanceId) };
    }
    // fix-control-authz H: a send-message is INSTANCE-addressed — the
    // messaging coordinator (and the facade's own addressing) carry the
    // RECIPIENT in `targetInstanceId`; the recovery subject must be that
    // recipient instance. The old mapping fell through to the recipient's
    // TEMPLATE subject while the dispatch still passed `targetInstanceId`
    // — a combination the real control validator rejects fail-closed
    // (CONTROL_REQUEST_MALFORMED), so the recovery send-message never
    // reached review.
    if (request.action === 'send-message' && request.targetInstanceId !== undefined) {
        return { kind: 'instance', instanceId: String(request.targetInstanceId) };
    }
    if (targetTemplateId !== undefined) {
        return { kind: 'template', templateId: targetTemplateId };
    }
    return { kind: 'team', rootSessionId };
}
/**
 * fix-control-authz B — the FROZEN review snapshot: a deep copy of the
 * dispatched request (the `payload` deep-copied + recursively frozen;
 * the transient `signal` rides by reference — it is never serialized or
 * persisted) taken ONCE at dispatch time, before anything durable is
 * written. The SAME frozen snapshot feeds the review payload (persist +
 * digest) and the post-approval re-execution — the review UI and the
 * execution share ONE immutable object (target-design §11.2/§11.3:
 * "UI 展示的 payload 与实际执行使用同一个 frozen object"): a mutation of
 * the caller's original request while the approval is pending can never
 * change what is reviewed or what is executed.
 */
function deepFreezeCopyValue(value) {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((entry) => deepFreezeCopyValue(entry)));
    }
    if (value !== null && typeof value === 'object') {
        const copy = {};
        for (const [key, entry] of Object.entries(value)) {
            copy[key] = deepFreezeCopyValue(entry);
        }
        return Object.freeze(copy);
    }
    return value;
}
function freezeRequestSnapshot(request) {
    const snapshot = {
        rootSessionId: request.rootSessionId,
        action: request.action,
        caller: { ...request.caller },
        requestToken: request.requestToken,
        ...(request.payload !== undefined
            ? { payload: deepFreezeCopyValue(request.payload) }
            : {}),
        ...(request.targetInstanceId !== undefined ? { targetInstanceId: request.targetInstanceId } : {}),
        ...(request.delegationTemplateId !== undefined
            ? { delegationTemplateId: request.delegationTemplateId }
            : {}),
        ...(request.delegationInstanceId !== undefined
            ? { delegationInstanceId: request.delegationInstanceId }
            : {}),
        ...(request.execution !== undefined ? { execution: request.execution } : {}),
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
    };
    Object.freeze(snapshot.caller);
    return Object.freeze(snapshot);
}
/**
 * pre-alpha3 PR-E (plan §E.9) + fix-control-authz B — the COMPLETE
 * normalized review payload of one recovery dispatch (lossless JSON):
 * every fact a human reviewer needs to decide — the COMPLETE normalized
 * invocation (target-design §11.3: toolName, rootSessionId, requestToken,
 * subject, arguments — the work prompt / attachedContext / the message
 * recipient + body — execution mode, the delegation identity), the
 * blocked scopes with their fatal requirements and the downed capability
 * subjects, and the reduced-authority preview (the reduced ORIGINAL
 * authority: the downed subjects unavailable, everything else unchanged,
 * the external hard ceiling absolute). Built from the FROZEN snapshot
 * (the `request` argument is the `freezeRequestSnapshot` result) so the
 * persisted payload, its digest and the post-approval execution share
 * one immutable object. The digest of this payload is the review
 * identity the UI shows (the "exact reviewed payload" — scenario: the UI
 * must display what was actually approved; a work-content-only change —
 * e.g. the prompt — MUST change the digest).
 */
function buildRecoveryDispatchPayload(args) {
    const { request } = args;
    return {
        schema: 'dsh-agent-team/recovery-dispatch/v1',
        // The COMPLETE normalized invocation (spec §11.3 — the human
        // reviews exactly what will execute):
        toolName: request.action,
        rootSessionId: args.rootSessionId,
        requestToken: request.requestToken,
        subject: args.subject,
        // The full model-visible arguments of the reviewed operation (the
        // work prompt / attachedContext / taskSummary / label — or, for a
        // send-message, the recipient + subject + body). Deep-frozen: a
        // caller mutation of the original payload after this point cannot
        // change the reviewed content.
        arguments: (request.payload !== undefined ? request.payload : {}),
        ...(request.execution !== undefined ? { execution: request.execution } : {}),
        ...(request.delegationTemplateId !== undefined
            ? { delegationTemplateId: request.delegationTemplateId }
            : {}),
        ...(request.delegationInstanceId !== undefined
            ? { delegationInstanceId: request.delegationInstanceId }
            : {}),
        // The existing review context (the blocked scope + the reduced
        // authority preview):
        action: request.action,
        caller: request.caller,
        ...(request.targetInstanceId !== undefined ? { targetInstanceId: request.targetInstanceId } : {}),
        ...(args.targetTemplateId !== undefined ? { templateId: args.targetTemplateId } : {}),
        requestedOperation: `one recovery attempt of '${args.request.action}'${args.request.targetInstanceId !== undefined
            ? ` on member '${args.request.targetInstanceId}'`
            : args.targetTemplateId !== undefined
                ? ` on template '${args.targetTemplateId}'`
                : ''}`,
        blockedScopes: [...args.blockedScopes],
        downedCapabilitySubjects: [...args.unavailableSubjects],
        reducedAuthority: {
            policy: 'reduced original authority (plan §E.9)',
            unavailableSubjects: [...args.unavailableSubjects],
            otherwise: 'unchanged (the original permissions apply)',
            externalHardCeiling: 'absolute (never bypassed)',
        },
        effect: 'allow: exactly ONE reviewed recovery attempt of this operation on the reduced original authority; deny/abandon: zero durable effect (the operation remains blocked)',
    };
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
    // pre-alpha3 PR-E (plan §E.9) + fix-control-authz D: the recovery-
    // dispatch ATTEMPT identity. Each attempt carries a FRESH unique nonce
    // in its control correlation (the correlation is the logical-operation
    // identity that ties one request + decision to one logical operation).
    // EVERY attempt requires a fresh Human (target-design §11.3 "每次
    // Recovery dispatch attempt 都重新审批；不做 approval replay"; ADR-19
    // "每一次真实执行尝试都重新审批，不复用上一次批准"): a retry after a
    // deny AND a COLD-RESTART retry of the SAME requestToken must create a
    // NEW pending request — never re-arm an existing approval. The old
    // process-local COUNTER reset to 0 on restart: a cold retry re-derived
    // the first attempt's correlation and directly re-armed the stale
    // inline approval (the persisted allow executed the new invocation
    // with no fresh Human; work idempotency could not protect — no work
    // had been committed yet). A RESTART-UNIQUE per-attempt nonce
    // (randomUUID — never derivable from the requestToken alone) makes
    // that impossible by construction.
    const platformCrypto = globalThis;
    let recoveryAttemptCounter = 0;
    function nextRecoveryAttemptId() {
        recoveryAttemptCounter += 1;
        const uuid = typeof platformCrypto.crypto?.randomUUID === 'function'
            ? platformCrypto.crypto.randomUUID()
            : undefined;
        return uuid !== undefined
            ? uuid
            : `fallback-${recoveryAttemptCounter.toString(36)}-${Date.now().toString(36)}`;
    }
    /**
     * pre-alpha3 PR-E (plan §E.9) — the recovery dispatch: when the
     * requirement gate blocked a NEW WORK attempt with
     * `details.recoveryDispatchAvailable: true` and a Control service is
     * wired, offer the human-reviewed recovery Control request (the inline
     * coupling) OUTSIDE the team lock. Returns the fresh admission outcome
     * on a durable `allow` (the caller RETURNS it — the staged-effect
     * machinery of the blocked attempt is skipped: the fresh performAction
     * ran the whole chain itself); throws the typed zero-effect block on
     * `deny` / abort (`details.controlDecision` = `deny` / `abandoned` — the
     * operation remains blocked, no durable effect); returns `undefined` for
     * a non-offer error (a different code, no `recoveryDispatchAvailable`,
     * no Control service wired — the caller re-throws the ORIGINAL error
     * unchanged: the original typed contract stands).
     */
    async function dispatchRecoveryIfOffered(error, args) {
        if (!isTeamRuntimeError(error) ||
            error.code !== TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED) {
            return undefined;
        }
        const details = (error.details ?? {});
        if (details['recoveryDispatchAvailable'] !== true)
            return undefined;
        const blockedScopes = Array.isArray(details['blockedScopes'])
            ? details['blockedScopes'].map((value) => String(value))
            : [];
        const unavailableSubjects = Array.isArray(details['unavailableSubjects'])
            ? details['unavailableSubjects'].map((value) => String(value))
            : [];
        const controlService = options.controlServiceRef?.current;
        if (controlService === undefined) {
            // No Control coupling wired (the pre-control wiring / test worlds
            // without a control service): the original typed block stands
            // (fail closed — recovery dispatch is an OFFER, never a bypass).
            return undefined;
        }
        const { request } = args;
        // fix-control-authz B: the request is normalized + deep-frozen
        // ONCE, now — before anything durable is written. Every consumer
        // below (the subject, the review payload, the digest, the
        // post-approval re-execution) reads this ONE frozen snapshot: the
        // review UI and the execution share the same immutable object
        // (target-design §11.2/§11.3), and a mutation of the caller's
        // original request while the approval is pending can never change
        // what is reviewed or what is executed.
        const frozen = freezeRequestSnapshot(request);
        const subject = recoveryDispatchSubject(frozen, args.targetTemplateId, args.rootSessionId);
        const payload = buildRecoveryDispatchPayload({
            request: frozen,
            subject,
            rootSessionId: args.rootSessionId,
            targetTemplateId: args.targetTemplateId,
            blockedScopes,
            unavailableSubjects,
        });
        // fix-control-authz D: the restart-unique per-attempt identity (a
        // retry after a deny AND a cold-restart retry of the same token are
        // NEW attempts — a NEW pending request, a fresh Human; the stale
        // approval can never authorize a new invocation).
        const attemptId = nextRecoveryAttemptId();
        const record = await controlService.requestControl({
            rootSessionId: args.rootSessionId,
            caller: frozen.caller,
            kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
            subject,
            ...(frozen.targetInstanceId !== undefined
                ? { targetInstanceId: String(frozen.targetInstanceId) }
                : {}),
            actionName: frozen.action,
            correlation: `recovery:${frozen.requestToken}:${attemptId}`,
            summary: `recovery dispatch: one reviewed attempt of '${frozen.action}' on the blocked ` +
                `scope(s) [${blockedScopes.join(', ')}] on the reduced original authority`,
            reviewPayload: payload,
            reviewPayloadDigest: `sha256:${sha256Hex(canonicalJsonStringify(payload))}`,
            executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
        });
        let decision;
        try {
            decision = await controlService.awaitControlDecision({
                rootSessionId: args.rootSessionId,
                requestId: record.requestId,
                ...(frozen.signal !== undefined
                    ? { signal: frozen.signal }
                    : {}),
            });
        }
        catch (waitError) {
            if (isControlError(waitError) &&
                (waitError.code === CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED ||
                    waitError.code === CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED ||
                    // fix-control-authz C: the request was DURABLY ABANDONED while
                    // the wait parked (the terminal mark settled the waiter — the
                    // wait bridge's typed terminal outcome, fix-control-authz C):
                    // the same zero-effect typed block stands (the terminal mark
                    // is already durable — the abandon below is the tolerated
                    // concurrent-abandon no-op).
                    waitError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)) {
                // Abort: the requester ABANDONS the request — the durable
                // `control-request-abandoned` terminal mark is written BEFORE
                // return (the zero durable effect is guaranteed by the terminal
                // mark: the request can never become an allow afterwards).
                try {
                    await controlService.abandonControlRequest({
                        rootSessionId: args.rootSessionId,
                        caller: frozen.caller,
                        requestId: record.requestId,
                        reason: String(waitError.code),
                    });
                }
                catch (abandonError) {
                    // pre-alpha3 W3-E (review fix F2, guide §3): NO best-effort
                    // swallow. A REAL durable-commit failure of the abandon (the
                    // `allocateSequence()` fail / ledger `put()` fail / domain-closed /
                    // duplicate-identity) must propagate the typed close/storage
                    // failure — the abandon did NOT land, so we must NOT claim
                    // `abandoned` (the request is still PENDING and later resolvable).
                    // The ONE tolerated outcome is a CONCURRENT abandon (the request
                    // was already abandoned — `CONTROL_REQUEST_ABANDONED`): the
                    // terminal mark is already durable, so the zero-effect typed
                    // outcome below stands (keep the claim).
                    if (isControlError(abandonError) &&
                        abandonError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED) {
                        // Concurrent abandon: the terminal mark is already durable — keep
                        // the claim (the zero-effect typed outcome below stands).
                    }
                    else {
                        throw abandonError;
                    }
                }
                throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the recovery dispatch was abandoned (the wait aborted) — zero durable effect (the operation remains blocked)', {
                    rootSessionId: args.rootSessionId,
                    status: 'BLOCKED_FATAL',
                    gateReason: 'requiredScopeDown',
                    blockedScopes: [...blockedScopes],
                    source: 'requirement-gate',
                    controlDecision: 'abandoned',
                    controlRequestId: record.requestId,
                });
            }
            throw waitError;
        }
        if (decision.decision !== 'allow') {
            // Deny: ZERO durable effect (the durable deny decision is the
            // record; the operation remains blocked).
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the recovery dispatch was denied by the reviewer — zero durable effect (the operation remains blocked)', {
                rootSessionId: args.rootSessionId,
                status: 'BLOCKED_FATAL',
                gateReason: 'requiredScopeDown',
                blockedScopes: [...blockedScopes],
                source: 'requirement-gate',
                controlDecision: 'deny',
                controlRequestId: record.requestId,
            });
        }
        // fix-control-authz C: the FINAL inline-authorization / terminal
        // check immediately before the side effects (the wait→admission
        // race): the wait bridge settles on the decision it OBSERVED; if the
        // terminal abandon mark landed AFTER that observation (an allow +
        // abandon race — every interleaving), or the caller's signal aborted
        // after the settle (the frozen invocation is dead), the allow must
        // NEVER execute — the typed zero-effect block stands (the same
        // `controlDecision: 'abandoned'` contract as the abort path).
        const frozenSignal = asAbortLike(frozen.signal);
        if (frozenSignal !== undefined && frozenSignal.aborted) {
            // The invocation was cancelled after the wait settled: durably
            // close the request (legal for a decided request — the abandon
            // closes the durable allow; the tolerated outcome is the mark
            // already present) and keep the typed zero-effect block.
            try {
                await controlService.abandonControlRequest({
                    rootSessionId: args.rootSessionId,
                    caller: frozen.caller,
                    requestId: record.requestId,
                    reason: 'wait-aborted',
                });
            }
            catch (abandonError) {
                if (!(isControlError(abandonError) &&
                    abandonError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED)) {
                    throw abandonError;
                }
            }
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the recovery dispatch was abandoned (the invocation aborted after the wait settled) — zero durable effect (the operation remains blocked)', {
                rootSessionId: args.rootSessionId,
                status: 'BLOCKED_FATAL',
                gateReason: 'requiredScopeDown',
                blockedScopes: [...blockedScopes],
                source: 'requirement-gate',
                controlDecision: 'abandoned',
                controlRequestId: record.requestId,
            });
        }
        const terminalState = await controlService.listControlState(args.rootSessionId);
        if (terminalState.abandonments.some((a) => a.requestId === record.requestId)) {
            // The terminal mark won after the wait settled (the stale allow is
            // closed — the abandon is the terminal mark, like `stale-denied`):
            // the allow never executes. The mark is already durable — no
            // abandon call (exactly-once).
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the recovery dispatch was abandoned (the durable abandon mark landed after the wait settled — the stale allow is closed) — zero durable effect (the operation remains blocked)', {
                rootSessionId: args.rootSessionId,
                status: 'BLOCKED_FATAL',
                gateReason: 'requiredScopeDown',
                blockedScopes: [...blockedScopes],
                source: 'requirement-gate',
                controlDecision: 'abandoned',
                controlRequestId: record.requestId,
            });
        }
        // Allow: the FRESH admission with the reviewed recovery marker (the
        // full chain re-runs — the gate now classifies the action as
        // recoveryWork and allows it on the blocked scopes, writing the
        // incident-opened fact; the provider admits the activation on the
        // reduced original authority). fix-control-authz B: the re-execution
        // uses the SAME frozen snapshot the review payload was built from —
        // the reviewed immutable object, never the caller's (possibly
        // mutated) original request.
        // fix-control-authz C (the external-review TOCTOU): the marker ALSO
        // carries the reviewed control request id — the terminal check above
        // is a FAST PATH, not the boundary (a durable abandon may land AFTER
        // it — e.g. during the gate re-probe await of this re-execution).
        // The effect-admission boundary re-validates THIS request's durable
        // terminal state at the first-effect commit (the linearized check —
        // see `commitEffectIfAuthorized`); an abandon that lands in the
        // window is seen there and the effect never commits.
        return performAction({
            ...frozen,
            recovery: {
                scopeKeys: [...blockedScopes],
                unavailableSubjects: [...unavailableSubjects],
                controlRequestId: record.requestId,
            },
        });
    }
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
        // REQUIREMENT GATE (pre-alpha3 PR-E: the successor of the P6-T2
        // compatibility gate — the `requirements/` module is authoritative)
        // and Phase A of the work effect (the admission: fresh read, dedup
        // scan, CAS + admission fact, activity-interval open) run in ONE
        // team-chain acquisition (P8-S5B, CR-8/R5, preserved by INV-9.1): the
        // gate may re-probe inline (a durable compatibility write) AND write
        // the incident fact lines, so a racing new-work admission for the same
        // team cannot interleave its own re-probe into this consultation's
        // read→probe→re-read→admit window. Non-new-work actions keep the
        // documented order: steps 1–4 outside the lock, the effect alone
        // inside it. (Quota inside the provider for creation; durable writes
        // under the per-team lock.)
        //
        // The gate consults on the action's REQUIREMENT IMPACT (the closed
        // impact class + the scopes the work depends on — plan §E.7, never the
        // coarse category): a BLOCKED scope (a required requirement down)
        // blocks normal work; the typed block carries
        // `details.recoveryDispatchAvailable` when the human-reviewed RECOVERY
        // DISPATCH (plan §E.9) is offered. The recovery CONTROL round-trip
        // (the inline coupling — the human wait) runs OUTSIDE the team lock:
        // a human wait must never hold the team chain. Allow → a FRESH
        // `performAction` with the reviewed recovery marker (the impact flips
        // to `recoveryWork`; the gate then allows on the blocked scopes and
        // writes the incident-opened fact; the provider admits the activation
        // on the reduced original authority). Deny / abort → the typed
        // zero-effect block (the operation remains blocked; no durable effect
        // of the attempted work).
        const targetTemplateId = newWorkTargetTemplateId(request, spec, resolved, repositories);
        const impact = actionImpactOf(request.action, targetTemplateId, request.recovery !== undefined);
        // fix-control-authz C (the residual pre-commit awaits) — the
        // SETTLE TRACKING for the systematic pre-commit abort settle
        // (declared ABOVE the ctx — the ctx marker callbacks close over
        // them): `effectCommitStarted` flips at the EFFECT'S OWN first
        // durable write (the residual-3 marker move — previously it
        // flipped at the unit's closure entry, BEFORE the provider
        // preflight, so a pre-reservation reject falsely disabled this
        // settle; the pre-reservation region of the activation unit is now
        // pre-commit by construction). A durable write may have landed
        // after the flip — the post-commit world: the typed effect fault
        // surfaces unchanged and the committed fact is NEVER re-marked.
        // `boundarySettled` flips when the unit's pre-commit rejection was
        // already converted into the typed abandon block (the close is
        // settled — no double settle). `closeFaultObserved` flips when the
        // durable close persist FAULTED on this admission (the residual-3
        // one-shot close-failure contract, defect c): the settle must never
        // re-attempt a failed close (a second attempt would succeed and
        // mask the first fault as a settled close — the first close
        // failure is the terminal outcome, the typed DURABLE_WRITE_FAILED
        // escapes as-is). All false = the admission is still pre-commit
        // (the settle applies).
        let effectCommitStarted = false;
        let boundarySettled = false;
        let closeFaultObserved = false;
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
            controlServiceRef: options.controlServiceRef,
            markEffectCommitStarted: () => {
                effectCommitStarted = true;
            },
            markCloseFaultObserved: () => {
                closeFaultObserved = true;
            },
            staticModel: options.staticModel,
            policy: options.policy,
            policyStateTransitions: options.policyStateTransitions,
            ...(resolved.target !== undefined ? { target: resolved.target } : {}),
        };
        let staged;
        // pre-alpha3 W3-D (review fix F9, guide §8): the REQUIREMENT GATE is
        // consulted not only for the new-work admissions (follow-up / delegate /
        // create-member) but ALSO for the CROSS-AGENT EXECUTION TRIGGER
        // (send-message — classified by effect, the wake delivers work a downed
        // scope cannot serve). The trigger is gated on the SAME scopes the action
        // was admitted with (Team + the recipient's template); the `gateAction`
        // blocks it if ANY evaluated scope is down. A recovery re-run of the
        // trigger (the `recovery` marker → `recoveryWork` impact) is allowed and
        // escalates the wake to synchronous Human Review via the same
        // `dispatchRecoveryIfOffered` inline coupling below.
        //
        // fix-control-authz C + C-1 + C-2 (the external-review residuals) —
        // the EFFECT-ADMISSION BOUNDARY for EVERY reviewed recovery reentry
        // effect. The unit is NOT gated on the spec category (C-1: the
        // send-message reentry — the `recoveryWork` impact, the
        // `coordination` spec — bypasses the gated branch below and must
        // hit the same boundary; an abandoned / aborted request commits
        // ZERO effects of ANY kind). Invoked WITH the team chain (a) held
        // — the caller owns the acquisition (the gated chain; the
        // coordination fallback) — it re-validates the reviewed request's
        // durable terminal state AND the invocation's live signal (C-2)
        // as one unit with the first effect commit under the control lock
        // (b) (the same lock the durable abandon write goes through,
        // `commitEffectIfAuthorized`). The pre-dispatch terminal snapshot
        // is a fast path, not this boundary: an abandon (or an abort) that
        // landed after it — e.g. during the gate re-probe await, or while
        // this unit queued for (b) — is seen here, and the effect NEVER
        // commits.
        //
        // C-2 signal semantics: an abort BEFORE the commit is honored at
        // the boundary — the abandon is PERSISTED there (the durable
        // close, exactly-once, the same footprint as an explicit abandon;
        // a later late-abandon then no-ops on the already-terminal state)
        // and the unit rejects typed; an abort AFTER the commit is the
        // legitimate late close (the committed effect is never
        // retroactively undone or re-marked — the CCR-4 settle semantics
        // for already-committed effects are preserved).
        //
        // Lock ordering (deadlock argument): this is the only new
        // acquisition direction, the router's team chain (a) → the control
        // lock (b); the control service never acquires (a) and never calls
        // back into the router, and the effect commit runs no other
        // control operation (no (b) re-entry) — consistent global order
        // (a) → (b) → storage seam, no new lock cycles. A non-abandoned,
        // non-aborted request is transparent (the unit runs the effect and
        // returns its result unchanged).
        const commitReviewedEffect = () => {
            const recoveryControlRequestId = request.recovery?.controlRequestId;
            const controlService = options.controlServiceRef?.current;
            if (recoveryControlRequestId === undefined || controlService === undefined) {
                effectCommitStarted = true;
                return executeEffectLocked(ctx);
            }
            return controlService
                .commitEffectIfAuthorized({
                rootSessionId,
                requestId: recoveryControlRequestId,
                // fix-control-authz C (residual-3, the marker move): the
                // commit-started flag flips at the effect's OWN first durable
                // write (the marker callback — the activation effects at the
                // provider's reservation boundary; the others synchronously
                // before their first commit), NOT here at the closure entry
                // (the pre-reservation region must stay pre-commit for the
                // D2 settle).
                commitEffect: () => executeEffectLocked(ctx),
                signal: asAbortLike(request.signal),
            })
                .catch((boundaryError) => {
                // fix-control-authz C (the residual pre-reservation boundary):
                // the provider preflight settled the aborted invocation at a
                // pre-reservation check point (the durable close is settled —
                // the lock-free callback ran FIRST, exactly-once) and rejected
                // typed `ACTIVATION_REQUEST_ABORTED` (the gate maps it to the
                // compatibility block carrying the provider code). The caller
                // sees the SAME typed zero-effect abandon terminal as every
                // other pre-commit abort settle (the request IS durably
                // closed — exactly one mark — the idempotent composition
                // stands). `boundarySettled` = true: the D2 wrapper must not
                // settle again (the close already landed).
                if (boundaryError instanceof TeamRuntimeError &&
                    boundaryError.code === TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED &&
                    boundaryError.details?.['providerCode'] === ACTIVATION_ERROR_CODES.REQUEST_ABORTED) {
                    boundarySettled = true;
                    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the recovery dispatch was abandoned (the invocation aborted in the activation pre-reservation preflight — the durable close is settled) — zero durable effect (the operation remains blocked)', {
                        rootSessionId,
                        status: 'BLOCKED_FATAL',
                        gateReason: 'requiredScopeDown',
                        blockedScopes: [...(request.recovery?.scopeKeys ?? [])],
                        source: 'requirement-gate',
                        controlDecision: 'abandoned',
                        controlRequestId: recoveryControlRequestId,
                    });
                }
                if (isControlError(boundaryError) &&
                    (boundaryError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED ||
                        boundaryError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ADMISSION_ABORTED)) {
                    boundarySettled = true;
                    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, boundaryError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ADMISSION_ABORTED
                        ? 'TeamRuntime: the recovery dispatch was abandoned (the invocation aborted before the effect-admission boundary — the durable close was persisted at the boundary) — zero durable effect (the operation remains blocked)'
                        : 'TeamRuntime: the recovery dispatch was abandoned (the durable abandon mark landed before the effect-admission boundary — after the pre-dispatch snapshot — the terminal mark closed the authorization) — zero durable effect (the operation remains blocked)', {
                        rootSessionId,
                        status: 'BLOCKED_FATAL',
                        gateReason: 'requiredScopeDown',
                        blockedScopes: [...(request.recovery?.scopeKeys ?? [])],
                        source: 'requirement-gate',
                        controlDecision: 'abandoned',
                        controlRequestId: recoveryControlRequestId,
                    });
                }
                throw boundaryError;
            });
        };
        // fix-control-authz C (the residual pre-commit awaits) — the
        // SYSTEMATIC SETTLE for an invocation that aborted BEFORE the
        // effect commit: whatever await of this admission the abort landed
        // at (the runtime-chain queue, the pre-dispatch terminal snapshot,
        // the gate re-probe, the unit's control-lock queue), the request
        // is durably closed by the SAME unit the commit takes (a never-run
        // commitEffect — the unit then only performs its mark check +
        // signal check, persisting the close exactly-once) and the
        // invocation settles with the typed zero-effect abandon block.
        // This runs OUTSIDE any chain hold (the reentry that reached here
        // rejected from inside the chain acquisition and released it, or
        // never acquired it) — the settle acquires the control lock alone
        // → no deadlock, and the close composes idempotently with the
        // pre-dispatch best-effort abandon and with a concurrent explicit
        // abandon (already-terminal → the typed no-op). A settle persist
        // fault (the typed DURABLE_WRITE_FAILED) propagates — fail-closed.
        const settleAbortedPreCommit = async (controlRequestId) => {
            const controlService = options.controlServiceRef?.current;
            if (controlService === undefined) {
                // Unreachable: the settle callers check presence first.
                throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, 'TeamRuntime: the aborted recovery dispatch cannot be settled (the control service is absent) — zero durable effect (internal wiring defect)', { rootSessionId });
            }
            try {
                await controlService.commitEffectIfAuthorized({
                    rootSessionId,
                    requestId: controlRequestId,
                    commitEffect: () => Promise.reject(new Error('unreachable: the aborted-pre-commit settle never runs the effect commit')),
                    signal: asAbortLike(request.signal),
                });
            }
            catch (settleError) {
                if (isControlError(settleError) &&
                    (settleError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ABANDONED ||
                        settleError.code === CONTROL_ERROR_CODES.CONTROL_REQUEST_ADMISSION_ABORTED)) {
                    // The close is durable (the unit just persisted it —
                    // ADMISSION_ABORTED — or it was already terminal —
                    // ABANDONED): the typed zero-effect abandon block stands
                    // (the same contract as the pre-dispatch abort path).
                    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the recovery dispatch was abandoned (the invocation aborted before the effect commit — the durable close is settled) — zero durable effect (the operation remains blocked)', {
                        rootSessionId,
                        status: 'BLOCKED_FATAL',
                        gateReason: 'requiredScopeDown',
                        blockedScopes: [...(request.recovery?.scopeKeys ?? [])],
                        source: 'requirement-gate',
                        controlDecision: 'abandoned',
                        controlRequestId,
                    });
                }
                throw settleError;
            }
            // Unreachable: the unit rejects in the aborted state (the settle
            // precondition) or on the durable mark.
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, 'TeamRuntime: the aborted recovery dispatch settle returned without a typed reject (internal defect) — zero durable effect (the operation remains blocked)', { rootSessionId, controlRequestId });
        };
        if (isNewWorkAdmission(spec) ||
            impact.impact === ACTION_IMPACT_CLASSES.crossAgentTrigger) {
            try {
                staged = await withTeamLock(teamLocks, rootSessionId, async () => {
                    // The gate re-reads the environment-facts port itself (a fresh
                    // read under the lock — the same logical moment as before; the
                    // authority's inline re-probe re-reads the same port).
                    // PF-1 fix (2026-09-30) — per-request BLUEPRINT scoping (the same
                    // seam the remote surface's `intent.probe` and the per-root
                    // compatibility prober consume): when the production root installs
                    // the per-blueprint source, the gate resolves the live feed
                    // against THIS request's bound blueprint's team requirements —
                    // a created root's required scopes are evaluated on their own
                    // facts (the frozen INV-9.4 two-worlds identity on
                    // multi-blueprint hosts). Absent → the legacy single feed stands
                    // (factory / single-blueprint worlds, byte-identical).
                    await enforceRequirementGate({
                        repositories,
                        blueprint,
                        rootSessionId,
                        environmentFacts: () => options.environmentFactsForBlueprint !== undefined
                            ? options.environmentFactsForBlueprint(blueprint)
                            : options.environmentFacts(),
                        ...(options.templateEnvironmentFactsForBlueprint !== undefined
                            ? {
                                templateEnvironmentFacts: (templateId) => options.templateEnvironmentFactsForBlueprint(blueprint, templateId),
                            }
                            : options.templateEnvironmentFacts !== undefined
                                ? { templateEnvironmentFacts: options.templateEnvironmentFacts }
                                : {}),
                        // D-3 (2026-09-30) — the full-resolution read ports (the
                        // atomic observations + feed pair): present → the gate
                        // consumes THIS source (the facts-only ports above are then
                        // not consulted) and the PENDING rule is live; absent →
                        // legacy byte-identical (the PENDING rule is off).
                        ...(options.environmentFactsReadForBlueprint !== undefined
                            ? {
                                environmentFactsRead: () => options.environmentFactsReadForBlueprint(blueprint),
                            }
                            : {}),
                        ...(options.templateEnvironmentFactsReadForBlueprint !== undefined
                            ? {
                                templateEnvironmentFactsRead: (templateId) => options.templateEnvironmentFactsReadForBlueprint(blueprint, templateId),
                            }
                            : {}),
                        ...(options.now !== undefined ? { now: options.now } : {}),
                    }, impact);
                    // fix-control-authz C + C-1 + C-2 (the external-review
                    // residuals) — the EFFECT-ADMISSION BOUNDARY: the gate (with
                    // its fresh re-probe await) has now resolved; the first
                    // durable effect of this admission is about to commit. For
                    // the recovery re-execution (the marker carries the reviewed
                    // control request id), the terminal state of THAT request
                    // (the durable abandon mark) AND the invocation's live
                    // signal are re-validated HERE — at the effect boundary
                    // itself, after every await of this admission — as one unit
                    // with the effect commit under the SAME per-team lock the
                    // durable abandon write goes through
                    // (`commitEffectIfAuthorized`). See the
                    // `commitReviewedEffect` helper (defined above) for the full
                    // contract: the C-1 coverage (every reviewed reentry effect,
                    // no spec-category gate), the C-2 signal semantics (abort
                    // before the commit → persisted durable close + typed
                    // reject; abort after the commit → the legitimate late
                    // close), and the lock-ordering deadlock argument.
                    return await commitReviewedEffect();
                }, asAbortLike(request.signal));
            }
            catch (error) {
                // fix-control-authz C (the residual pre-commit awaits) — the
                // systematic settle, first: the invocation aborted BEFORE the
                // effect commit (the effect commit never started — no durable
                // write of this admission landed) and the boundary did not
                // already settle the close (its typed block is in flight) and
                // the durable close did not ALREADY fault on this admission
                // (the residual-3 one-shot close-failure contract, defect c —
                // a close persist fault is the terminal outcome: the typed
                // DURABLE_WRITE_FAILED escapes as-is, never re-attempted — a
                // second attempt would succeed and mask the first fault):
                // durably close the request and settle with the typed
                // zero-effect abandon block (the settle ALWAYS throws — the
                // recovery dispatch below is then skipped; a committed effect
                // is never retroactively marked — the post-commit fault
                // surfaces unchanged). Non-aborted / non-marker /
                // commit-started / already-settled / close-fault-observed
                // errors: byte-identical.
                if (!effectCommitStarted &&
                    !boundarySettled &&
                    !closeFaultObserved &&
                    request.recovery?.controlRequestId !== undefined &&
                    options.controlServiceRef?.current !== undefined &&
                    asAbortLike(request.signal)?.aborted === true) {
                    await settleAbortedPreCommit(request.recovery.controlRequestId);
                }
                // OUTSIDE the lock: the recovery dispatch (the human-reviewed
                // Control inline coupling). A non-offer error returns `undefined`
                // (the ORIGINAL typed error is re-thrown unchanged); a durable
                // `allow` returns the fresh admission outcome (the full chain
                // re-ran — the staged-effect machinery of the blocked attempt is
                // skipped); `deny` / abort throw the typed zero-effect block.
                const recovered = await dispatchRecoveryIfOffered(error, {
                    request,
                    rootSessionId,
                    targetTemplateId,
                });
                if (recovered !== undefined) {
                    return recovered;
                }
                throw error;
            }
        }
        else {
            // fix-control-authz C-1 (the external-review residual): the
            // reviewed recovery reentry may reach this fallback — the
            // send-message reentry (the `recoveryWork` impact, the
            // `coordination` spec) bypasses the gated branch above. The
            // effect-admission boundary applies to ALL reviewed effects (no
            // spec-category gate): a marker-carrying request takes the same
            // serialized path — chain (a) + boundary (b) + effect commit —
            // the unit is invoked WITH the chain already held (it commits
            // via `executeEffectLocked`, so `executeEffect` — which acquires
            // (a) itself — is NEVER called inside the unit: that would be
            // (b) → (a), a new lock cycle). Everything else stays
            // byte-identical (`executeEffect`).
            const recoveryControlRequestId = request.recovery?.controlRequestId;
            if (recoveryControlRequestId !== undefined &&
                options.controlServiceRef?.current !== undefined) {
                try {
                    staged = await withTeamLock(teamLocks, rootSessionId, () => commitReviewedEffect(), asAbortLike(request.signal));
                }
                catch (error) {
                    // fix-control-authz C (the residual pre-commit awaits) — the
                    // systematic settle (the fallback reentry has no gate re-
                    // probe, but the same pre-commit await points stand: the
                    // chain queue and the unit's control-lock queue). Same
                    // condition (incl. the residual-3 `closeFaultObserved`
                    // half — a close persist fault is the terminal outcome,
                    // never re-attempted), same settle — ALWAYS throws; the
                    // original error is unreachable (the typed abandon block /
                    // the settle fault is the terminal).
                    if (!effectCommitStarted &&
                        !boundarySettled &&
                        !closeFaultObserved &&
                        asAbortLike(request.signal)?.aborted === true) {
                        await settleAbortedPreCommit(recoveryControlRequestId);
                    }
                    throw error;
                }
            }
            else {
                staged = await executeEffect(teamLocks, ctx);
            }
        }
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