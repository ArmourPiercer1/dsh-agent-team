/**
 * A3 (alpha.2, plan §8) — the static operation permission resolver.
 *
 * The PURE decision core of the alpha.2 permission pipeline: it maps
 * (a permission policy, a canonical operation, already-canonicalized
 * rules) to a {@link PermissionDecision} — a decision plus its provenance.
 *
 * What this module IS:
 *
 * - PURE and synchronous: no I/O, no `node:` imports, no upstream
 *   `@deepseek-ai/*` imports, no timers, no randomness — the same input
 *   ALWAYS yields a structurally identical output (pinned by test);
 * - a MATCHER over canonical identities: it compares the opaque
 *   `resource.key` strings exactly (plan §8.2) and never resolves paths,
 *   so it is correct for every backend the A2 resolver seam supports
 *   (local realpath-like keys, workspace URIs, file ids — whatever the
 *   injected backend emits);
 * - the frozen same-layer priority (plan §6.4/§8.3):
 *   `deny > ask > allow > policy.default`.
 *
 * What this module deliberately is NOT:
 *
 * - NOT a path resolver: it receives canonical keys (see the
 *   {@link CanonicalRules} contract below) and compares them; the A5
 *   adapter owns ALL path semantics through the A2
 *   {@link import('./types.js').PathTargetResolver} seam;
 * - NOT a tool-name classifier: it is only ever called with an A2
 *   {@link CanonicalOperation} (a supported tool — A5 runs
 *   `classifyPermissionTool` BEFORE this module and `next()`s
 *   unsupported tools without entering the resolver, plan §7.5/§10.2);
 *   it does not import `classifyPermissionTool` and does not classify
 *   names — it operates on `operation.tool` / `operation.resource` as
 *   given;
 * - NOT the control scope (A4: exact allows over the `fingerprint`) and
 *   NOT the pre-execute listener (A5: the agent-scoped
 *   `tools/pre-execute` enforcement);
 * - NOT a `subtree` matcher in alpha.2: the plan cut rule (plan §8.2 —
 *   only `exact` and `any` exist in the A1 vocabulary) makes it out of
 *   scope; no `startsWith`, no path parsing, no case folding — string
 *   equality on opaque keys only.
 *
 * Input contract (who canonicalizes what, and when):
 *
 * 1. `policy` — the A1 {@link TemplatePermissionPolicy} as normalized by
 *    the blueprint domain (declaration order preserved, `exact.path`
 *    trimmed). A3 never re-normalizes; it matches.
 * 2. `operation` — the A2 {@link CanonicalOperation} of the concrete
 *    pre-execute call (A5: `canonicalizeOperation` over the injected
 *    seam; a canonicalization failure fails closed BEFORE A3 is
 *    reached, plan §7.5/§10.2).
 * 3. `canonicalRules` — the policy's rules with every `exact.path`
 *    ALREADY replaced by its canonical key. A5 performs this input
 *    normalization ONCE per agent scope, with the SAME injected
 *    resolver it uses for operations (bound to that agent's session
 *    cwd), and passes the result in:
 *
 *    ```ts
 *    // A1 rule:  { tool, resource: { kind: 'exact', path } | { kind: 'any' } }
 *    // A3 input: { tool, resource: { kind: 'exact', key }  | { kind: 'any' } }
 *    //                where key = await resolveTarget(path)
 *    ```
 *
 *    Lane membership and lane order are preserved exactly (A1's
 *    declaration-order normalization); A3 reads `allow` / `ask` /
 *    `deny` as the three lanes and never merges or reorders them.
 *
 * Matcher (plan §8.2 — FROZEN):
 *
 * - `exact`: the rule's canonical key EQUALS the operation's resource
 *   key (plain string equality on the opaque keys — no case folding, no
 *   `startsWith`, no path parsing). `exact` addresses FILE identities:
 *   it can only match a `kind: 'file'` resource;
 * - `any`: the rule's tool EQUALS the operation's tool (whole tool; no
 *   resource identity).
 *
 * bash (RECORDED RULING — plan §4, "no positive parameter-level allow
 * for bash", enforced by the matcher, not the schema):
 *
 * - a bash OPERATION has `resource.kind 'tool'` and
 *   `resource.key === BASH_TOOL_RESOURCE_KEY` (A2, plan §7.1);
 * - a bash rule with `resource: any` MATCHES the bash operation (tool
 *   match) — the whole tool enters the lane;
 * - a bash rule with `resource: exact` NEVER matches a bash operation:
 *   an `exact` key is a FILE key and can never equal the tool-level
 *   key, so exact-path bash rules are INERT BY CONSTRUCTION — even if
 *   some backend ever emitted a file key string-equal to
 *   `BASH_TOOL_RESOURCE_KEY`, the file-scoped match rule keeps the
 *   operation out of the lane;
 * - a bash rule matches in ANY lane (allow/ask/deny); the frozen
 *   priority below decides the outcome. An allow-lane `any` bash rule
 *   therefore yields a whole-tool ALLOW for bash (A1's schema accepts
 *   `bash` in the allow lane; this is the documented consequence — no
 *   bash-specific special case exists beyond exact-never-matches);
 * - a file rule (read/write/edit/lsp/read_image) NEVER matches a bash
 *   operation and vice-versa (the tool names differ, and the matcher
 *   checks the tool first).
 *
 * Resolution (plan §8.3 — FROZEN):
 *
 * collect ALL matching rules across the three lanes, then
 * `deny → ask → allow → policy.default`.
 *
 * Provenance (plan §8.1):
 *
 * - when a rule decides: `source 'rule'`, `effect` = the decision,
 *   `lane` = the lane of the DECIDING (winning) rule, `ruleIndex` = the
 *   index of that rule WITHIN its lane array (0-based) — when several
 *   rules of the winning lane match, the FIRST matching one in
 *   declaration order (deterministic); when deny wins while ask/allow
 *   rules also match, the provenance points at the DENY lane (the
 *   deciding lane), at the first matching deny index;
 * - when the default decides: `source 'default'`, `effect` =
 *   `policy.default`, and `lane` / `ruleIndex` are OMITTED (undefined).
 *
 * @module @dsh-agent-team/runtime/operation-permission/permission-resolver
 */
/**
 * The static operation permission resolver (plan §8).
 *
 * Pure and synchronous: no I/O, no timers, no randomness — the same
 * `(policy, operation, canonicalRules)` input always yields a
 * structurally identical {@link PermissionDecision}.
 *
 * @param policy - the A1 permission policy (already normalized:
 *   declaration order, trimmed `exact.path`). `policy.default` is the
 *   fallback for a call no rule matches.
 * @param operation - the A2 canonical operation of the concrete call
 *   (opaque `resource.key` + display + fingerprint; A5 canonicalizes
 *   before calling, and fails closed on canonicalization errors).
 * @param canonicalRules - the policy's rules with every `exact.path`
 *   replaced by its canonical key (A5 canonicalizes each exact rule
 *   ONCE with the same injected resolver it uses for operations;
 *   module header documents the full contract).
 * @returns the decision + provenance: frozen priority
 *   `deny > ask > allow > policy.default`; rule provenance names the
 *   DECIDING lane and the first matching rule index in declaration
 *   order; default provenance omits `lane`/`ruleIndex`.
 */
export function resolveOperationPermission(policy, operation, canonicalRules) {
    // plan §8.3 (FROZEN): collect all matching rules across the three
    // lanes, then deny > ask > allow > policy.default.
    const denyIndex = firstMatchingIndex(canonicalRules.deny, operation);
    const askIndex = firstMatchingIndex(canonicalRules.ask, operation);
    const allowIndex = firstMatchingIndex(canonicalRules.allow, operation);
    if (denyIndex !== undefined) {
        return ruleDecision('deny', denyIndex);
    }
    if (askIndex !== undefined) {
        return ruleDecision('ask', askIndex);
    }
    if (allowIndex !== undefined) {
        return ruleDecision('allow', allowIndex);
    }
    return {
        decision: policy.default,
        provenance: {
            source: 'default',
            effect: policy.default,
        },
    };
}
/**
 * One matching rule in its winning lane → the rule provenance:
 * `source 'rule'`, `effect` = the decision (= the lane), `lane` = the
 * deciding lane, `ruleIndex` = the first matching index in declaration
 * order (plan §8.1).
 */
function ruleDecision(lane, ruleIndex) {
    return {
        decision: lane,
        provenance: {
            source: 'rule',
            effect: lane,
            lane,
            ruleIndex,
        },
    };
}
/**
 * The FROZEN matcher (plan §8.2) — string equality on opaque keys only:
 *
 * - the tool must match first (a file rule never matches a bash
 *   operation and vice-versa — the tool names differ);
 * - `any`: the whole tool (no resource identity);
 * - `exact`: the rule's canonical key EQUALS the operation's resource
 *   key (no case folding, no `startsWith`, no path parsing). `exact`
 *   addresses FILE identities — it matches only a `kind: 'file'`
 *   resource. This is the recorded bash ruling made structural: an
 *   `exact` key is a file key and can never equal the tool-level key
 *   (`BASH_TOOL_RESOURCE_KEY`), so an exact-path bash rule is inert by
 *   construction (plan §4: no positive parameter-level allow for
 *   bash — enforced by the matcher, not the schema).
 */
function ruleMatches(rule, operation) {
    if (rule.tool !== operation.tool) {
        return false;
    }
    if (rule.resource.kind === 'any') {
        return true;
    }
    if (operation.resource.kind !== 'file') {
        return false;
    }
    return rule.resource.key === operation.resource.key;
}
/**
 * The index of the FIRST rule in the lane (declaration order) that
 * matches the operation — deterministic provenance input (plan §8.1).
 * `undefined` when no rule of the lane matches.
 */
function firstMatchingIndex(lane, operation) {
    for (let i = 0; i < lane.length; i++) {
        const rule = lane[i];
        if (rule !== undefined && ruleMatches(rule, operation)) {
            return i;
        }
    }
    return undefined;
}
//# sourceMappingURL=permission-resolver.js.map