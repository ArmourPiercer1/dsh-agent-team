/**
 * fixture-invariants.mjs — the rc2 kit's own fixture pre-flight, before any
 * B/C host call.
 *
 * WHY THIS FILE EXISTS (two review findings on PR #62, 2026-10-03).
 *
 * 1. THE DRIFT. The kit derives the saved-blueprint field
 *    `capabilities.builtinToolDeny` as "live model-facing surface − managed
 *    tools − safe-unmanaged tools − the plugin's team tools". For that
 *    subtraction to be correct, `TEAM_TOOL_CATALOG` below must be the plugin's
 *    FULL team-tool namespace. At the base commit it listed 11 names while the
 *    catalog already carried 15, so `team_list_pending_control`,
 *    `team_archive_member`, `team_grant_permission` and `team_revoke_permission`
 *    fell into `builtinToolDeny`.
 *
 *    The host's `tools.restrict()` refuses names outside the agent's
 *    restrictable global vocabulary — and it does so IDENTICALLY in 0.1.7-rc.1
 *    (46a7f68b) and 0.2.0-rc.2 (639ed015): the `restrict()` body, including
 *    `const unknown = [...allow ?? [], ...deny ?? []].filter(name =>
 *    !known.has(name))` and the message template, is byte-identical between the
 *    two. This is therefore PRE-EXISTING FIXTURE DEBT, not a host tightening:
 *    the debt was created by the plugin rounds that ADDED those tools
 *    (`0838739d` 2026-09-18, `98b2926c` 2026-09-21, `940cd841` 2026-10-02)
 *    without updating the kit's catalog. The last green archived evidence
 *    (2026-09-17) predates all three additions, which is why it shows
 *    `denyList: []`.
 *
 * 2. THE FAIL-FAST BUG. The first version of the L0c criterion recorded a FAIL
 *    and then CONTINUED: it wrote the B/C blueprints with the bad deny list and
 *    issued the B/C `team.create` calls anyway — three more host calls against
 *    a fixture already known to be invalid, burying the real cause under the
 *    downstream failures. Here the pre-flight runs BEFORE any blueprint is
 *    materialized and BEFORE any B/C host call, and it signals by THROWING (the
 *    caller owns cleanup), so the invalid fixture never reaches the host.
 *
 * The invariants are pure and dependency-free so they are unit-testable without
 * a host: `packages/testkit/test/rc2-kit-fixture-invariants.test.ts`.
 */

/**
 * The plugin team-tool namespace: 13 statically registered tools
 * (`packages/tools/src/tools.ts`, `name: 'team_*'`) plus the verb-built
 * permission pair named at `packages/tools/src/tools.ts:1316`
 * (`const toolName = verb === 'grant' ? 'team_grant_permission' :
 * 'team_revoke_permission'`, so a grep for `name: 'team_*'` alone misses them).
 *
 * `packages/testkit/test/rc2-kit-fixture-invariants.test.ts` pins this list
 * against the REAL catalog built by `createTeamTools`, so a future team tool
 * added without updating this constant fails a unit test instead of producing a
 * poisoned blueprint.
 */
export const TEAM_TOOL_CATALOG = Object.freeze([
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_collect',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_list_pending_control',
  'team_archive_member',
  'team_grant_permission',
  'team_revoke_permission',
])

/** A pre-flight violation: named, counted, and fatal by construction. */
export class FixtureInvariantError extends Error {
  constructor(violations) {
    const first = violations[0]
    super(`rc2 kit fixture pre-flight failed: ${violations.map((v) => `${v.code}=[${v.names.join(',')}]`).join('; ')}`)
    this.name = 'FixtureInvariantError'
    this.violations = violations
    this.exitCode = 2
    void first
  }
}

/**
 * The derivation the blueprint needs: what is left of the live surface once the
 * managed tools, the explicitly-safe unmanaged tools and the plugin's own team
 * tools are removed. Names starting with `team_` that survive this subtraction
 * are precisely the symptom of a stale `TEAM_TOOL_CATALOG`.
 */
export function deriveBuiltinToolDeny({ surface = [], managed = [], safeUnmanaged = [], teamCatalog = TEAM_TOOL_CATALOG } = {}) {
  const keep = new Set([...managed, ...safeUnmanaged, ...teamCatalog])
  return [...new Set(surface)].filter((name) => !keep.has(name))
}

/**
 * The invariants themselves. Returns a list (empty = healthy); the caller
 * decides how to fail so the failure goes through ITS cleanup path.
 *
 *   stale-team-catalog     a `team_*` name reached `builtinToolDeny` — the kit's
 *                          catalog no longer covers the live team surface, and
 *                          `tools.restrict()` refuses the name (it is not part
 *                          of the global vocabulary an agent inherits);
 *   unknown-team-tool      the blueprint's `teamTools` allow list names something
 *                          outside the catalog — `selectTeamTools` DROPS unknown
 *                          items silently, which would under-provision the
 *                          leader instead of failing;
 *   managed-tool-denied    the derivation denied a tool it was told to keep
 *                          (a derivation bug, not a policy choice).
 */
export function findFixtureViolations({ denyList = [], teamCatalog = TEAM_TOOL_CATALOG, leaderTeamTools = [], managed = [] } = {}) {
  const violations = []
  const catalog = new Set(teamCatalog)
  const teamNamesDenied = denyList.filter((n) => n.startsWith('team_'))
  if (teamNamesDenied.length > 0) {
    violations.push({
      code: 'stale-team-catalog',
      names: teamNamesDenied,
      detail: `team-tool names reached builtinToolDeny; the kit catalog is missing them and tools.restrict() will refuse them as unknown global tools`,
    })
  }
  const unknownAllowed = leaderTeamTools.filter((n) => !catalog.has(n))
  if (unknownAllowed.length > 0) {
    violations.push({
      code: 'unknown-team-tool',
      names: unknownAllowed,
      detail: `the leader teamTools allow list names tools outside the plugin catalog; selectTeamTools drops unknown items silently`,
    })
  }
  const deniedManaged = denyList.filter((n) => managed.includes(n))
  if (deniedManaged.length > 0) {
    violations.push({
      code: 'managed-tool-denied',
      names: deniedManaged,
      detail: 'the derivation denied a managed tool it was told to keep',
    })
  }
  return violations
}

/**
 * Pre-flight + materialization as ONE ordered step, so "check then continue"
 * cannot be re-introduced: the invariants run first and THROW before
 * `writeBlueprint` is ever called, and the caller reaches `team.create` only
 * through a return value this function produces.
 *
 * @param {object} input
 * @param {string[]} input.surface        live model-facing tool names
 * @param {string[]} input.managed
 * @param {string[]} [input.safeUnmanaged]
 * @param {string[]} input.leaderTeamTools the blueprint's teamTools allow lane
 * @param {(violations: object[]) => never | void} [input.onViolations] hook that
 *   normally ABORTS the run through the caller's owned cleanup (the kit passes
 *   one that records the criterion and throws `RunAborted`)
 * @param {(name: string, yaml: string) => void} input.writeBlueprint
 * @param {(name: string) => string} input.renderBlueprint
 * @returns {{ denyList: string[], violations: never[] }}
 */
export function materializeBcFixtures(input) {
  const {
    surface = [],
    managed = [],
    safeUnmanaged = [],
    teamCatalog = TEAM_TOOL_CATALOG,
    leaderTeamTools = [],
    onViolations = null,
    writeBlueprint,
    renderBlueprint,
  } = input
  const denyList = deriveBuiltinToolDeny({ surface, managed, safeUnmanaged, teamCatalog })
  const violations = findFixtureViolations({ denyList, teamCatalog, leaderTeamTools, managed })
  if (violations.length > 0) {
    if (onViolations !== null) onViolations(violations, { denyList })
    // Even a non-throwing hook cannot let an invalid fixture through.
    throw new FixtureInvariantError(violations)
  }
  for (const [name, args] of Object.entries(input.blueprints ?? {})) {
    writeBlueprint(name, renderBlueprint(name, { ...args, denyList }))
  }
  return { denyList, violations: [] }
}
