# Engineering Baseline × Alpha.5 Reset：统一实施计划

> **STATUS 注记（2026-10-30 对齐轮，只加不改）**：用户 2026-10-25 裁决——"PR #364 合并 = 唯一实现计划正本"——已随 #364 合并生效，本文件即唯一实施计划正本（机器指针经 `docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md` 载体指向此处）。下方 2026-10-25 创建时的 DRAFT banner 保留为历史原文：其"不自动授权"语义在裁决前有效、且对**新增**授权动作依旧成立（每个 Gate/裁决仍需 Owner 明确批准，见 gates/GATE-LEDGER.md 与 USER-RULING 系列）。外部审计 #3 P2 项点名本 banner 与执行现状易误导接手者，故加此注记。

> **DRAFT / DESIGN ONLY / NOT ACTIVE — 2026-10-25。** 本文件仅提出统一执行编排；创建或合并本计划 PR **不**自动授权冻结本地任务、删除文件、迁移权威、运行 Host、修改产品或发布。各阶段需另行明确 Owner、入口快照、执行批准与门禁。本文不修改 #361、#363、#360 的实际内容和现行执行合同。

**规范来源：** [#361 Engineering Baseline](https://github.com/ArmourPiercer1/dsh-agent-team/pull/361)（`architecture.md`、`execution-plan.md`）、[#363 Alpha.5 Reset](https://github.com/ArmourPiercer1/dsh-agent-team/pull/363)（中心架构、五阶段、S1 细案）；[#362](https://github.com/ArmourPiercer1/dsh-agent-team/pull/362) 已合的文档/工具资产。源 PR 保留为设计来源，不自动合并，也不允许从两套 Draft 并行激活两个执行计划。本计划获审定后，才通过一次受控的阶段权威迁移将其变成唯一 active Plan。

## 1. 核心决策和当前事实边界

- **统一计划，双重验收：** #361 的 EB-01…15 是工程基础设施验收；#363 的 G5 是 Alpha.5 功能与安全发布验收。前者绝不自动给后者 GO。
- **不重复施工：** #362 已交付 `docs:probe`、`docs:sync`、Notes、Registry、派生状态、合同对照和九包 README。先复核、修复缺口、再接管，不再造平行工具。
- **顺序修改：** #363 S1-A/F0 资产冻结前置；#361 E0/E1 与 #363 S2 合一；#361 EB4-A Evidence relocate 提至真实 Host 测试前；#361 EB2-B WorldFactory 与 #363 S3 合一；#363 S1-B/H0 可行性保持独立于 S3 Oracle。
- **#363 设计红线：** CORE PATCH BUDGET=0，普通非 Team 路径不扩权；唯一可信 PA/Control/Grant/Scope/Lease 链；无 native fallback、无 Body 后拒绝；普通 Family 接线零中心源改动（CA-01），特殊机制放具名 Bridge（CA-03）。M0 93 条记录仅为历史种子，不是永久白名单。
- **工作区事实以本地为准：** 近日的 44GB / 44 Worktree / 2.69GB 剩余空间以及本地未推送提交来自操作方盘点，不是 GitHub API 可证的实时事实。必须用新的本地 F0 观察核实；旧 G1-I PASS、G1-F BLOCKED 视作待与冻结证据核对的状态，不能由报告字面推导执行许可。
- **冻结范围：** :3080、人类 DSH_HOME、官方 pristine Host、受保护 World、旧合同、原始事故证据不可擅动；不得从 `current-state.json` 派生视图反向生成权威事实；不得自动调整合同语义/权限边界或降低旧红门禁。

### 1.1 原计划与统一路线

| #361 原执行 | #363 原执行 | 统一工作包 |
|---|---|---|
| E0 现状审计 | S1-A F0/资产；S2 E0 | U0、U1（增量审计，不全部重做） |
| E1 Notes/Contracts/Registry/探针/权威 | S2 G2 | U1、U2 |
| E4-A Evidence 迁移 | S1-A 空间回收清单 | U3 提前执行 |
| E2-A 来源/Runtime Census | S1-B 静态来源和机制 PoC、S5 动态复核 | U4 静态+PoC，U7 完整自动对账 |
| E2-B 并行 TestWorldFactory | S3 Canary/Oracle | U5 一个共享测试体系 |
| E2-C 测试分层/旧红 | S3 基础负控、S5 全量 | U5 初版，U7 收口 |
| E3 四层 CI / 合并门 | S2 最小 docs 检查、S5 发布门 | U2 最小检查，U7 完整升级 |
| E4-B/C/D/E 诊断/发布/DevEx/并行纪律 | S4/S5 | U6、U7；原“Family 同文件手工接线”仅作为过渡历史，不延续到 CA-01 |
| E5 工程总验收 | S4 G4 / S5 G5 产品总验收 | U8 两套独立门禁 |

### 1.2 统一依赖 DAG

`U0 安全保护+F0 → U1 E0/E1 复核与 G1-I 增量核查 → U2 S2 权威迁移/G2 → U3 Evidence/Worktree relocate → U4 S1-B/H0/G1-F → U5 WorldFactory+Canary/G3 → U6 中心重构/G4 → U7 工具族及余项工程基线 → U8 E5+G5。`

此顺序表示**主实施顺序**，不是取消所有并行：U3 的非破坏性迁移方案可与 U2 后段并行准备；U4 的只读来源盘点可以较早进行；U5 在 G2 通过后可独立进行 Canary 测试，即便 G1-F 仍阻断，但不得触发受阻的 Alpha.5 产品执行。**U6 必须同时持有 G1-F PASS、G2 PASS、G3 PASS**。任何涉及安全前提的阶段不得从较晚任务倒用证据提前放行。

## 2. 统一工作包（每项独立交付、短 PR）

### U0 — 安全冻结、恢复最小写入空间

**Owner：** Freeze/Recovery Owner；**入口：** 单独批准保护与针对性回收；不假设现存工作树已经安全。

- [ ] 停止增加 product writes/合并/Host 安装；安全收束在途操作或记录活跃例外，**不按 PID/name 批量 kill**。
- [ ] 采集新的 F0：本地/远端全部纳入 refs 与 SHA，#360/WIP、dirty、untracked、stash、local-only commits、World/进程/端口、Host Pin、工具 Profile、存储卷/路径 owner；区分 observed/excluded/unknown。
- [ ] 对只有本地存在的提交、未跟踪资产、事故 Evidence 做独立位置备份；校验哈希且执行抽样恢复。远端 GitHub PR 不能充当本地资产恢复证明。
- [ ] 只在明确 Owner、无在途使用、确认可再生或已备份后，执行**每次单独批准的、精确路径的**临时物回收；先 dry-run，再记录预/后 `df/du`。共享 inode/hardlink/WSL 虚拟盘要区别报告。
- [ ] 给 :3080、用户 DSH_HOME、活动 Worktree、关键事故证据和 pristine Host 设置禁止操作清单；将 UNKNOWN/IN-USE 送有 Owner 的处置队列。
- **验证/负控：** 故意放一个本地唯一内容或活跃 World，清理判定必须拒绝；任一复制/恢复哈希错误必须阻断；用户路径及稳定端口前后不变。
- **出口 U0-PASS：** 不可替代资产拥有可读可恢复副本；可用空间满足 U1 测试的峰值与余量预算；新增工作不会立即引发 ENOSPC；冻结清单有不可变 digest。空间不足/所有权不明→`BLOCKED-LOCAL-OBSERVATION`，仅允许只读审计。

### U1 — #361 E0+E1 在当前基线增量复核，闭合 S1-A

**Owner：** Audit/Doc/Contract Owners；**入口：** U0-PASS，读取 #362 已合实现，不从零实现。

- [ ] EB0-1 权威/文档四真值及消费者核对；EB0-2 九包测试、CI DAG、历史 9 红/22 Root 红的来源、Owner 和新增红区别；EB0-3 Team/Host/Profile/MCP 来源与 93 条历史种子差集；EB0-4 Evidence/World/Worktree 的 A/B/C/UNKNOWN；EB0-5 同平台同 selector 有界重复样本的 p50/p95 与噪声条件（不能用 n=1 冒充）。
- [ ] 与原 S1 F0/G1-I 记录做冻结后增量差异；若发现原快照漏掉当时已存在的关键源或本地唯一资产，针对受影响命题重开复审，不自动重跑全部 S1。
- [ ] 复核 #362 的 EB1-A/B/C/D/E/F/G：`docs:probe` 的范围/变更识别、`docs:sync --check/--write` 边界、Notes/ID、派生状态、合同字段覆盖与未覆盖项。用负控而非只看脚本存在。
- [ ] 修正“implemented_in_branch / not merged”等过时叙述，按 Git、批准和实测分别记录；proposed ID 不得自动 ratified；生成文件不允许人工改写。
- [ ] 输出全部当前消费者（含 `ci-pr-gate` Q1–Q8、`testkit`、`AGENTS`/phase-baseline-ref、状态/计划检查器），记录读取字段、写入权限、替代入口及迁移次序。
- [ ] 新 Agent 冷读：仅从当前入口、合同、九包 README 和工具帮助可解释现期阶段、变更边界、批准与测试层次；错误引用或声称 C1=C2 必须被识别。
- **验证/负控：** 假 verified/merged/released、错合同 ID、陈旧生成目录、源码改动未更新 owner docs、未实现 Proposal，分别得到正确 fail/pass；测量实际 CI 与本地探针耗时；检查旧数据与新增数据严格按 SHA/环境分组。
- **出口 U1-PASS：** E0/EB1 项的“已有实现、已验证、已采用”逐项分轴报告；G1-I 的增量可信、资产受保护；U2 具有完整 Authority Migration Map 初版。如 EB0-5 无法安全补测，写 `NOT_VERIFIED` 并保持其依赖门禁 BLOCKED，不假造 G2。
- **停工：** 读写范围与当前 Owner 冲突；新旧来源事实无法解歧；未识别的有效权威消费者；无界新增清单。

### U2 — #361 E1 + #363 S2：一次性文档/执行权威迁移

**Owner：** Workflow/Contract Owner，独立 Security/CI Reviewer；**入口：** U1-PASS + 受审 G1-I 事实。G1-F 未通过时仅允许与未知 Host seam 无依赖的文档/治理路径。

- [ ] 确立**一个可编辑当前执行事实源**及其 Schema/Owner；历史 `graph.yaml#current_contract` 六字段的语义、唯一 active 指针与 consumer-read law 不得丢失。`registry.yaml` 决策登记与 `current-state.json` 派生视图**不能凭存在就替代 current 权威**。
- [ ] 先完成 Authority Migration Map：每个旧消费者、读写方向、版本/字段、新来源、迁移 PR、并跑/切换/回滚步骤、权限与 Host 依赖。
- [ ] 冻结新 Schema 和唯一 Writer；新旧**双读诊断、绝不双写**，对差异 fail-closed；对涉及未证 Host 权限事实的消费者继续使用旧受审路径，不隐式切换。
- [ ] 将 `docs:probe` 和按影响面 `docs:sync --check` 加入已有 CI 的**最小强制检查**；保持原 `pr-gate/census-runtime` 安全门禁有效，不提前构造第二套“唯一 Required”。
- [ ] 对实际获授权的全部消费者执行短事务切换，固定 authority snapshot digest；验证旧/current 冲突、缺字段、错 ID、伪造 C2、跳过检查时不能绿。
- [ ] 演练回退到**迁移前的权威 SHA + 原指针快照**；不得通过派生视图反向恢复；旧历史文档不改写，已批准权限合同不重定。
- **Gate G2：** 唯一 current 生效、全部必要消费者一致、负控真红、回退能恢复、最终合并 SHA 与 digest 锁定且独立复审。若仅完成不依赖 Host seam 的文档准备，登记 `U2-PARTIAL/G2-BLOCKED`，不得以“文档已接管”放行依赖 G2 的 U5/S4。
- **停工：** 双 current、合同安全语义变动、消费者无法识别或逆迁移不可证明；形成独立裁决材料，不私自扩大权限。

### U3 — 提前执行 EB4-A：Evidence relocate 与轻量 Worktree

**Owner：** Evidence/Storage Owner；**入口：** U2 对相关文档治理消费者已完成受审切换、证据来源清单可靠；阶段可先复制，不可在切换未闭合时删原始 Evidence。

- [ ] 对受保护事故/安全验证证据、一般可恢复 RUN、纯缓存建立清单：原始路径/Blob SHA、内容 hash、敏感性、生成环境、关联 Commit/Host/World、保留期、Owner、访问方式。
- [ ] 选择可证实保留/读取的仓外 Artifact store；内容寻址或不可变对象 + 小型 Manifest/索引；数据脱敏及访问控制与保存策略不低于现有 A 类证据。
- [ ] 执行 **copy → read-back/hash → sample restore → switch readers → negative controls → reviewed delete**；所有链接、测试脚本、CI、docs 的引用影响需明确列出和改写。
- [ ] 在**独立 PR** 中停止在新 checkout 物化已成功迁移的旧 tracked 大 Evidence；**不重写 Git 历史、不 force push**。旧 Git 历史可追溯，但不能冒充新的仓外持久性。
- [ ] 缩减实际长期活动 Worktree 数量；在必要且验证兼容后使用 sparse-checkout/分支归档/共享受限构建缓存；不要在每个 Worktree 携带同一份大型 Evidence、Host clone、World。
- [ ] 设定临时文件/World/Runner 容量限额、保留期、Owner、超限停止与安全回收；特别验证 diff 视图异常会不会再次无界生成大 `tmp`。
- **验证：** 某个 Artifact 缺失、错 digest、代际错误、恢复失败必须 RED；两个不同 Worktree 读取同一 Manifest 成功且不会再复制 588MB 级历史证据；受保护 Evidence 不丢、`df` 实际回收量有测值。
- **出口 U3-PASS：** 真实迁移及回滚可证明；新的工作树布局有空间/峰值报告；常态 5–10GiB、集成高峰约 20GiB 是有条件目标，超出须列明不可回收理由与新预算。
- **停工：** Artifact 的唯一性无法证明、读者迁移不全、用户 World/历史证据可能被删、存储端无法保证恢复。未知资产只进入有期限的处置队列。

### U4 — #363 S1-B：有限 Host seam 与逐工具可行性，判定 G1-F

**Owner：** Feasibility/Host/Security Owners；**入口：** U3-PASS 或明确足够的独立资源；以经迁移后的新 SHA/authority/Artifact digest 固定 PoC 输入。允许本阶段独立真实 Host Runner，不借尚未完成的 U5 Oracle 宣称结果。

- [ ] 从可信 Host/Team/Profile/MCP 来源导出冻结 `ExpectedToolObligations`；所有必交条目逐名记录来源、scope/variant、执行效果、候选 adapter/bridge、支持证据、Owner、未知事项；93 条不是永远封闭列表。
- [ ] **H0 最先执行：** 使用 pristine pinned Host 的真实公开注册与 dispatch，验证 Guard→dispatch Definition/Binding 的 TOCTOU：稳定正控、换代、同名替换、Scope 改变、异步竞争、测试灵敏度植入反例。未验证 Body 有一次执行即 `UNSAFE/BYPASS`；不能靠事后拒绝/日志视为 PASS。
- [ ] 其后按共享机制分组做最小 PoC：普通 Family 贡献接口及 Body 前拦截；FS/read 与 process/bash；具名 Bridge；动态来源变动与 Domain veto。逐工具静态分类不得升级成真实 Host PASS。
- [ ] 回收 #360 等 WIP 时只按源码/行为/来源 SHA 评价 reuse/extract/redesign/retire，不能把 WIP/局部 C1 假定为已装配产品。
- **继承原 S1 项目级上限，不因拆分 U0/U1/U4 重置：** 2 个工作日、合计 ≤16 Owner-hours、≤20 独立 PoC、≤12 次真实 Host 启动/重启、每实验 ≤30 分钟、每实验新增证据 ≤2GiB；每假设初次 + 最多一次具有区分目的的复试。旧阶段已耗用额度须核账；不足必须先独立申请新额度。
- **Gate G1-F：** 全必交项有可信路线或具名 blocker，H0 具有真实机制证据/正式阻断，记录 `READY-PUBLIC / CONDITIONAL / ENV-BLOCKED / CORE_SEAM_BLOCKER / UNKNOWN`，独立 Security Review。已知核心 seam 失效→禁止 U6；G1-I PASS 不等于 G1-F PASS。
- **停工：** H0 未验证 Body 执行、无法可信观察身份、预算用尽、来源集合试图无限增长；输出有界裁决单，不自动展开新的研究波次。

### U5 — 合并 EB2-B + S3：一个 TestWorldFactory + Canary/Oracle

**Owner：** Host/Test Maintainer；**入口：** G2 PASS、U3 可用的 Artifact/资源预算。即使 G1-F 阻断，隔离的基础设施 Canary 可在证明不接触受阻产品路径后推进；不得执行不安全 Alpha.5 纵切。

- [ ] 复用 `tests/paths.mjs`、`characterization/lib/instance.mjs`、`rc2-real-host-smoke/run-control.mjs`、`bounded-run.mjs`，不建立第二套 Host launcher；Host/build/install key 与 lockfile digest 固定、基座只读。
- [ ] Factory 创建每 World 独占 DSH_HOME/workspace/log/Mock provider/端口 lease/进程组/目录 owner；跨进程资源租约可崩溃恢复；只使用批准的 3180–3186、3491–3500，:3080 零触碰。
- [ ] 以测试插件 Canary 走真实公开 registration→dispatch→效果→返回路径，覆盖正控、错误返回却发生副作用、wrong scope、启动失败、超时、中断、泄漏；植入缺陷时 Oracle 必须 RED。
- [ ] 先单 World 重复验证，再运行 2 World 并行 read/write/approval/restart（测试侧）和一方异常退出；其他 World、用户实例、pristine Host 不变，释放 owned PID/port/home。需要 Windows 的完整子进程树清理时单独 ENV_BLOCK，不借 Linux PASS 充数。
- [ ] RUN 机器记录绑定 Team/Host SHA、Profile、source digest、World ID、选中测试与 effect/cleanup；回收与失败分类按实际收据，绝不把 REFUSED/ENV_BLOCK/SKIP 当 PASS。
- [ ] 建立最低限度的测试层次与历史红索引：Adapter-local C1、real-Host C2、固定候选 C3；保留 read/bash/unsupported 的产品 RED，不允许 Canary GREEN 洗绿未实现工具。
- **Gate G3：** 可重复的真实 Host Canary 正/负测试；对植入故障敏感；安全回收与并行无干扰；证据绑定 G2 **最终合并 SHA** 及有效 authority/Host 快照。输入若变更，重跑受影响的 G3 RUN。
- **停工：** 清理触及非自有路径、Host 需要私有接口、Oracle 看不到副作用或负控假绿。

### U6 — #363 S4：中心装配层重构与首个真实纵切

**Owner：** Center Integrator + Security/Bridge Owners；**硬入口：** G1-F PASS + G2 PASS + G3 PASS（缺一不可）。

- [ ] 受审提取 #360/master 可重用逻辑；建立版本化 Family Contribution、可信 Registry/Kernel、HostSurfaceAdapter、具名 Bridge；Family 不授权自身 Grant、不能绕开 PA/Control/Domain veto。
- [ ] ARC-A：至少两个不同 Family 中普通新 Family 不修改中心受保护源码；ARC-B：read/FS 与 bash/process 共享单一授权与生命周期，真实 Body 前 deny、取消和清理；ARC-C：至少一个具名特殊 Bridge 真实打通；ARC-D：注册换代、scope、撤销、冷启动、teardown 的恶意负控。
- [ ] 移除或证明严格兼容旧中心双路，不允许两个授权账本；dist/package/install 采用正式来源与 SHA 验证；普通非 Team 行为不得改变。
- [ ] Family Owner 通过 Contribution 独立并行；**受保护中心源码仅 Center Owner 变更**。#361 允许不同 Worktree 并行手工修改同一中心文件的旧纪律在本阶段被 CA-01 目标替换，不能作为默认 S5 接线方法。
- **Gate G4：** ARC-A/B/D 和至少一个真实 Bridge 的固定 SHA C2 验收；若仅局部 Bridge 阻断，`G4-CORE-PASS/BRIDGE-BLOCKED` 不等于完整 G4-PASS，不解锁全工具交付；核心身份/Body 前拦截缺陷无部分 GO。
- **停工：** 新普通 Family 仍需硬编码中心表、出现双 Grant/Control、非 Team 回退或公开 Host seam 不可信。

### U7 — #361 E2 剩余 + E3/E4 与 #363 S5 逐族交付

**Owner：** Tool/Test/CI/Evidence/Release 各独立 Owner；**入口：** 完整 G4-PASS；无依赖 Family 的受控局部工作必须单独声明，并不自动使 S5 全面解锁。

- [ ] EB2-A 完整动态 Census：`AuthoritativeToolSources→ExpectedToolObligations↔ObservedRuntimeInventory`，真实 Scope/Binding/Provider/Definition/Revision 身份与可信配置差集，来源新增自动 UNKNOWN 而非授权；固定 snapshot digest。
- [ ] EB2-C 完成九包历史 9 红、Root 22 旧红归属/复现/退出；分离 T0～T4、C1/C2/C3；修复具名测试竞态而非删安全测试。
- [ ] EB3-A/B/C/D 分层 CI：`ci-fast`（强制 docs:probe/命中 docs:sync）、`ci-integration`、`ci-security`、`ci-full`；变更影响图对未知影响非零选择；合成 merge tree Required（缺席、skip、ENV_BLOCK、refused、cancel 不能绿）；RUN Manifest 校验来源与证据。
- [ ] EB4-B/C/D：安全调用链诊断、安装/冷启动/恢复/发布手册、有限 DevEx 命令；EB4-E：并行的 Family Contribution 及短事务集成，分支局部 C2 不能替代合并后的 C2。
- [ ] S5 各 Family 在独立文件及可控 Worktree 中通过 C1 → branch-local C2 → merged-head affected C2/跨 Family 安全 → 真实 package/install；对必交项逐一覆盖真实功能正控和安全负控；来源变化生成新快照。
- **验证：** 故意移除必选 CI job、引入未知 MCP 工具、替换执行 Definition、让某 Family 影响别的 Family 时必须被发现；保留非 Team Native 正控、旧红完整身份集合。
- **出口 U7-PASS：** 工程基线 EB-01…15 具备固定候选验收所需材料，S5 全工具产品候选具备 C3 输入；不能以局部全绿替代最后双验收。
- **停工：** 受审语义意外扩权、CI 伪绿、无来源可追溯、功能必交项仅“拒绝所有调用”、工具族接线复活中心耦合。

### U8 — 两个独立最终验收：E5 工程基线 + G5 产品

**Owner：** Independent Release/Test/Security Reviewer，最终用户决定产品 GO。

- [ ] 固定单一候选：Team SHA、Host SHA、toolchain/lockfile、package hash、Profile/config、trusted sources digest、World/Oracle/Authority digest；所有 RUN 指向同一有效快照。
- [ ] **EB-GATE：** 按 #361 EB-01…15 全部复验九包/权威、文档门禁、动态工具、2 World、真实 T2/T3、合成 CI、历史失败、Evidence 可恢复、并行 Family 新纪律、发布与回退。#361 EB-11 按 #363 CA-01 重述为两个 Family Contribution 并行、中心零 Family-driven diff 与 merged-head 安全复验，不再把手工修改两个中心文件当作成功条件；该变更需先独立审查批准。
- [ ] **PRODUCT-GATE：** 按 #363 G5 在正式安装包、真实 Host 的同一候选上逐项完成 Alpha.5 已批准必交工具的功能正控、安全拒绝、审批/取消/重启/代际/非 Team 回归、恢复和完整 C3。未解决的强制 Bridge/CORE blocker 阻断 GO。
- [ ] 两套结论分别为 PASS/BLOCKED/NEEDS-RULING，并附证据索引；即使 EB PASS，也不能将 Alpha.5 产品标为 released，另需明确用户批准。
- **停工：** 任何关键源或 authority digest 变化使依赖 RUN 失效，先重新校验影响范围，禁止利用旧快照伪通过。

## 3. 跨阶段门禁、预算和组织

| 阶段出口 | 解锁下一步的必要事实 | 不足时允许 |
|---|---|---|
| U0-PASS | 本地不可替代资产受保护，容量可承载工作 | 仅无写入审计 |
| G1-I（U1） | F0/资产/来源覆盖可信；UNKNOWN 均有 Owner/保护 | 与缺口无依赖的文档预备 |
| G2（U2） | 唯一 current 和完整消费者迁移/回退、负控真红 | Evidence 仅拷贝预备，不删源；只读可行性文档 |
| U3-PASS | 证据可恢复且新工作树不再重复爆炸 | 不得删除原 Evidence 或开展高写入测试 |
| G1-F（U4） | H0/公共 seam 可行，关键 Family 机制有可核路线 | U5 独立安全 Canary 可继续；U6 停工 |
| G3（U5） | 真实 Host Oracle/WorldFactory 能检出错误且安全回收 | 修复测试底座，U6 停工 |
| G4（U6） | 核心+至少一个真实 Bridge/纵切有证据 | 无依赖的局部 Family、非发布性质工作 |
| U7-PASS / E5 / G5 | 完整工程/产品双验收，受控发布 | 不发布，保留阻断与证据 |

- 每个阶段有一名 Integrator/唯一合并分支 Writer、分立 Owner 和至少一名不参与该阶段实现的 Reviewer；具体人员在授权单中指定，**不凭角色名假定已授权**。
- 每个施工 PR 只处理一项可回退的目标；提交前填写：inputSnapshotDigest、触及路径、实际更改、测试选择与结果、未测/ENV_BLOCK、容量增量、停工分叉、回滚命令/恢复点。原始大日志不纳入 Git。
- 总体空间预算以实测 `df/du` 和任务峰值控制；单次生成证据/临时目录有限额，达到上限即停止，不允许通过增加新的 Worktree 绕过。原 S1 预算共用，不因 U0/U1/U4 拆分重复领取。
- 状态机器可解析且记录 `status + owner + input digest + evidence + next action + reopen condition`。计划、实现、验证、被采用、发布为不同事实；`SKIP/REFUSED/ENV_BLOCK/UNKNOWN` 不是 PASS。
- 每个阶段只允许一次有界独立审查 → 定向修复 → 复审；仍阻断则形成明确技术裁决和预算申请，停止自动循环，不扩展无边界调查。
- 只修改当前阶段拥有的文件。任何涉及安全合同、官方 Host Pin、现行 graph/AGENTS、稳定实例、旧历史 Evidence 的更改，均走具名批准与独立 PR，绝不凭本计划自行授权。

## 4. 第一轮施工拆分与批准点

1. **计划 PR（本 PR）：** 仅新增本文，供架构/执行顺序审查。No product edits、No workflow/CI edits、No current authority switch、No deletion、No Host boot。
2. **U0 独立授权与恢复批次：** 在本地确切可观察环境执行；若访问不到原机，则报告 `BLOCKED-LOCAL-OBSERVATION`，不能假称完成。
3. **U1 审计/校验批次：** 首选在已合 #362 上补修事实、复测和最小负控，不新建框架。
4. **U2 权威迁移提案 + 实施 PR：** 先审 Authority Migration Map，再审单一短切换事务与回退，不让两处 current 并存。
5. **U3 Evidence 独立存储/读者迁移 PR + 清理批准批次：** 先确认迁移成功才进入清理；不和 U2 的主权威切换混在同一 PR。
6. **U4 H0/PoC、U5 TestWorld、U6 核心、U7 Family/CI/Evidence 余项分别按 Gate 建立小 PR；U8 最终评审。**

**待用户单独批准的决策：** （a）是否采用本文作为统一唯一实施计划及当前停止/恢复范围；（b）本地资产备份的实际目的地与访问/保留要求；（c）真实权威记录的最终存放位置和消费者迁移窗口；（d）对历史 Evidence 的独立可恢复存储及获批删除清单；（e）G1-F 若需要额外 PoC 预算时的上限。未批准前不得代替用户作安全、历史保留或发布裁决。
