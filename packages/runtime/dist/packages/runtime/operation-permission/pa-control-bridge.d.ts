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
 *    bounded-wait abort (the wait bridge owns its own poll cadence); the
 *    verifier's ONE await (PR358-B) reaches only the injected call-level
 *    facts adapter — the I/O is the adapter's, never this module's, and the
 *    adapter must be free of the governance coordination lock (root ruling
 *    point 6).
 *
 * THE SECOND EXPORT — {@link createPaGuardVerifyPort} — is NON-PRODUCTION:
 * a TEST-ONLY diagnostic mirror (see its own doc). PRODUCTION has ONE PA
 * verification entry — the root wires the ONE {@link
 * createPaEffectsVerifier} instance into `createControlService({
 * paEffectsVerifier })`, and the service asks it inside the per-team lock at
 * BOTH gates (resolve, guard). This module's leg never calls the verifier
 * itself, and the mirror port answers NO coverage question of its own: it is
 * REQUIRED to hold the SAME verifier instance the service was given, so a
 * second verification path outside the service cannot exist. The root's real
 * injection lands centrally with the B dependency table (this round does not
 * touch root/agent-bindings).
 *
 * @module @dsh-agent-team/runtime/operation-permission/pa-control-bridge
 */
import type { RemoteSafeJsonValue } from '../../contracts/src/index.js';
import type { AdmissionRequest, GovernanceResult, OperationGrant } from '../../domain/tool-governance/src/index.js';
import type { ControlDecisionRecord, ControlGuardVerdict, ControlOperationScope, ControlRequestKind, ControlRequestRecord, ControlWaitSignal } from '../control/index.js';
import type { ControlCallerRef, PaCallFacts, PaControlManifest, PaEffectsVerifier, PaEffectsVerifierStage } from '../control/types.js';
import type { RuntimeAuthority } from '../governance/runtime-authority.js';
import type { EffectSetApprovalPlan, PresentedApproval } from '../tool-admission/approval-case.js';
/** What the plane hands the leg (frozen input shape). */
export interface PaControlLegInput {
    readonly realmId: string;
    /** The trusted member identity the plane derived (never model input). */
    readonly member: {
        readonly teamSessionId: string;
        readonly instanceId: string;
    };
    readonly callId: string;
    readonly request: AdmissionRequest;
    readonly plan: EffectSetApprovalPlan;
    /** The plane's production admission assembly (the landing edges). */
    readonly assembly: PaLandingAssembly;
    /**
     * A5-M1 item 4 (additive): the PARAMETER-LEVEL cancellation signal of
     * THIS invocation (the center threads the host exec/token cancel facts
     * through the seam). It joins the wiring-level `deps.signal` at every
     * checkpoint: the wait (abort ⇒ `unsettled`, the durable rows untouched),
     * AFTER the decision arrived and before anything is minted (⇒
     * `unsettled`: the durable allow stays exactly as written — retained,
     * never reclaimed, never faked as unconsumed later), and after the mint
     * and before the guard (⇒ deny, the minted grant NOT handed back — zero
     * PA consumption, zero body). A cancel that arrives AFTER the guard
     * consumed changes nothing: the durable consumption fact stands (truthful
     * retention — the center owns whether the body still runs).
     */
    readonly signal?: ControlWaitSignal;
}
/** The landing edges the leg uses from the assembly (structural view — the
 *  real `ProductionAdmissionAssembly` satisfies it; nothing else may). */
export interface PaLandingAssembly {
    readonly planApproval: (request: AdmissionRequest) => GovernanceResult<EffectSetApprovalPlan>;
    readonly issueApprovedGrant: (request: AdmissionRequest, approval: PresentedApproval) => Promise<GovernanceResult<OperationGrant>>;
}
/** The frozen-A leg result. `approve` carries the MINTED, guard-CONSUMED
 *  grant (the seam rejects an approval without one); deny/unsettled carry
 *  the durable requestId when a row exists ('uncreated' semantics otherwise). */
export type PaControlLegResult = {
    readonly decision: 'approve';
    readonly requestId: string;
    readonly approval: PresentedApproval;
    readonly grant: OperationGrant;
    /** ROOT 9e carriage (additive, NO semantic change): the durable
     *  manifest of THIS row, strict-classified from the row the leg
     *  minted and consumed through (`paManifestClassOf(record)` — the
     *  same VALUE-checked trichotomy every gate uses, never a local
     *  echo). The plane's final edge re-reads THIS call's level facts
     *  against these fields. ABSENT only if the row no longer
     *  strict-classifies — in which case the consumer fails closed
     *  (no facts, no grant use), never a synthesized manifest. */
    readonly manifest?: PaControlManifest;
} | {
    readonly decision: 'deny';
    readonly requestId?: string;
    readonly detail?: string;
} | {
    readonly decision: 'unsettled';
    readonly requestId?: string;
    readonly detail?: string;
};
export type PaControlCaller = {
    readonly kind: 'human';
    readonly humanId: string;
} | {
    readonly kind: 'instance';
    readonly instanceId: string;
};
export interface PaControlServiceLike {
    requestControl(args: {
        readonly rootSessionId: string;
        readonly caller: PaControlCaller;
        readonly kind: ControlRequestKind;
        readonly targetInstanceId: string;
        readonly actionName: string;
        readonly toolName?: string;
        readonly correlation: string;
        readonly operationFingerprint?: string;
        readonly summary?: string;
        readonly reviewPayload?: RemoteSafeJsonValue;
        readonly reviewPayloadDigest?: string;
    }): Promise<ControlRequestRecord>;
    awaitControlDecision(input: {
        readonly rootSessionId: string;
        readonly requestId: string;
        readonly signal?: ControlWaitSignal;
    }): Promise<ControlDecisionRecord>;
    guardOperation(scope: ControlOperationScope): Promise<ControlGuardVerdict>;
    listControlState(rootSessionId: string): Promise<{
        readonly requests: readonly ControlRequestRecord[];
        readonly decisions: readonly ControlDecisionRecord[];
        readonly consumptions: readonly {
            readonly requestId: string;
            readonly decisionSequence: number;
        }[];
        readonly abandonments: readonly {
            readonly requestId: string;
        }[];
        readonly corruptLegs: readonly {
            readonly requestId?: string;
            readonly disclosesMember: boolean;
        }[];
    }>;
}
/** The trusted wiring of {@link createPaControlLeg}. Everything here is
 *  ASSEMBLY input (the host's own identity facts), never model-visible. */
export interface PaControlBridgeDeps {
    /** The REAL Alpha.4 durable control plane (structural minimal face). */
    readonly controlService: PaControlServiceLike;
    /** The TeamSession (root session id) the durable rows live under. */
    readonly rootSessionId: string;
    /** The requesting principal (host-authenticated — the member or leader
     *  this bridge speaks for; the facade resolves + envelope-checks it). */
    readonly caller: PaControlCaller;
    /** Whose authority the case elevates (the plane's beneficiary rung). */
    readonly beneficiaryAuthority: RuntimeAuthority;
    /** The logical operation name of the guarded execution (scope identity;
     *  request and guard MUST carry the same one — the bridge derives both). */
    readonly actionName?: string;
    /** Override the carrier kind (default: leader ask → user-approval, a
     *  member/below ask → leader-approval — the pre-execute-adapter mapping). */
    readonly requestKind?: ControlRequestKind;
    /** Optional bounded wait: on expiry the wait is ABORTED and the leg
     *  settles `unsettled` (never allow). ABSENT = wait unbounded. */
    readonly waitTimeoutMs?: number;
    /** Optional caller-cancellation provider (checked at wait entry). */
    readonly signal?: () => ControlWaitSignal | undefined;
    readonly onObserve?: (row: Readonly<Record<string, unknown>> & {
        readonly stage: string;
    }) => void;
}
/** The frozen-A action name of a guarded plane-tool execution. */
export declare const PA_CONTROL_ACTION_NAME = "team-tool-execute";
/** The reuse key: the ONE logical PA case + the ONE invocation. */
export declare function paCorrelation(approvalCaseId: string, callId: string): string;
/**
 * Build the frozen-A `requestApprovalLeg`. Construction fails LOUD (throws)
 * on malformed wiring — an ask-powered plane must never mount a bridge that
 * could answer allow out of a defective composition (fail-closed at assembly
 * time, the same posture as a Guard install failure failing the AgentSetup).
 */
export declare function createPaControlLeg(deps: PaControlBridgeDeps): (input: PaControlLegInput) => Promise<PaControlLegResult>;
export interface PaEffectsVerifierDeps {
    /** PR358-B (root ruling 6): THE call-level facts adapter (the B
     *  dependency table). Implemented CENTER-side — this round only defines
     *  and AWAITS it. It answers the complete `PaCallFacts` for exactly this
     *  call from real durable/current reads, or `undefined` when ANY member
     *  is missing or unreadable (there is no partial shape of the contract,
     *  and a rejected promise is the same answer as undefined). It MUST NEVER
     *  hold or wait on the governance coordination lock (root ruling
     *  point 6). */
    readonly readCallFacts: (input: {
        readonly rootSessionId: string;
        readonly requestId: string;
        readonly manifest: PaControlManifest;
        readonly decider: ControlCallerRef;
        readonly stage: PaEffectsVerifierStage;
    }) => Promise<PaCallFacts | undefined>;
    /** TEST-only seam (CENTER↔AUTH ruling, CCR-358a follow-up). The
     *  `PaEffectsVerifierInput.facts` member is a caller-held facts
     *  pre-answer; in PRODUCTION no caller ever supplies it (the control
     *  service always leaves it ABSENT and the verifier fetches through
     *  `readCallFacts`). To turn "that injection surface belongs to tests
     *  only" from a CONVENTION into an ENFORCEMENT, the verifier honours
     *  `input.facts` ONLY when this flag is explicitly `true` at
     *  construction (default `false` ⇒ `input.facts` is IGNORED and the
     *  adapter is always consulted). A production wiring that omits the
     *  flag can never be fed facts through the input, so the injected
     *  adapter is its single, unavoidable facts source. */
    readonly allowFactsInjection?: boolean;
    readonly onObserve?: (row: Readonly<Record<string, unknown>> & {
        readonly stage: string;
    }) => void;
}
export declare function createPaEffectsVerifier(deps: PaEffectsVerifierDeps): PaEffectsVerifier;
export interface PaGuardVerifyInput {
    /** Defaults to the bridge's root session. */
    readonly rootSessionId?: string;
    readonly targetInstanceId: string;
    readonly actionName: string;
    readonly toolName?: string;
    readonly correlation: string;
    readonly operationFingerprint?: string;
    /** A5-M1: the EXECUTION-side fingerprint. For a PA manifest row the
     *  probe must present it — a probe whose parameters disagree with the
     *  approved manifest is a different invocation (`scope-mismatch`),
     *  never a mirror hit. */
    readonly parametersFingerprint?: string;
}
export type PaGuardVerifyVerdict = {
    readonly allowed: true;
    readonly requestId: string;
    readonly decisionSequence: number;
} | {
    readonly allowed: false;
    readonly reason: string;
    readonly requestId?: string;
};
export interface PaGuardVerifyPort {
    readonly verify: (input: PaGuardVerifyInput) => Promise<PaGuardVerifyVerdict>;
}
/**
 * NON-PRODUCTION — a TEST-ONLY thin shell. The pure-verify counterpart of
 * `guardOperation` for the EXACT scope of one PA-guarded plane execution
 * (all Effects ride the one payload-bound manifest): read-only by
 * construction — one fresh `listControlState` per call, zero durable writes,
 * zero ledger touch — mirroring the guard's closed refusal vocabulary so a
 * test can observe the durable truth without burning the one-shot allow.
 *
 * IT IS NOT A VERIFICATION PATH. It answers NO coverage question of its own:
 *  - `verifier` is REQUIRED and must be the SAME `createPaEffectsVerifier`
 *    instance the service was wired with — the mirror delegates its entire
 *    PA verdict to that one verifier, so no second verification path can
 *    exist outside the service;
 *  - the read-back class of the candidate row comes from the service's own
 *    `paManifestClassOf` (PR358 f5 trichotomy): `corrupt` (marker damaged,
 *    or the PA digest binding surviving a stripped marker) answers
 *    `authority-undetermined` exactly as BOTH service gates fail closed;
 *    `valid` delegates to the verifier; `not-effect-set` mirrors the legacy
 *    scope check untouched.
 *
 * The PRODUCTION single entry stays: the root injects the one verifier into
 * `createControlService({ paEffectsVerifier })` and the service asks it
 * inside the per-team lock at BOTH gates (the root's real injection lands
 * centrally with the B dependency table — outside this module). The
 * AUTHORITATIVE check-and-reserve (the lock, the consumption fact) stays
 * with `guardOperation` alone.
 */
export declare function createPaGuardVerifyPort(deps: Pick<PaControlBridgeDeps, 'controlService' | 'rootSessionId'> & {
    /** THE verifier — the same instance wired into the service. REQUIRED:
     *  this shell must not exist without the one verifier, because it owns no
     *  coverage answer of its own (NON-PRODUCTION mirror, see the header). */
    readonly verifier: PaEffectsVerifier;
}): PaGuardVerifyPort;
//# sourceMappingURL=pa-control-bridge.d.ts.map