/**
 * T2 — Team tool selector + Built-in deny adapter tests.
 *
 * Three Agent-scoped test contexts (Cases A/B/C) plus a sibling isolation
 * test. Each case exercises the intersection of team-tool allow/deny and
 * built-in-tool deny through the two T2 modules:
 *
 * - `selectTeamTools()` — filters the team tool catalog by policy.
 * - `applyBuiltInToolDeny()` — applies a deny list to the agent's built-in
 *   tool surface through `agentCtx.tools.restrict()`.
 *
 * The tests use minimal inline mocks: synthetic team tool definitions and a
 * mock agent context that tracks restrict() calls.
 */

import { describe, expect, it } from 'vitest'

import { selectTeamTools } from '../src/tool-selector.js'
import { applyBuiltInToolDeny } from '../src/builtin-deny.js'
import type { TeamToolDefinition } from '../src/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake team tool definition. */
function fakeTeamTool(name: string): TeamToolDefinition {
  return {
    name,
    description: `Fake tool: ${name}`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render(_args, value) {
        return [{ type: 'text', text: JSON.stringify(value) }]
      },
    },
    async execute(): Promise<import('../src/types.js').TeamToolsResult> {
      return {
        status: 'executed',
        action: name,
        rootSessionId: '',
        callerRole: '',
        effect: { kind: 'none' },
        requestToken: '',
      }
    },
  }
}

/** The canonical 10-tool team catalog used across test cases. */
const FULL_CATALOG: TeamToolDefinition[] = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
].map(fakeTeamTool)

/**
 * Mock agent context that tracks restrict() calls AND the lifted (disposer)
 * invocations. Each instance is independent (sibling isolation).
 *
 * P0-2 (hardening §4): the real seam is `restrict(filter): () => void` — the
 * returned function is the exact disposer that lifts the restriction. The
 * mock returns a tracking disposer so the tests can verify the adapter
 * CAPTURES and INVOKES it (B7-B10).
 */
function makeMockAgentCtx() {
  const calls: Array<{ deny: string[] }> = []
  let lifted = 0
  return {
    calls,
    /** Number of times the upstream disposer was invoked. */
    liftCount: () => lifted,
    tools: {
      restrict(opts: { deny: string[] }): () => void {
        calls.push({ deny: [...opts.deny] })
        return () => {
          lifted += 1
        }
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Case A — Team tools allow [team_send_message, team_list_members],
//          builtin deny [bash, write]
// ---------------------------------------------------------------------------
describe('T2 Case A: selective team allow + builtin deny', () => {
  it('selects only the allowed team tools', () => {
    const policy = { kind: 'allow' as const, items: ['team_send_message', 'team_list_members'] }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected.map((t) => t.name)).toEqual(['team_list_members', 'team_send_message'])
  })

  it('preserves catalog order in the result', () => {
    const policy = { kind: 'allow' as const, items: ['team_send_message', 'team_list_members'] }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    // team_list_members appears before team_send_message in the catalog
    const idxList = selected.findIndex((t) => t.name === 'team_list_members')
    const idxMsg = selected.findIndex((t) => t.name === 'team_send_message')
    expect(idxList < idxMsg).toBe(true)
  })

  it('ignores unknown requested names', () => {
    const policy = {
      kind: 'allow' as const,
      items: ['team_send_message', 'nonexistent_tool'],
    }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected.map((t) => t.name)).toEqual(['team_send_message'])
  })

  it('deduplicates by catalog name', () => {
    const policy = {
      kind: 'allow' as const,
      items: ['team_send_message', 'team_send_message', 'team_list_members'],
    }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected.map((t) => t.name)).toEqual(['team_list_members', 'team_send_message'])
  })

  it('applies builtin deny [bash, write] to agent context', () => {
    const mock = makeMockAgentCtx()
    const disposer = applyBuiltInToolDeny(mock, ['bash', 'write'])
    expect(mock.calls.length).toBe(1)
    const firstCall = mock.calls[0]!
    expect(firstCall.deny).toEqual(['bash', 'write'])
    expect(disposer).not.toBe(undefined)
  })

  // P0-2 (hardening §4) B8 + B10: the adapter CAPTURES the upstream
  // disposer returned by restrict() and INVOKES it exactly once on
  // dispose(); a double dispose is a no-op (idempotent).
  it('disposer invokes the captured upstream lift exactly once (B8/B10)', () => {
    const mock = makeMockAgentCtx()
    const disposer = applyBuiltInToolDeny(mock, ['bash', 'write'])
    expect(mock.liftCount()).toBe(0)
    disposer.dispose()
    expect(mock.liftCount()).toBe(1)
    // B10: double dispose → exactly one lift (idempotent)
    disposer.dispose()
    expect(mock.liftCount()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Case B — Team tools allow [team_delegate], builtin deny [bash]
// ---------------------------------------------------------------------------
describe('T2 Case B: single team tool allow + single builtin deny', () => {
  it('selects only team_delegate', () => {
    const policy = { kind: 'allow' as const, items: ['team_delegate'] }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected.map((t) => t.name)).toEqual(['team_delegate'])
  })

  it('applies builtin deny [bash] to agent context', () => {
    const mock = makeMockAgentCtx()
    applyBuiltInToolDeny(mock, ['bash'])
    expect(mock.calls.length).toBe(1)
    const firstCall = mock.calls[0]!
    expect(firstCall.deny).toEqual(['bash'])
  })

  it('unlisted base tools are unaffected by deny seam call', () => {
    const mock = makeMockAgentCtx()
    applyBuiltInToolDeny(mock, ['bash'])
    // The restrict seam is called once with only [bash];
    // other base tools (read, glob, grep, etc.) are not in the deny list.
    expect(mock.calls.length).toBe(1)
    const deny = mock.calls[0]!.deny
    expect(deny.includes('read')).toBe(false)
    expect(deny.includes('glob')).toBe(false)
    expect(deny.includes('grep')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Case C — Team tools deny, builtin deny []
// ---------------------------------------------------------------------------
describe('T2 Case C: team tools deny + empty builtin deny', () => {
  it('returns zero team tools when policy is deny', () => {
    const policy = { kind: 'deny' as const }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected).toEqual([])
  })

  it('empty builtin deny is a no-op (B7: no restrict call, no lift)', () => {
    const mock = makeMockAgentCtx()
    const disposer = applyBuiltInToolDeny(mock, [])
    expect(mock.calls.length).toBe(0)
    disposer.dispose()
    expect(mock.liftCount()).toBe(0)
  })

  it('base tools are unchanged when builtin deny is empty', () => {
    const mock = makeMockAgentCtx()
    applyBuiltInToolDeny(mock, [])
    // No restrict() call means base tools are entirely unaffected
    expect(mock.calls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Sibling isolation test
// ---------------------------------------------------------------------------
describe('T2 Sibling isolation: Agent A deny vs Agent B no deny', () => {
  it('Agent B still sees bash when Agent A denies it', () => {
    const agentA = makeMockAgentCtx()
    const agentB = makeMockAgentCtx()

    // Agent A denies bash
    applyBuiltInToolDeny(agentA, ['bash'])
    // Agent B has no deny
    applyBuiltInToolDeny(agentB, [])

    // Agent A's context received the restrict call
    expect(agentA.calls.length).toBe(1)
    const firstCallA = agentA.calls[0]!
    expect(firstCallA.deny).toEqual(['bash'])

    // Agent B's context received no restrict call
    expect(agentB.calls.length).toBe(0)
  })

  it('disposing Agent A does not affect Agent B', () => {
    const agentA = makeMockAgentCtx()
    const agentB = makeMockAgentCtx()

    const disposerA = applyBuiltInToolDeny(agentA, ['bash'])
    const disposerB = applyBuiltInToolDeny(agentB, [])

    // Dispose Agent A
    disposerA.dispose()

    // Agent B is unaffected
    expect(agentB.calls.length).toBe(0)
    expect(() => disposerB.dispose()).not.toThrow()
  })

  it('deduplicates deny list before applying', () => {
    const mock = makeMockAgentCtx()
    applyBuiltInToolDeny(mock, ['bash', 'bash', 'write', 'bash'])
    expect(mock.calls.length).toBe(1)
    const firstCall = mock.calls[0]!
    expect(firstCall.deny).toEqual(['bash', 'write'])
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('T2 Edge cases', () => {
  it('empty allow list returns no tools', () => {
    const policy = { kind: 'allow' as const, items: [] }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected).toEqual([])
  })

  it('allow with all catalog names returns full catalog', () => {
    const policy = { kind: 'allow' as const, items: FULL_CATALOG.map((t) => t.name) }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected.map((t) => t.name)).toEqual(FULL_CATALOG.map((t) => t.name))
  })

  it('empty catalog returns empty array regardless of policy', () => {
    const policy = { kind: 'allow' as const, items: ['team_delegate'] }
    const selected = selectTeamTools([], policy)
    expect(selected).toEqual([])
  })

  it('deny policy ignores any extra fields', () => {
    const policy = { kind: 'deny' as const }
    const selected = selectTeamTools(FULL_CATALOG, policy)
    expect(selected).toEqual([])
  })
})
