/**
 * a5sr3 — the FOUR MAPPING LAWS machine-checked against the REAL v4
 * authoring→internal mapping tables (VNEXT-SCHEMA-ADR §1 B3: DEFAULT DENY /
 * NO IMPLICIT DEFAULTS / NO COLLISIONS / PURE+FROZEN; M-2 = the mapping
 * table itself).
 *
 * Each law gets ONE RED leg (the violation the law must refuse) and ONE
 * GREEN leg (the compliant projection). The tables under test are the
 * SHIPPING data file `v4-authoring-map.ts` — not a test-local map: these
 * legs fail if the production table is ever softened (that is the "机检"
 * half of ③, the RED→GREEN pair per law the round reports).
 *
 * Cross-lane reuse pins (no second identity language, B2): the v4 closed
 * vocabularies equal the frozen tool-governance sets KEY-FOR-KEY, every
 * resource declaration the map emits re-parses through the FROZEN
 * `parseResourceRef` once the trusted assembly supplies the realmId
 * (filesystem lanes), and the projected core re-enters `parseToolBinding`.
 *
 * @module test/a5sr3-default-deny-mapping
 */
import { describe, expect, it } from 'vitest'
import {
  IMPLEMENTATION_ORIGINS,
  EXECUTION_BOUNDARIES,
  parseResourceRef,
  parseToolBinding,
} from '../tool-governance/src/index.js'
import {
  BLUEPRINT_V4_AUTHORIZATIONS,
  BLUEPRINT_V4_EXECUTION_BOUNDARIES,
  BLUEPRINT_V4_IMPLEMENTATION_ORIGINS,
} from '../blueprint/src/index.js'
import {
  declareFieldMapping,
  declareV4AuthoringMaps,
  projectV4ToolBindingAuthoring,
} from '../vnext-field-mapping/src/index.js'

const LEGAL_ENTRY = {
  owner: 'dsh.shell',
  name: 'bash',
  authorization: 'ask',
  io: {
    read: { mode: 'restricted', allow: ['.', '~/specs'], ask: [], deny: ['./secret'] },
    write: { mode: 'restricted', allow: ['./out'], ask: [], deny: ['.git'] },
    network: { mode: 'restricted', allow: ['https://example.org'], ask: [], deny: [], default: 'deny' },
  },
  execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
} as const

function maps() {
  const declared = declareV4AuthoringMaps()
  if (!declared.ok) throw new Error(`the shipped v4 maps must declare cleanly, got ${declared.code}`)
  return declared.maps
}

function project(entry: unknown) {
  return projectV4ToolBindingAuthoring(maps(), entry)
}

describe('a5sr3 law 1 — DEFAULT DENY (one leg RED→GREEN): an undeclared field is refused, never dropped', () => {
  it('RED: a smuggled lane key refuses the whole projection, naming its path', () => {
    const res = project({
      ...LEGAL_ENTRY,
      io: { ...LEGAL_ENTRY.io, read: { ...LEGAL_ENTRY.io.read, grantEverything: true } },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('unmapped-source-field')
      expect(res.fields).toContain('io.read.grantEverything')
    }
  })

  it('RED: a smuggled ENTRY key refuses the same way (no alias folding)', () => {
    const res = project({ ...LEGAL_ENTRY, tool_bindings: [] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.fields).toContain('tool_bindings')
  })

  it('GREEN: the fully declared entry projects', () => {
    const res = project(LEGAL_ENTRY)
    expect(res.ok).toBe(true)
  })
})

describe('a5sr3 law 2 — NO IMPLICIT DEFAULTS (one leg RED→GREEN): a declared-but-absent source is a refusal', () => {
  it('RED: restricted read WITHOUT the ask lane is missing-source-field, never an empty ask', () => {
    const entry = {
      ...LEGAL_ENTRY,
      io: { ...LEGAL_ENTRY.io, read: { mode: 'restricted', allow: ['.'], deny: [] } },
    }
    const res = project(entry)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('missing-source-field')
      expect(res.fields).toContain('io.read.ask')
    }
  })

  it('RED: the mode-variant law — under mode:all the restricted-only lanes are unmapped, not ignored', () => {
    const entry = {
      ...LEGAL_ENTRY,
      io: { ...LEGAL_ENTRY.io, write: { mode: 'all', allow: ['.'], deny: [] } },
    }
    const res = project(entry)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.fields).toContain('io.write.allow')
  })

  it('GREEN: mode:all with its explicit deny list projects', () => {
    const entry = {
      ...LEGAL_ENTRY,
      io: { ...LEGAL_ENTRY.io, write: { mode: 'all', deny: [] } },
    }
    expect(project(entry).ok).toBe(true)
  })
})

describe('a5sr3 law 3 — NO TARGET COLLISIONS (one leg RED→GREEN): collisions die at DECLARATION time', () => {
  it('RED: a hand-built map that would write one target from two sources is a declaration refusal', () => {
    // Direct engine leg: the law itself, driven through the same lane index
    // the shipped tables use; a colliding map can never be produced through
    // declareV4AuthoringMaps (the GREEN leg).
    const res = declareFieldMapping([
      { sourcePath: 'a', targetKey: 'x' },
      { sourcePath: 'b', targetKey: 'x' },
    ])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('duplicate-target')
  })

  it('GREEN: every shipped v4 map declares cleanly, and no target is written twice across groups', () => {
    const declared = declareV4AuthoringMaps()
    expect(declared.ok).toBe(true)
    const res = project(LEGAL_ENTRY)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.toolName).toBe('bash')
      expect(res.value.authoringOwner).toBe('dsh.shell')
    }
  })
})

describe('a5sr3 law 4 — PURE + FROZEN (one leg RED→GREEN): no laundered re-entry, stable verdicts', () => {
  it('RED: a refused projection cannot be laundered — the refusal is the whole result (no value rides along)', () => {
    const res = project({
      ...LEGAL_ENTRY,
      io: { ...LEGAL_ENTRY.io, network: { mode: 'sideways' } },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect((res as { value?: unknown }).value).toBeUndefined()
  })

  it('GREEN: the projection is deep-frozen and deterministic across runs', () => {
    const a = project(LEGAL_ENTRY)
    const b = project(LEGAL_ENTRY)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.value).toEqual(b.value)
    expect(Object.isFrozen(a.value)).toBe(true)
    const io = a.value.io as Record<string, unknown>
    expect(Object.isFrozen(io)).toBe(true)
    expect(() => {
      ;(a.value as { toolName: string }).toolName = 'tampered'
    }).toThrow(TypeError)
  })
})

describe('a5sr3 cross-lane reuse pins — one vocabulary, one parser, no second language (B2)', () => {
  it('the v4 closed vocabularies ARE the frozen tool-governance sets', () => {
    expect([...BLUEPRINT_V4_IMPLEMENTATION_ORIGINS]).toEqual([...IMPLEMENTATION_ORIGINS])
    expect([...BLUEPRINT_V4_EXECUTION_BOUNDARIES]).toEqual([...EXECUTION_BOUNDARIES])
    expect([...BLUEPRINT_V4_AUTHORIZATIONS]).toEqual(['allow', 'ask', 'deny'])
  })

  it('every filesystem resource the map emits re-parses through the FROZEN parseResourceRef (realmId injected by the trusted assembly)', () => {
    const res = project(LEGAL_ENTRY)
    if (!res.ok) throw new Error('legal entry must project')
    const declarations = res.value.resourceDeclarations as Array<{
      lane: string
      disposition: string
      locator: string
      inferredKind: string
      rights: string[]
    }>
    expect(declarations.length).toBeGreaterThan(0)
    for (const d of declarations) {
      if (d.lane === 'network') continue // network canonicalization is the trusted provider's job (B5: schema phase is zero-normalization)
      const ref = parseResourceRef({ realmId: 'realm-a', kind: d.inferredKind, canonicalLocator: d.locator, rights: d.rights })
      expect(ref.ok, `locator '${d.locator}' (${d.inferredKind}/${d.rights.join(',')}) must re-parse: ${JSON.stringify(ref)}`).toBe(true)
    }
  })

  it('the projected core re-enters the FROZEN ToolBinding parser through the placement mint (round trip, no parallel shape)', () => {
    const res = project(LEGAL_ENTRY)
    if (!res.ok) throw new Error('legal entry must project')
    const binding = parseToolBinding({
      bindingId: 'b-1',
      agentScopeKey: 'agent-1',
      toolName: res.value.toolName,
      definitionIdentity: 'def:dsh.shell/bash@1',
      providerId: res.value.authoringOwner,
      implementationOrigin: (res.value.execution as { implementationOrigin: string }).implementationOrigin,
      executionBoundary: (res.value.execution as { executionBoundary: string }).executionBoundary,
      assurance: {
        implementationOrigin: (res.value.execution as { implementationOrigin: string }).implementationOrigin,
        executionBoundary: (res.value.execution as { executionBoundary: string }).executionBoundary,
        assurance: {
          'content-read': { level: 'enforced', mechanism: 'landlock', realmId: 'realm-a', trustRoot: 'kernel', evidence: null },
          'directory-metadata': { level: 'enforced', mechanism: 'landlock', realmId: 'realm-a', trustRoot: 'kernel', evidence: null },
          write: { level: 'enforced', mechanism: 'landlock', realmId: 'realm-a', trustRoot: 'kernel', evidence: null },
          alias: { level: 'untested', mechanism: null, realmId: 'realm-a', trustRoot: null, evidence: null },
          'network-destination': { level: 'partial', mechanism: 'seccomp-ns', realmId: 'realm-a', trustRoot: 'kernel', evidence: null },
          'inherit-cancel': { level: 'author-trusted', mechanism: 'spawnattr', realmId: 'realm-a', trustRoot: 'team', evidence: null },
        },
      },
      policyGeneration: 1,
      authorityGeneration: 1,
      revision: 0,
      status: 'ACTIVE',
    })
    expect(binding.ok).toBe(true)
  })
})
