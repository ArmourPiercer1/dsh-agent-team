# Task C — Multi-MCP RED tests + bridge/harness diagnostics

> 共享契约见 `dev/agent-workflow/briefs/multi-mcp/00-contract.md`（I5/I6/I7/I9/I11/I12
> 适用）。C 在 A 合入 int 后启动：worktree rebase 到 int tip。
> **两阶段**：阶段 1 = RED（在含 A、不含 B 的 int 树上让新测试失败并落证据）；
> 阶段 2 = GREEN（主 Agent 会 send_message 通知"B 已合入 int tip = <sha>"，
> rebase 后全绿 + 适配完成）。

## Own（逐文件）

```
packages/runtime/test/t12a-live-bridge.mjs          （改：多 MCP 记录 + config 透传）
packages/runtime/test/t12a-live-bridge.d.mts        （改：类型面同步）
packages/runtime/test/multi-mcp-wiring.test.ts      （新：核心矩阵）
packages/runtime/test/t4a-capability-wiring.test.ts （改：mcpMounts/mcpAllDisposed 单值断言 → per-server）
packages/runtime/test/t12a-h1-nullable-mcp.test.ts  （改：迁移为 zero-MCP contract + 保留 legacy-null case）
packages/tools/harness/plugin.mjs                   （改：/__p6t6/state mcp 诊断 → I5 per-server 形状）
packages/runtime/test/p8s4b-mcp-facet.test.ts       （仅当引用单 mcpView/bridge 单值时最小适配；resolver 语义回归保持）
packages/runtime/test/t12a-b3-external-deny.test.ts （同上：仅当引用单值时最小适配）
dev/agent-workflow/evidence/multi-mcp/c-tests/      （RED/GREEN 证据）
```

**Do not**：`agent-bindings.mjs`（B 拥有 — 你只消费它的行为）、host.ts/types.ts/
mcp-supply.ts（A 产物）、I9 禁改面、p4t6。若 B 的行为与契约 I4 不符：不要绕过
（不要 mock 掉断言），在报告 BLOCKED 或 DEVIATIONS 上报，由主 Agent 处置 B。

## 基线事实（主 Agent 已核验 @ b49f4239）

- bridge（`t12a-live-bridge.mjs`，973 行）：
  - `plugin(pluginSpec, options)` double @ L319 区：非 function spec 记入 world 的
    `plugins` 数组（= world mounts，现仅 mini-MCP 一种）；fiber = `{ pluginSpec,
    options, disposed, ctx(carrier+extend), dispose(), then(...) }`，`await fiber`
    settle 到 `undefined`（non-thenable，防再入）。**多 MCP 时该 double 天然可记多个
    fiber — 检查是否有单值假设的辅助断言（如 mcpMounts 计数=1）需要扩展为按
    `options.serverName` 分桶**。
  - world config 手构 @ L824 区：`mcpServer: { name: 't12a-mini-mcp', port: 3999 }` —
    config 原始透传给 `createAgentBindings`（**bridge 侧不得做 mcpServers 归一化** —
    归一化唯一入口是 A 的 `configuredMcpServers`，bridge 透传原始 config 才能
    同时覆盖 RED 旧行为与 GREEN 新行为）。
  - `glueUrl` @ L827：source 直载。
- `/__p6t6/state`（`packages/tools/harness/plugin.mjs` L416-492 区）：现 mcp 诊断
  `mounted: state.mcpFiber !== undefined` / `serverName: teamRoot.config.mcpServer?.name`
  / `views.mcpView.*` 条件展开 — 按 I5 改 per-server（数据源 = `state.mcpFibers`
  Map + `views.mcpViews` Record，B 合并后即存在；GREEN 阶段才真能跑通）。
- `t4a-capability-wiring.test.ts`：mcpMounts / mcpAllDisposed 断言（单值计数）。
- `t12a-h1-nullable-mcp.test.ts`：H1-3 zero-mount pin 等（legacy null 语义）。
- coverage 测试 `a2c2-permission-coverage.test.ts`：不改（B 保证 classifier 零改动；
  多 MCP coverage case 归入新文件 §6.11）。
- 计划 §6 测试矩阵（新文件全量要求，逐条）：
  - 6.1 P0 角色隔离：configured {A,B,C}；leader allow [A,B]；expert-1 allow [A]；
    expert-2 allow [B]；expert-3 deny；durable team override allow [A,B,C]
    → mounted：leader {A,B} / e1 {A} / e2 {B} / e3 {}。
  - 6.2 P0 legacy 兼容：`mcpServer: {name: A, port}` 旧形态 → configured {A}，
    原 single-MCP 行为不回归。
  - 6.3 P0 zero-MCP：`mcpServers: []` 与 legacy `mcpServer: null` →
    `mcpViews = {}`、`mcpFibers` 空、**零次** `agentCtx.plugin(mcpClient, ...)`。
  - 6.4 P0 duplicate identity：（host 校验面归 A 的测试；C 侧补一条 bridge 面
    防御性 case：若 config 含重名（绕过 host 校验的直构 config），
    `configuredMcpServers` 语义下 target set 不得不可判定 — 按 A 的实际 helper
    行为断言，报告说明与 A 的交界）+ §6.5 静态 template 隔离：configured {A,B}、
    durable allow {A,B}、member template allow {A} → A mounted、B **not** mounted
    （防"mcp cell allowed 就挂全部 configured"退化）。
  - 6.6 P0 durable next-boundary 收紧：initial member {A,B} → durable override
    allow {B} → next operation：A disposed、B remains、sibling member 不受影响。
  - 6.7 P0 activation 失败 rollback：target {A,B}、A 成功、B throw →
    setup/boundary fail、A 本轮新 fiber rollback、B 不存在、无 partial new set；
    + 安全次序 case：old {A}、new target {B}、B fail → A 已移除（deny 在先）、
    B 无 partial、request 不执行。
  - 6.8 P1 port=null：A 有效 port、B port=null。case 1：template/durable 只允许 A
    → A mounts，B 未被选择，B 的 null port 不导致 setup 失败；case 2：B 被允许 →
    setup/boundary fail closed，错误点名 B。
  - 6.9 P1 cold resume：member-1 {A} / member-2 {B} → 重启（bridge 的
    create→resume 或双 world 重建）后 effective set 相同（新 fibers）。
  - 6.10 P1 close/dispose：同 agent A+B → close() → A/B 各 disposed exactly once。
  - 6.11 P1 Permission Coverage：strict permissions agent 同挂 A/B（各 ≥1 MCP
    tool，double 侧伪造 tool 名进入 coverage 输入的方式参照
    a2c2-permission-coverage.test.ts 的现有手法）→ final delta 中 A/B tools 均为
    OTHER_MANAGED_MCP，无 UNKNOWN_UNMANAGED，setup 不因此失败。
- activation 失败注入手法：bridge double 的 fiber `then` 可配置 reject
  （按 serverName 路由 reject 消息）— 在 bridge 内加最小配置面（如 world 参数
  `mcpFailures: Record<serverName, string>`），保持 double 其余行为不变。

## 阶段 1（RED）— 在含 A 不含 B 的 int tip

1. 写全 `multi-mcp-wiring.test.ts`（6.1-6.11）+ bridge 多 MCP 支持 +
   t4a/h1-nullable 适配（适配按 GREEN 目标形状写 — RED 时旧 B 会让它们失败，
   记录形态）+ plugin.mjs I5 诊断（此时 B 未合入，诊断读到的 state 形状还是
   旧的 — 按 I5 写但预期 RED 失败，记录）。
2. 运行 focused 集，**逐 case 记录失败形态**（RED 证据）：
   `pnpm vitest run packages/runtime/test/multi-mcp-wiring.test.ts packages/runtime/test/t4a-capability-wiring.test.ts packages/runtime/test/t12a-h1-nullable-mcp.test.ts`
3. 判读要求（RED 纯净性）：失败必须全部可归类为
   (a) 旧 runtime 单值行为（只挂 config.mcpServer 那一个 / 忽略 mcpServers /
   单值断言不匹配）或 (b) 旧 state 形状 — 不得出现与 A 的 config 契约相关的
   意外失败（A 已合入，config 面应稳定）。若出现 (b) 之外的类别 → 停，上报。
4. 提交 RED 证据 commit（测试文件本体可以提交 — 它们是任务产物；RED 日志入 evidence）。

## 阶段 2（GREEN）— 收到主 Agent 通知后

1. `git rebase int/multi-mcp-quick-fix`（到含 B 的 tip）。
2. 全绿门禁（focused 集，计划 §7 Gate A 全量）：
   `pnpm vitest run packages/runtime/test/multi-mcp-wiring.test.ts packages/runtime/test/t4a-capability-wiring.test.ts packages/runtime/test/t12a-h1-nullable-mcp.test.ts packages/runtime/test/t3-skills-mcp-adapter.test.ts packages/runtime/test/p8s4b-mcp-facet.test.ts packages/runtime/test/t12a-b3-external-deny.test.ts packages/runtime/test/a2c2-permission-coverage.test.ts packages/runtime/test/mcp-supply-config.test.ts`
   （含 A 的 config 测试，防 B 的 rebase 破坏 A）— **全绿**。
3. 若 B 的实际行为与 I4 有偏差导致个别 case 失败：不得放宽断言迁就 — 上报
   主 Agent（BLOCKED:SPEC 或 DEVIATIONS），等裁决。
4. GREEN 证据 commit + 最终报告（I12，RED/GREEN 两节齐全）。

## Gates

- 阶段 1：RED 纯净性判读（Must-2/3）+ 语法/加载自检（新测试文件可被 vitest 加载）。
- 阶段 2：Gate A focused 全绿（Must-2）；`pnpm --filter @dsh-agent-team/tools typecheck`
  exit 0（plugin.mjs 是 .mjs — 若 tools 包有对 harness 的类型检查面则同步 .d 面，
  没有则说明）。

## 完成定义

- 新文件恰好 1（multi-mcp-wiring.test.ts）+ owned 修改 5-7 个（视最小适配需要）
  + evidence（RED/GREEN 两阶段）。
- 报告按 I12（RED 节逐 case 形态 + GREEN 节全绿清单 + 适配文件逐文件理由）。
