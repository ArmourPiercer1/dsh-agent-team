/**
 * Strong validation of a blueprint document (Architecture §5.5).
 *
 * A blueprint must pass WHOLE before it may enter an available catalog
 * (Architecture §5.5: "Blueprint 在进入可用 catalog 前必须整体通过强校验";
 * "不允许部分 Member 解析失败，剩余成员继续登记" — parsing is all-or-
 * nothing: any violation throws and no blueprint is produced).
 *
 * The checks implemented here:
 *
 * - the document is a closed, lossless-JSON record with the frozen top-
 *   level field set (unknown fields fail loudly, `MALFORMED_DTO`);
 * - no legacy-forbidden field (`memberId`) at ANY depth
 *   (`LEGACY_MEMBER_ID_REJECTED`);
 * - `schemaVersion` is stamped and supported
 *   (`SCHEMA_VERSION_UNSUPPORTED` / `SCHEMA_VERSION_MISMATCH`);
 * - identity/revision valid per contracts v1
 *   (`INVALID_BLUEPRINT_ID` / `INVALID_BLUEPRINT_REVISION`);
 * - exactly one complete LeaderTemplate (Architecture §5.3, invariant 13:
 *   the `leader` field is required and the template is "complete" only
 *   with a non-empty `persona`);
 * - MemberTemplate identity unique across the whole blueprint (leader
 *   included);
 * - template references resolvable: every `memberEnvelopes[].templateId`
 *   names a template declared in the same document;
 * - requirements well-formed with unique (domain, name) pairs;
 * - `modelPreference`, when present, is a legal v1 model token — either a
 *   qualified `provider/model` route (split at the first `/`, both sides
 *   non-empty) or a bare model-only shorthand (its provider is inherited
 *   from the deployment default at the runtime); no whitespace / control
 *   characters (`MALFORMED_DTO`, reason `invalid-model-preference`);
 * - mutation envelopes self-consistent (no operation in both allow and
 *   deny);
 * - PolicyState definitions reference only fields that exist in the
 *   document's frozen field set;
 * - quotas legal (positive integers, `maxConcurrent ≤ maxInstances`).
 *
 * The output is a normalized `TeamBlueprintCore` (absent optional fields
 * omitted, string fields trimmed, arrays/records copied). The derived
 * `contentHash` and the deep freeze happen in `parseBlueprint` (below).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/validate
 */
import type { RemoteSafeRecord } from '../../../contracts/src/index.js';
import type { TeamBlueprint, TeamBlueprintCore } from './types.js';
/**
 * One parsed `modelPreference` token (the strict v1 grammar).
 *
 * - `provider` — the qualified route's provider (ABSENT for a model-only
 *   token: its provider is inherited from the deployment default's
 *   `staticModel.provider` at the runtime derivation site);
 * - `model` — the model id (a qualified token keeps everything after the
 *   first `/`, further slashes included — e.g. an `openrouter` catalog id
 *   `openrouter/meta/llama-x` = provider `openrouter`, model
 *   `meta/llama-x`).
 */
export interface ParsedModelPreferenceToken {
    readonly provider?: string;
    readonly model: string;
}
/**
 * The strict v1 `modelPreference` token grammar (the Blueprint strong
 * validation's parser — the runtime model layer keeps a documented mirror,
 * `parseModelPreferenceToken` in
 * `@dsh-agent-team/runtime/agent-setup/model/route`, because the runtime
 * cannot import this domain module into the model layer; ONE grammar, two
 * mirror sites, both pure):
 *
 * - a non-empty token with NO whitespace and NO control characters;
 * - a QUALIFIED route `provider/model` splits at the FIRST `/`: the
 *   provider is the non-empty prefix, the model the non-empty suffix
 *   (further `/` belong to the model string);
 * - a MODEL-ONLY token (no `/`) names a model whose provider is resolved
 *   at the derivation site (the deployment default stands in).
 *
 * Malformed tokens (empty, whitespace anywhere — e.g. `provider /model`
 * or `provider/ model` — control characters, a missing provider
 * (`/model`) or model (`provider/`)) yield `undefined`.
 *
 * @param value - the trimmed token (the field reader trims; the check
 *   still re-verifies the interior, where trimming cannot reach).
 * @returns the parsed token, or `undefined` when malformed.
 */
export declare function parseModelPreferenceToken(value: string): ParsedModelPreferenceToken | undefined;
/**
 * Validate a decoded blueprint frontmatter value into a normalized
 * `TeamBlueprintCore`.
 *
 * @param raw - the unknown decoded frontmatter value.
 * @returns the normalized (not yet frozen, not yet hashed) blueprint.
 * @throws `TeamContractError` for every rule violation (see module docs).
 */
export declare function validateBlueprintDocument(raw: unknown): TeamBlueprintCore;
/**
 * Parse a blueprint source document into a validated, normalized,
 * deeply-frozen `TeamBlueprint` with its derived content hash.
 *
 * Pipeline: frontmatter split → YAML decode → whole-document strong
 * validation → content hash derivation → deep freeze. All-or-nothing:
 * any violation throws `TeamContractError` and no blueprint is returned.
 *
 * @param source - the raw UTF-8 blueprint document text.
 * @returns the immutable `TeamBlueprint`.
 * @throws `TeamContractError` with a closed-code for every violation.
 */
export declare function parseBlueprint(source: string): TeamBlueprint;
/**
 * The lossless-JSON hashable projection of a validated blueprint core:
 * every semantic field present, absent optional single fields as explicit
 * `null`, normalized to plain values. This projection — canonicalized by
 * contracts `canonicalJsonStringify` (key-sorted) — is what the content
 * hash binds to, so the content identity is independent of formatting,
 * field order, and the derived hash itself.
 */
export declare function toHashableBlueprint(core: TeamBlueprintCore): RemoteSafeRecord;
//# sourceMappingURL=validate.d.ts.map