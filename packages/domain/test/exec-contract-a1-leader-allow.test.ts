/**
 * exec-autonomy-contract (user ruling 2026-09-18) — the LEADER-scoped
 * allow-lane shell-class exception in the blueprint validation contract.
 *
 * The user directive: "允许exec类工具（bash, pwsh）放入leader的allow与
 * mutation envelope" — refined through clarification:
 *
 * - the LEADER template's `allow` lane MAY carry a shell-class rule with
 *   the whole-tool `any` resource (an explicit, declared exec
 *   authorization — there is NO implicit default-allow: an absent rule
 *   still resolves to `policy.default`);
 * - MEMBER templates keep the A2C-1 contract verbatim: the allow lane
 *   rejects shell-class rules, and the diagnostics stay BYTE-IDENTICAL
 *   to the pre-change (leader) pin text;
 * - `exact` / `subtree` shell-class resources are rejected in EVERY
 *   lane of EVERY role (no parameter-level shell matcher — unchanged);
 * - `default: allow` stays rejected (no silent privilege expansion —
 *   unchanged);
 * - `bash authority != pwsh authority`: each tool is gated by its own
 *   rule (unchanged).
 *
 * The runtime side of the contract (the mutation-envelope DUAL GATE — a
 * leader exec ALLOW stands only when the leader's effective envelope
 * carries the matching exec token, else it downgrades to the
 * user-approval ask path) is pinned in
 * packages/runtime/test/exec-contract-dual-gate.test.ts.
 *
 * Matcher surface: the plain-node shim (scripts/run-tests.mjs) supports
 * toBe / toEqual / toThrow (and .not) — this suite uses only those, plus
 * the t2-helpers code/detail assertions.
 *
 * @module @dsh-agent-team/domain/test/exec-contract-a1-leader-allow
 */

import { describe, expect, it } from 'vitest'

import { parseBlueprint } from '../blueprint/src/index.js'
import { expectCode, expectErrorDetails } from './t2-helpers.js'

// ── source builders (self-contained; mirror the a1-permission-policy
//    test conventions) ─────────────────────────────────────────────────

const CAPABILITIES_LEADER: string[] = [
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
]

function permissionLines(lane: 'allow' | 'ask' | 'deny', ruleLines: string[]): string[] {
  const laneOf = (name: 'allow' | 'ask' | 'deny'): string[] => {
    if (name !== lane) return [`      ${name}: []`]
    if (ruleLines.length === 0) return [`      ${name}: []`]
    return [`      ${name}:`, ...ruleLines]
  }
  return [
    '    permissions:',
    '      default: ask',
    ...laneOf('allow'),
    ...laneOf('ask'),
    ...laneOf('deny'),
  ]
}

const RULE_ANY = (tool: string): string[] => [
  '        - tool: ' + tool,
  '          resource:',
  '            kind: any',
]

const RULE_EXACT = (tool: string, path: string): string[] => [
  '        - tool: ' + tool,
  '          resource:',
  '            kind: exact',
  `            path: "${path}"`,
]

const RULE_SUBTREE = (tool: string, path: string): string[] => [
  '        - tool: ' + tool,
  '          resource:',
  '            kind: subtree',
  `            path: "${path}"`,
]

/** A blueprint whose LEADER template carries shell-class rule(s) in the
 * given lane. */
function leaderSource(lane: 'allow' | 'ask' | 'deny', ruleLines: string[]): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: exec.contract',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    ...CAPABILITIES_LEADER,
    ...permissionLines(lane, ruleLines),
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** A blueprint whose MEMBER (worker) template carries ONE shell-class
 * rule in the given lane. */
function memberSource(lane: 'allow' | 'ask' | 'deny', ruleLines: string[]): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: exec.contract',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members:',
    '  - templateId: worker',
    '    persona: "Worker."',
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
    '        default: ask',
    ...(lane === 'allow'
      ? ['        allow:', ...ruleLines.map((l) => '  ' + l), '        ask: []', '        deny: []']
      : lane === 'ask'
        ? ['        allow: []', '        ask:', ...ruleLines.map((l) => '  ' + l), '        deny: []']
        : ['        allow: []', '        ask: []', '        deny:', ...ruleLines.map((l) => '  ' + l)]),
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

describe('exec-autonomy-contract: the leader allow-lane shell-class exception', () => {
  it('leader: bash + any in the allow lane PARSES (the explicit whole-tool exec authorization)', () => {
    const blueprint = parseBlueprint(leaderSource('allow', RULE_ANY('bash')))
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.allow).toEqual([{ tool: 'bash', resource: { kind: 'any' } }])
    expect(policy.ask).toEqual([])
    expect(policy.deny).toEqual([])
  })

  it('leader: pwsh + any in the allow lane PARSES (separate tool, separate rule)', () => {
    const blueprint = parseBlueprint(leaderSource('allow', RULE_ANY('pwsh')))
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.allow).toEqual([{ tool: 'pwsh', resource: { kind: 'any' } }])
  })

  it('leader: bash and pwsh allow-lane rules coexist (bash authority != pwsh authority)', () => {
    const blueprint = parseBlueprint(
      leaderSource('allow', [...RULE_ANY('bash'), ...RULE_ANY('pwsh')]),
    )
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.allow).toEqual([
      { tool: 'bash', resource: { kind: 'any' } },
      { tool: 'pwsh', resource: { kind: 'any' } },
    ])
  })

  it('leader: a file-tool allow rule and a bash allow rule mix in one lane', () => {
    const blueprint = parseBlueprint(
      leaderSource('allow', [
        ...RULE_EXACT('read', '/data/notes.md'),
        ...RULE_ANY('bash'),
      ]),
    )
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.allow).toEqual([
      { tool: 'read', resource: { kind: 'exact', path: '/data/notes.md' } },
      { tool: 'bash', resource: { kind: 'any' } },
    ])
  })

  it('leader: bash + any in the ask lane still PARSES (the minimal shell permission is unchanged)', () => {
    const blueprint = parseBlueprint(leaderSource('ask', RULE_ANY('bash')))
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.ask).toEqual([{ tool: 'bash', resource: { kind: 'any' } }])
  })

  it('leader: bash + any in the deny lane still PARSES (unchanged)', () => {
    const blueprint = parseBlueprint(leaderSource('deny', RULE_ANY('bash')))
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.deny).toEqual([{ tool: 'bash', resource: { kind: 'any' } }])
  })

  it('NO implicit default-allow: `default: allow` stays REJECTED for the leader (no silent privilege expansion — unchanged)', () => {
    const badDefault = [
      '---',
      'schemaVersion: 1',
      'blueprintId: exec.contract',
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
      '      default: allow',
      '      allow: []',
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
    const defaultErr = expectCode(() => parseBlueprint(badDefault), 'MALFORMED_DTO')
    expect(
      defaultErr.message.includes(
        "permission policy $.leader.capabilities.permissions.default must be one of ask | deny (a default of 'allow' is rejected: no silent privilege expansion)",
      ),
    ).toBe(true)
  })

  it('leader: an ABSENT exec rule resolves to the policy default (ask — the no-expansion baseline is unchanged)', () => {
    const blueprint = parseBlueprint(leaderSource('allow', []))
    const policy = blueprint.leader.capabilities!.permissions!
    expect(policy.default).toBe('ask')
    expect(policy.allow).toEqual([])
  })
})

describe('exec-autonomy-contract: the member contract is UNCHANGED (A2C-1 verbatim)', () => {
  it('member: bash + any in the allow lane REJECTS with the BYTE-IDENTICAL pre-change diagnostic', () => {
    const err = expectErrorDetails(
      () => parseBlueprint(memberSource('allow', RULE_ANY('bash'))),
      'MALFORMED_DTO',
      { path: '$.members[0].capabilities.permissions.allow[0].resource.kind', lane: 'allow' },
    )
    expect(err.message).toBe(
      "permission rule $.members[0].capabilities.permissions.allow[0] (lane 'allow') is rejected: " +
        'alpha.2 grants no positive whole-tool permission for bash — the allow lane must not ' +
        'carry a bash rule (no parameter-level allow for shell commands; use the ask or deny ' +
        'lane for { tool: bash, resource: { kind: \'any\' } })',
    )
  })

  it('member: pwsh + any in the allow lane REJECTS with the A2C-1 pwsh diagnostic (byte-identical)', () => {
    const err = expectErrorDetails(
      () => parseBlueprint(memberSource('allow', RULE_ANY('pwsh'))),
      'MALFORMED_DTO',
      { path: '$.members[0].capabilities.permissions.allow[0].resource.kind', lane: 'allow' },
    )
    expect(err.message).toBe(
      "permission rule $.members[0].capabilities.permissions.allow[0] (lane 'allow') is rejected: " +
        'alpha.2 grants no positive whole-tool permission for pwsh — the allow lane must not ' +
        'carry a pwsh rule (no parameter-level allow for shell commands; use the ask or deny ' +
        'lane for { tool: pwsh, resource: { kind: \'any\' } })',
    )
  })

  it('member: bash + any in the ask lane still PARSES (unchanged)', () => {
    const blueprint = parseBlueprint(memberSource('ask', RULE_ANY('bash')))
    const member = blueprint.members[0]
    expect(member !== undefined).toBe(true)
    expect(member!.capabilities!.permissions!.ask).toEqual([
      { tool: 'bash', resource: { kind: 'any' } },
    ])
  })
})

describe('exec-autonomy-contract: the parameter-level rejections hold for EVERY role', () => {
  for (const tool of ['bash', 'pwsh'] as const) {
    for (const lane of ['allow', 'ask', 'deny'] as const) {
      it(`leader: ${tool} + exact in the ${lane} lane REJECTS (unchanged)`, () => {
        expectCode(
          () => parseBlueprint(leaderSource(lane, RULE_EXACT(tool, '/bin'))),
          'MALFORMED_DTO',
        )
      })

      it(`member: ${tool} + exact in the ${lane} lane REJECTS (unchanged)`, () => {
        expectCode(
          () => parseBlueprint(memberSource(lane, RULE_EXACT(tool, '/bin'))),
          'MALFORMED_DTO',
        )
      })

      it(`leader: ${tool} + subtree in the ${lane} lane REJECTS (unchanged)`, () => {
        expectCode(
          () => parseBlueprint(leaderSource(lane, RULE_SUBTREE(tool, '/data'))),
          'MALFORMED_DTO',
        )
      })

      it(`member: ${tool} + subtree in the ${lane} lane REJECTS (unchanged)`, () => {
        expectCode(
          () => parseBlueprint(memberSource(lane, RULE_SUBTREE(tool, '/data'))),
          'MALFORMED_DTO',
        )
      })
    }
  }
})
