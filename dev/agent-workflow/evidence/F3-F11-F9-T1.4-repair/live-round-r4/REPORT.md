# Round r4 — Complete live V2 acceptance matrix (F3 / F11 / F9 / T1.4): AUTHORITATIVE CONSOLIDATION REPORT

**Status**: authoritative consolidation of the complete live V2 matrix round (the earlier consolidator
run was cancelled; this report supersedes its draft and was independently re-verified against every
on-disk evidence file in this directory).
**Run**: 2026-09-08, 17:17:52–17:49:17 local (+08:00) (evidence file timestamps); round window
17:19–17:58 per `NOTES-r4.md`.
**Runner**: delegated live-acceptance subagent (model `qwen3.8-27b`); this consolidation performed by
a separate consolidation pass, read-only w.r.t. product state.
**Mandate constraints honored**: matrix NOT rerun; no host started by the consolidation; :3080 and
`D:\deepseek-harness` untouched (round itself: GET-probes only); upstream, active plans, graph and
router log unmodified; no push; no commit made by this round.

Evidence root (this directory): `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/live-round-r4/`
(numbered outputs `00`–`42b`, `NOTES-r4.md`, `state/`, `snapshots/`, `screenshots/`, `args/`,
`prompts/`, `tools/`).

---

## 1. Matrix rows and verdicts

| V2 row | Asset(s) (file numbers) | Verdict | Exit |
|---|---|---|---|
| **R-F3** — root/member model-turn setup + G1 UI smoke | 05a, 06, 07 | **PASS** — fresh team A created by model turns; G1 smoke 3/3 finds + snapshot | 0 |
| **R-F9 G3 (allow half)** — pending → UI pending → UI allow → decided → consumed | 08a, 09/09b, 10, 10b, 11, 12, 13, 14a–14d, 15 | **PASS except consumed** — pending exactly 1; UI pending 4/4; UI allow 4/4; decided-allow PASS; exec write verbatim; **consumed FAIL: expected 1 `control-allow-consumed` fact, got 0** | 15 = **1** (documented expected FAIL — the only non-zero exit in the matrix; §5.2, §9.3) |
| **R-F9 G3 (deny half)** — deny-req → pending → UI deny → decided → consumed(expectAbsent) | 17a, 17b, 18, 19, 20, 21 + negative probe check | **PASS** — all green; denied probe `v2-probe-2.txt` verified absent at both candidate paths | 0 |
| **R-F9 G4** (corrected recipe, `toolName:"write"`) | 33, 34a, 34b, 35, 36, 36b, 37 | **PASS** — pre-state 0 matches (exit 2 sentinel); verbatim `toolName:"write"` request; live pending{toolName} exactly 1; UI §26.4 frozen row 4/4; policy fact PASS | 0 (36 = 1, see §9.1) |
| **R-T14 (T1.4)** — UI team creation with `dtest-bp@1` | 22 (snapshot/screenshot, no numbered log), 23 | **PASS** — `data-intent-status=OPEN` (T14-H fix holds: no BLOCKED_FATAL on the mcp requirement); create succeeded; durable `team_sessions` row verified | 0 |
| **R-F11** — API half (suite-ledger-complete A + B) + UI half (team B ≥50 facts, durable head/tail) | 29, 38a, 38b, 39a, 39b, 39c | **PASS** — team A 15=15 (1 page); team B **61 facts ≥ 50** (2 pages, 61=61); UI rendered all 61 rows, no `data-ledger-remaining`, no `data-ledger-load-earlier`, first/last row = durable head/tail | 0 (39b = 1, see §9.2) |

**Overall: 5 of 6 rows PASS; the 6th (G3-consumed allow half) is the single pre-declared, documented
expected FAIL — the F10-class asset-expectation boundary preserved per repair-plan item 4 (preserve +
document; product semantics intentionally unchanged). No new product defects. The r2 G4 recipe defect
is confirmed fixed by the task-branch 2-file change and live-verified this round on a fresh root.**

---

## 2. Exact environment (verified against disk)

| Item | Value | Evidence |
|---|---|---|
| Repo / cwd | `D:\AgentDev\dsh-plugins\dsh-agent-team` | 00 |
| Main checkout | `int/repair-r1` @ `c0f91508ae331926d9520085463f483757f806c0`, **zero tracked modifications at start and end** | 00; 41; re-verified at consolidation |
| Task branch | `task/repair-r1-g4-recipe-fix` @ `f1b1addbdedf34283223b1440d49beb748385c2a`, worktree `.worktrees\repair-r1-g4` (clean); `git diff c0f9150..f1b1add -- tests/mock/scripts` = exactly `tests/mock/scripts/f9-check.mjs` + `tests/mock/scripts/prompts/b6-req.md` | 00; re-verified at consolidation |
| **DSH_HOME (mock world)** | `D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.dsh-home-repair-r1` — **persistent world, NOT recreated** (r2/r3 lineage) | 01 boot console; 30 |
| Model route | home `settings.yaml` → `agent-default-model: {model: qwen3.8-27b}` under provider `qiyuan-self`, key via `apiKeyEnv` reference (env-var name only, value never read); boot state `keyConfigured=true` both boots | settings lines (model line only); `state/01-boot-state-b1-redacted.json`, `state/30-boot-state-b2-redacted.json` |
| Node | v24.20.0 (`C:\nvm4w\nodejs`) | 00 |
| playwright-cli | 0.1.19 (`C:\nvm4w\nodejs\node_modules\@playwright\cli\playwright-cli.js`), session `mocktest`, absolute `PWTEST_DAEMON_SESSION_DIR=D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.playwright-cli\daemon` | 00 (0 daemons pre-boot); every gate log |
| Ports | host **3181**, facet mini-MCP **3491** (`dtest-mini`), host mini-MCP **3492** (`dtesthttp`) — all free pre-boot and post-kill | 00; 41 |
| test-use (pristine upstream) | `references/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d` (0.1.2-rc.1, shown in sidebar as `0.1.2-rc.1-a66e470`), **porcelain empty pre and post** | 00; 41; re-verified at consolidation |
| Stable instance | `:3080` GET-probed only → **401** both times (auth gate); zero interactions; `D:\deepseek-harness` untouched | 00; 41 |
| Client bundle (on disk) | `packages/client/composition-shim/client-bundle.js` = **959,026 B**, LastWriteTime 2026-09-08 14:09:15 (pre-round F9U build) | 00 (bytes); re-verified at consolidation |
| Client bundle (served) | live fetch of the exact plugin-row URL = **959,121 B**; copy at `state/served-client-bundle-r4.bin`; **on-disk file is an exact byte-prefix of the served bytes; +95 B wrapper** = `;` + `//# sourceMappingURL=/plugins/??@dsh-agent-team/client/client.js.map&rev=983a2abfd4fbdc4a-45` (plugin module pipeline) | NOTES §1/§6.6; re-verified byte-by-byte at consolidation |
| Fix markers in bundle | all present — `data-external-policy` ×4, `externalPolicy.teamDecision` ×3, `被托管策略阻止` ×1, `data-ledger-fact` ×1, `data-intent-create` ×3, `data-new-team-entry` ×1, `data-intent-compatibility` ×1, `CONTROL_EXTERNAL_POLICY_DENIED` ×1, `data-ledger-load-earlier` ×1, `data-ledger-remaining` ×1 | re-verified at consolidation |

> The boot-log line `client bundle serve … bytes=954324` (01/30) is a transient boot-time measurement;
> the live fetch (959,121 B) is authoritative (NOTES §6.6). No content drift.

### 2.1 Credential presence (booleans only — no secret ever read, printed, or copied)

| Check | Boolean |
|---|---|
| `tests/mock/.dsh-home-repair-r1/.credentials.yaml` exists | **true** (never read/printed/copied; boot loads key via env-var ref, "value never printed" per 01/30 boot console) |
| `tests/mock/.dsh-home-repair-r1/settings.yaml` exists | **true** (model lines inspected; contains only the `apiKeyEnv` reference name, no secret) |
| Both boot launch tokens redacted in all evidence copies | **true** (`token=[redacted]` in 01/30 consoles and all ui-gate logs; D2 "cookie persisted … (value never printed)") |
| `state/cookie-header.txt` (mock-home state) copied into evidence | **false** — never copied |
| Post-round credential scan over **86 evidence files**: boot-token#1 hits / boot-token#2 hits / key-pattern hits / cookie-header copies | **0 / 0 / 0 / 0** (`41-credential-scan.txt`) |

---

## 3. The round's key adaptation — FRESH root inside the same persistent home

**Decisive world-state fact**: `requestControl` (`packages/runtime/control/service.ts`, section at
L685, `scopeKey` helper L404, applied L756/765) is idempotent on the scopeKey
`(root, targetInstanceId, actionName, toolName, correlation)` and returns the EXISTING row (decided or
pending) and returns the EXISTING row (decided or pending). The persistent home's r2/r3 team (root
`session-dtestmts69xkr6b54`, `02-prestate-legacy-team.txt`, 17 facts) already contains every committed
F9 correlation token — decided: ua-1 (allow, seq 7), ua-2 (deny, seq 13), la-1 (allow, seq 15),
hard-req-2 (deny/external-policy, seq 17); pending: la-2 (seq 5), self-1 (seq 6), hard-req-1
(seq 14) — so `dtest-v2-req-ua-1/2`, `dtest-v2-req-la-1/2`, `dtest-v2-req-self-1`,
`dtest-v2-hard-req-1/2` all resolve to existing rows there ⇒ every committed G3/G4 recipe would
return an existing row — the G3/G4 rows are structurally un-runnable on the old root (no NEW pending
request can be created).

**Decision**: boot#1 ran WITHOUT `MOCK_ROOT_SESSION_ID` ⇒ fresh root
`session-dtestmtsgjlo4a725` (new **team A**) inside the same persistent home (boot directive
`boot=1 phase=create root=session-dtestmtsgjlo4a725 hardTools=false`, 01 line 7). This matches the V2
fresh-world precondition, requires **zero committed-asset modification**, and keeps every durable
bracket (pre/post state) inside one home. The fresh root is not in `workspace.json` (only
`session-dtestmts5d068d576` is bound) ⇒ it appears under the collapsed `未分组` sidebar group; the r4
sidebar inspections prove `pickRef` resolves the committed `rootText` `请初始化团队` to the fresh root
(first DOM match = most-recent activity) — `snapshots/sidebar-inspect-r4.yml` (collapsed) and
`snapshots/sidebar-ungrouped-r4.yml` (expanded DOM order = [fresh root 1分钟, W1-legacy child 33分钟,
legacy root 1小时]). No home-state surgery was needed. Full rationale: `NOTES-r4.md` §2/§6.3.

---

## 4. Boot sequence (managed background jobs)

| boot | label | directive (boot console) | ready | key facts |
|---|---|---|---|---|
| #1 | `repair-r4-b1` | `boot=1 phase=create root=session-dtestmtsgjlo4a725 hardTools=false` | 2026-09-08T09:19:05.518Z | `MOCKBOOT_READY … (keyConfigured=true)`; rows mounted `{"dsh-agent-team":true,"dsh-agent-team-client":true,"p6t6-team-tools":true,"dtest-mcp-http":true}`; `toolCount=10`; `liveSessions=["session-dtestmtsgjlo4a725"]` |
| #2 | `repair-r4-b2` | `boot=2 phase=resume root=session-dtestmtsgjlo4a725 hardTools=true` | 2026-09-08T09:39:33.914Z | `MOCKBOOT_READY … (keyConfigured=true)`; `liveSessions` = team-A root + W1 child (`session-team-child-b50874…`) + W2 child (`session-team-child-d82573…`) |

- Env per boot: `MOCK_DSH_HOME` (absolute), `DSH_CLIENT_COMMIT_HASH=a66e470204`; boot#2 adds
  `MOCK_ROOT_SESSION_ID=session-dtestmtsgjlo4a725`, `MOCK_HARD_TOOLS=1`.
- Raw instance logs: `tests/mock/hosts/repair-r4-b1/instance-port3181.log`,
  `tests/mock/hosts/repair-r4-b2/instance-port3181.log` (exist on disk; redacted copies
  `01-boot-b1-console-redacted.txt`, `state/01-boot-state-b1-redacted.json`,
  `30-boot-b2-console-redacted.txt`, `state/30-boot-state-b2-redacted.json`).
- Both boots idle-killed via the managed background job (first-try, NOTES §3, observation R-B7 clean);
  post-kill verification in `41-postflight-ports-stable-testuse-tree.txt` (ports free, 0 residual
  processes).

---

## 5. Matrix rows — exact commands and exit codes

All invocations ran from the repo root in fresh pwsh processes with per-invocation inline env
(`MOCK_DSH_HOME` where required; `run-asset.mjs` was used for `--json` args to avoid shell-quoting
mangling — `tools/run-asset.mjs`). `node` = v24.20.0.

### 5.0 Pre-matrix gates (boot#1)

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 00 | `00-env-baseline.txt` | env-baseline pwsh (port listens, `GET :3080`, git rev/status both checkouts, bundle bytes, playwright process count) | all green; `:3080→401`; 0 daemons | 0 |
| 02 | `02-preflight-b1.txt` | `node tests/mock/scripts/preflight-check.mjs` | **8 PASS, 0 WARN, 0 FAIL — CLEAR** (cookie-auth 200/24395 B; row-health ok toolCount=10 rootLive; blueprint `dtest-bp@1` sha match; envelope intersection; workspace `mockRow=sessions=1`; mcp 3491/3492 up; team-binding gen=2; team-remote projection) | 0 |
| 03 | `03-selftest.txt` | `node tests/mock/scripts/f9-check.mjs selftest` | **23 PASS, 0 FAIL** | 0 |
| 04 | `04-version-gate-b1.txt` | `node tests/mock/scripts/f9-check.mjs version-gate` | **5 PASS** — v1–v3 → `method-version-unsupported`; v4 accepted (reaches control port: `CONTROL_REQUEST_NOT_FOUND`); v4 + spoofed caller field → `malformed-params unknown-field` (spoof closed before any derivation/port work) | 0 |
| 05a | `05a-deliver-root-init.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-dtestmtsgjlo4a725 <ev-r2>\prompts\r2-root-init.md` (public session-API prompt delivery; watchdog armed on root log first) | accepted `{"accepted":true}`; watchdog OK **turn=1, 34,158 ms**; W1+W2 created | 0 |
| 06 | `06-forensics-teamA-setup.txt` | `node <ev-r4>\tools\forensics-r2.mjs session-dtestmtsgjlo4a725` | W1 `inst-1j499i010e86` (worker, child `…b50874…`), W2 `inst-042zjep11mrw` (collector, child `…d82573…`), both CREATED; team gen=4; facts seq 18–19 (`provision-member-instance`) | 0 |

### 5.1 R-F3 — G1 UI smoke

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 07 | `07-ui-gate-smoke-g1.txt` | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/smoke-g1.json` (session mocktest) | **PASS** — goto (redacted token); click rootGroup `未分组`; click root `请初始化团队`; team tab `团队`; finds `W1` present, `W2` present, `时间线` present; snapshot + screenshot code=0. Snapshot verified on the FRESH team: rows `成员创建 W1`/`W2` with `inst-1j499i010e86`/`inst-042zjep11mrw` under root `session-dtestmtsgjlo4a725`; legacy inst ids absent | 0 |

### 5.2 R-F9 G3 — allow half

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 08a | `08a-deliver-b4-requests.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-team-child-b50874… tests/mock/scripts/prompts/b4-requests.md` (W1-A child) | accepted; watchdog OK **turn=1, 68,750 ms** | 0 |
| 09/09b | `09-w1-turn1-toolcalls.txt`, `09b-w1-turn1-call-raw.txt` | turn-log extraction (read-only) | 4× `team_request_control` **verbatim**: `dtest-v2-req-ua-1` (user-approval), `dtest-v2-req-la-1`, `dtest-v2-req-la-2`, `dtest-v2-req-self-1` (leader-approval), all `actionName:"write"`, target `inst-1j499i010e86`, root `session-dtestmtsgjlo4a725`; plus one `team_resolve_control` self-resolve attempt (token `dtest-v2-req-self-resolve-1`, `requestId ctrl-1k5t7y61ezoedj1oofk4006e`) | 0 |
| 10b | `10b-self-resolve-rejected.txt` | (same turn-log, resolver result) | **rejected** `CONTROL_RESOLVER_NOT_AUTHORIZED` — "role 'member' is not a resolver for kind 'leader-approval' (allowed: [leader, human])" — expected negative | n/a (log evidence) |
| 10 | `10-pending-ua.txt` | `node tests/mock/scripts/f9-check.mjs "pending" "--json" "{\"kind\":\"user-approval\"}"` (via `tools/run-asset.mjs`, `args/pending-ua.json`) | **exactly 1** pending — `ctrl-153npqu1woai9n1p30nr41dv` (kind=user-approval); vars written to `tests/mock/state/f9-pending.json` | 0 |
| 11 | `11-ui-gate-f9-g3-pending.txt` | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g3-pending.json` | **PASS 4/4** — resolve bar present (≥1), bar for exact `requestId`, §26.2 detail fields on the preceding control-request row (time/marker/actor/summary+title/pending state), allow+deny buttons enabled with correct labels | 0 |
| 12 | `12-ui-gate-f9-g3-allow.txt` | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g3-allow.json` | **PASS 4/4** — clickEval allow button `"clicked"` (settle 8s); bar for `requestId` gone; decision row present with `data-decision="allow"`; 0 `span[data-ledger-resolve-error]` chips | 0 |
| 13 | `13-decided-allow.txt` | `node tests/mock/scripts/f9-check.mjs "decided" "--request-id" "ctrl-153npqu1woai9n1p30nr41dv" "--expect" "allow"` | **PASS** — `control-decision-recorded` decision=allow, human decider | 0 |
| 14a | `14a-deliver-t41-exec.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-dtestmtsgjlo4a725 tests/mock/scripts/prompts/t41-exec.md` (root) | accepted; watchdog OK **turn=2, 42,381 ms** | 0 |
| 14b | `14b-root-turn2-calls.txt` | turn-log extraction | root: 1× `team_follow_up` token `dtest-v2-ua-exec`, target `inst-1j499i010e86`, prompt "…把逐字内容 V2-UA-CONTENT 写入 tests/mock-outside/probe/v2-probe-1.txt…" | 0 |
| 14c/d | `14c-w1-turn2-probe.txt`, `14d-w1-turn2-results.txt` | turn-log extraction (W1-A turn 2) | `write` + read-back: **verbatim `V2-UA-CONTENT`** at the member-cwd-resolved path `D:\…\tests\mock\tests\mock-outside\probe\v2-probe-1.txt` (step 1 overwrite-guard read-first error on the resolved path; step 2 read returned the pre-existing identical content — file inherited from the r2/r3 rounds; step 3 "Updated file"; step 4 read-back `V2-UA-CONTENT`) — see §7.6 path note | 0 |
| 15 | `15-consumed-ua.txt` | `node tests/mock/scripts/f9-check.mjs "consumed" "--request-id" "ctrl-153npqu1woai9n1p30nr41dv"` | **FAIL — expected exactly 1 `control-allow-consumed` fact, got 0** (asset expectation `consumed exactly-once` not met by current product behavior). **Expected, documented F10-class asset-expectation boundary — identical to r2; repair-plan item 4: preserve + document, product semantics intentionally unchanged.** This is the round's single non-PASS. | **1** |

### 5.3 R-F9 G3 — deny half

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 17a | `17a-deliver-t41-deny-req.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-team-child-b50874… tests/mock/scripts/prompts/t41-deny-req.md` | accepted; watchdog OK **turn=3, 12,250 ms** | 0 |
| 17b | `17b-w1-turn3-call.txt` | turn-log extraction | 1× `team_request_control` **verbatim**: token `dtest-v2-req-ua-2`, kind=user-approval, `actionName:"write"`, target `inst-1j499i010e86` | 0 |
| 18 | `18-pending-ua-deny.txt` | `node tests/mock/scripts/f9-check.mjs "pending" "--json" "{\"kind\":\"user-approval\",\"out\":\"tests/mock/state/f9-deny-pending.json\"}"` | **exactly 1** — `ctrl-14to41v1wya3ym1pwzgu11d1`; vars written | 0 |
| 19 | `19-ui-gate-f9-g3-deny.txt` | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g3-deny.json` | **PASS 4/4** — deny button clicked; bar gone; decision row `data-decision="deny"`; 0 error chips | 0 |
| 20 | `20-decided-deny.txt` | `node tests/mock/scripts/f9-check.mjs "decided" "--request-id" "ctrl-14to41v1wya3ym1pwzgu11d1" "--expect" "deny"` | **PASS** — decision=deny, human decider | 0 |
| 21 | `21-consumed-deny-absent.txt` | `node tests/mock/scripts/f9-check.mjs "consumed" "--request-id" "ctrl-14to41v1wya3ym1pwzgu11d1" "--json" "{\"expectAbsent\":true}"` (`args/consumed-absent.json`) | **PASS** — ZERO facts (deny half: no side effects) | 0 |
| — | (negative check, no numbered file) | file-existence probe | `v2-probe-2.txt` **ABSENT at both candidate paths** (repo-relative `tests/mock-outside/probe/` and member-cwd-relative `tests/mock/tests/mock-outside/probe/`) — re-verified at consolidation | 0 |

### 5.4 R-T14 (T1.4) — UI team creation

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 22 | (no numbered log; browser-driven via committed client surface) | playwright-cli session mocktest: 新建团队 overlay → `select[data-intent-blueprint]=dtest-bp` (React native setter + change event) → revision auto `"1"` → workspace `mock` → **`data-intent-status=OPEN`** (兼容性✓ 就绪; **T14-H fix holds — no BLOCKED_FATAL on the mcp requirement**) → `button[data-intent-create]` clicked → overlay gone, `data-intent-error` null | **PASS** — evidence: `snapshots/t14-after-create-r4.yml` + `screenshots/t14-after-create-r4.png` (17:34:34) | 0 |
| 23 | `23-teamB-durable-verify.txt` | `node <ev-r4>\tools\tables-r2.mjs` (durable `team_sessions` dump) | NEW row **`session-33d7038c-b841-49ec-9b3f-5a762b23f548`** (team B): `dtest-bp@1`, revision `"1"`, contentHash `sha256:e1b1df8f7cc4a3058bf9605be4f681912e5557fee79ce689e10d9e4f1c6c1126` (same as all other rows), createdAt 2026-09-08T09:34:29.160Z, generation 1, schemaVersion 1, defaultWorkspace `…\tests\mock`; **pre-existing 3 rows untouched** | 0 |

### 5.5 R-F11 fixture (team B) — model turns

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 24a | `24a-deliver-tb-setup.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-33d7038c… <ev-r4>\prompts\tb-setup.md` (round-local prompt; team-B root) | accepted; watchdog OK **turn=1, 28,156 ms** | 0 |
| 25 | `25-forensics-teamB-setup.txt` | `node <ev-r4>\tools\forensics-r2.mjs session-33d7038c…` | W1 `inst-1e0gj1v1lbkc` (worker, child `…c53238…`) CREATED; gen=3; 1 fact (seq 31) | 0 |
| 26a | `26a-deliver-tb-fill-1.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-33d7038c… <ev-r4>\prompts\tb-fill-1.md` | accepted; leader **turn=2, 39,207 ms** | 0 |
| 26b | `26b-fill1-leader-calls.txt` | turn-log extraction | 5× `team_follow_up` verbatim tokens `dtest-fix-1-1..5` (prompt verbatim 请只回复 OK…); W1-B turns 1–5 | 0 |
| 27a | `27a-deliver-tb-fill-2.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-33d7038c… <ev-r4>\prompts\tb-fill-2.md` | leader **turn=3, 30,168 ms** | 0 |
| 27b | `27b-fill2-leader-calls.txt` | turn-log extraction | tokens `dtest-fix-2-1..5`; W1-B 10 turns | 0 |
| 28a | `28a-deliver-tb-fill-3.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-33d7038c… <ev-r4>\prompts\tb-fill-3.md` | leader **turn=4, 45,375 ms** | 0 |
| 29 | `29-fill3-verify-factcount.txt` | turn-log + ledger check | tokens `dtest-fix-3-1..5`; W1-B 15 turns (last=15); **team B ledger = 61 facts (≥ 50 required)**; tail seq **91** (`member-lifecycle-changed`, 2026-09-08T09:38:31.475Z) | 0 |

**Model turns total: 25** (root-init 1, b4 1, exec root+W1 2, deny-req 1, team-B setup 1, fill leader 3 + W1-B 15, b6 1).

### 5.6 Boot#2 + pre-matrix gates (hard-tools resume)

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 30 | `30-boot-b2-console-redacted.txt` | boot.mjs with `MOCK_ROOT_SESSION_ID` + `MOCK_HARD_TOOLS=1` | `MOCKBOOT_READY … (keyConfigured=true)` (see §4) | 0 |
| 31 | `31-preflight-b2.txt` | `node tests/mock/scripts/preflight-check.mjs` | **8 PASS — CLEAR** (`mockRow=sessions=2` — team B bound to `mock` workspace; `rootBound=false` for the fresh root; team-binding gen=15) | 0 |
| 32 | `32-version-gate-b2.txt` | `node tests/mock/scripts/f9-check.mjs version-gate` | **5 PASS** (same shape as 04) | 0 |

### 5.7 R-F9 G4 — corrected recipe (worktree assets only)

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 33 | `33-pending-prestate-toolname.txt` | `node .worktrees\repair-r1-g4\tests\mock\scripts\f9-check.mjs "pending" "--json" "{\"root\": \"session-dtestmtsgjlo4a725\", \"toolName\": \"write\"}"` (`args/pending-policy-prestate.json`) | **0 matches** — discriminator empty pre-live; the fixed no-match hint prints ("deliver the request prompt (b4-requests.md / b6-req.md) first, then re-run") | **2** (expected sentinel) |
| 34a | `34a-deliver-b6-req.txt` | `node <ev-r4>\tools\deliver-r2.mjs session-team-child-b50874… .worktrees\repair-r1-g4\tests\mock\scripts\prompts\b6-req.md` (WORKTREE recipe) | accepted; watchdog OK **turn=4, 20,535 ms** | 0 |
| 34b | `34b-w1a-turn4-toolcall.txt` | turn-log extraction | single `team_request_control` with **`toolName:"write"`** (the r2-recipe-fix field) + kind=leader-approval + **verbatim token `dtest-v2-hard-req-2`**, target `inst-1j499i010e86` | 0 |
| 35 | `35-pending-toolname-live.txt` | `node .worktrees\repair-r1-g4\tests\mock\scripts\f9-check.mjs "pending" "--json" "{\"root\": \"session-dtestmtsgjlo4a725\", \"toolName\": \"write\", \"out\": \"tests/mock/state/f9-policy-pending.json\"}"` (`args/pending-policy-r4.json`) | **exactly 1** — `ctrl-0kftvcz0zi8w5w1k31au10eg` (kind=leader-approval); vars written | 0 |
| 36 | `36-ui-gate-f9-g4-policy.txt` | `node tests/mock/scripts/ui-gate.mjs tests/mock/scripts/gates/f9-g4-policy.json` — **attempt 1** | **FAIL (1 assert)** — navigation miss: committed `rootText` `请初始化团队` matched the **team-B root first** in DOM order (T1.4 bound team B to the `mock` workspace group, which renders above `未分组`; team-B root title shares the 22-char truncated prefix `…team_create_`). clickEval returned `'false'` ⇒ **NO click, NO mutation**; decision-row assert failed (no button rows existed). See §7.1 | **1** |
| 36b | `36b-ui-gate-f9-g4-policy-retry.txt` | **same committed gate**, after one documented raw-eval aid collapsing the `mock` group (navigation aid only; symmetric to r3 §4.3 group-expand) | **PASS 4/4** — allow button `"clicked"` (settle 8s); bar gone; §26.4 **frozen row in snapshot**: `团队裁决：已允许` / `执行：被托管策略阻止` (deny · external-policy, rid `ctrl-0kftvcz0zi8w5w1k31au10eg` visible); no plain 拒绝/Denied text; 0 error chips other than `CONTROL_EXTERNAL_POLICY_DENIED` semantics per config | 0 |
| 37 | `37-f9-policy-check.txt` | `node .worktrees\repair-r1-g4\tests\mock\scripts\f9-check.mjs "policy" "--request-id" "ctrl-0kftvcz0zi8w5w1k31au10eg" "--json" "{\"root\": \"session-dtestmtsgjlo4a725\"}"` (`args/policy-check-r4.json`) | **PASS** — managed-policy: decision=deny, reason=external-policy, decider=human, zero consumption | 0 |

### 5.8 R-F11 — API half + UI half

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 38a | `38a-suite-ledger-teamA.txt` | suite-ledger-complete (ledger-complete runner), team A default root `session-dtestmtsgjlo4a725` | **PASS** — pages=1, serverTotal=15, fetched=15, tail=93 = durable 15 (tail 93) | 0 |
| 38b | `38b-suite-ledger-teamB.txt` | suite-ledger-complete `--root session-33d7038c…` | **PASS** — **pages=2** (paging exercised), serverTotal=61, fetched=61, tail=91 = durable 61 (tail 91) | 0 |
| 39a | `39a-g5-vars.txt` | G5 vars recorded (`tests/mock/state/f11-g5-vars.json`; repo-root-relative to the gate config) | attempt-1 content `{"total":61,"headFact":"provision-member-instance","tailFact":"member-lifecycle-changed"}` (unquoted values — the §7.2 bug); on-disk file now holds the fixed JSON-quoted form `{"total": 61, "headFact": "\"provision-member-instance\"", "tailFact": "\"member-lifecycle-changed\""}` | 0 |
| 39b | `39b-ui-gate-g5-f11-teamB.txt` | `node tests/mock/scripts/ui-gate.mjs dev\agent-workflow\evidence\F3-F11-F9-T1.4-repair\live-round-r4\args\g5-f11-teamB.json` (ROUND-LOCAL config) — **attempt 1** | **FAIL (1)** — (a) round-local `rootText` longer than the 22-char truncated sidebar title ⇒ `NO REF` (root click failed; runner continued for diagnostics); (b) fact-type values interpolated **unquoted** into `=== {{tailFact}}` ⇒ JS `ReferenceError: member/provision is not defined` in the head/tail asserts (the gate's falsy-token test did not catch it — same false-PASS class r3 §4.3 recorded); row-count assert **FAILED** (0 rows, root not selected) ⇒ overall verdict still safe; **no product mutation** | **1** |
| 39c | `39c-ui-gate-g5-f11-teamB-retry.txt` | **same committed runner `ui-gate.mjs`** with the fixed round-local config (rootText prefix `…team_create`; JSON-quoted vars) | **PASS 5/5** — `rows=61 == durable total`; no `[data-ledger-remaining]`; no `[data-ledger-load-earlier]`; last row `data-ledger-fact` = durable tail `member-lifecycle-changed`; first row = durable head `provision-member-instance` | 0 |

### 5.9 Post-flight / cleanup / durable bracket

| # | File | Exact invocation (as logged) | Result | Exit |
|---|---|---|---|---|
| 41 | `41-postflight-ports-stable-testuse-tree.txt` | postflight pwsh | ports 3181/3491/3492 **free**; `:3080 GET → 401`; test-use @ `a66e470204…` porcelain **empty**; main `int/repair-r1 @ c0f9150`, **tracked mods 0**, untracked 17 (all round evidence/state — §7.5); playwright `mocktest` **closed**; residual pw processes **0** | 0 |
| 41 | `41-credential-scan.txt` | credential scan over the 86 evidence files | token1 hits **0**; token2 hits **0**; key-pattern hits **0**; cookie-header copies **0** | 0 |
| 42 | `42-poststate-bracket.txt` | durable post bracket (domain dump) | facts per team: `session-dtestmts5d068d576` **0** (gen 2); legacy `session-dtestmts69xkr6b54` **17** (gen 19); fresh team A `session-dtestmtsgjlo4a725` **15** (gen 17, seq [18..30, 92, 93]); team B `session-33d7038c…` **61** (gen 63, seq [31..91]); **global max sequence 93** (the `pendingControl` column mirrors the fact count — script label artifact; the authoritative pending sets are 42b) | 0 |
| 42b | `42b-poststate-pending-sets.txt` | 4× `f9-check pending` probes (`args/ps-a-la.json`, `args/ps-a-ua.json`, `args/ps-legacy.json`, `args/ps-b.json`) | team A leader-approval pending = **3**: seq 21 (`ctrl-08yb1y7…`), seq 22 (`ctrl-098ann60zyg9e70fcor3k1oe`), seq 23 (`ctrl-1k5t7y61ezoedj1oofk4006e`) = la-1/la-2/self-1 (intentionally left pending by design); team A user-approval pending = **0** (exit 2 expected sentinel); legacy pending = **3**: seq 5 (`ctrl-0eenv68…`), 6 (`ctrl-0ppmycw17v2axd0ws2xbi03q`), 14 (`ctrl-1eaer590…`) — unchanged by this round; team B pending = **0** (exit 2 expected sentinel) | 0 (per-probe sentinels 2 as noted) |

> **File-number note**: numbered outputs on disk are `00, 01, 02 (×2), 03, 04, 05a, 06, 07, 08a, 09,
> 09b, 10, 10b, 11, 12, 13, 14a–14d, 15, 17a, 17b, 18, 19, 20, 21, 23, 24a, 25, 26a, 26b, 27a, 27b, 28a,
> 29, 30, 31, 32, 33, 34a, 34b, 35, 36, 36b, 37, 38a, 38b, 39a, 39b, 39c, 41 (×2), 42, 42b`. Numbers
> 16, 22, 40 were never assigned; row 22 (T1.4 UI create) is evidenced by snapshot + screenshot +
> durable verify 23 instead of a numbered log; the negative probe check (v2-probe-2 absent) has no
> numbered file (verified at consolidation).

---

## 6. Live Playwright artifacts (paths, verified)

All gates ran on playwright-cli 0.1.19, session `mocktest`, against `http://127.0.0.1:3181/?token=[redacted]`.

| Gate | Assertion log (stdout) | Raw log | Snapshot (aria YAML) | Screenshot (PNG, valid signature) |
|---|---|---|---|---|
| G1 smoke (07) | `07-ui-gate-smoke-g1.txt` | `state/ui-gate-v2-smoke-g1-raw.txt` | `snapshots/v2-smoke-g1.yml` (byte-identical copy of `tests\mock\state\teamtab-v2-smoke-g1.yml`, verified by hash) | `screenshots/v2-smoke-g1.png` (78,726 B) |
| sidebar inspection (NOTES §6.3) | — | — | `snapshots/sidebar-inspect-r4.yml`, `snapshots/sidebar-ungrouped-r4.yml` (written directly to this evidence dir) | — |
| G3 pending (11) | `11-ui-gate-f9-g3-pending.txt` | `state/ui-gate-f9-g3-pending-raw.txt` | `tests\mock\state\teamtab-f9-g3-pending.yml` (22,685 B, 17:30:29 — gitignored mock-home runtime state; not copied into this dir) | `screenshots/f9-g3-pending.png` (72,311 B) |
| G3 allow (12) | `12-ui-gate-f9-g3-allow.txt` | `state/ui-gate-f9-g3-allow-raw.txt` | `tests\mock\state\teamtab-f9-g3-allow.yml` (21,696 B, 17:30:59) | `screenshots/f9-g3-allow.png` (72,368 B) |
| G3 deny (19) | `19-ui-gate-f9-g3-deny.txt` | `state/ui-gate-f9-g3-deny-raw.txt` | `tests\mock\state\teamtab-f9-g3-deny.yml` (27,872 B, 17:33:27) | `screenshots/f9-g3-deny.png` (71,432 B) |
| T1.4 create (22) | — | — | `snapshots/t14-after-create-r4.yml` (written directly to this evidence dir) | `screenshots/t14-after-create-r4.png` (43,727 B) |
| G4 policy (36b retry) | `36b-ui-gate-f9-g4-policy-retry.txt` (attempt 1: `36-…txt`) | `state/ui-gate-f9-g4-policy-raw.txt` (retry, 17:43:48 — attempt-1 file overwritten by the retry, same output name) | `snapshots/f9-g4-policy-r4.yml` (29,392 B; byte-identical copy of `tests\mock\state\teamtab-f9-g4-policy.yml`, verified by hash) | `screenshots/f9-g4-policy-r4.png` (73,226 B) |
| G5 F11 (39c retry) | `39c-ui-gate-g5-f11-teamB-retry.txt` (attempt 1: `39b-…txt`) | `state/ui-gate-f11-g5-teamB-r4-raw.txt` (retry) | `snapshots/f11-g5-teamB-r4.yml` (77,969 B; byte-identical copy of `tests\mock\state\teamtab-f11-g5-teamB-r4.yml`, verified by hash) | `screenshots/f11-g5-teamB-r4.png` (73,143 B) |

**Snapshot content verified at consolidation** (aria YAML omits `data-*` attributes — the DOM asserts
for those live in the gate logs; the snapshots verify structure/selection/text):
- `v2-smoke-g1.yml`: fresh root `[selected]`; heading `时间线`; `成员创建 W1/W2` rows with
  `inst-1j499i010e86` / `inst-042zjep11mrw` (root `session-dtestmtsgjlo4a725`); legacy inst ids absent.
- `teamtab-f9-g3-allow.yml` (mock state): team-A root `[selected]`; decision row `17:30:49 控制裁决
  W1 allow 允许` with `ctrl-153npqu1woai9n1p30nr41dv · allow`.
- `teamtab-f9-g3-deny.yml` (mock state): decision row `17:33:17 控制裁决 W1 deny 拒绝` with
  `ctrl-14to41v1wya3ym1pwzgu11d1 · deny` (and the earlier allow row still present in history).
- `f9-g4-policy-r4.yml`: team-A root `[selected]`; inst `inst-1j499i010e86` present, team-B inst absent;
  decision row `17:43:36 控制裁决 W1 deny · external-policy` with `ctrl-0kftvcz0zi8w5w1k31au10eg ·
  deny · external-policy` and the frozen pair `团队裁决：已允许` / `执行：被托管策略阻止`; request row
  `17:41:47 控制请求 W1 write` (seq 92).
- `f11-g5-teamB-r4.yml`: team-B root `[selected]`; ledger head `provision-member-instance · #31`;
  ledger tail `member-lifecycle-changed · #91` (09:38:31.475Z) — both equal durable head/tail; all
  15 `dtest-fix-*` work-unit rows present in order.
- All 7 screenshots carry a valid PNG signature (`89 50 4E 47 0D 0A 1A 0A`).

---

## 7. Durable F3 / F9 / F11 / T1.4 facts (residual world after the round)

- **F3 (object model / lifecycle)**: fresh team A — root `session-dtestmtsgjlo4a725` (created by
  boot#1 phase=create at 09:19:01.203Z), W1 `inst-1j499i010e86` (worker) + W2 `inst-042zjep11mrw`
  (collector) created by the model root-init turn; facts seq 18/19 `provision-member-instance`;
  follow-up machinery durable: `team-work-admitted` #25 (interval for `dtest-v2-ua-exec`),
  activity interval close, `member-lifecycle-changed` #28 RUNNING→SETTLED (workOutcome settled).
- **F9 (control / decisions / policy)** — all on the fresh root:
  - 6 model-driven control requests (verbatim tool calls): `dtest-v2-req-ua-1` (allow, UI),
    `dtest-v2-req-la-1` / `-la-2` / `-self-1` (left pending by design), `dtest-v2-req-ua-2` (deny, UI),
    `dtest-v2-hard-req-2` (leader-approval, `toolName:"write"`, denied by managed policy, UI).
  - Member self-resolve rejected: `CONTROL_RESOLVER_NOT_AUTHORIZED` (allowed roles: leader, human).
  - Decisions: allow (human), deny (human), deny/external-policy (team decision 已允许, execution
    blocked by managed policy — the §26.4 frozen row).
  - Consumption: allow half — 0 `control-allow-consumed` facts (documented expected FAIL, §5.2/15);
    deny half — zero facts (expectAbsent PASS).
  - Version gate (both boots): v1–v3 `method-version-unsupported`; v4 accepted; spoofed caller field
    rejected `malformed-params unknown-field`. Selftest 23/23.
- **F11 (ledger completeness / paging)**: team A — server paging 1 page, 15=15 (durable), tail 93;
  team B — **2 pages**, 61=61 (durable), tail 91; UI rendered all 61 rows with no remaining / no
  load-earlier and head+tail equal to durable head+tail (`provision-member-instance` #31 /
  `member-lifecycle-changed` #91).
- **T1.4 (UI creation)**: committed client surface creates team B (`dtest-bp@1`, revision "1",
  contentHash identical to all rows) with `data-intent-status=OPEN` (T14-H fix: no BLOCKED_FATAL on
  the mcp requirement); the created team is fully functional (W1 + 15 fixture turns + 61 facts, all
  model-driven).
- **Residual `team_sessions` (4 rows)**: `session-dtestmts5d068d576` (facts 0, gen 2); legacy
  `session-dtestmts69xkr6b54` (facts 17, gen 19, pending {5,6,14} — **unchanged by this round**);
  fresh team A `session-dtestmtsgjlo4a725` (facts 15, gen 17, pending leader-approvals
  {seq 21,22,23}); team B `session-33d7038c-b841-49ec-9b3f-5a762b23f548` (facts 61, gen 63, pending {}).
  Global max sequence **93**. Mock host killed cleanly (both boots, first-try idle kills); ports
  free; playwright `mocktest` closed; no stray files beyond gitignored round state.

**No fabricated state**: every new durable fact is model-driven (25 turns) or committed-gate
UI-driven (3 decisions + 1 create); no ledger/registry file hand-edited; no request created via API;
no boot-state/vars file seeded (all produced by the runs).

---

## 8. Cleanup, upstream and stable checks (all verified at consolidation)

| Check | Result |
|---|---|
| Mock host (3181) + mini-MCP (3491/3492) | killed (both boots, first-try idle kills); **all three ports free** post-round; 0 residual pw processes |
| playwright-cli session `mocktest` | closed; 0 daemon processes at baseline; absolute daemon dir `tests\mock\.playwright-cli\daemon` |
| Stable instance :3080 | **GET-probed only → 401** (baseline + postflight); zero interactions; `D:\deepseek-harness` untouched |
| Upstream test-use | `references/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`; **porcelain empty pre AND post**; pristine role intact |
| Main repo | `int/repair-r1 @ c0f9150`; **0 tracked modifications (start = end)**; worktree `.worktrees\repair-r1-g4` clean; **no push, no commit** by this round |
| Round artifacts containment | round-specific artifacts (team-B prompts ×4, G5 gate config + 11 args JSONs, boot-state copies, probe-file copy, served-bundle copy) live ONLY under `live-round-r4/` (plus mock-home runtime state under gitignored `tests/mock/{state,hosts,work}/`) |
| No committed asset modified | committed gates (`tests/mock/scripts/gates/*.json`), `f9-check.mjs` (main), `ui-gate.mjs` all unchanged; G4 recipe ran from the worktree copy (the task-branch 2-file diff itself) |

---

## 9. Retries and non-product anomalies (complete list)

1. **G4 UI attempt 1 (36, exit 1) — sidebar ambiguity introduced by T1.4 itself**: the committed
   G4 gate's `rootText` `请初始化团队` matched, in DOM order, the **team-B root first** — T1.4's UI
   create bound team B to the `mock` workspace group (renders above `未分组`), and team B's root title
   shares the prefix (truncated at 22 chars to `…team_create_`). clickEval `'false'` ⇒ **NO click, NO
   mutation**; only the decision-row assert failed. **Fix**: one manual raw-eval click collapsing the
   `mock` group (navigation aid, symmetric to r3 §4.3), then the UNCHANGED committed gate ran and
   passed 4/4 (36b). Recorded for possible future gate hardening (workspace-aware rootText) — NOT part
   of any diff.
2. **G5 UI attempt 1 (39b, exit 1) — ROUND-LOCAL config bugs, not the committed runner**: (a)
   `rootText` longer than the 22-char truncated sidebar title ⇒ NO REF (page state was otherwise
   correct — mock group expanded); (b) fact-type values interpolated **unquoted** into
   `=== {{tailFact}}` ⇒ JS `ReferenceError` (the gate's falsy-token test did not catch it — same
   false-PASS class r3 §4.3 recorded). The row-count assert FAILED ⇒ verdict still safe. Fixed in the
   round-local file only (`args/g5-f11-teamB.json` rootText prefix + JSON-quoted values in the vars
   file); committed `ui-gate.mjs` unchanged; retry 39c PASS 5/5.
3. **G3 consumed allow-half (15, exit 1)** — the single expected FAIL: documented F10-class
   asset-expectation boundary (expected 1 `control-allow-consumed`, got 0), identical to r2;
   repair-plan item 4: preserve + document; product semantics intentionally unchanged. Not a retry.
4. **Expected exit-2 sentinels** (no-match probes, by design): 33 (G4 pre-state, discriminator empty
   pre-live), 42b team-A user-approval (∅) and team B (∅).
5. **Probe-write path resolution (world-state fact, not a defect)**: the recipe's relative path
   `tests/mock-outside/probe/v2-probe-1.txt` resolves against the member session's cwd (`tests/mock`)
   ⇒ file landed at `tests\mock\tests\mock-outside\probe\v2-probe-1.txt` (13 B, verbatim
   `V2-UA-CONTENT`; copy in `state/v2-probe-1.txt`; still present, verified at consolidation). The
   file pre-existed from r2/r3 with identical content (14d step-2 read shows it before the step-3
   write). Same resolution semantics as r2.
6. **Log-format artifacts (display only, no state impact)**: (a) `09-w1-turn1-toolcalls.txt` shows
   `name= args=undefined` on summary lines — the extractor did not parse those rows; the authoritative
   raw calls are `09b`; (b) `41-postflight` lines 8–9 print a PowerShell Measure-Object artifact
   (correct values on line 10: tracked mods 0, untracked 17); (c) `42`'s `pendingControl` column
   mirrors the fact count (label artifact; authoritative pending sets in 42b); (d) pwsh 5.1 console
   mojibake / `Get-Content` GBK default / BOM handling — display-only; all evidence written UTF-8
   (BOM-free where node/JSON consumes; BOM-free rewrites recorded where needed); (e) boot-log
   `bytes=954324` vs authoritative live fetch 959,121 B (transient boot-time measurement; §2).
7. **Repo-hygiene finding (non-product, flagged for the main agent)**: `tests/mock/.gitignore`
   ignores `.dsh-home/` and `.dsh-home-smoke/` but **NOT** `.dsh-home-repair-r1/` — the persistent mock
   home (which contains `.credentials.yaml`, existence confirmed, never read) is therefore
   **untracked and unignored**, as is the probe tree `tests/mock/tests/` and the round evidence
   directories (17 untracked entries total, all round artifacts). A bulk `git add -A` could stage the
   credential file; recommend adding `.dsh-home-repair-r1/` (and the evidence dirs per repo policy) to
   `tests/mock/.gitignore` before any bulk add.

**No product defects found. No recipe defects remaining.** The r2 G4 recipe defect is confirmed
fixed by the task-branch 2-file change (`f9-check.mjs` + `prompts/b6-req.md`) — live-verified this
round on a fresh root (33/34b/35/37).

---

## 10. Gate-readiness verdict

### Verdict: **GATE-READY — the three fresh blind reviewers may be launched.**

Rationale (each independently checkable against this directory):

1. **Complete matrix, real state only**: all 6 V2 rows executed on a live host with real model turns
   (25) and a real browser; 5 rows PASS outright; the 6th is the pre-declared, documented expected
   FAIL (F10-class asset-expectation boundary, repair-plan item 4) — not a regression, product
   semantics intentionally unchanged.
2. **Every claim is re-derivable**: every asset cites its exact command (verbatim in the `[run-asset]`/
   `[deliver]`/ui-gate log lines) and its exact exit code; durable state has pre/post brackets
   (02-prestate vs 42/42b, global seq 93); UI state has assertion logs + raw logs + snapshot +
   screenshot paths for every gate; the G4 pre-state/live/policy trio is bracketed around the single
   UI decision.
3. **Constraint compliance is evidenced, not asserted**: stable :3080 (401 both probes), upstream
   test-use pristine (porcelain empty pre/post @ a66e470204), main checkout 0 tracked modifications
   (start = end), worktree clean, no push, credentials sealed (existence booleans only; 0/0/0/0
   fragment scan over 86 files).
4. **Retries are accounted for**: exactly two, each with a documented non-product cause (G4: sidebar
   ambiguity created by the T1.4 creation itself; G5: round-local config bugs), each retried with the
   UNCHANGED committed gate/runner, each with the failed attempt preserved on disk (36, 39b).
5. **The fresh-root adaptation is a world-state necessity, not an asset change**: `requestControl`
   scopeKey idempotency makes the committed G3/G4 recipes structurally un-runnable on the old root
   (all correlation tokens already decided/pending); boot#1 without `MOCK_ROOT_SESSION_ID` restores
   the V2 fresh-world precondition with zero committed-asset modification.

### Caveats to include in each reviewer brief (facts, not opinions):

- The persistent mock home is NOT clean: residual 4-row `team_sessions` world is exactly as listed in
  §7 (legacy rows pre-date this round; team-A pending {21,22,23} intentionally left).
- The G3-consumed allow-half FAIL (15) is pre-declared and documented; reviewers should assess the
  asset-expectation boundary against the repair plan, not as a product regression.
- Numbered outputs 16/22/40 were never assigned (row 22 evidenced by snapshot/screenshot + durable
  verify; see §5 file-number note).
- The G4 attempt-1 and G5 attempt-1 failures (36, 39b) are non-product (navigation / round-local
  config); the passing retries used unchanged committed gates.
- Reviewer inputs: this evidence directory; the task-branch diff `c0f9150..f1b1add --
  tests/mock/scripts` (2 files); the V2 matrix row definitions and the frozen-doc exit criteria per
  the normal gate brief; instructions to independently re-derive (do not rely on this report's
  summaries). Per ROUTER_RULES §3.1, process documents (including this report and NOTES-r4.md) are
  NOT part of the review object — reviewers decide from code, tests, fixtures and their own
  re-runs/inspections of the cited artifacts.

---

## 11. Consolidation verification statement

This report was produced by re-reading every file in this directory (56 numbered outputs + NOTES +
6 snapshots + 7 screenshots + 10 state files + 11 args + 4 prompts + 5 tool scripts + the existing
draft report) and independently re-checking, at consolidation time: bundle byte-prefix (959,026 B
disk = exact prefix of 959,121 B served, +95 B wrapper printed), all 10 fix markers (counts in §2),
git state of main / worktree / test-use (HEADs, porcelain, 2-file diff, 17 untracked entries
itemized), probe files (`v2-probe-1.txt` present 13 B verbatim; `v2-probe-2.txt` absent at both
candidates), host log dirs (`repair-r4-b1`, `repair-r4-b2` present), credential file existence
(booleans only), PNG signatures (all 7), hash-identity of the three canonical snapshot copies in
`snapshots/` against their `tests\mock\state\teamtab-*.yml` originals, the three G3 snapshots in
`tests\mock\state\` (sizes/timestamps + decision-row content), `requestControl`/`scopeKey` locations
in `packages/runtime/control/service.ts` (section L685, helper L404, applied L756/L765), the G5 vars
file on disk (fixed JSON-quoted form), the committed gate configs under `tests/mock/scripts/gates/`,
the `tests/mock/.gitignore` coverage gap (§9.7), and the snapshot content checks in §6. No product
state, host, port 3080, `D:\deepseek-harness`, upstream, active plan, graph or router-log file was
touched during the consolidation; nothing was pushed.
