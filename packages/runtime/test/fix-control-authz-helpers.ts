/**
 * fix-control-authz — shared fixtures for the Control authorization-boundary
 * regression suites (B: frozen review snapshot / C: terminal-abandonment
 * precedence + waiter liveness / D: restart-unique attempt identity /
 * H: recovery send-message subject consistency).
 *
 * These suites drive the REAL production chain: the live TeamRouter
 * (`createTeamRuntime`) wired with the REAL ControlService
 * (`createControlService` — the real subject / review-payload /
 * lossless-JSON validators, the real durable rows, the real wait bridge)
 * over a compat-BLOCKED P6-T2 world (the `skill/base` required
 * requirement down → the Team scope BLOCKED — every new-work and every
 * cross-agent trigger goes through the recovery dispatch offer). The ONLY
 * fakes are the injected effect seams (the work-delivery port — the
 * model-visible delivery boundary — and, where a suite needs it, the
 * session-input port): the router + control service under test are the
 * production objects, never lenient spies.
 *
 * @module @dsh-agent-team/runtime/test/fix-control-authz-helpers
 */

import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import type {
  TeamRuntime,
  TeamRuntimeActionRequest,
  WorkDeliveryPort,
  WorkDeliveryResult,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { destroyP6T1World, makeEnvironmentFacts } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  TEST_STATIC_MODEL,
  createFakeLifecycleCommitPort,
  createP6T2CompatBlockedWorld,
  createP6T2World,
  makeActionRequest,
} from './p6t2-helpers.js'
import type { P6T2SeedName } from './p6t2-helpers.js'

/** Re-exported for the authz suites (the P6-T2 request factory — the
 *  default caller is the Leader instance, a legal sender on every
 *  recovery-dispatch action of the fixture world). */
export { makeActionRequest } from './p6t2-helpers.js'

/** The team root of the authz worlds (the P6-T2 fixture root). */
export const AUTHZ_ROOT = P6T2_ROOT

/** The seeded worker instance (the work target / the message recipient). */
export const AUTHZ_WORKER = String(P6T2_SEEDS.worker.instanceId)

/** The human (team owner) caller — the legal resolver of user-approval
 *  requests and the legal abandoner of any request (invariant 34). */
export function authzHumanCaller(humanId = 'human-authz-owner') {
  return { kind: 'human' as const, humanId }
}

/** One recorded model-visible work delivery (the delivery-seam seam call). */
export interface AuthzDeliveryCall {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly requestToken: string
  readonly prompt: string
  readonly attachedContext: string | undefined
}

/** A work-delivery port that RECORDS every delivery (the prompt +
 *  attachedContext are captured — the B frozen-snapshot assertions read
 *  them; the zero-effect assertions count the calls). */
export function createRecordingDeliveryPort() {
  const calls: AuthzDeliveryCall[] = []
  const port: WorkDeliveryPort = {
    async deliver(args): Promise<WorkDeliveryResult> {
      calls.push({
        rootSessionId: args.rootSessionId,
        instanceId: args.instanceId,
        requestToken: args.requestToken,
        prompt: args.prompt,
        attachedContext: args.attachedContext,
      })
      return { requestToken: args.requestToken, status: 'succeeded', body: `delivered: ${args.prompt}` }
    },
  }
  return { port, calls }
}

/**
 * The REAL production chain over one compat-BLOCKED world: the live
 * TeamRuntime (full work-chain wiring — the lifecycle commit port, the
 * recording delivery port, the real activity writer) + the REAL
 * ControlService (fast 5 ms wait-bridge poll — the test cadence the
 * wait-bridge suites use) wired through the router's `controlServiceRef`.
 */
export interface AuthzWorld {
  readonly world: P6T1World
  readonly runtime: TeamRuntime
  readonly control: ControlService
  /** The shared recording delivery port (REUSABLE across a restart — the
   *  cross-process delivery count for the D suite). */
  readonly deliveryPort: WorkDeliveryPort
  /** The delivery-call ledger (the same array the port records into). */
  readonly deliveryCalls: AuthzDeliveryCall[]
}

export async function createAuthzWorld(
  basename: string,
  seedNames: readonly P6T2SeedName[] = ['leader', 'worker'],
  options: { readonly blueprintSource?: string } = {},
): Promise<AuthzWorld> {
  const world =
    options.blueprintSource !== undefined
      ? await createP6T2World(basename, seedNames, {
          blueprintSource: options.blueprintSource,
          environmentFacts: () =>
            Promise.resolve(
              makeEnvironmentFacts([
                { domain: 'skill', subject: 'base', available: false, generation: 2 },
              ]),
            ),
        })
      : await createP6T2CompatBlockedWorld(basename, seedNames)
  const delivery = createRecordingDeliveryPort()
  const control = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    waitPollIntervalMs: 5,
  })
  const runtime = createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(world),
    workDelivery: delivery.port,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    controlServiceRef: { current: control },
  })
  return { world, runtime, control, deliveryPort: delivery.port, deliveryCalls: delivery.calls }
}

export async function destroyAuthzWorld(authz: AuthzWorld): Promise<void> {
  await destroyP6T1World(authz.world)
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Bound a promise to a timeout (the RED-capture guard: a waiter that would
 * hang on the unfixed code FAILS the test in bounded time instead of
 * stalling the suite). Rejects with a typed timeout error.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`withTimeout: ${label} did not settle within ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Wait until the real control plane durably carries at least `n` requests
 * (bounded; test failure on timeout) and return the fresh state.
 */
export async function waitForControlRequests(
  control: ControlService,
  n: number,
  timeoutMs = 10_000,
): Promise<{ readonly requests: readonly ControlRequestRecord[] }> {
  const start = Date.now()
  for (;;) {
    const state = await control.listControlState(AUTHZ_ROOT)
    if (state.requests.length >= n) return { requests: state.requests }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `waitForControlRequests: at least ${n} durable control requests expected, have ${state.requests.length} (after ${timeoutMs}ms)`,
      )
    }
    await sleep(10)
  }
}

/** The durable ledger entries of the authz root (optional factType filter). */
export function authzFacts(world: P6T1World, factType?: string): LedgerEntry[] {
  return world.domain.repositories
    .ledger.list()
    .filter(
      (entry) =>
        String(entry.rootSessionId) === AUTHZ_ROOT &&
        (factType === undefined || entry.factType === factType),
    )
}

/** One follow-up work request to the seeded worker (the recovery-dispatch
 *  subject of the B/C/D suites). */
export function authzFollowUp(overrides: Partial<TeamRuntimeActionRequest> = {}) {
  return makeActionRequest({
    action: 'follow-up',
    targetInstanceId: AUTHZ_WORKER,
    ...overrides,
  })
}
