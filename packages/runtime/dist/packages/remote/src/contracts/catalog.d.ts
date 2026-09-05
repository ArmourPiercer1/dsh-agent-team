/**
 * The CLOSED method catalog of the Remote contract v1.
 *
 * Development Plan §21.3 freezes the API CATEGORY SET (the separation is
 * fixed; the exact method names were chosen here and are now frozen for
 * contract v1):
 *
 *   catalog, intent, team, member, override, policyState,
 *   compatibility, handoff, legacy
 *
 * 9 categories, 23 methods. Adding a method or category is a remote
 * contract change (a version bump), never a silent edit — the catalog is
 * the closed surface a client may call through the seam channel
 * `/team-remote` (one dotted method name per endpoint; see
 * `handlers/register.ts`).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/catalog
 */
/** The closed Remote contract v1 categories (DevPlan §21.3 — fixed). */
export declare const REMOTE_CATEGORIES: {
    /** Read access to the blueprint catalog (pre-creation discovery). */
    readonly CATALOG: "catalog";
    /** Pre-creation compatibility probing (Architecture §7 TeamIntent flow). */
    readonly INTENT: "intent";
    /** TeamSession lifecycle + observation (create / projection / ledger). */
    readonly TEAM: "team";
    /** MemberInstance operations (create / send / follow-up / lifecycle). */
    readonly MEMBER: "member";
    /** Autonomy overlays and explicit human overrides (Architecture §19.4/§19.5). */
    readonly OVERRIDE: "override";
    /** The TeamSession PolicyState (Architecture §20; invariant 40). */
    readonly POLICY_STATE: "policyState";
    /** Durable environment-compatibility state (Architecture §27/§28). */
    readonly COMPATIBILITY: "compatibility";
    /** Start-a-team-from-here handoff (Architecture §34). */
    readonly HANDOFF: "handoff";
    /** Read-only legacy Team inspection (DevPlan §20.6 degradation). */
    readonly LEGACY: "legacy";
};
/** One of the closed Remote contract v1 categories. */
export type RemoteCategory = (typeof REMOTE_CATEGORIES)[keyof typeof REMOTE_CATEGORIES];
/** Every category value, in declaration order. */
export declare const REMOTE_CATEGORY_VALUES: readonly RemoteCategory[];
/** One catalog entry: the category a method belongs to (closed). */
export interface RemoteMethodSpec {
    readonly category: RemoteCategory;
}
/**
 * The closed Remote contract method catalog — a VERSIONED UNION
 * (TCM vNext §15.3): the 23 frozen v1 methods plus the v2-only
 * `team.admitInitialWork` (24 methods total). Key = endpoint = method
 * name (dotted: `<category>.<action>`). Per-version availability is the
 * closed {@link REMOTE_V2_ONLY_METHODS} set below; per-method param
 * schemas are version-aware in `params.ts`.
 */
export declare const REMOTE_METHOD_CATALOG: Readonly<Record<string, RemoteMethodSpec>>;
/** Every method name, in deterministic (sorted) order. */
export declare const REMOTE_METHOD_NAMES: readonly string[];
export declare const REMOTE_METHODS_BY_CATEGORY: Readonly<Record<RemoteCategory, readonly string[]>>;
/**
 * Is `name` a method of the closed (versioned-union) catalog?
 * @param name - the candidate endpoint / method name.
 */
export declare function isRemoteMethod(name: unknown): name is string;
/**
 * The closed set of catalog methods that exist ONLY in remote contract v2
 * (TCM vNext §15.6: the v2 bump adds exactly one method,
 * `team.admitInitialWork`; every v1 method stays available in v2).
 */
export declare const REMOTE_V2_ONLY_METHODS: readonly string[];
/**
 * Is `method` a catalog method available in remote contract `version`?
 *
 * This is the version-aware membership check the version-aware param
 * parser uses (TCM vNext §15.3): a v1 request to a v2-only method is a
 * typed rejection (`method-version-unsupported`) AFTER the envelope
 * parse — the endpoint itself passes the pre-envelope closed-catalog
 * check, so the version can only be consulted once the envelope is
 * known.
 *
 * @param method - the candidate method name (must be in the catalog).
 * @param version - the request's contract version (supported: 1 | 2).
 */
export declare function isRemoteMethodAvailableInVersion(method: string, version: number): boolean;
/**
 * The category of a catalog method.
 * @param method - a method name known to be in the catalog.
 * @returns the owning category.
 */
export declare function remoteCategoryOf(method: string): RemoteCategory;
//# sourceMappingURL=catalog.d.ts.map