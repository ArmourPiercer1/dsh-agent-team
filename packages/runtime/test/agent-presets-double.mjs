/**
 * pre-alpha3 W3-A (review fix F1) — the test double for the DSH public
 * `agentPresets` service (the W2-A persona-observation seam).
 *
 * The production host entry resolves the runtime substrate plan through
 * this service: `defaultId` (the deployment default preset id the
 * resolver reads lazily) + `compositionInventory()` (persona-row presence
 * + enablement) + `readDocument(presetId)` (the declared-composition YAML
 * the persona-kind parser derives the standard/complete flag from).
 *
 * The W2-A fail-closed contract: a world WITHOUT this service (and without
 * an explicit row `rootPresetId`) no longer binds — the resolver rejects
 * with its typed MALFORMED_DTO. The host-entry test worlds therefore
 * PROVIDE the double: one preset with an enabled, STANDARD persona row —
 * exactly the shipped-state substrate those worlds assumed before the
 * resolver landed, now observed through the real production observer
 * (presence + enablement + document parse) instead of a constant.
 *
 * Plain JS, shared by the host-entry test worlds.
 * @module @dsh-agent-team/runtime/test/agent-presets-double
 */

/** The upstream persona plugin's module name (the persona row's identity). */
export const PERSONA_MODULE_NAME = '@deepseek-ai/dsh-persona'

/**
 * One standard-persona preset double (the narrow public service surface
 * the host reads).
 *
 * @param presetId - the preset id the double serves; it is ALSO
 *   `defaultId` (the deployment default the host's resolver reads).
 * @returns `{ defaultId, compositionInventory(), readDocument() }`.
 */
export function agentPresetsStandardDouble(presetId = 'standard') {
  return {
    defaultId: presetId,
    async compositionInventory() {
      return [
        {
          id: presetId,
          rows: [{ moduleName: PERSONA_MODULE_NAME, enabled: true }],
        },
      ]
    },
    async readDocument(id) {
      if (id !== presetId) {
        throw new Error(`agentPresets double: unknown preset '${id}'`)
      }
      // The declared composition: the enabled persona row WITHOUT
      // `config.complete` — the parser derives `standard`.
      return `- name: '${PERSONA_MODULE_NAME}'\n`
    },
  }
}
