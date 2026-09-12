# A2C-7 — `subtree` Resource Matcher — 实施简报（Wave 3）

> 角色：任务实施子代理（Implementer）。本简报自包含；你不见主会话上下文。
> base = **INT_W2**（A2C-1/2/5 已合入后的 integration tip——A2C-1 已改 schema 词集与 canonical-operation，A2C-2 已建 coverage gate；从 INT_W2 起头是计划 §3 W3 的原因。派发时填 BASE_SHA）。
> 主 Agent 核查结论：合理（public seam `fs.contains` 已核实存在），见 `docs/alpha2-capability-completion-code-review.md` §3 A2C-7。
> 本任务是本轮**唯一被允许做较深 permission matcher 扩展**的任务（计划 §14）。

## 0. 会话开始必读（AGENTS.md 强制，不得跳过）

1. 你的 worktree 内：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；
2. 实施计划（gitignored，只读，绝对路径）：`/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md` —
   重点 §1（§1.6 不得回退）、§2.3/§2.4、§9（你的任务契约，完整读 §9.1–9.9）、§14 A2C-7、§14/§15/§16.5/§16.6（junction/cold-resume 集成语义）。
3. 审查记录：`docs/alpha2-capability-completion-code-review.md`（§3 A2C-7 + §5 seam 清单）。

## 1. 工作区

- 你的 worktree：`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-7`；分支 `task/a2c-7-subtree-matcher`（派发时已建）。
- BASE_SHA：`4c4273f`（= INT_W2 冻结 tip，2026-09-12）
- 环境：Linux x86_64，node v24.21.0 / pnpm 11.7.0；real vitest 可运行。symlink 可用（junction 为 Windows 概念，Linux 等效 = symlink；§9.9 "junction retarget" 用 symlink 别名 retarget 实现等效证明，Windows 语义差异记录为 deviation）。首次 `pnpm install --frozen-lockfile --ignore-scripts`。

## 2. 任务契约（计划 §9，摘要 + 权威指向计划原文）

**Blueprint grammar（§9.2）**：
```ts
PermissionResource =
  | { kind: 'exact'; path: string }
  | { kind: 'subtree'; path: string }   // path: required, string, trim, non-empty, 与 exact 相同长度/control-char 限制
  | { kind: 'any' }
```

**Tool applicability（§9.3）**：`read/read_image/write/edit/lsp` 在 allow/ask/deny 三 lane 均可 subtree；
**`bash subtree` / `pwsh subtree` = schema 拒绝**（shell 仍只有 `resource:any` ask/deny——A2C-1 落地后词集为 7 工具，shell class = {bash, pwsh}）。

**Authority semantics（§9.4）**：`subtree(root)` 匹配 `operationTarget == root OR canonical descendant of root`。
**唯一合法 predicate = `fs.contains(rootTarget, operationTarget)`**（pinned upstream public seam：
`packages/fs/fs/src/index.ts:157` `abstract contains(parent: FsTarget, child: FsTarget): boolean`，
同一 filesystem provider 的两个 canonical targets，consumer 不解析 targetKey）。
**禁止**：`operation.key.startsWith(root.key)` / `displayPath.startsWith(...)` / `node:path.relative(targetKey...)` 等任何字符串/parse authority。

**保持 A3 pure（§9.5）**：`permission-resolver.ts` **不 import DSH/fs**。由 A5 pre-execute adapter 在**每次 permission decision**
的 rule canonicalization 阶段：① 用与 operation 相同的 live `fs.resolve()` basis 解析 subtree root；
② 保留该 decision 内的真实 `FsTarget` handle（opaque runtime-only）；③ 对 operation target 调 `fs.contains(rootTarget, opTarget)`；
④ 把 operation-relative containment result 传给 pure A3 matcher。概念形态：
```ts
CanonicalRule.resource =
  | { kind: 'exact'; key: string }
  | { kind: 'subtree'; rootKey: string; containsOperation: boolean }  // rootKey 仅 provenance/debug equality，不得自行推断 containment
  | { kind: 'any' }
```

**Per-decision resolution batch（§9.6）**：为每个 decision 建临时 map `opaque key → FsTarget`（decision-local only），
canonical key/display 照常回传 A2/A3；map 只做 opaque equality lookup，不解析 key；**决策结束即丢弃，禁止跨 call/cache**。

**H4 semantics（§9.7）**：fresh canonicalization per decision。junction/symlink 别名 retarget 场景：
`rule subtree ./alias`（alias→dirA）时 `dirA/file` 匹配；retarget alias→dirB 后下一个 decision fresh resolve，
**authority 跟随 dirB**。不得 install-time freeze root identity。

**Failure semantics（§9.8，至少冻结）**：
- deny subtree 无法 canonicalize / containment 无法判定 → **FAIL CLOSED → deny**（不得静默丢掉本应可能覆盖当前 operation 的 deny rule）；
- allow subtree resolution failure → no positive grant → non-match → continue priority/default；
- ask subtree resolution failure → 不得把 failure 转成更宽 allow；最终 outcome 只能等于或严于正常语义；
  建议沿用现有 exact-rule failure asymmetry 并写清测试。

**RED/GREEN（§9.9，必须全覆盖）**：
```text
root itself matches / child matches / deep descendant matches / sibling no match
prefix trap: /src does NOT match /src2
relative/absolute aliases via backend / .. traversal via backend
Windows casing semantics by backend（Linux host：记录该条的 backend 语义等价实现，偏差入 evidence）
symlink/junction alias identity / junction retarget fresh decision
exact unchanged / any unchanged / deny > ask > allow unchanged
shell subtree schema rejects / canonicalization failure lanes / cold resume
```
**至少一个 real pinned FS backend test 必须真实调用 `FileSystem.contains()`**——不得只用 fake `startsWith` double。
（pinned upstream 的 fs service 在 `tests/deepseek-harness-test-use/packages/fs/` 可构造真实 backend 实例——recon 后在 evidence 记录构造方式。）

**禁顺手实现**：targetKey parsing / authority cache / install-time freeze / 任何 A2C-6 搜索语义。

## 3. 已核实的代码事实

**派发时填（主 Agent 在 INT_W2 冻结后复核填写）**：
- INT_W2 上 `schema.ts` resource kinds 词集（`PERMISSION_RESOURCE_KINDS`）现状与 A2C-1 落地后的词集；
- `canonical-operation.ts` / `permission-resolver.ts` 在 INT_W2 的行号漂移后形态（A2C-1 shell 区 + A2C-5 read 区改动后）；
- A5 现有 `resolveTarget` 注入模式在 INT_W2 的位置（subtree batch 的挂载点）；
- pinned fs backend 的 testkit 构造方式（哪个 export 可造真实 provider 实例）；
- INT_W2 上 baseline 失败集是否有变化。

**已核实（@ INT_W2 = 4c4273f，2026-09-12）**：
1. **resource kinds 词集**：`packages/domain/blueprint/src/schema.ts:170`
   `PERMISSION_RESOURCE_KINDS: readonly string[] = ['exact', 'any']`（A2C-1 后行号 165→170；
   你的任务 = 扩为 `['exact', 'subtree', 'any']` 并配套 validate 语法面）。
   既有 shell 拒绝逻辑在 `packages/domain/blueprint/src/validate.ts:624-631`：shell tool +
   `kind === 'exact'` → 拒绝（"only the 'any' resource, in the ask or deny lane"）；
   `kind === 'any'` + `lane === 'allow'` → 拒绝。你的 subtree 语法面必须与之一致：
   `read/read_image/write/edit/lsp` 三 lane 接受 subtree；`bash/pwsh` subtree = schema 拒绝
   （A2C-1 的 7 名词集，shell class = {bash, pwsh}）。
2. **canonical-operation.ts @ INT_W2 形态**（A2C-1 shell 区 + A2C-5 read 区落地后）：
   `resolveTarget` 注入类型 @L241（`readonly resolveTarget: PathTargetResolver`）；
   `READ_OFFSET_DEFAULT` @L191 / `effectiveReadWindow` @L333（A2C-5：omitted limit = null
   身份——**不得回退**）；`canonicalize` 入口 @L618（解构 resolveTarget）；shell 分派
   @L657 → `canonicalizeShellOperation`（export @L743，A2C-1 落地——**不得回退**）；
   read 投影 `effectiveReadWindow` 消费 @L670；`resolveResource(tool, filePath, resolveTarget)`
   @L712（fs 工具的 target 解析点——subtree 的 operation target 也出自这里）。
   **你的改动不应需要动 canonical-operation 的投影内容**（subtree 是 rule 侧 matcher 扩展，
   operation 侧投影不变）；若 recon 证明需要（记录裁决）。
3. **permission-resolver.ts @ INT_W2**：L14 自证 pure（"resource.key strings exactly …
   and never resolves paths"）；exact/any 语义文档 @L61-84。**保持 pure：零 fs/DSH import**
   （门禁特别核验项）。你的 CanonicalRule 扩展形态 = 计划 §9.5（`{kind:'subtree';
   rootKey; containsOperation: boolean}`）——A5 传入 pre-computed 布尔，resolver 只做
   纯 matcher。
4. **A5 挂载点（subtree decision-local batch）**：`pre-execute-adapter.ts` ——
   `resolveTarget` 构造自 `fsBackend` deps accessor（L103-105 文档 + L435-441 类型
   `readonly resolveTarget: PathTargetResolver`，L625 传入，L683 使用，L819 传入）。
   你的 batch 挂载在每次 permission decision 的 rule canonicalization 阶段：同一 live
   `fs.resolve()` basis 解析 subtree root（与 operation 同 basis）、decision-local
   opaque map（key → FsTarget）、对 operation target 调 `fs.contains(rootTarget, opTarget)`、
   决策结束即丢弃。fsBackend accessor 同时给你 `fs` provider 句柄（recon 确认 accessor
   暴露面——若只暴露 `resolve` 不暴露 provider/contains，记录 seam 缺口并走 public
   seam 可达路径）。
5. **pinned fs backend 真实构造**（`tests/deepseek-harness-test-use` @ a66e470204，
   本仓测试**首次**用真实 fs backend——无既有 testkit 先例，你 recon 后记录）：
   - 抽象契约：`packages/fs/fs/src/index.ts:157` `abstract contains(parent: FsTarget,
     child: FsTarget): boolean`（"Test canonical containment without exposing or parsing
     backend target keys. Both targets must come from this provider. @returns true when
     child is parent or a descendant"）；
   - 真实实现：`packages/fs/fs-local/src/index.ts:64` `export class LocalFileSystem
     extends FileSystem`（default export @L269）；`constructor(ctx: Context, config:
     Config)`，`Config = { cwd?: string（默认 process.cwd()；relative 解析基准，非
     containment 边界）; diffBasisMaxBytes?: number }`（L41-48）；
   - `override contains` @L125：`relative(processPath(parent), processPath(child))` →
     `'' | (!startsWith('..') && !isAbsolute)`——canonical relative 语义，prefix trap
     （/src vs /src2 → `'../src2'`）天然正确；
   - `Context` 构造方式由你 recon（core ctx 的最小构造；记录在 evidence seam-recon）。
   你的 real-contains 测试必须走 `LocalFileSystem`（或同等真实 provider）+ 真实
   `fs.resolve()` 铸造两个 FsTarget → 真调 `contains()`——禁 fake startsWith double
   （negative fixture 除外，须明确标注）。
6. **baseline 失败集 @ INT_W2**：无变化 = baseline.md 的 10 文件 / 20 测试（A2C-5 与 A2C-2
   的 int bookkeeping 各验一次，均 20 = 基线精确；3397 = 3330+28+11+10+18；p4t6 pin 695 已过）。
   你的 RED/GREEN 中失败集不得超出此 10 文件集（p4t6 若因你新增 scannable 文件而 delta
   失败 = 预期，报告 expected scanner delta，不改 pin）。

**已核实（@ 1e05d24，行号可能漂移）**：`schema.ts:165` `PERMISSION_RESOURCE_KINDS = ['exact','any']`；
`packages/fs/fs/src/index.ts:157` `abstract contains(parent, child)`；`canonical-operation.ts:188-194` 现有 `resolveTarget` 注入模式；
H4 exact 别名 fresh-resolution 既有测试族（`h4*`）。

## 4. Single-writer 禁令（违反 = 返工）

**禁止修改**：`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/SESSION_ROUTER_LOG.md`、
`packages/testkit/test/p4t6-session-event-scan.test.ts`、`package.json` 版本字段、`pnpm-lock.yaml`、
`packages/runtime/dist/**`、`packages/client/composition-shim/**`（可盘上 build 供本地 gate，不 commit dist 变更）。
**Wave 隔离**：W3 单独执行（无并行任务），但**不得回退 A2C-1/A2C-2/A2C-5 已落地行为**——
shell subtree 必须 schema-reject（A2C-1 语义）、read omitted-limit fingerprint（A2C-5 语义）、coverage gate（A2C-2）全部保持。
**禁止**：upstream 改动（fs.contains 只调用不改）、`references/` 触碰、:3080、`git push`、force-push。

## 5. 执行步骤与门禁（计划 §14；顺序不得颠倒）

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. **RED**：先写判别性测试——当前树 `subtree` kind 被 schema 拒绝（RED 1）+ prefix-trap 证明 startsWith 式 authority
   不可用（若写 fake matcher 对照，明确标注为 negative fixture）——留证据。
3. **GREEN**：schema 扩展 + A5 decision-local batch + A3 pure matcher（containsOperation 布尔）+ failure lanes，
   逐条转绿（§9.9 全 16 组）。
4. Focused gates：新增/修改测试文件 vitest + 触碰包全量（`node scripts/run-tests.mjs domain runtime`）+
   baseline.md 失败集不得新增 + typecheck（domain + runtime）+ `pnpm build` + `node scripts/verify-zero-core.mjs`
   + private-import 零命中（**特别核验：permission-resolver.ts 不得出现任何 DSH/fs import**）。
5. Evidence：`dev/agent-workflow/evidence/alpha2-capability-completion/a2c-7/`（real-contains 测试指向、
   symlink-retarget fresh-decision 证明、prefix-trap 反例、failure lanes 矩阵、偏差记录[Windows casing 语义]）。
6. **报告义务**（最终消息 + `report.md`）：状态；commit 列表；`new source/test files added = N`；
   `expected scanner delta = N`（跑 p4t6 测试记录期望 vs 实际差值，不改文件）；gate 结果表；
   RED 证据指针；偏差清单；open risks。
7. Commit：1–2 个 commit，仅 src + tests + evidence；message 前缀 `A2C-7 ...`。**不 push。**

## 6. 红线复述

CORE PATCH BUDGET = 0；`fs.contains` 为唯一 containment authority（零 startsWith / 零 targetKey parsing）；
A3 保持 pure/deterministic（零 fs import）；H4 fresh canonicalization 零回退（retarget 必跟随）；
fail-closed 优先（deny lane 歧义 = deny）；upstream 零改动；:3080 零触碰；不 push。
