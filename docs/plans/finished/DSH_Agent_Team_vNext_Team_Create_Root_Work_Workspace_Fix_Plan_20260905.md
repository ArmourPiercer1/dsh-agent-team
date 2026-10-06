# Team 创建链修复详细执行计划

**状态：已归档｜原方案中途作废，未按原 DAG 执行；由同日《Team 创建链最小修复执行计划》收缩取代。**  
**真正执行进度：** 本方案停在预审查/方案阶段；原因是原 Wave 1–3 方案过大，Root initial-work、durable operation 状态与 Remote v2 影响面被低估。后续按最小修复方案执行，实际 D-3 创建链修复于 R140 完成并推送。  
**归档时间：** 2026-09-05（R140 D-3 收口节点）。  
**适用问题**：R140 后续暴露的 Team 创建链缺陷  
**日期**：2026-09-05  
**实现模型**：`qiyuan-self/qwen3.8-27b`  
**约束**：`CORE PATCH BUDGET = 0`；不修改 upstream DSH 源码，不使用 upstream 私有接口

---

## 0. 计划目标

一次性闭合以下两个缺陷，同时保留 R140 已经正确实现的 host-created Leader Root 路径：

1. **有初始任务时创建失败**
   - 不再把 Leader v2 当作普通 Member；
   - 创建时初始任务通过 Root Agent 专用 work seam 投递；
   - 不读取 Leader 不存在的 `lifecycle`、`childSessionId`；
   - 重试不重复投递已经完成的初始任务。

2. **选择的 workspace 没有生效**
   - workspace 从 Creation Panel 进入 `team.create`；
   - 持久化为 `TeamSession.defaultWorkspace`；
   - 决定 host-created Root Agent 的 `cwd`；
   - 创建成功后直接打开所选 workspace 中的 Leader Root；
   - 不进入普通 New Session 流程。

本计划不修改 upstream DSH 源码，不使用 upstream 私有接口，`CORE PATCH BUDGET = 0`。

---

# 1. 已批准并冻结的实现决策

后续实现代理不得重新讨论以下决策；如代码证据证明不可实现，必须按 blocker 流程停止，而不是擅自换方案。

## 1.1 Leader 初始任务

采用：

```text
Root Agent 专用 work executor
+ live deliverRootWork adapter
```

不采用：

- generic `TeamRuntime.follow-up` targeting `inst-leader`；
- 给 Leader v2 添加假的 `lifecycle`；
- 给 Leader v2 添加假的 `childSessionId`；
- 把 initial work 当作 handoff context；
- 修改 upstream agent loop。

拟增加的最小 live interface：

```ts
interface RootWorkDeliveryInput {
  rootSessionId: string
  requestToken: string
  prompt: string
  attachedContext?: string
}

interface TeamAgentBindings {
  // existing members...
  deliverRootWork?: (input: RootWorkDeliveryInput) => Promise<void>
}
```

`deliverRootWork` 只负责真实 Root Agent 输入和 session materialization，不负责业务级持久去重。业务级 admission/replay/settlement 由 runtime 中的 Root work executor 负责。

## 1.2 Workspace contract

扩展本仓所有的 downstream `team.create` contract，增加：

```ts
workspace?: string
```

这里的值是：

```text
TeamWorkspaceOption.path
```

不是 opaque `workspaceId`。

原因：

- `TeamSession.defaultWorkspace` 当前保存 path；
- `agents.create({ meta: { cwd } })` 使用 path；
- Member activation 的 workspace 语义也是 path；
- 不应把 workspace id 错写进 cwd。

字段缺省：

```text
workspace absent
→ 使用 host row config 的 defaultWorkspace
```

冷重试：

```text
durable TeamSession.defaultWorkspace 与请求一致
→ 允许重试

请求 workspace 与 durable workspace 不一致
→ typed mismatch，禁止静默迁移
```

用户已经批准该方案，因此这次变更应记录为用户批准的 downstream contract revision，而不是 `CORE_SEAM_BLOCKER`。

## 1.3 创建顺序

目标顺序：

```text
validate team.create request
→ validate optional initialWork
→ validate required live ports
→ resolve blueprint
→ bind fresh / rehydrate cold
→ start Root Agent
→ execute optional Root initial work
→ return existing { path, durable, bind } response
→ client refresh/open Root session
```

当 initial work delivery 失败时：

- 已经创建的 TeamSession 和 Root identity 保留；
- 返回 typed error；
- root session ID 保留；
- retry 使用同一 root ID 和稳定 request token；
- UI 不创建普通 Session；
- UI 应尝试打开已经存在的真实 Root，再呈现错误状态。

---

# 2. 编排原则

## 2.1 Git 纪律

每个写任务：

```text
1 task
= 1 branch
= 1 worktree
= 1 writer
```

建议使用新的修复 integration branch：

```text
int/team-create-root-work-workspace
```

任务分支建议：

```text
task/tc-c0-workspace-seam-characterization
task/tc-t1-workspace-wire
task/tc-t2-root-work-core
task/tc-t3-root-work-live-adapter
task/tc-t4-client-create-workspace
task/tc-t5-host-create-orchestration
task/tc-t6-composition-regression
task/tc-t7-docs-and-evidence
```

任务提交经定向 review 后，由主代理：

```text
git cherry-pick -x
```

进入 integration branch。

Gate 通过前不合入 `master`。

## 2.2 所有子代理的固定第一步

每个实现、测试、review 子代理的 prompt 都必须以以下内容开头：

```text
第一步读取：
1. docs/ROUTER_RULES.md
2. docs/TEST_METHODS.md

随后只读取任务 brief 指定的 context pack。
禁止扫描 SESSION_ROUTER_LOG.md 和 graph.yaml 获取需求语义；
它们由主代理负责维护。
禁止修改 references/deepseek-harness-test-use。
禁止触碰 :3080 和 D:\deepseek-harness\。
```

## 2.3 上下文隔离原则

任务不按传统“前端/后端大模块”划分，而按代理需要理解的上下文集合划分。

每个实现代理只需掌握以下一种局部心智模型：

1. upstream workspace/session 归属；
2. Team Remote wire；
3. Root work durable executor；
4. live Root Agent 输入；
5. Creation Panel 请求和导航；
6. `team.create` host transaction；
7. 真实 composition 测试。

共享复杂度集中在 interface 和 integration branch，不让多个代理各自重新推导全链。

---

# 3. 执行 DAG

```text
P0 主代理准备
│
├────────────── Wave 1：三个任务并行 ──────────────┐
│                                                  │
│  C0 Workspace seam characterization              │
│  T1 Workspace Remote wire                        │
│  T2 Root-work core interface + executor          │
│                                                  │
└───────────────────┬──────────────────────────────┘
                    │
                 G1 集成闸
                    │
       ┌────────────┼───────────────┐
       │            │               │
       ▼            ▼               ▼
Wave 2 T3        Wave 2 T4       Wave 2 T5
live adapter     client UI       host transaction
       │            │               │
       └────────────┼───────────────┘
                    │
                 G2 集成闸
                    │
       ┌────────────┴────────────┐
       │                         │
       ▼                         ▼
Wave 3 T6                    Wave 3 T7
composition/E2E              docs/evidence
       │                         │
       └────────────┬────────────┘
                    │
             全链验证 + 用户场景复现
                    │
             3 个独立盲审并行
                    │
         PASS / 补充后完整重新盲审
```

理论最大实现并发：

- Wave 1：3 个代理；
- Wave 2：3 个代理；
- Wave 3：2 个代理；
- Gate：3 个 reviewer。

---

# 4. P0：主代理准备阶段

## P0-1 建立任务基线

主代理完成：

1. 确认 `master` 和 origin 状态；
2. 确认 R140 tip；
3. 建立 `int/team-create-root-work-workspace`；
4. 为每个任务建立 branch/worktree；
5. 在 evidence 下建立本次任务目录；
6. 记录用户批准的 contract revision；
7. 生成每个任务独立 brief。

建议 evidence 目录：

```text
dev/agent-workflow/evidence/team-create-root-work-workspace/
```

## P0-2 写入不可变 acceptance matrix

在任务 brief 中固定以下矩阵：

| 场景 | Workspace | Initial work | 预期 |
|---|---|---:|---|
| A | absent | absent | host default workspace，打开 Leader，无首轮 |
| B | selected B | absent | B 中创建并打开 Leader，无首轮 |
| C | selected B | present | B 中创建 Leader，Root 收到首轮 |
| D | selected B | same retry | 同 root、同 workspace、初始任务不重复 |
| E | selected B → retry C | changed | typed workspace mismatch |
| F | selected B | malformed | bind 前失败，无残团 |
| G | selected B | delivery failure | Root 保留，typed error，同 ID 可重试 |
| H | selected B | seam missing | bind 前 typed unavailable |
| I | selected B | present + restart | workspace、Leader identity、tools 保持 |

## P0 预计时间

```text
20–30 分钟
```

---

# 5. Wave 1：三个并行任务

## C0：Workspace/session 归属 seam characterization

### 目的

在任何产品实现前确认：

```text
agents.create({ meta.cwd: registeredWorkspacePath })
```

是否足以让 native session list 将该 session 投影到对应 workspace。

这是 workspace 方案中唯一仍需实证的 upstream public behavior。

### 允许读取的 context pack

只读：

- `docs/ROUTER_RULES.md`
- `docs/TEST_METHODS.md`
- upstream：
  - `references/deepseek-harness-test-use/packages/api/session-controller/`
  - `references/deepseek-harness-test-use/packages/api/workspace-controller/`
  - `references/deepseek-harness-test-use/packages/session/`
  - `references/deepseek-harness-test-use/packages/workspace/`
- Team glue 中仅：
  - `packages/runtime/src/plugin/live/agent-bindings.mjs:1004-1065`

不要求读取：

- Team UI；
- action router；
- Remote handler；
- historical logs；
- 整个 runtime root。

### 工作内容

1. 静态确认 session list/workspace projection 的归属规则；
2. 使用独立临时 DSH_HOME 和非 3080 端口做最小 characterization；
3. 创建 workspace A/B；
4. 直接使用公开 Agent 创建路径，在 `meta.cwd = pathB` 下创建 session；
5. 检查 workspace B 的 `sessionIds` 或同等公开投影；
6. 确认 restart 后归属是否稳定。

### 输出

只写：

```text
dev/agent-workflow/evidence/.../C0/
```

和任务报告，不修改产品代码。

### 判定

#### GREEN

```text
meta.cwd = registered workspace path
→ native workspace projection recognizes the session
```

T3/T5 按当前方案继续。

#### PUBLIC_ATTACH_REQUIRED

如果需要一个现有 public attach seam：

- 报告 seam 名和调用顺序；
- 主代理将其加入 T3/T5 brief；
- 仍不修改 upstream。

#### CORE_SEAM_BLOCKER

仅当：

- `meta.cwd` 不产生归属；
- 没有公开 attach seam；
- 唯一办法是 upstream 私有接口或 core patch。

此时停止 workspace 实现，不影响 Root initial-work 子任务继续。

### 预计时间

```text
20–35 分钟
```

---

## T1：Workspace Remote wire

### 代理只需要理解

```text
一个 optional workspace path 如何从 Remote JSON
经过 parser 和 handler 原样到达 runtime port
```

不需要理解 React、Agent、Leader 或 TeamRuntime。

### 独占文件范围

主要文件：

- `packages/remote/src/contracts/params.ts`
- `packages/remote/src/handlers/team.ts`
- 对应 `packages/remote/test/` 测试
- 必要的 remote README/JSDoc

禁止修改：

- `packages/runtime/src/plugin/s6-remote.ts`
- `packages/client/`
- `agent-bindings.mjs`

### 实现内容

1. `RemoteTeamCreateParams` 增加：

   ```ts
   readonly workspace?: string
   ```

2. `REMOTE_TEAM_CREATE_FIELDS` 增加 `workspace`；
3. parser 接受非空、合规长度、无控制字符的字符串；
4. handler 将 workspace 传给 Team create port；
5. `S6RemoteTeamCreatePort` 的最终类型由 runtime owner 消费，不在本任务跨包修改；
6. unknown fields 仍然 fail closed。

### 测试

必须先新增红测试：

- absent workspace；
- valid workspace；
- empty workspace；
- non-string workspace；
- control-character path；
- unknown field；
- handler forwarding；
- JSON lossless behavior 不变。

### 验收

```text
workspace absent stays absent
workspace valid is preserved exactly
invalid workspace fails before port call
existing initialWork behavior remains byte-compatible
```

### 预计时间

```text
30–45 分钟
```

---

## T2：Root-work core interface 与 durable executor

### 代理只需要理解

```text
Leader 是 Root，不是普通 Member；
Root work 如何 admission、dedupe、deliver、settle。
```

不需要理解 React、Remote JSON、workspace UI 或 DSH workspace registry。

### 独占文件范围

建议新增深模块：

```text
packages/runtime/root-work/
  index.ts
  types.ts
  executor.ts
  errors.ts
```

允许修改：

- `packages/runtime/src/plugin/types.ts`
- 新增 `packages/runtime/test/root-work-*.test.ts`
- 必要的 runtime exports/tsconfig

避免修改：

- `s6-remote.ts`
- `root.ts`
- `agent-bindings.mjs`
- client/remote package

### 外部 seam

保持小 interface：

```ts
export interface RootWorkDeliveryPort {
  deliver(input: {
    rootSessionId: string
    requestToken: string
    prompt: string
    attachedContext?: string
  }): Promise<void>
}

export interface ExecuteRootWorkInput {
  rootSessionId: string
  requestToken: string
  prompt: string
  attachedContext?: string
}

export interface RootWorkExecutor {
  execute(input: ExecuteRootWorkInput): Promise<RootWorkOutcome>
}
```

复杂性隐藏在 executor 内，调用者不需要理解：

- ledger scan；
- replay/resume；
- admission fact；
- settlement fact；
- delivery failure classification；
- activity close；
- Leader record schema。

### Executor 行为

1. 读取 TeamSession 和 team-root binding；
2. 验证 Leader identity 是 Root identity；
3. 不读取 Leader `lifecycle`；
4. 不读取 Leader `childSessionId`；
5. 通过共享 team lock 运行；
6. 使用 root-scoped request token 去重；
7. admission fact 写入目标类型：

   ```json
   {
     "targetKind": "root",
     "rootSessionId": "...",
     "requestToken": "...",
     "prompt": "..."
   }
   ```

8. 调 `RootWorkDeliveryPort.deliver()`；
9. 写 settlement fact；
10. delivery fault 时记录失败 settlement，并返回 typed error；
11. 已 settle token 重试返回 replay，不重复 delivery。

### 兼容性 admission

Root initial work 是新工作，必须经过与普通 work 相同的 compatibility authority，但不能经过 Member lifecycle gate。

实现时：

- 注入现有 compatibility admission closure；
- 注入与 TeamRuntime 相同的 `coordination.chains`；
- 不在 executor 内重建 compatibility 规则。

### 测试世界

必须构造真正生产形状：

```text
TeamSession exists
team-root binding exists
Leader v2 exists
Leader has no lifecycle
Leader has no childSessionId
```

测试不得使用带 v1 leader 的 `createP6T2World` 作为唯一正例。

### 测试

- v2 Leader 正常投递；
- 不读取 lifecycle；
- 不读取 childSessionId；
- same-token replay；
- admission fact 后 delivery；
- delivery 后 settlement；
- delivery failure 有失败 settlement；
- compatibility blocked；
- TeamSession missing；
- binding missing；
- Leader row missing 时按 Root identity 规则处理；
- different roots + same prompt 不冲突；
- generic Member executor 不被修改为接受 Leader。

### 预计时间

```text
45–70 分钟
```

---

# 6. G1 集成闸

Wave 1 三任务完成后，主代理：

1. 定向 review 每个任务 diff；
2. 独立运行各任务 focused tests；
3. `cherry-pick -x` T1、T2；
4. C0 为 evidence-only 时记录结论；
5. 运行 Remote + runtime root-work typecheck；
6. 更新 Wave 2 brief 中的最终 interface。

必须在这个点冻结：

```text
Remote field name = workspace
RootWorkDeliveryPort exact fields
RootWorkOutcome exact fields
typed errors
fact payload vocabulary
C0 workspace attachment conclusion
```

后续三个代理只消费这些 interface，不再自行修改。

预计：

```text
15–25 分钟
```

---

# 7. Wave 2：三个并行实现任务

## T3：Live Root Agent delivery adapter

### 代理只需要理解

```text
如何将一个 Root work 输入真实提交给已创建的 Root Agent。
```

不需要理解：

- Remote parsing；
- React；
- TeamSession 创建事务；
- workspace wire；
- durable ledger dedupe。

### 独占文件范围

- `packages/runtime/src/plugin/live/agent-bindings.mjs`
- live adapter 的 focused tests
- 如 G1 已冻结类型，原则上不再修改 `plugin/types.ts`

禁止修改：

- `s6-remote.ts`
- `root.ts`
- root-work executor
- client/remote

### 实现

新增：

```js
async function deliverRootWork(input) {
  const sid = String(input.rootSessionId)
  const handle = await ensureLiveAgent(sid)
  await prepareAgentForRequest(sid, sid)

  const text = input.attachedContext
    ? `${input.prompt}\n\n[attached-context]\n${input.attachedContext}`
    : input.prompt

  const message = createUserMessage({
    content: [{
      type: 'text',
      text: `[team-root-work requestToken=${input.requestToken}] ${text}`,
    }],
    source: { kind: 'user' },
  })

  handle.agent.followup(message)
  await handle.agent.whenIdle()
  await sessionPersistence.ensureMaterialized(handle.agent.session)
}
```

具体模型可见前缀需在任务 brief 中冻结，避免实现代理自行创造不同格式。

### 约束

- 不做业务 dedupe；
- 不写 Team ledger；
- 不调用 generic Member `workDelivery`；
- 不把 rootSessionId 转换为 childSessionId；
- 每次请求先执行 durable model/capability reconciliation；
- 返回/抛错必须能让 Root work executor 准确判断 delivery 成败。

### 测试

- Root agent 不存在时 ensure/create-or-resume；
- 已 live 时复用；
- request token 出现在模型可见输入；
- attached context 格式；
- `whenIdle` rejection 传播；
- materialization rejection 传播；
- Team tools 在 delivery 前已经注册；
- adapter dispose 不留 live handle。

### 预计时间

```text
35–55 分钟
```

---

## T4：Client workspace request 与创建后导航

### 代理只需要理解

```text
Creation Panel draft
→ workspace option
→ team.create params
→ open/refresh Root
```

不需要理解 Root work executor、ledger、Leader schema 或 Agent glue。

### 独占文件范围

- `packages/client/src/ui/TeamCreationPanel.tsx`
- `packages/client/src/ui/NewTeamEntry.tsx`
- `packages/client/src/model/team-intent-model.ts`
- `packages/client/src/plugin/team-mount-core.ts`
- 对应 client tests
- 必要 locale 文案

禁止修改：

- runtime package；
- remote parser；
- upstream DSH client。

### 实现

#### Workspace request

在 `runCreate()` 中：

```text
workspaceId = null
→ omit workspace

workspaceId != null
→ find TeamWorkspaceOption
→ if missing: client typed failure, no RPC
→ workspace = option.path
```

然后：

```ts
teamCreate({
  rootSessionId,
  blueprintId,
  blueprintRevision,
  workspace: selected.path,
  initialWork,
})
```

#### Retry

失败后保留：

- 相同 `rootSessionId`；
- 相同 blueprint；
- 相同 workspace；
- 相同 initial work；
- warning acknowledgement 状态按现有规则处理。

创建已经开始后，应冻结本次 workspace selection，避免用户在错误状态中修改 workspace 后对同一 root 发起不一致 retry。

#### 打开行为

- success：`openCreatedSession(rootId)`；
- initial-work delivery typed failure 且错误标记 root 已创建：
  - refresh；
  - 尝试打开真实 root；
  - 不创建普通 Session；
  - 在真实 Root 上保留错误 overlay/banner；
- open 仍失败：面板保持错误状态，不调用 `ctx.sessions.create()`。

#### 清理 R140 临时说明

删除或改写：

```text
workspace selector is informational
```

新的说明应明确：

```text
workspace path is sent to host and becomes TeamSession.defaultWorkspace
```

### 测试

- selected workspace path 进入 request；
- id 不会被当 path；
- missing selected option 不发 RPC；
- absent workspace 不发送字段；
- retry 同 root + 同 workspace；
- UI 不允许同 root 改 workspace retry；
- success refresh/open；
- partial creation failure 打开真实 root；
- open failure 不创建普通 session；
- overlay close timing；
- current-session workspace prefill。

### 预计时间

```text
40–60 分钟
```

---

## T5：Host `team.create` transaction

### 代理只需要理解

```text
一个 team.create 请求如何在 host 内完成：
workspace bind、Root start、optional Root work。
```

它不需要重新理解 React、Remote parser 细节或 live Agent 内部实现，只消费 G1 冻结 interface。

### 独占文件范围

- `packages/runtime/src/plugin/s6-remote.ts`
- `packages/runtime/src/plugin/root.ts`
- `packages/runtime/test/p8s7r1-initial-work.test.ts`
- 新增 host orchestration tests
- typed error code 映射所需 runtime 文件

禁止修改：

- `agent-bindings.mjs`
- client package；
- remote parser；
- root-work executor implementation。

### 实现内容

#### 1. 接收 workspace

扩展 Team create port：

```ts
create(
  rootSessionId,
  blueprintId,
  blueprintRevision,
  initialWork,
  workspace,
)
```

#### 2. Fresh path

```text
requested workspace present
→ bindFresh.defaultWorkspace = requested workspace

absent
→ options.defaultWorkspace
```

#### 3. Cold path

核对：

- blueprint snapshot；
- durable workspace；
- initial-work token。

建议 typed error：

```text
TEAM_REMOTE_TEAM_CREATE_WORKSPACE_MISMATCH
```

必须在 Root start/work delivery 前拒绝 workspace mismatch。

#### 4. Port preflight

当 initial work 存在时，在任何 durable bind 前检查：

```text
startRootAgent port exists
rootWork executor/delivery port exists
```

建议 typed error：

```text
TEAM_REMOTE_TEAM_CREATE_ROOT_WORK_UNAVAILABLE
```

#### 5. 创建后顺序

```text
bindFresh / rehydrateCold
→ startRootAgent
→ rootWork.execute
```

不再构造：

```ts
{
  action: 'follow-up',
  targetInstanceId: 'inst-leader'
}
```

删除 `team.create` initial work 对 generic `runtime.performAction()` 的调用。

#### 6. Runtime assembly

`root.ts` 负责：

- 用 `coordination.chains` 构造 RootWorkExecutor；
- 注入现有 compatibility authority；
- 注入 `live.deliverRootWork`；
- 将 executor 交给 `s6-remote`；
- 保持普通 Member `TeamRuntime` 不变。

### 修正现有测试假绿

在 `p8s7r1-initial-work.test.ts` 中：

- 新增一个没有预置 v1 leader 的真正 fresh root 场景；
- 或在 fresh 场景中同时删除旧 leader row；
- 断言 bind 后生成的是 Leader v2；
- 断言没有 `lifecycle`；
- 断言没有 `childSessionId`。

原有 legacy/v1 fixture 场景可以保留，但必须标注它只验证兼容 fixture，不再代表生产 fresh path。

### 测试

- no workspace/no work；
- selected workspace/no work；
- selected workspace/initial work；
- true v2 Leader；
- same create retry；
- different workspace retry；
- start port missing；
- root work port missing；
- start failure；
- delivery failure；
- same token replay；
- different initialWork produces new token；
- generic TeamRuntime 未收到 Leader follow-up；
- response keys 仍为 `bind/durable/path`；
- error code 通过 Remote backing 双清单。

### 预计时间

```text
50–80 分钟
```

---

# 8. G2 集成闸

主代理按以下顺序 cherry-pick：

```text
T3 live adapter
→ T5 host transaction
→ T4 client
```

T3/T5 无文件重叠；T4 完全独立。顺序只为了便于逐步 typecheck。

随后运行：

1. runtime root-work focused tests；
2. runtime `team.create` focused tests；
3. Remote parser/handler tests；
4. client panel/mount tests；
5. runtime/client/remote typecheck；
6. lint；
7. workspace unknown-field negative；
8. grep 确认 `team.create initialWork` 不再构造 Leader `follow-up`；
9. grep 确认 product code 未给 Leader 添加 lifecycle/childSessionId；
10. diff 确认 upstream checkout 未修改。

预计：

```text
20–35 分钟
```

如果出现跨任务 interface 错误，返工只发回 interface 拥有者，不让主代理在 integration branch 直接做大范围补丁。

---

# 9. Wave 3：两项并行收束

## T6：真实 composition 与浏览器回归

### 代理只需要理解

```text
如何从产品入口重现用户路径并检查最终状态。
```

不需要理解具体实现。

### 独占文件范围

- 新增测试 harness；
- `dev/agent-workflow/evidence/.../T6/`
- 必要的 test-only fixture；
- 不修改产品实现，除非返回明确缺陷报告。

### 测试实例

严格使用：

```text
DSH source:
references/deepseek-harness-test-use

DSH_HOME:
references/.dsh-test-<task-specific>

ports:
3180/3181/3182...，绝不使用 3080
```

### 场景

#### V1 无 workspace、无 initial work

```text
Create Team
→ host default workspace
→ Leader Root open
→ no first turn
```

#### V2 workspace B、无 initial work

```text
当前位于 workspace A
→ 新建团队
→ 选择 workspace B
→ 创建团队
→ 当前 session = minted Root
→ Root 出现在 workspace B
→ 无普通额外 session
```

#### V3 workspace B、有 initial work

```text
创建并发送
→ Root Agent 收到初始任务
→ session log 有模型可见 root-work requestToken
→ 不出现 WORK_STATE_REJECTED
```

#### V4 retry

注入一次 delivery failure：

```text
第一次失败
→ Root identity 存在
→ UI 打开/保留真实 Root
→ retry 使用同 root/token
→ 成功后只存在一个成功初始 work
```

#### V5 restart

```text
stop
→ restart
→ workspace B 归属不变
→ Leader tools = 10
→ Leader persona/model 不变
→ same retry 不重复 delivery
```

#### V6 普通会话对照

```text
New Session
→ standard tools
→ 不应有 team_*

New Team
→ Leader Root
→ 应有 team_*
```

这能防止再次把“普通会话没有 Team 工具”误判为 Team Root 缺工具，也能捕获产品导航重新退化。

### 预计时间

```text
35–60 分钟
```

---

## T7：文档、Agent Note 和证据整理

### 代理只需要理解

```text
已经冻结的 interface、行为和验证结果如何准确记录。
```

不需要探索实现或重新设计。

### 独占文件范围

- 本仓 README/JSDoc 中相关说明；
- Agent Note；
- 安装/用户行为说明；
- evidence 索引；
- 不修改冻结四文档。

### 必须记录

1. Leader Root 与 ordinary Member work 的区别；
2. `workspace` wire 字段是 path；
3. absence fallback；
4. cold retry mismatch；
5. Root work token/replay；
6. partial creation failure；
7. R140 的 informational workspace 限制已经取消；
8. 测试命令和结果；
9. upstream zero-diff；
10. 用户可见行为。

### 预计时间

```text
25–40 分钟
```

---

# 10. 全链验证矩阵

Wave 3 完成后由主代理统一运行。

## 10.1 Focused tests

并行启动互不争用资源的测试：

```text
Remote team.create parser/handler tests
Root-work executor tests
S6 team.create transaction tests
Client creation panel/mount tests
Leader v2 contract tests
```

## 10.2 Static gates

可并行：

```text
typecheck package set
lint
contract field scan
private import scan
zero-core scan
generated artifact freshness
```

## 10.3 Build

按依赖顺序：

```text
remote
→ runtime
→ client
→ client bundle
→ composition artifacts
```

## 10.4 Real composition

串行运行，因为涉及端口和 DSH_HOME：

```text
fresh boot
→ browser create without work
→ browser create with work
→ retry
→ restart/resume
→ teardown
```

## 10.5 原始用户症状的精确断言

反馈循环必须明确检查以下字符串不再出现：

```text
TEAM_RUNTIME_WORK_STATE_REJECTED
the work target is undefined
```

同时检查：

```text
创建后 current session id == requested rootSessionId
Root session workspace == selected workspace
Root Agent tool names 包含全部预期 team_*
没有额外 standard session 被创建
```

---

# 11. Gate 独立审查

代码和自测全部完成后，启动三个全新独立 reviewer，并行执行。

## Reviewer 上下文

每个 reviewer 只收到：

- 用户批准的目标行为；
- 本计划的 acceptance matrix；
- frozen Architecture/UI 相关章节；
- base/head commit；
- 测试运行方法。

不得收到：

- 其他 reviewer 意见；
- 主代理预期裁决；
- 本轮实现过程记录；
- `SESSION_ROUTER_LOG.md`；
- 前一轮 Gate 报告。

## 三个 reviewer 的统一审查范围

每人都必须独立核验全部范围，但可以要求各自重点不同：

### Reviewer 1：对象模型和 durable 语义重点

- Leader v2 未被降级；
- 无 fake lifecycle/childSessionId；
- Root work replay/settlement；
- cold retry；
- compatibility admission。

### Reviewer 2：Remote/client 产品行为重点

- workspace contract；
- selected path；
- open/refresh；
- partial failure；
- 不进入普通 New Session；
- typed error pass-through。

### Reviewer 3：真实 composition/zero-core 重点

- clean DSH_HOME；
- browser flow；
- tools/persona/model；
- restart；
- upstream zero diff；
- 无 private imports。

但三者仍须对整个 Gate 给出四选一裁决：

```text
通过
投机通过
补充内容
阻塞
```

任一“补充内容”都需要：

1. 完成补充；
2. 启动三个全新的 reviewer；
3. 完整重审整个 Gate。

---

# 12. 文件所有权矩阵

| 文件/区域 | 唯一写任务 |
|---|---|
| `packages/remote/src/contracts/params.ts` | T1 |
| `packages/remote/src/handlers/team.ts` | T1 |
| `packages/remote/test/**team-create**` | T1 |
| `packages/runtime/root-work/**` | T2 |
| `packages/runtime/src/plugin/types.ts` | T2 |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | T3 |
| `packages/client/src/ui/TeamCreationPanel.tsx` | T4 |
| `packages/client/src/ui/NewTeamEntry.tsx` | T4 |
| `packages/client/src/model/team-intent-model.ts` | T4 |
| `packages/client/src/plugin/team-mount-core.ts` | T4 |
| `packages/client/test/**create**` | T4 |
| `packages/runtime/src/plugin/s6-remote.ts` | T5 |
| `packages/runtime/src/plugin/root.ts` | T5 |
| `packages/runtime/test/p8s7r1-initial-work.test.ts` | T5 |
| composition/browser harness | T6 |
| README/Agent Note/evidence index | T7 |
| `graph.yaml` / `SESSION_ROUTER_LOG.md` | 主代理 |

这样 Wave 2 的三个实现代理没有产品文件写冲突。

---

# 13. 返工路由

为避免一个失败把全部上下文重新交给大代理，返工按错误位置路由：

| 失败 | 返回任务 |
|---|---|
| workspace 字段未解析/被拒 | T1 |
| Root work dedupe/settlement 错 | T2 |
| Root Agent 没收到输入/工具缺失 | T3 |
| UI 没传 workspace/误进普通 Session | T4 |
| bind/start/delivery 顺序错 | T5 |
| 真实 workspace projection 不成立 | C0 结论复核 + T5 |
| E2E harness 错误 | T6 |
| 文档/证据不一致 | T7 |

每个任务最多三次执行，遵守仓库协议。

---

# 14. 工期估计

估计基于：

- 模型：`qiyuan-self/qwen3.8-27b`
- 上下文：262K，足够容纳每个局部 context pack；
- 首 token：约 10 秒；
- 解码：约 100 token/s；
- 最大输出：64K；
- Windows 测试/build/DSH boot 通常比模型生成更耗时；
- 子代理已经通过 context pack 控制，避免每人扫描全仓。

## 14.1 单任务估计

| 阶段 | 并行度 | 墙钟时间 |
|---|---:|---:|
| P0 准备/brief/worktree | 1 | 20–30 分钟 |
| Wave 1：C0/T1/T2 | 3 | 45–70 分钟 |
| G1 集成闸 | 1 | 15–25 分钟 |
| Wave 2：T3/T4/T5 | 3 | 50–80 分钟 |
| G2 集成闸 | 1 | 20–35 分钟 |
| Wave 3：T6/T7 | 2 | 35–60 分钟 |
| 全链验证 | 多测试并行 + E2E 串行 | 30–50 分钟 |
| Gate 三盲审 | 3 | 45–75 分钟 |
| 收尾/簿记 | 1 | 15–25 分钟 |

## 14.2 总工期

### 理想情况：一次实现、一次 Gate 通过

```text
约 4.5–6.5 小时墙钟时间
```

### 更现实情况：出现一轮局部返工

```text
约 6–8.5 小时
```

### 出现一轮 substantive 补充并完整重新盲审

```text
约 8–11 小时
```

### C0 发现缺少 public workspace attachment seam

需要先输出 blocker 或调整 interface，预计额外：

```text
1–2.5 小时诊断与计划修订
```

如果确认是 `CORE_SEAM_BLOCKER`，workspace feature 将停止，不以私有 interface 绕过；Root initial-work 修复仍可独立完成。

---

# 15. 关键路径

实际关键路径是：

```text
P0
→ T2 Root-work core
→ G1
→ T5 host transaction
→ G2
→ T6 real composition
→ Gate
```

T1、T3、T4、T7 都尽可能安排在关键路径旁并行。

最可能拖慢进度的不是模型生成，而是：

1. DSH 启动与浏览器测试；
2. workspace native projection 的实证；
3. delivery failure/retry 的确定性模拟；
4. client bundle/build；
5. Gate reviewer 各自独立复跑真实 composition。

---

# 16. 完成判据

只有以下全部满足才可宣布修复完成：

- [ ] `team.create(initialWork)` 不再调用 generic Leader follow-up；
- [ ] 真实 Leader record 仍是 v2；
- [ ] Leader 无 `lifecycle`；
- [ ] Leader 无 `childSessionId`；
- [ ] Root initial work 通过专用 delivery seam；
- [ ] same token retry 不重复成功 delivery；
- [ ] selected workspace path 进入 Remote request；
- [ ] `TeamSession.defaultWorkspace` 等于所选 path；
- [ ] Root Agent `cwd` 等于所选 path；
- [ ] native session 出现在所选 workspace；
- [ ] 创建成功后直接打开 minted Root；
- [ ] 不创建额外 standard session；
- [ ] Root 模型请求可见预期的 10 个 `team_*` 工具；
- [ ] 无 initial work 时不产生首轮；
- [ ] initial work failure 保留真实 Root 和同一 ID；
- [ ] restart/resume 后 workspace、identity、tools 不变；
- [ ] 原始错误字符串不再出现；
- [ ] upstream checkout byte-clean；
- [ ] `:3080` 和 `D:\deepseek-harness\` 未触碰；
- [ ] 三个独立 reviewer 全部“通过/投机通过”；
- [ ] 所有测试实例与端口已拆除。

---

# 17. 阻塞项预审查（2026-09-05）

## 17.1 总裁决

```text
HOLD — 原计划不可直接进入实现。
```

预审查发现四个实现前 BLOCKER 和若干高影响计划修订项。它们并不否定“Root 专用 work 路径 + workspace 成为创建 authority”这一产品方向，但证明原计划所选的单 RPC 顺序、Remote v1 原地扩展、失败重试协议和 workspace 归属假设不能同时满足冻结设计。

在第 17.8 节的新前置裁决阶段完成前，禁止启动原 Wave 1 的 T1/T2 产品编码；仅允许继续只读 characterization、契约设计和原型验证。

## 17.2 BLOCKER A：Remote v1 不得原地增加 workspace

当前 `team.create` 是 Remote contract v1 的 closed params：

- `packages/remote/src/contracts/params.ts` 的 per-method schema 明确是 closed input schema；
- `RemoteTeamCreateParams` 当前没有 workspace；
- `REMOTE_TEAM_CREATE_FIELDS` 和 parser 拒绝未知字段；
- `packages/remote/src/contracts/version.ts` 明确规定 version bump 必须新增版本语义，v1 endpoint 保持工作；
- `packages/remote/src/contracts/catalog.ts` 将 v1 method catalog 定义为 frozen closed surface。

因此，用户批准 workspace 进入 authority path，并不等于可以静默重写 v1。原计划的 T1 必须改为显式 Remote v2 设计：

```text
v1 parser / params / behavior 保持兼容
v2 增加 workspace path、createRequestToken，并提供两阶段 Root initial-work command
```

具体采用同一 method name 的 version-discriminated params，还是 v2 独立 method catalog，必须由 contract design gate 冻结；不得由实现代理临场决定。

`TeamSession.defaultWorkspace` 已存在于冻结 TeamSession DTO，因此 workspace 持久化本身不要求调整 TeamDomain schema。

## 17.3 BLOCKER B：单 RPC 在 open 前投递 initial work 违反冻结 UI 顺序

冻结 UI §4.3 对有 initial work 的顺序是规范性的：

```text
create TeamSession
→ open Root
→ admit initial work
→ Root first turn
```

其目的包括让“已创建、尚无 turn”的边界成为真实用户状态，并要求 admission failure 在已经打开的真实 Root 中呈现。

原计划则是：

```text
bind/start/deliver
→ team.create RPC 返回
→ client open Root
```

两者顺序严格相反。不能把它解释成内部实现细节。

修订后的产品链必须是两阶段：

```text
Remote v2 team.create
  → bind TeamSession + Leader v2
  → start Root Agent
  → attach Root Session to selected Workspace
  → return created Root

Client
  → refresh/open real Root

Remote v2 team.admitRootWork（暂定名）
  → Runtime authority admission
  → Root Agent delivery
  → first Root turn
```

不建议在 open 后直接调用 upstream native `Session.prompt`。该 seam 虽公开，但直接使用会绕过 TeamRuntime 的 compatibility/admission authority、Team ledger 和 Team request-token 语义。它可作为 Root delivery adapter 的底层公开能力，但不能替代 Runtime-backed Root work command。

Remote v1 的 optional `initialWork` 既有输入必须保留兼容；新 UI 不再通过 v1 的单阶段 initial-work 行为实现 Create & Send。若要求 v1 也严格遵循新 UI 顺序，需要独立的 v1 retirement/revision 裁决，不能混入本修复。

## 17.4 BLOCKER C：失败 settlement 与同 token 重试协议自相矛盾

原计划同时要求：

1. delivery failure 写失败 settlement；
2. same token retry 可以重新投递并成功；
3. 已 settle token replay、不得重复 delivery。

现有普通 Member work chain 将任何带相同 token 且 `to: SETTLED` 的 lifecycle fact 视为 terminal replay，包括 `workOutcome: delivery-failed`。若 Root work照搬该规则，首次 delivery failure 后的 retry 会永久跳过 delivery。

实现前必须冻结 Root work outcome 状态机：

```text
admitted only
  → retry/resume delivery

delivery-failed, retryable
  → same-token retry/resume delivery

delivered/succeeded, terminal
  → replay without delivery

same token + different canonical payload
  → typed REQUEST_PAYLOAD_MISMATCH
```

失败 fact 是否单独使用新 factType、复用 `team-work-admitted` 的 payload 状态，或使用 operation journal，必须在 contract design gate 中决定。不得使用 `member-lifecycle-changed` 表达 Root settlement，因为 Leader 没有 Member lifecycle。

## 17.5 BLOCKER D：不能承诺不可证明的 exactly-once Root turn

当前公开 delivery 原语的提交窗口是：

```text
agent.followup accepted
→ whenIdle
→ session materialization
```

如果 followup 已被接受，但 `whenIdle` 或 materialization 抛错，Team ledger 只能知道调用未完成，不能证明模型 turn 是否已经发生。再次以相同 token followup 可能产生第二个 turn。

模型可见 request token 不是程序性去重。除非预研证明 upstream 有以下任一公开 seam：

- request-id idempotent inbox admission；
- 可在 delivery 前可靠查询 Root session 中已接受的 operation identity；
- 相同 request identity 的 host-side dedupe；

否则产品保证必须明确为：

```text
Team durable admission/final success fact exactly-once per logical operation；
Root model-visible delivery at-least-once across ambiguous accept/observe crash window；
requestToken 始终模型可见，便于目标侧识别重放。
```

不得在完成判据中承诺“任何 failure retry 都绝不重复 Root turn”。如果冻结需求坚持 exactly-once model turn 且公开 seam 不存在，则该项升级为 `CORE_SEAM_BLOCKER`。

## 17.6 PUBLIC_ATTACH_REQUIRED：仅设置 cwd 不会建立 Workspace membership

静态审查已经排除原 C0 的 GREEN 假设。

`agents.create({ meta: { cwd } })` 会创建并持久化 Session header，但 Workspace membership 还要求 Session ID 写入 Workspace durable candidate account。Upstream `Workspace.sessionIds` 只过滤既有 `record.sessionIds`，不会按 cwd 自动吸纳运行期创建的 Session。

裁决：

```text
PUBLIC_ATTACH_REQUIRED
```

公开 Host seam 已存在：

```ts
Workspace.attachSession(sessionId): Promise<void>
```

修订后的 host 顺序必须是：

```text
resolve selected Workspace by authoritative identity/path
→ bind TeamSession.defaultWorkspace
→ create/resume Team Root with matching cwd
→ materialize Root Session
→ Workspace.attachSession(rootSessionId)
→ return create success
```

不能依赖：

- `sessions.refresh/open`：只保证全局列表发现和导航，不建立 Workspace membership；
- `sessions.create({ sessionId, cwd })`：不会 attach；
- client-side `sessions.create({ sessionId, workspaceId })` 作为通用补丁：live Team Agent 时可能 adopt+attach，但 cold durable 状态可能走 ordinary/default composition resume，存在重新变成 standard Agent 的风险。

Host plugin 当前只 hard-inject `agents`、`storageDomain`、`sessions`。必须在前置 seam gate 验证本仓 host composition 可以通过公开 `workspaceRegistry` 取得 Workspace 并调用 `attachSession`。如果 composition 无法注入该公开 service，才升级为 `CORE_SEAM_BLOCKER`。

Workspace attach failure 是 partial creation：TeamSession/Root identity 保留，retry 对相同 root/workspace 幂等重驱 attach。其 typed outcome 必须由 v2 wire 明确表达，不能由 UI 猜测。

## 17.7 高影响 PLAN_CHANGE

### 17.7.1 取消四文件独立 Root-work 子系统的预设

原计划预设新增：

```text
packages/runtime/root-work/{index,types,executor,errors}
```

这很可能复制普通 Member work chain 已有的 scan/admit/resume/replay/delivery/activity/settlement 协议，形成第二套 authority。

修订方向：

- 优先在 `action-router` 内提炼共享 operation protocol，以 Member adapter 与 Root adapter 承载不同 identity/settlement；或
- 在证据证明共享提炼会扩大风险时，使用一个窄的内部 `root-work.ts`，但仍由 production root 的现有 coordination lock 与 compatibility authority 调用；
- 不建立第二套公开 Runtime facade。

### 17.7.2 不得擅自新增 ledger factType

`projection-source.ts` 对 production factType 使用 closed mapping；未知 factType 会使整个 projection fail closed。Ledger projection 的八个 category 也是冻结 closed shape。

因此：

- 不得由 T2 自创 `team-root-work-settled` 等 factType；
- 如新增 factType，必须先给出 exact factType、payload、category mapping、projection/recovery 语义，并作为显式 contract/architecture change gate；
- 复用 `member-lifecycle-changed` 明确禁止；
- 优先研究是否能在现有 `team-work-admitted` 的 team category 内表达 Root operation 状态，同时保持旧 reader兼容。

### 17.7.3 request token 必须由 client operation 拥有

当前 v1 按 initialWork payload hash 派生 token，会造成同一 root 改 prompt 即变成隐式新 work，也无法区分网络重放和用户新操作。

v2 必须显式携带 client-owned stable token：

```text
createRequestToken：标识 Team create operation
rootWorkRequestToken：标识 open 后的 initial Root work operation
```

retry 冻结 token 和 canonical payload。相同 token、不同 payload必须 typed mismatch。新工作必须使用新的 root-work operation，不能再次借用 `team.create`。

### 17.7.4 partial success 使用 discriminated outcome

不要仅新增错误码让 UI 推测 Root 是否已创建。v2 应明确表达：

```text
create outcome:
  created / already-created / attach-pending / failed-before-bind

root-work outcome:
  admitted / delivered / replayed / retryable-failure / payload-mismatch
```

最终字段需要在 Remote v2 design gate 收敛为尽量小的 interface，不得把内部阶段全部泄露到 wire。

### 17.7.5 Root start port 仍为所有 create 请求的无条件前置条件

无 initial work 的 Create Team 也必须创建可打开、带 Team tools/persona/model 的真实 Leader Root。因此：

```text
startRootAgent port：所有 create 请求 bind 前必检
root-work delivery port：仅 Root work command 执行前必检
workspace attach port：选择 workspace 时 create 前必检
```

## 17.8 修订后的前置执行阶段

原 P0/Wave 1 之前新增：

```text
P-1 Contract and Public-Seam Closure
```

### P-1A Remote v2 interface design

只做设计和 parser prototype，冻结：

- v1 compatibility policy；
- v2 version discrimination；
- `team.create` v2 params：workspace identity/path、createRequestToken；
- Root work method名称和 params：rootSessionId、rootWorkRequestToken、prompt、attachedContext；
- create/root-work最小 discriminated outcomes；
- backing error codes；
- same-token payload mismatch 规则。

### P-1B Workspace host seam proof

加载 `editing-cordis-compositions` skill 后验证 host composition：

- `workspaceRegistry` 是否可作为公开 Cordis service 注入 Team host plugin；
- Team host row 的加载顺序和 inject 声明；
- path 到 Workspace 的 authoritative resolution；
- `attachSession` 的调用与 dispose/restart行为。

裁决仅三种：

```text
GREEN_PUBLIC_ATTACH
COMPOSITION_CHANGE_REQUIRED
CORE_SEAM_BLOCKER
```

### P-1C Root delivery idempotency characterization

验证 upstream `Session.prompt`/Agent inbox 的 request identity 和 session log：

- 是否按 requestId 去重；
- accepted-but-response-lost 重试行为；
- 是否可在投递前通过公开 session query识别已存在 request identity；
- `whenIdle`/materialization failure窗口。

输出：

```text
EXACTLY_ONCE_PUBLIC_SEAM
AT_LEAST_ONCE_ONLY
CORE_SEAM_BLOCKER（仅当产品坚持 exactly-once）
```

### P-1D Root work durable protocol design

在 P-1A/P-1C 结果上冻结：

- admission、retryable failure、terminal success 状态机；
- ledger/operation-journal representation；
- compatibility authority调用点；
- coordination lock owner；
- activity是否适用于 Root；
- projection mapping；
- restart recovery。

### P-1 Gate

P-1A 至 P-1D 可以并行预研，但必须共同通过一个 design gate。Gate 前不得编写产品实现。

Gate 产物必须含：

1. exact Remote v2 types；
2. exact public service dependencies；
3. exact state transitions；
4. exact fact/operation representation；
5. failure and retry table；
6. frozen UI ordering证明；
7. zero-core证明；
8. 修订后的任务 DAG 和文件所有权。

## 17.9 对原 DAG 的处置

在 P-1 Gate 完成前：

- C0 被 P-1B 取代并提升为硬 Gate；
- T1 暂停，改为 v2 contract实现任务；
- T2 暂停，等待 Root work durable protocol冻结；
- T3 暂停，等待 idempotency语义冻结；
- T4 暂停，等待两阶段 v2 interface冻结；
- T5 暂停，等待 workspace attach 与两阶段 transaction冻结；
- T6/T7 不启动。

Root-work 修复与 workspace 修复仍可在 P-1 后并行，但 integration关键路径改为：

```text
P-1A/B/C/D
→ P-1 Gate
→ Remote v2 + Workspace host attach + Root-work protocol 并行实现
→ Client two-stage flow
→ integration/E2E
→ three-reviewer Gate
```

## 17.10 工期影响

原估算 `4.5–6.5 小时` 不再成立。

新增前置 contract/seam closure 后：

| 阶段 | 预计墙钟 |
|---|---:|
| P-1A/B/C/D 并行预研 | 45–90 分钟 |
| P-1 design gate 与计划重排 | 30–60 分钟 |
| Remote v2 + host attach + Root protocol实现 | 90–180 分钟 |
| Client two-stage flow | 45–90 分钟 |
| integration/build/E2E | 60–120 分钟 |
| 三独立 reviewer Gate | 45–90 分钟 |

修订后理想工期：

```text
约 6–9 小时
```

现实工期（含一轮局部返工）：

```text
约 8–12 小时
```

若 Remote v2 需要同时维护完整双版本 method catalog，或 Root delivery 只能保证 at-least-once而产品要求 exactly-once，需再次提交用户裁决，不能继续无人值守实现。
