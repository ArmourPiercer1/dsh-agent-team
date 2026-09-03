# P9-T10 evidence — test migration + negative architecture guards (P9-S7)

Plan authority: frozen P9 plan **P9-S7** (L1611–1680) — the 14-row legacy
test migration table, the three new test groups (Transport/store,
Projection adapter, Command flows), and the seven negative architecture
guard bullets (L1671–1677). Branch `task/P9-ui-legacy-reuse`, worktree
`.worktrees/P9`, parent commit `d4e6eb1` (P9-T9). CORE PATCH BUDGET remains
**0**; no frozen-contract edits; `references/deepseek-harness-test-use`
untouched (linked for type resolution only); no push.

## Deliverables (per-file, measured line counts, CRLF BOM-free)

| File | Status | Lines (final) | Diff (cached numstat) |
| --- | --- | ---: | --- |
| `packages/client/test/client-architecture-negatives.test.ts` | new (runner) | 216 | +215/−0 |
| `packages/client/test/team-remote-categories.test.ts` | new (runner) | 224 | +223/−0 |
| `packages/client/test/team-command-flow.test.ts` | new (runner) | 301 | +300/−0 |
| `packages/client/test/client-bundle.client.spec.ts` | rewritten (frozen legacy copy → vNext package surface) | 173 | +154/−103 |
| `packages/client/test/team-plugin.client.spec.tsx` | rewritten (frozen legacy copy → real `apply()`) | 287 | +271/−226 |
| `packages/client/test/team-creation-panel.client.spec.tsx` | edited (harness `onCancel` + cancel it) | 554 | +42/−2 |
| `packages/client/test/projection-adapter.test.ts` | edited (G3 +2 its) | 392 | +37/−0 |
| `packages/client/test/team-marker-definition.client.spec.ts` | DELETED (binding drop) | — | −376 |
| `packages/client/test/team-marker.client.spec.tsx` | DELETED (drop as Chat) | — | −337 |
| `packages/client/tsconfig.json` | edited (exclude block removed; `.client.spec.*` back in typecheck) | 13 | −6 |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | edited (pins 600/15; quarantine back to the two-file set) | 429 | +23/−22 |
| `dev/agent-workflow/evidence/P9/t10-legacy-assertion-diff.md` | new (review evidence, the 14-row assertion-level diff) | 750 | +750/−0 |
| `dev/agent-workflow/evidence/P9/t10-gates-full-suite.log` | new (gate log) | 220 | +220/−0 |
| `dev/agent-workflow/evidence/P9/t10-gates-tsc.log` | new (gate log) | 14 | +14/−0 |
| `dev/agent-workflow/evidence/P9/p9-t10-note.md` | new (this note) | 174 | +174/−0 |

## 14-row migrate/drop evidence table (DoD item 10)

Per-row figures from the assertion-level review
(`t10-legacy-assertion-diff.md`): N = legacy `it`/`it.each` entries,
M = `it` count in the vNext counterpart, covered = with a direct vNext
equivalent, G = gaps; gap classes: (a) PORTABLE, (b) OBSOLETE,
(c) ALREADY-COVERED-ELSEWHERE.

| # | Legacy spec | P9 action (frozen) | vNext counterpart | Evidence (N/M/covered/G + gap classes) |
|---|---|---|---|---|
| 1 | `client-bundle.client.spec.ts` | ADAPT package/export/browser bundle | this T10: rewritten in place | 3/3/3/0 — legacy `__ModuleLoader__` artifact load replaced by the package.json surface (D-T9-11: exactly the `.` subpath), the static plugin contract, and src/dist text audits; the vNext bundle is plain tsc ESM |
| 2 | `team-dock-model.client.spec.ts` | MECHANICAL ADAPT fixtures | `team-dock-model.client.spec.ts` (T5) | 8/9/6/2 — 2×(b): per-row pending sum → `ledgerSummary.pendingControlCount`; the unbound-skip sub-rule is abolished |
| 3 | `team-dock.client.spec.tsx` | MECHANICAL ADAPT store injection | `team-dock.client.spec.tsx` (T5) | 12/12/10/2 — 2×(b): unbound-skip sub-rule; the pending-task `待开始` label (vNext `PROGRESS_VALUES` = in-progress/completed/blocked) |
| 4 | `team-feed-model.client.spec.ts` | ADAPT ledger fixtures | `team-ledger-model.client.spec.ts` (T6) | 19/20/7/12 — 5×(a) residual portable, 7×(b) (see residual note below) |
| 5 | `team-feed.client.spec.tsx` | ADAPT pagination/retry semantics | `team-ledger.client.spec.tsx` (T6) | 20/19/16/4 — 4×(b): vNext pages forward (`afterSequence`, size 50) instead of splicing older pages |
| 6 | `team-marker-definition.client.spec.ts` | DROP / replace with negative test: no marker registration | DELETED this T10; negative = `client-architecture-negatives.test.ts` (tokens `TEAM_MARKER_KIND`, `teamMarkerDefinition`, `ConversationNodeDefinition`, `team-marker`, `conversation.chat.node`) | 15/0/0/15 — 14×(b) marker-vocabulary obsolete; 1×(c): session targeting → `team-ledger-model.client.spec.ts` navigation it |
| 7 | `team-marker.client.spec.tsx` | DROP as Chat; optional reuse as ledger-row visual test | DELETED this T10 | 14 entries (21 expanded cases)/0/0/14 — 12×(b) + 2×(c); the OPTIONAL reuse is recorded as four render-level gaps in the diff §7 (deferred, not mandated by the frozen table) |
| 8 | `team-members-model.client.spec.ts` | MECHANICAL ADAPT lifecycle/template fixtures | `team-members-model.client.spec.ts` (T6) | 9/10/9/0 |
| 9 | `team-members.client.spec.tsx` | MECHANICAL ADAPT | `team-members.client.spec.tsx` (T7) | 12/12/12/0 (the D9 nav target is `[data-member-instance-nav]` per T7) |
| 10 | `team-plugin.client.spec.tsx` | ADAPT new registrations + explicit absence of marker | this T10: rewritten in place | 4/4/0/4 — 1×(a) ported IN this T10 (the zh read-only configuration instructions render, spec it 7); 2×(c) → `client-plugin-mount.test.ts` (8 its cited); 1×(b) node-half inertness / invariant ownership (no `applyNode`, package renamed `@dsh-agent-team/client`) |
| 11 | `team-tasks.client.spec.tsx` | ADAPT to activity row or retire with rationale | `team-activity.client.spec.tsx` (T6, adapted) | 7/7/4/3 — 1×(a) residual portable (en empty-state `No activity progress yet`), 2×(b): the four-status `待开始` label; the D19 raw-id fallback is structurally unreachable (adapter-built rows) |
| 12 | `team-timeline-model.client.spec.ts` | MECHANICAL ADAPT | `team-timeline-model.client.spec.ts` (T6) | 17/18/17/0 (vNext adds the partial-ledger domain guard; the it.each duration table is identical, 14 rows) |
| 13 | `team-timeline.client.spec.tsx` | MECHANICAL ADAPT | `team-timeline.client.spec.tsx` (T6) | 18/18/18/0 |
| 14 | `team-view.client.spec.tsx` | ADAPT store/zero-state/section composition | `team-view.client.spec.tsx` (T6) | 8/12/5/3 — 1×(a) residual portable (view→timeline D9 bar-click wiring), 2×(c) → `team-session-resolution.test.ts` + in-spec activity/ledger its |

**Totals: N = 166 legacy assertions; M = 144 vNext; covered = 107;
G = 59 = 8 (a) PORTABLE + 44 (b) OBSOLETE + 7 (c) ALREADY-COVERED-ELSEWHERE.**
One of the eight portable gaps was ported in this T10 (row 10). The other
seven live in files frozen by the T5/T6 commits and are recorded as a
residual for a future test pass: 5 → `team-ledger-model.client.spec.ts`
(hasMore boundary, no-dup splice, approval retention, same-depth
re-derivation, depth-0 clamp), 1 → `team-activity.client.spec.tsx` (en
dictionary pairing), 1 → `team-view.client.spec.tsx` (D9 timeline
bar-click → `openSession`).

## Binding drop verification

- `git rm` of both marker specs, staged `D`:
  - `packages/client/test/team-marker-definition.client.spec.ts` — 376 lines,
    git blob `9ff87443691b100bada4b8f162d52d8bab4a8b45`, byte-identical to
    the legacy evidence copy (no vNext-authored content lost);
  - `packages/client/test/team-marker.client.spec.tsx` — 337 lines,
    git blob `ccafe89e4378b923849a7fe1b4e62faf58a1422d`, byte-identical.
- `QUARANTINE_FILES` in `p4t6-session-event-scan.test.ts` restored to the
  ORIGINAL two-file set (`packages/contracts/src/legacy-vocabulary.ts` +
  `packages/contracts/test/negative.test.ts`); the P9-T1 temporary entry is
  gone with the spec.
- End-state grep over `packages/client` (src AND test), final tree:
  - `dsh-client-runtime` → **0 matches** (empty result; the rewritten
    `client-bundle.client.spec.ts` assembles its audit token from parts so
    the spec itself does not carry the literal).
- The "no marker registration" replacement coverage: the seven negative its
  in `client-architecture-negatives.test.ts` (runner) + the explicit-absence
  it in `team-plugin.client.spec.tsx` (type-checked, S8 execution).

## Pin arithmetic (p4t6-session-event-scan)

- Scan-target count: `598 + 3 − 1 = 600` — plus three new scannable
  `.test.ts` (client-architecture-negatives, team-remote-categories,
  team-command-flow), minus the deleted `team-marker-definition.client.spec.ts`;
  both in-place rewrites (`client-bundle.client.spec.ts` .ts,
  `team-plugin.client.spec.tsx` .tsx) change nothing; the pin-comment block
  was APPENDED after the P9-T9 block (historical blocks untouched).
- Quarantine hits: `21 − 6 = 15` — the six P9-T1 marker-spec fixture tokens
  left with the spec; title now "fifteen".
- Both pins verified by the runner (testkit green, 10 its).

## New test inventory

Runner-executable (`*.test.ts`, plain-node) — **+20 its in three new files**:
`client-architecture-negatives.test.ts` (9: scan sanity + detector-live
control + the seven negative architecture guards), `team-remote-categories.test.ts`
(5: malformed-params, internal-error, success no-re-wrap, transport loss,
channel guard), `team-command-flow.test.ts` (6: pending→resolve flow,
no optimistic state, verbatim requestToken on the wire, outcome shape,
projection-driven settle).

Type-checked-only (`.client.spec.*`, executed at S8 on real vitest):
`team-plugin.client.spec.tsx` rewritten (7 its, real `apply()` with seam
doubles), `client-bundle.client.spec.ts` rewritten (4 its, 1 skipIf when
`dist/` is absent), `team-creation-panel.client.spec.tsx` +1 it (13→14,
create-cancel zero mutation). Plus runner `projection-adapter.test.ts` +2 its
(14→16: same-template instances, groupId opaque passthrough).

Suite results (final tree): client package **238 passed / 0 failed**;
full suite **2405 passed / 0 failed** (`t10-gates-full-suite.log`).

## Gates (final tree)

- `node scripts/run-tests.mjs` → 2405 passed, 0 failed (log:
  `t10-gates-full-suite.log`).
- `tsc -p packages/client/tsconfig.json` (noEmit full: src + test, incl.
  `.client.spec.*` and `.test.ts`) → SILENT, exit 0.
- `tsc -p packages/testkit/tsconfig.json` → SILENT, exit 0.
- `tsc -p packages/client/tsconfig.build.json` → EMITS 356 files, exit 0;
  `packages/client/dist` REMOVED afterwards (log: `t10-gates-tsc.log`).
- `git status --porcelain` = 0 and `git clean -n -d` empty after the commit.
- Byte hygiene: every deliverable + evidence file CRLF, BOM-free, exactly
  one trailing newline (independent verify pass, all ok).
- Single commit on `task/P9-ui-legacy-reuse`, parent `d4e6eb1`; NO push.

## Flake / artifact disclosure

- Known flake classes (p6t1-parallel timeout race; g8s1-generation-stamp
  `.tmp-fault` ENOTEMPTY): none observed across the runs for this task;
  the suite was green on every pass. A leftover
  `packages/testkit/test/.tmp-fault/` scratch dir from a crash-matrix run
  was removed before the commit (test scratch, not an artifact).
- The review digest (`t10-legacy-assertion-diff.md`) was written by a
  read-only review child against the IN-FLIGHT T10 tree. Its §0.1
  observations about the in-flight negative spec (three scans failing on
  doc-comment collisions at review time) were resolved before this commit:
  the scanner strips pure comment lines and the bullet-7 token set changed
  (see divergences). The committed negative spec is green (9 its).

## Design decisions + divergences

- **Negative bullet 7 (no synthetic Chat/Trajectory event generation)**:
  the bare word "trajectory" is LEGITIMATE vNext vocabulary
  (`degradedTo: 'native-chat-trajectory'` in `model/team-legacy.ts`,
  locale strings, jscpd comments), so a bare-word scan cannot be the guard.
  The guard pins the four legacy synthetic-event identifiers instead
  (recorded in the spec header); the five `team/*` event strings are
  additionally pinned by the p4t6 scan (zero outside the quarantine).
- **Create-cancel coverage placement**: the cancel behavior is a UI-layer
  property of the panel, so it lives in
  `team-creation-panel.client.spec.tsx` (type-checked, S8 execution), while
  the plan's Command-flows bullets (runner-executable) cover the wire-side
  sequence in `team-command-flow.test.ts`.
- **Bundle spec environment**: node env (no jsdom banner) — pure
  `node:fs` + static imports + text audits; the forbidden runtime-import
  audit token is assembled from parts so the spec never carries the
  binding-grep literal verbatim; the dist-artifact audit is skipIf-guarded
  (the build is a gate step, not a test precondition).
- **Optional row-7 reuse** (marker as ledger-row visual test): recorded,
  not executed — the frozen table marks it optional; the four render-level
  gaps are listed in the diff §7 for a future test pass.

## devDep evaluation (report only)

`packages/client/src` STILL imports `@deepseek-ai/dsh-client-store` in
three places: `src/ui/TeamView.tsx` L19 (type), `src/ui/TeamDock.tsx` L19
(type), `src/plugin/team-mount-core.ts` L45 (value:
`createSnapshotStore`) → the devDep STAYS; it is not droppable at closure.
