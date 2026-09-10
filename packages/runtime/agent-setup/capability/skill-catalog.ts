/**
 * TeamSkillCatalog — minimal in-memory skill registry (T3 / plan §8).
 *
 * Provides a lightweight catalog that holds {@link TeamSkillDefinition}
 * entries and supports lookups by skill id. The catalog is the ONLY
 * production input point for skill content — it reads from the narrowest,
 * most natural existing input (the plugin config's skill definitions) and
 * exposes them to the adapter layer.
 *
 * Forbidden: persistent skill DB, Remote CRUD, skill marketplace, new
 * storage subsystem.
 *
 * Pure module: no I/O, no ambient state.
 * @module @dsh-agent-team/runtime/agent-setup/capability/skill-catalog
 */

/**
 * A single skill definition (the content the catalog holds and the
 * adapter registers with the Agent scope).
 */
export interface TeamSkillDefinition {
  /** Stable skill id (the key the catalog and policy use). */
  name: string
  /** One-line human description. */
  description: string
  /** The full skill content (the prompt/instructions payload). */
  content: string
  /** Optional provider hint (e.g. the package that contributes it). */
  provider?: string
  /**
   * Optional registry source bucket (the upstream skill-registry
   * SkillSource vocabulary, e.g. 'runtime'). The registry's load-time
   * validation requires a source string; the adapter defaults it to
   * 'runtime' (team skills are runtime contributions from the row config)
   * when a definition does not carry one.
   */
  source?: string
}

/**
 * Read-only catalog of team skill definitions.
 *
 * The adapter calls `get(id)` for every skill id the policy resolves to
 * `allow`. Unknown ids are skipped with a diagnostic — they never crash
 * the Agent.
 */
export interface TeamSkillCatalog {
  /**
   * Look up a skill definition by id.
   * @param id - the skill id (matches {@link TeamSkillDefinition.name}).
   * @returns the definition, or `undefined` when absent.
   */
  get(id: string): TeamSkillDefinition | undefined
}

/**
 * An in-memory implementation of {@link TeamSkillCatalog}.
 *
 * Construction accepts an initial set of definitions (from the plugin
 * config or equivalent narrow input point). After construction the map is
 * immutable — no CRUD, no persistence.
 */
export class InMemorySkillCatalog implements TeamSkillCatalog {
  #map: Map<string, TeamSkillDefinition>

  /**
   * @param definitions - initial skill definitions (from plugin config or
   *   equivalent). Duplicates are silently deduplicated (last wins).
   */
  constructor(definitions: readonly TeamSkillDefinition[] = []) {
    this.#map = new Map()
    for (const def of definitions) {
      this.#map.set(def.name, def)
    }
  }

  get(id: string): TeamSkillDefinition | undefined {
    return this.#map.get(id)
  }
}
