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
 * Decision table (the P5-T2 must-test groups):
 *
 * | effective persona | engine outcome | adapter effect                                   |
 * | ----------------- | -------------- | ------------------------------------------------ |
 * | absent            | (not probed)   | no scoped identity, no error — bind proceeds     |
 * | standard (false)  | PASS           | scoped identity installed on the prompt surface  |
 * | complete (true)   | FATAL          | TeamPersonaOverlayError — FATAL before work      |
 *
 * The adapter holds NO bind state (pure over its injected seams per call),
 * so repeated installs converge to the same scoped identity (idempotent in
 * the T1 slot contract's sense; the binder enforces once-per-session).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/persona/adapter
 */
import type { CompatibilityResult, EnvironmentFact, RequirementInput } from '../../../domain/compatibility/src/index.js';
import type { OverlaySlot, TeamAgentStepContext } from '../binder/index.js';
import type { AgentPresetSubstrateFacts } from '../preset/index.js';
import type { PersonaOverlaySlotOptions, ScopedPersonaIdentity } from './types.js';
/** The stable id of the Team persona-composition requirement. */
export declare const PERSONA_REQUIREMENT_ID = "team-persona-composition";
/**
 * The deterministic mock-first probe generation (the real seam reports the
 * actual probe generation when it binds in T5/T6).
 */
export declare const PERSONA_PROBE_GENERATION = 1;
/**
 * The Team persona-composition requirement (Architecture §27.1 `persona`
 * domain, §13.5): structural (`complete: true`) — if the preset's
 * effective persona cannot compose the Team identity, the outcome is a
 * mandatory FATAL with no downgrade and no Continue Anyway.
 */
export declare function personaRequirement(substrate: AgentPresetSubstrateFacts): RequirementInput;
/**
 * The public environment fact for the persona probe: the preset's
 * effective persona is COMPOSABLE (standard) or COMPLETE (the §13.5
 * conflict — the complete section restores itself as the sole system
 * prompt after the assemble waterfall, so the scoped shadow cannot hold).
 */
export declare function personaEnvironmentFacts(substrate: AgentPresetSubstrateFacts): readonly EnvironmentFact[];
/**
 * The persona preset adapter (see the module docs for the full semantics).
 *
 * Construction is fail-fast (a malformed dependency throws a `TypeError`
 * — a programming error, mirroring the binder constructor discipline).
 */
export declare class TeamPersonaPresetAdapter {
    private readonly presetSeam;
    private readonly personaSource;
    private readonly promptSurface;
    private readonly evaluate;
    constructor(options: PersonaOverlaySlotOptions);
    /**
     * The preset substrate of the step's target. A MEMBER resolves the ROOT's
     * substrate (Architecture §13.1: inheritance by default; no per-member
     * selector) — the seam is queried with the root session id in BOTH cases.
     */
    resolveSubstrate(context: TeamAgentStepContext): AgentPresetSubstrateFacts;
    /**
     * The compatibility evaluation of the target's persona requirement
     * (the P3-T5 engine classifies; the adapter only states the public fact).
     */
    evaluatePersonaCompatibility(substrate: AgentPresetSubstrateFacts): CompatibilityResult;
    /**
     * The scoped identity of the step's target (blueprint persona text +
     * substrate identity; DevPlan §18.3).
     */
    buildScopedIdentity(context: TeamAgentStepContext, substrate: AgentPresetSubstrateFacts): ScopedPersonaIdentity;
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
    apply(context: TeamAgentStepContext): void;
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
export declare function createPersonaOverlaySlot(options: PersonaOverlaySlotOptions): OverlaySlot;
//# sourceMappingURL=adapter.d.ts.map