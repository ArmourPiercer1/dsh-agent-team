/**
 * alpha.2 A1 — Blueprint capabilities.permissions schema: the optional
 * static permission policy (default ask|deny + allow/ask/deny rule lanes
 * with exact/any resources).
 *
 * Pins the plan §6.5 minimum plus the deterministic-normalization
 * contract:
 *
 * - legacy / alpha.1 blueprints (permissions ABSENT) parse and project
 *   EXACTLY as before A1 (no `permissions` key anywhere in the hashable
 *   projection → byte-identical legacy content hashes);
 * - `default` is required and restricted to `ask` | `deny` (`allow` is
 *   rejected — no silent privilege expansion);
 * - `allow` / `ask` / `deny` are required arrays (may be empty);
 * - unknown fields reject at all three levels (policy, rule, resource);
 * - unsupported tools reject; resource.kind is a closed vocabulary
 *   (`exact` | `any` — no `subtree` in A1); `exact.path` is a non-empty
 *   string; `any` carries no field other than `kind`;
 * - the content hash changes when permissions are added / changed /
 *   removed, and identical permissions (modulo YAML key order) hash
 *   identically;
 * - duplicate normalization is DETERMINISTIC: rules are kept in
 *   declaration order (no reordering, no de-duplication, no cross-lane
 *   movement); duplicates are preserved; `exact.path` is trimmed
 *   (repo string-field normalization); the normalized policy and the
 *   content hash are pure functions of the source document.
 *
 * Matcher surface: the plain-node shim (scripts/run-tests.mjs) supports
 * toBe / toEqual / toBeGreaterThan / toThrow (and .not) — this suite uses
 * only those, plus the t2-helpers code/detail assertions.
 *
 * @module @dsh-agent-team/domain/test/a1-permission-policy
 */

import { describe, expect, it } from 'vitest'

import {
  PERMISSION_PATH_MAX_LENGTH,
  PERMISSION_POLICY_DEFAULTS,
  PERMISSION_POLICY_FIELDS,
  PERMISSION_RESOURCE_KINDS,
  PERMISSION_RULE_FIELDS,
  PERMISSION_TOOL_NAMES,
  parseBlueprint,
  toHashableBlueprint,
} from '../blueprint/src/index.js'
import type {
  PermissionRule,
  TemplatePermissionPolicy,
} from '../blueprint/src/index.js'
import type { RemoteSafeRecord } from '../../contracts/src/remote-safe.js'
import {
  MINIMAL_BLUEPRINT_SOURCE,
  NEG_PERMISSION_ANY_EXTRA_FIELD,
  NEG_PERMISSION_ANY_WITH_PATH,
  NEG_PERMISSION_DEFAULT_ALLOW,
  NEG_PERMISSION_DEFAULT_MISSING,
  NEG_PERMISSION_DEFAULT_NOT_STRING,
  NEG_PERMISSION_EXACT_EMPTY_PATH,
  NEG_PERMISSION_EXACT_EXTRA_FIELD,
  NEG_PERMISSION_EXACT_MISSING_PATH,
  NEG_PERMISSION_LANE_MISSING,
  NEG_PERMISSION_LANE_NOT_ARRAY,
  NEG_PERMISSION_POLICY_UNKNOWN_FIELD,
  NEG_PERMISSION_RESOURCE_UNKNOWN_KIND,
  NEG_PERMISSION_RULE_MISSING_RESOURCE,
  NEG_PERMISSION_RULE_MISSING_TOOL,
  NEG_PERMISSION_RULE_UNKNOWN_FIELD,
  NEG_PERMISSION_UNKNOWN_TOOL,
  PERMISSION_SOURCE_ASK,
  PERMISSION_SOURCE_ASK_KEY_SHUFFLED,
  PERMISSION_SOURCE_BASH_ANY,
  PERMISSION_SOURCE_DENY,
  PERMISSION_SOURCE_DUPLICATES,
  PERMISSION_SOURCE_NO_POLICY,
} from '../blueprint/testdata/fixtures.js'
import { expectCode, expectErrorDetails, isDeepFrozen } from './t2-helpers.js'

/** The expected normalized policy of `PERMISSION_SOURCE_ASK`. */
const EXPECTED_ASK_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [
    { tool: 'read', resource: { kind: 'exact', path: '/data/notes.md' } },
    { tool: 'bash', resource: { kind: 'any' } },
  ],
  ask: [{ tool: 'write', resource: { kind: 'exact', path: '/data/notes.md' } }],
  deny: [{ tool: 'lsp', resource: { kind: 'any' } }],
}

/** Read the leader's normalized permission policy (fails the test if absent). */
function policyOf(source: string): TemplatePermissionPolicy {
  const blueprint = parseBlueprint(source)
  const caps = blueprint.leader.capabilities
  if (caps === undefined || caps.permissions === undefined) {
    throw new Error('expected the leader capabilities to carry a permissions policy')
  }
  return caps.permissions
}

describe('A1: legacy / alpha.1 behavior is completely unchanged', () => {
  it('legacy blueprint parses with no capabilities at all', () => {
    const blueprint = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(blueprint.leader.capabilities).toBe(undefined)
    expect(isDeepFrozen(blueprint)).toBe(true)
  })

  it('capabilities WITHOUT permissions parse (permissions omitted works)', () => {
    const blueprint = parseBlueprint(PERMISSION_SOURCE_NO_POLICY)
    const caps = blueprint.leader.capabilities
    expect(caps !== undefined).toBe(true)
    expect(caps!.permissions).toBe(undefined)
    // The four alpha.1 sub-fields are untouched.
    expect(caps!.teamTools).toEqual({ kind: 'allow', items: [] })
    expect(caps!.builtinToolDeny).toEqual([])
    expect(caps!.skills).toEqual({ kind: 'allow', items: [] })
    expect(caps!.mcp).toEqual({ kind: 'allow', items: [] })
  })

  it('absent permissions leave the hashable projection byte-identical (legacy 4 keys only)', () => {
    const hashable = toHashableBlueprint(parseBlueprint(PERMISSION_SOURCE_NO_POLICY))
    const leader = hashable.leader as RemoteSafeRecord
    const caps = leader.capabilities as RemoteSafeRecord
    // Exactly the alpha.1 key set — no `permissions` key present at all.
    expect(Object.keys(caps).sort()).toEqual(['builtinToolDeny', 'mcp', 'skills', 'teamTools'])
    // Deterministic legacy hash across re-parses.
    expect(parseBlueprint(PERMISSION_SOURCE_NO_POLICY).contentHash).toBe(
      parseBlueprint(PERMISSION_SOURCE_NO_POLICY).contentHash,
    )
  })
})

describe('A1: positive parses (default ask | deny, exact/any resources)', () => {
  it('default: ask parses into the normalized policy (deep-frozen)', () => {
    const blueprint = parseBlueprint(PERMISSION_SOURCE_ASK)
    expect(blueprint.leader.capabilities!.permissions).toEqual(EXPECTED_ASK_POLICY)
    expect(isDeepFrozen(blueprint)).toBe(true)
  })

  it('default: deny parses', () => {
    const policy = policyOf(PERMISSION_SOURCE_DENY)
    expect(policy.default).toBe('deny')
    expect(policy.allow).toEqual([
      { tool: 'read', resource: { kind: 'exact', path: '/data/notes.md' } },
    ])
    expect(policy.ask).toEqual([])
    expect(policy.deny).toEqual([])
  })

  it('the minimal shell permission parses: bash at tool level via resource any', () => {
    const policy = policyOf(PERMISSION_SOURCE_BASH_ANY)
    expect(policy.default).toBe('ask')
    expect(policy.allow).toEqual([])
    expect(policy.ask).toEqual([])
    expect(policy.deny).toEqual([{ tool: 'bash', resource: { kind: 'any' } }])
  })

  it('a MEMBER template can carry its own permissions (per-template scope)', () => {
    const source = [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.min',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      'members:',
      '  - templateId: helper',
      '    persona: "Helps."',
      '    capabilities:',
      '      teamTools:',
      '        kind: allow',
      '        items: []',
      '      builtinToolDeny: []',
      '      skills:',
      '        kind: allow',
      '        items: []',
      '      mcp:',
      '        kind: allow',
      '        items: []',
      '      permissions:',
      '        default: deny',
      '        allow:',
      '          - tool: read_image',
      '            resource:',
      '              kind: exact',
      '              path: "/img/a.png"',
      '        ask:',
      '          - tool: edit',
      '            resource:',
      '              kind: any',
      '        deny: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const blueprint = parseBlueprint(source)
    expect(blueprint.leader.capabilities).toBe(undefined)
    const [member] = blueprint.members
    const memberPolicy = member!.capabilities!.permissions
    expect(memberPolicy).toEqual({
      default: 'deny',
      allow: [{ tool: 'read_image', resource: { kind: 'exact', path: '/img/a.png' } }],
      ask: [{ tool: 'edit', resource: { kind: 'any' } }],
      deny: [],
    })
  })

  it('exact.path is trimmed on normalization (repo string-field rule)', () => {
    const source = [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.min',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  capabilities:',
      '    teamTools:',
      '      kind: allow',
      '      items: []',
      '    builtinToolDeny: []',
      '    skills:',
      '      kind: allow',
      '      items: []',
      '    mcp:',
      '      kind: allow',
      '      items: []',
      '    permissions:',
      '      default: ask',
      '      allow:',
      '        - tool: read',
      '          resource:',
      '            kind: exact',
      '            path: " /a.txt "',
      '      ask: []',
      '      deny: []',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const policy = policyOf(source)
    expect(policy.allow).toEqual([{ tool: 'read', resource: { kind: 'exact', path: '/a.txt' } }])
  })
})

describe('A1: validation rejections (closed schema, fail loudly)', () => {
  it('default: allow rejects (no silent privilege expansion)', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_DEFAULT_ALLOW.source),
      'MALFORMED_DTO',
      { path: '$.leader.capabilities.permissions.default' },
    )
  })

  it('missing default rejects', () => {
    expectCode(
      () => parseBlueprint(NEG_PERMISSION_DEFAULT_MISSING.source),
      'MALFORMED_DTO',
    )
  })

  it('non-string default rejects', () => {
    expectCode(() => parseBlueprint(NEG_PERMISSION_DEFAULT_NOT_STRING.source), 'MALFORMED_DTO')
  })

  it('a missing required lane (allow) rejects', () => {
    expectCode(() => parseBlueprint(NEG_PERMISSION_LANE_MISSING.source), 'MALFORMED_DTO')
  })

  it('a non-array lane rejects', () => {
    expectCode(() => parseBlueprint(NEG_PERMISSION_LANE_NOT_ARRAY.source), 'MALFORMED_DTO')
  })

  it('an unknown field on the policy rejects', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_POLICY_UNKNOWN_FIELD.source),
      'MALFORMED_DTO',
      { unknownFields: ['allowAll'] },
    )
  })

  it('an unknown field on a rule rejects', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_RULE_UNKNOWN_FIELD.source),
      'MALFORMED_DTO',
      { unknownFields: ['note'] },
    )
  })

  it('a rule missing its tool rejects', () => {
    expectCode(
      () => parseBlueprint(NEG_PERMISSION_RULE_MISSING_TOOL.source),
      'MALFORMED_DTO',
    )
  })

  it('a rule missing its resource rejects', () => {
    expectCode(
      () => parseBlueprint(NEG_PERMISSION_RULE_MISSING_RESOURCE.source),
      'MALFORMED_DTO',
    )
  })

  it('an unsupported tool rejects', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_UNKNOWN_TOOL.source),
      'MALFORMED_DTO',
      { path: '$.leader.capabilities.permissions.allow[0].tool' },
    )
  })

  it('a resource kind outside the closed vocabulary rejects (subtree is not A1)', () => {
    expectCode(
      () => parseBlueprint(NEG_PERMISSION_RESOURCE_UNKNOWN_KIND.source),
      'MALFORMED_DTO',
    )
  })

  it('exact without a path rejects', () => {
    expectCode(
      () => parseBlueprint(NEG_PERMISSION_EXACT_MISSING_PATH.source),
      'MALFORMED_DTO',
    )
  })

  it('an empty exact path rejects', () => {
    expectCode(
      () => parseBlueprint(NEG_PERMISSION_EXACT_EMPTY_PATH.source),
      'MALFORMED_DTO',
    )
  })

  it('an exact resource carrying extra fields rejects', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_EXACT_EXTRA_FIELD.source),
      'MALFORMED_DTO',
      { unknownFields: ['glob'] },
    )
  })

  it('any with a path rejects', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_ANY_WITH_PATH.source),
      'MALFORMED_DTO',
      { extraFields: ['path'] },
    )
  })

  it('any with another extra field rejects', () => {
    expectErrorDetails(
      () => parseBlueprint(NEG_PERMISSION_ANY_EXTRA_FIELD.source),
      'MALFORMED_DTO',
      { extraFields: ['scope'] },
    )
  })

  it('a rule over a path longer than the structural bound rejects', () => {
    const longPath = `/x/${'y'.repeat(PERMISSION_PATH_MAX_LENGTH)}`
    const source = [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.min',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  capabilities:',
      '    teamTools:',
      '      kind: allow',
      '      items: []',
      '    builtinToolDeny: []',
      '    skills:',
      '      kind: allow',
      '      items: []',
      '    mcp:',
      '      kind: allow',
      '      items: []',
      '    permissions:',
      '      default: ask',
      '      allow:',
      `        - tool: read`,
      '          resource:',
      '            kind: exact',
      `            path: "${longPath}"`,
      '      ask: []',
      '      deny: []',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    expectCode(() => parseBlueprint(source), 'MALFORMED_DTO')
  })
})

describe('A1: content hash binds to the permissions policy', () => {
  it('changes when permissions are ADDED (legacy vs present)', () => {
    const legacy = parseBlueprint(PERMISSION_SOURCE_NO_POLICY)
    const withAsk = parseBlueprint(PERMISSION_SOURCE_ASK)
    expect(legacy.contentHash).not.toBe(withAsk.contentHash)
  })

  it('changes when permissions are CHANGED (default ask -> deny)', () => {
    const ask = parseBlueprint(PERMISSION_SOURCE_ASK)
    const deny = parseBlueprint(PERMISSION_SOURCE_DENY)
    expect(ask.contentHash).not.toBe(deny.contentHash)
  })

  it('changes when permissions are REMOVED (present -> legacy)', () => {
    // Symmetric pin of the ADDED case: removing the policy returns to the
    // legacy hash (and only the legacy hash).
    const withBash = parseBlueprint(PERMISSION_SOURCE_BASH_ANY)
    const legacy = parseBlueprint(PERMISSION_SOURCE_NO_POLICY)
    expect(withBash.contentHash).not.toBe(legacy.contentHash)
    expect(legacy.contentHash).toBe(
      parseBlueprint(PERMISSION_SOURCE_NO_POLICY).contentHash,
    )
  })

  it('changes when a rule moves between lanes (declaration order is content)', () => {
    const askLane = parseBlueprint(PERMISSION_SOURCE_ASK) // write-exact in ask
    const movedToDeny = parseBlueprint([
      '---',
      'schemaVersion: 1',
      'blueprintId: team.min',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "Lead."',
      '  capabilities:',
      '    teamTools:',
      '      kind: allow',
      '      items: []',
      '    builtinToolDeny: []',
      '    skills:',
      '      kind: allow',
      '      items: []',
      '    mcp:',
      '      kind: allow',
      '      items: []',
      '    permissions:',
      '      default: ask',
      '      allow:',
      '        - tool: read',
      '          resource:',
      '            kind: exact',
      '            path: "/data/notes.md"',
      '        - tool: bash',
      '          resource:',
      '            kind: any',
      '      ask: []',
      '      deny:',
      '        - tool: write',
      '          resource:',
      '            kind: exact',
      '            path: "/data/notes.md"',
      '        - tool: lsp',
      '          resource:',
      '            kind: any',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n'))
    expect(askLane.contentHash).not.toBe(movedToDeny.contentHash)
  })

  it('identical permissions (re-parse) hash identically', () => {
    expect(parseBlueprint(PERMISSION_SOURCE_ASK).contentHash).toBe(
      parseBlueprint(PERMISSION_SOURCE_ASK).contentHash,
    )
  })

  it('identical permissions with shuffled YAML key order hash identically', () => {
    expect(parseBlueprint(PERMISSION_SOURCE_ASK_KEY_SHUFFLED).contentHash).toBe(
      parseBlueprint(PERMISSION_SOURCE_ASK).contentHash,
    )
    // ...and normalize to the same structure.
    expect(policyOf(PERMISSION_SOURCE_ASK_KEY_SHUFFLED)).toEqual(EXPECTED_ASK_POLICY)
  })
})

describe('A1: duplicate normalization is deterministic', () => {
  // Deterministic normalization, precisely: rules are KEPT IN DECLARATION
  // ORDER — no reordering, no de-duplication, no cross-lane movement.
  // Duplicate rules are legal and preserved; exact.path is trimmed (repo
  // string-field normalization); the normalized object is a fresh plain
  // copy whose shape and ordering are a pure function of the source.

  it('duplicate rules are preserved in declaration order (no de-dup, no reorder)', () => {
    const policy = policyOf(PERMISSION_SOURCE_DUPLICATES)
    const rule: PermissionRule = {
      tool: 'read',
      resource: { kind: 'exact', path: '/a.txt' },
    }
    // Both duplicates survive in the allow lane, in declaration order.
    expect(policy.allow.length).toBe(2)
    expect(policy.allow).toEqual([rule, rule])
    // The same rule in another lane is legal too.
    expect(policy.ask).toEqual([rule])
    expect(policy.deny).toEqual([])
    expect(policy.default).toBe('ask')
  })

  it('re-parsing yields a structurally identical normalized policy (pure function)', () => {
    const first = policyOf(PERMISSION_SOURCE_DUPLICATES)
    const second = policyOf(PERMISSION_SOURCE_DUPLICATES)
    expect(second).toEqual(first)
    // The hashable projection is identical too (hash pure function).
    expect(toHashableBlueprint(parseBlueprint(PERMISSION_SOURCE_DUPLICATES))).toEqual(
      toHashableBlueprint(parseBlueprint(PERMISSION_SOURCE_DUPLICATES)),
    )
  })

  it('reordering rules in the source changes the hash (order is content)', () => {
    // The same two rules (distinct paths) in swapped declaration order:
    // the normalized lanes keep source order, so the hashable projection
    // (canonical JSON: object keys sorted, ARRAY order preserved) differs.
    const make = (firstPath: string, secondPath: string): string =>
      [
        '---',
        'schemaVersion: 1',
        'blueprintId: team.min',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        '  capabilities:',
        '    teamTools:',
        '      kind: allow',
        '      items: []',
        '    builtinToolDeny: []',
        '    skills:',
        '      kind: allow',
        '      items: []',
        '    mcp:',
        '      kind: allow',
        '      items: []',
        '    permissions:',
        '      default: ask',
        '      allow:',
        '        - tool: read',
        '          resource:',
        '            kind: exact',
        `            path: "${firstPath}"`,
        '        - tool: read',
        '          resource:',
        '            kind: exact',
        `            path: "${secondPath}"`,
        '      ask: []',
        '      deny: []',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n')
    expect(parseBlueprint(make('/p1', '/p2')).contentHash).not.toBe(
      parseBlueprint(make('/p2', '/p1')).contentHash,
    )
    // ...while the SAME order parses identically.
    expect(parseBlueprint(make('/p1', '/p2')).contentHash).toBe(
      parseBlueprint(make('/p1', '/p2')).contentHash,
    )
  })
})

describe('A1: export surface for A3 (resolver) and A5 (adapter)', () => {
  it('PERMISSION_TOOL_NAMES pins the six closed tool names', () => {
    expect(PERMISSION_TOOL_NAMES).toEqual([
      'read',
      'read_image',
      'write',
      'edit',
      'lsp',
      'bash',
    ])
  })

  it('PERMISSION_POLICY_DEFAULTS pins ask|deny (no allow)', () => {
    expect(PERMISSION_POLICY_DEFAULTS).toEqual(['ask', 'deny'])
  })

  it('PERMISSION_RESOURCE_KINDS pins the closed kind vocabulary (no subtree)', () => {
    expect(PERMISSION_RESOURCE_KINDS).toEqual(['exact', 'any'])
  })

  it('PERMISSION_RULE_FIELDS / PERMISSION_POLICY_FIELDS pin the closed field sets', () => {
    expect(PERMISSION_RULE_FIELDS).toEqual(['tool', 'resource'])
    expect(PERMISSION_POLICY_FIELDS).toEqual(['default', 'allow', 'ask', 'deny'])
  })
})
