/**
 * a5m2-bsearch-team-c1.test.ts — the AUTHOR-SIDE spec of the A5M2 B-SEARCH
 * vertical slice (CENTER M0 无主行分配 card, 2026-10-25): the 'B-SEARCH'
 * table entry, the committed arm (governed-families/search.mjs,
 * adapterRevision 1) and the plane mount gate
 * (team-tool-plane.mjs searchEnabled + backends.searchGoverned).
 *
 * THE PAIRING IS THE POINT: the REQUIRED real-new-mint to same-validator
 * legs (the discipline this lane handed the B-SUBAGENT mint owners) are
 * executed HERE, against the real arm's real minted manifests and the real
 * published validator - no synthetic stand-in carries an accept leg.
 * Synthetic claims appear ONLY in labeled validator-side refusal legs.
 *
 * THE FACE IS MEASURED, NOT MIRRRORED: the argument law legs are pinned
 * against the published 639 face (read-only at
 * 639ed015397290b3745d163aafe02ffee4aa3f84: tool-fs-search grep.ts:285-340
 * {pattern required, path?, include?} / glob.ts:296-353 {pattern required,
 * path?}). The face BYTES the rows mount are transcribed in this fixture
 * (test-world capture); the production mount captures from the live host —
 * the arm REFUSES to invent them (construction refusal, pinned below).
 *
 * TIER: 接线未测 at the author level. NO leg here claims a live-Host
 * wiring round, an install, C2, or the confined backends' own behavior
 * (their laws are signed and spec'd in alpha5-search-backend/glob rounds —
 * reused untouched). The stub backend below only proves the arm ROUTES.
 */
import { describe, expect, it } from 'vitest'

import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'

interface MintResult {
  ok?: boolean
  code?: string
  detail?: string
  plan?: unknown
  effects?: unknown
  parametersFingerprint?: string
  targetManifest?: Record<string, unknown>
  reviewPayload?: { familyId?: string; adapterRevision?: number; providerIdentity?: string; targetManifest?: Record<string, unknown> }
}

interface SearchModule {
  A5_B_SEARCH_FAMILY_ID: string
  A5_B_SEARCH_ADAPTER_REVISION: number
  A5_B_SEARCH_OPERATIONS: Record<string, string>
  A5_B_SEARCH_CENSUS_NAMES: string[]
  createBSearchArm: (config: Record<string, unknown>) => {
    familyId: string
    adapterRevision: number
    providerId: string
    recordIndex: Record<string, number>
    dispose: () => void
    rows: Array<{
      name: string
      familyId: string
      adapterRevision: number
      operation: string
      description: string
      parameters: Record<string, unknown>
      classify: (raw: unknown, callId: string, exec: unknown) => MintResult
      delegate: (plan: unknown, ctx: Record<string, unknown>) => Promise<{ ok?: boolean; code?: string; detail?: string; settled?: boolean; value?: { text?: string } }>
    }>
  }
  [key: string]: unknown
}

const SEARCH = (await import(new URL('../src/plugin/live/governed-families/search.mjs', import.meta.url).href)) as unknown as SearchModule
const PLANE = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as unknown as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok?: boolean; code?: string; message?: string; value?: { definitions: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }> } }
}

const ROOT = '/governed/root'
const REALM = 'a5bs-realm'

/** The 639 face bytes, transcribed for the TEST WORLD (production captures
 *  live; the arm refuses to invent either way). */
const FACE = {
  team_grep: {
    description: 'Search file contents with a ripgrep regular expression. Returns matching lines with line numbers, grouped by file.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regular expression to search for (ripgrep syntax).' },
        path: { type: 'string', description: 'File or directory to search. Defaults to the session workspace; a relative path resolves against it.' },
        include: { type: 'string', description: 'One glob filter for which files to search (e.g. "*.ts", "*.{js,jsx}"). Not a list; negation is not supported.' },
      },
      required: ['pattern'],
    },
  },
  team_glob: {
    description: 'Find files, not directories, whose paths match a glob pattern, including hidden and ignored files.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern to match file paths against (e.g. "**/*.ts", "src/**/*.test.js").' },
        path: { type: 'string', description: 'Directory to search in. Defaults to the session workspace; a relative path resolves against it.' },
      },
      required: ['pattern'],
    },
  },
} as const

const stubBackend = (seen: unknown[]) => ({
  backendId: 'a5bs-stub-backend',
  execCount: () => seen.length,
  run: async (call: unknown) => {
    seen.push(call)
    return {
      ok: true,
      outcome: { outputMode: 'content', matches: [], counts: [], files: [], totalMatches: 0, truncated: false },
      settlement: { kind: 'completed' },
    }
  },
})

const EXEC = Object.freeze({
  token: Symbol('exec-token'),
  callId: 'host-call-1',
  agent: { id: 'member-1', session: { header: { id: 'hdr-1' } } },
})

function buildArm(extra: Record<string, unknown> = {}) {
  const seen: unknown[] = []
  const arm = SEARCH.createBSearchArm({
    realmId: REALM,
    memberAgentId: 'member-1',
    sessionHeaderId: 'hdr-1',
    providerId: 'a5bs-provider',
    rootDir: ROOT,
    mounted: ['team_grep', 'team_glob'],
    backends: { team_grep: stubBackend(seen), team_glob: stubBackend(seen) },
    face: FACE,
    decide: () => ({ kind: 'allow' }),
    spill: null,
    ...extra,
  })
  return { arm, seen }
}

const rowOf = (arm: ReturnType<typeof buildArm>['arm'], name: string) => {
  const row = arm.rows.find((r) => r.name === name)
  if (row === undefined) throw new Error(`row ${name} missing`)
  return row
}

const without = (target: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(target).filter(([name]) => name !== key))

describe('A5M2 B-SEARCH table entry (the +1 FP-E row; signed-grammar only)', () => {
  it('entry is EXACTLY the shipped literal (11 shared leaves, operation-leaf variant, grep adds include; currentFields = mount-restatable facts)', () => {
    expect(PA_FAMILY_TARGET_RULES['B-SEARCH']).toEqual({
      required: {
        familyId: 'string',
        adapterRevision: 'nonNegativeInt',
        operation: 'string',
        realmId: 'string',
        pattern: 'string',
        path: 'nullableString',
        canonicalTarget: 'string',
        anchorLaw: 'string',
        effectLaw: 'string',
        callerMemberAgentId: 'string',
        callerSessionHeaderId: 'string',
      },
      variant: {
        leaf: 'operation',
        by: {
          'team-grep-content-search': { adds: { include: 'nullableString' }, binds: {} },
          'team-glob-path-match': { adds: {}, binds: {} },
        },
      },
      currentFields: ['operation', 'realmId', 'callerMemberAgentId', 'callerSessionHeaderId'],
    })
  })

  it('NO new kinds: every leaf kind of the entry rides the closed seven', () => {
    const closed = new Set(['string', 'boolean', 'nonNegativeInt', 'countsTriple', 'obligations', 'nullableString', 'stringArray'])
    const rule = PA_FAMILY_TARGET_RULES['B-SEARCH'] as unknown as { required: Record<string, string>; variant: { by: Record<string, { adds: Record<string, string> }> } }
    const kinds = [...Object.values(rule.required), ...Object.values(rule.variant.by).flatMap((g) => Object.values(g.adds))]
    for (const kind of kinds) expect(closed.has(kind), kind).toBe(true)
  })

  it('census cross-pair: the variant constants of the TABLE and the OPERATIONS of the ARM are the same closed set (one mint source, no forked vocabulary)', () => {
    const tableOps = Object.keys((PA_FAMILY_TARGET_RULES['B-SEARCH'] as unknown as { variant: { by: Record<string, unknown> } }).variant.by).sort()
    expect(tableOps).toEqual(Object.values(SEARCH.A5_B_SEARCH_OPERATIONS).sort())
    expect(tableOps).toEqual(['team-glob-path-match', 'team-grep-content-search'])
  })

  it('REQUIRED PAIRING (real mint): the REAL arm classify of a REAL 639 team_grep call mints a manifest the REAL validator ACCEPTS, and its key set is required-union-grep-adds EXACTLY', () => {
    const { arm } = buildArm()
    const mint = rowOf(arm, 'team_grep').classify({ pattern: 'TODO', path: 'src', include: '*.ts' }, 'corr-1', EXEC)
    expect(mint.ok).toBe(true)
    const manifest = mint.targetManifest as Record<string, unknown>
    expect(validatePaFamilyTarget('B-SEARCH', manifest)).toBeUndefined()
    expect(Object.keys(manifest).sort()).toEqual([
      'adapterRevision', 'anchorLaw', 'callerMemberAgentId', 'callerSessionHeaderId', 'canonicalTarget',
      'effectLaw', 'familyId', 'include', 'operation', 'path', 'pattern', 'realmId',
    ])
    expect(mint.reviewPayload?.targetManifest).toBe(manifest)
  })

  it('REQUIRED PAIRING (real mint): the REAL glob mint is ACCEPTED and carries NO include key (the published glob face has none; the table adds none)', () => {
    const { arm } = buildArm()
    const mint = rowOf(arm, 'team_glob').classify({ pattern: '**/*.ts' }, 'corr-2', EXEC)
    expect(mint.ok).toBe(true)
    const manifest = mint.targetManifest as Record<string, unknown>
    expect(validatePaFamilyTarget('B-SEARCH', manifest)).toBeUndefined()
    expect('include' in manifest).toBe(false)
    expect(Object.keys(manifest).sort()).toEqual([
      'adapterRevision', 'anchorLaw', 'callerMemberAgentId', 'callerSessionHeaderId', 'canonicalTarget',
      'effectLaw', 'familyId', 'operation', 'path', 'pattern', 'realmId',
    ])
  })

  it('variant law (validator-side legs, SYNTHETIC claims — labeled as such)', () => {
    const { arm } = buildArm()
    const grep = rowOf(arm, 'team_grep').classify({ pattern: 'x' }, 'corr-3', EXEC).targetManifest as Record<string, unknown>
    expect(validatePaFamilyTarget('B-SEARCH', { ...grep, operation: 'team-grep-content-search-v2' }))
      .toBe("operation: 'team-grep-content-search-v2' selects no B-SEARCH variant group")
    // The glob group carrying grep's adds-leaf is OUTSIDE the typed plan:
    // the shape the arm itself refuses at classify (pinned below) is ALSO
    // refused by the table — a hand-rolled claim cannot smuggle it either.
    expect(validatePaFamilyTarget('B-SEARCH', { ...grep, operation: 'team-glob-path-match' }))
      .toBe('include: not part of the B-SEARCH typed plan')
    expect(validatePaFamilyTarget('B-SEARCH', without(grep, 'pattern')))
      .toBe('pattern: required by the B-SEARCH typed plan, absent')
    expect(validatePaFamilyTarget('B-SEARCH', { ...grep, adapterRevision: 'r1' }))
      .toBe('adapterRevision: not a nonNegativeInt')
    expect(validatePaFamilyTarget('B-SEARCH', { ...grep, extraFact: 'x' }))
      .toBe('extraFact: not part of the B-SEARCH typed plan')
  })

  it('three-state discipline at the validator: null accepted, string accepted, absent refused (missing != null != "")', () => {
    const { arm } = buildArm()
    const base = rowOf(arm, 'team_grep').classify({ pattern: 'x' }, 'corr-4', EXEC).targetManifest as Record<string, unknown>
    expect(base.path).toBeNull()
    expect(validatePaFamilyTarget('B-SEARCH', base)).toBeUndefined()
    expect(validatePaFamilyTarget('B-SEARCH', { ...base, path: '' })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SEARCH', without(base, 'path')))
      .toBe('path: required by the B-SEARCH typed plan, absent')
  })

  it('unregistered family still denies with the familyId leg', () => {
    expect(validatePaFamilyTarget('B-DOMAIN', {})).toBe("familyId: no target structure is registered for 'B-DOMAIN'")
  })
})

describe('A5M2 B-SEARCH arm (measured 639 face law + team-family caller law)', () => {
  it('grep accept: manifest facts are the measured face + mount facts (operation constant, anchored root, closed effect pair I+F)', () => {
    const { arm } = buildArm()
    const mint = rowOf(arm, 'team_grep').classify({ pattern: 'TODO', path: 'sub/dir' }, 'corr-5', EXEC)
    expect(mint.ok).toBe(true)
    const m = mint.targetManifest as Record<string, unknown>
    expect(m.operation).toBe('team-grep-content-search')
    expect(m.realmId).toBe(REALM)
    expect(m.canonicalTarget).toBe('/governed/root/sub/dir')
    expect(m.callerMemberAgentId).toBe('member-1')
    expect(m.callerSessionHeaderId).toBe('hdr-1')
    expect(m.familyId).toBe('B-SEARCH')
    expect(m.adapterRevision).toBe(1)
    expect(mint.effects).toEqual([
      { kind: 'tool-invoke', toolName: 'team_grep', resource: null },
      { kind: 'read', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: '/governed/root/sub/dir', rights: ['read'] } },
    ])
  })

  it('path absent anchors the GOVERNED ROOT ITSELF; three states mint distinct manifests (absent->null, ""->anchor refusal, never a silent root)', () => {
    const { arm } = buildArm()
    const absent = rowOf(arm, 'team_glob').classify({ pattern: '*' }, 'corr-6', EXEC)
    expect((absent.targetManifest as Record<string, unknown>).canonicalTarget).toBe('/governed/root')
    expect((absent.targetManifest as Record<string, unknown>).path).toBeNull()
    const emptyString = rowOf(arm, 'team_glob').classify({ pattern: '*', path: '' }, 'corr-7', EXEC)
    expect(emptyString.ok).toBe(false)
    expect(emptyString.code).toBe('P_BSEARCH_LOCATOR_REJECTED')
    const includeEmpty = rowOf(arm, 'team_grep').classify({ pattern: 'x', include: '' }, 'corr-8', EXEC)
    expect((includeEmpty.targetManifest as Record<string, unknown>).include).toBe('')
  })

  it('closed face law: off-face keys refuse, NAMED (a team_glob call carrying include is refused - the published glob face has no such parameter)', () => {
    const { arm } = buildArm()
    expect(rowOf(arm, 'team_grep').classify({ pattern: 'x', maxResults: 2 }, 'c', EXEC).code).toBe('P_BSEARCH_CLASSIFY_UNKNOWN_PARAMETER')
    const offFace = rowOf(arm, 'team_glob').classify({ pattern: 'x', include: '*.ts' }, 'c', EXEC)
    expect(offFace.code).toBe('P_BSEARCH_CLASSIFY_UNKNOWN_PARAMETER')
    expect(offFace.detail).toContain('{pattern, path}')
  })

  it('pattern law = the reqString law the published execute path runs (required, string, non-empty); path/include string-only when present', () => {
    const { arm } = buildArm()
    expect(rowOf(arm, 'team_grep').classify({}, 'c', EXEC).code).toBe('P_BSEARCH_CLASSIFY_INVALID_ARGUMENTS')
    expect(rowOf(arm, 'team_grep').classify({ pattern: '' }, 'c', EXEC).code).toBe('P_BSEARCH_CLASSIFY_INVALID_ARGUMENTS')
    expect(rowOf(arm, 'team_grep').classify({ pattern: 7 }, 'c', EXEC).code).toBe('P_BSEARCH_CLASSIFY_INVALID_ARGUMENTS')
    expect(rowOf(arm, 'team_grep').classify({ pattern: 'x', path: 3 }, 'c', EXEC).code).toBe('P_BSEARCH_CLASSIFY_INVALID_ARGUMENTS')
  })

  it('anchor law (IMPORTED): escape and scheme refuse with the imported words; zero disk is a law of classify (nothing to stat)', () => {
    const { arm } = buildArm()
    const esc = rowOf(arm, 'team_grep').classify({ pattern: 'x', path: '../outside' }, 'c', EXEC)
    expect(esc.code).toBe('P_BSEARCH_LOCATOR_REJECTED')
    expect(esc.detail).toContain('escapes the governed root')
    expect(rowOf(arm, 'team_grep').classify({ pattern: 'x', path: 'file:///etc' }, 'c', EXEC).code).toBe('P_BSEARCH_LOCATOR_REJECTED')
  })

  it('team-family caller law: NO identity and FOREIGN identity both refuse at classify (write arm law verbatim)', () => {
    const { arm } = buildArm()
    expect(rowOf(arm, 'team_grep').classify({ pattern: 'x' }, 'c', {}).code).toBe('P_BSEARCH_NO_OWNING_SESSION')
    const foreign = rowOf(arm, 'team_grep').classify({ pattern: 'x' }, 'c', { agent: { id: 'member-2', session: { header: { id: 'hdr-1' } } } })
    expect(foreign.code).toBe('P_BSEARCH_FOREIGN_SESSION')
  })

  it('fingerprint law: FULL-VALUE digest over raw parameters (two spellings of one root are two fingerprints; same args are stable)', () => {
    const { arm } = buildArm()
    const a = rowOf(arm, 'team_grep').classify({ pattern: 'x', path: '.' }, 'c1', EXEC)
    const b = rowOf(arm, 'team_grep').classify({ pattern: 'x', path: ROOT }, 'c2', EXEC)
    const a2 = rowOf(arm, 'team_grep').classify({ pattern: 'x', path: '.' }, 'c3', EXEC)
    expect((a.targetManifest as Record<string, unknown>).canonicalTarget)
      .toBe((b.targetManifest as Record<string, unknown>).canonicalTarget)
    expect(a.parametersFingerprint).not.toBe(b.parametersFingerprint)
    expect(a.parametersFingerprint).toBe(a2.parametersFingerprint)
  })

  it('frozen all the way down: the minted manifest cannot be mutated after mint', () => {
    const { arm } = buildArm()
    const m = rowOf(arm, 'team_grep').classify({ pattern: 'x' }, 'c', EXEC).targetManifest as Record<string, unknown>
    expect(Object.isFrozen(m)).toBe(true)
    expect(Object.isFrozen(m.callerMemberAgentId === 'member-1' ? m : {})).toBe(true)
  })

  it('delegate answers its OWN plan only (a hand-rolled plan is refused with ZERO backend motion)', async () => {
    const { arm, seen } = buildArm()
    const refused = await rowOf(arm, 'team_grep').delegate({ toolName: 'team_grep' }, { exec: EXEC })
    expect(refused.code).toBe('P_BSEARCH_NOT_OWN_PLAN')
    expect(seen.length).toBe(0)
  })

  it('delegate ROUTES to the SIGNED backend through the lane pipeline: face values map through the lane parser (include->glob, disclosed), one run, {text} envelope back', async () => {
    const { arm, seen } = buildArm()
    const row = rowOf(arm, 'team_grep')
    const mint = row.classify({ pattern: 'TODO', path: 'src', include: '*.ts' }, 'corr-9', EXEC)
    const ran = await row.delegate(mint.plan, { exec: EXEC })
    expect(ran.ok).toBe(true)
    expect(ran.settled).toBe(true)
    expect(typeof ran.value?.text).toBe('string')
    expect(seen.length).toBe(1)
    const call = seen[0] as { realmId: string; callId: string; parsedArgs: Record<string, unknown> }
    expect(call.callId).toBe('corr-9')
    expect((call.parsedArgs as Record<string, unknown>).tool).toBe('grep')
    // THE disclosed transcriptions (both in the arm header): the face
    // `include` is the lane's `glob` filter; the mode-less face output is
    // content matches, so the lane-required output_mode rides as 'content'.
    expect((call.parsedArgs as Record<string, unknown>).globFilter).toBe('*.ts')
    expect((call.parsedArgs as Record<string, unknown>).outputMode).toBe('content')
  })

  it('body fresh recheck: a DIFFERENT caller at the body refuses with zero backend (drift is a refusal, never a re-open)', async () => {
    const { arm, seen } = buildArm()
    const row = rowOf(arm, 'team_grep')
    const mint = row.classify({ pattern: 'x', path: '.' }, 'corr-10', EXEC)
    const ran = await row.delegate(mint.plan, { exec: { agent: { id: 'member-9', session: { header: { id: 'hdr-1' } } } } })
    expect(ran.code).toBe('P_BSEARCH_FOREIGN_SESSION')
    expect(seen.length).toBe(0)
  })

  it('dispose = DRAINING: later classify AND earlier-plan delegate refuse, backend untouched', async () => {
    const { arm, seen } = buildArm()
    const row = rowOf(arm, 'team_grep')
    const mint = row.classify({ pattern: 'x', path: '.' }, 'corr-11', EXEC)
    arm.dispose()
    expect(row.classify({ pattern: 'x' }, 'c', EXEC).code).toBe('P_BSEARCH_DRAINING')
    const ran = await row.delegate(mint.plan, { exec: EXEC })
    expect(ran.code).toBe('P_BSEARCH_DRAINING')
    expect(seen.length).toBe(0)
  })

  it('construction law: no backends / no captured face bytes / invented census name all refuse (the arm invents NOTHING)', () => {
    const base = {
      realmId: REALM, memberAgentId: 'm', sessionHeaderId: 'h', providerId: 'p', rootDir: ROOT,
      mounted: ['team_grep'], face: FACE, decide: () => ({ kind: 'allow' }),
    }
    expect(() => SEARCH.createBSearchArm({ ...base, backends: {} })).toThrow(/backends.team_grep is missing/)
    expect(() => SEARCH.createBSearchArm({ ...base, backends: { team_grep: stubBackend([]) }, face: {} })).toThrow(/CAPTURED native/)
    expect(() => SEARCH.createBSearchArm({ ...base, backends: { team_grep: stubBackend([]) }, mounted: ['team_finding'] })).toThrow(/census is closed/)
    const arm = SEARCH.createBSearchArm({ ...base, backends: { team_grep: stubBackend([]) } })
    expect(arm.recordIndex).toEqual({ team_grep: 7, team_glob: 8 })
  })
})

describe('A5M2 B-SEARCH plane mount (closed gate + census validation + one-name-one-slot)', () => {
  const ALLOW = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
  const baseInput = (plane: Record<string, unknown> = {}, backends?: Record<string, unknown>) => ({
    teamSessionId: 'a5bs-team',
    permissionPolicy: ALLOW,
    realmId: REALM,
    templateId: 'a5bs-tpl',
    role: 'member',
    instanceId: 'a5bs-inst',
    plane,
    ...(backends === undefined ? {} : { backends }),
  })

  const armInject = (names: string[]) => {
    const { arm } = buildArm({ mounted: names })
    return {
      searchGoverned: {
        rows: arm.rows,
        familyId: arm.familyId,
        adapterRevision: arm.adapterRevision,
        providerId: arm.providerId,
        dispose: arm.dispose,
      },
    }
  }

  it('gate absent = byte-for-byte zero flip: no durable row, the lane alias row keeps the slot', () => {
    const built = PLANE.createTeamToolPlaneAssembly(baseInput())
    expect(built.ok).toBe(true)
    const rows = (built.value?.definitions ?? []).filter((d) => d.name === 'team_grep')
    expect(rows.length).toBe(1)
    // the lane alias row carries the lane's RICH parameter face (glob/
    // output_mode...); the durable row carries the CLOSED 639 face.
    expect(JSON.stringify(rows[0]?.parameters ?? {})).toContain('output_mode')
  })

  it('pairing law BOTH directions: gate-on without inject refuses; inject without the gate refuses (config law, not wiring)', () => {
    const a = PLANE.createTeamToolPlaneAssembly(baseInput({ searchEnabled: true }))
    expect(a.code).toBe('SEARCH_ROW_INJECT_INVALID')
    expect(a.message).toContain('no governed B-SEARCH rows are injected')
    const b = PLANE.createTeamToolPlaneAssembly(baseInput({}, armInject(['team_grep'])))
    expect(b.code).toBe('SEARCH_ROW_INJECT_INVALID')
    expect(b.message).toContain('searchEnabled is off')
    const c = PLANE.createTeamToolPlaneAssembly(baseInput({ searchEnabled: 'yes' }))
    expect(c.code).toBe('PLANE_CFG_INVALID')
  })

  it('census validation: foreign family, retired revision, guessed name, mismatched operation and missing face bytes all refuse, NAMED', () => {
    const inject = armInject(['team_grep']).searchGoverned as Record<string, unknown>
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...inject, familyId: 'B-GREP' }, 'frozen family'],
      [{ ...inject, adapterRevision: 0 }, 'released arm revision'],
      [{ ...inject, providerId: '' }, 'providerId'],
      [{ ...inject, dispose: undefined }, 'dispose'],
      [{ ...inject, rows: [{ ...(inject.rows as Array<Record<string, unknown>>)[0], name: 'team_finding' }] }, 'not a B-SEARCH census name'],
      [{ ...inject, rows: [{ ...(inject.rows as Array<Record<string, unknown>>)[0], operation: 'team-grep-content-search-v2' }] }, 'must MATCH the frozen census entry'],
      [{ ...inject, rows: [{ ...(inject.rows as Array<Record<string, unknown>>)[0], description: '' }] }, 'captured native description'],
    ]
    for (const [bad, needle] of cases) {
      const built = PLANE.createTeamToolPlaneAssembly(baseInput({ searchEnabled: true }, { searchGoverned: bad }))
      expect(built.code, JSON.stringify(needle)).toBe('SEARCH_ROW_INJECT_INVALID')
      expect(built.message).toContain(needle)
    }
  })

  it('ONE NAME, ONE SLOT: gate-on mounts team_grep as the DURABLE row - the lane alias row yields the slot (exactly one team_grep definition, carrying the arm face bytes; team_glob untouched = byte-equal to the zero-flip build)', () => {
    const gated = PLANE.createTeamToolPlaneAssembly(baseInput({ searchEnabled: true }, armInject(['team_grep'])))
    expect(gated.ok).toBe(true)
    const grepRows = (gated.value?.definitions ?? []).filter((d) => d.name === 'team_grep')
    expect(grepRows.length).toBe(1)
    // THE durable row is unmistakable: it carries the CAPTURED 639 face
    // bytes (closed set incl. `include`, NO lane dials like output_mode).
    expect(JSON.stringify(grepRows[0]?.parameters ?? {})).toContain('include')
    expect(JSON.stringify(grepRows[0]?.parameters ?? {})).not.toContain('output_mode')
    // team_glob UNTOUCHED: the definition equals, byte-for-byte, the one
    // the no-gate (zero-flip) build places for the same name.
    const plain = PLANE.createTeamToolPlaneAssembly(baseInput())
    const globGated = JSON.stringify((gated.value?.definitions ?? []).find((d) => d.name === 'team_glob')?.parameters ?? null)
    const globPlain = JSON.stringify((plain.value?.definitions ?? []).find((d) => d.name === 'team_glob')?.parameters ?? null)
    expect(globGated).toBe(globPlain)
    expect(JSON.parse(globGated)).not.toEqual(FACE.team_glob.parameters)
  })

  it('both names ride their own slots (two rows, two placements): team_glob durable, team_grep durable, one definition each', () => {
    const built = PLANE.createTeamToolPlaneAssembly(baseInput({ searchEnabled: true }, armInject(['team_grep', 'team_glob'])))
    expect(built.ok).toBe(true)
    for (const name of ['team_grep', 'team_glob']) {
      expect((built.value?.definitions ?? []).filter((d) => d.name === name).length, name).toBe(1)
    }
  })

  it('one-name-one-placement against the FIXED spellings: a durable row renamed onto a mounted name refuses (the arm fixture injects a row claiming the todo name)', () => {
    const { arm } = buildArm({ mounted: ['team_grep'] })
    const stolen = {
      searchGoverned: {
        rows: [{ ...arm.rows[0], name: 'todo_write' }],
        familyId: arm.familyId,
        adapterRevision: arm.adapterRevision,
        providerId: arm.providerId,
        dispose: arm.dispose,
      },
    }
    const built = PLANE.createTeamToolPlaneAssembly(baseInput({ searchEnabled: true, todoEnabled: false }, stolen))
    // todoEnabled is off, so 'todo_write' is not taken by a todo row; the
    // name law that MUST answer is the census close (todo_write is not a
    // census name) - the collision branch itself is exercised through
    // readName, which IS a mounted fixed spelling for every mount:
    expect(built.code).toBe('SEARCH_ROW_INJECT_INVALID')
    expect(built.message).toContain('not a B-SEARCH census name')
    const collide = {
      searchGoverned: {
        rows: [{ ...arm.rows[0], name: 'team_grep' }],
        familyId: arm.familyId,
        adapterRevision: arm.adapterRevision,
        providerId: arm.providerId,
        dispose: arm.dispose,
      },
    }
    // The read row takes the durable spelling (the lane alias is renamed
    // out of the way, so verifyPlaneNames answers nothing here — MY gate's
    // one-name-one-placement leg must): refused, named.
    const clash = PLANE.createTeamToolPlaneAssembly({
      ...baseInput({ searchEnabled: true, readName: 'team_grep', names: { grep: 'lane_grep' } }, collide),
    })
    expect(clash.code).toBe('SEARCH_ROW_INJECT_INVALID')
    expect(clash.message).toContain('one name, one placement')
  })
})
