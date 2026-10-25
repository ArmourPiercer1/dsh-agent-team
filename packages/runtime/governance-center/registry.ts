/**
 * `governance-center/registry` — the GovernedFamilyRegistry (U6 PR1;
 * center-assembly-architecture §3 component 2; U6-SLICE-PLAN PR1:
 * "registration = sup-b `g1fb-registry.mjs` law (closed schema + collision +
 * generation checks; non-authorizing)").
 *
 * THE LAW, three clauses, each test-pinned:
 *
 *  1. CLOSED SCHEMA — a registration is a Family Contribution validated by
 *     `contribution-schema.ts` (§4/§10.3); a refusal changes NOTHING (not a
 *     candidate, not the generation).
 *  2. COLLISION — native names and aliases are claimed exclusively (§10.3:
 *     names, aliases, Scope, Provider, or a dynamic-source ID collision must
 *     be detected and isolated; the proven sup-b form: a foreign claim of a
 *     HELD name is refused and the registered owner is kept — the center
 *     never arbitrates by precedence-of-arrival beyond the held claim, and
 *     never silently double-binds).
 *  3. GENERATION — every accepted mutation bumps one generation counter;
 *     `view()` is a frozen snapshot carrying it, so a consumer can prove
 *     WHICH set it saw (condition 9: dynamic additions stay NOT_VERIFIED
 *     until re-validated — a dynamically added candidate is landed
 *     `not_verified` and revocation is first-class).
 *
 * NOT AN AUTHORIZER (§3: "合成已审 Family Contribution…非授权者"; §10.2
 * "Registry 只做候选注册和校验,不产生许可"): the public surface is exactly
 * `register / revoke / view / candidateFor / generation`. There is no method
 * that admits a call, mints or consumes a grant, or returns an allow — and a
 * test pins that closed surface so the Registry can never grow one by
 * accident. Authority, when it arrives, is decided ONLY in the Kernel.
 *
 * @module governance-center/registry
 */

import {
  validateFamilyContribution,
  type ContributionValidation,
  type FrozenContribution,
  type KernelCapabilityManifest,
} from './contribution-schema.js'

/** Which admission channel a registration arrived through (§10.3 dynamic law). */
export type RegistrationOrigin = 'reviewed-manifest' | 'dynamic-source'

/** Candidate state. A candidate is a CANDIDATE; execution is the Kernel's question. */
export type CandidateState = 'candidate' | 'not_verified' | 'tombstoned'

export type RegisteredCandidate = {
  readonly familyId: string
  readonly contribution: FrozenContribution
  readonly state: CandidateState
  readonly origin: RegistrationOrigin
  readonly registeredGeneration: number
}

export type RegistryView = {
  readonly generation: number
  readonly candidates: readonly RegisteredCandidate[]
}

export type RegistryRefusalCode =
  | 'INVALID_CONTRIBUTION'
  | 'DUP_FAMILY_ID'
  | 'NAME_COLLISION'
  | 'NOT_FOUND'
  | 'BAD_REASON'

export type RegistryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: RegistryRefusalCode; readonly detail: string; readonly schemaCode?: string }

export type GovernedFamilyRegistry = {
  /**
   * Validate + claim names for one contribution. Fail-closed: any refusal
   * leaves the registry byte-for-byte unchanged, generation included.
   */
  readonly register: (input: unknown, opts?: { readonly origin?: RegistrationOrigin }) => RegistryResult<{
    readonly familyId: string
    readonly state: CandidateState
    readonly generation: number
  }>
  /** Revoke a candidate (CI-08: dynamic revocation is first-class). */
  readonly revoke: (familyId: string, reason: string) => RegistryResult<{ readonly generation: number }>
  /** The frozen read-only view (§3: "read-only candidate view"). */
  readonly view: () => RegistryView
  /** The active candidate that claims this exact native name, if any. */
  readonly candidateFor: (nativeName: string) => RegisteredCandidate | undefined
  readonly generation: () => number
}

export function createGovernedFamilyRegistry(deps: {
  readonly kernelManifest: KernelCapabilityManifest
}): GovernedFamilyRegistry {
  const candidates: RegisteredCandidate[] = []
  let generation = 0

  const claimsOf = (candidate: RegisteredCandidate): readonly string[] => [
    ...candidate.contribution.visibility.nativeNames,
    ...candidate.contribution.visibility.aliases,
  ]

  const liveFor = (familyId: string): RegisteredCandidate | undefined =>
    candidates.find((c) => c.familyId === familyId && c.state !== 'tombstoned')

  const holderOf = (name: string): RegisteredCandidate | undefined =>
    candidates.find((c) => c.state !== 'tombstoned' && claimsOf(c).includes(name))

  function register(
    input: unknown,
    opts: { readonly origin?: RegistrationOrigin } = {},
  ): RegistryResult<{ readonly familyId: string; readonly state: CandidateState; readonly generation: number }> {
    const origin: RegistrationOrigin = opts.origin ?? 'reviewed-manifest'
    // (1) closed schema — the ONE validation face (§10.3).
    const validated: ContributionValidation = validateFamilyContribution(input, deps.kernelManifest)
    if (!validated.ok) {
      return { ok: false, code: 'INVALID_CONTRIBUTION', detail: `${validated.code} at ${validated.path}: ${validated.detail}`, schemaCode: validated.code }
    }
    const contribution = validated.contribution
    // (2a) duplicate id: an ACTIVE family with the same id is a refusal —
    // replacement goes through revoke first, never over a live claim.
    if (liveFor(contribution.familyId) !== undefined) {
      return { ok: false, code: 'DUP_FAMILY_ID', detail: `family '${contribution.familyId}' is already registered; revoke it before re-registering` }
    }
    // (2b) collision: any claimed name/alias already held by another live
    // family → refuse the FOREIGN claim, keep the owner (sup-b law). No
    // state change; the colliding candidate is not even landed.
    for (const name of [...contribution.visibility.nativeNames, ...contribution.visibility.aliases]) {
      const holder = holderOf(name)
      if (holder !== undefined && holder.familyId !== contribution.familyId) {
        return { ok: false, code: 'NAME_COLLISION', detail: `'${name}' is already claimed by family '${holder.familyId}' (generation ${String(holder.registeredGeneration)})` }
      }
    }
    // (3) land + bump. A DYNAMICALLY added candidate lands NOT_VERIFIED
    // (condition 9 / §10.3: dynamically added names stay NOT_VERIFIED until
    // re-validated; they are never "registered == approved" — CI-11).
    const state: CandidateState = origin === 'dynamic-source' ? 'not_verified' : 'candidate'
    generation += 1
    const landed: RegisteredCandidate = Object.freeze({
      familyId: contribution.familyId,
      contribution,
      state,
      origin,
      registeredGeneration: generation,
    })
    candidates.push(landed)
    return { ok: true, value: { familyId: contribution.familyId, state, generation } }
  }

  function revoke(familyId: string, reason: string): RegistryResult<{ readonly generation: number }> {
    if (typeof reason !== 'string' || reason.length === 0) {
      return { ok: false, code: 'BAD_REASON', detail: 'revoke requires a non-empty reason' }
    }
    const live = liveFor(familyId)
    if (live === undefined) {
      return { ok: false, code: 'NOT_FOUND', detail: `no live candidate '${familyId}' to revoke (${reason})` }
    }
    // Tombstone, never splice: the generation history stays auditable and a
    // later re-registration earns a NEW generation (CI-08: old handles must
    // not act on the new state).
    const index = candidates.indexOf(live)
    candidates[index] = Object.freeze({ ...live, state: 'tombstoned' as CandidateState })
    generation += 1
    return { ok: true, value: { generation } }
  }

  return {
    register,
    revoke,
    view() {
      // Frozen snapshot: the caller cannot grow, reorder or re-point it.
      return Object.freeze({ generation, candidates: Object.freeze([...candidates]) })
    },
    candidateFor(nativeName: string) {
      return holderOf(nativeName)
    },
    generation() {
      return generation
    },
  }
}
