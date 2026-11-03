/**
 * Alpha.6 PR6 — the fail-closed opt-in gate (pure).
 *
 * Production wiring may enable Alpha.6 review routing ONLY when the resolved
 * Blueprint is v5, `reviewRouting.enabled` is true, and exactly ONE live
 * instance carries the Officer MemberTemplate. Every other combination keeps
 * the Alpha.5 behavior (the legacy Leader notifier and the unchanged role
 * table); zero/multiple Officers REFUSE activation rather than picking one.
 *
 * This module decides no approval and writes no state; it is the composition
 * precondition the Host wiring must call before swapping any notifier.
 *
 * @module @dsh-agent-team/runtime/alpha6/composition
 */
export const ALPHA6_COMPOSITION_MODES = ['legacy', 'alpha6'];
export const ALPHA6_COMPOSITION_REFUSALS = [
    'blueprint-not-v5',
    'routing-disabled',
    'officer-template-missing',
    'officer-instance-count',
];
/**
 * Decide the mode. `legacy` is always the safe answer; an Alpha.6 enablement
 * that cannot satisfy EVERY condition is refused and stays legacy.
 */
export function decideAlpha6Composition(input) {
    if (input.enabled !== true)
        return { mode: 'legacy', reason: 'disabled' };
    if (input.blueprintDocumentVersion !== 5)
        return { mode: 'legacy', refused: 'blueprint-not-v5' };
    const routing = input.reviewRouting;
    if (routing === undefined || routing.enabled !== true) {
        return { mode: 'legacy', refused: 'routing-disabled' };
    }
    if (routing.officerTemplateId.length === 0 || routing.officerTemplateId === input.leaderTemplateId) {
        return { mode: 'legacy', refused: 'officer-template-missing' };
    }
    const count = input.activeMemberTemplateIds.filter((templateId) => templateId === routing.officerTemplateId).length;
    if (count !== 1)
        return { mode: 'legacy', refused: 'officer-instance-count' };
    return {
        mode: 'alpha6',
        officerTemplateId: routing.officerTemplateId,
        officerInstanceCount: 1,
    };
}
//# sourceMappingURL=composition.js.map