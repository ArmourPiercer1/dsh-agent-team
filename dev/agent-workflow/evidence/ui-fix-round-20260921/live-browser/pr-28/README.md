# ui-fix-round-20260921 — live-browser evidence, PR #28 (guide §9/§10) — FINAL

Real-browser validation of the supplemental member-command fixes on branch
`fix/member-command-dialogs`, per
`docs/plans/active/PR27_PR28_supplemental_fix_and_real_ui_validation.md`.
The installed `browser-skill` (browser_* / bsk tools, real Chromium Agent
Window) drove the real DSH Web UI; the DSH Vision Toolkit
(`vision-glance` full + zoomed region passes) reviewed every screenshot.
jsdom/RTL results are NOT substituted for this evidence — the automated
suites stay at their baseline, but the merge verdict is decided on the
real page.

This package is the **final supplemental round** (2026-09-22). It closes
the guide's remaining items: the forced real action-button wrap (28-A2),
the kit verdict self-consistency, a fresh-world re-run with the fixed kit,
and the stale description set. Round-1 (2026-09-21) established
28-A…28-E at head `14a6b25`; this round adds 28-A2 and re-verifies the
row geometry at the final product head.

## What this round changed in product code

**One minimal CSS fix** (the guide's §1 contingency: "if the wrap reveals
a layout bug → minimal CSS fix, then repeat"):

The 28-A2 forced-wrap investigation on the pre-fix tree (run
`…17-14-58.superseded-pre-row-fix`, live Chromium measurements) showed
the #28 `.actions` shrink+wrap contract can never land the buttons
INSIDE the card:

- `.instanceRow` / the DIV `.groupRow` are `width:100%` + padding on
  DIVs with default **content-box** sizing → each row's border box
  overflows the group card (28px rows / 20px headers); the group's
  `overflow:hidden` then clips the right-aligned content:
  - at the default 1044-class window the SETTLED 4-button cluster was
    clipped **18px** (处置 showed only its first glyph — the exact
    defect #28 exists to remove, at every width where the cluster
    stays on line 1);
  - at any width narrow enough for button-level wrap, the shrunk
    `.actions` box right edge still sat 18px past the card edge, so the
    wrapped last line would be clipped too — the §1 acceptance could
    not be met at **any** viewport width;
  - the worker group header's `+` create button was clipped 10px at all
    widths (the leader header escaped only because it is a `<button>`,
    already border-box via the #28 form-control rule).

Fix (commit `3acb7bc`, source + regenerated `client-bundle.js` in the
same commit): `box-sizing: border-box` on `.instanceRow` and
`.groupRow` — same class of change as #28's form-control border-box
rule, no layout restructure. Pre/post measured geometry in
`browser-run.md` (§28-A2).

## Heads

| head | content |
| --- | --- |
| `14a6b25` | round-1 product head (28-A…28-E screenshots) |
| `bf80c96` | merge of `origin/master` (`0544dea`, PR #27 merged) — no product delta |
| `3acb7bc` | **final product head — `.instanceRow`/`.groupRow` border-box fix + regenerated bundle; all final live evidence (run 7) ran at this head** |
| final branch head | `3acb7bc` + this evidence/bookkeeping commit (no product code delta) |

## Layout

```
live-browser/
├── README.md            this file (verdicts + how-to-reproduce)
├── kit/
│   └── live-ui-world.mjs  the world kit (shared with PR #27's package),
│                          final form: measured member-envelope blueprint,
│                          bootstrap race eliminated, drive predicate +
│                          verdict self-consistency gate, --selftest
└── pr-28/               this branch's package
    ├── 28-A.png … 28-E.png, 28-E-pre.png   round-1 screenshots (head 14a6b25)
    ├── 28-A2-actions-wrapped.png           THE §1 forced-wrap screenshot
    │                                       (360px emulated viewport, run 7)
    ├── 28-A-postfix-1044.png               default-window post-fix record
    │                                       (处置 fully visible — bug fixed)
    ├── README.md / browser-run.md / vision-review.md
    ├── run-console-28.log                  round-1 console
    └── run-*/                             all kit evidence runs:
        run-…16-04-06.aborted-missing-teamEnvelope   run 1 — kit bug:
                                                      blueprint lacked the
                                                      mutation teamEnvelope
                                                      (runtime fails closed);
                                                      kit fixed
        run-…16-09-22                            round 1 — full pass at 14a6b25
        run-…16-54-33.aborted-mock-ordering      run 3 — kit bug: mock
                                                      scripted team_delegate
                                                      before the work-
                                                      admitted decision →
                                                      timeout; kit fixed
        run-…16-57-49.aborted-progress-envelope  run 4 — kit bug: member
                                                      envelope ∩ template was
                                                      empty → report_progress
                                                      rejected; kit fixed.
                                                      summary.json kept:
                                                      verdict PASS + drive
                                                      {sent,done} = the
                                                      predicate proof
        run-…17-06-39.aborted-bootstrap-race     run 5 — kit bug: kit's own
                                                      session/create won the
                                                      create-or-open race →
                                                      bootstrap FAILED
                                                      (SessionAlreadyExists);
                                                      kit fixed (waits for
                                                      the plugin bootstrap's
                                                      durable commit, never
                                                      creates)
        run-…17-14-58.superseded-pre-row-fix     run 6 — pre-CSS-fix tree:
                                                      drive PASS, 13 ledger
                                                      facts; the wrap
                                                      investigation on this
                                                      pre-fix run MEASURED
                                                      the 18px 处置 clip /
                                                      28px row overflow /
                                                      10px + clip that
                                                      motivated the fix
        run-…17-45-17                            run 7 — **FINAL** at
                                                      3acb7bc: drive
                                                      sent+done in ~2s, 9
                                                      mock decisions, 13
                                                      ledger facts, UI
                                                      restore re-verified
                                                      (direct, human caller),
                                                      28-A2 wrap PASS
```

## Test instance (TEST_METHODS §7 — workspace-contained world)

- Checkout under test: `tests/deepseek-harness-test-use` @ `fb2c4b9e69`
  (pristine, verified pre and post each run; porcelain clean).
- DSH_HOME worlds: `tests/homes/liveui-<branch>-<stamp>` — removed at
  teardown (worlds hold launch tokens and are never committed; the
  committed run logs are token-scrubbed copies).
- Ports (3180 family only): host `3181`, mock model `3491`, control
  `3492`. `:3080` (stable instance) and `:3180` (the current session
  GUI) were NEVER used — read-only reachability probes before/after
  each run (recorded in each `run-*/summary.json`, asserted equal by
  the kit: 401==401 in every final run).
- Install form: `dsh plugin --profile web add git+file:///<bare-clone>#<branch>`
  — the branch under test, installed by the real test-use CLI against a
  prebuilt install surface (zero lifecycle scripts), bundle layer
  auto-adding the `dsh-agent-team` row; the profile patch layer then
  overrides the host row's config (boot team `team-root`, inline
  blueprint with the mutation `teamEnvelope` **and** the measured
  per-template member envelopes — a member's effective envelope is
  `teamEnvelope ∩ <its template's memberEnvelopes entry>`, so an empty
  `memberEnvelopes: []` fails every member operation closed — user
  preset `live-ui`, `staticModel` pin → the in-process mock model that
  scripts the leader's `team_delegate` ×2 + `team_report_progress` ×1
  + `team_archive_member` ×1 chain).
- Durable state verification: `DSH_HOME/storages/team_domain.json`
  ledger (`member-lifecycle-changed` facts) read by the kit's control
  server (`GET /state`, `POST /drive`).

## Kit self-consistency (guide §2)

The drive-done predicate matched the runtime's durable schema (ordered
subsequence `SETTLED → SETTLED → ARCHIVED` on one instance's lifecycle
facts, not the in-memory RUNNING state), the verdict gate is
`driveOk = !STATE.drive.sent || STATE.drive.done`, and `--selftest`
covers the verdict table (12/12 PASS at every final run —
record: `run-…17-45-17/selftest.log`). Proof in the wild: run 4 (home …16-57-49, aborted for the envelope bug, before its teardown) already wrote
`summary.json` `verdict: PASS, drive: {sent: true, done: true}` —
predicate and runtime schema agree.

## Scenarios & verdicts (final)

| ID | What is proven | Head | Result |
| --- | --- | --- | --- |
| 28-A | narrow width: every action button of a SETTLED row visible (wrap, no clip) | 14a6b25 | **PASS** — `28-A.png`; 4/4 buttons at 640px and 480px, `scrollWidth == clientWidth`, no horizontal overflow |
| 28-A′ | same row, **post-fix** default window: no clip, contained | 3acb7bc | **PASS** — `28-A-postfix-1044.png` + probe: row box == card box, 处置 fully visible (pre-fix: 18px clip — the user's original defect) |
| **28-A2** | **forced real action-button wrap: ≥1 button on line 2, 4/4 visible, contained, no hscroll, no overlap** | 3acb7bc | **PASS** — `28-A2-actions-wrapped.png` @ 360px emulated viewport, run 7; geometry probe: `wrapped=true` (button tops 408/433 → 2 lines), 4/4 fully inside the card (actions right 283 ≤ group right 293), `scrollWidth==clientWidth`, `contained=true`, no document hscroll, no overlap; Vision Toolkit 6/6 + zoomed pass (see `vision-review.md`) |
| 28-B | SETTLED 「恢复…」 → followup dialog, centered in the viewport | 14a6b25 | **PASS** — `28-B.png`; dialog center (522,521) == viewport center (522,520.5); Escape = cancel, no command |
| 28-C | 「发送消息…」 message modal renders | 14a6b25 | **PASS** — `28-C.png`; centered; input + textarea both `border-box`, inside the card |
| 28-D | 「归档」 confirm modal renders (closed WITHOUT confirming) | 14a6b25 | **PASS** — `28-D.png`; centered, 100% mask; 「取消」 → row stays SETTLED, no fact |
| 28-E | ARCHIVED 「恢复」 → NO modal, direct restore effect (row → SETTLED) | 14a6b25 + **re-verified 3acb7bc** | **PASS** — `28-E-pre.png`/`28-E.png`; 0 `[role=dialog]` after click; durable `restore-member` ARCHIVED→SETTLED, human caller. World 5 re-run at 3acb7bc: same direct-click semantics, fact seq 13 (`run-…17-45-17`) |

Restore-semantics distinction (kept accurate in the PR body): the
SETTLED row's 「恢复…」 opens the follow-up send-task Modal (28-B);
the ARCHIVED row's 「恢复」 is a direct restore with NO Modal (28-E).

## Gates (final, vs `0544dea` baseline — PR #27 merge head)

Product CSS changed in this round → the full §5 gate set applies:

| gate | result |
| --- | --- |
| `pnpm typecheck` | PASS — 9/9 packages |
| `pnpm build` | PASS |
| `pnpm build:composition` | PASS — client bundle regenerated with the fix (7× `box-sizing: border-box`, up from 5) |
| `pnpm check:artifacts` | PASS after source+bundle committed together (same-commit discipline) |
| `pnpm lint` | 53 problems (51e/2w) — **item-identical** to the `0544dea` baseline (file/line/rule-level diff: 0 new, 0 gone) |
| root `pnpm test` | 20 failed \| 3817 passed (3837), 10 files — failure set **item-identical** to the canonical `0544dea` failure set (0 new) |
| client `pnpm test` | 1 failed \| 648 passed (649) — the single failure is the pre-existing TCM-M4 timing flake, present identically on the `0544dea` baseline |
| p4t6 session-event scan | 10/10 (testkit) |
| p6t1-parallel | documented load-flake precedent (baseline runs flake too) |

Zero-core / zero-touch: `:3080` and `:3180` read-only probes pre==post
(401==401) in every run; test-use checkout byte-clean pre and post
every run; no core patch; no product redesign beyond the 2-line
border-box fix.

## Reproduce

```sh
# per PR branch (the branch must be committed + gates green first):
node dev/agent-workflow/evidence/ui-fix-round-20260921/live-browser/kit/live-ui-world.mjs \
  --branch fix/member-command-dialogs --worktree .worktrees/fix-member-command-dialogs
# → prints `READY origin=http://127.0.0.1:3181 token=… world=…`
# open the Agent Window at <origin>/?token=<token>, then POST
# http://127.0.0.1:3492/drive (scripts the member chain; ~2s to done),
# work the scenarios, then: touch <world>/SCENARIOS-DONE  (kit tears
# down + writes summary.json; exit code == verdict)
#
# 28-A2 (forced wrap): after the drive, click the ARCHIVED row's 恢复
# (direct restore → SETTLED 4-button row), then emulate a 360×800
# viewport and run the geometry probe (the exact probe used is in
# browser-run.md, §28-A2).
```

## Final verdicts

- PR #28 `fix/member-command-dialogs`: **MERGE-READY**
  — all gates at baseline (item-identical failure/lint sets vs
  `0544dea`), all six live-browser scenarios PASS, the forced real
  wrap (28-A2) exercised in real Chromium with the exact guide
  geometry probe + Vision Toolkit, and the wrap investigation's
  finding (row content-box overflow clipping the trailing button —
  the user's original defect) fixed minimally and re-verified at the
  final head.

No PR was merged in this round.
