/**
 * ActivationProvider contracts (TaskDoc §11.7 P6-T1; DevPlan §19.1–§19.2).
 *
 * The ActivationProvider is the SOLE entry point for every new
 * MemberInstance creation (Architecture §42 invariant 26): human-initiated
 * creation, leader-explicit creation, and leader delegation all flow through
 * the SAME admission/provisioning order. No other path may create a
 * MemberInstance record or its durable child Session binding — the G6 gate
 * "tool layer cannot bypass ActivationProvider/TeamRuntime" is verified
 * against exactly this surface.
 *
 * This module defines the frozen CONTRACT of the provider:
 *
 * - the closed activation SOURCE vocabulary (who initiated the activation);
 * - the activation REQUEST (one logical operation, identified by a stable
 *   `requestToken` — the stable operation identity of Architecture §18.2);
 * - the PORTS the provider is built with (mock-first per ruling R28; the
 *   TeamDomain repositories facade is the ONLY durable state boundary,
 *   invariant 41);
 * - the ACTIVATION RESULT (the committed MemberInstance record plus the
 *   activation provenance; or a read-only `continued` result when a
 *   delegation resolves to an existing instance).
 *
 * The provider OWNS no durable state of its own: every durable write goes
 * through the injected TeamDomain (invariant 41) via the P4-T4
 * provisioning coordinator, and every external effect goes through the
 * injected child-session factory (the single external effect of the
 * provisioning protocol).
 *
 * Pure contracts module: no I/O, no `node:` builtins, no live references.
 * @module @dsh-agent-team/runtime/activation/types
 */

import type {
  BlueprintCatalog,
} from '../../domain/blueprint/src/index.js'
import type {
  EnvironmentFact,
  CompatibilityStatus,
  WarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import type {
  ExternalPolicyFacts,
} from '../../domain/policy/src/index.js'
import type {
  MemberInstanceRecordDto,
} from '../../contracts/src/index.js'
import type {
  TeamDomain,
} from '../../storage/repositories/index.js'
import type {
  AdmissionGuard,
  OverlaySlot,
  OverlaySlotName,
  TeamAgentSetupSurface,
} from '../agent-setup/binder/index.js'
import type {
  SessionDurabilityPort,
} from '../member-residency/index.js'

// --- sources -------------------------------------------------------------------

/**
 * The closed activation SOURCE vocabulary (v1).
 *
 * Every new MemberInstance is created through the ActivationProvider by one
 * of these sources (invariant 26). The vocabulary is closed for contract v1:
 * a future phase (router/workflow) EXTENDS it through a domain-version
 * change, never a silent edit — and it still flows through this SAME entry
 * point.
 */
export const ACTIVATION_SOURCES = {
  /** The LeaderInstance explicitly creates a new member. */
  LEADER_EXPLICIT: 'leader-explicit',
  /** A leader delegation resolves to a NEW instance (contextPolicy
   *  `fresh_per_delegation` or no active instance for the template). */
  LEADER_DELEGATE: 'leader-delegate',
  /** A human adds a member through the team UI/API. */
  HUMAN_UI: 'human-ui',
} as const

/** One of the closed activation sources. */
export type ActivationSource = (typeof ACTIVATION_SOURCES)[keyof typeof ACTIVATION_SOURCES]

/** Every activation source value, for membership checks and closed-set tests. */
export const ACTIVATION_SOURCE_VALUES: readonly string[] = Object.values(ACTIVATION_SOURCES)

// --- request -------------------------------------------------------------------

/**
 * The delegation addressing of a `leader-delegate` activation
 * (Architecture §24.1 M1 shape): exactly one of the two forms.
 *
 * - instance-first: `explicitInstanceId` (the `templateId` must be absent —
 *   §24.1 resolves by identity alone, invariant 19);
 * - template-level: `templateId` (no explicit instance).
 */
export interface ActivationDelegation {
  /** Instance-first addressing: the exact instance to continue. */
  readonly explicitInstanceId?: string
  /** Template-level addressing: the template the delegation targets. */
  readonly templateId?: string
}

/**
 * One activation request: ONE logical operation.
 *
 * Identity: the `requestToken` is the caller's stable logical-operation
 * token (stable across retries of the same logical operation; different per
 * distinct logical operation). The provider derives the member's
 * `instanceId` DETERMINISTICALLY from `(rootSessionId, source,
 * requestToken)` — inside the journal protocol: the same token always maps
 * to the same instance id, the same operation id, and the same idempotency
 * key, which is what makes a crashed activation convergent on re-drive
 * (Architecture §18.2 stable operation identity; invariant 46).
 *
 * NOTE: the `instanceId` is never a request field. Instance identity is
 * allocated by the provider (task card: "allocate instanceId INSIDE the
 * journal protocol"); label/templateId/groupId are NOT identity
 * (invariant 19).
 */
export interface MemberActivationRequest {
  /** The TeamSession (root session id, invariant 9) the member is created in. */
  readonly rootSessionId: string
  /** Who initiated the activation (closed vocabulary). */
  readonly source: ActivationSource
  /** The member template to instantiate. REQUIRED for `leader-explicit` and
   *  `human-ui`; ABSENT for `leader-delegate` (the delegation names it). */
  readonly templateId?: string
  /** The delegation addressing. REQUIRED for `leader-delegate`; ABSENT for
   *  the other sources. */
  readonly delegation?: ActivationDelegation
  /** The member label (display only — NOT identity, invariant 19). */
  readonly label: string
  /** Optional grouping id (display only). */
  readonly groupId?: string
  /** Optional explicit workspace; absent = inherited from the TeamSession
   *  default (Architecture §21.2). */
  readonly workspace?: string
  /** The caller's stable logical-operation token (see module docs). */
  readonly requestToken: string
  /** The calling authority:
   *  - `leader-*` sources: the calling member instance id (must be the
   *    LeaderInstance, checked in step 4);
   *  - `human-ui`: the human principal id (optional; humans are the team
   *    owner and carry no agent-authority requirement). */
  readonly callerId?: string
  /** Optional compatibility WARNING acknowledgements passed through to the
   *  compatibility engine (Architecture §27.3; a valid ack degrades a
   *  BLOCKED_WARNING to DEGRADED_ACKNOWLEDGED). */
  readonly acknowledgements?: readonly WarningAcknowledgement[]
}

// --- ports ---------------------------------------------------------------------

/** The minimal child-session creation request (the one external effect). */
export interface ChildSessionCreationRequest {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly templateId: string
  readonly label: string
  readonly workspace?: string
}

/** The result of one child-session creation. */
export interface ChildSessionCreationResult {
  readonly childSessionId: string
}

/**
 * The child-session factory port — the ONE external effect of the
 * provisioning protocol behind the P4-T4 adapter seam (ruling R20).
 *
 * The REAL DSH public Agent/Session creation seam is bound to this port by a
 * later task (mock-first per R28). Implementations MUST be idempotent on
 * `(rootSessionId, instanceId)`: a re-drive after a crash between the
 * external effect and its durable record must return the SAME child session
 * id, never a second child (the adapter idempotency contract of the P4-T4
 * provisioning protocol).
 */
export interface ChildSessionFactoryPort {
  createChildSession(request: ChildSessionCreationRequest): Promise<ChildSessionCreationResult>
}

/**
 * The ports the ActivationProvider is built with (mock-first, R28).
 *
 * State boundary: `teamDomain` is the SOLE durable control-plane authority
 * (invariant 41) — the provider never touches any other durable store.
 * External-effect boundary: `childSessionFactory` is the only seam that
 * reaches outside the TeamDomain sidecar (the single external effect of the
 * provisioning protocol). Everything else is read-only input or a best-
 * effort side effect (projection).
 */
export interface ActivationPorts {
  /** The TeamDomain repositories facade (durable state boundary, invariant 41). */
  readonly teamDomain: TeamDomain
  /** The immutable blueprint catalog (step 2: resolve the bound snapshot). */
  readonly blueprintCatalog: BlueprintCatalog
  /** The environment-facts probe (step 6: compatibility). */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /** The external hard policy + capability-existence facts (step 8: policy
   *  resolver stage 2, Architecture §19.2/§19.6). */
  readonly externalPolicyFacts: () => Promise<ExternalPolicyFacts>
  /** The child-session factory (the one external effect; step 13). */
  readonly childSessionFactory: ChildSessionFactoryPort
  /** The session-durability barrier (step 13, UNCONDITIONAL; invariant 46). */
  readonly sessionDurability: SessionDurabilityPort
  /** The public Agent setup surface (post-commit binder install). */
  readonly surface: TeamAgentSetupSurface
  /** Optional overlay slot overrides for the binder (identity defaults fill
   *  the rest). */
  readonly slots?: Partial<Record<OverlaySlotName, OverlaySlot>>
  /** Optional admission guard (the work gate; the default admitting guard
   *  fills the rest). */
  readonly admissionGuard?: AdmissionGuard
  /** Optional projection publisher (step 16, best-effort). */
  readonly projectionPublisher?: (event: ActivationProjectionEvent) => void
  /** Optional clock (ISO-8601); absent = system clock. */
  readonly now?: () => string
}

// --- projection ------------------------------------------------------------------

/**
 * The activation projection event (step 16): the lossless-JSON view of a
 * committed activation, published AFTER the terminal commit.
 *
 * Projections are DERIVED views: they are reconstructable from the durable
 * TeamDomain state, so a publisher fault never fails the activation (the
 * durable commit is authoritative). The provider reports the publisher
 * outcome in the result instead.
 */
export interface ActivationProjectionEvent {
  readonly source: ActivationSource
  readonly rootSessionId: string
  readonly templateId: string
  readonly instanceId: string
  readonly childSessionId: string
  readonly operationId: string
  /** The ledger sequence of the commit fact (present once committed). */
  readonly ledgerSequence?: number
  /** `true` when this call re-drove an already-committed operation. */
  readonly replayed: boolean
  /** The work-gate state established by the binder admission decision. */
  readonly admitted: boolean
  /** The admission code channel (e.g. `ADMISSION_OPEN`). */
  readonly admissionCode?: string
  /** The contextPolicy frozen at creation (invariant 29). */
  readonly contextPolicy: string
  /** The effective workspace (explicit or inherited). */
  readonly workspace?: string
  /** The member record creation timestamp. */
  readonly createdAt: string
}

// --- result --------------------------------------------------------------------

/** The work-gate state of an activation (P5-T1 admission channel). */
export interface ActivationAdmissionState {
  readonly admitted: boolean
  /** The closed admission code (e.g. `ADMISSION_OPEN`, a guard rejection
   *  code, or `ADMISSION_GUARD_ERROR` for a guard fault). */
  readonly code?: string
}

/** The projection outcome of an activation. */
export interface ActivationProjectionState {
  readonly published: boolean
  /** The publisher fault (reported, never fatal). */
  readonly error?: string
}

/**
 * The result of an activation: the committed MemberInstance plus provenance.
 *
 * - `activated`: a new MemberInstance was created (or an in-flight/committed
 *   operation was re-driven to completion). `replayed` distinguishes the
 *   idempotent no-op (the operation was already COMMITTED at call time) from
 *   a call that completed the creation.
 * - `continued`: a `leader-delegate` activation resolved (via the pure M1–M5
 *   delegation mapping) to an EXISTING instance: no creation, no durable
 *   write, no projection (Architecture §11.2/§11.3, invariant 18/24:
 *   follow-up keeps the SAME instance and the SAME child Session).
 */
export type ActivationResult =
  | {
      readonly kind: 'activated'
      readonly source: ActivationSource
      readonly requestToken: string
      readonly templateId: string
      /** The committed MemberInstance record (contracts v1 DTO). */
      readonly member: MemberInstanceRecordDto
      readonly instanceId: string
      readonly childSessionId: string
      /** The durable operation id (the stable operation identity). */
      readonly operationId: string
      /** The ledger sequence of the commit fact (present once committed). */
      readonly ledgerSequence?: number
      /** `true` when the operation was already committed at call time
       *  (idempotent replay, zero new durable writes). */
      readonly replayed: boolean
      /** The contextPolicy frozen at creation (invariant 29). */
      readonly contextPolicy: string
      /** The effective workspace (explicit or inherited). */
      readonly workspace?: string
      /** The compatibility admission state of the NEW admission (absent on
       *  a re-drive of an already-admitted operation: the admission already
       *  happened and the environment may have changed since). */
      readonly compatibilityStatus?: CompatibilityStatus
      /** The policy state id consumed by the NEW admission (absent on
       *  re-drive). */
      readonly policyStateId?: string
      /** The work-gate state (post-commit binder admission decision). */
      readonly admission: ActivationAdmissionState
      /** The projection outcome (best-effort). */
      readonly projection: ActivationProjectionState
      readonly createdAt: string
    }
  | {
      readonly kind: 'continued'
      readonly source: ActivationSource
      readonly requestToken: string
      readonly templateId: string
      readonly instanceId: string
      /** The existing MemberInstance record (read-only). */
      readonly member: MemberInstanceRecordDto
      readonly childSessionId: string
      /** The contextPolicy of the template (immutable; equals the frozen
       *  creation-time policy of the continued instance). */
      readonly contextPolicy: string
      /** The effective workspace of the continued instance. */
      readonly workspace?: string
      readonly createdAt: string
    }

// --- provider --------------------------------------------------------------------

/** The ActivationProvider: the sole entry point for new MemberInstance creation (invariant 26). */
export interface ActivationProvider {
  /**
   * Activate: the full admission/provisioning order (DevPlan §19.2).
   *
   * - a NEW logical operation (no durable operation row for its derived
   *   instance id) runs the complete 11 read-only admission checks, then the
   *   durable provisioning (allocation inside the journal protocol, child
   *   creation + unconditional barrier, binding, commit), then the post-
   *   commit binder install and the best-effort projection;
   * - a RETRY of a logical operation whose durable operation row already
   *   exists (PREPARED or COMMITTED) re-drives the durable stages
   *   idempotently (roll-forward, never rollback) WITHOUT re-running the
   *   admission checks — the admission is recorded by the reservation
   *   itself, and a changed environment must not re-block an admitted
   *   operation.
   *
   * Fail-closed: every failure before the durable reservation leaves ZERO
   * durable writes; every failure after it leaves a resumable, convergent
   * state (re-drive via this same call or {@link recoverActivation}).
   */
  activate(request: MemberActivationRequest): Promise<ActivationResult>
  /**
   * Explicit recovery entry for a crashed/abandoned activation: the same
   * roll-forward re-drive as the retry path (no admission re-checks by
   * construction — the operation is already admitted). A request with no
   * durable operation row is treated as a new activation (the full order
   * runs).
   */
  recoverActivation(request: MemberActivationRequest): Promise<ActivationResult>
}
