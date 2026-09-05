/**
 * The P5-T2 persona overlay module — public facade (TaskDoc §11.5 P5-T2).
 *
 * Re-exports the complete deliverable surface:
 *
 * - the preset substrate seam vocabulary (re-exported from `../preset` for
 *   slot-construction convenience);
 * - the persona overlay errors (the frozen `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`
 *   code carrier);
 * - the persona contract types (scoped identity, injected seams, options);
 * - the adapter and the T1 persona overlay slot factory (the P5-T2
 *   deliverable; the binder installs the returned slot as its `persona`
 *   key, replacing the T1 identity default).
 *
 * @module @dsh-agent-team/runtime/agent-setup/persona
 */
export { PERSONA_PROBE_GENERATION, PERSONA_REQUIREMENT_ID, TeamPersonaPresetAdapter, createPersonaOverlaySlot, personaEnvironmentFacts, personaRequirement, } from './adapter.js';
export { PERSONA_OVERLAY_ERROR_CODES, TeamPersonaOverlayError, isTeamPersonaOverlayError, } from './errors.js';
export { PRESET_PERSONA_KINDS } from '../preset/index.js';
//# sourceMappingURL=index.js.map