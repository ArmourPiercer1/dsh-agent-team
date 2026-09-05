/**
 * Closed state vocabularies of the projection DTO family (P8-T1).
 *
 * Each vocabulary is a FROZEN closed set: the constants are `as const`
 * objects (or fixed arrays), the values are the exact wire strings, and the
 * guards are membership checks. Producers must never invent a value outside
 * the set; consumers may branch on the full set.
 *
 * Authorities (frozen 20260829 plan docs):
 *
 * - admission states: Architecture §28 (the four frozen admission states of
 *   the TeamSession admission gate, surfaced on the projection root);
 * - residency states: UI §24 (the three frozen agent-residency states of the
 *   live overlay);
 * - template kinds: Architecture §6.1 (exactly one LeaderTemplate per
 *   blueprint, invariant 13; MemberTemplate, invariant 17);
 * - context policies: Architecture §11 / invariant 29 (frozen at instance
 *   creation: `persistent` | `fresh_per_delegation`);
 * - progress values: the closed P6-T2 admission progress set, mirrored as
 *   the durable activity status (no invented vocabulary);
 * - ledger categories: UI §27.4 (the eight frozen filter categories of the
 *   TeamLedger view; the projection carries the summary only, never the
 *   entries).
 *
 * The MemberInstance lifecycle vocabulary (CREATED | RUNNING | SETTLED |
 * ARCHIVED | DISPOSED, Architecture §29) is NOT re-declared here: it is the
 * P3-T1 frozen `MemberLifecycleState`, re-exported by the family barrel.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/states
 */
/** The four frozen admission states of a TeamSession (Architecture §28). */
export declare const ADMISSION_STATES: {
    /** All admission checks pass; work may be admitted (§28). */
    readonly OPEN: "OPEN";
    /** Warnings present; admission allowed, warnings surfaced to the human (§28). */
    readonly BLOCKED_WARNING: "BLOCKED_WARNING";
    /** A fatal check failed; admission blocked until resolved (§28). */
    readonly BLOCKED_FATAL: "BLOCKED_FATAL";
    /** Degraded operation after an explicit human acknowledgement (§28). */
    readonly DEGRADED_ACKNOWLEDGED: "DEGRADED_ACKNOWLEDGED";
};
/** The frozen admission state type. */
export type AdmissionState = (typeof ADMISSION_STATES)[keyof typeof ADMISSION_STATES];
/** Every admission state value, for membership checks. */
export declare const ADMISSION_STATE_VALUES: readonly string[];
/** Is `value` one of the four frozen admission states? */
export declare function isAdmissionState(value: unknown): value is AdmissionState;
/**
 * Parse an admission state field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen admission state.
 */
export declare function parseAdmissionStateField(raw: unknown, field: string): AdmissionState;
/** The three frozen agent-residency states of the live overlay (UI §24). */
export declare const RESIDENCY_STATES: {
    /** The agent runtime is resident in memory. */
    readonly resident: "resident";
    /** The agent runtime is not resident; state is durable and restorable. */
    readonly cold: "cold";
    /** A cold agent is being resumed. */
    readonly resuming: "resuming";
};
/** The frozen residency state type. */
export type ResidencyState = (typeof RESIDENCY_STATES)[keyof typeof RESIDENCY_STATES];
/** Every residency state value, for membership checks. */
export declare const RESIDENCY_STATE_VALUES: readonly string[];
/** Is `value` one of the three frozen residency states? */
export declare function isResidencyState(value: unknown): value is ResidencyState;
/**
 * Parse a residency state field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen residency state.
 */
export declare function parseResidencyStateField(raw: unknown, field: string): ResidencyState;
/** The two frozen template kinds of a TeamBlueprint (Architecture §6.1). */
export declare const TEMPLATE_KINDS: {
    /** The single LeaderTemplate of the blueprint (invariant 13). */
    readonly leader: "leader";
    /** A MemberTemplate producing 0..N MemberInstances (invariant 17). */
    readonly member: "member";
};
/** The frozen template kind type. */
export type TemplateKind = (typeof TEMPLATE_KINDS)[keyof typeof TEMPLATE_KINDS];
/** Every template kind value, for membership checks. */
export declare const TEMPLATE_KIND_VALUES: readonly string[];
/** Is `value` one of the two frozen template kinds? */
export declare function isTemplateKind(value: unknown): value is TemplateKind;
/**
 * Parse a template kind field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen template kind.
 */
export declare function parseTemplateKindField(raw: unknown, field: string): TemplateKind;
/** The two frozen context policies, frozen at instance creation (invariant 29). */
export declare const CONTEXT_POLICIES: {
    /** The member context persists across delegations. */
    readonly persistent: "persistent";
    /** Each delegation starts a fresh context. */
    readonly fresh_per_delegation: "fresh_per_delegation";
};
/** The frozen context policy type. */
export type ContextPolicy = (typeof CONTEXT_POLICIES)[keyof typeof CONTEXT_POLICIES];
/** Every context policy value, for membership checks. */
export declare const CONTEXT_POLICY_VALUES: readonly string[];
/** Is `value` one of the two frozen context policies? */
export declare function isContextPolicy(value: unknown): value is ContextPolicy;
/**
 * Parse a context policy field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen context policy.
 */
export declare function parseContextPolicyField(raw: unknown, field: string): ContextPolicy;
/**
 * The three frozen progress values of a member's current admitted work.
 * Mirrors the closed P6-T2 admission progress set exactly (no invented
 * vocabulary); used as the durable activity status.
 */
export declare const PROGRESS_VALUES: readonly ["in-progress", "completed", "blocked"];
/** The frozen progress value type. */
export type ProgressValue = (typeof PROGRESS_VALUES)[number];
/** Is `value` one of the three frozen progress values? */
export declare function isProgressValue(value: unknown): value is ProgressValue;
/**
 * Parse a progress value field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen progress value.
 */
export declare function parseProgressValueField(raw: unknown, field: string): ProgressValue;
/**
 * The eight frozen TeamLedger filter categories (UI §27.4). The projection
 * carries the per-category summary only (ledger.ts); the ledger entries
 * themselves are TeamDomain facts (invariant 41) and never projection fields.
 */
export declare const LEDGER_CATEGORIES: {
    /** Team-level lifecycle facts (creation, admission, handoff, archive). */
    readonly team: "team";
    /** Member lifecycle facts (creation, settle, archive, dispose). */
    readonly member: "member";
    /** Lifecycle transition entries. */
    readonly lifecycle: "lifecycle";
    /** Message routing entries. */
    readonly message: "message";
    /** Control request / decision entries. */
    readonly control: "control";
    /** Policy state and override entries (UI "Policy / Overrides" filter). */
    readonly policy: "policy";
    /** Compatibility probe / drift / acknowledgement entries. */
    readonly compatibility: "compatibility";
    /** Progress entries. */
    readonly progress: "progress";
};
/** The frozen ledger category type. */
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[keyof typeof LEDGER_CATEGORIES];
/** Every ledger category value, for membership checks. */
export declare const LEDGER_CATEGORY_VALUES: readonly string[];
/** Is `value` one of the eight frozen ledger categories? */
export declare function isLedgerCategory(value: unknown): value is LedgerCategory;
/**
 * Parse a ledger category field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen ledger category.
 */
export declare function parseLedgerCategoryField(raw: unknown, field: string): LedgerCategory;
//# sourceMappingURL=states.d.ts.map