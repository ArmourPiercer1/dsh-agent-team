/**
 * a5sf-provider-composition.test.ts — P1-06 (Gate G1.6): provider replacement
 * is `disable + insert`, exactly one active provider per service, and a broken
 * composition is REFUSED rather than half-applied.
 *
 * The composition algorithm is the real `applyEntryPatches` from
 * `@deepseek-ai/cordis-plugin-include` (the algorithm `dsh --dump-config` and
 * the live boot share); the shipped bundle layer is parsed from the REAL
 * repo-root `cordis.patch.yml`, so the dormancy assertion tracks the file, not a
 * copy. This file does NOT boot a host: the `pnpm smoke:composition` /
 * `dump-config` run is disclosed as unavailable in the P1-06 evidence.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-provider-composition
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'yaml'
import { describe, expect, it } from 'vitest'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import {
  assertDormant,
  collectRows,
  COMPOSITION_REFUSAL_CODES,
  planProviderReplacement,
  replaceProvider,
  TEAM_SERVICE_ROWS,
} from '../team-services/src/manifest.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')
const BUNDLE_PATCH = join(REPO_ROOT, 'cordis.patch.yml')

/** A minimal base composition: one provider row per managed service. */
function baseEntries(): EntryOptions[] {
  return [
    { id: 'fs-sandbox', name: '@deepseek-ai/dsh-fs-sandbox' },
    { id: 'web-fetch', name: '@deepseek-ai/dsh-tool-web' },
    { id: 'shell', name: '@deepseek-ai/dsh-terminal-bash' },
  ]
}

function rowsOf(entries: readonly EntryOptions[], id: string): EntryOptions[] {
  return collectRows(entries).filter((row) => row.id === id)
}

describe('P1-06 provider replacement', () => {
  it('replaces one provider: base disabled, exactly one active Team row', () => {
    const result = replaceProvider(baseEntries(), TEAM_SERVICE_ROWS[0]!)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const composed = result.value.entries
    expect(rowsOf(composed, 'fs-sandbox')).toHaveLength(1)
    expect(rowsOf(composed, 'fs-sandbox')[0]?.disabled).toBe(true)
    expect(rowsOf(composed, 'team-fs')).toHaveLength(1)
    expect(rowsOf(composed, 'team-fs')[0]?.name).toBe('@dsh-agent-team/runtime/team-services/fs')
    expect(rowsOf(composed, 'team-fs')[0]?.disabled).not.toBe(true)
  })

  it('plans every declared replacement in one all-or-nothing pass', () => {
    const result = planProviderReplacement(baseEntries())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.replaced).toEqual(['fs', 'web', 'process'])
    for (const row of TEAM_SERVICE_ROWS) {
      expect(rowsOf(result.value.entries, row.baseRowId)[0]?.disabled).toBe(true)
      const team = rowsOf(result.value.entries, row.teamRowId)
      expect(team).toHaveLength(1)
      expect(team[0]?.disabled).not.toBe(true)
    }
  })

  it('refuses a missing base row instead of inserting a lone Team provider', () => {
    const onlyFs = baseEntries().filter((row) => row.id === 'fs-sandbox')
    const result = replaceProvider(onlyFs, TEAM_SERVICE_ROWS.find((row) => row.service === 'web')!)
    expect(result).toMatchObject({ ok: false, code: 'BASE_ROW_MISSING', service: 'web' })
  })

  it('refuses a duplicate Team row (the two-providers boot failure)', () => {
    const withTeam = [...baseEntries(), { id: 'team-fs', name: '@dsh-agent-team/runtime/team-services/fs' }]
    const result = replaceProvider(withTeam, TEAM_SERVICE_ROWS[0]!)
    expect(result).toMatchObject({ ok: false, code: 'TEAM_ROW_DUPLICATE' })
  })

  it('refuses an unmatched patch target (no silent skip)', () => {
    const result = replaceProvider([], { ...TEAM_SERVICE_ROWS[0]!, baseRowId: 'nope' })
    expect(result).toMatchObject({ ok: false, code: 'BASE_ROW_MISSING' })
  })

  it('is a closed refusal vocabulary', () => {
    expect(COMPOSITION_REFUSAL_CODES).toContain('TEAM_ROW_ACTIVE_WITH_BASE')
    expect(COMPOSITION_REFUSAL_CODES).toContain('PATCH_UNMATCHED')
  })
})

describe('P1-06 shipped bundle dormancy (normal DSH unaffected)', () => {
  it('the real cordis.patch.yml contains none of the unshipped Team rows', () => {
    const shipped = yaml.parse(readFileSync(BUNDLE_PATCH, 'utf8')) as EntryOptions[]
    expect(assertDormant(shipped).ok).toBe(true)
    const rows = collectRows(shipped)
    for (const declared of TEAM_SERVICE_ROWS) {
      expect(rows.some((row) => row.id === declared.teamRowId)).toBe(false)
      expect(rows.some((row) => row.name === declared.teamPlugin)).toBe(false)
    }
  })

  it('the dormancy guard refuses a bundle that ships a Team row early', () => {
    const shipped = yaml.parse(readFileSync(BUNDLE_PATCH, 'utf8')) as EntryOptions[]
    const smuggled = [...shipped, { id: 'team-fs', name: '@dsh-agent-team/runtime/team-services/fs' }]
    expect(assertDormant(smuggled)).toMatchObject({ ok: false, code: 'TEAM_ROW_SHIPPED_EARLY', service: 'fs' })
  })

  it('every declared row is explicitly unshipped in this round', () => {
    expect(TEAM_SERVICE_ROWS.every((row) => row.shipped === false)).toBe(true)
  })
})
