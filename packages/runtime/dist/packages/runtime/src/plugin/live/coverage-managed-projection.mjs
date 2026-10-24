/**
 * coverage-managed-projection — the ONE stage-1 managed projection law of
 * the A5M2 coverage-safety card (root ruling 2026-10-24/25), extracted so
 * the production glue (agent-bindings) and the directed a2c2 suite call the
 * SAME pure function — a filter law with ZERO copies, never a test-local
 * reimplementation.
 *
 * The law (unchanged from the card; this module adds no policy): a
 * vocabulary name enters the scope's MANAGED set when — and only when —
 *   (1) the operation-permission adapter REALLY routes its class
 *       (classOf returns a supported class: the same function the
 *       pre-execute ladder dispatches on), or
 *   (2) it carries a real ACTIVE placement governance fact
 *       (placementGoverned), or
 *   (3) the real Schedule hooks hold it (scheduleGoverned), or
 *   (4) the real B-PTC run_code guard governs it (runCodeGoverned).
 * Anything else is NOT claimed — refusal on missing: a fact that is absent,
 * unreadable, or throws counts as NOT governed (fail-closed), and every
 * remaining stage (team owner, MCP delta, safe registry, known-sensitive,
 * unknown) keeps its existing obligation untouched.
 */

/** @typedef {{ kind?: unknown }} CoverageClass */

/** @typedef {(name: string) => CoverageClass | undefined | null} ClassOf */

/** @typedef {(name: string) => boolean} GovernedProbe */

/** @typedef {{
 *   classOf: ClassOf,
 *   placementGoverned: GovernedProbe,
 *   scheduleGoverned: GovernedProbe,
 *   runCodeGoverned: GovernedProbe,
 * }} CoverageFactsPorts */

/** The supported adapter classes — the values classifyPermissionTool
 *  answers for the domains the pre-execute ladder really dispatches. */
const SUPPORTED_CLASSES = new Set(['file', 'tool-level'])

/** @param {readonly string[]} vocabulary @param {CoverageFactsPorts} facts */
export function projectManagedToolNames(vocabulary, facts) {
  const classGoverned = (name) => {
    let cls
    try {
      cls = facts.classOf(name)
    } catch {
      return false
    }
    return cls !== null && typeof cls === 'object'
      && typeof cls.kind === 'string'
      && SUPPORTED_CLASSES.has(cls.kind)
  }
  const probe = (probeFn, name) => {
    try {
      return probeFn(name) === true
    } catch {
      return false
    }
  }
  return vocabulary.filter((name) => classGoverned(name)
    || probe(facts.placementGoverned, name)
    || probe(facts.scheduleGoverned, name)
    || probe(facts.runCodeGoverned, name))
}
