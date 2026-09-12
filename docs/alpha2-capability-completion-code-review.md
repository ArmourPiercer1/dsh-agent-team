# alpha.2 Capability Completion 轮 — 代码审查与核查记录（R141 节点 0）

> **性质**：主 Agent 对 `docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md`（下称"计划"）
> 所列 6 条补充意见（A2C-1/2/3/4/5/7）的**代码核查结论 + 执行裁决**。只读核查，零产品代码改动。
> **日期**：2026-09-12
> **核查基线**：`master @ ee9d49c`（含 test-infra-standardization；计划冻结基线 `a99c213` 为其祖先，代差 4 提交，
> 全部测试基础设施、零产品代码变化——见 §2 偏差 D-0）
> **Pinned upstream DSH**：`a66e470204`（0.1.2-rc.1，`tests/deepseek-harness-test-use`，pristine，
> 核查前后 `git status --porcelain` 空 + HEAD 复核一致）
> **模型路由核验**（ROUTER_RULES §1.4）：本会话运行于 `qwen3.8-27b` 基座家族（harness 报告
> `qwen3.8-27b-uncensored-fp8` variant；与 alpha.2 kickoff 轮同一 minor deviation 先例，用户启动即隐式授权，记录在案）。

---

## 1. 核查范围与方法

对计划 §5–§9、§13 的 6 条补充意见逐条执行：

1. 把意见中的每个代码论断映射到当前 master 源码 + pinned upstream 公开契约的**具体 file:line 证据**；
2. 判定意见是否成立（合理 / 不合理）；
3. 判定可执行性：所需 public seam 是否全部存在（CORE PATCH BUDGET = 0 约束下）；
4. 是否与 4 份 20260829 冻结文档语义、alpha.1/alpha.2 已冻结行为、H1/H4/H5 hardening 不变量冲突（计划 §1.6）。

方法：源码行号证据 + upstream 公开 API 面核验（`tests/deepseek-harness-test-use` @ `a66e470204`）。
所有证据命令可复现（§3 各条列明）。

---

## 2. 基线与执行偏差登记

### D-0（基线偏差，已裁决）

计划 §2.1 冻结 `base = a99c213`。实际集成基线 = **`master @ ee9d49c`**。
原因：(a) `a99c213` 之后的 4 提交（`3b56ec5`/`5cb57e9`/`b617eec`/`ee9d49c`）= test-infra-standardization，
已合入 master，是**当前唯一规范的测试布局**（`tests/paths.mjs` 路径唯一来源、`tests/homes/` DSH_HOME 协议、
TEST_METHODS.md 重写）；从旧基线开工将与 master 冲突，最终 PR 无法直接合入。
(b) 代差内容零产品代码变化，不改变计划任何语义前提。计划全部 file:line 论断在 `ee9d49c` 上复核成立（§3）。

### D-1（PR 工作流，用户显式授权，2026-09-12）

计划 §2.2/§15 的"subagent push + 开 PR + 主 Agent 合并 PR"原写于"无显式授权不 push"红线之下。
用户本轮指令（原文）：*「请你先撰写代码审查文档，提交一个pr；随后，每到一个重要节点就提交一次pr，以防开发进度损失。
你在执行worktree合并时，也需要同时操作pr的合并。最后，只保留一个总的、解决了潜在合并冲突、可以让我直接merge到
master分支的pr。」* — 用户明确许可的推送例外条款（AGENTS.md 红线）生效。PR 拓扑见 §7。
**零 force-push**；`references/` 冻结 fork 零触碰；:3080 稳定实例零触碰。

---

## 3. 逐条核查

### A2C-1 — `pwsh` parameter permission — ✅ 合理，可执行

**意见**：closed permission vocabulary 无 `pwsh`；pinned DSH standard preset 在 Windows 使用 `pwsh`；
`tool-pwsh` 与 `tool-bash` 参数同构；因此 Windows 真人环境中 `pwsh` 当前 bypass alpha.2 operation permission。

**代码证据**：

| # | 论断 | 证据 |
|---|---|---|
| 1 | closed 词集无 pwsh | `packages/domain/blueprint/src/schema.ts:145-152` — `PERMISSION_TOOL_NAMES = ['read','read_image','write','edit','lsp','bash']`；`types.ts:42` 联合类型同步 |
| 2 | Windows standard preset 用 pwsh | upstream `packages/preset/agent-presets/presets/standard/agent.cordis.yml:44-50` — `tool-bash` 行 `disabled: !!js process.platform === 'win32'`，`tool-pwsh` 行 `disabled: !!js process.platform !== 'win32'`（OS 条件挂载，Windows 只暴露 pwsh） |
| 3 | 参数同构 | upstream `packages/shell/tool-pwsh/src/index.ts:63-69` 与 `packages/shell/tool-bash/src/index.ts:45-51` — 字段集逐字节相同：`command / description / timeoutMs? / workdir? / run_in_background? / sandbox_permissions? / justification?` |
| 4 | pwsh 当前 bypass | vNext 仓库 grep `pwsh` 仅命中间接提及（issue2 测试/harness），permission 层零处理 — 未建模工具在 A3 resolver 外，pre-execute 适配器对未建模工具 pass-through（`pre-execute-adapter.ts` 头部注释 L12：`unsupported → await next()`） |

**裁决**：意见成立。修复路径（计划 §5.2-5.6）public seam 完备、无需 CORE PATCH：
domain 词集 + canonical shell-class 归并（bash/pwsh 同一语义规则：allow 恒拒、ask/deny 仅 `any` 资源、
effects 投影同构）+ adapter 识别 + storage template-policy 兼容。RED 可确定性构造（Windows 形态 preset +
`pwsh` allow 规则当前被 domain 拒绝/运行时 pass-through）。

### A2C-2 — Permission Coverage Gate — ✅ 合理，可执行

**意见**：当前无"最终实际 surface 每个工具必须归属明确 authority owner"的完整性检查；
`capabilities.permissions` 启用时，无法归属的敏感/未知工具会静默执行。

**代码证据**：

| # | 论断 | 证据 |
|---|---|---|
| 1 | 无 surface 检查 | `packages/runtime/src/plugin/live/agent-bindings.mjs`（工具注册循环：L291 `selectTeamTools`/`applyBuiltInToolDeny`、L295 `registerTeamSkills`、MCP gate、L1178+ builtinToolDeny wiring）— grep `coverage\|unmanaged\|schemas(` 零命中；setup 不检视最终 surface |
| 2 | 公开枚举 seam 存在 | upstream `packages/core/tools/src/index.ts:1225` — `ToolRuntime.schemas(scope?: ScopeKey): ToolSchema[]`，doc 明示 *"one deep-cloned schema per visible tool"*、agent-scoped、**尊重 `restrict()`**（builtinToolDeny 即经此机制）— 正是 Coverage Gate 需要的最终 surface 读取口 |

**裁决**：意见成立。Gate 定位为**完整性检查而非新 allow-list policy**（计划 §1.1 不变量），
只在 `capabilities.permissions` 启用时 strict（§1.2 legacy 不变）；managed 未显式列出 ≠ failure（§1.3，
由 `permission.default` 兜底归属）；`UNKNOWN_UNMANAGED` → setup/compatibility FATAL（§1.4），
无 escape hatch（合法修复仅 `builtinToolDeny` 移除或声明 authority owner）。可执行性确认。

### A2C-3 — `team_inspect_config` 暴露真实 operation permission — ✅ 合理，可执行

**意见**：当前 inspect 只返回泛化 activation policy 视图（capability 层），
不回答"这个工具 + 这组参数 → allow/ask/deny 哪个、依据哪条规则"。

**代码证据**：

| # | 论断 | 证据 |
|---|---|---|
| 1 | 现状 = activation policy 视图 | `packages/runtime/action-router/effects.ts:288-307` — `INSPECT_CONFIG` 分支：`resolveActivationPolicy(...)` → `effectivePolicyView(effectivePolicyValues(policy), CAPABILITY_NAME_VALUES)` — 输出 `model/tools/permissions/skills/mcp` 的 `PolicyEntry`（allow-list/deny 形态），无 tool+args→decision、无 ruleIndex/lane provenance、无 capability-level vs parameter-level 分层（payload 类型：`packages/runtime/admission/types.ts:264` `kind: 'config-inspected'; effective: Record<string, PolicyEntry>`） |

**裁决**：意见成立。新增 `operationPermission` 字段为 additive-optional（remote DTO 向后兼容：
旧 client 忽略新字段；旧 leader 继续用旧视图）。展示面必须一次性覆盖本轮最终词集
（`pwsh` + `exact/any/subtree`）——故 Wave 4 最后执行（计划 §3 W4）。可执行性确认
（resolver 为纯函数，inspect 复用同一 `resolveOperationPermission` 入口即可保证"展示 = 真实决策"）。

### A2C-4 — external hard last-mile recheck — ✅ 合理，可执行

**意见**：static-allow 路径与 ask→allow 最终 dispatch 前没有 live external hard recheck；
external facts 目前只在 `resolveControl`（ask 行创建时）消费。

**代码证据**：

| # | 论断 | 证据 |
|---|---|---|
| 1 | static-allow 无 external probe | `packages/runtime/operation-permission/pre-execute-adapter.ts:875-881` — `decision === 'allow'` → `authorizedExecutions.add(exec)` → `await next()`，中间零 external 检查 |
| 2 | guardOperation 无 external probe | `packages/runtime/control/service.ts:1109-1183` — 仅 target-liveness（member durable live lifecycle）+ request/decision exact-scope 复用判定；全文无 external 探针调用 |
| 3 | external 消费点清单 | 非测试源码中 `externalPolicyFacts` 消费：`control/service.ts:1044`（`resolveControl` 内，"allow impossible → deny reason external-policy"）+ `activation/provider.ts:694`（activation 兼容 gate）；其余为 `root.ts:727/893/1026/1039/1470`、`host.ts:386-389` 的 wiring/校验 |

**裁决**：意见成立——这正是 H 轮"capability-level deny > parameter permission"不变量在
**时间维度**上的缺口（批准时 lawful 的 static allow，dispatch 前 external 变 deny 时无 recheck）。
修复为 last-mile 加固（计划 §7）：在 adapter 两个最终放行点（static-allow、guard 通过后）插入
live external probe，fail-closed（probe 失败 = deny），顺序保持 capability-level 优先。
public seam 完备（`controlService` 已持有 `externalPolicyFacts` port；adapter 已持有 controlService 引用）。
**不得回退 H1/H4/H5**（§1.6：end-cap、fresh canonicalize、effect fingerprint 原样保持）。

### A2C-5 — read omitted-limit fingerprint debt — ✅ 合理，可执行

**意见**：read 投影 `limit ?? 2000` 是 pseudo-equivalence——omitted limit 与显式 `limit: 2000`
在 fingerprint 上不可区分；`2000` 是部署常量而非 live 上限。

**代码证据**：

| # | 论断 | 证据 |
|---|---|---|
| 1 | 伪等价存在 | `packages/runtime/operation-permission/canonical-operation.ts:159` — `export const READ_LIMIT_DEFAULT = 2000`；`:276-291` `effectiveReadWindow` — `limit ?? READ_LIMIT_DEFAULT` 进入投影 |
| 2 | 模块自认 residual | 同文件模块头注释 L44-54 明确记录：fixed default 是 "deployment constant, NOT the live deployment cap, so omitted-limit ... residual（an omitted-limit read equals an explicit `limit: 2000` read in its projection）" |

**裁决**：意见成立（代码自证的已登记 residual）。修复按计划 §8 契约执行（omitted/explicit 区分 +
fingerprint 携带区分 + 新 fail-closed reason 形态由计划指定）；影响面 = read 类操作 fingerprint 变化 →
旧 pending ask 行 fingerprint 失配 = 自然 fail-closed 失效（计划声明可接受，RED 测试须证明旧行为消失）。
与 A2C-1 同改 canonical-operation shell/read 区 → Wave 2 从 INT_W1 起（计划 §3 W2）。

### A2C-7 — subtree resource matcher — ✅ 合理，可执行

**意见**：resource 语法仅 `exact/any`；pinned DSH 已暴露 canonical containment 公开 seam，
`subtree` 可零 CORE PATCH 实现。

**代码证据**：

| # | 论断 | 证据 |
|---|---|---|
| 1 | 语法现状 | `packages/domain/blueprint/src/schema.ts:165` — `PERMISSION_RESOURCE_KINDS = ['exact','any']`（注释：`subtree is intentionally absent in A1 (not a release blocker)`） |
| 2 | 公开 seam 存在且语义正确 | upstream `packages/fs/fs/src/index.ts:157` — `abstract contains(parent: FsTarget, child: FsTarget): boolean`，doc：*"Test canonical containment **without exposing or parsing backend target keys**. Both targets must come from this provider. @returns true when `child` is `parent` or a descendant of it."* — 正是计划 §1.5 要求的 seam |
| 3 | 既有 seam 模式可复用 | `canonical-operation.ts:188-194` — canonical 层已全程经 `resolveTarget`（`ctx.fs.resolve(path, { cwd: sessionCwd, signal })` 的注入包装）做路径解析 — subtree matcher 沿用同一注入模式，**不解析 FsTargetKey**（红线：禁 startsWith/path 解析/lower-case） |

**裁决**：意见成立。matcher 为 `exact → subtree（fs.contains）→ any` 判定链的纯扩展（resolver 为纯函数，
plan §9 的 live fs wiring 经既有 `resolveTarget` 注入）。跨 domain/canonical/resolver/adapter/bindings
五层且触碰 A2C-1/2 热点 → Wave 3 单独执行（计划 §3 W3）。可执行性确认。

### 延期项复核（不在本轮执行，仅确认登记）

- **A2C-6**（grep/glob permission-aware search）：DEFERRED，继续设计。核查：`tool-fs-search`
  （upstream `packages/fs/tool-fs-search/`）surface 复杂（query/pattern 双语义），延期合理。
- **A2C-8**（capability preview / Blueprint permission UI）+ Blueprint 配置/权限交互 UI：POST-ALPHA.4，
  与计划 §0 一致；本轮零 UI 扩张。

---

## 4. 总裁决

**6 条补充意见全部合理且可执行**；无一条与冻结文档语义冲突；无一条需要 CORE PATCH
（所需 public seam 全部在位：`tools.schemas(scope)` / `fs.contains` / `tools.guard` end-cap /
`externalPolicyFacts` port / `resolveTarget` 注入模式）。**按计划执行 alpha.2 能力补齐轮。**

---

## 5. 实现约束 — Public Seam 清单

| 任务 | 依赖 seam | 位置（pinned `a66e470204`） |
|---|---|---|
| A2C-1 | `tools.guard`（H1 end-cap，既有）、tool-pwsh 参数面（isomorphic to tool-bash） | `packages/core/tools/src/index.ts`（guard L~1301 区）；`packages/shell/tool-pwsh/src/index.ts:63-69` |
| A2C-2 | `ctx.tools.schemas(scope)`（最终 surface 枚举，尊重 restrict） | `packages/core/tools/src/index.ts:1225` |
| A2C-4 | `controlService` 既有 `externalPolicyFacts` port（resolveControl 已消费，L1044） | `packages/runtime/control/service.ts` |
| A2C-7 | `ctx.fs.contains(parent, child)` + 既有 `resolveTarget` 注入 | `packages/fs/fs/src/index.ts:157`；`canonical-operation.ts:188-194` |

---

## 6. 执行决定（波次 / 门禁 / single-writer）

### 6.1 波次（计划 §3，严格遵循）

```text
W1: A2C-1 + A2C-4（并行；base = 初始 integration tip）→ 主 Agent 依序 merge → INT_W1
W2: A2C-2 + A2C-5（并行；base = INT_W1；均依赖 A2C-1 词集/canonical 变更）→ INT_W2
W3: A2C-7（单独；base = INT_W2；跨 5 层、触碰 W1/W2 热点）→ INT_W3
W4: A2C-3（单独；base = INT_W3；一次性展示最终词集 pwsh + exact/any/subtree）→ INT_W4
```

### 6.2 门禁（每任务，计划 §13/§14/§17）

1. **RED first**：先写确定性失败测试证明缺口存在，再最小 GREEN；
2. focused suite：任务新增/修改测试文件 + 任务触碰包的 `node scripts/run-tests.mjs <pkg>`（plain-node）
   与 `pnpm test`（real vitest，本 Linux 环境两链均可用）——**基线失败集不得新增**（基线集 = 初始
   integration tip 全量运行记录，主 Agent 在 dispatch 前落 evidence）；
3. `pnpm --filter <pkg> run typecheck`（触碰包）；`pnpm build`（全量编译验证）；
4. `node scripts/verify-zero-core.mjs`（CORE PATCH BUDGET = 0 机器核验）+ private-import 零命中；
5. 禁触碰稳定实例（:3080）；如需 host 实例仅 3180 族 + `tests/homes/<world>`（工作区内）；
6. H1/H4/H5 不变量回归（计划 §1.6）不得回退。

### 6.3 Single-writer 文件（计划 §2.3，subagent 禁碰）

```text
dev/agent-workflow/graph.yaml
dev/agent-workflow/SESSION_ROUTER_LOG.md
packages/testkit/test/p4t6-session-event-scan.test.ts   # aggregate scanner/pin（当前 pin 690）
package.json（版本字段）
packages/runtime/dist/**、packages/client/composition-shim/**（tracked 产物 — 可在盘上 build 供本地 gate，
    但不得 commit；主 Agent 在 integration tip 统一 rebuild + commit）
pnpm-lock.yaml（本轮预计零新依赖）
```

Subagent 报告义务：`new source/test files added = N` + `expected scanner delta = N`；
主 Agent 在每个 integration tip 统一更新 p4t6 pin（DEC-1 union 规则）+ rebuild committed artifacts
+ `pnpm check:artifacts` + `pnpm smoke:composition` + 跨任务 smoke。

### 6.4 合并纪律（计划 §15 + 用户 PR 指令）

- 每个 task branch 由主 Agent push 到 origin 并开 PR（`task → int`）；主 Agent 在本地 re-gate 通过后
  **同步操作 PR 合并**（worktree merge ↔ PR merge 同时发生）；
- merge 后在 int 上补 bookkeeping（pin / dist / evidence），冻结 `INT_Wx` SHA；
- 出现计划未预测的 source conflict → task branch 先 rebase 到最新 integration tip、重跑 focused gates、再 merge
  （计划 §2.4，禁止语义性猜测拼接）；
- 最终 `int → master` 为唯一保留的 open PR，冲突预先消除，由用户直接 merge。

---

## 7. PR 拓扑（用户授权，2026-09-12）

```text
PR-A  docs/alpha2-capability-completion-review → master   （本文档；节点 0；主 Agent 审查后合并）
      └─ master 前进后创建 int/alpha2-capability-completion（bookkeeping 首提交：graph + 日志 + 基线记录）
PR-B  task/a2c-1-pwsh-permission            → int          （W1；merge 后 re-gate）
PR-C  task/a2c-4-external-hard-last-mile    → int          （W1；merge 后 re-gate → 冻结 INT_W1）
PR-D  task/a2c-2-permission-coverage-gate   → int          （W2，base INT_W1）
PR-E  task/a2c-5-read-fingerprint           → int          （W2，base INT_W1；→ 冻结 INT_W2）
PR-F  task/a2c-7-subtree-matcher            → int          （W3，base INT_W2；→ 冻结 INT_W3）
PR-G  task/a2c-3-inspect-operation-permission → int        （W4，base INT_W3；→ 冻结 INT_W4）
PR-H  int/alpha2-capability-completion      → master       （最终唯一保留 open PR；用户直接 merge）
```

每个 PR 合并 = 一个"重要节点"的进度保全点（防开发进度损失）；PR body 含 gate 证据指针。

---

## 8. 红线合规声明

1. **CORE PATCH BUDGET = 0**：本轮零 upstream 源码改动；`references/` 冻结 fork 零触碰；
   `tests/deepseek-harness-test-use` pristine @ `a66e470204`（每轮 gate 前后 porcelain/HEAD 复核）；
   不使用私有 API；不 patch-package / vendored 修改副本。
2. **对象模型不变**：TeamBlueprint → TeamSession + TeamDomain → MemberInstance；无 Team SessionEvents；
   本轮所有 authority 事实继续落 TeamDomain，不经 SessionEvent 词汇。
3. **alpha.3/alpha.4 禁顺手实现**（计划 §0.1/§0.2）：无 grant_instance / mutationEnvelope /
   durable permission grant / Leader proactive mutation / teamHardDeny / hard-boundary escalation /
   unmanaged-tool escape hatch / 任何 permission CRUD Remote。
4. **分支红线**：零 force-push；`stable` 分支零触碰（仍 = 0.1.0-rc.1 线 `b0e5aeb`）；
   1 task = 1 branch = 1 worktree = 1 writer（`.worktrees/a2c-*`，gitignored）。
5. **测试红线**（TEST_METHODS.md）：稳定实例 :3080 及其 DSH_HOME 零触碰；测试 host 仅 3180 族；
   一切 DSH_HOME = `tests/homes/<world>`（工作区内）；homes/test-use 永不入库。

---

## 9. 复现命令（本核查所用）

```bash
# A2C-1
grep -n "PERMISSION_TOOL_NAMES" packages/domain/blueprint/src/schema.ts
sed -n '40,52p' tests/deepseek-harness-test-use/packages/preset/agent-presets/presets/standard/agent.cordis.yml
sed -n '60,70p' tests/deepseek-harness-test-use/packages/shell/tool-pwsh/src/index.ts
sed -n '43,53p' tests/deepseek-harness-test-use/packages/shell/tool-bash/src/index.ts

# A2C-2
grep -n -i "coverage\|unmanaged\|schemas(" packages/runtime/src/plugin/live/agent-bindings.mjs   # 空
sed -n '1220,1230p' tests/deepseek-harness-test-use/packages/core/tools/src/index.ts            # schemas()

# A2C-3
sed -n '288,308p' packages/runtime/action-router/effects.ts

# A2C-4
sed -n '875,882p' packages/runtime/operation-permission/pre-execute-adapter.ts
sed -n '1109,1183p' packages/runtime/control/service.ts
grep -rn "externalPolicyFacts" packages/runtime/ --include="*.ts" | grep -v test

# A2C-5
sed -n '155,160p' packages/runtime/operation-permission/canonical-operation.ts
sed -n '276,292p' packages/runtime/operation-permission/canonical-operation.ts

# A2C-7
sed -n '163,166p' packages/domain/blueprint/src/schema.ts
sed -n '150,160p' tests/deepseek-harness-test-use/packages/fs/fs/src/index.ts

# 基线
git -C tests/deepseek-harness-test-use rev-parse HEAD   # a66e4702047846cdaa10c66c9d3df3951f5ea70d
git -C tests/deepseek-harness-test-use status --porcelain   # 空
```
