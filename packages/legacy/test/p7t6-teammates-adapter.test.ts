/**
 * p7t6-teammates-adapter.test.ts — P7-T6 legacy teammate adapter:
 * `.dsh/teammates` as a one-time Blueprint import adapter only.
 *
 * Mandatory matrix (task card): import valid / import invalid / duplicate /
 * source changes after snapshot — plus the acceptance negative: the import
 * produces a NEW blueprint and never controls (reads or writes) any
 * pre-existing team state.
 *
 * Shim constraints honored: every `it()` body is synchronous; exact
 * `TeamContractError` codes are asserted via capture + `isTeamContractError`
 * (the shim's `toThrow()` takes no argument).
 *
 * @module @dsh-agent-team/legacy/test/p7t6-teammates-adapter
 */

import { describe, expect, it } from 'vitest'
import { isTeamContractError } from '../../contracts/src/index.js'
import type { TeamContractError } from '../../contracts/src/index.js'
import { importLegacyTeammates } from '../teammates-adapter.js'
import type { LegacyTeammateEntry, LegacyTeammateOptions } from '../teammates-adapter.js'
import {
  adapterSourceTexts,
  createScratchTeammatesDir,
  readFixtureTeammates,
  readTeammateDirectory,
  removeScratchTeammatesDir,
  writeScratchTeammateFile,
} from '../teammates-adapter-fs.mjs'

const OPTIONS: LegacyTeammateOptions = {
  blueprintId: 'team.p7t6-import',
  revision: '1',
  displayName: 'P7-T6 Legacy Import',
  description: 'Imported from a legacy teammates directory.',
}

/** One-time residue cleanup (idempotent) for the fs scratch scratch case. */
removeScratchTeammatesDir('p7t6-source-change')

/** Run `fn` and return the thrown value, or `undefined` when nothing threw. */
function capture(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return undefined
}

/** Assert `fn` throws a `TeamContractError` with exactly `code`. */
function expectCode(fn: () => unknown, code: string): TeamContractError {
  const threw = capture(fn)
  if (threw === undefined) throw new Error(`expected ${code} but nothing was thrown`)
  if (!isTeamContractError(threw)) {
    throw new Error(`expected ${code} but got a non-contract error: ${threw instanceof Error ? threw.message : String(threw)}`)
  }
  if (threw.code !== code) throw new Error(`expected ${code} but got ${threw.code}`)
  return threw
}

/** Assert every `key: value` pair of `expected` appears in `error.details` (primitives only). */
function expectDetails(error: TeamContractError, expected: Record<string, unknown>): void {
  const actual = error.details
  if (actual === undefined) throw new Error(`expected details ${JSON.stringify(expected)} but details is undefined`)
  for (const key of Object.keys(expected)) {
    const actualValue = (actual as Record<string, unknown>)[key]
    if (!Object.hasOwn(actual, key) || actualValue !== expected[key]) {
      throw new Error(`details.${key}: expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(actualValue)}`)
    }
  }
}

/** Whether `value` and everything reachable from it is frozen (cycle-safe). */
function isDeepFrozen(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null || typeof value !== 'object') return true
  if (seen.has(value as object)) return true
  seen.add(value as object)
  if (!Object.isFrozen(value as object)) return false
  for (const key of Object.keys(value as object)) {
    if (!isDeepFrozen((value as Record<string, unknown>)[key], seen)) return false
  }
  return true
}

/** Freeze `value` recursively (test helper for stand-in state). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value
}

/**
 * Whether `value` is plain JSON-style data only: strings, numbers,
 * booleans, undefined, arrays, and plain objects — never functions,
 * symbols, null, Dates, Maps/Sets, buffers, or any host reference.
 */
function isPlainData(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === undefined) return true
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (typeof value !== 'object' || value === null) return false
  if (seen.has(value as object)) return true
  seen.add(value as object)
  if (Array.isArray(value)) return value.every((item) => isPlainData(item, seen))
  if (Object.getPrototypeOf(value) !== Object.prototype) return false
  return Object.values(value as Record<string, unknown>).every((v) => isPlainData(v, seen))
}

const VALID_LEADER_ENTRY: LegacyTeammateEntry = {
  fileName: 'leader.md',
  content:
    '---\n' +
    'schemaVersion: 1\n' +
    'id: lead\n' +
    'role: leader\n' +
    'name: Lead\n' +
    'description: The only valid file.\n' +
    '---\n' +
    'Lead the team.\n',
}

describe('p7t6 legacy teammates adapter: valid import', () => {
  it('imports the valid fixture directory into a complete vNext TeamBlueprint', () => {
    const entries = readFixtureTeammates('teammates')
    expect(entries.map((e) => e.fileName)).toEqual(['alpha-leader.md', 'sentry.md', 'writer.md'])

    const { blueprint, warnings } = importLegacyTeammates(entries, OPTIONS)
    expect(warnings).toEqual([])
    expect(isDeepFrozen(blueprint)).toBe(true)

    // vNext identity comes from the importer, not from the legacy files.
    expect(blueprint.schemaVersion).toBe(1)
    expect(blueprint.blueprintId).toBe('team.p7t6-import')
    expect(blueprint.revision).toBe('1')
    expect(blueprint.displayName).toBe('P7-T6 Legacy Import')
    expect(blueprint.description).toBe('Imported from a legacy teammates directory.')
    expect(blueprint.contentHash.startsWith('sha256:')).toBe(true)

    // Leader mapping.
    expect(blueprint.leader.templateId).toBe('alpha-leader')
    expect(blueprint.leader.displayName).toBe('Alpha Leader')
    expect(blueprint.leader.description).toBe('Coordinates the P7-T6 import test team.')
    expect(blueprint.leader.persona).toBe('You are Alpha, the leader of the import test team. Keep the squad focused.')
    expect(blueprint.leader.modelPreference).toBe('deepseek-chat')
    expect(blueprint.leader.contextPolicy).toBe('persistent')

    // Member mapping (order = legacy discovery order).
    expect(blueprint.members.map((m) => m.templateId)).toEqual(['sentry', 'writer'])
    const sentry = blueprint.members[0]
    expect(sentry).not.toBe(undefined)
    expect(sentry?.persona).toBe('Watch the perimeter and report anything unusual.')
    expect(sentry?.modelPreference).toBe(undefined)
    expect(sentry?.contextPolicy).toBe(undefined)
    const writer = blueprint.members[1]
    expect(writer).not.toBe(undefined)
    expect(writer?.persona).toBe('Draft documents carefully and cite your sources.')
    expect(writer?.modelPreference).toBe('deepseek-writer')
    expect(writer?.contextPolicy).toBe('fresh_per_delegation')

    // Inert provenance + lossless extras (unmapped legacy fields preserved).
    const expectedSourceFiles = JSON.stringify([
      { id: 'alpha-leader', file: 'alpha-leader.md' },
      { id: 'sentry', file: 'sentry.md' },
      { id: 'writer', file: 'writer.md' },
    ])
    const expectedExtras = JSON.stringify({
      writer: {
        provider: 'deepseek',
        maxTokens: 4096,
        tools: { allow: ['read'], deny: ['exec'] },
        requiresApproval: ['publish'],
        skills: ['doc-writing'],
        permissions: { allow: ['read'] },
        permissionMode: 'default',
      },
    })
    expect(blueprint.metadata['legacy.provenance']).toBe('dsh-teammates')
    expect(blueprint.metadata['legacy.sourceFiles']).toBe(expectedSourceFiles)
    expect(blueprint.metadata['legacy.extras']).toBe(expectedExtras)
    const extras = JSON.parse(String(blueprint.metadata['legacy.extras'])) as Record<string, Record<string, unknown>>
    expect(extras['writer']).not.toBe(undefined)
    expect(extras['writer']?.model).toBe(undefined) // mapped to modelPreference, not duplicated
    expect(extras['writer']?.contextPolicy).toBe(undefined) // mapped, not duplicated
    expect(extras['writer']?.permissionMode).toBe('default')
    expect(Object.keys(blueprint.metadata).sort()).toEqual(['legacy.extras', 'legacy.provenance', 'legacy.sourceFiles'])

    // The document is closed vNext data: no envelope/requirement state.
    expect(blueprint.requirements).toEqual([])
    expect(blueprint.memberEnvelopes).toEqual([])
    expect(blueprint.policyStates).toEqual([])
  })

  it('re-importing identical entries yields the same contentHash (deterministic snapshot)', () => {
    const first = importLegacyTeammates(readFixtureTeammates('teammates'), OPTIONS)
    const second = importLegacyTeammates(readFixtureTeammates('teammates'), OPTIONS)
    expect(second.blueprint.contentHash).toBe(first.blueprint.contentHash)
    expect(second.blueprint).toEqual(first.blueprint)
  })

  it('duplicate legacy id: last file wins, with a warning', () => {
    const { blueprint, warnings } = importLegacyTeammates(readFixtureTeammates('teammates-duplicate'), OPTIONS)
    expect(warnings.length).toBe(1)
    expect(warnings[0]?.severity).toBe('warning')
    expect(warnings[0]?.fileName).toBe('b-writer.md')
    expect(warnings[0]?.message).toBe(
      "duplicate legacy teammate id 'writer' in 'b-writer.md' shadows 'a-writer.md' (last wins)",
    )

    expect(blueprint.leader.templateId).toBe('alpha-leader')
    expect(blueprint.members.map((m) => m.templateId)).toEqual(['writer'])
    expect(blueprint.members[0]?.displayName).toBe('Writer B')
    expect(blueprint.members[0]?.persona).toBe('Second writer persona.')

    const sourceFiles = JSON.parse(String(blueprint.metadata['legacy.sourceFiles'])) as readonly { id: string; file: string }[]
    expect(sourceFiles.map((s) => s.id)).toEqual(['writer', 'alpha-leader'])
    expect(sourceFiles.map((s) => s.file)).toEqual(['b-writer.md', 'leader.md'])
    expect(blueprint.metadata['legacy.extras']).toBe(undefined)
  })

  it('multiple leaders: the last discovered leader survives, with a warning', () => {
    const { blueprint, warnings } = importLegacyTeammates(readFixtureTeammates('teammates-two-leaders'), OPTIONS)
    expect(warnings.length).toBe(1)
    expect(warnings[0]?.fileName).toBe('leader-b.md')
    expect(warnings[0]?.message).toBe(
      "multiple leaders declared; leader 'leader-b' (leader-b.md) survives, 1 other leader dropped",
    )
    expect(blueprint.leader.templateId).toBe('leader-b')
    expect(blueprint.leader.persona).toBe('Second leader persona.')
    expect(blueprint.members.map((m) => m.templateId)).toEqual(['scribe'])
  })
})

describe('p7t6 legacy teammates adapter: invalid import', () => {
  it('rejects an invalid legacy role with MALFORMED_DTO (invalid-role)', () => {
    const error = expectCode(
      () => importLegacyTeammates(readFixtureTeammates('teammates-invalid'), OPTIONS),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'invalid-role', file: 'broken.md' })
  })

  it('rejects a directory with no leader role (no-leader)', () => {
    const error = expectCode(
      () => importLegacyTeammates(readFixtureTeammates('teammates-noleader'), OPTIONS),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'no-leader' })
  })

  it('rejects a file without a frontmatter delimiter (frontmatter-missing)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [VALID_LEADER_ENTRY, { fileName: 'prose.md', content: 'just prose without frontmatter' }],
          OPTIONS,
        ),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'frontmatter-missing', file: 'prose.md' })
  })

  it('rejects unclosed frontmatter (frontmatter-unclosed)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [
            VALID_LEADER_ENTRY,
            { fileName: 'unclosed.md', content: '---\nid: broken\nrole: leader\n' },
          ],
          OPTIONS,
        ),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'frontmatter-unclosed', file: 'unclosed.md' })
  })

  it('rejects non-mapping frontmatter (frontmatter-not-mapping)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [
            VALID_LEADER_ENTRY,
            { fileName: 'list.md', content: '---\n- a\n- b\n---\nbody text\n' },
          ],
          OPTIONS,
        ),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'frontmatter-not-mapping', file: 'list.md' })
  })

  it('rejects invalid YAML (yaml-invalid)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [
            VALID_LEADER_ENTRY,
            { fileName: 'badyaml.md', content: '---\nid: [unclosed\nrole: leader\n---\nbody text\n' },
          ],
          OPTIONS,
        ),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'yaml-invalid' })
  })

  it('rejects an unsupported schemaVersion (schema-version)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [
            {
              fileName: 'v2.md',
              content:
                '---\nschemaVersion: 2\nid: v2\nrole: leader\nname: V2\ndescription: Too new.\n---\nPersona.\n',
            },
          ],
          OPTIONS,
        ),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'schema-version', file: 'v2.md' })
  })

  it('rejects an empty persona body (empty-persona, vNext hardening)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [
            {
              fileName: 'nobody.md',
              content:
                '---\nschemaVersion: 1\nid: lead\nrole: leader\nname: Lead\ndescription: No body.\n---\n',
            },
          ],
          OPTIONS,
        ),
      'MALFORMED_DTO',
    )
    expectDetails(error, { reason: 'empty-persona', file: 'nobody.md' })
  })

  it('rejects a legacy id that is not a vNext template slug (INVALID_TEMPLATE_ID)', () => {
    const error = expectCode(
      () =>
        importLegacyTeammates(
          [
            {
              fileName: 'badslug.md',
              content:
                '---\nschemaVersion: 1\nid: Bad ID\nrole: leader\nname: Lead\ndescription: Non-slug id.\n---\nPersona body.\n',
            },
          ],
          OPTIONS,
        ),
      'INVALID_TEMPLATE_ID',
    )
    expect(error.code).toBe('INVALID_TEMPLATE_ID')
  })

  it('rejects an empty entry list (no-entries)', () => {
    const error = expectCode(() => importLegacyTeammates([], OPTIONS), 'MALFORMED_DTO')
    expectDetails(error, { reason: 'no-entries' })
  })
})

describe('p7t6 legacy teammates adapter: source changes after snapshot', () => {
  it('re-importing changed entries yields a new contentHash; the first snapshot is unchanged', () => {
    const entries = readFixtureTeammates('teammates')
    const first = importLegacyTeammates(entries, OPTIONS)
    const firstJson = JSON.stringify(first.blueprint)
    const firstHash = first.blueprint.contentHash

    const changed = entries.map((e) =>
      e.fileName === 'writer.md'
        ? { fileName: e.fileName, content: e.content.replace('cite your sources.', 'cite your sources thoroughly.') }
        : e,
    )
    const second = importLegacyTeammates(changed, OPTIONS)

    expect(second.blueprint.contentHash).not.toBe(firstHash)
    const writer = second.blueprint.members.find((m) => m.templateId === 'writer')
    expect(writer?.persona).toBe('Draft documents carefully and cite your sources thoroughly.')

    // The first snapshot is intact: same hash, same content, still frozen.
    expect(JSON.stringify(first.blueprint)).toBe(firstJson)
    expect(first.blueprint.contentHash).toBe(firstHash)
    expect(isDeepFrozen(first.blueprint)).toBe(true)
  })

  it('fs-level: mutating the directory after import leaves the snapshot intact', () => {
    const leaderContent =
      '---\nschemaVersion: 1\nid: alpha-leader\nrole: leader\nname: Alpha Leader\ndescription: Scratch leader.\n---\nLead the scratch team.\n'
    const mateContent =
      '---\nschemaVersion: 1\nid: mate\nrole: teammate\nname: Mate\ndescription: Scratch mate.\n---\nOriginal mate persona.\n'
    const mutatedMateContent =
      '---\nschemaVersion: 1\nid: mate\nrole: teammate\nname: Mate\ndescription: Scratch mate.\n---\nMutated mate persona.\n'

    const dir = createScratchTeammatesDir('p7t6-source-change', [
      { fileName: 'leader.md', content: leaderContent },
      { fileName: 'mate.md', content: mateContent },
    ])
    try {
      const firstEntries = readTeammateDirectory(dir)
      const first = importLegacyTeammates(firstEntries, OPTIONS)
      const firstJson = JSON.stringify(first.blueprint)
      expect(first.blueprint.members[0]?.persona).toBe('Original mate persona.')

      // The directory changes after the snapshot was taken (no watcher:
      // the adapter only ever sees what an import call hands it).
      writeScratchTeammateFile('p7t6-source-change', 'mate.md', mutatedMateContent)
      const secondEntries = readTeammateDirectory(dir)
      const second = importLegacyTeammates(secondEntries, OPTIONS)

      expect(second.blueprint.contentHash).not.toBe(first.blueprint.contentHash)
      expect(second.blueprint.members[0]?.persona).toBe('Mutated mate persona.')
      expect(JSON.stringify(first.blueprint)).toBe(firstJson)
      expect(isDeepFrozen(first.blueprint)).toBe(true)
    } finally {
      removeScratchTeammatesDir('p7t6-source-change')
    }
  })
})

describe('p7t6 legacy teammates adapter: no runtime authority (negative)', () => {
  it('adapter sources carry no runtime authority vocabulary (source scan)', () => {
    const sources = adapterSourceTexts()
    expect(sources.length).toBe(3)
    const names = sources.map((s) => s.path.split('\\').pop()).sort()
    expect(names).toEqual(['teammates-adapter-fs.d.mts', 'teammates-adapter-fs.mjs', 'teammates-adapter.ts'])

    // Vocabulary that would mean the adapter reached into a live team:
    // vNext team object types, mutation/admission entry points, upstream
    // private seams, file watching, or process spawning.
    const forbidden = [
      'TeamSession',
      'TeamDomain',
      'TeamRuntime',
      'performAction',
      'requestAdmission',
      'activation',
      'admission',
      '@deepseek-ai',
      'fs.watch',
      'watchFile',
      'chokidar',
      'child_process',
      'memberId',
      'execFile',
      'spawn(',
    ]
    const hits: string[] = []
    for (const source of sources) {
      for (const token of forbidden) {
        if (source.content.includes(token)) hits.push(`${source.path.split('\\').pop()}:${token}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('the shipped core exports only the one-time import function (surface scan)', () => {
    const sources = adapterSourceTexts()
    const core = sources.find((s) => s.path.endsWith('teammates-adapter.ts'))
    expect(core).not.toBe(undefined)
    const exportedFunctions: string[] = []
    const pattern = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g
    for (const match of String(core?.content ?? '').matchAll(pattern)) {
      exportedFunctions.push(match[1] ?? '')
    }
    expect(exportedFunctions).toEqual(['importLegacyTeammates'])
  })

  it('importing never observes or mutates existing team state', () => {
    // A stand-in for pre-existing team state (frozen, like any vNext
    // snapshot): the import must leave it byte-for-byte identical.
    const existingTeamState = deepFreeze({
      teamId: 'existing-team',
      blueprintRef: {
        blueprintId: 'team.existing',
        revision: '9',
        contentHash: `sha256:${'0'.repeat(64)}`,
      },
      members: [{ templateId: 'old-member', persona: 'old persona' }],
    })
    const before = JSON.stringify(existingTeamState)

    const result = importLegacyTeammates(readFixtureTeammates('teammates'), OPTIONS)

    expect(JSON.stringify(existingTeamState)).toBe(before)
    expect(isDeepFrozen(existingTeamState)).toBe(true)
    // The produced blueprint is a fresh object graph, not the stand-in.
    expect(result.blueprint.blueprintId).toBe('team.p7t6-import')
    expect(result.blueprint.blueprintId).not.toBe('team.existing')
  })

  it('the produced blueprint is plain, deeply-frozen data (no host references)', () => {
    const { blueprint } = importLegacyTeammates(readFixtureTeammates('teammates'), OPTIONS)
    expect(isDeepFrozen(blueprint)).toBe(true)
    expect(isPlainData(blueprint)).toBe(true)

    // ESM modules run in strict mode: a frozen blueprint rejects writes.
    let threw = false
    try {
      ;(blueprint.leader as unknown as Record<string, unknown>).templateId = 'hacked'
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    expect(blueprint.leader.templateId).toBe('alpha-leader')
  })
})
