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
 * - the `subtree` kind (A2C-7, plan §9): the rule carries the root's
 *   canonical key (`rootKey` — PROVENANCE/DEBUG only) and the
 *   OPERATION-RELATIVE containment boolean `containsOperation`, computed
 *   by the A5 adapter with the ONLY legal authority: the pinned public
 *   `FileSystem.contains(rootTarget, operationTarget)` over targets of
 *   the SAME provider (plan §9.4). The matcher consumes the boolean and
 *   NEVER compares `rootKey` against anything (no `startsWith`, no key
 *   equality, no path parsing, no case folding — the containment
 *   judgment is the seam's, fresh per decision (H4));
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
 *    normalization FRESH for EVERY permission decision (H4 — the P1-A
 *    fix: there is no cache — install-lifetime or otherwise — so the
 *    rules carry the same live identity the operation of the same
 *    decision carries), with the SAME injected resolver it uses for
 *    operations (bound to that agent's session cwd, read lazily at
 *    resolve time), and passes the result in:
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
 * for bash" — the A1 SCHEMA is the enforcement point, H2 ruling):
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
 *   operation out of the lane. (The A1 schema additionally REJECTS an
 *   `exact` bash resource in every lane, so such a rule cannot even
 *   enter a legal policy; the inertness is the matcher's structural
 *   defense in depth, not the schema's job.)
 * - the matcher is TOTAL over whatever ruleset it is handed: a bash
 *   `any` rule it receives matches the bash operation in WHICHEVER
 *   lane it sits in, and the frozen priority below decides the
 *   outcome. A LEGAL policy can only carry a bash `any` rule in the
 *   ask or deny lane — the A1 schema rejects a bash rule in the allow
 *   lane entirely (no positive whole-tool bash grant in alpha.2). The
 *   matcher itself is UNCHANGED and keeps no lane special case: it
 *   still answers an allow-lane `any` bash rule with a whole-tool
 *   ALLOW if one is ever handed to it (hand-crafted or legacy-shaped
 *   input) — the a3 suite pins this totalness defensively;
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
import type { PermissionTool, TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js';
import type { CanonicalOperation } from './types.js';
/** One closed permission lane / effect value (the decision vocabulary). */
export type PermissionLane = 'allow' | 'ask' | 'deny';
/**
 * One policy rule AFTER A5's input normalization (module header): the
 * A1 rule's `exact.path` has been replaced by its canonical key (the
 * same resolver the operation went through); the A2C-7 `subtree` rule's
 * path has been canonicalized to its root key AND its containment
 * relation to THIS operation has been computed by the A5 seam (the
 * public `FileSystem.contains` — the only legal authority); `any` rules
 * pass through unchanged. A3 compares the exact key / consumes the
 * subtree boolean — it never sees a raw path and never infers
 * containment from `rootKey`.
 */
export type CanonicalRule = {
    /** The tool this rule gates (closed A1 vocabulary). */
    readonly tool: PermissionTool;
    /** The resource the rule matches, on canonical keys. */
    readonly resource: {
        readonly kind: 'exact';
        readonly key: string;
    } | {
        /** A2C-7 (plan §9) — the subtree root's canonical key.
         *  PROVENANCE/DEBUG equality only: the matcher NEVER compares
         *  it (containment is `containsOperation`, computed by the
         *  A5 seam over the public `FileSystem.contains`). */
        readonly kind: 'subtree';
        readonly rootKey: string;
        /** The OPERATION-RELATIVE containment verdict for THIS decision
         *  (root == operation target OR the operation is a canonical
         *  descendant — the pinned `FileSystem.contains` semantics,
         *  same provider, fresh per decision (H4)). */
        readonly containsOperation: boolean;
    } | {
        readonly kind: 'any';
    };
};
/**
 * The three policy lanes, canonicalized for A3 consumption (A5 builds
 * this from the A1 policy; lane order = declaration order, preserved).
 */
export type CanonicalRules = {
    readonly allow: readonly CanonicalRule[];
    readonly ask: readonly CanonicalRule[];
    readonly deny: readonly CanonicalRule[];
};
/** Where the decision came from (plan §8.1 provenance). */
export type PermissionProvenance = {
    /** `'rule'` = a lane rule decided; `'default'` = no rule matched. */
    readonly source: 'rule' | 'default';
    /** The effect the decision carries (always equal to `decision`). */
    readonly effect: PermissionLane;
    /** The lane of the deciding rule (only when `source === 'rule'`). */
    readonly lane?: PermissionLane;
    /** Index of the deciding rule within its lane array (0-based). */
    readonly ruleIndex?: number;
};
/** The resolver's output (plan §8.1). */
export type PermissionDecision = {
    /** The static decision the A5 pipeline executes on. */
    readonly decision: PermissionLane;
    /** Why the decision was reached (rule + lane + index, or default). */
    readonly provenance: PermissionProvenance;
};
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
 *   FRESH on every decision — no cache (H4) — with the same injected
 *   resolver it uses for operations; the module header documents the
 *   full contract).
 * @returns the decision + provenance: frozen priority
 *   `deny > ask > allow > policy.default`; rule provenance names the
 *   DECIDING lane and the first matching rule index in declaration
 *   order; default provenance omits `lane`/`ruleIndex`.
 */
export declare function resolveOperationPermission(policy: TemplatePermissionPolicy, operation: CanonicalOperation, canonicalRules: CanonicalRules): PermissionDecision;
//# sourceMappingURL=permission-resolver.d.ts.map