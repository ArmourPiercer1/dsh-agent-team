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
import { AUTHORITY_EFFECT_PRECEDENCE, } from '../../domain/authority-envelope/src/index.js';
import { evaluateToolPolicyExpansionAuthority, } from '../../domain/tool-governance/src/index.js';
import { AuthorityBindingError, AUTHORITY_CEILING_ERROR_CODES, authorityRank, grantCeiling, mayReview, } from '../governance/authority-ceiling.js';
import { evaluateAuthorityCeiling, rungAbove } from '../governance/runtime-authority.js';
/** The effect each arm asks approval FOR: executing it ⇒ 'allow'. */
const DESIRED_EFFECT = 'allow';
/**
 * The realm-qualified approval scope of one effect. Realm non-confusion at the
 * approval plane: the matcher resource names the Realm inside it, so a
 * realm-A rule can never cover a realm-B effect (PR0: realms never confuse).
 */
export function effectApprovalScope(effect, realmId) {
    if (effect.kind === 'tool-invoke')
        return { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${realmId}|tool:${effect.toolName}` } };
    if (effect.kind === 'domain-ref')
        return { operationClass: 'domain-ref', matcher: { kind: 'exact', resource: `${realmId}|domain:${effect.domainAuthorityId}` } };
    return { operationClass: effect.kind, matcher: { kind: 'exact', resource: `${effect.resource.realmId}|${effect.resource.canonicalLocator}` } };
}
function policyScope(effect, realmId) {
    const scope = effectApprovalScope(effect, realmId);
    return { realmId, effectKind: scope.operationClass, matcher: scope.matcher };
}
function ceilingReaches(ceiling, desired) {
    return ceiling.status === 'decided' && AUTHORITY_EFFECT_PRECEDENCE[ceiling.effect] >= AUTHORITY_EFFECT_PRECEDENCE[desired];
}
/** Does a projection entry's matcher cover the denied effect's scope? Subtree
 *  coverage needs the seam; without it, coverage — like ownership — is
 *  unanswerable, which fails closed to unattributed. */
function sourceCovers(entry, matcher, subtreeContains) {
    if (entry.matcher.kind === 'exact' && matcher.kind === 'exact')
        return entry.matcher.resource === matcher.resource;
    if (entry.matcher.kind === 'subtree' && subtreeContains !== undefined)
        return subtreeContains(entry.matcher.resource, matcher.resource);
    return false;
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
export function evaluateEffectSetExpansion(effects, realmId, policy, subtreeContains) {
    const allowed = [];
    const needsApproval = [];
    const policyDenied = [];
    let unapprovable = null;
    for (let index = 0; index < effects.effects.length; index += 1) {
        if (unapprovable !== null)
            break;
        const effect = effects.effects[index];
        const ceiling = evaluateToolPolicyExpansionAuthority(policy, policyScope(effect, realmId), subtreeContains);
        if (ceiling.status === 'undetermined') {
            unapprovable = { effectIndex: index, plane: 'expansion', detail: `effect ${index} (${effect.kind}) is undetermined on the expansion plane — a request containing an undetermined effect must not be approved (plan §5)` };
        }
        else if (ceiling.status === 'decided' && ceiling.effect === 'deny') {
            // Ruling ①: route the deny into the Ask, keep the provenance tag.
            needsApproval.push(index);
            policyDenied.push(index);
        }
        else if (ceiling.status === 'decided' && ceilingReaches(ceiling, DESIRED_EFFECT)) {
            allowed.push(index);
        }
        else {
            needsApproval.push(index);
        }
    }
    return { allowed, needsApproval, policyDenied, unapprovable };
}
/** The one logical case identity: (member, beneficiary rung, effect-set
 *  fingerprint, authority-generation correlation) — never a callId, never a
 *  model-chosen name; every field derived server-side (A2-7 discipline). */
export function toolAskApprovalCaseId(input) {
    return `tadm:${input.teamSessionId}:${input.instanceId}:${input.effectSetFingerprint}:g${String(input.authorityGeneration)}`;
}
/**
 * The APPROVAL-plane plan for the effects that need an Ask: the rung each
 * effect independently requires (Alpha.4's walk, one rung above the
 * beneficiary), and the ONE case at the highest of them. An `undetermined`
 * effect or an unreadable bound document refuses the WHOLE plan —
 * fail-closed, and no case is minted for an unapprovable set.
 */
export function planEffectSetApproval(input) {
    const perEffectRequired = [];
    const deniedCarried = [];
    const denyOwnerFloor = {};
    let required;
    for (const index of input.needApproval) {
        const effect = input.effects.effects[index];
        const scope = effectApprovalScope(effect, input.realmId);
        let evaluation;
        const owned = (detail) => input.policyDenied?.has(index) === true
            ? {
                ok: false,
                unapprovable: {
                    effectIndex: index,
                    plane: 'approval',
                    sourceUnattributed: true,
                    detail: `effect ${index} (${effect.kind}) is DENIED and its owning authority cannot be established — the deny source is UNATTRIBUTED (${detail}); the assembly must project the deny into the bound documents (spec §3.2/§8.2); an unattributed deny is never presented as a settled Team deny (ruling ③)`,
                },
            }
            : { ok: false, unapprovable: { effectIndex: index, plane: 'approval', detail } };
        // ---- R-1a: deny-source proof, BEFORE any rung is computed. The walk
        // answers who may approve; only the PROJECTION answers whose deny this
        // is — and only when its version still matches the call's generation.
        if (input.policyDenied?.has(index) === true) {
            if (input.denySources === undefined) {
                return owned('the assembly wires NO deny-source projection: this DENY cannot be traced to an owning authority. The state is live and stated — unwired means precise refusal (③), not dormant grace');
            }
            const entry = input.denySources.find((source) => source.realmId === input.realmId && source.effectKind === scope.operationClass && sourceCovers(source, scope.matcher, input.subtreeContains));
            if (entry === undefined) {
                return owned('no authority-state entry projects this deny — an unrelated Envelope rule is NOT backing (the Envelope answers WHO MAY APPROVE WHAT RANGE, never WHO WROTE the deny); forging the source by copying the deny into Envelope documents is forbidden (spec §3.2/§8.2)');
            }
            if (entry.sourceVersion !== input.authorityGeneration) {
                return {
                    ok: false,
                    unapprovable: {
                        effectIndex: index,
                        plane: 'approval',
                        sourceDiagnosis: 'version-drift',
                        detail: `the deny's source reference ${entry.sourceRef} was projected at authority generation g${String(entry.sourceVersion)}, but this call runs at g${String(input.authorityGeneration)} — a stale projection carries no trust, and an expired source reference is a precise refusal, not a silent pass`,
                    },
                };
            }
            const ownerFloor = rungAbove(entry.ownerAuthority);
            if (ownerFloor === undefined) {
                return {
                    ok: false,
                    unapprovable: {
                        effectIndex: index,
                        plane: 'approval',
                        sourceDiagnosis: 'owner-above-ladder',
                        detail: `this deny belongs to the top authority (${entry.ownerAuthority}, source ${entry.sourceRef}); no rung sits above it, so no one-shot approval exists — only spec §8.2's permanent mutation path can change what the top authority denied`,
                    },
                };
            }
            denyOwnerFloor[index] = ownerFloor;
        }
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
            });
        }
        catch (error) {
            if (error instanceof AuthorityBindingError) {
                if (error.code === AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE) {
                    return owned(`a bound authority document was unreadable while planning effect ${index} (authority-unavailable is not an outcome a case may open on)`);
                }
                if (error.code === AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT) {
                    // R-2a: over a DENIED effect, no-upper-rung is its OWN diagnosis —
                    // the authority is known, nobody above the beneficiary may ask.
                    if (error.problem === 'ask-has-no-upper-rung' && input.policyDenied?.has(index) === true) {
                        return {
                            ok: false,
                            unapprovable: {
                                effectIndex: index,
                                plane: 'approval',
                                noUpperRung: true,
                                detail: 'a Human Admin ask has no rung above it: the deny\'s owning authority is KNOWN, but no position may approve its own elevation — a permanent change must walk spec §8.2\'s mutation path instead (R-2a: this is not an unattributed source)',
                            },
                        };
                    }
                    return owned(`the ladder/document binding is defective while planning effect ${index}: ${error.message}`);
                }
            }
            throw error;
        }
        if (evaluation.outcome === 'undetermined' || evaluation.requiredAuthority === undefined) {
            return owned(`effect ${index} (${effect.kind}) is undetermined on the approval plane — a request containing an undetermined effect must not be approved (plan §5); no case is minted without a requiredAuthority`);
        }
        // R-1a's floor: the case must sit at least one rung ABOVE the authority
        // that owns the deny — a rung may never lift a deny belonging to itself
        // or above it. Max by THE rank table, never a second ordering.
        const floor = denyOwnerFloor[index];
        const rung = floor !== undefined && authorityRank(floor) > authorityRank(evaluation.requiredAuthority) ? floor : evaluation.requiredAuthority;
        perEffectRequired[index] = rung;
        if (input.policyDenied?.has(index) === true) {
            deniedCarried.push({ effectIndex: index, requiredAuthority: rung });
        }
        // Highest rung by ladder rank, derived through the SAME rank table the
        // governance lane owns (never a second ordering).
        if (required === undefined || authorityRank(rung) > authorityRank(required)) {
            required = rung;
        }
    }
    if (required === undefined) {
        return { ok: false, unapprovable: { effectIndex: -1, plane: 'approval', detail: 'no effect needed approval, so there is nothing to plan — the caller must not open a case with an empty ask' } };
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
            deniedEffects: deniedCarried,
            effectSetFingerprint: input.effects.fingerprint,
            authorityGeneration: input.authorityGeneration,
        },
    };
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
export function verifyEffectSetApproval(input) {
    const stale = (detail) => ({
        ok: false,
        error: { code: 'APPROVAL_STALE', message: `admission refused: the presented approval does not cover this execution (${detail})`, details: { refusal: 'approval-stale', detail } },
    });
    if (input.approval.effectSetFingerprint !== input.effects.fingerprint) {
        return stale(`the approval case was decided for effect set ${input.approval.effectSetFingerprint}, not this call's ${input.effects.fingerprint} — a multi-effect approval covers the WHOLE set it saw`);
    }
    if (input.approval.authorityGenerationAtCreation !== input.currentAuthorityGeneration) {
        return stale(`the authority generation moved from ${String(input.approval.authorityGenerationAtCreation)} to ${String(input.currentAuthorityGeneration)} between approval and execution; no auto-trim, no retry (design §4.3)`);
    }
    for (let index = 0; index < input.effects.effects.length; index += 1) {
        const effect = input.effects.effects[index];
        const scope = effectApprovalScope(effect, input.realmId);
        let evaluation;
        try {
            evaluation = evaluateAuthorityCeiling({
                beneficiaryAuthority: input.approval.beneficiaryAuthority,
                initiatorAuthority: input.approval.reviewerAuthority,
                operationClass: scope.operationClass,
                matcher: scope.matcher,
                desiredEffect: DESIRED_EFFECT,
                documents: input.documents,
                ...(input.subtreeContains === undefined ? {} : { subtreeContains: input.subtreeContains }),
            });
        }
        catch (error) {
            if (error instanceof AuthorityBindingError) {
                return stale(`re-validation of effect ${index} could not read a bound document (${error.message}) — an unreadable ceiling never presents as legal`);
            }
            throw error;
        }
        if (evaluation.outcome === 'undetermined' || evaluation.requiredAuthority === undefined) {
            return stale(`effect ${index} (${effect.kind}) is undetermined at execution time — an approval that once covered it does not survive the scope becoming unapprovable`);
        }
        const reviewerIsCaseReviewer = mayReview(input.approval.reviewerAuthority, input.approval.beneficiaryAuthority, input.approval.requiredAuthorityAtCreation);
        const reviewerCoversCurrentRung = mayReview(input.approval.reviewerAuthority, input.approval.beneficiaryAuthority, evaluation.requiredAuthority);
        if (!reviewerIsCaseReviewer) {
            return stale(`effect ${index}: the reviewer position ${input.approval.reviewerAuthority} may not review at the case's required rung ${input.approval.requiredAuthorityAtCreation} (self-approval and same-level review are never legal)`);
        }
        if (!reviewerCoversCurrentRung) {
            return stale(`effect ${index}: the required rung rose to ${evaluation.requiredAuthority} after the leg opened — the old reviewer cannot allow what the escalated ladder now needs`);
        }
        let ceiling;
        try {
            ceiling = grantCeiling(input.approval.reviewerAuthority, input.documents, scope, input.subtreeContains);
        }
        catch (error) {
            if (error instanceof AuthorityBindingError) {
                return stale(`effect ${index}: the reviewer's ceiling could not be computed (${error.message})`);
            }
            throw error;
        }
        if (!ceilingReaches(ceiling, DESIRED_EFFECT)) {
            return stale(`effect ${index}: the reviewer's own envelope ceiling on this scope is ${ceiling.status === 'decided' ? ceiling.effect : ceiling.status}, not allow — envelope coverage is checked per effect, and a batch is all-or-nothing (no partial-run of a covered subset)`);
        }
    }
    return { ok: true, value: { reviewer: input.approval.reviewerAuthority } };
}
//# sourceMappingURL=approval-case.js.map