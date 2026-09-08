# Round r4 — complete live V2 acceptance matrix (F3 / F11 / F9 / T1.4): notes

**Run**: 2026-09-08, 17:19–17:58 local (+08:00), by the delegated live-acceptance subagent.
**Mandate**: execute the complete committed V2 live acceptance matrix for F3/F11/F9/T1.4 from
`D:\AgentDev\dsh-plugins\dsh-agent-team` on the persistent world
`tests/mock/.dsh-home-repair-r1` (host 3181, mini-MCP 3491/3492, model
qiyuan-self/qwen3.8-27b), fresh preflight/selftest/version-gate, real model + browser state only,
no fabrication; evidence under `live-round-r4/`; credentials secret; stable :3080 /
`D:\deepseek-harness` / upstream / active plans / graph / router log untouched; no push.

## 1. Exact environment

| Item | Value |
|---|---|
| Repo / cwd | `D:\AgentDev\dsh-plugins\dsh-agent-team`, main `int/repair-r1` @ `c0f9150` (zero tracked modifications at start and end) |
| Task branch | `task/repair-r1-g4-recipe-fix` @ `f1b1add` (worktree `.worktrees\repair-r1-g4`); `git diff c0f9150..f1b1add -- tests/mock/scripts` = exactly `f9-check.mjs` + `prompts/b6-req.md` |
| DSH home | `tests/mock/.dsh-home-repair-r1` (persistent world, NOT recreated) |
| Model route | home `settings.yaml` → `agent-default-model: qiyuan-self / qwen3.8-27b` (apiKeyEnv ref, redacted); boot state `keyConfigured=true`; this subagent session model qwen3.8-27b |
| Node | v24.20.0 (`C:\nvm4w\nodejs`) |
| playwright-cli | 0.1.19, session `mocktest`, ABSOLUTE `PWTEST_DAEMON_SESSION_DIR=D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.playwright-cli\daemon` |
| Ports | host 3181, facet 3491, host 3492 — all free pre-boot and post-kill |
| test-use | `references/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`, porcelain empty pre and post |
| Stable instance | `:3080` GET-probed only (→ 401 both times) |

### Client bundle provenance (verified live, not assumed)

Boot logs record `client bundle serve … bytes=954324` for the plugin-row URL. A live fetch of the
exact URL the browser requests returned **959,121 B**; the on-disk
`packages/client/composition-shim/client-bundle.js` is **959,026 B** (LastWriteTime unchanged since
the F9U build). Byte comparison: the on-disk file is an exact prefix of the served bytes — the
plugin module pipeline appends a 95 B wrapper; content is byte-identical. All fix markers verified
present in the served bytes: `data-external-policy` ×4, `externalPolicy.teamDecision` ×3,
`被托管策略阻止`, `data-ledger-fact`, `data-intent-create`, `data-new-team-entry`,
`data-intent-compatibility`, `CONTROL_EXTERNAL_POLICY_DENIED`, `data-ledger-load-earlier`,
`data-ledger-remaining`. (Copy: `state/served-client-bundle-r4.bin`.)

## 2. THE round's key adaptation — FRESH root inside the same persistent home

**Decisive world-state fact**: `requestControl` (`packages/runtime/control/service.ts` L685–777) is
idempotent on the scopeKey `(root, targetInstanceId, actionName, toolName, correlation)` and returns
the EXISTING row (decided or pending). The persistent home's r2/r3 team (root
`session-dtestmts69xkr6b54`) already has ALL committed F9 correlation tokens
(`dtest-v2-req-ua-1/2`, `dtest-v2-req-la-1/2`, `dtest-v2-req-self-1`, `dtest-v2-hard-req-1/2`)
decided or pending ⇒ every committed G3/G4 recipe would return an existing row — the G3/G4 rows are
structurally un-runnable on the old root (no NEW pending request can be created).

**Decision**: boot#1 ran WITHOUT `MOCK_ROOT_SESSION_ID` ⇒ fresh root
`session-dtestmtsgjlo4a725` (new team A) inside the same persistent home. This matches the V2
fresh-world precondition, requires **zero committed-asset modification**, and keeps every durable
bracket (pre/post state) inside one home. The fresh root is not in `workspace.json`
(only `session-dtestmts5d068d576` is bound) ⇒ it appears under the collapsed `未分组` sidebar group;
r2 precedent proves the gates work there, and the r4 sidebar check (§6.3) additionally proved
`pickRef` resolves the committed `rootText` to the fresh root (first DOM match = most-recent
activity).

## 3. Boot sequence

| boot | label | env | directive | result |
|---|---|---|---|---|
| #1 | `repair-r4-b1` | `MOCK_DSH_HOME` (abs), `DSH_CLIENT_COMMIT_HASH=a66e470204`, NO root id, NO hard tools | `boot=1 phase=create root=session-dtestmtsgjlo4a725 hardTools=false` | MOCKBOOT_READY, keyConfigured=true, 4 rows true, toolCount=10 |
| #2 | `repair-r4-b2` | + `MOCK_ROOT_SESSION_ID=session-dtestmtsgjlo4a725`, `MOCK_HARD_TOOLS=1` | `boot=2 phase=resume root=session-dtestmtsgjlo4a725 hardTools=true` | MOCKBOOT_READY, liveSessions = team A root + W1/W2 children |

Boot#1 idle-kill: first-try success (R-B7 observation: clean). Boot#2 idle-kill: first-try success.
Redacted copies: `01-boot-b1-console-redacted.txt`, `state/01-boot-state-b1-redacted.json`,
`30-boot-b2-console-redacted.txt`, `state/30-boot-state-b2-redacted.json` (token-fragment scan: 0 leaks).

## 4. Per-asset results (exit codes)

| # | asset / invocation | result | exit |
|---|---|---|---|
| 00 | env baseline (ports free, :3080→401, main tracked-clean, task 2-file diff, test-use pristine, bundle 959,026 B, 0 daemons) | all green | 0 |
| 02 | preflight #1 (fresh root) | 8 PASS, 0 WARN, 0 FAIL — CLEAR | 0 |
| 03 | `f9-check selftest` | 23 PASS, 0 FAIL | 0 |
| 04 | `f9-check version-gate` #1 | 5 PASS (v4 alive, spoof closed) | 0 |
| 05 | root-init turn (r2-root-init.md → fresh root) | watchdog OK turn=1, 34,158 ms; W1+W2 created | 0 |
| 06 | team A forensics | W1 `inst-1j499i010e86` / W2 `inst-042zjep11mrw` (children `…b50874…`, `…d82573…`), gen=4, facts seq 18–19 | 0 |
| 07 | **G1 UI smoke** (`smoke-g1.json`) | PASS 3/4-asserts (W1, W2, 时间线); snapshot verified NEW W1/W2 inst present, legacy W1 absent | 0 |
| 08 | b4-requests turn (→ W1-A) | watchdog OK turn=1, 68,750 ms | 0 |
| 09 | W1-A turn-1 raw tool calls | 4× `team_request_control` verbatim (ua-1/la-1/la-2/self-1) + self-resolve attempt | 0 |
| 10 | `pending {kind:user-approval}` | exactly 1 — `ctrl-153npqu1woai9n1p30nr41dv`; vars written | 0 |
| 10b | self-resolve result | `rejected` `CONTROL_RESOLVER_NOT_AUTHORIZED` (member ∉ {leader, human}) — expected | — |
| 11 | **G3 UI pending** (`f9-g3-pending.json`) | PASS 4/4 (§26.2 detail fields) | 0 |
| 12 | **G3 UI allow** (`f9-g3-allow.json`) | PASS 4/4 (clicked; bar gone; decision row 允许/Allowed; 0 error chips) | 0 |
| 13 | `decided --expect allow` | PASS | 0 |
| 14 | exec turn (t41-exec.md → root) | watchdog OK turn=2, 42,381 ms; root: 1× `team_follow_up` token `dtest-v2-ua-exec` | 0 |
| 14c/d | W1-A turn-2 write | `write` + read-back verbatim `V2-UA-CONTENT` — see §5.3 path note | — |
| 15 | `consumed` (allow half) | **FAIL — expected 1 control-allow-consumed fact, got 0** (documented F10-class asset-expectation boundary; identical to r2; repair-plan item 4: preserve + document, semantics unchanged) | 1 |
| 17 | deny-req turn (t41-deny-req.md → W1-A) | watchdog OK turn=3, 12,250 ms; verbatim token `dtest-v2-req-ua-2` | 0 |
| 18 | `pending {kind:user-approval,out:…deny…}` | exactly 1 — `ctrl-14to41v1wya3ym1pwzgu11d1` | 0 |
| 19 | **G3 UI deny** (`f9-g3-deny.json`) | PASS 4/4 | 0 |
| 20 | `decided --expect deny` | PASS | 0 |
| 21 | `consumed {expectAbsent:true}` | PASS — zero facts (deny half: no side effects) | 0 |
| — | negative check | `v2-probe-2.txt` ABSENT at both candidate paths | 0 |
| 22 | **T1.4 UI create** (committed client surface) | overlay → `select[data-intent-blueprint]=dtest-bp` (React native setter + change) → revision auto `1` → workspace `mock` → `data-intent-status=OPEN` (兼容性✓ 就绪; **T14-H fix holds — no BLOCKED_FATAL on the mcp requirement**) → `button[data-intent-create]` clicked → overlay gone, `data-intent-error` null | 0 |
| 23 | durable verify | NEW `team_sessions` row `session-33d7038c-b841-49ec-9b3f-5a762b23f548` (dtest-bp@1, revision "1", same contentHash, gen=1, 09:34:29Z); pre-existing 3 rows untouched | 0 |
| 24 | team-B setup turn (round prompt tb-setup.md) | watchdog OK turn=1, 28,156 ms | 0 |
| 25 | team-B forensics | W1 `inst-1e0gj1v1lbkc` (child `…c53238…`), gen=3, 1 fact (seq 31) | 0 |
| 26 | fill batch 1 (tb-fill-1.md) | leader turn=2, 39,207 ms; 5× `team_follow_up` verbatim tokens `dtest-fix-1-1..5`; W1-B turns 1–5 | 0 |
| 27 | fill batch 2 (tb-fill-2.md) | leader turn=3, 30,168 ms; tokens `dtest-fix-2-1..5`; W1-B 10 turns | 0 |
| 28 | fill batch 3 (tb-fill-3.md) | leader turn=4, 45,375 ms; tokens `dtest-fix-3-1..5`; W1-B 15 turns | 0 |
| 29 | fact count | **team B ledger = 61 facts (≥ 50 required)**; tail seq 91 | 0 |
| 31 | preflight #2 | 8 PASS — CLEAR (`mockRow=sessions=2` — see §6.2) | 0 |
| 32 | `version-gate` #2 | 5 PASS | 0 |
| 33 | G4 pre-state `pending {root,toolName:"write"}` (worktree f9-check) | **0 matches** — discriminator empty pre-live; the fixed no-match hint prints | 2 (expected) |
| 34 | b6-req turn (WORKTREE b6-req.md → W1-A) | watchdog OK turn=4, 20,535 ms; single `team_request_control` with **`toolName:"write"`** + token `dtest-v2-hard-req-2` | 0 |
| 35 | live `pending {root,toolName:"write",out:…}` (worktree f9-check) | **exactly 1** — `ctrl-0kftvcz0zi8w5w1k31au10eg`; vars written | 0 |
| 36 | **G4 UI policy** (`f9-g4-policy.json`) attempt 1 | FAIL — navigation miss, wrong root clicked (§6.2); NO click, NO mutation | 1 |
| 36b | **G4 UI policy** retry (one documented mock-group collapse aid) | **PASS 4/4** — allow clicked; bar gone; 0 error chips; §26.4 frozen row in snapshot: `团队裁决：已允许` / `执行：被托管策略阻止` (deny · external-policy, rid visible), no plain 拒绝/Denied | 0 |
| 37 | `policy --request-id` (worktree f9-check) | PASS — deny + reason=external-policy + decider=human + zero consumption | 0 |
| 38a | `suite-ledger-complete` team A (default root) | PASS — 1 page, serverTotal=15 = durable 15, tail 93 | 0 |
| 38b | `suite-ledger-complete --root <teamB>` | PASS — **2 pages**, serverTotal=61 = durable 61, tail 91 | 0 |
| 39b | **G5 UI** (round-local `g5-f11-teamB.json`) attempt 1 | FAIL — round-local config bugs (§6.4); no product mutation | 1 |
| 39c | **G5 UI** retry (fixed round-local config) | **PASS 5/5** — rows=61 == durable total; no `[data-ledger-remaining]`; no `[data-ledger-load-earlier]`; last row `data-ledger-fact` = durable tail `member-lifecycle-changed`; first row = durable head `provision-member-instance` | 0 |
| 41 | postflight | ports 3181/3491/3492 free; :3080 GET → 401; test-use @ a66e470204 porcelain empty; main tracked mods **0**; playwright `mocktest` closed, 0 residual processes | 0 |
| 41 | credential scan | 86 evidence files: boot-token#1 hits 0, boot-token#2 hits 0, key-pattern hits 0, cookie-header copies 0 | 0 |
| 42 | durable post bracket | facts per team 0/17/15/61; pending sets A={seq 21,22,23} B={} legacy={5,6,14}; global max seq 93 | 0 |

Model turns: 25 (root-init 1, b4 1, exec root+W1 2, deny-req 1, team-B setup 1, fill leader 3 +
W1-B 15, b6 1).

## 5. No fabricated state

Every new durable fact is model-driven or committed-gate UI-driven:

- team A (fresh root): root-init members (05/06); all 6 control requests (09, 17b, 34b — raw tool
  calls cited); decisions 3 (allow UI 12, deny UI 19, policy-deny UI 36b);
- the exec write (14): model `write` tool, verbatim content verified by model read-back (14d);
- team B (T1.4): created by the committed UI create flow (22); its W1 + 15 fixture turns + 61
  facts are all model turns (24–29);
- no ledger/registry file hand-edited; no request created via API; no boot-state/vars file seeded
  (all produced by the runs).

### 5.3 Probe-write path resolution (world-state fact, not a defect)

The recipe's relative path `tests/mock-outside/probe/v2-probe-1.txt` resolves against the member
session's cwd (`tests/mock`) ⇒ the file landed at
`tests/mock/tests/mock-outside/probe/v2-probe-1.txt` (13 B, verbatim `V2-UA-CONTENT`; copy in
`state/v2-probe-1.txt`). W1's turn log shows the write tool reporting exactly that resolved path
(step 1: overwrite-guard read-first error on the resolved path; step 3: Updated file; step 4:
read-back `V2-UA-CONTENT`). Same resolution semantics as r2.

## 6. Infra / navigation findings (none product, none committed-recipe)

1. **§6.1 per-process env** — every `MOCK_DSH_HOME`-dependent script set the env in the same
   pwsh invocation (fresh process per call). No misses this round.
2. **§6.2 sidebar ambiguity introduced by T1.4 (G4 attempt 1)**: the committed G4 gate's
   `rootText` `请初始化团队` matched, in DOM order, the **team-B root first** — T1.4's UI create
   bound team B to the `mock` workspace group, which renders above `未分组`, and team B's root
   title shares the prefix (`请初始化团队：先用 team_create_member…`, truncated at 22 chars to
   `…team_create_`). Attempt 1 therefore clicked the wrong root; the snapshot proves it (team-B
   root `[selected]`, zero ledger rows, no resolve bar ⇒ clickEval `'false'`, decision-row assert
   failed; no button existed ⇒ NO click, NO mutation). **Fix**: one manual raw-eval click
   collapsing the `mock` group (navigation aid, symmetric to r3 §4.3's group expand), then the
   UNCHANGED committed gate ran and passed 4/4 — team-A root selected (snapshot: `[selected]`,
   inst-1j499i010e86 present, team-B inst absent). Recorded for a possible future gate hardening
   (e.g. workspace-aware rootText); NOT part of any diff.
3. **§6.3 fresh-root disambiguation verified**: before any gate, a real browser inspection
   (snapshots `sidebar-inspect-r4.yml`, `sidebar-ungrouped-r4.yml`) showed `未分组` DOM order =
   [fresh root (1分钟), W1-legacy child, legacy root (1小时)] ⇒ `pickRef` first match = fresh
   root. No home-state surgery was needed (workspace.json untouched).
4. **§6.4 round-local G5 config bugs (attempt 1)**: (a) `rootText` longer than the 22-char
   truncated sidebar title ⇒ NO REF (page state correct — mock group was expanded); (b) fact-type
   values interpolated unquoted into `=== {{tailFact}}` ⇒ JS `ReferenceError` (the gate's falsy
   token test did not catch it — same false-PASS class r3 §4.3 recorded; overall verdict was still
   safe because the row-count assert FAILED). Fixed in the round-local file only
   (`rootText` prefix `…team_create`; JSON-quoted values). Committed `ui-gate.mjs` unchanged.
5. **§6.5 console mojibake**: pwsh 5.1 console shows UTF-8 CJK as mojibake and `Get-Content`
   default-decodes UTF-8 files as GBK — display-only; all evidence files written UTF-8 (BOM-free
   where node/JSON consumes them — PS `Set-Content -Encoding utf8` emits a BOM that breaks
   `JSON.parse`; BOM-free rewrites recorded where needed).
6. **§6.6 boot-log bundle byte count**: the `bytes=954324` log line is a transient boot-time
   measurement; the live fetch of the same URL is authoritative (959,121 B = disk bundle + 95 B
   wrapper, §1). No content drift.

## 7. Residual world after the round

- `team_sessions`: 4 rows — `session-dtestmts5d068d576` (facts 0), legacy `session-dtestmts69xkr6b54`
  (facts 17, pending {5,6,14} — unchanged by this round), **fresh team A
  `session-dtestmtsgjlo4a725`** (facts 15; pending leader-approvals {seq 21,22,23} = la-1/la-2/self-1;
  decided: ua-1 allow, ua-2 deny, hard-req deny/external-policy), **team B
  `session-33d7038c-b841-49ec-9b3f-5a762b23f548`** (facts 61, pending {}).
- Global sequence max = 93.
- Mock host killed cleanly (both boots, first-try idle kills); ports free; playwright `mocktest`
  closed; stray files: none (state dir artifacts are gitignored round state).

## 8. Reproduce (key invocations)

```powershell
# cwd = repo root; every invocation sets its env inline (fresh pwsh processes!)
# boot#1 (fresh root):
$env:MOCK_DSH_HOME='D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.dsh-home-repair-r1'
$env:MOCK_BOOT_LABEL='repair-r4-b1'; $env:DSH_CLIENT_COMMIT_HASH='a66e470204'
node tests/mock/scripts/boot.mjs                 # background; NO MOCK_ROOT_SESSION_ID
# checks:
node tests/mock/scripts/preflight-check.mjs      # 8 PASS
node tests/mock/scripts/f9-check.mjs selftest    # 23 PASS
node tests/mock/scripts/f9-check.mjs version-gate# 5 PASS
# root-init (arm watchdog on root log FIRST, then):
node <ev>\tools\deliver-r2.mjs <freshRoot> <r2 ev>\prompts\r2-root-init.md
# G3 allow: b4-requests → W1 child; pending {kind:user-approval}; ui-gate f9-g3-pending/allow;
#           decided --expect allow; t41-exec → root; consumed (expected F10 FAIL)
# G3 deny:  t41-deny-req → W1 child; pending {kind:user-approval,out:…}; ui-gate f9-g3-deny;
#           decided --expect deny; consumed {expectAbsent:true}
# T1.4:     browser overlay → blueprint dtest-bp → workspace mock → status OPEN → create
# F11:      tb-setup → team-B root; 3× tb-fill-N (600s watchdogs); suite-ledger-complete A + --root B
# boot#2:   + $env:MOCK_ROOT_SESSION_ID='<freshRoot>'; $env:MOCK_HARD_TOOLS='1'
# G4:       <worktree f9-check> pending {root,toolName:"write"} pre(0)/live(1);
#           deliver <worktree b6-req.md> → W1-A child;
#           ui-gate f9-g4-policy.json (ABSOLUTE daemon dir; collapse mock group if team-B root
#           shadows the rootText — §6.2); <worktree f9-check> policy --request-id <rid>
# G5:       round-local args/g5-f11-teamB.json + state/f11-g5-vars.json (quoted fact types)
```
