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
 * 9 categories. Adding a method or category is a remote
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
  /** A4-PR6 v8: the intervention plane — approval cases and governance
   *  warnings as ONE work surface (spec §14–§16); the category exists
   *  because the methods are cross-cutting (they are not Team lifecycle,
   *  not Member operations, and not an override mutation). */
  INTERVENTION: 'intervention',
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
 * (TCM vNext §15.3, extended by the Team D1-D6 repair v2 D1 v3 bump,
 * the F3/F11/F9/T1.4 repair round r1 F9 v4 bump, the C1
 * restart-0.1.7-rc.1 recovery v5 bump — guide §10.2, and the
 * team-view-sync-complete v6 bump): the 23 frozen v1 methods plus the
 * v2-only `team.admitInitialWork` plus the v3-only `team.listRoots` /
 * `team.ensureRootLive` plus the v4-only `team.resolveControl` plus the
 * v5-only `team.prepareOrdinaryOpen` plus the v6-only
 * `team.getReadState` plus the v7-only `override.mutatePermission` and
 * `override.getPermission` (31 methods total; PR4 round 5 + PR5 read lane).
 * Key = endpoint = method name
 * (dotted: `<category>.<action>`). Per-version availability is the
 * closed {@link REMOTE_V2_ONLY_METHODS} + {@link REMOTE_V3_ONLY_METHODS}
 * + {@link REMOTE_V4_ONLY_METHODS} + {@link REMOTE_V5_ONLY_METHODS} +
 * {@link REMOTE_V6_ONLY_METHODS} sets below; per-method param schemas
 * are version-aware in `params.ts`.
 */
export const REMOTE_METHOD_CATALOG: Readonly<Record<string, RemoteMethodSpec>> = {
  'catalog.list': { category: REMOTE_CATEGORIES.CATALOG },
  'catalog.get': { category: REMOTE_CATEGORIES.CATALOG },
  'intent.probe': { category: REMOTE_CATEGORIES.INTENT },
  'team.create': { category: REMOTE_CATEGORIES.TEAM },
  'team.getProjection': { category: REMOTE_CATEGORIES.TEAM },
  'team.getLedgerPage': { category: REMOTE_CATEGORIES.TEAM },
  'team.admitInitialWork': { category: REMOTE_CATEGORIES.TEAM },
  'team.listRoots': { category: REMOTE_CATEGORIES.TEAM },
  'team.ensureRootLive': { category: REMOTE_CATEGORIES.TEAM },
  'team.resolveControl': { category: REMOTE_CATEGORIES.TEAM },
  'team.prepareOrdinaryOpen': { category: REMOTE_CATEGORIES.TEAM },
  'team.getReadState': { category: REMOTE_CATEGORIES.TEAM },
  'member.create': { category: REMOTE_CATEGORIES.MEMBER },
  'member.send': { category: REMOTE_CATEGORIES.MEMBER },
  'member.followup': { category: REMOTE_CATEGORIES.MEMBER },
  'member.archive': { category: REMOTE_CATEGORIES.MEMBER },
  'member.restore': { category: REMOTE_CATEGORIES.MEMBER },
  'member.dispose': { category: REMOTE_CATEGORIES.MEMBER },
  'override.get': { category: REMOTE_CATEGORIES.OVERRIDE },
  'override.set': { category: REMOTE_CATEGORIES.OVERRIDE },
  'override.reset': { category: REMOTE_CATEGORIES.OVERRIDE },
  // pre-alpha3 PR4 ROUND 5 (FIX-2b): the human/operator permission mutation
  // lane (the durable permission overlay's grant/revoke through the ONE
  // governance mutation authority; v7-only, closed field set in params.ts).
  'override.mutatePermission': { category: REMOTE_CATEGORIES.OVERRIDE },
  // alpha.3 PR5 (ROOT BLOCK-1): the READ half of the same permission lane —
  // the durable overlay's CURRENT authority + AUDIT history for one exact
  // (team, member) pair through the append-narrowed read projection (v7
  // co-tenancy with its write pair; closed field set in params.ts; a pure
  // read — never consulted by execution/authorization, ADR §9).
  'override.getPermission': { category: REMOTE_CATEGORIES.OVERRIDE },
  'policyState.get': { category: REMOTE_CATEGORIES.POLICY_STATE },
  'policyState.set': { category: REMOTE_CATEGORIES.POLICY_STATE },
  'compatibility.get': { category: REMOTE_CATEGORIES.COMPATIBILITY },
  'compatibility.ack': { category: REMOTE_CATEGORIES.COMPATIBILITY },
  'compatibility.reprobe': { category: REMOTE_CATEGORIES.COMPATIBILITY },
  'handoff.prepare': { category: REMOTE_CATEGORIES.HANDOFF },
  'handoff.create': { category: REMOTE_CATEGORIES.HANDOFF },
  'legacy.inspect': { category: REMOTE_CATEGORIES.LEGACY },
  // A4-PR6 §6.B (contract v8): the intervention work surface. `intervention
  // .list` / `.get` are pure reads of the SERVER-derived projection
  // (legal actions computed server-side, spec §17.3); `intervention.act` is
  // the single verb entry (closed body {teamSessionId, interventionId,
  // action, note?} — the reviewer three plus the warning plane's
  // `acknowledge`), routed server-side to the authoritative ControlService
  // / GovernanceWarning entries, never re-implementing decisioning.
  'intervention.list': { category: REMOTE_CATEGORIES.INTERVENTION },
  'intervention.get': { category: REMOTE_CATEGORIES.INTERVENTION },
  'intervention.act': { category: REMOTE_CATEGORIES.INTERVENTION },
  // The v8 permission-administration READ lives in the OVERRIDE category
  // (it reads that plane's documents; the strip-projection law — never an
  // authority-bearing or round-trippable decision field — is the handler's).
  'override.getPermissionAdministration': { category: REMOTE_CATEGORIES.OVERRIDE },
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
    intervention: methodsForCategory(REMOTE_CATEGORIES.INTERVENTION),
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
 * The closed set of catalog methods that exist ONLY in remote contract v3
 * (Team D1-D6 repair v2, D1 — frozen by that task; D2 only consumes):
 * the Team UI dedicated-mode pair — `team.listRoots` (the durable
 * ownership / root-identity query) and `team.ensureRootLive` (the
 * explicit open-in-Team-mode guarantee). Every v1/v2 method stays
 * available in v3.
 */
export const REMOTE_V3_ONLY_METHODS: readonly string[] = [
  'team.ensureRootLive',
  'team.listRoots',
]

/**
 * The closed set of catalog methods that exist ONLY in remote contract v4
 * (F3/F11/F9/T1.4 repair round r1, F9 — user adjudications U1–U3,
 * 2026-09-07): the human control-resolution command `team.resolveControl`
 * (the existing `team` category, adjudication U2 — no new category; the
 * closed param set `{ teamSessionId, requestId, decision, note? }`
 * carries NO caller/role/principal fields, adjudication U3 — the host
 * derives the human principal from the trusted authenticated UI/session
 * ownership, the T12-B4 connection-gate authority basis). Every
 * v1/v2/v3 method stays available in v4.
 */
export const REMOTE_V4_ONLY_METHODS: readonly string[] = ['team.resolveControl']

/**
 * The closed set of catalog methods that exist ONLY in remote contract v5
 * (C1, the restart-0.1.7-rc.1 recovery round — guide §10.2): the narrow
 * one-shot ordinary-activation PERMIT `team.prepareOrdinaryOpen` (the
 * host arms the fence's per-root one-shot activation permit for a Team
 * root the caller is allowed to touch; the client consumes it on the
 * following plain session open). It is a Team control-plane RPC — NO Team
 * ensure, NO Team Agent side effect, no TeamDomain mutation beyond the
 * one-shot permit itself. Every v1/v2/v3/v4 method stays available in v5.
 */
export const REMOTE_V5_ONLY_METHODS: readonly string[] = ['team.prepareOrdinaryOpen']

/**
 * The closed set of catalog methods that exist ONLY in remote contract v6
 * (team-view-sync-complete, Phase 2 — frozen design decisions,
 * 2026-09-28): the authoritative per-session read-state query
 * `team.getReadState` — the TeamDomain durable rows resolve a session to
 * `team-root` / `team-member` / `none` (a disposed member still resolves
 * to the member relation, marked disposed; only a successful read that
 * positively confirms no affiliation may answer `none`; every
 * storage/integrity failure fails closed with a typed error — never a
 * silent `none`). READ-ONLY: no repository writes, no agent effects, no
 * generation advance. Every v1/v2/v3/v4/v5 method stays available in v6.
 */
export const REMOTE_V6_ONLY_METHODS: readonly string[] = ['team.getReadState']

/**
 * PR4 ROUND 5 (FIX-2b): the v7-only methods — the human-facing permission
 * grant/revoke entry over the ONE governance mutation authority, plus
 * (alpha.3 PR5, ROOT BLOCK-1) its read pair `override.getPermission` (the
 * overlay's current authority + audit history; pure read, ADR §9). v<7
 * requests to either are the typed `method-version-unsupported` rejection
 * (the same availability machinery as every prior version-only method).
 */
export const REMOTE_V7_ONLY_METHODS: readonly string[] = [
  'override.mutatePermission',
  'override.getPermission',
]

/**
 * A4-PR6 §6.B (contract v8): the v8-only methods — the intervention plane
 * plus `override.getPermissionAdministration`. Requests to any of them at
 * v1–v7 are the typed `method-version-unsupported` rejection (the same
 * availability machinery as every prior version-only method). The param
 * field sets of ALL FOUR are closed with unknown-field rejection
 * (`params.ts`): a future `asRole` / `impersonate` field CANNOT appear on
 * the wire without a version bump.
 */
export const REMOTE_V8_ONLY_METHODS: readonly string[] = [
  'intervention.list',
  'intervention.get',
  'intervention.act',
  'override.getPermissionAdministration',
]

/**
 * ADR A1-2 classification (frozen at the CONTRACT layer): every catalog
 * method that WRITES governance state. This list is the enumeration
 * source for the law that each such method is EXPLICITLY principal-routed
 * in the runtime derivation (`s6-principal.ts`) — no governance-writing
 * method may fall into the host-operator default branch, "including
 * methods nobody thought to name" (plan 6.B; pinned by
 * `packages/remote/test/a4p6-remote-v8.test.ts` against the routing
 * source). READS (`intervention.list` / `.get`,
 * `override.getPermissionAdministration`, `override.getPermission`, …)
 * are deliberately absent: they write nothing and the default branch
 * exists for host-initiated reads. A new governance-writing method MUST
 * join this set and the routing set in the same commit.
 *
 * A4-PR6 review round 1 (fix 5/6): the enumeration itself was incomplete.
 * `team.resolveControl` records durable control DECISIONS and
 * `compatibility.ack` records the governance-warning ACKNOWLEDGMENT —
 * both write governance state and both are explicitly routed to decider
 * derivations in `s6-principal.ts`; omitting them meant the law "every
 * classified method appears in a route" could never notice a future
 * governance-writing method that ALSO went un-named here. The reverse
 * direction is now pinned too (routed-to-a-decider-derivation ⇒
 * enumerated), so this list can no longer silently under-enumerate.
 */
export const REMOTE_GOVERNANCE_WRITING_METHODS: readonly string[] = [
  'override.set',
  'override.reset',
  'policyState.set',
  'override.mutatePermission',
  'intervention.act',
  'team.resolveControl',
  'compatibility.ack',
]

/**
 * Is `method` a catalog method available in remote contract `version`?
 *
 * This is the version-aware membership check the version-aware param
 * parser uses (TCM vNext §15.3): a request to a method of a NEWER
 * version is a typed rejection (`method-version-unsupported`) AFTER the
 * envelope parse — the endpoint itself passes the pre-envelope
 * closed-catalog check, so the version can only be consulted once the
 * envelope is known.
 *
 * @param method - the candidate method name (must be in the catalog).
 * @param version - the request's contract version (supported:
 *   1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 — the v7 bump adds NO method; its
 *   version-aware surface is the `override.set` / `override.reset`
 *   closed field sets in `params.ts`; the v8 bump (A4-PR6) adds the
 *   closed intervention plane + `override.getPermissionAdministration`).
 */
export function isRemoteMethodAvailableInVersion(method: string, version: number): boolean {
  if (!(method in REMOTE_METHOD_CATALOG)) return false
  if (version === 1) {
    return (
      !REMOTE_V2_ONLY_METHODS.includes(method) &&
      !REMOTE_V3_ONLY_METHODS.includes(method) &&
      !REMOTE_V4_ONLY_METHODS.includes(method) &&
      !REMOTE_V5_ONLY_METHODS.includes(method) &&
      !REMOTE_V6_ONLY_METHODS.includes(method) &&
      !REMOTE_V7_ONLY_METHODS.includes(method) &&
      !REMOTE_V8_ONLY_METHODS.includes(method)
    )
  }
  if (version === 2) {
    return (
      !REMOTE_V3_ONLY_METHODS.includes(method) &&
      !REMOTE_V4_ONLY_METHODS.includes(method) &&
      !REMOTE_V5_ONLY_METHODS.includes(method) &&
      !REMOTE_V6_ONLY_METHODS.includes(method) &&
      !REMOTE_V7_ONLY_METHODS.includes(method) &&
      !REMOTE_V8_ONLY_METHODS.includes(method)
    )
  }
  if (version === 3) {
    return (
      !REMOTE_V4_ONLY_METHODS.includes(method) &&
      !REMOTE_V5_ONLY_METHODS.includes(method) &&
      !REMOTE_V6_ONLY_METHODS.includes(method) &&
      !REMOTE_V7_ONLY_METHODS.includes(method) &&
      !REMOTE_V8_ONLY_METHODS.includes(method)
    )
  }
  if (version === 4) {
    return (
      !REMOTE_V5_ONLY_METHODS.includes(method) &&
      !REMOTE_V6_ONLY_METHODS.includes(method) &&
      !REMOTE_V7_ONLY_METHODS.includes(method) &&
      !REMOTE_V8_ONLY_METHODS.includes(method)
    )
  }
  if (version === 5) {
    return (
      !REMOTE_V6_ONLY_METHODS.includes(method) &&
      !REMOTE_V7_ONLY_METHODS.includes(method) &&
      !REMOTE_V8_ONLY_METHODS.includes(method)
    )
  }
  if (version === 6) {
    return (
      !REMOTE_V7_ONLY_METHODS.includes(method) && !REMOTE_V8_ONLY_METHODS.includes(method)
    )
  }
  if (version === 7) {
    // version === 7: every v1..v6 method, the v6-only methods, and the
    // PR4-round-5 v7-only `override.mutatePermission` /
    // `override.getPermission` (the v7 bump's other version-aware surface
    // is the `override.set` / `override.reset` closed field sets in
    // `params.ts`) — but NOT the A4-PR6 v8-only intervention plane.
    return !REMOTE_V8_ONLY_METHODS.includes(method)
  }
  // version === 8 (A4-PR6): every v1..v7 method plus the intervention
  // plane and the permission-administration read (the v8 bump ADDS; the
  // v1–v7 wire shapes are byte-for-byte preserved for older requests).
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
