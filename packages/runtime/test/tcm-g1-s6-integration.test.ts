/**
 * tcm-g1-s6-integration.test.ts — TCM vNext STAGE G1 (plan §15.6/§15.8/§2.2):
 * the S6 PRODUCTION team-create v2 surface over REAL TeamDomain worlds.
 *
 * The dispatcher under test is the REAL production wiring
 * (`createS6RemotePorts` + `createS6RemoteDispatcher` over the P6-T2
 * durable worlds, the real root binding, the real server principal
 * derivation, and the real plan §15.8 Root initial-work closure —
 * `createAdmitRootInitialWork` over the shared coordination chains +
 * the single compatibility gate). Only the HOST-BOUNDARY seams are
 * fakes (the same pattern as tcm-m2-workspace-attach / p8s7r1): the
 * workspace attach port (the host entry's closure over the public
 * workspaceRegistry), the glue's createRootAgent start port, and the
 * glue's deliverRootWork input seam.
 *
 * Covers (the G1 focused surface the mandate names):
 *  - FRESH v2 create WITHOUT workspace → the host default workspace
 *    carries; no resolve, no attach (the plan §2.2 order trivially holds);
 *  - FRESH v2 create WITH workspace → the plan §2.2 order asserted over
 *    one event log: resolve (registry canonical, verbatim) → durable bind
 *    (`defaultWorkspace` = the canonical path) → root start →
 *    Workspace.attachSession;
 *  - FRESH v2 create with an UNREGISTERED workspace → typed
 *    `TEAM_CREATE_WORKSPACE_NOT_FOUND` BEFORE any durable effect (no team
 *    row, no start, no attach);
 *  - FRESH v2 create where attachSession REJECTS → typed
 *    `TEAM_CREATE_WORKSPACE_ATTACH_FAILED`, the durable bind RETAINED
 *    (the team row stays, with the canonical defaultWorkspace); the
 *    retry (cold path) re-drives the start + the attach and succeeds;
 *  - COLD v2 create asserting a DIFFERENT workspace than the durable
 *    defaultWorkspace → typed `TEAM_CREATE_WORKSPACE_MISMATCH`, zero
 *    writes (no start, no attach);
 *  - COLD v2 create asserting the SAME workspace → idempotent:
 *    `cold-root`, the attach re-driven (upstream idempotency); the
 *    workspace-OMITTING cold retry asserts nothing (no resolve, no
 *    attach, the durable workspace stands);
 *  - v2 `team.admitInitialWork` fresh → the outcome record is the success
 *    data (`mode: 'fresh'`, `delivered: true`), the Root two-fact pair is
 *    durable (ONE `team-work-admitted` + ONE `team-root-work-delivered`,
 *    both `targetKind: 'root'`), the live seam was driven exactly once
 *    with the request's prompt + attachedContext;
 *  - v2 admit REPLAY (same token + same payload) → `mode: 'replay'`,
 *    `delivered: false`, ZERO new facts, ZERO new delivery;
 *  - v2 admit MISMATCH (same token + different payload) → typed
 *    `TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH` (the M1 closed wire
 *    vocabulary);
 *  - v2 admit FOREIGN TOKEN (the one initial-work slot is occupied) →
 *    typed `TEAM_RUNTIME_INITIAL_WORK_ALREADY_ADMITTED` pass-through;
 *  - v1 `team.create` WITH `initialWork` (the G1 v1 repair) → the SAME
 *    Root strategy: the Root two-fact pair, the content-hash v1 token on
 *    the delivered work, the frozen `{ path, durable, bind }` reply.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/tcm-g1-s6-integration
 */

import { describe, expect, it } from 'vitest'

import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions, S6RootBindingPort } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import { TEAM_PLUGIN_ERROR_CODES, TeamPluginError } from '../src/plugin/types.js'
import type { WorkspaceAttachPort } from '../src/plugin/types.js'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
} from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import { createAdmitRootInitialWork } from '../action-router/index.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createP6T2Runtime,
  createP6T2World,
} from './p6t2-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  bindFreshTeamRoot,
  createTeamDomainWritePort,
  rehydrateColdTeamRoot,
} from '../root-binding/index.js'
import type { RootBindingPorts } from '../root-binding/index.js'
import { createTeamDomainReadHandle } from '../agent-setup/binder/index.js'

const BP_ID = 'P6T2-BP'
const LEADER_ID = P6T2_SEEDS.leader.instanceId
/** The host default workspace (the row config this remote surface carries). */
const HOST_DEFAULT_WORKSPACE = 'C:/agent-team/work/g1-host'
/** The registered workspace: the client's requested path → the registry's canonical path. */
const WS_REQUESTED = '/w/g1-project'
const WS_CANONICAL = 'C:/agent-team/work/g1-project'
const WS_ID = 'ws-g1-project'
/** The workspace registered for the COLD world's seeded default path. */
const WS_COLD_PATH = 'C:/agent-team/work/p6t1'
const WS_COLD_ID = 'ws-g1-p6t1'
const WS_REGISTERED = new Map<string, { id: string; canonical: string }>([
  [WS_REQUESTED, { id: WS_ID, canonical: WS_CANONICAL }],
  [WS_COLD_PATH, { id: WS_COLD_ID, canonical: WS_COLD_PATH }],
])
/** The v2 initial work command's prompt + the attached context block. */
const ADMIT_PROMPT = 'the g1 initial work prompt'
const ADMIT_CONTEXT = 'the g1 attached context'
const ADMIT_TOKEN = 'tok-g1-admit-1'
const V1_WORK_PROMPT = 'the v1 g1 work prompt'

// ---------------------------------------------------------------------------
// Fakes (the host-boundary seams only)
// ---------------------------------------------------------------------------

/** One recorded delivery of the Root initial work (the glue's input seam). */
interface DeliveryCall {
  readonly rootSessionId: string
  readonly requestToken: string
  readonly prompt: string
  readonly attachedContext?: string
}

/** The workspace attach fake: the registry + a one-shot attach fault. */
function createWorkspaceFake(events: string[]) {
  let failNextAttach = false
  const port: WorkspaceAttachPort = {
    async resolvePath(path: string) {
      events.push(`resolve:${path}`)
      const entry = WS_REGISTERED.get(path)
      if (entry === undefined) {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND,
          `no workspace is registered for path "${path}"`,
          { reason: 'not-registered' },
        )
      }
      return { workspaceId: entry.id, path: entry.canonical }
    },
    async attachSession(workspaceId: string, sessionId: string) {
      events.push(`attach:${workspaceId}:${sessionId}`)
      if (failNextAttach) {
        failNextAttach = false
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED,
          'the workspace service refused the attach',
          { reason: 'attach-refused' },
        )
      }
    },
  }
  return {
    port,
    failNextAttach: () => {
      failNextAttach = true
    },
  }
}

/** The root-binding ports over one world (the real bind/rehydrate cores). */
function rootBindingPorts(world: P6T1World): RootBindingPorts {
  return {
    teamDomain: createTeamDomainReadHandle(world.domain.repositories),
    writes: createTeamDomainWritePort(world.domain.repositories),
    surface: world.surface,
    now: () => P6T2_NOW,
    blueprintCatalog: world.catalog,
  }
}

/**
 * The FULL production S6 wiring over one world: the real ports + the real
 * plan §15.8 Root initial-work closure (standalone coordination chains —
 * no contention in this suite) + the scenario's host-boundary fakes.
 */
function buildG1Dispatcher(
  world: P6T1World,
  events: string[],
  ws: ReturnType<typeof createWorkspaceFake>,
  starts: string[],
  deliveries: DeliveryCall[],
): RemoteDispatcherLike {
  const rootBinding: S6RootBindingPort = {
    bindFresh: (input) => bindFreshTeamRoot(rootBindingPorts(world), input),
    rehydrateCold: (input) => rehydrateColdTeamRoot(rootBindingPorts(world), input),
  }
  const unused = (): never => {
    throw new Error('this test only routes team.create / team.admitInitialWork')
  }
  const admitRootInitialWork = createAdmitRootInitialWork({
    teamLocks: createTeamOperationCoordinator().chains,
    repositories: world.domain.repositories,
    environmentFacts: world.ports.environmentFacts,
    now: () => P6T2_NOW,
    deliverRootWork: {
      deliverRootWork: (input) => {
        deliveries.push({
          rootSessionId: input.rootSessionId,
          requestToken: input.requestToken,
          prompt: input.prompt,
          ...(input.attachedContext !== undefined ? { attachedContext: input.attachedContext } : {}),
        })
        events.push(`deliver:${input.requestToken}`)
        return Promise.resolve()
      },
    },
  })
  const options: S6RemoteOptions = {
    rootSessionId: P6T2_ROOT,
    defaultWorkspace: HOST_DEFAULT_WORKSPACE,
    repositories: world.domain.repositories,
    catalog: world.catalog,
    blueprint: world.blueprint,
    leaderInstanceId: LEADER_ID,
    projection: { project: unused } as never,
    runtime: createP6T2Runtime(world),
    lifecycle: { switchState: unused } as never,
    mutationService: { switchPolicyState: unused },
    mutationTransitions: () => [],
    admitGovernanceOverride: (): Promise<never> => Promise.reject(new Error('unused in this test')),
    overrideStore: {} as never,
    overrideRecords: () => [],
    rootBinding,
    compatibility: {} as never,
    handoff: {} as never,
    legacyInspect: unused as never,
    legacyHome: undefined,
    messaging: { sendTeamMessage: unused, recoverPendingDeliveries: unused },
    workspaceAttach: ws.port,
    admitRootInitialWork,
    principal: createServerPrincipalDerivation({
      rootSessionId: P6T2_ROOT,
      repositories: world.domain.repositories,
      leaderInstanceId: LEADER_ID,
    }),
    // The start fake records the event AND whether the durable team row
    // already exists (the bind-before-start half of the plan §2.2 order).
    startRootAgent: (rootSessionId: string) => {
      starts.push(rootSessionId)
      const rowPresent =
        world.domain.repositories.teamSessions.get(rootSessionId) !== undefined
      events.push(`start:${rootSessionId}:${rowPresent ? 'row' : 'norow'}`)
      return Promise.resolve()
    },
    now: () => P6T2_NOW,
  }
  const ports = createS6RemotePorts(options)
  return createS6RemoteDispatcher(ports, options.principal)
}

/** The remote dispatcher shape this test drives. */
type RemoteDispatcherLike = (endpoint: string, payload: unknown) => Promise<RemoteResponse>

/** The typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('G1 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** The success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('G1 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

/** The `team-work-admitted` Root facts of one world. */
function countRootAdmitted(world: P6T1World): number {
  return world.domain.repositories.ledger
    .list()
    .filter(
      (entry) =>
        entry.factType === 'team-work-admitted' && entry.payload['targetKind'] === 'root',
    ).length
}

/** The terminal `team-root-work-delivered` Root facts of one world. */
function countRootDelivered(world: P6T1World): number {
  return world.domain.repositories.ledger
    .list()
    .filter(
      (entry) =>
        entry.factType === 'team-root-work-delivered' && entry.payload['targetKind'] === 'root',
    ).length
}

/** Remove the world's seeded TeamSession + team-root binding (the fresh path). */
async function unseedWorld(world: P6T1World): Promise<[boolean, boolean]> {
  const row = await world.domain.repositories.teamSessions.delete(P6T2_ROOT)
  const binding = await world.domain.repositories.sessionBindings.delete(P6T2_ROOT)
  return [row, binding]
}

/** One v2 `team.create` attempt (workspace optional). */
async function v2Create(
  dispatch: RemoteDispatcherLike,
  workspace: string | undefined,
): Promise<RemoteResponse> {
  const params: Record<string, unknown> = { rootSessionId: P6T2_ROOT, blueprintId: BP_ID }
  if (workspace !== undefined) params['workspace'] = workspace
  return await dispatch('team.create', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params,
  })
}

/** One v2 `team.admitInitialWork` attempt. */
async function v2Admit(
  dispatch: RemoteDispatcherLike,
  requestToken: string,
  prompt: string,
  attachedContext: string | undefined,
): Promise<RemoteResponse> {
  const params: Record<string, unknown> = {
    rootSessionId: P6T2_ROOT,
    requestToken,
    prompt,
  }
  if (attachedContext !== undefined) params['attachedContext'] = attachedContext
  return await dispatch('team.admitInitialWork', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params,
  })
}

// ---------------------------------------------------------------------------
// Scenario capture (top-level await; the `it` bodies assert only)
// ---------------------------------------------------------------------------

interface WorldCapture {
  readonly world: P6T1World
  readonly events: string[]
  readonly starts: string[]
  readonly deliveries: DeliveryCall[]
}

function freshWorld(basename: string): Promise<WorldCapture> {
  return createP6T2World(basename, ['leader', 'worker']).then((world) => ({
    world,
    events: [] as string[],
    starts: [] as string[],
    deliveries: [] as DeliveryCall[],
  }))
}

// G1a — FRESH v2 create WITHOUT workspace: the host default carries.
const wA = await freshWorld('tcm-g1-fresh-nows')
await unseedWorld(wA.world)
const wsA = createWorkspaceFake(wA.events)
const dA = buildG1Dispatcher(wA.world, wA.events, wsA, wA.starts, wA.deliveries)
const respA = await v2Create(dA, undefined)
const rowA = wA.world.domain.repositories.teamSessions.get(P6T2_ROOT)
destroyP6T1World(wA.world)

// G1b — FRESH v2 create WITH workspace: the plan §2.2 order (one event log).
const wB = await freshWorld('tcm-g1-fresh-ws')
await unseedWorld(wB.world)
const wsB = createWorkspaceFake(wB.events)
const dB = buildG1Dispatcher(wB.world, wB.events, wsB, wB.starts, wB.deliveries)
const respB = await v2Create(dB, WS_REQUESTED)
const rowB = wB.world.domain.repositories.teamSessions.get(P6T2_ROOT)
destroyP6T1World(wB.world)

// G1c — FRESH v2 create with an UNREGISTERED workspace: typed, no bind.
const wC = await freshWorld('tcm-g1-fresh-unknown')
await unseedWorld(wC.world)
const wsC = createWorkspaceFake(wC.events)
const dC = buildG1Dispatcher(wC.world, wC.events, wsC, wC.starts, wC.deliveries)
const respC = await v2Create(dC, '/w/g1-missing')
const rowC = wC.world.domain.repositories.teamSessions.get(P6T2_ROOT)
destroyP6T1World(wC.world)

// G1d — FRESH v2 create where the attach REJECTS: the durable bind is
// retained; the retry (cold path) re-drives the start + the attach.
const wD = await freshWorld('tcm-g1-fresh-attachfail')
await unseedWorld(wD.world)
const wsD = createWorkspaceFake(wD.events)
wsD.failNextAttach()
const dD = buildG1Dispatcher(wD.world, wD.events, wsD, wD.starts, wD.deliveries)
const respD1 = await v2Create(dD, WS_REQUESTED)
const rowD1 = wD.world.domain.repositories.teamSessions.get(P6T2_ROOT)
const respD2 = await v2Create(dD, WS_REQUESTED)
destroyP6T1World(wD.world)

// G1e — COLD v2 create asserting a DIFFERENT workspace: typed mismatch.
const wE = await freshWorld('tcm-g1-cold-mismatch')
const wsE = createWorkspaceFake(wE.events)
const dE = buildG1Dispatcher(wE.world, wE.events, wsE, wE.starts, wE.deliveries)
const respE = await v2Create(dE, WS_REQUESTED)
destroyP6T1World(wE.world)

// G1f — COLD v2 create asserting the SAME workspace (idempotent attach) +
// the workspace-OMITTING cold retry (asserts nothing).
const wF = await freshWorld('tcm-g1-cold-idempotent')
const wsF = createWorkspaceFake(wF.events)
const dF = buildG1Dispatcher(wF.world, wF.events, wsF, wF.starts, wF.deliveries)
const respF1 = await v2Create(dF, WS_COLD_PATH)
const respF2 = await v2Create(dF, undefined)
destroyP6T1World(wF.world)

// G1g — v2 team.admitInitialWork: fresh / replay / mismatch / foreign token.
const wG = await freshWorld('tcm-g1-admit')
const wsG = createWorkspaceFake(wG.events)
const dG = buildG1Dispatcher(wG.world, wG.events, wsG, wG.starts, wG.deliveries)
const respG1 = await v2Admit(dG, ADMIT_TOKEN, ADMIT_PROMPT, ADMIT_CONTEXT)
const g1Counts = [countRootAdmitted(wG.world), countRootDelivered(wG.world)]
const respG2 = await v2Admit(dG, ADMIT_TOKEN, ADMIT_PROMPT, ADMIT_CONTEXT)
const g2Counts = [countRootAdmitted(wG.world), countRootDelivered(wG.world)]
const respG3 = await v2Admit(dG, ADMIT_TOKEN, 'a DIFFERENT payload prompt', ADMIT_CONTEXT)
const g3Counts = [countRootAdmitted(wG.world), countRootDelivered(wG.world)]
const respG4 = await v2Admit(dG, 'tok-g1-admit-other', 'another token', undefined)
const g4Counts = [countRootAdmitted(wG.world), countRootDelivered(wG.world)]
destroyP6T1World(wG.world)

// G1h — v1 team.create WITH initialWork: the SAME Root strategy (the v1 repair).
const wH = await freshWorld('tcm-g1-v1-work')
await unseedWorld(wH.world)
const wsH = createWorkspaceFake(wH.events)
const dH = buildG1Dispatcher(wH.world, wH.events, wsH, wH.starts, wH.deliveries)
const respH = await dH('team.create', {
  version: REMOTE_CONTRACT_VERSION,
  params: { rootSessionId: P6T2_ROOT, blueprintId: BP_ID, initialWork: { prompt: V1_WORK_PROMPT } },
})
const gHCounts = [countRootAdmitted(wH.world), countRootDelivered(wH.world)]
destroyP6T1World(wH.world)

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('TCM G1: the S6 production team-create v2 surface (plan §15.6/§15.8)', () => {
  it('G1a: FRESH v2 create without workspace — host default carries, no resolve/attach', () => {
    expect(respA.ok).toBe(true)
    if (!respA.ok) throw new Error('G1 guard: expected success')
    expect(dataOf(respA)['path']).toBe('fresh-root')
    expect(Object.keys(dataOf(respA)).sort()).toEqual(['bind', 'durable', 'path'])
    // the durable row carries the HOST default workspace
    expect(rowA).not.toBe(undefined)
    if (rowA === undefined) throw new Error('G1 guard: expected the team row')
    expect(String(rowA.defaultWorkspace)).toBe(HOST_DEFAULT_WORKSPACE)
    // no workspace seam was touched at all
    expect(wA.events).toEqual([`start:${P6T2_ROOT}:row`])
    expect(wA.starts).toEqual([P6T2_ROOT])
    expect(wA.deliveries.length).toBe(0)
  })

  it('G1b: FRESH v2 create with workspace — the plan §2.2 order: resolve → bind(canonical) → start → attach', () => {
    expect(respB.ok).toBe(true)
    if (!respB.ok) throw new Error('G1 guard: expected success')
    expect(dataOf(respB)['path']).toBe('fresh-root')
    // the registry's canonical path is bound VERBATIM (the seam never
    // re-normalizes the client's requested path)
    expect(rowB).not.toBe(undefined)
    if (rowB === undefined) throw new Error('G1 guard: expected the team row')
    expect(String(rowB.defaultWorkspace)).toBe(WS_CANONICAL)
    // the ONE event log pins the order: resolve → bind (the start event
    // records the row already present) → start → attach
    expect(wB.events).toEqual([
      `resolve:${WS_REQUESTED}`,
      `start:${P6T2_ROOT}:row`,
      `attach:${WS_ID}:${P6T2_ROOT}`,
    ])
    expect(wB.starts).toEqual([P6T2_ROOT])
  })

  it('G1c: FRESH v2 create with an UNREGISTERED workspace — typed TEAM_CREATE_WORKSPACE_NOT_FOUND, no durable effect', () => {
    expect(respC.ok).toBe(false)
    const error = errorOf(respC)
    expect(error['code']).toBe('TEAM_CREATE_WORKSPACE_NOT_FOUND')
    // the upstream reason rides through (the closure's typed message)
    expect(
      String(error['message']).includes('no workspace is registered for path "/w/g1-missing"'),
    ).toBe(true)
    // the typed rejection ran BEFORE any durable effect: no row, no start,
    // no attach
    expect(rowC).toBe(undefined)
    expect(wC.starts).toEqual([])
    expect(wC.events).toEqual(['resolve:/w/g1-missing'])
  })

  it('G1d: FRESH v2 create with a REJECTING attach — typed, durable bind retained; the cold retry re-drives start + attach and succeeds', () => {
    expect(respD1.ok).toBe(false)
    const error = errorOf(respD1)
    expect(error['code']).toBe('TEAM_CREATE_WORKSPACE_ATTACH_FAILED')
    // the durable bind already landed: the team row stays durable, with
    // the canonical defaultWorkspace (the typed retryable failure)
    expect(rowD1).not.toBe(undefined)
    if (rowD1 === undefined) throw new Error('G1 guard: expected the retained team row')
    expect(String(rowD1.defaultWorkspace)).toBe(WS_CANONICAL)
    // the retry (the COLD path): the start + the attach are re-driven and
    // the create succeeds
    expect(respD2.ok).toBe(true)
    if (!respD2.ok) throw new Error('G1 guard: expected the retry to succeed')
    expect(dataOf(respD2)['path']).toBe('cold-root')
    expect(wD.starts).toEqual([P6T2_ROOT, P6T2_ROOT])
    expect(wD.events).toEqual([
      `resolve:${WS_REQUESTED}`,
      `start:${P6T2_ROOT}:row`,
      `attach:${WS_ID}:${P6T2_ROOT}`,
      `resolve:${WS_REQUESTED}`,
      `start:${P6T2_ROOT}:row`,
      `attach:${WS_ID}:${P6T2_ROOT}`,
    ])
  })

  it('G1e: COLD v2 create asserting a DIFFERENT workspace — typed TEAM_CREATE_WORKSPACE_MISMATCH, zero writes', () => {
    expect(respE.ok).toBe(false)
    const error = errorOf(respE)
    expect(error['code']).toBe('TEAM_CREATE_WORKSPACE_MISMATCH')
    // the mismatch rejects BEFORE the start + the attach: zero writes
    expect(wE.starts).toEqual([])
    expect(wE.events).toEqual([`resolve:${WS_REQUESTED}`])
  })

  it('G1f: COLD v2 create asserting the SAME workspace — idempotent attach; the workspace-omitting retry asserts nothing', () => {
    expect(respF1.ok).toBe(true)
    if (!respF1.ok) throw new Error('G1 guard: expected success')
    expect(dataOf(respF1)['path']).toBe('cold-root')
    // the workspace-OMITTING cold retry: nothing is resolved, nothing is
    // attached (the durable workspace stands; the host default is NOT
    // asserted on a cold team)
    expect(respF2.ok).toBe(true)
    if (!respF2.ok) throw new Error('G1 guard: expected success')
    expect(dataOf(respF2)['path']).toBe('cold-root')
    // the full event log pins both attempts: F1 = resolve + start +
    // attach (the attach re-driven — upstream idempotency: the
    // same-root/workspace retry re-attaches without duplicating); F2
    // (workspace omitted) = ONLY the start
    expect(wF.events).toEqual([
      `resolve:${WS_COLD_PATH}`,
      `start:${P6T2_ROOT}:row`,
      `attach:${WS_COLD_ID}:${P6T2_ROOT}`,
      `start:${P6T2_ROOT}:row`,
    ])
    expect(wF.starts).toEqual([P6T2_ROOT, P6T2_ROOT])
  })

  it('G1g1: v2 admit fresh — the outcome record is the success data; the Root two-fact pair is durable; the seam was driven once', () => {
    expect(respG1.ok).toBe(true)
    if (!respG1.ok) throw new Error('G1 guard: expected success')
    const data = dataOf(respG1)
    expect(Object.keys(data).sort()).toEqual([
      'delivered',
      'mode',
      'payloadFingerprint',
      'requestToken',
      'rootSessionId',
      'sequence',
      'terminalSequence',
    ])
    expect(data['mode']).toBe('fresh')
    expect(data['delivered']).toBe(true)
    expect(data['rootSessionId']).toBe(P6T2_ROOT)
    expect(data['requestToken']).toBe(ADMIT_TOKEN)
    // the Root two-fact pair (NO member target): one admitted + one terminal
    expect(g1Counts).toEqual([1, 1])
    // the live Root input seam was driven exactly once, with the
    // request's content verbatim
    expect(wG.deliveries.length).toBe(1)
    expect(wG.deliveries[0]).toEqual({
      rootSessionId: P6T2_ROOT,
      requestToken: ADMIT_TOKEN,
      prompt: ADMIT_PROMPT,
      attachedContext: ADMIT_CONTEXT,
    })
  })

  it('G1g2: v2 admit REPLAY (same token + same payload) — mode replay, delivered false, zero new facts, zero new delivery', () => {
    expect(respG2.ok).toBe(true)
    if (!respG2.ok) throw new Error('G1 guard: expected success')
    const data = dataOf(respG2)
    expect(data['mode']).toBe('replay')
    expect(data['delivered']).toBe(false)
    expect(data['requestToken']).toBe(ADMIT_TOKEN)
    // the durable state is UNCHANGED (the replay writes nothing)
    expect(g2Counts).toEqual([1, 1])
    expect(wG.deliveries.length).toBe(1)
  })

  it('G1g3: v2 admit MISMATCH (same token + different payload) — typed TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH, zero writes', () => {
    expect(respG3.ok).toBe(false)
    const error = errorOf(respG3)
    expect(error['code']).toBe('TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH')
    // the resolution-phase rejection: zero durable writes, no delivery
    expect(g3Counts).toEqual([1, 1])
    expect(wG.deliveries.length).toBe(1)
  })

  it('G1g4: v2 admit FOREIGN TOKEN (the one initial-work slot is occupied) — typed TEAM_RUNTIME_INITIAL_WORK_ALREADY_ADMITTED pass-through', () => {
    expect(respG4.ok).toBe(false)
    const error = errorOf(respG4)
    expect(error['code']).toBe('TEAM_RUNTIME_INITIAL_WORK_ALREADY_ADMITTED')
    // the pass-through keeps the strategy's cause code + message
    const details = error['details'] as Record<string, unknown>
    const cause = details['cause'] as Record<string, unknown> | undefined
    expect(cause === undefined ? undefined : cause['code']).toBe('TEAM_RUNTIME_INITIAL_WORK_ALREADY_ADMITTED')
    // zero durable writes, no delivery
    expect(g4Counts).toEqual([1, 1])
    expect(wG.deliveries.length).toBe(1)
  })

  it('G1h: v1 team.create WITH initialWork — the SAME Root strategy (the Root two-fact pair, the content-hash v1 token, the frozen reply)', () => {
    expect(respH.ok).toBe(true)
    if (!respH.ok) throw new Error('G1 guard: expected success')
    const data = dataOf(respH)
    // the frozen v1 reply shape (byte-compatible)
    expect(Object.keys(data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(data['path']).toBe('fresh-root')
    // the SAME Root strategy as the v2 command: the Root two-fact pair
    expect(gHCounts).toEqual([1, 1])
    // the delivered work carries the v1 content-hash token (the stable
    // logical-operation identity) + the prompt verbatim
    expect(wH.deliveries.length).toBe(1)
    const delivery = wH.deliveries[0]
    expect(delivery?.prompt).toBe(V1_WORK_PROMPT)
    expect(delivery?.attachedContext).toBe(undefined)
    expect(
      delivery?.requestToken === undefined
        || delivery.requestToken.startsWith('team-create:initial-work:sha256:'),
    ).toBe(true)
  })
})
