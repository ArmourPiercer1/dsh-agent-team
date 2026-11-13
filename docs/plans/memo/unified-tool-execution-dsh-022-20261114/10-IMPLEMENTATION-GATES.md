# 十、迁移实施顺序与验收门禁

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. Gate 前置
本 PR 只有架构设计。PR #758 **当时仍 open**，在其合并并按既定程序冻结 v0.1.6 内部版前，不执行新版实施 Authority Migration。新版本固定上游 `dsh-v0.2.2-rc.3@38a6a5c...` 或实施时重新确认的更新发布 Tag + commit；**不可跟踪浮动 master**。新 Host 基线必须独立于 v0.1.6 pristine 测试目录、稳定端口和 DSH_HOME。

## 2. G0–G5
| Gate | 工作 | 成功条件 |
|---|---|---|
| G0 frozen baseline | #758 后冻结 v0.1.6，建立独立 DSH 新宿主 pin/安装测试 | 无 v0.1.6 代码/authority/发布副作用；精确版本可重现 |
| G1 latest host integration | 使用 `ToolsService`、`ResolvedToolSet`、Native/PTC Executor、Pipeline | 原生 vs Team 的 schema、输出、PTC nested、并发顺序、取消实测等价 |
| G2 binding+scope | Agent Execution Scope 扩至 Leader/Officer/Member；统一 native `apply`、Definition/Service 证明 | 每一个受管工具唯一绑定、失配拒绝、不落 inherited 旧定义 |
| G3 I/O/OS enforcement | FS/Web/Subprocess/PTY 统一 Boundary，Landlock/bwrap/netns 能力探测 | 逐轴允许+禁止、真实文件/网络效果负控；不可兑现=UNSUPPORTED |
| G4 settlement+recovery | ExecutionId、单一写入、Stop/撤销/PTY/PTC/崩溃 | 已消费调用可查询一个事实或 unknown；无暗中 replay；进程真实排空 |
| G5 retire+release | 对照后逐项退役旧 Family/ToolPlane；打包、升级、非 Team 回归 | zero redundant body、包可独立安装、版本化真实验收账本 |

## 3. 纵切代表项
先以 `read/write`（受信 FS）、`grep/glob`（同步 spawn + Landlock rg）、`bash persistent`（原生 PTY + OS Profile 代际）、`web_fetch/web_search`（受控 Web）、`run_code`（PTC 直接 Node I/O 与 nested ToolCall）作为必须的纵向路径。每个至少正控与真实拒绝；不仅检测返回文案，还检测实际文件未落盘、web 服务器零连接、OS 子进程的 kernel refusal 与终止状态。第三方新的 CLI 验证**无需新增 Team ToolDefinition**即可接入。

## 4. 竞态与故障矩阵
- 并发 Agent 同名 read，不能共享身份/Provider；并发 FS/Search/Web 的 `currentMember` 全局变量方案一律禁止。
- 旧 Binding 在 pre-execute 等待、Scope dispose、临时 Shadow、`tools/change` 下仍 fail-closed；A/B 最后窗口只按受信部署者管理边界披露，不额外改 Core。
- 批次并行/独占的结果严格保持 DSH 的 model order；调用间隔的 Policy/ToolSet change 不能允许旧权限外溢。
- 一次审批通过后权限撤销/Stop，拒绝新副作用；Grant 已消费但 Body 前崩溃，不自动重试。
- Body 已执行但日志失败，恢复 `unknown`；SIGKILL/timeout/session exit 分清执行失败与副作用不确定。
- PTY spawn 与 Stop 竞态；持久 PTC 改 PolicyRevision；OS 终止未知不可报告已释放。
- Web net deny 的真实网络连接计数为零，Host LLM 流量不误关；Subprocess network deny 有真实 namespace/UDP 等负控。
- Officer 审自己的操作拒绝；Human-only approval 不被 Leader 代签；Leader/Officer 直接 I/O 也须有 Boundary。
- 冷启动只恢复事实，不自动唤醒 Officer 或续跑旧 Agent；人工/Leader 显式恢复工作后建立新的 Binding/Scope。

## 5. 证据级别
C1：接口/契约/身份/模拟；C2：真实 pinned DSH + 真实 OS 效果及 Host Native 对照；C3：跨 World 重启、崩溃、取消、安装包、升级回归。对各受管工具记录来源、Host commit、Scope/ToolDefinition、有效限制、Provider/OS 机制、效果 Oracle、取消与输出差异。测试环境阻断=ENV_BLOCK，不得记 PASS。Release Gate 不得由 old Family PASS 继承为新原生路径 PASS。

## 6. 审查与用户待裁决项
- 是否将 G4 的“Host 最终结果返回前事实已持久”从强化目标提升为硬门；目前基本合同为最终可恢复且 unknown 诚实持久化。
- 是否由单独 Authority Migration 允许最小基础设施 Fork（必须修订现行 AGENTS.md 旧禁令），而非本 PR 自动授权。
- 是否随新版一起完成 AER 的 Leader/Officer execution scope、F-2 Goal Domain 分类的行为迁移，或分别提交不影响相互进度的受审 PR；顶层设计已给出相容关系。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
