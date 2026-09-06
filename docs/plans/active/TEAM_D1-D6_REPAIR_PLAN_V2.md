# Team D1–D6 修复计划 v2：插件-owned Team 模式与最小结果闭环

**版本**：v2（基于 2026-09-07 D1–D6 执行结果及用户确认）  
**状态**：待执行；决策基线已由用户确认  
**目标仓库**：`dsh-agent-team`  
**实现模型**：`qiyuan-self/qwen3.8-27b`  
**时间边界**：沿用用户授权的 10h；每个阶段完成后必须写入本文件确切完成时间。  
**核心约束**：`CORE PATCH BUDGET = 0`；不修改 upstream、不使用 upstream private API、不触碰稳定 `:3080`。

---

## 1. 已确认的产品决策

### 1.1 D6 的用户可观察语义

D6 不再要求“普通会话列表任意打开时自动识别 Team 并注入 Team setup”。该路径由 upstream SessionController 直接控制，当前没有 downstream public interception seam，继续要求它会再次触发 `CORE_SEAM_BLOCKER`。

本计划改为：

1. Team UI 的 Team root 行提供明确的 **“以 Team 模式打开 / 回到 Leader”** 入口；
2. 该入口由 Team 插件确保 root ownership、Team glue、Leader Agent setup 和十个 `team_*` 工具注册；
3. Team UI 同时提供 **“以普通模式打开”** 的显式降级入口；
4. 普通会话列表默认仍是普通模式，不承诺 `team_*` 工具；
5. UI 必须明确显示当前打开方式，避免用户误以为普通模式具备 Team 工具。

这不是降低 D6 的真实使用目标，而是把自动识别责任从 upstream 隐式推断改成插件显式入口，避免修改 upstream。

### 1.2 Team ownership/index

采用插件-owned 的轻量 ownership/index 查询层，但**不新增第二份独立 JSON 状态源**：

- 复用现有 TeamDomain 的 `teamSessions` 与 `sessionBindings`；
- 从 durable TeamDomain 重建 `rootSessionId → Team root metadata` 查询；
- 不复制 transcript，不维护与 TeamDomain 并行的完整 session registry；
- 所有打开前检查均以 TeamDomain/Remote 当前事实为准；
- 若现有 schema 无法表达入口所需的最小信息，必须先提交 `CONTRACT_CHANGE_REQUEST`，不能隐式扩 schema 或双写。

### 1.3 D2 结果语义

采用最小 Team-owned structured result：

```ts
{
  requestToken: string,
  status: 'succeeded' | 'failed' | 'unavailable',
  body?: string,
  error?: { code: string, message: string }
}
```

它解决的用户问题是：Leader 发起 delegate/follow-up 后，不能只看到 `settled=true`，而应看到成员业务正文或明确失败。`settled` 仍只表示控制面生命周期结算，不等于业务成功。

本轮不做：完整 transcript、通用 inbox、远程订阅、消息平台、复杂聚合、取消/超时高级协议。取消/超时/重复 token 必须保持明确失败或 unavailable，不能伪装成功。

### 1.4 D4 分层

- **D4-A1（本计划）**：闭合已经存在的 Team UI mutation callback → `pullProjection()`，保证 UI 自己发起的 mutation 无需 F5 即更新；不宣称覆盖 Agent/tool mutation。
- **D4-A2（后续设计任务）**：单独设计 Agent/tool/host mutation 的跨层 invalidation signal；在未冻结 signal、owner、版本和测试前不得实现。

---

## 2. 当前基线和已知事实

| 项目 | 当前事实 |
|---|---|
| D1 | Team member setup 注册 Team tools，但未组合普通 preset/base file/shell tools；C0 已确认公开 `AgentSetup`/preset mount seam，但需要 host-owned adapter/dependency wiring |
| D2 | `WorkDeliveryPort.deliver()` 是 `Promise<void>`；成员 body/status 未回 Leader；C2 判定需要 Team-owned contract change |
| D3 | owning root、instanceId 在 setup 可得；member persona branch 缺少 machine-readable Team identity block；上轮两次实现因独立 worktree 缺 `yaml` 未进入 collection |
| D4 | projection store 是 generation-safe pull；现有 UI callback 可 pull，但 Agent/tool mutation 没有统一 invalidation seam |
| D5 | provider-owned deterministic instanceId 已满足契约；同 token 收敛、不同 token 并行、`inst-leader` 保留 |
| D6 | TeamDomain 可枚举动态 root；普通 Web reopen 没有 downstream Team setup interception public seam；旧任务已形成 `CORE_SEAM_BLOCKER` |
| upstream | test-use SHA `76fda729799fe9b3848dbe2c211d4b231032b81e`，必须 pristine |
| runtime test | source `references/deepseek-harness-test-use`、DSH_HOME `references/.dsh-test`、port `3180` |

旧执行证据：

- [`docs/plans/active/TEAM_D1-D6_REPAIR_PLAN.md`](TEAM_D1-D6_REPAIR_PLAN.md)
- [`dev/agent-workflow/evidence/team-d1-d6-repair/T6-d6/core-seam-blocker.md`](../../dev/agent-workflow/evidence/team-d1-d6-repair/T6-d6/core-seam-blocker.md)

---

## 3. 统一执行协议

每个任务必须：

1. 第一读取 `docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 只读取自己的 context pack；
3. `1 task = 1 branch = 1 worktree = 1 writer`；
4. 使用 `qiyuan-self/qwen3.8-27b`；
5. 先写行为测试，再写最小实现；
6. 每个任务最多 3 次执行；
7. 只修改 task owned zone；
8. 生成 `TaskResult`：task、attempt、elapsed、base/head、changed files、tests、evidence、verdict、blocker、remaining risks；
9. 发现 upstream/private seam、冻结契约冲突或需要扩大 schema 时立即停止并按 blocker 类型记录；
10. 阶段结束后主 Agent 将确切时间写回本文件与 `SESSION_ROUTER_LOG.md`。

所有 host/browser 验证只能使用：

```text
source: references/deepseek-harness-test-use
home:   references/.dsh-test
port:   3180
```

稳定 `:3080`、`D:\deepseek-harness` 绝不触碰。测试后必须确认 test-use checkout byte-clean。

---

## 4. 新 DAG 总览

```text
P0 基线复核
  │
  ├── Wave A（并行 characterization）
  │     ├── A1 D1 ordinary setup adapter seam
  │     ├── A2 D3 member prompt + dependency setup
  │     ├── A3 D6 Team UI open/ordinary fallback seam
  │     └── A4 D2 result contract insertion seam
  │
  ├── G1 scope and contract gate
  │
  ├── Wave B（可并行的窄实现）
  │     ├── B1 D1 member base tools
  │     ├── B2 D3 member identity context
  │     ├── B3 D4-A1 existing UI callback invalidation
  │     └── B4 D5 regression/contract confirmation
  │
  ├── G2 member setup gate
  │
  ├── Wave C（共享 contract owner 串行）
  │     ├── C1 D2 structured result contract
  │     └── C2 D2 glue/effect integration
  │
  ├── G3 result + projection integration gate
  │
  ├── Wave D（D6 插件-owned Team mode）
  │     ├── D1 durable ownership/index query
  │     ├── D2 Team-mode open/resume command
  │     ├── D3 explicit ordinary-mode fallback UI
  │     └── D4 restart/reopen Team UI acceptance
  │
  ├── G4 restart and mode-switch gate
  │
  ├── E1 D4-A2 design-only invalidation proposal
  │
  └── G5 final Team-mode acceptance + 3-agent blind review
```

### DAG 约束

- A1–A4 只调查，不修改产品代码；
- G1 后才允许 Wave B；
- B1/B2 可能共同触及 `agent-bindings.mjs`，由主 Agent 机械解决 cherry-pick，不允许两个 worker 共写同一 worktree；
- D2 shared result contract 必须由单一 contract owner 修改；
- D6 的 D1–D4 只保证 Team UI 专用入口，不再声称普通 session list 自动注入；
- A2/B2 若依赖安装仍失败，不得把未运行测试标为 PASS；应优先在独立 worktree 执行 `pnpm install --ignore-scripts`，并记录安装时间与结果；
- 任何 Gate-level blocker 停止后续 Gate，不跨 Gate workaround。

---

## 5. P0：基线复核与时间预算

**owner**：主 Agent 机械准备  
**目标时间**：20 分钟  
**owned write zone**：`dev/agent-workflow/evidence/team-d1-d6-repair/P0-v2/`、本计划时间表、执行日志

### 必做

1. 读取当前 `git status`、HEAD、origin、test-use SHA/status；
2. 创建本版本 evidence 目录：`P0-v2/A1..A4/B1..B4/C1..C2/D1..D4/G*`；
3. 建立 `int/team-d1-d6-v2` 和 task worktree 清单；
4. 记录用户决策：D6 Team UI 专用入口、TeamDomain-owned index、D2 minimal result、D4 分层；
5. 固定本轮 acceptance matrix 和不宣称项。

### 出口

- upstream/test-use pristine；
- stable `:3080` 未触碰；
- 任务图、锁和 evidence 路径已落盘。

**完成时间**：`待执行填写：YYYY-MM-DDThh:mm:ss+08:00`  

---

## 6. Wave A：characterization tasks

### A1：D1 ordinary setup adapter seam

**单一上下文**：普通 `composeAgent` → `AgentSetup` → preset mount → member child setup。  
**只读范围**：C0 evidence、`agent-bindings.mjs` setup、upstream public AgentSetup/preset mount、host deps wiring。  
**禁止**：扫描 D2/D4/D6、修改产品代码。  
**输出**：精确 adapter 输入/输出、最小 owned files、依赖安装方式、是否能在 Team child path调用。  
**出口**：`public_composition_seam = yes/no/unknown`。  
**完成时间**：`待执行填写`

### A2：D3 prompt + dependency seam

**单一上下文**：`installPersonaForSetup` → `getPersonaSlot` → member scoped prompt。  
**只读范围**：C1 evidence、`agent-bindings.mjs` persona 函数、D3 focused tests、package dependency lock。  
**必做**：在独立 worktree 执行/验证 `pnpm install --ignore-scripts`，确认 `yaml` 可被测试解析。  
**输出**：可执行的 red test 命令和最小 context block fixture。  
**完成时间**：`待执行填写`

### A3：D6 Team UI mode-open seam

**单一上下文**：Team root projection row → Team UI command → plugin open/session route → Team glue `createRootAgent`/`ensureLiveAgent`。  
**只读范围**：D6 diagnosis、`team-mount-core.ts`、Team root/member UI commands、remote client existing methods、runtime live facade open methods。  
**必做**：确认 Team UI 是否已有 `openSession`/`openCreatedSession` 或可复用 callback；确认“以 Team 模式打开”能否调用 Team-owned facade，而不是普通 session list resume。  
**禁止**：新增 remote method、upstream patch、独立 JSON index。  
**输出**：Team-mode open command seam；普通模式 fallback seam；若缺失则 `CONTRACT_CHANGE_REQUEST`。  
**完成时间**：`待执行填写`

### A4：D2 result insertion seam

**单一上下文**：member completion → `WorkDeliveryPort` → `runWorkAdmission` → `RuntimeActionEffect` → Leader-visible result。  
**只读范围**：C2 evidence、`admission/types.ts`、`work-execution.ts`、`effects.ts`、live glue、existing work tests。  
**必做**：确认 minimal structured result 是否只需 Team-owned contract/effect changes；列出 failure/cancel/timeout/replay semantics。  
**禁止**：remote/storage schema、完整 transcript、通用 messaging。  
**输出**：contract delta 与 single-writer owner。  
**完成时间**：`待执行填写`

---

## 7. G1：范围与契约闸

**出口条件**：

- D1 adapter seam 明确；
- D3 dependency 可复现或有明确 `TEST_INFRA_BLOCKER`；
- D6 Team UI 专用打开路径不依赖普通 reopen interception；
- D2 contract delta 不需要 storage/remote 扩张；
- D4-A1 仅复用现有 UI callback；
- D5 保持 provider-owned deterministic ID。

**分流规则**：

| 任务 | 进入条件 | 不满足时 |
|---|---|---|
| B1 D1 | A1 yes | `CORE_SEAM_BLOCKER` 或 deferred |
| B2 D3 | A2 identity seam yes 且测试依赖可安装 | 最多修复依赖；仍失败则 `TEST_INFRA_BLOCKER` |
| B3 D4-A1 | A3/现有 UI callback yes | 只保留设计 evidence |
| C1/C2 D2 | A4 contract 仅 Team-owned | `CONTRACT_CHANGE_REQUEST`，暂停实现 |
| D1–D4 D6 | A3 Team-owned open seam yes | 若需要普通 reopen interception，立即拆回 blocker |

**完成时间**：`待执行填写`

---

## 8. Wave B：第一批最小实现

### B1：D1 member base tools

**目标**：member 同时具备 ordinary base file/shell tools 与十个 Team tools。  
**owned zone**：`agent-bindings.mjs`、A1 指定 Team adapter、D1 focused tests。  
**必须验证**：受控文件读取、受控 pwd/shell、Team tool 存在、重复 setup/disposal、普通 session 工具表不变。  
**停止条件**：需复制 upstream catalog、需改 upstream、需修改普通 session controller、70 分钟无最小 proof。  
**完成时间**：`待执行填写`

### B2：D3 member identity context

**目标 context block**：

```text
[team-member-context rootSessionId="<root>" instanceId="<instance>" role="member"]
Every team_* tool call must include rootSessionId="<root>" and a fresh unique requestToken; do not use another team's rootSessionId or another member's instanceId.
```

**owned zone**：`agent-bindings.mjs` member prompt branch及对应 focused tests。  
**必须验证**：fresh create、cold resume、cross-root、wrong root fail closed、repeated setup 无重复 section。  
**停止条件**：身份不能从 setup durable row/hint取得；需要 global registry。  
**完成时间**：`待执行填写`

### B3：D4-A1 existing UI callback pull

**目标**：现有 Team UI mutation 成功后统一调用已有 `pullProjection(teamSessionId)`，不新增 push/remote/event/polling。  
**owned zone**：`team-mount-core.ts`、现有 UI command callback、client focused tests。  
**必须验证**：create/lifecycle/policy/override 至少代表路径；无 F5更新；single-flight/stale guard 不回退。  
**边界**：Agent/tool mutation 仍标记 NOT COVERED；不把 A1 结果描述为全链路实时。  
**完成时间**：`待执行填写`

### B4：D5 regression confirmation

**目标**：保留并扩充 deterministic instance contract tests，不改 allocation algorithm。  
**必须验证**：5/5 最小断言；custom field 不进入合法 schema；同 token replay、不同 token并行、`inst-leader`。  
**完成时间**：`待执行填写`

---

## 9. G2：成员 setup 闸

**并行 focused checks**：

1. B1 member base tools；
2. B2 fresh/cold member context；
3. B4 deterministic allocation；
4. Team-owned typecheck；
5. `git diff --check`；
6. 若修改 shared setup，增加一个普通会话最小 smoke。

**通过条件**：B1/B2 无 blocker；D3 prompt block 真实进入 agent-scoped prompt；普通会话无意外变化；upstream pristine。  
**失败处理**：不得进入 D2/D6；先补充或按协议阻塞。  
**完成时间**：`待执行填写`

---

## 10. Wave C：D2 最小结果闭环

### C1：structured result contract（唯一 contract writer）

**目标**：扩展 Team-owned `WorkDeliveryPort` 与 `WorkChainResult` 的最小结构化结果，不建立 durable transcript。  
**候选 owned files**：`packages/runtime/admission/types.ts`、`packages/runtime/action-router/work-execution.ts`、对应 tests。  
**契约要求**：

- `requestToken` 必须原样相关联；
- `status=succeeded` 只有成员真实完成且有可用业务 body 时才能返回；
- `status=failed` 用于显式 delivery/turn failure；
- `status=unavailable` 用于没有可读 body/status 的情况；
- `settled=true` 不得单独映射为 succeeded；
- replay 不重复 delivery、不重复业务报告；
- cancel/timeout 保持明确失败/unavailable，不伪装成功。

**禁止**：新增 storage schema、ledger category、remote subscription、完整 transcript。  
**完成时间**：`待执行填写`

### C2：glue/effect integration

**目标**：在现有 live glue 与 `effects.ts` 中读取并传播 C1 结果，形成 Leader-facing action result。  
**候选 owned files**：`agent-bindings.mjs`、`effects.ts`、对应 focused tests。  
**必须验证**：delegate success、follow-up success、failure、requestToken mismatch、duplicate/replay、unavailable。  
**唯一 writer**：C1 contract owner负责 shared DTO；C2 只能消费冻结后的接口。  
**完成时间**：`待执行填写`

---

## 11. G3：结果与 projection 集成闸

**必须通过**：

- D2 success body 到 Leader；
- D2 failure/unavailable 明确可见；
- `settled` 与业务 status 分离；
- D4-A1 UI mutation 无刷新更新；
- D4-A2 Agent/tool mutation 明确标记未覆盖；
- D1/D3 member setup 不回归；
- Team-owned typecheck、focused test、`git diff --check`。

**完成时间**：`待执行填写`

---

## 12. Wave D：D6 Team UI 专用模式与重启

### D1：durable ownership/index query

**目标**：从 TeamDomain `teamSessions` + `sessionBindings` 重建可查询的 Team root ownership，不新增独立 JSON。  
**必须验证**：

- 固定 root；
- 动态 root；
- 多 root；
- root/member 归属；
- 缺失/损坏 binding fail closed；
- 重启后相同 durable rows 重建相同 index。

**停止条件**：必须新增第二状态源或修改冻结 schema。  
**完成时间**：`待执行填写`

### D2：Team-mode open/resume command

**目标**：Team UI 的 “以 Team 模式打开 / 回到 Leader” 不调用普通 session-list resume，而调用 Team-owned open path：

1. 查询并校验 Team root ownership；
2. 确保 Team glue live binding；
3. 对已有 durable root 使用 Team-owned `ensureLiveAgent`/等价公开 Team facade；
4. 保证 setup 注册十个 Team tools；
5. 打开该 session；
6. 返回当前模式和 root identity供 UI显示。

**禁止**：伪造普通 session controller 已自动识别；不能只靠手动重建；不能使用 private API。  
**完成时间**：`待执行填写`

### D3：explicit ordinary-mode fallback

**目标**：提供“以普通模式打开”入口，明确这是普通 Agent setup，不保证 `team_*`。  
**必须验证**：Team mode 与 ordinary mode 的入口、状态和工具表语义不混淆；切换不修改 TeamDomain ownership；重复切换幂等。  
**完成时间**：`待执行填写`

### D4：restart/reopen Team UI acceptance

**真实场景**：

1. Team UI 创建或准备动态 Team root；
2. 确认 root/member durable rows 与 native session artifact；
3. 停止测试 host；
4. 使用相同 `references/.dsh-test` 重启；
5. 从 Team UI root row 选择“以 Team 模式打开”；
6. 验证 root history、Leader prompt、十个 Team tools、Team tool call；
7. 选择“以普通模式打开”，验证明确 ordinary mode 语义；
8. 再切回 Team mode，验证 Team setup重新接管且无重复注册。

**不测试/不宣称**：从普通 session list 直接打开自动获得 Team tools。该路径在验收报告中列为明确边界。  
**完成时间**：`待执行填写`

---

## 13. G4：restart 与模式切换闸

**出口判据**：

1. 动态 Team root 可由 Team UI ownership/index 找到；
2. 重启后 Team UI 专用入口可恢复 root；
3. Team mode 注册完整十个 Team tools；
4. ordinary mode 明确不承诺 Team tools；
5. Team ↔ ordinary 切换不产生双重 Team registration；
6. TeamDomain durable rows 不丢失、不双写；
7. `:3080` 未触碰，test-use pristine。

若任一审查者要求普通 session-list auto interception，则该要求与用户已确认的 v2 语义不一致，必须记录 `SPEC_CONFLICT`，不得暗中扩大计划。

**完成时间**：`待执行填写`

---

## 14. E1：D4-A2 设计-only 后续项

本计划只产出 design/evidence，不实现：

- mutation signal owner；
- host/runtime → remote/client invalidation wire；
- generation advancement semantics；
- reconnect/duplicate/out-of-order handling；
- compatibility/versioning；
- Agent/tool mutation focused test matrix。

如果 A3 或 G3 证明已有 public callback 可覆盖 Agent/tool mutation，才可另开 task；本计划禁止新增隐式 push/event/polling。

**完成时间**：`待执行填写`

---

## 15. G5：最终 Team-mode 验收与独立审查

### 15.1 验收矩阵

| 场景 | 必测断言 |
|---|---|
| D1 member tools | file read、pwd/shell、Team tool、普通会话不回归 |
| D3 identity | fresh/cold/cross-root rootSessionId、instanceId、role、requestToken规则 |
| D2 result | success body、failure、unavailable、replay、token correlation、settled分离 |
| D4-A1 | UI mutation无F5更新；stale/single-flight保持 |
| D5 | deterministic allocation 5/5 |
| D6 Team mode | 动态 root 重启后 Team UI入口恢复、十工具注册、真实 Team tool call |
| D6 ordinary mode | 显式普通入口可用，且不错误声称 Team tools |
| negative | wrong root、missing token、unknown root、普通列表入口边界均 fail/明确提示 |

### 15.2 审查规则

- G2、G3、G4、G5 按 `ROUTER_RULES.md` 做独立审查；
- 每个 Gate 3 个全新独立 reviewer；
- reviewer 不读本执行日志和前轮 reviewer 意见；
- 任一 `阻塞` 停止；`补充内容` 后重审整个 Gate；
- `投机通过` 写入风险台账；
- 审查必须实际运行关键 focused tests / restart smoke，不接受仅看 worker prose。

**完成时间**：`待执行填写`

---

## 16. 风险与明确不承诺项

| 风险/边界 | 处理 |
|---|---|
| D1 公开 setup seam 仍需 host dependency wiring | A1/G1 先证明 wiring；无法在 Team-owned 侧完成则 `CORE_SEAM_BLOCKER` |
| 独立 worktree 缺 `yaml` | 每个相关 worktree先 `pnpm install --ignore-scripts`；仍失败记 `TEST_INFRA_BLOCKER`，不误判 PASS |
| D2 contract 变更影响 shared surfaces | 单 writer；contract freeze后才让 glue/effect消费 |
| D4 Agent/tool mutation 无 signal | 明确列为 D4-A2；不伪装实时 |
| D6 普通 session list 自动识别 | v2 明确不承诺；Team UI 专用入口是保证路径 |
| TeamDomain schema 无法表达 ownership | `CONTRACT_CHANGE_REQUEST`，不新增第二 JSON状态源 |
| 普通模式工具表差异 | UI必须显示模式；验收区分 Team mode/ordinary mode |
| 测试环境 matcher/fixture污染 | evidence记录基础设施失败；focused fixture必须隔离并可重复 |

---

## 17. 阶段时间记录表（强制回写）

| 阶段 | 计划上限 | 完成时间 | 结果 | 证据 |
|---|---:|---|---|---|
| P0-v2 | 20m | 待执行 | — | `evidence/team-d1-d6-repair/P0-v2/` |
| A1–A4 | 60m墙钟 | 待执行 | — | `evidence/team-d1-d6-repair/A*/` |
| G1 | 20m | 待执行 | — | `SESSION_ROUTER_LOG.md` |
| B1–B4 | 120m累计/并行 | 待执行 | — | `evidence/team-d1-d6-repair/B*/` |
| G2 | 30m | 待执行 | — | `evidence/team-d1-d6-repair/G2/` |
| C1–C2 D2 | 150m累计/contract串行 | 待执行 | — | `evidence/team-d1-d6-repair/C*/` |
| G3 | 40m | 待执行 | — | `evidence/team-d1-d6-repair/G3/` |
| D1–D4 D6 Team UI | 180m累计 | 待执行 | — | `evidence/team-d1-d6-repair/D*/` |
| G4 | 45m | 待执行 | — | `evidence/team-d1-d6-repair/G4/` |
| E1 D4-A2 design | 30m | 待执行 | — | `evidence/team-d1-d6-repair/E1/` |
| G5 final | 90m | 待执行 | — | `evidence/team-d1-d6-repair/G5/` |

> 这里的累计 worker 时间不是墙钟保证。若 10h 内无法同时满足实现、测试和三方审查，必须在 Gate 报告中明确 PASS/DEFERRED/BLOCKED，不得降低语义标准。

---

## 18. 当前状态

本计划已经完成决策澄清，尚未开始 v2 执行。下一步应从 P0-v2 开始，不得直接跳到 D6 实现。

**计划确认时间**：`2026-09-07T00:48:34.9956605+08:00`  
**计划最后更新时间**：`2026-09-07T00:48:34.9956605+08:00`
