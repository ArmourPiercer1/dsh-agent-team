/**
 * The SINGLE `modelPreference` token parser for the whole repo (PR #30
 * review-supplement P2-2).
 *
 * Before this module, the strict v1 grammar lived in TWO near-identical but
 * NOT strictly-equivalent sites — the Blueprint strong validation
 * (`validate.ts`, ECMAScript `\s` + a C0/DEL control range) and the runtime
 * model layer (`@dsh-agent-team/runtime/agent-setup/model/route`, a hand
 * -enumerated Unicode whitespace table). The two could drift: an ECMAScript
 * whitespace character the runtime table omitted (e.g. U+1680 OGHAM SPACE
 * MARK) was domain-REJECT but runtime-ACCEPT.
 *
 * The runtime already depends on the domain (`runtime → domain`), so the
 * single parser lives HERE (the domain) and is the one every consumer shares:
 * the Blueprint validator, the runtime `initialTemplateModelGrantOf`
 * derivation, and the legacy importer. ONE grammar, ONE site.
 *
 * Pure module: no I/O, no runtime import, no DSH import, no Blueprint object
 * dependency — a string in, a parsed token (or `undefined`) out.
 * @module @dsh-agent-team/domain/blueprint/model-preference
 */
// ECMAScript `\s` is the whitespace class (WhiteSpace ∪ LineTerminator).
// Relying on `\s` (the spec-defined set) rather than a hand-enumerated code-
// point list is what makes this the one, stable grammar: it rejects the ASCII
// space plus the full spec-defined Unicode whitespace set — e.g. the OGHAM
// SPACE MARK (U+1680), which the old runtime hand-table omitted — with no
// drift risk from re-listing code points.
const WHITESPACE = /\s/;
// Non-whitespace C0 control range + DEL: a route is a single opaque
// identifier pair, so any of these makes the token unparseable.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
/**
 * The strict v1 `modelPreference` token grammar (the ONE parser):
 *
 * - a non-empty token with NO whitespace (ECMAScript `\s`) and NO control
 *   characters (C0 range + DEL);
 * - a QUALIFIED route `provider/model` splits at the FIRST `/`: the provider
 *   is the non-empty prefix, the model the non-empty suffix (further `/`
 *   belong to the model string);
 * - a MODEL-ONLY token (no `/`) names a model whose provider is resolved at
 *   the derivation site (the deployment default stands in).
 *
 * Malformed tokens (empty, whitespace anywhere — e.g. `provider /model` or
 * `provider/ model`, a control character — a missing provider (`/model`) or
 * model (`provider/`)) yield `undefined`.
 *
 * @param value - the token (callers may trim the edges first; the check still
 *   re-verifies the interior, where edge-trimming cannot reach).
 * @returns the parsed token, or `undefined` when malformed.
 */
export function parseModelPreferenceToken(value) {
    if (value.length === 0)
        return undefined;
    if (WHITESPACE.test(value))
        return undefined;
    if (CONTROL_CHARS.test(value))
        return undefined;
    const sep = value.indexOf('/');
    if (sep === -1)
        return { model: value };
    if (sep === 0 || sep === value.length - 1)
        return undefined;
    return { provider: value.slice(0, sep), model: value.slice(sep + 1) };
}
//# sourceMappingURL=model-preference.js.map