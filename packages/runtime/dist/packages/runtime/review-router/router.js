/**
 * Alpha.6 PR1 — deterministic `ReviewRouter`.
 *
 * It reads one current leg and returns a recipient/hold/no-work/unroutable
 * decision. It never mutates a case, never writes a wake, never mints a
 * Grant and never calls ControlService. The pure boundary is deliberate:
 * PR2c supplies current-leg/transfer facts from the durable service, and PR4
 * delivers the resulting wake.
 *
 * @module @dsh-agent-team/runtime/review-router/router
 */
import { isDelegableOrdinaryToolAsk, isLeaderException } from './policy.js';
function leaderTarget(leader) {
    if (leader === null)
        return null;
    return { kind: 'instance', instanceId: leader.instanceId, templateId: leader.templateId, routeRole: 'leader' };
}
function hold(holdReason, reason, currentLegId) {
    return { kind: 'hold', holdReason, reason, ...(currentLegId === undefined ? {} : { currentLegId }) };
}
function recipient(target, reason, currentLegId) {
    return { kind: 'recipient', target, reason, ...(currentLegId === undefined ? {} : { currentLegId }) };
}
function officerTarget(policy, officer) {
    if (officer.status !== 'active')
        return null;
    if (officer.instanceId.length === 0 || officer.templateId.length === 0)
        return null;
    if (officer.templateId !== policy.officerTemplateId)
        return null;
    return { kind: 'instance', instanceId: officer.instanceId, templateId: officer.templateId, routeRole: 'officer' };
}
function routeUnavailable(policy, leader, legId, reason) {
    if (policy.whenOfficerUnavailable === 'hold')
        return hold('officer-availability-unconfirmed', reason, legId);
    const target = leaderTarget(leader);
    return target === null ? hold('leader-unavailable', reason, legId) : recipient(target, reason, legId);
}
function routeOfficerState(policy, officer, leader, legId) {
    switch (officer.status) {
        case 'active':
            if (officer.templateId !== policy.officerTemplateId) {
                return hold('config-invalid', `active Officer template '${officer.templateId}' does not match policy '${policy.officerTemplateId}'`, legId);
            }
            return null;
        case 'archived':
        case 'disposed': {
            if (officer.templateId !== undefined && officer.templateId !== policy.officerTemplateId) {
                return hold('config-invalid', `retired Officer template '${officer.templateId}' does not match policy '${policy.officerTemplateId}'`, legId);
            }
            if (!officer.hasAdmissionHistory) {
                return hold('officer-not-admitted', 'no durable admission history for the configured Officer', legId);
            }
            return routeUnavailable(policy, leader, legId, `Officer is ${officer.status}`);
        }
        case 'missing':
            return officer.hasAdmissionHistory
                ? routeUnavailable(policy, leader, legId, 'the admitted Officer row is missing')
                : hold('officer-not-admitted', 'the configured Officer was never admitted', legId);
        case 'ambiguous':
            return hold('officer-ambiguous', `${String(officer.activeCount)} active instances match the Officer template`, legId);
        case 'not-admitted':
            return hold('officer-not-admitted', 'the configured Officer was never admitted', legId);
        case 'unconfirmed':
            return hold('officer-availability-unconfirmed', `Officer availability is unconfirmed: ${officer.reason}`, legId);
    }
}
/**
 * Route exactly one current leg. Priority is the frozen design §3.2 order:
 * terminal/no-work -> human -> fixed Leader -> transfer -> self-ask -> Leader
 * exception -> unavailable/ambiguous officer -> ordinary delegation.
 */
export function routeReview(input) {
    const leg = input.currentLeg;
    if (leg === null || leg.status !== 'pending')
        return { kind: 'no-work' };
    const legId = leg.requestId;
    if (!leg.hasLegalResolver)
        return { kind: 'unroutable', reason: 'no legal resolver exists for this leg' };
    if (leg.requiresHuman)
        return recipient({ kind: 'native-human' }, 'the current leg requires Human authority', legId);
    if (leg.fixedLeaderCategory) {
        const target = leaderTarget(input.leader);
        return target === null
            ? hold('leader-unavailable', 'fixed Leader category has no trusted Leader instance', legId)
            : recipient(target, 'fixed Leader management/governance category', legId);
    }
    if (input.transfer !== null) {
        if (input.transfer.target === 'native-human') {
            return recipient({ kind: 'native-human' }, `current-leg transfer to Human by ${input.transfer.actor}`, legId);
        }
        const target = leaderTarget(input.leader);
        return target === null
            ? hold('leader-unavailable', 'current-leg transfer to Leader has no trusted Leader instance', legId)
            : recipient(target, `current-leg transfer to Leader by ${input.transfer.actor}`, legId);
    }
    const policy = input.policy;
    if (policy === null)
        return hold('config-invalid', 'reviewRouting is absent or disabled', legId);
    if (leg.operationOwnerTemplateId !== null && leg.operationOwnerTemplateId === policy.officerTemplateId) {
        const target = leaderTarget(input.leader);
        return target === null
            ? hold('leader-unavailable', 'Officer self-ask must route to Leader, but no Leader instance is available', legId)
            : recipient(target, 'actual OperationOwner is the Officer; self-ask routes to Leader', legId);
    }
    if (leg.ordinaryAsk !== null && isLeaderException(policy, leg.operationOwnerTemplateId, leg.ordinaryAsk.operationTool)) {
        const target = leaderTarget(input.leader);
        return target === null
            ? hold('leader-unavailable', 'Leader exception has no trusted Leader instance', legId)
            : recipient(target, 'trusted MemberTemplate × Tool Leader exception', legId);
    }
    const officerState = routeOfficerState(policy, input.currentOfficer, input.leader, legId);
    if (officerState !== null)
        return officerState;
    if (leg.ordinaryAsk !== null && isDelegableOrdinaryToolAsk(leg.ordinaryAsk)) {
        const target = officerTarget(policy, input.currentOfficer);
        return target === null
            ? hold('config-invalid', 'the unique Officer instance could not be resolved', legId)
            : recipient(target, 'closed ordinary tool ask delegated to the dedicated Officer', legId);
    }
    return { kind: 'unroutable', reason: 'current leg is not a delegable ordinary tool ask' };
}
//# sourceMappingURL=router.js.map