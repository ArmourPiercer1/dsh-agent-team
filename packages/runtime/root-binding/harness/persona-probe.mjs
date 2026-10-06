/**
 * Persona sections of an assembled system prompt, read through the host's REAL
 * public interface.
 *
 * Why this exists: four harness files imported `PERSONA_SECTION` from
 * `@deepseek-ai/dsh-system-prompt`. That export has never existed — not at
 * 0.1.5-rc.2 (`fb2c4b9e69`), not at 0.1.7-rc.1 (`46a7f68b09`), not at
 * 0.2.0-rc.2 (`639ed01539`). The host names two distinct slots:
 *
 *   PERSONA_PREFIX_SECTION = 'deployment:persona-prefix'  // persona prose, before first-party guidance
 *   PERSONA_SUFFIX_SECTION = 'deployment:persona-suffix'  // persona suffix, AFTER first-party guidance
 *
 * They are not two halves of one old section, so this module deliberately does
 * NOT join them. `@deepseek-ai/dsh-persona`'s `Config` mirrors that split:
 * `prefix` (required), `suffix` (default `''`), `complete` (default false),
 * `includeRuntimeContext` (default true), and its `apply()` registers one
 * section per slot — the suffix one with `text: config.suffix ?? ''`, which the
 * registry drops at render when empty. So a persona that declares only `prefix`
 * — which is every persona this plugin declares — yields exactly one persona
 * section, the prefix.
 *
 * `personaKind` keeps the harness vocabulary (`absent` | `standard` |
 * `complete`) but derives it from documented host behaviour instead of a
 * section-count guess:
 *   - `absent`   — neither persona slot is present;
 *   - `complete` — the assembly's ONLY section is the persona prefix, which is
 *                  what `complete: true` produces ("assembly … restores this
 *                  exact section as the sole prompt section", and only the
 *                  persona prefix is ever registered with `complete`);
 *   - `standard` — anything else.
 * The old code's `sections.length === 1` proxy conflated "complete persona" with
 * "an assembly that happened to have one section".
 *
 * `AssembledSection` carries `{ name, text, interpolate? }` — the `complete`
 * flag lives on the registration, not on the assembled section — so the
 * sole-section rule is the only public way to see it. Anything beyond that is
 * reported as observed (`suffixText`), never folded into `personaText`.
 *
 * Pure module: no host services, no fs, no clock.
 *
 * @module @dsh-agent-team/runtime/root-binding/harness/persona-probe
 */
import { PERSONA_PREFIX_SECTION, PERSONA_SUFFIX_SECTION } from '@deepseek-ai/dsh-system-prompt'

/** The closed vocabulary a persona probe may report. */
export const PERSONA_PROBE_KINDS = Object.freeze(['absent', 'standard', 'complete'])

/**
 * Read the persona slots out of one `systemPrompt.assemble()` result.
 *
 * @param {{ sections?: Array<{ name: string, text?: string }> }} assembly
 * @returns {{
 *   prefixSection: { name: string, text?: string } | undefined,
 *   suffixSection: { name: string, text?: string } | undefined,
 *   personaKind: 'absent' | 'standard' | 'complete',
 *   personaText: string | null,
 *   personaSuffixText: string | null,
 *   sectionNames: string[],
 * }}
 */
export function readPersonaSections(assembly) {
  const sections = Array.isArray(assembly?.sections) ? assembly.sections : []
  const prefixSection = sections.find((s) => s?.name === PERSONA_PREFIX_SECTION)
  const suffixSection = sections.find((s) => s?.name === PERSONA_SUFFIX_SECTION)
  const sole = sections.length === 1 ? sections[0] : undefined
  const personaKind = prefixSection === undefined && suffixSection === undefined
    ? 'absent'
    : (sole !== undefined && sole.name === PERSONA_PREFIX_SECTION ? 'complete' : 'standard')
  return {
    prefixSection,
    suffixSection,
    personaKind,
    personaText: typeof prefixSection?.text === 'string' ? prefixSection.text : null,
    personaSuffixText: typeof suffixSection?.text === 'string' ? suffixSection.text : null,
    sectionNames: sections.map((s) => s.name),
  }
}
