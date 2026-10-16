/**
 * THE PR0 INTERFACE FREEZE POINTS — `OperationAdmission`, `ControlledFs`,
 * `ConfinedProcessProvider`, `ProviderGateway` (plan §3: "接口冻结点…PR3/PR4
 * 可据此并行"; design §4.3's pipeline, host-neutral).
 *
 * These are TYPES ONLY, frozen by this PR so PR3 (Trusted Controlled FS) and
 * PR4 (Confined Process) can build against them in parallel, and PR2 can wire
 * admission without waiting for either. What the pipeline guarantees, restated
 * as shape constraints:
 *
 *  - ADMISSION BEFORE BODY: `OperationAdmission.admit` is awaited before any
 *    effecting call; an `admitted` decision carries the single-use grant, a
 *    `requires-approval` decision carries the WHOLE immutable
 *    `RequestedEffectSet` (the approver legally covers all effects or none,
 *    design §4.2), a `denied` decision carries a typed §5 error. There is no
 *    arm meaning "run first, decide later".
 *  - GRANT-PER-CALL, NO SHARED MUTABLE STATE: every effecting method takes
 *    the grant it executes under as a parameter (design §3.1: 禁止 Agent 共享
 *    可变 `currentGrant`).
 *  - NO FALLBACK BY CONSTRUCTION: capability probing is a separate call
 *    returning the provider's honest per-dimension assurance; `spawn` refuses
 *    `SANDBOX_UNAVAILABLE` before any process exists — the interface cannot
 *    express "sandbox failed, run naked".
 *  - CANCELLATION IS NOT TERMINATION: provider cancels settle to a lease
 *    status, and `EXECUTION_TERMINATION_UNCONFIRMED` keeps its `sideEffectUnknown`
 *    honest.
 *  - DOMAIN VETO SURVIVES THE ROUND TRIP: a gateway receipt carries the
 *    Domain Authority's own answer; `TeamPermit ∧ DomainPermit` is evaluated
 *    where the effect commits, and Team approval can never overwrite it.
 *
 * Purity: no `node:*`, no I/O — implementations arrive in PR3/PR4/PR7.
 *
 * @module @dsh-agent-team/domain/tool-governance/interfaces
 */

import type { AssuranceDimension, AssuranceLevel } from './assurance.js'
import type { GovernanceError, GovernanceResult } from './errors.js'
import type { ExecutionLease } from './lease.js'
import type { MemberRef, OperationGrant } from './grant.js'
import type { RequestedEffectSet } from './effects.js'
import type { ResourceRef } from './resource.js'
import type { ToolBinding } from './binding.js'

// ---------------------------------------------------------------------------
// OperationAdmission (PR2 wires; PR0 freezes)
// ---------------------------------------------------------------------------

/** One admission request: the call as the Guard sees it, pre-body. */
export interface AdmissionRequest {
  readonly binding: ToolBinding
  readonly member: MemberRef
  readonly callId: string
  readonly realmId: string
  /** The canonical parameter fingerprint (Alpha.2 canonical-operation law). */
  readonly parametersFingerprint: string
  readonly requestedEffects: RequestedEffectSet
}

/** The closed admission decision (design §4.3 order, per call). */
export type OperationAdmissionDecision =
  | { readonly kind: 'admitted'; readonly grant: OperationGrant }
  | { readonly kind: 'requires-approval'; readonly requestedEffects: RequestedEffectSet; readonly reason: string }
  | { readonly kind: 'denied'; readonly error: GovernanceError }

/** The admission seam. `denied` never falls through to execution. */
export interface OperationAdmission {
  readonly admit: (request: AdmissionRequest) => Promise<GovernanceResult<OperationAdmissionDecision>>
}

// ---------------------------------------------------------------------------
// ControlledFs (PR3) — trusted Host mediation, grant-per-call
// ---------------------------------------------------------------------------

/** What `stat` may honestly answer under an observation policy. */
export interface FsObservation {
  readonly exists: boolean
  readonly kind: 'file' | 'directory' | 'unknown'
  /** True when even existence was withheld by policy (design §3.1: 存在性本身
   *  受观察政策控制) — withheld is NOT absent. */
  readonly withheld: boolean
}

/** The read window law (A2C-5): an omitted limit is `null`, never a default. */
export interface FsReadWindow {
  readonly offset: number
  readonly limit: number | null
}

/** One bounded read result. */
export interface FsTextContent {
  readonly canonicalLocator: string
  readonly text: string
  readonly contentFingerprint: string
}

/** One write receipt: never echoes prior content (no diff-reading, M-02). */
export interface FsWriteReceipt {
  readonly canonicalLocator: string
  readonly writtenFingerprint: string
}

/**
 * The trusted-Host FS seam PR3 implements: every operation runs its check
 * BEFORE the open (design §3.1 "检查先于 open"), under the grant passed with
 * the call, on canonical resources.
 */
export interface ControlledFs {
  readonly resolve: (grant: OperationGrant, ref: ResourceRef) => Promise<GovernanceResult<ResourceRef>>
  readonly stat: (grant: OperationGrant, ref: ResourceRef) => Promise<GovernanceResult<FsObservation>>
  readonly readText: (
    grant: OperationGrant,
    ref: ResourceRef,
    window: FsReadWindow,
  ) => Promise<GovernanceResult<FsTextContent>>
  readonly list: (grant: OperationGrant, dirRef: ResourceRef) => Promise<GovernanceResult<readonly ResourceRef[]>>
  readonly writeText: (
    grant: OperationGrant,
    ref: ResourceRef,
    content: string,
  ) => Promise<GovernanceResult<FsWriteReceipt>>
}

// ---------------------------------------------------------------------------
// ConfinedProcessProvider (PR4) — confined spawn, no naked fallback
// ---------------------------------------------------------------------------

/** One probed capability row: the provider states its REAL per-dimension level. */
export interface ProcessCapability {
  readonly dimension: AssuranceDimension
  readonly level: AssuranceLevel
  readonly note: string
}

/** A confined-spawn request: argv is an explicit array, never a shell string. */
export interface ConfinedSpawnRequest {
  readonly grant: OperationGrant
  readonly binding: ToolBinding
  readonly argv: readonly string[]
  readonly cwdRef: ResourceRef
  readonly env: readonly (readonly [string, string])[]
}

/** A spawn receipt: the process identity AND the lease that scopes it. */
export interface ConfinedSpawnReceipt {
  readonly lease: ExecutionLease
  readonly processIdentity: string
}

/**
 * The confined-process seam PR4 implements (Landlock entry-self-lock, FD
 * closure, per-dimension capability, §3.3/§5). `probe` refuses honestly;
 * `spawn` checks capability against the grant's required dimensions BEFORE
 * any process exists (`SANDBOX_UNAVAILABLE`, typed, zero naked process).
 */
export interface ConfinedProcessProvider {
  readonly probe: () => Promise<GovernanceResult<readonly ProcessCapability[]>>
  readonly spawn: (request: ConfinedSpawnRequest) => Promise<GovernanceResult<ConfinedSpawnReceipt>>
  readonly requestCancellation: (lease: ExecutionLease) => Promise<GovernanceResult<ExecutionLease>>
  readonly settleTermination: (lease: ExecutionLease) => Promise<GovernanceResult<ExecutionLease>>
}

// ---------------------------------------------------------------------------
// ProviderGateway (PR7) — Web/Jobs/MCP/Remote + Domain final veto
// ---------------------------------------------------------------------------

/** What a gateway call targets: a destination or a Domain authority object. */
export interface GatewayTarget {
  readonly destination?: ResourceRef
  readonly domainAuthorityId?: string
}

/** One gateway call request (payload travels as a fingerprint + opaque ref). */
export interface GatewayCallRequest {
  readonly grant: OperationGrant
  readonly binding: ToolBinding
  readonly target: GatewayTarget
  readonly payloadFingerprint: string
}

/** The Domain Authority's own answer — Team approval can never rewrite it. */
export type DomainVeto = 'allowed' | 'denied' | 'not-applicable'

/** One gateway receipt; job outcomes keep their termination honesty. */
export interface GatewayReceipt {
  readonly outcomeFingerprint: string
  readonly domainVeto: DomainVeto
  /** For job-class calls: kill requested ≠ terminated (design §3.6). */
  readonly lease?: ExecutionLease
}

/**
 * The trusted Provider seam PR7 implements: destination filtering happens at
 * first request, every redirect hop and every DNS/IP change (design §3.6),
 * and the Domain Authority answers at the effect-commit point, last.
 */
export interface ProviderGateway {
  readonly call: (request: GatewayCallRequest) => Promise<GovernanceResult<GatewayReceipt>>
}
