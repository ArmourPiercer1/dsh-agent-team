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
 * An in-memory implementation of {@link TeamSkillCatalog}.
 *
 * Construction accepts an initial set of definitions (from the plugin
 * config or equivalent narrow input point). After construction the map is
 * immutable — no CRUD, no persistence.
 */
export class InMemorySkillCatalog {
    #map;
    /**
     * @param definitions - initial skill definitions (from plugin config or
     *   equivalent). Duplicates are silently deduplicated (last wins).
     */
    constructor(definitions = []) {
        this.#map = new Map();
        for (const def of definitions) {
            this.#map.set(def.name, def);
        }
    }
    get(id) {
        return this.#map.get(id);
    }
}
//# sourceMappingURL=skill-catalog.js.map