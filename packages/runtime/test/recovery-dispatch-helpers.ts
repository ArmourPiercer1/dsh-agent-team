/**
 * pre-alpha3 PR-E (plan §E.9/§E.10) — shared fixtures for the E.11
 * recovery-dispatch suites (`recovery-leader-dispatch-review`,
 * `recovery-dispatch-deny-zero-effect`, `recovery-dispatch-abort-zero-effect`).
 *
 * The suites drive the LIVE router's recovery dispatch (the inline PR-D
 * Control coupling, plan §E.9): a NEW-WORK action blocked by the requirement
 * gate on a BLOCKED scope (a required requirement down) offers a
 * human-reviewed recovery Control request (user-approval kind, the complete
 * normalized review payload, the INLINE coupling, a NEW correlation per
 * attempt). The outcome:
 *   - `allow` → the caller re-runs the SAME action with the recovery marker
 *     (the recursive `performAction`), which the gate allows on the REDUCED
 *     original authority;
 *   - `deny`  → the typed zero-effect block stands (COMPATIBILITY_BLOCKED +
 *     `details.controlDecision: 'deny'` + `controlRequestId`);
 *   - abort   → best-effort `abandonControlRequest` (swallowed) + the typed
 *     zero-effect block (`details.controlDecision: 'abandoned'`).
 *
 * The spy control service implements ONLY the three methods the dispatch
 * touches (`requestControl`, `awaitControlDecision`, `abandonControlRequest`)
 * faithfully; the rest of the `ControlService` surface is a typed stub (the
 * router never calls them on this path).
 *
 * @module @dsh-agent-team/runtime/test/recovery-dispatch-helpers
 */

import { ControlError, CONTROL_ERROR_CODES } from '../control/index.js'
import type { ControlService } from '../control/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import type { TeamRuntime } from '../admission/index.js'
import {
  createP6T2CompatBlockedWorld,
  makeActionRequest,
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  TEST_STATIC_MODEL,
} from './p6t2-helpers.js'
import type { P6T2SeedName } from './p6t2-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

/** The closed set of the spy's decision behaviors. */
export type RecoveryDispatchBehavior = 'allow' | 'deny' | 'abort'

/** The call ledger of the spy control service (for zero-effect assertions). */
export interface SpyControlCalls {
  /** The number of `requestControl` calls (one per dispatch attempt). */
  requestControl: number
  /** The number of `awaitControlDecision` calls. */
  awaitControlDecision: number
  /** The number of `abandonControlRequest` calls (only on the abort path). */
  abandon: number
  /** The correlation of the LAST `requestControl` (the NEW-per-attempt identity). */
  lastCorrelation: string | undefined
  /** The subject of the LAST `requestControl` (the recovery dispatch subject). */
  lastSubject: unknown
  /** The kind of the LAST `requestControl` (must be user-approval). */
  lastKind: string | undefined
  /** The review payload digest of the LAST `requestControl` (present = the normalized payload was sent). */
  lastReviewPayloadDigest: string | undefined
}

/**
 * Build the spy control service.
 * @param behavior - the closed decision behavior (allow / deny / abort).
 */
export function makeSpyControlService(behavior: RecoveryDispatchBehavior): {
  readonly service: ControlService
  readonly calls: SpyControlCalls
} {
  const calls: SpyControlCalls = {
    requestControl: 0,
    awaitControlDecision: 0,
    abandon: 0,
    lastCorrelation: undefined,
    lastSubject: undefined,
    lastKind: undefined,
    lastReviewPayloadDigest: undefined,
  }
  let sequence = 0
  const service = {
    async requestControl(args: {
      readonly correlation?: string
      readonly subject?: unknown
      readonly kind?: string
      readonly reviewPayloadDigest?: string
    }) {
      calls.requestControl += 1
      sequence += 1
      calls.lastCorrelation = args.correlation
      calls.lastSubject = args.subject
      calls.lastKind = args.kind
      calls.lastReviewPayloadDigest = args.reviewPayloadDigest
      return { requestId: `cr-recovery-${sequence}`, rootSessionId: P6T2_ROOT } as never
    },
    async awaitControlDecision() {
      calls.awaitControlDecision += 1
      if (behavior === 'abort') {
        throw new ControlError(CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED, 'the recovery wait aborted')
      }
      return { decision: behavior } as never
    },
    async abandonControlRequest() {
      calls.abandon += 1
      return {} as never
    },
    // fix-control-authz C (disclosed masking adjustment): the
    // EFFECT-ADMISSION BOUNDARY — the fix-control-authz C-1 coverage
    // routes EVERY reviewed reentry effect (work AND coordination)
    // through this unit, so the spy must expose it. The spy holds NO
    // durable abandon mark (its `listControlState` is empty), so the
    // unit is transparent — it runs the caller's effect commit and
    // returns its result (the real service's no-mark path).
    async commitEffectIfAuthorized(input: {
      readonly commitEffect: () => Promise<unknown>
    }) {
      return input.commitEffect()
    },
    // Typed stubs — the router never calls these on the recovery-dispatch path.
    async resolveControl() {
      throw new Error('not implemented in the recovery-dispatch spy')
    },
    async listControlState() {
      return { requests: [], decisions: [], consumptions: [], abandonments: [] } as never
    },
    async guardOperation() {
      throw new Error('not implemented in the recovery-dispatch spy')
    },
    async checkExternalOperation() {
      throw new Error('not implemented in the recovery-dispatch spy')
    },
    // fix-control-authz C (the residual pre-reservation boundary): the
    // spy unit is a transparent pass-through (no preflight abort rows in
    // the recovery-dispatch family) — the lock-free close stub throws
    // loudly if a boundary ever fires against this spy (a wiring defect,
    // not a test expectation).
    async persistAbandonCloseLocked() {
      throw new Error('not implemented in the recovery-dispatch spy')
    },
  }
  return { service: service as unknown as ControlService, calls }
}

/**
 * Create the LIVE TeamRuntime over a compat-BLOCKED P6-T2 world (the
 * `skill/base` required requirement unavailable → the Team scope BLOCKED)
 * with the spy control service wired (the `controlServiceRef` the router's
 * recovery dispatch reads lazily).
 */
export function createRecoveryDispatchRuntime(
  world: P6T1World,
  controlService: ControlService,
): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    staticModel: TEST_STATIC_MODEL,
    now: () => P6T2_NOW,
    controlServiceRef: { current: controlService },
  })
}

/** A world with the required `skill/base` requirement down (Team scope BLOCKED). */
export async function createRecoveryDispatchWorld(
  basename: string,
  seedNames: readonly P6T2SeedName[] = ['leader', 'worker'],
): Promise<P6T1World> {
  return createP6T2CompatBlockedWorld(basename, seedNames)
}

/** The seeded worker instance id (the follow-up target of the recovery dispatch). */
export function recoveryWorkerInstanceId(): string {
  return String(P6T2_SEEDS.worker.instanceId)
}

/** The shared leader caller identity of the P6-T2 recovery-dispatch worlds. */
export function leaderCaller() {
  return makeActionRequest({}).caller
}
