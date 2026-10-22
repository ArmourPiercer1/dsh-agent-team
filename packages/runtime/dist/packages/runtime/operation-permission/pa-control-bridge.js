/**
 * Alpha.5 M1 (frozen A; PR355 thin center) — THE PA ⇄ CONTROL BRIDGE.
 *
 * THE POSITION. The plane's `controlLeg` seam (team-tool-plane.mjs,
 * "M1 CENTER PA WIRING") is the ONLY production path a `requires-approval`
 * admission can take to a body, and a PA `planApproval().approvalCaseId` is a
 * LOGICAL case id — never a durable Control row. This module is the AUTH-
 * owned leg that makes the ask real: it is the frozen-A full-obligation
 * bridge, never a decision boolean. The obligations, in the frozen order:
 *
 * ```
 * seam input {realmId, member, callId, request, plan, assembly}
 *   1. requestControl(...)             durable Control row for THIS PA case:
 *        reuse key = plan.approvalCaseId + callId (correlation),
 *        operationFingerprint = request.parametersFingerprint (the
 *        pre-execute-adapter precedent: correlation ties request/decision/
 *        guard to ONE logical operation; the fingerprint binds the exact
 *        impact identity). requestControl is idempotent over the scope key —
 *        a repeat of the same invocation REUSES the row, never mints a second.
 *        The strict PA manifest (ALL effects, requiredAuthority,
 *        perEffectRequired, deniedEffects, effectSetFingerprint,
 *        authorityGeneration) rides the durable row VERBATIM as the
 *        lossless `reviewPayload` + `reviewPayloadDigest` (PR-D D.3).
 *   2. awaitControlDecision(...)       the real durable decision (the wait
 *        bridge is liveness only; the durable rows are the authority).
 *        deny/stale-denied → 'deny'; abort/closed → 'unsettled'. ZERO mint
 *        on both arms — an unsettled ask never produces a grant.
 *   3. rung re-check (the bridge-side half of ADR A1-14, transcribed from
 *        `pre-execute-adapter` (4c')): the authority plane is re-read via
 *        `assembly.planApproval(request)` and the required rung re-derived;
 *        if it has RISEN above the rung the plan opened at (or the case
 *        identity moved, or the plane cannot answer), the old decision is
 *        NOT usable: deny with ZERO consumption, ZERO mint.
 *   4. presenter → PresentedApproval built ONLY from real facts: the case id
 *        the request carries, the REAL decider's rung (ControlCallerRef →
 *        ladder position), the trusted beneficiary from the assembly wiring,
 *        and the plan's creation-time rung / fingerprint / generation /
 *        denied-effect provenance copied VERBATIM (presenter discipline:
 *        every identity field is server-derived, none is model-supplied).
 *   5. assembly.issueApprovedGrant(request, approval)   the PA kernel's own
 *        landing edge (verify PER EFFECT, then mint the one-shot grant).
 *   6. controlService.guardOperation(exact scope + fingerprint)  the durable
 *        check-and-reserve UNDER the per-team lock — the bridge consumes the
 *        allow exactly once and NEVER re-enters, never mints a second grant.
 *        Blocked/failed → deny and the minted grant is NOT handed back.
 *   7. all green → { decision:'approve', requestId, approval, grant }
 *        (minted AND guard-consumed; the center must never mint on this path
 *        a second time — the seam contract pins exactly this shape).
 * ```
 *
 * WHAT THE BRIDGE NEVER DOES:
 *  - never synthesizes an approved-by-default row: it is reached ONLY for a
 *    `requires-approval` outcome (an all-allow world admits BEFORE the seam),
 *    and it refuses unless a REAL durable request row exists for the case —
 *    no row, no decision, no grant (the center's pending-refuse posture
 *    carried through the leg);
 *  - never fakes a decision: the wait returns the durable row or nothing —
 *    timeout/abort/closure settle as `unsettled`, never as allow;
 *  - owns NO ledger of its own (the Control ledger is `packages/runtime/
 *    control`'s durable store; the grant ledger is the PA assembly's) — this
 *    module holds no state beyond its injected wiring (the Alpha.4 "no
 *    in-memory state is authority" law and the pre-execute-adapter H4 law:
 *    nothing is stored, so nothing stale survives a restart);
 *  - touches no private API: the durable plane is used exactly through the
 *    public `ControlService` surface (`requestControl` /
 *    `awaitControlDecision` / `guardOperation` / `listControlState`), declared
 *    here as a STRUCTURAL minimal interface — the real service satisfies it,
 *    a stand-in that skips the durable row does not;
 *  - zero I/O of its own: no filesystem, no timers except the optional
 *    bounded-wait abort (the wait bridge owns its own poll cadence).
 *
 * THE SECOND EXPORT — {@link createPaGuardVerifyPort} — is the pure-verify
 * resolve/guard face for ALL Effects of the exact scope: read-only over the
 * durable state (`listControlState` is a fresh ledger read, invariant 45),
 * it answers whether an unconsumed durable allow covers the EXACT scope
 * without consuming anything and without minting anything. The AUTHORITATIVE
 * consumption stays `guardOperation`'s check-and-reserve under the per-team
 * lock; this port is the side-effect-free companion the resolve path may
 * consult, and it mirrors the guard's refusal vocabulary (no re-entry, no
 * second ledger).
 *
 * @module @dsh-agent-team/runtime/operation-permission/pa-control-bridge
 */
import { canonicalJsonFingerprint } from '../../domain/tool-governance/src/index.js';
import { CONTROL_ERROR_CODES, CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KINDS, isControlError, } from '../control/index.js';
import { authorityRank } from '../governance/authority-ceiling.js';
/** The frozen-A action name of a guarded plane-tool execution. */
export const PA_CONTROL_ACTION_NAME = 'team-tool-execute';
/** The reuse key: the ONE logical PA case + the ONE invocation. */
export function paCorrelation(approvalCaseId, callId) {
    return `pa:${approvalCaseId}:${callId}`;
}
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const deepLossless = (value) => JSON.parse(JSON.stringify(value));
/** ControlCallerRef (durable, closed) → the ladder position of the REAL
 *  decider. This is the presenter's ONLY reviewer-authority source: never a
 *  guess, never the beneficiary's rung, never a plan field. */
function deciderAuthority(decider) {
    if (decider.kind === 'human')
        return 'human-user';
    if (decider.kind === 'instance') {
        return decider.role === 'leader' ? 'leader' : 'member';
    }
    return undefined;
}
function validateDeps(deps) {
    if (deps === null || typeof deps !== 'object')
        return 'deps must be a record';
    const svc = deps.controlService;
    if (svc === null || typeof svc !== 'object')
        return 'controlService is required';
    for (const m of ['requestControl', 'awaitControlDecision', 'guardOperation', 'listControlState']) {
        if (typeof svc[m] !== 'function')
            return `controlService.${m} is required (the real durable Control surface)`;
    }
    if (!isNonEmptyString(deps.rootSessionId))
        return 'rootSessionId must be a non-empty string';
    if (deps.caller === null || typeof deps.caller !== 'object')
        return 'caller is required';
    if (deps.caller.kind === 'human' && !isNonEmptyString(deps.caller.humanId))
        return 'caller.kind human requires a humanId';
    if (deps.caller.kind === 'instance' && !isNonEmptyString(deps.caller.instanceId))
        return 'caller.kind instance requires an instanceId';
    if (deps.beneficiaryAuthority !== 'member' && deps.beneficiaryAuthority !== 'leader') {
        return 'beneficiaryAuthority must be the trusted beneficiary rung (member | leader)';
    }
    if (deps.actionName !== undefined && !isNonEmptyString(deps.actionName))
        return 'actionName must be a non-empty string when present';
    if (deps.waitTimeoutMs !== undefined && (typeof deps.waitTimeoutMs !== 'number' || !Number.isFinite(deps.waitTimeoutMs) || deps.waitTimeoutMs <= 0)) {
        return 'waitTimeoutMs must be a finite positive number when present';
    }
    return undefined;
}
/**
 * Build the frozen-A `requestApprovalLeg`. Construction fails LOUD (throws)
 * on malformed wiring — an ask-powered plane must never mount a bridge that
 * could answer allow out of a defective composition (fail-closed at assembly
 * time, the same posture as a Guard install failure failing the AgentSetup).
 */
export function createPaControlLeg(deps) {
    const problem = validateDeps(deps);
    if (problem !== undefined)
        throw new TypeError(`pa-control-bridge: ${problem}`);
    const observe = deps.onObserve ?? (() => { });
    const deny = (detail, requestId) => {
        observe({ stage: 'leg-deny', detail, ...(requestId === undefined ? {} : { requestId }) });
        return requestId === undefined ? { decision: 'deny', detail } : { decision: 'deny', requestId, detail };
    };
    const actionName = deps.actionName ?? PA_CONTROL_ACTION_NAME;
    const requestKind = deps.requestKind
        ?? (deps.beneficiaryAuthority === 'leader'
            ? CONTROL_REQUEST_KINDS.USER_APPROVAL
            : CONTROL_REQUEST_KINDS.LEADER_APPROVAL);
    return async (input) => {
        try {
            return await walkLeg(input);
        }
        catch (error) {
            // A bridge fault is a refusal, never a costume allow. The seam itself
            // must never see a thrown error escape the frozen-A vocabulary.
            const detail = `pa-control-bridge fault: ${error instanceof Error ? error.message : String(error)}`;
            observe({ stage: 'leg-fault', detail });
            return { decision: 'deny', detail };
        }
    };
    async function walkLeg(input) {
        const { realmId, member, callId, request, plan, assembly } = input;
        // ── structural intake (fail closed on a shape the obligations cannot
        //    be honoured for — never a half-walk). ──
        if (!isNonEmptyString(callId))
            return deny('callId must be a non-empty string');
        if (!isNonEmptyString(member?.instanceId))
            return deny('member.instanceId must be a non-empty string');
        if (!isNonEmptyString(request?.parametersFingerprint))
            return deny('request.parametersFingerprint must be a non-empty string (the exact-scope fingerprint)');
        if (request?.member === undefined || request.member.instanceId !== member.instanceId) {
            return deny('the seam member and the admission request member disagree (attribution defect)');
        }
        if (!isNonEmptyString(plan?.approvalCaseId) || !isNonEmptyString(plan.effectSetFingerprint)) {
            return deny('the PA plan carries no case identity');
        }
        if (typeof assembly?.issueApprovedGrant !== 'function' || typeof assembly?.planApproval !== 'function') {
            return deny('the seam assembly carries no landing edges (issueApprovedGrant/planApproval)');
        }
        const effects = request.requestedEffects;
        if (effects === undefined || !Array.isArray(effects.effects) || effects.effects.length === 0) {
            return deny('the request carries no effect set to cover');
        }
        if (plan.effectSetFingerprint !== effects.fingerprint) {
            return deny(`the plan's effect-set fingerprint ${plan.effectSetFingerprint} is not this request's ${effects.fingerprint} — the approval would cover a different set`);
        }
        const toolName = effects.effects.find((effect) => effect.kind === 'tool-invoke')?.toolName;
        if (typeof toolName !== 'string' || toolName.length === 0) {
            return deny('the effect set names no tool-invoke tool — the guard scope would carry no tool identity');
        }
        // ── the strict PA manifest — VERBATIM onto the durable row ──────────
        const manifest = deepLossless({
            schema: 'a5m1.pa-control-manifest.v1',
            approvalCaseId: plan.approvalCaseId,
            requiredAuthority: plan.requiredAuthority,
            perEffectRequired: plan.perEffectRequired,
            deniedEffects: plan.deniedEffects,
            effectSetFingerprint: plan.effectSetFingerprint,
            authorityGeneration: plan.authorityGeneration,
            realmId,
            callId,
            parametersFingerprint: request.parametersFingerprint,
            effects: effects.effects,
        });
        const digest = canonicalJsonFingerprint(manifest);
        const correlation = paCorrelation(plan.approvalCaseId, callId);
        // ── 1. the durable Control row (create OR idempotently REUSE) ───────
        let record;
        try {
            record = await deps.controlService.requestControl({
                rootSessionId: deps.rootSessionId,
                caller: deps.caller,
                kind: requestKind,
                targetInstanceId: member.instanceId,
                actionName,
                toolName,
                correlation,
                operationFingerprint: request.parametersFingerprint,
                summary: `PA ask case=${plan.approvalCaseId} rung=${plan.requiredAuthority} tool=${toolName} effects=${String(effects.effects.length)}`,
                // The manifest is a pure JSON round-trip (deepLossless), i.e. a
                // lossless JSON value BY CONSTRUCTION; the type carries that fact.
                reviewPayload: manifest,
                reviewPayloadDigest: digest,
            });
        }
        catch (error) {
            // No row → no decision → no grant. Approved-by-default does not exist.
            return deny(`durable control request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        observe({ stage: 'request-created', callId, requestId: record.requestId, paCaseId: plan.approvalCaseId, correlation });
        // Reuse honesty: the SAME scope key may only ever answer the SAME strict
        // manifest. A digest drift under one key is a different question wearing
        // this invocation's identity — refuse, never re-present, never consume.
        if (record.reviewPayloadDigest !== undefined && record.reviewPayloadDigest !== digest) {
            return deny(`the durable row ${record.requestId} carries a DIFFERENT strict manifest digest (${String(record.reviewPayloadDigest)}) than this plan (${digest}) — scope-key identity drift is a different question`, record.requestId);
        }
        // ── 2. await the REAL durable decision ──────────────────────────────
        let decision;
        const outerSignal = deps.signal?.();
        if (outerSignal?.aborted === true) {
            // The row exists (durable, resolvable later); this invocation stops —
            // cancellation never decides, and it never mints.
            observe({ stage: 'leg-unsettled', callId, requestId: record.requestId, detail: 'pre-aborted' });
            return { decision: 'unsettled', requestId: record.requestId, detail: 'the approval wait was cancelled before it began (the durable request stays pending)' };
        }
        let controller;
        let timer;
        try {
            if (deps.waitTimeoutMs !== undefined && outerSignal === undefined) {
                controller = new AbortController();
                timer = setTimeout(() => controller?.abort(), deps.waitTimeoutMs);
            }
            decision = await deps.controlService.awaitControlDecision({
                rootSessionId: deps.rootSessionId,
                requestId: record.requestId,
                ...(controller !== undefined ? { signal: controller.signal } : outerSignal !== undefined ? { signal: outerSignal } : {}),
            });
        }
        catch (error) {
            if (isControlError(error)
                && (error.code === CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED || error.code === CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED)) {
                // UNSETTLED: the durable row stays exactly as it is (a later resolve
                // is unaffected); zero mint, zero guard, zero body by construction.
                observe({ stage: 'leg-unsettled', callId, requestId: record.requestId, code: error.code });
                return { decision: 'unsettled', requestId: record.requestId, detail: `the approval wait settled ${String(error.code)} (the durable request is untouched)` };
            }
            return deny(`the approval wait failed: ${error instanceof Error ? error.message : String(error)}`, record.requestId);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
        observe({ stage: 'decision-arrived', callId, requestId: record.requestId, decision: decision.decision });
        // Any non-allow durable decision denies (deny / stale-denied — a closed
        // request can never become an allow).
        if (decision.decision !== 'allow') {
            return deny(`the approval was denied (${decision.decision})`, record.requestId);
        }
        // ── 3. the bridge-side A1-14 rung re-check (pre-execute-adapter (4c')) ─
        // The authority plane is read AGAIN through the assembly's OWN derivation
        // and the required rung re-derived; a rise (or an unreadable plane, or a
        // moved case identity) makes the just-arrived decision NOT usable. The
        // durable allow stays exactly as the decider wrote it: unspent, untouched.
        let fresh;
        try {
            fresh = assembly.planApproval(request);
        }
        catch (error) {
            return deny(`the authority plane could not be re-read at execution (${error instanceof Error ? error.message : String(error)}) — the approved invocation did not execute and the one-shot allow was not consumed`, record.requestId);
        }
        if (!fresh.ok) {
            return deny(`the authority plane refused the re-derivation (${fresh.error.message}) — the approved invocation did not execute and the one-shot allow was not consumed`, record.requestId);
        }
        if (fresh.value.approvalCaseId !== plan.approvalCaseId) {
            return deny(`the case identity moved (${plan.approvalCaseId} → ${fresh.value.approvalCaseId}) between ask and execution — a different question, never the approved one`, record.requestId);
        }
        if (authorityRank(fresh.value.requiredAuthority) > authorityRank(plan.requiredAuthority)) {
            return deny(`the approval authority rose to '${fresh.value.requiredAuthority}' after the decision was given at '${plan.requiredAuthority}' — the old decision is not usable and the one-shot allow was not consumed`, record.requestId);
        }
        // ── 4. the trusted presenter: the PresentedApproval, real facts only ─
        const reviewerAuthority = deciderAuthority(decision.decider);
        if (reviewerAuthority === undefined) {
            return deny('the durable decider is outside the closed ControlCallerRef vocabulary — no reviewer rung can be presented', record.requestId);
        }
        const approval = Object.freeze({
            approvalCaseId: plan.approvalCaseId,
            reviewerAuthority,
            beneficiaryAuthority: deps.beneficiaryAuthority,
            requiredAuthorityAtCreation: plan.requiredAuthority,
            effectSetFingerprint: plan.effectSetFingerprint,
            authorityGenerationAtCreation: plan.authorityGeneration,
            // F-2 presenter discipline: the denied-effect provenance VERBATIM.
            deniedEffectsAtCreation: plan.deniedEffects.map((pair) => Object.freeze({ effectIndex: pair.effectIndex, requiredAuthority: pair.requiredAuthority })),
        });
        // ── 5. the PA landing edge (verify per effect, then mint) ───────────
        const issued = await assembly.issueApprovedGrant(request, approval);
        if (!issued.ok) {
            // Zero mint. The durable allow is still unspent — a refusal is a
            // refusal, never a retry hook.
            return deny(`the approved grant was refused at landing (${issued.error.code}: ${issued.error.message})`, record.requestId);
        }
        observe({ stage: 'grant-minted', callId, requestId: record.requestId, grantId: issued.value.grantId });
        // ── 6. the last-mile durable consumption (check-and-reserve, in-lock) ─
        const scope = Object.freeze({
            rootSessionId: deps.rootSessionId,
            targetInstanceId: member.instanceId,
            actionName,
            toolName,
            correlation,
            operationFingerprint: request.parametersFingerprint,
        });
        let verdict;
        try {
            verdict = await deps.controlService.guardOperation(scope);
        }
        catch (error) {
            // The grant stays behind the deny (never handed back); the one-shot
            // ledgers make a replay impossible.
            return deny(`the last-mile guard failed (${error instanceof Error ? error.message : String(error)}); the minted grant is not returned`, record.requestId);
        }
        if (!verdict.allowed) {
            return deny(`the last-mile guard blocked the operation (${verdict.reason}); the minted grant is not returned`, record.requestId);
        }
        observe({ stage: 'guard-consumed', callId, requestId: record.requestId, grantId: issued.value.grantId });
        // ── 7. the frozen-A success shape (minted AND guard-consumed) ────────
        return { decision: 'approve', requestId: record.requestId, approval, grant: issued.value };
    }
}
/**
 * The pure-verify counterpart of `guardOperation` for the EXACT scope of one
 * PA-guarded plane execution (all Effects ride the one fingerprint-bound
 * scope). Read-only by construction: one fresh `listControlState` per call,
 * zero durable writes, zero ledger touch. Mirrors the guard's closed refusal
 * vocabulary for the durable facts it can see; the AUTHORITATIVE last-mile
 * answer (including the live external recheck and the lock) stays with
 * `guardOperation`.
 */
export function createPaGuardVerifyPort(deps) {
    const problem = (() => {
        const svc = deps.controlService;
        if (svc === null || typeof svc !== 'object' || typeof svc.listControlState !== 'function')
            return 'controlService.listControlState is required';
        if (!isNonEmptyString(deps.rootSessionId))
            return 'rootSessionId must be a non-empty string';
        return undefined;
    })();
    if (problem !== undefined)
        throw new TypeError(`pa-control-bridge(verify-port): ${problem}`);
    return Object.freeze({
        verify: async (input) => {
            const root = input.rootSessionId ?? deps.rootSessionId;
            const state = await deps.controlService.listControlState(root);
            const candidate = state.requests.find((row) => row.rootSessionId === root
                && instanceSubjectOf(row) === input.targetInstanceId
                && row.actionName === input.actionName
                && (row.toolName ?? '') === (input.toolName ?? '')
                && row.correlation === input.correlation
                && (row.operationFingerprint ?? '') === (input.operationFingerprint ?? ''));
            if (candidate === undefined) {
                // RULING 5-B honest mirror: a corrupt row that discloses NONE of the
                // candidacy members cannot be attributed to this scope by ANY
                // reading, so it never blocks here either (same disclosed boundary
                // the guard carries); an attributable one surfaced in `requests`.
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST };
            }
            const corruptMatch = state.corruptLegs.find((leg) => leg.disclosesMember && leg.requestId === candidate.requestId);
            if (corruptMatch !== undefined) {
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED, requestId: candidate.requestId };
            }
            if (state.abandonments.some((a) => a.requestId === candidate.requestId)) {
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED, requestId: candidate.requestId };
            }
            const decision = state.decisions.find((d) => d.requestId === candidate.requestId && scopeSnapshotsEqual(d.scope, {
                rootSessionId: root,
                targetInstanceId: input.targetInstanceId,
                actionName: input.actionName,
                ...(input.toolName === undefined ? {} : { toolName: input.toolName }),
                correlation: input.correlation,
                ...(input.operationFingerprint === undefined ? {} : { operationFingerprint: input.operationFingerprint }),
            }));
            if (decision === undefined) {
                if (candidate.status === 'pending')
                    return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING, requestId: candidate.requestId };
                const anyDecision = state.decisions.some((d) => d.requestId === candidate.requestId);
                return { allowed: false, reason: anyDecision ? CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH : CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST, requestId: candidate.requestId };
            }
            if (decision.decision !== 'allow') {
                return { allowed: false, reason: `decision-${decision.decision}`, requestId: candidate.requestId };
            }
            const consumed = state.consumptions.some((c) => c.requestId === candidate.requestId && c.decisionSequence === decision.decisionSequence);
            if (consumed)
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED, requestId: candidate.requestId };
            return { allowed: true, requestId: candidate.requestId, decisionSequence: decision.decisionSequence };
        },
    });
}
/** The instance identity a durable row addresses (canonical subject, with
 *  the legacy targetInstanceId projection — the same normalization the
 *  control plane itself applies). */
function instanceSubjectOf(row) {
    if (row.subject?.kind === 'instance')
        return row.subject.instanceId;
    return row.targetInstanceId;
}
/** The exact-scope snapshot equality of the control plane's
 *  `scopeSnapshotMatches`, restricted to the fields a bridge row carries
 *  (legacy instance subject; no authority point — the bridge mints no v3
 *  case leg). Present-on-one-side fingerprint is a mismatch, both-absent is
 *  equality — byte-identical law, one reading. */
function scopeSnapshotsEqual(recorded, guarded) {
    if (recorded.rootSessionId !== guarded.rootSessionId)
        return false;
    const recordedInstance = recorded.subject?.kind === 'instance' ? recorded.subject.instanceId : recorded.targetInstanceId;
    const guardedInstance = guarded.subject?.kind === 'instance' ? guarded.subject.instanceId : guarded.targetInstanceId;
    if (recordedInstance !== guardedInstance)
        return false;
    if (recorded.actionName !== guarded.actionName)
        return false;
    if (recorded.correlation !== guarded.correlation)
        return false;
    if ((recorded.toolName ?? '') !== (guarded.toolName ?? ''))
        return false;
    if ((recorded.operationFingerprint ?? '') !== (guarded.operationFingerprint ?? ''))
        return false;
    return true;
}
//# sourceMappingURL=pa-control-bridge.js.map