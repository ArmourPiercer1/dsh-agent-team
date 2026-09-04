/**
 * P9-T4 (S3-B) — the pure durable-ledger adapter: loaded
 * `RemoteLedgerEntryValue[]` (+ completeness authority) →
 * `TeamUiLedgerModel`, and the combined entry `adaptTeamUi` that
 * satisfies the plan §7.1 purity contract
 * `output = pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])`.
 *
 * Purity / forbidden edges (plan §7.1, gate G3): no backend write, no
 * authoritative lifecycle storage, no session-log scan, no DOM, no
 * TeamDomain import. Payloads are heterogeneous wire records, so every
 * leaf read is FAIL-SAFE (typeof string / integer guards); a row that
 * lacks a leaf it needs is SKIPPED, never patched with an invented
 * value. The raw `payload` is passed through on every row verbatim.
 *
 * Completeness gating (plan §7.4; design lock): `entries` / `controls`
 * / `messages` / `intervals` are always derived from the LOADED entries
 * (the `completeness` marker carries the authority); `progress`
 * (historical work rows) and `pendingControlByInstance` are emitted
 * ONLY for a known-complete ledger — a partial ledger never claims a
 * complete task board and never distributes pending counts.
 *
 * `adaptTeamUi` additionally overlays the §7.3 per-instance pending
 * badges onto the snapshot member rows — and only then: the projection
 * adapter alone always leaves them `null` (unknown).
 *
 * Implementation note: the pairing passes (control decisions, interval
 * closes) run over MUTABLE internal drafts; the exported rows are the
 * readonly public types, produced once at the end. The module itself is
 * pure: inputs are never mutated, every output is freshly built.
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/ledger-adapter
 */

import type {
  ProgressValue,
  TeamProjectionDto,
} from '../../../contracts/src/index.js'
import type {
  RemoteLedgerEntryValue,
  RemoteSafeJsonValue,
} from '../../../remote/src/index.js'
import { adaptTeamProjection } from './projection-adapter.js'
import type { TeamPerspective } from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import type {
  TeamUiActivityIntervalRow,
  TeamUiControlChain,
  TeamUiLedgerModel,
  TeamUiLedgerRow,
  TeamUiMessageRow,
  TeamUiProgressRow,
  TeamUiSnapshot,
} from './team-ui-snapshot.js'

/**
 * CLIENT-LOCAL frozen mirror of the host fact-type → category
 * vocabulary. PROVENANCE (the client may not import the host package —
 * `packages/runtime` is host-side authority):
 * `packages/runtime/src/plugin/projection-source.ts` `FACT_TYPE_CATEGORY`
 * (the 12-fact vNext vocabulary; the host fails closed
 * `LEDGER_CATEGORY_UNKNOWN` on any unmapped fact type, so an unknown
 * `category` here can only ever be display-side, never authority-side).
 * A row whose fact type is absent from this map carries NO `category`
 * (omitted, never guessed).
 */
const FACT_TYPE_CATEGORY: Readonly<Record<string, LedgerCategoryValue>> = {
  'team-work-admitted': 'team',
  'provision-member-instance': 'member',
  'member-lifecycle-changed': 'lifecycle',
  'team-message-delivered': 'message',
  'team-coordination-recorded': 'message',
  'control-request-recorded': 'control',
  'control-decision-recorded': 'control',
  'control-allow-consumed': 'control',
  'activity-progress-recorded': 'progress',
  'activity-interval-opened': 'progress',
  'activity-interval-closed': 'progress',
  'policy-state-transitioned': 'policy',
}

/** The frozen category literals (the contracts `LedgerCategory` closed set). */
type LedgerCategoryValue =
  | 'team'
  | 'member'
  | 'lifecycle'
  | 'message'
  | 'control'
  | 'policy'
  | 'compatibility'
  | 'progress'

/** One wire payload as a plain leaf-readable record. */
type Payload = Readonly<Record<string, RemoteSafeJsonValue>>

/** Mutable internal draft of one control chain (pairing pass). */
interface ControlDraft {
  requestId: string
  requestSequence: number
  targetInstanceId: string
  actionName: string
  requestedAt: string
  pending: boolean
  kind?: string
  toolName?: string
  capabilityDomain?: string
  summary?: string
  decision?: {
    value: string
    sequence: number
    decidedAt: string
    reason?: string
    note?: string
  }
}

/** Mutable internal draft of one activity interval (pairing pass). */
interface IntervalDraft {
  correlation: string
  instanceId: string
  openedAt: string
  openedSequence: number
  isOpen: boolean
  subject?: string
  note?: string
  closedAt?: string
  closedSequence?: number
  closeNote?: string
}

/** Fail-safe string leaf read (`undefined` for any non-string / absent). */
function str(payload: Payload, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

/** Fail-safe integer leaf read (`undefined` for any non-integer / absent). */
function num(payload: Payload, key: string): number | undefined {
  const value = payload[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

/** The closed progress vocabulary check (fail-safe; absent → undefined). */
function progressOf(value: unknown): ProgressValue | undefined {
  return value === 'in-progress' || value === 'completed' || value === 'blocked' ? value : undefined
}

/** One raw entry → the row (skips the entries whose identity leaves are broken). */
function adaptEntry(entry: RemoteLedgerEntryValue): TeamUiLedgerRow | undefined {
  if (!Number.isInteger(entry.sequence)) return undefined
  if (typeof entry.factType !== 'string') return undefined
  const category = FACT_TYPE_CATEGORY[entry.factType]
  return {
    sequence: entry.sequence,
    factType: entry.factType,
    ...(category === undefined ? {} : { category }),
    rootSessionId: entry.rootSessionId,
    operationId: entry.operationId,
    createdAt: entry.createdAt,
    payload: (entry.payload ?? {}) as Payload,
  }
}

/** One `control-request-recorded` fact → the draft (skipped when identity leaves are broken). */
function adaptControlRequestDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): ControlDraft | undefined {
  const requestId = str(payload, 'requestId')
  const targetInstanceId = str(payload, 'targetInstanceId')
  const actionName = str(payload, 'actionName')
  if (requestId === undefined || targetInstanceId === undefined || actionName === undefined) return undefined
  return {
    requestId,
    requestSequence: entry.sequence,
    targetInstanceId,
    actionName,
    requestedAt: entry.createdAt,
    pending: true,
    kind: str(payload, 'kind'),
    toolName: str(payload, 'toolName'),
    capabilityDomain: str(payload, 'capabilityDomain'),
    summary: str(payload, 'summary'),
  }
}

/**
 * Pair one `control-decision-recorded` fact onto its request draft
 * (join key: the frozen `requestId`). An orphan decision (no loaded
 * request fact) becomes a draft only when the writer's own `scope`
 * names the target + action + request sequence — no invented values;
 * otherwise it is skipped.
 */
function adaptControlDecisionDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
  requests: Map<string, ControlDraft>,
  orphans: ControlDraft[],
): void {
  const requestId = str(payload, 'requestId')
  const decision = str(payload, 'decision')
  if (requestId === undefined || decision === undefined) return
  const target = payload['scope']
  const scope: Payload | undefined =
    typeof target === 'object' && target !== null ? (target as Payload) : undefined
  const reason = str(payload, 'reason')
  const note = str(payload, 'note')
  const block = {
    value: decision,
    sequence: entry.sequence,
    decidedAt: entry.createdAt,
    ...(reason === undefined ? {} : { reason }),
    ...(note === undefined ? {} : { note }),
  }
  const request = requests.get(requestId)
  if (request !== undefined) {
    request.pending = false
    request.decision = block
    return
  }
  const targetInstanceId = scope === undefined ? undefined : str(scope, 'targetInstanceId')
  const actionName = scope === undefined ? undefined : str(scope, 'actionName')
  const requestSequence = num(payload, 'requestSequence')
  if (targetInstanceId === undefined || actionName === undefined || requestSequence === undefined) return
  orphans.push({
    requestId,
    requestSequence,
    targetInstanceId,
    actionName,
    requestedAt: entry.createdAt,
    pending: false,
    toolName: scope === undefined ? undefined : str(scope, 'toolName'),
    decision: block,
  })
}

/** One `team-message-delivered` fact → the row (recipient pair only — no invented sender). */
function adaptDeliveredMessage(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): TeamUiMessageRow | undefined {
  const subject = str(payload, 'subject')
  const to = str(payload, 'recipientInstanceId') ?? str(payload, 'deliveredToInstanceId')
  if (subject === undefined || to === undefined) return undefined
  return { sequence: entry.sequence, kind: 'delivered', to, subject, at: entry.createdAt }
}

/** One `team-coordination-recorded` fact → the row (only `send-message` actions are message rows). */
function adaptCoordinationMessage(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): TeamUiMessageRow | undefined {
  if (str(payload, 'action') !== 'send-message') return undefined
  const subject = str(payload, 'subject')
  const to = str(payload, 'targetInstanceId') ?? str(payload, 'recipientInstanceId')
  if (subject === undefined || to === undefined) return undefined
  const from = str(payload, 'caller')
  return {
    sequence: entry.sequence,
    kind: 'coordination',
    ...(from === undefined ? {} : { from }),
    to,
    subject,
    at: entry.createdAt,
  }
}

/** One `activity-interval-opened` fact → the draft (correlation + instance are required). */
function adaptIntervalOpenDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): IntervalDraft | undefined {
  const correlation = str(payload, 'correlation')
  const instanceId = str(payload, 'instanceId')
  if (correlation === undefined || instanceId === undefined) return undefined
  return {
    correlation,
    instanceId,
    openedAt: entry.createdAt,
    openedSequence: entry.sequence,
    isOpen: true,
    subject: str(payload, 'subject'),
    note: str(payload, 'note'),
  }
}

/** Pair one `activity-interval-closed` fact onto its open draft (join key: `correlation`). */
function adaptIntervalCloseDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
  opens: Map<string, IntervalDraft>,
): void {
  const correlation = str(payload, 'correlation')
  if (correlation === undefined) return
  const open = opens.get(correlation)
  if (open === undefined) return // close without a loaded open: no invented interval
  if (open.isOpen === false) return // a second close is an anomaly: the first stands
  open.isOpen = false
  open.closedAt = entry.createdAt
  open.closedSequence = entry.sequence
  const closeNote = str(payload, 'closeNote') ?? str(payload, 'note')
  if (closeNote !== undefined) open.closeNote = closeNote
}

/** One `activity-progress-recorded` fact → the historical work row (complete-ledger only). */
function adaptProgressRow(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): TeamUiProgressRow | undefined {
  const instanceId = str(payload, 'instanceId')
  const subject = str(payload, 'subject')
  const progress = progressOf(payload['progress'])
  if (instanceId === undefined || subject === undefined || progress === undefined) return undefined
  return {
    sequence: entry.sequence,
    instanceId,
    subject,
    progress,
    at: entry.createdAt,
    summary: str(payload, 'summary'),
    lastAction: str(payload, 'lastAction'),
    correlation: str(payload, 'correlation'),
  }
}

/**
 * Adapt the loaded ledger entries to the durable-ledger model (pure;
 * deterministic for one entry set + completeness).
 *
 * @param entries - the store's merged, sequence-ordered loaded entries
 *   (the adapter re-sorts defensively; the store is the order authority).
 * @param complete - the store's completeness verdict
 *   (`total !== null && completeThrough >= total`); the authority for the
 *   `progress` / `pendingControlByInstance` gates.
 */
export function adaptTeamLedger(
  entries: readonly RemoteLedgerEntryValue[],
  complete: boolean,
): TeamUiLedgerModel {
  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence)

  const rows: TeamUiLedgerRow[] = []
  const requests = new Map<string, ControlDraft>()
  const orphans: ControlDraft[] = []
  const messages: TeamUiMessageRow[] = []
  const opens = new Map<string, IntervalDraft>()
  const progressRows: TeamUiProgressRow[] = []

  for (const entry of ordered) {
    const row = adaptEntry(entry)
    if (row !== undefined) rows.push(row)
    const payload: Payload = (entry.payload ?? {}) as Payload
    switch (entry.factType) {
      case 'control-request-recorded': {
        const draft = adaptControlRequestDraft(entry, payload)
        if (draft !== undefined && requests.has(draft.requestId) === false) requests.set(draft.requestId, draft)
        break
      }
      case 'control-decision-recorded':
        adaptControlDecisionDraft(entry, payload, requests, orphans)
        break
      case 'team-message-delivered': {
        const message = adaptDeliveredMessage(entry, payload)
        if (message !== undefined) messages.push(message)
        break
      }
      case 'team-coordination-recorded': {
        const message = adaptCoordinationMessage(entry, payload)
        if (message !== undefined) messages.push(message)
        break
      }
      case 'activity-interval-opened': {
        const draft = adaptIntervalOpenDraft(entry, payload)
        if (draft !== undefined && opens.has(draft.correlation) === false) opens.set(draft.correlation, draft)
        break
      }
      case 'activity-interval-closed':
        adaptIntervalCloseDraft(entry, payload, opens)
        break
      case 'activity-progress-recorded': {
        const rowFact = adaptProgressRow(entry, payload)
        if (rowFact !== undefined) progressRows.push(rowFact)
        break
      }
      default:
        break // rows-only facts (team / member / lifecycle / policy / allow-consumed)
    }
  }

  // The pairing passes are done: drafts become the readonly public rows.
  const controls: TeamUiControlChain[] = [...requests.values(), ...orphans]
    .sort((a, b) => a.requestSequence - b.requestSequence)
    .map(draft => draft)
  const intervals: TeamUiActivityIntervalRow[] = [...opens.values()]
    .sort((a, b) => a.openedSequence - b.openedSequence)
    .map(draft => draft)

  // §7.4 gate: historical work rows + per-instance pending counts only
  // over a KNOWN-COMPLETE ledger; a partial ledger yields neither.
  let progress: readonly TeamUiProgressRow[] = []
  let pendingControlByInstance: Readonly<Record<string, number>> = {}
  if (complete) {
    progress = progressRows
    const byInstance: Record<string, number> = {}
    for (const chain of controls) {
      if (chain.pending === false) continue
      byInstance[chain.targetInstanceId] = (byInstance[chain.targetInstanceId] ?? 0) + 1
    }
    pendingControlByInstance = byInstance
  }

  return {
    completeness: complete ? 'complete' : 'partial',
    entries: rows,
    controls,
    messages,
    intervals,
    progress,
    pendingControlByInstance,
  }
}

/** The combined T4 output: the snapshot (+ §7.3 badges when complete) and the ledger model. */
export interface TeamUiState {
  readonly snapshot: TeamUiSnapshot
  readonly ledger: TeamUiLedgerModel
}

/**
 * The plan §7.1 combined pure adapter:
 * `pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])` (+ the
 * viewer perspective and the store's completeness verdict).
 *
 * The §7.3 overlay: ONLY when the ledger is known complete are the
 * snapshot member rows' `pendingControlCount` badges filled from
 * `pendingControlByInstance` (absence of a pending request is a known
 * zero, not unknown); under `partial` they stay `null`.
 */
export function adaptTeamUi(
  projection: TeamProjectionDto,
  perspective: TeamPerspective,
  entries: readonly RemoteLedgerEntryValue[],
  complete: boolean,
): TeamUiState {
  const base = adaptTeamProjection(projection, perspective)
  const ledger = adaptTeamLedger(entries, complete)
  if (complete === false) return { snapshot: base, ledger }
  const members = base.members.map(member => ({
    ...member,
    pendingControlCount: ledger.pendingControlByInstance[member.instanceId] ?? 0,
  }))
  return { snapshot: { ...base, members }, ledger }
}

/**
 * P9-T5 (S3-C) — lift one `TeamLedgerState` (the T4 store's published
 * snapshot) into the UI ledger model: the loaded entries are replayed
 * through the same pure `adaptTeamLedger`, and completeness is the
 * store's own verdict rule — known complete iff the last accepted `total`
 * is non-null and the catch-up frontier has reached it. `undefined` (no
 * binding yet) yields the empty partial model: a partial ledger clearly
 * represented (gate G3), never a claim over an unknown ledger.
 *
 * Type-only import of the store state (no runtime cycle: the store module
 * imports nothing from `model/`).
 * @param state - the store's published snapshot, or `undefined` for no binding.
 * @returns the UI ledger model over the loaded entries.
 */
export function ledgerModelFromStoreState(
  state: TeamLedgerState | undefined,
): TeamUiLedgerModel {
  if (state === undefined) return adaptTeamLedger([], false)
  const entries: RemoteLedgerEntryValue[] = []
  for (const sequence of state.orderedSequences) {
    const entry = state.entriesBySequence.get(sequence)
    if (entry !== undefined) entries.push(entry)
  }
  const complete = state.total !== null && state.completeThrough >= state.total
  return adaptTeamLedger(entries, complete)
}
