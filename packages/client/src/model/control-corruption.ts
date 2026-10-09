/**
 * A4-PR7 W1 — the corrupt-control-leg visibility model (warning-first,
 * RULING 5-B): the client-side parse of the v9-only
 * `team.listCorruptControlLegs` response (`{ corruption }`) into the
 * Team-page warning-bar view model.
 *
 * WARNING-FIRST, VISIBILITY ONLY: this module READS the server's
 * corrupt-leg disclosure and shapes it for display. It derives NO
 * execution semantics, NO authority, NO legality — the execution
 * plane is untouched (RULING 5-B). The strict ledger reader is NOT
 * re-implemented here (严禁在客户端复刻严格读者): the server
 * (`runtime/control`) is the SOLE authority on which records are
 * corrupt; the client never re-scans, re-sorts, or re-judges a leg —
 * rows arrive in the service's own order and stay in it.
 *
 * TEAM-LEVEL WORDING LAW: a corrupt record is a ledger fact keyed by
 * its Ledger `sequence`. The `disclosesMember` cell is the service's
 * own disclosure flag; when it is false the row is UNATTRIBUTABLE and
 * the UI must never claim a Member identity for it. This model carries
 * the flag verbatim and adds nothing.
 *
 * FAIL-SAFE: a malformed payload parses to `null` (no bar) and
 * `corruptCount === 0` yields `visible: false` (no bar) — the bar is
 * an ADDITIVE warning; a read failure never blocks or alters the
 * ledger surface itself.
 *
 * A4-PR7 W4 (findings F1 + F2) adds the READ-STATE layer this module also
 * owns: the state is bound to the `teamSessionId` it was read for
 * (`corruptionStateForKey` / `corruptionReadSucceeded` / `corruptionReadFailed`
 * / `corruptionStateCleared`) and `planControlCorruptionRender` is the single
 * place that decides between the disclosure bar and the NEUTRAL
 * "integrity check unavailable" notice. The notice is still visibility-only:
 * it reports the availability of this read, never a blocked or altered
 * action. Pure module: no React, no I/O, erasable TS.
 * @module @dsh-agent-team/client/model/control-corruption
 */

/** One corrupt-leg row as the warning bar consumes it (closed cells). */
export interface CorruptControlLegRow {
  /** The durable Ledger sequence of the corrupt record (service order). */
  readonly sequence: number
  /**
   * The service's own disclosure flag (`disclosesMember`). MEASURED truth
   * (the disclosure predicate in `runtime/control/service.ts`: the four
   * scalar operation members at :1210-1215, a parseable `subject` alone at
   * :1218, a non-empty legacy `targetInstanceId` alone at :1221): `true`
   * means the row disclosed COMPARABLE ATTRIBUTION INFORMATION — an
   * identity (`subject` / legacy `targetInstanceId`) OR an operation
   * member (one of the four scalars). A row naming ONLY an operation (say
   * `actionName`, no identity at all) is `true` too, so this flag is
   * explicitly NOT a conclusion that "that member caused the corruption";
   * the warning wording must not claim one. `false` = unattributable —
   * Team-level wording only, never a name.
   */
  readonly disclosesMember: boolean
  /** The recorded identity echo when the row carries one (`requestId`). */
  readonly requestId: string | null
  /** The recorded identity echo when the row carries one (`approvalCaseId`). */
  readonly approvalCaseId: string | null
}

/** The warning-bar view model (one per Team session). */
export interface ControlCorruptionView {
  /** EXACT corrupt-record count (the server counts; the client never does). */
  readonly corruptCount: number
  /** Whether the closed `legs` list below is capped/truncated. */
  readonly truncated: boolean
  /** The listed rows, in the service's own order (never re-sorted). */
  readonly legs: readonly CorruptControlLegRow[]
}

/**
 * The CLOSED v9 read-params builder (the intervention-params precedent):
 * `team.listCorruptControlLegs` carries exactly `{ teamSessionId }` —
 * no caller, no authority claim, no page/limit smuggle.
 * @param teamSessionId - the resolved Team session id.
 * @returns the frozen closed param object.
 */
export function corruptControlLegsParams(teamSessionId: string): { teamSessionId: string } {
  return { teamSessionId }
}

/**
 * Parse the `team.listCorruptControlLegs` success `value.data`
 * (`{ corruption: { teamSessionId, corruptCount, truncated, legs } }`)
 * into the view model. Defensive client-boundary parse: EVERY leaf read
 * is fail-safe; any malformed shape (missing/wrong-typed cell, a row
 * missing its sequence) returns `null` — the bar hides, nothing throws,
 * nothing is patched with an invented value.
 * @param data - the success `value.data` payload.
 * @returns the view model, or `null` when the payload is malformed.
 */
export function parseControlCorruption(data: unknown): ControlCorruptionView | null {
  if (typeof data !== 'object' || data === null) return null
  const corruption = (data as Record<string, unknown>)['corruption']
  if (typeof corruption !== 'object' || corruption === null) return null
  const cell = corruption as Record<string, unknown>
  if (typeof cell['teamSessionId'] !== 'string') return null
  const corruptCount = cell['corruptCount']
  if (typeof corruptCount !== 'number' || !Number.isSafeInteger(corruptCount) || corruptCount < 0) {
    return null
  }
  if (typeof cell['truncated'] !== 'boolean') return null
  const rawLegs = cell['legs']
  if (!Array.isArray(rawLegs)) return null
  const legs: CorruptControlLegRow[] = []
  for (const raw of rawLegs) {
    if (typeof raw !== 'object' || raw === null) return null
    const row = raw as Record<string, unknown>
    if (typeof row['sequence'] !== 'number' || !Number.isSafeInteger(row['sequence']) || row['sequence'] < 1) {
      return null
    }
    if (typeof row['disclosesMember'] !== 'boolean') return null
    const requestId = row['requestId']
    const approvalCaseId = row['approvalCaseId']
    if (requestId !== undefined && (typeof requestId !== 'string' || requestId === '')) return null
    if (approvalCaseId !== undefined && (typeof approvalCaseId !== 'string' || approvalCaseId === '')) {
      return null
    }
    legs.push({
      sequence: row['sequence'],
      disclosesMember: row['disclosesMember'],
      requestId: requestId === undefined ? null : (requestId as string),
      approvalCaseId: approvalCaseId === undefined ? null : (approvalCaseId as string),
    })
  }
  return { corruptCount, truncated: cell['truncated'], legs }
}

/**
 * Whether a parsed view justifies rendering the warning bar: a
 * well-formed read that reports zero corrupt records shows no bar.
 * @param view - the parsed view model (`null` = malformed read).
 * @returns `true` only for a well-formed, non-zero corruption.
 */
export function controlCorruptionVisible(view: ControlCorruptionView | null): boolean {
  return view !== null && view.corruptCount > 0
}

/** The closed read-failure marker of one integrity read (W4 finding F1). */
export interface ControlCorruptionReadError {
  /** The typed code (a remote code, `malformed-response`, or `native-error`). */
  readonly code: string
  /** The wire/exception message, kept verbatim for diagnostics. */
  readonly message: string
}

/**
 * A4-PR7 W4 (finding F2) — the read state, BOUND to the Team it belongs to.
 *
 * W1 shipped `{ view, error }` with no owner: the value said nothing about
 * WHICH Team session it described, so a switch to another Team could leave
 * the previous Team's disclosure on screen (and a failed read for the new
 * Team explicitly PRESERVED it). `key` is the `teamSessionId` the `view` /
 * `error` below were read for; `null` means "no resolved Team, nothing read"
 * (the legacy surface: no v9 face, zero state, or no team frame yet).
 *
 * The key is an ATTRIBUTION field, not a cache: nothing is retained across
 * a key change, and no read result may write a state row it does not own.
 * The `corruptionEpoch` guard in the view stays the concurrency gate (last
 * write wins among interleaved reads of the SAME key); these transitions add
 * only the ownership gate on top of it.
 */
export interface ControlCorruptionReadState {
  /** The `teamSessionId` these cells describe (`null` = nothing read). */
  readonly key: string | null
  /** The last good disclosure for `key` (`null` = none this round). */
  readonly view: ControlCorruptionView | null
  /** The last read failure for `key` (`null` = the last attempt succeeded). */
  readonly error: ControlCorruptionReadError | null
}

/** The empty state: no resolved Team, nothing read, nothing to show. */
export const EMPTY_CONTROL_CORRUPTION_READ_STATE: ControlCorruptionReadState = {
  key: null,
  view: null,
  error: null,
}

/**
 * Event: the resolved Team key CHANGED (a session switch, or a switch to /
 * from the zero state). The previous round's result is dropped IMMEDIATELY —
 * before the new read answers — because a disclosure is a fact about one
 * Team and is meaningless for another.
 * @param prev - the current state.
 * @param key - the newly resolved Team key (`null` = none).
 * @returns the same object when the key did not move (no re-render), else a
 * freshly invalidated state owned by `key`.
 */
export function corruptionStateForKey(
  prev: ControlCorruptionReadState,
  key: string | null,
): ControlCorruptionReadState {
  if (prev.key === key) return prev
  return { key, view: null, error: null }
}

/**
 * Event: there is nothing to read (no v9 face, or no resolved Team) — the
 * legacy surface. Drops any inherited result and keeps identity when the
 * state is already empty, exactly as W1's clear branch did.
 * @param prev - the current state.
 * @returns the empty state, or `prev` when it already is one.
 */
export function corruptionStateCleared(prev: ControlCorruptionReadState): ControlCorruptionReadState {
  if (prev.key === null && prev.view === null && prev.error === null) return prev
  return EMPTY_CONTROL_CORRUPTION_READ_STATE
}

/**
 * Event: the read for `key` ANSWERED with a well-formed disclosure. A result
 * that arrives after a Team switch is DISCARDED (it belongs to a Team no
 * longer on screen) — the ownership gate, independent of the epoch gate.
 * @param prev - the current state.
 * @param key - the Team the read was issued for.
 * @param view - the parsed disclosure.
 * @returns the owned, updated state; `prev` unchanged when `key` is stale.
 */
export function corruptionReadSucceeded(
  prev: ControlCorruptionReadState,
  key: string,
  view: ControlCorruptionView,
): ControlCorruptionReadState {
  if (prev.key !== key) return prev
  return { key, view, error: null }
}

/**
 * Event: the read for `key` FAILED (typed refusal, malformed payload, or
 * transport loss). Two W1 behaviours are preserved verbatim: the state is
 * kept for the SAME key only, and a same-key failure KEEPS the last good
 * `view` (a durable disclosure does not evaporate because a re-read failed —
 * the failure replaces the notice lane, not the fact).
 * @param prev - the current state.
 * @param key - the Team the read was issued for.
 * @param error - the failure marker to record.
 * @returns the owned, updated state; `prev` unchanged when `key` is stale.
 */
export function corruptionReadFailed(
  prev: ControlCorruptionReadState,
  key: string,
  error: ControlCorruptionReadError,
): ControlCorruptionReadState {
  if (prev.key !== key) return prev
  return { key, view: prev.view, error }
}

/** What the Team body renders for the CURRENT Team (mutually exclusive). */
export interface ControlCorruptionRenderPlan {
  /** The disclosure to show as the fixed warning bar (`null` = no bar). */
  readonly bar: ControlCorruptionView | null
  /** The failure behind the NEUTRAL "check unavailable" notice (`null` = none). */
  readonly unavailableNotice: ControlCorruptionReadError | null
}

/**
 * The single render decision (W4 findings F1 + F2): a state row contributes
 * NOTHING unless it is owned by the Team currently on screen, and the two
 * surfaces are mutually exclusive — a Team with a visible disclosure shows
 * the bar; a Team whose latest read failed and which has no bar to show gets
 * the neutral notice, so "no corrupt records" (neither) stays distinguishable
 * from "the check never succeeded" (notice).
 * @param state - the read state.
 * @param currentKey - the currently resolved Team key (`null` = none).
 * @returns the bar and/or notice to render (never both).
 */
export function planControlCorruptionRender(
  state: ControlCorruptionReadState,
  currentKey: string | null,
): ControlCorruptionRenderPlan {
  if (currentKey === null || state.key !== currentKey) return { bar: null, unavailableNotice: null }
  const bar = controlCorruptionVisible(state.view) ? state.view : null
  if (bar !== null) return { bar, unavailableNotice: null }
  return { bar: null, unavailableNotice: state.error }
}

