# Team D1–D6 最小修复详细执行计划

**状态**：执行中（本轮已完成 seam characterization；D5 已实现；D1/D3/D2/D4/D6 按 public seam 与预算规则分别 DEFERRED/BLOCKED）  
**本轮执行启动**：2026-09-06T23:48:26.2065938+08:00  
**适用问题**：D1–D6（D6 沿用既有诊断文档，不重复建档）  
**目标仓库**：`dsh-agent-team`  
**实现模型**：`qiyuan-self/qwen3.8-27b`  
**核心约束**：`CORE PATCH BUDGET = 0`；不修改 upstream DSH，不使用 upstream 私有 API

---

## 0. 本计划的编排原则

本计划不按“前端 / 后端 / runtime”粗粒度拆分，而按每个代理必须建立的**单一上下文集合**拆分。每个任务只回答一个局部问题，并明确：

- 允许读取的 context pack；
- 独占写区；
- 不能读取或修改的区域；
- 输入/输出契约；
- 最小测试；
- 时间盒和停止条件。

目标 DAG 是：

```text
P0 基线与 seam check
│
├────────────── Wave 1：局部事实核验（并行） ──────────────┐
│  C0 成员 setup / 基础工具 seam                            │
│  C1 成员身份 prompt seam                                 │
│  C2 结果回传与 projection 现有 seam                      │
│                                                          │
└────────────────────── G1 方案分流闸 ─────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   T1 D1 最小修复    T2 D3 最小修复    T3 D2 最小结果闭环
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                 G2 成员闭环集成闸
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
       T4 D4-A live projection   T5 D5 契约对齐
             │                       │
             └───────────┬───────────┘
                         ▼
                  G3 Team-mode 验收
                         │
                         ▼
                  T6 D6 restart 验收
```

### 0.1 不可擅自改变的原则

1. 所有 worker 的第一步都是读取 `docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`，随后只读取自己的 context pack。
2. 不允许 worker 扫描整个仓库、历史日志或 graph 来重新推导需求。
3. 每个写任务遵循：

```text
1 task = 1 branch = 1 worktree = 1 writer
```

4. 共享 contract、DTO、journal、remote wire、client store contract 只能由明确的 contract owner 修改；其他 worker 必须提交 `CONTRACT_CHANGE_REQUEST`，不能顺手修改。
5. 主 Agent 只做编排、任务图维护、branch/worktree 管理、结果收集、机械 cherry-pick 和 Gate 判定，不承担 feature coding。
6. 任何需要修改 upstream、导入 upstream 私有实现、复制 upstream 内部工具注册实现的方案，立即停止并按固定格式记录 `CORE_SEAM_BLOCKER`。
7. 不以“模型猜对了”“settled=true”“刷新后能看到”“重启后手动重建”替代用户可观察语义。

---

## 1. 固定运行和证据边界

### 1.1 运行实例

所有需要运行 host 的 worker 只能使用：

```text
DSH source: references/deepseek-harness-test-use
DSH_HOME:  references/.dsh-test
port:      3180
model:     qiyuan-self/qwen3.8-27b
```

禁止触碰：

```text
:3080
D:\deepseek-harness
稳定实例的 DSH_HOME
```

测试结束必须确认 `references/deepseek-harness-test-use` 的 `git status --porcelain` 为空。

### 1.2 证据目录

```text
dev/agent-workflow/evidence/team-d1-d6-repair/
├── P0/
├── C0/
├── C1/
├── C2/
├── T1-d1/
├── T2-d3/
├── T3-d2/
├── T4-d4/
├── T5-d5/
├── T6-d6/
└── G3-final/
```

### 1.3 所有 worker 的输出格式

```text
TaskResult
- task_id:
- model_route: qiyuan-self/qwen3.8-27b
- elapsed_minutes:
- base_sha:
- changed_files:
- tests_run:
- evidence_paths:
- self_verdict: PASS | FAIL | DEFERRED | BLOCKED
- blocker_type: none | CORE_SEAM_BLOCKER | CONTRACT_CHANGE_REQUEST | SPEC_CONFLICT | DEPENDENCY_BLOCKER | TEST_INFRA_BLOCKER
- remaining_risks:
- commit_sha:
```

---

# 2. P0：基线和任务准备

**执行者**：主 Agent 负责机械准备；不写 feature code  ️  
**时间盒**：20–30 分钟

## 2.1 主 Agent 工作

1. 记录当前 base SHA、integration branch 和工作树状态。
2. 建立：
   - `int/team-d1-d6-repair`；
   - 每个写任务的 task branch/worktree；
   - 本次 evidence 目录。
3. 将 D1–D6 诊断文档作为 task input：
   - `docs/local-issues/team-member-missing-base-tools.md`
   - `docs/local-issues/team-work-result-not-delivered-to-leader.md`
   - `docs/local-issues/team-member-context-missing-root-session.md`
   - `docs/local-issues/team-projection-not-live.md`
   - `docs/local-issues/team-create-member-custom-instance-id.md`
   - `docs/local-issues/team-root-tools-lost-after-restart.md`
4. 固定当前 acceptance matrix 的失败断言和修复后断言。
5. 将以下文件标记为受保护 shared surface，未经 owner lock 不得编辑：
   - `packages/runtime/admission/types.ts`
   - `packages/runtime/action-router/*`
   - `packages/remote/src/contracts/*`
   - `packages/client/src/state/team-projection-store.ts`
   - `packages/runtime/src/plugin/root.ts`
   - `packages/runtime/src/plugin/s6-remote.ts`

## 2.2 不在 P0 重新设计的内容

- 不决定是否支持自定义 `instanceId`；当前默认沿用 D5 provider-owned 设计。
- 不将 D2 结果协议扩展为完整分布式消息系统。
- 不将 D4 扩展成服务端 push，除非 C2 证明现有 seam 已支持且不需要新协议。
- 不把 D6 与 D1/D3 混写；D6 仍是 restart/adopt 专题。

---

# 3. Wave 1：局部事实核验

Wave 1 的三个调查任务并行执行。它们只产生 evidence 和方案分流，不修改生产代码。每个任务的上下文彼此隔离，避免三个代理各自扫描全链路。

## C0：成员 setup 与基础工具 public seam characterization（D1）

**时间盒**：35–50 分钟  
**分支**：`task/team-d1-c0-base-tool-seam`  
**写入**：仅 `dev/agent-workflow/evidence/team-d1-d6-repair/C0/`，不改产品代码

### 单一上下文

```text
普通 DSH Agent composition
→ AgentSetup callback
→ preset mount / tool registration
→ Team member child setup
```

### 允许读取

- `docs/ROUTER_RULES.md`；
- `docs/TEST_METHODS.md`；
- `docs/local-issues/team-member-missing-base-tools.md`；
- `packages/runtime/src/plugin/live/agent-bindings.mjs`：setup 与 child creation 相关段落；
- upstream：
  - `packages/api/session-controller/src/agent.ts`；
  - 公开 Agent setup/create/resume 类型；
  - 普通 preset mount 公开入口。

### 不要求读取

- D2 action router/result chain；
- D4 client projection；
- D6 restart；
- Team UI；
- 完整 remote handler。

### 工作内容

1. 静态确认普通 setup 与 Team `agentSetup()` 是否存在可组合的公开入口。
2. 判定基础 file/shell tools 是由：
   - preset mount 提供；
   - host service 提供；
   - Agent loop 固定提供；
   - 或当前没有公开可复用入口。
3. 如有现成 public seam，写出最小调用顺序和允许修改文件。
4. 如没有，形成最小 `CORE_SEAM_BLOCKER`，不得建议复制 upstream 内部代码。

### 输出

```text
C0Result
- public_composition_seam: yes | no | unknown
- exact_seam:
- minimal_change_files:
- expected_member_tools:
- blocker:
- recommendation: implement | defer | CORE_SEAM_BLOCKER
```

---

## C1：成员身份 prompt seam characterization（D3）

**时间盒**：25–40 分钟  
**分支**：`task/team-d3-c1-member-context-seam`  
**写入**：仅 `dev/agent-workflow/evidence/team-d1-d6-repair/C1/`，不改产品代码

### 单一上下文

```text
member durable row / fresh hint
→ owning root resolution
→ persona overlay
→ agent-scoped systemPrompt.section
```

### 允许读取

- `docs/ROUTER_RULES.md`；
- `docs/TEST_METHODS.md`；
- `docs/local-issues/team-member-context-missing-root-session.md`；
- `packages/runtime/src/plugin/live/agent-bindings.mjs`：
  - `resolveConsumptionViews()`；
  - `installPersonaForSetup()`；
  - `getPersonaSlot()`；
  - `rootTeamContextBlock()`；
  - `agentSetup()`。
- 成员 Team tool 参数定义的最小片段。

### 不要求读取

- 普通 Agent preset 工具；
- D2 work execution；
- client；
- restart boot；
- full blueprint implementation。

### 工作内容

1. 确认成员 owning root、instanceId 是否已经在 setup 中可获得。
2. 确认 member persona branch 为什么没有 root context block。
3. 设计最小 member context payload，不扩展 D2 结果语义。
4. 确认 fresh-create、cold-resume、跨 root 三种路径的身份来源是否一致。

### 输出

```text
C1Result
- owning_identity_available: yes | no
- exact_install_seam:
- minimal_context_fields:
- affected_function:
- fresh_resume_consistent: yes | no
- blocker:
```

---

## C2：D2 结果与 D4 projection 现有 seam characterization

**时间盒**：35–50 分钟  
**分支**：`task/team-d2-d4-c2-existing-seams`  
**写入**：仅 `dev/agent-workflow/evidence/team-d1-d6-repair/C2/`，不改产品代码

### 单一上下文

本任务分成两个互不混写的小问题，但由同一个调查代理执行，以节省重复读取：

```text
A. member turn completion
→ WorkDeliveryPort
→ RuntimeActionEffect
→ Leader-visible result

B. Team mutation response / client callback
→ projection invalidation
→ TeamProjectionStore.pull()
```

### 允许读取

- `docs/local-issues/team-work-result-not-delivered-to-leader.md`；
- `docs/local-issues/team-projection-not-live.md`；
- `packages/runtime/action-router/work-execution.ts`；
- `packages/runtime/action-router/effects.ts` 的 delegate/follow-up 相关段落；
- `packages/runtime/admission/types.ts` 的 `WorkDeliveryPort`；
- `packages/runtime/src/plugin/live/agent-bindings.mjs` 的 `workDelivery.deliver()`；
- `packages/client/src/plugin/team-mount-core.ts`；
- `packages/client/src/state/team-projection-store.ts`；
- `packages/client/src/transport/team-remote-client.ts`；
- 现有 remote connection generation seam。

### 不要求读取

- D1 setup；
- D3 persona；
- D6 boot adoption；
- 完整 UI component tree。

### 工作内容

1. D2：判断是否能在现有 Team-owned result/effect seam 中做“最小 success body 返回”，还是必须新增跨层 contract。
2. D2：列出不可在本轮偷偷改变的语义：失败、取消、超时、重复 token。
3. D4：判断 Agent/tool mutation 的成功响应是否能抵达已有 `pullProjection()`。
4. 如必须新增 host push、remote method 或 connection event，立即标为 deferred/blocker，不进入小修。

### 输出

```text
C2Result
- d2_existing_result_seam: yes | no
- d2_minimal_files:
- d2_contract_change_required: yes | no
- d4_existing_invalidation_seam: yes | no
- d4_minimal_files:
- cross_layer_change_required: yes | no
- recommendation:
```

---

# 4. G1：方案分流闸

**执行者**：主 Agent 依据 C0/C1/C2 结果机械判定  
**时间盒**：15–25 分钟

## 4.1 进入实现的条件

### D3

C1 必须确认：

- owning root 和 instanceId 已存在；
- 只需要补 member prompt/persona 分支；
- 不需要修改 upstream 或共享 Team contract。

### D1

只有 C0 明确发现公开 composition seam，才创建 T1；否则 D1 标记 `CORE_SEAM_BLOCKER` 或 `DEFERRED`，本轮不实现。

### D2

只有 C2 证明可在 Team-owned runtime 内以极小的结果返回/投递改动闭合，才创建 T3；如果需要重新定义 remote/message/storage protocol，则本轮 deferred。

### D4-A

只有 C2 证明现有 mutation response/callback 能调用已有 `pullProjection()`，才创建 T4；否则不新增 push/event 协议。

### D5

无需等待 C0–C2。默认进入 T5 的文档/契约对齐，不修改 allocation algorithm。

## 4.2 G1 输出

```text
G1ScopeDecision
- approved_tasks:
- deferred_tasks:
- blocked_tasks:
- allowed_files_by_task:
- shared_contract_locks:
- implementation_budget_remainder:
```

---

# 5. Wave 2：最小实现任务

Wave 2 只启动 G1 批准的任务。每个任务必须在自己的 worktree 中完成并提交 atomic commit。

## T1：D1 成员基础工具最小组合

**条件**：C0 = `public_composition_seam: yes`  
**时间盒**：45–70 分钟  
**分支**：`task/team-d1-member-base-tools`  
**独占写区**：

- `packages/runtime/src/plugin/live/agent-bindings.mjs`；
- C0 指定的 Team-owned setup adapter；
- D1 focused tests。

### 单一上下文

```text
公开普通 Agent setup seam
→ member setup composition
→ Team tools + base tools 共存
```

### 工作内容

1. 在不复制 upstream 内部实现的前提下调用公开 setup/preset seam。
2. 保留现有：
   - Team tool registration；
   - model selection；
   - persona；
   - MCP；
   - scope disposal。
3. 明确 setup 的调用顺序，避免普通 setup 覆盖 Team tools 或 Team setup 覆盖基础 tools。
4. 只修成员路径；若 Leader/普通 session 会被改变，停止并报告 scope conflict。

### 必须测试

- 成员至少一个受控文件读取成功；
- 成员至少一个受控 shell/pwd 探针成功；
- Team tools 仍存在；
- setup disposal 无重复注册；
- 普通非 Team 工具表不变（仅在共享 setup 被修改时运行最小 smoke）。

### 明确禁止

- patch upstream；
- 复制普通 DSH tool catalog；
- 修改 D2 结果协议；
- 修改 D3 persona 语义；
- 扩大到完整工具治理重构。

### 停止条件

- 公开 seam 不能按 C0 预期工作；
- 需要修改 shared Agent core；
- 需要修改普通 session controller；
- 超过 70 分钟仍未有最小 member tool proof。

此时提交 evidence，不提交半成品功能性承诺。

---

## T2：D3 成员身份上下文最小补丁

**条件**：C1 = `owning_identity_available: yes`  
**时间盒**：35–50 分钟  
**分支**：`task/team-d3-member-context`  
**独占写区**：

- `packages/runtime/src/plugin/live/agent-bindings.mjs`；
- 与 context helper 直接对应的 Team-owned test。

### 单一上下文

```text
installPersonaForSetup()
→ member identity block
→ scoped systemPrompt.section
```

### 工作内容

1. 在 member 分支追加 machine-readable context block。
2. 字段最小集合：
   - owning `rootSessionId`；
   - member `instanceId`；
   - `role=member`；
   - Team tool envelope 的必要规则。
3. 身份必须来自 setup 的 durable row/hint，不能来自模型输入。
4. root 与 member context 使用不同 helper，不能将 root 的 leader identity 原样复制给 member。
5. 覆盖：
   - fresh-create window；
   - cold resume；
   - member belongs to non-boot Team root。

### 必须测试

- fresh member prompt 有正确 root/member identity；
- cold resume prompt identity 一致；
- 成员可生成合法 `team_list_members` 或指定 report/message 调用；
- 错误 root 仍被拒绝且零副作用；
- repeated setup 不生成重复 prompt section。

### 明确禁止

- 修改工具 schema；
- 修改 caller resolution；
- 修改 D2 result path；
- 把 requestToken 重新设计成 durable identity。

### 停止条件

如果身份无法从现有 setup seam 稳定取得，停止并记录 `DEPENDENCY_BLOCKER`，不允许引入新的 global registry。

---

## T3：D2 最小 Leader-facing result 闭环

**条件**：C2 = `d2_existing_result_seam: yes`  
**时间盒**：60–90 分钟  
**分支**：`task/team-d2-minimal-result`  
**独占写区**：仅 C2 证明必需的 Team-owned 文件，可能包括：

- `packages/runtime/admission/types.ts`；
- `packages/runtime/action-router/work-execution.ts`；
- `packages/runtime/action-router/effects.ts`；
- `packages/runtime/src/plugin/live/agent-bindings.mjs`；
- 对应 focused tests。

如需修改 remote/storage schema，T3 自动 deferred，不能扩大写区。

### 单一上下文

```text
member turn output
→ requestToken correlation
→ minimal structured result
→ Leader-visible action result or Team report
```

### 本任务的最小目标

先只闭合：

- success body；
- explicit failed status/body；
- requestToken correlation；
- existing-member follow-up 与 new-member delegate 都能读取结果。

取消、超时、重复投递等必须至少保持明确、不伪装成功；不在本 task 内构建完整聚合系统。

### 必须测试

- success body 到达 Leader；
- failure 到达 Leader；
- follow-up body 到达 Leader；
- `settled:true` 不能单独构成 business success；
- requestToken 不错配；
- duplicate/replay 不重复报告；
- 无结果时返回显式 unavailable/failure，而不是空成功。

### 明确禁止

- 复制完整 transcript；
- 新增 ledger category；
- 新增通用 messaging platform；
- 同时实现 action-return、message-report、remote subscription 三套方案；
- 修改 upstream。

### 停止条件

如果必须新增完整 durable result schema、Leader inbox 或 remote channel，报告 `CONTRACT_CHANGE_REQUEST`，本轮不实现 T3。

---

## T4：D4-A Team projection 最小 liveness 修复

**条件**：C2 = `d4_existing_invalidation_seam: yes`  
**时间盒**：35–60 分钟  
**分支**：`task/team-d4-projection-invalidation`  
**独占写区**：

- `packages/client/src/plugin/team-mount-core.ts`；
- 必要的现有 Team UI command callback；
- 对应 client focused tests。

### 单一上下文

```text
existing Team mutation success
→ existing callback/response
→ existing pullProjection(teamSessionId)
→ generation-safe projection mirror
```

### 工作内容

1. 补齐 C2 找到的遗漏 callback。
2. 统一调用已有 `pullProjection()`；不直接绕过 projection store。
3. 保持：
   - generation stale rejection；
   - single-flight；
   - reconnect backoff；
   - ledger refresh linkage。
4. 只修 D4-A live projection。

### 必须测试

- Agent/tool 或现有 mutation response 成功后无 F5 更新；
- member create 至少一个场景；
- lifecycle/policy/override 至少覆盖一个代表性路径；
- duplicate/out-of-order frame 不回退；
- pull single-flight 保持。

### 明确禁止

- 新增 host push；
- 新增 remote method；
- 新增 connection event；
- 定时轮询；
- 修改 D4-B history retention；
- 修改 D4-C effective-config 派生列表。

### 停止条件

如果 mutation 不经过现有 callback，T4 输出 `D4-A DEFERRED: existing invalidation seam insufficient`，不进入 remote/host 架构扩展。

---

## T5：D5 instanceId 契约对齐

**时间盒**：20–35 分钟  
**分支**：`task/team-d5-instance-contract`  
**独占写区**：

- 非冻结的本地计划/问题状态文档；
- activation focused tests；
- evidence。

### 单一上下文

```text
requestToken
→ deterministic instanceId
→ journal reservation
→ replay/convergence
```

### 工作内容

1. 不增加 `team_create_member.instanceId` 字段。
2. 固化 provider-owned deterministic allocation 作为当前契约。
3. 最小测试：
   - 同 token replay 得到同 instance；
   - 不同 token 得到不同 instance；
   - 同模板并行创建不冲突；
   - `inst-leader` 保留；
   - custom field 负例明确拒绝或不进入合法 schema。
4. 更新非冻结的验收/问题状态说明；冻结计划不直接改写。

### 明确禁止

- 修改 identity algorithm；
- 修改 journal schema；
- 引入 alias/第二身份系统；
- 仅为满足旧验收文字而支持 caller-controlled ID。

### 结果

D5 判定为：

```text
DESIGN CONFIRMED / DOCUMENTATION ALIGNED
```

如用户随后要求自定义 ID，另开 `CONTRACT_CHANGE_REQUEST`，不属于本计划的最小修复。

---

# 6. G2：成员闭环集成闸

**时间盒**：25–40 分钟  
**执行者**：主 Agent + 独立集成测试子代理

## 6.1 集成顺序

```text
先 T2 D3
→ 再 T1 D1（若批准）
→ 再 T3 D2（若批准）
→ 最后 T4 D4-A / T5 D5
```

原因：

- D3 identity 是成员 Team tool 可用性的前置；
- D1 setup 组合可能触及同一 `agent-bindings.mjs`，必须先由主 Agent 机械解决冲突；
- D2 结果闭环必须建立在成员能真实执行/调用的基础上；
- D4/D5 与成员 work execution 相对独立。

## 6.2 G2 focused checks

并行执行：

1. D3 fresh/resume context tests；
2. D1 member tool tests（若存在）；
3. D2 result tests（若存在）；
4. D4 client projection tests（若存在）；
5. D5 activation tests；
6. Team-owned typecheck；
7. `git diff --check`。

## 6.3 G2 停止规则

遇到以下情况停止，不扩大 patch：

- 需要新增 storage schema；
- 需要新增 ledger category；
- 需要改变冻结 DTO；
- 需要修改 upstream；
- 需要复制普通 Agent 内部实现；
- 需要完整重写 member work chain；
- 需要重建 remote dispatcher/catalog；
- 需要新增通用 session ownership registry。

---

# 7. G3：Team-mode 测试与验收

**执行者**：未参与实现的测试子代理  
**时间盒**：45–60 分钟

## 7.1 测试范围

默认只测 Team-mode agent loop，不重复整套非 Team loop。只有当变更实际触及共享 Agent setup、session resume、connection 或 tool registration，才增加一个最小普通会话 smoke。

## 7.2 必测 Team 场景

### 场景 A：成员身份

```text
创建 Team
→ 创建成员
→ 打开成员会话
→ 观察 system prompt / trace
```

断言：

- 正确 `rootSessionId`；
- 正确 `instanceId`；
- 明确 member role；
- fresh/resume 一致；
- 错误 root 仍 fail closed。

### 场景 B：成员工具（若 T1 通过）

```text
成员读取 fixture 文件
→ 成员执行受控 pwd/shell
→ 成员调用一个 Team tool
```

断言：

- 不是模型猜测；
- 工具 trace 显示真实调用；
- Team tools 与基础 tools 同时存在。

### 场景 C：Leader result（若 T3 通过）

```text
Leader delegate
→ member success
→ Leader receives body
Leader follow-up
→ member failure/success
→ Leader receives explicit result
```

### 场景 D：projection（若 T4 通过）

```text
Agent/tool mutation
→ 不刷新页面
→ Team tab 观察 projection
```

### 场景 E：D5

验证系统分配 ID、同 token replay 和不同 token 并行。

## 7.3 本轮不宣称通过的项目

除非另行批准并获得对应实现：

- D2 完整异步聚合协议；
- D4-B dispose/history retention；
- D4-C effective-config derived allow/deny；
- D6 restart/reopen 修复。

D6 仍引用：

```text
docs/local-issues/team-root-tools-lost-after-restart.md
```

## 7.4 验收输出

```text
AcceptanceResult
- scope: Team-mode agent loop
- scenarios:
- PASS:
- FAIL:
- DEFERRED:
- BLOCKED:
- evidence_paths:
- console_errors:
- network_errors:
- upstream_test_use_clean: yes | no
- stable_3080_touched: no
```

---

# 8. D6 restart 专项任务（独立后续，不强塞进本轮）

## T6：dynamic Team root restart/reopen

**前置**：D1/D3/D2 的成员闭环已经稳定；另行批准预算。  
**建议时间盒**：60–100 分钟实现 + 30–45 分钟 Team restart smoke

### 单一上下文

```text
persisted TeamSession rows
→ dynamic root enumeration/adoption
→ Team glue agentSetup()
→ ordinary Web reopen
→ team_* re-registration
```

### 主要关注点

- `live.boot()` 当前只恢复固定 boot root；
- dynamic Team root 需要被枚举和接管；
- 普通 Web resume 不能绕过 Team glue `agentSetup()`；
- Leader 恢复后必须重新注册完整 Team tools；
- 不通过重建普通 session 或 patch upstream 解决。

### 为什么单独拆出

D6 同时触及：

- host boot；
- persisted Team root discovery；
- session resume ownership；
- Agent setup；
- Team tool registration；
- browser reopen。

它不是 D3 的 prompt 小补丁，也不是 D1 的 member setup 小补丁。将它塞入同一 2 小时 implementation window 会迫使 worker 扩大读取面，降低定位质量并违反上下文隔离原则。

---

# 9. 时间预算讨论

本节在任务细化后讨论时间，而不是先用总时长反推任务。

## 9.1 按任务的串行工作量

| 阶段 | 目标时间 |
|---|---:|
| P0 准备 | 20–30 分钟 |
| C0/C1/C2 并行调查 | 35–50 分钟墙钟 |
| G1 分流 | 15–25 分钟 |
| T1 D1（若可行） | 45–70 分钟 |
| T2 D3 | 35–50 分钟 |
| T3 D2（若可行） | 60–90 分钟 |
| T4 D4-A（若可行） | 35–60 分钟 |
| T5 D5 | 20–35 分钟 |
| G2 集成 | 25–40 分钟 |
| G3 Team smoke | 45–60 分钟 |
| D6 T6（另行） | 90–145 分钟 |

### 结论

**完整闭合 D1–D6 不可压缩到 2 小时实现 + 1 小时测试。**

具体原因：

1. 即使 C0 发现 D1 有现成 public seam，D1 仍需要 setup 组合、真实工具证明和回归；
2. D2 当前接口是 `Promise<void>`，不是单纯漏转一个字段，而是缺少 Leader-facing result contract；
3. D4-A 只有在已有 invalidation seam 足够时才是小修，否则会跨 remote/host/client；
4. D6 是独立 restart/adoption 边界，至少需要一次进程重启和 session reopen；
5. 三个问题都需要真实 Team-mode loop 复测，1 小时测试预算不足以覆盖完整闭环和重启。

## 9.2 最小可行批次

如果总预算硬性限定为：

```text
实现最多 120 分钟
测试最多 60 分钟
```

则建议执行以下最小批次：

```text
P0 10 分钟压缩准备
→ C1 15 分钟身份 seam check
→ T2 40 分钟 D3 实现
→ T5 20 分钟 D5 对齐
→ 集成/构建 15 分钟
→ Team smoke 60 分钟
```

该批次可以合理承诺：

- D3：若 C1 结论确认，目标 PASS；
- D5：PASS（契约/文档对齐）；
- D1：只做 C0 快速可行性判定，不承诺修复；
- D2：只做 C2 快速可行性判定，不承诺修复；
- D4-A：只做现有 seam 判定，不承诺跨层实现；
- D6：保留为后续任务。

## 9.3 如果希望本轮尽量多修

建议最低采用以下扩展预算：

```text
实现：约 4–6 小时累计 worker 时间
测试：约 1.5–2.5 小时
墙钟：利用 Wave 1 并行后约 3–5 小时
```

推荐顺序：

1. C0/C1/C2 并行定位；
2. D3 与 D5 先闭合；
3. 若 seam 允许，再做 D1；
4. 再做 D2 最小 success/failure result；
5. 再做 D4-A；
6. 最后单独做 D6 restart。

这里的“累计 worker 时间”和“墙钟时间”必须区分。并行可以压缩墙钟，但不能把多个代理需要理解和验证的工作量从总工作量中消除。

## 9.4 时间盒停止规则

- C0/C1/C2 到达时间盒后必须输出结论，不能继续扫描。
- 任一 T task 到达时间盒后停止扩大范围；可以提交 partial evidence，但不能继续顺手改相邻模块。
- 如发现 public seam 不足，立即输出 blocker，不把剩余时间消耗在 workaround。
- 测试时间用尽时，未覆盖的场景必须标记 `NOT-RUN/DEFERRED`，不得推断通过。

---

# 10. 审查、集成和回滚

## 10.1 Task review

每个实现 task 由未参与该 task 的子代理进行只读审查。review brief 只包含：

- frozen spec 相关片段；
- task packet；
- base SHA → candidate SHA；
- changed files；
- tests/evidence。

reviewer 不接收其他 reviewer 意见，不直接修改实现。

## 10.2 Gate review

如果执行完整批次：

- G2 后进行一次 Team member closure review；
- G3 后进行三代理盲审；
- 任一 `阻塞` 停止跨 Gate；
- `补充内容` 后重新审整个 Gate；
- `投机通过` 写入风险台账。

在严格 2h+1h 预算批次中，完整三盲审不计入实现/测试预算；若用户要求三盲审也包含在 3 小时总预算内，则只能进一步缩小实现范围，不应假设可以免费完成。

## 10.3 集成纪律

- 只 cherry-pick 已有 `TaskResult` 和通过定向检查的 atomic commit；
- Gate 通过前不合入 `master`，不 push；
- 任何集成冲突由主 Agent 做机械冲突整理，不重写 worker 设计；
- 每个任务保留可逆 commit；
- 测试后复核 upstream test-use checkout byte-clean。

---

# 11. 待用户审阅的决策

1. 是否接受本计划的 DAG 和“按上下文集合，而非前后端模块”分工方式。
2. 是否接受完整 D1–D6 不承诺在 2h 实现 + 1h 测试内完成。
3. 在硬预算批次中，是否优先执行 D3 + D5，并对 D1/D2/D4 做 seam check；D6 另行执行。
4. D2 是否允许先做最小 success/failure result，而把完整异步聚合、取消、超时和远程订阅拆为后续任务。
5. D4 是否只把 D4-A live projection 作为核心目标，D4-B/D4-C 单独拆分。
6. 是否确认 D5 继续采用 provider-owned deterministic `instanceId`，不支持 caller-controlled ID。

**当前状态：计划待审阅；未启动任何实现、测试或审查子代理。**

---

# 12. 本轮执行复盘（2026-09-07）

> 以下时间均为主 Agent 收到 TaskResult 并完成机械记录的时间；worker 的 elapsed 另见各自 TaskResult/evidence。未通过的任务按计划停止，未以半成品宣称修复完成。

| 阶段/任务 | 完成时间（+08:00） | 结果 | 证据 |
|---|---|---|---|
| P0 基线与 evidence 准备 | 2026-09-06T23:48:26.2065938+08:00 | PASS | `dev/agent-workflow/evidence/team-d1-d6-repair/P0/baseline.md` |
| C1 D3 seam characterization | 2026-09-07T00:00:00+08:00（worker elapsed 约20m；commit 记录 00:00:19） | PASS | `dev/agent-workflow/evidence/team-d1-d6-repair/C1/C1-result.md` |
| C2 D2/D4 seam characterization | 2026-09-06T23:56:17+08:00（evidence commit） | D2/D4 DEFERRED | `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md` |
| C0 D1 seam characterization | 2026-09-07T00:00:47+08:00（evidence commit） | PASS，批准 T1 | `dev/agent-workflow/evidence/team-d1-d6-repair/C0/C0Result.md` |
| G1 方案分流 | 2026-09-07T00:01:00+08:00（主 Agent 记录） | T1/T2/T5进入；T3/T4 deferred；T6 blocker | `dev/agent-workflow/SESSION_ROUTER_LOG.md` |
| T2 D3 实现 | 2026-09-07T00:06:10+08:00（attempt 2 evidence commit） | DEFERRED，`DEPENDENCY_BLOCKER`（fresh worktree 缺 `yaml`，focused test 未收集） | `dev/agent-workflow/evidence/team-d1-d6-repair/T2-d3-status.md` |
| T3 D2 实现 | 2026-09-07T00:02:00+08:00（C2 后收尾） | DEFERRED，`CONTRACT_CHANGE_REQUEST` | `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md` |
| T4 D4-A 实现 | 2026-09-07T00:06:12+08:00（evidence commit） | DEFERRED，`CONTRACT_CHANGE_REQUEST` | `dev/agent-workflow/evidence/team-d1-d6-repair/T4-d4/T4Result.md` |
| T5 D5 契约对齐 | 2026-09-07T00:06:11+08:00（worker commit） | PASS，5/5 focused tests | `packages/runtime/test/d5-instance-contract.test.ts`; `dev/agent-workflow/evidence/team-d1-d6-repair/T5-d5/summary.md` |
| T6 D6 restart/reopen | 2026-09-07T00:07:00+08:00（blocker evidence 收尾） | BLOCKED，`CORE_SEAM_BLOCKER` | `dev/agent-workflow/evidence/team-d1-d6-repair/T6-d6/core-seam-blocker.md` |
| T1 D1 成员基础工具 | 2026-09-07T00:07:30+08:00（时间盒收尾） | DEFERRED，未形成有效绿态；需 host-owned adapter/dependency wiring | C0 evidence + worker TaskResult |

## 12.1 本轮最终范围

- **PASS**：D5 契约/测试对齐。
- **DEFERRED**：D1、D2、D3、D4-A。
- **BLOCKED**：D6，原因是 upstream 普通 Web reopen 没有 downstream Team setup interception public seam；禁止 patch upstream/private API。
- **未修改**：upstream 测试源码、稳定实例 `:3080`、`D:\deepseek-harness`。
- **已集成到当前本地 `master` 的本轮提交**：C0 evidence、C2 evidence、T2 deferred evidence、T4 deferred evidence、T5 test/evidence、T6 CORE_SEAM_BLOCKER evidence；C1 evidence 保留在其独立 worktree/commit `66f38c7a`，未 cherry-pick（避免把重复的 characterization 文档带入当前 master）。
- **未宣称**：D2 完整结果协议、D4-B/D4-C、D6 restart/reopen。

## 12.2 复盘注意

- 本轮 C0/C1/C2 为只读 characterization，均按隔离 worktree 完成。
- T2 的两次尝试都未进入有效 test collection；没有产品代码变更，不能把 D3 判为 PASS。
- T5 的测试通过只确认已有 provider-owned deterministic `instanceId` 设计，不代表 caller-controlled ID 被支持。
- T6 的 `CORE_SEAM_BLOCKER` 是门禁级阻塞；继续做 workaround 将违反 CORE PATCH BUDGET = 0。
- G2/G3 尚未执行：当前存在 D6 Gate blocker，且没有可供 G2 集成的 D1/D3/D2/D4 产品修复提交。

