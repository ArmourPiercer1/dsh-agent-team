# REPORT — playwright-workflow round (F3-F11-F9-T1.4-repair)

Role: deterministic Playwright executor (delegated subagent).
Date: 2026-09-08 (UTC+08:00), runs 12:58–13:15 local.
Scope: run the existing preflight / f9-check / persistent ui-gate assets
against the dedicated repair-r1 world; record exact blockers; no product-code
edits, no push.

## 0. Environment

| item | value |
| --- | --- |
| Node executable (from PATH) | `C:\nvm4w\nodejs\node.exe` (v24.20.0) |
| DSH_HOME (dedicated, as tasked) | `tests/mock/.dsh-home-repair-r1` |
| port | 3181 (MCP facet 3491 / host 3492) — never touched :3080 or `D:\deepseek-harness\` |
| host tree | `references/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d` (pristine) |
| boot | `MOCK_DSH_HOME=…repair-r1 MOCK_ROOT_SESSION_ID=session-dtestmts69xkr6b54 MOCK_BOOT_LABEL=repair-r1-pw2 DSH_CLIENT_COMMIT_HASH=a66e470204 node tests/mock/scripts/boot.mjs` (background job, file-fd stdio launch) |
| boot result | `MOCKBOOT_READY` 05:00:43Z; rows mounted dsh-agent-team + client + p6t6 + dtest-mcp-http; client bundle served 200 (954,324 B); row ready toolCount=10 liveSessions=[session-dtestmts69xkr6b54]; **keyConfigured=false** |
| Playwright CLI | `C:\nvm4w\nodejs\node_modules\@playwright\cli\playwright-cli.js` — v0.1.19 (`--version` exit 0) |
| Model credentials | **ABSENT** — `tests/mock/.dsh-home-repair-r1/.credentials.yaml` has no `QIYUAN_SELF_API_KEY` ref (value never printed/needed) |

Durable world state of the repair-r1 home (pre-boot scan, read-only):
`team_sessions`=2 (both gen=2, bp dtest-bp@1); `member_instances`=2 (ONLY
inst-leader per root — **no W1/W2 members**); `ledger`=**0 rows** (no
control-request-recorded / control-decision-recorded / control-allow-consumed
facts); workspace row sessionIds=[session-dtestmts5d068d576] only.
Interpretation: this home never ran a model turn (no key), so no member was
ever created and no control request ever existed.

## 1. Exact exit codes (each command as-is, unmodified assets)

| # | command (run from repo root unless noted) | exit | result |
| --- | --- | --- | --- |
| 1 | `node tests/mock/scripts/f9-check.mjs selftest` | **0** | 23 PASS / 0 FAIL (offline, `f9-selftest.txt`) |
| 2 | boot (see §0) | **0** (MOCKBOOT_READY, keep-alive job) | host healthy; stopped after run (ports freed, §4) |
| 3 | `node tests/mock/scripts/preflight-check.mjs` (env MOCK_DSH_HOME=…repair-r1) | **0** | 8 PASS / 0 WARN / 0 FAIL — cookie-auth 200, row-health toolCount=10 rootLive=true, blueprint-binding match (sha256:e1b1df8f…), envelope-intersection team(8)∩member(worker,collector) contain request-control/resolve-control, workspace-registry initialized=true (rootBound=false, pre-existing), mcp-endpoints 3491+3492 open, team-binding gen=2 rootLog=true, team-remote-seam getProjection gen=2 (`preflight.txt`) |
| 4 | `node tests/mock/scripts/f9-check.mjs version-gate` (same env) | **0** | 5 PASS / 0 FAIL — v1/v2/v3 → `method-version-unsupported` (echo+reason+field exact), v4 → `CONTROL_REQUEST_NOT_FOUND` (gate passed, control port reached), v4 spoofed `caller` → `malformed-params`/`unknown-field` before any derivation (`f9-version-gate.txt`). Zero world mutation (typed-rejection probes only) |
| 5 | `node tests/mock/scripts/f9-check.mjs pending` (same env; no filter → matches any pending) | **2** | exact output: `[f9-check] no pending control request matches the filter ({}) — deliver the request prompt (b4-requests.md / t41-deny-req.md) first, then re-run`; `state/f9-pending.json` NOT written (`f9-pending.txt`). Root cause: 0 control facts in the durable domain (§0) |
| 6 | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/smoke-g1.json` | **2** | exact output: `[ui-gate] playwright-cli failed to run:` (empty stderr — the `spawnSync(node, [cliJs, '--version'])` piped-stdio call failed EPERM; `r.status=null`, stderr uncaptured by design) (`ui-gate-smoke-g1.json`) |
| 7 | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g3-pending.json` | **2** | exact output: `[ui-gate] varsFile missing: state/f9-pending.json (run the producing script first — f9-check.mjs pending)` (fails at varsFile precheck, before any browser work) (`ui-gate-f9-g3-pending.json`) |
| 8 | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g3-allow.json` | **2** | same varsFile-missing blocker for `state/f9-pending.json` (`ui-gate-f9-g3-allow.json`) |
| 9 | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g3-deny.json` | **2** | exact output: `[ui-gate] varsFile missing: state/f9-deny-pending.json …` (`ui-gate-f9-g3-deny.json`) |
| 10 | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g4-policy.json` | **2** | exact output: `[ui-gate] varsFile missing: state/f9-policy-pending.json …` (`ui-gate-f9-g4-policy.json`) |

Supplementary (not part of the persistent gate set):
- Sandbox probes: node piped-stdio spawn → `EPERM` (status=null); playwright
  CLI `--version` via pwsh-level spawn → `0.1.19`, exit 0
  (`probe-sandbox-and-cli.txt`).
- Manual CLI drives to localize the browser blocker (goto/open with default
  and redirected daemon dirs): all exit 1 with exact EPERM stack traces;
  root cause chain (harness piped spawn → CLI daemon hard-coded piped spawn →
  `\\.\pipe\pw-*` named-pipe IPC) in `manual-playwright-probe.txt`.

## 2. Blockers (exact, non-fabricated)

**B1 — Model credentials unavailable (world-state blocker for G3/G4).**
`.dsh-home-repair-r1/.credentials.yaml` present but no `QIYUAN_SELF_API_KEY`
ref → boot log `WARN: .credentials.yaml present but no QIYUAN_SELF_API_KEY
ref`, boot-state `keyConfigured:false`. Consequence: no model turn can run →
no member can be created (W1/W2 absent) and **no `user-approval` control
request can be issued** (control requests are created only by a member calling
`request-control` inside a model turn; `team.resolveControl` is the only v4
remote method and is a resolver, not a creator). The durable domain confirms
0 control facts. Therefore `f9-check pending` exits 2 and none of the four F9
ui-gate configs has a target requestId (their varsFiles cannot be produced).
Fix: configure the key in the repair-r1 home (user action; value must never
be printed), then deliver `b4-requests.md` (G3) / a `t41-deny-req.md` request
(G3 deny) / boot#2 `MOCK_HARD_TOOLS=1` + request (G4) and re-run the §4 recipe
of `tests/mock/evidence/F9-PLAYWRIGHT-ASSETS.md`.

**B2 — Sandbox: node piped-stdio child spawn EPERM (ui-gate.mjs harness blocker).**
This session runs workspace-write with approval prompts disabled. Any node
process spawned here cannot spawn a piped-stdio child (probe: `spawnSync(node
['--version'])` → `status=null err=EPERM`). `ui-gate.mjs` invokes
playwright-cli via `spawnSync(process.execPath, [cliJs, …])` with encoded
(piped) stdio → every invocation exits 2 at the CLI precheck (row 6 above;
identical signature to playwright-r1 `ui-smoke.txt`). This is the same
boundary TEST_METHODS.md §5 documents for the main-agent sandbox; the r1
round hit it identically.

**B3 — Sandbox: playwright-cli cannot start a browser session (independent of B2).**
Even driving the CLI directly from pwsh (a spawn level this sandbox allows):
(a) default daemon dir `%LOCALAPPDATA%\ms-playwright\daemon\…` is outside the
workspace → EPERM opening `mocktest.err`; (b) with
`PWTEST_DAEMON_SESSION_DIR` redirected into the workspace, the daemon spawn
itself fails — `spawn EPERM` at `Session.startDaemon` (session.js:151,
hard-coded `stdio: ["ignore","pipe",err]` in the global CLI package, not
editable from this workspace); (c) client↔daemon IPC uses named pipes
(`\\.\pipe\pw-*`, coreBundle.js:L8397), which this sandbox boundary forbids
opening. Net: **no browser can be launched from any process in this session**,
hence no live UI observation is possible here (and none was fabricated).
The CLI itself is installed and healthy (v0.1.19); chromium binaries present.

## 3. Verdict — live G3 / G4 closure

**Live G3: NOT closed. Live G4: NOT closed.**

- What IS live-verified this round (wire/contract level, zero model turns):
  v3/v4 served-version gating + closed-param enforcement + control-port
  reachability (`f9-check version-gate`, 5/5 PASS, exit 0) and the full G0
  contract preflight (8/8 PASS, exit 0) on the repair-r1 host.
- What is NOT verifiable here: any UI rendering (B3) and any
  pending→decide→consume sequence (B1). The G3 pending/allow/deny and G4
  policy gates each need a real control request that only a model turn can
  produce; the durable domain contains none, and none can be created without
  the key.
- No UI or model result in this evidence pack is a live browser/model
  observation; all live evidence is host-side contract checks + durable scans.

## 4. Cleanup & compliance

- Host stopped after the run (managed job kill); ports 3181/3491/3492
  verified **closed** (open=False) at 13:12Z. `:3080` was only TCP-probed for
  port-state accounting at the start (a bare connect, no HTTP request sent);
  no request, launch, or file op touched the stable instance or
  `D:\deepseek-harness\`.
- `references/deepseek-harness-test-use` **porcelain-clean** both before
  (empty `git status --porcelain`, exit 0) and after the boot (empty, exit 0);
  HEAD unchanged at `a66e4702047846cdaa10c66c9d3df3951f5ea70d`.
- No product code edited (`packages/*` untouched); no push performed.
- My footprint: this evidence directory (new) + gitignored/boot-design runtime
  artifacts under `tests/mock/state/`, `tests/mock/hosts/repair-r1-pw2/`,
  `tests/mock/.dsh-home-repair-r1/` (patch layer, directive, session log,
  storage). Probe artifact `tests/mock/.playwright-daemon` removed.
  Pre-existing worktree dirt NOT caused by this round (left as-is):
  `tests/mock/hosts/boot1/*` (modified by the earlier repair-r1-home first
  boot), untracked `tests/mock/.dsh-home-repair-r1/` (not covered by
  `tests/mock/.gitignore` — only `.dsh-home/` and `.dsh-home-smoke/` are),
  root `.playwright-cli/`, `playwright-r1/` evidence and other untracked
  evidence/docs from earlier rounds.
- Root durable session log ends at a clean `session/end-seed` boundary (seq 3);
  next boot with `MOCK_ROOT_SESSION_ID=session-dtestmts69xkr6b54` starts from
  the same state this boot did (which booted cleanly). If a future
  kill-while-live leaves the session open, the proven D6 recipe applies
  (restart#1 may live-collide → failing process retires + writes end-seed →
  `wait-end-seed.mjs` → restart#2; NOTES-V2 T0.2b/D6).
- API key value was never printed or copied; no credentials landed in evidence.

## 5. Evidence files (this directory)

| file | content |
| --- | --- |
| `f9-selftest.txt` | run #1 output (23 PASS, exit 0) |
| `preflight.txt` | run #3 output (8 PASS, exit 0) |
| `f9-version-gate.txt` | run #4 output (5 PASS, exit 0) |
| `f9-pending.txt` | run #5 output (exit 2, exact blocker) |
| `ui-gate-smoke-g1.json` | run #6 output (exit 2, exact blocker) |
| `ui-gate-f9-g3-pending.json` | run #7 output (exit 2, exact blocker) |
| `ui-gate-f9-g3-allow.json` | run #8 output (exit 2, exact blocker) |
| `ui-gate-f9-g3-deny.json` | run #9 output (exit 2, exact blocker) |
| `ui-gate-f9-g4-policy.json` | run #10 output (exit 2, exact blocker) |
| `probe-sandbox-and-cli.txt` | sandbox + CLI + credentials + world-state probes |
| `manual-playwright-probe.txt` | manual CLI drives, exact EPERM traces, named-pipe code evidence |
| `REPORT.md` | this report |
