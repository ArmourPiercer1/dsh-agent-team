/**
 * Type surface for persona-probe.mjs (the harness persona-slot reader).
 * Kept next to the module, same convention as wire-shape.d.mts / paths.d.mts.
 */

/** The closed vocabulary a persona probe may report. */
export const PERSONA_PROBE_KINDS: readonly ['absent', 'standard', 'complete']

export interface PersonaAssemblySection {
  readonly name: string
  readonly text?: string
}

export interface PersonaProbeResult {
  /** The `deployment:persona-prefix` section, if the assembly carries one. */
  readonly prefixSection: PersonaAssemblySection | undefined
  /** The `deployment:persona-suffix` section, if the assembly carries one. */
  readonly suffixSection: PersonaAssemblySection | undefined
  readonly personaKind: 'absent' | 'standard' | 'complete'
  /** The persona prefix text, or null when the slot is absent. Never merged with the suffix. */
  readonly personaText: string | null
  /** The persona suffix text, or null when the slot is absent. Reported, never merged. */
  readonly personaSuffixText: string | null
  readonly sectionNames: string[]
}

/**
 * Read the persona slots of one `systemPrompt.assemble()` result.
 * @param assembly an assembly with a `sections` array of `{ name, text? }`.
 */
export function readPersonaSections(assembly: {
  readonly sections?: readonly PersonaAssemblySection[]
}): PersonaProbeResult
