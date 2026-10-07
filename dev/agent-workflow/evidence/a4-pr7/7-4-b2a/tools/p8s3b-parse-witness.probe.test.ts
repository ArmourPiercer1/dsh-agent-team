import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'

/** A4-PR7 §7.4 scratch witness (deleted before the gates): p8s3b-result-effects
 *  is RED AT BASE, so its migration cannot be witnessed by the file itself. This
 *  probe extracts the real `blueprintSource` array literal from BOTH the
 *  committed file and the working copy, evaluates it, and parses both documents:
 *  the base document parses as the version it declares (so the migration is not
 *  `invert-to-refusal`), and the migrated document parses at the supported
 *  version with the same declared content. */
function extractDoc(source: string): string {
  const start = source.indexOf('blueprintSource: [\n')
  expect(start).toBeGreaterThan(-1)
  const end = source.indexOf("].join('\\n')", start)
  expect(end).toBeGreaterThan(start)
  const literal = source.slice(start + 'blueprintSource: '.length, end + "].join('\\n')".length)
  return new Function(`return (${literal})`)() as string
}

describe('§7.4 p8s3b document parse witness', () => {
  it('the base document and the migrated document both parse; only the version pair differs', () => {
    const path = 'packages/runtime/test/p8s3b-result-effects.test.ts'
    const base = parseBlueprint(extractDoc(execSync(`git show HEAD:${path}`, { encoding: 'utf8' })))
    const head = parseBlueprint(extractDoc(readFileSync(path, 'utf8')))
    expect(base.schemaVersion).toBe(1)
    expect(head.schemaVersion).toBe(3)
    expect(head.blueprintId).toBe('team.p8s3b')
    expect(head.leader.templateId).toBe('leader')
    expect(head.members.map((m) => m.templateId)).toEqual(['tpl-p8s3b'])
    expect(head.permissionMutationEnvelope).toEqual({ rules: [] })
    expect(head.teamHardEnvelope).toEqual({ rules: [] })
    // Same declared content, key by key, ignoring the version pair the
    // promotion adds. Key ORDER differs between the two parses (the v3 keys are
    // appended), so the comparison is over sorted keys.
    const strip = (b: typeof head): string => {
      const rest: Record<string, unknown> = { ...b }
      delete rest.schemaVersion
      // The content hash is a hash OF the declared document, so it moves with the
      // version pair by definition; it is not a declared field.
      delete rest.contentHash
      delete rest.permissionMutationEnvelope
      delete rest.teamHardEnvelope
      return JSON.stringify(rest, Object.keys(rest).sort())
    }
    expect(strip(head)).toBe(strip(base))
    const keys = new Set([...Object.keys(base), ...Object.keys(head)])
    expect([...keys].filter((k) => !(k in base) || !(k in head)).sort()).toEqual([
      'permissionMutationEnvelope',
      'teamHardEnvelope',
    ])
  })
})
