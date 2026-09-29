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
export type { AgentPresetSeam, AgentPresetSubstrateFacts, ObservedPersonaKind, PresetPersonaKind, } from './types.js';
export { PERSONA_OBSERVATION_SOURCES, resolveRuntimeSubstrate, } from './substrate-resolver.js';
export type { PersonaKindObservation, PersonaObservationSource, ResolveRuntimeSubstrateArgs, RuntimeSubstratePlan, RuntimeSubstratePlanEntry, } from './substrate-resolver.js';
export { COMPOSITION_JS_TAG, PERSONA_PLUGIN_MODULE_NAME, parsePersonaKindFromCompositionDocument, } from './persona-composition.js';
export type { CompositionPersonaDerivation } from './persona-composition.js';
export { createProductionPersonaObserver } from './production-observer.js';
export type { AgentPresetPersonaSeam, PresetCompositionMirror, PresetCompositionRowMirror, ProductionPersonaObserver, } from './production-observer.js';
//# sourceMappingURL=index.d.ts.map