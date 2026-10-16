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

import {
  AUTHORITY_EFFECT_PRECEDENCE,
  type EffectiveCeiling,
  type SubtreeContains,
} from '../../domain/authority-envelope/src/index.js'
import {
  evaluateToolPolicyExpansionAuthority,
  type ToolPolicyDocument,
  type ToolPolicyScope,
} from '../../domain/tool-governance/src/index.js'
import type { Effect, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import type { GovernanceResult } from '../../domain/tool-governance/src/index.js'
import {
  AuthorityBindingError,
  AUTHORITY_CEILING_ERROR_CODES,
  authorityRank,
  grantCeiling,
  mayReview,
  type AuthorityEnvelopeDocuments,
} from '../governance/authority-ceiling.js'
import { evaluateAuthorityCeiling } from '../governance/runtime-authority.js'
import type { RuntimeAuthority } from '../governance/runtime-authority.js'
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'

/** The effect each arm asks approval FOR: executing it ⇒ 'allow'. */
const DESIRED_EFFECT = 'allow' as const

/**
 * The realm-qualified approval scope of one effect. Realm non-confusion at the
 * approval plane: the matcher resource names the Realm inside it, so a
 * realm-A rule can never cover a realm-B effect (PR0: realms never confuse).
 */
export function effectApprovalScope(effect: Effect, realmId: string): { operationClass: string; matcher: { kind: 'exact'; resource: string } } {
  if (effect.kind === 'tool-invoke') return { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${realmId}|tool:${effect.toolName}` } }
  if (effect.kind === 'domain-ref') return { operationClass: 'domain-ref', matcher: { kind: 'exact', resource: `${realmId}|domain:${effect.domainAuthorityId}` } }
  return { operationClass: effect.kind, matcher: { kind: 'exact', resource: `${effect.resource.realmId}|${effect.resource.canonicalLocator}` } }
}

function policyScope(effect: Effect, realmId: string): ToolPolicyScope {
  const scope = effectApprovalScope(effect, realmId)
  return { realmId, effectKind: scope.operationClass as ToolPolicyScope['effectKind'], matcher: scope.matcher }
}

function ceilingReaches(ceiling: EffectiveCeiling, desired: keyof typeof AUTHORITY_EFFECT_PRECEDENCE): boolean {
  return ceiling.status === 'decided' && AUTHORITY_EFFECT_PRECEDENCE[ceiling.effect] >= AUTHORITY_EFFECT_PRECEDENCE[desired]
}

/** Why a whole effect set was ruled UNAPPROVABLE before any reviewer exists. */
export interface UnapprovableReason {
  readonly effectIndex: number
  readonly plane: 'expansion' | 'approval'
  readonly detail: string
}

/** Per-effect expansion verdicts (the plan §5 "完整 Effect Set" view). */
export interface EffectSetExpansion {
  /** Effects the policy ALREADY authorizes (decided `allow`). */
  readonly allowed: readonly number[]
  /** Effects needing an Ask (`ask` or `no-authority`). */
  readonly needsApproval: readonly number[]
  /** The first effect that made the whole set unapprovable, if any. */
  readonly unapprovable: UnapprovableReason | null
}

/**
 * The EXPANSION-plane pass over the whole set: does the policy authorize the
 * call as it stands? A decided `deny` or an `undetermined` effect poisons the
 * WHOLE set (approval must never contain one), and reports which leg poisoned
 * it. `no-authority` is NOT a deny — it is the absence of authority, which an
 * Ask exists to answer (A1-4's expansion arm).
 */
export function evaluateEffectSetExpansion(
  effects: RequestedEffectSet,
  realmId: string,
  policy: ToolPolicyDocument,
  subtreeContains?: SubtreeContains,
): EffectSetExpansion {
  const allowed: number[] = []
  const needsApproval: number[] = []
  let unapprovable: UnapprovableReason | null = null
  for (let index = 0; index < effects.effects.length; index += 1) {
    if (unapprovable !== null) break
    const effect = effects.effects[index] as Effect
    const ceiling = evaluateToolPolicyExpansionAuthority(policy, policyScope(effect, realmId), subtreeContains)
    if (ceiling.status === 'undetermined') {
      unapprovable = { effectIndex: index, plane: 'expansion', detail: `effect ${index} (${effect.kind}) is undetermined on the expansion plane — a request containing an undetermined effect must not be approved (plan §5)` }
    } else if (ceiling.status === 'decided' && ceiling.effect === 'deny') {
      unapprovable = { effectIndex: index, plane: 'expansion', detail: `effect ${index} (${effect.kind}) is decided DENY by the policy — Team deny is final; no approval exists for it` }
    } else if (ceiling.status === 'decided' && ceilingReaches(ceiling, DESIRED_EFFECT)) {
      allowed.push(index)
    } else {
      needsApproval.push(index)
    }
  }
  return { allowed, needsApproval, unapprovable }
}

/** Outcome of planning the ONE case: the plan, or WHY no case may open. */
export type EffectSetPlanOutcome =
  | { readonly ok: true; readonly value: EffectSetApprovalPlan }
  | { readonly ok: false; readonly unapprovable: UnapprovableReason }

/** What opening the ONE case for this call requires. */
export interface EffectSetApprovalPlan {
  readonly approvalCaseId: string
  readonly requiredAuthority: ProposalAuthorityPosition
  readonly perEffectRequired: readonly ProposalAuthorityPosition[]
  readonly effectSetFingerprint: string
  readonly authorityGeneration: number
}

/** The one logical case identity: (member, beneficiary rung, effect-set
 *  fingerprint, authority-generation correlation) — never a callId, never a
 *  model-chosen name; every field derived server-side (A2-7 discipline). */
export function toolAskApprovalCaseId(input: {
  readonly teamSessionId: string
  readonly instanceId: string
  readonly effectSetFingerprint: string
  readonly authorityGeneration: number
}): string {
  return `tadm:${input.teamSessionId}:${input.instanceId}:${input.effectSetFingerprint}:g${String(input.authorityGeneration)}`
}

/**
 * The APPROVAL-plane plan for the effects that need an Ask: the rung each
 * effect independently requires (Alpha.4's walk, one rung above the
 * beneficiary), and the ONE case at the highest of them. An `undetermined`
 * effect or an unreadable bound document refuses the WHOLE plan —
 * fail-closed, and no case is minted for an unapprovable set.
 */
export function planEffectSetApproval(input: {
  readonly effects: RequestedEffectSet
  readonly needApproval: readonly number[]
  readonly realmId: string
  readonly beneficiaryAuthority: RuntimeAuthority
  readonly documents: AuthorityEnvelopeDocuments
  readonly authorityGeneration: number
  readonly teamSessionId: string
  readonly instanceId: string
  readonly subtreeContains?: SubtreeContains
}): EffectSetPlanOutcome {
  const perEffectRequired: ProposalAuthorityPosition[] = []
  let required: ProposalAuthorityPosition | undefined
  for (const index of input.needApproval) {
    const effect = input.effects.effects[index] as Effect
    const scope = effectApprovalScope(effect, input.realmId)
    let evaluation
    try {
      evaluation = evaluateAuthorityCeiling({
        beneficiaryAuthority: input.beneficiaryAuthority,
        // The initiator here is the BENEFICIARY: direct execution was already
        // refused by the expansion plane; this walk only asks WHICH rung can
        // sign. (Same treatment as planPermissionMutationApproval.)
        initiatorAuthority: input.beneficiaryAuthority,
        operationClass: scope.operationClass,
        matcher: scope.matcher,
        desiredEffect: DESIRED_EFFECT,
        documents: input.documents,
        ...(input.subtreeContains === undefined ? {} : { subtreeContains: input.subtreeContains }),
      })
    } catch (error) {
      if (error instanceof AuthorityBindingError) {
        if (error.code === AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE) {
          return { ok: false, unapprovable: { effectIndex: index, plane: 'approval', detail: `a bound authority document was unreadable while planning effect ${index} (authority-unavailable is not an outcome a case may open on)` } }
        }
        if (error.code === AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT) {
          return { ok: false, unapprovable: { effectIndex: index, plane: 'approval', detail: `the ladder/document binding is defective while planning effect ${index}: ${error.message}` } }
        }
      }
      throw error
    }
    if (evaluation.outcome === 'undetermined' || evaluation.requiredAuthority === undefined) {
      return { ok: false, unapprovable: { effectIndex: index, plane: 'approval', detail: `effect ${index} (${effect.kind}) is undetermined on the approval plane — a request containing an undetermined effect must not be approved (plan §5); no case is minted without a requiredAuthority` } }
    }
    perEffectRequired[index] = evaluation.requiredAuthority
    // Highest rung by ladder rank, derived through the SAME rank table the
    // governance lane owns (never a second ordering).
    if (required === undefined || authorityRank(evaluation.requiredAuthority) > authorityRank(required)) {
      required = evaluation.requiredAuthority
    }
  }
  if (required === undefined) {
    return { ok: false, unapprovable: { effectIndex: -1, plane: 'approval', detail: 'no effect needed approval, so there is nothing to plan — the caller must not open a case with an empty ask' } }
  }
  return {
    ok: true,
    value: {
      approvalCaseId: toolAskApprovalCaseId({
        teamSessionId: input.teamSessionId,
        instanceId: input.instanceId,
        effectSetFingerprint: input.effects.fingerprint,
        authorityGeneration: input.authorityGeneration,
      }),
      requiredAuthority: required,
      perEffectRequired,
      effectSetFingerprint: input.effects.fingerprint,
      authorityGeneration: input.authorityGeneration,
    },
  }
}

/** The durable inputs one approval carries back to the execution boundary. */
export interface PresentedApproval {
  readonly approvalCaseId: string
  readonly reviewerAuthority: RuntimeAuthority
  readonly beneficiaryAuthority: RuntimeAuthority
  readonly requiredAuthorityAtCreation: ProposalAuthorityPosition
  readonly effectSetFingerprint: string
  readonly authorityGenerationAtCreation: number
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
export function verifyEffectSetApproval(input: {
  readonly effects: RequestedEffectSet
  readonly realmId: string
  readonly approval: PresentedApproval
  readonly currentAuthorityGeneration: number
  readonly documents: AuthorityEnvelopeDocuments
  readonly subtreeContains?: SubtreeContains
}): GovernanceResult<{ readonly reviewer: RuntimeAuthority }> {
  const stale = (detail: string): { ok: false; error: { code: 'APPROVAL_STALE'; message: string; details: Record<string, string> } } => ({
    ok: false,
    error: { code: 'APPROVAL_STALE', message: `admission refused: the presented approval does not cover this execution (${detail})`, details: { refusal: 'approval-stale', detail } },
  })
  if (input.approval.effectSetFingerprint !== input.effects.fingerprint) {
    return stale(`the approval case was decided for effect set ${input.approval.effectSetFingerprint}, not this call's ${input.effects.fingerprint} — a multi-effect approval covers the WHOLE set it saw`)
  }
  if (input.approval.authorityGenerationAtCreation !== input.currentAuthorityGeneration) {
    return stale(`the authority generation moved from ${String(input.approval.authorityGenerationAtCreation)} to ${String(input.currentAuthorityGeneration)} between approval and execution; no auto-trim, no retry (design §4.3)`)
  }
  for (let index = 0; index < input.effects.effects.length; index += 1) {
    const effect = input.effects.effects[index] as Effect
    const scope = effectApprovalScope(effect, input.realmId)
    let evaluation
    try {
      evaluation = evaluateAuthorityCeiling({
        beneficiaryAuthority: input.approval.beneficiaryAuthority,
        initiatorAuthority: input.approval.reviewerAuthority,
        operationClass: scope.operationClass,
        matcher: scope.matcher,
        desiredEffect: DESIRED_EFFECT,
        documents: input.documents,
        ...(input.subtreeContains === undefined ? {} : { subtreeContains: input.subtreeContains }),
      })
    } catch (error) {
      if (error instanceof AuthorityBindingError) {
        return stale(`re-validation of effect ${index} could not read a bound document (${error.message}) — an unreadable ceiling never presents as legal`)
      }
      throw error
    }
    if (evaluation.outcome === 'undetermined' || evaluation.requiredAuthority === undefined) {
      return stale(`effect ${index} (${effect.kind}) is undetermined at execution time — an approval that once covered it does not survive the scope becoming unapprovable`)
    }
    const reviewerIsCaseReviewer = mayReview(
      input.approval.reviewerAuthority,
      input.approval.beneficiaryAuthority,
      input.approval.requiredAuthorityAtCreation,
    )
    const reviewerCoversCurrentRung = mayReview(
      input.approval.reviewerAuthority,
      input.approval.beneficiaryAuthority,
      evaluation.requiredAuthority,
    )
    if (!reviewerIsCaseReviewer) {
      return stale(`effect ${index}: the reviewer position ${input.approval.reviewerAuthority} may not review at the case's required rung ${input.approval.requiredAuthorityAtCreation} (self-approval and same-level review are never legal)`)
    }
    if (!reviewerCoversCurrentRung) {
      return stale(`effect ${index}: the required rung rose to ${evaluation.requiredAuthority} after the leg opened — the old reviewer cannot allow what the escalated ladder now needs`)
    }
    let ceiling: EffectiveCeiling
    try {
      ceiling = grantCeiling(input.approval.reviewerAuthority, input.documents, scope, input.subtreeContains)
    } catch (error) {
      if (error instanceof AuthorityBindingError) {
        return stale(`effect ${index}: the reviewer's ceiling could not be computed (${error.message})`)
      }
      throw error
    }
    if (!ceilingReaches(ceiling, DESIRED_EFFECT)) {
      return stale(`effect ${index}: the reviewer's own envelope ceiling on this scope is ${ceiling.status === 'decided' ? ceiling.effect : ceiling.status}, not allow — envelope coverage is checked per effect, and a batch is all-or-nothing (no partial-run of a covered subset)`)
    }
  }
  return { ok: true, value: { reviewer: input.approval.reviewerAuthority } }
}
