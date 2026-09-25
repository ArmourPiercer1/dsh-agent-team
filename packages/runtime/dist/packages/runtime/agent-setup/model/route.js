/**
 * The pure provider/model ROUTE grammar of the Team model layer — the
 * SINGLE parse site every model consumer shares (dedup of the former
 * `durable-consumption.ts` local `parseModelItem`; the model-blueprint
 * initial-routing fix adds `parseModelPreferenceToken`, the strict v1
 * Blueprint `modelPreference` token check that mirrors the domain
 * strong validation's parser — the runtime cannot import the domain
 * parser into the model layer without inverting the layering, so the
 * two are documented mirrors of ONE grammar, not two dialects):
 *
 * - a QUALIFIED route `provider/model` splits at the FIRST `/`: the
 *   provider is the non-empty prefix, the model is the non-empty suffix
 *   (further `/` belong to the model string — e.g. an `openrouter`
 *   catalog id `openrouter/meta/llama-x`);
 * - a MODEL-ONLY token (no `/`) names a model whose provider is resolved
 *   elsewhere (the Blueprint grammar treats it as a shorthand for the
 *   deployment default's provider; see the Blueprint validation and
 *   `initialTemplateModelGrantOf`).
 *
 * Pure module: no I/O, no live references.
 * @module @dsh-agent-team/runtime/agent-setup/model/route
 */
/**
 * Parse one durable model allow item (`provider/model`, split at the first
 * `/`). Fail-closed: anything that does not parse yields `undefined`
 * (the consumer then refuses to select a model — never guessed).
 * @param item - the durable item string.
 * @returns the parsed selection, or undefined when malformed.
 */
export function parseModelItem(item) {
    const sep = item.indexOf('/');
    if (sep <= 0 || sep === item.length - 1)
        return undefined;
    const provider = item.slice(0, sep);
    const model = item.slice(sep + 1);
    if (provider.length === 0 || model.length === 0)
        return undefined;
    return { provider, model };
}
/**
 * The strict v1 `modelPreference` token check (the defensive mirror of
 * the domain Blueprint strong validation's `parseModelPreferenceToken`).
 *
 * Legal: a non-empty token with NO whitespace and NO control characters,
 * either a bare model (`model-only`) or a qualified `provider/model`
 * route (provider and model both non-empty at the FIRST `/`; further
 * slashes belong to the model).
 *
 * Defensive purpose (Gate B5): even a malformed token that bypassed the
 * Blueprint validator (a synthetic / hand-built template) must fail
 * CLOSED here — `undefined` — never a guessed provider/model and never a
 * silent fallback to the deployment default.
 *
 * @param value - the token (already trimmed by the caller's field reader;
 *   the check re-verifies the interior, where trimming cannot reach).
 * @returns the parsed token, or `undefined` when malformed.
 */
export function parseModelPreferenceToken(value) {
    if (value.length === 0)
        return undefined;
    for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);
        // whitespace class (incl. \u00a0, \u2000-\u200a, \u2028, \u202f,
        // \u3000, BOM) + C0 control range + DEL: any of them makes the token
        // unparseable — a route is a single opaque identifier pair.
        if (code === 0x20 || code <= 0x1f || code === 0x7f || code === 0xa0 || (code >= 0x2000 && code <= 0x200a) || code === 0x2028 || code === 0x2029 || code === 0x202f || code === 0x205f || code === 0x3000 || code === 0xfeff) {
            return undefined;
        }
    }
    const sep = value.indexOf('/');
    if (sep === -1)
        return { model: value };
    if (sep === 0 || sep === value.length - 1)
        return undefined;
    return { provider: value.slice(0, sep), model: value.slice(sep + 1) };
}
//# sourceMappingURL=route.js.map