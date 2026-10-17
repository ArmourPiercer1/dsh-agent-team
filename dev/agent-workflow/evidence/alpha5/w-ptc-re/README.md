# W-PTC-RE — PTC 管线 / lsp 池：可续腿 vs 真缺腿（装配可行性复核轮）

writer = W-PTC-RE（one-off worktree `.worktrees/alpha5-ptc-recheck`，branch `alpha5-ptc-recheck`，base `master@aece4f21`）。
liveness 首报（模型行原文）：`You are a coding agent powered by the qwen3.8-flash-next model.`

## 0. 任务口径校正（如实点名）

任务书称 "PTC pipeline/lsp pool 缺腿在 M-04/M-09"。机检矩阵实况 =
**PTC 管线两腿在 M-08**（A1 外层真实进程+内层复入同一管线、A4 保留传输双侧 throw；A2/A3=OS 强制/负控腿，W8 正式轮已由 W4 kit 在册）；
**lsp 池四腿在 M-09**（A1 per-Member pid、A2 策略代际逐出、A3 服务器读中介、A4 跨策略 pid 复用）。
**M-04 = editor 族**（editor_subcommand_map_complete / undo_history_io / editor IO_POLICY_UNSUPPORTED 负控）——不在本 writer 域，未动。

## 1. 每腿三态总表

| 行·腿 | 三态 | 依据 / 复现 |
| --- | --- | --- |
| M-08 A1 外层真实进程 + 内层复入同一管线逐次 Guard | **可续 → 本轮已装配真跑 PASS** | host 自带 NodePtcRuntime（census hasPtcRuntime=true）；row 只装 `presentAs('ptc')` + scoped `defineTool` 见证工具 + `guard`；程序自报 pid=101≠host 38；guard 见证 inner=true、callId=`<root>:ptc:N`、rootCallId==外层 callId、seq 有序；run `runs/ptc-2026-10-17T04-12-17Z/`（9/9 PASS） |
| M-08 A2 per-call OS 拒绝负控 | 本轮不装（W4 域，W8 已在册） | probe ASSERT = NOT-EXECUTED（见 `runs/w-ptc-probe-M-08.log`）；合并 W8 receipt 即闭环 |
| M-08 A3 IO_POLICY_UNSUPPORTED 启动前拒（零 spawn） | 本轮不装（W4 域，W8 已在册） | 同上 |
| M-08 A4 保留传输同名双侧 throw | **可续 → 本轮已装配真跑 PASS（4 侧）** | root/scope `tools.register` 双侧 throw reserved + scope `restrict` deny/allow 两侧 throw reserved（消息全文在 criteria/ptc-state）；纯公开面 |
| M-09 A1 per-Member 独立 pid | **可续 → 本轮已装配真跑 PASS** | 两 member 各 `agent.ctx.isolate('lsp')` 重装 host 自家 barrel，真 `lsp` 工具模型路由；pid 128 vs 187（同 workspaceRoot，各 opens=1）；热复用/仅杀自身/兄弟不受扰 全 PASS；run `runs/lsp-2026-10-17T04-12-12Z/`（12/12 PASS） |
| M-09 A2 策略变更→旧 PID 终止重建 | **真缺（上游 SEAM-GAP）** | 缺公开面：`LspQueryRequest`/stdio `Config` 无策略输入、barrel 无逐出/代际钩子、池键=workspaceRoot targetKey ⇒ 上游需策略输入通道/池键扩展点。复现 = `node probe-gap-lsp-policy.mjs` → `probe-gap-lsp-policy.result.json` gap1；运行时观测复指 `../pr6/SEAM-VERDICTS.md` B4（realm 内两策略标签共享同一 pid=HAZARD） |
| M-09 A3 服务器自身 OS 读经中介 | **需裁决（C-PROC 形状）+ 可继续装配后备** | 装配侧可及（lsp-stdio 经公开 `ctx.subprocess.spawn`，可 per-realm 重装 confined 实现）；但冻结 C-PROC 的 confined provider 无长驻双向管道臂（`RunOutput` one-shot / `SpawnReceipt` 无 stdin Writable），LSP 协议流需 stdin pipe ⇒ 裁决"是否给 C-PROC 开 streaming-pipe arm"。复现 = 同上 gap2 |
| M-09 A4 跨策略同 PID 复用=0 | **需裁决（粒度映射）** | realm 粒度下跨 realm 零复用已观测（LSP-SIBLING-UNTOUCHED PASS），但"跨策略"主张需 策略⇒realm 映射 = Team 裁决（公开面无策略输入，同 A2 根因）⇒ receipt 该字段如实缺席（NOT-EXECUTED） |

**可转腿（本轮绿、可入账 clause）= 4**：M-08 `execution.outer_real_process`、`execution.inner_reentry_same_pipeline`、`transport_same_name_both_sides_throw` + M-09 `pool.per_member_pids_distinct`。
**真缺腿 = 3**：M-09 A2（上游 SEAM-GAP）、A3（C-PROC 裁决）、A4（粒度裁决）。
probe 实况（我的 receipt，pr8 探针亲跑，日志在 `runs/`）：M-08 = PROBE-GATED，缺项点名 [A2, A3]（与 W8-W4 receipt 合并 ⇒ A1–A4 全 SATISFIED ⇒ 行级转态提案值 LIVE）；M-09 = PROBE-GATED，缺项点名 [A2, A3, A4]。矩阵本体一字未动——转态只报协调者走 probe 词表。

## 2. 我实际用过的探针词（原文）

pr8 探针（未改一字，`--repo-root <worktree> --receipt <我的 receipt>`）：

```
node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-08.mjs --repo-root "$PWD" \
  --receipt dev/agent-workflow/evidence/alpha5/w-ptc-re/w-ptc-receipt-M-08.json   # → PROBE-GATED exit=4, 缺 [A2,A3]
node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-09.mjs --repo-root "$PWD" \
  --receipt dev/agent-workflow/evidence/alpha5/w-ptc-re/w-ptc-receipt-M-09.json   # → PROBE-GATED exit=4, 缺 [A2,A3,A4]
```

自有缺口探针（本 writer 所写，DORMANT/零端口/纯只读，对 pinned host 树 porcelain 前后=0）：

```
node dev/agent-workflow/evidence/alpha5/w-ptc-re/probe-gap-lsp-policy.mjs          # → probe-gap-lsp-policy.result.json
```

真跑 runner（W5 模式，端口 3184，世界 `tests/homes/a5ptc-<mode>-<stamp>/`，teardown 删除）：

```
node dev/agent-workflow/evidence/alpha5/w-ptc-re/run-a5ptc-live.mjs --mode ptc
node dev/agent-workflow/evidence/alpha5/w-ptc-re/run-a5ptc-live.mjs --mode lsp
```

## 3. 公开面普查（装配只用这些面，barrel 导出亲验）

- `@deepseek-ai/dsh-tools`（`packages/core/tools/lib/index.js`）：`defineTool`、`ToolRuntime`（`presentAs(mode)`/`register`/`restrict`/`guard`，exec 面 `name/callId/rootCallId/parent/agent`）；`run_code` = 保留 PTC 传输名。
- `@deepseek-ai/dsh-sandbox-policy`：`setSandboxMode(session, mode)` 公开写路径（本环境 host typed 错误自述处方开关）。
- `@deepseek-ai/dsh-lsp` barrel：`Lsp`(default)+`canonicalizeWorkspace` 等；**无** 任何 policy/generation 名（普查 json 在案）。
- `@deepseek-ai/dsh-lsp-stdio` barrel：`LspStdio` plugin + `canonicalizeWorkspace/encodeMessage/…`；spawn=公开 `ctx.subprocess.spawn`；**无** 逐出/代际钩子。
- `@deepseek-ai/dsh-tool-lsp`：`lsp` 工具（hover/goToDefinition/findReferences/goToImplementation）。
- cordis 公开面：`agent.ctx.isolate(label)` per-realm 重装、`ctx.on('tools/execute')` around-seam、profile-patch（`$DSH_HOME/profiles/web/cordis.patch.yml`）装载证据行、`session.create{cwd}`。
- W4 冻结 C-PROC provider（`packages/runtime/sandbox-provider/provider.ts`）：`SpawnReceipt{lease,processIdentity}`、`RunOutput{stdout,stderr,combined}` one-shot——无 stdin 流臂（gap2 证据源）。

## 4. 披露（口径不升格）

- LSP 服务器 = 虚构可全审 stdio fixture（自报 OS pid + open 计数），非真实语言服务器；池/路由/生命周期腿与真服务器同面（lsp-stdio 真代码驱动）。
- PTC 腿策略口径 = 测试世界公开 `setSandboxMode` 切 `danger-full-access`（本执行环境无可用 bwrap/Landlock 后端，首跑如实吃了 typed `sandbox-unavailable`）；OS 强制宣称不在本腿（=A2/W4 域）。
- 外层真实进程证据 = 程序自报 pid≠host pid + 内层调用经 stdio 控制管道往返（进程间协议语义）；kit 的 /proc 采样观察面在最终轮为空数组——如实记录，不作依据。
- 模型路由 = mock 脚本；结果经公开 around-seam 捕获（queue-mode 的 prompt 响应体只回 ack——如实）。
- 世界零生产行装载；teardown 删世界；:3080 稳定实例前后亲验未动（pre=401 token 门、post=401；kit 只绑 3184）；test-use 树 porcelain=0、HEAD=pin 前后一致（P-PIN/P-PRISTINE 在每份 criteria.json）。

## 5. 文件清单

| 文件 | 角色 |
| --- | --- |
| `a5ptc-row.mjs` | 证据装配行（PTC + LSP 两 mode；profile-patch 装载） |
| `fake-lang-server-a5ptc.mjs` | 虚构可审 stdio LSP fixture |
| `run-a5ptc-live.mjs` | LIVE runner（ptc/lsp；预检+判据+收口） |
| `probe-gap-lsp-policy.mjs` (+ `.result.json`) | 真缺腿静态公开面普查（自有探针） |
| `w-ptc-receipt-M-08.json` / `w-ptc-receipt-M-09.json` | 我的 bookable-clause receipts |
| `runs/ptc-2026-10-17T04-12-17Z/` · `runs/lsp-2026-10-17T04-12-12Z/` | 最终绿跑证据（criteria/state/facts/logs） |
| `runs/w-ptc-probe-M-08.log` · `runs/w-ptc-probe-M-09.log` | pr8 探针对我的 receipt 的亲跑输出 |
| `runs/{ptc,lsp}-2026-10-17T03-*/` `04-0*/` | 修复迭代轮证据（保留如实：沙箱后端缺失、render 形状、能力门、cwd 各一） |
