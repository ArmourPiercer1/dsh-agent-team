# Alpha.5 重建：五阶段实施计划（提交审议稿）

> **DRAFT / NOT ACTIVE / DO NOT MERGE without review.** 2026-10-25。本文规定拟议执行顺序与 Gate，**本 PR 只创建计划，不执行停工、不切换现行权威、不授权产品/Host/清理/发布操作**。只有经用户明确批准、完成一次性生效切换后，才替代旧 Alpha.5 M2 施工节奏。历史计划、已批准权限合同、Alpha.4 语义、PENDING-GATES 仍有效，不能借“废止文档”撤销产品义务。

配套：[中心架构](./center-assembly-architecture.md)、[阶段一细案](./phase-1-freeze-inventory-feasibility.md)。本计划以 master 起点 4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84 为设计参照；开始时重新固定实际 SHA、Host pin、GitHub PR/head 和实物资产。E0/E1 与 PR #361/#362 的关系逐 Gate 明示。所有门禁判定为 PASS / BLOCKED / NEEDS-RULING / ENV-BLOCKED / NOT-VERIFIED；缺证据不可自动通过。

## 0. 目标、红线及交付标准

最终产品目标**仍为完整 Alpha.5 工具治理交付**，不是有限试用、测试工装绿、全部 fail-closed 或一批 dormant Adapter。完整发布仅在真实 Host 的全工具矩阵同一候选 SHA C3、安全与功能正负控、安装/升级/恢复、来源快照均达到合同级别并由用户审批后成立。

跨阶段固定红线：CORE PATCH BUDGET = 0；普通非 Team 行为无越权变化；唯一 Team 权限权威与 Domain 最终否决；无 native fallback/执行后拒绝；M0 93 条为历史来源种子而非永久封闭名单；动态来源只会增加审查义务不增加执行许可；不得触碰稳定实例 :3080、人类 DSH_HOME、冻结上游树、活动测试 World；不清理不可证明归属的路径；不擅自降低旧红/改判据；不把 E0/E1 基线实现等同完成。每项工程行为必须绑定批准的阶段/Owner/工作树与准确 SHA。

设计目标：CA-01 新普通 Family 接入中心源零修改；CA-02 不同执行模型共用同一 PA/Control/Grant/Scope/Lease 协议并经 Host 验证；CA-03 特殊差异留在具名 Bridge。详细见架构文档。

## 1. 总体 DAG 与阶段转换

| 阶段 | 交付产物 | 必要入口 | 完成 Gate |
|---|---|---|---|
| S1 受控冻结/资产/可行性 | Freeze manifest、资产去留候选表、可信来源矩阵、分族 seam/PoC 决策、预算/关键路径 | 用户批准本计划并指定执行 Owner；安全停止点 | G1 独立审核：资产无遗漏、风险分叉可执行、必交项都有路线或具名 blocker；不要求代码可用 |
| S2 工程权威和文档 E0/E1 | PR #361 适配版、E0 实测补齐、E1 规范 ID/来源/当前态单一权威、docs:probe/docs:sync 合同 | G1 PASS、冻结执行截面 | G2：单一现行权威可核、历史保留、快/完整探针正负控可运行、迁移回退可证明 |
| S3 最小真实 Host 验收底座 | 固定 Host/package/World、Canary/故障注入、自证 fail 的 runner、RUN schema、代表性旧红 | G2 PASS；已批准测试 World 与资源 | G3：测试设施可检验成功/失败/安全回收；**不要求任何 Alpha.5 产品工具 PASS** |
| S4 中心装配重构与首个纵切 | 新通用 Registry/Kernel/Family/Bridge；read + bash 不同执行模式；ARC-A/B/C/D 证据；移除旧双路 | G3 PASS；S1 已证 seam 与合同 | G4：普通新 Family 零中心修改、统一安全生命周期、至少一个具名 Bridge 机制证据/阻断受裁、真实 Host 不扩大权限 |
| S5 工具族持续实现/合流/发布 | 每族 C1+局部 C2+merged-head C2，真实清单动态对账，全工具 C3/RC | G4 PASS；各 Family 合同已冻结 | G5：全工具矩阵满足产品准入且安全、完整 Host/包/发布恢复通过，用户决定 Alpha.5 GO |

S2 与 S3 的**只读设计**可以平行，但不越过 G2 启动产品/Host 写入；S4 的各 Family 迁移只在 G3 后进入真正安装/执行；S5 的调研与局部纯契约工作可提前，**生产接线与产品 GO 不能越门**。S1 内资产盘点与可行性研究两条 lane 并行，共用冻结 snapshot，不让其中之一直接改变生产 tree。

## 2. 各阶段 PoC、结果分叉和停工条件

### S1：先验技术风险（细节见阶段一计划）

- **PoC**：按真实工具来源、Scope/Host seam、执行边界对 93 历史记录和受信运行时新增来源逐条分组；先做只读 Host API/来源调查；针对 read/write/shell、PTC、LSP、Jobs、MCP/Web、Domain 等不同机制的**最小可证伪**实验，不让每工具各自建立重复 harness。
- **PASS**：具名 public seam 能在真实 Host 上证实调用前拦截/来源/效果与终态；进入后续 family 设计。**CONDITIONAL**：需 OS/Provider/profile 限定，证明每一限制并在支持矩阵中表达。**CORE_BLOCK**：上游无可信 seam，则停下该工具/族的产品实施，提交接口最小缺口与可选保守策略用户裁决。**FAIL**：有 native fallback/越权执行，隔离安全问题并禁止迁移；**ENV_BLOCK**：无合法环境或凭据则限范围、保留未测，不变 PASS。**UNKNOWN**：一次补充最小诊断，仍不闭则停止研究上报。
- **任务**：安全停止、全资产恢复清单；现有法律/来源/生产接线定位；技术路线与复用审计；成本与 critical path 评估。冻结不会撤销授权或恢复已有副作用。
- **门禁**：G1 对每个必交工具 record 给出来源、族、公开拦截 seam、执行效应、复用资产、可行性等级、对应 T1/T2/T3 正负控和明确 owner；缺项给出受控阻断，不能删名或以工具类名替换。**等待再设计**：工具公开 seam 不足、威胁模型冲突、产品义务无法在预算内履行、资产归属无法安全判别。

### S2：文档与工程权威切换（适配 PR #361 的 E0/E1）

- **PoC**：在不切换现权威的并跑期，故意制造旧/新状态矛盾、伪造“仅 C1 即 C2”、公共类型变更未同步、未知来源和错误合同 ID；双读器必须指明歧义/拒绝，合法历史提案不被误判产品未达。
- **PASS**：E0 的资产/性能/失败身份有实测范围与缺口；E1 的 Note/Contract/Plan/Registry 来源关系生效、18 proposed ID 不被静默当 ratified；唯一当前执行权威用一次受控迁移切换，旧 graph/STATUS 只保留历史/派生镜像；旧记录可读可追溯。
- **分叉**：docs 工具校验无法可靠覆盖目标声明→限制其检查承诺，补足专责 Contract Review 后复验；迁移显示双 current 主张→**不得切换**，先修桥/消费者；PR #361 设计与新顺序冲突→提出独立修订，不强合并 #361；旧记录缺证→仍保留 UNKNOWN，禁止自动填绿。
- **任务**：复用 #362 已合工具，不新建第二套；按 #361 的 EB0、EB1-A…F 验收并补齐 E0-5 代表性 p50/p95；调整 E1 原“待 Alpha.5 M2 收口”的 Integration Freeze 前提为 G1 的安全冻结；在独立批次核对所有实际旧入口消费者；明确 doc-probe 与产品验证的责任差异。
- **Gate G2**：独立文档/权限审查，唯一 active 指针无争用；docs:probe/docs:sync --check 正负控通过并记录未覆盖表格/动态语义；原产品语义未改变；迁移逆操作经过模拟。**等待再设计**：合同迁移实质改变安全法、生成状态可伪造授权、双权威无安全切换办法。

### S3：最小 Host 验收基础（从 PR #361 EB2 抽取，不要求 EB2–E5 全部）

- **PoC**：完全独立测试插件 §test_canary§ 在 pinned DSH Host 通过真实注册/dispatch/文件效果/Result，植入“错误返回却发生效果”“超时”“插件启动失败”“wrong Scope”“资源泄漏”并确认分别 RED。Canary 不进入生产包/必交名单、不获得实际 Team 安全 GO。
- **PASS**：一个 World 可重复加载固定包、成功/失败分类可信、销毁后所有 owned PID/ports/home 可辨且正确回收、稳定 :3080 与用户 World 无变化；RUN 包含 SHA/digest/profile/观测效果，基础正/负检验具有故障注入敏感性。
- **分叉**：Host 无法启动→先判断基座/环境，不通过 mock 替代；测试没有探测到植入缺陷→**G3 失败，先修 Oracle**；World 影响非自有路径/进程→立即停工并审计；部分 Windows/外网条件不具备→单独 ENV_BLOCK，不能污染 Linux 必交面。
- **任务**：复用 §tests/paths.mjs§、§characterization/lib/instance.mjs§、§rc2-real-host-smoke/run-control.mjs§、§bounded-run.mjs§；锁 Host 源/构建/安装 digest、固定批准端口 3180–3186/3491–3500；建立只属 World 的 DSH_HOME、进程组/日志/清理；保留 read/bash/unsupported 等**产品当前 RED**测试用例，但不要求其绿。
- **Gate G3**：Host 真启动、Canary 真效果、Oracle 人为错误必红、异常中止与清理正确；无 Alpha.5 产品 GO 宣称。**等待再设计**：不能真实观察副作用、无法保证测试不伤用户实例、CI/Host 入口需私有 seam。

### S4：中心装配层重构

- **PoC**：ARC-A 新普通 Family 零中心源变更；ARC-B FS/read 与 process/bash 共用同一授权链；ARC-C PTC/LSP/Jobs 任一具名 Bridge 真实接点；ARC-D 跨成员、后注册、更新代际、回退、取消和撤销竞态的故障注入。
- **PASS**：符合 [架构 CA-01…03、CI-01…12](./center-assembly-architecture.md)；同一正式安装包在真实 Host 完成功能与安全正负控；所有非 Team 路径零意外改动，旧中心已迁移的逻辑无永久双路。
- **分叉**：普通新 Family 仍须改中心手写工具表→停下 Registry 设计，不用补丁填空；两个不同模型需要双 Grant/Control 账本→停下 Kernel 设计；特殊 Bridge 公开 seam 缺口→具名 blocker，允许无关 family 继续但不得宣称 ARC-C GO；安全退化→立即阻止合并/运行。
- **任务**：受审旧组件复用/替换、抽取 HostSurfaceAdapter 与贡献构建、单中心 Kernel、可信 Provider、具名 Bridge、正式 source/dist/install 镜像、旧双路删除与日志可追踪。重构内部 TS API 可破坏性替换，不能擅自破坏外部合同/持久化。
- **Gate G4**：独立 Security Owner + Host Reviewer 审核固定 SHA、A/B/D 真实证据、C 的真实成功或用户正式裁决的具名阻断和边界；功能已批准范围不可由于“暂时不实现”而获得 GO。**等待再设计**：统一 Kernel 在公共 API 下不可表述、原生拦截位置不可信、PA/Control 顺序与合同冲突。

### S5：全工具族持续交付与总验收

- **PoC**：每个新 Family 首次接入即实施局部 T2/T3；跨 family 选两种并发进同一 merge 候选验证同名、Scope、Lease 与 teardown；MCP/动态来源变化触发自动 UNKNOWN，不自动授予执行。
- **PASS**：Family 分支在其自己的 World 完成 C1/完整接线/局部 C2；Integrator 在受控单 Writer 集成分支完成最新 merge-head 有影响范围的 C2+安全回归、真实 dist/install；最后同候选全工具 C3+T4 按正式声明级别通过。合同真正规定为必交的工具不得用纯拒绝充当可用。
- **分叉**：局部 C2 不过→不进入集成；合并后变红→隔离合并增量，停止相关族；来源新增而无支持→标 UNKNOWN/NOT_VERIFIED 并阻断受影响发布；Host 接口阻断→上报用户修改契约/路线，不降低阈值；偶发 CI 失败→固定复现和分类，不永远重跑。
- **任务**：按照 S1 已核路线分优先级实现、逐族注册/治理/真 Host、发布前性能/取消/安装恢复、工程基线 #361 的 EB2–EB5 按依赖完成（非借 EB5 取代产品发布门）。
- **Gate G5**：来源动态清单、功能正控、安全负控、真实审批、取消/重启、CI 合成 merge tree、完整用户行为、安装与回退、历史红分类，均固定同一 snapshot；User Release Approval 单独存在。**等待再设计**：强制更改上游/协议、反复出现共通 Kernel 新语义或预算/吞吐无法维持。

## 3. 交付包与门禁格式

每个阶段只接受如下事实向量：§sourceSha§、§hostSha§、§trustedSourceDigest§、§profile/configDigest§、§pluginArtifactSha§（只读阶段标 §N/A§）、§testWorldId§（无 Host 记 §NOT_RUN§）、§owner§、§AC/TEST§、§positive/negative outcomes§、§known reds and deltas§、§blockers§、§resource accounting§、§review verdict§、§next action§。更改任一关键快照后不可复用旧“测试通过”宣称。测试等级 T0 静态、T1 包单元、T2 真 Registry/PA/Backend 装配、T3 真 Host、T4 完整发布；需外部效果的功能不得通过 T1 伪验。

门禁执行责任：Family/专项 Owner 自验 → Integrator 对合成候选/变更和资产边界签名 → 独立 Reviewer 必须亲读代码/复现 → Security Reviewer 对权限/Scope/取消变更签名；之后由获授权 Owner 变更阶段。§PASS§ 需要证据可核，§REFUSED/ENV_BLOCK/SKIP/UNKNOWN§ 在必选门禁均非 PASS。一次限域修复+复审仍 blocking 则冻结该问题升级，不组织无限“准备轮”。

## 4. WIP、时间/空间预算与汇报纪律

- **项目级**：S1/S2 期间禁止产品开发；既有生产开发应按 S1 安全停止协议撤出，禁止新 #360 功能进入现行集成。只读资产和独立 PoC 分支可并行；PoC 绝不自动合入生产。
- **实现级**：S4/S5 初始限同时最多 **2 个尚未完成 merged-head C2 的 Family**；此值是待测管理上限，不限制并发只读审计 Agent 数。测得 Integrator/Host 吞吐后正式调整。
- **重试级**：诊断必须先产生因果证据；一个明确假设→一次有界 PoC→独审→一次修复→复审，仍阻断则停；没有“反复跑到绿色”的默认授权。
- **资源级**：每个工作包在启动前登记 CPU/Host/端口/磁盘预算、最大运行时、临时树配额、保存策略；达到阈值提前警报且停止新克隆/install，不能依赖 WSL 虚拟磁盘标称 free。
- **交付级**：普通原始日志/临时构建不加入产品 PR；A 级不可替代证据保存不可变 digest、B 级受控保留、C 级允许严格 owner-scoped 清理。拒绝提交巨量 redundant blob/commit 的 PR；需大型证据采用受保护外部 Artifact + 索引。
- **报告级**：至少每个 Gate 及关键风险/预算越界时，输出已完成实物、当前不可用工具数量、最新 C2 交付数、队列规模、可验证 blocker 与预计剩余关键路径；未知时间不得猜测“很快完成”。
- **不能依靠数字自我批准**：任何初始预算和日期只作控制点，工期以 G1 的实测/路线和 G3 的 C2 p50/p95 重新估算并交用户确认，旧“10/24 完成”已是历史期望。

## 5. 与既有 PR、权威和冻结文件的具体关系

| 资源 | 本提案处理 |
|---|---|
| #360 M2 Draft（950 commit 大集成面，基于审查时点） | 只冻结为候选资产、逐项裁剪复用；不直接 cherry-pick 全部，也不在本 PR 关闭/合并 |
| #355 Plan B Draft | 作为已讨论过的历史方法；新的阶段计划批准后可将其 supersede，但不删除旧依据 |
| #361 Engineering Baseline Draft | S2 以其 E0/E1 规则为主要底座并修订原 M2 连续开发进入条件；EB2–EB5 按 S3–S5 的真实依赖执行；本 PR 不更改 #361 的 PR 文件 |
| #362 EB0/E1 partial merged | 复用 Note/registry/docs-check 工具，不错误宣告 E0/E1 已通过；未完成的 CI wiring、权威切换、合同 ID 正式身份归 S2 |
| §AGENTS.md§ / §graph.yaml§ / §docs/plans/active§ | 本 PR 完全不写。批准后，由单独受审“冻结与权威迁移 PR”在安全停止完成时**一次性**更新；历史记录不删 |
| 20260829 冻结文档 / Alpha.4/5 合同 | 保持语义和有效测试义务，具体矛盾作为用户裁决而非自动 supersede |

## 6. 本计划 PR 的独立验收边界

本 PR 只应包含三份新增设计/计划文档：不写源码、现行权威、测试/CI 脚本、Host/配置/运行数据，不运行 PoC。不允许将其合并解释为 S1 自动启动许可；用户后续明确同意“启用新执行流程”并授权安全冻结动作时才可单独开始 S1。审查必须检查三份文件互引、阶段 DAG 无循环、每阶段五个维度（PoC/分叉/任务/测试/门禁/停工）完整、权限红线不可降、与 #361/#362 状态无虚假合并、S1 资产不被不当删除。


## 7. 独立审查后的强制执行补充

本节补足 G1 闭包、阶段证据依赖、权威迁移事务、阻断传播和中心防耦合规则。若前文存在更宽松或含糊表述，以本节为准。此 PR 仍是计划文件，不授权启动任何阶段。

### 7.1 阶段 DAG、输入快照与证据失效

阶段依赖固定为 S1-A → G1-I；S1-B/H0 → G1-F；G1-I 解锁 S2 的文档/工程治理迁移；G1-F、G2、G3 是 S4 的共同前置；S2 → G2 → S3 → G3 → S4 → G4 → S5 → G5。S2/S3 可以并行做只读设计，但不得并行生成可互相冒充通过的证据，也不得提前启动产品写入。

每个阶段交付必须声明不可变 inputSnapshotDigest，至少覆盖 Team SHA、Host SHA、可信工具来源快照、Profile/config digest、package/build/install digest（未适用时显式 N/A）、TestWorld 身份和版本、相关权威版本、测试 Oracle 版本。RUN 必须记录这些输入和观测结果。

- S1 的 F0 是本轮 G1 的闭包。S1 后新增来源只进入 SOURCE_DELTA / POST-G1 UNKNOWN，不得回溯性扩张本轮 ExpectedToolObligations。
- S2 authority migration 或回退、E0/E1 合同 ID 状态、Host pin、Profile/config、package/build/install digest 任一变化，均使依赖该输入的 S3 RUN 失效，必须重跑受影响 Oracle；不得仅凭时间相近或测试名称相同复用。
- G3 必须绑定 G2 最终 merged head 和最终权威快照。若 G2 在 G3 后发生任何语义性变化，须重跑受影响 G3。
- S4 的证据须证明 Canary 测试插件、Runner、正式安装包与生产 dispatch 路径之间的等价性边界。Canary 仅证明 Oracle 具备检测能力，不证明产品工具通过。
- G4 和 G5 必须绑定被审查的 merged head；Family 分支的 C2 不替代集成候选上的 C2。

### 7.2 G1 拆分为两个独立判定

| Gate | 证明内容 | 通过后允许 | 不代表 |
|---|---|---|---|
| G1-I Inventory | F0 完整且可信；资产与来源差集可审；未知资产受保护；历史 93 条记录可追踪 | S2 文档/工程治理迁移工作 | Host seam 已安全可行 |
| G1-F Feasibility | H0 完成或有正式阻断；关键普通 Family 接入和授权前拦截有证据；每个必交项有路线或具名 blocker | 作为 G2/G3 后进入 S4 的必要前置之一 | 所有工具已实现或可以发布 |

G1-I PASS 但 G1-F BLOCKED 时，允许独立且不依赖 Host 执行的 S2 纯文档预备；不得切换任何需要未证明安全事实的执行路径。G1-F 的 CORE_SEAM_BLOCKER 阻断依赖该 seam 的 S4 和最终产品发布，但不阻断已隔离、无依赖的资产整理或文档工作。G1-PARTIAL 不是 PASS 的别名。

### 7.3 Gate 状态传播矩阵

| 状态 | 含义 | 可继续的工作 | 禁止动作/下游效果 |
|---|---|---|---|
| PASS | 本 Gate 的所有必需证据满足，快照固定 | 仅允许 DAG 明确解锁的工作 | 不自动解锁其他 Gate |
| PARTIAL | 一部分局部命题成立，仍有未闭项 | 无依赖的只读/文档工作 | 不得作为 PASS 消费 |
| BLOCKED-LOCAL-OBSERVATION | 缺少真实本地进程、worktree、磁盘或 World 观察能力 | 可继续已隔离的公共仓库文档工作 | 资产/冻结完整性不得宣称通过；不得清理或覆盖受保护资产 |
| ENV-BLOCKED | 合法环境、Host、凭据或平台条件不可用 | 不依赖该环境的工作 | 不得以 mock、源码推断或其他平台绿替代真实证据 |
| NEEDS-RULING | 涉及安全合同、范围、威胁模型或架构取舍 | 仅不受该决定影响的独立工作 | 相关路径停工，等待有权主体裁决 |
| CORE_SEAM_BLOCKER | Host 缺少可信的 Body 前拦截或身份保证 | 允许不依赖该 seam 的 Family/文档工作 | 依赖该 seam 的 S4 和发布阻断 |
| UNSAFE/BYPASS | 发现未授权 Body/副作用、native fallback 或权限旁路 | 仅安全隔离、取证和经批准的修复准备 | 立即停止受影响执行面；不得把缺陷归入普通旧红容差 |
| UNKNOWN/INCONCLUSIVE | 达到预算后仍不能判定 | 形成具名 blocker 和裁决材料 | 不得自动追加 PoC wave 或假设可实现 |
| BRIDGE-BLOCKED | 共同核心已通过，但具名 Bridge 未通过 | 不依赖该 Bridge 的局部 Family 可继续 | CA-03 不算通过；被阻断 Bridge 和全工具发布不得放行 |

所有状态都要带 Owner、输入快照、证据、下一步和重开条件。状态不能只靠自然语言报告；Gate 记录必须在交付索引中机器可解析。

### 7.4 S2 权威迁移必须是有事务边界的独立工作包

S2 第一项交付为 Authority Migration Map，不得先改写入口再补消费者。Map 至少列出旧 current_contract 的全部六个字段、每个消费者、读写方向、权威来源、迁移目标、迁移顺序、回退步骤和负控。

执行顺序固定为：盘点所有消费者 → 冻结新权威 schema 与唯一写入点 → 先部署双读诊断但不双写 → 逐消费者切换到版本化 authority snapshot → 对旧/新冲突、缺字段、未知 ID 和伪造 C1/C2 做真实 CI 负控 → 在单一事务中切换 current 指针 → 验证派生镜像只读且不能反向决定权威 → 演练逆迁移。切换期间所有并行 Agent 必须显式绑定同一 authority digest。

迁移失败时回退至迁移前的已记录权威 SHA 和指针快照；不得从 current-state.json 等派生镜像反向恢复权威。回退也必须通过 CI 负控和独立复审。任一消费者无法确定读写职责、存在双 current 或回退无法证明时，G2 BLOCKED。

### 7.5 G4 与发布的 Bridge blocker 规则

- G4-CORE-PASS / BRIDGE-BLOCKED：ARC-A/B/D 和共同安全原语通过，但某个具名 Bridge 因可定位的 Host seam 缺口被正式记录。只允许不依赖该 Bridge 的工作继续；不代表 CA-03 已完成。
- 完整 G4-PASS：ARC-A/B/D 通过，且至少一个真实具名 Bridge 正向接入成功，证明特殊机制确实被隔离在边界内。
- 若 Bridge 缺口只影响局部功能，必须列明被阻断工具、能力、Scope、替代路径和重新开启条件。不能用“用户已知晓”替代证据。
- 若缺口影响共同身份可信度、授权原语、Body 前拒绝或 Grant 一次性消费，则是 CORE BLOCKER，不能通过 G4-CORE-PASS，也不能靠用户对局部 Bridge 的裁决绕过安全核心证明。
- G4-CORE-PASS / BRIDGE-BLOCKED 不解锁完整 S5 发布；可以提前实施与该 Bridge 无依赖的 Family，但所有必交 Bridge 未解决或未获明确范围变更前，G5/Alpha.5 release 必须 BLOCKED。

### 7.6 PR #361 开发纪律的阶段性替换

PR #361 中允许 Family Owner 在独立 worktree 并行修改 agent-bindings.mjs、team-tool-plane.mjs，再由 Integrator 合并的旧接线纪律，仅适用于旧中心手工接线方式。它与 CA-01 的普通 Family 零中心源改动目标冲突，必须按以下阶段转换：

| 阶段 | Family Owner 允许范围 |
|---|---|
| S1–S3 | 研究分支、独立试验、文档、TestWorld；禁止生产中心接线 |
| S4 | 独立中心重构 Owner 管理 Kernel/Registry/Host Adapter；Family Owner 通过 Contribution 契约协作 |
| S5 | 普通 Family Owner 不得修改受保护中心源码；只有单独审查的中心接口变更 PR 可以修改 |

S2 必须把该转换纳入 #361 的适配版规则，不得让旧纪律在新架构落地后继续作为默认流程。

### 7.7 持续性架构适应度测试

G4/S5 必须持续检查受保护中心源码集合的 Family-driven diff、Kernel/Registry/HostSurfaceAdapter 的工具名或 Family-specific 分支、Bridge 中的第二授权账本，以及 Manifest/生成产物的可重复性和来源差异。测试须有可检测的植入反例。LOC 只可作趋势观测，不设置任意行数门槛。ARC-A 除测试 Family 外，至少包含一个受真实原生 Host 行为与输出契约约束的 Family。

