/**
 * pre-alpha3 PR-F (plan §F.3) — the semantic version adapter: the ONLY
 * place a frozen remote contract version is translated into an INTERNAL
 * routing decision.
 *
 * Design (TCM vNext §15.3/§15.6, closure plan §F.3): the WIRE keeps
 * contract versions 1..7 frozen and byte-stable (invariant 17 — a client
 * stamped with any supported version is served the exact wire shape of
 * that version). v7 (pre-alpha3 W1 fix-A, F10) is a PARAMETER-level
 * extension — the optional `expectedGeneration` slot-guard on the
 * override mutation closed sets — not a new wire shape: both semantic
 * decisions below are unchanged for v7 (the create flavor stays
 * `workspace` and the projection shape stays `live`, the threshold
 * functions), and the guard's presence/absence is itself the semantic
 * decision the internal surface branches on (never the version literal).
 * The INTERNAL service / client API routes on the
 * SEMANTIC decisions below, and no runtime / client core code branches on
 * a literal version number. The three places a version literal may still
 * appear are the closed adapter set:
 *
 * 1. this module (the version -> semantic decision, the version-aware
 *    param parser in `params.ts` which validates the closed field set per
 *    wire version, and the wire-shape application for the `live`
 *    projection below);
 * 2. the dispatch transport adapter (`handlers/dispatch.ts` — the
 *    dispatcher passes the request version through to the parser and the
 *    category handlers; the handlers branch on the SEMANTIC values from
 *    this module, never on the version itself);
 * 3. the client remote wrapper boundary
 *    (`@dsh-agent-team/client/transport/team-remote-client` — the ONLY
 *    client module that stamps a contract version onto the request
 *    envelope; every other client module uses the semantic wrappers).
 *
 * The semantic decisions:
 *
 * - {@link teamCreateFlavorOf} — the two `team.create` wire field sets:
 *   `embedded-work` (contract v1: the closed v1 field set, the optional
 *   creation-time `initialWork` admitted inside the create) vs
 *   `workspace` (contract v2: the closed v2 field set, the optional
 *   `workspace`, CREATE-ONLY — the creation-time initial work travels the
 *   separate `team.admitInitialWork` command after the root is open).
 *
 * - {@link projectionShapeOf} — the two `team.getProjection` wire
 *   shapes: `base` (contract v1-v5: the EXACT frozen nine-field
 *   `TeamProjectionDto`, byte-identical passthrough) vs `live` (contract
 *   v6: the frozen base frame PLUS the two additive freshness cells
 *   `durableGeneration` + `liveToken` — the shared wire application is
 *   {@link withLiveProjectionFreshness}).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/contracts/semantic
 */

// ---------------------------------------------------------------------------
// Decision 1 — the team.create flavor
// ---------------------------------------------------------------------------

/**
 * The closed `team.create` flavor vocabulary (the two wire field sets the
 * create endpoint serves; see the module doc for the wire mapping).
 */
export const TEAM_CREATE_FLAVORS = {
  /** The contract v1 field set: the optional creation-time `initialWork`. */
  embeddedWork: 'embedded-work',
  /** The contract v2 field set: the optional `workspace` (CREATE-ONLY). */
  workspace: 'workspace',
} as const

/** One closed `team.create` flavor. */
export type TeamCreateFlavor = (typeof TEAM_CREATE_FLAVORS)[keyof typeof TEAM_CREATE_FLAVORS]

/** The closed flavor values (enumeration order = the v1/v2 wire order). */
export const TEAM_CREATE_FLAVOR_VALUES: readonly TeamCreateFlavor[] = [
  TEAM_CREATE_FLAVORS.embeddedWork,
  TEAM_CREATE_FLAVORS.workspace,
]

/** True when `value` is one of the closed `team.create` flavors. */
export function isTeamCreateFlavor(value: unknown): value is TeamCreateFlavor {
  return (
    typeof value === 'string' &&
    (TEAM_CREATE_FLAVOR_VALUES as readonly string[]).includes(value)
  )
}

/**
 * The `team.create` flavor a request of the given contract version is
 * served (the ONLY version -> create-flavor translation in the internal
 * surface). The parameter is the wire version `number` (the dispatcher
 * has already validated it against the supported set before dispatch —
 * invariant 2). Contract v1 serves the `embedded-work` field set; every
 * version from v2 on serves the `workspace` field set (the v2 wire was
 * introduced for the create endpoint and is the current product create).
 * The mapping is total over the wire integer range, so no check is
 * possible or needed.
 */
export function teamCreateFlavorOf(version: number): TeamCreateFlavor {
  return version >= 2
    ? TEAM_CREATE_FLAVORS.workspace
    : TEAM_CREATE_FLAVORS.embeddedWork
}

// ---------------------------------------------------------------------------
// Decision 2 — the projection shape
// ---------------------------------------------------------------------------

/**
 * The closed `team.getProjection` wire-shape vocabulary (see the module
 * doc for the wire mapping).
 */
export const PROJECTION_SHAPES = {
  /** The exact frozen v1-v5 nine-field `TeamProjectionDto`. */
  base: 'base',
  /** The v6 additive shape: the base frame + `durableGeneration` + `liveToken`. */
  live: 'live',
} as const

/** One closed `team.getProjection` wire shape. */
export type ProjectionShape = (typeof PROJECTION_SHAPES)[keyof typeof PROJECTION_SHAPES]

/** The closed shape values (enumeration order = the v1-v5 / v6 wire order). */
export const PROJECTION_SHAPE_VALUES: readonly ProjectionShape[] = [
  PROJECTION_SHAPES.base,
  PROJECTION_SHAPES.live,
]

/** True when `value` is one of the closed projection shapes. */
export function isProjectionShape(value: unknown): value is ProjectionShape {
  return (
    typeof value === 'string' &&
    (PROJECTION_SHAPE_VALUES as readonly string[]).includes(value)
  )
}

/**
 * The `team.getProjection` wire shape a request of the given contract
 * version is served (the ONLY version -> projection-shape translation in
 * the internal surface). The parameter is the wire version `number` (the
 * dispatcher has already validated it against the supported set before
 * dispatch — invariant 2). Contract v1-v5 serve the exact frozen `base`
 * shape (byte-identical — the v6 cells are ABSENT, not null); contract
 * v6 serves the `live` shape (the base frame PLUS the additive freshness
 * pair — see {@link withLiveProjectionFreshness}). The mapping is total
 * over the wire integer range, so no check is possible or needed.
 */
export function projectionShapeOf(version: number): ProjectionShape {
  return version >= 6 ? PROJECTION_SHAPES.live : PROJECTION_SHAPES.base
}

// ---------------------------------------------------------------------------
// Wire application — the live (v6) projection frame
// ---------------------------------------------------------------------------

/**
 * Apply the `live` projection wire shape to one normalized base frame:
 * the frozen base projection PLUS the two additive freshness cells
 * (team-view-sync-complete Phase 2 frozen decision 4) —
 * `durableGeneration` (always === the frame's own `generation`, named for
 * the client freshness PAIR) and `liveToken` (the deterministic opaque
 * semantic-live-state token of the SAME frame — the caller guarantees the
 * token was computed from this exact projection result, the
 * same-snapshot invariant).
 *
 * This is the SINGLE shared wire application of the v6 projection shape:
 * both dispatchers (the pure remote handler and the production S6 handler)
 * call it, so the additive shape is defined in exactly ONE place. The
 * generic frame keeps each caller's own normalized type (the pure
 * handler's typed projection, the S6 handler's remote-safe record); the
 * constraint is the one cell the shape reads (`generation`, numeric).
 * Fail-closed: a base frame without a numeric `generation` cell is a
 * contract error, never a silently missing freshness cell.
 *
 * @param projection - the normalized base projection frame (the frozen
 *   nine-field `TeamProjectionDto` in the caller's type).
 * @param liveToken - the non-empty opaque `lt-v1-*` token computed from
 *   this exact frame (the caller's same-snapshot guarantee).
 * @returns the `live`-shaped frame (a new record; the input is not
 *   mutated) — the frame's own type plus the two additive cells.
 */
export function withLiveProjectionFreshness<F extends { readonly generation: number }>(
  projection: F,
  liveToken: string,
): F & { readonly durableGeneration: number; readonly liveToken: string } {
  const generation = projection.generation
  if (typeof generation !== 'number') {
    throw new Error(
      'withLiveProjectionFreshness: the base projection frame has no numeric `generation` cell',
    )
  }
  return {
    ...projection,
    durableGeneration: generation,
    liveToken,
  }
}
