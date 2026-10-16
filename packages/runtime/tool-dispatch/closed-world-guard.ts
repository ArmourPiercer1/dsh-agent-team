/**
 * Alpha.5 PR1 (plan §4, design §4.1) — the CLOSED-WORLD MONOTONIC GUARD.
 *
 * THE PROBLEM THIS CLOSES (design §0 权威表 "Coverage" row, PoC H6):
 * a Setup Coverage Gate sees the surface ONCE, at assembly time. A tool that
 * appears AFTER setup — an own-layer `tools.register` of an undeclared name,
 * a late MCP registration, a hot re-registration by any same-scope plugin —
 * was never seen by it, and on the PoC host such a tool's body RAN
 * (`hc-dyn-observation.dynRan = true`). A coverage check can never be the
 * safety gate; only a decision made AT DISPATCH TIME, on every call, for as
 * long as the Agent lives, can be.
 *
 * THE LAW THIS MODULE ENFORCES (design §1 invariant 1, "完整分发治理"):
 *
 *     T_dispatchable(agent)  ⊆  T_governed(agent)
 *
 * expressed as a closed world: a name is executable for this Team Agent ONLY
 * if a trusted Binding was installed for it by the Team assembly. Everything
 * else is refused with a typed §5 error — never "unmanaged ⇒ abstain":
 *
 *   - unknown `exec.name` (no Binding, ever)      → `TEAM_TOOL_UNGOVERNED`
 *   - a Binding whose identity/revision cannot be
 *     verified at call time                        → `TOOL_BINDING_UNVERIFIED`
 *   - a foreign Agent identity on the exec          → `TOOL_BINDING_UNVERIFIED`
 *   - anything while the Dispatcher is not ACTIVE   → `ADAPTER_DRAINING`
 *     (DRAINING / TOMBSTONED / RELEASED keep refusing: the mask and the
 *      Guard outlive the in-flight work, never the other way round)
 *
 * MONOTONIC in two directions, both pinned by `a5p1-closed-world-guard`:
 *   1. the Guard can only ever refuse or abstain — it has NO allow result
 *      (same law as the alpha.2 end-cap guard it composes with, plan §4
 *      "PTC 内层重复 Admission"); a `tools/change` event, a pre-execute
 *      listener, or a re-registration can never turn a refusal back into
 *      permission;
 *   2. the governed set only grows through {@link GovernedSurface.bind},
 *      which the trusted assembly calls; a Binding is never removed and
 *      never mutated — a policy/binding CHANGE installs an immutable new
 *      REVISION (design §4.1 ACTIVE row), so `tools/change` revalidation and
 *      `tools.restrict` remain diagnostics/re-routing, never the enforcement.
 *
 * AGENTLESS (NEG-2, design §4.1): an execution that carries NO Agent
 * identity at all is a Host-lane execution, not a Team Agent execution. The
 * Guard is installed on ONE Team Agent's scope, so such an exec can only be
 * a foreign/global dispatch that reached this scope's seam: the identity is
 * unverifiable, which is a typed `TOOL_BINDING_UNVERIFIED` — while a call
 * that carries THIS Agent's identity verifies normally. Ordinary Host
 * Sessions get ZERO of this: the install is agent-scoped and non-Team
 * Agents never have one (pinned by the real-Host control-session criterion).
 *
 * Purity: no `node:*`, no I/O, no DSH import, no clock. It reuses the PR0
 * frozen vocabulary (`GovernanceError`/`GovernanceResult`, the §5 codes) and
 * the PR0 binding record — REUSE, not a second algebra.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/closed-world-guard
 */

import {
  ASSURANCE_DIMENSIONS,
  GOVERNANCE_ERROR_CODES,
  type AssuranceContract,
  type AssuranceLevel,
  type ExecutionBoundary,
  type GovernanceError,
  type GovernanceResult,
  type ImplementationOrigin,
  type ToolBinding,
} from '../../domain/tool-governance/src/index.js'

/**
 * The honest assurance record of a Binding whose I/O enforcement PR1 does NOT
 * claim: every dimension is `untested` (design §2.1 — Assurance is a record
 * of what was PROVEN, and PR1 proves dispatch governance only; PR3/PR4 fill
 * these rows). An empty or omitted record is not available: PR0's parser
 * refuses a missing dimension precisely so this claim cannot drift silent.
 */
export function untestedAssurance(
  implementationOrigin: ImplementationOrigin,
  executionBoundary: ExecutionBoundary,
): AssuranceContract {
  const levels = {} as Record<(typeof ASSURANCE_DIMENSIONS)[number], AssuranceLevel>
  for (const dimension of ASSURANCE_DIMENSIONS) levels[dimension] = 'untested'
  return Object.freeze({ implementationOrigin, executionBoundary, assurance: Object.freeze(levels) })
}

/** Which trusted assembly step established one governed name (design §3 table). */
export const GOVERNED_ORIGINS = ['inherited-native', 'team-own', 'team-mcp'] as const

/** One governed origin. */
export type GovernedOrigin = (typeof GOVERNED_ORIGINS)[number]

/**
 * One governed entry: the trusted Binding the Team assembly installed for one
 * executable name, plus the origin fact the Coverage Gate used to classify.
 * Immutable: a change is a new REVISION under the same `name`, never an edit.
 */
export interface GovernedEntry {
  readonly name: string
  readonly origin: GovernedOrigin
  readonly binding: ToolBinding
  /**
   * FALSE when the assembly could not establish the Binding identity (an
   * unverifiable provider, a Definition whose identity could not be read).
   * A FALSE entry keeps the name governed — so the Coverage diff still
   * reports it — but every call is refused `TOOL_BINDING_UNVERIFIED`: an
   * unverified Binding is never an implied allow.
   */
  readonly verified: boolean
  /** The revision currently in force for this name (immutable, ≥ 1). */
  readonly revision: number
}

/** Why one call was refused, in Guard terms (mapped onto the §5 codes). */
export const GUARD_DENIAL_REASONS = {
  UNGOVERNED: 'ungoverned-name',
  BINDING_UNVERIFIED: 'binding-unverified',
  IDENTITY_FOREIGN: 'agent-identity-foreign',
  IDENTITY_ABSENT: 'agent-identity-absent',
  NOT_ACTIVE: 'dispatcher-not-active',
  REVISION_DRIFT: 'binding-revision-drift',
} as const

export type GuardDenialReason = (typeof GUARD_DENIAL_REASONS)[keyof typeof GUARD_DENIAL_REASONS]

/** The stable, model-visible reason text of each §5 code (never a stack). */
export function guardDenialMessage(name: string, reason: GuardDenialReason): string {
  switch (reason) {
    case GUARD_DENIAL_REASONS.UNGOVERNED:
      return `team tool guard: "${name}" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes; declare it or bind it)`
    case GUARD_DENIAL_REASONS.BINDING_UNVERIFIED:
      return `team tool guard: the Tool Binding for "${name}" cannot be verified at dispatch time (no fallback to the native body)`
    case GUARD_DENIAL_REASONS.IDENTITY_FOREIGN:
      return `team tool guard: "${name}" was dispatched under an Agent identity other than the one this Binding is scoped to (Team identity is not transferable)`
    case GUARD_DENIAL_REASONS.IDENTITY_ABSENT:
      return `team tool guard: "${name}" reached a Team Agent scope without any Agent identity (a Team-origin nested dispatch must carry its trusted Agent; refusing)`
    case GUARD_DENIAL_REASONS.NOT_ACTIVE:
      return `team tool guard: "${name}" is refused because this Agent's Tool Dispatcher is not ACTIVE (assembly-in-progress, draining or tombstoned: new calls are refused; the mask stays)`
    case GUARD_DENIAL_REASONS.REVISION_DRIFT:
      return `team tool guard: the Tool Binding for "${name}" changed generation after this Dispatcher validated it (stale binding: re-assembly required)`
  }
}

/** One guard verdict. `allow` is deliberately NOT expressible. */
export type GuardVerdict =
  | { readonly kind: 'abstain'; readonly reason: 'governed-and-verified' | 'not-a-team-agent-scope' }
  | { readonly kind: 'deny'; readonly error: GovernanceError; readonly reason: GuardDenialReason }

/** What the Guard sees of one execution (structural; host-neutral). */
export interface GuardExecView {
  readonly name: string
  /** The exec's Agent identity when the host exposes one (`exec.agent`). */
  readonly agentIdentity?: string
}

/** The identity the Guard was assembled for. */
export interface GuardScopeIdentity {
  readonly agentScopeKey: string
  /**
   * The identities that count as THIS Agent (the host may surface the Agent
   * id, the session id, or both across generations; every one of them is the
   * same trusted identity, and NOTHING else verifies).
   */
  readonly trustedIdentities: readonly string[]
}

/**
 * The closed world of one Team Agent: the governed names and their trusted
 * Bindings. Grows only through {@link bind}; never shrinks; never edits in
 * place. Held by the assembly (module-closure state, like the rest of the
 * live glue) — there is no module-level instance here.
 */
export interface GovernedSurface {
  readonly names: () => readonly string[]
  readonly entryOf: (name: string) => GovernedEntry | undefined
  /**
   * Install (or REVISE) the Binding for one name. A revision must keep the
   * same `bindingId` family for the same name and strictly increase;
   * re-binding a name with a different `bindingId` is a different Tool
   * identity and is refused (that is the "先卸 Definition 再任其回落" shape
   * design §4.1 forbids at ACTIVE).
   */
  readonly bind: (input: {
    readonly name: string
    readonly origin: GovernedOrigin
    readonly binding: ToolBinding
    readonly verified: boolean
  }) => GovernanceResult<GovernedEntry>
  /** Mark an already-bound name un-verifiable (a failed revalidation). */
  readonly markUnverified: (name: string, bindingId: string) => GovernanceResult<GovernedEntry>
  /**
   * Bind the whole inherited surface observed at setup (the Coverage Gate's
   * FINAL surface names): every one of them becomes governed with an
   * `inherited-native` Binding so the closed world has a defined verdict for
   * it. Names the Team did not review are bound UNVERIFIED — visible to the
   * Coverage diff, refused at dispatch, and loud (never silently allowed).
   */
  readonly bindInheritedSurface: (names: readonly string[]) => number
  readonly snapshot: () => readonly GovernedEntry[]
}

/** Options of {@link createGovernedSurface}. */
export interface GovernedSurfaceOptions {
  /** The Agent/Scope key the Bindings are scoped to (PR0 `agentScopeKey`). */
  readonly agentScopeKey: string
  /** The provider id stamped on inherited native bindings (the pinned host). */
  readonly nativeProviderId?: string
  /** The policy generation the assembly validated against. */
  readonly policyGeneration?: number
  readonly authorityGeneration?: number
}

const NATIVE_PROVIDER = 'dsh-native-host'

/** Create one Agent's closed world (per-agent closure, zero module state). */
export function createGovernedSurface(options: GovernedSurfaceOptions): GovernedSurface {
  const entries = new Map<string, GovernedEntry>()
  const providerId = options.nativeProviderId ?? NATIVE_PROVIDER
  const agentScopeKey = options.agentScopeKey
  const policyGeneration = options.policyGeneration ?? 0
  const authorityGeneration = options.authorityGeneration ?? 0

  const bind: GovernedSurface['bind'] = ({ name, origin, binding, verified }) => {
    const previous = entries.get(name)
    if (previous !== undefined) {
      // A stable ToolDefinition identity: the same name keeps the same
      // bindingId family and a strictly higher revision (design §4.1).
      if (previous.binding.bindingId !== binding.bindingId) {
        return {
          ok: false,
          error: {
            code: 'TOOL_BINDING_UNVERIFIED',
            message: `re-binding "${name}" would replace Binding ${previous.binding.bindingId} with ${binding.bindingId}: at ACTIVE a name keeps ONE stable Definition identity and flips immutable revisions`,
          },
        }
      }
      if (binding.revision <= previous.revision) {
        return {
          ok: false,
          error: {
            code: 'TOOL_BINDING_UNVERIFIED',
            message: `re-binding "${name}" must carry a strictly higher revision (${previous.revision} in force, got ${binding.revision})`,
          },
        }
      }
    }
    const entry: GovernedEntry = Object.freeze({
      name,
      origin,
      binding: Object.freeze({ ...binding }),
      verified,
      revision: binding.revision,
    })
    entries.set(name, entry)
    return { ok: true, value: entry }
  }

  return {
    names: () => [...entries.keys()].sort(),
    entryOf: (name) => entries.get(name),
    bind,
    markUnverified: (name, bindingId) => {
      const current = entries.get(name)
      if (current === undefined) {
        return {
          ok: false,
          error: { code: 'TEAM_TOOL_UNGOVERNED', message: `markUnverified("${name}"): the name is not governed` },
        }
      }
      if (current.binding.bindingId !== bindingId) {
        return {
          ok: false,
          error: {
            code: 'TOOL_BINDING_UNVERIFIED',
            message: `markUnverified("${name}"): bindingId drift (${current.binding.bindingId} in force, asked for ${bindingId})`,
          },
        }
      }
      const entry: GovernedEntry = Object.freeze({ ...current, verified: false })
      entries.set(name, entry)
      return { ok: true, value: entry }
    },
    bindInheritedSurface: (names) => {
      let bound = 0
      for (const name of names) {
        if (entries.has(name)) continue
        const binding: ToolBinding = {
          bindingId: `native:${name}`,
          agentScopeKey,
          toolName: name,
          definitionIdentity: `native:${name}`,
          providerId,
          implementationOrigin: 'dsh-native',
          executionBoundary: 'trusted-host',
          assurance: untestedAssurance('dsh-native', 'trusted-host'),
          policyGeneration,
          authorityGeneration,
          revision: 1,
          status: 'ACTIVE',
        }
        const outcome = bind({ name, origin: 'inherited-native', binding, verified: true })
        if (outcome.ok) bound += 1
      }
      return bound
    },
    snapshot: () => [...entries.values()],
  }
}

/** The inputs of one Guard decision (the Dispatcher supplies them). */
export interface GuardDecisionInput {
  readonly exec: GuardExecView
  readonly scope: GuardScopeIdentity
  readonly surface: GovernedSurface
  /** Whether the Dispatcher is ACTIVE right now (checked again per call). */
  readonly active: boolean
  /**
   * The generations the assembly validated against. A Binding from another
   * generation is stale — the call must not run on it (design §4.3: no
   * retry, no fallback).
   */
  readonly policyGeneration: number
  readonly authorityGeneration: number
}

/**
 * The per-call decision. PURE and total: it never throws, never allows, and
 * re-reads the surface and the state at the moment of the call (an assembly
 * that bound a name at setup and then changed it cannot be raced).
 */
export function guardDecision(input: GuardDecisionInput): GuardVerdict {
  const { exec, scope, surface } = input
  const deny = (code: GovernanceError['code'], reason: GuardDenialReason): GuardVerdict => ({
    kind: 'deny',
    reason,
    error: { code, message: guardDenialMessage(exec.name, reason) },
  })

  // STATE FIRST (NEG-1 family): before the mask, before any Binding lookup,
  // a Dispatcher that is not ACTIVE refuses everything on this scope.
  if (!input.active) return deny('ADAPTER_DRAINING', GUARD_DENIAL_REASONS.NOT_ACTIVE)

  const identity = typeof exec.agentIdentity === 'string' && exec.agentIdentity.length > 0 ? exec.agentIdentity : null
  if (identity === null) {
    // NEG-2: a Team-origin dispatch that lost its Agent identity must not be
    // laundered into the global native lane.
    return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.IDENTITY_ABSENT)
  }
  if (!scope.trustedIdentities.includes(identity)) {
    return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.IDENTITY_FOREIGN)
  }

  const entry = surface.entryOf(exec.name)
  if (entry === undefined) return deny('TEAM_TOOL_UNGOVERNED', GUARD_DENIAL_REASONS.UNGOVERNED)
  if (!entry.verified) return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.BINDING_UNVERIFIED)
  if (
    entry.binding.policyGeneration !== input.policyGeneration ||
    entry.binding.authorityGeneration !== input.authorityGeneration
  ) {
    return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.REVISION_DRIFT)
  }
  if (entry.revision !== entry.binding.revision) {
    return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.REVISION_DRIFT)
  }
  return { kind: 'abstain', reason: 'governed-and-verified' }
}

/** The §5 codes this Guard is allowed to surface (pinned by test). */
export const GUARD_ERROR_CODES = Object.freeze(
  GOVERNANCE_ERROR_CODES.filter((c) => c === 'TEAM_TOOL_UNGOVERNED' || c === 'TOOL_BINDING_UNVERIFIED' || c === 'ADAPTER_DRAINING'),
)
