/**
 * A4-PR6 §6.D — the Permission Administration read model (frozen location:
 * the plan pins THIS path as the helper home; a lane chooses field shapes,
 * never the path).
 *
 * The administration wire value is exactly the SIX closed cells the host
 * port edge stripped (`teamSessionId, memberInstanceId, generation,
 * source, effective, diagnostics`). This module turns that value into the
 * display shape: identity, the overlay provenance summary, the EFFECTIVE
 * RULES rendered AS RULES (§6.D law: subtree rules are NEVER expanded
 * into a directory/filesystem tree — one flat row per rule, matcher shown
 * by KIND + RESOURCE text), and the diagnostics list.
 */

/** One effective-rule row view (the flat rule the UI renders verbatim). */
export interface PermissionRuleView {
  readonly lane: string
  readonly matcherKind: string
  readonly resource: string
  readonly effect: string
}

/** The panel view of one `override.getPermissionAdministration` payload. */
export interface PermissionAdministrationView {
  readonly teamSessionId: string
  readonly memberInstanceId?: string
  /** The overlay generation; NULL = the frozen "blueprint default" state
   *  (no overlay record — displayed as such, never as generation 0). */
  readonly generation: number | null
  /** The provenance cell ('overlay' | 'blueprint-default' on the wire). */
  readonly source: string
  /** Whether the effective set rides a real overlay (source display). */
  readonly fromOverlay: boolean
  readonly rules: readonly PermissionRuleView[]
  readonly diagnostics: readonly string[]
}

function str(value: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const leaf = value[key]
  return typeof leaf === 'string' ? leaf : undefined
}

/** Fail-safe parse of the `{ administration }` payload cell. A malformed
 *  value yields NO view (the panel shows the typed read outcome instead —
 *  a half-parsed authority view is worse than an absent one). */
export function parsePermissionAdministration(data: unknown): PermissionAdministrationView | undefined {
  const raw = (data as Record<string, unknown> | undefined)?.['administration']
  if (typeof raw !== 'object' || raw === null) return undefined
  const administration = raw as Record<string, unknown>
  const teamSessionId = str(administration, 'teamSessionId')
  const source = str(administration, 'source')
  if (teamSessionId === undefined || source === undefined) return undefined
  const memberInstanceId = str(administration, 'memberInstanceId')
  const generationLeaf = administration['generation']
  const generation = typeof generationLeaf === 'number' ? generationLeaf : null
  const effectiveRaw = administration['effective']
  const rules: PermissionRuleView[] = []
  if (typeof effectiveRaw === 'object' && effectiveRaw !== null) {
    const rulesLeaf = (effectiveRaw as Record<string, unknown>)['rules']
    if (Array.isArray(rulesLeaf)) {
      for (const ruleRaw of rulesLeaf) {
        if (typeof ruleRaw !== 'object' || ruleRaw === null) continue
        const rule = ruleRaw as Record<string, unknown>
        const matcherRaw = rule['matcher']
        if (typeof matcherRaw !== 'object' || matcherRaw === null) continue
        const matcher = matcherRaw as Record<string, unknown>
        const lane = str(rule, 'lane')
        const effect = str(rule, 'effect')
        const matcherKind = str(matcher, 'kind')
        const resource = str(matcher, 'resource')
        if (lane === undefined || effect === undefined || matcherKind === undefined || resource === undefined) {
          continue
        }
        rules.push({ lane, matcherKind, resource, effect })
      }
    }
  }
  const diagnosticsLeaf = administration['diagnostics']
  const diagnostics = Array.isArray(diagnosticsLeaf)
    ? diagnosticsLeaf
        .map((entry) => {
          if (typeof entry === 'string') return entry
          if (typeof entry === 'object' && entry !== null) {
            const record = entry as Record<string, unknown>
            const code = str(record, 'code')
            const verdict = str(record, 'verdict')
            const interventionId = str(record, 'interventionId')
            if (code !== undefined) {
              return [code, verdict, interventionId].filter((part) => typeof part === 'string' && part !== '').join(' \u00b7 ')
            }
          }
          return undefined
        })
        .filter((entry): entry is string => entry !== undefined)
    : []
  return {
    teamSessionId,
    ...(memberInstanceId !== undefined ? { memberInstanceId } : {}),
    generation,
    source,
    fromOverlay: source === 'overlay' && generation !== null,
    rules,
    diagnostics,
  }
}
