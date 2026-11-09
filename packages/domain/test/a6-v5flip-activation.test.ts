/**
 * a6-v5flip — the v5 ACTIVATION stroke, DRILL branch only.
 *
 * This suite pins exactly the four facts the drill asks for, and nothing else:
 *  1. the run-set move itself: SUPPORTED gains `5`, DEFINED gains `5` (they
 *     move TOGETHER — RETIRED is derived as DEFINED − SUPPORTED), RETIRED
 *     stays `[1, 2]` (翻档 ≠ 退役);
 *  2. a v5 document ROUND-TRIPS through the production entry
 *     (`parseBlueprint` → `validateBlueprintDocument` → v5 dispatch → v5 hash
 *     projection) with a STABLE content hash, and the hash BINDS the
 *     `reviewRouting` family;
 *  3. v3/v4 are BYTE-IDENTICAL: their content hashes are the pre-activation
 *     constants captured through this same tree before the flip (stash run),
 *     and the bare v5 core face IS the v4 output restamped;
 *  4. the v5 document is accepted by the catalog (parse source → resolve →
 *     snapshot) and by the inspector; and the ROLLBACK is real: removing `5`
 *     from the run set returns the typed `SCHEMA_VERSION_MISMATCH` refusal,
 *     not a different failure and not a silent drop.
 *
 * The drill branch must NOT be merged; the rollback assertion is the
 * machine-checkable statement of that property.
 *
 * @module test/a6-v5flip-activation
 */
import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import {
  DEFINED_BLUEPRINT_DOCUMENT_VERSIONS,
  RETIRED_BLUEPRINT_DOCUMENT_VERSIONS,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  createBlueprintCatalogFromSource,
  inspectBlueprintSource,
  parseBlueprint,
  parseBlueprintV5,
  toHashableBlueprintV5,
  validateBlueprintDocument,
} from '../blueprint/src/index.js'
import type { BlueprintCatalogSource } from '../blueprint/src/index.js'

/** Version digits ride NAMED CONSTANTS through a template carrier — the
 *  sanctioned a5sr2/a5fl1 pattern; test-authored document sources must not
 *  add `schemaVersion: <digit>` string sites (the A4-PR7 version-clean
 *  fence's `dirty` class stays empty for this file). */
const V3_DOC_VERSION = 3
const V4_DOC_VERSION = 4
const V5_DOC_VERSION = 5

/** Pre-activation constants, captured on THIS tree before the flip (a stash
 *  run of the same canaries through the unmodified sources). They are the
 *  byte-identity proof: the activation may not move any of them. */
const V3_CANARY_HASH = 'sha256:1d18f036cfb326f4187af403710305b67867edfd314186da1770bff909ec3fd9'
const V4_CANARY_HASH = 'sha256:55612e94c3b38563e5909aa825f56ab3b036abff7c4a3661ea18712b1832fa40'
const V5_CANARY_HASH = 'sha256:669e8939a77c86a12cb53484fbb4dd24b13d107b3d495f0893458416de361321'
const V5_BARE_HASH = 'sha256:9322cee374a4377de5f5751c756c5dab983f14c8319cb70ff21bf2612113bb0b'

const CANARY_BODY: readonly string[] = [
  'blueprintId: team.v5flipcanary',
  'revision: "1"',
  'leader: { templateId: leader, persona: Lead. }',
  'members:',
  '  - templateId: officer',
  '    persona: Review asks.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'metadata: {}',
]

const ROUTING_LINES: readonly string[] = [
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions:',
  '      - memberTemplateId: officer',
  '        tool: { owner: dsh.shell, name: bash }',
  '  whenOfficerUnavailable: hold',
]

function sourceAtVersion(version: number, extra: readonly string[] = []): string {
  return `---\nschemaVersion: ${String(version)}\n${[...CANARY_BODY, ...extra].join('\n')}\n---\n`
}

function v3Source(extra: readonly string[] = []): string {
  return sourceAtVersion(V3_DOC_VERSION, extra)
}

function v4Source(extra: readonly string[] = []): string {
  return sourceAtVersion(V4_DOC_VERSION, extra)
}

function v5Source(extra: readonly string[] = []): string {
  return sourceAtVersion(V5_DOC_VERSION, extra)
}

function expectError(fn: () => unknown): { code: string; message: string; details: Record<string, unknown> } {
  try {
    fn()
  } catch (error) {
    if (!isTeamContractError(error)) throw new Error(`expected a TeamContractError, got ${String(error)}`)
    return { code: error.code, message: error.message, details: (error.details ?? {}) as Record<string, unknown> }
  }
  throw new Error('expected a throw, got none')
}

describe('a6v5flip constants — the run set gained 5, DEFINED moved WITH it, RETIRED moved nothing', () => {
  it('SUPPORTED=[3,4,5], DEFINED=[1,2,3,4,5], RETIRED stays [1,2] exactly', () => {
    expect([...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([3, 4, 5])
    expect([...DEFINED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2, 3, 4, 5])
    expect([...RETIRED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2])
  })

  it('RETIRED is the DERIVATION, not a hand-declared list, and v5 is NOT retired', () => {
    const derived = DEFINED_BLUEPRINT_DOCUMENT_VERSIONS.filter(
      (version) => !SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version),
    )
    expect([...RETIRED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual(derived)
    expect(RETIRED_BLUEPRINT_DOCUMENT_VERSIONS).not.toContain(V5_DOC_VERSION)
  })
})

describe('a6v5flip production entry — a v5 document parses, freezes, and hashes STABLY', () => {
  it('parseBlueprint accepts the v5 canary, stamps 5, carries reviewRouting, and freezes', () => {
    const blueprint = parseBlueprint(v5Source(ROUTING_LINES)) as unknown as {
      schemaVersion: number
      blueprintId: string
      contentHash: string
      reviewRouting?: { officerTemplateId: string }
    }
    expect(blueprint.schemaVersion).toBe(V5_DOC_VERSION)
    expect(blueprint.blueprintId).toBe('team.v5flipcanary')
    expect(blueprint.reviewRouting?.officerTemplateId).toBe('officer')
    expect(Object.isFrozen(blueprint)).toBe(true)
  })

  it('the content hash is STABLE: the pre-activation v5 constant, identical on re-parse', () => {
    const first = parseBlueprint(v5Source(ROUTING_LINES))
    expect(first.contentHash).toBe(V5_CANARY_HASH)
    expect(parseBlueprint(v5Source(ROUTING_LINES)).contentHash).toBe(first.contentHash)
    // The bare v5 document (no family) has its own pre-activation constant.
    expect(parseBlueprint(v5Source()).contentHash).toBe(V5_BARE_HASH)
  })

  it('the HASH BINDS the reviewRouting family (no v4-projection laundering at the entry)', () => {
    const bare = parseBlueprint(v5Source())
    const declared = parseBlueprint(v5Source(ROUTING_LINES))
    expect(declared.contentHash).not.toBe(bare.contentHash)
    const other = parseBlueprint(v5Source(ROUTING_LINES.map((line) => line.replace('whenOfficerUnavailable: hold', 'whenOfficerUnavailable: leader'))))
    expect(other.contentHash).not.toBe(declared.contentHash)
  })

  it('the v5 hash projection carries the family and the version, and equals parseBlueprintV5', () => {
    const viaEntry = parseBlueprint(v5Source(ROUTING_LINES))
    const hashable = toHashableBlueprintV5(viaEntry as never)
    expect(hashable).toHaveProperty('reviewRouting')
    expect((hashable as { schemaVersion?: number }).schemaVersion).toBe(V5_DOC_VERSION)
    // Single source of truth: the direct v5 pipeline and the production entry
    // agree on the hash — one parser, one projection, two doors.
    expect(parseBlueprintV5(v5Source(ROUTING_LINES)).contentHash).toBe(viaEntry.contentHash)
  })
})

describe('a6v5flip v3/v4 BYTE-IDENTITY — the activation moved no v3/v4 byte', () => {
  it('the v3 and v4 canaries hash EXACTLY their pre-activation constants', () => {
    expect(parseBlueprint(v3Source()).contentHash).toBe(V3_CANARY_HASH)
    expect(parseBlueprint(v4Source()).contentHash).toBe(V4_CANARY_HASH)
  })

  it('the bare v5 core face IS the v4 output restamped (the delegation, not a fork)', () => {
    const v4 = parseBlueprint(v4Source())
    const v5Bare = parseBlueprint(v5Source())
    expect({ ...v5Bare, schemaVersion: V4_DOC_VERSION, contentHash: v4.contentHash }).toEqual(v4)
  })

  it('v3/v4 still REFUSE the v5-only family (the closed field sets did not widen)', () => {
    expect(expectError(() => parseBlueprint(v3Source(ROUTING_LINES))).code).toBe('MALFORMED_DTO')
    expect(expectError(() => parseBlueprint(v4Source(ROUTING_LINES))).code).toBe('MALFORMED_DTO')
  })
})

describe('a6v5flip catalog + inspector acceptance', () => {
  it('the catalog PARSES, RESOLVES, and SNAPSHOTS a v5 source', () => {
    const source: BlueprintCatalogSource = {
      listSources: () => ['v5.yaml'],
      readSource: () => v5Source(ROUTING_LINES),
    }
    const catalog = createBlueprintCatalogFromSource(source)
    const blueprint = catalog.resolve('team.v5flipcanary', '1')
    expect(blueprint.schemaVersion).toBe(V5_DOC_VERSION)
    expect(blueprint.contentHash).toBe(V5_CANARY_HASH)
    expect(catalog.resolveLatest('team.v5flipcanary').contentHash).toBe(V5_CANARY_HASH)
    expect(catalog.snapshotOf('team.v5flipcanary', '1')).toMatchObject({
      blueprintId: 'team.v5flipcanary',
      revision: '1',
      contentHash: V5_CANARY_HASH,
    })
  })

  it('the inspector answers `ok` for a v5 document (it is in the RUN set, not retired)', () => {
    const inspection = inspectBlueprintSource(v5Source(ROUTING_LINES))
    expect(inspection.status).toBe('ok')
    if (inspection.status === 'ok') expect(inspection.identity.schemaVersion).toBe(V5_DOC_VERSION)
  })
})

describe('a6v5flip ROLLBACK — dropping 5 from the run set returns the typed unsupported refusal', () => {
  it('reverting the activation (5 leaves BOTH sets) refuses the same v5 bytes, typed', () => {
    // The three version sets are plain arrays at runtime (readonly is a TYPE
    // fact) and the dispatch/inspector read them live. Mutating them to the
    // EXACT pre-activation values is the executable form of the rollback
    // procedure (`git revert` of the activation commit): SUPPORTED=[3,4],
    // DEFINED=[1,2,3,4], RETIRED=[1,2]. Restored in `finally` so a failed
    // assertion cannot leak the rollback into later legs.
    const supported = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS as number[]
    const defined = DEFINED_BLUEPRINT_DOCUMENT_VERSIONS as number[]
    const retired = RETIRED_BLUEPRINT_DOCUMENT_VERSIONS as number[]
    const originalSupported = [...supported]
    const originalDefined = [...defined]
    const originalRetired = [...retired]
    const setAll = (target: number[], values: readonly number[]): void => {
      target.splice(0, target.length, ...values)
    }
    try {
      setAll(supported, supported.filter((version) => version !== V5_DOC_VERSION))
      setAll(defined, defined.filter((version) => version !== V5_DOC_VERSION))
      setAll(retired, defined.filter((version) => !supported.includes(version)))
      expect([...supported]).toEqual([3, 4])
      expect([...defined]).toEqual([1, 2, 3, 4])
      expect([...retired]).toEqual([1, 2])

      const strong = expectError(() => validateBlueprintDocument({ schemaVersion: V5_DOC_VERSION }))
      expect(strong.code).toBe('SCHEMA_VERSION_MISMATCH')
      expect(strong.details.supported).toEqual([3, 4])

      const parsed = expectError(() => parseBlueprint(v5Source(ROUTING_LINES)))
      expect(parsed.code).toBe('SCHEMA_VERSION_MISMATCH')
      expect(parsed.message).toContain('[3, 4]')

      // v5 is now a version NOBODY defined, so the inspector takes the
      // never-defined arm — not the migration arm.
      const inspection = inspectBlueprintSource(v5Source(ROUTING_LINES))
      expect(inspection.status).toBe('rejected')
      if (inspection.status === 'rejected') {
        expect(inspection.diagnostics.map((diagnostic) => diagnostic.reason)).toContain('schemaVersion-unsupported')
      }
    } finally {
      setAll(supported, originalSupported)
      setAll(defined, originalDefined)
      setAll(retired, originalRetired)
    }
    // Re-armed: the very same bytes run again after the restore.
    expect(parseBlueprint(v5Source(ROUTING_LINES)).contentHash).toBe(V5_CANARY_HASH)
  })
})
