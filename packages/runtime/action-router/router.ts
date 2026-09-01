/**
 * P6-T2 — the TeamRuntime: ONE unified authority facade for every
 * runtime/control action against EXISTING team members
 * (acceptance: "TeamRuntime 是控制动作统一 authority facade").
 *
 * Every later Team tool (P6-T6) and the UI Remote (P8) expresses its action
 * as a call through `performAction` — there is no second admission path.
 * Member CREATION is still exclusively the P6-T1 ActivationProvider's job
 * (invariant 26): this facade CALLS the provider for follow-up/delegate
 * creation and never bypasses or re-implements it.
 *
 * The documented enforcement order (each step before the next; a failure
 * throws the closed TeamRuntimeError code and has ZERO durable side
 * effects until the effect phase):
 *
 *   1. VALIDATE the request shape (closed action vocabulary, per-action
 *      required fields) — REQUEST_MALFORMED / ACTION_UNKNOWN;
 *   2. RESOLVE the target instance — instanceId-first
 *      `(rootSessionId, instanceId)` addressing ONLY (invariant 18); label/
 *      template tokens are REJECTED (invariant 19) — TEAM_SESSION_NOT_FOUND
 *      / TEAM_ROOT_BINDING_MISSING / BLUEPRINT_UNRESOLVED /
 *      BLUEPRINT_HASH_MISMATCH / ACTION_ADDRESSING_REJECTED /
 *      INSTANCE_NOT_FOUND;
 *   3. RESOLVE the caller identity + role from the durable TeamDomain
 *      (human / leader / member) — CALLER_NOT_FOUND / CALLER_ROLE_STALE;
 *   4. CALLER AUTHORITY + mutation envelope — the closed role set (members
 *      cannot create/delegate, invariant 37) then the envelope bounds (leader: team
 *      envelope; member: template envelope intersect team envelope,
 *      further narrowed by the instance overlay; human: not team-envelope-
 *      bounded, invariant 34) — CALLER_AUTHORITY_DENIED /
 *      ENVELOPE_OUT_OF_BOUNDS;
 *   5. COMPATIBILITY/ADMISSION gate for NEW WORK only (invariant 50) —
 *      COMPATIBILITY_BLOCKED;
 *   6. QUOTA — enforced solely inside the ActivationProvider for the
 *      creation/delegate effects (single source of truth; the provider
 *      serializes per team) — QUOTA_EXCEEDED_*;
 *   7. EFFECT — the durable writes under the per-team lock (fresh views;
 *      state first, evidence second — see action-router/effects.ts).
 */

import {
  checkCallerRoleAuthority,
  callerEnvelope,
  enforceCompatibilityGate,
  enforceEnvelope,
  isNewWorkAdmission,
  resolveCaller,
  resolveTeamAndTarget,
  validateActionRequest,
} from '../admission/index.js'
import type {
  TeamRuntime,
  TeamRuntimeActionOutcome,
  TeamRuntimeActionRequest,
  TeamRuntimeOptions,
} from '../admission/index.js'
import { executeEffect } from './effects.js'
import type { EffectContext } from './effects.js'

/**
 * Create the TeamRuntime over the injected ports.
 *
 * @param options - the TeamDomain (durable authority), the P6-T1
 *   ActivationProvider (the sole creation path), the blueprint catalog, the
 *   environment/external policy fact ports, and the deterministic clock.
 * @returns the facade (the per-team effect lock map is owned by the
 *   returned closure — one map per runtime instance).
 */
export function createTeamRuntime(options: TeamRuntimeOptions): TeamRuntime {
  const teamLocks = new Map<string, Promise<unknown>>()
  const repositories = options.teamDomain.repositories

  async function performAction(request: TeamRuntimeActionRequest): Promise<TeamRuntimeActionOutcome> {
    // Step 1 — validate the request shape (closed action vocabulary).
    const spec = validateActionRequest(request)

    // Step 2 — resolve team + target (instanceId-first addressing).
    const resolved = resolveTeamAndTarget(repositories, options.blueprintCatalog, request, spec)
    const rootSessionId = resolved.rootSessionId
    const blueprint = resolved.bound.blueprint

    // Step 3 — resolve the caller identity + role.
    const caller = resolveCaller(repositories, rootSessionId, request.caller)

    // Step 4 — role authority, then the mutation envelope.
    checkCallerRoleAuthority(spec, caller)
    const overrides = repositories.overrides.list(rootSessionId)
    const envelope = callerEnvelope(blueprint, caller, overrides)
    enforceEnvelope(spec, envelope)

    // Step 5 — compatibility gate for NEW WORK admissions only.
    // (P8-S4A: the gate consults the SINGLE compatibility authority and is
    // async — a missing/stale durable generation is re-probed inline.)
    if (isNewWorkAdmission(spec)) {
      const environmentFacts = await options.environmentFacts()
      await enforceCompatibilityGate(repositories, blueprint, rootSessionId, environmentFacts, options.now)
    }

    // Step 6/7 — the effect phase (quota inside the provider for creation;
    // durable writes under the per-team lock).
    const ctx: EffectContext = {
      repositories,
      activationProvider: options.activationProvider,
      externalPolicyFacts: options.externalPolicyFacts,
      now: options.now,
      spec,
      request,
      rootSessionId,
      caller,
      blueprint,
      lifecycleCommit: options.lifecycleCommit,
      workDelivery: options.workDelivery,
      workActivity: options.workActivity,
      lifecyclePorts: options.lifecyclePorts,
      ...(resolved.target !== undefined ? { target: resolved.target } : {}),
    }
    const effect = await executeEffect(teamLocks, ctx)

    return {
      status: 'executed',
      action: spec.name,
      rootSessionId,
      callerRole: caller.role,
      ...(resolved.target !== undefined
        ? { targetInstanceId: resolved.target.instanceId }
        : {}),
      effect,
      requestToken: request.requestToken,
    }
  }

  return { performAction }
}
