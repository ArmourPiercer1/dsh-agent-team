/**
 * T1: Blueprint Schema + Static Capability Source — test suite.
 *
 * Covers the 11 acceptance test cases from the T1 plan (§5.8):
 * 1. Legacy fixture parse (capabilities absent)
 * 2. New Leader capabilities parse
 * 3. Member A / Member B different capabilities
 * 4. Malformed allow
 * 5. Malformed deny
 * 6. Unknown fields reject
 * 7. Hash includes all capability fields
 * 8. Static source correctly selects Leader
 * 9. Static source correctly selects MemberTemplate
 * 10. Legacy source returns mode: 'legacy'
 * 11. Selective source maps teamTools/skills/mcp to existing PolicyEntry semantics
 *
 * REPAIR (2026-10-09, lane `a4-pr7/capability-negatives`; test-only, no product change).
 * Two independent instrument defects were fixed here; both made this file report facts
 * it had never measured.
 *
 * 1. **The fixture serializer could not emit an array.** `toYamlFrontmatter` emitted a
 *    non-empty array *inline after the key* (`items:         - skill-a`), which the
 *    repository's own YAML parser refuses with `Unexpected block-seq-ind on same line
 *    with key`. Every fixture carrying a non-empty capability list was therefore invalid
 *    YAML, so `parseBlueprint` threw a *decode* error (`parse.ts` -> `MALFORMED_DTO` with
 *    `details.reason='yaml-invalid'`) **before** `validateBlueprintDocument` ever ran.
 *    Measured consequences (probe `scratch/probe-fixtures.py` on the base file: 9
 *    decode refusals): the negative legs `4`, `4b`, `6b` were GREEN on that syntax error,
 *    legs `5` and `6a` reached the validator but asserted only "something threw", and six
 *    further legs were red inside the emitter. Legs `0a`–`0c` now pin the serializer
 *    against the real parser, and every fixture-consuming leg first asserts that its own
 *    fixture decodes — an emitter that cannot be asserted against a parser is what hid
 *    all of this.
 *
 * 2. **The negative legs asserted "something threw".** `expect(...).toThrow()` cannot
 *    tell a YAML syntax error, a `TypeError`, and a closed-vocabulary governance refusal
 *    apart, and all three were available to it. Each negative leg now asserts the
 *    *rejection identity*: the typed `TeamContractError.code`, the `details` that
 *    specific validator branch attaches, and the refusal text. A decode error cannot
 *    produce that shape — it carries `details.reason='yaml-invalid'` and no `path` /
 *    `unknownFields`.
 *
 * Carrier note: these fixtures were written at `schemaVersion: 1`. Plan §7.3 retired
 * document versions 1 and 2 (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`), so a v1
 * document is refused at the version fence and never reaches the capability validator —
 * that fence is exactly what masked the closed-vocabulary law here. The carrier is now
 * the supported version; **the assertions are unchanged**, because this file's subject
 * is the capability schema, not the document version. The refusal of a frozen v1
 * document is owned, green, by `test/blueprint-v1-frozen-resume.test.ts`: this file
 * neither re-asserts it nor deletes the law.
 */

import { describe, it, expect } from 'vitest'

import { parseBlueprint, toHashableBlueprint } from '../blueprint/src/validate.js'
import { decodeYamlFrontmatter, splitFrontmatter } from '../blueprint/src/parse.js'
import type { TeamBlueprint } from '../blueprint/src/types.js'
import type { RemoteSafeRecord } from '../../contracts/src/remote-safe.js'
import {
  staticCapabilitiesOf,
  selectiveToTemplatePolicyValues,
} from '../policy/src/static-capability-source.js'
import type { StaticTemplateCapabilities } from '../policy/src/static-capability-source.js'
import { capture, expectErrorDetails } from './t2-helpers.js'

// Bound through the default import for the same reason `blueprint/src/parse.ts`
// does: `yaml` v2 ships a CJS entry and Node's named-export detection only
// surfaces part of `module.exports`. This is the SAME parser the product uses,
// so a fixture serializer asserted against it is asserted against the real thing.
import yamlModule from 'yaml'

const { parse: yamlParse } = yamlModule

// ---------------------------------------------------------------------------
// Fixture carrier
// ---------------------------------------------------------------------------

/**
 * The document version the fixtures ride. Plan §7.3 made v3 the only supported
 * blueprint document version, and YAML decode happens before the version fence,
 * so a fixture on a retired version cannot reach the validator at all.
 */
const CARRIER_SCHEMA_VERSION = 3

/**
 * The two v3 authority documents, declared as `rules: []`.
 *
 * This is the STRICTEST legal declaration, not a filler: a declared empty
 * `rules` list means NO expansion authority (`validateAuthorityEnvelope`), and
 * an absent/empty hard document evaluates as `no-authority`. A permissive filler
 * rule would be ADR §5.1's forbidden implicit wide grant — written into a
 * fixture, where nothing would ever fail for it. These legs are about the
 * capabilities block; nothing here widens it.
 */
const NO_DECLARED_AUTHORITY = {
  permissionMutationEnvelope: { rules: [] },
  teamHardEnvelope: { rules: [] },
}

// ---------------------------------------------------------------------------
// The fixture serializer, and the proof that it emits parseable YAML
// ---------------------------------------------------------------------------

/**
 * Scalars whose BARE form YAML would read back as something other than this
 * string. They are emitted double-quoted (`JSON.stringify` produces a YAML
 * double-quoted scalar — the one style whose escapes JSON defines).
 */
const YAML_REINTERPRETED_WORDS: readonly string[] = [
  'true', 'false', 'null', '~', 'yes', 'no', 'on', 'off',
  'nan', 'inf', '-inf', '+inf', '.inf', '-.inf', '+.inf',
]

/** Characters YAML treats as indicators, so a plain scalar may not start with one. */
const YAML_LEADING_INDICATORS = '-?:,[]{}#&*!|>\'"%@`'

function needsQuoting(value: string): boolean {
  if (value.length === 0) return true
  if (/[:#\n"']/.test(value)) return true
  if (/^\s|\s$/.test(value)) return true
  if (YAML_LEADING_INDICATORS.includes(value[0]!)) return true
  if (YAML_REINTERPRETED_WORDS.includes(value.toLowerCase())) return true
  if (!Number.isNaN(Number(value))) return true
  return false
}

/**
 * Emit one scalar. Anything this serializer does not understand is a REFUSAL,
 * never a guess: emitting `String(value)` for a shape YAML would not read back
 * as the same value is exactly how this file lost its coverage.
 */
function toYamlScalar(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`toYamlFrontmatter: ${String(value)} has no YAML scalar form; refusing to emit it`)
    }
    return String(value)
  }
  if (typeof value === 'string') return needsQuoting(value) ? JSON.stringify(value) : value
  const kind = value === undefined ? 'missing (undefined)' : typeof value
  throw new Error(
    `toYamlFrontmatter: cannot emit a ${kind} value; ` +
      'refusing instead of emitting text this serializer cannot prove parses',
  )
}

/**
 * A minimal YAML serializer for test fixtures, written against ONE rule: every
 * value is emitted in a shape legs `0a`–`0c` prove round-trips through the real
 * parser.
 *
 * The base version emitted a non-empty array inline after its key
 * (`items:         - read`), which is not YAML: a block sequence must start on
 * its own line, more indented than the key. Sequences now start on the line
 * after the key, and a sequence of objects puts its first field on the `- `
 * line with the rest aligned under it — the standard shape.
 */
function toYamlFrontmatter(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`
    const nestedPad = '  '.repeat(indent + 1)
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const lines = toYamlFrontmatter(item, indent + 1).split('\n')
          const first = `${pad}- ${lines[0]!.slice(nestedPad.length)}`
          return [first, ...lines.slice(1)].join('\n')
        }
        if (Array.isArray(item)) {
          throw new Error(
            'toYamlFrontmatter: a sequence inside a sequence is not a fixture shape this suite uses; ' +
              'refusing instead of emitting text this serializer cannot prove parses',
          )
        }
        return `${pad}- ${toYamlScalar(item)}`
      })
      .join('\n')
  }

  if (value === null || typeof value !== 'object') {
    return `${pad}${toYamlScalar(value)}`
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entryValue]) => entryValue !== undefined,
  )
  if (entries.length === 0) return `${pad}{}`

  return entries
    .map(([key, entryValue]) => {
      if (needsQuoting(key)) {
        throw new Error(
          `toYamlFrontmatter: fixture key ${JSON.stringify(key)} would need quoting; not a shape this suite uses`,
        )
      }
      if (entryValue === null || typeof entryValue !== 'object') {
        return `${pad}${key}: ${toYamlScalar(entryValue)}`
      }
      if (Array.isArray(entryValue)) {
        if (entryValue.length === 0) return `${pad}${key}: []`
        return `${pad}${key}:\n${toYamlFrontmatter(entryValue, indent + 1)}`
      }
      if (Object.keys(entryValue).length === 0) return `${pad}${key}: {}`
      return `${pad}${key}:\n${toYamlFrontmatter(entryValue, indent + 1)}`
    })
    .join('\n')
}

/**
 * Run a fixture source through the product's OWN frontmatter split + YAML decode
 * and return the decoded document.
 *
 * Every fixture-consuming leg calls this first: it is this file's reachability
 * gate. If the fixture does not decode, no assertion in the leg can have
 * measured the validator, and the leg must fail saying exactly that instead of
 * passing on — or blaming — its own syntax error.
 */
function decodeFixture(source: string): unknown {
  const { frontmatterText } = splitFrontmatter(source)
  return decodeYamlFrontmatter(frontmatterText)
}

/** Assert the fixture itself is legal YAML (see `decodeFixture`). */
function expectFixtureIsLegalYaml(source: string): void {
  const threw = capture(() => decodeFixture(source))
  if (threw !== undefined) {
    const message = threw instanceof Error ? threw.message : String(threw)
    throw new Error(
      'fixture is not valid YAML, so this leg never reached the validator (the emitted text is the defect, ' +
        `not the law under test): ${message}\n--- fixture ---\n${source}`,
    )
  }
}

/** Substring check expressed as an assertion the plain-node shim can run. */
function expectMessageContains(message: string, needle: string): void {
  if (!message.includes(needle)) {
    throw new Error(`expected the refusal message to contain ${JSON.stringify(needle)}, got ${JSON.stringify(message)}`)
  }
}

// ---------------------------------------------------------------------------
// Test fixture builders
// ---------------------------------------------------------------------------

/**
 * Minimal valid blueprint source (no capabilities — legacy capability mode).
 *
 * "Legacy" names the static-capability mode (capabilities ABSENT), not a retired
 * document version: the carrier is the supported v3.
 */
function legacyBlueprintSource(overrides: Record<string, unknown> = {}): string {
  const base = {
    schemaVersion: CARRIER_SCHEMA_VERSION,
    blueprintId: 'test-blueprint',
    revision: 'v1',
    leader: {
      templateId: 'leader',
      persona: 'I am the team leader.',
    },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    metadata: {},
    ...NO_DECLARED_AUTHORITY,
    ...overrides,
  }
  return `---\n${toYamlFrontmatter(base)}\n---`
}

/** Blueprint source with capabilities on the leader. */
function leaderCapabilitiesSource(
  capabilities: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): string {
  return legacyBlueprintSource({
    leader: {
      templateId: 'leader',
      persona: 'I am the team leader.',
      capabilities,
    },
    ...overrides,
  })
}

/** Blueprint source with two members having different capabilities. */
function twoMemberCapabilitiesSource(
  memberACaps: Record<string, unknown>,
  memberBCaps: Record<string, unknown>,
): string {
  return legacyBlueprintSource({
    members: [
      {
        templateId: 'member-a',
        persona: 'I am member A.',
        capabilities: memberACaps,
      },
      {
        templateId: 'member-b',
        persona: 'I am member B.',
        capabilities: memberBCaps,
      },
    ],
  })
}

/** Minimal capabilities block with all 4 sub-fields. */
function fullCapabilities(): Record<string, unknown> {
  return {
    teamTools: { kind: 'allow', items: ['read', 'write'] },
    builtinToolDeny: ['fs.write'],
    skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
    mcp: { kind: 'allow', items: ['mcp-server-1'] },
  }
}

/** Minimal capabilities block with all deny entries. */
function denyCapabilities(): Record<string, unknown> {
  return {
    teamTools: { kind: 'deny' },
    builtinToolDeny: [],
    skills: { kind: 'deny' },
    mcp: { kind: 'deny' },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T1: Blueprint Capability Schema', () => {
  // ——————————————————————————————————————————————————————————————
  // 0a–0c. The fixture serializer, pinned against the real parser.
  // These legs exist because the serializer had no proof at all, and an emitter
  // that cannot be asserted against a parser silently un-asserts every leg
  // downstream of it — which is what happened to legs 2–11b.
  // ——————————————————————————————————————————————————————————————
  it('0a. fixture emitter emits YAML the real parser reads back as the same document', () => {
    // Every shape the suite actually builds: nested mappings, a non-empty
    // sequence of scalars, a sequence of objects (each carrying a nested
    // mapping with its own sequence), an empty sequence, an empty mapping,
    // numbers, booleans and null.
    const shape = {
      schemaVersion: CARRIER_SCHEMA_VERSION,
      blueprintId: 'test-blueprint',
      revision: 'v1',
      leader: {
        templateId: 'leader',
        persona: 'I am the team leader.',
        capabilities: fullCapabilities(),
      },
      members: [
        { templateId: 'member-a', persona: 'I am member A.', capabilities: fullCapabilities() },
        { templateId: 'member-b', persona: 'I am member B.', capabilities: denyCapabilities() },
      ],
      requirements: [],
      memberEnvelopes: [],
      policyStates: [],
      metadata: {},
      ...NO_DECLARED_AUTHORITY,
      enabled: true,
      maxInstances: 3,
      note: null,
    }

    const emitted = toYamlFrontmatter(shape)
    // (1) the real `yaml` parser reads it back value-for-value;
    expect(yamlParse(emitted)).toEqual(shape)
    // (2) the product's own decoder accepts it, i.e. a fixture built this way reaches the validator.
    expect(decodeFixture(`---\n${emitted}\n---`)).toEqual(shape)
    // (3) `undefined` is dropped, never emitted as the string "undefined".
    const withUndefined = toYamlFrontmatter({ a: 1, dropped: undefined, b: 'x' })
    expect(Object.keys(yamlParse(withUndefined) as Record<string, unknown>).includes('dropped')).toBe(false)
  })

  it('0b. fixture emitter quotes values YAML would otherwise reinterpret', () => {
    const tricky = {
      plain: 'hello',
      colon: 'a: b',
      hash: 'a # not a comment',
      dquote: 'say "hi"',
      squote: "it's",
      trueish: 'true',
      falseish: 'false',
      nullish: 'null',
      numeric: '007',
      floatish: '1.5',
      empty: '',
      leadingDash: '- not a sequence item',
      leadingBrace: '{not a mapping}',
      leadingBracket: '[not a sequence]',
      yesWord: 'yes',
      newline: 'line one\nline two',
    }
    const emitted = toYamlFrontmatter(tricky)
    expect(yamlParse(emitted)).toEqual(tricky)
    // The rule must not be "quote everything": a fully quoted fixture stops
    // exercising plain scalars, which is most of a real blueprint document.
    expect(emitted.includes('plain: hello')).toBe(true)
  })

  it('0c. fixture emitter refuses a shape it cannot prove instead of emitting it', () => {
    // A nested sequence is not a shape this suite uses. Emitting something for
    // it anyway is how an emitter silently un-asserts a leg, so the serializer
    // fails loudly and the failure names itself.
    const nested = capture(() => toYamlFrontmatter({ items: [[1]] }))
    if (nested === undefined) {
      throw new Error('expected the fixture emitter to refuse a sequence inside a sequence')
    }
    expectMessageContains(nested instanceof Error ? nested.message : String(nested), 'sequence inside a sequence')

    const undefinedValue = capture(() => toYamlFrontmatter({ a: [undefined] }))
    if (undefinedValue === undefined) {
      throw new Error('expected the fixture emitter to refuse a value it has no scalar form for')
    }
    expectMessageContains(
      undefinedValue instanceof Error ? undefinedValue.message : String(undefinedValue),
      'cannot emit',
    )
  })

  // ——————————————————————————————————————————————————————————————
  // 1. Legacy fixture parse (capabilities absent)
  // ——————————————————————————————————————————————————————————————
  it('1. Legacy fixture parses without capabilities field', () => {
    const source = legacyBlueprintSource()
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)

    expect(blueprint.leader.capabilities).toBeUndefined()
    expect(blueprint.members).toEqual([])
  })

  // ——————————————————————————————————————————————————————————————
  // 2. New Leader capabilities parse
  // ——————————————————————————————————————————————————————————————
  it('2. Leader with full capabilities parses and validates', () => {
    const source = leaderCapabilitiesSource(fullCapabilities())
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)

    const caps = blueprint.leader.capabilities
    expect(caps).toBeDefined()
    expect(caps!.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })
    expect(caps!.builtinToolDeny).toEqual(['fs.write'])
    expect(caps!.skills).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
    expect(caps!.mcp).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
  })

  // ——————————————————————————————————————————————————————————————
  // 3. Member A / Member B different capabilities
  // ——————————————————————————————————————————————————————————————
  it('3. Members can have different capabilities', () => {
    const source = twoMemberCapabilitiesSource(
      fullCapabilities(),
      denyCapabilities(),
    )
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)

    const [memberA, memberB] = blueprint.members
    expect(memberA!.templateId).toBe('member-a')
    expect(memberA!.capabilities?.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })

    expect(memberB!.templateId).toBe('member-b')
    expect(memberB!.capabilities?.teamTools).toEqual({ kind: 'deny' })
  })

  // ——————————————————————————————————————————————————————————————
  // 4. Malformed allow
  //
  // Each negative leg below asserts the REJECTION IDENTITY, not merely that
  // something threw. `MALFORMED_DTO` alone is not an identity — the fixture's
  // own syntax error carries the same code — so each leg pins the `details` the
  // specific validator branch attaches (a decode error carries
  // `details.reason='yaml-invalid'` and no `path` / `unknownFields`) plus the
  // refusal text.
  // ——————————————————————————————————————————————————————————————
  it('4. Malformed allow entry rejects (missing items)', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'allow' }, // missing items
      builtinToolDeny: [],
      skills: { kind: 'allow', items: ['skill-a'] },
      mcp: { kind: 'allow', items: [] },
    })
    expectFixtureIsLegalYaml(source)
    const threw = expectErrorDetails(
      () => parseBlueprint(source),
      'MALFORMED_DTO',
      { path: '$.leader.capabilities.teamTools.items' },
    )
    expect(threw.details?.reason).not.toBe('yaml-invalid')
    expectMessageContains(threw.message, "missing required field 'items'")
  })

  it('4b. Malformed allow entry rejects (items not string[])', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: [123] }, // non-string item
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
    })
    expectFixtureIsLegalYaml(source)
    const threw = expectErrorDetails(
      () => parseBlueprint(source),
      'MALFORMED_DTO',
      { path: '$.leader.capabilities.teamTools.items[0]' },
    )
    expect(threw.details?.reason).not.toBe('yaml-invalid')
    expectMessageContains(threw.message, 'must be a non-empty string')
  })

  // ——————————————————————————————————————————————————————————————
  // 5. Malformed deny
  // ——————————————————————————————————————————————————————————————
  it('5. Malformed deny entry rejects (extra fields)', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'deny', items: [] }, // deny must not have items
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
    })
    expectFixtureIsLegalYaml(source)
    const threw = expectErrorDetails(
      () => parseBlueprint(source),
      'MALFORMED_DTO',
      { path: '$.leader.capabilities.teamTools', extraFields: ['items'] },
    )
    expect(threw.details?.reason).not.toBe('yaml-invalid')
    expectMessageContains(threw.message, 'deny entry at $.leader.capabilities.teamTools must not have extra fields')
  })

  // ——————————————————————————————————————————————————————————————
  // 6. Unknown fields reject
  // ——————————————————————————————————————————————————————————————
  it('6a. Unknown capability sub-field rejects', () => {
    const source = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: [] },
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
      unknownField: 'bad',
    })
    expectFixtureIsLegalYaml(source)
    const threw = expectErrorDetails(
      () => parseBlueprint(source),
      'MALFORMED_DTO',
      { unknownFields: ['unknownField'] },
    )
    expect(threw.details?.reason).not.toBe('yaml-invalid')
    expectMessageContains(threw.message, '$.leader.capabilities (capabilities) has unknown fields: unknownField')
  })

  it('6b. Unknown template field rejects', () => {
    const source = legacyBlueprintSource({
      leader: {
        templateId: 'leader',
        persona: 'I am the team leader.',
        capabilities: fullCapabilities(),
        unknownField: 'bad',
      },
    })
    expectFixtureIsLegalYaml(source)
    const threw = expectErrorDetails(
      () => parseBlueprint(source),
      'MALFORMED_DTO',
      { unknownFields: ['unknownField'] },
    )
    expect(threw.details?.reason).not.toBe('yaml-invalid')
    expectMessageContains(threw.message, '$.leader (template) has unknown fields: unknownField')
  })

  // ——————————————————————————————————————————————————————————————
  // 7. Hash includes all capability fields
  // ——————————————————————————————————————————————————————————————
  it('7. Changing capability fields changes the hash', () => {
    const base = leaderCapabilitiesSource(fullCapabilities())
    // fewer teamTools items
    const fewerTeamTools = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read'] },
      builtinToolDeny: [],
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    })
    // different builtinToolDeny list
    const otherDeny = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.read', 'fs.write'],
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    })
    // skills switched from allow to deny
    const skillsDeny = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.write'],
      skills: { kind: 'deny' },
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    })
    // mcp switched from allow to deny
    const mcpDeny = leaderCapabilitiesSource({
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.write'],
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'deny' },
    })
    const sameAgain = leaderCapabilitiesSource(fullCapabilities())
    for (const source of [base, fewerTeamTools, otherDeny, skillsDeny, mcpDeny, sameAgain]) {
      expectFixtureIsLegalYaml(source)
    }

    const bp1 = parseBlueprint(base)
    const bp2 = parseBlueprint(fewerTeamTools)
    const bp3 = parseBlueprint(otherDeny)
    const bp4 = parseBlueprint(skillsDeny)
    const bp5 = parseBlueprint(mcpDeny)
    const bp6 = parseBlueprint(sameAgain)

    // Every mutation must move the hash. A capability field that never reached
    // the hashable projection would hash equal here, which is the fact this leg
    // exists to catch — so the mutated field is named at each site and the
    // mutations are also distinguished from one another, not only from bp1.
    expect(bp1.contentHash).not.toBe(bp2.contentHash) // teamTools items
    expect(bp1.contentHash).not.toBe(bp3.contentHash) // builtinToolDeny
    expect(bp1.contentHash).not.toBe(bp4.contentHash) // skills kind
    expect(bp1.contentHash).not.toBe(bp5.contentHash) // mcp kind
    expect(bp2.contentHash).not.toBe(bp3.contentHash)
    expect(bp3.contentHash).not.toBe(bp4.contentHash)
    expect(bp4.contentHash).not.toBe(bp5.contentHash)

    // Same capabilities → same hash
    expect(bp1.contentHash).toBe(bp6.contentHash)

    // Verify hashable projection includes capabilities
    const hashable = toHashableBlueprint(bp1)
    const leaderHashable = hashable.leader as RemoteSafeRecord
    expect(leaderHashable.capabilities).toBeDefined()
    const capsHashable = leaderHashable.capabilities as RemoteSafeRecord
    expect(capsHashable.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })
    expect(capsHashable.builtinToolDeny).toEqual(['fs.write'])
    expect(capsHashable.skills).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
    expect(capsHashable.mcp).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
  })

  // ——————————————————————————————————————————————————————————————
  // 8. Static source correctly selects Leader
  // ——————————————————————————————————————————————————————————————
  it('8. Static source returns selective mode for Leader with capabilities', () => {
    const source = leaderCapabilitiesSource(fullCapabilities())
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    expect(caps.mode).toBe('selective')
    if (caps.mode === 'selective') {
      expect(caps.teamTools).toEqual({ kind: 'allow', items: ['read', 'write'] })
      expect(caps.builtinToolDeny).toEqual(['fs.write'])
      expect(caps.skills).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
      expect(caps.mcp).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
    }
  })

  // ——————————————————————————————————————————————————————————————
  // 9. Static source correctly selects MemberTemplate
  // ——————————————————————————————————————————————————————————————
  it('9. Static source returns selective mode for MemberTemplate with capabilities', () => {
    const source = twoMemberCapabilitiesSource(fullCapabilities(), denyCapabilities())
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)
    const [memberA, memberB] = blueprint.members

    const capsA = staticCapabilitiesOf(blueprint, memberA!)
    expect(capsA.mode).toBe('selective')

    const capsB = staticCapabilitiesOf(blueprint, memberB!)
    expect(capsB.mode).toBe('selective')
    if (capsB.mode === 'selective') {
      expect(capsB.teamTools).toEqual({ kind: 'deny' })
      expect(capsB.skills).toEqual({ kind: 'deny' })
    }
  })

  // ——————————————————————————————————————————————————————————————
  // 10. Legacy source returns mode: 'legacy'
  // ——————————————————————————————————————————————————————————————
  it('10. Static source returns legacy mode when capabilities absent', () => {
    const source = legacyBlueprintSource()
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    expect(caps.mode).toBe('legacy')
  })

  // ——————————————————————————————————————————————————————————————
  // 11. Selective source maps teamTools/skills/mcp to PolicyEntry semantics
  // ——————————————————————————————————————————————————————————————
  it('11. Selective source maps to TemplatePolicy values correctly', () => {
    const source = leaderCapabilitiesSource(fullCapabilities())
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    if (caps.mode !== 'selective') {
      throw new Error('Expected selective mode')
    }

    const values = selectiveToTemplatePolicyValues(caps)
    expect(values).toBeDefined()
    expect(values!['tools']).toEqual({ kind: 'allow', items: ['read', 'write'] })
    expect(values!['skills']).toEqual({ kind: 'allow', items: ['skill-a', 'skill-b'] })
    expect(values!['mcp']).toEqual({ kind: 'allow', items: ['mcp-server-1'] })
    // builtinToolDeny does NOT map to a values cell
    expect(Object.keys(values!)).not.toContain('builtinToolDeny')
  })

  it('11b. Selective source maps deny entries to values correctly', () => {
    const source = leaderCapabilitiesSource(denyCapabilities())
    expectFixtureIsLegalYaml(source)
    const blueprint = parseBlueprint(source)
    const caps = staticCapabilitiesOf(blueprint, blueprint.leader)

    if (caps.mode !== 'selective') {
      throw new Error('Expected selective mode')
    }

    const values = selectiveToTemplatePolicyValues(caps)
    expect(values).toBeDefined()
    expect(values!['tools']).toEqual({ kind: 'deny' })
    expect(values!['skills']).toEqual({ kind: 'deny' })
    expect(values!['mcp']).toEqual({ kind: 'deny' })
  })

  it('11c. Legacy source returns undefined values', () => {
    const legacy: StaticTemplateCapabilities = { mode: 'legacy' }
    const values = selectiveToTemplatePolicyValues(legacy)
    expect(values).toBeUndefined()
  })

  // ——————————————————————————————————————————————————————————————
  // 11d. P1 (hardening §6): allow([]) preserves the explicit policy value
  // (E1-E3): an explicit empty allow is a DISTINCT policy value (deny
  // everything), NOT "unspecified" — all three cells enter the values
  // EXPLICITLY when selective.
  // ——————————————————————————————————————————————————————————————
  it('11d. Selective source preserves explicit allow([]) entries (P1 E1-E3)', () => {
    const caps: StaticTemplateCapabilities = {
      mode: 'selective',
      teamTools: { kind: 'allow', items: [] },
      builtinToolDeny: [],
      skills: { kind: 'allow', items: [] },
      mcp: { kind: 'allow', items: [] },
    }
    const values = selectiveToTemplatePolicyValues(caps)
    // (plain-node shim matcher surface: toBe/toEqual/toBeGreaterThan/toThrow —
    // `toBeDefined` is expressed as `!== undefined` + toBe(true).)
    expect(values !== undefined).toBe(true)
    // E1: teamTools allow[] → values.tools explicitly present
    expect(values!['tools']).toEqual({ kind: 'allow', items: [] })
    // E2: skills allow[] → values.skills explicitly present
    expect(values!['skills']).toEqual({ kind: 'allow', items: [] })
    // E3: mcp allow[] → values.mcp explicitly present
    expect(values!['mcp']).toEqual({ kind: 'allow', items: [] })
  })

  it('11e. Selective source with mixed allow([])/deny preserves all cells (P1)', () => {
    const caps: StaticTemplateCapabilities = {
      mode: 'selective',
      teamTools: { kind: 'allow', items: [] },
      builtinToolDeny: [],
      skills: { kind: 'deny' },
      mcp: { kind: 'allow', items: ['mcp-a'] },
    }
    const values = selectiveToTemplatePolicyValues(caps)
    expect(values !== undefined).toBe(true)
    expect(values!['tools']).toEqual({ kind: 'allow', items: [] })
    expect(values!['skills']).toEqual({ kind: 'deny' })
    expect(values!['mcp']).toEqual({ kind: 'allow', items: ['mcp-a'] })
  })
})
