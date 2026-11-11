/**
 * `a5p5-tools` Phase 2 — the ONE pipeline both backend paths share:
 * derive effects (read-time, Phase 1) → admission verdict (injected) →
 * execute against a backend → settle the lease → spill attribution →
 * render (Phase 1). Because there is exactly ONE pipeline, backend choice can
 * NEVER change a judgement or a rendering — and `test/a5p5-parity.test.ts`
 * pins that claim over the fixture matrix, direct vs contract stub.
 *
 * ORDER LAWS pinned here:
 *  - schema refusal / policy deny happen BEFORE anything else runs: no sink
 *    is opened, the backend is not called (deny-before-backend, the same
 *    shape as the PR5 host law "deny-before-spawn");
 *  - the lease settles exactly once with the backend's settlement fact; a
 *    backend that produced no outcome settles `outcome-unreadable` (the
 *    honest "no fact" class), never a fake completion;
 *  - the spill sink is written ONLY by the executing body while the lease is
 *    ACTIVE; the pipeline records the terminal fact (finalize) and closes;
 *  - the presentation is drawn by the Phase 1 renderer alone — raw payload
 *    bytes reach the model surface only through it, the spill file being
 *    DATA behind a read-time authorization re-check.
 *
 * Purity: no `node:*`, no I/O, no clock (the backend does its own).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/pipeline
 */

import type { RequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import type { ToolContractProblem } from '../../../domain/tool-governance/src/parse-util.js'
import { deepFreezeContracts } from '../../../domain/tool-governance/src/parse-util.js'
import { UNREADABLE_SETTLEMENT, type BackendFailure, type ToolCancelSignal, type ToolEffectBackend } from './backend-contract.js'
import { deriveToolEffectSet } from './effects-schema.js'
import { RenderClosedValueViolation, renderSearchResult, renderShellResult } from './render.js'
import { createSpillLease, type LeaseSettlement, type SpillRefusal, type SpillSink, type SpillStore } from './spill.js'
import type { ParsedToolArgs, RenderedPresentation, SearchOutcome, ShellOutcome } from './types.js'

/** The admission verdict this lane consumes (the decision lives elsewhere — no second authorization fact). */
export type AdmissionVerdict = { readonly kind: 'allow' } | { readonly kind: 'deny'; readonly code: string }

/** M1 CENTER PA WIRING (frozen A): the ASYNC production admission edge. The
 *  synchronous lane `decide` above is a fast deny path, NEVER an ask stand-in:
 *  a call that survives it still has to pass `pa` — the injected PA kernel
 *  edge (admitCall → real Control ask when required → issueApprovedGrant →
 *  one-shot consume) — before ANY backend work starts. Pending/approval-denied
 *  answers here are denials with distinct codes; there is no silent allow and
 *  no second authorization fact below this seam. */
export type PaVerdict = { readonly kind: 'allow' } | { readonly kind: 'deny'; readonly code: string; readonly detail?: string }
export type PaAdmitEdge = (request: {
  readonly realmId: string
  readonly callId: string
  readonly parametersFingerprint: string
  readonly requestedEffects: RequestedEffectSet
}) => Promise<PaVerdict>

export interface ToolCallRequest {
  readonly realmId: string
  readonly callId: string
  readonly parsedArgs: ParsedToolArgs
  /** M1: the canonical parameter fingerprint (Alpha.2 canonical-operation law), computed by the assembly owner; the plane mount always states it, archived kit rows may omit it (the edge then falls back to the effect-set fingerprint — same fact for the same call, never a guess across calls). */
  readonly parametersFingerprint?: string
  /** B3 ADDITIVE: the host cancel signal, carried to the backend untouched (the pipeline itself acts on NOTHING — cancel is the row's fact, not a second authorization here). */
  readonly signal?: ToolCancelSignal
  /** 9e-1 ADDITIVE: the host execution CONTEXT the caller carries — its
   *  `tokenKey` is the ledger STRING standing for the real per-execution
   *  token (the token identity itself never travels as text). Carried like
   *  `signal`: consumers sit on the plane/backend side; the pipeline acts on
   *  NOTHING from it. */
  readonly exec?: { readonly tokenKey?: string }
  /** U7-6 GLUE-4 ADDITIVE: the governed root of an ANCHORED row (trusted,
   *  assembly-injected — never model-visible). Present ⇒ the search arms of
   *  the derived set claim the governed walk surface (`effects-schema`
   *  anchored law); absent ⇒ the historical target-scoped derivation,
   *  byte-identical. The pipeline just forwards it to the derivation. */
  readonly effectAnchorRoot?: string
}

export interface RunToolCallDeps {
  readonly request: ToolCallRequest
  readonly decide: (effectSet: RequestedEffectSet) => AdmissionVerdict
  /** M1 PA edge; ABSENT only for the archived pre-M1 kit rows — the plane production mount always injects it. */
  readonly pa?: PaAdmitEdge
  readonly backend: ToolEffectBackend
  readonly spill?: { readonly store: SpillStore }
  /** Optional A6 execution-result observation: called ONCE after the backend
   *  answered (success or failure), with the callId. It observes only; it can
   *  never change the result. Refused paths (schema/admission/PA/cancel before
   *  the body) do not call it: no body was admitted, so there is no execution
   *  to report.
   *
   *  The outcome vocabulary is the Control ledger's own
   *  (`succeeded | failed | unknown`), and it means EXECUTION, not authorization:
   *  `succeeded` is reserved for a body whose end was observed; a cancelled or
   *  timed-out body reports `unknown` (it started, its end was never observed —
   *  separately from whether it produced side effects). */
  readonly onExecutionResult?: (input: {
    readonly callId: string
    readonly outcome: 'succeeded' | 'failed' | 'unknown'
  }) => void
}

/**
 * PD-41 (owner ruling 2026-11-11) — the execution-fact outcome of an ANSWERED
 * backend call. `result.ok` is the backend's "I answered" bit; it is NOT "the
 * body completed". A shell the host cancelled (or killed at its timeout)
 * answers `ok: true` with `cancelled: true` / `timedOut: true` and
 * `exitCode: null` — the payload never reported an end (see
 * `process-family/src/confined-shell-executor.mjs`, whose settlement for that
 * arm is `{kind:'cancelled'}`). Recording that as `succeeded` would state a
 * completion nobody measured: the measured shape was
 * `cancelled=true exit=not-observed` in the shell log next to a durable
 * `succeeded`, with no side effect on disk.
 *
 * The honest value is the ledger's existing `unknown` — the body was admitted
 * and may have had effects, but its end was never observed. This invents no
 * new outcome and changes no admission, consumption or replay behaviour.
 */
export function executionOutcomeOfAnsweredCall(
  result: {
    readonly ok: true
    readonly outcome: SearchOutcome | ShellOutcome
    /** Carried by the real backend answer; not consulted here (the outcome is). */
    readonly settlement?: unknown
  },
): 'succeeded' | 'unknown' {
  const outcome = result.outcome as { readonly cancelled?: boolean; readonly timedOut?: boolean }
  return outcome.cancelled === true || outcome.timedOut === true ? 'unknown' : 'succeeded'
}

export interface SpillPointerFact {
  readonly spillId: string
  readonly bytes: number
}

export type ToolCallResult =
  | { readonly kind: 'refused-schema'; readonly problems: readonly ToolContractProblem[] }
  | { readonly kind: 'refused-admission'; readonly effectFingerprint: string; readonly denyCode: string }
  | { readonly kind: 'refused-spill'; readonly refusal: SpillRefusal }
  | { readonly kind: 'backend-failed'; readonly failure: BackendFailure; readonly settlement: LeaseSettlement }
  | {
      readonly kind: 'presented'
      readonly effectFingerprint: string
      readonly settlement: LeaseSettlement
      readonly rendered: RenderedPresentation
      readonly spill: SpillPointerFact | null
    }

export async function runToolCall(deps: RunToolCallDeps): Promise<ToolCallResult> {
  const { request } = deps

  const derived = deriveToolEffectSet(request.realmId, request.parsedArgs, request.effectAnchorRoot)
  if (!derived.ok) return deepFreezeContracts({ kind: 'refused-schema', problems: derived.problems })

  const verdict = deps.decide(derived.value)
  if (verdict.kind === 'deny') {
    // deny BEFORE backend: no sink opened, no backend call, no residue.
    return deepFreezeContracts({ kind: 'refused-admission', effectFingerprint: derived.value.fingerprint, denyCode: verdict.code })
  }

  if (deps.pa !== undefined) {
    // 9e fix-1 (A2 law at the trio edge): an ALREADY-aborted invocation is
    // settled `cancelled` BEFORE the PA edge — zero PA touch, zero
    // consumption, zero backend (the plane's paAdmit pre-leg answers the
    // same fact; a caller that never reaches the plane honors it here).
    const preAborted = request.signal?.aborted === true
    const pa = preAborted ? ({ kind: 'allow', cancelled: true } as const) : await deps.pa({
      realmId: request.realmId,
      callId: request.callId,
      parametersFingerprint: request.parametersFingerprint ?? derived.value.fingerprint,
      requestedEffects: derived.value,
      // PR358 fix-4: the host cancel signal rides the PA edge too — the
      // approval wait and the pre-consume check must honor the same
      // invocation cancellation the backend row honors.
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    })
    if (pa.kind === 'allow' && (pa as { cancelled?: boolean }).cancelled === true) {
      // PR358 fix-4: cancelled at the PA edge — zero backend, zero PA
      // consumption. The settled fact is rendered through the row's OWN
      // cancel renderer (empty stdout = nothing was observed; the a5p5-meta
      // tail stays on the wire — the presentation law does not fork).
      return deepFreezeContracts({
        kind: 'presented',
        settlement: { kind: 'cancelled' as const, event: 'dispatcher-call-cancelled-before-body' as const },
        rendered: request.parsedArgs.tool === 'bash'
          ? renderShellResult({ exitCode: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false })
          : renderSearchResult({
              // the cancelled search wears the request's OWN output mode
              outputMode: request.parsedArgs.tool === 'glob' ? 'files_with_matches' : request.parsedArgs.outputMode,
              matches: [],
              counts: [],
              files: [],
              totalMatches: 0,
              truncated: false,
              cancelled: true,
            }),
        spill: null,
        effectFingerprint: derived.value.fingerprint,
      } as const)
    }
    if (pa.kind === 'deny') {
      // PA denial BEFORE the backend — pending approval, a refused approval
      // and a policy deny are all ZERO-body facts; the code distinguishes
      // them on the audit line, never the wire shape.
      return deepFreezeContracts({ kind: 'refused-admission', effectFingerprint: derived.value.fingerprint, denyCode: pa.code })
    }
  }

  const lease = createSpillLease()
  let sink: SpillSink | null = null
  if (deps.spill) {
    const spillId = `${request.parsedArgs.tool}-${request.callId}`
    const opened = deps.spill.store.openSink({ spillId, lease, attribution: { realmId: request.realmId, tool: request.parsedArgs.tool, callId: request.callId } })
    if (!opened.ok) return deepFreezeContracts({ kind: 'refused-spill', refusal: opened.refusal })
    sink = opened.sink
  }

  let result: Awaited<ReturnType<ToolEffectBackend['run']>>
  try {
    result = await deps.backend.run(
      {
        realmId: request.realmId,
        callId: request.callId,
        parsedArgs: request.parsedArgs,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      },
      { lease, sink },
    )
  } catch (error) {
    // A THROW is a terminal execution outcome too: the call was admitted and
    // consumed, and the backend refused/aborted before answering. Report it
    // ONCE as `failed` (observation only), then rethrow unchanged — the row's
    // own presentation error stays the caller's fact.
    deps.onExecutionResult?.({ callId: request.callId, outcome: 'failed' })
    throw error
  }

  // PD-41: an ANSWERED call is not automatically a COMPLETED one — the outcome
  // helper keeps a cancelled/timed-out body at `unknown` instead of claiming a
  // completion its own rendered shape contradicts.
  deps.onExecutionResult?.({
    callId: request.callId,
    outcome: result.ok ? executionOutcomeOfAnsweredCall(result) : 'failed',
  })
  const settlement: LeaseSettlement = result.ok ? result.settlement : UNREADABLE_SETTLEMENT
  const settled = lease.settle(settlement)
  if (!settled.ok) return deepFreezeContracts({ kind: 'refused-spill', refusal: settled.refusal })
  if (sink) sink.finalize(settlement)
  lease.close()

  if (!result.ok) return deepFreezeContracts({ kind: 'backend-failed', failure: result.failure, settlement })

  const pointer: SpillPointerFact | null = sink && sink.bytes() > 0 ? { spillId: sink.spillId, bytes: sink.bytes() } : null
  let rendered
  try {
    rendered = 'outputMode' in result.outcome
      ? renderSearchResult(result.outcome as SearchOutcome, { spill: pointer ?? undefined })
      : renderShellResult(result.outcome as ShellOutcome, { spill: pointer ?? undefined })
  } catch (error) {
    // Lane D ③ (wiring gate): a backend result carrying a value outside a
    // renderer closed set is a CLOSED-SET violation, not a crash and not a
    // presentation — typed `denied`, nothing presented, the settled residue
    // (if any) stays where the cancel law put it.
    if (error instanceof RenderClosedValueViolation) {
      return deepFreezeContracts({
        kind: 'backend-failed',
        failure: { class: 'denied', code: 'outcome-outside-closed-set', detail: error.message },
        settlement,
      })
    }
    throw error
  }
  return deepFreezeContracts({ kind: 'presented', effectFingerprint: derived.value.fingerprint, settlement, rendered, spill: pointer })
}
