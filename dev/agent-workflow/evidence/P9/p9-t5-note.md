# P9-T5 evidence — ui: mechanically migrate timeline/member/dock surfaces

Plan authority: frozen P9 plan S3-C (minus the feed — feed stays legacy until
T6) + Gate P9-G3 + §8.2 (timeline), §8.4 (members), §8.6 (dock), §7.2–§7.4
(display mapping, navigation, pending, activity), §5 (layout). Branch
`task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`. CORE PATCH BUDGET remains
**0**; no frozen-contract edits; `references/deepseek-harness-test-use`
untouched (linked for type resolution only).

## Scope rationale

T5 is the mechanical input swap the plan prescribes: the three section
components and their pure models move from the legacy mirror/delegation/task
vocabulary to the vNext `TeamUiSnapshot` + `TeamUiLedgerModel` inputs, with
the render trees, interaction code, and locale-owned copy kept. The timeline
and member GROUPS move up to the projection path in this task because the
frozen plan §8.2/§8.4 define their vNext inputs (ledger intervals; member
instances) and the shell seam needs both sections on one input before T6 can
collapse the dual path. The task board and event stream stay on the legacy
`TeamView` mirror in this task (their vNext inputs — `progress` rows and
ledger `messages`/`controls` — are consumed by the T6 durable-ledger surface).
`TeamTasks.tsx` / `TeamFeed.tsx` are byte-untouched.

## Deliverables

Seventeen in-place migrations (no new files; the models/specs landed in the
T2 mechanical-import commit in legacy form and are migrated here):

| file | LOC | role |
| --- | --- | --- |
| `src/model/team-timeline-model.ts` | 214 | `deriveTeamTimeline(snapshot, ledger, now)` — intervals → lanes/spans (epoch ms) |
| `src/model/team-members-model.ts` | 170 | `deriveTeamMembers(snapshot, ledger)` — leader row + non-leader groups |
| `src/model/team-dock-model.ts` | 112 | `deriveTeamDockCounts` / `deriveTeamDockContent` — D23 readout + expanded content |
| `src/model/ledger-adapter.ts` | 478 | +`ledgerModelFromStoreState` (T5 seam lift over the T4 pure adapter) |
| `src/state/team-session-resolution.ts` | 131 | +`sameTeamProjectionResolution` (selector eq seat) |
| `src/ui/TeamTimeline.tsx` | 360 | props `{snapshot, ledger, currentInstanceId}`; Trap C interaction/geometry verbatim |
| `src/ui/TeamMembers.tsx` | 194 | five-state rows, completeness-aware badge, D9/D10 wiring |
| `src/ui/TeamDock.tsx` | 249 | panel (pure) + outer cold-fill seam on `projectionMirror` |
| `src/ui/TeamView.tsx` | 163 | dual-path shell (mirror path: zero/tasks/feed; projection path: timeline/members) |
| `src/ui/locales.ts` | 191 | `members.bound`→`created`+`archived`+`disposed`; `dock.tasks.empty`→`dock.activities.empty` |
| `test/team-timeline-model.client.spec.ts` | 348 | vNext fixtures, 1:1 scenario port |
| `test/team-members-model.client.spec.ts` | 281 | vNext fixtures, 1:1 scenario port |
| `test/team-dock-model.client.spec.ts` | 272 | vNext fixtures, 1:1 scenario port |
| `test/team-timeline.client.spec.tsx` | 457 | 18 tests 1:1 with legacy; wheel/drag/keyboard/tooltip/dblclick byte-kept |
| `test/team-members.client.spec.tsx` | 329 | 12 tests (five-state, badge completeness, D7/D9/D10, EN pairing) |
| `test/team-dock.client.spec.tsx` | 371 | 12 tests (readout, zero-omission, expand, D13 jump, outer cold pull) |
| `test/team-view.client.spec.tsx` | 358 | dual-path shell: 8 tests (both cold pulls, four sections, D9/D10, legacy tasks/feed) |

## Model input/output mapping

| model | legacy input | vNext input | output kept |
| --- | --- | --- | --- |
| timeline | `TeamView.delegations` (startedAt/endedAt/inProgress, ms) | `snapshot.members` (lanes) + `ledger.intervals` (ISO, `Date.parse`d inside) + `now` | lane matrix, tick/formatClock/formatDuration, domain arithmetic, `TEAM_LANE_COLOR_SLOTS = 8` |
| members | `TeamView.members` (grouping key `memberId`, `sessionIds[0]`, status `unbound/bound/running/settled`) | `snapshot.members` (grouping key `templateId`, identity `instanceId`, name = template `displayName ?? label`, `childSessionId`) + `ledger` | group container + instance row render, D7 highlight, D9/D10 navigation |
| dock | `TeamView` session-log overlay (running) + per-row `pendingControlCount` sum | `snapshot.members` lifecycle + `ledgerSummary.pendingControlCount` directly + `snapshot.activity` | collapsed readout join, chevron/expand, member + activity rows, D13 jump |

## Design decisions (T5)

1. **Unbound vocabulary abolished.** Legacy `unbound` (a roster member with no
   session yet) has no vNext successor: a `CREATED` instance is a real row
   (the plan §8.4 five-state lifecycle presentation). The members spec's
   "unbound" scenario becomes "a created instance is a real row" (Beta), and
   the dock roster goes from the legacy 2 (unbound skipped) to 3 rows.
2. **Progress-domain extension complete-only.** `ledger.progress` (durable
   `at` facts) extends the timeline domain only for a known-complete ledger
   (plan §7.4 successor of the legacy task-`at` extension); a partial ledger
   never claims a wider board.
3. **Leader synthesis stand-in.** No leader-kind instance → the leading row is
   synthesized with `templateId = teamSessionId`, `name = undefined` (the
   renderer falls back to `t('member.leader')`), empty instances.
4. **Dock M from the summary, never a per-row sum.** `pending =
   ledgerSummary.pendingControlCount` directly (frozen D23); the per-instance
   badge is completeness-aware (`null` under partial, `byInstance ?? 0` under
   complete — plan §7.3).
5. **Dock running from the projection lifecycle only** (never the session log,
   plan §8.6); `fromHistory` rows are excluded from both the running count and
   the roster rows; archived/disposed are never counted.
6. **`isOpen` is the single open/close authority.** A loaded interval renders
   per its `isOpen` flag; the legacy "open-with-settlement" inconsistent case
   (inProgress=true with an endedAt) disappears because the frozen interval
   rows pair by `correlation` (T4 ledger adapter).
7. **Eq comparator rationale.** `resolveTeamProjection` returns a fresh
   wrapper per call, so the slot selector hook's optional `eq` seat carries
   `sameTeamProjectionResolution` (identity-stable `team` reference +
   perspective); without it every notification would re-render the shell.
8. **Activity subject fallback chain.** `subject ?? summary ?? currentAction`
   for the dock compact row text; status absent → no dot, no status text.
9. **Provisional dot mapping** (documented in the components; T6 may polish
   visuals): created→`warning`, running→`ongoing`, settled/archived/
   disposed→`done`; activity in-progress→`ongoing`, completed→`done`,
   blocked→`error`, absent→no dot. The `styles.tasks`/`styles.task` CSS class
   names are kept on the dock activity list (attribute renames only).
10. **Second-leader-instance faithfulness.** Every leader-kind instance
    renders as its own row inside the leader group (own `instanceId`, own
    `childSessionId`); the group's leading row stays the fixed "back to
    leader" entry.
11. **Dual-path transition (shell).** `team === undefined` (mirror path) →
    one-line zero state; otherwise tasks/feed render from the mirror and
    timeline/members render only while `snapshot !== null` — the transient
    missing-section window is the documented T5/T6 behavior (sections appear
    when the projection frame lands; T6 collapses the path).
12. **Rules-of-hooks ordering (shell).** All three mirror hooks, both cold-fill
    effects, and both `useMemo`s run before the zero-state early return; the
    ledger selector keys on `snapshot?.teamSessionId ?? ''`.
13. **Cold-fill pattern (both paths + outer dock).** Selector gap →
    `void ensureX(sessionId)` once; landing frames win; no re-fire (asserted
    in the view and dock specs).
14. **Members EN-pairing test adjustment.** The legacy "No instances yet"
    assertion with the default roster was wrong under vNext (Beta has a real
    created row); the note now renders only for the synthesized leader group,
    so the test uses a roster-absent team (synthesized 'Leader · 0 active' +
    note).

## Spec migration (1:1 mapping)

- **timeline** (18 tests): lane matrix, multi-span geometry, running bar +
  clock advance (open ends at `now`), wheel zoom/double-click/cap, pan,
  contextmenu suppression, pointer-cancel/jiggle/middle-button, bar click →
  `childSessionId`, press-move = pan, full keyboard sequence, tooltip content,
  `currentInstanceId` highlight, sessionless (ghost) lane inert, tick labels.
  `beforeEach`/`afterEach` (fake timers at `T + 300_000`, pointer-capture
  mocks) byte-identical.
- **members** (12): group labels + first button, D10 leader click →
  `teamSessionId`, roster-absent fallback, five-state labels + status
  attributes, created-real-row, action + placeholder, completeness-aware badge
  (complete+count / partial→0 / complete+empty→0), D9 multi-instance, D7
  highlight (member + leader), non-leader rows inert, sessionless disabled, EN
  pairing with roster-absent team.
- **dock** (12): collapsed readout + zero-count omission, chevron
  aria-expanded, expanded member + activity rows, remaining dots (archived /
  blocked), empty notes, D13 jump (title, no aria-label, no expand), EN
  pairing; outer: non-team null + single pull, member-session via binding,
  cold pull landing (1 call), jump thread-through.
- **view** (8): frozen `resolveTeamView` block kept (compat bridge alive until
  T6); zero state + BOTH cold pulls fire once (mirror `ensureTeam` +
  projection `ensureProjection`); four sections live (timeline/members from
  the projection path, tasks/feed from the mirror path); D9 bar click →
  `childSessionId` (bar data now from a loaded `activity-interval-*` ledger
  fact pair, replacing the legacy delegation row); D9 instance row click; D10
  leader row; legacy tasks + feed rows unchanged (feed-row click wiring kept);
  landing-frames-win (no re-fire on either path). The legacy
  `ONE_DELEGATION`/`DELEGATION_MIRROR` fixtures are dropped — delegations no
  longer feed the timeline.

## Verification (in-sandbox)

- **tsc full face** (`-p packages/client/tsconfig.json`, src + test +
  vitest.config.ts): 0 errors (`t5-typecheck-1.log`).
- **tsc build face** (`-p packages/client/tsconfig.build.json`): 0 errors;
  emit removed (`t5-build-1.log`).
- **Full repo suite** (`node scripts/run-tests.mjs`): 2254 passed / 0 failed,
  unchanged from T4 (no runner-discovered file added or removed; the
  p4t6 session-event scan is inside — 10/10, 587 files, zero violations
  outside the frozen 21-entry quarantine) (`t5-runtests-full.log`).
  Note: the very first post-build run showed 2 transient failures (cold-start
  timer sensitivity); six consecutive subsequent runs — including all logged
  gate runs — were 2254/0 with no recurrence.
- **Pure-model runtime sanity**: the build-face emit was executed under node
  with a throwaway assertion script (deleted afterwards) covering the key
  spec scenarios — timeline null / lane matrix / multi-span geometry / open
  interval ends at `now` / ghost fallback lane / settled-static domain;
  members leader / synthesized leader / group order / active counts /
  completeness-aware pending / history rows; dock counts (history excluded,
  M from summary) / roster exclusion / subject fallback chain. All passed.
- **jsdom `.client.spec.*` specs** (the 7 migrated files): type-checked by
  the full face; they execute only under the real vitest in S8 (no jsdom
  runtime in this sandbox).

## No-silent-edit attestation

Frozen `packages/remote` + `packages/contracts` untouched; no CORE patches
(budget 0); `references/deepseek-harness-test-use` pristine; `TeamTasks.tsx` /
`TeamFeed.tsx` byte-untouched; the compat bridge (`team-view-compat.ts`)
untouched — it is T6's to remove; legacy `references/deepseek-harness`
untouched.
