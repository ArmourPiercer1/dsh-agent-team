/**
 * Alpha.6 PR6 — the fail-closed opt-in gate (pure).
 *
 * Production wiring may enable Alpha.6 review routing ONLY when the resolved
 * Blueprint is v5, `reviewRouting.enabled` is true, and exactly ONE live
 * instance carries the Officer MemberTemplate. `legacy` is reserved for a Team
 * that did not opt in; an explicit opt-in that cannot satisfy EVERY condition
 * is `refused` (fail closed), never a silent Leader fallback. Zero/multiple
 * Officers REFUSE activation rather than picking one.
 *
 * This module decides no approval and writes no state; it is the composition
 * precondition the Host wiring must call before swapping any notifier.
 *
 * @module @dsh-agent-team/runtime/alpha6/composition
 */
import { parseBlueprintV5 } from '../../domain/blueprint/src/blueprint-v5.js';
export const ALPHA6_COMPOSITION_MODES = ['legacy', 'alpha6', 'refused'];
export const ALPHA6_COMPOSITION_REFUSALS = [
    'blueprint-not-v5',
    'routing-disabled',
    'officer-template-missing',
    'officer-instance-count',
];
/**
 * Decide the mode. `legacy` is only for a Team that did not opt in; an explicit
 * Alpha.6 enablement that cannot satisfy EVERY condition is `refused`.
 */
export function decideAlpha6Composition(input) {
    if (input.enabled !== true)
        return { mode: 'legacy', reason: 'disabled' };
    if (input.blueprintDocumentVersion !== 5)
        return { mode: 'refused', refused: 'blueprint-not-v5' };
    const routing = input.reviewRouting;
    if (routing === undefined || routing.enabled !== true) {
        return { mode: 'refused', refused: 'routing-disabled' };
    }
    if (routing.officerTemplateId.length === 0 || routing.officerTemplateId === input.leaderTemplateId) {
        return { mode: 'refused', refused: 'officer-template-missing' };
    }
    const count = input.activeMemberTemplateIds.filter((templateId) => templateId === routing.officerTemplateId).length;
    if (count !== 1)
        return { mode: 'refused', refused: 'officer-instance-count' };
    return {
        mode: 'alpha6',
        officerTemplateId: routing.officerTemplateId,
        officerInstanceCount: 1,
    };
}
/**
 * Parse the bound Blueprint ONCE for every Alpha.6 consumer (router, control
 * facts port, dispatcher). A v4/invalid document is `null`, never a v5 default.
 * The caller must map `null` to `refused`, not to `legacy`.
 */
export function parseAlpha6Routing(source) {
    try {
        const blueprint = parseBlueprintV5(source);
        if (blueprint.reviewRouting === undefined)
            return null;
        return { blueprint, routing: blueprint.reviewRouting };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=composition.js.map