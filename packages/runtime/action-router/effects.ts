/**
 * P6-T2 — step 6 of the documented enforcement order: durable effects.
 *
 * Every durable write flows ONLY through the injected TeamDomain
 * repositories (invariant 41) — no other write path exists in this module.
 *
 * Durable write boundary (documented ruling): the facade's OWN durable
 * writes are the TeamLedger admission/coordination facts. The facade NEVER
 * rewrites `member_instances` records: the store is append-only per record
 * (P4: a different record at an occupied key is a conflict), member records
 * are written exactly once by the ActivationProvider (invariant 26;
 * CREATED at creation), and the durable commit of lifecycle transitions —
 * including the Architecture §30 quiesce-then-commit procedures — is the
 * P7-T3 lifecycle module's surface (TaskDoc P7-T3: "quiescence 与 durable
 * lifecycle一致"). The facade therefore:
 *
 * - validates every transition with the domain/lifecycle FSM (pure, no
 *   writes) — illegal pairs fail closed with LIFECYCLE_TRANSITION_REJECTED;
 * - commits the transition ONLY through the injected
 *   `LifecycleCommitPort`; without a port (the P6-T2 default wiring)
 *   lifecycle actions fail closed with LIFECYCLE_COMMIT_UNAVAILABLE and
 *   ZERO durable writes, while work admission still commits its evidence
 *   fact and reports `lifecycleCommitted: false`;
 * - keeps STATE FIRST, EVIDENCE SECOND for two-write effects: the port
 *   commit (state) precedes the ledger fact (evidence). A fault between
 *   the two leaves the committed state change without its fact —
 *   detectable and repairable; the inverse order (a fact claiming a change
 *   that never happened) would be false evidence and is avoided by
 *   construction. A fault surfaces as DURABLE_WRITE_FAILED with the exact
 *   downstream fault in `details`.
 *
 * Per-team serialization: all effects of one team are serialized behind a
 * per-team promise chain (the same pattern as the P6-T1 ActivationProvider
 * `withTeamLock`): concurrent actions of the same team see each other's
 * committed state (fresh views), and racing non-creation actions cannot
 * interleave durable writes. Creation actions additionally run inside the
 * provider's own per-team lock (the quota/instance-id protocol), which is
 * nested inside the router lock — no deadlock (the provider never calls
 * back into the router).
 *
 * WORK CHAIN LOCK SCOPE (INV-9.1, repair-r1 F3-A): the P8-S3 work chain
 * no longer runs end-to-end inside the effect acquisition. Its Phase A
 * (admission) runs INSIDE it (the new-work path: compatibility gate +
 * Phase A in one acquisition), the acquisition is then RELEASED, and
 * Phase B (delivery — the member's model turn, during which the member's
 * own team tools re-enter this facade and take the SAME chain — the F3
 * deadlock) + Phase C (settlement — re-acquired WITHOUT the request
 * signal, N6) run outside it, as a {@link WorkChainStage} completed by
 * the router. See `work-execution.ts` for the full topology + the
 * documented H3 overlap semantics.
 */

import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { CAPABILITY_NAME_VALUES } from '../../domain/policy/src/index.js'
import type { ExternalPolicyFacts } from '../../domain/policy/src/index.js'
import {
  applyLifecycleOperation,
  isLifecycleTransitionError,
  LIFECYCLE_OPERATIONS,
} from '../../domain/lifecycle/src/index.js'
import type { LifecycleOperation } from '../../domain/lifecycle/src/index.js'
import {
  ACTIVATION_SOURCES,
  effectivePolicyValues,
  isActivationError,
  resolveActivationPolicy,
} from '../activation/index.js'
import type {
  ActivationProvider,
  MemberActivationRequest,
} from '../activation/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import { isTeamDomainError } from '../../storage/schema/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js'
import type { ActionSpec } from '../admission/actions.js'
import type { ResolvedCaller } from '../admission/resolve.js'
import { enforceWorkAcceptingState, mapActivationError } from '../admission/gate.js'
import { resolveInstanceToken } from '../admission/resolve.js'
import type {
  LifecycleCommitPort,
  RuntimeActionEffect,
  TeamRuntimeActionRequest,
  WorkActivityPort,
  WorkDeliveryPort,
} from '../admission/types.js'
import type { LifecyclePorts } from '../lifecycle/types.js'
import { archiveMember, disposeMember, restoreMember } from '../lifecycle/index.js'
import { isLifecycleRuntimeError } from '../lifecycle/errors.js'
import { effectivePolicyView, memberSummary } from '../admission/types.js'
import { ACTION_NAMES } from '../admission/actions.js'
import {
  admitWorkLocked,
  completeWorkChainAfterAdmission,
} from './work-execution.js'
import type {
  WorkChainDeps,
  WorkChainPhaseA,
  WorkChainResult,
} from './work-execution.js'

/** The durable fact families (see admission/actions.ts for the contract). */
const FACT_WORK_ADMITTED = 'team-work-admitted'
const FACT_LIFECYCLE_CHANGED = 'member-lifecycle-changed'
const FACT_COORDINATION = 'team-coordination-recorded'

/** Everything one effect execution needs (all read-phase outputs). */
export interface EffectContext {
  readonly repositories: TeamDomainRepositories
  readonly activationProvider: ActivationProvider
  readonly externalPolicyFacts: () => Promise<ExternalPolicyFacts>
  readonly now: () => string
  readonly spec: ActionSpec
  readonly request: TeamRuntimeActionRequest
  readonly rootSessionId: string
  readonly caller: ResolvedCaller
  readonly blueprint: TeamBlueprint
  /** The injected lifecycle transition commit port (absent in the P6-T2
   *  default wiring — see the module docs). */
  readonly lifecycleCommit?: LifecycleCommitPort
  /** The model-visible work delivery port (P8-S3 work chain; absent in the
   *  P6-T2 default wiring). */
  readonly workDelivery?: WorkDeliveryPort
  /** The in-facade activity interval writer (P8-S3 work chain; absent in
   *  the P6-T2 default wiring). */
  readonly workActivity?: WorkActivityPort
  /** The P7-T3 lifecycle step ports (P8-S3 R7/CR-9): router lifecycle
   *  actions run the P7-T3 step ordering through these ports. */
  readonly lifecyclePorts?: LifecyclePorts
  /** The read-phase target (instance-targeted actions; re-read fresh in the
   *  effect — the fresh view is authoritative). */
  readonly target?: MemberInstanceRecordDto
  /** The per-team operation chain map (the runtime's own private map or
   *  the P8-S5B shared coordinator chain — INV-9.1). The work chain's
   *  Phase A runs inside the caller's acquisition of this map; Phase C
   *  (settlement / fail-closed) re-acquires the SAME map after delivery,
   *  without the request signal. */
  readonly teamLocks: Map<string, Promise<unknown>>
}

/**
 * A staged work-chain effect (INV-9.1, repair-r1 F3-A). The full P8-S3
 * chain splits its lock scope in three: Phase A (admission — fresh read,
 * dedup scan, CAS + admission fact, activity-interval open) ran INSIDE
 * the caller's chain acquisition (the new-work path: the compatibility
 * gate AND Phase A in one acquisition — the CR-8/R5 rule), and the lock
 * is now RELEASED. `complete` runs Phase B (delivery — NO shared lock;
 * the member's own team tools can proceed on the same chain — the F3
 * hang removed) and Phase C (settlement — re-acquires the SAME chain
 * WITHOUT the request signal, N6) OUTSIDE the caller's acquisition. A
 * delivery fault settles fail-closed FIRST, then throws
 * WORK_DELIVERY_FAILED (N3: throw-after-settle). Plain data effects
 * (every other action, and the P6-T2 evidence wiring) never stage: they
 * complete inside the acquisition.
 */
export interface WorkChainStage {
  readonly complete: () => Promise<RuntimeActionEffect>
}

/** The type guard for a staged work-chain effect (plain data effects are
 *  closed JSON records — they never carry a `complete` function). */
export function isWorkChainStage(
  value: RuntimeActionEffect | WorkChainStage,
): value is WorkChainStage {
  return 'complete' in value
}

/**
 * Execute the action's effect under the per-team lock.
 *
 * @param teamLocks - the per-team promise-chain map (owned by the runtime
 *   or shared — INV-9.1).
 * @param ctx - the effect context.
 * @returns the durable effect (lossless JSON) — for a full-wiring work
 *   chain this acquisition completes Phase A only and returns the
 *   {@link WorkChainStage}; the router completes Phase B/C after the lock
 *   is released.
 */
export function executeEffect(
  teamLocks: Map<string, Promise<unknown>>,
  ctx: EffectContext,
): Promise<RuntimeActionEffect | WorkChainStage> {
  if (ctx.spec.category === 'read') return runEffect(ctx)
  return withTeamLock(teamLocks, ctx.rootSessionId, () => runEffect(ctx), asAbortLike(ctx.request.signal))
}

/**
 * Execute the action's effect WITHOUT acquiring the per-team lock — the
 * caller must already hold this runtime's team chain for
 * `ctx.rootSessionId` (P8-S5B: the new-work admission path holds the
 * chain across the compatibility gate AND Phase A of the work effect in
 * one acquisition — the CR-8/R5 rule, preserved by INV-9.1 — so the
 * effect itself must not re-acquire it; chains are not re-entrant).
 *
 * @param ctx - the effect context.
 * @returns the durable effect (lossless JSON), or the staged work chain
 *   (Phase A complete; Phase B/C run after the caller's acquisition
 *   releases — the router's job).
 */
export function executeEffectLocked(ctx: EffectContext): Promise<RuntimeActionEffect | WorkChainStage> {
  return runEffect(ctx)
}

type AbortLike = {
  readonly aborted: boolean
  readonly reason?: unknown
  addEventListener(type: 'abort', listener: () => void, options?: { readonly once?: boolean }): void
  removeEventListener(type: 'abort', listener: () => void): void
}

export function asAbortLike(value: unknown): AbortLike | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as Partial<AbortLike>
  if (typeof candidate.aborted !== 'boolean' || typeof candidate.addEventListener !== 'function' || typeof candidate.removeEventListener !== 'function') return undefined
  return candidate as AbortLike
}

export function withTeamLock<T>(
  teamLocks: Map<string, Promise<unknown>>,
  rootSessionId: string,
  work: () => Promise<T>,
  signal?: AbortLike,
): Promise<T> {
  const previous = teamLocks.get(rootSessionId) ?? Promise.resolve()
  const wait = signal === undefined
    ? previous
    : new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(signal.reason ?? new Error('operation aborted')); return }
        const onAbort = () => reject(signal.reason ?? new Error('operation aborted'))
        signal.addEventListener('abort', onAbort, { once: true })
        previous.then(
          () => { signal.removeEventListener('abort', onAbort); resolve() },
          () => { signal.removeEventListener('abort', onAbort); resolve() },
        )
      })
  const next = wait.catch(() => undefined).then(() => {
    if (signal?.aborted) return Promise.reject(signal.reason ?? new Error('operation aborted'))
    return work()
  })
  teamLocks.set(rootSessionId, next.catch(() => undefined))
  return next
}

async function runEffect(ctx: EffectContext): Promise<RuntimeActionEffect | WorkChainStage> {
  const { spec } = ctx
  switch (spec.name) {
    case ACTION_NAMES.LIST_MEMBERS: {
      const members = ctx.repositories.memberInstances.list(ctx.rootSessionId)
      return { kind: 'members-listed', members: members.map((member) => memberSummary(member)) }
    }
    case ACTION_NAMES.LIST_TEMPLATES: {
      const templates: { templateId: string; displayName: string; contextPolicy: string }[] = []
      const entries = [ctx.blueprint.leader, ...ctx.blueprint.members]
      for (const entry of entries) {
        templates.push({
          templateId: String(entry.templateId),
          displayName: entry.displayName ?? '',
          contextPolicy: entry.contextPolicy ?? 'persistent',
        })
      }
      return { kind: 'templates-listed', templates }
    }
    case ACTION_NAMES.INSPECT_CONFIG: {
      const target = ctx.target
      if (target === undefined) internalInvariant('inspect-config requires a resolved target')
      const external = await ctx.externalPolicyFacts()
      let policy
      try {
        policy = resolveActivationPolicy({
          rootSessionId: ctx.rootSessionId,
          instanceId: target.instanceId,
          overrides: ctx.repositories.overrides.list(ctx.rootSessionId),
          external,
        })
      } catch (error) {
        if (isActivationError(error)) throw mapActivationError(error)
        throw error
      }
      return {
        kind: 'config-inspected',
        effective: effectivePolicyView(effectivePolicyValues(policy), CAPABILITY_NAME_VALUES),
      }
    }
    case ACTION_NAMES.FOLLOW_UP:
      return runWorkAdmission(ctx, 'follow-up')
    case ACTION_NAMES.SEND_MESSAGE: {
      const recipientToken = String(ctx.request.payload?.['recipientInstanceId'] ?? '')
      const recipient = resolveInstanceToken(
        ctx.repositories,
        ctx.rootSessionId,
        ctx.blueprint,
        recipientToken,
        spec.name,
      )
      // The v2 LeaderInstance is the root session itself and intentionally
      // has no ordinary member lifecycle. It is still a valid coordination
      // target; ordinary members retain the normal work-accepting check.
      const target = recipient.instanceId === LEADER_INSTANCE_ID
        ? recipient
        : requireLiveTarget(ctx)
      const sequence = await commitFact(ctx, FACT_COORDINATION, {
        action: spec.name,
        caller: callerRef(ctx.caller),
        targetInstanceId: target.instanceId,
        recipientInstanceId: recipient.instanceId,
        ...optionalStringField(ctx.request.payload, 'subject'),
        ...optionalStringField(ctx.request.payload, 'body'),
        requestToken: ctx.request.requestToken,
        at: ctx.now(),
      })
      return { kind: 'fact-recorded', factType: FACT_COORDINATION, sequence }
    }
    case ACTION_NAMES.REPORT_PROGRESS:
    case ACTION_NAMES.REQUEST_CONTROL:
    case ACTION_NAMES.RESOLVE_CONTROL: {
      const target = requireLiveTarget(ctx)
      const sequence = await commitFact(ctx, FACT_COORDINATION, {
        action: spec.name,
        caller: callerRef(ctx.caller),
        targetInstanceId: target.instanceId,
        ...optionalStringField(ctx.request.payload, 'progress'),
        ...optionalStringField(ctx.request.payload, 'decision'),
        ...optionalStringField(ctx.request.payload, 'reason'),
        ...optionalStringField(ctx.request.payload, 'summary'),
        requestToken: ctx.request.requestToken,
        at: ctx.now(),
      })
      return { kind: 'fact-recorded', factType: FACT_COORDINATION, sequence }
    }
    case ACTION_NAMES.ARCHIVE_MEMBER:
      return runLifecycle(ctx, LIFECYCLE_OPERATIONS.ARCHIVE, 'ARCHIVED')
    case ACTION_NAMES.RESTORE_MEMBER:
      return runLifecycle(ctx, LIFECYCLE_OPERATIONS.RESTORE, 'SETTLED')
    case ACTION_NAMES.DISPOSE_MEMBER:
      return runLifecycle(ctx, LIFECYCLE_OPERATIONS.DISPOSE, 'DISPOSED')
    case ACTION_NAMES.DELEGATE:
      return runDelegate(ctx)
    case ACTION_NAMES.CREATE_MEMBER:
      return runCreateMember(ctx)
    default:
      internalInvariant(`no effect registered for action '${spec.name}'`)
  }
}

/** The caller reference stored in durable facts (lossless JSON). */
function callerRef(caller: ResolvedCaller): Record<string, unknown> {
  if (caller.role === 'human') {
    return { kind: 'human', humanId: caller.humanId }
  }
  return { kind: 'instance', instanceId: caller.callerMember?.instanceId, role: caller.role }
}

/**
 * Map one P7-T3 lifecycle-core {@link LifecycleRuntimeError} onto the
 * facade's closed TeamRuntime code set (the router's closed contract:
 * every caller-visible rejection is a TeamRuntimeError). Non-lifecycle
 * faults rethrow unchanged.
 */
function mapLifecycleCoreError(error: unknown): never {
  if (isLifecycleRuntimeError(error)) {
    const details: Record<string, unknown> = { lifecycleCode: error.code, ...error.details }
    const message = `TeamRuntime: ${error.message}`
    switch (error.code) {
      case 'LIFECYCLE_MEMBER_NOT_FOUND':
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND, message, details)
      case 'LIFECYCLE_ILLEGAL_STATE':
      case 'LIFECYCLE_LEADER_NOT_OPERABLE':
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED, message, details)
      case 'LIFECYCLE_NOT_QUIESCENT':
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_NOT_QUIESCENT, message, details)
      case 'LIFECYCLE_LIVE_EFFECT_FAILED':
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_LIVE_EFFECT_FAILED, message, details)
      case 'LIFECYCLE_DURABLE_STATE_FAILED':
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, message, details)
      default:
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED, message, details)
    }
  }
  throw error
}

/** A fresh (locked) read of the action target; it must still exist. */
function requireFreshTarget(ctx: EffectContext): MemberInstanceRecordDto {
  const target = ctx.target
  if (target === undefined) internalInvariant(`${ctx.spec.name} requires a resolved target`)
  const fresh = ctx.repositories.memberInstances.get(ctx.rootSessionId, target.instanceId)
  if (fresh === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
      `TeamRuntime: target '${target.instanceId}' no longer exists (fresh view)`,
      { rootSessionId: ctx.rootSessionId, instanceId: target.instanceId },
    )
  }
  return fresh
}

/** A fresh target that must be live (work/coordination targets). */
function requireLiveTarget(ctx: EffectContext): MemberInstanceRecordDto {
  const fresh = requireFreshTarget(ctx)
  enforceWorkAcceptingState(fresh.lifecycle)
  return fresh
}

/**
 * The work-admission effect (follow-up + delegate-continue): the SAME child
 * session is kept (invariant 24); a CREATED/SETTLED target is validated
 * against the domain FSM for the ADMIT_WORK edge; the durable fact is
 * `team-work-admitted`. Two wirings:
 *
 * - P8-S3 work chain (ALL THREE of the lifecycle commit port, the work
 *   delivery port and the work activity port are injected — the production
 *   row): the full vertical chain of `work-execution.ts` runs — required
 *   CAS admission, the fact (with the exact model-visible prompt/context),
 *   the activity interval, the model-visible delivery, the fail-closed
 *   settlement (`settleAdmittedWork`, R5) and the retry protocol (W9);
 * - P6-T2 default wiring (any port absent): the admission commits its
 *   evidence fact, the RUNNING transition — when needed — is durably
 *   committed ONLY through the injected lifecycle commit port (absent port
 *   + needed transition fails closed per R3; already-RUNNING targets
 *   report `lifecycleCommitted: false`); no delivery, no settlement.
 */
async function runWorkAdmission(
  ctx: EffectContext,
  actionLabel: string,
): Promise<RuntimeActionEffect | WorkChainStage> {
  const fresh = requireLiveTarget(ctx)
  return admitWorkOn(ctx, fresh, actionLabel)
}

/** The shared work-admission core on a fresh, work-accepting record. */
async function admitWorkOn(
  ctx: EffectContext,
  fresh: MemberInstanceRecordDto,
  actionLabel: string,
): Promise<RuntimeActionEffect | WorkChainStage> {
  const chain = workChainPorts(ctx)
  if (chain !== undefined) {
    return stageWorkChainOn(ctx, fresh, actionLabel, chain)
  }
  const from = fresh.lifecycle
  let lifecycleCommitted = false
  if (from !== 'RUNNING') {
    const next = validateAdmitWork(fresh)
    lifecycleCommitted = await commitTransition(
      ctx,
      fresh.instanceId,
      fresh.activityVersion,
      from,
      LIFECYCLE_OPERATIONS.ADMIT_WORK,
      next.lifecycle,
      { required: true },
    )
  }
  const sequence = await commitFact(ctx, FACT_WORK_ADMITTED, {
    action: actionLabel,
    caller: callerRef(ctx.caller),
    targetInstanceId: fresh.instanceId,
    childSessionId: fresh.childSessionId,
    fromLifecycle: from,
    lifecycleCommitted,
    ...optionalStringField(ctx.request.payload, 'taskSummary'),
    requestToken: ctx.request.requestToken,
    at: ctx.now(),
  })
  return { kind: 'work-admitted', instanceId: fresh.instanceId, fromLifecycle: from, lifecycleCommitted, sequence }
}

/**
 * The three injected ports the P8-S3 work chain requires (the production
 * row installs them together; a partial install falls back to the P6-T2
 * admission so no work chain ever runs without its settlement owner).
 */
function workChainPorts(ctx: EffectContext):
  | {
      readonly lifecycleCommit: LifecycleCommitPort
      readonly workDelivery: WorkDeliveryPort
      readonly workActivity: WorkActivityPort
    }
  | undefined {
  const lifecycleCommit = ctx.lifecycleCommit
  const workDelivery = ctx.workDelivery
  const workActivity = ctx.workActivity
  if (lifecycleCommit === undefined || workDelivery === undefined || workActivity === undefined) {
    return undefined
  }
  return { lifecycleCommit, workDelivery, workActivity }
}

/**
 * The P8-S3 vertical chain in STAGED form (INV-9.1, repair-r1 F3-A).
 * Phase A (fresh read, dedup scan, CAS + admission fact, activity-
 * interval open) runs INLINE here — the caller (the router's new-work
 * acquisition) already holds this team's chain, and the compatibility
 * gate and Phase A stay in ONE acquisition (H5/CR-8: a racing new-work
 * consultation cannot interleave its re-probe into this window). A
 * REPLAY completes the chain inside the lock (zero writes, zero
 * delivery — no Phase B/C); an ADMITTED unit returns the
 * {@link WorkChainStage} — Phase B (delivery: NO shared lock, the
 * member's own team tools proceed on the same chain — the F3 hang
 * removed) and Phase C (settlement: re-acquires the SAME chain WITHOUT
 * the request signal, N6) run after the caller's acquisition releases.
 */
async function stageWorkChainOn(
  ctx: EffectContext,
  fresh: MemberInstanceRecordDto,
  actionLabel: string,
  chain: {
    readonly lifecycleCommit: LifecycleCommitPort
    readonly workDelivery: WorkDeliveryPort
    readonly workActivity: WorkActivityPort
  },
): Promise<RuntimeActionEffect | WorkChainStage> {
  const deps = workChainDeps(ctx, fresh.instanceId, actionLabel, chain)
  const phaseA = await admitWorkLocked(deps)
  if (phaseA.kind === 'replay') {
    return mapWorkChainEffect(phaseA.result)
  }
  return {
    complete: async () => {
      const result = await completeWorkChainAfterAdmission(deps, phaseA)
      return mapWorkChainEffect(result)
    },
  }
}

/**
 * The WorkChainDeps of one staged chain (the ports + identity + the
 * model-visible content + the shared chain map for Phase C re-acquisition
 * — INV-9.1).
 */
function workChainDeps(
  ctx: EffectContext,
  instanceId: string,
  actionLabel: string,
  chain: {
    readonly lifecycleCommit: LifecycleCommitPort
    readonly workDelivery: WorkDeliveryPort
    readonly workActivity: WorkActivityPort
  },
): WorkChainDeps {
  return {
    repositories: ctx.repositories,
    lifecycleCommit: chain.lifecycleCommit,
    workDelivery: chain.workDelivery,
    workActivity: chain.workActivity,
    now: ctx.now,
    rootSessionId: ctx.rootSessionId,
    instanceId,
    action: actionLabel,
    caller: ctx.caller,
    requestToken: ctx.request.requestToken,
    prompt: String(ctx.request.payload?.['prompt'] ?? ''),
    ...(optionalStringField(ctx.request.payload, 'attachedContext')),
    ...(optionalStringField(ctx.request.payload, 'taskSummary')),
    // v2 D2 (task C2, frozen C1 decision): propagate the caller's
    // transient cancellation into the delivery (the delegate-create path
    // already did; the follow-up path dropped it — an abort mid-
    // follow-up-delivery was not honored until the next boundary).
    ...(ctx.request.signal !== undefined ? { signal: ctx.request.signal } : {}),
    teamLocks: ctx.teamLocks,
  }
}

/** Map one chain outcome to the closed `work-admitted` effect (v2 D2
 *  carriers unchanged). */
function mapWorkChainEffect(result: WorkChainResult): RuntimeActionEffect {
  return {
    kind: 'work-admitted',
    instanceId: result.instanceId,
    fromLifecycle: result.fromLifecycle,
    lifecycleCommitted: result.lifecycleCommitted,
    sequence: result.sequence,
    replayed: result.mode === 'replay',
    settled: result.settled,
    ...(result.settledSequence !== undefined ? { settledSequence: result.settledSequence } : {}),
    // v2 D2 (task C2): the chain's normalized member result rides the same
    // lossless effect to the Leader (the tool/remote envelopes carry it
    // verbatim; absent on the evidence path, where no chain ran, and on
    // the fail-closed throw, where no effect is formed).
    ...(result.memberResult !== undefined ? { memberResult: result.memberResult } : {}),
  }
}

/**
 * The lifecycle effect (archive/restore/dispose). Two wirings:
 *
 * - P7-T3 step ports installed (P8-S3 R7/CR-9, the production row): the
 *   UNLOCKED P7-T3 cores (`archiveMember` / `restoreMember` /
 *   `disposeMember`) run the frozen §20.3/§30.1 ordering — close
 *   admission -> interrupt -> quiesce/drain FIRST -> release residency ->
 *   commit — through the REAL production ports, under the ROUTER's own
 *   team lock (the service's internal lock map is deliberately not used:
 *   it would serialize against a second map and desynchronize from the
 *   router's work effects; the cores take no lock of their own). The
 *   `member-lifecycle-changed` fact is committed after the core returns
 *   (evidence second; `from` is the pre-call fresh read).
 * - P6-T2 default wiring (no step ports): the transition is validated by
 *   the domain/lifecycle FSM (illegal pairs -> LIFECYCLE_TRANSITION_
 *   REJECTED, zero writes); without an injected commit port it fails
 *   closed (LIFECYCLE_COMMIT_UNAVAILABLE, zero writes); the durable commit
 *   goes through the port (state first) and the durable fact is
 *   `member-lifecycle-changed` (evidence second).
 */
async function runLifecycle(
  ctx: EffectContext,
  operation: LifecycleOperation,
  requestedTo: 'ARCHIVED' | 'SETTLED' | 'DISPOSED',
): Promise<RuntimeActionEffect> {
  const fresh = requireFreshTarget(ctx)
  const ports = ctx.lifecyclePorts
  if (ports !== undefined) {
    const target = { rootSessionId: ctx.rootSessionId, instanceId: fresh.instanceId }
    let result: { readonly member: MemberInstanceRecordDto; readonly steps: readonly string[] }
    try {
      if (operation === LIFECYCLE_OPERATIONS.ARCHIVE) {
        result = await archiveMember(ports, target)
      } else if (operation === LIFECYCLE_OPERATIONS.RESTORE) {
        result = await restoreMember(ports, target)
      } else if (operation === LIFECYCLE_OPERATIONS.DISPOSE) {
        result = await disposeMember(ports, target)
      } else {
        internalInvariant(`lifecycle operation '${operation}' is not a router lifecycle action`)
      }
    } catch (error) {
      throw mapLifecycleCoreError(error)
    }
    const sequence = await commitFact(ctx, FACT_LIFECYCLE_CHANGED, {
      action: ctx.spec.name,
      caller: callerRef(ctx.caller),
      instanceId: fresh.instanceId,
      from: fresh.lifecycle,
      to: result.member.lifecycle,
      steps: [...result.steps],
      requestToken: ctx.request.requestToken,
      at: ctx.now(),
    })
    return {
      kind: 'lifecycle-changed',
      instanceId: fresh.instanceId,
      from: fresh.lifecycle,
      to: result.member.lifecycle,
      sequence,
    }
  }
  let next: MemberInstanceRecordDto
  try {
    next = applyLifecycleOperation(fresh, operation)
  } catch (error) {
    if (isLifecycleTransitionError(error)) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
        `TeamRuntime: ${String(error)}`,
        {
          instanceId: fresh.instanceId,
          from: fresh.lifecycle,
          requested: requestedTo,
          operation,
        },
      )
    }
    throw error
  }
  await commitTransition(ctx, fresh.instanceId, fresh.activityVersion, fresh.lifecycle, operation, next.lifecycle, {
    required: true,
  })
  const sequence = await commitFact(ctx, FACT_LIFECYCLE_CHANGED, {
    action: ctx.spec.name,
    caller: callerRef(ctx.caller),
    instanceId: fresh.instanceId,
    from: fresh.lifecycle,
    to: next.lifecycle,
    requestToken: ctx.request.requestToken,
    at: ctx.now(),
  })
  return { kind: 'lifecycle-changed', instanceId: fresh.instanceId, from: fresh.lifecycle, to: next.lifecycle, sequence }
}

/**
 * The delegation effect: the provider is the admission authority (it owns
 * the quota protocol and the instance-id allocation) — `activated` (a NEW
 * instance, invariant 25) or `continued` (an EXISTING instance, invariant
 * 24 — the router then applies the work-admission effect on it).
 */
async function runDelegate(ctx: EffectContext): Promise<RuntimeActionEffect | WorkChainStage> {
  const request = ctx.request
  const activationRequest: MemberActivationRequest = {
    rootSessionId: ctx.rootSessionId,
    source: ACTIVATION_SOURCES.LEADER_DELEGATE,
    ...(request.delegationTemplateId !== undefined
      ? { delegation: { templateId: request.delegationTemplateId } }
      : {}),
    ...(request.delegationInstanceId !== undefined
      ? { delegation: { explicitInstanceId: request.delegationInstanceId } }
      : {}),
    label: String(request.payload?.['label'] ?? ''),
    ...(typeof request.payload?.['groupId'] === 'string'
      ? { groupId: request.payload['groupId'] }
      : {}),
    ...(typeof request.payload?.['workspace'] === 'string'
      ? { workspace: request.payload['workspace'] }
      : {}),
    requestToken: request.requestToken,
    callerId: LEADER_INSTANCE_ID,
  }
  const result = await callProvider(ctx, activationRequest)
  if (result.kind === 'activated') {
    const activated = {
      kind: 'member-activated' as const,
      instanceId: result.instanceId,
      templateId: result.templateId,
      childSessionId: result.childSessionId,
      operationId: result.operationId,
      replayed: result.replayed,
      ...(result.ledgerSequence !== undefined ? { ledgerSequence: result.ledgerSequence } : {}),
      admissionCode: result.admission.code,
    }
    const chain = workChainPorts(ctx)
    if (chain === undefined) {
      return activated
    }
    // R1 (closure plan §16.2): the create form does NOT stop at activation —
    // it continues into the work chain on the new instance (admission,
    // delivery, settlement). The effect kind stays `member-activated` (the
    // creation is the headline effect; the work fields extend it).
    // INV-9.1 (repair-r1 F3-A): Phase A runs inline here — the provider's
    // durable writes and the admission share this ONE chain acquisition;
    // the admitted unit returns the stage (Phase B without the chain,
    // Phase C re-acquired without the request signal).
    const fresh = ctx.repositories.memberInstances.get(ctx.rootSessionId, result.instanceId)
    if (fresh === undefined) {
      internalInvariant('the provider activated an instance but its member row is missing')
    }
    const deps = workChainDeps(ctx, result.instanceId, 'delegate', chain)
    const phaseA = await admitWorkLocked(deps)
    if (phaseA.kind === 'replay') {
      return {
        ...activated,
        workSequence: phaseA.result.sequence,
        workSettled: phaseA.result.settled,
        // v2 D2 (task C2): the replay's synthesized result rides the same
        // carriers (unavailable/WORK_REPLAYED — no re-delivery, zero writes).
        ...(phaseA.result.memberResult !== undefined ? { memberResult: phaseA.result.memberResult } : {}),
      }
    }
    return {
      complete: async () => {
        const work = await completeWorkChainAfterAdmission(deps, phaseA)
        return {
          ...activated,
          workSequence: work.sequence,
          workSettled: work.settled,
          // v2 D2 (task C2): the delegate-create's chain result rides the same
          // carriers as the follow-up path (the Leader sees the member's
          // business outcome on the creation effect itself).
          ...(work.memberResult !== undefined ? { memberResult: work.memberResult } : {}),
        }
      },
    }
  }
  // continued: the provider did NO durable write; the router admits the
  // work on the existing instance (fresh view under the lock).
  const fresh = ctx.repositories.memberInstances.get(ctx.rootSessionId, result.instanceId)
  if (fresh === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
      `TeamRuntime: continued instance '${result.instanceId}' not found (fresh view)`,
      { rootSessionId: ctx.rootSessionId, instanceId: result.instanceId },
    )
  }
  return admitWorkOn(ctx, fresh, 'delegate')
}

/**
 * The explicit-creation effect (leader-explicit or human-ui source; the
 * provider is the admission authority — invariant 26).
 */
async function runCreateMember(ctx: EffectContext): Promise<RuntimeActionEffect> {
  const request = ctx.request
  const isHuman = ctx.caller.role === 'human'
  const activationRequest: MemberActivationRequest = {
    rootSessionId: ctx.rootSessionId,
    source: isHuman ? ACTIVATION_SOURCES.HUMAN_UI : ACTIVATION_SOURCES.LEADER_EXPLICIT,
    templateId: request.delegationTemplateId,
    label: String(request.payload?.['label'] ?? ''),
    ...(typeof request.payload?.['groupId'] === 'string'
      ? { groupId: request.payload['groupId'] }
      : {}),
    ...(typeof request.payload?.['workspace'] === 'string'
      ? { workspace: request.payload['workspace'] }
      : {}),
    requestToken: request.requestToken,
    callerId: isHuman ? ctx.caller.humanId : LEADER_INSTANCE_ID,
  }
  const result = await callProvider(ctx, activationRequest)
  if (result.kind !== 'activated') {
    internalInvariant('explicit creation must activate a new instance')
  }
  return {
    kind: 'member-activated',
    instanceId: result.instanceId,
    templateId: result.templateId,
    childSessionId: result.childSessionId,
    operationId: result.operationId,
    replayed: result.replayed,
    ...(result.ledgerSequence !== undefined ? { ledgerSequence: result.ledgerSequence } : {}),
    admissionCode: result.admission.code,
  }
}

/** The provider call with the closed error mapping. */
async function callProvider(
  ctx: EffectContext,
  activationRequest: MemberActivationRequest,
): Promise<import('../activation/index.js').ActivationResult> {
  try {
    return await ctx.activationProvider.activate(activationRequest)
  } catch (error) {
    if (isActivationError(error)) throw mapActivationError(error)
    throw error
  }
}

/**
 * The work-admission FSM validation (CREATED/SETTLED -> RUNNING, domain
 * FSM; pure — no write). RUNNING targets skip the transition entirely
 * (idempotent admission on an already-running member).
 */
function validateAdmitWork(record: MemberInstanceRecordDto): MemberInstanceRecordDto {
  try {
    return applyLifecycleOperation(record, LIFECYCLE_OPERATIONS.ADMIT_WORK)
  } catch (error) {
    if (isLifecycleTransitionError(error)) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
        `TeamRuntime: ${String(error)}`,
        {
          instanceId: record.instanceId,
          from: record.lifecycle,
          requested: 'RUNNING',
          operation: LIFECYCLE_OPERATIONS.ADMIT_WORK,
        },
      )
    }
    throw error
  }
}

/**
 * Durably commit one FSM-validated lifecycle transition through the
 * injected port (the STATE half of a two-write effect). Without a port the
 * transition stays uncommitted and `false` is returned (the P6-T2 default
 * wiring: the P7-T3 lifecycle module provides the port); with
 * `{ required: true }` an absent port is a caller-visible failure
 * (LIFECYCLE_COMMIT_UNAVAILABLE) because the action's whole effect IS the
 * commit.
 *
 * The commit is a compare-and-swap in the durable layer (R4/CR-10):
 * `expectedActivityVersion` is the version the freshly read record carried;
 * a concurrent writer that moved the row first makes the commit fail
 * instead of silently overwriting (W8).
 */
async function commitTransition(
  ctx: EffectContext,
  instanceId: string,
  expectedActivityVersion: number,
  from: MemberInstanceRecordDto['lifecycle'],
  operation: LifecycleOperation,
  to: MemberInstanceRecordDto['lifecycle'],
  options?: { required?: boolean },
): Promise<boolean> {
  const port = ctx.lifecycleCommit
  if (port === undefined) {
    if (options?.required === true) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
        `TeamRuntime: action '${ctx.spec.name}' requires the lifecycle commit port; no port is injected (the P7-T3 lifecycle module provides it)`,
        { action: ctx.spec.name, instanceId },
      )
    }
    return false
  }
  try {
    await port.commitTransition({
      rootSessionId: ctx.rootSessionId,
      instanceId,
      expectedActivityVersion,
      from,
      operation,
      to,
    })
  } catch (error) {
    throw durableFailure('lifecycle transition commit', error, { instanceId, expectedActivityVersion, from, operation, to })
  }
  return true
}

/**
 * Commit one durable fact (the evidence half of a two-write effect, or the
 * whole effect for coordination actions). The sequence is ALLOCATED through
 * the ledger's atomic counter (the repository rejects unallocated or
 * above-counter sequences — `RECORD_INVALID`).
 */
/**
 * Commit one durable fact to the TeamLedger (the evidence half of a
 * two-write effect, or the whole effect for coordination actions). The
 * sequence is ALLOCATED through the ledger's atomic counter (the
 * repository rejects unallocated or above-counter sequences —
 * `RECORD_INVALID`); a durable fault surfaces as
 * `DURABLE_WRITE_FAILED` with the downstream cause in `details`.
 *
 * Exported (P8-S3): the work chain (`work-execution.ts`) commits its
 * admission/settlement facts through the SAME protocol from the same
 * module — one sequence-allocation owner, one fault mapping. The caller
 * must already hold the router's per-team lock for the root session.
 */
export async function commitDurableFact(
  repositories: TeamDomainRepositories,
  rootSessionId: string,
  now: () => string,
  factType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  let sequence: number
  try {
    sequence = await repositories.ledger.allocateSequence()
  } catch (error) {
    throw durableFailure('sequence allocation', error, { factType })
  }
  const entry = {
    schemaVersion: 1,
    sequence,
    rootSessionId,
    factType,
    payload,
    createdAt: now(),
  }
  try {
    await repositories.ledger.put(entry)
  } catch (error) {
    throw durableFailure('fact commit', error, { factType, sequence })
  }
  return sequence
}

async function commitFact(
  ctx: EffectContext,
  factType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  return commitDurableFact(ctx.repositories, ctx.rootSessionId, ctx.now, factType, payload)
}

/**
 * One optional STRING payload field as a remote-safe conditional spread:
 * the durable fact payload must never carry `undefined` values (the ledger
 * entry parser rejects non-remote-safe JSON with `RECORD_INVALID`), so an
 * absent/non-string field is omitted rather than stored as undefined.
 */
function optionalStringField(
  payload: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const value = payload?.[key]
  return typeof value === 'string' ? { [key]: value } : {}
}

/**
 * An internal pipeline invariant violation (a programming error, never a
 * caller-reachable rejection — the router validates target presence before
 * dispatch). A plain Error is honest here: no closed code covers it.
 */
function internalInvariant(message: string): never {
  throw new Error(`TeamRuntime internal invariant: ${message}`)
}

/** Wrap a durable-protocol fault into the closed effect-phase code. */
function durableFailure(
  phase: string,
  error: unknown,
  details: Record<string, unknown>,
): TeamRuntimeError {
  const downstream = isTeamDomainError(error) ? error.code : error instanceof Error ? error.message : String(error)
  return new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED,
    `TeamRuntime: durable ${phase} failed: ${downstream}`,
    { phase, ...details },
  )
}
