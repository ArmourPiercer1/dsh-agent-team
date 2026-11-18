# 九、基础设施 Fork 边界

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线（更新）**：DSH `dsh-v0.2.2-rc.5`（tag commit `9c2670d3bce5275e0d1610272958121af87787bb`，上游 lightweight tag，本仓 `origin` 不带该 tag）；Team 文档基线 `master@b7276ffa7bd8b040402460d2772c62576d08da5b`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，rc.5 接口未在 Team 上集成或验收。
>
> **[updated 2026-11-16 UTE-Prep]** 基线由 `dsh-v0.2.2-rc.3@38a6a5c` 迁至固定 `dsh-v0.2.2-rc.5@9c2670d3`（tag/commit 已用 `git ls-remote` + 上游 refs API 复验），Team 文档基线随 master 前进。差量判定、三条边界裁决与 G0/G1 首批纵切见 [`docs/plans/memo/ute-prep-20261116/`](../ute-prep-20261116/README.md)。原 rc.3 结论**未被静默改写**：rc.5 对 UTE 的实际影响有两处——Web/Search 按模型路由选 provider（语义变化）与 refusal 路径（要求执行事实的写入不依赖回合收尾），逐区判定见该目录 02。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 裁决来源
用户明确允许“将上游某个适当的基础设施 plugin 复制到 Team 仓库，作小范围改动并由 Team 包管理”，但**不直接在上游仓库 Fork/Host checkout 上修改**。目的是隔离文档/发布责任与源码变更范围。现行 `AGENTS.md` 仍包含“禁止 vendored 修改过的上游副本”的旧红线；**本 Draft 仅记录下一版本提议，不能自行覆盖现行规则**。实施前必须由 Owner/Authority Migration 明确修订适用边界。引用 [原 ADR D6](../alpha5-sandbox-first-20261101/ADR.md)。

**[updated 2026-11-16 UTE-Prep]** 上面的"提议"现在有**条文**，但**仍未生效**——它需要 owner 裁决并把例外写进 `AGENTS.md`。冻结文本与六项随请求证据见 [`ute-prep-20261116/03`](../ute-prep-20261116/03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) 裁决 3；可直接应用的 `AGENTS.md` 补丁见 [`ute-prep-20261116/06`](../ute-prep-20261116/06-PROPOSED-ACTIVE-PLAN-PATCH.md) 补丁 B。三条之前没有写死的边界现在写死：**（i）缺口必须是可复现的公开 API 缺口**（最小脚本在钉住的 tag+commit 上稳定复现 ≥2 次，且公开 seam 逐条排除）；**（ii）首次实例逐个具名批准**，不是类别授权、不是"反正要升级先 fork 一份"；**（iii）顺序不可颠倒**——先报 `CORE_SEAM_BLOCKER`，再申请例外。不满足任一条即仍是阻塞，不是待办。

## 2. 有限 Fork 允许对象
| 上游对象 | 默认选择 | 何时准许复制改动 |
|---|---|---|
| `@deepseek-ai/dsh-tools` Core/Registry | 不 Fork | 本期明确不解决 A/B 最后窗口，不改 ToolRuntime |
| `dsh-tool-executor-native` | 原生/轻量 wrapper | 如强化持久化顺序确实不能用公共 API 兑现，具体 Gate 后准许 |
| `dsh-tool-executor-ptc` | 原生 | 仅因嵌套执行必要接缝实证不足时 |
| `dsh-sandbox-local` | 受控 SandboxGateway/公开代理 | 无法传独立 read/write/network Profile 时 |
| `dsh-subprocess-local` | Scoped Provider | 无法保持同步 spawn+OS profile+真实 cancel 时 |
| `dsh-terminal-bash` | Scoped Terminal Backend | `danger-full-access` 早返回使 Team Ceiling 无法保证，或持续 PTY 代际不可控时 |
| `dsh-ptc-runtime-node` | 原生 + Scoped subprocess/sandbox | 真实 PTC 直接 Node I/O/持久域仍不可控时 |
| 原生 `dsh-tool-fs/search/web/bash` ToolDefinition | 绝不复制业务体 | UNSUPPORTED / 要求上游公共接口，不建同类业务 Fork |

## 3. Fork 契约
1. 每个 Fork 必须有对应的缺口编号、证据、上游 Tag/SHA、包版本、许可证、原始文件摘要、最小 Diff、升级 Owner、退役条件。
2. 复制的插件由 Team 构建/发布；非 Team 继续使用正常上游，Team Scope 下与对应上游插件排他装配。不修改上游仓库工作树、Core 私有 API 或生成式文档。
3. 上游新接口能消除缺口时，优先退役 Fork；如确需复刻一个 Backend 文件，不能借此复制 ToolDefinition。
4. Backend 本身不解析 Blueprint 或发放权限，只消费 `ExecutionBoundary` 和受信 Identity，再报告真实 Enforcement Receipt。
5. 工程验证必须有原生输出/PTY 等价、OS 正负效果、升级对照、错误/abort/teardown、非 Team 无回归、包安装可复现的证据。

## 4. 特别的 Linux 文件/网络边界
- DSH `sandboxPolicy` 的三态模式不足以表达 Team 的独立 READ_FILE/READ_DIR/WRITE_FILE/CREATE/TRUNCATE 路径集合；Team 必须有单独 EffectiveBoundary/规则编译层。
- `bwrap --ro-bind / /` 不是默认拒绝任意 read allowlist；mask 不证明文件级完整读取边界。VFS 同 UID owner bits 也不满足通用不可突破的只写不读。
- Landlock 严格 read/write 实现依部署内核 ABI、规则安装与真实访问负控；早期 WSL2 `ENV_BLOCK` 不等于生产 PASS。
- 本地进程 `network: deny` 应有实际 network namespace/能力证明及 TCP/UDP/DNS/IPv4/IPv6 负控；Landlock 网络特性并不自动等于完整禁网。
- 宿主直连模型的流量与受管 Tool Web/Process 数据面分离；远端 MCP 内部效果不得冒充本机 OS 受限。
- 持久进程 reuse 仅同一有效 OS Boundary/代际；更新要 terminate/recreate。原生 `terminal-bash` 在 `danger-full-access` 路径仍会跳过 `sandbox.confine`，必须在 Team 入口 clamp 或用专属 Backend 解决，不能只添加结果拦截。

## 5. 源码锚点
[DSH terminal-bash](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/packages/terminal/terminal-bash/src/index.ts)、[sandbox-local](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/packages/sandbox/sandbox-local/src/index.ts)、[subprocess-local](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/packages/subprocess/subprocess-local/src/index.ts)、[Native Executor](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/packages/core/tool-executor-native/src/index.ts)、[原 PoC 方案](../alpha5-sandbox-first-20261101/POC-PLAN.md)。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
