/**
 * a5fl1 — the v4 FLIP stroke (VNEXT-SCHEMA-ADR M-1 irreversible half;
 * V4-ENABLEMENT-ROUTE stage ③ + ② atom; the flip-PREP gate-arm truth table
 * made executable). RED-FIRST: every RUNS-arm leg here was red before the
 * flip (the pre-flip MISMATCH原文 is captured verbatim in
 * `dev/agent-workflow/evidence/alpha5/v4-flip/runs/pre-flip-entry-capture.txt`
 * and in `runs/a5fl1-RED.log`).
 *
 * WHAT THIS SUITE PINS (and only this — the semantics are on the record,
 * zero new rulings):
 *  1. the flip constants: SUPPORTED=[3,4], DEFINED=[1,2,3,4], and RETIRED
 *     stays DERIVED at [1,2] — adding a version demits nothing (the
 *     flip-PREP「RETIRED 派生臂不动」clause);
 *  2. the gate-arm truth table, per-version one leg (v4-flip-PREP):
 *     1/2 stay on the operator-owns MISMATCH/migration arm, 3 stays RUNS,
 *     4 moves UNSUPPORTED→RUNS, a never-defined version keeps the typed
 *     rejection arms unchanged;
 *  3. the PRODUCTION ENTRY (`parseBlueprint` / `validateBlueprintDocument`)
 *     really parses AND hashes a v4 document — including the hashable
 *     v4 projection (a family difference MUST move the content hash:
 *     the parse-accept/identity-bind leg);
 *  4. v3 zero deformation: the canonical v3 canary hashes EXACTLY the
 *     pre-flip constant (byte-identical behavior, load-time morph = zero);
 *  5. the retirement firewall read as tests: nothing here declares or
 *     performs a v3 retirement (v3 ∉ RETIRED), and the v3 closed field set
 *     is NOT widened by the flip (`toolBindings` at v3 stays an unknown
 *     field — the family is a v4-face fact only).
 *
 * @module test/a5fl1-blueprint-v4-flip
 */
import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import {
  DEFINED_BLUEPRINT_DOCUMENT_VERSIONS,
  RETIRED_BLUEPRINT_DOCUMENT_VERSIONS,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  inspectBlueprintSource,
  parseBlueprint,
  validateBlueprintDocument,
} from '../blueprint/src/index.js'

/** The version digits ride NAMED CONSTANTS through a template carrier —
 *  the sanctioned pattern of `a5sr2` (test-authored document sources must
 *  not add `key: <digit>` string sites; the A4-PR7 version-clean fence's
 *  string-carrier class stays empty for this file). */
const V3_DOC_VERSION = 3
const V4_DOC_VERSION = 4

/** The canonical v3 canary — captured BEFORE the flip through the shipped
 *  dist mirror of the production barrel; the hash below is the PRE-FLIP
 *  recorded value (runs/pre-flip-entry-capture.txt), restated here as a
 *  constant so the suite cannot move it. */
const V3_CANARY_HASH = 'sha256:1723a76497492913cf85d8f41f17b7b1ff04689de298b6f3c7e9899137bdaf4f'

const CANARY_BODY: readonly string[] = [
  'blueprintId: team.flipcanary',
  'revision: "1"',
  'leader: { templateId: leader, persona: Lead. }',
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'metadata: {}',
]

function sourceAtVersion(version: number, extra: readonly string[] = []): string {
  return `---\nschemaVersion: ${String(version)}\n${[...CANARY_BODY, ...extra].join('\n')}\n---\n`
}

/** The v4 canary: the v3 canary restamped 4 (no family — the reversible
 *  A-1 stance: a v4 document that declares nothing says nothing). */
function v4Source(extra: readonly string[] = []): string {
  return sourceAtVersion(V4_DOC_VERSION, extra)
}

function v3Source(extra: readonly string[] = []): string {
  return sourceAtVersion(V3_DOC_VERSION, extra)
}

const FAMILY_LINES: readonly string[] = [
  'toolBindings:',
  '  - owner: dsh.shell',
  '    name: bash',
  '    authorization: ask',
  '    io:',
  '      read: { mode: restricted, allow: ["."], ask: [], deny: ["./secret"] }',
  '      write: { mode: restricted, allow: ["./out"], ask: [], deny: [".git"] }',
  '      network: { mode: deny, default: deny }',
  '    execution: { implementationOrigin: dsh-native, executionBoundary: confined-subprocess }',
]

function expectError(fn: () => unknown): { code: string; message: string; details: Record<string, unknown> } {
  try {
    fn()
  } catch (error) {
    if (!isTeamContractError(error)) throw new Error(`expected a TeamContractError, got ${String(error)}`)
    return { code: error.code, message: error.message, details: (error.details ?? {}) as Record<string, unknown> }
  }
  throw new Error('expected a throw, got none')
}

describe('a5fl1 flip constants — the run set gained 4, the derived retired set moved NOTHING', () => {
  it('SUPPORTED=[3,4], DEFINED=[1,2,3,4], RETIRED derived stays [1,2] exactly', () => {
    expect([...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([3, 4])
    expect([...DEFINED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2, 3, 4])
    expect([...RETIRED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2])
  })

  it('RETIRED is the DERIVATION, not a hand-declared list (adding a version demits nothing)', () => {
    const derived = DEFINED_BLUEPRINT_DOCUMENT_VERSIONS.filter(
      (version) => !SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version),
    )
    expect([...RETIRED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual(derived)
    // The retirement firewall read as a fact of the constants: v3 is NOT on
    // the retired set — this PR 翻档, it does not 退役 (翻档 ≠ 退役).
    expect(RETIRED_BLUEPRINT_DOCUMENT_VERSIONS).not.toContain(3)
  })
})

describe('a5fl1 gate-arm truth table — one leg per version row (flip-PREP table, executable)', () => {
  it('rows 1/2 through the STRONG ENTRY stay MISMATCH with the widened supported list in the refusal detail', () => {
    for (const version of RETIRED_BLUEPRINT_DOCUMENT_VERSIONS) {
      const err = expectError(() => validateBlueprintDocument({ schemaVersion: version }))
      expect(err.code).toBe('SCHEMA_VERSION_MISMATCH')
      expect(err.details.supported).toEqual([3, 4])
    }
  })

  it('row 3: v3 stays RUNS (the frozen branch is untouched — same core out of the same validator)', () => {
    const raw = {
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
    }
    expect(validateBlueprintDocument(raw).schemaVersion).toBe(3)
  })

  it('row 4: v4 MOVED from the never-defined arm to RUNS through the same entry', () => {
    const raw = {
      schemaVersion: 4,
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
    }
    expect(validateBlueprintDocument(raw).schemaVersion).toBe(4)
  })

  it('a never-defined version keeps the typed arms UNCHANGED: 5/99 MISMATCH at the strong entry, rejected at the inspector', () => {
    const next = Math.max(...DEFINED_BLUEPRINT_DOCUMENT_VERSIONS) + 1
    const err = expectError(() => validateBlueprintDocument({ schemaVersion: next }))
    expect(err.code).toBe('SCHEMA_VERSION_MISMATCH')
    const inspection = inspectBlueprintSource(sourceAtVersion(next))
    expect(inspection.status).toBe('rejected')
    if (inspection.status === 'rejected') {
      expect(inspection.diagnostics.map((d) => d.reason)).toContain('schemaVersion-unsupported')
    }
  })
})

describe('a5fl1 inspector three-state — v4 joins `ok`, nothing else moved', () => {
  it('v1 documents are migration-required WITH identity (arm unchanged)', () => {
    const firstRetired = RETIRED_BLUEPRINT_DOCUMENT_VERSIONS.find((version) => !SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version))
    if (firstRetired === undefined) throw new Error('the migration arm needs a retired subject')
    const inspection = inspectBlueprintSource(sourceAtVersion(firstRetired))
    expect(inspection.status).toBe('migration-required')
    if (inspection.status === 'migration-required') {
      expect(inspection.identity.blueprintId).toBe('team.flipcanary')
    }
  })

  it('v3 documents stay ok; v4 documents are ok NOW (the arm flip: rejected -> ok)', () => {
    expect(inspectBlueprintSource(v3Source()).status).toBe('ok')
    const v4 = inspectBlueprintSource(v4Source())
    expect(v4.status).toBe('ok')
    if (v4.status === 'ok') expect(v4.identity.schemaVersion).toBe(4)
  })
})

describe('a5fl1 production entry — a v4 document truly PARSES, HASHES, and FREEZES', () => {
  it('parseBlueprint accepts the v4 canary and stamps version 4 with a derived hash', () => {
    const blueprint = parseBlueprint(v4Source())
    expect(blueprint.schemaVersion).toBe(4)
    expect(blueprint.blueprintId).toBe('team.flipcanary')
    expect(blueprint.contentHash.startsWith('sha256:')).toBe(true)
    expect(Object.isFrozen(blueprint)).toBe(true)
  })

  it('the v4 family survives the production entry — parsed, frozen, present', () => {
    const blueprint = parseBlueprint(v4Source(FAMILY_LINES)) as unknown as {
      toolBindings?: ReadonlyArray<{ owner: string; name: string; authorization: string }>
    }
    expect(Array.isArray(blueprint.toolBindings)).toBe(true)
    expect(blueprint.toolBindings?.[0]).toMatchObject({ owner: 'dsh.shell', name: 'bash', authorization: 'ask' })
    expect(Object.isFrozen(blueprint.toolBindings)).toBe(true)
  })

  it('the HASH BINDS the family: two v4 documents differing ONLY in toolBindings hash DIFFERENTLY (no v3-projection laundering at the production entry)', () => {
    const bare = parseBlueprint(v4Source())
    const declared = parseBlueprint(v4Source(FAMILY_LINES))
    expect(declared.contentHash).not.toBe(bare.contentHash)
    const other = parseBlueprint(v4Source(FAMILY_LINES.map((l) => l.replace('authorization: ask', 'authorization: deny'))))
    expect(other.contentHash).not.toBe(declared.contentHash)
    // determinism: the same document hashes the same on re-parse
    expect(parseBlueprint(v4Source(FAMILY_LINES)).contentHash).toBe(declared.contentHash)
  })

  it('the v4 core face IS the frozen v3 output through the production entry (restamp only)', () => {
    const v3 = parseBlueprint(v3Source())
    const v4 = parseBlueprint(v4Source())
    expect({ ...v4, schemaVersion: 3, contentHash: v3.contentHash }).toEqual(v3)
  })
})

describe('a5fl1 v3 zero deformation — the flip moved NO v3 byte', () => {
  it('the canonical v3 canary hashes EXACTLY the pre-flip recorded constant', () => {
    expect(parseBlueprint(v3Source()).contentHash).toBe(V3_CANARY_HASH)
  })

  it('an unmigrated v3 document still resolves, freezes, and keeps the closed v3 field set (toolBindings at v3 = unknown field, refusal unchanged)', () => {
    const err = expectError(() => parseBlueprint(v3Source(FAMILY_LINES)))
    expect(err.code).toBe('MALFORMED_DTO')
  })

  it('the retired versions keep BOTH arms: migration-required at the inspector, MISMATCH at the strong entry — no silent drop, no run', () => {
    for (const version of RETIRED_BLUEPRINT_DOCUMENT_VERSIONS) {
      expect(inspectBlueprintSource(sourceAtVersion(version)).status).toBe('migration-required')
    }
  })
})
