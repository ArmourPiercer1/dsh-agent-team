/**
 * P6-T5 — the activity ledger: durable per-member-instance TELEMETRY
 * (subject / status / summary / correlation / last action / RUNNING
 * intervals) for the UI timeline (UI Design §15) and the activity/progress
 * panel (UI Design §25) — DevPlan §19.5.
 *
 * Authority boundary (NO workflow authority — TaskDoc §11.7, DevPlan
 * §19.5, Architecture §1.4/§14):
 *
 * - The activity rows are facts in the TeamLedger (invariant 41: the
 *   TeamDomain is the durable authority; invariant 44: coordination order
 *   comes from the TeamLedger sequence, never from timestamps). Nothing in
 *   this module reads or writes lifecycle state, member records, DAG, or
 *   completion authority; `MemberInstanceRecordDto.activityVersion` is
 *   written exclusively by the surfaces that own member-record commits
 *   (P6-T1 creation, P7-T3 lifecycle) — P6-T5 never rewrites a member
 *   record.
 * - Every DURABLE WRITE flows through the P6-T2 TeamRuntime facade
 *   (`performAction` with the closed `report-progress` action) so that
 *   addressing, caller identity/role, envelope and live-target authority
 *   are enforced exactly once; the ledger's own job is the structured
 *   activity row + its total-order and interval guards.
 * - This module publishes PROJECTIONS (pure functions from durable rows to
 *   the UI Design field names). A projection is a derived view: mutating a
 *   projection mutates nothing durable.
 *
 * Module layout:
 *   - `types.ts`     — the closed vocabularies + input/row/projection types
 *   - `errors.ts`    — the closed ActivityError vocabulary
 *   - `facts.ts`     — op ↔ factType mapping + deterministic parse/build
 *   - `projection.ts`— the pure projection seeds (durable rows → UI shape)
 *   - `ledger.ts`    — `createActivityLedger` (the guarded write path)
 */

import type { ActionCaller, ProgressValue, TeamRuntime } from '../admission/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'

// --- closed vocabularies ------------------------------------------------------

/** The closed activity operations (one durable fact type each). */
export const ACTIVITY_OPS = ['progress', 'interval-open', 'interval-close'] as const

/** One of the closed activity operations. */
export type ActivityOp = (typeof ACTIVITY_OPS)[number]

/** The closed activity fact types (TeamLedger `factType` values). */
export const ACTIVITY_FACT_TYPES = [
  'activity-progress-recorded',
  'activity-interval-opened',
  'activity-interval-closed',
] as const

/** One of the closed activity fact types. */
export type ActivityFactType = (typeof ACTIVITY_FACT_TYPES)[number]

// --- field bounds (shared by the writer and the deterministic parser) --------

/** Max length of a subject string (the telemetry lane label). */
export const ACTIVITY_SUBJECT_MAX_LENGTH = 256
/** Max length of a progress summary. */
export const ACTIVITY_SUMMARY_MAX_LENGTH = 512
/** Max length of a last-action label. */
export const ACTIVITY_LAST_ACTION_MAX_LENGTH = 256
/** Max length of a correlation identifier (the work-unit tag). */
export const ACTIVITY_CORRELATION_MAX_LENGTH = 128
/** Max length of an interval note / close note. */
export const ACTIVITY_NOTE_MAX_LENGTH = 256
/** Max length of the request token (audit correlation, facade-required). */
export const ACTIVITY_REQUEST_TOKEN_MAX_LENGTH = 128

// --- write inputs --------------------------------------------------------------

/**
 * The fields every activity write shares: one subject, one claimed
 * per-subject sequence, one closed status value.
 *
 * `sequence` is the reporter's CLAIM about the per-subject logical clock:
 * the durable head is the max sequence among the subject's durable activity
 * facts, and the writer admits `claimed === head + 1` exactly
 * (REJECT policy — see `ledger.ts`); everything else fails with
 * `ACTIVITY_SEQUENCE_STALE`. The returned row carries the recorded
 * sequence, which the reporter caches as the basis of its next claim.
 */
export interface ActivityWriteInputBase {
  /** The team (root) session id. */
  readonly rootSessionId: string
  /** The reporting caller (closed ActionCaller form). */
  readonly caller: ActionCaller
  /** The member instance the telemetry is about (instanceId-first). */
  readonly instanceId: string
  /** The subject (the telemetry lane within the instance). */
  readonly subject: string
  /** The claimed per-subject next sequence (admitted iff head + 1). */
  readonly sequence: number
  /** The closed status value the report carries (PROGRESS_VALUES). */
  readonly progress: ProgressValue
  /** The per-report request token (facade-required, audit correlation). */
  readonly requestToken: string
}

/** One progress update (status + summary + last action + optional tag). */
export interface ActivityProgressInput extends ActivityWriteInputBase {
  readonly summary?: string
  readonly lastAction?: string
  /** The work-unit tag this progress belongs to (optional). */
  readonly correlation?: string
}

/**
 * One RUNNING-interval open. At most ONE open interval exists per
 * `(instanceId, subject, correlation)`; different correlations (and
 * different subjects) coexist simultaneously — the UI timeline renders
 * each open interval as one bar per lane (UI Design §15).
 *
 * The `progress` value is audit context (the reporter's status at the
 * moment of the open): interval facts NEVER change the projected status,
 * which is derived from progress facts only.
 */
export interface ActivityIntervalOpenInput extends ActivityWriteInputBase {
  /** The work-unit tag of the interval (REQUIRED). */
  readonly correlation: string
  /** The optional interval note. */
  readonly note?: string
}

/**
 * One RUNNING-interval close. FAILS CLOSED when no open interval exists
 * for the `(instanceId, subject, correlation)` triple
 * (`ACTIVITY_INTERVAL_NOT_OPEN`). A later re-open under the same
 * correlation is a new work unit (the closed pair is kept for history).
 */
export interface ActivityIntervalCloseInput extends ActivityWriteInputBase {
  /** The work-unit tag of the interval to close (REQUIRED). */
  readonly correlation: string
  /** The optional close note. */
  readonly closeNote?: string
}

// --- durable rows --------------------------------------------------------------

/**
 * One parsed durable activity fact (a TeamLedger entry of the closed
 * activity fact vocabulary). Lossless JSON — safe to cross the Remote
 * boundary (P8) as-is.
 *
 * `globalSequence` is the TeamLedger sequence (invariant 44 — the total
 * order of the team fact stream); `sequence` is the per-subject logical
 * sequence (the out-of-order guard's clock). `createdAt` is a DISPLAY
 * LABEL only: ordering is always by sequence, never by timestamp.
 */
export interface ActivityFactRow {
  /** The TeamLedger sequence (total order, invariant 44). */
  readonly globalSequence: number
  /** The closed activity fact type. */
  readonly factType: ActivityFactType
  /** The team (root) session id. */
  readonly rootSessionId: string
  /** The member instance the fact is about. */
  readonly instanceId: string
  /** The subject (telemetry lane). */
  readonly subject: string
  /** The per-subject logical sequence (monotonic per subject). */
  readonly sequence: number
  /** The closed operation. */
  readonly op: ActivityOp
  /** The closed status value carried by the report. */
  readonly progress: ProgressValue
  /** The progress summary (progress facts only). */
  readonly summary?: string
  /** The last-action label (progress facts only). */
  readonly lastAction?: string
  /** The work-unit tag (progress: optional; interval facts: required). */
  readonly correlation?: string
  /** The interval open note (interval-open facts only). */
  readonly note?: string
  /** The interval close note (interval-close facts only). */
  readonly closeNote?: string
  /** The per-report request token (audit correlation). */
  readonly requestToken: string
  /** The reporting caller's instance id (audit; the facade-verified form). */
  readonly reportedByInstanceId: string
  /** The display timestamp of the durable write (label only). */
  readonly createdAt: string
}

// --- projection seeds (frozen UI Design field names) ---------------------------

/**
 * Minimal member metadata for the team projection (the UI lane labels).
 * The caller supplies it from the durable member records (P6-T5 reads
 * them only; it never writes them).
 */
export interface ActivityInstanceRef {
  readonly instanceId: string
  readonly label?: string
  readonly templateId?: string
}

/**
 * One RUNNING interval in the projection (one timeline bar — UI Design
 * §15). `startedAt` / `closedAt` are display labels from the durable rows;
 * the ordering identity is the sequence.
 */
export interface ActivityIntervalProjection {
  readonly correlation: string
  readonly startedAt: string
  readonly startedSequence: number
  readonly note?: string
  /** True while the interval is open (no durable close for this unit). */
  readonly open: boolean
  readonly closedAt?: string
  readonly closedSequence?: number
  readonly closeNote?: string
}

/**
 * The projected state of one subject (UI Design §25 field names: status,
 * summary, correlation, lastAction + the §15 RUNNING intervals).
 *
 * Derived ONLY from durable rows: `status`/`summary`/`lastAction`/
 * `correlation` come from the LATEST PROGRESS fact (interval facts never
 * contribute); `openIntervals`/`closedIntervals` from the interval facts;
 * `sequence` is the per-subject durable head (0 = no facts yet).
 */
export interface ActivitySubjectProjection {
  readonly instanceId: string
  readonly subject: string
  /** The per-subject durable head (0 = no durable facts yet). */
  readonly sequence: number
  readonly status?: ProgressValue
  readonly summary?: string
  readonly lastAction?: string
  readonly correlation?: string
  readonly lastProgressAt?: string
  /** The display label of the newest durable fact for the subject. */
  readonly lastFactAt?: string
  readonly openIntervals: readonly ActivityIntervalProjection[]
  readonly closedIntervals: readonly ActivityIntervalProjection[]
}

/** One member lane of the team projection (all subjects, sorted). */
export interface ActivityInstanceProjection {
  readonly instanceId: string
  readonly label?: string
  readonly templateId?: string
  readonly subjects: readonly ActivitySubjectProjection[]
}

/** The full team projection (one lane per instance, sorted). */
export interface ActivityTeamProjection {
  readonly rootSessionId: string
  readonly instances: readonly ActivityInstanceProjection[]
}

// --- ledger port ----------------------------------------------------------------

/** The read query for `listActivityFacts` (all fields optional filters). */
export interface ActivityFactQuery {
  readonly rootSessionId: string
  readonly instanceId?: string
  readonly subject?: string
}

/**
 * The activity ledger port: the guarded write path (every durable write
 * routed through the TeamRuntime facade, then the per-team-locked guarded
 * commit) + the synchronous durable read. The closed API surface —
 * deliberately WITHOUT any lifecycle-mutating call (NO workflow
 * authority; asserted by the P6-T5 negative test).
 */
export interface ActivityLedger {
  /** Record one progress update (status/summary/lastAction/correlation). */
  recordProgress(input: ActivityProgressInput): Promise<ActivityFactRow>
  /** Open one RUNNING interval for `(instanceId, subject, correlation)`. */
  openInterval(input: ActivityIntervalOpenInput): Promise<ActivityFactRow>
  /** Close one RUNNING interval (fails closed when none is open). */
  closeInterval(input: ActivityIntervalCloseInput): Promise<ActivityFactRow>
  /** Read the durable activity rows (synchronous, deterministic order). */
  listActivityFacts(query: ActivityFactQuery): readonly ActivityFactRow[]
}

/** The activity ledger wiring (injected TeamDomain + TeamRuntime facade). */
export interface ActivityLedgerOptions {
  /** The durable authority (invariant 41) — repositories only. */
  readonly teamDomain: TeamDomain
  /** The P6-T2 TeamRuntime facade (the sole authority write path). */
  readonly runtime: TeamRuntime
  /** The display clock (deterministic in tests; ISO-8601 labels). */
  readonly now?: () => string
  /** The P8-S5B shared team operation chain (the single CR-8 coordinator
   *  map). When installed, the guarded commit serializes on that shared
   *  chain instead of a private map. The two ledger critical sections
   *  stay strictly SEQUENTIAL either way — the facade audit fact releases
   *  the chain before the guarded commit re-acquires it (never nested, so
   *  sharing cannot deadlock). Absent in the default wiring: the ledger
   *  owns a private map (previous behavior). */
  readonly teamLocks?: Map<string, Promise<unknown>>
}
