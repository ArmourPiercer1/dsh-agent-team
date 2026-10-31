# ADR — Alpha.5 Sandbox-First / Native-Immutable / Generic Execution

> **状态：DRAFT PR / 用户已裁决目标与原则，技术路线待 PoC 验证。**
> **日期：2026-11-01。Host 代码审阅锚点：DSH 0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`。**
> **本 PR 是设计与 PoC 提案，不是 active-plan 切换，不修改任何产品代码、测试实例、Blueprint 存量文档或当前 authority 指针；不得据此自动合并、发布或结束现有 Gate。**

关联文档：[架构](./ARCHITECTURE.md) · [PoC 计划](./POC-PLAN.md) · [实施与权威迁移](./TRANSITION-PLAN.md)。

## 0. 唯一产品目标（USER-RULING，2026-11-01）

Alpha.5 **只**在 Team Blueprint 为 Member 定义并兑现以下 I/O 限制：

1. **读**：只能读取蓝图允许的文件/目录资源。
2. **写**：只能修改蓝图允许的文件/目录资源。
3. **网络**：本轮只支持 Member **能否联网**（`allow` / `deny`）。API 预留未来“只能连接哪些目的地”的扩展位置，但本轮不实现 DNS、IP、域名、URL、端口、重定向白名单或动态目标审批。
4. 既有 Alpha.4 **工具调用** `allow/ask/deny`、审批与权限范围变更仍然有效；不新增工具业务状态管理目标，也不复制 Goal、Todo、Present、Jobs 等原生工具。
5. 所有可接入的原生与未来工具，通过两个通用机制获得 I/O 限制增强；不能适配的能力必须诚实标注，不能声称已满足。

**明确非目标**：逐工具业务行为建模、完整 EffectSet/逐效果审批平台、自研原生工具执行体、通用沙箱内的恶意插件真实性证明、远端 Provider 内部 I/O 控制、COW/回滚、跨平台等价、当前版本按目的地过滤网络。工具频率不得改变本 ADR 的接口与信任分类。

## 1. 不变量组 A：原生工具不可变与边界诚实

**A5-NATIVE-01 — Native Tool Immutable**：
禁止修改、patch、fork、vendor 经过修改的、复制或重新实现任意 DSH 原生模型工具 `ToolDefinition` 的业务执行逻辑。包括参数解析、搜索与读取算法、文本/图片渲染、错误/Spill/PTY/Job 语义。不得以“为了安全”作为豁免。原生包应保持可更新和可替换。

**A5-NATIVE-02 — Native Semantics Preserved**：
适配层可绑定路由、取消、权限上下文及公共服务，但不拥有原生工具的业务结果语义。允许通用 IPC 转发工具定义与结果；不得写成 `read-executor`、`grep-executor`、`web-fetch-executor` 等替代算法。原生行为基准回归是迁移门禁，而非可选优化项。

**A5-BOUNDARY-01 — Enforcement Outside Tool Body**：
文件与网络限制由经过验证的通用受信 Service Provider 或 OS 执行边界实施，绝不依赖工具自行遵守模型层面的声明。服务层约束仅覆盖经过该服务的调用；同进程恶意代码直接使用 `node:fs`、`node:net` 等不属于 OS 隔离，不能冒称“任意 JS 已隔离”。

**A5-FALLBACK-01 — No Silent Bypass**：
当所需 I/O 能力缺少可信边界、依赖的 Provider 失效、成员/调用身份不明、单次批准无法限域或动态源尚未绑定时，对该受限能力拒绝执行；不允许无隔离直通、先产生副作用后拒绝、一次性授权默默保留给后续调用。失败后不自动重放已产生部分副作用的命令。

## 2. 不变量组 B：通用执行机制

**A5-GENERIC-01 — Two Generic Integration Modes**：
Alpha.5 对外仅提供两类 I/O 接入模式：

- **`service-mediated`**：受信工具在 DSH Host 运行，其全部受管 I/O 经由已绑定至 Member 的公共 Service（`ctx.fs`、`ctx.web`、`ctx.subprocess` 等）执行。该模式不宣称能隔离任意同进程 JavaScript。
- **`os-confined`**：真实 I/O 发生在具备声明权限的受限 OS 进程及其后代中。该模式可用在已有工具启动的子进程（leaf）或必要时在整个独立 Tool Host（whole-tool）。leaf/whole-tool 是内部实现形态，不是第三、第四套 Blueprint 权限机制。

两种模式可组合（例如 `grep` 的原生 JS 层受信、`rg` 在受限子进程内）。不存在“按工具调用次数多少选择模式”的标准。

**A5-GENERIC-02 — Single MemberPolicy**：
读范围、写范围、网络布尔许可由同一可信 MemberPolicy/InvocationAuthority 编译，传至两类执行机制。蓝图权限是可执行策略而非工具提示。工具调用准入与 I/O 权限相互独立；不变更 Alpha.4 的 reviewer、authority ladder 或已有 Tool Admission 来源。相同资源的可访问性不得因接入模式而无意扩大。

**A5-GENERIC-03 — Open Tool Onboarding**：
新增工具不必加入名称级白名单或开发专用 Family 执行体。作者/部署者只需声明其执行入口、需要的 I/O 能力、可用的通用模式与可验证的 Provider 依赖。`service-mediated` 需有受信约定（或具体代码路径/测试）证明 I/O 确由受控服务完成；未知同进程 JS 默认不得据声明取得此模式的“已实施隔离”标签。`os-confined` 若无法把完整工具装进 Tool Host，可报告 UNSUPPORTED，不强造执行体。

**A5-GENERIC-04 — Evidence-Bounded Assurance**：
对 DSH 原生工具可作的“可靠”进阶陈述 **仅限**：“在指定 Host SHA、系统环境、权限矩阵、对照测试中，未观察到越界案例”。这不是形式化证明，不得由有限测试宣称对所有输入、更新版本、插件和旁路拥有全面安全保证。需按真实路径分别披露 `tested-no-bypass-observed`、`trusted-delegation`、`not-tested`、`unsupported`；测试证据不能跨 Host 版本或执行环境直接迁移。

## 3. Policy 契约：概念形态，而非立即启用的 Blueprint Schema

以下是技术组件之间的**目标契约草案**，不表示当前 `schemaVersion: 4` 已接受这些字段：

```ts
type MemberPolicy = {
  memberIdentity: string;           // trusted bound identity, never caller-supplied
  revision: string;                 // immutable authority generation
  read: PathRuleSet;                // bound workspace + explicit allowed resources
  write: PathRuleSet;               // independent from read
  network: {
    access: "allow" | "deny";        // ONLY shipped network policy
    // future extension: structured destination constraints (NOT parsed now)
  };
};
type InvocationAuthority = {
  memberIdentity: string;
  invocationId: string;
  policyRevision: string;
  approvedDelta?: { read?: PathRuleSet; write?: PathRuleSet; network?: "allow" | "deny" };
  expiresAtOrLease: unknown;        // exact representation decided by PoC
};
```

约束：路径须基于执行世界的真实资源身份判断，不能靠字符串前缀判定，不能以可变 `cwd` 重新解释蓝图路径；别名/符号链接、TOCTOU、重命名、挂载、硬链接、读后写等必须纳入负控。用户授权写而不授权读时，原生 write/edit 若有读取旧内容/生成差异的必要，应受相同读权限约束；不为保证工具成功而隐式赠送读取权限。

旧 Blueprint v3/v4 数据、哈希和 Authority Envelope 保持原样。本轮先确定可实现能力；是否改用 Member 级默认策略、如何将当前 v4 `toolBindings.io` 映射到 MemberPolicy，以及任何新语法版本，另起 Schema/迁移决策。网络 `restricted` 的旧草案不得继续冒充本轮承诺。

## 4. 单次审批、并发与进程生命周期

- Alpha.4 仍先决定工具是否允许调用；任何临时 I/O 扩权须在受管效果开始前完成审批，绑定 Member、调用、策略代际及生命周期。
- Trusted Provider 可以在**每次 I/O 前**读取可信调用上下文并判断是否在有效 Grant 内；不能依赖易串线的可变全局变量，也不能把一次性 Grant 移交给同 Member 的并行调用。
- OS 沙箱若固定了进程创建时的读/写/网络上界，不能事后直接扩大（例如 Landlock 已施加的限制）；临时扩权必须在新的受限执行环境中实施，或经证明无旁路的可信 I/O 服务完成。
- 已运行的持久 Bash、后台任务及子进程继承的是其启动时的环境上界；策略缩紧与撤销需要停止/排空旧执行域或有实证支持的更强失效机制；不得宣称“改变蓝图即追回已发生的副作用”。
- 从 OS 受限工具获得的宿主服务桥接，须明确方法、主体、资源与返回数据范围；不能通过桥接让禁网工具调用 Host 的任意网络服务来绕过网络 `deny`。

## 5. 网络策略本轮的边界

本轮只区分 Member 工具数据面的**外联允许/禁止**，包括直接 Socket、DNS、代理/重定向路径、子进程/子孙进程以及公开 Web Service 的工具请求。实现可以比布尔开关更严格；必须声明本地 loopback/Unix Socket/Host IPC 的真实处理规则，不把“仅阻止公网 HTTP”冒充通用网络禁止。主 DSH Host 的 LLM/control-plane 传输与 Member 工具的数据面不同，但禁止通过 control-plane 的通用代理实现网络旁路。

远端 MCP/SSH/云 Provider 的**内部**文件/网络能力不因本机 OS 沙箱而自动受限；只能通过可信远端部署承诺或标记 UNSUPPORTED。后续的目标地址 ACL 为接口预留，不进行本轮验收或任何暗示“已实现”的声明。

## 6. 允许的基础设施改动

- **不允许** DSH Core patch/私有 import/原生工具 fork。保持 `CORE PATCH BUDGET = 0`。
- **允许作为受审候选**：独立的受限 FS/Web/Subprocess/Sandbox Provider、真实 OS Runner、通用 IPC Tool Host 或极小范围的**执行基础设施插件** fork。任何 fork 须证明公共接口确实不足、最小化 diff，登记原 upstream SHA、许可证、升级责任和未来移除条件；不得把工具执行体偷渡进“基础设施”目录。
- 对于实测缺失的公共接口，先出准确的 `CORE_SEAM_BLOCKER` 和最小复现，再由项目决策是否采用最小基础设施 fork；本 ADR 不预先批准具体 fork 实现。

## 7. 与既有 Alpha.5 设计的关系

本 ADR **有意取代原 Alpha.5 V2 中超出用户目标的部分**：网络 endpoint `restricted` 的本轮交付、逐工具 EffectSet/Family Body 作为默认执行模型、原生 ToolDefinition 的有界 fork 后备路线、以及“逐工具正向验收数量即完整安全保证”的解释。

保留：Alpha.4 准入与 ApprovalCase、必要的 Guard/Scope/撤销链、现有可信执行能力、受保护的测试世界、历史证据、并发/生命周期正确性及不经限制而直通的禁止。原实现与证据不删除；待技术 PoC 与迁移 Gate 后才更改产品路线。

当前 `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md` / `dev/engineering/current-authority.json` 仍然是**机器意义的现行执行入口**，不得因本 Draft PR 的存在自动切换；用户的新产品裁决与机器当前合同的冲突作为待受控迁移的**显式设计冲突**记录在 [TRANSITION-PLAN](./TRANSITION-PLAN.md)。

## 8. 采纳 / 停止门禁

只有当 [POC-PLAN](./POC-PLAN.md) 对**工具不可变、服务/进程两接缝、调用身份、读写与禁网负控、性能、持久进程与授权撤销**形成可复查证据，才可进入产品迁移。测试失败允许报告“不支持某工具/模式”，不得转向自研工具执行体。Draft PR 不意味着 PoC 通过、Alpha.5 Gate 通过或用户已批准切换生产路线。
