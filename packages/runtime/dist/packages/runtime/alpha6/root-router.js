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
    // The production Leader row is the contracts-v2 LeaderInstanceRecord: it
    // has NO lifecycle and NO childSessionId (fresh-root.ts mints it that way).
    // Identity is template + instance, and an EXPLICIT terminal lifecycle is the
    // only thing that disqualifies it. Requiring RUNNING here made every Leader
    // route degrade to hold('leader-unavailable') on a real boot.
    const leader = members.find((member) => member.templateId === leaderTemplateId &&
        typeof member.instanceId === 'string' &&
        member.instanceId.length > 0 &&
        member.lifecycle !== 'ARCHIVED' &&
        member.lifecycle !== 'DISPOSED');
    return leader === undefined
        ? null
        : { instanceId: leader.instanceId, templateId: leader.templateId };
}
function officerStateOf(members, officerTemplateId, leaderTemplateId) {
    const candidates = members.filter((member) => member.templateId === officerTemplateId &&
        member.childSessionId !== undefined &&
        member.templateId !== leaderTemplateId);
    // CREATED / RUNNING / SETTLED are all live member states; SETTLED is the
    // normal idle state of an Officer between asks. Requiring RUNNING here made
    // every real idle Officer invisible and held every route.
    const active = candidates.filter((member) => member.lifecycle === 'CREATED' ||
        member.lifecycle === 'RUNNING' ||
        member.lifecycle === 'SETTLED');
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
    return {
        async route(requestId, rootSessionId) {
            const rootSessionIdForRead = rootSessionId ?? input.rootSessionId;
            const rootRouting = input.routingForRoot === undefined
                ? { routing: input.routing, leaderTemplateId: input.leaderTemplateId }
                : input.routingForRoot(rootSessionIdForRead);
            if (rootRouting === null) {
                return {
                    kind: 'hold',
                    holdReason: 'config-invalid',
                    reason: `no frozen v5 review routing is resolvable for root '${rootSessionIdForRead}'`,
                    currentLegId: requestId,
                };
            }
            const policy = blueprintReviewPolicyFrom(rootRouting.routing);
            let state;
            try {
                state = await input.control.readControlState(rootSessionIdForRead);
            }
            catch {
                return null;
            }
            const row = state.requests.find((candidate) => candidate.requestId === requestId);
            if (row === undefined || row.approvalCaseId === undefined || row.legOrdinal === undefined) {
                return null;
            }
            // J06 (2026-11-11) — a TYPED refusal, not a silent Leader fallback.
            //
            // A row that carries the bound-Blueprint identity was opened by an
            // Alpha.6-aware ask lane, so it is IN scope for ordinary-tool review: the
            // blueprint's `ordinaryToolApprovals` is supposed to decide it. If its
            // tool coordinate is missing anyway, the identity carry could not name a
            // verified governance binding for that tool (a host builtin the Team
            // assembly never placed and never verified). Inventing a coordinate would
            // be fabricating authority; quietly handing the leg to the Leader would
            // contradict `default: officer`. Neither is acceptable: the route refuses
            // BY NAME and the ask stays pending (the pending-list tool and the GUI
            // remain the recovery paths, and a Leader may still resolve it as a
            // human-visible exception), because a leg nobody is told about is still
            // better than a leg routed to the wrong decider under a false pretext.
            if (row.blueprintContentHash !== undefined &&
                row.reviewAuthority === 'leader' &&
                row.kind === 'leader-approval' &&
                (row.operationToolOwner === undefined || row.operationToolName === undefined)) {
                return {
                    kind: 'unroutable',
                    reason: 'operation-tool-identity-unavailable (the Alpha.6 identity carry found no verified governance ' +
                        'ToolBinding for this ask’s tool, so there is no trusted tool coordinate to route on — refusing ' +
                        'to invent one and refusing to fall back to the Leader)',
                };
            }
            const members = await input.members.list(rootSessionIdForRead);
            const categoryAnswer = await input.fixedLeaderOrHumanCategory({
                kind: row.kind,
                rootSessionId: rootSessionIdForRead,
                routing: rootRouting.routing,
            });
            const category = categoryAnswer === true ? true : categoryAnswer === false ? false : null;
            const currentLeg = legFactsOf(row, category);
            const transfer = transferOf(state.transfers.find((candidate) => candidate.currentLegRequestId === requestId));
            return routeReview({
                policy,
                currentLeg,
                currentOfficer: officerStateOf(members, rootRouting.routing.officerTemplateId, rootRouting.leaderTemplateId),
                leader: leaderTargetOf(members, rootRouting.leaderTemplateId),
                transfer,
            });
        },
    };
}
//# sourceMappingURL=root-router.js.map