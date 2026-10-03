/**
 * Ambient types for `tests/kits/_shared/preset-seam.mjs` (plain-ESM kit module,
 * imported by TypeScript tests). Follows the `tests/paths.d.mts` precedent.
 */

export declare const AGENT_PRESET_ROW_NAME: '@deepseek-ai/dsh-agent-preset'
export declare const PERSONA_ROW_NAME: '@deepseek-ai/dsh-persona'
export declare const LEGACY_PRESET_DIRECTORY_SEAM: '.agent-presets'
export declare const LEGACY_PRESET_FILE_NAME: 'agent.cordis.yml'

export interface PatchRow {
  readonly id: string
  readonly name: string
  readonly config?: unknown
  readonly [key: string]: unknown
}

export declare function legacyPresetDirPath(home: string, presetId: string): string
export declare function legacyPresetFileShape(personaText: string): string
export declare function personaRow(input: {
  text: string
  suffix?: string
  includeRuntimeContext?: boolean
}): PatchRow
export declare function persistentShellGroup(input?: {
  timeoutMs?: number
  bashDescription?: string
}): PatchRow
export declare function smokePresetPlugins(input: {
  personaText: string
  cwdSuffix?: string
  bashTimeoutMs?: number
  bashDescription?: string
}): PatchRow[]
export declare function presetDeclarationRow(input: {
  id: string
  displayName?: string
  description?: string
  order?: number
  plugins: PatchRow[]
}): PatchRow
export declare function emitPatchLayer(input: { header?: string[]; rows: PatchRow[] }): string
