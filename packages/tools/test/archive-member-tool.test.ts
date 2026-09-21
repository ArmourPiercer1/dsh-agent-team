/**
 * archive-member-tool.test.ts — team_archive_member: the THIRTEENTH closed
 * team tool (the archive-member round). The Leader's lifecycle-management
 * surface: it closes the gap where archiving a member was only reachable
 * over the human remote channel (`member.archive`) or the runtime facade
 * (`archive-member` action), and the Leader's model-facing catalog had no
 * tool for it.
 *
 * Wiring (the production shape, unit-test stand-ins): the REAL
 * `createTeamTools` stack over the P6-T2 durable world with the fake
 * lifecycle-commit port (every successful transition commits through the
 * REAL repository CAS and is recorded), the sanctioned satellite set
 * (control / messaging / activity / fake session input), and the P6-T6
 * caller map (the root session resolves to the leader, each seeded member
 * session to its member identity).
 *
 * Contract (asserted on the lossless-JSON result union + durable state):
 *   A1 the catalog: `team_archive_member` is the 13th (LAST) tool —
 *        registration order preserved for the first twelve (selection
 *        indices unchanged); the parameter shape is closed
 *        (rootSessionId + requestToken + targetInstanceId, all required,
 *        no additional properties);
 *   A2 guard last-mile (SD-GUARD), pending: a durable leader-approval
 *        gate for the EXACT scope (actionName `archive-member`, toolName
 *        `team_archive_member`, correlation = the call's requestToken)
 *        with no decision yet → blocked `request-pending`, zero
 *        lifecycle commits, the target stays SETTLED;
 *   A3 guard last-mile, decision-deny: the leader denies the gate → the
 *        same logical operation is still blocked `decision-deny`;
 *   A4 guard last-mile, allow: a fresh gate is allowed → the FIRST
 *        execution runs: `executed` with the `lifecycle-changed` effect
 *        (SETTLED → ARCHIVED), the durable record is ARCHIVED, and the
 *        fake commit port records exactly one ARCHIVE call; the RETRY of
 *        the same logical operation (same token) is blocked again — the
 *        one-shot allow is consumed (and, for archive, the now-ARCHIVED
 *        target is no longer guard-live either: the liveness verdict is
 *        final and precedes the consumption verdict) — no second commit;
 *   A5 the FSM verdict (the P6-T2 default wiring): archiving a RUNNING
 *        member is rejected `LIFECYCLE_TRANSITION_REJECTED` (no
 *        RUNNING → ARCHIVED edge — the production step-port row
 *        quiesces the member settle-then-archive, Architecture §30; the
 *        tool carries the router's typed rejection through verbatim),
 *        zero commits, the target stays RUNNING;
 *   A6 guard last-mile, target liveness: an already-ARCHIVED member is
 *        not a live target (guard live set = CREATED/RUNNING/SETTLED) →
 *        blocked `target-stale`, the runtime is never called;
 *   A7 the tool-layer leader gate (the C1 precedent, enforced BEFORE any
 *        effect or guard consult): a MEMBER caller — archiving another
 *        member AND archiving itself — is rejected
 *        `TEAM_TOOL_ARCHIVE_NOT_LEADER` with zero side effects;
 *   A8 guard last-mile, disposed target: a DISPOSED member → blocked
 *        `target-stale`, zero commits;
 *   A9 argument validation: a missing targetInstanceId is rejected
 *        `TEAM_TOOL_BAD_ARGUMENTS` (the closed argument contract);
 *   B1 the PRODUCTION P7-T3 row (the step ports installed — the
 *        production archive behavior, Architecture §30): the SAME
 *        `team_archive_member.execute(...)` against a RUNNING resident
 *        member runs the real P7-T3 `archiveMember` core through the
 *        router — quiesce FIRST (close admission → interrupt → drain →
 *        wait quiescence → release residency), then the two durable
 *        commits in the frozen order: RUNNING → SETTLE → SETTLED, then
 *        SETTLED → ARCHIVE → ARCHIVED — `executed` with the
 *        `lifecycle-changed` effect (from RUNNING, to ARCHIVED), the
 *        durable record ARCHIVED, and the commit port recording exactly
 *        those two CAS transitions;
 *   B2 quiesce failure (the same production row): a live-effect fault
 *        in the interrupt step aborts the procedure → rejected
 *        `LIFECYCLE_LIVE_EFFECT_FAILED`, ZERO durable lifecycle commits,
 *        the target stays RUNNING, the residency unreleased.
 */
import { describe, expect, it } from 'vitest'
import { createActivityLedger } from '../../runtime/activity/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../../runtime/admission/index.js'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../../runtime/control/index.js'
import { createMessagingCoordinator } from '../../runtime/messaging/index.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2Runtime,
  createP6T2World,
  leaderCaller,
  p6t2Seed,
} from '../../runtime/test/p6t2-helpers.js'
import type { P6T2LifecycleCommitCall } from '../../runtime/test/p6t2-helpers.js'
import type { LifecyclePorts } from '../../runtime/lifecycle/index.js'
import {
  P7T3ActivityFake,
  P7T3AdmissionFake,
  P7T3Clock,
  P7T3CommitFake,
  P7T3DescendantsFake,
  P7T3ResidencyFake,
} from '../../runtime/test/p7t3-helpers.js'
import type { P7T3CommitCall } from '../../runtime/test/p7t3-helpers.js'
import { createTeamTools } from '../src/index.js'
import type { TeamToolsResult } from '../src/index.js'
import {
  createFakeSessionInput,
  createP6T6CallerMap,
  runTool,
} from './p6t6-helpers.js'
import type { P6T6World } from './p6t6-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const WORKER2_ID = String(P6T2_SEEDS.worker2.instanceId)
const SCOUT_ID = String(P6T2_SEEDS.scout.instanceId)
const WORKER_SESSION = String(P6T2_SEEDS.worker.childSessionId)

function archiveArgs(requestToken: string, targetInstanceId: string): Record<string, unknown> {
  return { rootSessionId: P6T2_ROOT, requestToken, targetInstanceId }
}

/** Everything the scenarios produce (the `it` bodies stay sync). */
interface ArchiveScenario {
  readonly toolNames: readonly string[]
  readonly archiveParameters: {
    readonly type: string
    readonly properties: Record<string, unknown>
    readonly required: readonly string[]
    readonly additionalProperties: boolean
  }
  readonly blockedPending: TeamToolsResult
  readonly worker2Before: string
  readonly portCallsAfterPending: number
  readonly blockedDeny: TeamToolsResult
  readonly executed: TeamToolsResult
  readonly worker2After: string
  readonly portCallsAfterAllow: readonly P6T2LifecycleCommitCall[]
  readonly blockedConsumed: TeamToolsResult
  readonly portCallsAfterRetry: number
  readonly gateRequestId: string
  readonly gate2RequestId: string
  readonly rejectedRunning: TeamToolsResult
  readonly workerAfter: string
  readonly portCallsAfterRunning: number
  readonly blockedArchivedTarget: TeamToolsResult
  readonly portCallsAfterArchivedTarget: number
  readonly rejectedMember: TeamToolsResult
  readonly rejectedSelf: TeamToolsResult
  readonly portCallsAfterMember: number
  readonly blockedDisposed: TeamToolsResult
  readonly portCallsAfterDisposed: number
  readonly rejectedArgs: TeamToolsResult
  readonly portCallsFinal: number
}

const A = await (async (): Promise<ArchiveScenario> => {
  // The P6-T2 durable world: the leader + a RUNNING worker + a SETTLED
  // worker2 (the archive target) + a DISPOSED scout (the target-stale
  // construction, seeded non-live like the P6-T2 stale suites do).
  const world = await createP6T2World(
    'archive-member-tool',
    ['leader', 'worker'],
    {
      seedMembers: [
        p6t2Seed('worker2', { lifecycle: 'SETTLED' }),
        p6t2Seed('scout', { lifecycle: 'DISPOSED' }),
      ],
    },
  )
  try {
    // The fake lifecycle-commit port: every successful transition commits
    // through the REAL repository CAS; the call log proves the rejected /
    // blocked attempts never reached the commit.
    const lifecyclePort = createFakeLifecycleCommitPort(world)
    const runtime = createP6T2Runtime(world, { lifecycleCommit: lifecyclePort })
    const control = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
    })
    const sessionInput = createFakeSessionInput()
    const messaging = createMessagingCoordinator({
      teamRuntime: runtime,
      teamDomain: world.domain,
      sessionInput,
      now: () => P6T2_NOW,
    })
    const activity = createActivityLedger({
      teamDomain: world.domain,
      runtime,
      now: () => P6T2_NOW,
    })
    const callerMap = createP6T6CallerMap(['leader', 'worker'])
    const { tools } = createTeamTools({
      teamRuntime: runtime,
      controlService: control,
      messaging,
      activity,
      async resolveCaller(sessionId: string) {
        const caller = callerMap.bySession.get(sessionId)
        if (caller === undefined) {
          throw new Error(`archive-member-tool: no caller for session ${sessionId}`)
        }
        // P0: the single-root fixture world — every seeded session owns
        // the fixture root.
        return { caller, rootSessionId: String(P6T2_ROOT) }
      },
    })
    const env: P6T6World = {
      world,
      runtime,
      control,
      sessionInput,
      messaging,
      activity,
      callerMap,
      tools,
      findTool(name: string) {
        const tool = tools.find((candidate) => candidate.name === name)
        if (tool === undefined) {
          throw new Error(`archive-member-tool: no registered tool named ${name}`)
        }
        return tool
      },
    }

    const worker2Lifecycle = (instanceId: string): string => {
      const record = world.domain.repositories.memberInstances.get(P6T2_ROOT, instanceId)
      if (record === undefined) {
        throw new Error(`archive-member-tool: member '${instanceId}' missing`)
      }
      return String(record.lifecycle)
    }

    // (A2) guard last-mile, pending: a durable leader-approval gate for
    // the EXACT archive scope (correlation = the call's requestToken)
    // with no decision yet → blocked, zero commits.
    const gate = await control.requestControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER2_ID,
      actionName: 'archive-member',
      toolName: 'team_archive_member',
      correlation: 'tok-am-gate',
      summary: 'gate: archive worker2',
    })
    const worker2Before = worker2Lifecycle(WORKER2_ID)
    const blockedPending = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-gate', WORKER2_ID),
      P6T2_ROOT,
    )
    const portCallsAfterPending = lifecyclePort.calls.length

    // (A3) decision-deny: the leader denies the gate → the same logical
    // operation (same token/correlation) is still blocked.
    await control.resolveControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      requestId: gate.requestId,
      decision: CONTROL_DECISION_VALUES.DENY,
      note: 'denied for the scenario',
    })
    const blockedDeny = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-gate', WORKER2_ID),
      P6T2_ROOT,
    )

    // (A4) allow: a fresh gate is allowed → the FIRST execution runs
    // (the guard consumes the allow) and commits durably; the RETRY of
    // the same logical operation is blocked again (the one-shot allow is
    // consumed AND the archived target is no longer guard-live — the
    // liveness verdict is final).
    const gate2 = await control.requestControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER2_ID,
      actionName: 'archive-member',
      toolName: 'team_archive_member',
      correlation: 'tok-am-allow',
      summary: 'gate: will be allowed',
    })
    await control.resolveControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      requestId: gate2.requestId,
      decision: CONTROL_DECISION_VALUES.ALLOW,
      note: 'allowed for the scenario',
    })
    const executed = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-allow', WORKER2_ID),
      P6T2_ROOT,
    )
    const worker2After = worker2Lifecycle(WORKER2_ID)
    const portCallsAfterAllow = lifecyclePort.calls.slice()
    const blockedConsumed = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-allow', WORKER2_ID),
      P6T2_ROOT,
    )
    const portCallsAfterRetry = lifecyclePort.calls.length

    // (A5) the FSM verdict: a RUNNING member has no RUNNING → ARCHIVED
    // edge (the P6-T2 default wiring) → the router's typed rejection,
    // zero commits.
    const rejectedRunning = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-running', WORKER_ID),
      P6T2_ROOT,
    )
    const workerAfter = worker2Lifecycle(WORKER_ID)
    const portCallsAfterRunning = lifecyclePort.calls.length

    // (A6) guard last-mile, target liveness: an already-ARCHIVED member
    // is not a live target → blocked target-stale, the runtime is never
    // called.
    const blockedArchivedTarget = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-rearchive', WORKER2_ID),
      P6T2_ROOT,
    )
    const portCallsAfterArchivedTarget = lifecyclePort.calls.length

    // (A7) the tool-layer leader gate: a MEMBER caller — another member
    // AND itself — is rejected before any effect or guard consult.
    const rejectedMember = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-m1', WORKER2_ID),
      WORKER_SESSION,
    )
    const rejectedSelf = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-m2', WORKER_ID),
      WORKER_SESSION,
    )
    const portCallsAfterMember = lifecyclePort.calls.length

    // (A8) guard last-mile, disposed target: the seeded DISPOSED scout →
    // blocked target-stale, zero commits.
    const blockedDisposed = await runTool(
      env,
      'team_archive_member',
      archiveArgs('tok-am-disposed', SCOUT_ID),
      P6T2_ROOT,
    )
    const portCallsAfterDisposed = lifecyclePort.calls.length

    // (A9) argument validation: a missing targetInstanceId → the closed
    // argument contract rejects.
    const rejectedArgs = await runTool(
      env,
      'team_archive_member',
      { rootSessionId: P6T2_ROOT, requestToken: 'tok-am-args' },
      P6T2_ROOT,
    )
    const portCallsFinal = lifecyclePort.calls.length

    return {
      toolNames: tools.map((tool) => tool.name),
      archiveParameters: {
        type: String((tools.find((t) => t.name === 'team_archive_member')?.parameters.type as unknown) ?? ''),
        properties: (
          tools.find((t) => t.name === 'team_archive_member')?.parameters.properties ?? {}
        ) as Record<string, unknown>,
        required: tools.find((t) => t.name === 'team_archive_member')?.parameters.required ?? [],
        additionalProperties:
          tools.find((t) => t.name === 'team_archive_member')?.parameters.additionalProperties ?? true,
      },
      blockedPending,
      worker2Before,
      portCallsAfterPending,
      blockedDeny,
      executed,
      worker2After,
      portCallsAfterAllow,
      blockedConsumed,
      portCallsAfterRetry,
      gateRequestId: gate.requestId,
      gate2RequestId: gate2.requestId,
      rejectedRunning,
      workerAfter,
      portCallsAfterRunning,
      blockedArchivedTarget,
      portCallsAfterArchivedTarget,
      rejectedMember,
      rejectedSelf,
      portCallsAfterMember,
      blockedDisposed,
      portCallsAfterDisposed,
      rejectedArgs,
      portCallsFinal,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

/**
 * The production P7-T3 row (B1 + B2): the REAL `archiveMember` core wired
 * into the router through the lifecycle step ports (the same `LifecyclePorts`
 * shape the production root builds — real P4 domain + real repository CAS
 * commits, the P7-T3 mock-first live port fakes for the five quiesce steps).
 * The call path is the same as every other scenario: the tool's
 * `execute(...)` → guard → facade → action router → `runLifecycle` (ports
 * present) → the P7-T3 core.
 */
interface ProductionScenario {
  readonly executed: TeamToolsResult
  readonly workerAvBefore: number
  readonly workerFinal: string
  readonly workerAvFinal: number
  readonly commitCalls: readonly P7T3CommitCall[]
  readonly clockKinds: readonly string[]
  readonly residencyDrops: readonly { readonly dropped: boolean }[]
  readonly admissionCalls: number
  readonly activityCalls: number
  readonly drainCalls: number
  readonly failedQuiesce: TeamToolsResult
  readonly failedWorkerFinal: string
  readonly failedCommitCalls: number
  readonly failedResidencyDrops: number
  readonly failedClockKinds: readonly string[]
}

const B = await (async (): Promise<ProductionScenario> => {
  // Build one production-row world (the P7-T3 step ports over the real P4
  // domain; the B2 world arms a quiesce fault before the call).
  const buildProductionWorld = async (
    basename: string,
    armInterruptFault: boolean,
  ): Promise<{
    readonly env: P6T6World
    readonly world: Awaited<ReturnType<typeof createP6T2World>>
    readonly commit: P7T3CommitFake
    readonly clock: P7T3Clock
    readonly residency: P7T3ResidencyFake
    readonly admission: P7T3AdmissionFake
    readonly activity: P7T3ActivityFake
    readonly descendants: P7T3DescendantsFake
  }> => {
    const world = await createP6T2World(basename, ['leader', 'worker'])
    const clock = new P7T3Clock()
    const admission = new P7T3AdmissionFake(clock)
    const activity = new P7T3ActivityFake(clock)
    const descendants = new P7T3DescendantsFake(clock) // default report: quiescent
    const residency = new P7T3ResidencyFake(clock)
    // The RUNNING worker is a RESIDENT member (a live Agent handle) — the
    // production shape: quiesce must release the residency before the
    // commits.
    residency.markResident(String(P6T2_SEEDS.worker.childSessionId))
    const commit = new P7T3CommitFake(clock, world.domain)
    if (armInterruptFault) {
      // B2: the interrupt step faults (a live-effect failure mid-quiesce).
      activity.failNext = new Error(`injected quiesce fault (${basename})`)
    }
    const lifecyclePorts: LifecyclePorts = {
      teamDomain: world.domain,
      commit,
      admission,
      activity,
      descendants,
      residency,
    }
    const runtime = createP6T2Runtime(world, { lifecycleCommit: commit, lifecyclePorts })
    const control = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
    })
    const sessionInput = createFakeSessionInput()
    const messaging = createMessagingCoordinator({
      teamRuntime: runtime,
      teamDomain: world.domain,
      sessionInput,
      now: () => P6T2_NOW,
    })
    const activityLedger = createActivityLedger({
      teamDomain: world.domain,
      runtime,
      now: () => P6T2_NOW,
    })
    const callerMap = createP6T6CallerMap(['leader', 'worker'])
    const { tools } = createTeamTools({
      teamRuntime: runtime,
      controlService: control,
      messaging,
      activity: activityLedger,
      async resolveCaller(sessionId: string) {
        const caller = callerMap.bySession.get(sessionId)
        if (caller === undefined) {
          throw new Error(`archive-member-tool (${basename}): no caller for session ${sessionId}`)
        }
        return { caller, rootSessionId: String(P6T2_ROOT) }
      },
    })
    const env: P6T6World = {
      world,
      runtime,
      control,
      sessionInput,
      messaging,
      activity: activityLedger,
      callerMap,
      tools,
      findTool(name: string) {
        const tool = tools.find((candidate) => candidate.name === name)
        if (tool === undefined) {
          throw new Error(`archive-member-tool (${basename}): no registered tool named ${name}`)
        }
        return tool
      },
    }
    return { env, world, commit, clock, residency, admission, activity, descendants }
  }

  // ── B1: the production row, the happy RUNNING archive ───────────────────
  let b1: Omit<ProductionScenario, 'failedQuiesce' | 'failedWorkerFinal' | 'failedCommitCalls' | 'failedResidencyDrops' | 'failedClockKinds'>
  {
    const { env, world, commit, clock, residency, admission, activity, descendants } =
      await buildProductionWorld('archive-member-tool-f2', false)
    try {
      const readWorker = () => {
        const record = world.domain.repositories.memberInstances.get(P6T2_ROOT, WORKER_ID)
        if (record === undefined) {
          throw new Error('archive-member-tool (B1): the worker vanished')
        }
        return record
      }
      const workerAvBefore = Number(readWorker().activityVersion)
      // The production row: the tool call quiesces the RUNNING member and
      // durably settles-then-archives it (two CAS commits).
      const executed = await runTool(
        env,
        'team_archive_member',
        archiveArgs('tok-am-prod', WORKER_ID),
        P6T2_ROOT,
      )
      const finalRecord = readWorker()
      b1 = {
        executed,
        workerAvBefore,
        workerFinal: String(finalRecord.lifecycle),
        workerAvFinal: Number(finalRecord.activityVersion),
        commitCalls: commit.calls.slice(),
        clockKinds: clock.kinds(),
        residencyDrops: residency.dropCalls.slice(),
        admissionCalls: admission.calls.length,
        activityCalls: activity.calls.length,
        drainCalls: descendants.calls.length,
      }
    } finally {
      await destroyP6T1World(world)
    }
  }

  // ── B2: the quiesce failure arm (its own world so B1's durable state is
  // untouched) ──────────────────────────────────────────────────────────────
  const b2 = await (async () => {
    const { env, world, commit, clock, residency } = await buildProductionWorld(
      'archive-member-tool-f2b',
      true,
    )
    try {
      const failedQuiesce = await runTool(
        env,
        'team_archive_member',
        archiveArgs('tok-am-prod-fault', WORKER_ID),
        P6T2_ROOT,
      )
      const record = world.domain.repositories.memberInstances.get(P6T2_ROOT, WORKER_ID)
      return {
        failedQuiesce,
        failedWorkerFinal: record === undefined ? 'MISSING' : String(record.lifecycle),
        failedCommitCalls: commit.calls.length,
        failedResidencyDrops: residency.dropCalls.length,
        failedClockKinds: clock.kinds(),
      }
    } finally {
      await destroyP6T1World(world)
    }
  })()

  return { ...b1, ...b2 }
})()

describe('team_archive_member — the 13th closed team tool (the archive-member round)', () => {
  it('A1 the catalog: the 13th (LAST) tool with the closed argument shape', () => {
    expect(A.toolNames).toHaveLength(13)
    expect(A.toolNames[12]).toBe('team_archive_member')
    // The first twelve keep their registration order (selection indices
    // are unchanged by the round).
    expect(A.toolNames.slice(0, 12)).toEqual([
      'team_list_members',
      'team_list_templates',
      'team_inspect_config',
      'team_create_member',
      'team_delegate',
      'team_follow_up',
      'team_collect',
      'team_send_message',
      'team_report_progress',
      'team_request_control',
      'team_resolve_control',
      'team_list_pending_control',
    ])
    expect(A.archiveParameters.type).toBe('object')
    expect(Object.keys(A.archiveParameters.properties).sort()).toEqual([
      'requestToken',
      'rootSessionId',
      'targetInstanceId',
    ])
    expect(A.archiveParameters.required).toEqual([
      'rootSessionId',
      'requestToken',
      'targetInstanceId',
    ])
    expect(A.archiveParameters.additionalProperties).toBe(false)
  })

  it('A2 guard pending: the durable gate blocks before any effect (zero commits; the target stays SETTLED)', () => {
    expect(A.blockedPending.status).toBe('blocked')
    if (A.blockedPending.status !== 'blocked') return
    expect(A.blockedPending.toolName).toBe('team_archive_member')
    expect(A.blockedPending.correlation).toBe('tok-am-gate')
    expect(A.blockedPending.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(A.blockedPending.requestId).toBe(A.gateRequestId)
    expect(A.blockedPending.decisionSequence).toBeUndefined()
    expect(A.worker2Before).toBe('SETTLED')
    expect(A.portCallsAfterPending).toBe(0)
  })

  it('A3 guard decision-deny: the denied gate keeps the same operation blocked', () => {
    expect(A.blockedDeny.status).toBe('blocked')
    if (A.blockedDeny.status !== 'blocked') return
    expect(A.blockedDeny.toolName).toBe('team_archive_member')
    expect(A.blockedDeny.correlation).toBe('tok-am-gate')
    expect(A.blockedDeny.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY)
    expect(A.blockedDeny.requestId).toBe(A.gateRequestId)
    expect(A.blockedDeny.decisionSequence).toBeTypeOf('number')
  })

  it('A4 guard allow: the first execution commits durably (SETTLED → ARCHIVED) and the retry is blocked again (exactly once)', () => {
    expect(A.executed.status).toBe('executed')
    if (A.executed.status !== 'executed') return
    expect(A.executed.action).toBe('archive-member')
    expect(A.executed.rootSessionId).toBe(P6T2_ROOT)
    expect(A.executed.targetInstanceId).toBe(WORKER2_ID)
    expect(A.executed.effect.kind).toBe('lifecycle-changed')
    if (A.executed.effect.kind !== 'lifecycle-changed') return
    expect(A.executed.effect.instanceId).toBe(WORKER2_ID)
    expect(A.executed.effect.from).toBe('SETTLED')
    expect(A.executed.effect.to).toBe('ARCHIVED')
    expect(A.executed.effect.sequence).toBeGreaterThan(0)
    // The durable record is ARCHIVED and the fake commit port recorded
    // exactly one ARCHIVE call through the real repository CAS.
    expect(A.worker2After).toBe('ARCHIVED')
    expect(A.portCallsAfterAllow).toHaveLength(1)
    const commit = A.portCallsAfterAllow[0]!
    expect(commit.rootSessionId).toBe(P6T2_ROOT)
    expect(commit.instanceId).toBe(WORKER2_ID)
    expect(commit.from).toBe('SETTLED')
    expect(commit.operation).toBe('ARCHIVE')
    expect(commit.to).toBe('ARCHIVED')
    expect(commit.expectedActivityVersion).toBeGreaterThan(0)
    // The RETRY of the same logical operation: the one-shot allow is
    // consumed — and the now-ARCHIVED target is no longer guard-live, so
    // the liveness verdict (target-stale) is final for the retry. Either
    // way: blocked, no second commit (exactly-once).
    expect(A.blockedConsumed.status).toBe('blocked')
    if (A.blockedConsumed.status !== 'blocked') return
    expect(A.blockedConsumed.toolName).toBe('team_archive_member')
    expect(A.blockedConsumed.correlation).toBe('tok-am-allow')
    expect(A.blockedConsumed.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE)
    expect(A.portCallsAfterRetry).toBe(1)
  })

  it('A5 the FSM verdict: archiving a RUNNING member is LIFECYCLE_TRANSITION_REJECTED (no commits; stays RUNNING)', () => {
    expect(A.rejectedRunning.status).toBe('rejected')
    if (A.rejectedRunning.status !== 'rejected') return
    expect(A.rejectedRunning.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED,
    )
    expect(A.workerAfter).toBe('RUNNING')
    expect(A.portCallsAfterRunning).toBe(1)
  })

  it('A6 guard target liveness: an already-ARCHIVED member is target-stale (the runtime is never called)', () => {
    expect(A.blockedArchivedTarget).toEqual({
      status: 'blocked',
      toolName: 'team_archive_member',
      correlation: 'tok-am-rearchive',
      reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE,
    })
    expect(A.portCallsAfterArchivedTarget).toBe(1)
  })

  it('A7 the tool-layer leader gate: a MEMBER caller is TEAM_TOOL_ARCHIVE_NOT_LEADER (zero side effects)', () => {
    for (const rejected of [A.rejectedMember, A.rejectedSelf]) {
      expect(rejected.status).toBe('rejected')
      if (rejected.status !== 'rejected') continue
      expect(rejected.code).toBe('TEAM_TOOL_ARCHIVE_NOT_LEADER')
    }
    expect(A.portCallsAfterMember).toBe(1)
  })

  it('A8 guard disposed target: a DISPOSED member is target-stale (zero commits)', () => {
    expect(A.blockedDisposed).toEqual({
      status: 'blocked',
      toolName: 'team_archive_member',
      correlation: 'tok-am-disposed',
      reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE,
    })
    expect(A.portCallsAfterDisposed).toBe(1)
  })

  it('A9 argument validation: a missing targetInstanceId is TEAM_TOOL_BAD_ARGUMENTS', () => {
    expect(A.rejectedArgs.status).toBe('rejected')
    if (A.rejectedArgs.status !== 'rejected') return
    expect(A.rejectedArgs.code).toBe('TEAM_TOOL_BAD_ARGUMENTS')
    expect(A.portCallsFinal).toBe(1)
  })
})

describe('team_archive_member — the production P7-T3 row (quiesce, then the two durable commits)', () => {
  it('B1 the tool call quiesces a RUNNING resident member and settle-thens-archives it (two CAS commits)', () => {
    expect(B.executed.status).toBe('executed')
    if (B.executed.status !== 'executed') return
    expect(B.executed.action).toBe('archive-member')
    expect(B.executed.rootSessionId).toBe(P6T2_ROOT)
    expect(B.executed.targetInstanceId).toBe(WORKER_ID)
    expect(B.executed.effect.kind).toBe('lifecycle-changed')
    if (B.executed.effect.kind !== 'lifecycle-changed') return
    expect(B.executed.effect.instanceId).toBe(WORKER_ID)
    // The effect reports the member's ORIGINAL state to its final state —
    // the settle is an intermediate durable step of the procedure, not a
    // second action.
    expect(B.executed.effect.from).toBe('RUNNING')
    expect(B.executed.effect.to).toBe('ARCHIVED')
    expect(B.executed.effect.sequence).toBeGreaterThan(0)
    // The durable record is ARCHIVED; the activity version advanced by
    // exactly the two durable commits (the domain D3 rule: +1 each).
    expect(B.workerFinal).toBe('ARCHIVED')
    expect(B.workerAvFinal).toBe(B.workerAvBefore + 2)
    // The commit port (the REAL repository CAS) recorded exactly the two
    // probed transitions, in the frozen order.
    expect(B.commitCalls).toHaveLength(2)
    const settle = B.commitCalls[0]!
    expect(settle.rootSessionId).toBe(P6T2_ROOT)
    expect(settle.instanceId).toBe(WORKER_ID)
    expect(settle.from).toBe('RUNNING')
    expect(settle.operation).toBe('SETTLE')
    expect(settle.to).toBe('SETTLED')
    expect(settle.expectedActivityVersion).toBe(B.workerAvBefore)
    const archive = B.commitCalls[1]!
    expect(archive.rootSessionId).toBe(P6T2_ROOT)
    expect(archive.instanceId).toBe(WORKER_ID)
    expect(archive.from).toBe('SETTLED')
    expect(archive.operation).toBe('ARCHIVE')
    expect(archive.to).toBe('ARCHIVED')
    expect(archive.expectedActivityVersion).toBe(B.workerAvBefore + 1)
    // The procedure order (the machine-checkable clock): the five quiesce
    // live steps COMPLETE BEFORE the first durable commit; the resident
    // handle is released by the fifth step.
    expect(B.clockKinds).toEqual([
      'admission.close',
      'activity.interrupt',
      'descendants.drain',
      'residency.drop',
      'commit',
      'commit',
    ])
    expect(B.admissionCalls).toBe(1)
    expect(B.activityCalls).toBe(1)
    expect(B.drainCalls).toBe(1)
    expect(B.residencyDrops).toHaveLength(1)
    expect(B.residencyDrops[0]?.dropped).toBe(true)
  })

  it('B2 a quiesce live-effect fault aborts before any durable commit (stays RUNNING; residency unreleased)', () => {
    expect(B.failedQuiesce.status).toBe('rejected')
    if (B.failedQuiesce.status !== 'rejected') return
    expect(B.failedQuiesce.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_LIVE_EFFECT_FAILED,
    )
    expect(B.failedWorkerFinal).toBe('RUNNING')
    expect(B.failedCommitCalls).toBe(0)
    expect(B.failedResidencyDrops).toBe(0)
    // The clock proves the abort point: admission closed, the interrupt
    // faulted — nothing after it ran (no drain observation recorded a
    // commit, no residency release).
    expect(B.failedClockKinds).toEqual(['admission.close', 'activity.interrupt'])
  })
})
