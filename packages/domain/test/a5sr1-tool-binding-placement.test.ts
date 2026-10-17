/**
 * a5sr1 — the ToolBinding typed face of R1 placement semantics
 * (VNEXT-SCHEMA-ADR §1 B1/B2, §4 draft; design `post-poc-technical-design.md`
 * §2 R1 = Scoped Binding: the assembly PLACES a Team-owned Definition and
 * pins THE OBJECT IT PLACED — GLUE-5 #308 landed that production face).
 *
 * This test pins the TYPE-LEVEL half only:
 *  - `parsePlacedTeamDefinition` — the closed record for one placed
 *    Team-owned Definition fact (owner / toolName / definitionIdentity);
 *  - `createPlacementComparator` — the PER-CALL comparison hook: the admitted
 *    `ToolBinding`'s (providerId, toolName, definitionIdentity) vs the LIVE
 *    placement facts of the assembly that owns the name; typed verdicts,
 *    never a throw, never a silent pass;
 *  - `mintToolBindingFromPlacement` — a placement fact + the trusted
 *    assembly-side facts become a `ToolBinding` THROUGH `parseToolBinding`
 *    (the SAME frozen parser the production admitCall contract consumes —
 *    pa-CONTRACT §GLUE-5 "由 guard 发布事实经 parseToolBinding 重建同值
 *    binding"; no parallel binding system).
 *
 * @module test/a5sr1-tool-binding-placement
 */
import { describe, expect, it } from 'vitest'
import {
  BINDING_STATES,
  createPlacementComparator,
  mintToolBindingFromPlacement,
  parsePlacedTeamDefinition,
  parseToolBinding,
} from '../tool-governance/src/index.js'

const PLACED_BASH = {
  owner: 'dsh.shell',
  toolName: 'team_bash',
  definitionIdentity: 'def:dsh.shell/team_bash@sha-1111',
}

const ASSEMBLY_FACTS = {
  bindingId: 'binding:agent-1/team_bash',
  agentScopeKey: 'agent-1',
  providerId: 'dsh.shell',
  implementationOrigin: 'dsh-native',
  executionBoundary: 'confined-subprocess',
  assurance: {
    implementationOrigin: 'dsh-native',
    executionBoundary: 'confined-subprocess',
    assurance: {
      'content-read': { level: 'enforced', mechanism: 'landlock', realmId: 'realm-1', trustRoot: 'kernel', evidence: 'ev-1' },
      'directory-metadata': { level: 'enforced', mechanism: 'landlock', realmId: 'realm-1', trustRoot: 'kernel', evidence: 'ev-2' },
      write: { level: 'enforced', mechanism: 'landlock', realmId: 'realm-1', trustRoot: 'kernel', evidence: 'ev-3' },
      alias: { level: 'partial', mechanism: 'openat2', realmId: 'realm-1', trustRoot: 'kernel', evidence: null },
      'network-destination': { level: 'unsupported', mechanism: null, realmId: 'realm-1', trustRoot: null, evidence: null },
      'inherit-cancel': { level: 'author-trusted', mechanism: 'spawnattr', realmId: 'realm-1', trustRoot: 'team', evidence: null },
    },
  },
  policyGeneration: 1,
  authorityGeneration: 1,
  revision: 0,
  status: 'ACTIVE',
} as const

function admittedFrom(binding: { toolName: string; providerId: string; definitionIdentity: string }) {
  return { providerId: binding.providerId, toolName: binding.toolName, definitionIdentity: binding.definitionIdentity }
}

describe('a5sr1 placement facts — the closed record of a placed Team-owned Definition', () => {
  it('parses a complete placement fact and freezes it', () => {
    const res = parsePlacedTeamDefinition(PLACED_BASH)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.toolName).toBe('team_bash')
      expect(Object.isFrozen(res.value)).toBe(true)
    }
  })

  it('refuses an unknown key, a blank owner, and a blank definitionIdentity (closed record)', () => {
    expect(parsePlacedTeamDefinition({ ...PLACED_BASH, executeInline: 'x' }).ok).toBe(false)
    expect(parsePlacedTeamDefinition({ ...PLACED_BASH, owner: '  ' }).ok).toBe(false)
    expect(parsePlacedTeamDefinition({ ...PLACED_BASH, definitionIdentity: '' }).ok).toBe(false)
  })
})

describe('a5sr1 mintToolBindingFromPlacement — reuse, not a second binding system', () => {
  it('mints a ToolBinding that parseToolBinding itself accepts with the SAME value', () => {
    const minted = mintToolBindingFromPlacement(PLACED_BASH, ASSEMBLY_FACTS)
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    expect(minted.value.definitionIdentity).toBe(PLACED_BASH.definitionIdentity)
    expect(minted.value.toolName).toBe(PLACED_BASH.toolName)
    expect(minted.value.providerId).toBe(PLACED_BASH.owner)
    expect(minted.value.agentScopeKey).toBe(ASSEMBLY_FACTS.agentScopeKey)
    // THE reuse pin: the minted binding is exactly what the frozen parser
    // derives from the same raw shape — no parallel construction path.
    const direct = parseToolBinding({
      bindingId: ASSEMBLY_FACTS.bindingId,
      agentScopeKey: ASSEMBLY_FACTS.agentScopeKey,
      toolName: PLACED_BASH.toolName,
      definitionIdentity: PLACED_BASH.definitionIdentity,
      providerId: PLACED_BASH.owner,
      implementationOrigin: ASSEMBLY_FACTS.implementationOrigin,
      executionBoundary: ASSEMBLY_FACTS.executionBoundary,
      assurance: ASSEMBLY_FACTS.assurance,
      policyGeneration: ASSEMBLY_FACTS.policyGeneration,
      authorityGeneration: ASSEMBLY_FACTS.authorityGeneration,
      revision: ASSEMBLY_FACTS.revision,
      status: ASSEMBLY_FACTS.status,
    })
    expect(direct.ok).toBe(true)
    if (direct.ok && minted.ok) expect(direct.value).toEqual(minted.value)
  })

  it('a contradicting assurance contract is refused THROUGH parseToolBinding (one law, one site)', () => {
    const res = mintToolBindingFromPlacement(PLACED_BASH, {
      ...ASSEMBLY_FACTS,
      implementationOrigin: 'remote-provider',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.problems.map((p) => p.code)).toContain('contradiction')
  })

  it('an out-of-set status is refused (the state machine is the frozen one)', () => {
    expect(BINDING_STATES.length).toBe(6)
    const NOT_A_STATE = 'PUBLISHED' as unknown as (typeof BINDING_STATES)[number]
    expect(mintToolBindingFromPlacement(PLACED_BASH, { ...ASSEMBLY_FACTS, status: NOT_A_STATE }).ok).toBe(false)
  })
})

describe('a5sr1 createPlacementComparator — the per-call comparison hook', () => {
  it('admitted binding matching the live placement passes with the fact attached', () => {
    const minted = mintToolBindingFromPlacement(PLACED_BASH, ASSEMBLY_FACTS)
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    const comparator = createPlacementComparator([PLACED_BASH])
    const verdict = comparator.compare(admittedFrom(minted.value))
    expect(verdict.ok).toBe(true)
  })

  it('a name nobody placed refuses with the typed not-placed verdict', () => {
    const comparator = createPlacementComparator([PLACED_BASH])
    const verdict = comparator.compare({
      providerId: 'vendor.solver',
      toolName: 'solver',
      definitionIdentity: 'def:vendor.solver/solver@sha-9',
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.code).toBe('definition-not-placed')
  })

  it('the same name resolving to a DIFFERENT definition object refuses with identity-drift', () => {
    const comparator = createPlacementComparator([PLACED_BASH])
    const verdict = comparator.compare({
      providerId: 'dsh.shell',
      toolName: 'team_bash',
      definitionIdentity: 'def:dsh.shell/team_bash@sha-EVIL',
    })
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.code).toBe('placement-identity-drift')
      if (verdict.code === 'placement-identity-drift') {
        expect(verdict.expected).toBe('def:dsh.shell/team_bash@sha-1111')
        expect(verdict.observed).toBe('def:dsh.shell/team_bash@sha-EVIL')
      }
    }
  })

  it('a second placement under the same (owner, toolName) is a construction error at hook build', () => {
    expect(() => createPlacementComparator([PLACED_BASH, { ...PLACED_BASH, definitionIdentity: 'def:x' }])).toThrow(TypeError)
  })
})
