/**
 * Alpha.5 P1-07 — the Team execution runner (policy → confined process).
 *
 * ONE entry point for a managed child process. The runner compiles the profile
 * (P1-07 `profile.ts`), asks the confined provider for the process, and NEVER
 * falls back to a bare `spawn`: when the profile cannot be expressed, or the
 * backend cannot enforce a dimension the profile relies on, the refusal is
 * typed and happens before any process exists. This is also where the native
 * `danger-full-access` early return is clamped: a managed call does not reach
 * the native spawn path at all, so "no ceiling" cannot be expressed by
 * forgetting to pass a policy.
 *
 * @module @dsh-agent-team/runtime/team-sandbox/runner
 */

import type {
  createConfinedProcessProvider,
  ProviderLease,
  RunOutput,
  SpawnReceipt,
  SpawnRequest,
} from '../../sandbox-provider/provider.js'
import type { ProviderResult } from '../../sandbox-provider/contract-stub.js'
import { compileExecutionProfile, type ProfilePolicy, type ProfileRefusal } from './profile.js'

/** The provider surface the runner consumes (the real lane's return type). */
export type ConfinedProcessProvider = ReturnType<typeof createConfinedProcessProvider>

/** One managed execution request: identity + argv + the policy to enforce. */
export interface TeamExecutionRequest {
  readonly policy: ProfilePolicy
  readonly realmId: string
  readonly bindingId: string
  readonly memberScope: string
  readonly grantFingerprint: string
  readonly argv: readonly string[]
  readonly cwd: string
  readonly env: readonly (readonly [string, string])[]
}

export const RUNNER_REFUSAL_CODES = ['PROFILE_REFUSED', 'ENFORCEMENT_UNAVAILABLE', 'EMPTY_ARGV'] as const

export type RunnerRefusalCode = (typeof RUNNER_REFUSAL_CODES)[number]

export interface RunnerRefusal {
  readonly ok: false
  readonly code: RunnerRefusalCode
  readonly detail: string
  readonly profile?: ProfileRefusal
}

/** The provider's one-shot outcome (receipt + bounded output + lease). */
export interface ConfinedSpawnOutcome {
  readonly receipt: SpawnReceipt
  readonly output: RunOutput
  readonly lease: ProviderLease
}

export interface TeamRunner {
  /** One-shot confined execution (returns the provider's receipt + output). */
  spawn(request: TeamExecutionRequest): Promise<ProviderResult<ConfinedSpawnOutcome> | RunnerRefusal>
  /** Obtain the request the provider would receive (for receipts/tests). */
  plan(request: TeamExecutionRequest): Promise<{ ok: true; request: SpawnRequest } | RunnerRefusal>
}

/**
 * Build the runner over a confined provider. `probe()` is consulted lazily per
 * spawn so a backend that loses enforcement is refused rather than assumed.
 */
export function createTeamConfinedRunner(provider: ConfinedProcessProvider): TeamRunner {
  async function plan(request: TeamExecutionRequest): Promise<{ ok: true; request: SpawnRequest } | RunnerRefusal> {
    if (request.argv.length === 0) {
      return Object.freeze({ ok: false, code: 'EMPTY_ARGV', detail: 'argv must be an explicit, non-empty array (never a shell string)' })
    }
    const profile = compileExecutionProfile(request.policy)
    if (!profile.ok) {
      return Object.freeze({ ok: false, code: 'PROFILE_REFUSED', detail: profile.detail, profile })
    }
    const probe = await provider.probe()
    if (!probe.ok) {
      return Object.freeze({ ok: false, code: 'ENFORCEMENT_UNAVAILABLE', detail: `backend probe refused: ${String((probe as { detail?: string }).detail ?? 'no capability rows')}` })
    }
    const levels = new Map(probe.value.map((row) => [row.dimension, row.level]))
    if (profile.value.readPaths.length > 0 && levels.get('content-read') !== 'enforced') {
      return Object.freeze({ ok: false, code: 'ENFORCEMENT_UNAVAILABLE', detail: 'read allowlist requested but the backend does not enforce content-read' })
    }
    if ((profile.value.writeOnlyPaths.length > 0 || profile.value.readWritePaths.length > 0) && levels.get('write') !== 'enforced') {
      return Object.freeze({ ok: false, code: 'ENFORCEMENT_UNAVAILABLE', detail: 'write rules requested but the backend does not enforce writes' })
    }
    if (profile.value.networkProfile === 'deny' && levels.get('network-destination') !== 'enforced') {
      return Object.freeze({ ok: false, code: 'ENFORCEMENT_UNAVAILABLE', detail: 'network deny requested but the backend does not enforce network isolation (no bare-process fallback)' })
    }
    return Object.freeze({
      ok: true,
      request: Object.freeze({
        grantFingerprint: request.grantFingerprint,
        realmId: request.realmId,
        bindingId: request.bindingId,
        memberScope: request.memberScope,
        argv: request.argv,
        cwd: request.cwd,
        env: request.env,
        allowPaths: profile.value.allowPaths,
        ...(profile.value.networkProfile === undefined ? {} : { networkProfile: profile.value.networkProfile }),
      }) as SpawnRequest,
    })
  }

  return Object.freeze({
    plan,
    async spawn(request: TeamExecutionRequest) {
      const planned = await plan(request)
      if (!planned.ok) return planned
      return provider.spawn(planned.request)
    },
  })
}
