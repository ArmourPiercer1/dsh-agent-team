# P1-T2 — Permission capability split note (Class A: fork-only, downstream generic capability)

- **Task:** P1-T2 — 拆出 fork-only permission capability（Class A）
- **Branch:** `task/P1-T2-permission-split` (Team repo worktree `.worktrees/P1-T2`, off master `c61a2f4`)
- **Downstream test worktree:** `.worktrees/P1-T2-permtests` (branch `work/permission-tests` @ `a3ab3199`, object DB of the legacy checkout)
- **Baselines:** upstream `cd5ef8148158c3a752a658978873241fdf8e2bbc` (immutable audit baseline) · legacy fork tip `a3ab31992762c5d6560797eabc7e0885a9320ade` (frozen read-only reference)
- **Date:** 2026-08-29

## 1. Classification declaration

`packages/permission/**` is classified as a **downstream generic capability (fork-only)**, **not** Team mandatory substrate:

1. It is **absent from the upstream baseline** `cd5ef814` entirely (verified below) — upstream ships no permission capability of this kind.
2. Its fork-side content is a self-contained capability (permission Service Definition, rule engine, execution guard) whose own dependency closure resolves entirely against **upstream core packages + vendored Cordis + the three permission packages themselves**. It imports **no Team code** (zero imports, full site-level evidence in `dependency-proof.json`).
3. It **remains independently developable in the downstream host**: the full unit + real-loader composition suite runs green in the downstream fork worktree (`permission-tests.md`).
4. It is **removed from the Team dependency graph**: the vNext Team repo contains **zero** references to the permission packages (scan evidence below). The legacy fork's Team→permission edges stay in the downstream host and are replayed there by P1-T1/P1-T3; vNext Team never imports permission.

Per TaskDoc §11.2 P1-T2, this is the P1-stage acceptance: zero-reference proof + classification declaration. The full "Team builds without permission" build proof is closed by P1-T5/G1.

## 2. Classification basis

### 2.1 Manifest classification (authoritative provenance)

From `dev/agent-workflow/evidence/provenance/file-manifest.json` (470 files, `git diff -M cd5ef814..a3ab3199`), the 43 `packages/permission/**` entries:

| classification | disposition | count |
|---|---|---|
| GENERIC_FORK_CAPABILITY | KEEP | 40 |
| GENERATED_FROM_TEAM | GENERATED_REVERT | 3 |

- All 43 entries are **status A** (added by the fork; none modified from upstream).
- The 3 GENERATED_REVERT files are the machine-maintained `README.i18n.yaml` translation ledgers (one per package) — generated artifacts, reverted, not part of the capability.
- **No permission file is in the MIXED set** (`mixed_hunks` empty for all 43), so no hunk-level routing from `mixed-hunk-report.md` applies to this split.
- Manifest reason (verbatim, applies to all 40): *"Fork permission capability (service definition, rule engine, execution guard): code, tests and docs stay in the downstream fork."*

### 2.2 Absence from upstream baseline

- `git -C <legacy> cat-file -e cd5ef814:packages/permission/permission/package.json` → **not found** (likewise `permission-engine/`, `tool-permission-guard/`). The upstream package inventory at `cd5ef814` (`git ls-tree -r --name-only`) contains no `packages/permission/` path at all.
- Context, not coupling: upstream does ship `packages/interaction/permission-presets` (pre-existing upstream package, unchanged scope) and `packages/experimental/agent-team*` packages. Neither is part of the fork's `packages/permission/**` delta and neither is referenced by it.

### 2.3 Bidirectional dependency table (scan, site-level)

Full structured result: `dependency-proof.json` (forward table with every import site; reverse importer list; reverse-check matrix). Summary:

**Forward — permission → targets (28 source files across the 3 packages):**

| permission package | upstream core targets | vendored targets | permission-internal | external |
|---|---|---|---|---|
| `@deepseek-ai/dsh-permission` (4 files) | dsh-session ×3, dsh-invariants ×1 | cordis ×2, cordis-plugin-loader ×1, cordis-plugin-include ×1 | dsh-permission-engine ×1 (test), self ×1 (test) | vitest, node:fs/promises, node:os, node:path, node:url |
| `@deepseek-ai/dsh-permission-engine` (20 files) | dsh-session ×7, dsh-invariants ×1 | cordis ×2, schemastery ×1 | dsh-permission ×11 (src + tests) | vitest ×9, node:fs/promises ×2, node:os, node:path |
| `@deepseek-ai/dsh-tool-permission-guard` (4 files) | dsh-tools ×5, dsh-session ×3, dsh-invariants ×1, dsh-llm ×2, dsh-agent ×2, dsh-system-prompt ×2, dsh-user-approval ×2 | cordis ×5, schemastery ×1, cordis-plugin-loader ×2, cordis-plugin-include ×1 | dsh-permission ×3, dsh-permission-engine ×3 | vitest, node:fs/promises, node:path, node:url |

- **`permission → Team` imports: 0** (no specifier resolving to `packages/team/**` in any permission source file; `permission_to_team_import_count = 0` in the proof JSON).
- The upstream core targets resolve at identical paths in upstream `cd5ef814` (`packages/core/session`, `packages/core/tools`, `packages/core/agent`, `packages/core/system-prompt`, `packages/llm/llm`, `packages/interaction/user-approval`, `packages/runtime-diagnostics/invariants`) — i.e. every external need of permission is satisfied by the downstream host's upstream baseline + vendored Cordis, with **no fork-side or Team-side input required**.

**Reverse — importers of permission in the legacy fork:**

| permission package | non-permission importers (legacy fork) |
|---|---|
| `@deepseek-ai/dsh-permission` | `packages/team/team-runtime/src/approval-setup.ts:27`, `src/member-setup.ts:20`, `src/rule-layers.ts:16`, `tests/approval-setup.spec.ts:16` |
| `@deepseek-ai/dsh-permission-engine` | `packages/team/team-runtime/src/approval-setup.ts:34`, `tests/permission-enforcement.loader-composition.spec.ts:46` |
| `@deepseek-ai/dsh-tool-permission-guard` | `scripts/gen-tool-catalog.ts:71` (repo-root generator) |

- The legacy dependency direction is **Team → permission** (Team consumes the capability), plus one repo-root catalog generator. No upstream core or other fork package imports permission (reverse-check matrix: `back=false` for every non-permission target).
- **Step-3 finding:** permission→Team imports are **zero**, so no dependency splitting of permission code is required and no legacy code was modified (read-only reference honored). The legacy Team→permission edges are recorded above as the downstream-side resolution point: they remain valid wiring **inside the downstream host** (replayed by P1-T1/P1-T3), while **Team vNext depends on nothing in `packages/permission/**`**.

### 2.4 Team repo zero-reference scan (mandatory test)

Scanned the Team repo worktree `.worktrees/P1-T2` (branch `task/P1-T2-permission-split`) for the three npm package names and the `packages/permission` path string, excluding `.git`, `node_modules`, `references/`, `docs/plans`, `.worktrees/` (and, per task prohibition, the three files not to be read: `docs/ROUTER_RULES.md`, `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml`):

- Files scanned: 24 (content read: 21; the three forbidden files excluded from content reads).
- **Occurrences of the three npm package names: 0.**
- Occurrences of the path string `packages/permission`: **61, all inside four G0 provenance audit files** (`evidence/provenance/file-manifest.json` ×45, `commit-manifest.json` ×10, `file-manifest-verification.md` ×4, `commit-manifest-verification.md` ×2). These are audit records that *catalog* the legacy fork's files/commits — data, not code, config, or dependency references, and not inputs to any Team build.
- **Dependency-level references: 0.**

## 3. "Team can build / characterize without the permission fork package" — argument

1. **Zero references (this task):** the vNext Team repo contains no import, workspace dependency, cordis composition row, config entry, or path reference to any `packages/permission/**` package (§2.4). The Team repo is a workflow/meta repository (no `package.json`, no code) whose only mentions of the permission path are provenance audit data.
2. **Zero reverse need from Team code (downstream):** within the downstream fork, only the legacy `team-runtime` (which is being replaced, not migrated, by vNext) and one repo-root generator consume permission; no upstream core package does (§2.3 reverse). Nothing outside Team's legacy wiring needs the fork package.
3. **Capability self-sufficiency:** permission's own closure is upstream baseline + vendored Cordis (§2.3 forward), so keeping it in the downstream host costs Team nothing and removing it from the Team graph costs permission nothing.
4. **Stage boundary:** the full build-level proof (Team vNext skeleton builds/characterizes without the permission package) is owned by **P1-T5 / G1**; P1-T2 delivers the zero-reference proof + classification, which is complete above.

## 4. Development viability in downstream (tested)

The three permission packages' complete test suites (12 spec files: unit + real-Loader composition for each package) were executed in the downstream fork worktree — see `permission-tests.md` for commands, the install workaround (sandbox piped-spawn EPERM on the root lefthook postinstall → `--ignore-scripts`, safe for this suite), and per-file results.

Observation carried for the host tasks: pnpm reports a pre-existing **dev-only** cyclic workspace dependency between `packages/permission/permission` and `packages/permission/permission-engine` (devDependencies only).

## 5. Evidence index

| artifact | content |
|---|---|
| `dependency-proof.json` | structured bidirectional scan: `permission_to_team_imports` (empty array), per-target site tables, legacy importers, reverse-check matrix, Team repo scan (`team_to_permission_references: 0` + 61 provenance-string hits detail), manifest classification block, scan commands |
| `permission-tests.md` | downstream permission test suite: install + test commands, results, failures (if any) |
| `../provenance/file-manifest.json` | source classification (43 permission entries: 40 KEEP / 3 GENERATED_REVERT, all status A) |
| `../provenance/commit-manifest.json` | 9 of the 39 fork commits touch `packages/permission/**` (fork capability work, content stays downstream per KEEP) |
