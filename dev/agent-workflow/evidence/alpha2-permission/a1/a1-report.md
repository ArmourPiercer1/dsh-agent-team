# A1 (alpha.2) — blueprint `capabilities.permissions` schema — task report

- **Task**: alpha.2 A1 (Permission Schema), plan `docs/plans/active/0.1.1-alpha.2-detailed-development-plan.md` §6 (authoritative), §2/§3/§5/§14/§17.
- **Worktree / branch**: `.worktrees/alpha2-a1` @ `task/alpha2-a1-permission-schema`, base `3aa6838`.
- **Commit**: `1d3a5cf` — "A1 alpha.2: blueprint capabilities.permissions schema (default ask|deny, exact/any rules, deny>ask>allow lanes)" (code + tests + rebuilt dist, 21 files).
- **Environment**: Windows + PowerShell, node v24.20.0, pnpm 11.7.0. `pnpm install --ignore-scripts` once on the fresh worktree (1m 04s).
- **RED LINES honored**: edits confined to `packages/domain/**` (src + testdata + test), the two testkit count-pin files (see deviations), the rebuilt `packages/runtime/dist/packages/domain/blueprint/**` install-surface mirror, and this evidence dir. No `references/**`, no upstream, no new dependencies, no git push. No control/live/UI code read or designed for (plan §14 A1 boundary).

## 1. What was done

### 1.1 Types (`packages/domain/blueprint/src/types.ts`)

New vocabulary (all exported from the package index):

- `PermissionTool = 'read' | 'read_image' | 'write' | 'edit' | 'lsp' | 'bash'`
- `PermissionResource = { kind: 'exact'; path: string } | { kind: 'any' }`
- `PermissionRule { tool: PermissionTool; resource: PermissionResource }`
- `TemplatePermissionPolicy { default: 'ask' | 'deny'; allow: readonly PermissionRule[]; ask: readonly PermissionRule[]; deny: readonly PermissionRule[] }`

`TemplateCapabilities` gains `readonly permissions?: TemplatePermissionPolicy` beside the four alpha.1 fields (`teamTools` / `builtinToolDeny` / `skills` / `mcp`). Absent `permissions` ⇒ no parameter-level permission semantics at all (legacy/alpha.1, completely unchanged). `subtree` deliberately NOT added (plan §6.2: not a release blocker).

The generic `TemplatePolicy.values['permissions']` cell and the generic policy resolver were NOT touched (plan §3) — this is a Blueprint capabilities field validated in the blueprint domain only.

### 1.2 Schema closed sets (`packages/domain/blueprint/src/schema.ts`)

- `PERMISSION_TOOL_NAMES` = the six tool names (order: read, read_image, write, edit, lsp, bash).
- `PERMISSION_POLICY_DEFAULTS` = `['ask', 'deny']` (`allow` rejected).
- `PERMISSION_RESOURCE_KINDS` = `['exact', 'any']`.
- `PERMISSION_POLICY_FIELDS` = `['default', 'allow', 'ask', 'deny']`.
- `PERMISSION_RULE_FIELDS` = `['tool', 'resource']`.
- `PERMISSION_PATH_MAX_LENGTH` = 1024 (mirrors contracts `WORKSPACE_PATH_MAX_LENGTH`; the path stays an opaque string — canonicalization is A3's public-seam job).
- `BLUEPRINT_CAPABILITIES_FIELDS` extended with `permissions` (appended; the list is membership-only, order is presentation).

### 1.3 Validation (`packages/domain/blueprint/src/validate.ts`)

`validateTemplateCapabilities` now reads the optional `permissions` record (via the existing `takeRecord` helper, so `permissions: null` is rejected like any other null-on-optional field) and routes it through three new fail-closed validators. All errors are `MALFORMED_DTO` `TeamContractError`s with a `path`-scoped message and `details` (`path` / `unknownFields` / `extraFields` / `maxLength`), in the exact style of the alpha.1 capability validation:

- `validatePermissionPolicy`: closed field set (unknown fields on the policy reject); `default` REQUIRED and ∈ `ask | deny` — a `default` of `allow` (or any other value, or non-string) rejects with an explicit "no silent privilege expansion" message; `allow` / `ask` / `deny` REQUIRED arrays (each may be empty), each item validated as a rule.
- `validatePermissionRule`: closed field set (unknown fields on the rule reject); `tool` REQUIRED and ∈ the six closed names; `resource` REQUIRED.
- `validatePermissionResource`: closed kind vocabulary (`subtree` rejects); `exact` = exactly `kind` + `path` (any other field rejects); `path` must be a non-empty string (control chars rejected, ≤ 1024 chars) and is TRIMMED on normalization (repo string-field convention; empty-after-trim rejects); `any` must be BARE — no `path`, no other field (violations report `extraFields`).

### 1.4 Deterministic normalization — the exact definition (pinned by tests)

> **Rules are kept in declaration order — no reordering, no de-duplication, no cross-lane movement.** Duplicate rules are legal and preserved (a lane may contain the same rule twice; the same rule may sit in two lanes). `exact.path` is trimmed (repo-wide string-field normalization). The normalized policy is a fresh plain copy (deep-frozen by `parseBlueprint`) whose shape, key set, and array ordering are a **pure function of the source document** (modulo YAML key order of objects, which the canonical JSON sort already neutralizes).

Consequences pinned by the A1 suite:

1. Same source, re-parsed ⇒ structurally identical policy (`toEqual`) and identical `contentHash`.
2. Shuffled YAML object-key order (lanes permuted, `resource` before `tool`) ⇒ identical normalized policy and identical `contentHash`.
3. Swapped rule declaration order ⇒ different `contentHash` (arrays keep source order in the canonical projection).
4. A rule moved between lanes ⇒ different `contentHash`.

### 1.5 Content hash (`validate.ts` projection; `hash.ts` untouched)

`toHashableTemplate`'s capabilities projection was refactored into `toHashableCapabilities`:

- `permissions` ABSENT ⇒ the `permissions` key is **omitted** from the projection ⇒ legacy/alpha.1 blueprints hash **byte-identically** to before A1 (verified: the caps projection key set is exactly the four legacy keys).
- `permissions` PRESENT ⇒ the key is added: `{ default, allow: [...], ask: [...], deny: [...] }` with each rule projected as `{ tool, resource }` (`{ kind: 'any' }` bare, `{ kind: 'exact', path }`), lanes in declaration order.

`hash.ts` needed no change (it hashes the canonical projection). `parse.ts` needed no change (YAML mechanics only).

### 1.6 Exports (`packages/domain/blueprint/src/index.ts`)

Added to the package index (existing conventions — value constants + type-only re-exports): `PERMISSION_TOOL_NAMES`, `PERMISSION_POLICY_DEFAULTS`, `PERMISSION_RESOURCE_KINDS`, `PERMISSION_RULE_FIELDS`, `PERMISSION_POLICY_FIELDS`, `PERMISSION_PATH_MAX_LENGTH` (values) and `PermissionResource`, `PermissionRule`, `PermissionTool`, `TemplatePermissionPolicy` (types). The pre-existing export surface was otherwise untouched (`AllowEntry` / `DenyEntry` / `TemplateCapabilities` were already non-exported before A1 and remain so).

### 1.7 Fixtures (`packages/domain/blueprint/testdata/fixtures.ts`)

- Valid sources: `PERMISSION_SOURCE_ASK` (all three lanes, exact + any), `PERMISSION_SOURCE_DENY`, `PERMISSION_SOURCE_NO_POLICY` (capabilities without permissions), `PERMISSION_SOURCE_ASK_KEY_SHUFFLED` (same content, shuffled YAML key order), `PERMISSION_SOURCE_DUPLICATES` (same rule twice in `allow` + once in `ask`), `PERMISSION_SOURCE_BASH_ANY` (plan §4 minimal shell permission).
- 16 new `NEG_PERMISSION_*` fixtures (each a full document violating exactly one rule): default allow / missing / non-string; missing lane; non-array lane; unknown field on policy / rule / exact-resource; rule missing tool / resource; unknown tool; unknown kind (`subtree`); exact missing / empty path; any with path / with extra field. All registered in `NEGATIVE_FIXTURES` (31 → 47).

### 1.8 New test suite (`packages/domain/test/a1-permission-policy.test.ts`, 38 tests)

Covers the plan §6.5 minimum 1:1 plus extras:

| plan §6.5 case | pinned by |
| --- | --- |
| legacy Blueprint parses | "legacy blueprint parses with no capabilities at all" |
| permissions omitted works | "capabilities WITHOUT permissions parse" + hashable-projection key-set pin |
| default ask parses | "default: ask parses into the normalized policy (deep-frozen)" |
| default deny parses | "default: deny parses" |
| default allow rejects | "default: allow rejects" (+ details.path) |
| unknown field rejects | policy / rule / resource-level rejections (3 fixtures, details checked) |
| unknown tool rejects | "an unsupported tool rejects" (+ details.path) |
| exact without path rejects | "exact without a path rejects" (+ empty-path, extra-field variants) |
| any with path rejects | "any with a path rejects" (+ extra-field variant) |
| hash changes when permissions change | add / change / remove / lane-move cases |
| duplicate normalization deterministic | 3-test describe (declaration order kept, pure-function re-parse, reorder ⇒ different hash) |

Extras: member-template permissions (per-template scope), path-trim normalization, bash-any minimal permission, path max-length rejection, export-surface pins for A3/A5 (the six tool names, defaults, kinds, closed field sets).

## 2. Test summary (plain-node runner `node scripts/run-tests.mjs`, repo standard)

| run | command | result |
| --- | --- | --- |
| domain focused (BASELINE, pre-change) | `node scripts/run-tests.mjs domain` | 318 passed / 11 failed / 329 total |
| domain focused (AFTER) | `node scripts/run-tests.mjs domain` | **372 passed / 11 failed / 383 total** |
| testkit (BASELINE) | `node scripts/run-tests.mjs testkit` | 123 passed / 1 failed / 124 total |
| testkit (AFTER) | `node scripts/run-tests.mjs testkit` | **124 passed / 0 failed / 124 total** |
| full (BASELINE) | `node scripts/run-tests.mjs` | aborts at the pre-existing `d5-instance-contract` uncaught-`toHaveLength` abort (runtime pkg); per-file results recorded in `baseline-full-tests.txt` |
| full (AFTER) | `node scripts/run-tests.mjs` | identical per-file results (same 14 pre-existing FAIL files/counts, same abort); recorded in `full-tests-after.txt` |

- New: `a1-permission-policy.test.ts` 38/38 PASS; `t2-blueprint-validation.test.ts` 41 → 57 (16 new fixtures) all PASS; p4t6 pin PASS; t6-9 count pin PASS.
- The 11 remaining domain failures are the DOCUMENTED PRE-EXISTING baseline set (alpha.1 hardening evidence `dev/agent-workflow/evidence/alpha1-hardening/focused-tests.txt`: 10× `t1-capability-schema` strict-YAML/shim-matcher/metadata-null + 1× `t2-blueprint-hash` `capabilities: null` projection expectation; also present at vitest: 10 failed / 319 passed). None are touched by A1; A1 adds zero new failures anywhere.
- Cross-check under real vitest (domain pkg, `pnpm --filter @dsh-agent-team/domain test`): 10 pre-existing failures identical; the A1 suite is shim-matcher-clean by construction (only toBe/toEqual used, plus t2-helpers code assertions).

## 3. Build / artifacts

- `pnpm build` (root, `pnpm -r run build`) — all 9 packages Done.
- `pnpm build:composition` — glues + client composition rebuilt; the freshness gate flagged exactly the 13 rebuilt `packages/runtime/dist/packages/domain/blueprint/src/*` mirror files, which are committed in the same commit as the source (repo R131 discipline).
- `node scripts/check-artifacts-committed.mjs` → **exit 0** ("OK: 1056 files; committed install-surface artifacts match the fresh build").
- `pnpm typecheck` (root, all packages) → exit 0.
- Note: `packages/client/composition-shim` content is unchanged by A1 (the rebuilt shim is byte-identical to the committed one — the domain dist mirror is not inlined into the client bundle); the gate confirms.
- Build side-note: `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` shows a working-tree CRLF/LF fluctuation after the rebuild; normalized git content is identical (gate's `git hash-object` with clean filters: no drift) — left unstaged.

## 4. Design decisions

1. **`permissions: null` rejection** — handled by the existing `takeRecord` helper (same rule as every other optional field): an explicit null in the source rejects as `MALFORMED_DTO` ("must be a plain object, got null").
2. **Path trimming** — `exact.path` is trimmed on normalization (repo string-field convention, cf. `takeString` / metadata values); empty-after-trim rejects. This makes `path: "/a.txt "` and `path: "/a.txt"` the same rule — deterministic by construction. A3 receives trimmed paths.
3. **Legacy hash byte-identity** — achieved by OMITTING the `permissions` key from the hashable projection when absent (not by projecting `null`): the canonical JSON of a legacy caps block is byte-identical to the alpha.1 one.
4. **`any` strictness** — `any` may carry no field other than `kind` (the plan says "any 不得携带 path"; the generalization to any other field follows the closed-field-set rule applied everywhere else in the schema). Violations report `details.extraFields`.
5. **Error codes** — all new violations are `MALFORMED_DTO` (the schema-shape code), matching the alpha.1 capability validation; no new contract error codes were introduced (contracts package untouched — red line).
6. **`PermissionResource` named type** — added beyond the plan's inline union so A3/A5 can reference the resource shape by name; exported with the rule/policy/tool types.

## 5. Deviations / forced maintenance edits (outside the strict `packages/domain/**` red line)

The task authorized "the p4t6 pin if required"; two COUNT-PIN files (maintenance edits, DEC-1 pattern — values + comments only, no logic, no scanner changes) were additionally forced by the task's own fixture-growth requirements:

1. **`packages/testkit/test/p4t6-session-event-scan.test.ts`** — the pin was ALREADY stale at baseline `3aa6838` (pinned 642 vs actual 652: ten alpha.1-hardening scannable files merged without recording the increment — same "missed-increment" precedent as the P9-S8/TCM-D4 pin comments). A1 adds one more scannable file (`a1-permission-policy.test.ts`) ⇒ **653**. The pin value was updated 642 → 653 in both assertions; the comment block records the ten missed files and the +1. The scanner `.mjs` is byte-unchanged. All scanned files (including the new one) carry zero denylist vocabulary (quarantine hit set unchanged).
2. **`packages/testkit/test/t6-9-negative-matrix.test.ts`** — the cross-module matrix test pins `NEGATIVE_FIXTURES.length` to 31; registering the 16 new `NEG_PERMISSION_*` fixtures in the shared registry (the repo's established pattern — `t2-blueprint-validation` consumes the same array) makes it 47. Count pin updated 31 → 47 with a comment. No logic change.

Both edits are value/comment-only count maintenance of the same kind the task explicitly authorized for p4t6; no other file outside `packages/domain/**` + its dist mirror + evidence was modified.

## 6. What A3 (resolver) needs to know — exact export surface

Import from the package index `@dsh-agent-team/domain/blueprint` (source path `packages/domain/blueprint/src/index.ts`; the runtime dist mirror at `packages/runtime/dist/packages/domain/blueprint/src/index.js` ships the same surface for live use):

- **Types**: `TemplatePermissionPolicy` (`{ default: 'ask' | 'deny'; allow; ask; deny }`), `PermissionRule` (`{ tool; resource }`), `PermissionResource` (`{ kind: 'exact'; path: string } | { kind: 'any' }`), `PermissionTool` (the six-name union).
- **Constants**: `PERMISSION_TOOL_NAMES: readonly string[]` = `['read','read_image','write','edit','lsp','bash']`; `PERMISSION_POLICY_DEFAULTS = ['ask','deny']`; `PERMISSION_RESOURCE_KINDS = ['exact','any']`; `PERMISSION_POLICY_FIELDS`, `PERMISSION_RULE_FIELDS`; `PERMISSION_PATH_MAX_LENGTH = 1024`.
- **Access pattern**: `blueprint.leader.capabilities?.permissions` / `member.capabilities?.permissions` on a `TeamBlueprint` from `parseBlueprint` (deep-frozen). Absent ⇒ no permission listener (alpha.1 behavior).
- **Normalization guarantees for the resolver**: rules in declaration order; duplicates preserved; `exact.path` trimmed, non-empty, no control chars, ≤ 1024; `any` carries nothing. Same-layer priority FROZEN `deny > ask > allow > default` (plan §6.4) — A1 carries the lanes, A3 resolves them.

## 7. Open questions / notes for the orchestrator

- None blocking. If the frozen documents later want `default: allow` or `subtree`, both are single-line vocabulary edits behind the closed sets pinned here (the A1 tests pin the current vocabulary on purpose).
- The pre-existing 11 domain failures (t1 ×10 + t2-hash ×1) remain open baseline debt from the alpha.1 freeze; A1 intentionally did not touch them (out of A1 scope; "alpha.1 tools/skills/MCP/builtin deny 不回归" is satisfied: all alpha.1 capability tests that passed at baseline still pass).
