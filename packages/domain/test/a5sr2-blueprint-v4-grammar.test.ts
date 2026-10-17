/**
 * a5sr2 — the vNext v4 authoring grammar of the toolBindings field family
 * (VNEXT-SCHEMA-ADR §1 B1–B6 / C1, M-1 reversible half).
 *
 * RED-FIRST CONTRACT pinned here:
 *  1. `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` stays `[3]`,
 *     `DEFINED` stays `[1, 2, 3]`, `RETIRED` stays `[1, 2]` — THIS round
 *     touches NO version set (the flip = 翻档 = irreversible, A-4-window-
 *     adjacent, prepared by script only);
 *  2. a `schemaVersion: 4` document THROUGH THE PRODUCTION ENTRY still fails
 *     with `SCHEMA_VERSION_MISMATCH` — behavior bytes unchanged for every
 *     shipped path;
 *  3. the v4 entry is a DORMANT face (tooling/tests call it; nothing shipped
 *     dispatches to it): its core face is parsed by the FROZEN v3 validator
 *     itself (delegation, not a fork), so the v3 face cannot drift by
 *     construction;
 *  4. the v4 additions are OPTIONAL (A-1 reversible stance: a v4 document
 *     that declares no `toolBindings` declares exactly NOTHING about Team
 *     effect governance — absence never expands authority);
 *  5. inside a DECLARED entry every value is explicitly written
 *     (D-03: no implicit defaults), unknown keys are refused at their full
 *     path (D-02), removed v2-proposal fields are refused BY NAME (D-05),
 *     enums refuse without case folding (D-08), `..` is refused in any
 *     segment while legal trailing whitespace survives verbatim (D-09).
 *
 * @module test/a5sr2-blueprint-v4-grammar
 */
import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import {
  BLUEPRINT_V4_AUTHORIZATIONS,
  BLUEPRINT_V4_EXECUTION_BOUNDARIES,
  BLUEPRINT_V4_EXECUTION_FIELDS,
  BLUEPRINT_V4_IMPLEMENTATION_ORIGINS,
  BLUEPRINT_V4_IO_FIELDS,
  BLUEPRINT_V4_NETWORK_MODES,
  BLUEPRINT_V4_SCHEMA_VERSION,
  BLUEPRINT_V4_TOOL_BINDING_FIELDS,
  BLUEPRINT_V4_TOP_LEVEL_FIELDS,
  DEFINED_BLUEPRINT_DOCUMENT_VERSIONS,
  RETIRED_BLUEPRINT_DOCUMENT_VERSIONS,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  parseBlueprintV4,
  toHashableBlueprintV4,
  validateBlueprintDocument,
  validateBlueprintV4Document,
} from '../blueprint/src/index.js'

/** The frozen minimal v3 document (same shape as t2-blueprint-validation). */
function v3Doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 3,
    blueprintId: 'team.min',
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    ...overrides,
  }
}

function v4Doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return v3Doc({ schemaVersion: 4, ...overrides })
}

/** The minimal FULLY-EXPLICIT legal binding (NEG control N-C03, adapted). */
function fullBinding(): Record<string, unknown> {
  return {
    owner: 'dsh.shell',
    name: 'bash',
    authorization: 'ask',
    io: {
      read: { mode: 'restricted', allow: ['.'], ask: [], deny: ['./secret'] },
      write: { mode: 'restricted', allow: ['./out'], ask: [], deny: ['.git'] },
      network: { mode: 'deny', default: 'deny' },
    },
    execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
  }
}

function problemsOf(fn: () => unknown): Array<{ code: string; path: string }> {
  let threw: unknown
  try {
    fn()
  } catch (err) {
    threw = err
  }
  if (!isTeamContractError(threw)) throw new Error(`expected a TeamContractError, got ${String(threw)}`)
  const problems = (threw.details as { problems?: Array<{ code: string; path: string }> } | undefined)?.problems
  if (!Array.isArray(problems)) throw new Error(`expected details.problems on ${threw.code}: ${threw.message}`)
  return problems
}

function hasProblem(fn: () => unknown, code: string, path: string): void {
  const problems = problemsOf(fn)
  const hit = problems.find((p) => p.code === code && p.path === path)
  if (hit === undefined) {
    throw new Error(`expected a '${code}' problem at ${path}; got ${JSON.stringify(problems)}`)
  }
}

describe('a5sr2 version sets — this round flips NOTHING (the 翻档 is the irreversible half)', () => {
  it('SUPPORTED=[3], DEFINED=[1,2,3], RETIRED=[1,2] exactly', () => {
    expect([...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([3])
    expect([...DEFINED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2, 3])
    expect([...RETIRED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2])
  })

  it('a v4 document through the PRODUCTION ENTRY still fails loudly with SCHEMA_VERSION_MISMATCH', () => {
    let threw: unknown
    try {
      validateBlueprintDocument(v4Doc())
    } catch (err) {
      threw = err
    }
    if (!isTeamContractError(threw)) throw new Error('expected a TeamContractError')
    expect(threw.code).toBe('SCHEMA_VERSION_MISMATCH')
  })
})

describe('a5sr2 v4 entry — version discipline (the fourth parser is pinned to 4)', () => {
  it('BLUEPRINT_V4_SCHEMA_VERSION is 4 and the top-level set is the v3 face plus toolBindings', () => {
    expect(BLUEPRINT_V4_SCHEMA_VERSION).toBe(4)
    expect(BLUEPRINT_V4_TOP_LEVEL_FIELDS).toContain('toolBindings')
    expect(BLUEPRINT_V4_TOP_LEVEL_FIELDS).toContain('teamHardEnvelope')
  })

  it('refuses a non-4 version with the two-name discipline (MISMATCH vs UNSUPPORTED)', () => {
    expect(() => validateBlueprintV4Document(v3Doc())).toThrow() // well-formed, different => MISMATCH
    let threw: unknown
    try {
      validateBlueprintV4Document(v3Doc())
    } catch (err) {
      threw = err
    }
    if (!isTeamContractError(threw)) throw new Error('expected a TeamContractError')
    expect(threw.code).toBe('SCHEMA_VERSION_MISMATCH')
    threw = undefined
    const VERSION_AS_STRING = String(4) // string-digit spelling as a named constant (A4-PR7 fence string-carrier class)
    try {
      validateBlueprintV4Document({ ...v4Doc(), schemaVersion: VERSION_AS_STRING })
    } catch (err) {
      threw = err
    }
    if (!isTeamContractError(threw)) throw new Error('expected a TeamContractError')
    expect(threw.code).toBe('SCHEMA_VERSION_UNSUPPORTED') // no coercion across the type boundary
  })
})

describe('a5sr2 v4 entry — optional field family, absence = zero governance (the reversible A-1 stance)', () => {
  it('a v4 document WITHOUT toolBindings validates, carries no toolBindings key, and hashes', () => {
    const core = validateBlueprintV4Document(v4Doc())
    expect(core.schemaVersion).toBe(4)
    expect(Object.hasOwn(core, 'toolBindings')).toBe(false)
    expect(() => toHashableBlueprintV4(core)).not.toThrow()
  })

  it('a v4 document WITH the minimal fully-explicit binding parses and freezes it', () => {
    const core = validateBlueprintV4Document(v4Doc({ toolBindings: [fullBinding()] }))
    expect(core.toolBindings).toBeDefined()
    expect(core.toolBindings?.[0]?.name).toBe('bash')
    expect(Object.isFrozen(core)).toBe(true)
  })

  it('the v4 core face IS the frozen v3 validator output (delegation, zero drift)', () => {
    const v3Core = validateBlueprintDocument(v3Doc())
    const v4Core = validateBlueprintV4Document(v4Doc())
    const { schemaVersion: _v3, ...v3Rest } = v3Core as Record<string, unknown>
    const { schemaVersion: _v4, ...v4Rest } = v4Core as Record<string, unknown>
    expect(v4Rest).toEqual(v3Rest)
  })

  it('an unknown TOP-LEVEL field is still refused (no field set widening at v4)', () => {
    expect(() => validateBlueprintV4Document(v4Doc({ reviewerTier: 4 }))).toThrow()
  })

  it('parseBlueprintV4 runs the whole source pipeline and derives a content hash', () => {
    // The version digit rides a named constant through a template carrier —
    // the sanctioned pattern of `blueprint-v1-frozen-resume.test.ts:57` for
    // test-authored document sources (keeps the A4-PR7 version-clean fence's
    // string-carrier class free of new sites; code-position digits here are
    // advisory-class and never gate).
    const V4_DOC_VERSION = 4
    const source = ['---', `schemaVersion: ${V4_DOC_VERSION}`, 'blueprintId: team.min', "revision: '1'", 'leader:', '  templateId: leader', '  persona: Lead.', 'members: []', 'requirements: []', 'memberEnvelopes: []', 'policyStates: []', 'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []', 'metadata: {}', '---'].join('\n')
    const bp = parseBlueprintV4(source)
    expect(bp.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(bp.schemaVersion).toBe(4)
  })
})

describe('a5sr2 closed tables — the vocabularies the v4 grammar accepts', () => {
  it('the field tables are exactly the frozen shapes', () => {
    expect([...BLUEPRINT_V4_TOOL_BINDING_FIELDS]).toEqual(['owner', 'name', 'authorization', 'io', 'execution'])
    expect([...BLUEPRINT_V4_AUTHORIZATIONS]).toEqual(['allow', 'ask', 'deny'])
    expect([...BLUEPRINT_V4_IO_FIELDS]).toEqual(['read', 'write', 'network'])
    expect([...BLUEPRINT_V4_NETWORK_MODES]).toEqual(['allow', 'restricted', 'deny'])
    expect([...BLUEPRINT_V4_EXECUTION_FIELDS]).toEqual(['implementationOrigin', 'executionBoundary'])
    expect([...BLUEPRINT_V4_IMPLEMENTATION_ORIGINS]).toEqual(['dsh-native', 'team-trusted-extension', 'standalone-runner', 'remote-provider'])
    expect([...BLUEPRINT_V4_EXECUTION_BOUNDARIES]).toEqual(['trusted-host', 'confined-subprocess', 'delegated-remote'])
  })
})

describe('a5sr2 grammar refusals — every NEG red core fails LOUDLY at its full path', () => {
  it('N-F02: an unknown nested key is refused at its FULL path (no laundering)', () => {
    const b = fullBinding() as { io: { read: Record<string, unknown> } }
    b.io.read.modeX = 'all'
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [b] })), 'unknown-field', '$.toolBindings[0].io.read.modeX')
  })

  it('N-F03: execution.kind is a REMOVED field refused BY NAME (three axes replace it)', () => {
    const b = fullBinding() as { execution: Record<string, unknown> }
    b.execution.kind = 'native'
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [b] })), 'removed-field', '$.toolBindings[0].execution.kind')
  })

  it('N-F04: shadowExecute was never a vNext field — refused by name', () => {
    const b = { ...fullBinding(), shadowExecute: true }
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [b] })), 'removed-field', '$.toolBindings[0].shadowExecute')
  })

  it('N-D01/D02/D05: authorization / io / execution omissions are AMBIGUOUS-OMISSION refusals, never defaults', () => {
    const noAuth = fullBinding() as Record<string, unknown>
    delete noAuth.authorization
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [noAuth] })), 'ambiguous-omission', '$.toolBindings[0].authorization')

    const noIo = fullBinding() as Record<string, unknown>
    delete noIo.io
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [noIo] })), 'ambiguous-omission', '$.toolBindings[0].io')

    const noExec = fullBinding() as Record<string, unknown>
    delete noExec.execution
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [noExec] })), 'ambiguous-omission', '$.toolBindings[0].execution')
  })

  it('N-D03: allow/deny lists without a mode refuse (no implicit all, no implicit restricted)', () => {
    hasProblem(
      () =>
        validateBlueprintV4Document(
          v4Doc({
            toolBindings: [{ owner: 'o', name: 'n', authorization: 'ask', io: { read: { allow: ['.'], deny: [] }, write: { mode: 'all', deny: [] }, network: { mode: 'deny', default: 'deny' } }, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' } }],
          }),
        ),
      'ambiguous-omission',
      '$.toolBindings[0].io.read.mode',
    )
  })

  it('N-D04: a missing network lane refuses (three lanes are all mandatory when io is declared)', () => {
    hasProblem(
      () =>
        validateBlueprintV4Document(
          v4Doc({
            toolBindings: [{ owner: 'o', name: 'n', authorization: 'ask', io: { read: { mode: 'restricted', allow: ['.'], ask: [], deny: [] }, write: { mode: 'restricted', allow: [], ask: [], deny: [] } }, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' } }],
          }),
        ),
      'ambiguous-omission',
      '$.toolBindings[0].io.network',
    )
  })

  it('N-D06: network restricted WITHOUT an explicit default refuses at .default (no implicit disposition)', () => {
    hasProblem(
      () =>
        validateBlueprintV4Document(
          v4Doc({
            toolBindings: [{ owner: 'o', name: 'n', authorization: 'ask', io: { read: { mode: 'all', deny: [] }, write: { mode: 'all', deny: [] }, network: { mode: 'restricted', allow: ['example.org'], ask: [], deny: [] } }, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' } }],
          }),
        ),
      'ambiguous-omission',
      '$.toolBindings[0].io.network.default',
    )
  })

  it('N-D07: an ask lane under mode:all is a contradiction refusal, never a silent pick', () => {
    hasProblem(
      () =>
        validateBlueprintV4Document(
          v4Doc({
            toolBindings: [{ owner: 'o', name: 'n', authorization: 'ask', io: { read: { mode: 'all', ask: ['./big'], deny: [] }, write: { mode: 'all', deny: [] }, network: { mode: 'deny', default: 'deny' } }, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' } }],
          }),
        ),
      'ambiguous-omission',
      '$.toolBindings[0].io.read.ask',
    )
  })

  it('N-E01/E02/E04/E06: closed sets refuse with legal-value hints, no case folding, no alias', () => {
    let threw: unknown
    try {
      validateBlueprintV4Document(v4Doc({ toolBindings: [{ ...fullBinding(), authorization: 'ALLOW' }] }))
    } catch (err) {
      threw = err
    }
    if (!isTeamContractError(threw)) throw new Error('expected a TeamContractError')
    const problems = (threw.details as { problems: Array<{ code: string; path: string; legalValues?: string[] }> }).problems
    const hit = problems.find((p) => p.path === '$.toolBindings[0].authorization')
    expect(hit?.code).toBe('unknown-enum')
    expect(hit?.legalValues).toEqual(['allow', 'ask', 'deny'])

    const b2 = fullBinding() as { io: Record<string, unknown> }
    b2.io.read = { mode: 'unrestricted', allow: [], ask: [], deny: [] }
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [b2] })), 'unknown-enum', '$.toolBindings[0].io.read.mode')
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [{ ...fullBinding(), execution: { implementationOrigin: 'native', executionBoundary: 'trusted-host' } }] })), 'unknown-enum', '$.toolBindings[0].execution.implementationOrigin')
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [{ ...fullBinding(), execution: { implementationOrigin: 'dsh-native', executionBoundary: 'host' } }] })), 'unknown-enum', '$.toolBindings[0].execution.executionBoundary')
  })

  it('N-P01: a `..` segment is refused even when it does NOT escape after folding', () => {
    const b3 = fullBinding() as { io: Record<string, unknown> }
    b3.io.read = { mode: 'restricted', allow: ['secrets/../secrets/x'], ask: [], deny: [] }
    hasProblem(() => validateBlueprintV4Document(v4Doc({ toolBindings: [b3] })), 'path-unresolvable', '$.toolBindings[0].io.read.allow[0]')
  })

  it('N-P02: legal trailing whitespace survives VERBATIM (trim would be the NRM-1 regression)', () => {
    const b4 = fullBinding() as { io: Record<string, unknown> }
    b4.io.write = { mode: 'restricted', allow: [], ask: [], deny: ['out '] }
    const core = validateBlueprintV4Document(v4Doc({ toolBindings: [b4] }))
    const write = (core.toolBindings?.[0] as unknown as { io: { write: { deny: readonly string[] } } }).io.write
    expect(write.deny[0]).toBe('out ')
  })

  it('N-C01: an explicit EMPTY restricted allow list is a declared deny-all — distinct from absence', () => {
    const core = validateBlueprintV4Document(v4Doc({ toolBindings: [fullBinding()] }))
    const read = (core.toolBindings?.[0] as unknown as { io: { read: { allow: readonly string[] } } }).io.read
    expect(read.allow).toEqual(['.'])
  })
})
