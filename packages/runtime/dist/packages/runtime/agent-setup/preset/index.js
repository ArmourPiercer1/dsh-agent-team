/**
 * AgentPreset public substrate seam (TaskDoc §11.5 P5-T2; DevPlan §18.2).
 *
 * Public facade of the P5-T2 preset module: the closed three-state
 * vocabulary of a preset's effective persona and the narrow injected
 * `AgentPresetSeam` the persona adapter observes through (mock-first in
 * T2; the real DSH public binding lands in T5/T6).
 *
 * @module @dsh-agent-team/runtime/agent-setup/preset
 */
export { OBSERVED_PERSONA_KINDS, OBSERVED_PERSONA_KIND_VALUES, PRESET_PERSONA_KINDS, assertObservedPersonaKind, } from './types.js';
export { PERSONA_OBSERVATION_SOURCES, resolveRuntimeSubstrate, } from './substrate-resolver.js';
//# sourceMappingURL=index.js.map