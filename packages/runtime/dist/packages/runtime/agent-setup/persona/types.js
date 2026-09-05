/**
 * The P5-T2 persona overlay contract surface (TaskDoc §11.5 P5-T2; DevPlan
 * §18.2/§18.3; Architecture §13, §40.4).
 *
 * This module defines:
 *
 * - {@link ScopedPersonaIdentity} — the scoped identity the compatible
 *   (non-complete) preset case installs: the Team Blueprint persona text
 *   scoped onto the target's AgentPreset substrate (DevPlan §18.3 "Team
 *   Blueprint persona → scoped identity");
 * - the two read-only sources the adapter composes from: the public
 *   AgentPreset substrate seam (./../preset, imported by the adapter) and
 *   {@link TeamBlueprintPersonaSource} (the Blueprint-owned persona text,
 *   Architecture §13.3);
 * - {@link ScopedPersonaPromptSurface} — the public system-prompt seam the
 *   scoped identity is installed onto (the runtime context of the Team
 *   prompt/policy surface, §40.4); mock-first in T2, real DSH public
 *   binding in T5/T6;
 * - {@link PersonaOverlaySlotOptions} — the construction options of the
 *   persona overlay slot (all dependencies injected, fail-fast validated).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/persona/types
 */
export {};
//# sourceMappingURL=types.js.map