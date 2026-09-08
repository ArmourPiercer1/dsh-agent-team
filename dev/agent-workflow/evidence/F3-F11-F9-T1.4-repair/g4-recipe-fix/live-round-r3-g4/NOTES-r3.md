# Round r3 — focused live G4 policy acceptance: notes

**Run**: 2026-09-08, 16:48–16:59 local (+08:00), by the delegated acceptance subagent.
**Mandate**: run the focused live G4 policy acceptance against the persistent world
`tests/mock/.dsh-home-repair-r1` on port 3181, using the isolated task branch
`task/repair-r1-g4-recipe-fix` @ `2285427` (worktree `.worktrees/repair-r1-g4`) — fresh
hard-tools boot, no fabricated state, credential secrecy + stable/upstream protections,
no push; evidence under `g4-recipe-fix/`.

## 1. Exact environment

| Item | Value |
|---|---|
| Repo / cwd | `D:\AgentDev\dsh-plugins\dsh-agent-team` (main checkout, `int/repair-r1` @ `9555aa0` = parent of the task commit; zero tracked modifications at start and end) |
| Task branch | `task/repair-r1-g4-recipe-fix` @ `2285427` (worktree `.worktrees\repair-r1-g4`) |
| Node | v24.20.0 (`C:\nvm4w\nodejs`) |
| playwright-cli | 0.1.19 (`C:\nvm4w\nodejs\node_modules\@playwright\cli\playwright-cli.js`), browser session `mocktest` |
| DSH home | `tests/mock/.dsh-home-repair-r1` (same configured DSH_HOME as the repair contract; persistent world — NOT recreated) |
| Ports | host 3181, facet mini 3491, host mini 3492 (all free pre-boot, all free post-kill) |
| test-use | `references/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`, porcelain empty pre and post (pristine) |
| Stable instance | `:3080` GET-probed only (→ 401 both times); zero operations; `D:\deepseek-harness\` untouched |

### Execution provenance (how "run as committed on that branch" was honored)

The task worktree lacks the gitignored runtime infrastructure (`references/` host tree,
the homes, `.playwright-cli/`, `node_modules`), so the round ran with **cwd = main
checkout**, sourcing each script from the location that matches the task branch:

- **From the task branch (worktree paths)** — the two files the commit modifies:
  - `tests/mock/scripts/f9-check.mjs` (all `pending` / `policy` invocations — the fixed filter),
  - `tests/mock/scripts/prompts/b6-req.md` (the delivered prompt — `toolName=write` + token `-2`).
- **From the main checkout** — byte-identical to the task branch per
  `git diff 9555aa0..2285427 -- tests/mock/scripts` (only `f9-check.mjs` and
  `prompts/b6-req.md` differ; see `02-ports-stable-testuse.txt`):
  `boot.mjs`, `common.mjs`, `preflight-check.mjs`, `wait-turn.mjs`, `ui-gate.mjs`,
  `gates/f9-g4-policy.json`.

The executed configuration is exactly the task-branch tree's runtime content.

## 2. Boot (P1)

`node tests/mock/scripts/boot.mjs` (background job `pwsh-127`), env:
`MOCK_DSH_HOME=tests/mock/.dsh-home-repair-r1`, `MOCK_ROOT_SESSION_ID=session-dtestmts69xkr6b54`,
`MOCK_BOOT_LABEL=repair-r3-g4`, `DSH_CLIENT_COMMIT_HASH=a66e470204`, `MOCK_HARD_TOOLS=1`.

- `profile tree already present`; `D1: workspace registry already present — no-op (existing home)`;
  directive `boot=2 phase=resume … hardTools=true`.
- `MOCKBOOT_READY` — host 3181, **keyConfigured=true** (model key read from
  `.credentials.yaml`, value never printed), blueprint `dtest-bp@1`.
- rows 4×true; client bundle served 200 (954,324 B — byte-size identical to r2);
  `toolCount=10`; `liveSessions=["session-dtestmts69xkr6b54",
  "session-team-child-a28fa0cc8bfcf80144c3a843c2d729ef",
  "session-team-child-f1898fca80a5114128eec10671624fd2"]` (team resumed; W1 child = the plan's expected id).
- Captures: `06-boot-r3.txt` (instance log, launch token redacted), `06-boot-state.json`
  (token redacted — stricter than r2's copy).

## 3. Per-asset results (exit codes)

| # | asset / invocation | result | exit |
|---|---|---|---|
| 01 | `f9-check.mjs selftest` (fixed, worktree copy) | 23 PASS, 0 FAIL | 0 |
| 02 | ports 3181/3491/3492 free; `:3080` GET → 401; test-use HEAD+porcelain; main tracked-clean; provenance diff | all green | 0 |
| 03 | pre-state `f9-check pending --json {"root":…,"toolName":"write"}` (worktree copy via run-asset) | 0 matches — discriminator empty pre-live (new no-match message verified) | 2 (expected) |
| 04 | pre-state `f9-check pending` legacy filter `{kind,target,action}` | 3 matches seq 5/6/14, chosen seq 5 (`toolName: null`) — legacy ambiguity re-demonstrated | 0 |
| — | boot (P1, above) | MOCKBOOT_READY, hardTools=true, keyConfigured=true | 0 |
| 07 | `preflight-check.mjs` (8 checks, correct `MOCK_DSH_HOME`) | 8 PASS, 0 WARN, 0 FAIL — CLEAR | 0 |
| 08 | `f9-check.mjs version-gate` (5 probes) | 5 PASS — v4 surface alive | 0 |
| 09 | `deliver-r2.mjs session-team-child-f1898fca… <worktree>/prompts/b6-req.md` | status=200 ok=true value={"accepted":true} (181 chars — the fixed prompt) | 0 |
| — | watchdog `wait-turn.mjs <W1 log> 240000` (armed BEFORE delivery, baseline turn=4) | turn/end turn=5, elapsed 20,438 ms | 0 |
| 10 | raw turn-5 tool calls (durable W1 session log) | `team_request_control` ×2 (steps 1–2, identical args incl. `toolName:"write"`, `requestToken dtest-v2-hard-req-2`) → idempotent collapse to ONE request | 0 |
| 11 | live `f9-check pending --json {"root":…,"toolName":"write","out":"tests/mock/state/f9-policy-pending.json"}` (worktree copy via run-asset) | **exactly 1 match — the NEW request seq 16 `ctrl-04ih1151nw6m9m0nagf8z10w`** (toolName=write, corr dtest-v2-hard-req-2); old pendings untouched | 0 |
| 12b-1 | `ui-gate.mjs f9-g4-policy.json` attempt 1 | INFRA FAIL (daemon dir, §4.2) — no page interaction, no mutation | 1 |
| 12b-2 | `ui-gate.mjs f9-g4-policy.json` attempt 2 | PAGE-STATE FAIL (collapsed 未分组, §4.3) — no click, no mutation | 1 |
| 12b-3 | `ui-gate.mjs f9-g4-policy.json` **VALID run** (after one manual group-expand) | **PASS 4/4** — Allow clicked; deny + `data-external-policy="true"` row with frozen §26.4 zh text, no plain Denied/拒绝; chips clean; bar gone; snapshot + screenshot | 0 |
| 12 | `f9-check policy --request-id ctrl-04ih1151nw6m9m0nagf8z10w` (worktree copy via run-asset) | **PASS** — durable deny + reason=external-policy + decider.kind=human + zero consumption | 0 |
| 13 | final ledger forensic scan | 17 facts; seq 16 → decision seq 17 deny/external-policy/human; pending now seq 5/6/14 (unchanged); 0 consumptions | 0 |
| 14 | postflight: ports free; `:3080` GET → 401; test-use HEAD+porcelain; main tracked-clean | all green | 0 |

## 4. Infra quirks encountered (none product, none recipe, none model)

1. **§4.1 per-process env (P2)**: each `pwsh` tool invocation is a fresh process — env vars
   do not persist between them. The first `preflight-check.mjs` run (no inline
   `MOCK_DSH_HOME`) read the default campaign home `tests/mock/.dsh-home` and reported 2 FAILs
   (`team_sessions[…]=absent`, `rootLog=false`). Rerun with the env set inline → 8 PASS.
   Recorded in `07-preflight-check.txt` (first-run lines kept, then the authoritative run).
   Discipline: every DSH_HOME-dependent script must set `MOCK_DSH_HOME` in the same invocation.
2. **§4.2 relative `PWTEST_DAEMON_SESSION_DIR` (ui-gate attempt 1)**: the playwright CLI uses
   the env value verbatim and resolves it against the CLI child's cwd. `ui-gate.mjs` chdirs to
   `tests/mock` and spawns with that cwd, so the recipe's relative value
   `tests/mock/.playwright-cli/daemon` resolved to the nested `tests/mock/tests/mock/.playwright-cli/daemon`
   → daemon registration failed (`Daemon pid=…` error; ui-gate truncates open-failure output to
   300 chars). r2's daemon state sits at the repo-root-relative location, consistent with
   daemon launches from repo-root cwd. **Fix**: pass the ABSOLUTE daemon dir
   (`D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.playwright-cli\daemon`). The stray
   nested dir (0-byte `.err` only) was removed in postflight. The committed `ui-gate.mjs` was
   NOT modified (no recipe changes beyond the task commit's 2 files).
3. **§4.3 collapsed sidebar group (ui-gate attempt 2)**: the fresh `mocktest` browser session
   showed the root session under the collapsed `未分组` tree group (the root is not bound to
   the `mock` workspace registry row — `workspace.json` binds an earlier session
   `session-dtestmts5d068d576` from a pre-r2 round; the D1 pre-seed is a no-op when the registry
   exists). r2 found the root because its round ran `smoke-g1` first — whose config carries
   `rootGroup: "未分组"` — on the same persistent browser; the focused r3 recipe starts at the
   G4 gate, whose committed config has no `rootGroup`. **Fix**: one manual raw-eval click on
   the collapsed group (navigation aid, no assertion, no product mutation), then the committed
   gate ran and passed unchanged. (Observed, out of scope: attempt 2's `clickEval` line
   printed `value="false"` (quoted) and the gate's `v === 'false'` falsy-token test didn't fire,
   so that line reported PASS while the gate still failed overall via the decision-row assert.
   Recorded for a possible future gate hardening — NOT part of this diff; the gate's §26.4
   asserts are frozen-correct and the overall verdict was unaffected.)

## 5. No fabricated state

Every new durable fact in this round is model-driven or committed-gate UI-driven:
- the seq-16 request: created by the W1 child's turn 5 (the one delivered `b6-req.md` prompt;
  raw tool calls in `10-w1-turn5-toolcall.txt`);
- the seq-17 decision: written by the committed `f9-g4-policy.json` gate's Allow click
  (human principal = root session, decider.kind=human).
No ledger/registry file was hand-edited; no request was created via API; no boot-state or
vars file was seeded (all were produced by the runs). Pre-state (03/04) and post-state (13)
scans bracket the round: pending set {5,6,14} → {5,6,14}; the only additions are seq 16/17.

## 6. Credential secrecy audit

- `.credentials.yaml` never read, printed, or copied; boot log line `model key loaded from
  .credentials.yaml (value never printed)` is the only key trace.
- `state/cookie-header.txt` not copied to evidence.
- `06-boot-state.json` copy: launch token redacted (`token=[redacted]`).
- `06-boot-r3.txt` (instance log): token redacted by capture regex.
- `state/ui-gate-f9-g4-policy-raw.txt`: ui-gate itself writes the URL redacted
  (`?token=[redacted]`) — verified on disk and in the evidence copy.
- Full-directory scan for the boot's token fragment: 0 hits (see run record).
- Screenshot `screenshots/f9-g4-policy.png`: page content only (no browser chrome/URL bar).

## 7. Residual world after the round (root `session-dtestmts69xkr6b54`)

- Ledger: 17 facts (was 15 pre-live). New: request seq 16 (toolName=write, corr
  `dtest-v2-hard-req-2`), decision seq 17 (**deny**, reason **external-policy**, decider
  **human** = root session).
- Still pending (unchanged, all toolName-less): seq 5 `ctrl-0eenv681ihtx7p002pwg20kt`
  (corr dtest-v2-req-la-2), seq 6 `ctrl-0ppmycw17v2axd0ws2xbi03q` (corr dtest-v2-req-self-1),
  seq 14 `ctrl-1eaer590x95ko00wdd0y71jw` (corr dtest-v2-hard-req-1 — the r2-era hard request,
  kept pending by the fix design; the new token `-2` is the canonical hard-tools request now).
- Consumptions: 0 (deny path — zero side effects, as frozen).
- W1 child session: turn count 5 (last = the b6-req turn); W2 unchanged.
- Mock host killed cleanly (job `pwsh-127`); ports 3181/3491/3492 free; playwright
  `mocktest` session closed (daemon + browser for this round retired); stray nested daemon
  dir removed.

## 8. Reproduce (focused re-run recipe, for the record)

```powershell
# cwd = repo root; every invocation sets its env inline (fresh pwsh processes!)
$env:MOCK_DSH_HOME='tests/mock/.dsh-home-repair-r1'
$env:MOCK_ROOT_SESSION_ID='session-dtestmts69xkr6b54'
$env:MOCK_BOOT_LABEL='repair-r3-g4'
$env:DSH_CLIENT_COMMIT_HASH='a66e470204'
$env:MOCK_HARD_TOOLS='1'
node tests/mock/scripts/boot.mjs                                  # background; until MOCKBOOT_READY
node tests/mock/scripts/preflight-check.mjs                       # 8 PASS
node tests/mock/scripts/f9-check.mjs version-gate                 # 5 PASS
# arm watchdog on the W1 child log (240 s), THEN deliver the task-branch prompt:
node tests/mock/scripts/wait-turn.mjs <W1 session.jsonl.zstd> 240000   # background
node <ev>\tools\deliver-r2.mjs session-team-child-f1898fca80a5114128eec10671624fd2 <worktree>\tests\mock\scripts\prompts\b6-req.md
# pending selection (task-branch f9-check; root passed explicitly — the worktree copy has no state/boot-state.json):
node <ev>\tools\run-asset.mjs <worktree>\tests\mock\scripts\f9-check.mjs pending --json @<ev>\args\pending-toolname-live.json
# G4 gate (ABSOLUTE daemon dir!):
$env:PWTEST_DAEMON_SESSION_DIR='D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.playwright-cli\daemon'
node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g4-policy.json    # expect PASS 4/4
node <ev>\tools\run-asset.mjs <worktree>\tests\mock\scripts\f9-check.mjs policy --request-id <new rid> --json @<ev>\args\policy-check.json
```

If a fresh browser session starts with `未分组` collapsed (no prior smoke-g1), expand it once
with the documented raw-eval click before the gate (§4.3).
