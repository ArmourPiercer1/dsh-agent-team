/**
 * bp1-blueprint-authority.test.ts — BP3 + BP4 spec: the filesystem
 * Blueprint source index, the live BlueprintAuthority, and the live
 * BlueprintCatalog facade (issue #2 blueprint-loading parallel repair).
 *
 * The pinned behaviors (plan §7/§8):
 *
 *   - path semantics: absolute dir as-is, relative against the host
 *     process.cwd(), absent → the filesystem catalog is disabled;
 *   - scan rule: *.yaml / *.yml candidates, *.draft.* ignored, everything
 *     else ignored; one rescan per request (no cache, no watcher);
 *   - identity-level inspection only (plan §7.4): a logically broken
 *     saved source is still LISTED (its identity is readable) and fails
 *     only when RESOLVED; a source with a broken IDENTITY (bad YAML)
 *     carries no identity and is absent from the listing;
 *   - shadow precedence (plan §7.3 registry-wins, extended to the pinned
 *     anchor — the RED-1 contract): a saved file carrying the identity of
 *     a frozen registry row OR the bootstrap anchor is shadowed (listed
 *     once, under the shadowing source); only two saved files with the
 *     same identity fail loud TEAM_BLUEPRINT_REVISION_DUPLICATE;
 *   - resolve precedence: registry → parse the stored source text → the
 *     hash must match the row (integrity); else the current mutable
 *     source, strong-parsed fresh on demand;
 *   - a frozen revision stays resolvable after the disk file is deleted
 *     (the registry source text is the authority);
 *   - freezeSnapshot: idempotent for same-hash; loud
 *     TEAM_BLUEPRINT_REVISION_FROZEN for a different-hash frozen
 *     identity; the TOCTOU fence — a file rewritten between the earlier
 *     resolve and the freeze fails TEAM_BLUEPRINT_SNAPSHOT_MISMATCH
 *     (never freezes other content);
 *   - the live facade implements the domain BlueprintCatalog interface
 *     with every call querying the current state (a source added after
 *     boot is visible on the next query — the RED-2 behavior) and the
 *     static catalog's closed not-found wording + revision order.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds build and the freeze operations run at module load
 * (top-level await), the `it` bodies assert synchronously (the
 * t12b1 / t12m4 pattern).
 *
 * @module @dsh-agent-team/runtime/test/bp1-blueprint-authority
 */
import { describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  parseBlueprint,
  toBlueprintSnapshotRef,
} from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { revisionSource, NEG_INVALID_YAML, NEG_MISSING_LEADER } from '../../domain/blueprint/testdata/fixtures.js'
import { TeamContractError } from '../../contracts/src/index.js'

import { createBlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import { createBlueprintAuthority } from '../src/plugin/blueprint-authority.js'
import type { BlueprintRegistryPort, BlueprintRegistryRecordView } from '../src/plugin/blueprint-authority.js'
import { createLiveBlueprintCatalog } from '../src/plugin/blueprint-live-catalog.js'
import { isTeamPluginError } from '../src/plugin/types.js'

// --- scratch + fixtures --------------------------------------------------------

const thisFile = fileURLToPath(import.meta.url)
const sep = thisFile.includes('\\') ? '\\' : '/'
const testDir = thisFile.slice(0, thisFile.lastIndexOf(sep))
const scratchRoot = testDir + sep + '.tmp-bp1'

function dir(name: string): string {
  return scratchRoot + sep + name
}
function makeDir(name: string): string {
  const p = dir(name)
  mkdirSync(p, { recursive: true })
  return p
}
function writeSource(d: string, name: string, source: string): void {
  writeFileSync(d + sep + name, source)
}

/** One in-memory registry row store (the structural port, same semantics). */
class MemRegistry implements BlueprintRegistryPort {
  readonly rows = new Map<string, BlueprintRegistryRecordView>()

  get(blueprintId: string, revision: string): BlueprintRegistryRecordView | undefined {
    return this.rows.get(`${blueprintId}@${revision}`)
  }

  list(): readonly BlueprintRegistryRecordView[] {
    return [...this.rows.values()]
  }

  async freeze(input: {
    readonly blueprintId: string
    readonly revision: string
    readonly contentHash: string
    readonly source: string
    readonly frozenAt: string
  }): Promise<BlueprintRegistryRecordView> {
    const key = `${input.blueprintId}@${input.revision}`
    const existing = this.rows.get(key)
    if (existing !== undefined) {
      if (existing.contentHash === input.contentHash) return existing
      const error = new Error('RECORD_DUPLICATE: blueprint-revision-frozen')
      ;(error as { code?: string }).code = 'RECORD_DUPLICATE'
      throw error
    }
    const row: BlueprintRegistryRecordView = {
      schemaVersion: 2,
      blueprintId: input.blueprintId,
      revision: input.revision,
      contentHash: input.contentHash,
      source: input.source,
      frozenAt: input.frozenAt,
    }
    this.rows.set(key, row)
    return row
  }
}

function capture(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (error) {
    return error
  }
}

// --- W0: the source index (plan BP3) -------------------------------------------

const W0 = makeDir('w0')
writeSource(W0, 'team.a.yaml', revisionSource('bp1.index', '1', 'A lead.'))
writeSource(W0, 'team.b.yml', revisionSource('bp1.index2', '1', 'B lead.'))
writeSource(W0, 'team.c.draft.yaml', revisionSource('bp1.draft', '1', 'Draft lead.'))
writeSource(W0, 'notes.md', 'not a blueprint')
const W0_DIRFILE = W0 + sep + 'fake.yaml'
mkdirSync(W0_DIRFILE, { recursive: true }) // a DIRECTORY named *.yaml — excluded by isFile

const w0Index = createBlueprintSourceIndex({ blueprintDir: W0 })

describe('bp1 source index: path semantics + scan rule (plan §7.2/§7.3)', () => {
  it('absolute dir: lists candidates stable-sorted, drafts + non-yaml + directories ignored', () => {
    expect(w0Index.dir).toBe(W0)
    expect(w0Index.listSourceFiles()).toEqual(['team.a.yaml', 'team.b.yml'])
  })

  it('absent blueprintDir: the filesystem catalog is disabled', () => {
    const disabled = createBlueprintSourceIndex({})
    expect(disabled.dir).toBe(undefined)
    expect(disabled.listSourceFiles()).toEqual([])
    const err = capture(() => disabled.readSource('team.a.yaml'))
    expect(isTeamPluginError(err) && err.code).toBe('TEAM_BLUEPRINT_FILE_UNREADABLE')
  })

  it('a configured dir that does not exist: disabled state, no error', () => {
    const missing = createBlueprintSourceIndex({ blueprintDir: W0 + sep + 'no-such-dir' })
    expect(missing.listSourceFiles()).toEqual([])
  })

  it('relative blueprintDir resolves against the host process.cwd()', () => {
    const rel = 'packages/runtime/test/.tmp-bp1/rel'
    mkdirSync(process.cwd() + sep + 'packages' + sep + 'runtime' + sep + 'test' + sep + '.tmp-bp1' + sep + 'rel', { recursive: true })
    const idx = createBlueprintSourceIndex({ blueprintDir: rel })
    const expected = process.cwd() + sep + rel
    expect(idx.dir).toBe(expected)
    expect(idx.listSourceFiles()).toEqual([])
  })

  it('rescans on every call: a file added after the first scan appears; a deleted one vanishes', () => {
    writeSource(W0, 'team.d.yaml', revisionSource('bp1.index3', '1', 'D lead.'))
    expect(w0Index.listSourceFiles()).toEqual(['team.a.yaml', 'team.b.yml', 'team.d.yaml'])
    rmSync(W0 + sep + 'team.d.yaml', { recursive: false, force: true })
    expect(w0Index.listSourceFiles()).toEqual(['team.a.yaml', 'team.b.yml'])
  })

  it('readSource returns the current text; a traversal name is refused', () => {
    expect(w0Index.readSource('team.a.yaml')).toBe(revisionSource('bp1.index', '1', 'A lead.'))
    const err = capture(() => w0Index.readSource('..\\secret.yaml'))
    expect(isTeamPluginError(err) && err.code).toBe('TEAM_BLUEPRINT_FILE_UNREADABLE')
  })

  it('inspectSource: identity-level result (ok identity / rejected diagnostics)', () => {
    expect(w0Index.inspectSource('team.a.yaml').status).toBe('ok')
    writeSource(W0, 'bad.yaml', NEG_INVALID_YAML.source)
    expect(w0Index.inspectSource('bad.yaml').status).toBe('rejected')
    rmSync(W0 + sep + 'bad.yaml', { recursive: false, force: true })
  })
})

// --- W1: the authority (plan BP4) ------------------------------------------------

const W1 = makeDir('w1')
const W1_BOOTSTRAP = revisionSource('bp1.anchor', '1', 'Anchor lead.')
const W1_SAVED_V1 = revisionSource('bp1.saved', '1', 'Saved lead v1.')
writeSource(W1, 'saved.yaml', W1_SAVED_V1)
const w1Registry = new MemRegistry()
const W1_NOW = '2026-08-29T12:00:00Z'

const w1Authority = createBlueprintAuthority({
  bootstrapSource: W1_BOOTSTRAP,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: W1 }),
  registry: w1Registry,
  now: () => W1_NOW,
})

const w1SavedRef = toBlueprintSnapshotRef(parseBlueprint(W1_SAVED_V1))
const w1AnchorBp: TeamBlueprint = parseBlueprint(W1_BOOTSTRAP)
const w1AnchorRef = toBlueprintSnapshotRef(w1AnchorBp)

describe('bp1 authority: the live identity union (plan §8)', () => {
  it('lists the bootstrap + saved identities, saved contentHash unknown until strong parse', () => {
    const ids = w1Authority.listIdentities()
    expect(ids.length).toBe(2)
    const anchorId = ids.find((i) => i.blueprintId === 'bp1.anchor')
    const savedId = ids.find((i) => i.blueprintId === 'bp1.saved')
    expect(anchorId?.origin).toBe('bootstrap')
    expect(anchorId?.contentHash).toBe(w1AnchorRef.contentHash)
    expect(savedId?.origin).toBe('saved')
    expect(savedId?.sourceFile).toBe('saved.yaml')
    expect(savedId?.contentHash).toBe(undefined) // identity-level scan (plan §7.4)
  })

  it('resolves the saved source strong-parsed fresh + the bootstrap anchor', () => {
    const saved = w1Authority.resolve('bp1.saved', '1')
    expect(saved.contentHash).toBe(w1SavedRef.contentHash)
    const anchor = w1Authority.resolve('bp1.anchor', '1')
    expect(anchor.contentHash).toBe(w1AnchorRef.contentHash)
  })

  it('a source added AFTER the authority exists is listed on the NEXT call (no snapshot)', () => {
    writeSource(W1, 'late.yaml', revisionSource('bp1.late', '1', 'Late lead.'))
    const ids = w1Authority.listIdentities()
    expect(ids.length).toBe(3)
    expect(ids.some((i) => i.blueprintId === 'bp1.late' && i.origin === 'saved')).toBe(true)
    rmSync(W1 + sep + 'late.yaml', { recursive: false, force: true })
    expect(w1Authority.listIdentities().length).toBe(2)
  })

  it('a malformed id fails loud at the resolve boundary (grammar fence)', () => {
    const err = capture(() => w1Authority.resolve('bad id', '1'))
    expect(err instanceof TeamContractError && err.code).toBe('INVALID_BLUEPRINT_ID')
  })

  it('a missing identity fails with the static catalog closed wording', () => {
    const err = capture(() => w1Authority.resolve('bp1.ghost', '1'))
    expect(err instanceof TeamContractError && err.code).toBe('MALFORMED_DTO')
    const details = (err as TeamContractError).details as { reason?: string; blueprintId?: string } | undefined
    expect(details?.reason).toBe('blueprint-not-found')
    expect(details?.blueprintId).toBe('bp1.ghost')
    const latestErr = capture(() => w1Authority.resolve('bp1.ghost'))
    expect(latestErr instanceof TeamContractError && latestErr.code).toBe('MALFORMED_DTO')
  })
})

describe('bp1 authority: revision order (the domain catalog order, shared export)', () => {
  const W1B = makeDir('w1b')
  for (const rev of ['1', '2', '10', 'beta']) {
    writeSource(W1B, `num-${rev}.yaml`, revisionSource('bp1.num', rev, `Num lead ${rev}.`))
  }
  const w1b = createBlueprintAuthority({
    bootstrapSource: W1_BOOTSTRAP,
    sourceIndex: createBlueprintSourceIndex({ blueprintDir: W1B }),
    registry: new MemRegistry(),
  })

  it('latest = digit revisions numerically first, then non-digit lexicographic', () => {
    expect(w1b.resolve('bp1.num').revision).toBe('beta')
    const err = capture(() => w1b.resolve('bp1.num', '99'))
    expect(err instanceof TeamContractError && err.code).toBe('MALFORMED_DTO')
  })
})

// --- W2: duplicate mutable sources fail loud -------------------------------------

const W2 = makeDir('w2')
const W2_DUPE = revisionSource('bp1.dupe', '1', 'Dupe lead.')
writeSource(W2, 'dupe-a.yaml', W2_DUPE)
writeSource(W2, 'dupe-b.yaml', W2_DUPE)
const w2Authority = createBlueprintAuthority({
  bootstrapSource: W1_BOOTSTRAP,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: W2 }),
  registry: new MemRegistry(),
})

describe('bp1 authority: duplicate mutable identities (plan §7.3)', () => {
  it('two saved files with the same (id, revision): fail loud on listing', () => {
    const err = capture(() => w2Authority.listIdentities())
    expect(isTeamPluginError(err) && err.code).toBe('TEAM_BLUEPRINT_REVISION_DUPLICATE')
    const detail = (err as { detail?: Record<string, unknown> }).detail
    expect(detail?.existing).toBe('dupe-a.yaml')
    expect(detail?.incoming).toBe('dupe-b.yaml')
  })

  it('a saved file carrying the ANCHOR identity is shadowed by the anchor (RED-1 contract, not a duplicate)', () => {
    const W2B = makeDir('w2b')
    writeSource(W2B, 'anchor-copy.yaml', W1_BOOTSTRAP)
    const w2b = createBlueprintAuthority({
      bootstrapSource: W1_BOOTSTRAP,
      sourceIndex: createBlueprintSourceIndex({ blueprintDir: W2B }),
      registry: new MemRegistry(),
    })
    const ids = w2b.listIdentities()
    const anchorIds = ids.filter((i) => i.blueprintId === 'bp1.anchor')
    expect(anchorIds.length).toBe(1)
    expect(anchorIds[0]?.origin).toBe('bootstrap')
    expect(ids.some((i) => i.sourceFile === 'anchor-copy.yaml')).toBe(false) // shadowed, not a second identity
    // the pinned anchor's content wins over the disk copy
    expect(w2b.resolve('bp1.anchor', '1').contentHash).toBe(w1AnchorRef.contentHash)
  })
})

// --- W3: the registry wins + frozen-after-deletion + TOCTOU + freeze -------------

const W3 = makeDir('w3')
const W3_SAVED_V1 = revisionSource('bp1.frozen', '1', 'Frozen lead v1.')
const W3_SAVED_V2 = revisionSource('bp1.frozen', '1', 'Frozen lead v2 (rewritten).')
writeSource(W3, 'frozen.yaml', W3_SAVED_V1)
const w3Registry = new MemRegistry()
const w3Authority = createBlueprintAuthority({
  bootstrapSource: W1_BOOTSTRAP,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: W3 }),
  registry: w3Registry,
  now: () => W1_NOW,
})
const w3V1Bp = parseBlueprint(W3_SAVED_V1)
const w3V1Ref = toBlueprintSnapshotRef(w3V1Bp)
const w3V2Ref = toBlueprintSnapshotRef(parseBlueprint(W3_SAVED_V2))

// top-level await: the freeze operations (the shim forbids async it bodies)
await w3Authority.freezeSnapshot(w3V1Ref) // the clean freeze (append)
await w3Authority.freezeSnapshot(w3V1Ref) // idempotent (same hash)

const w3FrozenRow = w3Registry.get('bp1.frozen', '1')

// The different-hash freeze of the frozen identity: captured rejection.
const w3FrozenDupErr: unknown = await w3Authority
  .freezeSnapshot(w3V2Ref)
  .then(() => undefined, (error: unknown) => error)

// The disk file is now rewritten to V2 — the registry (frozen V1) must win.
writeSource(W3, 'frozen.yaml', W3_SAVED_V2)

// W3C: the TOCTOU fence on a NOT-yet-frozen identity — the ref was taken
// from the mutable state, the file is rewritten, THEN the freeze runs
// (the plan §8 fence: a file changed between the team.create resolve and
// the freeze must fail the freeze, never freeze other content).
const W3C = makeDir('w3c')
const W3C_X = revisionSource('bp1.toctou', '1', 'TOCTOU lead X.')
writeSource(W3C, 'toc.yaml', W3C_X)
const w3cRegistry = new MemRegistry()
const w3cAuthority = createBlueprintAuthority({
  bootstrapSource: W1_BOOTSTRAP,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: W3C }),
  registry: w3cRegistry,
  now: () => W1_NOW,
})
const w3cRefX = toBlueprintSnapshotRef(parseBlueprint(W3C_X))
writeSource(W3C, 'toc.yaml', revisionSource('bp1.toctou', '1', 'TOCTOU lead Y (rewritten).'))
const w3cToctouErr: unknown = await w3cAuthority
  .freezeSnapshot(w3cRefX)
  .then(() => undefined, (error: unknown) => error)
const w3cHashY = parseBlueprint(revisionSource('bp1.toctou', '1', 'TOCTOU lead Y (rewritten).')).contentHash

describe('bp1 authority: freeze barrier semantics (plan §8 freezeSnapshot)', () => {
  it('a clean freeze appends the row with the exact parsed source text + the injected clock', () => {
    expect(w3FrozenRow).not.toBe(undefined)
    expect(w3FrozenRow?.schemaVersion).toBe(2)
    expect(w3FrozenRow?.contentHash).toBe(w3V1Ref.contentHash)
    expect(w3FrozenRow?.source).toBe(W3_SAVED_V1)
    expect(w3FrozenRow?.frozenAt).toBe(W1_NOW)
    expect(w3Registry.list().length).toBe(1) // the idempotent second freeze added nothing
  })

  it('a different-hash freeze of a frozen identity fails TEAM_BLUEPRINT_REVISION_FROZEN with both hashes', () => {
    expect(isTeamPluginError(w3FrozenDupErr) && w3FrozenDupErr.code).toBe('TEAM_BLUEPRINT_REVISION_FROZEN')
    const detail = (w3FrozenDupErr as { detail?: Record<string, unknown> }).detail
    expect(detail?.expectedContentHash).toBe(w3V2Ref.contentHash)
    expect(detail?.foundContentHash).toBe(w3V1Ref.contentHash)
    expect(w3Registry.get('bp1.frozen', '1')?.contentHash).toBe(w3V1Ref.contentHash) // the stored row stays
  })

  it('TOCTOU fence: a file rewritten between resolve and freeze fails, never freezing other content', () => {
    expect(isTeamPluginError(w3cToctouErr) && w3cToctouErr.code).toBe('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH')
    const detail = (w3cToctouErr as { detail?: Record<string, unknown> }).detail
    expect(detail?.reason).toBe('freeze-source-changed')
    expect(detail?.expectedContentHash).toBe(w3cRefX.contentHash)
    expect(detail?.foundContentHash).toBe(w3cHashY)
    expect(w3cRegistry.list().length).toBe(0) // nothing was frozen
  })
})

describe('bp1 authority: registry precedence + frozen-after-deletion (plan §7.3)', () => {
  it('the registry wins over a rewritten disk file of the same identity', () => {
    const ids = w3Authority.listIdentities()
    const frozen = ids.find((i) => i.blueprintId === 'bp1.frozen')
    expect(frozen?.origin).toBe('frozen')
    expect(frozen?.contentHash).toBe(w3V1Ref.contentHash) // the disk file now parses to V2 — ignored
  })

  it('resolve returns the FROZEN content (parsed from the registry source text)', () => {
    const bp = w3Authority.resolve('bp1.frozen', '1')
    expect(bp.contentHash).toBe(w3V1Ref.contentHash)
  })

  it('the frozen revision stays resolvable after the disk file is DELETED', () => {
    rmSync(W3 + sep + 'frozen.yaml', { recursive: false, force: true })
    const ids = w3Authority.listIdentities()
    expect(ids.some((i) => i.blueprintId === 'bp1.frozen' && i.origin === 'frozen')).toBe(true)
    const bp = w3Authority.resolve('bp1.frozen', '1')
    expect(bp.contentHash).toBe(w3V1Ref.contentHash)
  })

  it('resolveSnapshot verifies the ref against the current (frozen) content', () => {
    expect(w3Authority.resolveSnapshot(w3V1Ref).contentHash).toBe(w3V1Ref.contentHash)
    const err = capture(() => w3Authority.resolveSnapshot(w3V2Ref))
    expect(isTeamPluginError(err) && err.code).toBe('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH')
  })
})

// --- W4: logically broken vs identity-broken saved sources (plan §7.4) ------------

const W4 = makeDir('w4')
writeSource(W4, 'ok.yaml', revisionSource('bp1.ok', '1', 'OK lead.'))
writeSource(W4, 'broken.yaml', NEG_MISSING_LEADER.source) // identity ok, semantics broken
writeSource(W4, 'garbage.yaml', NEG_INVALID_YAML.source) // identity broken
const w4Authority = createBlueprintAuthority({
  bootstrapSource: W1_BOOTSTRAP,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: W4 }),
  registry: new MemRegistry(),
})

describe('bp1 authority: no whole-catalog strong parse (plan §7.4)', () => {
  it('a logically broken source is LISTED by identity; the identity-broken one is absent', () => {
    const ids = w4Authority.listIdentities()
    expect(ids.some((i) => i.blueprintId === 'bp1.ok')).toBe(true)
    expect(ids.some((i) => i.blueprintId === 'team.min' && i.sourceFile === 'broken.yaml')).toBe(true)
    expect(ids.some((i) => i.sourceFile === 'garbage.yaml')).toBe(false)
    // the listing itself never threw despite the broken sources
    expect(ids.length).toBe(3) // bootstrap + bp1.ok + team.min(broken)
  })

  it('resolving the logically broken source fails with the annotated strong parse error', () => {
    const err = capture(() => w4Authority.resolve('team.min', '1'))
    expect(err instanceof TeamContractError).toBe(true)
    const details = (err as TeamContractError).details as { sourceName?: string } | undefined
    expect(details?.sourceName).toBe('broken.yaml')
    // the OTHER sources stay resolvable (the catalog is not taken down)
    expect(w4Authority.resolve('bp1.ok', '1').contentHash).not.toBe(undefined)
  })
})

// --- W5: the live catalog facade (plan BP5 preparation) ---------------------------

const W5 = makeDir('w5')
writeSource(W5, 'five.yaml', revisionSource('bp1.five', '1', 'Five lead v1.'))
for (const rev of ['2', '10']) {
  writeSource(W5, `five-${rev}.yaml`, revisionSource('bp1.five', rev, `Five lead ${rev}.`))
}
const w5Authority = createBlueprintAuthority({
  bootstrapSource: W1_BOOTSTRAP,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: W5 }),
  registry: new MemRegistry(),
})
const w5Catalog = createLiveBlueprintCatalog(w5Authority)

describe('bp1 live catalog facade: the domain interface over live state (plan §8)', () => {
  it('blueprintIds / hasBlueprint over the current union', () => {
    expect(w5Catalog.blueprintIds).toEqual(['bp1.anchor', 'bp1.five'])
    expect(w5Catalog.hasBlueprint('bp1.five')).toBe(true)
    expect(w5Catalog.hasBlueprint('bp1.ghost')).toBe(false)
  })

  it('listRevisions under the shared domain order; a missing id fails with the closed wording', () => {
    expect(w5Catalog.listRevisions('bp1.five')).toEqual(['1', '2', '10'])
    const err = capture(() => w5Catalog.listRevisions('bp1.ghost'))
    expect(err instanceof TeamContractError && err.code).toBe('MALFORMED_DTO')
    expect(((err as TeamContractError).details as { reason?: string })?.reason).toBe('blueprint-not-found')
  })

  it('resolve / resolveLatest / snapshotOf delegate to the live state', () => {
    expect(w5Catalog.resolve('bp1.five', '2').revision).toBe('2')
    expect(w5Catalog.resolveLatest('bp1.five').revision).toBe('10')
    const ref = w5Catalog.snapshotOf('bp1.five', '10')
    expect(ref.blueprintId).toBe('bp1.five')
    expect(ref.revision).toBe('10')
    expect(ref.contentHash).toBe(w5Authority.resolve('bp1.five', '10').contentHash)
  })

  it('a source added after the facade exists is visible on the NEXT query (RED-2 surface)', () => {
    writeSource(W5, 'six.yaml', revisionSource('bp1.six', '1', 'Six lead.'))
    expect(w5Catalog.blueprintIds).toEqual(['bp1.anchor', 'bp1.five', 'bp1.six'])
    expect(w5Catalog.hasBlueprint('bp1.six')).toBe(true)
    rmSync(W5 + sep + 'six.yaml', { recursive: false, force: true })
    expect(w5Catalog.blueprintIds).toEqual(['bp1.anchor', 'bp1.five'])
  })

  it('the facade exposes NO write surface (freezing lives on the authority)', () => {
    expect('freeze' in w5Catalog).toBe(false)
    expect('freezeSnapshot' in w5Catalog).toBe(false)
    expect(typeof w5Catalog.resolve).toBe('function')
    expect(typeof w5Catalog.resolveLatest).toBe('function')
    expect(typeof w5Catalog.snapshotOf).toBe('function')
  })
})

// --- scratch cleanup ---------------------------------------------------------------
rmSync(scratchRoot, { recursive: true, force: true })
