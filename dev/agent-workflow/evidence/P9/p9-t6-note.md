# P9-T6 evidence — ui: adapt team view and durable ledger surface

Plan authority: frozen P9 plan **P9-S4** (high-value legacy UI migration,
steps 4–6: `TeamView` shell, `TeamFeed` → `TeamLedger`, activity rows from
the `TeamTasks` visual) + **Gate P9-G4** + plan §8.8 (feed model ADAPT),
§8.9 (TeamFeed→TeamLedger ADAPT), §8.10 (TeamView ADAPT), §8.11 (TeamTasks
ADAPT AS ACTIVITY UI) + frozen UI doc §12.1 (fixed section order). Branch
`task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`. CORE PATCH BUDGET
remains **0**; no frozen-contract edits; `references/deepseek-harness-test-use`
untouched (linked for type resolution only).

## Scope rationale

T6 is the dual-path collapse the plan prescribes. The compat mirror path
(`TeamMirror` / `resolveTeamView` / `ensureTeam` / `pageTeamMessages` and the
`team-view-compat.ts` bridge — all `@deprecated` "removed end of T6" per T4)
is deleted; every team-tab section now resolves from ONE vNext input: the
per-session projection mirror (zero state, timeline, member groups, activity
rows via the snapshot's current-work face) plus the per-team ledger store
(the durable-ledger Events surface). The legacy feed/task surfaces are reused,
not re-fetched: `TeamFeed` → `TeamLedger` (durable ledger rows replace the
mirror feed), `TeamTasks` → `TeamActivity` (snapshot current-work rows,
non-interactive). The four sections render in the UI §12.1 fixed order
Timeline → Members → Activity → Events — the UI doc is the frozen authority
over plan §8.10's "suggested" wording (D1).

## Locked design decisions

- **D1** section order = UI §12.1 (`data-team-section` values
  `timeline|members|activity|ledger`), all four ungated once the snapshot
  lands.
- **D2** no wire paging in the UI: the store pages forward from the head;
  "load earlier" is a pure local window deepening (`loadedCount` 200 →
  200/step, clamped to the filtered total) over loaded entries; legacy
  messagesBefore-anchor paging tests DROPPED (see spec evidence); the
  counted remainder note re-binds to `max(0, total - completeThrough)`
  (0 when `total` is null, shown only while incomplete).
- **D3** loud error + retry: `ledgerState.error` renders a note plus a retry
  button calling the injected `onRetry` (store `refresh`); RPC failure and
  page reject are distinguished by the `reason` key (closed reject reasons
  such as `transport-loss` surface verbatim).
- **D4** activity rows are NON-interactive (no buttons, no navigation).
- **D5** activity dot mapping: in-progress → ongoing, completed → done,
  blocked → error, absent → ongoing.
- **D6** row key `ledger:${sequence}`; sort = durable `sequence` ascending
  ONLY (timestamps are display-only).
- **D7** row families: the 12 frozen fact types map to 11 named kinds with
  per-fact fail-safe leaf reads mirroring the adapter's frozen leaf order;
  unknown/future fact types render a safe generic row (raw factType marker,
  JSON payload detail, no thrown error, no guessed actor/session).
- **D8** client-local filters `{category, instanceId}`: category skips
  missing-category rows; the instance filter matches the row actor by
  instance id OR template id; actor-less rows are excluded under an active
  instance filter.
- **D9** navigation: the row actor's `childSessionId ?? teamSessionId` from
  the snapshot member rows; unresolved actor → inert disabled row.
- **D10** post-collapse injected face: `{hooks: {projectionMirror,
  teamLedgers}, ensureProjection, refreshTeamLedger, openSession}`; zero
  state iff `resolution === undefined`; cold pull fires once per mirror gap,
  landing frames win.
- **D11** fail-safe `str`/`num` leaf discipline throughout (no invented
  facts; absent stays absent).

## Deliverables

New / rewritten (untracked + modified, staged for commit):

| file | LOC | role |
| --- | --- | --- |
| `src/model/team-ledger-model.ts` | 370 | NEW pure feed→ledger row model: 12 frozen fact types → 11 named row kinds + safe generic unknown row; sequence-only sort; 200/200 window + local deepening; category/instance filters; remainder count; nav map |
| `src/ui/TeamLedger.tsx` | 310 | NEW, adapted `TeamFeed`: top bar (category + instance filter selects, error note + retry, load-earlier, remainder note), row families with pending / decision / progress badges, D9 row click navigation |
| `src/ui/TeamActivity.tsx` | 87 | NEW, adapted `TeamTasks`: non-interactive rows, three-state + absent status, assignee line, summary line |
| `src/ui/TeamView.tsx` | 130 | REWRITTEN projection-only: `TeamViewInjected` face (D10), zero state, one-shot cold pull, four ungated sections in UI §12.1 order, member-child perspective highlight |
| `src/ui/locales.ts` | 236 | DROPPED `view.tasks.*` / `view.task.*` / `view.events.*` (21 keys); ADDED `view.activity.*` (6) + `view.ledger.*` (title/empty/loading/remaining/retry/loadFailed/pending + 8 filter labels + 11 fact markers + 3 decision labels), zh/en pairs |
| `src/ui/TeamLedger.module.css` | 166 | RENAMED from `TeamFeed.module.css` (+ new `.filter` select rule) |
| `src/ui/TeamActivity.module.css` | 67 | RENAMED from `TeamTasks.module.css` (verbatim) |
| `test/team-view.client.spec.tsx` | 318 | REWRITTEN, 8 tests (legacy 8 → 8 migrate/drop, see below) |
| `test/team-ledger-model.client.spec.ts` | 359 | NEW, 20 pure-model tests (replaces the 359-LOC legacy `team-feed-model.client.spec.ts`) |
| `test/team-ledger.client.spec.tsx` | 414 | NEW, 19 jsdom tests (replaces the 500-LOC legacy `team-feed.client.spec.tsx`) |
| `test/team-activity.client.spec.tsx` | 108 | NEW, 7 jsdom tests (replaces the 134-LOC legacy `team-tasks.client.spec.tsx`) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 389 | scannable-count pin 587 → 586 + P9-T6 pin comment (scan delta only; the denylist vocabulary and the quarantine set are untouched — the marker-spec quarantine entries stay until the T10 DROP) |

Small in-place fixes: `src/ui/TeamDock.tsx` (`ACTIVITY_STATUS_KEYS`
repointed `view.task.*` → `view.activity.*`, identical label strings),
`src/state/team-session-resolution.ts` (dangling JSDoc bridge reference
updated — the transitional bridge is folded away in T6).

Deleted (1745 lines, staged): `src/model/team-view-compat.ts`,
`src/model/team-feed-model.ts`, `src/ui/TeamFeed.tsx`,
`src/ui/TeamTasks.tsx`, `test/team-feed-model.client.spec.ts`,
`test/team-feed.client.spec.tsx`, `test/team-tasks.client.spec.tsx`.
Grep-verified: zero remaining references to the deleted modules or to
`view.(events|tasks|task).*` locale keys.

## Spec migrate/drop evidence (Gate P9-G4)

Every legacy test is accounted for in the new spec headers:

- **team-view (8 → 8)**: `resolveTeamView` derivation DROPPED (the compat
  module is gone; `resolveTeamProjection` is covered by the T5
  projection-mirror spec); dual cold pull MIGRATED to the single
  `ensureProjection` pull; four sections MIGRATED from dual-path to
  ONE input (timeline/members projection-fed, activity snapshot-fed, ledger
  store-fed) for leader AND member session (plus the member-session
  current-row highlight); the timeline bar click DROPPED (bar wiring is
  covered by the T5 team-timeline spec at component level; view-level D9
  wiring is proven by the member-row and ledger-row clicks); member-row D9
  and leader-row D10 MIGRATED as-is; the task-board + feed-row test
  REPLACED by the three new section tests (activity rows, ledger rows,
  ledger-row click navigation); landing-frames-win MIGRATED (dual mirror
  gains → single projection mirror, no re-fire).
- **feed-model (legacy 359-LOC spec → 20 tests)**: 200/200 constants,
  sequence-beats-timestamp order, window cap/deepen/clamp, category +
  instance/template filters, actor-less exclusion, remainder counts, label
  resolution, nav resolution, control pending/decision joins, message
  from/to, interval-open/close joins, progress values, the safe generic
  unknown-fact row, key + empty-model shape — all retained or re-based on
  the durable `sequence` identity.
- **feed (20 → 19)**: row families, pending badge, three decision labels +
  raw-value fallback, title detail, 200-cap + load-earlier clicks, partial
  remainder note + hide-on-complete, RPC error + retry, transport-loss
  reject note, NEW-team reset (window + filters), empty + loading lines,
  D9 nav clicks, unknown generic row, both filter selects, decision reason,
  progress badge, en pairing. DROPPED: the messagesBefore-anchor wire
  paging tests (D2 — the store pages forward from the head; the UI window
  is local).
- **tasks (7 → 7)**: row anatomy, three status labels + the absent-status
  arm (legacy four labels → the frozen three `ProgressValue`s), absent
  summary, labels as-is, empty line, non-interactive no-op, en pairing.
  DROPPED: the D19 raw-id fallback arm (label resolution moved to the
  projection adapter in T4/T5).

Gate P9-G4 items: Team tab zero-state retained (zero-state test); Ledger
row window/load/retry retained (cap/deepen/remainder/retry tests); no
synthetic Chat marker registration (none — no marker surface in T6).

## Gates

1. `tsc -p packages/client/tsconfig.json --noEmit` (full face) — EXIT 0
   (`t6-typecheck-1.log`).
2. `tsc -p packages/client/tsconfig.build.json` (build face) — EXIT 0,
   `dist` removed after emit (`t6-build-1.log`).
3. `node scripts/run-tests.mjs` (full repo suite) — **2254 passed, 0
   failed** (`t6-runtests-full.log`), p4t6 10/10 at the new 586 pin.
   Honest disclosure: the first full run of T6 hit 3 transient failures in
   `packages/runtime/test/p6t1-parallel.test.ts` (the P6-T1 five-parallel
   quota-race — a timing-sensitive concurrency test untouched by T6, which
   only modified `packages/client` + one testkit count pin). The runtime
   package rerun alone was 1087/1087 and the full-suite rerun was clean;
   the committed log is the clean run.
4. `tsc -p packages/testkit/tsconfig.json --noEmit` — EXIT 0 (the p4t6 pin
   edit lives in this face).

p4t6 count delta (587 → 586): the frozen scanner covers only
`.ts`/`.mts`/`.mjs`. T6 scannable delta: −`model/team-view-compat.ts`,
−`model/team-feed-model.ts`, +`model/team-ledger-model.ts`,
−`test/team-feed-model.client.spec.ts`, +`test/team-ledger-model.client.spec.ts`
= −1. All `.tsx`/`.css` adaptations (TeamFeed→TeamLedger,
TeamTasks→TeamActivity, the rewritten team-view spec, both CSS renames) are
outside the scanner's extension set. The new files carry zero denylist
vocabulary (the scan over them passes).

## No-silent-edit attestation

Frozen `packages/remote` + `packages/contracts` untouched; no CORE patches
(budget 0); `references/deepseek-harness-test-use` pristine; legacy
`references/deepseek-harness` untouched; `graph.yaml` /
`SESSION_ROUTER_LOG.md` untouched (main-agent-owned). The p4t6 change is
the count pin + its pin comment only — no denylist vocabulary change, no
quarantine-set change (the six marker-spec fixture tokens stay quarantined
until the T10 DROP).
