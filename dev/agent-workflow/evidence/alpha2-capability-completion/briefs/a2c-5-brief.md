# A2C-5 — Read Fingerprint：移除 omitted-limit 假等价 — 实施简报（Wave 2）

> 角色：任务实施子代理（Implementer）。本简报自包含；你不见主会话上下文。
> base = **INT_W1**（A2C-1 已改过 canonical-operation shell 区——从 INT_W1 起头正是计划 §3 W2 的原因；派发时填 BASE_SHA）。
> 主 Agent 核查结论：合理（代码自证的已登记 residual），见 `docs/alpha2-capability-completion-code-review.md` §3 A2C-5。

## 0. 会话开始必读（AGENTS.md 强制，不得跳过）

1. 你的 worktree 内：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 实施计划（gitignored，只读，绝对路径）：`/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md` —
   重点 §1（§1.6 不得回退）、§2.3/§2.4、§8（你的任务契约，完整读 §8.1–8.4）、§14（门禁）。
3. 审查记录：`docs/alpha2-capability-completion-code-review.md`（§3 A2C-5）。

## 1. 工作区

- 你的 worktree：`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-5`；分支 `task/a2c-5-read-fingerprint`（派发时已建）。
- BASE_SHA：`<派发时填>`（= INT_W1）
- 环境：Linux x86_64，node v24.21.0 / pnpm 11.7.0；real vitest 可运行。首次 `pnpm install --frozen-lockfile --ignore-scripts`。

## 2. 任务契约（计划 §8，摘要 + 权威指向计划原文）

**当前债务（§8.1）**：canonical read 投影 `offset ?? 1 / limit ?? 2000` →
`read(file)` 与 `read(file, limit=2000)` 在 fingerprint 上相同；若 deployment 实际 readLimit 非 2000，
两调用实际 effect 不等价。

**冻结修法（§8.2，保守 identity，不需要读取 deployment-private default）**：
```text
offset:  omitted → 1          # upstream 语义固定默认（若 recon 确认仍成立）
limit:   omitted → null       # 表示 caller 没有显式给定
         explicit N → N
```
因此 `read(file) != read(file, limit=2000)` 在 fingerprint 上不同——即使某 deployment 恰好默认 2000，
也只产生**保守的不复用**，不会错误扩大 authorization。

**不要做（§8.3）**：不读 private tool config；不引入 live readLimit dependency；不修改 read tool 本身；
不改变 `offset` 语义（除非 pinned upstream recon 证明原假设失效——若 recon 发现 offset 默认语义有变，
记录为 deviation 并按 pinned 实际语义处理，evidence 留痕）。

**Tests（§8.4，必须全部证明）**：
omitted limit deterministic；explicit same limit deterministic；
**omitted vs explicit 2000 fingerprint 不同**；explicit 100 vs 200 不同；
resource / offset 改变仍不同；
**allow-once for omitted call 不能被 explicit-2000 call 消费**（one-shot 不跨 identity 消费）；
H1/H4/H5 permission hardening 全部不回归。

**兼容性注记（主 Agent 裁决，记录在案）**：read 类 fingerprint 变化 = 旧的 in-flight pending ask 行
（fingerprint 按旧规则铸造）在新代码下失配 → 自然 fail-closed 失效（无 allow 消费、无错误扩大）；
这是计划可接受的行为（strictness 提升），**RED 测试必须证明旧伪等价行为已消失**。

**禁顺手实现**：live readLimit seam / tool 修改 / 任何 governance 内容。

## 3. 已核实的代码事实

**派发时填（主 Agent 在 INT_W1 冻结后复核填写）**：
- INT_W1 上 `canonical-operation.ts` read 投影区的当前形态（A2C-1 已改 shell 区后的行号漂移后位置）；
- `READ_LIMIT_DEFAULT` / `READ_OFFSET_DEFAULT` 常量现状与消费点；
- fingerprint 铸造链（operation.fingerprint → control row → guard exact-scope）涉及文件；
- INT_W1 上 baseline 失败集是否有变化。
<TO-FILL-AT-DISPATCH>

**已核实（@ 1e05d24，行号可能因 A2C-1 漂移）**：`canonical-operation.ts:159` `READ_LIMIT_DEFAULT = 2000`；
`:276-291` `effectiveReadWindow`（`limit ?? READ_LIMIT_DEFAULT`）；模块头注释 L44-54 自证 residual；
`resolveTarget` 注入模式（L188-194）。

## 4. Single-writer 禁令（违反 = 返工）

**禁止修改**：`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/SESSION_ROUTER_LOG.md`、
`packages/testkit/test/p4t6-session-event-scan.test.ts`、`package.json` 版本字段、`pnpm-lock.yaml`、
`packages/runtime/dist/**`、`packages/client/composition-shim/**`（可盘上 build 供本地 gate，不 commit dist 变更）。
**并行任务边界**（A2C-2 同 wave 改 agent-bindings + 新 evaluator）：你的改动集中在
`canonical-operation.ts` read 投影/fingerprint 区 + 相关测试；
**不要动 shell 区（A2C-1 刚落地）、agent-bindings、permission-resolver、control service 内部结构**。
**禁止**：upstream 改动、`references/` 触碰、:3080、`git push`、force-push。

## 5. 执行步骤与门禁（计划 §14；顺序不得颠倒）

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. **RED**：先写 §8.4 的判别性测试（尤其 omitted vs explicit-2000 不同 + one-shot 不跨 identity 消费）——
   当前树必须红，留证据。
3. **GREEN**：最小实现（omitted → null identity；fingerprint 携带 omitted/explicit 区分），逐条转绿（§8.4 全 7 条）。
4. Focused gates：新增/修改测试文件 vitest + 触碰包全量（`node scripts/run-tests.mjs runtime`）+
   baseline.md 失败集不得新增 + `pnpm --filter @dsh-agent-team/runtime run typecheck` + `pnpm build` +
   `node scripts/verify-zero-core.mjs` + private-import 零命中。
5. Evidence：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-5/`（RED→GREEN 对照、
   fingerprint 前后对照样例、one-shot 不消费证明、offset recon 记录）。
6. **报告义务**（最终消息 + `report.md`）：状态；commit 列表；`new source/test files added = N`；
   `expected scanner delta = N`（跑 p4t6 测试记录期望 vs 实际差值，不改文件）；gate 结果表；
   RED 证据指针；偏差清单（含 offset recon 结论）；open risks。
7. Commit：1–2 个 commit，仅 src + tests + evidence；message 前缀 `A2C-5 ...`。**不 push。**

## 6. 红线复述

CORE PATCH BUDGET = 0；upstream 零改动；:3080 零触碰；不 push；
H1/H4/H5 零回退（fresh canonicalize per decision、effect fingerprint 完整性）；
fail-closed 优先（任何新歧义形态 = 拒绝，不猜测）。
