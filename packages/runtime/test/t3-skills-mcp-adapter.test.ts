/**
 * T3 — Skills and MCP adapter tests (plan §9.1).
 *
 * Validates the end-to-end behavior of:
 *
 * - Team skill registration: allow → registers found skills, deny → none,
 *   no sibling leak, dispose removes scoped registration; skill diagnostics
 *   (not-in-catalog / skills-seam-missing / register-failed).
 * - MCP server filtering (filterMcpServers): allow configured → included,
 *   deny → empty, allow unconfigured → empty. (The dead
 *   mountAllowedMcpServers mount helper was removed in the alpha.1
 *   hardening P2.1 — the production mount is the live glue's reconcileMcp.)
 *
 * Test pattern of this repo: synchronous `it` bodies over captured values.
 */

import { describe, expect, it } from 'vitest'
import { InMemorySkillCatalog } from '../agent-setup/capability/skill-catalog.js'
import { registerTeamSkills } from '../agent-setup/capability/skill-adapter.js'
import { filterMcpServers } from '../agent-setup/capability/mcp-adapter.js'

// ---------------------------------------------------------------------------
// Fake implementations for test isolation
// ---------------------------------------------------------------------------

interface SkillRegEntry {
  name: string
  disposed: boolean
}

function createFakeSkillSeam() {
  const registered: SkillRegEntry[] = []

  return {
    get registered(): readonly SkillRegEntry[] {
      return registered
    },
    register: (def: { name: string }) => {
      const entry: SkillRegEntry = { name: def.name, disposed: false }
      registered.push(entry)
      return {
        dispose: () => {
          entry.disposed = true
        },
      }
    },
  }
}

function createFakeSkillAgentContext(seam: ReturnType<typeof createFakeSkillSeam>) {
  return {
    get: (key: string) => {
      if (key === 'skills') return seam
      return undefined
    },
  }
}

// ===========================================================================
// SKILLS
// ===========================================================================

describe('T3 — Skill adapter', () => {
  describe('registerTeamSkills', () => {
    it('Agent A: allow skill-A → has Team skill-A', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
        { name: 'skill-B', description: 'B', content: 'content-B' },
      ])
      const seam = createFakeSkillSeam()
      const agentCtx = createFakeSkillAgentContext(seam)
      const policy = { kind: 'allow' as const, items: ['skill-A'] }

      const disposer = registerTeamSkills(agentCtx, catalog, policy)

      expect(seam.registered.length).toBe(1)
      expect(seam.registered[0]!.name).toBe('skill-A')
      expect(seam.registered[0]!.disposed).toBe(false)

      disposer.dispose()
      expect(seam.registered[0]!.disposed).toBe(true)
    })

    it('Agent B: allow skill-B → has Team skill-B', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
        { name: 'skill-B', description: 'B', content: 'content-B' },
      ])
      const seam = createFakeSkillSeam()
      const agentCtx = createFakeSkillAgentContext(seam)
      const policy = { kind: 'allow' as const, items: ['skill-B'] }

      const disposer = registerTeamSkills(agentCtx, catalog, policy)

      expect(seam.registered.length).toBe(1)
      expect(seam.registered[0]!.name).toBe('skill-B')

      disposer.dispose()
      expect(seam.registered[0]!.disposed).toBe(true)
    })

    it('Agent C: deny → no Team-managed skill', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
      ])
      const seam = createFakeSkillSeam()
      const agentCtx = createFakeSkillAgentContext(seam)
      const policy = { kind: 'deny' as const }

      const disposer = registerTeamSkills(agentCtx, catalog, policy)

      expect(seam.registered.length).toBe(0)

      disposer.dispose()
      expect(seam.registered.length).toBe(0)
    })

    it('No sibling leak: A and B do not see each other skills', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
        { name: 'skill-B', description: 'B', content: 'content-B' },
      ])

      // Agent A gets skill-A only.
      const seamA = createFakeSkillSeam()
      const ctxA = createFakeSkillAgentContext(seamA)
      const disposerA = registerTeamSkills(
        ctxA,
        catalog,
        { kind: 'allow' as const, items: ['skill-A'] },
      )

      // Agent B gets skill-B only (separate seam = separate scope).
      const seamB = createFakeSkillSeam()
      const ctxB = createFakeSkillAgentContext(seamB)
      const disposerB = registerTeamSkills(
        ctxB,
        catalog,
        { kind: 'allow' as const, items: ['skill-B'] },
      )

      expect(seamA.registered.length).toBe(1)
      expect(seamA.registered[0]!.name).toBe('skill-A')
      expect(seamB.registered.length).toBe(1)
      expect(seamB.registered[0]!.name).toBe('skill-B')

      // Disposing A does not affect B.
      disposerA.dispose()
      expect(seamA.registered[0]!.disposed).toBe(true)
      expect(seamB.registered[0]!.disposed).toBe(false)

      disposerB.dispose()
    })

    it('Dispose removes scoped registration', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
        { name: 'skill-B', description: 'B', content: 'content-B' },
      ])
      const seam = createFakeSkillSeam()
      const agentCtx = createFakeSkillAgentContext(seam)
      const policy = { kind: 'allow' as const, items: ['skill-A', 'skill-B'] }

      const disposer = registerTeamSkills(agentCtx, catalog, policy)

      expect(seam.registered.length).toBe(2)
      for (const r of seam.registered) {
        expect(r.disposed).toBe(false)
      }

      disposer.dispose()
      for (const r of seam.registered) {
        expect(r.disposed).toBe(true)
      }

      // Idempotent dispose.
      disposer.dispose()
    })

    it('Unknown skill in policy → skip + diagnostic, no crash', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
      ])
      const seam = createFakeSkillSeam()
      const agentCtx = createFakeSkillAgentContext(seam)
      const skipped: string[] = []
      const diagnostics = {
        onSkip: (id: string) => {
          skipped.push(id)
        },
      }
      const policy = { kind: 'allow' as const, items: ['skill-A', 'unknown-skill'] }

      const disposer = registerTeamSkills(agentCtx, catalog, policy, diagnostics)

      expect(seam.registered.length).toBe(1)
      expect(seam.registered[0]!.name).toBe('skill-A')
      expect(skipped).toEqual(['unknown-skill'])

      disposer.dispose()
    })

    it('No seam available → registers nothing', () => {
      const catalog = new InMemorySkillCatalog([
        { name: 'skill-A', description: 'A', content: 'content-A' },
      ])
      const agentCtx = { get: () => undefined }
      const policy = { kind: 'allow' as const, items: ['skill-A'] }

      const disposer = registerTeamSkills(agentCtx, catalog, policy)

      disposer.dispose() // no-op, no crash
    })
  })
})

// ===========================================================================
// MCP
// ===========================================================================

describe('T3 — MCP adapter', () => {
  describe('filterMcpServers', () => {
    it('A: allow configured server → included', () => {
      const configured = ['server-alpha', 'server-beta']
      const policy = { kind: 'allow' as const, items: ['server-alpha'] }

      const result = filterMcpServers(configured, policy)

      expect(result).toEqual(['server-alpha'])
    })

    it('B: deny → no mount', () => {
      const configured = ['server-alpha', 'server-beta']
      const policy = { kind: 'deny' as const }

      const result = filterMcpServers(configured, policy)

      expect(result).toEqual([])
    })

    it('C: allow unrelated server → no mount (not configured)', () => {
      const configured = ['server-alpha', 'server-beta']
      const policy = { kind: 'allow' as const, items: ['server-gamma'] }

      const result = filterMcpServers(configured, policy)

      expect(result).toEqual([])
    })

    it('Multiple allowed configured servers', () => {
      const configured = ['server-alpha', 'server-beta', 'server-gamma']
      const policy = { kind: 'allow' as const, items: ['server-alpha', 'server-gamma'] }

      const result = filterMcpServers(configured, policy)

      expect(result).toEqual(['server-alpha', 'server-gamma'])
    })
  })
})
