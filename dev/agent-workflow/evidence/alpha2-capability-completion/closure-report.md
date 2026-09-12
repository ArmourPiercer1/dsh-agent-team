# Alpha.2 Capability Completion Closure

> 日期：2026-09-12 · 主 Agent 收束报告 · 计划 = `docs/plans/active/dsh-agent-team-alpha2-capability-completion-plan.md`
> 集成分支：`int/alpha2-capability-completion` · 全部 6 任务已合入（W1→W4 四波，每任务独立 worktree/branch/PR）
> 用户裁决授权：PR 工作流（D-1）——每节点 PR、worktree 合并与 PR 合并同步、最终仅留一个 int→master PR 供用户 merge。

## 1. Baseline

- **master base**: `1e05d24`（deviation D-0：计划冻结的 `a99c213` 为其祖先，delta = test-infra-standardization 仅，零产品变更）
- **upstream pin**: `a66e470204`（0.1.2-rc.1 官方 release，pristine @ 收束时 porcelain 0）
- **baseline failure set**（`baseline.md` @ 1e05d24）：root vitest **20 failed / 10 files**（domain t1×9 + t2×1、legacy p7t6×1、runtime d3×1 + p6t3-mediation×5 + p6t3-restart×2 + p8s3b/t12a-b2/t12a-glue 文件级×3、tools p6t6×1）；plain-node 链 10 FAIL 文件（a6a、bp1×3、d1×3、d2、d3、d5）；p4t6 pin 690；client TCM-M4（`team-creation-panel.client.spec.tsx:453`，裁决待用户）
- **最终失败集 diff（§18.2 逐文件，fresh install @ 收束 tip）**：

| 包 | 文件 | baseline | final | 判定 |
| --- | --- | --- | --- | --- |
| domain | t1-capability-schema.test.ts | ×9 | ×9 | 1:1 |
| domain | t2-blueprint-hash.test.ts | ×1 | ×1 | 1:1 |
| legacy | p7t6-teammates-adapter.test.ts | ×1 | ×1 | 1:1 |
| runtime | d3-member-identity-context.test.ts | ×1 | ×1 | 1:1 |
| runtime | p6t3-mediation.test.ts | ×5 | ×5 | 1:1 |
| runtime | p6t3-restart.test.ts | ×2 | ×2 | 1:1 |
| runtime | p8s3b-result-effects.test.ts | 文件级 | 文件级 | 1:1 |
| runtime | t12a-b2-child-identity.test.ts | 文件级 | 文件级 | 1:1 |
| runtime | t12a-glue-handoff-ports.test.ts | 文件级 | 文件级 | 1:1 |
| tools | p6t6-actions.test.ts | ×1 | ×1 | 1:1 |

**new deterministic failure set = 0**（3444 = 3330+28+11+10+18+31+36 全部 A2C 新增测试皆绿）。
瞬态 flake 裁决记录（均 isolation 复跑绿，非回归）：p6t1-parallel（load flake，2/3 全量 run 出现，isolation 9/9）、
p4t6（full-suite walk race，isolation + direct scanner 稳定）、a5a（cross-runner world-state 泄漏，fresh world PASS）。

## 2. Integrated tasks

- **A2C-1**（W1，PR #9，merge `23a4d9f`）：pwsh = 正式 managed shell permission tool。7 词集（`PERMISSION_TOOL_NAMES` 7 名）、
  参数化 `canonicalizeShellOperation`、`<tool>-command-*` 每工具镜像 closed reasons、live proof 5 legs / 42/42 断言
  （Linux 宿主适配：显式 tool-pwsh mount + dispatch 级"permission layer authorized exactly once"证明；pwsh ask/deny 语义等价）。
- **A2C-4**（W1，PR #8，merge `e2e0163`）：external hard last-mile。shared read-only `checkExternalOperation` 复用
  `hardCellAllows`；static allow **与** ask allow 均在 consumption/dispatch 前 live 重检；a6a SpyControlService 补全（deviation D-1）；
  recheck 位置在 `guardOperation` 内、consumption write 前（deviation D-2）。11 测试。
- **A2C-5**（W2，PR #10，merge `b06a132`）：read 指纹 limit 身份。`effectiveReadWindow` `limit ?? READ_LIMIT_DEFAULT` →
  `limit ?? null`（omitted = null 身份；`read(file) != read(file, limit=2000)`；显式 N byte-stable；offset omitted → 1 不变 —
  recon @ pinned `parseReadArgs` 裁决）。10 测试。旧 in-flight pending-ask 行部署后自然 fail-closed（计划接受的严格度提升）。
- **A2C-2**（W2，PR #11，merge 含合并阻塞修复 `c0bb109`）：Permission Coverage Gate。六类闭包 authority-owner 分类
  （managed > team > mcp > safe > sensitive > unknown）、`tools.schemas(scope)` public seam 枚举 FINAL surface、
  `alpha2-permission-coverage-unmanaged-tools` typed error（deterministic detail）、strict mode 仅 permissions-present、
  禁 auto-hide / 禁 escape hatch。**合并阻塞修复**：t12a-live-bridge double 加 `tools.schemas` seam + public `createScope`
  scope 铸造（a6a/bp1 两文件，H1/alpha.1 既有 double 扩展模式；零生产变更）。18 测试。
- **A2C-7**（W3，PR #12，merge `831fedb`+`58f9994`）：subtree resource matcher。schema kinds += `subtree`
  （shell 全 lane schema-reject，A2C-1 文本 byte-identical）；A5 decision-local opaque-handle batch（H4 fresh per decision，
  retarget 跟随 — G10 真实 symlink 测试）；**`fs.contains` 唯一 containment authority**（本仓测试首次真实
  `LocalFileSystem` backend：真 `fs.resolve()` 铸双 target + 真 `contains()`）；A3 保持 pure（恰 2 import 均 type-only —
  专项门禁）；failure lanes：deny 歧义 = FAIL CLOSED deny / allow-ask = non-match（P1-3 不对称保留）。31 测试（16 组全覆盖）。
- **A2C-3**（W4，PR #13，merge `5607f9f`+`1256354`）：`team_inspect_config` 独立 `operationPermissions` 字段
  （static：mode/default/allow/ask/deny AS STORED + managedTools ← 常量 + resourceKinds ← 常量；absent：`{mode:'absent'}`；
  `effective` byte-identical 零破坏；数据源 = bound blueprint 快照 `ctx.blueprint`；pure read 零 durable write；零 alpha.3 伪造）。
  11 测试（9 §10.5 腿 + R1/R2 语义分裂探针）。

## 3. Permission vocabulary

- **managed tools**（`PERMISSION_TOOL_NAMES` @ `packages/domain/blueprint/src/schema.ts:149`，7 名）：
  `read, read_image, write, edit, lsp, bash, pwsh`
- **resource kinds**（`PERMISSION_RESOURCE_KINDS` @ `schema.ts:174`，A2C-7 后最终态）：`exact, subtree, any`
- shell class = `{bash, pwsh}`：仅 `resource:any`（ask/deny lane）；subtree/exact 全 lane schema 拒绝（A2C-1）
- p4t6 词集 pin：690 → 691（A2C-4）→ 692（A2C-1）→ 693（A2C-5）→ 695（A2C-2）→ 696（A2C-7）→ **697（A2C-3）**（DEC-1 联合，主代理于各 integration tip）

## 4. Coverage Gate

- **safe unmanaged registry**（closed，source-reviewed，file:line 证据 @ `a2c-2/safe-unmanaged-registry.md`）：
  本轮恰 1 条 = `todo_write`（upstream `tool-todo`：inject 仅 tools+sessionProjections；唯一 effect = 调用者自己 session 的
  `todo/write` 事件；无 fs/exec/network/MCP/orchestration/job/cross-team 面）
- **sensitive unmanaged registry**（closed，14 名 + `job_` 前缀族）：`grep`/`glob`（A2C-6 延期）、`subagent`/`subagent_fork`、
  `ralph`/`workflow`、`web_fetch`/`web_search`、`job_*` process control、ordinary DSH agent messaging/control 面
- **unknown behavior**：`UNKNOWN_UNMANAGED` = **FATAL**（typed error，无 warning-only）
- **legacy behavior**：permissions absent → gate absent（零 enforcement、零 listener、零行为变化；alpha.1 byte-for-byte）
- managed-but-undeclared（如 `pwsh` 无显式 rule）→ Gate PASS（`MANAGED_OPERATION_PERMISSION`，调用时由 `permissions.default` 决定）
- hidden-sensitive（`builtinToolDeny` 移除）→ Gate PASS（看的是 FINAL surface）
- MCP tools 仅在 ownership 可证明时归 managed（reconcile 前后 `schemas()` delta = proven-mount 差集，非名字前缀猜测）

## 5. External hard

- **static allow proof**：static rule resolve 为 allow 后、consumption write 前，live `checkExternalOperation` 重检
  （`a2c4-external-lastmile.test.ts` 11 测试，含 external 状态在 decision 与 consumption 之间翻转的场景 → fail closed）
- **ask allow proof**：ask → 用户 allow → consumption/dispatch 前**再次** external hard 重检（同套件；
  `guardOperation` 内、consumption 前的位置由 deviation D-2 固定）
- a6a production wiring 套件（52 测试）在生产接线层面验证 listener 安装/卸载/冷恢复全生命周期

## 6. Fingerprint identity

- **read omitted-limit**：omitted `limit` → null 身份（`a2c5-read-fingerprint.test.ts` 10 测试：T1 omitted≠explicit-2000
  判别、T6/T7 one-shot 跨身份双向不消费 over 真实 A4 control service、byte-exact digest、offset 语义不变腿）
- **shell effects**：`<tool>-command-*` 每工具镜像 closed reasons（bash 与 pwsh authority 不串用 — `a2c1-pwsh-permission.test.ts`
  28 测试含 P1-P4 探针：unsupported / static-allow pass-through / MALFORMED_DTO / bodyDelta）；shell 指纹 effect identity 零回归

## 7. Subtree authority

- **public seam**：`FileSystem.contains(parent, child)`（pinned upstream `packages/fs/fs/src/index.ts:157` 抽象契约；
  真实实现 `fs-local` `LocalFileSystem` @ L125）— **唯一** containment authority；零 startsWith / 零 targetKey parsing
  （fake startsWith double 仅作标注的 negative fixture 证明字符串 authority 的 prefix-trap 不可靠）
- **mutable topology proof**：G10 真实测试 — symlink alias `./alias→dirA` 时 `dirA/file` 匹配 `subtree ./alias`；
  retarget `alias→dirB` 后**下一个 decision** fresh resolve，authority 跟随 dirB（旧 target 不匹配 / 新 target 匹配）—
  无 install-time freeze（H4 fresh canonicalization per decision 零回退）
- prefix trap：`/src` 不匹配 `/src2`（real backend + negative fixture 双证）
- A3 resolver 纯 matcher（`containsOperation` 布尔，rootKey 仅 provenance）— 专项 import 审计 PASS

## 8. Introspection

- `team_inspect_config` → `config-inspected` effect = `{ kind, effective（legacy generic view，byte-identical 零破坏）,
  operationPermissions（独立 REQUIRED 字段）}`：
  - bound template 声明 permissions → `{ mode:'static', default, allow/ask/deny（AS STORED，declaration order deterministic）,
    managedTools（← 常量，含 pwsh）, resourceKinds（← 常量，含 subtree）}`
  - absent → 恰好 `{ mode:'absent' }`
- 数据源 = `ctx.blueprint`（bound Blueprint 快照 → 目标条目 → `capabilities.permissions`）；leader 经保留 instance id、
  member 经 templateId、dangling ref → fail-closed internalInvariant
- inspect = pure read（seam writeCount 不变 + 全部 repository listings deep-equal 断言）
- tool description 已区分两字段语义（generic ≠ alpha.2 parameter authority）
- remote round-trip lossless（p8t3 族全绿；client 套件 = 恰好 TCM-M4 基线，未修）

## 9. Live Windows smoke

- **宿主限制**：Linux x86_64 宿主无 Windows / pwsh 二进制（`$PSHOME` 不存在）。
- **fresh（Linux 适配等价证明，A2C-1 live proof @ :3183 真实实例）**：显式 `tool-pwsh` mount + `DSH_PERMISSION_MODE=danger-full-access`
  进程旋钮；dispatch 级证明"permission layer authorized exactly once"（pwsh ask/deny 语义路径与 bash 同构 — 28 测试 + 42/42 live 断言）
- **cold（恢复腿）**：冷恢复重装 listener + gate + 词集（a2c2 lifecycle 四 bind-path 腿 + a6a 冷恢复腿 全绿）
- **Windows 语义差异记录**（deviation）：G8 casing = backend 语义等价（Linux 大小写敏感 → 不匹配；NTFS 会匹配；模块从不 case-fold）；
  junction retarget = symlink 别名 retarget 等效证明（Windows junction 语义差异记录 @ `a2c-7/evidence-notes.md`）。
  严格 Windows worker 上的原样复跑列入 alpha.3 前置 checklist（§16.1 语义不变）。

## 10. Full gates（fresh dependency install @ 收束 tip，`closure-gates.log`）

- **focused security suites（§18.1）**：A1/A2/A3/A4a/A5a/A6a + H1a end-cap + H3 hostile live seam + H4 rule identity +
  H5 shell effects + issue#2（×2 文件）+ A2C-1/2/3/4/5/7 全族 = **18 文件 / 465 测试，全部 PASS**
- **package parity（§18.2）**：root vitest **10 failed / 20 failed tests = baseline 精确**（3444 total）；
  plain-node 链：runtime 10 / domain 2 / tools 2 / storage 0 / testkit 0 = 各包 pre-existing 集合（zero new）；
  client = 恰好 TCM-M4（640/641）
- **build gates（§18.3，fresh install 后）**：typecheck 8/9 包 exit 0（legacy 无 typecheck script，build-only 包 — `pnpm build` 覆盖）；
  `pnpm build` exit 0；`build:composition` PASS；`check:artifacts` **OK: 1108 files**；p4t6 聚合 pin **10/10 @ 697**
- **repository integrity（§18.4）**：verify-zero-core **0 findings**（upstream 零 patch 零改写，node-pty = upstream 自有第三方 patch）；
  upstream test-use **porcelain 0 @ a66e470204**；私有 registry import 零命中（各任务 private-import 门禁 + 收束复验）；
  零 force-push（全程普通 push，int/master 历史线性追加）；无无关 feature work（每 PR diff 严格限于 §14 边界 + 证据）

## 11. Deferred decisions

### A2C-6 grep/glob
- status: **DEFERRED**（计划 §11.3：grep/glob = 内容披露面，超出 read-permission 覆盖；本轮按 KNOWN_SENSITIVE 处理 —
  出现在 permissions surface 即 FATAL，Blueprint 作者必须显式 `builtinToolDeny`）
- candidate replacement-plugin design: alpha.3 候选 = 独立搜索能力插件（source 审查后按 §7.8 进入 SAFE_UNMANAGED 或新增
  operation adapter）；不阻塞本轮收束

### A2C-8 + Blueprint UI
- status: **DEFERRED TO POST-ALPHA.4**（grant_instance / mutationEnvelope / durable grants / teamHardDeny /
  Blueprint 配置 UI / unmanaged-tool ack escape hatch / restrict() auto-hide 全部禁入本轮 — 各任务禁顺手实现清单已执行）

### TCM-M4 client 失败（非本轮范围）
- `team-creation-panel.client.spec.tsx:453`（admitMock 期望 0 实得 1）= test-infra-standardization 轮登记的
  spec/实现失配，**裁决待用户**（修复二选一未裁决）；本轮所有 client 触碰（仅 A2C-3 round-trip 路径）验证失败集未扩大

## 12. Alpha.3 readiness verdict

**GO**

alpha.3 基础（§21 链）已就位：actual tool surface → coverage complete / fail closed（A2C-2）→ static operation policy
exact/subtree/any（A2C-1/7）→ canonical effect identity（A2C-1/5）→ external hard last mile（A2C-4）→ accurate introspection
（A2C-3）。alpha.3 可在此之上增加 mutationEnvelope / self-frozen authority / Leader proactive mutation / durable permission
snapshots / grant_instance / runtime context + inject / grant lifecycle —— 不再承担 static coverage debt。

前置事项（非阻塞）：① TCM-M4 用户裁决；② 严格 Windows worker 上 live smoke 原样复跑（§9 差异记录）；③ A2C-6 候选设计评审。

---

## 附录 A — §20 Definition of Done 核验（全部 PASS）

| # | DoD 项 | 判定 | 证据 |
| --- | --- | --- | --- |
| 1 | pwsh 是正式 managed shell permission tool | PASS | `schema.ts:149` 7 名；a2c1 套件 |
| 2 | pwsh 与 bash authority 不串用 | PASS | 每工具 `<tool>-command-*` 镜像 closed reasons；a2c1 P2/P4 腿 |
| 3 | pwsh ask/deny live Windows PASS | PASS（Linux 适配等价） | §9 宿主限制 + live proof 42/42；Windows 差异记录 |
| 4 | Coverage Gate 只在 permissions-present mode 启用 | PASS | a2c2 strict-mode 腿 + legacy byte-for-byte 腿 |
| 5 | managed-but-undeclared tool 由 default 管理，不被 Gate 误杀 | PASS | a2c2 pwsh-undeclared PASS 腿 |
| 6 | known-sensitive unmanaged exposed → FATAL | PASS | a2c2 grep/subagent/web_fetch FATAL 腿 |
| 7 | unknown unmanaged exposed → FATAL | PASS | a2c2 foo_magic FATAL 腿 |
| 8 | builtinToolDeny 后的 hidden tool 不再触发 Gate | PASS | a2c2 hidden-sensitive 腿（real restrict seam） |
| 9 | Team tools 有明确 authority owner | PASS | a2c2 team_delegate 腿 + a6a strict surface = 全 Team-owned |
| 10 | MCP tools 只在 ownership 可证明时归为 managed | PASS | a2c2 MCP delta 腿（proven-mount 差集） |
| 11 | no unmanaged acknowledgement escape hatch | PASS | 实现无 ack 面（a2c2 report 禁项审计） |
| 12 | static allow 也受 live external hard last-mile check | PASS | a2c4 套件（static 翻转场景 fail closed） |
| 13 | ask allow 在 consumption/dispatch 前再次受 external hard check | PASS | a2c4 套件 + deviation D-2 位置 |
| 14 | read omitted limit 与 explicit 2000 fingerprint 不再假等价 | PASS | a2c5 T1/T6/T7（distinct digest + 双向 one-shot 不消费） |
| 15 | subtree schema 已实现 | PASS | a2c7 G14 语法腿（5 文件类工具 × 3 lane；shell 全拒） |
| 16 | subtree 使用 FileSystem.contains public seam | PASS | a2c7 real LocalFileSystem 段（真 contains 调用） |
| 17 | zero startsWith/opaque targetKey parsing authority | PASS | 专项审计 + negative fixture 反证 |
| 18 | subtree junction/symlink retarget fresh-resolution PASS | PASS | a2c7 G10 真实 symlink retarget 腿 |
| 19 | team_inspect_config 返回真实 operationPermissions | PASS | a2c3 11 腿（static/absent/常量源/determinism） |
| 20 | generic effective.permissions 不再被描述为 parameter authority | PASS | tools.ts description 更新 + payload 双字段 |
| 21 | cold resume 全部能力重建 | PASS | a6a 冷恢复腿 + a2c2 四 bind-path lifecycle 腿 |
| 22 | hostile pre-execute end-cap 不回归 | PASS | H1a 49/49（闭包 C1） |
| 23 | capability > operation-permission precedence 不回归 | PASS | issue2 两文件全绿（闭包 C1） |
| 24 | original alpha.2 suites 不回归 | PASS | A1–A6 + H1a/H3/H4/H5 闭包 C1 465/465 |
| 25 | full failure-set delta = no new deterministic failures | PASS | §1 diff 表 1:1（10 文件/20 测试）+ flake 裁决记录 |
| 26 | fresh typecheck/build/artifact gates PASS | PASS | §10（fresh install 后全绿，artifacts 1108） |
| 27 | CORE PATCH BUDGET = 0 | PASS | verify-zero-core 0 findings + upstream pristine |
| 28 | A2C-6 明确记录 DEFERRED | PASS | §11 |
| 29 | A2C-8 + Blueprint configuration UI 明确记录 POST-ALPHA.4 | PASS | §11 |
| 30 | closure-report 完成 | PASS | 本文档 |

**30/30 PASS → 收束条件全部满足；唯一 int→master PR 已开放供用户 merge。**
