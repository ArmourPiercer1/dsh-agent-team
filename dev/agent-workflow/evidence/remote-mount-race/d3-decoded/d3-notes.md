# D-3 证据 — 标准创建路径进入的是「纸面 standard 会话」而非 leader 会话（2026-09-05，用户实机测试轮 3）

用户报告（原话）：「leader会话似乎不能正常进入：1. 我们预期的行为是：`新建团队-选择蓝图-创建团队` 操作后，进入的会话**就是**leader会话…同时在左侧栏中也没有出现额外的会话；我重测的结果中，它也无法看到team_*工具。2. 进入"团队"标签页后，点击"成员组-leader标签栏"后，页面没有任何变更」。

## 1. team_domain.json 四行分析（用户 home，只读解码）

`C:\Users\user\.dsh-dev\profiles\web\data\dsh-agent-team\team_domain.json`（用户实机 domain，R140 诊断时读取，未写任何字节）：

| # | teamSession id | generation | compatibility | 来源 |
| --- | --- | --- | --- | --- |
| 1 | `team-root` | 2 | 有（compat 行） | boot 行 `createAndStartTeam`（部署配置 `rootSessionId: "team-root"`，D-1 自愈 boot 创建，19:39:07） |
| 2 | `session-0bf2409a-…` | 1 | 无 | 面板创建（team.create + bindFresh）——D-2 轮用户会话 |
| 3 | `session-a1386a51-…` | 1 | 无 | 面板创建（D-3 轮，20:04:42） |
| 4 | `session-65b9b471-…` | 1 | 无 | 面板创建（D-3 轮重试，20:05:00） |

generation 语义（root.ts L792-795）：ledger-fact 追加或 compatibility 替换时 +1。boot 行（#1）gen 2 = 创建后追加过 fact（heal boot 的 initial work）；面板行（#2-4）gen 1 = 创建即终态（无 fact、无 compat）。

**面板行全部绑定到 `agentPreset: "standard"` 的会话**（见 §2 解码日志）——TeamSession 绑定成功，但被绑定的根会话里跑的 agent 是 standard 预设（24 个 DSH 标准工具、零 team_*、无 leader persona/model），leader agent 从未在该根会话中创建。

## 2. 解码会话日志（`d3-decoded/`，自用户 home 只读解码到本目录）

- **`team-root.jsonl`**（461 B，5 行）：`createdAt 1788608347687`（19:39:07 +0800 = D-1 heal boot 时刻），`cwd D:\AgentDev\deepseek-harness`，**零回合**（仅 session/preset/sandbox/approval 元数据 + end-seed）——真 leader 会话从未被用户提问（与 D-2 结论一致）。
- **`test-a1386a51.jsonl`**（432 B，4 行）：`session-a1386a51-a760-4814-92f4-0c9187e607d1`，`createdAt 1788609882244`（20:04:42），`cwd D:\test`，**`agentPreset: "standard"`**，零回合。
- **`test-65b9b471.jsonl`**（56538 B，60 行）：`session-65b9b471-a042-48e8-9972-c520bd6aea60`，`createdAt 1788609900434`（20:05:00，前一个面板根创建 18 秒后 = 用户重试），`cwd D:\test`，**`agentPreset: "standard"`**，**有完整对话回合**——用户实际在这里"进入"了新建团队，与 standard agent 对话 → 自然看不到 team_* 工具（用户症状 1 的「它也无法看到team_*工具」直接落点）。

## 3. 部署配置摘录（只读）

`C:\Users\user\.dsh-dev\profiles\web\node_modules\dsh-agent-team\cordis.patch.yml`（host 行关键配置）：

```yaml
- insert:
    - id: "dsh-agent-team"
      name: "dsh-agent-team/host"
      config:
        bootPhase: "create-or-open"
        rootSessionId: "team-root"
        ...
        generation: 1
        ...
```

- **无 `defaultWorkspace` 字段**（文件头注释 L10-17 明示语义：行不带 defaultWorkspace 时，团队 workspace 默认 = 操作者启动 host 的目录，`withDefaultWorkspace`）。
- `staticModel: deepseek-official/deepseek-v4-flash`（host 行自带，leader 模型路由在位）。
- 结论：部署接线本身正确（D-1 修复生效、catalog 200、Team UI 渲染均正常），D-3 缺陷不在部署面，在插件自身的标准创建路径。

## 4. 根因（代码层）

修复前标准创建路径（`TeamCreationPanel.runCreate`）：`createRootSession()`（**客户端经原生 `ctx.sessions.create` 预创建 standard-preset 会话**）→ `team.create({rootSessionId, …})`（host 把 TeamSession 绑定到该已存在会话）→ `openSession(rootSessionId)`。

- host 的 `session.create`（DSH core）执行 `agents.ensureSession`（test-use `commands.ts`）——**创建解析时就已存在一个活 standard agent**；插件随后再对同一 id 走 glue `agent.start` 会命中 agent-registry 碰撞边界（agent 已注册）→ 因此「保留客户端预创建 + 后置创建 leader」的变体**不可行**（设计死路，已在 D-3 分析中裁决放弃）。
- 侧栏无新行 = 创建出的根会话 cwd = 启动目录（host 默认 workspace）+ DSH 侧栏按所选 workspace 过滤（core 行为，CORE PATCH BUDGET=0 不改）；用户侧栏停在 `D:\test` 过滤态下自然看不见默认 workspace 的行（症状 1 的「左侧栏没有出现额外的会话」）。
- 团队 tab 点 Leader 行无变更 = D10 设计：当前会话**就是**根会话时该行 no-op（frozen）；用户当时"当前会话"是面板根（standard 会话），而 boot 行 `team-root`（真 leader）是另一行——两行并存造成「点 leader 没反应 + 看不到 team_* 工具」的复合观感（症状 2）。

## 5. 修复（task `7e0c7d3`，dsh-agent-team only，零 upstream）

1. **客户端铸造根 id**（`mintRootSessionId()` = `session-<uuid>`，team-intent-model.ts）：不再原生预创建；host 在 `team.create` 期间于该 id 下创建会话。
2. **host `teamCreate.create`**（s6-remote.ts）：
   - create 顶部 fail-closed 预检 `requireStartRootAgentPort()`：glue 无 `createRootAgent` 端口 → 类型化 `TEAM_REMOTE_TEAM_CREATE_ROOT_START_UNAVAILABLE`（**任何持久化效应之前**，不留残团）；
   - bind 之后（fresh/cold 两路）`await startRootAgent(requestedRootSessionId)`：拒绝 → 类型化 `TEAM_CREATE_ROOT_START_FAILED`（持久 bind 保留，冷路径重试重驱 start）；两码同步进 `S6_REMOTE_ERROR_CODES` + `REMOTE_BACKING_ERROR_CODES`（T12-H4 类型化直通双清单）；
   - root.ts L1489 接线 `startRootAgent: live.createRootAgent` —— 与 with-context handoff **同一 glue 端口**（create-or-ensure：全新根走 agents.create 路径，即已验证的 handoff 形状）。
3. **客户端稳健打开**（`openCreatedSession`：open → unknown id 时 `ctx.sessions.refresh()` 一次 + 重试 open → 仍失败抛回面板类型化错误道）；`TeamSessions` face 新增 `refresh()`；面板失败保留铸造 id 供重试复用（rootKept 文案），overlay 仅在创建路径打开成功后关闭。
4. 工作区选择器降级为**信息展示**（frozen team.create 参数不含 workspace 字段，assertNoUnknownFields 守护）。

测试：p8s7r1 D3a-D3d（fresh 先于 work-fact 启动一次 / cold 重试重驱 / 缺端口 fail-closed 无残团 / 拒绝端口 bind 保留无 work-fact）+ client-plugin-mount D-3 lag/failing-open + panel/entry/handoff spec 迁移到铸造 id 序列。

## 6. 已知局限（已随提交对用户披露）

- 新建团队的根会话落在 **host 默认 workspace**（启动目录）；若用户侧栏停在其他 workspace 过滤态，可能看不见该行——boot 行 `team-root`（host anchor）仍是团队 tab 里「回到 leader」的落点。
- 模型级最终确认（leader 会话内 team_* 工具可见 + 首轮对话）= 用户实机复测（本机无 API key，确定性验证 = 单测/客户端测试 + wire 面垂直）。
