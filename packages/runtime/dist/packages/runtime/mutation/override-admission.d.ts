/**
 * P8-S4B — governance override admission: the backend authority that
 * WRITES the durable governance overrides the frozen policy layer re-reads
 * at every future Agent request boundary.
 *
 * Plan §18.1/§18.2 (mutation -> actual Agent closure): a Team durable
 * mutation is not projection state — the next real request must observe
 * it. This module is the sole Runtime/Team authority for creating
 * `GovernanceOverride` records (plan §20.3/§20.4: "Remote handlers must
 * call Runtime/Team service authority"; "Remote direct repository
 * mutation" is forbidden). It validates the acting authority, re-issues
 * the full slot value set (the frozen v1 one-record-per-slot ruling),
 * and persists through an injected store port; the storage layer remains
 * the final SHAPE arbiter (closed record, cross-field rules).
 *
 * Authority -> record mapping (§20.3/§20.4, Architecture §19.4/§19.5):
 *
 * - `leader`  -> `autonomy-overlay` with `origin: 'leader'`, team or
 *   instance scope;
 * - `member`  -> `autonomy-overlay` with `origin: 'member'`, INSTANCE
 *   scope targeting the member's OWN instance only (v1);
 * - `operator`-> `human-override` (never `origin`; the authenticated /
 *   host-known client principal channel), team or instance scope.
 *
 * Slot ruling (frozen `selectPolicyOverrides`, P8-S3): exactly ONE record
 * wins per policy slot — team-scope `autonomy-overlay` (templateOverlay),
 * instance-scope `autonomy-overlay` (instanceOverlay), `human-override`
 * (instance beats team at read time) — winner = highest `generation`,
 * ties -> lexicographically smallest `recordId`; multi-overlay composition
 * is owned by later governance work. Consequence: a cumulative mutation
 * must RE-ISSUE the full slot value set. Admission merges the current
 * slot winner's `values` with the requested cell changes and persists a
 * NEW record (new `recordId`, `generation = winner + 1`). The store key
 * carries no generation, so the same `recordId` can never be re-put:
 * every mutation needs a fresh identity.
 *
 * Cell semantics are NOT decided here: `values` are lossless JSON per
 * the storage contract; the frozen resolver fails closed on any value it
 * cannot interpret (P8-S3 stage-2 semantics). Admission validates only
 * the closed capability vocabulary and the `PolicyEntry` value shape.
 *
 * @module @dsh-agent-team/runtime/mutation/override-admission
 */
import { type PolicyEntry } from '../../domain/policy/src/index.js';
/** The closed governance override record kinds (storage contract). */
export type GovernanceOverrideKindView = 'autonomy-overlay' | 'human-override';
/** The closed governance override scopes (storage contract). */
export type GovernanceOverrideScopeView = 'team' | 'instance';
/** The closed autonomy-overlay origins (storage contract). */
export type OverlayOriginView = 'leader' | 'member';
/**
 * One persisted governance override as the admission layer reads it —
 * the storage record's field surface, with `values` kept opaque (the
 * storage contract admits any lossless-JSON record; semantic validation
 * belongs to the frozen policy domain at resolution time).
 */
export interface OverrideRecordView {
    /** The stable record identity (one recordId per slot per generation). */
    readonly recordId: string;
    /** autonomy-overlay vs explicit human-override. */
    readonly kind: GovernanceOverrideKindView;
    /** team-scope vs instance-scope (one slot each, plus the human slots). */
    readonly scope: GovernanceOverrideScopeView;
    /** The owning TeamSession. */
    readonly rootSessionId: string;
    /** Present exactly when scope is 'instance'. */
    readonly instanceId?: string;
    /** Present exactly when kind is 'autonomy-overlay'. */
    readonly origin?: OverlayOriginView;
    /** The full slot value set (capability -> PolicyEntry), lossless JSON. */
    readonly values: Record<string, unknown>;
    /** The slot generation; starts at 1 and increments per re-issue. */
    readonly generation: number;
    /** ISO-8601 write timestamp (injected clock). */
    readonly updatedAt: string;
}
/**
 * The async persistence port admission writes through. The real
 * `OverridesRepository` (team_domain store `overrides`) satisfies it via
 * its sync `list` + async `put` (the row wiring adapts); direct tests
 * inject an in-memory port. `put` re-parses the record through the
 * storage schema: identical bytes are idempotent, different bytes at the
 * same identity raise `RECORD_DUPLICATE` (problem `duplicate-override`).
 */
export interface OverrideStorePort {
    /** Every durable override of the TeamSession (any kind/scope). */
    list(rootSessionId: string): Promise<readonly OverrideRecordView[]>;
    /** Durably put one record (unknown input; storage re-validates). */
    put(record: unknown): Promise<unknown>;
}
/**
 * Who is acting — the §20.3/§20.4 authority channels. The remote / row
 * layer derives this from the authenticated principal (bound Session +
 * TeamDomain identity), never from request-payload claims.
 */
export type MutationAuthority = {
    readonly kind: 'leader';
} | {
    readonly kind: 'member';
    readonly instanceId: string;
} | {
    readonly kind: 'operator';
};
/** The identity of one policy slot (the merge / winner domain). */
export interface SlotIdentity {
    readonly kind: GovernanceOverrideKindView;
    readonly scope: GovernanceOverrideScopeView;
    readonly rootSessionId: string;
    /** Present exactly when scope is 'instance'. */
    readonly instanceId?: string;
}
/** AdmitGovernanceOverrideArgs — one requested durable override mutation. */
export interface AdmitGovernanceOverrideArgs {
    /** The acting authority (validated before anything else). */
    readonly authority: MutationAuthority;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /** The NEW record identity (clean id, <= 128 chars, no whitespace). */
    readonly recordId: string;
    /** The target scope. */
    readonly scope: GovernanceOverrideScopeView;
    /** Required exactly when scope is 'instance' (clean id). */
    readonly instanceId?: string;
    /**
     * The cell changes for this mutation: a non-empty partial map of
     * CAPABILITY_NAMES keys to a PolicyEntry ({kind:'allow',items:[...]}
     * or {kind:'deny'}). Unmentioned capabilities keep the slot winner's
     * current values (full slot re-issue).
     */
    readonly cells: Record<string, unknown>;
    /**
     * Optional optimistic-concurrency guard: the generation the caller
     * believes is the current slot winner. Mismatch (including a stale
     * 0 against an existing winner) -> OVERRIDE_GENERATION_CONFLICT.
     */
    readonly expectedGeneration?: number;
    /** The write clock (injected; ISO-8601 strings). */
    readonly now: () => string;
}
/** The admitted (persisted) override, as the backend truth. */
export interface AdmittedGovernanceOverride {
    readonly recordId: string;
    readonly kind: GovernanceOverrideKindView;
    readonly scope: GovernanceOverrideScopeView;
    readonly rootSessionId: string;
    readonly instanceId?: string;
    readonly origin?: OverlayOriginView;
    /** The FULL slot value set after this mutation (winner merged with cells). */
    readonly values: Record<string, PolicyEntry>;
    /** The new slot generation (winner + 1, or 1 for a fresh slot). */
    readonly generation: number;
    readonly updatedAt: string;
    /** The previous slot winner's recordId, or null when the slot was empty. */
    readonly supersededRecordId: string | null;
}
/**
 * Select the frozen slot winner: the record of the slot with the
 * HIGHEST generation; ties -> lexicographically smallest recordId.
 * Mirrors the frozen `selectPolicyOverrides` slot rule exactly.
 * @param overrides - every durable override of the TeamSession.
 * @param slot - the slot identity.
 * @returns the winning record, or null when the slot is empty.
 */
export declare function selectSlotWinner(overrides: readonly OverrideRecordView[], slot: SlotIdentity): OverrideRecordView | null;
/**
 * Admit one durable governance override mutation.
 *
 * Order: authority -> scope/identity shape -> closed cell vocabulary +
 * PolicyEntry shapes -> load durable state -> identity conflict ->
 * optimistic generation -> full slot re-issue (merge winner + cells) ->
 * persist through the store port.
 *
 * @param args - the mutation request (see {@link AdmitGovernanceOverrideArgs}).
 * @param store - the persistence port (team_domain overrides store).
 * @returns the admitted record view (full slot values, new generation).
 * @throws {@link MutationError} `UNAUTHORIZED_MUTATION` (authority/scope
 *   mismatch), `MALFORMED_MUTATION_INPUT` (bad id/scope/cell shapes),
 *   `OVERRIDE_IDENTITY_CONFLICT` (identity already occupied, including
 *   the storage `RECORD_DUPLICATE` race), `OVERRIDE_GENERATION_CONFLICT`
 *   (stale expectedGeneration).
 */
export declare function admitGovernanceOverride(args: AdmitGovernanceOverrideArgs, store: OverrideStorePort): Promise<AdmittedGovernanceOverride>;
//# sourceMappingURL=override-admission.d.ts.map