/**
 * @module @dsh-agent-team/runtime/test/a4p7-shipped-composition-blueprint
 *
 * THE SHIPPED COMPOSITION'S BLUEPRINT IS PARSED, NOT DESCRIBED.
 *
 * §7.3 narrowed the accepted document versions to `[3]`. Every other witness in
 * the repo parses a document that a TEST wrote. Nothing parsed the document the
 * product actually ships with — the one embedded in the repo-root bundle layer
 * `cordis.patch.yml` — so a flip could have landed with the shipped composition
 * carrying bytes no build accepts, and the whole suite would have stayed green
 * because no test in the tree parses that file (measured: this file is the only
 * reader, and the fence that does scan it classifies text, never parses it).
 *
 * So this file reads the real file, extracts the real `blueprintSource` block,
 * and runs the real `parseBlueprint` on it. Four things are pinned:
 *
 *  1. it PARSES, at the version this build supports, carrying both v3-mandatory
 *     authority documents;
 *  2. its content hash, as a literal — the shipped team's identity;
 *  3. the same bytes with the version re-stamped to a retired digit REFUSE, which
 *     is what makes (1) a statement about the cutover rather than about YAML.
 *
 * What this file deliberately does NOT do: evaluate the shipped documents at the
 * authority ceiling. The shipped `teamHardEnvelope: { rules: [] }` is measured to
 * carry NO expansion authority (see the ceiling probe recorded in
 * dev/agent-workflow/evidence/a4-pr7/7-3-flip/FINDINGS.md §9), and whether that
 * is intended or a silent capability downgrade is an open product question — the
 * owner of that decision, not this lane, should pin it. A test asserting today's
 * answer would freeze a verdict that is still under review.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { describe, expect, it } from 'vitest'

import {
  RETIRED_BLUEPRINT_DOCUMENT_VERSIONS,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  parseBlueprint,
} from '../../domain/blueprint/src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')
const SHIPPED_PATCH = join(REPO_ROOT, 'cordis.patch.yml')

/**
 * Pull the embedded blueprint out of the bundle layer the way the file is
 * actually written: a YAML block scalar under `blueprintSource: |`, dedented by
 * that block's own indentation. Deliberately textual and deliberately loud —
 * it throws if the block moves or disappears, because an instrument that
 * silently returned `undefined` would make every leg below vacuously green.
 */
function shippedBlueprintSource(): string {
  const lines = readFileSync(SHIPPED_PATCH, 'utf8').split('\n')
  const at = lines.findIndex((l) => l.includes('blueprintSource: |'))
  const header = at < 0 ? undefined : lines[at]
  if (header === undefined) throw new Error('cordis.patch.yml carries no `blueprintSource: |` block')
  const indent = header.search(/\S/) + 2
  const body: string[] = []
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (line.trim() === '') {
      body.push('')
      continue
    }
    if (line.search(/\S/) < indent) break
    body.push(line.slice(indent))
  }
  const src = body.join('\n')
  // Guard the extraction itself, before any assertion reads it.
  expect(src).toContain('blueprintId:')
  expect(src).toMatch(/^schemaVersion: \d+$/m)
  return src
}

/** Measured on the §7.3 flip by this file. A literal on purpose: the shipped
 *  team's identity must not be re-derivable from the bytes it is checking. */

/** `parseBlueprint` THROWS on refusal (it is the strict boundary); the legs below
 *  need both outcomes without try/catch noise in each. `code` is captured from
 *  the throw rather than assumed. */
type ParsedBlueprint = ReturnType<typeof parseBlueprint>

function tryParse(source: string):
  | { ok: true; bp: ParsedBlueprint }
  | { ok: false; code: string; message: string } {
  try {
    return { ok: true, bp: parseBlueprint(source) as never }
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { ok: false, code: e.code ?? 'THREW-WITHOUT-CODE', message: e.message ?? '' }
  }
}

const SHIPPED_CONTENT_HASH = 'sha256:9ee498574d6651ab131a87b50fd435993fc7647252466da1608f7d542384152f'

describe('the shipped composition\'s embedded blueprint, parsed for real (§7.3)', () => {
  it('the document the product ships with parses at the version this build supports, with both authority documents', () => {
    const parsed = tryParse(shippedBlueprintSource())
    if (!parsed.ok) throw new Error(`shipped blueprint refused: ${parsed.code} ${parsed.message}`)
    expect(parsed.bp.schemaVersion).toBe(SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS[0])
    // Both documents PRESENT, not merely legal: `undefined` here would mean the
    // shipped composition relies on a default, and v3 permits none.
    expect(parsed.bp.permissionMutationEnvelope).toBeDefined()
    expect(parsed.bp.teamHardEnvelope).toBeDefined()
    expect(Object.hasOwn(parsed.bp, 'teamHardEnvelope')).toBe(true)
  })

  it('the shipped team is who we think it is: content hash pinned as a literal', () => {
    const parsed = tryParse(shippedBlueprintSource())
    if (!parsed.ok) throw new Error(`shipped blueprint does not parse (${parsed.code}); the hash cannot be measured`)
    expect(parsed.bp.contentHash).toBe(SHIPPED_CONTENT_HASH)
  })

  it('the SAME bytes with a retired version stamp refuse — the pin above is about the cutover, not about YAML', () => {
    const src = shippedBlueprintSource()
    const retired = RETIRED_BLUEPRINT_DOCUMENT_VERSIONS[0]
    const restamped = src.replace(/^schemaVersion: \d+$/m, `schemaVersion: ${String(retired)}`)
    expect(restamped).not.toBe(src)
    expect(tryParse(restamped).ok, 'a retired stamp must not parse').toBe(false)
    expect(tryParse(restamped).ok === false ? (tryParse(restamped) as { code: string }).code : '').toBe('SCHEMA_VERSION_MISMATCH')
  })

})
