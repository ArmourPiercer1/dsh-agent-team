/**
 * team-spill-local-composition.test.ts — PR #26 final supplemental §2:
 * the COMPOSITION-LEVEL regression for the `spill-local` →
 * `team-spill-local` config migration. The store-level C1/C2 (in
 * `team-spill-local.test.ts`) prove TeamAwareLocalSpillStore honors a
 * custom `root` / `cleanupPeriodDays`; THIS file proves the real bundle
 * composition + a profile same-id patch produces EXACTLY ONE active
 * `team-spill-local` row with the effective config — and pins the
 * failure mode the (old, corrected) INSTALL.md §3.4 `- insert:` example
 * would have caused: a second row with the same id → duplicate
 * `spillStore` provider → boot failure.
 *
 * Composition = `applyEntryPatches` from
 * `@deepseek-ai/cordis-plugin-include` — the single patch algorithm
 * shared by live mounting and `dsh --dump-config` ("a dump can never
 * drift from what boots"), applied layer-by-layer in boot order: the
 * base bundle's spill row insertion, then the shipped bundle layer
 * (the repo-root `cordis.patch.yml` — parsed from the real file, never a
 * copy, so the regression tracks the shipped rows), then the profile
 * patch layer. No provider boot, no loader API additions, no DSH
 * changes: the composed entry tree is asserted at the dump-config
 * level (row count + effective config).
 *
 *  C1  profile SAME-ID patch (the documented migration): the composed
 *      tree carries exactly one `team-spill-local` row, its `config`
 *      replaced wholesale (root + cleanupPeriodDays), its `name`
 *      preserved, the base `spill-local` row disabled, exactly one
 *      ACTIVE spillStore provider row (the team row), and zero
 *      skipped-patch warnings;
 *  C2  the old INSTALL.md `- insert:` example is the duplicate failure
 *      mode: it appends a SECOND `team-spill-local` row (two rows, two
 *      active spillStore providers) — pinned so the doc error can never
 *      silently return;
 *  C3  the optional `name` guard: a matching `name` applies the patch
 *      (zero warnings); a MISMATCHED `name` skips the patch (config
 *      untouched, one 'name mismatch' warning) — the module-mismatch
 *      guard INSTALL.md §3.4 documents.
 *
 * @module @dsh-agent-team/runtime/test/team-spill-local-composition
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'yaml'
import { describe, expect, it } from 'vitest'
import { applyEntryPatches, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'

const HERE = dirname(fileURLToPath(import.meta.url))
/** Repo root: packages/runtime/test → packages/runtime → packages → root. */
const REPO_ROOT = join(HERE, '..', '..', '..')
/** The shipped bundle layer (manifest `dsh.bundle.patch`) — the real file. */
const BUNDLE_PATCH = join(REPO_ROOT, 'cordis.patch.yml')

/** The base `spill-local` row as the @deepseek-ai/dsh-base bundle
 *  inserts it (verbatim, the one row this regression targets — the
 *  remaining base rows are unrelated to the spillStore replacement and
 *  would only bloat the fixture). */
const BASE_ROWS: EntryOptions[] = [
  { id: 'spill-local', name: '@deepseek-ai/dsh-spill-local' },
]

/** Every spillStore provider row in a composed tree: the base row and
 *  the team row are the only two rows whose `name` resolves to a
 *  spillStore provider module (a duplicate id means a duplicate
 *  provider — the boot failure the migration must not cause). */
const SPILL_PROVIDER_NAMES = new Set(['@deepseek-ai/dsh-spill-local', 'dsh-agent-team/spill-local'])

/** Collect every row of a composed tree (top-level plus group children,
 *  mirroring the patch algorithm's own entry indexing). */
function collectRows(rows: EntryOptions[]): EntryOptions[] {
  const out: EntryOptions[] = []
  const walk = (entries: EntryOptions[]): void => {
    for (const entry of entries) {
      out.push(entry)
      if (entry.group && Array.isArray(entry.config)) walk(entry.config as EntryOptions[])
    }
  }
  walk(rows)
  return out
}

function rowsById(rows: EntryOptions[], id: string): EntryOptions[] {
  return collectRows(rows).filter((row) => row.id === id)
}

function activeSpillProviders(rows: EntryOptions[]): EntryOptions[] {
  return collectRows(rows).filter((row) => !row.disabled && SPILL_PROVIDER_NAMES.has(String(row.name ?? '')))
}

/** Compose in boot order over the empty profile root: the base bundle's
 *  spill row insertion (minimal — the one row this regression targets),
 *  then the shipped bundle layer (the real repo-root file), then the
 *  profile patch layer — one `applyEntryPatches` pass per source layer,
 *  exactly how `dsh --dump-config` and the live boot compose. */
function compose(profilePatches: PatchOptions[], warns: string[]): EntryOptions[] {
  const bundlePatches = yaml.parse(readFileSync(BUNDLE_PATCH, 'utf8')) as EntryOptions[]
  const warn = (message: string, ...args: unknown[]): void => {
    let i = 0
    warns.push(message.replace(/%C/g, () => String(args[i++] ?? '')))
  }
  const afterBase = applyEntryPatches([], [{ insert: [...BASE_ROWS] }], warn)
  const afterBundle = applyEntryPatches(afterBase, bundlePatches, warn)
  return applyEntryPatches(afterBundle, profilePatches, warn)
}

const MIGRATION_CONFIG = { root: '/custom/spill', cleanupPeriodDays: 14 }

describe('team-spill-local composition (PR #26 final supplemental §2)', () => {
  it('C1: a profile SAME-ID patch overrides the bundle-inserted row — exactly one active team-spill-local, effective config, no duplicate spillStore', () => {
    const warns: string[] = []
    const tree = compose([{ id: 'team-spill-local', config: MIGRATION_CONFIG }], warns)

    // 1 + 4: exactly ONE team-spill-local row in the composed tree.
    const teamRows = rowsById(tree, 'team-spill-local')
    expect(teamRows).toHaveLength(1)

    // 3: the row's config is REPLACED wholesale with the profile config.
    expect(teamRows[0]?.config).toEqual(MIGRATION_CONFIG)
    // The row's identity fields survive the same-id patch (the bundle
    // row is patched in place, not replaced or duplicated).
    expect(teamRows[0]?.name).toBe('dsh-agent-team/spill-local')
    expect(teamRows[0]?.disabled).not.toBe(true)

    // 2: the base spill-local row exists and is disabled by the bundle layer.
    const baseRows = rowsById(tree, 'spill-local')
    expect(baseRows).toHaveLength(1)
    expect(baseRows[0]?.disabled).toBe(true)

    // 5: exactly ONE ACTIVE spillStore provider row — and it is the team row.
    const active = activeSpillProviders(tree)
    expect(active).toHaveLength(1)
    expect(active[0]?.id).toBe('team-spill-local')
    expect(active[0]?.config).toEqual(MIGRATION_CONFIG)

    // A clean composition: no patch was skipped (no unknown id, no name
    // mismatch, no stray insert).
    expect(warns).toEqual([])
  })

  it('C2: the old INSTALL.md `- insert:` example DUPLICATES the row (the boot-failure mode the corrected doc must prevent)', () => {
    const warns: string[] = []
    const tree = compose(
      [{
        insert: [
          { id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: MIGRATION_CONFIG },
        ],
      }],
      warns,
    )

    // A bare `insert` appends a NEW row: the composed tree now carries
    // TWO team-spill-local rows → two active spillStore providers.
    expect(rowsById(tree, 'team-spill-local')).toHaveLength(2)
    expect(activeSpillProviders(tree)).toHaveLength(2)
    expect(warns).toEqual([]) // the duplicate is silent at patch time — it breaks BOOT
  })

  it('C3: the optional `name` guard — matching name applies, mismatched name skips the patch', () => {
    // Matching name: the patch applies exactly like the bare form.
    const okWarns: string[] = []
    const okTree = compose([{ id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: MIGRATION_CONFIG }], okWarns)
    expect(rowsById(okTree, 'team-spill-local')[0]?.config).toEqual(MIGRATION_CONFIG)
    expect(okWarns).toEqual([])

    // Mismatched name: the patch is SKIPPED (the row keeps its bundle
    // state — no config at all) and the skip is warned.
    const badWarns: string[] = []
    const badTree = compose([{ id: 'team-spill-local', name: 'some-other/spill-local', config: MIGRATION_CONFIG }], badWarns)
    const badRow = rowsById(badTree, 'team-spill-local')[0]
    expect(badRow?.config).toBeUndefined()
    expect(badWarns).toHaveLength(1)
    expect(badWarns[0]).toMatch(/name mismatch/i)
  })
})
