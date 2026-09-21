# ui-fix-round-20260921 — live-browser evidence, PR #27 (guide §9/§10)

Real-browser validation of the supplemental width fix on branch
`fix/team-tab-width-column` @ a45b088, per
`docs/plans/active/PR27_PR28_supplemental_fix_and_real_ui_validation.md`.
The installed `browser-skill` (browser_* tools, real Chromium Agent Window)
drove the real DSH Web UI; the DSH Vision Toolkit (`vision-glance` /
`vision-crop` bands) reviewed every screenshot. jsdom/RTL results are NOT
substituted for this evidence — the automated suites stay green as before,
but the merge verdict below is decided on the real page.

(The PR #28 scenarios have their own per-branch evidence package,
committed on branch `fix/member-command-dialogs` in this same directory.)

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
├── 27-A.png … 27-C.png  this branch's screenshots (its own head, its own run)
├── 27-A-default-window.png  first 27-A capture at the default 1044px Agent
│                        Window (axis min-clamp state, retained)
├── vision-review.md     per-scenario Vision Toolkit verdicts
└── browser-run.md       step-by-step browser session log
```

## Test instance (TEST_METHODS §7 — workspace-contained world)

- Checkout under test: `tests/deepseek-harness-test-use` @ `fb2c4b9e69`
  (pristine, verified pre and post each run; porcelain clean).
- DSH_HOME worlds: `tests/homes/liveui-<branch>-<stamp>` — removed at
  teardown (worlds hold launch tokens and are never committed; the
  committed instance logs are token-scrubbed copies).
- Ports (3180 family only): host `3181`, mock model `3491`, control `3492`.
  `:3080` (stable instance) and `:3180` (the current session GUI) were
  NEVER used — read-only reachability probes before/after each run
  (recorded in each `run-*/summary.json`, `preStable`/`postStable`,
  asserted equal by the kit).
- Install form: `dsh plugin --profile web add git+file:///<bare-clone>#<branch>`
  — the branch under test, installed by the real test-use CLI against a
  prebuilt install surface (zero lifecycle scripts), bundle layer
  auto-adding the `dsh-agent-team` row; the profile patch layer then
  overrides the host row's config (boot team `team-root`, inline
  blueprint, user preset `live-ui`, `staticModel` pin → the in-process
  mock model that scripts the leader's `team_delegate` ×2 +
  `team_archive_member` ×1 chain).
- Durable state verification: `DSH_HOME/storages/team_domain.json`
  ledger (`member-lifecycle-changed` facts) read by the kit's control
  server (`GET /state`, `POST /drive`).

## Reproduce

```sh
# per PR branch (the branch must be committed + gates green first):
node dev/agent-workflow/evidence/ui-fix-round-20260921/live-browser/kit/live-ui-world.mjs \
  --branch fix/team-tab-width-column --worktree .worktrees/fix-team-tab-width-column
# → prints `READY origin=http://127.0.0.1:3181 token=… world=…`
# open the Agent Window at <origin>/?token=<token>, work the scenarios,
# then: touch <world>/SCENARIOS-DONE  (kit tears down + writes summary.json)
```

## Scenarios & verdicts

| ID | PR | What is proven | Result |
| --- | --- | --- | --- |
| 27-A | #27 | default width: team tab section titles + cards follow the conversation content width | **PASS** — `27-A.png`; axis 920px cap → column 968px border-box, centered (VLM: balanced margins, one column, no clipping) |
| 27-B | #27 | narrow host width: same following behavior, no anchor-left regression | **PASS** — `27-B.png`; axis 680px min → column 728px border-box, no overflow (VLM: one consistent column) |
| 27-C | #27 | small viewport: no horizontal overflow of the team view | **PASS** — `27-C.png`; 640px viewport, column clamps to 574px container, `scrollWidth == clientWidth` (VLM: no clipping, no scrollbar) |

(Completed: verdict + screenshot + Vision Toolkit note per row in
`vision-review.md`.)

## Final verdicts

- PR #27 `fix/team-tab-width-column` @ a45b088: **MERGE-READY**
  — all automated gates green (typecheck / build / build:composition /
  check:artifacts / lint item-diff vs 904ca7a = 0 new / root suite
  20|3817 item-identical to baseline / client suite 645|646 with only the
  pre-existing TCM-M4 timing flake / p4t6 10/10) and all three
  live-browser scenarios PASS above.

No PR was merged in this round.
