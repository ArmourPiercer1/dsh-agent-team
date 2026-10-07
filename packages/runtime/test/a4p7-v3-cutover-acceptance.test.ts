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
 * GROUP D (Task 7.2): DEGRADED HOST BOOT vs TEAM START REFUSAL — the two planes
 * A1-20(c) separates, pinned at every real start entrance. GROUP E adds the
 * v3-only cutover acceptance in its own commit: the assertions whose reachability
 * depends on `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]` land in the commit that
 * flips it, so nothing in this file is a skipped or vacuous stand-in. Where an arm
 * is dark at a given commit (a migration-required frozen row; the freeze gate),
 * the file says so where the reader would otherwise assume coverage.
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
import {
  OPERATION_APPROVAL_REFUSAL_REASONS,
  operationApprovalCandidatePoints,
  routeOperationApproval,
} from '../operation-permission/approval-routing.js'
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
import type { BlueprintInspectionResult, TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { matcherCovers } from '../../domain/authority-envelope/src/index.js'
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

// ═══════════════════════════════════════════════════════════════════════════
// GROUP D — Task 7.2: DEGRADED HOST BOOT, SEPARATED FROM TEAM START REFUSAL.
//
// Three planes, and they must stay three (ADR A1-20(c)):
//
//   1. a host whose anchor this build cannot run BOOTS (degraded, loud, and the
//      anchor stays visible through the authority of group C);
//   2. a Team bound to such a document does not start and does not resume —
//      typed, with zero agent creation and nothing written before the refusal;
//   3. the migration surface still sees the document (group C).
//
// WHAT IS REACHABLE AT THIS COMMIT, stated plainly: the bridge still runs
// `[1, 2, 3]`, so no DEFINED version is retired yet and the migration arm of
// every new refusal is dark. The arm that IS live is the other version refusal —
// a document on a version this build never defined (`schemaVersion: 99`) — and it
// drives the same machinery end to end: classify without throwing → the
// constructor survives → the value refuses on read → every start entrance refuses
// typed before its first durable write. The v1/v2 siblings of these worlds (same
// assertions, `migrationRequired: true`, code `BLUEPRINT_MIGRATION_REQUIRED`, the
// anchor now LISTED) land in the commit that flips the set, where they go red
// first. Nothing here is skipped, stubbed, or renamed to hide which arm it is.
//
// The bright line this group exists to keep: **a version refusal degrades; a
// document that is not a document still fails the constructor.** D1 pins it,
// because "make the constructor non-fatal" said without that line would boot a
// host whose anchor is a YAML syntax error and hand every consumer a value that
// was never parsed.
// ═══════════════════════════════════════════════════════════════════════════

import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamAgentBindings, TeamPluginConfig, TeamProductionRoot } from '../src/plugin/types.js'
import type { GovernanceStartOutcome, GovernanceWarningService } from '../governance-warning/index.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'
import { classifyBlueprintAnchor } from '../src/plugin/blueprint-authority.js'
import { createBoundBlueprintResolver } from '../src/plugin/bound-blueprint.js'
import type { TeamSessionRecordDto } from '../../contracts/src/index.js'
import { TeamContractError } from '../../contracts/src/index.js'
import { TeamPluginError } from '../src/plugin/types.js'

/** The single root every degraded world is configured for (one row per world). */
const D_ROOT_SID = 'session-a4p7-d-root'
const D_NOW = '2026-10-20T00:00:00.000Z'

/** The fixture anchor with only its declared version changed. */
function anchorOnVersion(blueprintId: string, version: string): string {
  return revisionSource(blueprintId, '1', 'Degraded anchor lead.').replace(
    'schemaVersion: 1',
    `schemaVersion: ${version}`,
  )
}

const ANCHOR_RUNNABLE = revisionSource('a4p7.degraded.anchor', '1', 'Runnable anchor lead.')
const ANCHOR_UNKNOWN_VERSION = anchorOnVersion('a4p7.degraded.anchor', '99')
const ANCHOR_NOT_A_DOCUMENT = 'this anchor is not a blueprint document at all\n'

function dConfig(bootPhase: 'create' | 'resume', blueprintSource: string): TeamPluginConfig {
  return {
    bootPhase,
    rootSessionId: D_ROOT_SID,
    blueprintSource,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/a4p7-d',
    seedMembers: [],
    staticModel: { provider: 'a4p7d', model: 'a4p7d-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
}

/** The stub glue's observation surface, declared locally (the untyped-glue law). */
type StubGlue = {
  readonly __t1: {
    bootCount: number
    rootAgentStarts: string[]
    rootContextDeliveries: string[]
  }
}

/** The governance double, counting every consultation (the not-acknowledgeable proof). */
function governanceDouble(
  policy: (sid: string) => 'open' | 'migration' = () => 'open',
): { calls: string[]; service: GovernanceWarningService } {
  const calls: string[] = []
  const outcome = (phase: string, sid: string): GovernanceStartOutcome => {
    calls.push(`${phase}:${sid}`)
    if (policy(sid) === 'migration') return { status: 'migration-required' }
    return { status: 'open' }
  }
  return {
    calls,
    service: {
      checkStart: async (sid: string) => outcome('start', sid),
      checkEnsureRootLive: async (sid: string) => outcome('live', sid),
      observeRuntime: async () => undefined,
      acknowledge: async () => ({ kind: 'not-found' }),
      listWarnings: async () => [],
    },
  }
}

type DWorld = {
  readonly root: TeamProductionRoot
  readonly stub: StubGlue
  /** Whatever `boot()` rejected with (`undefined` = it completed). */
  readonly bootError: unknown
  readonly bootCompleted: boolean
  readonly governanceCalls: string[]
  /** One real S6 dispatch (the v3 surface, the a4p6 registration dance). */
  readonly call: (endpoint: string, params: unknown) => Promise<Record<string, unknown>>
  /** The same dispatch in the v1 envelope (the closed `handoff.*` pair). */
  readonly callV1: (endpoint: string, params: unknown) => Promise<Record<string, unknown>>
  /** Every APPLIED durable write DURING `boot()` on this root's facility. */
  readonly writes: readonly SeamWriteEntry[]
  /** The whole log (the positive control for a zero measured across `boot()`). */
  readonly writesTotal: readonly SeamWriteEntry[]
}

/**
 * The file seam's write-observation surface (declared locally: the seam is a
 * testkit `.mjs` double whose counters are not part of the production
 * `StorageDomainSeam` port). This is the zero-durable-write proof — the same
 * counter the fault-injection lanes arm their crashes off.
 */
type SeamWriteEntry = {
  readonly domain: string
  readonly table: string
  readonly key: string
  readonly op: string
}
type SeamWrites = {
  readonly writeCount: number
  readonly writeLog: readonly SeamWriteEntry[]
}
const seamWrites = (root: TeamProductionRoot): SeamWrites =>
  root.storageSeam as unknown as SeamWrites

/**
 * One degraded world: real production root, real durable storage, stub glue
 * (the a4p6 start-gate harness, whose observation surface is exactly the
 * zero-start proof the plan names). `preSeed` boots a RUNNABLE anchor first and
 * reopens the same scratch, which is how a RESUME world gets its durable row.
 */
async function dWorld(options: {
  readonly name: string
  readonly anchor: string
  readonly bootPhase: 'create' | 'resume'
  /** Boot a RUNNABLE anchor first, then reopen the same scratch: the RESUME worlds. */
  readonly preSeed?: boolean
  readonly resolveBoundBlueprint?: (teamRootSid: string) => TeamBlueprint
  readonly governancePolicy?: (sid: string) => 'open' | 'migration'
  /** The handoff source-read channel (the ONLY source the operation reads). */
  readonly getSessionQuery?: () => unknown
}): Promise<DWorld> {
  const dir = makeDir(options.name)
  // A pre-seeded world needs an OPEN governance leg for its own creation boot —
  // the scripted posture arms only for the world under test (and arming it is
  // itself evidence that the create boot consults the leg).
  let policyArmed = options.preSeed !== true
  const governance = governanceDouble((sid) =>
    policyArmed && (options.governancePolicy ?? (() => 'open'))(sid) === 'migration'
      ? 'migration'
      : 'open',
  )
  const construct = async (
    phase: 'create' | 'resume',
    source: string,
    reopen: boolean,
    resolver: ((teamRootSid: string) => TeamBlueprint) | undefined,
  ) => {
    const seam = new FileStorageSeam(dir)
    const domain = reopen ? await openTeamDomain(seam) : await createTeamDomain(seam)
    const config = dConfig(phase, source)
    const teamToolsRef: { current: undefined } = { current: undefined }
    const stub = createStubBindings({ config, teamToolsRef, domain }) as unknown as StubGlue
    const root = createTeamProductionRoot({
      config,
      domain,
      storageSeam: seam,
      live: stub as unknown as TeamAgentBindings,
      now: () => D_NOW,
      teamToolsRef,
      controlServiceRef: { current: undefined },
      legacyInspect: noLegacyInspect,
      governanceWarning: governance.service,
      ...(options.getSessionQuery === undefined ? {} : { getSessionQuery: options.getSessionQuery }),
      ...(resolver === undefined ? {} : { resolveBoundBlueprint: resolver }),
    })
    return { root, stub }
  }

  if (options.preSeed === true) {
    const seed = await construct('create', ANCHOR_RUNNABLE, false, undefined)
    await seed.root.boot()
    await seed.root.close()
    policyArmed = true
  }
  const world = await construct(
    options.bootPhase,
    options.anchor,
    options.preSeed === true,
    options.resolveBoundBlueprint,
  )
  const dispatcher: {
    current: ((endpoint: string, payload: unknown) => Promise<Record<string, unknown>>) | null
  } = { current: null }
  world.root.seams.remoteHandlerRegistration.current()({
    rpc: {
      handle: (_channel: string, handler: unknown) => {
        dispatcher.current = handler as (
          endpoint: string,
          payload: unknown,
        ) => Promise<Record<string, unknown>>
        return () => {}
      },
    },
  })
  const installed = dispatcher.current
  if (installed === null) {
    throw new Error('A4-PR7 group D guard: the remote registration never installed a dispatcher')
  }
  // The write log is measured ACROSS `boot()` (opening a durable domain lays
  // its own table files, and a resumed world reopens one — neither is a Team
  // effect). What the plan's law is about is the write the START would have
  // made: the row, the binding, the compatibility/prober state.
  const writesBeforeBoot = seamWrites(world.root).writeCount
  const bootError = await world.root.boot().then(
    () => undefined,
    (error: unknown) => error,
  )
  const allWrites = seamWrites(world.root).writeLog
  return {
    root: world.root,
    stub: world.stub,
    bootError,
    bootCompleted: bootError === undefined,
    governanceCalls: governance.calls,
    call: (endpoint, params) => installed(endpoint, { version: 3, params }),
    callV1: (endpoint, params) => installed(endpoint, { version: 1, params }),
    writes: allWrites.slice(writesBeforeBoot),
    writesTotal: allWrites,
  }
}

const noLegacyInspect = (): never => {
  throw new Error('A4-PR7 group D guard: the legacy inspect seam is unused in these worlds')
}

// --- the degraded worlds ---------------------------------------------------------

/** The scripted refusal the Blueprint authority gives a bound migration-required
 *  identity (group C proves the AUTHORITY gives this answer; here it answers the
 *  entrance's question, so the entrance's wiring is what is under test). */
const MIGRATION_REFUSAL = BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED

const dRefusedSids: string[] = []
/** The create-phase refusal recorder (the mint the gate stopped). */
const dCreateSids: string[] = []
const dCreateRefused = await dWorld({
  name: 'd-create-refused',
  anchor: ANCHOR_UNKNOWN_VERSION,
  bootPhase: 'create',
})
/**
 * A CREATE boot whose ANCHOR runs but whose freshly bound document does not —
 * the world that separates the create-entrance gate from the anchor: the row is
 * minted, the identity is bound, and only the bound-document question stops it.
 */
const dCreateBoundRefused = await dWorld({
  name: 'd-create-bound-refused',
  anchor: ANCHOR_RUNNABLE,
  bootPhase: 'create',
  resolveBoundBlueprint: (teamRootSid: string) => {
    dCreateSids.push(teamRootSid)
    throw new TeamPluginError(
      MIGRATION_REFUSAL,
      'the bound Blueprint is a schema v1 document; migrate it (scripted)',
      { blueprintId: 'a4p7.degraded.anchor', revision: '1', migrationRequired: true },
    )
  },
})
const dResumeRefused = await dWorld({
  name: 'd-resume-refused',
  anchor: ANCHOR_RUNNABLE,
  bootPhase: 'resume',
  preSeed: true,
  resolveBoundBlueprint: (teamRootSid: string) => {
    dRefusedSids.push(teamRootSid)
    throw new TeamPluginError(
      MIGRATION_REFUSAL,
      'the bound Blueprint is a schema v1 document; migrate it (scripted: the authority of group C answers this way)',
      { blueprintId: 'a4p7.degraded.anchor', revision: '1', migrationRequired: true },
    )
  },
})
const dResumeOpen = await dWorld({
  name: 'd-resume-open',
  anchor: ANCHOR_RUNNABLE,
  bootPhase: 'resume',
  preSeed: true,
  resolveBoundBlueprint: () => parseBlueprint(ANCHOR_RUNNABLE),
})
const dResumeRefusedEnsure = await dResumeRefused.call('team.ensureRootLive', {
  teamSessionId: D_ROOT_SID,
})
/** A FRESH root minted over the same refused bound document (the v3 create wire). */
const D_CREATED_SID = 'session-a4p7-d-created'
const dResumeRefusedCreate = await dResumeRefused.call('team.create', {
  rootSessionId: D_CREATED_SID,
  blueprintId: 'a4p7.degraded.anchor',
  blueprintRevision: 1,
})
/** The same entrance with the GOVERNANCE leg answering its closed fourth arm
 *  (`migration-required`) — the posture the wiring takes on when the bridge is
 *  removed in Task 7.3. */
const dGovernanceArm = await dWorld({
  name: 'd-governance-arm',
  anchor: ANCHOR_RUNNABLE,
  bootPhase: 'resume',
  preSeed: true,
  governancePolicy: () => 'migration',
})
const dGovernanceArmEnsure = await dGovernanceArm.call('team.ensureRootLive', {
  teamSessionId: D_ROOT_SID,
})
// The same mint over an OPEN bound document, kept as the positive control for the
// refused `team.create` below: the refused call's shape (endpoint, param names,
// blueprint identity) is only meaningful if the identical shape SUCCEEDS when the
// bound document is one this build runs.
const D_OPEN_CREATED_SID = 'session-a4p7-d-created-open'
const dResumeOpenCreate = await dResumeOpen.call('team.create', {
  rootSessionId: D_OPEN_CREATED_SID,
  blueprintId: 'a4p7.degraded.anchor',
  blueprintRevision: 1,
})
const dResumeOpenEnsure = await dResumeOpen.call('team.ensureRootLive', {
  teamSessionId: D_ROOT_SID,
})

/** A construction attempt on an anchor that is not a document at all. */
const dGarbageError = await (async () => {
  const dir = makeDir('d-create-garbage')
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  const config = dConfig('create', ANCHOR_NOT_A_DOCUMENT)
  const teamToolsRef: { current: undefined } = { current: undefined }
  const stub = createStubBindings({ config, teamToolsRef, domain }) as unknown as StubGlue
  try {
    createTeamProductionRoot({
      config,
      domain,
      storageSeam: seam,
      live: stub as unknown as TeamAgentBindings,
      now: () => D_NOW,
      teamToolsRef,
      controlServiceRef: { current: undefined },
      legacyInspect: noLegacyInspect,
    })
    return undefined
  } catch (error) {
    return error
  }
})()

/** The handoff source session (the shape `handoff.prepare` reads). */
const D_SRC_SID = 'session-a4p7-d-src'
function dSessionQueryDouble(): () => unknown {
  const fake = {
    readSurface: async (id: string): Promise<Record<string, unknown>> => {
      if (id !== D_SRC_SID) throw new Error(`readSurface called with '${id}'`)
      return {
        session: { id: D_SRC_SID, createdAt: 1725000000000 },
        capturedThroughSeq: 9,
        events: [
          {
            seq: 1,
            type: 'user/message',
            time: 1725000001000,
            data: { content: [{ type: 'text', text: 'handoff me the baseline work' }] },
          },
        ],
      }
    },
    readTitleSnapshots: async (ids: readonly string[]): Promise<Record<string, unknown>[]> =>
      ids.map((sid) => ({
        status: 'fulfilled',
        value: { session: { id: sid, createdAt: 1725000000000 }, title: { title: 'A4P7 group-D source' } },
      })),
  }
  return () => fake
}

/** The handoff envelope's OPERATION state (`ok:true` is the ENVELOPE; the
 *  operation carries its own `kind`, and a refused creation is `creation-failed`). */
function dHandoffOpState(response: Record<string, unknown>): Record<string, unknown> {
  const value = response['value'] as { data?: { state?: Record<string, unknown> } } | undefined
  return value?.data?.state ?? {}
}
const HANDOFF_PREFIX = 'session-handoff-'
const D_TOKEN = 'tok-a4p7-d-handoff'
const dHandoffRefused = await dWorld({
  name: 'd-handoff-refused',
  anchor: ANCHOR_RUNNABLE,
  bootPhase: 'resume',
  preSeed: true,
  getSessionQuery: dSessionQueryDouble(),
  resolveBoundBlueprint: (teamRootSid: string) => {
    dRefusedSids.push(teamRootSid)
    throw new TeamPluginError(
      MIGRATION_REFUSAL,
      'the bound Blueprint is a schema v1 document; migrate it (scripted)',
      { blueprintId: 'a4p7.degraded.anchor', revision: '1', migrationRequired: true },
    )
  },
})
await dHandoffRefused.callV1('handoff.prepare', { sourceSessionId: D_SRC_SID })
const dHandoffRefusedCreate = await dHandoffRefused.callV1('handoff.create', {
  sourceSessionId: D_SRC_SID,
  requestToken: D_TOKEN,
  staged: {},
})
const dHandoffOpen = await dWorld({
  name: 'd-handoff-open',
  anchor: ANCHOR_RUNNABLE,
  bootPhase: 'resume',
  preSeed: true,
  getSessionQuery: dSessionQueryDouble(),
  resolveBoundBlueprint: () => parseBlueprint(ANCHOR_RUNNABLE),
})
await dHandoffOpen.callV1('handoff.prepare', { sourceSessionId: D_SRC_SID })
const dHandoffOpenCreate = await dHandoffOpen.callV1('handoff.create', {
  sourceSessionId: D_SRC_SID,
  requestToken: D_TOKEN,
  staged: {},
})

describe('D1 — the bright line: a version refusal degrades, a non-document still fails the constructor', () => {
  it('a version this build never defined is a refusal, not a crash', () => {
    const state = classifyBlueprintAnchor(ANCHOR_UNKNOWN_VERSION)
    expect(state.status).toBe('refused')
    if (state.status !== 'refused') return
    expect(state.code).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
    expect(state.migrationRequired).toBe(false)
  })
  it('a version this build runs classifies as runnable (the ordinary host is unchanged)', () => {
    expect(classifyBlueprintAnchor(ANCHOR_RUNNABLE).status).toBe('runnable')
  })
  it('an anchor that is not a document at all still throws (fail-closed construction)', () => {
    // THE half of A1-20(c) that a lazy reading loses: the ADR degrades a host
    // anchored on a document it refuses to RUN, not one it cannot read at all.
    // The throw keeps its OWN identity — the strong parser's contract error — so
    // the two conditions cannot be confused from the outside either.
    expect(dGarbageError).toBeInstanceOf(TeamContractError)
    expect(pluginCodeOf(dGarbageError)).toBeUndefined()
  })
})

describe('D2 — a host anchored on a version it does not run boots, and its Team does not start', () => {
  it('the root constructed (the constructor survived the anchor)', () => {
    expect(dCreateRefused.bootCompleted).toBe(false)
    expect(pluginCodeOf(dCreateRefused.bootError)).toBe(
      BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED,
    )
  })
  it('ZERO durable writes: no TeamSession row, no binding, no compatibility state', () => {
    // The plan's words: "with zero agent creation and zero compatibility/prober
    // writes before the refusal". Counted at the storage facility itself, not by
    // checking which repositories happen to have rows.
    expect(dCreateRefused.writes.length).toBe(0)
    expect(dCreateRefused.root.domain.repositories.teamSessions.list().length).toBe(0)
  })
  it('ZERO agent effect through the live glue', () => {
    expect(dCreateRefused.stub.__t1.bootCount).toBe(0)
    expect(dCreateRefused.stub.__t1.rootAgentStarts.length).toBe(0)
  })
})

describe('D3 — the refusal is not an acknowledgement path', () => {
  it('the code is the document code, never a governance warning code', () => {
    const code = pluginCodeOf(dCreateRefused.bootError) ?? ''
    expect(code.startsWith('TEAM_START_GOVERNANCE_')).toBe(false)
    expect(code).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
  })
  it('the governance leg is never consulted for the refused create start', () => {
    // The order IS the law: the governance leg reads the Team's v3 authority
    // documents, which do not exist for a document this build will not run.
    // Consulting it would hand the operator a warning to acknowledge for a
    // migration, and an acknowledgement is exactly what must not clear this.
    expect(dCreateRefused.governanceCalls.length).toBe(0)
  })
  it('a re-drive gives the same refusal, not a second state', () => {
    expect(dCreateRefused.writes.length).toBe(0)
  })
})

describe('D4 — the degraded anchor value refuses every read (it is never an empty document)', () => {
  it('reading a field refuses typed', () => {
    const error = captureError(() => dCreateRefused.root.blueprint.blueprintId)
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
  })
  it('enumerating or serialising it refuses too (no empty-object leak)', () => {
    expect(captureError(() => Object.keys(dCreateRefused.root.blueprint)) !== undefined).toBe(true)
    expect(captureError(() => JSON.stringify(dCreateRefused.root.blueprint)) !== undefined).toBe(true)
  })
})

describe('D5 — the start ports refuse before the glue is reached', () => {
  it('team.ensureRootLive on a refused bound document is refused', () => {
    expect(dResumeRefusedEnsure['ok']).toBe(false)
    expect(dResumeRefusedEnsure['error']).not.toBe(undefined)
  })
  it('the stub glue ensure port was NEVER entered (the gate sits in front of it)', () => {
    // The stub's `ensureLiveAgent` throws its own name when called, so the
    // ABSENCE of that name — and the presence of the resolver's consultation —
    // is direct evidence of the ordering at this entrance.
    expect(String(JSON.stringify(dResumeRefusedEnsure['error'] ?? {})).includes('ensureLiveAgent')).toBe(false)
    expect(dRefusedSids.filter((sid) => sid === D_ROOT_SID).length).toBeGreaterThan(1)
    expect(dResumeRefused.stub.__t1.bootCount).toBe(0)
  })
  it('the wire carries it in its OWN closed vocabulary, not the document code', () => {
    // Disclosed, not hidden: the S6 dispatcher maps anything outside its frozen
    // code set to `internal-error` with reason `untyped-error` (no new wire code
    // without a contract change). The NAMED wire arm for this condition is the
    // closed fourth governance arm `TEAM_START_MIGRATION_REQUIRED`, produced by
    // the governance leg when the v1/v2 bridge flips (Task 7.3) — see the next
    // test. What THIS entrance's gate guarantees is the part the wire cannot
    // express: no agent is ever created, whatever the envelope says.
    const error = dResumeRefusedEnsure['error']
    if (error === undefined || error === null) return
    expect(String((error as { code?: unknown }).code)).toBe('internal-error')
    expect(String(JSON.stringify(error))).toContain('untyped-error')
  })
  it('the SAME entrance on the governance fourth arm answers with the typed wire name', () => {
    // PR6 reserved `TEAM_START_MIGRATION_REQUIRED` and said PR7 reaches it. Here
    // it is reached through a REAL entrance: the governance leg answers
    // `migration-required` (the posture the wiring takes when Task 7.3 removes
    // the bridge) and the one shared mapper names the refusal on the wire — with
    // the same zero agent effect the port-level gate holds.
    const error = dGovernanceArmEnsure['error']
    expect(dGovernanceArmEnsure['ok']).toBe(false)
    if (error === undefined || error === null) return
    expect(String((error as { code?: unknown }).code)).toBe('TEAM_REMOTE_TEAM_START_MIGRATION_REQUIRED')
    expect(String((error as { message?: unknown }).message)).toContain('until the Team is migrated')
    expect(String((error as { message?: unknown }).message)).toContain('acknowledgement never clears this')
    expect(dGovernanceArm.stub.__t1.bootCount).toBe(0)
    expect(dGovernanceArm.stub.__t1.rootAgentStarts.length).toBe(0)
  })
  it('handoff.create over a refused bound document creates NOTHING and never reaches the governance leg', () => {
    // The handoff entrance PR6 found ungated. Its envelope is `ok:true` because
    // the ENVELOPE only reports transport/handler success; the OPERATION is
    // `creation-failed`, which is this API's honest shape for a refused creation
    // (durable, re-drivable). The law is measured on the effects, not on the
    // envelope: no Root Agent of the handoff prefix ever started, and the
    // governance leg was NEVER consulted for the minted root — so no warning was
    // minted, and there is nothing for an operator to acknowledge. The open
    // control proves both the start and the consultation are observable here.
    const refused = dHandoffOpState(dHandoffRefusedCreate)
    expect(refused['kind']).toBe('creation-failed')
    const failure = refused['failure'] as { code?: string; message?: string } | undefined
    expect(failure?.code).toBe('HANDOFF_TEAM_CREATION_FAILED')
    expect(String(failure?.message)).toContain('migrate')
    expect(
      dHandoffRefused.stub.__t1.rootAgentStarts.filter((sid) => sid.startsWith(HANDOFF_PREFIX))
        .length,
    ).toBe(0)
    expect(
      dHandoffRefused.governanceCalls.filter((c) => c.includes(HANDOFF_PREFIX)).length,
    ).toBe(0)
    const open = dHandoffOpState(dHandoffOpenCreate)
    expect(open['kind']).toBe('completed')
    expect(
      dHandoffOpen.stub.__t1.rootAgentStarts.filter((sid) => sid.startsWith(HANDOFF_PREFIX)).length,
    ).toBe(1)
    expect(
      dHandoffOpen.governanceCalls.filter((c) => c.includes(HANDOFF_PREFIX)).length,
    ).toBeGreaterThan(0)
  })
  it('the SAME team.create shape succeeds over an open bound document (the control)', () => {
    // Without this, the refused create's `ok:false` could be a harness artefact:
    // same endpoint, same param names, same blueprint identity, different bound
    // document — and here the mint completes and exactly one Root Agent starts.
    expect(dResumeOpenCreate['ok']).toBe(true)
    expect(
      dResumeOpen.stub.__t1.rootAgentStarts.filter((sid) => sid === D_OPEN_CREATED_SID).length,
    ).toBe(1)
  })
  it('team.create over the same bound document is refused, leaving the row NOT LIVE', () => {
    // The create wire sits AFTER the atomic fresh-root commit and BEFORE the
    // agent start (PR6's chokepoint law), so the refusal leaves a durable
    // NOT-LIVE row — never a started Team.
    const error = dResumeRefusedCreate['error']
    expect(dResumeRefusedCreate['ok']).toBe(false)
    expect(error).not.toBe(undefined)
    expect(dResumeRefused.stub.__t1.rootAgentStarts.length).toBe(0)
    expect(dResumeRefused.root.domain.repositories.teamSessions.get(D_CREATED_SID)).not.toBe(undefined)
  })
  it('a CREATE mint over a refused bound document fails closed with ZERO agent effect', () => {
    // DISCLOSED SHAPE, measured here rather than assumed: the mint binds the
    // bound document through the binder overlay (the persona substrate effect),
    // so on this entrance the durable commit fails inside the binder and the
    // operator's name for it is the BINDER's, with the document refusal as the
    // wrapped cause. The refusal is real — nothing is created and the Team never
    // boots — and the cause is readable; what it is NOT is the document code,
    // because the per-session resolver cannot be asked before the row exists
    // (case 1 of bound-blueprint.ts throws for a root without a row).
    expect(dCreateSids).toContain(D_ROOT_SID)
    expect(String(dCreateBoundRefused.bootError)).toContain('migrate')
    expect(dCreateBoundRefused.stub.__t1.rootAgentStarts.length).toBe(0)
    expect(dCreateBoundRefused.stub.__t1.bootCount).toBe(0)
    expect(dCreateBoundRefused.governanceCalls.length).toBe(0)
  })
  it('the refused mint made the chokepoint commit and NO compatibility/prober write', () => {
    // The plan's zero-write law names the compatibility/prober writes, and the
    // chokepoint commit (row + binding + leader, one atomic write set) is PR6's
    // established shape for a refused create. Both hold: the row exists, no
    // compatibility state was laid, and no agent ever lived.
    const tables = dCreateBoundRefused.writes.map((entry) => entry.table)
    expect(
      tables.some((table) => String(table).toLowerCase().includes('compatibility')),
    ).toBe(false)
    expect(dCreateBoundRefused.root.domain.repositories.compatibility.get(D_ROOT_SID)).toBe(
      undefined,
    )
  })
})

describe('D6 — the resume entrance is gated on its ROW, before its first durable write', () => {
  it('the entrance asked the bound-document resolver for THIS root', () => {
    // `boundSnapshot` is derived from the anchor; a resumed Team is bound to its
    // row. Consulting the resolver here is what makes "the migrated Team on a
    // host with an old anchor resumes" and "the unmigrated Team on a new host is
    // refused" the same correct code.
    expect(dRefusedSids.length).toBeGreaterThan(0)
    expect(dRefusedSids[0]).toBe(D_ROOT_SID)
  })
  it('the refusal is typed and boot() never reached the live layer', () => {
    expect(pluginCodeOf(dResumeRefused.bootError)).toBe(MIGRATION_REFUSAL)
    expect(dResumeRefused.stub.__t1.bootCount).toBe(0)
  })
  it('the refused resume wrote NOTHING before refusing', () => {
    expect(dResumeRefused.writes.length).toBe(0)
  })
})

describe('D7 — the gate does not refuse a bound document this build runs', () => {
  it('the resume completed (the new gate broke nothing it guards)', () => {
    expect(dResumeOpen.bootCompleted).toBe(true)
    expect(dResumeOpen.bootError).toBe(undefined)
  })
  it('the resumed root went live through the glue exactly once', () => {
    expect(dResumeOpen.stub.__t1.bootCount).toBe(1)
  })
  it('its ensureRootLive entrance reached the glue (the gate is not blocking what it allows)', () => {
    // The stub glue deliberately THROWS for `ensureLiveAgent`, so that name in
    // the response is the proof of passage: refused worlds never mention the
    // port, this one gets all the way to it. The gate discriminates; it does not
    // simply stop everything.
    expect(dResumeOpenEnsure['ok']).toBe(false)
    expect(String(JSON.stringify(dResumeOpenEnsure['error'] ?? {}))).toContain('ensureLiveAgent')
  })
  it('the write counter is not a blind spot (a real start does record)', () => {
    // The positive control for D6's `writes.length === 0`: the same facility,
    // measured across the whole world, records the chokepoint commit the refused
    // `team.create` made before its own gate stopped it.
    expect(
      dResumeRefused.writesTotal.filter((entry) => entry.key === D_CREATED_SID).length,
    ).toBeGreaterThan(0)
  })
})

describe('D8 — bound-blueprint case 2 refuses with the same name case 3 gets', () => {
  const legacyRows = {
    get: () => ({ blueprint: undefined }) as unknown as TeamSessionRecordDto,
  }
  const refusedResolver = createBoundBlueprintResolver({
    teamSessions: legacyRows,
    resolveSnapshot: () => parseBlueprint(ANCHOR_RUNNABLE),
    anchorBlueprintSource: ANCHOR_UNKNOWN_VERSION,
  })
  const openResolver = createBoundBlueprintResolver({
    teamSessions: legacyRows,
    resolveSnapshot: () => parseBlueprint(ANCHOR_RUNNABLE),
    anchorBlueprintSource: ANCHOR_RUNNABLE,
  })
  it('a no-ref legacy row on a refused anchor refuses typed (not the domain parse error)', () => {
    const error = captureError(() => refusedResolver('session-a4p7-d-legacy'))
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
    if (!isTeamPluginError(error)) return
    expect(error.detail).toMatchObject({ migrationRequired: false, reason: 'bound-anchor-refused' })
  })
  it('and a runnable anchor still resolves by definition (the legacy binding is intact)', () => {
    expect(openResolver('session-a4p7-d-legacy').blueprintId).toBe('a4p7.degraded.anchor')
  })
})

describe('D9 — the Blueprint authority degrades with its anchor, and fails closed on a non-document', () => {
  const dAuthorityDir = makeDir('d-authority')
  const dAuthority = createBlueprintAuthority({
    bootstrapSource: ANCHOR_UNKNOWN_VERSION,
    sourceIndex: createBlueprintSourceIndex({ blueprintDir: dAuthorityDir }),
    registry: new MemRegistry(),
  })
  const dGarbageAuthority = captureError(() =>
    createBlueprintAuthority({
      bootstrapSource: ANCHOR_NOT_A_DOCUMENT,
      sourceIndex: createBlueprintSourceIndex({ blueprintDir: dAuthorityDir }),
      registry: new MemRegistry(),
    }),
  )
  it('the authority constructed on the refused anchor', () => {
    expect(dAuthority.listIdentities().length).toBe(0)
  })
  it('a version nobody defined is NOT listed (there is no migration to advertise)', () => {
    // The contrast with group C, on the same code path: a RETIRED anchor IS
    // listed, with migrationRequired=true, because the operator owes a
    // migration for it. Listing this one would advertise a task that does not
    // exist and blur the two refusals the operator has to tell apart (A1-21).
    const anchorIdentity = parseBlueprint(ANCHOR_RUNNABLE).blueprintId
    expect(dAuthority.listIdentities().some((i) => i.blueprintId === anchorIdentity)).toBe(false)
  })
  it('an anchor that is not a document still fails the authority construction', () => {
    expect(dGarbageAuthority).toBeInstanceOf(Error)
  })
})

// ---------------------------------------------------------------------------
// GROUP E - the shell-class narrowing the ASK cannot see, as an executable
// claim (coordinator RULING 4, 2026-10-07).
//
// The ruling asked for a test in which a shell-class narrowing declared at
// fingerprint shape is seen by BOTH the ASK and the consumption recheck. This
// group is the HALF of that ruling that survives the fix: the three laws, each
// of which holds on its own and which were mutually exclusive at the shell class
// when the ASK asked only one shape. GROUP F is the closure - the ASK and the
// recheck now ask the SET and meet the answers - and it depends on exactly the
// decisive non-coverage pinned below, so this group stays as the reason the set
// is required rather than as a stand-in for a missing test.
//
//   1. the documents: a SHELL-class rule pairs with `fingerprint` EXACTLY, no
//      subtree, no any, no path (`packages/domain/blueprint/src/validate.ts:699`
//      and `schema.ts:211`);
//   2. the plane: a canonical operation's point is the TOOL-level key
//      (`resource.kind = 'tool'`, `resource.key = the exact tool key`,
//      `packages/runtime/operation-permission/canonical-operation.ts:14`; rules
//      are matched by that same key at `permission-resolver.ts:320`);
//   3. the algebra: coverage between the two shapes is a DECISIVE false, not an
//      `undetermined` - the first test below.
//
// So a shell-class document rule could never cover the single point the ASK used
// to ask with, and because the answer is decisive rather than absorbing, the
// narrowing did not merely go unseen: it stopped contributing to the meet, which
// can only make the rung the human is shown LOWER than the author's narrowing
// intended. That direction - never wider, only ever lower - is the reason the
// fix is a candidate SET rather than a migration of shell documents, and GROUP F
// asserts that asking both shapes recovers the narrowing without widening any
// scope. The per-command protection that also exists, the one-shot grant keyed
// by `operationFingerprint`, is a different mechanism from the ceiling.
//
// Why the obvious patch is not one: flipping the ASK point to `fingerprint`
// makes it ask a per-command question, and the same flip stops every tool-level
// shell rule from matching (`permission-resolver.ts:320` compares the tool key),
// so it re-decides which rung signs EVERY shell approval in both directions at
// once - a routing-law change with its own evidence to review, not a persistence
// fix. The durable shape already carries a matcher `kind`, so whichever way the
// decision goes, storage does not have to move.
// ---------------------------------------------------------------------------
describe('GROUP E - why a shell narrowing was invisible to the ASK: three laws, one gap (RULING 4; closed by GROUP F)', () => {
  const fingerprintRule = { kind: 'fingerprint', resource: 'sha256:npm-test-canonical-command' } as const
  const exactTarget = { kind: 'exact', resource: 'bash:tool' } as const

  it('a fingerprint rule against an exact target is a DECISIVE non-coverage, never undetermined', () => {
    const verdict = matcherCovers(fingerprintRule, exactTarget)
    expect(verdict.covers).toBe(false)
    // The direction of the danger lives in this assertion: an absorbing
    // `undetermined` would have failed closed. This answers "no", so the rule
    // contributes nothing to the ceiling and the required rung can only fall.
    expect(verdict.undeterminable).toBe(false)
  })

  it('the reverse shape pairing is decisive too (the gap is symmetric)', () => {
    const verdict = matcherCovers(exactTarget, fingerprintRule)
    expect(verdict).toEqual({ covers: false, undeterminable: false })
  })

  it('each shape does cover its own target (the controls that keep the two above honest)', () => {
    // Without these, the two decisive falses above would be indistinguishable
    // from a matcher that never covers anything at all.
    expect(matcherCovers(fingerprintRule, { kind: 'fingerprint', resource: fingerprintRule.resource })).toEqual({
      covers: true,
      undeterminable: false,
    })
    expect(matcherCovers(exactTarget, { kind: 'exact', resource: exactTarget.resource })).toEqual({
      covers: true,
      undeterminable: false,
    })
    expect(matcherCovers(exactTarget, { kind: 'exact', resource: 'bash:something-else' })).toEqual({
      covers: false,
      undeterminable: false,
    })
  })
})

// ---------------------------------------------------------------------------
// GROUP F - the closure: the ceiling evaluates a CANDIDATE SET of points and
// meets them (coordinator RULING 4, option (ii), 2026-10-08).
//
// The set is the exact tool key AND the command fingerprint. A meet over
// candidate points is never wider than either individual evaluation, so the fix
// is conservative BY CONSTRUCTION rather than by an argument about this fixture:
// adding a candidate can lower the rung the human is asked to sign or leave it
// where it was, and can never raise it. The shapes are derived by ONE function
// that both the ASK and the consumption recheck call, because the recheck's
// question - "does the rung that signed still cover what the human was shown?" -
// is only answerable if the two sites asked the same question.
//
// An empty candidate set is not representable at the call sites: the primary
// point is a required argument, so there is no path from "we could not name a
// shape" to the identity element (full reach), which is what an empty meet over
// the document lattice means and why it would be the wrong answer here.
// ---------------------------------------------------------------------------
describe('GROUP F - the candidate set the ceiling meets (RULING 4 closure)', () => {
  const shellFingerprint = 'sha256:npm-test-canonical-command'
  const shellPoint = { operationClass: 'bash', matcher: { kind: 'exact', resource: 'bash:tool' } } as const
  const filePoint = { operationClass: 'fs.write', matcher: { kind: 'exact', resource: 'fileA' } } as const

  it('ABSORPTION LAW, at the shape level: a shell scope that cannot name its command is refused, never answered from the tool key', () => {
    const derived = operationApprovalCandidatePoints({ point: shellPoint })
    // Refused, and STILL carrying its primary point: the refusal is the answer,
    // not an invitation for a caller to proceed with the narrower question.
    expect(derived.refused).toBe(OPERATION_APPROVAL_REFUSAL_REASONS.SHELL_POINT_MISSING)
    // And the refusal is live on the routing, not just on the helper: with the
    // facts present the ask reaches this decision and stops there.
    const routing = routeOperationApproval({
      operationClass: 'bash',
      resourceKey: 'bash:tool',
      initiatorAuthority: 'member',
      facts: { beneficiaryAuthority: 'member', documents: {} } as never,
    })
    // Narrowed, not cast: `reason` exists on the refusal arm only, and a cast
    // here would let the assertion pass against an arm that has no reason at all.
    if (routing.kind !== 'authority-undetermined') {
      throw new Error(`expected a refusal, got ${routing.kind}`)
    }
    expect(routing.reason).toBe(OPERATION_APPROVAL_REFUSAL_REASONS.SHELL_POINT_MISSING)
  })

  it('the shell set is the tool key AND the fingerprint; the file set is the point alone', () => {
    expect(
      operationApprovalCandidatePoints({ point: shellPoint, commandFingerprint: shellFingerprint }).points,
    ).toEqual([
      { kind: 'exact', resource: 'bash:tool' },
      { kind: 'fingerprint', resource: shellFingerprint },
    ])
    // The positive control that keeps the file class honest: one candidate, so
    // nothing about existing file-class routing moves.
    expect(operationApprovalCandidatePoints({ point: filePoint }).points).toEqual([
      { kind: 'exact', resource: 'fileA' },
    ])
    expect(operationApprovalCandidatePoints({ point: filePoint }).refused).toBeUndefined()
  })

  it('a point that already names the command does not gain a second shape (more candidates is not automatically more conservative)', () => {
    const derived = operationApprovalCandidatePoints({
      point: { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: shellFingerprint } },
      commandFingerprint: shellFingerprint,
    })
    expect(derived.points).toEqual([{ kind: 'fingerprint', resource: shellFingerprint }])
  })

  it('the ASK and the consumption recheck derive the SAME set from the same row (no drift by construction)', () => {
    // The persisted `authorityScope` is what the ASK's primary point became, so
    // identical inputs MUST give an identical set. Asserted rather than assumed:
    // a recheck that asked a different question would report an authority RISE as
    // still-covered, which is the false pass this ruling exists to prevent.
    const atAsk = operationApprovalCandidatePoints({ point: shellPoint, commandFingerprint: shellFingerprint })
    const persistedScope = {
      operationClass: shellPoint.operationClass,
      matcher: { kind: shellPoint.matcher.kind, resource: shellPoint.matcher.resource },
    }
    const atConsumption = operationApprovalCandidatePoints({
      point: persistedScope,
      commandFingerprint: shellFingerprint,
    })
    expect(atConsumption.points).toEqual(atAsk.points)
    expect(atConsumption.refused).toBe(atAsk.refused)
  })

  it('the consumption gap is asserted, not assumed: a caller that cannot thread a fingerprint keeps the persisted point alone', () => {
    // THREADING PENDING, this is the one permissive-direction gap RULING 4 leaves.
    // `control/service.ts` does not yet read the row's `operationFingerprint`, so
    // the recheck arrives with no fingerprint and asks the persisted point alone.
    // Refusing there instead would be conservative AND would break every
    // shell-class one-shot in production, so the gap is pinned as a known shape
    // with a named owner rather than left to be discovered as a `still-covered`.
    const unthreaded = operationApprovalCandidatePoints({ point: shellPoint })
    expect(unthreaded.refused).toBe(OPERATION_APPROVAL_REFUSAL_REASONS.SHELL_POINT_MISSING)
    expect(unthreaded.points).toEqual([{ kind: 'exact', resource: 'bash:tool' }])
    // A threaded-but-empty fingerprint is the OTHER case: the caller reached the
    // row and the row had nothing. That one does fail closed (see the recheck's
    // branch), which is why the two are distinguished by whether the field was
    // supplied at all rather than by whether it was empty.
    expect(
      operationApprovalCandidatePoints({ point: shellPoint, commandFingerprint: '' }).refused,
    ).toBe(OPERATION_APPROVAL_REFUSAL_REASONS.SHELL_POINT_MISSING)
  })

  it('a shell scope that DOES carry the fingerprint is not refused at the candidate gate (control)', () => {
    const facts = { beneficiaryAuthority: 'member', documents: {} } as never
    const withFingerprint = routeOperationApproval({
      operationClass: 'bash',
      resourceKey: 'bash:tool',
      initiatorAuthority: 'member',
      commandFingerprint: shellFingerprint,
      facts,
    })
    // It got PAST the candidate gate and into the ceiling, where this fixture's
    // empty document slot then fails: reaching that failure is the point, since
    // the shell-point refusal is the only answer that names a missing command.
    if (withFingerprint.kind !== 'authority-undetermined') {
      throw new Error(`expected the ceiling to answer, got ${withFingerprint.kind}`)
    }
    expect(withFingerprint.reason).not.toBe(OPERATION_APPROVAL_REFUSAL_REASONS.SHELL_POINT_MISSING)
    expect(operationApprovalCandidatePoints({ point: shellPoint, commandFingerprint: shellFingerprint }).refused)
      .toBeUndefined()
  })
})
