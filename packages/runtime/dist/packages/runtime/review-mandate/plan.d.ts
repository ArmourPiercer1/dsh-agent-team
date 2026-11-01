/**
 * Alpha.6 PR0 (Lane 2) — the CLOSED-WORLD parser of the trusted ReviewPlan.
 *
 * WHY A PARSER AND NOT A CAST. The ReviewPlan is the only input from which a
 * ReviewMandate may be derived (types.ts L-3), so whatever shape this accepts
 * IS the shape of delegated authority. The plan therefore goes through the
 * same law the governance-center applies to family contributions
 * (`governance-center/contribution-schema.ts`): every object is checked
 * key-by-key against a fixed key set at every nesting level, an unlisted key
 * is a REFUSAL and never a silent drop, and nothing about the accepted value
 * is defaulted in. A cast or a `Partial<>` with defaults would let a typo in
 * Host config widen a scope, which is precisely the failure this phase exists
 * to make unrepresentable.
 *
 * WHERE THE INPUT COMES FROM. Host-supplied plugin config
 * (`config.teamToolPlane.*`, the pass-through bag already carrying
 * `jobsEnabled` and `centerAssembly`), NOT the blueprint: the Blueprint v3
 * schema is frozen and Alpha.6 adds no field to it, so a Team opts in through
 * config only. That also fixes the trust level — config is written by the
 * operator at session bind time and is not reachable by a model tool call.
 * The wiring that reads it is Lane-plan PR-I2; this file only defines what a
 * legal plan is, so the two can be reviewed apart.
 *
 * WHAT A PARSED PLAN DOES NOT DO: it grants nothing on its own. Every field is
 * re-checked at call time by `mandate.ts` against the live epoch and the live
 * case fold, so a plan copy kept past its epoch or after revocation decides
 * nothing.
 *
 * @module review-mandate/plan
 */
import { type ReviewPlan, type ReviewPlanActionScope } from './types.js';
/** Closed failure codes for plan parsing. Stable strings: a parse failure is
 *  an operator-facing diagnostic and may be logged. */
export declare const REVIEW_PLAN_FAILURE_CODES: readonly ["PLAN_NOT_OBJECT", "UNKNOWN_FIELD", "MISSING_FIELD", "BAD_TYPE", "BAD_VALUE", "BAD_ID", "BAD_DIGEST", "EMPTY_LIST", "DUPLICATE_ACTION", "SCOPE_FORM_UNKNOWN", "SCOPE_NAMES_UNLISTED_ACTION", "RUNG_NOT_DELEGABLE", "REVIEWER_IS_LEADER_INSTANCE", "BAD_TIMESTAMP"];
export type ReviewPlanFailureCode = (typeof REVIEW_PLAN_FAILURE_CODES)[number];
/** A parse failure names the field it tripped on; `field === null` means the
 *  failure is about the whole document. */
export interface ReviewPlanFailure {
    readonly code: ReviewPlanFailureCode;
    readonly field: string | null;
    readonly detail: string;
}
export type ReviewPlanParseResult = {
    readonly ok: true;
    readonly plan: ReviewPlan;
} | {
    readonly ok: false;
    readonly failure: ReviewPlanFailure;
};
/** Was this exact plan object produced by {@link parseReviewPlan}? */
export declare function isParsedReviewPlan(plan: ReviewPlan): boolean;
/**
 * Parse one candidate ReviewPlan fail-closed. `raw` is whatever the Host put in
 * config: nothing is trusted, nothing is defaulted.
 */
export declare function parseReviewPlan(raw: unknown): ReviewPlanParseResult;
/**
 * The plan's own content digest: canonical JSON, sha256, 64 lowercase hex.
 * Logged and bound into grant facts so a reviewer decision can later be shown
 * to have been taken under THIS plan and no other. Content-addressed, so two
 * operators writing the same plan agree without coordinating an id.
 */
export declare function reviewPlanDigest(plan: ReviewPlan): string;
/** The plan's entry for one action, or undefined when the action is not delegated. */
export declare function planActionScope(plan: ReviewPlan, actionName: string): ReviewPlanActionScope | undefined;
/**
 * Does the plan delegate THIS fingerprint for THIS action? Exact-fingerprint
 * scopes match byte-for-byte; by-action-name scopes cover every fingerprint of
 * a listed action. There is no prefix and no wildcard form to fall back to
 * (`SCOPE_FORM_UNKNOWN` above refuses one at parse time).
 */
export declare function planCoversEffectScope(plan: ReviewPlan, actionName: string, effectScopeFingerprint: string): boolean;
//# sourceMappingURL=plan.d.ts.map