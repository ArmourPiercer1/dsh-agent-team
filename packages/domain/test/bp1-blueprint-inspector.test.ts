/**
 * bp1 blueprint source inspector (issue #2 blueprint-loading parallel
 * repair, plan BP1 §5): the IDENTITY-LEVEL read of a saved blueprint
 * document — the weaker sibling of the strong `parseBlueprint` pipeline
 * that lets a directory scan list saved sources without strong-parsing
 * (and failing on) each of them.
 *
 * Contract pinned here (plan §5 test list):
 *   1. invalid YAML -> format reject (`yaml-invalid`, verbatim message);
 *   2. missing id/revision -> reject (`blueprintId-invalid` /
 *      `revision-invalid`);
 *   3. **format-valid but logically invalid** -> inspector ACCEPTS the
 *      identity, `parseBlueprint()` REJECTS the document (the split is
 *      the point: the catalog lists it; resolving it fails closed);
 *   4. the strong parser is untouched: the structural stages are the
 *      strong parser's OWN functions (BOM/CRLF normalization, the
 *      delimiters, the empty-body rule) — pinned by the same-source
 *      identity agreement below + the existing t2 strong-parser suites
 *      (zero regression, re-run at the gate).
 *
 * @module @dsh-agent-team/domain/test/bp1-blueprint-inspector
 */

import { describe, expect, it } from 'vitest'

import {
  inspectBlueprintSource,
  parseBlueprint,
} from '../blueprint/src/index.js'
import type { BlueprintInspectionResult } from '../blueprint/src/index.js'
import {
  CRLF_BOM_SOURCE,
  MINIMAL_BLUEPRINT_SOURCE,
} from '../blueprint/testdata/fixtures.js'

function rejectedReason(result: BlueprintInspectionResult): string {
  if (result.status !== 'rejected') {
    throw new Error('guard: expected a rejected outcome')
  }
  return result.diagnostics[0]?.reason ?? ''
}

function rejectedMessage(result: BlueprintInspectionResult): string {
  if (result.status !== 'rejected') {
    throw new Error('guard: expected a rejected outcome')
  }
  return result.diagnostics[0]?.message ?? ''
}

// --- 1. the structural stage: the strong parser's own rules, verbatim --------

describe('bp1 inspector: the structural stage (splitFrontmatter / decodeYaml)', () => {
  it('accepts the minimal valid document and extracts the identity', () => {
    const result = inspectBlueprintSource(MINIMAL_BLUEPRINT_SOURCE)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('guard')
    expect(result.identity).toEqual({
      schemaVersion: 1,
      blueprintId: 'team.min',
      revision: '1',
    })
  })

  it('normalizes BOM + CRLF exactly like the strong parser (same identity)', () => {
    const a = inspectBlueprintSource(MINIMAL_BLUEPRINT_SOURCE)
    const b = inspectBlueprintSource(CRLF_BOM_SOURCE)
    expect(b.status).toBe('ok')
    if (a.status !== 'ok' || b.status !== 'ok') throw new Error('guard')
    expect(b.identity).toEqual(a.identity)
    // Agreement with the STRONG parser on the same source: the identity
    // the inspector reports is the identity the strong parser derives.
    const strong = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(a.identity.blueprintId).toBe(String(strong.blueprintId))
    expect(a.identity.revision).toBe(String(strong.revision))
    expect(a.identity.schemaVersion).toBe(strong.schemaVersion)
  })

  it('rejects a missing opening delimiter (the strong reason, verbatim)', () => {
    const result = inspectBlueprintSource('no frontmatter here')
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('frontmatter-missing')
  })

  it('rejects an unclosed frontmatter (the strong reason, verbatim)', () => {
    const result = inspectBlueprintSource(['---', 'schemaVersion: 1', 'blueprintId: team.x'].join('\n'))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('frontmatter-unclosed')
  })

  it('rejects a non-empty markdown body (the vNext empty-body rule)', () => {
    const result = inspectBlueprintSource(`${MINIMAL_BLUEPRINT_SOURCE}\nfreeform prose`)
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('markdown-body-not-allowed')
  })

  it('rejects invalid YAML (yaml-invalid, the parser message preserved)', () => {
    const result = inspectBlueprintSource(['---', 'schemaVersion: [', '---', ''].join('\n'))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('yaml-invalid')
    expect(rejectedMessage(result).length).toBeGreaterThan(0)
  })

  it('rejects a frontmatter that decodes to a non-record (a YAML list)', () => {
    const result = inspectBlueprintSource(['---', '- a', '- b', '---', ''].join('\n'))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('not-a-plain-record')
  })

  it('rejects an empty (null) frontmatter', () => {
    const result = inspectBlueprintSource(['---', '', '---', ''].join('\n'))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('not-a-plain-record')
  })
})

// --- 2. the identity field checks ---------------------------------------------

describe('bp1 inspector: the identity field checks', () => {
  const doc = (lines: string[]): string => ['---', ...lines, '---', ''].join('\n')

  it('rejects a missing schemaVersion', () => {
    const result = inspectBlueprintSource(doc(['blueprintId: team.x', 'revision: "1"']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('schemaVersion-missing')
  })

  it('rejects a non-integer schemaVersion', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 1.5', 'blueprintId: team.x', 'revision: "1"']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('schemaVersion-unsupported')
  })

  it('rejects an unsupported schemaVersion (the strong closed set is reused)', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 99', 'blueprintId: team.x', 'revision: "1"']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('schemaVersion-unsupported')
    expect(rejectedMessage(result).indexOf('supports') >= 0).toBe(true)
  })

  it('rejects a missing blueprintId', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 1', 'revision: "1"']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('blueprintId-invalid')
  })

  it('rejects a blueprintId with the reserved @ (the contracts grammar)', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 1', 'blueprintId: "team@1"', 'revision: "1"']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('blueprintId-invalid')
  })

  it('rejects a missing revision', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 1', 'blueprintId: team.x']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('revision-invalid')
  })

  it('rejects a non-string revision (YAML numbers are NOT revisions)', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 1', 'blueprintId: team.x', 'revision: 7']))
    expect(result.status).toBe('rejected')
    expect(rejectedReason(result)).toBe('revision-invalid')
  })

  it('accepts a multi-part human revision (the grammar allows it)', () => {
    const result = inspectBlueprintSource(doc(['schemaVersion: 1', 'blueprintId: team.x', 'revision: "2026.09-r1"']))
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('guard')
    expect(result.identity.revision).toBe('2026.09-r1')
  })
})

// --- 3. the SPLIT: format-valid but logically invalid --------------------------

describe('bp1 inspector: the identity/strong split (plan §5 test 3)', () => {
  it('accepts the identity of a document the STRONG parser rejects (no leader)', () => {
    // Identity level: fine (the fields parse). Strong level: a blueprint
    // must carry exactly one complete LeaderTemplate — the strong parser
    // rejects. The inspector must NOT run that check.
    const noLeader = ['---',
      'schemaVersion: 1',
      'blueprintId: team.split',
      'revision: "1"',
      'members: []',
      '---',
      ''].join('\n')
    const inspection = inspectBlueprintSource(noLeader)
    expect(inspection.status).toBe('ok')
    if (inspection.status !== 'ok') throw new Error('guard')
    expect(inspection.identity).toEqual({
      schemaVersion: 1,
      blueprintId: 'team.split',
      revision: '1',
    })
    // The strong parser rejects the SAME document (its territory intact).
    expect(() => parseBlueprint(noLeader)).toThrow()
  })

  it('accepts the identity of a document with an unclosed template reference', () => {
    // A member references a templateId the document never declares: an
    // IDENTITY-LEVEL document (the fields parse) that the strong parser's
    // closure check rejects.
    const dangling = ['---',
      'schemaVersion: 1',
      'blueprintId: team.dangling',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: Lead.',
      'members:',
      '  - templateId: ghost',
      '    persona: Ghost.',
      'memberEnvelopes:',
      '  - templateId: missing-template',
      '    envelope:',
      '      allow: []',
      '      deny: []',
      '---',
      ''].join('\n')
    const inspection = inspectBlueprintSource(dangling)
    expect(inspection.status).toBe('ok')
    if (inspection.status !== 'ok') throw new Error('guard')
    expect(inspection.identity.blueprintId).toBe('team.dangling')
    // The strong parser's closure check (its territory) still rejects.
    expect(() => parseBlueprint(dangling)).toThrow()
  })

  it('the strong parser is UNTOUCHED: a document both accept is byte-identical in identity', () => {
    const result = inspectBlueprintSource(MINIMAL_BLUEPRINT_SOURCE)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('guard')
    const strong = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(result.identity.blueprintId).toBe(String(strong.blueprintId))
    expect(result.identity.revision).toBe(String(strong.revision))
    expect(strong.contentHash.startsWith('sha256:')).toBe(true)
  })
})
