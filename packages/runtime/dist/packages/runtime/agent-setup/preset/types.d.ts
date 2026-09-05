/**
 * The public AgentPreset substrate seam (TaskDoc §11.5 P5-T2; DevPlan §18.2;
 * Architecture §13.1, §13.3, §13.5, §40.4; ruling R30: mock-first — the real
 * DSH public seam binding lands in T5/T6, exactly as the binder's
 * `TeamAgentSetupSurface` did in T1).
 *
 * What this module is:
 *
 * - the NARROW injected read-only surface through which the P5-T2 persona
 *   adapter observes the target agent's AgentPreset composition substrate;
 * - mock-first: the seam is implemented by a fake in the P5-T2 tests; the
 *   real binding (DSH public AgentPreset / system-prompt surface) is T5/T6
 *   work. Nothing in this module touches a live Agent, a port, or a
 *   DSH_HOME instance.
 *
 * What this module deliberately is NOT (frozen by DevPlan §18.2 + the P5-T2
 * card "不得复制/解析 dsh-persona private internals"):
 *
 * - no per-member AgentPreset selector: the seam is keyed by the ROOT
 *   session id ONLY (Architecture §13.1: "MemberInstance 默认继承 Root
 *   AgentPreset 的 composition substrate。vNext 不支持 per-member
 *   AgentPreset selector");
 * - no preset plugin graph: the substrate facts carry the preset's stable
 *   identity and the ONE persona fact Team may observe — never the preset's
 *   composition (tools / skills / MCP / plugins). Copying the preset plugin
 *   graph into a Team Blueprint is a forbidden implementation (DevPlan
 *   §18.2);
 * - no `dsh-persona` private semantics: the persona fact is the PUBLIC
 *   three-state of the preset's effective persona (absent / standard /
 *   complete), not the upstream persona package's internal assembly
 *   representation. The complete-state detection itself is performed by
 *   the P3-T5 compatibility engine (the P5-T2 allowed dependency), never by
 *   parsing persona internals.
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/preset/types
 */
/**
 * The closed three-state of a preset's effective persona — the ONLY
 * persona fact the Team side may observe (Architecture §13.3/§13.5;
 * DevPlan §18.3).
 *
 * - `absent` — the preset declares no effective persona at all: there is
 *   nothing to compose with and nothing to conflict with (the P5-T2
 *   "no persona" test group);
 * - `standard` — a composable, non-complete effective persona: the
 *   `complete:false` case of Architecture §13.4 (Blueprint persona text +
 *   preset assembly semantics form the final Team identity through the
 *   public scoped-section shadow, §40.4);
 * - `complete` — a complete effective persona (`PromptSection.complete
 *   = true` semantics, §13.5): structural FATAL for Team —
 *   `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` before work.
 */
export declare const PRESET_PERSONA_KINDS: {
    /** No effective persona (nothing to compose, nothing to conflict). */
    readonly absent: "absent";
    /** A composable non-complete effective persona (the compatible case). */
    readonly standard: "standard";
    /** A complete effective persona (structural FATAL for Team, §13.5). */
    readonly complete: "complete";
};
/** One of the three closed effective-persona states. */
export type PresetPersonaKind = (typeof PRESET_PERSONA_KINDS)[keyof typeof PRESET_PERSONA_KINDS];
/**
 * The effective composition substrate facts of one AgentPreset — the
 * minimal lossless-JSON observation the persona adapter needs.
 *
 * Every field's rationale:
 *
 * 1. `presetId` — the substrate's stable identity: the scoped identity
 *    records WHICH preset substrate it composes with (invariant: Member
 *    inherits the Root's substrate, §13.1), and the compatibility
 *    requirement probes it by subject (§27.1: persona subjects are preset
 *    ids). The id alone — no plugin graph, no composition content;
 * 2. `personaKind` — the public effective-persona three-state: the input
 *    of the §13.4/§13.5 decision (compatible → scoped identity; complete →
 *    structural FATAL; absent → no scoped identity). It is the observable
 *    PUBLIC outcome of the upstream persona assembly semantics, not a
 *    re-derivation of them (DevPlan §18.3: "不得复制 dsh-persona private
 *    semantics").
 */
export interface AgentPresetSubstrateFacts {
    /** The stable identity of the preset composing the substrate. */
    readonly presetId: string;
    /** The public effective-persona three-state of the preset. */
    readonly personaKind: PresetPersonaKind;
}
/**
 * The NARROW injected public AgentPreset seam (ruling R30: mock-first in
 * T2; the real DSH public binding lands in T5/T6).
 *
 * The persona adapter is the ONLY caller of this seam. Each member carries
 * its rationale:
 *
 * 1. `getSubstrate` — the substrate facts of the team session's Root
 *    AgentPreset. Keyed by the ROOT session id ONLY, by construction:
 *    Architecture §13.1 gives every MemberInstance the Root's substrate
 *    (no per-member selector exists to call), so a member bind resolves
 *    the SAME facts as its root bind — the seam surface cannot express a
 *    per-member choice, which is what "不得实现 per-member AgentPreset
 *    selector" (DevPlan §18.2) requires at the type level. The real
 *    implementation (T5/T6) reads the DSH public preset surface for the
 *    session's standing preset; the mock records and returns scripted
 *    facts.
 */
export interface AgentPresetSeam {
    /**
     * The effective substrate facts of the session's Root AgentPreset.
     * @param rootSessionId - the root DSH session id (= TeamSessionId,
     *   invariant 9). The only valid key: members inherit this substrate.
     * @returns the minimal substrate facts (preset id + persona three-state).
     */
    getSubstrate(rootSessionId: string): AgentPresetSubstrateFacts;
}
//# sourceMappingURL=types.d.ts.map