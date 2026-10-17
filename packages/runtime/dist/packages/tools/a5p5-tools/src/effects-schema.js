/**
 * `a5p5-tools` Phase 1 — the EFFECT SCHEMA of the Search/Shell tools: a pure
 * derivation from a PARSED argument set (+ the injected realm) to the
 * canonical, fingerprinted `RequestedEffectSet` of the frozen PR0 algebra.
 *
 * READ-TIME CONSUMPTION, NOT A SECOND FACT (INTERFACES-v1.md C-ADM: "接口面
 * … 只读消费；禁第二授权库"): every arm built here is fed through
 * `parseRequestedEffectSet` from `domain/tool-governance` — the closed-set
 * check, the EFFECT↔RESOURCE coupling law (`list` binds a directory, a right
 * must be carried), the dedup/sort/fingerprint canonicalization and the whole
 * problem vocabulary all come from that module. This file manufactures NO
 * algebra, NO identity key and NO digest of its own.
 *
 * THE DERIVATION LAW (what each tool legally claims — and CLAIMS NOTHING
 * ELSE; over-claiming is as illegal as under-claiming):
 *
 *  - `grep`  → tool-invoke(grep)
 *              + list  on a `directory` resource  (the rg tree walk)
 *              + read  on the placement resource  (file contents are matched)
 *  - `glob`  → tool-invoke(glob)
 *              + list  on a `directory` resource  ONLY — glob answers
 *              filenames; it NEVER claims a `read` effect.
 *  - `bash`  → tool-invoke(bash) ONLY — the command text is opaque (law 2 of
 *              `types.ts`; S0 M-07 禁以命令文本预测副作用). Its file/network
 *              reality is bounded by the confined-execution provider at exec
 *              (PR4), so no effect is claimed and NONE may be back-derived.
 *
 * `realmId` is INJECTED by the admission caller and is required — model args
 * carry no realm (law 1 of `types.ts`), so a forged-realm argument set cannot
 * even reach this function, and one forged realm string cannot be parsed as
 * another (realm non-confusion, `resource.ts`).
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/effects-schema
 */
import { parseRequestedEffectSet, } from '../../../domain/tool-governance/src/index.js';
/**
 * Derive the canonical requested effect set of one parsed call.
 *
 * `realmId` comes from the trusted admission context (never from tool args).
 * A malformed realm is a typed refusal inside the frozen problem vocabulary
 * (`field-type` / `empty-string`); every other refusal is the algebra's own —
 * re-pathed under `$.effects` so a reader sees which arm of WHICH tool leg
 * broke the law.
 */
export function deriveToolEffectSet(realmId, parsed) {
    const problems = [];
    if (typeof realmId !== 'string') {
        problems.push({ code: 'field-type', path: '$.realmId', detail: 'the realm id is injected by admission and must be a string' });
    }
    else if (realmId.length === 0) {
        problems.push({ code: 'empty-string', path: '$.realmId', detail: 'the realm id must be non-empty' });
    }
    if (problems.length > 0)
        return { ok: false, problems };
    const realm = realmId;
    const arms = effectArms(realm, parsed);
    const derived = parseRequestedEffectSet(arms);
    if (!derived.ok) {
        return { ok: false, problems: repath(derived.problems) };
    }
    return { ok: true, value: derived.value };
}
function effectArms(realm, parsed) {
    const invoke = { kind: 'tool-invoke', toolName: parsed.tool, resource: null };
    if (parsed.tool === 'bash') {
        // Law 2: the tool itself is the ONLY claimed effect of a shell call.
        return [invoke];
    }
    const walk = {
        kind: 'list',
        // `directory` is manufactured here, never spellable from args: the
        // EFFECT↔RESOURCE coupling law demands it for `list`.
        resource: { realmId: realm, kind: 'directory', canonicalLocator: parsed.target.locator, rights: ['list'] },
    };
    if (parsed.tool === 'glob')
        return [invoke, walk];
    const content = {
        kind: 'read',
        resource: { realmId: realm, kind: parsed.target.placement, canonicalLocator: parsed.target.locator, rights: ['read'] },
    };
    return [invoke, walk, content];
}
function repath(problems) {
    return problems.map((problem) => ({
        ...problem,
        path: problem.path === '$' ? '$.effects' : `$.effects${problem.path.slice(1)}`,
    }));
}
/**
 * The `ParsedTarget` → `canonicalLocator` bridge kept as a named export so the
 * parser tests and the schema tests speak of ONE locator rule (the raw
 * spelling, whitespace included — canonicalization to an OS path is the
 * trusted provider's job at exec, `resource.ts` LOCATOR RULES).
 */
export function targetLocatorOf(target) {
    return target.locator;
}
//# sourceMappingURL=effects-schema.js.map