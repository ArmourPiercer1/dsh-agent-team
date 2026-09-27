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
5. **#20** wake glue `kind:'plugin'` 被拒（#19 的插件侧实例）。**该修复由独立 PR #33 落地并已 merge 至 master**（`plugin:dsh-agent-team` = 官方 v3→v4 migration producerKind 对历史 wrapper 的精确映射 + MessageSourceMap d.ts 增强 + admission-proof A/B/C）；本 PR 曾有的同缺陷修复（`team-work-settled`）经用户裁决于 **rebase #2 剔除** — 本 PR 对 wake 路径零代码变更（详见下方 Rebase #2 节）。

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

**rebase #2 后复验（run8/run9，rebase 至 `e4d915cd`（PR #33 merge）后的 final tip）**：wakeup kit **run8 22/23**（仅 L2d 双-async-staggered 第二 collect 为 null；L1 单 wake / L3 fail-closed wake / L4 sync 回归全过 = PR #33 的 wake kind `plugin:dsh-agent-team` 唤醒路径工作正常）→ 隔离复跑 **run9 VERDICT PASS 23/23**（run8 L2d 定性为非确定性 flake，同 p6t1-parallel 类 E 规程）。**#33 wake kind 实宿主端到端验证闭合；kit run1–run9 九轮迭代史全留档。**

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

## Rebase #2：采用 PR #33 wake 修复方案（origin/master 前进至 `e4d915cd`，2026-09-27）

消费者迁移轮推送后，origin/master 前进 `1fb5f351` → `e4d915cd` = **PR #33 fix/v4-work-completion-source merge**（用户独立轮次已裁决 merge）。PR #33 与本分支 commit `17d14e2c` **同一缺陷、不同方案**（文件面重叠 3：`agent-bindings.mjs` src+dist + G3 测试）：

- **PR #33 方案（采用）**：`source: { kind: 'plugin:dsh-agent-team' }` = 官方 v3→v4 migration `producerKind` 对历史 wrapper 的精确映射（历史 Session 与新消息同一 producer identity）+ 新 `message-sources.d.ts` MessageSourceMap module augmentation（上游扩展模式，纯类型面）+ G3 测试改指（RED→GREEN 突变检查）+ p4t6 pin 765→766 + admission-proof A/B/C 对 pristine 0.1.7-rc.1 构建产物。
- **本分支原方案（剔除）**：`kind: 'team-work-settled'`（事件同名）— run6/run7 23/23 实宿主验证过，但与 #33 的迁移一致性/上游扩展模式相比为次优选择。

**用户裁决（2026-09-27）**：「针对你与 PR #33 重叠的 v3→v4 迁移相关部分，应该采用 PR #33 的方案。你处理好 async 相关问题，并适配新基线即可」→ rebase **drop `17d14e2c`**（wake 路径全部采用 master/#33 版本，本 PR 对 wake 零代码变更）+ 簿记 union（log 双条目 / graph 双任务块 + current_phase / STATUS 双行）+ **全部门禁新基线（e4d915cd）重测**：typecheck 8 包全绿 / build 9/9 + composition / check:artifacts OK 1196 零漂移 / 根套件 9F|19F|3995P(4014) 失败集与基线逐字节相同（同归一化 md5；首跑 21F = +2 p6t1-parallel 类 E 负载 flake，复跑复归 19F）/ lint 61=61（821 文件 56E+5W）IDENTICAL vs origin/master e4d915cd / p4t6 10/10（pin 766 = #33 新值）+ **实宿主复验**：wakeup kit run8 22/23 → **run9 23/23**（#33 kind 端到端）+ model-pref kit 全量 EXIT 0 + run.mjs 17/17 PASS（failures: []；:3080 pre==post 401；test-use pristine 自证）。推送 = `--force-with-lease`（task 分支自有历史更新，同一一次性推送授权范围）。

## 消费者迁移（2026-09-27 跟进指令：有界 contract-consumer 修复）

**产品契约零变更**：`async` 省略 → async；`async: true` → async；`async: false` → sync；tool 层恒发显式 `execution`；facade 默认 sync（CCR-1 直接调用方不变）；TeamDomain schema / Remote-UI 契约 / work 执行状态机 / 完成唤醒设计 / `team-work-settled` source kind 全部未动。本轮只修复**省略 `async` 却断言立即结算**的 ACTIVE 消费者 → 显式 `async: false`（无 compat shim、无 test-only "猜 sync" 逻辑、无默认翻转）。

### 1. 已修（Type 1：工具返回即断言结算 / 重启边界确定性）

- **`tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs` ×8**（+ 头部 ASYNC CONTRACT 注记）：R2 `team_delegate`（**缺陷闭合腿**：返回即断言 `workSettled===true && memberResult.status==='succeeded'`；且 R2 若 async，其 `team-work-settled` 唤醒请求会落入 R3 create-window 的无解释请求断言窗 → 确定性 R3 失败）/ R3 `team_follow_up`（断言 `settled===true`）/ R4 `team_follow_up`（断言 `settled===true`）/ R5-pre `team_follow_up`（无 settled 断言，但 restart 前世界必须在 cold-resume 边界前完全结算）/ R7 + R8-a + R8-b `team_delegate`（同 pre-restart 边界确定性）/ R5-post `team_follow_up`（cold-resume 后，断言 `settled===true`）。
- **`packages/tools/harness/run.mjs` ×10**（+ 头部注记，列明保留默认-async 的两组）：E3-fu1/E3-fu2（结算链不变量 `seq1<settle1<seq2<settle2` 读自工具结果）/ E4×2（**kill 边界确定性**：E world boot1→boot2 是进程 kill，异步 work unit 或唤醒 turn 不得跨边界）/ W1（`settled`+`settledSequence`+SETTLED av2+token 持久日志）/ W5（`settled`+closed activity 区间）/ W7（`settled`+av6+cold-resume 同会话日志）/ W3-C/W3-D（`workSettled===true`×2+SETTLED av3）/ W2（`settled`+av12+跨重启日志）/ `workerFollowUp` helper（M1/M2/M3/M5：断言 post-turn 事实——assembled model cell + token 持久日志，紧接 turn 后）。
- **`packages/tools/harness/g5-member-e2e.mjs` S5 ×1**：mock Leader 的 `team_delegate` 加 `async: false` — S5 断言 Leader 面向的 ACTION RESULT 携带冻结 `memberResult`（即"delegate 工具调用阻塞到成员 work turn 结算"）；默认 async 下无参调用返回 admission receipt → 确定性 S5 失败。
- **措辞澄清（零行为变化）**：`issue1-serial-blocking.test.ts` / `send-message-liveness.test.ts` 头部 — 区分 facade 默认（execution ABSENT）sync 路径（CCR-1，本轮裁决不改）与 model-surface 默认 async（tool 层恒发显式 execution 补偿）。

### 2. 审阅后保留默认 async（Type 2/3 + 已显式 pin）

- **c1-leader-approval-smoke**：X/Z 链 `async: true`（有意 async workflow：receipt→唤醒→collect）；Y 链 `async: false`（本 PR 已 pin，注释在位）。
- **rc2-real-host-smoke**：两 delegate 均 `async: false`（本 PR 已 pin）。
- **work-completion-wakeup-smoke**：5 个 toolCall 全部是**契约 pin 本身**（L1 无参默认-async live pin / L2 双 `async: true` / L3 `async: true` / L4 `async: false` 同步对照）——该 kit 就是验证本契约的。
- **t12-vertical V4**：Type 2（启动 + 独立 480s 日志轮询等待，无返回即结算断言）。
- **run.mjs E2 寻址探针**：在寻址期即被拒（execution-mode 决策之前，async/sync 不可观察）+ **E5b guard 腿 fu1/fu2/fu3**：admission 期语义断言（executed / blocked-allow-consumed / executed，无 settled 断言；末段场景；其后无边界）。
- **facade 层测试与直接调用方**（`root-initial-work.ts` / `leader-notification.ts` / `agent-bindings.mjs` / `issue1-serial-blocking` CCR-1 pin）：facade 端口，语义未变。

### 3. 顺带修复（P8-S5A 陈旧装配 test-infra errata — 与本契约无关，但 run.mjs 在当前 0.1.7 树上可跑的前提）

- **:3080 稳定实例 pre/post 探测**：硬编码 200 → TEST_METHODS §2.4 仓库约定（可达 + pre==post 状态一致；当前稳定部署对未认证探针返回 401 = 正确行为；g5/各 kit 早已用此约定）。
- **glueUrl**：source-tree glue → dist mirror glue 放置（source glue 的跨包相对导入只在 dist mirror 内可解析；与 g5 + 生产 dist host 同一 URL；P8-S5A 写法前于 dist mirror 几何）。
- **TEAM_DEFAULT_WORKSPACE**：P8-S5A Windows 字面量 `C:/agent-team/work/p6t6` → 每跑一次在 `tests/homes/` 下的 POSIX 目录（0.1.7 session-header cwd 绝对路径校验在 POSIX 宿主拒绝 Windows 字面量）。
- **EXPECTED_TOOL_COUNT**：10 → 13（闭集自 P8-S5A 后增长 +send_message/+archive_member/+collect；与 wakeup kit L0 pin 同数）。
- **readChildSessionLog**：`session.jsonl.zstd` → `session.v4.jsonl.zstd`（0.1.7 session-format-v4 持久日志名）。
- **M4/M5 mcp facet 状态**：扁平 `w.mcp` → per-server `w.mcp.servers[name]`（P8-S5A 后的产品投影形状演化；行为不变）。
- **E7 EXPECTED_SCAN_FILES**：5 → 7 工具层文件（scanner 自身动态递归发现为准；bypass 扫描本身零违规）。
- **childSidFor 镜像**：P8-S5A 字面前缀 → 当前 glue 的 `session-team-child-<sha256(rootSessionId\0instanceId)[:32]>`（对实跑证据逐字节验证 MATCH；seed 成员的旧字面量 = row config 显式值，C1 restart-resume 依赖，保留）。

### 4. 门禁（迁移后复测，全部通过）

- typecheck 8 包全绿 / build 9/9 + build:composition / **check:artifacts OK 1196 零漂移**（本轮仅注释 + 非构建 .mjs 变更）/ 根套件 **9F|19F|3995P(4014) = 新基线债务子集逐字节相同（零新增失败）**（失败集 md5 比对）/ lint **61=61 IDENTICAL（0 new, 0 gone）** vs origin/master `1fb5f351`（临时 worktree 基准，run.mjs errata 后复测）。**rebase #2 后新基线（`e4d915cd`）全重测**：typecheck 8 包全绿 / build 9/9 + composition / check:artifacts OK 1196 零漂移 / 根套件 9F|19F|3995P(4014) 失败集与基线逐字节相同（同归一化 md5 `16b5af13…`；首跑 21F = +2 p6t1-parallel 类 E 负载 flake，复跑复归 19F 债务子集）/ lint 61=61（821 文件 56E+5W）IDENTICAL vs origin/master `e4d915cd`（0 new / 0 gone）/ p4t6 10/10（pin 766 = #33 新值）。

### 5. 实宿主验证（迁移后）

- **model-preference kit 全量（R1–R8 + H1/H2）：EXIT 0 全绿** @ :3181（含 R5 cold-resume 前/后 settled 腿 — 关键迁移验证）；RUN_DIR 证据归档至 `dev/agent-workflow/evidence/async-default-contract/consumer-migration/model-pref-kit-mpr-2026-09-27T07-55-32/`。
- **run.mjs 全场景：17/17 PASS**（E1–E7 + W1/W2/W3/W5/W7 + M1–M5；postflight test-use pristine + :3080 pre==post 401；世界自清）。
- **g5-member-e2e：本环境受阻**（固定端口 3180 被沙箱外稳定实例族持有 — 返回 401 且 /proc 不可见，按红线不可触碰）；S5 语义由等价 live 证据覆盖：wakeup kit L4（显式 async:false 同步 in-band，run6/run7 23/23）+ run.mjs E3/W1–W7/M1–M5 同步腿（17/17，本轮）+ model-pref R2（workSettled+memberResult 返回断言，本轮）。g5 重跑 = 环境受限 follow-up（需 3180 空闲）。
- **rebase #2 后 final tip 复验**：wakeup kit **run9 VERDICT PASS 23/23**（run8 22/23 仅 L2d flake — 隔离复跑定性；#33 wake kind 端到端）+ model-pref kit 全量 **EXIT 0**（RUN_DIR 归档 `consumer-migration/model-pref-kit-mpr-2026-09-27T08-35-52/`）+ run.mjs **17/17 PASS**（failures: []；:3080 pre==post 401；test-use pristine @ `46a7f68b09` 前后自证）。

## FOLLOW-UPS（非阻塞，已登记）

1. c1/rc2 kits 0.1.7 重适配（pin + preset + deny + 双 wire 解析，同 wakeup kit 模式）；
2. p6t1-parallel 类 E 并发竞态（F7-1 既有，不修，per-root re-probe 序列化建议）；
3. g5-member-e2e 实宿主重跑（环境受限：固定端口 3180 被稳定实例族占用；S5 语义已由 wakeup kit L4 + run.mjs 17/17 + model-pref R2 等价覆盖）。
