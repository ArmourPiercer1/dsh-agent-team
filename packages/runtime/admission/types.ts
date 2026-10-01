/**
 * P6-T2 — TeamRuntime types: the unified authority facade for
 * runtime/control actions against EXISTING members.
 *
 * The facade is the single entry every later Team tool (P6-T6) and UI
 * Remote (P8) must call: one `performAction(request)` that enforces the
 * documented order — (1) instanceId-first target resolution, (2) caller
 * identity+role from the TeamDomain, (3) caller authority + mutation
 * envelope, (4) compatibility/admission, (5) quota, (6) durable effects —
 * and returns a lossless-JSON result (no live objects cross the boundary).
 *
 * Reuse, not duplication:
 * - creation (delegate-create / explicit create) is delegated to the
 *   P6-T1 ActivationProvider — the router calls it, never re-implements it
 *   (invariant 26: every new creation via the ActivationProvider);
 * - the mutation-envelope arithmetic reuses the P6-T1 pure seam
 *   (`computeOverlayBounds` semantics: intersection, fail closed);
 * - the compatibility gate reuses the domain/compatibility engine through
 *   the P6-T1 bridge (`evaluateActivationCompatibility`);
 * - the effective-config read reuses the domain/policy two-stage resolver
 *   through the P6-T1 seam (`resolveActivationPolicy`);
 * - durable writes go ONLY through the injected TeamDomain repositories
 *   (invariant 41).
 */

import {
  CAPABILITY_NAMES,
  CAPABILITY_NAME_VALUES,
} from '../../domain/policy/src/index.js'
import type {
  CapabilityName,
  PolicyEntry,
  PolicyStateCellView,
  TeamValueOrigin,
} from '../../domain/policy/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import type {
  PermissionRule,
  TemplatePermissionPolicy,
} from '../../domain/blueprint/src/index.js'
import {
  PERMISSION_RESOURCE_KINDS,
  PERMISSION_TOOL_NAMES,
} from '../../domain/blueprint/src/index.js'
import type {
  MemberLifecycleState,
  MemberInstanceRecordDto,
  RemoteSafeRecord,
} from '../../contracts/src/index.js'
import { committedPolicyState } from '../effective-policy/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/index.js'
import {
  OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
  parseOptionalRequirementAccepted,
  parseRecoveryIncidentClosed,
  parseRecoveryIncidentOpened,
  parseTemplateAvailabilitySet,
  RECOVERY_INCIDENT_CLOSED_FACT_TYPE,
  RECOVERY_INCIDENT_OPENED_FACT_TYPE,
  TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
} from '../requirements/index.js'
import type {
  OptionalRequirementAccepted,
  RecoveryIncidentClosed,
  RecoveryIncidentOpened,
  TemplateAvailabilitySet,
} from '../requirements/index.js'
import type {
  CompatibilityAcknowledgement,
  CompatibilityStateRecord,
  CompatibilityStatus,
  LedgerEntry,
} from '../../storage/schema/index.js'

// --- caller roles ----------------------------------------------------------------

/** The closed caller roles the facade resolves from the TeamDomain. */
export const CALLER_ROLES = {
  /** A non-instance principal: the team owner (never envelope-bound; may
   *  exceed team autonomy but not the External Hard Policy, invariant 34). */
  HUMAN: 'human',
  /** The LeaderInstance (inv 36: bounded by the team autonomy envelope). */
  LEADER: 'leader',
  /** An ordinary member instance (bounded by team ∩ template ∩ instance
   *  overlay; cannot self-escalate, invariant 37). */
  MEMBER: 'member',
} as const

/** One of the closed caller roles. */
export type CallerRole = (typeof CALLER_ROLES)[keyof typeof CALLER_ROLES]

/** Every caller role value, for membership checks. */
export const CALLER_ROLE_VALUES: readonly string[] = Object.values(CALLER_ROLES)

/**
 * The calling authority of one action (exactly one form).
 *
 * - `human`: a non-instance principal (the team owner; `humanId` is the
 *   opaque principal identifier, never an instance id);
 * - `instance`: a member instance caller, addressed by (root, instanceId)
 *   — resolved against the durable member records (leader/member role).
 */
export type ActionCaller =
  | { readonly kind: 'human'; readonly humanId: string }
  | { readonly kind: 'instance'; readonly instanceId: string }

// --- actions ---------------------------------------------------------------------

/**
 * The execution modes of WORK actions (issue #1; frozen-contract
 * addendum CCR-1/CCR-2): the closed set.
 *
 * - `sync` — the alpha.2 default (CCR-1: an ABSENT `execution` resolves
 *   to this; `performAction` blocks through the full work chain and the
 *   effect carries the `memberResult`);
 * - `async` — CCR-2: once the Phase A durable admission is committed,
 *   Phase B/C detach into the Team runtime (CCR-4: the caller's signal is
 *   honored through the admission only) and `performAction` returns the
 *   durable admission receipt (`workStatus: 'admitted'`); the terminal
 *   state is read back through the `work-status` action / `team_collect`
 *   tool (CCR-3).
 *
 * 2026-09-27 user ruling (model surface only): the model-facing tools
 * `team_delegate` / `team_follow_up` are now ASYNCHRONOUS BY DEFAULT
 * (absent `async` argument → `execution: 'async'`; only an explicit
 * `async: false` sends `execution: 'sync'`). The FACADE field semantics
 * are UNCHANGED — an ABSENT `execution` still resolves to `sync`
 * (CCR-1) for direct `performAction` callers — but the tool layer always
 * sets the field explicitly, so the facade default is no longer reachable
 * through the model surface.
 *
 * Accepted ONLY on the work actions (`delegate` / `follow-up`); rejected
 * on every other action (REQUEST_MALFORMED — CCR-2's closed scope).
 */
export const WORK_EXECUTION_MODES = ['sync', 'async'] as const

/** One of the closed work-execution modes. */
export type WorkExecutionMode = (typeof WORK_EXECUTION_MODES)[number]

/**
 * One action request to the facade.
 *
 * Addressing is instance-first (invariant 18/19): `targetInstanceId` is the
 * ONLY target vocabulary. A token that is a template id or a member label
 * is REJECTED (ACTION_ADDRESSING_REJECTED) — it is never silently
 * re-interpreted. The delegation fields are the ActivationProvider's own
 * addressing protocol for the two creation actions (DevPlan §24.1 M1-M5),
 * NOT a second action-addressing vocabulary.
 */
export interface TeamRuntimeActionRequest {
  /** The TeamSession (root session id, invariant 9) the action belongs to. */
  readonly rootSessionId: string
  /** The closed action name (see `admission/actions.ts` for the registry). */
  readonly action: string
  /** The calling authority (exactly one form). */
  readonly caller: ActionCaller
  /**
   * Instance-first target addressing. REQUIRED for instance-targeted
   * actions; ABSENT for team-scoped actions (the list actions).
   */
  readonly targetInstanceId?: string
  /**
   * Delegation addressing for `delegate`/`create-member`: template-level
   * naming (the provider protocol; REQUIRED for `create-member`, exactly
   * one of the two delegation fields for `delegate`).
   */
  readonly delegationTemplateId?: string
  /**
   * Delegation addressing for `delegate`: instance-first naming (the
   * provider protocol; exactly one of the two delegation fields).
   */
  readonly delegationInstanceId?: string
  /**
   * The caller's stable logical-operation token (stable across retries of
   * the same logical operation; distinct per logical operation). Carried
   * into the durable effect records as the idempotency/audit identity.
   */
  readonly requestToken: string
  /**
   * The action-specific payload (lossless JSON; per-action contracts in
   * `admission/actions.ts`). Stored verbatim in the durable fact payload
   * (with the standard envelope fields).
   */
  readonly payload?: Record<string, unknown>
  /**
   * The execution mode of a WORK action (`delegate` / `follow-up` only —
   * rejected on every other action; issue #1 / CCR-1 + CCR-2):
   *
   * - ABSENT or `'sync'` (the default — CCR-1): the alpha.2 semantics —
   *   `performAction` waits for the full work chain (admission → delivery →
   *   settlement) and the tool result carries the `memberResult`;
   * - `'async'` (CCR-2): once the Phase A durable admission is committed,
   *   Phase B/C runs as a DETACHED background continuation (ownership
   *   transfers to the Team runtime — CCR-4: the caller's AbortSignal is
   *   honored through admission but no longer cancels the detached work)
   *   and `performAction` returns the durable admission receipt
   *   (`workStatus: 'admitted'`, `settled: false`, NO memberResult — the
   *   terminal result is read back through the `work-status` action /
   *   `team_collect` tool, CCR-3).
   */
  readonly execution?: WorkExecutionMode
  /** Transient caller cancellation; never serialized or persisted. */
  readonly signal?: unknown
  /**
   * pre-alpha3 PR-E (plan §E.9) — the RECOVERY marker: present when this
   * attempt is the human-REVIEWED recovery dispatch of a previously
   * blocked normal-work attempt (the router's Control inline coupling
   * returned `allow` for the recovery Control request). The gate then
   * classifies the action as `recoveryWork` (allowed on the blocked
   * scopes) and the activation runs on the REDUCED original authority
   * (the downed capability subjects unavailable; everything else
   * unchanged; the external hard ceiling absolute). NEVER set by the
   * caller (the team tools / remote layer cannot forge it — it is
   * produced exclusively by the router's recovery dispatch after a
   * durable allow decision); a present marker without a blocked scope is
   * a no-op (the gate falls back to the normal-work classification).
   */
  readonly recovery?: {
    /** The scope keys the reviewed recovery covers (e.g. `['team']`,
     *   `['template:x']`). */
    readonly scopeKeys: readonly string[]
    /** The downed capability subjects (the FATAL verdicts' unavailable
     *   subjects across the covered scopes) — the reduced authority
     *   excludes exactly these (plan §E.9). */
    readonly unavailableSubjects: readonly string[]
  }
}

// --- effects / results -------------------------------------------------------------

/** One durable effect of an executed action (lossless JSON, no live data). */
export type RuntimeActionEffect =
  /** No effect: the action is a read (list/inspect produced its view). */
  | { readonly kind: 'none' }
  /** A coordination fact was durably recorded (send-message, etc.). */
  | { readonly kind: 'fact-recorded'; readonly factType: string; readonly sequence: number }
  /** New work was admitted on an existing instance (follow-up / delegate
   *  continue; invariant 24: the SAME child session is kept). */
  | {
      readonly kind: 'work-admitted'
      readonly instanceId: string
      /** The target's durable lifecycle as observed at admission. */
      readonly fromLifecycle: MemberLifecycleState
      /** True when the CREATED/SETTLED -> RUNNING transition was durably
       *  committed through the injected lifecycle commit port. False when
       *  the target was already RUNNING (no transition needed) or when no
       *  port is injected (the P6-T2 default wiring — the P7-T3 lifecycle
       *  module provides the port; the admission fact is still committed). */
      readonly lifecycleCommitted: boolean
      /** The durable fact sequence of the admission (always written). */
      readonly sequence: number
      /**
       * issue #1 / CCR-2: present ONLY on the async admission RECEIPT —
       * the Phase A durable admission is committed, Phase B/C still run
       * detached in the Team runtime; the terminal state is read back
       * through `work-status` / `team_collect` (CCR-3). Absent on every
       * other work-admitted effect (sync / replay / P6-T2 evidence keep
       * their exact shape — CCR-1).
       */
      readonly workStatus?: 'admitted'
      /** P8-S3 work chain: true when this token was already durably
       *  admitted AND durably settled by an earlier attempt — the call is a
       *  replay (zero writes, zero delivery; the at-least-once delivery
       *  contract's visible/deduped resolution, closure plan §CR2). */
      readonly replayed?: boolean
      /** P8-S3 work chain: true when the work unit reached the durable
       *  SETTLED state during this execution (or the replayed attempt). */
      readonly settled?: boolean
      /** P8-S3 work chain: the durable fact sequence of the settlement
       *  (`member-lifecycle-changed` with `to: 'SETTLED'`). */
      readonly settledSequence?: number
      /** v2 D2 (frozen by C1): the minimal member result carried by the
       *  work chain — present when the P8-S3 chain ran (full/resume: the
       *  port's normalized result; replay: the synthesized
       *  unavailable/WORK_REPLAYED result). Absent on the P6-T2 evidence
       *  path and on the fail-closed delivery-failure throw (no effect is
       *  formed then). `settled` above stays control-plane: it never
       *  implies `memberResult.status === 'succeeded'`. */
      readonly memberResult?: WorkDeliveryResult
    }
  /** A lifecycle operation was durably applied (archive/restore/dispose;
   *  the transition was committed through the injected lifecycle commit
   *  port — state first, evidence fact second). */
  | {
      readonly kind: 'lifecycle-changed'
      readonly instanceId: string
      readonly from: MemberLifecycleState
      readonly to: MemberLifecycleState
      /** The durable fact sequence (always written). */
      readonly sequence: number
    }
  /** A NEW member instance was created through the ActivationProvider
   *  (delegate-create / explicit create; invariant 25 fresh_per_delegation). */
  | {
      readonly kind: 'member-activated'
      readonly instanceId: string
      readonly templateId: string
      readonly childSessionId: string
      readonly operationId: string
      /** True when the activation was replayed from a durable row. */
      readonly replayed: boolean
      /** The provider's durable ledger sequence (when carried). */
      readonly ledgerSequence?: number
      /** The provider's work-gate admission code (pass-through: creation is
       *  committed regardless — the code reports the P5-T1 gate state). */
      readonly admissionCode?: string
      /** P8-S3 work chain: the durable fact sequence of the work admission
       *  on the newly activated instance (present when the work chain ran). */
      readonly workSequence?: number
      /** P8-S3 work chain: true when the work unit reached the durable
       *  SETTLED state during this execution. */
      readonly workSettled?: boolean
      /**
       * issue #1 / CCR-2: present ONLY on the async admission RECEIPT of
       * the delegate-create form — the Phase A durable admission on the
       * newly activated instance is committed, the work chain (Phase B/C)
       * still runs detached; the terminal state is read back through
       * `work-status` / `team_collect` (CCR-3). Absent on every other
       * member-activated effect (CCR-1).
       */
      readonly workStatus?: 'admitted'
      /** v2 D2 (frozen by C1): the minimal member result of the delegate
       *  create's work chain (the delegate-create runs the same chain as
       *  the follow-up — the same carriers, same semantics; `workSettled`
       *  above stays control-plane). */
      readonly memberResult?: WorkDeliveryResult
    }
  /**
   * The work-status view (issue #1 / CCR-3: the `work-status` read action
   * — the durable state of admitted work units by requestToken; the async
   * continuation's terminal result read-back, served losslessly).
   */
  | { readonly kind: 'work-status'; readonly entries: readonly WorkStatusEntry[] }
  /**
   * The per-capability effective policy view (inspect-config).
   *
   * A2C-3 (plan §10) + pre-alpha3 PR-F (plan §F.4): the read surface is
   * SAME-SOURCE with the runtime authority. `effective` is the canonical
   * effective policy of the SAME single assembly the live request
   * boundary and the host projection run — over the closed capability
   * set MINUS the generic `permissions` cell (the FAKE legacy cell; the
   * ACTUAL alpha.2 operation-permission authority is the independent
   * `operationPermissions` field, see {@link OperationPermissionView}).
   * `policyState` / `requirement` / `recovery` carry the DURABLE facts —
   * the committed PolicyState, the PR-E requirement / consent /
   * availability facts, and the DERIVED recovery state — read straight
   * from the TeamDomain (pure reads: the effect phase writes nothing and
   * never re-probes the gate chain). */
  | {
      readonly kind: 'config-inspected'
      /**
       * The effective policy cells over {@link CONFIG_INSPECTED_EFFECTIVE_CAPABILITIES}
       * (the closed set minus the generic `permissions` cell).
       */
      readonly effective: Record<string, PolicyEntry>
      /**
       * A2C-3 (plan §10): the ACTUAL alpha.2 operation permission of the
       * target — the bound template's static parameter-aware policy
       * (`boundTemplate.capabilities.permissions` → the TemplatePermission
       * Policy enforced by the pre-execute adapter). INDEPENDENT from the
       * legacy generic `effective.permissions` cell (which is no longer
       * surfaced at all — pre-alpha3 PR-F, plan §F.4). alpha.2 has no
       * dynamic permission mutation: the static policy IS the current
       * operation policy (no alpha.3 grants/overlays are invented).
       */
      readonly operationPermissions: OperationPermissionView
      /**
       * pre-alpha3 PR-F (plan §F.4): the COMMITTED PolicyState of the
       * inspected root (the same durable read the live boundary and the
       * host projection use).
       */
      readonly policyState: ConfigInspectedPolicyStateView
      /**
       * pre-alpha3 PR-F (plan §F.4): the DURABLE requirement / consent /
       * availability facts of the root (the PR-E RequirementAuthority
       * records + the durable compatibility verdict).
       */
      readonly requirement: ConfigInspectedRequirementView
      /**
       * pre-alpha3 PR-F (plan §F.4): the DERIVED recovery state (from the
       * durable PR-E incident facts — no durable "recovery" flag exists).
       */
      readonly recovery: ConfigInspectedRecoveryView
    }
  /** The member list view (list-members). */
  | {
      readonly kind: 'members-listed'
      readonly members: readonly {
        readonly instanceId: string
        readonly templateId: string
        readonly label: string
        /** Absent for the v2 LeaderInstance record. */
        readonly lifecycle?: MemberLifecycleState
        /** Absent for the v2 LeaderInstance record. */
        readonly childSessionId?: string
      }[]
    }
  /** The template list view (list-templates, from the bound blueprint). */
  | {
      readonly kind: 'templates-listed'
      readonly templates: readonly {
        readonly templateId: string
        readonly displayName: string
        readonly contextPolicy: string
      }[]
    }

/**
 * The lossless-JSON view of ONE stored static permission rule (A2C-3,
 * plan §10.2): the tool it gates and the resource it matches. Served in
 * the policy's STORED (declaration) order — the A1 normalization pin —
 * never re-sorted, duplicates preserved.
 */
export type OperationPermissionRuleView =
  | { readonly tool: string; readonly resource: { readonly kind: 'exact'; readonly path: string } }
  | { readonly tool: string; readonly resource: { readonly kind: 'subtree'; readonly path: string } }
  | { readonly tool: string; readonly resource: { readonly kind: 'any' } }

/**
 * The `operationPermissions` field of the `config-inspected` effect
 * (A2C-3, plan §10.2) — the ACTUAL alpha.2 operation permission of the
 * inspected target, independent from the legacy generic `effective` view.
 *
 * - `mode: 'static'` — the bound template declares `capabilities.permissions`:
 *   the rules AS STORED in the policy (deterministic declaration order) plus
 *   the FINAL closed vocabularies — `managedTools` = `PERMISSION_TOOL_NAMES`
 *   and `resourceKinds` = `PERMISSION_RESOURCE_KINDS` (imported from the
 *   domain blueprint constants, never hardcoded — no vocabulary drift);
 * - `mode: 'absent'` — the bound template declares no `permissions` (legacy
 *   / alpha.1 behavior: no parameter-permission enforcement installed).
 *
 * alpha.2 has no dynamic permission mutation: the static policy IS the
 * current operation policy (plan §10.3). NO alpha.3 `grants` / `overlays`
 * fields exist in this shape.
 */
export type OperationPermissionView =
  | {
      readonly mode: 'static'
      readonly default: 'ask' | 'deny'
      readonly allow: readonly OperationPermissionRuleView[]
      readonly ask: readonly OperationPermissionRuleView[]
      readonly deny: readonly OperationPermissionRuleView[]
      /** The FINAL closed managed-tool vocabulary (`PERMISSION_TOOL_NAMES`). */
      readonly managedTools: readonly string[]
      /** The FINAL closed resource-kind vocabulary (`PERMISSION_RESOURCE_KINDS`). */
      readonly resourceKinds: readonly string[]
    }
  | { readonly mode: 'absent' }

/** The successful outcome of one action (lossless JSON). */
export interface TeamRuntimeActionOutcome {
  /** Always `executed`; rejections are TeamRuntimeError throws. */
  readonly status: 'executed'
  /** The action name echoed. */
  readonly action: string
  /** The team (root) session id. */
  readonly rootSessionId: string
  /** The resolved caller role. */
  readonly callerRole: CallerRole
  /** The resolved target instance id (instance-targeted actions). */
  readonly targetInstanceId?: string
  /** The durable effect. */
  readonly effect: RuntimeActionEffect
  /** The request token echoed (audit identity). */
  readonly requestToken: string
}

// --- options -----------------------------------------------------------------------

/**
 * The injected durable commit port for member lifecycle transitions.
 *
 * The facade validates every transition against the domain/lifecycle FSM
 * and enforces the full documented admission order, but it NEVER rewrites
 * `member_instances` records itself: the store is append-only per record
 * (a different record at an occupied key is a conflict, P4), member records
 * are written exactly once by the ActivationProvider (invariant 26), and
 * the durable commit of lifecycle transitions — including the Architecture
 * §30 quiesce-then-commit procedures — is the P7-T3 lifecycle module's
 * surface (TaskDoc P7-T3: "quiescence 与 durable lifecycle一致").
 *
 * Without a port (the P6-T2 default wiring): lifecycle actions fail closed
 * with LIFECYCLE_COMMIT_UNAVAILABLE (zero durable writes) and work
 * admission commits its evidence fact with `lifecycleCommitted: false`.
 */
export interface LifecycleCommitPort {
  /**
   * Durably commit one FSM-validated lifecycle transition of an existing
   * member record.
   *
   * The commit is a compare-and-swap in the durable layer (R4/CR-10):
   * `args.expectedActivityVersion` is the row version the caller read
   * fresh; a concurrent writer that moved the row first makes the commit
   * fail (RECORD_DUPLICATE cas-mismatch) instead of silently overwriting.
   *
   * @param args - the exact transition, read fresh under the router lock.
   */
  commitTransition(args: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly expectedActivityVersion: number
    readonly from: MemberLifecycleState
    readonly operation: LifecycleOperation
    readonly to: MemberLifecycleState
  }): Promise<void>
}

// --- member work result (v2 D2; FROZEN by task C1) ---------------------------------

/**
 * The closed status vocabulary of the minimal member result (frozen, v2
 * task C1; plan §1.3 / §10-C1).
 *
 * - `succeeded`: the member turn genuinely completed AND a readable
 *   non-empty business body exists (`body` present);
 * - `failed`: the delivery/turn failed explicitly (turn reason
 *   error / aborted / max-tokens / blocked) — `error` carries a stable
 *   code + a user-visible message;
 * - `unavailable`: the turn completed but no readable business body is
 *   available, or the seam cannot determine the outcome — `error` carries
 *   the reason code.
 *
 * The control-plane settlement is SEPARATE: a settled work unit is not a
 * succeeded one. `settled: true` alone must NEVER be mapped to
 * `succeeded` anywhere in the Team surface.
 */
export const WORK_DELIVERY_STATUSES = ['succeeded', 'failed', 'unavailable'] as const

/** One of the closed member-result statuses. */
export type WorkDeliveryStatus = (typeof WORK_DELIVERY_STATUSES)[number]

/**
 * The minimal Team-owned structured delivery result (v2 D2 decision;
 * FROZEN by task C1 — the single shared DTO of the D2 result closure).
 *
 * It closes the user-visible gap: after a delegate/follow-up, the Leader
 * sees the member's business text or an explicit failure instead of only
 * `settled: true` (the control-plane settlement, which is NOT business
 * success). No transcript: exactly one delivered turn's normalized
 * outcome.
 *
 * Shape (lossless JSON; the Leader-facing tool/remote envelopes carry it
 * verbatim — `packages/tools` copies the effect, `packages/remote`
 * applies no field allowlist):
 *
 *   { requestToken, status, body?, error? }
 */
export interface WorkDeliveryResult {
  /** The requestToken the result correlates to, verbatim (the token the
   *  Leader used; echoed, never re-mapped). */
  readonly requestToken: string
  /** The closed status (see {@link WORK_DELIVERY_STATUSES}). */
  readonly status: WorkDeliveryStatus
  /** The member's business text (present ONLY for `succeeded`: the
   *  delivered turn's readable non-empty assistant text). */
  readonly body?: string
  /** The stable failure/unavailability code + user-visible message
   *  (present for `failed`/`unavailable`). */
  readonly error?: { readonly code: string; readonly message: string }
}

/**
 * One token's work-unit state as read from the durable facts (issue #1 /
 * CCR-3 — the `work-status` read action's entry; lossless JSON).
 *
 * The closed status set:
 *
 * - `running`: the admission fact exists and no settlement fact yet — the
 *   async continuation is in flight (or crashed before settlement: a
 *   same-token re-delegate RESUMES the unit instead of admitting a second
 *   one, `resumePossible: true`);
 * - `succeeded` / `failed` / `unavailable`: the unit is durably settled
 *   AND the settlement fact carries the persisted `memberResult`
 *   (CCR-5) — the status is the persisted `memberResult.status` verbatim
 *   (the control-plane settlement is NEVER mapped to a business status);
 * - `unavailable` WITHOUT a persisted memberResult (a settlement fact that
 *   predates the CCR-5 addendum): `error.code` carries the diagnostic
 *   (`WORK_RESULT_NOT_PERSISTED` / `WORK_DELIVERY_FAILED`) and
 *   `workOutcome` the durable control-plane outcome.
 */
export interface WorkStatusEntry {
  /** The queried requestToken, echoed. */
  readonly requestToken: string
  /** The closed status (see above). */
  readonly status: 'running' | WorkDeliveryStatus
  /** The instance the work unit runs on (from the durable facts). */
  readonly instanceId?: string
  /** The durable sequence of the admission fact. */
  readonly admittedSequence?: number
  /** The durable sequence of the settlement fact. */
  readonly settledSequence?: number
  /** The persisted member result (only when the settlement fact carries
   *  the CCR-5 `memberResult` — served verbatim). */
  readonly memberResult?: WorkDeliveryResult
  /** The durable work outcome of the settlement fact — present when the
   *  fact exists but carries no persisted memberResult (the diagnostic
   *  path keeps the control-plane outcome visible). */
  readonly workOutcome?: 'settled' | 'delivery-failed'
  /** True while `running`: a same-token re-delegate resumes the unit. */
  readonly resumePossible?: boolean
  /** The stable diagnostic code + message (`unavailable` entries without
   *  a persisted memberResult: `WORK_TOKEN_UNKNOWN` /
   *  `WORK_RESULT_NOT_PERSISTED` / `WORK_DELIVERY_FAILED`). */
  readonly error?: { readonly code: string; readonly message: string }
}

/**
 * The production work-delivery seam (P8-S3 R1/R6; v2 D2: now
 * result-returning). The ONLY path that submits the model-visible
 * prompt/attached-context of an admitted work request to the member's
 * child session, observes the turn's completion, and extracts/normalizes
 * the minimal member result (the frozen {@link WorkDeliveryResult}
 * contract).
 *
 * Absent in the P6-T2 default wiring (admission evidence only); the
 * production harness row installs it so delegate/follow-up actually reach
 * the child Agent. A delivery failure MUST throw: the work chain then
 * settles fail-closed (R6) — never a fake RUNNING success.
 */
export interface WorkDeliveryPort {
  /**
   * Deliver one admitted work request's prompt/context to the member's
   * child session, await the turn's completion, and normalize the turn
   * into the frozen WorkDeliveryResult (status per the turn's outcome:
   * succeeded only with a readable non-empty body; failed for an explicit
   * turn failure; unavailable when no readable body exists or the seam
   * cannot determine it; the requestToken echoed verbatim).
   * @param args - the delivery target and the request's model-visible
   *   content (requestToken doubles as the visible correlation for the
   *   at-least-once delivery contract's dedup).
   * @returns the normalized member result (the v2 C1 frozen DTO).
   * @throws on any delivery/observation failure (fail-closed settlement;
   *   no result in that case — the throw IS the signal).
   */
  deliver(args: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly childSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
    /** Transient cancellation signal for the live turn; never durable. */
    readonly signal?: unknown
    /**
     * The human-reviewed RECOVERY marker of this request (the router's
     * recovery dispatch: the reviewed re-run of a blocked action — NEVER
     * forgeable by the caller, produced exclusively after a durable
     * allow decision). Consumed by the delivery's requirement-aware
     * final-input verdict: a failed REQUIRED mcp server named in
     * `unavailableSubjects` is EXEMPT for the reviewed scope (the
     * human's decision stands even while the remount keeps failing).
     * Absent: no exemption.
     */
    readonly recovery?: {
      readonly scopeKeys: readonly string[]
      readonly unavailableSubjects: readonly string[]
    }
  }): Promise<WorkDeliveryResult>
}

/**
 * The in-facade activity-interval writer (P8-S3). Opens/closes the
 * activity interval of one admitted work unit by committing the guarded
 * interval fact directly — WITHOUT the report-progress facade (whose
 * performAction stage would re-enter the router's non-reentrant team lock
 * and deadlock) and WITHOUT a second lock map (the caller already holds
 * the router's team lock).
 */
export interface WorkActivityPort {
  /**
   * Open the work unit's activity interval (guarded commit only:
   * sequence head+1 claim, interval state guards, ledger fact).
   * @throws ACTIVITY_* domain errors (e.g. ACTIVITY_INTERVAL_ALREADY_OPEN).
   */
  openInterval(args: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly subject: string
    readonly requestToken: string
    readonly correlation: string
    readonly note?: string
  }): Promise<void>
  /**
   * Close the work unit's activity interval (guarded commit only).
   * @throws ACTIVITY_* domain errors (e.g. ACTIVITY_INTERVAL_NOT_OPEN).
   */
  closeInterval(args: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly subject: string
    readonly requestToken: string
    readonly correlation: string
    readonly closeNote?: string
  }): Promise<void>
}

/**
 * The facade ports (injected, mock-first; every durable write flows
 * through `teamDomain` — invariant 41).
 */
/**
 * Finding F (scoped identity, additive) — the per-template FEED CONTEXT the
 * requirement gate passes to the per-template live-read seams: WHICH team
 * root the boundary resolves under (`rootSessionId` — the multi-root host
 * shape: the port lists THAT root's member instances, never the entry's
 * boot root) and, for the ACTION's target template only, WHICH instance's
 * own boundary (`instanceId`) — the target's materialization is the
 * decision's truth (the healthy sibling must not mask the failed target,
 * and vice versa). The conservative scope read (the incident/recovery
 * bookkeeping) omits `instanceId` (the template-level worst case). Both
 * fields are optional: absent = the legacy single-root, template-only
 * contract (every pre-fix caller stays byte-identical).
 */
export interface TemplateFeedContext {
  /** The owning team root (the action's target root). */
  readonly rootSessionId?: string
  /** The action's target instance (the target-template decision read only). */
  readonly instanceId?: string
}

export interface TeamRuntimeOptions {
  /** The open TeamDomain (the durable control-plane authority, inv 41). */
  readonly teamDomain: import('../../storage/repositories/index.js').TeamDomain
  /** The P6-T1 ActivationProvider (the ONLY creation path, inv 26). */
  readonly activationProvider: import('../activation/index.js').ActivationProvider
  /** The immutable blueprint catalog (resolves the bound snapshot). */
  readonly blueprintCatalog: import('../../domain/blueprint/src/index.js').BlueprintCatalog
  /** The environment probe facts (compatibility gate, live evaluation). */
  readonly environmentFacts: () => Promise<
    readonly import('../../domain/compatibility/src/index.js').EnvironmentFact[]
  >
  /**
   * pre-alpha3 W3-A (review fix F1, guide §2.3) — the per-TEMPLATE scope
   * facts port (the live provider's template-boundary feed: supply + fresh
   * readiness + materialization). Present in the production host entry
   * world; ABSENT in factory/test worlds, where the gate evaluates every
   * scope against the single `environmentFacts` array (the legacy
   * behavior, byte-identical).
   */
  readonly templateEnvironmentFacts?: (
    templateId: string,
    // Finding F (scoped identity): the feed context (root + target
    // instance); optional — the legacy template-only contract stands
    // for every pre-fix caller.
    context?: TemplateFeedContext,
  ) => Promise<readonly import('../../domain/compatibility/src/index.js').EnvironmentFact[]>
  /**
   * PF-1 fix (2026-09-30, adjudicated product defect) — the per-BLUEPRINT
   * live environment-facts source (the SAME seam the remote surface's
   * `intent.probe` and the per-root compatibility prober consume): when
   * PRESENT the requirement gate resolves the live feed against the team
   * requirements of the REQUEST's bound blueprint — multi-blueprint hosts
   * (boot blueprint ≠ bound blueprint) keep the frozen INV-9.4 two-worlds
   * identity (the probe, the gate and the compatibility aggregate evaluate
   * the SAME world; a configured + healthy live server never probes
   * unreachable). When ABSENT the legacy single `environmentFacts` feed
   * stands (factory / single-blueprint worlds — byte-identical verdicts).
   */
  readonly environmentFactsForBlueprint?: (
    blueprint: import('../../domain/blueprint/src/index.js').TeamBlueprint,
  ) => Promise<readonly import('../../domain/compatibility/src/index.js').EnvironmentFact[]>
  /**
   * PF-1 fix (2026-09-30) — the per-BLUEPRINT per-template feed (the twin
   * of `templateEnvironmentFacts` scoped to the request's bound blueprint;
   * ABSENT in factory worlds — the legacy single-array gate stands,
   * byte-identical).
   */
  readonly templateEnvironmentFactsForBlueprint?: (
    blueprint: import('../../domain/blueprint/src/index.js').TeamBlueprint,
    templateId: string,
    // Finding F (scoped identity): the feed context (the owning root +
    // the target instance for the target-template decision read);
    // optional — the legacy template-only contract stands.
    context?: TemplateFeedContext,
  ) => Promise<readonly import('../../domain/compatibility/src/index.js').EnvironmentFact[]>
  /**
   * D-3 fix (2026-09-30, adjudicated product semantics — fail-closed
   * PENDING) — the per-BLUEPRINT FULL-RESOLUTION live read (the atomic
   * 3-state observations + 2-state feed pair of `resolveFacts`). When
   * PRESENT the requirement gate consumes THIS source: the feed half
   * drives the compatibility engine, the observations (the 3-state truth)
   * drive the PENDING rule (a REQUIRED capability whose live observation
   * is UNKNOWN is a typed PENDING block — never a seed-filled PASS; the
   * static seed remains bootstrap/display only, guide §2.5). When ABSENT
   * the facts-only ports stand (byte-identical; the PENDING rule is off —
   * no live probe ⇒ no pending materialization).
   */
  readonly environmentFactsReadForBlueprint?: (
    blueprint: import('../../domain/blueprint/src/index.js').TeamBlueprint,
  ) => Promise<import('../requirement-facts/index.js').RequirementFactsResolution>
  /**
   * D-3 fix (2026-09-30) — the per-BLUEPRINT per-template FULL-RESOLUTION
   * live read (the twin of `templateEnvironmentFactsForBlueprint`; same
   * presence/absence semantics).
   */
  readonly templateEnvironmentFactsReadForBlueprint?: (
    blueprint: import('../../domain/blueprint/src/index.js').TeamBlueprint,
    templateId: string,
    // Finding F (scoped identity): the feed context (the owning root +
    // the target instance for the target-template decision read);
    // optional — the legacy template-only contract stands.
    context?: TemplateFeedContext,
  ) => Promise<import('../requirement-facts/index.js').RequirementFactsResolution>
  /** The external hard facts (effective-config read, stage 2). */
  readonly externalPolicyFacts: () => Promise<
    import('../../domain/policy/src/index.js').ExternalPolicyFacts
  >
  /** The deployment default model (the `staticModel`) — REQUIRED (PR #30
   *  review-supplement P2-3, no longer silent-optional): the baseline the
   *  bound template's MODEL-ONLY `modelPreference` shorthand inherits its
   *  provider from in the `team_inspect_config` effective-policy read
   *  (the model-preference routing fix: the inspection resolves the SAME
   *  generic `templateValues` the live consumption and the activation
   *  step 8 feed the resolver). A bound template with an executable
   *  modelPreference MUST have a baseline (a missing baseline + present
   *  preference is a hard error at the derivation, P2-1/P2-3). An ABSENT
   *  preference still contributes no model grant with or without a
   *  baseline (no-preference behavior unchanged). */
  readonly staticModel: import('../agent-setup/model/index.js').ModelSelection
  /** THE CANONICAL INPUT (pre-alpha3 PR-B, plan §B.2) — the static policy
   *  authority (the production PolicyReader: the bound snapshot's
   *  blueprint envelope + per-member template policy + external hard
   *  facts). Absent = the pre-PR-B legacy inspect input
   *  (`externalPolicyFacts` + the template-derived static grants). */
  readonly policy?: import('../mutation/index.js').PolicyReader
  /** THE CANONICAL INPUT (pre-alpha3 PR-B, plan §B.2) — the durable
   *  PolicyState transitions of the addressed root (COMMIT order; the
   *  last entry is the committed state). Absent = the implicit
   *  `default` state (the pre-PR-B behavior). */
  readonly policyStateTransitions?: (
    rootSessionId: string,
  ) => readonly import('../mutation/index.js').PolicyStateTransitionRecord[]
  /** The deterministic clock (ISO-8601) for durable fact timestamps. */
  readonly now: () => string
  /** The lifecycle transition commit port (the P7-T3 lifecycle module).
   *  Absent in the P6-T2 default wiring: lifecycle actions then fail
   *  closed (LIFECYCLE_COMMIT_UNAVAILABLE) and work admission commits
   *  evidence only (`lifecycleCommitted: false`). */
  readonly lifecycleCommit?: LifecycleCommitPort
  /** The P7-T3 lifecycle step ports (P8-S3 R7/CR-9). When installed,
   *  router lifecycle actions (archive/restore/dispose) run the P7-T3
   *  step ordering — close admission → interrupt → quiesce/drain FIRST →
   *  release residency → commit — through these real ports under the
   *  router's own team lock. Absent in the P6-T2 default wiring: the
   *  router falls back to the direct CAS commit (previous behavior). */
  readonly lifecyclePorts?: import('../lifecycle/types.js').LifecyclePorts
  /** The production work-delivery seam (P8-S3 R1). Absent in the P6-T2
   *  default wiring: work admission commits evidence only. */
  readonly workDelivery?: WorkDeliveryPort
  /** The in-facade activity-interval writer (P8-S3). Absent in the P6-T2
   *  default wiring: no work-unit activity interval is opened/closed. */
  readonly workActivity?: WorkActivityPort
  /** The async work-completion (wake-up) notification port
   *  (work-completion-wakeup plan §6). After a DETACHED
   *  (`execution: 'async'`) work unit settles, the router's completion
   *  observer re-reads the durable work status and, when the terminal
   *  settlement fact exists, invokes this port (best-effort: the
   *  notification is a liveness edge, never a durable write, and a
   *  delivery failure is a liveness failure only). Absent (unit/fake
   *  worlds without a live Leader) → the work still executes and settles
   *  durably; there is simply no wake notification. The sync path NEVER
   *  invokes it (the tool result is the completion channel). */
  readonly workCompletionNotification?: import(
    '../work-completion-notification/index.js'
  ).WorkCompletionNotificationPort
  /** The P8-S5B shared team operation chain (the single CR-8 coordinator
   *  map). When installed, this runtime's per-team effect lock IS that
   *  shared chain: every durable effect — and, for NEW WORK admissions,
   *  the compatibility gate together with the effect in ONE acquisition
   *  (R5) — serializes with the other team-mutating operations the
   *  production root wires through the same map. Absent in the P6-T2
   *  default wiring: the runtime owns a private map (previous behavior). */
  readonly teamLocks?: Map<string, Promise<unknown>>
  /**
   * pre-alpha3 PR-E (plan §E.9) — the Control service LAZY REF for the
   * recovery dispatch: the production root wires the SAME ref object it
   * hands the control tools (the service is created lazily on first use —
   * the ref's `current` is `undefined` until then; a test world may wire a
   * pre-built service or omit the ref entirely — ABSENT = recovery
   * dispatch unavailable: a blocked normal-work attempt fails closed with
   * the typed block, no Control coupling). The ref (not the service) is
   * the wiring unit so the router never reorders the root's construction.
   */
  readonly controlServiceRef?: {
    readonly current?: import('../control/index.js').ControlService
  }
}

/**
 * The unified runtime/control action facade (the P6-T2 acceptance object:
 * "TeamRuntime is the control-action unified authority facade").
 */
export interface TeamRuntime {
  /**
   * Admit AND execute one action through the documented enforcement order.
   * Rejections throw {@link import('./errors.js').TeamRuntimeError} with a
   * closed code and ZERO durable side effects (resolution phase) or a
   * bounded documented partial commit (effect phase, see effects.ts).
   */
  performAction(request: TeamRuntimeActionRequest): Promise<TeamRuntimeActionOutcome>
}

// --- shared helpers -----------------------------------------------------------------

/**
 * The per-capability effective values of a resolved policy, in canonical
 * capability order (lossless-JSON view for `config-inspected`).
 *
 * Reuses the P6-T1 seam semantics: every closed capability appears exactly
 * once.
 */
export function effectivePolicyView(
  values: Record<string, PolicyEntry>,
  capabilities: readonly CapabilityName[],
): Record<string, PolicyEntry> {
  const view: Record<string, PolicyEntry> = {}
  for (const name of capabilities) {
    const entry = values[name]
    if (entry !== undefined) {
      view[name] = entry
    }
  }
  return view
}

/** A stable, lossless-JSON summary of one member record (list view). */
export function memberSummary(member: MemberInstanceRecordDto): {
  readonly instanceId: string
  readonly templateId: string
  readonly label: string
  readonly lifecycle?: MemberLifecycleState
  readonly childSessionId?: string
} {
  return {
    instanceId: member.instanceId,
    templateId: member.templateId,
    label: member.label,
    ...(member.lifecycle !== undefined ? { lifecycle: member.lifecycle } : {}),
    ...(member.childSessionId !== undefined ? { childSessionId: member.childSessionId } : {}),
  }
}

// --- pre-alpha3 PR-F (plan §F.4): the config-inspected same-source fact views ----

/**
 * The closed capability set of the `config-inspected` `effective` view
 * (pre-alpha3 PR-F, plan §F.4): the five closed capability domains MINUS
 * the generic `permissions` cell — the FAKE legacy cell that was the
 * five-domain "dynamic" authority. The ACTUAL alpha.2 operation-permission
 * authority is the independent `operationPermissions` field
 * ({@link OperationPermissionView}), so the generic cell is no longer
 * surfaced at all (neither displayed nor conflated).
 */
export const CONFIG_INSPECTED_EFFECTIVE_CAPABILITIES: readonly CapabilityName[] = CAPABILITY_NAME_VALUES.filter(
  (name) => name !== CAPABILITY_NAMES.PERMISSIONS,
)

/**
 * The `policyState` field of the `config-inspected` effect (pre-alpha3
 * PR-F, plan §F.4): the COMMITTED PolicyState of the inspected root —
 * the SAME durable read the live request boundary and the host projection
 * use (`committedPolicyState` over the durable transition rows): the last
 * committed transition in commit order, or the implicit blueprint
 * `default` state when no transition was ever committed.
 */
export interface ConfigInspectedPolicyStateView {
  /** The committed state id (`default` = the implicit blueprint state). */
  readonly stateId: string
  /**
   * `blueprint-default` — no durable transition row exists; the state is
   * the implicit blueprint default. `durable-transition` — the state was
   * committed by an explicit (human / authorized-leader) transition.
   */
  readonly source: 'blueprint-default' | 'durable-transition'
  /** The committed state's per-capability cells (absent cell = open). */
  readonly cells: Partial<Record<CapabilityName, PolicyStateCellView>>
  /**
   * Present for `durable-transition`: the durable entry that committed
   * the state + the authority origin of the transition (the frozen
   * `TeamValueOrigin` vocabulary).
   */
  readonly transition?: {
    readonly entryId: string
    readonly origin: TeamValueOrigin
  }
}

/**
 * Build the `policyState` view from the durable transition rows — the
 * SAME `committedPolicyState` fold the production root uses for the
 * projection's `policyState` cell (one read, one authority; no re-probe).
 *
 * @param transitions - the durable PolicyState transitions of the
 *   inspected root (COMMIT order; empty = never transitioned).
 */
export function configInspectedPolicyStateView(
  transitions: readonly PolicyStateTransitionRecord[],
): ConfigInspectedPolicyStateView {
  const { state, transition } = committedPolicyState(transitions)
  return {
    stateId: state.stateId,
    source: transition === null ? 'blueprint-default' : 'durable-transition',
    cells: { ...(state.cells ?? {}) },
    ...(transition === null
      ? {}
      : { transition: { entryId: transition.entryId, origin: transition.origin } }),
  }
}

/**
 * The `requirement` field of the `config-inspected` effect (pre-alpha3
 * PR-F, plan §F.4): the DURABLE requirement / consent / availability
 * facts of the inspected root — the SAME records the runtime
 * RequirementAuthority consumes. No re-probe: the gate chain re-evaluates
 * live at the boundary; this read surfaces the durable facts only:
 *
 * - `compatibility` — the durable compatibility verdict (the storage
 *   record, verbatim: status + fingerprint + generation + lossless
 *   requirement outcomes + the durable human acknowledgements);
 * - `consents` — the LATEST durable `optional-requirement-accepted` fact
 *   per requirement (the DegradationConsent — survives restart);
 * - `templateAvailability` — the LATEST durable `template-availability-set`
 *   fact per template (absent entry = the blueprint availability,
 *   unchanged).
 */
export interface ConfigInspectedRequirementView {
  /** The durable compatibility verdict (ABSENT = never probed). */
  readonly compatibility?: {
    readonly status: CompatibilityStatus
    readonly fingerprint: string
    readonly generation: number
    readonly outcomes: RemoteSafeRecord
    readonly acknowledgements: readonly CompatibilityAcknowledgement[]
    readonly computedAt: string
  }
  /** The latest durable consent per optional requirement (requirementId order). */
  readonly consents: readonly {
    readonly requirementId: string
    readonly consentedBy: string
    readonly consentedAt: number
  }[]
  /** The latest durable availability fact per template (templateId order). */
  readonly templateAvailability: readonly {
    readonly templateId: string
    readonly available: boolean
    readonly at: number
  }[]
}

/**
 * Build the `requirement` view from the durable compatibility record and
 * the PR-E requirement facts (ledger rows, SEQUENCE order — the latest
 * fact per key wins; the fail-closed parsers reject a corrupted row).
 *
 * @param compatibility - the durable compatibility state of the root
 *   (`undefined` = never probed).
 * @param ledgerEntries - the root's durable ledger entries (sequence
 *   order; the PR-E fact types are the only ones consumed).
 */
export function configInspectedRequirementView(
  compatibility: CompatibilityStateRecord | undefined,
  ledgerEntries: readonly LedgerEntry[],
): ConfigInspectedRequirementView {
  const latestConsentByRequirement = new Map<string, OptionalRequirementAccepted>()
  const latestAvailabilityByTemplate = new Map<string, TemplateAvailabilitySet>()
  for (const entry of ledgerEntries) {
    if (entry.factType === OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE) {
      const fact = parseOptionalRequirementAccepted(
        entry.payload,
        `ledger[${entry.sequence}].payload`,
      )
      latestConsentByRequirement.set(fact.requirementId, fact)
    } else if (entry.factType === TEMPLATE_AVAILABILITY_SET_FACT_TYPE) {
      const fact = parseTemplateAvailabilitySet(
        entry.payload,
        `ledger[${entry.sequence}].payload`,
      )
      latestAvailabilityByTemplate.set(fact.templateId, fact)
    }
  }
  const consents = [...latestConsentByRequirement.values()]
    .sort((a, b) => a.requirementId.localeCompare(b.requirementId))
    .map((fact) => ({
      requirementId: fact.requirementId,
      consentedBy: fact.consentedBy,
      consentedAt: fact.consentedAt,
    }))
  const templateAvailability = [...latestAvailabilityByTemplate.values()]
    .sort((a, b) => a.templateId.localeCompare(b.templateId))
    .map((fact) => ({ templateId: fact.templateId, available: fact.available, at: fact.at }))
  return {
    ...(compatibility === undefined
      ? {}
      : {
          compatibility: {
            status: compatibility.status,
            fingerprint: compatibility.fingerprint,
            generation: compatibility.generation,
            outcomes: { ...compatibility.outcomes },
            acknowledgements: [...compatibility.acknowledgements],
            computedAt: compatibility.computedAt,
          },
        }),
    consents,
    templateAvailability,
  }
}

/**
 * The `recovery` field of the `config-inspected` effect (pre-alpha3
 * PR-F, plan §F.4): the DERIVED recovery state — computed from the
 * durable PR-E incident facts, never stored (the authority negative:
 * recovery is DERIVED; a durable "recovery" flag does not exist):
 *
 * - `openIncidents` — the scopes whose LATEST incident fact is a
 *   `recovery-incident-opened` (the incident is still open);
 * - `lastClosed` — the most recent `recovery-incident-closed` fact per
 *   scope (the DURABLE RECORD of the exit — history, not live state);
 * - `active` — true when any recovery incident is currently open.
 */
export interface ConfigInspectedRecoveryView {
  /** The currently open incidents (scope order). */
  readonly openIncidents: readonly {
    readonly scope: string
    readonly requirementIds: readonly string[]
    readonly openedAt: number
  }[]
  /** The most recent closed incident per scope (scope order). */
  readonly lastClosed: readonly {
    readonly scope: string
    readonly requirementIds: readonly string[]
    readonly closedAt: number
  }[]
  /** Whether any recovery incident is currently open (derived). */
  readonly active: boolean
}

/**
 * Build the `recovery` view from the durable PR-E incident facts (ledger
 * rows, SEQUENCE order — the latest incident fact per scope decides; the
 * fail-closed parsers reject a corrupted row).
 *
 * @param ledgerEntries - the root's durable ledger entries (sequence
 *   order; the two incident fact types are the only ones consumed).
 */
export function configInspectedRecoveryView(
  ledgerEntries: readonly LedgerEntry[],
): ConfigInspectedRecoveryView {
  type IncidentFact =
    | { readonly kind: 'opened'; readonly fact: RecoveryIncidentOpened }
    | { readonly kind: 'closed'; readonly fact: RecoveryIncidentClosed }
  const latestByScope = new Map<string, IncidentFact>()
  for (const entry of ledgerEntries) {
    if (entry.factType === RECOVERY_INCIDENT_OPENED_FACT_TYPE) {
      const fact = parseRecoveryIncidentOpened(
        entry.payload,
        `ledger[${entry.sequence}].payload`,
      )
      latestByScope.set(fact.scope, { kind: 'opened', fact })
    } else if (entry.factType === RECOVERY_INCIDENT_CLOSED_FACT_TYPE) {
      const fact = parseRecoveryIncidentClosed(
        entry.payload,
        `ledger[${entry.sequence}].payload`,
      )
      latestByScope.set(fact.scope, { kind: 'closed', fact })
    }
  }
  const openIncidents: {
    readonly scope: string
    readonly requirementIds: readonly string[]
    readonly openedAt: number
  }[] = []
  const lastClosed: {
    readonly scope: string
    readonly requirementIds: readonly string[]
    readonly closedAt: number
  }[] = []
  for (const incident of latestByScope.values()) {
    if (incident.kind === 'opened') {
      openIncidents.push({
        scope: incident.fact.scope,
        requirementIds: [...incident.fact.requirementIds],
        openedAt: incident.fact.openedAt,
      })
    } else {
      lastClosed.push({
        scope: incident.fact.scope,
        requirementIds: [...incident.fact.requirementIds],
        closedAt: incident.fact.closedAt,
      })
    }
  }
  openIncidents.sort((a, b) => a.scope.localeCompare(b.scope))
  lastClosed.sort((a, b) => a.scope.localeCompare(b.scope))
  return {
    openIncidents,
    lastClosed,
    active: openIncidents.length > 0,
  }
}

// --- A2C-3 (plan §10): the real operation-permission view ------------------------

/**
 * One rule of a stored static permission policy, served as a lossless-JSON
 * view in its stored shape (A2C-3, plan §10.2).
 */
function operationPermissionRuleView(rule: PermissionRule): OperationPermissionRuleView {
  const resource = rule.resource
  if (resource.kind === 'any') {
    return { tool: rule.tool, resource: { kind: 'any' } }
  }
  if (resource.kind === 'subtree') {
    return { tool: rule.tool, resource: { kind: 'subtree', path: resource.path } }
  }
  return { tool: rule.tool, resource: { kind: 'exact', path: resource.path } }
}

/**
 * The lossless-JSON view of the BOUND template's static parameter-aware
 * operation permission policy (A2C-3, plan §10.2/§10.3) — the ACTUAL
 * alpha.2 operation-permission authority
 * (`boundTemplate.capabilities.permissions` → TemplatePermissionPolicy →
 * pre-execute adapter), independent from the legacy generic
 * `effective.permissions` cell.
 *
 * Deterministic: the lanes are served in the policy's STORED (declaration)
 * order — the A1 normalization pin — never re-sorted, duplicates
 * preserved. `managedTools` / `resourceKinds` are the FINAL closed
 * vocabularies from the domain blueprint constants
 * (`PERMISSION_TOOL_NAMES` / `PERMISSION_RESOURCE_KINDS`), so the view
 * cannot drift from the enforced vocabulary. alpha.2 has no dynamic
 * permission mutation: the static policy IS the current operation policy
 * (no alpha.3 grants/overlays are invented).
 *
 * @param template - the bound blueprint template entry of the inspected
 *   target (LeaderTemplate or MemberTemplate; the capabilities block is
 *   optional — absent = legacy mode, `mode: 'absent'`).
 */
export function operationPermissionView(
  template: { readonly capabilities?: { readonly permissions?: TemplatePermissionPolicy } },
): OperationPermissionView {
  const permissions = template.capabilities?.permissions
  if (permissions === undefined) {
    return { mode: 'absent' }
  }
  return {
    mode: 'static',
    default: permissions.default,
    allow: permissions.allow.map(operationPermissionRuleView),
    ask: permissions.ask.map(operationPermissionRuleView),
    deny: permissions.deny.map(operationPermissionRuleView),
    managedTools: [...PERMISSION_TOOL_NAMES],
    resourceKinds: [...PERMISSION_RESOURCE_KINDS],
  }
}
