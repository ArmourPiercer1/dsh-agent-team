# Engineering Baseline：目标工程系统架构（设计草案）

> **状态：PROPOSED / DESIGN ONLY / NOT AN ACTIVE PLAN。** 2026-10-24。本文承接用户已批准的八项原则性架构方向；文档合并、裁决生效、代码实现、真实 Host 验收、产品发布是五种不同事实。本 PR 仅供审查，**不修改 Alpha.5 当前执行协议，不授权 E1–E5 开工或 Alpha.6 开工**。
>
> **调查代码截面**：Team `master@929fc4af23725a1de4cda9206eb7abb149b1bf12`（#357 M0 / #358 M1 已合；#360 M2 Draft，不能视为装配完成）；现行测试 Host Pin 读取 `tests/paths.mjs`（调查时 DSH `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`）。本文提到的目标命令、目录、Schema 均为拟议，**不能当作已存在的 API**。
>
> **原则变更 R2**：工具基线**不允许是固定的工具名白名单**。它只能通过可信的上游工具来源、Team 受审代码/注册声明、可信配置与真实运行时观察而演化；每次测试的有效来源截面则固定哈希、可复现。新工具自动进入待审范围，**不会自动获得治理许可或“已测试”状态**。

## 1. 问题、目标与禁止事项

### 1.1 现存问题及依据

- 九包产品结构已经存在；`packages/runtime/src/plugin/host.ts`、`root.ts`、`src/plugin/live/agent-bindings.mjs`、`team-tool-plane.mjs` 是高冲突的中心装配路径。M2 工具适配已经出现 C1 PASS 但未 mount/C2 pending 的状态（#360）。
- `dev/agent-workflow/graph.yaml` 同时承载现期 `current_contract` 与大量历史轮次，`docs/STATUS.md` 亦包含历史执行轨迹；人工合并多个当前状态易发生漂移。
- `.github/workflows/pr-gate.yml` 与 `census-runtime.yml` 采用不同验证口径；`scripts/ci-pr-gate.mjs` 有具名 pass/fail/skip/refused、失败身份差集等基础，但尚未形成轻重分层的增量测试系统。
- `tests/paths.mjs`、`tests/characterization/lib/instance.mjs`、`tests/kits/rc2-real-host-smoke/run-control.mjs`、`packages/runtime/root-binding/harness/bounded-run.mjs` 已提供 Pin、世界位置、启动和有界收束原语，但缺少正式跨进程资源调度和多 World 验证。
- Alpha.5 M0-B 的 93 个来源记录、27 个 family 是**一次设计截面的分类和验收索引**，不是未来 DSH/Team/MCP 工具全集的永恒上限。现有矩阵还有尚未证实的接线与动态工具缺口。

### 1.2 工程目标

开发者/Agent 能以有限的当前契约理解变更；从 Contract → 局部实现/C1 → 中心真实装配/C2 → 相关安全门禁 → PR 合并形成短闭环；在一个明确的产品与 Host 截面上完成 C3/发布验证；测试可并发、状态可信、失败可定位、版本可回退。

### 1.3 不可改变的产品法律

1. 维护 `contracts/domain/storage/runtime/tools/remote/client/legacy/testkit` 九包责任；不因基线建设产生第十个生产包。`testkit` 不被生产代码引用。
2. **CORE PATCH BUDGET = 0**；仅使用固定 Host 版本的公开 DSH Seam。缺口为具名 `CORE_SEAM_BLOCKER`，禁止私有 import、打补丁或秘密降级。
3. **TeamDomain 为 Team 控制面的持久事实权威**；不增加 Team SessionEvent、不创建第三个授权账本。
4. 保持 Alpha.4 ControlService/ApprovalCase 与 Alpha.5 PA Admission、Effects、双 Envelope、ExternalHard、单次 Grant、Provider/Lease 的原义；测试/文档系统不得新增授权入口。
5. 非 Team Session 保持原生 DSH 工具行为，不因 Team 治理而意外限制或扩大。
6. 保持 `master` alpha、`stable` RC 的既有策略及正式发布裁决。稳定开发实例与人类 DSH_HOME 不得被测试或清理工具触碰。
7. Alpha.5 必交功能仍按既有 M0、C1/C2/C3 与全工具发布门验收，不能通过本工程基线重定义为“部分工具试用”或“全部拒绝”。

**非目标**：不重写权限核心/Blueprint/Team Domain，不预先实现 Alpha.6，不为本次重构引入容器编排、遥测数据库或新开发平台；不以文件长度、测试数、PR 数量替代行为改善。

## 2. 三平面架构与责任

```text
工程控制面（规范/术语/决策/需求/任务/Owner）
     ├─ Agent 任务与单 Writer 代码归属 ─────────────┐
     ├─ 来源驱动工具目录 + 需求→测试影响图          │
     └─ 当前状态派生视图（只读）                   │
                                                 ▼
产品执行面：DSH 公开 Host → Team Scope/ToolBinding → Effects 分类
           → PA Admit → 既有 ControlService（需要 Ask 时）
           → Granted Prepare → Fresh Recheck → PA Consume
           → 已验证 Provider/真实 Body → 实际结果/Lease
                                                 │
                                                 ▼
验证证据面：T0/T1 → 真装配 T2 → 真 Host T3 → 综合 T4
           独立 TestWorld → CI verdict → 不可变 RUN manifest
                                                 │
                                                 ▼
                              同候选 SHA 证明 / RC 裁决
```

| 责任 | 长期 Owner/物理落位 | 不得承担的内容 |
|---|---|---|
| 行为/术语规范 | `docs/glossary.md`、`docs/terminology.md`、owning `docs/contracts` 与包类型 | 从测试绿灯自行推断用户批准 |
| 决策理由 | 目标 `.agents/notes/{proposed,implemented,rejected,archived}` | 当期排期、验收日志 |
| 执行状态 | 轻量版本化 Registry + Git/CI 派生视图 | 自动写入产品授权事实 |
| 工具来源目录 | DSH 公开 Registry/版本化 Host、Team 声明、可信 profile 与动态运行时观察 | 手写封闭名单；用“发现”代替审批 |
| 中心装配 | `runtime` Host/agent-binding/tool-plane/PA-Control Bridge 唯一 Integrator | 包办各工具业务适配或重复开发 Grant 法律 |
| 工具适配 | `tools/a5p5-tools` 与 family-owned Adapter/Provider | 自行 mint/consume 权限、名义上隔离实际 native fallback |
| 测试与隔离 | `testkit`、`tests/*`、CI | 改写生产数据、把已知错误替换为永久允许失败 |
| 证据与发布 | RUN manifest、CI Artifact、固定构建与 RC 门 | 修改权限或重释过去的验收结果 |

## 3. 权威状态与语义文档

### 3.1 四类真值及物理设计

- **Normative**：已正式批准的合同/安全不变量及生效决策；现有冻结设计语义在经单独迁移裁决前保持有效。
- **Implementation**：已合并源码、Schema、当前构建、实际注册/配置；不由进度文档决定。
- **Verification**：绑定完整候选 SHA、Host Pin、配置/构建哈希、测试层次的真实 RUN 结果。
- **Execution**：活动阶段、依赖、Owner、阻断与下一个交付单元。

目标 `dev/engineering/registry.yaml` **只人工维护无法可靠推导的决定/任务引用**；`dev/engineering/current-state.json` 为生成的只读统一视图，从登记、Git、CI 与运行时发现记录拼装。生成视图不是新的可写权限事实。既有 `graph.yaml#current_contract` 及 `scripts/ci-pr-gate.mjs` 在 E1/E3 未通过迁移门前仍是当前执行权威；不得同时维护两套可编辑状态。

关键状态轴：`decision_status` / `implementation_status` / `verification_status` / `release_status`，**分别记录、不互相蕴含**。允许 `accepted + merged + not_verified + release_blocked`。机器规则须能注入“只有人工写已测试、没有 RUN 证据”的负例并拒绝。

### 3.2 DSH 文档治理机制复用

1. `docs/glossary.md`：概念 ID、准确语义、反例/易混概念、继承 DSH 或 Team 特有来源；一概念一个术语。
2. `docs/terminology.md`：中英文、首次使用写法和不推荐混用的同义词；不复制完整语义。
3. `docs/contracts/`：规范 REQ/INV/AC，含权限、时序、错误、持久化、兼容边界；代码只是实现事实，不通过实现困难自行削弱规范。
4. `docs/ideas/`：轻量构想收件箱，无实现授权；只有成熟且获裁决后进入 proposed Agent Note/合同。
5. `.agents/notes/`：采用 DSH `proposed/implemented/rejected/archived` 的生命周期及分类/格式校验。**批准但未实现**保持 proposed 生命周期，在独立批准记录中表达 `accepted`；只有交付并经适当验证才转 implemented；重要 supersession 交叉引用并归档。
6. `docs/plans/active` 仅管理任务依赖、Owner、执行批次和退出门；完成后归档；长期测试与验收不随计划归档。
7. 根 `AGENTS.md` 只保留常驻纪律与导航，包边界放 package README，事故归 postmortem，步骤放 Cookbook/Skill，生成型工具/API 目录来自源码而不是复制粘贴。

直接复用 DSH 的 Agent Note 文档模型、分类/格式校验、链接/预算校验以及 doc-quick/doc-sync 双阶段编排；适配许可证、相对路径、TS 项目布局。**不直接复制** DSH 的网站、双语 sidecar 与 Session 特有生成器。新增 `verify-semantic-contracts` 检查 ID 唯一、术语/弃用词、规范引用、声明签名来源及影响关系；自然语言语义的真实等价性仍需 Contract Owner + 回归测试判断。

关键歧义需要固定：DSH `Agent Scope` ≠ Team `ToolBinding` ≠ `ControlOperationScope`；`ApprovalCase` ≠ Control consumption ≠ PA consumption ≠ Provider settlement；同级 `handoff` ≠ 升权 `escalate`；DSH `turn/step/round` 不允许按 Team 轮次随意重命名；工程 Code Review ≠ 运行时审批。


### 3.3 文档—源码一致性机制：通用快探针 + 完整校验

**必须建设，而不是可选增强。** 直接借鉴 DSH 的 `test:docs`（doc-quick）/`doc-sync` 分层、`change-scope` 影响面、`verify-agent-note-format`、`verify-md-links`、`verify-type-equiv`、`verify-doc-budgets` 和从真实注册结果生成目录的机制；遵守上游许可证并按本仓库九包布局适配，不引入 DSH 网站/双语维护等与本项目无关的整个工具链。DSH 同时要求所有涉及命令、默认行为、错误或兼容承诺的当前态文档，**先执行所宣称的操作并核实结果，再宣称其为事实**；这不意味着禁止先写提案，或让每个改动在本地先跑全套 E2E。

拟议入口（**目前不存在**）：

| 入口 | 主要职责 | 触发范围 |
|---|---|---|
| `pnpm docs:probe --base <verified-base>` | 快探针：解析真实 Git 变更（含 committed/staged/unstaged）、寻找受影响文档 owner、链接、Agent Note 状态、Glossary/术语、REQ/INV/AC、引用的源符号/配置及验证声明；输出机器可读选择与缺口 | 本地修改后/提交前主动执行；所有 PR 的 `ci-fast` 必需检查，分别在分支及合并候选上复核 |
| `pnpm docs:sync --check` | 完整文档校验：所有适用静态规则、公开 API/Schema 类型等价、生成工具/配置/注册目录新鲜度、跨包文档关系及必须保留的操作验证证据 | 文档/公共 API/配置/生成器等影响面，CI 根据依赖图触发；完整基线/发布验收 |
| `pnpm docs:sync --write` | **显式、可审查地**从权威源重新生成派生文档，输出 diff，不自动更改合同、批准状态或测试结果 | 文档维护者主动调用；CI 只用 `--check`，永不自动修绿 |

`docs:probe` 不是格式化脚本，其最小管线必须包含：

1. **变更识别**：借鉴 DSH `scripts/change-scope.ts`，对选定且已核实的 PR base 计算实际 merge-base/HEAD 以及工作树未提交改动；区分纯文档/现有接口兼容变化与真实公共行为/Schema/Registry 变更。基线参数不可默认为未经核实的远端 HEAD。
2. **归属与语义检查**：从版本化的源码→公共接口→owning 文档→INV/REQ/AC→TEST/PROFILE 映射判断应更新/复核的责任面；一个事实只有一位文档 owner。检验 Agent Note 提案/批准/已实现状态、失效链接、重复 ID、弃用术语和悬空引用。`docs/ideas` 或 proposed 决策可以描述将来行为，但不能自称已交付。
3. **源码与派生目录核对**：直接对 TypeScript AST/编译器符号及被登记为 source-equivalent 的文档块检查；导出/JSON Schema/工具注册及配置目录由现有代码或真实受信注册源生成，执行无副作用的 freshness check。动态 MCP 与不同 Scope 的目录不能由静态名称枚举“证明全部已测”，与第 4 章 Runtime Census 共用来源身份/digest。
4. **事实宣称与证据**：已实现/支持/已测试/已发布等声明需指向真实源码、当前 Host/产物及适用的 RUN 或实测步骤；缺失、过期或未执行时标记 `NOT_VERIFIED` / `REFUSED`，在必须证明的正式文档/PR 合并门禁上阻断。机器仅检验可决定的事实；无法证明的行为语义交给 Contract Owner 与实际 T1–T3，**不以正则匹配证明某权限副作用从未发生**。

**负控与边界**：主动破坏一次类型定义、生成工具目录、Agent Note 生命周期、公开行为文档引用及“只有 C1 却宣称 C2 已通过”的记录，快探针/完整校验必须在其承诺的检查范围内正确失败；仅由不可解析的动态 import 驱动的改动必须扩大验证或报告 `UNKNOWN`，不能因测试选择器返回空集合而绿。T0 文档快探针不能替代真正的 Tool/Host C2、C3、安全负控或权限核心。

**性能与纪律**：本地可缓存按文件/符号变化的确定性检查，目标普通变更 10–30 秒、复杂变更约 60 秒以内（拟议性能预算，E0 测量后裁定）；昂贵生成与真实运行移至 `docs:sync --check` 和受影响 T2/T3。Lefthook 风格 Git hook 仅放可重复、低耗时的 staged 基础检查，不把完整同步/E2E 绑到每次 commit；Git hook 不能替代服务器端 CI。凡与已发布产品行为相关的文档声明，都必须由明确的执行命令/外部观察证据核实，不能先写“当前支持”再指望后续测试补证。

## 4. 动态权威工具基线（第 2 项修正，核心决策）

### 4.1 基线必须是可变的，但不得由普通发现数据任意放宽

区分以下四种对象：

| 对象 | 内容及来源 | 可变性/约束 |
|---|---|---|
| `AuthoritativeToolSources` | ①经正式 Host 升级流程认可的 DSH commit 及其公开注册事实；②Team 已受审源码及注册声明；③由合法操作者/可信产品配置明确选择的安装 profile、MCP server/Provider 定义与能力策略 | 来源可随受审变更演化；模型自报、日志与旧矩阵不可改它 |
| `ExpectedToolObligations` | 由这些来源按部署 profile、scope class、条件启用/禁用规则派生的“应该被清点及治理的来源身份、工具族和所需测试” | 只允许通过来源差异触发重新生成，不允许手改生成文件 |
| `ObservedRuntimeInventory` | 实际测试实例的 DSH Registry、Agent Scope、ToolBinding、Provider 和动态 MCP 列表的只读观察 | 每次/每配置重新发现；远端 MCP 列表只证明它声称与实际注册了什么，不提供权限依据 |
| `VerifiedSnapshot` | `sources digest + product SHA + Host SHA + profile/config digest + scope/registry generation + observed inventory + RUN` | 单次验证严格不可变；不同候选或正式来源更新会生成新的截面 |

必须同时保留两个概念：

- **演化的目录基线**：新的上游工具、Team 工具及经受信配置加入的动态 MCP 工具自动进入待对账集合；旧项可随受审撤销/退役移出当前预期。
- **冻结的验证截面**：一个 CI/RC 结果只对该次精确来源与运行事实成立，绝不因目录后来更新而追认过去的未测工具。

M0-B **93 来源记录/27 family** 作为首轮**历史设计种子和导入映射**保留，绝不成为未来的硬编码封闭全集。任何清点结论均限定到具体 Host、Profile、Agent Scope、激活上下文及动态连接状态，不能声称“所有未来 MCP 工具都已覆盖”。

### 4.2 来源变更的权限与实现流程

合法更新事件包括：受审的 Host Pin 升级、Team 工具注册代码/合同变更、合法操作者的 profile/plugin/MCP 配置变更、可信动态服务列表变化。变更流程：

```text
受审来源 / 可信配置发生变化
       ↓
读取来源 commit、配置与注册身份 → 生成预期来源目录
       ↓
启动隔离测试 World、按 scope/条件采集实际 Registry
       ↓
按来源标识+scope 类别对账，记录新增/删除/变更/别名/冲突
       ↓
生成缺口：合同 family、Effects、Provider 保证、C1/C2/C3 需求
       ↓
未经分类/真实接管/必要测试的新增项：UNKNOWN / NOT_VERIFIED
       ↓
仅在权威合同、治理及 RUN 均满足后：可进入已测试/发布范围
```

识别采用双层 Key：

- 稳定**来源身份**：`sourceKind/sourceId + nativeName + declared scope class + optional variant`。MCP 必须保留 `serverName + rawName`；模型可见规范化名称只做展示/选择，不用它反推来源。
- 实际**调用绑定身份**：`exec.agent/agentScopeKey + actual registered Definition + current bindingId/revision + providerId/realm + authority/policy generation`；作用域和绑定相等性按 Host/Team 现有可信接口判断，不从字符串臆造 Host symbol。

DSH 固定 Host 支持 `ctx.tools.schemas(scope)`、`get(name, scope)` 等公开观察点；`pa-mount-registry.mjs` 现有唯一 ACTIVE Binding 验证逻辑可复用。运行时枚举仅生成**观测记录**，不能替代真正的 Guard、Mask、Provider 和 Body 路径校验。

### 4.3 变化与安全判定

- 新增已授权来源中的工具：应自动发现并创建 **“需分类、需接线、需验证”** 义务；不能因目录里出现即列为通过或默认为可执行。
- 未声明来源/Scope 的工具：对于受治理 Team 执行面按现有 closed-world 规则拒绝或阻断安装，并给出具名缺口；**不得影响普通非 Team 会话的原生工具语义**。
- 上游工具删除/重命名：更新预期来源并产生兼容性差异；已发布承诺是否退役由正式合同裁决，不是“工具消失了所以测试可以删”。
- 原生工具同名、MCP 名称归一化碰撞、动态注册刷新：各自保留来源/Scope/Provider 实际身份；冲突、替换、代际漂移需负控。单次快照期间变化必须重采或拒绝该快照，不允许无声合并两代数据。
- 产品上游 Pin 变化：**仅通过显式升级 PR** 修改 `tests/paths.mjs` 的权威 Pin 与相关入口；不能自动跟随最新 master。新 Pin 会自动重建工具基线并触发差异分析、真实 Host 复测。
- Tool Census 校验器不得写任何产品权限表、Grant、ControlDecision 或 Host Registry；检测到异常只输出差异和测试选择/发布阻断。

长期状态仍采用用户定义的**未开发/未接线/接线未测/已测试**四档。附列 C1/C2/C3、实际正负控、验证时间、Host/产品 SHA 和阻断原因；只通过 C1 不能标“已测试”，纯 Guard 全拒不是功能验收。

## 5. 需求—契约—验收—测试的永久关系

| 类型 | 标识 | 权威 | 生命周期 |
|---|---|---|---|
| Idea | `IDEA-*` | Idea/Issue | 无执行权，允许搁置 |
| Decision | `ADR-*` | 具有批准来源的 Agent Note/决策登记 | proposed/accepted/implemented/superseded 等分轴 |
| Requirement / Invariant | `REQ-*` / `INV-*` | 当前 owning Contract | 跨阶段持久 |
| Acceptance criterion | `AC-*` | 规范合同中的外部可观察正反结果 | 跨阶段持久 |
| Test/Profile | `TEST-*` / `PROFILE-*` | owning 包测试与版本化测试策略 | 合同仍有效时持续维护 |
| RUN | `RUN-*` | 不可变真实执行 Manifest | 绑定实际候选与环境 |
| Plan | `PLAN-*` | 一段实施任务的 Owner/依赖/批次/退出条件 | 可以归档，但不能删除长期测试责任 |

```text
Idea →（正式成熟化与裁决）→ ADR/REQ/INV → AC（正/负）
                                      ↓
                              owning TEST / PROFILE
                                      ↓
                              真实 RUN + 当前代码来源
                                      ↓
                              PR 与 RC 的门禁判定
PLAN 仅引用 ADR/REQ/AC/PROFILE/OWNER，不再复制规范全文。
```

Alpha.5 M0 记录与现有 C1/C2/C3 通过一次性导入映射成为长期合同引用；不要为每条来源记录手工创建冗余新规范。第一批通用 INV 建议覆盖：可信 ACTIVE Binding、完整 Effects/双 Envelope、Ask 前零未授权副作用、Control 与 PA 各自单次消费、取消/重启不重放、禁止原生回退、非 Team 原生隔离、真实结果/不确定终止。**迁移必须确认原合同生效状态；不能把仓内 PROPOSED 文本自动提升为正式法律。**

未来 Alpha.6 可追加 Review/Mandate/Single-flight 的 AC、T2/T3 并发场景，仍引用原授权不变量；更晚的 UI/调度/工作区纪律功能也使用同一接口，不需要复制 Alpha.6 审批术语。非权限类 `DisciplineFinding` 不等于 `ControlDecision`。

## 6. 测试分层与可靠 Host World

### 6.1 五层验证

| 层 | 证明什么 | 默认成本 |
|---|---|---|
| T0 静态与合同 | Schema、依赖、注册目录、语义/文档/生成目录、构建入口 | 最小 |
| T1 包单元 | Domain、Control/PA 算法、参数/Effects、Adapter；仅 Mock 非确定性外边界 | 低 |
| T2 真实装配 | owning Registry、Scope、Binding、PA/Control、Backend 实际路径及外部效果 | 中 |
| T3 真实 Host | 固定 DSH 公共 Loader、真实打包入口、Team/非 Team、取消/重启、OS 隔离 | 较高 |
| T4 综合发布 | 同候选全工具组合、跨平台、性能、真实模型/发布恢复 | 高 |

T2/T3 必须观察文件、网络、进程、TeamDomain 或用户可见响应，不以“Guard 返回 true/false”或模型自述替代外部事实。安全关键路径至少需要正控、零效果负控与“注入缺陷应变红”的测试敏感性验证。

### 6.2 TestWorldFactory：重用旧设施，不造新 Host

提供目标接口：`createWorld({hostPin, pluginArtifact, profile, capabilities})` → `runScenario / assertEffects / collectEvidence / dispose`。实现在 `tests/` 与 `packages/testkit`，不是第十个生产包。

- 只读 Host 构建基座按 Host SHA/锁文件/工具链哈希缓存；每世界独立 DSH_HOME、workspace、Provider mock、日志、PID 组与注册代际。
- 沿用 `tests/paths.mjs` 现有 3180–3186 / 3491–3500 端口范围，稳定 3080 不可用；跨进程原子租约只协调本项目测试进程，外部占用失败必须显式报告。**不悄然改为任意动态端口**。
- 当前 `run-control.mjs`/有界 watchdog 是进程所有权基础；POSIX 结束进程组并等待退出；Windows 子进程树保障须用真实平台能力验证，不假定 `kill()` 等于进程树停止。
- 资源分为 `world-local`、`shared-locked`、`exclusive`。固定共享端口/缓存写入单独加锁，Host Pin 迁移、破坏性恢复、用户世界保护另走独占通道。
- 初始 2 个真实 Host 世界并行，完成崩溃与隔离负控后按测得吞吐扩展到 3–4；不先承诺加大并发就更快。
- 任何自动清理只能触及该测试创建并确切拥有的 World；用户 Home、活动 Worktree、受保护证据一律禁止通过路径猜测清理。

### 6.3 已知失败债务

短期保留差集判定，逐项建立 `owner/classification/firstSeen/exitCondition/affectedProfile/evidence`。现有九包 Census 记录的九条红线及另一个 Root Suite 的历史失败集合需分开调查；**不能混作同一“默认已通过”结果**。产品缺陷、测试错误、环境不具备、历史兼容分别归因。安全关键红不得新增永久豁免；测试 collection 失败不能使红灯消失而被标为修复。

## 7. CI、构建与可核验证据

### 7.1 四条门禁

| CI 入口 | 选择器 | 合并约束 |
|---|---|---|
| `ci-fast` | 每 PR：`docs:probe` + T0 + owning T1 + typecheck/构建元信息；相关变更选择 `docs:sync --check` | 必需；必要文档校验缺席不得绿 |
| `ci-integration` | Host/接口/真实装配变更的相关 T2，关键建包入口 | 相关 PR 必需 |
| `ci-security` | 权限/工具/Provider/动态来源/取消/恢复变更的真实负控 T2/T3 | 安全相关 PR 必需 |
| `ci-full` | 完整 T3/T4、平台矩阵、全工具实际来源截面、发布恢复 | 发布候选/指定里程碑必需 |

GitHub PR 验证合成 merge tree，分支内快探针与局部 C2 不能代替该候选下的文档/公共装配检查；`ci-required` 使用 `always()` 汇总真实依赖检查。依赖缺测、环境阻断、skip/refused 必须如实编码：必需门禁中不能变成 PASS。变更影响图来自源码依赖、模块 Owner、长期合同、动态工具来源差异；未知影响面只可扩大相关检测，不得缩成空集合。

目标性能预算（E0 测量后裁剪，非保证）：`docs:probe` 普通变更 10–30 秒、复杂变更约 60 秒，`ci-fast` p95 ≤5 分钟，本地局部反馈 ≤2 分钟；相关 T2/T3 有界并行。CI 快不能通过删掉唯一真安全验证取得。

### 7.2 证据 Manifest 与仓库大小

RUN 至少绑定 `sourceSha, syntheticMergeSha?, hostSha, lock/toolchain hashes, package sha256, trustedSourcesDigest, runtimeInventoryDigest, profile/config digest, testWorldId, selected/observed tests, verdict per leg, negative control ids, artifact URL + digest`。文件哈希、Host 源及结果必须能被独立重新检查；静态测试声明与 RUN 事实不同。

分类为 A（发布/关键安全/不可替代复现，长期保护）、B（阶段性工程证据，受控限期保留）、C（重复普通日志/缓存/临时 World，自动清理）；可采用 B 失败 30 天、阶段证据 ≥90 天等初始策略，具体受存储服务保留能力限制。大型原始日志移出 Git，新 Git 只保留脱敏摘要与不可变索引；重用现有 `scripts/sanitize-evidence.mjs` 及 SHA 复核。不自动重写 Git 历史，不以“难以复现”作为全部保留依据。

### 7.3 运行诊断与发布

以受信 `invocationCorrelation` 关联当前 Binding、effects digest、Control Case/decision/consumption、PA grant-consumption、Provider begin/settle、Lease cancellation。日志只从权威读/提交点派生，**绝不是第三本授权账本**；敏感路径、token、payload 不明文重复保存。

发布维持 `master/stable` 分离；Artifact 有真实 Host/插件/配置来源，冷启动、非 Team 隔离、用户 Home 保护与回退或前滚恢复预案。对不可逆数据迁移不得承诺无条件降级。

## 8. 多 Agent 并行变更与持续交付纪律

### 8.1 Writer 的独占单位是语义影响面，而不是物理文件

一个交付单元对应**一条任务责任、一个独立分支/Worktree、明确的代码影响面**。**每个 Worktree/集成分支同一时刻只有一个 Writer**；但多个 Worktree 允许独立、并行地修改同一物理源文件。单个中心文件碰巧包含多个工具 family 接线区域，不构成强制让所有 Agent 串行开发的理由。是否可以并行，取决于**共享契约、调用顺序、权限不变量及状态所有权是否耦合**，而不是 `git diff --name-only` 的文件路径是否重合。

| 影响面等级 | 示例 | 并发与 Owner |
|---|---|---|
| A：相互独立的 family 实现 | Todo/Write/Image 各自的 Adapter、参数/Effects、业务 Provider、测试 | 各 family 一位实现 Owner，自由并行、独立 Worktree |
| B：同一源文件中的独立接线增量 | 各 family 在 `agent-bindings.mjs` 捕获自己的 native definition/Arm，在 `team-tool-plane.mjs` 声明自己的注册贡献 | **允许不同 Worktree 并发写同文件**；各自承担工具纵切/C1/局部真实 Host C2；集成后重跑相应范围 |
| C：共享语义和安全核心 | `paAdmit`、Control/PA 消费、Scope/Binding 可信身份、统一注册顺序、共同 teardown、全局接口/Schema | **唯一契约决策 Owner**；修改前先协调接口与安全证明；不因源文件不同而认定安全独立 |

**重要区别**：文本冲突≠语义冲突。两个分支都改 `allDefs` 的插入点可能仅是文本重叠；两个分支虽改不同文件但都更改授权消费顺序则是共享语义冲突。不能靠 Git 自动合并零冲突证明两者可组合，也不能因为出现文本冲突而直接取消独立开发。

### 8.2 Center Integrator 拥有集成责任，不垄断工具接线代码

| 角色 | 必需责任 | 不能宣称 |
|---|---|---|
| Contract/Security Owner | 审定共享接口、授权/状态/生命周期不变量及可复用验证义务 | 不凭局部 C1/C2 结果放宽核心法律 |
| Family Owner | 在自己的 Worktree **完成 Adapter + 实际中心接线增量 + C1 + branch-local 真实 Host C2 正负控**，可直接编辑副本中的共享文件 | `branch-local C2` 不等于最终合并候选的 C2 |
| Center Integrator | 唯一更新集成候选分支，按序合并已验证增量，裁解文本/语义冲突，检查跨 family 的真实装配与统一授权链，组织 merged-head C2 和安全负控 | 不必自己编写所有 family 接线实现，也不应在每批合并后无条件重跑全量 C3 |
| Independent Reviewer/CI | 审查相关合同、集成 diff、测试的外部事实与合并 SHA，指出未覆盖的关键影响 | 不以自己未验证的分支测试替代合并后证据 |

一条标准交付链为：`Contract/Seam 固定 → 各 family 分支内 Adapter+接线+C1+局部 C2 → Integrator 在最新候选合并（唯一 Writer）→ 影响面分析 → merged-head C1/C2、共享安全负控与必要跨 family 回归 → 独立 Review/CI → merge`。Integrator 的**合并动作可串行化为短事务**；工具开发和独立 Host C2 不需要等待中心逐一代写。每轮合并需要包含完整构建/安装入口与构建产物一致性证据，不能让本地成功掩盖 `dist` 接线缺失。

并发分支显式登记：基底 SHA、family/功能责任、修改的共享契约和可能冲突的关键状态、局部 C2 证明、回归选择器及相关测试资源。发现两支都要修改 C 类核心，则先裁决并冻结该接口（或将其作为前置共用 PR）后再放行分支增量。Integrator 有权拒绝无法解释的同名注册、重复 Provider/Body、Teardown 丢失、Scope 或 Grant 扩权，即使 Git 合并没有冲突。

### 8.3 长期收敛：让 Family Contribution 降低共享文件写入需求

现有 `team-tool-plane.mjs` / `agent-bindings.mjs` 的手工接线是过渡形态；在 E2/E4 审计证明收益后，可将 family 特有的 native definition 捕获、参数/Provider/呈现、回收接口下沉为 **受信 Family Contribution**，由唯一中心装配器组合和验证。此接口只提出注册/执行需求，**不能直接 mint/consume Grant、绕过 ControlService 或制造第二套授权账本**。优先复用已存在的 `registerA5GovernedFamily`、Placement Feed、Scope Binding 以及现有构建清单机制；不为单纯消除 Git 冲突提前重写 Alpha.5 安全内核。

**吞吐与 WIP**：保留高并发 family 开发、分支内 C2 和低延迟合并，但限制的是“未通过合并候选验证的功能积压”，而非编辑某一个文件的 Agent 人数。评审默认独立 Review→一次针对性修复→复审仍 BLOCK 停止自动重复，升级给该语义 Owner。DevEx 使用既有 `pnpm setup`、`pnpm test`、`scripts/ci-pr-gate.mjs`、`tests/paths.mjs` 为基础，拟增加 `verify:changed/verify:host/verify:security/verify:release` 等命令；本节均为未来目标，不表示现已可执行。

## 9. 原八项裁决与本轮新增设计约束

| ID | 已同意的架构决定 | 必须保持的解释 |
|---|---|---|
| D1 | 人工维护最小工程 Registry，统一当前状态由 Git/CI/合同派生 | 不能把“合并”当“生效/已测”，不得重复编辑 `current-state.json` |
| D2 | 只读 Runtime Tool Census + 实际 Scope/Binding 对账 | **按用户修订：权威来源可变，快照不可变；不是固定 93 行名单；新工具自动纳入验证义务、不自动纳入授权** |
| D3 | 不可变 Host 基座 + World 资源租约，首轮两个并行 World | 保留既有端口范围、3080/人类 Home 禁触碰 |
| D4 | A/B/C 证据分级、Manifest、脱敏与仓外存储 | 不擅自重写历史、不随意清理关键发布/事故证据 |
| D5 | 历史失败债务 Owner/期限/退出，安全新增红不可永久豁免 | 旧根/九包失败集合分开；真实产品缺陷不得测试侧掩盖 |
| D6 | Integration Freeze 而非 Alpha.5 全发布成功，作为基线建设切换条件 | 合同和中心共享接口稳定、阻断归属确定，M1 合并不是独自充分 |
| D7 | 优先沿用 DSH `.agents/notes` 及格式/分类校验 | `accepted` 决策与 `implemented` 交付分轴、Idea 与 ADR 分离 |
| D8 | M0 93 来源项抽取长期 INV/REQ/AC，原项只保留来源索引 | 正式生效须以批准的规范为准，不能将 Draft 自动转换为法律 |
| D9 | 并行 Writer 以相对独立的语义影响面为边界，而非文件路径 | 多个 Worktree 可改同一中心文件并独立验证；共享安全契约需唯一 Owner；集成分支单 Writer，merged-head 复验不能跳过 |
| D10 | DSH 风格通用文档校验为**必建基础设施**，含快速探针 | `docs:probe`/`docs:sync --check` 覆盖源码与文档双向影响；提案允许无产品 RUN，正式行为宣称必须有真实代码/执行证据 |

## 10. 工程验收标准（EB）

| ID | 可观察的退出证据 |
|---|---|
| EB-01 | 九包边界保持；公共 Host 无补丁；共享语义有唯一决策 Owner，集成分支有唯一 Writer，但独立 Worktree 对同文件可并行接线 |
| EB-02 | 四类真值有唯一事实归属；当前状态由可信来源生成，伪造“已测试”不能过门 |
| EB-03 | DSH 术语与 Team 语义、Idea/Note/Contract/Plan 有独立职责；`docs:probe`/`docs:sync --check` 在源码与文档变更中均可触发，结构、类型/目录、证据声明具正负控 |
| EB-04 | 任意阶段 `REQ/INV→AC→TEST/PROFILE→RUN` 可追踪；计划归档不退役仍有效测试 |
| EB-05 | Tool Expected 来源随批准 Host/Team/config 变化再生成，不能手改；新工具进入 UNKNOWN 而非自动放行 |
| EB-06 | 两个独立真实 Host World 可并行、出错可控清理，不触及 3080、稳定 Home 或其他 World |
| EB-07 | 关键 T2/T3 正/负测试证明真实业务效果、无未授权副作用、防 native fallback |
| EB-08 | CI required 真正合并保护，必需 skip/refused/ENV_BLOCK 不被误当绿，精准 SHA/合成提交绑定 |
| EB-09 | 九包旧红分类完整，关键安全问题没有新增永久豁免，collection/error 不隐藏失败 |
| EB-10 | RUN Manifest 绑定源码、Host、工具来源、运行目录、测试选择与结果；A 类证据可恢复校验 |
| EB-11 | 两个 family 在独立 Worktree **并行修改同一中心文件**、各自完成 C1/局部 C2；由 Integrator 合并并在同一新 SHA 上复核受影响 C2/跨 family 安全，记录等待/返工 |
| EB-12 | 审批/Grant/Provider 状态可追踪，RC 有用户 World 保护、安装/冷启动/恢复验证及回退预案 |
| EB-13 | 当前工程基线通过不会使未完成的 Alpha.5 工具变为“已发布”，Alpha.6 仍需单独审定 |
| EB-14 | 源码 API/Schema/工具目录变更造成文档过期时，快探针能指名相关 owner 并失败；仅 C1 的工具伪称已通过 C2 不能过门，正常 Idea/Proposed 文档可通过 |
| EB-15 | 文档快探针按真实 merge-base 与工作树影响面选取检查，缺必要检查时明确拒绝，完整 `docs:sync --check` 与产品 T1–T3 责任区分清楚 |

## 11. 实施阶段、未决的非原则问题与上游参考

**E0（Alpha.5 期间）** 只读审计、必要安全/验证可信度定点修复；**E1** DSH 文档机制、语义与唯一真值，并建设通用 `docs:probe` 首版；**E2** WorldFactory、动态来源导入/清点和 T0–T3 整顿；**E3** 影响图、`docs:probe` 必需门禁、按影响面 `docs:sync --check`、四通道 CI/证据及实际分支保护；**E4** 诊断、发布/恢复、DevEx、性能反馈；**E5** 在一套精确 SHA 上完成 EB 验收。依赖/停工/交付卡见同目录 `execution-plan.md`。

**无新增用户级原则性待决项。** 实施 PoC 必须验证但不阻塞起草：DSH 当前 Pin 对 Scope 注册的公开查询完整度；动态 MCP 列表/变化事件的可信归属；Windows 子进程树清理能力；外部 Artifact 存储的实际保留 SLA；CI 实际分支保护权限；历史红的分类结果。PoC 失败只能形成具名阻断/替代方案报告，不能自动改变已批准安全法律。

**源锚**（相对仓库根）：`README.md`、`AGENTS.md`、`docs/BRANCHING.md`、`docs/TEST_METHODS.md`、`tests/paths.mjs`、`dev/agent-workflow/graph.yaml`、`scripts/ci-pr-gate.mjs`、`scripts/sanitize-evidence.mjs`、`packages/runtime/src/plugin/live/{agent-bindings,team-tool-plane,pa-mount-registry}.mjs`、`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/{M0-A-LIFECYCLE-CONTRACT-v1.1,M0-B-FAMILY-TARGET-CONTRACTS}.md`。研究参照：DSH `docs/AGENTS.md`、`docs/glossary.md`、`.agents/notes/README.md`、`.agents/skills/dsh-doc/SKILL.md`、`.agents/skills/dsh-pre-push-checks/SKILL.md`、`scripts/change-scope.ts`、`scripts/verify-agent-note-format.ts`、`scripts/verify-type-equiv.ts`、`scripts/gen-tool-catalog.ts`、`scripts/run-gates.ts`；`openai/codex/.github/workflows/{README,blocking-ci,postmerge-ci}.md/.yml`（按实际文件后缀查阅）、`anomalyco/opencode/CONTRIBUTING.md` 与 `.github/workflows/test.yml`。参考机制不等于现行 Team 契约。
