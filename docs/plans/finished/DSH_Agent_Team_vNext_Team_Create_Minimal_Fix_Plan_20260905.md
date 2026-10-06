# Team 创建链最小修复执行计划

**状态：已归档｜收缩修订版已执行完成，创建链 D-3 修复已推送。**  
**真正执行进度：** 原第 2–14 节方案作废；按第 15 节执行的最小修复完成了无 initial work / 有 initial work 的创建协议收缩设计，并在 R140 通过客户端铸造 root id、host 创建/启动 Leader、失败保留 root、重试复用 id、workspace 展示化与类型化错误路径收口。  
**完成时间：** 2026-09-05（R140，提交 `7e0c7d3`，推送 tip `5b0e59d`）。  
**日期**：2026-09-05  
**目标墙钟**：3–4.5 小时  
**实现模型**：`qiyuan-self/qwen3.8-27b`  
**约束**：零 upstream patch；保留 Remote v1；不新增独立 Root-work 子系统；不扩大为完整 Remote/ledger 重构

---

## 1. 计划定位

本计划取代同目录中较大的 Team 创建链修复方案，专门解决两个用户已复现的问题：

1. `Create & Send` 将 Leader v2 当成普通 Member，因缺少 `lifecycle` 而报 `TEAM_RUNTIME_WORK_STATE_REJECTED`；
2. Creation Panel 中选择的 workspace 没有进入 host authority，Root Session 落入默认位置或 Ungrouped，用户随后误入普通 New Session。

本计划只修复创建链，不借机重构普通 Member work、Team ledger、Remote 全部方法或客户端会话架构。

### 1.1 完成后的产品行为

无 initial work：

```text
选择 workspace B
→ 创建 TeamSession + honest Leader v2
→ 创建并持久化真实 Root Agent
→ 显式 attach Root Session 到 workspace B
→ 打开 Root
→ 不产生首轮 turn
```

有 initial work：

```text
选择 workspace B
→ 第一阶段创建并 attach Root
→ 客户端打开真实 Root
→ 第二阶段调用同一 Remote v2 team.create 的 deferred-initial-work continuation
→ Team authority admission
→ Root Agent 收到首轮 work
```

顺序严格保持：

```text
create TeamSession
→ open Root
→ admit initial work
→ Root first turn
```

### 1.2 明确不做

本次不做：

- 不修改 upstream DSH；
- 不修改 Remote v1 的字段、parser 或既有行为；
- 不新增 `team.admitRootWork` 等 Remote method；
- 不增加 Remote catalog method 数量；
- 不新增 `packages/runtime/root-work/` 子系统；
- 不新增 ledger category；
- 不给 Leader 增加 `lifecycle` 或 `childSessionId`；
- 不把 initial work 直接降级为裸 upstream `Session.prompt`；
- 不承诺模糊 accept/observe crash window 下的模型 turn exactly-once；
- 不设计通用的 Workspace move/attach UI；
- 不重构普通 Member work chain；
- 不修改冻结四文档。

---

## 2. 最小技术方案

## 2.1 Remote v1 保持不变，增加最窄 v2 分支

Remote envelope 增加对版本 `2` 的支持，但 method catalog 不变，仍使用：

```text
team.create
```

### v1

现有 v1 参数、解析和运行行为保持兼容：

```ts
interface RemoteTeamCreateParamsV1 {
  rootSessionId: string
  blueprintId: string
  blueprintRevision?: number
  initialWork?: RemoteLosslessRecord
}
```

不得把 workspace 或 token 加入 v1 field list。

### v2

v2 `team.create` 使用一个很小的参数扩展：

```ts
interface RemoteTeamCreateParamsV2 {
  rootSessionId: string
  blueprintId: string
  blueprintRevision?: number
  createRequestToken: string
  workspace?: string
  initialWork?: {
    requestToken: string
    prompt: string
    attachedContext?: string
  }
}
```

语义：

- 第一次调用不携带 `initialWork`：创建、启动、materialize、attach Root；
- Root 打开后，第二次调用同一个 root、blueprint、workspace、`createRequestToken`，携带 `initialWork`：cold continuation，只 admission/deliver 初始 Root work；
- 同一 create token 的 blueprint/workspace 不一致：typed mismatch；
- 同一 work token 的 canonical payload 不一致：typed mismatch；
- 新工作不能通过更换 token 后继续调用 `team.create`；v2 create 只接受至多一个 creation-time initial-work operation。

选择复用 `team.create` 的理由是：

- 现有方法已经支持 fresh/cold root；
- 不增加 Remote catalog method；
- 不新增 client transport operation；
- 第二次调用是同一个 create operation 的延迟完成，而不是普通后续 work。

## 2.2 Workspace authority 与显式 attach

客户端把选中的：

```text
TeamWorkspaceOption.path
```

作为 v2 `workspace` 发送，不发送 opaque workspace id 作为 cwd。

Host 必须通过公开 `workspaceRegistry` 将请求 path 解析为已注册 Workspace，并使用 Workspace 自己的 canonical path。

创建顺序：

```text
resolve registered Workspace
→ bind TeamSession.defaultWorkspace = Workspace.path
→ createRootAgent(rootSessionId)
→ ensure Root Session materialized
→ Workspace.attachSession(rootSessionId)
→ return success
```

规则：

- workspace 不存在或 path 不对应注册 Workspace：bind 前 typed rejection；
- cold retry 的 durable `defaultWorkspace` 与请求 canonical path 不同：typed mismatch；
- attach 失败：Root/TeamSession 保留，create 返回 typed retryable failure；
- 同一 root/workspace 重试时，`attachSession` 幂等重驱；
- workspace 字段省略时继续使用 host default workspace；本次不强制把未注册的 host default path 建成 Workspace。

Team host plugin 增加公开 `workspaceRegistry` dependency。若实际 composition 无法取得这个公开 Cordis service，则立即报告 `CORE_SEAM_BLOCKER`，不使用 client `sessions.create()` 绕过。

## 2.3 Root initial-work 窄路径

不让 v2 initial work 进入：

```text
TeamRuntime.performAction(follow-up, target=inst-leader)
```

而是在现有 action-router/production-root 内加入一个窄的 Root work strategy。它必须复用：

- production root 的现有 per-team coordination lock；
- 现有 compatibility authority/gate；
- 现有 Team ledger repository；
- live Root input adapter。

它不得使用：

- Member lifecycle gate；
- Member lifecycle transition；
- `childSessionId`；
- `member-lifecycle-changed` settlement。

## 2.4 不新增 ledger factType/category

继续使用已经映射到 `team` category 的：

```text
team-work-admitted
```

Root initial-work entries通过 payload 区分：

```json
{
  "targetKind": "root",
  "rootSessionId": "session-...",
  "requestToken": "...",
  "payloadFingerprint": "...",
  "phase": "admitted | delivered | delivery-failed",
  "retryable": true
}
```

最小扫描规则：

```text
存在 phase=delivered
→ terminal replay，零 delivery

存在 admitted，但没有 delivered
→ resume/retry delivery

最近 phase=delivery-failed 且 retryable=true
→ same-token retry delivery

相同 token、不同 payloadFingerprint
→ ROOT_WORK_PAYLOAD_MISMATCH
```

本次不增加独立 activity interval，也不把 Root 强行塞入 Member activity/lifecycle。Root first turn 的实际运行状态继续由 Root Session 自身持久事件表达；Team ledger只记录 creation-time Root work 的 admission/delivery结果。

## 2.5 Delivery adapter 只做局部提炼

在 `agent-bindings.mjs` 中抽取私有：

```js
deliverRootInput({ rootSessionId, text })
```

内部复用现有顺序：

```text
ensureLiveAgent
→ prepareAgentForRequest(root, root)
→ createUserMessage
→ agent.followup
→ whenIdle
→ session materialization
```

现有 `deliverRootContext` 和新增薄 adapter `deliverRootWork` 均调用该私有函数，避免复制实现。

`deliverRootWork` 的模型可见文本固定为：

```text
[team-work requestToken=<token>] <prompt>
```

有 attached context 时沿用普通 work 的格式：

```text
<prompt>\n\n[attached-context]\n<context>
```

## 2.6 故障保证

本次保证：

- delivered success fact 对同一 work token 唯一；
- success 后重试不会再次 delivery；
- 明确拒绝同 token/different payload；
- 普通可判定的 delivery rejection 可以 same-token retry；
- request token 始终模型可见。

本次只承诺：

```text
模型可见 Root delivery 在 ambiguous accept/observe crash window 中是 at-least-once。
```

如果 `followup` 已接受，但 `whenIdle` 或 materialization 的结果丢失，重试可能重复 Root turn。这是现有公开 seam 的限制，不在本次 3–4.5 小时修复中扩展为 exactly-once inbox 工程。

---

# 3. 串并行执行编排

## 3.1 总 DAG

```text
P0 基线与 15 分钟 seam check
│
├──────── Wave 1：3 个实现代理并行 ────────┐
│                                         │
│ M1 Remote v2 parser/handler             │
│ M2 Host workspace attach                │
│ M3 Root work strategy + live adapter    │
│                                         │
└──────────────── G1 集成 ────────────────┘
                    │
                    ▼
             M4 Client two-stage flow
                    │
                    ▼
             G2 focused integration
                    │
                    ▼
       M5 real-composition smoke + 三盲审
```

最大实现并发为 3。所有任务保持独立写区；主代理只做 cherry-pick、接口对齐和小型冲突修复。

## 3.2 Git 纪律

```text
1 task = 1 branch = 1 worktree = 1 writer
```

建议 integration branch：

```text
int/team-create-minimal-fix
```

建议任务分支：

```text
task/tcm-m1-remote-v2
task/tcm-m2-workspace-attach
task/tcm-m3-root-initial-work
task/tcm-m4-client-two-stage
task/tcm-m5-real-smoke
```

任务提交通过定向检查后使用：

```text
git cherry-pick -x
```

进入 integration branch。Gate 通过前不合入 master，不 push。

---

# 4. P0：基线和硬 seam check

**时间盒：15–20 分钟。**

## 4.1 固定读取

所有代理第一步读取：

1. `docs/ROUTER_RULES.md`
2. `docs/TEST_METHODS.md`
3. 本计划中自己的任务章节

不允许重新扫描全部历史日志来推导需求。

## 4.2 主代理检查

1. 确认当前 base commit 和 R140；
2. 确认 upstream test checkout clean；
3. 建立 integration/task worktrees；
4. 确认 `workspaceRegistry` 是 host composition 中可注入的公开 service；
5. 确认现有 `team-work-admitted` 映射到 ledger `team` category；
6. 冻结 v2 params 和上述 Root fact payload；
7. 把以下 typed codes加入任务 brief：

```text
TEAM_CREATE_WORKSPACE_NOT_FOUND
TEAM_CREATE_WORKSPACE_MISMATCH
TEAM_CREATE_WORKSPACE_ATTACH_FAILED
TEAM_CREATE_REQUEST_PAYLOAD_MISMATCH
TEAM_CREATE_ROOT_WORK_UNAVAILABLE
TEAM_CREATE_ROOT_WORK_PAYLOAD_MISMATCH
TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED
```

如第 4 项失败：workspace 子路径立即 `CORE_SEAM_BLOCKER`；Root initial-work 修复可以继续，但不得用 private import 或 client ordinary session create补洞。

---

# 5. Wave 1 并行任务

## M1：Remote v2 最小版本分支

**时间盒：35–50 分钟。**

### 单一上下文

代理只理解：

```text
Remote envelope version
→ version-aware team.create params
→ handler forwarding
```

不读取 React、Agent glue、Workspace implementation或普通 work chain。

### 独占写区

- `packages/remote/src/contracts/version.ts`
- `packages/remote/src/contracts/params.ts`
- `packages/remote/src/contracts/request.ts`
- `packages/remote/src/handlers/team.ts`
- `packages/remote/src/handlers/ports.ts`
- 对应 Remote focused tests

### 工作内容

1. supported versions 从 `[1]` 扩为 `[1, 2]`；
2. 保持 v1 parser和字段列表原样；
3. 增加 v2 `team.create` parser；
4. handler根据 request version选择 v1/v2 params；
5. v2 转发：
   - `createRequestToken`
   - `workspace`
   - structured `initialWork`
6. unknown fields 在每个版本继续 fail closed；
7. v1 response保持 `{ path, durable, bind }`；v2本次也复用该 response，不增加 partial-created schema。

### 必须测试

- v1 old request byte-compatible；
- v1 workspace/token字段被拒绝；
- v2 create-only合法；
- v2 deferred initialWork合法；
- malformed token/workspace/prompt被拒；
- v2 unknown field被拒；
- handler正确转发版本和字段；
- unsupported version仍 typed reject。

### 明确禁止

- 不新增 Remote method；
- 不修改 method catalog数量；
- 不删除 v1 initialWork；
- 不修改 runtime/client。

## M2：Host Workspace attach

**时间盒：35–55 分钟。**

### 单一上下文

代理只理解：

```text
selected path
→ registered Workspace
→ TeamSession.defaultWorkspace
→ Root materialize
→ Workspace.attachSession
```

不读取 Remote parser、React或 Root work ledger。

### 独占写区

- `packages/runtime/src/plugin/host.ts`
- workspace seam所需的 runtime plugin type文件
- focused host/workspace tests
- 必要的本仓 composition row

若需修改 Cordis composition，代理必须先加载 `editing-cordis-compositions` skill。

### 工作内容

1. Team host使用公开 `workspaceRegistry` service；
2. 建立窄的内部 `WorkspaceAttachPort`，避免其他模块理解 upstream registry；
3. 按 path查找注册 Workspace并返回其 canonical path；
4. 暴露给 production root/S6：
   - resolve path；
   - attach root session；
5. 不调用 client SessionController；
6. attach幂等性直接复用 `Workspace.attachSession`。

### 必须测试

- registered path解析；
- unknown path拒绝；
- canonical path返回；
- cwd mismatch时 attach拒绝；
- already attached重试无重复；
- missing service最早 fail closed；
- row dispose不留额外注册。

### 明确禁止

- 不修改 upstream；
- 不导入 upstream私有实现；
- 不使用 `sessions.create()` attach Team Root；
- 不修改 client。

## M3：Root initial-work strategy 与 live adapter

**时间盒：50–75 分钟。**

### 单一上下文

代理只理解：

```text
honest Leader v2
→ compatibility admission
→ Root-specific ledger phases
→ live Root input
```

不读取 React、workspace UI或 Remote parser。

### 独占写区

- `packages/runtime/action-router/` 内一个窄 Root work文件或现有内部提炼
- `packages/runtime/src/plugin/live/agent-bindings.mjs`
- `packages/runtime/src/plugin/types.ts`
- Root-work focused tests

避免修改 `s6-remote.ts` 和 `root.ts`；它们留给 G1 主代理集成，减少与 M2 冲突。

### 工作内容

1. 加入 Root work内部 strategy；
2. 使用现有 compatibility authority；
3. 由调用者保证持有现有 per-team lock；
4. 扫描同 root/token 的 `team-work-admitted` Root payload；
5. 实现 admitted/delivery-failed/delivered三阶段；
6. same token/different fingerprint拒绝；
7. Leader row保持 honest v2；
8. 抽取私有 `deliverRootInput`；
9. `deliverRootContext` 改为复用该私有函数；
10. 新增薄 `deliverRootWork` adapter。

### 必须测试

- honest Leader无 lifecycle/childSessionId仍成功；
- compatibility rejection在delivery前；
- admitted后delivery；
- retryable failure后same-token重驱；
- delivered后same-token replay零delivery；
- same-token different payload拒绝；
- request token模型可见；
- whenIdle/materialization fault传播；
- handoff context行为不变；
- generic Member work path未被放宽。

### 明确禁止

- 不新增 package；
- 不新增 ledger category；
- 不使用 `member-lifecycle-changed`；
- 不复制完整普通 Member work executor；
- 不声称 ambiguous crash window exactly-once。

---

# 6. G1：主代理最小集成

**时间盒：20–30 分钟。**

主代理按顺序集成：

```text
M1
→ M2
→ M3
```

随后只在以下两个 orchestration文件做必要接线：

- `packages/runtime/src/plugin/root.ts`
- `packages/runtime/src/plugin/s6-remote.ts`

## 6.1 S6 v2 创建路径

### 首次 create-only

```text
validate startRootAgent + optional workspace port
→ resolve blueprint/workspace
→ fresh bind using canonical workspace
→ startRootAgent
→ attach workspace
→ return
```

### 第二次 deferred initial work

```text
validate same create token/fingerprint/workspace
→ cold rehydrate
→ ensure Root Agent
→ ensure Workspace attached
→ under existing team coordination lock
→ execute Root work strategy
→ return
```

v2 不再构造 Leader generic follow-up。

v1保留既有 dispatch兼容；如果 v1 initialWork仍触发已知 Leader错误，不在本时间盒内重新定义其冻结行为。新 UI只使用 v2。

## 6.2 Create identity

最小 durable fingerprint通过现有 Team ledger记录一个 `team-work-admitted` 的 creation metadata entry，或复用已有 root-binding durable字段能够表达的 identity。不得为此新增 storage schema。

必须检查：

```text
same createRequestToken + same blueprint/workspace
→ idempotent continuation

same createRequestToken + changed blueprint/workspace
→ typed mismatch
```

如果无法在不新增 schema/factType 的情况下可靠保存 create token，允许把最小规则降为：

```text
rootSessionId + durable blueprint snapshot + durable defaultWorkspace
```

作为 create identity；`createRequestToken`仅用于日志/provenance。该降级必须写入 evidence，不得虚假宣称 token 本身 durable。

## 6.3 G1 tests

运行：

- Remote v1/v2 focused tests；
- Workspace attach focused tests；
- Root strategy focused tests；
- S6 fresh/cold create tests；
- TypeScript typecheck for remote/runtime。

失败只返还对应任务代理一次；不启动大型重构。

---

# 7. M4：Client 两阶段 Create & Send

**时间盒：35–55 分钟。**

### 单一上下文

代理只理解：

```text
Creation Panel draft
→ v2 create-only
→ open Root
→ v2 deferred initial work
```

不读取 runtime ledger或 WorkspaceRegistry implementation。

### 独占写区

- `packages/client/src/ui/TeamCreationPanel.tsx`
- `packages/client/src/ui/NewTeamEntry.tsx`
- `packages/client/src/model/team-intent-model.ts`
- `packages/client/src/transport/team-remote-client.ts` 必要类型接线
- 对应 client tests/locales

### 工作内容

1. TeamIntent draft增加本次 page-run 的：
   - stable `createRequestToken`；
   - stable `rootWorkRequestToken`；
2. 用户选择 workspace id时查找 `TeamWorkspaceOption.path`；
3. 第一次 v2 `team.create`不发送 initialWork；
4. 成功后 `openCreatedSession(rootSessionId)`；
5. 有 initial work时，再调用第二次 v2 `team.create`，携带相同 create identity和 structured initialWork；
6. 第二次失败时保持当前真实 Root打开，并显示现有 panel/error lane允许 retry；
7. retry冻结 root id、workspace、tokens和prompt fingerprint；
8. 不调用 `ctx.sessions.create()`；
9. 删除 workspace informational注释。

### 最小 UI 约束

本时间盒不新增复杂 Root banner系统。如果 Creation Panel overlay在 open后会卸载，采用最小可见错误方式：

- open调用不立即关闭 overlay，直到 deferred initial work成功；或
- overlay保持挂载于已打开 Root之上，第二阶段失败显示现有 typed error。

无 initial work时，Root打开后立即关闭 overlay。

### 必须测试

- workspace path而非 id进入 request；
- first create不含 initialWork；
- open发生在 second create之前；
- second create使用同 root/create token/workspace；
- retry使用相同 work token/prompt；
- changed draft不能改变已开始create的参数；
- second-call failure不进入普通 New Session；
- empty initial work只调用一次 create；
- unknown selected workspace不发 RPC。

---

# 8. G2：集中验证

**时间盒：35–55 分钟。**

## 8.1 必跑 focused checks

并行运行：

1. Remote v1/v2 parser/handler tests；
2. honest Leader v2 Root-work tests；
3. Workspace attach tests；
4. S6 fresh/cold continuation tests；
5. Client ordering/navigation tests；
6. contracts existing Leader v2 tests；
7. remote/runtime/client typecheck。

## 8.2 必跑静态检查

- grep确认 v2 initial work不构造 `targetInstanceId: inst-leader` generic follow-up；
- grep确认 product code没有给 Leader添加 lifecycle/childSessionId；
- Remote v1 snapshot/field-list保持；
- ledger category集合未变化；
- upstream checkout zero diff；
- `git diff --check`。

## 8.3 停止规则

如出现以下任一情况，停止而不是扩大实现：

- 需要新增 storage schema；
- 需要新增 ledger category；
- 需要修改冻结 DTO；
- 需要 upstream patch/private import；
- 需要重构全部 Member work chain；
- 需要完整重建 Remote dispatcher/catalog；
- 需要新增通用 Workspace/session ownership系统。

此时报告具体 blocker，由用户决定是否扩大任务。

---

# 9. M5：真实 composition smoke

**时间盒：35–50 分钟。**

严格使用：

```text
DSH source = references/deepseek-harness-test-use
DSH_HOME = references/.dsh-test
port = 3180
```

不得触碰 `:3080`、`D:\deepseek-harness\` 或其 DSH_HOME。

## 9.1 场景 A：workspace + empty work

```text
当前 workspace A
→ New Team
→ 选择 workspace B
→ Create Team
```

断言：

- 打开 minted Root；
- Root在 workspace B的 `sessionIds`；
- Root cwd是 B canonical path；
- 无额外 standard session；
- 无首轮 turn；
- 10 个 `team_*` tools可见。

## 9.2 场景 B：workspace + initial work

```text
选择 workspace B
→ Create & Send
```

断言：

- first create成功；
- Root先打开；
- second create/deferred work随后执行；
- 不出现 `TEAM_RUNTIME_WORK_STATE_REJECTED`；
- initial prompt进入 Root log；
- Leader record无 lifecycle/childSessionId；
- 10 个 `team_*` tools可见。

## 9.3 场景 C：可判定 delivery failure/retry

- 注入一次明确的 pre-accept/rejected delivery failure；
- Root保持打开；
- retry使用相同 work token；
- retry成功；
- delivered success后再次retry不重复delivery。

本时间盒不模拟 accepted-but-observation-lost的 exactly-once，因为该场景已明确为 at-least-once限制。

## 9.4 Restart smoke

只做一个最小 restart：

- Root仍属于 workspace B；
- Team projection可恢复；
- Root仍挂载 Team tools。

---

# 10. Review Gate

**时间盒：30–45 分钟。**

按仓库规则并行启动三名独立 reviewer。每人审查完整 diff，但重点分别为：

1. Leader v2 / Root work / retry；
2. Remote v1兼容 / v2参数 / client顺序；
3. Workspace attach / zero-core / real composition。

允许的结论：

```text
通过
投机通过
补充内容
阻塞
```

为了控制本修复规模：

- 只接受与两个原始用户症状、冻结契约或回归直接相关的补充；
- 一般重构、命名美化、抽象统一、性能优化记录为后续建议，不在本任务扩面；
- substantive contract问题仍必须修复并重新三盲审。

---

# 11. 文件所有权

| 区域 | Owner |
|---|---|
| Remote version/params/request/handler/ports/tests | M1 |
| Host workspace service adapter/composition/tests | M2 |
| Root strategy/live input/types/tests | M3 |
| `root.ts`、`s6-remote.ts` orchestration | 主代理 G1 |
| Client panel/model/transport/tests | M4 |
| Real composition evidence | M5 |
| graph/log/evidence index | 主代理 |

禁止两个并行代理修改同一产品文件。

---

# 12. 时间预算

| 阶段 | 并行度 | 墙钟预算 |
|---|---:|---:|
| P0 seam check/worktrees | 1 | 15–20 分钟 |
| Wave 1：M1/M2/M3 | 3 | 50–75 分钟 |
| G1 integration | 1 | 20–30 分钟 |
| M4 client flow | 1 | 35–55 分钟 |
| G2 focused integration | 多检查并行 | 35–55 分钟 |
| M5 real smoke | 1 | 35–50 分钟 |
| 三 reviewer Gate | 3 | 30–45 分钟 |
| 收尾 | 1 | 10–15 分钟 |

### 理想墙钟

```text
约 3 小时
```

### 正常墙钟

```text
约 3.5–4.5 小时
```

### 硬时间盒

```text
4.5 小时到点仍未满足完成判据：停止、保存 evidence、报告剩余 blocker；
不得自动把任务扩大成新的长期架构阶段。
```

---

# 13. 完成判据

只有以下全部成立才称为本次最小修复完成：

- [ ] Remote v1 parser/行为保持兼容；
- [ ] Remote v2支持 selected workspace和稳定 operation tokens；
- [ ] first create不投递 initial work；
- [ ] Root在 initial work admission之前已经打开；
- [ ] v2 Root work不走 generic Member follow-up；
- [ ] Leader v2仍无 lifecycle/childSessionId；
- [ ] Root work经过 Team compatibility authority和现有 team lock；
- [ ] 不新增 ledger category；
- [ ] delivered success后same-token replay不重复delivery；
- [ ] same-token different payload typed reject；
- [ ] ambiguous accept/observe窗口明确记录为 at-least-once；
- [ ] selected workspace写入 `TeamSession.defaultWorkspace`；
- [ ] Root cwd等于 Workspace canonical path；
- [ ] Root经公开 `Workspace.attachSession`进入 workspace account；
- [ ] 创建后不进入普通 New Session；
- [ ] 不产生额外 standard Agent/Session；
- [ ] empty initial work无首轮；
- [ ] initial work成功进入真实 Root；
- [ ] 原始 `work target is undefined` 错误不再出现；
- [ ] Root模型请求可见预期 10 个 `team_*` tools；
- [ ] restart smoke通过；
- [ ] upstream工作树clean；
- [ ] `:3080`未触碰；
- [ ] 三名reviewer通过。

---

# 14. 执行中的范围保护

以下建议即使合理，也一律不在本修复中实施：

- 将所有 Remote methods完整泛化为多版本框架；
- 为所有 Team work统一重写 operation journal；
- 给所有 fact payload加版本；
- 通用化所有 Root/Member activity；
- 新增 create状态页面或全局错误中心；
- 新增 Workspace管理操作；
- 修复 Remote v1 initialWork的全部历史语义；
- 解决模型 turn exactly-once；
- 重排全部 production root assembly编号；
- 清理无关旧 fixture或历史注释。

这些内容只记录为后续建议。除非它们成为本计划完成判据的直接 blocker，否则不得扩入当前任务。

---

# 15. 执行前预审查与强制修订（2026-09-05）

## 15.1 裁决

```text
CONDITIONAL GO — 原第 2–14 节方案存在 blocker，已由本节收缩修订版取代。
```

预审查确认 workspace 的 upstream public seam存在，并确认 Root delivery可以复用公开 Agent input。原方案的“两次成功 `team.create` = 一次 create continuation”缺少 durable operation状态支撑，Remote v2的真实改动面也被低估。第 15 节已改用语义明确的 v2 Root initial-work command，并删除无法持久化的 create token，因此明显 blocker已经从执行方案中排除。

执行仍以第 15.9 节 P0 的 20 分钟硬 Gate为条件：若真实 composition注入、version-aware parser、shared lock或 ledger mapping任一实证失败，立即停止，不进入产品实现。本节取代前文中与其冲突的设计和任务说明；不得自行恢复“两次 `team.create`”方案。

## 15.2 BLOCKER A：不能把第二次 `team.create` 当作未记录的 continuation

第一次调用已经返回完整 success：

```text
{ path, durable, bind }
```

且没有 durable `pending-awaiting-initial-work` 状态，也没有 v2 pending response。之后再次调用相同 method并携带 work，在协议上是对既有 Team 发起的新 command，不能仅凭 client持有相同 token宣称仍属于第一次 create。

原方案还允许 create token无法持久化时退化为 provenance。这样无法保证：

- 一个 create至多一个 creation-time initial work；
- same token/different intent mismatch；
- 网络重放与用户新操作的区分；
- cold restart后的 continuation识别。

冻结 Architecture要求 operation identity、intent、phase和reconciliation；不得用非持久 token假装满足。

**强制修订**：取消第二次 `team.create`。采用一个独立且语义准确的 v2-only Team command，暂定：

```text
team.admitInitialWork
```

它不是 ordinary Root prompt；它只允许目标 Team 尚无已成功的 creation-time initial work 时执行，并经过 Team compatibility/admission authority。

这会增加一个 Remote v2 method，但比引入 durable create pending状态、新 response union和 OperationJournal create事务更小、更清晰，也更符合冻结 UI 的两阶段顺序。

## 15.3 BLOCKER B：Remote v2 不是只改 version.ts + params.ts

当前 parser链是：

```text
parseRemoteRequest(payload) → {version, params}
parseRemoteMethodParams(method, params)
```

第二步没有 version参数；client也为全部 method统一写入 `REMOTE_CONTRACT_VERSION`。所以只把 supported versions改成 `[1,2]` 再扩大唯一 `team.create` field set，会让 v1 静默接受 v2字段。

v2必须包含完整但窄的版本路由：

- `RemoteContractVersion = 1 | 2`；
- v1/v2独立 closed field sets；
- `parseRemoteMethodParams(version, method, params)`；
- dispatcher把 request.version传入 parser/handler；
- handler/port收到正确 version-specific params；
- client默认所有既有 wrapper仍发送 v1；
- 只有 `teamCreateV2` 与 `teamAdmitInitialWorkV2`发送 v2；
- response/error provenance回显实际 request version；
- v1/v2 closed errors和backing error allowlist有测试。

因此原 M1 的文件所有权和 35–50 分钟估算过窄。

## 15.4 BLOCKER C：v1 initialWork不能被故意保留为已知坏路径

v1 `team.create.initialWork` 已是冻结输入。保持 wire兼容不等于保留确定性的 Leader lifecycle错误。

**强制修订**：v1单调用 initialWork也必须改走同一个 Root-specific strategy，不再走 generic Member follow-up。它仍然会在 RPC返回前投递，因此只作为旧 client compatibility行为；新 client必须使用 v2两阶段顺序：

```text
team.createV2(workspace)
→ open Root
→ team.admitInitialWorkV2(work)
```

这样：

- v1 fields/response保持；
- v1不再触发原始错误；
- 新 UI满足冻结 open-before-work；
- 不需要为 v1引入 workspace或新字段。

## 15.5 已排除或降级的风险

### Workspace service不是当前已证实的 CORE_SEAM_BLOCKER

Upstream web-app bundle已经包含：

```yaml
- id: workspace
  name: '@deepseek-ai/dsh-workspace'
```

其公开 service名为 `workspaceRegistry`，提供 `list()/get()`；Workspace entity提供 `attachSession()`。因此 Web profile存在公开 provider。

Team host仍须：

```ts
export const inject = ['agents', 'storageDomain', 'sessions', 'workspaceRegistry']
```

并在真实 composition证明 row可以激活。若专用测试 profile没有加载 web-app workspace row，测试 overlay应安装公开 provider row；这不是 upstream patch。只有真实 Web composition中 provider仍不可解析时才报告 `CORE_SEAM_BLOCKER`。

### Ledger storage允许新 payload，但不允许假装现有 Member scanner可复用

Storage仅要求 payload为 lossless plain record，所以 Root payload在结构上可写。但现有 Member scanner把：

```text
team-work-admitted + member-lifecycle-changed(to=SETTLED)
```

作为 work unit；不能用于 Leader。

### createRequestToken从收缩版删除

Team创建幂等身份继续使用现有：

```text
rootSessionId + durable blueprint snapshot + durable defaultWorkspace
```

本次不声称增加 durable create operation token。v2 create只负责 workspace-aware创建；Root work command自己拥有 caller-supplied stable `requestToken`。

## 15.6 收缩后的最终产品协议

### Remote v1

```text
team.create(v1, optional initialWork)
```

- 字段和response保持；
- initialWork改走 Root-specific strategy；
- 旧 client时序保持兼容；
- 不再触发 Leader lifecycle错误。

### Remote v2 methods

保留全部 v1 methods，并新增两个 v2能力：

```text
team.create v2 params:
  rootSessionId
  blueprintId
  blueprintRevision?
  workspace?

team.admitInitialWork v2 params:
  rootSessionId
  requestToken
  prompt
  attachedContext?
```

`team.admitInitialWork` 只用于 creation-time initial work，规则：

```text
无 terminal success
  → compatibility gate → admit/deliver

same token + same payload + terminal success
  → replay zero delivery

same token + different payload
  → typed mismatch

已有另一个 token 的 terminal initial work
  → typed INITIAL_WORK_ALREADY_ADMITTED
```

新 UI流程：

```text
team.create(v2, workspace)
→ materialize Root
→ Workspace.attachSession
→ return
→ client open Root
→ team.admitInitialWork(v2)
```

无 initial work时只执行 create。

## 15.7 Root work durable表示

为避免在一个 `team-work-admitted` fact中用多个 phase伪装三条事实，收缩版使用两个 factType，但不新增 ledger category：

```text
team-work-admitted
team-root-work-delivered
```

二者均映射到已有 `team` category。Root admission fact payload：

```text
targetKind=root
rootSessionId
requestToken
payloadFingerprint
prompt
attachedContext?
caller
at
```

Terminal fact payload：

```text
targetKind=root
rootSessionId
requestToken
payloadFingerprint
workOutcome=delivered
at
```

Delivery rejection不写 terminal fact；same-token retry从 admission fact恢复。若 followup已接受但结果观察失败，仍是已披露的 at-least-once模糊窗口。

引入 `team-root-work-delivered` 必须同步：

- projection-source映射到既有 `team` category；
- client ledger adapter映射到 `team`；
- generic UI可安全显示；
- Root scanner只识别 `targetKind=root`；
- projection/disposed-history不得把 Root fact误归属于普通 Member。

不新增 DTO字段、ledger category或storage schema。

## 15.8 Root strategy的精确 ownership

新增一个窄内部模块，例如：

```text
packages/runtime/action-router/root-initial-work.ts
```

它拥有：

- Root token/payload scan；
- mismatch和already-admitted判断；
- admission/terminal fact append；
- `deliverRootWork`调用；
- retry/replay outcome。

Production root构造一个闭包：

```ts
admitRootInitialWork(input)
```

闭包内部使用现有 `coordination.chains`：

```text
withTeamLock
  → enforceCompatibilityGate
  → executeRootInitialWorkLocked
```

它不调用 `executeWorkChain`，不使用 Member lifecycle/activity，也不新增第二个公开 TeamRuntime facade。S6 Remote只调用这个闭包。

## 15.9 修订后的任务和时间盒

### P0 — 20分钟硬 Gate

必须实证：

1. Web composition中的 `workspaceRegistry`可注入；
2. v1/v2 version-aware parser最小设计可以编译；
3. `team-root-work-delivered`可映射到已有 `team` category；
4. production root可以在同一 `coordination.chains`闭包中调用 compatibility gate；
5. v1 initialWork和v2 command都可调用同一 Root strategy。

任一失败即停止，不进入实现。

### Wave 1 — 60–80分钟，三并行任务

- **M1 Remote v2 + new method**：version-aware parser/dispatcher、v1/v2独立字段、`team.admitInitialWork` handler/port、closed errors、client versioned transport types；
- **M2 Workspace attach**：hard inject `workspaceRegistry`、path resolution、materialize后attach、focused composition test；
- **M3 Root strategy**：shared lock + compatibility、两fact scanner、Root live adapter、v1/v2共用入口。

### G1 — 25–35分钟

集成 `root.ts`、`s6-remote.ts`；证明 v1 initialWork repaired、v2 create只创建、v2 initial-work command只work。

### M4 Client — 35–50分钟

只让新创建流程使用 v2：

```text
create v2 → open → admitInitialWork v2
```

其余 wrapper仍使用 v1。

### G2 + real smoke — 50–70分钟

Focused tests、typecheck、build和三个核心real scenarios；restart smoke仅在时间允许时执行，若未执行不得声称restart覆盖。

### Review Gate — 30–40分钟

三独立 reviewer。4.5小时硬停止不变。

修订后的预估：

```text
理想 3.5小时
正常 4–4.5小时
```

超过时间盒不扩面，保存candidate和blocker evidence。

## 15.10 修订后的硬停止条件

除原第 8.3 节外，增加：

- version-aware parser迫使非 `team.create` method改变v1 behavior；
- `team.admitInitialWork`需要新的 storage record/schema；
- Root strategy无法复用 production coordination chain；
- compatibility gate只能通过伪造 Member target调用；
- `workspaceRegistry`在真实 Web composition中不可注入；
- 新 factType迫使增加 ledger category或修改冻结 projection DTO；
- v1 initialWork无法在不改 wire contract的情况下调用 Root strategy。

命中任一项：停止并报告，不尝试一般化重构。

## 15.11 修订后的完成判据差异

前文完成判据作如下替换：

- 删除 `createRequestToken`要求；
- 删除“第二次 team.create”；
- 新增 `team.admitInitialWork v2`；
- v1 initialWork必须不再报 Leader lifecycle错误；
- client仅对两个创建相关调用使用v2，其余方法仍为v1；
- Remote response/error provenance必须正确回显1或2；
- `team-root-work-delivered`必须映射到现有 `team` category；
- restart smoke从硬完成判据降为时间盒内的高优先级验证，不得虚报。
