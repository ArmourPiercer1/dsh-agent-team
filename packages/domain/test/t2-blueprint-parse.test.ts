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
} from '../blueprint/src/index.js'
import {
  CRLF_BOM_SOURCE,
  FULL_BLUEPRINT_SOURCE,
  MINIMAL_BLUEPRINT_SOURCE,
} from '../blueprint/testdata/fixtures.js'
import { expectErrorDetails } from './t2-helpers.js'

describe('t2 parse: minimal blueprint', () => {
  it('parses the minimal closed v1 document', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(bp.schemaVersion).toBe(1)
    expect(bp.blueprintId).toBe('team.min')
    expect(bp.revision).toBe('1')
    expect(bp.leader.templateId).toBe('leader')
    expect(bp.leader.persona).toBe('Lead.')
    expect(bp.members).toEqual([])
    expect(bp.requirements).toEqual([])
    expect(bp.memberEnvelopes).toEqual([])
    expect(bp.policyStates).toEqual([])
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
      'schemaVersion: 1',
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
        'schemaVersion: 1',
        'blueprintId: team.min',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'metadata: {}',
      ].join('\n'),
    )
  })

  it('accepts a whitespace-only body', () => {
    expect(() => splitFrontmatter('---\nschemaVersion: 1\n---\n   \n')).not.toThrow()
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
      () => splitFrontmatter('schemaVersion: 1\n---\n'),
      'MALFORMED_DTO',
      { reason: 'frontmatter-missing' },
    )
  })

  it('rejects unclosed frontmatter', () => {
    expectErrorDetails(
      () => splitFrontmatter('---\nschemaVersion: 1\n'),
      'MALFORMED_DTO',
      { reason: 'frontmatter-unclosed' },
    )
  })

  it('rejects a non-empty markdown body', () => {
    expectErrorDetails(
      () => splitFrontmatter('---\nschemaVersion: 1\n---\n# body\n'),
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
