/**
 * P6-T6 MUST-TEST — the closed tool set over the real runtime stack
 * (unit level): every one of the ten tools delegates to the Runtime and
 * its sanctioned satellites (SD-DEPS); typed business rejections and
 * guard blocks settle as closed `rejected` / `blocked` results; only
 * unexpected errors throw.
 *
 * Coverage per the G6 criteria at unit level:
 * - E1/E4: template-addressed creations admit distinct instances
 *   (member-activated) and fresh_per_delegation delegates get a NEW
 *   instance per delegation;
 * - E2: label/template addressing on instance-addressed tools is
 *   live-rejected TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED;
 * - E3: persistent follow-up keeps the same bound child session;
 * - E6: quota boundaries — at-limit admitted, over-limit rejected
 *   (template and team), never over-create;
 * plus: messaging delivery (the recorded fake session input), per-subject
 * progress sequences + the stale-head retry, the guard's target-stale
 * block for a well-formed unknown instance, CALLER_UNRESOLVED (no agent /
 * unknown session / throwing resolver), and the tool-layer BAD_ARGUMENTS
 * boundary (token contract, delegate XOR, closed vocabularies).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  TEAM_RUNTIME_ERROR_CODES,
} from '../../runtime/admission/index.js'
import {
  ACTIVITY_ERROR_CODES,
  ActivityError,
} from '../../runtime/activity/index.js'
import type { ActivityProgressInput } from '../../runtime/activity/index.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import { P6T2_ROOT, P6T2_SEEDS } from '../../runtime/test/p6t2-helpers.js'
import {
  TEAM_TOOL_BAD_ARGUMENTS,
  TEAM_TOOL_CALLER_UNRESOLVED,
  createTeamTools,
} from '../src/index.js'
import type { TeamToolsResult } from '../src/index.js'
import {
  createFakeSessionInput,
  createP6T6World,
  execFor,
  runTool,
} from './p6t6-helpers.js'
import type { P6T6World } from './p6t6-helpers.js'

const LEADER_ID = String(P6T2_SEEDS.leader.instanceId)
const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const WORKER_SESSION = String(P6T2_SEEDS.worker.childSessionId)

interface Captured {
  readonly status: string
  readonly code?: string
  readonly message?: string
  readonly reason?: string
}

interface WorkAdmittedEffect {
  readonly instanceId: string
  readonly fromLifecycle: string
  readonly lifecycleCommitted: boolean
  readonly sequence: number
}

interface ActivatedEffect {
  readonly instanceId: string
  readonly templateId: string
  readonly childSessionId: string
}

interface ScenarioA {
  readonly listMembers: TeamToolsResult
  readonly listTemplates: TeamToolsResult
  readonly inspect: TeamToolsResult
  readonly createdScout: TeamToolsResult
  readonly createdScoutEffect: ActivatedEffect | null
  readonly followOneEffect: WorkAdmittedEffect | null
  readonly followTwoEffect: WorkAdmittedEffect | null
  readonly durableWorkerSession: string | undefined
  readonly labelAddressing: Captured
  readonly templateAddressing: Captured
  readonly labelMsg: Captured
  readonly sent: TeamToolsResult
  readonly sentDelivered: {
    readonly recipientInstanceId: string
    readonly deliveryMode: string
    readonly deliveredToInstanceId: string
    readonly deliveredToSessionId: string
  } | null
  readonly recordedInputs: {
    readonly sessionId: string
    readonly text: string
    readonly attribution: {
      readonly kind: string
      readonly fromInstanceId?: string
      readonly intendedForInstanceId: string
    }
  }[]
  readonly progressOneSeq: number
  readonly progressTwoSeq: number
  readonly progressOtherSeq: number
  readonly writesDelta: number
  readonly env: P6T6World
}

/**
 * The E4 world (C1): seeds leader+worker (team 2/4; scout 0/2). Two
 * fresh_per_delegation scout delegates must EACH admit a new distinct
 * instance (team 3/4 then 4/4; scout 1/2 then 2/2 — both exactly at
 * their limits), and the third scout delegate must hit the TEAM wall
 * first (5 > 4 is checked before the template tier).
 *
 * The quota-tier world (C2): seeds leader+worker (team 2/4; worker 1/2).
 * Explicit create-members isolate the two quota tiers: worker 2/2 at the
 * template limit is ADMITTED (team 3/4), worker 3 is rejected TEMPLATE
 * while the team tier stays in-boundary, scout then admits at the team
 * limit (team 4/4), and the final two rejections prove the TEAM wall on
 * its own (checked before the template tier). NOTE: 'leader' is NOT a
 * create-able template — activation resolves templates from the
 * blueprint's member list only (the leader is a blueprint-level entry).
 */
interface ScenarioC {
  readonly c1DelegatedOne: TeamToolsResult
  readonly c1DelegatedOneEffect: ActivatedEffect | null
  readonly c1DelegatedTwo: TeamToolsResult
  readonly c1DelegatedTwoEffect: ActivatedEffect | null
  readonly c1OverTeam: Captured
  readonly c2WorkerOne: TeamToolsResult
  readonly c2WorkerOneEffect: ActivatedEffect | null
  readonly c2WorkerTwo: Captured
  readonly c2ScoutOne: TeamToolsResult
  readonly c2ScoutOneEffect: ActivatedEffect | null
  readonly c2WorkerThree: Captured
  readonly c2ScoutTwo: Captured
}

interface ScenarioB {
  readonly noToken: Captured
  readonly emptyToken: Captured
  readonly longToken: Captured
  readonly noRoot: Captured
  readonly nonStringRoot: Captured
  readonly nonObjectArgs: Captured
  readonly noAgent: Captured
  readonly unknownSession: Captured
  readonly delegateNeither: Captured
  readonly delegateBoth: Captured
  readonly badProgress: Captured
  readonly badKind: Captured
  readonly badDecision: Captured
  readonly notFound: Captured
  readonly staleRetryAttempts: number
  readonly staleRetrySeq: number | null
  readonly resolverThrow: Captured
}

function rejectedOf(result: TeamToolsResult, what: string): Captured {
  if (result.status !== 'rejected') {
    throw new Error(`${what}: expected a rejected result, got '${result.status}'`)
  }
  return { status: 'rejected', code: result.code, message: result.message }
}

function blockedOf(result: TeamToolsResult, what: string): Captured {
  if (result.status !== 'blocked') {
    throw new Error(`${what}: expected a blocked result, got '${result.status}'`)
  }
  return { status: 'blocked', reason: result.reason }
}

function base(args: Record<string, unknown>): Record<string, unknown> {
  return { rootSessionId: P6T2_ROOT, ...args }
}

/**
 * Build one tool set over a world with optional satellite overrides
 * (the fault-injection channel for the stale-head retry scenario).
 */
function buildTools(
  env: P6T6World,
  overrides: {
    readonly activity?: P6T6World['activity']
  } = {},
): P6T6World['tools'] {
  return createTeamTools({
    teamRuntime: env.runtime,
    controlService: env.control,
    messaging: env.messaging,
    activity: overrides.activity ?? env.activity,
    async resolveCaller(sessionId: string) {
      const caller = env.callerMap.bySession.get(sessionId)
      if (caller === undefined) {
        throw new Error(`p6t6 caller map: no caller for session ${sessionId}`)
      }
      return caller
    },
  }).tools
}

// ---------------------------------------------------------------------------
// Scenario A — the happy paths + E2/E3/E4/E6 unit counterparts
// ---------------------------------------------------------------------------

const A = await (async (): Promise<ScenarioA> => {
  const env = await createP6T6World('p6t6-actions-a')
  try {
    const writesBefore = env.world.seam.writeCount

    const listMembers = await runTool(env, 'team_list_members', base({ requestToken: 'tok-a-lm' }), P6T2_ROOT)
    const listTemplates = await runTool(env, 'team_list_templates', base({ requestToken: 'tok-a-lt' }), P6T2_ROOT)
    const inspect = await runTool(
      env,
      'team_inspect_config',
      base({ requestToken: 'tok-a-ic', targetInstanceId: WORKER_ID }),
      P6T2_ROOT,
    )

    // E1/E4 unit level: template-addressed creation (leader; at the
    // per-template limit for scout: 1 seeded + 1 created = 2 = limit).
    const createdScout = await runTool(
      env,
      'team_create_member',
      base({ requestToken: 'tok-a-cm', delegationTemplateId: 'scout', label: 'scout-tool' }),
      P6T2_ROOT,
    )
    const createdScoutEffect =
      createdScout.status === 'executed' && createdScout.effect.kind === 'member-activated'
        ? createdScout.effect
        : null

    // E3 unit level: persistent follow-up twice on the seeded worker.
    const followOne = await runTool(
      env,
      'team_follow_up',
      base({ requestToken: 'tok-a-f1', targetInstanceId: WORKER_ID, taskSummary: 'first follow-up' }),
      P6T2_ROOT,
    )
    const followTwo = await runTool(
      env,
      'team_follow_up',
      base({ requestToken: 'tok-a-f2', targetInstanceId: WORKER_ID, taskSummary: 'second follow-up' }),
      P6T2_ROOT,
    )
    const followOneEffect =
      followOne.status === 'executed' && followOne.effect.kind === 'work-admitted'
        ? followOne.effect
        : null
    const followTwoEffect =
      followTwo.status === 'executed' && followTwo.effect.kind === 'work-admitted'
        ? followTwo.effect
        : null
    const workerRecord = env.world.domain.repositories.memberInstances.get(P6T2_ROOT, WORKER_ID)

    // E2 unit level: label and template addressing are live-rejected.
    const labelAddressing = await runTool(
      env,
      'team_follow_up',
      base({ requestToken: 'tok-a-la', targetInstanceId: 'existing-worker' }),
      P6T2_ROOT,
    )
    const templateAddressing = await runTool(
      env,
      'team_inspect_config',
      base({ requestToken: 'tok-a-ta', targetInstanceId: 'worker' }),
      P6T2_ROOT,
    )
    const labelMsg = await runTool(
      env,
      'team_send_message',
      base({ requestToken: 'tok-a-lm2', recipientInstanceId: 'existing-worker', body: 'hi' }),
      WORKER_SESSION,
    )

    // Messaging: worker -> leader is direct (the recorded fake port).
    const sent = await runTool(
      env,
      'team_send_message',
      base({ requestToken: 'tok-a-sm', recipientInstanceId: LEADER_ID, body: 'worker -> leader body', subject: 'handoff' }),
      WORKER_SESSION,
    )
    const sentDelivered =
      sent.status === 'delivered' ? sent : null
    const recordedInputs = env.sessionInput.calls

    // Progress: per-subject sequences on the worker (the worker's own
    // envelope allows report-progress).
    const progressOne = await runTool(
      env,
      'team_report_progress',
      base({
        requestToken: 'tok-a-p1',
        instanceId: WORKER_ID,
        subject: 'unit-a',
        progress: 'in-progress',
        summary: 'first row',
      }),
      WORKER_SESSION,
    )
    const progressTwo = await runTool(
      env,
      'team_report_progress',
      base({
        requestToken: 'tok-a-p2',
        instanceId: WORKER_ID,
        subject: 'unit-a',
        progress: 'completed',
      }),
      WORKER_SESSION,
    )
    const progressOther = await runTool(
      env,
      'team_report_progress',
      base({
        requestToken: 'tok-a-p3',
        instanceId: WORKER_ID,
        subject: 'unit-b',
        progress: 'blocked',
      }),
      WORKER_SESSION,
    )
    const seqOf = (result: TeamToolsResult, what: string): number =>
      result.status === 'progress-recorded' ? result.row.sequence : (() => {
        throw new Error(`${what}: expected progress-recorded, got '${result.status}'`)
      })()

    const writesAfter = env.world.seam.writeCount

    return {
      listMembers,
      listTemplates,
      inspect,
      createdScout,
      createdScoutEffect,
      followOneEffect,
      followTwoEffect,
      durableWorkerSession: workerRecord === undefined ? undefined : String(workerRecord.childSessionId),
      labelAddressing: rejectedOf(labelAddressing, 'labelAddressing'),
      templateAddressing: rejectedOf(templateAddressing, 'templateAddressing'),
      labelMsg: rejectedOf(labelMsg, 'labelMsg'),
      sent,
      sentDelivered,
      recordedInputs,
      progressOneSeq: seqOf(progressOne, 'progressOne'),
      progressTwoSeq: seqOf(progressTwo, 'progressTwo'),
      progressOtherSeq: seqOf(progressOther, 'progressOther'),
      writesDelta: writesAfter - writesBefore,
      env,
    }
  } finally {
    // The world is kept alive for the assertions that need it; the
    // destroy happens in scenario A2's finally below.
  }
})()

// ---------------------------------------------------------------------------
// Scenario C — E4 + quota boundaries (two dedicated worlds, both seeding
// leader+worker: team 2/4, worker 1/2, scout 0/2)
// ---------------------------------------------------------------------------

const C1 = await (async (): Promise<{
  readonly delegatedOne: TeamToolsResult
  readonly delegatedOneEffect: ActivatedEffect | null
  readonly delegatedTwo: TeamToolsResult
  readonly delegatedTwoEffect: ActivatedEffect | null
  readonly overTeam: Captured
}> => {
  const env = await createP6T6World('p6t6-actions-c', ['leader', 'worker'])
  try {
    // E4 unit level: fresh_per_delegation delegates ALWAYS create — every
    // delegation below admits a NEW distinct instance (invariant 26). The
    // two admissions reach team 4/4 and scout 2/2, both exactly at their
    // limits (at-limit admitted).
    const delegatedOne = await runTool(
      env,
      'team_delegate',
      base({
        requestToken: 'tok-c1-d1',
        delegationTemplateId: 'scout',
        label: 'scout-delegate-one',
        taskSummary: 'fresh instance per delegation (1/2)',
      }),
      P6T2_ROOT,
    )
    const delegatedOneEffect =
      delegatedOne.status === 'executed' && delegatedOne.effect.kind === 'member-activated'
        ? delegatedOne.effect
        : null

    const delegatedTwo = await runTool(
      env,
      'team_delegate',
      base({
        requestToken: 'tok-c1-d2',
        delegationTemplateId: 'scout',
        label: 'scout-delegate-two',
        taskSummary: 'fresh instance per delegation (2/2, at both limits)',
      }),
      P6T2_ROOT,
    )
    const delegatedTwoEffect =
      delegatedTwo.status === 'executed' && delegatedTwo.effect.kind === 'member-activated'
        ? delegatedTwo.effect
        : null

    // E6: the third scout delegate must die on the TEAM wall (5 > 4 is
    // checked before the scout 3 > 2 template tier).
    const overTeam = rejectedOf(
      await runTool(
        env,
        'team_delegate',
        base({
          requestToken: 'tok-c1-d3',
          delegationTemplateId: 'scout',
          label: 'scout-delegate-three',
        }),
        P6T2_ROOT,
      ),
      'c1OverTeam',
    )

    return { delegatedOne, delegatedOneEffect, delegatedTwo, delegatedTwoEffect, overTeam }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const C2 = await (async (): Promise<{
  readonly workerOne: TeamToolsResult
  readonly workerOneEffect: ActivatedEffect | null
  readonly workerTwo: Captured
  readonly scoutOne: TeamToolsResult
  readonly scoutOneEffect: ActivatedEffect | null
  readonly workerThree: Captured
  readonly scoutTwo: Captured
}> => {
  const env = await createP6T6World('p6t6-actions-d', ['leader', 'worker'])
  try {
    // E6: worker 2/2 exactly AT the template limit (team 3/4 in-boundary)
    // — at-limit is ADMITTED.
    const workerOne = await runTool(
      env,
      'team_create_member',
      base({
        requestToken: 'tok-c2-w1',
        delegationTemplateId: 'worker',
        label: 'worker-at-limit',
      }),
      P6T2_ROOT,
    )
    const workerOneEffect =
      workerOne.status === 'executed' && workerOne.effect.kind === 'member-activated'
        ? workerOne.effect
        : null

    // E6: worker 3 > 2 — rejected on the TEMPLATE tier while the team
    // tier (4/4) is still in-boundary: the two tiers are independent.
    const workerTwo = rejectedOf(
      await runTool(
        env,
        'team_create_member',
        base({
          requestToken: 'tok-c2-w2',
          delegationTemplateId: 'worker',
          label: 'worker-over-template',
        }),
        P6T2_ROOT,
      ),
      'c2WorkerTwo',
    )

    // E6: scout 1/2 with team 3/4 — admits and reaches the TEAM limit
    // (team 4/4) exactly: at-limit admitted at the team boundary too.
    const scoutOne = await runTool(
      env,
      'team_create_member',
      base({
        requestToken: 'tok-c2-s1',
        delegationTemplateId: 'scout',
        label: 'scout-at-team-limit',
      }),
      P6T2_ROOT,
    )
    const scoutOneEffect =
      scoutOne.status === 'executed' && scoutOne.effect.kind === 'member-activated'
        ? scoutOne.effect
        : null

    // E6: worker would push the team to 5 > 4 — rejected on the TEAM
    // tier, which is checked BEFORE the template tier (worker 3 > 2 would
    // also be over): the team wall is the first line.
    const workerThree = rejectedOf(
      await runTool(
        env,
        'team_create_member',
        base({
          requestToken: 'tok-c2-w3',
          delegationTemplateId: 'worker',
          label: 'worker-over-team',
        }),
        P6T2_ROOT,
      ),
      'c2WorkerThree',
    )

    // E6: scout would push the team to 5 > 4 as well (scout 2/2 at its
    // own template limit would not save it) — rejected on the TEAM tier.
    const scoutTwo = rejectedOf(
      await runTool(
        env,
        'team_create_member',
        base({
          requestToken: 'tok-c2-s2',
          delegationTemplateId: 'scout',
          label: 'scout-over-team',
        }),
        P6T2_ROOT,
      ),
      'c2ScoutTwo',
    )

    return { workerOne, workerOneEffect, workerTwo, scoutOne, scoutOneEffect, workerThree, scoutTwo }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

const C: ScenarioC = {
  c1DelegatedOne: C1.delegatedOne,
  c1DelegatedOneEffect: C1.delegatedOneEffect,
  c1DelegatedTwo: C1.delegatedTwo,
  c1DelegatedTwoEffect: C1.delegatedTwoEffect,
  c1OverTeam: C1.overTeam,
  c2WorkerOne: C2.workerOne,
  c2WorkerOneEffect: C2.workerOneEffect,
  c2WorkerTwo: C2.workerTwo,
  c2ScoutOne: C2.scoutOne,
  c2ScoutOneEffect: C2.scoutOneEffect,
  c2WorkerThree: C2.workerThree,
  c2ScoutTwo: C2.scoutTwo,
}

// ---------------------------------------------------------------------------
// Scenario A2 — boundary rejections (BAD_ARGUMENTS / CALLER_UNRESOLVED /
// the guard's target-stale block / the stale-head retry)
// ---------------------------------------------------------------------------

const B = await (async (): Promise<ScenarioB> => {
  const env = await createP6T6World('p6t6-actions-b')
  try {
    const listTool = env.findTool('team_list_members')

    const noToken = rejectedOf(
      await listTool.execute(base({}), execFor(P6T2_ROOT)),
      'noToken',
    )
    const emptyToken = rejectedOf(
      await listTool.execute(base({ requestToken: '' }), execFor(P6T2_ROOT)),
      'emptyToken',
    )
    const longToken = rejectedOf(
      await listTool.execute(base({ requestToken: 't'.repeat(129) }), execFor(P6T2_ROOT)),
      'longToken',
    )
    const noRoot = rejectedOf(
      await listTool.execute({ requestToken: 'tok-b-nr' }, execFor(P6T2_ROOT)),
      'noRoot',
    )
    const nonStringRoot = rejectedOf(
      await listTool.execute({ rootSessionId: 42, requestToken: 'tok-b-ns' }, execFor(P6T2_ROOT)),
      'nonStringRoot',
    )
    const nonObjectArgs = rejectedOf(
      await listTool.execute(null, execFor(P6T2_ROOT)),
      'nonObjectArgs',
    )
    const noAgent = rejectedOf(
      await listTool.execute(base({ requestToken: 'tok-b-na' }), { callId: 'c', name: '', arguments: {} }),
      'noAgent',
    )
    const unknownSession = rejectedOf(
      await listTool.execute(base({ requestToken: 'tok-b-us' }), execFor('session-p6t6-unknown')),
      'unknownSession',
    )

    const delegateTool = env.findTool('team_delegate')
    const delegateNeither = rejectedOf(
      await delegateTool.execute(
        base({ requestToken: 'tok-b-dn', label: 'neither' }),
        execFor(P6T2_ROOT),
      ),
      'delegateNeither',
    )
    const delegateBoth = rejectedOf(
      await delegateTool.execute(
        base({
          requestToken: 'tok-b-db',
          label: 'both',
          delegationTemplateId: 'worker',
          delegationInstanceId: WORKER_ID,
        }),
        execFor(P6T2_ROOT),
      ),
      'delegateBoth',
    )

    const progressTool = env.findTool('team_report_progress')
    const badProgress = rejectedOf(
      await progressTool.execute(
        base({
          requestToken: 'tok-b-bp',
          instanceId: WORKER_ID,
          subject: 'unit-a',
          progress: 'done',
        }),
        execFor(WORKER_SESSION),
      ),
      'badProgress',
    )

    const requestControlTool = env.findTool('team_request_control')
    const badKind = rejectedOf(
      await requestControlTool.execute(
        base({
          requestToken: 'tok-b-bk',
          kind: 'nope',
          targetInstanceId: WORKER_ID,
          actionName: 'follow-up',
        }),
        execFor(P6T2_ROOT),
      ),
      'badKind',
    )

    const resolveControlTool = env.findTool('team_resolve_control')
    const badDecision = rejectedOf(
      await resolveControlTool.execute(
        base({ requestToken: 'tok-b-bd', requestId: 'ctrl-req-missing', decision: 'maybe' }),
        execFor(P6T2_ROOT),
      ),
      'badDecision',
    )

    const followUpTool = env.findTool('team_follow_up')
    // A well-formed but UNKNOWN instance id: the last-mile guard consults
    // first (SD-GUARD) and its liveness verdict is final — the target is
    // not durably live, so the operation is blocked target-stale and the
    // runtime is never called (no second, looser check behind the guard).
    const notFound = blockedOf(
      await followUpTool.execute(
        base({ requestToken: 'tok-b-nf', targetInstanceId: 'inst-p6t6ghost' }),
        execFor(P6T2_ROOT),
      ),
      'notFound',
    )

    // The stale-head retry: the first recordProgress throws a synthetic
    // ACTIVITY_SEQUENCE_STALE (another reporter advanced the lane), the
    // bounded retry re-reads the head and commits.
    let attempts = 0
    const flakyActivity = {
      ...env.activity,
      async recordProgress(input: ActivityProgressInput) {
        attempts += 1
        if (attempts === 1) {
          throw new ActivityError(
            ACTIVITY_ERROR_CODES.ACTIVITY_SEQUENCE_STALE,
            'injected: another reporter advanced the lane',
          )
        }
        return env.activity.recordProgress(input)
      },
    }
    const flakyTools = buildTools(env, { activity: flakyActivity as P6T6World['activity'] })
    const flakyTool = flakyTools.find((tool) => tool.name === 'team_report_progress')
    if (flakyTool === undefined) throw new Error('flakyTool: tool not found')
    const staleRetry = await flakyTool.execute(
      base({
        requestToken: 'tok-b-sr',
        instanceId: WORKER_ID,
        subject: 'unit-stale',
        progress: 'in-progress',
      }),
      execFor(WORKER_SESSION),
    )
    const staleRetrySeq =
      staleRetry.status === 'progress-recorded' ? staleRetry.row.sequence : null

    // A throwing resolver maps to CALLER_UNRESOLVED (fail closed).
    const throwingTools = createTeamTools({
      teamRuntime: env.runtime,
      controlService: env.control,
      messaging: env.messaging,
      activity: env.activity,
      async resolveCaller(): Promise<never> {
        throw new Error('injected: resolver failure')
      },
    }).tools
    const throwingTool = throwingTools.find((tool) => tool.name === 'team_list_members')
    if (throwingTool === undefined) throw new Error('throwingTool: tool not found')
    const resolverThrow = rejectedOf(
      await throwingTool.execute(base({ requestToken: 'tok-b-rt' }), execFor(P6T2_ROOT)),
      'resolverThrow',
    )

    return {
      noToken,
      emptyToken,
      longToken,
      noRoot,
      nonStringRoot,
      nonObjectArgs,
      noAgent,
      unknownSession,
      delegateNeither,
      delegateBoth,
      badProgress,
      badKind,
      badDecision,
      notFound,
      staleRetryAttempts: attempts,
      staleRetrySeq,
      resolverThrow,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P6-T6 tool set — delegated actions (unit level)', () => {
  it('reads: list-members / list-templates / inspect-config execute with lossless effects', () => {
    const list = A.listMembers as TeamToolsResult
    expect(list.status).toBe('executed')
    if (list.status !== 'executed') throw new Error('unreachable')
    expect(list.action).toBe('list-members')
    expect(list.callerRole).toBe('leader')
    expect(list.effect.kind).toBe('members-listed')
    if (list.effect.kind === 'members-listed') {
      const ids = list.effect.members.map((member) => member.instanceId).sort()
      expect(ids).toEqual([
        LEADER_ID,
        'inst-p6t2seeds01',
        WORKER_ID,
      ].sort())
    }
    const templates = A.listTemplates as TeamToolsResult
    expect(templates.status).toBe('executed')
    if (templates.status === 'executed' && templates.effect.kind === 'templates-listed') {
      expect(templates.effect.templates).toEqual([
        { templateId: 'leader', displayName: '', contextPolicy: 'persistent' },
        { templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
        { templateId: 'scout', displayName: 'Scout', contextPolicy: 'fresh_per_delegation' },
      ])
    }
    const inspect = A.inspect as TeamToolsResult
    expect(inspect.status).toBe('executed')
    if (inspect.status === 'executed') {
      expect(inspect.effect.kind).toBe('config-inspected')
      if (inspect.effect.kind === 'config-inspected') {
        expect(Object.keys(inspect.effect.effective).length).toBeGreaterThan(0)
      }
    }
  })

  it('E1/E4: template-addressed creations admit DISTINCT new instances (member-activated)', () => {
    const created = A.createdScout as TeamToolsResult
    expect(created.status).toBe('executed')
    const createdEffect = A.createdScoutEffect
    expect(createdEffect).not.toBe(null)
    if (createdEffect !== null) {
      expect(createdEffect.templateId).toBe('scout')
      expect(createdEffect.instanceId).not.toBe(String(P6T2_SEEDS.scout.instanceId))
      expect(typeof createdEffect.childSessionId).toBe('string')
      expect(createdEffect.childSessionId.length).toBeGreaterThan(0)
    }
    const first = C.c1DelegatedOne
    expect(first.status).toBe('executed')
    const second = C.c1DelegatedTwo
    expect(second.status).toBe('executed')
    const firstEffect = C.c1DelegatedOneEffect
    const secondEffect = C.c1DelegatedTwoEffect
    expect(firstEffect).not.toBe(null)
    expect(secondEffect).not.toBe(null)
    if (firstEffect !== null && secondEffect !== null) {
      expect(firstEffect.templateId).toBe('scout')
      expect(secondEffect.templateId).toBe('scout')
      // fresh_per_delegation: every delegation is a NEW instance — never
      // the seeded scout and never each other (invariant 26, E4).
      expect(firstEffect.instanceId).not.toBe(String(P6T2_SEEDS.scout.instanceId))
      expect(secondEffect.instanceId).not.toBe(String(P6T2_SEEDS.scout.instanceId))
      expect(firstEffect.instanceId).not.toBe(secondEffect.instanceId)
      expect(firstEffect.childSessionId).not.toBe(secondEffect.childSessionId)
      expect(firstEffect.childSessionId).not.toBe(String(P6T2_SEEDS.scout.childSessionId))
      expect(firstEffect.childSessionId.length).toBeGreaterThan(0)
      expect(secondEffect.childSessionId.length).toBeGreaterThan(0)
    }
  })

  it('E6: at-limit admitted; over the TEMPLATE limit rejected; over the TEAM limit rejected', () => {
    // C2 at-limit admissions: worker 2/2 (team 3/4, exactly at the
    // template limit) and scout 1/2 (team 4/4, exactly at the team limit)
    // are both ADMITTED — a rejected creation commits nothing, so the team
    // count only moves on success.
    const workerOne = C.c2WorkerOne
    expect(workerOne.status).toBe('executed')
    const workerOneEffect = C.c2WorkerOneEffect
    expect(workerOneEffect).not.toBe(null)
    if (workerOneEffect !== null) {
      expect(workerOneEffect.templateId).toBe('worker')
      expect(workerOneEffect.instanceId).not.toBe(WORKER_ID)
      expect(workerOneEffect.instanceId.length).toBeGreaterThan(0)
    }
    const scoutOne = C.c2ScoutOne
    expect(scoutOne.status).toBe('executed')
    const scoutOneEffect = C.c2ScoutOneEffect
    expect(scoutOneEffect).not.toBe(null)
    if (scoutOneEffect !== null) {
      expect(scoutOneEffect.templateId).toBe('scout')
      expect(scoutOneEffect.instanceId).not.toBe(String(P6T2_SEEDS.scout.instanceId))
    }
    // C1 at-limit admissions: both scout delegates admitted (team 4/4 and
    // scout 2/2 reached exactly — never over-created).
    expect(C.c1DelegatedOne.status).toBe('executed')
    expect(C.c1DelegatedTwo.status).toBe('executed')
    // C1: the third fresh_per_delegation scout delegate dies on the TEAM
    // wall (5 > 4 checked before the scout 3 > 2 template tier).
    expect(C.c1OverTeam.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_INSTANCES,
    )
    // C2: worker #2 (worker 3 > 2) is rejected on the TEMPLATE tier while
    // the team tier stays in-boundary; at team 4/4 the next worker AND
    // scout requests die on the TEAM tier (checked first) — never over-
    // create.
    expect(C.c2WorkerTwo.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
    )
    expect(C.c2WorkerThree.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_INSTANCES,
    )
    expect(C.c2ScoutTwo.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEAM_INSTANCES,
    )
  })

  it('E3: persistent follow-up keeps the SAME bound child session (durable read-back)', () => {
    const one = A.followOneEffect as { instanceId: string; fromLifecycle: string } | null
    const two = A.followTwoEffect as { instanceId: string; fromLifecycle: string } | null
    expect(one).not.toBe(null)
    expect(two).not.toBe(null)
    if (one !== null && two !== null) {
      expect(one.instanceId).toBe(WORKER_ID)
      expect(two.instanceId).toBe(WORKER_ID)
      expect(one.fromLifecycle).toBe('RUNNING')
      expect(two.fromLifecycle).toBe('RUNNING')
    }
    expect(A.durableWorkerSession).toBe(String(P6T2_SEEDS.worker.childSessionId))
  })

  it('E2: label and template addressing on instance-addressed tools are live-rejected', () => {
    expect(A.labelAddressing.code).toBe(TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED)
    expect(A.templateAddressing.code).toBe(TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED)
    expect(A.labelMsg.code).toBe(TEAM_RUNTIME_ERROR_CODES.ACTION_ADDRESSING_REJECTED)
  })

  it('messaging: worker -> leader is delivered direct to the leader bound session', () => {
    const sent = A.sent as TeamToolsResult
    expect(sent.status).toBe('delivered')
    const delivered = A.sentDelivered as {
      recipientInstanceId: string
      deliveryMode: string
      deliveredToInstanceId: string
      deliveredToSessionId: string
    } | null
    expect(delivered).not.toBe(null)
    if (delivered !== null) {
      expect(delivered.recipientInstanceId).toBe(LEADER_ID)
      expect(delivered.deliveryMode).toBe('direct')
      expect(delivered.deliveredToInstanceId).toBe(LEADER_ID)
      expect(delivered.deliveredToSessionId).toBe(String(P6T2_SEEDS.leader.childSessionId))
    }
    const inputs = A.recordedInputs
    expect(inputs.length).toBe(1)
    const firstInput = inputs[0]
    if (firstInput !== undefined) {
      expect(firstInput.sessionId).toBe(String(P6T2_SEEDS.leader.childSessionId))
      expect(firstInput.attribution.kind).toBe('team-relay')
      expect(firstInput.attribution.fromInstanceId).toBe(WORKER_ID)
      expect(firstInput.attribution.intendedForInstanceId).toBe(LEADER_ID)
    }
  })

  it('progress: per-subject sequences (1,2 on unit-a; the other subject restarts at 1)', () => {
    expect(A.progressOneSeq).toBe(1)
    expect(A.progressTwoSeq).toBe(2)
    expect(A.progressOtherSeq).toBe(1)
  })
})

describe('P6-T6 tool set — boundary rejections (fail closed)', () => {
  it('the request-token contract: missing/empty/over-long -> BAD_ARGUMENTS', () => {
    expect(B.noToken.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.emptyToken.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.longToken.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
  })

  it('argument-shape rejections: missing/non-string root, non-object args -> BAD_ARGUMENTS', () => {
    expect(B.noRoot.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.nonStringRoot.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.nonObjectArgs.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
  })

  it('caller resolution: no agent / unknown session / throwing resolver -> CALLER_UNRESOLVED', () => {
    expect(B.noAgent.code).toBe(TEAM_TOOL_CALLER_UNRESOLVED)
    expect(B.unknownSession.code).toBe(TEAM_TOOL_CALLER_UNRESOLVED)
    expect(B.resolverThrow.code).toBe(TEAM_TOOL_CALLER_UNRESOLVED)
  })

  it('delegate XOR: neither or both delegation fields -> BAD_ARGUMENTS', () => {
    expect(B.delegateNeither.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.delegateBoth.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
  })

  it('closed vocabularies: bad progress / kind / decision -> BAD_ARGUMENTS', () => {
    expect(B.badProgress.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.badKind.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    expect(B.badDecision.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
  })

  it('a well-formed unknown instance id is blocked target-stale by the guard (SD-GUARD)', () => {
    // The guard's liveness verdict is final for well-formed targets:
    // missing/ARCHIVED/DISPOSED all block, the runtime is never called,
    // and there are zero side effects (no looser second check behind it).
    expect(B.notFound.status).toBe('blocked')
    expect(B.notFound.reason).toBe('target-stale')
  })

  it('the stale-head retry: one ACTIVITY_SEQUENCE_STALE is retried with a fresh head', () => {
    expect(B.staleRetryAttempts).toBe(2)
    expect(B.staleRetrySeq).toBe(1)
  })
})

// Destroy the A world now that all scenarios and their captures are done
// (the assertions below are pure synchronous reads over captured values).
await destroyP6T1World(A.env.world)
