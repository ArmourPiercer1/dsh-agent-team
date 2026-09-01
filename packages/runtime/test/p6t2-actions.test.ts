/**
 * P6-T2 D/E — the documented enforcement order end-to-end over the real
 * durable world: reads, coordination facts, the compatibility gate
 * (durable state + live evaluation, invariant 50), the lifecycle
 * operations (invariants 52-55), the delegate effect (fresh_per_delegation
 * vs continue, invariants 24/25), and the explicit-creation effect with
 * admit-once replay (invariant 26: creation ONLY through the
 * ActivationProvider — this suite never writes a member record itself).
 */

import { describe, expect, it } from 'vitest'
import { CAPABILITY_NAME_VALUES } from '../../domain/policy/src/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
} from '../admission/index.js'
import type { TeamRuntimeActionOutcome } from '../admission/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import {
  destroyP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2CompatBlockedWorld,
  createP6T2Runtime,
  createP6T2World,
  expectRejection,
  humanCaller,
  makeActionRequest,
  memberCaller,
  memberList,
  p6t2Seed,
  putDurableCompatibilityState,
} from './p6t2-helpers.js'

/** Find one durable ledger fact by type + exact payload match (test probe). */
function findFact(
  world: P6T1World,
  factType: string,
  match: Record<string, unknown>,
): LedgerEntry {
  const entries = world.domain.repositories.ledger.list().filter(
    (entry) => entry.factType === factType,
  )
  const found = entries.find((entry) =>
    Object.entries(match).every(([key, value]) => entry.payload[key] === value),
  )
  if (found === undefined) {
    throw new Error(
      `findFact: no '${factType}' fact matching ${JSON.stringify(match)} — ` +
        `have actions [${entries.map((entry) => String(entry.payload['action'] ?? '?')).join(', ')}]`,
    )
  }
  return found
}

function workAdmittedOf(outcome: TeamRuntimeActionOutcome): {
  readonly instanceId: string
  readonly fromLifecycle: string
  readonly lifecycleCommitted: boolean
  readonly sequence: number
} {
  const effect = outcome.effect
  if (effect.kind !== 'work-admitted') {
    throw new Error(`workAdmittedOf: expected work-admitted, got '${effect.kind}'`)
  }
  return {
    instanceId: effect.instanceId,
    fromLifecycle: effect.fromLifecycle,
    lifecycleCommitted: effect.lifecycleCommitted,
    sequence: effect.sequence,
  }
}

function activatedOf(outcome: TeamRuntimeActionOutcome): {
  readonly instanceId: string
  readonly templateId: string
  readonly childSessionId: string
  readonly replayed: boolean
  readonly operationId: string
} {
  const effect = outcome.effect
  if (effect.kind !== 'member-activated') {
    throw new Error(`activatedOf: expected member-activated, got '${effect.kind}'`)
  }
  return {
    instanceId: effect.instanceId,
    templateId: effect.templateId,
    childSessionId: effect.childSessionId,
    replayed: effect.replayed,
    operationId: effect.operationId,
  }
}

// ---------------------------------------------------------------------------
// D1 — reads, coordination facts, and work admission (follow-up)
// ---------------------------------------------------------------------------
let d1: {
  readonly followUpSettled: {
    readonly instanceId: string
    readonly fromLifecycle: string
    readonly lifecycleCommitted: boolean
    readonly factAction: string
    readonly factTaskSummary?: string
    readonly workerLifecycleAfter: string
  }
  readonly followUpAgain: {
    readonly fromLifecycle: string
    readonly lifecycleCommitted: boolean
  }
  readonly followUpCreated: {
    readonly instanceId: string
    readonly fromLifecycle: string
    readonly lifecycleCommitted: boolean
  }
  readonly membersListed: {
    readonly kind: string
    readonly instanceIds: string[]
  }
  readonly templatesListed: {
    readonly kind: string
    readonly count: number
    readonly workerDisplayName?: string
    readonly scoutContextPolicy?: string
  }
  readonly configInspected: {
    readonly kind: string
    readonly capabilityKeys: string[]
  }
  readonly reportProgress: { readonly kind: string; readonly factProgress?: string }
  readonly sendMessage: { readonly kind: string; readonly factRecipient?: string }
  readonly resolveControl: { readonly kind: string; readonly factDecision?: string }
  readonly requestControl: { readonly kind: string }
}
{
  const world = await createP6T2World('p6t2x-d1', ['leader'], {
    seedMembers: [
      p6t2Seed('worker', { lifecycle: 'SETTLED' }),
      p6t2Seed('scout', { lifecycle: 'CREATED' }),
    ],
  })
  try {
    // D1 wires the P7-T3 lifecycle-commit port (test double): the first
    // follow-up durably resumes the settled worker (SETTLED -> RUNNING),
    // the second follow-up admits work from RUNNING (no transition), and
    // the third resumes the CREATED scout (CREATED -> RUNNING).
    const lifecycleCommit = createFakeLifecycleCommitPort(world)
    const runtime = createP6T2Runtime(world, { lifecycleCommit })
    const workerId = P6T2_SEEDS.worker.instanceId
    const scoutId = P6T2_SEEDS.scout.instanceId

    const firstOutcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: workerId,
        payload: { taskSummary: 'continue p6t2 work', prompt: 'p6t2 d1a follow-up prompt' },
        requestToken: 'tok-p6t2-d1a',
      }),
    )
    const first = workAdmittedOf(firstOutcome)
    const firstFact = findFact(world, 'team-work-admitted', {
      action: 'follow-up',
      targetInstanceId: workerId,
    })
    const workerAfter = world.domain.repositories.memberInstances.get(
      P6T2_ROOT,
      workerId,
    )

    const secondOutcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-d1b',
      }),
    )
    const second = workAdmittedOf(secondOutcome)

    const thirdOutcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: scoutId,
        requestToken: 'tok-p6t2-d1c',
      }),
    )
    const third = workAdmittedOf(thirdOutcome)

    const membersOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'list-members',
        caller: memberCaller(scoutId),
        requestToken: 'tok-p6t2-d1d',
      }),
    )
    const membersEffect = membersOutcome.effect
    const memberIds =
      membersEffect.kind === 'members-listed'
        ? membersEffect.members.map((member) => member.instanceId)
        : []

    const templatesOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'list-templates',
        requestToken: 'tok-p6t2-d1e',
      }),
    )
    const templatesEffect = templatesOutcome.effect
    const templates =
      templatesEffect.kind === 'templates-listed' ? templatesEffect.templates : []

    const configOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'inspect-config',
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-d1f',
      }),
    )
    const configEffect = configOutcome.effect
    const capabilityKeys =
      configEffect.kind === 'config-inspected'
        ? Object.keys(configEffect.effective).sort()
        : []

    const progressOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'report-progress',
        caller: memberCaller(scoutId),
        targetInstanceId: scoutId,
        payload: { progress: 'in-progress', summary: 'scouting started' },
        requestToken: 'tok-p6t2-d1g',
      }),
    )
    const progressEffect = progressOutcome.effect
    const progressFact = findFact(world, 'team-coordination-recorded', {
      action: 'report-progress',
      targetInstanceId: scoutId,
    })

    const messageOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'send-message',
        caller: memberCaller(workerId),
        targetInstanceId: scoutId,
        payload: {
          recipientInstanceId: scoutId,
          subject: 'sync',
          body: 'worker to scout',
        },
        requestToken: 'tok-p6t2-d1h',
      }),
    )
    const messageEffect = messageOutcome.effect
    const messageFact = findFact(world, 'team-coordination-recorded', {
      action: 'send-message',
      recipientInstanceId: scoutId,
    })

    const resolveOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'resolve-control',
        targetInstanceId: scoutId,
        payload: { decision: 'approved' },
        requestToken: 'tok-p6t2-d1i',
      }),
    )
    const resolveEffect = resolveOutcome.effect
    const resolveFact = findFact(world, 'team-coordination-recorded', {
      action: 'resolve-control',
      targetInstanceId: scoutId,
    })

    const controlOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'request-control',
        caller: memberCaller(scoutId),
        targetInstanceId: scoutId,
        payload: { summary: 'needs direction' },
        requestToken: 'tok-p6t2-d1j',
      }),
    )
    const controlEffect = controlOutcome.effect

    d1 = {
      followUpSettled: {
        instanceId: first.instanceId,
        fromLifecycle: first.fromLifecycle,
        lifecycleCommitted: first.lifecycleCommitted,
        factAction: String(firstFact.payload['action']),
        factTaskSummary:
          typeof firstFact.payload['taskSummary'] === 'string'
            ? firstFact.payload['taskSummary']
            : undefined,
        workerLifecycleAfter: workerAfter === undefined ? '<missing>' : workerAfter.lifecycle,
      },
      followUpAgain: {
        fromLifecycle: second.fromLifecycle,
        lifecycleCommitted: second.lifecycleCommitted,
      },
      followUpCreated: {
        instanceId: third.instanceId,
        fromLifecycle: third.fromLifecycle,
        lifecycleCommitted: third.lifecycleCommitted,
      },
      membersListed: {
        kind: membersEffect.kind,
        instanceIds: memberIds,
      },
      templatesListed: {
        kind: templatesEffect.kind,
        count: templates.length,
        workerDisplayName:
          templates.find((template) => template.templateId === 'worker')?.displayName,
        scoutContextPolicy:
          templates.find((template) => template.templateId === 'scout')?.contextPolicy,
      },
      configInspected: {
        kind: configEffect.kind,
        capabilityKeys,
      },
      reportProgress: {
        kind: progressEffect.kind,
        factProgress:
          typeof progressFact.payload['progress'] === 'string'
            ? progressFact.payload['progress']
            : undefined,
      },
      sendMessage: {
        kind: messageEffect.kind,
        factRecipient:
          typeof messageFact.payload['recipientInstanceId'] === 'string'
            ? messageFact.payload['recipientInstanceId']
            : undefined,
      },
      resolveControl: {
        kind: resolveEffect.kind,
        factDecision:
          typeof resolveFact.payload['decision'] === 'string'
            ? resolveFact.payload['decision']
            : undefined,
      },
      requestControl: { kind: controlEffect.kind },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// D2 — the LIVE compatibility gate (environment probe degraded)
// ---------------------------------------------------------------------------
let d2: {
  readonly delegate: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
  readonly followUp: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
  readonly readsExempt: { readonly kind: string; readonly count: number }
}
{
  const world = await createP6T2CompatBlockedWorld('p6t2x-d2', ['leader', 'worker'])
  try {
    const runtime = createP6T2Runtime(world)
    const workerId = P6T2_SEEDS.worker.instanceId

    const beforeDelegate = world.seam.writeCount
    const delegate = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        payload: { label: 'blocked-scout', prompt: 'p6t2 d2a delegate prompt' },
        requestToken: 'tok-p6t2-d2a',
      }),
      TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
    )
    const beforeFollowUp = world.seam.writeCount
    const followUp = await expectRejection(
      runtime,
      makeActionRequest({
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-d2b',
      }),
      TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
    )
    const readsOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'list-members',
        requestToken: 'tok-p6t2-d2c',
      }),
    )
    const readsEffect = readsOutcome.effect

    d2 = {
      delegate: {
        code: delegate.code,
        details: delegate.details,
        newWrites: world.seam.writeCount - beforeDelegate,
      },
      followUp: {
        code: followUp.code,
        details: followUp.details,
        newWrites: world.seam.writeCount - beforeFollowUp,
      },
      readsExempt: {
        kind: readsEffect.kind,
        count:
          readsEffect.kind === 'members-listed' ? readsEffect.members.length : -1,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// D3 — the DURABLE compatibility state (authoritative over the probe)
// ---------------------------------------------------------------------------
let d3: {
  readonly followUp: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
  readonly readsExempt: { readonly kind: string }
}
{
  const world = await createP6T2World('p6t2x-d3', ['leader', 'worker'])
  try {
    await putDurableCompatibilityState(world, 'BLOCKED_FATAL')
    const runtime = createP6T2Runtime(world)

    const beforeFollowUp = world.seam.writeCount
    const followUp = await expectRejection(
      runtime,
      makeActionRequest({
        targetInstanceId: P6T2_SEEDS.worker.instanceId,
        requestToken: 'tok-p6t2-d3a',
      }),
      TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
    )
    const readsOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'list-members',
        requestToken: 'tok-p6t2-d3b',
      }),
    )

    d3 = {
      followUp: {
        code: followUp.code,
        details: followUp.details,
        newWrites: world.seam.writeCount - beforeFollowUp,
      },
      readsExempt: { kind: readsOutcome.effect.kind },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// E1 — lifecycle operations (invariants 52-55)
// ---------------------------------------------------------------------------
let e1: {
  readonly archiveSettled: {
    readonly kind: string
    readonly from?: string
    readonly to?: string
    readonly factFrom?: string
    readonly factTo?: string
    readonly activityVersionAfter: number
    readonly portCalls: number
  }
  readonly restoreArchived: {
    readonly kind: string
    readonly to?: string
    readonly portCalls: number
  }
  readonly archiveRunning: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
    readonly portCalls: number
  }
  readonly leaderDispose: {
    readonly code: string
    readonly newWrites: number
  }
  readonly humanDispose: { readonly kind: string; readonly from?: string; readonly to?: string }
  readonly followUpDisposed: {
    readonly code: string
    readonly newWrites: number
  }
  readonly archiveDisposed: {
    readonly code: string
    readonly newWrites: number
  }
}
{
  const world = await createP6T2World('p6t2x-e1', ['leader'], {
    seedMembers: [
      p6t2Seed('worker', { lifecycle: 'SETTLED' }),
      p6t2Seed('scout'),
    ],
  })
  try {
    // E1 wires the P7-T3 lifecycle-commit port (test double): every
    // successful transition commits durably through it, and its call log
    // proves the rejected transitions never reached the port.
    const lifecycleCommit = createFakeLifecycleCommitPort(world)
    const runtime = createP6T2Runtime(world, { lifecycleCommit })
    const workerId = P6T2_SEEDS.worker.instanceId
    const scoutId = P6T2_SEEDS.scout.instanceId

    const archiveOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'archive-member',
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-e1a',
      }),
    )
    const archiveEffect = archiveOutcome.effect
    const archiveFact = findFact(world, 'member-lifecycle-changed', {
      action: 'archive-member',
      instanceId: workerId,
    })
    const workerArchived = world.domain.repositories.memberInstances.get(
      P6T2_ROOT,
      workerId,
    )
    const portCallsAfterArchive = lifecycleCommit.calls.length

    const restoreOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'restore-member',
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-e1b',
      }),
    )
    const restoreEffect = restoreOutcome.effect
    const portCallsAfterRestore = lifecycleCommit.calls.length

    const beforeArchiveRunning = world.seam.writeCount
    const portCallsBeforeArchiveRunning = lifecycleCommit.calls.length
    const archiveRunning = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'archive-member',
        targetInstanceId: scoutId,
        requestToken: 'tok-p6t2-e1c',
      }),
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
    )
    const portCallsAfterArchiveRunning = lifecycleCommit.calls.length
    const archiveRunningNewWrites = world.seam.writeCount - beforeArchiveRunning

    const beforeLeaderDispose = world.seam.writeCount
    const leaderDispose = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'dispose-member',
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-e1d',
      }),
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    const leaderDisposeNewWrites = world.seam.writeCount - beforeLeaderDispose

    const humanDisposeOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'dispose-member',
        caller: humanCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-e1e',
      }),
    )
    const humanDisposeEffect = humanDisposeOutcome.effect

    const beforeFollowUp = world.seam.writeCount
    const followUp = await expectRejection(
      runtime,
      makeActionRequest({
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-e1f',
      }),
      TEAM_RUNTIME_ERROR_CODES.WORK_STATE_REJECTED,
    )
    const followUpNewWrites = world.seam.writeCount - beforeFollowUp

    const beforeArchiveDisposed = world.seam.writeCount
    const archiveDisposed = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'archive-member',
        targetInstanceId: workerId,
        requestToken: 'tok-p6t2-e1g',
      }),
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
    )
    const archiveDisposedNewWrites = world.seam.writeCount - beforeArchiveDisposed

    e1 = {
      archiveSettled: {
        kind: archiveEffect.kind,
        ...(archiveEffect.kind === 'lifecycle-changed'
          ? { from: archiveEffect.from, to: archiveEffect.to }
          : {}),
        factFrom:
          typeof archiveFact.payload['from'] === 'string'
            ? archiveFact.payload['from']
            : undefined,
        factTo:
          typeof archiveFact.payload['to'] === 'string'
            ? archiveFact.payload['to']
            : undefined,
        activityVersionAfter:
          workerArchived === undefined ? -1 : workerArchived.activityVersion,
        portCalls: portCallsAfterArchive,
      },
      restoreArchived: {
        kind: restoreEffect.kind,
        ...(restoreEffect.kind === 'lifecycle-changed'
          ? { to: restoreEffect.to }
          : {}),
        portCalls: portCallsAfterRestore,
      },
      archiveRunning: {
        code: archiveRunning.code,
        details: archiveRunning.details,
        newWrites: archiveRunningNewWrites,
        portCalls: portCallsAfterArchiveRunning - portCallsBeforeArchiveRunning,
      },
      leaderDispose: {
        code: leaderDispose.code,
        newWrites: leaderDisposeNewWrites,
      },
      humanDispose: {
        kind: humanDisposeEffect.kind,
        ...(humanDisposeEffect.kind === 'lifecycle-changed'
          ? { from: humanDisposeEffect.from, to: humanDisposeEffect.to }
          : {}),
      },
      followUpDisposed: {
        code: followUp.code,
        newWrites: followUpNewWrites,
      },
      archiveDisposed: {
        code: archiveDisposed.code,
        newWrites: archiveDisposedNewWrites,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// The DEFAULT P6-T2 wiring has NO lifecycle commit port (P7-T3 provides
// it): a lifecycle action must fail closed with zero durable writes.
let e1NoPort: {
  readonly archiveUncommitted: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
}
{
  const noPortWorld = await createP6T2World('p6t2x-e1n', ['leader'], {
    seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })],
  })
  try {
    const noPortRuntime = createP6T2Runtime(noPortWorld)
    const before = noPortWorld.seam.writeCount
    const rejection = await expectRejection(
      noPortRuntime,
      makeActionRequest({
        action: 'archive-member',
        targetInstanceId: P6T2_SEEDS.worker.instanceId,
        requestToken: 'tok-p6t2-e1n',
      }),
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
    )
    e1NoPort = {
      archiveUncommitted: {
        code: rejection.code,
        details: rejection.details,
        newWrites: noPortWorld.seam.writeCount - before,
      },
    }
  } finally {
    await destroyP6T1World(noPortWorld)
  }
}

// ---------------------------------------------------------------------------
// E2 — the delegate effect (continue vs fresh_per_delegation)
// ---------------------------------------------------------------------------
let e2: {
  readonly continued: {
    readonly kind: string
    readonly instanceId?: string
    readonly fromLifecycle?: string
    readonly lifecycleCommitted?: boolean
    readonly childSessionIdBefore: string
    readonly childSessionIdAfter: string
    readonly childFactoryCalls: number
    readonly memberCount: number
    readonly factAction?: string
  }
  readonly fresh: {
    readonly kind: string
    readonly instanceId?: string
    readonly childSessionId?: string
    readonly replayed?: boolean
    readonly childFactoryCalls: number
    readonly memberCount: number
    readonly freshMemberExists: boolean
    readonly distinctChild: boolean
  }
  readonly unresolvedTarget: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
}
{
  const world = await createP6T2World('p6t2x-e2', ['leader'], {
    seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })],
  })
  try {
    // E2 wires the P7-T3 lifecycle-commit port (test double): the
    // continued delegate work-admission durably resumes the settled worker
    // (SETTLED -> RUNNING).
    const lifecycleCommit = createFakeLifecycleCommitPort(world)
    const runtime = createP6T2Runtime(world, { lifecycleCommit })
    const workerId = P6T2_SEEDS.worker.instanceId
    const childBefore = world.domain.repositories.memberInstances.get(
      P6T2_ROOT,
      workerId,
    )?.childSessionId ?? '<missing>'
    const callsBefore = world.childFactory.calls.length

    const continuedOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: workerId,
        payload: { label: 'delegate-cont', prompt: 'p6t2 e2a continue prompt' },
        requestToken: 'tok-p6t2-e2a',
      }),
    )
    const continuedEffect = continuedOutcome.effect
    const continuedFact = findFact(world, 'team-work-admitted', {
      action: 'delegate',
      targetInstanceId: workerId,
    })
    const childAfter = world.domain.repositories.memberInstances.get(
      P6T2_ROOT,
      workerId,
    )?.childSessionId ?? '<missing>'
    // Captured BEFORE the fresh delegation: the fresh path adds one child
    // factory call and one member to the final state.
    const continuedChildFactoryCalls = world.childFactory.calls.length - callsBefore
    const continuedMemberCount = memberList(world).length

    const freshOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'scout',
        payload: { label: 'scout-delegated', prompt: 'p6t2 e2b fresh prompt' },
        requestToken: 'tok-p6t2-e2b',
      }),
    )
    const freshEffect = freshOutcome.effect
    const fresh =
      freshEffect.kind === 'member-activated'
        ? {
            instanceId: freshEffect.instanceId,
            childSessionId: freshEffect.childSessionId,
            replayed: freshEffect.replayed,
          }
        : { instanceId: undefined, childSessionId: undefined, replayed: undefined }
    const freshMember =
      fresh.instanceId === undefined
        ? undefined
        : world.domain.repositories.memberInstances.get(
            P6T2_ROOT,
            fresh.instanceId,
          )

    const beforeUnresolved = world.seam.writeCount
    const unresolved = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'delegate',
        delegationInstanceId: 'inst-p6t2gone01',
        payload: { label: 'ghost', prompt: 'p6t2 e2c ghost prompt' },
        requestToken: 'tok-p6t2-e2c',
      }),
      TEAM_RUNTIME_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED,
    )

    e2 = {
      continued: {
        kind: continuedEffect.kind,
        ...(continuedEffect.kind === 'work-admitted'
          ? {
              instanceId: continuedEffect.instanceId,
              fromLifecycle: continuedEffect.fromLifecycle,
              lifecycleCommitted: continuedEffect.lifecycleCommitted,
            }
          : {}),
        childSessionIdBefore: childBefore,
        childSessionIdAfter: childAfter,
        childFactoryCalls: continuedChildFactoryCalls,
        memberCount: continuedMemberCount,
        factAction:
          typeof continuedFact.payload['action'] === 'string'
            ? continuedFact.payload['action']
            : undefined,
      },
      fresh: {
        kind: freshEffect.kind,
        instanceId: fresh.instanceId,
        childSessionId: fresh.childSessionId,
        replayed: fresh.replayed,
        childFactoryCalls: world.childFactory.calls.length - callsBefore,
        memberCount: memberList(world).length,
        freshMemberExists: freshMember !== undefined,
        distinctChild:
          fresh.childSessionId !== undefined &&
          fresh.childSessionId !== childBefore,
      },
      unresolvedTarget: {
        code: unresolved.code,
        details: unresolved.details,
        newWrites: world.seam.writeCount - beforeUnresolved,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// E3 — explicit creation (provider-only, invariant 26) + admit-once replay
// ---------------------------------------------------------------------------
let e3: {
  readonly humanCreate: {
    readonly kind: string
    readonly instanceId?: string
    readonly memberExists: boolean
    readonly teamTotalAfter: number
  }
  readonly leaderCreate: {
    readonly kind: string
    readonly teamTotalAfter: number
  }
  readonly memberCreate: {
    readonly code: string
    readonly details?: Record<string, unknown>
    readonly newWrites: number
  }
  readonly replay: {
    readonly kind: string
    readonly replayed?: boolean
    readonly sameInstance: boolean
    readonly newWrites: number
  }
}
{
  const world = await createP6T2World('p6t2x-e3', ['leader'], {
    seedMembers: [p6t2Seed('scout')],
  })
  try {
    const runtime = createP6T2Runtime(world)

    const humanOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'create-member',
        caller: humanCaller(),
        delegationTemplateId: 'worker',
        payload: { label: 'human-worker' },
        requestToken: 'tok-p6t2-e3a',
      }),
    )
    const humanEffect = humanOutcome.effect
    const humanActivated =
      humanEffect.kind === 'member-activated'
        ? activatedOf(humanOutcome)
        : { instanceId: undefined }
    const humanMember =
      humanActivated.instanceId === undefined
        ? undefined
        : world.domain.repositories.memberInstances.get(
            P6T2_ROOT,
            humanActivated.instanceId,
          )
    // Captured BEFORE the leader create: the final state adds one more.
    const humanTeamTotalAfter = memberList(world).length

    const leaderOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'create-member',
        delegationTemplateId: 'worker',
        payload: { label: 'leader-worker' },
        requestToken: 'tok-p6t2-e3b',
      }),
    )
    const leaderEffect = leaderOutcome.effect

    const beforeMemberCreate = world.seam.writeCount
    const memberCreate = await expectRejection(
      runtime,
      makeActionRequest({
        action: 'create-member',
        caller: memberCaller(P6T2_SEEDS.scout.instanceId),
        delegationTemplateId: 'worker',
        payload: { label: 'scout-worker' },
        requestToken: 'tok-p6t2-e3c',
      }),
      TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
    )

    const beforeReplay = world.seam.writeCount
    const replayOutcome = await runtime.performAction(
      makeActionRequest({
        action: 'create-member',
        caller: humanCaller(),
        delegationTemplateId: 'worker',
        payload: { label: 'human-worker' },
        requestToken: 'tok-p6t2-e3a',
      }),
    )
    const replayEffect = replayOutcome.effect
    const replayActivated =
      replayEffect.kind === 'member-activated'
        ? activatedOf(replayOutcome)
        : { instanceId: undefined, replayed: undefined }

    e3 = {
      humanCreate: {
        kind: humanEffect.kind,
        instanceId: humanActivated.instanceId,
        memberExists: humanMember !== undefined,
        teamTotalAfter: humanTeamTotalAfter,
      },
      leaderCreate: {
        kind: leaderEffect.kind,
        teamTotalAfter: memberList(world).length,
      },
      memberCreate: {
        code: memberCreate.code,
        details: memberCreate.details,
        newWrites: world.seam.writeCount - beforeMemberCreate,
      },
      replay: {
        kind: replayEffect.kind,
        replayed: replayActivated.replayed,
        sameInstance:
          replayActivated.instanceId !== undefined &&
          replayActivated.instanceId === humanActivated.instanceId,
        newWrites: world.seam.writeCount - beforeReplay,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T2 D1: reads, coordination facts, and follow-up work admission', () => {
  it('follow-up on a SETTLED worker resumes it to RUNNING (commit port, durable fact team-work-admitted)', () => {
    expect(d1.followUpSettled.instanceId).toBe(P6T2_SEEDS.worker.instanceId)
    expect(d1.followUpSettled.fromLifecycle).toBe('SETTLED')
    expect(d1.followUpSettled.lifecycleCommitted).toBe(true)
    expect(d1.followUpSettled.factAction).toBe('follow-up')
    expect(d1.followUpSettled.factTaskSummary).toBe('continue p6t2 work')
    expect(d1.followUpSettled.workerLifecycleAfter).toBe('RUNNING')
  })

  it('a second follow-up on the RUNNING worker admits work WITHOUT re-transitioning', () => {
    expect(d1.followUpAgain.fromLifecycle).toBe('RUNNING')
    expect(d1.followUpAgain.lifecycleCommitted).toBe(false)
  })

  it('follow-up on a CREATED scout resumes it to RUNNING (commit port)', () => {
    expect(d1.followUpCreated.instanceId).toBe(P6T2_SEEDS.scout.instanceId)
    expect(d1.followUpCreated.fromLifecycle).toBe('CREATED')
    expect(d1.followUpCreated.lifecycleCommitted).toBe(true)
  })

  it('list-members (by a member caller) lists every instance by instanceId', () => {
    expect(d1.membersListed.kind).toBe('members-listed')
    expect(
      d1.membersListed.instanceIds.includes(P6T2_SEEDS.leader.instanceId),
    ).toBe(true)
    expect(
      d1.membersListed.instanceIds.includes(P6T2_SEEDS.worker.instanceId),
    ).toBe(true)
    expect(
      d1.membersListed.instanceIds.includes(P6T2_SEEDS.scout.instanceId),
    ).toBe(true)
    expect(d1.membersListed.instanceIds.length).toBe(3)
  })

  it('list-templates lists leader + member templates with display names + context policies', () => {
    expect(d1.templatesListed.kind).toBe('templates-listed')
    expect(d1.templatesListed.count).toBe(3)
    expect(d1.templatesListed.workerDisplayName).toBe('Worker')
    expect(d1.templatesListed.scoutContextPolicy).toBe('fresh_per_delegation')
  })

  it('inspect-config resolves the effective policy: every closed capability appears once', () => {
    expect(d1.configInspected.kind).toBe('config-inspected')
    expect(d1.configInspected.capabilityKeys).toEqual(
      [...CAPABILITY_NAME_VALUES].sort(),
    )
  })

  it('report-progress (self) records a coordination fact with the closed progress value', () => {
    expect(d1.reportProgress.kind).toBe('fact-recorded')
    expect(d1.reportProgress.factProgress).toBe('in-progress')
  })

  it('send-message records a coordination fact addressed BY INSTANCE ID', () => {
    expect(d1.sendMessage.kind).toBe('fact-recorded')
    expect(d1.sendMessage.factRecipient).toBe(P6T2_SEEDS.scout.instanceId)
  })

  it('resolve-control records a coordination fact with the closed decision value', () => {
    expect(d1.resolveControl.kind).toBe('fact-recorded')
    expect(d1.resolveControl.factDecision).toBe('approved')
  })

  it('request-control (self, scout) records a coordination fact', () => {
    expect(d1.requestControl.kind).toBe('fact-recorded')
  })
})

describe('P6-T2 D2: the live compatibility gate blocks NEW WORK (invariant 50)', () => {
  it('delegate is blocked (source live-evaluation), zero writes', () => {
    expect(d2.delegate.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(d2.delegate.details?.['source']).toBe('live-evaluation')
    expect(d2.delegate.newWrites).toBe(0)
  })

  it('follow-up is blocked (source live-evaluation), zero writes', () => {
    expect(d2.followUp.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(d2.followUp.details?.['source']).toBe('live-evaluation')
    expect(d2.followUp.newWrites).toBe(0)
  })

  it('reads stay open while NEW WORK is blocked', () => {
    expect(d2.readsExempt.kind).toBe('members-listed')
    expect(d2.readsExempt.count).toBe(2)
  })
})

describe('P6-T2 D3: the durable compatibility state is authoritative', () => {
  it('a durable BLOCKED_FATAL blocks follow-up (source durable-state), zero writes', () => {
    expect(d3.followUp.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
    expect(d3.followUp.details?.['source']).toBe('durable-state')
    expect(d3.followUp.details?.['status']).toBe('BLOCKED_FATAL')
    expect(d3.followUp.newWrites).toBe(0)
  })

  it('reads stay open while the durable state blocks NEW WORK', () => {
    expect(d3.readsExempt.kind).toBe('members-listed')
  })
})

describe('P6-T2 E1: lifecycle operations (invariants 52-55)', () => {
  it('archive: SETTLED -> ARCHIVED (commit port called once, durable record re-put, fact recorded)', () => {
    expect(e1.archiveSettled.kind).toBe('lifecycle-changed')
    expect(e1.archiveSettled.from).toBe('SETTLED')
    expect(e1.archiveSettled.to).toBe('ARCHIVED')
    expect(e1.archiveSettled.factFrom).toBe('SETTLED')
    expect(e1.archiveSettled.factTo).toBe('ARCHIVED')
    expect(e1.archiveSettled.activityVersionAfter).toBe(2)
    expect(e1.archiveSettled.portCalls).toBe(1)
  })

  it('restore: ARCHIVED -> SETTLED (no agent resume — the router never touches the child session)', () => {
    expect(e1.restoreArchived.kind).toBe('lifecycle-changed')
    expect(e1.restoreArchived.to).toBe('SETTLED')
    // Two successful transitions so far (archive + restore): two commits.
    expect(e1.restoreArchived.portCalls).toBe(2)
  })

  it('archive of a RUNNING member is rejected (SETTLE-then-ARCHIVE is the only path), zero writes, port never called', () => {
    expect(e1.archiveRunning.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
    )
    expect((e1.archiveRunning.details ?? {})['from']).toBe('RUNNING')
    expect(e1.archiveRunning.newWrites).toBe(0)
    // The port log is UNCHANGED by the rejected transition: the FSM check
    // precedes the commit port.
    expect(e1.archiveRunning.portCalls).toBe(0)
  })

  it('the leader dispose is out of envelope (the P6-T2 teamEnvelope lacks dispose-member), zero writes', () => {
    expect(e1.leaderDispose.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    expect(e1.leaderDispose.newWrites).toBe(0)
  })

  it('the human dispose executes: SETTLED -> DISPOSED', () => {
    expect(e1.humanDispose.kind).toBe('lifecycle-changed')
    expect(e1.humanDispose.from).toBe('SETTLED')
    expect(e1.humanDispose.to).toBe('DISPOSED')
  })

  it('follow-up on a DISPOSED member is rejected (terminal), zero writes', () => {
    expect(e1.followUpDisposed.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.WORK_STATE_REJECTED,
    )
    expect(e1.followUpDisposed.newWrites).toBe(0)
  })

  it('archiving a DISPOSED member is rejected (terminal lifecycle), zero writes', () => {
    expect(e1.archiveDisposed.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
    )
    expect(e1.archiveDisposed.newWrites).toBe(0)
  })

  it('a lifecycle action with no commit port fails closed (LIFECYCLE_COMMIT_UNAVAILABLE), zero writes', () => {
    expect(e1NoPort.archiveUncommitted.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
    )
    expect(e1NoPort.archiveUncommitted.newWrites).toBe(0)
  })
})

describe('P6-T2 E2: the delegate effect — continue vs fresh_per_delegation', () => {
  it('delegate by instanceId CONTINUES the existing instance (same child session, no new instance, no child factory call)', () => {
    expect(e2.continued.kind).toBe('work-admitted')
    expect(e2.continued.instanceId).toBe(P6T2_SEEDS.worker.instanceId)
    expect(e2.continued.fromLifecycle).toBe('SETTLED')
    expect(e2.continued.lifecycleCommitted).toBe(true)
    expect(e2.continued.childSessionIdBefore).toBe('session-child-p6t2-w1')
    expect(e2.continued.childSessionIdAfter).toBe(e2.continued.childSessionIdBefore)
    expect(e2.continued.childFactoryCalls).toBe(0)
    expect(e2.continued.memberCount).toBe(2)
    expect(e2.continued.factAction).toBe('delegate')
  })

  it('delegate by templateId CREATES a fresh instance (fresh_per_delegation: new instance + new child session + child factory call)', () => {
    expect(e2.fresh.kind).toBe('member-activated')
    expect(
      e2.fresh.instanceId !== undefined && e2.fresh.instanceId.startsWith('inst-'),
    ).toBe(true)
    expect(e2.fresh.replayed).toBe(false)
    expect(e2.fresh.childFactoryCalls).toBe(1)
    expect(e2.fresh.memberCount).toBe(3)
    expect(e2.fresh.freshMemberExists).toBe(true)
    expect(e2.fresh.distinctChild).toBe(true)
  })

  it('delegate to a nonexistent instanceId is rejected (DELEGATION_TARGET_UNRESOLVED), zero writes', () => {
    expect(e2.unresolvedTarget.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED,
    )
    expect(e2.unresolvedTarget.newWrites).toBe(0)
  })
})

describe('P6-T2 E3: explicit creation (provider-only) + admit-once replay', () => {
  it('a human create-member activates a new member through the provider', () => {
    expect(e3.humanCreate.kind).toBe('member-activated')
    expect(
      e3.humanCreate.instanceId !== undefined &&
        e3.humanCreate.instanceId.startsWith('inst-'),
    ).toBe(true)
    expect(e3.humanCreate.memberExists).toBe(true)
    expect(e3.humanCreate.teamTotalAfter).toBe(3)
  })

  it('a leader create-member activates at the exact team limit (seeded 2 + 2 created = 4 = team maxInstances)', () => {
    expect(e3.leaderCreate.kind).toBe('member-activated')
    expect(e3.leaderCreate.teamTotalAfter).toBe(4)
  })

  it('a member create-member is a closed-role-set denial, zero writes', () => {
    expect(e3.memberCreate.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.CALLER_AUTHORITY_DENIED,
    )
    expect(e3.memberCreate.details?.['allowed']).toEqual(['human', 'leader'])
    expect(e3.memberCreate.newWrites).toBe(0)
  })

  it('a same-token replay converges: member-activated + replayed, same instance, zero writes', () => {
    expect(e3.replay.kind).toBe('member-activated')
    expect(e3.replay.replayed).toBe(true)
    expect(e3.replay.sameInstance).toBe(true)
    expect(e3.replay.newWrites).toBe(0)
  })
})
