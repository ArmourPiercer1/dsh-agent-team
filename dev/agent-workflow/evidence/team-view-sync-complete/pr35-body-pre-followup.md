## 概述

**Phase 2（用户冻结 8 项设计决策的全部落地）**：Team View 同步完整性 — additive remote contract **v6**（v1–v5 不变）+ client-owned polling（无 server push）+ 确定性 **liveToken** + freshness 二元组 + mount 级 refresh coordinator + zero-state roots cadence + **真实 spill writer E2E（frozen decision 8）VERDICT PASS**。

- base = origin/master `0d1cf8be`（PR #34 merge）；分支 = `fix/team-view-sync-complete-20260927`（worktree `.worktrees/fix-team-view-sync-complete-20260927`）
- 2 commits：`581f85e3`（WP1–WP7 实现 + 单测/集成）+ `f0feee24`（WP8 真实 spill E2E kit + 证据 + WP9 门禁 + 簿记）
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

