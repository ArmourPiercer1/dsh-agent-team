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

import type {
  CapabilityName,
  PolicyEntry,
} from '../../domain/policy/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import type {
  MemberLifecycleState,
  MemberInstanceRecordDto,
} from '../../contracts/src/index.js'

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
    }
  /** The per-capability effective policy view (inspect-config). */
  | { readonly kind: 'config-inspected'; readonly effective: Record<string, PolicyEntry> }
  /** The member list view (list-members). */
  | {
      readonly kind: 'members-listed'
      readonly members: readonly {
        readonly instanceId: string
        readonly templateId: string
        readonly label: string
        readonly lifecycle: MemberLifecycleState
        readonly childSessionId: string
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

/**
 * The production work-delivery seam (P8-S3 R1/R6). The ONLY path that
 * submits the model-visible prompt/attached-context of an admitted work
 * request to the member's child session and observes the turn's completion.
 *
 * Absent in the P6-T2 default wiring (admission evidence only); the
 * production harness row installs it so delegate/follow-up actually reach
 * the child Agent. A delivery failure MUST throw: the work chain then
 * settles fail-closed (R6) — never a fake RUNNING success.
 */
export interface WorkDeliveryPort {
  /**
   * Deliver one admitted work request's prompt/context to the member's
   * child session and await the turn's completion.
   * @param args - the delivery target and the request's model-visible
   *   content (requestToken doubles as the visible correlation for the
   *   at-least-once delivery contract's dedup).
   * @throws on any delivery/observation failure (fail-closed settlement).
   */
  deliver(args: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly childSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
  }): Promise<void>
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
  /** The external hard facts (effective-config read, stage 2). */
  readonly externalPolicyFacts: () => Promise<
    import('../../domain/policy/src/index.js').ExternalPolicyFacts
  >
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
  /** The P8-S5B shared team operation chain (the single CR-8 coordinator
   *  map). When installed, this runtime's per-team effect lock IS that
   *  shared chain: every durable effect — and, for NEW WORK admissions,
   *  the compatibility gate together with the effect in ONE acquisition
   *  (R5) — serializes with the other team-mutating operations the
   *  production root wires through the same map. Absent in the P6-T2
   *  default wiring: the runtime owns a private map (previous behavior). */
  readonly teamLocks?: Map<string, Promise<unknown>>
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
  readonly lifecycle: MemberLifecycleState
  readonly childSessionId: string
} {
  return {
    instanceId: member.instanceId,
    templateId: member.templateId,
    label: member.label,
    lifecycle: member.lifecycle,
    childSessionId: member.childSessionId,
  }
}
