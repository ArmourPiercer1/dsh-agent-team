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
 */

import { LEADER_INSTANCE_ID, parseInstanceId } from '../../contracts/src/index.js'
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
} from '../admission/types.js'
import { effectivePolicyView, memberSummary } from '../admission/types.js'
import { ACTION_NAMES } from '../admission/actions.js'

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
  /** The read-phase target (instance-targeted actions; re-read fresh in the
   *  effect — the fresh view is authoritative). */
  readonly target?: MemberInstanceRecordDto
}

/**
 * Execute the action's effect under the per-team lock.
 *
 * @param teamLocks - the per-team promise-chain map (owned by the runtime).
 * @param ctx - the effect context.
 * @returns the durable effect (lossless JSON).
 */
export function executeEffect(
  teamLocks: Map<string, Promise<unknown>>,
  ctx: EffectContext,
): Promise<RuntimeActionEffect> {
  return withTeamLock(teamLocks, ctx.rootSessionId, () => runEffect(ctx))
}

/** The per-team promise chain (the P6-T1 lock pattern, reused). */
export function withTeamLock<T>(
  teamLocks: Map<string, Promise<unknown>>,
  rootSessionId: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = teamLocks.get(rootSessionId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(() => work())
  teamLocks.set(rootSessionId, next.catch(() => undefined))
  return next
}

async function runEffect(ctx: EffectContext): Promise<RuntimeActionEffect> {
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
      const target = requireLiveTarget(ctx)
      const recipientToken = String(ctx.request.payload?.['recipientInstanceId'] ?? '')
      const recipient = resolveInstanceToken(
        ctx.repositories,
        ctx.rootSessionId,
        ctx.blueprint,
        recipientToken,
        spec.name,
      )
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
 * `team-work-admitted`. The RUNNING transition — when the target is not
 * already RUNNING — is durably committed ONLY through the injected
 * lifecycle commit port (absent in the P6-T2 default wiring: the admission
 * still commits, `lifecycleCommitted` is false; the P7-T3 lifecycle module
 * provides the port, TaskDoc P7-T3).
 */
async function runWorkAdmission(ctx: EffectContext, actionLabel: string): Promise<RuntimeActionEffect> {
  const fresh = requireLiveTarget(ctx)
  return admitWorkOn(ctx, fresh, actionLabel)
}

/** The shared work-admission core on a fresh, work-accepting record. */
async function admitWorkOn(
  ctx: EffectContext,
  fresh: MemberInstanceRecordDto,
  actionLabel: string,
): Promise<RuntimeActionEffect> {
  const from = fresh.lifecycle
  let lifecycleCommitted = false
  if (from !== 'RUNNING') {
    const next = validateAdmitWork(fresh)
    lifecycleCommitted = await commitTransition(
      ctx,
      fresh.instanceId,
      from,
      LIFECYCLE_OPERATIONS.ADMIT_WORK,
      next.lifecycle,
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
 * The lifecycle effect (archive/restore/dispose): the transition is
 * validated by the domain/lifecycle FSM (illegal pairs ->
 * LIFECYCLE_TRANSITION_REJECTED, zero writes); without an injected commit
 * port it fails closed (LIFECYCLE_COMMIT_UNAVAILABLE, zero writes); the
 * durable commit goes through the port (state first) and the durable fact
 * is `member-lifecycle-changed` (evidence second).
 */
async function runLifecycle(
  ctx: EffectContext,
  operation: LifecycleOperation,
  requestedTo: 'ARCHIVED' | 'SETTLED' | 'DISPOSED',
): Promise<RuntimeActionEffect> {
  const fresh = requireFreshTarget(ctx)
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
  await commitTransition(ctx, fresh.instanceId, fresh.lifecycle, operation, next.lifecycle, { required: true })
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
async function runDelegate(ctx: EffectContext): Promise<RuntimeActionEffect> {
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
 */
async function commitTransition(
  ctx: EffectContext,
  instanceId: string,
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
      from,
      operation,
      to,
    })
  } catch (error) {
    throw durableFailure('lifecycle transition commit', error, { instanceId, from, operation, to })
  }
  return true
}

/**
 * Commit one durable fact (the evidence half of a two-write effect, or the
 * whole effect for coordination actions). The sequence is ALLOCATED through
 * the ledger's atomic counter (the repository rejects unallocated or
 * above-counter sequences — `RECORD_INVALID`).
 */
async function commitFact(
  ctx: EffectContext,
  factType: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const sequence = await allocateSequenceGuarded(ctx)
  const entry = {
    schemaVersion: 1,
    sequence,
    rootSessionId: ctx.rootSessionId,
    factType,
    payload,
    createdAt: ctx.now(),
  }
  try {
    await ctx.repositories.ledger.put(entry)
  } catch (error) {
    throw durableFailure('fact commit', error, { factType, sequence })
  }
  return sequence
}

async function allocateSequenceGuarded(ctx: EffectContext): Promise<number> {
  try {
    return await ctx.repositories.ledger.allocateSequence()
  } catch (error) {
    throw durableFailure('sequence allocation', error, {})
  }
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
