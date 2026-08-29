# P1-T1 — Upstream-Clean Downstream Host (Forward Replay Report)

**Task:** P1-T1 (Team vNext P1 phase, 2026-08-29)
**Method:** forward replay of non-Team fork content from pinned upstream — never reverse-deletion from the contaminated branch.
**Result:** CLEAN HOST DELIVERED — replay complete, audits pass, no new failures vs baseline.

## 1. Pinned references

| Role | SHA |
|---|---|
| Upstream baseline (host start) | `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| Fork source (legacy tip, read-only) | `a3ab31992762c5d6560797eabc7e0885a9320ade` |
| Team repo master (evidence base) | `c61a2f48714d418c31b05e2c0d42aa5ecf5db36e` |

- Host worktree: `.worktrees/P1-T1-host` — branch `host/downstream-clean-20260829`
- Evidence worktree: `.worktrees/P1-T1` — branch `task/P1-T1-host-replay`
- Legacy checkout `references/deepseek-harness` used strictly read-only (git object extraction only); no history rewrite, no worktree moves.

## 2. Scope (authoritative: `dev/agent-workflow/evidence/provenance/file-manifest.json`)

| Classification | Files | Disposition applied |
|---|---|---|
| GENERIC_FORK_CAPABILITY | 70 | whole-file replay (fork @ a3ab319) |
| MIXED | 11 | non-Team hunks only (`git diff -U0` hunk routing, 1-based hunk index) |
| TEAM_OWNED / GENERATED_FROM_TEAM | 379 | forbidden in host — **not touched** |
| UNRELATED_FORK_FEATURE | 10 | P1-T3 lane — **not touched** |

Total replayed: **81 files** (70 whole-file + 11 hunk-level), **0 no-ops**.
Per-file mapping: [`replay-mapping.json`](replay-mapping.json) (source_path, source_sha, classification, method, hunks, noop_reason, audit_vs_fork per file).

MIXED hunk routing (applied / skipped, 1-based hunk index into `git diff -U0 cd5ef814 a3ab319 -- <path>`):

| File | Applied | Skipped (Team) | Line filters in dual-kind hunks |
|---|---|---|---|
| `.gitignore` | h1 (21 ignore lines) | — | — |
| `docs/subsystems/README.md` | h2 (permission.md row) | h1 (team.md row) | — |
| `docs/subsystems/README.zh.md` | h2 | h1 | — |
| `packages/core/session/src/known-event-types.ts` | h1 (`'permission/decision'`) | h2–h4 (5 second-gen team events) | — |
| `scripts/gen-cordis-catalog.ts` | h1, h4 | h2, h3 (agent-team views) | h1 kept only `permission: 'permission.md'`; h4 kept the 7 permission TYPE_LINK_EXEMPTIONS lines |
| `scripts/gen-doc-graphs.ts` | h2, h3 | — (h3 dual) | h3 extracted the `key: 'permission',` 9-line GROUP block only |
| `scripts/gen-tool-catalog.ts` | h2, h3, h4, h7 | h1, h5, h6 (tool-team) | h2 kept only the `ToolPermissionGuard` import |
| `scripts/project-doc-site.spec.ts` | h1 (count 46→47) | — | derived value: 46 + 1 permission page (fork's 48 includes team.md) |
| `tsconfig.base.json` | h2 (4 permission aliases), h4, h6 | h1 (`dsh-team/types` alias), h3, h5 | h2 kept only permission aliases |
| `tsconfig.host.json` | h1 (3 permission project refs) | — (partial hunk) | kept only the 3 `packages/permission/*` refs of the 10-line block |
| `website/docs.ts` | h2 (permission page) | h1 (team page) | — |

## 3. Environment & install (recorded steps)

Toolchain: node v24.20.0, pnpm 11.7.0 (matches root `packageManager`), COREPACK_ENABLE_STRICT=0.

| # | Command (worktree `.worktrees/P1-T1-host`) | Result |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | **FAILED** — 1011 packages resolved/added, then lifecycle scripts (koffi, node-pty) died with `Error: spawn EPERM` (errno -4048): the session file sandbox blocks child-process spawns with piped stdio. Log: `tests/01-…-epERM.log` |
| 2 | `pnpm install --frozen-lockfile --ignore-scripts` | **PASS** in 18m07s. Log: `tests/02-…-ignore-scripts.log` |

`--ignore-scripts` rationale: lifecycle-script spawns hit the sandbox named-pipe boundary (EPERM), same class as the pnpm failure. Verified no functional impact — node-pty 1.2.0-beta.15 and koffi 3.1.1 ship in-package prebuilds and **load successfully** (`require('node-pty')` / `require('koffi')` OK from `packages/subprocess/subprocess-local`); esbuild platform binaries present in the pnpm store (`@esbuild/win32-x64` ×3 versions). Upstream's own `patches/node-pty@…patch` + pnpm-workspace `allowBuilds` mechanism untouched.

## 4. Baseline build + test (clean cd5ef814, pre-replay)

| Command | Result | Log |
|---|---|---|
| `pnpm build` | **FAILED (infra)** — entry `tsx scripts/build.ts`: tsx's esbuild service spawn → `Error: spawn EPERM`. No build step executed. | `tests/03-…` |
| `pnpm test` | **FAILED (infra)** — vitest 4.1.8/vite 8.0.16 bundles `vitest.config.ts` via the esbuild service → `spawn EPERM`. No test executed. | `tests/04-…` |
| `pnpm run build:lib` | **PASS** — `tsc -b tsconfig.host.json` + `tsdown` (host face) + `tsc -b tsconfig.client.json` + `tsdown` (client face). tsdown 0.22.2 is rolldown-based (no esbuild service) and tsc is pure JS, so this full library build works in the sandbox. | `tests/05-…` (4083 lines) |

Baseline failure set: `{ pnpm build: esbuild-spawn-EPERM, pnpm test: esbuild-spawn-EPERM }` — both environmental (sandbox), neither executed any test case.

## 5. Replay execution

Engine: deterministic two-pass splicer (validate all 81 files, then write all). Hunk splice honors `git -U0` header semantics (oldCount=0 ⇒ insert after old line `oldStart`; oldCount>0 ⇒ replace `oldStart..oldStart+oldCount-1`). Fail-loud on any line mismatch; applied lines verified verbatim-present in the fork file (fork-faithfulness).

Result: `replay complete: written=81 noops=0 total=81`, exit 0. Full per-file record: `tests/replay-result.json`.

## 6. Post-replay install + lockfile

| Command | Result | Log |
|---|---|---|
| `pnpm install --ignore-scripts` (no frozen lockfile — 3 new workspace packages + `packages/bundle/base` dep addition require re-resolution) | **PASS**. Log: `tests/06-…` |

`git diff --stat pnpm-lock.yaml`: **+368 / -0**. Content check: zero `team` matches in the diff; added entries are exclusively the permission family (importers for `@deepseek-ai/dsh-permission`, `dsh-permission-engine`, `dsh-tool-permission-guard` + their dev-dep resolution: vitest 3.2.7, happy-dom, jsdom, @types/*). Pure dep-resolution delta → included in the host commit.

## 7. Post-replay build + test + failure-set comparison

| Command | Result | Log |
|---|---|---|
| `pnpm run build:lib` | **PASS** — tsc -b host + client and tsdown both faces; all three new permission packages typecheck and bundle (`dsh-permission`, `dsh-permission-engine`, `dsh-tool-permission-guard` each "Build complete"). | `tests/07-…` (4084 lines) |
| `pnpm build` | FAILED — identical `spawn EPERM` (tsx→esbuild) as baseline. | `tests/08-…` |
| `pnpm test` | FAILED — identical `spawn EPERM` (vite→esbuild) as baseline. | `tests/09-…` |

**Set comparison:** post-replay failures `{build: EPERM, test: EPERM}` ⊆ baseline failures `{build: EPERM, test: EPERM}` → **no NEW failures**. The executable check (`build:lib`: full typecheck + bundle of host and client trees) PASSED in both rounds, and the post-replay run additionally compiles the 3 new packages.

> TODO (environmental, skippable local issue): `pnpm test` (vitest) and `pnpm build` (tsx entry, incl. `build:web`/vite) cannot execute in this session's sandbox because the esbuild service requires a piped-stdio child spawn (blocked: `spawn EPERM`, documented sandbox boundary; 3 attempts incl. `ESBUILD_WORKER_THREADS=1` all EPERM). Test-suite execution therefore could not be performed in either round; verification relies on `build:lib` (full tsc + rolldown bundle) plus the static audits below. Not a replay defect — identical in both rounds.

## 8. Diff classification check (script: `p1t1-audit.js` §1)

Command: `git -C .worktrees/P1-T1-host diff -U0 --name-only HEAD` vs scope (81).

- **in-diff-not-in-scope: `[]`** (MUST be empty ✓)
- whitelist used: `pnpm-lock.yaml` — team-ref content check: clean (0 refs)
- diff files: 23 = 22 in-scope tracked modifications + lockfile
- in-scope-no-diff: 59 = **all 59 status-`A` new files, verified present on disk** (untracked ⇒ not in `git diff HEAD`); **true no-ops: 0**

## 9. Per-hunk verification (audit §2)

For every MIXED file, `git diff -U0 HEAD -- <path>` matches the applied-hunk plan exactly (count, oldStart, new lines): **11/11 ok** —

`.gitignore 41+21; docs/subsystems/README.md 47+1; docs/subsystems/README.zh.md 47+1; known-event-types.ts 38+1; gen-cordis-catalog.ts 125+1, 663+7; gen-doc-graphs.ts 86+1, 666+9; gen-tool-catalog.ts 67+1, 162+5, 411+17, 697+1; project-doc-site.spec.ts 453+1; tsconfig.base.json 74+4, 364+2, 512+1; tsconfig.host.json 305+3; website/docs.ts 329+1`

## 10. Zero-Team scan (audit §3)

Formal scan (hard Tier-1 markers: `packages/team/`, `@deepseek-ai/dsh-team*` / `dsh-tool-team` / `dsh-bundle-team` / `dsh-client-ui-team` imports, `dsh-team'`, second-gen event strings `team/control-decision`, `team/control-request`, `team/member-bound`, quoted `'team/message'`/`'team/progress'`, `TeamRegistry`, `TeamControlRegistry`, `team-runtime`, `team-channels`, `team-local`, `team-projection`, `bundle/team`, `ui-team`, `tool-team`) over **all 81 replayed files**:

- **code files with team markers: 0 (expected 0 ✓)**
- in-scope doc files with team-vocabulary mentions: **11** (recorded, non-failing) — all manifest-classified GENERIC_FORK_CAPABILITY permission-family docs/READMEs whose prose references the team concept in the permission design context (list in `tests/audit.json` → `doc_hits`).

Supplementary raw scan (`/team/i` line scan, all 81 files): 104 code lines / 154 doc lines, fully classified:

1. **permission-family `teammate` rule-layer vocabulary** (majority; e.g. `RuleLayer = 'managed' | 'project' | 'teammate'`, `mergeRuleSources(..., teammate?)`) — the fork's own permission-domain terminology (teammate inline rules merged into rule layers); self-contained, zero imports/references to any team package (Tier-1 markers confirm).
2. **Upstream first-gen experimental agent-team baseline content** — untouched baseline lines in `tsconfig.base.json` (experimental package path aliases), `tsconfig.host.json` (project refs + e2e include), `known-event-types.ts` (first-gen events `team/member`, `team/message/delivered`, `team/message/queued`, `team/task`), `gen-cordis-catalog.ts` / `gen-tool-catalog.ts` / `gen-doc-graphs.ts` (first-gen catalog entries), `packages/bundle/base/cordis.patch.yml` (comment mentioning the team plugin's hook). These belong to upstream and remain by design (baseline is immutable).
3. **11 in-scope docs** (as above).

Resolution: Tier 1 (code, hard) = zero; Tier 2 (in-scope doc prose) = recorded. The manifest is authoritative for attribution; whole-file replay of GENERIC_FORK_CAPABILITY docs stands.

## 11. Deliverables

- Host commit: branch `host/downstream-clean-20260829` — all 81 replayed files + verified `pnpm-lock.yaml` (single commit). SHA: see `git -C .worktrees/P1-T1-host log --oneline -1`.
- Evidence commit: branch `task/P1-T1-host-replay` — this directory (`replay-mapping.json`, this report, `tests/` logs).
- No push; no master changes; no other task worktrees touched.

## 12. Prohibition compliance

- Upstream source unmodified except the forward replay itself; no upstream private APIs, no patch-package/postinstall rewrites, no Team patch applied onto host, no vendored modified upstream copies, no legacy Team SessionEvent vocabulary as vNext authority (second-gen team events excluded at hunk level; first-gen upstream team content is baseline and was never touched).
- Legacy checkout read-only and left clean; `feat/team-vnext-integration-20260829` untouched.
- No reads of `docs/ROUTER_RULES.md`, `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml`.
