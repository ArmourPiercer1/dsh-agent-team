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
export const REMOTE_CATEGORIES = {
  /** Read access to the blueprint catalog (pre-creation discovery). */
  CATALOG: 'catalog',
  /** Pre-creation compatibility probing (Architecture §7 TeamIntent flow). */
  INTENT: 'intent',
  /** TeamSession lifecycle + observation (create / projection / ledger). */
  TEAM: 'team',
  /** MemberInstance operations (create / send / follow-up / lifecycle). */
  MEMBER: 'member',
  /** Autonomy overlays and explicit human overrides (Architecture §19.4/§19.5). */
  OVERRIDE: 'override',
  /** The TeamSession PolicyState (Architecture §20; invariant 40). */
  POLICY_STATE: 'policyState',
  /** Durable environment-compatibility state (Architecture §27/§28). */
  COMPATIBILITY: 'compatibility',
  /** Start-a-team-from-here handoff (Architecture §34). */
  HANDOFF: 'handoff',
  /** Read-only legacy Team inspection (DevPlan §20.6 degradation). */
  LEGACY: 'legacy',
} as const

/** One of the closed Remote contract v1 categories. */
export type RemoteCategory = (typeof REMOTE_CATEGORIES)[keyof typeof REMOTE_CATEGORIES]

/** Every category value, in declaration order. */
export const REMOTE_CATEGORY_VALUES: readonly RemoteCategory[] = Object.freeze(
  Object.values(REMOTE_CATEGORIES),
)

/** One catalog entry: the category a method belongs to (closed). */
export interface RemoteMethodSpec {
  readonly category: RemoteCategory
}

/**
 * The closed Remote contract method catalog — a VERSIONED UNION
 * (TCM vNext §15.3): the 23 frozen v1 methods plus the v2-only
 * `team.admitInitialWork` (24 methods total). Key = endpoint = method
 * name (dotted: `<category>.<action>`). Per-version availability is the
 * closed {@link REMOTE_V2_ONLY_METHODS} set below; per-method param
 * schemas are version-aware in `params.ts`.
 */
export const REMOTE_METHOD_CATALOG: Readonly<Record<string, RemoteMethodSpec>> = {
  'catalog.list': { category: REMOTE_CATEGORIES.CATALOG },
  'catalog.get': { category: REMOTE_CATEGORIES.CATALOG },
  'intent.probe': { category: REMOTE_CATEGORIES.INTENT },
  'team.create': { category: REMOTE_CATEGORIES.TEAM },
  'team.getProjection': { category: REMOTE_CATEGORIES.TEAM },
  'team.getLedgerPage': { category: REMOTE_CATEGORIES.TEAM },
  'team.admitInitialWork': { category: REMOTE_CATEGORIES.TEAM },
  'member.create': { category: REMOTE_CATEGORIES.MEMBER },
  'member.send': { category: REMOTE_CATEGORIES.MEMBER },
  'member.followup': { category: REMOTE_CATEGORIES.MEMBER },
  'member.archive': { category: REMOTE_CATEGORIES.MEMBER },
  'member.restore': { category: REMOTE_CATEGORIES.MEMBER },
  'member.dispose': { category: REMOTE_CATEGORIES.MEMBER },
  'override.get': { category: REMOTE_CATEGORIES.OVERRIDE },
  'override.set': { category: REMOTE_CATEGORIES.OVERRIDE },
  'override.reset': { category: REMOTE_CATEGORIES.OVERRIDE },
  'policyState.get': { category: REMOTE_CATEGORIES.POLICY_STATE },
  'policyState.set': { category: REMOTE_CATEGORIES.POLICY_STATE },
  'compatibility.get': { category: REMOTE_CATEGORIES.COMPATIBILITY },
  'compatibility.ack': { category: REMOTE_CATEGORIES.COMPATIBILITY },
  'compatibility.reprobe': { category: REMOTE_CATEGORIES.COMPATIBILITY },
  'handoff.prepare': { category: REMOTE_CATEGORIES.HANDOFF },
  'handoff.create': { category: REMOTE_CATEGORIES.HANDOFF },
  'legacy.inspect': { category: REMOTE_CATEGORIES.LEGACY },
} as const

/** Every method name, in deterministic (sorted) order. */
export const REMOTE_METHOD_NAMES: readonly string[] = Object.freeze(
  Object.keys(REMOTE_METHOD_CATALOG).sort(),
)

/**
 * Per-category method lists (deterministic, sorted), for catalog reporting
 * and test assertions.
 */
function methodsForCategory(category: RemoteCategory): readonly string[] {
  return REMOTE_METHOD_NAMES.filter((name) => REMOTE_METHOD_CATALOG[name]?.category === category)
}

export const REMOTE_METHODS_BY_CATEGORY: Readonly<Record<RemoteCategory, readonly string[]>> =
  Object.freeze({
    catalog: methodsForCategory(REMOTE_CATEGORIES.CATALOG),
    intent: methodsForCategory(REMOTE_CATEGORIES.INTENT),
    team: methodsForCategory(REMOTE_CATEGORIES.TEAM),
    member: methodsForCategory(REMOTE_CATEGORIES.MEMBER),
    override: methodsForCategory(REMOTE_CATEGORIES.OVERRIDE),
    policyState: methodsForCategory(REMOTE_CATEGORIES.POLICY_STATE),
    compatibility: methodsForCategory(REMOTE_CATEGORIES.COMPATIBILITY),
    handoff: methodsForCategory(REMOTE_CATEGORIES.HANDOFF),
    legacy: methodsForCategory(REMOTE_CATEGORIES.LEGACY),
  })

/**
 * Is `name` a method of the closed (versioned-union) catalog?
 * @param name - the candidate endpoint / method name.
 */
export function isRemoteMethod(name: unknown): name is string {
  return typeof name === 'string' && name in REMOTE_METHOD_CATALOG
}

/**
 * The closed set of catalog methods that exist ONLY in remote contract v2
 * (TCM vNext §15.6: the v2 bump adds exactly one method,
 * `team.admitInitialWork`; every v1 method stays available in v2).
 */
export const REMOTE_V2_ONLY_METHODS: readonly string[] = ['team.admitInitialWork']

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
export function isRemoteMethodAvailableInVersion(method: string, version: number): boolean {
  if (!(method in REMOTE_METHOD_CATALOG)) return false
  if (version === 1) {
    return !REMOTE_V2_ONLY_METHODS.includes(method)
  }
  // version === 2: every v1 method plus the v2-only methods.
  return true
}

/**
 * The category of a catalog method.
 * @param method - a method name known to be in the catalog.
 * @returns the owning category.
 */
export function remoteCategoryOf(method: string): RemoteCategory {
  const spec = REMOTE_METHOD_CATALOG[method]
  if (spec === undefined) {
    throw new TypeError(`remote catalog: unknown method '${method}'`)
  }
  return spec.category
}
