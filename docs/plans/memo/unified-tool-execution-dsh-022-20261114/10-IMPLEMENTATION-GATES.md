# 十、迁移实施顺序与验收门禁

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线（更新）**：DSH `dsh-v0.2.2-rc.5`（tag commit `9c2670d3bce5275e0d1610272958121af87787bb`，上游 lightweight tag，本仓 `origin` 不带该 tag）；Team 文档基线 `master@b7276ffa7bd8b040402460d2772c62576d08da5b`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，rc.5 接口未在 Team 上集成或验收。
>
> **[updated 2026-11-16 UTE-Prep]** 基线由 `dsh-v0.2.2-rc.3@38a6a5c` 迁至固定 `dsh-v0.2.2-rc.5@9c2670d3`（tag/commit 已用 `git ls-remote` + 上游 refs API 复验），Team 文档基线随 master 前进。差量判定、三条边界裁决与 G0/G1 首批纵切见 [`docs/plans/memo/ute-prep-20261116/`](../ute-prep-20261116/README.md)。原 rc.3 结论**未被静默改写**：rc.5 对 UTE 的实际影响有两处——Web/Search 按模型路由选 provider（语义变化）与 refusal 路径（要求执行事实的写入不依赖回合收尾），逐区判定见该目录 02。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. Gate 前置

**[updated 2026-11-16 UTE-Prep]** 本条原有的"实施时重新确认的更新发布 Tag"是后门，已删除；"新 Host 基线必须独立"从意图升级为规则。完整条文见 [`ute-prep-20261116/01`](../ute-prep-20261116/01-BASELINE-REFRESH.md) H-1…H-5 与 [`ute-prep-20261116/03`](../ute-prep-20261116/03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) 裁决 1。

本 PR 只有架构设计。PR #758 已合并；v0.1.6 是否已按既定程序冻结为内部版，**本 PR 未核实**（UNKNOWN，owner 确认）——在核实前不执行新版实施 Authority Migration，但这**不阻塞**对产品与 Authority 只读的 G0/G1 工程切片。

新版本固定上游 `dsh-v0.2.2-rc.5` = `9c2670d3bce5275e0d1610272958121af87787bb`（lightweight tag，已用 `git ls-remote` + 上游 refs API 复验；本仓 `origin` 不带 `dsh-v*` tag）。**不可跟踪浮动分支、不可 `latest`、不可实施时再确认。** 新 Host 是**与 legacy `0.2.0-rc.2@639ed015` 并存的第二棵 pinned 树**：独立 checkout 路径、独立 `DSH_HOME` 根、按代际分区的端口族、独立 world 命名、零共享可变世界状态。宿主 pin 与沙箱资产 pin 是**两个 pin**（资产包今天只有 `0.1.2`，见 01 §2 H-5）。

**[updated 2026-11-16 UTE-Prep] 上述两条已落地，不再是提案**：#787 `82091ae4a` 新增 `tests/paths.mjs` 的 `NEXT_HOST`（`tests/deepseek-harness-next` / `homeSuffix:'-next'` / `portBands:[[13000,13049]]`），把 `HOST_PORT_BANDS` 收窄为 `[[3181,3199]]`，并在 `tests/next-host/` 里做了 13000 带内的真实 boot 与六条 native-API 断言；本地重建的宿主被判 `DRIFTED`（资产仍取已发布 `0.1.2`）。#786 `f46bcdd29` 把 M7-B1 的可信 FS 观测窗口落地（hosted `M7B1-ARM inside-authorized verdict=SATISFIED`）。因此"G1 前置三条"里**两条已有实物**，剩下的是旧路径可运行回归基线（G1-S4）。剩余缺口（跨代 home 的 typed 拒绝、sha 变异自检、legacy 双跑差异记录）逐条列在 [`ute-prep-20261116/04`](../ute-prep-20261116/04-FIRST-SLICES-G0-G1.md) §1.5。

**G1 的前置只有三条**（`ute-prep-20261116/05` §2）：新宿主可复现运行；M7-B1 最小可信 FS 窗口；旧路径可运行回归基线。B5–B9 收集归档、host 构建缓存身份修复、census 调优、L3 evals **都不是** G1 前置。

## 2. G0–G5
| Gate | 工作 | 成功条件 |
|---|---|---|
| G0 frozen baseline | 第二棵 pinned 宿主树（rc.5）+ 代际登记 + 空载启动与公开 seam 探针（G0-S1/S2） | 两棵树并存且 realpath 不同；跨代 home/port 复用被机械拒绝；rc.5 可复现启动；**无** v0.1.6 代码/authority/发布副作用。**现状**：G0-S1 已落地（#787，pin/tree/端口分带/资产身份），G0-S2 部分落地（真实 boot + 六条 native-API 断言；未知 agent typed 失败与 legacy 双跑差异**未做**） |
| G1 latest host integration | FS / Web / settlement 三条纵切（G1-S1…S3）+ 旧路径基线（S4）+ S2 探测（S5） | 每片带**真实负控 + 旧路径对照 + 退役条件**；S1 结算事实成立；S2 要么有可等待点方案、要么是 `CORE_SEAM_BLOCKER` |
| G2 binding+scope | Agent Execution Scope 扩至 Leader/Officer/Member；统一 native `apply`、Definition/Service 证明 | 每一个受管工具唯一绑定、失配拒绝、不落 inherited 旧定义 |
| G3 I/O/OS enforcement | FS/Web/Subprocess/PTY 统一 Boundary，Landlock/bwrap/netns 能力探测 | 逐轴允许+禁止、真实文件/网络效果负控；不可兑现=UNSUPPORTED |
| G4 settlement+recovery | ExecutionId、单一写入、Stop/撤销/PTY/PTC/崩溃 | 已消费调用可查询一个事实或 unknown；无暗中 replay；进程真实排空 |
| G5 retire+release | 对照后逐项退役旧 Family/ToolPlane；打包、升级、非 Team 回归 | zero redundant body、包可独立安装、版本化真实验收账本 |

## 3. 纵切代表项

**[updated 2026-11-16 UTE-Prep]** 本节是"最终要覆盖哪些族"，不是"第一批做什么"。首批纵切（每个都是一次可评审的 PR）见 [`ute-prep-20261116/04`](../ute-prep-20261116/04-FIRST-SLICES-G0-G1.md)：

| ID | 切片 | 一句话验收 |
|---|---|---|
| G0-S1 | 第二棵 pinned 宿主树 + 代际登记 | 跨代 home/port 复用被 typed 拒绝，且零进程创建 |
| G0-S2 | rc.5 空载启动 + 公开 seam 探针 | `resolve`/`ResolvedToolSet`/`setExecutor` 形状 + 未知 agent 的 typed 失败 |
| G1-S1 | FS 纵切（read/write） | 越界写入被拒**且文件不存在**；"只检查字符串路径"的 mutation 必须红 |
| G1-S2 | `web_search` 的 `llmProvider` 路由透传 | 代理丢字段时用例红；**语义变化**，需 owner 批准 |
| G1-S3 | S1 结算事实 | dispatch 后 kill -9 ⇒ `EXECUTION_UNCONFIRMED`，不是 succeeded |
| G1-S4 | 旧路径可运行回归基线 | 基线自身有"改语义必须红"的负控 |
| G1-S5 | S2 探测（只调查） | 可等待点方案 **或** `CORE_SEAM_BLOCKER` |

> **落地状态（2026-11-18）**：G0-S1 已落地（#787），G0-S2 部分落地（缺"未绑定 agent 的 typed 失败"与"同探针在 legacy 树上双跑并记录差异"）。G1-S1…S5 **全部待办**；其中 G1-S1/G1-S3 的观测前置（M7-B1 FS 窗口）已由 #786 提供。逐条缺口见 [`ute-prep-20261116/04`](../ute-prep-20261116/04-FIRST-SLICES-G0-G1.md) §1.5。

最终族覆盖不变：`read/write`（受信 FS）、`grep/glob`（同步 spawn + Landlock rg）、`bash persistent`（原生 PTY + OS Profile 代际）、`web_fetch/web_search`（受控 Web）、`run_code`（PTC 直接 Node I/O 与 nested ToolCall）。每个至少正控与真实拒绝；不仅检测返回文案，还检测实际文件未落盘、web 服务器零连接、OS 子进程的 kernel refusal 与终止状态。第三方新的 CLI 验证**无需新增 Team ToolDefinition**即可接入。

**两条不可协商的规则**（全文见 04 §3）：**（i）退役顺序**——任何工具族都不得在新路径被证明等价、或语义变化已记录并获 owner 批准之前退役；**（ii）效果域不可外推**——FS 的成功永不推出 Bash/PTC/PTY 的隔离或恢复安全。rc.5 上目前只有 filesystem 效果域被观测，process/PTY/network 仍 `instrumented:false`（M7-B）。

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

**[updated 2026-11-16 UTE-Prep]** 前两条已裁决（不再是待裁决项），保留原问句以便追溯：

- ~~是否将 G4 的"Host 最终结果返回前事实已持久"从强化目标提升为硬门~~ → **已裁**：拆成 S1（硬保证：fact-or-unknown，G1 验收条件）与 S2（独立更强门：commit-before-return，不是 G1 前置）。见 [`ute-prep-20261116/03`](../ute-prep-20261116/03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) 裁决 2。
- ~~是否由单独 Authority Migration 允许最小基础设施 Fork~~ → **已裁**：允许，但作为**最小、具名、逐个批准、可退役**的例外，且先报 `CORE_SEAM_BLOCKER` 再申请；条文仍待 owner 写入 `AGENTS.md`（补丁见 [`ute-prep-20261116/06`](../ute-prep-20261116/06-PROPOSED-ACTIVE-PLAN-PATCH.md) B）。
- 是否随新版一起完成 AER 的 Leader/Officer execution scope、F-2 Goal Domain 分类的行为迁移，或分别提交不影响相互进度的受审 PR；顶层设计已给出相容关系。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
