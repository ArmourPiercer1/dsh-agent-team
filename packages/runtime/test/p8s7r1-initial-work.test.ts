/**
 * P8-S7R1 / R1-A (BC-03, plan L1720) — `team.create` optional `initialWork`:
 * runtime admission acceptance over REAL TeamDomain worlds.
 *
 * The materialized team carries the optional initial work admitted through
 * the EXISTING work-admission path (facade `follow-up` on the leader
 * instance — no new architecture, no new remote method). The S6 remote
 * port runs the full production chain: closed param parsing → A32
 * principal derivation → root binding (fresh/cold) → `TeamRuntime.
 * performAction` (step-0 validation BEFORE the durable bind, gates and the
 * work-chain token protocol under facade authority AFTER it).
 *
 * - C1a ABSENT `initialWork` → byte-identical behavior: the reply is the
 *   frozen `{ path, durable, bind }` shape and NO work fact exists;
 * - C1b PRESENT `initialWork` → exactly ONE `team-work-admitted` fact
 *   targeting the leader instance (`inst-leader`), the prompt stored
 *   verbatim in the durable fact payload, the reply shape UNCHANGED (the
 *   work is observable through the ledger, not the reply);
 * - C1c RETRY of the same create (same `initialWork`) → the content-hash
 *   work-chain token REPLAY/RESUMEs: still exactly ONE work fact (zero
 *   duplicate admits);
 * - C1d FRESH path (the durable TeamSession row absent → `bindFresh`) with
 *   `initialWork` → `path: 'fresh-root'` + exactly ONE work fact;
 * - C1e MALFORMED `initialWork` (no `prompt`) on the FRESH path → the
 *   existing `TEAM_RUNTIME_REQUEST_MALFORMED` pass-through (NO new error
 *   code), and NO partial creation: the TeamSession row is still absent,
 *   the leader row was never minted by the create, zero work facts.
 *
 * Method: top-level-await scenario capture over REAL TeamDomain worlds
 * (testkit FileStorageSeam, P6-T2 fixtures) with the P8-S3 production
 * work-chain wiring (fake lifecycle commit + no-op delivery + in-facade
 * activity writer); the `it` bodies assert only over captured data.
 *
 * @module @dsh-agent-team/runtime/test/p8s7r1-initial-work
 */

import { describe, expect, it } from 'vitest'

import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions, S6RootBindingPort } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import { REMOTE_CONTRACT_VERSION } from '../../remote/src/index.js'
import type { RemoteDispatcher, RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import {
  bindFreshTeamRoot,
  createTeamDomainWritePort,
  rehydrateColdTeamRoot,
} from '../root-binding/index.js'
import type { RootBindingPorts } from '../root-binding/index.js'
import { createTeamDomainReadHandle } from '../agent-setup/binder/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import type { TeamRuntime } from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import type { AdmittedGovernanceOverride } from '../mutation/index.js'
import type { CompatibilityProber } from '../compatibility/index.js'
import type { HandoffService } from '../handoff/index.js'
import type { LifecycleService } from '../lifecycle/index.js'
import type { LegacyInspectFn } from '../src/plugin/legacy-surface.js'
import type { ProjectionService } from '../projection/index.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
} from './p6t2-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const BP_ID = 'P6T2-BP'
const LEADER_ID = P6T2_SEEDS.leader.instanceId
/** The lossless-JSON-safe initial work admitted on create (C1b-C1e). */
const WORK: RemoteSafeRecord = {
  prompt: 'run the initial investigation over the pinned sources',
  attachedContext: 'initial context block',
}

// ---------------------------------------------------------------------------
// S6 wiring over one world (the production port set, the ports this test
// does not route are unused stubs)
// ---------------------------------------------------------------------------

function rootBindingPorts(world: P6T1World): RootBindingPorts {
  return {
    teamDomain: createTeamDomainReadHandle(world.domain.repositories),
    writes: createTeamDomainWritePort(world.domain.repositories),
    surface: world.surface,
    now: () => P6T2_NOW,
    blueprintCatalog: world.catalog,
  }
}

/** The FULL P8-S3 production work-chain wiring over one world. */
function fenceRuntime(world: P6T1World): TeamRuntime {
  const deliveryCalls: { readonly instanceId: string; readonly requestToken: string }[] = []
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(world),
    workDelivery: {
      async deliver(args: { readonly instanceId: string; readonly requestToken: string }) {
        deliveryCalls.push({ instanceId: args.instanceId, requestToken: args.requestToken })
      },
    },
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
  })
}

function buildOptions(world: P6T1World, runtime: TeamRuntime): S6RemoteOptions {
  const rootBinding: S6RootBindingPort = {
    bindFresh: (input) => bindFreshTeamRoot(rootBindingPorts(world), input),
    rehydrateCold: (input) => rehydrateColdTeamRoot(rootBindingPorts(world), input),
  }
  const unused = (): never => {
    throw new Error('this test only routes team.create')
  }
  return {
    rootSessionId: P6T2_ROOT,
    repositories: world.domain.repositories,
    catalog: world.catalog,
    blueprint: world.blueprint,
    leaderInstanceId: LEADER_ID,
    projection: { project: unused } as unknown as ProjectionService,
    runtime,
    lifecycle: { switchState: unused } as unknown as LifecycleService,
    mutationService: { switchPolicyState: unused },
    mutationTransitions: () => [],
    admitGovernanceOverride:
      (): Promise<AdmittedGovernanceOverride> => Promise.reject(new Error('unused in this test')),
    overrideStore: {} as never,
    overrideRecords: () => [],
    rootBinding,
    compatibility: {} as unknown as CompatibilityProber,
    handoff: {} as unknown as HandoffService,
    legacyInspect: unused as unknown as LegacyInspectFn,
    legacyHome: undefined,
    messaging: { sendTeamMessage: unused, recoverPendingDeliveries: unused },
    principal: createServerPrincipalDerivation({
      rootSessionId: P6T2_ROOT,
      repositories: world.domain.repositories,
      leaderInstanceId: LEADER_ID,
    }),
    now: () => P6T2_NOW,
  }
}

function buildDispatcher(world: P6T1World): RemoteDispatcher {
  const runtime = fenceRuntime(world)
  const ports = createS6RemotePorts(buildOptions(world, runtime))
  return createS6RemoteDispatcher(ports, buildOptions(world, runtime).principal)
}

// ---------------------------------------------------------------------------
// Observables
// ---------------------------------------------------------------------------

/** The `team-work-admitted` facts admitted for one instance (zombie-work check). */
function countWorkFacts(world: P6T1World, instanceId: string): number {
  return world.domain.repositories.ledger
    .list()
    .filter(
      (entry) =>
        entry.factType === 'team-work-admitted' && entry.payload['targetInstanceId'] === instanceId,
    ).length
}

/** The prompt of the first `team-work-admitted` fact for one instance. */
function firstFactPrompt(world: P6T1World, instanceId: string): string | undefined {
  const entry = world.domain.repositories.ledger
    .list()
    .find(
      (e) =>
        e.factType === 'team-work-admitted' && e.payload['targetInstanceId'] === instanceId,
    )
  return entry === undefined ? undefined : String(entry.payload['prompt'])
}

/** One `team.create` attempt over the production dispatcher (captured snapshot). */
interface CreateSnapshot {
  readonly ok: boolean
  readonly path: string | undefined
  readonly replyKeys: string[]
  readonly error: {
    readonly code: string
    readonly causeCode: string | undefined
  } | undefined
  readonly workFacts: number
  readonly factPrompt: string | undefined
  readonly teamRowPresent: boolean
}

async function runCreate(
  dispatcher: RemoteDispatcher,
  world: P6T1World,
  initialWork: RemoteSafeRecord | undefined,
): Promise<CreateSnapshot> {
  const params: Record<string, unknown> = { rootSessionId: P6T2_ROOT, blueprintId: BP_ID }
  if (initialWork !== undefined) params['initialWork'] = initialWork
  const response: RemoteResponse = await dispatcher('team.create', {
    version: REMOTE_CONTRACT_VERSION,
    params: params as RemoteSafeRecord,
  })
  const workFacts = countWorkFacts(world, LEADER_ID)
  if (response.ok) {
    const data = response.value.data as Record<string, unknown>
    return {
      ok: true,
      path: data['path'] === undefined ? undefined : String(data['path']),
      replyKeys: Object.keys(data).sort(),
      error: undefined,
      workFacts,
      factPrompt: firstFactPrompt(world, LEADER_ID),
      teamRowPresent: world.domain.repositories.teamSessions.get(P6T2_ROOT) !== undefined,
    }
  }
  const error = response.error
  const cause = error.details as unknown as { readonly cause?: { readonly code?: unknown } }
  return {
    ok: false,
    path: undefined,
    replyKeys: [],
    error: {
      code: error.code,
      causeCode: cause.cause === undefined ? undefined : String(cause.cause.code ?? ''),
    },
    workFacts,
    factPrompt: firstFactPrompt(world, LEADER_ID),
    teamRowPresent: world.domain.repositories.teamSessions.get(P6T2_ROOT) !== undefined,
  }
}

// ---------------------------------------------------------------------------
// Scenario capture (top-level await; the `it` bodies assert only)
// ---------------------------------------------------------------------------

const worldCold = await createP6T2World('p8s7r1-cold', ['leader', 'worker'])
const dispatcherCold = buildDispatcher(worldCold)
const snapAbsent = await runCreate(dispatcherCold, worldCold, undefined)
const snapPresent = await runCreate(dispatcherCold, worldCold, WORK)
const snapRetry = await runCreate(dispatcherCold, worldCold, WORK)
destroyP6T1World(worldCold)

const worldFresh = await createP6T2World('p8s7r1-fresh', ['leader', 'worker'])
// Remove the P6-T1 pre-arrangement (TeamSession record + the 'team-root'
// session binding) so the world presents a genuinely unbound root: a
// binding WITHOUT its record is a TeamDomain integrity violation
// (ROOT_BINDING_TEAM_SESSION_CONFLICT), not a fresh-create input.
const deletedFresh = await worldFresh.domain.repositories.teamSessions.delete(P6T2_ROOT)
const deletedFreshBinding = await worldFresh.domain.repositories.sessionBindings.delete(P6T2_ROOT)
const dispatcherFresh = buildDispatcher(worldFresh)
const snapFresh = await runCreate(dispatcherFresh, worldFresh, WORK)
destroyP6T1World(worldFresh)

const worldMalformed = await createP6T2World('p8s7r1-malformed', ['leader', 'worker'])
const deletedMalformed = await worldMalformed.domain.repositories.teamSessions.delete(P6T2_ROOT)
const deletedMalformedBinding = await worldMalformed.domain.repositories.sessionBindings.delete(P6T2_ROOT)
const dispatcherMalformed = buildDispatcher(worldMalformed)
const snapMalformed = await runCreate(
  dispatcherMalformed,
  worldMalformed,
  { note: 'an initial work without the required prompt' },
)
destroyP6T1World(worldMalformed)

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P8-S7R1 R1-A C1: team.create optional initialWork (runtime admission)', () => {
  it('C1a: absent initialWork is byte-identical — frozen reply shape, no work fact', () => {
    expect(snapAbsent.ok).toBe(true)
    // the world's seeded TeamSession row: the COLD rehydrate path
    expect(snapAbsent.path).toBe('cold-root')
    // the frozen reply shape — exactly { bind, durable, path }, no work field
    expect(snapAbsent.replyKeys).toEqual(['bind', 'durable', 'path'])
    expect(snapAbsent.workFacts).toBe(0)
    expect(snapAbsent.teamRowPresent).toBe(true)
  })

  it('C1b: present initialWork admits exactly ONE team-work-admitted fact on the leader; reply shape unchanged', () => {
    expect(snapPresent.ok).toBe(true)
    expect(snapPresent.path).toBe('cold-root')
    expect(snapPresent.replyKeys).toEqual(['bind', 'durable', 'path'])
    // the initial work is admitted through the existing work-admission path
    expect(snapPresent.workFacts).toBe(1)
    // the prompt is stored verbatim in the durable fact payload
    expect(snapPresent.factPrompt).toBe(WORK['prompt'])
  })

  it('C1c: retrying the same create REPLAYs the work-chain token — still exactly ONE work fact', () => {
    expect(snapRetry.ok).toBe(true)
    expect(snapRetry.path).toBe('cold-root')
    expect(snapRetry.replyKeys).toEqual(['bind', 'durable', 'path'])
    // zero duplicate admits (SETTLED fact → REPLAY, or admitted → RESUME)
    expect(snapRetry.workFacts).toBe(1)
    expect(snapRetry.factPrompt).toBe(WORK['prompt'])
  })

  it('C1d: the FRESH path (pre-seeded team rows removed) binds fresh and admits exactly ONE work fact', () => {
    expect(deletedFresh).toBe(true)
    expect(deletedFreshBinding).toBe(true)
    expect(snapFresh.ok).toBe(true)
    expect(snapFresh.path).toBe('fresh-root')
    expect(snapFresh.replyKeys).toEqual(['bind', 'durable', 'path'])
    expect(snapFresh.workFacts).toBe(1)
    expect(snapFresh.factPrompt).toBe(WORK['prompt'])
    // the durable TeamSession row exists again after the fresh bind
    expect(snapFresh.teamRowPresent).toBe(true)
  })

  it('C1e: malformed initialWork (no prompt) on the FRESH path — REQUEST_MALFORMED pass-through, no partial creation', () => {
    expect(deletedMalformed).toBe(true)
    expect(deletedMalformedBinding).toBe(true)
    expect(snapMalformed.ok).toBe(false)
    // the EXISTING runtime error code passes through (no new code)
    expect(snapMalformed.error?.code).toBe(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED)
    expect(snapMalformed.error?.causeCode).toBe(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED)
    // no partial creation: the step-0 validation ran BEFORE the durable bind
    expect(snapMalformed.teamRowPresent).toBe(false)
    expect(snapMalformed.workFacts).toBe(0)
    expect(snapMalformed.factPrompt).toBe(undefined)
  })
})
