# F3-F11-F9-T1.4-repair — live acceptance round r2 — CONSOLIDATED REPORT

**Task**: F3-F11-F9-T1.4 repair — live acceptance (round r2), F9 human control-ingress over the mock
team host, run against pristine upstream with the committed test assets **exactly as committed**.
**Consolidated**: 2026-09-08 (local 16:2x) by the evidence-consolidation subagent, from the
PREFLIGHT worker record (pre-round boot, 07:33 UTC / 15:33 local), the MATRIX worker final report
(round r2, 15:42–16:20 local), and on-disk evidence in this directory (numbered files `00`–`22b`,
`state/`, `screenshots/`, `snapshots/`, `args/`, `tools/`, `NOTES-r2.md`).
**Scope of this report**: consolidation + read-only re-verification of postflight state. No product
source, active plan, `graph.yaml`, `SESSION_ROUTER_LOG.md`, or upstream modification; no push.

---

## 1. Verdict

**16 PASS / 2 FAIL (worker score, by gate-half) — NO product regression; NO credential / host /
browser-infrastructure failure. The two FAILs are test-asset defects, not product defects.**

| Gate half | Result | Classification |
|---|---|---|
| Preflight b1 + selftest + version-gate b1 (00/01/02) | PASS | infra |
| UI smoke G1 (04) | PASS | UI baseline |
| G3 pending (06/07) | PASS | F9 human ingress visible in UI |
| G3 allow (08/09 + exec turn) | PASS | durable allow, decider=human, write executed & read-back verified |
| **G3 consumed (11)** | **FAIL (exit 1)** | **asset-expectation vs frozen product semantics** (F10 class; V1 T4.3 OBS documented identical behavior pre-F9; frozen contract L173/L436 — see §6.1) |
| G3 deny (13/14/15/16) | PASS | durable deny, zero consumption, disk-negative both paths |
| Preflight b2 + version-gate b2, `MOCK_HARD_TOOLS=1` (17/18) | PASS | boot#2 clean |
| **G4 policy (20→21→22)** | **FAIL (21 exit 1, 22 exit 1)** | **committed-recipe defect**: `b6-req.md`/`b4-requests.md` create requests with no `toolName` → `capabilityDomain=undefined` → external hard-policy branch unreachable (see §6.2) |

Per-asset exit-code ground truth (18 numbered asset invocations): **15 exit-0 / 3 exit-1**
(assets 21 and 22 are the two invocations of the one G4-policy gate failure). Worker score
convention: G3-exec turn counted as a PASS → 16 PASS; G4's 21+22 counted as one FAIL group → 2 FAIL.
The per-asset table in §4 is authoritative for exit codes.

**F9 repair acceptance position**: the human ingress under test (Remote v4 `team.resolveControl`,
T12-B4 human principal, §26.2 UI bar + detail fields, durable decision rows with `decider=human`,
exactly-once decision recording) **works end-to-end live** — G3 pending/allow/deny all pass on both
boots. The two FAILs do not implicate the F9 change; both stand as recorded with exact exit codes.

**Decision required from the delegating agent** (out of this round's "run as committed" mandate,
per `22b-g4-fail-diagnosis.md` and `NOTES-r2.md` §9): a compliant G4 re-run needs the
policy-half request to carry `toolName` (as V1 T4.7a precedent did) or an explicit
`capabilityDomain`, and to be the request the gate selects — i.e. a recipe change
(`prompts/b6-req.md`, possibly the gate's pending selection). The G3-consumed expectation likewise
cannot be satisfied by the committed recipe pair under frozen guard semantics (V1 T4.3 OBS).

---

## 2. Exact environment

| Item | Value |
|---|---|
| Repository | `D:\AgentDev\dsh-plugins\dsh-agent-team` (dsh-agent-team vNext; working tree: **zero tracked modifications** at consolidation re-check, §7) |
| OS / host | Windows_NT, `DESKTOP-P64Q2FT` |
| Node | `v24.20.0` (`C:\nvm4w\nodejs`) |
| PowerShell | pwsh 5.1.26100.9168 (quirks per `NOTES-r2.md` §7.6: UTF-16 evidence files, ANSI console mojibake display-only) |
| playwright-cli | `0.1.19` (`C:\nvm4w\nodejs\node_modules\@playwright\cli\playwright-cli.js`), browser session `mocktest` |
| Host (test instance) | mock team host booted from pristine `references/deepseek-harness-test-use` @ **`a66e4702047846cdaa10c66c9d3df3951f5ea70d`** (pre-boot HEAD, porcelain empty — §7) |
| **DSH_HOME** | **`D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/.dsh-home-repair-r1`** (workspace-internal, gitignored; `MOCK_DSH_HOME=tests/mock/.dsh-home-repair-r1`) |
| Root session | `session-dtestmts69xkr6b54` (`MOCK_ROOT_SESSION_ID`) |
| `DSH_CLIENT_COMMIT_HASH` | `a66e470204` (boot env; skips git spawn in build) |
| Model route | `qwen3.8-27b` via provider `qiyuan-self` (boot-state `model.provider`/`model.model`; `keyConfigured=true` on both in-round boots) |
| Blueprint | `dtest-bp@1` (row health `toolCount=10`) |
| Plugin rows mounted | `dsh-agent-team` / `dsh-agent-team-client` / `p6t6-team-tools` / `dtest-mcp-http` — 4× true |
| Client bundle | served 200, 954,324 B (byte-identical to prior round, per preflight worker) |
| Mini MCP servers (in-process) | facet `dtest-mini` :3491, host `dtesthttp` :3492 |

### 2.1 Host / ports

| Port | Role | Owner during round | State after postflight (re-verified at consolidation) |
|---|---|---|---|
| **3181** | mock team host (test instance) | boot#1 `repair-r2-b1r`, then boot#2 `repair-r2-b2` (pre-round: preflight worker host `repair-r1-pw2`) | **FREE** |
| **3491** | MCP facet `dtest-mini` | boot job (in-process) | **FREE** |
| **3492** | MCP host `dtesthttp` | boot job (in-process) | **FREE** |
| **3080** | **STABLE dev instance — out of scope, GET-only probes** | stable deployment `D:\deepseek-harness\` (pid 11676) | **LISTENING, GET → 401** (up, auth-protected, zero operations — §7) |

Note: `:3180`/`:17244` idle leftovers pre-existing from an earlier round were left untouched
(preflight worker record).

### 2.2 Boots (three total)

| Boot | Label | Env (as recorded in evidence) | boot-state facts |
|---|---|---|---|
| pre-round (PREFLIGHT worker) | `repair-r1-pw2` | `node tests/mock/scripts/boot.mjs` with `MOCK_DSH_HOME=tests/mock/.dsh-home-repair-r1`, `MOCK_ROOT_SESSION_ID=session-dtestmts69xkr6b54`, `MOCK_BOOT_LABEL=repair-r1-pw2`, `DSH_CLIENT_COMMIT_HASH=a66e470204` → `MOCKBOOT_READY`; boot-state persisted to `tests/mock/state/boot-state.json` (launch token kept there only, never printed); host kept alive in worker's background job `pwsh-112` | rows 4×true; bundle 200 (954,324 B); `toolCount=10`; `liveSessions=["session-dtestmts69xkr6b54"]`; **`keyConfigured=false`** ⚠️ (flagged; fixed before boot#1 — §3) |
| in-round **boot#1** | `repair-r2-b1r` | same recipe as pre-round (exact prior repair-Playwright env, `NOTES-r2.md` header); no `MOCK_HARD_TOOLS` | asset 00 preflight ran against it (gen=2 at that time); `keyConfigured=true` after credential fix; client health `rootLive=true` |
| in-round **boot#2** | `repair-r2-b2` | same recipe + `MOCK_HARD_TOOLS=1` | `state/boot-state.json` (copied into evidence): `model.keyConfigured=true`, `hardTools=true`, `blueprint=dtest-bp@1`, `mcp.facet=dtest-mini:3491`, `mcp.host=dtesthttp:3492`, origin `http://127.0.0.1:3181`, `bootedAt=2026-09-08T08:10:10.857Z`, log `tests\mock\hosts\repair-r2-b2\instance-port3181.log`. Team resumed (gen 15 at preflight 17 → 17 by postflight) |

`state/boot-state.json` contains the boot#2 launch token in `url`; **the token is NOT reproduced in
this report** (credential handling rule — same as `NOTES-r2.md` §8).

---

## 3. Credentials (booleans only — no values ever printed or copied)

| Check (at consolidation re-verification) | Result |
|---|---|
| `tests/mock/.dsh-home-repair-r1` exists | **TRUE** |
| `tests/mock/.dsh-home-repair-r1/.credentials.yaml` present | **TRUE** (242 B, 9 lines; top-level keys: `payload:`, `records:`, `refs:`) |
| `QIYUAN_SELF_API_KEY` ref present in that file | **TRUE** (name matched, value not printed) |
| backup `.credentials.yaml.bak-r2` present in the home | **TRUE** (stays in the gitignored home, deliberately not copied into evidence) |
| pre-round state (PREFLIGHT worker) | file 161 B, **ref absent → `keyConfigured=false`** (flagged as the single credential gap) |
| fix applied (MATRIX worker, pre-boot#1) | `refs:` section appended **byte-exact from the V2 home** `tests/mock/.dsh-home/.credentials.yaml`; backup chain `.bak-r1`→`.bak-r2`; value never printed; boot re-ran clean (`keyConfigured=true`) |
| `state/cookie-header.txt` (session cookie, gitignored state dir) | **NOT** copied into evidence (session credential) |

No credential values appear anywhere in this evidence directory (verified by construction: every
captured log shows `[token]=[redacted]` or keeps tokens only inside the gitignored home).

---

## 4. Commands and exit codes (complete)

All asset commands are the committed `tests/mock/scripts/*` (tree clean; nothing improvised).
`f9-check` invocations ran through the committed-safe wrapper `tools/run-asset.mjs` (exact-argv +
`@file` JSON — eliminates the r1 shell-quoting failure class; the wrapper echoes the exact argv,
preserved in each evidence file's first line). Model turns delivered via `tools/deliver-r2.mjs`
(HTTP POST, `status=200 ok=true`, `value={"accepted":true}`, deliver exit 0 each time), each with a
watchdog (`wait-turn`, 240 s timeout) per the wait-turn discipline (`NOTES-r2.md` §7.4).

### 4.1 Pre-round preflight (PREFLIGHT worker, 15:33 local)

| # | Command / check | Result |
|---|---|---|
| P1 | `git -C references/deepseek-harness-test-use rev-parse HEAD` + `git status --porcelain` | HEAD `a66e4702047846cdaa10c66c9d3df3951f5ea70d`, porcelain **empty** |
| P2 | port checks 3181/3491/3492 | all FREE pre-boot |
| P3 | `GET http://127.0.0.1:3080/` (read-only, once) | **401** (alive, auth-protected; identical pre/post; zero file ops on the stable deployment) |
| P4 | `node tests/mock/scripts/boot.mjs` (env per §2.2, label `repair-r1-pw2`) | `MOCKBOOT_READY`; rows 4×true; bundle 200 (954,324 B); `toolCount=10`; `liveSessions=[root]`; minis :3491/:3492 |
| P5 | post-boot re-check | test-use porcelain 0; `:3080` → 401; 3181→pid 42200, 3491/3492→pid 13168 listening; footprint limited to `tests/mock` scratch (`hosts/repair-r1-pw2/`, `state/`, patch layer in the repair-r1 home) |

### 4.2 In-round assets (MATRIX worker; `00`–`22b`)

| # | Exact command (CWD = repo root unless noted) | Boot | Result | Exit |
|---|---|---|---|---|
| 00 | `node tests/mock/scripts/preflight-check.mjs` | boot#1 | 8 PASS, 0 WARN, 0 FAIL — CLEAR (cookie-auth 200 24,395 B; row-health 200 ok toolCount=10 rootLive; blueprint-binding sha256 `e1b1df8f7cc4…` match; envelope-intersection; workspace-registry workspaces=1; mcp-endpoints 3491/3492 true; team-binding gen=2; team-remote-seam gen=2) | **0** |
| 01 | `node tests/mock/scripts/f9-check.mjs selftest` | offline | 23 PASS (incl. exactly-once consumption, expectAbsent, policy deny+external-policy, closed control-code set of 7) | **0** |
| 02 | `node tests/mock/scripts/f9-check.mjs version-gate` | boot#1 | 5 PASS (v1–v3 `method-version-unsupported`; v4 reaches control port → `CONTROL_REQUEST_NOT_FOUND`; v4 spoofed caller → `malformed-params unknown-field`) | **0** |
| 03 | `tools/deliver-r2.mjs` → POST root session `prompts/r2-root-init.md` (142 chars, verbatim V2 root prompt) | boot#1 | `status=200 ok=true value={"accepted":true}` | **0** |
| 03w | `wait-turn` watchdog, root turn 1 (baseline race: armed post-delivery) | boot#1 | TIMEOUT after 241,350 ms; fingerprint proves completion (`turn/end` seq=338, reason=completed) — executor discipline item, not an asset failure | **1** |
| 04 | `node tests/mock/scripts/ui-gate.mjs gates/smoke-g1.json` | boot#1 | PASS — W1/W2/时间线 present; snapshot `state/teamtab-v2-smoke-g1.yml`; screenshot `screenshots/v2-smoke-g1.png` | **0** |
| 05 | `tools/deliver-r2.mjs` → POST W1 child session `tests\mock\scripts\prompts\b4-requests.md` (699 chars) | boot#1 | `status=200 ok=true` (turn 38.6 s inside watchdog) | **0** |
| 06 | `node tests/mock/scripts/f9-check.mjs "pending" "--json" "{\"kind\":\"user-approval\"}"` | boot#1 | PASS 1 — rid `ctrl-1utbsww1kjuqwl08yzyyu0ma`; wrote `tests/mock/state/f9-pending.json` | **0** |
| 07 | `node tests/mock/scripts/ui-gate.mjs gates/f9-g3-pending.json` | boot#1 | PASS 4/4 asserts (§5) | **0** |
| 08 | `node tests/mock/scripts/ui-gate.mjs gates/f9-g3-allow.json` | boot#1 | PASS 4/4 (Allow clicked; bar gone; allow decision row; zero error chips) | **0** |
| 09 | `node tests/mock/scripts/f9-check.mjs "decided" "--request-id" "ctrl-1utbsww1kjuqwl08yzyyu0ma" "--expect" "allow"` | boot#1 | PASS 1 — durable `control-decision-recorded` seq 7, decider=human | **0** |
| 10 | `tools/deliver-r2.mjs` → POST root session `tests\mock\scripts\prompts\t41-exec.md` (268 chars) | boot#1 | `status=200 ok=true` (turn 52.3 s inside watchdog) | **0** |
| 11 | `node tests/mock/scripts/f9-check.mjs "consumed" "--request-id" "ctrl-1utbsww1kjuqwl08yzyyu0ma"` | boot#1 | **FAIL** — `expected exactly 1 control-allow-consumed fact … got 0` (0 PASS, 1 FAIL — F9 GATE FAIL) | **1** |
| 11b | disk probe, repo-level `tests/mock-outside/probe/v2-probe-1.txt` | — | `exists=NO` (write landed workspace-relative, see §5/§6.1) | probe |
| 12 | `tools/deliver-r2.mjs` → POST W1 child `tests\mock\scripts\prompts\t41-deny-req.md` (267 chars) | boot#1 | `status=200 ok=true` (turn 10.3 s) | **0** |
| 13 | `node tests/mock/scripts/f9-check.mjs "pending" "--json" "{\"kind\":\"user-approval\",\"out\":\"tests/mock/state/f9-deny-pending.json\"}"` | boot#1 | PASS 1 — rid `ctrl-1vnalzt1jpvxto08p0d9v0mk` | **0** |
| 14 | `node tests/mock/scripts/ui-gate.mjs gates/f9-g3-deny.json` | boot#1 | PASS 4/4 (Deny clicked; bar gone; deny decision row; zero error chips) | **0** |
| 15 | `node tests/mock/scripts/f9-check.mjs "decided" "--request-id" "ctrl-1vnalzt1jpvxto08p0d9v0mk" "--expect" "deny"` | boot#1 | PASS 1 — durable deny seq 13, decider=human | **0** |
| 16 | `node tests/mock/scripts/f9-check.mjs "consumed" "--request-id" "ctrl-1vnalzt1jpvxto08p0d9v0mk" "--json" "{\"expectAbsent\": true}"` | boot#1 | PASS 1 — zero consumption facts (deny = zero side effects) | **0** |
| 16b | disk probes, v2-probe-2 repo-level + nested | — | both `exists=False` | probe |
| 17 | `node tests/mock/scripts/preflight-check.mjs` | **boot#2** (`MOCK_HARD_TOOLS=1`) | 8 PASS, 0 WARN, 0 FAIL — CLEAR (team-binding gen=15, remote-seam gen=15) | **0** |
| 18 | `node tests/mock/scripts/f9-check.mjs version-gate` | boot#2 | 5 PASS | **0** |
| 19 | `tools/deliver-r2.mjs` → POST W1 child `tests\mock\scripts\prompts\b6-req.md` (166 chars) | boot#2 | `status=200 ok=true` (turn 8.2 s; recorded request seq 14 — **no `toolName` in the call**) | **0** |
| 20 | `node tests/mock/scripts/f9-check.mjs "pending" "--json" "{\"out\":\"tests/mock/state/f9-policy-pending.json\"}"` | boot#2 | PASS 1 — 4 pending matched, first by sequence = `ctrl-0f8mo951hnv44s1ytucq70l3` (seq 4, v2-l1); others stay pending (seq 5/6/14) | **0** |
| 21 | `node tests/mock/scripts/ui-gate.mjs gates/f9-g4-policy.json` | boot#2 | **FAIL (1)** — Allow clicked ("clicked", 8 s settle); **decision-row assert value=false** (expected deny + `data-external-policy="true"` + "Team decision: Allowed"/"Execution: Blocked by managed policy"); error-chip assert PASS (vacuous — empty chip list); bar-for-rid assert PASS (bar gone); snapshot `state/teamtab-f9-g4-policy.yml`; screenshot `screenshots/f9-g4-policy.png` | **1** |
| 22 | `node tests/mock/scripts/f9-check.mjs "policy" "--request-id" "ctrl-0f8mo951hnv44s1ytucq70l3"` | boot#2 | **FAIL** — `decision "allow" != expected deny \| reason undefined != "external-policy"` (0 PASS, 1 FAIL — F9 GATE FAIL) | **1** |

Postflight sequence (phase 6): boot#2 killed → ports freed (re-verified §7) → `:3080` GET-only
probe 401 → test-use porcelain empty → artifacts copied into this evidence dir.

### 4.3 Durable control-plane ledger (final, 15 facts — `21b-ledger-after-g4-click.txt`)

6 requests (seq 3,4,5,6,12,14) / 3 decisions (seq 7 allow, 13 deny, 15 allow — **all
`decider={"kind":"human","humanId":"session-dtestmts69xkr6b54"}`**) / **0 `control-allow-consumed`** /
2 provisions (seq 1,2) / work+activity+lifecycle (seq 8–11). No stale-denied, no double-decision, no
member-decided rows. Residual world: 3 genuinely-pending requests (v2-l2 seq 5, v2-self seq 6,
v2-hard seq 14) + 1 unconsumed allow (v2-probe-1 seq 3→7) — all model/UI-driven, none fabricated.

Model turns (all model-driven, watchdog-disciplined): root t1 init (team gen 4; W1=
`inst-0fi1an617bjs`/worker child `session-team-child-f1898fca…`, W2=`inst-1ds2q2n0nete`/collector
child `session-team-child-a28fa0cc…`) → W1 t1 b4 (4 requests + self-resolve rejected
`CONTROL_RESOLVER_NOT_AUTHORIZED (allowed: [leader, human])` — exactly the V2 B4 expectation) →
root t2 t41-exec (leader `team_follow_up` executed, `team-work-admitted` seq 8) → W1 t2 guarded
write (content `V2-UA-CONTENT` read-back verified, `11c2-nested-write-artifact-v2-probe-1.txt`) →
W1 t3 t41-deny-req → W1 t4 b6-req (boot#2).

---

## 5. Playwright UI gates — snapshots and assertions

Committed gate configs (`tests/mock/scripts/gates/*.json`, run as committed; `{{requestId}}`
interpolated from the `f9-check pending` vars files `state/f9-{,deny-,policy-}pending.json`).
Every gate: `goto http://127.0.0.1:3181/?token=[redacted]` (code=0) → click root "请初始化团队"
(code=0) → teamTab "团队" via `role=tab` eval → asserts → snapshot → screenshot.

### 5.1 `smoke-g1.json` (asset 04 — PASS, exit 0)

| Assert | Result |
|---|---|
| `find "W1" expect=present` | PASS present=true |
| `find "W2" expect=present` | PASS present=true |
| `find "时间线" expect=present` | PASS present=true |

Snapshot `state/teamtab-v2-smoke-g1.yml`; screenshot `screenshots/v2-smoke-g1.png`.

### 5.2 `f9-g3-pending.json` (asset 07 — PASS 4/4, exit 0)

| # | Committed assert | Result |
|---|---|---|
| 1 | `querySelectorAll('div[data-ledger-resolve-bar][data-request-id]').length >= 1` | PASS true |
| 2 | `querySelector('div[data-ledger-resolve-bar][data-request-id="<rid>"]') !== null` (rid = `ctrl-1utbsww1kjuqwl08yzyyu0ma`) | PASS true |
| 3 | §26.2 detail fields of the row preceding the bar (`data-ledger-kind="control-request"`): non-empty time, marker ∈ {Control request, 控制请求}, non-empty actor, non-empty summary + title, state ∈ {Pending decision, 等待裁决} | PASS true |
| 4 | bar's `button[data-ledger-resolve-allow]` text ∈ {Allow, 允许} **and enabled**, `button[data-ledger-resolve-deny]` text ∈ {Deny, 拒绝} **and enabled** | PASS true |

Snapshot `state/teamtab-f9-g3-pending.yml` (captured 16:02:16) shows the live bar for v2-probe-1:
request row "16:00:43 控制请求 W1 write 等待裁决", detail fields 请求方=W1 / 请求类型=user-approval /
请求操作=write / 原因=写入 tests/mock-outside/probe/v2-probe-1.txt / 创建时间=16:00:43 /
当前状态=等待裁决 / 请求权限=human, enabled 允许/拒绝 buttons; header count "4 项待裁决"
(button "已创建 暂无动作 4 项待裁决", "团队 1 运行中 · 4 待裁决"); the other 3 pending rows
(v2-l1/v2-l2/v2-self) each render 等待裁决. Screenshot `screenshots/f9-g3-pending.png`.

### 5.3 `f9-g3-allow.json` (asset 08 — PASS 4/4, exit 0)

| # | Committed assert | Result |
|---|---|---|
| 1 | `clickEval` bar-for-rid `button[data-ledger-resolve-allow].click()` (settle 6000 ms) | PASS "clicked" |
| 2 | bar for exact rid `=== null` | PASS true (bar gone) |
| 3 | some `button[data-ledger-row][data-ledger-kind="control-decision"]` contains `span[data-ledger-state][data-decision="allow"]` text ∈ {Allowed, 允许} | PASS true |
| 4 | `querySelectorAll('span[data-ledger-resolve-error]').length === 0` | PASS true |

Snapshot `state/teamtab-f9-g3-allow.yml` (16:02:47): decision row "16:02:38 控制裁决 W1 allow 允许"
(detail "ctrl-1utbsww1kjuqwl08yzyyu0ma · allow"). Screenshot `screenshots/f9-g3-allow.png`.
Durable confirmation: ledger seq 7 (asset 09, exit 0).

### 5.4 `f9-g3-deny.json` (asset 14 — PASS 4/4, exit 0)

Same structure as 5.3 with the deny variant:

| # | Committed assert | Result |
|---|---|---|
| 1 | `clickEval` bar-for-rid `button[data-ledger-resolve-deny].click()` (settle 6000 ms) | PASS "clicked" |
| 2 | bar for exact rid `=== null` | PASS true |
| 3 | some control-decision row with `span[data-ledger-state][data-decision="deny"]` text ∈ {Denied, 拒绝} | PASS true |
| 4 | zero `span[data-ledger-resolve-error]` | PASS true |

Snapshot `state/teamtab-f9-g3-deny.yml` (16:09:33): decision row "16:09:23 控制裁决 W1 deny 拒绝"
(detail "ctrl-1vnalzt1jpvxto08p0d9v0mk · deny"); the earlier allow row still present.
Screenshot `screenshots/f9-g3-deny.png`. Durable confirmation: ledger seq 13 (asset 15, exit 0)
and zero-consumption negative (asset 16, exit 0) + disk negatives (16b).

### 5.5 `f9-g4-policy.json` (asset 21 — **FAIL (1)**, exit 1)

| # | Committed assert | Result |
|---|---|---|
| 1 | `clickEval` bar-for-rid `button[data-ledger-resolve-allow].click()` (settle 8000 ms; rid = `ctrl-0f8mo951hnv44s1ytucq70l3`, v2-l1) | PASS "clicked" |
| 2 | **some control-decision row with `span[data-ledger-state][data-decision="deny"][data-external-policy="true"]` AND (`[data-external-policy-team-decision]` === "Team decision: Allowed" (or zh 团队裁决：已允许) AND `[data-external-policy-execution]` === "Execution: Blocked by managed policy" (or zh 执行：被托管策略阻止)) AND no plain "Denied/拒绝"** | **FAIL value=false** |
| 3 | `errs.every(e => e.getAttribute('data-resolve-error-code') === 'CONTROL_EXTERNAL_POLICY_DENIED')` | PASS — **vacuously true** (zero error chips at capture; proves nothing — recorded in `22b` §4) |
| 4 | bar for exact rid `=== null` | PASS true (bar gone) |

Snapshot `state/teamtab-f9-g4-policy.yml` (16:16:39, 8 s settle): **plain-allow** decision row
"16:16:28 控制裁决 W1 allow 允许" rendered; the v2-l1 request row (ref f4e650) shows **no**
等待裁决 marker and no live 允许/拒绝 buttons at capture; the genuinely-pending rows v2-l2
(detail reason 写入 work/v2-l2.txt, live buttons f4e445/f4e446), v2-self (live buttons
f4e478/f4e479) and v2-hard (16:15:58, live buttons f4e586/f4e587) retain 等待裁决; header counts
correct: "已结算 暂无动作 **3 项待裁决**", "团队 1 运行中 · **3 待裁决**". Screenshot
`screenshots/f9-g4-policy.png`.
Durable truth: ledger seq 15 = `control-decision-recorded rid=ctrl-0f8mo951… decision=allow
decider={kind:human}` (no `external-policy` reason — see §6.2).
> **Consolidation note (transparency)**: the executor's secondary observation (`NOTES-r2.md` §5b,
> `22b` §5) states the v2-l1 row "still showed 等待裁决 + live resolve bar" at the 8 s-settle
> snapshot. The captured snapshot and raw log **do not support that detail** — at capture the
> row's pending marker and bar were already gone (assert 4 PASS). This does not affect the FAIL:
> the failing assert is the deny+external-policy decision row, and the durable allow (seq 15) +
> asset 22 exit 1 independently prove it. Recorded so the discrepancy stands on the record.

---

## 6. FAIL diagnoses (full text in the referenced files)

### 6.1 Asset 11 — G3 `consumed` FAIL (exit 1) — `11d-consumed-fail-diagnosis.md`

`f9-check consumed --request-id ctrl-1utbsww1kjuqwl08yzyyu0ma` expected exactly 1
`control-allow-consumed` fact, got 0. **Classification: asset-expectation vs frozen product
semantics (F10 class), not a product regression.**

- The last-mile guard (`packages/tools/src/guard.ts` SD-GUARD; `tools.ts` `executeGuarded`
  L254-282; `control/service.ts` `guardOperation` L995+, exact scope key
  `(root, target, actionName, toolName, correlation)`) is consulted **only for the four team work
  operations** (`team_delegate`/`team_follow_up`/`team_send_message`/`team_report_progress`).
- Request ① is `(inst-0fi1an617bjs, write, <no toolName>, dtest-v2-req-ua-1)`; the t41-exec
  follow-up carried requestToken `dtest-v2-ua-exec` (≠ correlation) — no consulted team-operation
  scope can ever match it, so its allow is **durably unconsumed** while the member's write executed
  via the base `write` tool (host-sandbox lane; resolved workspace-relative to the session root
  `tests/mock` → landed `tests/mock/tests/mock-outside/probe/v2-probe-1.txt`, content
  `V2-UA-CONTENT` verified by read-back; repo-level probe path absent per 11b).
- Frozen contract L173 ("first-decision-authoritative, exactly-once allow consumption, 'decision ≠
  execution' all unchanged") / L436 (F9-H "exactly-once … preserved"); the F9 repair added the
  human ingress only. V1 precedent: T4.3 OBS documented the identical behavior pre-F9 (and T4.5
  measured exactly-once consumption on a controlled follow-up scope instead).
- Consequence: the "放行" (allow takes effect) part is demonstrated; exactly-once remains safe
  (unconsumed allow could still be consumed by a matching future operation; no double-execution
  risk); the committed recipe pair (b4-requests + t41-exec) cannot satisfy the committed
  `consumed` expectation.

### 6.2 Assets 21+22 — G4 policy FAIL (exit 1, exit 1) — `22b-g4-fail-diagnosis.md`

Human Allow on v2-l1 (`ctrl-0f8mo951hnv44s1ytucq70l3`) under boot#2 (`MOCK_HARD_TOOLS=1`) committed
as a **plain allow** (durable seq 15, no `external-policy` reason) instead of the expected
`deny + external-policy` + UI "Execution: Blocked by managed policy" row.
**Classification: committed-recipe defect (test asset), not product / credentials / host / browser.**

- Frozen product semantics (`packages/runtime/control/service.ts` L923-955, `resolveControl`): the
  external hard-policy gate runs for `decision==='allow'` only when
  `capabilityDomain = payload.capabilityDomain ?? (payload.toolName !== undefined ? 'tools' :
  undefined)` is **defined**. Every r2 request (b4: seq 3–6; b6: seq 14) was created by the
  committed recipes **without `toolName`** and without explicit `capabilityDomain` →
  `capabilityDomain === undefined` → policy check skipped → plain allow. No request in the r2 world
  could ever be blocked by `hard.tools=deny`; the gate's expected outcome is **structurally
  unsatisfiable as committed** on any boot.
- The V1 precedent the gate models (V1 NOTES T4.7a, L201) declared `toolName:"write"` and did
  produce the durable `deny · external-policy` + UI "deny · external-policy" row (T4.7b PASS); the
  committed V2 recipe `b6-req.md` dropped that parameter.
- Secondary (record only): vacuous error-chip `every()` on empty list (committed gate config); the
  pending gate itself worked (4 pending, first-by-seq selection, exact-rid isolation via
  varsFile — mechanism proven by the passing click and bar-removal asserts).
- What a compliant re-run needs (decision for the delegating agent, NOT executed — assets were run
  exactly as committed): a model-driven request carrying `toolName` (or explicit
  `capabilityDomain`) created under a hard-tools boot while it is the selected pending, then the
  same `f9-g4-policy` + `f9-check policy` steps. Product side (durable deny · external-policy +
  §26.4 UI row) has V1 precedent.

---

## 7. Cleanup proof, upstream and stable-instance checks

Postflight as executed by the MATRIX worker, **re-verified read-only at consolidation time**:

| Check | Postflight (worker) | Consolidation re-check (2026-09-08) |
|---|---|---|
| boots killed | boot#2 killed (boot#1 previously) | — |
| port 3181 | FREE | **FREE** |
| port 3491 | FREE | **FREE** |
| port 3492 | FREE | **FREE** |
| port 3080 (stable) | untouched, GET-only probe 401 | **LISTENING (pid 11676)**, `GET http://127.0.0.1:3080/` → **401** `text/plain; charset=utf-8` (up, auth-protected; read-only probe; **zero operations** on the stable instance by this round) |
| `references/deepseek-harness-test-use` HEAD | `a66e4702047846cdaa10c66c9d3df3951f5ea70d` | **`a66e4702047846cdaa10c66c9d3df3951f5ea70d`** (unchanged) |
| test-use `git status --porcelain` | empty (pristine) | **EMPTY (pristine)** — re-verified now |
| main repo tracked modifications | none | **none** (`git status --porcelain` filtered of untracked = empty) |
| main repo untracked (accounted) | evidence dirs + gitignored mock home + nested write artifact | `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/live-round-r2/` (this report), other pre-existing evidence dirs, `tests/mock/.dsh-home-repair-r1/` (gitignored home), `tests/mock/tests/` (the nested `V2-UA-CONTENT` artifact), `.playwright-cli/`, docs scratch — all pre-existing or this round's evidence; **no tracked file touched** |

### 7.1 Residual world facts (durable, all accounted, left as acceptance residue per V1 precedent)

- 3 pending requests (v2-l2 seq 5, v2-self seq 6, v2-hard seq 14) in the mock team home;
- 1 unconsumed allow (v2-probe-1: request seq 3, decision seq 7, 0 consumptions);
- nested write artifact `tests/mock/tests/mock-outside/probe/v2-probe-1.txt` = `V2-UA-CONTENT`
  (captured: `11c2-nested-write-artifact-v2-probe-1.txt`); repo-level path does not exist;
- mock host scratch under `tests/mock/hosts/` (`repair-r1-pw2/`, `repair-r2-b1r/`, `repair-r2-b2/`),
  `tests/mock/state/boot-state.json` (launch token — gitignored home/state, never printed here).

### 7.2 Red-line compliance (final)

- **Product source / dist: untouched** (diagnosis reads only). **Upstream test-use: pristine**
  (verified pre-boot, postflight, and at consolidation).
- **`docs/plans/active/`, `dev/agent-workflow/graph.yaml`, `SESSION_ROUTER_LOG.md`: untouched**
  (this round is acceptance evidence, not orchestration state; this report is the single new
  evidence file).
- **No push.** No `:3080` operations (GET health probe only, read-only). `D:\deepseek-harness\`
  deployment: zero file operations.
- **No fabricated state**: every ledger fact is model-driven or committed-gate UI-driven; every
  artifact in this directory is captured, not authored.
- **Credentials**: values never printed or copied into evidence; backups stay in the gitignored
  home; `cookie-header.txt` deliberately not copied.

---

## 8. Evidence inventory (this directory)

| File | Content |
|---|---|
| `00-preflight-r2.txt` … `22-f9-policy-check.txt` (+`03w`, `03b`, `03c`, `05b`, `05c`, `11b`, `11c`, `11c2`, `16b`, `21b`) | per-asset output with exact argv (run-asset echo), asserts, results, `EXIT_CODE` lines (several files are UTF-16LE — pwsh 5.1 `Set-Content` — decode with BOM) |
| `11d-consumed-fail-diagnosis.md`, `22b-g4-fail-diagnosis.md` | full FAIL diagnoses (quoted above in §6) |
| `NOTES-r2.md` | worker's full per-asset table, turn ledger, diagnostics, red-line audit |
| `prompts/r2-root-init.md` | verbatim V2 root prompt (142 chars) |
| `args/pending-ua.json`, `args/pending-ua-deny.json`, `args/pending-policy.json`, `args/consumed-absent.json` | `@file` JSON payloads (the r1 quoting-class fix) |
| `tools/run-asset.mjs`, `tools/deliver-r2.mjs`, `tools/forensics-r2.mjs`, `tools/first-messages-r2.mjs`, `tools/tables-r2.mjs` | executor wrappers (exact-argv + `@file`; deliver = HTTP POST; forensics = durable domain reads) |
| `state/boot-state.json` | boot#2 boot-state (launch token present in file — not reproduced here) |
| `state/f9-pending.json`, `state/f9-deny-pending.json`, `state/f9-policy-pending.json` | `f9-check pending` vars (requestId/kind/target/action/toolName=null/correlation/sequence) |
| `state/teamtab-{v2-smoke-g1,f9-g3-pending,f9-g3-allow,f9-g3-deny,f9-g4-policy}.yml` | Playwright aria snapshots (5) |
| `state/ui-gate-*-raw.txt` (×5) | per-gate raw logs (full command sequence, `code=0` per step, PASS/FAIL lines) |
| `screenshots/v2-smoke-g1.png`, `f9-g3-pending.png`, `f9-g3-allow.png`, `f9-g3-deny.png`, `f9-g4-policy.png` | Playwright screenshots (5) |
| `snapshots/v2-campaign-teamtab-v2-smoke-g1.yml` | prior-campaign reference snapshot |
| `REPORT.md` | **this consolidated report** |
