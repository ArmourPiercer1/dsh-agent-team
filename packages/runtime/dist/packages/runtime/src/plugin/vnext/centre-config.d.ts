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
    /** The durable wake-intent directory the latch requires (Alpha.6 opt-in only). */
    readonly alpha6WakeIntentPath?: unknown;
    /** The bound bootstrap Blueprint source (Alpha.6 reads its authored v5 routing policy). */
    readonly blueprintSource?: unknown;
}
/**
 * The Alpha.6 enablement PIECE codes (round 84). Every one is a REFUSAL code: a row is enabled only
 * when all three pieces are present, and a row that opts in without one is refused naming the exact
 * piece. They are deliberately NOT new members of the closed host-surface table: that table names
 * capabilities with no member I/O axis, and Alpha.6 no longer has that absence (the routing decision is
 * recorded as a delivery, and the Officer's calls are admitted by the centre). The `alpha6` TABLE code
 * stays the stable capability code every Alpha.6 row refusal carries (the recorded invocation-authority
 * fact and the recorded reason both start with it), and the piece code follows it in the same string so
 * a caller never has to parse prose to learn which piece was absent.
 */
export declare const ALPHA6_ENABLEMENT_PIECES: Readonly<{
    /** No authored v5 `reviewRouting` policy: there is no decision to take, so nothing can be routed. */
    readonly routing: "ADMISSION_ALPHA6_ROUTING_REQUIRED";
    /** No durable centre: the routing/delivery facts and their settlement would have nowhere to live. */
    readonly centre: "ADMISSION_ALPHA6_CENTRE_REQUIRED";
    /** No absolute durable wake-intent directory: the latch would silently degrade to memory-only. */
    readonly wakeIntentPath: "ADMISSION_ALPHA6_WAKE_INTENT_PATH_REQUIRED";
}>;
export type Alpha6EnablementPiece = (typeof ALPHA6_ENABLEMENT_PIECES)[keyof typeof ALPHA6_ENABLEMENT_PIECES];
/** One refused piece, as the gate names it (structural, so a caller can drive the gate directly). */
export interface Alpha6EnablementRefusal {
    readonly piece: Alpha6EnablementPiece;
    readonly reason: string;
}
/**
 * Is this row's authored Blueprint a v5 document carrying an ENABLED `reviewRouting` block?
 *
 * `false` for every other answer (absent source, a v3/v4 document, a malformed document, a v5 document
 * with no routing block, or a block with `enabled: false`): Alpha.6 has no implicit default, so a row
 * that names no policy is not routable. The parser is the domain's ONE v5 parser; a parse fault is a
 * refusal, never a pass.
 */
export declare function alpha6RoutingAuthored(blueprintSource: unknown): boolean;
/**
 * The Alpha.6 enablement rule (round 84): the row may run review routing exactly when the configured
 * pieces are COHERENT.
 *
 * WHY THE RULE CHANGED. Round 55 made the opt-in unconditionally unavailable because the routing
 * decision was taken outside the centre with no durable record (`ADM-99`). Round 84 removed that
 * absence by making the routed review an ordinary governed operation: the decision is a projection of
 * the centre's own durable control row through the ONE shared review policy, the wake is a DELIVERY
 * through the P6-T3 session-input mechanism (durable intent + confirmation facts, requirement gate,
 * machine attribution), and the Officer's approval/own tools are admitted by the centre under the
 * Officer's binding. What is still needed for that to be true is a configuration that can carry it, and
 * a row missing any piece would run a claim it cannot record — so each missing piece is refused by
 * name. Nothing here is an axis, a second authority or a default: `undefined` means "coherent", and
 * every other answer is a typed refusal.
 *
 * A row that never opts in is untouched (the first branch): Alpha.5 stays byte-identical.
 */
export declare function alpha6EnablementRefusal(config: CentreConfigFacts): Alpha6EnablementRefusal | undefined;
/**
 * The row's admission MODE, as a value the product can REPORT (owner ruling `docs/reviews/
 * 20261124-0151.txt` §Realmless, 2026-11-24: "没有启用 Team 治理的传统宿主运行模式可以继续使用 DSH 自身的
 * 权限模型，但必须明确标识为 ungoverned，不得报告成受 UTE 保护").
 *
 * `governed` is the row that asked the centre to be its ONE admission authority (`centreStatePath`).
 * `ungoverned` is the row that never asked: it keeps DSH's own permission model — and it must be
 * labelled as such wherever the product reports governance, because a run that never produced an
 * admission fact is not UTE-protected and writing no label would let a reader assume it was.
 *
 * This is a READ of the same configuration the refusal reads; it decides nothing and creates no
 * authority.
 */
export type MemberAdmissionMode = 'governed' | 'ungoverned';
/** The row's admission mode. Ask = `centreStatePath` was configured; nothing else is governance. */
export declare function memberAdmissionMode(config: CentreConfigFacts | null | undefined): MemberAdmissionMode;
/** One member's admission report: the mode AND whether UTE actually stands behind its calls. */
export interface MemberAdmissionReport {
    readonly mode: MemberAdmissionMode;
    /** true ONLY for a governed member whose confined-provider realm actually mounted the centre. */
    readonly uteProtected: boolean;
    /** Present for a governed member with no confined provider: the typed refusal to throw. */
    readonly refusal?: string;
}
/**
 * R3 (round 35) → OWNER RULING 20261124-0151 §Realmless = OPTION B (2026-11-24): a member whose row is
 * CONFIGURED for the centre but gets no confined-provider realm is REFUSED. An admission allow taken
 * against the compiled ceiling cannot claim the access bound when the provider that executes the call
 * is not itself bound by that ceiling — so the governed member fails closed instead of running
 * unmediated and unreported.
 *
 * ROUND 98 — THE RULE NOW RUNS AFTER THE MOUNT ATTEMPT, NOT BEFORE IT. The round-35 placement checked
 * only "the row declares no realm source"; a row that DID declare a source but whose provider compiled
 * no realm for this template (a v4 template outside `memberIoCeilings`) slipped past it and ran with no
 * centre. `memberAdmissionGate` is handed the MOUNT RESULT, so both roads to "no confined provider" are
 * the same refusal.
 *
 * @param member.mountedRealm - whether a confined-provider realm was actually mounted for this member.
 * @returns the report; `refusal` is present exactly when the member must be refused.
 */
export declare function memberAdmissionGate(config: CentreConfigFacts | null | undefined, member: {
    readonly instanceId?: unknown;
    readonly mountedRealm: boolean;
}): MemberAdmissionReport;
/**
 * The typed refusal for a governed member with no confined provider.
 *
 * KEPT AS `MEMBER_CENTRE_UNWIRED` (round 98 decision, justified in `OWNER-DECISIONS.md`): the ruling
 * allowed renaming it to `ADMISSION_PROVIDER_UNCONFINED`, but the string is the durable identifier
 * ADM-44, the D report and the escalation already use and it is NOT a member of the closed
 * `AdmissionRefusalCode`/`HOST_SURFACE_REFUSALS` tables. Renaming a refusal that every existing reader
 * recognises would buy wording, not enforcement — so the accurate semantics are stated in the message
 * ("asked for governance ... no confined-provider realm") and the stable code is kept.
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
 * adjudication sits outside the ONE admission authority. Round 55 therefore refused the opt-in on
 * every row.
 *
 * ROUND 84 — THE POSITIVE PATH, ON THE SAME LAW. The absence round 55 named is closed by making the
 * routed review an ordinary governed operation rather than by inventing an axis (see
 * `ALPHA6-FORMAL-ROUTING.md`): the routing decision is a projection of the centre's own durable control
 * row, the wake is a delivery through the P6-T3 session-input mechanism with durable intent +
 * confirmation facts, and the Officer's approval and own tool calls are admitted by the centre under
 * the Officer's binding. What remains is a CONFIGURATION question, and it is answered by
 * `alpha6EnablementRefusal` above: a coherent row is enabled, an incoherent one is refused naming the
 * missing piece. The refusal string still STARTS with the closed table's `alpha6` code, so the host
 * entry's recorder (`row-refusal-entry.ts`) still records every Alpha.6 row refusal with the same
 * capability, axis and subject it always used.
 */
export declare function centreConfigViolation(config: CentreConfigFacts | null | undefined): string | undefined;
//# sourceMappingURL=centre-config.d.ts.map