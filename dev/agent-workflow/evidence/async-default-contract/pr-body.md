# async-default 工具契约：`team_delegate` / `team_follow_up` 不带 `async` 参数时默认异步执行（2026-09-27 用户裁决）

**基座**：master @ `1fb5f351`（PR #31 merge 点；已 rebase 至新 master，见文末 rebase 节）｜ **分支**：`task/async-default-contract`（4 提交）｜ **merge 裁决归用户**

## 概述

用户裁决（2026-09-27）：**「不带 async 参数时，默认异步执行」**。本 PR 翻转 MODEL-FACING 面默认：

- `team_delegate` / `team_follow_up` 在 `async` **省略**（或 `true`）时**默认 ASYNC**：调用在 Phase A 持久接纳提交后即返回（响应 effect 携带 `workStatus: 'admitted'`、`settled: false`、无结果），工作单元在 Team runtime 中解耦运行；终态经 `team_collect` 读回（持久成员结果跨重启存活，CCR-5）。
- **仅显式 `async: false`** 进入同步 alpha.2 行为（调用阻塞全链，结果 in-band）——描述中保留 approval-gated caveat（Leader 无法在阻塞 turn 内解决成员 approval）。

**Option B（范围决策）——仅 tool 层契约翻转**：

- tool 层**总是显式发送**闭合 `execution` 值（`args['async'] === false ? 'sync' : 'async'`）；
- facade `TeamRuntimeActionRequest.execution` 语义**不变**（absent = sync；CCR-1 对直接调用方保持；~60+ runtime facade 测试零触碰）；
- 裁决仅取代 CCR-1 的**模型面**默认；科学理由记录于 `tools.ts` 模块 doc + `admission/types.ts` 注记。

## 变更

**核心契约**（提交 1）
- `packages/tools/src/tools.ts`：模块 doc async 节（2026-09-27 裁决 + Option B 注记）/ `ASYNC_ARG` "Optional (default true when omitted)" + approval caveat / delegate、follow_up 描述 "Asynchronous by default… Pass async: false for the synchronous behavior" / 两 run 块显式 `execution`。
- `packages/runtime/admission/types.ts`：`WORK_EXECUTION_MODES` 裁决注记（facade 语义不变）。
- `packages/tools/test/issue1-collect-tools.test.ts`：T2 重构为**无 async 参数**的默认-async 路径（receipt → detach → collect 读回）+ 2 新 `it`（`T2-default-receipt` / `T2-default-detached`）；T6 显式 `async: false` 同步 pin 保留。
- `.agents/skills/team-leader-operations/SKILL.md`：§2 `async`（omitted 默认 true）/ §3 步骤重排（3 = async 默认，4 = `team_collect` 读回，5 = 显式 `async: false` opt-in + approval caveat）/ §5.1 更名 "keep approval-gated work on the async default" / §7 mistake 更新。

**实宿主验证中发现的 0.1.7 不兼容修复（wake 路径，独立提交 2）**

wakeup kit 重适配 0.1.7 后实跑发现：**work-completion wake-up（PR #21 特性）与 0.1.7 宿主不兼容 —— U8 垂直 75/75 无 wake leg，此前从未被 0.1.7 实跑暴露**。根因（源验证）：glue `deliverRootWorkCompletionNotification`（`packages/runtime/src/plugin/live/agent-bindings.mjs` 唯一 plugin-kind 消息点）以 `source: { kind: 'plugin', plugin: 'dsh-agent-team' }` 创建唤醒消息；0.1.7 session-format-v4 admission（`session-format-v3-to-v4/src/message-sources.ts` L7–10）**拒绝退役的 `kind: 'plugin'` wrapper**（"format v4 message requires a producer-owned source kind"）→ 唤醒消息 materialization 失败 → `team.create` 报 `TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED` + idle Leader 永不唤醒。

0.1.7 `MessageSourceMap` 设计明示（dsh-llm `message.ts` doc）："each producer declares its own kind in its own module; **there is NO shared catch-all `plugin` kind**"，consumer 对未知 kind fall through。修复：

```js
source: { kind: 'team-work-settled' }   // 原 { kind: 'plugin', plugin: 'dsh-agent-team' }
```

producer 自声明 kind 命名事件（与 `[team-work-settled requestToken=…]` 通知信封一致）；模型可见文本零变化；全仓 grep 无 source-kind 消费方；glue 测试 G3 断言更新（15/15 PASS）。**无此修复，"async 默认" 在 0.1.7 上 = Leader 默认收不到完成唤醒 —— 契约变更与 wake 修复同属一个可交付结果。**

**kits 对齐**（提交 3）
- `tests/kits/work-completion-wakeup-smoke/`：L1 改**无参**默认-async live pin + L4 显式 `async: false` 同步 pin（L2/L3 显式 async 保持）+ 0.1.7 重适配 ×5（baseline pin `46a7f68b09` / preset `standard` 宿主自带（user-preset seam 消失，行为中性）/ `tools.restrict()` fail-closed ×2（13 工具 catalog + `subagent` 不入 deny）/ 双 wire mock 解析（0.1.7 tool_result-in-user-message）/ header WIRE NOTE）。
- `c1-leader-approval-smoke`：Team Y 显式 `async: false` + S6 指引（kit 保持 0.1.5 pin，重适配 = follow-up）。
- `rc2-real-host-smoke`：B/C delegate 显式 `async: false`（同 follow-up 状态）。

**簿记 + 证据**（提交 4）：SESSION_ROUTER_LOG 2026-09-27 条目 / graph.yaml 新块 + current_phase（含 PR #29 已 merge @ `4fb79fca` 修正 + 1 处既有 YAML 语法纯修复）/ STATUS.md 2026-09-27 行 / evidence（token scrub 后）。

## 本轮新发现 0.1.7 差异（延续 U8 15 项清单，#16–#20，零 upstream 修改）

1. **#16** agent-preset registry 不再注册 user-preset 目录（`HOME/.agent-presets` seam 消失；roster = 宿主自带 `standard`/`ptc`/`minimal`/`cordis`）→ kit 用 `standard`。
2. **#17** `tools.restrict()` 对未知 global 工具 fail-closed（0.1.7 根面 39 工具含 `subagent` = per-agent own-layer 安装；team_* = session-scoped 不可 deny）→ kit 13 工具 catalog + deny 21→19。
3. **#18** LLM wire：tool 结果以 `role:'user'` 消息内 `{type:'tool_result'}` block 承载（0.1.5 = 独立 `role:'tool'` 消息 + 字符串 content；源验证 0.1.5 vs 0.1.7 `serialize.ts`）→ mock 双 wire 解析。
4. **#19** session log V4 生产者自有 source-kind admission（空 kind 或 `'plugin'` 拒绝；其他非空 kind 接受）。
5. **#20** wake glue `kind:'plugin'` 被拒（#19 的插件侧实例 = **本轮唯一插件代码修复**）。

## 门禁（wake 修复后全复测）

| 门 | 结果 |
| --- | --- |
| typecheck | 8 包全绿（legacy 自 PR #30 起 noCheck by design = 新基线 8 包） |
| build + build:composition | 9/9 全绿 |
| check:artifacts | **OK 1196 零漂移**（新基线 1196；本 PR 9 dist 产物 = 8 契约 + 1 wake 修复，同提交入库） |
| 根套件（rebase 后 clean run） | **9F\|19F\|3995P(4014)** — 失败集与新基线债务子集（PR #31 S6 记录 9F/19T）**逐文件逐测试相同**（p7t6-teammates-adapter 已由 PR #30 修复出列；+2P 新 T2 its 在列）。rebase 前（base `4fb79fca`）= 10F\|20F\|3838P(3858) 与旧基线逐字节相同；第二跑 23F = +3 p6t1-parallel 类 E 负载 flake（F7-1 既有并发竞态，隔离重跑 9/9 ×2 全过，仅留痕不修） |
| lint | **61 (新基线) vs 本 PR 逐项 file/line/rule diff = IDENTICAL（0 new, 0 gone）**（rebase 前 = 53 vs 旧 master IDENTICAL） |
| p4t6 | **10/10**（新基线 pin 含 #30/#31 增量；本 PR 无新 scanner-visible 文件） |
| zero-core | test-use porcelain 空 @ `46a7f68b09`（kit 每轮自证） |
| 稳定实例 | :3080/:3180 只读探针 pre==post 401（kit 自证） |

## 实宿主验证（wakeup kit，0.1.7 pristine world）

**终判 = run6 VERDICT PASS 23/23** @ world `tests/homes/wcn-smoke-2026-09-27T04-49-48`（teardown 自清）：

- **L0** discovery（surface 39 / 13 工具 catalog / deny 19）；
- **L1 无参 delegate 默认 async**（admitted + turn 结束）→ **自动唤醒**（token-leading `[team-work-settled …]` 通知，无用户输入）→ `team_collect` 持久结果（`WCMK_RESULT_L1_BODY`）→ 唤醒 turn 完成 → team.create 成功 → 持久 SETTLED 事实；
- **L2** 双 async delegate（两 token 均自动唤醒 + 双 collect + 双持久事实）；
- **L3** 失败成员仍唤醒 + collect 报 `failed`（fail-closed，无假成功）+ 持久终态事实；
- **L4 显式 `async: false` 同步回归**（结果 in-band、**无**独立通知 turn、持久事实不变）。

**kit 6 轮迭代史全留档**（证据 `dev/agent-workflow/evidence/async-default-contract/smoke/`）：run1 旧 pin FATAL（test-use 0.1.5 期 pin）→ run2 user-preset 消失 FATAL（bootstrap `Unknown agent preset`）→ run3 restrict fail-closed FATAL（未知 global `subagent` + `team_archive_member` 缺 catalog）→ run4 双 wire 无限 delegate 循环（mock 0.1.5 期解析）+ v4 source FATAL（双根因分离）→ run5 部分通过（L0/L1a/L1f/L2a PASS；L1b/L1e FAIL = wake 根因锁定）→ **run6 全过**（glue 修复后，base `4fb79fca`）。

**rebase 后复验（run7，rebase 至 `1fb5f351` 后的 tip）**：**VERDICT PASS 23/23** @ world `tests/homes/wcn-smoke-2026-09-27T05-07-52`（全 23 leg 通过；#31 activation 重构后的 glue 邻域 live 复验闭合）。**两基座实宿主双证 = run6 + run7 均 23/23。**

## 验证步骤（复现）

```bash
# 静态
pnpm install --ignore-scripts --store-dir .pnpm-store && pnpm typecheck && pnpm build && pnpm run build:composition && pnpm run check:artifacts
pnpm test   # 期望 10F|20F|3838P(3858)，失败集 = 基线 10 文件（既有债）
pnpm exec eslint . --format json   # 53 (51E/2W)，与 master tracked-scope 逐项一致

# 实宿主（wakeup kit，约 12–15 min；world 自建于 tests/homes/ 并自清）
node tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs \
  --worktree .worktrees/async-default-contract \
  --testuse tests/deepseek-harness-test-use \
  --evidence-dir dev/agent-workflow/evidence/async-default-contract/smoke/wakeup-smoke-repro
```

## 红线守纪

- **CORE PATCH BUDGET = 0**：upstream/test-use 零修改（全部变更 = 插件 tool/glue 层 + kits + 文档 + 簿记；test-use 冒烟前后 porcelain 空 @ `46a7f68b09`）。
- 仅 FF 推送已授权任务分支（零 force-push）；未 merge；冻结文档零触碰；wcn 世界 teardown 自清；evidence launch token 全部 scrub（残留 0）；:3080/:3180 只读探针 pre==post。

## Rebase 至新 master（PR #30/#31 merge 后，2026-09-27）

提 PR 时 origin/master 已由 `4fb79fca`（PR #29 merge 点）前进至 `1fb5f351`（**PR #30 model-preference-routing** 2026-09-26 merge + **PR #31 team-restart-017rc1** 2026-09-27 merge）。按仓库先例（PR #26/#27/#28 rebase 流程）rebase + 全部门禁重测：

- **冲突面**（仅簿记三文件，DEC-1 union 先例）：`SESSION_ROUTER_LOG.md`（追加 union：#30/#31 条目 + 本条目）/ `graph.yaml`（current_phase = 本轮 + 任务块 union + PR #28 已 merge 状态修正 + 历史行补 #30/#31）/ `STATUS.md`（本轮 最近更新 置顶，#31/restart/PR#29 条目降级，PR #29 行补 merge 注记）。**代码零冲突**：`agent-bindings.mjs`（wake 修复 vs #31 activation 重构）/ `tools.ts` / `admission/types.ts` / `issue1-collect-tools.test.ts` 全部自动合并，合并后语义逐文件核验（wake 修复 `source: { kind: 'team-work-settled' }` 在位 / 契约两 run 块在位 / T2 两新 it 在位）。
- **门禁全重测**（rebase 后 tip）：typecheck 8 包全绿 / build 9/9 + composition / **check:artifacts OK 1196 零漂移**（2 个 rebase 期取 theirs 的 .map 重建后 autosquash 归位 commit 1）/ 根套件 **9F|19F|3995P(4014) = 新基线债务子集逐文件逐测试相同**（零新增失败）/ lint **61=61 IDENTICAL（0 new, 0 gone）** / p4t6 10/10。
- **实宿主重验**：wakeup kit 在 rebase 后树上重跑 = **run7**（#31 activation 重构触碰 glue 邻域，live 复验必须）—— 结果见下方实宿主验证节。
- 推送 = `--force-with-lease`（task 分支自有历史更新，同一次一次性推送授权范围；PR #26/#27/#28 同构先例）。

## FOLLOW-UPS（非阻塞，已登记）

1. c1/rc2 kits 0.1.7 重适配（pin + preset + deny + 双 wire 解析，同 wakeup kit 模式）；
2. p6t1-parallel 类 E 并发竞态（F7-1 既有，不修，per-root re-probe 序列化建议）。
