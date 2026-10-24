/**
 * `tests/kits/_shared/preset-seam.mjs` — the one place that knows how a kit or
 * harness declares an **agent preset** on the pinned host generation.
 *
 * WHY THIS FILE EXISTS
 *
 * Up to 0.1.5 a user preset was a directory: `$DSH_HOME/.agent-presets/<id>/
 * agent.cordis.yml`. That seam is GONE — the preset registry no longer
 * registers user-preset directories, and upstream's own agent-preset skill says
 * plainly "Nothing reads that directory any more". A preset is now an ordinary
 * `@deepseek-ai/dsh-agent-preset` DECLARATION ROW carried by a patch layer,
 * mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same seam the team row uses.
 *
 * Three kits (`c1-leader-approval-smoke`, `exec-contract-live-smoke`,
 * `send-message-liveness-smoke`) and two harnesses
 * (`packages/runtime/root-binding`, `packages/runtime/member-residency`) still
 * wrote the dead directory. Writing a file nobody reads is worse than writing
 * nothing: the fixture LOOKS configured while the host runs something else
 * (the shipped `standard` preset, or a bootstrap "Unknown agent preset").
 * Everything here exists so those call sites stop inventing the old shape.
 *
 * CONTRACT SOURCES, verified against the pinned runtime (`tests/paths.mjs` →
 * `TEST_USE_BASELINE_SHA` = `639ed01539…`, 0.2.0-rc.2) and re-asserted by
 * `packages/testkit/test/rc2-kit-preset-seam.test.ts`:
 *   - row plugin name + `config.id` roster identity:
 *     `packages/preset/agent-preset-registry/src/{types,invariant,mount}.ts`
 *   - persona row config: `packages/preset/persona/src/index.ts` —
 *     `prefix` (REQUIRED), `suffix?`, `complete?`, `includeRuntimeContext?`.
 *     **There is no `text` key**; the retired directory fixture shape used
 *     `config: { text: … }`, which is a schema miss on this generation.
 *   - section names the persona row writes:
 *     `packages/core/system-prompt/src/index.ts` →
 *     `PERSONA_PREFIX_SECTION = 'deployment:persona-prefix'`,
 *     `PERSONA_SUFFIX_SECTION = 'deployment:persona-suffix'`
 *     (there is no bare `PERSONA_SECTION` export).
 *
 * Nothing in this module touches the filesystem. Kit-side behavior is unchanged
 * on purpose: same persona/tool-fs/persistent-shell content the 0.1.7 kits ran
 * with, just delivered through the seam the current host actually reads.
 */

/** Row plugin name that declares a preset (roster identity is `config.id`). */
export const AGENT_PRESET_ROW_NAME = '@deepseek-ai/dsh-agent-preset'
/** Row plugin name of the persona plugin mounted INSIDE a preset. */
export const PERSONA_ROW_NAME = '@deepseek-ai/dsh-persona'
/** Retired directory seam. Exported ONLY so guards and docs can name it. */
export const LEGACY_PRESET_DIRECTORY_SEAM = '.agent-presets'
/** The retired per-preset file name inside that directory. */
export const LEGACY_PRESET_FILE_NAME = 'agent.cordis.yml'

/**
 * The retired fixture location, as DATA. Kits and harnesses must never write it;
 * the guard test asserts no kit source composes this path for a write.
 */
export function legacyPresetDirPath(home, presetId) {
  return `${home}/${LEGACY_PRESET_DIRECTORY_SEAM}/${presetId}`
}

/**
 * The retired file body, returned as text so the historical shape stays
 * documented and assertable instead of silently deleted.
 */
export function legacyPresetFileShape(personaText) {
  return [
    `# RETIRED SHAPE (<= 0.1.5): ${LEGACY_PRESET_FILE_NAME} under ${LEGACY_PRESET_DIRECTORY_SEAM}/<id>/`,
    "# Not read by the pinned host generation; see this module's header.",
    "- id: persona",
    `  name: '${PERSONA_ROW_NAME}'`,
    '  config:',
    `    text: ${personaText}`,
    '',
  ].join('\n')
}

/**
 * A persona row for the CURRENT generation. `prefix` is the required key; the
 * old `text:` key is rejected by the host's schema.
 */
export function personaRow({ text, suffix, includeRuntimeContext }) {
  return {
    id: 'persona',
    name: PERSONA_ROW_NAME,
    config: {
      prefix: text,
      ...(suffix !== undefined ? { suffix } : {}),
      ...(includeRuntimeContext !== undefined ? { includeRuntimeContext } : {}),
    },
  }
}

/**
 * The minimal-style persistent shell group (bash stack) the smoke kits have
 * carried since 0.1.5. NO delegation group: the 0.1.5 spawn `subagent` row is a
 * deferred per-agent own-layer install (un-restrictable and KNOWN_SENSITIVE
 * under the Coverage Gate), so it stays out of kit presets.
 */
export function persistentShellGroup({ timeoutMs = 300_000, bashDescription } = {}) {
  return {
    id: 'persistent-shell',
    name: 'cordis:group',
    group: true,
    isolate: { terminals: true },
    config: [
      { id: 'pty', name: '@deepseek-ai/dsh-terminal' },
      { id: 'terminal-bash', name: '@deepseek-ai/dsh-terminal-bash', config: { timeoutMs } },
      {
        id: 'persistent-bash',
        name: '@deepseek-ai/dsh-tool-bash-persistent',
        config: {
          timeoutMs,
          ...(bashDescription !== undefined ? { description: bashDescription } : {}),
        },
      },
    ],
  }
}

/**
 * The plugin subtree the smoke presets have always carried: persona +
 * `dsh-tool-fs` + the persistent shell group. `personaText` is required because
 * the persona plugin requires a prefix.
 */
export function smokePresetPlugins({ personaText, cwdSuffix, bashTimeoutMs, bashDescription }) {
  if (typeof personaText !== 'string' || personaText.length === 0) {
    throw new TypeError('smokePresetPlugins: personaText is required (the persona row has no default prefix)')
  }
  return [
    personaRow({
      text: personaText,
      ...(cwdSuffix !== undefined ? { suffix: cwdSuffix } : {}),
    }),
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
    persistentShellGroup({ ...(bashTimeoutMs !== undefined ? { timeoutMs: bashTimeoutMs } : {}), ...(bashDescription !== undefined ? { description: bashDescription } : {}) }),
  ]
}

/**
 * The preset DECLARATION ROW. `id` is the preset id the team row / blueprint
 * refers to (`teamPersonaPresetId`), and it travels as `config.id` — that is the
 * roster identity the registry dedupes on.
 */
export function presetDeclarationRow({ id, displayName, description, order = 900, plugins }) {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('presetDeclarationRow: id is required')
  if (!Array.isArray(plugins) || plugins.length === 0) {
    throw new TypeError(`presetDeclarationRow(${id}): plugins must be a non-empty array`)
  }
  return {
    id: `preset-${id}`,
    name: AGENT_PRESET_ROW_NAME,
    config: {
      id,
      name: displayName ?? id,
      description: description ?? `kit-authored preset "${id}" (public profile-patch seam)`,
      order,
      plugins,
    },
  }
}

/**
 * Emit the whole profile patch layer (`cordis.patch.yml`) as text.
 *
 * `tests/characterization/lib/instance.mjs`'s `mountRows()` writes only
 * `{ id, name }` pairs, which cannot express a preset declaration (it needs
 * nested `config`), so a patch layer that contains a preset row is emitted here.
 * The emitter is the one the rc2 kit booted a real host with (2026-10-03),
 * copied rather than re-invented: two YAML writers in one repo is how a kit
 * starts emitting something the host parses differently.
 */
export function emitPatchLayer({ header = [], rows }) {
  if (!Array.isArray(rows)) throw new TypeError('emitPatchLayer: rows must be an array')
  const lines = [...header.map((line) => `# ${line}`), '- insert:']
  for (const row of rows) lines.push(...yamlEmitItem(row, 1))
  lines.push('')
  return lines.join('\n')
}

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}

function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}

function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

