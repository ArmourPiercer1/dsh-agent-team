/**
 * Typed output value mirrors of the Remote contract v1.
 *
 * These are the `data` shapes the dispatcher wraps in the success result.
 * They mirror — at the value level (deviation D-1) — the durable DTOs and
 * service results the backing ports return (design note §3 table, "Output
 * value (data)"). Deep validation is deliberately NOT repeated here (D-4):
 * the backing services own their invariants; the remote layer (a) checks
 * the top-level shape of the whole-projection DTO, (b) normalizes closed
 * wire fields (e.g. ledger `operationId` → `string | null`), and (c)
 * lossless-JSON-checks every value before the reply is built.
 *
 * `RemoteSafeRecord` marks "a lossless-JSON-checked value whose deep shape
 * is owned by the backing service".
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/contracts/types
 */

import type { RemoteSafeRecord } from './remote-safe.js'

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------

/** `catalog.list` value: `{ blueprints: [{ blueprintId, revisions }] }`. */
export interface RemoteCatalogListValue {
  readonly blueprints: readonly RemoteSafeRecord[]
}

/** `catalog.get` value: `{ blueprint: <resolved TeamBlueprint> }`. */
export interface RemoteCatalogGetValue {
  readonly blueprint: RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// intent
// ---------------------------------------------------------------------------

/** `intent.probe` value: `{ compatibility: <CompatibilityResult> }`. */
export interface RemoteIntentProbeValue {
  readonly compatibility: RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// team
// ---------------------------------------------------------------------------

/** The root-binding path of a `team.create` outcome (P5-T5). */
export type RemoteTeamCreatePath = 'fresh-root' | 'cold-root'

/**
 * `team.create` value: `{ path, durable, bind }` — the root-binding result
 * (`RootBindingDurableState` | null + the bind result).
 */
export interface RemoteTeamCreateValue {
  readonly path: RemoteTeamCreatePath
  readonly durable: RemoteSafeRecord | null
  readonly bind: RemoteSafeRecord
}

/**
 * The whole-projection value — the exact P8-T1 `TeamProjectionDto` (v1)
 * mirrored at the value level: the nine frozen top-level fields
 * (`TEAM_PROJECTION_FIELDS`), nested values pass-through (D-4).
 */
export interface RemoteProjectionValue {
  /** The projection schema version; v1 projections carry `1`. */
  readonly schemaVersion: number
  /** The TeamSession id — which IS the root DSH session id (invariant 9). */
  readonly teamSessionId: string
  /** The immutable blueprint snapshot the TeamSession binds. */
  readonly blueprint: RemoteSafeRecord
  /** The whole-projection monotonic generation (>= 1). */
  readonly generation: number
  /** Projection creation time, ISO-8601. */
  readonly generatedAt: string
  /** The root (TeamSession + TeamDomain) projection. */
  readonly root: RemoteSafeRecord
  /** The member template projections (ordered). */
  readonly templates: readonly RemoteSafeRecord[]
  /** The member instance projections (ordered). */
  readonly members: readonly RemoteSafeRecord[]
  /** The ledger summary (frozen `LedgerSummaryDto` shape). */
  readonly ledger: RemoteSafeRecord
}

/** `team.getProjection` value: `{ projection }`. */
export interface RemoteTeamGetProjectionValue {
  readonly projection: RemoteProjectionValue
}

/**
 * One durable ledger fact row (the storage `LedgerEntry` mirror, closed
 * wire shape: `operationId` is `string | null`, never absent).
 */
export interface RemoteLedgerEntryValue {
  readonly schemaVersion: number
  readonly sequence: number
  readonly rootSessionId: string
  readonly factType: string
  readonly payload: RemoteSafeRecord
  readonly operationId: string | null
  readonly createdAt: string
}

/**
 * `team.getLedgerPage` value — remote-level pagination (deviation D-5):
 * a stable page of ledger entries after `afterSequence` with the cursor
 * for the next page.
 */
export interface RemoteLedgerPageValue {
  readonly entries: readonly RemoteLedgerEntryValue[]
  /** The last included sequence (cursor for the next page) or `null`. */
  readonly nextAfterSequence: number | null
  /** The total fact-entry count of the ledger. */
  readonly total: number
}

// ---------------------------------------------------------------------------
// member
// ---------------------------------------------------------------------------

/**
 * The admission outcome value (the P6-T2 `TeamRuntimeActionOutcome`
 * mirror, closed wire shape).
 */
export interface RemoteAdmissionOutcomeValue {
  readonly status: 'executed'
  readonly action: string
  readonly rootSessionId: string
  readonly callerRole: string
  readonly targetInstanceId: string | null
  readonly effect: RemoteSafeRecord
  readonly requestToken: string
}

/** `member.create` / `member.send` / `member.followup` value. */
export interface RemoteMemberOutcomeValue {
  readonly outcome: RemoteAdmissionOutcomeValue
}

/** `member.archive` value (the P7-T3 `ArchiveMemberResult` mirror). */
export interface RemoteMemberArchiveValue {
  readonly member: RemoteSafeRecord
  readonly steps: readonly RemoteSafeRecord[]
  readonly settledCommitted: boolean
  readonly drained: boolean
  readonly residencyDropped: boolean
}

/** `member.restore` value (the P7-T3 `RestoreMemberResult` mirror). */
export interface RemoteMemberRestoreValue {
  readonly member: RemoteSafeRecord
  readonly steps: readonly RemoteSafeRecord[]
}

/** `member.dispose` value (the P7-T3 `DisposeMemberResult` mirror). */
export interface RemoteMemberDisposeValue {
  readonly member: RemoteSafeRecord
  readonly steps: readonly RemoteSafeRecord[]
  readonly drained: boolean
  readonly residencyDropped: boolean
}

// ---------------------------------------------------------------------------
// override
// ---------------------------------------------------------------------------

/** `override.get` value: the stored record for the addressed cell or null. */
export interface RemoteOverrideGetValue {
  readonly override: RemoteSafeRecord | null
}

/** `override.set` value: the durable stored mutation record. */
export interface RemoteOverrideSetValue {
  readonly record: RemoteSafeRecord
}

/** `override.reset` value: whether a record was revoked. */
export interface RemoteOverrideResetValue {
  readonly removed: boolean
}

// ---------------------------------------------------------------------------
// policyState
// ---------------------------------------------------------------------------

/** `policyState.get` value: the current policy state view. */
export interface RemotePolicyStateGetValue {
  readonly state: RemoteSafeRecord
}

/** `policyState.set` value: the durable policy-state transition record. */
export interface RemotePolicyStateSetValue {
  readonly transition: RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// compatibility
// ---------------------------------------------------------------------------

/** `compatibility.get` value: the current compatibility verdict. */
export interface RemoteCompatibilityGetValue {
  readonly verdict: RemoteSafeRecord
}

/** `compatibility.ack` value: the verdict after the ack. */
export interface RemoteCompatibilityAckValue {
  readonly verdict: RemoteSafeRecord
}

/** `compatibility.reprobe` value: the fresh probe outcome (with trigger). */
export interface RemoteCompatibilityReprobeValue {
  readonly probe: RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// handoff
// ---------------------------------------------------------------------------

/**
 * `handoff.prepare` value — the read-only source-surface summary (deviation
 * D-6): what a handoff would freeze, without any durable write.
 */
export interface RemoteHandoffPrepareValue {
  readonly summary: RemoteSafeRecord
  readonly sourceSessionId: string
}

/**
 * `handoff.create` value: the closed `HandoffOperationState` union (always
 * carries `replayed`).
 */
export interface RemoteHandoffCreateValue {
  readonly state: RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// legacy
// ---------------------------------------------------------------------------

/**
 * `legacy.inspect` value: the closed `LegacyTeamInspection` union
 * (`status: 'legacy-team' | 'native-fallback'`).
 */
export interface RemoteLegacyInspectValue {
  readonly inspection: RemoteSafeRecord
}

// ---------------------------------------------------------------------------
// Provenance helpers (shared by the handler modules)
// ---------------------------------------------------------------------------

/** The top-level fields of the P8-T1 whole-projection DTO (mirror). */
export const REMOTE_PROJECTION_FIELDS: readonly string[] = [
  'blueprint',
  'generation',
  'generatedAt',
  'ledger',
  'members',
  'root',
  'schemaVersion',
  'teamSessionId',
  'templates',
]

/** The top-level fields of the storage `LedgerEntry` (mirror). */
export const REMOTE_LEDGER_ENTRY_FIELDS: readonly string[] = [
  'createdAt',
  'factType',
  'operationId',
  'payload',
  'rootSessionId',
  'schemaVersion',
  'sequence',
]
