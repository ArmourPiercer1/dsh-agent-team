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
import type { ApprovalCaseSummary, ControlSubject } from '../control/types.js';
import type { InterventionItem, RequiredAuthorityReader } from './types.js';
import { deriveZeroLegAuthorityUnavailableItem } from './derivation.js';
/**
 * The narrow, structural slice of the Control plane the projection reads.
 *
 * Declared as a subset (not as `ControlService`) on purpose: the projection
 * must not gain the capability to write, and a structural subset is what
 * keeps that checkable at the type level. It is satisfied by the real
 * `ControlService` without the latter knowing about this module — the
 * dependency direction stays `intervention → control`, never the reverse
 * (ADR A1-17).
 */
export interface InterventionControlSource {
    /** The team's open approval cases (one item per CASE, not per leg). */
    listOpenApprovalCases(input: {
        readonly rootSessionId: string;
        readonly subject?: ControlSubject;
    }): Promise<readonly ApprovalCaseSummary[]>;
}
/**
 * The seam PR6 fills for the non-Control sources (spec §15, §16). Declared
 * now so PR3's projection signature does not change under PR6; PR3 never
 * calls one, and an empty adapter list is the shipped state.
 */
export interface InterventionSourceAdapter {
    /** A stable, human-readable adapter name for diagnostics. */
    readonly source: string;
    /** Derive this source's items for one team. Never writes anything. */
    project(input: {
        readonly rootSessionId: string;
        readonly subject?: ControlSubject;
    }): Promise<readonly InterventionItem[]>;
}
/**
 * The immutability boundary of the projection.
 *
 * @param item - a freshly derived item.
 * @returns the same item, deep-frozen.
 */
export declare function freezeItem(item: InterventionItem): InterventionItem;
/** Input of the team-wide projection. */
export interface ProjectInterventionsInput {
    readonly rootSessionId: string;
    /** The Control-plane source (the only source wired in A4-PR3). */
    readonly control: InterventionControlSource;
    /** Optional non-Control adapters; unwired until PR6. */
    readonly adapters?: readonly InterventionSourceAdapter[];
    /** Restrict the projection to one subject's items. */
    readonly subject?: ControlSubject;
    /** The injected required-authority reader (PR4 wires the governance one). */
    readonly reader?: RequiredAuthorityReader;
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
export declare function projectInterventions(input: ProjectInterventionsInput): Promise<readonly InterventionItem[]>;
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
export declare function projectZeroLegTermination(input: {
    readonly approvalCaseId: string;
    readonly requiredAuthority: Parameters<typeof deriveZeroLegAuthorityUnavailableItem>[0]['requiredAuthority'];
    readonly fingerprint?: string;
    readonly observedAt: string;
}): InterventionItem;
/**
 * The STRUCTURAL view of one durable warning the adapter projects (A4-PR6).
 *
 * Declared structurally — NOT imported from `governance-warning/**` — so the
 * intervention lane's import law survives its first production consumer: the
 * lane still imports no authority/writer module, and the caller (the plugin
 * assembly) adapts its snapshot type to this shape. Every field here is a
 * DIAGNOSTIC rendering input; none of it is authority (spec §14.2), and the
 * projection is still read-only in every direction.
 */
export interface InterventionWarningSourceView {
    readonly interventionId: string;
    readonly warningId: string;
    readonly kind: 'envelope-consistency';
    readonly fingerprint: string;
    readonly verdict: 'mismatch' | 'undetermined';
    readonly observationCount: number;
    readonly firstObservedAt: string;
    readonly lastObservedAt: string;
    readonly acknowledged: boolean;
    readonly acknowledgedAt?: string;
    readonly acknowledgedBy?: string;
}
/** The injected warning reader (the durable fold, supplied by the caller). */
export interface InterventionWarningSourceReader {
    list(rootSessionId: string): Promise<readonly InterventionWarningSourceView[]>;
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
export declare function createGovernanceWarningSourceAdapter(deps: InterventionWarningSourceReader): InterventionSourceAdapter;
//# sourceMappingURL=projection.d.ts.map