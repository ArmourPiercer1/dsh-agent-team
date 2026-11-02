/**
 * a5sf-v4-member-ceiling-projection — P1-01 of the Alpha.5 sandbox-first
 * five-stage plan (`docs/plans/memo/alpha5-sandbox-first-20261101/`).
 *
 * QUESTION THIS FILE ANSWERS (before any code is added): what can the LIVE
 * v4 authoring grammar + the shipped mapping tables express about a
 * **Member-level** read/write/network ceiling, and what is genuinely
 * missing?
 *
 * FINDING (recorded as the RED-first contract below; per-field coverage in
 * `dev/agent-workflow/evidence/a5sf-p1-01/FIELD-COVERAGE.md`):
 *   - v4 already carries PER-TOOL I/O (`toolBindings[].io`: read/write/
 *     network, allow/ask/deny, exact locators) — reused VERBATIM, no second
 *     vocabulary;
 *   - v4 carries NO per-Member global ceiling. `toolBindings[].owner` is the
 *     tool's AUTHORING SOURCE (`authoringOwner`, e.g. `dsh.shell`), NOT a
 *     MemberIdentity — the flip round pinned that meaning and this file
 *     refuses to reinterpret it;
 *   - Alpha.4 `memberEnvelopes` answer "which MUTATION OPERATIONS / exec
 *     tokens" a member may use, not which files it may read/write or
 *     whether it may touch the network. So the ONE missing author carrier is
 *     a Member ceiling, added here as the MINIMAL additive v4 family
 *     `memberIoCeilings` (no v5, no second grammar: same closed lane shapes,
 *     same locator law, same zero-normalization, same present-only hash).
 *
 * LAWS PINNED HERE:
 *  L1 the family is OPTIONAL and absence declares NOTHING — a missing
 *     ceiling is `null`, never a synthesized `read: all`;
 *  L2 a ceiling is bound to a `templateId` that MUST resolve inside the
 *     same blueprint (leader template included) — no free-form member name,
 *     no argv/cwd identity, and `toolBindings[].owner` can never mint one;
 *  L3 per-Member isolation: A's projection never carries B's locators;
 *  L4 a tool-level `mode: all` lane emits ZERO allow locators, so it cannot
 *     invent a path outside the Member ceiling (the intersection itself is
 *     P1-02 `compileEffectiveIo`, not duplicated here);
 *  L5 `network: restricted` keeps parsing and is projected as a TYPED
 *     UNSUPPORTED fact — never coerced to boolean allow/deny (this round
 *     only commits the network boolean);
 *  L6 hash discipline: absent family ⇒ key omitted (old v4 documents hash
 *     byte-identically); declared family ⇒ bound into the hash.
 *
 * @module test/a5sf-v4-member-ceiling-projection
 */
import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import {
  BLUEPRINT_V4_MEMBER_CEILING_FAMILY,
  BLUEPRINT_V4_MEMBER_CEILING_FIELDS,
  BLUEPRINT_V4_TOP_LEVEL_FIELDS,
  findMemberIoCeiling,
  parseBlueprintV4,
  toHashableBlueprintV4,
  validateBlueprintV4Document,
} from '../blueprint/src/index.js'
import type { TeamBlueprintV4Core } from '../blueprint/src/index.js'
import {
  declareV4AuthoringMaps,
  projectV4MemberIoCeiling,
  projectV4ToolBindingAuthoring,
  type MemberCeilingProjection,
  type V4AuthoringMaps,
} from '../vnext-field-mapping/src/index.js'

/** The minimal frozen v3 core (same shape as a5sr2's fixture). */
function v4Doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 4,
    blueprintId: 'team.a5sf.p101',
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [
      { templateId: 'alpha', persona: 'Alpha member.' },
      { templateId: 'beta', persona: 'Beta member.' },
    ],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    ...overrides,
  }
}

/** One fully-explicit read/write lane. */
function rw(mode: 'all' | 'restricted', opts: { allow?: string[]; ask?: string[]; deny?: string[] } = {}): Record<string, unknown> {
  if (mode === 'all') return { mode: 'all', deny: opts.deny ?? [] }
  return { mode: 'restricted', allow: opts.allow ?? [], ask: opts.ask ?? [], deny: opts.deny ?? [] }
}

/** One fully-explicit network lane. */
function net(mode: 'allow' | 'restricted' | 'deny'): Record<string, unknown> {
  if (mode === 'allow') return { mode: 'allow' }
  if (mode === 'deny') return { mode: 'deny', default: 'deny' }
  return { mode: 'restricted', allow: ['api.example.test:443'], ask: [], deny: [], default: 'deny' }
}

/** A Member ceiling entry, fully explicit (D-03: no implicit defaults). */
function ceiling(templateId: string, read: Record<string, unknown>, write: Record<string, unknown>, network: Record<string, unknown>): Record<string, unknown> {
  return { templateId, io: { read, write, network } }
}

/**
 * The THREE real-shaped v4 blueprints P1-01 asks for:
 *  - MEMBER_A: read-only A, write-only B (disjoint trees; read/write split);
 *  - MEMBER_B: the same persistent `bash` tool, read C / write D;
 *  - TOOL_NARROWING: the same Member's `read` tool narrowed FURTHER than the
 *    Member ceiling by a per-tool restricted lane;
 *  - LEADER and an UNKNOWN CLI binding both ride the SAME Member-ceiling
 *    lookup (the second binding is not declared anywhere as a Member).
 */
function twoMemberDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return v4Doc({
    members: [
      { templateId: 'alpha', persona: 'Alpha member.' },
      { templateId: 'beta', persona: 'Beta member.' },
      { templateId: 'gamma', persona: 'Gamma member.' },
    ],
    memberIoCeilings: [
      ceiling('leader', rw('restricted', { allow: ['team/'] }), rw('restricted', { allow: ['team/out'] }), net('deny')),
      ceiling('alpha', rw('restricted', { allow: ['/work/a'], deny: ['/work/a/secret'] }), rw('restricted', { allow: ['/work/b'] }), net('allow')),
      ceiling('beta', rw('restricted', { allow: ['/work/c'] }), rw('restricted', { allow: ['/work/d'] }), net('deny')),
      // gamma declares NO ceiling row ON PURPOSE (L1 absence law + L4 tool narrowing).
    ],
    toolBindings: [
      {
        owner: 'dsh.shell',
        name: 'bash',
        authorization: 'ask',
        io: { read: rw('all'), write: rw('all'), network: net('allow') },
        execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
      },
      {
        owner: 'dsh.fs',
        name: 'read',
        authorization: 'allow',
        io: { read: rw('restricted', { allow: ['/work/a/docs'] }), write: rw('restricted', { allow: [] }), network: net('deny') },
        execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
      },
      {
        owner: 'vendor.example',
        name: 'never-heard-of-it',
        authorization: 'allow',
        io: { read: rw('all'), write: rw('all'), network: net('deny') },
        execution: { implementationOrigin: 'standalone-runner', executionBoundary: 'confined-subprocess' },
      },
    ],
    ...overrides,
  })
}

function yamlOf(record: Record<string, unknown>): string {
  // JSON is valid YAML 1.2 — the frontmatter decoder accepts it, and using
  // the SAME record for the object-level and source-level legs keeps the two
  // faces from drifting apart in the test.
  return `---\n${JSON.stringify(record, null, 2)}\n---\n`
}

/** Fixture accessor: the Nth declared tool binding as a plain record. */
function toolBindingAt(doc: Record<string, unknown>, index: number): Record<string, unknown> {
  const list = doc['toolBindings']
  if (!Array.isArray(list)) throw new Error('fixture declares no toolBindings')
  const entry = list[index]
  if (typeof entry !== 'object' || entry === null) throw new Error(`fixture binding ${String(index)} is not a record`)
  return entry as Record<string, unknown>
}

/** The three projected io lanes of a tool binding. */
function toolIo(binding: { readonly ok: boolean; readonly value?: Readonly<Record<string, unknown>> }): Record<string, Readonly<Record<string, unknown>>> {
  return binding.value?.['io'] as Record<string, Readonly<Record<string, unknown>>>
}

function maps(): V4AuthoringMaps {
  const declared = declareV4AuthoringMaps()
  if (!declared.ok) throw new Error(`v4 tables refused: ${declared.detail}`)
  return declared.maps
}

function expectRefusal(run: () => unknown, code: string, path: string, problemsKey = 'problems'): void {
  try {
    run()
  } catch (error) {
    expect(isTeamContractError(error)).toBe(true)
    const details = (error as { details?: Record<string, unknown> }).details ?? {}
    const problems = details[problemsKey]
    expect(Array.isArray(problems)).toBe(true)
    const found = (problems as readonly { code: string; path: string }[]).find((p) => p.code === code && p.path === path)
    expect(found, `expected a ${code} problem at ${path}; got ${JSON.stringify(problems)}`).toBeDefined()
    return
  }
  throw new Error(`expected a refusal with ${code} at ${path}, but the document was accepted`)
}

/** Project every declared ceiling of a parsed v4 core. */
function projectAll(doc: TeamBlueprintV4Core): Map<string, MemberCeilingProjection> {
  const table = maps()
  const out = new Map<string, MemberCeilingProjection>()
  for (const entry of doc.memberIoCeilings ?? []) {
    const projected = projectV4MemberIoCeiling(table, entry)
    if (!projected.ok) throw new Error(`member ceiling refused: ${projected.code} ${projected.detail}`)
    out.set(String(projected.value['templateId']), projected.value as unknown as MemberCeilingProjection)
  }
  return out
}

function locators(projected: Readonly<Record<string, unknown>>, disposition: 'allow' | 'ask' | 'deny'): readonly string[] {
  const list = projected[disposition]
  return Array.isArray(list) ? (list as readonly string[]) : []
}

describe('P1-01 · the Member ceiling author carrier is the minimal ADDITIVE v4 family', () => {
  it('adds exactly one top-level key, derived from the frozen v4 face (no v5, no second grammar)', () => {
    expect(BLUEPRINT_V4_MEMBER_CEILING_FAMILY).toBe('memberIoCeilings')
    expect(BLUEPRINT_V4_TOP_LEVEL_FIELDS).toContain(BLUEPRINT_V4_MEMBER_CEILING_FAMILY)
    expect(BLUEPRINT_V4_TOP_LEVEL_FIELDS).toContain('toolBindings')
    expect(new Set(BLUEPRINT_V4_TOP_LEVEL_FIELDS).size).toBe(BLUEPRINT_V4_TOP_LEVEL_FIELDS.length)
    expect([...BLUEPRINT_V4_MEMBER_CEILING_FIELDS]).toEqual(['templateId', 'io'])
  })

  it('reuses the v4 closed lane shapes for the ceiling (same three axes, same variants)', () => {
    const parsed = parseBlueprintV4(yamlOf(twoMemberDoc()))
    const alpha = findMemberIoCeiling(parsed, 'alpha')
    expect(alpha).toBeDefined()
    expect(alpha?.io.read.mode).toBe('restricted')
    expect(alpha?.io.write.mode).toBe('restricted')
    expect(alpha?.io.network.mode).toBe('allow')
    // The exact same lane objects the per-tool family uses: no parallel
    // vocabulary, no second mode spelling.
    expect(Object.keys(alpha?.io ?? {}).sort()).toEqual(['network', 'read', 'write'])
  })
})

describe('P1-01 · L1 absence declares NOTHING', () => {
  it('a v4 document without the family parses and every member ceiling lookup is null', () => {
    const doc = v4Doc()
    const parsed = parseBlueprintV4(yamlOf(doc))
    expect(parsed.memberIoCeilings).toBeUndefined()
    expect(findMemberIoCeiling(parsed, 'alpha')).toBeNull()
    expect(findMemberIoCeiling(parsed, 'leader')).toBeNull()
    // absence must never be reported as an unrestricted ceiling
    expect(projectAll(parsed).size).toBe(0)
  })

  it('a declared family may omit a member row — that member still has NO ceiling, never a synthesized one', () => {
    const parsed = parseBlueprintV4(yamlOf(twoMemberDoc()))
    expect(findMemberIoCeiling(parsed, 'gamma')).toBeNull()
    expect(projectAll(parsed).has('gamma')).toBe(false)
  })

  it('an empty family declares nothing (legal, like an empty toolBindings list)', () => {
    const parsed = validateBlueprintV4Document(v4Doc({ memberIoCeilings: [] }))
    expect(parsed.memberIoCeilings).toEqual([])
    expect(findMemberIoCeiling(parsed, 'alpha')).toBeNull()
  })
})

describe('P1-01 · L2 the ceiling binds a TRUSTED blueprint templateId — never a tool owner or free text', () => {
  it('resolves the leader template as well as member templates', () => {
    const parsed = parseBlueprintV4(yamlOf(twoMemberDoc()))
    expect(findMemberIoCeiling(parsed, 'leader')?.templateId).toBe('leader')
    expect(findMemberIoCeiling(parsed, 'beta')?.templateId).toBe('beta')
  })

  it('refuses an unknown templateId (identity is closed over this blueprint)', () => {
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({ memberIoCeilings: [ceiling('nobody', rw('all'), rw('all'), net('deny'))] })),
      'path-unresolvable',
      '$.memberIoCeilings[0].templateId',
    )
  })

  it('refuses a duplicate binding for the same member', () => {
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({
        memberIoCeilings: [
          ceiling('alpha', rw('all'), rw('all'), net('deny')),
          ceiling('alpha', rw('restricted', { allow: ['/x'] }), rw('all'), net('allow')),
        ],
      })),
      'duplicate-member-ceiling',
      '$.memberIoCeilings[1].templateId',
    )
  })

  it('`toolBindings[].owner` is the tool SOURCE, not a Member: an owner named like a member mints no ceiling', () => {
    const doc = v4Doc({
      members: [{ templateId: 'alpha', persona: 'Alpha member.' }],
      toolBindings: [{
        owner: 'alpha',
        name: 'bash',
        authorization: 'ask',
        io: { read: rw('all'), write: rw('all'), network: net('allow') },
        execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
      }],
    })
    const parsed = parseBlueprintV4(yamlOf(doc))
    expect(findMemberIoCeiling(parsed, 'alpha')).toBeNull()
    const binding = projectV4ToolBindingAuthoring(maps(), toolBindingAt(doc, 0))
    expect(binding.ok).toBe(true)
    // the projected core says authoringOwner — never memberIdentity
    expect(binding.ok && binding.value['authoringOwner']).toBe('alpha')
    expect(binding.ok && Object.hasOwn(binding.value, 'memberIdentity')).toBe(false)
  })

  it('refuses an entry key outside the closed shape, a missing lane and an implicit mode', () => {
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({ memberIoCeilings: [{ templateId: 'alpha', io: { read: rw('all'), write: rw('all'), network: net('deny') }, extra: 1 }] })),
      'unknown-field',
      '$.memberIoCeilings[0].extra',
    )
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({ memberIoCeilings: [{ templateId: 'alpha', io: { read: rw('all'), write: rw('all') } }] })),
      'ambiguous-omission',
      '$.memberIoCeilings[0].io.network',
    )
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({ memberIoCeilings: [{ templateId: 'alpha', io: { read: { deny: [] }, write: rw('all'), network: net('deny') } }] })),
      'ambiguous-omission',
      '$.memberIoCeilings[0].io.read.mode',
    )
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({ memberIoCeilings: [ceiling('alpha', rw('restricted', { allow: ['/a/../b'] }), rw('all'), net('deny'))] })),
      'path-unresolvable',
      '$.memberIoCeilings[0].io.read.allow[0]',
    )
  })

  it('refuses a non-array family (a declared family is explicit)', () => {
    expectRefusal(
      () => validateBlueprintV4Document(twoMemberDoc({ memberIoCeilings: { alpha: {} } })),
      'field-type',
      '$.memberIoCeilings',
    )
  })
})

describe('P1-01 · L3 per-Member projection is isolated (A never carries B’s locators)', () => {
  it('projects A and B to disjoint read/write sets and disjoint network booleans', () => {
    const parsed = parseBlueprintV4(yamlOf(twoMemberDoc()))
    const projected = projectAll(parsed)
    const alpha = projected.get('alpha')!
    const beta = projected.get('beta')!
    expect(locators(alpha.io.read as Readonly<Record<string, unknown>>, 'allow')).toEqual(['/work/a'])
    expect(locators(beta.io.read as Readonly<Record<string, unknown>>, 'allow')).toEqual(['/work/c'])
    expect(locators(alpha.io.write as Readonly<Record<string, unknown>>, 'allow')).toEqual(['/work/b'])
    expect(locators(beta.io.write as Readonly<Record<string, unknown>>, 'allow')).toEqual(['/work/d'])
    expect(locators(alpha.io.read as Readonly<Record<string, unknown>>, 'deny')).toEqual(['/work/a/secret'])
    expect(locators(beta.io.read as Readonly<Record<string, unknown>>, 'deny')).toEqual([])
    expect(alpha.networkCeiling).toEqual({ kind: 'boolean', access: 'allow', declaredMode: 'allow' })
    expect(beta.networkCeiling).toEqual({ kind: 'boolean', access: 'deny', declaredMode: 'deny' })
    // the crossing assertion, in both directions
    expect(JSON.stringify(alpha)).not.toContain('/work/c')
    expect(JSON.stringify(alpha)).not.toContain('/work/d')
    expect(JSON.stringify(beta)).not.toContain('/work/a')
    expect(JSON.stringify(beta)).not.toContain('/work/b')
  })

  it('resource declarations keep the lane rights (read vs write vs connect) and no canonicalization happens', () => {
    const parsed = parseBlueprintV4(yamlOf(twoMemberDoc()))
    const alpha = projectAll(parsed).get('alpha')!
    const decls = alpha.resourceDeclarations
    // every declared disposition becomes its own declaration (allow AND deny):
    expect(decls.filter((d) => d.lane === 'read' && d.disposition === 'allow').map((d) => d.locator)).toEqual(['/work/a'])
    expect(decls.filter((d) => d.lane === 'read' && d.disposition === 'deny').map((d) => d.locator)).toEqual(['/work/a/secret'])
    expect(decls.filter((d) => d.lane === 'write' && d.disposition === 'allow').map((d) => d.locator)).toEqual(['/work/b'])
    expect(decls.filter((d) => d.lane === 'network').map((d) => d.locator)).toEqual([])
    expect(decls.every((d) => d.canonical === false)).toBe(true)
    expect(decls.filter((d) => d.lane === 'read').every((d) => d.rights.includes('read'))).toBe(true)
    expect(decls.filter((d) => d.lane === 'write').every((d) => d.rights.includes('write'))).toBe(true)
  })

  it('is frozen: a projected ceiling cannot be mutated into a wider one', () => {
    const parsed = parseBlueprintV4(yamlOf(twoMemberDoc()))
    const alpha = projectAll(parsed).get('alpha')!
    expect(Object.isFrozen(alpha)).toBe(true)
    expect(Object.isFrozen(alpha.io)).toBe(true)
    expect(Object.isFrozen(alpha.resourceDeclarations)).toBe(true)
  })
})

describe('P1-01 · L4 a tool-level `all` lane cannot invent a path outside the Member ceiling', () => {
  it('projects `mode: all` as a mode flag with ZERO allow locators (no synthesized realm root)', () => {
    const binding = projectV4ToolBindingAuthoring(maps(), toolBindingAt(twoMemberDoc(), 0))
    expect(binding.ok).toBe(true)
    if (!binding.ok) return
    const io = toolIo(binding)
    const readLane = io['read'] as Readonly<Record<string, unknown>>
    const writeLane = io['write'] as Readonly<Record<string, unknown>>
    expect(readLane['mode']).toBe('all')
    expect(locators(readLane, 'allow')).toEqual([])
    expect(locators(writeLane, 'allow')).toEqual([])
    const readWriteDecls = (binding.value['resourceDeclarations'] as readonly { lane: string }[]).filter((d) => d.lane === 'read' || d.lane === 'write')
    expect(readWriteDecls).toEqual([])
  })

  it('a per-tool restricted lane narrows within the same Member (and is not merged into the ceiling)', () => {
    const doc = twoMemberDoc()
    const parsed = parseBlueprintV4(yamlOf(doc))
    const alpha = projectAll(parsed).get('alpha')!
    const readTool = projectV4ToolBindingAuthoring(maps(), toolBindingAt(doc, 1))
    expect(readTool.ok).toBe(true)
    if (!readTool.ok) return
    const toolRead = toolIo(readTool)['read'] as Readonly<Record<string, unknown>>
    expect(locators(toolRead, 'allow')).toEqual(['/work/a/docs'])
    // the ceiling itself is unchanged by tool declarations
    expect(locators(alpha.io.read as Readonly<Record<string, unknown>>, 'allow')).toEqual(['/work/a'])
  })
})

describe('P1-01 · L5 `network: restricted` parses but is a TYPED unsupported fact', () => {
  it('projects restricted as UNSUPPORTED — never as boolean allow or deny', () => {
    const parsed = parseBlueprintV4(yamlOf(v4Doc({
      memberIoCeilings: [ceiling('alpha', rw('all'), rw('all'), net('restricted'))],
    })))
    const alpha = projectAll(parsed).get('alpha')!
    expect(alpha.networkCeiling).toEqual({
      kind: 'unsupported',
      declaredMode: 'restricted',
      reason: 'network-destination-restricted-not-enforced',
    })
    expect(JSON.stringify(alpha.networkCeiling)).not.toBe(JSON.stringify({ kind: 'boolean', access: 'allow', declaredMode: 'allow' }))
  })

  it('keeps the existing v4 network vocabulary untouched for per-tool bindings', () => {
    const doc = v4Doc({
      toolBindings: [{
        owner: 'dsh.web',
        name: 'web_fetch',
        authorization: 'allow',
        io: { read: rw('all'), write: rw('all'), network: net('restricted') },
        execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
      }],
    })
    const parsed = parseBlueprintV4(yamlOf(doc))
    expect(parsed.toolBindings?.[0]?.io.network.mode).toBe('restricted')
  })
})

describe('P1-01 · L6 hash discipline (present-only, no drift for old documents)', () => {
  it('omits the key from the hashable projection when the family is absent', () => {
    const parsed = parseBlueprintV4(yamlOf(v4Doc()))
    const hashable = toHashableBlueprintV4(parsed)
    expect(Object.hasOwn(hashable, BLUEPRINT_V4_MEMBER_CEILING_FAMILY)).toBe(false)
  })

  it('binds the declared family into the hash (two docs differing only there hash differently)', () => {
    const without = parseBlueprintV4(yamlOf(v4Doc()))
    const withFamily = parseBlueprintV4(yamlOf(v4Doc({
      memberIoCeilings: [ceiling('alpha', rw('restricted', { allow: ['/work/a'] }), rw('restricted', { allow: ['/work/b'] }), net('deny'))],
    })))
    expect(withFamily.contentHash).not.toBe(without.contentHash)
    expect(Object.hasOwn(toHashableBlueprintV4(withFamily), BLUEPRINT_V4_MEMBER_CEILING_FAMILY)).toBe(true)
  })

  it('changing only one locator changes the hash (the ceiling is not laundered)', () => {
    const base = v4Doc({ memberIoCeilings: [ceiling('alpha', rw('restricted', { allow: ['/work/a'] }), rw('all'), net('deny'))] })
    const widened = v4Doc({ memberIoCeilings: [ceiling('alpha', rw('restricted', { allow: ['/work/a', '/work/z'] }), rw('all'), net('deny'))] })
    expect(parseBlueprintV4(yamlOf(base)).contentHash).not.toBe(parseBlueprintV4(yamlOf(widened)).contentHash)
  })
})
