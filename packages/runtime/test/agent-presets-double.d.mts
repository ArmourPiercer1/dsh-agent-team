/**
 * agent-presets-double.d.mts — the tsc type surface of
 * `agent-presets-double.mjs` (the same `.mjs` + adjacent `.d.mts` pattern
 * as the P4-T6 `session-event-scan`, the P7-T5 `p7t5-no-creation-scan`,
 * and the `t12a-live-bridge`): tsc (NodeNext) resolves these declarations
 * for the `./agent-presets-double.mjs` import specifier, while the plain-
 * node/vitest runner loads the `.mjs` natively.
 *
 * This file is inside the P4-T6 whole-tree scanner's scope
 * (`packages/**`) and is NOT among its two self-excluded files, so it
 * carries zero legacy SessionEvent denylist tokens.
 *
 * @module @dsh-agent-team/runtime/test/agent-presets-double (type surface)
 */

/** The persona plugin module name (the DSH public seam's row identity). */
export declare const PERSONA_MODULE_NAME: string

/** One declared composition row as seen by the host inventory read. */
export interface AgentPresetCompositionRowMirror {
  readonly moduleName: string
  readonly enabled: boolean
}

/** One declared preset composition as seen by the host inventory read. */
export interface AgentPresetCompositionMirrorEntry {
  readonly id: string
  readonly rows: readonly AgentPresetCompositionRowMirror[]
}

/**
 * The `@deepseek-ai/dsh-persona` STANDARD persona service double (the
 * W3-A host-entry world's `agentPresets` port): the declared composition
 * carries the enabled persona row WITHOUT `config.complete` (the parser
 * derives `standard`); `readDocument` returns the minimal declared
 * persona document and throws on an unknown preset id.
 */
export interface AgentPresetsStandardDouble {
  /** The deployment default preset id (the host's `defaultId` read). */
  readonly defaultId: string
  /** The effective-composition inventory read (one preset, persona row). */
  compositionInventory(): Promise<readonly AgentPresetCompositionMirrorEntry[]>
  /** The preset document read (unknown id = typed throw). */
  readDocument(id: string): Promise<string>
}

/** Build the standard-persona `agentPresets` service double. */
export declare function agentPresetsStandardDouble(presetId?: string): AgentPresetsStandardDouble
