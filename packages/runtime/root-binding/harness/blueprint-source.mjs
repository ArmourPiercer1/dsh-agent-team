/**
 * The P5-T5 harness's own blueprint document, built from the run directive.
 *
 * WHY THIS EXISTS. Since P8-S2 (`7d81a500`) `bindFreshTeamRoot` refuses to mint
 * the LeaderInstance record without an injected blueprint catalog — "the mint is
 * never defaulted" — and `resolveBoundBlueprint` additionally checks the bound
 * snapshot's `contentHash` against the resolved blueprint. The harness predates
 * both: it passed no catalog and carried a **fabricated** `contentHash` (a hash of
 * an ad-hoc JSON blob, never the hash of a blueprint source document). So S1 had
 * been failing with `catalog-absent` long before the 0.2 upgrade, and had a catalog
 * existed alone, the fabricated hash would have tripped `BLUEPRINT_HASH_MISMATCH`.
 *
 * The fix is a real document parsed by the real parser, derived from the same
 * personas the run directive already asserts. Nothing is defaulted and nothing is
 * hardcoded: the identity (`blueprintId` / `revision` / `contentHash`) comes from
 * `parseBlueprint`, so the snapshot ref the harness pins is exactly the one the
 * durable row must match, and a persona drift becomes a boot-time failure instead
 * of a silently unfalsifiable assertion.
 */

/**
 * @param {{blueprintId: string, revision: string, leaderPersona: string,
 *          memberPersonas?: Record<string, string>}} bp - the directive's blueprint block.
 * @returns {string} a closed-schema v1 blueprint source document.
 */
export function p5t5BlueprintSource(bp) {
  const members = Object.entries(bp.memberPersonas ?? { p5t5worker: 'You do the assigned step.' })
  const lines = [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bp.blueprintId}`,
    `revision: "${bp.revision}"`,
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(bp.leaderPersona)}`,
    'members:',
  ]
  for (const [templateId, persona] of members) {
    lines.push(
      `  - templateId: ${templateId}`,
      `    displayName: ${templateId}`,
      `    persona: ${JSON.stringify(persona)}`,
    )
  }
  lines.push(
    'requirements:',
    '  - domain: skill',
    '    name: base',
    'teamEnvelope:',
    '  allow:',
    '    - create-member',
    '  deny: []',
    'memberEnvelopes:',
  )
  for (const [templateId] of members) {
    lines.push(
      `  - templateId: ${templateId}`,
      '    envelope:',
      '      allow: []',
      '      deny: []',
    )
  }
  lines.push(
    'policyStates:',
    '  - id: default',
    '    description: The P5-T5 harness default state.',
    'quotas:',
    '  team:',
    '    maxInstances: 4',
    '    maxConcurrent: 3',
    '  members:',
    '    maxInstances: 2',
    'metadata: {}',
    '---',
    '',
  )
  return lines.join('\n')
}
