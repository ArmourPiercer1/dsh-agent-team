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
 * pre-alpha3 PR-E (plan §E.9) + Finding F (scoped identity) — the NEW-WORK
 * target of one request: the template the gate's impact names (the
 * follow-up's addressed member template, the delegate's named template —
 * or the addressed member's template in the instance-first form — the
 * create-member's named template; `undefined` when the action names no
 * template, the Team scope only) + the target INSTANCE when the action
 * addresses an existing member (follow-up's target, the delegate's
 * instance-first form, the send-message recipient). The `instanceId` is
 * the gate's `targetInstanceId` (the target's OWN boundary read — the
 * decision reads the target's materialization, never the scope's
 * aggregate). `create-member` / template-addressed delegate have no
 * target instance (the new member's window settles at its own boundary —
 * never a gate-time block).
 */
function newWorkTarget(request, spec, resolved, repositories) {
    if (request.action === 'follow-up') {
        return resolved.target !== undefined
            ? {
                templateId: String(resolved.target.templateId),
                instanceId: String(resolved.target.instanceId),
            }
            : {};
    }
    if (request.action === 'delegate') {
        if (request.delegationTemplateId !== undefined) {
            return { templateId: String(request.delegationTemplateId) };
        }
        if (request.delegationInstanceId !== undefined) {
            const member = repositories.memberInstances.get(resolved.rootSessionId, String(request.delegationInstanceId));
            return member !== undefined
                ? {
                    templateId: String(member.templateId),
                    instanceId: String(request.delegationInstanceId),
                }
                : {};
        }
        return {};
    }
    // pre-alpha3 W3-D (review fix F9, guide §8): send-message is a cross-agent
    // execution trigger — its work targets the RECIPIENT's template (the wake
    // delivers input to that member). The gate then blocks the trigger if the
    // recipient's template scope (or the team scope) is down. Finding F: the
    // recipient's OWN boundary is the trigger's decision read.
    if (request.action === 'send-message') {
        const recipientInstanceId = request.payload?.['recipientInstanceId'];
        if (recipientInstanceId !== undefined) {
            // The lookup is a BEST-EFFORT template reference for the gate: an
            // unresolvable / malformed recipient token must NOT pre-empt the
            // effect's addressing rejection (resolveInstanceToken raises
            // ACTION_ADDRESSING_REJECTED) with a domain parse error.
            try {
                const recipient = repositories.memberInstances.get(resolved.rootSessionId, String(recipientInstanceId));
                return recipient !== undefined
                    ? {
                        templateId: String(recipient.templateId),
                        instanceId: String(recipientInstanceId),
                    }
                    : {};
            }
            catch {
                return {};
            }
        }
        return {};
    }
    // create-member: the named template (no target instance).
    return request.delegationTemplateId !== undefined
        ? { templateId: String(request.delegationTemplateId) }
        : {};
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
    if (targetTemplateId !== undefined) {
        return { kind: 'template', templateId: targetTemplateId };
    }
    return { kind: 'team', rootSessionId };
}
/**
 * pre-alpha3 PR-E (plan §E.9) — the COMPLETE normalized review payload of
 * one recovery dispatch (lossless JSON): every fact a human reviewer needs
 * to decide — the exact operation, the blocked scopes with their fatal
 * requirements and the downed capability subjects, and the reduced-
 * authority preview (the reduced ORIGINAL authority: the downed subjects
 * unavailable, everything else unchanged, the external hard ceiling
 * absolute). The digest of this payload is the review identity the UI
 * shows (the "exact reviewed payload" — scenario: the UI must display
 * what was actually approved).
 */
function buildRecoveryDispatchPayload(args) {
    return {
        schema: 'dsh-agent-team/recovery-dispatch/v1',
        rootSessionId: args.rootSessionId,
        action: args.request.action,
        caller: args.request.caller,
        ...(args.request.targetInstanceId !== undefined
            ? { targetInstanceId: args.request.targetInstanceId }
            : {}),
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
    // pre-alpha3 PR-E (plan §E.9): the per-runtime recovery-dispatch
    // sequence — the control `correlation` must be NEW per attempt (a retry
    // after a deny creates a NEW control request; the control service docs).
    let recoveryDispatchSequence = 0;
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
     * unchanged: the original typed contract stands). Finding F: a
     * REJECTED OFFER is also non-offer — the control service re-runs the
     * caller's authority steps and rejects a caller whose envelope does
     * not carry the `request-control` op (ENVELOPE_OUT_OF_BOUNDS); that
     * rejection (like any non-typed offer fault) returns `undefined` so
     * the ORIGINAL typed block stands (the dispatch is an offer, never a
     * precondition; zero durable effect — a rejected offer writes no row).
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
        const payload = buildRecoveryDispatchPayload({
            request,
            rootSessionId: args.rootSessionId,
            targetTemplateId: args.targetTemplateId,
            blockedScopes,
            unavailableSubjects,
        });
        recoveryDispatchSequence += 1;
        let record;
        try {
            record = await controlService.requestControl({
                rootSessionId: args.rootSessionId,
                caller: request.caller,
                kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
                subject: recoveryDispatchSubject(request, args.targetTemplateId, args.rootSessionId),
                ...(request.targetInstanceId !== undefined
                    ? { targetInstanceId: String(request.targetInstanceId) }
                    : {}),
                actionName: request.action,
                correlation: `recovery:${request.requestToken}:${recoveryDispatchSequence.toString(36)}`,
                summary: `recovery dispatch: one reviewed attempt of '${request.action}' on the blocked ` +
                    `scope(s) [${blockedScopes.join(', ')}] on the reduced original authority`,
                reviewPayload: payload,
                reviewPayloadDigest: `sha256:${sha256Hex(canonicalJsonStringify(payload))}`,
                executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
            });
        }
        catch {
            // Finding F (the dispatch is an OFFER, never a precondition): a
            // REJECTED offer — the control service re-runs the caller's
            // authority steps and the caller's envelope does not carry the
            // `request-control` op (ENVELOPE_OUT_OF_BOUNDS — the mtm F-matrix
            // world: the leader's team envelope carries only the work ops) — or
            // a non-typed offer fault must NOT replace the original typed
            // block: the original COMPATIBILITY_BLOCKED stands unchanged
            // (fail-closed — the work stays blocked; a rejected offer writes no
            // dispatch row, so zero durable effect).
            return undefined;
        }
        let decision;
        try {
            decision = await controlService.awaitControlDecision({
                rootSessionId: args.rootSessionId,
                requestId: record.requestId,
                ...(request.signal !== undefined
                    ? { signal: request.signal }
                    : {}),
            });
        }
        catch (waitError) {
            if (isControlError(waitError) &&
                (waitError.code === CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED ||
                    waitError.code === CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED)) {
                // Abort: the requester ABANDONS the request — the durable
                // `control-request-abandoned` terminal mark is written BEFORE
                // return (the zero durable effect is guaranteed by the terminal
                // mark: the request can never become an allow afterwards).
                try {
                    await controlService.abandonControlRequest({
                        rootSessionId: args.rootSessionId,
                        caller: request.caller,
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
        // Allow: the FRESH admission with the reviewed recovery marker (the
        // full chain re-runs — the gate now classifies the action as
        // recoveryWork and allows it on the blocked scopes, writing the
        // incident-opened fact; the provider admits the activation on the
        // reduced original authority).
        return performAction({
            ...request,
            recovery: {
                scopeKeys: [...blockedScopes],
                unavailableSubjects: [...unavailableSubjects],
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
        // Finding F (scoped identity): the target's template (the impact's
        // scopeRefs) + the target instance (the gate's `targetInstanceId` —
        // the target's OWN boundary is the decision read).
        const newWork = newWorkTarget(request, spec, resolved, repositories);
        const targetTemplateId = newWork.templateId;
        const targetInstanceId = newWork.instanceId;
        const impact = actionImpactOf(request.action, targetTemplateId, request.recovery !== undefined);
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
                                // Finding F (scoped identity): forward the gate's
                                // FEED CONTEXT (the owning root + the target instance
                                // for the target-template decision read) to the
                                // per-blueprint seam — the legacy template-only
                                // contract stands when the gate passes no context.
                                templateEnvironmentFacts: (templateId, context) => options.templateEnvironmentFactsForBlueprint(blueprint, templateId, context),
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
                                // Finding F (scoped identity): the FULL-resolution
                                // read seam forwards the feed context the same way —
                                // the gate performs the conservative scope read
                                // (root only) and, for the action's target, the
                                // target instance's OWN boundary read (root +
                                // instance) through THIS port.
                                templateEnvironmentFactsRead: (templateId, context) => options.templateEnvironmentFactsReadForBlueprint(blueprint, templateId, context),
                            }
                            : {}),
                        // Finding F (scoped identity): the action's target INSTANCE
                        // (the gate's target-template decision read; absent for
                        // create-member / template-addressed delegate — no target
                        // instance).
                        ...(targetInstanceId !== undefined ? { targetInstanceId } : {}),
                        ...(options.now !== undefined ? { now: options.now } : {}),
                    }, impact);
                    return executeEffectLocked(ctx);
                }, asAbortLike(request.signal));
            }
            catch (error) {
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
            staged = await executeEffect(teamLocks, ctx);
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