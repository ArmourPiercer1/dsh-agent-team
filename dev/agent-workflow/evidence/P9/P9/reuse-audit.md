# P9 Reuse Audit — S9 final (plan §S9 format, L1761–1781)

- **Status:** S9 finalization of the S1 draft (worktree `dev/agent-workflow/evidence/P9/reuse-audit.md`, 174 lines — retained verbatim as the S1 original).
  Per-file `P9 diff summary`, `Preserved tests`, and `Reviewer verdict` are the S9 additions (checklist §7 of the S1 draft).
- **Authority:** frozen plan `docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_Implementation_Test_Plan.md`
  (§4 five-tier labels, §8 per-file adjudications, §9 expected reuse bands L1049–1081, §17 reuse-review metrics L1954–2030,
  §S7 test-migration table, §S9 audit format L1761–1781).
- **vNext baseline audited:** `task/P9-ui-legacy-reuse` @ `0738b45` (final tip = `47b41df` + `08cd77c` + `0738b45`; column 9
  re-verified against this tip by the independent L2 reviewer, 2026-09-04 — see `s9-verdict.md`).
- **Legacy asset baseline:** `references/deepseek-harness` @ `506191ba893ac55980dd09680c438710ab24095b` (branch `feat/agent-teams`),
  path `packages/client/ui-team/`, **47 files**. Inventory snapshot: verbatim 506191b blobs under
  `evidence/P9/legacy-506191b/packages/client/ui-team/` — 47/47 byte-identical via `git hash-object` vs `git ls-tree`
  (manifest `legacy-ui-team-manifest-at-506191b.txt`). Findings F-1/F-2 (S1) unchanged.
- **Diff method:** `git diff --no-index --numstat` between the 506191b snapshot file and the actual P9 file(s) at the audited tip.
  `+A/-R` = added/removed lines. The retained-% heuristic in §B is `(legacy_lines − R) / legacy_lines` — per plan §17 (L1956) a
  plain LOC% is gameable and is **supporting evidence only**; the five-tier class + per-asset evidence is primary.
  For split landings (one legacy file → two P9 files) the numstats are summed and the split is noted.
- **P9 tree verified at audited tip:** `packages/client/src` = 38 files (css-modules.d.ts, index.ts, model/×12, plugin/×2, state/×3,
  transport/×2, ui/×21 incl. `locales.ts`); `packages/client/test` = 34 files. **No `NewTimeline`/`NewMembers`/`NewDock`/`NewTeamFeed`
  files exist** (R9-3 reviewer-stop check, L2004–2013: PASS).

## A. 33 non-test source files — 9-column audit

Class labels: plan §4 (DIRECT COPY / MECHANICAL ADAPT / ADAPT / REIMPLEMENT / DROP). "P9 file" = actual file(s) at the audited tip
(the S1 draft's "P9 target" is the planned layout; deviations are recorded in §D).

| Legacy file | P9 file | Reuse class | Legacy SHA | P9 diff summary | Preserved tests | Semantic changes | Justification | Reviewer verdict |
|---|---|---|---|---|---|---|---|---|
| `src/client/index.ts` | `src/plugin/client.ts` + `src/plugin/team-mount-core.ts` | ADAPT (registration) / DROP (data plumbing) | `14f51421` | split: +70/-161 + +589/-144 | `client-plugin-mount.test.ts`, `team-plugin.client.spec.tsx`, `client.test.ts` | Keep locale NS, three slot registrations (view/dock/settings ids+orders), DI, `openSession` injection. Drop marker registration, `conversation.chat.node`, TeamMirror, `ensureTeam`, `pageTeamMessages`, DOM tablist hack | §8.17: registration is the preserved surface; data plumbing is replaced by frozen Remote + stores |CONFIRMED — registration surface preserved (3 slot registrations, locale NS, openSession injection); data plumbing DROP per §8.17|
| `src/client/team-timeline-model.ts` | `src/model/team-timeline-model.ts` | split: ticks/formatters/arithmetic/lane-color = DIRECT COPY; `deriveTeamTimeline` = MECHANICAL ADAPT | `4921f6b8` | +88/-59 (legacy 186L, ~68% retained) | `team-timeline-model.client.spec.ts` | Input `delegations/tasks` → `TeamUiLedgerModel.intervals` + snapshot `members/templates`; deterministic lane order, start/end domain, open-ended→now, multi-interval preserved | §8.2 "one of the least files to rewrite"; band §9: 80–95% → **below band, see §B** |CONFIRMED — 68% band miss adjudicated §B: frozen §8.2 rewrite concentrated in derive fn; ticks/formatters/arithmetic/lane-color DIRECT COPY; R9-1 class intact|
| `src/client/TeamTimeline.tsx` | `src/ui/TeamTimeline.tsx` | MECHANICAL ADAPT | `92a478b2` | +24/-22 (legacy 359L, ~94% retained) | `team-timeline.client.spec.tsx` | Presentation props rewired to vNext model types; interaction/client-local state untouched | R9-1 high-reuse asset; band 80–90% met (above) |CONFIRMED — R9-1 asset; 94% retained; independent numstat +24/-22 re-verified|
| `src/client/team-members-model.ts` | `src/model/team-members-model.ts` | MECHANICAL ADAPT | `56e53cb9` | +134/-57 (legacy 120L, ~53% retained) | `team-members-model.client.spec.ts` | Group key `memberId`→`templateId`; identity → `instanceId`; `sessionIds[0]`→frozen `childSessionId`; status union → vNext lifecycle presentation; `currentAction`→activity/live; per-member pending → completeness-aware optional field | §8.4; band 65–80% → **below band (identity/vocabulary rewrite), see §B** |CONFIRMED — 53% band miss adjudicated §B: frozen §8.4 vocabulary/identity rewrite; bug #5 zero-instance rows are the contract (UI §16.1)|
| `src/client/TeamMembers.tsx` | `src/ui/TeamMembers.tsx` | MECHANICAL ADAPT | `a04b046c` | +480/-63 (legacy 180L, ~65% retained) | `team-members.client.spec.tsx`, `team-members-actions.client.spec.tsx` | DOM contract kept (`data-member-group/status-text/action/waiting`, `data-current`, StateDot map); added lifecycle labels/colors, template/instance terminology, archived/disposed visual, optional badges, action-menu slot (S5) | §8.5; band 70–90% → slightly below (additive vNext surface +480), see §B |CONFIRMED — 65% borderline: +480 additive vNext surface (S5 action-menu slot); frozen row semantics preserved|
| `src/client/team-dock-model.ts` | `src/model/team-dock-model.ts` | MECHANICAL ADAPT | `c640865a` | +77/-57 (legacy 93L, ~39% retained) | `team-dock-model.client.spec.ts` | `deriveTeamDockCounts/Content` structure kept; running = projection lifecycle/live (never session log); pending = `ledger.pendingControlCount`; compact tasks → current activities/omit; archived/disposed not running | §8.6; small legacy file (93L) inflates the % swing — see §B note |CONFIRMED — 39%: dock model rewritten onto vNext store per §8.6; R9-2 dock scenarios preserved|
| `src/client/TeamDock.tsx` | `src/ui/TeamDock.tsx` | split: `TeamDockPanel` = MECHANICAL ADAPT/near DIRECT; outer shell = ADAPT | `6e2ffbf9` | +103/-65 (legacy 212L, ~69% retained) | `team-dock.client.spec.tsx` | Panel keeps collapsed/expanded, U+2002·readout (zero-count omitted), member rows, chevron. Outer shell: `useTeamMirror`/`resolveTeamView`/`ensureTeam` → `useTeamProjectionStore`+`ensureProjection`; `openTeamTab` DOM hack = DROP (seam absent → jump disabled/omitted, never DOM text-match) | §8.7; R9-1 "TeamDockPanel portion"; band panel 70–90% / shell 40–60% |CONFIRMED — panel near-DIRECT / outer shell ADAPT per §8.6|
| `src/client/team-feed-model.ts` | `src/model/team-ledger-model.ts` + `src/model/ledger-adapter.ts` | ADAPT (algorithm reused, data source rewritten) | `10581ba8` | +362/-149 + +466/-165 (legacy 180L, ~0% line-retained) | `team-ledger-model.client.spec.ts` (incl. "keeps the frozen depth constants from the legacy feed model") | Constants preserved (`TEAM_LEDGER_INITIAL_LIMIT/STEP = 200` = legacy `TEAM_FEED_*`, cited in-code L40–44); ascending order, stable row keys, window logic, error+remainder kept. Input `approvals/messages`+`olderMessages`+`messagesBefore` → `TeamUiLedgerModel.entries` + client-local category/template/instance filters; ordering identity = durable `sequence` first | §8.8 explicitly mandates the in-module rewrite; band 40–60% → **line-retained miss with plan-mandated justification, see §B** |CONFIRMED — band miss adjudicated §B: frozen §8.8 in-module source rewrite; frozen depth constants retained (test-pinned)|
| `src/client/TeamFeed.tsx` | `src/ui/TeamLedger.tsx` (renamed) | ADAPT | `bbcc5408` | +254/-163 (legacy 230L, ~29% retained) | `team-ledger.client.spec.tsx` | List-section structure, compact rows, title/full-detail, load-earlier, retryable loud error (`data-feed-load-failed`), row-click nav, frame-swap reset kept; rows generalized to frozen ledger categories; unknown fact → safe generic row, no guessed actor/session link | §8.9; band 50–70% → **below band (row generalization), see §B** |CONFIRMED — 29% band miss adjudicated §B: frozen §8.9 row generalization to frozen ledger categories; list UX + row anatomy retained|
| `src/client/TeamView.tsx` | `src/ui/TeamView.tsx` | ADAPT (composition preserved, data shell rewritten) | `5f4aabd9` | +293/-58 (legacy 114L, ~49% retained) | `team-view.client.spec.tsx` | Tab shell, zero state (`data-team-zero`), section composition (`data-team-section`), current-member highlight, nav callback injection kept. `TeamMirror`→`TeamProjectionStore`; `resolveTeamView`→`TeamSessionResolution`+`TeamUiSnapshot`; `ensureTeam`→`ensureProjection`; `pageTeamMessages`→`TeamLedgerStore`. Section order per §8.10; old Task Board not force-kept | §8.10; band 50–70% → borderline below, see §B |CONFIRMED — independent re-run numstat +292/-58 vs recorded +293/-58 (±1 addition variance, immaterial; F-12d)|
| `src/client/TeamTasks.tsx` | `src/ui/TeamActivity.tsx` (activity rows) | ADAPT as Activity UI; old task semantics not preserved | `b2556c52` | +67/-67 (legacy 93L, ~28% retained) | `team-activity.client.spec.tsx` (header: "legacy `team-tasks.client.spec.tsx` (7 tests) mapped onto the new input") | Row layout, StateDot, assignee label, status+summary visual reused verbatim (test header L6). Input model → member `activity.subject/status/summary` + live current action or durable `activity-*` facts; status = THREE frozen ProgressValue labels (legacy `pending` arm → absent-status arm) | §8.11 (legacy task authority消失); band 30–60% → borderline below, see §B |CONFIRMED — 28% borderline: task-authority removal is R9-4-sanctioned; row anatomy/visual reused verbatim|
| `src/client/TeamSettingsSection.tsx` | `src/ui/TeamSettingsSection.tsx` | shell DIRECT COPY available; old content DROP/REIMPLEMENT | `3c29af94` | +18/-12 (legacy 37L, ~68% retained) | `team-plugin.client.spec.tsx`, `client-plugin-mount.test.ts` | Container/title/empty-state layout kept; obsolete Markdown-teammate copy replaced by read-only plugin/status/help (authority = blueprint catalog / runtime preset / Remote creation flow) | §8.13; band 20–40% → **above band (better than expected)** |CONFIRMED — shell DIRECT COPY; content DROP/REIMPLEMENT (legit zone §10.3)|
| `src/client/TeamMarker.tsx` | `src/ui/TeamLedger.tsx` (row fragments only) | DROP as `conversation.chat.node`; visual fragments reused | `fa05c532` | fragment into TeamLedger.tsx: +290/-153 (legacy 184L, ~17% line-retained) | `team-ledger.client.spec.tsx` (row anatomy), `client-architecture-negatives.test.ts` (absence) | `rowParts()` compact-row idea, time/type/actor/summary/state layout migrated into the ledger compact row; never into Chat flow | §8.15 + R9-4 (synthetic markers deleted); band "50–70% reuse in Ledger" (presentation) → tsx line-retained low, CSS high, see §B |CONFIRMED — DROP as conversation.chat.node; visual fragments reused in TeamLedger; absence pinned by runnable negatives|
| `src/client/TeamMarker.module.css` | `src/ui/TeamLedger.module.css` (fragment) | DROP as Chat marker / REUSE visual fragment | `34245a2b` | +109/-3 (legacy 85L, ~96% retained) | visual assertions in `team-ledger.client.spec.tsx` | Row CSS serves the ledger compact row; no synthetic Chat marker registration | §8.1 + §8.15 |CONFIRMED — DROP as Chat marker; CSS fragment reuse in ledger|
| `src/client/team-marker-definition.ts` | — (not migrated) | DROP | `18dba491` | — | `client-architecture-negatives.test.ts` (negative: no marker registration) | vNext architecture forbids registering the four `team/*` SessionEvents as Chat nodes; ledger panel owns the position | §8.14 + R9-4; band 0% met exactly |CONFIRMED — DROP; absence pinned by client-architecture-negatives.test.ts|
| `src/client/team-marker-jump.ts` | `src/model/team-ledger-model.ts` (decision tree) | DROP as marker navigation; decision tree MECHANICAL ADAPT | `1e64af4a` | +376/-61 (legacy 78L, ~22% retained — sum includes feed-model share, see note) | `team-ledger-model.client.spec.ts` (navigation targets) | Per-row-kind target tree (progress/request→bound child session, decision→requesting member via pair, message→own session) + degradation rules adapted to ledger rows + snapshot; Chat anchor semantics not preserved; Seam 4 absent → dock jump degrades to CLIENT_LOCAL no-op (D-T9-4) | §8.16; S0 seam map: navigation seam absent → sanctioned fallback |CONFIRMED — DROP as marker navigation; decision tree preserved in team-ledger-model.ts|
| `src/client/locales.ts` | `src/ui/locales.ts` | MECHANICAL ADAPT | `ad589d4b` | +511/-69 (legacy 186L, ~63% retained) | locale-pairing assertions across component specs | 60 legacy keys kept (zh+en complete `Record<TeamKey,string>`); obsolete task/member terms renamed; vNext strings added (blueprint/revision, lifecycle, modelState, effectiveConfig, policyState, compatibility, ledger categories, create/archive/restore/dispose, handoff, loading/reconnecting/stale/error); synthetic marker-only strings deleted after marker drop tests passed | §8.12; band 50–70% met |CONFIRMED — MA 63%; S9 colon-format fix verified in-file (F-10 product #3)|
| `src/client/TeamDock.module.css` | `src/ui/TeamDock.module.css` | DIRECT COPY | `f61ecee1` | **identical** (171L) | visual assertions in `team-dock.client.spec.tsx` | none (byte copy) | §8.1; R9-1; band 80–100% met exactly |CONFIRMED — byte-identical (measured 170L vs recorded 171L: trailing-newline convention; F-12f)|
| `src/client/TeamFeed.module.css` | `src/ui/TeamLedger.module.css` (renamed, copied verbatim) | DIRECT COPY | `d4205391` | +18/-0 (173L, additions only = 100% retained) | visual assertions in `team-ledger.client.spec.tsx` | rename + additive additions (new ledger categories) | §8.1 |CONFIRMED — renamed verbatim copy (+18/-0)|
| `src/client/TeamMembers.module.css` | `src/ui/TeamMembers.module.css` | DIRECT COPY | `78d103d9` | +88/-11 (133L, ~92% retained) | visual assertions in `team-members.client.spec.tsx` | additive: archived/disposed + badge visuals | §8.1; R9-1; band met |CONFIRMED — 92% retained|
| `src/client/TeamSettingsSection.module.css` | `src/ui/TeamSettingsSection.module.css` | DIRECT COPY | `1211689b` | **identical** (54L) | — | none (byte copy) | §8.1 |CONFIRMED — identical|
| `src/client/TeamTasks.module.css` | `src/ui/TeamActivity.module.css` | DIRECT COPY / reuse for Activity rows | `0181c362` | **identical** (78L) | visual assertions in `team-activity.client.spec.tsx` | none (byte copy; task authority not preserved) | §8.1 |CONFIRMED — identical; reused for Activity rows|
| `src/client/TeamTimeline.module.css` | `src/ui/TeamTimeline.module.css` | DIRECT COPY | `09229358` | **identical** (200L) | visual assertions in `team-timeline.client.spec.tsx` | none (byte copy; lane grid/tick/plot/bars via CSS vars) | §8.1; R9-1; band met exactly |CONFIRMED — byte-identical (measured 199L vs recorded 200L: trailing-newline convention; F-12f)|
| `src/client/TeamView.module.css` | `src/ui/TeamView.module.css` | DIRECT COPY | `7716f128` | +94/-0 (31L, additions only = 100% retained) | visual assertions in `team-view.client.spec.tsx` | additive: new section visuals | §8.1; R9-1; band met |CONFIRMED — +94/-0 additions only|
| `package.json` | — (not migrated) | DROP | `9211e004` | — | — | legacy monorepo package (`@deepseek-ai/dsh-client-ui-team` v0.1.0-rc.5); exports/invariant entry/peerDeps not portable; Trap G: only deps actually used by migrated code enter the vNext manifest | §1.2 adjudication |CONFIRMED — DROP (vNext package governs)|
| `tsconfig.json` | — (not migrated) | DROP | `442ac25d` | — | — | vNext `packages/client/tsconfig*.json` governs | §1.2 |CONFIRMED — DROP (vNext tsconfig governs)|
| `tsdown.config.ts` | — (not migrated) | DROP | `15cc14bf` | — | — | legacy bundle pipeline replaced by vNext client build | §1.2 |CONFIRMED — DROP (vNext client build replaces legacy tsdown pipeline)|
| `src/index.ts` | — (not migrated) | DROP | `0f64db44` | — | — | empty host-half `apply()` (legacy monorepo dual-entry); vNext plugin is the client entry `plugin/client.ts` | §1.2 |CONFIRMED — DROP (empty host-half entry)|
| `src/invariant.ts` | — (not migrated) | DROP | `11ae3414` | — | — | `InvariantInstaller` companion (empty install) — legacy monorepo pattern, not part of the vNext single client plugin | §1.2 |CONFIRMED — DROP (empty install companion)|
| `src/css-modules.d.ts` | `src/css-modules.d.ts` | DIRECT COPY | `bc5e4823` | **identical** | — | none | §1.2 (`.module.css` + `*.css` declaration) |CONFIRMED — identical|
| `README.md` | — (not migrated) | DROP | `f14f780a` | — | — | vNext package documentation written fresh | §1.2 |CONFIRMED — DROP (vNext docs written fresh)|
| `README.zh.md` | — (not migrated) | DROP | `4beda4c8` | — | — | ditto | §1.2 |CONFIRMED — DROP|
| `README.i18n.yaml` | — (not migrated) | DROP | `3ec3d50b` | — | — | legacy i18n workflow metadata | §1.2 |CONFIRMED — DROP (legacy i18n workflow metadata)|

**Class counts (33 non-test):** DIRECT COPY 8 (7 CSS modules + `css-modules.d.ts`) / MECHANICAL ADAPT 6 / ADAPT 7 (incl. split
adjudications counted once at file level) / REIMPLEMENT 0 (new vNext modules have no legacy counterpart — §C) / DROP 12.
Matches the S1 draft §1.3 exactly.

## B. §9 band comparison (plan L1049–1081) — supporting evidence

Retained% = `(legacy_lines − removed) / legacy_lines` (heuristic; §17 L1956: not primary). "Status": MET / BORDERLINE / MISS (misses carry the contract-level justification plan L1071–1080 requires).

| Asset family | Expected band | Actual (numstat evidence) | Status |
|---|---:|---|---|
| 8 CSS modules | 80–100% | 100% / 100% / 92% / 100% / 100% / 100% / 100% (+ marker CSS 96% fragment) | MET |
| Timeline pure model | 80–95% | ~68% retained (+88/-59, split: formatters/arithmetic DIRECT, `deriveTeamTimeline` MECHANICAL) | **MISS** — justification: §8.2 input rewrite (`delegations/tasks`→intervals+snapshot) concentrates in the derive function; the DIRECT-COPY majority is the ticks/formatters/lane-color surface the band assumed; reviewer to adjudicate R9-1 |
| Timeline React component | 80–90% | ~94% retained (+24/-22) | MET (above band) |
| Member group model | 65–80% | ~53% retained (+134/-57) | **MISS** — justification: identity/lifecycle vocabulary rewrite (§8.4: memberId→templateId, sessionIds[0]→frozen childSessionId, status union → vNext lifecycle) is mandated by the frozen object model; fold/group/order algorithms preserved |
| Members component | 70–90% | ~65% retained (+480/-63) | BORDERLINE — +480 added lines are additive vNext surface (lifecycle visuals, badges, action-menu slot S5), not legacy-line churn |
| Dock panel | 70–90% | whole file ~69% (panel portion near-direct; shell swap dominates the -65) | BORDERLINE |
| Dock outer shell | 40–60% | shell = the -65/swap region within the 69% whole | MET (within shell sub-band) |
| Feed model | 40–60% | ~0% line-retained (+828/-314 across 2 landing files) | **MISS** — justification: §8.8 *mandates* "Rewrite inside module" (input → `TeamUiLedgerModel.entries` + filters); constants/ordering/window semantics carried and test-pinned ("keeps the frozen depth constants from the legacy feed model"); line% is the gameable metric §17 warns about |
| Feed component | 50–70% | ~29% retained (+254/-163) | **MISS** — justification: §8.9 row generalization to the frozen ledger categories (9+ categories incl. unknown-fact safe row) rewrites the row layer; list UX/affordances retained |
| TeamView composition | 50–70% | ~49% retained (+293/-58) | BORDERLINE — shell/zero-state/section-pattern retained; data lifecycle swap mandated by §8.10 |
| Tasks component | 30–60% | ~28% retained (+67/-67) | BORDERLINE — row anatomy/visual reused verbatim per the migrated test header; task authority removal is R9-4-sanctioned |
| locales | 50–70% | ~63% retained (+511/-69) | MET |
| settings | 20–40% | ~68% retained (+18/-12) | MET (above band — better than expected) |
| marker definition/chat registration | 0% | 0% (not migrated; negative test pins absence) | MET exactly |
| marker compact visual | 50–70% reuse in Ledger | CSS ~96% retained; tsx row fragments re-derived (~17% line-retained) | **PARTIAL** — reviewer to adjudicate: the plan band targets "presentation reuse", which lives in the CSS + row anatomy; the tsx wiring is new by necessity |
| old TeamMirror/sessions data layer | 0% | 0% (no mirror imports; architecture-negatives test) | MET exactly |
| old tests | 50–80% scenario reuse | 14/14 migrated-or-dropped (§C table); R9-2 eight scenario groups all present (§E) | MET (scenario-based, per R9-2) |

Deviation triggers (plan L1071–1080: Timeline rewritten from zero / Members rewritten from zero / all CSS rewritten / no legacy test migrated)
— **none triggered**: Timeline ~94%/~68%, Members ~65%/~53% with class MECHANICAL, CSS all ≥92%, 14/14 tests accounted.

## C. 14 legacy tests — 9-column audit (plan §S7 dispositions, L1617–1632)

| Legacy file | P9 file | Reuse class | Legacy SHA | P9 diff summary | Preserved tests (scenarios) | Semantic changes | Justification | Reviewer verdict |
|---|---|---|---|---|---|---|---|---|
| `tests/client-bundle.client.spec.ts` | `test/client-bundle.client.spec.ts` | ADAPT (package/export/browser bundle) | `c9bd8ad8` | +154/-103 | bundle artifact assertions | vNext layout (single client plugin entry) | **excluded from the vitest runnable surface** (client vitest.config.ts L41) — bundle artifact verified by `s8-bundle.mjs` (834110 B, sha `4a72c0e8…`) + `s8-validate.mjs` evidence (S8) |CONFIRMED — ADAPT; excluded from node runnable surface (browser bundle; T7 evidence s8-bundle.mjs + s8-validate.mjs)|
| `tests/team-dock-model.client.spec.ts` | `test/team-dock-model.client.spec.ts` | MECHANICAL ADAPT (fixtures) | `ba498945` | +178/-71 | `deriveTeamDockCounts`, `deriveTeamDockContent` | fixtures → projection/ledger inputs | §S7 |CONFIRMED|
| `tests/team-dock.client.spec.tsx` | `test/team-dock.client.spec.tsx` | MECHANICAL ADAPT (store injection) | `fe98ac11` | +212/-128 | `TeamDockPanel`, `TeamDock` (collapse/expand R9-2) | store injection seam | §S7 |CONFIRMED|
| `tests/team-feed-model.client.spec.ts` | `test/team-ledger-model.client.spec.ts` | ADAPT (ledger fixtures) | `39c4c579` | +326/-295 | `deriveTeamFeed` → ledger model + "keeps the frozen depth constants from the legacy feed model" | fixtures → `TeamUiLedgerModel.entries` | §S7; landing renamed per §8.8/§8.9 |CONFIRMED — mapped to team-ledger-model.client.spec.ts (F-4 layout)|
| `tests/team-feed.client.spec.tsx` | `test/team-activity.client.spec.tsx` | ADAPT (pagination/retry semantics) | `d28015b9` | +99/-480 | feed window/load/retry (R9-2) → Activity/ledger window semantics | pagination/retry onto new input model | §S7 |CONFIRMED — mapped to team-activity.client.spec.tsx|
| `tests/team-marker-definition.client.spec.ts` | `test/client-architecture-negatives.test.ts` (negative replacement) | DROP / replace with negative test | `9ff87443` | replaced (negatives spec is new) | no-marker-registration assertion | Chat marker vocabulary retired | §S7 + R9-4; exclusion from runnable surface + quarantine restored to the original two-file set (P9-T10) |CONFIRMED — DROP; replaced by runnable client-architecture-negatives.test.ts|
| `tests/team-marker.client.spec.tsx` | `test/team-ledger.client.spec.tsx` (visual reuse) | DROP as Chat; reuse as ledger-row visual test | `ccafe89e` | reused rows in ledger spec | row anatomy (progress/request/decision/message rows) | rows moved to the ledger panel, never Chat | §S7 + R9-4 |CONFIRMED — DROP as Chat; visual reuse in team-ledger.client.spec.tsx|
| `tests/team-members-model.client.spec.ts` | `test/team-members-model.client.spec.ts` | MECHANICAL ADAPT (lifecycle/template fixtures) | `482a0ded` | +202/-89 | `deriveTeamMembers` (member grouping R9-2) | lifecycle/template fixtures | §S7 |CONFIRMED — incl. bug #5 template-row expectations (F-10)|
| `tests/team-members.client.spec.tsx` | `test/team-members.client.spec.tsx` | MECHANICAL ADAPT | `6f59353c` | +186/-146 | `TeamMembers` (current-session highlight, navigation R9-2) | lifecycle labels/visuals | §S7 |CONFIRMED — zero-instance rows per UI §16.1|
| `tests/team-plugin.client.spec.tsx` | `test/team-plugin.client.spec.tsx` | ADAPT (new registrations + explicit absence of marker) | `d5e60bfa` | +277/-226 | plugin registration (R9-2) | vNext registrations + marker absence | **excluded from the vitest runnable surface** (jsdom tsx class — §F S9-env task); registration behavior additionally covered by runnable `client-plugin-mount.test.ts` + `client.test.ts` |CONFIRMED — excluded from node runnable surface (F-7); runnable twin client-plugin-mount.test.ts; marker absence pinned in runnable negatives|
| `tests/team-tasks.client.spec.tsx` | `test/team-activity.client.spec.tsx` | ADAPT (to activity row) | `5e364840` | +94/-109 | task-row anatomy (7 legacy tests mapped, per spec header L4) | task authority → frozen ProgressValue labels; raw-id fallback dropped (moved to adapter); empty state kept | §S7 + §8.11 |CONFIRMED — mapped to activity row spec|
| `tests/team-timeline-model.client.spec.ts` | `test/team-timeline-model.client.spec.ts` | MECHANICAL ADAPT | `786b6c9d` | +210/-126 | `deriveTeamTimeline`, `teamTimelineTicks`, `formatTeamClock`, `formatTeamDuration` | vNext interval input | §S7 |CONFIRMED|
| `tests/team-timeline.client.spec.tsx` | `test/team-timeline.client.spec.tsx` | MECHANICAL ADAPT | `5828ed01` | +126/-78 | `TeamTimeline` (timeline interactions R9-2) | model prop rewiring | §S7 |CONFIRMED|
| `tests/team-view.client.spec.tsx` | `test/team-view.client.spec.tsx` | ADAPT (store/zero-state/section composition) | `9f07bad1` | +400/-159 | `resolveTeamView` (frozen team-ness derivation), `TeamView` (Team zero-state R9-2) | store/zero-state/section composition onto vNext shell | §S7 |CONFIRMED|

**Counts:** DROP 2 (#6, #7 — replaced by negative/ledger-row tests) / MECHANICAL ADAPT 6 / ADAPT 6. 14/14 migrate-or-drop
evidence complete (DoD 10).

## D. New vNext modules (no legacy counterpart — REIMPLEMENT by definition) + R9-3 budget check

| P9 file | Role | R9-3 budget (L1989–2002) |
|---|---|---|
| `src/transport/team-remote-client.ts` | frozen Remote client | IN BUDGET (listed) |
| `src/state/team-projection-store.ts` | projection store (REIMPLEMENT orchestration, §6.2) | IN BUDGET |
| `src/state/team-ledger-store.ts` | ledger store (REIMPLEMENT orchestration, §6.4) | IN BUDGET |
| `src/model/team-ui-snapshot.ts` | TeamUiSnapshot (§7) | IN BUDGET |
| `src/model/projection-adapter.ts` | normalized adapter (S3) | IN BUDGET |
| `src/model/ledger-adapter.ts` | normalized adapter (S3; feed-model landing) | IN BUDGET |
| `src/ui/TeamCreationPanel.tsx` | New Team creation flow (§10.1) | IN BUDGET as `TeamCreateFlow.tsx` (renamed) |
| `src/ui/TeamGovernance.tsx` + `src/ui/TeamMemberDialogs.tsx` | command panels (archive/restore/dispose, member create) | IN BUDGET as `TeamConfigPanel.tsx / command panels` |
| `src/model/{team-governance,team-handoff,team-intent-model,team-legacy,team-member-commands}.ts` | model-layer helpers for the above (no UI) | NOT explicitly listed — model layer, not "主文件"; **reviewer to confirm budget fit** |
| `src/plugin/team-mount-core.ts` | split of legacy `index.ts` registration (migrated logic, not from-zero) | n/a (has legacy counterpart) |
| `src/state/team-session-resolution.ts` | session resolution (S6 seam) | **reviewer to confirm budget fit** |
| `src/transport/host-seams.ts` | public seam bindings (S0 seam map) | **reviewer to confirm budget fit** |

**R9-3 stop check (L2004–2013):** `NewTimeline.tsx` / `NewMembers.tsx` / `NewDock.tsx` / `NewTeamFeed.tsx` — **none exist** at the
audited tip. PASS.

## E. R9-2 behavioral carry-over (8 scenario groups) — all present

| Scenario group | P9 evidence (runnable surface unless noted) |
|---|---|
| timeline interactions | `team-timeline.client.spec.tsx` |
| member grouping | `team-members-model.client.spec.ts`, `team-members.client.spec.tsx` |
| current-session highlight | `team-members.client.spec.tsx` (`data-current`) |
| session navigation | `team-ledger-model.client.spec.ts` (row navigation targets), `team-timeline.client.spec.tsx` (click-to-session) |
| dock collapse/expand | `team-dock.client.spec.tsx` |
| feed window/load/retry | `team-ledger.client.spec.tsx` (load-earlier + `data-feed-load-failed` retry), `team-activity.client.spec.tsx` |
| Team zero-state | `team-view.client.spec.tsx` (`data-team-zero`) |
| plugin registration | `client-plugin-mount.test.ts`, `client.test.ts` (runnable) + `team-plugin.client.spec.tsx` (excluded jsdom class) |

## F. S9 findings (additions to S1 F-1/F-2/F-3, which remain valid)

- **F-4 (layout, non-blocking):** S1 planned `model/team-feed-model.ts` as a standalone file; the implementation landed the feed
  semantics in `model/team-ledger-model.ts` (constants/window — in-code citations L40–44) + `model/ledger-adapter.ts` (entry
  adaptation). The §9 "Feed model" band is assessed against the combined landing. No plan violation (§8.8 names the rewrite, not
  the file).
- **F-5 (layout, non-blocking):** locales landed at `src/ui/locales.ts` (S1 draft said "client package root"); the plan §5 layout
  allows `ui/*`; no functional difference.
- **F-6 (layout, non-blocking):** `TeamTasks.tsx`/`TeamFeed.tsx` legacy names did not survive — the activity UI is
  `ui/TeamActivity.tsx` and the ledger UI is `ui/TeamLedger.tsx` (renamed per §8.9's own "renamed" language). No `New*` file
  created (R9-3 stop check PASS).
- **F-7 (test-surface, carried to P10 handoff):** `client-bundle.client.spec.ts` and `team-plugin.client.spec.tsx` (and the marker
  pair) are excluded from the client vitest runnable surface by `packages/client/vitest.config.ts` L37–45; the 10 remaining
  `.client.spec.tsx` jsdom specs run in the same vitest process (`// @vitest-environment jsdom`). The jsdom-class environment
  decision (install jsdom + alias vs documented deferral) is the S9 environment task tracked in `p9.next`; it does not change any
  column-9 verdict here because every excluded spec has a runnable-surface or tool-based evidence twin (bundle: `s8-bundle.mjs` +
  `s8-validate.mjs`; plugin: `client-plugin-mount.test.ts`).
- **F-8 (gate surface, new in S9):** `pnpm lint` was never run at baseline validation (first full run at S9 → 778 errors,
  pre-existing + P9-era); `pnpm -r run test` exposed two testkit vitest-surface failures (`.tmp-fault` scan race; Vite `..`-clamp
  in `t6-1-no-agent-dependency` dynamic imports) — both are test-infrastructure, not product/client defects. Fixes in flight
  (S9 early-fix + lint/testkit commits); the reviewer's column-9 pass must run against the green-gate tip.

- **F-9 (hygiene, carried to P10):** the untracked `.js/.d.ts/.map` burst that struck four times in earlier phases did NOT
  recur during the S9 gate runs — `git status --porcelain -- packages/` clean immediately after the test gate and again after
  all five gates (dist artifacts gitignored). The emitter remains unidentified; keep the post-test-gate status check in P10.
- **F-10 (latent-defect class, verified):** the client suite was never executable before the S9 rebuild — specs and product
  landed together across T7–T10 (`5baf149` / `cda5737` / `d4e6eb1` / `683e15a`) and no client run ever turned green; the S9
  first run exposed 22 latent failures (7 files: members-model 4, members 1, members-actions 3, ledger 1, creation-panel 1,
  handoff 3, governance 9) with 11 root causes — 5 product gaps + 5 spec defects + 1 infra defect — each fixed in-tree with
  in-file citations and independently re-verified against the frozen contract (full table: `s9-verdict.md` §T-g). First-execution
  findings already fixed at the audited tip: not a REPAIR trigger.
- **F-11 (infra, verified):** `packages/client/vitest.config.ts` was rebuilt in `0738b45` to make the suite executable:
  linked-dsh-source-redirect plugin (`@deepseek-ai/*` → src, mirroring the upstream tsconfig-paths facade — built Cordis
  `__ModuleLoader__` factory bundles cannot load outside the browser shell), uSES extensionless-entry alias, inline patterns
  with a `node_modules` negative lookahead (Vite 8 inlines CJS as ESM; uSES stays external — Node 24 type-stripping loads
  externalized `.ts` natively), `noUncheckedIndexedAccess` guards on the redirect lookup, jsdom ^30.0.1 client devDep, single
  React 18.3.1 instance, environment node + pool threads. Runnable surface: 34 tracked test files − 2 live exclude entries
  (`client-bundle`, `team-plugin`; 2 further entries point at the already-removed marker pair) = 32 files / 471 tests, all
  green at `0738b45`.
- **F-12 (minor, non-blocking):** (a) dead locale key `governance.override.reading` (locales.ts, unused); (b) eslint `tests/**`
  ignore targets the root characterization harness (consistent with the config header scope statement); (c) the "typecheck 9/9"
  gate wording counts the root workspace project (its script delegates via `pnpm -r`); the actual tsc surface is 8 packages,
  independently all EXIT 0 (legacy is build-only by design); (d) TeamView.tsx numstat ±1 (292 vs 293 additions); (e) client src
  count is 42 files (31 ts/tsx + 1 d.ts + 10 css) at both `47b41df` and `0738b45` — the "38" figure in earlier notes is stale;
  (f) CSS line-count trailing-newline convention (199/170 measured vs 200/171 recorded; byte-identical); (g) F-7's "L37–45"
  config cite and "10 remaining jsdom specs" count are stale after the rebuild (excludes now at L169–178; 11 runnable
  jsdom-docblock specs at the tip).

## G. Verdict

- Per-file `Reviewer verdict` (column 9): **CONFIRMED 47/47, CHALLENGED 0** — independent L2 reviewer (S9 owner per plan
  L1739), 2026-09-04, audited tip `0738b45`. Per-row record with the two nuance notes (TeamView numstat ±1; CSS
  trailing-newline convention) in the cells; full adjudication in `s9-verdict.md` §T-d.
- `P9_VERDICT = GO | REPAIR | CONTRACT_BLOCKER`: **GO** — issued by the independent L2 reviewer after the column-9 pass,
  the DoD-15 evidence mapping (row 11 released), and the five green gates independently re-run at `0738b45` (test: 8/8
  packages EXIT 0 with exact counts 150/312/269/124/35/92/1070/471; typecheck: 8/8 tsc-surface packages EXIT 0; build 9/9
  EXIT 0; lint 0 errors; smoke 2/2 PASS). Sandbox-adaptation disclosure: literal `pnpm -r run …` blocked by the documented
  workspace-write EPERM spawn boundary — equivalents run per-package/direct; no tree defect implied. Full rationale:
  `s9-verdict.md`.
