/**
 * Alpha.5 M1 (frozen A; PR355 thin center) — THE PA ⇄ CONTROL BRIDGE.
 *
 * THE POSITION. The plane's `controlLeg` seam (team-tool-plane.mjs,
 * "M1 CENTER PA WIRING") is the ONLY production path a `requires-approval`
 * admission can take to a body, and a PA `planApproval().approvalCaseId` is a
 * LOGICAL case id — never a durable Control row. This module is the AUTH-
 * owned leg that makes the ask real: it is the frozen-A full-obligation
 * bridge, never a decision boolean. The obligations, in the frozen order:
 *
 * ```
 * seam input {realmId, member, callId, request, plan, assembly}
 *   1. requestControl(...)             durable Control row for THIS PA case:
 *        reuse key = plan.approvalCaseId + callId (correlation),
 *        operationFingerprint = request.parametersFingerprint (the
 *        pre-execute-adapter precedent: correlation ties request/decision/
 *        guard to ONE logical operation; the fingerprint binds the exact
 *        impact identity). requestControl is idempotent over the scope key —
 *        a repeat of the same invocation REUSES the row, never mints a second.
 *        The strict PA manifest (ALL effects, requiredAuthority,
 *        perEffectRequired, deniedEffects, effectSetFingerprint,
 *        authorityGeneration) rides the durable row VERBATIM as the
 *        lossless `reviewPayload` + `reviewPayloadDigest` (PR-D D.3).
 *   2. awaitControlDecision(...)       the real durable decision (the wait
 *        bridge is liveness only; the durable rows are the authority).
 *        deny/stale-denied → 'deny'; abort/closed → 'unsettled'. ZERO mint
 *        on both arms — an unsettled ask never produces a grant.
 *   3. rung re-check (the bridge-side half of ADR A1-14, transcribed from
 *        `pre-execute-adapter` (4c')): the authority plane is re-read via
 *        `assembly.planApproval(request)` and the required rung re-derived;
 *        if it has RISEN above the rung the plan opened at (or the case
 *        identity moved, or the plane cannot answer), the old decision is
 *        NOT usable: deny with ZERO consumption, ZERO mint.
 *   4. presenter → PresentedApproval built ONLY from real facts: the case id
 *        the request carries, the REAL decider's rung (ControlCallerRef →
 *        ladder position), the trusted beneficiary from the assembly wiring,
 *        and the plan's creation-time rung / fingerprint / generation /
 *        denied-effect provenance copied VERBATIM (presenter discipline:
 *        every identity field is server-derived, none is model-supplied).
 *   5. assembly.issueApprovedGrant(request, approval)   the PA kernel's own
 *        landing edge (verify PER EFFECT, then mint the one-shot grant).
 *   6. controlService.guardOperation(exact scope + fingerprint)  the durable
 *        check-and-reserve UNDER the per-team lock — the bridge consumes the
 *        allow exactly once and NEVER re-enters, never mints a second grant.
 *        Blocked/failed → deny and the minted grant is NOT handed back.
 *   7. all green → { decision:'approve', requestId, approval, grant }
 *        (minted AND guard-consumed; the center must never mint on this path
 *        a second time — the seam contract pins exactly this shape).
 * ```
 *
 * WHAT THE BRIDGE NEVER DOES:
 *  - never synthesizes an approved-by-default row: it is reached ONLY for a
 *    `requires-approval` outcome (an all-allow world admits BEFORE the seam),
 *    and it refuses unless a REAL durable request row exists for the case —
 *    no row, no decision, no grant (the center's pending-refuse posture
 *    carried through the leg);
 *  - never fakes a decision: the wait returns the durable row or nothing —
 *    timeout/abort/closure settle as `unsettled`, never as allow;
 *  - owns NO ledger of its own (the Control ledger is `packages/runtime/
 *    control`'s durable store; the grant ledger is the PA assembly's) — this
 *    module holds no state beyond its injected wiring (the Alpha.4 "no
 *    in-memory state is authority" law and the pre-execute-adapter H4 law:
 *    nothing is stored, so nothing stale survives a restart);
 *  - touches no private API: the durable plane is used exactly through the
 *    public `ControlService` surface (`requestControl` /
 *    `awaitControlDecision` / `guardOperation` / `listControlState`), declared
 *    here as a STRUCTURAL minimal interface — the real service satisfies it,
 *    a stand-in that skips the durable row does not;
 *  - zero I/O of its own: no filesystem, no timers except the optional
 *    bounded-wait abort (the wait bridge owns its own poll cadence).
 *
 * THE SECOND EXPORT — {@link createPaGuardVerifyPort} — is the pure-verify
 * resolve/guard face for ALL Effects of the exact scope: read-only over the
 * durable state (`listControlState` is a fresh ledger read, invariant 45),
 * it answers whether an unconsumed durable allow covers the EXACT scope
 * without consuming anything and without minting anything. The AUTHORITATIVE
 * consumption stays `guardOperation`'s check-and-reserve under the per-team
 * lock; this port is the side-effect-free companion the resolve path may
 * consult, and it mirrors the guard's refusal vocabulary (no re-entry, no
 * second ledger).
 *
 * @module @dsh-agent-team/runtime/operation-permission/pa-control-bridge
 */

import { canonicalJsonFingerprint, parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { RemoteSafeJsonValue } from '../../contracts/src/index.js'
import type {
  AdmissionRequest,
  GovernanceResult,
  OperationGrant,
  RequestedEffectSet,
} from '../../domain/tool-governance/src/index.js'
import {
  CONTROL_ERROR_CODES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  isControlError,
} from '../control/index.js'
// The A5-M1 (PR358 fix) manifest/verifier surface: imported from the
// module's types file directly (the barrel predates the additive surface;
// the module declares the closed vocabulary and the strict parser there).
import { PA_CONTROL_MANIFEST_SCHEMA, parsePaControlManifest } from '../control/types.js'
import type {
  ControlDecisionRecord,
  ControlGuardVerdict,
  ControlOperationScope,
  ControlRequestKind,
  ControlRequestRecord,
  ControlWaitSignal,
} from '../control/index.js'
import type {
  PaControlManifest,
  PaEffectsVerifier,
  PaEffectsVerifierInput,
  PaEffectsVerifierVerdict,
} from '../control/types.js'
import { authorityRank, mayReview } from '../governance/authority-ceiling.js'
import { effectApprovalScope } from '../tool-admission/approval-case.js'
import type { RuntimeAuthority } from '../governance/runtime-authority.js'
import type { EffectSetApprovalPlan, PresentedApproval } from '../tool-admission/approval-case.js'

// ── The seam contract (structural mirror of the .mjs seam — the plane owns
//    the caller; this file owns the obligations) ──────────────────────────

/** What the plane hands the leg (frozen input shape). */
export interface PaControlLegInput {
  readonly realmId: string
  /** The trusted member identity the plane derived (never model input). */
  readonly member: { readonly teamSessionId: string; readonly instanceId: string }
  readonly callId: string
  readonly request: AdmissionRequest
  readonly plan: EffectSetApprovalPlan
  /** The plane's production admission assembly (the landing edges). */
  readonly assembly: PaLandingAssembly
  /**
   * A5-M1 item 4 (additive): the PARAMETER-LEVEL cancellation signal of
   * THIS invocation (the center threads the host exec/token cancel facts
   * through the seam). It joins the wiring-level `deps.signal` at every
   * checkpoint: the wait (abort ⇒ `unsettled`, the durable rows untouched),
   * AFTER the decision arrived and before anything is minted (⇒
   * `unsettled`: the durable allow stays exactly as written — retained,
   * never reclaimed, never faked as unconsumed later), and after the mint
   * and before the guard (⇒ deny, the minted grant NOT handed back — zero
   * PA consumption, zero body). A cancel that arrives AFTER the guard
   * consumed changes nothing: the durable consumption fact stands (truthful
   * retention — the center owns whether the body still runs).
   */
  readonly signal?: ControlWaitSignal
}

/** The landing edges the leg uses from the assembly (structural view — the
 *  real `ProductionAdmissionAssembly` satisfies it; nothing else may). */
export interface PaLandingAssembly {
  readonly planApproval: (request: AdmissionRequest) => GovernanceResult<EffectSetApprovalPlan>
  readonly issueApprovedGrant: (
    request: AdmissionRequest,
    approval: PresentedApproval,
  ) => Promise<GovernanceResult<OperationGrant>>
}

/** The frozen-A leg result. `approve` carries the MINTED, guard-CONSUMED
 *  grant (the seam rejects an approval without one); deny/unsettled carry
 *  the durable requestId when a row exists ('uncreated' semantics otherwise). */
export type PaControlLegResult =
  | {
      readonly decision: 'approve'
      readonly requestId: string
      readonly approval: PresentedApproval
      readonly grant: OperationGrant
    }
  | { readonly decision: 'deny'; readonly requestId?: string; readonly detail?: string }
  | { readonly decision: 'unsettled'; readonly requestId?: string; readonly detail?: string }

// ── The durable Control plane, as a STRUCTURAL minimal interface ─────────
// Only the four public methods this bridge needs. The real ControlService
// (packages/runtime/control) satisfies this shape; declaring the minimum
// keeps the bridge honest (no private API, no second authority path).

export type PaControlCaller =
  | { readonly kind: 'human'; readonly humanId: string }
  | { readonly kind: 'instance'; readonly instanceId: string }

export interface PaControlServiceLike {
  requestControl(args: {
    readonly rootSessionId: string
    readonly caller: PaControlCaller
    readonly kind: ControlRequestKind
    readonly targetInstanceId: string
    readonly actionName: string
    readonly toolName?: string
    readonly correlation: string
    readonly operationFingerprint?: string
    readonly summary?: string
    readonly reviewPayload?: RemoteSafeJsonValue
    readonly reviewPayloadDigest?: string
  }): Promise<ControlRequestRecord>
  awaitControlDecision(input: {
    readonly rootSessionId: string
    readonly requestId: string
    readonly signal?: ControlWaitSignal
  }): Promise<ControlDecisionRecord>
  guardOperation(scope: ControlOperationScope): Promise<ControlGuardVerdict>
  listControlState(rootSessionId: string): Promise<{
    readonly requests: readonly ControlRequestRecord[]
    readonly decisions: readonly ControlDecisionRecord[]
    readonly consumptions: readonly { readonly requestId: string; readonly decisionSequence: number }[]
    readonly abandonments: readonly { readonly requestId: string }[]
    readonly corruptLegs: readonly { readonly requestId?: string; readonly disclosesMember: boolean }[]
  }>
}

/** The trusted wiring of {@link createPaControlLeg}. Everything here is
 *  ASSEMBLY input (the host's own identity facts), never model-visible. */
export interface PaControlBridgeDeps {
  /** The REAL Alpha.4 durable control plane (structural minimal face). */
  readonly controlService: PaControlServiceLike
  /** The TeamSession (root session id) the durable rows live under. */
  readonly rootSessionId: string
  /** The requesting principal (host-authenticated — the member or leader
   *  this bridge speaks for; the facade resolves + envelope-checks it). */
  readonly caller: PaControlCaller
  /** Whose authority the case elevates (the plane's beneficiary rung). */
  readonly beneficiaryAuthority: RuntimeAuthority
  /** The logical operation name of the guarded execution (scope identity;
   *  request and guard MUST carry the same one — the bridge derives both). */
  readonly actionName?: string
  /** Override the carrier kind (default: leader ask → user-approval, a
   *  member/below ask → leader-approval — the pre-execute-adapter mapping). */
  readonly requestKind?: ControlRequestKind
  /** Optional bounded wait: on expiry the wait is ABORTED and the leg
   *  settles `unsettled` (never allow). ABSENT = wait unbounded. */
  readonly waitTimeoutMs?: number
  /** Optional caller-cancellation provider (checked at wait entry). */
  readonly signal?: () => ControlWaitSignal | undefined
  readonly onObserve?: (row: Readonly<Record<string, unknown>> & { readonly stage: string }) => void
}

/** The frozen-A action name of a guarded plane-tool execution. */
export const PA_CONTROL_ACTION_NAME = 'team-tool-execute'

/** The reuse key: the ONE logical PA case + the ONE invocation. */
export function paCorrelation(approvalCaseId: string, callId: string): string {
  return `pa:${approvalCaseId}:${callId}`
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const deepLossless = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value)) as unknown

/** ControlCallerRef (durable, closed) → the ladder position of the REAL
 *  decider. This is the presenter's ONLY reviewer-authority source: never a
 *  guess, never the beneficiary's rung, never a plan field. */
function deciderAuthority(decider: ControlDecisionRecord['decider']): RuntimeAuthority | undefined {
  if (decider.kind === 'human') return 'human-user'
  if (decider.kind === 'instance') {
    return decider.role === 'leader' ? 'leader' : 'member'
  }
  return undefined
}

function validateDeps(deps: PaControlBridgeDeps): string | undefined {
  if (deps === null || typeof deps !== 'object') return 'deps must be a record'
  const svc = deps.controlService
  if (svc === null || typeof svc !== 'object') return 'controlService is required'
  for (const m of ['requestControl', 'awaitControlDecision', 'guardOperation', 'listControlState'] as const) {
    if (typeof svc[m] !== 'function') return `controlService.${m} is required (the real durable Control surface)`
  }
  if (!isNonEmptyString(deps.rootSessionId)) return 'rootSessionId must be a non-empty string'
  if (deps.caller === null || typeof deps.caller !== 'object') return 'caller is required'
  if (deps.caller.kind === 'human' && !isNonEmptyString(deps.caller.humanId)) return 'caller.kind human requires a humanId'
  if (deps.caller.kind === 'instance' && !isNonEmptyString(deps.caller.instanceId)) return 'caller.kind instance requires an instanceId'
  if (deps.beneficiaryAuthority !== 'member' && deps.beneficiaryAuthority !== 'leader') {
    return 'beneficiaryAuthority must be the trusted beneficiary rung (member | leader)'
  }
  if (deps.actionName !== undefined && !isNonEmptyString(deps.actionName)) return 'actionName must be a non-empty string when present'
  if (deps.waitTimeoutMs !== undefined && (typeof deps.waitTimeoutMs !== 'number' || !Number.isFinite(deps.waitTimeoutMs) || deps.waitTimeoutMs <= 0)) {
    return 'waitTimeoutMs must be a finite positive number when present'
  }
  return undefined
}

/**
 * Build the frozen-A `requestApprovalLeg`. Construction fails LOUD (throws)
 * on malformed wiring — an ask-powered plane must never mount a bridge that
 * could answer allow out of a defective composition (fail-closed at assembly
 * time, the same posture as a Guard install failure failing the AgentSetup).
 */
export function createPaControlLeg(deps: PaControlBridgeDeps): (input: PaControlLegInput) => Promise<PaControlLegResult> {
  const problem = validateDeps(deps)
  if (problem !== undefined) throw new TypeError(`pa-control-bridge: ${problem}`)
  const observe = deps.onObserve ?? (((): void => {}) as NonNullable<PaControlBridgeDeps['onObserve']>)
  const deny = (detail: string, requestId?: string): PaControlLegResult => {
    observe({ stage: 'leg-deny', detail, ...(requestId === undefined ? {} : { requestId }) })
    return requestId === undefined ? { decision: 'deny', detail } : { decision: 'deny', requestId, detail }
  }
  const actionName = deps.actionName ?? PA_CONTROL_ACTION_NAME
  const requestKind: ControlRequestKind = deps.requestKind
    ?? (deps.beneficiaryAuthority === 'leader'
      ? CONTROL_REQUEST_KINDS.USER_APPROVAL
      : CONTROL_REQUEST_KINDS.LEADER_APPROVAL)

  return async (input: PaControlLegInput): Promise<PaControlLegResult> => {
    try {
      return await walkLeg(input)
    } catch (error: unknown) {
      // A bridge fault is a refusal, never a costume allow. The seam itself
      // must never see a thrown error escape the frozen-A vocabulary.
      const detail = `pa-control-bridge fault: ${error instanceof Error ? error.message : String(error)}`
      observe({ stage: 'leg-fault', detail })
      return { decision: 'deny', detail }
    }
  }

  async function walkLeg(input: PaControlLegInput): Promise<PaControlLegResult> {
    const { realmId, member, callId, request, plan, assembly } = input

    // ── structural intake (fail closed on a shape the obligations cannot
    //    be honoured for — never a half-walk). ──
    if (!isNonEmptyString(callId)) return deny('callId must be a non-empty string')
    if (!isNonEmptyString(member?.instanceId)) return deny('member.instanceId must be a non-empty string')
    if (!isNonEmptyString(request?.parametersFingerprint)) return deny('request.parametersFingerprint must be a non-empty string (the exact-scope fingerprint)')
    if (request?.member === undefined || request.member.instanceId !== member.instanceId) {
      return deny('the seam member and the admission request member disagree (attribution defect)')
    }
    if (!isNonEmptyString(plan?.approvalCaseId) || !isNonEmptyString(plan.effectSetFingerprint)) {
      return deny('the PA plan carries no case identity')
    }
    if (typeof assembly?.issueApprovedGrant !== 'function' || typeof assembly?.planApproval !== 'function') {
      return deny('the seam assembly carries no landing edges (issueApprovedGrant/planApproval)')
    }
    const effects = request.requestedEffects as RequestedEffectSet | undefined
    if (effects === undefined || !Array.isArray(effects.effects) || effects.effects.length === 0) {
      return deny('the request carries no effect set to cover')
    }
    if (plan.effectSetFingerprint !== effects.fingerprint) {
      return deny(`the plan's effect-set fingerprint ${plan.effectSetFingerprint} is not this request's ${effects.fingerprint} — the approval would cover a different set`)
    }
    const toolInvokeEffect = effects.effects.find((effect) => effect.kind === 'tool-invoke')
    const toolName = toolInvokeEffect?.toolName
    if (typeof toolName !== 'string' || toolName.length === 0) {
      return deny('the effect set names no tool-invoke tool — the guard scope would carry no tool identity')
    }

    // ── the strict PA operation manifest (PR358 fix, v2) — VERBATIM onto
    //    the durable row, and COMPLETE by the service's own re-parse ─────
    // A-class preservation: the approvalCaseId AND the A1-14 authority
    // point ride the payload top level, the binding/member/request facts
    // ride FIELD BY FIELD (the approval covers THIS binding, THIS member,
    // THIS parameter identity — a summary that drops a field is not the
    // approval), and the service RECOMPUTES the canonical digest: the row
    // identity (`operationFingerprint`) IS that payload-integrity digest,
    // while the EXECUTION-side `parametersFingerprint` rides the manifest
    // as an independent field (parameters ≠ digest BY CONSTRUCTION — the
    // two answer different questions: execution scope vs payload
    // integrity, and the same scope key can only ever answer the SAME
    // manifest bytes).
    const authorityScope = effectApprovalScope(toolInvokeEffect, realmId)
    const manifest = deepLossless({
      schema: PA_CONTROL_MANIFEST_SCHEMA,
      approvalCaseId: plan.approvalCaseId,
      authorityScope,
      requiredAuthority: plan.requiredAuthority,
      perEffectRequired: plan.perEffectRequired,
      deniedEffects: plan.deniedEffects,
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGeneration: plan.authorityGeneration,
      realmId,
      callId,
      parametersFingerprint: request.parametersFingerprint,
      effects: effects.effects,
      binding: request.binding,
      member: { teamSessionId: member.teamSessionId, instanceId: member.instanceId },
    })
    const digest = canonicalJsonFingerprint(manifest)
    const correlation = paCorrelation(plan.approvalCaseId, callId)

    // ── 1. the durable Control row (create OR idempotently REUSE) ───────
    let record: ControlRequestRecord
    try {
      record = await deps.controlService.requestControl({
        rootSessionId: deps.rootSessionId,
        caller: deps.caller,
        kind: requestKind,
        targetInstanceId: member.instanceId,
        actionName,
        toolName,
        correlation,
        // A5-M1: the row identity binds the PAYLOAD-INTEGRITY digest (the
        // service recomputes and enforces it; the parameters fingerprint
        // rides the manifest as the separate execution-side fact). Same
        // case replayed with ANY different manifest bytes = different
        // scope key = a new row, never a silent reuse.
        operationFingerprint: digest,
        summary: `PA ask case=${plan.approvalCaseId} rung=${plan.requiredAuthority} tool=${toolName} effects=${String(effects.effects.length)}`,
        // The manifest is a pure JSON round-trip (deepLossless), i.e. a
        // lossless JSON value BY CONSTRUCTION; the type carries that fact.
        reviewPayload: manifest as unknown as RemoteSafeJsonValue,
        reviewPayloadDigest: digest,
      })
    } catch (error: unknown) {
      // No row → no decision → no grant. Approved-by-default does not exist.
      return deny(`durable control request failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    observe({ stage: 'request-created', callId, requestId: record.requestId, paCaseId: plan.approvalCaseId, correlation })
    // Reuse honesty: the SAME scope key may only ever answer the SAME strict
    // manifest. A digest drift under one key is a different question wearing
    // this invocation's identity — refuse, never re-present, never consume.
    if (record.reviewPayloadDigest !== undefined && record.reviewPayloadDigest !== digest) {
      return deny(`the durable row ${record.requestId} carries a DIFFERENT strict manifest digest (${String(record.reviewPayloadDigest)}) than this plan (${digest}) — scope-key identity drift is a different question`, record.requestId)
    }

    // ── 2. await the REAL durable decision ──────────────────────────────
    let decision: ControlDecisionRecord
    const signals: ControlWaitSignal[] = []
    const wiringSignal = deps.signal?.()
    if (wiringSignal !== undefined) signals.push(wiringSignal)
    if (input.signal !== undefined) signals.push(input.signal)
    const cancelled = (): boolean => signals.some((s) => s.aborted === true)
    if (cancelled()) {
      // The row exists (durable, resolvable later); this invocation stops —
      // cancellation never decides, and it never mints.
      observe({ stage: 'leg-unsettled', callId, requestId: record.requestId, detail: 'pre-aborted' })
      return { decision: 'unsettled', requestId: record.requestId, detail: 'the approval wait was cancelled before it began (the durable request stays pending)' }
    }
    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (deps.waitTimeoutMs !== undefined) {
        controller = new AbortController()
        timer = setTimeout(() => controller?.abort(), deps.waitTimeoutMs)
        signals.push(controller.signal as unknown as ControlWaitSignal)
      }
      decision = await deps.controlService.awaitControlDecision({
        rootSessionId: deps.rootSessionId,
        requestId: record.requestId,
        ...(signals.length === 1
          ? { signal: signals[0] as ControlWaitSignal }
          : signals.length > 1
            ? { signal: AbortSignal.any(signals.map((s) => s as unknown as AbortSignal)) as unknown as ControlWaitSignal }
            : {}),
      })
    } catch (error: unknown) {
      if (isControlError(error)
        && (error.code === CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED || error.code === CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED)) {
        // UNSETTLED: the durable row stays exactly as it is (a later resolve
        // is unaffected); zero mint, zero guard, zero body by construction.
        observe({ stage: 'leg-unsettled', callId, requestId: record.requestId, code: (error as { code: string }).code })
        return { decision: 'unsettled', requestId: record.requestId, detail: `the approval wait settled ${String((error as { code: string }).code)} (the durable request is untouched)` }
      }
      return deny(`the approval wait failed: ${error instanceof Error ? error.message : String(error)}`, record.requestId)
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
    observe({ stage: 'decision-arrived', callId, requestId: record.requestId, decision: decision.decision })

    // Any non-allow durable decision denies (deny / stale-denied — a closed
    // request can never become an allow).
    if (decision.decision !== 'allow') {
      return deny(`the approval was denied (${decision.decision})`, record.requestId)
    }

    // A5-M1 item 4: the mint-time cancellation checkpoint. The arrived
    // decision is DURABLE truth and stays exactly as the decider wrote it
    // (retained — a later probe still sees the unspent allow; nothing is
    // reclaimed, nothing is later reported as unconsumed that was
    // consumed). What the cancel stops is everything downstream: zero
    // mint, zero guard consumption, zero PA consumption, zero body.
    if (cancelled()) {
      observe({ stage: 'leg-unsettled', callId, requestId: record.requestId, detail: 'cancelled-after-decision' })
      return {
        decision: 'unsettled',
        requestId: record.requestId,
        detail: 'the invocation was cancelled after the decision arrived and before any grant was minted (the durable allow stays exactly as written, unspent)',
      }
    }

    // ── 3. the bridge-side A1-14 rung re-check (pre-execute-adapter (4c')) ─
    // The authority plane is read AGAIN through the assembly's OWN derivation
    // and the required rung re-derived; a rise (or an unreadable plane, or a
    // moved case identity) makes the just-arrived decision NOT usable. The
    // durable allow stays exactly as the decider wrote it: unspent, untouched.
    let fresh: GovernanceResult<EffectSetApprovalPlan>
    try {
      fresh = assembly.planApproval(request)
    } catch (error: unknown) {
      return deny(`the authority plane could not be re-read at execution (${error instanceof Error ? error.message : String(error)}) — the approved invocation did not execute and the one-shot allow was not consumed`, record.requestId)
    }
    if (!fresh.ok) {
      return deny(`the authority plane refused the re-derivation (${fresh.error.message}) — the approved invocation did not execute and the one-shot allow was not consumed`, record.requestId)
    }
    if (fresh.value.approvalCaseId !== plan.approvalCaseId) {
      return deny(`the case identity moved (${plan.approvalCaseId} → ${fresh.value.approvalCaseId}) between ask and execution — a different question, never the approved one`, record.requestId)
    }
    if (authorityRank(fresh.value.requiredAuthority) > authorityRank(plan.requiredAuthority)) {
      return deny(`the approval authority rose to '${fresh.value.requiredAuthority}' after the decision was given at '${plan.requiredAuthority}' — the old decision is not usable and the one-shot allow was not consumed`, record.requestId)
    }

    // ── 4. the trusted presenter: the PresentedApproval, real facts only ─
    const reviewerAuthority = deciderAuthority(decision.decider)
    if (reviewerAuthority === undefined) {
      return deny('the durable decider is outside the closed ControlCallerRef vocabulary — no reviewer rung can be presented', record.requestId)
    }
    const approval: PresentedApproval = Object.freeze({
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority,
      beneficiaryAuthority: deps.beneficiaryAuthority,
      requiredAuthorityAtCreation: plan.requiredAuthority,
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: plan.authorityGeneration,
      // F-2 presenter discipline: the denied-effect provenance VERBATIM.
      deniedEffectsAtCreation: plan.deniedEffects.map((pair) => Object.freeze({ effectIndex: pair.effectIndex, requiredAuthority: pair.requiredAuthority })),
    })

    // ── 5. the PA landing edge (verify per effect, then mint) ───────────
    const issued = await assembly.issueApprovedGrant(request, approval)
    if (!issued.ok) {
      // Zero mint. The durable allow is still unspent — a refusal is a
      // refusal, never a retry hook.
      return deny(`the approved grant was refused at landing (${issued.error.code}: ${issued.error.message})`, record.requestId)
    }
    observe({ stage: 'grant-minted', callId, requestId: record.requestId, grantId: issued.value.grantId })

    // A5-M1 item 4: the consumption-point cancellation checkpoint. The
    // minted one-shot grant stays behind the refusal (never handed back to
    // a dead invocation); the durable Control state is untouched — no
    // guard call, hence zero consumption.
    if (cancelled()) {
      return deny('the invocation was cancelled after the grant was minted and before the durable consumption; the minted grant is not returned (zero PA consumption, zero body)', record.requestId)
    }

    // ── 6. the last-mile durable consumption (check-and-reserve, in-lock) ─
    const scope: ControlOperationScope = Object.freeze({
      rootSessionId: deps.rootSessionId,
      targetInstanceId: member.instanceId,
      actionName,
      toolName,
      correlation,
      // The guard's exact scope identity is the SAME payload-integrity
      // digest the row was created under (the parameters binding is
      // inside the manifest the digest covers).
      operationFingerprint: digest,
    })
    let verdict: ControlGuardVerdict
    try {
      verdict = await deps.controlService.guardOperation(scope)
    } catch (error: unknown) {
      // The grant stays behind the deny (never handed back); the one-shot
      // ledgers make a replay impossible.
      return deny(`the last-mile guard failed (${error instanceof Error ? error.message : String(error)}); the minted grant is not returned`, record.requestId)
    }
    if (!verdict.allowed) {
      return deny(`the last-mile guard blocked the operation (${verdict.reason}); the minted grant is not returned`, record.requestId)
    }
    // A5-M1 (PR358 fix): an `allowed` verdict must PAIR to this exact
    // request — the requestId AND the decision sequence of the decision
    // this invocation waited on. A verdict that names any other row (or
    // no row at all) is not an authorization of THIS operation, whatever
    // it says; the minted grant stays behind the refusal.
    if (verdict.requestId !== record.requestId || verdict.decisionSequence !== decision.decisionSequence) {
      return deny(
        `the last-mile guard answered with a foreign pairing (requestId=${String(verdict.requestId)} decisionSequence=${String(verdict.decisionSequence)}; this row: ${record.requestId}/${String(decision.decisionSequence)}) — a verdict not paired to this request authorizes nothing; the minted grant is not returned`,
        record.requestId,
      )
    }
    observe({ stage: 'guard-consumed', callId, requestId: record.requestId, grantId: issued.value.grantId })

    // ── 7. the frozen-A success shape (minted AND guard-consumed) ────────
    return { decision: 'approve', requestId: record.requestId, approval, grant: issued.value }
  }
}

// ── The third product: the ALL-EFFECTS verifier (the service's injected port) ──
//
// The PR358 review fix's PA-side half. The host wires this ONE pure port
// into `createControlService({ paEffectsVerifier })`; the service then asks
// the same question, INSIDE the per-team lock, at BOTH gates — before an
// ALLOW is committed (decider = the real resolving caller) and before the
// consumption fact is written (decider = the durable allow's decider). The
// question is the seam's own landing law re-asked against the CURRENT
// authority/policy facts, derived ONLY from the durable manifest's own
// snapshots:
//
//  1. the binding/effect-set snapshots must still reconstruct the domain
//     request (the domain's own parsers — a snapshot that no longer
//     re-canonicalizes is UNDETERMINED, never covered);
//  2. `planApproval` re-derived: a refusal, a moved case identity, or a
//     moved effect-set fingerprint is DRIFT (the approved question no
//     longer exists);
//  3. per effect, `mayReview(decider, beneficiary, freshRequired[i])` —
//     the fresh per-effect rung is the fused policy∧ceiling requirement
//     (the walk's own law: a ceiling can raise the bar, never lower it),
//     so this one legality test per effect walks the FULL set for the
//     REAL decider (ADR A3-2; the ceiling half is already fused).
//
// THE LAW IT OBEYS (mirrors `PaEffectsVerifier` in the control types): it
// is SYNCHRONOUS and PURE — zero mint, zero ledger touch, zero I/O, zero
// re-entry into the control service; the two gates asking the same port
// the same question is what makes a drift arriving between decision and
// consumption refuse at the later gate with zero consumption.

export interface PaEffectsVerifierDeps {
  /** The landing assembly the manifest's realm re-derives through (trusted
   *  wiring — the SAME facts the seam's leg used for this call). A realm
   *  with no answer is undetermined, never covered. */
  readonly assemblyFor: (manifest: PaControlManifest) => PaLandingAssembly | undefined
  /** The trusted beneficiary rung of the manifest's case (assembly wiring,
   *  never payload data). */
  readonly beneficiaryOf: (manifest: PaControlManifest) => RuntimeAuthority | undefined
  readonly onObserve?: (row: Readonly<Record<string, unknown>> & { readonly stage: string }) => void
}

export function createPaEffectsVerifier(deps: PaEffectsVerifierDeps): PaEffectsVerifier {
  const observe = deps.onObserve ?? (((): void => {}) as NonNullable<PaEffectsVerifierDeps['onObserve']>)
  return (input: PaEffectsVerifierInput): PaEffectsVerifierVerdict => {
    const { manifest, decider } = input
    const undetermined = (detail: string): PaEffectsVerifierVerdict => {
      observe({ stage: 'pa-verifier', gate: input.stage, outcome: 'undetermined', detail, requestId: input.requestId })
      return { ok: false, reason: 'authority-undetermined', detail }
    }
    const drifted = (detail: string): PaEffectsVerifierVerdict => {
      observe({ stage: 'pa-verifier', gate: input.stage, outcome: 'drift', detail, requestId: input.requestId })
      return { ok: false, reason: 'pa-authority-drift', detail }
    }
    const deciderRung = deciderAuthority(decider)
    if (deciderRung === undefined) {
      return undetermined('the durable decider is outside the closed ControlCallerRef vocabulary — its reach cannot be derived')
    }
    const assembly = deps.assemblyFor(manifest)
    if (assembly === undefined || typeof assembly.planApproval !== 'function') {
      return undetermined(`no landing assembly is wired for realm '${manifest.realmId}' — the all-Effects coverage cannot be answered`)
    }
    const beneficiary = deps.beneficiaryOf(manifest)
    if (beneficiary === undefined) return undetermined('no trusted beneficiary rung is wired for this case')
    const binding = parseToolBinding({ ...manifest.binding })
    if (!binding.ok) {
      return undetermined(`the manifest binding snapshot no longer reconstructs a domain ToolBinding (${JSON.stringify(binding.problems).slice(0, 160)})`)
    }
    const effectSet = parseRequestedEffectSet(manifest.effects)
    if (!effectSet.ok) {
      return undetermined(`the manifest effect set no longer reconstructs (${JSON.stringify(effectSet.problems).slice(0, 160)})`)
    }
    if (effectSet.value.fingerprint !== manifest.effects.fingerprint) {
      return drifted(`the effect set re-canonicalizes to ${effectSet.value.fingerprint}, not the manifest's ${manifest.effects.fingerprint}`)
    }
    const request: AdmissionRequest = Object.freeze({
      binding: binding.value,
      member: Object.freeze({ teamSessionId: manifest.member.teamSessionId, instanceId: manifest.member.instanceId }),
      callId: manifest.callId,
      realmId: manifest.realmId,
      parametersFingerprint: manifest.parametersFingerprint,
      requestedEffects: effectSet.value,
    })
    let fresh: GovernanceResult<EffectSetApprovalPlan>
    try {
      fresh = assembly.planApproval(request)
    } catch (error: unknown) {
      return undetermined(`the authority plane refused to answer at the ${input.stage} gate (${error instanceof Error ? error.message : String(error)})`)
    }
    if (!fresh.ok) {
      return drifted(`the authority plane refused the re-derivation at the ${input.stage} gate (${fresh.error.message}) — the approved effect set no longer has an approvable path`)
    }
    if (fresh.value.approvalCaseId !== manifest.approvalCaseId) {
      return drifted(`the approval case identity moved (${manifest.approvalCaseId} → ${fresh.value.approvalCaseId}) — this row approves a question that no longer exists`)
    }
    if (fresh.value.effectSetFingerprint !== manifest.effects.fingerprint) {
      return drifted(`the effect-set fingerprint moved at re-derivation (${manifest.effects.fingerprint} → ${fresh.value.effectSetFingerprint})`)
    }
    if (fresh.value.perEffectRequired.length !== manifest.effects.effects.length) {
      return undetermined('the fresh per-effect derivation does not cover every effect of the set')
    }
    for (let i = 0; i < fresh.value.perEffectRequired.length; i += 1) {
      const required = fresh.value.perEffectRequired[i]
      if (required === undefined) return undetermined(`the fresh per-effect derivation is missing entry ${String(i)}`)
      if (!mayReview(deciderRung, beneficiary, required)) {
        return drifted(`effect ${String(i)} now requires '${required}' at the ${input.stage} gate; the durable decider '${deciderRung}' cannot cover it for beneficiary '${beneficiary}'`)
      }
    }
    observe({ stage: 'pa-verifier', gate: input.stage, outcome: 'covered', requestId: input.requestId, effects: String(fresh.value.perEffectRequired.length) })
    return { ok: true }
  }
}

// ── The second product: the PURE verify resolve/guard port ───────────────
// Pure read over the durable state: never consumes, never mints, never
// writes. The authoritative check-and-reserve stays `guardOperation`.

export interface PaGuardVerifyInput {
  /** Defaults to the bridge's root session. */
  readonly rootSessionId?: string
  readonly targetInstanceId: string
  readonly actionName: string
  readonly toolName?: string
  readonly correlation: string
  readonly operationFingerprint?: string
  /** A5-M1: the EXECUTION-side fingerprint. For a PA manifest row the
   *  probe must present it — a probe whose parameters disagree with the
   *  approved manifest is a different invocation (`scope-mismatch`),
   *  never a mirror hit. */
  readonly parametersFingerprint?: string
}

export type PaGuardVerifyVerdict =
  | { readonly allowed: true; readonly requestId: string; readonly decisionSequence: number }
  | { readonly allowed: false; readonly reason: string; readonly requestId?: string }

export interface PaGuardVerifyPort {
  readonly verify: (input: PaGuardVerifyInput) => Promise<PaGuardVerifyVerdict>
}

/**
 * The pure-verify counterpart of `guardOperation` for the EXACT scope of one
 * PA-guarded plane execution (all Effects ride the one payload-bound
 * manifest). Read-only by construction: one fresh `listControlState` per call,
 * zero durable writes, zero ledger touch. Mirrors the guard's closed refusal
 * vocabulary — and after the PR358 fix it mirrors the guard's VERIFICATION
 * too: a PA operation-manifest row is answered `authority-undetermined`
 * UNLESS the same `paEffectsVerifier` the service is wired with is passed
 * here. That is deliberate: this port answers whether an unconsumed durable
 * allow COVERS the exact scope; for a manifest row, coverage IS a verified
 * fact and an unverified mirror is NOT a pre-submit green light. The
 * AUTHORITATIVE check-and-reserve (the lock, the consumption fact) stays
 * with `guardOperation` alone.
 */
export function createPaGuardVerifyPort(deps: Pick<PaControlBridgeDeps, 'controlService' | 'rootSessionId'> & {
  readonly verifier?: PaEffectsVerifier
}): PaGuardVerifyPort {
  const problem = (() => {
    const svc = deps.controlService
    if (svc === null || typeof svc !== 'object' || typeof svc.listControlState !== 'function') return 'controlService.listControlState is required'
    if (!isNonEmptyString(deps.rootSessionId)) return 'rootSessionId must be a non-empty string'
    return undefined
  })()
  if (problem !== undefined) throw new TypeError(`pa-control-bridge(verify-port): ${problem}`)

  return Object.freeze({
    verify: async (input: PaGuardVerifyInput): Promise<PaGuardVerifyVerdict> => {
      const root = input.rootSessionId ?? deps.rootSessionId
      const state = await deps.controlService.listControlState(root)
      const candidate = state.requests.find((row) =>
        row.rootSessionId === root
        && instanceSubjectOf(row) === input.targetInstanceId
        && row.actionName === input.actionName
        && (row.toolName ?? '') === (input.toolName ?? '')
        && row.correlation === input.correlation
        && (row.operationFingerprint ?? '') === (input.operationFingerprint ?? ''))
      if (candidate === undefined) {
        // RULING 5-B honest mirror: a corrupt row that discloses NONE of the
        // candidacy members cannot be attributed to this scope by ANY
        // reading, so it never blocks here either (same disclosed boundary
        // the guard carries); an attributable one surfaced in `requests`.
        return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST }
      }
      const corruptMatch = state.corruptLegs.find((leg) => leg.disclosesMember && leg.requestId === candidate.requestId)
      if (corruptMatch !== undefined) {
        return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED, requestId: candidate.requestId }
      }
      if (state.abandonments.some((a) => a.requestId === candidate.requestId)) {
        return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED, requestId: candidate.requestId }
      }
      const decision = state.decisions.find((d) => d.requestId === candidate.requestId && scopeSnapshotsEqual(d.scope, {
        rootSessionId: root,
        targetInstanceId: input.targetInstanceId,
        actionName: input.actionName,
        ...(input.toolName === undefined ? {} : { toolName: input.toolName }),
        correlation: input.correlation,
        ...(input.operationFingerprint === undefined ? {} : { operationFingerprint: input.operationFingerprint }),
      }))
      if (decision === undefined) {
        if (candidate.status === 'pending') return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING, requestId: candidate.requestId }
        const anyDecision = state.decisions.some((d) => d.requestId === candidate.requestId)
        return { allowed: false, reason: anyDecision ? CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH : CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST, requestId: candidate.requestId }
      }
      if (decision.decision !== 'allow') {
        return { allowed: false, reason: `decision-${decision.decision}`, requestId: candidate.requestId }
      }
      const consumed = state.consumptions.some((c) => c.requestId === candidate.requestId && c.decisionSequence === decision.decisionSequence)
      if (consumed) return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED, requestId: candidate.requestId }
      // A5-M1 (PR358 fix): the verification mirror. A PA operation-manifest
      // row whose coverage nobody can answer is NOT reported as allowed —
      // an `allowed: true` here without the service's own verifier would be
      // exactly the pre-submit green light this port must never be. A
      // corrupt manifest (marker present, strict parse fails) is
      // undetermined the same way both service gates treat it.
      const rawManifest = candidate.reviewPayload
      if (
        rawManifest !== undefined
        && typeof rawManifest === 'object'
        && rawManifest !== null
        && (rawManifest as Record<string, unknown>)['schema'] === PA_CONTROL_MANIFEST_SCHEMA
      ) {
        const manifest = parsePaControlManifest(rawManifest)
        if (manifest === undefined) {
          return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED, requestId: candidate.requestId }
        }
        if (input.parametersFingerprint !== undefined && input.parametersFingerprint !== manifest.parametersFingerprint) {
          return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH, requestId: candidate.requestId }
        }
        if (deps.verifier === undefined) {
          return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED, requestId: candidate.requestId }
        }
        const verdict = deps.verifier({
          stage: 'guard',
          rootSessionId: root,
          requestId: candidate.requestId,
          manifest,
          decider: decision.decider,
        })
        if (!verdict.ok) {
          return { allowed: false, reason: verdict.reason, requestId: candidate.requestId }
        }
      }
      return { allowed: true, requestId: candidate.requestId, decisionSequence: decision.decisionSequence }
    },
  })
}

/** The instance identity a durable row addresses (canonical subject, with
 *  the legacy targetInstanceId projection — the same normalization the
 *  control plane itself applies). */
function instanceSubjectOf(row: ControlRequestRecord): string | undefined {
  if (row.subject?.kind === 'instance') return row.subject.instanceId
  return row.targetInstanceId
}

/** The exact-scope snapshot equality of the control plane's
 *  `scopeSnapshotMatches`, restricted to the fields a bridge row carries
 *  (legacy instance subject; no authority point — the bridge mints no v3
 *  case leg). Present-on-one-side fingerprint is a mismatch, both-absent is
 *  equality — byte-identical law, one reading. */
function scopeSnapshotsEqual(
  recorded: ControlOperationScope,
  guarded: ControlOperationScope,
): boolean {
  if (recorded.rootSessionId !== guarded.rootSessionId) return false
  const recordedInstance = recorded.subject?.kind === 'instance' ? recorded.subject.instanceId : recorded.targetInstanceId
  const guardedInstance = guarded.subject?.kind === 'instance' ? guarded.subject.instanceId : guarded.targetInstanceId
  if (recordedInstance !== guardedInstance) return false
  if (recorded.actionName !== guarded.actionName) return false
  if (recorded.correlation !== guarded.correlation) return false
  if ((recorded.toolName ?? '') !== (guarded.toolName ?? '')) return false
  if ((recorded.operationFingerprint ?? '') !== (guarded.operationFingerprint ?? '')) return false
  return true
}
