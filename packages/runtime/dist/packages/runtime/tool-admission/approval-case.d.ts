/**
 * Alpha.5 PR2 (plan §5, design §4.2) — THE MULTI-EFFECT APPROVAL LAW ON THE
 * ONE LOGICAL ALPHA.4 `ApprovalCase`.
 *
 * THE LAW (design §1 invariant 3, plan §5, verbatim): one call's multiple
 * Team-side Asks use the SAME logical Alpha.4 ApprovalCase; EVERY Effect
 * independently checks the reviewer's approval position AND the Envelope
 * coverage — "不用简单取最大 rank 代替合法性" (the maximum rank is where the
 * ONE case opens; it is never what makes each effect legal). A batch whose
 * approval covers some effects but not all is refused WHOLE — there is no
 * "approve the covered subset and run" (that is the "每 Effect 分散批准后拼凑
 * 执行" bypass plan §5 PoC-2 forbids).
 *
 * THE ALGEBRA IS REUSED, NEVER RESTATED (hard clause: lane 复用 PR0 代数):
 *  - deny/ask/allow rank, the meet lattice and BOTH plane functions come from
 *    PR0 `planes.ts` (which aliases the Alpha.4 `authority-envelope` grammar);
 *  - the rung walk is Alpha.4's `evaluateAuthorityCeiling` (approval plane,
 *    starting one rung ABOVE the beneficiary — the walk itself is the
 *    no-self-approval law);
 *  - the final legality test is the frozen ADR A3-2 equation, applied PER
 *    EFFECT: `mayReview(reviewer, beneficiary, required) AND
 *    grantCeiling(reviewer, docs, scope(effect)) reaches 'allow'`.
 *
 * WHAT NO APPROVAL CAN EVER REACH (plan §5: 禁止批准包含确定 deny/undetermined
 * Effect 的请求): an effect the EXPANSION plane decides `deny` or leaves
 * `undetermined` makes the WHOLE request unapprovable — the case never opens
 * (Core approval overwriting a Team deny is forbidden, design §1.3; an
 * undetermined scope has no approvable set, A1-7). This layer decides that
 * from the policy documents, before any reviewer is involved.
 *
 * The batch opens at the HIGHEST per-effect required rung — the same
 * all-or-nothing batching the Alpha.4 mutation lane established
 * (`planPermissionMutationApproval`), because one case that settles at a
 * lower rung would silently under-cover the effect that needed more.
 *
 * Case identity binds the WHOLE immutable effect-set fingerprint plus the
 * authority generation (a generation change is a different question — stale
 * handling, no retry), and NEVER a callId: two calls asking the same legal
 * question at the same generation are the same logical case; the GRANT each
 * call receives stays per-call (grant-mint.ts).
 *
 * Purity: no `node:*`, no I/O, no clock; documents and the ladder arrive as
 * parameters exactly as Alpha.4's ceiling module expects them.
 *
 * @module @dsh-agent-team/runtime/tool-admission/approval-case
 */
import { type SubtreeContains } from '../../domain/authority-envelope/src/index.js';
import { type ToolPolicyDocument, type ToolPolicyMatcher, type ToolPolicyScope } from '../../domain/tool-governance/src/index.js';
import type { Effect, RequestedEffectSet } from '../../domain/tool-governance/src/index.js';
import type { GovernanceResult } from '../../domain/tool-governance/src/index.js';
import { type AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js';
import type { RuntimeAuthority } from '../governance/runtime-authority.js';
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js';
/**
 * The realm-qualified approval scope of one effect. Realm non-confusion at the
 * approval plane: the matcher resource names the Realm inside it, so a
 * realm-A rule can never cover a realm-B effect (PR0: realms never confuse).
 */
export declare function effectApprovalScope(effect: Effect, realmId: string): {
    operationClass: string;
    matcher: {
        kind: 'exact';
        resource: string;
    };
};
/** Why a whole effect set was ruled UNAPPROVABLE before any reviewer exists. */
export interface UnapprovableReason {
    readonly effectIndex: number;
    readonly plane: 'expansion' | 'approval';
    readonly detail: string;
    /** Ruling ③: the effect is DENIED and the bound documents cannot answer
     *  WHICH rung owns that deny — an unattributed source, never to be
     *  presented as a settled Team deny. */
    readonly sourceUnattributed?: boolean;
    /** R-2a: the walk answered `ask-has-no-upper-rung` over a DENIED effect —
     *  the owning authority IS known; the ladder simply has nobody above the
     *  beneficiary. A defective ask, NOT an unattributed source (③). */
    readonly noUpperRung?: boolean;
    /** R-1a (user review 520a250d): the source projection exists but fails its
     *  trust test — 'version-drift': the entry's authority version ≠ the call's
     *  generation; 'owner-above-ladder': the deny belongs to the top authority
     *  and no rung may lift it (only spec §8.2's permanent path can). */
    readonly sourceDiagnosis?: 'version-drift' | 'owner-above-ladder';
}
/**
 * R-1a (user ruling 2026-10-16 + review 520a250d): ONE DENY, ONE SOURCE PROOF.
 * The Envelope answers WHO MAY APPROVE WHAT RANGE — it never records WHO WROTE
 * a policy deny, and an unrelated rule matching the scope is a laundering
 * channel, not evidence of ownership. The proof of a deny's source is THIS
 * entry: internal DERIVED data projected at read time from the REAL authority
 * state (blueprint permission lanes, spec §3.2; GovernanceMutationService
 * overlay entries, spec §8.2), carrying the owning rung, a stable source
 * reference, and the authority version at projection time — trusted ONLY when
 * that version matches the call's authority generation. This is NOT a second
 * authorization database: the single source of truth stays blueprint +
 * overlay, and the projection stores nothing. Copying a policy deny INTO the
 * Envelope documents as its "source" is forgery — the two planes' no-match
 * laws are untouched. An unwired projection is a precise refusal (③), never
 * a dormant grace.
 */
export interface PolicyDenySource {
    readonly realmId: string;
    readonly effectKind: ToolPolicyScope['effectKind'];
    readonly matcher: ToolPolicyMatcher;
    /** The rung of the Team authority that OWNS (wrote) this deny. */
    readonly ownerAuthority: RuntimeAuthority;
    /** Stable reference into the real authority state (lane / overlay entry). */
    readonly sourceRef: string;
    /** Authority generation the entry was projected at; trust requires match. */
    readonly sourceVersion: number;
}
/** Per-effect expansion verdicts (the plan §5 "完整 Effect Set" view). */
export interface EffectSetExpansion {
    /** Effects the policy ALREADY authorizes (decided `allow`). */
    readonly allowed: readonly number[];
    /** Effects needing an Ask (`ask` or `no-authority`). */
    readonly needsApproval: readonly number[];
    /** Effects the policy DECIDED-DENIES (ruling ①): upgradable ordinary Team
     *  denys ride the Ask too — this list is the provenance tag the plan and
     *  the caller carry forward, not a poison list. */
    readonly policyDenied: readonly number[];
    /** The first effect that made the whole set unapprovable, if any. */
    readonly unapprovable: UnapprovableReason | null;
}
/**
 * The EXPANSION-plane pass over the whole set: does the policy authorize the
 * call as it stands? `undetermined` poisons the WHOLE set (approval must
 * never contain one). A decided `deny` is ROUTED, not poison (user ruling
 * 2026-10-16, 问题2): an upgradable ordinary Team deny enters the existing
 * ApprovalCase/rung ladder, tagged in `policyDenied` so the plan can prove
 * WHO owns it — a walk that cannot answer over a denied effect refuses as
 * UNATTRIBUTED (ruling ③), never as "settled". The blanket "Team deny is
 * final" arm this file used to carry was this implementation tightening
 * beyond its original authority; it is gone. `no-authority` is NOT a deny —
 * it is the absence of authority, which an Ask exists to answer (A1-4).
 */
export declare function evaluateEffectSetExpansion(effects: RequestedEffectSet, realmId: string, policy: ToolPolicyDocument, subtreeContains?: SubtreeContains): EffectSetExpansion;
/** Outcome of planning the ONE case: the plan, or WHY no case may open. */
export type EffectSetPlanOutcome = {
    readonly ok: true;
    readonly value: EffectSetApprovalPlan;
} | {
    readonly ok: false;
    readonly unapprovable: UnapprovableReason;
};
/** What opening the ONE case for this call requires. */
export interface EffectSetApprovalPlan {
    readonly approvalCaseId: string;
    readonly requiredAuthority: ProposalAuthorityPosition;
    readonly perEffectRequired: readonly ProposalAuthorityPosition[];
    /** R-1b (PR3 presenter contract, INTERFACES-v1 C-ADM): WHICH denied effects
     *  ride this case at WHICH rung — the plan states the provenance it opened
     *  over; the assembly presents exactly this. */
    readonly deniedEffects: readonly {
        readonly effectIndex: number;
        readonly requiredAuthority: ProposalAuthorityPosition;
    }[];
    readonly effectSetFingerprint: string;
    readonly authorityGeneration: number;
}
/** The one logical case identity: (member, beneficiary rung, effect-set
 *  fingerprint, authority-generation correlation) — never a callId, never a
 *  model-chosen name; every field derived server-side (A2-7 discipline). */
export declare function toolAskApprovalCaseId(input: {
    readonly teamSessionId: string;
    readonly instanceId: string;
    readonly effectSetFingerprint: string;
    readonly authorityGeneration: number;
}): string;
/**
 * The APPROVAL-plane plan for the effects that need an Ask: the rung each
 * effect independently requires (Alpha.4's walk, one rung above the
 * beneficiary), and the ONE case at the highest of them. An `undetermined`
 * effect or an unreadable bound document refuses the WHOLE plan —
 * fail-closed, and no case is minted for an unapprovable set.
 */
export declare function planEffectSetApproval(input: {
    readonly effects: RequestedEffectSet;
    readonly needApproval: readonly number[];
    /** Indices the policy DECIDED-DENIED (from evaluateEffectSetExpansion):
     *  a walk that cannot answer at one of THESE becomes a ③ diagnosis. */
    readonly policyDenied?: ReadonlySet<number>;
    /** R-1a: the deny-source projection (see PolicyDenySource). UNDEFINED is
     *  the unwired state: every denied effect then refuses precisely — a
     *  KNOWN, stated gap, not a DORMANT deferral. */
    readonly denySources?: readonly PolicyDenySource[];
    readonly realmId: string;
    readonly beneficiaryAuthority: RuntimeAuthority;
    readonly documents: AuthorityEnvelopeDocuments;
    readonly authorityGeneration: number;
    readonly teamSessionId: string;
    readonly instanceId: string;
    readonly subtreeContains?: SubtreeContains;
}): EffectSetPlanOutcome;
/** The durable inputs one approval carries back to the execution boundary. */
export interface PresentedApproval {
    readonly approvalCaseId: string;
    readonly reviewerAuthority: RuntimeAuthority;
    readonly beneficiaryAuthority: RuntimeAuthority;
    readonly requiredAuthorityAtCreation: ProposalAuthorityPosition;
    readonly effectSetFingerprint: string;
    readonly authorityGenerationAtCreation: number;
}
/**
 * The execution-boundary re-check of the presented approval, PER EFFECT
 * (ADR A3-2 equation per effect; the max-rank shortcut is unrepresentable
 * here because every effect is walked on its own scope):
 *  - the presented fingerprint must BE this call's set (the approval covers
 *    the whole set it saw, not "the call that happens to be running");
 *  - the generation must not have moved (stale: the question changed);
 *  - the reviewer may review (ladder; also defeats "the old leg escalated,
 *    the old reviewer still signs": the CURRENT per-effect required rung is
 *    recomputed, so an escalation since creation raises the bar the old
 *    reviewer no longer reaches);
 *  - the reviewer's own ceiling on THIS effect's scope reaches 'allow'
 *    (envelope coverage, approval plane — an absent rule narrows nothing).
 * Any single failure refuses the WHOLE set. `directAllow` effects were covered
 * by policy at admission; the approval must still match the same fingerprint
 * (the whole set is one question).
 */
export declare function verifyEffectSetApproval(input: {
    readonly effects: RequestedEffectSet;
    readonly realmId: string;
    readonly approval: PresentedApproval;
    readonly currentAuthorityGeneration: number;
    readonly documents: AuthorityEnvelopeDocuments;
    readonly subtreeContains?: SubtreeContains;
}): GovernanceResult<{
    readonly reviewer: RuntimeAuthority;
}>;
//# sourceMappingURL=approval-case.d.ts.map