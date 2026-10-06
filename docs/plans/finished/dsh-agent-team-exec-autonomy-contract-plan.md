# dsh-agent-team — exec 类工具自治契约变更（exec-autonomy-contract）

> 用户指令轮（2026-09-18）。用户裁决：允许 exec 类工具（`bash` / `pwsh`）放入 **leader 的 allow lane** 与 **mutation envelope**；双闸强制；member 侧 exec 的 ask 由 leader 批准（核实为既有行为，不改路由）。
> 本计划**不引入隐式默认 allow**：蓝图中未声明 exec 规则时，解析仍落回 `policy.default`（`ask`/`deny`，行为不变）。

---

## 0. 基线

- 插件仓库：`ArmourPiercer1/dsh-agent-team`
- 基线提交：`040f410`（master = PR #18 merge，含 rc2-repair 全部收束）
- 分支：`task/exec-autonomy-contract`；worktree：`.worktrees/exec-contract`；单写者 = 本会话主 Agent
- 测试宿主：`tests/deepseek-harness-test-use` @ `fb2c4b9e69`（0.1.5-rc.2，与 rc2 轮同基线）
- full suite 基线（PR #18 收束轮实测 @ 同内容）：**20 failed | 3561 passed (3581)** = 既有 10 文件失败集（domain t1/t2、legacy p7t6、d3 D3-4、p6t3-mediation ×5、p6t3-restart ×2、p8s3b/t12a-b2/t12a-glue 3 load-failure、tools p6t6-actions）
- 模型路由核验：本会话 = `qiyuan-self/qwen3.8-27b`（会话默认 provider/model），满足 ROUTER_RULES §1

## 1. 用户裁决（逐字 + 澄清记录）

1. **原始指令**："请你修改契约，允许exec类工具（bash, pwsh）放入leader的allow与mutation envelop"。
2. **envelope 语义**（问答确认）：**双闸强制** — leader 的 exec 自动放行需同时满足：permission policy allow lane 有规则 + leader 有效 mutation envelope 含对应 token；缺一即回落 `ask → user-approval`（human）。
3. **角色范围**（用户自定义答复，逐字）："1. leader可以放宽到默认allow, 2. member放宽到可以由leader批准，不必直接交给用户" — 经追问澄清，第 1 点**不是隐式默认 allow**："不是'默认allow'，是允许用户在配置蓝图时将exec类加入allow范畴；在蓝图中没有标明时仍落回默认"。即 = **leader 模板的 allow lane 可承载 exec 类规则**（显式声明制）。
4. **member 侧**（第 2 点）：核实 `CONTROL_RESOLVER_ROLES['leader-approval'] = ['leader', 'human']`（`packages/runtime/control/types.ts:119`，"the leader decides; the human may always stand in"）+ pre-execute 路由（plan §9.5：member ask → `leader-approval`）— **既有行为已满足"由 leader 批准，不必直接交给用户"**；本轮不改路由，仅验证 + 测试 pin + 文档记录。

## 2. 契约规格（变更后的完整语义）

### 2.1 leader 模板 permission policy（allow lane 放宽，A2C-1 的 leader-scoped 例外）

| 工具类 | resource | allow lane | ask lane | deny lane |
|---|---|---|---|---|
| 文件类（read/read_image/write/edit/lsp） | exact/subtree/any | ✅（不变） | ✅（不变） | ✅（不变） |
| **exec 类（bash/pwsh）— LEADER 模板** | **`any`** | **✅（新增）** | ✅（不变） | ✅（不变） |
| exec 类 — **MEMBER 模板** | `any` | ❌（A2C-1 不变，诊断文本逐字保留） | ✅（不变） | ✅（不变） |
| exec 类 — 任何角色 | exact / subtree | ❌ 全 lane 拒绝（不变：无参数级 shell 匹配器） | ❌ | ❌ |

- 无隐式默认 allow：无显式 exec 规则 → `policy.default`（`ask`/`deny`；`PERMISSION_POLICY_DEFAULTS` 不变，`allow` 仍非法 default）。
- `bash authority != pwsh authority` 不变：规则/审批/审批 token 各自独立。
- `default` 字段、`subtree` 契约（A2C-7，文件类）、Coverage Gate（A2C-2）：不变。

### 2.2 mutation envelope（exec 授权位 + 双闸强制）

- **词汇地位**：`'bash'` / `'pwsh'` 成为 envelope 操作词汇中被识别的 **exec 授权 token**（闭集常量 `ENVELOPE_EXEC_OPS = ['bash','pwsh']`；与团队治理操作闭集 `ALL_MUTATION_OPS` 分列 — 前者 gate 工具调用自治，后者 gate 团队治理动作）。blueprint 解析层不变（envelope token 本就是开放小写 slug，`bash`/`pwsh` 今日已可解析；本轮赋予运行时地位 + 文档）。
- **leader 有效 exec envelope**（fail-closed 公式，与 `callerEnvelope` 的 leader 分支同式）：
  `teamEnvelope.allow − teamEnvelope.deny`，若 blueprint 携带 leader 模板的 `memberEnvelopes` 条目则再 ∩（该条目 `allow − deny`）；∩ `ENVELOPE_EXEC_OPS`。
  `teamEnvelope` 缺省 = 空集。
- **双闸强制点**（pre-execute 适配器，listener 阶段，A3 静态决策之后）：
  `isLeader && tool ∈ {bash,pwsh} && decision == allow` 时，要求对应 token ∈ 安装时计算的 leader 有效 exec envelope；**缺失 → 降级走 ask 路径**（`requestControl` kind = `user-approval`，human-only 解析闭包；零副作用，不标记 authorized，tool body 不运行）。
  - ALLOW 的来源在本契约下只可能是 allow lane 规则（无隐式默认 allow），故双闸覆盖全部契约路径。
  - member 安装不触发双闸（member exec 契约上不可 allow；其 ask 路由 `leader-approval` 不变）。
  - 手工构造的 member exec allow（非契约路径）行为与现状一致（matcher 无 lane 特例）— 文档明示非契约路径。
- **不变式保持**：deny > ask > allow > default 优先级（显式 deny 规则永远胜过双闸放行）；A2C-4 外部硬事实最后一里不变（双闸在 external recheck 之前，降级后的 ask 路径照常走 control 平面）；`envelope` 对 human 不封顶（invariant 34 不变）；invariant 36/37（leader/member 不越 envelope）语义扩展至 exec 工具调用。

### 2.3 member 模板（不变 + 验证）

- 静态契约不变（§2.1 表）。
- ask 路由验证 pin：member exec ask → `leader-approval` → 解析闭包 `{leader, human}`（leader 决定，human 可 stand-in）— 本轮以测试固化。

## 3. 实现设计（文件级）

| # | 文件 | 改动 |
|---|---|---|
| I1 | `packages/domain/blueprint/src/validate.ts` | 角色上下文穿透：`validateBlueprintDocument`（leader 调用点传 `role:'leader'`；member 循环传 `'member'`）→ `validateTemplate` → `validateTemplateCapabilities` → `validatePermissionPolicy` → `validatePermissionRule`。shell+`any`+allow lane 的拒绝条件增加 `&& role !== 'leader'`；**member 诊断文本逐字不变**（H2/A2C-1 pin 原样）。exact/subtree 拒绝不加角色条件。 |
| I2 | `packages/domain/blueprint/src/schema.ts` + `types.ts` | 契约文档注释更新（`PERMISSION_TOOL_NAMES` / `PermissionTool` / `PermissionResource` doc：leader-scoped allow lane 例外 + 双闸指针 + 用户裁决日期）。 |
| I3 | `packages/runtime/admission/envelope.ts` | 新增 `ENVELOPE_EXEC_OPS: readonly string[] = ['bash','pwsh']`（doc：exec 授权 token 闭集，与 `ALL_MUTATION_OPS` 治理操作闭集分列的理由）+ `leaderExecEnvelopeOps(blueprint): readonly string[]`（提取 `callerEnvelope` leader 分支的 envelope 公式为共享内部函数复用，∩ `ENVELOPE_EXEC_OPS`；fail-closed）。`callerEnvelope` 行为不变（既有测试守门）。从 `admission/index.ts` 导出。 |
| I4 | `packages/runtime/operation-permission/pre-execute-adapter.ts` | 安装选项新增 `readonly execEnvelopeOps?: readonly string[]`（doc：leader-only 双闸，缺省 = 无 exec 授权 = fail-closed 降级）。allow 分支首部：`isLeader && tool ∈ SHELL_PERMISSION_TOOL_VALUES && !(execEnvelopeOps ?? []).includes(tool)` → `observe({stage:'exec-envelope-downgrade',...})` + 落入 ask 路径（复用既有 request/wait/guard 流程，kind 按 `isLeader` 已定 = `user-approval`）。 |
| I5 | `packages/runtime/src/plugin/live/agent-bindings.mjs`（+ `dist/` 镜像） | 安装点（`installParameterPermissionListener` 调用处）：`isLeader` 时计算 `execEnvelopeOps = leaderExecEnvelopeOps(getBoundBlueprint(teamRoot))`（blueprint 不可用 = 空集，fail-closed），member 不传。doc 注释更新。 |
| I6 | 测试（新文件 + 既有 pin 不变） | 见 §4。 |
| I7 | `docs/skills`（team-blueprint-authoring 技能源）+ `tests/kits` 相关说明 | 技能文档的 shell-class 规则节更新（leader allow lane 例外 + envelope exec token 语法 + 双闸语义）。 |
| I8 | 簿记 | `SESSION_ROUTER_LOG.md` 条目、`graph.yaml` 任务块、`dev/agent-workflow/briefs/exec-contract/`、`evidence/exec-contract/`。 |

**明确不改**：A3 resolver（matcher 无 lane 特例，天然支持 allow-lane exec 规则）；control 平面（kind/解析闭包不变）；contracts 包（blueprint 词汇不在 contracts v1；envelope token 本就是开放 slug）；frozen docs（`docs/plans/paused/` 只读）；`PERMISSION_POLICY_DEFAULTS`；文件类工具契约。

## 4. 测试

1. **domain**（`packages/domain/test/`，新文件 `exec-contract-a1-leader-allow.test.ts`）：
   - leader 模板 allow lane `{tool: bash, resource:{kind:any}}` / `{tool: pwsh,...}` 解析通过（各一例 + 混合文件类规则一例）；
   - member 模板 allow lane bash/pwsh → 拒绝，**诊断文本逐字 pin**（现有 `a1-permission-policy.test.ts` 的 pin 不动，本文件再加一例对照）；
   - leader 模板 exact/subtree shell 资源全 lane 拒绝（不变）；
   - leader 模板 policy `default: 'allow'` 仍拒绝（不变）。
2. **runtime admission**（`packages/runtime/test/`，并入新文件）：`leaderExecEnvelopeOps` 公式表（teamEnvelope 缺省/条目缺省/条目收紧/deny 互斥/∩ exec 词汇）+ `callerEnvelope` 行为不变回归（既有测试覆盖，不重复）。
3. **runtime pre-execute 双闸**（新文件 `exec-contract-dual-gate.test.ts`，复用既有 adapter 测试 rig 模式）：
   - leader 安装 + allow-lane bash 规则 + envelope 含 `bash` → ALLOW（external 通过、标记、next 运行）；
   - 同上但 envelope 缺 token / 选项缺省 → **ask 路径**（requestControl kind=`user-approval` 行创建、等待、批准后经 guard 放行；拒绝则 deny 零副作用）；
   - leader + allow-lane bash + envelope 仅 `pwsh` → bash 降级 ask，pwsh 调用放行（token 独立性）；
   - leader + ask-lane bash 规则 → 直接 ask（双闸不介入非 allow 决策）；
   - leader + deny-lane bash 规则 → deny（优先级不变）；
   - member 安装 + 手工构造 allow-lane bash（非契约路径）→ 行为同现状（matcher 无特例）；member ask → `leader-approval` kind pin。
4. **glue**（`agent-bindings.mjs` 安装接线）：既有 live 套件（`bound-blueprint-persona-live` 模式 / smoke kit S 段）覆盖安装不回归；双闸语义由 adapter 测试承载，glue 侧只 pin 接线存在（安装选项传递）— 以现有 live rig 的最小断言实现，不新造 rig。

## 5. 门禁（exit criteria）

1. **targeted**：§4 全部新测试绿 + 既有 pin 套件绿（`a1-permission-policy` / `a2c1-pwsh-permission` / `a2c7-subtree-matcher` / `t2-blueprint-validation` / pre-execute 既有 h1a 等 / control 既有）。
2. **typecheck** 全仓 exit 0；**build** exit 0 且 **dist 零漂移**（确定性，`agent-bindings.mjs` dist 镜像同步）。
3. **check:artifacts** OK。
4. **zero-core**：test-use + references porcelain 0 @ `fb2c4b9e69`；冻结锚点 `a3ab319927` 不动；:3080/:3180 不触碰；CORE PATCH BUDGET = 0。
5. **p4t6**：新增测试文件若命中 denylist 词汇扫描 → `filesScanned` 实测后单写者 bump pin（DEC-1 惯例，注释块补文件行）。
6. **full suite**：失败集 ⊆ 基线 10 文件集（预期 = 基线 20 failed；p6t1 flake 容忍 = 隔离复跑 9/9 判据）；passed 数 ≥ 3561（新测试计入）。
7. **kit 规则**：full suite 期间不并行跑 kit（CPU starvation 先例）。

## 6. 明确不在本轮

- 参数级（exact 命令）shell 匹配器 — 仍无（契约维持"无参数级 shell allow"）。
- member allow lane / policy `default: 'allow'` — 不变。
- leader 隐式默认 allow — 用户已明确否决。
- mutation plane（overlay 授予 member exec 自治）— 既有机制（envelope 边界 + permissions cell overlay），本轮不扩展。
- 0.1.2 清理（plan §22 后续 chore）、probe 重录、PR #16 follow-up — backlog 不动。

## 7. 簿记

- `dev/agent-workflow/briefs/exec-contract/brief.md`（本计划摘要 + 实现任务分解）。
- `dev/agent-workflow/evidence/exec-contract/`（门禁证据：targeted/typecheck/build/artifacts/zero-core/full-suite diff/p4t6）。
- `SESSION_ROUTER_LOG.md` 追加条目（裁决 + 实现 + 门禁 + 证据指针）。
- `graph.yaml` 新任务块 `exec_autonomy_contract_20260918`。

## 8. 交付

分支 `task/exec-autonomy-contract` 完成全部门禁 + 簿记后，向用户报告；**push / PR 等待用户明确授权**（红线：禁止 push 例外 = 用户明确许可）。
