/**
 * Execution Settlement S1 — ONE canonical, durable fact per physical execution.
 *
 * WHAT THIS MODULE IS. A recorder. It accepts an ExecutionId, an immutable
 * *reference* to an admissions decision that the existing ControlService already
 * made, and the observations the execution path reported; it writes one
 * canonical settlement record per physical execution and answers, later, what
 * that execution settled to.
 *
 * WHAT THIS MODULE IS NOT — THE NO-SECOND-AUTHORITY INVARIANT.
 *   **This module MUST NOT grant, deny, admit, allow, or revoke anything.**
 *   It has no import from `packages/runtime/control`, holds no resolver table,
 *   exposes no decision function, and cannot mint an `AdmissionReference`: the
 *   reference's `decisionId`/`decisionDigest` are supplied by the caller and are
 *   only *copied and checked for internal coherence*. The sole approval / Grant /
 *   Stop authority remains the existing `ControlService` (UTE-13). A settlement
 *   that disagrees with its admission reference is refused as an incoherent
 *   record (`SETTLEMENT_ADMISSION_MISMATCH`); it is never "re-decided" here.
 *
 *   The structural half of that invariant is machine-checked by the suite
 *   (`tests/ute2-settlement/settlement.test.mjs`): the public surface contains no
 *   exported function whose name can be read as a grant, the store has no such
 *   method, and a mutant that appends one turns the control RED.
 *
 * ONE FACT, ONE EXECUTION (UTE-15). The ExecutionId is the canonical attribution
 * key: exactly one record per physical execution attempt. Replays are not a
 * second fact and are never a second terminal state.
 *
 * STATE MACHINE (explicit; illegal transitions are refused BY NAME — see
 * `ILLEGAL_TRANSITION` — never silently rewritten):
 *
 *   ADMITTED ──enterRunning──▶ RUNNING ──settle──▶ COMPLETED
 *      │                          │               FAILED
 *      │                          │               CANCELLED
 *      ├──settle(REFUSED)          └──settle──▶   UNKNOWN
 *      ├──settle(CANCELLED)
 *      └──settle(UNKNOWN)
 *
 *   - `REFUSED` is only reachable from `ADMITTED`: a final admission refusal
 *     before the body, with `dispatch: 'not-started'` and **no** effect.
 *   - `COMPLETED` / `FAILED` are only reachable from `RUNNING`: the body was
 *     dispatched.
 *   - Every terminal state is terminal. A later write with the SAME facts is the
 *     named `DUPLICATE_SETTLEMENT` no-op; a later write with DIFFERENT facts is
 *     `SETTLEMENT_CONFLICT`. There is no last-writer-wins path.
 *   - `UNKNOWN` is a FIRST-CLASS terminal state, not a failure and not "never
 *     executed". It is the only honest answer when the outcome cannot be proven
 *     (SIGKILL, termination unconfirmed, evidence missing), and it must name the
 *     evidence that is missing. A fabricated `COMPLETED` is exactly the failure
 *     mode this module exists to prevent (UTE-16); the mutation control that
 *     turns recovery into `COMPLETED` must be RED.
 *
 * STOP. A Stop that arrived before the effect, during it, or after completion is
 * recorded additively (`stops[]`) and never rewrites an achieved outcome:
 *   - `pre-dispatch`  may be recorded only while `ADMITTED`; a `CANCELLED`
 *                     settlement from `ADMITTED` requires it.
 *   - `in-flight`     may be recorded only while `RUNNING`; a `CANCELLED`
 *                     settlement from `RUNNING` requires it.
 *   - `post-completion` may be recorded only on a `COMPLETED`/`FAILED` record
 *                     and leaves that terminal state and its observation intact.
 * A Stop is a record of an event that already happened elsewhere; this module
 * does not request, propagate or enforce a Stop.
 *
 * EFFECT PROVENANCE IS NOT A BOOLEAN. Host result, backend exit/kill, and the
 * observed I/O effect are separate axes (`dispatch` / `bodyOutcome` /
 * `effectEvidence`). `effectEvidence: 'observed'` requires at least one
 * observation carrying a non-empty `evidenceId`; claiming observed effects with
 * no observation is refused (`EFFECT_CLAIM_WITHOUT_OBSERVATION`). A record may
 * also never claim "no effect" while its dispatch is unknown.
 *
 * CRASH SAFETY OF THE RECORD ITSELF. Every write is an immutable, checksummed
 * envelope written to a private temp file, fsync'd, and published with an atomic
 * rename. A reader therefore sees either the previous complete record or the new
 * complete record — never a half-written one. A record whose envelope, checksum
 * or structure does not verify is `SETTLEMENT_CORRUPT` (a named refusal), never
 * "absent" and never "complete". Temp files are invisible to `read` / `list`.
 *
 * SCOPE OF THE GUARANTEE. S1 = "every execution that entered dispatch eventually
 * has a queryable fact: a terminal state or an explicit `UNKNOWN`". This module
 * does not itself observe the execution path: the adapters that call it are a
 * separate, wired-in-production change (none exists in this commit). S2
 * ("durable before the Host returns the result") is NOT claimed here.
 *
 * @module @dsh-agent-team/runtime/settlement
 */
import { createHash } from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'

/** Schema tag of the persisted settlement record. */
export const SETTLEMENT_SCHEMA = 'execution-settlement/1' as const

/** Schema tag of the checksummed on-disk envelope. */
export const SETTLEMENT_ENVELOPE_SCHEMA = 'execution-settlement-envelope/1' as const

/** Filename suffix of one canonical settlement record. */
export const SETTLEMENT_RECORD_SUFFIX = '.settlement.json' as const

/** Filename suffix of an in-progress (never readable) write. */
export const SETTLEMENT_TEMP_SUFFIX = '.tmp' as const

/** The closed state vocabulary. */
export type SettlementState =
  | 'ADMITTED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'REFUSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN'

/** Every state, in state-machine order. */
export const SETTLEMENT_STATES: readonly SettlementState[] = Object.freeze([
  'ADMITTED',
  'RUNNING',
  'COMPLETED',
  'REFUSED',
  'FAILED',
  'CANCELLED',
  'UNKNOWN',
])

/** The states from which no transition exists. */
export const TERMINAL_SETTLEMENT_STATES: readonly SettlementState[] = Object.freeze([
  'COMPLETED',
  'REFUSED',
  'FAILED',
  'CANCELLED',
  'UNKNOWN',
])

/** The closed set of named refusals this module can produce. */
export type SettlementRefusalCode =
  | 'DUPLICATE_SETTLEMENT'
  | 'SETTLEMENT_CONFLICT'
  | 'ILLEGAL_TRANSITION'
  | 'EFFECT_CLAIM_WITHOUT_OBSERVATION'
  | 'SETTLEMENT_CROSS_WIRED'
  | 'SETTLEMENT_ADMISSION_MISMATCH'
  | 'SETTLEMENT_ADMISSION_REFERENCE_INVALID'
  | 'SETTLEMENT_INPUT_INVALID'
  | 'SETTLEMENT_TIMESTAMP_REGRESSION'
  | 'UNCONFIRMED_WITHOUT_UNCERTAINTY'
  | 'STOP_EVIDENCE_MISSING'
  | 'ILLEGAL_STOP_TIMING'
  | 'SETTLEMENT_CORRUPT'
  | 'SETTLEMENT_WRITE_FAILED'
  | 'SETTLEMENT_NOT_FOUND'

/** Every refusal code, so a caller/test can enumerate the closed vocabulary. */
export const SETTLEMENT_REFUSAL_CODES: readonly SettlementRefusalCode[] = Object.freeze([
  'DUPLICATE_SETTLEMENT',
  'SETTLEMENT_CONFLICT',
  'ILLEGAL_TRANSITION',
  'EFFECT_CLAIM_WITHOUT_OBSERVATION',
  'SETTLEMENT_CROSS_WIRED',
  'SETTLEMENT_ADMISSION_MISMATCH',
  'SETTLEMENT_ADMISSION_REFERENCE_INVALID',
  'SETTLEMENT_INPUT_INVALID',
  'SETTLEMENT_TIMESTAMP_REGRESSION',
  'UNCONFIRMED_WITHOUT_UNCERTAINTY',
  'STOP_EVIDENCE_MISSING',
  'ILLEGAL_STOP_TIMING',
  'SETTLEMENT_CORRUPT',
  'SETTLEMENT_WRITE_FAILED',
  'SETTLEMENT_NOT_FOUND',
])

/**
 * The ONE error type this module throws. `code` is always one of
 * {@link SETTLEMENT_REFUSAL_CODES}; `details` is structured, never prose-only.
 */
export class ExecutionSettlementRefusal extends Error {
  readonly code: SettlementRefusalCode
  readonly details: Readonly<Record<string, unknown>>

  constructor(
    code: SettlementRefusalCode,
    detail: string,
    details: Record<string, unknown> = {},
  ) {
    super(`execution-settlement: ${code} — ${detail}`)
    this.name = 'ExecutionSettlementRefusal'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

/** Identity of one physical execution attempt. */
export interface SettlementIdentity {
  readonly executionId: string
  readonly toolName: string
  readonly actorId: string
  readonly worldId: string
}

/**
 * An IMMUTABLE reference to a decision the ControlService already made.
 *
 * `decisionId` + `decisionDigest` are the reference; `decision` is the recorded
 * verdict copied for coherence checks only. This module never creates, mutates
 * or re-evaluates one. `subjectExecutionId` is the execution the decision was
 * issued FOR; it must equal the settlement's ExecutionId or the write is
 * `SETTLEMENT_CROSS_WIRED`.
 */
export interface AdmissionReference {
  readonly decisionId: string
  readonly decisionDigest: string
  readonly decision: 'allow' | 'deny'
  readonly decisionKind: string
  readonly subjectExecutionId: string
  readonly decidedAt?: string
}

/** How far the execution got. `DISPATCH_ENTERED` does not imply the body ran. */
export type DispatchPhase = 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed'

/** What the body did, independently of what the Host reported. */
export type BodyOutcome = 'not-started' | 'completed' | 'failed' | 'unknown'

/** What is actually known about physical effects. */
export type EffectEvidence = 'none-confirmed' | 'possible' | 'observed' | 'unknown'

/** Closed effect-kind vocabulary (S1 keeps it deliberately small). */
export type EffectKind =
  | 'file-create'
  | 'file-delete'
  | 'file-content'
  | 'file-metadata'
  | 'process-spawn'
  | 'process-exit'
  | 'network-connect'

/** One observed effect, always tied to the instrument that saw it. */
export interface EffectObservation {
  readonly kind: EffectKind
  readonly target: string
  readonly evidenceId: string
}

/** The three independent axes plus the observed effect list. */
export interface ExecutionObservation {
  readonly executionId: string
  readonly dispatch: DispatchPhase
  readonly bodyOutcome: BodyOutcome
  readonly effectEvidence: EffectEvidence
  readonly observedEffects: readonly EffectObservation[]
}

/** When a Stop arrived relative to the effect. */
export type StopPhase = 'pre-dispatch' | 'in-flight' | 'post-completion'

/** One recorded Stop event (additive; never rewrites an outcome). */
export interface StopRecord {
  readonly stopId: string
  readonly at: string
  readonly phase: StopPhase
}

/** One entry of the monotonic transition log. */
export interface SettlementTransition {
  readonly seq: number
  readonly from: SettlementState | null
  readonly to: SettlementState
  readonly at: string
  readonly reason: string | null
  readonly missingEvidence: readonly string[]
  /** sha256 of the canonical request facts that produced this transition. */
  readonly factsDigest: string
}

/** The canonical record. The file on disk is exactly this payload. */
export interface ExecutionSettlementRecord {
  readonly schema: typeof SETTLEMENT_SCHEMA
  readonly identity: SettlementIdentity
  readonly admission: AdmissionReference
  readonly state: SettlementState
  readonly observation: ExecutionObservation
  readonly transitions: readonly SettlementTransition[]
  readonly stops: readonly StopRecord[]
  readonly terminalReason: string | null
  readonly missingEvidence: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** What a successful (or idempotent) write did. */
export interface SettlementWriteResult {
  readonly record: ExecutionSettlementRecord
  readonly outcome: 'created' | 'transitioned' | 'recorded' | 'duplicate'
  /** `DUPLICATE_SETTLEMENT` exactly when `outcome === 'duplicate'`. */
  readonly code: 'DUPLICATE_SETTLEMENT' | null
}

/** Input to `recordAdmission`. */
export interface RecordAdmissionInput {
  readonly identity: SettlementIdentity
  readonly admission: AdmissionReference
  readonly at: string
  readonly reason?: string
}

/** Input to `enterRunning`. */
export interface EnterRunningInput {
  readonly executionId: string
  readonly observation: ExecutionObservation
  readonly at: string
}

/** Input to `recordStop`. */
export interface RecordStopInput {
  readonly executionId: string
  readonly stopId: string
  readonly at: string
  readonly phase: StopPhase
}

/** Input to `settle`. */
export interface SettleInput {
  readonly executionId: string
  readonly state: SettlementState
  readonly observation: ExecutionObservation
  readonly at: string
  readonly reason: string
  readonly missingEvidence?: readonly string[]
}

/** One record reconciled by `recoverUnsettled`. */
export interface SettlementRecoveryResult {
  readonly executionId: string
  readonly before: SettlementState
  readonly after: SettlementState
  readonly outcome: SettlementWriteResult['outcome']
  readonly missingEvidence: readonly string[]
}

/** Options for {@link createExecutionSettlementStore}. */
export interface ExecutionSettlementStoreOptions {
  /** Directory holding one `<executionId>.settlement.json` per execution. */
  readonly dir: string
}

/** The writer/reader surface. There is deliberately no decision method here. */
export interface ExecutionSettlementStore {
  readonly dir: string
  recordAdmission(input: RecordAdmissionInput): SettlementWriteResult
  enterRunning(input: EnterRunningInput): SettlementWriteResult
  recordStop(input: RecordStopInput): SettlementWriteResult
  settle(input: SettleInput): SettlementWriteResult
  recoverUnsettled(at: string): readonly SettlementRecoveryResult[]
  read(executionId: string): ExecutionSettlementRecord | null
  list(): readonly ExecutionSettlementRecord[]
}

// ---------------------------------------------------------------- constants

/** Legal outgoing transitions. Everything not listed is refused by name. */
const LEGAL_TRANSITIONS: Readonly<Record<SettlementState, readonly SettlementState[]>> = Object.freeze({
  ADMITTED: Object.freeze(['RUNNING', 'REFUSED', 'CANCELLED', 'UNKNOWN'] as SettlementState[]),
  RUNNING: Object.freeze(['COMPLETED', 'FAILED', 'CANCELLED', 'UNKNOWN'] as SettlementState[]),
  COMPLETED: Object.freeze([] as SettlementState[]),
  REFUSED: Object.freeze([] as SettlementState[]),
  FAILED: Object.freeze([] as SettlementState[]),
  CANCELLED: Object.freeze([] as SettlementState[]),
  UNKNOWN: Object.freeze([] as SettlementState[]),
})

const DISPATCH_PHASES: readonly DispatchPhase[] = Object.freeze([
  'not-started',
  'started',
  'quiesced',
  'termination-unconfirmed',
])
const BODY_OUTCOMES: readonly BodyOutcome[] = Object.freeze(['not-started', 'completed', 'failed', 'unknown'])
const EFFECT_EVIDENCE_VALUES: readonly EffectEvidence[] = Object.freeze([
  'none-confirmed',
  'possible',
  'observed',
  'unknown',
])
const EFFECT_KINDS: readonly EffectKind[] = Object.freeze([
  'file-create',
  'file-delete',
  'file-content',
  'file-metadata',
  'process-spawn',
  'process-exit',
  'network-connect',
])
const STOP_PHASES: readonly StopPhase[] = Object.freeze(['pre-dispatch', 'in-flight', 'post-completion'])
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/
const EXECUTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const SHA256_HEX_RE = /^[0-9a-f]{64}$/

const UNKNOWN_RECOVERY_REASON = 'PROCESS_TERMINATED_WITHOUT_OUTCOME'
/**
 * The three constants recovery uses when it can prove NOTHING about the
 * outcome. They are separate names on purpose: the negative control that
 * fabricates a COMPLETED settlement mutates exactly these three lines, and must
 * turn the SIGKILL-recovery control RED.
 */
const RECOVERY_TERMINAL_STATE: SettlementState = 'UNKNOWN'
const RECOVERY_BODY_OUTCOME: BodyOutcome = 'unknown'
const RECOVERY_EFFECT_EVIDENCE: EffectEvidence = 'unknown'

// ------------------------------------------------------------------ helpers

function refusal(
  code: SettlementRefusalCode,
  detail: string,
  details: Record<string, unknown> = {},
): ExecutionSettlementRefusal {
  return new ExecutionSettlementRefusal(code, detail, details)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deterministic JSON: object keys sorted, `undefined` rendered as `null` (the
 * persisted records never rely on key order). Used for the envelope checksum and
 * for the per-transition facts digest.
 */
export function canonicalSettlementJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalSettlementJson).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalSettlementJson(record[key])}`).join(',')}}`
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function digestOf(value: unknown): string {
  return sha256Hex(canonicalSettlementJson(value))
}

function requireString(value: unknown, field: string, max = 512): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw refusal('SETTLEMENT_INPUT_INVALID', `${field} must be a non-empty string`, { field })
  }
  if (value.length > max) {
    throw refusal('SETTLEMENT_INPUT_INVALID', `${field} is longer than ${max} characters`, { field })
  }
  return value
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_RE.test(value)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', `${field} must be an ISO-8601 UTC timestamp ending in Z`, {
      field,
      value,
    })
  }
  return value
}

/** Copies and freezes an admission reference. This is not a decision factory. */
function freezeAdmissionReference(input: AdmissionReference): AdmissionReference {
  if (!isPlainObject(input)) {
    throw refusal('SETTLEMENT_ADMISSION_REFERENCE_INVALID', 'the admission reference must be an object')
  }
  const decisionId = requireString(input.decisionId, 'admission.decisionId')
  const decisionDigest = requireString(input.decisionDigest, 'admission.decisionDigest', 64)
  if (!SHA256_HEX_RE.test(decisionDigest)) {
    throw refusal(
      'SETTLEMENT_ADMISSION_REFERENCE_INVALID',
      'admission.decisionDigest must be the 64-hex sha256 of the ControlService decision record (a reference, not a re-decision)',
      { decisionId },
    )
  }
  const decision = input.decision
  if (decision !== 'allow' && decision !== 'deny') {
    throw refusal('SETTLEMENT_ADMISSION_REFERENCE_INVALID', "admission.decision must be 'allow' or 'deny'", {
      decisionId,
    })
  }
  const decisionKind = requireString(input.decisionKind, 'admission.decisionKind')
  const subjectExecutionId = requireString(input.subjectExecutionId, 'admission.subjectExecutionId')
  const decidedAt = input.decidedAt === undefined ? undefined : requireTimestamp(input.decidedAt, 'admission.decidedAt')
  return Object.freeze({
    decisionId,
    decisionDigest,
    decision,
    decisionKind,
    subjectExecutionId,
    ...(decidedAt === undefined ? {} : { decidedAt }),
  })
}

function freezeIdentity(input: SettlementIdentity): SettlementIdentity {
  if (!isPlainObject(input)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', 'the execution identity must be an object')
  }
  const executionId = requireString(input.executionId, 'identity.executionId', 200)
  if (!EXECUTION_ID_RE.test(executionId)) {
    throw refusal(
      'SETTLEMENT_INPUT_INVALID',
      'identity.executionId must match [A-Za-z0-9][A-Za-z0-9._:-]* (it is also the record filename)',
      { executionId },
    )
  }
  return Object.freeze({
    executionId,
    toolName: requireString(input.toolName, 'identity.toolName'),
    actorId: requireString(input.actorId, 'identity.actorId'),
    worldId: requireString(input.worldId, 'identity.worldId'),
  })
}

function assertSameExecution(expected: string, observed: unknown, where: string): void {
  if (observed !== expected) {
    throw refusal(
      'SETTLEMENT_CROSS_WIRED',
      `${where} belongs to a different execution — a settlement may only carry facts about its own ExecutionId`,
      { expectedExecutionId: expected, observedExecutionId: observed, where },
    )
  }
}

function freezeObservation(input: ExecutionObservation): ExecutionObservation {
  if (!isPlainObject(input)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', 'the execution observation must be an object')
  }
  const executionId = requireString(input.executionId, 'observation.executionId')
  if (!DISPATCH_PHASES.includes(input.dispatch)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', `observation.dispatch ${String(input.dispatch)} is not a known phase`, {
      dispatch: input.dispatch,
    })
  }
  if (!BODY_OUTCOMES.includes(input.bodyOutcome)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', `observation.bodyOutcome ${String(input.bodyOutcome)} is not known`, {
      bodyOutcome: input.bodyOutcome,
    })
  }
  if (!EFFECT_EVIDENCE_VALUES.includes(input.effectEvidence)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', `observation.effectEvidence ${String(input.effectEvidence)} is not known`, {
      effectEvidence: input.effectEvidence,
    })
  }
  if (!Array.isArray(input.observedEffects)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', 'observation.observedEffects must be an array')
  }
  const observedEffects = input.observedEffects.map((effect, index) => {
    if (!isPlainObject(effect)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', `observation.observedEffects[${index}] must be an object`, { index })
    }
    const kind = effect.kind
    if (typeof kind !== 'string' || !EFFECT_KINDS.includes(kind as EffectKind)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', `observation.observedEffects[${index}].kind is not a known effect kind`, {
        index,
        kind,
      })
    }
    return Object.freeze({
      kind: kind as EffectKind,
      target: requireString(effect.target, `observation.observedEffects[${index}].target`),
      evidenceId: requireString(effect.evidenceId, `observation.observedEffects[${index}].evidenceId`),
    })
  })
  return Object.freeze({
    executionId,
    dispatch: input.dispatch,
    bodyOutcome: input.bodyOutcome,
    effectEvidence: input.effectEvidence,
    observedEffects: Object.freeze(observedEffects),
  })
}

/**
 * Effects and their claimed evidence must agree: `observed` iff observations
 * exist. This is the "never claim an effect the record cannot support" rule in
 * both directions (an empty `observed` list is not "no effect proof"; it is no
 * evidence at all).
 */
function assertEffectSummary(observation: ExecutionObservation): void {
  const observed = observation.observedEffects
  if (observation.effectEvidence === 'observed' && observed.length === 0) {
    throw refusal(
      'EFFECT_CLAIM_WITHOUT_OBSERVATION',
      "effectEvidence 'observed' requires at least one effect observation carrying a non-empty evidenceId",
      { observedCount: observed.length },
    )
  }
  if (observation.effectEvidence !== 'observed' && observed.length > 0) {
    throw refusal(
      'EFFECT_CLAIM_WITHOUT_OBSERVATION',
      `an observation list of ${observed.length} effect(s) must be recorded as effectEvidence 'observed', not '${observation.effectEvidence}'`,
      { effectEvidence: observation.effectEvidence, observedCount: observed.length },
    )
  }
}

function assertLegalTransition(from: SettlementState, to: SettlementState): void {
  const allowed = LEGAL_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw refusal('ILLEGAL_TRANSITION', `${from} → ${to} is not a legal settlement transition`, {
      from,
      to,
      allowed,
    })
  }
}

function assertAdmissionCoherence(admission: AdmissionReference, state: SettlementState): void {
  if (state === 'REFUSED') {
    if (admission.decision !== 'deny') {
      throw refusal(
        'SETTLEMENT_ADMISSION_MISMATCH',
        "a REFUSED settlement must reference a ControlService decision whose recorded outcome is 'deny'",
        { decisionId: admission.decisionId, decision: admission.decision },
      )
    }
    return
  }
  if (state === 'ADMITTED') return
  if (admission.decision !== 'allow') {
    throw refusal(
      'SETTLEMENT_ADMISSION_MISMATCH',
      `a ${state} settlement cannot reference a decision recorded as 'deny' — this module records the decision, it does not overturn it`,
      { decisionId: admission.decisionId, decision: admission.decision, state },
    )
  }
}

function assertTerminalObservation(
  state: SettlementState,
  observation: ExecutionObservation,
  admission: AdmissionReference,
  record: ExecutionSettlementRecord,
): void {
  assertEffectSummary(observation)
  if (state === 'COMPLETED') {
    if (observation.dispatch !== 'started' && observation.dispatch !== 'quiesced') {
      throw refusal('SETTLEMENT_INPUT_INVALID', `COMPLETED requires a dispatched body, got '${observation.dispatch}'`, {
        state,
        dispatch: observation.dispatch,
      })
    }
    if (observation.bodyOutcome !== 'completed') {
      throw refusal('SETTLEMENT_INPUT_INVALID', `COMPLETED requires bodyOutcome 'completed', got '${observation.bodyOutcome}'`, {
        state,
        bodyOutcome: observation.bodyOutcome,
      })
    }
    if (observation.effectEvidence === 'unknown' || observation.effectEvidence === 'possible') {
      throw refusal(
        'SETTLEMENT_INPUT_INVALID',
        `COMPLETED cannot carry effectEvidence '${observation.effectEvidence}' — an unproven effect is not a completion`,
        { state, effectEvidence: observation.effectEvidence },
      )
    }
  }
  if (state === 'REFUSED') {
    if (observation.dispatch !== 'not-started') {
      throw refusal('SETTLEMENT_INPUT_INVALID', "REFUSED requires dispatch 'not-started' (a refusal before the body)", {
        state,
        dispatch: observation.dispatch,
      })
    }
    if (observation.bodyOutcome !== 'not-started') {
      throw refusal('SETTLEMENT_INPUT_INVALID', "REFUSED requires bodyOutcome 'not-started'", {
        state,
        bodyOutcome: observation.bodyOutcome,
      })
    }
    if (observation.effectEvidence !== 'none-confirmed') {
      throw refusal('SETTLEMENT_INPUT_INVALID', "REFUSED requires effectEvidence 'none-confirmed' (zero effect)", {
        state,
        effectEvidence: observation.effectEvidence,
      })
    }
    if (observation.observedEffects.length > 0) {
      throw refusal(
        'EFFECT_CLAIM_WITHOUT_OBSERVATION',
        'REFUSED cannot carry observed effects — a refused admission never produced a body effect',
        { state, observedCount: observation.observedEffects.length },
      )
    }
  }
  if (state === 'UNKNOWN' && observation.effectEvidence === 'none-confirmed') {
    throw refusal(
      'UNCONFIRMED_WITHOUT_UNCERTAINTY',
      "UNKNOWN must not claim 'none-confirmed' effects — unknown is the absence of proof, not proof of absence",
      { state, effectEvidence: observation.effectEvidence },
    )
  }
  assertAdmissionCoherence(admission, state)
  if (state === 'CANCELLED') {
    const required: StopPhase = record.state === 'ADMITTED' ? 'pre-dispatch' : 'in-flight'
    if (!record.stops.some((stop) => stop.phase === required)) {
      throw refusal(
        'STOP_EVIDENCE_MISSING',
        `a CANCELLED settlement from ${record.state} requires a recorded '${required}' Stop`,
        { state, from: record.state, requiredStopPhase: required, recordedStopPhases: record.stops.map((s) => s.phase) },
      )
    }
  }
}

function assertTimestampMonotonic(record: ExecutionSettlementRecord, at: string): void {
  if (at < record.updatedAt) {
    throw refusal(
      'SETTLEMENT_TIMESTAMP_REGRESSION',
      `a transition at ${at} is earlier than the record's last transition at ${record.updatedAt} — the transition log is monotonic`,
      { at, lastTransitionAt: record.updatedAt },
    )
  }
}

function nextTransition(
  record: ExecutionSettlementRecord,
  to: SettlementState,
  at: string,
  reason: string | null,
  missingEvidence: readonly string[],
  factsDigest: string,
): SettlementTransition {
  return Object.freeze({
    seq: record.transitions.length + 1,
    from: record.state,
    to,
    at,
    reason,
    missingEvidence: Object.freeze([...missingEvidence]),
    factsDigest,
  })
}

function withTransition(
  record: ExecutionSettlementRecord,
  transition: SettlementTransition,
  patch: Partial<Pick<ExecutionSettlementRecord, 'observation' | 'stops' | 'terminalReason' | 'missingEvidence'>>,
): ExecutionSettlementRecord {
  return Object.freeze({
    ...record,
    ...patch,
    state: transition.to,
    transitions: Object.freeze([...record.transitions, transition]),
    updatedAt: transition.at,
  })
}

function settleDuplicateOrConflict(
  existing: ExecutionSettlementRecord,
  lastDigest: string | undefined,
  factsDigest: string,
  state: SettlementState,
): SettlementWriteResult {
  if (lastDigest === factsDigest) {
    return { record: existing, outcome: 'duplicate', code: 'DUPLICATE_SETTLEMENT' }
  }
  throw refusal(
    'SETTLEMENT_CONFLICT',
    `execution '${existing.identity.executionId}' already settled to ${existing.state}; a different terminal write is a conflict, not an overwrite`,
    { executionId: existing.identity.executionId, existingState: existing.state, requestedState: state },
  )
}

function normaliseMissingEvidence(value: readonly string[] | undefined): readonly string[] {
  if (value === undefined) return Object.freeze([])
  if (!Array.isArray(value)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', 'missingEvidence must be an array of non-empty strings')
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    const text = requireString(item, 'missingEvidence[]')
    if (seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return Object.freeze(out)
}

// -------------------------------------------------------------- persistence

/** The canonical file path of one execution's settlement record. */
export function settlementRecordPath(dir: string, executionId: string): string {
  if (!EXECUTION_ID_RE.test(executionId)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', 'executionId must match [A-Za-z0-9][A-Za-z0-9._:-]*', { executionId })
  }
  return join(dir, `${executionId}${SETTLEMENT_RECORD_SUFFIX}`)
}

let tempCounter = 0

/**
 * Publish one record: private temp file → fsync → atomic rename. A crash before
 * the rename leaves a temp file the readers ignore; a reader never observes a
 * partially written record.
 */
function writeRecordAtomic(dir: string, executionId: string, payload: ExecutionSettlementRecord): string {
  const target = settlementRecordPath(dir, executionId)
  const envelope = {
    schema: SETTLEMENT_ENVELOPE_SCHEMA,
    checksum: `sha256:${digestOf(payload)}`,
    payload,
  }
  const text = `${canonicalSettlementJson(envelope)}\n`
  tempCounter += 1
  const pid = (process as unknown as { pid?: number }).pid ?? 0
  const temp = `${target}.${pid}.${tempCounter}${SETTLEMENT_TEMP_SUFFIX}`
  mkdirSync(dir, { recursive: true })
  let fd: number | undefined
  try {
    fd = openSync(temp, 'wx', 0o600)
    writeSync(fd, text)
    fsyncSync(fd)
    closeSync(fd)
    fd = undefined
    renameSync(temp, target)
  } catch (error) {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        // the original write error is the one worth reporting
      }
    }
    try {
      unlinkSync(temp)
    } catch {
      // a temp file that never existed is not an error
    }
    throw refusal('SETTLEMENT_WRITE_FAILED', `could not publish the settlement record for '${executionId}'`, {
      executionId,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  return target
}

function parseEnvelope(text: string, source: string): ExecutionSettlementRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw refusal('SETTLEMENT_CORRUPT', `the settlement record at ${source} is not valid JSON`, {
      source,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  if (!isPlainObject(parsed) || parsed.schema !== SETTLEMENT_ENVELOPE_SCHEMA) {
    throw refusal('SETTLEMENT_CORRUPT', `the settlement envelope at ${source} does not declare ${SETTLEMENT_ENVELOPE_SCHEMA}`, {
      source,
    })
  }
  const checksum = parsed.checksum
  if (typeof checksum !== 'string' || !checksum.startsWith('sha256:')) {
    throw refusal('SETTLEMENT_CORRUPT', `the settlement envelope at ${source} carries no sha256 checksum`, { source })
  }
  const actual = `sha256:${digestOf(parsed.payload)}`
  if (checksum !== actual) {
    throw refusal(
      'SETTLEMENT_CORRUPT',
      `the settlement envelope at ${source} failed its checksum — a partial or edited record is never read as complete`,
      { source, declared: checksum, actual },
    )
  }
  return validateRecordPayload(parsed.payload, source)
}

function assertEnvelopeRecordShape(payload: Record<string, unknown>, source: string): void {
  const fail = (detail: string): never => {
    throw refusal('SETTLEMENT_CORRUPT', `the settlement record at ${source} is invalid: ${detail}`, { source })
  }
  if (payload.schema !== SETTLEMENT_SCHEMA) fail(`schema is ${String(payload.schema)}, expected ${SETTLEMENT_SCHEMA}`)
  if (!isPlainObject(payload.identity)) fail('identity is not an object')
  if (!isPlainObject(payload.admission)) fail('admission is not an object')
  if (!SETTLEMENT_STATES.includes(payload.state as SettlementState)) fail(`state ${String(payload.state)} is unknown`)
  if (!isPlainObject(payload.observation)) fail('observation is not an object')
  if (!Array.isArray(payload.transitions) || payload.transitions.length === 0) fail('transitions must be a non-empty array')
  if (!Array.isArray(payload.stops)) fail('stops must be an array')
}

function validateRecordPayload(payload: unknown, source: string): ExecutionSettlementRecord {
  if (!isPlainObject(payload)) {
    throw refusal('SETTLEMENT_CORRUPT', `the settlement record at ${source} is not an object`, { source })
  }
  assertEnvelopeRecordShape(payload, source)
  const fail = (detail: string): never => {
    throw refusal('SETTLEMENT_CORRUPT', `the settlement record at ${source} is invalid: ${detail}`, { source })
  }
  const transitions = payload.transitions as unknown[]
  let previous: Record<string, unknown> | null = null
  for (let index = 0; index < transitions.length; index += 1) {
    const value = transitions[index]
    if (!isPlainObject(value)) {
      fail(`transitions[${index}] is not an object`)
      continue
    }
    const raw: Record<string, unknown> = value
    if (raw.seq !== index + 1) fail(`transitions[${index}].seq is ${String(raw.seq)}, expected ${index + 1} (the log is monotonic)`)
    const to = raw.to as SettlementState
    if (!SETTLEMENT_STATES.includes(to)) fail(`transitions[${index}].to is unknown`)
    if (index === 0) {
      if (raw.from !== null) fail('transitions[0].from must be null')
      if (to !== 'ADMITTED') fail('transitions[0].to must be ADMITTED')
    } else if (previous !== null) {
      const previousTo = previous.to as SettlementState
      if (raw.from !== previousTo) fail(`transitions[${index}].from does not continue transitions[${index - 1}].to`)
      if (String(raw.at) < String(previous.at)) fail(`transitions[${index}].at regresses`)
      if (!(LEGAL_TRANSITIONS[previousTo] as readonly SettlementState[]).includes(to)) {
        fail(`transitions[${index}] records an illegal ${previousTo} → ${String(raw.to)}`)
      }
    }
    if (typeof raw.factsDigest !== 'string' || !SHA256_HEX_RE.test(raw.factsDigest)) {
      fail(`transitions[${index}].factsDigest is not a sha256 hex digest`)
    }
    if (!Array.isArray(raw.missingEvidence)) fail(`transitions[${index}].missingEvidence must be an array`)
    previous = raw
  }
  const last = previous as Record<string, unknown> | null
  if (last !== null && last.to !== payload.state) fail('the last transition does not agree with state')
  if (last !== null && String(payload.updatedAt) !== String(last.at)) fail('updatedAt is not the last transition timestamp')

  if (typeof payload.createdAt !== 'string' || !ISO_TIMESTAMP_RE.test(payload.createdAt)) fail('createdAt is not ISO-8601')
  if (typeof payload.terminalReason !== 'string' && payload.terminalReason !== null) fail('terminalReason must be string|null')
  if (!Array.isArray(payload.missingEvidence)) fail('missingEvidence must be an array')
  // The record is JSON, so re-reading the frozen-input validators here is safe:
  // they only add typing/validation, they do not re-decide anything.
  const identity = payload.identity as SettlementIdentity
  const admission = payload.admission as AdmissionReference
  const observation = payload.observation as ExecutionObservation
  const record = payload as unknown as ExecutionSettlementRecord
  try {
    freezeIdentity(identity)
    freezeAdmissionReference(admission)
    freezeObservation(observation)
    assertSameExecution(identity.executionId, observation.executionId, 'observation.executionId')
    assertSameExecution(identity.executionId, admission.subjectExecutionId, 'admission.subjectExecutionId')
  } catch (error) {
    if (error instanceof ExecutionSettlementRefusal) {
      fail(error.message.replace(/^execution-settlement: [A-Z_]+ — /, ''))
    }
    throw error
  }
  return Object.freeze({
    ...record,
    identity: freezeIdentity(identity),
    admission: freezeAdmissionReference(admission),
    observation: freezeObservation(observation),
    transitions: Object.freeze(transitions.map((t) => Object.freeze({ ...(t as SettlementTransition) }))),
    stops: Object.freeze((payload.stops as StopRecord[]).map((s) => Object.freeze({ ...s }))),
    missingEvidence: Object.freeze([...(payload.missingEvidence as string[])]),
  })
}

function missingEvidenceForRecovery(record: ExecutionSettlementRecord): readonly string[] {
  if (record.state === 'ADMITTED') return Object.freeze(['dispatch-confirmation', 'terminal-observation', 'effect-evidence'])
  return Object.freeze([
    'terminal-observation',
    'host-result',
    'backend-receipt',
    ...(record.observation.effectEvidence === 'unknown' ? ['effect-evidence'] : []),
  ])
}

/**
 * The facts a recovery writes for a record whose process died without a terminal
 * outcome. The state is a named constant because this is exactly where a
 * fabricated COMPLETED would enter, and the mutation control pins it.
 */
function recoverySettlementFacts(
  record: ExecutionSettlementRecord,
  missingEvidence: readonly string[],
): { state: SettlementState; reason: string; missingEvidence: readonly string[]; observation: ExecutionObservation } {
  return {
    state: RECOVERY_TERMINAL_STATE,
    reason: UNKNOWN_RECOVERY_REASON,
    missingEvidence,
    observation: {
      executionId: record.identity.executionId,
      dispatch: record.observation.dispatch,
      bodyOutcome: RECOVERY_BODY_OUTCOME,
      effectEvidence:
        record.observation.effectEvidence === 'observed' ? 'observed' : RECOVERY_EFFECT_EVIDENCE,
      observedEffects: record.observation.observedEffects,
    },
  }
}

// -------------------------------------------------------------- the store

function readRecord(dir: string, executionId: string): ExecutionSettlementRecord | null {
  const path = settlementRecordPath(dir, executionId)
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw refusal('SETTLEMENT_CORRUPT', `could not read the settlement record for '${executionId}'`, {
      executionId,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  return parseEnvelope(text, path)
}

function publishRecord(dir: string, record: ExecutionSettlementRecord): ExecutionSettlementRecord {
  writeRecordAtomic(dir, record.identity.executionId, record)
  return record
}

/**
 * Open (or create) the settlement store rooted at `options.dir`.
 *
 * INVARIANT (repeated here because it is the reason the constructor takes only a
 * directory): there is no option that injects a policy, resolver, grant table or
 * ControlService. The store cannot make an admission decision, because it has
 * nothing to make one with.
 */
export function createExecutionSettlementStore(
  options: ExecutionSettlementStoreOptions,
): ExecutionSettlementStore {
  if (!isPlainObject(options)) {
    throw refusal('SETTLEMENT_INPUT_INVALID', 'createExecutionSettlementStore requires an options object')
  }
  const dir = requireString(options.dir, 'options.dir', 4096)
  mkdirSync(dir, { recursive: true })

  function recordAdmission(input: RecordAdmissionInput): SettlementWriteResult {
    if (!isPlainObject(input)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', 'recordAdmission requires an input object')
    }
    const identity = freezeIdentity(input.identity)
    const admission = freezeAdmissionReference(input.admission)
    const at = requireTimestamp(input.at, 'at')
    const reason = input.reason === undefined ? null : requireString(input.reason, 'reason')
    assertSameExecution(identity.executionId, admission.subjectExecutionId, 'admission.subjectExecutionId')
    const existing = readRecord(dir, identity.executionId)
    const admissionFacts = { identity, admission }
    const factsDigest = digestOf({ kind: 'admission', facts: admissionFacts })
    if (existing !== null) {
      const first = existing.transitions[0]
      if (first !== undefined && first.factsDigest === factsDigest) {
        return { record: existing, outcome: 'duplicate', code: 'DUPLICATE_SETTLEMENT' }
      }
      throw refusal(
        'SETTLEMENT_CONFLICT',
        `execution '${identity.executionId}' already has a settlement whose identity/admission reference differ from this write — the first record is authoritative, there is no last-writer-wins`,
        { executionId: identity.executionId, existingDecisionId: existing.admission.decisionId, incomingDecisionId: admission.decisionId },
      )
    }
    const observation = freezeObservation({
      executionId: identity.executionId,
      dispatch: 'not-started',
      bodyOutcome: 'not-started',
      effectEvidence: 'none-confirmed',
      observedEffects: [],
    })
    const transition: SettlementTransition = Object.freeze({
      seq: 1,
      from: null,
      to: 'ADMITTED',
      at,
      reason,
      missingEvidence: Object.freeze([]),
      factsDigest,
    })
    const record: ExecutionSettlementRecord = Object.freeze({
      schema: SETTLEMENT_SCHEMA,
      identity,
      admission,
      state: 'ADMITTED',
      observation,
      transitions: Object.freeze([transition]),
      stops: Object.freeze([]),
      terminalReason: null,
      missingEvidence: Object.freeze([]),
      createdAt: at,
      updatedAt: at,
    })
    return { record: publishRecord(dir, record), outcome: 'created', code: null }
  }

  function enterRunning(input: EnterRunningInput): SettlementWriteResult {
    if (!isPlainObject(input)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', 'enterRunning requires an input object')
    }
    const executionId = requireString(input.executionId, 'executionId')
    const at = requireTimestamp(input.at, 'at')
    const observation = freezeObservation(input.observation)
    assertSameExecution(executionId, observation.executionId, 'observation.executionId')
    const existing = readRecord(dir, executionId)
    if (existing === null) {
      throw refusal('SETTLEMENT_NOT_FOUND', `no settlement record for execution '${executionId}' — an execution must be admitted before it can run`, {
        executionId,
      })
    }
    const factsDigest = digestOf({ kind: 'running', facts: { executionId, observation } })
    if (existing.state === 'RUNNING') {
      const last = existing.transitions[existing.transitions.length - 1]
      if (last !== undefined && last.factsDigest === factsDigest) {
        return { record: existing, outcome: 'duplicate', code: 'DUPLICATE_SETTLEMENT' }
      }
      throw refusal('SETTLEMENT_CONFLICT', `execution '${executionId}' is already RUNNING with different facts`, {
        executionId,
      })
    }
    assertLegalTransition(existing.state, 'RUNNING')
    assertTimestampMonotonic(existing, at)
    if (existing.admission.decision !== 'allow') {
      throw refusal(
        'SETTLEMENT_ADMISSION_MISMATCH',
        `execution '${executionId}' cannot enter RUNNING: its referenced decision is recorded as 'deny'`,
        { executionId, decisionId: existing.admission.decisionId },
      )
    }
    if (observation.dispatch === 'not-started') {
      throw refusal('SETTLEMENT_INPUT_INVALID', "enterRunning requires dispatch !== 'not-started'", { executionId })
    }
    assertEffectSummary(observation)
    const transition = nextTransition(existing, 'RUNNING', at, null, [], factsDigest)
    return {
      record: publishRecord(dir, withTransition(existing, transition, { observation })),
      outcome: 'transitioned',
      code: null,
    }
  }

  function recordStop(input: RecordStopInput): SettlementWriteResult {
    if (!isPlainObject(input)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', 'recordStop requires an input object')
    }
    const executionId = requireString(input.executionId, 'executionId')
    const stopId = requireString(input.stopId, 'stopId')
    const at = requireTimestamp(input.at, 'at')
    if (!STOP_PHASES.includes(input.phase)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', `stop phase '${String(input.phase)}' is not known`, { phase: input.phase })
    }
    const existing = readRecord(dir, executionId)
    if (existing === null) {
      throw refusal('SETTLEMENT_NOT_FOUND', `no settlement record for execution '${executionId}'`, { executionId })
    }
    const sameStop = existing.stops.find((stop) => stop.stopId === stopId)
    if (sameStop !== undefined) {
      if (sameStop.phase === input.phase && sameStop.at === at) {
        return { record: existing, outcome: 'duplicate', code: 'DUPLICATE_SETTLEMENT' }
      }
      throw refusal('SETTLEMENT_CONFLICT', `Stop '${stopId}' is already recorded with different facts`, {
        executionId,
        stopId,
      })
    }
    const legal =
      (input.phase === 'pre-dispatch' && existing.state === 'ADMITTED') ||
      (input.phase === 'in-flight' && existing.state === 'RUNNING') ||
      (input.phase === 'post-completion' && (existing.state === 'COMPLETED' || existing.state === 'FAILED'))
    if (!legal) {
      throw refusal(
        'ILLEGAL_STOP_TIMING',
        `a '${input.phase}' Stop cannot be recorded while the execution is ${existing.state}`,
        { executionId, phase: input.phase, state: existing.state },
      )
    }
    assertTimestampMonotonic(existing, at)
    const stop: StopRecord = Object.freeze({ stopId, at, phase: input.phase })
    return {
      // `updatedAt` stays the transition log's tip: a Stop is an additive event
      // with its own timestamp, not a state transition.
      record: publishRecord(dir, Object.freeze({ ...existing, stops: Object.freeze([...existing.stops, stop]) })),
      outcome: 'recorded',
      code: null,
    }
  }

  function settle(input: SettleInput): SettlementWriteResult {
    if (!isPlainObject(input)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', 'settle requires an input object')
    }
    const executionId = requireString(input.executionId, 'executionId')
    const at = requireTimestamp(input.at, 'at')
    if (!SETTLEMENT_STATES.includes(input.state)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', `state '${String(input.state)}' is not a known settlement state`, {
        state: input.state,
      })
    }
    const state = input.state
    if (!(TERMINAL_SETTLEMENT_STATES as readonly SettlementState[]).includes(state)) {
      throw refusal('SETTLEMENT_INPUT_INVALID', `settle writes terminal states only; '${state}' is not terminal`, {
        state,
      })
    }
    const observation = freezeObservation(input.observation)
    assertSameExecution(executionId, observation.executionId, 'observation.executionId')
    const reason = requireString(input.reason, 'reason')
    const missingEvidence = normaliseMissingEvidence(input.missingEvidence)
    const existing = readRecord(dir, executionId)
    if (existing === null) {
      throw refusal('SETTLEMENT_NOT_FOUND', `no settlement record for execution '${executionId}'`, { executionId })
    }
    const factsDigest = digestOf({
      kind: 'settle',
      facts: { executionId, state, observation, reason, missingEvidence },
    })
    if ((TERMINAL_SETTLEMENT_STATES as readonly SettlementState[]).includes(existing.state)) {
      const last = existing.transitions[existing.transitions.length - 1]
      return settleDuplicateOrConflict(existing, last?.factsDigest, factsDigest, state)
    }
    assertLegalTransition(existing.state, state)
    assertTimestampMonotonic(existing, at)
    if (state === 'UNKNOWN') {
      if (missingEvidence.length === 0) {
        throw refusal(
          'UNCONFIRMED_WITHOUT_UNCERTAINTY',
          'an UNKNOWN settlement must name the evidence that is missing (missingEvidence is empty)',
          { executionId },
        )
      }
    } else if (missingEvidence.length > 0) {
      throw refusal('SETTLEMENT_INPUT_INVALID', `missingEvidence is only meaningful for UNKNOWN, not ${state}`, {
        state,
      })
    }
    assertTerminalObservation(state, observation, existing.admission, existing)
    const transition = nextTransition(existing, state, at, reason, missingEvidence, factsDigest)
    return {
      record: publishRecord(
        dir,
        withTransition(existing, transition, {
          observation,
          terminalReason: reason,
          missingEvidence,
        }),
      ),
      outcome: 'transitioned',
      code: null,
    }
  }

  function recoverUnsettled(at: string): readonly SettlementRecoveryResult[] {
    const timestamp = requireTimestamp(at, 'at')
    const results: SettlementRecoveryResult[] = []
    for (const record of readAll(dir)) {
      if ((TERMINAL_SETTLEMENT_STATES as readonly SettlementState[]).includes(record.state)) continue
      const missingEvidence = missingEvidenceForRecovery(record)
      const write = settle({
        executionId: record.identity.executionId,
        at: timestamp,
        ...recoverySettlementFacts(record, missingEvidence),
      })
      results.push(
        Object.freeze({
          executionId: record.identity.executionId,
          before: record.state,
          after: write.record.state,
          outcome: write.outcome,
          missingEvidence: Object.freeze([...missingEvidence]),
        }),
      )
    }
    return Object.freeze(results)
  }

  function read(executionId: string): ExecutionSettlementRecord | null {
    return readRecord(dir, requireString(executionId, 'executionId'))
  }

  function list(): readonly ExecutionSettlementRecord[] {
    return readAll(dir)
  }

  return Object.freeze({ dir, recordAdmission, enterRunning, recordStop, settle, recoverUnsettled, read, list })
}

function readAll(dir: string): readonly ExecutionSettlementRecord[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return Object.freeze([])
    throw refusal('SETTLEMENT_CORRUPT', `could not list the settlement directory ${dir}`, {
      dir,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  const records: ExecutionSettlementRecord[] = []
  for (const name of [...names].sort()) {
    // In-progress writes are never candidates: a temp file is not a record.
    if (!name.endsWith(SETTLEMENT_RECORD_SUFFIX)) continue
    const executionId = name.slice(0, name.length - SETTLEMENT_RECORD_SUFFIX.length)
    const record = readRecord(dir, executionId)
    if (record !== null) records.push(record)
  }
  return Object.freeze(records)
}
