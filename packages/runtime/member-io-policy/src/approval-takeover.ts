/**
 * Alpha.5 Sandbox-First — R1 (BL-09), the approval takeover bridge.
 *
 * WHAT THIS MODULE IS. The ONE seam between the new execution lane and the
 * EXISTING Alpha.4 approval authority. The new lane computes its hard ceiling
 * with `compileEffectiveIo` (P1-02). When that compiled intersection classifies
 * an authored locator as `ask`, this adapter:
 *
 *   1. refuses immediately if the locator is NOT an exact authored `ask`
 *      locator (a hard-ceiling `deny` can never be unlocked by an approval,
 *      and an ask SUBTREE is never widened);
 *   2. consults the existing public last-mile approval guard
 *      (`ControlService.guardOperation`, the same seam P6-T6 wires into the
 *      tool pipeline) with the EXACT `ControlOperationScope` the caller built;
 *   3. on `allowed: true`, returns the compiler's `EffectiveIoPolicy` with
 *      exactly that one ask locator moved to `allow` and removed from `ask`.
 *
 * WHAT IT IS NOT.
 *  - NOT a second permission computation: it never re-reads a blueprint, an
 *    overlay or an authoring map. Its only lane input is the already-compiled
 *    `MemberPolicy` + `ToolIoRestriction`; its only lane operation is one
 *    `ask → allow` move on the COMPILED lane. A source-fence test
 *    (`a5sf-approval-takeover.test.ts`) fails if a second compiler is imported.
 *  - NOT a second approval store / grant table: it owns no state at all. The
 *    durable allow and its exactly-once consumption stay in the Alpha.4
 *    `ControlService`; the adapter merely observes `ControlGuardVerdict` and
 *    maps the existing `allow-consumed` block reason to a typed refusal. A
 *    replay therefore reaches the SAME durable guard and is refused by it.
 *  - NOT an approval REQUESTER: requesting and resolving the `ApprovalCase` is
 *    the existing Alpha.4 pre-execute pipeline's job. This adapter only
 *    CONSUMES a decision that already exists, at execution time.
 *
 * THE INVARIANT. `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction` is unchanged:
 * the narrowed result is a strict subset of the compiled intersection (the
 * asked locator was inside the surviving `ask` lane, which the compiler only
 * retains when BOTH axes permit it). Approval changes disposition, never the
 * ceiling. An approval can only ever select one already-`ask` locator.
 *
 * NAMED LIMIT (disclosed, not worked around): a request for a locator that is
 * merely a CHILD of an authored `ask` locator is refused with
 * `APPROVAL_SCOPE_UNBOUND`. Allowing it would require turning the whole ask
 * subtree into allow (a widening) or inventing a per-call exception lane that
 * the provider algebra does not have. The caller must ask for the authored
 * locator itself.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/approval-takeover
 */

import type { ControlGuardVerdict, ControlOperationScope } from '../../control/types.js'
import { compileEffectiveIo } from './compile.js'
import { locatorsEquivalent, matchLocator } from './path-rules.js'
import type {
  CompileResult,
  EffectiveIoPolicy,
  InvocationAuthority,
  MemberPolicy,
  PathAxes,
  PathRuleSet,
  PolicyRefusal,
  ToolIoRestriction,
} from './types.js'

/**
 * The EXISTING public approval decision seam, structurally identical to
 * `ControlService['guardOperation']` (the durable last-mile guard). Passing the
 * real service's bound method is the production wiring; a structural stand-in
 * that skips the durable row does NOT satisfy the law this adapter documents.
 */
export type AskApprovalAuthority = (
  scope: ControlOperationScope,
) => Promise<ControlGuardVerdict>

/** Closed refusal vocabulary of the takeover bridge. */
export const APPROVAL_TAKEOVER_REFUSAL_CODES = {
  /** The compiled policy belongs to an older Member generation. */
  MEMBER_POLICY_STALE: 'MEMBER_POLICY_STALE',
  /** The asked locator is not an authored `ask` locator of the compiled lane. */
  APPROVAL_SCOPE_UNBOUND: 'APPROVAL_SCOPE_UNBOUND',
  /** The compiled hard ceiling denies the locator: an approval can never widen. */
  APPROVAL_CANNOT_WIDEN: 'APPROVAL_CANNOT_WIDEN',
  /** The locator is already allowed; there is nothing for an approval to do. */
  APPROVAL_NOT_ASKED: 'APPROVAL_NOT_ASKED',
  /** The exact Control scope does not name this member/tool. */
  APPROVAL_SCOPE_MISMATCH: 'APPROVAL_SCOPE_MISMATCH',
  /** The existing authority refused (deny / pending / stale / no request). */
  APPROVAL_DENIED: 'APPROVAL_DENIED',
  /** The existing authority reports the durable allow was already consumed. */
  APPROVAL_ALREADY_CONSUMED: 'APPROVAL_ALREADY_CONSUMED',
  /** The existing authority threw or was unavailable (fail closed). */
  APPROVAL_AUTHORITY_FAILED: 'APPROVAL_AUTHORITY_FAILED',
} as const

export type ApprovalTakeoverRefusalCode =
  (typeof APPROVAL_TAKEOVER_REFUSAL_CODES)[keyof typeof APPROVAL_TAKEOVER_REFUSAL_CODES]

/** Every refusal code, for membership checks. */
export const APPROVAL_TAKEOVER_REFUSAL_CODE_VALUES: readonly string[] =
  Object.values(APPROVAL_TAKEOVER_REFUSAL_CODES)

export interface ApprovalTakeoverRefusal {
  readonly ok: false
  readonly code: ApprovalTakeoverRefusalCode
  readonly detail: string
  readonly path: string
}

/** Accepted = the compiler output narrowed by exactly one ask→allow move. */
export type ApprovalTakeoverResult =
  | { readonly ok: true; readonly value: EffectiveIoPolicy }
  | PolicyRefusal
  | ApprovalTakeoverRefusal

export interface ResolveAskClassCallInput {
  /** The P1-02 compiled Member half (NOT re-derived from a blueprint). */
  readonly memberPolicy: MemberPolicy
  /** The P1-02 projected tool half (the RIGHT factor). */
  readonly tool: ToolIoRestriction
  /** The P1-04 projected invocation tuple (call id / revision / binding). */
  readonly invocation: InvocationAuthority
  /**
   * The generation the TeamDomain currently trusts for this Member. A policy
   * compiled for a different generation is stale and never authorizes a call.
   */
  readonly currentInstanceGeneration: number
  /** The axis and the EXACT authored ask locator this call targets. */
  readonly ask: {
    readonly axis: PathAxes
    readonly locator: string
    /**
     * The canonical operation fingerprint of that locator, as produced by the
     * EXISTING Alpha.4 canonicalizer (`operation-permission/canonical-operation`).
     * Required whenever the Control scope carries an `operationFingerprint`
     * (an exact-scope approval): the adapter compares the two strings and never
     * derives a fingerprint itself (that would be a second canonicalizer).
     */
    readonly operationFingerprint?: string
  }
  /** The exact durable Control scope the existing approval covers. */
  readonly scope: ControlOperationScope
  /** The existing Alpha.4 last-mile approval guard (`guardOperation`). */
  readonly approvalAuthority: AskApprovalAuthority
}

function refuse(
  code: ApprovalTakeoverRefusalCode,
  detail: string,
  path: string,
): ApprovalTakeoverRefusal {
  return Object.freeze({ ok: false as const, code, detail, path })
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function freezeLane(lane: PathRuleSet): PathRuleSet {
  return Object.freeze({
    mode: lane.mode,
    allow: Object.freeze([...lane.allow]),
    ask: Object.freeze([...lane.ask]),
    deny: Object.freeze([...lane.deny]),
  })
}

/**
 * Move EXACTLY one authored ask locator to `allow`. Returns `null` when the
 * lane carries no authored ask locator equivalent to `locator` — the caller
 * then refuses instead of widening an ask subtree.
 */
function narrowLaneForAskedLocator(
  lane: PathRuleSet,
  locator: string,
): PathRuleSet | null {
  const authored = lane.ask.filter((entry) => locatorsEquivalent(entry, locator))
  if (authored.length === 0) return null
  const ask = lane.ask.filter((entry) => !locatorsEquivalent(entry, locator))
  const allow = [...lane.allow]
  for (const entry of authored) {
    if (!allow.some((existing) => locatorsEquivalent(existing, entry))) allow.push(entry)
  }
  return freezeLane({ mode: lane.mode, allow: Object.freeze(allow), ask: Object.freeze(ask), deny: lane.deny })
}

/** The tool name a v4 binding identity (`owner/name`) is pinned to. */
function toolNameOf(bindingIdentity: string): string {
  const index = bindingIdentity.lastIndexOf('/')
  return index >= 0 ? bindingIdentity.slice(index + 1) : bindingIdentity
}

/**
 * Resolve ONE `ask`-class call against the EXISTING approval authority.
 *
 * Fail-closed order: generation → single compiler → hard-ceiling disposition →
 * exact scope binding → existing guard. Every earlier refusal happens BEFORE
 * the guard is consulted, so a denied/unbound call never burns an allow.
 */
export async function resolveAskClassCall(
  input: ResolveAskClassCallInput,
): Promise<ApprovalTakeoverResult> {
  const { memberPolicy, tool, invocation, ask, scope, approvalAuthority } = input
  if (
    memberPolicy === null ||
    typeof memberPolicy !== 'object' ||
    tool === null ||
    typeof tool !== 'object' ||
    invocation === null ||
    typeof invocation !== 'object' ||
    ask === null ||
    typeof ask !== 'object'
  ) {
    return refuse(
      'APPROVAL_SCOPE_UNBOUND',
      'an ask resolution requires the compiled MemberPolicy, the tool restriction and the invocation tuple',
      'input',
    )
  }
  if (!isNonBlank(ask.locator)) {
    return refuse('APPROVAL_SCOPE_UNBOUND', 'the asked locator must be the authored non-blank ask locator', 'ask.locator')
  }
  if (ask.axis !== 'read' && ask.axis !== 'write') {
    return refuse('APPROVAL_SCOPE_UNBOUND', "the asked axis must be 'read' or 'write'", 'ask.axis')
  }

  // (1) Stale generation: the existing `MEMBER_POLICY_STALE` semantics
  // (team-services/install.ts) — a policy compiled for generation N never
  // authorizes an instance at generation N+1.
  if (memberPolicy.instanceGeneration !== input.currentInstanceGeneration) {
    return refuse(
      'MEMBER_POLICY_STALE',
      `policy for '${memberPolicy.memberIdentity}' was compiled for generation ${String(memberPolicy.instanceGeneration)}, but the instance is at generation ${String(input.currentInstanceGeneration)}`,
      'memberPolicy.instanceGeneration',
    )
  }

  // (2) THE one permission computation. A stale revision / mismatched
  // invocation is refused HERE by the compiler, not re-implemented.
  const compiled: CompileResult<EffectiveIoPolicy> = compileEffectiveIo(memberPolicy, tool, invocation)
  if (!compiled.ok) return compiled

  // (3) Disposition on the COMPILED lane. `deny` is final: the existing
  // authority is not even asked. `allow` needs no approval.
  const compiledLane: PathRuleSet = ask.axis === 'read' ? compiled.value.read : compiled.value.write
  const disposition = matchLocator(compiledLane, ask.locator)
  if (disposition === 'deny') {
    return refuse(
      'APPROVAL_CANNOT_WIDEN',
      `the compiled EffectiveIo denies '${ask.locator}'; an approval or one-shot grant never raises a hard ceiling`,
      'ask.locator',
    )
  }
  if (disposition === 'allow') {
    return refuse(
      'APPROVAL_NOT_ASKED',
      `the compiled EffectiveIo already allows '${ask.locator}'; the approval path is only for authored ask locators`,
      'ask.locator',
    )
  }

  // (4) Exact ask locator + exact Control scope. The scope must name the SAME
  // member and tool; an approval minted for another member/tool is never
  // transferable to this call.
  const narrowed = narrowLaneForAskedLocator(compiledLane, ask.locator)
  if (narrowed === null) {
    return refuse(
      'APPROVAL_SCOPE_UNBOUND',
      `'${ask.locator}' is only covered by a broader authored ask locator; resolving it would widen the whole ask subtree, so it is refused (ask the authored locator itself)`,
      'ask.locator',
    )
  }
  if (scope === null || typeof scope !== 'object' || !isNonBlank(scope.correlation)) {
    return refuse('APPROVAL_SCOPE_UNBOUND', 'the approval scope must carry its stable correlation', 'scope.correlation')
  }
  if (!isNonBlank(scope.actionName)) {
    return refuse('APPROVAL_SCOPE_UNBOUND', 'the approval scope must carry its action name', 'scope.actionName')
  }
  if (scope.targetInstanceId !== memberPolicy.memberIdentity) {
    return refuse(
      'APPROVAL_SCOPE_MISMATCH',
      `the approval scope targets '${String(scope.targetInstanceId)}', but the compiled policy belongs to '${memberPolicy.memberIdentity}'`,
      'scope.targetInstanceId',
    )
  }
  if (scope.toolName !== undefined && scope.toolName !== toolNameOf(tool.bindingIdentity)) {
    return refuse(
      'APPROVAL_SCOPE_MISMATCH',
      `the approval scope names tool '${String(scope.toolName)}', but the invocation is bound to '${tool.bindingIdentity}'`,
      'scope.toolName',
    )
  }
  // Exact resource binding: the durable scope may carry the canonical
  // operation fingerprint. When it does, the ask must present the SAME
  // fingerprint — the adapter compares, it never recomputes one. This is what
  // keeps "the approval names exactly the asked resource" true at the
  // fingerprint level (a legacy scope without a fingerprint is disclosed as a
  // residual limit in the R1 evidence README).
  if (scope.operationFingerprint !== undefined) {
    if (!isNonBlank(ask.operationFingerprint)) {
      return refuse(
        'APPROVAL_SCOPE_UNBOUND',
        'the approval scope carries an exact operation fingerprint; the ask must supply the canonical fingerprint of the asked locator so the two can be bound',
        'ask.operationFingerprint',
      )
    }
    if (ask.operationFingerprint !== scope.operationFingerprint) {
      return refuse(
        'APPROVAL_SCOPE_MISMATCH',
        `the approval scope is bound to fingerprint '${scope.operationFingerprint}', but the asked locator carries '${ask.operationFingerprint}'`,
        'ask.operationFingerprint',
      )
    }
  }

  // (5) THE existing approval authority. It owns the durable allow and its
  // exactly-once consumption; this adapter only observes the verdict.
  let verdict: ControlGuardVerdict
  try {
    verdict = await approvalAuthority(scope)
  } catch (error) {
    return refuse(
      'APPROVAL_AUTHORITY_FAILED',
      `the existing approval authority failed: ${error instanceof Error ? error.message : String(error)}`,
      'approvalAuthority',
    )
  }
  if (verdict === null || typeof verdict !== 'object' || typeof verdict.allowed !== 'boolean') {
    return refuse(
      'APPROVAL_AUTHORITY_FAILED',
      'the existing approval authority returned no closed verdict',
      'approvalAuthority',
    )
  }
  if (!verdict.allowed) {
    const reason = verdict.reason
    if (reason === 'allow-consumed') {
      return refuse(
        'APPROVAL_ALREADY_CONSUMED',
        `the durable allow for correlation '${scope.correlation}' was already consumed; a one-shot approval is never replayed`,
        'approvalAuthority',
      )
    }
    return refuse(
      'APPROVAL_DENIED',
      `the existing approval authority refused (${String(reason)}); an ask is never treated as an implicit allow`,
      'approvalAuthority',
    )
  }

  // (6) Exactly one ask→allow move on the COMPILED policy. Every other lane,
  // locator, revision and identity survives verbatim.
  const read = ask.axis === 'read' ? narrowed : compiled.value.read
  const write = ask.axis === 'write' ? narrowed : compiled.value.write
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      memberIdentity: compiled.value.memberIdentity,
      toolBindingIdentity: compiled.value.toolBindingIdentity,
      invocationId: compiled.value.invocationId,
      policyRevision: compiled.value.policyRevision,
      read,
      write,
      network: compiled.value.network,
    }),
  })
}
