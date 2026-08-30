/**
 * P6-T6 — the shared test world for the team-tools suites: the full P6-T2
 * durable world (real TeamDomain over a scratch dir + real activation
 * provider + real blueprint catalog) plus the sanctioned satellite set
 * (SD-DEPS) wired over it — the control service, the messaging
 * coordinator (over a RECORDING fake session-input port), and the
 * activity ledger — and finally the `createTeamTools` factory under test.
 *
 * Cross-package test-helper imports from `packages/runtime/test/` are the
 * documented test-only exception to the package-local import rule: the
 * package SRC never imports test helpers (the bypass-scan test pins the
 * src boundary; this file lives under test/).
 *
 * The caller resolution port maps the seeded child-session ids to their
 * member caller identities and the team root to the leader caller — the
 * same contract the E2E harness plugin implements over live agents
 * (SD-CALLER): the tool layer only LOOKS UP the identity; the runtime
 * re-validates it against the durable domain on every call.
 */

import { createActivityLedger } from '../../runtime/activity/index.js'
import type { ActivityLedger } from '../../runtime/activity/index.js'
import type { ActionCaller, TeamRuntime } from '../../runtime/admission/index.js'
import { createControlService } from '../../runtime/control/index.js'
import type { ControlService } from '../../runtime/control/index.js'
import { createMessagingCoordinator } from '../../runtime/messaging/index.js'
import type {
  AttributedSessionInput,
  MessagingCoordinator,
  SessionInputPort,
} from '../../runtime/messaging/index.js'
import type { P6T1World } from '../../runtime/test/p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createP6T2Runtime,
  createP6T2World,
  humanCaller,
  leaderCaller,
  memberCaller,
} from '../../runtime/test/p6t2-helpers.js'
import { createTeamTools } from '../src/index.js'
import type { TeamToolDefinition, TeamToolsResult } from '../src/index.js'

/**
 * The recording fake session-input port (the unit-test stand-in for the
 * harness plugin's real port over live agents). It records every
 * attributed input it receives and can be armed to fail the next
 * `failNext` submissions (the delivery-fault injection; the messaging
 * coordinator then keeps the intent pending).
 */
export interface FakeSessionInputCall {
  readonly sessionId: string
  readonly text: string
  readonly attribution: AttributedSessionInput['attribution']
}

export interface FakeSessionInput extends SessionInputPort {
  /** Every successful submission, in order. */
  readonly calls: FakeSessionInputCall[]
  /** Fail the next N submissions (injected delivery fault). */
  failNext: number
}

export function createFakeSessionInput(): FakeSessionInput {
  const fake: FakeSessionInput = {
    calls: [],
    failNext: 0,
    async submitAttributedInput(input: AttributedSessionInput): Promise<void> {
      if (fake.failNext > 0) {
        fake.failNext -= 1
        throw new Error('fake session input: injected fault')
      }
      fake.calls.push({
        sessionId: input.sessionId,
        text: input.text,
        attribution: input.attribution,
      })
    },
  }
  return fake
}

/** One resolved caller for the seeded world. */
export interface P6T6CallerMap {
  readonly bySession: Map<string, ActionCaller>
}

/**
 * Build the caller-resolution map over the seeded world: the team root
 * resolves to the leader, each seeded member's bound child session
 * resolves to its member identity. Unknown sessions resolve to
 * `undefined` (the tool layer then rejects CALLER_UNRESOLVED).
 */
export function createP6T6CallerMap(
  seedNames: readonly (keyof typeof P6T2_SEEDS)[],
): P6T6CallerMap {
  const bySession = new Map<string, ActionCaller>()
  bySession.set(P6T2_ROOT, leaderCaller())
  for (const name of seedNames) {
    const seed = P6T2_SEEDS[name]
    bySession.set(String(seed.childSessionId), memberCaller(String(seed.instanceId)))
  }
  return { bySession }
}

/** The full P6-T6 world: the world + runtime + satellites + tools. */
export interface P6T6World {
  readonly world: P6T1World
  readonly runtime: TeamRuntime
  readonly control: ControlService
  readonly sessionInput: FakeSessionInput
  readonly messaging: MessagingCoordinator
  readonly activity: ActivityLedger
  readonly callerMap: P6T6CallerMap
  readonly tools: readonly TeamToolDefinition[]
  /** Resolve one tool by name (test ergonomics; throws on a bad name). */
  findTool(name: string): TeamToolDefinition
}

/**
 * Build one full P6-T6 world: P6-T2 world (default seeds
 * leader+worker+scout) + P6-T2 runtime + the sanctioned satellite set +
 * `createTeamTools` over the caller map.
 *
 * @param basename - the scratch dir basename (unique per test file).
 * @param seedNames - which seed members to install (default leader,
 *   worker, scout).
 */
export async function createP6T6World(
  basename: string,
  seedNames: readonly (keyof typeof P6T2_SEEDS)[] = ['leader', 'worker', 'scout'],
): Promise<P6T6World> {
  const world = await createP6T2World(basename, [...seedNames])
  const runtime = createP6T2Runtime(world)
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
  const callerMap = createP6T6CallerMap(seedNames)
  const { tools } = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    async resolveCaller(sessionId: string): Promise<ActionCaller> {
      const caller = callerMap.bySession.get(sessionId)
      if (caller === undefined) {
        throw new Error(`p6t6 caller map: no caller for session ${sessionId}`)
      }
      return caller
    },
  })
  return {
    world,
    runtime,
    control,
    sessionInput,
    messaging,
    activity,
    callerMap,
    tools,
    findTool(name: string): TeamToolDefinition {
      const tool = tools.find((candidate) => candidate.name === name)
      if (tool === undefined) {
        throw new Error(`p6t6: no registered tool named ${name}`)
      }
      return tool
    },
  }
}

/**
 * One execution context for a tool call attributed to a seeded session
 * (the stand-in for the host's `ToolRunContext`: the agent id carries the
 * session identity the caller map resolves).
 */
export function execFor(sessionId: string, callId = 'call-1') {
  return { callId, name: '', arguments: {}, agent: { id: sessionId } }
}

/**
 * Execute one registered tool by name for a session and return its
 * canonical result (the suites assert on the lossless-JSON union).
 */
export async function runTool(
  env: P6T6World,
  name: string,
  args: Record<string, unknown>,
  sessionId: string,
): Promise<TeamToolsResult> {
  const tool = env.findTool(name)
  const result = await tool.execute(args, execFor(sessionId))
  return result
}

/** The default owner human (for the resolver-role scenarios). */
export function ownerHumanCaller(): ActionCaller {
  return humanCaller()
}

/** The team root session id (exported for the suites). */
export { P6T2_NOW, P6T2_ROOT, P6T2_SEEDS }
