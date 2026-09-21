# ui-fix-round-20260921 — live-browser evidence, PR #28 (guide §9/§10)

Real-browser validation of the supplemental member-command fixes on
branch `fix/member-command-dialogs` @ 14a6b25, per
`docs/plans/active/PR27_PR28_supplemental_fix_and_real_ui_validation.md`.
The installed `browser-skill` (browser_* tools, real Chromium Agent
Window) drove the real DSH Web UI; the DSH Vision Toolkit
(`vision-glance` / `vision-crop` bands) reviewed every screenshot.
jsdom/RTL results are NOT substituted for this evidence — the automated
suites stay green as before, but the merge verdict below is decided on
the real page.

(The PR #27 scenarios have their own per-branch evidence package,
committed on branch `fix/team-tab-width-column` in this same directory.)

## Layout

```
live-browser/
├── README.md            this file (verdicts + how-to-reproduce)
├── kit/
│   └── live-ui-world.mjs  the world kit (preflight → world → git install →
│                          config override + mock → boot → session → control
│                          server → drive → teardown), one run per PR branch
├── run-*/               this branch's kit evidence: kit.log, summary.json,
│                        instance.log (token-scrubbed copies), setup.log
│                        (…aborted-missing-teamEnvelope = the aborted first
│                        run, retained as the record of the kit bug)
├── 28-A.png … 28-E.png  this branch's screenshots (its own head, its own run)
├── 28-E-pre.png         the ARCHIVED row before the direct 「恢复」 click
├── vision-review.md     per-scenario Vision Toolkit verdicts
└── browser-run.md       step-by-step browser session log
```

## Test instance (TEST_METHODS §7 — workspace-contained world)

- Checkout under test: `tests/deepseek-harness-test-use` @ `fb2c4b9e69`
  (pristine, verified pre and post each run; porcelain clean).
- DSH_HOME worlds: `tests/homes/liveui-<branch>-<stamp>` — removed at
  teardown (worlds hold launch tokens and are never committed; the
  committed instance logs are token-scrubbed copies).
- Ports (3180 family only): host `3181`, mock model `3491`, control
  `3492`. `:3080` (stable instance) and `:3180` (the current session
  GUI) were NEVER used — read-only reachability probes before/after
  each run (recorded in each `run-*/summary.json`, `preStable`/
  `postStable`, asserted equal by the kit).
- Install form: `dsh plugin --profile web add git+file:///<bare-clone>#<branch>`
  — the branch under test, installed by the real test-use CLI against a
  prebuilt install surface (zero lifecycle scripts), bundle layer
  auto-adding the `dsh-agent-team` row; the profile patch layer then
  overrides the host row's config (boot team `team-root`, inline
  blueprint with a full mutation `teamEnvelope` — the first aborted run
  proved the runtime fails closed without it — user preset `live-ui`,
  `staticModel` pin → the in-process mock model that scripts the
  leader's `team_delegate` ×2 + `team_archive_member` ×1 chain).
- Durable state verification: `DSH_HOME/storages/team_domain.json`
  ledger (`member-lifecycle-changed` facts) read by the kit's control
  server (`GET /state`, `POST /drive`).

## Reproduce

```sh
# per PR branch (the branch must be committed + gates green first):
node dev/agent-workflow/evidence/ui-fix-round-20260921/live-browser/kit/live-ui-world.mjs \
  --branch fix/member-command-dialogs --worktree .worktrees/fix-member-command-dialogs
# → prints `READY origin=http://127.0.0.1:3181 token=… world=…`
# open the Agent Window at <origin>/?token=<token>, then POST
# http://127.0.0.1:3492/drive (scripts the member chain), work the
# scenarios, then: touch <world>/SCENARIOS-DONE  (kit tears down +
# writes summary.json)
```

## Scenarios & verdicts

| ID | PR | What is proven | Result |
| --- | --- | --- | --- |
| 28-A | #28 | narrow width: every action button of a SETTLED row visible (wrap, no clip) | **PASS** — `28-A.png`; 4/4 buttons at 640px and 480px, `scrollWidth == clientWidth`, no horizontal overflow (VLM: no clipping, no scrollbar) |
| 28-B | #28 | SETTLED 「恢复…」 → followup dialog, centered in the viewport | **PASS** — `28-B.png`; 「向 worker-a 发送任务」 dialog center (522,521) == viewport center (522,520.5); Escape = cancel, no command |
| 28-C | #28 | 「发送消息…」 message modal renders | **PASS** — `28-C.png`; 「给 worker-a 发消息」 centered; input + textarea both `border-box`, inside the card |
| 28-D | #28 | 「归档」 confirm modal renders (closed WITHOUT confirming) | **PASS** — `28-D.png`; 「归档该成员？」 centered, 100% mask; 「取消」 → row stays SETTLED, no fact |
| 28-E | #28 | ARCHIVED 「恢复」 → NO modal, direct restore effect (row → SETTLED) | **PASS** — `28-E-pre.png`/`28-E.png`; 0 `[role=dialog]` after click; durable fact `restore-member` ARCHIVED→SETTLED, human caller |

(Completed: verdict + screenshot + Vision Toolkit note per row in
`vision-review.md`.)

## Final verdicts

- PR #28 `fix/member-command-dialogs` @ 14a6b25: **MERGE-READY**
  — all automated gates green (typecheck / build / build:composition /
  check:artifacts / lint item-diff vs 904ca7a = 0 new / root suite
  20|3817 item-identical to baseline / client suite 646|647 with only
  the pre-existing TCM-M4 timing flake / p4t6 10/10) and all five
  live-browser scenarios PASS above (the existing
  ARCHIVED-「恢复」-direct-click spec test stays green inside the client
  suite).

No PR was merged in this round.
