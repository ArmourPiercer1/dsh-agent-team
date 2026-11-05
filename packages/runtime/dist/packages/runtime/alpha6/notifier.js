function subjectText(subject) {
    switch (subject.kind) {
        case 'instance':
            return `instance ${subject.instanceId}`;
        case 'template':
            return `template ${subject.templateId}`;
        case 'team':
            return `team ${subject.rootSessionId}`;
    }
}
/**
 * Render the Officer-facing wake. Deterministic per request; leads with the
 * dedup token; carries no decision and no case payload.
 */
export function renderOfficerReviewWake(request) {
    const requester = request.requester.kind === 'instance'
        ? request.requester.instanceId
        : `human:${request.requester.humanId}`;
    return [
        `[team-review-wake requestId=${request.requestId}]`,
        'A Team member operation is waiting for review.',
        '',
        `requestId: ${request.requestId}`,
        `requester: ${requester}`,
        `subject: ${subjectText(request.subject)}`,
        ...(request.toolName !== undefined ? [`tool: ${request.toolName}`] : []),
        ...(request.summary !== undefined ? [`summary: ${request.summary}`] : []),
        '',
        'Decide with `team_resolve_control` using this EXACT requestId.',
        'Inspect your pending work with `team_list_pending_control`.',
    ].join('\n');
}
/**
 * Compose the legacy Leader notifier and the A6 Officer wake behind ONE port.
 *
 * - `legacy` decision → the legacy notifier is invoked unchanged.
 * - `alpha6` decision → exactly one wake to the resolved Officer session and
 *   NO Leader notification.
 * - A `refused` decision → throw; never the Leader fallback.
 */
export function createComposedControlNotifier(ports) {
    return {
        async notifyLeaderRequest(request) {
            if (ports.decision.mode === 'refused') {
                throw new Error(`Alpha.6 review routing is enabled but refused (${ports.decision.refused}); no Leader fallback`);
            }
            if (ports.decision.mode !== 'alpha6') {
                await ports.legacy.notifyLeaderRequest(request);
                return;
            }
            await ports.wake({
                targetSessionId: ports.recipientSessionId,
                wakeId: `review:${request.requestId}`,
                text: renderOfficerReviewWake(request),
            });
        },
    };
}
/**
 * The root-level Alpha.6 notification path: a control request is resolved
 * through the SAME trusted facts port the decision path uses, then delivered
 * to that reviewer's live child session. There is NO Leader fallback:
 * unresolvable reviewer, missing case identity or a delivery failure throws
 * (the service's notification is fire-and-forget/liveness, so throwing cannot
 * change the durable outcome, but it must be visible).
 */
export function createAlpha6RootControlNotifier(ports) {
    const notifier = {
        async notifyLeaderRequest(request) {
            if (request.approvalCaseId === undefined || request.legOrdinal === undefined) {
                // A case-less leader-approval row is the plain C1 Leader ask (the
                // team_request_control tool and the non-case pre-execute branch still
                // mint them). It has no review route to compute, but its legal
                // recipient is the Leader — never a silent throw.
                if (request.kind === 'leader-approval' && ports.notifyLeader !== undefined) {
                    await ports.notifyLeader(request);
                    return;
                }
                throw new Error(`Alpha.6 review wake refused: request '${request.requestId}' carries no approval case identity and no Leader notification seam`);
            }
            if (ports.route !== undefined) {
                const route = await ports.route(request.requestId, request.rootSessionId);
                if (route === null) {
                    throw new Error(`Alpha.6 review wake refused: no trusted route for request '${request.requestId}' (no Leader fallback)`);
                }
                if (route.kind === 'no-work')
                    return;
                if (route.kind === 'unroutable' || route.kind === 'hold') {
                    // A row whose OWN durable authority is the Leader (the legacy
                    // parameter-permission ask carries no Alpha.6 ordinary-tool facts)
                    // is legally the Leader's to settle. This is not a fallback for a
                    // member-authority leg: those still refuse below.
                    if (request.kind === 'leader-approval' && request.reviewAuthority === 'leader' && ports.notifyLeader !== undefined) {
                        await ports.notifyLeader(request);
                        return;
                    }
                    throw new Error(`Alpha.6 review wake refused: request '${request.requestId}' is ${route.kind} (${route.reason}); no Officer wake and no Leader fallback`);
                }
                if (route.target.kind === 'native-human')
                    return;
                if (route.target.routeRole === 'leader') {
                    if (ports.notifyLeader === undefined) {
                        throw new Error(`Alpha.6 review wake refused: request '${request.requestId}' routes to the Leader but no Leader notification seam is wired`);
                    }
                    await ports.notifyLeader(request);
                    return;
                }
                return await deliverOfficerWake(ports, request, route.target.instanceId);
            }
            const reviewer = await ports.resolveCurrentReviewer({
                rootSessionId: ports.rootSessionId,
                approvalCaseId: request.approvalCaseId,
                currentLegRequestId: request.requestId,
                legOrdinal: request.legOrdinal,
            });
            if (reviewer === null) {
                throw new Error(`Alpha.6 review wake refused: no trusted current reviewer for request '${request.requestId}' (no Leader fallback)`);
            }
            return await deliverOfficerWake(ports, request, reviewer.instanceId);
        },
    };
    return notifier;
    async function deliverOfficerWake(ports, request, reviewerInstanceId) {
        const reviewer = { instanceId: reviewerInstanceId };
        const member = await ports.memberSession(request.rootSessionId, reviewer.instanceId);
        const targetSessionId = member?.childSessionId;
        if (typeof targetSessionId !== 'string' || targetSessionId.length === 0) {
            throw new Error(`Alpha.6 review wake refused: reviewer '${reviewer.instanceId}' has no live child session (no Leader fallback)`);
        }
        // MERGE: only legs this SAME facts port proves delegable to the SAME
        // reviewer join the wake. A leg with no case identity, a refused fact,
        // a fixed Leader/Human category or a different reviewer is left out.
        const merged = ports.readRequests !== undefined && ports.reviewFacts !== undefined
            ? await collectAlpha6DelegableLegs({
                rootSessionId: request.rootSessionId,
                reviewerInstanceId: reviewer.instanceId,
                seed: request,
                readRequests: ports.readRequests,
                reviewFacts: ports.reviewFacts,
                resolveCurrentReviewer: ports.resolveCurrentReviewer,
                ...(ports.route === undefined ? {} : { route: ports.route }),
            })
            : [request];
        const mergedIds = merged.map((entry) => entry.requestId).sort();
        if (ports.dispatchWake !== undefined) {
            await ports.dispatchWake({
                rootSessionId: request.rootSessionId,
                reviewerInstanceId: reviewer.instanceId,
                targetSessionId,
                currentLegIds: mergedIds,
            });
            return;
        }
        if (merged.length === 1) {
            await ports.deliver(request.rootSessionId, {
                targetSessionId,
                wakeId: `review:${request.requestId}`,
                text: renderOfficerReviewWake(request),
            });
            return;
        }
        await ports.deliver(request.rootSessionId, {
            targetSessionId,
            wakeId: `review:${mergedIds.join(',')}`,
            text: renderMergedOfficerReviewWake(merged),
        });
    }
}
/** One wake for a group of delegable pending legs; every id stays visible. */
export function renderMergedOfficerReviewWake(requests) {
    const ids = requests.map((request) => request.requestId).sort();
    return [
        `[team-review-wake requests=${ids.length}]`,
        'Team member operations are waiting for review.',
        '',
        ...ids.map((id) => `requestId: ${id}`),
        '',
        'Decide each with `team_resolve_control` using that EXACT requestId.',
        'Inspect your pending work with `team_list_pending_control`.',
    ].join('\n');
}
/**
 * The ONE trusted pending-leg collector used by the notifier and by the Host
 * turn-end rescan. Every candidate is filtered by the same facts port and the
 * same reviewer resolution; nothing here decides authority.
 */
export async function collectAlpha6DelegableLegs(input) {
    const merged = input.seed === undefined ? [] : [input.seed];
    let pending;
    try {
        pending = await input.readRequests(input.rootSessionId);
    }
    catch {
        pending = [];
    }
    for (const candidate of pending) {
        if (candidate.requestId === input.seed?.requestId)
            continue;
        if (candidate.status !== 'pending')
            continue;
        if (candidate.kind !== 'leader-approval')
            continue;
        if (candidate.approvalCaseId === undefined || candidate.legOrdinal === undefined)
            continue;
        if (candidate.legOrdinal < 1 || candidate.reviewAuthority === undefined)
            continue;
        if (input.route !== undefined) {
            const route = await input.route(candidate.requestId, input.rootSessionId);
            if (route === null ||
                route.kind !== 'recipient' ||
                route.target.kind !== 'instance' ||
                route.target.routeRole !== 'officer' ||
                route.target.instanceId !== input.reviewerInstanceId)
                continue;
            merged.push(candidate);
            continue;
        }
        let facts;
        try {
            facts = await input.reviewFacts({
                rootSessionId: input.rootSessionId,
                approvalCaseId: candidate.approvalCaseId,
                currentLegRequestId: candidate.requestId,
                legOrdinal: candidate.legOrdinal,
                kind: candidate.kind,
                reviewAuthority: candidate.reviewAuthority,
            });
        }
        catch {
            continue;
        }
        if (facts === null || facts.requiresHuman || facts.fixedLeaderOrHumanCategory)
            continue;
        const candidateReviewer = await input.resolveCurrentReviewer({
            rootSessionId: input.rootSessionId,
            approvalCaseId: candidate.approvalCaseId,
            currentLegRequestId: candidate.requestId,
            legOrdinal: candidate.legOrdinal,
        });
        if (candidateReviewer?.instanceId !== input.reviewerInstanceId)
            continue;
        merged.push(candidate);
    }
    return merged;
}
//# sourceMappingURL=notifier.js.map