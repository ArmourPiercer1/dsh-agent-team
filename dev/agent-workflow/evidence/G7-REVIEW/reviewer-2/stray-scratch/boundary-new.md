=== boundary-checks.log — G7 blind review N=2 (reviewer-2) — REGENERATED (supersedes earlier draft whose [3] section had a pathspec fault that let doc files into the scan window)
generated: 2026-08-31T10:35+08:00 (approx)
git rev-parse --show-toplevel => D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G7-2
git rev-parse HEAD => 298d6364d2ebcb03eff0073c352e2174b0fd433f
BASE (P7 start point per brief) = 673260198e2f90474678087fa7518bdd241403b8 (verified: commit, ancestor of HEAD; 11 commits in range)

Blinding note: an earlier draft of this log contained a few incidental lines from dev/agent-workflow/SESSION_ROUTER_LOG.md that leaked in via a faulty git-grep pathspec. The file was NEVER opened; no content of it is cited anywhere in this review. Those lines referred to an EARLIER gate (G6), not G7. This regenerated log removes them.

--- [1] owned-boundary: files added/modified under packages/ in BASE..HEAD (94) ---
__OWNED_FILES__

--- [1b] owned-boundary classification (all 94 classified) ---
T1 packages/runtime/compatibility/**:
  A compatibility/blueprint.ts, drift.ts, errors.ts, index.ts, probe.ts, types.ts (6 src)
  A test/p7t1-helpers.ts, p7t1-ack-fingerprint.test.ts, p7t1-cold-resume.test.ts, p7t1-inflight-drift.test.ts, p7t1-probe-generation.test.ts (5 test)
T2 packages/runtime/mutation* + policy adapters:
  A mutation/envelope.ts, errors.ts, index.ts, service.ts, types.ts (5 src)
  A policy-adapter.ts (1 src — "policy adapters" per card)
  A test/p7t2-helpers.ts, p7t2-creation-fields/escalation/future-boundary/override-precedence/policy-state/provenance .test.ts (7 test)
T3 packages/runtime/lifecycle*:
  A lifecycle/archive.ts, dispose.ts, errors.ts, index.ts, quiesce.ts, resolve.ts, restore.ts, types.ts (8 src)
  A test/p7t3-helpers.ts, p7t3-archive-running/descendant-drain/dispose-race/restore-no-agent .test.ts (5 test)
T4 packages/runtime/fork* + persistence reconciliation:
  A fork-reconciliation/adapter.ts, errors.ts, index.ts, reconciler.ts, types.ts (5 src)
  A test/p7t4-helpers.ts, p7t4-crash-sidecar/member-fork/ordinary-fork/repeat-reconcile/root-fork .test.ts (6 test)
T5 packages/runtime/handoff*:
  A handoff/errors.ts, index.ts, service.ts, types.ts (4 src)
  A test/p7t5-helpers.ts, p7t5-no-creation-scan.d.mts, p7t5-no-creation-scan.mjs, p7t5-failure-before-root-create/no-creation-scan/snapshot-once/source-mutate/target-inspect .test.ts (7 test)
T6 packages/legacy/teammates-adapter* (+ card 输出物 "adapter + fixtures"):
  A teammates-adapter.ts, teammates-adapter-fs.mjs, teammates-adapter-fs.d.mts (3)
  A test/fixtures/teammates*, teammates-duplicate*, teammates-invalid*, teammates-noleader*, teammates-two-leaders* (12 fixture files)
  A test/p7t6-teammates-adapter.test.ts (1 test)
T7 packages/legacy/session-reader* incl. TEST-ONLY e2e/:
  A session-reader/errors.ts, format.ts, index.ts, inspect.ts, types.ts (5 src)
  A session-reader/e2e/fs-seam.mjs, mini-mcp.mjs, plugin.mjs, run.mjs, ts-loader.mjs (5 e2e harness, .mjs = test-only, excluded from .ts zero-core rule)
  A test/p7t7-helpers.ts, p7t7-integrated-drift-ack/fork-handoff/lifecycle-restore/override-admission .test.ts, p7t7-legacy-read.test.ts, p7t7-mutation-reject.test.ts (7 test)
DEC-1 standing exception:
  M testkit/test/p4t6-session-event-scan.test.ts (count maintenance)
TOTAL: 94/94 classified; every file inside an owned glob of a P7 task card (TaskDoc §11.8) or the DEC-1 exception.
Judgment calls recorded: (a) per-task TEST files are owned by that task's card (each card lists 必须测试/输出物 incl. tests); (b) T6 fixtures under packages/legacy/test/fixtures/teammates* are T6's per its card 输出物 "adapter + fixtures". Neither case is a boundary violation.
No P4-P6 source file modified: all 93 non-DEC-1 entries are A (added); the only M is the DEC-1 p4t6 test.

--- [2] zero-core: node: builtin imports in packages/**/*.ts ---
scan: git grep -n -E "['\"]node:" -- packages (full worktree at HEAD)
result: 0 matches in .ts files. 0 matches in .mjs/.cjs files too (the e2e .mjs harness uses no node: specifiers; see note [2b]).
PASS

[2b] informational: packages/legacy/session-reader/e2e/*.mjs are TEST-ONLY harness scripts (excluded from the .ts rule by the brief). I inspected them as part of the criterion-9 read-only review; they import only relative .ts modules through their own ts-loader and use platform globals; no node: builtin specifiers appear anywhere in packages/.

--- [3] zero-core: patch-package / pnpm patch / postinstall mutation of upstream ---
scan: all 20 tracked package.json files (root + 9 packages + 10 nested/fixture) checked for postinstall|preinstall|prepare|patch-package|pnpm patch
result: only 2 hits, both under scripts/fixtures/zero-core/ — DELIBERATELY-BAD fixtures consumed by the zero-core scanner's own tests:
  scripts/fixtures/zero-core/plugins/bad-plugin-a/package.json: "postinstall": "patch-package"
  scripts/fixtures/zero-core/plugins/bad-plugin-b/package.json: "prepare": node -e "...writeFileSync..."
  Neither is a workspace member (pnpm-workspace.yaml packages: ["packages/*"] only; install scope = 10 projects = root + 9 packages).
patches/ dir: none tracked at repo root. Tracked files matching "patch": 2 inert fixture patch files under scripts/fixtures/zero-core/patches/ (@fixture+host-core@1.0.0.patch, left-pad@1.0.0.patch) + 3 earlier-phase evidence files under dev/agent-workflow/ (names only; not read).
pnpm-lock.yaml at HEAD: no pnpm.patchedDependencies section; no reference to any fixture patch file.
VERDICT: no patch-package / pnpm patch / postinstall mutation of upstream. PASS

--- [3c] lockfile diff BASE..HEAD ---
git diff --stat 673260198e2f90474678087fa7518bdd241403b8..HEAD -- pnpm-lock.yaml => (no changes)
PASS (no dependency change during P7)

--- [3d] package.json diff BASE..HEAD (root + packages/*) ---
git diff BASE..HEAD -- package.json "packages/*/package.json" => (no changes)
PASS

--- [3e] tsc no-op guard: --listFilesOnly .ts input counts (tsc x5 ran on real inputs) ---
packages/contracts : 177 .ts input files
packages/domain : 254 .ts input files
packages/storage : 228 .ts input files
packages/runtime : 457 .ts input files
packages/testkit : 301 .ts input files

--- [4] private-import: references to upstream / frozen legacy fork in packages/**/*.ts ---
scan: git grep -n -E 'deepseek-harness|references/|upstream|legacy-agent-team' -- packages (filtered to .ts)
result: matches exist ONLY in comments/JSDoc:
  contracts/src/ids/common.ts, contracts/src/ids/session-id.ts (doc text "upstream DSH session id"; one @see link to the public github.com/deepseek-ai/deepseek-harness repo),
  contracts/src/legacy-vocabulary.ts (comment), contracts/test/ids.test.ts (test name text),
  domain/policy/src/contracts-mirror.ts, domain/policy/src/validate.ts (comments),
  legacy/session-reader/format.ts:5 (comment: "DSH (evidence: references/deepseek-harness, read-only)"),
  + further comment lines (see raw scan in this session).
No IMPORT statement references upstream internals or the frozen fork.
PASS

--- [4b] external (bare) import specifiers in packages/**/*.ts ---
scan: git grep "from '<letter|@>" across packages/**/*.ts
result: exactly two bare specifiers repo-wide:
  1. vitest (+ vitest/config) — test files and vitest.config.ts only (devDependency, root package.json, declared).
  2. yaml — packages/domain/blueprint/src/parse.ts:34 (production use: blueprint YAML parse).
yaml provenance (my check, not the worker's): declared dep of @dsh-agent-team/domain (packages/domain/package.json dependencies: yaml ^2.9.0); present in pnpm-lock.yaml at BASE 6732601 (pre-P7); lockfile unchanged in BASE..HEAD. => pre-existing P3/P4-era dependency, not a P7 addition, not an upstream mutation.
PASS

--- [4c] deep relative imports (3+ ../ levels) in packages/**/*.ts ---
scan: git grep -n -E '\.\./\.\./\.\./' -- packages (filtered .ts)
result: 63 lines; EVERY target resolves INSIDE packages/ (cross-package intra-repo imports, e.g. packages/domain/blueprint/src/*.ts -> ../../../contracts/src/index.js; packages/testkit/domain/src/scenario.ts -> ../../../domain/blueprint|member, ../../../contracts).
Filter for targets containing references|deepseek|node_modules|agent-workflow: 0 hits.
This is the pre-existing intra-repo relative-import pattern (also present in untouched P3-P6 files); none is host/upstream-directed.
PASS

=== zero-core: PASS | private-import: PASS | owned-boundary: PASS (94/94 classified, see [1b]) ===
