/**
 * SILENT-DROP CENSUS (throwaway). The parser DEFAULTS five top-level collections
 * (`?? []` / `{}`), so a document that DECLARES them empty and a document that
 * OMITS them freeze to the same object. Any option whose migration rewrites
 * document literals therefore needs a PARSE-LEVEL / ELEMENT-SET census: a
 * line-diff census over YAML text cannot see a change the parser cannot see.
 *
 * Four levels are compared per mutation:
 *   1 contentHash            (the identity commitment)
 *   2 the frozen blueprint   (deep equality of the parsed object)
 *   3 toHashableBlueprint    (the exact projection that is hashed)
 *   4 the projection's element set (key paths, not bytes)
 * and a fifth, the SOURCE key set — the only level that sees it.
 */
import { describe, expect, it } from 'vitest'

import { deriveContentHash, parseBlueprint, toHashableBlueprint } from '../../domain/blueprint/src/index.js'

const V3_BASE = [
  '---', 'schemaVersion: 3', 'blueprintId: SILENT-CENSUS', 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: lead',
  'members: []', 'requirements: []', 'teamRequirements:', '  - requirementId: req-team-1',
  '    type: tool', '    subjects:', '      - web', '    complete: true',
  'teamEnvelope:', '  allow:', '    - assign-task',
  'memberEnvelopes: []', 'policyStates: []', 'metadata: {}',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  '---',
]

const dropKey = (lines: readonly string[], key: string): string[] => {
  const out: string[] = []
  let skipping = false
  for (const line of lines) {
    if (line.trimEnd() === '---') skipping = false // never swallow the closing delimiter
    if (!line.startsWith(' ') && !line.startsWith('-') && new RegExp(`^${key}:`).test(line)) {
      skipping = true
      continue
    }
    if (!line.startsWith(' ') && !line.startsWith('-')) skipping = false
    if (!skipping) out.push(line)
  }
  return out
}

const FIVE = ['metadata', 'requirements', 'members', 'memberEnvelopes', 'policyStates']
const parse = (lines: readonly string[]) => parseBlueprint(lines.join('\n'))
const projection = (lines: readonly string[]) => toHashableBlueprint(parse(lines))
const paths = (value: unknown, prefix = '$'): string[] => {
  if (Array.isArray(value)) return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`))
  if (value && typeof value === 'object')
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [
      `${prefix}.${k}`,
      ...paths(v, `${prefix}.${k}`),
    ])
  return []
}

const base = parse(V3_BASE)
const baseHash = base.contentHash
const baseJson = JSON.stringify(projection(V3_BASE))
const basePaths = JSON.stringify(paths(projection(V3_BASE)))

describe('silent-drop census: what the parser cannot see', () => {
  for (const key of FIVE) {
    it(`dropping the EMPTY declaration of \`${key}\` is invisible at all four identity levels`, () => {
      const lines = dropKey(V3_BASE, key)
      expect(lines.length, `the probe must actually have removed ${key}`).toBeLessThan(V3_BASE.length)
      const bp = parse(lines)
      const report = {
        key,
        contentHash_identical: bp.contentHash === baseHash,
        frozenBlueprint_deepEqual: JSON.stringify(bp) === JSON.stringify(base),
        projection_bytes_identical: JSON.stringify(projection(lines)) === baseJson,
        projection_elementSet_identical: JSON.stringify(paths(projection(lines))) === basePaths,
        sourceKeySet_differs: !JSON.stringify(Object.keys(parse(lines) as never)) &&
          true,
      }
      process.stdout.write(`[[CENSUS]] ${JSON.stringify(report)}\n`)
      expect(report.contentHash_identical, `${key}: contentHash moved (LOUD)`).toBe(true)
      expect(report.projection_bytes_identical, `${key}: projection moved (LOUD)`).toBe(true)
    })
  }

  it('dropping ALL FIVE at once is invisible', () => {
    let lines = [...V3_BASE]
    for (const key of FIVE) lines = dropKey(lines, key)
    const bp = parse(lines)
    process.stdout.write(
      `[[CENSUS]] all-five contentHash_identical=${bp.contentHash === baseHash} projection_identical=${JSON.stringify(projection(lines)) === baseJson}\n`,
    )
    expect(bp.contentHash).toBe(baseHash)
    expect(JSON.stringify(projection(lines))).toBe(baseJson)
  })

  it('the SOURCE key set is the only level that sees it', () => {
    let lines = [...V3_BASE]
    for (const key of FIVE) lines = dropKey(lines, key)
    const srcKeys = (l: readonly string[]) =>
      l.filter((x) => !x.startsWith(' ') && !x.startsWith('-') && x.includes(':')).map((x) => x.split(':')[0]).sort()
    const missing = srcKeys(V3_BASE).filter((k) => !srcKeys(lines).includes(k))
    process.stdout.write(`[[CENSUS]] source keys lost=${JSON.stringify(missing)} count=${missing.length}\n`)
    expect(missing.length).toBe(5)
  })

  it('loudness is a property of the VALUE, not the field: a NON-EMPTY requirements drop is LOUD', () => {
    const withMembers = V3_BASE.map((l) =>
      l === 'members: []' ? 'members:\n  - templateId: worker\n    persona: work' : l,
    )
    const bp = parse(withMembers)
    process.stdout.write(`[[CENSUS]] non-empty members drop is loud: ${bp.contentHash !== baseHash}\n`)
    expect(bp.contentHash).not.toBe(baseHash)
  })

  it('the fields the migration actually moves ARE loud', () => {
    const checks: Array<[string, readonly string[]]> = [
      ['teamRequirements -> different requirementId', V3_BASE.map((l) => (l.includes('req-team-1') ? l.replace('req-team-1', 'req-team-x') : l))],
      ['teamRequirements -> removed', dropKey(V3_BASE, 'teamRequirements')],
      ['teamHardEnvelope -> removed', dropKey(V3_BASE, 'teamHardEnvelope')],
      ['permissionMutationEnvelope -> removed', dropKey(V3_BASE, 'permissionMutationEnvelope')],
      ['revision -> changed', V3_BASE.map((l) => (l.startsWith('revision:') ? 'revision: "2"' : l))],
      ['leader.templateId -> changed', V3_BASE.map((l) => (l === '  templateId: leader' ? '  templateId: chief' : l))],
    ]
    for (const [label, lines] of checks) {
      let moved = false
      try {
        moved = parse(lines).contentHash !== baseHash
        process.stdout.write(`[[CENSUS]] LOUD? ${label}: ${moved ? 'yes' : 'NO — SILENT'}\n`)
      } catch (error) {
        process.stdout.write(`[[CENSUS]] LOUD? ${label}: refused (${String((error as Error).message).slice(0, 60)})\n`)
        moved = true
      }
      expect(moved, `${label} is a SILENT drop`).toBe(true)
    }
  })

  it('deriveContentHash(toHashableBlueprint(x)) is the same oracle the parser uses', () => {
    expect(deriveContentHash(toHashableBlueprint(parse(V3_BASE)))).toBe(baseHash)
  })
})
