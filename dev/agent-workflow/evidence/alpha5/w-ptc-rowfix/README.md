# W-PTC-ROWFIX — #290 台账按 OUTER 真值改写（M-08 → PROBE-GATED）

writer = W-PTC-ROWFIX #290（一次性 worktree `.worktrees/a5ptc-rowfix`，branch **`alpha5-ptc-rowfix`**
从 `alpha5-ptc-outer` tip `06c3b502`（含 fetch 基 `2bd9b2e2`）新起）。
liveness 首报（模型行原文）：`You are a coding agent powered by the qwen3.8-flash-next model.`
零端口、零世界、零宿主实例：本轮全部动作 = 只读观测（probe/runner 纯 fixture/记录级）+ 台账改写；
`:3080` 稳定实例 GET pre=401/post=401 零触碰；零 Core 改、零私有 API、零网络放宽、零权限扩。

## 0. 根口径（06:53Z，root）

外层已证实**原计划范围内**缺 per-call Grant 注入 + net 无任何 OS 覆盖（W-PTC-OUTER 三态裁决
= 分支③ PROBE-GATED + 精确局部阻塞，证据 commit `348f9989` / 收口件 `2bd9b2e2` / 独立 reviewer PASS
`06c3b502`，canonical `w-ptc-outer/runs/outer-2026-10-17T06-34-21Z` 27/27 判据 + 8 INFO exit=0）
⇒ 矩阵 M-08 行**不得**带 TRANSITIONED-LIVE 值合入。

## 1. 改写内容（machine + doc 双矩阵同步）

1. **行级 current_status=PROBE-GATED**：`pr8/matrix-machine.json` 与
   `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json` 的 M-08 行
   `pending_probe.status_now`：`TRANSITIONED-LIVE` → `TRANSITIONED-PROBE-GATED`（词表内合法值；
   行级 `current_status` 列仍=`s0-strict-disabled-pending-poc`，S0 登记态不因本行改动，
   carried_current_status↔doc 对应关系经 lint 亲验无漂移）。
2. **精确局部阻塞入册**（OUTER 三态裁决逐字，machine transition_record.precise_local_blocker）：
   「外层进程的可信文件域只能整程序级（mode 粒度）给定，公开 seam 无法把 per-call Grant 注入外层
   bootstrap；网络效果无任何 OS 机制覆盖。」+ 最小复现三条（`run-a5ptc3-outer.mjs --realm-only` /
   `invert-check.mjs --run-dir runs/outer-2026-10-17T06-34-21Z` / `probe-M-08.mjs`）。
3. **C2 的 COMPOSED-LIVE 全部收窄** =「仅内层 per-call 载荷执行边 LIVE-observed」：官方 receipt
   `pr8/probes/receipts/M-08.receipt.json`（chain/caliber/not_observed/post_adjudication_0653z/
   prior_rounds_note）+ C2 轮 twin `w-ptc-c2/w-ptc-c2-receipt-M-08.json`（twin 同步）+
   `w-ptc-c2/README.md`（标题/§6 + 文首收窄注记）。内层证据原样保留、在收窄口径内成立；
   不构成外层防护证据（S0:55 禁止路径『以「内层 guard 通过」替代外层防护』）。
4. **整行保留默认 typed 拒证据**（workspace-write fail-closed）：LIVE 默认姿态 typed
   sandbox-unavailable 逐字原文 + 整程序级 fail-closed 于 spawn 前 + approval/asked 审批门
   （`w-ptc-outer/runs/outer-2026-10-17T06-34-21Z/legA-state.json` + `pr290-comment.md` §1）
   入 transition_record.default_posture_refusal_retained.evidence_refs；行级 PROBE-GATED 不削弱该证据。
5. **withdrawn_live_proposal 留痕**：C2 轮 LIVE 提案（626daeec/c0333d8f）+ 04:57Z 拼 receipt 不予采纳
   注记全部保留，撤回理由=06:53Z 口径。

## 2. probe M-08 重跑 = 按其自身词表如实落

- **改判据注记在前**（root 预授权分支：probe 原判据与 S0:55 存在差异——A1–A4 全部只覆盖内层
  per-call 载荷执行边，S0:55 未测项明文含「外层直接 fs/net OS 级拒绝负控」+ design:123/125/66/191/
  214/22/21 = 原计划受控对象）⇒ 以计划口径为准补 **A5-outer-direct-io-os-denial**（收紧判据，
  receipt 须带 `outer_direct_io_os_denial=true`，net 腿须独立 OS 机制覆盖证明；不硬凑 verdict）。
- 重跑（`probes/runs/w-ptc-rowfix-probe-M-08.log`）：A1–A4 SATISFIED（内层边保留）+
  **A5 NOT-EXECUTED**（receipt 字段缺位=该观测腿在装配面不存在的如实登记）⇒
  **VERDICT PROBE-GATED exit=4** + MINIMAL-REPRO——正是 probe 自身词表的
  「断言未闭环 ⇒ 保持门禁不猜」分支，与预期一致。
- baseline 对照（改判据前，同 receipt）：VERDICT LIVE exit=0——即差异实证：原判据判据集≠计划口径。

## 3. runner 复跑（亲验分桶，分布原文入册）

- 改前基线（未动树）：`PASS=24 FAIL=0 NOT_RUN=3 REQUIRES-LIVE-WIRING=0 LIVE=2 PROBE-GATED=3 TOTAL=32`
  exit=0（LIVE 桶含 M-08）→ `pr8/runner/runs/matrix-run-2026-10-17T07-02-58-523Z.{json,log}`
- 改写后复跑：结构 lint OK；M-08 行 `PROBE-GATED … repro=…/probe-M-08.mjs`（transition_record 复走
  亲验位）；分布原文：

  ```
  PASS=24 FAIL=0 NOT_RUN=3 REQUIRES-LIVE-WIRING=0 LIVE=1 PROBE-GATED=4 TOTAL=32
  ```

  **M-08 归 PROBE-GATED 桶（M-04/M-05/M-08/M-09）；LIVE 桶=M-13 唯一，不含 M-08。** exit=0。
  → `pr8/runner/runs/matrix-run-2026-10-17T07-05-19-632Z.{json,log}`；回填分布行后终验复跑
  `matrix-run-2026-10-17T07-05-32-671Z.{json,log}` 同分布 exit=0。
- runner 自测套件复跑：**35 pass / 0 fail**（`pr8/runner/runs/w-ptc-rowfix-selftest.log`）。
- runner 计数不再把 M-08 算完整受控：`transition_record.runner_distribution` + 行
  `runner_distribution` 字段原文在册。

## 4. 文件清单（本轮改动）

| 文件 | 动作 |
| --- | --- |
| `dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json` | M-08 行改写（status_now/transition_record/note/runner_distribution） |
| `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json` | M-08 行同步（status_now/note/untested_carried_over/notes） |
| `dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-08.mjs` | 判据对齐注记 + A5 补条（收紧） |
| `dev/agent-workflow/evidence/alpha5/pr8/probes/receipts/M-08.receipt.json` | COMPOSED-LIVE 收窄 + not_observed/post_adjudication_0653z |
| `dev/agent-workflow/evidence/alpha5/w-ptc-c2/w-ptc-c2-receipt-M-08.json` | twin 同步（同收窄） |
| `dev/agent-workflow/evidence/alpha5/w-ptc-c2/README.md` | 收窄注记 + §6 判定行改写（历史正文保留） |
| `dev/agent-workflow/evidence/alpha5/pr8/vnext-migration-gap-checklist.md` | C-06 / probe 表 M-08 行同步 #290 口径 |
| `pr8/probes/runs/w-ptc-rowfix-probe-M-08.log` | probe 重跑原文（PROBE-GATED exit=4） |
| `pr8/runner/runs/matrix-run-2026-10-17T07-02-58-523Z.*` | 改前基线复跑 |
| `pr8/runner/runs/matrix-run-2026-10-17T07-05-19-632Z.*` `07-05-32-671Z.*` | 改写后复跑 + 终验 |
| `pr8/runner/runs/w-ptc-rowfix-selftest.log` | 自测 35/35 |
| `SESSION_ROUTER_LOG.md` | 只追加条目 |

## 5. 未做（如实）

- 未改任何 Core/packages 源码、未动 W4/W5/W7 装配面、未动 probe-lib 判据骨架（A5 只挂在 M-08 spec 内）。
- 未跑宿主/端口（本轮无需：外层边真值表已在 w-ptc-outer 在册，本轮只做台账按真值改写+机检复跑）。
- 其余未测项（并发 Member 不同 one-shot、父取消/子调用排空 drain）不变，继续在行 untested_carried_over 在册。
- 行级终裁仍归 PR8 正式轮 + 独立 reviewer；`final_declaration` 恒 null 不变。
