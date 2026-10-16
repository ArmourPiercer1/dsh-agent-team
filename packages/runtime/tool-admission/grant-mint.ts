/**
 * Alpha.5 PR2 (plan §5) — THE ONE-SHOT GRANT MINT AND THE CONSUMPTION LEDGER.
 *
 * WHAT THIS OWNS:
 *  - {@link mintOperationGrant}: builds an `OperationGrant` for ONE call and
 *    runs it through PR0's {@link parseOperationGrant} before handing it out —
 *    the frozen parser is the only grant grammar (a mint that cannot be
 *    re-parsed is a mint that never happened);
 *  - {@link createGrantLedger}: the single-use consumption fact. PR2 is the
 *    lane the PR0 doc names for the durable ledger ("consumption lives in
 *    PR2's durable ledger, which reaches this pure validation as an
 *    immutable read-only VIEW"). This module therefore ships the CONSUMPTION
 *    LAW plus an in-closure ledger for the assembly that hosts it. It creates
 *    NO second authorization fact: the ledger stores only "this grantId was
 *    consumed at this edge" — the grant itself, the approval case and the
 *    Alpha.4 audit trail stay exactly where Alpha.4 put them (plan §5 验收:
 *    数据库不出现"第二套授权事实").
 *
 * THE ATOMICITY LAW: `consume` performs validation-then-mark in ONE
 * synchronous step (no `await` between them) — JS's run-to-completion is what
 * makes "two concurrent Asks racing one grant" resolve to exactly one winner,
 * and the interleaving test pins it. Reordering to validate → await → mark
 * would admit the double-spend, so the step stays synchronous BY CONTRACT and
 * the test drives interleaved async callers.
 *
 * The precedence of refusal reasons is PR0's frozen one (identity → realm →
 * generation → revision → fingerprint → effect containment → expiry →
 * consumption LAST); this module adds NOTHING to it and re-spells nothing —
 * it maps the PR0 reason onto the PR0 frozen §5 code via
 * {@link grantRefusalErrorCode} and refuses. `now` reaching `consume` has
 * ALREADY passed the H1 finite-clock gate (clock.ts); the kernel enforces the
 * order, and `a5p2-grant-oneshot` pins both.
 *
 * Purity: no `node:*`, no I/O, no clock, no timers.
 *
 * @module @dsh-agent-team/runtime/tool-admission/grant-mint
 */

import {
  grantRefusalErrorCode,
  parseOperationGrant,
  validateGrantForCall,
  type GrantCallContext,
  type GrantConsumptionLedgerView,
  type GovernanceResult,
  type MemberRef,
  type OperationGrant,
  type RequestedEffectSet,
} from '../../domain/tool-governance/src/index.js'
import { requireFiniteClock } from './clock.js'

/** The inputs of one mint — all server-derived, none model-visible. */
export interface MintInputs {
  readonly grantId: string
  readonly member: MemberRef
  readonly callId: string
  readonly realmId: string
  readonly bindingId: string
  readonly bindingRevision: number
  readonly authorityGeneration: number
  readonly parametersFingerprint: string
  readonly effects: RequestedEffectSet
  readonly issuedAt: number
  /** `null` = no expiry (PR0: never an expiry at zero). */
  readonly expiresAt: number | null
}

/**
 * Mint one grant and PROVE it against the frozen grammar before anyone can
 * hold it. A mint that fails the parser returns the parser's problems as a
 * typed refusal — the minting layer never ships a record the consumption
 * layer would not accept.
 */
export function mintOperationGrant(inputs: MintInputs): GovernanceResult<OperationGrant> {
  const parsed = parseOperationGrant({ ...inputs, singleUse: true })
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        code: 'TOOL_BINDING_UNVERIFIED',
        message: `admission refused: the minted grant failed the frozen grant grammar (${parsed.problems.map((p) => `${p.path}: ${p.code}`).join('; ')})`,
        details: { refusal: 'mint-rejected' },
      },
    }
  }
  return { ok: true, value: Object.freeze(parsed.value) }
}

/** The consumption edge's answer. */
export type ConsumeOutcome =
  | { readonly ok: true; readonly grant: OperationGrant }
  | { readonly ok: false; readonly reason: string; readonly errorCode: string; readonly message: string }

/** The ledger the assembly holds (its `view` is what PR0 validation reads). */
export interface GrantLedger {
  /** Register a minted grant so this ledger can vouch for its identity.
   *  Re-registering the same grantId with a DIFFERENT grant is refused —
   *  grantId reuse is replay territory. */
  readonly register: (grant: OperationGrant) => GovernanceResult<void>
  /** The one consumption edge: validate-then-mark, ONE synchronous step. */
  readonly consume: (grantId: string, call: GrantCallContext) => ConsumeOutcome
  /** The read-only view PR0's `validateGrantForCall` consumes. */
  readonly view: GrantConsumptionLedgerView
  readonly consumedCount: () => number
}

/**
 * Create one assembly-scoped consumption ledger (per-closure state, zero
 * module state — same discipline as the PR1 Guard/Dispatcher).
 */
export function createGrantLedger(): GrantLedger {
  const byId = new Map<string, OperationGrant>()
  const consumed = new Set<string>()
  const view: GrantConsumptionLedgerView = { isConsumed: (grantId) => consumed.has(grantId) }
  return {
    register: (grant) => {
      const existing = byId.get(grant.grantId)
      if (existing !== undefined) {
        if (existing === grant) return { ok: true, value: undefined }
        return {
          ok: false,
          error: {
            code: 'TOOL_BINDING_UNVERIFIED',
            message: `grantId "${grant.grantId}" is already registered to a DIFFERENT grant — a consumed or live grantId is never re-issued (no replay surface)`,
            details: { refusal: 'grant-id-reuse' },
          },
        }
      }
      byId.set(grant.grantId, grant)
      return { ok: true, value: undefined }
    },
    consume: (grantId, call) => {
      // H1 again AT the consumption edge: the expiry leg must never see a
      // non-finite clock (NaN passes the PR0 strict `>`). Refuse BEFORE the
      // PR0 validation runs at all — zero ledger change, zero consume.
      const clock = requireFiniteClock(call.now, `grant consumption for call ${call.callId}`)
      if (!clock.ok) {
        return { ok: false, reason: 'clock-not-finite', errorCode: clock.error.code, message: clock.error.message }
      }
      const grant = byId.get(grantId)
      if (grant === undefined) {
        return { ok: false, reason: 'unknown-grant', errorCode: 'TOOL_BINDING_UNVERIFIED', message: `grant "${grantId}" is not registered with this ledger (a grant never consumed through a ledger it was not minted on)` }
      }
      const validation = validateGrantForCall(grant, { ...call, now: clock.value }, view)
      if (!validation.ok) {
        return {
          ok: false,
          reason: validation.reason,
          errorCode: grantRefusalErrorCode(validation.reason),
          message: `grant "${grantId}" refused at the consumption edge: ${validation.reason} (frozen PR0 precedence; no retry, no fallback, design §4.3)`,
        }
      }
      // VALIDATE-then-MARK, same synchronous step as the check above — this
      // is where the one-shot law lives.
      consumed.add(grantId)
      return { ok: true, grant }
    },
    view,
    consumedCount: () => consumed.size,
  }
}
