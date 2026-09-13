# A2C-2 — Permission Coverage Gate — 实施简报（Wave 2）

> 角色：任务实施子代理（Implementer）。本简报自包含；你不见主会话上下文。
> base = **INT_W1**（A2C-1/A2C-4 已合入后的 integration tip，含最终 managed shell 词集——派发时填 BASE_SHA 并复核词集事实）。
> 主 Agent 核查结论：合理可执行，见 `docs/alpha2-capability-completion-code-review.md` §3 A2C-2。

## 0. 会话开始必读（AGENTS.md 强制，不得跳过）

1. 你的 worktree 内：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 实施计划（gitignored，只读，绝对路径）：`/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md` —
   重点 §1（尤其 §1.1 Gate 非新 allow-list / §1.2 legacy 不变 / §1.3 未列出≠failure / §1.4 fail closed / §1.6 不得回退）、
   §2.3/§2.4、§7（你的任务契约，完整读 §7.1–7.8）、§14（门禁）。
3. 审查记录：`docs/alpha2-capability-completion-code-review.md`（§3 A2C-2 + §5 seam 清单）。

## 1. 工作区

- 你的 worktree：`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-2`；分支 `task/a2c-2-permission-coverage-gate`（派发时已建）。
- BASE_SHA：`9c9a9ff`（= INT_W1 冻结 tip，2026-09-12）
- 环境：Linux x86_64，node v24.21.0 / pnpm 11.7.0；real vitest 可运行。首次 `pnpm install --frozen-lockfile --ignore-scripts`。

## 2. 任务契约（计划 §7，摘要 + 权威指向计划原文）

**定位**：Coverage Gate 检查 *"最终 model-facing tool surface 上的每一个工具，是否有一个明确 authority owner"*，
**不是**"工具名是否在 Blueprint 中显式声明"。仅当 Template 声明 `capabilities.permissions` 时启用 strict mode
（§1.2：无 permissions 的 legacy/alpha.1 行为完全不变，不装 enforcement、不起 strict gate）。

**时序（§7.2）**：gate 必须在 tool-producing composition 基本完成后：
`preset mount → builtinToolDeny → Team tool registration → Team skills registration → MCP mount/reconcile → FINAL effective tool surface → Coverage Gate → parameter-permission listener install → setup returns`。
核心不变量：*Gate 看到的是实际准备交给模型的 surface，而不是 preset 配置字符串*；
**不得读取 upstream private registry**；优先使用 public tool-schema enumeration seam
（已核实：`ctx.tools.schemas(scope)` — pinned upstream `packages/core/tools/src/index.ts:1225`，agent-scoped、尊重 restrict；
你在实现时必须 recon 该 seam 在 setup 时序中的可达性与真实签名，并在 evidence 记录）。

**Authority owner 分类（§7.3，纯 evaluator，closed 六类）**：
- `MANAGED_OPERATION_PERMISSION`：来自最终 managed 词集（派发时填 = INT_W1 的 `PERMISSION_TOOL_NAMES` 实际值，预期
  `read/read_image/write/edit/lsp/bash/pwsh`）——**无显式 rule 也 PASS**，调用时由 `permissions.default` 决定；
- `OTHER_MANAGED_TEAM_TOOL`：当前 Team tool catalog 实际选择并注册的工具（owner = teamTools capability + Team runtime/control）；
- `OTHER_MANAGED_MCP`：**只**能证明是当前被允许并实际 mount 的 MCP surface 引入的工具才能归入
  （不得靠名字前缀猜测；优选：MCP mount 前后 `schemas()` delta，或 upstream 明确公开的 MCP ownership metadata）；
- `SAFE_UNMANAGED`：**极小、source-reviewed、closed exact-name registry**——只有 pinned upstream source 审查证明该工具
  不具备：fs content read/write / process/shell/code execution / network egress / arbitrary MCP-tool dispatch /
  generic subagent orchestration / job process control / 跨 Team governance messaging / 其他明显 external side effect
  才能加入。**名字"看起来安全"不是证据**。registry 每个条目必须在 evidence 附 source 审查记录（file:line）；
- `KNOWN_SENSITIVE_UNMANAGED`：已知敏感但无 operation adapter/其他 owner 的已知工具。本轮至少纳入审查的类别：
  `grep/glob`（A2C-6 延期）/ `subagent,subagent_fork` / `ralph,workflow` / `web_fetch,web_search` /
  `job_*` process control / ordinary DSH agent messaging/control surfaces / 其他能绕出 MemberInstance governance 的工具
  → 存在于最终 surface = **FATAL**（除非先被 `builtinToolDeny` 等 capability 层移除）；
- `UNKNOWN_UNMANAGED`：插件完全不知道语义 → **FATAL**（不允许 warning-only）。

**响应格式（§7.4）**：新增稳定 typed setup/compatibility error（概念名 `alpha2-permission-coverage-unmanaged-tools`）；
detail 必须 deterministic（工具名排序），至少含 `instanceId / presetId / unmanagedTools[{name, classification, reason, remediation}]`；
本轮无专门 UI，existing failure surface 显示该 typed diagnostic 即可。

**禁止 auto-hide（§7.5）**：不得对发现的工具自动 `restrict({deny:...})`；正确行为 = fail loud →
用户/Blueprint 明确 `builtinToolDeny`，或开发 adapter。

**Registry 维护原则（§7.8）**：preset 更新引入新工具 = **unknown by default → blocked under permissions**，
必须经 source review 显式分类后才能进 `SAFE_UNMANAGED`。

**RED probes（§7.6）**：`permissions.default=deny` + unknown tool 仍能出现在 surface；
`default=deny` 不会自动覆盖 unsupported tool；`grep/subagent/web_fetch` 等可绕出 managed 词集。

**GREEN acceptance（§7.7 全矩阵）**：
managed-but-undeclared（`pwsh` present + 无显式 rule + default=deny → Gate PASS，调用时 default DENY）；
hidden-sensitive（preset 有 grep + builtinToolDeny 移除 → final surface 无 grep → PASS）；
exposed known-sensitive（grep 暴露 → FATAL）；unknown（`foo_magic` 暴露 → FATAL）；
safe-unmanaged（source-reviewed 安全工具 → PASS + optional diagnostic）；
team tools（`team_delegate` selected → PASS as Team-managed）；
MCP（permitted MCP mount 引入 X，ownership 由实际 mount 证明 → PASS as MCP-managed）；
legacy（permissions absent → Gate disabled → alpha.1 行为不变）；
lifecycle（fresh root / fresh member / cold root / cold member 同一 coverage verdict）。

**禁顺手实现**（§0.1/§0.2）：auto-hide / acknowledgement escape hatch（`acknowledgeUnmanaged:`）/ 任何 UI / Remote CRUD。

## 3. 已核实的代码事实

**派发时填（主 Agent 在 INT_W1 冻结后复核填写）**：
- INT_W1 上 `PERMISSION_TOOL_NAMES` 实际值与位置（A2C-1 落地后）；
- `agent-bindings.mjs` setup 时序的实际插入点（MCP reconcile 之后、permission listener install 之前的精确位置）；
- `ctx.tools.schemas(scope)` 在 setup 上下文的可达性 recon 结果；
- INT_W1 上 baseline 失败集是否有变化。

**已核实（@ INT_W1 = 9c9a9ff，2026-09-12）**：
1. **`PERMISSION_TOOL_NAMES`**（最终 managed shell 词集，A2C-1 落地后）：
   `packages/domain/blueprint/src/schema.ts:149-157` =
   `['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']`（7 名；
   经 `index.ts:40` 导出，`validate.ts:609` 消费）。你的 `MANAGED_OPERATION_PERMISSION`
   类 evaluator 应以此为 managed 词集来源（public import，勿复制字面量）。
2. **setup 时序插入点**（`packages/runtime/src/plugin/live/agent-bindings.mjs`）：
   - L1172 注释声明 setup 序列：`model selection -> agentPresets.mount -> builtinToolDeny -> Team ...`
   - L1184: `applyBuiltInToolDeny(agentCtx, capabilities.builtinToolDeny)`（capability 层先移除）
   - L1201: `agentCtx.tools.register(def)`（Team tool registration 发生区）
   - **L1242-1245: `if (mcpMountAllowed) { await reconcileMcp(agentCtx, state, true) }`**（MCP reconcile）
   - L1247-1264: 大注释块（alpha.2 plan §11.3 permission enforcement installed LAST）
   - **L1265: `if (permissionPolicy !== undefined) {`** — permission listener 安装块起点
     （内含 controlService/fsBackend fail-closed 检查，L1314 `installParameterPermissionListener` 调用）
   - **你的 Coverage Gate 插入点 = L1245（MCP reconcile 块结束）之后、L1265 的
     `if (permissionPolicy !== undefined)` 之前**——且 gate 本身必须条件化于
     `permissionPolicy !== undefined`（strict mode 仅当 Template 声明
     capabilities.permissions；§1.2 legacy 零变化）。此时点看到的 surface =
     preset mount + builtinToolDeny 后 + Team tools 已注册 + MCP 已 reconcile
     = FINAL effective tool surface（gate 契约 §7.2 满足）。
3. **`ctx.tools.schemas(scope)` seam recon**：
   - upstream pinned（`tests/deepseek-harness-test-use` @ a66e470204）
     `packages/core/tools/src/index.ts:1219-1225`:
     `schemas(scope?: ScopeKey): ToolSchema[]` — "Project visible definitions onto the
     allowlisted model-facing schema fields, excluding execution and presentation callbacks.
     @param scope - the viewing scope (the agent); omitted = the global view. @returns one
     deep-cloned schema per visible tool."（agent-scoped、尊重 restrict、返回 model-facing
     schema 数组 = 每个可见工具一条 deep clone）
   - setup 上下文可达性：`agentCtx.tools` 在 agent-bindings.mjs 已被消费（L1201
     `agentCtx.tools.register(def)`）——同一对象上的 `.schemas` 即 public seam。
     你在 L1245 之后调用 `agentCtx.tools.schemas(agentScope)`（scope = 当前 agent 的
     scope key；从 setup 作用域的 agent 身份获取，参照 L1201 附近的 scope 取值方式）
     即得 FINAL surface 的工具名清单。ToolSchema 的 `name` 字段 = 工具名。
4. **baseline 失败集 @ INT_W1**：无变化 = baseline.md 的 10 文件 / 20 测试
   （INT_W1 bookkeeping 全量运行实测 20 failed | 3349 passed (3369 = 3330+28+11)，
   逐文件 1:1 映射 baseline.md；p4t6 pin 692 已过）。你的 RED/GREEN 运行中失败集
   不得超出此 10 文件集（p4t6 若因你新增 scannable 文件而 delta 失败 = 预期，
   报告 expected scanner delta，不改 pin）。

## 4. Single-writer 禁令（违反 = 返工）

**禁止修改**：`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/SESSION_ROUTER_LOG.md`、
`packages/testkit/test/p4t6-session-event-scan.test.ts`、`package.json` 版本字段、`pnpm-lock.yaml`、
`packages/runtime/dist/**`、`packages/client/composition-shim/**`（可盘上 build 供本地 gate，不 commit dist 变更）。
**并行任务边界**（A2C-5 同 wave 改 canonical-operation 的 read 区）：你的改动集中在
`agent-bindings.mjs`（gate 安装点）+ 新 evaluator 模块 + setup/compatibility error 类型面；
**不要动 canonical-operation / permission-resolver / pre-execute-adapter 的 permission 决策流**
（A2C-5 动 canonical-operation read 投影区，A2C-7 下 wave 独占 resolver）。
**禁止**：upstream 改动、`references/` 触碰、:3080、`git push`、force-push、读取 upstream private registry。

## 5. 执行步骤与门禁（计划 §14；顺序不得颠倒）

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. **RED**：按 §7.6 三条 probe 写确定性失败测试（先红，留证据）。
3. **GREEN**：最小实现（纯 evaluator + setup 时序接入 + typed error），逐条转绿（§7.7 全矩阵 + lifecycle）。
4. Focused gates：新增/修改测试文件 vitest + 触碰包全量（`node scripts/run-tests.mjs runtime` 等）+
   baseline.md 失败集不得新增 + typecheck + `pnpm build` + `node scripts/verify-zero-core.mjs` + private-import 零命中。
5. Evidence：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-2/`（含 SAFE_UNMANAGED registry
   每个条目的 source 审查记录 file:line、seam recon 记录、RED→GREEN 对照）。
6. **报告义务**（最终消息 + `report.md`）：状态；commit 列表；`new source/test files added = N`；
   `expected scanner delta = N`（跑 p4t6 测试记录期望 vs 实际差值，不改文件）；gate 结果表；
   RED 证据指针；SAFE_UNMANAGED 初始 registry 内容 + 审查证据；偏差清单；open risks。
7. Commit：1–2 个 commit，仅 src + tests + evidence；message 前缀 `A2C-2 ...`。**不 push。**

## 6. 红线复述

CORE PATCH BUDGET = 0；public seam only（`schemas(scope)` 等，禁 private registry）；upstream 零改动；
:3080 零触碰；不 push；H1/H4/H5 零回退；legacy 行为零变化（无 permissions 的 Template 一切照旧）。
