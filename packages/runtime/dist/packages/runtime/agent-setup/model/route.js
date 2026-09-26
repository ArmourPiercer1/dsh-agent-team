/**
 * The pure provider/model ROUTE grammar of the Team model layer — the
 * SINGLE parse site for the DURABLE model allow item (`provider/model`)
 * that every durable-model consumer shares (dedup of the former
 * `durable-consumption.ts` local `parseModelItem`):
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
 * The strict v1 Blueprint `modelPreference` TOKEN check
 * (`parseModelPreferenceToken`) is NOT mirrored here — it lives in the
 * SINGLE domain parser (`@dsh-agent-team/domain/blueprint`
 * `model-preference.js`) and is imported directly by the runtime
 * derivation (PR #30 review-supplement P2-2: ONE grammar, ONE site).
 * `parseModelItem` is kept because the durable policy-item entry point
 * (always `provider/model`, both sides non-empty) has DIFFERENT entry
 * semantics from the Blueprint token entry point (`provider/model` OR a
 * bare `model`).
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
//# sourceMappingURL=route.js.map