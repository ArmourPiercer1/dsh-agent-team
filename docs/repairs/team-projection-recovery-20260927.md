# 团队投影读取侧恢复修复（2026-09-27 事故，阶段 1）

> 分支：`fix/team-projection-recovery-20260927`（base `origin/master @ 4a67f6ed`）。
> 本分支只做**读取侧恢复**（quick recovery），CORE PATCH BUDGET = 0，未触碰 upstream。
> 阶段 2（自动失效、权威 session-ownership、v6 `getReadState`、刷新协调器、
> durable/live 拆分）在独立分支/PR 跟进，本分支不包含。

## 1. 事故形态（已脱敏）

两个持久团队（A：gen 169 / 167 entries / 5 grants；B：gen 118）在晚间出现：
`team.listRoots` 正常（两个 root 都在），但 `team.getProjection` 对这两个团队
返回 internal-error；客户端表现是团队视图"未加入任何团队"（错误地把冷读失败
断言成无团队）与治理重检打到错误团队。

事故窗口内的传输层抖动同时造成：投影拉取失败后，客户端把**旧的失败状态**一直
保留为"当前状态"（传输层通知被当成 round-trip 证据），视图无法自行恢复，且
没有任何可见的失败/重试状态面。

## 2. 根因（按修复项）

### S1-H1 — `artifact-read-granted` 事实的类别错误

`artifact-read-granted` 是一个 grant 事实（授权已发生），在 ledger 适配层被映射
成了不存在的类别路径，导致：

- 投影 `byCategory` 计数错误（grant 事实没有落进任何类别，`totalEntries !=
  sum(byCategory)`）；
- 读取侧（`ledger-adapter`）与投影源（`projection-source`）对同一事实的类别
  判定不一致。

**决定（冻结，不再讨论）**：grant 事实归入**现有 `control` 类别**——不新建
`ControlRequest`/`ControlDecision`，不增加 pending 计数，`totalEntries ==
sum(byCategory)` 保持成立。`byCategory.control` ≠ 人工审批计数 ≠ pending 计数
（PR 描述中已显式声明）。`INTERNAL_FACT_TYPES`（`team-ledger-model.ts`）继续
把 grant 事实从 Events 面板隐藏——隐藏只作用于展示行，不触碰 raw 计数与分页。

改动：`packages/runtime/src/plugin/projection-source.ts`、
`packages/client/src/model/ledger-adapter.ts`（`'artifact-read-granted':
'control'`，词表面板 12→14 事实）、`packages/contracts/src/projection/states.ts`。

### S1-H2 — 兼容性探测打到错误团队（per-target-team prober）

`compatibility.get/reprobe` 的 prober 之前绑定的是**发起方/默认**团队的
compatibility 权威，而不是**目标**团队的权威：对 B 团队的治理重检会读到 A
团队的兼容状态（事故中"重检操作了错误团队"的直接原因之一）。

**修复**：`s6-remote.ts` / `root.ts` 为每个 root 懒加载一个
`compatibilityFor(targetTeamSessionId)`，其探测/准入调用被包进与生产准入同一条
team 操作链（`withTeamLock(coordination.chains, ...)`）——`member.create` 的
准入内联探测（P8-S5B CR-8/R5，INV-9.1）与远程兼容端点共享同一条链，保证
"读/探测与准入互斥于同一团队"。

### S1-C3 — 传输层抖动后的 staleness 判定错误

客户端投影 store 之前把**通道状态事件**（connect/loss 通知）当成
round-trip 证据：loss 事件一到就把在途请求标记为陈旧，且恢复事件一到就
清除失败状态——没有"成功 round-trip"的证据概念。

**修复**（`packages/client/src/state/team-projection-store.ts`）：
移除 `channel`/`ReconnectState` 证据路径，改为纯请求序证据：

- `requestSeq`（每次 pull 启动时的序号）、`lastCompletedSeq`（**任何**有效
  round-trip 完成后推进的基线——成功、duplicate、stale 都算完成）、
  `openLossSeq`（未被吸收的最大 loss 序号）、`epoch`（reset 时推进，
  在途 pull 在 settle 时判死）；
- **loss 判定陈旧 ⟺ `lastCompletedSeq > seq`**（在 loss 之后已有更新的
  round-trip 完成，这条 loss 才是陈旧的）；
- 一次 loss episode 在 `lastCompletedSeq > openLossSeq` 时被吸收（取消
  挂起的 retry）；
- `markConnectionRestored` 只负责取消 retry + 重置 attempt + 触发一次 pull，
  **不提供**任何 round-trip 证据（恢复事件 ≠ 成功读取）；
- 成功恢复（含同 generation 的 duplicate/stale-ready）清掉 `lastError`。

### S1-C1 — 投影 store 状态没有接进 TeamView（状态面缺失）

TeamView 只消费**应用后的帧**（projection mirror），store 的失败/重连状态
完全不可见：冷读失败时视图直接渲染"当前会话未加入任何团队"（把 in-flight 的
冷开断言成无团队）。

**修复**：

- `team-mount-core.ts`：新增 `projectionStatesStore`（per-team 全量
  `TeamProjectionState` 的 snapshot store）；bridge 在 publish 时**先发布完整
  store state，再处理 frame/mirror/ledger**（顺序修复）；view inject 增加
  `hooks.projectionStates`（经 `ui-slots` 的 `standardHookPropName` 自动映射为
  `useProjectionStates` prop，**渲染器零改动**）；
- `TeamView.tsx`：按 `resolution?.team.teamSessionId ?? sessionId` 取当前团队
  状态，零状态按**当前 status/assessment**（不是 `lastError` 属性存在性）渲染：

  | 帧 | 状态 | 渲染 |
  | --- | --- | --- |
  | 无帧 | 尚未开始/初次读取中（`idle`/`loading`/无状态） | 加载中；**不断言"未加入团队"** |
  | 无帧 | `reconnecting` | "尚未成功加载，正在重试" |
  | 无帧 | `error`（typed/loss/foreign/inconsistent） | "团队信息加载失败" + code/message + 重试 + 持久团队入口 |
  | 无帧 | `error` 且 `FOREIGN_TEAM`/foreign | **中性文案**（不转成"无团队"），保留创建入口 |
  | 有帧 | 刷新中（手动 pull / reconnect） | 保留内容 + 轻量 pending 标记 |
  | 有帧 | `error` | 保留旧内容 + "更新失败，当前显示上次成功的数据" + code/message |
  | 有帧 | 成功/duplicate/stale ready | 正常内容，清除失败提示（store 恢复时清 `lastError`） |

  旧的肯定式"未加入团队"文案（`view.zero`）已删除——阶段 1 没有任何权威
  resolver 可以下"无关联"结论（那是阶段 2 的 session-ownership 读取）。

### S1-C2 — 可 await 的只读刷新 + 治理反馈

- `pullProjection` 的契约从 `Promise<unknown>` 收紧为
  `Promise<ProjectionSyncAssessment>`（closed 状态集：apply/duplicate/stale/
  foreign/inconsistent/rpc-error/transport-loss + `code?` +
  `receivedGeneration`）——**resolve ≠ success**：调用方必须检查 assessment。
  受影响的注入面（TeamView / TeamGovernance / TeamMembers / TeamCreationPanel /
  NewTeamEntry / 测试 fixture）全部同步收紧；
- `TeamView` 新增手动"刷新团队视图"（**两种视图都有**：零状态 + 有帧视图）：
  - 捕获本次调用的 `sessionId`/team id/epoch（迟到响应不覆盖新状态）；
  - (a) roots 重读**独立**发起（手动调用不受零状态自动读取的 `creationOpen`
    guard 限制）；(b) **await** 投影 pull，之后才刷新可解析 root 的 ledger
    （冷场景 ledger store 在 pull 应用帧后才建立，所以 ledger refresh 必须在
    pull 之后；有旧帧时即使投影失败也独立尝试 ledger 读取）；
  - 双点击 guard（`refreshPending`）；同 generation 的手动刷新也走 ledger
    refresh；无 root 可解析的 no-op **不**显示成"ledger 刷新成功"；
  - 失败**不重发 mutation**，结果通过 store 状态面展示（无成功 toast 掩盖失败）;
- roots 请求逻辑提取为可 await 的 `loadRoots`（epoch + unmount ref 双守卫；
  StrictMode 下 ref 在 mount effect 中复位，避免 state-flag 在模拟重挂载后
  永久为 true）；roots 状态改为 `{ rows | null, pending, error | null }`——
  **保留上次成功 rows**，pending/error 不清空列表；
- `TeamGovernance`：post-mutation pull 从 `void` 改为 **await + assess**：
  mutation 成功但 pull round-trip 失败 → 在**该命令自己的 lane** 渲染分离式
  结果（"命令已完成，但团队视图更新失败：{code}：{message}"）；**永不重发
  mutation**。per-key dispatch 序号守卫丢弃迟到的 stale pull（pending mark 在
  命令 settle 时清除、早于 pull settle，用户可在 pull 在途时再次点同一命令）；
  `apply`/`duplicate`/`stale` 都是有效 round-trip（`stale` = 收到更旧
  generation，视图仍是最新）；
- 成员命令的后台读取同样走 store：失败通过 TeamView 头部的同一状态面呈现
  （face 类型同步收紧；无 per-row lane——阶段 1 范围内）。

## 3. 测试覆盖（C1–C7）

| 项 | 文件 | 新增覆盖 |
| --- | --- | --- |
| C1 | `client/test/ledger-adapter.test.ts` | grant → `control` 类别、raw payload 原样保留；grant 不创建 control 链/不计 pending；混合 ledger 只计真实 pending 请求（30/30） |
| C2 | `client/test/team-ledger-model.client.spec.tsx` | grant（带 `control` 类别的适配器输出）在 `all` 与 `control` 两个过滤下都被隐藏；隐藏不触碰 raw 计数/分页（26/26） |
| C3 | `client/test/team-projection-store.test.ts` | round-trip 证据语义 6 场景：顺序成功→下一次 loss 为 fresh；restore 事件后其 pull 失败 → 重新开 episode（事故形态）；typed 错误→成功结束错误态；同 gen duplicate 恢复清错误；reset 后在途成功与 loss 双双判死；更旧 loss 迟到不覆盖更新成功（20/20） |
| C4 | `client/test/client-plugin-mount.test.ts` | `hooks.projectionStates` 初始空 + 订阅通知；无帧 typed 失败**发布**进 hook 状态（frame null + verbatim lastError + rpc-error assessment）；pull assessment 不丢失（resolved 值带 closed verdict）；首帧前 ledger refresh 为静默 no-op；冷成功后 ledger store 打开（catch-up page 调用）+ 显式 refresh 是真实重读（+1 page 调用）（47/47） |
| C5 | `client/test/team-view.client.spec.tsx` | 冷开 = loading 且**不显示**肯定式"未加入团队"；无帧 RPC 错误 = 加载失败 + code/message + 重试；无帧 transport loss = 尚未成功加载；FOREIGN_TEAM = 中性文案 + 保留创建入口；有帧失败 = 保留内容 + "更新失败，当前显示上次成功的数据"；恢复（含同 gen）清 banner；两种视图都可刷新（pull 目标 = 解析出的 team id；ledger 在 pull 之后；双点击 guard）（21/21） |
| C6 | `client/test/team-roots-zero-state.client.spec.tsx` | 手动刷新失败保留上次成功 rows；creation panel 打开时手动刷新仍读 roots（自动 guard 不适用）；迟到的 stale roots 响应不覆盖更新读取（epoch guard）（11/11） |
| C7 | `client/test/team-governance.client.spec.tsx` | mutation ok + pull 失败 → 分离式结果渲染在该命令 lane 且**不重发 mutation**（reprobe 恰 1 次）；rpc-error 带 typed code；apply/duplicate/stale 不显示 pull 错误；下一次 dispatch 清 lane（28/28） |

既有 runtime 侧测试（H1/H2/H4/H5）：`p8s7r2-disposed-history` 17/17、
`p8s6-remote-commands` 8/8、`team-compatibility-scope` 13/13（H5 竞争在
**生产** team 链上，经 `member.create` 准入内联探测）。

## 4. 行为变化声明（PR 需复述）

1. `byCategory.control` 现在包含 grant 事实——`byCategory.control` ≠ 人工审批
   计数 ≠ pending 计数；
2. 零状态不再渲染肯定式"未加入团队"——冷开/失败/foreign 一律 loading 或
   失败面 + 持久入口；
3. `pullProjection` 契约收紧为 assessment（调用方需检查；resolve ≠ success）；
4. 治理/成员命令的 post-mutation pull 有可见反馈（失败显示分离式结果，
   不重发 mutation）。

## 5. 验证（同环境 base 对比，base = `4a67f6ed`）

- `pnpm typecheck`：8 包全绿（0 error）；
- `pnpm test`（root，全仓 4051 tests）：**4030 pass / 21 fail**。与同环境
  base 逐名对比：
  - 20/21 为**既有失败**：domain t1-capability-schema ×9 + t2-blueprint-hash
    ×1（YAML fixture/环境）、runtime d3-member-identity-context、
    p6t3-mediation ×5、p6t3-restart ×2、p8s3b-result-effects、
    t12a-b2-child-identity、t12a-glue-handoff-ports、tools p6t6-actions ×1；
  - 1 个 **既有 flake**：runtime p6t1-parallel —— base 与改动态均间歇失败
    （base 首跑 2 个断言失败、复跑 9/9；改动态 full-suite 首跑 1 个失败、
    独立复跑 9/9 ×2；两次失败的具体断言不同），分类为既有 flake，不修不
    掩盖；
  - **0 个新增失败**；client 套件独立全绿（48 文件 / 700 tests）；
  - testkit p4t6-session-event-scan 的 766→767 pin 按该测试自身约定
    （frozen scan 单写者 pin bump）随本分支记录增量（新增
    `packages/runtime/test/team-compatibility-scope.test.ts` 一个可扫描文件，
    零 denylist 词汇，隔离命中集不变）。
- `pnpm build`（8 包全绿）→ `place-dist-glue` + `build-client-composition`
  → stage 产物 → `pnpm check:artifacts`：**OK（1196 files，install-surface
  产物与 fresh build 一致，含 1 glue placement）**；
- `pnpm smoke:composition`：2 个失败**均为同环境 base 既有**（base 状态
  stash+全量重建后复跑，失败信息与改动态逐字一致）：
  (a) host plugin "apply subscribed to listeners before failing"（0.1.7
  宿主 apply 路径 listener 订阅时机 vs smoke 的 clean-fail 预期）；
  (b) client plugin "Cannot find package 'clsx'"——upstream
  `@deepseek-ai/dsh-client-ui-primitives@0.1.7-rc.1` 的 `lib/index.js`
  import `clsx` 但**未声明**该依赖（lockfile 全仓 0 处 clsx），smoke 的
  最小宿主环境无 clsx 提供者。CORE PATCH BUDGET=0 下不在本轮扩 scope，
  记录为环境 blocker（详见 PR 描述）；
- 真机浏览器验证（§5.2 五个场景）——**已完成**，详见 §5.2 记录；证据截图
  （9 张，脱敏：无 cookie / launch token / 认证查询串）随 PR 提交于
  `dev/agent-workflow/evidence/team-projection-recovery/browser/`。

### 5.2 真实宿主浏览器验收记录（隔离合成世界）

**环境**：DSH 0.1.7-rc.1 测试运行时（pin `46a7f68b09`），隔离合成世界
`tests/homes/tpr-2026-09-27T15-29-13`（mpr 四队 fixture 副本 + 启动前注入的
grant fixture 行，序列 45，`artifact-read-granted`）。宿主 origin
`http://127.0.0.1:3182`（3181 被占用自动取 3182），mock model 3497（3496 为
环境预占的 root-owned socket，不可用——记录为环境 blocker）。插件经
`git+file:////<repo>.git#fix/team-projection-recovery-20260927` 装入
`profiles/web/`（bundle dist 随分支提交）。受测会话（合成 sessionId）：
T1 = `session-mpr-t1-mpr-2026-09-27T08-35-52`（grant root，row config
rootSessionId），TB = `session-mpr-tb-…`，TA = `session-mpr-ta-…`，
boot = `session-mpr-boot-…`，plain = `session-7a298d24-…`。所有 post-open
变更仅经宿主公开 mutation 入口（`POST /team-remote/…`）；受控失败按
stop→corrupt（未知 factType 行，宿主进程死后写入）→restart 布置。

1. **grant root 冷打开（S1）**：T1 团队 tab 完整渲染——团队身份、时间线
   5 成员、成员组（leader 1 活跃 + expert/control/worker）、治理（兼容性
   ✓、代数 1、最后探测 08:35:54.848Z）、生效配置、团队事件全 factType
   过滤集。列表（`team.listRoots` v3，4 roots）与详细投影
   （`team.getProjection` ok）均读取成功。投影计数：`ledger.total=31`，
   `byCategory {team:8,member:4,lifecycle:6,message:0,control:1,policy:0,
   compatibility:0,progress:12}`（sum=31 ✓；grant 行计入 control，按既有
   规则对 Events 隐藏）；`pendingControlCount=0`。
   → `s1-t1-grant-cold-open.png`
2. **加成员 + 专用刷新（S2）**：`member.create`（worker 模板，label
   `w-tpr-verify`，公开入口）→ `ok:true`，outcome `member-activated`
   `inst-0hqr7m81xoqf`（ledger seq 46）。点击"刷新团队视图"：普通会话侧
   的已持久化团队列表 T1 计数 4→5 名成员（不含 leader）；T1 视图出现
   w-tpr-verify 时间线行、worker 组"已创建"行（发送任务/发送跟进/归档/
   处置）、团队事件尾行 `23:42:50 成员创建 w-tpr-verify`。刷新为真实重读
   （getProjection+getLedgerPage），**未触发 compatibility.reprobe**
   （代数/最后探测时间不变）。
   → `s4a-t1-after-member-create.png`、`s4b-t1-new-member-created-state.png`
3. **受控失败（S3）**：
   - **无帧**：冷客户端（新会话、空 store）在损坏域上打开 T1 →
     "团队信息加载失败 — internal-error: internal error in remote handler"
     + 刷新按钮；**未**出现肯定的"未加入团队"，已持久化团队列表仍渲染
     （root 记录完好，T1 5 名成员）。→ `s6a-cold-load-failed.png`
   - **有旧帧**：先读成功的同一 tab（store 持有效帧），宿主 stop→corrupt
     （`tpr-smoke-corrupt-fact` 行 seq 47，宿主进程死后写入）→restart 后
     点刷新 → 顶部红条 **"更新失败，当前显示上次成功的数据 — internal-
     error: internal error in remote handler"**，时间线/成员组/治理内容
     全部保留。→ `s6b-stale-frame-banner.png`
4. **恢复重试（S4）**：同一 tab，宿主 stop→heal（删除 seq 47 行、counter
   回 46，宿主进程死后操作）→restart 后点刷新 → 错误消失，团队视图完整
   恢复（时间线/成员组/治理）。→ `s4c-retry-after-recovery.png`
5. **非 boot root 兼容性 scope（S5）**：`compatibility.reprobe`
   （`ROOT_COLD_RESUME`）作用于 **boot**（非 row config bound root T1）
   → boot 行 代数 1→2（15:44:44.389Z）；T1 在 UI"重新检查"
   → T1 行 代数 1→2（15:47:45.922Z）；复读全部四队：T1=2、boot=2、
   **tb=1（08:35:55.943Z 不变）、ta=1（08:35:55.696Z 不变）**——两条独立
   探测各自只推进被寻址团队自己的兼容性行。兼容性 get 同时以
   `team.getProjection.root.compatibility` 复核（per-team 环境指纹
   不同：T1 `fp-v1:496d…` vs boot `fp-v1:ae11…`，蓝图绑定正确）。
   `compatibility.ack` 本轮无法实机触发：fixture 无未确认警告
   （warningCount=0，UI"确认警告"恒 disabled），其 scope 隔离由
   `team-compatibility-scope` 定向测试覆盖（A/B 隔离 + 团队锁）。
   → `s5-t1-recheck-generation-2.png`

**环境注记（非产品行为）**：
- 3496 端口被环境预占的 root-owned socket 占用（本 uid 不可见/不可杀），
  mock 改用 3497；
- 会话沙箱按调用隔离 PID 命名空间：kit 之前调用里 detach 的宿主/ mock
  对后续调用不可见，`--stop` 的 `pidAlive` 检查静默跳过 → 曾出现
  "stop 无效 + 重启 EADDRINUSE + boot 标记匹配到旧日志行"的假重启。
  kit 已修：`waitForBoot` 只匹配 spawn 之后新追加的日志字节，且每次
  boot 前 truncate 实例日志（`team-projection-recovery-smoke.mjs`）；
  后续轮次改用单长生命周期后台作业托管宿主（flag-file teardown）；
- kit 首次 member.create 因自身 YAML 序列化缺陷（空对象写成裸 `key:`
  → 行配置 `externalPolicyFacts.hard` 解析为 null → 激活 fail-closed
  `external.hard: must be a record keyed by capability name`）失败；
  已修（空对象输出 `{}`，与 u8 参考 profile 一致）；该失败完全
  fail-closed，未留下部分实例行（复核 T1 members 仅 5 个种子成员）；
- boot root（411 字节空会话文件）其列表项 `projections: undefined`，
  UI 会话树不显示该会话行——S2 的第二队冷打开改用 tb 完成，boot 的
  可读性经远程调用验证（listRoots + getProjection + reprobe）；
- 浏览器自动重连：宿主重启后 WS 自动恢复，会话树/团队列表可用；
  团队帧的再拉取由专用刷新按钮驱动（阶段 1 承诺范围，自动失效属阶段 2）。


## 6. 显式不做（阶段 2）

自动失效（generation 之外的失效源）、权威 session-ownership 读取（"无关联"
的唯一合法来源）、live 状态更新、v6 `getReadState`、刷新协调器、durable/live
拆分、成员命令 per-row pull lane。
