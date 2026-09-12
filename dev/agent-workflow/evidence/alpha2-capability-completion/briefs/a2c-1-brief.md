# A2C-1 — `pwsh` parameter permission — 实施简报（Wave 1）

> 角色：任务实施子代理（Implementer）。本简报自包含；你不见主会话上下文。
> 主 Agent 已完成计划核查（结论：合理可执行，见 `docs/alpha2-capability-completion-code-review.md` §3 A2C-1）。

## 0. 会话开始必读（AGENTS.md 强制，不得跳过）

1. 你的 worktree 内：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 实施计划（gitignored，只存在于主 checkout，**只读**，绝对路径）：
   `/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md` —
   重点 §1（安全不变量）、§2.3/§2.4（single-writer/冲突）、§5（你的任务契约，完整读 §5.1–5.8）、§14（门禁）。
3. 审查记录：`docs/alpha2-capability-completion-code-review.md`（你 worktree 内有，§3 A2C-1 + §5 seam 清单）。

## 1. 工作区

- 主仓库：`/home/user/dsh-plugins/dsh-agent-team`（只读参考；**不要**在主 worktree 做任何写操作）
- 你的 worktree：`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-1`
- 你的分支：`task/a2c-1-pwsh-permission`（已建好，base = 派发时的 int tip，见下方 BASE_SHA）
- BASE_SHA：`<由主 Agent 派发时填入>`
- 环境：Linux x86_64，node v24.21.0 / pnpm 11.7.0 / git 2.53；real vitest 可运行（本环境 spawn 不受限）。
  **pwsh 二进制未安装**（live proof 等效方案见 §5.4）。
- 首次进入：`pnpm install --frozen-lockfile --ignore-scripts`（共享 .pnpm-store，秒级）。

## 2. 任务契约（计划 §5，摘要 + 权威指向计划原文）

**语义目标**：`PermissionTool += pwsh`；`bash`/`pwsh` 构成统一 shell class，各自独立 authority
（`bash authority != pwsh authority`：相同 command 不得让 bash approval 授权 pwsh，反之亦然；
`resource.kind = 'tool'`，`resource.key = 精确工具名`）。

**规则语义**（bash 与 pwsh 一致，§5.3）：`resource:any` → ask ✓ / deny ✓ / **allow ✗**；
`resource:exact` ✗（任何 lane）；`resource:subtree` ✗（A2C-7 落地后仍必须拒绝）。
继续禁止 shell command regex/prefix/path inference。

**Fingerprint**（§5.4，与 H5 bash 同 effect projection）：
`tool, commandHash, canonical workdir key, runInBackground, timeoutMs explicit|null, sandboxPermissions explicit|null`；
排除 `description` / `justification`。字段 validation 在 pre-execute 阶段 fail closed。

**代码结构**（§5.5，避免复制第二套 canonicalizer）：抽出
`SHELL_PERMISSION_TOOL_VALUES = ['bash','pwsh']` + `canonicalizeShellOperation(tool, args, resolveTarget)` +
`extractShellEffects(...)`；可保留 `BASH_*` 兼容 alias，但 authority core 不得出现两套会漂移的逻辑。
同步更新：Blueprint domain `PermissionTool` closed set / runtime local vocabulary / schema validation /
`classifyPermissionTool()` / canonical operation / shell summary / **end-cap supported-tool classification** / tests/docs。

**RED probes（§5.6，先证明缺口存在，确定性测试）**：
1. `pwsh` 被分类 `unsupported`；
2. `permissions.default=deny` 不阻止 `pwsh`（当前 bypass）；
3. `pwsh any ask` 当前 Blueprint schema 拒绝；
4. 显式挂载 `tool-pwsh` 的 preset（模拟 Windows standard surface，见 §5.4）在无 builtin deny 时 `pwsh` 可到达 executor。

**GREEN acceptance（§5.7，必须全覆盖）**：
`pwsh any deny` → zero execution / zero ControlRequest；`pwsh any ask` Member→Leader 与 Leader→Human；
allow-once exact command/effect；changed command / changed workdir / background+timeout+sandbox effect mismatch；
malformed pwsh effect 字段 fail closed；`builtinToolDeny:[pwsh]` 在 capability 层更早隐藏且 parameter permission 不得复活；
sibling Agent 不受影响；cold resume 重装 enforcement；bash 全部既有 hardening 测试零回归；
hostile pre-execute short-circuit 仍被 end-cap 拦截。

**禁顺手实现**（§0.1/§0.2）：grant_instance / mutationEnvelope / teamHardDeny / 任何 dynamic governance。

## 3. 主 Agent 已核实的代码事实（file:line @ BASE_SHA，勿重复推导，可直接引用）

- `packages/domain/blueprint/src/schema.ts:145-152` — `PERMISSION_TOOL_NAMES = ['read','read_image','write','edit','lsp','bash']`（加 `pwsh`）；`schema.ts:159` `PERMISSION_POLICY_DEFAULTS`；`schema.ts:165` `PERMISSION_RESOURCE_KINDS = ['exact','any']`。
- `packages/domain/blueprint/src/types.ts:42` — `PermissionTool` 联合类型（加 `'pwsh'`）。
- `packages/domain/blueprint/src/validate.ts:604-607` — tool 词集校验（错误文案含词集）。
- bash 语义现状：`canonical-operation.ts`（H5 effect projection：commandHash + workdirKey via `resolveTarget` seam + background/timeout/sandbox tokens；`READ_LIMIT_DEFAULT` 区 L155-292 为 read 专属——**read 区不是你的**，A2C-5 会改）。
- `pre-execute-adapter.ts` 头部 L12：`unsupported → await next()`（bypass 路径）；H1 end-cap（`authorizedExecutions` WeakSet + `tools.guard`）与 supported-tool 分类在 adapter 内——**你的 adapter 改动只限 supported-tool 分类/vocabulary 面，不要重构 allow 流程本体**（A2C-4 同 wave 并行改 allow 流程插 external probe；同文件不同区域，hunk 保持最小且隔离）。
- upstream（pinned `a66e470204`，只读证据）：`packages/shell/tool-pwsh/src/index.ts:63-69` args =
  `command, description, timeoutMs?, workdir?, run_in_background?, sandbox_permissions?, justification?` —
  与 `packages/shell/tool-bash/src/index.ts:45-51` 字段集逐字节相同；standard preset OS 条件挂载
  `packages/preset/agent-presets/presets/standard/agent.cordis.yml:44-50`（win32 ↔ pwsh）。
- 既有测试参照：`packages/runtime/test/h5-bash-effects.test.ts`（bash effect/fingerprint 测试族）、
  `packages/domain/test/`（blueprint validation 测试族）、`packages/runtime/test/`（pre-execute 适配族）。

## 4. Single-writer 禁令（违反 = 返工）

**禁止修改**（主 Agent 单写）：
`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/SESSION_ROUTER_LOG.md`、
`packages/testkit/test/p4t6-session-event-scan.test.ts`（aggregate scanner/pin）、
`package.json` 版本字段、`pnpm-lock.yaml`、
`packages/runtime/dist/**`、`packages/client/composition-shim/**`（tracked 产物：可以在盘上 `pnpm build`
供本地 gate 使用，但**不得 commit**——提交前 `git status` 核对，若有改动 `git checkout --` 还原）。
**禁止**：修改 upstream（`/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` 只读）、
触碰 `references/`、触碰 :3080 稳定实例、`git push`（主 Agent 统一 push + PR）、force-push。

## 5. 执行步骤与门禁（计划 §14 权威；顺序不得颠倒）

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. **RED**：按 §5.6 四条 probe 写确定性失败测试（先跑，必须红，留证据）。
3. **GREEN**：最小实现，逐条转绿（§5.7 全覆盖）。
4. Focused gates（全过才可提交）：
   - 新增/修改测试文件：`pnpm test -- <files>`（real vitest）；
   - 触碰包全量：`node scripts/run-tests.mjs domain runtime tools`（plain-node 链；tools 因 shell summary 面可能需要）；
   - **基线失败集**：`dev/agent-workflow/evidence/alpha2-capability-completion/baseline.md`（int 已提交）
     列出的预存在失败允许存在；**不得新增任何确定性失败**（若发现 baseline.md 未列的既有失败：记录到 evidence，不修）；
   - typecheck（触碰包逐个）：`pnpm --filter @dsh-agent-team/domain run typecheck`、
     `pnpm --filter @dsh-agent-team/runtime run typecheck`（+ 你实际触碰的包）；
   - `pnpm build`（全量编译；dist 只用于本地验证，不 commit）；
   - `node scripts/verify-zero-core.mjs`（CORE PATCH BUDGET=0 机器核验，必须 0 finding）；
   - private-import 零命中（grep 你新增代码对 `@deepseek-ai/dsh-*` 的 import：仅允许 public 包入口，
     禁止 `.../internal` / 私有子路径——参照仓库既有 import 形态）。
5. Live proof（§5.8 的**等效适配**，环境偏差必须记录）：本 Linux 主机**无 pwsh 二进制**、非 Windows
   → 计划 §5.8 "Windows real standard preset" 字面不可行。等效方案：临时 3180 族实例
   （port 3181 起，避开占用）+ 临时 DSH_HOME = `/home/user/dsh-plugins/dsh-agent-team/tests/homes/
   a2c1-live-<UTC 时间戳>Z`（TEST_METHODS §7 命名；含 launch token，永不入库；teardown 后删除并在 evidence 登记）：
   用 profile-patch 公开 seam 使测试 preset **显式挂载 `@deepseek-ai/dsh-tool-pwsh`**（模拟 Windows standard
   surface），跑：pwsh static deny（zero execution）/ ask→deny（zero effect）/ ask→allow_once（**证明
   permission 层恰好放行一次 dispatch**——body 因缺 pwsh 二进制报错属预期，evidence 须区分
   "permission 放行计数 = 1" vs "body 执行结果"）/ builtinToolDeny:[pwsh]（unknown/absent + zero permission rows）
   / cold resume。测试实例构建/启动链严格按 TEST_METHODS §2（`node scripts/build.ts` +
   `node apps/cli/lib/bin.js web --port <318x> --no-open` + `DSH_HOME` 显式）；运行前后复核
   `git -C .../tests/deepseek-harness-test-use status --porcelain` 空 + HEAD = `a66e470204`。
   若 live 链路在你的沙箱内受阻：降级为 unit 级全覆盖 + 书面说明，**不得**为跑通而改测试语义。
6. Evidence：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/`（RED 日志、gate 日志、
   live 记录、RED→GREEN 对照、偏差记录）。
7. **报告义务**（最终消息 + 写入 evidence `report.md`）：
   - 状态（DONE / BLOCKED + 原因分类）；commit 列表（短 SHA + 一行说明）；
   - `new source/test files added = N`；
   - **expected scanner delta = N**（运行 `pnpm test -- packages/testkit/test/p4t6-session-event-scan.test.ts`
     记录其"期望 pin 数 vs 实际扫描数"差值；不修改该文件）；
   - gate 结果表；RED 证据指针；偏差清单（含 live 等效适配说明）；open risks。
8. Commit：1–2 个 commit，仅 src + tests + evidence；message 前缀 `A2C-1 ...`（风格参照
   `git log --oneline -5` 现有形态）。**不 push。**

## 6. 红线复述（违反任一 = 立即停止并报告）

CORE PATCH BUDGET = 0；upstream 零改动；:3080 稳定实例零触碰；测试 host 仅 3180 族；
DSH_HOME 一律工作区内 `tests/homes/<world>`；gated 历史禁 force-push；不 push；
H1/H4/H5 不变量（end-cap / fresh canonicalize / effect fingerprint）零回退。
