/**
 * A5M2-B (root static-producer card) — the mutation plane's static facts
 * carry ONLY fs/exec-comparable rules. Narrow repros over the REAL
 * `createPermissionAuthorityFacts` seam (a4p7 minimal-deps pattern):
 *  A. mixed lanes: an invocation-only ask row (team_request_control, any)
 *     rides NO static fact while the fs allow row and the layer default
 *     answer exactly as before (the pre-fix world made the WHOLE layer
 *     refuse: static-rule-class-unknown → 87 EFFECT_CONTEXT_UNAVAILABLE →
 *     88 unhealthy call facts);
 *  B. a ctl-worker-shaped template (invocation rows only) yields a REAL
 *     declared layer with zero rules + its default — never an abstention;
 *  C. an UNKNOWN class still refuses closed (the reader abstains — the
 *     mutation grammar's fail-closed law is untouched).
 * No authorization surface moved: defaults, fs/exec rules (deny included)
 * and the unknown-class refusal are the assertions.
 */
import { describe, expect, it } from 'vitest'
import { createPermissionAuthorityFacts } from '../src/plugin/permission-plane.js'

const TEAM = 'team-a5m2b'
const MEMBER = 'inst-a5m2b'

function factsFor(permissions: Record<string, unknown>) {
  const blueprint = {
    leader: { templateId: 'worker-t', capabilities: { permissions } },
    members: [],
  }
  return createPermissionAuthorityFacts({
    resolveBlueprint: () => blueprint as never,
    memberTemplateId: () => 'worker-t',
    memberWorkspace: () => '/srv/a5m2b',
    canonicalize: async (path: string) => path,
  })
}

describe('a5m2-B static producer — invocation-only rows ride no fs/exec fact', () => {
  it('A · mixed lanes: the fs row and the default answer; the invocation row is inert input', async () => {
    const facts = factsFor({
      default: 'deny',
      allow: [{ tool: 'write', resource: { kind: 'exact', path: '/srv/a5m2b/f.txt' } }],
      ask: [{ tool: 'team_request_control', resource: { kind: 'any' } }],
      deny: [],
    })
    const layer = await facts.staticLayers(TEAM, MEMBER)
    expect(layer).toBeDefined()
    const rules = layer!.layers[0]!.rules
    expect(rules).toEqual([
      { operationClass: 'write', matcher: { kind: 'exact', resource: '/srv/a5m2b/f.txt' }, effect: 'allow' },
    ])
    expect(layer!.layers[0]!.default).toBe('deny')
  })

  it('B · invocation-only template: a declared layer with zero rules, never an abstention', async () => {
    const facts = factsFor({
      default: 'deny',
      allow: [],
      ask: [
        { tool: 'team_request_control', resource: { kind: 'any' } },
        { tool: 'team_resolve_control', resource: { kind: 'any' } },
        { tool: 'get_goal', resource: { kind: 'any' } },
      ],
      deny: [],
    })
    const layer = await facts.staticLayers(TEAM, MEMBER)
    expect(layer).toBeDefined()
    expect(layer!.layers[0]!.rules).toEqual([])
    expect(layer!.layers[0]!.default).toBe('deny')
  })

  it('C · an unknown class still refuses closed (the reader abstains)', async () => {
    const facts = factsFor({
      default: 'deny',
      allow: [],
      ask: [{ tool: 'bogus_class_tool', resource: { kind: 'any' } }],
      deny: [],
    })
    const layer = await facts.staticLayers(TEAM, MEMBER)
    expect(layer).toBeUndefined()
  })
})
