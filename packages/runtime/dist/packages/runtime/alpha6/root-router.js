import { hasAuthorityResolver } from '../control/types.js';
import { blueprintReviewPolicyFrom, routeReview } from '../review-router/index.js';
function authorityScopeOf(row) {
    const payload = row.reviewPayload;
    if (payload === null || typeof payload !== 'object')
        return null;
    const scope = payload['authorityScope'];
    return scope === undefined ? null : scope;
}
function transferOf(transfer) {
    if (transfer === undefined)
        return null;
    return transfer.target === 'leader'
        ? { target: 'leader', actor: transfer.actor.kind === 'officer' ? 'officer' : 'trusted-team-runtime' }
        : { target: 'native-human', actor: 'trusted-team-runtime' };
}
function leaderTargetOf(members, leaderTemplateId) {
    const leader = members.find((member) => member.templateId === leaderTemplateId &&
        member.lifecycle === 'RUNNING' &&
        typeof member.instanceId === 'string' &&
        member.instanceId.length > 0);
    return leader === undefined
        ? null
        : { instanceId: leader.instanceId, templateId: leader.templateId };
}
function officerStateOf(members, officerTemplateId, leaderTemplateId) {
    const candidates = members.filter((member) => member.templateId === officerTemplateId &&
        member.childSessionId !== undefined &&
        member.templateId !== leaderTemplateId);
    const active = candidates.filter((member) => member.lifecycle === 'RUNNING');
    if (active.length === 1) {
        const officer = active[0];
        return {
            status: 'active',
            instanceId: officer.instanceId,
            templateId: officer.templateId,
        };
    }
    if (active.length > 1)
        return { status: 'ambiguous', activeCount: active.length };
    if (candidates.length === 0)
        return { status: 'not-admitted' };
    return {
        status: 'missing',
        hasAdmissionHistory: candidates.some((member) => member.lifecycle === 'ARCHIVED' || member.lifecycle === 'DISPOSED'),
    };
}
function legFactsOf(row, fixedLeaderOrHumanCategory) {
    const reviewAuthority = row.reviewAuthority;
    const category = fixedLeaderOrHumanCategory;
    const authorityScope = authorityScopeOf(row);
    return {
        requestId: row.requestId,
        status: row.status,
        kind: row.kind,
        reviewAuthority: reviewAuthority ?? 'member',
        operationOwnerTemplateId: row.operationOwnerTemplateId ?? null,
        ordinaryAsk: row.kind === 'leader-approval' &&
            reviewAuthority === 'leader' &&
            row.requestedEffect !== undefined &&
            row.operationToolOwner !== undefined &&
            row.operationToolName !== undefined &&
            authorityScope !== null
            ? {
                kind: row.kind,
                reviewAuthority,
                requestedEffect: row.requestedEffect,
                operationFingerprint: row.operationFingerprint ?? null,
                mutationProposalFingerprint: row.mutationProposalFingerprint ?? null,
                authorityScope,
                operationTool: {
                    owner: row.operationToolOwner,
                    name: row.operationToolName,
                },
                perEffectRequiredAuthorities: row.perEffectRequiredAuthorities ?? [],
                fixedLeaderOrHumanCategory: category === true,
            }
            : null,
        requiresHuman: reviewAuthority === 'human-user',
        hasLegalResolver: reviewAuthority !== undefined && hasAuthorityResolver(reviewAuthority),
        fixedLeaderCategory: category === true,
    };
}
export function createAlpha6RootRouter(input) {
    const policy = blueprintReviewPolicyFrom(input.routing);
    return {
        async route(requestId) {
            let state;
            try {
                state = await input.control.readControlState(input.rootSessionId);
            }
            catch {
                return null;
            }
            const row = state.requests.find((candidate) => candidate.requestId === requestId);
            if (row === undefined || row.approvalCaseId === undefined || row.legOrdinal === undefined) {
                return null;
            }
            const members = await input.members.list(input.rootSessionId);
            const categoryAnswer = await input.fixedLeaderOrHumanCategory({ kind: row.kind });
            const category = categoryAnswer === true ? true : categoryAnswer === false ? false : null;
            const currentLeg = legFactsOf(row, category);
            const transfer = transferOf(state.transfers.find((candidate) => candidate.currentLegRequestId === requestId));
            return routeReview({
                policy,
                currentLeg,
                currentOfficer: officerStateOf(members, input.routing.officerTemplateId, input.leaderTemplateId),
                leader: leaderTargetOf(members, input.leaderTemplateId),
                transfer,
            });
        },
    };
}
//# sourceMappingURL=root-router.js.map