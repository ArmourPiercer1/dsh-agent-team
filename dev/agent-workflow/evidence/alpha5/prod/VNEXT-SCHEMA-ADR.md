# VNEXT-SCHEMA-ADR — Blueprint schemaVersion 4 / vNext 对象模型：原计划必需语义逐条三分 + 迁移顺序 + 待裁最小集

- 轮次 = `alpha5-prod-vnext-adr`（P-D writer）；模型 = qwen3.8-flash-next；基 = `origin/master @ d714a941`（fetch 亲验）；一次性 worktree `.worktrees/a5-pd-vnext-adr`，branch `alpha5-prod-vnext-adr`。纪律 = 只读 + 本文件新增（+ `PRODUCTION-READINESS-CHECKLIST.md` 更正节 append）；**零代码/零矩阵/零 gate 行改动**；零端口、零世界、`:3080` 未触碰。
- 修订 = **P-D2 @根 08:05Z 口径**（base=`7d609a08`，同分支再一笔）：§6 精简重构——R-1/R-2 移出待裁（07:53Z 用户已批，转录存证）＋ A 项归 ADR Gate 常规转正（非逐条问用户）＋ 真用户级语义分歧单列（A-4/A-3/A-2/当前不支持能力清单）＋ 新增硬约束『不得借 v4 迁移擅自裁历史 trim』＋ A-7 降级派生项（依赖 A-4∧清单姿态）＋ 净用户待裁数重算=7+1 派生。§1–§5 **语义零改动**（仅一致性标签与指针；正文其余逐字节不动）。〔本行的『净 7+1』与下表旧『已提待答/新增待裁』口径随后被 P-D3 @根 14:29Z 声称同步取代，见下行；本段作为 08:05Z 时点修订记录保留不抹。〕
- 修订 = **P-D3 @根 14:29Z 口径**（branch `alpha5-doc-correct` @`origin/master 93cd7b09`（fetch 亲验），同证据树再一笔；**markdown-only，仅本文件**）：三件**声称与事实同步**纠错（根件一含 ①② 两处），**零新语义、零新裁决**——① Q1/Q2/OpenAtPort/PTC-net 状态改为 **内部提案在册；尚未向用户正式提出；不得归因『用户未答』**（旧文『已提（C12 brief §3）待答/已提待答/在册待裁/勿重复提』把内部提案条目写成『已向用户提出待答』= 声称失真）；② R-1/R-2 = **07:53Z 用户批准 + 已实施合入（#304=`77ffb187`）**，本文件内『待答/待裁』残留清除；③ §6.1 保证类清单 D-1 条目分列：**『扩大取消范围/延期』= 用户已批准项，与其他保证分开列**（指针 = `PENDING-GATES.md` G-a 行 17:52Z 裁决原文 + D-1 行 DEFERRED 有主），其余保证（投递精确性/静默安全）状态不动；④ A-4/A-3/A-2 改为**『先核对既定语义，再出最小真待裁』工作条目**（附既定语义出处指针），§6.1/§6.2 **不构成七项用户问卷、不是『待用户批量裁决』**；A-7 维持派生项口径。
- 命题来源 = Alpha.5 计划 §11（`docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md:169-175`，下称 **S0§11**）点名『建议 4，但须记录**正式 Schema ADR**』；本文件**不是**正式 Schema ADR，是其**语义清单与装配可行性底稿**：把原计划对 v4/vNext 对象模型的每条必需语义归入三类，**禁默默省略**——凡计划文本出现的必入表。
- 输入（行号全部本轮亲验 @d714a941 树）：**ARCH** = `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`；**DEV** = `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`；**MA** = `docs/plans/memo/alpha5-tool-io-governance/architecture.md`；**DES** = `docs/plans/memo/alpha5-tool-io-governance/post-poc-technical-design.md:222`；**CAND** = `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/ADR-CANDIDATE-blueprint-schema-vnext.md`（D-01..D-11 候选决策集）；**NEG** = 同目录 `migration-negative-cases.json`；生产面事实 = `PRODUCTION-READINESS-CHECKLIST.md`（@5bea01c6，更正节见其 §5）+ `pr8/vnext-migration-gap-checklist.md` + `pr8/gap-classification-ABC.md`（正本在未合分支 `alpha5-gap-classify@9a7a0552`）+ `LSP-rulings-brief.md` + `w-lsp-dr/README.md` + `c12-l1/README.md` + `C12-decision-brief.md`。

## 0. 三分口径

- **【现】已可实现** = 公开 seam / 已合并代码在场，给出装配草案（§4），不待新语义。
- **【裁】需新语义未设计** = 计划文本未给出确定语义，正式 ADR 必须逐条裁决（§2，每题一句+选项）。候选决策集 CAND 已钉者 = **转正项**（ADR 起草人提案、Gate 采纳）；CAND 未覆盖者 = **新增待裁**。
- **【迁】纯迁移工作量** = 语义已定、只缺文件级实施（§3）。

## 1. 必需语义逐条表（锚点 = 原计划行号）

### A. 版本与接受语义

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| A1 | vNext = 整数 `schemaVersion: 4`；运行时严格成员检查、逐版本钉死独立解析器、禁区间推断 | S0§11:171（『建议 4…正式 Schema ADR』）；DEV:2304（G4『schema version mismatch fails loudly』）；DEV:1363（contracts 放 schema version constants） | 【裁·转正】CAND D-01 | 版本门禁**代码已在**：`packages/domain/blueprint/src/validate.ts:1295-1302`（不在 SUPPORTED 集⇒typed 拒）+ `:1283-1293`（非整数即拒）。待办 = ADR 转正 + 常量翻转（§3 M-1）。 |
| A2 | 同窗口双版本 {3,4} 兼容接受、v3 语义零漂移 | CAND D-01（窗口 {3,4}）；DES:222（『任何版本变更不得静默扩权或修改 Alpha.4 已绑定的 Authority Envelope 生命周期』） | 【裁·新增=**A-4**】 | 窗口**时长/退出条件**计划未给——产品边界（§2 A-4，用户级）。机制零新件：`schema.ts:75` SUPPORTED / `:90` DEFINED / RETIRED 派生集 + `BLUEPRINT_MIGRATION_REQUIRED` 臂（`blueprint/src/inspect.ts`、`runtime/src/plugin/blueprint-authority.ts`、`plugin/root.ts`）在 v1/v2 退役轮已全链在产，v3 退役=同臂复用。 |
| A3 | v3 文档按版本钉死解析器继续运行、load-time 零变形 | S0§11:171；CAND D-07① | 【迁】 | validate.ts 已按版本分表（`:1311-1315` v3/v2/v1 三分支 + `:392` 模板字段分表）；v4 = 平行第四分支，v3 分支禁改（fence 见 M-1）。 |

### B. toolBindings 与 I/O Policies（S0§11:171 四字段族）

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| B1 | `toolBindings[]` 作者面（owner/name/authorization + io + execution；标识符=已安装受信注册表项，禁 YAML 内嵌可执行 JS） | MA:33-68（示例+『CURRENT Blueprint v3 DOES NOT ACCEPT』:35）；S0§11:171 | 【现】 | 内部对象已冻结：`tool-governance/src/binding.ts:56` `ToolBinding`（含 agentScopeKey/toolName/providerId/implementationOrigin/executionBoundary/assurance/policyGeneration/authorityGeneration :57-73）；作者面→内部面映射引擎已落码且默认拒绝 = `packages/domain/vnext-field-mapping/src/field-mapping.ts`（DEFAULT DENY/NO IMPLICIT DEFAULTS/NO COLLISIONS 四律，DORMANT 待接）。装配草案 §4-S1。 |
| B2 | 绑定作用域键对齐冻结对象模型（TeamBlueprint→TeamSession+TeamDomain→MemberInstance；红线=vNext 无 Team SessionEvents） | ARCH:99-103/243-295（对象模型图）/1018（§14 TeamDomain）；S0§11:171；CAND D-04 | 【现】 | 对象模型侧 P 系列已落（checklist C-03/13 无差距行）；作者面键 `(realmId, memberScopeKey, owner, toolName)` 与 `ToolBinding`/`ResourceRef`（`resource.ts:76-81`）一一对应，不新造第二套身份语言。 |
| B3 | 字段映射默认拒绝：封闭字段表、未知键 typed 拒、禁剥离放行/alias 折叠 | S0§11:173（『严格 Schema 拒绝未知字段/错误版本』）；CAND D-02 | 【现】 | 引擎在场（B1 行 field-mapping.ts）+ 封闭表面已在模式：validate.ts 逐层 take/封闭字段集 + `scripts/verify-blueprint-version-clean.mjs`（已提交的版本干净性 fence）。负例已有机器可读件 = NEG（`adr_ref` 逐条指 CAND）。 |
| B4 | Read/Write I/O Policies：`mode: all|restricted` + allow/ask/deny 路径规则；`restricted` 下未写=deny、`all` 起点=执行身份可达集再叠排除 | MA:70-77（§4 全节）；S0§11:171 | 【现】+【裁·转正】CAND D-03 | 资源面词汇已冻结：`resource.ts:66-73` `RESOURCE_RIGHT_MATRIX`（workspace/realm-home/absolute-path/directory/metadata/network-destination × rights 矩阵，越矩阵 typed 拒）+ `:88` 起 locator/`..` 校验。『缺省永不展开为权限』的歧义组合处置= D-03 转正（起草人级）。 |
| B5 | 路径文法入 schema：禁一切 `..` 段（含折叠后合法者）、首尾空格保留、歧义字符显式报错、`~/` 由受信 Realm 解析、schema 期零归一 | MA:70-77（§4 文法原文）；CAND D-09 | 【现】 | `resource.ts:88` validateLocator 已做形状校验（`..` walk、URI/路径互斥）；Realm 解析留执行面（`~/` 不落 schema）= 现形状天然满足。 |
| B6 | Network I/O Policies：`mode: allow|restricted|deny`；restricted=端点具名+执行前 ask；缺能力 Provider ⇒ typed 拒不静默放行 | MA:79-88（§5 全节）；S0§11:171 | schema【现】；执行面【迁/在册阻塞】 | `network-destination` kind 已在矩阵（`resource.ts:72`）。**执行面**外层网络 OS 强制=零公开 arm（checklist PR6-PTC-外层行；#296 在册，出路=上游词表需求）。由此派生 v4 发布姿态问题 = **A-7**（§2，**派生项**——依赖 U-4∧U-1 随批落字，不单独问用户，见 §6.1/§6.2）。 |

### C. Provider/Execution Boundary Binding 与 Assurance（S0§11:171 第 3/4 字段族）

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| C1 | 三正交轴 `implementationOrigin` / `executionBoundary` / `assurance` 取代旧 `execution.kind` 互斥枚举；旧 native/custom/shadow-run 不作 vNext 安全等级字段 | MA:95-101（route 表+『Assurance fields are diagnostics, not authority grades』:101）、MA:218（§14 表）；CAND D-05 | 【裁·转正】CAND D-05 | 词表**已冻结在码**：`tool-governance/src/assurance.ts:36-51`（三轴枚举与 CAND D-05 逐字一致）+ `:149 parseAssuranceContract`。schema 面=照词表入封闭表（迁 M-2）。 |
| C2 | Assurance 逐能力记录（机制/作用 Realm/可信根/证据），运行时探测推导；**声明零授权力**、反缓存 | MA:101/:183/:218-222（§14.4）；CAND D-10 | 【现】+【裁·新增=**A-6**】 | 探测/证据面已在（`sandbox-provider/realm-evidence.ts`、W4 轮 ENFORCE-CONFIRMED 证据法）。『作者声明 assurance 期望 vs 运行时 probe 实测不符』的**启动行为**（拒装/降级披露/忽略声明）计划与 CAND 均未给 ⇒ §2 A-6。 |

### D. Authority Envelope Scope 语法扩展

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| D1 | Alpha.4 两份 envelope 的 Scope 语法合法扩展至新操作类型（fs read/write/metadata、network destination、Domain reference）；**不引入新 rung/super-envelope、不改已绑定 Blueprint 生命周期** | S0§11:171；DES:222；CAND D-06 | 【迁】 | 扩展点在场：`authority-envelope/src/authority-envelope.ts:78`（matcher kinds exact/subtree/fingerprint）、`:90-107`（operation classes 封闭集含 shell-class）、`:126-168`（AST）+ `coverageOf`/`containment-undetermined` 语义。文件级步骤 = §3 M-3。 |

### E. 迁移语义

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| E1 | 升级=显式操作；机器可读迁移报告（逐字段 carried/rejected/requires-decision）；禁静默升级/load-time 自动演进 | S0§11:171（『迁移必须显示拒绝/升级策略』）；CAND D-07 | 【迁】+【裁·新增=**A-8**】(报告出口工具面) | 报告模块为新建（M-4）；requires-decision 之后**作者怎么改**（CLI 重跑/编辑草案）是否归 v4 轮 = §2 A-8（起草人级）。 |
| E2 | 硬不变式：升级后有效权限集不得大于升级前；动态 Binding/新 Tool 不因迁移隐式 allow | S0§11:171/:173；CAND D-07③④ | 【裁·转正】CAND D-07 | 计划文本已钉『不自动从缺省字段推断 unrestricted』（S0§11:171），候选只是载体化；负例=NEG 在册。 |
| E3 | 未知枚举 typed 拒，禁 coerce-to-deny 伪装 | CAND D-08；DES（错误命名纪律） | 【裁·转正】CAND D-08 | 与在产纪律同构（C-ADM『未知⇒拒+诊断』）；照 D-08 落词表即可。 |
| E4 | v4 哈希=解析后封闭字段表规范形式；v3 哈希漂移债不搭车 | CAND D-11；COORDINATION 收口清单同判 | 【裁·转正】CAND D-11 | `blueprint/src/hash.ts` 在场；t2-blueprint-hash v3 漂移=独立债务在册。 |

### F. vNext 对象模型层（TeamBlueprint→TeamSession+TeamDomain→MemberInstance）

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| F1 | 对象模型层级本身：Blueprint≠运行态；TeamSession+TeamDomain 分离；MemberInstance=Team-owned Agent+Session（0..N per template） | ARCH:99-103、243-295（§4 图）、580（§8）、729-808（§10）、1018（§14）；DEV:2110-2160（§16 Phase3）、DEV:2297（G4『TeamDomain is sole Team control-plane authority』） | 【现】 | P1–P9 已落（checklist C-03/C-13 无差距行；registry/kit 活体经 durable MemberInstance 读回，见 checklist PR7 行）。v4 schema **不**改写对象模型——v4 是 Blueprint 文档格式事件。 |
| F2 | Blueprint identity（blueprintId/revision/contentHash/source；文件路径/显示名/cwd 不入场）+ catalog + immutable snapshot + parse-once→validate→snapshot | ARCH:308-322（§5.2）、:196、:373+（§5.5 强校验）；DEV:2134-2141（revision/contentHash/strong validation/immutable snapshot/catalog source abstraction）、DEV:522-580（§4.3 parser mechanics MIGRATE、old member schema REPLACE、parse once→validate→snapshot） | 【现】 | v3 已全链在产：`blueprint/src/{catalog,parse,snapshot,hash,validate,inspect}.ts`；v4 复用同一管线，仅换字段表+映射层（M-1/M-2）。 |
| F3 | 恰一个完整 LeaderTemplate；Blueprint 不含 runtime roster/Cordis 图/live 句柄 | ARCH:333-344（§5.3）、:346-372（§5.4 不包含清单） | 【现】 | v3 封闭表已强制；v4 照搬（迁 M-2）。Leader 的**效应治理**姿态另列 = §2 A-3。 |
| F4 | 禁 Team SessionEvents 词汇作 vNext 权威 | AGENTS 红线；gap-checklist C-02（p4t6 机检常跑） | 【现】 | 机检封禁在册，v4 词表设计禁复用旧词（CAND D-04 B-b）。 |
| F5 | TeamDomain 逻辑 records（TeamSessionRecord/MemberInstanceRecord/SessionBinding/SchemaMeta/…） | DEV:2220-2231（§17.2） | 【现】 | P 系列 durable 面已落；`SchemaMeta` 记录随 v4 版本入集自动携带（派生集，A2 行）。 |
| F6 | legacy `.dsh/teammates` → LegacyWorkspaceTeamBlueprint 只读适配，不承载 live runtime | DEV:1520-1531（§9.8） | 【迁】 | legacy 包既有位；若 v4 轮顺带（**不搭车**，同 E4 纪律）另立任务卡。 |

### G. 验收/发布层（S0§11 后半）

| # | 必需语义 | 原计划锚点 | 三分 | 说明 |
|---|---|---|---|---|
| G1 | Schema 半壁验收：负例全拒（未知字段/错误版本/枚举）、v3 升级前后状态提示、权限不升高、动态 Binding 不隐式 allow | S0§11:173 | 【迁】 | NEG 文件在场未接运行器（CAND 附2『尚未接运行器』）→ 接进 vitest/matrix（M-5）。 |
| G2 | 机器可读验收矩阵（tool family × OS × Provider × policy profile，SUPPORTED/UNSUPPORTED/DEFERRED + 真实 Host 证据 + 拒绝错误）；`P0 fixture 成功`不抵 Gate；CORE_BLOCK 路径不得发布为支持 | S0§11:175 | 【现】设施+【迁】填行 | 设施=PR8 runner/matrix/registry 在产；`acceptance-matrix.json` 的 `schema_migration` 维度行已引用 CAND，**ADR 转正=final_declaration 脱 null 的前置条件**（CAND 附2）。 |
| G3 | PR8 合并≠Alpha.5 发布；发正式 Alpha.5 走正常 Gate | S0§11:177 | 【现】 | 流程条款，无代码面。 |

**省略自检**：S0§11 全部名词（v4/正式 ADR/toolBindings/Read-Write-Network IO Policies/Provider-Execution Boundary Binding/Assurance 引导与诊断/envelope Scope 扩展/无新 Role Ladder/不改已绑定生命周期/显式拒绝升级/不缺省推断 unrestricted + §11 测试与矩阵条款）均已入表；ARCH §5/§4/§10/§14、DEV §4.3/§16/§17/§9.8 相关行均已入表；CAND D-01..D-11 全部映射（D-01=A1/A2、D-02=B3、D-03=B4、D-04=B2、D-05=C1、D-06=D1、D-07=E1/E2、D-08=E3、D-09=B5、D-10=C2、D-11=E4）。**零省略。**

## 2. ADR 待裁问题（正式 Schema ADR 必须逐条落字；新增 8 项，各一句+选项）

1. **A-1 v4 必备性**：v4 文档中 `toolBindings`/三轴字段族是必填，还是可缺省（缺省的语义是什么）？——(a) 必填（无治理声明的蓝图不得用 v4）；(b) 可选，缺省=显式 sentinel「本蓝图不声明 Team 效应治理」（全走 host 原生，呈现层如实）；(c) 可选且无 sentinel（S0§11:171 只说"实现"该字段族，未说必填——文本真空）。
2. **A-2 分层继承/合并**【用户级语义分歧 → §6.1 U-3；起草仍归 Gate】：team 层与模板层同时出现绑定/IO 声明时的合并算法？（MA:68 原文把 inheritance 显式留给 design integration）——(a) 无继承，模板必须完整自包含；(b) 逐字段合并、更窄者胜；(c) 逐字段合并、冲突即 `SCHEMA_AMBIGUOUS_OMISSION` 式 typed 拒。
3. **A-3 Leader 效应治理姿态**【用户级语义分歧 → §6.1 U-2；起草仍归 Gate】：Leader 的效应是否纳入 v4 `toolBindings` 约束（Leader=Root Agent，现走 host 原生面）？（S0§11:173 测试点名『Leader/Human User 限权』但 schema 语义未设计）——(a) Leader 与 Member 同受绑定；(b) Leader 不入 v4 schema（host 政策只管），文档声明面显式排除；(c) Leader 仅可声明收紧项。
4. **A-4 兼容窗口政策【用户级】**：{3,4} 双版本窗口维持多久、以何退出？——(a) 固定 ≥1 发布代；(b) 存量 v3 全迁移/裁定为止（无时限）；(c) 用户另定。
5. **A-5 v4 文档面范围**：v4 = v3 全字段面（requirements/permissions/policyStates/quotas）的**超集**，还是只携 §11 新字段族+最小 v3 基座？——(a) 超集（迁移=加字段）；(b) 独立效应治理文档与 v3 并存（双文档引用）——(a) 与 D-07 单文档升级语义一致性更高，但需逐字段裁决 v3 面去留。
6. **A-6 Assurance 声明失配行为**：作者声明 vs 运行时 probe 实测不符时装配行为？（C1 行：声明已定为零授权力，启动语义未定）——(a) 拒装（typed 启动失败）；(b) 实测为准+诊断行+呈现披露；(c) v4 不开放作者声明 assurance（声明面推后）。
7. **A-7 执行面未落地字段的 v4 发布姿态【派生项：依赖 A-4 ∧「清单」姿态（U-4），随其同批落字 → §6.1】**：`network.restricted`（及后续 OS 未落地治理字段）允许写入 v4 文档吗？——(a) 允许写入、运行时 typed 拒+诊断如实（现『写得出、拒得响』模式的 schema 化）；(b) schema 期即拒（当前 Host 不可兑现者不收=更严，但违「schema 表达意图」）；(c) 等上游词表后随 Provider 一起开。
8. **A-8 迁移报告出口**：requires-decision 字段的作者解决回路（改 v4 草案→重跑迁移器）属 v4 轮交付，还是报告只读？——(a) 迁移器只读报告；(b) 配 CLI 编辑-重跑回路；（起草人级，工具边界。）

**归位注（根 08:05Z 口径）**：A-1..A-8 全部归 ADR Gate 常规转正流程（起草人提案+三 reviewer Gate 采纳），**是 ADR 问题不是逐条问用户的理由**；其中 A-1/A-5/A-6/A-8 纯 Gate 事项，A-2/A-3/A-4 各附一条真用户级语义分歧（单列 §6.1，不双计），A-7=派生项。

**转正项**（不计入待裁数，ADR 起草人提案+Gate 采纳）：D-01 严格接受、D-02 默认拒绝、D-03 无隐式默认、D-04 作用域键、D-05 三轴、D-06 envelope 扩展零新 rung、D-07 显式迁移+权限不升高、D-08 枚举拒、D-09 路径文法、D-10 assurance 诊断性、D-11 哈希规范形。

## 3. 纯迁移工作量（文件级步骤，语义已定即可派工）

- **M-1 v4 解析分支**：`packages/domain/blueprint/src/validate.ts` 增 v4 封闭字段表分支（:1283-1340 版本分派处）+ 新错误族名按 CAND 附1 登记；`schema.ts:75` SUPPORTED 翻 `[3,4]`、`:90` DEFINED 补 4（RETIRED 派生自动）；`scripts/verify-blueprint-version-clean.mjs` fence 扩「v3 分支禁改+版本词表」检查。量：中。
- **M-2 作者面映射表（数据文件）**：新建映射表（候选位=CAND D-11 指定：pr8-accept ②负例集旁 + PR8 正式映射表），用 `vnext-field-mapping` 的 `declareFieldMapping/projectThroughMap` 接入；io.*→`ResourceRef`、绑定→`ToolBinding` 字段逐条具名。量：中。
- **M-3 envelope Scope 语法扩展**：`authority-envelope/src/authority-envelope.ts` operation classes / resource kinds 扩集 + coverage/matcher 测试（fs metadata、network destination、Domain reference 描述符形状）；零新 rung。量：中。
- **M-4 迁移报告**：`blueprint` 包新增 migration-report 模块（carried/rejected/requires-decision 三值逐字段）+ `MIGRATION_PERMISSION_WIDENING` 拒；出口=inspect/CLI 面。量：中。
- **M-5 负例接入+矩阵**：NEG `migration-negative-cases.json` 接 vitest 断言（逐条 `adr_ref`）；`acceptance-matrix.json` `schema_migration` 行 + `pr8-accept/e2e-skeleton/suites/registry.mjs` 相关 run 实现；pr8 runner 复跑。量：小～中。
- **M-6 运行时消费边**：版本集翻转后 `BLUEPRINT_MIGRATION_REQUIRED` 臂/派生面自动延展（亲验 `blueprint-authority.ts`/`root.ts` 走派生集）；guard 装填链（`host.ts:747`→`agent-bindings.mjs:2261`）**零改**——v4 蓝图解析成 ToolBinding 后走既有 per-agent 装填。量：小。
- **M-7 文档面**：`docs/blueprint-authoring.md` + team-blueprint-authoring 技能词表同步（v4 发布轮）。量：小。

## 4. 「已可实现」装配草案（公开 seam 链，零新接口）

```
v4 YAML ──parse.ts(既有)──▶ validate.ts v4 分支(封闭表, 版本门禁:1295 在产)
  ──vnext-field-mapping(projectThroughMap, 默认拒绝引擎已落码)──▶ 解析后封闭对象
  ├─ io.* → ResourceRef{realmId,kind,canonicalLocator,rights}      (resource.ts:76, 矩阵:65-73)
  ├─ toolBindings → ToolBinding{agentScopeKey,toolName,policyGeneration,…}(binding.ts:56)
  ├─ execution 三轴 → parseAssuranceContract                        (assurance.ts:149)
  └─ 授权求值 → Alpha.4 envelope Scope(扩展语法 M-3) + ApprovalCase 平面(生产在产)
运行时：解析产物喂既有 guard per-agent 装填边（agent-bindings.mjs:2261，生产边）；
执行面各腿（C-FS admit / provider spawn / grant-mint）按其在册状态如实触达——
schema 面与执行面解耦：写得出但执行面未落地者 = A-7 姿态问题，不阻塞 schema 半壁。
```

关键事实：**schema 半壁无一项需要上游**；全部改动落 `packages/domain`（blueprint/authority-envelope/tool-governance 消费/vnext-field-mapping 接线）+ 安装面/矩阵。与 PR2/3/4/7 的 DORMANT 状态解耦——那些是效应面 GLUE 队列（checklist 缺口一/三），不构成 schema ADR 前置。

## 5. 迁移顺序 + 兼容窗口建议

**顺序**（每步独立过 Gate，RED-first 用 NEG 现成负例）：
1. **正式 Schema ADR**（裁 A-1..A-8 + 采纳 D-01..D-11）——CAND 附2 已钉其为矩阵 `final_declaration` 脱 null 前置；用户级项以 §6 为准（P-D3 @根 14:29Z 口径：A-4/A-3/A-2 = 「先核对既定语义，再出最小真待裁」**工作条目**（出处指针随条目）；Q1/Q2/OpenAtPort/PTC-net = **内部提案在册，尚未向用户正式提出**；A-7=派生项随批；**不是一份七项用户问卷**），其余起草人提案。
2. M-1 解析分支+fence（v3 面字节零动；G4『fails loudly』机检即时成立）。
3. M-2 映射表 + M-4 迁移报告 + M-5 负例接入（升级工具可用，v3 作者先获得迁移报告，后获得 v4）。
4. M-3 envelope Scope 语法（独立 lane，可与 3 并行；文件面不交叠）。
5. M-6 运行时派生面 + SUPPORTED 翻 `[3,4]`（**最后翻**，此前 v4 文档=「已定义不可运行」走 DEFINED/派生臂如实呈现）。
6. M-7 文档 + 矩阵/registry 填行 + 真实 Host 总 Gate（S0§11:175）。

**兼容窗口建议**：{3,4} 双支持自 v4 发布起 ≥1 发布代且以「存量 v3 蓝图全部迁移或经报告显式裁定为不声明治理」为退出条件（对应 A-4 的 a∧b）；v3 退役时走**已在产**的 RETIRED 派生臂（`BLUEPRINT_MIGRATION_REQUIRED`，v1/v2 先例），零新机制；v4 发布同一轮不撤 v3（给操作员迁移动作窗口）；v3 解析器语义冻结由 fence 脚本机检，不靠约定。

## 6. P-D 判定：vNext 原计划中「必须用户裁决」最小集（**P-D2 精简版 @根 08:05Z 口径；P-D3 声称同步 @根 14:29Z 口径——§6.1 = 内部工作条目/内部提案登记册，非用户问卷、非待用户批量裁决**）

判据 = 语义/产品边界/冻结接口变更/上游接触授权；实现取舍、ADR 起草、装配派工**不**入集。精简原则 = **「是 ADR 问题」≠「逐条问用户的理由」**：A-1..A-8 全部走 ADR Gate 常规转正（起草人提案 + 三 reviewer 采纳）；下表（P-D3 后）= 内部登记：**A-4/A-3/A-2 为「先核对既定语义，再出最小真待裁」工作条目，Q1/Q2/OpenAtPort/PTC-net 为内部提案在册（尚未向用户正式提出，不得归因『用户未答』）——本表不构成用户问卷，也不等待用户批量裁决**。**U 编号本轮重排**（旧 U-1/U-2=R-1/R-2 → 已裁移出，见 §6.0；旧 U-3..U-6=本表 U-4..U-7；旧 U-7/U-8=A-4/A-7）。

### 6.0 移出与归位（转录存证）

- **R-1/R-2 移出待裁——用户已批准（07:53Z）**。转录存证 = `dev/agent-workflow/evidence/alpha5/COORDINATION.md:88`（根协调文件工作副本，行号 @08:1xZ 状态）：『**R-1/R-2 用户批准在册（07:53Z，原文转录存证）**：LSP 方向=同意（独立 streaming 启动方法复用权限/租约/终止、旧 API 不变；策略变化销毁重建成员隔离实例）。解冻实施=P-LSP writer；明确**不扩大**到其他 C12/vNext 待裁项；范围=本仓公开 seam、不改上游、不部署 :3080。ADR 表 A 项/PTC-net/OpenAtPort 等仍待裁不变。』——同行钉死**不扩大**：该裁决不外溢本文件任何其余待裁项；R-1/R-2 的解冻实施归 P-LSP（2437a167），不再是裁决事项。**P-D3 同步（@根 14:29Z）**：该实施**已合入 = #304 @ `77ffb187`**（见证 = `ALPHA5-ACCEPTANCE-STATUS.md` §1「LSP 生产装配」行测量基线『master@77ffb187（#304 R-1/R-2 已合）』）；本文件对 R-1/R-2 不再保留任何『待答/待裁』表述。上引『ADR 表 A 项/PTC-net/OpenAtPort 等仍待裁不变』一句为 07:53Z 时点历史转录原文照录，其今值以 §6.1（P-D3：内部提案在册、尚未向用户正式提出）为准。
- **A-1/A-5/A-6/A-8 = 纯 ADR Gate 常规转正项**：与 D-01..D-11 同轨（起草人提案+Gate 采纳），**不是逐条问用户的理由**，不入用户待裁表。**A-2/A-3**：起草与采纳同归 Gate，但其语义分歧本身属用户级，**只计入 §6.1 一次、不双计**——初稿行「A-3 若 Gate 认为改产品边界再上浮」按根 08:05Z 口径作废；**@根 14:29Z 口径（P-D3）：A-2/A-3/A-4 的分歧登记为 §6.1『先核对既定语义→再出最小真待裁』工作条目（附出处指针），不作「直接送裁」，也不是用户问卷项**。
- **硬约束（对任何裁决组合恒生效）**：**不得借 v4 迁移擅自裁历史 trim**——任何 v3 时代字段面/能力面的缩减，不得由 v4 轮 ADR 措辞或迁移工具隐式执行；确需缩减必须单独成项送裁，并在迁移报告中显式记 rejected（同 E4『漂移债不搭车』、F6『不搭车』纪律同构）。

### 6.1 真用户级语义分歧与内部提案（与 Gate 常规转正分列，不混数；逐条一句；**P-D3 @根 14:29Z：本表 = 内部登记册——不是用户问卷，不待用户批量裁决；本表各项均未正式向用户提出**）

| # | 待裁项 | 一句 | 状态（P-D3） |
|---|---|---|---|
| U-1 | **A-4 v4 兼容窗口政策** | {3,4} 双版本窗口的时长与退出条件（a 固定≥1 发布代 / b 存量迁完或裁定完为止 / c 用户另定）= 产品边界。 | **工作条目：先核对既定语义，再出最小真待裁**——既定语义出处 = CAND D-01 已钉窗口 {3,4}（`pr8-accept/ADR-CANDIDATE-blueprint-schema-vnext.md`）+ 本件 §5 兼容窗口建议 + DES:222（不改已绑定生命周期）；非问卷项 |
| U-2 | **A-3 Leader 治理模型** | Leader 效应是否入 v4 `toolBindings` 约束（同受 / 不入 schema 显式排除 / 仅可收紧）= 「谁受治理」边界。 | **工作条目：先核对既定语义，再出最小真待裁**——既定语义出处 = ARCH §5.3 恰一完整 LeaderTemplate（`docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md:333-344`）+ S0§11:173『Leader/Human User 限权』测试点名 + 本件 §1 F3/B1 行；非问卷项 |
| U-3 | **A-2 继承语义** | team 层与模板层绑定/IO 声明并存时的合并算法（无继承 / 更窄者胜 / 冲突 typed 拒）= 作者可观察语义。 | **工作条目：先核对既定语义，再出最小真待裁**——既定语义出处 = MA:68（原文把 inheritance 显式留给 design integration）+ 本件 §1 B3 行封闭字段表/默认拒绝在产现状；非问卷项 |
| U-4 | C-12 **Q1** =「当前不支持能力清单」的本版本姿态 | 是否接受当前 Host/当前版本能力边界为本版本发布姿态（保证类宣称=UNSUPPORTED、不冻结未来版本）；清单本体见下。 | **内部提案在册**（提案件 = C12 brief §3）；**尚未向用户正式提出；不得归因『用户未答』**（旧文『已提待答/勿重复提』为声称失真，P-D3 更正） |
| U-5 | C-12 **Q2** 上游接触授权 | D-1 硬保证路线三独立缺口的 c1 候选是否发起 upstream contact/选型（CORE PATCH BUDGET=0 下上游接触本身=用户授权动作）。 | **内部提案在册**（提案件 = C12 brief §3）；**尚未向用户正式提出；不得归因『用户未答』** |
| U-6 | PR3 **OpenAtPort** vs 永久窄 Profile | M-04/05 arbitrary-tree 宣称线：`ALPHA5-ACCEPTANCE-STATUS.md:79` final_declaration 最小集点名（『PR3 OpenAtPort（或永久窄 Profile 裁定）』）。 | **内部提案在册**；**尚未向用户正式提出；不得归因『用户未答』** |
| U-7 | PTC **net 半臂**上游词表需求接触授权 | net 外层执行面零 OS 覆盖⇒零公开 arm，出路=上游词表需求非 core patch（#296 在册；与 U-5 同型不同对象）。 | **内部提案在册**；**尚未向用户正式提出；不得归因『用户未答』** |

**「当前不支持能力清单」（U-4 的清单本体；逐条一句，姿态由 U-4 一并裁，逐条不另计数）**：

- **取消精确性 D-1「扩大取消范围/延期」= 用户已批准项，单列（P-D3 @根 14:29Z 分列）**：『接受扩大取消范围』= 用户裁决 2026-10-16 17:52Z（原文+三边界 = `dev/agent-workflow/PENDING-GATES.md` G-a 行；边界=不扩大为 provider 卸载自动杀全团队 / G-g 不随之关闭 / 不回填 17:02）；严格『只取消未执行调用』属性 = **DEFERRED 有主在册**（`PENDING-GATES.md` D-1 行 owner=d9da2f74 + `ALPHA5-ACCEPTANCE-STATUS.md` §2-⑥）。该项已裁，**不在 Q1 姿态问题范围内**。
- C-12 其余保证类（**投递精确性、静默安全**）= 当前 Host **UNSUPPORTED**（C12 brief §3；Q1 姿态裁决前=不默认接受弱化）；**状态不动**，不因上行 D-1 单列而变。
- PTC 外层 **net 半臂** = 无任何 OS 覆盖、公开 seam 无法 per-call Grant 注入 ⇒ UNSUPPORTED，出路=上游词表需求（接触授权=U-7）。
- **OpenAtPort** 未落 ⇒ arbitrary-tree profile 恒禁发布（`ALPHA5-ACCEPTANCE-STATUS.md:15/:49-50`）；裁前口径=窄 Profile（U-6 即该裁定）。
- **network.restricted 等执行面未落地治理字段** = 现『写得出、拒得响』模式，其 v4 文档面姿态=A-7（派生项，见下，不单列问用户）。

**A-7（降级为派生项，不计入净数）**：其选项面被两项上游裁决完全决定——(a)『允许写入+运行时 typed 拒+如实披露』与 U-4『能力边界如实宣称』姿态同源；(c)『等上游词表后随 Provider 一起开』的时序与 U-1（A-4 窗口/发布代语义：v4 发布同窗不撤 v3）同源。**A-7 不单独问用户：随 U-4 ∧ U-1 的裁决同批落字。**

### 6.2 净用户待裁数（P-D2 重算 → **P-D3 按事实重述：当前『已向用户提出待答』= 0 项**）

原最小集 8 = R-1/R-2/Q1/Q2/OpenAtPort/PTC-net/A-4/A-7。**P-D2（08:05Z）曾重算为『净用户待裁 7 项 + 1 派生』；该口径的『已向用户提出待答』含义不成立，P-D3（@根 14:29Z）按事实重述如下（零新裁决，仅声称与事实同步）**：

- **R-1/R-2 → 已批已合**：07:53Z 用户批准（§6.0 转录存证）+ **已实施合入 = #304 @ `77ffb187`**；不再是任何待答/待裁项。
- **Q1/Q2/OpenAtPort/PTC-net → 内部提案在册四条**：均为**内部提案条目，尚未向用户正式提出**；处于『待用户答复』状态 = **不实**，不得归因『用户未答』。07:53Z 引文『明确不扩大到其他 C12/vNext 待裁项……仍待裁不变』= 该时点历史转录（其『待裁』指内部在册，不含『已正式向用户提出』之义）。
- **A-4/A-3/A-2 → 工作条目**：先核对既定语义（出处指针见 §6.1 表内各条），**再出最小真待裁**——当前登记的是这条**核对工作**，不是一份问用户的问题清单。
- **A-7 → 派生项（口径不动）**：依赖 U-4∧U-1，随其同批落字，不单独问。

**净结论：本文件当前不存在『已向用户提出、等待答复』的事项；本集不构成七项用户问卷，也不是『待用户批量裁决』**。内部提案是否/何时正式向用户提出 = 根的后移动作，非本文件所能裁决；逐条重复提问与批量问卷两形态均禁。初稿「8 项 = 6 已在册 + 2 净新增」与 P-D2「净 7+1」两口径均作废。

## 7. 红线自证与文件清单

CORE PATCH BUDGET=0（本文件与更正节均不新增上游接触）；零代码/矩阵/gates 行改动；`:3080` 未触碰；零端口零世界；冻结文档只读引用。本分支相对 `origin/master @ d714a941` 的全部变更 = 新增本文件 + `evidence/alpha5/PRODUCTION-READINESS-CHECKLIST.md`（=5bea01c6 字节相同副本 + §5 更正节；diff 亲验 70 行内零改动）。

| 文件 | 角色 |
|---|---|
| `prod/VNEXT-SCHEMA-ADR.md` | 本文件（语义清单+装配草案+待裁清单+迁移顺序+用户裁决最小集） |
| `../PRODUCTION-READINESS-CHECKLIST.md` | §5 更正节：LSP 两分口径（B4=sub-realm 全键池=唯一上游缺口）。R-1 该节原文『待答/待裁』措辞 = 裁决前时点历史口径；今值（P-D3 同步）= 07:53Z 用户批准 + 已合入 #304=`77ffb187`（checklist 本文件本轮未触） |

— writer = alpha5-prod-vnext-adr（P-D，qwen3.8-flash-next）；所引行号全部 @d714a941 树亲验；未合分支引用（`alpha5-prod-checklist@5bea01c6`、`alpha5-gap-classify@9a7a0552`）已逐处标注。修订轮 = P-D2（qwen3.8-flash-next，@7d609a08 基）：§6 精简 @根 08:05Z 口径，转录存证行 @COORDINATION.md 工作副本 08:1xZ 状态亲验。修订轮 = **P-D3**（qwen3.8-flash-next，branch `alpha5-doc-correct` @`93cd7b09` 基）：三件声称与事实同步 @根 14:29Z 口径（§6.1 四提案条目改『内部提案在册/尚未正式提出/不得归因用户未答』＋R-1/R-2 已批已合 #304=`77ffb187`＋D-1 取消项分列＋A-4/A-3/A-2 改工作条目；A-7 派生不动），markdown-only、零新语义、零新裁决。
