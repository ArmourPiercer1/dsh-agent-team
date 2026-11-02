# Alpha.5 Sandbox-First Implementation Plan — 五阶段可执行开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`；逐任务 TDD、独立复审、真实证据再晋级。此处所有 `- [ ]` 是**待实施任务**，不是已完成项。
>
> **STATUS: ARCHITECTURE PoC CLOSED / IMPLEMENTATION-READY DESIGN, NOT ACTIVATED.** 2026-11-03。与 [ADR.md](./ADR.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)、[TOOL-ADOPTION-MATRIX.md](./TOOL-ADOPTION-MATRIX.md) 配套。此前本地 PoC 的主张须按实际 commit/log 独立核验，不能凭截图变 PASS。

**Goal:** 通过 Blueprint 限制各 Member 的**文件读、文件写、网络 allow/deny**；使原生 DSH 工具保持原样，通过 `service-mediated` 和 `os-confined` 两种可组合的通用执行方式接入，并给未来工具提供通用接入口。

**Architecture:** 以 `MemberCeiling ∩ ToolRestriction` 编译逐 Member、逐工具的全局 I/O 硬上界，重用 v4 工具限制词汇与 Alpha.4 Guard/ApprovalCase/Control、原生 `ToolDefinition`。Team 新增 MemberPolicy、InvocationAuthority 绑定和可信工具登记；在 `ctx.fs` / `ctx.web` / `ctx.subprocess` / PTY 等公共服务处接入受控 Provider 和 OS 进程沙箱。必要时有限 Fork 上游**基础设施插件**并于 Team Preset 排他替换，`CORE PATCH BUDGET = 0`。

**Tech stack:** TypeScript/Node 22+、pnpm 11、Cordis、Linux Bubblewrap/Landlock 等已验证 confinement backend、Vitest、现有 TestWorldFactory。Host 基线唯一 `tests/paths.mjs`：`0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`。

**Spec:** [ADR](./ADR.md) 与 [Architecture](./ARCHITECTURE.md)。旧方案 `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md` / `dev/engineering/current-authority.json` **仍为机器 active**，本 PR 不启动工作或更换权威。

## 0. 全局约束、测试纪律和执行分工

- **范围**：唯一 I/O 三维 read/write/network boolean；network destination ACL 的版本化扩展接口可留空，但本轮不得解析/承诺目的地白名单。没有独立 I/O 的原生内部状态工具只受现有调用准入。
- **不变量**：A5-NATIVE-01/02、A5-BOUNDARY-01、A5-FALLBACK-01、A5-GENERIC-01..04。不得修改、Fork、复制原生模型可见工具的业务实现，不得引入任何 `read/grep/web` 业务替代算法；只做最小、公开 API 优先的基础设施 Provider/Backend 扩展或受控 Fork。
- **信任边界**：可信工具摘要与实际绑定验证仅代表部署者选择，不代表恶意 JS 防绕过；`service-mediated` 必须标 `TRUSTED_ONLY`，`os-confined` 只有实测 OS 禁止才能宣称相应隔离。允许 hardlink 作为授权路径别名，但不开放未经授权的路径。
- **测试资源**：只用 `tests/deepseek-harness-test-use` pristine Host，`tests/homes/<world>`、`tests/paths.mjs` 端口租约和 `tests/world-factory`；先 `node tests/world-factory/provision-host-sandbox.mjs --check` 预检沙箱原生资产；绝不影响 `:3080`、稳定 DSH_HOME、冻结源码或其他 lane 的 World。`ENV_BLOCK` 不计 PASS。
- **版本/迁移**：Blueprint 运行版本集已为 `[3,4]`（PR #324）；v4 `toolBindings` **仅文档解析/哈希生效，I/O 执行未生效**。保留 v3/v4 原意和 hash；复用 v4 `toolBindings[].io`，仅新增不可替代的 Member ceiling 载体/身份引用和编译接线，必要的封闭 Schema 版本增量另按最小变更处理，不预设 v5。v4 的 `owner` 是工具来源（`authoringOwner`），不是 Member；`ask` 和 `network:restricted` 不得隐式变成硬上界扩大或布尔许可。现行 `AGENTS.md` 禁 vendoring 规则与有限基础设施 Fork 的新裁决冲突，只能由**独立 Authority Migration PR** 在启用前修订；本 Draft 不自行修改生效权威。
- **Fork 纪律**：优先继承公开上游类和替换公开 Provider，必须 Fork 时先提交 `FORK-DECISION`（包/入口、需改的接缝、上游 SHA、最小 diff、许可证、Owner、跟踪更新/撤回机制）；不能为了减少 Fork 数重写工具或手工套一份简化 SubprocessRuntime。
- **任务所有权**：Policy/Schema Owner；Service Adapter Owner；OS Sandbox Owner；Native Tool Integrator；Test/Security Reviewer；唯一 Authority Writer。一个任务一 branch/worktree/Writer；不同人可在冻结接口后并行 Service 与 OS 分支，不能并发写 `host.ts`、`agent-bindings.mjs`、`cordis.patch.yml`、`current-authority.json`。
- **工作流**：每个任务按 RED 失败测试 → 最小实现 → GREEN → 类型检查 → 受影响回归 → 独立 Review → commit/PR；所有真实 Host 操作必须有运行记录、权限决策与独立副作用 Oracle。完成前独立 Reviewer 检验没有新工具执行体。
- **通用命令（仅在任务实施时执行）**：`pnpm exec vitest run <exact-test-files>`、`pnpm -r typecheck`、`pnpm -r build`、`pnpm check:artifacts`、`node tests/world-factory/u5-canary-runner.mjs --suite <new-suite-name> --line <line> --evidence <dir>`；所有 suite 名在对应任务创建后才有效。对于 doc PR 不要求虚称这些命令已运行。

### 架构 PoC 收口与开发启动边界（2026-11-03）

**PoC 已结束，不再追加独立“完整机制验证轮”。** 已经有受信 Service、原生 `grep/glob` 子进程、Web 布尔限制、原生持久 Bash 零复制 wrapper 和 OS profile 的可复查技术纵切。原始证据：[综合报告](https://github.com/ArmourPiercer1/dsh-agent-team/blob/18e3823e3/dev/agent-workflow/evidence/a5x-sandboxpoc-20261101/POC-RESULTS.md) · [B2R2](https://github.com/ArmourPiercer1/dsh-agent-team/blob/18e3823e3/dev/agent-workflow/evidence/a5x-sandboxpoc-20261101/B2R2-DELTA-RESULT.md) · [IOAXIS](https://github.com/ArmourPiercer1/dsh-agent-team/commit/9b261060c) · [WRITEONLY `9c56f94a1`](https://github.com/ArmourPiercer1/dsh-agent-team/commit/9c56f94a12cd241ffdb8c27eaab0696813f0dbff)。

| 已有证据 | 能继承的结论 | 必须在实施阶段完成 |
|---|---|---|
| Service-mediated / bwrap / wrapper | 公开接缝可行、保留原生工具且零 Core patch；受信 JS 的旁路不在恶意代码隔离保证内 | P1 真实 Member×Tool/Provider 绑定；P2 原生效果 |
| IOAXIS（19/19 + 12/12） | bwrap 可做受限挂载及有限路径掩码，公开 `resolve + confine` 能消费加性 `io` | 任意读 allowlist 不得由 `--ro-bind / /` + 掩码冒充 |
| WRITEONLY（15/15 + 13/13） | VFS `0300/0200` × bwrap 在固定权限样本下出现 EACCES，且原生 Bash 接缝成立 | 同 UID `chmod` 和新文件读位意味着该方案不是任意命令的硬上界；严格模式首选 Landlock |
| Landlock WSL2 env probe | 本测试宿主 `add_rule=EBADF`，判 `ENV_BLOCK` | 在支持的 Linux 执行环境中于 P1/P2 做能力检测与 C2 真效果验收，**不是新 PoC** |

**停止规则**：P1–P5 中发现的 Member 绑定、旧 PTY、异常/撤销、非 Team 兼容和 Landlock 后端具体缺陷，直接成为实现/修复任务。若本机缺所需 Landlock 能力，则仅拒绝无法被现有后端强制表达的策略，不退化为更宽的 bwrap 或 VFS 模式。只有实际发现公开接缝无法传递受信策略且最小基础设施 Fork 也不可用，才可提出具名的新技术阻塞；不得据此重新开启全架构 PoC。

### 五个特别容易遗漏的 Review Focus

| 风险 | 谁负责补测 | 预期 |
|---|---|---|
| 受控 Provider 的 scope 在注册时捕获了全局 `ctx`，导致 Member A 的服务供 Member B 使用 | P1-05/P2-01 | 真实双 Member 串行+并发交叉访问拒绝 |
| `ctx.subprocess.spawn()` 的**同步**返回值被异步 `sandbox.confine` 误改，破坏原生 grep/取消 | P1-07/P2-03 | 保持同步 `SubprocessHandle`；原生 stderr/exit code 和取消完全对照 |
| 持久 Bash 启动后 Blueprint 缩权或一次性批准导致越界延续 | P1-08/P2-04/P4-04 | 旧域排空/终止，新域重新授予；不允许就地扩权 |
| 新的网络 deny 仅屏蔽 Web Provider，却让 OS 进程通过 DNS/UDP 等联网 | P1-07/P2-05/P4-03 | OS 真实数据面负控；后端无法证实则 UNSUPPORTED |
| 同一调用 Alpha.4 已批准但执行 Provider 使用了另一 Member/Tool/代际，或 Provider applied 却未 consulted | P1-04/P2-01/P3-00/P4-05 | 联结 `memberId/toolIdentity/callId/revision`；工具绑定、Provider consulted 与真实 I/O Oracle 同调用成对出现 |
| 合法目录下硬链接被原受控 FS 的 `nlink===1` 拒绝，或放宽时意外影响 Team 控制面完整性 | P1-03/P2-01/P4-02 | 普通 Member hardlink 经授权路径可用；内部 authority/ledger 保持原保护 |
| bwrap 掩码/文件 owner 模式被误当任意读 allowlist/只写硬上界 | P1-07/P2-04/P4-01 | 真实 Landlock 或等价不可由被控进程放宽的后端；`chmod` / 新文件负控；不支持则拒绝 |
| wrapper 在 `danger-full-access` 时可能走原生裸 argv 早返回 | P1-06/P1-08/P2-04 | 策略封顶发生在该早返回之前，任何受管调用都不裸执行 |

---

## P1 — 基础体系与可装配后端

**目标**：确定统一策略、调用权限、可信工具、两个通用 Provider 的最小 ABI 和实装路径。不得把“框架完成”解释为工具功能通过。

**对应架构**：Policy Compiler / Invocation Binder / Trust Registry / Service-Mediated / OS-Confined / Preset binding。**入口**：本 ADR 设计获审；重读已有 PoC 原始证据，列出 NEED-RETEST，而不是重复做旧 PR #26 的 `disable+insert` 装配证明。

### P1-01 — v4 复用与最小 Member 上界增量（先比较，后冻结）

**文件**：优先复用 `packages/domain/blueprint/src/blueprint-v4.ts`、`packages/domain/vnext-field-mapping/src/v4-authoring-map.ts`、`packages/domain/blueprint/src/types.ts`；新测试 `packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts`。**不得将 `blueprint-v5.ts` 预设为必交项**。确需版本增量时，独立评审并最小新增，旧 v3/v4 哈希/解析不变。

- [ ] 选真实 v4 Blueprint 2–3 份，构造 Member A 只读 A/只写 B、Member B 使用同一 Bash 但只读 C/只写 D、同 Member 的 read/grep 工具进一步收窄、Leader 与未知 CLI 均受 Member 上界四种样例；记录现有 v4 + Alpha.4 能表达/不能表达的逐字段证据。
- [ ] RED：用 `pnpm exec vitest run packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts` 验证 A/B 不能串权、工具级 `allow all` 不能扩大 Member、缺项不能静默扩权、v4 网络 `restricted` 不自动当布尔 allow/deny、旧 v4 文档/哈希不漂移。
- [ ] 按已启用的 v4 实际模型核对：`toolBindings[].owner/name` 标识**提供者来源/工具名称**，不代表 Member，禁止把 `owner='A'` 的语法可接受性解释为 Member A 的权限已绑定；MemberIdentity 必须由受信 TeamDomain 引用闭合。只新增确实缺少的 Member 全局上界作者载体，不重建 v4 词汇。
- [ ] v4 `io.ask` 保持既有声明/审批语义；硬上界变更只能走明确授权的策略 revision，不能将 `ask` 或一次性工具调用批准默认为拓宽 hard ceiling。不可兑现的旧 `network:restricted` 以 `IO_POLICY_UNSUPPORTED`/拒绝表达，不静默转布尔。
- [ ] 只有在缺少 Member ceiling 表达时，增加**最少作者字段和映射**，重用 v4 三轴词汇/路径匹配/工具绑定；若封闭 Schema 需要新版本，只做加法式版本与显式迁移，不构建完整第二套语言。
- [ ] GREEN + `packages/domain/test/a5sr2-blueprint-v4-grammar.test.ts`、`a5sr3-default-deny-mapping.test.ts`、`a4p7-v3-identity-binds-grammar.test.ts` 回归；独立审查“增量是否必要”和默认拒绝含义。
- **Gate G1.1**：明确 Member × Tool 两轴的执行上界与旧语法可复用范围；P1 之前不得开始大规模 v5 语法/迁移实现。

### P1-02 — MemberPolicy 编译器

**文件**：新 `packages/runtime/member-io-policy/src/{types,compile}.ts`，测试 `packages/runtime/test/a5sf-member-policy.test.ts`。

**接口产物（本项目内部的概念接口，签名可在 P1 PR 冻结；不可作为新 Blueprint 语法）**：

```ts
type MemberPolicy = {
  memberIdentity: string;
  revision: string;
  read: PathRuleSet; write: PathRuleSet;
  network: { access: "allow" | "deny" };
};
type ToolIoRestriction = { bindingIdentity: string; read: PathRuleSet | "no-additional-narrowing"; write: PathRuleSet | "no-additional-narrowing"; network: "allow" | "deny" };
type EffectiveIoPolicy = { memberIdentity: string; toolBindingIdentity: string; invocationId: string; policyRevision: string; read: PathRuleSet; write: PathRuleSet; network: { access: "allow" | "deny" } };
type CompileInput = {
  trustedMember: MemberIdentity;
  boundBlueprint: BoundBlueprint;
  effectiveAuthority: Alpha4EffectiveAuthority;
};
function compileMemberPolicy(input: CompileInput): MemberPolicy;
function compileEffectiveIo(member: MemberPolicy, tool: ToolIoRestriction, invocation: InvocationAuthority): EffectiveIoPolicy;
```

- [ ] RED：成员 A/B 不交叉、同 Member 的不同工具约束取交、工具 allow-all 不能越 Member ceiling、纯写不隐含读、目录/单文件、无网络策略拒绝、过时代际/无 member identity 拒绝；`pnpm exec vitest run packages/runtime/test/a5sf-member-policy.test.ts`。
- [ ] 实现最小无副作用编译，不复制 Alpha.4 authority calculation；拒绝来自不受信 argv/cwd 的身份推断。
- [ ] GREEN、`pnpm -r typecheck`、存量 Alpha.4 生效策略回归；commit。
- **Gate G1.2**：同一次 Blueprint/Overlay 有唯一可审计策略结果与稳定 revision；编译器不自行授予审批。

### P1-03 — 授权路径/硬链接语义与 Provider 能力

**文件**：新 `packages/runtime/member-io-policy/src/path-rules.ts`，测试 `packages/runtime/test/a5sf-path-rules.test.ts`；候选上游 Provider `@deepseek-ai/dsh-fs-sandbox` / `ctx.fs`。

- [ ] RED：exact/subtree 语义、路径前缀 `/work/a` 不覆盖 `/work/ab`、symlink 出界、合法硬链接可经允许路径操作、禁止路径直接拒绝、原生 write/edit 需要读时因无读权限拒绝；`pnpm exec vitest run packages/runtime/test/a5sf-path-rules.test.ts`。
- [ ] 复用受控 Provider 自己的路径解析和文件身份 API，而非 Node 字符串前缀；将允许硬链接写入产品规则，不能删除 control-plane 的 `nlink` 完整性要求。
- [ ] GREEN 并证明提供给 `ctx.fs` 的实装方法覆盖 `resolve/contains/stat/lstat/readText/streamText/readBytes/readByteRange/listDir/watch/writeText/editText` 的适用路径；commit。
- **Gate G1.3**：明确“path-based”强弱范围/别名后果，未知 Provider 能力拒绝而非退回全部读权限。

### P1-04 — Invocation Binder + Trust Registry

**文件**：新 `packages/runtime/member-io-policy/src/{invocation,trust-registry}.ts`；测试 `packages/runtime/test/a5sf-invocation.test.ts`、`a5sf-trust-registry.test.ts`。复用 `packages/runtime/tool-admission/`、`packages/runtime/src/plugin/live/pa-mount-registry.mjs`。

**接口**：`bindInvocation({member,callId,policyRevision,approvedOnce,lease})` 返回不可转移的调用能力引用；`verifyTrustedBinding({packageDigest,dependencyDigest,scope,definitionGeneration,toolName})` 仅核身份与装载代际。不得新建第二 `GrantLedger`。

- [ ] RED：双 Member、同 Member 并发独立扩权、单次消耗后不可重放、撤销/冷启动、HMR 更换 Definition 后失信、相同工具名不同 Scope 不共享信任。
- [ ] 用现有 Alpha.4 批准结果作为受信输入，显式调用生命周期和拒绝态；加载时做摘要校验，调用时检视绑定代际，不逐调用全量 hash 文件树。
- [ ] 运行两新测试及 `packages/runtime/test/a4p3-approval-case.test.ts`、`a5p2-grant-oneshot.test.ts`；审查没有第二权限账本；commit。
- **Gate G1.4**：一次性权限绝不遗留并发/后续调用；摘要只代表信任，不声称恶意工具不可旁路。

### P1-05 — Service Realm/Provider 绑定

**文件**：新 `packages/runtime/team-services/src/{install,fs,web}.ts`；`packages/runtime/test/a5sf-service-install.test.ts`；集成时由唯一 Writer 接 `agent-bindings.mjs` / `host.ts`，不允许各家族手工改中心工具体。

- [ ] RED：同一 Host 装载两个 Member 的原生 tool-fs，验证注册期 `ctx.isolate()` 和实际调用 service identity；独立成员不共享可写/可读 Provider；安装失败应拒绝 Team 而普通 DSH 不受影响。
- [ ] 建立受信服务装配 + 导出绑定收据。通过 `ctx.fs` / `ctx.web` 公开接口而非私有 import；必要基础设施 Fork 附有独立 `FORK-DECISION`。
- [ ] GREEN、`packages/runtime/test/team-spill-local-composition.test.ts` 先例回归、原生工具绑定审计；commit。
- **Gate G1.5**：真实工具注册 Scope 已被证实；仅“调用 `ctx.isolate()` 成功”不算通过。

### P1-06 — Provider/Backend 排他替换及发布路径

**B2-R 已有条件性证据**：公开 `terminal-bash.apply` + wrapped Context 的零复制方式，在测试会话中实现了 OS 写入根限制。优先将其发展为可信的 Team Preset 绑定，而不是先 Fork `terminal-bash`。具体残余和任务见 [DELTA-POC-AFTER-B2R.md](./DELTA-POC-AFTER-B2R.md)；仅证明写侧、不是读写网络整套已完成。

**文件**：新 `packages/runtime/team-services/src/manifest.ts`、测试 `packages/runtime/test/a5sf-provider-composition.test.ts`；实施时调整 `cordis.patch.yml`、根 `package.json` `exports/files` 与编译产物（需唯一 Integrator）。

- [ ] RED：`disable+insert` 最终恰一个受控 Provider、重复插件 ID/未命中 patch 时拒绝、Team 使用 `team-shell` 而普通 Host 使用原版 `shell`；真实 `dump-config` 与启动实例一致。
- [ ] 参照既有 `team-spill-local` / PR #26 实例；先通过继承/公开接口注入，不能成立的局部 Fork 在新的 `packages/runtime/team-sandbox/forks/` 保存上游来源和最小 diff；不得修改 Host checkout。
- [ ] `pnpm smoke:composition`、`pnpm check:install-manifest`、`pnpm check:artifacts`、测试双会话装配；commit。
- **Gate G1.6**：配置错误不产生半受控 Team；普通 DSH 与原生 `spillStore` 回归不受影响。

### P1-07 — OS Runner / Subprocess 公共面

**文件**：新 `packages/runtime/team-sandbox/src/{profile,runner,subprocess}.ts`；测试 `packages/runtime/test/a5sf-os-runner.test.ts`、`a5sf-subprocess-contract.test.ts`。复用/评估现有 `packages/runtime/sandbox-provider/`、上游 `sandbox-local` / `subprocess-local`。

- [ ] RED：按 read/write 独立白名单生成执行 profile；在受支持后端分别验证允许读 A、拒读 B、允许写 B、拒写 A、**只写不读**（含已有与新文件）、路径/子树粒度、符号链接、`chmod` 尝试，以及实际 TCP/UDP/DNS 禁网；无能力时不得启动裸进程。同步 `spawn():SubprocessHandle` 的 stdin/out/err/`collected`/`done`/`terminate`/`waitForExit` 不退化。
- [ ] 先走公开 `sandboxPolicy.resolve` + `ctx.get("sandbox").confine` 代理，规则仅在 Team 受限执行路径消费；仅遇具体接缝缺失才有限 Fork 基础设施。**必须在原生 `danger-full-access` 裸 argv 早返回前完成 ceiling clamp**。不复制原生 `rg`/Node/Bash。
- [ ] Linux 实现优先组合 bwrap（mount/执行依赖、可表达的子集、`--unshare-net`）和 Landlock FS（独立 READ_FILE/READ_DIR/WRITE_FILE/MAKE_REG 等；涉及 TRUNCATE 语义要求 ABI ≥3）。在实际目标系统探测 ABI、`add_rule` 与 `restrict_self` 的**真效果**；本 WSL2 Landlock EBADF 标 `ENV_BLOCK`，不作为部署 PASS。系统运行依赖只在受信路径可读，用户秘密不能经全根 `--ro-bind / /` 漏出。
- [ ] `0300/0200` VFS owner 位实验仅作为有条件 PoC，不允许成为通用硬上界 fallback：同 UID owner 可 `chmod`，新建文件可能可读；bwrap mask 也不能冒充 read allowlist。不支持所需完整语义时明确 `UNSUPPORTED` / fail closed，允许已证明能兑现的独立子集。
- [ ] GREEN、独立 OS 内容/网络效果 Oracle、`pnpm -r typecheck`、同版本 Host 原生对照；保留 backend/profile/ABI 与 consulted trace；commit。
- **Gate G1.7**：至少一种真实后端对其声明支持的完整限制提供正反效果证据，`spawn` 签名兼容，无法兑现的环境/策略明确拒绝；**不因本机 WSL2 不支持 Landlock 再启动 PoC**。

### P1-08 — PTY / 持久进程生命周期

**新增硬门**：零复制 wrapper 的测试会话名 `includes` 映射和 `key===undefined → return base` 只用于 PoC，不能进入受限生产路径。需由真实 TeamDomain Member 绑定计算有效 `MemberCeiling ∩ ToolRestriction`，并记录 backend/exec-domain 的 `policyRevision`；不存在有效绑定或代际不相符时前置拒绝，不能回到默认宿主 SandboxPolicy。

**文件**：新 `packages/runtime/team-sandbox/src/terminal.ts`；`packages/runtime/test/a5sf-terminal-lifecycle.test.ts`，条件性最小 Fork `@deepseek-ai/dsh-terminal-bash` 或 `@deepseek-ai/dsh-bash-sandbox` 的**Backend**代码。

- [ ] RED：从受信 TeamDomain MemberInstance/ToolBinding 取得身份（不是 PoC caps 文件/label/argv），`spec.owner.session` 不可伪造；持久域记录创建时有效的 policy revision / backend 与 PTY PID。每次复用命令先比对 revision，旧域在收紧/撤销后拒绝新命令并 kill/drain 或重建；`danger-full-access` 不破上界、单次批准不变成永久 PTY 扩权。**不要求每条命令重启正常的同代际 PTY**。
- [ ] 按原生 `backendType` 公开配置优先装入 `team-shell`；保持 `spawnTerminal`、session startup、信号/窗口/输出/关闭/回收机制。
- [ ] GREEN、真实 PTY 测试与普通 `shell` 对照；commit。
- **Gate G1.8**：PID/子孙进程/终端 session 的边界可观测；停机收束有独立收据。

### P1 回收工作包（R1–R5，2026-11-02 用户裁决并入）

P1 不重建既有基础能力；逐项登记见 `dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md`，规约见 `TRANSITION-PLAN.md` §6。

| 工作包 | P1 内的具体落点 | 状态 |
|---|---|---|
| R1 审批治理接管 | P1-02 只消费 `Alpha4EffectiveAuthority`/`approvedOnce` 作为输入；P1-04 一次性能力不可重放、审批不提升硬上界；不新建第二审批/第二策略计算 | 单元证据已入 P1-02/P1-04 |
| R2 工程基线继承 | 不新增权威指针/测试启动器/CI；迁移走独立 Authority Migration PR（`publish`→`switch`，含回滚演练） | 分支内已验证指针/AGENTS/active计划/CI 未改 |
| R3 原生接线与审计 | P1-04 trust registry 提供绑定代际核验；P1-05 提供安装收据；单次调用证据链（member→definition→callId→revision→approval→provider/OS→effect）在 P2 落地 | 机制就绪，链测试 P2 |
| R4 通用执行设施 | P1-07 复用 `sandbox-provider` launcher/租约/FD，不迁移工具业务；后端能力每次实测，不可兑现即拒绝 | P1-07 已含真实正反效果 |
| R5 历史资产转换 | 旧 fs/process/search/web 工具体转回归输入；历史矩阵 PASS 不计入 G2–G4 | P2 开始 |

**P1 总 Gate（G1）**：G1.1–G1.8 严格报告 PASS/CONDITIONAL/ENV_BLOCK，不要求工具族穷尽。关键进程和 Provider 的基础正负控为真，旧 Host checkout/稳定实例不变；没有接受全新 Feature Family 执行器。P1 可按先冻结 Compiler/Invocation/Mode ABI 后将 service 和 OS 两路并行实现；**不提前并行改共享 host/glue/patch**。

---

## P2 — 每种执行路径选代表工具，验证原生正向与基础权限

**目标**：首个真实“原生 ToolDefinition → Team Provider → 实际 I/O → 原生输出”纵切，每个机制至少一个允许与拒绝实证。**入口**：对应 P1 模块 Gate 通过；可逐条交付，不等待不相关模块。

| 任务 | 代表工具 | 公共执行接缝/测试文件（拟新增） | 正向测试 | 最低负控与 Gate |
|---|---|---|---|---|
| P2-01 | 原生 `read` | `ctx.fs`；`tests/world-factory/suites/a5sf-read.mjs` | 大于 10MiB 文件的中间行窗口；和原版结果一致，保留流式处理 | 禁止路径正文不可读、Member A/B 不串权、硬链接按新契约可读 |
| P2-02 | 原生 `write` | `ctx.fs`；`…/a5sf-write.mjs` | 允许路径原生创建/覆盖，保留原子替换和版本校验 | 禁写路径真实字节未变、写不自动获读权限 |
| P2-03 | 原生 `grep` | `ctx.subprocess.spawn`→OS `rg`；`…/a5sf-grep.mjs` | 匹配/不匹配 exit 0/1、非法正则、结果裁剪、取消 | `rg` 禁读路径真实 OS 拒绝，非原生字符串过滤，原工具未改 |
| P2-04 | 原生持久 `bash` | `ctx.terminals`→`team-shell`；`…/a5sf-bash.mjs` | 同 PTY 多命令、cwd、前后台、信号/超时 | 受支持 Linux 后端真测独立读写与只写不读；同 UID `chmod`/新文件不得越界；禁网、跨代际旧 PTY 拒用，不把 VFS PoC 当通用 PASS |
| P2-05 | 原生 `web_fetch` | `ctx.web`；`…/a5sf-web.mjs` | 本地批准的 mock server fetch、超时/取消/转换不退化 | network=deny 在 HTTP 前拒绝，普通 DSH fetch 不受影响 |
| P2-06 | 原生 `run_code/PTC` | Node 子进程 + 受控 Host bridge；`…/a5sf-ptc.mjs` | 原本支持的运行/嵌套调用正控 | 直接 Node 文件/网络受 OS 限制，IPC 无可用的 Host 代发旁路 |
| P2-07 | 全新第三方 CLI | `os-confined` 通用 launcher；`…/a5sf-new-cli.mjs` | 换一个未命名到 Team 源码的命令仍可执行 | 权限拒绝生效；增加新 CLI **零专用 ToolDefinition 执行体** |

每条 P2 任务必须在同一 invocation 中联结 Alpha.4 允许/拒绝、`MemberCeiling ∩ ToolRestriction` 编译结果、实际 Provider/Backend 的 `consulted` 记录和独立效果 Oracle；任一缺失均不算通过。审批放行而 I/O 因硬上界拒绝允许存在，但必须来源一致、诊断正确。

每条 P2 任务采用相同执行步骤：**[ ] RED 实测**（初始 Provider 尚未绑定时预期拒绝或负控植入导致失败）→ **[ ] 最小接线** → **[ ] C1 正向+拒绝** → **[ ] C2 真实 Host Oracle 正向+拒绝与原生对照** → **[ ] 独立 Review** → **[ ] commit**。命令：`node tests/world-factory/u5-canary-runner.mjs --suite <a5sf-name> --line a5sf-p2-<id> --evidence <task-dir>`（先创建 suite/使用 WorldFactory 支持的加载方式；不复刻已有 launcher）。

**B2R2 / IOAXIS / WRITEONLY 后的 P2-04 验收**：原生 session-mode `danger-full-access` 的钳制已有测试证据，不重跑作为新 PoC；实施须换成真实 Team Member 绑定、受支持后端的独立读写/只写不读、旧 PTY 代际拒用及投影一致性。bwrap 的 mask 子集不能宣称通用 read allowlist；VFS `0300/0200` 的固定权限正控不替代 `chmod`、新建文件负控。Landlock WSL2 ENV_BLOCK 不判成功，所需机制在其他活跃 Linux 内核纳入 P1/P2 实施 C2。详见 [收口记录](./POC-PLAN.md)。

**P2 总 Gate（G2）**：`read/write/grep/bash/web/ptc/new-cli` 至少以覆盖相应机制的代表 case 提交可复查正向+负控，允许明确声明 OS 整类环境阻断但**不能把未测能力当 PASS**。其中服务路径与 OS 路径均须有真实原生成功和内核/Provider 拒绝，不得只凭单元桩。缺一个必交机制不能进入该机制 P3 批量接入。

---

## P3 — 原生工具逐项接入，首先确保原生行为不退化

**目标**：工具原样接入、使用相同的 Provider，不开发工具业务替代体。**入口**：对应 P2 代表机制真实 Gate 通过，未通过的家族不得通过“自己做一个等价工具”解锁。

### P3-00 — 原生来源清单与分类（先执行）

**文件**：新 `docs/plans/memo/alpha5-sandbox-first-20261101/TOOL-ADOPTION-MATRIX.md`（本 PR 初表）、实施时 `tests/kits/a5sf-native-inventory/`、`dev/agent-workflow/evidence/a5sf-p3/inventory/`。

- [ ] 从**真实 pinned Host 的 ToolRuntime schemas、preset、动态 MCP/插件注册**导出来源/工具名/Definition provenance，而不是用历史固定清单当全部工具集合。
- [ ] 标注 `service-mediated` / `os-confined` / 组合 / 不具有相关 Member I/O / remote / UNSUPPORTED；每行绑定实际 Provider 与测试用例；动态新来源默认 NOT_TESTED。
- [ ] 对照旧 `packages/tools/families/manifest.json` 和 Team 权限接管，不能允许同名 Shadow 业务体覆盖原版后还标 `dsh-native`。
- **Gate**：完整清单有来源锚点与实际 bindings；已知未支持项可单独列出，不能隐式 bypass。

### P3-01 — FS 工具组

**工具**：`read`、`write`、`edit`、`read_image`、`str_replace_editor`（若在当前 Host 提供）、依赖受控 FS 的文档/技能读取。**路径**：`ctx.fs` + 附件/图像额外可信服务。**测试**：新 `tests/world-factory/suites/a5sf-fs-native.mjs`。

- [ ] 各原生 Definition 的 schema/参数/输出/图像格式与基线对照；大小文件/二进制/不存在/文件版本冲突、watch（若存在）。
- [ ] 用同一受控 `ctx.fs`；`read_image` 若通过 attachment store 应单独识别该服务，不能假装全部 I/O 已覆盖。
- [ ] 各工具一个正控、一个基础权限拒绝与独立内容/文件效果 Oracle，且提供同一次调用的 `consulted` 决策记录；没有额外 `fs-family executor` 新代码。
- **Gate**：原生正常功能无退化；未约束的 host-owned artifact 面具名标注。

### P3-02 — 搜索与进程组

**工具**：`grep`、`glob`、瞬态 `bash`/`pwsh`、持久 `bash`/`pwsh`、`run_code`、`terminal_*`、`lsp`（按真实注册结果有条件包含）。**路径**：`ctx.subprocess`、`ctx.shell`、`ctx.terminals`、`ctx.sandbox`。**测试**：`…/a5sf-search-process.mjs`。

- [ ] 一工具一条原生正控 + 异常/取消/输出裁剪；保留 exit code、Spill、PTY 与过程状态，绝不把多轮 Bash 改造成每次新 shell。
- [ ] 一工具一条禁读/写/网络最相关基本负控与真实 Provider `consulted` 证据；`lsp` 按连接/会话和子进程实际路径判定，无法受限则 UNSUPPORTED。
- [ ] 对临时 Shell 和持久 Shell 分别验证；`danger-full-access` 不能超出 Blueprint MemberPolicy；非 Team 原生 Shell 仍正常。
- **Gate**：原生功能与实际进程边界都能复核，未覆盖进程型工具不是“默认绿色”。

### P3-03 — Web 与外部提供者

**工具**：`web_fetch`、`web_search`、MCP 标准工具与未来网络型 CLI。**路径**：`ctx.web` + OS-confinement + remote-provider boundary。**测试**：`…/a5sf-web-native.mjs`。

- [ ] 原生 fetch/search 的 provider 自动选择、多 provider 歧义、timeout、错误、结果展示与上游对照。
- [ ] Web Provider 请求的 network allow/deny；stdio MCP 本地 subprocess 可 OS 限制；remote MCP 的远端效果不是本机 OS 能限制，声明 TRUSTED_DELEGATION 或 UNSUPPORTED。
- [ ] 新增未知可信 Web Provider 可以通过受信服务接入（审核默认不宣称任意网络 Node 旁路可防）；不可为每个搜索引擎自写 Team 网络执行器。
- **Gate**：网络布尔控制前置生效、Provider 选择没有静默改变，外部执行边界标注诚实。

### P3-04 — 不具有直接数据面 I/O 的工具与未知工具

**工具**：`goal` / `todo` / `jobs` / `present` / `ask` / `skill` / `session` 等，依 **实际** tool/service 轨迹分类；用户新增未知工具。**测试**：`…/a5sf-state-unknown.mjs`。

- [ ] 调用授权继续通过 Alpha.4；不因模型中“无文件参数”而假设工具没有读取用户文件（`present`、`skill` 等可能读取附件、磁盘/远端）。
- [ ] 无 I/O 工具仅维持调用准入；受信宿主服务可能的内容读/写/网络经过共同 Provider 或作为 trusted host delegation 标注；不重做 Goal/Jobs 业务逻辑。
- [ ] 未知 CLI 通用 OS Runner 正反控；未知 JS 直接 `node:fs` 负控用于**披露 Trusted Realm 不抗恶意**，而非强制开发完整 Tool Host。
- **Gate**：每工具列明实施/不实施/UNSUPPORTED 的理由，用户可看到为何不必再造 Family 执行体。

### P3-05 — 旧工具 Family 的分阶段接管/退役

**文件**：`packages/runtime/src/plugin/live/team-tool-plane.mjs`、`family-assembly.mjs`、`packages/runtime/governance-center/contribution-schema.ts`、`packages/tools/families/manifest.json`（**只能在指定唯一 Integrator 变更**）；测试 `packages/runtime/test/a5sf-no-native-shadow.test.ts` 等新测试。

- [ ] RED：受信原生 Definition 必须实际执行原生 body；若旧 Team 自研 read/grep 或 web 被同名派送，检测失败；若同名未受控原生 ride-through，检测拒绝。
- [ ] 在真实接线已经绿色后，用**通用原生 Provider/绑定描述**替换 `family-body|named-bridge` 作为默认“受控工具执行”形态。审批 Kernel 保留，不生成第二 Ledger，不提前删除存量 Family 代码/历史报告。
- [ ] 更新 manifest 的作用域/实际 source digest，而不是将旧 `family-owned` 映射成伪 `dsh-native`；禁用老工具体必须可回滚并且不允许借回滚默许无沙箱执行。
- [ ] GREEN + `pnpm -r typecheck`、`pnpm -r build`、`pnpm check:artifacts`、受影响旧 Alpha.4/5 回归；commit。
- **Gate**：没有双重执行/双重 Grant，原生 Definition 实际生效且输出匹配；变更范围以具体失效规则逐条说明。

**P3 总 Gate（G3）**：承诺的原生工具来源清单完成正向回归及每工具**最小拒绝测试**；不具有相关 I/O 的工具不强制进沙箱；UNKNOWN/remote 列为显式 CONDITIONAL/UNSUPPORTED；所有确认可用原生工具代码保持不变。

---

## P4 — 全原生工具读/写/网络与权限生命周期验收

**目标**：从“某代表工具可以管”推进到“每个承诺接入的工具与每个承诺 I/O 类别未观察到越界”。**入口**：G3 对目标工具行已有正控与最小拒绝。

| 任务 | 新增测试套件/验收维度 | 必须实测断言 |
|---|---|---|
| P4-01 FS 授权矩阵 | `tests/world-factory/suites/a5sf-readwrite-matrix.mjs` | read 允许/拒绝、write 允许/拒绝、读写分离；文件/目录/新建/覆盖/删除/rename（适用工具）；只写目录的 `chmod` / 新文件/现有 FD、跨工具/双 Member 不串权；所需后端无效时拒绝 |
| P4-02 路径与硬链接 | `…/a5sf-path-alias-matrix.mjs` | 授权硬链接可读/可写；未授权路径不能直接打开；软链接出界拒绝；路径前缀、rename/目录替换/相对路径的约束真实可见；Team authority 的保护不变 |
| P4-03 Network deny/allow | `…/a5sf-network-matrix.mjs` | Web request allow/deny、OS 真实 TCP/UDP/IPv4/IPv6/DNS/代理/重定向；无法运行 netns 时不伪称通用禁网；Host LLM/control-plane 独立且不代发 |
| P4-04 一次性审批和撤权 | `…/a5sf-grant-revocation.mjs` | 同 Member 两并发调用只有获批的一次扩权；后续不继承；持久 Bash 权限缩紧旧进程排空/销毁；取消不等于确认终止 |
| P4-05 绑定/运行时更新 | `…/a5sf-binding-generation.mjs` | HMR/源摘要/同名替换/不同 Realm/重启/cold resume、Provider 不可用/旧 SHA 的执行一致性；失败无未受控 fallback |
| P4-06 Host 兼容 | `…/a5sf-nonteam-compat.mjs` | 普通 DSH 非 Team read/bash/web 不受侵害，出错时没有一个替代 Provider 影响全局用户；`spillStore` 回归 |
| P4-05A 双平面同调用一致性与实际消费 | `tests/world-factory/suites/a5sf-cross-plane-consumption.mjs` | 同一 `member/tool/call/revision` 从 Alpha.4 → Provider consulted → 独立 I/O oracle 全部对齐；故意换 Member/漏咨询须 RED；额外验证模型侧原生 session-mode 投影与执行侧受管上界一致（包括 danger clamp），批准调用但被 I/O ceiling 拒绝须可解释 |
| P4-07 性能与运行资源 | `tests/kits/a5sf-benchmark/` | 对照原生 vs service-mediated vs os-confined leaf，场景 1KiB read、10MiB 窗口、1K 文件 grep、持久 Shell、并发 1/4/16，报告 p50/p95/p99、RSS、CPU、启动次数、Host 初始化分摊；无自定“10ms”假保证 |

每条 P4 工作包必须：**[ ] 先设计独立效果 Oracle** → **[ ] 故意植入一例越界/绕过，让测试 RED** → **[ ] 移除植入，在真实 Provider 下正反控** → **[ ] 保存真实 Host/Team/Policy/Tool digest 与运行原始结果** → **[ ] 独立 Review 并 commit**。严禁依赖模型输出一句“Permission denied”代替真实文件/网络效果观测。

**附加核验**：真实 TeamMember 而非模拟 session 名称，同工具不同 Member 权限；同 Member 不同工具限制；批准工具调用但 I/O 硬上界拒绝时正确诊断；原生持久 PTY 在当前 `policyRevision` 下合法存活或拒绝复用。Provider applied 只有结合调用域、consulted 证据与独立效果 Oracle 才能计 PASS。

**P4 总 Gate（G4）**：对目标 release 范围的原生工具 × 其实际 I/O 类别的矩阵逐格 PASS，未测/禁用/远端必须有类型化例外；一次性审批、撤销和持久进程可核验。**内部试用候选**可在目标工具已通过 G4 子集、使用说明明确限定范围时交付；不是正式全工具 GO。

---

## P5 — 漏洞构造、修复与完整候选验收

**目标**：针对通用执行边界做系统性攻击/故障注入，而不是重新按每工具重写算法。**入口**：G4 有可信逐工具权限与副作用基准。

### P5-01 — 对抗性 I/O

**文件**：`tests/world-factory/suites/a5sf-adversarial.mjs`、`packages/runtime/test/a5sf-no-fallback.test.ts`。

- [ ] 构造竞态/TOCTOU、符号链接出界、`/proc/self/fd`、继承 FD、PATH 可执行替换、可变 cwd、部分失效的 Provider、后台孤儿进程、网络代理/UDS/host bridge 的故障注入。
- [ ] 区分用户接受的**合法硬链接别名**、可信 JS `node:fs` 绕过（TRUSTED_ONLY 的不承诺）和真正承诺的 Member I/O 逃逸；测试期望不得偷偷提高产品目标。
- [ ] 修复只能在 Policy/Service/OS Backend 的通用位置；每漏洞必须附可复现 RED → 修复 GREEN 与受影响全工具回归。
- **Gate G5.1**：没有**已知仍可复现、违反已承诺限制**的高优先级漏洞；未修复问题必须阻断对应支持声明。

### P5-02 — 生命周期/故障恢复/升级

**文件**：`…/a5sf-crash-restart.mjs`、`…/a5sf-upstream-bump.mjs`、Fork 清单 `packages/runtime/team-sandbox/forks/UPSTREAM-TRACKING.md`（按实际 Fork 决定）。

- [ ] 撤销/重启/权限代际、Host 崩溃、Provider 双装、Fork 失败、无 Landlock/bwrap、僵尸子进程与失败清理；所有失效路径不静默降权为裸执行。
- [ ] 在隔离测试环境完成一次**代表性的真实上游版本升级演习**（若没有适合版本则选择真实上游提交形成明确对照）：记录每个 Fork 的修改行数、重放冲突/人工适配、修复提交与完成用量，再执行原生功能黄金向量和受限正负控；不把纯假设的版本变更当真实升级；不可要求自动更新整个 DSH Core 文档系统。
- [ ] 确认 `tests/deepseek-harness-test-use` 原树无污染、非 Team 仍等价；记录 release 兼容矩阵。
- **Gate G5.2**：旧域确实结束或如实 `termination-unconfirmed`；升级失败的路径不提供受限能力。

### P5-03 — 发布前产品/工程双验收

**文件**：`dev/agent-workflow/evidence/a5sf-release/RUN-MANIFEST.json`、`…/GATE-REPORT.md`、`docs/INSTALL.md`（受控实施 PR），以及独立 Authority Migration PR。

- [ ] 固定 Team/Host SHA、tool hash、Blueprint/Authority generation、Provider/Fork 版本、测试环境、World、权限矩阵、性能表；审查无伪造或跨版本复用的 PASS。
- [ ] C1 单元、C2 实测、C3 并行/重启、`pnpm typecheck` / `pnpm build` / `pnpm check:artifacts` / `pnpm smoke:composition` / `pnpm check:install-manifest` 与文档检查按 Gate 全部执行，并逐项列明基线旧红、新红、ENV_BLOCK 与例外。
- [ ] **单独**准备并审查 Authority Migration PR：修订 `AGENTS.md` 和有限基础设施 Fork 规则、替换旧 active plan/矩阵，按 `scripts/switch-authority.mjs` 唯一 Writer 规则原子切换；**任何生产执行路径的启用必须先完成该授权切换**。此 PR 可以在 P3–P5 期间准备，不必等 P5 才开始；最终发布仍单独裁决。
- [ ] 写明内部试用支持范围与“不保证恶意同进程 JS 隔离”；不把 `TRUSTED_ONLY` 当 `OS_BOUNDARY_TESTED`。
- **Gate G5.3 / 发布 GO**：所有承诺能力有真实验收；没有隐藏 fallback、原生工具改造、未获批扩权；两层独立 Review（功能兼容、执行边界） + 用户最终裁决。

**升级维护成本要求**：除基础设施 Fork，还必须将**零复制 wrapper**纳入真实上游版本升级演习，测试公开导出的接口稳定性、Context 代理行为、原生工具不变及安全负控，记录差分/冲突/维修工作量。

**P5 总 Gate（G5）**：产品承诺内的功能、权限、性能、故障与维护均有有界证据，正式发布只有独立审查/用户批准才可启动。

---

## 阶段依赖、PR 划分与可并行边界

```text
ADR/Architecture review (Draft PR #531)
          |
P1-01 v4 reuse + minimal ceiling ---- P1-02 policy compiler ---- P1-04 invocation/trust
                                                    |
             +--------------------------------------+
             |                                      |
     P1-03 + P1-05 Service                    P1-07 + P1-08 OS
             |                                      |
        P2-01/02/05                           P2-03/04/06/07
             +--------------------------------------+
                           |
                        P3-00 inventory
              +------------+--------------+
              P3-01 FS   P3-02 Process   P3-03 Web   P3-04 Host
              +------------+--------------+
                      P3-05 center migration (single writer)
                           |
                    P4 matrix + compatibility
                           |
                    P5 adversarial + release
                           |
               Production activation requires separate Authority Migration PR
```

建议 PR 颗粒：`P1-policy`（P1-01..04，Schema 需另 Gate）→ `P1-service` / `P1-os`（可并行）→ `P1-integration`（唯一 Writer）→ `P2-service-v` / `P2-os-v`（分别独立）→ `P3-fs` / `P3-process` / `P3-web` / `P3-other`（互不共享写者）→ `P3-center-cutover` → `P4-matrix` → `P5-hardening` → **单独** `Authority-Migration`（安排在任何生产启用之前，不是 P5 才能开始）。不要求每 task 一新 PR，只要求一个 PR 内每工作包可独立 review 且形成 C1/C2 证据。

## 退出标准 / Stop-Rules / 已有成果再利用

- **已有可引用而无需重做的事实**：PR #26 `spill-local` 替换方式；Alpha.4 权限审批；`tests/world-factory`；B2R2、IOAXIS、WRITEONLY 的原始日志/commit/环境/正反 Oracle 按对应语义复用。**架构 PoC 已关闭**；新缺口优先归入实现任务，不得为形式再组织轮次。
- **不可继承为 PASS 的事实**：以前的 Family 自研 read/grep 能运行、`ctx.isolate` 方法存在、进程 Provider 测试的局部 `fakeDeps` 绿、同进程恶意 JS 被 Hash 登记、简单 Landlock TCP 规则存在。
- **停工**：不允许一工具一个替代体、未能证明调用来源/权限代际、禁网无法阻止实际 OS 数据面、执行入口不受控、公开接口不够时试图 patch Host Core、单次扩权泄漏、测试触碰稳定 :3080、Fork 导致非 Team 正向回归失败。只能记录具名 `CORE_SEAM_BLOCKER` 或 `UNSUPPORTED/ENV_BLOCK` 并寻求通用 Provider 修复；不得改写需求。
- **性能验收**：优先比较“同一工具原版 + Team 配置”的真实 p50/p95，并报告原因。性能没有预先约束为固定毫秒数；内部使用者可在 G4 测值后确定可接受预算；不能让小文件读每次冷启动一个完整 Node Tool Host 而不披露。
- **变更守则**：除独立 Authority Migration PR 外，本设计文档不自动修改 `AGENTS.md`、现行实现计划和当前 authority 指针。最终审查的裁决词必须明确 PASS / CONDITIONAL / BLOCK / ENV_BLOCK / UNSUPPORTED，不得以“部分工具有绿”为整个阶段自动发布许可。
