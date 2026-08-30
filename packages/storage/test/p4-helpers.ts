/**
 * p4-helpers — shared fixtures and the in-memory storage-seam fake for the
 * P4-T1 (TeamDomain schema / repositories) tests.
 *
 * The fake implements the `StorageDomainSeam` contract exactly as the
 * public StorageDomain would (see `schema/seam.ts` for the mapping):
 *
 * - one persisted unit per domain name; `close()` frees the name but the
 *   state persists (re-open works);
 * - `open` rejects `already-open`, `version-mismatch` (details
 *   `{ found, expected }`), and `malformed-medium` (table-set change);
 * - per-domain write chain: put/delete/update are serialized; a write
 *   enqueued on an open domain drains even if the domain closes mid-chain
 *   (the public close drains queued writes and rejects NEW writes);
 * - `update` on a missing key rejects with the public `missing-key` code;
 * - `setCrashAfterWrites(n)` arms a simulated crash: the first n writes
 *   succeed, every later write rejects with `FakeCrashError` and is NOT
 *   applied (sticky until `clearCrash()`);
 * - `writeLog` / `committed` record every applied write (the
 *   single-write-durability evidence).
 *
 * Also carries the fixture identities (frozen contracts v1 branded ids)
 * and the P4-T1 import-closure data (production modules, edge targets,
 * raw specifiers, banned vocabulary, live-import markers) used by
 * p4-08-independence-negative to prove the TeamDomain sidecar is
 * independent of any SessionEvent storage.
 *
 * This file is NOT a test file (no `.test.ts` suffix); it is imported by
 * the p4-01..p4-08 test files and type-checked with the package.
 * @module @dsh-agent-team/storage/test/p4-helpers
 */

import {
  LEGACY_TEAM_SESSION_EVENT_NAMES,
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { ChildSessionId, InstanceId, MemberInstanceRecordInput, RootSessionId, TeamSessionRecordInput } from '../../contracts/src/index.js'
import {
  TEAM_DOMAIN_SCHEMA_VERSION,
  TEAM_DOMAIN_STORES,
  UNIT_NAME_PATTERN,
  isTeamDomainError,
} from '../schema/index.js'
import type { StorageDomainHandle, StorageDomainSeam, StorageDomainSpec, StorageKvTable, TeamDomainError, TeamDomainStore } from '../schema/index.js'

/** A simulated crash between two TeamDomain writes (test-only). */
export class FakeCrashError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FakeCrashError'
  }
}

function seamError(code: string, message: string, details?: Record<string, unknown>): Error {
  const error = new Error(message) as Error & { code?: string; details?: Record<string, unknown> }
  error['code'] = code
  if (details !== undefined) error['details'] = details
  return error
}

function sameTableSet(a: Set<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false
  for (const table of b) {
    if (!a.has(table)) return false
  }
  return true
}

interface FakeUnit {
  readonly name: string
  version: number
  tables: Set<string>
  open: boolean
  chain: Promise<void>
  rows: Map<string, Map<string, unknown>>
}

export interface SeamWriteLogEntry {
  readonly domain: string
  readonly table: string
  readonly key: string
  readonly op: 'put' | 'delete' | 'update'
}

/**
 * In-memory StorageDomainSeam fake (the ONLY test double P4-T1 uses).
 */
export class InMemoryStorageSeam implements StorageDomainSeam {
  private readonly units = new Map<string, FakeUnit>()
  private writesDone = 0
  private crashAfter: number | null = null
  readonly writeLog: SeamWriteLogEntry[] = []
  readonly committed = new Map<string, Map<string, Map<string, string>>>()

  /** Arm a crash: the first `n` writes succeed, every later write crashes (sticky). */
  setCrashAfterWrites(n: number): void {
    this.crashAfter = n
  }

  /** Disarm the crash. */
  clearCrash(): void {
    this.crashAfter = null
  }

  /** The number of applied (durable) writes so far. */
  get writeCount(): number {
    return this.writesDone
  }

  /** Pre-seed a persisted domain at an explicit version/table set (for L1 mismatch tests). */
  seedDomainVersion(name: string, version: number, tables: readonly string[]): void {
    const unit = this.unitFor(name)
    unit.version = version
    unit.tables = new Set(tables)
    for (const table of tables) {
      if (unit.rows.get(table) === undefined) unit.rows.set(table, new Map())
    }
  }

  /** Pre-seed raw rows into a persisted (closed) domain table (corruption tests). */
  seedRows(name: string, table: string, rows: Record<string, unknown>): void {
    const unit = this.unitFor(name)
    if (!unit.tables.has(table)) throw new Error(`seedRows: table '${table}' is not declared on '${name}'`)
    let rowsMap = unit.rows.get(table)
    if (rowsMap === undefined) {
      rowsMap = new Map()
      unit.rows.set(table, rowsMap)
    }
    for (const [key, value] of Object.entries(rows)) rowsMap.set(key, value)
  }

  /** The live raw row map of one persisted table (byte-level corruption tests). */
  rawRows(name: string, table: string): Map<string, unknown> {
    const unit = this.units.get(name)
    if (unit === undefined) throw new Error(`rawRows: no persisted domain '${name}'`)
    const rowsMap = unit.rows.get(table)
    if (rowsMap === undefined) throw new Error(`rawRows: no table '${table}' on '${name}'`)
    return rowsMap
  }

  /** The durable (committed) rows recorded for one table. */
  committedRows(name: string, table: string): Map<string, string> {
    return this.committedFor(name, table)
  }

  private committedFor(name: string, table: string): Map<string, string> {
    let byTable = this.committed.get(name)
    if (byTable === undefined) {
      byTable = new Map()
      this.committed.set(name, byTable)
    }
    let byKey = byTable.get(table)
    if (byKey === undefined) {
      byKey = new Map()
      byTable.set(table, byKey)
    }
    return byKey
  }

  private unitFor(name: string): FakeUnit {
    let unit = this.units.get(name)
    if (unit === undefined) {
      unit = {
        name,
        version: TEAM_DOMAIN_SCHEMA_VERSION,
        tables: new Set(),
        open: false,
        chain: Promise.resolve(),
        rows: new Map(),
      }
      this.units.set(name, unit)
    }
    return unit
  }

  async open(spec: StorageDomainSpec): Promise<StorageDomainHandle> {
    if (!UNIT_NAME_PATTERN.test(spec.name)) {
      throw seamError('invalid-record', `domain name '${spec.name}' violates the unit-name rule`)
    }
    for (const table of spec.tables) {
      if (!UNIT_NAME_PATTERN.test(table)) {
        throw seamError('invalid-record', `table name '${table}' violates the unit-name rule`)
      }
    }
    const existing = this.units.get(spec.name)
    if (existing !== undefined && existing.open) {
      throw seamError('already-open', `domain '${spec.name}' is already open`)
    }
    if (existing !== undefined && existing.version !== spec.version) {
      throw seamError(
        'version-mismatch',
        `domain '${spec.name}' is persisted at schema version ${existing.version}; open requested ${spec.version}`,
        { found: existing.version, expected: spec.version },
      )
    }
    if (existing !== undefined && existing.version === spec.version && !sameTableSet(existing.tables, spec.tables)) {
      throw seamError(
        'malformed-medium',
        `domain '${spec.name}' was persisted with a different table set`,
        { found: [...existing.tables].sort(), expected: [...spec.tables].sort() },
      )
    }
    const unit = this.unitFor(spec.name)
    unit.version = spec.version
    unit.tables = new Set(spec.tables)
    for (const table of spec.tables) {
      if (unit.rows.get(table) === undefined) unit.rows.set(table, new Map())
    }
    unit.open = true
    return this.makeHandle(unit)
  }

  async closeAll(): Promise<void> {
    for (const unit of this.units.values()) unit.open = false
  }

  private makeHandle(unit: FakeUnit): StorageDomainHandle {
    return {
      name: unit.name,
      table: (name: string): StorageKvTable => {
        if (!unit.open) throw seamError('closed', `domain '${unit.name}' is closed`)
        if (!unit.tables.has(name)) throw seamError('invalid-table', `table '${name}' is not declared on '${unit.name}'`)
        let rows = unit.rows.get(name)
        if (rows === undefined) {
          rows = new Map()
          unit.rows.set(name, rows)
        }
        return this.makeTable(unit, name, rows)
      },
      close: (): Promise<void> => {
        unit.open = false
        return Promise.resolve()
      },
    }
  }

  private makeTable(unit: FakeUnit, tableName: string, rows: Map<string, unknown>): StorageKvTable {
    const checkOpen = (): void => {
      if (!unit.open) throw seamError('closed', `domain '${unit.name}' is closed`)
    }
    const chainWrite = (mutate: () => boolean): Promise<void> => {
      const task = unit.chain.then(() => {
        if (this.crashAfter !== null && this.writesDone >= this.crashAfter) {
          throw new FakeCrashError(`simulated crash: write ${this.writesDone + 1} (armed after ${this.crashAfter} committed writes)`)
        }
        const applied = mutate()
        if (applied) this.writesDone += 1
      })
      unit.chain = task.then(
        () => undefined,
        () => undefined,
      )
      return task
    }
    const committed = (): Map<string, string> => this.committedFor(unit.name, tableName)
    return {
      get: (key: string): unknown => {
        checkOpen()
        return rows.get(key)
      },
      entries: (): IterableIterator<[string, unknown]> => {
        checkOpen()
        return [...rows.entries()][Symbol.iterator]()
      },
      keys: (): IterableIterator<string> => {
        checkOpen()
        return [...rows.keys()][Symbol.iterator]()
      },
      get size(): number {
        checkOpen()
        return rows.size
      },
      put: (key: string, value: unknown): Promise<void> => {
        if (!unit.open) return Promise.reject(seamError('closed', `domain '${unit.name}' is closed`))
        return chainWrite(() => {
          rows.set(key, value)
          committed().set(key, String(value))
          this.writeLog.push({ domain: unit.name, table: tableName, key, op: 'put' })
          return true
        })
      },
      delete: (key: string): Promise<boolean> => {
        if (!unit.open) return Promise.reject(seamError('closed', `domain '${unit.name}' is closed`))
        let existed = false
        return chainWrite(() => {
          existed = rows.delete(key)
          if (existed) {
            committed().delete(key)
            this.writeLog.push({ domain: unit.name, table: tableName, key, op: 'delete' })
          }
          return existed
        }).then(() => existed)
      },
      update: (key: string, fn: (current: unknown) => unknown): Promise<unknown> => {
        if (!unit.open) return Promise.reject(seamError('closed', `domain '${unit.name}' is closed`))
        return chainWrite(() => {
          const current = rows.get(key)
          if (current === undefined) {
            throw seamError('missing-key', `update on '${unit.name}/${tableName}': key '${key}' is missing`)
          }
          const next = fn(current)
          rows.set(key, next)
          committed().set(key, String(next))
          this.writeLog.push({ domain: unit.name, table: tableName, key, op: 'update' })
          return true
        }).then(() => rows.get(key))
      },
    }
  }
}

/** The result of a captured operation (succeed or fail, never throw). */
export interface Captured<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: unknown
}

/** Capture an operation's outcome without throwing (the shim rejects async `it` bodies). */
export async function capture<T>(fn: () => Promise<T> | T): Promise<Captured<T>> {
  try {
    const value = await fn()
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error }
  }
}

/** Narrow an unknown error to a TeamDomainError (throws when not one). */
export function asTeamDomainError(error: unknown): TeamDomainError {
  if (!isTeamDomainError(error)) {
    throw new Error(`expected a TeamDomainError, got: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`)
  }
  return error
}

/** Read one details field of a TeamDomainError (undefined when absent). */
export function detail(error: TeamDomainError, name: string): unknown {
  return error.details !== undefined ? error.details[name] : undefined
}

/** The P4-T1 fixture identities (frozen contracts v1 branded ids). */
export const P4_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-1'),
  otherRootSessionId: parseRootSessionId('session-root-2'),
  childSessionId: parseChildSessionId('session-child-1'),
  secondChildSessionId: parseChildSessionId('session-child-2'),
  instanceId: parseInstanceId('inst-alpha'),
  secondInstanceId: parseInstanceId('inst-beta'),
  templateId: parseTemplateId('researcher'),
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('AIUED-ALGO'),
    revision: parseBlueprintRevision('17'),
    contentHash: parseBlueprintContentHash('sha256-0123456789abcdef0123456789abcdef'),
  }),
  createdAt: '2026-08-29T12:00:00Z',
}

/** A valid TeamSessionRecordInput fixture builder. */
export function teamSessionInput(rootSessionId: RootSessionId = P4_FIXTURE.rootSessionId, generation = 1): TeamSessionRecordInput {
  return {
    blueprint: P4_FIXTURE.blueprint,
    createdAt: P4_FIXTURE.createdAt,
    defaultWorkspace: 'C:/agent-team/work',
    generation,
    rootSessionId,
  }
}

/** A valid MemberInstanceRecordInput fixture builder. */
export function memberInstanceInput(
  rootSessionId: RootSessionId = P4_FIXTURE.rootSessionId,
  instanceId: InstanceId = P4_FIXTURE.instanceId,
  childSessionId: ChildSessionId = P4_FIXTURE.childSessionId,
  activityVersion = 1,
): MemberInstanceRecordInput {
  return {
    activityVersion,
    childSessionId,
    createdAt: P4_FIXTURE.createdAt,
    groupId: 'grp-research',
    instanceId,
    label: 'alpha-researcher',
    lifecycle: 'CREATED',
    rootSessionId,
    templateId: P4_FIXTURE.templateId,
    workspace: 'C:/agent-team/work/alpha',
  }
}

/** A plain team-member binding record (input to parseSessionBinding). */
export function teamMemberBinding(rootSessionId: string, instanceId: string, sessionId: string): Record<string, unknown> {
  return { instanceId, kind: 'team-member', rootSessionId, schemaVersion: 1, sessionId }
}

/** A plain team-root binding record. */
export function teamRootBinding(sessionId: string): Record<string, unknown> {
  return { kind: 'team-root', schemaVersion: 1, sessionId }
}

/** A plain ordinary binding record. */
export function ordinaryBinding(sessionId: string): Record<string, unknown> {
  return { kind: 'ordinary', schemaVersion: 1, sessionId }
}

/** A plain human-override (team scope) record. */
export function humanOverrideTeam(rootSessionId: string, recordId = 'ov-team-1'): Record<string, unknown> {
  return {
    generation: 1,
    kind: 'human-override',
    recordId,
    rootSessionId,
    schemaVersion: 1,
    scope: 'team',
    updatedAt: P4_FIXTURE.createdAt,
    values: { autonomy: 'guarded' },
  }
}

/** A plain autonomy-overlay (instance scope) record. */
export function autonomyOverlayInstance(
  rootSessionId: string,
  instanceId: string,
  origin: string,
  recordId = 'ol-inst-1',
): Record<string, unknown> {
  return {
    generation: 1,
    instanceId,
    kind: 'autonomy-overlay',
    origin,
    recordId,
    rootSessionId,
    schemaVersion: 1,
    scope: 'instance',
    updatedAt: P4_FIXTURE.createdAt,
    values: { autonomy: 'full' },
  }
}

/** A plain compatibility state record (OPEN, with the given acknowledgements). */
export function compatibilityState(
  rootSessionId: string,
  options: { status?: string; acknowledgements?: unknown[] } = {},
): Record<string, unknown> {
  return {
    acknowledgements: options.acknowledgements ?? [],
    computedAt: P4_FIXTURE.createdAt,
    fingerprint: 'fp-env-0001',
    generation: 1,
    outcomes: { 'req.autonomy-boundary': 'PASS' },
    rootSessionId,
    schemaVersion: 1,
    status: options.status ?? 'OPEN',
  }
}

/** A plain compatibility acknowledgement record. */
export function compatibilityAcknowledgement(requirementId = 'req.autonomy-boundary', note?: string): Record<string, unknown> {
  const record: Record<string, unknown> = {
    acknowledgedAt: P4_FIXTURE.createdAt,
    acknowledgedBy: 'human-ops-1',
    environmentFingerprint: 'fp-env-0001',
    mismatchFingerprint: 'fp-mismatch-0001',
    requirementId,
  }
  if (note !== undefined) record['note'] = note
  return record
}

/** A plain operation record (PREPARED by default). */
export function operationRecord(
  operationId: string,
  idempotencyKey: string,
  options: { generation?: number; phase?: string; childSessionId?: string; failureDiagnostic?: string } = {},
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    generation: options.generation ?? 1,
    idempotencyKey,
    intent: { payload: { note: 'fixture' }, type: 'create-member-instance' },
    operationId,
    phase: options.phase ?? 'PREPARED',
    schemaVersion: 1,
    updatedAt: P4_FIXTURE.createdAt,
  }
  if (options.childSessionId !== undefined) record['childSessionId'] = options.childSessionId
  if (options.failureDiagnostic !== undefined) record['failureDiagnostic'] = options.failureDiagnostic
  return record
}

/** A plain ledger entry record. */
export function ledgerEntryRecord(
  sequence: number,
  rootSessionId: string,
  options: { factType?: string; operationId?: string; payload?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    createdAt: P4_FIXTURE.createdAt,
    factType: options.factType ?? 'member-created',
    payload: options.payload ?? { note: 'fixture' },
    rootSessionId,
    schemaVersion: 1,
    sequence,
  }
  if (options.operationId !== undefined) record['operationId'] = options.operationId
  return record
}

/* ------------------------------------------------------------------------
 * P4-T1 import-closure data (the SessionEvent-independence evidence).
 *
 * The closure is declared as DATA (module ids + edge targets + raw
 * specifiers exactly as written in the sources) and checked for
 * self-consistency by p4-08-independence-negative: BFS size pinned,
 * edge targets known, banned path segments absent, zero bare
 * (non-relative) specifiers, and none of the frozen legacy Team
 * SessionEvent names appearing anywhere in the closure.
 * ------------------------------------------------------------------------ */

/** The 22 P4-T1 production modules (relative to `packages/storage`). */
export const P4_PRODUCTION_MODULES: readonly string[] = [
  'schema/seam.ts',
  'schema/errors.ts',
  'schema/stores.ts',
  'schema/version-policy.ts',
  'schema/field-rules.ts',
  'schema/schema-meta.ts',
  'schema/override.ts',
  'schema/compatibility.ts',
  'schema/operation.ts',
  'schema/ledger.ts',
  'schema/index.ts',
  'repositories/base.ts',
  'repositories/schema-meta.ts',
  'repositories/team-sessions.ts',
  'repositories/member-instances.ts',
  'repositories/session-bindings.ts',
  'repositories/overrides.ts',
  'repositories/compatibility.ts',
  'repositories/operations.ts',
  'repositories/ledger.ts',
  'repositories/team-domain.ts',
  'repositories/index.ts',
]

/** The 18 frozen contracts v1 modules (repo-relative canonical ids). */
export const P4_CONTRACT_MODULES: readonly string[] = [
  'packages/contracts/src/index.js',
  'packages/contracts/src/errors.js',
  'packages/contracts/src/identity.js',
  'packages/contracts/src/legacy-vocabulary.js',
  'packages/contracts/src/remote-safe.js',
  'packages/contracts/src/schema-version.js',
  'packages/contracts/src/uniqueness.js',
  'packages/contracts/src/dto/blueprint-snapshot.js',
  'packages/contracts/src/dto/common.js',
  'packages/contracts/src/dto/member-instance-record.js',
  'packages/contracts/src/dto/session-binding.js',
  'packages/contracts/src/dto/team-session-record.js',
  'packages/contracts/src/ids/blueprint-id.js',
  'packages/contracts/src/ids/brand.js',
  'packages/contracts/src/ids/common.js',
  'packages/contracts/src/ids/instance-id.js',
  'packages/contracts/src/ids/session-id.js',
  'packages/contracts/src/ids/template-id.js',
]

/**
 * Import-edge targets (canonical module ids) for every closure module.
 * Production edges point at other production modules (relative ids) or
 * frozen contracts modules (repo-relative ids); contracts edges point at
 * other contracts modules.
 */
export const P4_IMPORT_EDGE_TARGETS: Record<string, readonly string[]> = {
  /* storage/schema */
  'schema/seam.ts': [],
  'schema/errors.ts': ['packages/contracts/src/index.js'],
  'schema/stores.ts': ['schema/errors.ts', 'schema/seam.ts'],
  'schema/version-policy.ts': ['packages/contracts/src/index.js', 'schema/errors.ts', 'schema/stores.ts'],
  'schema/field-rules.ts': ['packages/contracts/src/ids/common.js', 'schema/errors.ts'],
  'schema/schema-meta.ts': [
    'packages/contracts/src/index.js',
    'packages/contracts/src/dto/common.js',
    'schema/errors.ts',
    'schema/stores.ts',
    'schema/version-policy.ts',
  ],
  'schema/override.ts': [
    'packages/contracts/src/index.js',
    'packages/contracts/src/dto/common.js',
    'schema/errors.ts',
    'schema/field-rules.ts',
    'schema/stores.ts',
  ],
  'schema/compatibility.ts': [
    'packages/contracts/src/index.js',
    'packages/contracts/src/dto/common.js',
    'schema/errors.ts',
    'schema/field-rules.ts',
    'schema/stores.ts',
  ],
  'schema/operation.ts': [
    'packages/contracts/src/index.js',
    'packages/contracts/src/dto/common.js',
    'schema/errors.ts',
    'schema/field-rules.ts',
    'schema/stores.ts',
  ],
  'schema/ledger.ts': [
    'packages/contracts/src/index.js',
    'packages/contracts/src/dto/common.js',
    'schema/errors.ts',
    'schema/field-rules.ts',
    'schema/operation.ts',
    'schema/stores.ts',
  ],
  'schema/index.ts': [
    'schema/seam.ts',
    'schema/stores.ts',
    'schema/errors.ts',
    'schema/version-policy.ts',
    'schema/field-rules.ts',
    'schema/schema-meta.ts',
    'schema/override.ts',
    'schema/compatibility.ts',
    'schema/operation.ts',
    'schema/ledger.ts',
  ],
  /* storage/repositories */
  'repositories/base.ts': ['packages/contracts/src/index.js', 'schema/index.ts'],
  'repositories/schema-meta.ts': ['schema/index.ts', 'repositories/base.ts'],
  'repositories/team-sessions.ts': ['packages/contracts/src/index.js', 'schema/index.ts', 'repositories/base.ts'],
  'repositories/member-instances.ts': ['packages/contracts/src/index.js', 'schema/index.ts', 'repositories/base.ts'],
  'repositories/session-bindings.ts': ['packages/contracts/src/index.js', 'schema/index.ts', 'repositories/base.ts'],
  'repositories/overrides.ts': ['packages/contracts/src/index.js', 'schema/index.ts', 'repositories/base.ts'],
  'repositories/compatibility.ts': ['packages/contracts/src/index.js', 'schema/index.ts', 'repositories/base.ts'],
  'repositories/operations.ts': ['schema/index.ts', 'repositories/base.ts'],
  'repositories/ledger.ts': ['schema/index.ts', 'repositories/base.ts'],
  'repositories/team-domain.ts': [
    'packages/contracts/src/index.js',
    'schema/index.ts',
    'repositories/compatibility.ts',
    'repositories/ledger.ts',
    'repositories/member-instances.ts',
    'repositories/operations.ts',
    'repositories/overrides.ts',
    'repositories/schema-meta.ts',
    'repositories/session-bindings.ts',
    'repositories/team-sessions.ts',
  ],
  'repositories/index.ts': [
    'repositories/base.ts',
    'repositories/schema-meta.ts',
    'repositories/team-sessions.ts',
    'repositories/member-instances.ts',
    'repositories/session-bindings.ts',
    'repositories/overrides.ts',
    'repositories/compatibility.ts',
    'repositories/operations.ts',
    'repositories/ledger.ts',
    'repositories/team-domain.ts',
  ],
  /* contracts (frozen v1) */
  'packages/contracts/src/index.js': [
    'packages/contracts/src/dto/blueprint-snapshot.js',
    'packages/contracts/src/dto/member-instance-record.js',
    'packages/contracts/src/dto/session-binding.js',
    'packages/contracts/src/dto/team-session-record.js',
    'packages/contracts/src/errors.js',
    'packages/contracts/src/identity.js',
    'packages/contracts/src/ids/blueprint-id.js',
    'packages/contracts/src/ids/instance-id.js',
    'packages/contracts/src/ids/session-id.js',
    'packages/contracts/src/ids/template-id.js',
    'packages/contracts/src/legacy-vocabulary.js',
    'packages/contracts/src/remote-safe.js',
    'packages/contracts/src/schema-version.js',
    'packages/contracts/src/uniqueness.js',
  ],
  'packages/contracts/src/errors.js': ['packages/contracts/src/remote-safe.js'],
  'packages/contracts/src/identity.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/instance-id.js',
    'packages/contracts/src/ids/session-id.js',
    'packages/contracts/src/remote-safe.js',
  ],
  'packages/contracts/src/legacy-vocabulary.js': ['packages/contracts/src/errors.js', 'packages/contracts/src/remote-safe.js'],
  'packages/contracts/src/remote-safe.js': ['packages/contracts/src/errors.js'],
  'packages/contracts/src/schema-version.js': ['packages/contracts/src/errors.js', 'packages/contracts/src/remote-safe.js'],
  'packages/contracts/src/uniqueness.js': [
    'packages/contracts/src/dto/member-instance-record.js',
    'packages/contracts/src/dto/session-binding.js',
    'packages/contracts/src/dto/team-session-record.js',
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/instance-id.js',
    'packages/contracts/src/ids/session-id.js',
  ],
  'packages/contracts/src/dto/blueprint-snapshot.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/blueprint-id.js',
    'packages/contracts/src/legacy-vocabulary.js',
    'packages/contracts/src/remote-safe.js',
    'packages/contracts/src/dto/common.js',
  ],
  'packages/contracts/src/dto/common.js': ['packages/contracts/src/errors.js', 'packages/contracts/src/remote-safe.js'],
  'packages/contracts/src/dto/member-instance-record.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/identity.js',
    'packages/contracts/src/ids/common.js',
    'packages/contracts/src/ids/instance-id.js',
    'packages/contracts/src/ids/session-id.js',
    'packages/contracts/src/ids/template-id.js',
    'packages/contracts/src/legacy-vocabulary.js',
    'packages/contracts/src/remote-safe.js',
    'packages/contracts/src/schema-version.js',
    'packages/contracts/src/dto/common.js',
  ],
  'packages/contracts/src/dto/session-binding.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/instance-id.js',
    'packages/contracts/src/ids/session-id.js',
    'packages/contracts/src/legacy-vocabulary.js',
    'packages/contracts/src/remote-safe.js',
    'packages/contracts/src/schema-version.js',
    'packages/contracts/src/dto/common.js',
  ],
  'packages/contracts/src/dto/team-session-record.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/common.js',
    'packages/contracts/src/ids/session-id.js',
    'packages/contracts/src/legacy-vocabulary.js',
    'packages/contracts/src/remote-safe.js',
    'packages/contracts/src/schema-version.js',
    'packages/contracts/src/dto/blueprint-snapshot.js',
    'packages/contracts/src/dto/common.js',
  ],
  'packages/contracts/src/ids/blueprint-id.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/brand.js',
    'packages/contracts/src/ids/common.js',
  ],
  'packages/contracts/src/ids/brand.js': [],
  'packages/contracts/src/ids/common.js': ['packages/contracts/src/errors.js', 'packages/contracts/src/remote-safe.js'],
  'packages/contracts/src/ids/instance-id.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/brand.js',
    'packages/contracts/src/ids/common.js',
  ],
  'packages/contracts/src/ids/session-id.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/brand.js',
    'packages/contracts/src/ids/common.js',
  ],
  'packages/contracts/src/ids/template-id.js': [
    'packages/contracts/src/errors.js',
    'packages/contracts/src/ids/brand.js',
    'packages/contracts/src/ids/common.js',
  ],
}

/**
 * The raw import specifiers exactly as written in the 22 production
 * module sources (for the banned-vocabulary and bare-specifier scans).
 */
export const P4_RAW_SPECIFIERS: Record<string, readonly string[]> = {
  'schema/seam.ts': [],
  'schema/errors.ts': ['../../contracts/src/index.js'],
  'schema/stores.ts': ['./errors.js', './seam.js'],
  'schema/version-policy.ts': ['../../contracts/src/index.js', './errors.js', './stores.js'],
  'schema/field-rules.ts': ['../../contracts/src/ids/common.js', './errors.js'],
  'schema/schema-meta.ts': [
    '../../contracts/src/index.js',
    '../../contracts/src/dto/common.js',
    './errors.js',
    './stores.js',
    './version-policy.js',
  ],
  'schema/override.ts': [
    '../../contracts/src/index.js',
    '../../contracts/src/dto/common.js',
    './errors.js',
    './field-rules.js',
    './stores.js',
  ],
  'schema/compatibility.ts': [
    '../../contracts/src/index.js',
    '../../contracts/src/dto/common.js',
    './errors.js',
    './field-rules.js',
    './stores.js',
  ],
  'schema/operation.ts': [
    '../../contracts/src/index.js',
    '../../contracts/src/dto/common.js',
    './errors.js',
    './field-rules.js',
    './stores.js',
  ],
  'schema/ledger.ts': [
    '../../contracts/src/index.js',
    '../../contracts/src/dto/common.js',
    './errors.js',
    './field-rules.js',
    './operation.js',
    './stores.js',
  ],
  'schema/index.ts': [
    './seam.js',
    './stores.js',
    './errors.js',
    './version-policy.js',
    './field-rules.js',
    './schema-meta.js',
    './override.js',
    './compatibility.js',
    './operation.js',
    './ledger.js',
  ],
  'repositories/base.ts': ['../schema/index.js', '../../contracts/src/index.js'],
  'repositories/schema-meta.ts': ['../schema/index.js', './base.js'],
  'repositories/team-sessions.ts': ['../../contracts/src/index.js', '../schema/index.js', './base.js'],
  'repositories/member-instances.ts': ['../../contracts/src/index.js', '../schema/index.js', './base.js'],
  'repositories/session-bindings.ts': ['../../contracts/src/index.js', '../schema/index.js', './base.js'],
  'repositories/overrides.ts': ['../../contracts/src/index.js', '../schema/index.js', './base.js'],
  'repositories/compatibility.ts': ['../../contracts/src/index.js', '../schema/index.js', './base.js'],
  'repositories/operations.ts': ['../schema/index.js', './base.js'],
  'repositories/ledger.ts': ['../schema/index.js', './base.js'],
  'repositories/team-domain.ts': [
    '../../contracts/src/index.js',
    '../schema/index.js',
    './compatibility.js',
    './ledger.js',
    './member-instances.js',
    './operations.js',
    './overrides.js',
    './schema-meta.js',
    './session-bindings.js',
    './team-sessions.js',
  ],
  'repositories/index.ts': [
    './base.js',
    './schema-meta.js',
    './team-sessions.js',
    './member-instances.js',
    './session-bindings.js',
    './overrides.js',
    './compatibility.js',
    './operations.js',
    './ledger.js',
    './team-domain.js',
  ],
}

/** Path segments banned anywhere in the closure (exact segment match). */
export const P4_BANNED_PATH_SEGMENTS: readonly string[] = [
  'references',
  'deepseek-harness',
  'session-event',
  'session_event',
  'sessionevent',
  'legacy',
  'runtime',
  'tools',
  'remote',
  'client',
  'upstream',
  'agent',
  'team',
]

/** Substrings banned anywhere in a closure specifier (repo/legacy leakage). */
export const P4_BANNED_SUBSTRINGS: readonly string[] = ['dsh-agent-team']

/** The pinned size of the P4-T1 import closure (22 production + 18 contracts). */
export const P4_EXPECTED_CLOSURE_SIZE = 40

/** One live-import marker: a module and the export that proves it is the real thing. */
export interface P4LiveImportMarker {
  readonly module: string
  readonly exportName: string
}

/** Live-import markers for the 22 production modules (relative to `packages/storage/test`). */
export const P4_LIVE_IMPORT_MARKERS: readonly P4LiveImportMarker[] = [
  { module: '../schema/seam.js', exportName: 'isStorageDomainSeam' },
  { module: '../schema/stores.js', exportName: 'TEAM_DOMAIN_STORES' },
  { module: '../schema/errors.js', exportName: 'TeamDomainError' },
  { module: '../schema/version-policy.js', exportName: 'assertSupportedTeamDomainSchemaVersion' },
  { module: '../schema/field-rules.js', exportName: 'assertHygienicStringField' },
  { module: '../schema/schema-meta.js', exportName: 'parseSchemaMetaStamp' },
  { module: '../schema/override.js', exportName: 'parseGovernanceOverride' },
  { module: '../schema/compatibility.js', exportName: 'parseCompatibilityState' },
  { module: '../schema/operation.js', exportName: 'parseOperationRecord' },
  { module: '../schema/ledger.js', exportName: 'parseLedgerEntry' },
  { module: '../schema/index.js', exportName: 'TEAM_DOMAIN_NAME' },
  { module: '../repositories/base.js', exportName: 'BaseRepository' },
  { module: '../repositories/schema-meta.js', exportName: 'SchemaMetaRepository' },
  { module: '../repositories/team-sessions.js', exportName: 'TeamSessionsRepository' },
  { module: '../repositories/member-instances.js', exportName: 'MemberInstancesRepository' },
  { module: '../repositories/session-bindings.js', exportName: 'SessionBindingsRepository' },
  { module: '../repositories/overrides.js', exportName: 'OverridesRepository' },
  { module: '../repositories/compatibility.js', exportName: 'CompatibilityRepository' },
  { module: '../repositories/operations.js', exportName: 'OperationsRepository' },
  { module: '../repositories/ledger.js', exportName: 'LedgerRepository' },
  { module: '../repositories/team-domain.js', exportName: 'createTeamDomain' },
  { module: '../repositories/index.js', exportName: 'openTeamDomain' },
]

/** The frozen legacy Team SessionEvent names (detection vocabulary, imported — never re-typed). */
export const P4_LEGACY_EVENT_NAMES: readonly string[] = [...LEGACY_TEAM_SESSION_EVENT_NAMES]

/** The eight store names, re-exported for test convenience (canonical order). */
export const P4_STORES: readonly TeamDomainStore[] = [...TEAM_DOMAIN_STORES]

/**
 * Compute the import closure over P4_IMPORT_EDGE_TARGETS starting from the
 * 22 production modules (BFS; every edge target must be a known module).
 * @returns the sorted closure (production + reachable contracts modules).
 * @throws when an edge target is not a known module id (self-consistency).
 */
export function computeP4Closure(): string[] {
  const known = new Set<string>([...P4_PRODUCTION_MODULES, ...P4_CONTRACT_MODULES])
  const seen = new Set<string>()
  const stack: string[] = [...P4_PRODUCTION_MODULES]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined || seen.has(current)) continue
    seen.add(current)
    const targets = P4_IMPORT_EDGE_TARGETS[current]
    if (targets !== undefined) {
      for (const target of targets) {
        if (!known.has(target)) throw new Error(`closure self-consistency: unknown edge target '${target}' of '${current}'`)
        if (!seen.has(target)) stack.push(target)
      }
    }
  }
  return [...seen].sort()
}
