# A2C-3 — `team_inspect_config` 暴露真实 Operation Permission — 实施简报（Wave 4）

> 角色：任务实施子代理（Implementer）。本简报自包含；你不见主会话上下文。
> base = **INT_W3**（A2C-1/2/7 已合入后的 integration tip——你的输出字段 `managedTools` / `resourceKinds`
> 必须反映最终词集，所以放在最后一波。派发时填 BASE_SHA）。
> 主 Agent 核查结论：合理可执行，见 `docs/alpha2-capability-completion-code-review.md` §3 A2C-3。

## 0. 会话开始必读（AGENTS.md 强制，不得跳过）

1. 你的 worktree 内：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 实施计划（gitignored，只读，绝对路径）：`/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md` —
   重点 §1（§1.6 不得回退）、§2.3/§2.4、§10（你的任务契约，完整读 §10.1–10.5）、§14 A2C-3。
3. 审查记录：`docs/alpha2-capability-completion-code-review.md`（§3 A2C-3）。

## 1. 工作区

- 你的 worktree：`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-3`；分支 `task/a2c-3-inspect-operation-permission`（派发时已建）。
- BASE_SHA：`48cf8c3`（= INT_W3 冻结 tip，2026-09-12）
- 环境：Linux x86_64，node v24.21.0 / pnpm 11.7.0；real vitest 可运行。首次 `pnpm install --frozen-lockfile --ignore-scripts`。

## 2. 任务契约（计划 §10，摘要 + 权威指向计划原文）

**当前问题（§10.1）**：`team_inspect_config` 返回 `effective = generic policy resolver view`（legacy generic
capability set：`model/tools/permissions/skills/mcp`），但 alpha.2 真正 enforcement 走独立
`boundTemplate.capabilities.permissions → TemplatePermissionPolicy → pre-execute adapter`——
**当前 `effective.permissions` 不是实际 operation permission authority**，会误导用户/模型。

**本轮目标（§10.2）**：保留旧字段兼容（不破坏 Remote/tool consumers），**新增独立字段**：
```json
{
  "kind": "config-inspected",
  "effective": { "...legacy generic cells...": "..." },
  "operationPermissions": {
    "mode": "static",
    "default": "ask",
    "allow": [],
    "ask": [],
    "deny": [],
    "managedTools": ["read", "read_image", "write", "edit", "lsp", "bash", "pwsh"],
    "resourceKinds": ["exact", "subtree", "any"]
  }
}
```
permissions absent 时：
```json
{ "operationPermissions": { "mode": "absent" } }
```
名称可按现有 contract style 微调，但必须是独立字段；不得继续让用户/模型误以为 generic `effective.permissions`
就是 alpha.2 parameter authority。`managedTools` / `resourceKinds` 的值**必须来自最终词集常量**（派发时填的
INT_W3 实际值），不得硬编码字符串字面量漂移。

**数据来源（§10.3）**：必须来自 `TeamSession bound Blueprint snapshot → actual target MemberTemplate /
LeaderTemplate → capabilities.permissions`；不要从 runtime observation/free text 重建。
alpha.2 无 dynamic permission mutation → `static policy == current operation policy`；
**不得提前伪造 alpha.3 dynamic overlays/grants**（不发明 `grants` / `overlays` 字段）。

**Tool description（§10.4）**：更新 `team_inspect_config` 描述，明确区分：
```text
effective = legacy generic capability policy view
operationPermissions = actual static parameter-aware policy enforced by alpha.2
```
可给 generic `permissions` 加 presentation warning，但**本轮不删除/重命名已有 field**。

**Tests（§10.5，至少）**：
member static policy exact/any/subtree round-trip；leader static policy；
permissions absent → `mode: absent`；`pwsh` 出现在 managedTools；resourceKinds 含 subtree；
returned rule order deterministic；inspect 是 pure read：zero durable writes；
remote/tool round-trip 保持 lossless；old `effective` consumers 不回归。

**文件边界（§14 A2C-3）**：优先 `packages/runtime/admission/types.ts`（payload 类型）、
`packages/runtime/action-router/effects.ts`（INSPECT_CONFIG 路径）、`packages/tools/src/tools.ts`
（description only if needed）、runtime/tools/remote round-trip 测试。**不改 policy authority。**

**禁顺手实现**：dynamic grants 字段 / permission CRUD / 任何 UI。

## 3. 已核实的代码事实

**派发时填（主 Agent 在 INT_W3 冻结后复核填写）**：
- INT_W3 上 `admission/types.ts` `config-inspected` payload 类型当前行号与形态；
- `action-router/effects.ts` INSPECT_CONFIG → `resolveActivationPolicy` → `effectivePolicyView` 链当前行号；
- INT_W3 上最终 `PERMISSION_TOOL_NAMES` / `PERMISSION_RESOURCE_KINDS` 常量位置（managedTools/resourceKinds 的数据源）；
- remote round-trip 测试族位置（lossless 断言挂点）；
- INT_W3 上 baseline 失败集是否有变化。

**已核实（@ INT_W3 = 48cf8c3，2026-09-12）**：
1. **payload 类型**：`packages/runtime/admission/types.ts:264`
   `| { readonly kind: 'config-inspected'; readonly effective: Record<string, PolicyEntry> }`
   （L588 区另有 "lossless-JSON view for config-inspected" 注释；`effectivePolicyView` /
   `memberSummary` 同模块导出）。你的扩展 = 同一 union member 加**独立**
   `readonly operationPermissions: ...` 字段（static 形态：`{mode:'static', default,
   allow, ask, deny, managedTools, resourceKinds}`；absent 形态：`{mode:'absent'}`——
   命名可按现有 contract style 微调；**不得动 `effective` 字段**）。
2. **INSPECT_CONFIG 链**：`packages/runtime/action-router/effects.ts:288-307`
   （L289-290 target 解析 `ctx.target` → `target.instanceId`；L294 `resolveActivationPolicy`
   （generic policy — 保留不动）；L306 `effective: effectivePolicyView(...)` — 保留不动）。
   **数据源（§10.3）已就绪**：`EffectContext.blueprint: TeamBlueprint`（effects.ts:119）—
   绑定蓝图快照，`.leader` + `.members[]` 条目含各自 `capabilities`（含
   `capabilities.permissions` 若声明）；你的接线 = 从 `ctx.blueprint` 按
   `ctx.target.instanceId` 定位目标条目（root/leader vs member template），读
   `capabilities.permissions`；**不要从 runtime observation / free text 重建**。
3. **最终词集常量（managedTools/resourceKinds 数据源，public import 勿复制字面量）**：
   `packages/domain/blueprint/src/schema.ts:149` `PERMISSION_TOOL_NAMES` =
   `['read','read_image','write','edit','lsp','bash','pwsh']`（A2C-1 后 7 名）；
   `:174` `PERMISSION_RESOURCE_KINDS = ['exact','subtree','any']`（A2C-7 后最终态）。
   你的 payload 必须含 `pwsh`（A2C-1 语义）与 `subtree`（A2C-7 语义）——来自常量。
4. **remote round-trip 测试族**（lossless 断言挂点）：
   `packages/remote/test/p8t3-round-trip.test.ts`（主挂点）+ `p8t3-admission.test.ts` /
   `d1-remote-v3.test.ts` / `f9-remote-v4.test.ts` / `p8t4-sync.test.ts`（同族回归）。
   **client 套件注记**：若你的 diff 触及 client 可见类型 → 额外跑
   `cd packages/client && pnpm test`；失败不得超出基线 **TCM-M4**
   （`team-creation-panel.client.spec.tsx:453`，admitMock 期望 0 实得 1，裁决待用户，
   **不得顺手修**）。
5. **tool description**：`packages/tools/src/tools.ts:465`（`name: 'team_inspect_config'`
   定义块）— §10.4 区分文案挂点。
6. **baseline 失败集 @ INT_W3**：无变化 = baseline.md 的 10 文件 / 20 测试（A2C-5/2/7 三轮
   int bookkeeping 各验；3433 = 3330+28+11+10+18+31+5；p4t6 pin 696 已过）。
   你的 RED/GREEN 中失败集不得超出此 10 文件集（p4t6 若因你新增 scannable 文件而 delta
   失败 = 预期，报告 expected scanner delta，不改 pin）。

**已核实（@ 1e05d24，行号可能漂移）**：`action-router/effects.ts:288-307` INSPECT_CONFIG 处理；
`admission/types.ts:264` payload 类型；INSPECT_CONFIG 当前为 pure read（无 durable write 路径）。

## 4. Single-writer 禁令（违反 = 返工）

**禁止修改**：`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/SESSION_ROUTER_LOG.md`、
`packages/testkit/test/p4t6-session-event-scan.test.ts`、`package.json` 版本字段、`pnpm-lock.yaml`、
`packages/runtime/dist/**`、`packages/client/composition-shim/**`（可盘上 build 供本地 gate，不 commit dist 变更）。
**Wave 隔离**：W4 单独执行（无并行任务），但**不得回退 A2C-1/2/7 已落地行为**——inspect 输出的
managedTools 必须含 `pwsh`、resourceKinds 必须含 `subtree`（来自常量，非字面量）。
**client 套件注记**：本任务触及 remote round-trip —— 若 diff 触及 client 可见类型，
额外跑 `cd packages/client && pnpm test`，失败不得超出 baseline 的 TCM-M4（裁决待用户，不顺手修）。
**禁止**：upstream 改动、`references/` 触碰、:3080、`git push`、force-push。

## 5. 执行步骤与门禁（计划 §14；顺序不得颠倒）

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. **RED**：先写判别性测试——当前 inspect payload 无 `operationPermissions` 字段（RED 1）+
   generic `effective.permissions` 与真实 policy 可观察不同（RED 2：构造 bound policy 与 generic view 不一致的
   fixture，证明字段语义分裂真实存在）——留证据。
3. **GREEN**：payload 扩展（独立字段 + 常量源）+ effects 接线 + description 更新，逐条转绿（§10.5 全 9 条）。
4. Focused gates：新增/修改测试文件 vitest + 触碰包全量（`node scripts/run-tests.mjs runtime tools`；
   若 client 可见类型变化 → client-local 套件）+ baseline.md 失败集不得新增 + typecheck（runtime/tools/remote 受影响者）
   + `pnpm build` + `node scripts/verify-zero-core.mjs` + private-import 零命中。
5. Evidence：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-3/`（payload 前后对照、
   deterministic order 证明、pure-read 证明、round-trip lossless 对照、RED→GREEN）。
6. **报告义务**（最终消息 + `report.md`）：状态；commit 列表；`new source/test files added = N`；
   `expected scanner delta = N`（跑 p4t6 测试记录期望 vs 实际差值，不改文件）；gate 结果表；
   RED 证据指针；偏差清单；open risks。
7. Commit：1–2 个 commit，仅 src + tests + evidence；message 前缀 `A2C-3 ...`。**不 push。**

## 6. 红线复述

CORE PATCH BUDGET = 0；inspect 保持 pure read（zero durable writes）；不改 policy authority；
旧字段零破坏（remote consumers 不回归）；不伪造 alpha.3 dynamic 字段；
upstream 零改动；:3080 零触碰；不 push；H1/H4/H5 零回退。
