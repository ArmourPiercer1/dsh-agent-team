# Alpha.5 Sandbox-First 迁移与工程执行计划（DRAFT / 不触发切换）

> **本文件不替代现行 active plan，也不直接授权任何代码实现、PR 合并、生产 Host 改装或持续工作**。唯一用途：在当前进行中的 Service Realm + OS leaf PoC 完成后，按用户批准的“蓝图读/写/网络布尔限制、双模式、原生工具不变”目标设计可回滚迁移。

## 1. 与现行权威的关系及冲突

截至本 Draft 分支创建时的可见 master `8067f631f37f233977d508b78809be067615211c`：

- 当前机器权威源：`dev/engineering/current-authority.json` → 不可变 authority snapshot。
- 当前唯一实现计划：`docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md`（PR #364）。
- 旧当前态入口：`docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md` 与 `docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md`。
- 强制纪律：`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`；禁止 Core patch、稳定实例 :3080 变更、未经授权 push/merge、绕过单一 Authority Writer。
- 已有 `GovernanceKernel`、`FamilyAssembly`、`read/write/grep/web/agent-state` 执行器、U7 capability ledger/CI，以及大量历史真实 Host 证据，均保留作迁移输入与回归参照，不因本新架构自动被判废。
- 明确**冲突**：旧 Alpha.5 ADR V2 容许原生工具级 fork、逐 EffectSet/Family 自研实现倾向、网络 restricted/endpoints 本轮实现；本 Draft 用户新裁决禁止原生工具 fork/重实现，网络本轮仅 allow/deny。旧 `contribution-schema.ts` 的 `execution.via: family-body|named-bridge` 不能表达新“原生定义 + 受信服务绑定/原生子进程后端”的一等模式。不能同时称两个方案为唯一实施计划。

**审查与生效次序**：本 Draft 收集设计裁决与 PoC 方法 → 本地 Agent 提交可复核 PoC 结果 → 专门的权威冲突清单与 Schema/版本决策 → 独立受门 Authority Migration PR（唯一 Writer、受审、可回滚）→ 分阶段实现。**不能靠合并本 Draft 直接变更当前 pointer、旧 active plan 或 Blueprint 运行语义。**

## 2. 最小开发工作包与验收

### T0 — PoC 证据接收（只读）

**入口**：现有本地 Agent 的工作树/结果。

- 核对 Member Identity、Host/Team SHA、服务组装、Subprocess 同步句柄、Bash/PTC persistent、网络 deny 等真实正/负控；进行独立代码审查。旧报告不得代替本轮机制实证。
- 输出每条机制的 `READY / CONDITIONAL / CORE_SEAM_BLOCKER / ENV_BLOCKED / UNSUPPORTED / NOT_TESTED` 和需要补测的**最小**列表。严禁重复跑已经有效的 PoC。
- **Gate**：对 A/B 两模式和任意 JS 的边界有可辩护的机制结论；失败仍可标为 unsupported，不得重写工具。

### T1 — Policy Compiler / 执行模式选择合同

**入口**：T0 记录每类 Provider 的真实能力与身份传递事实。

- 以 Alpha.4 原始审批权威为唯一工具调用准入源；新 `MemberPolicy` 只给读/写/网络权限；网络 restricted/destination **不进入本轮接受面**。
- 明确每 Member 基础权限、每调用临时授权、策略代际、权限变更及撤销，区分静态 Blueprint 约束和允许的单次扩大；旧 Blueprint v3/v4 语义不变。
- 将工具接入声明抽象为 `service-mediated` 或 `os-confined`，允许前者内部调用后者；leaf/whole-tool 仅为 OS 模式内部执行形态。不得按工具名称/频率增加适配器业务执行体。
- **Gate**：权限矩阵、认证身份及版本保持可审计，单次批准并发非泄漏；ABI/Schema 变更另行记录兼容/迁移策略。

### T2 — 两个通用执行后端（分别可独立验收）

**入口**：T1 合同冻结；原生 Host public seam 真实可用。

- **T2a Service-Mediated**：以可验证的 Cordis Realm/Provider 方式运行未修改原生 ToolDefinition，确保 read/write/edit/web 等内容读写与联网受限；只承诺经过规定服务的 I/O。
- **T2b OS-Confined**：以经过实测的公共 `SubprocessRuntime` / `SandboxProvider` / PTY 的真实边界运行原生 `rg`、Bash、PTC 和任意 CLI。需要的最小基础设施插件 fork 可在具名 blocker 后独立评审，**不得 fork 工具**。不得将异步 confine 直接替换为同步 spawn。
- 两者共享一套 `MemberPolicy`，并发与单次批准不旁路；内部工具无相关 I/O 的仅做现有 Tool Admission。
- **Gate**：受控路径真实负控 + 原生性能/行为黄金回归、供应者能力真实记录、禁网正/负控，零意外无隔离 fallback。

### T3 — 原生工具迁移（可逆、逐组）

**入口**：T2 的两个真实执行后端已通过各自 Gate。

- 从最少的原生工具执行链开始：`read` → `write/edit` → `grep/glob` → 原生 Bash/PTC → `web_fetch/search` → 其他宿主/外部工具。顺序可按 PoC 证据调整，但不得在新边界未实证前废弃旧路径。
- 使用**原版 DSH 工具定义及其依赖**；通过配置/服务重装/受限进程绑定，不复制业务实现。保留 Team 原旧执行器作为待退役历史，必要的临时 rollback 由经过审查的受控配置决定，不能在宣称受限的路径上静默直通。
- 每组测试工具行为对照、I/O 负控、调用授权与回滚、并发、取消、生命周期。性能测 p50/p95/RSS/CPU 及原生大文件窗口；不填先验“10ms”或用测试通过冒充性能无损。
- **Gate**：原生工具代码 SHA 未动；本轮承诺的每种 I/O 有真实执行边界。未通过的工具明确 NOT_SUPPORTED；只测试过的工具标 `tested-no-bypass-observed`，不得标“任何输入都安全”。

### T4 — Blueprint/CI/Authority 正式切换（另行批准）

**入口**：T0–T3 审查结果和独立设计迁移裁决。

- 建立新的 Authoring/Runtime 迁移方案，决定将当前 `schemaVersion:4` 的逐工具 `toolBindings.io` 映射为 MemberPolicy 的精确规则；判断能否不引入新 Schema 版本，不能无声接受或忽略旧网络 `restricted` 配置。
- CI 添加阻止原生工具 fork/重实现的结构性检查、Provider 复用/权限门禁负控、Host SHA pin、执行模式能力证明、版本升级复测；对静态扫描无法证实的语义不得宣称形式化锁定。
- 通过**单独的权威迁移 PR** 按 `dev/engineering/current-authority.json` 唯一指针与 snapshot 协议受控切换；不修改历史已合 PR，不伪造旧 Green 的新方案证据。
- **Gate**：版本回滚/迁移负例、安全/功能/性能总审查，显式用户批准后才能由主 Integrator 合并/启用。

## 3. 不变量的自动化约束（拟议）

- 给每个测试原生工具 pin 宿主 package/root export 的源码 hash/版本、输入/输出黄金向量；用源代码路径审计在新 `packages/` 下出现的自研 `read-executor`、`grep-executor`、`web-fetch-executor` 等，并要求审查确证任何 Provider 变更不包含工具业务复刻。
- 将执行模式绑定收敛到通用 ABI 描述；CI 查“新增工具只新增接入声明/验证，不引入工具业务执行体”。
- 任意 Service-Mediated Provider 缺失、OS 沙箱不可用、Member 身份不确定、有效策略代际不一致、禁网 provider 未执行、工具别名/动态注册变化，均不得在承诺的受限路径静默执行。
- 完整边界只能由实际 OS/Provider 实测支持，不能由 hash、单元测试或接口声明单独证明。

## 4. 不允许顺手开发的事项

- 完整自研 read/grep/web/goal/todo/present 的替代实现；
- 通用 EffectSet 语义引擎、每工具 business effect parser；
- endpoint/domain/IP allowlist 本轮功能；
- 任意 JS 隔离 runtime 的全工具兼容承诺（可选 whole Tool Host PoC 不等于必须一次全部完成）；
- Windows/macOS 与 Linux 完全同构交付；
- 工程治理基线清理/大规模工作树重组/已有全部 Family 的立即删除，除非单独必要、受审。

## 5. 本 Draft PR 的验收范围

只检查本文、ADR、架构、PoC 计划相互一致且可以实施；不要求执行原生工具的真实 Host 实验，也不更改生产代码、当前 Source of Truth、历史测试或 GitHub branch protection。本 Draft 合并前仍需用户审查；合并后的技术方案激活属于另一受门决定。

**建议的下一步**：本地 Agent 完成在途 PoC 并给出实际证据；用 T0 做差量审查，再决定是否需要更大的 whole-tool Tool Host 方案。若 A/B 已满足约定工具类别，不得为“架构完整”而无依据建设 whole-tool Runtime。
