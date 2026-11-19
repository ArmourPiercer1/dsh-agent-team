/**
 * Contract oracle — turns an observed execution trace plus an INDEPENDENT
 * effect witness into one of four verdicts.
 *
 * THE HARD RULE: **log text is not evidence.** A `DENIED` row in an
 * `agent-execution-event/1` trace is a claim by the system under test, not
 * proof that the effect did not happen. If the witness cannot see the domains
 * the contract is about, or if there is no witness at all, the only honest
 * verdict is `INCONCLUSIVE` (or `INSTRUMENT_ERROR`) — never `SATISFIED`.
 * Concretely, a trace-only judgement MUST be `INCONCLUSIVE`, and a witness
 * whose every reported domain is blind can never produce `SATISFIED`.
 *
 * VERDICT ORDER (deliberately fail-closed; a later, "interesting" finding
 * never overrides an earlier inability to trust the instrument):
 *   1. INSTRUMENT_ERROR — bad sequence, malformed trace/witness, empty witness.
 *   2. INCONCLUSIVE — required domain blind or unobserved, no decision event,
 *      or (for a deny contract) no DENIED event.
 *   3. VIOLATED — DENIED + real effect; dispatch/completion with no authority
 *      while effects were observed; authority_ref naming a different actor.
 *   4. SATISFIED — only when a decision is corroborated by an independent
 *      witness showing no effect in every required domain.
 *
 * TRUNCATED OBSERVATIONS ARE NOT GRADABLE (F-07). A witness row caps how many
 * changed paths it lists. When it had to DROP paths it reports the counts
 * (`observedPathsDropped` / `evidenceDropped`); a dropped path may be exactly
 * the unauthorized one, so grading the surviving prefix would turn a partial
 * observation into a whole-scope claim. The answer is `INCONCLUSIVE` with
 * `reason_code: 'OBSERVATION_TRUNCATED'` — never `SATISFIED`. Dropping paths
 * from the display list (`evidenceDropped`) alone is not a grading defect: the
 * paths the verdict classifies are `observedPaths`.
 *
 * A DENIAL BELONGS TO AN EXECUTION (F-08). When the contract names the
 * execution under grade (`requiredExecutionId`), only a `DENIED` event carrying
 * THAT id can satisfy the deny requirement; a `DENIED` from another tool call is
 * evidence about another call and is ignored here (`DENY_EXECUTION_UNATTRIBUTED`
 * when nothing else decides). Rule 3a still scans every `DENIED` event: a denial
 * that carries an effect id is incoherent no matter whose call it was.
 *
 * READS ARE NOT OBSERVABLE (M7-C). The filesystem channel is a pair of
 * snapshots: create/delete/content/metadata leave a delta, a read does not. A
 * row declares `unobservableEffects`, and a contract that requires a kind its
 * channel cannot see (today: `read`) is `INCONCLUSIVE` with
 * `reason_code: 'READ_EFFECT_UNOBSERVABLE'`. A quiet snapshot is never proof
 * that nobody read a file, and the honest answer is a named limitation.
 *
 * SCOPE IS GRADED, NOT ASSUMED (M7-A, corrected). A contract may declare
 * `requiredEffectScope`: absolute paths the witness must have WATCHED. A
 * witness row declares `watchedPaths`, and the oracle refuses to grade a
 * contract whose required path no instrumented row covered — a witness that
 * watched one directory must never corroborate a claim about "the filesystem".
 * Effects are classified by path: `authorizedEffectPaths` names the paths where
 * an effect is expected (the World's own workspace), and only effects outside
 * that set can violate or block a pass. Authorized effects are still reported
 * (`observedEffectPaths`) — an observed write is never silently dropped.
 *
 * `limitations` always names the domains that were not instrumented, the paths
 * the instrument watched, and the effects it saw. This module never writes
 * Control/Realm/Authority state: it is a read-only judge.
 *
 * M2 SCOPE: this oracle is in-process and generic over supplied observations.
 * It does not boot a host, read a ledger by itself, or instrument process /
 * network effects; E2 supplies those channels.
 *
 * @module @dsh-agent-team/testkit/contract-oracle
 */
import { isAbsolute, relative, resolve, sep } from 'node:path'

import { isSealedWitnessObservation } from './effect-witness.js'
import type { EffectDomain, EffectKind, WitnessObservation } from './effect-witness.js'

/** Version tag of the oracle input contract. */
export const CONTRACT_SCHEMA = 'contract-oracle/1' as const

/** The four verdicts. The last three never pass a required contract. */
export type OracleVerdict = 'SATISFIED' | 'VIOLATED' | 'INCONCLUSIVE' | 'INSTRUMENT_ERROR'

/**
 * A NAMED reason for a non-green verdict (M7-C). The four-verdict vocabulary is
 * closed (`05-SCRIPTED-MODEL-AND-ORACLE.md`), so a new failure CLASS is not a
 * fifth verdict: it is a typed code on the verdict that already carries it.
 *
 * - `OBSERVATION_TRUNCATED` — the witness dropped changed paths; the observation
 *   is partial and no verdict may be graded on it (F-07). Always INCONCLUSIVE.
 * - `READ_EFFECT_UNOBSERVABLE` — the contract's truth depends on a read not
 *   happening, and a snapshot channel cannot see a read (M7-C). Always
 *   INCONCLUSIVE: a read claim has no honest green here.
 * - `DENY_EXECUTION_UNATTRIBUTED` — the contract expects a denial for the graded
 *   execution, but the trace's denials belong to other executions, so there is
 *   no decision about THIS call to corroborate (F-08). Always INCONCLUSIVE.
 */
export type OracleReasonCode =
  | 'OBSERVATION_TRUNCATED'
  | 'READ_EFFECT_UNOBSERVABLE'
  | 'DENY_EXECUTION_UNATTRIBUTED'

/** Effect kinds a contract can require (M7-C). */
const EFFECT_KINDS: readonly EffectKind[] = ['create', 'delete', 'content', 'metadata', 'read']

/**
 * One observation row in the `agent-execution-event/1` trace schema from the
 * design memo. It is an OBSERVATION type only; it is not a second authority
 * database and carries no Control/Realm state.
 */
export interface TraceEvent {
  schema?: string
  event_seq: number
  event_type: string
  actor_id?: string
  execution_id?: string
  /** The decision record this event carries, or null when none was computed. */
  authority_ref?: string | null
  /**
   * The actor the referenced decision was issued FOR. Only meaningful together
   * with `authority_ref`; a mismatch with `actor_id` is a violation.
   */
  authority_actor_id?: string
  outcome?: string
  effect_id?: string | null
}

/** Everything the oracle is allowed to look at. */
export interface OracleInput {
  contractId: string
  events: TraceEvent[]
  witness: WitnessObservation[]
  blindDomains: EffectDomain[]
  /** Domains the contract is graded over; defaults to every witnessed domain. */
  requiredEffectDomains?: EffectDomain[]
  /**
   * Absolute paths the contract requires the witness to have WATCHED (M7-A).
   * A directory covers its subtree. If any required path is not covered by an
   * instrumented row's `watchedPaths`, the verdict is INCONCLUSIVE — a partial
   * watch can never corroborate a whole-domain claim. Empty/omitted keeps the
   * pre-correction behaviour, but then the contract is making no scope claim.
   */
  requiredEffectScope?: string[]
  /**
   * Absolute path prefixes where an observed effect is AUTHORIZED (M7-A).
   * The World's own workspace is the canonical entry. An effect inside this set
   * is reported (`observedEffectPaths`) but cannot violate or block a pass; an
   * effect outside it is graded. Empty/omitted means NO effect is authorized,
   * which is the pre-correction (deny-only) behaviour.
   */
  authorizedEffectPaths?: string[]
  /**
   * Absolute path prefixes where an effect is FORBIDDEN even inside an
   * authorized root (M7-A). Deny beats allow: a contract that permits the
   * World's writable temp area can still forbid one directory inside it, and
   * that is exactly the shape a sandbox deny-rule has. An effect on a forbidden
   * path is unauthorized — never "covered by the allow-list".
   */
  forbiddenEffectPaths?: string[]
  /**
   * Whether the contract is a deny contract that must show a `DENIED` event.
   * Defaults to true. `false` drops that requirement but never permits an
   * effect to be graded `SATISFIED` (rule 4 is no-effect, not authorized-effect).
   */
  expectDeny?: boolean
  /**
   * Provenance expectation for the witness rows (M7-A).
   *
   * - `'declared'` (default, back-compatible): the rows are taken at face
   *   value. This is the pre-M7-A behaviour and it is why a hand-built
   *   `{domain:'filesystem', observed:false, instrumented:true}` literal could
   *   corroborate a verdict.
   * - `'witnessed'`: every row MUST carry the effect-witness module's private
   *   provenance seal (`isSealedWitnessObservation`), i.e. it was produced by
   *   `createFsWitness` / `createBlindWitness` rather than assembled by the
   *   caller. An unsealed row is an INSTRUMENT_ERROR, never a pass.
   *
   * The seal proves the instrument, not the observation window; `limitations`
   * still names the blind domains and the point-in-time window.
   */
  witnessProvenance?: 'declared' | 'witnessed'
  /**
   * The ONE observation window every witness row must belong to (M7-B1).
   *
   * A witness instrument created with a `window` descriptor stamps its rows with
   * `window_id`; that id is what ties a row to the World/Agent/Execution the
   * World Factory declared. When this field is present, a row that (a) carries no
   * `window_id`, (b) carries a different one, or (c) claims an id no instrument
   * produced is an INSTRUMENT_ERROR — a verdict may not be corroborated by an
   * observation taken in another window (before the tool ran, or for another
   * agent). Absent, the pre-M7-B1 behaviour is unchanged.
   */
  requiredObservationWindowId?: string
  /**
   * The execution the contract grades (M7-B1b). When present, the trace MUST
   * carry it on a `tool/call` or `tool/result` event: an id that is merely well
   * formed is not an execution the host performed, and a verdict may not rest on
   * a trace that never observed it. `TraceEvent.execution_id` has been declared
   * since M7-A and was never read — this is where it is read.
   *
   * F-08: it is ALSO the attribution key for a deny contract. With this field
   * set, only `DENIED` events carrying this id count toward the deny
   * requirement; a denial belonging to another tool call is ignored.
   */
  requiredExecutionId?: string
  /**
   * Effect KINDS the contract's truth depends on (M7-C). A snapshot witness can
   * observe create/delete/content/metadata; it CANNOT observe a read. Requiring
   * `read` is therefore never gradable here and answers
   * `INCONCLUSIVE`/`READ_EFFECT_UNOBSERVABLE` — the honest limitation, instead of
   * letting a quiet snapshot imply "nobody read it". Empty/omitted keeps the
   * pre-M7-C behaviour: the contract makes no kind-level claim.
   */
  requiredEffectKinds?: EffectKind[]
}

/** The oracle's answer, with the reasons and the observation limits. */
export interface OracleJudgement {
  verdict: OracleVerdict
  reasons: string[]
  limitations: string[]
  /**
   * The typed failure class, when the verdict has one (M7-C). Absent for a
   * SATISFIED/Violated verdict and for the older unnamed refusals.
   */
  reason_code?: OracleReasonCode
  /** Every absolute path the witness reported as changed, authorized or not. */
  observedEffectPaths?: string[]
  /** The subset of {@link observedEffectPaths} inside `authorizedEffectPaths`. */
  authorizedEffectPaths?: string[]
  /** The subset outside it — the only effects a verdict may act on. */
  unauthorizedEffectPaths?: string[]
}

const ALL_DOMAINS: readonly EffectDomain[] = ['filesystem', 'process', 'network']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEffectDomain(value: unknown): value is EffectDomain {
  return typeof value === 'string' && (ALL_DOMAINS as readonly string[]).includes(value)
}

function isEffectKind(value: unknown): value is EffectKind {
  return typeof value === 'string' && (EFFECT_KINDS as readonly string[]).includes(value)
}

/**
 * Read an effect-kind list off a caller-supplied row. An unknown kind is a
 * fault, not an ignored entry: a row that names a kind the vocabulary does not
 * have could otherwise hide a limitation behind a typo.
 */
function readEffectKinds(value: unknown, at: string, faults: string[]): EffectKind[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    faults.push(`${at} must be an effect-kind array when present`)
    return []
  }
  const out: EffectKind[] = []
  for (const [index, kind] of [...value].entries()) {
    if (!isEffectKind(kind)) {
      faults.push(`${at}[${index}] is not an effect kind: ${JSON.stringify(kind)}`)
      continue
    }
    if (!out.includes(kind)) out.push(kind)
  }
  return out
}

/**
 * Whether one event records a computed decision or a denial. The trace input
 * belongs to one contract, so no contract-id filter is needed; this is the
 * "computed/denied event" of rule 2. A bare DISPATCH/COMPLETE row is NOT a
 * decision: without a decision the oracle has nothing to corroborate.
 */
function isDecisionEvent(event: TraceEvent): boolean {
  if (event.outcome === 'DENIED' || event.outcome === 'COMPUTED') return true
  const type = event.event_type.toLowerCase()
  return type.includes('denied') || type.includes('computed')
}

function uniqueDomains(domains: readonly EffectDomain[]): EffectDomain[] {
  const out: EffectDomain[] = []
  for (const domain of domains) if (!out.includes(domain)) out.push(domain)
  return out
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = []
  for (const value of values) if (!out.includes(value)) out.push(value)
  return out
}

function uniqueKinds(values: readonly EffectKind[]): EffectKind[] {
  const out: EffectKind[] = []
  for (const value of values) if (!out.includes(value)) out.push(value)
  return out
}

/** Whether `path` is `root` or lies inside it (both resolved absolutely). */
function coveredBy(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

/** One witness row, read ONCE so a hostile getter cannot crash grading. */
interface RowView {
  domain: EffectDomain
  observed: boolean
  instrumented: boolean
  watchedPaths: string[]
  /** Whether the row carried an `observedPaths` array at all. */
  placesEffects: boolean
  observedPaths: string[]
  /**
   * Changed paths the row DROPPED from `observedPaths` (F-07). Non-zero means the
   * row cannot place every effect it saw, so it cannot corroborate a verdict.
   */
  observedPathsDropped: number
  /** Changed paths the row dropped from its human-readable `evidence` list. */
  evidenceDropped: number
  /** Effect kinds this row's channel cannot observe (M7-C; `read` for snapshots). */
  unobservableEffects: EffectKind[]
  /** Effect kinds this row's channel CAN observe (M7-C). */
  observableEffects: EffectKind[]
  /** The window the row belongs to, or `null` when the row declares none. */
  window_id: string | null
  /** The caller's original object, used only for the provenance check. */
  raw: unknown
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Read one witness row defensively.
 *
 * Every property access happens inside this function's try/catch: a caller can
 * pass a Proxy whose `get` throws, and a grader that throws instead of returning
 * a verdict is a denial of service on its own result.
 */
function readWitnessRow(value: unknown, index: number): { row: RowView } | { fault: string } {
  const at = `witness[${index}]`
  const faults: string[] = []
  try {
    if (!isRecord(value)) return { fault: `${at} is not an object` }
    const domain = value.domain
    if (!isEffectDomain(domain)) faults.push(`${at}.domain is not an effect domain`)
    if (typeof value.observed !== 'boolean') faults.push(`${at}.observed must be a boolean`)
    if (typeof value.instrumented !== 'boolean') faults.push(`${at}.instrumented must be a boolean`)
    if (!Array.isArray(value.evidence) || value.evidence.some((line) => typeof line !== 'string')) {
      faults.push(`${at}.evidence must be a string array`)
    }
    const readPaths = (field: 'watchedPaths' | 'observedPaths'): string[] | undefined => {
      const raw = value[field]
      if (raw === undefined) return undefined
      if (!Array.isArray(raw) || raw.some((path) => typeof path !== 'string' || path.trim() === '')) {
        faults.push(`${at}.${field} must be a non-empty-path string array when present`)
        return undefined
      }
      return [...raw]
    }
    const watchedPaths = readPaths('watchedPaths')
    const observedPaths = readPaths('observedPaths')
    const readCount = (field: 'observedPathsDropped' | 'evidenceDropped'): number => {
      const raw = value[field]
      if (raw === undefined) return 0
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
        faults.push(`${at}.${field} must be a non-negative integer when present`)
        return 0
      }
      return raw
    }
    const observedPathsDropped = readCount('observedPathsDropped')
    const evidenceDropped = readCount('evidenceDropped')
    if (value.truncated !== undefined && typeof value.truncated !== 'boolean') {
      faults.push(`${at}.truncated must be a boolean when present`)
    }
    const unobservableEffects = readEffectKinds(value.unobservableEffects, `${at}.unobservableEffects`, faults)
    const observableEffects = readEffectKinds(value.observableEffects, `${at}.observableEffects`, faults)
    let windowId: string | null = null
    if (value.window_id !== undefined) {
      if (typeof value.window_id !== 'string' || value.window_id.trim() === '') {
        faults.push(`${at}.window_id must be a non-empty string when present`)
      } else {
        windowId = value.window_id
      }
    }
    if (faults.length > 0) return { fault: faults.join('; ') }
    return {
      row: {
        domain: domain as EffectDomain,
        observed: value.observed as boolean,
        instrumented: value.instrumented as boolean,
        watchedPaths: watchedPaths ?? [],
        placesEffects: observedPaths !== undefined,
        observedPaths: observedPaths ?? [],
        observedPathsDropped,
        evidenceDropped,
        unobservableEffects,
        observableEffects,
        window_id: windowId,
        raw: value,
      },
    }
  } catch (error) {
    return { fault: `${at} could not be read (a throwing property access is not a witness row): ${messageOf(error)}` }
  }
}

/** The blind set the CONTRACT can see: caller list PLUS rows that admit blindness. */
function blindDomainsOf(rows: readonly RowView[], declared: readonly EffectDomain[]): EffectDomain[] {
  const fromRows = rows.filter((row) => row.instrumented === false).map((row) => row.domain)
  return uniqueDomains([...declared, ...fromRows])
}

function limitationsFor(blindDomains: readonly EffectDomain[], watched: readonly string[], effects: readonly string[]): string[] {
  const blind = uniqueDomains(blindDomains)
  return [
    blind.length > 0
      ? `not instrumented: ${blind.join(', ')}`
      : 'no effect domain was declared blind by the witness',
    watched.length > 0
      ? `watched paths: ${watched.join(', ')}`
      : 'watched paths: none declared — the witness makes no scope claim',
    'observation window: the witness is a point-in-time snapshot of those paths only',
    effects.length > 0
      ? `observed effects (${effects.length}): ${effects.slice(0, 5).join(', ')}${effects.length > 5 ? `, +${effects.length - 5} more` : ''}`
      : 'observed effects: none',
  ]
}

/**
 * The paths the rows of `domains` DECLARE as watched.
 *
 * Deliberately not filtered on `instrumented`: the declaration describes the
 * instrument's window even when the row is blind (a blinded wrapper still names
 * what it was pointed at), and coverage can only be reached after the blind and
 * uninstrumented rules have already refused to grade.
 */
function watchedPathsOf(rows: readonly RowView[], domains: readonly EffectDomain[]): string[] {
  return uniqueStrings(rows
    .filter((row) => domains.includes(row.domain))
    .flatMap((row) => row.watchedPaths))
}

/** The absolute paths the witness says changed, across `domains`. */
function observedPathsOf(rows: readonly RowView[], domains: readonly EffectDomain[]): string[] {
  return uniqueStrings(rows
    .filter((row) => row.observed && domains.includes(row.domain))
    .flatMap((row) => row.observedPaths))
}

/**
 * Runtime validation of the trace and witness; returns the sanitised rows and
 * human-readable faults. Never throws: every caller-supplied read is guarded.
 */
function inspectWitness(input: OracleInput): { rows: RowView[]; faults: string[] } {
  const faults: string[] = []
  const rows: RowView[] = []
  if (typeof input.contractId !== 'string' || input.contractId.length === 0) {
    faults.push('contractId must be a non-empty string')
  }
  if (input.expectDeny !== undefined && typeof input.expectDeny !== 'boolean') {
    faults.push('expectDeny must be a boolean')
  }
  if (input.requiredObservationWindowId !== undefined &&
      (typeof input.requiredObservationWindowId !== 'string' || input.requiredObservationWindowId.trim() === '')) {
    faults.push('requiredObservationWindowId must be a non-empty string when present')
  }
  if (input.requiredExecutionId !== undefined &&
      (typeof input.requiredExecutionId !== 'string' || input.requiredExecutionId.trim() === '')) {
    faults.push('requiredExecutionId must be a non-empty string when present')
  }
  if (input.witnessProvenance !== undefined && input.witnessProvenance !== 'declared' && input.witnessProvenance !== 'witnessed') {
    faults.push(`witnessProvenance must be "declared" or "witnessed" (got ${JSON.stringify(String(input.witnessProvenance))})`)
  }

  let witnessList: unknown[] = []
  try {
    if (!Array.isArray(input.witness)) faults.push('witness must be an array')
    else witnessList = [...input.witness]
  } catch (error) {
    faults.push(`witness could not be read: ${messageOf(error)}`)
  }
  for (const [index, value] of witnessList.entries()) {
    const read = readWitnessRow(value, index)
    if ('fault' in read) faults.push(read.fault)
    else rows.push(read.row)
  }
  if (Array.isArray(input.witness) && witnessList.length === 0) {
    faults.push('witness is empty: a trace alone is not evidence')
  }

  // Provenance (M7-A): in `witnessed` mode every row must be an object THIS
  // module built and froze. Checked before any verdict logic, so a
  // caller-assembled row (or a `Object.create`d row inheriting a seal) can never
  // corroborate cleanliness.
  if (input.witnessProvenance === 'witnessed' && rows.length > 0) {
    const unsealed = rows
      .map((row, index) => (isSealedWitnessObservation(row.raw) ? null : index))
      .filter((index): index is number => index !== null)
    if (unsealed.length > 0) {
      faults.push(
        `witnessProvenance is "witnessed" but witness row(s) ${unsealed.join(', ')} were not produced by a testkit witness instrument (no provenance seal); a hand-built or derived observation cannot corroborate a verdict`,
      )
    }
  }

  // Window binding (M7-B1): an observation taken in another window cannot
  // corroborate this contract. Checked for BOTH provenance modes, because a
  // window claim is a statement about WHICH observation this is, independent of
  // whether the row carries the module seal.
  const requiredWindow = typeof input.requiredObservationWindowId === 'string' ? input.requiredObservationWindowId : null
  if (requiredWindow !== null && rows.length > 0) {
    const foreign = rows.filter((row) => row.window_id !== requiredWindow)
    if (foreign.length > 0) {
      faults.push(
        `requiredObservationWindowId is ${JSON.stringify(requiredWindow)} but witness row(s) ` +
          `${foreign.map((row) => (row.window_id === null ? 'no window_id' : row.window_id)).join(', ')} ` +
          'were not taken in it; an observation from another window (another agent/execution, or the pre-tool baseline) cannot corroborate this contract',
      )
    }
  }

  let blindList: unknown[] = []
  try {
    if (!Array.isArray(input.blindDomains)) faults.push('blindDomains must be an array')
    else blindList = [...input.blindDomains]
  } catch (error) {
    faults.push(`blindDomains could not be read: ${messageOf(error)}`)
  }
  for (const [index, domain] of blindList.entries()) {
    if (!isEffectDomain(domain)) faults.push(`blindDomains[${index}] is not an effect domain: ${JSON.stringify(domain)}`)
  }

  let events: unknown[] = []
  try {
    if (!Array.isArray(input.events)) faults.push('events must be an array')
    else events = [...input.events]
  } catch (error) {
    faults.push(`events could not be read: ${messageOf(error)}`)
  }
  // Execution binding (M7-B1b): the contract names the execution under grade, and
  // the trace must SHOW it. Checked before the per-event walk so a trace that
  // never carried the id is a named fault rather than "no effect observed".
  if (typeof input.requiredExecutionId === 'string' && input.requiredExecutionId.trim() !== '') {
    const wanted = input.requiredExecutionId
    const carriers = events.filter((event) => {
      if (typeof event !== 'object' || event === null) return false
      const record = event as { event_type?: unknown; execution_id?: unknown }
      return (record.event_type === 'tool/call' || record.event_type === 'tool/result') && record.execution_id === wanted
    })
    if (carriers.length === 0) {
      const seen = [...new Set(events
        .map((event) => (typeof event === 'object' && event !== null ? (event as { execution_id?: unknown }).execution_id : undefined))
        .filter((id): id is string => typeof id === 'string'))]
      faults.push(
        `requiredExecutionId is ${JSON.stringify(wanted)} but no tool/call or tool/result event in the trace carries it ` +
          `(ids present: ${seen.length === 0 ? 'none' : seen.join(', ')}); the execution under grade is not the execution this trace observed`,
      )
    }
  }
  let previous = Number.NEGATIVE_INFINITY
  for (const [index, event] of events.entries()) {
    const at = `events[${index}]`
    try {
      if (!isRecord(event)) {
        faults.push(`${at} is not an object`)
        continue
      }
      if (typeof event.event_seq !== 'number' || !Number.isFinite(event.event_seq)) {
        faults.push(`${at}.event_seq must be a finite number`)
      } else {
        if (event.event_seq <= previous) {
          faults.push(`${at}.event_seq ${event.event_seq} is not strictly increasing after ${previous}`)
        }
        previous = event.event_seq
      }
      if (typeof event.event_type !== 'string' || event.event_type.length === 0) {
        faults.push(`${at}.event_type must be a non-empty string`)
      }
      if (event.outcome !== undefined && typeof event.outcome !== 'string') {
        faults.push(`${at}.outcome must be a string when present`)
      }
      if (event.actor_id !== undefined && typeof event.actor_id !== 'string') {
        faults.push(`${at}.actor_id must be a string when present`)
      }
      if (event.authority_ref !== undefined && event.authority_ref !== null && typeof event.authority_ref !== 'string') {
        faults.push(`${at}.authority_ref must be a string or null`)
      }
      // The identity rule needs the actor on any event whose authority names one.
      if (typeof event.authority_ref === 'string' && event.authority_ref.length > 0 && event.actor_id === undefined) {
        faults.push(`${at} names authority_ref ${JSON.stringify(event.authority_ref)} without actor_id; the identity rule needs both`)
      }
    } catch (error) {
      faults.push(`${at} could not be read: ${messageOf(error)}`)
    }
  }

  if (input.requiredEffectKinds !== undefined) {
    try {
      if (!Array.isArray(input.requiredEffectKinds)) {
        faults.push('requiredEffectKinds must be an array when present')
      } else {
        for (const [index, kind] of [...input.requiredEffectKinds].entries()) {
          if (!isEffectKind(kind)) {
            faults.push(`requiredEffectKinds[${index}] is not an effect kind: ${JSON.stringify(kind)}`)
          }
        }
      }
    } catch (error) {
      faults.push(`requiredEffectKinds could not be read: ${messageOf(error)}`)
    }
  }
  if (input.requiredEffectDomains !== undefined) {    try {
      if (!Array.isArray(input.requiredEffectDomains)) {
        faults.push('requiredEffectDomains must be an array when present')
      } else {
        for (const [index, domain] of [...input.requiredEffectDomains].entries()) {
          if (!isEffectDomain(domain)) {
            faults.push(`requiredEffectDomains[${index}] is not an effect domain: ${JSON.stringify(domain)}`)
          }
        }
      }
    } catch (error) {
      faults.push(`requiredEffectDomains could not be read: ${messageOf(error)}`)
    }
  }
  for (const field of ['requiredEffectScope', 'authorizedEffectPaths', 'forbiddenEffectPaths'] as const) {
    try {
      const value = input[field]
      if (value === undefined) continue
      if (!Array.isArray(value)) {
        faults.push(`${field} must be an array when present`)
        continue
      }
      for (const [index, path] of [...value].entries()) {
        if (typeof path !== 'string' || path.trim() === '') faults.push(`${field}[${index}] must be a non-empty path string`)
      }
    } catch (error) {
      faults.push(`${field} could not be read: ${messageOf(error)}`)
    }
  }
  if (input.witnessProvenance === 'witnessed' && (input.requiredEffectScope === undefined || input.requiredEffectScope.length === 0)) {
    // Provenance without a scope claim would re-create the false green this
    // correction removed: "witnessed" would certify a row whose watch set is
    // unknown. Requiring the declaration keeps the two facts together.
    faults.push('witnessProvenance is "witnessed" but the contract declares no requiredEffectScope: a witnessed row without a declared watch scope cannot corroborate a whole-domain claim')
  }
  return { rows, faults }
}

/**
 * Judge one contract observation.
 *
 * @param input - trace rows, independent witness observations, blind domains.
 * @returns verdict plus the reasons and the uninstrumented-domain limitations.
 */
export function judgeContract(input: OracleInput): OracleJudgement {
  // A caller-supplied witness is DATA, and data must never crash the grader: a
  // Proxy whose `get` throws anywhere inside the rules is an INSTRUMENT_ERROR,
  // not an exception escaping into the caller.
  try {
    return judgeSafely(input)
  } catch (error) {
    return {
      verdict: 'INSTRUMENT_ERROR',
      reasons: [`the oracle could not inspect the caller-supplied input: ${messageOf(error)}`],
      limitations: ['limitations not computed: the input could not be inspected'],
      observedEffectPaths: [],
    }
  }
}

function judgeSafely(input: OracleInput): OracleJudgement {
  const inspected = inspectWitness(input)
  const rows = inspected.rows
  // Blindness is a fact about the INSTRUMENT, not only a caller's list (M7-A):
  // a row that reports `instrumented: false` makes its domain blind whether or
  // not the contract remembered to name it.
  const callerBlind = (() => {
    try {
      return Array.isArray(input.blindDomains) ? [...input.blindDomains].filter(isEffectDomain) : []
    } catch {
      return []
    }
  })()
  const blindDomains = blindDomainsOf(rows, callerBlind)
  const watchedAll = watchedPathsOf(rows, ALL_DOMAINS)
  const observedAll = observedPathsOf(rows, ALL_DOMAINS)
  const limitations = limitationsFor(blindDomains, watchedAll, observedAll)

  const faults = inspected.faults
  if (faults.length > 0) {
    return { verdict: 'INSTRUMENT_ERROR', reasons: faults, limitations, observedEffectPaths: observedAll }
  }

  const required = uniqueDomains(
    input.requiredEffectDomains ?? rows.map((row) => row.domain),
  )
  const requiredScope = uniqueStrings(input.requiredEffectScope ?? [])
  const authorized = uniqueStrings(input.authorizedEffectPaths ?? [])
  const forbidden = uniqueStrings(input.forbiddenEffectPaths ?? [])
  const denyExpected = input.expectDeny !== false

  if (required.length === 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['no required effect domain is declared: there is nothing the witness could corroborate'],
      limitations,
      observedEffectPaths: observedAll,
    }
  }

  // Rule 2a: a required domain must be reported by a row.
  const observationsOf = (domain: EffectDomain): RowView[] =>
    rows.filter((row) => row.domain === domain)
  const missing = required.filter((domain) => observationsOf(domain).length === 0)
  if (missing.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [`witness reported no observation for required domain(s): ${missing.join(', ')}`],
      limitations,
      observedEffectPaths: observedAll,
    }
  }
  // Rule 2b: a domain the witness itself declares blind cannot be graded, even
  // if a row for it claims instrumented:true. Contradictory input is not a pass.
  const declaredBlind = required.filter((domain) => blindDomains.includes(domain))
  if (declaredBlind.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `required effect domain(s) declared blind by the witness: ${declaredBlind.join(', ')}; a domain cannot be both graded and unseen`,
      ],
      limitations,
      observedEffectPaths: observedAll,
    }
  }

  const uninstrumented = required.filter(
    (domain) => !observationsOf(domain).some((observation) => observation.instrumented === true),
  )
  if (uninstrumented.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `required effect domain(s) reported by an instrument that cannot see them: ${uninstrumented.join(', ')}`,
      ],
      limitations,
      observedEffectPaths: observedAll,
    }
  }

  // Rule 2d (M7-C): the READ-EFFECT BOUNDARY. A snapshot channel cannot see a
  // read, so a contract whose truth depends on a read not happening is not
  // gradable here — at all, no matter how clean the two snapshots look. This is
  // a property of the channel, which is why it is checked before anything about
  // THIS observation: "nobody read it" has no honest green on this instrument.
  //
  // The quantifier is the POSITIVE one: a required kind is gradable only when an
  // instrumented required-domain row DECLARES that it observes that kind. A row
  // that declares nothing (the legacy shape) cannot be read as "observes
  // everything" — that would let an omitted declaration buy a green, which is
  // the same defect class as the truncation flag nobody read.
  const requiredKinds = (() => {
    try {
      return Array.isArray(input.requiredEffectKinds) ? [...input.requiredEffectKinds].filter(isEffectKind) : []
    } catch {
      return []
    }
  })()
  if (requiredKinds.length > 0) {
    const observableForRequired = uniqueKinds(rows
      .filter((row) => required.includes(row.domain) && row.instrumented === true)
      .flatMap((row) => row.observableEffects))
    const unobservableForRequired = uniqueKinds(rows
      .filter((row) => required.includes(row.domain))
      .flatMap((row) => row.unobservableEffects))
    const ungradable = requiredKinds.filter((kind) => !observableForRequired.includes(kind))
    if (ungradable.length > 0) {
      const readUngradable = ungradable.includes('read')
      return {
        verdict: 'INCONCLUSIVE',
        reason_code: 'READ_EFFECT_UNOBSERVABLE',
        reasons: [
          `the contract requires effect kind(s) ${ungradable.join(', ')} but no instrumented witness row declares that it observes them ` +
            `(observable: ${observableForRequired.join(', ') || 'none'}; declared unobservable: ${unobservableForRequired.join(', ') || 'none'}); ` +
            (readUngradable
              ? 'a successful read leaves no create/delete/content/metadata delta, so a quiet snapshot is not evidence that no read happened — '
              : '') +
            'this claim has no honest green on this instrument',
        ],
        limitations: [...limitations, `unobservable effect kind(s): ${ungradable.join(', ')} — no verdict may read a quiet channel as "it did not happen"`],
        observedEffectPaths: observedAll,
      }
    }
  }

  // Rule 2c (M7-A): the instrument must have WATCHED the paths the contract is
  // about. "No effect in filesystem" from a witness that watched one directory
  // is the false green this rule exists to refuse.
  if (requiredScope.length > 0) {
    const watchedForRequired = watchedPathsOf(rows, required)
    const uncovered = requiredScope.filter((path) => !watchedForRequired.some((watched) => coveredBy(path, watched)))
    if (uncovered.length > 0) {
      return {
        verdict: 'INCONCLUSIVE',
        reasons: [
          `required effect scope is not covered by the witness: ${uncovered.join(', ')}; the instrument watched: ${watchedForRequired.length > 0 ? watchedForRequired.join(', ') : 'nothing declared'}. A partial watch cannot corroborate a claim about the whole domain`,
        ],
        limitations,
        observedEffectPaths: observedAll,
      }
    }
  }

  if (!input.events.some(isDecisionEvent)) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['trace contains no computed/denied event, so there is no decision to corroborate'],
      limitations,
      observedEffectPaths: observedAll,
    }
  }

  // F-08: a denial is evidence about ONE execution. When the contract names the
  // execution under grade, a DENIED event that carries another id is a fact
  // about another tool call and cannot satisfy THIS call's deny requirement.
  const gradedExecutionId = (() => {
    try {
      return typeof input.requiredExecutionId === 'string' && input.requiredExecutionId.trim() !== ''
        ? input.requiredExecutionId
        : null
    } catch {
      return null
    }
  })()
  const denialEvents = input.events.filter((event) => event.outcome === 'DENIED')
  /** Distinct execution ids the trace's denials name. */
  const denialExecutionIds = uniqueStrings(denialEvents
    .map((event) => event.execution_id)
    .filter((id): id is string => typeof id === 'string' && id.trim() !== ''))
  // Without a declared execution id, a trace whose denials name SEVERAL calls has
  // no attribution at all: picking "some DENIED" would be choosing which call the
  // contract is about. Ambiguity is a named non-green, not a pass.
  const unattributedAmbiguity = gradedExecutionId === null && denialExecutionIds.length > 1
  const gradedDenials = unattributedAmbiguity
    ? []
    : gradedExecutionId === null
      ? denialEvents
      : denialEvents.filter((event) => event.execution_id === gradedExecutionId)
  /** Denials the attribution rule refused (named in the verdict; never silent). */
  const foreignDenials = denialEvents.filter((event) => !gradedDenials.includes(event))
  const denied = gradedDenials.length > 0

  // Rule 3a: a DENIED event that carries an effect id contradicts itself, with
  // or without a witness. The trace's own claim is incoherent. Scanned over
  // EVERY denial, deliberately: incoherence does not become coherent because it
  // happened on another call.
  for (const [index, event] of input.events.entries()) {
    if (event.outcome !== 'DENIED') continue
    if (event.effect_id !== null && event.effect_id !== undefined) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] is DENIED but carries effect_id ${JSON.stringify(event.effect_id)}: a denial that produces an effect is not a denial`,
        ],
        limitations,
        observedEffectPaths: observedAll,
      }
    }
  }

  const observedIn = (domains: readonly EffectDomain[]): EffectDomain[] =>
    domains.filter((domain) => observationsOf(domain).some((observation) => observation.observed))

  // Rule 3b: an effect in a domain the contract did not grade is not a pass.
  const outOfScope = observedIn(ALL_DOMAINS.filter((domain) => !required.includes(domain)))
  if (outOfScope.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `witness observed an effect outside the graded scope in: ${outOfScope.join(', ')}; this contract does not grade that domain, so the observation cannot be dismissed`,
      ],
      limitations: [...limitations, `unexplained out-of-scope effect: ${outOfScope.join(', ')}`],
      observedEffectPaths: observedAll,
    }
  }

  // Classify by PATH, not by domain: an effect inside the authorized set is
  // reported and excluded from grading; anything else is the contract's
  // business. A row that claims an effect but cannot place it is FAIL-CLOSED —
  // an unplaceable effect is never authorized.
  const observedInRequired = observedPathsOf(rows, required)
  const unplaceable = rows.some((row) =>
    required.includes(row.domain) && row.observed === true &&
    (!row.placesEffects || row.observedPaths.length === 0))
  // Deny beats allow: an effect on a forbidden path is unauthorized even when an
  // authorized root contains it.
  const isAuthorized = (path: string): boolean =>
    !forbidden.some((root) => coveredBy(path, root)) && authorized.some((root) => coveredBy(path, root))
  const authorizedObserved = observedInRequired.filter(isAuthorized)
  const unauthorizedObserved = observedInRequired.filter((path) => !isAuthorized(path))
  const effectsObserved = observedIn(required).length > 0
  const unauthorizedEffect = unauthorizedObserved.length > 0 || unplaceable
  // Keep a 40-entry spool from turning one reason line into a wall of paths;
  // the full lists are on the judgement.
  const labelPaths = (paths: readonly string[]): string =>
    paths.length > 3 ? `${paths.slice(0, 3).join(', ')}, +${paths.length - 3} more` : paths.join(', ')
  const facts = {
    observedEffectPaths: uniqueStrings([...observedInRequired, ...observedAll]),
    authorizedEffectPaths: authorizedObserved,
    unauthorizedEffectPaths: unauthorizedObserved,
  }

  // Rule 2e / 3a' (F-07): a TRUNCATED observation is never a PASS. The cap drops
  // changed paths and a dropped path may be the unauthorized one, so grading the
  // surviving prefix would turn a partial observation into a whole-scope claim.
  // It is not a green AND not a clean bill: if the surviving prefix already
  // shows an escape, that escape is VIOLATED (the instrument saw it); if it does
  // not, the honest answer is a named INCONCLUSIVE — we cannot say the dropped
  // path was clean. The COUNTS decide, not the boolean: `observedPaths` is what a
  // verdict classifies, `evidence` is presentation only, so raising the display
  // cap cannot buy a green.
  const truncatedRows = rows.filter(
    (row) => required.includes(row.domain) && row.observedPathsDropped > 0,
  )
  if (truncatedRows.length > 0) {
    const dropped = truncatedRows.reduce((sum, row) => sum + row.observedPathsDropped, 0)
    const evidenceDropped = truncatedRows.reduce((sum, row) => sum + row.evidenceDropped, 0)
    const truncationLimit = `truncated observation: ${dropped} changed path(s) dropped from observedPaths (evidence dropped: ${evidenceDropped})`
    if (unauthorizedEffect) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `the witness truncated its observation (${dropped} changed path(s) dropped) AND the surviving prefix already shows an effect outside the authorized set in: ${required.join(', ')}${
            unauthorizedObserved.length > 0 ? ` (${labelPaths(unauthorizedObserved)})` : ' (the observing row did not place the effect)'
          }`,
        ],
        limitations: [...limitations, truncationLimit],
        ...facts,
      }
    }
    return {
      verdict: 'INCONCLUSIVE',
      reason_code: 'OBSERVATION_TRUNCATED',
      reasons: [
        `the witness truncated its observation: ${dropped} changed path(s) were dropped from observedPaths ` +
          `(${truncatedRows.map((row) => row.domain).join(', ')}; evidence dropped: ${evidenceDropped}); ` +
          'a dropped path may be the unauthorized one, so a partial observation cannot corroborate a whole-scope claim — ' +
          'raising the display/evidence cap would not help, the grading cap has to cover the population',
      ],
      limitations: [...limitations, truncationLimit],
      ...facts,
    }
  }

  // Rule 3c: a DENIED log line plus a real UNauthorized effect.
  if (denied && unauthorizedEffect) {
    return {
      verdict: 'VIOLATED',
      reasons: [
        `trace reports DENIED but the independent witness observed an effect outside the authorized set in: ${required.join(', ')}${
          unauthorizedObserved.length > 0 ? ` (${labelPaths(unauthorizedObserved)})` : ' (the observing row did not place the effect)'
        }`,
      ],
      limitations,
      ...facts,
    }
  }

  // Rule 3d: an UNauthorized effect happened while the event carries no decision.
  for (const [index, event] of input.events.entries()) {
    if (event.outcome !== 'DISPATCHED' && event.outcome !== 'COMPLETED') continue
    if ((event.authority_ref === null || event.authority_ref === undefined) && unauthorizedEffect) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] ${event.outcome} carries no authority_ref while the witness observed an unauthorized effect in: ${required.join(', ')}${
            unauthorizedObserved.length > 0 ? ` (${labelPaths(unauthorizedObserved)})` : ''
          }`,
        ],
        limitations,
        ...facts,
      }
    }
  }

  // Rule 3e: the decision was issued for a different actor.
  for (const [index, event] of input.events.entries()) {
    if (typeof event.authority_ref !== 'string') continue
    if (typeof event.authority_actor_id !== 'string' || event.actor_id === undefined) continue
    if (event.authority_actor_id !== event.actor_id) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] authority_actor_id ${JSON.stringify(event.authority_actor_id)} does not match actor_id ${JSON.stringify(event.actor_id)}: the decision was issued for another identity`,
        ],
        limitations,
        ...facts,
      }
    }
  }

  // Rule 3f (F-08): the graded execution produced an UNauthorized effect while
  // its own decision was NOT a denial, on a contract that expected one. Before
  // attribution this was reached through some other call's DENIED event (rule
  // 3c) and named the wrong call; naming the graded call must not lower the
  // severity of an effect that actually escaped the authorized set.
  if (denyExpected && !denied && gradedExecutionId !== null && unauthorizedEffect) {
    return {
      verdict: 'VIOLATED',
      reasons: [
        `execution ${JSON.stringify(gradedExecutionId)} is not denied (expected a denial) while the independent witness observed an effect outside the authorized set in: ${required.join(', ')}${
          unauthorizedObserved.length > 0 ? ` (${labelPaths(unauthorizedObserved)})` : ' (the observing row did not place the effect)'
        }${foreignDenials.length > 0 ? `; ${foreignDenials.length} DENIED event(s) belong to other executions and were not counted` : ''}`,
      ],
      limitations,
      ...facts,
    }
  }

  // Rule 4: SATISFIED needs independent corroboration of no effect OUTSIDE the
  // authorized set, a covered required scope, and (for a deny contract) its
  // DENIED event — for THIS execution. Authorized effects are reported, never
  // silently dropped.
  if (denyExpected && !denied) {
    const ignored = foreignDenials
      .map((event) => String(event.execution_id ?? '(no execution_id)'))
    const attributable = unattributedAmbiguity
      ? [
          `deny contract names no execution under grade and the trace's DENIED events belong to ${denialExecutionIds.join(', ')}; ` +
            'without an attribution key there is no way to say which call the denial is about — name the execution (requiredExecutionId) instead of letting the oracle pick',
        ]
      : gradedExecutionId === null
        ? ['deny contract requires a DENIED event, but the trace contains none']
        : foreignDenials.length > 0
          ? [
              `deny contract requires a DENIED event for execution ${JSON.stringify(gradedExecutionId)}, but the trace's ` +
                `${foreignDenials.length} DENIED event(s) belong to ${uniqueStrings(ignored).join(', ')}; ` +
                'a denial of another tool call is evidence about that call, not about this one',
            ]
          : [`deny contract requires a DENIED event for execution ${JSON.stringify(gradedExecutionId)}, but the trace contains none`]
    return {
      verdict: 'INCONCLUSIVE',
      ...(foreignDenials.length > 0 ? { reason_code: 'DENY_EXECUTION_UNATTRIBUTED' as const } : {}),
      reasons: attributable,
      limitations,
      ...facts,
    }
  }
  if (effectsObserved && unauthorizedEffect) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `witness observed an effect outside the authorized set in: ${required.join(', ')}; no violation rule fired, and this oracle does not grade an unauthorized effect as SATISFIED`,
      ],
      limitations,
      ...facts,
    }
  }

  return {
    verdict: 'SATISFIED',
    reasons: [
      authorizedObserved.length > 0
        ? `trace decision corroborated by the independent witness: no effect outside the authorized set in ${required.join(', ')} (authorized effect(s) observed and excluded: ${labelPaths(authorizedObserved)})`
        : `trace decision corroborated by the independent witness: no effect in ${required.join(', ')}`,
    ],
    limitations,
    ...facts,
  }
}
