/**
 * P9-T8 (S5-D) — pure model for the handoff flows (plan P9-S5 S5-D +
 * Gate P9-G5; UI doc §32; Architecture §34): the `handoff.prepare`
 * one-shot summary value (read-only preview — the source is NEVER
 * re-read and the target team NEVER gets source-history live-read),
 * the `handoff.create` state narrowing over the frozen
 * `HandoffOperationState` wire mirror, and the client-side decision
 * mapping of the §32.4 triad.
 *
 * Frozen-wire decision mapping (plan §10.5 verbatim: "retry 依赖
 * (sourceSessionId, requestToken) idempotency; continue/cancel 是
 * client-local decision，不添加 backend method"):
 *
 * - `creation-failed` → RETRY re-invokes `handoff.create` with the SAME
 *   `(sourceSessionId, requestToken)`: the host re-drives ONLY the team
 *   creation idempotently (the frozen context stays; the source is not
 *   re-read — runtime/handoff/service.ts re-invocation semantics).
 * - `awaiting-decision` → RETRY uses a FRESH request token: a same-token
 *   re-invocation is a pure idempotent replay of the stored failure
 *   (the one-shot summarization is NEVER re-run under a used token), so
 *   a meaningful retry is a fresh operation. No double-creation risk:
 *   `awaiting-decision` means NO team exists under the old token yet.
 * - CONTINUE-WITHOUT-HANDOFF is always client-local: the panel falls
 *   back to the standard non-handoff create sequence (native root +
 *   `team.create`) — a new team WITHOUT handoff provenance; no backend
 *   decision method exists on the frozen wire.
 * - CANCEL is always client-local: the panel discards; no remote call,
 *   no team.
 *
 * G5: the typed outcome parser is the shared `parseMemberCommandOutcome`
 * (team-member-commands) — preserved verbatim, never exception-ified;
 * no optimistic authority patch; projection pull exactly once on
 * success (the completed team renders from the NEW session's projection
 * after `openSession`, exactly as the T7 `team.create` path).
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-handoff
 */

import type { RemoteSafeRecord } from '../../../remote/src/index.js'

/** The frozen §34.4 triad options (host `HANDOFF_DECISION_OPTIONS`). */
export type HandoffDecisionOption =
  | 'retry'
  | 'continue-without-handoff'
  | 'cancel'

/** Every frozen triad option (closed set, canonical order). */
export const HANDOFF_DECISION_OPTIONS: readonly HandoffDecisionOption[] = [
  'retry',
  'continue-without-handoff',
  'cancel',
]

/** Closed-set membership test for a triad option. */
export function isHandoffDecisionOption(
  value: unknown,
): value is HandoffDecisionOption {
  return (
    typeof value === 'string' &&
    (HANDOFF_DECISION_OPTIONS as readonly string[]).includes(value)
  )
}

function requireString(value: RemoteSafeRecord, field: string): string {
  const raw = value[field]
  if (typeof raw !== 'string') {
    throw new Error(`HANDOFF_MALFORMED: ${field} must be a string`)
  }
  return raw
}

// --- handoff.prepare -------------------------------------------------------------

/**
 * The `handoff.prepare` success value: the one-shot summary of the
 * frozen source surface (title + compressed bullets). Read-only — no
 * durable write, no team creation.
 */
export interface HandoffPrepareValueWire {
  readonly sourceSessionId: string
  readonly title: string
  readonly bullets: readonly string[]
}

/** Parse the `handoff.prepare` success value. */
export function parseHandoffPrepareValue(
  value: unknown,
): HandoffPrepareValueWire {
  const record = asRecord(value, 'value')
  const sourceSessionId = requireString(record, 'sourceSessionId')
  const rawSummary = record['summary']
  if (typeof rawSummary !== 'object' || rawSummary === null || Array.isArray(rawSummary)) {
    throw new Error('HANDOFF_MALFORMED: summary must be an object')
  }
  const summary = rawSummary as RemoteSafeRecord
  const rawBullets = summary['bullets']
  if (!Array.isArray(rawBullets) || !rawBullets.every((b) => typeof b === 'string')) {
    throw new Error('HANDOFF_MALFORMED: summary.bullets must be a string array')
  }
  return {
    sourceSessionId,
    title: requireString(summary, 'title'),
    bullets: rawBullets as string[],
  }
}

// --- handoff.create ----------------------------------------------------------------

/**
 * The `handoff.create` state wire (the frozen `HandoffOperationState`
 * mirror, narrowed by `kind`). The `unknown` arm is the fail-safe for a
 * future kind: it is rendered as a local note, never silently dropped.
 */
export type HandoffCreateStateWire =
  | {
      readonly kind: 'completed'
      readonly replayed: boolean
      readonly teamSessionId: string
      readonly rootSessionId: string
    }
  | {
      readonly kind: 'completed-without-handoff'
      readonly replayed: boolean
      readonly teamSessionId: string
      readonly rootSessionId: string
    }
  | { readonly kind: 'canceled'; readonly replayed: boolean }
  | {
      readonly kind: 'awaiting-decision'
      readonly replayed: boolean
      readonly failureCode: string
      readonly failureMessage: string
      readonly options: readonly HandoffDecisionOption[]
    }
  | {
      readonly kind: 'creation-failed'
      readonly replayed: boolean
      readonly failureCode: string
      readonly failureMessage: string
    }
  | { readonly kind: 'unknown'; readonly raw: RemoteSafeRecord }

function asRecord(value: unknown, label: string): RemoteSafeRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`HANDOFF_MALFORMED: ${label} must be an object`)
  }
  return value as RemoteSafeRecord
}

function requireBool(value: RemoteSafeRecord, field: string): boolean {
  const raw = value[field]
  if (typeof raw !== 'boolean') {
    throw new Error(`HANDOFF_MALFORMED: ${field} must be a boolean`)
  }
  return raw
}

function parseTeamOutcome(
  value: RemoteSafeRecord,
): { teamSessionId: string; rootSessionId: string } {
  const rawTeam = value['team']
  if (typeof rawTeam !== 'object' || rawTeam === null || Array.isArray(rawTeam)) {
    throw new Error('HANDOFF_MALFORMED: team must be an object')
  }
  const team = rawTeam as RemoteSafeRecord
  return {
    teamSessionId: requireString(team, 'teamSessionId'),
    rootSessionId: requireString(team, 'rootSessionId'),
  }
}

function parseFailure(
  value: RemoteSafeRecord,
): { failureCode: string; failureMessage: string } {
  const rawFailure = value['failure']
  if (typeof rawFailure !== 'object' || rawFailure === null || Array.isArray(rawFailure)) {
    throw new Error('HANDOFF_MALFORMED: failure must be an object')
  }
  const failure = rawFailure as RemoteSafeRecord
  return {
    failureCode: requireString(failure, 'code'),
    failureMessage: requireString(failure, 'message'),
  }
}

/**
 * Parse the `handoff.create` success value (`{ state }` → the narrowed
 * `HandoffOperationState` mirror). Unknown `kind` → the fail-safe
 * `unknown` arm (rendered verbatim, never a crash).
 */
export function parseHandoffCreateState(
  value: unknown,
): HandoffCreateStateWire {
  const record = asRecord(value, 'value')
  const rawState = record['state']
  if (typeof rawState !== 'object' || rawState === null || Array.isArray(rawState)) {
    throw new Error('HANDOFF_MALFORMED: state must be an object')
  }
  const state = rawState as RemoteSafeRecord
  const kind = state['kind']
  const replayed = requireBool(state, 'replayed')
  switch (kind) {
    case 'completed': {
      return { kind, replayed, ...parseTeamOutcome(state) }
    }
    case 'completed-without-handoff': {
      return { kind, replayed, ...parseTeamOutcome(state) }
    }
    case 'canceled': {
      return { kind, replayed }
    }
    case 'awaiting-decision': {
      const rawOptions = state['options']
      const options: HandoffDecisionOption[] = []
      if (Array.isArray(rawOptions)) {
        for (const option of rawOptions) {
          if (isHandoffDecisionOption(option)) options.push(option)
        }
      }
      return {
        kind,
        replayed,
        ...parseFailure(state),
        options,
      }
    }
    case 'creation-failed': {
      return { kind, replayed, ...parseFailure(state) }
    }
    default: {
      return { kind: 'unknown', raw: state }
    }
  }
}

// --- the §32.4 triad mapping ---------------------------------------------------------

/**
 * The triad actions available for a create state:
 * - `awaiting-decision` → the host-surfaced options (falling back to the
 *   full frozen triad when the array is absent/empty);
 * - `creation-failed` → RETRY only (the host re-drives creation; there
 *   is no wire decision channel for the frozen-context path);
 * - terminal states (`completed` / `completed-without-handoff` /
 *   `canceled`) and `unknown` → no actions.
 */
export function handoffDecisionActions(
  state: HandoffCreateStateWire,
): readonly HandoffDecisionOption[] {
  switch (state.kind) {
    case 'awaiting-decision': {
      return state.options.length > 0 ? state.options : HANDOFF_DECISION_OPTIONS
    }
    case 'creation-failed':
      return ['retry']
    default:
      return []
  }
}

/**
 * The retry plan for a failing create state (plan §10.5 idempotency
 * rule, mapped per host re-invocation semantics):
 * - `creation-failed` → SAME token (host re-drives creation only,
 *   idempotent under the stable intent token);
 * - `awaiting-decision` → FRESH token (a same-token re-invocation would
 *   only replay the stored failure; a fresh token re-runs the
 *   read → summarize → create pipeline; no team exists under the old
 *   token, so no double-creation risk);
 * - anything else → `null` (no retry).
 */
export interface HandoffRetryPlan {
  readonly sourceSessionId: string
  readonly requestToken: string
  /** True when the retry must mint a fresh request token. */
  readonly freshToken: boolean
}

export function handoffRetryPlan(
  state: HandoffCreateStateWire,
  sourceSessionId: string,
  currentToken: string,
  nextToken: string,
): HandoffRetryPlan | null {
  switch (state.kind) {
    case 'creation-failed':
      return { sourceSessionId, requestToken: currentToken, freshToken: false }
    case 'awaiting-decision':
      return { sourceSessionId, requestToken: nextToken, freshToken: true }
    default:
      return null
  }
}
