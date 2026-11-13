# 十一、统一执行架构边界与不变量（正式审查核心）

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 0. 规范地位、术语及判定方法
本章描述**下一版本目标验收不变量**，不是宣称所有条目已在产品实现。每条注明所有者、可证伪现象与保证边界。违反任何硬不变量，应阻止新架构发布或明确缩小宣称范围；不能以测试 PASS 散文覆盖真实源码与副作用红证。相关 [架构裁决](./01-ARCHITECTURAL-DECISIONS.md)、[模块权威](./02-MODULES-AND-AUTHORITY.md)、[执行模型](./03-EXECUTION-FLOW.md)、[状态机](./06-STATE-MACHINES.md)、[实施 Gate](./10-IMPLEMENTATION-GATES.md)。

`Realm` = Cordis 服务 Scope；`ExecutionBoundary` = 已编译的 Agent × Tool I/O 硬上界；`OS Domain` = 内核实际约束的子进程/进程树。上下文隔离和 OS 强隔离不等价。`TrustRegistry` 是部署者来源可信声明，不是恶意工具无绕过证明。

## A. 工具与执行权威
**UTE-01 — Native Tool Single Authority**。模型可见 ToolDefinition、Scope toolSet、Executor 的选择权只在 DSH ToolsService；Team 不建平行的同名可执行定义目录。证伪：Team/DSH 为同一 Scope/Name 各自独立决定 Body，并可能走不同 Provider。**所有者**：DSH Registry；Team Binder 只能验证。

**UTE-02 — Native Semantics Retention**。原生参数/Schema、渲染、流、取消、结果、PTY/Session 语义在同版宿主对照不变；不得 Fork 模型可见工具业务体。证伪：为了受控 Bash 改写原生解析/终端状态。**所有者**：DSH Native Tool，Team 基础设施只提供 service。

**UTE-03 — One Binding per Agent Scope**。每个受管 Scope×ToolName×Generation 最多一个已验证的受限执行归属；注册/Scope/来源漂移拒绝，不能自动使用 inherited unrestricted Definition。证伪：表面 Guard 通过，实际仍走基础 provider。**所有者**：NativeBindingAssembler。

**UTE-04 — Trusted Runtime A/B Residual Explicit**。同名 Definition 在公开最后门后被其他受信插件合法替换的窗口，本期不强求 Core 原子执行保证；由用户部署管理承担，继续 Guard/`tools/change`/事后检查。此为**明确接受的保证边界**，不得写成“对任意恶意同进程插件防绕过”。**所有者**：部署者与 Binding Guard。

## B. I/O Boundary 与强制执行
**UTE-05 — All Executing Agents Covered**。Leader、Officer、Member 的实际 I/O ToolCall 必须受到各自已编译 Boundary 限制；管理角色不自动享受无限本地文件/网络效果。证伪：Leader 直接 Bash 绕过 Member-only Realm。**所有者**：Team Domain、Boundary Binding。

**UTE-06 — Hard Ceiling Monotonicity**。`EffectiveIO(a,t,c) ⊆ AgentCeiling(a) ∩ ToolRestriction(a,t)`，三轴独立；一次审批不能扩大硬上界，未知/不兼容旧语义不得静默转为 allow。证伪：批准 ToolCall 后 PTY 获得比 Agent ceiling 更多目录。**所有者**：Policy Compiler；Enforcement 仅消费。

**UTE-07 — Complete Required Service Face**。工具需要的每个 I/O service（fs/web/subprocess/terminals/attachment）必须有受信绑定；只受控 fs 而 process/web 继续未受控时不能声称该工具完整受限。证伪：ToolBindingRealm `faces.web=null` 却接受 Web 受控保证。**所有者**：BindingAssembler。

**UTE-08 — Enforcement Outside Business Body**。受信 JS 只承诺规范走 Provider 的 I/O；本地 OS 进程必须进入实际 OS Domain 并受内核实施；不使用 LLM 自声明或 ToolDefinition 自觉遵守替代强制。证伪：仅在工具返回文本中写“拒绝”，实际文件已被读。**所有者**：Scoped Providers/OS Gateway。

**UTE-09 — No Silent Fallback / Capability Gate**。缺身份、缺 Provider、Landlock ABI 不可用、Profile 无法表达要求或网络证明缺失时受限调用拒绝，不能退回更宽的 Host provider/bwrap 伪完整读隔离。证伪：严格 read allowlist 请求静默落到 `--ro-bind / /`。**所有者**：Assembler/Provider。

**UTE-10 — Execution World Is Immutable**。持久 Shell/PTC/MCP/LSP 创建时固定 OS Boundary 和 revision；策略变更不能就地扩大旧进程，收紧/撤销要求禁止新输入、排空/结束/重建，未确认终止如实报告。证伪：旧 PTY 在新权限上限内继续无检查地运行。**所有者**：Process/Terminal Provider。

**UTE-11 — Verified Network Scope**。网络布尔 deny 必须阻断对应本地受管工具实际数据面；可信 Web deny 与 OS 子进程禁网属于不同保证；Host 必须控制面流量与工具数据面分离，不承诺远端服务效果。证伪：Web deny 仍发送 TCP，或子进程 UDP 绕过宣称的 netns。**所有者**：Web Provider / OS Gateway。

**UTE-12 — Path Semantics & TOCTOU Honesty**。文件权限以授权路径语义实施，预打开 FD、symlink、目录替换、truncation/新文件按实际机制验收；已存在 hardlink 别名按旧用户裁决披露，不能许诺 inode 跨路径不影响。证伪：只检查字符串路径后真实 open 已越界而仍报告 PASS。**所有者**：FS Provider/OS。

## C. 审批、执行事实与事件
**UTE-13 — No Second Grant Authority**。审批、ReviewCapability、Grant 消费和 Stop 沿用既有 Control 权威；Executor/Provider/Settlement 不创建或扩权。证伪：Native Bash wrapper 从自己的表签发许可。**所有者**：ControlService。

**UTE-14 — No Self-Approval**。Requester/Executor instance 不得作为同一操作的 Resolver；Reviewer 身份按请求 Scope 与 ReviewCapability 决定，`user-approval` 仍只能由 Human 决策。证伪：Officer 批自己的操作。**所有者**：Control/Review Domain。

**UTE-15 — One Physical Execution, One Canonical Fact**。每次物理执行尝试只有一个持久 ExecutionId、一个规范结果事实；不同 ControlRequest leg 引用它，不独立重算 `succeeded`。证伪：同一 Bash 返回两个矛盾的结果。**所有者**：ExecutionSettlement。

**UTE-16 — Outcome Provenance Separation**。Host `isError`、Backend exit/kill、实际 I/O 副作用是不同轴；失败、取消、超时不等于无副作用，`unknown` 必须允许且不能自动重试。证伪：SIGKILL 后写 `succeeded` 或“从未执行”而无证据。**所有者**：Observation/Settlement。

**UTE-17 — Durable Fact / Hook Fidelity**。不能依赖 `tools/result` 的非 await 异步监听器作为唯一 durable commit；异常跳过 `post-execute` 时仍需 crash recovery；强化型 commit-before-Host-return 需独立验证。证伪：已消费 ask 仅在内存 WeakMap 中有结果、崩溃永久消失。**所有者**：Settlement 与 Host 适配。

## D. 生命周期、升级及验证边界
**UTE-18 — Stop Is Durable and Non-Replaying**。Stop 先持久化，阻止新调用，终止旧进程域；冷启动只恢复事实、不自动重唤醒 Officer/Member、不接续旧工具、不自动 replay 已消费副作用。证伪：Crash 后自行继续此前有害轨迹。**所有者**：Team Domain/Agent Scope/Process Domain。

**UTE-19 — Fork Isolation & Reversibility**。允许仅限受审基础设施插件的 Team-local 最小 Fork，不直接修改 upstream checkout，不复制模型可见工具业务；记录来源/diff/Owner/退役条件，非 Team 行为不变。现行 `AGENTS.md` 禁令需正式迁移后才允许实施。证伪：无记录的 `dsh-tools` 全体 vendor patch。**所有者**：发布/依赖装配。

**UTE-20 — Evidence-Bounded Release Claims**。所有保证必须指向 pinned Host SHA、真实已装配来源、Agent/Tool/Policy、Provider/OS 机制与允许+禁止的真实效果；`ENV_BLOCK`、`NOT_TESTED`、`TRUSTED_ONLY` 不能记安全负控 PASS。旧 Family 的 PASS 不自动覆盖新版原生工具。证伪：只看到“plugin mounted”就宣称 OS 读写强隔离。**所有者**：验收/Gates。

## 关键作用域外陈述
- 不承诺阻止**恶意同进程**可信插件直接 `node:fs/net` 绕过 Provider。
- 不承诺对**远端 MCP/API** 服务内部 I/O 做 Linux 内核级控制。
- 不承诺由单次审批带来**跨硬上界扩权**。
- 不承诺**取消即回滚**或 OS 副作用 exactly-once。
- 不承诺在 DSH 最后工具解析窗口**原子绑定工具定义**。
- 不承诺“测试绿灯 = 未覆盖的平台/ABI 也安全”。
- 不把 v0.1.6 的 Preview 行为、PR #758 未合并状态或本 PR 的 Design 当作已经完成的下一版本能力。

## 复审检查表
对每项 UTE：指出 Source Owner、执行路径、否定性用例、独立副作用证据与状态是否 `DESIGN / IMPLEMENTED / TESTED / ENV_BLOCK / UNSUPPORTED`。不满足时不得借另一条 UTE 的 PASS 抵销。审批 leg 的具体语义变化、Host 版本升级、Authority Migration 和基础设施 Fork 均需独立 PR/Owner 裁决。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
