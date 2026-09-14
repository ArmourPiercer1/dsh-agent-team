# multi-mcp 快速修复 — 冻结契约（C1–C7 + 实现级 I1–I14）

> 主 Agent 于派发前冻结。四路 worker（A/B/C/D）共享本契约；与计划
> `docs/plans/active/multi-mcp-quick-fix-plan.md` 冲突时以计划为准并上报，
> 与契约细则冲突时以本文件为准（契约是计划 §4 的细化，不是替代）。

## 基线与波次

- base = `master` @ `b49f4239ff9378ac8041e5667402029b4dcd4ca4`（PR #15 合并点；
  与计划登记的审查基线逐字节一致，主 Agent 已核验计划全部断言与代码一致）。
- 波次 0：A（config 契约）+ D（docs/smoke kit 准备）并行。
- 波次 1：A 合入 int 后，B（runtime）与 C（tests/bridge）rebase 到 int tip 并行。
- 波次 2：B+C 合入后，主 Agent 在 int 树执行 Gate C（双 MCP real-host smoke）。
- 集成分支 `int/multi-mcp-quick-fix`；worktrees：`.worktrees/multi-mcp-{a-config,b-runtime,c-tests,d-docs,int}`。
- **p4t6 pin 现状 = 697**（`packages/testkit/test/p4t6-session-event-scan.test.ts`
  L946-947）。新可扫描文件由主 Agent 在每次 int 合并时做 DEC-1 union 记账；
  **worker 一律不改 p4t6 文件**。

## 计划级契约（计划 §4，逐字）

- C1 config supports 0..N named MCP servers
- C2 serverName is identity and unique
- C3 existing capabilities.mcp semantics unchanged
- C4 existing durable mcp cell semantics unchanged
- C5 runtime state becomes per-server
- C6 forbidden MCP is not mounted, not mounted-then-hidden
- C7 legacy single mcpServer remains accepted during this alpha

## 实现级契约（冻结，worker 不得偏离）

### I1 — 新模块 `packages/runtime/src/plugin/mcp-supply.ts`（A 拥有，B 消费）

纯模块（无 I/O、无 `node:` 内建），导出且仅导出：

```ts
import type { TeamPluginConfig, TeamPluginMcpServer } from './types.js'

/**
 * 唯一 canonical 读取路径（C1/C7）。语义：
 *  - `mcpServers` present（!== undefined）→ 原样返回（调用方已验证）；
 *  - 否则 `mcpServer` 非 null/undefined → `[mcpServer]`；
 *  - 否则 → `[]`。
 * 返回新数组（防御性拷贝），元素引用保持 config 原对象。
 */
export function configuredMcpServers(
  config: Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>,
): readonly TeamPluginMcpServer[]

/**
 * fail-closed 校验（纯函数：返回 detail 或 null，不抛错）。
 * 调用方（host.ts）用 detail 走自己的 fail()，保持
 * `TeamPluginError(TEAM_PLUGIN_CONFIG_INVALID, 'dsh-agent-team row config: <detail>')`
 * 单一错误封套。检查顺序（首个命中即返回）：
 *  1. mcpServers present 且非 array
 *     → 'mcpServers must be an array of { name, port: number|null }'
 *  2. 任一 entry 非 object / name 非非空 string / port 非 number|null
 *     → 'mcpServers must be an array of { name: non-empty string, port: number|null }'
 *  3. 重名
 *     → "duplicate mcpServers name '<name>'"
 *  4. mcpServers present 且 mcpServer 非 null
 *     → 'ambiguous MCP configuration: both mcpServers and a non-null mcpServer are present'
 *  5. mcpServers absent：保持现有 legacy 单值检查原文（字节级保留现有 message）
 *     → 'mcpServer must be { name, port: number|null } or null'
 *     （legacy 路径语义与现状完全一致，包括现状未拒空 name 的行为 — C7）
 */
export function mcpSupplyValidationIssue(
  config: Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>,
): string | null
```

### I2 — `types.ts`（A 拥有）

- 新增 `export interface TeamPluginMcpServer { readonly name: string; readonly port: number | null }`。
- `TeamPluginConfig` 新增字段（紧邻 `mcpServer`，带注释：canonical 0..N 输入；
  legacy `mcpServer` 本 alpha 继续接受，新文档/测试一律用 `mcpServers`）：
  `readonly mcpServers?: readonly TeamPluginMcpServer[]`
- `mcpServer` 字段本体不动（注释可加 "legacy" 标记）。

### I3 — `host.ts`（A 拥有）

现有 L388-394 的单值检查**原位**替换为：

```ts
const mcpIssue = mcpSupplyValidationIssue(c)
if (mcpIssue !== null) fail(mcpIssue)
```

其余校验顺序/内容不动。

### I4 — `agent-bindings.mjs`（B 唯一拥有；2739 行 @ base）

- import：`import { configuredMcpServers } from '../mcp-supply.js'`
  （相对 live/；与现有 `.js → .ts` 源解析约定一致；dist 镜像由
  place-dist-glue 整文件复制，tsc 会发射 mcp-supply.js，双平面均解析）。
- state 形状（C5）：`{ instanceId, ref, modelView,
  mcpViews: Record<string, McpFacetView>,
  mcpFibers: Map<string, Fiber>,
  mcpActivationErrors: Map<string, string>,
  appliedRecordIds: Set<string> }`
  （删除 `mcpView` / `mcpFiber` / `mcpActivationError` 单值键；
  文件头注释块同步更新）。
- `resolveConsumptionViews(sessionId, instanceIdHint, teamRootSid)` 返回
  `{ instanceId, modelView, mcpViews }`；`mcpViews = {}` 当
  `configuredMcpServers(config)` 为空；否则逐 configured server 调
  `consumption.capability.resolveDurableMcpFacet({ rootSessionId, instanceId,
  overrides, external, serverName: server.name, ...(appliedRecordIds) }).view`
  （resolver 本体零改动 — C4）。
- `applyBoundaryRecords(state, modelView, mcpViews)`：遍历
  `modelView.pendingNextBoundary` ∪ 每个 `mcpViews[name].pendingNextBoundary`
  （现有 `Set` 天然去重 — 同一 record 在多 server view 重复出现是合法的）。
- `reconcileMcpSet(agentCtx, state, targetServerNames: readonly string[])`
  取代 `reconcileMcp`（推荐时序，计划 §2.5，deny-first）：
  1. `configured = configuredMcpServers(config)`；target 中出现非 configured
     name → throw（fail closed，结构性不可达）；
  2. **先 dispose**：`state.mcpFibers` 中不在 target 的 name 逐个 dispose
     （dispose 异常 → observation，不中断其余 dispose），同步清
     `mcpFibers` / `mcpActivationErrors` / `mcpViews` 对应键；
  3. mounts = target − 已 mounted，按 **configured 顺序**逐个 mount；
  4. mount 前 port 检查：`port === null` → throw
     `p6t6: the durable policy allows mcp server '<name>' but no mini-MCP port is configured (config.mcpServers port for '<name>')`
     （错误必须点名具体 server — 计划 §6.8 case 2）；
  5. mount = `agentCtx.plugin(mcpClient, { transport: 'streamable-http',
     serverName: <name>, url: 'http://127.0.0.1:<port>/mcp', headers: {},
     toolCallTimeoutMs: 15_000, failOnStartupError: true })`，`await fiber`；
     成功先记入 **temporary set**（不直接写 state）；
  6. 任一 activation 失败：dispose 本轮 temporary set 全部 fiber（清错
     observation），**不恢复**第 2 步已 deny-dispose 的 server，
     `state.mcpActivationErrors.set(<失败名>, msg)`，
     observation `p6t6: mcp activation failed [server <name>]: <msg>`，
     抛出原 error（setup/boundary fail closed，request 不继续）；
  7. 全部成功：temporary fibers commit 进 `state.mcpFibers`，
     清对应 `mcpActivationErrors` 键。
- 静态 template gate（两处调用点：agentSetup ~L1272 与 request-boundary
  ~L1786）：`templateAllowedNames = filterMcpServers(configured.map(s => s.name),
  capabilities.mcp)`（filter 本体零改动 — C3）；
  `target = templateAllowedNames.filter(name => mcpViews[name]?.allowed === true)`
  （逐 server AND — 计划 §2.3；替换原 `mcpMountAllowed` 布尔）。
- request-boundary 重解析：`resolveConsumptionViews` 现在对**每个** configured
  server 生效（同一次 reconcile 完成全部目标 server，之后再拍 coverage final
  snapshot — §2.7；B 必须核对 agentSetup 内 pre-MCP snapshot → reconcileMcpSet
  → final snapshot 的顺序保持单次 reconcile）。
- cold resume：无特殊代码 — consumptionState 为 per-boot 内存态，resume 后首次
  setup/boundary 按 durable truth 重建 exact set（现有模式，B 需以测试证明，
  测试归 C）。
- `close()`：dispose **所有** session state 的 `state.mcpFibers` 全部 fiber
  （现 L2688 单值分支改为遍历）。
- `getConsumptionState` / `resolveConsumptionViews` 对外签名不变（返回体形状
  按 I4 更新）。

### I5 — `/__p6t6/state` 诊断形状（C 拥有 harness；B 的 state 形状是其数据源）

```json
"mcp": {
  "servers": {
    "<serverName>": {
      "mounted": true,
      "allowed": true,
      "source": "<view.source>",
      "unavailable": "<view.unavailable>",
      "deniedBy": "<view.deniedBy>",
      "pendingNextBoundary": [],
      "explanation": "<view.explanation>",
      "activationError": "<state.mcpActivationErrors.get(name)>"
    }
  }
}
```

- keys = 有 view 的 configured server 名（即 `mcpViews` 的键）；
  `mounted` = 该 name 在 `state.mcpFibers`（live handle）中存在。
- zero-MCP 行或无 live state → `mcp: { servers: {} }`。
- 字段存在性沿用现有条件展开风格（unavailable/deniedBy/activationError
  有才出现；allowed/source/pendingNextBoundary/explanation 恒有）。
- 这是 harness/diagnostics 契约：不升级 public Remote 协议。

### I6 — 新测试文件（C 拥有）：`packages/runtime/test/multi-mcp-wiring.test.ts`

覆盖计划 §6.1–§6.11（P0 全 + P1 全），经 t12a-live-bridge 的 test double
运行（双/多 MCP 由 double 模拟 `ctx.plugin(mcpClient, ...)` fiber；不依赖
真实端口）。配置经 bridge world 直接构造（bridge 不做 mcpServers 归一化 —
原始 config 透传）。

### I7 — RED-first（C）

`multi-mcp-wiring.test.ts` 的 P0 blocker cases 在 **B 合入前**的 int 树上必须
失败（多 server 隔离/A+B 同挂/rollback 等）；legacy/zero-MCP cases 通过。
C 在 RED 阶段落证据（逐 case 失败形态），GREEN 阶段（B 合入后）全绿。

### I8 — 错误/observation 词汇

- 新 mount 相关 observation 一律 `p6t6: mcp ... [server <name>] ...`（点名）。
- 配置错误一律经 I1 的 detail → host `fail()` 封套（worker 不得新造错误码）。

### I9 — 禁改面（计划 §3.4；改动即 scope expansion，停并上报）

```
packages/runtime/agent-setup/capability/mcp-facet.ts
packages/runtime/agent-setup/capability/mcp-adapter.ts
packages/domain/**
packages/storage/**
packages/contracts/**
packages/testkit/**          （p4t6 pin 归主 Agent 记账）
packages/remote/**
```

### I10 — 已知"不属本轮"的消费者（主 Agent 核验过，勿动）

`packages/runtime/member-residency/harness/slots-t6.mjs`、
`packages/runtime/root-binding/harness/slots.mjs`、
`tests/characterization/probes/capabilities/plugins/capability-scenario.js`
— 均为自持 `world.mcpFiber` 的独立 P2/P5 harness 世界，不读 glue state。
`dev/agent-workflow/evidence/` 历史 evidence 一律不改写。

### I11 — git / 环境纪律（每个 worker）

- 单写者：只在自己的 worktree 内提交；不 push；不碰其他 worktree/分支；
  不改 `tests/deepseek-harness-test-use`（pristine，保持 porcelain 空 @ a66e470204）；
  不碰 :3080；只用 3180 族端口（D 的 real-host smoke 用 3180 + MCP 3491-3500）。
- 证据写入 `dev/agent-workflow/evidence/multi-mcp/<task>/`（随任务提交）。
- 每个任务 commit 前：`git status --porcelain` 只含 owned 文件 + evidence。
- 测试命令（worktree 根）：
  - focused：`pnpm vitest run packages/runtime/test/<file1> packages/runtime/test/<file2> ...`
  - 全量 runtime：`pnpm vitest run packages/runtime/test`
  - 全量（root）：`pnpm test`
  - typecheck：`pnpm --filter @dsh-agent-team/runtime typecheck`（tools/domain 同理）
  - build+dist 门禁：`pnpm build && pnpm build:composition`（含 place-dist-glue + check-artifacts-committed）
  - 已知既有 flake：`p6t1-parallel`（2-3 测试，load flake，isolation 裁决先例）—
    遇之重跑 isolation 9/9 并记录，不算回归。
- 依赖安装（如 node_modules 缺失）：
  `pnpm install --ignore-scripts --frozen-lockfile --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store`
  （lockfile 不得变更 — 本轮零新依赖）。

### I12 — 交付报告格式（每个 worker 结束时）

```
TASK: <A|B|C|D>
STATUS: DONE | BLOCKED(<blocker 类型>)
BASE: <sha>  HEAD: <sha>  COMMITS: <n>
OWNED DIFF: <git diff --stat base..HEAD 逐文件>
RED: <C 专属：逐 case 失败形态 + 证据路径>
GATES: <本任务门禁逐条 PASS/FAIL + 输出文件>
DEVIATIONS: <与契约的偏离，无则 NONE；scope expansion signal 单列>
RISK: <遗留风险/未覆盖项>
```

### I13 — DoD（计划 §9，验收由主 Agent 执行）

production config 0..N 唯一命名；legacy 可启动；capabilities.mcp / durable mcp
schema 不变；leader/member 不同子集；同 Agent 双挂；forbidden 不挂；
next-boundary 收紧只移除目标 server；sibling 隔离；activation 失败无 partial
newly-mounted；cold resume 重建 exact set；close() dispose 全部；strict
coverage 识别多 MCP tools；focused 全绿；runtime 回归全绿（除已记录 baseline
failures）；typecheck/build/artifact 全绿；双 MCP real-host smoke 全绿；零 core patch。

### I14 — 明确不做（计划 §0"明确不做"，逐字生效）

不重做 capabilities.mcp schema；不仿 builtinToolDeny 造 MCP deny；
不先全挂再 tools.restrict() 隐藏；不增 MCP CRUD/UI/registry service；
不引入新 durable MCP inventory；不改 governance override mcp cell 语义；
不改 resolveDurableMcpFacet 核心 policy 规则；不为不同 member 启动独立
MCP server 进程。
