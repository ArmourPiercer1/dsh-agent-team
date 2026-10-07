/**
 * a4f1-row-version-not-document-version.test.ts — finding **F1**: a storage row's
 * L3 stamp is not a Blueprint document version, and a row that cannot know the
 * document version says UNKNOWN rather than a number.
 *
 * THE DEFECT, MEASURED TWICE AGAINST A BOOTED HOST
 * (`dev/agent-workflow/evidence/a4-pr76-acceptance-world/LEGS.md` F1, raw wire in
 * that directory's `receipts/`): `catalog.list` answered
 * `{blueprintId:"a4.accept.team", revisionStates:[{revision:1, schemaVersion:2,
 * migrationState:"current"}]}` for a Blueprint whose own `catalog.get` document
 * said `schemaVersion: 3`. Same host, two answers to one question, because the
 * frozen-row arm of the identity scan answered the version question with
 * `row.schemaVersion` — which is the **TeamDomain L3 row stamp**
 * (`TEAM_DOMAIN_SCHEMA_VERSION`, `packages/storage/schema/blueprint-registry.ts:106`,
 * validated at `:133` as "the TeamDomain schema version that shaped the row") and
 * is `2` for every row this build writes, whatever document is inside it.
 *
 * WHY IT IS A PRODUCT DEFECT AND NOT A COSMETIC ONE. Under the bridge
 * (`SUPPORTED = [1,2,3]`) the wrong number still classified as `current`, so the
 * acceptance world saw a benign discrepancy. Task 7.3 flips `SUPPORTED` to `[3]`,
 * and the same line then reports the operator's own frozen anchor as
 * `migration-required` and refuses it at the start and freeze boundaries: the host
 * declaring its own anchor unsupported. A wrong number that nobody can act on is
 * invisible until the moment acting on it is fatal.
 *
 * THE LAW THESE LEGS PIN — two versions, two names, ONE source of truth:
 *
 *   1. A Blueprint **document** version is populated from the document and from
 *      nothing else: the inspector for a saved source or a frozen row's stored
 *      text, the strong parse for the bootstrap anchor. Never from a row.
 *   2. A row whose document cannot be read has NO version to report, and reports
 *      none: the field is ABSENT on the identity and on the wire, and its
 *      `migrationState` is `unreadable` — never `current`, because "unknowable"
 *      and "version 2" are different facts and only one of them can be acted on.
 *   3. The storage row keeps its L3 stamp, in storage, under its own name
 *      (Group C). It is not renamed and no row is migrated: it simply stops being
 *      carried into the runtime's row shape, so it cannot be mistaken again.
 *
 * WHY THE FIXTURES ARE BUILT THE WAY THEY ARE. Every row here is made by the REAL
 * storage factory (`createBlueprintRegistryRecord`), so the stamp on the row is
 * the production stamp and not a number this file invented; where a leg needs the
 * two versions to differ it says so in the fixture and then **asserts the fixture
 * differs** (`expect(declaredBlueprintSchemaVersion(row.source)).not.toBe(row.schemaVersion)`),
 * so a fixture that quietly collapses the two can never make a leg vacuous. A row
 * carrying the stamp `2` beside a document declaring `3` is not a hypothetical: it
 * is the acceptance world's `a4.accept.team` row.
 *
 * WHY A LEG RUNS THROUGH THE PRODUCTION ROOT AND ITS DISPATCHER. The surface that
 * lied is the wire, not the in-memory struct. Group B therefore installs the
 * dispatcher through `root.seams.remoteHandlerRegistration` exactly as the host
 * mount does and reads `catalog.list` as a client does, so the hops from row to
 * payload (`root.ts` catalogMigrationStates → `s6-remote.ts` catalogRevisionState)
 * are load-bearing here rather than asserted twice from the same object.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies, so the
 * worlds are built at module load and the `it` bodies assert synchronously.
 * Scratch lives under this test directory (workspace-write sandbox) and is removed
 * at module load and in `afterAll`.
 *
 * @module @dsh-agent-team/runtime/test/a4f1-row-version-not-document-version
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  BLUEPRINT_VERSION_REFUSAL_CODES,
  declaredBlueprintSchemaVersion,
  parseBlueprint,
  toBlueprintSnapshotRef,
} from '../../domain/blueprint/src/index.js'
import { parseBlueprintSnapshotRef } from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { createBlueprintRegistryRecord } from '../../storage/schema/blueprint-registry.js'
import {
  SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS,
  TEAM_DOMAIN_SCHEMA_VERSION,
} from '../../storage/schema/stores.js'
import type { BlueprintRegistryRecord } from '../../storage/schema/blueprint-registry.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'

import {
  blueprintVersionStateOf,
  createBlueprintAuthority,
} from '../src/plugin/blueprint-authority.js'
import type {
  BlueprintAuthority,
  BlueprintRegistryPort,
  BlueprintRegistryRecordView,
  BlueprintVersionState,
} from '../src/plugin/blueprint-authority.js'
import { createBlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import { createLiveBlueprintCatalog } from '../src/plugin/blueprint-live-catalog.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamAgentBindings, TeamPluginConfig } from '../src/plugin/types.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

// --- scratch world -------------------------------------------------------------

const thisFile = fileURLToPath(import.meta.url)
const sep = thisFile.includes('\\') ? '\\' : '/'
const scratchRoot = thisFile.slice(0, thisFile.lastIndexOf(sep)) + sep + '.tmp-a4f1'

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

// --- the fixtures --------------------------------------------------------------

/**
 * The document versions these fixtures DECLARE. They are claims of THIS file,
 * minted by the file-owned builder below — not the shared factory's base
 * version (a claim of the factory, which the factory's own migration will
 * move; C-domain FINDINGS §5). And none of them is the L3 ROW stamp: rows get
 * `TEAM_DOMAIN_SCHEMA_VERSION` from the real storage factory, and this file's
 * whole subject is that the row stamp and the declared version are DIFFERENT
 * numbers coming from DIFFERENT sources. That `WITNESS_V2` happens to equal
 * the row stamp today is the fixture's deliberate collision case (see
 * declaredV2Source), not a shared source of truth — the anti-vacuity guard
 * below re-measures the divergence on every other row.
 */
const WITNESS_V1 = 1
const WITNESS_V2 = 2
const WITNESS_V3 = 3

/**
 * A v1 document — the version the acceptance world's frozen rows carry inside.
 * This file owns the bytes (7.4-B1 phase 1): an era witness must not be minted
 * from a factory whose base version is a claim about the factory's era. The
 * shape is the minimal CLOSED v1 document — every field belongs to the v1
 * closed set, so it strong-parses while the bridge runs v1, exactly what the
 * rows and anchors below need.
 */
function v1Source(blueprintId: string, revision: string, persona = 'Lead.'): string {
  return [
    '---',
    `schemaVersion: ${String(WITNESS_V1)}`,
    `blueprintId: ${blueprintId}`,
    `revision: "${revision}"`,
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(persona)}`,
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/**
 * Rewrite the frontmatter's declared-version line to the version the LEG needs
 * the document to DECLARE. The rewrite is line-structural and THROWS if there
 * is no version line: a silent no-op would collapse the fixture's whole point —
 * this file's rows are only meaningful because what the document declares and
 * what the row stamps are DIFFERENT numbers (the anti-vacuity guard below
 * re-measures the divergence, so a collapse could not pass quietly). The base
 * body is this file's own (see v1Source), never the shared factory's, so no
 * factory migration can restamp these witnesses (7.4-B1 phase 1, C-domain
 * FINDINGS §5).
 */
function withDeclaredVersion(source: string, version: number): string {
  const pattern = /^schemaVersion: \d+$/m
  if (!pattern.test(source)) {
    throw new Error('A4-F1 guard: the witness body carries no rewriteable schemaVersion line')
  }
  return source.replace(pattern, `schemaVersion: ${String(version)}`)
}

/**
 * A document whose frontmatter declares version 3. Listing an identity reads the
 * frontmatter only (plan §7.4: no whole-catalog strong parse), so this is a
 * legitimate LISTING fixture — and it is the exact shape F1 was measured on: a
 * v3 document under a row stamped `2`.
 */
function declaredV3Source(blueprintId: string, revision: string): string {
  return withDeclaredVersion(v1Source(blueprintId, revision, 'Three.'), WITNESS_V3)
}

/**
 * A document declaring version 2 — the ONE version whose document number equals
 * this build's L3 row stamp. It belongs in the fixture so the fix cannot be
 * "report anything except 2": a v2 document must still be listed at 2, because
 * that is what its frontmatter says.
 */
function declaredV2Source(blueprintId: string, revision: string): string {
  return withDeclaredVersion(v1Source(blueprintId, revision, 'Two.'), WITNESS_V2)
}

/** A stored source that is not a readable document at all (a corrupt row). */
const UNREADABLE_SOURCE = 'this is not a blueprint document, frontmatter or otherwise\n'

/**
 * One durable row, built by the REAL storage factory so its `schemaVersion` is the
 * production L3 stamp and every field crosses the production validator. The row
 * keeps that stamp — it is the storage record — while the runtime view handed to
 * the authority deliberately has no such field.
 */
function frozenRow(blueprintId: string, revision: string, source: string): BlueprintRegistryRecord {
  return createBlueprintRegistryRecord({
    blueprintId,
    revision,
    contentHash: `sha256:a4f1-fixture-${blueprintId}`,
    source,
    frozenAt: '2026-10-08T00:00:00.000Z',
  })
}

/**
 * An in-memory registry port that stores REAL storage records (F1 is about the
 * boundary between a storage record and the runtime's view of it, so a double
 * stripped of the stamp would hide the very field under test).
 */
class StorageShapedRegistry implements BlueprintRegistryPort {
  readonly rows = new Map<string, BlueprintRegistryRecord>()

  constructor(rows: readonly BlueprintRegistryRecord[] = []) {
    for (const row of rows) this.rows.set(`${row.blueprintId}@${row.revision}`, row)
  }

  get(blueprintId: string, revision: string): BlueprintRegistryRecordView | undefined {
    return this.rows.get(`${blueprintId}@${revision}`)
  }

  list(): readonly BlueprintRegistryRecord[] {
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
    // The production write: the storage factory stamps the L3 version. A freeze
    // through this port therefore produces the SAME divergence F1 was measured on
    // — a row stamped 2 around a document that says something else — without this
    // file having to invent the stamp.
    const row = createBlueprintRegistryRecord(input)
    this.rows.set(key, row)
    return row
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP A — the authority's own listing: the version comes out of the document.
//
// Three frozen rows in one store, each storing a DIFFERENT document version, all
// three stamped by the same L3 discipline. Before the fix the listing could only
// ever answer one number for all three.
// ═══════════════════════════════════════════════════════════════════════════════

const ANCHOR = v1Source('a4f1.anchor', '1', 'Anchor lead.')
const ROW_V3 = frozenRow('a4f1.frozen-v3', '1', declaredV3Source('a4f1.frozen-v3', '1'))
const ROW_V1 = frozenRow('a4f1.frozen-v1', '2', v1Source('a4f1.frozen-v1', '2', 'One lead.'))
const ROW_CORRUPT = frozenRow('a4f1.frozen-corrupt', '1', UNREADABLE_SOURCE)
const ROW_V2 = frozenRow('a4f1.frozen-plain', '1', declaredV2Source('a4f1.frozen-plain', '1'))

/** The identity of one blueprint as the authority listed it, or a thrown failure. */
function listed(authority: BlueprintAuthority, blueprintId: string) {
  const identity = authority.listIdentities().find((candidate) => candidate.blueprintId === blueprintId)
  if (identity === undefined) {
    throw new Error(`A4-F1 guard: '${blueprintId}' is not listed at all`)
  }
  return identity
}

const authorityA = createBlueprintAuthority({
  bootstrapSource: ANCHOR,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: makeDir('a-empty-dir') }),
  registry: new StorageShapedRegistry([ROW_V3, ROW_V1, ROW_CORRUPT, ROW_V2]),
})

describe('a4f1 A: a frozen row answers the version question with its document', () => {
  it('the fixture really diverges: the row stamp is the L3 stamp, the document says otherwise', () => {
    // THE ANTI-VACUITY GUARD. Every leg below compares the reported version to the
    // DOCUMENT's version. If the fixture ever stops diverging — if the stamp and
    // the document become the same number again, which is how the a4p7 fixtures
    // were written and exactly why F1 survived them — each comparison would be
    // satisfiable by reading either one, and this file would prove nothing.
    expect(ROW_V3.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(declaredBlueprintSchemaVersion(ROW_V3.source)).not.toBe(ROW_V3.schemaVersion)
    expect(declaredBlueprintSchemaVersion(ROW_V1.source)).not.toBe(ROW_V1.schemaVersion)
    // And the divergence is not a quirk of these fixtures: it is the default, since
    // the row stamp is the domain version and the document has its own set.
    expect(SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS).toEqual([TEAM_DOMAIN_SCHEMA_VERSION])
  })

  it('a frozen v3 document is listed as v3, not as the row stamp', () => {
    // The acceptance world's `a4.accept.team`, in one assertion: it listed 2.
    const identity = listed(authorityA, 'a4f1.frozen-v3')
    expect(identity.origin).toBe('frozen')
    expect(identity.schemaVersion).toBe(declaredBlueprintSchemaVersion(ROW_V3.source))
    expect(identity.schemaVersion).toBe(3)
    expect(identity.schemaVersion).not.toBe(TEAM_DOMAIN_SCHEMA_VERSION)
  })

  it('a frozen v1 document is listed as v1 — three documents, three answers, one stamp', () => {
    const v1 = listed(authorityA, 'a4f1.frozen-v1')
    expect(v1.schemaVersion).toBe(1)
    expect(v1.migrationState).toBe(blueprintVersionStateOf(1))
    // Three readable rows, three declared versions, one L3 stamp on all of them.
    // A listing that answered from the stamp could only ever produce one number.
    const versions = authorityA
      .listIdentities()
      .filter((identity) => identity.origin === 'frozen' && identity.schemaVersion !== undefined)
      .map((identity) => identity.schemaVersion)
    expect(new Set(versions).size).toBe(versions.length)
    // And the anti-over-correction: version 2 is NOT a forbidden answer. This row
    // reports 2 because its DOCUMENT says 2 — the same number its L3 stamp happens
    // to carry. The fix reads the document; it does not blacklist a number.
    const v2 = listed(authorityA, 'a4f1.frozen-plain')
    expect(v2.schemaVersion).toBe(2)
    expect(declaredBlueprintSchemaVersion(ROW_V2.source)).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
  })

  it('the state is always the state OF THE REPORTED VERSION — never an independent default', () => {
    // The 7.3-forward pin. `SUPPORTED` becomes `[3]` in Task 7.3 and the retired
    // set becomes `[1,2]`; this leg moves with the sets instead of snapshotting
    // them, and it says the thing that makes the flip safe for a frozen row: the
    // number and the state come from one read of one document, so a flip cannot
    // make a row's state disagree with its own version.
    for (const identity of authorityA.listIdentities()) {
      if (identity.schemaVersion === undefined) {
        expect(identity.migrationState).toBe('unreadable')
        continue
      }
      expect(identity.migrationState).toBe(blueprintVersionStateOf(identity.schemaVersion))
    }
  })

  it('a row whose document cannot be read reports NO version and is NOT current', () => {
    const identity = listed(authorityA, 'a4f1.frozen-corrupt')
    expect(identity.origin).toBe('frozen')
    // Absent, not `undefined`, not `0`, not the L3 stamp: a surface that prints a
    // number here hands the operator a version to migrate from, and there is none.
    expect('schemaVersion' in identity).toBe(false)
    expect(identity.migrationState).toBe('unreadable')
    expect(identity.migrationState).not.toBe('current')
  })

  it('resolving that unreadable row is refused by name, and is not a corrupt-registry claim', () => {
    // A1-21's third arm: an unreadable document gets the version-refusal name with
    // an unknown version, and never a parse error or a hash accusation smuggled in
    // as the operator's diagnosis.
    const error = capture(() => authorityA.resolve('a4f1.frozen-corrupt', '1'))
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
    const detail = (error as { detail?: Record<string, unknown> }).detail ?? {}
    expect('schemaVersion' in detail).toBe(false)
    expect(detail['migrationState']).toBe('unreadable')
    expect(String((error as Error).message)).not.toContain('undefined')
  })

  it('the bootstrap anchor still answers with its parsed document version', () => {
    // The arm that was already right is pinned so the fix cannot "generalise" into
    // it: the anchor's version comes from the strong parse.
    const identity = listed(authorityA, 'a4f1.anchor')
    expect(identity.origin).toBe('bootstrap')
    expect(identity.schemaVersion).toBe(parseBlueprint(ANCHOR).schemaVersion)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP B — the boundary that lied: `catalog.list` on the wire, over the real
// root, the real authority and the real dispatcher.
// ═══════════════════════════════════════════════════════════════════════════════

/** One `revisionStates` entry exactly as the wire carries it. */
type WireState = {
  readonly revision: number
  readonly migrationState: BlueprintVersionState
  readonly schemaVersion?: number
}

function wireState(
  rows: readonly Record<string, unknown>[],
  blueprintId: string,
): WireState {
  const row = rows.find((candidate) => candidate['blueprintId'] === blueprintId)
  if (row === undefined) {
    throw new Error(`A4-F1 guard: '${blueprintId}' is not on the catalog listing at all`)
  }
  const states = row['revisionStates']
  if (!Array.isArray(states) || states.length !== 1) {
    throw new Error(
      `A4-F1 guard: '${blueprintId}' does not carry exactly one revisionState: ${JSON.stringify(row)}`,
    )
  }
  return states[0] as WireState
}

const wireDir = makeDir('b-wire')
writeSource(wireDir, 'saved-v3.yaml', declaredV3Source('a4f1.saved-v3', '1'))
const wireRegistry = new StorageShapedRegistry([ROW_V3, ROW_CORRUPT])

const wireAuthority = createBlueprintAuthority({
  bootstrapSource: ANCHOR,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: wireDir }),
  registry: wireRegistry,
})

const wireConfig: TeamPluginConfig = {
  bootPhase: 'create',
  rootSessionId: 'session-a4f1-row-version',
  blueprintSource: ANCHOR,
  generation: 1,
  defaultWorkspace: '/tmp/agent-team/a4f1',
  seedMembers: [],
  staticModel: { provider: 'a4f1', model: 'a4f1-model-v1' },
  deniedSelection: null,
  mcpServer: null,
  environmentFacts: [],
  externalPolicyFacts: { hard: {}, capabilityExists: {} },
}

const wireSeam = new FileStorageSeam(makeDir('b-store'))
const wireDomain = await createTeamDomain(wireSeam)
const wireToolsRef: { current: undefined } = { current: undefined }
const wireRoot = createTeamProductionRoot({
  config: wireConfig,
  domain: wireDomain,
  storageSeam: wireSeam,
  live: createStubBindings({
    config: wireConfig,
    teamToolsRef: wireToolsRef,
    domain: wireDomain,
  }) as unknown as TeamAgentBindings,
  now: () => '2026-10-08T00:00:00.000Z',
  teamToolsRef: wireToolsRef,
  controlServiceRef: { current: undefined },
  legacyInspect: () => {
    throw new Error('A4-F1 guard: the legacy inspect seam is unused here')
  },
  blueprintCatalog: createLiveBlueprintCatalog(wireAuthority),
  blueprintAuthority: wireAuthority,
})

const wireDispatcher: {
  current: ((endpoint: string, payload: unknown) => Promise<Record<string, unknown>>) | null
} = { current: null }
wireRoot.seams.remoteHandlerRegistration.current()({
  rpc: {
    handle: (_channel: string, handler: unknown) => {
      wireDispatcher.current = handler as (
        endpoint: string,
        payload: unknown,
      ) => Promise<Record<string, unknown>>
      return () => {}
    },
  },
})
const installedDispatcher = wireDispatcher.current
if (installedDispatcher === null) {
  throw new Error('A4-F1 guard: the remote registration never installed a dispatcher')
}

const wireRows = await (async () => {
  const response = await installedDispatcher('catalog.list', { version: 8, params: {} })
  const value = response['value'] as { data?: unknown } | undefined
  const data = value?.data as { blueprints?: readonly Record<string, unknown>[] } | undefined
  if (!Array.isArray(data?.blueprints)) {
    throw new Error(
      `A4-F1 guard: catalog.list returned no blueprints payload: ${JSON.stringify(response)}`,
    )
  }
  return data.blueprints
})()

describe('a4f1 B: the wire payload reports the document version, and unknown when there is none', () => {
  it('a frozen v3 row is listed at v3 on the wire — the receipt that measured 2', () => {
    const state = wireState(wireRows, 'a4f1.frozen-v3')
    expect(state.schemaVersion).toBe(declaredBlueprintSchemaVersion(ROW_V3.source))
    expect(state.migrationState).toBe(blueprintVersionStateOf(3))
    // Stated as the negative too, because this is the literal value the acceptance
    // world's receipt carried for a v3 document.
    expect(state).not.toEqual({ revision: 1, schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION, migrationState: 'current' })
  })

  it('a frozen row with no readable version reaches the client with no number', () => {
    const state = wireState(wireRows, 'a4f1.frozen-corrupt')
    expect(state.migrationState).toBe('unreadable')
    expect('schemaVersion' in state).toBe(false)
  })

  it('a saved v3 source and a frozen v3 row answer the same version on the same read', () => {
    // The live symptom was a host disagreeing with ITSELF: the saved document said
    // 3, the frozen row of the same document said 2. One read, one answer, whatever
    // the row was stamped with.
    const saved = wireState(wireRows, 'a4f1.saved-v3')
    const frozen = wireState(wireRows, 'a4f1.frozen-v3')
    expect(saved.schemaVersion).toBe(frozen.schemaVersion)
    expect(saved.migrationState).toBe(frozen.migrationState)
  })

  it('no listed state carries the L3 stamp as its version unless its document declares it', () => {
    // The general form of the defect, driven over every frozen row this world
    // lists: a state's version is the document's declared version, or the state is
    // `unreadable` and carries no version at all. There is no third possibility,
    // and the row store is the one place a third value (`2`, the domain stamp) was
    // ever available to come from.
    for (const row of wireRegistry.list()) {
      const declared = declaredBlueprintSchemaVersion(row.source)
      const state = wireState(wireRows, row.blueprintId)
      if (declared === undefined) {
        expect('schemaVersion' in state).toBe(false)
        expect(state.migrationState).toBe('unreadable')
      } else {
        expect(state.schemaVersion).toBe(declared)
        expect(state.migrationState).toBe(blueprintVersionStateOf(declared))
      }
      // The stamp is on the row and the stamp is NOT what the wire said, unless the
      // document happens to declare the same number (it does not, in this world).
      expect(declared).not.toBe(row.schemaVersion)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP C — the freeze boundary: the answer must not change when a saved source
// becomes a durable row (the acceptance world's exact sequence), and the gate on
// the write reads the same document.
// ═══════════════════════════════════════════════════════════════════════════════

const freezeDir = makeDir('c-freeze')
const FREEZE_SOURCE = v1Source('a4f1.freeze', '1', 'Freeze lead.')
writeSource(freezeDir, 'to-freeze.yaml', FREEZE_SOURCE)
const freezeRegistry = new StorageShapedRegistry()
const freezeAuthority = createBlueprintAuthority({
  bootstrapSource: ANCHOR,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: freezeDir }),
  registry: freezeRegistry,
  now: () => '2026-10-08T00:00:00.000Z',
})

const versionBeforeFreeze = listed(freezeAuthority, 'a4f1.freeze').schemaVersion
await freezeAuthority.freezeSnapshot(toBlueprintSnapshotRef(parseBlueprint(FREEZE_SOURCE)))
// Read the ROW off the store, not through the port's view: the whole point of the
// next leg is the field the view deliberately does not have.
const frozenByFreeze = freezeRegistry.rows.get('a4f1.freeze@1')
const versionAfterFreeze = listed(freezeAuthority, 'a4f1.freeze').schemaVersion

describe('a4f1 C: crossing the freeze boundary does not change the reported version', () => {
  it('the freeze really wrote a row, and that row is stamped with the L3 version', () => {
    // Not a premise — a measured fact about the row the write produced. It is the
    // whole reason the next leg matters: the durable row arrives carrying a number
    // that is not a document version.
    expect(frozenByFreeze).not.toBe(undefined)
    expect(frozenByFreeze?.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(declaredBlueprintSchemaVersion(frozenByFreeze?.source ?? '')).toBe(1)
    expect(frozenByFreeze?.schemaVersion).not.toBe(declaredBlueprintSchemaVersion(FREEZE_SOURCE))
  })

  it('the listing says the same version before and after the freeze', () => {
    // The acceptance world: `a4.accept.team` listed 3 while it was a saved file and
    // 2 once `team.create` froze it, because the registry row SHADOWS the saved
    // source (registry-wins) and the row arm answered from its stamp. One document,
    // one version, across the boundary.
    expect(versionBeforeFreeze).toBe(1)
    expect(versionAfterFreeze).toBe(versionBeforeFreeze)
    expect(versionAfterFreeze).not.toBe(TEAM_DOMAIN_SCHEMA_VERSION)
  })

  it('the freeze gate on an already-frozen row reads the document too', async () => {
    // Task 7.2 put a version gate in front of this durable write, and the frozen
    // arm of that gate used the stamp. The observable arm today is the unreadable
    // row: a re-drive of a freeze whose stored text cannot be read must be refused
    // with the version name and no version, not accepted because the stamp says
    // `2` and `2` is in the supported set.
    const corrupt = new StorageShapedRegistry([ROW_CORRUPT])
    const corruptAuthority = createBlueprintAuthority({
      bootstrapSource: ANCHOR,
      sourceIndex: createBlueprintSourceIndex({ blueprintDir: makeDir('c-corrupt') }),
      registry: corrupt,
      now: () => '2026-10-08T00:00:00.000Z',
    })
    const corruptRef = parseBlueprintSnapshotRef({
      blueprintId: 'a4f1.frozen-corrupt',
      revision: '1',
      contentHash: ROW_CORRUPT.contentHash,
    })
    const error = await corruptAuthority.freezeSnapshot(corruptRef).then(
      () => undefined,
      (caught: unknown) => caught,
    )
    expect(pluginCodeOf(error)).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
    const detail = (error as { detail?: Record<string, unknown> }).detail ?? {}
    expect('schemaVersion' in detail).toBe(false)
    expect(detail['migrationState']).toBe('unreadable')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP D — the row keeps its own stamp, under its own name, in storage.
// Fixing F1 must not touch the L3 discipline: no row is renamed, no row is
// migrated, and the storage validator still refuses a row that is not v2.
// ═══════════════════════════════════════════════════════════════════════════════

describe('a4f1 D: the storage row keeps its L3 stamp untouched', () => {
  it('every row this build writes carries the domain stamp, whatever the document says', () => {
    // Two documents, two versions, ONE stamp — and that is CORRECT for the row:
    // it describes the storage shape. The defect was reading it as the other one.
    expect(ROW_V3.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(ROW_V1.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(ROW_CORRUPT.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(declaredBlueprintSchemaVersion(ROW_V3.source)).toBe(3)
    expect(declaredBlueprintSchemaVersion(ROW_V1.source)).toBe(1)
  })

  it('the L3 constants are the values this phase pinned, unchanged by the fix', () => {
    expect(TEAM_DOMAIN_SCHEMA_VERSION).toBe(2)
    expect(SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS).toEqual([2])
  })
})

// --- helpers -------------------------------------------------------------------

function capture(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (error) {
    return error
  }
}

function pluginCodeOf(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code
}
