# ADR 候选（PR8 提前件）— Blueprint Schema vNext（v4 候选）：字段映射默认拒绝与 vNext 对象模型对齐

> **状态：CANDIDATE — 非正式 Schema ADR，非产品裁决。** 本文件是 [S0+PR0–PR8 计划 §11](../alpha5-s0-pr0-pr8-implementation-plan.md) 要求 PR8 记录的"正式 Schema ADR"的**候选决策集**：逐条给出候选决定、备选方案与被拒理由。在 PR8 Gate（正式 ADR + 真实 Host 总 Gate）之前：
> - 生产 Blueprint 仍**只支持 `schemaVersion: 3` 且字段封闭**（ADR §8.9；本文件不构成 v3 输入合法性）；
> - **v3 生产文档零改动**（C-VNEXT 契约：`dev/agent-workflow/evidence/alpha5/INTERFACES-v1.md` §C-VNEXT）；
> - 本文件任何字段/错误名均为 vNext 概念提案，与 [Architecture §3](../architecture.md) 概念示例同级（"Proposed illustration; CURRENT Blueprint v3 DOES NOT ACCEPT this structure"）。

**Owner：** Lane G（C-VNEXT 契约 owner）。**分支：** `alpha5-pr8-accept` @ baseSHA `db5cb5f7dda80ab85a2e1e31ed56b2a43ff5d1ef`。
**上游权威：** [ADR §8](../ADR-alpha5-tool-io-governance.md) → [Architecture §14](../architecture.md) → [设计 §2.1/§4.2/§8](../post-poc-technical-design.md) → [S0 矩阵 §3 二义词表](../S0-SELECTION-MATRIX.md) → 计划 §11。
**配套：** ② [migration-negative-cases.json](./migration-negative-cases.json)（本 ADR 各条的机器可读负例）· ③ [acceptance-matrix.json](./acceptance-matrix.json)（PR8 矩阵骨架权威）。

---

## D-01 vNext 版本 = `schemaVersion: 4`（候选），单版本严格接受

**候选决定：** vNext 采用整数 `schemaVersion: 4`（计划 §11"建议 4"采纳为候选）。运行时同一时刻**严格接受且仅接受**已裁决版本集合中的主版本（迁移窗口内 = {3, 4}，逐版本钉死独立解析器）；版本比较只做精确成员检查，不做 `>=`/区间推断。类型必须是 JSON number，字符串 `"4"` 即拒。

**备选与被拒理由：**
- **B-a 区间接受（`>=4 && <5`）**：未来字段漂移会被静默吸入当前解析器，等价于开放字段面 → 违"字段封闭"。
- **B-b 双写兼容（vNext 写回 v3 投影）**：投影必然引入"哪些 vNext 字段可以丢弃"的隐式默认，正是本 ADR 要消除的对象；且变相篡改 v3 已绑定生命周期语义。
- **B-c 日期/语义化版本号（`"4.0"`、`2026-10-16`）**：破坏 `schemaVersion` 单调整数契约与哈希/存储层假设（post-alpha4 债务 t2-blueprint-hash v3 漂移的教训），把版本语义从数据面挪进比较逻辑。

**后果：** 版本变更只能经新 ADR；每版本一个解析器与封闭字段表（D-02 的载体）。

## D-02 字段映射默认拒绝（closed-world, reject-on-unknown）

**候选决定：** 每一 schema 层级（根 / `toolBindings[]` / `io.read|write|network` / `execution` / 迁移报告）持有**封闭字段表**；"旧输入 → vNext 对象模型"的映射层是**纯数据表**（输入路径 → 目标字段，逐条具名），表中不存在 = **typed 拒绝**，错误携带完整路径与被拒原因（候选错误族 `SCHEMA_UNKNOWN_FIELD` / `SCHEMA_REMOVED_FIELD`，命名纪律沿设计 §5 "proposed, not shipped codes"）。禁止：未知键剥离后放行、permissive parse、warning 后继续、任何 alias/同义键折叠。

**备选与被拒理由：**
- **B-a 忽略未知字段（宽松前向兼容）**：把拼写错误的治理意图静默丢弃 = 最危险的静默扩权通道；与 ADR §2.4 "Missing required effective policy does not silently mean unrestricted" 同理适用于"多余字段"。
- **B-b 记录诊断后放行**：诊断行不是拒绝；验收要求拒绝可机检（③矩阵行 `reject_error` 字段落空）。
- **B-c 保留未知字段透传运行时**：把封闭面问题下推到执行层，制造第二政策语言，直接违反 C-VNEXT"字段映射默认拒绝"条款字面。

## D-03 无隐式默认：缺省字段永不展开为权限

**候选决定：** 安全相关面**无一处**有隐式默认值：`authorization` 缺失≠allow；`io` 缺失≠`mode: all`；`network` 缺失≠allow；`execution` 缺失≠native 路线。所有"宽"取值必须**逐字段显式书写**（`mode: all` 是作者声明，不是空缺的展开）。结构上无法消解歧义的组合（如给了 `io.read.allow` 却没给 `mode`）按 Architecture §4 "reject unresolved ambiguity" 拒绝（`SCHEMA_AMBIGUOUS_OMISSION`）。

**备选与被拒理由：**
- **B-a 默认 `mode: all`（表面兼容 v3）**：v3 的宽来自 v3 封闭语义整体，不能以"缺省=宽"移植到 vNext；计划 §11 点名禁止"自动从缺省字段推断 unrestricted"。
- **B-b 默认 `restricted` + 空 allow（缺省=最窄）**：看似安全，但让"作者忘了写"与"作者刻意锁死"不可区分，迁移审计面失真；且给动态 Binding 制造隐式 deny 误报，掩盖真实策略错误。与 B-a 同拒——两者皆缺省推断，违反契约本身（"无隐式默认"是对称要求）。
- **B-c 缺失即交互式补全**：配置期无稳定受信任主体可问，且与 before-start one-shot grant（ADR §2.8）语义混淆。

## D-04 vNext 对象模型对齐：绑定挂 Member/Domain 作用域，键对齐 PR0 契约

**候选决定：** `toolBindings` 的作用域键对齐冻结对象模型（TeamBlueprint → TeamSession + TeamDomain → MemberInstance；红线：vNext 无 Team SessionEvents）：绑定声明于 Blueprint 模板/域层，**解析后生效于 Member 作用域**（S0 §3 R1 = Scope Binding；preset-scope 语义 per ADR §2.1 保留）。作者面绑定身份键 = `(realmId, memberScopeKey, owner, toolName)`，语义与 PR0 冻结契约 `ToolBinding` / `ResourceRef{realmId,kind,canonicalLocator,rights}` 一一对应，不新造第二套身份语言。

**备选与被拒理由：**
- **B-a 全局 per-agent 工具表（Host 工具清单视角）**：把"Host 装了"当"Team 治理对象"，违反 preset-scope 与 `T_dispatchable ⊆ T_governed` 不变式（设计 §1.1）。
- **B-b 复用 legacy SessionEvent/旧 Team 词汇命名**：直接踩红线（不得把 legacy 词汇当 vNext 权威）。
- **B-c 把 PR0 内部 TS 类型名直接当作者面 YAML 字段名**：内部契约形状（设计 §4.2）冻结点在内部；作者面与内部面之间需稳定化映射层（即 D-02 的映射表），否则内部演进绑架 schema。

## D-05 三正交轴取代 `execution.kind` 互斥枚举

**候选决定：** vNext schema 用三个独立字段表达执行事实：`implementationOrigin`（`dsh-native | team-trusted-extension | standalone-runner | remote-provider`）、`executionBoundary`（`trusted-host | confined-subprocess | delegated-remote`）、`assurance`（逐能力记录机制/作用 Realm/可信根/证据 + `enforced | author-trusted | partial | unsupported | untested`）。旧 `native/custom/shadow-run` **不作为** vNext 互斥安全等级字段出现；仅在迁移映射表的"被拒旧字段"侧登记（②负例 N-F03）。

**备选与被拒理由：**
- **B-a 保留 `execution.kind` 并加可选新字段**：旧枚举继续充当事实上的权限等级（S0 §3 明文禁止的旧用法），三轴退化为可选装饰 → Assurance 变第二授权开关（ADR §8.4）。
- **B-b kind 改名同形保留**：换皮不换语义，迁移器仍须推断组合，歧义回归。

## D-06 Authority Envelope Scope 语法合法扩展；零新 Rung

**候选决定：** 新操作类型（fs read/write/metadata、network destination、Domain reference）通过**扩展 Alpha.4 两份 authority envelope 的 Scope 语法**获得表达能力；不引入第三 envelope、不引入 super-envelope、不改 Role Ladder、不改已绑定 Blueprint 的生命周期（计划 §11 原文承接）。扩展只加"资源描述符形状"，不加审批层级。

**备选与被拒理由：**
- **B-a 新 `ioEnvelope` 第三层**：ADR §8.3/§8.6 禁新 rung/super-envelope；既有两份已绑定 envelope 的生命周期会被迫重绑定，触"不改已绑定生命周期"红线。
- **B-b I/O 面内嵌独立审批通道**：制造第二 ApprovalCase/第二授权库，违 C-ADM 契约与"单一 Team 审批权威"（设计 §1.3）。

## D-07 迁移 = 显式拒绝 + 具报告升级；权限不升高为硬不变式

**候选决定：** ① v3 文档在 vNext 运行时按**版本钉死的 v3 解析器**继续运行（不做 load-time 变形）。② 升级是显式操作，产出机器可读**迁移报告**（逐字段：`carried / rejected / requires-decision`），拒绝静默升级。③ 硬不变式：**升级后有效权限集不得大于升级前**（`MIGRATION_PERMISSION_WIDENING` 即拒）；无法映射且宽于原语义的字段一律 rejected→要求作者决策。④ 动态 Binding 与新注册工具不因迁移成为隐式 allow（计划 §11 测试项）。⑤ 版本变更不得静默修改 Alpha.4 已绑定 Authority Envelope 生命周期（设计 §8）。

**备选与被拒理由：**
- **B-a load-time 自动升级（就地演进）**：设计 §6 明确"不做运行中 Blueprint 自动演进"；升级决定必须在作者在场时发生。
- **B-b 双解析器长期共存不加报告**：v3/vNext 语义缝隙（如 D-03 的缺省差异）被解析器差异吸收，等价隐式默认。
- **B-c "迁移只警告不阻断"**：把权限不升高不变式降级为 best-effort，等于对第③条不存在。

## D-08 未知枚举值 = 拒绝；禁止 coerce-to-deny 伪装

**候选决定：** 全部枚举（`authorization`、`io.*.mode`、`network.mode`、`implementationOrigin`、`executionBoundary`、`assurance.level`）严格成员检查，未知值 typed 拒绝（`SCHEMA_UNKNOWN_ENUM`，候选名），错误含合法值集。

**备选与被拒理由：**
- **B-a coerce 到 deny（"fail-closed 友好降级"）**：看似保守，实为把输入错误伪装成作者意图的终局 deny——与 C-ADM 律"未知⇒`deny-source-unattributed` 拒+诊断，禁伪装终局"同构；"从未表达"与"刻意 deny"在审计面必须可区分。
- **B-b 大小写/空格归一后重试匹配**：NRM-1 教训（不得静默归一，Architecture §4）；`"Allow"` 是另一个字符串，不是 `allow`。

## D-09 路径文法与 Realm 语义原样入 schema（拒绝降级便利）

**候选决定：** Architecture §4 / ADR §2.6 文法逐条进 schema 校验层：相对路径锚定不可变 workspace、任何 `..` 段拒（含 `src/../x`）、合法首尾空格保留、歧义字符显式报错、`~/` 由可信执行 Realm 解析、绝对路径=有意越界授权。schema 层**不做任何字符串归一**，只做形状校验；Realm 解析发生在执行 Realm（§14.4），schema/迁移报告原样回显。

**备选与被拒理由：**
- **B-a 解析期折叠/trim 路径**：NRM-1 回归通道，直接禁止。
- **B-b schema 期解析 `~/`**：把 Realm 事实写进静态文档；跨 Realm"同串异资源"（§14.4 "Equal path strings on two hosts do not imply equivalent resources"）。

## D-10 Assurance 与诊断只作诊断，永不参与授权求值

**候选决定：** schema 允许作者**声明** assurance 期望与 provider 绑定；求值路径上 assurance 只能由运行时探测+证据推导（设计 §5 四要件：功能探测/策略可编译/不可信 body 前建立/范围与不可管辖项声明），schema 声明本身零授权力。缓存绑定实际环境版本与能力（反缓存条款，设计 §5）。

**备选与被拒理由：**
- **B-a 声明即授信（作者写 `enforced` 即按 enforced 起评）**：COORDINATION "PR2 冻结前裁决清单 (ii)" 已钉"level 不得单独兑现——运行时以真实 probe 的 evidence/realmId/trustRoot 校验"；schema 层同律。
- **B-b backend 二进制存在即 partial 起评**：设计 §5 反缓存条款明文禁止（仅 `bwrap` 存在≠能力）。

## D-11 迁移/哈希兼容债务显式登记，不搭车收口

**候选决定：** v4 迁移映射表为**仓库内数据文件**（候选位：本 lane ②负例集 + PR8 正式映射表）；哈希/存储兼容问题（t2-blueprint-hash v3 漂移 = a4-pr7 遗留既有红）为**独立债务处置，不并入 vNext schema 变更**（COORDINATION 文档收口清单同判）。v4 文档的规范哈希 = 解析后封闭字段表的规范形式（键序/空白不参与身份）。

**备选与被拒理由：**
- **B-a 借 v4 迁移顺手修 v3 哈希漂移**：改变既有绑定的生命周期事实（红线），且把两个验收面对撞、污染 PR8 矩阵证据。
- **B-b 原始字节哈希（含键序）**：把非语义差异变成绑定身份，制造伪 stale 风暴。

---

## 附 1：候选错误名登记（proposed，未发布，沿设计 §5 纪律）

| 候选名 | 触发面 | 阶段 |
|---|---|---|
| `SCHEMA_VERSION_UNSUPPORTED` | D-01 | 加载/校验期 |
| `SCHEMA_UNKNOWN_FIELD` / `SCHEMA_REMOVED_FIELD` | D-02 | 校验期 |
| `SCHEMA_AMBIGUOUS_OMISSION` | D-03 | 校验期 |
| `SCHEMA_UNKNOWN_ENUM` | D-08 | 校验期 |
| `SCHEMA_PATH_UNRESOLVABLE` | D-09（形状错，非 Realm 解析） | 校验期 |
| `MIGRATION_PERMISSION_WIDENING` | D-07③ | 迁移报告内 |

运行时错误（`IO_POLICY_UNSUPPORTED`/`SANDBOX_UNAVAILABLE`/`TEAM_TOOL_UNGOVERNED` 等）归各 PR 发布面；本 ADR 候选**不**混用校验期与运行时两个错误命名空间。

## 附 2：与 ②③ 的绑定

- ② `migration-negative-cases.json` 每条 `adr_ref` 指向本文件 D-xx——负例即本 ADR 的可执行化意图记录（尚未接运行器）。
- ③ `acceptance-matrix.json` 的 `schema_migration` 维度行引用本文件；本 ADR 启用（转正为正式 Schema ADR）是矩阵 `final_declaration` 从 `null` 变具名的**前置条件之一**（另一前置=计划 §11 真实 Host 总 Gate）。
