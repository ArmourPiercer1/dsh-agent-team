/**
 * P9-T4 (S3-A + S3-B) — the normalized Team UI model types.
 *
 * The plan §7.1 rationale: every kept legacy component reading
 * `TeamProjectionDto` + raw ledger entries directly would repeat
 * parse/join in each file, invalidate the old model tests, and start
 * re-deriving backend state in the React layer — "equivalent to a
 * rewrite". This module is the PURE client presentation model those
 * adapters emit: `output = pure(TeamProjectionDto, loaded
 * RemoteLedgerEntryValue[])` (plan §7.1). No backend write, no
 * authoritative lifecycle storage, no session-log scan, no DOM, no
 * TeamDomain import, no invented missing facts (plan §7.1 forbidden
 * edges; gate G3).
 *
 * Field provenance rule: every field is either copied verbatim from a
 * frozen DTO field, derived by a documented pure mapping (plan §7.2
 * display mapping, §7.3 pending-count rule, §7.4 current-work source),
 * or ABSENT — a missing fact is never invented (`undefined` / `null` /
 * key-absent, exactly as the DTOs do it).
 *
 * Identity rule (gate G3): identity fields are the frozen ids
 * (`instanceId`, `templateId`, `sequence`, `requestId`, `correlation`);
 * display labels never participate, so duplicate labels cannot affect
 * identity.
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-ui-snapshot
 */

import type {
  ActivityIntervalSummary,
  BlueprintSnapshotRef,
  CompatibilitySummaryDto,
  ContextPolicy,
  DisposedMemberHistoryDto,
  EffectiveConfigDto,
  LedgerCategory,
  LedgerSummaryDto,
  MemberActivitySummaryDto,
  MemberLifecycleState,
  MemberLiveActivityDto,
  ProgressValue,
  TemplateKind,
} from '../../../contracts/src/index.js'
import type { TeamPerspective } from '../state/team-session-resolution.js'

/** Re-exported for adapter consumers (the snapshot carries it). */
export type { TeamPerspective }

/**
 * The closed UI display-status vocabulary (plan §7.2 display mapping;
 * the internal model keeps the RAW `MemberLifecycleState` next to it).
 * CREATED → `created` (bound-like), RUNNING → `running`,
 * SETTLED → `settled`, ARCHIVED → `archived`, DISPOSED → `disposed`
 * (history-only).
 */
export type TeamUiDisplayStatus = 'created' | 'running' | 'settled' | 'archived' | 'disposed'

// ---------------------------------------------------------------------------
// S3-A — projection-side model
// ---------------------------------------------------------------------------

/** One member template row (pure copy of the frozen template DTO). */
export interface TeamUiTemplate {
  readonly kind: TemplateKind
  readonly templateId: string
  readonly displayName: string
  readonly description?: string
  readonly contextPolicy: ContextPolicy
  readonly instanceQuota?: number
}

/**
 * One member instance row — the single merged roster (live members AND
 * disposed-history rows; `fromHistory` distinguishes them, gate G3
 * "archived/disposed represented").
 *
 * Navigation (plan §7.2): `childSessionId` is the durable child session;
 * `null` ONLY for the leader (its navigation target is the
 * teamSessionId / root session — never inferred from anything else).
 *
 * `pendingControlCount` (plan §7.3): a per-instance badge may come ONLY
 * from known-complete control facts (the ledger adapter fills it when the
 * ledger is complete); `null` = unknown — a partial ledger never
 * distributes the team-wide count onto instances.
 */
export interface TeamUiMemberInstance {
  readonly instanceId: string
  readonly templateId: string
  readonly label: string
  readonly groupId?: string
  /** The durable child session; `null` = leader (nav target: the root). */
  readonly childSessionId: string | null
  /** The RAW frozen lifecycle (never re-derived). */
  readonly lifecycle: MemberLifecycleState
  /** The §7.2 display mapping of `lifecycle`. */
  readonly displayStatus: TeamUiDisplayStatus
  /**
   * The §7.2 presentation fallback (NOT lifecycle inference):
   * `liveActivity?.currentAction ?? activity?.lastAction ?? undefined`.
   */
  readonly currentAction?: string
  /** Absent for disposed-history rows (the history DTO carries no workspace). */
  readonly workspace?: string
  /** Absent for disposed-history rows. */
  readonly contextPolicy?: ContextPolicy
  /** Absent for disposed-history rows. */
  readonly effectiveConfig?: EffectiveConfigDto
  /** The durable activity summary; absent when the DTO key is absent. */
  readonly activity?: MemberActivitySummaryDto
  /** The live overlay; always present, `null` when no live facts (history rows: always `null`). */
  readonly liveActivity: MemberLiveActivityDto | null
  /** §7.3 per-instance pending badge; `null` = unknown (partial ledger / projection-only). */
  readonly pendingControlCount: number | null
  /** `true` for rows reconstructed from `disposedHistory` (history-only). */
  readonly fromHistory: boolean
  readonly createdAt: string
  /** Present for disposed-history rows when the history DTO carries it. */
  readonly disposedAt?: string
}

/**
 * One team-level current-work row (plan §7.4 preferred data source:
 * the member's `activity` summary + `liveActivity` overlay). Emitted
 * only when at least one of `status` / `subject` / `summary` /
 * `currentAction` is present — a member with no activity facts gets no
 * row (no invented work). Available before any ledger page loads.
 */
export interface TeamUiCurrentWorkRow {
  readonly instanceId: string
  readonly label: string
  readonly status?: ProgressValue
  readonly subject?: string
  readonly summary?: string
  /** The live current action (the §7.2 presentation fallback). */
  readonly currentAction?: string
  readonly lastProgressAt?: string
  readonly lastActivityAt?: string
  readonly runningSince?: string
  readonly admittedWorkCorrelation?: string
  /** The summary's open intervals (durable; empty when none). */
  readonly openIntervals: readonly ActivityIntervalSummary[]
}

/**
 * The normalized team UI snapshot (plan §7.1 sketch; the `...` fields
 * resolved): a pure function of one projection frame + the viewer
 * perspective. The frame's `disposedHistory` DTO rows appear TWICE,
 * deliberately: merged into `members` as display rows (roster
 * completeness) and retained verbatim in `disposedHistory` as the
 * durable fact rows (fact counts, category counts, sequence extents)
 * for the durable-ledger surface.
 */
export interface TeamUiSnapshot {
  readonly teamSessionId: string
  readonly generation: number
  readonly blueprint: BlueprintSnapshotRef
  readonly perspective: TeamPerspective
  readonly templates: readonly TeamUiTemplate[]
  readonly members: readonly TeamUiMemberInstance[]
  readonly compatibility: CompatibilitySummaryDto
  /** The root's raw frozen policy-state string (display mapping is T8). */
  readonly policyState: string
  /**
   * The frozen ledger summary (the §7.3 dock top-level pending count is
   * `ledgerSummary.pendingControlCount` DIRECTLY — never re-derived).
   */
  readonly ledgerSummary: LedgerSummaryDto
  readonly activity: readonly TeamUiCurrentWorkRow[]
  readonly disposedHistory: readonly DisposedMemberHistoryDto[]
}

// ---------------------------------------------------------------------------
// S3-B — ledger-side model
// ---------------------------------------------------------------------------

/**
 * One durable ledger fact row (the raw entry, leaf-typed). `category` is
 * the client-local frozen vocabulary mirror of the host authority
 * (`packages/runtime` `FACT_TYPE_CATEGORY`); it is OMITTED when the
 * fact type is unknown to that vocabulary (fail-open display, fail-closed
 * authority — the host still rejects unknown categories).
 */
export interface TeamUiLedgerRow {
  readonly sequence: number
  readonly factType: string
  readonly category?: LedgerCategory
  readonly rootSessionId: string
  readonly operationId: string | null
  readonly createdAt: string
  /** The raw payload, verbatim (heterogeneous; leaf reads happen in the adapter). */
  readonly payload: Readonly<Record<string, unknown>>
}

/**
 * One control request paired with its decision when a loaded page carries
 * one (the S3-B "control chains"; the legacy `TeamApprovalView`
 * successor). `pending` = no paired decision in the loaded entries.
 * Navigation hint rule (S3-B "only when supported"): the row carries no
 * session of its own — the UI joins `targetInstanceId` against the
 * snapshot `members` and offers navigation ONLY where the projection
 * names a durable `childSessionId`.
 */
export interface TeamUiControlChain {
  readonly requestId: string
  /** The request fact's sequence (chain identity anchor). */
  readonly requestSequence: number
  /** The requesting member instance (payload `targetInstanceId`). */
  readonly targetInstanceId: string
  readonly actionName: string
  readonly kind?: string
  readonly toolName?: string
  readonly capabilityDomain?: string
  readonly summary?: string
  readonly requestedAt: string
  readonly pending: boolean
  readonly decision?: {
    readonly value: string
    /** The decision fact's sequence. */
    readonly sequence: number
    readonly decidedAt: string
    readonly reason?: string
    readonly note?: string
  }
}

/**
 * One team message row (from `team-message-delivered` or
 * `team-coordination-recorded`; `kind` names the fact source). `from` is
 * ABSENT when the fact does not name a sender (the delivered fact
 * carries only the recipient pair) — never invented.
 */
export interface TeamUiMessageRow {
  readonly sequence: number
  readonly kind: 'delivered' | 'coordination'
  readonly from?: string
  readonly to: string
  readonly subject: string
  readonly at: string
  readonly correlation?: string
}

/**
 * One activity interval (S3-B "activity intervals"): an
 * `activity-interval-opened` fact paired with its
 * `activity-interval-closed` by `correlation` when both are loaded; an
 * unclosed open stays open (no synthetic close).
 */
export interface TeamUiActivityIntervalRow {
  readonly correlation: string
  readonly instanceId: string
  readonly subject?: string
  readonly openedAt: string
  readonly openedSequence: number
  readonly note?: string
  readonly closedAt?: string
  readonly closedSequence?: number
  readonly closeNote?: string
  readonly isOpen: boolean
}

/**
 * One historical work row from a durable `activity-progress-recorded`
 * fact (S3-B "progress/current-work rows"). Emitted ONLY for a
 * KNOWN-COMPLETE ledger (plan §7.4: a partial ledger never claims a
 * complete task board) — the adapter gates the whole array, never a
 * row.
 */
export interface TeamUiProgressRow {
  readonly sequence: number
  readonly instanceId: string
  readonly subject: string
  readonly progress: ProgressValue
  readonly summary?: string
  readonly lastAction?: string
  readonly correlation?: string
  readonly at: string
}

/**
 * The normalized durable-ledger model (plan §7.1 `TeamUiLedgerModel`;
 * the `...` fields resolved). `completeness` is the authority marker:
 * `partial` while `completeThrough < total` (or the total is unknown);
 * everything that is only meaningful over the WHOLE ledger
 * (`progress`, `pendingControlByInstance`) is empty under `partial`.
 */
export interface TeamUiLedgerModel {
  readonly completeness: 'partial' | 'complete'
  readonly entries: readonly TeamUiLedgerRow[]
  readonly controls: readonly TeamUiControlChain[]
  readonly messages: readonly TeamUiMessageRow[]
  readonly intervals: readonly TeamUiActivityIntervalRow[]
  /** Historical work rows; `[]` unless the ledger is known complete. */
  readonly progress: readonly TeamUiProgressRow[]
  /**
   * Per-instance pending control counts from known-complete control
   * facts (request without a paired decision, keyed by
   * `targetInstanceId`); `{}` unless the ledger is known complete.
   */
  readonly pendingControlByInstance: Readonly<Record<string, number>>
}
