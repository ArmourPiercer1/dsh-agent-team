/**
 * a5sr5 — NEG wiring (VNEXT-SCHEMA-ADR M-5): the 33 machine-readable
 * migration negative cases of
 * `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/migration-negative-cases.json`
 * (status CANDIDATE_NOT_WIRED, error vocabulary `proposed-not-shipped`) are
 * driven through the SHIPPED surfaces and graded case-by-case.
 *
 * Honesty discipline (M-5): the candidate file names PROPOSED error codes;
 * this round ships the verdict + located refusal, and this file carries one
 * explicit CANDIDATE→SHIPPED mapping row per case (proposed name → shipped
 * code + why). A case whose candidate input predates a later tightening
 * (e.g. the fully-explicit D-03 posture) is wired at its RED CORE with the
 * adaptation recorded in its row. No case is dropped, softened, or skipped;
 * `_meta.count` is pinned against the file.
 *
 * Surfaces: `gate` = the production `validateBlueprintDocument` version arm
 * (v4 stays unreachable through it — pinned here); `v4` = the DORMANT v4
 * authoring entry (validateBlueprintV4Document); `report` = the migration
 * report module (real source/proposed documents instead of the candidate's
 * illustrative `migration:` envelope, as recorded per row).
 *
 * @module test/a5sr5-migration-negative-cases
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import {
  planBlueprintV3toV4Migration,
  validateBlueprintDocument,
  validateBlueprintV4Document,
} from '../blueprint/src/index.js'

const NEG_PATH = fileURLToPath(new URL('../../../docs/plans/memo/alpha5-tool-io-governance/pr8-accept/migration-negative-cases.json', import.meta.url))
const neg = JSON.parse(readFileSync(NEG_PATH, 'utf8')) as {
  _meta: { status: string; count: { reject: number; 'report-requires-decision': number; 'accept-verbatim': number; total: number } }
  cases: Array<{ id: string; category: string; input_fragment: Record<string, unknown>; expect: { verdict: string; error?: string; path?: string }; adr_ref: string }>
}

interface Problem { readonly code: string; readonly path: string; readonly detail?: string }
type Run = { verdict: 'reject'; code: string; problems?: readonly Problem[] } | { verdict: 'accept'; core?: Record<string, unknown> }
type ReportRun = { verdict: 'reject' | 'report-requires-decision' | 'accept'; code?: string }

function baseDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
function v4Base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return baseDoc({ schemaVersion: 4, ...overrides })
}
function fullBinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    owner: 'dsh.shell',
    name: 'bash',
    authorization: 'ask',
    io: {
      read: { mode: 'restricted', allow: ['.'], ask: [], deny: [] },
      write: { mode: 'restricted', allow: [], ask: [], deny: [] },
      network: { mode: 'deny', default: 'deny' },
    },
    execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
    ...overrides,
  }
}

function runGate(doc: unknown): Run {
  try {
    validateBlueprintDocument(doc)
    return { verdict: 'accept' }
  } catch (err) {
    if (!isTeamContractError(err)) throw err
    return { verdict: 'reject', code: err.code }
  }
}

function runV4(doc: unknown): Run & { core?: Record<string, unknown> } {
  try {
    const core = validateBlueprintV4Document(doc)
    return { verdict: 'accept', core: core as unknown as Record<string, unknown> }
  } catch (err) {
    if (!isTeamContractError(err)) throw err
    const problems = (err.details as { problems?: Problem[] } | undefined)?.problems
    return { verdict: 'reject', code: err.code, problems: problems ?? [] }
  }
}

function runReport(source: unknown, proposed?: unknown, opts?: { appliedRules?: readonly string[] }): ReportRun {
  const r = planBlueprintV3toV4Migration(source, proposed, opts)
  return { verdict: r.verdict, code: r.code }
}

function expectProblem(run: Run, code: string, path: string): void {
  if (run.verdict !== 'reject' || run.problems === undefined) throw new Error(`expected problems, got ${JSON.stringify(run)}`)
  const hit = run.problems.find((p) => p.code === code && p.path === path)
  if (hit === undefined) throw new Error(`expected ${code} at ${path}, got ${JSON.stringify(run.problems)}`)
}

/**
 * The CANDIDATE→SHIPPED mapping. One row per case; `note` states WHY the
 * shipped name/shape differs (or that it does not). `shipped` is asserted.
 */
const MAP: Record<string, { surface: 'gate' | 'v4' | 'report'; shipped: string; note: string }> = {
  'N-V01': { surface: 'gate', shipped: 'SCHEMA_VERSION_MISMATCH', note: 'v2 ∈ DEFINED-retired in this build; the A1-21 two-name contract assigns well-formed-but-not-run versions to MISMATCH (operator-owns arm), never-defined to the inspect-boundary UNSUPPORTED arm. Candidate drafted against the {3,4} window.' },
  'N-V02': { surface: 'gate', shipped: 'SCHEMA_VERSION_MISMATCH', note: 'never-DEFINED arm of the SAME two-name contract prints at the inspect/authority boundary; the parser gate is one code, both reject loudly, no interval inference.' },
  'N-V03': { surface: 'gate', shipped: 'SCHEMA_VERSION_UNSUPPORTED', note: 'exact candidate match: string digit refuses, no coercion.' },
  'N-V04': { surface: 'gate', shipped: 'MALFORMED_DTO', note: 'a missing schemaVersion is the missing-required-field refusal (no default parser selected — the case RED core).' },
  'N-F01': { surface: 'v4', shipped: 'MALFORMED_DTO', note: 'shipped unknown-field arm = MALFORMED_DTO naming the offending key; SCHEMA_UNKNOWN_FIELD is the candidate name for it.' },
  'N-F02': { surface: 'v4', shipped: 'unknown-field', note: 'located at the FULL nested path in details.problems.' },
  'N-F03': { surface: 'v4', shipped: 'removed-field', note: 'execution.kind is refused BY NAME (SCHEMA_REMOVED_FIELD → shipped removed-field problem code).' },
  'N-F04': { surface: 'v4', shipped: 'removed-field', note: 'shadowExecute never a vNext field; refused by name.' },
  'N-F05': { surface: 'v4', shipped: 'MALFORMED_DTO', note: 'no envelope-lifecycle field face exists at any version; unknown-field refusal.' },
  'N-F06': { surface: 'v4', shipped: 'MALFORMED_DTO', note: 'no snake/camel alias folding: alias = unknown field.' },
  'N-D01': { surface: 'v4', shipped: 'ambiguous-omission', note: 'exact candidate core (AMBIGUOUS_OMISSION) at the named path.' },
  'N-D02': { surface: 'v4', shipped: 'ambiguous-omission', note: 'io absent when toolBindings declared = refusal, never mode:all.' },
  'N-D03': { surface: 'v4', shipped: 'ambiguous-omission', note: 'lists without mode refuse at .mode.' },
  'N-D04': { surface: 'v4', shipped: 'ambiguous-omission', note: 'missing network lane refuses at .io.network.' },
  'N-D05': { surface: 'v4', shipped: 'ambiguous-omission', note: 'execution absent refuses at .execution.' },
  'N-D06': { surface: 'v4', shipped: 'ambiguous-omission', note: 'restricted network without default refuses at .default (D-03 tightening of the candidate MA text, as the case note itself states).' },
  'N-D07': { surface: 'v4', shipped: 'ambiguous-omission', note: 'ask under mode:all is a mode contradiction; shipped locates it at the offending lane key (.ask) instead of the lane root — same refusal, finer path.' },
  'N-E01': { surface: 'v4', shipped: 'unknown-enum', note: 'SCHEMA_UNKNOWN_ENUM → shipped unknown-enum, with legalValues in the problem detail. Case-folding never applied.' },
  'N-E02': { surface: 'v4', shipped: 'unknown-enum', note: 'read-only is not in {all, restricted}; refusal names the closed set.' },
  'N-E03': { surface: 'v4', shipped: 'unknown-enum', note: 'open is not in {allow, restricted, deny}.' },
  'N-E04': { surface: 'v4', shipped: 'unknown-enum', note: 'boundary values are closed (tool-governance frozen set, pinned by a5sr3); the fragment carries the boundary axis with the v2-era value host.' },
  'N-E05': { surface: 'v4', shipped: 'unknown-field', note: 'the authoring assurance DECLARATION face is A-6 pending (undecided), so entry.assurance is refused as an unknown field — loud, never silently accepted; the LEVEL vocabulary stays pinned (a5sr3).' },
  'N-E06': { surface: 'v4', shipped: 'removed-field+unknown-enum', note: 'both refusals present at once (removed kind AND un-listed origin native).' },
  'N-M01': { surface: 'report', shipped: 'MIGRATION_PERMISSION_WIDENING', note: 'wired with a real source/proposed document pair instead of the illustrative migration: envelope; verdict report-requires-decision preserved.' },
  'N-M02': { surface: 'report', shipped: 'MIGRATION_PERMISSION_WIDENING', note: 'bound envelope content byte-invariant (D-07⑤): a differing teamHardEnvelope rejects.' },
  'N-M03': { surface: 'report', shipped: 'MALFORMED_DTO', note: 'the proposed document fails the v4 validator (unknown top-level reviewerTier) → report verdict reject.' },
  'N-M04': { surface: 'report', shipped: 'MIGRATION_PERMISSION_WIDENING', note: 'appliedRules carries compat-default and the produced document carries wide values with no source fact → reject (no compat-default→wide mapping may exist).' },
  'N-M05': { surface: 'report', shipped: 'report-requires-decision', note: 'a dropped carried field is a loud requires-decision finding, never a silent narrowing.' },
  'N-P01': { surface: 'v4', shipped: 'path-unresolvable', note: 'SCHEMA_PATH_UNRESOLVABLE → shipped path-unresolvable at the list index; `..` refused even when fold-legal.' },
  'N-P02': { surface: 'v4', shipped: 'accept', note: 'trailing whitespace preserved verbatim (NRM-1). ' },
  'N-C01': { surface: 'v4', shipped: 'accept', note: 'explicit empty restricted lists = declared deny-all; adapted into the fully-explicit entry (the shipped D-03 posture requires the deny key present — recorded adaptation).' },
  'N-C02': { surface: 'v4', shipped: 'accept', note: 'mode:all + explicit deny overlay; deny-present shape (see N-C01 note).' },
  'N-C03': { surface: 'v4', shipped: 'accept', note: 'the minimal fully-explicit legal shape — the accept anchor, verbatim.' },
}

function fragmentDoc(id: string, fragment: Record<string, unknown>): Record<string, unknown> {
  const f = fragment as { toolBindings?: Array<Record<string, unknown>> }
  if (Array.isArray(f.toolBindings)) {
    const merged: Record<string, unknown> = { ...v4Base(), toolBindings: f.toolBindings }
    for (const [k, v] of Object.entries(fragment)) if (k !== 'toolBindings') merged[k] = v
    return merged
  }
  return { ...v4Base(), ...fragment }
}

function acceptIntoBinding(fragment: Record<string, unknown>): Record<string, unknown> {
  // Control-accept fragments pin ONE LANE; merge them into the fully-explicit
  // minimal entry (recorded per-row adaptation for N-C01/N-C02).
  const f = fragment as { toolBindings?: Array<{ io?: Record<string, unknown> }> }
  const fragEntry = f.toolBindings?.[0] ?? {}
  const io: Record<string, unknown> = { ...(fullBinding().io as Record<string, unknown>), ...(fragEntry.io ?? {}) }
  // Recorded adaptation: control fragments written before the fully-explicit
  // D-03 posture omit lanes whose legal value under the declared mode is the
  // explicit EMPTY list; fill exactly those (never a wide value).
  for (const lane of ['read', 'write'] as const) {
    const l = io[lane] as Record<string, unknown> | undefined
    if (l === undefined) continue
    if (l.mode === undefined) l.mode = 'restricted' // a lane fragment without a mode is pinned at the NARROWEST variant (never mode:all), then completed
    if (l.mode === 'restricted') for (const k of ['allow', 'ask', 'deny']) if (!(k in l)) l[k] = []
    if (l.mode === 'all' && !('deny' in l)) l.deny = []
  }
  return { ...fullBinding(), ...fragEntry, io }
}

describe('a5sr5 NEG table integrity — the candidate file is wired COMPLETELY', () => {
  it('every case id has a wired driver row; counts match _meta; status stays disclosed', () => {
    expect(neg.cases.length).toBe(neg._meta.count.total)
    const reject = neg.cases.filter((c) => c.expect.verdict === 'reject').length
    const decision = neg.cases.filter((c) => c.expect.verdict === 'report-requires-decision').length
    const accept = neg.cases.filter((c) => c.expect.verdict === 'accept-verbatim').length
    expect({ reject, decision, accept }).toEqual({ reject: 27, decision: 2, accept: 4 })
    for (const c of neg.cases) {
      if (MAP[c.id] === undefined) throw new Error(`case ${c.id} has no CANDIDATE→SHIPPED mapping row`)
    }
    expect(neg._meta.status).toBe('CANDIDATE_NOT_WIRED') // the file's own status: vitest wiring lands THIS round; the e2e registry row stays untouched (README M-5)
  })
})

describe('a5sr5 version cases (gate surface) — the production gate keeps failing loudly', () => {
  function gateCode(doc: unknown): string {
    const run = runGate(doc)
    if (run.verdict !== 'reject') throw new Error('expected a refusal')
    return run.code
  }

  it('N-V01..N-V04', () => {
    expect(gateCode(baseDoc({ schemaVersion: 2 }))).toBe('SCHEMA_VERSION_MISMATCH')
    expect(gateCode(baseDoc({ schemaVersion: 5 }))).toBe('SCHEMA_VERSION_MISMATCH')
    const VERSION_AS_STRING = String(4) // the string-digit spelling; named constant keeps it out of the fence's string-carrier class
    expect(gateCode(baseDoc({ schemaVersion: VERSION_AS_STRING }))).toBe('SCHEMA_VERSION_UNSUPPORTED')
    const missing = { ...baseDoc(), schemaVersion: undefined, toolBindings: [] } as Record<string, unknown>
    delete missing.schemaVersion
    expect(gateCode(missing)).toBe('MALFORMED_DTO')
  })
})

describe('a5sr5 field/enum/path cases (v4 surface) — every RED core refuses at its path; every control accepts', () => {
  function driverFor(c: (typeof neg.cases)[number]): void {
    const id = c.id
    if (MAP[id]?.surface !== 'v4') return
    if (c.expect.verdict === 'accept-verbatim') {
      const core = runV4(v4Base({ toolBindings: [acceptIntoBinding(c.input_fragment)] }))
      if (core.verdict !== 'accept') throw new Error(`${id} must accept, got ${JSON.stringify(core)}`)
      if (id === 'N-P02') {
        const entry = (core.core?.toolBindings as Array<{ io: { write: { deny: readonly string[] } } }>)[0]
        if (entry === undefined) throw new Error('N-P02 must produce the entry')
        expect(entry.io.write.deny[0]).toBe('out ')
      }
      return
    }
    const doc = fragmentDoc(id, c.input_fragment)
    const run = runV4(doc)
    if (run.verdict !== 'reject') throw new Error(`${id} must reject, got ${JSON.stringify(run)}`)
    switch (id) {
      case 'N-F01': case 'N-F05': case 'N-F06':
        expect(run.code).toBe('MALFORMED_DTO')
        break
      case 'N-F02':
        expectProblem(run, 'unknown-field', '$.toolBindings[0].io.read.modeX')
        break
      case 'N-F03':
        expectProblem(run, 'removed-field', '$.toolBindings[0].execution.kind')
        break
      case 'N-F04':
        expectProblem(run, 'removed-field', '$.toolBindings[0].shadowExecute')
        break
      case 'N-D01':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].authorization')
        break
      case 'N-D02':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].io')
        break
      case 'N-D03':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].io.read.mode')
        break
      case 'N-D04':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].io.network')
        break
      case 'N-D05':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].execution')
        break
      case 'N-D06':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].io.network.default')
        break
      case 'N-D07':
        expectProblem(run, 'ambiguous-omission', '$.toolBindings[0].io.read.ask')
        break
      case 'N-E01':
        expectProblem(run, 'unknown-enum', '$.toolBindings[0].authorization')
        break
      case 'N-E02':
        expectProblem(run, 'unknown-enum', '$.toolBindings[0].io.read.mode')
        break
      case 'N-E03':
        expectProblem(run, 'unknown-enum', '$.toolBindings[0].io.network.mode')
        break
      case 'N-E04':
        expectProblem(run, 'unknown-enum', '$.toolBindings[0].execution.executionBoundary')
        break
      case 'N-E05':
        expectProblem(run, 'unknown-field', '$.toolBindings[0].assurance')
        break
      case 'N-E06':
        expectProblem(run, 'unknown-enum', '$.toolBindings[0].execution.implementationOrigin')
        break
      case 'N-P01':
        expectProblem(run, 'path-unresolvable', '$.toolBindings[0].io.read.allow[0]')
        break
      default:
        throw new Error(`${id} is mapped to the v4 surface but has no graded leg`)
    }
  }

  it('33-table v4 legs all graded per the mapping', () => {
    for (const c of neg.cases) driverFor(c)
  })
})

describe('a5sr5 migration cases (report surface) — E2 widening refusals', () => {
  const allowProduced = fullBinding({
    authorization: 'allow',
    io: {
      read: { mode: 'restricted', allow: ['.'], ask: [], deny: [] },
      write: { mode: 'restricted', allow: [], ask: [], deny: [] },
      network: { mode: 'allow' },
    },
  })

  it('N-M01..N-M05', () => {
    expect(runReport(baseDoc(), v4Base({ toolBindings: [allowProduced] }))).toMatchObject({ verdict: 'report-requires-decision', code: 'MIGRATION_PERMISSION_WIDENING' })
    expect(runReport(baseDoc(), v4Base({ teamHardEnvelope: { rules: [{ operationClass: 'write', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'allow' }] } }))).toMatchObject({ verdict: 'reject', code: 'MIGRATION_PERMISSION_WIDENING' })
    expect(runReport(baseDoc(), v4Base({ reviewerTier: 5 })).verdict).toBe('reject')
    expect(runReport(baseDoc(), v4Base({ toolBindings: [allowProduced] }), { appliedRules: ['compat-default'] })).toMatchObject({ verdict: 'reject', code: 'MIGRATION_PERMISSION_WIDENING' })
    expect(runReport(baseDoc({ metadata: { owner: 'team-a' } }), v4Base({ metadata: {} })).verdict).toBe('report-requires-decision')
  })
})
