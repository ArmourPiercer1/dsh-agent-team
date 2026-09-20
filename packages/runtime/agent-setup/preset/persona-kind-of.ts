/**
 * Deriving the persona KIND of one AgentPreset from its composition text.
 *
 * The persona kind convention (the P5-T2 subject decision, revised by the
 * persona-requirement-preset-id bug report, direction B) needs the host
 * side to RESOLVE the effective-persona kind of a preset id before the
 * probe world is built: the upstream roster seam (`agentPresets.list`)
 * carries no persona data, and the preset's persona row config is the
 * authoritative statement of its effective persona (the upstream
 * `dsh-persona` plugin's PUBLIC row config — `complete?: boolean`, the
 * §13.5 three-state). Reading that public flag is observation, not a
 * re-derivation of the assembly semantics (DevPlan §18.3: 不得复制
 * dsh-persona private semantics — no prefix/suffix text is interpreted,
 * no section is assembled, nothing is overridden).
 *
 * Mapping (the closed three-state, Architecture §13.5):
 *
 * - no effective `dsh-persona` row (absent, or disabled by a literal
 *   `disabled: true` on the row or an ancestor group) => `absent`;
 * - an effective row with `config.complete === true` => `complete`;
 * - any other effective row => `standard` (composable, non-complete).
 *
 * Conservative corners: a row whose `disabled` is a `!!js` expression
 * (unevaluable outside the Loader) is treated as ENABLED — so a
 * conditionally-disabled `complete: true` persona row still classifies
 * `complete` (the fail-safe direction for the §13.5 gate); multiple
 * effective persona rows classify `complete` when any of them is
 * complete (a loadable preset declares the persona section at most once;
 * a duplicate that would make the preset unmountable is answered with the
 * conservative kind, not a crash).
 *
 * Pure module: string in, kind out — no I/O, no `node:` builtins. The
 * composition text is the preset's `agent.cordis.yml` content exactly as
 * stored (the upstream `agentPresets.read` seam).
 * @module @dsh-agent-team/runtime/agent-setup/preset/persona-kind-of
 */

import { parse as parseYaml } from 'yaml'

import type { PresetPersonaKind } from './types.js'

/** The public module specifier of the upstream persona plugin row. */
export const DSH_PERSONA_MODULE = '@deepseek-ai/dsh-persona'

/**
 * Thrown when the composition text is not a readable preset composition
 * (unparseable YAML, or a root that is not a row list). The host resolver
 * maps this to the typed "preset persona unresolvable" probe outcome —
 * never a silent guess.
 */
export class PresetPersonaCompositionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PresetPersonaCompositionError'
  }
}

/** A parsed composition row (the fields the kind derivation reads). */
interface CompositionRow {
  readonly name?: unknown
  readonly config?: unknown
  readonly disabled?: unknown
}

/** Whether one row is effective under a literal-true disabled flag. */
function rowDisabled(row: CompositionRow): boolean {
  return row.disabled === true
}

/**
 * Walk the row list (recursing into GROUP rows — a row whose `config` is
 * an ARRAY of rows) and collect the effective persona rows. A group
 * disabled by a literal `disabled: true` disables every row inside it.
 */
function collectPersonaRows(
  rows: readonly unknown[],
  ancestorDisabled: boolean,
  out: CompositionRow[],
): void {
  for (const item of rows) {
    if (item === null || typeof item !== 'object') continue
    const row = item as CompositionRow
    const disabled = ancestorDisabled || rowDisabled(row)
    if (Array.isArray(row.config)) {
      // A group row: its config is the nested row list.
      collectPersonaRows(row.config, disabled, out)
      continue
    }
    if (row.name === DSH_PERSONA_MODULE) {
      out.push(disabled ? { ...row, disabled: true } : row)
    }
  }
}

/**
 * Derive the persona kind of one preset from its composition text (see
 * the module docs for the mapping and the conservative corners).
 *
 * @param content - the preset composition text (`agent.cordis.yml`).
 * @returns one of `absent` | `standard` | `complete`.
 * @throws {@link PresetPersonaCompositionError} when the text is not a
 *   readable preset composition.
 */
export function presetPersonaKindOfComposition(content: string): PresetPersonaKind {
  let doc: unknown
  try {
    // The composition may carry `!!js` disabled expressions; the yaml
    // parser keeps the tagged scalar as a plain string (an unresolved-tag
    // warning, emitted once per process by Node's warning machinery),
    // which is exactly the "unevaluable => treated as enabled" input this
    // module wants (a non-boolean `disabled` value is not a literal
    // `disabled: true`, so the row stays effective).
    doc = parseYaml(content)
  } catch (err) {
    throw new PresetPersonaCompositionError(
      `preset composition is not readable YAML: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (!Array.isArray(doc)) {
    throw new PresetPersonaCompositionError('preset composition root must be a list of rows')
  }
  const rows = doc
  const personaRows: CompositionRow[] = []
  collectPersonaRows(rows, false, personaRows)
  if (personaRows.length === 0) return 'absent'
  // Conservative: any effective complete row => complete (fail-safe for
  // the §13.5 gate); a disabled row can never carry a complete persona.
  const effective = personaRows.filter((row) => row.disabled !== true)
  if (effective.length === 0) return 'absent'
  return effective.some((row) => {
    const config = row.config
    return config !== null && typeof config === 'object' && (config as Record<string, unknown>)['complete'] === true
  })
    ? 'complete'
    : 'standard'
}
