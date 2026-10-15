/**
 * P3-T2 — parsing: frontmatter splitting, YAML decoding, and the
 * `parseBlueprint` pipeline on the valid fixtures.
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-parse
 */

import { describe, expect, it } from 'vitest'

import {
  decodeYamlFrontmatter,
  parseBlueprint,
  splitFrontmatter,
  inspectBlueprintSource,
} from '../blueprint/src/index.js'
import {
  CRLF_BOM_SOURCE,
  FULL_BLUEPRINT_SOURCE,
  MINIMAL_BLUEPRINT_SOURCE,
} from '../blueprint/testdata/fixtures.js'
import { expectErrorDetails } from './t2-helpers.js'

/**
 * The declared stamp of the `MINIMAL_BLUEPRINT_SOURCE` factory fixture.
 *
 * This is a LIVE MIRROR, not a choice of this file: the frontmatter-text test
 * below pins that fixture's bytes VERBATIM, and §7.4 moved fixtures.ts to the
 * current document version in the same PR that moved this constant. Change it
 * only together with fixtures.ts, never to make the version scan pass — a
 * mirror that is edited to silence a tool stops being a mirror.
 */
const MINIMAL_FACTORY_DECLARED_VERSION = 3

describe('t2 parse: minimal blueprint', () => {
  it('parses the minimal closed document at the version this build declares', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(bp.schemaVersion).toBe(MINIMAL_FACTORY_DECLARED_VERSION)
    expect(bp.blueprintId).toBe('team.min')
    expect(bp.revision).toBe('1')
    expect(bp.leader.templateId).toBe('leader')
    expect(bp.leader.persona).toBe('Lead.')
    expect(bp.members).toEqual([])
    expect(bp.requirements).toEqual([])
    expect(bp.memberEnvelopes).toEqual([])
    expect(bp.policyStates).toEqual([])
    // The two v3 authority documents are REQUIRED there, and the fixture
    // declares the ZERO position rather than a permissive filler. Pinned as
    // data because the validator would also accept a document that omits
    // them by refusing it, which is a different fact from "this minimal
    // document grants no expansion authority".
    expect(bp.permissionMutationEnvelope).toEqual({ rules: [] })
    expect(bp.teamHardEnvelope).toEqual({ rules: [] })
    expect(bp.metadata).toEqual({})
    expect(bp.displayName).toBe(undefined)
    expect(bp.description).toBe(undefined)
    expect(bp.teamEnvelope).toBe(undefined)
    expect(bp.quotas).toBe(undefined)
    expect(bp.capabilityPolicy).toBe(undefined)
  })

  it('derives a sha256-prefixed 64-hex content hash', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(bp.contentHash.startsWith('sha256:')).toBe(true)
    expect(bp.contentHash.length).toBe(71)
  })

  it('normalizes BOM + CRLF sources to the same content hash', () => {
    const a = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const b = parseBlueprint(CRLF_BOM_SOURCE)
    expect(b.blueprintId).toBe(a.blueprintId)
    expect(b.revision).toBe(a.revision)
    expect(b.contentHash).toBe(a.contentHash)
  })

  it('trims string fields during normalization', () => {
    const src = [
      '---',
      'schemaVersion: 3',
      'blueprintId: team.min',
      'revision: "1"',
      'displayName: "  Padded  "',
      'leader:',
      '  templateId: leader',
      '  persona: "  Lead.  "',
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'permissionMutationEnvelope:',
      '  rules: []',
      'teamHardEnvelope:',
      '  rules: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n')
    const bp = parseBlueprint(src)
    expect(bp.displayName).toBe('Padded')
    expect(bp.leader.persona).toBe('Lead.')
  })
})

describe('t2 parse: full blueprint', () => {
  it('parses every semantic field', () => {
    const bp = parseBlueprint(FULL_BLUEPRINT_SOURCE)
    expect(bp.blueprintId).toBe('team.alpha')
    expect(bp.revision).toBe('2')
    expect(bp.displayName).toBe('Alpha Team')
    expect(bp.description).toBe('A fully specified example team.')

    expect(bp.leader.templateId).toBe('leader')
    expect(bp.leader.displayName).toBe('Team Lead')
    expect(bp.leader.description).toBe('Coordinates the members.')
    expect(bp.leader.persona).toBe('You are the team lead. Delegate, synthesize, and report.')
    expect(bp.leader.modelPreference).toBe('deepseek-v4-pro')
    expect(bp.leader.contextPolicy).toBe('full-history')

    expect(bp.members.length).toBe(2)
    const researcher = bp.members[0]
    expect(researcher?.templateId).toBe('researcher')
    expect(researcher?.displayName).toBe('Researcher')
    expect(researcher?.persona).toBe('You research and cite sources.')
    const writer = bp.members[1]
    expect(writer?.templateId).toBe('writer')
    expect(writer?.persona).toBe('You write and edit.')

    expect(bp.requirements.length).toBe(2)
    const webReq = bp.requirements[0]
    expect(webReq?.domain).toBe('web')
    expect(webReq?.name).toBe('search')
    expect(webReq?.optional).toBe(false)
    const fsReq = bp.requirements[1]
    expect(fsReq?.domain).toBe('fs')
    expect(fsReq?.name).toBe('read')
    expect(fsReq?.optional).toBe(true)

    expect(bp.teamEnvelope?.allow).toEqual(['create-member', 'assign-task'])
    expect(bp.teamEnvelope?.deny).toEqual(['delete-team'])

    expect(bp.memberEnvelopes.length).toBe(2)
    expect(bp.memberEnvelopes[0]?.templateId).toBe('researcher')
    expect(bp.memberEnvelopes[0]?.envelope.allow).toEqual(['web.search'])
    expect(bp.memberEnvelopes[0]?.envelope.deny).toEqual([])
    expect(bp.memberEnvelopes[1]?.templateId).toBe('writer')
    expect(bp.memberEnvelopes[1]?.envelope.allow).toEqual([])
    expect(bp.memberEnvelopes[1]?.envelope.deny).toEqual(['fs.write'])

    expect(bp.policyStates.length).toBe(1)
    expect(bp.policyStates[0]?.id).toBe('active')
    expect(bp.policyStates[0]?.description).toBe('The team is working.')
    expect(bp.policyStates[0]?.fields).toEqual(['leader', 'members'])

    expect(bp.quotas?.team?.maxInstances).toBe(8)
    expect(bp.quotas?.team?.maxConcurrent).toBe(3)
    expect(bp.quotas?.members?.maxInstances).toBe(2)
    expect(bp.quotas?.members?.maxConcurrent).toBe(undefined)

    expect(bp.capabilityPolicy?.web).toBe('allow')
    expect(bp.capabilityPolicy?.fs).toBe('deny')
    expect(bp.metadata.owner).toBe('platform')
    expect(bp.metadata.locale).toBe('en')
  })
})

describe('t2 parse: splitFrontmatter', () => {
  it('returns the raw frontmatter text and an empty body', () => {
    const doc = splitFrontmatter(MINIMAL_BLUEPRINT_SOURCE)
    expect(doc.body).toBe('')
    expect(doc.frontmatterText).toEqual(
      [
        `schemaVersion: ${MINIMAL_FACTORY_DECLARED_VERSION}`,
        'blueprintId: team.min',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'permissionMutationEnvelope:',
        '  rules: []',
        'teamHardEnvelope:',
        '  rules: []',
        'metadata: {}',
      ].join('\n'),
    )
  })

  it('accepts a whitespace-only body', () => {
    expect(() => splitFrontmatter('---\nschemaVersion: 3\n---\n   \n')).not.toThrow()
  })

  it('rejects non-string sources', () => {
    expectErrorDetails(
      () => splitFrontmatter(null as unknown as string),
      'MALFORMED_DTO',
      { reason: 'source-not-string' },
    )
  })

  it('rejects sources without an opening delimiter', () => {
    expectErrorDetails(
      () => splitFrontmatter('schemaVersion: 3\n---\n'),
      'MALFORMED_DTO',
      { reason: 'frontmatter-missing' },
    )
  })

  it('rejects unclosed frontmatter', () => {
    expectErrorDetails(
      () => splitFrontmatter('---\nschemaVersion: 3\n'),
      'MALFORMED_DTO',
      { reason: 'frontmatter-unclosed' },
    )
  })

  it('rejects a non-empty markdown body', () => {
    expectErrorDetails(
      () => splitFrontmatter('---\nschemaVersion: 3\n---\n# body\n'),
      'MALFORMED_DTO',
      { reason: 'markdown-body-not-allowed' },
    )
  })
})

describe('t2 parse: decodeYamlFrontmatter', () => {
  it('decodes a YAML mapping', () => {
    const value = decodeYamlFrontmatter('a: 1\nb: [x, y]\n') as Record<string, unknown>
    expect(value.a).toBe(1)
    expect(value.b).toEqual(['x', 'y'])
  })

  it('rejects invalid YAML with the yaml-invalid reason', () => {
    expectErrorDetails(
      () => decodeYamlFrontmatter('leader: [unclosed'),
      'MALFORMED_DTO',
      { reason: 'yaml-invalid' },
    )
  })
})

// ---------------------------------------------------------------------------
// PRS-1 / PRS-2 (2026-10-16 authorized round): a recursive YAML anchor
// (`&m { self: *m }`) decodes into a CYCLIC JS value; the YAML layer accepts
// it, and the cycle then detonates downstream as an UNTYPED `RangeError:
// Maximum call stack size exceeded` (identity/freeze/hash traversal), while
// the inspector calls the same file OK — the PRS-1 inspector/parser split.
// The decode stage must therefore detect the cycle and reject it with the
// typed MALFORMED_DTO (`reason: yaml-invalid`, recursive-anchor named in the
// message — the PRS-2 "no fixed one-liner swallowing the reason" rule), so
// every entry point (decode / parse / inspect) reaches the SAME conclusion.
// Shared non-cyclic alias reuse stays legal (no false positives).
// ---------------------------------------------------------------------------

const g4FullSource = (frontmatterTail: string): string =>
  [
    '---',
    'schemaVersion: 3',
    'blueprintId: g4-recursive',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    frontmatterTail,
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    '---',
    '',
  ].join('\n')

const RECURSIVE_FM = 'metadata: &g4m\n  self: *g4m'
const RECURSIVE_SOURCE = g4FullSource(RECURSIVE_FM)

describe('PRS-1/PRS-2: recursive YAML anchor is a typed decode rejection', () => {
  it('P1: decodeYamlFrontmatter rejects a recursive anchor with the typed MALFORMED_DTO (no RangeError escape)', () => {
    expectErrorDetails(() => decodeYamlFrontmatter(RECURSIVE_FM + '\n'), 'MALFORMED_DTO', {
      reason: 'yaml-invalid',
    })
  })

  it('P2: parseBlueprint reaches the same typed rejection for the same file', () => {
    expectErrorDetails(() => parseBlueprint(RECURSIVE_SOURCE), 'MALFORMED_DTO', {
      reason: 'yaml-invalid',
    })
  })

  it('P3: the error names the concrete cause (recursive anchor), not a fixed one-liner', () => {
    let message = ''
    try {
      parseBlueprint(RECURSIVE_SOURCE)
    } catch (err) {
      message = (err as Error).message
    }
    expect(message.toLowerCase()).toContain('recursive')
  })

  it('P4: the inspector reaches the SAME conclusion (no inspector-ok/parser-explode split)', () => {
    const outcome = inspectBlueprintSource(RECURSIVE_SOURCE)
    expect(outcome.status).toBe('rejected')
  })

  it('P5: shared NON-cyclic alias reuse is NOT flagged (only true cycles reject)', () => {
    // `a` and `b` point at the SAME anchor object (a diamond, not a cycle).
    // A naive "seen node" set would false-positive here; the detector must
    // track the CURRENT PATH, so a shared-but-acyclic object decodes clean.
    const diamond = 'leader: &g4s\n  templateId: t\n  persona: p\nmirror: *g4s\n'
    const decoded = decodeYamlFrontmatter(diamond) as Record<string, unknown>
    // Same object identity shared, and the decoder did not throw.
    expect(decoded.mirror).toBe(decoded.leader)
  })
})

// ---------------------------------------------------------------------------
// G4-R (regression round, 2026-10-16): the GUARD ITSELF is bounded and the
// typed error never erases the diagnosis. Empirical world (pinned by these
// legs, measured against the pinned yaml library): the library resolves a
// SELF-referential anchor into a real cyclic object (the guard's target);
// MUTUAL anchors are impossible past the library (anchor-before-alias law,
// plain ReferenceError); nesting beyond ~1k frames is refused BY the library
// as a YAMLError that wraps its own stack overflow; alias counts beyond the
// resource limit arrive as a plain ReferenceError. Every outcome must be the
// typed MALFORMED_DTO (or success), the original error rides as `cause`,
// and NONE of them may surface as an untyped RangeError — including from
// inside the guard, whose walk is an explicit-stack DFS (heap-bounded).
// ---------------------------------------------------------------------------
describe('G4-R: guard boundedness and cause preservation', () => {
  const decodeError = (source: string): unknown => {
    try {
      decodeYamlFrontmatter(source)
      throw new Error('expected decode to refuse')
    } catch (error) {
      return error
    }
  }

  it('R1 self-cycle: typed refusal, problem recursive-yaml-anchor (never a RangeError)', () => {
    const error = decodeError('a: &m { self: *m }\n') as { code?: string; details?: Record<string, unknown> }
    expect(error.code).toBe('MALFORMED_DTO')
    expect(error.details?.['reason']).toBe('yaml-invalid')
    expect(error.details?.['problem']).toBe('recursive-yaml-anchor')
    expect(error).not.toBeInstanceOf(RangeError)
  })

  it('R2 mutual anchors: the library itself refuses (anchor-before-alias) — typed, with the ORIGINAL ReferenceError as cause', () => {
    for (const source of ['x: &mx { y: *my }\ny: &my { x: *mx }\n', 'p: &mp { q: *mq }\nq: &mq { p: *mp }\n']) {
      const error = decodeError(source) as { code?: string; details?: Record<string, unknown>; cause?: unknown }
      expect(error.code, source).toBe('MALFORMED_DTO')
      expect(error.details?.['reason'], source).toBe('yaml-invalid')
      expect((error.cause as Error | undefined)?.name, source).toBe('ReferenceError')
      expect(error).not.toBeInstanceOf(RangeError)
    }
  })

  it('R3 deep but LEGAL nesting (120 frames): decodes successfully — the guard walks the depth on the HEAP (explicit-stack DFS), never the call stack', () => {
    const source = `a: ${'{ '.repeat(120)}x: 1${' }'.repeat(120)}\n`
    const value = decodeYamlFrontmatter(source)
    expect(value).toBeTypeOf('object')
  })

  // R4 (deep OVER-LIMIT) deliberately lives in the EVIDENCE LOG, not in the
  // suite: the measurement (logs/G4R-green.txt) shows the library's deep
  // behaviour is ENVIRONMENT-DEPENDENT — a bare node stack refuses ~1k
  // nesting with a typed-wrapped YAMLParseError ("Maximum call stack size
  // exceeded"), while under vitest the SAME 1000-frame source decodes
  // SUCCESSFULLY after ~280s and 500 frames already exceed the 5s test
  // budget. Two consequences, both recorded honestly: (a) the guard's
  // boundedness may NEVER lean on "the parser refuses first" — that is
  // exactly why it is an explicit-stack DFS now; (b) a ~4KB deeply-nested
  // frontmatter costing minutes to parse is a NEW resource finding
  // (OBS-1): an acceptance cap (size/depth) is a product decision, pending
  // a ruling — this round does not add one. The YAMLError-cause law R4 was
  // meant to pin is pinned deterministically by R6; the non-YAML
  // ReferenceError-cause law by R2/R5.

  it('R5 alias over the resource limit (150 > default cap): typed refusal, original ReferenceError kept as cause', () => {
    const source = `a: &b [1]\nc: [${Array.from({ length: 150 }, () => '*b').join(', ')}]\n`
    const error = decodeError(source) as { code?: string; message?: string; cause?: unknown }
    expect(error.code).toBe('MALFORMED_DTO')
    expect(error.message).toContain('Excessive alias count')
    expect((error.cause as Error | undefined)?.name).toBe('ReferenceError')
  })

  it('R6 plain syntax refusal ALSO carries the original YAMLError as cause (wrapping never erases)', () => {
    const error = decodeError('leader: [unclosed\n') as { code?: string; cause?: unknown }
    expect(error.code).toBe('MALFORMED_DTO')
    expect((error.cause as Error | undefined)?.name).toBe('YAMLParseError')
  })
})
