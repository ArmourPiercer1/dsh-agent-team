# A3 dispatch brief — Static Operation Permission Resolver (alpha.2)

You are implementing A3 (the pure static resolver) of the 0.1.1-alpha.2 plan.
Read first (mandatory, in this order):
1. docs/ROUTER_RULES.md
2. docs/TEST_METHODS.md
3. docs/plans/active/0.1.1-alpha.2-detailed-development-plan.md — sections 3, 4, 6, 8 (A3), 10.2 (how your output is consumed by A5), 13 (test layers).

## Your task

Worktree: .worktrees/alpha2-a3 (branch task/alpha2-a3-static-resolver), based on int/alpha2-permission tip AFTER A1+A2 are merged. You are the single writer on that worktree. Deliver the PURE static resolver that maps (a permission policy, a canonical operation, already-canonicalized rules) to a decision. NO I/O, no fs, no control plane, no upstream imports beyond the two in-repo modules below.

Deliverable files:
- packages/runtime/operation-permission/permission-resolver.ts — the resolver.
- packages/runtime/operation-permission/index.ts — ADD the resolver exports to the existing barrel (do not disturb A2's existing exports).
- packages/runtime/test/a3-permission-resolver.test.ts — the focused test suite (plain-node runner, vitest-compatible imports like the existing runtime tests).
- If you add NO new top-level dir, tsconfig.build.json needs NO change (operation-permission is already included).

## Verified import surfaces (do not re-derive)

A1 (already on int) — import from '../../domain/blueprint/src/index.js':
- types: TemplatePermissionPolicy, PermissionRule, PermissionResource, PermissionTool
- constants: PERMISSION_TOOL_NAMES, PERMISSION_POLICY_DEFAULTS ('ask'|'deny'), PERMISSION_RESOURCE_KINDS
- policy shape: { default: 'ask'|'deny'; allow: readonly PermissionRule[]; ask: readonly PermissionRule[]; deny: readonly PermissionRule[] }
- a rule: { tool: PermissionTool; resource: {kind:'exact'; path:string} | {kind:'any'} }
- NOTE: policy + rules arrive ALREADY normalized (declaration order, exact.path trimmed). You never re-normalize; you match.

A2 (already on int) — import from './types.js' and './canonical-operation.js' (same dir):
- type CanonicalOperation { tool: PermissionTool; resource: { kind:'file'|'tool'; key:string; display:string }; fingerprint: string }
- const BASH_TOOL_RESOURCE_KEY: string (the bash tool-level resource key)
- const FILE_PERMISSION_TOOL_VALUES, PERMISSION_TOOL_VALUES
- function classifyPermissionTool(name: string): PermissionToolClass  // {kind:'file',tool} | {kind:'tool-level',tool} | {kind:'unsupported'}
- For a file tool, operation.resource.kind === 'file' and resource.key is the opaque canonical file key (e.g. a realpath-like string). For bash, operation.resource.kind === 'tool' and resource.key === BASH_TOOL_RESOURCE_KEY.

## The resolver contract (plan §8)

```ts
resolveOperationPermission(
  policy: TemplatePermissionPolicy,
  operation: CanonicalOperation,
  canonicalRules: CanonicalRules,   // see below
): PermissionDecision
```

```ts
type PermissionDecision = {
  decision: 'allow' | 'ask' | 'deny'
  provenance: {
    source: 'rule' | 'default'
    effect: 'allow' | 'ask' | 'deny'
    lane?: 'allow' | 'ask' | 'deny'
    ruleIndex?: number
  }
}
```

### canonicalRules (the input normalization A5 performs, A3 consumes)

A3 matches a rule's resource against the operation's canonical key. To keep A3 PURE (no path resolution), define the input as the policy's rules with each `exact.path` ALREADY replaced by its canonical key (A5 canonicalizes every exact rule once, via the same injected resolver it uses for operations, and passes the result in). Model it as:

```ts
type CanonicalRule = {
  tool: PermissionTool
  resource: { kind: 'exact'; key: string } | { kind: 'any' }
}
type CanonicalRules = {
  allow: readonly CanonicalRule[]
  ask: readonly CanonicalRule[]
  deny: readonly CanonicalRule[]
}
```

A3 never resolves paths. It receives canonical keys and compares. (Document this contract at the top of permission-resolver.ts so A5 knows exactly what to pass.)

### Matcher (plan §8.2) — FROZEN

- exact: rule.resource.key === operation.resource.key  (string equality on the opaque keys; NO case folding, NO startsWith, NO path parsing)
- any: rule.tool === operation.tool  (whole tool; no resource identity)
- NO subtree matcher in alpha.2 (plan cut rule / §8.2). If you are tempted, stop — it is not in scope.

### bash rules (recorded ruling — put it in the module doc + a test)

- A bash operation has resource.kind 'tool', key BASH_TOOL_RESOURCE_KEY.
- A bash rule with resource any matches the bash operation (tool match). A bash rule with resource exact NEVER matches a bash operation (an exact key is a file key and can never equal the tool-level key) — so exact-path bash rules are inert by construction. This is how plan §4's "no positive parameter-level allow for bash" is enforced by the matcher, not the schema.
- A bash rule matches in ANY lane (allow/ask/deny); the frozen priority below decides the outcome. An allow-lane bash rule therefore yields a whole-tool allow for bash. (A1's schema accepts bash in the allow lane; this is the documented consequence. Do not add a bash-specific special case beyond the exact-never-matches rule.)
- A file rule (read/write/edit/lsp/read_image) NEVER matches a bash operation and vice-versa (tool names differ).

### Resolution (plan §8.3) — FROZEN

Collect ALL matching rules across the three lanes. Then:
- if any matching rule is in the deny lane -> decision 'deny'
- else if any matching rule is in the ask lane -> 'ask'
- else if any matching rule is in the allow lane -> 'allow'
- else -> policy.default (with provenance source 'default', effect = policy.default)

Provenance:
- When a rule decides: source 'rule', effect = decision, lane = the lane of the winning rule, ruleIndex = the index of that rule WITHIN its lane array (0-based). When multiple rules in the SAME winning lane match, report the FIRST matching index in declaration order (deterministic). When deny wins and there are also matching ask/allow rules, provenance points to the deny lane (the deciding lane), first matching deny index.
- When the default decides: source 'default', effect = policy.default, lane/ruleIndex omitted (undefined).

### Unsupported tools

A3 is only ever called with a CanonicalOperation (a supported tool). You do NOT classify tool names here — A5 uses A2's classifyPermissionTool before calling A3. But if you defensively receive a CanonicalOperation, operate on its .tool/.resource as given. Do not import classifyPermissionTool into the resolver (keep it pure over the canonical identity).

## Tests (plan §8.4 minimum, plain-node runner; follow existing runtime test import style)

Build small CanonicalOperation + CanonicalRules fixtures directly (no fs, no A2 canonicalizeOperation call needed — construct the CanonicalOperation literal, since A3 is pure over the identity):
- allow exact (one allow rule, key equal) -> allow, provenance {source rule, effect allow, lane allow, ruleIndex 0}
- ask exact (ask rule key equal, no deny/allow) -> ask
- deny exact (deny rule key equal) -> deny
- any allow / any ask / any deny (resource any, tool match)
- deny > ask > allow: same operation matched by an allow rule, an ask rule AND a deny rule -> deny (provenance lane deny)
- ask > allow: matched by allow + ask, no deny -> ask
- no match + default ask -> ask (source default, effect ask, no lane)
- no match + default deny -> deny (source default, effect deny, no lane)
- same canonical key, different display -> SAME decision (display is not authority): two ops identical key, different display strings -> identical decision
- different canonical key (different file) -> no match (falls to default)
- bash: rule {tool bash, any} in ask lane + bash op -> ask; in deny lane -> deny; in allow lane -> allow (whole-tool). bash op vs an exact read rule -> no match. exact bash rule (key = some file key) vs bash op -> no match (inert).
- file op vs bash rule (any) -> no match (tool differs)
- multiple matching rules in the same lane -> ruleIndex = first declaration index (add two allow rules both matching, assert ruleIndex 0; then a case where the first rule does NOT match and the second does, assert ruleIndex 1)
- determinism: calling twice with the same input yields structurally identical output
- exact.path trimming is NOT A3's job: assert A3 matches on the key as given (pass a key with no whitespace; do not test trimming here — that's A1)

## Build + gate (do exactly this, in order, in your worktree)

1. pnpm install --ignore-scripts
2. Focused: node scripts/run-tests.mjs runtime  (or the narrow runner if the repo script supports a file filter; the runtime package is where your test lives) — capture baseline-vs-after; ZERO new failures (there is a documented pre-existing failure set: 11 domain failures + the d5-instance-contract plain-node abort + a few runtime d1/d2/d3/d5 runner failures — treat any failure NOT in the pre-existing set as yours to fix).
3. pnpm typecheck (all packages) -> exit 0
4. pnpm build + pnpm build:composition; then node scripts/check-artifacts-committed.mjs -> exit 0 (rebuild + COMMIT the changed dist, dist is committed in this repo)
5. If the p4t6 scan count changed (it will, +1 for your new test file): update ONLY the pin value + explanatory comment in packages/testkit/test/p4t6-session-event-scan.test.ts (DEC-1 pattern; the scanner .mjs stays byte-unchanged). Read the current pin and the last explanatory entry first.

## Red lines

- CORE PATCH BUDGET = 0: no references/** edits, no upstream edits, no new deps.
- Do not touch root.ts / agent-bindings.mjs / the control service (A5/A6/A4 territory).
- Do not change A2's existing exports or A1's types.
- No push. Commit source + tests + dist + evidence.
- Evidence: dev/agent-workflow/evidence/alpha2-permission/a3/ (report + baseline/after test logs).
- Working tree must end clean (or with only your committed files).

## Report format (final message)

Structured: commits (hashes), files changed, exact test command + baseline/after numbers, the resolver export surface A5 will import (function name + arg order + return shape, verbatim), any deviations, red-line status.
