/**
 * leader-surface-discovery.mjs — the DRIVER-SIDE fix for BL-17 boot 4.
 *
 * WHY THIS FILE EXISTS. Boot 4 aborted at `team.create` because the driver's
 * `mainBlueprintYaml()` wrote a STATIC `builtinToolDeny: []` while the World
 * always composes the `u5-canary` and `u6-fs-probe-host` rows. The two tools
 * (`u5_canary`, `u6fs_probe`) were therefore on the leader's final model-facing
 * surface with no authority owner, and A2C-2 refused the root agent
 * (`alpha2-permission-coverage-unmanaged-tools`, 2 unmanaged tools).
 *
 * THE FIX IS DISCOVERY-FIRST, NOT A BIGGER STATIC LIST. Adding the two names
 * would fix boot 4 and rot on the next World row, preset change or Team-tool
 * selection change — the exact bug class. The canonical pattern is:
 *
 *   1. prompt the leader with `initialWork` (or read the first model request),
 *   2. read the ACTUAL surfaced tool names from that request
 *      (`tests/world-factory/suites/040-u6-arc-a.mjs:159-161`,
 *       `tests/world-factory/lib/u6-fs-assembly.mjs#surfaceNamesOf`),
 *   3. compute the deny list with the SAME ownership predicate the live gate
 *      uses (imported here from the shared preflight module — NOT re-derived),
 *   4. write `main.yaml` (`mainBlueprintYaml(denyList)`, the canonical
 *      assembly's helper) and only then call `team.create`.
 *
 * This module is the pure part of step 3/4 so a host-free test can bind it to
 * the preflight's `driver.leader-surface` verdict. The driver keeps the I/O:
 * it must pass the request it really received, not a literal.
 *
 * @module dev/agent-workflow/evidence/a5sf-surface/driver-fix/leader-surface-discovery
 */
import {
  discoveryFirstDenyList,
  isFatalSurfaceClass,
  classifyLeaderSurfaceTool,
} from '../../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

/**
 * The tool names a model request exposes, in the shape both the mock provider
 * and the p6t6 route use (`{tools: [{name} | {function: {name}}]}`). Copied
 * from `u6-fs-assembly.mjs#surfaceNamesOf` (same one-line contract) so a driver
 * that already imports the assembly helper and one that does not agree.
 *
 * @param {{tools?: Array<{name?: string, function?: {name?: string}}>}} request
 * @returns {string[]}
 */
export function surfacedToolNames(request) {
  return (Array.isArray(request?.tools) ? request.tools : [])
    .map((tool) => String(tool?.name ?? tool?.function?.name ?? ''))
    .filter((name) => name !== '')
}

/**
 * Compute everything `mainBlueprintYaml(denyList)` needs from a DISCOVERED
 * surface. `teamTools` MUST be the names the blueprint actually selected and
 * registered (plus the placed plane names when the assembly owns them), because
 * A2C-2's `other-managed-team-tool` owner is assignment-based, never a `team_`
 * prefix guess.
 *
 * @param {{surface: readonly string[], teamTools?: readonly string[], managed?: readonly string[], mcpTools?: readonly string[], safeUnmanaged?: readonly string[]}} input
 * @returns {{builtinToolDeny: string[], finalSurface: string[], unmanaged: Array<{name: string, classification: string}>}}
 */
export function buildLeaderSurfaceCapabilities({ surface, ...facts }) {
  const names = [...new Set((surface ?? []).map(String))].sort()
  const builtinToolDeny = discoveryFirstDenyList(names, facts)
  const denied = new Set(builtinToolDeny)
  const finalSurface = names.filter((name) => !denied.has(name))
  const unmanaged = finalSurface
    .map((name) => ({ name, classification: classifyLeaderSurfaceTool(name, facts) }))
    .filter((entry) => isFatalSurfaceClass(entry.classification))
  return { builtinToolDeny, finalSurface, unmanaged }
}

/**
 * Render the `builtinToolDeny:` YAML block exactly as the canonical assemblies
 * do (`u6-fs-assembly.mjs#mainBlueprintYaml`). An empty list keeps the inline
 * `[]` form so an unchanged blueprint stays byte-comparable.
 *
 * @param {readonly string[]} denyList
 * @param {string} [indent] the indentation of the `builtinToolDeny:` key
 * @returns {string[]} YAML lines
 */
export function renderBuiltinToolDenyLines(denyList, indent = '    ') {
  if (denyList.length === 0) return [`${indent}builtinToolDeny: []`]
  return [`${indent}builtinToolDeny:`, ...denyList.map((name) => `${indent}  - ${name}`)]
}
