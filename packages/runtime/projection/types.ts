/**
 * P8-T2 Projection Service — the read ports and the durable source
 * vocabulary (TaskDoc §11.9 P8-T2; DevPlan §21).
 *
 * The whole projection is produced from EXACTLY TWO inputs (DevPlan §21.2):
 *
 *   1. the **durable TeamDomain** state (invariant 41 — the TeamDomain is
 *      the durable authority), read through {@link TeamDomainReadPort} as a
 *      BOUNDED projection source: the identity core, the root facts, the
 *      template rows, the member rows, and the ledger summary. The port
 *      exposes **no session-log or child-log read surface** — so "scan
 *      `Root + all child Session logs` to rebuild Team control truth" is
 *      impossible by construction (the §21.2 red line). The projection's
 *      complexity is therefore O(team members + templates), never O(child
 *      Session log volume).
 *   2. an **optional live residency/activity overlay** (UI §24), read
 *      read-only through {@link LiveResidencyOverlayPort} as a single
 *      snapshot of the current per-member live state. A member absent from
 *      the snapshot has no live facts (the fold maps it to
 *      `liveActivity: null` — the nullable overlay, DevPlan §21.2).
 *
 * The durable source types mirror the frozen P8-T1 projection input shapes
 * (so the fold can hand them straight to `createTeamProjection`) but keep
 * the TeamDomain's own optionality where the DTO resolves it (the member
 * `workspace` may be inherited from the team default; the ledger is the
 * summary, never the entries). The service is the ONLY place that reads;
 * the fold is a pure function of the source + the already-materialized
 * overlay snapshot (see `fold.ts`).
 *
 * Pure module: no I/O, no `node:` builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/runtime/projection/types
 */

import type {
  AdmissionState,
  BlueprintSnapshotRef,
  ChildSessionId,
  CompatibilitySummaryDto,
  ContextPolicy,
  DisposedMemberHistoryInput,
  EffectiveConfigDto,
  EffectiveConfigDtoV2,
  InstanceId,
  LedgerCategoryCounts,
  MemberActivitySummaryDto,
  MemberLifecycleState,
  MemberLiveActivityDto,
  MemberModelStateDto,
  SessionId,
  TemplateId,
  TemplateKind,
  TeamSessionId,
} from '../../contracts/src/index.js'

/**
 * A deterministic clock producing the projection `generatedAt` stamp
 * (ISO-8601). Injected by the service so the fold stays pure.
 */
export type ProjectionClock = () => string

/**
 * The durable projection source of one TeamSession: the BOUNDED view of the
 * TeamDomain (invariant 41) that the fold consumes. The port returns exactly
 * this and NOTHING else — there is no session-log / child-log read surface
 * on the type, so the fold can only ever project the durable facts (§21.2).
 */
export interface TeamDomainProjectionSource {
  /** The TeamSession id (root DSH session id, invariant 9). */
  readonly teamSessionId: TeamSessionId
  /** The immutable blueprint snapshot bound to the TeamSession (invariant 10). */
  readonly blueprint: BlueprintSnapshotRef
  /** The team default workspace; absent when the TeamDomain does not carry one. */
  readonly defaultWorkspace?: string
  /** The TeamSession creation timestamp, ISO-8601. */
  readonly createdAt: string
  /**
   * The WHOLE-projection monotonic generation (>= 1, DevPlan §21.4): carried
   * verbatim from the durable TeamDomain. The live overlay NEVER affects it,
   * so downstream stale-overwrite detection (`isStaleTeamProjection`) is
   * keyed against the durable authority, not the (ephemeral) live state.
   */
  readonly generation: number
  /** The root identity + admission facts (Architecture §14.3 cat A / §28 / §34.1). */
  readonly root: TeamRootFacts
  /** The template rows of the bound snapshot (exactly one leader, invariant 13). */
  readonly templates: readonly DurableTemplateRow[]
  /** The member rows: every MemberInstance plus the LeaderInstance (invariant 14). */
  readonly members: readonly DurableMemberRow[]
  /** The TeamLedger summary (UI §27); the entries themselves stay durable. */
  readonly ledger: DurableLedgerSummary
  /**
   * S7-R2 (R2-6, D14): the retained-history digest of EVERY DISPOSED member
   * — derived by the production read port from the durable member rows +
   * the root ledger (closed addressing rule — see `projection-source.ts`).
   * DURATIONAL-optional: ABSENT when the team has no DISPOSED member (the
   * fold then stamps no `disposedHistory` key — the default projection is
   * byte-identical to the pre-repair shape; the live view (BQ-04)
   * semantics are unchanged). The read port is the ONLY producer; the fold
   * passes the bundles through to the v2 projection verbatim.
   */
  readonly disposedHistory?: readonly DisposedMemberHistoryInput[]
}

/**
 * The root identity + admission facts of the TeamSession (the TeamDomain's
 * category-A view). `teamSessionId` and `createdAt` live on the enclosing
 * {@link TeamDomainProjectionSource}; they are stamped onto the projection
 * root by the fold.
 */
export interface TeamRootFacts {
  /** The current PolicyState name (blueprint-defined; opaque to the contract). */
  readonly policyState: string
  /** The frozen admission state (Architecture §28). */
  readonly admission: AdmissionState
  /** The compatibility/admission summary (UI §18.1). */
  readonly compatibility: CompatibilitySummaryDto
  /** Root creations consumed by handoff into this session (>= 0). */
  readonly creationBudgetConsumed: number
  /** The session a handoff continued from; absent when created fresh. */
  readonly handoffSourceSessionId?: SessionId
}

/**
 * One template row of the bound blueprint snapshot (invariant 13 / 17).
 * Mirrors the frozen `TemplateProjectionInput`; the template content is not
 * duplicated (the projection embeds the immutable snapshot ref).
 */
export interface DurableTemplateRow {
  /** The frozen template kind (`leader` | `member`). */
  readonly kind: TemplateKind
  /** The static template identity (NOT a runtime identity, invariant 19). */
  readonly templateId: TemplateId
  /** Human-facing display name. */
  readonly displayName: string
  /** Human-facing description; absent when not carried. */
  readonly description?: string
  /** The template's frozen context policy (invariant 29). */
  readonly contextPolicy: ContextPolicy
  /** Template-level instance cap (>= 1); absent when the template has no cap. */
  readonly instanceQuota?: number
}

/**
 * One MemberInstance (or the LeaderInstance) row of the TeamDomain.
 * Mirrors the frozen `MemberProjectionInput` but keeps the TeamDomain's own
 * optionality where the projection resolves it:
 *
 * - `workspace` is the INSTANCE workspace; absent means "inherit the team
 *   default workspace" (the fold resolves the effective value, and throws
 *   when neither is present — a projected member row requires one);
 * - `childSessionId` is absent for the LeaderInstance (invariant 14) and
 *   present for every MemberInstance (invariant 23) — for all lifecycle
 *   states, including ARCHIVED and DISPOSED;
 * - `liveActivity` is NOT a durable fact: it is the live overlay, applied
 *   by the fold from the snapshot (always present, `null` when no facts).
 */
export interface DurableMemberRow {
  /** The member's stable instance id (unique within the team, invariant 18). */
  readonly instanceId: InstanceId
  /** The static template identity. */
  readonly templateId: TemplateId
  /** Human-facing label (NOT a runtime identity, invariant 19). */
  readonly label: string
  /** Opaque grouping metadata (invariant 20); absent when not set. */
  readonly groupId?: string
  /** The durable child session (invariant 23); ABSENT for the leader. */
  readonly childSessionId?: ChildSessionId
  /** The instance workspace; absent means inherit the team default workspace. */
  readonly workspace?: string
  /** The frozen lifecycle state (Architecture §29). */
  readonly lifecycle: MemberLifecycleState
  /** Instance creation timestamp, ISO-8601. */
  readonly createdAt: string
  /** The effective per-instance context policy (invariant 29). */
  readonly contextPolicy: ContextPolicy
  /**
   * The four-lane effective configuration view with provenance (UI §18.2).
   * S7-R2 (R2-2): the production source now resolves the v2 entries
   * (additive provenance keys) — the declared type stays the v1 DTO by the
   * documented type-lie pattern (a v2 entry is a structural superset of a
   * v1 entry, and the projection pipeline validates each record through
   * its own schema version).
   */
  readonly effectiveConfig: EffectiveConfigDto | EffectiveConfigDtoV2
  /** The durable activity summary; absent when no durable facts exist. */
  readonly activity?: MemberActivitySummaryDto
  /**
   * S7-R2 (R2-3, BQ-11): the model state view — the current model with its
   * Team provenance, the next-boundary pending model, and availability.
   * ABSENT when the view cannot be derived (the DURATIONAL-optional key is
   * dropped, never `undefined`); the production read port derives it from
   * the mutation store, the governance overrides, and the static config.
   */
  readonly modelState?: MemberModelStateDto
}

/**
 * The TeamLedger summary as stored in the TeamDomain (UI §27). The projection
 * carries THIS summary only; the per-entry ledger is a separate, paginated
 * durable read (see `ledger.ts`), never a projection field.
 */
export interface DurableLedgerSummary {
  /** Highest durable ledger sequence so far (0 for an empty ledger). */
  readonly latestSequence: number
  /** Total entry count; equals the sum of `byCategory`. */
  readonly totalEntries: number
  /** Per-category counts over the eight frozen categories (all keys). */
  readonly byCategory: LedgerCategoryCounts
  /** Control requests awaiting a decision (UI §27 pending badge). */
  readonly pendingControlCount: number
}

/**
 * The read-only TeamDomain source port (DevPlan §21.2). Bounded by
 * construction: it returns the durable {@link TeamDomainProjectionSource}
 * and exposes **no** session-log or child-log read surface, so the
 * "scan `Root + all child Session logs`" red line cannot be implemented
 * against this seam.
 */
export interface TeamDomainReadPort {
  /**
   * Read the durable projection source of one TeamSession.
   * @param teamSessionId - the TeamSession id (root DSH session id).
   * @returns the bounded durable projection source.
   */
  readProjectionSource(teamSessionId: TeamSessionId): TeamDomainProjectionSource
}

/**
 * The read-only live residency/activity overlay port (UI §24; DevPlan §21.2).
 * A single snapshot read of the current per-member live state; it never
 * mutates durable state. A member absent from the snapshot map has no live
 * facts (the fold maps it to `liveActivity: null`).
 */
export interface LiveResidencyOverlayPort {
  /**
   * Read the current live overlay for the team's members.
   * @returns a map from member instance id to its live activity; an empty
   *   map (or a member's absence) means "no live facts for that member".
   */
  snapshot(): ReadonlyMap<InstanceId, MemberLiveActivityDto>
}
