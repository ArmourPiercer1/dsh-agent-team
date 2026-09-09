/**
 * T1: Blueprint Schema + Static Capability Source — test suite.
 *
 * Covers the 11 acceptance test cases from the T1 plan (§5.8):
 * 1. Legacy fixture parse (capabilities absent)
 * 2. New Leader capabilities parse
 * 3. Member A / Member B different capabilities
 * 4. Malformed allow
 * 5. Malformed deny
 * 6. Unknown fields reject
 * 7. Hash includes all capability fields
 * 8. Static source correctly selects Leader
 * 9. Static source correctly selects MemberTemplate
 * 10. Legacy source returns mode: 'legacy'
 * 11. Selective source maps teamTools/skills/mcp to existing PolicyEntry semantics
 */

import { describe, it, expect } from 'vitest'

import { parseBlueprint, toHashableBlueprint } from '../blueprint/src/validate.js'
import type { TeamBlueprint } from '../blueprint/src/types.js'
import type { RemoteSafeRecord } from '../../contracts/src/remote-safe.js'
import {
  staticCapabilitiesOf,
  selectiveToTemplatePolicyValues,
} from '../policy/src/static-capability-source.js'
import type { StaticTemplateCapabilities } from '../policy/src/static-capability-source.js'

// ---------------------------------------------------------------------------
// Test fixture builders
// ---------------------------------------------------------------------------

/** Minimal valid blueprint source (no capabilities — legacy mode). */
function legacyBlueprintSource(overrides: Record<string, unknown> = {}): string {
  const base = {
    schemaVersion: 1,
    blueprintId: 'test-blueprint',
    revision: 'v1',
    leader: {
      templateId: 'leader',
      persona: 'I am the team leader.',
    },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    metadata: {},
    ...overrides,
  }
  return `---\n${toYamlFrontmatter(base)}\n---`
}

/** Blueprint source with capabilities on the leader. */
function leaderCapabilitiesSource(
  capabilities: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): string {
  return legacyBlueprintSource({
    leader: {
      templateId: 'leader',
      persona: 'I am the team leader.',
      capabilities,
    },
    ...overrides,
  })
}

/** Blueprint source with two members having different capabilities. */
function twoMemberCapabilitiesSource(
  memberACaps: Record<string, unknown>,
  memberBCaps: Record<string, unknown>,
): string {
  return legacyBlueprintSource({
    members: [
      {
        templateId: 'member-a',
        persona: 'I am member A.',
        capabilities: memberACaps,
      },
      {
        templateId: 'member-b',
        persona: 'I am member B.',
        capabilities: memberBCaps,
      },
    ],
  })
}

/** Minimal capabilities block with all 4 sub-fields. */
function fullCapabilities(): Record<string, unknown> {
  return {
    teamTools: { kind: 'allow', items: ['read', 'write'] },
    builtinToolDeny: ['fs.write'],
    skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
    mcp: { kind: 'allow', items: ['mcp-server-1'] },
  }
}

/** Minimal capabilities block with all deny entries. */
function denyCapabilities(): Record<string, unknown> {
  return {
    teamTools: { kind: 'deny' },
    builtinToolDeny: [],
    skills: { kind: 'deny' },
    mcp: { kind: 'deny' },
  }
}

/**
 * A minimal YAML frontmatter serializer for test fixtures.
 * Not production-quality: sufficient for the flat/nested structures we use.
 */
function toYamlFrontmatter(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      // Quote strings that could be misinterpreted
      if (obj.includes(':') || obj.includes('#') || obj.includes("'") || obj === 'true' || obj === 'false' || obj === 'null') {
        return `"${obj.replace(/"/g, '\\"')}"`
      }
      return obj
    }
    return String(obj)
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item) => {
      const val = toYamlFrontmatter(item, indent + 1)
      return `${pad}- ${val}`
    }).join('\n')
  }
  const entries = Object.entries(obj as Record<string, unknown>)
  return entries.map(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sub = toYamlFrontmatter(value, indent + 1)
      return `${pad}${key}:\n${sub}`
    }
    return `${pad}${key}: ${toYamlFrontmatter(value, indent + 1)}`
  }).join('\n')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T1: Blueprint Capability Schema', () => {
  // ——————————————————————————————————————————————————————————————
  // 1. Legacy fixture parse (capabilities absent)
  // ——————————————————————————————————————————————————————————————
  it('1. Legacy fixture parses without capabilities field', () => {
    const source = legacyBlueprintSource()
    const blueprint = parseBlueprint(source)

    expect(blueprint.leader.capabilities).toBeUndefined()
    expect(blueprint.members).toEqual([])
  })

  // ——————————————————————————————————————————————————————————————
  // 2. New Leader capabilities parse
  // ——————————————————————————————————————————————————————————————
  it('2. Leader with full capabilities parses and validates', () => {
    const source = leaderCapabilitiesSource(fullCapabilities())
    const blueprint = parseBlueprint(source)

    const caps = blueprint.leader.capabilities
    expect(caps).toBeDefined()
    expect(caps!.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })
    expect(caps!.builtinToolDeny).toEqual(['fs.write'])
    expect(caps!.skills).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
    expect(caps!.mcp).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
  })

  // ——————————————————————————————————————————————————————————————
  // 3. Member A / Member B different capabilities
  // ——————————————————————————————————————————————————————————————
  it('3. Members can have different capabilities', () => {
    const source = twoMemberCapabilitiesSource(
      fullCapabilities(),
      denyCapabilities(),
    )
    const blueprint = parseBlueprint(source)

    const [memberA, memberB] = blueprint.members
    expect(memberA!.templateId).toBe('member-a')
    expect(memberA!.capabilities?.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })

    expect(memberB!.templateId).toBe('member-b')
    expect(memberB!.capabilities?.teamTools).toEqual({ kind: 'deny' })
  })

  // ——————————————————————————————————————————————————————————————
  // 4. Malformed allow
  // ——————————————————————————————————————————————————————————————
  it('4. Malformed allow entry rejects (missing items)', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'allow' }, // missing items
      builtinToolDeny: [],
      skills: { kind: 'allow', items: ['skill-a'] },
      mcp: { kind: 'allow', items: [] },
    })
    expect(() => parseBlueprint(source)).toThrow()
  })

  it('4b. Malformed allow entry rejects (items not string[])', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: [123] }, // non-string item
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
    })
    expect(() => parseBlueprint(source)).toThrow()
  })

  // ——————————————————————————————————————————————————————————————
  // 5. Malformed deny
  // ——————————————————————————————————————————————————————————————
  it('5. Malformed deny entry rejects (extra fields)', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'deny', items: [] }, // deny must not have items
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
    })
    expect(() => parseBlueprint(source)).toThrow()
  })

  // ——————————————————————————————————————————————————————————————
  // 6. Unknown fields reject
  // ——————————————————————————————————————————————————————————————
  it('6a. Unknown capability sub-field rejects', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: [] },
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
      unknownField: 'bad',
    })
    expect(() => parseBlueprint(source)).toThrow()
  })

  it('6b. Unknown template field rejects', () => {
    const source = legacyBlueprintSource({
      leader: {
        templateId: 'leader',
        persona: 'I am the team leader.',
        capabilities: fullCapabilities(),
        unknownField: 'bad',
      },
    })
    expect(() => parseBlueprint(source)).toThrow()
  })

  // ——————————————————————————————————————————————————————————————
  // 7. Hash includes all capability fields
  // ——————————————————————————————————————————————————————————————
  it('7. Changing capability fields changes the hash', () => {
    const bp1 = parseBlueprint(leaderCapabilitiesSource(fullCapabilities()))
    const bp2 = parseBlueprint(leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read'] }, // fewer items
      builtinToolDeny: [],
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    }))

    expect(bp1.contentHash).not.toBe(bp2.contentHash)

    // builtinToolDeny change
    const bp3 = parseBlueprint(leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.read', 'fs.write'], // different deny list
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    }))
    expect(bp1.contentHash).not.toBe(bp3.contentHash)

    // skills change
    const bp4 = parseBlueprint(leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.write'],
      skills: { kind: 'deny' }, // different from allow
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    }))
    expect(bp1.contentHash).not.toBe(bp4.contentHash)

    // mcp change
    const bp5 = parseBlueprint(leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.write'],
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'deny' }, // different from allow
    }))
    expect(bp1.contentHash).not.toBe(bp5.contentHash)

    // Same capabilities → same hash
    const bp6 = parseBlueprint(leaderCapabilitiesSource(fullCapabilities()))
    expect(bp1.contentHash).toBe(bp6.contentHash)

    // Verify hashable projection includes capabilities
    const hashable = toHashableBlueprint(bp1)
    const leaderHashable = hashable.leader as RemoteSafeRecord
    expect(leaderHashable.capabilities).toBeDefined()
    const capsHashable = leaderHashable.capabilities as RemoteSafeRecord
    expect(capsHashable.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })
    expect(capsHashable.builtinToolDeny).toEqual(['fs.write'])
    expect(capsHashable.skills).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
    expect(capsHashable.mcp).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
  })

  // ——————————————————————————————————————————————————————————————
  // 8. Static source correctly selects Leader
  // ——————————————————————————————————————————————————————————————
  it('8. Static source returns selective mode for Leader with capabilities', () => {
    const blueprint = parseBlueprint(leaderCapabilitiesSource(fullCapabilities()))
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    expect(caps.mode).toBe('selective')
    if (caps.mode === 'selective') {
      expect(caps.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })
      expect(caps.builtinToolDeny).toEqual(['fs.write'])
      expect(caps.skills).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
      expect(caps.mcp).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
    }
  })

  // ——————————————————————————————————————————————————————————————
  // 9. Static source correctly selects MemberTemplate
  // ——————————————————————————————————————————————————————————————
  it('9. Static source returns selective mode for MemberTemplate with capabilities', () => {
    const blueprint = parseBlueprint(
      twoMemberCapabilitiesSource(fullCapabilities(), denyCapabilities()),
    )
    const [memberA, memberB] = blueprint.members

    const capsA = staticCapabilitiesOf(blueprint, memberA!)
    expect(capsA.mode).toBe('selective')

    const capsB = staticCapabilitiesOf(blueprint, memberB!)
    expect(capsB.mode).toBe('selective')
    if (capsB.mode === 'selective') {
      expect(capsB.teamTools).toEqual({ kind: 'deny' })
      expect(capsB.skills).toEqual({ kind: 'deny' })
    }
  })

  // ——————————————————————————————————————————————————————————————
  // 10. Legacy source returns mode: 'legacy'
  // ——————————————————————————————————————————————————————————————
  it('10. Static source returns legacy mode when capabilities absent', () => {
    const blueprint = parseBlueprint(legacyBlueprintSource())
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    expect(caps.mode).toBe('legacy')
  })

  // ——————————————————————————————————————————————————————————————
  // 11. Selective source maps teamTools/skills/mcp to PolicyEntry semantics
  // ——————————————————————————————————————————————————————————————
  it('11. Selective source maps to TemplatePolicy values correctly', () => {
    const blueprint = parseBlueprint(leaderCapabilitiesSource(fullCapabilities()))
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    if (caps.mode !== 'selective') {
      throw new Error('Expected selective mode')
    }

    const values = selectiveToTemplatePolicyValues(caps)
    expect(values).toBeDefined()
    expect(values!['tools']).toEqual({ kind: 'allow', items: ['read', 'write'] })
    expect(values!['skills']).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
    expect(values!['mcp']).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
    // builtinToolDeny does NOT map to a values cell
    expect(Object.keys(values!)).not.toContain('builtinToolDeny')
  })

  it('11b. Selective source maps deny entries to values correctly', () => {
    const blueprint = parseBlueprint(leaderCapabilitiesSource(denyCapabilities()))
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    if (caps.mode !== 'selective') {
      throw new Error('Expected selective mode')
    }

    const values = selectiveToTemplatePolicyValues(caps)
    expect(values).toBeDefined()
    expect(values!['tools']).toEqual({ kind: 'deny' })
    expect(values!['skills']).toEqual({ kind: 'deny' })
    expect(values!['mcp']).toEqual({ kind: 'deny' })
  })

  it('11c. Legacy source returns undefined values', () => {
    const legacy: StaticTemplateCapabilities = { mode: 'legacy' }
    const values = selectiveToTemplatePolicyValues(legacy)
    expect(values).toBeUndefined()
  })
})
