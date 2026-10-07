/**
 * a4p7-v3-cutover-acceptance.test.ts — A4-PR7 Task 7 acceptance lane.
 *
 * GROUPS A/B/C (Task 7.1): MIGRATION DISCOVERABILITY. The bug this file closes
 * is not a crash — it is an INVISIBILITY. Before Task 7.1 the identity-level
 * inspector answered a retired document version with `{status:'rejected'}` (its
 * version gate sat BEFORE the `blueprintId` / `revision` parsing) and the
 * Blueprint authority skipped every `rejected` inspection. Once the bridge is
 * removed, that pair deletes every unmigrated Blueprint from `listIdentities`, so
 * from the catalog, so from the migration runbook: the one document the operator
 * still has to migrate becomes the one document nobody can see, and the affected
 * Team's refusal has no discoverable cause. Three facts had to stay distinct and
 * were not: CURRENT (runs), RETIRED (identity readable, run refused, migration
 * owed), UNREADABLE (no identity owed at all).
 *
 * GROUP D adds the v3-only cutover acceptance in its own commit — the assertions
 * whose reachability depends on `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`
 * land in the commit that flips it, so nothing in this file is a skipped or
 * vacuous stand-in.
 *
 * HOW THE POST-CUTOVER STATE IS REACHED WITHOUT WAITING FOR IT. Nothing here
 * mutates the domain's version sets and nothing is `it.skip`ed:
 *
 *  - the facts that are true AT THIS COMMIT (the identity-first ordering, the
 *    derived retired set, the typed-name law, the distinction from
 *    parse-rejection) are asserted directly;
 *  - the facts that become reachable only when the bridge is removed are driven
 *    through the authority's OWN structural seam — `cutoverIndex()`, a source
 *    index whose `inspectSource` answers like the inspector of a build that runs
 *    `[3]` (a well-formed identity on a retired version → `migration-required`).
 *    The subject under test is the AUTHORITY's use of that value (keep it listed,
 *    refuse it typed), which is precisely what Task 7.1 changed; the file on disk
 *    is a real saved source found by the real scan. When the cutover commit
 *    narrows the set, the wrapper is replaced by the plain index and the
 *    assertions do not change — a stand-in that deletes itself rather than one
 *    that has to be remembered.
 *  - a claim that needs the domain set itself narrowed (a FROZEN ROW on a retired
 *    version) is NOT faked here; it lands in group D. Its half that is reachable
 *    now — a row on a version nobody defined gets the OTHER refusal — is here.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies, so the
 * worlds are built at module load and the `it` bodies assert synchronously (the
 * bp1 / t12b1 pattern). Scratch lives under this test directory (the
 * workspace-write sandbox forbids writing outside the workspace) and is removed
 * at module load AND in `afterAll`.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-v3-cutover-acceptance
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  BLUEPRINT_VERSION_REFUSAL_CODES,
  BLUEPRINT_VERSION_REFUSAL_CODE_VALUES,
  DEFINED_BLUEPRINT_DOCUMENT_VERSIONS,
  RETIRED_BLUEPRINT_DOCUMENT_VERSIONS,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  inspectBlueprintSource,
  parseBlueprint,
} from '../../domain/blueprint/src/index.js'
import type { BlueprintInspectionResult } from '../../domain/blueprint/src/index.js'
import { NEG_INVALID_YAML, revisionSource } from '../../domain/blueprint/testdata/fixtures.js'

import { createBlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import type { BlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import { createBlueprintAuthority } from '../src/plugin/blueprint-authority.js'
import type {
  BlueprintRegistryPort,
  BlueprintRegistryRecordView,
} from '../src/plugin/blueprint-authority.js'
import { createLiveBlueprintCatalog } from '../src/plugin/blueprint-live-catalog.js'
import { isTeamPluginError } from '../src/plugin/types.js'

/** True while the PR1-PR6 bridge still runs v1 documents. */
const BRIDGE_RUNS_V1 = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(1)

// --- scratch world -------------------------------------------------------------

const thisFile = fileURLToPath(import.meta.url)
const sep = thisFile.includes('\\') ? '\\' : '/'
const scratchRoot = thisFile.slice(0, thisFile.lastIndexOf(sep)) + sep + '.tmp-a4p7-cutover'

// Wipe FIRST: a stale file from an aborted run would join the scan and make a
// listing assertion observe a world this file did not build.
rmSync(scratchRoot, { recursive: true, force: true })

function makeDir(name: string): string {
  const p = scratchRoot + sep + name
  mkdirSync(p, { recursive: true })
  return p
}
function writeSource(dir: string, name: string, source: string): void {
  writeFileSync(dir + sep + name, source)
}

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true })
})

/** One in-memory registry row store (the structural port; bp1's semantics). */
class MemRegistry implements BlueprintRegistryPort {
  readonly rows = new Map<string, BlueprintRegistryRecordView>()

  constructor(rows: readonly BlueprintRegistryRecordView[] = []) {
    for (const row of rows) this.rows.set(`${row.blueprintId}@${row.revision}`, row)
  }

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
    throw new Error(`a4p7 cutover fixtures never freeze: ${input.blueprintId}@${input.revision}`)
  }
}

/**
 * A frozen row whose `contentHash` is DELIBERATELY wrong. The rows in this file
 * are refused (or accepted) on their VERSION; if resolve ever reads the row text
 * and checks its hash first, the integrity mismatch fires instead and the
 * operator is told their registry is corrupt when the truth is that a document
 * needs migrating. The wrong hash is the tripwire for that reordering.
 */
function rowOf(
  blueprintId: string,
  revision: string,
  schemaVersion: number,
  source: string,
): BlueprintRegistryRecordView {
  return {
    schemaVersion,
    blueprintId,
    revision,
    contentHash: 'sha256:a4p7-fixture-hash-is-not-the-source-hash',
    source,
    frozenAt: '2026-10-07T00:00:00.000Z',
  }
}

function captureError(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (error) {
    return error
  }
}

/** The `code` of a thrown `TeamPluginError`, `undefined` for anything else. */
function pluginCodeOf(error: unknown): string | undefined {
  return isTeamPluginError(error) ? error.code : undefined
}

/**
 * A source index that answers like the INSPECTOR of a build whose
 * `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` is `[3]`: a well-formed identity on
 * any other DEFINED version comes back `migration-required` instead of `ok`.
 *
 * Deliberately narrow, so it cannot become a second source of truth:
 *  - `dir`, `listSourceFiles` and `readSource` DELEGATE — the scan, the file
 *    names and the source text are the real ones;
 *  - it rewrites `ok` → `migration-required` ONLY for a version that is `DEFINED`
 *    but outside the set it simulates, and passes `rejected` through untouched —
 *    so it can never turn an unreadable document into a migratable one (that
 *    inversion is the exact fold A1-21 forbids);
 *  - `readCalls` counts every `readSource`, which is how the lane asserts that a
 *    refusal never parses a retired document on its way to saying no.
 */
function cutoverIndex(
  inner: BlueprintSourceIndex,
  simulatedSupported: readonly number[] = [3],
): BlueprintSourceIndex & { readonly readCalls: string[] } {
  const readCalls: string[] = []
  return {
    readCalls,
    get dir() {
      return inner.dir
    },
    listSourceFiles: () => inner.listSourceFiles(),
    readSource(name: string): string {
      readCalls.push(name)
      return inner.readSource(name)
    },
    inspectSource(name: string): BlueprintInspectionResult {
      const result = inner.inspectSource(name)
      if (result.status !== 'ok') return result
      const { schemaVersion } = result.identity
      if (
        simulatedSupported.includes(schemaVersion) ||
        !DEFINED_BLUEPRINT_DOCUMENT_VERSIONS.includes(schemaVersion)
      ) {
        return result
      }
      return { status: 'migration-required', identity: result.identity }
    },
  }
}

// =============================================================================
// Group A — the inspector reads the identity BEFORE it judges the version
// =============================================================================

describe('a4p7 7.1 A: inspectBlueprintSource reads the identity before it judges the version', () => {
  // THE RED-PRODUCING PAIR, reachable at THIS commit. Before Task 7.1 a document
  // on an unsupported version answered `schemaVersion-unsupported` without ever
  // parsing `blueprintId` / `revision`. With the gate moved after the identity
  // checks, a document carrying BOTH faults is refused for the one the operator
  // can act on first: it has no identity. This is the observable residue of the
  // reordering, so the reordering cannot quietly revert.
  it('an unidentifiable document on an unknown version is refused for its identity, not its version', () => {
    const result = inspectBlueprintSource(
      [
        '---',
        'schemaVersion: 99',
        'blueprintId: "not an id!!"',
        'revision: "1"',
        'leader:',
        '  templateId: leader',
        '  persona: "Lead."',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
    )
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.diagnostics.map((d) => d.reason)).toEqual(['blueprintId-invalid'])
  })

  it('a document with no blueprintId is refused for the missing identity whatever its version', () => {
    const result = inspectBlueprintSource(
      ['---', 'schemaVersion: 99', 'revision: "1"', '---', ''].join('\n'),
    )
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.diagnostics[0]?.reason).toBe('blueprintId-invalid')
  })

  it('a version nobody defined, with a good identity, is parse-rejected — never migration-required', () => {
    // The other half of A1-21: `99` was never a Blueprint document, so no
    // migration applies and it must not be advertised as migratable.
    const result = inspectBlueprintSource(
      revisionSource('a4p7.unknown', '1').replace('schemaVersion: 1', 'schemaVersion: 99'),
    )
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.diagnostics.map((d) => d.reason)).toEqual(['schemaVersion-unsupported'])
  })

  it('a non-integer version stays parse-rejected (no identity is owed to it)', () => {
    const result = inspectBlueprintSource(
      revisionSource('a4p7.fraction', '1').replace('schemaVersion: 1', 'schemaVersion: 1.5'),
    )
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.diagnostics[0]?.reason).toBe('schemaVersion-unsupported')
  })

  it('bad YAML is parse-rejected: identity is not owed to an unreadable file', () => {
    expect(inspectBlueprintSource(NEG_INVALID_YAML.source).status).toBe('rejected')
  })

  it('an unreadable file is refused where it fails to decode, never on the version line', () => {
    // Same law as the first test, one stage earlier: the frontmatter never
    // decodes, so nothing downstream — including the version question — is asked.
    const result = inspectBlueprintSource('---\n\tblueprintId: [unclosed\n---\n')
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.diagnostics[0]?.reason).toBe('yaml-invalid')
  })

  it('a well-formed identity on a version this build RUNS inspects ok, with its version carried', () => {
    // Asserted against the set rather than a remembered number, so the cutover
    // commit moves this assertion with the set instead of breaking it: the
    // v1/v2-side claims live in group C, where they are driven explicitly.
    const supported = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS[0]
    expect(supported).toBeDefined()
    const result = inspectBlueprintSource(
      revisionSource('a4p7.current', '1').replace(
        'schemaVersion: 1',
        `schemaVersion: ${String(supported)}`,
      ),
    )
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.identity).toEqual({
      schemaVersion: supported,
      blueprintId: 'a4p7.current',
      revision: '1',
    })
  })
})

// =============================================================================
// Group B — the version sets and the typed names are laws, not prose
// =============================================================================

describe('a4p7 7.1 B: the retired set is derived, and the two refusal names stay distinct', () => {
  it('the retired set is exactly DEFINED minus SUPPORTED (no threshold, no hand-declared list)', () => {
    const expected = DEFINED_BLUEPRINT_DOCUMENT_VERSIONS.filter(
      (version) => !SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version),
    )
    expect([...RETIRED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual(expected)
    // A version cannot be both runnable and owed a migration.
    for (const version of RETIRED_BLUEPRINT_DOCUMENT_VERSIONS) {
      expect(SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version)).toBe(false)
    }
  })

  it('every version the product once defined is in the history set, so the flip makes a backlog and not a mystery', () => {
    // If a retired version were missing from DEFINED, the cutover would answer
    // `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` ("nothing to migrate") for a
    // document that IS the operator's to migrate. That is A1-21's fold arriving
    // by omission instead of by overload, so membership is pinned here.
    for (const version of [1, 2, 3]) {
      expect(DEFINED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version)).toBe(true)
    }
  })

  it('the retired set is empty exactly while the bridge still runs v1 and v2', () => {
    // A build that still RUNS v1/v2 must not advertise those documents as needing
    // migration; a build that no longer runs them must not hide them either. One
    // law, both directions — and it is the reason the cutover commit has to touch
    // this file rather than be remembered separately.
    const bridgeStands =
      SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(1) &&
      SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(2)
    expect(RETIRED_BLUEPRINT_DOCUMENT_VERSIONS.length === 0).toBe(bridgeStands)
  })

  it('the two refusal names are a closed pair and neither overloads an existing code', () => {
    expect([...BLUEPRINT_VERSION_REFUSAL_CODE_VALUES]).toEqual([
      'BLUEPRINT_MIGRATION_REQUIRED',
      'BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED',
    ])
    expect(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED).not.toBe(
      'SCHEMA_VERSION_UNSUPPORTED',
    )
    expect(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED).not.toBe(
      'SCHEMA_VERSION_MISMATCH',
    )
    expect(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED).not.toBe(
      'SCHEMA_VERSION_UNSUPPORTED',
    )
    expect(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED).not.toBe(
      'SCHEMA_VERSION_MISMATCH',
    )
    expect(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED).not.toBe(
      BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED,
    )
  })
})

// =============================================================================
// Group C — the real discovery surface: listed, distinguishable, refused typed
// =============================================================================

const W1 = makeDir('w1')
const W1_ANCHOR = revisionSource('a4p7.anchor', '1', 'Anchor lead.')
const W1_SAVED = revisionSource('a4p7.unmigrated', '1', 'Unmigrated lead.')
writeSource(W1, 'unmigrated.yaml', W1_SAVED)
writeSource(W1, 'broken.yaml', NEG_INVALID_YAML.source)

const w1Index = createBlueprintSourceIndex({ blueprintDir: W1 })
const w1Cutover = cutoverIndex(w1Index)
const w1Authority = createBlueprintAuthority({
  bootstrapSource: W1_ANCHOR,
  sourceIndex: w1Cutover,
  registry: new MemRegistry(),
})

// The same directory under a build that still runs v1: the control proving the
// listing difference below is caused by the VERSION STATE and nothing else.
const w1BridgeAuthority = createBlueprintAuthority({
  bootstrapSource: W1_ANCHOR,
  sourceIndex: w1Index,
  registry: new MemRegistry(),
})

const w1Listed = w1Authority.listIdentities()
const w1Unmigrated = w1Listed.find((identity) => identity.blueprintId === 'a4p7.unmigrated')
const w1BridgeListed = w1BridgeAuthority.listIdentities()
const w1BridgeUnmigrated = w1BridgeListed.find(
  (identity) => identity.blueprintId === 'a4p7.unmigrated',
)

describe('a4p7 7.1 C: an unmigrated Blueprint stays on the discovery surface and is refused typed', () => {
  it('it is LISTED, with its identity and its version, under a build that runs v3 only', () => {
    // The regression this pins: before Task 7.1 this entry did not exist at all.
    expect(w1Unmigrated).toBeDefined()
    expect(w1Unmigrated).toMatchObject({
      blueprintId: 'a4p7.unmigrated',
      revision: '1',
      origin: 'saved',
      sourceFile: 'unmigrated.yaml',
      schemaVersion: 1,
      migrationRequired: true,
    })
  })

  it('it is distinguishable from a parse-rejected file, which is still NOT listed', () => {
    // `unmigrated.yaml` and `broken.yaml` sit in the same directory and neither
    // can run. Only one of them is the operator's backlog, and the listing is
    // what tells them apart — which is why `rejected` keeps meaning "skip".
    expect(w1Listed.map((identity) => identity.blueprintId)).toContain('a4p7.unmigrated')
    expect(w1Listed.filter((identity) => identity.sourceFile === 'broken.yaml')).toEqual([])
  })

  it('every listed arm carries a version and a migration flag, the anchor included', () => {
    // The catalog migration surface IS this list, so no arm may omit the fields:
    // the anchor is the one document Task 7.2 makes host construction survive, so
    // its version is the fact an operator needs first.
    const origins = w1Listed.map((identity) => identity.origin)
    expect(origins).toContain('bootstrap')
    expect(origins).toContain('saved')
    for (const identity of w1Listed) {
      expect(typeof identity.schemaVersion).toBe('number')
      expect(typeof identity.migrationRequired).toBe('boolean')
    }
    // The anchor is the fixture's own v1 document: its flag is the one the
    // cutover flips, so only the version is asserted here (the flag for a
    // retired anchor is group D's claim, where the set itself is narrowed).
    expect(w1Listed.find((identity) => identity.origin === 'bootstrap')?.schemaVersion).toBe(1)
  })

  it('resolve refuses it with BLUEPRINT_MIGRATION_REQUIRED — not not-found, not the parser', () => {
    const error = captureError(() => w1Authority.resolve('a4p7.unmigrated', '1'))
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED)
    if (!isTeamPluginError(error)) return
    expect(error.detail).toMatchObject({
      blueprintId: 'a4p7.unmigrated',
      revision: '1',
      schemaVersion: 1,
      origin: 'saved',
      migrationRequired: true,
      sourceFile: 'unmigrated.yaml',
    })
    // The message is operator-facing: it names the document, its version, and the
    // action. A refusal that never says "migrate" turns a runbook step into a
    // support ticket.
    expect(error.message).toContain('schema v1')
    expect(error.message).toContain('migrate')
  })

  it('the refusal asks for no source read: a retired document is never parsed on the way to no', () => {
    w1Cutover.readCalls.length = 0
    const error = captureError(() => w1Authority.resolve('a4p7.unmigrated', '1'))
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED)
    expect(w1Cutover.readCalls).toEqual([])
  })

  it('a revision-less resolve reaches the same refusal (the latest-revision walk keeps it visible)', () => {
    // If the latest-revision walk dropped migration-required entries, the
    // revision-less resolve would answer "blueprint not found" — a lie that sends
    // the operator to a file that does not exist.
    const error = captureError(() => w1Authority.resolve('a4p7.unmigrated'))
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED)
  })

  it('the listed flag is what the refusal acts on, so the catalog can never contradict resolve', () => {
    // The one place where a build could be its own enemy: `listIdentities()`
    // publishes `migrationRequired` from the inspector's classification, and a
    // resolve that re-derived the answer from the version set could answer
    // "unsupported" — or "not found" — for the very entry it just listed as
    // migratable. Asserted by reading both surfaces for the same identity.
    const listed = w1Authority.listIdentities().find((identity) => identity.blueprintId === 'a4p7.unmigrated')
    const error = captureError(() => w1Authority.resolve('a4p7.unmigrated', '1'))
    expect(listed?.migrationRequired).toBe(true)
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED)
  })

  it('the live catalog facade lists it and refuses it with the same typed code', () => {
    const catalog = createLiveBlueprintCatalog(w1Authority)
    expect([...catalog.blueprintIds]).toContain('a4p7.unmigrated')
    expect(catalog.hasBlueprint('a4p7.unmigrated')).toBe(true)
    expect([...catalog.listRevisions('a4p7.unmigrated')]).toEqual(['1'])
    expect(pluginCodeOf(captureError(() => catalog.resolve('a4p7.unmigrated', '1')))).toBe(
      BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED,
    )
    expect(pluginCodeOf(captureError(() => catalog.resolveLatest('a4p7.unmigrated')))).toBe(
      BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED,
    )
  })

  it('under the bridge the same file resolves normally, so the refusal is version-state and not a blanket break', () => {
    const blueprint = w1BridgeAuthority.resolve('a4p7.unmigrated', '1')
    expect(blueprint.blueprintId).toBe('a4p7.unmigrated')
    expect(blueprint.schemaVersion).toBe(1)
    expect(w1BridgeUnmigrated).toMatchObject({ schemaVersion: 1, migrationRequired: false })
    // …and the bridge's listing carries the SAME identity, differing only in the
    // two new facts. That is the whole of the migration surface: an entry does not
    // appear and vanish across the cutover, its STATUS changes.
    expect({ ...w1BridgeUnmigrated, migrationRequired: true }).toEqual({ ...w1Unmigrated })
  })
})

// =============================================================================
// Group C2 — a frozen row is classified by the version the ROW carries (no
// source read), so the unknown-version arm of A1-21 is reachable today
// =============================================================================

const W2 = makeDir('w2')
const W2_ANCHOR = revisionSource('a4p7.anchor2', '1', 'Anchor two.')
const W2_ROW_SOURCE = revisionSource('a4p7.frozen-unknown', '7', 'Frozen unknown-version lead.')
const w2Authority = createBlueprintAuthority({
  bootstrapSource: W2_ANCHOR,
  sourceIndex: cutoverIndex(createBlueprintSourceIndex({ blueprintDir: W2 })),
  registry: new MemRegistry([rowOf('a4p7.frozen-unknown', '7', 99, W2_ROW_SOURCE)]),
})
const w2Listed = w2Authority.listIdentities()

describe('a4p7 7.1 C2: a frozen row is classified by the version it carries, not by its text', () => {
  it('a row on a version nobody defined is NOT a migration: it is the unsupported-version refusal', () => {
    // The two A1-21 names, produced by adjacent code over the same list, kept
    // apart by the flag that reaches the wire.
    expect(w2Listed.find((identity) => identity.blueprintId === 'a4p7.frozen-unknown')).toMatchObject(
      { origin: 'frozen', schemaVersion: 99, migrationRequired: false },
    )
    const error = captureError(() => w2Authority.resolve('a4p7.frozen-unknown', '7'))
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
    if (!isTeamPluginError(error)) return
    expect(error.detail).toMatchObject({
      schemaVersion: 99,
      migrationRequired: false,
      origin: 'frozen',
    })
    expect(error.message).toContain('never defined')
  })

  it('that refusal is not the registry-integrity refusal the row would otherwise produce', () => {
    // The fixture row's contentHash is wrong on purpose (see `rowOf`). Reading the
    // stored text before classifying the version would report a corrupt registry
    // for a document that merely needs a different build.
    const error = captureError(() => w2Authority.resolve('a4p7.frozen-unknown', '7'))
    expect(pluginCodeOf(error)).not.toBe('TEAM_BLUEPRINT_SNAPSHOT_MISMATCH')
    expect(pluginCodeOf(error)).not.toBe('TEAM_BLUEPRINT_FILE_UNREADABLE')
  })

  it('the strong parser accepts a v1 document exactly while the bridge runs it', () => {
    // Why the version gate cannot be delegated to `parseBlueprint`: the parser's
    // answer tracks the same set, so it is either silent (bridge) or refuses with
    // the DOMAIN's words — `SCHEMA_VERSION_UNSUPPORTED`, "this document cannot be
    // read" — never with the actionable migration name the operator needs. One
    // law, both states, no branch.
    const refused = captureError(() => parseBlueprint(revisionSource('a4p7.parse', '1'))) !== undefined
    expect(refused).toBe(!BRIDGE_RUNS_V1)
  })
})
