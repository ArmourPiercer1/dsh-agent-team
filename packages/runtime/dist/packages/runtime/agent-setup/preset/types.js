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
import { teamContractError } from '../../../contracts/src/index.js';
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
export const PRESET_PERSONA_KINDS = {
    /** No effective persona (nothing to compose, nothing to conflict). */
    absent: 'absent',
    /** A composable non-complete effective persona (the compatible case). */
    standard: 'standard',
    /** A complete effective persona (structural FATAL for Team, §13.5). */
    complete: 'complete',
};
/**
 * The OBSERVED persona kind of the actually-mounted preset (pre-alpha3
 * PR-C §C.3) — the frozen four-state the runtime reports for the preset it
 * WILL mount (`config.rootPresetId` / `config.memberPresetId`, absent → the
 * deployment default).
 *
 * This is the observation of the preset's effective persona from the REAL
 * mount (not the historical hardcoded substrate, the UI-selected id, or the
 * static row facts). The three resolved states mirror
 * {@link PresetPersonaKind}; the fourth, `unresolved`, is a TYPED
 * host/probe failure — the observation could not be resolved (the service is
 * absent, the preset is unknown/unreadable, or a conditional disable is not
 * evaluatable by any source). `unresolved` is fail-closed (no silent install)
 * and is NOT an ordinary incompatibility: it is a distinct, honest state the
 * plan §C.3 requires the engine and the UI to name rather than guess a kind
 * from.
 */
export const OBSERVED_PERSONA_KINDS = {
    /** No effective persona observed on the mounted preset. */
    absent: 'absent',
    /** A composable non-complete effective persona observed (the compatible case). */
    standard: 'standard',
    /** A complete effective persona observed (structural FATAL for Team, §13.5). */
    complete: 'complete',
    /**
     * A TYPED observation failure: the kind could not be resolved from any
     * source (fail-closed, never a kind guess, never ordinary incompatibility).
     */
    unresolved: 'unresolved',
};
/** Every observed-persona value, for closed-set membership tests. */
export const OBSERVED_PERSONA_KIND_VALUES = Object.values(OBSERVED_PERSONA_KINDS);
/**
 * Assert that `value` is a closed observed-persona kind.
 * @param value - the raw kind.
 * @param path - pointer used in the error details.
 * @returns the typed kind.
 * @throws `MALFORMED_DTO` for any value outside the four-state vocabulary.
 */
export function assertObservedPersonaKind(value, path) {
    if (typeof value !== 'string' || !OBSERVED_PERSONA_KIND_VALUES.includes(value)) {
        throw teamContractError('MALFORMED_DTO', `unknown observed persona kind at ${path}`, {
            path,
            problem: 'unknown observed persona kind',
            value: typeof value === 'string' ? value : typeof value,
        });
    }
    return value;
}
//# sourceMappingURL=types.js.map