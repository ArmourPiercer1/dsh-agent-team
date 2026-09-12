# A2C-4 — External Hard Last-Mile Recheck — 实施简报（Wave 1）

> 角色：任务实施子代理（Implementer）。本简报自包含；你不见主会话上下文。
> 主 Agent 已完成计划核查（结论：合理可执行，见 `docs/alpha2-capability-completion-code-review.md` §3 A2C-4）。

## 0. 会话开始必读（AGENTS.md 强制，不得跳过）

1. 你的 worktree 内：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 实施计划（gitignored，只存在于主 checkout，**只读**，绝对路径）：
   `/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md` —
   重点 §1（安全不变量，尤其 §1.6 H1/H4/H5 不得回退）、§2.3/§2.4、§6（你的任务契约，完整读 §6.1–6.5）、§14（门禁）。
3. 审查记录：`docs/alpha2-capability-completion-code-review.md`（你 worktree 内有，§3 A2C-4 + §5 seam 清单）。

## 1. 工作区

- 主仓库：`/home/user/dsh-plugins/dsh-agent-team`（只读参考；**不要**在主 worktree 做任何写操作）
- 你的 worktree：`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-4`
- 你的分支：`task/a2c-4-external-hard-last-mile`（已建好，base = 派发时的 int tip，见 BASE_SHA）
- BASE_SHA：`<由主 Agent 派发时填入>`
- 环境：Linux x86_64，node v24.21.0 / pnpm 11.7.0 / git 2.53；real vitest 可运行。
- 首次进入：`pnpm install --frozen-lockfile --ignore-scripts`（共享 .pnpm-store，秒级）。

## 2. 任务契约（计划 §6，摘要 + 权威指向计划原文）

**问题**（§6.1）：`ControlService.resolveControl(ALLOW)` 时检查 `externalPolicyFacts()`，但
final `guardOperation()` 不重新读取 external hard；更关键的是 **static permission allow 路径无需
ControlRequest，完全没有 external 最后检查**。
冻结目标：*对每一个 alpha.2 managed operation，不论 static allow 还是 ask→allow_once，进入 tool body
前都必须经过当前 external hard policy 的最后检查。*

**不得引入**（§6.2）：teamHardDeny / Human hard override / new governance hierarchy。只补 external ceiling。

**推荐最小实现**（§6.3）：在现有 ControlService 内建**共享 read-only external check**（概念接口
`checkExternalOperation({ capabilityDomain: 'tools', toolName }): Promise<{allowed, reason?}>`），
必须复用 `options.externalPolicyFacts()` + **existing hard-cell 语义**（不得复制第二套 hard policy evaluator）：

```text
Static allow path:  static resolver → allow → checkExternalOperation(live) → allowed only then mark authorized → next()
Ask path:           保持 decision-time external check；durable allow → guardOperation →
                    live external recheck → exact scope → only then write allow consumption → next()
External 在 decision 后收紧:  block + zero tool effect + prefer zero allow consumption
                    （不得因 host policy 已阻止执行而无意义消耗 one-shot）
```

**RED probes（§6.4，用 mutable `externalPolicyFacts()` provider 先证明缺口）**：
1. static allow 在 provider 改成 deny 后仍执行（当前缺口）；
2. ask 的 decision 已 allow，provider 在 guard 前改成 deny，旧 guard 仍放行/消费。

**GREEN acceptance（§6.5，必须全覆盖）**：
static allow + live external deny → zero execution；ask allow + decision 后 external tighten → zero execution；
human allow 不能突破 external hard；denied external check 不产生新的 Team permission mutation；
ask path scope/fingerprint/exactly-once 全部保持；external allow 时现有成功路径不变；
fail/throw reading external facts → fail closed；hostile-prepend end-cap 不回归。

**禁顺手实现**（§0.1/§0.2）：grant_instance / mutationEnvelope / teamHardDeny / hard-boundary escalation。

## 3. 主 Agent 已核实的代码事实（file:line @ BASE_SHA，勿重复推导，可直接引用）

- `packages/runtime/operation-permission/pre-execute-adapter.ts:875-881` — **static-allow 路径**：
  `decision === 'allow'` → `authorizedExecutions.add(exec)` → `await next()`，中间零 external 检查（缺口 1）。
- 同文件 ask 路径：L907 `controlService.requestControl(...)` → L946-957 wait → L985-987 non-allow deny →
  **L993 `controlService.guardOperation(...)`** → L1009-1030 判定 → **L1033-1034 `authorizedExecutions.add(exec); return await next()`**（缺口 2 = guard 无 external recheck）。
- `packages/runtime/control/service.ts:1044-1060` — `resolveControl` 内既有 external 消费
  （`const facts = await options.externalPolicyFacts()` → deny → `reason: 'external-policy'`）；
  `service.ts:525` 附近 — "Does the external hard cell allow the operation? Fail closed: an ABSENT ..."
  既有 hard-cell 判定 helper（**复用之，不得新写第二套**）。
- `service.ts:1109-1183` — `guardOperation` 现状：target-liveness + request/decision exact-scope 复用，无 external。
- `service.ts:1380` — `guardOperation` 导出面（public seam 位置）。
- external facts 类型/形状：`domain/policy` 的 `ExternalPolicyFacts`（`hard` 为 closed cell map；
  `host.ts:386-389` 有 config 形状校验）；wiring：`root.ts:727-728`（`externalPolicyFacts` 构造）、
  `root.ts:893/1026/1039`（注入点）。
- H1 end-cap（`authorizedExecutions` WeakSet + `tools.guard`）：你的改动**必须保持在 mark 之前**
  （只有 external recheck 通过才 mark）；end-cap 本体零改动。
- 既有测试参照：`packages/runtime/test/` 内 control service 测试族 + `h1*` end-cap 测试族 +
  pre-execute adapter 测试族（RED/GREEN 新文件命名参照 `a2c4-*` 前缀惯例，如 `a2c4-external-lastmile.test.ts`）。

## 4. Single-writer 禁令（违反 = 返工）

**禁止修改**（主 Agent 单写）：
`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/SESSION_ROUTER_LOG.md`、
`packages/testkit/test/p4t6-session-event-scan.test.ts`（aggregate scanner/pin）、
`package.json` 版本字段、`pnpm-lock.yaml`、
`packages/runtime/dist/**`、`packages/client/composition-shim/**`（tracked 产物：可以在盘上 `pnpm build`
供本地 gate 使用，但**不得 commit**——提交前 `git status` 核对，若有改动 `git checkout --` 还原）。
**同 wave 并行任务边界**（A2C-1 并行改 pre-execute-adapter 的 supported-tool 分类面）：
**你的 adapter 改动只限 allow 路径插入 external recheck 的 hunk（static-allow L875-881 区 + ask 路径
guard 后 L1033-1034 区）；不得重排/重构其他区域**（尤其 supported-tool 分类、shell vocabulary、
end-cap 注册逻辑）——最小 hunk、隔离上下文。
**禁止**：修改 upstream、触碰 `references/`、触碰 :3080 稳定实例、`git push`（主 Agent 统一 push + PR）、
force-push。

## 5. 执行步骤与门禁（计划 §14 权威；顺序不得颠倒）

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. **RED**：按 §6.4 两条 probe 写确定性失败测试（mutable provider 注入；先跑，必须红，留证据）。
3. **GREEN**：最小实现（ControlService 共享 read-only check + adapter 两处接入），逐条转绿（§6.5 全覆盖）。
4. Focused gates（全过才可提交）：
   - 新增/修改测试文件：`pnpm test -- <files>`（real vitest）；
   - 触碰包全量：`node scripts/run-tests.mjs runtime`（plain-node 链）；
   - **基线失败集**：`dev/agent-workflow/evidence/alpha2-capability-completion/baseline.md`（int 已提交）
     列出的预存在失败允许存在；**不得新增任何确定性失败**（若发现 baseline.md 未列的既有失败：记录到
     evidence，不修）；
   - typecheck：`pnpm --filter @dsh-agent-team/runtime run typecheck`（+ 你实际触碰的包）；
   - `pnpm build`（全量编译；dist 只用于本地验证，不 commit）；
   - `node scripts/verify-zero-core.mjs`（必须 0 finding）；
   - private-import 零命中（你新增代码对 `@deepseek-ai/dsh-*` 的 import 仅允许 public 包入口）。
   - 本任务为 unit 级（注入 provider）；**不需要 live host**。
5. Evidence：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-4/`（RED 日志、gate 日志、
   RED→GREEN 对照、消费语义说明：one-shot 不消耗的实现证据）。
6. **报告义务**（最终消息 + 写入 evidence `report.md`）：
   - 状态（DONE / BLOCKED + 原因分类）；commit 列表（短 SHA + 一行说明）；
   - `new source/test files added = N`；
   - **expected scanner delta = N**（运行 `pnpm test -- packages/testkit/test/p4t6-session-event-scan.test.ts`
     记录其"期望 pin 数 vs 实际扫描数"差值；不修改该文件）；
   - gate 结果表；RED 证据指针；偏差清单；open risks。
7. Commit：1–2 个 commit，仅 src + tests + evidence；message 前缀 `A2C-4 ...`。**不 push。**

## 6. 红线复述（违反任一 = 立即停止并报告）

CORE PATCH BUDGET = 0；upstream 零改动；:3080 稳定实例零触碰；测试 host 仅 3180 族（本任务不需要）；
DSH_HOME 一律工作区内（本任务不需要）；gated 历史禁 force-push；不 push；
H1/H4/H5 不变量（end-cap / fresh canonicalize / effect fingerprint / capability-level 优先序）零回退。
