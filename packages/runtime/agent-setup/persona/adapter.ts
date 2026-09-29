/**
 * The persona preset adapter — the P5-T2 deliverable (TaskDoc §11.5 P5-T2
 * "输出物：persona adapter"; DevPlan §18.2/§18.3; Architecture §13).
 *
 * ONE component carries the complete P5-T2 persona semantics, and
 * {@link createPersonaOverlaySlot} exposes it as the T1 persona OVERLAY
 * SLOT (the binder installs it; it never implements its semantics):
 *
 * 1. SUBSTRATE RESOLUTION (DevPlan §18.2, Architecture §13.1) — the target
 *    agent's AgentPreset substrate, through the narrow public seam. A
 *    MEMBER resolves the ROOT's substrate: the seam is keyed by the root
 *    session id only, so "Member 默认继承 Root AgentPreset substrate" is
 *    structural (no per-member selector exists to express, DevPlan
 *    §18.2).
 * 2. COMPLETE-TRUE DETECTION (DevPlan §18.3, Architecture §13.5) — via
 *    the P3-T5 compatibility engine (the allowed dependency, read-only):
 *    the adapter states the Team persona-composition requirement (type
 *    `persona`, structural `complete: true`) and the public environment
 *    fact (the preset's effective persona is composable or complete), and
 *    the ENGINE classifies. A FATAL outcome carrying the frozen contracts
 *    v1 code `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` becomes
 *    {@link TeamPersonaOverlayError} — thrown from the slot's `apply`,
 *    i.e. BEFORE the binder's admission decision, so Team work never
 *    starts (the binder's fail-closed wrap: no later slot, no surface
 *    effect, no event, no bound registration).
 * 3. SCOPED IDENTITY (DevPlan §18.3, Architecture §13.3/§13.4) — for the
 *    compatible (standard) preset: the Team Blueprint persona text
 *    (LeaderTemplate for root, MemberTemplate for member — the Blueprint
 *    owns the text) composed with the preset substrate identity (the
 *    preset owns the assembly semantics) into one
 *    {@link ScopedPersonaIdentity}.
 * 4. RUNTIME-CONTEXT INSTALLATION (DevPlan §18.1 "Team prompt/policy
 *    surface", Architecture §40.4) — the scoped identity is installed
 *    onto the public scoped-prompt surface: the runtime context of the
 *    Team prompt/policy surface (the scoped section shadow). Installation
 *    is the ONLY effect the adapter performs on the agent side — the
 *    preset's own upstream assembly semantics are preserved by
 *    construction (the closed seams expose no mutation).
 *
 * Decision table (the P5-T2 must-test groups; pre-alpha3 PR-E §E.3 adds
 * the honest bare-world FATAL lane — the persona KIND convention, the
 * requirement subject is the required KIND `standard`, the world fact
 * subject the OBSERVED kind):
 *
 * | observed persona kind | engine outcome / code                    | adapter effect                                   |
 * | --------------------- | ---------------------------------------- | ------------------------------------------------ |
 * | absent                | (not probed)                             | no scoped identity, no error — bind proceeds     |
 * | standard              | PASS                                     | scoped identity installed on the prompt surface  |
 * | complete              | FATAL / TEAM_PERSONA_COMPLETE_PRESET_... | TeamPersonaOverlayError — FATAL before work      |
 * | (no persona fact)     | FATAL / PERSONA_INCOMPATIBLE             | TeamPersonaOverlayError — honest bare-world FATAL|
 *
 * The adapter holds NO bind state (pure over its injected seams per call),
 * so repeated installs converge to the same scoped identity (idempotent in
 * the T1 slot contract's sense; the binder enforces once-per-session).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/persona/adapter
 */

import { deepFreeze } from '../../../contracts/src/index.js'
import { COMPATIBILITY_REASON_CODES, evaluateCompatibility } from '../../../domain/compatibility/src/index.js'
import type { CompatibilityResult, EnvironmentFact, RequirementInput } from '../../../domain/compatibility/src/index.js'
import type { OverlaySlot, TeamAgentStepContext } from '../binder/index.js'
import type { AgentPresetSubstrateFacts } from '../preset/index.js'
import { REQUIRED_PERSONA_KINDS } from '../../requirements/observed-persona.js'
import { TeamPersonaOverlayError } from './errors.js'
import type {
  CompatibilityEvaluator,
  PersonaOverlaySlotOptions,
  ScopedPersonaIdentity,
} from './types.js'

/** The stable id of the Team persona-composition requirement. */
export const PERSONA_REQUIREMENT_ID = 'team-persona-composition'

/**
 * The deterministic mock-first probe generation (the real seam reports the
 * actual probe generation when it binds in T5/T6).
 */
export const PERSONA_PROBE_GENERATION = 1

/**
 * The Team persona-composition requirement (Architecture §27.1 `persona`
 * domain, §13.5): structural (`complete: true`) — if the preset's
 * effective persona cannot compose the Team identity, the outcome is a
 * mandatory FATAL with no downgrade and no Continue Anyway.
 *
 * pre-alpha3 PR-E (plan §E.3) — the persona KIND convention: the
 * requirement's subject is the REQUIRED persona KIND (the team constant —
 * ONLY `standard` this increment; the closed `RequiredPersonaKind` set),
 * NOT the preset id. The world fact's subject is the OBSERVED kind; the
 * engine probes kind-against-kind (a bare world reports the honest
 * PERSONA_INCOMPATIBLE, a complete world the §13.5 CONFLICT — the engine
 * re-keying). No substrate argument: the required kind is a Team constant
 * (the requirement does not vary with the mounted preset).
 */
export function personaRequirement(): RequirementInput {
  return {
    requirementId: PERSONA_REQUIREMENT_ID,
    type: 'persona',
    subjects: [REQUIRED_PERSONA_KINDS.standard],
    complete: true,
  }
}

/**
 * The public environment fact for the persona probe: the OBSERVED persona
 * KIND of the actually-mounted preset (the world fact — subject = kind).
 *
 * pre-alpha3 PR-E (plan §E.3) — the persona KIND convention: the subject
 * is the observed KIND (not the preset id). `standard` (the composable
 * case) is available; `complete` (the §13.5 conflict — the complete
 * section restores itself as the sole system prompt after the assemble
 * waterfall, so the scoped shadow cannot hold) is not; the engine keys
 * the CONFLICT vs INCOMPATIBLE code on whether the world PROVIDES a
 * `complete` fact.
 */
export function personaEnvironmentFacts(substrate: AgentPresetSubstrateFacts): readonly EnvironmentFact[] {
  return [
    {
      domain: 'persona',
      subject: substrate.personaKind,
      available: substrate.personaKind === 'standard',
      generation: PERSONA_PROBE_GENERATION,
      detail:
        substrate.personaKind === 'complete'
          ? 'the mounted preset observes a complete persona section (structural conflict with the required standard kind)'
          : 'the mounted preset observes the composable standard persona kind',
    },
  ]
}

/** Structural guard: one object with a single-arg function member. */
function hasFunction(value: unknown, key: string): boolean {
  return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'function'
}

/**
 * The persona preset adapter (see the module docs for the full semantics).
 *
 * Construction is fail-fast (a malformed dependency throws a `TypeError`
 * — a programming error, mirroring the binder constructor discipline).
 */
export class TeamPersonaPresetAdapter {
  private readonly presetSeam: PersonaOverlaySlotOptions['presetSeam']
  private readonly personaSource: PersonaOverlaySlotOptions['personaSource']
  private readonly promptSurface: PersonaOverlaySlotOptions['promptSurface']
  private readonly evaluate: CompatibilityEvaluator

  constructor(options: PersonaOverlaySlotOptions) {
    if (options === null || typeof options !== 'object') {
      throw new TypeError('PersonaOverlaySlotOptions must be an object')
    }
    if (!hasFunction(options.presetSeam, 'getSubstrate')) {
      throw new TypeError('PersonaOverlaySlotOptions.presetSeam must implement AgentPresetSeam (getSubstrate)')
    }
    if (!hasFunction(options.personaSource, 'getLeaderPersona') || !hasFunction(options.personaSource, 'getMemberPersona')) {
      throw new TypeError(
        'PersonaOverlaySlotOptions.personaSource must implement TeamBlueprintPersonaSource (getLeaderPersona / getMemberPersona)',
      )
    }
    if (!hasFunction(options.promptSurface, 'installScopedPersona')) {
      throw new TypeError(
        'PersonaOverlaySlotOptions.promptSurface must implement ScopedPersonaPromptSurface (installScopedPersona)',
      )
    }
    if (
      options.evaluateCompatibility !== undefined &&
      typeof options.evaluateCompatibility !== 'function'
    ) {
      throw new TypeError('PersonaOverlaySlotOptions.evaluateCompatibility must be a function (the compatibility evaluator)')
    }
    this.presetSeam = options.presetSeam
    this.personaSource = options.personaSource
    this.promptSurface = options.promptSurface
    this.evaluate = options.evaluateCompatibility ?? evaluateCompatibility
  }

  /**
   * The preset substrate of the step's target. A MEMBER resolves the ROOT's
   * substrate (Architecture §13.1: inheritance by default; no per-member
   * selector) — the seam is queried with the root session id in BOTH cases.
   */
  resolveSubstrate(context: TeamAgentStepContext): AgentPresetSubstrateFacts {
    return this.presetSeam.getSubstrate(context.target.rootSessionId)
  }

  /**
   * The compatibility evaluation of the target's persona requirement
   * (the P3-T5 engine classifies; the adapter only states the public fact).
   */
  evaluatePersonaCompatibility(substrate: AgentPresetSubstrateFacts): CompatibilityResult {
    return this.evaluate({
      requirements: [personaRequirement()],
      environmentFacts: [...personaEnvironmentFacts(substrate)],
    })
  }

  /**
   * The scoped identity of the step's target (blueprint persona text +
   * substrate identity; DevPlan §18.3).
   */
  buildScopedIdentity(context: TeamAgentStepContext, substrate: AgentPresetSubstrateFacts): ScopedPersonaIdentity {
    const target = context.target
    let personaText: string
    if (target.kind === 'member') {
      const record = context.record
      if (!('templateId' in record)) {
        throw new TypeError(
          'member step context must carry the MemberInstance durable record (templateId)',
        )
      }
      personaText = this.personaSource.getMemberPersona(target.rootSessionId, record.templateId)
    } else {
      personaText = this.personaSource.getLeaderPersona(target.rootSessionId)
    }
    return deepFreeze({
      kind: target.kind,
      rootSessionId: target.rootSessionId,
      ...(target.instanceId !== undefined ? { instanceId: target.instanceId } : {}),
      presetId: substrate.presetId,
      personaOrigin: 'blueprint' as const,
      personaText,
    })
  }

  /**
   * The complete persona step (the slot's `apply` body):
   *
   * 1. resolve the substrate (member → root inheritance);
   * 2. `absent` — no persona: NO scoped identity, NO error (nothing to
   *    compose, nothing to conflict — the bind proceeds with the preset's
   *    plain upstream assembly semantics);
   * 3. otherwise evaluate through the compatibility engine:
   *    - FATAL (the frozen conflict code) — throw BEFORE any install
   *      effect and before the binder's admission decision
   *      ({@link TeamPersonaOverlayError});
   *    - PASS (the compatible standard preset) — build the scoped identity
   *      and install the runtime context on the scoped-prompt surface.
   */
  apply(context: TeamAgentStepContext): void {
    const substrate = this.resolveSubstrate(context)
    if (substrate.personaKind === 'absent') return

    const result = this.evaluatePersonaCompatibility(substrate)
    const entry = result.requirements[0]
    if (entry === undefined) {
      throw new TypeError(
        `compatibility result carries no requirement outcome for '${PERSONA_REQUIREMENT_ID}' (engine contract violation)`,
      )
    }
    if (entry.outcome !== 'PASS') {
      // Engine contract (pre-alpha3 PR-E, plan §E.3): a non-PASS outcome
      // of the `complete: true` persona requirement is a FATAL carrying
      // ONE of the two honest codes — the frozen §13.5 CONFLICT (the world
      // PROVIDES a `complete` persona fact) or PERSONA_INCOMPATIBLE (the
      // world provides no composable persona — the bare-world lane).
      // complete dominates the type-specific codes (P3-T5 engine).
      if (
        entry.reasonCode !== COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT &&
        entry.reasonCode !== COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE
      ) {
        throw new TypeError(
          `unexpected compatibility outcome '${entry.outcome}' / reason '${entry.reasonCode}' for '${PERSONA_REQUIREMENT_ID}' (engine contract violation)`,
        )
      }
      throw new TeamPersonaOverlayError({
        rootSessionId: context.target.rootSessionId,
        presetId: substrate.presetId,
        path: context.path,
        detail: entry.detail,
      })
    }
    const identity = this.buildScopedIdentity(context, substrate)
    this.promptSurface.installScopedPersona(context.target.sessionId, identity)
  }
}

/**
 * The T1 persona overlay SLOT filled with the P5-T2 adapter
 * (TaskDoc §11.5 P5-T2: "实现 T1 persona overlay 槽位").
 *
 * The returned slot is what the caller injects as the `persona` key of the
 * binder's `slots` options (replacing the T1 identity default); the binder
 * installs it in the frozen order (persona first — its FATAL check runs
 * before the model/capability slots and before the admission decision,
 * DevPlan §18.3 / OVERLAY_SLOT_ORDER).
 *
 * @param options - the injected seams (see {@link PersonaOverlaySlotOptions}).
 * @returns the persona overlay slot (`name` = `'persona'`).
 */
export function createPersonaOverlaySlot(options: PersonaOverlaySlotOptions): OverlaySlot {
  const adapter = new TeamPersonaPresetAdapter(options)
  return {
    name: 'persona',
    apply: (context: TeamAgentStepContext): void => {
      adapter.apply(context)
    },
  }
}
