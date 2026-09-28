## 概述

**Phase 2（用户冻结 8 项设计决策的全部落地）**：Team View 同步完整性 — additive remote contract **v6**（v1–v5 不变）+ client-owned polling（无 server push）+ 确定性 **liveToken** + freshness 二元组 + mount 级 refresh coordinator + zero-state roots cadence + **真实 spill writer E2E（frozen decision 8）VERDICT PASS**。

> **2026-09-28 更新（第三轮）**：审查意见 third follow-up 完成（代码 commit `763a0b3d` + kit 修正 `3d05d3a2`，PR 现 11 commits）— 2 项修复：**P1 冷启动 round 进入同一 session scope**（coordinator 临时 `SessionEntry`：首个未 attach 的 trigger 创建带真 epoch 的临时 scope，attach **复用**同一 scope（不新建 epoch），detach **关闭** scope — 迟到冷 round 与任何迟到的 attached round 同规则失效；从未 attach 的临时 entry settle 后丢弃，无泄漏）/ **P1 最终 E2E/browser 证据绑定到 clean commit**（kit `git status --porcelain` 硬门禁 + 证据记录 `testedCodeHead`/`evidenceCommit` + served bundle 大小/sha256）。门禁全绿 + **spill E2E run-17 PASS（clean commit @ `763a0b3d`，porcelain 空）** + **browser smoke round-3 PASS**（E1/E7/E5/E6 + 回归不变量 + token 迁移负例）。详见文末 **§third follow-up 修复（2026-09-28 审查意见轮 3）**。
> **2026-09-28 更新（第二轮）**：审查意见 second follow-up 完成（`ee9aca60`，PR 现 6 commits）— 4 项修复：**P0-A live overlay 改 Team-scoped**（同 `instanceId` 跨 team 隔离）/ **P0-B v6 same-snapshot liveToken**（projection 帧与其 token 必为同一 materialized snapshot；read-state 仍 lightweight）/ **P1-A TeamView authoritative read-state 5 态视图**（authoritative none → 明确 no-team 行，压过 stale mirror；失败 = last-good + stale 横幅）/ **P1-B coordinator detach→reattach scope epoch**（迟到 round 零副作用）。门禁全绿 + **spill E2E run-16 PASS** + **browser smoke round-2 E6–E9 PASS**（E6 双 team leader 隔离实证）。详见文末 **§second follow-up 修复（2026-09-28 审查意见轮 2）**。
> **2026-09-28 更新（第一轮）**：审查意见 follow-up 轮完成（`9fb51ff8`）— 6 项修复的核心 = **客户端把 `team.getReadState` 用作轻量权威**（可见会话 3s read-state → 权威归属裁决 → 仅需要时 pull projection(root)）；手动刷新恢复显式 ledger 刷新（**推翻**下文「行为变更」节）；spill E2E run-15 PASS（+liveToken 断言）；served-bundle browser smoke PASS（含 client-row 架构要求与两次负证据）。详见文末 **§follow-up 修复（2026-09-28 审查意见轮）**。

- base = origin/master `0d1cf8be`（PR #34 merge）；分支 = `fix/team-view-sync-complete-20260927`（worktree `.worktrees/fix-team-view-sync-complete-20260927`）
- 11 commits：`581f85e3`（WP1–WP7 实现 + 单测/集成）+ `f0feee24`（WP8 真实 spill E2E kit + 证据 + WP9 门禁 + 簿记）+ `24692f17`（PR 开立簿记）+ `9fb51ff8`（**审查意见 follow-up 修复 6 项**）+ `9a94d830`（follow-up 轮 PR body 记录）+ `ee9aca60`（**second follow-up 修复 4 项**，见文末 §second follow-up 修复）+ `27bb416f`（second follow-up PR body 记录）+ `763a0b3d`（**third follow-up 修复 2 项**，见文末 §third follow-up 修复）+ `b02dc05c`（spill E2E run-17 证据，clean commit `763a0b3d`）+ `3d05d3a2`（smoke commit-binding 门禁修正）+ evidence/docs commit（round-3 证据 + 簿记）
- **runtime 源码零行为变更面**（`git diff 0d1cf8be f0feee24 -- packages/` 仅 v6 垂直的 additive 文件 + testkit pin；E2E 期间对 `SHELL_OBSERVER_DEFAULT_TOOLS` 的临时"修复"已全部回退 — 见 §E2E 实证 d）
- 无 server push、无 TeamDomain 迁移、无历史 grant 删除；upstream（test-use）pristine @ `46a7f68b09`（0.1.7-rc.1）

## 冻结 8 项决策 → 实现

| # | 决策 | 实现 |
| --- | --- | --- |
| 1 | additive v6 契约 + `team.getReadState(sessionId)` | contracts v6（29 方法；v1–v5 wire 不变）；runtime 纯模块 `team-read-state.ts` 由 **TeamDomain durable rows 权威**解析：`team-root`（memberInstanceId=null, disposed=false）/ `team-member`（disposed member 仍返回 member relation + `disposed:true`）/ `none`（**仅成功读取且正向确认无归属**）；一切 storage/integrity failure → fail-closed typed（4 个新码入 `REMOTE_BACKING_ERROR_CODE_SET`）；host-wide 解析（boot root 无 row → fail-closed，不猜） |
| 2 | client-owned polling，无 server push | 可见 → 3s tick；hidden → 暂停；visibility resume / connection restore / mutation success → 立即触发；manual refresh → 强制轮 |
| 3 | durable generation durable-only；live = 确定性 opaque token | 现有 TeamSession generation 语义不变（只表 durable）；`live-token.ts` 纯模块：`lt-v1-<sha256hex>`，由排序后的语义 live state（≥ member instanceId + residency）确定性派生；**排除一切时钟字段**（`lastActivityAt`/`now()`/`generatedAt`/`computedAt`）；非裸 numeric counter（宿主重启不归零） |
| 4 | v6 projection 携带 `durableGeneration` + `liveToken`；freshness = 二元组 | client store assessor：durable 前进 → apply + ledger refresh；durable 相同 + token 变 → **apply live overlay，不刷 ledger**；双同 → duplicate；旧 durable → stale |
| 5 | mount 级 per-team refresh coordinator | `team-refresh-coordinator.ts`：统一 manual/tick/mutation/resume triggers；每 team 单飞 inFlight + dirty coalescing（in-flight 期间新 trigger 只置 dirty，settle 后补一轮 read-state）；**刷新失败绝不重发 mutation** |
| 6 | zero-state persisted roots 列表 | 可见时同 3s cadence 重读 `team.listRoots`（跨标签页创建后列表长期陈旧）；已有 resolved Team frame → 不做周期性 roots poll；manual refresh 仍重读 roots |
| 7 | live 范围 = 权威状态 only | resident/resuming/cold（当前已有权威来源）；不发明 currentAction/task-progress；`s6-live-overlay` 的 `lastActivityAt=now()` 不参与 liveToken |
| 8 | 最终 E2E = 真实 spill writer 路径 | **VERDICT PASS（run 14）** — 见 §真实 spill E2E |

## 冻结决议复用注记

- **live-only apply 复用既有 apply 路径**（store 单一 apply 通道；live overlay 不推 appliedGeneration）→ **ledger refresh 的 trigger 保持单一 = applied-generation 前进**（d4 二元组 + coordinator 的共同不变量）
- **v6 响应形状**：cells 在 `value.data.projection`（与 v1–v5 同位），`durableGeneration === generation`（同一 durable 事实的两个名字），`liveToken` 新增于 projection；provenance 在 `value.provenance`（contractVersion 6 + projectionGeneration）
- **wire v≤5 byte-identical 语义保持**：版本感知 dispatcher（`version===6` → v6 port；else 旧路径）；v≤5 假响应 ripple pin 不变
- **`none` 仅正向确认**：getReadState 对任意 sessionId（含非 Team 会话）返回 `none` + null 格，当且仅当 durable 读取成功且无归属；读取失败 → 4 个 fail-closed 码之一（绝不把"读不到"当"无归属"）

## 行为变更（Phase 1 语义，需 reviewer 注意）

- **manual refresh = 强制轮 only**（coordinator ungated 轮：仅 read-state + 必要的 projection 重取，**不触发 ledger refresh**）— Phase 1 的 manual refresh 曾经 store 通道触发 ledger 重取；现收敛到"generation 前进才刷 ledger"单一 trigger（决策 4/5 的直接后果）
  - ⚠️ **本条已被 follow-up 轮（`9fb51ff8`）P1-4 推翻**：manual refresh = 强制轮 + **显式 `team.getLedgerPage` 一次**（fallback/face 路径同样）；自动刷新仍维持 generation 前进 only 单一 trigger。见 §follow-up 修复 P1-4

## 双 lane pull 架构注记

- **coordinator lane**（本 PR）：门控 manual / 3s tick / mutation success / visibility-resume / connection-restore → 单飞 read-state + 二元组裁决
- **store channel-episode lane**（既有，不变）：backoff retry + `markConnectionRestored` 失效拉取（effect 17 语义保持）
- 两 lane 汇于同一 F1 有序 generation 裁决的 store pull；互不重入（coordinator 不直接刷 ledger，store episode 不触发 coordinator）

## 真实 spill E2E（frozen decision 8）— VERDICT PASS（run 14）

kit `tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs`（实宿主 0.1.7 pristine 世界，seed 自 mpr 世界；3182 + mock 3497；:3080/:3180 只读探测 401）。**判据 C0–C7 全绿，全链实证**：

```
真实 300KB 工具溢出 (SPILL_COMMAND = head -c 300000 /dev/zero | tr '\0' 'x'，> 64KB maxOutputBytes)
  → 真实 spill 文件 (locator=/tmp/dsh-subprocess-*/…-stdout.log, kit 内 live statSync = 300000 字节)
  → shell-result-observer (agent-scoped tools/result, 随 permissions listener 安装)
  → durable artifact-read-granted (seq 46, instanceId=inst-leader,
    source={kind: shell-foreground, toolName: bash, callId, stream}, 双 sha256 digest)
  → team.getReadState(T2) 检测 generation (stamp 5 = 2 + 3 entries)
  → team.getProjection(T2) v6 可读 (durableGeneration=5 + liveToken lt-v1-92163c… ≠ pre-grant lt-v1-7770fa…;
    provenance cv6/pg5)
  → raw ledger 保留 grant (locator + 双 digest) 而 v6 projection JSON 隐藏 locator/digest/factType (closed fact table)
```

证据目录 `dev/agent-workflow/evidence/team-view-sync-complete/wp8-spill-e2e-tvs-spill-2026-09-27T19-46-24/`（api-transcript / c2-create / **c2-marker-requests = 全量请求 body（含 surface tools 数组 + tool_result 内容）** / mock-requests 全量 / mock.log / instance.log.scrubbed / post / preflight / summary.json — launch token 已 scrub；保留世界 `tvs-spill-2026-09-27T19-46-24` 记录于 summary）。失败轮世界 ×7 + 失败证据目录 ×11 已按协议清理。

### E2E 实证注记（设计关键 — 全部 fixture 层，零插件行为变更）

- **a) 驱动 = `team.create` v1 `initialWork`（Root initial-work vertical，TCM §15.7/§15.8）**：activation fence 拦截 Team 管理会话的 generic `/api/session/prompt`（`TeamSessionActivationInterceptedError`）；对 inst-leader 的 generic member follow-up 非合法 → create 时 initialWork 是唯一 fence-legit 的 Root 驱动。**实测语义：该 vertical 是同步的 — create 阻塞至 terminal `team-root-work-delivered` 才返回**；grant（seq 46）中途落 `team-work-admitted`（45）与 delivered（47）之间，create-return 时已 durable（settle 首 poll 即命中）。
- **b) grant-eligible 代理 = leader + `capabilities.permissions`**（by design 的推论实证）：live glue 只随 permissions policy 安装 permission listener + tools/result observer — 无 policy 代理的 grant 会是 inert dead fact，故不安装。mpr 世界所有模板无 permissions → **member 驱动（run 6/7）永远无 grant lane**（两次 run 的 no-grant 后死因）；fixture blueprint `team.tvs-spill` = leader-only team + leader `permissions {default: ask, allow: [{tool: bash, resource: {kind: any}}]}` + `teamEnvelope {allow: [bash]}`（A2C-1：member 模板的 allow-lane 整工具 bash 被 schema 拒绝；**leader = exec-autonomy 契约例外**，mutation-envelope dual gate 下 runtime 有效）。
- **c) A2C-2 Permission Coverage Gate 实证**（run 8）：生产宿主 surface 19 个 ownerless builtin（7 unknown-unmanaged + 12 known-sensitive-unmanaged）→ gate 正确 fail-closed typed（`alpha2-permission-coverage-unmanaged-tools`）→ fixture 解 = blueprint `builtinToolDeny` 恰好列 19 名（free-form 工具名）→ E2E surface 收窄为注册名 `bash` + 13 team tools = 全 owner-owned。gate 对 unowned 工具 fail-closed = by design（closed 六分类），不改插件。
- **d) 工具名双层区分 + 误修回退实录**：upstream 插件**行**导出名 = `tool-bash`/`tool-pwsh`，但 model-facing surface **注册名** = `bash`/`pwsh`（`defineTool({name:'bash'})`；marker-request 全量 dump 实证 surface 含 `bash`）；`exec.name` = 注册名；`PERMISSION_TOOL_NAMES`（`bash`/`pwsh`）一致。run 6/7 后死期曾误"修" `SHELL_OBSERVER_DEFAULT_TOOLS` → `['tool-bash','tool-pwsh']`（8 文件 source/spec/dist）→ run 10 证据推翻 → **全部回退，`git diff 581f85e3 -- packages/` = 0**；原始 `['bash','pwsh']` 本来就正确。mock 侧必须：注册名 `bash` + input 含 schema 必填 `description`（run 12 实证缺失 → `Error: invalid arguments: missing required property "description"`，无溢出无 grant）。
- **e) mock wire = Anthropic `tool_result`**：tool result 在 **user 消息**的 content 数组（`type:'tool_result'` block，无 `role:'tool'`）→ mock `hasToolResult` 双形态判定 + 唯一 callId（`call-tvs-spill-N`）；OpenAI 形态单判定会在 mock 侧重发 tool call 至 turn 被切断（run 6 后死因之一）。
- **f) 405 启动竞态（诊断性注记，非插件缺陷）**：webserver 先于 `/team-remote` 前缀路由注册 emit token 行 → 窗口内 POST = frontend-static fallback 405 → kit route-ready 等待（轮询 getReadState 至 status≠405，预算 60s；实测 32–271ms）。
- **g) C3 判据 = stamp 一致性**（kit 断言设计层，非冻结语义变更）：同步 vertical 下"create-return 后的 generation 前进"不可观察（grant 已在 create-return generation 内）→ C3 断言 **`G1 = 2 + entryCount(T2)`（grant 在 entries 内）**：S1-A hook A（`storage/repositories/ledger.ts` — 每条 NEW durable entry 后 owning root stamp +1；row bootstrap=1；create 路径创建时 advance 一次）⇒ 该不变量；C1 先在 **T1 基线实证（32 = 2 + 30）**。grant 未推 stamp 会读 4 ≠ 5 → FAIL。这是"read-state 检测 generation"意图的严格可观察形式。

## 门禁（final tip `f0feee24`）

| 门禁 | 结果 |
| --- | --- |
| 根套件（×2 记录） | `14 failed | 319 passed (333)` 文件 / `31 failed | 4050 passed (4081)` 测试 — **vs 22 行基线（0d1cf8be）零新真实失败**（22 基线失败全在，0 gone；`failure-set-final-tip-2.txt` + `comm` diff 在证据目录） |
| 15 新增行归类 | 4 环境性文件（a2c1-pwsh-permission / a2c7-subtree-matcher ×10 / h5-bash-effects / team-session-startup-fence）= **base `0d1cf8be` 代码临时 checkout 同环境复跑同样失败**（4F|10T 实证）+ p6t1-parallel ×2 = **类 E 负载 flake（F7-1 既有 follow-up，不修；隔离 5/5 @ 9/9 + 批负载下非确定性）** |
| 唯一真实缺口（已修） | `p4t6-session-event-scan` pin **767 → 777**（本 PR +10 scannable 文件：runtime `team-read-state.ts` + `live-token.ts` + 3 s6t specs / remote `pull-v6.ts` + c6 spec / client `team-refresh-coordinator.ts` + 2 v6 specs；dist 镜像不入扫描 — 767+10 精确）spec 10/10 绿。Commit-A 门禁误跑同名近邻 client-architecture-negatives spec 漏掉本 spec — 本 pin bump 闭合 |
| zero-core | test-use porcelain 空 @ `46a7f68b0922371ce7144b668b90e377d8e799f4`（kit C0/C7 + 终 tip 复核） |
| check:artifacts | OK **1204**（dist 面零漂移） |
| typecheck | **9/9** 全绿（final tip 复跑） |
| 真实 spill E2E | **VERDICT PASS**（run 14，上节） |

## 红线守纪

- **CORE PATCH BUDGET = 0**：upstream/test-use 零修改（pristine @ `46a7f68b09`）；全部能力 = 外部插件 + 公开 seam
- 零 TeamDomain 数据迁移 / 零历史 grant 删除
- **FF 首推，零 force-push**（origin/master 仍在 base `0d1cf8be`，无 rebase 需要）
- :3080/:3180 零触碰（只读探测 401）；宿主 3182 + mock 3497（3180 族内）
- evidence token-scrubbed（原始 instance.log 不入档，仅 scrubbed 版）
- 1 task = 1 branch = 1 worktree = 1 writer

## 复跑 E2E

```bash
# worktree 根（依赖已装）：
node tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs
# 判据 C0–C7 全绿 = VERDICT PASS；每次运行 seed 新 world（tests/homes/tvs-spill-<stamp>），
# 保留世界记录于证据 summary.json；失败轮世界/证据按协议清理
```


---

## follow-up 修复（2026-09-28 审查意见轮，commit `9fb51ff8`）

审查 guide `docs/plans/active/PR35_phase2_followup_fix_guide.md`（审查基线 = Phase 2 head `24692f17`）。审查结论：v6 runtime / liveToken / freshness pair / zero-state / spill E2E **基本成立**，但**客户端从未把 `team.getReadState` 用作轻量权威**（projection 仍按会话 id 直接拉）。冻结目标：

> 可见会话 → 每 3s `team.getReadState`（v6）→ 权威归属裁决 → durableGeneration + liveToken 比较 → **仅需要时** `team.getProjection` v6(root)

### P0-1 getReadState 成为客户端轻量权威（本轮核心）

- 新纯模块 `packages/client/src/state/team-read-state.ts`（每会话 read-state 权威格：`recordSessionReadState` / `getReadState` / `onReadState` 订阅）
- **coordinator round 改以 read-state 为先导**：先 `team.getReadState(sessionId)` → 权威归属裁决（`none` → 停轮；`team-root` | `team-member` → 解析 root id）→ 需要时单飞 pull projection(root)（in-flight 期间 dirty coalescing 不变）
- mount 级 `ensureProjection` 单飞（D-T9-5）：未 attach 的触发也单飞；同 team 并发冷开不再多拉
- 成员冷开现以 **root** 为 projection 目标（browser smoke E1 pure 形态实证，见 §browser smoke）

### P0-2 liveToken 入 read-state value（闭 6 格集）

- read-state value 闭 6 格：`relation / teamSessionId / memberInstanceId / disposed / durableGeneration / liveToken`
- `none` → 全格 null（含 `liveToken: null`）；`team-root` / `team-member` → `lt-v1-*`
- **同 team 的 root 与全部成员共享同一 liveToken**（每 team 一个 live epoch）；live 状态（residency/instance）变化 → token 变化；时钟字段仍排除
- 客户端以 read-state 与已 apply 的 projection 的 (durableGeneration, liveToken) 二元组比较，裁决 apply / overlay / duplicate / stale

### P0-3 v6 stale 响应回滚守卫

- `team-projection-store` 的 `appliedDurableGeneration` / `appliedLiveToken` 高水位**只前进不回退**：乱序晚到的旧 durable 响应判 stale，不清帧、不回滚 applied 二元组
- 新 spec：乱序双响应 = 只前进

### P1-4 手动刷新 = 显式 ledger 刷新（**行为变更**，推翻本 body「行为变更」节）

- **Phase 2 的 "manual refresh = no-op ledger" 在本轮推翻**：手动「刷新团队视图」= 强制轮 + **显式 `team.getLedgerPage` 一次**（fallback/face 路径同样）
- 自动刷新维持 **appliedGeneration 前进 only**（live-only apply 永不刷 ledger）— 自动路径的单一 trigger 不变量保持
- browser smoke E5 实证：click → 恰 1× getLedgerPage（afterSequence:0, limit:50）+ 1× read-state 复探 + listRoots（16ms 内），其后纯 3s read-state 轮询

### P1-5 连接恢复 = coordinator lane（双 lane 分工保持）

- coordinator 新 `noteConnectionRestored()`：**只清 store channel-episode，不 pull**，基线未动；后续由正常 tick 轮经 read-state 权威自然重拉
- store lane（backoff retry + `markConnectionRestored` 失效拉取，effect 17 语义）不变；两 lane 汇于同一 F1 有序 store pull

### P2 无 binding 多归属 → typed 错误

- resolver crash-window corroboration 扫描出 **>1 个候选 root**（无 binding 多归属）→ 新 backing 错误 **`TEAM_READ_STATE_OWNERSHIP_CONFLICT`**（typed，入 s6 码集 + rethrow；client 面可观测）；单候选路径不变

### follow-up 门禁（tip `9fb51ff8`）

| 门禁 | 结果 |
| --- | --- |
| typecheck / build | 9/9 / 9/9 + composition（client-bundle 重建 1089104B；follow-up markers：connection-restored=6 / recordSessionReadState=2 / OWNERSHIP_CONFLICT=1 / liveToken=64 / noteConnectionRestored=5） |
| client vitest | **51 文件 / 766 passed / 0 failed**（新增：read-state model spec + mount 单飞 + TeamView runRefresh P1-4 + store notedRestoreScenario + coordinator-face 场景 A/B/E） |
| 根套件 | **29F\|4098P(4127) = 零新真实回归**（归一化 FAIL 行 diff vs `0d1cf8be`：0 removed / 14 added，全落 4 已知环境性文件 a2c1×1 / a2c7×10 / h5×1 / team-session-startup-fence×1 — base 同环境复跑同样失败） |
| p4t6 | 10/10，pin **777 → 779**（+2 scannable：client `state/team-read-state.ts` + spec） |
| zero-core / check:artifacts | test-use pristine @ `46a7f68b09`（前后自证）/ OK **1204**（post-commit） |

### spill E2E run-15 — VERDICT PASS（+ liveToken 断言）

同一 kit（更新：C1/C3/C4 增加 liveToken 断言）在新世界 `tvs-spill-2026-09-28T05-26-59` 重跑，**C0–C7 全绿**，新增：

- **C1** T1 projection `liveToken = lt-v1-7770fae9…`（稳定 durable 态，live 恒定）
- **C3** T2 post-grant projection `liveToken = lt-v1-92163c7d…` ≠ pre-grant（live 变更经 v6 对可见；durableGeneration 前进 → apply + ledger refresh）
- **C4** 每对 `projection.liveToken === readState.liveToken`（同刻权威一致）

证据 `dev/agent-workflow/evidence/team-view-sync-complete/wp8-spill-e2e-tvs-spill-2026-09-28T05-26-59/`（token scrubbed；保留世界记录于 summary）。前 14 轮史见 run-14 证据目录。

### browser smoke（served bundle，实 Chromium + 实 dsh web 宿主）— VERDICT PASS

新 kit `tests/kits/team-view-sync-complete-e2e/browser-smoke-host.mjs`（preflight（test-use HEAD/porcelain + 端口 + stable 401）→ mpr 世界 seed → 世界 profile 行补丁重定向 + **client 行追加** → mock model → host 启动（3181–3186 族）→ READY → SIGTERM teardown（stable post + porcelain + 端口 + scrubbed logs））。

**关键架构要求（两次负证据后发现，复跑必须遵守）**：

1. mpr 世界 profile 只带 HOST 行 — browser 侧 team client 半部必须靠**第二条 CLIENT 行**（S8 模式：composition-shim 惰性 node 半 + `package.json dsh.client.platform = web` + `exports['./client'] = client-bundle.js`）；
2. 该行**必须落在 profile patch 的 `- insert:` 列表内** — 顶层 `- id:` mapping 被 profile-patch 解析器当作针对不存在 row id 的 PatchOptions 条目**静默丢弃**（逐条 Loader warning）。attempt 1（无 client 行 → 零 /team-remote 流量、无团队 tab）/ attempt 2（顶层行被丢 → 同果）= 两次负证据；attempt 3 boot 表 63 条含 `@dsh-agent-team/client`。

**场景实证**（capture run d8ee25b166282；证据 `wp9b-browser-smoke-tvs-smoke-2026-09-28T05-49-08/` + 截图 e1b/e2/e3/e5）：

| 场景 | 结果 | 关键实证 |
| --- | --- | --- |
| E3 root 冷轮 | PASS | getReadState 精确 3s 周期（delta 2995–3008ms）；全窗**恰 1×** `team.getProjection` v6(root) + 1× getLedgerPage；read-state 530B `{relation:'team-root', durableGeneration:32, liveToken:'lt-v1-7770fae9…'}`；6+ tick 零 projection |
| E1 成员冷开 | PASS（双形态） | contaminated：成员流 547B `{relation:'team-member', memberInstanceId:'inst-17legoh0ti27', liveToken 同 root}` 与 root 流并存独立相位；**pure（reload 后成员为首个会话，无 root 先访）**：恰 1× getReadState(member) → 恰 1× getProjection(**root id**) → 1× ledger → 纯 3s read-state 轮询 |
| E2 普通零态 | PASS | 世界 10 会话全 team-bound（team_domain 四 root + 6 子）→ UI 新建空白会话：read-state 423B `{relation:'none', liveToken:null}` 3s + 每次配 listRoots；**零 getProjection**；零态面 = 已持久化团队目录（4 root + blueprint@revision）+「从此处开始团队」CTA | ⚠️ **零态面已被第二轮 P1-A 取代**：authoritative none 现渲染明确行「已确认当前会话未加入团队」（`view.ownership.none`）+ 已持久化团队目录；wire 语义（none 闭 6 格 + 零 getProjection）不变 — 见 §second follow-up E7
| E5 手动刷新 | PASS | 恰 1× getLedgerPage（afterSequence:0, limit:50）+ 1× read-state 复探 + listRoots（16ms 内）；无 projection spam — P1-4 行为变更实证 |
| E4 连接恢复/单飞 | 单元级 | 单元 spec（coordinator-face A/B/E、notedRestoreScenario、mount 单飞）+ E2E run-15 覆盖；浏览器不重复驱动（诚实记录） |

bonus：`ta` 为第二 team root，**独立 liveToken** `lt-v1-623ddd76…` ≠ T1（两 team = 两 live epoch，v6 权威模型实证）；T1 mount LRU 逐出实证（tick 相位切换 + 重开冷探，帧由 mirror store 供出不再拉）。

```bash
# browser smoke 复跑（worktree 根，依赖已装）：
node tests/kits/team-view-sync-complete-e2e/browser-smoke-host.mjs --worktree "$PWD"
# READY 行仅在该次运行 stdout（launch token 不进 evidence）；SIGTERM 进程 = teardown
```

### follow-up 红线自证

- **CORE PATCH BUDGET = 0**（test-use 前后自证 @ `46a7f68b09`，porcelain 空）；零 TeamDomain 迁移 / 零历史 grant 删除
- 零 force-push（FF `24692f17..9fb51ff8`）
- :3080/:3180 只读探测 401 pre==post（三轮）；smoke 宿主 3182 + mock 3497（族内）
- smoke 世界 ×3 用后清理（记录在案）；launch token 全 scrub（instance.log/cookies/控制台日志；残留 grep 零命中）
- 1 task = 1 branch = 1 worktree = 1 writer


---

## second follow-up 修复（2026-09-28 审查意见轮 2，commit `ee9aca60`）

审查 guide `docs/plans/active/PR35_second_followup_fix_guide.md`（审查基线 = follow-up tip `9a94d830`；第一轮 6 项修复全部保留）。§13 五个暂停例**全部未触发**（无需 upstream 修改 / v1–v5 wire 完好 / 无迁移 / DTO 含 token 所需完整 member+live 语义 / `LEADER_INSTANCE_ID` 未动）。

### P0-A live overlay 改 Team-scoped（merge-blocking）

- `createLiveResidencyOverlay` 的 `LiveResidencyOverlayPort.snapshot(teamSessionId)` **只读 `memberInstances.list(teamSessionId)`** — 删除 host-wide merge 与 `rootSessionId` 选项参数；实例身份 = `(teamSessionId, instanceId)`
- 修复前：两个 team 的 leader 都叫 `inst-leader`（`LEADER_INSTANCE_ID`）→ host-wide 合并让 A 的 live 行**覆盖** B 的冷行（跨 team 串扰）。修复后：同 `instanceId` 跨 team 完全隔离
- 新 spec `packages/runtime/test/p01-team-scoped-overlay.test.ts`（6T，guide §3.1）：双 team 共享 `inst-leader`（leader 行无 childSessionId → overlay 回退 teamSessionId）+ 各自 worker；**snapshot(A).get(inst-leader) = resident vs snapshot(B) = cold**（真实 production overlay + 真实 projection service）；per-team `computeTeamLiveToken === computeLiveTokenFromProjectedMembers`；tokenA ≠ tokenB；双帧 generation 3

### P0-B v6 same-snapshot liveToken（merge-blocking）

- 纯模块 `live-token.ts` 新增 `computeLiveTokenFromProjectedMembers(members)`：null liveActivity → `'absent'`；按 `instanceId` 排序的 `[instanceId, residency]` → `lt-v1-<sha256>`；**无时钟字段**
- **方案 A**：纯 `RemoteProjectionPort` 必选 `projectV6(teamSessionId) → {projection, liveToken}` — S6 纯 handler 的 v6 路径**单快照**（snapshot ONCE）从**归一化投影的 members** 算 token（不再二次 port 调用，从构造上消除 frame 与 token 的跨快照漂移）；fake world 的 projectV6 = 同投影 + 固定 `lt-v1-*`
- `computeTeamLiveToken` 保留 = **read-state 的 lightweight 探针路径**（`team.getReadState` 不为算 token 构建 whole projection — guide §6 不变量保持）
- 不变量：同一 v6 响应内 `members[].liveActivity` 与 `projection.liveToken` **必然描述同一 materialized snapshot**（确定性单测 E9 + 实链 E2E C4 双证）

### P1-A TeamView authoritative read-state 5 态视图

- `viewMode` discriminated union：`ordinary / ownership-error{detail} / team-loading / store-driven / team-ready{stale}`
- **authoritative none → `ordinary` 明确 no-team 行（压过 stale mirror）**：确认无归属后 UI 显示「已确认当前会话未加入团队」+ 已持久化团队目录 — 不再出现 ambiguous 的「正在加载团队信息…」冷开
- read-state 失败三分面：remote-error →「团队归属读取失败 — CODE: message」+ 刷新按钮；malformed →「团队归属响应异常 — reason」；transport-loss →「无法读取团队归属，等待连接恢复」
- 失败且有 last-good 帧 → **保留 Team 视图 + stale 横幅**（`data-team-ownership-stale`，「团队归属刷新失败，当前显示上次成功的数据」）
- store-driven（readState 尚 null）保留 S1-C1 行（null/idle/loading/ready →「正在读取团队归属…」ownership-loading 行；reconnecting/foreign/error 语义不变）
- 7 新 locales（zh/en）；UI-T1..T6 组件 spec（含 none 压过 stale mirror 的 UI-T5 / 失败保留 last-good 的 UI-T6）

### P1-B coordinator detach→reattach scope epoch

- `SessionEntry.epoch`（每 coordinator `nextEpoch`；`attach` 建 fresh entry）；detach **CLOSES the scope**
- `runRound(options, sessionId, isCurrent)` 双守卫：read-state settle 后（任何 onReadState/pull 前）+ conditional pull 前，均检查 `entries.get(sessionId) === entryAtStart` — **superseded round 返回 `{readState, projectionAssessment: null}` 零副作用**（不 publication / 不 pull / 不动 timer）
- settle 回调的 `lastResult` 写入同守卫；**未 attach 的冷启动 round 豁免**（`() => true`，guide §5.2 — 冷启动不杀）
  - ⚠️ **本条已被第三轮（`763a0b3d`）取代**：`() => true` 裸守卫删除 — 冷启动 round 现创建**临时 SessionEntry**（真 epoch + 同套 scope 守卫）：attach 复用同一 entry，detach 使其失效（迟到冷 round 零副作用）。见 §third follow-up P1-A
- E1–E3 竞态 spec（`gatedProbe.releaseAt(callIndex)` 显式定序）：E1 detach 后旧 probe 的迟到 settle 不覆盖新 scope（无第二次 publication/pull，timer 相位不变）/ E2 detach 后永久 settle → 结果到调用方但零副作用 / E3 未 attach 冷触发 → ~~attach 后冷结果仍落地~~（⚠️ 该期望已被第三轮 COLD-E1/E2/E3 取代：attach 复用临时 scope、detach 使其失效）

### second follow-up 门禁（tip `ee9aca60`）

| 门禁 | 结果 |
| --- | --- |
| typecheck | 全 Done（8 包有 script 全绿；`legacy` 无 typecheck script — 逐包 grep 实证 = 完整集） |
| build / artifacts | build 全 Done + `place-dist-glue` 1 处 byte-identical + `build-client-composition` client-bundle.js **1101071 B** + check:artifacts post-commit OK **1204** |
| client vitest | **51 文件 / 775 passed / 0 failed**（+9：UI-T×6 + coordinator E×3；766→775） |
| runtime / remote | runtime **2222P\|18F 全预存**（逐文件 = `0d1cf8be` baseline 集，零新增）/ remote 14 文件 **219T 全绿**（假 world `projectV6` 方案 A 更新） |
| 根套件 | **29F\|4107P(4136) 双连跑 FAIL-SET-IDENTICAL**；归一化 FAIL 行 diff vs base `0d1cf8be` = 仅 **13 环境性行**（a2c1×1 / a2c7×10 / h5×1 / team-session-startup-fence×1 — 与第一轮完全同一集合，base 同环境复跑同样失败）；4136 = 4127 + 9 新测试（UI-T 为 `.spec.tsx` 在 client 包级跑） |
| p4t6 | 10/10，pin **779 → 780**（+1 scannable = p01 spec；780 精确） |
| zero-core | test-use pristine @ `46a7f68b09`（porcelain 空，前后自证） |

### spill E2E run-16 — VERDICT PASS

同一 kit（本轮未改动）重跑新世界 `tvs-spill-2026-09-28T07-38-16`：**C0–C7 全绿**，含 **C4 `projection.liveToken === readState.liveToken`（实链 same-snapshot）**；C5 grant seq 46 durable / C6 projection 隐藏 grant fact。证据 `dev/agent-workflow/evidence/team-view-sync-complete/wp8-spill-e2e-tvs-spill-2026-09-28T07-38-16/`（token scrubbed；世界保留记录于 summary）。

### browser smoke round-2（served bundle = 本 round client-bundle 1101071 B）— E6–E9 全 PASS

新宿主 3182 + mock 3497（种子世界 4 team root：boot/t1/ta/tb；世界 `tvs-smoke-2026-09-28T07-39-41` 保留；capture `d0ff6feb5e850`）：

| 场景 | 结果 | 关键实证 |
| --- | --- | --- |
| E6 双 team leader 隔离（wire 级） | PASS | A = T1 / B = TA（两 team 的 leader 都是 `inst-leader`）；唯一激活 = `team.ensureRootLive(A)` v3 公开 seam（`{mode:'team', live:true}`，B 从不触碰）→ `getProjection(A)` leader `{residency:'resident'}` vs `getProjection(B)` leader `{residency:'cold'}`；**per-team `projection.liveToken === readState.liveToken` 且 (durableGeneration, liveToken) 对双表面一致**（A gen 32 / B gen 9）；`token(A)=lt-v1-022b6598… ≠ token(B)=lt-v1-623ddd76…`（guide 明示 = 结果性断言，非判据）；每 read-state 自指本 team（零串扰）；激活前探针 = 双 cold 种子 token → 激活后 A token 迁移、B 不动（per-team 追踪实证）。脚本 `e6-two-team-leader-isolation.mjs` + 结果入档 |
| E7 ordinary 权威零态（DOM + wire） | PASS | UI 新建 ordinary 会话（'ping' → mock 确定应答）→ 团队 tab **DOM = 「已确认当前会话未加入团队」**（`view.ownership.none` 权威行）+ 已持久化团队 4 root 列表 + 刷新按钮；**无「正在加载团队信息…」**（第一轮 E2 的 ambiguous 冷开行消失）；wire：none 流 17× @ 2990–3008ms 全为闭 6 格全 null + `liveToken:null`（423B）；全 capture **零 ordinary getProjection**（仅 T1 两次）；截图 `e7-ordinary-authoritative-none.png` |
| E8 归属失败面（component 级 = guide 明示最低要求） | PASS | UI-T2 remote-error →「团队归属读取失败 — CODE: message」+ 刷新按钮 / UI-T3 malformed / UI-T4 transport-loss / stale 横幅；`TEAM_READ_STATE_OWNERSHIP_CONFLICT` 类型化路径由 team-read-state outcome-matrix spec 覆盖。注记：实宿主故障注入未做 — CORE BUDGET 0 禁改 served plugin code |
| E9 same-snapshot 确定性单测 | PASS | `s6t-remote-v6 §3.2 (j)`：双快照 fake（#1 resident / #2 cold），一次 v6 getProjection → **snapshotCalls === 1** + served members 与 token 同源（guide 明示优先确定性单测，不要求浏览器竞态） |

capture 回归不变量：T1 root 流 40× @ 2996–3004ms；全窗**恰 1 次 token 迁移**（E6 `ensureRootLive` 时刻）→ **恰 1 次 getProjection** → 其后稳定（live-only changed token → projection pull 保持）；v1–v5 零流量；v6 read-state 形状不变（530B/423B）。

### second follow-up 红线自证

- **CORE PATCH BUDGET = 0**（test-use 前后自证 @ `46a7f68b09`，porcelain 空）；零 TeamDomain 迁移 / 零历史 grant 删除 / `LEADER_INSTANCE_ID` 未动
- **零 force-push**（FF `9a94d830..ee9aca60`，仅 task branch）
- :3080/:3180 只读探测 401 pre==post；smoke 3182/3497 释放（3181/3496 = 他人 PID 命名空间既有监听 — kit port-free 探测因此让位，非本 run 绑定）
- 启动 token 全 scrub（smoke-host.json / instance.log / mock.log / 控制台日志 = `token=SCRUBBED`；宽 grep 零活跃 token）
- 1 task = 1 branch = 1 worktree = 1 writer


---

## third follow-up 修复（2026-09-28 审查意见轮 3，commit `763a0b3d`）

审查 guide `docs/plans/active/PR35_third_followup_fix_guide.md`（审查基线 = `27bb416f`；第二轮 4 项修复全部保留）。§21 五个暂停例**全部未触发**（无契约变更 / 无 upstream / 无 schema / 临时 entry 清理为安全的同 scope 语义收紧 / mutation exactly-once 与 generation 权威未动）。

### P1-A 冷启动 round 进入同一 session scope（transient coordinator entry）

- 审查发现：第二轮 P1-B 的「未 attach 冷启动 round 豁免」（`() => true`）让冷 bootstrap round 绕过 scope 守卫 — 若 detach 后该冷 round 迟到 settle，它会以**永久过期的 scope** 发布 read-state authority 并发起 stale conditional pull
- 修复（`packages/client/src/state/team-refresh-coordinator.ts`）：`SessionEntry.attached: boolean`；首个未 attach 的 `trigger` 不再裸跑 round，而是 `createEntry(sessionId, attached=false)` — **临时 entry**（真 `epoch = nextEpoch++`，同一套 `entries.get === entryAtStart` 守卫）
- **attach 复用**：`attach()` 发现已有（临时）entry → `existing.attached = true` + 未 paused 则 armTick — 冷 round 与后续 attached round 是**同一 scope**（单飞 lane、无新 epoch、无重复 probe）
- **detach 关闭 scope**：detach 语义不变（删 entry = 关闭 scope）→ 迟到的冷 round settle 时 `entries.get !== entryAtStart` → **零副作用**（不 `onReadState` 发布、不 conditional pull、新 entry 的 timer 不动）— 与迟到的 attached round 完全同规则
- **无泄漏**：从未 attach 的临时 entry 在最后 round settle 且无 dirty/waiter 时 `maybeDropTransientEntry` 丢弃；`resume()` / `attached()` 只认 attached 会话
- **TeamView effect 重排**（guide §12）：attach/detach effect 移到冷 ensureProjection effect **之前** — UI 路径不再经过临时分支；coordinator 对任意 trigger→attach 顺序都安全
- 测试：第二轮 E3（「未门控冷 round 可迟到落地」）期望**删除**；新 COLD-E1（trigger 未 attach 停放 → attach 复用同一 entry → 第二次 trigger dirty-coalesce：probe 计数仍 1，settle 后补恰一轮；终态 2 probes / 1 timer / 无重叠）/ COLD-E2（冷 A 临时 scope E1 停放 → attach 复用 → detach 删除 → 重 attach E2 → B 先 settle 健康 → A 迟到：`onReadState` 只见 B，A `projectionAssessment===null`，零 pull，E2 timer 完好）/ COLD-E3（冷触发 → attach → 永久 detach → A settle：零发布零 pull，`attached()===[]`）；S4 同断言改写（APPLY / `['root-fresh']` / attached []）。coordinator spec 23/23

### P1-B 最终证据绑定到 clean commit（commit binding）

- 审查发现：E2E/smoke 证据未绑定到被测的**不可变 commit** — 脏工作树跑出的证据无法证明某个 commit 通过
- 修复（两个 kit）：
  - **spill E2E kit**（guide §14）：C0 preflight 新增硬门禁 `git status --porcelain` 必须为空 + `preflight.json`/`summary.json` 记录 `{worktreeHead, worktreePorcelain}`
  - **browser-smoke-host**（guide §15）：preflight 对 worktree porcelain 非空直接 dieFatal + 记录 `worktreeHead`/`worktreePorcelain` + **served client bundle 的 size + sha256**（浏览器实际加载的字节）；门禁在 kit 创建任何 run artifact **之前**执行（严格空 porcelain 形态，无自豁免 — 首两次启动被门禁正确拒绝：run-17 证据目录未跟踪 / 门禁自身顺序，实证门禁生效而非只写了代码）
- **顺序**（guide §16）：code commit `763a0b3d` → porcelain == "" → 最终 E2E（run-17）+ browser smoke round-3 → 证据单独 commit（不含可执行代码变更）；证据记录 `testedCodeHead` + `evidenceCommit`

### third follow-up 门禁（tip `763a0b3d`）

| 门禁 | 结果 |
| --- | --- |
| client vitest | **51 文件 / 777 passed / 0 failed**（775 → 777：−1 旧 E3，+3 COLD-E1/E2/E3） |
| runtime / remote | runtime **2222P\|18F 全预存**（零 runtime 源码改动，失败集 = 基线集逐文件一致）/ remote 14 文件 **219T 全绿** |
| typecheck / build | 8 包全 Done（legacy 无 script = 完整集）/ build 9/9 + `place-dist-glue` byte-identical + client-bundle **1105475 B** + check:artifacts post-commit OK **1204** |
| p4t6 | 10/10 @ pin **780**（零新 scannable 文件，pin 不动） |
| zero-core | test-use pristine @ `46a7f68b09`（porcelain 空，前后自证） |

### spill E2E run-17 — VERDICT PASS（clean commit 绑定）

同一 kit（+C0 porcelain 硬门禁）新世界 `tvs-spill-2026-09-28T08-50-05`：**C0–C7 全绿**，且 C0 实证 `worktreeHead=763a0b3d` + `worktreePorcelain=''`（记录于 preflight/summary）；C4 `projection.liveToken === readState.liveToken` 实链保持。证据 `dev/agent-workflow/evidence/team-view-sync-complete/wp8-spill-e2e-tvs-spill-2026-09-28T08-50-05/`（token scrubbed；世界保留）。

### browser smoke round-3（served bundle = 本 round client-bundle 1105475 B，sha256 `e690ad90…`）— 全 PASS

宿主 3182 + mock 3497（种子世界 `tvs-smoke-2026-09-28T08-54-21` 保留；capture `d367b01e74613`；**commit binding：`worktreeHead=3d05d3a2` porcelain 空 + served bundle 1105475 B / sha256 记录于 smoke-host.json**）：

| 场景 | 结果 | 关键实证 |
| --- | --- | --- |
| E1 成员冷开（wire + DOM） | PASS | 成员 `session-team-child-710e2ae5…`（TA root，cold）冷开团队 tab：readState → **恰 1× getProjection**（+131ms）→ 1× getLedgerPage；DOM = 完整 team frame。第二个成员 `…d07982a4…`（T1 root）再冷开：其 root 亦恰 1× getProjection — 每 cold root 恰一次 |
| E7/E2 ordinary 权威零态 | PASS | UI 新建 ordinary 会话（'ping' → mock 确定应答）→ 团队 tab DOM = 「已确认当前会话未加入团队」+ 已持久化 4 root 列表；wire：none 流 3s cadence 全闭格 + **零 ordinary getProjection** |
| E5 手动刷新 | PASS | 「刷新团队视图」→ 强制 read-state 复探 + **恰 1× getLedgerPage**；无 projection 重拉（applied token 已 = live token） |
| E6 双 team leader 隔离（wire 级） | PASS | 新 world 重跑 `e6-two-team-leader-isolation.mjs`：唯一激活 `ensureRootLive(A)` v3 → A resident / B cold；per-team 双表面 (gen, liveToken) 一致（A gen 32 / B gen 9）；token(A)=lt-v1-022b6598… ≠ token(B)=lt-v1-623ddd76…（与第二轮同值 = 确定性派生复现）；零串扰。结果 `e6-two-team-leader-isolation-result-round3.txt` |
| E9 / E10 确定性单测 | PASS | E9 = `s6t-remote-v6 §3.2 (j)` snapshotCalls===1（runtime 套件内）；**E10 = 新 COLD-E1 确定性 coordinator 门禁**（client 套件 777 内） |

capture 回归不变量：root 流 3s cadence（导出序列 gap 2.998–3.007s，至收尾无漂移）；全窗 getProjection **恰 2 次**（每 cold root 一次）、getLedgerPage **恰 3 次**（2 帧加载 + 1 E5）；无 5xx；v1–v5 零流量。**token 迁移负例（新）**：观察结束后 wire 侧再调 `ensureRootLive(T1)`（v3）— leader 已 resident → live state 不变 → **token 不变**（before==after）→ 打开中的 T1 团队视图 **零额外 getProjection**（纯 3s read-state 轮询）— 流在 token 不变时正确地不重拉。正向迁移案例（token 变 → 恰 1 次 pull）由第二轮 browser 证据（seq 599）+ E10 单元覆盖（客户端代码路径本轮未动）。

### third follow-up 红线自证

- **CORE PATCH BUDGET = 0**（test-use 前后自证 @ `46a7f68b09`，porcelain 空）；零 TeamDomain 迁移 / 零历史 grant 删除
- **零 force-push**（FF `27bb416f..763a0b3d..b02dc05c..3d05d3a2..evidence`，仅 task branch）
- :3080/:3180 只读探测 401 pre==post；smoke 3182/3497 释放（3181/3496 = 他人 PID 命名空间既有监听，非本 run 绑定）
- 启动 token 全 scrub（instance.log = scrubbed 版 / .token.tmp 删除 / 宽 grep 零活跃 token）
- 1 task = 1 branch = 1 worktree = 1 writer
