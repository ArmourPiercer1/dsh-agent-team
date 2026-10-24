# Alpha.5 重建 S1：受控冻结、资产盘点及逐工具可行性研究执行细案

> **DRAFT / NOT ACTIVE。** 本文件为未来 S1 工作包说明；当前仅供 review，绝不据此远程停止在途会话、kill 任务、清理 Worktree 或运行真实 Host。本阶段须在[五阶段总计划](./five-stage-implementation-plan.md)获用户批准并经单独授权切换后开工。架构不变量见[中心装配设计](./center-assembly-architecture.md)。整个 S1 不提交产品/运行时实现或修改既有批准安全语义。

## 1. 工作目标、并行与唯一输入

两条可并行 lane：**A 资产审计**、**B 全工具技术可行性与分族有界 PoC**。统一入口为一个由 Freeze Owner 签发的只读冻结清单 §F0§（master SHA/refs、#360 head、所有活动分支与 worktree/脏态、现行 Host pin、测试 world/进程/端口、保护的用户资产）。两线写各自文档与隔离 PoC 证据，不进入同一产品集成分支；B 不因研究结果直接丢弃 A 的资产。

启动后应使新的开发任务停止入队，但**不能粗暴杀死正在执行的效果调用**。依次：①通知各 Owner 停止产生新 product writes/PR merge/Host installs；②等待当前最小原子操作安全收束或按合法中止信号中断；③记录不能立即停止的 in-flight task、Writer、PID、工作树状态与风险；④保存未提交代码、stash/untracked、可复现路径和 digest；⑤有权限的 Freeze Owner 核实没有新的共享产品修改，再发布 §F0§。若安全停止无法完成，保留该活跃任务“受保护例外”，资产快照声明不完全，禁止自动清理或覆盖它。

明确边界：本阶段“冻结”属于**产品开发停止入队的计划性指令**，不是关闭线上业务/测试实例的许可；稳定端口 3080/人类 DSH_HOME/冻结上游仓库零触碰。GitHub 远程分支引用与本地 untracked/工作进程无法仅靠 GitHub API 证明；缺少真实运行时权限时登记 §NOT_OBSERVED§ 而不伪造盘点完成。

## 2. Lane A：资产盘点

### A1. 资产视图及取证字段

| 集合 | 起始关注点 | 每个单元最低字段 |
|---|---|---|
| 产品已合并实现 | §master§ 的九包、构建/安装面、真实 PA/Control/Guard/Provider | path/module owner，当前 SHA/blob，产品行为、实际消费者、可信入口、已测 T1/T2/T3 和已知红，保留/重构/丢弃候选 |
| 未合并开发与 WIP | #360、#359、#355、#361、其他 open PR、worktree、local-only commit、stashes/untracked | 分支/HEAD/merge-base/dirty status，唯一不可再生文件，关联工作单，owner，是否有经独审的有效代码，恢复位置 |
| 文档/合同/决策 | paused 冻结四件、Alpha.4/5、M0 索引、#361、#362、活动权威、Graph、Agent Notes、运行记录 | normative/decision/plan/current/derived/historical 分类，生效权限与来源，消费者图，过期冲突，迁移建议 |
| 测试/证据 | 单测、T2/T3 kit、现行九包 Census、root 失败集合、PR evidence、CI artifact、sanitized logs | 文件/世界来源、可重跑命令、Host/Team SHA、测试等级、真实正负效果、红/绿/UNKNOWN、复现价值和唯一性 |
| 环境/磁盘 | clone、.worktrees、tests/homes、pnpm store、build/dist、tracked evidence、recovery、活跃 PID/端口 | real disk du、hardlink/共享占用说明、owner/最后消费、是否受保护、计划最大回收空间、恢复路径、删除可否验证 |

所有占用报告需区分逻辑 apparent size、实际 du、硬链接存储共享、WSL virtual disk 容量与 Windows 卷剩余容量。重复 §dist§、clone、日志不能直接推断都是可回收。Git squash/rebase 情形比较**内容身份与未跟踪资产**，不能仅用 against master 的 diff 判断安全删除。过去曾有清理与空归档误判先例，所有候选操作必须 dry-run 并检查实际文件字节和哈希。

### A2. 分类与“不得立即删除”规则

四类处置建议，**S1 只做判定、不执行实际删除**：

- §KEEP-NORMATIVE/PROTECTED§：权威合同、审查批准、用户 World、冻结历史、不可替代安全复现、只存在于 WIP 的产品资产；保留且标识 Owner。
- §REUSE-CANDIDATE§：真实代码或测试有价值但尚未证明产品级可复用，进入迁移 Map；不得标记 “已交付”。
- §REGENERABLE/RETIRED§：经 hash/来源构建/可重复正负控确认可再生的产物，或被签字取代的候选；有明确清理提案及预估节省。
- §UNKNOWN/IN-USE§：无法证明独占、引用、活跃进程或回收安全；一律保护，交责任 Owner 复查。

禁止 §git clean -xfd§、按名称/年龄批量 §rm -rf§、直接 §git worktree prune§、重写 Git 历史或覆盖稳定实例。任何未来清理必须另行批准、具名路径 whitelist、精确范围双检、先存唯一内容、后删且提供回退/实际 du 复量；A 不得为释放磁盘擅自降级此要求。

### A3. 资产可复用性矩阵（逐模块）

每个候选至少写出：①物理位置与依赖；②产品能力与消耗/产生命令；③“是否仅 Kit-LIVE、是否已进入默认生产 Host、是否经过固定包安装”；④是否需要旧中心工具名硬编码；⑤关联安全合同/测试；⑥缺口和可迁移方案；⑦建议 §reuse-as-is / extract / redesign / retire / blocked§；⑧复查 Owner 与证据锚点。特别优先：§agent-bindings.mjs§、§team-tool-plane.mjs§、§plane-effect-backends.mjs§、§host.ts§、§pa-mount-registry.mjs§、§tool-dispatch§、§controlled-fs§、§sandbox-provider§、§a5p5-tools§；这只是重点，不替代实际依赖扫描。

### A4. 盘点结果与独审

成果文件建议：§S1-FREEZE-MANIFEST.json§、§S1-ASSET-INVENTORY.json§、§S1-ASSET-DISPOSITION.md§、§S1-COST-AND-RECOVERY.md§。只将脱敏索引/小型高价值证据提交独立 docs/evidence PR；大型原始日志和缓存不扩大产品仓库，保留 digest 与已核验可恢复位置。独立 Reviewer 抽样 ①随机模块 ②最大占用目录 ③一个 local-only 资产 ④一个受保护 TestWorld ⑤一个被认为可清理候选，验证清单不漏、禁止删除规则可执行。

**A 线通过标准**：目标范围有受审覆盖率报告（可通过动态发现和已知集合差集判断，而非作者口头“100%”）；所有 §UNKNOWN§ 具名归属与安全保护；每个后续重构涉及的模块有复用/迁移/退役建议；没有数据或用户环境被清理/修改。若实际本地资产清点不可访问，则只能 §G1-BLOCKED-LOCAL-OBSERVATION§，不能把 GitHub 仓库清点当全量资产盘点。

## 3. Lane B：逐工具可行性与技术路线

### B1. 构建真实工具来源清单

输入为 M0 历史索引的 93 records / 27 families（历史种子，**不是权威未来全集**）+ 现行 DSH public catalog + 已合 Team 受审注册代码/manifest + 受信 Profile/插件/动态 MCP 来源。必须按 §source kind/source id/native name/scope/variant§ 定位实际来源；只读 Host Registry/Schemas/Binding/Provider 是 Observed，不是授权。运行上下文中新增来源进入 §NEW_SOURCE/UNKNOWN§ 待分类，不自动覆盖用户许可。

建立两个集合：§ExpectedToolObligations§（依可信来源、条件启用/版本派生）与 §ObservedRuntimeInventory§（该次 Host/Profile/Scope 的真实注册/可执行身份），并在冻结 §F0§ 上计算差集。禁止模型自报名称代替实际注册，禁止因禁用/条件未激活删掉原必交义务。

### B2. 逐工具合同字段（每一条记录不可缺）

| 字段 | 规则 |
|---|---|
| 来源/执行身份 | Git/包/Host 注册点，实际 Definition、scope、binding/realm、native vs alias 与条件挂载 |
| 语义与副作用 | 输入/输出/错误、同步/异步、取消与 Lease、原生功能对等基准；FS/read/write/network/process/domain 的实际效果 |
| 安全约束 | Tool policy 与 I/O policy、PA/Control 接缝、Body 之前最后拦截、资源锚、Domain Final Gate、Provider 可以兑现的 assurance |
| 可行路线 | 普通 Family Contribution、具名 Host Bridge、公开 API 下可维护的受限 tool-level fork、或 CORE_BLOCK |
| 证据等级 | source-only/fixture/real-host/OS-level/remote observed；不可把局部证据外推为产品 GO |
| 运行条件 | 平台/Host pin/profile/external credentials/文件或网络能力；缺条件标 ENV_BLOCK，不假造 |
| 实验与判据 | 功能正控、安全副作用负控、取消/撤销/换代、非 Team 对照；严格区分 T1/T2/T3 |
| 投入与决策 | 预期复用点、最大研究预算、未闭风险、Owner、READY/CONDITIONAL/CORE_BLOCK/ENV_BLOCK/UNKNOWN 级别 |

逐工具需要**逐名回答**，PoC 按“共享实际 seam 的机制组”复用，不为 93 条记录各写一份启动器。对一组中难以代表的异质工具，要增加定点实测而不能以族结论推断其正确。

### B3. 有界 PoC 波次（禁止隐藏扩项）

| 波次 | 需验证的关键危险 | 最小反例与结果判定 |
|---|---|---|
| B0 Source/Scope | 原生与别名、不同 preset、agentless、动态 MCP 后注册、同名覆盖 | 从真实 public seam 观察可执行 Binding；新来源不产生授权；无绕过/非 Team 漂移 |
| B1 FS/Search/Process | read/write/edit/image、grep/glob、bash/pwsh/terminal、sandbox 文件/进程/网络实际边界 | 真实文件或进程正控、越界零副作用、原生错误/输出 shape；Landlock 不冒充任意网络隔离 |
| B2 Lifetime/Bridge | PTC 内外两层、LSP realm、Jobs owner/Lease/cancel、调度与持久调用 | pre-body 准入、实际隔离/teardown；无法取消远端效果明确 UNCERTAIN |
| B3 Remote/Domain/Dynamic | Web/redirect/MCP stdio/HTTP、plugin manager、Team/Domain、动态来源 | 明确可控的本地效果边界与远端不可控边界；Domain veto 在效果处真实拒绝；外部凭据不可用＝ENV_BLOCK |
| B4 集成预演 | 给后续 ARC-A/B/C 验收挑选可验证原型 | 至少一种普通 Family seam、一种不同执行模型和一个具名 Bridge 的可行性或明确阻断记录；**不接正式产品** |

PoC 在独立 scratch/research branch 执行；可以创建测试专用 Minimal Definition、Host Fixture 和 Kernel 观察脚本，但不能将 PoC 直接合并为 Alpha.5 生产工具。每波先最小反证再扩大的判据写进测试，报告真实 syscall/文件/socket/Host 返回；真正缺凭据不能偷偷联网/购买/请求无限扩权。可重用既有 §tests/paths.mjs§、§DshInstance§、§run-control§，不从零另造。

### B4. 结果类型与强制方案分叉

| 结果 | 后续路线 | 是否停工 |
|---|---|---|
| §READY-PUBLIC§ | 固定 public seam + OS/Profile 保证，列出 C1/C2/T3 试验，进入 S4 设计输入 | 只读研究收束 |
| §CONDITIONAL§ | 明列 Linux/Windows、provider/权限/配置差异，失效形默认拒绝；可保留受限制交付候选 | 不阻断无关工具，但不得宣称通用 |
| §CORE_SEAM_BLOCKER§ | 记录目标原生 Body、缺失 API、最小复现、无 patch 替代方案、是否存在受控 fork | **阻断该功能实现并等待用户设计裁决** |
| §UNSAFE/BYPASS§ | 记录 body 已执行/权限失效，保护受影响面，给出最小修复选择 | **立即停止该范围的接线与实效果研究**，优先安全审查 |
| §ENV_BLOCK§ | 明确仅哪些观察未能运行、合法环境配置需要什么、替代模拟不证明什么 | 环境恢复前不得宣称支持；无关研究继续 |
| §UNKNOWN/INCONCLUSIVE§ | 仅再允许一轮针对“区分哪种原因”的有界 PoC；若仍不能归类，列方案/成本给用户 | **停止该机制的无限研究** |
| §CONTRACT_CONFLICT§ | 不动上游已批准安全合同，列冲突的精确字段/行为/来源 | 等待用户或唯一 Contract Owner 正式裁决 |

**不得**以“跑通了局部独立 Adapter”“拒绝一切也算治理成功”或“源码中有接口”升格 READY。特殊工具可需要具名 Bridge，不得为了硬凑普通贡献接口而绕开真实 Host Transport。每个 PoC 报告必有开始/截止预算和已测/未测清单，避免新的长篇调查循环。

### B5. 工期估算与优先级

先统计真实测得的 probe/Host 启动、install、T1/C1、C2、Reviewer 与复验耗时，按共同机制提供最小/基准/高风险三情景。若缺样本标“无法估算”，不能把执行模型生成的 agent-hours 草算当工程结论。优先级以安全依赖、可验证全链、复用广度和必交阻断影响排序；先验证影响大且可能阻断中心架构的 seam，而不是先写最容易的文件。

成果建议：§S1-TOOL-SOURCES.json§、§S1-FEASIBILITY-MATRIX.md§、§S1-POC-DECISIONS.md§、§S1-CONTRACT-DELTA-AND-BLOCKERS.md§、§S1-CRITICAL-PATH-BUDGET.md§。每一记录引用源 SHA 和可信运行世界、测试条件与结果，不按工具族一个 PASS 覆盖所有工具。

## 4. 跨 Lane 交叉核对与 S1 Gate G1

必须由独立 Review 核查五个命题：

1. **冻结可信**：所有可见产品修改者已经安全收束并记录；未能收束的 Writer/World 明确 §IN-USE§，不作安全清理；静态仓库与实际本地快照区别明确。
2. **资产可信**：每个将迁移/删除/保留的关键组件有源码、消费者、复用价值、真实测试等级和所有权；不以 PR 描述代替源码，不能以 squash 后 diff 空推断内容无价值。
3. **工具全集可审**：可信来源与实际 Runtime census 的差异均具名；93 records 作为历史种子逐条可追溯，动态/条件来源不静默遗漏；新来源进入待验证，不自动授权。
4. **路线可执行**：每条必交工具具备 READY/CONDITIONAL/具名阻断和可实施路线、共享/独立 PoC 判定、功能正控/安全负控/真实 Host 需求；特殊 Bridge 被解释而非掩盖。
5. **计划可估可控**：S2/S3/S4 最小依赖、合同冲突、环境 blocker、WIP/磁盘预算、关键路径和真正需要用户审批的问题都有 Owner 与下一步；停工场景能局部隔离，而不是让研究永远扩张。

§G1=PASS§ 要求上述全部具备可以独立核验的材料，并且至少一名未参与研究的 Reviewer 亲读主要源码/运行证据，安全阻断由 Contract/Security Owner 复核。G1 不要求所有工具可用、PoC 全部绿、已知外部 blockers 自动消失；但是不能凭 §UNKNOWN§ 假定后续能力有可实现路径。若**核心普通 Family 接入或授权前拦截机制整体无法成立**，即使资产清单完成也只能 §NEEDS-RULING§，**停止进入 S4**，先重设计中心方案。

### Gate 失败后的动作

- 如果只是资料不足：退回**具名少量事实采集任务**，一次验证闭环，不启动新产品开发。
- 如果权限语义和新架构发生冲突：冻结受影响方案，用户/唯一 Contract Owner 修改设计后独立复审。
- 如果 Host/磁盘/凭据不具备：§ENV_BLOCK§ 报告并保留保护，不能以其他测试绿代替；必要时允许 S2 纯文档预备，产品 Host 执行不得越门。
- 如果任务不断膨胀：停止新 PoC，报告新增工作量、无法预测部分、应修改的初始分类；不能“再多做一轮顺便就好”。
- 如果发现严重安全旁路：优先隔离实效果，明确影响和修复授权，不把缺陷自动纳入旧红容差。

## 5. 分工、变更范围和交付审查

- **Freeze Owner**：安全停止、F0、可访问环境清单；不得直接作为自己冻结记录的独立 Reviewer。
- **Asset Owner**：Lane A，仅独立资产清单/证据索引；不能碰现行产品。
- **Feasibility Owner(s)**：Lane B 按机制分组，并行研究；同一 public seam/安全合同有唯一决策 Owner。
- **Contract/Security Owner**：唯一决定已有安全法的引用、跨族共享效果以及 blocker 合法性；不能凭源码推断用户批准。
- **Gate Reviewer**：亲核 Frozen SHA、差异来源、取证负控、资产唯一性和 PoC 效果，给出 PASS/BLOCKED/NEEDS-RULING。
- **Project Owner/User**：审批真正改变安全范围、需要上游新 seam、预算与 S2/S3 进入条件的重大方案；本细案本身不代表已审批停止运行/删除。

工作树纪律：每个写者各自 branch/worktree；A/B 只读主代码树，改动只进 S1 自有研究文件。任何动到 shared authorized plan/graph/AGENTS 的指针变化须在 G1 后走 S2 独立权威切换 PR；本 S1 不切 current、不合 #360、不动 PR #361 与 #362 内容、不改 CI/产品源码。总账记录每份证据的 Git/ref、实际世界、审查者、保护范围、预算与停止条件。

**S1 结束时应交给下一阶段的是可信的“现状与路线”，不是另一批未经整合的实现代码。**


## 6. 独立审查后的强制执行补充

本节为 S1 的有限预算、快照闭包、H0 顺序和 G1 状态定义。与前文较弱或含糊表述冲突时，以本节为准。所有数值均为首轮硬上限，不代表已获准启动 S1；超限必须先提交范围变更，由用户/项目授权主体批准后才能继续。

### 6.1 F0 Snapshot Closure：固定本轮验收对象

F0 由 Freeze Owner 签发为只读、版本化、不可变快照，至少包括：

- Team 仓库的 commit SHA、所有被纳入的 PR/head/branch/ref 及采集时间；
- 固定 Host 仓库与 commit SHA、tests/paths.mjs 中的实际 pin、构建/安装包 digest；
- 工具来源集合：历史 93 条记录、当前 public catalog、已合并 manifest、Profile/配置、已受审插件和动态来源的明确纳入/排除清单；
- 每一来源的 source ID/digest、source kind、scope/variant、采集方法；ExpectedToolObligations 与 ObservedRuntimeInventory 的版本和差集；
- Profile/config digest、批准的 TestWorld/DSH_HOME、进程/端口、工作树/分支/dirty state、untracked/stash/local-only commits、受保护用户资产；
- S1 Owner、Reviewer、预算计数器起点、证据存储位置和签发时间。

F0 必须区分“已观察”“无法观察”“明确排除”和“未知”。GitHub API 不能证明本地进程、worktree、stash、untracked 文件、用户 World 或实际磁盘状态。任何未能实测的字段都标记 NOT_OBSERVED，并使依赖它的冻结/资产命题保持 BLOCKED-LOCAL-OBSERVATION。

F0 签发后，本轮 G1 的 ExpectedToolObligations 集合闭合。之后发现的新来源只写入 SOURCE_DELTA / POST-G1 UNKNOWN 队列，记录发现时间、来源身份、为何不在 F0、潜在影响与建议是否重开 G1。新增来源不得回溯性改变已固定 G1 的 PASS 判定；只有新来源挑战既有安全不变量、证明原快照造假/漏掉当时已存在的权威来源，或改变用户批准的必交范围时，才提交明确的 G1 重开请求。不能由研究 Agent 自行扩大集合。

### 6.2 H0：首个且优先级最高的 Host seam PoC

在展开普通 Family 或 Bridge 的广泛技术路线前，先验证固定 Host 中 Guard 验证 Definition 后，dispatch 仍会重新 resolveExecution 的已知 TOCTOU 风险。该风险来自源码审查，尚非已复现的可利用漏洞。

最小实验矩阵：

1. 正控：固定 Definition A，从真实 public registration/dispatch 路径调用 A，确认正确 Body 计数为 1、预期外部效果存在。
2. 注册换代：Guard 验证 A 后、dispatch 前注册/切换到 B；确认未验证的 B Body 计数为 0。
3. 同名覆盖：同 Scope 同名定义换代；确认旧 Binding/Grant 不可执行新 Definition。
4. Scope 变化：在 Guard 与 dispatch 间改变 Scope/Binding 身份；确认拒绝发生在 Body 前。
5. 异步暂停/竞争：在可控 await/调度点触发换代；重复有限次数，记录调度点、最终 dispatch 身份、Body 计数与副作用。
6. 测试灵敏度：植入一个已知错误的 post-Guard re-resolve 或等价缺陷，测试必须 RED；撤去植入后正控恢复。

每项记录 Host SHA、Team SHA、Runner/Canary digest、World ID、Definition/Scope digest、Body 调用计数、实际外部效果和日志摘要。PASS 要求所有未验证 Body 调用计数均为零，且测试能够检测植入缺陷。事后撤销、审计告警、返回拒绝错误或只 mock dispatch 均不合格。

若 H0 失败或公开 seam 无法观察真实 dispatch 身份，立即将依赖路径标为 CORE_SEAM_BLOCKER 或 ENV-BLOCKED（依据是技术缺口还是环境不可用），停止该路径的进一步实现型研究。不得用后续 G3 Oracle、事后审计或用户未明确批准的假设代替 H0。

### 6.3 S1 项目级硬预算与自动停止

首轮预算从 S1 正式启动时计时，Lane A/B 共用，不按 Owner 或机制组拆分后重复申请：

| 资源 | 硬上限 | 达到上限后的动作 |
|---|---:|---|
| 总技术调查时间 | 2 个工作日（最多 16 Owner-hours，跨所有 Owner 汇总） | 停止新增技术实验，整理当前证据与未决项 |
| PoC 实验总数 | 20 次独立实验；一次实验指一个预先登记的假设/输入组合，不得把重复循环伪装成一次 | 不得新增实验；未闭项转 UNKNOWN/NEEDS-RULING |
| 真实 Host 启动/重启 | 合计 12 次 | 停止 Host 运行；不得以重启修复环境为由自动续期 |
| 单次实验运行时间 | 30 分钟 | 自动停止本次实验并保全证据；不得无记录续跑 |
| 单次实验新增证据 | 2 GiB | 停止生成大体积证据，保留最小复现与摘要/digest |
| 同一假设的尝试 | 一次初始 PoC + 至多一次预先说明区分目的的补试 | 仍不确定则转 UNKNOWN/NEEDS-RULING 或 CORE_SEAM_BLOCKER |
| 每个机制组的异常样本 | 一个代表性异常样本；若证明它不代表该组，须使用项目总实验额度并说明替换原因 | 不得因新异质性自动创建新机制组 |

每个实验开跑前登记 ID、单一假设、可能结果、停止条件、Owner、Host 启动额度、预计时长、World、效果观察方式和证据上限。预算账本必须是跨 Owner 的单一共享账本。任何重试、分组拆分、换 Runner 或换 Owner 都继续计入原项目预算。

达到任一上限后，禁止以“再做一个区分实验”“新发现一种异质性”或“动态来源不断增长”为理由自动扩项。只能输出 READY-PUBLIC、CONDITIONAL、UNKNOWN/NEEDS-RULING、ENV-BLOCKED 或 CORE_SEAM_BLOCKER，并提交所需新增预算、预期可区分的结论及用户批准请求。未经批准不得继续执行。

### 6.4 逐工具分类不等于逐工具实测

S1 必须对 F0 内每条 ExpectedToolObligation 逐名登记来源、Scope/variant、领域效果、候选路线、证据等级、必要测试与 Owner；但不要求在 G1 前对全部 93 条历史记录逐一完成真实 Host 正负控。

真实 PoC 按共享的 Host seam/执行机制分组，优先顺序为：H0 Definition TOCTOU；普通 Family 公共注册与 Body 前拦截；read/write 与 process 的不同执行模型；一项具名 Bridge；动态来源和 Domain veto 的必要最小反例。异质工具只有在已有组的代表性假设不成立时才用剩余预算追加定点测试。逐工具静态分类不能冒充真实 Host 验收；族级 PoC 也不能让未测工具自动变成 READY。

### 6.5 G1-I / G1-F 与阻断传播

G1 拆分为：

- G1-I Inventory：F0 可信且闭合；资产清单及差集可审；93 条历史记录可追踪；未知资产有 Owner 与保护；量化回收计划完整。
- G1-F Feasibility：H0 已通过或以 CORE_SEAM_BLOCKER 明确阻断；关键普通 Family 的公共接入与授权前拦截存在可信路径；每条必交记录有可实施路线或具名 blocker；研究预算和停止条件可审。

G1-I PASS 不代表 G1-F PASS。G1-I PASS 而 G1-F BLOCKED 时，可继续不依赖 Host 执行的 S2 文档/权威迁移准备，但不得进入 S4，也不得把阻断路径写为可实现。若 H0 因环境缺失无法执行，状态为 ENV-BLOCKED，不可当作通过。

G1 总体状态必须为以下之一：

| 状态 | 判定与下游规则 |
|---|---|
| G1 PASS | G1-I 与 G1-F 均通过；按总计划解锁 S2，S4 仍需 G2/G3 |
| G1 PARTIAL | 有部分资产/路线成果但仍有缺项；只允许无依赖的只读工作 |
| G1 BLOCKED-LOCAL-OBSERVATION | 本地工作树、进程、磁盘或 World 无法核实；不得宣称冻结/资产完整，不得清理 |
| G1 ENV-BLOCKED | 合法 Host/凭据/平台不可用；不得用 mock 替代真实证据 |
| G1 NEEDS-RULING | 安全合同、威胁模型、范围或成本取舍需要授权主体决定 |
| G1 CORE_SEAM_BLOCKER | 公共 Host seam 无法证明可信身份或 Body 前拒绝；阻断依赖路径的 S4/发布 |

“部分通过”不能由报告措辞自动升级为 PASS。每项状态必须带 Owner、快照 digest、证据、下一步、重开条件。

### 6.6 资产与磁盘回收计划必须量化

S1 仍不执行删除，但必须产出逐目录的实际 du、共享/硬链接说明、最后消费者、唯一性、重建成本、保护级别、回收风险和估算节省。将常态总占用 5–10 GB、集成高峰约 20 GB 作为目标预算，而非不顾真实必要性强制删减。若无法达到目标，必须逐项列出具名的不可回收资产、理由、Owner 和预计复核日期；不得用“UNKNOWN/IN-USE”永久搁置而不设处置责任。

为 UNKNOWN/IN-USE 资产建立 DISPOSITION_PENDING 队列。每项必须有责任 Owner、需要补的观察、最迟复核 Gate 和建议去向。超过复核期限时升级到项目 Owner，不自动删除。清理必须在后续独立批准工作包中执行，S1 只提交方案。

### 6.7 G1 独立审查清单

独立 Reviewer 必须核验原始来源和关键运行证据，而不是只读研究报告：

- F0 的每类来源、排除理由与快照 digest；SOURCE_DELTA 未被回溯混入；
- 本地观察缺失是否正确传播为 BLOCKED-LOCAL-OBSERVATION；
- H0 原始运行结果、Body 计数、外部副作用、植入缺陷 RED 证据；
- 项目级预算账本和停止记录，确认未通过拆分机制组、Owner 或重试规避；
- 每条必交工具的静态路线记录与真实实测状态没有混淆；
- UNKNOWN/IN-USE 与磁盘回收队列有责任人、量化空间和复核节点；
- G1-I、G1-F 判定与下游允许动作符合本节矩阵。

G1 的交付是有限快照上的可信现状、关键安全 seam 结论、可实施路线和明确 blocker，而不是“发现所有未来工具”或“所有工具已实现”。