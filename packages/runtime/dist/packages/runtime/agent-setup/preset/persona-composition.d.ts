/**
 * pre-alpha3 PR-E / review fix F14 — the persona-kind derivation from the
 * preset's EFFECTIVE DECLARED COMPOSITION text (the `readDocument` dump of
 * the DSH public `agentPresets` service).
 *
 * The parser reads the same dialect the registry dumps: a YAML entry list
 * (js-yaml `entryListSchema` — JSON schema + the `tag:yaml.org,2002:js`
 * scalar tag) where each row names a plugin (`name`) and may carry `config`,
 * `disabled`, and — for structural group rows — a nested `config` entry list
 * (the Loader's group semantics: children inherit the group's `disabled`).
 *
 * Persona-kind semantics (Architecture §13.3/§13.5; the upstream `dsh-persona`
 * plugin's public config — `complete?: boolean`):
 *
 * - no `@deepseek-ai/dsh-persona` row (anywhere, incl. nested groups) →
 *   `absent`;
 * - the persona row (or an ancestor group) is literally `disabled: true` →
 *   `absent` (nothing mounts);
 * - the persona row (or an ancestor group) carries a `!!js` `disabled`
 *   expression → `unresolved` (TYPED): the expression only evaluates at a
 *   real mount — never guessed, never skipped (fail-closed, plan §C.3);
 * - the persona row is enabled and `config.complete === true` (strict
 *   boolean) → `complete` (the §13.5 structural conflict);
 * - the persona row is enabled and `config.complete` is `false` or absent →
 *   `standard` (the composable case).
 *
 * FAIL-CLOSED on every non-derivable input: a malformed document, a non-list
 * root, a non-boolean `config.complete`, a `!!js` `config.complete`, or a
 * duplicate persona row all resolve to `unresolved` with a typed reason.
 * The parser NEVER invents a kind.
 *
 * Pure module: no I/O, no live Agent. It parses the given text only (the
 * text is produced by the caller's seam read — `readDocument`).
 * @module @dsh-agent-team/runtime/agent-setup/preset/persona-composition
 */
/**
 * The module specifier of the upstream persona plugin — the row that carries
 * the preset's effective persona (the public `@deepseek-ai/dsh-persona`
 * function plugin; its config shape is public: `prefix`, `suffix?`,
 * `complete?`, `includeRuntimeContext?`).
 */
export declare const PERSONA_PLUGIN_MODULE_NAME = "@deepseek-ai/dsh-persona";
/**
 * The full YAML tag of the composition dialect's expression scalar (the
 * `!!js` shorthand expands to this full tag; the registry's js-yaml schema
 * registers exactly `tag:yaml.org,2002:js`).
 */
export declare const COMPOSITION_JS_TAG = "tag:yaml.org,2002:js";
/**
 * The persona-kind derivation from one effective composition document.
 * `reason` is present ONLY for the `unresolved` case (a typed diagnostic —
 * the frozen result must round-trip losslessly).
 */
export interface CompositionPersonaDerivation {
    /** The derived kind (`unresolved` = a typed fail-closed diagnostic). */
    readonly kind: 'absent' | 'standard' | 'complete' | 'unresolved';
    /** Present only when `kind` is `unresolved`: what failed, typed. */
    readonly reason?: string;
}
/**
 * Derive the persona kind from one effective composition document (the
 * `readDocument` YAML of the preset's plugin entry list).
 *
 * Fail-closed: every non-derivable input (malformed YAML, a non-list root,
 * a duplicate persona row, a non-boolean or `!!js` `config.complete`) is a
 * typed `unresolved` — the parser NEVER invents a kind (plan §C.3).
 *
 * @param text - the effective declared composition YAML (an entry list).
 * @returns the frozen derivation.
 */
export declare function parsePersonaKindFromCompositionDocument(text: string): CompositionPersonaDerivation;
//# sourceMappingURL=persona-composition.d.ts.map