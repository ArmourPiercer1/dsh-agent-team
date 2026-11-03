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
export declare const ALPHA6_COMPOSITION_MODES: readonly ["legacy", "alpha6"];
export type Alpha6CompositionMode = (typeof ALPHA6_COMPOSITION_MODES)[number];
export declare const ALPHA6_COMPOSITION_REFUSALS: readonly ["blueprint-not-v5", "routing-disabled", "officer-template-missing", "officer-instance-count"];
export type Alpha6CompositionRefusal = (typeof ALPHA6_COMPOSITION_REFUSALS)[number];
export interface Alpha6CompositionInput {
    /** The explicit Host/Team opt-in. Absent or false keeps Alpha.5 byte-identical. */
    readonly enabled: boolean;
    readonly blueprintDocumentVersion: number;
    readonly reviewRouting?: {
        readonly enabled: boolean;
        readonly officerTemplateId: string;
    };
    /** Live instance template ids (the caller reads the durable instance view). */
    readonly activeMemberTemplateIds: readonly string[];
    /** The Leader template id, refused as an Officer even if a row says so. */
    readonly leaderTemplateId: string;
}
export type Alpha6CompositionDecision = {
    readonly mode: 'legacy';
    readonly reason: 'disabled';
} | {
    readonly mode: 'alpha6';
    readonly officerTemplateId: string;
    readonly officerInstanceCount: 1;
} | {
    readonly mode: 'legacy';
    readonly refused: Alpha6CompositionRefusal;
};
/**
 * Decide the mode. `legacy` is always the safe answer; an Alpha.6 enablement
 * that cannot satisfy EVERY condition is refused and stays legacy.
 */
export declare function decideAlpha6Composition(input: Alpha6CompositionInput): Alpha6CompositionDecision;
//# sourceMappingURL=composition.d.ts.map