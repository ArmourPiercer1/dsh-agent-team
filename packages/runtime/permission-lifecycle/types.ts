/**
 * Alpha.3 PR4 — the permission LIFECYCLE lane: the closed vocabulary.
 *
 * The five-PR split of the Alpha.3 permission governance capability lands
 * here at PR4. PR1 shipped the durable `PermissionOverlaySnapshot` and its
 * persistence-only port; PR2 the `EffectivePermissionAssembler`; PR3 the ONE
 * mutation authority (`GovernanceMutationService.mutatePermission`) with the
 * pure kernel. PR4 is the PR the PR1 port doc already names
 * (`permission-governance/port.ts`: "the lifecycle rules (ADR §5, §8) belong
 * to the mutation service and to PR4"): it makes the durable authority
 *usable across the MemberInstance lifecycle WITHOUT owning any of it:
 *
 * - **NO second mutation authority.** `grant` / `revoke` here are typed
 *   ENTRY points that build a `GovernancePermissionMutationArgs` and hand it
 *   to `GovernanceMutationService.mutatePermission` — the sole permission
 *   mutation authority (ADR §1/§5). This lane performs ZERO durable writes
 *   of its own: it never touches the overlay port's `append`, and the port
 *   (three members: `append`/`latest`/`history`) stays the only durable
 *   write target. The `a3p3-governance-lane-hygiene` consumer pin therefore
 *   still holds in substance: one authority, one write path.
 * - **NO delete, NO replay, NO inheritance** (plan PR4 "revoke creates
 *   snapshot; no delete; no inheritance"; ADR §2 "History: audit only",
 *   "No event replay is used for execution"). Revoking appends a NEW FULL
 *   snapshot; nothing is ever removed, and no new MemberInstance ever reads
 *   another instance's overlay (the overlay identity is
 *   `(teamSessionId, memberInstanceId)` and the port reads per-identity).
 * - **Restore is a LIFECYCLE fact, not a permission write** (parent ruling,
 *   ADR §8): restore is the SAME MemberInstance returning from `ARCHIVED`;
 *   it KEEPS the CURRENT latest overlay. No historical snapshot is replayed,
 *   no revoked grant is resurrected, and NO decorative rule write happens
 *   "so that it went through a mutation". If — and only if — the rules must
 *   genuinely change at restore time, the caller submits that change as an
 *   ordinary `PermissionMutation` through the authority.
 * - **The read plane stays the merged two-stage plane** (ADR §3): this lane
 *   loads the LATEST overlay and hands it to PR2's
 *   `assembleEffectivePermissionPolicy` + `resolveEffectiveOperationPermission`,
 *   which call the FROZEN Alpha.2 `resolveOperationPermission`. This lane
 *   implements NO precedence of its own.
 *
 * Execution gating follows ADR §8 verbatim:
 *
 *     RUNNING   — overlay effective
 *     ARCHIVED  — overlay retained; execution disabled
 *     DISPOSED  — overlay historical only; never effective
 *     new instance — no inheritance
 *
 * The gate is therefore a refusal to EXECUTE, never a deletion or a rewrite:
 * an ARCHIVED instance's overlay is untouched and the SAME instance that
 * returns from ARCHIVED continues under the authority that is current at
 * that moment.
 *
 * Pure by construction: zero `node:` builtins, zero upstream imports, zero
 * I/O. Every durable/runtime fact arrives through an injected port.
 *
 * @module @dsh-agent-team/runtime/permission-lifecycle/types
 */

import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js'
import type { EffectivePermissionDecision, EffectivePermissionStaticLayer } from '../effective-policy/permission-assembler.js'
import type { LifecycleStepName } from '../lifecycle/types.js'
import type { PermissionLane } from '../operation-permission/permission-resolver.js'
import type { CanonicalOperation } from '../operation-permission/types.js'
import type {
  GovernancePermissionMutationArgs,
  GovernancePermissionMutationResult,
} from '../governance/types.js'
import type {
  PermissionOverlayRule,
  PermissionOverlaySnapshot,
} from '../permission-governance/types.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'

// ---------------------------------------------------------------------------
// The refusal vocabulary (typed, closed, never a silent no)
// ---------------------------------------------------------------------------

/**
 * The closed codes this lane may refuse with. Every one of them is a
 * fail-closed refusal with a ZERO-WRITE guarantee: the lane refuses BEFORE
 * it calls the mutation authority, BEFORE it calls the lifecycle path, or
 * (for the read plane) BEFORE any decision is reported.
 */
export const PERMISSION_LIFECYCLE_ERROR_CODES = Object.freeze({
  /** The addressed MemberInstance has no durable row in this TeamSession. */
  INSTANCE_UNKNOWN: 'PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN',
  /** The addressed MemberInstance is DISPOSED: its overlay is historical
   *  only (ADR §8), so a NEW mutation against it is meaningless and refused. */
  TARGET_TERMINAL: 'PERMISSION_LIFECYCLE_TARGET_TERMINAL',
  /** Execution refused: the instance is ARCHIVED (overlay retained,
   *  execution disabled — ADR §8). */
  EXECUTION_ARCHIVED: 'PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED',
  /** Execution refused: the instance is DISPOSED (terminal). */
  EXECUTION_TERMINAL: 'PERMISSION_LIFECYCLE_EXECUTION_TERMINAL',
  /** Execution refused: the instance lifecycle is UNKNOWN (no row). Unknown
   *  is never treated as RUNNING and never as ARCHIVED. */
  EXECUTION_STATE_UNKNOWN: 'PERMISSION_LIFECYCLE_EXECUTION_STATE_UNKNOWN',
  /** The restore path is not wired (no lifecycle port injected): restore is
   *  refused rather than performed by any substitute path. */
  RESTORE_UNCONFIGURED: 'PERMISSION_LIFECYCLE_RESTORE_UNCONFIGURED',
  /** The decision site supplied NO static permission facts. UNKNOWN lower
   *  layers are never conflated with a declared-none baseline (the PR3
   *  kernel's ruling), so no effective answer is reported. */
  STATIC_FACTS_UNKNOWN: 'PERMISSION_LIFECYCLE_STATIC_FACTS_UNKNOWN',
  /** A durable overlay rule's carrier cannot be projected onto the canonical
   *  matcher vocabulary for this decision. The rule is never silently
   *  dropped (a dropped deny would retire it) — the decision refuses. */
  OVERLAY_VIEW_UNDECODABLE: 'PERMISSION_LIFECYCLE_OVERLAY_VIEW_UNDECODABLE',
  /** The current authority carries an EXEC-class rule that would govern THIS
   *  decision, but the frozen Alpha.2 matcher is structurally inert for
   *  exec identities (`ruleMatches` requires a `kind:'file'` resource for an
   *  `exact` rule — the recorded bash ruling). Consuming it would need an
   *  exec-identity plane this PR does not own; the lane refuses typed
   *  instead of answering with a rule it cannot judge. */
  EXEC_PLANE_UNAVAILABLE: 'PERMISSION_EXEC_OVERLAY_PLANE_UNAVAILABLE',
  /** The PR2 assembler refused the assembly (a foreign snapshot, an
   *  incomplete view, a malformed section). Never guessed around. */
  ASSEMBLY_FAILED: 'PERMISSION_LIFECYCLE_ASSEMBLY_FAILED',
} as const)

export type PermissionLifecycleErrorCode =
  (typeof PERMISSION_LIFECYCLE_ERROR_CODES)[keyof typeof PERMISSION_LIFECYCLE_ERROR_CODES]

/** A typed refusal of this lane (never a bare `Error`, never a silent no). */
export class PermissionLifecycleError extends Error {
  readonly code: PermissionLifecycleErrorCode
  readonly details: Readonly<Record<string, unknown>>
  constructor(
    code: PermissionLifecycleErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'PermissionLifecycleError'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

// ---------------------------------------------------------------------------
// Ports (every fact injected)
// ---------------------------------------------------------------------------

/**
 * The durable lifecycle FACT of one MemberInstance, read through the
 * production root's own member-instance repository. `undefined` = no row
 * (unknown instance) — a distinct state from every lifecycle value, and
 * never treated as "allowed".
 */
export interface MemberLifecycleReaderPort {
  /**
   * @param teamSessionId - the owning TeamSession.
   * @param memberInstanceId - the addressed MemberInstance.
   * @returns the durable lifecycle state, or `undefined` when the instance
   *   does not belong to (or exist in) this TeamSession.
   */
  readLifecycle(
    teamSessionId: string,
    memberInstanceId: string,
  ): MemberLifecycleState | undefined | Promise<MemberLifecycleState | undefined>
}

/** The PR3 carrier matcher, decoded from the overlay rule's resource text. */
export interface PermissionCarrierMatcher {
  readonly kind: 'exact' | 'subtree' | 'fingerprint'
  readonly resource: string
}

/**
 * The carrier decoder the composition root injects — production passes the
 * governance lane's own `parsePermissionResourceText`, so the carrier grammar
 * stays owned by PR3 (this lane never re-implements the prefix rules; the
 * assembler's docstring says the same: the consumer "builds that view exactly
 * the way it builds CanonicalRules for A3 today").
 */
export type PermissionCarrierDecoder = (text: string) => PermissionCarrierMatcher | undefined

/**
 * The per-decision subtree judgement for the OVERLAY layer: does the stored
 * subtree root contain THIS decision's operation?
 *
 * `undefined` = undeterminable (no seam, no handle for the stored root, a
 * provider fault). The lane never maps undeterminable to `false` silently:
 * the A5 lane asymmetry is applied (a deny/ask restriction is never dropped,
 * an allow is never assumed) and the row is observed.
 */
export type OverlaySubtreeContainment = (
  subtreeRootKey: string,
  operation: { readonly tool: string; readonly key: string },
) => boolean | undefined | Promise<boolean | undefined>

/** The lifecycle path this lane rides for restore (the EXISTING one). */
export interface PermissionLifecycleRestorePort {
  /**
   * ARCHIVED -> SETTLED, one durable commit, zero live contact (G7). The
   * lane adds NOTHING to this transition and performs no permission write
   * around it; a typed lifecycle error (`LIFECYCLE_ILLEGAL_STATE`) propagates
   * verbatim to the caller.
   */
  restore(target: {
    readonly rootSessionId: string
    readonly instanceId: string
  }): Promise<{ readonly member: MemberInstanceRecordDto; readonly steps: readonly LifecycleStepName[] }>
}

// ---------------------------------------------------------------------------
// The mutation lane (write plane)
// ---------------------------------------------------------------------------

/** grant/revoke share the authority's argument shape; only `kind` is added. */
export type PermissionLifecycleGrantArgs = Omit<GovernancePermissionMutationArgs, 'kind'>

/** One restore request (the SAME instance returning from ARCHIVED). */
export interface PermissionLifecycleRestoreArgs {
  readonly teamSessionId: string
  readonly memberInstanceId: string
  /**
   * OPTIONAL, and only for a GENUINE rule change decided at restore time:
   * it is submitted as an ordinary PermissionMutation through the authority
   * (its own kind, its own snapshot). Absent = a PURE lifecycle restore,
   * which writes NOTHING to the overlay (parent ruling; ADR §8 "restore: the
   * same MemberInstance resumes").
   */
  readonly ruleChange?: Omit<GovernancePermissionMutationArgs, 'teamSessionId' | 'memberInstanceId'>
}

/** The outcome of one restore. */
export interface PermissionLifecycleRestoreResult {
  /** The committed MemberInstance record (lifecycle SETTLED). */
  readonly member: MemberInstanceRecordDto
  /** The lifecycle trace (exactly `[commit-restore]` — the G7 evidence). */
  readonly steps: readonly LifecycleStepName[]
  /** The CURRENT latest overlay after the restore. For a pure restore this
   *  is byte-identical to the one taken before it. */
  readonly overlay: PermissionOverlaySnapshot | undefined
  /** True ONLY when a genuine `ruleChange` produced a snapshot through the
   *  authority; `false` for every pure lifecycle restore. */
  readonly wroteSnapshot: boolean
  /** The authority's answer when (and only when) a rule change was submitted. */
  readonly mutation?: GovernancePermissionMutationResult
}

/** The write-plane entry lane. Zero durable writes of its own. */
export interface PermissionLifecycleMutationLane {
  /** `grant_instance` through the authority (a NEW snapshot). */
  grantInstance(args: PermissionLifecycleGrantArgs): Promise<GovernancePermissionMutationResult>
  /** `revoke_permission` through the authority (a NEW snapshot; never a delete). */
  revoke(args: PermissionLifecycleGrantArgs): Promise<GovernancePermissionMutationResult>
  /** The SAME instance returning from ARCHIVED; keeps the current authority. */
  restore(args: PermissionLifecycleRestoreArgs): Promise<PermissionLifecycleRestoreResult>
}

/** The mutation lane's dependencies. */
export interface PermissionLifecycleMutationLaneDeps {
  /** The ONE permission mutation authority (root.ts's governance service). */
  readonly governance: {
    mutatePermission(args: GovernancePermissionMutationArgs): Promise<GovernancePermissionMutationResult>
  }
  /** The durable member-instance lifecycle facts (target validation). */
  readonly members: MemberLifecycleReaderPort
  /** The overlay read seam — used for `latest` ONLY (this lane never appends). */
  readonly overlay: Pick<PermissionOverlayRepositoryPort, 'latest'>
  /** The EXISTING member lifecycle path (restore rides it). Absent = restore
   *  refuses with RESTORE_UNCONFIGURED (never a substitute transition). */
  readonly lifecycle?: PermissionLifecycleRestorePort
}

// ---------------------------------------------------------------------------
// The decision lane (read plane)
// ---------------------------------------------------------------------------

/** The decision site's freshly canonicalized STATIC layers (ADR §3 Stage 1's
 *  static inputs). Supplied by the caller because ONLY the decision site can
 *  produce them: canonicalization is per-decision and provider-relative
 *  (Alpha.2 H4 — no cache, ever). `undefined` = UNKNOWN (refused, never
 *  conflated with a declared-none baseline). */
export interface PermissionDecisionStaticFacts {
  readonly blueprint?: EffectivePermissionStaticLayer
  readonly template?: EffectivePermissionStaticLayer
}

/** One canonical-operation decision request. */
export interface PermissionDecisionRequest {
  readonly teamSessionId: string
  readonly memberInstanceId: string
  /** The A2 canonical operation of THIS decision (already canonicalized by
   *  the decision site — this lane never canonicalizes and never caches). */
  readonly operation: CanonicalOperation
  readonly staticFacts?: PermissionDecisionStaticFacts
  /** The per-decision subtree judgement (the decision site's own opaque
   *  handles). Absent = every overlay subtree rule is undeterminable. */
  readonly containment?: OverlaySubtreeContainment
}

/**
 * The governance kernel's static-facts vocabulary (the exec plane's lower
 * layers). MIRRORS `governance/permission-mutation.ts`'s
 * `PermissionStaticLayerFacts` STRUCTURALLY — the same no-runtime-edge
 * discipline the kernel itself applies to the PR1 rule-set bound (it mirrors
 * `PERMISSION_OVERLAY_MAX_RULES` rather than importing it), so this lane keeps
 * zero runtime edge into the governance lane; the production root injects the
 * kernel's own function and the structural type is what makes that injection
 * type-checked.
 */
export interface PermissionKernelStaticLayerRule {
  readonly operationClass: string
  readonly matcher: {
    readonly kind: 'exact' | 'subtree' | 'fingerprint' | 'any'
    readonly resource?: string
  }
  readonly effect: PermissionLane
}

/** One declared static layer in the kernel's vocabulary. */
export interface PermissionKernelStaticLayer {
  readonly label?: string
  readonly default: 'ask' | 'deny'
  readonly rules: readonly PermissionKernelStaticLayerRule[]
}

/** The lower-layer facts (`{ layers: [] }` = DECLARED-NONE, never UNKNOWN). */
export interface PermissionKernelStaticFacts {
  readonly layers: readonly PermissionKernelStaticLayer[]
}

/** The kernel's three-state region answer (unknown never answers). */
export type PermissionKernelAnswer =
  | { readonly status: 'decided'; readonly effect: PermissionLane; readonly source: 'overlay' | 'layer' | 'fallback' }
  | { readonly status: 'context-unavailable' }

/**
 * The exec plane: the governance kernel's exported pure effective-answer
 * algebra (`permissionEffectiveAnswer` in production). Injected, never
 * re-implemented — see the decision-lane module doc for why the exec plane
 * cannot go through the frozen Alpha.2 matcher.
 */
export interface PermissionEffectiveAnswerPort {
  (query: {
    readonly overlayRules: readonly PermissionOverlayRule[]
    readonly staticFacts: PermissionKernelStaticFacts | undefined
    readonly operationClass: string
    readonly region: PermissionCarrierMatcher
  }): PermissionKernelAnswer
}

/** The lifecycle gate verdict (pure, exported for direct pinning). */
export type PermissionLifecycleGateVerdict =
  | { readonly allowed: true; readonly state: MemberLifecycleState }
  | { readonly allowed: false; readonly code: PermissionLifecycleErrorCode; readonly state: MemberLifecycleState | undefined; readonly reason: string }

/** Which merged pure plane answered an effective decision (module doc). */
export type PermissionDecisionPlane = 'file' | 'exec'

/** The layer that decided, in the closed layer vocabulary. */
export type PermissionDecisionLayer = 'overlay' | 'template' | 'blueprint'

/** The read-plane outcome. */
export type PermissionDecisionOutcome =
  | {
      readonly kind: 'effective'
      /** The plane that answered (module doc: filespace = PR2 assembler +
       *  the frozen Alpha.2 resolver; execspace = the governance kernel's
       *  pure effective-answer algebra over the fingerprint region). */
      readonly plane: PermissionDecisionPlane
      /** The EFFECTIVE effect — the only field enforcement consumes. */
      readonly effect: PermissionLane
      /** `'rule'` = a layer's rule answered; `'default'` = the fallback. */
      readonly source: 'rule' | 'default'
      /** The layer that answered; `null` when the fallback answered. */
      readonly winningLayer: PermissionDecisionLayer | null
      /** A deterministic one-line explanation (audit/observation only). */
      readonly explanation: string
      /** The durable lifecycle state the decision was made under. */
      readonly lifecycleState: MemberLifecycleState
      /** The overlay generation that answered (`null` = no overlay yet). */
      readonly overlayGeneration: number | null
      /** Filespace only: the assembler's FULL Stage-2 decision (layer-by-layer
       *  outcomes, overridden lower layers, the deciding rule's provenance
       *  including the overlay snapshot). Audit/evidence; enforcement reads
       *  `effect`. */
      readonly effective?: EffectivePermissionDecision
    }
  | {
      readonly kind: 'refused'
      readonly code: PermissionLifecycleErrorCode
      readonly reason: string
      readonly lifecycleState: MemberLifecycleState | undefined
      readonly details?: Record<string, unknown>
    }

/** The read-plane lane. */
export interface PermissionDecisionLane {
  /** ADR §8 execution gate + ADR §3 two-stage read plane. */
  decide(request: PermissionDecisionRequest): Promise<PermissionDecisionOutcome>
}

/** The decision lane's dependencies. */
export interface PermissionDecisionLaneDeps {
  /** The PR1 port — `latest` is the authority; `history` is never consulted
   *  for a decision (ADR §2: history is audit-only). */
  readonly overlay: Pick<PermissionOverlayRepositoryPort, 'latest'>
  /** The durable member-instance lifecycle facts (the execution gate). */
  readonly members: MemberLifecycleReaderPort
  /** The carrier decoder (production: the governance lane's parser). */
  readonly decodeResource: PermissionCarrierDecoder
  /** The exec (fingerprint) plane. OPTIONAL by construction: a world that
   *  does not inject it refuses exec decisions typed (`EXEC_PLANE_UNAVAILABLE`)
   *  instead of answering them with the file matcher, which is structurally
   *  unable to see a fingerprint rule. Production injects the governance
   *  kernel's exported `permissionEffectiveAnswer`. */
  readonly effectiveAnswer?: PermissionEffectiveAnswerPort
}
