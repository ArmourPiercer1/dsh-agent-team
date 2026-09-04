# P9-T10 — Legacy ui-team test assertion diff (read-only research)

Purpose: enumerate ALL behavioral assertions in the 14 legacy ui-team test specs (frozen at blob 506191b, verbatim copies in `dev/agent-workflow/evidence/P9/legacy-506191b/packages/client/ui-team/tests/`) and diff them against the corresponding vNext specs in `packages/client/test/`, so the main builder knows exactly which legacy behaviors are NOT yet covered.

## 0. Baseline, method, conventions

- **Baseline**: worktree branch tip `d4e6eb1` (P9-T9), plus the main builder's in-flight T10 state observed at review time (see §0.1 below). This review is strictly read-only; nothing was staged, committed, or touched.
- **Legacy source of truth**: `dev/agent-workflow/evidence/P9/legacy-506191b/packages/client/ui-team/tests/` (14 specs) + `src/client/` for the marker deep-dive.
- **Method**: each legacy spec read in full; every `it`/`test` (including `it.each` and nested describe context) enumerated with verbatim title + one-line behavioral assertion + legacy-vocabulary dependencies. Every (c) "already covered elsewhere" citation was independently re-verified by the reviewer against the cited vNext file's actual `it` titles (grep). Every (a) portable target was verified to exist, and the cited module mechanics were re-read where claimed.
- **Counting convention**: `N` = legacy `it`/`it.each` entries (an `it.each` counts as ONE entry; expanded case count noted where relevant). `M` = `it` count in the vNext counterpart file. `G` = legacy assertions with no direct equivalent in the vNext counterpart file. `covered = N − G`. A (c) gap counts in `G` for the file but is covered elsewhere (citation given).
- **Forbidden legacy vocabulary** (flagged per assertion; grounds (b) when tied only to it): `TeamSessionEvents`, `TeamMarker`/`ConversationNodeDefinition`/`conversation.chat.node` registration, `TeamMirror`, `sessions.teams` face, wire `pageMessages`/`messagesBefore` anchor paging, DOM manipulation (tablist scan, flow-seat scroll), `@deepseek-ai/dsh-client-runtime` client APIs, `@deepseek-ai/dsh-team`, legacy `TeamView` status vocabulary (`bound`/`running`/`settled`/`unbound`).

### 0.1 In-flight T10 state (observed, not modified)

`git status --porcelain` at review time:

```
D  packages/client/test/team-marker-definition.client.spec.ts   (staged deletion)
D  packages/client/test/team-marker.client.spec.tsx             (staged deletion)
 M packages/client/tsconfig.json                                (unstaged)
?? packages/client/test/client-architecture-negatives.test.ts   (untracked)
?? packages/client/test/team-remote-categories.test.ts          (untracked)
```

Verified facts about this state:

1. **The deleted vNext marker pair is byte-identical to the legacy evidence** (git blob identity, reviewer-verified via `git hash-object` vs `git ls-tree d4e6eb1`): `team-marker-definition.client.spec.ts` = blob `9ff87443691b100bada4b8f162d52d8bab4a8b45` (376 lines); `team-marker.client.spec.tsx` = blob `ccafe89e4378b923849a7fe1b4e62faf58a1422d` (337 lines). Deleting them loses no vNext-authored content.
2. **The in-flight `tsconfig.json` diff deletes the `exclude` block** that at d4e6eb1 kept `test/client-bundle.client.spec.ts`, `test/team-plugin.client.spec.tsx`, and the two marker files OUT of typecheck. With the marker files deleted, the two remaining frozen copies (below) are back in typecheck scope and will fail until migrated or removed.
3. **`client-architecture-negatives.test.ts` (untracked, 9 `it`s, "P9-T10 (P9-S7) negative architecture")**: source-text absence scan over every `.ts`/`.tsx` under `packages/client/src` for 7 tokens, plus a walk-coverage guard (`scanned.length > 20`, includes `plugin/client.ts`, `plugin/team-mount-core.ts`, `ui/TeamView.tsx`) and a live-detector control sample. **As written it currently FAILS 3 of its 7 absence scans** (plain `text.includes`, no comment stripping) — see §6.4 below for the exact colliding lines.
4. **`team-remote-categories.test.ts` (untracked, 5 `it`s)**: `P9-T10 (P9-S7) command flows — override / policyState / compatibility` — typed-error pass-through over the remote command flows. Not a counterpart of any of the 14 legacy client specs (legacy had no such client-side flows); noted for completeness only.

### 0.2 Two mapped "counterparts" are frozen legacy copies, not vNext successors

Reviewer-verified by SHA-256 of both paths:

| vNext file (in `packages/client/test/`) | Legacy evidence file | Identity | Consequence |
|---|---|---|---|
| `client-bundle.client.spec.ts` (121 lines) | `client-bundle.client.spec.ts` | byte-identical, sha256 prefix `92512fa2fbc118c9` on both | Targets `packages/client/ui-team/lib/client.js`, which **does not exist** in the vNext tree (`packages/client/` has only `src`, `test`, configs). All 3 `it`s are `it.skipIf(code === undefined)` → **always skipped; dead coverage**. |
| `team-plugin.client.spec.tsx` (242 lines) | `team-plugin.client.spec.tsx` | byte-identical, sha256 prefix `f1cfa2b9006c21e3` on both | Imports `../src/client/index.ts`, `../src/client/TeamSettingsSection.tsx`, `../src/client/locales.ts`, `../src/invariant.ts` — **none exist** (`packages/client/src` top level is: `css-modules.d.ts`, `index.ts`, `model/`, `plugin/`, `state/`, `transport/`, `ui/`). The file cannot typecheck once re-included by the tsconfig diff. |

The genuine vNext plugin surface is `packages/client/src/plugin/team-mount-core.ts` + `plugin/client.ts`: registers exactly three slots (`settings.section` id `team` order 50, `conversation.view` id `team` order 20, `conversation.input.dock` id `team` order 15), `inject = ['slots','locale','sessions','connection','remote']`, doc comments explicitly record NO `conversation.chat.node` marker registration, and is tested by `client-plugin-mount.test.ts` (24 `it`s, driven against a structural double of the five public seams) and `client.test.ts` (2 `it`s: stable identity marker + Cordis plugin shape).

---

## 1. client-bundle (legacy -> vNext `client-bundle.client.spec.ts`)

- Legacy: `tests/client-bundle.client.spec.ts` (121 lines, `describe('tsdown client artifact')`)
- vNext: `packages/client/test/client-bundle.client.spec.ts` — **byte-identical frozen legacy copy** (see §0.2); all 3 `it`s are `it.skipIf` against a missing artifact.
- **N = 3, M = 3, G = 0, covered = 3.**

### Legacy assertions (N = 3)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | tsdown client artifact › hands off with the manifest id and a DI-require factory | Executing the built `packages/client/ui-team/lib/client.js` through `window.__ModuleLoader__.load` with an injected require → `handoff.id` is the plugin id, `exports.apply` is a function, and `exports.inject` is exactly `['slots', 'locale', 'conversationEvents', 'sessions']` | `conversationEvents` in the inject list (legacy marker/ConversationEventRegistry seam); `@deepseek-ai/dsh-client-runtime/client` external |
| 2 | tsdown client artifact › mounted as an object plugin, apply registers the definition and keyed renderer on the real ring | Mounting the artifact exports into a real cordis Context (SlotRegistry + ConversationEventRegistry; root ring declared with `conversation.chat.node` keyed, `conversation.input.dock` list, `settings.section` list) → chat.node 1 entry key `team-marker`, settings.section 1 id `team`, event kinds `['team-marker']`, input dock 1 id `team` order 15; after `fiber.dispose()` all three rings and the event registry are empty | TeamMarker + `conversation.chat.node` registration; `ConversationEventRegistry` and other `@deepseek-ai/dsh-client-runtime/client` seams |
| 3 | tsdown client artifact › injects plugin-tagged module CSS during factory execution | Artifact factory execution injects a `<style data-plugin="@deepseek-ai/dsh-client-ui-team">` element → `document.querySelectorAll` finds ≥ 1 such tag | document/DOM manipulation (jsdom probe of injected style tags) |

### vNext spec tests (M = 3)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | tsdown client artifact › hands off with the manifest id and a DI-require factory | Identical: handoff id + `apply`/`inject` shape (inject still `['slots','locale','conversationEvents','sessions']`) |
| 2 | tsdown client artifact › mounted as an object plugin, apply registers the definition and keyed renderer on the real ring | Identical: real-ring registration of team-marker (chat.node key, settings.section id, event kind, input dock id/order) and full teardown on dispose |
| 3 | tsdown client artifact › injects plugin-tagged module CSS during factory execution | Identical: ≥ 1 plugin-tagged `<style>` after factory execution |

### Gaps (G = 0)

None — every legacy assertion has a verbatim equivalent in the vNext spec.

> **Structural note (reviewer-verified)**: the vNext "coverage" is nominal only — the spec is a frozen copy of the legacy test and its artifact path (`packages/client/ui-team/lib/client.js`) does not exist in the vNext tree, so all three tests skip. The vNext client package itself has NO executable bundle test (its entrypoint `src/index.ts` exports only `PACKAGE_ID = 'client'`; the executable behavior lives in `src/plugin/` and is covered by `client-plugin-mount.test.ts`). If T10 keeps this file, it is inert documentation; if it migrates it, it must target the vNext artifact shape (which currently has no marker registration to assert — see §6).

## 2. team-dock-model (legacy -> vNext `team-dock-model.client.spec.ts`)

- Legacy: `tests/team-dock-model.client.spec.ts`; vNext: `packages/client/test/team-dock-model.client.spec.ts`
- **N = 8, M = 9, G = 2, covered = 6.**

### Legacy assertions (N = 8)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | deriveTeamDockCounts › reads N as the running rows' bound sessions, the leader row included | TeamView with lead running `[LEADER]`, a running `[SA]`, b bound `[SB]` → `{ runningSessions: 2, pendingControls: 0 }` (bound-but-not-running row not counted) | `TeamView` type from `@deepseek-ai/dsh-client-runtime/client` |
| 2 | deriveTeamDockCounts › counts a multi-session running row once per bound session | Member a running with `sessionIds ['sa1','sa2']` → `runningSessions` 2 (one per bound session) | `TeamView` (multi-session member row) |
| 3 | deriveTeamDockCounts › reads M as the pending sum over every row, leader and unbound alike | lead bound pending 2 + a bound pending 1 + b unbound pending 0 → `{ runningSessions: 0, pendingControls: 3 }` (M = per-row pendingControlCount sum over all rows) | `TeamView` per-row `pendingControlCount` sum; 'unbound' member status |
| 4 | deriveTeamDockCounts › reads zero from a fully idle team | All rows bound with zero pending → `{ runningSessions: 0, pendingControls: 0 }` | `TeamView` |
| 5 | deriveTeamDockContent › lists the bound rows in members order, the leader row included, and skips unbound rows | Default view (lead bound, a running, b unbound) → expanded members `[{lead…bound}, {a…running}]` in members order, unbound b skipped, tasks `[]` | `TeamView` 'unbound' status (skip rule) |
| 6 | deriveTeamDockContent › reads task rows straight through in first-seen order | Tasks t1 in_progress seq 1, t2 blocked seq 2 → 2 task rows in order with subject + status passthrough | `TeamView.tasks` projection field |
| 7 | deriveTeamDockContent › keeps a distinct key per row for a multi-instance member | Two member rows sharing memberId `a` (sa1 running, sa2 bound) → row keys `['a:sa1:0','a:sa2:1']`, all distinct | `TeamView` multi-row-per-memberId list |
| 8 | deriveTeamDockContent › keeps a sessionless non-unbound row (the wire-legal shape) in the member list | Member a status `bound` with `sessionIds []` → kept as `{ key: 'a::0', …, status: 'bound' }` | `TeamView` 'bound'-with-empty-sessions wire shape |

### vNext spec tests (M = 9)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | deriveTeamDockCounts › reads N as the running instances, the leader instance included, and M from the ledger summary | lead RUNNING, a RUNNING, b CREATED; `ledgerSummary.pendingControlCount` 2 → `{ runningSessions: 2, pendingControls: 2 }` |
| 2 | deriveTeamDockCounts › counts a multi-instance member once per running instance | Instances a1 + a2 both RUNNING → `runningSessions` 2 |
| 3 | deriveTeamDockCounts › never counts history-only instances and reads M as the frozen summary value, not a per-row sum | CREATED rows with per-row pending 5/5 + DISPOSED fromHistory row; ledger summary 3 → `{ 0, 3 }` (row pending values ignored) |
| 4 | deriveTeamDockCounts › reads zero from a fully idle team | Single CREATED instance, ledger 0 → `{ 0, 0 }` |
| 5 | deriveTeamDockContent › lists the current-roster instances in snapshot order, the leader instance included, and skips history-only rows | created/running/created + one DISPOSED fromHistory instance → 3 member rows in snapshot order, activities `[]` |
| 6 | deriveTeamDockContent › reads the current-work activity rows straight through in snapshot order | Two snapshot activity rows → passthrough rows in order (subject + status) |
| 7 | deriveTeamDockContent › falls back for the activity row text: subject, else summary, else the live current action | Four activity rows (subject / summary-only / currentAction-only / nothing) → subject fallback chain, no field when none |
| 8 | deriveTeamDockContent › keeps a distinct key per row for a multi-instance member | Instances a1 (RUNNING) + a2 (CREATED) → keys `['a1','a2']`, all distinct |
| 9 | deriveTeamDockContent › keeps a sessionless instance in the member list | Instance a CREATED with `childSessionId` null → kept as `{ key: 'a', …, status: 'created' }` |

### Gaps (G = 2)

- `deriveTeamDockCounts › reads M as the pending sum over every row, leader and unbound alike` — M computed as the per-row `pendingControlCount` sum over every row (2+1+0 = 3) — **(b) OBSOLETE**: the per-row pending sum belongs to the legacy `TeamView` projection surface (`@deepseek-ai/dsh-client-runtime` client seam); vNext explicitly re-binds M to the frozen `ledgerSummary.pendingControlCount` read directly, "never a per-row sum" (vNext test 3 and `packages/client/src/model/team-dock-model.ts` header).
- `deriveTeamDockContent › lists the bound rows in members order, the leader row included, and skips unbound rows` — the "skips unbound rows" exclusion sub-rule (sessionless 'unbound' row b omitted from the expanded content) — **(b) OBSOLETE**: the 'unbound' member status and its skip rule belong to the legacy `TeamView` status vocabulary; the vNext snapshot lifecycle has no unbound state, and the expanded content deliberately keeps sessionless non-history rows (vNext test 9; the vNext skip predicate is `fromHistory` only). The order/leader-included/no-tasks core of this test is directly covered by vNext test 5.

## 3. team-dock (legacy -> vNext `team-dock.client.spec.tsx`)

- Legacy: `tests/team-dock.client.spec.tsx`; vNext: `packages/client/test/team-dock.client.spec.tsx`
- **N = 12, M = 12, G = 2, covered = 10.**

### Legacy assertions (N = 12)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | TeamDockPanel › renders the collapsed D23 readout with both counts on one line | Default TeamView (lead bound, a running pending 2, b unbound; tasks in_progress + completed) → collapsed by default, title 团队, readout `1 运行中 · 2 待裁决` with leading separator, jump button accessible name matches `/团队.*1 运行中.*2 待裁决/` | `TeamView` + per-row pending sum; `TeamMirror` fixture |
| 2 | TeamDockPanel › omits the zero-count readout segments and keeps a bare title when both are zero | Idle (bound, pending 0, no tasks) → no readout and no separator, bare title; pending-only (pending 3) → `3 待裁决` + separator; running-only → `1 运行中` + separator | `TeamView` per-row pending |
| 3 | TeamDockPanel › toggles the expanded body on the chevron and flips aria-expanded | Clicking `[data-team-dock-toggle]` flips `aria-expanded` false→true→false and shows/hides `[data-team-dock-expanded]` | none |
| 4 | TeamDockPanel › lists the member status rows (name + dot) and the task rows when expanded | Expanded → 2 member rows (Lead bound, Alpha running; unbound Beta skipped) with aria-labels `Lead 已绑定` / `Alpha 运行中`, plus 2 task rows `Wire the mirror进行中` / `Ship the dock已完成` with `data-task-status` in_progress/completed in projection order | `TeamView` 'unbound' status (skip) + `tasks` projection |
| 5 | TeamDockPanel › covers the remaining dot states: settled member, pending and blocked tasks | Settled member → `memberStatus` 'settled', aria-label `Lead 已结算`; pending task → `Next step待开始` (`data-task-status` pending); blocked task → `Stuck step受阻`; readout absent | `TeamView` 'settled' member status + task status 'pending' (待开始) |
| 6 | TeamDockPanel › shows the one-line empty notes while the team carries no member status or task | Team with only an unbound member and no tasks → expanded body shows `暂无成员状态` + `暂无任务进度`; readout absent | `TeamView` 'unbound' status |
| 7 | TeamDockPanel › activates the team tab when the jump entry is clicked, without toggling the expansion (D13) | Jump entry carries title `打开团队标签页` with no aria-label override; clicking calls `openTeamTab` once and leaves the expanded body hidden | none |
| 8 | TeamDockPanel › renders the English dictionary pairing | `en` dict → title `Team`, readout `1 running · 2 pending`, 2 member rows (unbound skipped), no `No task progress yet`, `In progress` present | `TeamView` (2-row count assumes unbound-skip) |
| 9 | TeamDock › renders nothing for a non-team session and cold-pulls the mirror gap once per mount | Empty `TeamMirror` + OUTSIDER session → no dock, `ensureTeam(OUTSIDER)` called once; re-render while mirror stays empty does not re-fire (single-flight per mount) | `TeamMirror` + `useTeamMirror` adapter + `SessionId` (legacy runtime seams) |
| 10 | TeamDock › renders the panel for the member session resolved through the binding (no cold pull) | MIRROR + MEMBER session (member's bound session) → dock renders with the readout; `ensureTeam` not called | `TeamMirror` |
| 11 | TeamDock › appears when the cold pull lands and stops pulling once the mirror gains the session | Empty mirror + LEADER → one pull; re-render with MIRROR → dock appears; still exactly one pull | `TeamMirror` |
| 12 | TeamDock › threads the jump callback through the adapter to the jump entry (D13) | MIRROR + LEADER + `openTeamTab` → clicking the jump entry calls `openTeamTab` once | `TeamMirror` |

### vNext spec tests (M = 12)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | TeamDockPanel › renders the collapsed D23 readout with both counts on one line | Snapshot (lead created, a running, b created sessionless; ledger pending 2) → collapsed, 团队, `1 运行中 · 2 待裁决` (N from lifecycle, M from frozen summary), separator, jump name regex |
| 2 | TeamDockPanel › omits the zero-count readout segments and keeps a bare title when both are zero | Idle / pending-only (ledger 3) / running-only → bare title, `3 待裁决`, `1 运行中` |
| 3 | TeamDockPanel › toggles the expanded body on the chevron and flips aria-expanded | Same toggle + aria-expanded flip behavior |
| 4 | TeamDockPanel › lists the member status rows (name + dot) and the activity rows when expanded | All 3 current-roster instances listed in members order ("the unbound-skip is abolished with the unbound vocabulary"), aria-labels `Lead 已创建` / `Alpha 运行中`, 2 `[data-dock-activity]` rows (`Wire the mirror进行中` in-progress, `Ship the dock已完成` completed) |
| 5 | TeamDockPanel › covers the remaining dot states: an archived member and a blocked activity | Archived member → `memberStatus` 'archived', aria-label `Lead 已归档`; blocked activity `Stuck step受阻`; readout absent |
| 6 | TeamDockPanel › shows the one-line empty notes while the team carries no member status or activity | Empty roster + no activity → `暂无成员状态` + `暂无活动进度`; readout absent |
| 7 | TeamDockPanel › activates the team tab when the jump entry is clicked, without toggling the expansion (D13) | Same jump behavior (title tooltip, no aria-label, one call, no expansion) |
| 8 | TeamDockPanel › renders the English dictionary pairing | `en` dict → `Team`, `1 running · 2 pending`, 3 member rows, no `No activity progress yet`, `In progress` present |
| 9 | TeamDock › renders nothing for a non-team session and cold-pulls the projection-mirror gap once per mount | Empty `TeamProjectionMirror` + OUTSIDER → no dock, `ensureProjection(OUTSIDER)` once; re-render does not re-fire |
| 10 | TeamDock › renders the panel for the member session resolved through the binding (no cold pull) | MIRROR + MEMBER → dock + readout, no pull |
| 11 | TeamDock › appears when the cold pull lands and stops pulling once the mirror gains the session | Empty + LEADER → one pull; MIRROR re-render → dock, still one pull |
| 12 | TeamDock › threads the jump callback through the adapter to the jump entry (D13) | Jump click → `openTeamTab` once |

### Gaps (G = 2)

- `TeamDockPanel › lists the member status rows (name + dot) and the task rows when expanded` — the "unbound skipped" sub-rule (3 fixture rows, one unbound → only 2 member rows rendered) — **(b) OBSOLETE**: the legacy `TeamView` 'unbound' status / skip-unbound rule (`@deepseek-ai/dsh-client-runtime` client seam surface); the vNext spec explicitly abolishes it ("the unbound-skip is abolished with the unbound vocabulary" — vNext test 4 renders all 3 current-roster instances). The same sub-rule underlies the 2-member-row count expectation in legacy test `renders the English dictionary pairing` (vNext asserts 3). The name+dot+label core and the task/activity row rendering are directly covered by vNext test 4.
- `TeamDockPanel › covers the remaining dot states: settled member, pending and blocked tasks` — the "pending task row renders 待开始 with `data-task-status` 'pending'" sub-assertion — **(b) OBSOLETE**: the legacy `TeamView` task status 'pending' (待开始) belongs to the legacy task-status vocabulary (legacy runtime seam surface); the vNext frozen progress set is exactly `['in-progress','completed','blocked']` (`PROGRESS_VALUES` in `packages/contracts/src/projection/states.ts`; `TeamDock.tsx` `ACTIVITY_STATUS_KEYS` has no pending entry). The dot-state mechanism itself is directly covered by vNext test 5 (archived member + blocked activity; 'settled' remains a valid vNext display status with locale `已结算`).

## 4. team-feed-model (legacy "feed") -> vNext `team-ledger-model.client.spec.ts` ("ledger")

- Legacy: `tests/team-feed-model.client.spec.ts`; vNext: `packages/client/test/team-ledger-model.client.spec.ts`
- **N = 19, M = 20, G = 12 (5 × (a), 7 × (b)), covered = 7.**

### Legacy assertions (N = 19)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | deriveTeamFeed › reads the frozen constants (200 default depth, 200 step) | `TEAM_FEED_INITIAL_LIMIT` is 200 and `TEAM_FEED_STEP` is 200 | none (constants) |
| 2 | deriveTeamFeed › mixes approvals and messages into one ascending time order | Approvals (r1@300, r2@100) + messages (seq1@400, seq2@200) → one mixed stream of 4 rows sorted by ascending timestamp: kinds `[approval, message, approval, message]`, `at` `[100,200,300,400]` | `TeamView` approvals/messages (`requestedAt`/`at`) — legacy event-stream projection |
| 3 | deriveTeamFeed › breaks equal times approvals-before-messages and keeps the fold order within each kind | All four rows at t=100 → both approvals first (fold order r1, r2), then both messages (global seq order 1, 2) | Legacy event-stream time-sort tie-break + per-kind fold order |
| 4 | deriveTeamFeed › caps the first render at the most recent 200 rows (D8h) | 250 messages, depth 200 → total 250, 200 rows (newest: seq 50..249), `hasMore` true, window ascending | `TeamView.messages` |
| 5 | deriveTeamFeed › renders the whole representable stream when it fits in 200 rows | 1 approval + 2 messages → all 3 rows, `hasMore` false | `TeamView` |
| 6 | deriveTeamFeed › reports hasMore=false exactly at the representable total | 200 messages: depth 199 → `hasMore` true; depth 200 → false; depth 201 → false (exact boundary flip) | `TeamView.messages` + `messageCount` |
| 7 | deriveTeamFeed › splices older rows ahead of the initial window without duplication or gaps | 450 messages: depth 400 → 400 rows whose tail (rows 200..399) is exactly the initial 200-row window's keys (no duplication/gap), seam seqs 249/250, head 50, tail 449, `hasMore` true; depth 450 → all 450, `hasMore` false, head seq 0 | `TeamView.messages` |
| 8 | deriveTeamFeed › keeps approvals in the spliced window (approvals are never truncated) | 50 approvals (t=0..49) older than 300 messages (t=1000+): depth 200 → 0 approval rows; depth 400 → all 50 approvals + 300 messages, head row is an approval, `hasMore` false (total 350 ≤ 400) | `TeamView` approvals + messages (mixed-kind window) |
| 9 | deriveTeamFeed › counts messages the loaded set does not hold (the loud counted-note fact) | 500 snapshot messages with observed `messageCount` 620, depth 200 → `unloadedMessageCount` 120; fully loaded (10/10) → 0; empty → 0 | `TeamView.messages` + observed `messageCount` |
| 10 | deriveTeamFeed › splices the fetched wire pages ahead of the snapshot window in global order | 50 fetched older messages (sessionId `old-s`, t=500..549) + 250 snapshot messages: total 300, `hasMore` true, depth window = newest 200 (seq 50..249); full depth 300 → page rows splice ahead ascending (head `old-s` seq 0, seam `old-s`:49 → `leader-s`:0, tail 249); 250-window tail stays equal to the initial 200 window's keys | Fetched wire `olderMessages` pages (legacy wire-page input, cross-session) |
| 11 | deriveTeamFeed › counts unloaded messages over the newest observed count, not only the snapshot | Observed-count logic: page closing the gap (500 + 120 older, depth 620) → 0; page outrunning the snapshot (observed 700, 20 loaded of 500-page, depth 300) → 180; observed 100 with 50 loaded, depth 0 → 50; observed 100 below the 120 loaded rows → 0 (no negative remainder) | `messageCount` observed count + fetched wire pages |
| 12 | deriveTeamFeed › exposes the oldest loaded message as the page anchor, approvals aside | `oldestMessage` = oldest loaded message row (approvals never the anchor); a fetched older page becomes the new anchor source; approvals-only stream → `undefined` | Legacy backward wire-page anchor (`oldestMessage`/`messagesBefore`) |
| 13 | deriveTeamFeed › resolves member names and binds approval rows to the member session (D19) | Member join: approval for memberId `a` → `memberName` `Name-a` + `sessionId` `a-s`; unknown `ghost` → raw-id fallback (`ghost`, `''`); message from/to names resolved the same way | `TeamView.members` sessionIds join (D19) |
| 14 | deriveTeamFeed › binds approval rows to the empty session for unbound members | Member `a` with status 'unbound' and `sessionIds []` → its approval row gets `memberName` `Alpha` and `sessionId` `''` | `TeamView` 'unbound' status + empty sessionIds |
| 15 | deriveTeamFeed › uses the first member row when rows share a memberId (multi-instance interface) | Two member rows with memberId `a` (a-s1, a-s2) → joins use the first row (`Name-a`, `a-s1`) for the approval and the message from-name | `TeamView` multi-row-per-memberId list |
| 16 | deriveTeamFeed › keeps the row keys stable across invocations and frames | Row keys are `approval:r1` and `message:leader-s:1`; identical across repeated invocations | `TeamView` row shapes (key material) |
| 17 | deriveTeamFeed › re-derives the window over a new frame at the same depth (the depth is a count) | Frame 1 (250 messages) at depth 200 → head seq 50; frame 2 (5 newer messages) at the same depth 200 → total 255, 200 rows, head slides to seq 55, tail seq 254 (window re-derives, depth stays a count) | `TeamView.messages` frames |
| 18 | deriveTeamFeed › returns an empty model for an empty stream | Empty view → `{ rows: [], total: 0, hasMore: false, unloadedMessageCount: 0, oldestMessage: undefined }` | none |
| 19 | deriveTeamFeed › clamps the depth to the representable bounds | 2-row stream: depth 1000 → 2 rows, `hasMore` false; depth 0 → 0 rows, `hasMore` true, total 2 (both clamp bounds) | `TeamView` |

### vNext spec tests (M = 20)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | deriveTeamLedgerSection › keeps the frozen depth constants from the legacy feed model | `TEAM_LEDGER_INITIAL_LIMIT` and `TEAM_LEDGER_STEP` are 200/200 |
| 2 | deriveTeamLedgerSection › orders rows by the durable sequence, never by the timestamp | seq-2 entry carries the earlier timestamp → rows still ordered `[1, 2]` by sequence |
| 3 | deriveTeamLedgerSection › caps the window at the most recent 200 filtered rows, oldest first | 250 entries → 200 rows (seq 51..250), total 250, `hasMore` true |
| 4 | deriveTeamLedgerSection › shows the whole loaded stream when it fits the window | 100 entries → 100 rows, `hasMore` false |
| 5 | deriveTeamLedgerSection › deepens from a smaller depth over the loaded set (the depth axis) | 10 entries, `loadedCount` 5 → rows are the most recent 5 (seq 6..10), `hasMore` true |
| 6 | deriveTeamLedgerSection › clamps the depth to the filtered total | 10 entries, `loadedCount` 500 → 10 rows, `hasMore` false |
| 7 | deriveTeamLedgerSection › filters by category and skips rows without the category | `category: 'message'` filter over message/control/un-categorized entries → only seq 1, total 1 |
| 8 | deriveTeamLedgerSection › filters by instance id on the row actor | `instanceId: 'mate'` → only the mate-actor row, `actorLabel` `Mate` |
| 9 | deriveTeamLedgerSection › filters by template id through the actor template | `instanceId: 'tpl-mate'` (template id) matches through the actor's template |
| 10 | deriveTeamLedgerSection › excludes actor-less rows under an active instance filter | Actor-less `team-work-admitted` row is excluded under an instance filter |
| 11 | deriveTeamLedgerSection › reports the partial-ledger remainder and zero before the total is known | total 100 / completeThrough 60 → `remainingCount` 40; total null → 0; complete ledger → `complete` true, remainder 0 |
| 12 | deriveTeamLedgerSection › resolves actor labels from the snapshot and falls back to the raw id | `mate` → `Mate` from snapshot members; unknown `ghost` → raw id |
| 13 | deriveTeamLedgerSection › resolves navigation to the member child session and the team root | mate (has child session) → MEMBER; lead (childSessionId null) → team root LEADER; unknown → `''` |
| 14 | deriveTeamLedgerSection › joins control requests to their pending state from the loaded chains | `control-request-recorded` rows join the loaded control chains: r1 → `pending` true, summary `write_file`, actorLabel `Mate`; r2 → `pending` false |
| 15 | deriveTeamLedgerSection › renders control decisions with the value, the reason, and the scope actor | `control-decision-recorded` → `decisionValue` deny, `decisionReason`, scope `actorInstanceId`, summary contains deny |
| 16 | deriveTeamLedgerSection › reads the frozen message from/to leaves per fact type | `team-message-delivered` → recipient actor + subject + detail `→ Mate`; `team-coordination-recorded` → caller actor + subject |
| 17 | deriveTeamLedgerSection › joins interval closes to the paired interval instance without guessing | `activity-interval-closed` with correlation corr-1 joins the opened interval's instance (`mate`, summary `done`); orphan corr-404 → no actor, no navigation |
| 18 | deriveTeamLedgerSection › renders progress rows with the frozen progress value | `activity-progress-recorded` → kind `progress-recorded`, `progressValue` `in-progress`, subject summary, lastAction detail |
| 19 | deriveTeamLedgerSection › renders unknown fact types as the safe generic row without throwing | `future-fact-type` → kind `unknown`, no category, summary = factType, detail with `#seq`/timestamp/lossless payload, empty actor/session (no guessing, no throw) |
| 20 | deriveTeamLedgerSection › uses the stable ledger key and the empty model | Row key is `ledger:7`; empty derive → `rows []`, total 0, `hasMore` false |

### Gaps (G = 12)

- `deriveTeamFeed › mixes approvals and messages into one ascending time order` — the mixed-kind stream sorted by ascending timestamp (requestedAt/at) — **(b) OBSOLETE**: the timestamp-mixed order belongs to the legacy feed's event-stream surface (legacy `TeamView` approvals/messages; vNext has no team session events); plan §8.8 (recorded in the vNext spec header and `team-ledger-model.ts` header L16–17: "The sort identity is the durable `sequence` — never timestamp-only") re-binds the sort identity to the durable ledger sequence — vNext test `orders rows by the durable sequence, never by the timestamp`.
- `deriveTeamFeed › breaks equal times approvals-before-messages and keeps the fold order within each kind` — the equal-time approvals-before-messages tie-break and the per-kind fold order — **(b) OBSOLETE**: same dropped legacy event-stream time-sort surface; in vNext each ledger entry has a unique durable `sequence`, so there is no equal-time tie-break or per-kind fold (vNext sequence-order test).
- `deriveTeamFeed › reports hasMore=false exactly at the representable total` — the exact boundary flip (depth total−1 → true, depth total → false, depth total+1 → false) — **(a) PORTABLE**: target `packages/client/test/team-ledger-model.client.spec.ts` — reviewer-verified in `packages/client/src/model/team-ledger-model.ts` (L388): `hasMore: limit < filteredTotal` with `limit = Math.max(0, Math.min(loadedCount, filteredTotal))` — assert `loadedCount == filteredTotal` → false and `filteredTotal − 1` → true (the vNext spec pins only the < and > sides, never the exact boundary).
- `deriveTeamFeed › splices older rows ahead of the initial window without duplication or gaps` — the seam property: a deeper window's tail is exactly the shallower window's rows (no duplication/gap) and a full-depth window starts at the first entry — **(a) PORTABLE**: target `packages/client/test/team-ledger-model.client.spec.ts` — reviewer-verified (L383): `rows = items.slice(filteredTotal - limit)` over the loaded set; assert a depth-10 window ends exactly with the depth-5 window's rows and the full-depth window's head is the first entry. The core depth-axis behavior is directly covered by vNext test `deepens from a smaller depth over the loaded set (the depth axis)`.
- `deriveTeamFeed › keeps approvals in the spliced window (approvals are never truncated)` — the mixed-family window: older approvals (control facts) sit outside a shallower window, and the full-depth window keeps every family in order with the oldest fact first and `hasMore` false — **(a) PORTABLE**: target `packages/client/test/team-ledger-model.client.spec.ts` — `deriveTeamLedgerSection` windows uniformly over all filtered fact families (single slice over `items`, reviewer-verified L383); a mixed control + message fixture (e.g. 50 older `control-request-recorded` + 300 newer message entries) asserts the depth-200 window excludes the older control facts, the full-depth window contains all 350 with a control-fact head and `hasMore` false. The single-family window axis is already pinned by vNext tests 3/6.
- `deriveTeamFeed › splices the fetched wire pages ahead of the snapshot window in global order` — fetched older wire pages (`olderMessages`, different recording session) spliced ahead of the snapshot window in global order — **(b) OBSOLETE**: the legacy wire-page input surface (plan §8.8 DROPPED: "splice older ahead / wire pages / oldest anchor / messagesBefore" — `team-ledger-model.ts` header L17–21: "The ledger store pages FORWARD from the ledger head, so there is no 'older than loaded' state"); the vNext store pages forward, asserted by `packages/client/test/team-ledger-store.test.ts` › `pages forward from afterSequence 0 to the tail (tracker-gated, limit honored)`.
- `deriveTeamFeed › counts unloaded messages over the newest observed count, not only the snapshot` — the remainder computed over the newest observed count (max of snapshot `messageCount` and fetched page counts, floored by the loaded set) — **(b) OBSOLETE**: the observed-count derivation over snapshot + wire pages belongs to the dropped legacy wire-page input surface; the vNext remainder is the store-authoritative partial-ledger fact `total − completeThrough` (clamped at 0 — reviewer-verified L384: `remainingCount = total === null ? 0 : Math.max(0, total - completeThrough)`), asserted by vNext test `reports the partial-ledger remainder and zero before the total is known`.
- `deriveTeamFeed › exposes the oldest loaded message as the page anchor, approvals aside` — the oldest loaded message exposed as the backward-fetch page anchor (pages can become the new anchor; approvals-only → none) — **(b) OBSOLETE**: the legacy backward wire-page anchor (plan §8.8 DROPPED "oldest anchor / messagesBefore"); the vNext store pages forward from the ledger head, so no page anchor exists.
- `deriveTeamFeed › binds approval rows to the empty session for unbound members` — an 'unbound' member (empty `sessionIds`) binds its approval rows to the empty session — **(b) OBSOLETE**: the 'unbound' member status and its empty-session binding belong to the legacy `TeamView` status vocabulary; the vNext snapshot resolution navigates sessionless member instances to the team root (vNext test `resolves navigation to the member child session and the team root` asserts the sessionless lead instance → team root), reserving `''` for inert (unresolved) rows.
- `deriveTeamFeed › uses the first member row when rows share a memberId (multi-instance interface)` — the first-row-wins join tie-break for multiple member rows sharing one memberId — **(b) OBSOLETE**: the multi-row-per-memberId member list belongs to the legacy `TeamView` surface; the vNext object model gives every member instance a unique `instanceId`, so the tie-break has no referent; vNext member resolution is asserted by the label/navigation tests 12–13.
- `deriveTeamFeed › re-derives the window over a new frame at the same depth (the depth is a count)` — frame-swap: a newer ledger frame at the same depth re-derives the window (previous head drops out, new rows append at the tail, total updates) — **(a) PORTABLE**: target `packages/client/test/team-ledger-model.client.spec.ts` — `deriveTeamLedgerSection` is a pure function of (entries, loadedCount, filter, total, completeThrough) (reviewer-verified: no closure state); feed frame 1 (250 entries) and frame 2 (5 appended entries) at the same `loadedCount` 200 and assert total 255, 200 rows, the previous head dropped, the 5 new rows at the tail.
- `deriveTeamFeed › clamps the depth to the representable bounds` — the depth-0 lower bound: 0 rows, `hasMore` true, total preserved (the over-clamp half is directly covered by vNext test `clamps the depth to the filtered total`) — **(a) PORTABLE**: target `packages/client/test/team-ledger-model.client.spec.ts` — `deriveTeamLedgerSection` with `loadedCount` 0 → rows `[]`, `hasMore` true, total = filtered total (floor clamp `Math.max(0, …)`, reviewer-verified L382).

## 5. team-feed (legacy "feed") -> vNext `team-ledger.client.spec.tsx` ("ledger")

- Legacy: `tests/team-feed.client.spec.tsx` (one `describe('TeamFeed')`)
- vNext: `packages/client/test/team-ledger.client.spec.tsx` (one `describe('TeamLedger')`; no `it.each`/`skip`/`only`)
- Legacy "feed" (approval + message rows) = vNext "ledger" (fact-row) surface. Legacy spec imports `TeamView` / `TeamMessagePage` / `MessageAnchor` / `RpcResult` from `@deepseek-ai/dsh-client-runtime/client` (forbidden vocab) and `makeTranslate` from `@deepseek-ai/dsh-client-test-runtime`; vNext spec takes `snapshot` / `ledger` / `ledgerState` / `onRetry` / `onSelectSession` / `t` props over the five public seams only.
- **N = 20, M = 19, G = 4 (4 × (b)), covered = 16.**

### Legacy assertions (N = 20)

| # | it (verbatim, `describe('TeamFeed') › it`) | One-line behavioral assertion | Legacy-vocabulary dependency | vNext coverage |
|---|---|---|---|---|
| 1 | `mixes approval and message rows into one ascending list (D8g/D8h)` | Approval rows and message rows render as one list ordered ascending (D8g/D8h). | `TeamView` (runtime client API) | vNext #1 `renders the row families with the frozen category markers` |
| 2 | `shows the plan-kind marker for plan approvals` | An approval with `kind: 'plan'` renders the plan-kind marker (计划审批). | `TeamView` approvals `kind:'plan'` + legacy five-value wire decision vocabulary (`approve_plan`) | **GAP G1** |
| 3 | `badges the unpaired approval as pending with the warning dot` | An approval with no paired decision gets the pending badge + warning dot. | `TeamView` approvals (runtime client API) | vNext #2 `shows the waiting badge (amber dot) on an unpaired control request` |
| 4 | `shows all five decision labels after the request is paired (D8g)` | After pairing, each of the five legacy wire values renders its zh label (单次允许/拒绝/升级给用户/批准计划/要求修订) + reason. | Legacy five-value wire vocabulary `allow_once/deny/escalate_to_user/approve_plan/request_revision` | vNext #3 `renders the three frozen decision labels plus the raw-value fallback` (adapted: 3 frozen values + raw fallback) |
| 5 | `keeps the full text in the summary title (one-line truncation)` | The one-line-truncated summary row carries the full text in `title`. | `TeamView` (runtime client API) | vNext #4 `carries the full detail in the title affordance` |
| 6 | `caps the first render at the most recent 200 rows and offers "load earlier" (D8h)` | First render caps at the most recent 200 rows and offers the "load earlier" control (D8h). | `TeamView` message depth (runtime client API) | vNext #5 `caps the window at 200 rows and offers load earlier` |
| 7 | `appends older rows on "load earlier" without a wire call while the snapshot stream has depth` | While the snapshot stream has depth, "load earlier" appends older rows with no wire call. | `TeamView` snapshot stream (runtime client API) | vNext #6 `deepens the window on load-earlier clicks (local axis only)` |
| 8 | `keeps appending across multiple clicks until the representable stream is loaded` | Repeated clicks keep appending until the representable stream is loaded. | `TeamView` snapshot stream (runtime client API) | vNext #6 (same) |
| 9 | `pages the wire once the snapshot stream is loaded and retires at the observed total` | Once the snapshot is exhausted, pages the wire (`pageMessages`, anchor `{at:1000, sessionId:'a-s', seq:0}`, limit 200) and retires at the observed total (messageCount 620). | Wire `pageMessages` seam: `RpcResult<TeamMessagePage>`, `MessageAnchor`, legacy TeamSessionId event-log paging | **GAP G2** |
| 10 | `chains each page from the newly loaded oldest message` | Each subsequent wire page is anchored at the newly loaded oldest message. | Same wire paging seam as #9 | **GAP G3** |
| 11 | `keeps the button busy while a page is in flight and ignores a double click` | While a wire page is in flight the button stays busy and a double click is ignored. | Same wire paging seam as #9 | **GAP G4** |
| 12 | `shows the loud error note with the counted remainder when a page fails, and retries` | A failed page shows the loud zh note ('更早消息加载失败：…') + counted remainder ('还有 120 条更早的消息暂无法加载') and retries. | Wire paging seam + legacy error-note locale keys | vNext #8 `shows the loud RPC error note and retries through the injected callback` (+ #7 `shows the partial-ledger remainder note and hides it once complete`) |
| 13 | `shows the loud error note for a transport failure folded into the result` | A transport failure folded into the `RpcResult` renders the same loud error note. | Wire paging seam (folded transport loss) | vNext #9 `shows the closed transport-loss reason from a page reject` |
| 14 | `resets the fetched pages when a new snapshot frame lands (depth kept, seam protected)` | A new snapshot frame resets fetched pages (local depth kept, wire seam protected). | Legacy `TeamView` snapshot frame (runtime client API) | vNext #10 `resets the window and the filters on a NEW team only` (adapted: vNext reset is NEW-team-only; same-team frames keep the window) |
| 15 | `stays inert (no wire call) when the view reports messages it does not hold` | When the view reports messages it does not hold (inconsistent view), the feed stays inert and makes no wire call. | `TeamView` consistency (runtime client API) | vNext #12 `switches sessions on row click (D9) and stays inert without a resolved session` (inertness; the no-wire-call aspect is architecturally gone — the vNext component holds no wire seam) |
| 16 | `renders the one-line empty state without rows or controls` | Renders the one-line empty state '暂无审批与消息记录' with no rows or controls. | Legacy empty-state locale key | vNext #11 `renders the empty and the loading states` ('暂无团队事件') |
| 17 | `switches to the message session when a message row is clicked (D9)` | Clicking a message row calls `onSelectSession('a-s')`. | `TeamView` member sessionIds binding (runtime client API) | vNext #12 (same it) |
| 18 | `switches to the requesting member session when an approval row is clicked (D9)` | Clicking an approval row calls `onSelectSession` with the requesting member's session. | `TeamView` member sessionIds binding (runtime client API) | vNext #12 (same it) |
| 19 | `keeps the session-less approval row inert (unbound member)` | An approval row whose member is unbound (no session) renders disabled/inert. | `TeamView` member sessionIds binding (runtime client API) | vNext #12 (ghost → disabled inert) |
| 20 | `renders the English dictionary pairing (including the page-failure notes)` | The en dictionary renders 'Load earlier', 'Loading earlier messages failed: page not programmed', "120 earlier message(s) can't be loaded yet". | Legacy locales dictionary (en) | vNext #18 `keeps the en dictionary pairing for the section chrome` (+ #19 `shows the section empty state from the en dictionary`) |

### vNext spec tests (M = 19)

| # | it (verbatim, `describe('TeamLedger') › it`) | What it asserts |
|---|---|---|
| 1 | `renders the row families with the frozen category markers` | Each fact family renders rows with the frozen zh category markers (工作准入/消息/控制请求/进度/活动结束); interval-close actor joins as 'Mate'. |
| 2 | `shows the waiting badge (amber dot) on an unpaired control request` | Unpaired control request gets the '等待裁决' badge with `data-pending="true"`. |
| 3 | `renders the three frozen decision labels plus the raw-value fallback` | allow/deny/stale-denied render 允许/拒绝/过期拒绝; unknown raw value 'weird-value' renders raw. |
| 4 | `carries the full detail in the title affordance` | The truncated summary carries the full detail in `title` (message detail contains '→ Mate'). |
| 5 | `caps the window at 200 rows and offers load earlier` | Initial window caps at 200 rows with the load-earlier control. |
| 6 | `deepens the window on load-earlier clicks (local axis only)` | Repeated clicks deepen the local window 200→400→500 with no wire/RPC call. |
| 7 | `shows the partial-ledger remainder note and hides it once complete` | '还有 50 条事件未加载' shows while the ledger is incomplete and hides once complete. |
| 8 | `shows the loud RPC error note and retries through the injected callback` | Typed RPC failure → '事件加载失败：boom' + '重试'; `onRetry` called exactly once. |
| 9 | `shows the closed transport-loss reason from a page reject` | A transport-loss page reject renders the closed transport-loss reason. |
| 10 | `resets the window and the filters on a NEW team only` | A NEW team resets the window + filters (category 'all', instance ''); same-team frames keep the window. |
| 11 | `renders the empty and the loading states` | Empty '暂无团队事件' and loading '正在加载团队事件…'. |
| 12 | `switches sessions on row click (D9) and stays inert without a resolved session` | mate → `onSelectSession('team-member')`, lead → 'team-leader', unresolved ghost → disabled/inert. |
| 13 | `renders an unknown fact type as the safe generic row without throwing` | Unknown factType → safe generic row (raw factType marker/summary, no actor, disabled), no throw. |
| 14 | `filters by the client-local category select` | The 9-option category select filters rows locally. |
| 15 | `filters by instance id and by template id through the instance select` | The instance select filters by instance id and by template id (actor 'Lead'). |
| 16 | `renders the decision reason in the state badge` | Decision reason 'out of policy' renders in `[data-ledger-state-reason]` (text + title). |
| 17 | `renders the progress label on progress rows` | Progress 'blocked' → '受阻' with `data-progress`. |
| 18 | `keeps the en dictionary pairing for the section chrome` | en marker 'Message', 'Loading events failed: boom', 'Retry'. |
| 19 | `shows the section empty state from the en dictionary` | en empty 'No team events yet'. |

### Gaps (G = 4)

1. **G1** — `shows the plan-kind marker for plan approvals` — **(b) OBSOLETE.** The legacy `kind:'plan'` approval + five-value wire decision vocabulary (`approve_plan`, locale '计划审批') does not exist in vNext: grep-verified zero matches for '计划审批' / `approve_plan` / `kind: 'plan'` under `packages/client`; vNext renders the three frozen decision values plus the raw-value fallback (vNext #3).
2. **G2** — `pages the wire once the snapshot stream is loaded and retires at the observed total` — **(b) OBSOLETE.** Legacy wire paging via `pageMessages` anchored at the oldest loaded message (`MessageAnchor`, `RpcResult<TeamMessagePage>` from the forbidden `@deepseek-ai/dsh-client-runtime/client`; legacy TeamSessionId event-log paging concept) is dropped. vNext stores page FORWARD from the ledger head (`afterSequence`, frozen page size 50): covered by `packages/client/test/team-ledger-store.test.ts` › `pages forward from afterSequence 0 to the tail (tracker-gated, limit honored)`; the vNext ledger spec header marks wire-page-once-loaded as DROPPED; UI "load earlier" is local window deepening only (vNext #6).
3. **G3** — `chains each page from the newly loaded oldest message` — **(b) OBSOLETE.** Same dropped anchor-paging surface (the next page is derived from the oldest message of the previous page); no vNext analog (forward paging from the store's `afterSequence`; see G2 citation).
4. **G4** — `keeps the button busy while a page is in flight and ignores a double click` — **(b) OBSOLETE.** The busy/double-click guard is tied to the dropped wire-paging seam (vNext "load earlier" is a synchronous local window deepening with no in-flight UI state). Adjacent-but-different coverage: `packages/client/test/team-ledger-store.test.ts` › `a same-team re-open while in flight is queued and re-reads the stable tail` (store-level in-flight queueing) and vNext #11 (section loading state).

## 6. team-marker-definition -> DELETED by T10 (no vNext counterpart; replaced by negative tests)

- Legacy: `tests/team-marker-definition.client.spec.ts` (376 lines; three describes: `team-marker Conversation Definition` L107, `D16 jump target resolution` L292, `whole-card removal` L369)
- vNext counterpart: **none — M = 0.** Staged `D` deletion at HEAD `d4e6eb1`; the deleted vNext copy is byte-identical to the evidence (git blob `9ff87443691b100bada4b8f162d52d8bab4a8b45` == `d4e6eb1:packages/client/test/team-marker-definition.client.spec.ts` — reviewer-verified via `git hash-object`/`git ls-tree`).
- The spec exercised the legacy `conversation.chat.node` marker: `ConversationNodeDefinition` from `@deepseek-ai/dsh-client-ui-conversation/client`, the four legacy team session event types (progress/request/decision/message), and `TeamView`/`TeamMirror` — all forbidden vNext vocabulary (vNext has no Team SessionEvents and registers no conversation chat node).
- **N = 15, M = 0, G = 15 (14 × (b) + 1 × (c)), covered = 0.**

### Legacy assertions (N = 15)

| # | it (verbatim, with describe context) | One-line behavioral assertion | Legacy-vocabulary dependency | Disposition |
|---|---|---|---|---|
| 1 | `describe('team-marker Conversation Definition') › it('extracts the per-event id for each marker type and throws on a non-matching event')` | `teamMarkerId(event)` returns `progress:t1:1` / `request:r1:2` / `decision:r1:3` / `message:4` for the four marker event types and throws `team-marker: unmatched event type "…"` otherwise. | Four legacy team session event types | **GAP G1 (b)** |
| 2 | `describe('team-marker Conversation Definition') › it('matches only the four team event types, one unique start per event')` | `teamMarkerDefinition.match` returns `{id, role:'start'}` only for the four legacy team event types; null for turn/start, tool/call `delegate_to_teammate`, team/member-bound events. | `ConversationNodeDefinition.match` + legacy event types | **GAP G2 (b)** |
| 3 | `describe('team-marker Conversation Definition') › it('renders one row per event: same taskId twice is two rows, a request and its decision are two rows')` | One conversation row per event: same taskId twice → two rows; a request and its decision → two rows (kind 'team-marker', each with anchorSeq). | `conversation.chat.node` row surface | **GAP G3 (b)** — related vNext coverage (chain pairing, not two rows): `ledger-adapter.test.ts` › `pairs the decision onto its request by requestId (pending flips, decision block set)` |
| 4 | `describe('team-marker Conversation Definition') › it('builds each row kind with the payload facts (brand stripped, request kind defaulted)')` | start/update builds each row kind from payload facts (progress `{taskId, subject, status, summary?, memberId}`; request `{requestId, memberId, toolName, reason, requestKind}` defaulting 'tool'; decision `{requestId, decision, reason?}`; message `{from, to, message}`), brand stripped. | `TeamMarkerChatData` union | **GAP G4 (b)** — related: `ledger-adapter.test.ts` › `keeps the frozen wire values and attaches the category from the 12-fact mirror` |
| 5 | `describe('team-marker Conversation Definition') › it('renders nothing when the window carries no team event')` | A conversation window carrying no team event renders no rows. | Conversation window + legacy event types | **GAP G5 (b)** — related: vNext ledger #11 `renders the empty and the loading states` (ledger surface, different) |
| 6 | `describe('team-marker Conversation Definition') › it('replays deterministically: same log through replace or live append gives the same output')` | The same event log through State replace or through live append gives identical output. | Conversation-assembler State (legacy) | **GAP G6 (b)** — related determinism: `team-ledger-model.client.spec.ts` › `orders rows by the durable sequence, never by the timestamp` |
| 7 | `describe('team-marker Conversation Definition') › it('prepends an older page: earlier rows join, existing rows keep key and data')` | Prepending an older page joins earlier rows while existing rows keep key and data. | Backward page prepend (legacy feed paging) | **GAP G7 (b)** — vNext pages forward from the head; local deepening only: `team-ledger-model.client.spec.ts` › `deepens from a smaller depth over the loaded set (the depth axis)` |
| 8 | `describe('team-marker Conversation Definition') › it('stays stable when a turn boundary re-resolves the window')` | A turn-boundary re-resolution of the window leaves built rows stable. | Legacy chat turn-boundary window | **GAP G8 (b)** |
| 9 | `describe('team-marker Conversation Definition') › it('builds the node from State, and builds nothing before a start exists')` | `buildViewNode` builds the node `{key, kind:'team-marker', id, target:'chat', anchorSeq, location:{kind:'unresolved'}, visibility:'visible', data}` from State; null before the event's start exists. | `ConversationNodeDefinition.buildViewNode` + `target:'chat'` | **GAP G9 (b)** |
| 10 | `describe('team-marker Conversation Definition') › it('refuses to fold an event the match cannot produce')` | The definition refuses to fold an event its `match` cannot produce. | Conversation-node fold API | **GAP G10 (b)** |
| 11 | `describe('D16 jump target resolution') › it('targets the assigned member session for progress and request rows')` | progress/request jumps target the assigned member's first bound session (ownSession split). | `TeamView` members/sessionIds | **GAP G11 (c) ALREADY-COVERED-ELSEWHERE** — `team-ledger-model.client.spec.ts` › `resolves navigation to the member child session and the team root` (+ UI level: vNext ledger #12 `switches sessions on row click (D9) and stays inert without a resolved session`) |
| 12 | `describe('D16 jump target resolution') › it('falls back to the row session when the member is unbound or the mirror is absent')` | Jumps fall back to the row session when the member is unbound or the mirror is absent. | `TeamMirror` absence fallback | **GAP G12 (b)** — vNext fallback is the team root, not the row session: `team-ledger-model.client.spec.ts` › `resolves navigation to the member child session and the team root` |
| 13 | `describe('D16 jump target resolution') › it('pairs the decision through the mirror and renders inert when the pair is unknown or unbound')` | Decision jumps pair via mirror approvals; unknown r9 → `{sessionId:'', ownSession:false}`, unbound r2 → `''`, undefined view → `''`. | `TeamMirror` approvals pairing | **GAP G13 (b)** — related: `ledger-adapter.test.ts` › `an orphan decision is emitted only from the writer scope (no invented values)`; inert rendering: vNext ledger #12 |
| 14 | `describe('D16 jump target resolution') › it('keeps the message on its recording session (the row session)')` | Message jumps keep the row's recording session. | `TeamView` row session | **GAP G14 (b)** — related: `ledger-adapter.test.ts` › `a delivered message carries the recipient pair and NO from (the fact names no sender)` (vNext targets the recipient pair, not the recording session) |
| 15 | `describe('whole-card removal') › it('no longer contributes the team-panel renderer kind to the ChatNodeKind merge')` | Type-level: `'team-panel'` no longer extends `ChatNodeKind`, `'team-marker'` does; `definition.kind`/`target` pinned. | Upstream `ChatNodeKind` merge surface | **GAP G15 (b)** — the merge surface is absent in vNext (no `ChatNode*` symbols in `packages/client/src`; see negative-test item 3 below) |

### vNext spec tests (M = 0)

None — no vNext counterpart; the spec is deleted by T10 (staged `D` at `d4e6eb1`, byte-identical to the evidence). The surface is replaced by the "no marker registration" negative test(s) specified below.

### Gaps (G = 15)

G1–G15 as classified in the table above: 14 × (b) OBSOLETE (conversation.chat.node / `ConversationNodeDefinition` / legacy team session event types / `TeamMirror` / `TeamView` binding vocabulary, all verified absent from `packages/client/src`) and 1 × (c) (G11, cited with verified file + exact `it` title).

### Marker definition export surface (basis for the negative test)

Exact export surface of the four legacy files under the evidence `src/client/`:

**`team-marker-definition.ts`** (231 lines)
- `TEAM_MARKER_KIND = 'team-marker'` (const, L31)
- `TeamMarkerChatData` (union type, L34) = `TeamMarkerProgressData` | `TeamMarkerRequestData` | `TeamMarkerControlDecisionData` | `TeamMarkerMessageData`, each extending the NON-exported `TeamMarkerDataBase { seq: number; at: number }`:
  - `TeamMarkerProgressData`: `{ type:'progress'; taskId: string; subject: string; status: TeamProgressStatus; summary?: string; memberId: string }`
  - `TeamMarkerRequestData`: `{ type:'request'; requestId: string; memberId: string; toolName: string; reason: string; requestKind: 'tool' | 'plan' }`
  - `TeamMarkerControlDecisionData`: `{ type:'decision'; requestId: string; decision: TeamControlDecision; reason?: string }`
  - `TeamMarkerMessageData`: `{ type:'message'; from: string; to: string; message: string }`
- Module augmentation (L99–104): `declare module '@deepseek-ai/dsh-client-ui-conversation/client' { interface ChatNodeDataMap { 'team-marker': TeamMarkerChatData } }`
- `teamMarkerId(event)` (L116) — throws `team-marker: unmatched event type "${event.type}"`
- `teamMarkerData(event)` (L140) — `requestKind: data.kind ?? 'tool'`
- `teamMarkerDefinition: ConversationNodeDefinition<TeamMarkerChatData>` (L202) — `kind`, `target:'chat'`, `match` → `{id, role:'start'}` | null over the four event types, `start`/`update` → `teamMarkerData(match.event)`, `buildViewNode` → node | null

**`team-marker-jump.ts`** (77 lines)
- `TeamMarkerJump` (interface, exported): `{ sessionId: string; ownSession: boolean }`
- `resolveTeamMarkerJump(data: TeamMarkerChatData, view: TeamView | undefined, currentSessionId: string): TeamMarkerJump` (exported)
- (non-exported helper) `memberSessionId(view, memberId)` → `view?.members.find(...)?.sessionIds[0] ?? ''`

**`TeamMarker.tsx`** (183 lines)
- `TeamMarkerInjected` (interface, exported): `{ hooks: { teamMirror: ObservableSnapshot<TeamMirror> }; openSession: (sessionId: string) => void }`
- `TeamMarkerProps` (type, exported): `PropsRuntime<'conversation.chat.node','team-marker'> & InjectFace<TeamMarkerInjected> & PropsLocale<'team'>`
- `TeamMarker` (component, exported, L135)
- (non-exported) `PROGRESS_STATUS_KEYS`, `DECISION_KEYS`, `rowParts`

**`TeamMarker.module.css`** (84 lines)
- No runtime exports (styles only): single-line flex row; hover/focus-visible/disabled opacity .55; `.time` tabular-nums; `.marker` chip; `.actor` max-width 220px + ellipsis; `.summary` ellipsis; `.state` chip; `[data-pending='true']` warn colors.

### Recommended "no marker registration" negative-test assertions

Grounded in the verified CURRENT vNext state of `packages/client`:

1. **No `conversation.chat.node` registration.** Package-wide, `packages/client/src` contains exactly three `ctx.slots.register` calls — `settings.section` (id `'team'`, order 50), `conversation.view` (id `'team'`, order 20), `conversation.input.dock` (id `'team'`, order 15) (`plugin/team-mount-core.ts`, applied with exactly three components from `plugin/client.ts`). Assert the registration count is 3 and none targets a chat node.
   ⚠ **Comment collision (reviewer-verified):** the doc comments at `plugin/team-mount-core.ts` L22–24 and `plugin/client.ts` L26–27 literally contain the token `conversation.chat.node` ("NO `conversation.chat.node` team marker"). A raw `text.includes('conversation.chat.node')` scan — as in the untracked WIP `client-architecture-negatives.test.ts` — matches these comments and **fails against the current source**. Fix by making the scanner comment-aware or rewording the doc comments (rewording preferable — they are vNext-authored).
2. **No marker symbols.** No file under `packages/client/src` declares or exports `team-marker`, `TEAM_MARKER_KIND`, `TeamMarkerChatData` (or its four members), `teamMarkerDefinition`, `teamMarkerId`, `teamMarkerData`, `resolveTeamMarkerJump`, `TeamMarkerJump`, `TeamMarker`, `TeamMarkerProps`, or `TeamMarkerInjected`. Verified: no `*marker*` file exists in `packages/client`; the lowercase kind string `team-marker` has zero hits in all src.
3. **No conversation-node type surface.** No `ConversationNodeDefinition`, no `ChatNodeKind`/`ChatNodeDataMap` anywhere in `packages/client/src`. Verified: the only references to the conversation package are three EMPTY `import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'` lines (`plugin/team-mount-core.ts`, `ui/TeamDock.tsx`, `ui/TeamView.tsx`) — legitimate empty type imports; assert no NAMED import from that specifier.
4. **No legacy event vocabulary.** No legacy team session event type tokens (the four marker event types; the non-match types `turn/start`, tool/call `delegate_to_teammate`, team/member-bound) anywhere in `packages/client/src` (grep-verified zero).
5. **No forbidden runtime client import.** No `@deepseek-ai/dsh-client-runtime` import anywhere in `packages/client/src` (grep-verified zero) — vNext uses only the five public seams (`inject = ['slots','locale','sessions','connection','remote']` at `plugin/team-mount-core.ts` L247; `packages/client/src/index.ts` exports only `PACKAGE_ID = 'client'`).
6. **No legacy mirror surface.** No `TeamMirror` type in code and no `ObservableSnapshot<TeamMirror>` — verified: the token `TeamMirror` appears only in doc comments (`state/team-session-resolution.ts`, `plugin/team-mount-core.ts`, `ui/TeamView.tsx`, `transport/team-remote-client.ts`). Do NOT assert absence of `ObservableSnapshot` or `projectionMirror`: both are legitimate vNext vocabulary (`ObservableSnapshot` from `@deepseek-ai/dsh-client-store` typing `TeamProjectionMirror` in `TeamDock.tsx` and `TeamView.tsx`).
7. **No synthetic trajectory.** No `trajectory` in code.
   ⚠ **Comment collision (reviewer-verified):** the token (case-insensitive) also appears in doc comments (`plugin/team-mount-core.ts` L23, `plugin/client.ts` L27: "NO synthetic trajectory") — plus code comments `ui/TeamTimeline.tsx` L121/L182 (jscpd ignore markers mentioning `TrajectoryTimeline`), user-facing locale strings `ui/locales.ts` L347/L414/L556/L623 (Chat/Trajectory history), and the CODE value `degradedTo: 'native-chat-trajectory'` in `model/team-legacy.ts` L58/L156. The WIP test's case-insensitive raw scan hits all of these.
8. **No legacy feed-paging seam.** No `messagesBefore` in code.
   ⚠ **Comment collision (reviewer-verified):** `messagesBefore` also appears in doc comments at `ui/TeamLedger.tsx` L17 and `model/team-ledger-model.ts` L14 — the WIP test's raw scan of this token **currently fails** on these two comments.
9. **Locale residue (separate, informational).** `marker.progress` / `marker.decision` are still declared in `ui/locales.ts` but are referenced by NO component — dead dictionary residue from the legacy marker. Do NOT fold this into the "no marker registration" assertions (a declared-but-unused dictionary entry is not a registration); instead remove the entries or assert the absence of any `t('marker.` reference.

**WIP status:** the untracked `packages/client/test/client-architecture-negatives.test.ts` (T10 WIP) already implements the token-scan approach (7 raw `text.includes` scans over all `.ts`/`.tsx` under `packages/client/src` + a walk-coverage guard asserting `scanned.length > 20` and inclusion of `plugin/client.ts`/`plugin/team-mount-core.ts`/`ui/TeamView.tsx` + a live-detector control sample). As written it FAILS against the current source on three tokens due to the comment collisions in items 1, 7, and 8 — the scanner must strip comments (or the doc comments must be reworded) before this file is committed.

## 7. team-marker -> DELETED by T10 (dropped as a Chat marker; optional visual reuse as a ledger-row visual test)

- Legacy: `tests/team-marker.client.spec.tsx` (337 lines; seven describes: `progress rows` L114, `request rows` L157, `decision rows` L184, `message rows` L222, `mirror resolution and inert rows` L238, `D16 click` L271, `locale pairing` L315)
- vNext counterpart: **none — M = 0.** Staged `D` deletion at HEAD `d4e6eb1`; the deleted vNext copy is byte-identical to the evidence (git blob `ccafe89e4378b923849a7fe1b4e62faf58a1422d` == `d4e6eb1:packages/client/test/team-marker.client.spec.tsx` — reviewer-verified).
- The spec rendered the legacy `TeamMarker` component (`conversation.chat.node` 'team-marker' rows: time + marker chip + actor + summary + state chip, with `TeamMirror`-fed names and D16 jump clicks). The marker component is dropped in vNext; the ledger row (`ui/TeamLedger.tsx` `LedgerRow`, `[data-ledger-*]` attrs) is the surviving visual surface.
- **N = 14 entries (12 `it` + 2 `it.each`; expands to 21 cases: 12 + 4 STATUS + 5 DECISIONS), M = 0, G = 14 (12 × (b) + 2 × (c)), covered = 0.**

### Legacy assertions (N = 14)

| # | it (verbatim, with describe context) | One-line behavioral assertion | Legacy-vocabulary dependency | Disposition |
|---|---|---|---|---|
| 1 | `describe('progress rows') › it('renders subject plus the status chip, the member name off the mirror, and the full text in the title')` | A progress row renders label '进度', actor 'Alice' off the mirror, state '进行中', `data-pending` 'false', and the full text in the title ('调研竞对 — 已完成一半'). | `TeamMarker` component + `TeamMirror` + legacy locale keys `marker.*` | **GAP G1 (b)** — related: vNext ledger #17 `renders the progress label on progress rows`, #4 `carries the full detail in the title affordance` |
| 2 | `describe('progress rows') › it.each(STATUS)('labels every progress status (%s)')` (4 cases) | Every progress status renders its zh chip label (待开始/进行中/已完成/受阻). | Legacy 4-state chip vocabulary | **GAP G2 (b)** — only 'blocked'→'受阻' is asserted in vNext at render level (vNext ledger #17); model level: `team-ledger-model.client.spec.ts` › `renders progress rows with the frozen progress value` |
| 3 | `describe('progress rows') › it('keeps the title bare when the event carried no summary')` | When the event carried no summary, the row title stays bare (subject only). | `TeamMarker` title affordance | **GAP G3 (b)** — related: vNext ledger #4 |
| 4 | `describe('request rows') › it('renders member · tool, the reason, and the waiting chip for a tool request')` | A tool request renders '审批', actor 'Alice · bash', the reason, the '等待裁决' chip with `data-pending` 'true', and the title 'bash · …'. | `TeamMarker` + legacy '审批' locale | **GAP G4 (b)** — waiting chip covered: vNext ledger #2; reason: vNext ledger #16 |
| 5 | `describe('request rows') › it('labels a plan request with the plan-approval marker')` | A plan request is labeled '计划审批'. | Legacy plan-kind approval vocabulary (`approve_plan`) | **GAP G5 (b)** — no '计划审批' anywhere in `packages/client` (grep-verified) |
| 6 | `describe('decision rows') › it('renders the five-value result with the reason, no actor segment')` | A decision row renders '裁决', the result label ('要求修订'), the reason, NO actor segment, `data-pending` 'false'. | Legacy five-value wire decision vocabulary | **GAP G6 (b)** — vNext frozen 3-value set + raw fallback: vNext ledger #3; reason: vNext ledger #16 |
| 7 | `describe('decision rows') › it.each(DECISIONS)('labels every decision value (%s)')` (5 cases) | Every legacy decision value renders its zh label (单次允许/拒绝/升级给用户/批准计划/要求修订); a reason-less decision renders an empty summary/title. | Legacy five-value wire decision vocabulary | **GAP G7 (b)** — vNext ledger #3 covers the frozen 3-value set + raw fallback only |
| 8 | `describe('message rows') › it('renders sender → recipient plus the content, without a state chip')` | A message row renders '消息', actor 'Alice → Leader', the content, and no state chip. | `TeamMarker` + legacy 'from → to' actor format | **GAP G8 (b)** — related: vNext ledger #1 (消息 marker) + #4 (detail '→ Mate' in title); note vNext delivered messages carry the recipient pair with NO from (`ledger-adapter.test.ts` › `a delivered message carries the recipient pair and NO from (the fact names no sender)`) |
| 9 | `describe('mirror resolution and inert rows') › it('falls back to the raw member id when the mirror view is absent or the member unknown')` | With an empty mirror the actor falls back to the raw member id ('m1'); an unknown member renders the raw id ('ghost'). | `TeamMirror` mirror view | **GAP G9 (c) ALREADY-COVERED-ELSEWHERE** — `team-ledger-model.client.spec.ts` › `resolves actor labels from the snapshot and falls back to the raw id` |
| 10 | `describe('mirror resolution and inert rows') › it('renders a decision inert — disabled and never opening a session — when the mirror cannot pair the request')` | When the mirror cannot pair the request, the decision row renders disabled and clicking never opens a session (also with an empty mirror). | `TeamMirror` approvals pairing | **GAP G10 (b)** — inert rendering of an unresolvable row is covered by vNext ledger #12 `switches sessions on row click (D9) and stays inert without a resolved session`, but the mirror-pairing mechanism is forbidden vocabulary |
| 11 | `describe('D16 click') › it('anchors the row in its own session: scroll the flow seat to center, no session switch')` | Clicking a row in its own session scrolls the closest `[data-chat-anchor-key]` seat to center (`scrollIntoView({block:'center'})`) without a session switch. | Chat-node flow seat (`[data-chat-anchor-key]`) | **GAP G11 (b)** — the chat-node seat surface does not exist in vNext (ledger is a section, not a chat node) |
| 12 | `describe('D16 click') › it('scrolls nothing (and switches nothing) when no flow seat wraps the row')` | When no flow seat wraps the row, the click scrolls nothing and switches nothing. | Chat-node flow seat | **GAP G12 (b)** — same dropped surface |
| 13 | `describe('D16 click') › it('switches to the related session for a cross-session target (the decision pairs to the request member)')` | A cross-session target (decision paired to the request member via the mirror) clicks `openSession('m1-s')` with no scroll. | `TeamMirror` pairing + `openSession` injection | **GAP G13 (c) ALREADY-COVERED-ELSEWHERE** — behavior chain verified across vNext layers: `ledger-adapter.test.ts` › `pairs the decision onto its request by requestId (pending flips, decision block set)` + `team-ledger-model.client.spec.ts` › `resolves navigation to the member child session and the team root` + vNext ledger #12 `switches sessions on row click (D9) and stays inert without a resolved session` |
| 14 | `describe('locale pairing') › it('renders the en dictionary for the row labels and states')` | The en dictionary renders 'Approval'/'Pending decision'/'Decision'/'Denied'/'Message' for the row labels and states. | Legacy marker locale dictionary | **GAP G14 (b)** — related: vNext ledger #18 `keeps the en dictionary pairing for the section chrome` + #19 (different label set) |

### vNext spec tests (M = 0)

None — no vNext counterpart; the spec is deleted by T10 (staged `D` at `d4e6eb1`, byte-identical to the evidence). Optional visual reuse of the surviving row composition is specified below.

### Gaps (G = 14)

G1–G14 as classified in the table above: 12 × (b) OBSOLETE (`conversation.chat.node` row surface, `TeamMirror`, legacy five-value decision vocabulary, legacy plan-kind approval vocabulary, `[data-chat-anchor-key]` flow-seat surface) and 2 × (c) ALREADY-COVERED-ELSEWHERE (G9, G13), each cited with a verified vNext file + exact `it` title.

### Reusable visual aspects as vNext ledger-row visual test

Mapping the legacy marker-row visual aspects onto the vNext ledger row (`ui/TeamLedger.tsx` `LedgerRow`: `[data-ledger-row]` button with `[data-ledger-time]` / `[data-ledger-marker]` / `[data-ledger-actor]` / `[data-ledger-summary]` (title = detail) / state badge with `data-pending` / `data-decision` / `[data-ledger-state-reason]` / `data-progress`) and the verified vNext UI coverage in `packages/client/test/team-ledger.client.spec.tsx`:

| Legacy visual aspect (spec #) | vNext ledger-row counterpart | vNext coverage status (verified) |
|---|---|---|
| Single-row composition: time + type marker + actor + summary + state chip (#1, #8) | `[data-ledger-row]` with `[data-ledger-time]` / `[data-ledger-marker]` / `[data-ledger-actor]` / `[data-ledger-summary]` / state badge | Marker + family asserted by ledger #1 `renders the row families with the frozen category markers`; **the `[data-ledger-time]` segment is never asserted anywhere in the vNext specs** — portable visual gap |
| Progress status chip, 4 states (待开始/进行中/已完成/受阻) (#1, #2) | Progress state badge (`data-progress`) | Only 'blocked'→'受阻' asserted at UI level (ledger #17 `renders the progress label on progress rows`); the other three states are covered at model level (`team-ledger-model.client.spec.ts` › `renders progress rows with the frozen progress value`) but NOT at render level |
| Waiting chip '等待裁决' + `data-pending='true'` (#4) | Waiting badge + `data-pending="true"` | Covered: ledger #2 `shows the waiting badge (amber dot) on an unpaired control request` |
| Decision label + reason (#6, #7) | Decision badge + `[data-ledger-state-reason]` | Covered: ledger #3 (frozen 3 values + raw fallback) + #16 `renders the decision reason in the state badge` |
| Actor name off the mirror, raw-id fallback (#1, #9) | `[data-ledger-actor]` from the section model | Model fallback covered: `team-ledger-model.client.spec.ts` › `resolves actor labels from the snapshot and falls back to the raw id`; component actor asserted by ledger #1/#15; **render-level raw-id fallback not asserted** |
| Full text in the title affordance (#1, #3) | `[data-ledger-summary]` with `title={row.detail}` | Covered: ledger #4 `carries the full detail in the title affordance` (message detail '→ Mate' in title); the bare-title-no-summary variant not asserted |
| Message 'sender → recipient' actor (#8) | Message fact marker + detail only (vNext delivered messages carry the recipient pair, NO from) | Partially covered: 消息 marker (ledger #1) + '→ Mate' detail in title (ledger #4); **the 'from → to' actor format is NOT portable as-is** (adapter drops `from`), and the message actor segment is not asserted |
| Inert row: disabled, never opens a session (#10) | Disabled row without a resolved session | Covered: ledger #12 `switches sessions on row click (D9) and stays inert without a resolved session` (ghost → disabled inert) |
| D16 in-flow anchor scroll: `[data-chat-anchor-key]` `scrollIntoView({block:'center'})` (#11, #12) | None — the chat-node seat surface is dropped (the ledger is a section, not a chat node) | **Not reusable — drop** |
| en locale pairing for row labels and states (#14) | en dictionary for the section chrome | Section chrome covered: ledger #18 `keeps the en dictionary pairing for the section chrome` + #19 `shows the section empty state from the en dictionary`; **en pairing of row-level labels/states not asserted** |

**Recommendation:** if T10 adds a ledger-row visual test, the verified uncovered render-level gaps to assert are: (1) the `[data-ledger-time]` segment (formatted via the vNext clock formatter), (2) the three non-blocked progress states' labels, (3) the render-level raw-id actor fallback, (4) the en pairing of row-level labels/states. The D16 in-flow anchor scroll is obsolete (no chat-node seat in vNext) and the 'from → to' message actor format is not portable (vNext delivered-message facts carry no sender).

## 8. team-members-model (legacy -> vNext `team-members-model.client.spec.ts`)

- Legacy: `tests/team-members-model.client.spec.ts`; vNext: `packages/client/test/team-members-model.client.spec.ts`
- **N = 9, M = 10, G = 0, covered = 9.**

### Legacy assertions (N = 9)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | deriveTeamMembers › builds the leading leader row from the leader member row and keeps it out of the groups | `view([leaderRow('running'), mate(A,'bound','sa')])` → `model.leader` is exactly `{memberId:'lead', name:'Lead', role:'leader', activeCount:1, instances:[{key:'lead:leader-s:0', sessionId:LEADER, status:'running', pendingControlCount:0}]}` and groups contain only `[A]` | `TeamView` type imported from `@deepseek-ai/dsh-client-runtime/client`; legacy member-row status vocabulary (`bound`/`running`) and `memberId`/`sessionIds` row model |
| 2 | deriveTeamMembers › keeps a bound leader instance out of the running tally | `view([leaderRow('bound'), mate(A,'running','sa')])` → leader `activeCount` stays 0 (bound instance not counted), leader keeps its one `bound` instance, and the mate group's `activeCount` is 1 | legacy `'bound'` status vocabulary |
| 3 | deriveTeamMembers › synthesizes the leading row from the view anchor when the rows carry no leader | `view([mate(A,'running','sa')])` (no leader member row) → a synthesized leader `{memberId:LEADER, role:'leader', activeCount:0, instances:[]}` with `name` undefined is still leading; groups `[A]` | `TeamView.leaderSessionId` view-anchor semantics (legacy view model) |
| 4 | deriveTeamMembers › tallies the container row per running instance, including a multi-instance member | leader + 3 rows for memberId `a` (`running sa1`, `running sa2`, `settled sa3`) → group `activeCount` 2, instance `sessionIds` `['sa1','sa2','sa3']`, keys `['a:sa1:0','a:sa2:1','a:sa3:2']` | legacy multi-row-per-memberId model (multi-instance expressed as repeated member rows) |
| 5 | deriveTeamMembers › keeps an unbound row as a group without instances | `view([leaderRow(), mate(B,'unbound')])` → group `{memberId:B, name:B, role:'teammate', activeCount:0, instances:[]}` — an instance-less group | legacy `'unbound'` status (abolished in vNext per plan §8.4) |
| 6 | deriveTeamMembers › passes the instance fields through untouched (status, action, pending count, session) | a running row with `currentAction:'Bash'`, `pendingControlCount:2` passes through as `{key, sessionId, status, currentAction, pendingControlCount}`; a plain bound row yields `pendingControlCount:0` and `currentAction` undefined (never re-derived) | `currentAction`/`pendingControlCount` fields on legacy `TeamView` member rows |
| 7 | deriveTeamMembers › folds a second leader row into the leading group (multi-instance interface) | two leader rows (`LEADER` running, `leader-s2` settled) → leader `activeCount` 1, instances `[LEADER,'leader-s2']`, `groups` empty | legacy duplicate-row-per-memberId model for the leader |
| 8 | deriveTeamMembers › synthesizes an empty leader group for a view with no member rows at all | `view([])` → empty synthesized leader `{memberId:LEADER, role:'leader', activeCount:0, instances:[]}` and `groups` `[]` | full legacy `TeamView` shape (rosterMemberCount/delegations/tasks/approvals/messages arrays) |
| 9 | deriveTeamMembers › keeps the groups in members order with a mid-list leader row | `[mate(A,'bound'), leaderRow(), mate(B,'unbound')]` → groups keep members order `[A,B]` with the leader row lifted out (`leader.memberId` `'lead'`) | legacy mid-list leader member row + `unbound` status |

### vNext spec tests (M = 10)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | deriveTeamMembers › builds the leading leader row from the leader-kind instance and keeps it out of the groups | snapshot + ledger input: leader-kind instance yields leading leader row (templateId `tpl-lead`, RUNNING lifecycle, activeCount 1) excluded from groups |
| 2 | deriveTeamMembers › keeps a created leader instance out of the running tally | a CREATED leader instance is not counted in `activeCount` while the running mate group tallies 1 |
| 3 | deriveTeamMembers › synthesizes the leading row from the team session when the instances carry no leader kind | no leader-kind instance → synthesized leader `{templateId:LEADER, role:'leader', activeCount:0, instances:[]}`, name undefined |
| 4 | deriveTeamMembers › tallies the container row per running instance, including a multi-instance member | multi-instance member (sa1/sa2 running, sa3 settled) → activeCount 2, keys `a:sa1:0`/`a:sa2:1`/`a:sa3:2` |
| 5 | deriveTeamMembers › keeps a created instance in its group (the unbound vocabulary is abolished) | the legacy no-instance group case re-expressed: a created instance (no child session) renders as a real row in its group (key `b::0`) |
| 6 | deriveTeamMembers › leaves the pending badge unknown under a partial ledger and zero when none are pending | plan §7.3 completeness: partial ledger → `pendingControlCount` null; complete with none pending → 0 |
| 7 | deriveTeamMembers › passes the instance fields through untouched (lifecycle, status, action, pending count, child session) | instance fields (lifecycle, status, currentAction, ledger pending count, childSessionId, fromHistory) pass through; plain created row has `pendingControlCount:0`, `currentAction` undefined |
| 8 | deriveTeamMembers › folds a second leader-kind instance into the leading group (multi-instance interface) | second leader-kind instance (SETTLED, `leader-s2`) folds into the leading group; groups empty |
| 9 | deriveTeamMembers › synthesizes an empty leader group for a snapshot with no member instances at all | empty snapshot → empty synthesized leader + `groups []` |
| 10 | deriveTeamMembers › keeps the groups in members order with a mid-list leader-kind instance | mid-list leader-kind instance is lifted out; groups keep order `[tpl-A, tpl-B]` |

### Gaps (G = 0)

None — every legacy assertion has a direct equivalent in the vNext spec. (1↔1, 2↔2, 3↔3, 4↔4, 5↔5 with the unbound case re-expressed as a created instance per the vNext spec's own header, 6↔7, 7↔8, 8↔9, 9↔10. vNext test 6, the completeness-aware pending badge, is new vNext behavior with no legacy counterpart — not a gap.)

## 9. team-members (legacy -> vNext `team-members.client.spec.tsx`)

- Legacy: `tests/team-members.client.spec.tsx`; vNext: `packages/client/test/team-members.client.spec.tsx`
- **N = 12, M = 12, G = 0, covered = 12.**

### Legacy assertions (N = 12)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | TeamMembers › renders one group per member with the container row label, leader first | default `TeamView` (lead bound / a running with `currentAction Bash` pending 1 / b unbound) → `[data-team-members]` renders, group-row labels exactly `['Lead · 0 活跃','Alpha · 1 活跃','Beta · 0 活跃']`, and the first (leader) group row is a `BUTTON` | `TeamView` from `@deepseek-ai/dsh-client-runtime/client`; legacy status vocabulary (`bound`/`running`/`unbound`) |
| 2 | TeamMembers › switches back to the leader session when the leading row is clicked (D10) | current session `sa`; clicking the leading leader row calls `onSelectSession` exactly once with the leader session id `leader-s` | D10 leader-row switch on the legacy `TeamView` leader anchor |
| 3 | TeamMembers › keeps the leading row when the member rows lack a leader (roster-absent fallback) | member list with no leader row → synthesized leading row labeled `领导者 · 0 活跃` with the `尚无实例` note still renders and is clickable to the leader session | roster-absent leader synthesis against the legacy view anchor; zh fallback label `领导者` |
| 4 | TeamMembers › shows the three-state instance labels and the state dots | members settled/bound/running → zh labels `已结算`/`已绑定`/`运行中` render, and each `[data-member-instance][data-status]` row's `[data-member-status-text]` matches its status | legacy three-state status vocabulary `bound`/`running`/`settled` (vNext has five display states) |
| 5 | TeamMembers › lists an unbound member as a container row with the no-instances note | default view → `Beta · 0 活跃` and `尚无实例` render, and Beta's group contains no `[data-member-instance]` rows at all | legacy `'unbound'` status (abolished in vNext) |
| 6 | TeamMembers › shows the current action and falls back to the action placeholder | a running instance with `currentAction:'Bash'` shows `Bash`; an instance without an action shows the `暂无动作` placeholder in `[data-member-action]` | legacy `currentAction` field on `TeamView` member rows |
| 7 | TeamMembers › badges the waiting instances with the pending control-request count | a running instance with `pendingControlCount:2` → `2 项待裁决` renders and exactly one `[data-member-waiting]` badge; a zero-pending view renders none | `pendingControlCount` carried on legacy member rows (vNext derives it from the ledger model, completeness-aware) |
| 8 | TeamMembers › switches to the instance session on click, per instance for a multi-instance member (D9) | 3 instance rows (leader, a:sa1, a:sa2) → clicking row 1/2/3 calls `onSelectSession` with `leader-s`/`sa1`/`sa2`; group labels read `Lead · 0 活跃` and `Alpha · 2 活跃` | multi-instance member via duplicate legacy rows; D9 click-to-switch on the row element itself (vNext T7 moved the target to the nav button) |
| 9 | TeamMembers › highlights the current session's group and instance rows only (D7) | current `sa` → only group[1] and its instance row carry `dataset.current='true'`; current `leader-s` → only the leader group and its row are highlighted | D7 highlight semantics on legacy `sessionIds`-based rows |
| 10 | TeamMembers › keeps the non-leader container rows non-interactive | non-leader group rows render as `DIV` (not buttons); clicking one never calls `onSelectSession` | non-leader row interactivity contract (relies on `TeamView` rows) |
| 11 | TeamMembers › renders a session-less instance row as a disabled, inert row | a `bound` member with empty `sessionIds` → its instance row button is `disabled`, the leader row's is not, and clicking the disabled row calls nothing | legacy `'bound'` status with absent `sessionIds` (vNext: a CREATED instance without a child session) |
| 12 | TeamMembers › renders the English dictionary pairing | same default view with the `en` dictionary → labels `['Lead · 0 active','Alpha · 1 active','Beta · 0 active']`, `Running`, `Bash`, `1 pending`, `No instances yet` render; no `settled` instance row exists | `en` dictionary pairing over the legacy `TeamView` fixture |

### vNext spec tests (M = 12)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | TeamMembers › renders one group per member with the container row label, leader first | snapshot+ledger input: same zh labels `['Lead · 0 活跃','Alpha · 1 活跃','Beta · 0 活跃']`, root `[data-team-members]`, leader row is a `BUTTON` |
| 2 | TeamMembers › switches back to the team session when the leading row is clicked (D10) | clicking the leading row calls `onSelectSession` once with the team session id |
| 3 | TeamMembers › keeps the leading row when the instances lack a leader-kind row (roster-absent fallback) | no leader-kind instance → synthesized `领导者 · 0 活跃` row with `尚无实例` still renders and clicks to the team session |
| 4 | TeamMembers › shows the five-state instance labels and the state dots | settled/created/running instances → zh labels `已结算`/`已创建`/`运行中`; per-`data-status` status text matches (five-state display vocabulary) |
| 5 | TeamMembers › lists a created instance as a real row in its group (the unbound vocabulary is abolished) | Beta (created, no child session) renders `Beta · 0 活跃` with a real `[data-member-instance]` row (`status created`, `已创建`) instead of a no-instances note |
| 6 | TeamMembers › shows the current action and falls back to the action placeholder | running instance with `currentAction:'Bash'` shows `Bash`; the leader instance shows the `暂无动作` placeholder |
| 7 | TeamMembers › badges the waiting instances with the pending control-request count, completeness-aware (plan §7.3) | complete ledger with `pendingControlByInstance:{a:2}` → `2 项待裁决` + one badge; partial ledger → no badge; complete zero → no badge |
| 8 | TeamMembers › switches to the instance session on click, per instance for a multi-instance member (D9) | clicking the three `[data-member-instance-nav]` buttons calls `onSelectSession` with `leader-s`/`sa1`/`sa2`; labels `Lead · 0 活跃`, `Alpha · 2 活跃` |
| 9 | TeamMembers › highlights the current session's group and instance rows only (D7) | current `sa` highlights only Alpha group + its instance row; current team session highlights only the leader group + row |
| 10 | TeamMembers › keeps the non-leader container rows non-interactive | non-leader group rows are `DIV`; clicking one calls nothing |
| 11 | TeamMembers › renders a session-less instance row as a disabled, inert row | a CREATED instance without child session → its nav button is `disabled` (leader's not); clicking it calls nothing |
| 12 | TeamMembers › renders the English dictionary pairing (with the synthesized leader note) | `en` dictionary → `['Leader · 0 active','Alpha · 1 active','Beta · 0 active']`, `Running`, `Bash`, `1 pending`, `No instances yet`; no `settled` row |

### Gaps (G = 0)

None — every legacy assertion has a direct equivalent in the vNext spec. (1↔1, 2↔2, 3↔3, 4↔4 with `bound` re-expressed as `created` in the five-state vocabulary, 5↔5 with the unbound no-instances case re-expressed as a real created row, 6↔6, 7↔7 extended by the §7.3 completeness arms, 8↔8 with the D9 target migrated to the nav button per the spec's T7 note, 9↔9, 10↔10, 11↔11 with the session-less case re-expressed as a created instance without a child session, 12↔12 with the synthesized leader label `Leader`.)

## 10. team-plugin (legacy -> vNext `team-plugin.client.spec.tsx`)

- Legacy: `tests/team-plugin.client.spec.tsx`; vNext: `packages/client/test/team-plugin.client.spec.tsx` — **byte-identical frozen legacy copy** (sha256 prefix `f1cfa2b9006c21e3` on both paths; see §0.2). It imports `Context`/`SlotRegistry`/`ConversationEventRegistry` from the forbidden `@deepseek-ai/dsh-client-runtime/client` and `../src/client/*` + `../src/invariant.ts`, which do not exist in the vNext package. It is an unmigrated frozen copy, not a vNext successor.
- **N = 4, M = 4, G = 4 (1 × (a), 1 × (b), 2 × (c)), covered = 0.**

### Legacy assertions (N = 4)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | TeamSettingsSection › renders the read-only configuration instructions | rendering `<TeamSettingsSection t={makeTranslate(zh)}>` shows `团队成员配置`, `未配置团队成员`, `全局：$DSH_HOME/teammates/*.md` | none of the forbidden items (component + `makeTranslate` only) |
| 2 | plugin lifecycle › registers and removes the definition, keyed renderer, settings section, view tab, and dock with its fiber | applying the team plugin on a real cordis `Context` (SlotRegistry + ConversationEventRegistry + stubbed `connection`/`remote`/`settingsScope`/`sessions.teams` faces) lands, with the fiber and removed on `fiber.dispose()`: conversationEvents kind `['team-marker']`; a keyed `conversation.chat.node` entry with key `team-marker`; a `settings.section` entry id `team` with a resolvable string label; a `conversation.view` entry id `team` order 20 whose label resolves `Team` (en) then `团队` after `locale.setLocale('zh')`; a view face binding the shared `sessions.teams.mirror` (`ensureTeam('child')` → `refresh('child')`, `pageTeamMessages` → the sessions face error passed through, `openSession('member-s')` → `open('member-s')`); a marker face (same mirror + `openSession('m1-s')`); a `conversation.input.dock` entry id `team` order 15 with a face (same mirror, `ensureTeam` refreshes again, and `openTeamTab()` DOM-scans a `role=tablist`, skips `对话`, clicks the `团队` tab once, and is a quiet no-op when no tab matches); a replacement fiber re-lands all registrations | `Context` from `@deepseek-ai/cordis` driven through `SlotRegistry`/`ConversationEventRegistry` of `@deepseek-ai/dsh-client-runtime/client` (forbidden); TeamMarker / ConversationNodeDefinition / `conversation.chat.node` keyed registration; TeamMirror (`sessions.teams.mirror`); the legacy `sessions.teams` face (`refresh`/`pageMessagesBefore`/`open`); document/DOM manipulation (the D13 tablist scan); `resolveSlotLabel` from `@deepseek-ai/dsh-client-ui-slots` |
| 3 | plugin lifecycle › keeps the view tab registered against a sessions face with no team wiring | with `sessions` provided as `{}` (no `teams` capability) the `conversation.view` entry id `team` still registers: its face carries the static empty mirror (`getSnapshot()` `{}`, subscribable), `openSession` is still a function, `pageTeamMessages` resolves the loud error `{ok:false, code:'internal', message:'the sessions face carries no team wiring', details:{}}`, `ensureTeam` resolves as a no-op; the dock entry id `team` also registers with the static mirror, a complete `openTeamTab` callback, and no-op `ensureTeam`; `fiber.dispose()` empties `conversation.input.dock` | same forbidden client-runtime surface; TeamMirror (static empty source); the legacy `sessions.teams` capability/wiring vocabulary; `pageTeamMessages` |
| 4 | plugin lifecycle › keeps the node half inert and registers invariant ownership | `applyNode()` (the node half of the package entrypoint) performs no registration on its own, and `applyInvariant(ctx)` on a ctx providing the `invariants` service registers package ownership for exactly `['@deepseek-ai/dsh-client-ui-team']` | the node half = TeamMarker/ConversationNodeDefinition vocabulary; the `invariants` service; the legacy package name `@deepseek-ai/dsh-client-ui-team` |

### vNext spec tests (M = 4)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | TeamSettingsSection › renders the read-only configuration instructions | renders the settings section with the zh dictionary and asserts the three zh instruction strings |
| 2 | plugin lifecycle › registers and removes the definition, keyed renderer, settings section, view tab, and dock with its fiber | the full fiber-scoped registration/removal lifecycle through the legacy runtime (marker node, mirror-bound faces, locale flip, DOM tab jump, re-apply) |
| 3 | plugin lifecycle › keeps the view tab registered against a sessions face with no team wiring | degraded sessions face: tab + dock still register with the static empty mirror and loud/no-op callbacks |
| 4 | plugin lifecycle › keeps the node half inert and registers invariant ownership | the node half stays inert; the invariant companion reserves legacy package ownership |

### Gaps (G = 4)

- `plugin lifecycle › registers and removes the definition, keyed renderer, settings section, view tab, and dock with its fiber` — fiber-scoped landing/removal of the settings section, view tab (id `team`, order 20, locale label) and input dock (id `team`, order 15) plus the locale dictionaries and the inject faces — **(c) ALREADY-COVERED-ELSEWHERE**: `packages/client/test/client-plugin-mount.test.ts` › `registers the team locale dictionaries once under the team namespace`, › `injects exactly the three expected slot keys, in order`, › `registers the settings.section entry (id team, order 50, nav label, no inject)`, › `registers the conversation.view entry (id team, order 20, view label + inject)`, › `registers the conversation.input.dock entry (id team, order 15, inject, no label)`, › `the view inject face carries the full P9-S6 face set (legacyInspect bound)`, › `the dock inject face shares the view projection mirror source (D-T9-4 no-op jump)`, › `teardown unsubscribes the generation seam and resets the stores` (all eight titles reviewer-verified against the file). The it's legacy-vocab sub-assertions have no vNext equivalent and are OBSOLETE: the TeamMarker/ConversationNodeDefinition `conversation.chat.node` keyed renderer + the `team-marker` ConversationEventRegistry entry (vNext explicitly registers no chat node — `team-mount-core.ts` header), the TeamMirror face bindings (vNext exposes its own `projectionMirror`/`teamLedgers` stores, not `sessions.teams.mirror`), the `pageTeamMessages`→`sessions.teams.pageMessagesBefore` passthrough (vNext pages the durable ledger through the frozen Remote channel), and the D13 DOM tablist click (vNext `openTeamTab` is the D-T9-4 degraded no-op — the seam map forbids the DOM hack); the en→zh resolved-label flip (`Team`→`团队`) is preserved in the vNext dictionaries (`view.team` = `Team`/`团队`, `src/ui/locales.ts`) but is not itself asserted by any verified vNext test.
- `plugin lifecycle › keeps the view tab registered against a sessions face with no team wiring` — the tab/dock still register (with a static empty mirror, complete `openSession`/`openTeamTab` faces, no-op cold pull, loud page error) when the sessions face carries no team wiring — **(c) ALREADY-COVERED-ELSEWHERE**: `packages/client/test/client-plugin-mount.test.ts` › `an ordinary session cold read resolves typed failure with the mirror untouched` (the degraded cold-read path: typed failure settles, mirror untouched — replacing the static-empty-mirror + `ensureTeam` no-op arms), › `the view inject face carries the full P9-S6 face set (legacyInspect bound)` (mirror is `{}` before any cold read and the face stays complete when degraded), › `absent config omits the legacyInspect face (the T8 degraded zero state)`, › `teardown unsubscribes the generation seam and resets the stores` (all titles reviewer-verified). The it's `pageTeamMessages` loud-error sub-assertion (`the sessions face carries no team wiring`) is OBSOLETE: the legacy `sessions.teams` page surface does not exist in vNext (failures surface as typed Remote results in the ledger/projection stores); the vNext degradation axis is config-driven (absent/blank `dshHome` omits the `legacyInspect` face), not sessions-capability-driven.
- `TeamSettingsSection › renders the read-only configuration instructions` — the zh settings-section instruction strings render — **(a) PORTABLE**: port into the migrated `packages/client/test/team-plugin.client.spec.tsx` (the current file is the frozen legacy copy; rewrite its `TeamSettingsSection` describe against vNext): render `packages/client/src/ui/TeamSettingsSection.tsx` (verified to exist — 43 lines; it consumes the standard `t` seat and renders `t('title')`/`t('empty.title')`/`t('empty.step1')`) with `makeTranslate(zh)` from the already-linked `@deepseek-ai/dsh-client-test-runtime`; the three asserted strings survive verbatim in the vNext dictionary (`src/ui/locales.ts`: `团队成员配置` / `未配置团队成员` / `全局：$DSH_HOME/teammates/*.md`). No verified vNext test renders this component (the mount test stubs it out).
- `plugin lifecycle › keeps the node half inert and registers invariant ownership` — the package node half stays inert and the invariant companion reserves ownership of `@deepseek-ai/dsh-client-ui-team` — **(b) OBSOLETE**: the node half (TeamMarker/ConversationNodeDefinition) and the client-side `invariants` package-ownership registration both belong to a dropped legacy surface — vNext `packages/client/src/index.ts` exports only the `PACKAGE_ID` marker (no `applyNode` export, verified), and no vNext client module registers `invariants` ownership (grep across `packages/client` finds no `invariants` service registration); the legacy package name `@deepseek-ai/dsh-client-ui-team` is superseded by `@dsh-agent-team/client` (`packages/client/package.json`), and `client.test.ts` (2 its: `exposes the stable client identity marker`, `has the public Cordis composition plugin shape`) asserts the plugin shape instead.

> **Structural note (reviewer-verified)**: because the vNext counterpart is a frozen legacy copy, none of its 4 `it`s can execute against vNext sources (`../src/client/*`, `../src/invariant.ts` do not exist) — once the in-flight tsconfig diff re-includes it in typecheck, this file must be migrated (its portable content is the settings-section rendering test above) or deleted, with the plugin-lifecycle coverage staying in `client-plugin-mount.test.ts`.

## 11. team-tasks (legacy "tasks") -> vNext `team-activity.client.spec.tsx` ("activity")

- Legacy: `tests/team-tasks.client.spec.tsx`; vNext: `packages/client/test/team-activity.client.spec.tsx` (legacy "tasks" = vNext "activity" rows)
- **N = 7, M = 7, G = 3 (1 × (a), 2 × (b)), covered = 4.**

### Legacy assertions (N = 7)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | TeamTasks › renders one row per task: state dot, subject, status label, assignee name, summary | one task row (`t1`, `in_progress`, summary `Half done`, memberId `a`) → `[data-team-tasks]` renders one `[data-task-row]` with `data-task-status='in_progress'`, a `[data-state]` dot, subject `Wire the mirror`, zh status text `进行中`, assignee `负责人 Alpha` (member name resolved through the member rows, D19), and summary `Half done` | `TeamView` + `TeamView['tasks']` task rows from `@deepseek-ai/dsh-client-runtime/client`; D19 memberId→member-row name resolution |
| 2 | TeamTasks › shows the four status labels for the four statuses | four tasks with statuses `pending`/`in_progress`/`completed`/`blocked` → four rows whose status texts are exactly `['待开始','进行中','已完成','受阻']` | the legacy four-status task vocabulary (the `pending` state does not exist in the vNext current-work face) |
| 3 | TeamTasks › omits the summary line when the task carries none | a task without `summary` → no `[data-task-summary]` node in its row | `TeamView['tasks']` row shape |
| 4 | TeamTasks › falls back to the raw member id when no member row matches (D19 fallback) | a task with `memberId:'ghost'` (no matching member row) → assignee renders `负责人 ghost` (the raw id) | D19 raw-id fallback over the legacy task-row `memberId` reference |
| 5 | TeamTasks › renders the one-line empty state without any row | no tasks → no `[data-task-row]`, the `暂无任务进度` text renders inside `[data-tasks-empty]` | legacy task projection empty state |
| 6 | TeamTasks › keeps the rows non-interactive (D9 names no task-row switch) | a task row is a `DIV` and the section contains no `button` or `a` element | non-interactive task rows (D9 design decision) |
| 7 | TeamTasks › renders the English dictionary pairing | a completed task with ghost assignee under `en` → status text `Completed`, assignee `Assignee ghost`; an empty board under `en` → `No task progress yet` | `en` dictionary pairing; D19 raw-id fallback in the en locale |

### vNext spec tests (M = 7)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | TeamActivity › renders the row anatomy: dot, subject, status label, member, summary | four adapter `TeamUiCurrentWorkRow`s → rows carry `data-activity-status`, subject, zh status text `进行中`, member `负责人 Mate`, summary (legacy row layout reused verbatim) |
| 2 | TeamActivity › renders the three frozen status labels and the absent-status arm | the THREE frozen ProgressValue labels (`已完成`/`受阻` beside `进行中`) plus a status-less row: no `data-activity-status` attribute, no status text, subject falling back through `currentAction` (`typing`) |
| 3 | TeamActivity › omits the summary node when the row carries no summary | the no-summary row renders no `[data-activity-summary]` node |
| 4 | TeamActivity › renders the instance label as-is (the resolution lives in the adapter) | the member column renders `负责人 <label>` verbatim from `row.label` — label resolution moved into the adapter, no section-side fallback |
| 5 | TeamActivity › renders the one-line empty state | empty activity list → the one-line `暂无活动进度` empty state |
| 6 | TeamActivity › keeps the rows non-interactive (no buttons, no navigation) | zero `button` elements; clicking a row is a no-op (no handler, no navigation side effect) |
| 7 | TeamActivity › keeps the en dictionary pairing | under `en`: status texts `In progress`/`Completed`/`Blocked` and member `Assignee Mate` |

### Gaps (G = 3)

- `TeamTasks › shows the four status labels for the four statuses` — four task statuses map to the four zh labels `待开始`/`进行中`/`已完成`/`受阻` — **(b) OBSOLETE**: the `pending` (`待开始`) label belongs to the dropped legacy task-status vocabulary — the vNext current-work face carries only the three frozen ProgressValue labels (in-progress/completed/blocked), and a row without a status renders no status text at all (that absent-status arm is covered by `packages/client/test/team-activity.client.spec.tsx` › `renders the three frozen status labels and the absent-status arm`; the three surviving labels are directly equivalent there).
- `TeamTasks › falls back to the raw member id when no member row matches (D19 fallback)` — an unmatched task `memberId` renders the raw id (`负责人 ghost`) — **(b) OBSOLETE**: the D19 raw-id fallback is explicitly DROPPED in the vNext spec header and is structurally unreachable in the vNext model — activity rows are per-live-member current-work rows built by the adapter from the durable projection (`adaptCurrentWork` copies `member.label`, `packages/client/src/model/projection-adapter.ts`; members without work facts yield no row), so an unmatched `memberId` cannot occur; the section-level label rendering itself has a direct equivalent in `packages/client/test/team-activity.client.spec.tsx` › `renders the instance label as-is (the resolution lives in the adapter)`.
- `TeamTasks › renders the English dictionary pairing` — en status text, en assignee line, and the en empty-state string all render from the `en` dictionary — **(a) PORTABLE**: port into `packages/client/test/team-activity.client.spec.tsx` — the en pairing it exists there (`keeps the en dictionary pairing`) but asserts neither the en empty-state string (only the zh one is asserted, in `renders the one-line empty state`) nor a raw-id assignee; add an `en`-render of `<TeamActivity activity={[]} t={makeTranslate(en)} />` asserting `No activity progress yet` (verified present in the vNext en dictionary, `packages/client/src/ui/locales.ts`, and not positively asserted by any verified vNext test — the only occurrence is a negative `queryByText` in `team-dock.client.spec.tsx`); the it's `Assignee ghost` sub-assertion is OBSOLETE with the D19 raw-id fallback (previous bullet — the vNext en member line uses a real label, `Assignee Mate`).

## 12. team-timeline-model (legacy -> vNext `team-timeline-model.client.spec.ts`)

- Legacy: `tests/team-timeline-model.client.spec.ts`; vNext: `packages/client/test/team-timeline-model.client.spec.ts`
- **N = 17 (16 `it` + 1 `it.each`), M = 18 (17 `it` + 1 `it.each`), G = 0, covered = 17.**

### Legacy assertions (N = 17)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | deriveTeamTimeline › returns null without delegations, even with members and tasks | No delegation rows → `null` regardless of members/tasks | `TeamView` legacy `tasks`/delegation rows |
| 2 | deriveTeamTimeline › spans the linear domain from the earliest team timestamp to the last settlement | Domain = [earliest team timestamp, last settlement] | legacy `tasks` rows (timestamps) |
| 3 | deriveTeamTimeline › lets a task recorded after the last settlement extend the right edge | A task later than the last settlement extends the right edge | legacy `tasks` rows |
| 4 | deriveTeamTimeline › extends a running span to the caller clock and never beyond a known settlement | A running span extends to the caller clock, clamped by a known settlement | legacy `tasks` rows + clock |
| 5 | deriveTeamTimeline › never reads the clock for a fully settled view | Fully settled → no clock read | pure model |
| 6 | deriveTeamTimeline › draws one lane per teammate in members order and skips the leader | One lane per teammate, members order, leader skipped | legacy members order |
| 7 | deriveTeamTimeline › sorts a member's spans by start time with unique stable keys | Spans sorted by start, unique stable keys | pure model |
| 8 | deriveTeamTimeline › keeps same-timestamp spans in delegation order | Same-timestamp spans keep delegation order | legacy delegation order |
| 9 | deriveTeamTimeline › renders a not-rostered delegation id as a fallback lane after the roster | Not-rostered id → fallback lane after the roster | legacy delegation rows |
| 10 | deriveTeamTimeline › keeps an unbound teammate row on the matrix with an empty session id | Unbound teammate → matrix row with empty session id | legacy 'unbound' status |
| 11 | deriveTeamTimeline › cycles the color slot by lane position past the ramp length | Color slot cycles by lane position past the ramp | pure model |
| 12 | deriveTeamTimeline › widens a zero-width domain to 1 ms | Zero-width domain → widened to 1 ms | pure model |
| 13 | teamTimelineTicks › picks a 1/2/5 step that keeps the visible density near the target | Tick step from {1,2,5}·10^k keeping visible density near target | pure model |
| 14 | teamTimelineTicks › keeps ticks inside an offset domain and ascending | Ticks inside an offset domain, ascending | pure model |
| 15 | teamTimelineTicks › degenerates gracefully on equal, inverted, or non-finite bounds | Equal/inverted/non-finite bounds → graceful degeneration | pure model |
| 16 | formatTeamClock › prints fixed 24-hour HH:MM:SS | Fixed 24-hour HH:MM:SS format | pure model |
| 17 | formatTeamDuration › formats %i as %s (`it.each`, 14-row table: 0/-5/NaN→'0毫秒', 500→'500毫秒', 999→'999毫秒', 8400→'8.4秒', 9990→'10秒', 10000→'10秒', 59500→'60秒', 61000→'1分01秒', 188000→'3分08秒', 3599999→'59分59秒', 3600000→'1小时00分', 3661000→'1小时01分') | Duration format table (ms/s/min/h, rounding and clamp rules) | pure model |

### vNext spec tests (M = 18)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | deriveTeamTimeline › returns null without activity intervals, even with members and progress | No activity intervals → `null` regardless of members/progress |
| 2 | deriveTeamTimeline › spans the linear domain from the earliest known activity time to the last closure | Domain = [earliest activity time, last closure] |
| 3 | deriveTeamTimeline › lets a progress fact after the last closure extend the right edge | A progress fact later than the last closure extends the right edge |
| 4 | deriveTeamTimeline › never extends the domain from progress facts over a partial ledger | NEW: partial-ledger guard on domain extension |
| 5 | deriveTeamTimeline › extends an open interval to the caller clock and never beyond a known closure | Open interval → caller clock, clamped by a known closure |
| 6 | deriveTeamTimeline › never reads the clock for a fully closed view | Fully closed → no clock read |
| 7 | deriveTeamTimeline › draws one lane per member instance in members order and skips the leader-kind instance | One lane per member instance, members order, leader-kind skipped |
| 8 | deriveTeamTimeline › sorts an instance's spans by open time with unique stable keys | Spans sorted by open time, unique stable keys |
| 9 | deriveTeamTimeline › keeps same-timestamp spans in interval order | Same-timestamp spans keep interval order |
| 10 | deriveTeamTimeline › renders a not-rostered instance id as a fallback lane after the roster | Not-rostered instance id → fallback lane after the roster |
| 11 | deriveTeamTimeline › keeps a sessionless teammate instance on the matrix with an empty child session | Sessionless instance → matrix row with empty child session |
| 12 | deriveTeamTimeline › cycles the color slot by lane position past the ramp length | Color slot cycles by lane position past the ramp |
| 13 | deriveTeamTimeline › widens a zero-width domain to 1 ms | Zero-width domain → widened to 1 ms |
| 14 | teamTimelineTicks › picks a 1/2/5 step that keeps the visible density near the target | Same tick-step behavior |
| 15 | teamTimelineTicks › keeps ticks inside an offset domain and ascending | Same |
| 16 | teamTimelineTicks › degenerates gracefully on equal, inverted, or non-finite bounds | Same |
| 17 | formatTeamClock › prints fixed 24-hour HH:MM:SS | Same |
| 18 | formatTeamDuration › formats %i as %s (`it.each`, same 14-row table) | Same duration format table |

### Gaps (G = 0)

None — all 12 `deriveTeamTimeline` shapes are re-expressed 1:1 over activity intervals/progress facts/member instances (the legacy `unbound` row, test 10, re-expressed as a sessionless instance, vNext test 11), and the 5 pure model its (ticks ×3, clock, duration) are identical. vNext test 4 (partial-ledger domain guard) is new behavior with no legacy counterpart — not a gap.

## 13. team-timeline (legacy -> vNext `team-timeline.client.spec.tsx`)

- Legacy: `tests/team-timeline.client.spec.tsx`; vNext: `packages/client/test/team-timeline.client.spec.tsx`
- **N = 18, M = 18, G = 0, covered = 18.**

### Legacy assertions (N = 18)

| # | it title (verbatim, `TeamTimeline ›`) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | shows the one-line cold state without a lane matrix | '暂无委派记录'; no `[data-team-lane]`/`[data-team-timeline-track]` | `TeamView` legacy delegation rows |
| 2 | draws one labeled lane per teammate in members order, never the leader | Alpha/Beta lanes, laneColor 0/1, no 'Lead', 2 lanes, 3 bars | legacy members order + delegation rows |
| 3 | lays a member's multiple spans along the axis without overlap | `--team-bar-left`/`width` fractions of the 300_000 domain, no overlap | legacy delegation rows |
| 4 | marks the running bar and extends it to the local clock | `dataset.running`, fraction(200_000,300_000) | legacy running task row |
| 5 | advances the running span as the local clock ticks, and stays static when settled | 30s advance → fraction(230_000,330_000); settled static | legacy running task row + clock |
| 6 | zooms with the wheel at the pointer, resets with double click, and caps at the full domain | deltaY -1000 @x=300 → width 400–500%, left -50..-25, preventDefault | none (gesture) |
| 7 | pans a zoomed viewport with a left-button drag without selecting | `data-panning`, no onSelectSession | none |
| 8 | pans with the right button and suppresses the context menu | right-button pan, contextmenu suppressed | none |
| 9 | ignores moves from another pointer and a sub-threshold jiggle | pointerId filter, 1px threshold | none |
| 10 | drops the gesture on pointer cancel | pointerup/cancel drops gesture | none |
| 11 | ignores middle-button presses | middle button ignored | none |
| 12 | switches to the member session on a bar click | `onSelectSession('sa')` once, D9 | legacy member session binding |
| 13 | treats a bar press that moves as a pan, not a click | moved press → pan, no click | none |
| 14 | pans and zooms by keyboard and resets with 0 or Escape | +/-/=, arrows, shift=5×, 0/Escape reset, clamp | none |
| 15 | tooltips a bar with the member name, range, duration, and running marker | 250ms hover, 'Beta'/' → '/'3分20秒'/'（进行中）', mouseOut removes; settled 'Alpha'+'1分30秒' | legacy member names + legacy task rows |
| 16 | highlights the current session's member lane | currentMemberId 'a' → lane 0 `data-current`, D7 | legacy session highlighting |
| 17 | keeps an unbound member on the matrix with a non-interactive bar | 'Gamma', no `data-team-timeline-bar` attr, click inert | legacy 'unbound' status |
| 18 | renders axis tick labels inside the visible domain | HH:MM:SS spans inside visible domain | pure |

### vNext spec tests (M = 18)

| # | it title (verbatim, `TeamTimeline ›`) | one line |
|---|---|---|
| 1 | shows the one-line cold state without a lane matrix | Same (member-instance vocabulary) |
| 2 | draws one labeled lane per member instance in members order, never the leader-kind instance | Same shape (instance vocabulary) |
| 3 | lays an instance's multiple spans along the axis without overlap | Same |
| 4 | marks the running interval and extends it to the local clock | Same |
| 5 | advances the running span as the local clock ticks, and stays static when closed | Same |
| 6 | zooms with the wheel at the pointer, resets with double click, and caps at the full domain | Same |
| 7 | pans a zoomed viewport with a left-button drag without selecting | Same |
| 8 | pans with the right button and suppresses the context menu | Same |
| 9 | ignores moves from another pointer and a sub-threshold jiggle | Same |
| 10 | drops the gesture on pointer cancel | Same |
| 11 | ignores middle-button presses | Same |
| 12 | switches to the child session on a bar click | Same D9 target, child-session vocabulary |
| 13 | treats a bar press that moves as a pan, not a click | Same |
| 14 | pans and zooms by keyboard and resets with 0 or Escape | Same |
| 15 | tooltips a bar with the member name, range, duration, and running marker | Same |
| 16 | highlights the current session's member lane (currentInstanceId) | Same D7 |
| 17 | keeps a sessionless instance on the matrix with a non-interactive bar | 'Gamma' re-expressed as a sessionless instance |
| 18 | renders axis tick labels inside the visible domain | Same |

### Gaps (G = 0)

None — all 18 behaviors are re-expressed 1:1 in member-instance vocabulary (legacy unbound test 17 → sessionless instance test 17).

## 14. team-view (legacy -> vNext `team-view.client.spec.tsx`)

- Legacy: `tests/team-view.client.spec.tsx`; vNext: `packages/client/test/team-view.client.spec.tsx`
- **N = 8, M = 12, G = 3 (1 × (a), 2 × (c)), covered = 5.**

### Legacy assertions (N = 8)

| # | it title (verbatim, with describe context) | behavioral assertion | legacy-vocab dependency |
|---|---|---|---|
| 1 | resolveTeamView (frozen team-ness derivation) › resolves a session by its own leader key or any binding member row, and nothing otherwise | leader-keyed TeamMirror→view; binding member row→same view; outsider→undefined; empty mirror→undefined | `TeamMirror` + `resolveTeamView` (legacy runtime seam surface) |
| 2 | TeamView › renders the one-line zero state for a non-team session and cold-pulls once | '当前会话未加入任何团队', `ensureTeam` once | `TeamMirror` + `useTeamMirror` |
| 3 | TeamView › renders all four sections live for a team session | timeline '时间线'+`[data-team-timeline]`, members '成员组'+2 group rows, tasks '任务板'+`[data-tasks-empty]`, events '事件流'+`[data-feed-empty]`; member perspective same 4 | `TeamView` sections (legacy tasks/events vocabulary) |
| 4 | TeamView › switches to the member session when a timeline bar is clicked (D9) | timeline bar click → `openSession(member)` | legacy timeline bar + member session binding |
| 5 | TeamView › switches to the member session when a member instance row is clicked (D9) | member row click → `openSession(member)` | `TeamView` member rows |
| 6 | TeamView › switches back to the leader session when the leading leader row is clicked (D10) | leader row click → `openSession(leader)` | `TeamView` leader anchor |
| 7 | TeamView › renders the task board and event stream from the view and switches sessions on feed-row click (D9) | task row subject/status '进行中'/assignee '负责人 mate'/summary; approval@2000 ahead of message@3000 with '等待裁决'; approval-row→openSession(member), message-row→openSession(leader) | `TeamView` tasks/approvals/messages (legacy event-stream surface) |
| 8 | TeamView › stops cold-pulling once the mirror gains the session (landing frame wins) | mirror gains session → no further `ensureTeam` (landing frame wins) | `TeamMirror` |

### vNext spec tests (M = 12)

| # | it title (verbatim, with describe context) | one line |
|---|---|---|
| 1 | renders the one-line zero state for a non-team session and cold-pulls the projection once | Zero state + single cold projection pull |
| 2 | keeps the plain zero state without the creation face (S5-A: entry hidden, T6 view unchanged) | NEW (S5-A): creation face absent → plain zero state |
| 3 | offers the New Team entry in the zero state when the creation face is present (S5-A, UI §3) | NEW (S5-A): New Team entry |
| 4 | opens the New Team panel from the entry and returns to the entry on cancel (S5-A, UI §3/§5.3) | NEW (S5-A): panel open/cancel |
| 5 | persists the intent draft in view state across panel close/reopen (S5-A, UI §5.3) | NEW (S5-A): intent draft persistence |
| 6 | renders all four UI §12.1 sections live from one input for a leader session | Sections `[timeline, members, activity, ledger]`; '活动与进度'+`[data-activity-empty]`; '团队事件'+`[data-ledger-empty]` |
| 7 | switches to the member session when a member instance row is clicked (D9) | Same D9 target, instance vocabulary |
| 8 | switches back to the leader session when the leading leader row is clicked (D10) | Same D10 |
| 9 | renders the activity section from the snapshot current-work face | Row layout subject/status/'负责人 mate'/summary |
| 10 | renders the ledger section from the per-team ledger store | Ledger rows from the ledger store |
| 11 | switches to the actor session when a ledger row is clicked (D9) | Ledger-row click → `openSession(actor)` |
| 12 | stops cold-pulling once the projection mirror gains the session (landing frames win) | Projection-mirror analog of legacy test 8 |

### Gaps (G = 3)

- `resolveTeamView (frozen team-ness derivation) › resolves a session by its own leader key or any binding member row, and nothing otherwise` — **(c) ALREADY-COVERED-ELSEWHERE**: `packages/client/test/team-session-resolution.test.ts` › `resolves the frame under its own key with the team-root perspective`, › `resolves a bound member child to the member-child perspective`, › `an outsider session resolves undefined`, › `an empty mirror resolves undefined` (all four titles reviewer-verified at L91/L119/L152/L157). The behavior now lives in `resolveTeamProjection` over `TeamProjectionMirror`; the legacy TeamMirror/`resolveTeamView` surface was folded away in T6.
- `TeamView › switches to the member session when a timeline bar is clicked (D9)` — **(a) PORTABLE**: target `packages/client/test/team-view.client.spec.tsx` — render `<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, { [LEADER]: ledgerState([...intervals]) })}>` with a ledger state carrying a member interval (reuse the spec's existing fixture helpers), click the rendered `[data-team-timeline-bar]`, assert `openSession` called once with the member session. The component half is already verified in `team-timeline.client.spec.tsx` › `switches to the child session on a bar click`; the view-to-timeline wiring is asserted nowhere in vNext (reviewer-verified: `[data-team-timeline-bar` appears only in `team-timeline.client.spec.tsx` across the vNext test dir).
- `TeamView › renders the task board and event stream from the view and switches sessions on feed-row click (D9)` — **(c) ALREADY-COVERED-ELSEWHERE**: in-spec replacements `team-view.client.spec.tsx` › `renders the activity section from the snapshot current-work face` (row layout subject/status/'负责人 mate'/summary) + › `switches to the actor session when a ledger row is clicked (D9)` (row-click navigation); the feed-specific assertions (mixed category rows ascending, '等待裁决' pending-control marker, multi-row dual-target navigation) are verified in `packages/client/test/team-ledger.client.spec.tsx` › `renders the row families with the frozen category markers` (5 rows ascending incl. control-request between messages), › `shows the waiting badge (amber dot) on an unpaired control request` (asserts '等待裁决'), › `switches sessions on row click (D9) and stays inert without a resolved session` (row clicks → onSelectSession(member) then (leader)) — all titles reviewer-verified.

---

## 15. Totals

| # | Legacy file | vNext counterpart | N | M | covered | G | (a) | (b) | (c) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | client-bundle | client-bundle (frozen copy, dead) | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| 2 | team-dock-model | team-dock-model | 8 | 9 | 6 | 2 | 0 | 2 | 0 |
| 3 | team-dock | team-dock | 12 | 12 | 10 | 2 | 0 | 2 | 0 |
| 4 | team-feed-model | team-ledger-model | 19 | 20 | 7 | 12 | 5 | 7 | 0 |
| 5 | team-feed | team-ledger | 20 | 19 | 16 | 4 | 0 | 4 | 0 |
| 6 | team-marker-definition | DELETED (negative tests) | 15 | 0 | 0 | 15 | 0 | 14 | 1 |
| 7 | team-marker | DELETED (negative tests) | 14* | 0 | 0 | 14 | 0 | 12 | 2 |
| 8 | team-members-model | team-members-model | 9 | 10 | 9 | 0 | 0 | 0 | 0 |
| 9 | team-members | team-members | 12 | 12 | 12 | 0 | 0 | 0 | 0 |
| 10 | team-plugin | team-plugin (frozen copy) | 4 | 4 | 0 | 4 | 1 | 1 | 2 |
| 11 | team-tasks | team-activity | 7 | 7 | 4 | 3 | 1 | 2 | 0 |
| 12 | team-timeline-model | team-timeline-model | 17 | 18 | 17 | 0 | 0 | 0 | 0 |
| 13 | team-timeline | team-timeline | 18 | 18 | 18 | 0 | 0 | 0 | 0 |
| 14 | team-view | team-view | 8 | 12 | 5 | 3 | 1 | 0 | 2 |
| | **TOTAL** | | **166** | **144** | **107** | **59** | **8** | **44** | **7** |

\* file 7 counts 14 `it`/`it.each` entries (2 `it.each` expand to 9 cases → 21 expanded cases).

**Key totals**

- Total legacy assertions: **166**
- Total gaps (no direct equivalent in the mapped vNext counterpart): **59** = **8 (a) PORTABLE** + **44 (b) OBSOLETE** + **7 (c) ALREADY-COVERED-ELSEWHERE**
- Total portable gaps: **8** (5 in `team-ledger-model.client.spec.ts` — exact hasMore boundary, no-dup/no-gap seam, mixed-family window, frame re-derive, depth-0 clamp; 1 in migrated `team-plugin.client.spec.tsx` — TeamSettingsSection zh render; 1 in `team-activity.client.spec.tsx` — en empty-state string; 1 in `team-view.client.spec.tsx` — timeline-bar-click D9 wiring)
- Note on nominal coverage: files 1 and 10 count as "covered" against frozen byte-identical legacy copies that cannot execute against vNext sources (missing artifact / missing `src/client/*` modules) — see §0.2. The actionable vNext coverage for those two surfaces lives in `client-plugin-mount.test.ts` (24 its), `client.test.ts` (2 its), and the in-flight `client-architecture-negatives.test.ts` (9 its, 3 scans currently failing on comment collisions — see §6.4 items 1/7/8 and §0.1 item 3).
