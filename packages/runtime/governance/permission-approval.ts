/**
 * A4-PR5 — the durable permission-mutation PROPOSAL law (spec §8, §24.5;
 * ADR A1-8/A1-9/A1-12; interface freeze §2).
 *
 * This module is the LAW and nothing else: fingerprint identity, base-pair
 * correlation, the derived beneficiary position, the approval-rung plan (the
 * FROZEN `evaluateAuthorityCeiling` walk reused, never re-implemented), the
 * rise-set digest that makes A1-8's "structural equality of the recomputed
 * (before, after, region-set)" checkable at the commit boundary, and the
 * narrow approval port the governance service addresses through a late-bound
 * ref. It performs NO durable write and knows no storage, no plugin host, and
 * no ControlService implementation — the port is the consumer-side interface
 * exactly as the service needs it, with `kind` REQUIRED (the control plane's
 * silent `LEADER_APPROVAL` default must never be able to swallow a mutation
 * case into the wrong question).
 *
 * THE FINGERPRINT (`permissionMutationProposalFingerprint`). Binds the
 * mutation's IDENTITY: team, target, beneficiary position, mutation kind, the
 * canonicalized rule set (operation class + matcher root + effect), and the
 * bound-Blueprint anchor. It EXCLUDES `mutationId` and `reason` (spec §24.5:
 * provenance, not identity — two callers asking for the same thing are the
 * same question), the base pair (the correlation names that, so a DENIED
 * fingerprint at the same base stays discoverable — A1-9), the actor and the
 * clock.
 *
 * THE NUANCE DISCLOSED (review item 7c): dedup is PER IDENTITY, and identity
 * carries `requestedEffect` and the fingerprint — so "one open case per
 * (team, target, base)" is NOT literally guaranteed. If containment drift
 * moves the MAX risen effect between two asks at the SAME base, the second
 * call computes a DIFFERENT identity, does not discover the first case, and
 * opens another; the old case stays OPEN forever — a retried mutation can no
 * longer reach it and nothing auto-closes it. Authority is unaffected (the
 * zombie is open, reviewable, and UNCOMMITTABLE: no caller presents its
 * identity at a commit boundary again); the cost is audit noise, closed by
 * the abandon path (a reviewer may abandon it) or by a PR7-cutover sweep —
 * named, disclosed, NOT silently assumed away. Digest: `canonicalJsonStringify` (contracts: keys sorted) under
 * SHA-256 — the same self-contained discipline as the Blueprint content hash
 * (`domain/blueprint` `sha256Hex`), deliberately NOT storage's non-crypto
 * helper: this is a governance fingerprint, and borrowing a storage-edge
 * utility would weld a runtime storage edge into the lane for nothing.
 *
 * THE BENEFICIARY DERIVATION (`beneficiaryAuthorityForTarget`). Authority is
 * derived server-side from the TARGET IDENTITY, never from a label: the
 * production ceiling reader USED to answer `beneficiaryAuthority: 'member'`
 * for every target (reported at PR5; FIXED in the PR5 rebase round: the plane
 * reader now derives through THIS law, so one equation rules in both lanes).
 * Trusting a flat label for the Leader's own overlay would start the reviewer
 * walk at the LEADER rung and open a case whose reviewer the Leader itself is
 * — the self-approval rung the ladder forbids (the walk starts ONE RUNG ABOVE
 * the beneficiary). `inst-leader` IS the leader position; every other instance
 * target is a member. That single equation is the whole law, and it admits no
 * permissive override: the optional second parameter exists ONLY so a caller
 * holding a ceiling context can pass its label for the record — the derivation
 * reads it never.
 *
 * THE OUTCOME MIRROR (`PERMISSION_MUTATION_TERMINAL_OUTCOMES`). Executing
 * paths never import `intervention/**` (A1-17 posture), so the governance-side
 * terminal arms name the frozen `TERMINAL_MUTATION_OUTCOMES` values through
 * this mirror; `a4p5-permission-mutation-proposal.test.ts` pins the exact
 * containment, and the pending reason is pinned OUTSIDE the terminal set (a
 * proposal parks; it does not end). `authority-undetermined` is a member of
 * the mirror (the frozen table's) although PR5's undetermined inputs remain
 * typed THROWS (`EFFECT_CONTEXT_UNAVAILABLE`, PR2's law untouched): the mirror
 * is the terminal vocabulary of the lane; the throw is a pre-decision refusal.
 *
 * @module @dsh-agent-team/runtime/governance/permission-approval
 */

import { canonicalJsonStringify, LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import { sha256Hex } from '../../domain/blueprint/src/index.js'
import type {
  ApprovalCaseIdentityInput,
  ApprovalCaseIdentityLookup,
  ApprovalCaseReadOutcome,
  ControlRequestKind,
  ControlRequestLegOutcome,
} from '../control/index.js'
// The authority-position ladder type is GOVERNANCE's (proposal-store — the
// module that first had to name a rung durably); control consumes it too.
// Importing it lane-internally keeps control→governance a TYPE-only edge.
import type { ProposalAuthorityPosition } from './proposal-store.js'
import type { ActionCaller } from '../admission/types.js'
import type { PermissionOverlayEffect } from '../permission-governance/types.js'
import {
  AUTHORITY_CEILING_ERROR_CODES,
  AuthorityBindingError,
  authorityRank,
  type AuthorityEnvelopeDocuments,
} from './authority-ceiling.js'
import {
  evaluateAuthorityCeiling,
  type AuthorityEvaluationInput,
} from './runtime-authority.js'
import {
  PERMISSION_EFFECT_PRECEDENCE,
  type PermissionMutationKind,
  type PermissionResourceMatcher,
  type PermissionRiseRegion,
} from './permission-mutation.js'

// ---------------------------------------------------------------------------
// The frozen result vocabulary (mirror — see the module doc)
// ---------------------------------------------------------------------------

/** The one NON-terminal arm reason: the mutation became a durable proposal. */
export const PERMISSION_MUTATION_PENDING_REASON = 'mutation-proposal-pending' as const

/** The terminal outcomes a permission-mutation RESULT can carry (the frozen
 *  `TERMINAL_MUTATION_OUTCOMES` minus `mutation-committed` / `mutation-no-change`,
 *  which the pre-existing arms express). Values are pinned equal to the
 *  intervention table by the lane-A spec — this module must never import it. */
export const PERMISSION_MUTATION_TERMINAL_OUTCOMES = {
  MUTATION_STALE: 'mutation-stale',
  DENIED: 'denied',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
  AUTHORITY_UNDETERMINED: 'authority-undetermined',
} as const

/** One governance-terminal outcome name. */
export type PermissionMutationTerminalOutcome =
  (typeof PERMISSION_MUTATION_TERMINAL_OUTCOMES)[keyof typeof PERMISSION_MUTATION_TERMINAL_OUTCOMES]

/** Every terminal name, for membership pins. */
export const PERMISSION_MUTATION_TERMINAL_OUTCOME_VALUES: readonly PermissionMutationTerminalOutcome[] =
  Object.freeze(Object.values(PERMISSION_MUTATION_TERMINAL_OUTCOMES))

// ---------------------------------------------------------------------------
// The fingerprint (identity) and the correlation (base pair)
// ---------------------------------------------------------------------------

/** One rule as the fingerprint sees it: the CANONICAL matcher root + the
 *  requested effect. There is no field here for provenance on purpose — the
 *  type is the first fence against re-binding `mutationId`/`reason`. */
export interface PermissionMutationFingerprintRule {
  readonly operationClass: string
  readonly matcherKind: PermissionResourceMatcher['kind']
  readonly matcherResource: string
  readonly effect: PermissionOverlayEffect
}

/** The frozen fingerprint input (spec §8.4). `blueprintContentHash` is the
 *  BOUND Blueprint anchor when the ceiling context carries one, and `null`
 *  when the deployment's context reader supplies none — `null` is a distinct
 *  BOUND value, never a silent skip. */
export interface PermissionMutationProposalFingerprintInput {
  readonly teamSessionId: string
  readonly targetMemberInstanceId: string
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  readonly mutationKind: PermissionMutationKind
  readonly rules: readonly PermissionMutationFingerprintRule[]
  readonly blueprintContentHash: string | null
}

/**
 * The proposal fingerprint: `mutfp-` + SHA-256 (hex) over the canonical JSON
 * of the identity projection with the rule set in a deterministic order.
 * Same inputs -> same string, byte for byte, in every process.
 * @param input - the identity projection (see the interface; nothing else).
 * @returns the opaque `mutfp-<64 hex>` fingerprint.
 */
export function permissionMutationProposalFingerprint(
  input: PermissionMutationProposalFingerprintInput,
): string {
  const canonical = canonicalJsonStringify({
    v: 1,
    teamSessionId: input.teamSessionId,
    targetMemberInstanceId: input.targetMemberInstanceId,
    beneficiaryAuthority: input.beneficiaryAuthority,
    mutationKind: input.mutationKind,
    rules: [...input.rules]
      .map((rule) => ({
        operationClass: rule.operationClass,
        matcherKind: rule.matcherKind,
        matcherResource: rule.matcherResource,
        effect: rule.effect,
      }))
      .sort((left, right) => {
        const a = `${left.operationClass} ${left.matcherKind} ${left.matcherResource} ${left.effect}`
        const b = `${right.operationClass} ${right.matcherKind} ${right.matcherResource} ${right.effect}`
        return a < b ? -1 : a > b ? 1 : 0
      }),
    blueprintContentHash: input.blueprintContentHash,
  })
  return `mutfp-${sha256Hex(canonical)}`
}

/**
 * The per-attempt correlation token: it names ONLY the base pair
 * (`baseGeneration`, `baseSnapshotId`). Correlation participates in the
 * derived `approvalCaseId`, so the SAME semantics asked at the SAME base land
 * on the SAME case — which is what makes a denied fingerprint discoverable
 * forever at that base (A1-9) and a NEW base generation the only re-ask.
 * @param base - the overlay base the mutation was planned against.
 * @returns the stable correlation token for that base pair.
 */
export function permissionMutationCorrelation(base: {
  readonly baseGeneration: number
  readonly baseSnapshotId: string | null
}): string {
  return `pmut:g${String(base.baseGeneration)}:${base.baseSnapshotId ?? 'none'}`
}

/**
 * The beneficiary position of one mutation target, DERIVED from the target
 * identity (see the module doc) — and from NOTHING else. An earlier shape
 * carried an optional ceiling-context label that the derivation never read;
 * review item 7b removed it: a parameter a law ignores is a standing
 * invitation to believe the label participates. It never did, and now it
 * cannot even be passed.
 * @param targetMemberInstanceId - the addressed MemberInstance.
 * @returns `leader` for the Leader instance, `member` for every other target.
 */
export function beneficiaryAuthorityForTarget(
  targetMemberInstanceId: string,
): ProposalAuthorityPosition {
  return targetMemberInstanceId === LEADER_INSTANCE_ID ? 'leader' : 'member'
}

// ---------------------------------------------------------------------------
// The approval-rung plan (the frozen walk, reused)
// ---------------------------------------------------------------------------

/** One rising region as the plan needs it (a projection of `PermissionRiseRegion`). */
export interface PermissionMutationApprovalRegion {
  readonly operationClass: string
  readonly matcher: PermissionResourceMatcher
  readonly risenEffect: PermissionOverlayEffect
}

/** The plan outcome: the one rung the batch asks for, or the fail-closed
 *  input states. `undetermined`/`unavailable` are NOT rungs and never
 *  propose — the SERVICE renders them as PR2's typed refusals. */
export type PermissionMutationApprovalPlan =
  | { readonly status: 'required'; readonly requiredAuthority: ProposalAuthorityPosition; readonly requestedEffect: PermissionOverlayEffect }
  | { readonly status: 'undetermined' }
  | { readonly status: 'unavailable' }

/**
 * The single rung the whole batch asks for: per rising region the frozen
 * `evaluateAuthorityCeiling` walk (`grantCeiling`, starting one rung ABOVE the
 * beneficiary — so a target can never be reviewed at its own rung), batched
 * ALL-OR-NOTHING at the highest rung any region needs; `requestedEffect` is
 * the highest risen effect (the identity's single ask).
 *
 * The evaluator's `initiatorAuthority` field is fed with the BENEFICIARY and
 * its `direct` outcome is deliberately IGNORED: whether the initiator may act
 * directly was already decided (insufficient) by the PR2 both-planes judge,
 * and re-reading that label here could only ever relax the judge's decision.
 * @param input - beneficiary, documents, the rising regions, the live seam.
 * @returns the plan (see {@link PermissionMutationApprovalPlan}).
 */
export function planPermissionMutationApproval(input: {
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  readonly documents: AuthorityEnvelopeDocuments
  readonly regions: readonly PermissionMutationApprovalRegion[]
  readonly subtreeContains?: AuthorityEvaluationInput['subtreeContains']
}): PermissionMutationApprovalPlan {
  let requestedEffect: PermissionOverlayEffect = 'deny'
  let required: ProposalAuthorityPosition | undefined
  for (const region of input.regions) {
    let evaluation
    try {
      evaluation = evaluateAuthorityCeiling({
        beneficiaryAuthority: input.beneficiaryAuthority,
        initiatorAuthority: input.beneficiaryAuthority,
        operationClass: region.operationClass,
        matcher: region.matcher,
        desiredEffect: region.risenEffect,
        documents: input.documents,
        ...(input.subtreeContains === undefined ? {} : { subtreeContains: input.subtreeContains }),
      })
    } catch (error) {
      // The ONE mapped failure is the faulted document read (never absent,
      // never a rung). A ladder DEFECT propagates: it is a broken input, not
      // an outcome to render.
      if (
        error instanceof AuthorityBindingError &&
        error.code === AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE
      ) {
        return { status: 'unavailable' }
      }
      throw error
    }
    if (evaluation.outcome === 'undetermined' || evaluation.requiredAuthority === undefined) {
      return { status: 'undetermined' }
    }
    if (PERMISSION_EFFECT_PRECEDENCE[region.risenEffect] > PERMISSION_EFFECT_PRECEDENCE[requestedEffect]) {
      requestedEffect = region.risenEffect
    }
    if (required === undefined || authorityRank(evaluation.requiredAuthority) > authorityRank(required)) {
      required = evaluation.requiredAuthority
    }
  }
  if (required === undefined) {
    // Nothing reached a rung. With an empty rise set there is nothing to ask,
    // and the honest answer for "nothing to ask" is not a rung.
    return { status: 'undetermined' }
  }
  return { status: 'required', requiredAuthority: required, requestedEffect }
}

// ---------------------------------------------------------------------------
// The rise-set digest (A1-8's commit-boundary equality)
// ---------------------------------------------------------------------------

/** The summary prefix the approval leg carries. The leg `summary` is durable
 *  evidence ON the leg row; reading it back at commit is a durable read, and
 *  an unparseable one fails closed. */
export const RISE_SUMMARY_PREFIX = 'pmut-rise:'

/**
 * The digest of the APPROVED rise structure: the multiset of
 * `operationClass | region kind + resource | risenEffect`, ordered.
 * The ROOT of a matcher's identity is inside it (a retargeted root IS a
 * different region key), while a descendant change under the same root that
 * leaves every approved region's rise identical leaves the digest identical
 * (spec §8's two rulings, in one function).
 * @param regions - the decided rising regions (at approval or at commit).
 * @returns 64 hex characters.
 */
export function riseDigestOf(regions: readonly PermissionRiseRegion[]): string {
  const rows = regions
    .map((region) => `${region.operationClass} ${region.region.kind} ${region.region.resource} ${region.risenEffect}`)
    .sort()
  return sha256Hex(canonicalJsonStringify(rows))
}

/** Encode the digest into the leg summary the approval is recorded with. */
export function encodeRiseSummary(digest: string): string {
  return `${RISE_SUMMARY_PREFIX}${digest}`
}

/**
 * Read the digest back out of a leg summary. Strict: anything that is not
 * exactly `pmut-rise:<64 hex>` is `undefined` — the commit boundary treats
 * `undefined` as a corrupt approval record and answers stale (fail closed,
 * the discipline every durable read in this lane follows).
 * @param summary - the leg's durable summary, read back.
 * @returns the digest, or `undefined` when the summary is not one.
 */
export function parseRiseSummary(summary: unknown): string | undefined {
  if (typeof summary !== 'string' || !summary.startsWith(RISE_SUMMARY_PREFIX)) return undefined
  const body = summary.slice(RISE_SUMMARY_PREFIX.length)
  return /^[0-9a-f]{64}$/.test(body) ? body : undefined
}

// ---------------------------------------------------------------------------
// The approval port (consumer-side, late-bound)
// ---------------------------------------------------------------------------

/**
 * The ONLY members of the control plane the governance mutation lane addresses
 * (freeze §2, §6). `kind` is REQUIRED on the identity lookup — the control
 * member's silent `LEADER_APPROVAL` default participates in the derived case
 * id, and a mutation case looked up under the wrong kind is a case that does
 * not exist.
 */
export interface PermissionMutationApprovalPort {
  /** Resolves the frozen mutation identity to its case (explicit kind only). */
  findApprovalCaseByIdentity(input: {
    readonly rootSessionId: string
    readonly identity: ApprovalCaseIdentityInput
    readonly kind: ControlRequestKind
  }): Promise<ApprovalCaseIdentityLookup>
  /** Reads the full case state for the discovered approvalCaseId. */
  readApprovalCaseState(input: {
    readonly rootSessionId: string
    readonly approvalCaseId: string
  }): Promise<ApprovalCaseReadOutcome>
  /** Opens the review leg (or returns the case's terminal outcome). */
  requestApprovalLeg(input: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly kind: ControlRequestKind
    readonly reviewAuthority: ProposalAuthorityPosition
    readonly requiredAuthorityAtCreation: ProposalAuthorityPosition
    readonly identity: ApprovalCaseIdentityInput
    readonly actionName: string
    readonly summary?: string
    readonly executionCoupling?: 'guarded' | 'inline'
  }): Promise<ControlRequestLegOutcome>
}

/** The late-bound port plus its wiring probe. */
export type LateBoundPermissionMutationApprovalPort = PermissionMutationApprovalPort & {
  /** Whether a live ControlService sits behind the ref right now. */
  readonly wired: () => boolean
}

/**
 * Wrap a late-bound ref (the `controlServiceRef` pattern the host already
 * threads) into the port. Each member resolves the ref AT CALL TIME; before
 * the first wiring every member would throw, and {@link wired} lets the
 * service answer PR2's typed refusal instead of ever calling one.
 * @param ref - the same `{ current }` shape root.ts already fills.
 * @returns the delegating port.
 */
export function lateBoundPermissionMutationApprovalPort(ref: {
  current: PermissionMutationApprovalPort | undefined
}): LateBoundPermissionMutationApprovalPort {
  const unwired = (): never => {
    throw new Error('the permission-mutation approval lane is unwired on this root — zero write')
  }
  return {
    wired: () => ref.current !== undefined,
    findApprovalCaseByIdentity: (input) => ref.current?.findApprovalCaseByIdentity(input) ?? unwired(),
    readApprovalCaseState: (input) => ref.current?.readApprovalCaseState(input) ?? unwired(),
    requestApprovalLeg: (input) => ref.current?.requestApprovalLeg(input) ?? unwired(),
  }
}

/**
 * The proposal-store `operationId` for one mutation: a deterministic
 * `op-<hex>` token derived from the mutation's provenance id (the store's
 * grammar is `^op-[a-z0-9]{1,32}$`; the mutationId's own grammar is not that
 * shape, and minting a random token would make a crash-retry a different
 * operation). Determinism here means the SAME mutation always names the SAME
 * store operation — the discovery law, transported to the proposal rows.
 * @param mutationId - the ADR §2 provenance id.
 * @returns the store-shaped operation id.
 */
export function proposalOperationId(mutationId: string): string {
  return `op-${sha256Hex(`pmut-op:${mutationId}`).slice(0, 32)}`
}

/**
 * The frozen identity a mutation case is opened and rediscovered with
 * (A2-7: every field derived server-side by the caller law, never chosen).
 * @param ask - target, derived beneficiary, the batch ask, the fingerprint,
 *   the base-pair correlation.
 * @returns the identity input for `requestApprovalLeg` /
 *   `findApprovalCaseByIdentity`.
 */
export function buildPermissionMutationApprovalIdentity(ask: {
  readonly targetMemberInstanceId: string
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  readonly requestedEffect: PermissionOverlayEffect
  readonly mutationProposalFingerprint: string
  readonly correlation: string
}): ApprovalCaseIdentityInput {
  return {
    subject: { kind: 'instance', instanceId: ask.targetMemberInstanceId },
    beneficiaryAuthority: ask.beneficiaryAuthority,
    requestedEffect: ask.requestedEffect,
    mutationProposalFingerprint: ask.mutationProposalFingerprint,
    correlation: ask.correlation,
  }
}
