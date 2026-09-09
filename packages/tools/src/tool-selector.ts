/**
 * T2 — Team tool selector.
 *
 * Filter the closed team tool catalog through one capability-layer policy
 * entry (the resolved effective value for the `tools` cell). The selector
 * is pure: it reads the catalog and the policy, and returns the filtered
 * sub-set. No state, no side effects, no DSH imports.
 *
 * Semantics:
 * - `allow(items)` → keep tools whose `name ∈ items`, preserve original
 *   catalog order, deduplicate by catalog name (unknown requested names
 *   are silently ignored).
 * - `deny` → return `[]` (zero team tools).
 *
 * @module @dsh-agent-team/tools/tool-selector
 */

import type { PolicyEntry } from '../../domain/policy/src/index.js'
import type { TeamToolDefinition } from './types.js'

/**
 * Select the team tools allowed by one policy entry.
 *
 * @param allTeamTools - the full team tool catalog (registration order).
 * @param policy - the resolved effective policy entry for the `tools`
 *   capability cell.
 * @returns a new array of allowed tools, in the original catalog order,
 *   deduplicated by name. Unknown requested names are silently ignored.
 */
export function selectTeamTools(
  allTeamTools: readonly TeamToolDefinition[],
  policy: PolicyEntry,
): TeamToolDefinition[] {
  // Deny → empty set
  if (policy.kind === 'deny') {
    return []
  }

  // Allow → filter by name membership, preserve order, deduplicate
  const allowed = new Set(policy.items)
  const seen = new Set<string>()
  const result: TeamToolDefinition[] = []

  for (const tool of allTeamTools) {
    if (allowed.has(tool.name) && !seen.has(tool.name)) {
      seen.add(tool.name)
      result.push(tool)
    }
  }

  return result
}
