# P9 Reuse Audit — S1 legacy inventory (draft)

- **Status:** S1 DRAFT (per-file classification + 14-test disposition). P9 diff summaries, preserved-test
  evidence, and Reviewer verdicts are finalized in P9-S9. Fields marked *(S9)* are intentionally provisional.
- **Authority:** frozen plan `docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_Implementation_Test_Plan.md`
  (§4 five-tier reuse labels, §8 per-file adjudications, §9 expected reuse, §S7 test-migration table L1617–1632,
  §S9 final audit format). Where the kickoff wording ("4-class") differs from the plan, the plan's five-tier
  labels (DIRECT COPY / MECHANICAL ADAPT / ADAPT / REIMPLEMENT / DROP) are used — plan §4 is final authority.
- **vNext baseline:** `task/P9-ui-legacy-reuse` @ `b2b7bb6` (final tip of `int/T12-production-closure`).
- **Legacy asset baseline:** `references/deepseek-harness` @ `506191ba893ac55980dd09680c438710ab24095b`
  (branch `feat/agent-teams`), path `packages/client/ui-team/`, **47 files**.
- **Snapshot used for inventory:** verbatim extract of the 506191b blobs at
  `evidence/P9/legacy-506191b/packages/client/ui-team/` — **47/47 files verified byte-identical** via
  `git hash-object` against `git ls-tree` blobs (manifest: `legacy-ui-team-manifest-at-506191b.txt`).
  The frozen reference checkout tip `a3ab319927` **differs** from the 506191b asset baseline inside ui-team
  (34 files, +176/−111); the working tree of `references/deepseek-harness` was therefore never read for
  inventory content — only the 506191b blobs (see Findings F-1/F-2).

## 0. Baseline validation (pre-S1, complete)

Per `p9-baseline-validation.log` (raw: `p9-install.log`, `p9-full-suite.log`, `p9-tsc8.log`):

| Gate | Result |
|---|---|
| `pnpm install --ignore-scripts` | PASS (29 s, 150 packages) |
| full suite `node scripts/run-tests.mjs` | **2170 passed, 0 failed, 2170 total, 12440 ms** |
| tsc 8-set (typecheck + build configs) | **8/8 exit 0** |
| deviations | NONE (pre-existing tools-build TS6059 `blueprint-snapshot.ts` rootDir violation reproduced and documented; not introduced by P9) |

## 1. Per-file inventory (47/47)

Reuse classes are the plan §4 five-tier labels. "P9 target" follows plan §5 layout
(`packages/client/src/{transport,state,model,ui}/*`, `locales.ts`, `*.module.css`, `test-support/*`).

### 1.1 `src/client/` — components, models, registration (24 files)

| Legacy file | Blob SHA (506191b) | Reuse class (plan §) | P9 target | Rationale / notes |
|---|---|---|---|---|
| `index.ts` | `14f51421` | **ADAPT** (registration) / DROP (data plumbing) (§8.17) | `plugin/client.ts` (merge into vNext root) | Keep: locale NS `team` {zh,en}, `settings.section` (order 50), `conversation.view` id `team` (order 20), `conversation.input.dock` id `team` (order 15), DI via slots/hooks, `openSession` injection. Drop: `ctx.conversationEvents.register(teamMarkerDefinition)`, `conversation.chat.node` `team-marker` (TeamMarker), `ctx.sessions.teams.mirror` + `EMPTY_TEAM_MIRROR_SOURCE`, `ensureTeam`=`teams.refresh`, `pageTeamMessages`=`teams.pageMessagesBefore`, `openTeamTab` DOM tablist hack. |
| `team-timeline-model.ts` | `4921f6b8` | split: `teamTimelineTicks` / `formatTeamClock` / `formatTeamDuration` / tick-domain arithmetic / lane-color strategy = **DIRECT COPY**; `deriveTeamTimeline` = **MECHANICAL ADAPT** (§8.2) | `model/team-timeline-model.ts` | Input changes only: legacy `TeamView.delegations/tasks` → vNext `TeamUiLedgerModel.intervals` + snapshot `members/templates`. Preserve deterministic lane order, start/end domain, open-ended→`now`, multi-interval per instance. Plan: "one of the least files to rewrite." |
| `TeamTimeline.tsx` | `92a478b2` | **MECHANICAL ADAPT**, keep >80% implementation shape (§8.3) | `ui/TeamTimeline.tsx` | Preserve: 1 s local now-clock, `MINIMUM_ZOOM_MS` 1000, drag threshold 3 px, wheel zoom (0.0015 exponent), pointer pan, keyboard (arrows/`+`/`-`/`0`/`Escape`), double-click reset, Tooltip (200 ms delay), CSS-var projection (`--team-lane-count/--team-tick-left/--team-bar-left/--team-bar-width`), bar-click→`onSelectSession`. Change: input type, lane/member id fields, native session nav callback, archived/disposed lane labels. No charting library. |
| `team-members-model.ts` | `56e53cb9` | **MECHANICAL ADAPT** (§8.4) | `model/team-members-model.ts` | Preserve pure React-free fold, group build, deterministic order, leading leader row, multi-instance fold (`appendRow`). Change: grouping key `memberId`→`templateId`, instance identity `instanceId`, `name`→template label, `sessionIds[0]`→frozen `childSessionId`, status union (`bound`/`running`/`settled`)→vNext lifecycle presentation (raw lifecycle kept internally), `currentAction`→activity/liveActivity, per-member pending→completeness-aware ledger-derived optional field. |
| `TeamMembers.tsx` | `a04b046c` | **MECHANICAL ADAPT** (§8.5) | `ui/TeamMembers.tsx` | Preserve group/instance expansion DOM (`data-member-group`, `data-member-status-text`, `data-member-action`, `data-member-waiting`), leader leading row, current-session highlight (`data-current`), click-to-session, StateDot mapping, empty-group handling. Change: lifecycle labels/colors, template/instance terminology, archived/disposed visual, optional modelState badge, optional groupId badge, action-menu slot (S5; command logic stays out of the row). |
| `team-dock-model.ts` | `c640865a` | **MECHANICAL ADAPT** (§8.6) | `model/team-dock-model.ts` | Preserve `deriveTeamDockCounts`/`deriveTeamDockContent` selector structure, compact member rows, running/pending composition. Change: running = projection lifecycle/live state (never session log), pending = `projection.ledger.pendingControlCount`, old compact tasks → current activities or omit, archived/disposed not counted running. |
| `TeamDock.tsx` | `6e2ffbf9` | split: `TeamDockPanel` = **MECHANICAL ADAPT / near DIRECT COPY**; outer `TeamDock` = **ADAPT** (§8.7) | `ui/TeamDock.tsx` | Panel preserves collapsed/expanded state, U+2002·readout format (zero-count segments omitted), member rows, chevron. Outer shell drops `useTeamMirror`/`resolveTeamView`/`ensureTeam` → `useTeamProjectionStore` + `ensureProjection`. `openTeamTab` DOM hack = **DROP**: characterise public navigation/view-selection seam once; public seam → use it; absent → jump button disabled/omitted; DOM text-match never restored. |
| `team-feed-model.ts` | `10581ba8` | **ADAPT**: algorithm reused, data source rewritten (§8.8) | `model/team-feed-model.ts` | Preserve: `TEAM_FEED_INITIAL_LIMIT`/`TEAM_FEED_STEP` = 200, ascending order semantics, stable row keys, visible-window logic, filter/window UI model, error+remainder concept. Rewrite inside module: input `view.approvals/messages` + `olderMessages` + `messagesBefore` anchor → `TeamUiLedgerModel.entries` + client-local category/template/instance filters + ledger completeness/window. Row ordering identity = durable `sequence` first (no timestamp-only fallback). |
| `TeamFeed.tsx` | `bbcc5408` | **ADAPT** → renamed `TeamLedger.tsx` (§8.9) | `ui/TeamLedger.tsx` | Preserve list-section structure, compact single-line rows, title/full-detail affordance, load-earlier button, retryable loud error (`data-feed-load-failed`), row-click navigation, frame-swap window reset semantics. Generalize rows to frozen ledger categories (member lifecycle, message, control request/decision, policy state, override, compatibility warning/ACK, model/effective boundary, progress facts, other). Unknown/future fact type: no throw, safe generic row (`factType + sequence + createdAt`), lossless-safe payload summary only, no guessed actor/session link. |
| `TeamView.tsx` | `5f4aabd9` | **ADAPT**: composition preserved, data shell rewritten (§8.10) | `ui/TeamView.tsx` | Preserve tab shell, ordinary-session zero state (`data-team-zero`), section composition pattern (`data-team-section`), current-member perspective highlight, child/root navigation callback injection. Replace: `TeamMirror`→`TeamProjectionStore`, `resolveTeamView`→`TeamSessionResolution`+`TeamUiSnapshot`, `ensureTeam`→`ensureProjection`, `pageTeamMessages`→`TeamLedgerStore`. Section order per plan §8.10 (Overview/status/compat → Templates+Member Instances → Current Activity/effective config → Activity Timeline → Durable Ledger); the old Task Board is not force-kept. |
| `TeamTasks.tsx` | `b2556c52` | **ADAPT as Activity UI**; old task semantics not preserved (§8.11) | `ui/TeamTasks.tsx` (activity rows) or retire with rationale | Reuse row layout, StateDot, assignee label, status+summary visual. Rewrite input model and subject/status/summary source: member `activity.subject/status/summary` + live current action (preferred) or durable `activity-*` progress facts when ledger complete. Prohibited: guessing tasks from Chat text, inferring status from latest child message, claiming a "complete task board" on partial ledger. |
| `TeamSettingsSection.tsx` | `3c29af94` | shell **DIRECT COPY available**; old content semantics **DROP/REIMPLEMENT** (§8.13) | `ui/TeamSettingsSection.tsx` (if Settings section retained) | Old copy ("configure teammates via Markdown files at `$DSH_HOME/teammates/*.md` / `.dsh/teammates/*.md`") is obsolete: vNext authority = blueprint catalog / runtime preset / Remote creation flow. Keep container/title/empty-state layout; content becomes read-only plugin/status/help; creation/editing lives in New Team flow / Team tab. |
| `TeamMarker.tsx` | `fa05c532` | **DROP as `conversation.chat.node`**; visual fragments reusable (§8.15) | `ui/TeamLedgerRow` fragments only | vNext prohibits TeamDomain-only synthetic Chat markers. Reuse: `rowParts()` compact-row idea, time/type/actor/summary/state layout, row CSS — migrated into the ledger compact row, never into Chat flow. |
| `TeamMarker.module.css` | `34245a2b` | **DROP as Chat marker / REUSE visual fragment** (§8.1) | ledger row styles (fragment) | No synthetic Chat marker registration; row CSS may serve the ledger compact row. |
| `team-marker-definition.ts` | `18dba491` | **DROP** (§8.14) | — | Not "the interface changed": vNext architecture explicitly forbids registering the four `team/*` SessionEvents as Chat nodes. The ledger panel owns the correct position. |
| `team-marker-jump.ts` | `1e64af4a` | **DROP as marker navigation**; decision tree **MECHANICAL ADAPT** (§8.16) | `resolveLedgerRowNavigationTarget(row, snapshot)` in model layer | Per-row-kind target tree (progress/request→member's bound child session, decision→requesting member via pair, message→own session) + degradation rules adapted to ledger rows + snapshot; Chat anchor semantics not preserved. |
| `locales.ts` | `ad589d4b` | **MECHANICAL ADAPT** (§8.12) | `src/locales.ts` (client package root) | 60 keys, zh+en complete (`Record<TeamKey,string>`). Copy first so legacy components compile; rename obsolete task/member terms; add vNext strings (blueprint/revision, lifecycle, modelState, effectiveConfig state/source, policyState, compatibility, ledger categories, create member/team, archive/restore/dispose, handoff, loading/reconnecting/stale/error); delete synthetic marker-only strings (`marker.progress`, `marker.decision`) only after marker drop tests pass. |
| `TeamDock.module.css` | `f61ecee1` | **DIRECT COPY** (§8.1) | `ui/TeamDock.module.css` | Byte-copy first round; token fixes only after visual integration. |
| `TeamFeed.module.css` | `d4205391` | **DIRECT COPY** (§8.1) | `ui/TeamLedger.module.css` (renamed, copied verbatim first) | |
| `TeamMembers.module.css` | `78d103d9` | **DIRECT COPY** (§8.1) | `ui/TeamMembers.module.css` | No redesign first round. |
| `TeamSettingsSection.module.css` | `1211689b` | **DIRECT COPY if settings retained** (§8.1) | `ui/TeamSettingsSection.module.css` | Content semantics handled separately. |
| `TeamTasks.module.css` | `0181c362` | **DIRECT COPY / reuse for Activity rows** (§8.1) | activity-row styles | Old task authority not preserved. |
| `TeamTimeline.module.css` | `09229358` | **DIRECT COPY** (§8.1) | `ui/TeamTimeline.module.css` | High-value asset (lane grid, tick/plot/bars via CSS vars). |
| `TeamView.module.css` | `7716f128` | **DIRECT COPY** (§8.1) | `ui/TeamView.module.css` | Section shell continues to be reused. |

### 1.2 Package root / build (11 files)

| Legacy file | Blob SHA (506191b) | Reuse class | P9 target | Rationale / notes |
|---|---|---|---|---|
| `package.json` | `9211e004` | **DROP** (replaced by vNext package conventions) | — | Legacy monorepo package `@deepseek-ai/dsh-client-ui-team` v0.1.0-rc.5; exports/invariant entry/peerDeps (`dsh-team`, `dsh-invariants`, legacy client peers) not portable. Trap G: only deps actually used by migrated code enter the vNext client package manifest, in vNext repo style. |
| `tsconfig.json` | `442ac25d` | **DROP** | — | Legacy base + project refs; vNext `packages/client/tsconfig*.json` governs. |
| `tsdown.config.ts` | `15cc14bf` | **DROP** | — | Legacy bundle pipeline; vNext client build pipeline governs. |
| `src/index.ts` | `0f64db44` | **DROP** | — | Empty host-half `apply()` (legacy monorepo dual-entry shape); vNext plugin is the client entry `plugin/client.ts`. |
| `src/invariant.ts` | `11ae3414` | **DROP** | — | `InvariantInstaller` companion (empty install, package-owned name) — legacy monorepo pattern, not part of the vNext single client plugin. |
| `src/css-modules.d.ts` | `bc5e4823` | **DIRECT COPY** (§8.1) | client `src` (skip if vNext tooling already declares `*.module.css`) | `declare module '*.module.css'` + `*.css`. |
| `README.md` | `f14f780a` | **DROP** (not migrated) | — | Package docs; vNext package documentation written fresh. |
| `README.zh.md` | `4beda4c8` | **DROP** (not migrated) | — | ditto. |
| `README.i18n.yaml` | `3ec3d50b` | **DROP** (not migrated) | — | legacy i18n workflow metadata. |
| *(remaining 2 counted below: 14 tests — §2)* | | | | |

### 1.3 Class counts (33 non-test files)

| Class | Count | Files |
|---|---:|---|
| DIRECT COPY | 8 | 7 CSS modules + `css-modules.d.ts` |
| MECHANICAL ADAPT | 6 | `team-timeline-model.ts`, `TeamTimeline.tsx`, `team-members-model.ts`, `TeamMembers.tsx`, `team-dock-model.ts`, `locales.ts` |
| ADAPT | 7 | `client/index.ts`, `team-feed-model.ts`, `TeamFeed.tsx`, `TeamView.tsx`, `TeamTasks.tsx`, `TeamDock.tsx`, `TeamSettingsSection.tsx` |
| REIMPLEMENT | 0 | (new vNext modules have no legacy counterpart — see §4) |
| DROP | 12 | 3 READMEs, `package.json`, `tsconfig.json`, `tsdown.config.ts`, `src/index.ts`, `src/invariant.ts`, `team-marker-definition.ts`, `TeamMarker.tsx`, `team-marker-jump.ts` (as marker nav), `TeamMarker.module.css` (as marker CSS) |

Files marked as split adjudications (timeline model, TeamDock, marker-jump, marker CSS, settings) are counted
once under their file-level class; the plan's per-function splits are recorded in the table above.

## 2. 14-test disposition (plan §S7, L1617–1632 — exact plan labels)

Suite inventory from the 506191b blobs (`describe` blocks, full `it` names in the snapshot `tests/`):

| # | Legacy test | Blob SHA (506191b) | Plan disposition | Suites (506191b) |
|---|---|---|---|---|
| 1 | `tests/client-bundle.client.spec.ts` | `c9bd8ad8` | **ADAPT** package/export/browser bundle | `tsdown client artifact` |
| 2 | `tests/team-dock-model.client.spec.ts` | `ba498945` | **MECHANICAL ADAPT** fixtures | `deriveTeamDockCounts`, `deriveTeamDockContent` |
| 3 | `tests/team-dock.client.spec.tsx` | `fe98ac11` | **MECHANICAL ADAPT** store injection | `TeamDockPanel`, `TeamDock` |
| 4 | `tests/team-feed-model.client.spec.ts` | `39c4c579` | **ADAPT** ledger fixtures | `deriveTeamFeed` |
| 5 | `tests/team-feed.client.spec.tsx` | `d28015b9` | **ADAPT** pagination/retry semantics | `TeamFeed` |
| 6 | `tests/team-marker-definition.client.spec.ts` | `9ff87443` | **DROP / replace with negative test: no marker registration** | `team-marker Conversation Definition`, `D16 jump target resolution`, `whole-card removal` |
| 7 | `tests/team-marker.client.spec.tsx` | `ccafe89e` | **DROP as Chat; optional reuse as ledger-row visual test** | `progress rows`, `request rows`, `decision rows`, `message rows`, `mirror resolution and inert rows`, `D16 click`, `locale pairing` |
| 8 | `tests/team-members-model.client.spec.ts` | `482a0ded` | **MECHANICAL ADAPT** lifecycle/template fixtures | `deriveTeamMembers` |
| 9 | `tests/team-members.client.spec.tsx` | `6f59353c` | **MECHANICAL ADAPT** | `TeamMembers` |
| 10 | `tests/team-plugin.client.spec.tsx` | `d5e60bfa` | **ADAPT** new registrations + explicit absence of marker | `TeamSettingsSection`, `plugin lifecycle` |
| 11 | `tests/team-tasks.client.spec.tsx` | `5e364840` | **ADAPT** to activity row or retire with rationale | `TeamTasks` |
| 12 | `tests/team-timeline-model.client.spec.ts` | `786b6c9d` | **MECHANICAL ADAPT** | `deriveTeamTimeline`, `teamTimelineTicks`, `formatTeamClock`, `formatTeamDuration` |
| 13 | `tests/team-timeline.client.spec.tsx` | `5828ed01` | **MECHANICAL ADAPT** | `TeamTimeline` |
| 14 | `tests/team-view.client.spec.tsx` | `9f07bad1` | **ADAPT** store/zero-state/section composition | `resolveTeamView (frozen team-ness derivation)`, `TeamView` |

**Counts:** DROP 2 (#6, #7 — replaced by negative tests asserting no marker registration / no marker node),
MECHANICAL ADAPT 6 (#2, #3, #8, #9, #12, #13), ADAPT 6 (#1, #4, #5, #10, #11, #14). Total 14.

Migration method (plan §12): commit 1 = copy-only (may not compile) → commit 2 = build/import adaptation only →
commit 3+ = data adapter / semantic changes. These are **behavioral migration tests**: move first, then touch only
fixtures / injected data seam / vocabulary (plan §3, L257).

## 3. DROP list (frozen for S0/S1 — no revival by any later phase)

1. **TeamMirror / `ctx.sessions.teams.mirror`** (+ `EMPTY_TEAM_MIRROR_SOURCE`) — browser-side mirror of team data; replaced by `TeamProjectionStore` over frozen Remote.
2. **`teams.pageMessagesBefore` / `messagesBefore` Team history path** — replaced by `TeamLedgerStore` over `team.getLedgerPage` (frozen cursor rule `sequence > afterSequence`, `nextAfterSequence` iff more entries, stale anchor → `TEAM_REMOTE_LEDGER_PAGE_REJECTED`).
3. **Synthetic Chat team markers** — `teamMarkerDefinition` registration, `conversation.chat.node` `team-marker`, `TeamMarker.tsx`; vNext negative requirement (no TeamDomain-only synthetic Chat; no Chat/Trajectory event generation).
4. **DOM tab-activation hack** — `document.querySelectorAll('[role="tablist"] [role="tab"]')` label match + `tab.click()`; replaced by a characterised public navigation seam or an omitted/disabled jump entry.
5. **`ensureTeam` = `ctx.sessions.teams.refresh`** — replaced by `ensureProjection()`.
6. **Legacy Team SessionEvent vocabulary** as vNext authority (`team/progress`, `team/control-request`, `team/control-decision`, `team/message` payloads).

## 4. New vNext modules (REIMPLEMENT — no legacy counterpart; R9-3 budget check)

Per plan §5/§6 and the R9-3 rewrite budget, only these new files may exist with no legacy file:

| New file | Plan basis |
|---|---|
| `transport/team-remote-client.ts` (~150–250 LOC) | §6.1 REIMPLEMENT — reuses `@dsh-agent-team/remote` verdict/assessment helpers, no algorithm reinvention |
| `state/team-projection-store.ts` | §6.2 REIMPLEMENT orchestration — reuses P8 generation verdict / stale-duplicate-foreign logic |
| `state/team-ledger-store.ts` | §6.4 REIMPLEMENT orchestration — reuses `createLedgerPageTracker` / `verifyLedgerPageAnchor` |
| `state/team-session-resolution.ts` | §5 layout (session→team resolution over public seams) |
| `model/team-ui-snapshot.ts` | §6.3 normalized no-authority adapter |
| `model/projection-adapter.ts`, `model/ledger-adapter.ts` | §5 layout (projection/ledger → `TeamUiSnapshot`/`TeamUiLedgerModel`) |
| S5 vNext controls (`TeamCreateFlow.tsx`, `TeamConfigPanel.tsx`/command panels, `TeamOverview.tsx`, `TeamMemberActions.tsx`, `TeamHandoffPanel.tsx`) | plan §5 layout + §S5 |
| `test-support/{projection-fixtures,ledger-fixtures,remote-fixture}.ts` | plan §5 layout |

Creating `NewTimeline` / `NewMembers` / `NewDock` / `NewTeamFeed` files would be a reviewer stop (R9-3).

## 5. Findings (non-blocking observations for the main agent)

- **F-1 (minor):** the start brief's legacy tree-hash line carries a 38-char hash `a45fd296be6546844c5fae24bb1a12f831b312`;
  the real 506191b tree is the 40-char `a45fd296be6546844c5fae2024bb1a12f831b312`. Same prefix, unique commit
  `506191b` — resolved unambiguously by the full commit SHA; inventory pinned to the commit.
- **F-2 (minor, handled):** the frozen reference checkout tip `a3ab319927` differs from the 506191b asset baseline
  inside `packages/client/ui-team/` (34 files, +176/−111). Inventory is strictly against the 506191b blobs via the
  hash-verified scratch snapshot; the reference working tree was not read. The reference repo stayed byte-clean
  (porcelain empty after extraction).
- **F-3 (wording):** kickoff said "4-class" inventory; plan §4 mandates five tiers including ADAPT. Plan labels used;
  no file's classification changed because of this.

## 6. Blockers (fixed ROUTER_RULES format)

**BLOCKERS: NONE.**

- No `CORE_SEAM_BLOCKER`: no public seam was probed yet (S0 seam map is the next step; the dock-jump navigation
  seam is characterised per plan §8.7 during S4, with the sanctioned fallback: disabled/omitted jump entry).
- No `CONTRACT_CHANGE_REQUEST`: no freeze-doc-vs-code contradiction observed during inventory.
- No `SPEC_CONFLICT` / `DEPENDENCY_BLOCKER` / `TEST_INFRA_BLOCKER`.

## 7. S9 finalization checklist (for the closure phase)

- [ ] per-file `P9 diff summary` filled from committed diffs
- [ ] `Preserved tests` column filled with migrated-test references (14/14 migrate-or-drop evidence)
- [ ] `Semantic changes` per file (from S2–S5 commits)
- [ ] Reviewer verdict per file (G-gate)
- [ ] actual reuse percentages vs plan §9 expected bands; any miss beyond the band gets a contract-level justification
- [ ] `P9_VERDICT = GO | REPAIR | CONTRACT_BLOCKER`
