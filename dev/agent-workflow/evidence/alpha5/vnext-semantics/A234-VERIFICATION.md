# A234-VERIFICATION — A-4 / A-3 / A-2 既定语义核对（先核既定语义 → 最小真待裁）

- 轮次 = `alpha5-semantics-a234`（A-2/A-3/A-4 核对 writer）；模型 = qwen3.8-flash-next；基 = `origin/master @ 23002259`（fetch 亲验），branch `alpha5-semantics-a234`，worktree `.worktrees/alpha5-semantics-a234`。
- 纪律 = 只读分析 + 本文件一笔（docs/evidence only）；零代码/零矩阵/零 gate 行改动；零端口、零世界、`:3080` 未触碰；冻结文档只读引用；**禁扩大解释、未顺手改任何语义**。
- 任务出处 = 根 16:43Z『核既定语义』= `prod/VNEXT-SCHEMA-ADR.md` §6.1 U-1/U-2/U-3 三条『先核对既定语义，再出最小真待裁』工作条目（P-D3 @根 14:29Z 口径，@`3ab06b1d` #309 落 master）。
- **标签归位注（零新语义）**：本任务单中 A-4 括号写作『审批窗口』。全仓 A-4 唯一在册注册 = VNEXT-SCHEMA-ADR §2 第 4 题 / §6.1 U-1 = **Blueprint v4 {3,4} 兼容接受窗口**（时长/退出条件），本文按注册件核对；『单次审批有效期』读法的核对见 §4 附录（两读法均已核，结论同落于末行 N）。A-3/A-2 与注册件（U-2 Leader 治理模型 / U-3 继承语义）逐字对应。
- 路径注（文档对齐观察，非语义变更）：AGENTS.md 称冻结四份在 `docs/plans/paused/`；现树实际 = `docs/plans/paused/` 存 **0.1.1-alpha.1 四份**（含 ADR-001 与 permission-system-design，权限治理语义权威），20260829 冻结四份（ARCH/DEV/UI/TaskDoc）在 `docs/plans/finished/`。两组均只读，本文按实际路径引用。

## 0. 三分口径（沿用 VNEXT-SCHEMA-ADR §0）

- **一致** = Alpha.5 实现/证据链与既定语义同向、无偏差；
- **已按既定语义实现** = 既定语义在场且生产面已逐字落地；
- **存在真分歧** = 实现与既定冲突，或既定源群对某用户级语义点确实留白 → 才成待裁条目（每项 ≤5 行）。

---

## 1. A-4（U-1）v4 {3,4} 兼容接受窗口

### 1.1 既定语义逐字摘出

| 源 | file:行 | 原文（摘） |
|---|---|---|
| 冻结四份·alpha.1（paused，只读权威） | `docs/plans/paused/0.1.1-alpha.1-execution-plan-24h.md:106` | "A1/A4 must increment the Blueprint schema version additively (**v1 remains readable**; new capability-bearing documents use v2). v1 documents without `capabilities` conservatively map to … they **never create an allow**." |
| contracts v1（冻结确认） | `docs/contracts/freeze-confirmation.md:39` | "`TEAM_CONTRACT_SCHEMA_VERSION = 1`, `SUPPORTED_SCHEMA_VERSIONS = [1]`; `SCHEMA_VERSION_MISMATCH`（well-formed but different）vs `SCHEMA_VERSION_UNSUPPORTED`（structurally corrupt）"；冻结规则（:12-19）"changes go through a **new** version" |
| DEV（20260829） | `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md:2304` | "✓ schema version mismatch **fails loudly**"（G4 出口判据） |
| Alpha.5 DES | `docs/plans/memo/alpha5-tool-io-governance/post-poc-technical-design.md:222` | "任何版本变更不得静默扩权或修改 Alpha.4 已绑定的 Authority Envelope 生命周期" |
| Alpha.5 S0§11 | `alpha5-s0-pr0-pr8-implementation-plan.md:171` | "不引入新 Role Ladder，也不改变已绑定 Blueprint 的生命周期。迁移必须显示拒绝/升级策略，不自动从缺省字段推断 unrestricted。" |
| CAND D-01（候选，非裁决） | `pr8-accept/ADR-CANDIDATE-blueprint-schema-vnext.md:16` | "运行时同一时刻**严格接受且仅接受**已裁决版本集合中的主版本（**迁移窗口内 = {3, 4}**，逐版本钉死独立解析器）；版本比较只做精确成员检查，不做 `>=`/区间推断。" + ":23 版本变更只能经新 ADR" |
| 生产面·版本集 | `packages/domain/blueprint/src/schema.ts:75/:90/:117-119` | `SUPPORTED=[3]`；`DEFINED=[1,2,3]`；`RETIRED = DEFINED.filter(∉SUPPORTED)`（派生）。bridge 先例（同文件 :57-64）："This set is `[1, 2, 3]` **for the temporary PR1-PR6 implementation bridge only**（ADR A2-11）… Alpha.4's final contract is `[3]`"，收口=fence 脚本机检（A3-16） |
| 生产面·门禁 | `packages/domain/blueprint/src/validate.ts:1286-1303` | 非正整数⇒`SCHEMA_VERSION_UNSUPPORTED`；`!SUPPORTED.includes(v)`⇒`SCHEMA_VERSION_MISMATCH`（fails loudly 在产） |
| 生产面·退役双臂 | `packages/domain/blueprint/src/inspect.ts:306-313` + `packages/runtime/src/plugin/blueprint-authority.ts:448-457` | "a version this product **DEFINED and retired → `BLUEPRINT_MIGRATION_REQUIRED`（the document is the operator's; run the migration）**；a version it never defined → `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`（there is no migration for a shape nobody knows）"——"The order is the contract, not an optimisation" |

### 1.2 对照与三分

- **窗口机制/接受语义/退役路径 = 已按既定语义实现**：严格成员检查、逐版本冻结解析器（v1 分表禁改，validate.ts:1305-1311 注释与实现）、退役臂+catalog 可见迁移态、fence 机检，全部在产（v1/v2 退役轮先例）；当前 `SUPPORTED=[3]` = v4 尚未在册（翻 `[3,4]` 属 M-1/M-6 最后步，此前 v4 文档走『never defined⇒typed 拒』臂，与 D-01『已裁决集合』语义一致）。Alpha.5 证据链（`INTERFACES-v1.md` C-VNEXT『v3 生产文档不改』、`pr8-accept/README` 候选态、VNEXT-SCHEMA-ADR §5 顺序）与上列全部同向，**零冲突**。
- **窗口『时长/退出条件』 = 真分歧（既定留白）**：上列全部源只钉内容（{3,4}）与纪律（不静默扩权/不改已绑生命周期/新版本必经 ADR），未钉窗口维持多久、以何退出；A2-11 先例 = 同一 ADR 内 phase 有界桥（PR 区间），非跨发布代对**已发布存量用户文档**的退役政策。→ 待裁条目 T-1（§5）。

## 2. A-3（U-2）Leader 效应治理姿态

### 2.1 既定语义逐字摘出

| 源 | file:行 | 原文（摘） |
|---|---|---|
| 冻结四份·ADR-001（paused，只读权威） | `docs/plans/paused/ADR-001-…:360-376`（§2.12） | "For the Leader's own operation: ask → Human … **The Leader cannot self-approve.**"（teamHardDeny → Human authority path） |
| 同上 | 同文件 :170-183（§2.5） | "`mutationEnvelope` … The maximum durable permission authority the Leader may exercise over the governed Member … If an operation is `ask` but outside the Leader's `mutationEnvelope`, the Leader cannot approve it." |
| ARCH（20260829） | `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md:333-344（§5.3）/:346-372（§5.4）` | "一个有效 Blueprint 必须有**恰好一个完整的 LeaderTemplate**"；§5.4 Blueprint 至少包括 "LeaderTemplate … **Team autonomy/mutation envelope** …"（Leader 治理面**在文档内声明**，非排除） |
| contracts v1 / G3 | `docs/contracts/g3-report.md:202` | policy 负例族在册："member self-escalation, **leader out-of-envelope**, foreign-scope identity" |
| Alpha.4 spec | `docs/plans/active/alpha4-permission-governance/alpha4-permission-governance-spec.md:940-948（§21.4）/:1072（§24.4）` | "Leader self-expansion → Human User/Admin … **no self/same-level allow**"；"re-derives the caller principal … and **rejects `caller == beneficiary`**" |
| **用户裁决 2026-09-18** | `docs/plans/finished/dsh-agent-team-exec-autonomy-contract-plan.md:3/:20-22/:43/:46` | "用户裁决：允许 exec 类工具（`bash`/`pwsh`）放入 **leader 的 allow lane** 与 **mutation envelope**；双闸强制"；"**双闸强制** — …permission policy allow lane 有规则 + leader 有效 mutation envelope 含对应 token；缺一即回落 `ask → user-approval`（human）"；有效 envelope = `teamEnvelope.allow − deny`（∩ leader 条目），fail-closed |
| Alpha.5 ADR | `ADR-alpha5-tool-io-governance.md:15` | "**Preserve resolution per Leader/Member scope** …"（Leader 作用域保留在治理面，非排除） |
| S0§11 | `alpha5-s0-pr0-pr8-implementation-plan.md:173` | 测试点名："…**Leader/Human User 限权**、多 Effect ASK、domain veto" |
| 生产面 | `packages/domain/blueprint/src/schema.ts:392-404` + `validate.ts:367` | "LEADER exception (exec-autonomy-contract, **user ruling 2026-09-18**): the leader template's `allow` lane MAY carry a shell-class rule … **inert unless** the leader's effective mutation envelope carries the matching exec token …（fail-closed）；**there is NO implicit default-allow**" |
| 生产面 | `packages/runtime/control/types.ts:154-171` | "`user-approval` -> { human }: EXPLICIT user approval — **the leader cannot stand in for the user**（that would defeat the kind）"；"`leader-approval` -> { leader, human }"（member ask 由 leader 批=既定路由，人可代） |
| 生产面 | `packages/runtime/src/plugin/live/agent-bindings.mjs:419-425/:2708` + `packages/runtime/operation-permission/approval-routing.ts:26-33` | leader install 独享 "leader effective mutation-envelope exec-authorization tokens（teamEnvelope ∩ leader 模板 memberEnvelopes 条目，fail closed）"；`direct` 臂仅当"initiator **already holds** the rung the operation requires"，且"§21.4 forbids a self/same-level allow" |

### 2.2 对照与三分

- **已按既定语义实现**：Leader 效应**不豁免**于治理——作者面（LeaderTemplate 完整入 Blueprint、leader 模板可携 permission 规则，正/负皆显式声明）、求值面（envelope 交集 fail-closed、双闸降级到 `user-approval`）、裁决面（`user-approval` 解析闭包 = human only、`caller == beneficiary` 拒）三层全部在产，逐字对应 ADR-001 §2.12/§2.5 + §21.4 + 2026-09-18 用户裁决。
- **用户级分歧已被既定裁掉**：候选 (b)『Leader 不入 schema 显式排除』与 (c)『仅可声明收紧项』均与上列明文**相反**（ARCH §5.4 要求 envelope 在文档内；2026-09-18 裁决允许 leader 显式声明正 allow 且该裁决本身即用户级）；(a)『同受约束（带明文双闸例外）』= 现行既定。v4 `toolBindings[]` 对 leader 字段表细节 = ADR Gate 起草，在已定方向内，**非用户级** → **不入待裁清单**。

## 3. A-2（U-3）分层继承/合并语义

### 3.1 既定语义逐字摘出

| 源 | file:行 | 原文（摘） |
|---|---|---|
| Alpha.5 MA（架构概念件） | `docs/plans/memo/alpha5-tool-io-governance/architecture.md:68` | "Effective policies must be **fully populated after inheritance; omitted values do not expand to full access**. Choose concise schema and inheritance at design integration, **without adding a new authorization ladder**."（把 v4 字段面选择留给设计集成，但钉死两约束） |
| CAND D-03 | `pr8-accept/ADR-CANDIDATE-blueprint-schema-vnext.md:34-41` | "安全相关面**无一处**有隐式默认值 … 所有『宽』取值必须**逐字段显式书写**"；歧义组合 ⇒ `SCHEMA_AMBIGUOUS_OMISSION` typed 拒 |
| contracts v1（冻结） | `docs/contracts/freeze-confirmation.md:12-21` | 冻结规则：v1 语义不可改，"changes go through a **new** version" |
| contracts v1 六层链（G3 全量属性测试在案） | `docs/contracts/g3-report.md:102-125` | "the frozen **six-stage ascending candidate chain** `[blueprint, policyState, template, templateOverlay, instanceOverlay, humanOverride]` × 5 capabilities … higher allow beats lower allow, **lower recorded with provenance** … a higher allow **lawfully relaxes** a lower deny（invariant 34）… **external stage un-bypassable** … fail-closed: no candidates resolves deny" |
| 冻结四份·ADR-001（paused） | `docs/plans/paused/ADR-001-…:227-252（§2.8）` | "Parameter-aware permissions do **not** use whole-cell winner-takes-all … examined from high to low … **The first layer containing an ordinary rule that matches the concrete operation determines the ordinary outcome**；Within the same layer … **deny > ask > allow** … no 'most-specific matcher wins' rule" |
| 生产面·域 | `packages/domain/policy/src/types.ts:144-151` + `resolve.ts:16-31` | `TEAM_LAYER_ORDER`（blueprint < policyState < template < templateOverlay < instanceOverlay < humanOverride）；"Each capability cell resolves by **PRECEDENCE** … A cell no Team layer granted **fails closed: deny**"；overlay 越 envelope ⇒ typed 拒（`MEMBER_SELF_ESCALATION`/`LEADER_OUT_OF_ENVELOPE`） |
| 生产面·vNext 映射 | `packages/domain/vnext-field-mapping/src/field-mapping.ts:1-24` | 四律 "**DEFAULT DENY** … **NO IMPLICIT DEFAULTS**（absence is loud）… **NO TARGET COLLISIONS** … PURE + FROZEN"；`INTERFACES-v1.md:24`（C-VNEXT）"字段映射默认拒绝、无隐式默认；v3 生产文档不改" |
| 生产面·v3 作者面 | `packages/domain/blueprint/src/schema.ts:20-21/:334-339` + CAND D-04 `:45` | v3 顶层含 `capabilityPolicy`（Team-owned ordinary capability policy，ARCH §5.4 类）与逐模板字段表并存；D-04 "绑定**声明于 Blueprint 模板/域层，解析后生效于 Member 作用域**" |

### 3.2 对照与三分

- **一致（既定语义在场且已在产）**：『team 层（Blueprint 层 cells）与模板层并存』在冻结链中本就被裁 = **按层先级取胜（precedence winner），不是合并**——更高层胜、被压层入 provenance 不消失、更高层可依法放宽低层 deny（invariant 34，非『更窄者胜』）、缺省永不展开、无候选 fail-closed、external 交集不可越。候选 (b)『逐字段合并、更窄者胜』与 (c)『冲突即 typed 拒』均被冻结文本**反证**；(a) 之『无继承』在 v3/vNext 作者面为真（模板自包含、封闭字段表、映射默认拒绝、无合并引擎在场）。MA:68 两约束（omitted≠expand、无新 ladder）逐字被 D-03 + field-mapping 四律 + 六层链承接。
- v4 新字段族（toolBindings/io）若同时开放 team 层与模板层声明，其字段表细节 = Gate 起草，方向被上述冻结件钳死（沿用六层链 + D-03，无新 rung）→ **非用户级真分歧，不入待裁清单**。

## 4. 附录：『审批窗口』另读法核对（单次审批有效期）

若任务括号『审批窗口』另指**单次审批的有效期/窗口**（非版本窗口），既定语义与生产面同样闭合、无真分歧：

- 冻结四份：`ADR-001 §2.13:378-382`（alpha.1 同步阻塞，async 长延后模型 **explicitly deferred**——延期非永禁，且 ADR-001 自标 "Accepted for `0.1.1-alpha.1`" 为版本域裁决）；`§2.17:435-462`（one-shot 绑定 exact canonical operation、exactly-once）；`§2.18:464-470`（**No stale Team-side approval may pierce a newly tightened external ceiling**——终派发前 live recheck）。
- 生产面逐字落地：`alpha4-spec §24.6:1076`（consumption-point revalidation：freshly bound 文档重评、"any rise in required authority, **refuses with zero consumption**"；matcher 仅 exact/fingerprint、**never subtree**）；`§24.4:1072`（operationFingerprint mandatory、拒 `caller == beneficiary`）；`admission-kernel.ts:16-33`（H1 时钟门先于一切授权/expiry 使用；mint 最后、consume 独立边，"executed twice is the one thing the ledger makes impossible"）；OUTERFS L2 负控集（重放/**过期**/他 team/撤销后逐拒，#301 `23002259`）。
- 同步阻塞 → durable ApprovalCase 的形态迁移属 **Alpha.4 用户已批阶段计划**（`alpha4-permission-governance-spec.md:3` Accepted 2026-10-07 + A1-14/A5-5 等在册），非未裁语义分歧。→ 该读法下亦无新增待裁项。

## 5. 当前真待裁（最小集；每项 ≤5 行）

**T-1（唯一）A-4 · v4 {3,4} 兼容窗口时长/退出条件**
- 分歧：窗口内容 {3,4}、严格成员检查、退役臂均已钉且已在产（§1.1），但**窗口维持多久/以何退出无任何既定源钉**（A2-11 先例=同 ADR 内 phase 有界桥，不覆盖跨发布代的存量退役政策）。
- 候选 (a) 固定 ≥1 发布代：到期翻 `SUPPORTED=[4]`，未迁 v3 走既有 `BLUEPRINT_MIGRATION_REQUIRED` 臂（catalog 可见迁移任务，非数据丢失）。
- 候选 (b) 存量 v3 全迁移或经报告显式裁定为止：无固定退役日，S2 翻档时点由迁移报告驱动；验收面长期双支持。
- 后果对比：(a) 有确定清障日、伤及未迁存量以 typed 拒+诊断呈现；(b) 无清障日、双解析器/双 fence 长期在保。
- 建议：VNEXT-SCHEMA-ADR §5 的 **a∧b 组合**（≥1 发布代 ∧ 存量迁完/裁定完），v3 退役复用已在产派生臂 + fence 机检，零新机制；用户仅需批『发布代下限 + 退出谓词』两参数。

**一致/已按既定语义实现而不得入上表者**：A-4 机制族（§1.2）、A-3 全部（§2.2）、A-2 全部（§3.2）、审批有效期另读法（§4）。

---

**当前真待裁 = 1 项（可能 0）**

## 6. 红线自证与文件清单

- CORE PATCH BUDGET = 0（零上游接触）；只读分析 + 本文件新增，`git show` 可验本分支相对 `23002259` 仅此一文件；`:3080` 未触碰；零端口零世界；冻结文档（paused/ 与 finished/ 两组）零改动；未改 VNEXT-SCHEMA-ADR 本体（其 §6.1 工作条目状态更新归根/后续 writer）。
- 本文所有引用 = 本轮在 `23002259` 树（另 `INTERFACES-v1.md`/`COORDINATION.md` 为根工作副本 untracked，已逐处标注）逐行亲验。
- 文件：`dev/agent-workflow/evidence/alpha5/vnext-semantics/A234-VERIFICATION.md`（本文件，唯一笔）。

— writer = alpha5-semantics-a234（qwen3.8-flash-next）；分支 `alpha5-semantics-a234` @ base `230022598dc96a377e25039bb55a27776a682552`。
