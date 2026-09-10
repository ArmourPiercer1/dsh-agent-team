# A3 (alpha.2) — static operation permission resolver — task report

Branch: `task/alpha2-a3-static-resolver` (base `28614c5` = int/alpha2-permission tip after A1+A2, worktree `.worktrees/alpha2-a3`). TaskDoc: alpha.2 detailed plan §8 (A3) / §14 (boundary: reads the A1 contract + the A2 canonical identity contract only) / §17 (DoD).

## Deliverables

| Artifact | Path |
| --- | --- |
| Pure static resolver (new module file) | `packages/runtime/operation-permission/permission-resolver.ts` |
| Barrel (A3 exports added, A2 exports untouched) | `packages/runtime/operation-permission/index.ts` |
| Unit spec (plan §8.4 minimum + bash ruling + vocabulary pin) | `packages/runtime/test/a3-permission-resolver.test.ts` (28 tests) |
| p4t6 pin (DEC-1) | `packages/testkit/test/p4t6-session-event-scan.test.ts` 660 → **662** (+2 scannable files; scanner `.mjs` byte-unchanged) |
| Committed dist (rebuilt) | `packages/runtime/dist/packages/runtime/operation-permission/` — 4 modified (barrel) + 4 new (permission-resolver) |

Build wiring: NO `tsconfig.build.json` change needed (`operation-permission` already included since A2).

CORE PATCH BUDGET = 0: zero `references/` edits, zero upstream edits, zero new dependencies. Only in-repo imports: A1 `domain/blueprint` (types only) and A2 `operation-permission` (types only — the resolver module itself is type-import-only; zero value imports at runtime).

## Export surface (verbatim — what A5 imports)

Module: `packages/runtime/operation-permission/index.js`
(dist mirror: `packages/runtime/dist/packages/runtime/operation-permission/index.js`).

```ts
import { resolveOperationPermission } from '../operation-permission/index.js' // or the dist mirror
import type {
  CanonicalRule,
  CanonicalRules,
  PermissionDecision,
  PermissionProvenance,
  PermissionLane,
} from '../operation-permission/index.js'

resolveOperationPermission(
  policy: TemplatePermissionPolicy,        // A1 (domain/blueprint): { default: 'ask'|'deny'; allow/ask/deny: readonly PermissionRule[] }
  operation: CanonicalOperation,           // A2: { tool: PermissionTool; resource: { kind: 'file'|'tool'; key: string; display: string }; fingerprint: string }
  canonicalRules: CanonicalRules,          // A5-built: { allow/ask/deny: readonly CanonicalRule[] }
): PermissionDecision
```

Types (new, exported from the same barrel):

```ts
type CanonicalRule = {
  tool: PermissionTool                     // A1 union (read|read_image|write|edit|lsp|bash)
  resource: { kind: 'exact'; key: string } | { kind: 'any' }
}
type CanonicalRules = {
  allow: readonly CanonicalRule[]
  ask: readonly CanonicalRule[]
  deny: readonly CanonicalRule[]
}
type PermissionLane = 'allow' | 'ask' | 'deny'
type PermissionProvenance = {
  source: 'rule' | 'default'
  effect: PermissionLane
  lane?: PermissionLane                    // omitted (undefined) on the default path
  ruleIndex?: number                       // omitted (undefined) on the default path
}
type PermissionDecision = {
  decision: PermissionLane
  provenance: PermissionProvenance
}
```

A5 input-normalization contract (documented at the top of `permission-resolver.ts`): A5 canonicalizes every `exact` rule ONCE per agent scope with the SAME injected `PathTargetResolver` it uses for operations (bound to that agent's session cwd) and passes the rules in with `exact.path` → `exact.key`; `any` rules pass through unchanged; lane membership + lane order = A1 declaration order. A3 reads ONLY `policy.default` from the policy object — the lanes it matches arrive as `canonicalRules`. A3 never resolves paths, never classifies tool names (A5 runs A2 `classifyPermissionTool` first and `next()`s unsupported tools), and never re-normalizes.

## Semantics implemented (frozen)

- Matcher (§8.2): `any` = tool equality; `exact` = opaque-key string equality, FILE-SCOPED (matches only `resource.kind === 'file'` operations). No case folding, no `startsWith`, no path parsing, no trimming.
- bash (recorded ruling, §4): a bash op has `resource { kind: 'tool', key: BASH_TOOL_RESOURCE_KEY }`; a bash `any` rule matches it in ANY lane (whole-tool allow/ask/deny — an allow-lane bash rule yields whole-tool allow, the documented consequence of A1 accepting `bash` in the allow lane); an exact bash rule NEVER matches (inert by construction — the file-scoped `exact` rule makes this structural even for a degenerate backend whose file key equals `'bash'`; pinned by a dedicated test); file rules never match a bash op and vice-versa (tool names differ).
- Resolution (§8.3): collect all matching rules across the three lanes, then `deny > ask > allow > policy.default`.
- Provenance (§8.1): rule path → `source 'rule'`, `effect` = decision, `lane` = DECIDING lane, `ruleIndex` = first matching index in declaration order within that lane (deny winning over matching ask/allow points at the deny lane, first matching deny index); default path → `source 'default'`, `effect` = `policy.default`, `lane`/`ruleIndex` omitted.

## Test coverage (28 tests, plain-node runner; vitest-compatible imports)

Matcher: allow/ask/deny exact; any allow/ask/deny; any vs different tool; verbatim key equality (no case folding / no startsWith / no path parsing).
Priority: deny>ask>allow (all three lanes matching → deny, provenance lane deny, first matching deny index with a non-matching deny rule before it); ask>allow; allow>default; no match + default ask / default deny (source default, effect = default, lane/ruleIndex omitted).
Identity: same key + different display → identical decision; different key → no match; whitespace-differing key → no match (A3 trims nothing — that is A1).
bash (recorded ruling): any-rule in each lane (ask→ask, deny→deny, allow→allow whole-tool); exact read rule vs bash op → no match; exact bash rule (file key) vs bash op → inert; exact bash rule whose key IS the tool-level key string → still no match; file op vs bash any rule → no match.
Provenance/determinism: two matching allow rules → ruleIndex 0; first-misses-second-matches → ruleIndex 1; same-input double call → structurally identical; fresh-but-equal input objects → structurally identical.
Vocabulary pin (A2 handoff): `PERMISSION_TOOL_VALUES` (A2) deep-equals `PERMISSION_TOOL_NAMES` (A1) — same six names, same order (plan §6.2: the two definitions must never diverge).

## Verification summary

Environment: Windows, pnpm 11.7.0, node v24.20.0, worktree node_modules present (verified at start: `git log --oneline -3` @ 28614c5, `git status` clean).

- `pnpm install --ignore-scripts` — not re-run (node_modules already installed and proven by the baseline run; tree verified clean before start).
- `node scripts/run-tests.mjs runtime` — BASELINE (28614c5 clean) vs AFTER:

  | file | baseline | after |
  | --- | --- | --- |
  | a2-canonical-operation.test.ts | PASS (30) | PASS (30) |
  | **a3-permission-resolver.test.ts** | — (new) | **PASS (28)** |
  | d1-member-base-tools.test.ts | FAIL (3/6) | FAIL (3/6) |
  | d1-s6-remote-v3.test.ts | FAIL (6/14) | FAIL (6/14) |
  | d1-team-ownership-index.test.ts | FAIL (5/16) | FAIL (5/16) |
  | d2-s6-ensure-root-live.test.ts | FAIL (5/10) | FAIL (5/10) |
  | d3-member-identity-context.test.ts | FAIL (1/5) | FAIL (1/5) |
  | d5-instance-contract.test.ts | FAIL (2/9) + process-level abort at line 109 (`toHaveLength`, outside the shim's audited surface) | identical |

  → ZERO new failures; the documented pre-existing failure set is byte-identical (all six failures are shim-surface gaps in the d1/d2/d3/d5 suites, unrelated to this change). Both logs end with the same d5 runner abort, so the plain-node runner prints no final total line in either run — file-level parity above is the comparison.
- `node scripts/run-tests.mjs testkit` — baseline 124/0 (pin 660) → after **124/0 (pin 662)**; `p4t6-session-event-scan.test.ts` PASS (10 tests).
- `pnpm typecheck` (all 9 packages) → **exit 0**.
- `npx eslint` (permission-resolver.ts + index.ts barrel + a3 test + p4t6 test) → exit 0.
- `pnpm build` → exit 0; dist delta = exactly the 8 `operation-permission` files (4 modified barrel + 4 new resolver) — nothing else touched.
- `pnpm build:composition` → exit 0, ending in `[check-artifacts-committed] OK: 1076 files; committed install-surface artifacts match the fresh build` (1072 pre-A3 + 4 new dist files).
- `node scripts/check-artifacts-committed.mjs` — run inside `build:composition` (its final step), exit 0.

## Deviations / notes for A5

1. **File-scoped `exact` matcher** (design decision, documented in the module header): the frozen §8.2 bullet "exact: key === key" is implemented as tool-equality + (any → true; exact → `operation.resource.kind === 'file'` && key equality). The brief's bash ruling states an exact bash rule "NEVER matches" and that the ruling is "enforced by the matcher, not the schema"; the kind check makes that structural (true for every backend, including a degenerate one whose file key happens to equal `BASH_TOOL_RESOURCE_KEY`) instead of relying on backend key disjointness. For all well-formed A2 outputs the kind check is a no-op (file keys are backend identities, never the tool-level key), so the frozen equality semantics are preserved exactly. Pinned by the dedicated test "exact bash rule whose key IS the tool-level key string → still no match".
2. **`PermissionLane` exported** (not in the brief's sketch): the decision/effect/lane union appears in the exported `PermissionProvenance`/`PermissionDecision` signatures, so it must be exported for `declaration: true` (tsc TS4032-class). Additive only.
3. A2's barrel doc was updated in one sentence ("it is NOT the static resolver (A3: …)" → "it IS also the static resolver (A3, plan §8): …") — the module directory now genuinely contains A3; all A2 EXPORTS are byte-identical (verified by the dist delta above).
4. Transient dev script `scripts/dev-a3-edits.ps1` (CRLF-safe exact replacements for the barrel + pin) deleted before commit (A2 precedent). Note for future PS 5.1 work in this repo: a comma inside `@(...)` binds TIGHTER than `+` — `'a' + $x, 'b'` parses as `'a' + ($x, 'b')`; keep array elements plain literals (placeholder-replace after the join).

## Evidence logs (this directory)

`baseline-runtime-runtests.log` + `baseline-testkit-runtests.log` (28614c5, clean tree), `after-runtime-runtests.log` + `after-testkit-runtests.log` (post-A3), `typecheck.log`, `build.log`, `build-composition.log`.
