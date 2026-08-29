# P0-T3 — MIXED-file hunk-level provenance report

Baseline: `git diff -M cd5ef8148158c3a752a658978873241fdf8e2bbc..a3ab31992762c5d6560797eabc7e0885a9320ade`
(upstream master tip @ PR #3248 `dsh-0.1.2-alpha.1` = merge-base(origin/master, legacy) → tip of `feat/team-vnext-integration-20260829`, 39 fork commits).
Total: **470 changed files** (310 A + 160 M, no D/R), 45485 insertions / 341 deletions.

## 1. Classification framework

`classification` = the provenance owner of the **fork-side delta/content** (what the fork added or changed relative to upstream):

| Class | Definition |
|---|---|
| `TEAM_OWNED` | Delta/content is 100% agent-team (vNext or legacy second-gen team). Includes M files whose fork-side changes are purely team-driven (e.g. UI goldens that picked up the new 团队 chrome button). |
| `GENERIC_FORK_CAPABILITY` | Delta is a fork-owned capability unrelated to team: permission engine family, model-picker family grouping. Stays in the downstream fork. |
| `UNRELATED_FORK_FEATURE` | Delta is 100% other fork content (local two-instance docs, zh wording sync, scanner bug fix, declaration cleanup). |
| `GENERATED_FROM_TEAM` | Machine-generated artifact (lockfile, catalogs, generated docs, i18n hash ledgers) whose delta is driven by team + permission + model-UI package additions. Any status. |
| `MIXED` | Hand-written **M** file whose fork-side hunks span **≥ 2 feature kinds** (team + permission, or a genuine second non-team kind). Pure-OTHER companion hunks alone do **not** force MIXED; a generated file is never MIXED. |

`disposition` (recommended action for the `dsh-agent-team` refactor):

| Disposition | Meaning |
|---|---|
| `DELETE` | Scaffolding the new repo regenerates itself (package manifests, tsconfigs, build configs). |
| `MIGRATE` | Port into the new repo as-is or near-as-is (pure logic/contracts, vNext plan docs, shipped preset). |
| `REPLACE` | Legacy implementation/wiring superseded by the vNext implementation (same role, new code). |
| `KEEP` | Fork capability code that stays in the downstream fork (permission family, model grouping). |
| `SPLIT` | Hand-written M file: keep the upstream-relevant parts, route each hunk to its owner (see per-hunk routing below). |
| `REFERENCE_ONLY` | Keep as reference material (legacy tests, docs, examples, process records) — not ported. |
| `GENERATED_REVERT` | Revert to the generated-from-current-repo state (regenerate after the port, or drop). |

**Hunk convention.** For `MIXED` files, `mixed_hunks[].hunk` is the **1-based git hunk index** from the file's
`git diff -U0` output (verified: manifest count == `@@` header count for all 11 files). `kind` is the **dominant**
kind of the hunk; when one hunk carries two kinds, both are named in `note`.

Kind vocabulary: `TEAM` (agent-team vNext/second-gen), `PERMISSION` (permission engine family), `MODEL_UI`
(model-picker family grouping), `GENERATED` (machine output), `OTHER` (generic fork content).

## 2. MIXED files (11)

All 11 are hand-written M files; all get disposition `SPLIT` with per-hunk routing.

| # | Path | Kinds | Hunks |
|---|---|---|---|
| 1 | `.gitignore` | OTHER + PERMISSION | 1 |
| 2 | `docs/subsystems/README.md` | TEAM + PERMISSION | 2 |
| 3 | `docs/subsystems/README.zh.md` | TEAM + PERMISSION | 2 |
| 4 | `packages/core/session/src/known-event-types.ts` | TEAM + PERMISSION | 4 |
| 5 | `scripts/gen-cordis-catalog.ts` | TEAM + PERMISSION | 4 |
| 6 | `scripts/gen-doc-graphs.ts` | TEAM + PERMISSION | 3 |
| 7 | `scripts/gen-tool-catalog.ts` | TEAM + PERMISSION | 7 |
| 8 | `scripts/project-doc-site.spec.ts` | TEAM + PERMISSION | 1 |
| 9 | `website/docs.ts` | TEAM + PERMISSION | 2 |
| 10 | `tsconfig.base.json` | TEAM + PERMISSION | 7 |
| 11 | `tsconfig.host.json` | TEAM + PERMISSION | 1 |

### 2.1 `.gitignore` (1 hunk)

| Hunk | Kind | Note |
|---|---|---|
| 1 | OTHER | Local dev hygiene block (`references/`, `issues/`, `archive/`, `start-dev.ps1`, `*.js.map`, `*.d.ts.map`) plus `.js`/`.d.ts` build-artifact ignores for `core/session` and `permission-engine` sources. Dominant: OTHER; secondary: PERMISSION (permission-engine artifact ignores). |

### 2.2 `docs/subsystems/README.md` (2 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | Adds the `team.md` row (TeamRegistry / TeamControlRegistry seam page) to the subsystems index. |
| 2 | PERMISSION | Adds the `permission.md` row (PermissionService rule engine page) to the subsystems index. |

### 2.3 `docs/subsystems/README.zh.md` (2 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | Replaces the `agent-team` row with the new `team.md` row and re-adds the legacy `agent-team` row (zh subsystems index). |
| 2 | PERMISSION | Adds the `permission.md` row to the zh subsystems index. |

### 2.4 `packages/core/session/src/known-event-types.ts` (4 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | PERMISSION | Registers the `permission/decision` audit event type. |
| 2 | TEAM | Registers `team/control-decision` and `team/control-request` event types. |
| 3 | TEAM | Registers `team/member-bound` and `team/message` event types. |
| 4 | TEAM | Registers the `team/progress` event type. |

### 2.5 `scripts/gen-cordis-catalog.ts` (4 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | `SERVICE_PAGE` maps `team`, `teamControl`, `teamProjection` to `team.md` and `permission` to `permission.md` (one hunk, both kinds). |
| 2 | TEAM | `LINK_MAP` adds the `Team*` type links pointing at the new `team.md` page. |
| 3 | TEAM | `LINK_MAP` drops the old `TeamView: agent-team.md` entry (moved to `team.md` in hunk 2). |
| 4 | PERMISSION | `TYPE_LINK_EXEMPTIONS` adds the permission type ownership notes (`CompiledPolicy`, `RuleSource`, `PermissionContext`, …). |

### 2.6 `scripts/gen-doc-graphs.ts` (3 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | `GROUP_ORDER` inserts the `team` group after `subagent`. |
| 2 | PERMISSION | `GROUP_ORDER` inserts the `permission` group before `cordis`. |
| 3 | TEAM | `SERVICE_ROLES` adds the `team`, `teamControl`, `teamProjection` and `permission` seam entries (one hunk, both kinds). |

### 2.7 `scripts/gen-tool-catalog.ts` (7 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | Renames the experimental tool-agent-team import to `ExperimentalToolAgentTeam` (legacy first-gen mount rewire). |
| 2 | TEAM | Adds imports for `TeamRegistry`, `TeamControlRegistry`, `ToolTeam` and `ToolPermissionGuard` (team + permission packages). |
| 3 | PERMISSION | `ToolPackage` gains the `noModelTools` field for the pre-execute permission guard (registers no model-facing tool). |
| 4 | PERMISSION | `TOOL_PACKAGES` gains the `tool-permission-guard` entry (`permission/decision` audit events). |
| 5 | TEAM | Replaces `await ctx.plugin(ToolTeam)` with the renamed `ExperimentalToolAgentTeam` in the child-scope harvest. |
| 6 | TEAM | `TOOL_PACKAGES` gains the `tool-team` entry (five team tools over the team seam). |
| 7 | PERMISSION | `collectToolCatalog` skips `assertToolsHarvested` for `noModelTools` packages (the guard). |

### 2.8 `scripts/project-doc-site.spec.ts` (1 hunk)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | `docsPages` translated-locale count 46 → 48: the two new subsystem pages are `team.md` and `permission.md` (one hunk, both kinds). |

### 2.9 `website/docs.ts` (2 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | `subsystemGroups` adds the `team.md` (Team) doc page. |
| 2 | PERMISSION | `subsystemGroups` adds the `permission.md` (Permissions) doc page. |

### 2.10 `tsconfig.base.json` (7 hunks)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | `paths`: + `@deepseek-ai/dsh-team-projection/types` alias. |
| 2 | TEAM | `paths`: + `dsh-team/types` and the four permission package aliases (`dsh-permission`, `/types`, `permission-engine`, `tool-permission-guard`) in one hunk. |
| 3 | TEAM | `paths`: + hand-written `dsh-bundle-team`, `dsh-bundle-team/invariant`, `dsh-client-ui-team` aliases. |
| 4 | PERMISSION | `paths`: + `permission` and `permission-engine` `/invariant` aliases. |
| 5 | TEAM | `paths`: + `dsh-team`, `dsh-team-channels`, `dsh-team-local`, `dsh-team-projection`, `dsh-team-runtime` aliases (+ `/invariant` each). |
| 6 | PERMISSION | `paths`: + `tool-permission-guard/invariant` alias. |
| 7 | TEAM | `paths`: + `dsh-tool-team` and `dsh-tool-team/invariant` aliases. |

### 2.11 `tsconfig.host.json` (1 hunk)

| Hunk | Kind | Note |
|---|---|---|
| 1 | TEAM | `project references`: +7 team packages (`team`, `team-local`, `team-projection`, `team-runtime`, `team-channels`, `tool-team`, `bundle/team`) and +3 permission packages (`permission`, `permission-engine`, `tool-permission-guard`) in one hunk. |

## 3. Candidates examined and NOT classified MIXED

These M files were reviewed hunk-by-hunk during the audit and kept out of MIXED deliberately:

| File | Classification | Why not MIXED |
|---|---|---|
| `apps/cli/README.md` / `README.zh.md` / `reference/README.md` / `reference/README.zh.md` | TEAM_OWNED / SPLIT | All hunks document the `dsh teammate` command family; no second feature kind. |
| `apps/web/tests/expected/agent-preset-authoring/{created,damaged,section}.expected.md` | TEAM_OWNED / SPLIT | Goldens gain only the shipped team preset menu rows. |
| `apps/web/tests/expected/models-settings/{configured,declared,declared-edit,empty}.expected.md` and `onboarding-*`, `plugin-config/section.expected.md`, `settings-chrome/dialog*.expected.md` | TEAM_OWNED / SPLIT | All +3-line deltas are the settings-chrome `button "团队"` (the new Team section entry); model content in those pages is untouched. |
| `packages/client/ui-agent-preset/tests/locales.client.spec.ts` | TEAM_OWNED / SPLIT | Only the team preset locale copy is asserted. |
| `packages/client/ui-workspace/src/Rows.tsx` | TEAM_OWNED / SPLIT | Adds team rows/badges only; no permission or model-UI hunks. |
| `apps/web/tests/models-settings.e2e.ts` | GENERIC_FORK_CAPABILITY / SPLIT | Entire delta is the grouped model-fetch e2e (mock gateway + family grouping). |
| `packages/client/ui-settings-models/src/client/ModelListEditor.tsx` / `ModelsSection.module.css` | GENERIC_FORK_CAPABILITY / SPLIT | Family-grouping editor logic and styles only. |
| `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` | GENERATED_FROM_TEAM / GENERATED_REVERT | Generated catalog — by definition never MIXED. |
| `packages/extensions/tool-cordis/src/api-catalog.ts` | GENERATED_FROM_TEAM / GENERATED_REVERT | Generated catalog — by definition never MIXED. |

**Routing summary.** In every MIXED file the TEAM hunks route to the `dsh-agent-team` port (they describe the
team seam surface that the vNext packages replace), while PERMISSION hunks route back to the downstream fork
(permission stays `KEEP`). The single OTHER-dominant file (`.gitignore`) routes its dev-hygiene lines to the
fork and its permission-engine artifact ignores with the permission family.
