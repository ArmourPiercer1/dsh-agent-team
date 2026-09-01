/**
 * P8-S3 — the work execution chain (closure plan §16.2, R1–R6).
 *
 * This module owns the vertical execution chain of one admitted work unit:
 *
 *   dedup scan -> required+CAS ADMIT_WORK (CREATED/SETTLED -> RUNNING) ->
 *   `team-work-admitted` fact (prompt / attachedContext / caller / token) ->
 *   activity interval open (correlation = requestToken) ->
 *   model-visible delivery through the WorkDeliveryPort (submit + observe
 *   the child session's turn completion) ->
 *   activity interval close ->
 *   `settleAdmittedWork` (R5: the single production settlement owner) ->
 *   RUNNING -> SETTLED CAS + `member-lifecycle-changed` fact.
 *
 * The chain runs INSIDE the router's per-team lock (the caller is
 * `runEffect`, which serializes every effect of one team) — it takes no
 * lock of its own, and the injected `WorkActivityPort` is the in-facade
 * interval writer (guarded commit only, no facade stage, no second lock
 * map), so no re-entrant lock is ever acquired.
 *
 * RETRY PROTOCOL (requestToken = the stable operation identity; the
 * visible/deduped at-least-once contract, closure plan §CR2):
 *
 * - a `member-lifecycle-changed` fact with `to: 'SETTLED'` for the token
 *   EXISTS -> the work unit already completed durably: the call is a
 *   REPLAY (zero writes, zero delivery, `replayed: true`);
 * - only the `team-work-admitted` fact EXISTS -> the chain crashed between
 *   admission and settlement: the call RESUMES (no re-admission, no
 *   duplicate fact; delivery is attempted again — at-least-once on the
 *   model-visible session input, the delivered text carries the
 *   requestToken so the model can dedupe; settlement converges, see
 *   `settleAdmittedWork`);
 * - NEITHER exists -> the FULL chain.
 *
 * The TeamLedger itself is exactly-once per logical work unit: the replay
 * branch writes nothing, and the resume branch writes at most the missing
 * settlement fact (crash-window repair) plus the interval rows it still
 * owes.
 *
 * FAIL-CLOSED (R6): any fault between the admission commit and the
 * settlement (interval write fault, delivery failure, settlement fault)
 * settles the member RUNNING -> SETTLED through the same lifecycle commit
 * port — the frozen FSM has no RUNNING -> CREATED edge, and a fake RUNNING
 * success is never left behind. Delivery failures surface as
 * `WORK_DELIVERY_FAILED`; the settlement fact carries
 * `workOutcome: 'delivery-failed'` plus the fault description.
 */

import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  applyLifecycleOperation,
  isLifecycleTransitionError,
  LIFECYCLE_OPERATIONS,
} from '../../domain/lifecycle/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js'
import type {
  LifecycleCommitPort,
  WorkActivityPort,
  WorkDeliveryPort,
} from '../admission/types.js'
import type { ResolvedCaller } from '../admission/resolve.js'
import { isActivityError } from '../activity/errors.js'
import { ACTIVITY_ERROR_CODES } from '../activity/errors.js'
import { commitDurableFact } from './effects.js'

/** The durable fact families (same contract as `effects.ts`). */
const FACT_WORK_ADMITTED = 'team-work-admitted'
const FACT_LIFECYCLE_CHANGED = 'member-lifecycle-changed'

/** The fixed activity lane of admitted work units (one interval per
 *  requestToken correlation on this subject). */
export const WORK_ACTIVITY_SUBJECT = 'work-unit'

/**
 * Everything one work chain execution needs (read-phase outputs + the
 * injected work ports). The caller MUST already hold the router's
 * per-team lock for `rootSessionId`.
 */
export interface WorkChainDeps {
  readonly repositories: TeamDomainRepositories
  /** The lifecycle transition commit port (REQUIRED by the chain: the
   *  R3 rule — an absent port fails closed before any durable write). */
  readonly lifecycleCommit?: LifecycleCommitPort
  /** The model-visible delivery port (REQUIRED by the chain). */
  readonly workDelivery?: WorkDeliveryPort
  /** The in-facade activity interval writer (REQUIRED by the chain). */
  readonly workActivity?: WorkActivityPort
  readonly now: () => string
  readonly rootSessionId: string
  readonly instanceId: string
  /** The action label recorded in the facts (`delegate` / `follow-up`). */
  readonly action: string
  readonly caller: ResolvedCaller
  readonly requestToken: string
  /** The exact model-visible work prompt (R2: never inherited). */
  readonly prompt: string
  readonly attachedContext?: string
  readonly taskSummary?: string
}

/** The durable work-unit facts found by the dedup scan (min sequence each). */
export interface WorkUnitFacts {
  readonly admitted?: { readonly sequence: number; readonly payload: Record<string, unknown> }
  readonly settled?: { readonly sequence: number; readonly payload: Record<string, unknown> }
}

/** The chain outcome (lossless JSON; mapped to the action effect). */
export interface WorkChainResult {
  /** `full` (admitted + settled this call), `resume` (prior admission
   *  recovered; delivered + settled this call) or `replay` (zero writes,
   *  zero delivery). */
  readonly mode: 'full' | 'resume' | 'replay'
  readonly instanceId: string
  readonly childSessionId: string
  /** The lifecycle observed at this execution's fresh read (replay: the
   *  original admission's `fromLifecycle` from the durable fact). */
  readonly fromLifecycle: MemberInstanceRecordDto['lifecycle']
  /** True when the ADMIT_WORK transition was durably committed by THIS
   *  execution (false: already RUNNING, resume, or replay of an attempt
   *  that found the target RUNNING). */
  readonly lifecycleCommitted: boolean
  /** The durable sequence of the `team-work-admitted` fact (the original
   *  one on resume/replay). */
  readonly sequence: number
  /** True when the work unit reached the durable SETTLED state (this
   *  execution, or the replayed attempt). */
  readonly settled: boolean
  /** The durable sequence of the settlement fact (when written or
   *  already present). */
  readonly settledSequence?: number
}

/**
 * The settlement outcome of {@link settleAdmittedWork}.
 * `committed` is true only when the RUNNING -> SETTLED state transition
 * was durably committed by this call; `sequence` is the settlement fact's
 * durable sequence (always present once settlement is complete).
 */
export interface SettleOutcome {
  readonly committed: boolean
  readonly to: MemberInstanceRecordDto['lifecycle']
  readonly sequence?: number
}

/**
 * Scan the TeamLedger for the work-unit facts of one requestToken.
 *
 * The scan is a full ledger walk (the ledger is per-root and small at
 * team scale; there is no token index in the frozen storage schema).
 * Entries are keyed by `String(sequence)`, so existence (not scan order)
 * is what matters; when several entries match (a resume repaired a fact
 * after an earlier partial write), the MINIMUM sequence wins.
 */
export function scanWorkUnitFacts(
  repositories: TeamDomainRepositories,
  rootSessionId: string,
  requestToken: string,
): WorkUnitFacts {
  let admitted: WorkUnitFacts['admitted']
  let settled: WorkUnitFacts['settled']
  for (const entry of repositories.ledger.list()) {
    if (entry.rootSessionId !== rootSessionId) continue
    if (entry.payload['requestToken'] !== requestToken) continue
    if (entry.factType === FACT_WORK_ADMITTED) {
      if (admitted === undefined || entry.sequence < admitted.sequence) {
        admitted = { sequence: entry.sequence, payload: entry.payload }
      }
    } else if (
      entry.factType === FACT_LIFECYCLE_CHANGED &&
      entry.payload['to'] === 'SETTLED'
    ) {
      if (settled === undefined || entry.sequence < settled.sequence) {
        settled = { sequence: entry.sequence, payload: entry.payload }
      }
    }
  }
  return { admitted, settled }
}

/** The caller ref recorded in the work facts (same shape as effects.ts). */
function callerRef(caller: ResolvedCaller): Record<string, unknown> {
  if (caller.role === 'human') {
    return { kind: 'human', humanId: caller.humanId }
  }
  return { kind: 'instance', instanceId: caller.callerMember?.instanceId, role: caller.role }
}

/**
 * One CAS lifecycle transition through the injected port. The chain
 * REQUIRES the port (R3): an absent port fails closed with
 * LIFECYCLE_COMMIT_UNAVAILABLE and ZERO durable writes.
 */
async function casTransition(
  deps: WorkChainDeps,
  expectedActivityVersion: number,
  from: MemberInstanceRecordDto['lifecycle'],
  operation: LifecycleOperation,
  to: MemberInstanceRecordDto['lifecycle'],
): Promise<void> {
  const port = deps.lifecycleCommit
  if (port === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
      `TeamRuntime: the work chain of '${deps.action}' requires the lifecycle commit port; no port is injected`,
      { action: deps.action, instanceId: deps.instanceId, operation },
    )
  }
  try {
    await port.commitTransition({
      rootSessionId: deps.rootSessionId,
      instanceId: deps.instanceId,
      expectedActivityVersion,
      from,
      operation,
      to,
    })
  } catch (error) {
    throw durableFailure('lifecycle transition commit', error, {
      instanceId: deps.instanceId,
      expectedActivityVersion,
      from,
      operation,
      to,
    })
  }
}

/** Wrap a durable-protocol fault into the closed effect-phase code. */
function durableFailure(
  phase: string,
  error: unknown,
  details: Record<string, unknown>,
): TeamRuntimeError {
  const downstream =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : error instanceof Error
        ? error.message
        : String(error)
  return new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
    `TeamRuntime: durable ${phase} failed: ${downstream}`,
    { phase, ...details },
  )
}

/** A lossless-JSON description of a delivery fault (for the settle fact). */
function describeFailure(error: unknown): Record<string, unknown> {
  if (error instanceof TeamRuntimeError) {
    return { code: error.code, message: error.message }
  }
  if (isActivityError(error)) {
    return { code: error.code, message: error.message }
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    const message = error instanceof Error ? error.message : String(error)
    return typeof code === 'string' ? { code, message } : { message }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

/**
 * Execute the full work chain for one admitted work request.
 *
 * @param deps - the chain dependencies (ports, identity, model-visible
 *        content). The caller must hold the router's per-team lock.
 * @returns the chain outcome (see {@link WorkChainResult}).
 * @throws WORK_DELIVERY_FAILED (fail-closed settlement already performed)
 *   on any delivery fault; LIFECYCLE_COMMIT_UNAVAILABLE (zero writes) when
 *   the port is absent; DURABLE_WRITE_FAILED on durable protocol faults.
 */
export async function executeWorkChain(deps: WorkChainDeps): Promise<WorkChainResult> {
  const { repositories, rootSessionId, instanceId, requestToken } = deps
  if (deps.workDelivery === undefined || deps.workActivity === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
      'TeamRuntime: the work chain requires the workDelivery and workActivity ports; none injected',
      { action: deps.action, instanceId },
    )
  }
  const fresh = repositories.memberInstances.get(rootSessionId, instanceId)
  if (fresh === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
      `TeamRuntime: work chain target '${instanceId}' has no member record`,
      { instanceId },
    )
  }
  const childSessionId = fresh.childSessionId

  // --- the dedup scan (retry protocol, module docs) ------------------------
  const facts = scanWorkUnitFacts(repositories, rootSessionId, requestToken)
  if (facts.settled !== undefined) {
    // The work unit completed durably on an earlier attempt: REPLAY.
    const admitted = facts.admitted
    if (admitted === undefined) {
      // Unreachable in this pipeline (the settlement fact is only ever
      // written after the admission fact of the same token) — honest
      // internal invariant, never a caller-reachable rejection.
      throw new Error(
        `TeamRuntime internal invariant: settlement fact ${facts.settled.sequence} without its admission fact (token '${requestToken}')`,
      )
    }
    const fromLifecycle = (admitted.payload['fromLifecycle'] as MemberInstanceRecordDto['lifecycle'] | undefined) ?? fresh.lifecycle
    return {
      mode: 'replay',
      instanceId,
      childSessionId,
      fromLifecycle,
      lifecycleCommitted: admitted.payload['lifecycleCommitted'] === true,
      sequence: admitted.sequence,
      settled: true,
      settledSequence: facts.settled.sequence,
    }
  }
  const mode: 'full' | 'resume' = facts.admitted !== undefined ? 'resume' : 'full'

  // --- admission (full mode only: resume reuses the durable admission) ----
  let lifecycleCommitted = false
  let fromLifecycle = fresh.lifecycle
  let sequence: number
  if (mode === 'full') {
    if (fresh.lifecycle !== 'RUNNING') {
      let next: MemberInstanceRecordDto
      try {
        next = applyLifecycleOperation(fresh, LIFECYCLE_OPERATIONS.ADMIT_WORK)
      } catch (error) {
        if (isLifecycleTransitionError(error)) {
          throw new TeamRuntimeError(
            TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
            `TeamRuntime: ${String(error)}`,
            {
              instanceId,
              from: fresh.lifecycle,
              requested: 'RUNNING',
              operation: LIFECYCLE_OPERATIONS.ADMIT_WORK,
            },
          )
        }
        throw error
      }
      // STATE FIRST (R3: required — both the state and the fact below
      // commit, or the action fails before either).
      await casTransition(
        deps,
        fresh.activityVersion,
        fresh.lifecycle,
        LIFECYCLE_OPERATIONS.ADMIT_WORK,
        next.lifecycle,
      )
      lifecycleCommitted = true
    }
    // EVIDENCE SECOND (R2: the fact carries the exact model-visible
    // content + the caller ref + the token — no default inheritance).
    sequence = await commitDurableFact(
      repositories,
      rootSessionId,
      deps.now,
      FACT_WORK_ADMITTED,
      {
        action: deps.action,
        caller: callerRef(deps.caller),
        targetInstanceId: instanceId,
        childSessionId,
        fromLifecycle,
        lifecycleCommitted,
        prompt: deps.prompt,
        ...(deps.attachedContext !== undefined ? { attachedContext: deps.attachedContext } : {}),
        ...(deps.taskSummary !== undefined ? { taskSummary: deps.taskSummary } : {}),
        requestToken,
        at: deps.now(),
      },
    )
  } else {
    // resume: the admission fact (and its sequence) is the durable one.
    sequence = facts.admitted?.sequence ?? 0
  }

  // --- interval open (tolerate already-open: a resume may find the
  //     crashed attempt's interval still open) ------------------------------
  try {
    await deps.workActivity.openInterval({
      rootSessionId,
      instanceId,
      subject: WORK_ACTIVITY_SUBJECT,
      requestToken,
      correlation: requestToken,
      note: `work-unit ${mode} (token ${requestToken})`,
    })
  } catch (error) {
    if (!(isActivityError(error) && error.code === ACTIVITY_ERROR_CODES.ACTIVITY_INTERVAL_ALREADY_OPEN)) {
      await failClosedSettle(deps, error)
      throw durableFailure('activity interval open', error, { instanceId, requestToken })
    }
  }

  // --- delivery (model-visible; observe the turn's completion) -------------
  try {
    await deps.workDelivery.deliver({
      rootSessionId,
      instanceId,
      childSessionId,
      requestToken,
      prompt: deps.prompt,
      ...(deps.attachedContext !== undefined ? { attachedContext: deps.attachedContext } : {}),
    })
  } catch (error) {
    // R6: fail-closed — settle before throwing; never a fake RUNNING.
    await closeIntervalTolerated(deps)
    await failClosedSettle(deps, error)
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED,
      `TeamRuntime: work delivery to '${childSessionId}' of '${instanceId}' failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        instanceId,
        childSessionId,
        requestToken,
        cause: describeFailure(error),
      },
    )
  }

  // --- interval close + settlement -----------------------------------------
  await closeIntervalTolerated(deps)
  const settle = await settleAdmittedWork(deps)
  return {
    mode,
    instanceId,
    childSessionId,
    fromLifecycle,
    lifecycleCommitted,
    sequence,
    settled: settle.to === 'SETTLED',
    ...(settle.sequence !== undefined ? { settledSequence: settle.sequence } : {}),
  }
}

/** Close the interval, tolerating a close-without-open (crash window). */
async function closeIntervalTolerated(deps: WorkChainDeps): Promise<void> {
  const workActivity = deps.workActivity
  if (workActivity === undefined) return
  try {
    await workActivity.closeInterval({
      rootSessionId: deps.rootSessionId,
      instanceId: deps.instanceId,
      subject: WORK_ACTIVITY_SUBJECT,
      requestToken: deps.requestToken,
      correlation: deps.requestToken,
    })
  } catch (error) {
    if (
      !(
        isActivityError(error) &&
        error.code === ACTIVITY_ERROR_CODES.ACTIVITY_INTERVAL_NOT_OPEN
      )
    ) {
      // An interval-close fault is a durable-protocol fault: surface it
      // (the settlement below still runs for the delivery-failure path's
      // caller — here it propagates to the chain's fail-closed handling).
      throw durableFailure('activity interval close', error, {
        instanceId: deps.instanceId,
        requestToken: deps.requestToken,
      })
    }
  }
}

/**
 * The R6 fail-closed settlement: RUNNING -> SETTLED through the port, with
 * a settlement fact carrying `workOutcome: 'delivery-failed'`. If the
 * settlement itself faults (port/CAS fault), the original fault is
 * rethrown after the settlement error is attached to `details` — the
 * caller-visible failure is the ORIGINAL chain fault.
 */
async function failClosedSettle(deps: WorkChainDeps, original: unknown): Promise<void> {
  try {
    await settleAdmittedWork(deps, { failClosed: true, failure: original })
  } catch (settleError) {
    const cause =
      settleError instanceof Error ? settleError.message : String(settleError)
    const originalMessage = original instanceof Error ? original.message : String(original)
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
      `TeamRuntime: the fail-closed settlement after '${originalMessage}' ALSO failed: ${cause}`,
      {
        phase: 'fail-closed settlement',
        instanceId: deps.instanceId,
        requestToken: deps.requestToken,
        originalCause: describeFailure(original),
      },
    )
  }
}

/**
 * The SINGLE production settlement owner of admitted work (R5).
 *
 * Convergence rules on the FRESH durable record:
 * - RUNNING -> CAS RUNNING -> SETTLED through the injected lifecycle
 *   commit port (STATE FIRST), then the `member-lifecycle-changed` fact
 *   (EVIDENCE SECOND, `workOutcome: 'settled'` or `'delivery-failed'`);
 * - SETTLED -> the state half already committed (crash between the state
 *   commit and the fact): commit ONLY the missing settlement fact (the
 *   caller's dedup scan proves the fact is absent for this token) — no
 *   state commit, no duplicate fact;
 * - any other lifecycle (terminal/ARCHIVED) -> no commit (the work unit
 *   cannot settle on a member that left the work state; the fact trail of
 *   the admission remains for audit).
 *
 * @param deps - the chain dependencies (the port is REQUIRED here: this
 *   function only runs when a RUNNING record still owes its settlement,
 *   where the port is present by the chain's precondition).
 * @param options - `failClosed: true` marks a fail-closed settlement
 *   (the fact carries `workOutcome: 'delivery-failed'` + the fault);
 *   `failure` is the fault being recorded.
 * @returns the settlement outcome.
 */
export async function settleAdmittedWork(
  deps: WorkChainDeps,
  options: { readonly failClosed?: boolean; readonly failure?: unknown } = {},
): Promise<SettleOutcome> {
  const { repositories, rootSessionId, instanceId, requestToken } = deps
  const fresh = repositories.memberInstances.get(rootSessionId, instanceId)
  if (fresh === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
      `TeamRuntime: settlement target '${instanceId}' has no member record`,
      { instanceId },
    )
  }
  const workOutcome = options.failClosed === true ? 'delivery-failed' : 'settled'
  if (fresh.lifecycle === 'SETTLED' || fresh.lifecycle === 'ARCHIVED' || fresh.lifecycle === 'DISPOSED') {
    // Convergence: no state commit. In the SETTLED case the state half
    // already committed earlier (crash window) — repair the missing
    // evidence fact exactly once (the caller scanned: it is absent).
    if (fresh.lifecycle === 'SETTLED') {
      const sequence = await commitDurableFact(
        repositories,
        rootSessionId,
        deps.now,
        FACT_LIFECYCLE_CHANGED,
        // The original transition was RUNNING -> SETTLED (the state half
        // committed before the crash) — the repaired fact records that.
        settleFactPayload(deps, 'RUNNING', workOutcome, options.failure),
      )
      return { committed: false, to: 'SETTLED', sequence }
    }
    return { committed: false, to: fresh.lifecycle }
  }
  // RUNNING: the only remaining settlement case (CREATED is unreachable —
  // a work unit is admitted to RUNNING before it can settle).
  const next = applyLifecycleOperation(fresh, LIFECYCLE_OPERATIONS.SETTLE)
  await casTransition(
    deps,
    fresh.activityVersion,
    fresh.lifecycle,
    LIFECYCLE_OPERATIONS.SETTLE,
    next.lifecycle,
  )
  const sequence = await commitDurableFact(
    repositories,
    rootSessionId,
    deps.now,
    FACT_LIFECYCLE_CHANGED,
    settleFactPayload(deps, fresh.lifecycle, workOutcome, options.failure),
  )
  return { committed: true, to: next.lifecycle, sequence }
}

/** The settlement fact payload (lossless JSON; no undefined values). */
function settleFactPayload(
  deps: WorkChainDeps,
  from: MemberInstanceRecordDto['lifecycle'],
  workOutcome: 'settled' | 'delivery-failed',
  failure: unknown,
): Record<string, unknown> {
  return {
    action: deps.action,
    caller: callerRef(deps.caller),
    instanceId: deps.instanceId,
    from,
    to: 'SETTLED',
    workOutcome,
    ...(failure !== undefined ? { failure: describeFailure(failure) } : {}),
    requestToken: deps.requestToken,
    at: deps.now(),
  }
}
