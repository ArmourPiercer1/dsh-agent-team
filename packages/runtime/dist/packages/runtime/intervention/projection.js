/**
 * Alpha.4 A4-PR3 — the Intervention PROJECTION surface (plan Task 3 lane C;
 * spec §14.1, §14.2, §16, §17.3, §18.3; ADR A1-17, A5-7, X8).
 *
 * Lane C's rule for this PR is that the projection is built **from Control
 * state only**. The Compatibility and GovernanceWarning sources keep their
 * adapter seam here ({@link InterventionSourceAdapter}) but ship unwired:
 * PR6 owns them together with the client's `INTERNAL_FACT_TYPES` mapping
 * (ADR A5-7), and the interim disclosure is recorded in
 * `intervention/index.ts` and the interface freeze — escalation and
 * abandonment rows render as generic Events until then.
 *
 * The authority boundary (spec §14.2) is enforced three ways, not asserted:
 *
 * 1. **Capability**: this module exports read functions only. It has no
 *    repository handle, no lock, and no write path; the durable write it
 *    would need to influence a decision is not reachable from here.
 * 2. **Immutability**: every item leaves {@link freezeItem} deep-frozen, so
 *    "editing a projected item to grant a review" is a `TypeError` in
 *    strict-mode ESM rather than a bug to review.
 * 3. **The edge pin + the behavioural proof**: ADR A1-17 forbids an import
 *    edge from the evaluator / authority kernel / Control service /
 *    operation guard into `intervention/**`, and
 *    `a4p3-intervention-projection.test.ts` proves both halves — the edge
 *    does not exist, and mutating (attempting to mutate) a projected item
 *    leaves the guard's verdict byte-identical.
 *
 * @module @dsh-agent-team/runtime/intervention
 */
import { deriveInterventionItems, deriveZeroLegAuthorityUnavailableItem } from './derivation.js';
/** Recursively freeze a projected value (see the module header, point 2). */
function deepFreeze(value) {
    if (value !== null && typeof value === 'object') {
        for (const inner of Object.values(value))
            deepFreeze(inner);
        return Object.freeze(value);
    }
    return value;
}
/**
 * The immutability boundary of the projection.
 *
 * @param item - a freshly derived item.
 * @returns the same item, deep-frozen.
 */
export function freezeItem(item) {
    return deepFreeze(item);
}
/**
 * Project one team's interventions.
 *
 * The Control slice reads open approval cases and derives one item per case;
 * the reader decides legality. A reader that throws is treated as
 * "no facts", never as "allow": the item then carries no legal actions
 * (spec §18.3 — the client may only use server-provided actions).
 *
 * @param input - the projection input.
 * @returns the frozen items, Control first then each adapter in order.
 */
export async function projectInterventions(input) {
    const summaries = await input.control.listOpenApprovalCases({
        rootSessionId: input.rootSessionId,
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
    });
    const caseStates = summaries.map((summary) => summary.state);
    const safeReader = input.reader === undefined
        ? undefined
        : (readerInput) => {
            try {
                return input.reader?.(readerInput);
            }
            catch {
                // An unreadable ceiling is NOT a permission grant, and it is not a
                // fact either (audit F6). The wrapper used to SYNTHESIZE a fact bag
                // here - `requiredAuthority` taken from the leg's own rung, which
                // nobody read - and the item then published an authority-looking
                // field plus a real-looking `deny`. Absence is the honest answer:
                // no `requiredAuthority` is published and no action is offered, and
                // `ceiling-undetermined` says why (spec 18.3, A5-2).
                return undefined;
            }
        };
    const control = (await deriveInterventionItems(caseStates, safeReader)).map(freezeItem);
    const rest = [];
    for (const adapter of input.adapters ?? []) {
        const items = await adapter.project({
            rootSessionId: input.rootSessionId,
            ...(input.subject !== undefined ? { subject: input.subject } : {}),
        });
        for (const item of items)
            rest.push(freezeItem(item));
    }
    return [...control, ...rest];
}
/**
 * Project a terminal, zero-REVIEW case (ADR A1-12) as one frozen informational
 * item. Kept separate from {@link projectInterventions} because such a case is
 * born DECIDED and therefore never appears in the open-case read (audit F2
 * gives it a leg row so the termination is durable; a decided row is not an
 * open one) — this is the seam PR4/PR5 call when a request terminates
 * synchronously and they hold the identity facts rather than a case read.
 *
 * @param input - the frozen identity facts of the terminated case.
 * @returns the frozen informational item.
 */
export function projectZeroLegTermination(input) {
    return freezeItem(deriveZeroLegAuthorityUnavailableItem(input));
}
/**
 * The PR6 fill of the PR3 adapter seam: map durable warnings to frozen
 * `warning`-kind items.
 *
 * The law the items carry (each pinned by `a4p6-intervention-aggregation.test.ts`):
 * - `responseBehavior` is ALWAYS `informational`: a warning never puts the
 *   Team in the state where a reviewer is expected to act (spec §15.0 — a
 *   non-blocking stage must never look like `wait-for-response`);
 * - `blockScope` is `null`: the warning never blocks work at runtime; only
 *   the START GATE (6.A, in the plugin layer) consults the verdict, and it
 *   blocks START, not work;
 * - `legalActions` is the WARNING plane only: `['acknowledge']` while the
 *   fingerprint is unacknowledged, `[]` after;
 * - `requiredAuthority` / `currentReviewAuthority` are NEVER published: an
 *   acknowledged warning is not a review, and rendering an authority field
 *   here would manufacture the authority-looking field spec §14.2 forbids;
 * - `observationCount`/timestamps fold the §15.4 dedup — repeat observations
 *   of the same fingerprint update them, they never mint a second item.
 */
export function createGovernanceWarningSourceAdapter(deps) {
    return {
        source: 'governance-warning',
        async project({ rootSessionId }) {
            const warnings = await deps.list(rootSessionId);
            return warnings.map((warning) => {
                const item = {
                    interventionId: warning.interventionId,
                    kind: 'warning',
                    responseBehavior: 'informational',
                    blockScope: null,
                    source: { kind: 'governance-warning', id: warning.warningId },
                    status: warning.acknowledged ? 'acknowledged' : 'open',
                    legalActions: warning.acknowledged ? [] : ['acknowledge'],
                    derivationReasons: warning.acknowledged
                        ? ['warning-acknowledged']
                        : ['warning-observed'],
                    fingerprint: warning.fingerprint,
                    createdAt: warning.firstObservedAt,
                    updatedAt: warning.acknowledged ? warning.acknowledgedAt : warning.lastObservedAt,
                    lastObservedAt: warning.lastObservedAt,
                    observationCount: warning.observationCount,
                };
                return item;
            });
        },
    };
}
//# sourceMappingURL=projection.js.map