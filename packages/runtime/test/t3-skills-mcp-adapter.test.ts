/**
 * T3 — Skills and MCP adapter tests (plan §9.1).
 *
 * Validates the end-to-end behavior of:
 *
 * - Team skill registration: allow → registers found skills, deny → none,
 *   no sibling leak, dispose removes scoped registration.
 * - MCP server mounting: allow configured → mounts, deny → no mount,
 *   allow unconfigured → no mount, dispose removes scoped effect.
 *
 * Test pattern of this repo: synchronous `it` bodies over captured values.
 */

import { describe, expect, it } from 'vitest'
import { InMemorySkillCatalog } from '../agent-setup/capability/skill-catalog.js'
import { registerTeamSkills } from '../agent-setup/capability/skill-adapter.js'
import {
  filterMcpServers,
  mountAllowedMcpServers,
} from '../agent-setup/capability/mcp-adapter.js'

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

interface McpMountEntry {
  name: string
  config: unknown
  disposed: boolean
}

function createFakeMcpSeam() {
  const mounted: McpMountEntry[] = []

  return {
    get mounted(): readonly McpMountEntry[] {
      return mounted
    },
    plugin: (name: string, config: unknown) => {
      const entry: McpMountEntry = { name, config, disposed: false }
      mounted.push(entry)
      return {
        dispose: () => {
          entry.disposed = true
        },
      }
    },
  }
}

function createFakeMcpAgentContext(seam: ReturnType<typeof createFakeMcpSeam>) {
  return {
    plugin: (name: string, config: unknown) => seam.plugin(name, config),
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

  describe('mountAllowedMcpServers', () => {
    it('A: mounts allowed configured server', () => {
      const seam = createFakeMcpSeam()
      const agentCtx = createFakeMcpAgentContext(seam)
      const allowed = ['server-alpha']
      const mcpConfig = {
        'server-alpha': { url: 'http://localhost:8100' },
      }

      const disposer = mountAllowedMcpServers(agentCtx, allowed, mcpConfig)

      expect(seam.mounted.length).toBe(1)
      expect(seam.mounted[0]!.name).toBe('server-alpha')
      expect(seam.mounted[0]!.disposed).toBe(false)

      disposer.dispose()
      expect(seam.mounted[0]!.disposed).toBe(true)
    })

    it('B: deny → no mount', () => {
      const seam = createFakeMcpSeam()
      const agentCtx = createFakeMcpAgentContext(seam)

      const disposer = mountAllowedMcpServers(agentCtx, [], {})

      expect(seam.mounted.length).toBe(0)

      disposer.dispose()
    })

    it('C: allow but not configured → no mount', () => {
      const seam = createFakeMcpSeam()
      const agentCtx = createFakeMcpAgentContext(seam)
      const allowed = ['server-gamma']
      const mcpConfig = {}

      const disposer = mountAllowedMcpServers(agentCtx, allowed, mcpConfig)

      expect(seam.mounted.length).toBe(0)

      disposer.dispose()
    })

    it('Dispose A → MCP scoped effect gone, B unaffected', () => {
      const seamA = createFakeMcpSeam()
      const seamB = createFakeMcpSeam()
      const agentCtxA = createFakeMcpAgentContext(seamA)
      const agentCtxB = createFakeMcpAgentContext(seamB)

      const config = {
        'server-alpha': { url: 'http://localhost:8100' },
        'server-beta': { url: 'http://localhost:8101' },
      }

      const disposerA = mountAllowedMcpServers(
        agentCtxA,
        ['server-alpha'],
        config,
      )
      const disposerB = mountAllowedMcpServers(
        agentCtxB,
        ['server-beta'],
        config,
      )

      expect(seamA.mounted.length).toBe(1)
      expect(seamB.mounted.length).toBe(1)
      expect(seamA.mounted[0]!.disposed).toBe(false)
      expect(seamB.mounted[0]!.disposed).toBe(false)

      // Dispose A only.
      disposerA.dispose()
      expect(seamA.mounted[0]!.disposed).toBe(true)
      expect(seamB.mounted[0]!.disposed).toBe(false)

      disposerB.dispose()
    })

    it('Multiple servers mounted and disposed', () => {
      const seam = createFakeMcpSeam()
      const agentCtx = createFakeMcpAgentContext(seam)
      const config = {
        'server-alpha': { url: 'http://localhost:8100' },
        'server-beta': { url: 'http://localhost:8101' },
      }

      const disposer = mountAllowedMcpServers(
        agentCtx,
        ['server-alpha', 'server-beta'],
        config,
      )

      expect(seam.mounted.length).toBe(2)
      for (const m of seam.mounted) {
        expect(m.disposed).toBe(false)
      }

      disposer.dispose()
      for (const m of seam.mounted) {
        expect(m.disposed).toBe(true)
      }
    })
  })

  describe('filterMcpServers + mountAllowedMcpServers integration', () => {
    it('Full pipeline: configured → filter → mount → dispose', () => {
      const configured = ['server-alpha', 'server-beta']
      const policy = { kind: 'allow' as const, items: ['server-alpha'] }
      const mcpConfig = {
        'server-alpha': { url: 'http://localhost:8100' },
        'server-beta': { url: 'http://localhost:8101' },
      }

      const allowed = filterMcpServers(configured, policy)
      expect(allowed).toEqual(['server-alpha'])

      const seam = createFakeMcpSeam()
      const agentCtx = createFakeMcpAgentContext(seam)
      const disposer = mountAllowedMcpServers(agentCtx, allowed, mcpConfig)

      expect(seam.mounted.length).toBe(1)
      expect(seam.mounted[0]!.name).toBe('server-alpha')

      disposer.dispose()
      expect(seam.mounted[0]!.disposed).toBe(true)
    })
  })
})
