/**
 * Alpha.5 P1-06 — provider replacement manifest and composition algebra.
 *
 * A Team composition may replace a host Provider ONLY through the shipped
 * `disable + insert` patch shape (the `team-spill-local` precedent): the base
 * row is disabled in place, the Team row is inserted under its own id, and the
 * composed tree must contain EXACTLY ONE active provider for that service.
 * Anything else — a missing base row, a duplicate insert, an id that matches no
 * row, a Team row that is still active next to its base — is a refused
 * composition, not a warning: a half-controlled Team is the failure mode this
 * module exists to prevent.
 *
 * SHIPPING IS SEPARATE. The rows below are declared but NOT shipped: the
 * manifest is inert until the Native Integrator lands the real plugin modules
 * and the bundle patch in a separately reviewed change. `assertDormant` pins
 * that the currently shipped `cordis.patch.yml` contains none of them, so this
 * lane cannot silently change a normal Host.
 *
 * @module @dsh-agent-team/runtime/team-services/manifest
 */

import { applyEntryPatches, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'

/** The services this round manages (web/subprocess providers arrive later). */
export const TEAM_MANAGED_SERVICES = ['fs', 'web', 'process'] as const
export type TeamManagedService = (typeof TEAM_MANAGED_SERVICES)[number]

/**
 * One replacement row: the base provider id, the Team row it is replaced by,
 * and the plugin module the Team row mounts. `shipped: false` means the row is
 * declared for the composition algebra and the delivery plan but is NOT in the
 * bundle yet.
 */
export interface TeamServiceRow {
  readonly service: TeamManagedService
  readonly baseRowId: string
  readonly teamRowId: string
  readonly teamPlugin: string
  readonly shipped: boolean
}

export const TEAM_SERVICE_ROWS: readonly TeamServiceRow[] = Object.freeze([
  Object.freeze({
    service: 'fs' as const,
    baseRowId: 'fs-sandbox',
    teamRowId: 'team-fs',
    teamPlugin: '@dsh-agent-team/runtime/team-services/fs',
    shipped: false,
  }),
  Object.freeze({
    service: 'web' as const,
    baseRowId: 'web-fetch',
    teamRowId: 'team-web',
    teamPlugin: '@dsh-agent-team/runtime/team-services/web',
    shipped: false,
  }),
  Object.freeze({
    service: 'process' as const,
    baseRowId: 'shell',
    teamRowId: 'team-shell',
    teamPlugin: '@dsh-agent-team/runtime/team-sandbox/shell',
    shipped: false,
  }),
])

/** Closed composition-refusal vocabulary. */
export const COMPOSITION_REFUSAL_CODES = [
  'BASE_ROW_MISSING',
  'BASE_ROW_NOT_DISABLED',
  'TEAM_ROW_MISSING',
  'TEAM_ROW_DUPLICATE',
  'TEAM_ROW_ACTIVE_WITH_BASE',
  'PATCH_UNMATCHED',
  'TEAM_ROW_SHIPPED_EARLY',
] as const

export type CompositionRefusalCode = (typeof COMPOSITION_REFUSAL_CODES)[number]

export interface CompositionRefusal {
  readonly ok: false
  readonly code: CompositionRefusalCode
  readonly detail: string
  readonly service: TeamManagedService | null
}

export interface CompositionAccepted {
  readonly ok: true
  readonly value: {
    readonly entries: EntryOptions[]
    readonly replaced: readonly TeamManagedService[]
  }
}

export type CompositionResult = CompositionAccepted | CompositionRefusal

function refuse(code: CompositionRefusalCode, detail: string, service: TeamManagedService | null = null): CompositionRefusal {
  return Object.freeze({ ok: false, code, detail, service })
}

/** Collect every row of a composed tree, including group children. */
export function collectRows(entries: readonly EntryOptions[]): EntryOptions[] {
  const out: EntryOptions[] = []
  const walk = (rows: readonly EntryOptions[]): void => {
    for (const row of rows) {
      out.push(row)
      if (row.group === true && Array.isArray(row.config)) walk(row.config as EntryOptions[])
    }
  }
  walk(entries)
  return out
}

/**
 * Apply the `disable + insert` replacement for ONE row set over an already
 * composed tree. Returns the new tree and pins the post-conditions:
 *  - the base row existed and is now disabled,
 *  - exactly one Team row exists, active, with the declared plugin,
 *  - no unmatched patch warning was produced.
 */
export function replaceProvider(entries: readonly EntryOptions[], row: TeamServiceRow): CompositionResult {
  const before = collectRows(entries)
  const base = before.filter((entry) => entry.id === row.baseRowId)
  if (base.length === 0) {
    return refuse('BASE_ROW_MISSING', `base provider row '${row.baseRowId}' is not present; refusing to insert '${row.teamRowId}' alone`, row.service)
  }
  if (before.some((entry) => entry.id === row.teamRowId)) {
    return refuse('TEAM_ROW_DUPLICATE', `'${row.teamRowId}' is already present; a second insert would create two providers`, row.service)
  }

  const warnings: string[] = []
  const patches: PatchOptions[] = [
    { id: row.baseRowId, disabled: true },
    { insert: [{ id: row.teamRowId, name: row.teamPlugin }] },
  ]
  const composed = applyEntryPatches([...entries], patches, (message) => {
    warnings.push(message)
  })
  if (warnings.length > 0) {
    return refuse('PATCH_UNMATCHED', `patch did not match: ${warnings.join('; ')}`, row.service)
  }

  const after = collectRows(composed)
  const baseAfter = after.filter((entry) => entry.id === row.baseRowId)
  if (baseAfter.length !== 1 || baseAfter[0]?.disabled !== true) {
    return refuse('BASE_ROW_NOT_DISABLED', `base row '${row.baseRowId}' survived the disable patch`, row.service)
  }
  const teamAfter = after.filter((entry) => entry.id === row.teamRowId)
  if (teamAfter.length !== 1) {
    return refuse('TEAM_ROW_DUPLICATE', `expected exactly one '${row.teamRowId}', found ${teamAfter.length}`, row.service)
  }
  const team = teamAfter[0]!
  if (team.disabled === true || team.name !== row.teamPlugin) {
    return refuse('TEAM_ROW_MISSING', `'${row.teamRowId}' is not the active declared plugin '${row.teamPlugin}'`, row.service)
  }
  return Object.freeze({ ok: true, value: Object.freeze({ entries: composed, replaced: Object.freeze([row.service]) }) })
}

/**
 * Apply every declared replacement to a composed tree. All-or-nothing: the
 * first refusal returns without exposing a partially composed tree.
 */
export function planProviderReplacement(
  entries: readonly EntryOptions[],
  rows: readonly TeamServiceRow[] = TEAM_SERVICE_ROWS,
): CompositionResult {
  let tree: EntryOptions[] = [...entries]
  const replaced: TeamManagedService[] = []
  for (const row of rows) {
    const result = replaceProvider(tree, row)
    if (!result.ok) return result
    tree = result.value.entries
    replaced.push(...result.value.replaced)
  }
  return Object.freeze({ ok: true, value: Object.freeze({ entries: tree, replaced: Object.freeze(replaced) }) })
}

/**
 * Dormancy guard: the shipped bundle patch must NOT contain any declared Team
 * row while `shipped === false`. A Team row that appears in the shipped bundle
 * before its delivery review is refused (the lane cannot silently change a
 * normal Host composition).
 */
export function assertDormant(shippedPatchRows: readonly EntryOptions[]): CompositionResult {
  const rows = collectRows(shippedPatchRows)
  for (const declared of TEAM_SERVICE_ROWS) {
    if (declared.shipped) continue
    const present = rows.some((entry) => entry.id === declared.teamRowId || entry.name === declared.teamPlugin)
    if (present) {
      return refuse(
        'TEAM_ROW_SHIPPED_EARLY',
        `'${declared.teamRowId}' is shipped in the bundle but declared unshipped; the delivery review (Native Integrator) must flip 'shipped' first`,
        declared.service,
      )
    }
  }
  return Object.freeze({ ok: true, value: Object.freeze({ entries: [...shippedPatchRows], replaced: Object.freeze([]) }) })
}
