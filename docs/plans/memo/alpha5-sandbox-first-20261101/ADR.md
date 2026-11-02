# ADR — Alpha.5 Sandbox-First / Native-Immutable / Generic Execution

> **状态：用户已裁决产品原则；本文件在 PR #531 中仍为 DRAFT DESIGN，未成为运行时权威。**
> **更新：2026-11-02；源代码基线：DSH 0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`。**
> 本 PR 只更新设计与计划。它不修改原生工具、Team 产品代码、`AGENTS.md`、`dev/engineering/current-authority.json`、旧 active plan、历史证据或稳定实例。实施权威迁移须单独受审。

索引：[架构](./ARCHITECTURE.md) · [五阶段实施计划](./IMPLEMENTATION-PLAN.md) · [工具接入/测试矩阵](./TOOL-ADOPTION-MATRIX.md) · [现有 PoC 证据计划](./POC-PLAN.md) · [权威迁移](./TRANSITION-PLAN.md)。[Fork/PoC 缺口历史记录](./FORK-POC-RESOLUTION-PROPOSAL.md) 为来源证据，不再是另一套竞争规则。

## D0 — 裁决与建议的来源边界

| 性质 | 内容 | 当前状态 |
|---|---|---|
| 用户明确决定 | Member × Tool 的 read/write/network **全局上界**，任意工具调用不得超出 Member ceiling | 本 Draft 的产品需求 |
| 用户明确决定 | 本轮网络执行范围为布尔 allow/deny、目的地 ACL 留以后；允许硬链接路径别名；可信工具摘要登记；可有限 Fork 执行基础设施插件 | 本 Draft 的产品需求 |
| 已有仓库事实 | v4 `toolBindings[].io` 语法/哈希已存在，但执行层仍待接线；Alpha.4 审批与受控 Provider 替换先例已存在 | 作为复用输入，不自行升级为已测的新执行能力 |
| AI 技术提案 | 内部 Policy/Provider 分解、是否需要最小新增 Schema 版本、具体 Fork 位置、工具接入顺序 | 需按 P1/Gate 证实；不是用户要求指定的实现 |

本文件是 Draft PR 的**用户已确认产品目标 + 尚未生效的实施设计**，不是当前机器 Authority 或 `registry.yaml` 的替代品。正式执行前由唯一 Writer 在受审的 Authority Migration 流程中登记裁决来源，并消除当前 `AGENTS.md` 的有限基础设施 Fork 规则冲突；不得由 PR 标题/横幅自动更改既有权威。

## D1 — 唯一产品目标与非目标

Alpha.5 仅增强**逐 Member、逐工具、全局有效的 I/O 权限硬上界**。每次受管效果实际允许范围至少是 Member 硬上界和该工具有效约束的交集；不同工具可以进一步收窄，但绝不能突破所属 Member 的上界。Member 与 Tool 是**同时成立的两个坐标**，不是产品功能的二选一。

产品关系（逐 read / write 路径集合和 network 布尔维度计算）：

§§§text
BaseCeiling(member, tool) = MemberCeiling(member) ∩ ToolRestriction(member, tool)
EffectiveIO(member, tool, call) ⊆ BaseCeiling(member, tool)
§§§

“ToolRestriction 未声明”的具体处理由兼容性规则确定：不能因此获得超出 MemberCeiling 的权限，不能将 v4 原本“未声明效果治理”的含义静默改成旧执行路径上的默认宽放；在明确开启的新受管路径中，可以将其解释为“不增加工具级收窄”，但必须在 P1 显式验证并标明生效条件。



1. 文件**读取**只能经过该 Member 与该工具的最终授权路径或子树。
2. 文件**写入**只能经过该 Member 与该工具的最终授权路径或子树；读写相互独立，不因写权限自动赠送读权限。
3. Member × Tool 的**联网权限**：`allow | deny` 的有效交集（任何一方 deny 即 deny）。将未来网络连接目标约束预留为版本化策略扩展，不在本轮实现 DNS/IP/域名/URL/端口目的地 ACL。
4. Alpha.4 原有**工具调用** `allow/ask/deny`、ApprovalCase、权限范围变更和单次审批机制继续作为调用准入来源；**批准一次工具调用不等于扩张 Member/Tool I/O 硬上界**。如果需要改变上界，必须走有相应授权的明确策略变更与新代际生效流程。对于没有受管文件/网络 I/O 的 Goal/Todo/Jobs/Present 等宿主内部业务调用，Alpha.5 不增加专用业务管制。
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

**A5-GENERIC-02 — One Effective Two-Axis Policy**：Blueprint 的 Member 硬上界 + 工具级约束 + 现有 Alpha.4 有效调用准入 → 统一 `MemberPolicy`、`ToolIoRestriction` 与调用绑定的 `InvocationAuthority`。read / write / network 每轴独立求交，所有 FS/Web/Subprocess/PTY/OS runner 遵守同一硬上界。单次批准仅在硬上界**内部**对这次调用生效；如需提升硬上界，必须另行通过既有权限治理中的**明确授权策略变更**生成新 policy revision。持久进程的 OS 上界固定，增加权限需新域，收紧/撤销需排空、终止旧域或经过验证的代际隔离。

**A5-GENERIC-03 — Open Tool Enrollment**：新工具由部署者选择经过验证的执行模式与通用入口/依赖，不新增专用工具体。可独立执行的 CLI 首选 OS runner；无可信服务约束的未知同进程 JS 必须使用真正的 whole-tool 隔离或明确 UNSUPPORTED；没有文件/网络数据面 I/O 的宿主状态工具仅受既有调用准入约束。不能通过“工具名字/调用频率”选择框架。

**A5-GENERIC-04 — Evidence-Bounded Assurance**：对原生工具的最强安全进阶保证为：“在注明 Host SHA、操作系统/后端、工具来源、成员策略、正反测试的实验范围内，未观察到越界案例”。不代表所有输入、供应者与升级版本已获普遍证明。保证标签使用 `TESTED_NO_BYPASS_OBSERVED` / `TRUSTED_ONLY` / `NOT_TESTED` / `UNSUPPORTED`；ENV_BLOCK 不是 PASS。

## D4 — 受信工具登记（用户已批准的信任界限）

Team 启动前由**部署者**登记允许使用 `service-mediated` 的可信工具/插件：至少含来源包/版本、源代码摘要或可复查发布摘要、所选工具名、预期 Scope/Definition 绑定、依赖锁摘要及允许的 Provider 范围。装载时校验实际来源；每次调用核对当前 binding identity + generation，重新加载/HMR/变更来源后失效并重检。**无需每次调用重新哈希整套 node_modules**。

该登记只是部署者信任决策与漂移检查，**不是工具代码不含恶意的数学证明**。已登记工具若直接绕过 Provider 访问 Host 系统 API，`service-mediated` 不保证阻断；不能因此要求建设任意 JS 全隔离平台。对未知工具默认不能以未受信方式获得 `service-mediated` 的受控保证。

## D5 — 文件访问语义：允许硬链接

文件读取/写入权限定义在**执行时所使用的授权路径/命名空间**上，而不是 inode 在整个宿主的唯一归属。已存在的 `/allowed/link` 与 `/denied/secret` 若为同一 inode，则通过 `/allowed/link` 读写在路径授权模型下**可能属于允许效果**；该效果可能被其他名字观察到。**测试必须保留、记录并披露**所有跨路径硬链接别名的实际影响，不能据此自动判红、也绝不能因此删掉泄露证据；必须另外验证未授权路径不能被直接打开。

这不授予直接通过 `/denied/secret` 打开权限；符号链接越界、路径规范化、目录替换、非授权路径访问依旧需要测试。`writeText` 原生原子替换可能更换目录条目 inode，不能强行要求任意写操作一定影响硬链接的另一名字。文件名/metadata 侧信道需据实披露，不扩大承诺。

**此放宽仅覆盖 Member 工作区文件 I/O**；不取消 Team 自身权威指针、审批账本、资产 provenance、Evidence 的完整性/原子性保护。旧 `controlled-fs` 的 `nlink === 1` 保护是待迁移的旧语义，须隔离式退役，不能在该提案中直接删除历史证据。

## D6 — 基础设施有限 Fork，CORE_SEAM=0

**不变**：DSH Core 不打补丁；不修改 Host checkout/私有 API/构建文档系统；`CORE PATCH BUDGET=0`。新的 Team 插件在自己的仓库编译/发布、于 Team 装配时替代相应受信服务/Backend。

**允许**：先直接公共 Provider/继承；若公开接口无法传递 MemberPolicy，可**最小化 Fork DSH 执行基础设施插件**，例如 `sandbox-local`、`terminal-bash`、`bash-sandbox`、`fs-sandbox`、`subprocess-local` 的必要策略接线处。它们不是模型可见 ToolDefinition 的 Fork；禁止改工具解析、算法、render 或结果布局。**不是这五个组件必然全部 Fork**，任何 Fork 均需具名 gap、基线源码、最小 diff、许可证、上游跟踪 Owner、更新/退役条件、非 Team 不受影响测试。旧 `AGENTS.md` 的“禁止 vendor 修改上游副本”与此用户新裁决**存在待迁移规范冲突**；在正式权威迁移 PR 审查修订之前，本 Draft 不把 Fork 当作现行旧合同下可直接实施的许可。

历史工程先例 PR #26 的 `spill-local` disable + Team replacement/继承证明了该**装配形式**可行；不证明新 Provider 的逐 Member 正确性。对于 `terminal-bash` 可优先考虑 Team 专属 `backendType` 或 Team Scope 内排他替换，不能令两个同名 Provider 冲突。

## D7 — 双轴 I/O 策略与最小 Blueprint 扩展（修订裁决）

**产品已定**：每个 Member 的硬上界对其使用的**所有**工具有效；每个工具的已声明 I/O 约束在 Member 上界内进一步收窄。工具调用 `allow/ask/deny` 与 I/O 上界分层，不能把批准一次工具调用暗中翻译为扩大 Member/Tool ceiling。该产品目标不要求“以 Member 为主体”与“以工具为主体”二选一。

有效策略概念形态（不是要求新建一套 Blueprint 语法）：

```ts
type MemberIoCeiling = {
  memberIdentity: string;
  revision: string;
  read: PathRuleSet;
  write: PathRuleSet;
  network: { access: "allow" | "deny" };
};
type ToolIoRestriction = {
  bindingIdentity: string;
  read: PathRuleSet | "no-additional-narrowing";
  write: PathRuleSet | "no-additional-narrowing";
  network: "allow" | "deny";
};
type EffectiveIoPolicy = {
  memberIdentity: string;
  toolBindingIdentity: string;
  invocationId: string;
  policyRevision: string;
  read: PathRuleSet; write: PathRuleSet; network: { access: "allow" | "deny" };
  approvedWithinCeiling: unknown; // existing Alpha.4 call-scoped grant, never a ceiling override
};
// effective.read/write = member ∩ tool ∩ any call-scope tightening
// effective.network = member.allow && tool.allow && applicable call permission
```

**优先复用已经存在的 v4 工具词汇**：`schemaVersion:4` 的 `toolBindings[].io.read/write/network`、`allow/ask/deny`、`all/restricted`、`owner/name` 与 `v4-authoring-map.ts` 都是真实已合并语法/映射，而非待重新发明的规则。与此同时，该字段族当前**仅 parse/freeze/hash，并未在生产执行层生效**；不能仅因能书写 v4 就声称执行上界已实施。`owner/name` 主要标识工具，不直接表示 Member 身份。

**P1-01 的次序是能力比较而非 v5 开发**：先用实际 v4 蓝图（同一工具、两个 Member，不同读写上界；工具级额外收窄；Leader 同路）做手工和纯函数映射对照，复核 Alpha.4 模板权限能表达的部分。若现有冻结语法能在**不静默改变旧文档意义、哈希、默认拒绝**的前提下表达全部必需能力，就不升级版本。若缺少 Member 全局 ceiling 的作者载体，仅新增必要字段/映射，并**最大程度复用 v4 三轴规则、路径匹配、审批词汇及数据投影**；只有闭合 Schema 不兼容时才建立**最小加法式版本**（v5 只是一个可能的版本号，不是完整新词汇表）。

**缺省与冲突必须显式**：尤其要验证“v4 无 `toolBindings`”“同一工具绑定到两个 Member”“工具未额外收窄”“Member 未声明 ceiling”“v4 `network.restricted` 由哪种执行后端能兑现”，不得将 `restricted` 悄悄投影为布尔 `allow` 或 `deny`。本轮实际网络机制只承诺布尔准入，保留现有 v4 语法；若旧文档请求端点限制而当前执行后端无法兑现，应该明确 UNSUPPORTED/拒绝受限执行或按授权的兼容规则处理，不能无声丢掉端点约束。

**调用与策略变更**：普通 `ask` 可在 Member/Tool Ceiling 内批准一次使用，但不会扩大硬上界。合法 ceiling 改变是另一类明确授权策略变更，并生成 policy revision；在运行的 OS 域必须按新版本重建或排空。禁止把一次批准变成在持久 `bash` 中常驻的宽权限。

## D8 — 接入与验收

建议阶段：P1 通用基础体系 → P2 每执行机制代表工具正向+拒绝验证 → P3 原生工具逐个接入与功能回归 → P4 全工具读/写/网络与授权/生命周期矩阵 → P5 漏洞负控、修补与回归。**P2/P3 必有最小真实拒绝测试，不可把安全负控全部留到 P5。**

P1–P4 的验收还必须覆盖 **Member × Tool × Call 三者的相同身份/策略代际、实际 Provider consulted 记录和真实 I/O 结果**：不能因为插件已 apply 或调用获审批就宣称 I/O 限制生效。跨平面验收允许“调用批准但具体 I/O 因 ceiling 被拒绝”，但必须给出可解释的同源决策链。阶段 Gate 详见 [IMPLEMENTATION-PLAN](./IMPLEMENTATION-PLAN.md)。

每阶段按照 [IMPLEMENTATION-PLAN](./IMPLEMENTATION-PLAN.md) 执行文件/测试/证据 Gate；环境不支持可记录 `ENV_BLOCK/UNSUPPORTED`，不能伪造 PASS。已完成的历史 PoC/PR #26 装配证据可复用，但不能由历史报告自动继承新机制的绿色结论。

**权威切换是单独的最后决策**：本 Draft PR 不改 `dev/engineering/current-authority.json`、旧计划、主分支、稳定运行实例。旧 PR #364 的现行机器合同与本设计目标冲突，须由独立 Authority Migration PR 有序替换，不形成双权威。
