# ADR — Alpha.5 Sandbox-First / Native-Immutable / Generic Execution

> **状态：用户已裁决产品原则；本文件在 PR #531 中仍为 DRAFT DESIGN，未成为运行时权威。**
> **更新：2026-11-02；源代码基线：DSH 0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`。**
> 本 PR 只更新设计与计划。它不修改原生工具、Team 产品代码、`AGENTS.md`、`dev/engineering/current-authority.json`、旧 active plan、历史证据或稳定实例。实施权威迁移须单独受审。

索引：[架构](./ARCHITECTURE.md) · [五阶段实施计划](./IMPLEMENTATION-PLAN.md) · [工具接入/测试矩阵](./TOOL-ADOPTION-MATRIX.md) · [现有 PoC 证据计划](./POC-PLAN.md) · [权威迁移](./TRANSITION-PLAN.md)。[Fork/PoC 缺口历史记录](./FORK-POC-RESOLUTION-PROPOSAL.md) 为来源证据，不再是另一套竞争规则。

## D1 — 唯一产品目标与非目标

Alpha.5 仅增强**按 Team Blueprint / Member 有效权限配置的 I/O 执行环境**：

1. 文件**读取**只能经过蓝图允许的路径或子树。
2. 文件**写入**只能经过蓝图允许的路径或子树；读写相互独立，不因写权限自动赠送读权限。
3. Member 的工具**是否允许联网**：`allow | deny`。将未来网络连接目标约束预留为版本化策略扩展，不在本轮实现 DNS/IP/域名/URL/端口目的地 ACL。
4. Alpha.4 原有**工具调用** `allow/ask/deny`、ApprovalCase、权限范围变更和单次审批机制继续作为唯一权限准入来源。对于没有受管文件/网络 I/O 的 Goal/Todo/Jobs/Present 等宿主内部业务调用，Alpha.5 不增加专用业务管制。
5. 为原生及未来新工具提供通用受限执行服务；**对未知工具不保证功能兼容性**，对受信同进程工具不作恶意代码抗绕过保证。

**明确非目标**：新工具算法、重写 ToolDefinition、逐工具 EffectSet/完整效果类型系统、跨平台完全等价、远端云服务内部 I/O 沙箱化、事务回滚、形式化安全证明、消除文件 hardlink 全局别名、所有未知 JS 插件即插即强隔离。**工具调用频率不进入架构或信任边界决策。**

## D2 — 不变量组 A：原生工具及受信执行边界

**A5-NATIVE-01 — Native Tool Immutable**：不得修改、Fork、复制、vendor 改造或重新实现任何 DSH **模型可见原生工具 `ToolDefinition` 的业务逻辑**，包括参数/算法/窗口/输出/错误/Spill/取消/PTY 展示。允许通过配置、上下文服务和通用代理引用原生工具定义。原生工具源码及可观察能力是测试对照基线。

**A5-NATIVE-02 — Native Semantics Preserved**：在接入新执行环境时，参数、返回类型、输出呈现、流、取消、错误分类、后台/终端生命周期等必须与同版上游正向行为对照；不允许 `read-executor`、`grep-executor`、`web-executor` 等替代业务实现。若通用接入使个别工具不兼容，记录 UNSUPPORTED 或明确条件降级，而不是复刻工具。

**A5-BOUNDARY-01 — Enforcement Outside Tool Body**：由 Team 的可信受限 Service Provider 或真实 OS 受限执行边界管理读/写/网络；不得依赖 LLM 或原生工具自行诚实声明。`service-mediated` 本质上是**部署者信任工具代码**、工具常规使用 `ctx.fs/web/subprocess` 的受限调用方式，**不隔离同进程直接 `node:fs` / `node:net` 的恶意调用**。`os-confined` 仅约束真正进入受限进程及其后代的效果。不能把这种部署信任冒称为恶意代码安全防护。

**A5-FALLBACK-01 — No Silent Bypass**：Member、调用、策略代际、Trusted Binding 或所需 Provider 不可验证，OS 后端不可用或单次扩权无法隔离时，对**声称受限**的路径 fail closed；不得改用未受限上游 Provider、先执行后拒绝、将一次性权限遗留给下一调用，也不得自动重放可能已产生副作用的操作。非 Team 普通路径保留原生行为，但须独立装配而非受限路径 fallback。

## D3 — 不变量组 B：两种通用执行机制

**A5-GENERIC-01 — Two Generic I/O Modes**：

- `service-mediated`：在受信 Host/Member Service Scope 运行原生 ToolDefinition，注入受控 `fs/web/subprocess` 等 Provider，执行前后仍由原生工具完成业务语义。只对经过这些公共服务的 I/O 承诺限制；工具作者/部署者的可信选择是前提。
- `os-confined`：在 Linux OS 受限的真实子进程（`leaf-process`）执行 I/O，必要时在独立进程加载完整工具运行时（`whole-tool`）。leaf/whole-tool 是**同一模式的内部形态**，whole-tool 不属于本轮必须交付的全功能兼容承诺。
- 两者**可组合**：原生 `grep` 的 JS 参数/结果在可信 Realm，`ctx.subprocess.spawn` 的 `rg` 子进程使用 OS 限制。

**A5-GENERIC-02 — One Effective MemberPolicy**：Blueprint + Alpha.4 权限层级/ApprovalCase → 统一 `MemberPolicy` 与绑定到调用的 `InvocationAuthority`；FS/Web/Subprocess/PTY/OS runner 使用相同解释。工具准入与受限 I/O 互相正交。临时批准仅作用于一调用；持久进程拥有固定的 OS 上界，扩权需新域，撤销需排空/终止旧域或有证据的代际隔离。

**A5-GENERIC-03 — Open Tool Enrollment**：新工具由部署者选择经过验证的执行模式与通用入口/依赖，不新增专用工具体。可独立执行的 CLI 首选 OS runner；无可信服务约束的未知同进程 JS 必须使用真正的 whole-tool 隔离或明确 UNSUPPORTED；没有文件/网络数据面 I/O 的宿主状态工具仅受既有调用准入约束。不能通过“工具名字/调用频率”选择框架。

**A5-GENERIC-04 — Evidence-Bounded Assurance**：对原生工具的最强安全进阶保证为：“在注明 Host SHA、操作系统/后端、工具来源、成员策略、正反测试的实验范围内，未观察到越界案例”。不代表所有输入、供应者与升级版本已获普遍证明。保证标签使用 `TESTED_NO_BYPASS_OBSERVED` / `TRUSTED_ONLY` / `NOT_TESTED` / `UNSUPPORTED`；ENV_BLOCK 不是 PASS。

## D4 — 受信工具登记（用户已批准的信任界限）

Team 启动前由**部署者**登记允许使用 `service-mediated` 的可信工具/插件：至少含来源包/版本、源代码摘要或可复查发布摘要、所选工具名、预期 Scope/Definition 绑定、依赖锁摘要及允许的 Provider 范围。装载时校验实际来源；每次调用核对当前 binding identity + generation，重新加载/HMR/变更来源后失效并重检。**无需每次调用重新哈希整套 node_modules**。

该登记只是部署者信任决策与漂移检查，**不是工具代码不含恶意的数学证明**。已登记工具若直接绕过 Provider 访问 Host 系统 API，`service-mediated` 不保证阻断；不能因此要求建设任意 JS 全隔离平台。对未知工具默认不能以未受信方式获得 `service-mediated` 的受控保证。

## D5 — 文件访问语义：允许硬链接

文件读取/写入权限定义在**执行时所使用的授权路径/命名空间**上，而不是 inode 在整个宿主的唯一归属。已存在的 `/allowed/link` 与 `/denied/secret` 若为同一 inode，则通过 `/allowed/link` 读写**属于允许效果**；该效果可能被其他名字观察到。测试不得把“相同 inode 的授权别名可读写”判为逃逸漏洞。

这不授予直接通过 `/denied/secret` 打开权限；符号链接越界、路径规范化、目录替换、非授权路径访问依旧需要测试。`writeText` 原生原子替换可能更换目录条目 inode，不能强行要求任意写操作一定影响硬链接的另一名字。文件名/metadata 侧信道需据实披露，不扩大承诺。

**此放宽仅覆盖 Member 工作区文件 I/O**；不取消 Team 自身权威指针、审批账本、资产 provenance、Evidence 的完整性/原子性保护。旧 `controlled-fs` 的 `nlink === 1` 保护是待迁移的旧语义，须隔离式退役，不能在该提案中直接删除历史证据。

## D6 — 基础设施有限 Fork，CORE_SEAM=0

**不变**：DSH Core 不打补丁；不修改 Host checkout/私有 API/构建文档系统；`CORE PATCH BUDGET=0`。新的 Team 插件在自己的仓库编译/发布、于 Team 装配时替代相应受信服务/Backend。

**允许**：先直接公共 Provider/继承；若公开接口无法传递 MemberPolicy，可**最小化 Fork DSH 执行基础设施插件**，例如 `sandbox-local`、`terminal-bash`、`bash-sandbox`、`fs-sandbox`、`subprocess-local` 的必要策略接线处。它们不是模型可见 ToolDefinition 的 Fork；禁止改工具解析、算法、render 或结果布局。**不是这五个组件必然全部 Fork**，任何 Fork 均需具名 gap、基线源码、最小 diff、许可证、上游跟踪 Owner、更新/退役条件、非 Team 不受影响测试。旧 `AGENTS.md` 的“禁止 vendor 修改上游副本”与此用户新裁决**存在待迁移规范冲突**；在正式权威迁移 PR 审查修订之前，本 Draft 不把 Fork 当作现行旧合同下可直接实施的许可。

历史工程先例 PR #26 的 `spill-local` disable + Team replacement/继承证明了该**装配形式**可行；不证明新 Provider 的逐 Member 正确性。对于 `terminal-bash` 可优先考虑 Team 专属 `backendType` 或 Team Scope 内排他替换，不能令两个同名 Provider 冲突。

## D7 — 版本化策略接口与单次审批

`MemberPolicy` 的概念形态（**不代表旧 Blueprint v3/v4 已具有此语法**）：

```ts
type MemberPolicy = {
  memberIdentity: string; revision: string;
  read: PathRuleSet; write: PathRuleSet;
  network: { access: "allow" | "deny" };
};
type InvocationAuthority = {
  memberIdentity: string; invocationId: string; policyRevision: string;
  approvedDelta?: { read?: PathRuleSet; write?: PathRuleSet; network?: "allow" | "deny" };
  lease: unknown; // bound to existing Alpha.4 lifecycle, not a new grant store
};
```

当前 `schemaVersion:4` 的 `toolBindings[].io` 是逐工具、包含网络 restricted 的旧合同，不能静默改写成全 Member 策略。本设计建议使用**受独立版本迁移审查的 v5 Blueprint 路线**增加 Member I/O 策略；v3/v4 继续按历史语义解析，不得自动默许缺省权限、把 `restricted` 解释成布尔 allow/deny，或破坏已存哈希。最终字段形状见 [ARCHITECTURE](./ARCHITECTURE.md) 提案，并在实施 P1 契约 Gate 冻结。

## D8 — 接入与验收

建议阶段：P1 通用基础体系 → P2 每执行机制代表工具正向+拒绝验证 → P3 原生工具逐个接入与功能回归 → P4 全工具读/写/网络与授权/生命周期矩阵 → P5 漏洞负控、修补与回归。**P2/P3 必有最小真实拒绝测试，不可把安全负控全部留到 P5。**

每阶段按照 [IMPLEMENTATION-PLAN](./IMPLEMENTATION-PLAN.md) 执行文件/测试/证据 Gate；环境不支持可记录 `ENV_BLOCK/UNSUPPORTED`，不能伪造 PASS。已完成的历史 PoC/PR #26 装配证据可复用，但不能由历史报告自动继承新机制的绿色结论。

**权威切换是单独的最后决策**：本 Draft PR 不改 `dev/engineering/current-authority.json`、旧计划、主分支、稳定运行实例。旧 PR #364 的现行机器合同与本设计目标冲突，须由独立 Authority Migration PR 有序替换，不形成双权威。
