/**
 * `OperationGrant` — the single-use authorization of ONE operation
 * (design §4.2: Member + call identity + parameter Fingerprint + Binding
 * revision + authority generation + effects + one-shot + optional expiry).
 *
 * WHAT THIS IS NOT (design §4.2, verbatim intent): "Grant 不能做为模型可持有
 * 的重放 Bearer" — a grant is not a bearer token, is not model-visible, and is
 * not renewable. It is not a second ApprovalCase and creates no standing
 * permission (plan §0.4 / §3): PR0 carries NO persistence; consumption lives
 * in PR2's durable ledger, which reaches this pure validation only as an
 * immutable read-only VIEW ({@link GrantConsumptionLedgerView}).
 *
 * The checks below are the ones the PR2 kernel will need, stated once, in the
 * domain layer, so no lane re-spells them with different precedence.
 *
 * Purity: no `node:*`, no I/O, no clock (`now` is injected per call).
 *
 * @module @dsh-agent-team/domain/tool-governance/grant
 */
import { type RequestedEffectSet } from './effects.js';
import { type ParseResult } from './parse-util.js';
/** A Member identity as the domain states it (contracts brands erased). */
export interface MemberRef {
    readonly teamSessionId: string;
    readonly instanceId: string;
}
/** The single-use operation grant (deep-frozen by the parser). */
export interface OperationGrant {
    readonly grantId: string;
    readonly member: MemberRef;
    readonly callId: string;
    readonly realmId: string;
    readonly bindingId: string;
    readonly bindingRevision: number;
    readonly authorityGeneration: number;
    readonly parametersFingerprint: string;
    readonly effects: RequestedEffectSet;
    /** Type-level AND runtime-level literal `true` — renewal is unrepresentable. */
    readonly singleUse: true;
    readonly issuedAt: number;
    /** `null` means NO expiry — never an expiry at zero. */
    readonly expiresAt: number | null;
}
/** The immutable consumption view PR2's ledger presents to this validation. */
export interface GrantConsumptionLedgerView {
    readonly isConsumed: (grantId: string) => boolean;
}
/** The closed refusal reasons of one grant validation. */
export declare const GRANT_REFUSAL_REASONS: readonly ["member-mismatch", "call-identity-mismatch", "realm-mismatch", "authority-generation-stale", "binding-revision-mismatch", "parameters-fingerprint-mismatch", "effect-outside-grant", "grant-expired", "grant-consumed"];
/** One grant refusal reason. */
export type GrantRefusalReason = (typeof GRANT_REFUSAL_REASONS)[number];
/** Which §5 error code a refusal surfaces (the mapping is frozen in PR0). */
export declare function grantRefusalErrorCode(reason: GrantRefusalReason): string;
/** One validated call against one grant. */
export interface GrantCallContext {
    /** Injected wall clock (the module owns no clock). */
    readonly now: number;
    readonly currentAuthorityGeneration: number;
    readonly member: MemberRef;
    readonly callId: string;
    readonly realmId: string;
    readonly bindingId: string;
    readonly bindingRevision: number;
    readonly parametersFingerprint: string;
    readonly requestedEffects: RequestedEffectSet;
}
/** A grant validation outcome. */
export type GrantValidation = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly reason: GrantRefusalReason;
};
/**
 * Validate a grant for ONE call. Deterministic precedence (stated, so every
 * consumer distinguishes the same way): identity → realm → generation →
 * binding revision → parameter fingerprint → effect containment (realm of
 * each effect resource first, subset second) → expiry → consumption LAST
 * (a stale or wrong call is stale/wrong even after consumption).
 */
export declare function validateGrantForCall(grant: OperationGrant, call: GrantCallContext, ledger: GrantConsumptionLedgerView): GrantValidation;
/** Strictly parse one raw operation grant. */
export declare function parseOperationGrant(raw: unknown): ParseResult<OperationGrant>;
//# sourceMappingURL=grant.d.ts.map