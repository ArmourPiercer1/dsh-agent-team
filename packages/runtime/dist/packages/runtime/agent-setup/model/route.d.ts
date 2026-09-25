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
import type { ModelSelection } from './types.js';
/**
 * Parse one durable model allow item (`provider/model`, split at the first
 * `/`). Fail-closed: anything that does not parse yields `undefined`
 * (the consumer then refuses to select a model — never guessed).
 * @param item - the durable item string.
 * @returns the parsed selection, or undefined when malformed.
 */
export declare function parseModelItem(item: string): ModelSelection | undefined;
/**
 * One parsed `modelPreference` token (the strict v1 grammar):
 *
 * - `provider` — the qualified route's provider (ABSENT for a model-only
 *   token: the deployment default's provider stands in at the derivation
 *   site);
 * - `model` — the model id (a qualified token keeps everything after the
 *   first `/`, further slashes included).
 */
export interface ParsedModelPreferenceToken {
    readonly provider?: string;
    readonly model: string;
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
export declare function parseModelPreferenceToken(value: string): ParsedModelPreferenceToken | undefined;
//# sourceMappingURL=route.d.ts.map