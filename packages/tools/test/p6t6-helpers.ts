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
import { createTeamOperationCoordinator } from '../../runtime/coordination/index.js'
import { createGovernanceMutationService } from '../../runtime/governance/index.js'
import type { GovernanceMutationServiceDeps } from '../../runtime/governance/index.js'
import { createPermissionOverlayRepositoryPort } from '../../runtime/permission-governance/index.js'
import { createPermissionLifecycleMutationLane } from '../../runtime/permission-lifecycle/index.js'
import { canonicalizeShellOperation } from '../../runtime/operation-permission/canonical-operation.js'
import type { MemberLifecycleReaderPort } from '../../runtime/permission-lifecycle/types.js'
import type {
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
} from '../../runtime/mutation/index.js'
import type { PolicyStateTransitionRecord } from '../../runtime/mutation/types.js'
import { createTeamTools } from '../src/index.js'
import type {
  ResolvedTeamToolCaller,
  TeamToolDefinition,
  TeamToolsResult,
} from '../src/index.js'

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
  /** True when the governance mutation port was wired (rc2 A8 opt-in). Absent
   *  for a hand-assembled P6-T6 world literal, which is by definition unwired. */
  readonly permissionWired?: boolean
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
/**
 * The three no-permission faces the governance service still requires. They are
 * NO-ops exactly where the runtime's own permission spec (`a3p4-permission-
 * lifecycle-e2e.test.ts`) makes them no-ops — this seam adds no policy, it only
 * declines to invent policy the permission lane must never consult. Each reader
 * throws if the permission lane reaches for it, so "not consulted" stays an
 * asserted fact rather than a silent default.
 */
class NoopOverrides implements OverrideStorePort {
  async list(): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(): Promise<void> {}
}
class NoopTransitions {
  listTransitions(): readonly PolicyStateTransitionRecord[] {
    return []
  }
  appendTransition(): void {}
}
class NoopCommit {
  async commit(): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope() {
    throw new Error('p6t6 permission seam: the static policy reader must not be consulted by the permission lane')
  },
  readTemplatePolicy() {
    throw new Error('p6t6 permission seam: the static policy reader must not be consulted by the permission lane')
  },
  readExternalFacts() {
    throw new Error('p6t6 permission seam: the static policy reader must not be consulted by the permission lane')
  },
}

/**
 * The OPT-IN governance wiring (rc2 A8). OFF by default: every existing P6-T6
 * suite keeps `options.permission === undefined` and therefore the
 * `TEAM_TOOL_PERMISSION_UNWIRED` refusal it was written against — this changes
 * no shipped behaviour and no production permission policy.
 *
 * When enabled, the tools' `permission` port is assembled from the SAME three
 * production factories the runtime's permission spec uses
 * (`createPermissionOverlayRepositoryPort` + `createGovernanceMutationService` +
 * `createPermissionLifecycleMutationLane`) and rides on
 * `world.domain.repositories.permissionOverlays` — the very handle the test READS
 * — so a granted rule lands in the same durable `permission_overlays` store the
 * stasis assertion inspects, not in a second store that happens to look alike.
 */
function createP6T6PermissionSeam(world: P6T1World): NonNullable<
  Parameters<typeof createTeamTools>[0]['permission']
> {
  const repos = world.domain.repositories
  const overlay = createPermissionOverlayRepositoryPort({
    repository: repos.permissionOverlays as never,
  })
  const members: MemberLifecycleReaderPort = {
    readLifecycle: (teamSessionId, memberInstanceId) =>
      repos.memberInstances.get(teamSessionId as never, memberInstanceId as never)?.lifecycle,
  }
  const governance = createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => P6T2_NOW,
    permissionLane: {
      overlay,
      staticLayers: () => ({ layers: [] }),
      // The fixture's containment predicate: `/`-nested canonical keys, the
      // same algebra the runtime permission spec uses. Path AUTHORITY hardening
      // (symlinks, real fs) is NOT what this leg proves.
      subtreeContains: (root: string, child: string): boolean =>
        child === root || child.startsWith(`${root}/`),
    },
  } satisfies GovernanceMutationServiceDeps)
  const lane = createPermissionLifecycleMutationLane({ members, governance, overlay })
  /** The durable effective workspace, exactly as production derives it
   *  (plugin/root.ts:2812-2822): the member's own row, else the TeamSession's
   *  defaultWorkspace, refusing with zero write when neither exists. */
  const effectiveWorkspace = (teamSessionId: string, memberInstanceId: string): string => {
    const workspace = (repos.memberInstances.get(teamSessionId as never, memberInstanceId as never)
      ?.workspace as string | undefined)
      ?? (repos.teamSessions.get(teamSessionId as never)?.defaultWorkspace as string | undefined)
    if (typeof workspace !== 'string' || workspace.length === 0) {
      throw new Error(
        'p6t6 permission seam: the addressed team/member has no durable effective workspace — refusing, zero write',
      )
    }
    return workspace
  }
  const joinAtWorkspace = (workspace: string, path: string): string =>
    `${workspace.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  return {
    async mutatePermission(mutationArgs: Record<string, unknown>): Promise<Record<string, unknown>> {
      // Mirrors the production entry (plugin/root.ts permissionLaneMutate):
      // strip the discriminator, route to the ONE authority lane.
      const { kind, ...laneArgs } = mutationArgs
      if (kind === 'grant_instance') {
        return await lane.grantInstance(laneArgs as never) as unknown as Record<string, unknown>
      }
      if (kind === 'revoke_permission') {
        return await lane.revoke(laneArgs as never) as unknown as Record<string, unknown>
      }
      throw new Error(`p6t6 permission seam: unsupported mutation kind ${JSON.stringify(kind)}`)
    },
    async canonicalizeFile(
      teamSessionId: string,
      memberInstanceId: string,
      path: string,
    ): Promise<string> {
      // The fixture has no host fs provider seam, so joining at the durable
      // effective workspace is the documented stand-in for the provider call:
      // this leg proves the write path and the durable stasis, NOT path-authority
      // hardening (symlink resolution stays the host's job).
      return joinAtWorkspace(effectiveWorkspace(teamSessionId, memberInstanceId), path)
    },
    async canonicalizeExecIntent(
      teamSessionId: string,
      memberInstanceId: string,
      intent: Parameters<NonNullable<Parameters<typeof createTeamTools>[0]['permission']>['canonicalizeExecIntent']>[2],
    ): Promise<string> {
      // The REAL `canonicalizeShellOperation` (operation-permission), the same
      // function the production entry runs, at the target member's durable
      // effective workspace. Only the fs-provider step is the join stand-in.
      const workspace = effectiveWorkspace(teamSessionId, memberInstanceId)
      const { tool, ...execArgs } = intent
      const operation = await canonicalizeShellOperation(tool, execArgs, async (pathInput: string) => {
        const key = joinAtWorkspace(workspace, pathInput)
        return { key, display: pathInput, handle: { targetKey: key } }
      })
      return operation.fingerprint
    },
  }
}

export async function createP6T6World(
  basename: string,
  seedNames: readonly (keyof typeof P6T2_SEEDS)[] = ['leader', 'worker', 'scout'],
  options: {
    /** Wire the REAL governance mutation port into the tools (rc2 A8). */
    readonly permissionLane?: boolean
  } = {},
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
  const permission = options.permissionLane === true ? createP6T6PermissionSeam(world) : undefined
  const { tools } = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    async resolveCaller(sessionId: string): Promise<ResolvedTeamToolCaller> {
      const caller = callerMap.bySession.get(sessionId)
      if (caller === undefined) {
        throw new Error(`p6t6 caller map: no caller for session ${sessionId}`)
      }
      // P0: the single-root fixture world — every seeded session owns the
      // fixture root.
      return { caller, rootSessionId: String(P6T2_ROOT) }
    },
    ...(permission === undefined ? {} : { permission }),
  })
  return {
    permissionWired: permission !== undefined,
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
