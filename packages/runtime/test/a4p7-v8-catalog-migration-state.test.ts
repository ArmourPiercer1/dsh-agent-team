/**
 * a4p7-v8-catalog-migration-state.test.ts — A4-PR7 Ruling 1: the Remote v8
 * catalog carries Blueprint migration STATE, and the boolean that misreported
 * it is gone.
 *
 * THE DEFECT THIS FILE CLOSES IS NOT A MISSING FIELD, IT IS A LYING ONE.
 * `BlueprintIdentity.migrationRequired` answered one question with two values
 * and therefore had to stretch one value to cover two facts: `false` meant
 * "current" and it also meant "this build cannot read that document's version
 * at all". A frozen registry row declaring a version this product never defined
 * was therefore advertised as CURRENT — listed, no migration flag, and
 * `resolve()` answered it with `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`. The
 * listing and the resolve disagreed about the same identity in the same
 * request, and the operator's "what still needs migrating?" runbook read the
 * listing. That is the absent-vs-unavailable fold this phase keeps meeting
 * (A4-PR3's `findApprovalCaseByIdentity`, PR6's `{ rules: [] }`, now a wire
 * field), one layer up each time.
 *
 * THE CARRIER IS THREE-VALUED PLUS THE VERSION, AND IT IS THE ONLY CARRIER:
 * `migrationState: 'current' | 'migration-required' | 'unreadable'` beside
 * `schemaVersion`, derived from the domain's own sets
 * (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` / `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`)
 * and from `inspectBlueprintSource`'s status — never from a numeric version
 * threshold. The boolean is deleted at every site in the same commit: two
 * carriers of one question drift, and this is the direction it drifts.
 *
 * WHY THE LEGS RUN THROUGH THE PRODUCTION ROOT AND ITS DISPATCHER. PR6 merged a
 * gate whose every test handed the service its own port, so the adapter where
 * the fault actually became `{ rules: [] }` was never driven. A catalog payload
 * asserted against a hand-supplied `S6RemoteCatalogPort` would prove the same
 * nothing about the wire, so every payload leg below builds the REAL
 * `createTeamProductionRoot` with a REAL `createBlueprintAuthority` over a REAL
 * directory, installs the dispatcher through `root.seams.remoteHandlerRegistration`
 * exactly as the host mount does, and reads `catalog.list` as a client would.
 * The wiring that carries the state from the authority to the payload is
 * therefore load-bearing here: unwire it and these legs go red (MUT-3).
 *
 * WHAT IS SIMULATED, STATED PLAINLY. At this commit the bridge still runs v1
 * and v2, so `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` is DEFINED minus SUPPORTED =
 * EMPTY, and NO real document on disk can inspect as `migration-required` yet
 * (the sibling acceptance file pins that emptiness as a law: a4p7-v3-cutover-
 * acceptance group B). The migration-required leg therefore drives the
 * authority's OWN structural seam with the same narrow double that file uses —
 * a source index whose `inspectSource` answers like the inspector of a build
 * running `[3]`, which relabels `ok` to `migration-required` ONLY for a DEFINED
 * version outside the simulated set and passes `rejected` through untouched. The
 * authority, the live catalog, the root, the dispatcher and the payload are the
 * real ones. The `unreadable` and `current` legs need no double at all: a frozen
 * row declaring version 99 is reachable TODAY, which is exactly why the boolean
 * was already lying TODAY.
 *
 * WHAT THE WIRE DOES WHEN NOBODY TELLS IT A STATE. Two legs drive that default on
 * purpose, because "a loud catalog, never a quiet one" is a law and a law on a
 * branch nothing executes is a comment: a root handed a catalog but NO authority, and
 * an authority reporting a state OUTSIDE the closed set (a fixture the type forbids —
 * the runtime check exists exactly for producers the compiler cannot see, across a
 * package boundary or out of a JSON file). Both must answer `unreadable` and carry NO
 * `schemaVersion`, while the frozen `{ blueprintId, revisions }` half of the row keeps
 * listing the blueprint: losing the state must not cost the operator the discovery.
 * Defaulting to `current` because nothing said otherwise is the deleted defect
 * restated as a fallback, so MUT-8 flips that default and these two legs burn.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies, so the
 * worlds are built at module load and the `it` bodies assert synchronously.
 * Scratch lives under this test directory (workspace-write sandbox) and is
 * removed at module load and in `afterAll`.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-v8-catalog-migration-state
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  BLUEPRINT_VERSION_REFUSAL_CODES,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
} from '../../domain/blueprint/src/index.js'
import { revisionSource } from '../../domain/blueprint/testdata/fixtures.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'

import {
  blueprintVersionStateOf,
  classifyBlueprintAnchor,
  createBlueprintAuthority,
} from '../src/plugin/blueprint-authority.js'
import type {
  BlueprintAnchorState,
  BlueprintAuthority,
  BlueprintRegistryPort,
  BlueprintRegistryRecordView,
  BlueprintVersionState,
} from '../src/plugin/blueprint-authority.js'
import * as hostEntry from '../src/plugin/host.js'
import { createBlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import type { BlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import { createLiveBlueprintCatalog } from '../src/plugin/blueprint-live-catalog.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamAgentBindings, TeamPluginConfig } from '../src/plugin/types.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

// --- scratch world -------------------------------------------------------------

const thisFile = fileURLToPath(import.meta.url)
const sep = thisFile.includes('\\') ? '\\' : '/'
const scratchRoot = thisFile.slice(0, thisFile.lastIndexOf(sep)) + sep + '.tmp-a4p7-catalog'

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

/** One in-memory registry row store (the structural port; a4p7 group C's shape). */
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
    throw new Error(`a4p7 catalog-migration fixtures never freeze: ${input.blueprintId}@${input.revision}`)
  }
}

/**
 * A saved source whose DECLARED version is the only thing changed. A saved
 * source is only ever read at identity level by the listing, so a document that
 * would not strong-parse on a future version is a legitimate listing fixture —
 * and it must not be, for the anchor, which the root strong-parses.
 */
function sourceOnVersion(blueprintId: string, revision: string, version: number): string {
  return revisionSource(blueprintId, revision, `${blueprintId} lead.`).replace(
    'schemaVersion: 1',
    `schemaVersion: ${version}`,
  )
}

/** A frozen row on a version this product never defined (reachable TODAY). */
function rowOnVersion(
  blueprintId: string,
  revision: string,
  schemaVersion: number,
): BlueprintRegistryRecordView {
  return {
    schemaVersion,
    blueprintId,
    revision,
    contentHash: 'sha256:a4p7-catalog-fixture-hash-is-not-the-source-hash',
    source: sourceOnVersion(blueprintId, revision, schemaVersion),
    frozenAt: '2026-10-20T00:00:00.000Z',
  }
}

/**
 * The narrow cutover double (the a4p7 acceptance file's `cutoverIndex`, same
 * discipline): delegates the scan, the names and the text, relabels `ok` →
 * `migration-required` ONLY for a DEFINED version outside the simulated set, and
 * passes every `rejected` through untouched, so it can never turn an unreadable
 * document into a migratable one.
 */
function cutoverIndex(
  inner: BlueprintSourceIndex,
  simulatedSupported: readonly number[],
): BlueprintSourceIndex {
  return {
    get dir() {
      return inner.dir
    },
    listSourceFiles: () => inner.listSourceFiles(),
    readSource: (name: string) => inner.readSource(name),
    inspectSource(name: string) {
      const result = inner.inspectSource(name)
      if (result.status !== 'ok') return result
      const { schemaVersion } = result.identity
      if (simulatedSupported.includes(schemaVersion)) return result
      return { status: 'migration-required', identity: result.identity }
    },
  }
}

// --- the production world (real root, real authority, real dispatcher) ---------

const ANCHOR = revisionSource('a4p7.catalog.anchor', '1', 'Catalog anchor lead.')
const ROOT_SID = 'session-a4p7-catalog-root'
const NOW = '2026-10-20T00:00:00.000Z'

function catalogConfig(): TeamPluginConfig {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: ANCHOR,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/a4p7-catalog',
    seedMembers: [],
    staticModel: { provider: 'a4p7c', model: 'a4p7c-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
}

type CatalogWorld = {
  /** One real `catalog.list` dispatch in the given contract-version envelope. */
  readonly list: (version: number) => Promise<readonly Record<string, unknown>[]>
  readonly authority: ReturnType<typeof createBlueprintAuthority>
}

/**
 * One world: the REAL production root (the a4p7 group-D harness) over a REAL
 * authority, with the dispatcher installed the way the host mount installs it.
 * No boot: `catalog.list` is one of the readiness-independent reads, so this is
 * the same answer a client gets from a host whose Team never started.
 */
/**
 * The authority wiring a root is given — three cases, and the two unusual ones are
 * the laws group C asserts. A host that wires the catalog but not the authority, and
 * an authority that reports a state nobody defined, must both answer `unreadable` on
 * the wire rather than fall through to `current`.
 */
function rootWiring(
  authority: BlueprintAuthority,
  options: {
    readonly factoryWorld?: boolean
    readonly withoutAuthorityWiring?: boolean
    readonly bogusStateFor?: string
  },
): {
  readonly blueprintCatalog?: ReturnType<typeof createLiveBlueprintCatalog>
  readonly blueprintAuthority?: BlueprintAuthority
} {
  if (options.factoryWorld === true) return {}
  const catalog = createLiveBlueprintCatalog(authority)
  if (options.withoutAuthorityWiring === true) return { blueprintCatalog: catalog }
  return {
    blueprintCatalog: catalog,
    blueprintAuthority:
      options.bogusStateFor === undefined ? authority : lyingAuthority(authority, options.bogusStateFor),
  }
}

/**
 * An authority reporting a state OUTSIDE the closed set for one identity.
 *
 * The cast is the fixture, not a shortcut: `BlueprintVersionState` forbids this value
 * by construction, and the point of the leg is that the wire does not take a
 * producer's word for it. A state that is not one of the three is not a state, and
 * inventing `current` for it would be the deleted bug wearing a validation badge.
 */
function lyingAuthority(authority: BlueprintAuthority, blueprintId: string): BlueprintAuthority {
  return {
    ...authority,
    listIdentities: () =>
      authority.listIdentities().map((identity) =>
        identity.blueprintId === blueprintId
          ? { ...identity, migrationState: 'reached-later' as unknown as BlueprintVersionState }
          : identity,
      ),
  }
}

async function catalogWorld(options: {
  readonly name: string
  readonly saved: Readonly<Record<string, string>>
  readonly rows?: readonly BlueprintRegistryRecordView[]
  /** Simulated supported set for the SAVED-SOURCE inspector only (see above). */
  readonly simulateSupported?: readonly number[]
  /** Inject no authority at all: the factory-world root. */
  readonly factoryWorld?: boolean
  /** Wire the catalog but NOT the authority — the loud-catalog case. */
  readonly withoutAuthorityWiring?: boolean
  /** Report a state outside the closed set for this one blueprint. */
  readonly bogusStateFor?: string
}): Promise<CatalogWorld> {
  const dir = makeDir(options.name)
  for (const [name, source] of Object.entries(options.saved)) writeSource(dir, name, source)
  const index = createBlueprintSourceIndex({ blueprintDir: dir })
  const authority = createBlueprintAuthority({
    bootstrapSource: ANCHOR,
    sourceIndex:
      options.simulateSupported === undefined ? index : cutoverIndex(index, options.simulateSupported),
    registry: new MemRegistry(options.rows ?? []),
  })
  const seam = new FileStorageSeam(makeDir(`${options.name}-store`))
  const domain = await createTeamDomain(seam)
  const config = catalogConfig()
  const teamToolsRef: { current: undefined } = { current: undefined }
  const stub = createStubBindings({ config, teamToolsRef, domain }) as unknown as TeamAgentBindings
  const root = createTeamProductionRoot({
    config,
    domain,
    storageSeam: seam,
    live: stub,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    legacyInspect: () => {
      throw new Error('A4-PR7 catalog guard: the legacy inspect seam is unused here')
    },
    ...rootWiring(authority, options),
  })
  const dispatcher: {
    current: ((endpoint: string, payload: unknown) => Promise<Record<string, unknown>>) | null
  } = { current: null }
  root.seams.remoteHandlerRegistration.current()({
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
    throw new Error('A4-PR7 catalog guard: the remote registration never installed a dispatcher')
  }
  return {
    authority,
    list: async (version: number) => {
      const response = await installed('catalog.list', { version, params: {} })
      // The dispatcher's own envelope: `{ ok, value: { data, provenance } }`. Read
      // through it rather than assuming — a guard that unwraps the wrong level
      // reports "no payload" for a payload that is sitting right there.
      const value = response['value'] as { data?: unknown } | undefined
      const data = value?.data as
        | { blueprints?: readonly Record<string, unknown>[] }
        | undefined
      if (!Array.isArray(data?.blueprints)) {
        throw new Error(
          `A4-PR7 catalog guard: catalog.list v${String(version)} returned no blueprints payload: ${JSON.stringify(response)}`,
        )
      }
      return data.blueprints
    },
  }
}

/** One `revisionStates` entry as the wire carries it. */
type WireState = {
  readonly revision: number
  readonly migrationState: BlueprintVersionState
  readonly schemaVersion?: number
}

// Every reader below THROWS rather than returning `undefined`. These are not
// defensive decorations: an assertion on `undefined?.migrationState` fails with
// "expected undefined to be 'unreadable'" and hides whether the row, the field, or
// the value is what went missing — and a wire-shape test that cannot say WHICH of
// the three it lost is not a wire-shape test.
function rowOf(rows: readonly Record<string, unknown>[], blueprintId: string): Record<string, unknown> {
  const row = rows.find((candidate) => candidate['blueprintId'] === blueprintId)
  if (row === undefined) {
    throw new Error(`A4-PR7 catalog guard: '${blueprintId}' is not on the catalog listing at all`)
  }
  return row
}

function statesOf(row: Record<string, unknown>): readonly WireState[] {
  const states = row['revisionStates']
  if (!Array.isArray(states)) {
    throw new Error(
      `A4-PR7 catalog guard: the row carries no revisionStates array: ${JSON.stringify(row)}`,
    )
  }
  return states as readonly WireState[]
}

/** The one revision a single-revision fixture row carries, with its state. */
function onlyState(rows: readonly Record<string, unknown>[], blueprintId: string): WireState {
  const states = statesOf(rowOf(rows, blueprintId))
  const first = states[0]
  if (first === undefined || states.length !== 1) {
    throw new Error(
      `A4-PR7 catalog guard: '${blueprintId}' carries ${String(states.length)} state entries, ` +
        `this fixture expects exactly one`,
    )
  }
  return first
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD R — nothing simulated: what the listing says AT THIS COMMIT.
// A v1 and a v3 saved source are BOTH runnable while the bridge stands; a frozen
// row on version 99 is runnable to nobody and owed no migration to anybody. That
// third one is the whole ruling: under the deleted boolean it answered `false`,
// the same answer as the two runnable documents beside it.
// ═══════════════════════════════════════════════════════════════════════════════

const V_RUNNABLE_V1 = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS[0] ?? 1
const V_RUNNABLE_V3 = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(3) ? 3 : V_RUNNABLE_V1
const V_UNDEFINED = 99

const worldR = await catalogWorld({
  name: 'r-real',
  saved: {
    'runnable-a.yaml': sourceOnVersion('a4p7.catalog.runnableA', '1', V_RUNNABLE_V1),
    'runnable-b.yaml': sourceOnVersion('a4p7.catalog.runnableB', '2', V_RUNNABLE_V3),
  },
  rows: [rowOnVersion('a4p7.catalog.unknown', '7', V_UNDEFINED)],
})
const rowsR = await worldR.list(8)
/** The same read in the contract-v1 envelope (hoisted: the shim forbids async `it`). */
const rowsRv1 = await worldR.list(1)

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD C — the cutover posture for the saved-source inspector, so the
// migration-required arm is reachable before Task 7.3 lands. One retired source
// and one runnable source side by side, on one host, in one listing.
// ═══════════════════════════════════════════════════════════════════════════════

const worldC = await catalogWorld({
  name: 'c-cutover',
  saved: {
    'retired.yaml': sourceOnVersion('a4p7.catalog.retired', '4', V_RUNNABLE_V1),
    'runnable.yaml': sourceOnVersion('a4p7.catalog.stillOk', '1', V_RUNNABLE_V3),
  },
  simulateSupported: [3],
})
const rowsC = await worldC.list(8)

// The factory world: no authority, no injected catalog. The root still owes a
// state for the one document it can list, and it derives it from its own
// classified anchor — it does not answer `unreadable` for a document it parsed,
// and it does not answer `current` for a document it refused.
const worldF = await catalogWorld({ name: 'f-factory', saved: {}, factoryWorld: true })
const rowsF = await worldF.list(1)

// ═══════════════════════════════════════════════════════════════════════════════
// WORLDS N and L — THE TWO WAYS NOBODY SUPPLIES A STATE. Both end at the same
// default in `catalogRevisionState`, and that default is the ruling's own failure
// mode written as a fallback: a document advertised as CURRENT because nothing
// said otherwise. So the default is driven, not cited.
//   N: the host wires the catalog and forgets the authority. Real catalog, real
//      root, real dispatcher — the states simply are not there.
//   L: an authority reports a state outside the closed set for one identity.
// ═══════════════════════════════════════════════════════════════════════════════

const worldN = await catalogWorld({
  name: 'n-no-authority-wired',
  saved: {
    'runnable-a.yaml': sourceOnVersion('a4p7.catalog.runnableA', '1', V_RUNNABLE_V1),
    'runnable-b.yaml': sourceOnVersion('a4p7.catalog.runnableB', '2', V_RUNNABLE_V3),
  },
  withoutAuthorityWiring: true,
})
const rowsN = await worldN.list(8)

const worldL = await catalogWorld({
  name: 'l-bogus-state',
  saved: { 'runnable-a.yaml': sourceOnVersion('a4p7.catalog.runnableA', '1', V_RUNNABLE_V1) },
  bogusStateFor: 'a4p7.catalog.runnableA',
})
const rowsL = await worldL.list(8)

// ---------------------------------------------------------------------------
describe('a4p7 R1 A: the version state is derived from the domain sets, never from a threshold', () => {
  it('every version this build runs is current', () => {
    for (const version of SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS) {
      expect(blueprintVersionStateOf(version)).toBe('current')
    }
  })

  it('a version nobody defined is unreadable — never current, never migration-required', () => {
    expect(blueprintVersionStateOf(V_UNDEFINED)).toBe('unreadable')
    expect(blueprintVersionStateOf(V_UNDEFINED)).not.toBe('current')
    expect(blueprintVersionStateOf(V_UNDEFINED)).not.toBe('migration-required')
  })

  it('a retired version is migration-required exactly when the domain set says so', () => {
    // The set is empty while the bridge runs, so this leg asserts the
    // DERIVATION, not a snapshot: whatever is in the retired set must answer
    // `migration-required` and nothing else may.
    for (const version of [1, 2, 3, 4, 99]) {
      const expected: BlueprintVersionState = SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(version)
        ? 'current'
        : 'unreadable'
      expect(blueprintVersionStateOf(version)).toBe(expected)
    }
  })
})

// ---------------------------------------------------------------------------
describe('a4p7 R1 B: the identity carrier is three-valued, and the boolean is gone', () => {
  it('a runnable saved source lists current with its version', () => {
    const identity = worldR.authority
      .listIdentities()
      .find((i) => i.blueprintId === 'a4p7.catalog.runnableA')
    expect(identity?.migrationState).toBe('current')
    expect(identity?.schemaVersion).toBe(V_RUNNABLE_V1)
  })

  it('a frozen row on a version nobody defined is UNREADABLE, not current', () => {
    const identity = worldR.authority
      .listIdentities()
      .find((i) => i.blueprintId === 'a4p7.catalog.unknown')
    expect(identity?.migrationState).toBe('unreadable')
    expect(identity?.schemaVersion).toBe(V_UNDEFINED)
    // The collapse this ruling deletes: this identity is listed AND refused by
    // resolve, so an answer of `current` here would be a contradiction inside
    // one component.
    expect(() => worldR.authority.resolve('a4p7.catalog.unknown', '7')).toThrowError(
      expect.objectContaining({ code: BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED }),
    )
  })

  it('a retired saved source is migration-required with its version', () => {
    const identity = worldC.authority
      .listIdentities()
      .find((i) => i.blueprintId === 'a4p7.catalog.retired')
    expect(identity?.migrationState).toBe('migration-required')
    expect(identity?.schemaVersion).toBe(V_RUNNABLE_V1)
  })

  it('no listed identity carries the deleted boolean (one carrier, not two)', () => {
    for (const world of [worldR, worldC]) {
      for (const identity of world.authority.listIdentities()) {
        expect(identity).not.toHaveProperty('migrationRequired')
        expect(['current', 'migration-required', 'unreadable']).toContain(identity.migrationState)
      }
    }
  })
})

// ---------------------------------------------------------------------------
describe('a4p7 R1 C: catalog.list carries the state beside the revisions (real root, real dispatcher)', () => {
  it('every listed revision carries a state, so a boolean cannot stand in for one', () => {
    expect(rowsR.length).toBeGreaterThan(0)
    for (const row of rowsR) {
      const revisions = row['revisions'] as readonly number[]
      const states = statesOf(row)
      expect(states.map((s) => s.revision)).toEqual([...revisions])
      for (const state of states) {
        expect(['current', 'migration-required', 'unreadable']).toContain(state.migrationState)
      }
    }
  })

  it('the frozen row on an undefined version is NOT reported as current', () => {
    const state = onlyState(rowsR, 'a4p7.catalog.unknown')
    expect(state.migrationState).toBe('unreadable')
    expect(state.migrationState).not.toBe('current')
    expect(state.migrationState).not.toBe('migration-required')
    // The version the row declares is still carried — an unreadable document is
    // not an unidentified one, and the operator needs the number to see WHICH
    // version the catalog refused to recognise.
    expect(state.schemaVersion).toBe(V_UNDEFINED)
  })

  it('runnable revisions are current, side by side with the unreadable one', () => {
    expect(onlyState(rowsR, 'a4p7.catalog.runnableA')).toEqual({
      revision: 1,
      schemaVersion: V_RUNNABLE_V1,
      migrationState: 'current',
    })
    expect(onlyState(rowsR, 'a4p7.catalog.runnableB').migrationState).toBe('current')
  })

  it('a retired and a runnable revision carry different states in one listing', () => {
    expect(onlyState(rowsC, 'a4p7.catalog.retired')).toEqual({
      revision: 4,
      schemaVersion: V_RUNNABLE_V1,
      migrationState: 'migration-required',
    })
    expect(onlyState(rowsC, 'a4p7.catalog.stillOk').migrationState).toBe('current')
  })

  it('the frozen `{blueprintId, revisions}` shape is untouched (older consumers)', () => {
    const row = rowOf(rowsR, 'a4p7.catalog.runnableA')
    expect(row['blueprintId']).toBe('a4p7.catalog.runnableA')
    expect(row['revisions']).toEqual([1])
  })

  it('the state is part of the read, not of the contract version', () => {
    // `catalog.list` is a contract-v1 method whose RESULT shape has never been
    // version-selected, and the migration surface exists so an operator can see
    // what is left from ANY client. The A5-12 law that the wire version never
    // selects the authority algebra is untouched: this is a read of the
    // document's version, which is exactly the one thing A5-12 says to read.
    expect(statesOf(rowOf(rowsRv1, 'a4p7.catalog.unknown'))).toEqual(
      statesOf(rowOf(rowsR, 'a4p7.catalog.unknown')),
    )
    expect(onlyState(rowsRv1, 'a4p7.catalog.unknown').migrationState).toBe('unreadable')
  })

  it('the factory root derives its anchor state instead of omitting it', () => {
    const anchorState = onlyState(rowsF, 'a4p7.catalog.anchor')
    expect(anchorState.migrationState).toBe('current')
    expect(anchorState.schemaVersion).toBe(V_RUNNABLE_V1)
  })

  it('a host that wires the catalog but NOT the authority gets a LOUD catalog', () => {
    // The absent-reader default is the ruling's law, not a courtesy, and until this
    // leg nothing executed it: every other world supplies states. Flip that default
    // to `current` — the reviewer's MUT-8 — and this leg is the ONLY thing in the
    // suite that says so.
    //
    // What must survive is the discovery (the blueprint is still listed, the frozen
    // `{ blueprintId, revisions }` half is intact) and what must not is the
    // reassurance. `unreadable` with NO `schemaVersion`: the payload refuses to
    // stand behind a version either, because nothing told it one.
    const row = rowOf(rowsN, 'a4p7.catalog.runnableA')
    expect(row['revisions']).toEqual([1])
    const states = statesOf(row)
    expect(states.length).toBe(1)
    const state = states[0]
    if (state === undefined) throw new Error('A4-PR7 catalog guard: the unwired root listed no state entry')
    expect(state.revision).toBe(1)
    expect(state.migrationState).toBe('unreadable')
    expect(state).not.toHaveProperty('schemaVersion')
    // Every revision of every listed blueprint degrades the same way — no row is
    // allowed to look reassuring just because its neighbour was readable.
    for (const listed of rowsN) {
      for (const entry of statesOf(listed)) {
        expect(entry.migrationState).toBe('unreadable')
        expect(entry).not.toHaveProperty('schemaVersion')
      }
    }
  })

  it('a state outside the closed set never reaches the wire — it is unreadable', () => {
    // The wire does not take a producer's word for it. The fixture writes
    // `reached-later` through a cast (see `lyingAuthority`) precisely because the
    // type would otherwise be the only check, and a type is not a boundary.
    const state = onlyState(rowsL, 'a4p7.catalog.runnableA')
    expect(state.migrationState).toBe('unreadable')
    expect(state).not.toHaveProperty('schemaVersion')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP D — WHAT THE HUMAN READS. `host.ts` renders the degraded-boot warning at
// construction, and until this ruling that line ended in
// `… listed in the catalog with migrationRequired=false` — a sentence whose
// `false` meant "this build has never seen a version like it" printed in the
// same words it would use for "nothing to do". The line is a named, exported
// render so this file can assert the TEXT, not just a field: a human decides
// whether to run a migration from this sentence.
// ═══════════════════════════════════════════════════════════════════════════════

const refusedReal = classifyBlueprintAnchor(sourceOnVersion('a4p7.catalog.anchor', '1', V_UNDEFINED))

/** The refused arm of the classified anchor — the render's only input. */
type RefusedAnchor = Extract<BlueprintAnchorState, { readonly status: 'refused' }>

/** The exported render: the exact string `host.ts` hands to `console.warn`. */
const degradedBootLine = hostEntry.degradedAnchorBootLine

/** The migration-required arm, built as a value: at this commit the retired set
 *  is empty, so no real anchor reaches it (see the file header). The rendering is
 *  what is under test here, and the arm is the exported refused shape itself. */
const refusedMigration: RefusedAnchor = {
  status: 'refused',
  code: BLUEPRINT_VERSION_REFUSAL_CODES.MIGRATION_REQUIRED,
  headline: 'scripted: a schema v1 anchor under a build that runs [3]',
  schemaVersion: 1,
  migrationState: 'migration-required',
  identity: { blueprintId: 'a4p7.catalog.retired', revision: '1' },
}

describe('a4p7 R1 D: the degraded-boot line says which of the two it is', () => {
  it('the classifier really does answer unreadable for a version nobody defined', () => {
    expect(refusedReal.status).toBe('refused')
    if (refusedReal.status !== 'refused') return
    expect(refusedReal.migrationState).toBe('unreadable')
    expect(refusedReal.code).toBe(BLUEPRINT_VERSION_REFUSAL_CODES.SCHEMA_VERSION_UNSUPPORTED)
  })

  it('a retired anchor is named as a migration, with its version, and never as unreadable', () => {
    const line = degradedBootLine(ROOT_SID, refusedMigration)
    expect(line).toContain('migrationState=migration-required')
    expect(line).toContain('schema v1')
    expect(line).toContain('a4p7.catalog.retired@1')
    expect(line).not.toContain('unreadable')
  })

  it('an unreadable anchor is named as unreadable and is NOT offered a migration', () => {
    const line = degradedBootLine(ROOT_SID, refusedReal.status === 'refused' ? refusedReal : refusedMigration)
    expect(line).toContain('migrationState=unreadable')
    expect(line).toContain('not listed')
    expect(line).not.toContain('migrationState=migration-required')
  })

  it('neither line still renders the deleted boolean', () => {
    expect(degradedBootLine(ROOT_SID, refusedMigration)).not.toContain('migrationRequired=')
    expect(
      degradedBootLine(ROOT_SID, refusedReal.status === 'refused' ? refusedReal : refusedMigration),
    ).not.toContain('migrationRequired=')
  })

  it('both lines keep the two facts A1-20(c)/A1-21 separate: the host is up, the start is refused, no ack clears it', () => {
    for (const state of [
      refusedMigration,
      refusedReal.status === 'refused' ? refusedReal : refusedMigration,
    ]) {
      const line = degradedBootLine(ROOT_SID, state)
      expect(line).toContain('DEGRADED boot')
      expect(line).toContain('host is up')
      expect(line).toContain('acknowledgement')
    }
  })
})
