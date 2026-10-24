# Engineering Baseline：分阶段实施计划（草案）

> **状态：DRAFT / EXECUTION NOT AUTHORIZED。** 2026-10-24。配套规范：[`architecture.md`](./architecture.md)。此计划在 `docs/plans/memo/`，不是 `docs/plans/active/` 当前执行命令；仅起草/审阅，不开始重构、不变更 Alpha.5 scope、不修改当前 `graph.yaml` 或产品代码。
>
> **起草参考**：Team `master@929fc4af23725a1de4cda9206eb7abb149b1bf12`；DSH 测试 Pin 以 `tests/paths.mjs` 的**执行时实际值**为准，起草时为 `639ed01539...`。M0 #357、M1 #358 已合并，M2 #360 是未合并的 Draft；Alpha.6 #319 仍是设计 Draft。后续实施在新截面重新核对，不得依赖本文中的历史 SHA 自动宣布产品已测。
>
> **授权约束**：用户已接受目标架构八项原则（D2 以权威来源驱动的动态基线为准），但**尚未批准具体施工 PR**。此计划获批准并达到相应进入条件后，按独立任务/分支/Owner 实施。任何需要改变产品权限法律、Core 补丁、扩大/缩减 Alpha.5 必交能力的事项，均为单独用户裁决。

## 0. 执行原则与状态流转

### 0.1 工作何时启动

- **Alpha.5 仍在 M2**：仅允许 E0 的只读清查/统计、无共享写冲突的验证研究；若发现“虚假通过、越权、误删真实用户 World”等现存紧急问题，可单列安全缺陷 PR，按当前 Alpha.5 纪律及用户授权处理。
- **Integration Freeze 出口**（不是 Alpha.5 发布 GO）：M0 中心接口及 PA/Control 语义有效状态明确；M1 代表性真实装配可运行；共享语义 Owner 和唯一集成分支 Writer 明确、跨 Worktree 同文件并发接线的边界已登记；剩余 M2 Adapter/Provider 争议已具名分配；Host 源和已知失败截面可再现。独立确认后启动 E1/E2 的有界施工。
- **E3/E4** 需中心实际接线主干趋稳、并行 test world 基础可复跑；不得把新旧 CI 在高冲突 M2 分支上同时改写。
- **E5** 在一个明确的插件提交/Host Pin/构建产物/可信来源 digest 上验收，后续任何新来源版本重新生成快照，不把工具全集永久冻结。
- **Alpha.6 主体开发**以 E5 的工程基线为首选前置条件，Alpha.6 自身仍需独立批准。外部上游阻断不应无限延缓已稳定部分的 E1/E2，但阻断的产品能力仍不可发布。

### 0.2 全局工作规则

- 一个交付单元 = 独立分支/Worktree、明确的语义影响面及 Owner；**只在同一工作树/集成候选上要求唯一 Writer**。不同 Worktree 可同时修改同一中心文件的独立 Family 接线区域，各自完成 C1/branch-local C2；共同授权法律、身份、代际、生命周期及跨工具共享接口需唯一契约决策 Owner。Center Integrator 负责唯一更新集成分支、冲突裁决及 merged-head 复验，而非代写所有接线。PR 尽量小、回退边界明确。
- 合同先于测试选择、测试选择先于状态“已通过”；必要安全负控始终 fail-closed。**分支内局部 C2 不是合并后 C2**，与同文件相关的两个独立修改即使 Git 无冲突，也须在真实合并候选检查 Registry、Scope、PA/Control、teardown、构建产物及有关工具的外部效果。
- 采用 DSH 风格的双层文档一致性机制：所有 PR 的 `docs:probe` 快检；源码/公共接口/配置/生成目录改变时按影响面执行 `docs:sync --check`，并对当前产品行为声明核对来源及真实运行证据。Idea/Proposed 不因尚未实现而错误失败。它们是 E1/E3 的**必需工作**，不是“有空再做”的可选项。
- 不使用无界“审查→再实现→再审查”。独立 Review → 一轮针对修复 → 再 Review，仍 blocking 的问题升级为有限接口决策和明确处置。
- **无“旧矩阵已测即可通用未来版本”的捷径**。每次来源变化重新对账；但无关已测项的历史证据是否仍适用，可用受审的依赖影响算法判断，不机械重跑整个世界。
- 不自动写新 Baseline、永久降级旧检验、重新标记历史 RUN 或把 `ENV_BLOCK/REFUSED/SKIP` 当成 PASS。
- 触及 `tests/homes`、缓存、Worktree 或证据的清理均先核对活跃使用和路径所有权，不能使用仅按名称/日期扫描删除。

## 1. E0：与 Alpha.5 并行的基线普查

**Owner**：Audit/Contract Reader；**写入边界**：独立调研文档或 CI Artifact，不改 shared runtime、`AGENTS.md`、`graph.yaml`、现有工具矩阵。

| 工作包 | 行动 | 可交付物 | 完成标准 |
|---|---|---|---|
| EB0-1 来源/文档审计 | 对照冻结历史、现行阶段指针、现有文档、DSH 规范，建立四真值来源图 | `baseline-inventory.md` + current/historical 分类 | 当前每个权威入口只有一名维护 Owner；错误引用可指出 |
| EB0-2 测试与 CI 审计 | 盘点各包 test、`testkit`、Root 与九包 Census；统计时间、失败身份、实际 Host 已测范围 | 测试所有权初稿、CI DAG、9 红/22 旧集合区分表 | 不用单次数目冒充完整收集、无隐藏 collection 失败 |
| EB0-3 工具源与注册审计 | 对照 M0 93 条记录、实际 Team/Host 注册代码、DSH 官方目录、配置和动态 MCP | 来源归属图、动态差异和未知项清单 | 93 条只作为种子，不标识为未来完整全集 |
| EB0-4 证据/资源清点 | 统计已跟踪日志、受保护运行世界、活动 Worktree、未保护缓存 | A/B/C 候选清单、误删风险、空间使用报告 | 只读；不给出未经核实的“可安全删除”结论 |
| EB0-5 性能基准 | 测本地 C1、代表 T2、真实 Host 启动、CI 各 Job、C1→C2 等待 | p50/p95 与失败分析 | 数据绑定平台/版本/选择器；不伪造预算 |

**E0 出口**：交付可审计的资产清单、缺口/风险优先级、资源成本和进入 Integration Freeze 的实证检查表。只有安全/正确性现存阻断进入单独紧急变更；普通改造不越过当前 Alpha.5 代码 Owner。

## 2. E1：文档、长期合同与状态权威

**启动条件**：Integration Freeze 经独立核对，文档 Owner 可在不修改 Alpha.5 当前执行入口的情况下建立新入口。

| 实施 PR | 内容与唯一 Owner | 必需验证 |
|---|---|---|
| EB1-A：文档规则 | Doc Owner：采用 DSH Agent Notes 物理目录 `.agents/notes/`、分类/格式脚本、根/子树 Agent 规则与简洁入口；引入 `docs/ideas`，保留原历史 | 新 proposed/implemented/rejected 的正负格式样本、链接/预算检查；无现期权威抢占 |
| EB1-E：通用文档快探针 | Doc/Tooling Owner：优先适配 DSH `change-scope`、文档格式/链接/预算、`verify-type-equiv`、受审源码/目录生成检查，建设拟议 `docs:probe --base <verified-base>`；复用既有 Team `state-freshness`/artifacts 校验 | Git diff 与未提交改动识别、公共 Schema→文档 Owner 影响映射、已实现声明证据检查；失效引用/未更新类型/伪造 C2 负控；目标 10–30 秒，复杂约 60 秒（测量后定） |
| EB1-F：完整文档同步 | Doc/Contract Owner：建设拟议 `docs:sync --check` 与手动 `--write`，覆盖类型等价、目录生成新鲜度、所有必需规范/状态关系、执行说明核实；CI 仅以只读 `--check` 判断 | 源码改动导致文档陈旧会失败；已批准/已实现状态不得被生成器自行改写，提案/Idea 无需虚构实测；不得修改正式合同以修绿 |
| EB1-B：语义合同 | Contract Owner：`glossary`、`terminology`、owning `contracts` 及核心术语关系；REQ/INV/AC stable IDs；M0/Alpha.4 来源映射 | 同义词/ID 冲突/过期源锚的负控，Contract Owner 审查权限语义，无暗自修改原合同 |
| EB1-C：状态派生桥 | Tooling Owner：简短 `dev/engineering/registry.yaml` + Schema + 从 Git/CI/批准记录派生的 `current-state.json`（生成物）；先并跑旧 `current_contract` | `accepted ≠ merged ≠ verified ≠ released` 四轴示例；制造伪 verified 必红；旧/current 对账 |
| EB1-D：阶段计划接口 | Workflow Owner：Plan 的需求/验收/Owner/Profile 引用规则，正式 Idea→ADR→Contract→Plan 规则 | 计划引用错 ID 必红；归档计划不改变长期验收/测试 |

**先建新事实关系，再一次性切换旧当前态的唯一消费入口**。切换前 `graph.yaml#current_contract` 仍有效，切换后旧状态只作为历史/兼容只读，不能出现“两处可编辑的 current”。冻结旧设计文档及现有 `SESSION_ROUTER_LOG.md` 的历史内容不由这次工作改写。

**E1 出口**：一个新的 Agent 以当前状态入口、相应语义/合同和包说明能正确解释权限相关变更，不需加载海量历史；`docs:probe` 和 `docs:sync --check` 的初版已有可运行的正负控，能检测源码/公开声明/生成目录、术语、状态和引用漂移，且不误把尚未实施的提案当作产品失败。

## 3. E2：动态工具 Census、测试体系与并行 World

E2-A、E2-B、E2-C 可由不同 Owner 并行；共享测试**资源状态**和集成**分支**各有唯一 Writer，但不同 Worktree 可修改同一个测试入口或源文件中已界定的独立语义区域，最终组合由 Integrator 负责。

### EB2-A：来源驱动的动态工具基线

**Owner**：Tool Inventory Owner（读层）；**边界**：不写 ToolRegistry、Guard、ControlService、Grant、Provider，不修改 Alpha.5 工具接管规则。

1. 构建 `AuthoritativeToolSources` 的受审来源解析器：来自 `tests/paths.mjs` 的 Host Pin 及相关 DSH 公共工具来源、Team 真实产品声明、受信 profile/config/安装的 MCP/Provider 定义。模型传入的工具名称、旧矩阵及未经信任的远端工具声明不是授权根。
2. 生成 `ExpectedToolObligations`：稳定来源 Key / scope class / active 条件 / family、准入与测试义务。生成文件不可人工编辑；发生新来源变化必须产出 diff 和显式 `NEW_SOURCE`。
3. 只读连接真实 DSH Tool Registry，分别清点 Team、非 Team、跨 Scope、动态 MCP 刷新、禁用/条件启用；采集实际 Definition/Binding/Provider/Realm/Revision 身份，不依赖名称相等推定相同执行体。
4. `ObservedRuntimeInventory` 与 Expected 对账，输出 `added/removed/changed/unexpected/unclassified/drift`；不把无注册/条件未激活默默忽略；输出 `UNKNOWN/NOT_VERIFIED` 与准确 Profile/Scope 适用条件。
5. 固定 `VerifiedSnapshot` 的完整 digest，并连接 C1/C2/C3 RUN。Host/Team/可信配置变化重新生成 **新的预期**，旧历史快照不改写。
6. 自动化负控：新加一个受审 Team Tool、变更受审 Host 来源、动态 MCP server 新工具、同名跨 Scope、Provider 换代、未受信注入、新工具无 C2；其中新工具应进入“需治理/需验证”，而不是使整个系统永远保持旧 93 项或自动获得通过。

**E2-A 出口**：源增减会改变下一次预期清单；变更不是在人工维护的静态表里逐行批准；只有真实 Host/配置/代码能够改变相应来源事实；未验收工具无法冒充已测试；非 Team 会话不被错误变更。

### EB2-B：TestWorldFactory / 并行安全

**Owner**：Host/Test World Owner，延用现有 `tests/paths.mjs`、`characterization/lib/instance.mjs`、`rc2-real-host-smoke/run-control.mjs` 和 `bounded-run.mjs`，不建新启动器体系。

1. 明确 Host 基座 cache key（Host SHA、lockfile、Node/pnpm/平台），只读共享已构建产物；World 的 `DSH_HOME`、workspace、日志、Mock Provider、进程组与端口租约都独占。
2. 建立跨**进程**端口租约/资源声明并保证崩溃回收；端口范围仍遵循 3180–3186/3491–3500，永不侵占 3080；外部端口占用需 `ENV_BLOCK`，不偷偷漂移到未批准端口。
3. 世界资源按 `local/shared/exclusive` 分级；宿主升级、共享构建写入、迁移测试独占；普通固定 Pin 的读/写/审批/重启可并行。
4. Resource Owner 分配与清理使用真实路径身份及进程所有权，不根据端口 scan/文件 glob 随意 kill/delete。Windows 真正需要完整子进程树收束时引入已验证 OS 手段，否则该测试标记不支持并阻断其要求的平台。
5. 先在同机两个 Host World 上运行独立读/写、审批、外部拒绝、重启和一方强制终止；多轮无干扰且成功回收后再测 3–4 个的吞吐变化。

**E2-B 出口**：两个 World 同时完成真实 Host 测试，故障与退出不影响彼此及用户环境；只读 Host 基座保持 Git pristine；清理不会删除活动 Worktree、持久用户 World 或 A 类证据。

### EB2-C：测试分层、可靠性和历史红

**Owner**：Test Maintainer；与各 Package Owner 协同，不能为方便合格而更改产品契约。

1. 给现有测试标注 Owning Package/REQ/AC、T0–T4 层次、真实/Mock 边界、并发资源要求和必要性；保留每个产品行为独立的测试责任。
2. 把纯逻辑测试/真实 Registry 装配/真实 Host/长周期 E2E 分层。为至少一组 read/bash/unsupported 真实纵切及非 Team Native 路径建立正负控。
3. 独立调查九包 Census 9 条红、Root Suite 22 条历史集合：产品缺陷/测试错误/环境竞态/过期合同；每条有 Owner、复现、退出条件，不通过删除测试把红灯“修绿”。
4. 修复确定性的共享临时路径、固定等待和未 await 进程关闭。使用最窄有效负控证明新门禁真的会拦截目标缺陷。
5. 将基线对比从人工 prose 中摘出统一机器报告，但旧报告保持为历史证据；新安全红不加入永久豁免。

**E2-C 出口**：相关 T2/T3 可针对调用、审批、权限收紧、原生回退验证外部效果；任意新的安全失败不能被旧失败集合掩盖。

## 4. E3：CI 分层、变更影响图和合并门

**进入条件**：主要中心装配接口可用且稳定，E2 已有可靠的关键 T2/T3，E1 的合同/工具来源/状态登记有机器接口。

| 实施 PR | Owner / 行动 | 验收 |
|---|---|---|
| EB3-A：影响图 | CI/Test/Doc Owner：从源码路径、公共接口符号、owning 文档、合同/AC、动态注册来源差异推导 `selected tests/profiles/docs checks` | 纯 Idea/Proposed 走格式/引用，不强求已实现运行证据；公共 API/Host Pin/权限/动态 MCP 变更选到相关文档同步与安全检查；未知影响不得零检测 |
| EB3-B：四通道 CI 与文档检查 | CI Owner：`ci-fast` **强制** `docs:probe`；源码/文档依赖命中时 `docs:sync --check`；`ci-integration`、`ci-security`、`ci-full` 保留实际安全验证 | 缺失/跳过必需 doc-sync 或 Host 负控不能绿；文档快探针不能假装已经运行 T2/T3，基底与合并 SHA 对齐 |
| EB3-C：唯一 Required | CI/Repo Owner：PR 合成 merge tree 检查，`always()` 汇总真正依赖状态；配置实际 GitHub 分支保护 | 人为 skip、缺席、job 被取消、缺 Host、出错收据均不能伪 PASS；实际分支规则有效 |
| EB3-D：证据格式 | Evidence Owner：RUN schema/hash 与 artifact uploader/validator，CI 出具候选与 Host/TrustedSources 完整摘要 | 改写 RUN、错 digest、混入不同来源代际必须拒绝；A 类证据可恢复复查 |

**E3 出口**：相关代码或文档变更都通过真正可失败的 `docs:probe`；影响源码/正式声明/生成目录的 PR 会执行 `docs:sync --check`，并在合成 merge tree 上核对；CI 与本地同一个选择逻辑，安全变更的唯一真实负控仍在合并前；旧 `pr-gate/census-runtime` 在新规则平行验证可比后才退役，避免两个同时声明“唯一总门”的阶段。

## 5. E4：证据迁移、诊断、发布与 DevEx

- **EB4-A（Evidence Owner）**：依据 E0 清单做 A/B/C 证据保护、迁移、存储保留期和内容哈希检查；先落 Artifact/Manifest 索引再停止新日志入 Git；**不改写旧历史**；全程审计删除边界。
- **EB4-B（Runtime/Observability Owner）**：只读关联 `invocationCorrelation → Binding → PA/Control → Provider → settlement`；按当前可信数据点记录、脱敏；日志不承载 Grant/新的权限授权。
- **EB4-C（Release Owner）**：维持现行 `master/stable` 规则；产物打包、来源、冷启动、受保护用户世界与无条件回滚不可行时的前滚/迁移方案；RC 提升仍需现行产品授权。
- **EB4-D（DevEx Owner）**：收敛为有限自助命令（bootstrap/verify changed/Host/security/release/diag）；每个命令必须有实际错误解释和确定的 Owner，不创造第二套平行脚本。
- **EB4-E（Workflow Owner）**：安排两个独立 Family Worktree 并行接线，在相同 `agent-bindings.mjs`/`team-tool-plane.mjs` 修改互不冲突的语义区域，各自跑局部真实 C2；Integrator 将变更按短事务合并到一个候选，针对共同注册/teardown/授权链重跑 C2 与必要跨工具安全负控；记录等待、冲突修复、CI p95、返工和 Reviewer 工作量。以实测改 WIP 上限而非限制共享文件作者数。

**E4 出口**：新普通 PR 无大量重复 evidence Blob，诊断可沿权限调用链追踪，错误版本有明确恢复手册，Agent 能无需人工找脚本完成定向验证。

## 6. E5：固定候选的工程基线验收

由独立 Release/Test Reviewer 选定一个 `team SHA + Host SHA + lockfile/toolchain hash + plugin package sha256 + trustedToolSources digest + profile/config digest`，先固定该**验收截面**，然后执行：

| 验收 | 必要证据 |
|---|---|
| EB-01/02/03/14/15 | 九包无越界依赖、DSH 无补丁、四真值派生一致；源码 API/工具目录/语义变更能触发 `docs:probe` 和完整文档核对；失效源锚、伪验收文档会失败，Idea/Proposed 不被误阻断 |
| EB-04 | 新 Stage/Feature REQ/INV→AC→TEST/PROFILE→RUN 映射，阶段计划归档不删除回归 |
| EB-05 | 从受审来源增/删新工具和动态 MCP 的正/负演习；Expected 随来源演化，Observed 与之匹配；未测项保持 UNKNOWN |
| EB-06 | 真实 Host 两世界并行，独占资源有效，异常停止后干净清理；稳定实例/用户 World 未改变 |
| EB-07 | 真实装配工具至少 read/bash/unsupported 与跨 family 代表性场景的功能正控、安全拒绝零效果和无 native fallback |
| EB-08 | Required Gate 跨 PR 合成提交的缺测负控、选择规则及真实分支保护有效 |
| EB-09 | 9 条九包红/22 条历史 Root 红逐项分类；安全关键验收不被豁免或错误通过 |
| EB-10/12 | RUN、A 类证据能验证源码/产物/Host/配置哈希；授权链诊断、用户数据保护及安装/恢复路径 |
| EB-11/13 | 两个独立 Worktree 同文件并行接线并完成各自 C1/局部 C2，合并候选上的真实 C2/跨 family 权限及生命周期负控重新确认；当前未完成 Alpha.5 工具和未批准 Alpha.6 功能没有被错误标“可发布” |

**E5 通过 = 工程基础设施满足门禁，不等于 Alpha.5 产品 GO。** 如果当前产品存在尚未修复的真实权限缺陷，E5 不能把它重新归类为测试环境问题或解除发布阻断；相应安全验证如果属于 E5 必选，则必须修复后才通过。

## 7. PR 分解、依赖和并行安排

```text
Alpha.5 M2进行中 ──────────────→ Integration Freeze（独立确认）
        │                                │
        └── EB0 全面只读审计             ├── EB1-A/B 文档/语义
                                         ├── EB1-C/D 状态/计划
                                         ├── EB1-E/F docs:probe/docs:sync
                                         ├── EB2-A 工具来源/Runtime Census
                                         └── EB2-B WorldFactory
                                                   ├── EB2-C 测试重整
                    EB1-C/D + EB2-A/B/C ───────────┘
                                          ▼
                               EB3-A/B/C/D CI 与证据
                                          ▼
                                 EB4-A/B/C/D/E
                                          ▼
                                EB5 固定 SHA 验收
                                          ▼
                             Alpha.6 另行批准后实施
```

- 文档 Owner 与 WorldFactory Owner 可并行；`tools` 与 `runtime` 的**共享安全语义**仍由唯一 Contract/Security Owner 决策。多个 Family Owner 可以在不同 Worktree 并行修改同一个生产中心文件内的独立接线增量。当前 Alpha.5 的既有独占工作纪律，在对应阶段计划正式修订前仍有效；**本未来草案不自动向 M2 授权跨文件 Owner 修改**。
- `EB2-A` Runtime Census 是只读新模块，不能借清点任务擅自修改生产 Registry/权限内核；如果需要新增公开观测点，向语义 Owner 提出接口约束并在独立 Worktree 中实现受审增量，由 Integrator 负责合并候选，不能绕过既有 Alpha.5 裁决。
- E3 的四条 CI 可以分别实现，但唯一 `ci-required` 只能由一名 Owner 负责，不能出现多个竞争的“最终绿灯”。
- 每 PR 依实际源码/文档影响图验收，不只依作者自报范围；局部 C2 与 `docs:probe` 结果都须在集成候选上复核受影响关系，阶段合流后再执行完整回归。
- 历史 A 类证据保护、`CORE PATCH BUDGET=0`、`stable` 和人类 Home 禁触碰在全部工作包中保持不变。

## 8. 迁移安全、反例和阻断处理

| 风险 | 推荐默认决策 | 触发升级 |
|---|---|---|
| Runtime Census 无法判断某动态工具的真实来源/Scope | UNKNOWN、拒绝治理可用性宣称；保留普通非 Team 路径 | DSH 缺公开观测接口则 `CORE_SEAM_BLOCKER` |
| 来源更新意外造成产品行为扩大 | 来源入目录但不授予权限；C2 未测阻断相关能力发布 | 必交工具无法在公开 Seam 下实现 |
| 两个 Test World 相互干扰 | 阻断受影响并发 Lane；查原子租约、进程树及 cleanup | 会触碰用户世界或旧稳定实例 |
| CI 被弱化或错误“全绿” | 立即停止用该门批准相关合并，保留 raw 证据 | 安全门禁缺失、skip/refused 伪 PASS |
| 某项旧失败实际为权限缺陷 | 独立产品修复，不凭既有容差升级通过 | 涉及 Alpha.5 的发布红线 |
| 开发者需要改冻结产品合同/上游私有接口 | 保持原约束，形成具名裁决候选 | 必须用户授权；不能临时优化绕过 |
| 存储 Artifact 供应商保留性不可证明 | A 类保留在已验证不可变存储，其他先不迁走 | 存储不可恢复/哈希不可验 |
| 全量 CI 太慢 | 缓存、目标选择、分片、按风险分层 | 不以删唯一安全负控换速度 |
| 同文件并行接线在合并后出现语义冲突 | 按共享法律/接口 Owner 裁决，针对共同装配和安全状态在 merged HEAD 复验 | 已修改 PA/Control 的安全时序或存在无法解释的 native 回退 |
| 通用文档探针漏检或错误宣称已验证 | 输出受影响规范与拒绝原因，扩大完整 doc-sync/产品测试；CI 上必要检查缺席 fail | 文档把未测功能宣称已交付、公开源码/配置发生无证据的漂移 |

**退出机制**：受影响的独立包停工，输出 `实际事实→违反合同→可复现证据→Owner→可选修复/上游阻断→所需裁决`；未受影响的其他包继续。禁止无界重试或把阻断写成“已解决”。

## 9. 完成口径与本 Draft PR 自身验收

**本 Draft PR 的完成仅限**：新架构文档与本执行计划相互引用、八项原有批准原则与两项后续设计修订（语义独立 Worktree 并行接线、DSH 风格 `docs:probe`/`docs:sync` 必建）均有具体实现入口和验收、路径不侵占当期 Alpha.5 `active`，变更只涉及文档、链接有效、Git 变更范围核对。没有执行 Host、产品代码或完整 CI 时，不能声称这些门已通过。

**进入实施前**：需要独立评审这两份文件与提出决策理由的 Agent Note（若有），确认 Integration Freeze 的核验结果和 Alpha.5 Center 的文件所有权；计划经批准后才迁入 `docs/plans/active` 或生成活动引用。分阶段 PR 的具体负责人、实际资源预算和启动窗口由当时 `master`、活动工作树以及 CI 实测决定，**不因本草案中的建议时长承诺固定截止日**。

**相关事实入口**：[`architecture.md`](./architecture.md)、仓库 `AGENTS.md`、`docs/TEST_METHODS.md`、`docs/BRANCHING.md`、`dev/agent-workflow/graph.yaml#current_contract`、`tests/paths.mjs`、`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/`；M2 #360、Alpha.6 #319 均仍需独立判断，不能把其 Draft 文本当作已交付行为。
