/**
 * centre-config.ts — the row-config rules the CENTRE adds, kept out of host.ts so they can be
 * exercised without booting the host composition.
 *
 * WHY A SEPARATE MODULE (2026-11-22): the rule below was first written inline in
 * `validateTeamPluginConfig`, and there is no way to test it from source — host.ts pulls the remote
 * handler tree through `.js` specifiers that only exist after a build. A rule that can only be
 * verified by a full build is a rule that silently stops being verified when the build is broken
 * (which it was). The pure function here is the whole rule; host.ts only decides how to fail.
 *
 * @module packages/runtime/src/plugin/vnext/centre-config
 */
/** The subset of the row config these rules read. Deliberately structural, not `TeamPluginConfig`. */
export interface CentreConfigFacts {
    readonly centreStatePath?: unknown;
    readonly alpha6ReviewRouting?: unknown;
}
/**
 * R3 (round 35): a member whose row is CONFIGURED for the centre but gets no confined-provider realm
 * would otherwise run its native tools with no admission decision, no ledger line and no settlement
 * record — unmediated and unreported. That is not "an unwired controlled call is refused"; it is the
 * call being outside the centre.
 *
 * The rule is narrow ON PURPOSE: it fires only when the row asked for governance (`centreStatePath`) and
 * the member did not get a centre. A row that never configured the centre keeps its current behaviour, so
 * this cannot turn a wiring gap into a product-wide outage — but a row that DID ask can no longer be
 * silently unmediated.
 *
 * @param mountedRealm - whether a confined-provider realm was actually mounted for this member.
 * @returns the refusal message, or `undefined` when there is nothing to refuse.
 */
export declare function memberCentreUnwiredViolation(config: CentreConfigFacts | null | undefined, member: {
    readonly instanceId?: unknown;
    readonly mountedRealm: boolean;
}): string | undefined;
/**
 * The FIRST rule violation, or `undefined` when the centre-related config is coherent.
 *
 * R1 (external review 2026-11-22, C6/C7 deferral; settled round 55): Alpha.6 review routing decides
 * who may review whom. The earlier shape of this rule accepted the opt-in when `centreStatePath` was
 * present ("it records its decisions somewhere durable"). Round 55 measured what that bought: the
 * decisions are written by the Alpha.6 composition, NOT by the centre, and no centre call ever
 * receives a review-routing decision — so an enabled router is still a governance claim whose
 * adjudication sits outside the ONE admission authority. C6 is therefore EXPLICITLY UNAVAILABLE: the
 * code names the missing axis, and the row does not boot with a second review authority rather than
 * claiming a join the centre cannot make.
 *
 * The code lives in `host-surface-refusal.ts`, the ONE closed table for the capabilities with no
 * member I/O axis, so a config refusal and a recorded refusal can never name the same absence twice
 * with two different strings.
 */
export declare function centreConfigViolation(config: CentreConfigFacts | null | undefined): string | undefined;
//# sourceMappingURL=centre-config.d.ts.map