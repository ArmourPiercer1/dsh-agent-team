/**
 * governed-preset-modules.mjs — WHICH host modules a governed member mounts, and with WHICH declared
 * config.
 *
 * EXTRACTED VERBATIM FROM agent-bindings.mjs (2026-11-23, behaviour-preserving decomposition round;
 * no byte of the moved text changed). The two questions this module answers are one question:
 *
 *  - `governedPresetModuleSpecifiers` derives the ACTIVE preset's enabled row module specifiers from
 *    the preset registry's own composition inventory (never a second list of host packages that could
 *    drift from `cordis.patch.yml`);
 *  - `declaredPresetRowConfigs` reads each row's OWN declared `config` from the public `readDocument`
 *    seam, so a module that requires a config value is mounted with exactly what its preset row would
 *    have carried (no invented default, no skipped row).
 *
 * Every failure is the typed `GOVERNED_NATIVE_PRESET_UNAVAILABLE` refusal: a governed member's
 * confinement may not rest on a guess about what its preset declared.
 *
 * `a5PlaneSubtreeContains` deliberately STAYS in agent-bindings.mjs: it is a path predicate for the
 * bind-seam probes, not part of this question, and moving it would move an exported symbol for no
 * review benefit.
 *
 * @module packages/runtime/src/plugin/vnext/governed-preset-modules
 */

import { parse as parsePresetDocument } from 'yaml'
import { VnextRealmError } from './realm-lane.mjs'

/**
 * SHAPE A (round 61) — the ACTIVE preset's own row module specifiers, for the governed default
 * native mount.
 *
 * WHY THE PRESET REGISTRY: the module set must be derived from what the product already knows. The
 * preset's composition inventory is that source (`compositionInventory()` returns each row's
 * `moduleName` and enablement), so this glue reads it instead of carrying a second list of host
 * packages that could drift from `cordis.patch.yml`. A preset whose rows cannot be read is a typed
 * refusal (`GOVERNED_NATIVE_PRESET_UNAVAILABLE`) — a governed member's confinement may not rest on
 * a guess about what its preset declared.
 *
 * @param {object} presets - the `agentPresets` service (already mounted for this agent).
 * @param {object} agentCtx - the agent Context whose composed preset is read.
 * @param {boolean} isRoot - root rows use `config.rootPresetId`; members `config.memberPresetId`.
 * @param {object} config - the row config.
 * @returns {Promise<readonly {url: string, config?: unknown}[]>} enabled row module specifiers with
 *   each row's own declared `config`, in composition order.
 */
async function governedPresetModuleSpecifiers(presets, agentCtx, isRoot, config) {
  if (presets === undefined || presets === null || typeof presets.compositionInventory !== 'function') {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      'a governed member needs its preset\'s composition rows to derive the native tool modules to mount, but the agentPresets service cannot answer compositionInventory(); refusing rather than leaving the module set on the base provider',
    )
  }
  const composed = typeof presets.composedPreset === 'function' ? presets.composedPreset(agentCtx) : undefined
  const wanted = composed ?? (isRoot ? config.rootPresetId : config.memberPresetId) ?? presets.defaultId
  const inventory = await presets.compositionInventory()
  const preset = Array.isArray(inventory) ? inventory.find((entry) => entry?.id === wanted) : undefined
  if (preset === undefined) {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      `a governed member names preset ${JSON.stringify(String(wanted))} but the composition inventory does not carry it; the native tool module set cannot be derived (fail closed)`,
    )
  }
  if (typeof preset.broken === 'string' && preset.broken !== '') {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      `a governed member's preset ${JSON.stringify(String(preset.id))} is broken (${preset.broken}); its native tool rows cannot be read (fail closed)`,
    )
  }
  // THE ROW'S OWN CONFIG, not a second set of defaults. The inventory carries the LIVE enablement
  // answer, but not the declared `config`; the public `readDocument` seam carries the config and
  // is the same document the registry composes. A module that requires a config value (the pinned
  // `dsh-tool-fs-search` requires `sampleOverCapGlobResults`) can therefore be mounted with the
  // EXACT configuration its preset row would have received — no invented default, no skipped row.
  const configOfRow = await declaredPresetRowConfigs(presets, wanted)
  return Object.freeze((preset.rows ?? [])
    .filter((row) => row?.enabled === true && typeof row?.moduleName === 'string')
    .map((row) => {
      const byEntry = typeof row.entryId === 'string' && row.entryId !== ''
        ? configOfRow.entry.get(`${row.entryId}\u0000${row.moduleName}`)
        : undefined
      const config = byEntry !== undefined ? byEntry : configOfRow.byModule.get(row.moduleName)
      return Object.freeze({
        url: row.moduleName,
        ...(config !== undefined ? { config } : {}),
      })
    }))
}

/** The `!!js` tag the preset registry's document dialect emits; preserved as data, never evaluated. */
const PRESET_JS_TAG = Object.freeze({
  tag: 'tag:yaml.org,2002:js',
  resolve: (value) => ({ __jsExpr: value }),
})

/**
 * Map every DECLARED row of a preset document to its own `config` (entry-id+module and module
 * keys). Group rows are structural and flattened the way the Loader flattens them.
 * @param {object} presets - the agentPresets accessor (must expose `readDocument`).
 * @param {string} presetId - the preset whose declared rows are read.
 * @returns {Promise<{entry: Map<string, unknown>, byModule: Map<string, unknown>}>}
 */
async function declaredPresetRowConfigs(presets, presetId) {
  if (typeof presets.readDocument !== 'function') {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      'a governed member needs its preset rows\' declared config (each host module is mounted with the configuration its own preset row carries), but the agentPresets accessor cannot answer readDocument(); refusing rather than mounting a module with invented defaults',
    )
  }
  const document = await presets.readDocument(presetId)
  // The REAL public service answers `{ agentPreset, content }`; a test-world double may answer
  // the bare YAML string. Both are the declared document; anything else is unreadable (typed).
  const content = typeof document === 'string'
    ? document
    : (document !== null && typeof document === 'object' && typeof document.content === 'string' ? document.content : undefined)
  if (content === undefined) {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      `the agentPresets readDocument returned no YAML content for preset ${JSON.stringify(presetId)}; the native module configs cannot be read (fail closed)`,
    )
  }
  let parsed
  try {
    parsed = parsePresetDocument(content, { customTags: [PRESET_JS_TAG] })
  } catch (error) {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      `a governed member could not parse the declared document of preset ${JSON.stringify(presetId)} (${error instanceof Error ? error.message : String(error)}); its native module configs cannot be read (fail closed)`,
    )
  }
  if (!Array.isArray(parsed)) {
    throw new VnextRealmError(
      'GOVERNED_NATIVE_PRESET_UNAVAILABLE',
      `the declared document of preset ${JSON.stringify(presetId)} is not a plugin row list; the native module configs cannot be read (fail closed)`,
    )
  }
  const entry = new Map()
  const byModule = new Map()
  const visit = (rows) => {
    for (const row of rows) {
      if (row === null || typeof row !== 'object') continue
      if (row.group === true && Array.isArray(row.config)) {
        visit(row.config)
        continue
      }
      if (typeof row.name !== 'string') continue
      if (row.config !== undefined && !byModule.has(row.name)) byModule.set(row.name, row.config)
      if (typeof row.id === 'string' && row.id !== '') {
        entry.set(`${row.id}\u0000${row.name}`, row.config)
      }
    }
  }
  visit(parsed)
  return { entry, byModule }
}

export { governedPresetModuleSpecifiers }
