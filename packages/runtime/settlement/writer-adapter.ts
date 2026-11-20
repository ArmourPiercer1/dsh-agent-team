/**
 * Writer adapter — the UTE-1 `ExecutionSettlementWriter` contract, implemented
 * over the canonical settlement store.
 *
 * WHAT THIS IS. `docs/plans/memo/ute-g1-20261120/CONTRACT.md` §3 fixes one
 * interface (the "writer") and one fact shape (`ExecutionFact`). The store in
 * `./execution-settlement.js` is the durable fact owner but exposes a richer,
 * transition-oriented surface (recordAdmission / enterRunning / settle / …).
 * This module is the thin, structural adapter: it accepts the contract shape
 * verbatim and derives the store transition the fact implies.
 *
 * WHAT IT IS NOT — READ-COMPAT BOUNDARY, EXPLICIT.
 *   `projectControlResult` is a *projection*, never a second writer. It maps an
 *   already-durable settlement fact to the answer an existing
 *   `ControlService.recordExecutionResult({rootSessionId, callId, instanceId?,
 *   outcome})` reader would have received: `{recorded, requestId?}`. It does NOT
 *   import `packages/runtime/control`, does NOT write a `control-execution-result`
 *   row, does NOT mint/consume/extend a Grant, and does NOT decide anything.
 *   Where the triple does not resolve to exactly one terminal fact, or the
 *   settled outcome disagrees with the requested one, or the fact does not
 *   reference exactly ONE control request, it returns `{recorded:false}` with a
 *   name — it never fabricates a `requestId`. The boundary is therefore:
 *   READ-COMPATIBLE with the control result view; NOT a replacement for
 *   `ControlService`, and NOT an authorization surface.
 *
 * S1 ONLY. `listUnsettled` is the S1 completeness surface ("admission durable,
 * no terminal fact yet"). S2 — durable commit before the model sees
 * `tool/result` — is NOT claimed here and is not implementable without a public
 * awaitable Host seam; that gap is a `CORE_SEAM_BLOCKER`, never a fork and
 * never a `tools/result` listener dressed up as an ordering proof.
 *
 * ADMISSION PROVENANCE. A contract fact carries `controlRequestIds`, not a
 * verdict. When the adapter has to open a record it therefore records a
 * REFERENCE-ONLY admission (the request-id list, or the explicit absence of any
 * request leg). It never writes `decision: 'allow' | 'deny'` — that value exists
 * only when the ControlService itself supplied it to the store.
 *
 * @module @dsh-agent-team/runtime/settlement
 */
import { createHash } from 'node:crypto'

// TYPE-ONLY: erased at runtime. The adapter deliberately has NO runtime import
// from the store module (or from anywhere else): it is a structural adapter, and
// that keeps it loadable by Node's type-stripping straight from `.ts` as well as
// from the emitted `.js` — and it is one more reason it cannot reach the control
// plane.
import type {
  AdmissionReference,
  ContractBodyOutcome,
  ContractDispatchState,
  ContractEffectEvidence,
  ContractExecutionFact,
  ContractHostResult,
  ContractRecovery,
  ExecutionObservation,
  ExecutionSettlementRecord,
  ExecutionSettlementStore,
  SettlementState,
} from './execution-settlement.js'

/** Contract dispatch vocabulary (identical to the store's phase vocabulary). */
export type DispatchState = ContractDispatchState
/** Contract body-outcome vocabulary (no `not-started`: a fact is about a body). */
export type FactBodyOutcome = ContractBodyOutcome
/** Contract effect-evidence vocabulary. */
export type FactEffectEvidence = ContractEffectEvidence
/** One physical execution attempt = one ExecutionId = at most one terminal fact. */
export type ExecutionFact = ContractExecutionFact

/** The contract interface, verbatim. */
export interface ExecutionSettlementWriter {
  record(fact: ExecutionFact): Promise<{ recorded: boolean; reason?: string }>
  read(executionId: string): Promise<ExecutionFact | undefined>
  listUnsettled(rootSessionId: string): Promise<readonly string[]>
  projectControlResult(args: {
    readonly rootSessionId: string
    readonly callId: string
    readonly instanceId?: string
    readonly outcome: 'succeeded' | 'failed' | 'unknown'
  }): Promise<{ recorded: boolean; requestId?: string; reason?: string }>
}

/** A clock, injectable so tests can pin `recovery.at` on derived reads. */
export type SettlementClock = () => string

/** Terminal states, duplicated structurally (no runtime import from the store). */
const TERMINAL_STATES: readonly SettlementState[] = Object.freeze([
  'COMPLETED',
  'REFUSED',
  'FAILED',
  'CANCELLED',
  'UNKNOWN',
])

/** A local refusal: `code` is what callers see through `{ recorded:false, reason }`. */
class AdapterRefusal extends Error {
  readonly code: string
  readonly details: Readonly<Record<string, unknown>>
  constructor(code: string, detail: string, details: Record<string, unknown> = {}) {
    super(`execution-settlement-writer: ${code} — ${detail}`)
    this.name = 'AdapterRefusal'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

/** Canonical JSON identical to the store's (sorted keys, undefined → null). */
function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/
const CONTRACT_DISPATCH: readonly ContractDispatchState[] = Object.freeze([
  'not-started',
  'started',
  'quiesced',
  'termination-unconfirmed',
])
const CONTRACT_BODY_OUTCOMES: readonly ContractBodyOutcome[] = Object.freeze(['completed', 'failed', 'unknown'])
const CONTRACT_EFFECT_EVIDENCE: readonly ContractEffectEvidence[] = Object.freeze([
  'none-confirmed',
  'possible',
  'observed',
  'unknown',
])
const CONTROL_OUTCOMES: readonly ('succeeded' | 'failed' | 'unknown')[] = Object.freeze([
  'succeeded',
  'failed',
  'unknown',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function digestOf(value: unknown): string {
  return sha256Hex(canonicalJson(value))
}

function refuse(code: string, detail: string, details: Record<string, unknown> = {}): never {
  throw new AdapterRefusal(code, detail, details)
}

function requireText(value: unknown, field: string, max = 512): string {
  if (typeof value !== 'string' || value.length === 0) refuse('SETTLEMENT_INPUT_INVALID', `${field} must be a non-empty string`, { field })
  if ((value as string).length > max) refuse('SETTLEMENT_INPUT_INVALID', `${field} is longer than ${max} characters`, { field })
  return value as string
}

function isTerminal(state: SettlementState): boolean {
  return TERMINAL_STATES.includes(state)
}

/** Duck-typed refusal code: store refusals and adapter refusals both carry one. */
function refusalCodeOf(error: unknown): string | null {
  if (isPlainObject(error) || typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

/** The comparable core of a fact: everything except when it was recorded and
 *  the recovery note. A second write with the same core is the SAME fact. */
function factCore(fact: ExecutionFact): Record<string, unknown> {
  return {
    executionId: fact.executionId,
    rootSessionId: fact.rootSessionId,
    agentInstanceId: fact.agentInstanceId,
    hostCallId: fact.hostCallId,
    parentExecutionId: fact.parentExecutionId,
    controlRequestIds: [...fact.controlRequestIds],
    dispatch: fact.dispatch,
    bodyOutcome: fact.bodyOutcome,
    effectEvidence: fact.effectEvidence,
    hostResult: fact.hostResult,
  }
}

function factCoreDigest(fact: ExecutionFact): string {
  return digestOf(factCore(fact))
}

/** Validate + freeze a contract fact. Structural only; never a decision. */
function freezeFact(input: ExecutionFact): ExecutionFact {
  if (!isPlainObject(input)) refuse('SETTLEMENT_INPUT_INVALID', 'record requires an ExecutionFact object')
  const executionId = requireText(input.executionId, 'fact.executionId', 200)
  const rootSessionId = requireText(input.rootSessionId, 'fact.rootSessionId')
  const agentInstanceId = requireText(input.agentInstanceId, 'fact.agentInstanceId')
  const hostCallId = input.hostCallId === undefined ? undefined : requireText(input.hostCallId, 'fact.hostCallId')
  const parentExecutionId =
    input.parentExecutionId === undefined ? undefined : requireText(input.parentExecutionId, 'fact.parentExecutionId')
  if (!Array.isArray(input.controlRequestIds)) {
    refuse('SETTLEMENT_INPUT_INVALID', 'fact.controlRequestIds must be an array')
  }
  const controlRequestIds = (input.controlRequestIds as readonly string[]).map((id, index) =>
    requireText(id, `fact.controlRequestIds[${index}]`),
  )
  if (!CONTRACT_DISPATCH.includes(input.dispatch)) {
    refuse('SETTLEMENT_INPUT_INVALID', `fact.dispatch '${String(input.dispatch)}' is not a contract dispatch state`, {
      dispatch: input.dispatch,
    })
  }
  if (!CONTRACT_BODY_OUTCOMES.includes(input.bodyOutcome)) {
    refuse('SETTLEMENT_INPUT_INVALID', `fact.bodyOutcome '${String(input.bodyOutcome)}' is not a contract body outcome`, {
      bodyOutcome: input.bodyOutcome,
    })
  }
  if (!CONTRACT_EFFECT_EVIDENCE.includes(input.effectEvidence)) {
    refuse(
      'SETTLEMENT_INPUT_INVALID',
      `fact.effectEvidence '${String(input.effectEvidence)}' is not a contract evidence grade`,
      { effectEvidence: input.effectEvidence },
    )
  }
  let hostResult: ContractHostResult | undefined
  if (input.hostResult !== undefined) {
    if (!isPlainObject(input.hostResult) || typeof input.hostResult.isError !== 'boolean') {
      refuse('SETTLEMENT_INPUT_INVALID', 'fact.hostResult must be { isError: boolean, errorCode?: string }')
    }
    const errorCode =
      input.hostResult.errorCode === undefined ? undefined : requireText(input.hostResult.errorCode, 'fact.hostResult.errorCode')
    hostResult = Object.freeze({ isError: input.hostResult.isError, ...(errorCode === undefined ? {} : { errorCode }) })
  }
  let recovery: ContractRecovery | undefined
  if (input.recovery !== undefined) {
    if (!isPlainObject(input.recovery)) refuse('SETTLEMENT_INPUT_INVALID', 'fact.recovery must be an object')
    recovery = Object.freeze({
      reconciledFrom: requireText(input.recovery.reconciledFrom, 'fact.recovery.reconciledFrom'),
      at: requireText(input.recovery.at, 'fact.recovery.at'),
      detail: requireText(input.recovery.detail, 'fact.recovery.detail'),
    })
  }
  const recordedAt = requireText(input.recordedAt, 'fact.recordedAt')
  if (!ISO_TIMESTAMP_RE.test(recordedAt)) {
    refuse('SETTLEMENT_INPUT_INVALID', 'fact.recordedAt must be an ISO-8601 UTC timestamp ending in Z', { recordedAt })
  }
  return Object.freeze({
    executionId,
    rootSessionId,
    agentInstanceId,
    ...(hostCallId === undefined ? {} : { hostCallId }),
    ...(parentExecutionId === undefined ? {} : { parentExecutionId }),
    controlRequestIds: Object.freeze(controlRequestIds),
    dispatch: input.dispatch,
    bodyOutcome: input.bodyOutcome,
    effectEvidence: input.effectEvidence,
    ...(hostResult === undefined ? {} : { hostResult }),
    recordedAt,
    ...(recovery === undefined ? {} : { recovery }),
  })
}

/**
 * The admission a fact carries: a REFERENCE, never a verdict.
 *
 * - request legs present → `control-request-reference` over the exact list;
 * - no legs at all → `no-control-request` bound to this execution.
 *
 * The digests are computed with the same canonical JSON the store verifies.
 */
function admissionFor(fact: ExecutionFact): AdmissionReference {
  if (fact.controlRequestIds.length > 0) {
    const requestIds = Object.freeze([...fact.controlRequestIds])
    return Object.freeze({
      admissionKind: 'control-request-reference',
      decisionId: requestIds[0] as string,
      decisionDigest: digestOf({
        kind: 'control-request-reference',
        subjectExecutionId: fact.executionId,
        requestIds,
      }),
      decisionKind: 'control-request-reference',
      subjectExecutionId: fact.executionId,
      requestIds,
      decidedAt: fact.recordedAt,
    })
  }
  return Object.freeze({
    admissionKind: 'no-control-request',
    decisionId: 'no-control-request',
    decisionDigest: digestOf({ kind: 'no-control-request', subjectExecutionId: fact.executionId }),
    decisionKind: 'no-control-request',
    subjectExecutionId: fact.executionId,
    decidedAt: fact.recordedAt,
  })
}

function identityFor(fact: ExecutionFact): {
  executionId: string
  toolName: string
  actorId: string
  worldId: string
} {
  return Object.freeze({
    executionId: fact.executionId,
    toolName: fact.hostCallId ?? 'unspecified',
    actorId: fact.agentInstanceId,
    worldId: fact.rootSessionId,
  })
}

/** The store's recovery reason, duplicated so the adapter keeps no runtime import. */
const RECOVERY_TERMINAL_REASON = 'PROCESS_TERMINATED_WITHOUT_OUTCOME'

/** The fact a durable record already represents (contract snapshot or derived). */
function factOf(record: ExecutionSettlementRecord, clock: SettlementClock): ExecutionFact {
  const last = record.transitions[record.transitions.length - 1]
  if (record.contractFact !== undefined) {
    // Recovery APPENDS evidence; it never rewrites the recorded fact. A reader
    // therefore sees the reconciliation note even though the snapshot on disk
    // (written by the settle) has none.
    if (
      record.contractFact.recovery === undefined &&
      record.state === 'UNKNOWN' &&
      record.terminalReason === RECOVERY_TERMINAL_REASON
    ) {
      return Object.freeze({
        ...record.contractFact,
        recovery: Object.freeze({
          reconciledFrom: last?.from ?? 'ADMITTED',
          at: clock(),
          detail: record.terminalReason,
        }),
      })
    }
    return record.contractFact
  }
  const recovery: ContractRecovery | undefined =
    record.state === 'UNKNOWN' && record.terminalReason !== null
      ? {
          reconciledFrom: last?.from ?? 'ADMITTED',
          at: clock(),
          detail: record.terminalReason,
        }
      : undefined
  const admissionRequestIds =
    record.admission.requestIds === undefined ? [] : [...record.admission.requestIds]
  return Object.freeze({
    executionId: record.identity.executionId,
    rootSessionId: record.identity.worldId,
    agentInstanceId: record.identity.actorId,
    ...(record.identity.toolName === 'unspecified' ? {} : { hostCallId: record.identity.toolName }),
    controlRequestIds: Object.freeze(admissionRequestIds),
    dispatch: record.observation.dispatch,
    bodyOutcome:
      record.observation.bodyOutcome === 'not-started' ? 'unknown' : record.observation.bodyOutcome,
    effectEvidence: record.observation.effectEvidence,
    recordedAt: record.createdAt,
    ...(recovery === undefined ? {} : { recovery: Object.freeze(recovery) }),
  })
}

/** The snapshot an ADMITTED record may carry: the fact before anything entered. */
function admissionProjection(fact: ExecutionFact): ExecutionFact {
  const { hostResult: _hostResult, recovery: _recovery, ...rest } = fact
  return Object.freeze({
    ...rest,
    dispatch: 'not-started',
    bodyOutcome: 'unknown',
    effectEvidence: 'none-confirmed',
  })
}

/** The snapshot a RUNNING record may carry: dispatch entered, body still open. */
function runningProjection(fact: ExecutionFact): ExecutionFact {
  const { hostResult: _hostResult, recovery: _recovery, ...rest } = fact
  return Object.freeze({ ...rest, bodyOutcome: 'unknown' })
}

/** The store observation a fact implies. `observed` needs an evidence id: the
 *  declaring fact's digest, with a named fact-level effect kind. */
function observationFor(fact: ExecutionFact): ExecutionObservation {
  const declared = factCoreDigest(fact)
  return {
    executionId: fact.executionId,
    dispatch: fact.dispatch,
    bodyOutcome: fact.dispatch === 'not-started' ? 'not-started' : fact.bodyOutcome,
    effectEvidence: fact.effectEvidence,
    observedEffects:
      fact.effectEvidence === 'observed'
        ? [
            {
              kind: 'binding-declared',
              target: fact.hostCallId ?? fact.executionId,
              evidenceId: `fact:${declared}`,
            },
          ]
        : [],
  }
}

function missingEvidenceFor(fact: ExecutionFact): readonly string[] {
  const missing: string[] = []
  if (fact.dispatch === 'not-started') {
    missing.push('dispatch-confirmation', 'terminal-observation')
  } else {
    missing.push('terminal-observation', 'host-result', 'backend-receipt')
    if (fact.dispatch === 'termination-unconfirmed') missing.push('effect-evidence')
  }
  if (fact.effectEvidence === 'unknown') missing.push('effect-evidence')
  return Object.freeze([...new Set(missing)])
}

interface DerivedTarget {
  readonly kind: 'admitted-only' | 'terminal'
  readonly state?: SettlementState
  readonly fromRunning?: boolean
  readonly reason?: string
  readonly missingEvidence?: readonly string[]
}

/** The single store transition a fact implies. Illegal shapes are refused. */
function deriveTarget(fact: ExecutionFact): DerivedTarget {
  if (fact.dispatch === 'not-started') {
    if (fact.bodyOutcome === 'unknown') return { kind: 'admitted-only' }
    if (fact.bodyOutcome === 'completed') {
      refuse('SETTLEMENT_INPUT_INVALID', 'a fact cannot report a completed body with dispatch not-started', {
        executionId: fact.executionId,
      })
    }
    // failed before dispatch = a refusal/cancellation with zero effect.
    return {
      kind: 'terminal',
      state: 'REFUSED',
      fromRunning: false,
      reason: 'fact-refused-before-dispatch',
      missingEvidence: Object.freeze([]),
    }
  }
  const state: SettlementState =
    fact.bodyOutcome === 'completed' ? 'COMPLETED' : fact.bodyOutcome === 'failed' ? 'FAILED' : 'UNKNOWN'
  return {
    kind: 'terminal',
    state,
    fromRunning: true,
    reason: `fact-${fact.bodyOutcome}`,
    missingEvidence: state === 'UNKNOWN' ? missingEvidenceFor(fact) : Object.freeze([]),
  }
}

function failure(error: unknown): { recorded: false; reason: string } {
  const code = refusalCodeOf(error)
  if (code !== null) return { recorded: false, reason: code }
  if (error instanceof Error) return { recorded: false, reason: `INTERNAL:${error.message}` }
  return { recorded: false, reason: 'INTERNAL:unknown' }
}

/**
 * Build the contract writer over an existing store.
 *
 * `clock` is only used when a fact has to be DERIVED from a record the adapter
 * did not write (e.g. an admission recorded by the control wiring, or a
 * recovery). Durable timestamps always come from the store record.
 */
export function createExecutionSettlementWriter(
  store: ExecutionSettlementStore,
  clock: SettlementClock = () => new Date().toISOString(),
): ExecutionSettlementWriter {
  if (typeof store?.read !== 'function' || typeof store?.list !== 'function') {
    refuse('SETTLEMENT_INPUT_INVALID', 'createExecutionSettlementWriter requires an ExecutionSettlementStore')
  }
  if (typeof clock !== 'function') {
    refuse('SETTLEMENT_INPUT_INVALID', 'the clock must be a function returning an ISO-8601 timestamp')
  }

  async function record(fact: ExecutionFact): Promise<{ recorded: boolean; reason?: string }> {
    let frozen: ExecutionFact
    try {
      frozen = freezeFact(fact)
    } catch (error) {
      return failure(error)
    }
    try {
      const existing = store.read(frozen.executionId)
      if (existing !== null) {
        if (
          existing.identity.actorId !== frozen.agentInstanceId ||
          existing.identity.worldId !== frozen.rootSessionId
        ) {
          refuse(
            'SETTLEMENT_CROSS_WIRED',
            'the admission for this ExecutionId belongs to a different root session / agent instance',
            {
              executionId: frozen.executionId,
              expectedRootSessionId: existing.identity.worldId,
              observedRootSessionId: frozen.rootSessionId,
              expectedAgentInstanceId: existing.identity.actorId,
              observedAgentInstanceId: frozen.agentInstanceId,
            },
          )
        }
        if (isTerminal(existing.state)) {
          const prior = factOf(existing, clock)
          if (factCoreDigest(prior) === factCoreDigest(frozen)) {
            return { recorded: false, reason: 'DUPLICATE_SETTLEMENT' }
          }
          return { recorded: false, reason: 'SETTLEMENT_CONFLICT' }
        }
      }

      const target = deriveTarget(frozen)
      if (existing === null) {
        store.recordAdmission({
          identity: identityFor(frozen),
          admission: admissionFor(frozen),
          at: frozen.recordedAt,
          contractFact: admissionProjection(frozen),
        })
      }
      if (target.kind === 'admitted-only') return { recorded: true }

      const current = store.read(frozen.executionId)
      if (current === null) refuse('SETTLEMENT_NOT_FOUND', 'the settlement record vanished between writes', {
        executionId: frozen.executionId,
      })
      if (current.state === 'ADMITTED' && target.fromRunning === true) {
        store.enterRunning({
          executionId: frozen.executionId,
          observation: observationFor(frozen),
          at: frozen.recordedAt,
          contractFact: runningProjection(frozen),
        })
      }
      const write = store.settle({
        executionId: frozen.executionId,
        state: target.state as SettlementState,
        observation: observationFor(frozen),
        at: frozen.recordedAt,
        reason: target.reason as string,
        ...(target.missingEvidence === undefined ? {} : { missingEvidence: target.missingEvidence }),
        contractFact: frozen,
      })
      if (write.outcome === 'duplicate') return { recorded: false, reason: 'DUPLICATE_SETTLEMENT' }
      return { recorded: true }
    } catch (error) {
      return failure(error)
    }
  }

  async function read(executionId: string): Promise<ExecutionFact | undefined> {
    let id: string
    try {
      id = requireText(executionId, 'executionId')
    } catch {
      return undefined
    }
    const record = store.read(id)
    if (record === null) return undefined
    return factOf(record, clock)
  }

  async function listUnsettled(rootSessionId: string): Promise<readonly string[]> {
    const root = requireText(rootSessionId, 'rootSessionId')
    return Object.freeze(
      store
        .list()
        .filter((record) => record.identity.worldId === root && !isTerminal(record.state))
        .map((record) => record.identity.executionId),
    )
  }

  async function projectControlResult(args: {
    readonly rootSessionId: string
    readonly callId: string
    readonly instanceId?: string
    readonly outcome: 'succeeded' | 'failed' | 'unknown'
  }): Promise<{ recorded: boolean; requestId?: string; reason?: string }> {
    let root: string
    let callId: string
    let instanceId: string | undefined
    try {
      if (!isPlainObject(args)) refuse('SETTLEMENT_INPUT_INVALID', 'projectControlResult requires an argument object')
      root = requireText(args.rootSessionId, 'rootSessionId')
      callId = requireText(args.callId, 'callId')
      instanceId = args.instanceId === undefined ? undefined : requireText(args.instanceId, 'instanceId')
      if (!CONTROL_OUTCOMES.includes(args.outcome)) {
        refuse('SETTLEMENT_INPUT_INVALID', `outcome '${String(args.outcome)}' is not succeeded|failed|unknown`, {
          outcome: args.outcome,
        })
      }
    } catch (error) {
      return failure(error)
    }

    const matches = store.list().filter((record) => {
      const fact = factOf(record, clock)
      if (fact.rootSessionId !== root) return false
      if (fact.hostCallId !== callId) return false
      if (instanceId !== undefined && fact.agentInstanceId !== instanceId) return false
      return true
    })
    if (matches.length === 0) return { recorded: false, reason: 'PROJECTION_UNMATCHED' }
    if (matches.length > 1) return { recorded: false, reason: 'PROJECTION_AMBIGUOUS' }
    const record = matches[0] as ExecutionSettlementRecord
    if (!isTerminal(record.state)) return { recorded: false, reason: 'PROJECTION_UNSETTLED' }

    const fact = factOf(record, clock)
    const expectedOutcome: FactBodyOutcome =
      args.outcome === 'succeeded' ? 'completed' : args.outcome === 'failed' ? 'failed' : 'unknown'
    if (fact.bodyOutcome !== expectedOutcome) {
      return { recorded: false, reason: 'PROJECTION_OUTCOME_MISMATCH' }
    }
    if (fact.controlRequestIds.length === 0) {
      return { recorded: false, reason: 'PROJECTION_NO_CONTROL_REQUEST_LINK' }
    }
    if (fact.controlRequestIds.length > 1) {
      return { recorded: false, reason: 'PROJECTION_AMBIGUOUS_REQUEST_LINK' }
    }
    return { recorded: true, requestId: fact.controlRequestIds[0] as string }
  }

  return Object.freeze({ record, read, listUnsettled, projectControlResult })
}
