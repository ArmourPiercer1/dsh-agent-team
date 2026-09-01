/**
 * P8-S5 — the production persona-substrate surface (plan §19.1, nodes
 * A11-A13 support).
 *
 * The P2-T3 persona detection was pinned in the P2-T3 task and lived
 * inline in the root-binding HARNESS slot builder (harness-only code).
 * This module lifts the detection into the shipped production plugin
 * so the live overlay-slot construction (enabled by
 * `overlayInstallationEnabled`) consumes PRODUCTION code, not a
 * harness copy:
 *
 * - {@link detectPersonaKind} — the P2-T3 pinned three-state
 *   detection over one `systemPrompt.assemble` observation;
 * - {@link PromptAssemblyLike} — the structural mirror of the
 *   assembly result (no bare `@deepseek-ai/*` import in the chain);
 * - the structural port types the persona slot consumes (re-exported
 *   from the production `agent-setup` modules — the live slot builder
 *   binds them to the DSH `agentPresets` / `systemPrompt` services).
 *
 * Pure module: NO I/O, NO `node:` builtins, NO bare `@deepseek-ai/*`
 * imports.
 *
 * @module @dsh-agent-team/runtime/plugin/persona-substrate
 */

import type {
  AgentPresetSeam,
  AgentPresetSubstrateFacts,
  PresetPersonaKind,
} from '../../agent-setup/preset/index.js'
import type {
  ScopedPersonaPromptSurface,
  TeamBlueprintPersonaSource,
} from '../../agent-setup/persona/index.js'

/** The upstream first-party persona section name (mirror of the
 *  upstream `PERSONA_SECTION` constant; this module must not bare-import
 *  it — the chain constraint). */
export const PERSONA_SECTION_NAME = 'deployment:persona'

/** A structural mirror of one section of a `systemPrompt.assemble`
 *  observation (the fields the detection reads). */
export interface PromptAssemblySectionLike {
  /** The section name (e.g. `deployment:persona`). */
  readonly name: string
  /** The section text. */
  readonly text: string
  /** The `PromptSection.complete` flag, when present. */
  readonly complete?: boolean
}

/** A structural mirror of the `systemPrompt.assemble` result. */
export interface PromptAssemblyLike {
  /** The composed sections, in assembly order. */
  readonly sections: readonly PromptAssemblySectionLike[]
}

/**
 * The P2-T3 pinned effective-persona detection:
 *
 * - no persona section at all      -> `absent` (nothing to compose,
 *   nothing to conflict);
 * - a persona section and the assembly collapsed to EXACTLY that one
 *   section (the complete-persona semantics: the assembly is the
 *   persona and nothing else) -> `complete` (structural FATAL for
 *   Team, §13.5);
 * - a persona section among the first-party sections -> `standard`
 *   (the composable non-complete case, §13.4).
 *
 * @param assembly - one `systemPrompt.assemble` observation (the
 *   structural mirror; the live builder passes the real result).
 * @returns the effective persona kind.
 */
export function detectPersonaKind(
  assembly: PromptAssemblyLike,
): PresetPersonaKind {
  const persona = assembly.sections.find((s) => s.name === PERSONA_SECTION_NAME)
  if (persona === undefined) return 'absent'
  return assembly.sections.length === 1 ? 'complete' : 'standard'
}

/** Re-exported structural port surface of the persona overlay slot
 *  (the live slot builder binds these to the DSH services; the
 *  production root's binder consumes the resulting slot). */
export type {
  AgentPresetSeam,
  AgentPresetSubstrateFacts,
  PresetPersonaKind,
  ScopedPersonaPromptSurface,
  TeamBlueprintPersonaSource,
}
