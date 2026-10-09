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

/**
 * The contract-v6 whole-projection value: the nine frozen v1 fields PLUS
 * the two additive freshness fields (team-view-sync-complete, Phase 2
 * frozen decisions):
 *
 * - `durableGeneration` — the DURABLE whole-projection generation, always
 *   equal to `generation` (named explicitly so the client freshness
 *   identity reads as the frozen PAIR `{ durableGeneration, liveToken }`);
 * - `liveToken` — a deterministic opaque string over the SEMANTIC live
 *   state (the sorted per-member `{ instanceId, residency }` pairs;
 *   `lastActivityAt`/`now()`/`generatedAt` are EXCLUDED) — it changes only
 *   when the semantic live state changes, never on host restart bookkeeping
 *   alone, and is NEVER folded into the durable generation.
 *
 * Contract versions <= 5 keep serving the exact frozen
 * {@link RemoteProjectionValue} shape (the v6 fields are absent on the
 * wire; v1-v5 are unchanged).
 */
export interface RemoteProjectionValueV6 extends RemoteProjectionValue {
  /** The durable whole-projection generation (always `=== generation`). */
  readonly durableGeneration: number
  /** The deterministic opaque semantic-live-state token (non-empty). */
  readonly liveToken: string
}

/** `team.getProjection` value: `{ projection }`. */
export interface RemoteTeamGetProjectionValue {
  readonly projection: RemoteProjectionValue
}

/**
 * `team.getReadState` value (contract v6, v6-only method): the
 * authoritative per-session read-state answer over the host's durable
 * TeamDomain rows (the frozen closed wire shape):
 *
 * - `relation` — `team-root` (the session IS a TeamSession root),
 *   `team-member` (the session is a member's bound child session — a
 *   DISPOSED member still resolves here, marked `disposed`), or `none`
 *   (only a successful read that positively confirms no affiliation may
 *   answer `none`; every storage/integrity failure fails CLOSED with a
 *   typed error instead);
 * - `teamSessionId` — the owning TeamSession id (null for `none`);
 * - `memberInstanceId` — the owning member instance (null unless
 *   `team-member`);
 * - `disposed` — true only for a `team-member` whose durable lifecycle is
 *   the terminal `DISPOSED` state;
 * - `durableGeneration` — the owning TeamSession's durable generation
 *   (null for `none`);
 * - `liveToken` — the owning TeamSession's deterministic
 *   semantic-live-state token (the SAME token source as the v6
 *   projection's `liveToken` cell; PR #35 follow-up: the read-state
 *   is the lightweight probe and must detect live-only changes
 *   WITHOUT a full projection pull). `null` only for `none`; a team
 *   relation carries a non-empty `lt-v1-*` string or the host fails
 *   the read typed (never a team relation with a null token).
 */
/** The team-root read-state answer (the session IS a TeamSession root).
 *  Fully closed: every cell present, null cells typed (the wire JSON is
 *  the same flat object for every relation; the DISCRIMINATED union
 *  shape is a type-level refinement — PR #35 follow-up — that lets the
 *  producers/consumers narrow on `relation` without casts). */
export interface RemoteTeamGetReadStateTeamRootValue {
  readonly relation: 'team-root'
  readonly teamSessionId: string
  readonly memberInstanceId: null
  readonly disposed: false
  readonly durableGeneration: number
  /** The owning TeamSession's deterministic semantic-live-state token —
   *  the SAME token source as the v6 projection's `liveToken` cell
   *  (PR #35 follow-up: the read-state is the LIGHTWEIGHT probe, so it
   *  must carry the token or the client could not detect a live-only
   *  change without a full projection pull). Non-empty `lt-v1-*`; a
   *  host that cannot compute the token fails the read typed. */
  readonly liveToken: string
}

/** The team-member read-state answer (the session is a member's bound
 *  child session; a DISPOSED member still resolves here, marked
 *  `disposed`). */
export interface RemoteTeamGetReadStateTeamMemberValue {
  readonly relation: 'team-member'
  readonly teamSessionId: string
  readonly memberInstanceId: string
  readonly disposed: boolean
  readonly durableGeneration: number
  /** Same contract as the team-root token (non-empty `lt-v1-*`). */
  readonly liveToken: string
}

/** The confirmed-`none` read-state answer: a successful read that
 *  positively confirmed no team affiliation (every failure fails CLOSED
 *  with a typed error instead — never a `none`). */
export interface RemoteTeamGetReadStateNoneValue {
  readonly relation: 'none'
  readonly teamSessionId: null
  readonly memberInstanceId: null
  readonly disposed: false
  readonly durableGeneration: null
  /** Always null: there is no owning TeamSession whose live state to
   *  token. */
  readonly liveToken: null
}

/** The CLOSED v6 `team.getReadState` wire value (the discriminated
 *  union of the three relation answers; the JSON is the flat closed
 *  object in every case — the field set is enforced by the handler's
 *  closed-shape validation, not by the type). */
export type RemoteTeamGetReadStateValue =
  | RemoteTeamGetReadStateTeamRootValue
  | RemoteTeamGetReadStateTeamMemberValue
  | RemoteTeamGetReadStateNoneValue

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

/**
 * The top-level fields of the contract-v6 whole-projection value: the nine
 * frozen v1 fields plus the two additive v6 freshness fields
 * (`durableGeneration`, `liveToken`).
 */
export const REMOTE_PROJECTION_FIELDS_V6: readonly string[] = [
  ...REMOTE_PROJECTION_FIELDS,
  'durableGeneration',
  'liveToken',
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

// ---------------------------------------------------------------------------
// A4-PR6 §6.B — contract v8 wire DTOs (the closed intervention-plane shapes)
// ---------------------------------------------------------------------------

/**
 * The closed authority-ladder position cell (mirror of the runtime
 * `PROPOSAL_AUTHORITY_POSITIONS`; the ordering law is NOT mirrored — the
 * wire carries a position NAME, never a rank, and every comparison is
 * server-side).
 */
export const REMOTE_INTERVENTION_AUTHORITY_POSITIONS: readonly string[] = [
  'member',
  'leader',
  'human-user',
  'human-admin',
]

/** The closed `source` object of an intervention item (mirror of PR3). */
export interface RemoteInterventionWireSource {
  readonly kind: 'control-case' | 'governance-warning' | 'compatibility'
  readonly id: string
  readonly requestId?: string
  readonly legOrdinal?: number
  readonly carrierKind?: string
}

/**
 * The wire item (v8): the frozen `InterventionItem` projection (spec
 * §14.1), field-for-field. Every field here is SERVER-DERIVED; none is
 * accepted back from the client (the act body is closed to
 * `{teamSessionId, interventionId, action, note?}`). `blockScope` is
 * `null` when nothing is held back (the spec's nullable cell is typed
 * `null`, never absent).
 */
export interface RemoteInterventionWireItem {
  readonly interventionId: string
  readonly kind: 'approval' | 'warning' | 'error'
  readonly responseBehavior: 'informational' | 'wait-for-response'
  readonly blockScope: RemoteSafeRecord | null
  readonly source: RemoteInterventionWireSource
  readonly status: 'open' | 'acknowledged' | 'resolved' | 'authority-unavailable' | 'stale'
  readonly requiredAuthority?: string
  readonly currentReviewAuthority?: string
  readonly legalActions: readonly string[]
  readonly derivationReasons: readonly string[]
  readonly fingerprint?: string
  readonly createdAt: string
  readonly updatedAt?: string
  readonly lastObservedAt?: string
  readonly observationCount?: number
}

/** The frozen top-level field set of a wire item (closed value — the
 *  handler validates every port item against it, presence AND absence). */
export const REMOTE_INTERVENTION_ITEM_FIELDS: readonly string[] = [
  'interventionId',
  'kind',
  'responseBehavior',
  'blockScope',
  'source',
  'status',
  'legalActions',
  'derivationReasons',
  'createdAt',
  'requiredAuthority',
  'currentReviewAuthority',
  'fingerprint',
  'updatedAt',
  'lastObservedAt',
  'observationCount',
]

/** The closed `source` field set (null cells typed, never absent). */
export const REMOTE_INTERVENTION_SOURCE_FIELDS: readonly string[] = [
  'kind',
  'id',
  'requestId',
  'legOrdinal',
  'carrierKind',
]

/**
 * The `intervention.act` wire outcome (v8). CLOSED set — the response
 * carries NOTHING else: no authority, no legal actions, no decision
 * record (the next `intervention.list`/`get` re-derives the full state;
 * the act response is a receipt, not a projection).
 */
export const REMOTE_INTERVENTION_ACT_OUTCOMES: readonly string[] = [
  'decided',
  'escalated',
  'acknowledged',
  'already-acknowledged',
]

/**
 * The `override.getPermissionAdministration` wire value (v8) — a
 * STRIP-PROJECTION (plan 6.B): the handler projects the port's rich
 * record down to EXACTLY these fields. Authority-bearing cells (grants,
 * ceilings, ranks, reviewer identities) and round-trippable decision
 * fields (request ids, decisions, notes) are dropped server-side and can
 * never reach a client that might echo them back. What remains answers
 * the panel's question: which rules are in force at which generation,
 * from which source, with which diagnostics.
 */
export interface RemoteInterventionWireAdministration {
  readonly teamSessionId: string
  /** `null` = the team-level administration view (typed, never absent). */
  readonly memberInstanceId: string | null
  /** The overlay slot generation (`null` = no overlay generation exists). */
  readonly generation: number | null
  /** Which authority the effective rules were read from. */
  readonly source: 'overlay' | 'blueprint-default'
  /** The effective rules as RULES (never an expanded filesystem tree). */
  readonly effective: RemoteSafeRecord
  /** Operator-facing diagnostics (strings only). */
  readonly diagnostics: readonly string[]
}

/** The closed field set of the administration wire value. */
export const REMOTE_PERMISSION_ADMINISTRATION_FIELDS: readonly string[] = [
  'teamSessionId',
  'memberInstanceId',
  'generation',
  'source',
  'effective',
  'diagnostics',
]

// ---------------------------------------------------------------------------
// A4-PR7 W1 — contract v9: the corrupt-leg visibility read
// ---------------------------------------------------------------------------

/**
 * The closed cap of the wire `legs` list (v9). The corruptCount stays
 * EXACT (never capped — the human must see the true size of the ledger
 * fault); `legs` carries at most this many rows in ascending sequence
 * order with `truncated` disclosed when fewer than `corruptCount` ride.
 * The cap keeps a pathological ledger from minting an unbounded wire.
 */
export const REMOTE_CORRUPT_CONTROL_LEGS_CAP = 20

/**
 * One corrupt leg on the wire (v9). The fields are the REAL
 * `ControlCorruptLegRecord` echo fields (`runtime/control/types.ts`) —
 * the read PLANE projects, it never re-derives: `disclosesMember` is the
 * control service's own candidacy verdict (false = fully unattributable,
 * which per RULING 5-B blocks nothing); `requestId` / `approvalCaseId`
 * are present ONLY when the damaged row itself still discloses them
 * (the report never invents an identity it did not read — the same law
 * `toCorruptLegRecord` applies at the service edge).
 */
export interface RemoteCorruptControlLegWire {
  readonly sequence: number
  readonly disclosesMember: boolean
  readonly requestId?: string
  readonly approvalCaseId?: string
}

/** The closed field set of one corrupt leg (optional cells: echo-only). */
export const REMOTE_CORRUPT_CONTROL_LEG_FIELDS: readonly string[] = [
  'sequence',
  'disclosesMember',
  'requestId',
  'approvalCaseId',
]

/**
 * The `team.listCorruptControlLegs` wire value (v9), carried as the
 * single `corruption` response field. A REPORT, not a gate: nothing in
 * this shape selects execution semantics (RULING 5-B), and it carries
 * NO member attribution beyond what a row discloses itself.
 */
export interface RemoteCorruptControlLegsWire {
  readonly teamSessionId: string
  /** The FULL count of corrupt legs (never capped). */
  readonly corruptCount: number
  /** True when `legs` was capped to {@link REMOTE_CORRUPT_CONTROL_LEGS_CAP}. */
  readonly truncated: boolean
  readonly legs: readonly RemoteCorruptControlLegWire[]
}

/** The closed field set of the corrupt-legs wire value. */
export const REMOTE_CORRUPT_CONTROL_LEGS_FIELDS: readonly string[] = [
  'teamSessionId',
  'corruptCount',
  'truncated',
  'legs',
]
