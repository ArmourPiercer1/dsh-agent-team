/**
 * Alpha.6 PR2a — the single pure ReviewCapability evaluator.
 *
 * The evaluator consumes the SAME `BlueprintReviewPolicy` predicates as the
 * router. It never re-implements "ordinary ask" rules and never accepts a
 * model/client-supplied authority claim.
 *
 * @module @dsh-agent-team/runtime/review-authority/evaluator
 */
import { blueprintReviewPolicyFrom, isDelegableOrdinaryToolAsk, isLeaderException, } from '../review-router/policy.js';
import { REVIEW_CAPABILITY_ENTRIES, ReviewCapabilityCandidate } from './types.js';
function refuse(code, reason) {
    return { ok: false, code, reason };
}
function nativeCapability(facts, entry) {
    if (facts.operationScope === null || facts.operationOwner === null) {
        return refuse('operation-owner-unknown', 'the operation scope/owner is unknown');
    }
    if (facts.operationTool === null)
        return refuse('operation-tool-unknown', 'the trusted operation tool is unknown');
    if (facts.reviewer.kind === 'human') {
        const capability = {
            principal: facts.reviewer,
            source: 'native',
            entry,
            effectiveReviewAuthority: 'human-user',
            approvalCaseId: facts.currentCase.approvalCaseId,
            currentLegRequestId: facts.currentCase.currentLegRequestId,
            legOrdinal: facts.currentCase.legOrdinal,
            scope: facts.operationScope,
            scopeFingerprint: facts.scopeFingerprint,
            ...(facts.effectSetFingerprint === undefined ? {} : { effectSetFingerprint: facts.effectSetFingerprint }),
            blueprintContentHash: facts.blueprint.contentHash,
            blueprintRevision: facts.blueprint.revision,
            authorityGeneration: facts.authorityGeneration,
            operationOwner: facts.operationOwner,
            operationTool: facts.operationTool,
        };
        return { ok: true, candidate: ReviewCapabilityCandidate.of(capability) };
    }
    if (facts.reviewer.kind === 'instance' && facts.reviewer.role === 'leader') {
        const capability = {
            principal: facts.reviewer,
            source: 'native',
            entry,
            effectiveReviewAuthority: 'leader',
            approvalCaseId: facts.currentCase.approvalCaseId,
            currentLegRequestId: facts.currentCase.currentLegRequestId,
            legOrdinal: facts.currentCase.legOrdinal,
            scope: facts.operationScope,
            scopeFingerprint: facts.scopeFingerprint,
            ...(facts.effectSetFingerprint === undefined ? {} : { effectSetFingerprint: facts.effectSetFingerprint }),
            blueprintContentHash: facts.blueprint.contentHash,
            blueprintRevision: facts.blueprint.revision,
            authorityGeneration: facts.authorityGeneration,
            operationOwner: facts.operationOwner,
            operationTool: facts.operationTool,
        };
        return { ok: true, candidate: ReviewCapabilityCandidate.of(capability) };
    }
    return refuse('reviewer-not-member', 'the reviewer is not a Member instance');
}
function delegatedCapability(facts, entry, policy) {
    if (entry === 'terminal-close')
        return refuse('terminal-close-not-delegable', 'a delegated Officer may not terminal-close a case');
    if (facts.currentCase.status !== 'pending')
        return refuse('case-not-pending', 'the case is not pending');
    if (facts.currentCase.reviewAuthority !== 'leader')
        return refuse('leg-not-leader-rung', 'the current leg is not at the leader rung');
    if (facts.requiresHuman)
        return refuse('requires-human', 'the current leg requires Human authority');
    if (facts.fixedLeaderOrHumanCategory)
        return refuse('fixed-leader-or-human-category', 'the current leg is a fixed Leader/Human category');
    if (facts.currentLegTransfer !== null)
        return refuse('transfer-overrides-delegation', 'the current leg has been transferred');
    if (facts.currentCase.kind !== 'leader-approval')
        return refuse('not-ordinary-ask', 'the current case is not a leader-approval operation ask');
    if (facts.currentCase.mutationProposalFingerprint !== null)
        return refuse('not-ordinary-ask', 'the current case is a mutation case');
    if (facts.operationOwner === null)
        return refuse('operation-owner-unknown', 'the trusted OperationOwner is unknown');
    if (facts.operationTool === null)
        return refuse('operation-tool-unknown', 'the trusted operation tool is unknown');
    if (facts.operationTool.definitionIdentity.trim().length === 0)
        return refuse('operation-tool-unknown', 'the trusted operation tool identity is empty');
    if (facts.operationOwner.rootSessionId !== facts.operationScope?.rootSessionId) {
        return refuse('operation-owner-unknown', 'the OperationOwner is not in this operation scope');
    }
    if (facts.operationOwner.templateId === policy.officerTemplateId) {
        return refuse('operation-owner-is-officer', 'the actual OperationOwner is the Officer; self-ask must route to Leader');
    }
    if (isLeaderException(policy, facts.operationOwner.templateId, facts.operationTool)) {
        return refuse('leader-exception', 'the OperationOwner template × tool is a Leader exception');
    }
    if (facts.currentOfficer === undefined)
        return refuse('officer-not-resolved', 'no current Officer is resolved');
    if (facts.reviewer.kind !== 'instance' || facts.reviewer.role !== 'member') {
        return refuse('reviewer-not-member', 'the reviewer is not a Member instance');
    }
    if (facts.reviewerMember === undefined)
        return refuse('reviewer-not-current-officer', 'the reviewer Member binding is unknown');
    if (facts.reviewer.instanceId !== facts.currentOfficer.instanceId || facts.reviewerMember.instanceId !== facts.currentOfficer.instanceId) {
        return refuse('reviewer-not-current-officer', 'the reviewer is not the unique current Officer instance');
    }
    if (facts.reviewerMember.templateId !== facts.currentOfficer.templateId || facts.currentOfficer.templateId !== policy.officerTemplateId) {
        return refuse('officer-template-mismatch', 'the reviewer/Officer template does not match the Blueprint Officer');
    }
    if (facts.reviewerMember.rootSessionId !== facts.currentOfficer.rootSessionId ||
        facts.currentOfficer.rootSessionId !== facts.operationScope.rootSessionId) {
        return refuse('reviewer-not-current-officer', 'the reviewer, current Officer and operation are not in the same Team');
    }
    if (facts.blueprint.reviewRouting === undefined)
        return refuse('blueprint-routing-absent', 'the Blueprint has no reviewRouting block');
    if (facts.currentCase.scopeFingerprint !== facts.scopeFingerprint) {
        return refuse('scope-mismatch', 'the case scope fingerprint does not match the operation scope');
    }
    if (facts.currentCase.authorityGeneration !== facts.authorityGeneration) {
        return refuse('authority-generation-mismatch', 'the case authority generation does not match the trusted generation');
    }
    if (facts.paManifestPresent && (facts.effectSetFingerprint === undefined || facts.effectSetFingerprint.trim().length === 0)) {
        return refuse('effect-set-mismatch', 'a PA manifest is present but its effect-set fingerprint is missing');
    }
    if (facts.effectSetFingerprint !== undefined && facts.effectSetFingerprint.trim().length === 0) {
        return refuse('effect-set-mismatch', 'the effect-set fingerprint is present but empty');
    }
    const ordinaryAsk = {
        kind: facts.currentCase.kind,
        reviewAuthority: facts.currentCase.reviewAuthority,
        requestedEffect: facts.currentCase.requestedEffect,
        operationFingerprint: facts.currentCase.operationFingerprint,
        mutationProposalFingerprint: facts.currentCase.mutationProposalFingerprint,
        authorityScope: facts.operationScope,
        operationTool: { owner: facts.operationTool.owner, name: facts.operationTool.name },
        perEffectRequiredAuthorities: facts.perEffectRequiredAuthorities,
        fixedLeaderOrHumanCategory: facts.fixedLeaderOrHumanCategory,
    };
    if (!isDelegableOrdinaryToolAsk(ordinaryAsk))
        return refuse('not-ordinary-ask', 'the case is not in the frozen ordinary-ask set');
    if (entry === 'escalate') {
        if (facts.officerActedOnEarlierLeg)
            return refuse('officer-acted-on-earlier-leg', 'the Officer already acted on an earlier leg of this case');
        if (facts.escalationSuccessor !== 'human-user')
            return refuse('escalation-successor-not-human', 'the only legal escalation successor is human-user');
    }
    const capability = {
        principal: facts.reviewer,
        source: 'blueprint-officer',
        entry,
        effectiveReviewAuthority: 'leader',
        approvalCaseId: facts.currentCase.approvalCaseId,
        currentLegRequestId: facts.currentCase.currentLegRequestId,
        legOrdinal: facts.currentCase.legOrdinal,
        scope: facts.operationScope,
        scopeFingerprint: facts.scopeFingerprint,
        ...(facts.effectSetFingerprint === undefined ? {} : { effectSetFingerprint: facts.effectSetFingerprint }),
        blueprintContentHash: facts.blueprint.contentHash,
        blueprintRevision: facts.blueprint.revision,
        authorityGeneration: facts.authorityGeneration,
        operationOwner: facts.operationOwner,
        operationTool: facts.operationTool,
    };
    return { ok: true, candidate: ReviewCapabilityCandidate.of(capability) };
}
/**
 * Evaluate one entry action for the real principal. Native Leader/Human
 * principals keep their existing authority; Member delegation is allowed only
 * through the Blueprint Officer path and the shared ordinary-ask set.
 */
export function evaluateReviewCapability(facts, entry) {
    if (!REVIEW_CAPABILITY_ENTRIES.includes(entry))
        return refuse('entry-not-allowed', 'unknown capability entry');
    if (facts.reviewer.kind === 'human' || (facts.reviewer.kind === 'instance' && facts.reviewer.role === 'leader')) {
        return nativeCapability(facts, entry);
    }
    if (facts.operationScope === null || facts.operationOwner === null) {
        return refuse('operation-owner-unknown', 'the operation scope/owner is unknown');
    }
    if (facts.operationTool === null) {
        return refuse('operation-tool-unknown', 'the trusted operation tool is unknown');
    }
    const policy = blueprintReviewPolicyFrom(facts.blueprint.reviewRouting);
    if (policy === null)
        return refuse('blueprint-routing-absent', 'the Blueprint has no reviewRouting block');
    return delegatedCapability(facts, entry, policy);
}
/** Project the candidate onto the same durable decision row's evidence field. */
export function decisionCapabilityEvidenceFrom(candidate) {
    const capability = candidate.capability;
    return {
        source: capability.source,
        entry: capability.entry,
        effectiveReviewAuthority: capability.effectiveReviewAuthority,
        approvalCaseId: capability.approvalCaseId,
        currentLegRequestId: capability.currentLegRequestId,
        legOrdinal: capability.legOrdinal,
        scopeFingerprint: capability.scopeFingerprint,
        ...(capability.effectSetFingerprint === undefined ? {} : { effectSetFingerprint: capability.effectSetFingerprint }),
        blueprintContentHash: capability.blueprintContentHash,
        blueprintRevision: capability.blueprintRevision,
        authorityGeneration: capability.authorityGeneration,
        operationOwnerInstanceId: capability.operationOwner.instanceId,
        operationOwnerTemplateId: capability.operationOwner.templateId,
        operationToolDefinitionIdentity: capability.operationTool.definitionIdentity,
    };
}
//# sourceMappingURL=evaluator.js.map