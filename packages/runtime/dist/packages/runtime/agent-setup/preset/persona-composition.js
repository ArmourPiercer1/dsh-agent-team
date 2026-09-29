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
import { deepFreeze } from '../../../contracts/src/index.js';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
/**
 * The module specifier of the upstream persona plugin — the row that carries
 * the preset's effective persona (the public `@deepseek-ai/dsh-persona`
 * function plugin; its config shape is public: `prefix`, `suffix?`,
 * `complete?`, `includeRuntimeContext?`).
 */
export const PERSONA_PLUGIN_MODULE_NAME = '@deepseek-ai/dsh-persona';
/**
 * The full YAML tag of the composition dialect's expression scalar (the
 * `!!js` shorthand expands to this full tag; the registry's js-yaml schema
 * registers exactly `tag:yaml.org,2002:js`).
 */
export const COMPOSITION_JS_TAG = 'tag:yaml.org,2002:js';
/** Structural check: one YAML mapping node (an entry record). */
function toEntry(node) {
    return isMap(node) ? node : undefined;
}
/** Structural check: one YAML sequence node (an entry list). */
function toEntryList(node) {
    return isSeq(node) ? node : undefined;
}
/**
 * The value node of one named field of an entry mapping (undefined when the
 * field is absent). Operates on the NODE (the tag matters — a `!!js` scalar
 * is not a plain value).
 */
function fieldNode(entry, key) {
    for (const pair of entry.items) {
        if (isScalar(pair.key) && pair.key.value === key) {
            return pair.value ?? undefined;
        }
    }
    return undefined;
}
/**
 * The disabled-state of one `disabled` node (the Loader's own reading,
 * mirrored): a `!!js` scalar is a conditional (it only evaluates at a mount);
 * a plain scalar disables exactly when `Boolean(value)` does; a non-scalar
 * node is not evaluatable (fail-closed: conditional).
 */
function disabledState(node) {
    if (node === undefined || node === null)
        return false;
    if (isScalar(node)) {
        if (node.tag === COMPOSITION_JS_TAG)
            return 'conditional';
        return Boolean(node.value);
    }
    return 'conditional';
}
/**
 * Combine an ancestor group's disabled state with a row's own, the way the
 * Loader walks owning groups: any literal true disables, otherwise any
 * conditional leaves the decision to a mount.
 */
function combineDisabled(outer, own) {
    if (outer === true || own === true)
        return true;
    if (outer === 'conditional' || own === 'conditional')
        return 'conditional';
    return false;
}
/**
 * Walk the entry list (recursing into group rows) and locate the persona
 * row(s). Returns the location, or a typed mismatch (duplicate rows), or
 * `undefined` (no persona row at all).
 */
function locatePersonaRow(seq, inherited) {
    let found;
    for (const item of seq.items) {
        const entry = toEntry(item);
        if (entry === undefined)
            continue;
        const nameNode = fieldNode(entry, 'name');
        const name = nameNode !== null && nameNode !== undefined && isScalar(nameNode) ? nameNode.value : undefined;
        const ownDisabled = disabledState(fieldNode(entry, 'disabled'));
        const disabled = combineDisabled(inherited, ownDisabled);
        if (typeof name === 'string' && name === PERSONA_PLUGIN_MODULE_NAME) {
            if (found !== undefined)
                return 'duplicate';
            found = { entry, disabled };
        }
        // Group rows are structural: their children inherit the combined
        // disabled state (the Loader's group semantics — the persona row may
        // nest inside a group).
        const groupNode = fieldNode(entry, 'group');
        if (groupNode !== null && groupNode !== undefined && isScalar(groupNode) && groupNode.value === true) {
            const children = toEntryList(fieldNode(entry, 'config'));
            if (children !== undefined) {
                const nested = locatePersonaRow(children, disabled);
                if (nested === 'duplicate')
                    return 'duplicate';
                if (found === undefined && nested !== undefined)
                    found = nested;
            }
        }
    }
    return found;
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
export function parsePersonaKindFromCompositionDocument(text) {
    let doc;
    try {
        doc = parseDocument(text);
    }
    catch (error) {
        return fail(`malformed composition document: ${firstLine(String(error.message ?? error))}`);
    }
    if (doc.errors.length > 0) {
        return fail(`malformed composition document: ${firstLine(doc.errors[0].message)}`);
    }
    const root = toEntryList(doc.contents);
    if (root === undefined) {
        return fail('composition document is not an entry list');
    }
    const located = locatePersonaRow(root, false);
    if (located === undefined) {
        return deepFreeze({ kind: 'absent' });
    }
    if (located === 'duplicate') {
        return fail('multiple persona rows in the composition (ambiguous effective persona)');
    }
    if (located.disabled === true) {
        return deepFreeze({ kind: 'absent' });
    }
    if (located.disabled === 'conditional') {
        return fail('the persona row (or an ancestor group) carries a !!js conditional disable — not evaluatable offline');
    }
    // Enabled: the KIND (standard vs complete) is the declared `config.complete`
    // flag — a strict boolean (the upstream persona config shape).
    const configNode = toEntry(fieldNode(located.entry, 'config'));
    const completeNode = configNode !== undefined ? fieldNode(configNode, 'complete') : undefined;
    if (completeNode === undefined) {
        return deepFreeze({ kind: 'standard' });
    }
    if (completeNode === null) {
        return fail('config.complete is null');
    }
    if (isScalar(completeNode)) {
        if (completeNode.tag === COMPOSITION_JS_TAG) {
            return fail('config.complete is a !!js expression — not evaluatable offline');
        }
        if (completeNode.value === true)
            return deepFreeze({ kind: 'complete' });
        if (completeNode.value === false)
            return deepFreeze({ kind: 'standard' });
        return fail(`config.complete is not a boolean (got ${JSON.stringify(completeNode.value)})`);
    }
    return fail('config.complete is not a scalar');
}
function fail(reason) {
    return deepFreeze({ kind: 'unresolved', reason });
}
function firstLine(text) {
    return text.split('\n')[0] ?? text;
}
//# sourceMappingURL=persona-composition.js.map