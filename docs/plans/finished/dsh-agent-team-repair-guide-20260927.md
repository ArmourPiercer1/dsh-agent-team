# dsh-agent-team：团队投影与刷新故障修复指导

**日期：2026-09-27（北京时间）**  
**交付方式：两阶段、两个可独立审查的 PR；阶段 1 以两小时内恢复基本功能为目标。**  
**执行对象：本地代码修复 agent。本文是实施任务书，不要求重新进行一轮开放式根因调查。**

## 0. 执行摘要与任务边界

请按本文完成插件代码、回归测试、构建产物和修复证据。阶段 1 完成后推送任务分支并创建 PR，随后执行阶段 2。用户已经明确要求快速修复 PR；本任务分支的 push 和创建 PR 属于此次任务范围，不要再次询问是否可以提交 PR。合并到 master/stable、发布包、替换用户正在使用的插件和重启现场宿主，不包含在“编写代码并提交 PR”中。

### 为什么分两阶段

当前事故涉及三个层次：宿主详细投影读端、客户端读取状态与刷新编排、按团队寻址的治理操作。完整解决还需要为 agent 发起的变化提供有界自动刷新，并处理 durable generation 与 live residency 的不同更新语义。把这些全部塞进两小时，会挤掉最重要的真实回归和安装产物验证。

| 阶段 | 目标 | 用户可见结果 | 预算与交付 |
| --- | --- | --- | --- |
| 阶段 1：快速恢复 | 修复合法授权事实导致的投影失败；错误可见；可靠手动刷新；兼容性按目标团队执行 | 现有两队重新可读；冷打开不再因投影失败被误判为无团队；点击专用刷新可获取成员与事件；重新检查不再操作错误团队 | 测试环境就绪时，目标 90–120 分钟，提交恢复 PR |
| 阶段 2：完整修复 | 自动失效检测、权威 session 归属读取、live 状态更新、并发与错误诊断闭环 | leader 不断分派成员时，无需反复手动刷新；普通会话、冷成员与读取失败有明确区别；跨页面状态和重连可靠 | 估计 4–8 小时，复杂环境可能更长；提交完整修复 PR |

阶段 1 的“两小时”是工程时间盒，不是允许跳过门禁。依赖、测试运行时或浏览器尚未就绪时，单独记录环境阻塞及耗时。若到时未满足阶段 1 的退出条件，推送可审查的 Draft PR，明确哪些条件未完成，不能宣称“基本恢复已验证”。

### 本轮不做

- 不修改 DSH upstream，不使用私有 seam、不打 core patch、不改 JSON 存储架构。
- 不重建、删除或改写用户已有 TeamSession/ledger 来掩盖读端问题。
- 不改变 delegate/follow-up 的 async 默认、leader 唤醒、模型路由、MCP 权限或会话格式。
- 不继续把“另一个进程创建”“另一个标签页创建”“F5 已证明恢复”写成已证实历史。
- 不以证明所有进程里都不存在陈旧存储副本作为修复前置任务。

## 1. 基线、已知事实与执行纪律

### 1.1 代码基线

本指导已核对：

- 插件：`ArmourPiercer1/dsh-agent-team`，master 提交 `4a67f6ed870bed19a0d7f4dadac094f33d1009c8`。
- DSH：`deepseek-ai/deepseek-harness`，`0.1.7-rc.1`，提交 `46a7f68b0922371ce7144b668b90e377d8e799f4`。
- Remote contract 当前支持 v1–v5；`team.getProjection` 现有客户端 wrapper 使用 v1，`team.listRoots` 使用 v3。它们与 projection schemaVersion、TeamSession generation 是三种不同版本/计数，禁止混用。

执行时从实际 `origin/master` 建立干净任务 worktree，记录 base SHA。如果 master 已前进，按本文的文件、函数名和行为定位，不硬套行号；先检查改动是否已经存在，保留已合入的修复。

本文源码路径均相对实际插件仓库根目录。不要使用 ChatGPT 临时工作区的路径作为本地工程路径。

### 1.2 已确定的事故事实

| 项目 | 结论 |
| --- | --- |
| 第一队 | `session-ee078c34-06c2-442c-a0dd-ced0441d212c`；已取证快照中 generation 169、19 条含 leader 成员记录、167 条 ledger，其中 5 条 artifact grant |
| 第二队 | `session-7b566faf-01e1-4d1b-8dd7-060c85c18195`；generation 118，列表 memberCount 18（不含 leader） |
| 第一队首条触发事实 | sequence 4469，2026-09-27 17:21:18.570 +08:00，`artifact-read-granted` |
| 第二队首条触发事实 | sequence 4647，2026-09-27 18:02:41.866 +08:00，同 fact type |
| 21:00 活探测 | 3180 的两次 listRoots 均有 26 个 root，两新队存在；探测开始前 DOM 也已包含两队；两次标记为新队的 projection 调用均返回 internal-error |
| 原始异常与代码复现 | 合法 artifact grant 被 projection-source 的旧分类词表拒绝；整个投影失败。已有客户端保留旧帧，新客户端没有帧，ledger store 未启动 |
| 历史列表缺队 | 本轮不再复现；历史原因未唯一确定，不能用当前采样补写创建窗口或 F5 时序 |

既有原始快照和真实生产读路径的最小复现已经足以开始修复。当前 `internal-error` 摘要本身不含内部堆栈；不要把某个具体 cause 冒充为这份摘要直接记录的字段。

### 1.3 仓库与现场纪律

开始时读 `AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`，使用当前任务适用的评审与 git 纪律。本任务是既有产品的有界修复，不重新执行已经完成的 P0–P10 历史开发计划。若仓库存在适用于本任务的额外门禁，纳入执行记录，不静默跳过。

- 一任务分支、一隔离 worktree、一写者；并行 agent 可以做独立只读审查。
- 测试 runtime 只用 `tests/paths.mjs` 指向的 pristine `tests/deepseek-harness-test-use`，保持 upstream HEAD 与工作树 clean。
- 测试 home 用 `tests/homes/<task>-<UTC timestamp>`，不能使用 `~/.dsh`。
- **当前用户的 3180 也是事故现场，不是可随意复用的测试端口。** 3080、3081、3180 以及其他已存在实例均不启停、不抢占。先查占用，再从仓库允许的 3180 族/3491–3500 中选择空闲端口；不为腾端口杀进程。
- 保留既有备份。实际用户快照只用于私有只读回放，不把整个 home、会话日志、token、工件内容或 7 MB 原始域文件提交入库。
- 正式回归采用结构合法的最小合成 fixture；私有快照回放只提交计数、错误码、测试结论等脱敏证据。
- 构建检查若找不到脚本，先检查 sparse checkout：`git ls-tree HEAD scripts/`。不要把本地未展开的目录误报成仓库缺文件。

## 2. 本指导固定采用的修复决策

以下是本轮实施选择，执行 agent 不需要重新把核心方案作为开放问题交回用户。

1. **artifact grant 归入现有 `control` 统计类别。** 这里表示控制与持久授权事实。它不成为 ControlRequest/ControlDecision、不增加 pending、不改变授权判定，也不在 Events 显示内部载荷。
2. **阶段 1 保持八类和既有 wire schema。** 保留 `totalEntries == sum(byCategory)` 与 disposed history 对应计数不变量，不引入第九类、不重定义总数为“仅可见事件数”。
3. **compatibility 第一阶段真修。** 通过每个 production root 实例内的 `compatibilityFor(teamSessionId)`，按目标团队绑定蓝图、同一 repositories 和现有团队锁执行 get/reprobe/ack。禁止回退到 boot root。
4. **无投影帧不等于没有团队。** 阶段 1 使用加载中/未成功加载/错误等中性状态；阶段 2 才用权威只读 resolver 产生明确的无关联结果。
5. **阶段 1 新增独立的只读“刷新团队视图”。** 它不是 compatibility.reprobe、不是 ensureRootLive，不启动 agent；等待投影、ledger 与 roots 的实际读取结果。
6. **阶段 2 采用可见页面的轻量只读轮询。** 选择 3 秒间隔，成功环境下以约 5 秒内看到 durable 变化为验收目标。保留失效后 pull 的结构，不推送完整投影。旧文档“NO polling”的实现限制在本次新设计说明中明确更新，冻结历史文档保持原样。
7. **不以时间戳代替实例或更新版本。** durable generation、live revision、source epoch 分开；不通过随手增长 durable generation 来伪装 live 状态变化。

新增一份简短设计记录，例如 `docs/repairs/team-projection-recovery-20260927.md`，记录上述分类语义和两阶段边界。它补充本次修复决策，不改写只读冻结文档。

## 3. 阶段 1：快速恢复 PR

建议分支：`fix/team-projection-recovery-20260927`。建议 PR 标题：`fix: restore team projections and make refresh failures visible`。

### S1-H1：补齐 artifact 事实分类，保留全部原始数据

**文件：**

- `packages/runtime/src/plugin/projection-source.ts`
- `packages/client/src/model/ledger-adapter.ts`
- `packages/contracts/src/projection/states.ts`

#### 宿主修改

在 `projection-source.ts` 引入现有纯 fact 模块的常量：

```ts
import { ARTIFACT_READ_GRANTED_FACT_TYPE } from '../../artifact-read/fact.js'
```

在 `FACT_TYPE_CATEGORY` 的 control 组添加：

```ts
// Durable authorization grant; not a ControlRequest/ControlDecision.
[ARTIFACT_READ_GRANTED_FACT_TYPE, 'control'],
```

同步更新上方“13 种生产 fact”注释及 `FACT_ADDRESSING_KEYS` 对 `instanceId` 来源的说明。不要改 `factAddressesInstance()` 的既有键集合：合法 grant 本来就有 `payload.instanceId`。

同一 map 被以下两处使用，必须一起验证：

- `ledgerSummaryOf()`：grant 进入 total、control 计数以及 latestSequence。
- `disposedHistoryOf()`：归属该成员的 grant 进入 factCount、control 计数及 sequence span；同名 instanceId 的其他 root 事实不得混入。

保持 `pendingControlCount` 按精确的 request/decision fact type 推导。**分类为 control 并不意味着 pending +1。** 保持真正未知 fact 的 fail-closed 行为，不添加 `unknown -> control` 兜底，不直接 `continue` 跳过未知事实。

#### 客户端修改

在 `ledger-adapter.ts` 的客户端分类镜像添加：

```ts
'artifact-read-granted': 'control',
```

客户端不导入 runtime 模块。不要把 grant 放入真实 control request/decision pairing 或 pending 推导 switch。

保留 `team-ledger-model.ts` 的 `INTERNAL_FACT_TYPES` 中的 `artifact-read-granted`。raw model 中保留完整事实，Events 的 `all` 和 `control` 筛选都继续隐藏它。

#### 契约说明修改

`states.ts` 的 control 注释改为“控制请求、决定、消耗和持久授权事实”，例如：

```ts
/** Control requests, decisions, consumption, and durable authorization grants. */
```

不改 `LEDGER_CATEGORIES` 的八个值，不改 projection schemaVersion，不迁移数据。PR 明确写出：`byCategory.control` 不等于人工审批次数，也不等于待审批数量。

### S1-H2：compatibility 三个端点使用目标团队的 prober

**文件：** `packages/runtime/src/plugin/root.ts`、`packages/runtime/src/plugin/s6-remote.ts`，以及所有受内部 options 类型变动影响的测试构造点。

#### 内部 port

在 `S6RemoteOptions` 中，用按目标寻址的必填 port 替代单个 `compatibility: CompatibilityProber`：

```ts
type CompatibilityOperations = Pick<
  CompatibilityProber,
  'current' | 'probe' | 'acknowledge'
>

readonly compatibilityFor:
  (teamSessionId: string) => CompatibilityOperations
```

这是插件内部依赖修改，不修改 RPC 参数或端点版本。不要保留“resolver 缺失就回退 boot prober”的分支。更新所有 `createS6RemotePorts` / surfaces fixture，类型检查应能发现漏接线。

#### production root 接线

在 `createProductionTeamRoot()` 的实例闭包中增加懒加载 cache，按 teamSessionId 保存窄 operations wrapper：

1. 用现有 `boundBlueprintFor(teamSessionId)` 取得目标团队**绑定的**蓝图快照。
2. 用同一 `repos`、同一环境事实 port 和时钟创建 `createCompatibilityProber`，`rootSessionId` 必须是目标团队。
3. wrapper 的 current/probe/acknowledge 均经现有 `withTeamLock(coordination.chains, teamSessionId, ...)` 执行。
4. 将 resolver 传入 S6 surfaces，替代原 `compatibility: prober`。

形状示意（类型、变量名按实际 root 实现补齐）：

```ts
const compatibilityByRoot = new Map<string, CompatibilityOperations>()

function compatibilityFor(teamSessionId: string): CompatibilityOperations {
  const cached = compatibilityByRoot.get(teamSessionId)
  if (cached) return cached

  const raw = createCompatibilityProber({
    repositories: repos,
    rootSessionId: teamSessionId,
    blueprint: boundBlueprintFor(teamSessionId),
    environmentFacts,
    now,
  })

  const scoped: CompatibilityOperations = {
    current: () => withTeamLock(
      coordination.chains, teamSessionId, () => raw.current(),
    ),
    probe: trigger => withTeamLock(
      coordination.chains, teamSessionId, () => raw.probe(trigger),
    ),
    acknowledge: input => withTeamLock(
      coordination.chains, teamSessionId, () => raw.acknowledge(input),
    ),
  }

  compatibilityByRoot.set(teamSessionId, scoped)
  return scoped
}
```

注意：现有代码只有 bound-blueprint cache，并不存在可直接复用的 per-team prober cache。不要把“增加 resolver”写成已经存在的设施。懒加载应放在团队行已经可读取时执行，不在 boot mint 之前强行解析尚不存在的 root。

boot 专用 prober 保持其原用途。**带外层锁的 wrapper 只提供给 remote，不注入已经持有团队锁的 admission 调用链**，避免非重入锁死锁。现有 prober 自己的 Promise chain 不能替代与 admission 共用的团队锁。

#### handler 修改

`compatibility.get / acknowledge / probe`：

- 先执行既有 ownership、trigger、principal/caller 校验。
- 再获取 `options.compatibilityFor(teamSessionId)`。
- 对该对象调用 current/acknowledge/probe。
- state-absent 等消息中的 root ID 改成被寻址的 teamSessionId。
- 不手工再增加一次 generation；原 prober 的 durable 写已经负责推进目标团队 generation。
- 不复制其他团队的 ACK、fingerprint 或探测结果。

如果最后因具体接线阻塞无法完整交付这项，唯一可接受的临时止损是对无法正确解析 scope 的请求返回已登记的 typed unavailable、零错误团队写入，并在 Draft PR 标注该限制。不能保持错写后返回成功；不能把该临时限制说成已完整修好。

### S1-C1：把 projection store 状态接到 TeamView

**文件：**

- `packages/client/src/state/team-projection-store.ts`
- `packages/client/src/plugin/team-mount-core.ts`
- `packages/client/src/ui/TeamView.tsx`
- `packages/client/src/ui/locales.ts`
- `packages/client/src/ui/TeamView.module.css`
- 插件的 hook 注入类型与测试 fixture；验证通用 renderer 能正确绑定新增 hook，不要求修改 DSH 上游 renderer 源码。

复用现有 `TeamProjectionState`，不要另造一套远端状态协议。新增客户端可观测集合，例如：

```ts
type TeamProjectionStates = Readonly<Record<string, TeamProjectionState>>
```

在 mount 创建 `projectionStatesStore`，通过 `TeamViewInjected.hooks.projectionStates` 传入视图，并接入实际 renderer 的 hook。

**关键顺序：** 当前订阅回调在 `frame === null` 时提前 return。必须先发布完整 store state，再处理 frame/mirror/ledger，否则最需要显示的首次失败仍然不可见。发布时维持 snapshot 身份稳定；reset/dispose 清理对应状态和订阅。

TeamView 按 `resolution?.team.teamSessionId ?? sessionId` 选择当前状态。视图行为：

| 内容 | 状态 | 必须展示 |
| --- | --- | --- |
| 无帧 | 尚未开始或初次读取中 | 加载中；不要断言“未加入团队” |
| 无帧 | RPC 错误、transport loss、foreign/inconsistent | “团队信息加载失败”或“尚未成功加载”，code/message、重试、持久团队入口 |
| 有帧 | 刷新中 | 保留成员和时间线，轻量 pending 状态 |
| 有帧 | 刷新失败 | 保留旧内容，显示“更新失败，当前显示上次成功的数据” |
| 有帧 | 成功或正常 duplicate/stale 判定后 ready | 正常内容，清除已恢复的失败提示 |

`FOREIGN_TEAM` 不可直接转换为“无团队”；底层 get 异常、冷 member 寻址等也可能走到它。阶段 1 仍保留普通会话的创建入口，但使用中性文案。只有阶段 2 的权威 resolver 才能给出明确无关联结果。

错误展示以当前 status/assessment 为准，不单凭 `lastError` 属性存在判断：旧实现的 duplicate/stale 分支可能保留旧 lastError。成功恢复时要清理或停止展示过期错误。

### S1-C2：新增可等待的只读刷新，修复治理后的刷新反馈

**文件：** `team-mount-core.ts`、`TeamView.tsx`、`TeamGovernance.tsx`、相关治理 model/类型、`locales.ts`，必要时调整 ledger refresh 的返回类型。

1. 将公开 `pullProjection` 的返回值从 `Promise<unknown>` 收紧为已有的 `Promise<ProjectionSyncAssessment>`。
2. 在正常团队视图和无帧失败区域均提供“刷新团队视图”按钮。pending 时防重复点击；失败后可重试。
3. 捕获本次 sessionId、root ID 和请求 epoch。已有 resolution 用 root；无 resolution 阶段 1 沿现有候选 root 读取，不私自启动或恢复 agent。
4. 独立启动并等待 roots 重读；另一路先 await projection pull，再刷新当前可解析 root 的 ledger。
5. 冷投影成功后 mirror/ledger store 才建立，因此 ledger refresh 必须在 projection pull 之后。已有旧帧时，即使投影失败，仍允许独立尝试 ledger 读取；无 root 可解析的 no-op 不能显示成“ledger 刷新成功”。
6. **同 generation 的手动刷新也要尝试 ledger refresh。** 现有自动 ledger 刷新只在 applied generation 前进时触发，不能覆盖这个场景。
7. Promise resolve 不等于成功：`rpc-error`、`transport-loss` 等 assessment 也以 resolve 返回。检查结果并展示对应失败，不用成功 toast 掩盖失败。
8. 把 roots effect 内的请求逻辑提取为可 await 的 helper。手动调用不受 `creationOpen` 的自动读取 guard 限制；旧 session/卸载后的迟到响应不能覆盖新状态。
9. roots 状态允许保留上次成功 rows，同时展示 pending/error；不要为了显示错误先清空整个旧列表。

治理操作成功后的 pull 不能继续无反馈地 `void` 掉：业务操作与读回结果分开表达，例如“重新检查已完成，但团队视图更新失败”。不要因刷新失败自动重发原 mutation。成员命令成功后的后台读取也应通过同一可见状态面报告失败。

已有 effect 已包含 sessionId；增加同一个依赖不是修复。也不要使用 compatibility.reprobe 或 ensureRootLive 实现读取刷新。

### S1-C3：修正 transport loss 的过期判断

**文件：** `packages/client/src/state/team-projection-store.ts`。

当前 catch 中以 `channel === 'connected'` 判断失败过期，会把“上一轮成功，下一轮真的断联”也忽略。补入请求序号和 reset/连接 epoch：

- 只有该失败请求发出之后，确实已有更新请求完成有效 round trip，才可把该失败作为过期结果忽略。
- 顺序的成功 → 新请求 transport loss，必须进入 reconnecting/失败并安排一次重试。
- 较早请求失败迟到，不能覆盖较新请求已成功的状态或新增多余重试。
- reset、切换作用域或 dispose 后，旧请求不能复活状态或定时器。
- durable frame 仍由现有 generation/provenance 判定决定是否应用；请求序号不能允许旧 generation 覆盖新帧。

不要只删除 connected guard。补相应两类时序测试后修改；成功恢复（包括相同 generation 的正常响应）应结束错误状态。

## 4. 阶段 1 必须补齐的测试

优先扩展已有测试；只有跨模块场景缺合适 fixture 时才新增小测试文件，不另造通用测试框架。

| 编号 | 文件或建议新增位置 | 必须验证的行为 |
| --- | --- | --- |
| H1 | `packages/runtime/test/p8s7r2-disposed-history.test.ts` | 合法 grant 后真实 readPort→project 成功；total 与八类和一致；control +1、pending 不变；disposed history 计数和序列正确 |
| H2 | 同上或独立 projection 回归 | 其他 root、相同 instanceId 的 grant 不污染本队；真正未知 fact 仍失败；缺 binding 的合法既有状态不被新修复误拒绝 |
| H3 | `packages/runtime/test/p8s6-remote-commands.test.ts` | 经真实 registered dispatcher，合法 grant 写入后 `team.getProjection` 从旧代码的失败变为成功，不只 mock 成功 DTO |
| H4 | 新增 `packages/runtime/test/team-compatibility-scope.test.ts` | A/B 不同绑定蓝图；get(B) 读 B；reprobe/ack(B) 只改 B，A 的 compatibility/TeamSession generation 不变；foreign 在 resolver 前拒绝 |
| H5 | H4 + 既有 operation-fencing fixture | 同 B 的 remote probe 与 admission inline probe 用受控 barrier 并发；remote compatibility.current 与持同一团队锁的相关操作不观察 delete/put 替换空窗，无丢失推进、无嵌套锁死锁；FATAL ACK 仍拒绝。此项不承诺未持锁的任意 repository/projection 读取具备全读原子性 |
| C1 | `packages/client/test/ledger-adapter.test.ts` | grant 被分类 control，raw payload 保留；不新增 controls/pending；混入一个真实未决 request 时只计该 request |
| C2 | `packages/client/test/team-ledger-model.client.spec.ts` | 经 adapter 已带 control category 的 grant，在 all/control Events 筛选都隐藏；原始条数和分页完整性不被隐藏操作修改 |
| C3 | `packages/client/test/team-projection-store.test.ts` | success→loss、旧 loss 晚于新 success、typed error 后恢复、reset 后迟到请求、低 generation 防倒退 |
| C4 | `packages/client/test/client-plugin-mount.test.ts` | frame=null 的错误状态也会发布；真实状态 hook 注入；pull assessment 不丢；冷成功后能打开/刷新 ledger |
| C5 | `packages/client/test/team-view.client.spec.tsx` | 首次 loading、无帧失败、有帧失败保留内容；两种视图均可刷新；恢复后清除错误；无帧失败不能显示肯定无团队 |
| C6 | `packages/client/test/team-roots-zero-state.client.spec.tsx` | 显式刷新旧列表；创建面板打开时手动刷新仍有效；错误保留 rows；旧请求不覆盖新请求 |
| C7 | `packages/client/test/team-governance.client.spec.tsx` | mutation 成功、随后的 projection pull 失败时，分别展示两项结果；刷新失败不得重发 mutation |

H1 可沿用既有 fixture：原本本 root 有 12 条事实、pending 为 1，DH1 digest 有 9 条、control 为 1。派生新 fixture，追加合法 grant（使用 `buildArtifactReadGrantedPayload`，不要空 payload），例如 sequence 14：期望 total=13、control=2、latestSequence=14、pending=1；DH1 factCount=10、control=2、lastSequence=14，disposedAt 不变。执行时核对当前 fixture，若基线已变，保留原理，不硬凑这些数字。

### 4.1 定向测试命令

从插件仓库根目录执行；新增测试文件由本任务创建后再运行：

```bash
pnpm --dir packages/runtime exec vitest run \
  test/p8s7r2-disposed-history.test.ts \
  test/p8s6-remote-commands.test.ts \
  test/team-compatibility-scope.test.ts \
  test/p7t1-probe-generation.test.ts \
  test/p7t1-ack-fingerprint.test.ts \
  test/p8s6-principal.test.ts

pnpm --dir packages/client exec vitest run \
  test/ledger-adapter.test.ts \
  test/team-ledger-model.client.spec.ts \
  test/team-projection-store.test.ts \
  test/client-plugin-mount.test.ts \
  test/team-view.client.spec.tsx \
  test/team-roots-zero-state.client.spec.tsx \
  test/team-governance.client.spec.tsx \
  test/team-ledger-store.test.ts

pnpm typecheck
pnpm test
pnpm lint
```

**根 `pnpm test` 只匹配 `*.test.ts`，不会覆盖全部 `*.client.spec.ts(x)`。客户端包测试是独立必跑项。** 仓库 `test:node` 是另一个范围有限的 runner，也不能代替 React/UI 测试。

新场景必须全部通过。根套件或 lint 有既有债务时，和本次实际 base SHA、同一环境的基线按文件/测试名或规则对比；不要只比较总失败数。不得改 skip/timeout/断言来隐藏新增失败，也不在本轮顺手修所有历史债务。仅为确认具体 flake 或新增差异做必要复跑。

## 5. 阶段 1 构建、真实页面验证与 PR

### 5.1 构建并提交真正被安装的代码

安装入口加载 `packages/runtime/dist` 与 `packages/client/composition-shim/client-bundle.js`。只改 TS 不够。

```bash
pnpm build
node scripts/place-dist-glue.mjs
node scripts/build-client-composition.mjs packages/client packages/client/composition-shim
```

审查 diff 后，把本次源码、测试、修复说明，以及生成的 `packages/runtime/dist`、`packages/client/composition-shim` 一并 stage。随后：

```bash
pnpm check:artifacts
pnpm smoke:composition
```

`check:artifacts` 比较 git index 与生成物，因此首次生成后尚未 stage 时出现 drift，并不等于编译失败。正确顺序是生成 → 审查 → stage 对应产物 → 检查。不能手改 bundle/dist，也不能为了绿灯遗漏产物。`pnpm build:composition` 包含上述生成与检查步骤，可在理解 index 检查前提下使用。

最终 commit 同时包含 source 与它对应的 install-surface artifacts。若修改 `.mjs` glue，额外确认 placement 源与 dist 副本一致。

### 5.2 最小真实宿主与浏览器验收

复用已经适配 0.1.7 的测试启动/鉴权/mock model 基础，例如 `tests/kits/work-completion-wakeup-smoke/` 的设施；不要照抄仍依赖旧版本的 kit 假设。若需新 kit，建议建 `tests/kits/team-projection-recovery-smoke/`，路径和 pin 从 `tests/paths.mjs` 读取。

阶段 1 可用合法合成 fixture 注入包含 grant 的测试域，验证安装后的 handler 和页面；阶段 2 再要求真实 spill writer 的全链测试。合成数据写入只发生在隔离 home。初始 JSON fixture 必须在测试宿主启动/open 域之前布置；页面打开后增加成员或事件，必须经该测试宿主实际持有的 repositories 或公开 mutation 入口写入，不能直接修改已打开域背后的 `team_domain.json` 并期待宿主自动重读。

使用已有 browser-skill/vision 工具，完成并亲自查看以下真实页面截图：

1. 带 grant 的 root 冷打开：显示团队身份和成员；列表、详细投影均读取成功。
2. 向测试数据增加一个成员或一条有效事件后，点击“刷新团队视图”：成员/时间线更新，无需 compatibility.reprobe。
3. 受控失败：无帧时显示加载失败；有旧帧时保留内容并显示过期提示。
4. 恢复读取后重试：错误消失，内容恢复。
5. 对非 boot root 执行兼容性 get/reprobe/ack：目标团队变化，其他团队记录不变。

受控失败可通过测试服务/浏览器请求拦截实现，不向用户真实 ledger 写入故意损坏的事实。截图必须由真实 served bundle 渲染，不用手工 HTML 模拟。

记录目标测试 origin、实际 sessionId、Request Payload 与 Response（尤其 getProjection），不要只存截断的 Console 摘要。Team RPC 是 Fetch POST `team-remote/<method>`，不是 WS。保存证据前移除 cookie、launch token 与认证查询串。

UI 事件数不必等于 raw ledger 总数：内部授权事实按既有规则隐藏。成员数量也要标明是否包含 leader。

### 5.3 两小时时间盒

| 时间 | 工作 |
| --- | --- |
| 0–10 分钟 | 锁定 base、任务 worktree、测试环境与受保护现场；建立核心失败用例 |
| 10–40 分钟 | H1 分类修复与 H2 compatibility 接线；相关定向测试 |
| 40–80 分钟 | 客户端状态、手动刷新、治理反馈、transport 时序修复与 UI 测试 |
| 80–110 分钟 | 类型/相关回归、生成产物、隔离 served bundle 验证与截图；基线对照可并行只读执行 |
| 110–120 分钟 | 独立审查、修复证据整理、scoped commit、push、创建 PR |

时间表是目标分配，不要求在用例未通过时硬推进。若发现 v6、自动轮询、全量 session resolver 等需求，放到阶段 2，不侵占阶段 1 的验证时间。新的关键安全/正确性失败不能因为时间盒被忽略。

### 5.4 阶段 1 退出条件

- [ ] 合法 grant 不再阻断投影；原始 ledger 与授权行为未被删改。
- [ ] count、pending、disposed history 和 Events 隐藏规则共同正确。
- [ ] A/B compatibility get/reprobe/ack 作用域隔离、蓝图绑定和团队锁验证通过。
- [ ] 初次投影失败不再显示肯定“未加入团队”；旧帧失败有明确提示。
- [ ] 专用只读刷新能等待真实结果，能够更新投影、ledger 和 roots。
- [ ] 顺序 success→transport loss 不再静默；旧失败不会盖过新成功。
- [ ] 新测试全通过，整体检查没有新增确定性失败；既有失败有同基线对照。
- [ ] 源码、重建产物和实际 served bundle 一致；真实浏览器证据已检查。
- [ ] 已推送任务分支并创建 PR，PR 明确列出阶段 2 剩余项。

阶段 1 不承诺 agent 工作期间自动刷新，也不承诺冷 member 首次进入时已具备完整归属解析。它们必须在 PR 限制说明中列出，不能将快速恢复说成完整修复。

## 6. 阶段 2：完整修复 PR

建议分支：`fix/team-view-sync-complete-20260927`。基于阶段 1 的已审查提交。如果阶段 1 尚未合并，阶段 2 可以建依赖 PR，base 指向阶段 1 分支；合并后再正常调整 base，不改写 gated 历史。

### S2-R1：新增轻量权威读取，统一归属与更新版本

新增 remote contract v6；当前若已被后续工作占用，选择下一个未用版本并记录。**v1–v5 继续支持，现有 wrapper 的默认版本不变。** 这是插件协议扩展，不改 DSH Connection carrier。

新增 `team.getReadState`：

```ts
// request params, closed shape
{ sessionId: string }

// success data, closed discriminated shape
{
  resolution:
    | { kind: 'none' }
    | { kind: 'team-root'; teamSessionId: string }
    | { kind: 'team-member'; teamSessionId: string; instanceId: string },
  readState: null | {
    sourceEpoch: string,
    teamSessionId: string,
    generation: number,
    liveRevision: number
  }
}
```

约束：none 对应 readState=null；root/member 必须有匹配的 readState。sourceEpoch 是本次 production root/读服务实例的非持久标识，不用 PID、mtime、fiber UID 冒充。generation 是已有 durable generation。liveRevision 是本实例该团队 live 视图的单调修订号，可从 0 开始，不能持久化成团队业务写入。

归属读取复用 `team-ownership-index.ts` 的完整性规则与已有 repositories：读 `team_sessions`、`member_instances`、`session_bindings`，不读 ledger、不计算完整 projection、不调用 ensure/resume/admit。实现新的针对单个 session 的 helper 时，复用相同验证规则；不能为了性能把 missing binding 一律当成 none。

- root 行存在而 binding 尚未写入：沿当前已认可的合法中间状态识别 root。
- member 行有正确 childSessionId 而 binding 缺失：仍可建立成员归属。
- 冲突绑定、损坏记录、存储异常：typed error，不能返回 none。
- none 的语义是“当前宿主团队域未找到该会话的关联”，不宣称全局其他宿主从未创建过它。

liveRevision 只在可观察 live 状态变化时推进。比较稳定的、按 `(teamSessionId, instanceId)` 标识的 residency/resuming 等 live 字段；不要用每次读取都会变化的 `now()`、`lastActivityAt` 或投影生成时间作为变更依据。相同 `inst-leader` 属于不同团队时不能串数据。提取目标团队的 live snapshot helper，避免高频读取每次扫描所有团队，并将它接到实际 projection service：当前 `LiveResidencyOverlayPort.snapshot()` 没有 root 参数，单独修改 revision helper 不能修复完整投影中的跨团队污染。将该 port 改为 `snapshot(teamSessionId)` 或等价的按目标 root 取快照接口，保持插件内部改动。

### S2-R2：给 v6 投影返回同一次快照的读取标记

`team.getProjection` 的 v6 变体成功 data 为：

```ts
{
  projection: ExistingProjectionDto,
  readState: {
    sourceEpoch: string,
    teamSessionId: string,
    generation: number,
    liveRevision: number
  }
}
```

v1–v5 的成功 data 仍是现有 `{ projection }`，projection DTO 本身不增加字段、不伪增 durable generation。v6 metadata 必须从该次实际返回的 projection/live snapshot 派生，不能先读一个旧 stamp，再在等待后拼上另一份新 frame。`project(root)` 与它附带的 readState 必须消费同一次目标 root 的 live snapshot；不得再从全局 `Map<InstanceId, ...>` 取一份 overlay 拼接元数据。必要时在 projection service 内部增加带标记的读取结果，保留旧调用方需要的 DTO 返回接口。

`getReadState` 与 v6 projection 共用实例标识和 live 修订管理逻辑。轻量请求可能先看到 revision r，而后续完整请求已是 r+1，这是正常前进；客户端以完整响应携带的标记为准。

具体接线文件：

- `packages/remote/src/contracts/version.ts`：支持集、类型与 v6 常量。
- `packages/remote/src/contracts/catalog.ts`：新方法与版本可用性。
- `packages/remote/src/contracts/params.ts`、`types.ts`：闭合输入输出形状与校验。
- `packages/remote/src/handlers/ports.ts`、`team.ts`：只读 port、handler 及版本化 projection 输出验证。
- `packages/remote/src/index.ts`：导出新增类型/常量。
- `packages/runtime/src/team-ownership-index.ts` 或新增相邻 `team-read-state.ts`：纯归属读取。
- `packages/runtime/src/plugin/root.ts`、`s6-remote.ts`、`s6-live-overlay.ts`：生产 port、sourceEpoch、liveRevision 与目标 root 过滤。
- `packages/runtime/projection/types.ts`、`service.ts`：按目标 root 的 live snapshot port，以及 projection/readState 的同次快照接线；补充对应 fold/overlay 测试。
- `packages/client/src/transport/team-remote-client.ts`：独立 v6 wrappers；普通 generic call 继续默认 v1。
- `packages/remote/src/push/pull.ts` 或相邻新 v6 frame 解析模块，以及 `packages/client/src/state/team-projection-store.ts`：解析并保留 readState，由 store/协调器持有最后接受的 sourceEpoch/liveRevision。现有 `extractPushFrame` 只保留 `{ projection, provenance }`，不能让 v6 结果经过旧路径后丢掉标记；可以保持旧抽取器和 v1–v5 `RemotePushFrame` 形状不变，另设 v6 解析结果。

客户端解析必须交叉校验 `readState.teamSessionId/generation`、projection 与 provenance 相符，并测试实际 served client 从 HTTP 解析到 store 的完整路径，不能只验证 transport wrapper 返回了 metadata。

仓库存在公共 remote handler 和实际 S6 dispatcher 两条分发实现，必须同步接线并做协议一致性测试。不要只改一个 catalog，让另一个 switch 在运行时仍拒绝新方法。

### S2-C1：可见页面自动刷新协调器

新增 React-free 的客户端协调器，例如 `packages/client/src/state/team-refresh-coordinator.ts`，由 `team-mount-core.ts` 所有和释放；TeamView 仅注册可见 session 的观察租约，不为每一行成员创建 timer。

确定行为：

1. TeamView 首次可见时立即 getReadState，权威解析 root/member；member 按解析出的 root 拉投影，再选择对应成员。
2. 可见时每 3 秒读取一次轻量 read state；页面 hidden、Team tab 不再可见或观察者为 0 时暂停。重新可见立即检查。
3. frame 为空、上一轮失败、generation 前进、liveRevision 前进或 sourceEpoch 改变时，读取 v6 projection。
4. 正常同标记时不反复拉完整 projection，不为查询 freshness 扫描 ledger。
5. 每个 root 最多一个刷新任务在途；期间的新失效用 dirty 标记记录，完成后补一次读取，不能只返回旧 Promise 丢掉最后一次变化。避免无间隔无限重试循环。
6. HTTP/typed 错误可见并使用有上限的 backoff；正常恢复后回到 3 秒检查。每次 dispose/reset 取消 timer，迟到请求由 epoch 拒绝更新。
7. 可用的公开 `api-session/status` 事件可以加速触发一次检查，但不是正确性依赖。它不等于每一次 team mutation 通知，长 turn 仍由轮询兜底。
8. 旧宿主不支持 v6 时，显示自动刷新不可用，保留阶段 1 手动读取能力；不要退化为每 3 秒调用错误端点，也不要假装自动同步正常。

**验收时间界限：** 在测试环境请求正常完成、Team 页持续可见时，成员创建、settle/archive、消息/活动事实等 durable 变化在约 5 秒内出现；失败时以错误状态代替时效承诺。

### S2-C2：durable 与 live 更新分开接受

当前 `assessProjectionSync` 对相同 generation 判 duplicate；这是 durable 防倒退规则，不能为了 live 更新直接删除。

- durable generation 增大：经现有 team/provenance/schema 校验后应用完整帧。
- durable generation 相同、sourceEpoch 相同、liveRevision 增大：使用单独的 live 更新路径，仅替换已声明的 live 字段；成员集合、lifecycle、蓝图、ledger 摘要等 durable 部分不得改变。
- 同 generation 的 durable 字段发生变化：作为版本覆盖缺陷报告/拒绝，不用 live 更新路径偷偷接受。比较必须使用明确的持久字段集合，排除 `projection.generatedAt` 和整个 `members[].liveActivity`（含 `lastActivityAt`）；当前 fold/overlay 会在读取时生成新时间戳，不能把这种变化判成 durable 不一致。`lastActivityAt` 不参与 liveRevision 推进判断。
- 旧 liveRevision、旧请求 epoch、其他 root 的响应：不能盖过新状态。
- sourceEpoch 改变：执行一次明确的 rebaseline，隔离全部旧请求并重置 live/read 标记，展示正在重新建立基线。generation/liveRevision 的单调规则以同一个 sourceEpoch 为边界；同 epoch 禁止 generation 倒退，跨 epoch 经新 authority 读取建立基线时允许较低 generation，但不能保留未经验证的旧 ledger 作为当前事实。按 S2-C3 重新验证/重建 ledger 缓存，至少在 generation 回退时 reset 并从 head 重读。

实现可使用独立 live overlay store 与派生 UI snapshot，保持 durable mirror 不变；如采用这一方案，view adapter 按复合成员身份合成数据。禁止将 live 变化持久化为伪 ledger 事件，禁止人为增加 team generation。

同时修正所有 late typed failure 对新成功状态的覆盖，和阶段 1 的 transport 规则保持一致。重复成功后不保留过期错误提示。

### S2-H1：核查 projection 相关 durable 写的 generation 覆盖

自动同步依赖 generation，必须有一个明确的写路径覆盖表。检查成员增删/生命周期、ledger append、compatibility、policy/model override set/reset 等实际投影依赖的写入。

- 修改位置优先是已有 durable mutation/协调层和具体 action handler，不在 UI 伪增版本。
- 实际改变可投影状态的写入，应按当前契约推进正确 root 的 generation；幂等重放和无效 no-op 不重复推进。
- 特别验证 `s6-remote.ts` 的 override.set/reset 相关路径，不能只凭它返回新 override record generation 就假定 TeamSession generation 也前进。
- 多 root 使用相同 instanceId 时，generation、overlay 和 ledger 归属均独立。

### S2-C3：roots 列表与 ledger 的刷新闭环

把 roots 读取状态迁到 mount 所有的共享 observable store，避免同一页面多个组件各保存独立副本。保留阶段 1 的显式刷新、旧 rows 和错误面。

roots 的触发点固定为：首次展示、手动刷新、页面恢复可见、连接恢复、team.create/handoff 创建成功，以及可见 roots picker 每 15 秒一次低频复查。**创建成功的持久提交就是失效点**，不能等后续打开会话或投喂初始 work 也成功；后续失败时团队仍可能已存在。

不同浏览器上下文各自观察当前 handler；低频复查兜底跨标签页创建，不依赖某个窗口的 React state 通知其他窗口。不要为列表的每一行创建 timer。

ledger store 的 refresh 同样要处理 in-flight 时收到新的 generation/失效：至少排队一次完成后的补读。同 sourceEpoch 的正常刷新保留已加载历史页；跨 sourceEpoch 的 rebaseline 必须重新验证缓存，至少在新 generation 回退时 reset 并从 head 重读。未验证的旧历史只可作为明确标注为过期的展示数据，不能并入当前权威计数、分页状态或新事件集合。去重、排序、分页边界和错误恢复分别测试。

可以增加客户端最近创建优先/搜索/本地时间显示，作为可识别性改进；保持远端 v3 roots 响应语义与排序契约不变，不把这些 UX 改进写成历史缺队根因。

### S2-D1：投影错误可诊断，但不泄露内部载荷

增加 typed projection source error，至少为已知分类失败提供稳定 code 和经过筛选的 details：teamSessionId、sequence、factType、sourceEpoch、method/contractVersion、请求关联 ID。未知异常仍按安全边界包装，内部 cause/stack 只进入宿主诊断。

更新 `projection-source.ts`、必要的相邻错误类型模块，以及 `packages/remote/src/handlers/dispatch.ts` 的 backing vocabulary 和 S6 转换逻辑。**仅给 Error 增加 `.code` 而不接白名单，仍会被抹成 internal-error。** v6 明确承载新增诊断语义；v1–v5 保留各自已经定义的响应契约。

diagnostic 只携带定位所需字段，不返回工件正文、locator、opaque digest、环境秘密或完整堆栈。UI 用稳定错误码和重试提示，业务成功但刷新失败仍分开显示。

sourceEpoch 仅用于本次读服务实例识别，不声称它枚举了进程中所有存储 handle。此次不新增通用进程管理或跨进程存储协议。

## 7. 阶段 2 测试与退出条件

建议新增 `team-read-state.test.ts`、`team-refresh-coordinator.test.ts` 等聚焦文件，复用现有 projection/ownership/client fixtures。

| 测试组 | 必须覆盖 |
| --- | --- |
| 协议 | v6 新读端点与 projection metadata 闭合校验；错误参数/版本被拒；v1–v5 既有端点、参数和成功 shape 不变；两套 dispatcher 一致 |
| 归属 | root、cold member、合法缺 binding、普通会话、损坏/冲突绑定；异常不能伪装 none；不启动 agent、不写域 |
| 轻量读取 | ledger port 被设置为抛错时 getReadState 仍可工作；它只依赖归属/根/live 读取；无论失败成功均无持久写 |
| 自动同步 | 真实 agent/tool-originated create/delegate/settle，不触发任何 UI mutation callback，仍在目标界限内更新成员与事件 |
| live | generation 不变时 resident/resuming/cold 变化可见；同名 leader 跨团队隔离；时间戳自然变化不导致每轮伪 invalidation |
| generation 覆盖 | override/policy/compatibility 等变更推进正确 TeamSession；幂等请求不重复推进；另一队不变 |
| 并发 | in-flight + 新失效必有补读；旧 success/error/live 回复不污染新 session/epoch；同 sourceEpoch 的低 generation 不覆盖高 generation；跨 epoch 建立新基线时旧请求隔离；reset/dispose 无残留 timer |
| 可见性 | hidden/卸载停止轮询；恢复可见立即检查；多个同 root 视图共享一次请求；没有 observer 不继续读 |
| roots | 创建成功但 open/admitInitialWork 失败，列表仍更新；另一个窗口创建后可见 picker 最迟在低频复查后更新；失败保留旧 rows |
| ledger | 大量事实分页、内部事实隐藏、去重/顺序、同 generation 手动补读、在途失效补读、断联恢复；sourceEpoch 改变且 generation 回退时重建缓存，旧事实不能混入当前集合 |
| 实际 writer | 真实 spill-store 和 foreground shell 产出合法 grant，再经实际 served getProjection/ledger/Events 验证，不只人工塞一行 JSON |
| 错误 | 已知投影异常在 v6 返回稳定诊断字段；UI loading/error/none/ready 区分；无敏感载荷外泄 |

阶段 2 的自动同步与 live 场景使用注入 scheduler/clock 做确定性单元测试，再用隔离真实宿主和浏览器跑关键垂直场景。不要用长 sleep 掩盖竞态；最多只为实际 UI 时效断言等待既定轮询上界。

### 完整修复退出条件

- [ ] 阶段 1 全部行为与回归保持。
- [ ] 目标团队的详细投影、兼容性、成员与事件均按正确 root 工作。
- [ ] leader 持续运行时，成员与事件可自动更新，无需 UI mutation 或 F5。
- [ ] cold member/普通会话/读取失败由权威结果区分。
- [ ] durable generation 与 liveRevision 的接受规则经过乱序/重连测试。
- [ ] roots 与 ledger 无永久陈旧窗口，后台与卸载无泄漏。
- [ ] 新协议向后兼容；旧宿主有明确降级行为。
- [ ] 真实 spill writer→ledger→projection→UI 的整条链已通过。
- [ ] 实际浏览器截图、原始 RPC 与构建产物可以对应到 PR 的 head SHA。

## 8. PR 描述、证据与发布边界

每阶段 PR 至少写清：

1. **问题与结果：** 用户原来看到什么，哪些代码原因被本 PR 解决。
2. **代码变化：** 分类语义、按团队的 prober、状态/刷新接线；阶段 2 另写 v6 和自动同步规则。
3. **验证：** 失败复现 → 修复后结果、定向测试、包级 UI 测试、全量基线差异、产物 gate、真实页面截图。
4. **限制：** 阶段 1 必须注明仍需手动刷新、冷 member resolver 留到阶段 2；临时降级必须具体列出。
5. **未作推断：** 不宣称历史“列表缺队”的时序已经还原，不宣称 26 roots 相同即消除了所有存储竞争风险。

证据建议放 `dev/agent-workflow/evidence/team-projection-recovery-20260927/phase1/` 和 `phase2/`。记录 base/head、测试命令与退出码、截图说明、安装包/产物来源。不能只给通过数量而不说明实际跑的是哪个配置。

优先提交独立 task 分支，不向 master/stable 直接推送，不 force-push gated 历史。若代码已满足退出条件，创建可审查 PR；若存在未完成必需项，创建 Draft PR 并明确 blocker。阶段 2 不应把阶段 1 的已通过状态和未完成范围混写。

本次执行完成后向用户返回：PR 链接、head SHA、通过的退出条件、剩余项、真实页面验证结果，以及后续安装/重启所需的具体操作说明。不要未经部署安排直接改用户的 profile 或重启现场。

## 9. 代码依据与快速定位链接

以下链接固定到已核对提交；实际执行以记录的 base SHA 为准。

- [宿主分类表与投影读取](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/runtime/src/plugin/projection-source.ts)
- [摘要总数与分类计数契约](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/contracts/src/projection/ledger.ts)
- [客户端 ledger 分类镜像](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/client/src/model/ledger-adapter.ts)
- [内部事实的 Events 隐藏规则](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/client/src/model/team-ledger-model.ts)
- [production root、蓝图解析与接线](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/runtime/src/plugin/root.ts)
- [实际 S6 handler 与 dispatcher](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/runtime/src/plugin/s6-remote.ts)
- [投影 store 与时序处理](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/client/src/state/team-projection-store.ts)
- [客户端 mount、mirror 与 ledger 接线](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/client/src/plugin/team-mount-core.ts)
- [TeamView 零态、roots effect 与页面展示](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/client/src/ui/TeamView.tsx)
- [Remote 版本纪律](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/packages/remote/src/contracts/version.ts)
- [构建产物 gate](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/scripts/check-artifacts-committed.mjs)
- [仓库测试约束](https://github.com/ArmourPiercer1/dsh-agent-team/blob/4a67f6ed870bed19a0d7f4dadac094f33d1009c8/docs/TEST_METHODS.md)
- [DSH 0.1.7 的 Fetch RPC carrier](https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/client/connection/src/client/rpc.ts)

---

**最终原则：先让当前合法数据重新可读、让失败可见并可恢复，再补齐自动同步；不通过删除数据、修改 core 或弱化错误边界来制造表面成功。**
