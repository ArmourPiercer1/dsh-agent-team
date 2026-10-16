# §6 用户裁定下的 ToolPolicyDocument 来源诊断（hard-ceiling 复核追加轮）

- powered-by: DeepSeek Harness；model: qwen3.8-flash-next（harness 名称另列 = DeepSeek Harness）
- 性质：**纯证据追加**（接 `hard-ceiling-object-mapping-reaudit.md`，本件为其 §6 追加轮，独立成件以免重编号）。零实现恢复、零产品语义新增、合并冻结不变；主检出 `6259cf4b` 只读，本件与既有未跟踪证据目录 `dev/agent-workflow/evidence/alpha5/pr2/` 为唯一写入；未 commit / 未 push；未用 /tmp。
- 审计对象：worktree `.worktrees/a5-pr2`，branch `alpha5-pr2-admission-grant`，HEAD `375920aa…`（code head `af3e046b`，dist 已提交，探针免构建）；master 对照 = 主检出 `6259cf4b`。

## 0. 用户裁定（已给前提，直接引用，不再论证）

> 权限体系中**没有**名为 externalHard 的团队限制层——它是**外部环境能力限制**，非团队运行限制；在环境支持允许范围内 **admin 具有最高权限**；不新增"超 admin"层。

据此修正上轮措辞：上轮 §5 R-1 曾把"definite deny 是否涵盖 teamHardEnvelope deny"作为开放争点、并保留"若广义读则与 Alpha.4 :1102 相撞须上交"的分支——在本裁定下该开放分支的**前提**（"可能存在一个连 admin 也封顶的团队内 hard 层"）不再成立：externalHard 形状属环境能力面（本仓 = G1/G2/G3/G6 lane，`hard-ceiling-object-mapping-reaudit.md` §3），落在阶梯外，与"admin 在环境允许范围内最高"不冲突；R-1 只能按"狭义读"收口（见 §5 本件改写）。

## 1. ToolPolicyDocument 逐节点构造来源（类型 → 解析 → 装配 → 运行时）

### 1.1 类型与代数（定义链，全部 PR2 分支文件）

| 节点 | file:行 | 内容 |
| --- | --- | --- |
| 规则类型 | `packages/domain/tool-governance/src/planes.ts:56-61` | `ToolPolicyRule { realmId, effectKind, matcher, maximumEffect: AuthorityEffect }`；注释 `:55` "One realm-scoped tool-policy rule (runtime shape; **documents are built by PR2**)" |
| 文档类型 | `planes.ts:64-66` | `ToolPolicyDocument { rules }` |
| 严格解析器 | `planes.ts:83-132` | `parseToolPolicyDocument`：闭集键（:88/:100）、`maximumEffect ∈ deny|ask|allow`（:122-125）、matcher 无 `any`（:112-113）。纯函数，无任何权威检查、无存储 |
| 域出口 | `packages/domain/tool-governance/src/index.ts:95,97` | barrel re-export |
| 平面求值 | `planes.ts:148-159` / `:169-178` | 扩权面 `evaluateToolPolicyExpansionAuthority`（无匹配 ⇒ `no-authority`，:144-146 "the absence of an authorization is NEVER an implicit permission"）与审批面 `evaluateToolPolicyApprovalNarrowing`（无匹配 ⇒ 不增加限制）；两者经 `envelopeForRealm`（:135-141）复用 Alpha.4 `authority-envelope` 共享 walk（文件头 :5-19 复用契约） |
| kernel 消费口 | `packages/runtime/tool-admission/admission-kernel.ts:97` | `AdmissionKernelOptions.policyDocument: () => ToolPolicyDocument`；`:90-91` "Everything here is TRUSTED INPUT: **the assembly, not the model**, supplies documents" |
| kernel 读取点 | `admission-kernel.ts:261`（planApproval）、`:322`（admit 步骤 4）、`:404`（issueApprovedGrant 批准→发放间复查） | 三处全部是**只读**调用 `options.policyDocument()` → `evaluateEffectSetExpansion` |
| 集合判定 | `packages/runtime/tool-admission/approval-case.ts:119-143` | `evaluateEffectSetExpansion`（逐 effect 求 ceiling，见 §3） |

### 1.2 构造/写入点全仓 grep 全集（生产 vs 测试）

探测命令（在 `.worktrees/a5-pr2` 下；master 对照另列）：

```
grep -rn "ToolPolicyDocument" packages --include="*.ts" --include="*.mjs" | grep -v "/dist/"          # 46 命中全清单
grep -rn "parseToolPolicyDocument" packages --include="*.ts" --include="*.mjs" | grep -v /dist/ | grep -v "/test/"
   → planes.ts:83（定义）+ index.ts:95（barrel）——**生产构造点 = 0**
grep -rn "tool-admission" packages --include="*.ts" --include="*.mjs" | grep -v /dist/ | grep -v "^packages/runtime/tool-admission/"
   → 除 barrel 自身外全部命中于测试/层级审计白名单文件：
     testkit/test/p4t6-session-event-scan.test.ts:2237-2242、domain/test/a5p0-layer-audit.test.ts:40-44、
     runtime/test/a3p3-governance-lane-hygiene.test.ts:826-1110、a5p2-*.test.ts
grep -rln "tool-admission\|admission-kernel\|AdmissionKernel" packages/runtime/src packages/runtime/live
   → 空（生产胶水零 importer）
git grep -ln "ToolPolicyDocument" master -- packages          # master 对照
   → 空；git ls-files | grep -E "tool-governance|tool-admission" → master 连目录都不存在
```

**构造点逐一清单**（`parseToolPolicyDocument` 的全部调用者 + 唯一字面量构造）：

| # | 构造点 | file:行 | 性质 |
| --- | --- | --- | --- |
| C1 | `allowPolicy()`（授权恰好覆盖请求 effect 集） | `packages/runtime/test/a5p2-kernel-harness.ts:44-55` | **测试注入** |
| C2 | `emptyPolicy()` 字面量 `{ rules: [] }`（唯一绕过解析器的构造，仍在测试内） | `a5p2-kernel-harness.ts:57-59` | **测试注入** |
| C3 | `policyDoc()` fixture（realm 作用域 deny/ask/allow 规则） | `packages/runtime/test/a5p2-fixtures.ts:129-131` | **测试注入** |
| C4 | 契约测试 | `packages/domain/test/a5p0-contracts.test.ts:368` | 测试 |
| C5 | 平面测试 | `packages/domain/test/a5p0-planes.test.ts:45-46` | 测试 |
| C6 | schema 负例测试 | `packages/domain/test/a5p0-schema-negatives.test.ts:357,365,373` | 测试 |
| C7 | 上轮审计探针 `policyDoc(maximumEffect)` | `hard-ceiling-object-mapping-reaudit.md` 附录 A（`runs/a5-hard-reaudit/probe.mjs`）；本轮 `probe-toolpolicy-provenance.mjs` 同法 | 审计探针 |

**生产接线状态（明写）：仅测试注入。** 对象在 **master（`6259cf4b`）根本不存在**（tool-governance/tool-admission 未跟踪、`ToolPolicyDocument` grep=0）；在 **PR2 分支为 DORMANT**——`packages/runtime/tool-admission/index.ts:30-32` 自述逐字："no shipped glue imports this barrel yet … **Live assembly wiring rides with the first PR that executes through it (PR3/PR4)**"。

### 1.3 PR3 计划谁接

- `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md:31`：PR3 = Trusted Controlled FS Adapter；`:38` 关键路径 `S0 → PR0 → PR1 → PR2 → (PR3 ∥ PR4) → PR5 → PR8`。
- 装配义务来源 = `architecture.md:183` "All required enforcement is **DERIVED from the effective policy**"（层级：Alpha.5 未来阶段备忘）；`index.ts:30-32` 把 live 装配归给"第一个穿过它执行的 PR（PR3/PR4）"。**计划没有点名比"PR3/PR4 装配"更具体的 policyDocument 供给者**；工具权限内容面（preset/blueprint 的 allow/ask/deny 注册面，`architecture.md` §1）要等 **PR8**（Blueprint vNext，plan `:36`）才有产品化 schema。⇒ "谁构造它"在计划层 = PR3/PR4 装配 + PR8 内容面，**未指派到比这更细的责任点**（如实报告）。

## 2. maximumEffect=deny 的写权

**（a）ToolPolicyDocument 本身：今天没有任何有权 mutation 路径能写它。** 它不落存储、无更新入口、无 seam——唯一供给方式是装配方（trusted assembly，`admission-kernel.ts:90-91`）经 `policyDocument()` 端口注入；而装配方接线本身尚未存在（§1.2）。"谁能把某 scope 的 maximumEffect 写成 deny" 的现实答案 = **今天只有测试与探针**；计划答案 = PR3/PR4 装配从 effective policy 派生（§1.3），届时写权实际落在"谁能改 effective policy 的源"。

**（b）effective policy 的源面（真实存在的写权阶梯）**——若 PR3 从这些面派生 ToolPolicyDocument，则 deny 的有权写者是：

| 源面 | 公开 mutation 面（seam） | file:行 | 触发 rung 与规则 |
| --- | --- | --- | --- |
| 成员持久权限 overlay（`PermissionOverlayRule.effect: allow|ask|deny`——**最接近用户所称 "TeamPolicyDocument" 的真实对象**；该名全仓 grep=0，见 §2-d） | 唯一写权威 `GovernanceMutationService.mutatePermission`（authenticate→validate→CAS→commit→provenance） | 服务本体 `packages/runtime/governance/service.ts:581-596`；纯半部 `permission-mutation.ts:1443`（plan）与 `:265-275`（direction 分类） | `service.ts:582-583` "leader and operator act, an ordinary **member is unauthorized on this lane**"（= Alpha.4 spec §9.1 `:409`）；**收紧（写 deny）无需扩权权威**（`permission-mutation.ts:93` "TIGHTENING / identity … needs NO expansion authority"；`service.ts:589-591`），Leader 直写即时生效；Leader 扩权须 carrier 覆盖，v3 blueprint 上超 `teamHardEnvelope` 或超自身 carrier = typed 拒绝 `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`（"needing higher authority is a REFUSAL, never a pending request, until the escalation path lands"，`packages/tools/src/tools.ts:1379` 工具自述） |
| 同上（Leader 公开面） | team 工具 `team_grant_permission` / `team_revoke_permission` | `packages/tools/src/tools.ts:1373`（命名）、`:1467-1479`（authority 由宿主解析的调用者身份派生、`{kind:'leader'}` 永不作参数） | **仅 PR2 分支**（master 无此工具，`git grep -c master` = 空） |
| 同上（Human/Operator 公开面） | remote v7 端点 `override.mutatePermission` | `packages/remote/src/contracts/params.ts:1467-1483`（"the human/operator grant/revoke into the durable permission overlay via the ONE governance mutation authority"；effect 闭集含 deny；"the server derives it from the session binding"）；目录 `packages/remote/src/contracts/catalog.ts:105,239` | **仅 PR2 分支**；Human 变更**跳过 envelope 检查**（`service.ts:592-593` "Human mutations skip the envelope check (ADR §7)"），actor 仅是审计数据非权威。admin 在此面 = 顶级：Alpha.4 spec §9.4 `:427-429` "Human User may initiate Member/Leader permission mutation. A mutation **beyond `teamHardEnvelope` requires Human Admin**"——即 admin 对 deny 写入无任何 envelope 封顶（admin 可写；今天 Control 呈报腿另有 G8 可用性闸，`control/types.ts:341-353`，与本写权无关的 resolver 未接线事实） |
| `teamHardEnvelope` 本身（deny 形状能拦住 human-user 的那张文档） | **无运行面写权**——blueprint v3 文档字段（`packages/domain/blueprint/src/types.ts:479`，"the HUMAN USER hard expansion ceiling, new at v3" `:461`），只能由 human 侧**重新起草/换绑 blueprint** 改变（blueprint 起草面 = 用户/主 Agent 产物，见 team-blueprint-authoring 约定） | — | 无 team 工具可写它；这正是"Human 可显式越过"（ADR-001:129 族）的实现形状：admin 越过它靠**改文档**（起草面），不靠呈报批准本身 |

**（c）它会不会只是普通低阶规则的别名？——不是。** ToolPolicyDocument 规则**不分主体**（realm+effectKind+matcher 平面，`planes.ts:56-61`），不承接 member/leader 的任何 lane 规则：member/leader 的普通规则活在**另一张持久文档**（permission overlay，`PermissionOverlayRule`），由 pre-execute-adapter/Control 面消费，PR2 kernel **不读**它（kernel 的全部文档输入 = `documents()` 两 envelope + `policyDocument()`，`admission-kernel.ts:92-111`）。形状相似（`maximumEffect` 词汇与 envelope/overlay 同表）是 planes.ts `:5-19` 的**共享代数复用契约**（同一 frozen rank 表 `:50`），不是规则承接。谁的内容会进这张文档 = PR3 派生义务，当前**未定**（§1.3）——这是残余语义敞口，见 §4。

**（d）"TeamPolicyDocument" 名义核对**：全仓 grep（docs+packages，排除 dist）= **0 命中**（`TeamPolicyDocument` 不存在于任何代码/文档）。用户问题中的该名按语义映射到上表"成员持久权限 overlay"（唯一带 allow/ask/deny 规则、有更新入口、有 rung 规则的团队文档）。

## 3. evaluateEffectSetExpansion 的 decided-deny 为何终局于阶梯前（逐行 + 原文律条）

先更正点名：仓内**无** `validateEffectSetAgainstPolicy` 函数（grep=0）；对应用户所指的政策校验 = `evaluateEffectSetExpansion`（`approval-case.ts:119-143`）+ kernel 的三个消费点复查（plan `:257-303` / admit `:319-332` / issue `:401-416`）。

### 3.1 "终局"语义由哪几行造成（代码构造，非类型名）

1. `approval-case.ts:128-135`——循环内 `evaluateToolPolicyExpansionAuthority`（:131）求该 effect 的扩权面 ceiling；`ceiling.status==='decided' && ceiling.effect==='deny'`（:134）⇒ `unapprovable = { effectIndex, plane:'expansion', detail:'… decided DENY by the policy — Team deny is final; no approval exists for it' }`（:135）。
2. `approval-case.ts:129`——`if (unapprovable !== null) break`：一个 poison effect 污染**整组**（无裁剪、无部分放行）。
3. `admission-kernel.ts:319-332`——admit 步骤 4：`expansion.unapprovable !== null` ⇒ 立即 `return denied({ code:'IO_POLICY_UNSUPPORTED', … plane:'expansion' })`。**终局性来自这个 return 的位置**：它在 `planEffectSetApproval`（:281，rung walk 所在）与任何 `bindingDocs`/`evaluateAuthorityCeiling` 调用**之前**返回——阶梯从未被查询。这不是枚举语义，是**结构短路**：探针 A6 实证整链 `events=[]`（连 `admission-requires-approval` 都不产生），A7 显示同一 scope 上阶梯面对 admin 答 `grantCeiling=allow`，但该答案永不被读取。
4. `admission-kernel.ts:264-273`（planApproval 同判 `refusal:'effect-policy-denied'`）与 `:398-416`（批准后发放前**重跑**同一函数，`refusal:'effect-set-unapprovable-at-issue'`，注释 `:398-400` "the expansion plane may have MOVED to deny … a grant never issues over a freshly-denied effect"）——两个后位闸保证已呈报的 admin 批准也在 mint 前被拒（探针 A5）。
5. 对照组（终局**不**来自 hard 形状）：deny 写在 `documents()`（envelope 面）时走 `runtime-authority.ts` walk → `planEffectSetApproval:196-227` 只回答"哪级能签"（探针 B2 `requiredAuthority=human-admin`），`verifyEffectSetApproval:317-344` 对 admin `grantCeiling` 达 allow 即 ACCEPTED（B3/B5）——**同一 deny 形状，换一张文档，就是升阶信号而非终局**。

### 3.2 其依据的文档条款（带层级标注，逐字）

| 律 | 原文 | 出处与层级 |
| --- | --- | --- |
| 单一 Team 审批权威 | "3. **单一 Team 审批权威。** 复用 Alpha.4 `deny < ask < allow`、`ApprovalCase`、`teamHardEnvelope`、`permissionMutationEnvelope`、世代与 CAS；未引入第四层审批，也**不允许 Core 的批准覆写 Team 拒绝**。" | `post-poc-technical-design.md:32`（§1 架构不变量 3；**Alpha.5 未来阶段备忘**，其 `ADR:63` 自述非修正案）——即 approval-case.ts 头注 `:27` 所引 "design §1.3" |
| 禁批确定 deny | "禁止批准包含确定 deny/undetermined Effect 的请求。" | `alpha5-s0-pr0-pr8-implementation-plan.md:86`（**同层备忘**）；代码头注 `approval-case.ts:24-29` 逐字承接 |
| 整组拒绝 | "An unknown authority or definite denial refuses the whole invocation; no automatic truncation or partial execution." | `architecture.md:181`（同层备忘） |
| Team deny ≠ 能力不足 | "区分 **Team deny**、审批不存在、**Provider 能力不足**、Domain deny 和未知是否已发生副作用" | `post-poc-technical-design.md:197`（错误类型分类，同层备忘）——**设计自己把 Team deny 与能力不足列为两个不同类别**（§4 的归类关键） |
| 扩权面严格性（无匹配≠授权） | "the absence of an authorization is NEVER an implicit permission"（A1-4 strict reading） | `planes.ts:144-146`（代码承接）；律源 = Alpha.4 ADR A1-4 两平面律 + `post-poc-technical-design.md:173` "审批平面'无匹配 narrowing 不增加限制'与扩权平面'无匹配不授予扩权权威'是 Alpha.4 两种不同规则，不能误合并"（备忘复述 **active Alpha.4** 律） |

**终局性的律种判定**：该终局**不是** Domain 不变量（`domain/tool-governance` 无此断言，planes.ts 只求 ceiling 不宣称终局），**不是**外部能力否决（设计 :197 明令区分），而是**团队运行策略设计决策**——Alpha.5 备忘的"单一 Team 审批权威"不变量：*团队自己的工具政策文档上一条在地的 deny，不由任何"批准"动作（无论更高 rung 还是 Core/human 审批面）覆写；要变它只能变文档本身*。层级诚实：此律全部出自 **Alpha.5 未来阶段备忘**（非冻结基线、非 active Alpha.4；冻结 Architecture 对"团队工具政策 deny 可否被批准覆写"未置一词，其 hard 只指 externalHard）。

## 4. 与既定语义核对（Alpha.4："普通低阶 deny 可经更高 rung 批准上提、不可越过自身 hard"）

- **(3) 的终局 deny 属哪类**：按设计自身分类（:197）属 **团队运行策略**（Team deny），**不属**外部环境能力面（环境面 = `ExternalPolicyFacts` lane G1/G2/G3/G6，上轮 §3 已证其在执行守卫面强制、阶梯外）。
- **与 admin 最高权限是否冲突**：**不冲突，条件是写权回路闭合**。admin 不需要"批准越过"这条 deny——admin 通过有权 mutation 改**文档本身**：overlay 面 `override.mutatePermission`（human 跳 envelope，`service.ts:592-593`）与 blueprint 重新起草（hard envelope 的唯一变更面）都是公开面；改完（policyGeneration/authorityGeneration 前进）同一条目即可 admit。"环境/文档不允许 ≠ 权限不够"在本设计中表现为"admin 有权改文档，只是不能拿批准当覆写"——与用户裁定相容。**若** PR3+ 装配出的 deny 条目存在而**无**任何有权改写面（例如把不可再改的 preset 之外的形状写成 deny），那才会事实性构成"超 admin"层——该敞口当前不存在（对象无生产写者），列为 **PR3/PR8 装配义务与验收条款**（见 §5 改写 R-1 附注）。
- **是否实现把 TeamHard 形状误标终局**：**没有**。对照实测（§5 探针）：teamHardEnvelope deny 在 kernel 两文档口中走升阶（B2 `requiredAuthority=human-admin`→B5 MINTED），从未被判终局；终局只发生在 ToolPolicyDocument 面（A2-A5）。TeamHard 形状与终局形状在代码中是**两张文档、两个端口**（`documents()` vs `policyDocument()`，`admission-kernel.ts:96-97`），无混标。**无现行实现偏差候选**；唯一残余 = PR3 派生规则未定（若 PR3 把 member/leader 普通 lane deny 灌进扩权面，就会把"可上提的低阶 deny"变成"终局 deny"，与 Alpha.4 既定语义相撞——只报告，不改，归 PR3 装配验收）。

## 5. 两组对照实测（探针原文完整无省略）

探针 = `runs/a5-hard-reaudit/probe-toolpolicy-provenance.mjs`（md5 `3a60c9904e7cdb6a458074fcc6c44c0d`，上轮探针同法：免构建、只 import 已提交 dist、零外部状态）；输出 = `probe-toolpolicy-provenance-output.txt`（md5 `bc9ecf25eb549251ab08b7373111d324`），全文见附录 D/E。运行：`cd .worktrees/a5-pr2 && node runs/a5-hard-reaudit/probe-toolpolicy-provenance.mjs`（node v24.21.0，EXIT=0）。

**链 A（scope maximumEffect=deny，ToolPolicyDocument 面）+ admin 呈报** 各步：

| 步 | 结果（原文摘录见附录 E） |
| --- | --- |
| A2 expansion pass | `unapprovable:{effectIndex:0, plane:"expansion", detail:"… decided DENY by the policy — Team deny is final; no approval exists for it"}` |
| A3 planApproval | REFUSED `IO_POLICY_UNSUPPORTED` / `refusal:"effect-policy-denied"`（case 从未开） |
| A4 admit | `kind:"denied"` / `refusal:"effect-set-unapprovable"`, `plane:"expansion"` |
| A5 issueApprovedGrant(reviewer=**human-admin**, case id 与本 effect-set+generation 的合法 id 完全一致) | REFUSED `effect-set-unapprovable-at-issue`（正确 case id 也过不了 mint 前复查） |
| A6 | 全链 `events=[]`（零评审事件） |
| A7 | 阶梯面独立可查且**答 allow**：`bindingDocs('human-admin')=[]`、`grantCeiling=decided allow`、`evaluateAuthorityCeiling→approval-required/human-admin`——证明终局不来自 admin 能力不足，而来自阶梯根本未被咨询 |

**链 B（同一 deny 形状写在 teamHardEnvelope 面）+ admin 呈报** 各步：

| 步 | 结果 |
| --- | --- |
| B1 expansion pass（policy=ask） | `needsApproval:[0]`，`unapprovable:null` |
| B2 planApproval | `requiredAuthority:"human-admin"`（hard deny 的效果=把所需 rung 顶到 admin） |
| B3 verify | admin ACCEPTED；human-user/leader REFUSED `approval-stale`（"the required rung rose to human-admin after the leg opened"） |
| B4 admit | `requires-approval`（case `tadm:ts-1:inst-2:sha256:f6c6…:g1` at rung human-admin） |
| B5 issue(admin) | **MINTED** `grant:2388aeb71ecae73c40ff944a9d51c811` singleUse=true |
| B6/B7 | consume 一次 OK、二次 REFUSED `grant-consumed` |
| B8 | `events=["admission-requires-approval","admission-grant-minted","admission-approved-grant-issued"]` |

**分叉点** = `approval-case.ts:134`：deny 若来自 `policyDocument()`（扩权面）走终局臂；deny 若来自 `documents()`（审批面 envelope）根本不进该函数，由 `planEffectSetApproval:196` walk 变成升阶信号。**终局点差异** = A 终局于 admit/issue 的 typed refusal（零 case、零事件、admin 批准不被消费且不可能被 mint）；B 终局于 grant 发放并一次性消耗（admin 批准被兑现）。两链共用同一 effect-set fingerprint（`sha256:f6c6efc9…`）——唯一变量是 **deny 写在哪张文档上**。

## 6. 裁定后 R-1 的消解与改写

- **消解判定：R-1 进一步消解（现行代码上零残留）。** 原问"definite deny 是否涵盖 teamHardEnvelope deny"由两路同时关闭：(i) 代码事实——kernel 的 definite-deny 判据只读 `policyDocument()`，teamHardEnvelope 只进 `documents()`，探针 B 链实证 hard 形状永远走升阶、admin 可达（与 Alpha.4 spec :313/:322 一致，与 :1102 无撞）；(ii) 用户裁定——"连 admin 都封顶的团队内 hard 层"不在语义许可内，广义读被排除。
- **R-1 改写（终稿措辞）**："Alpha.5 'definite deny' 仅指 ToolPolicyDocument（扩权面）decided deny 与 undetermined 形状；它**不**是团队权限阶梯的一级，**不**涵盖 teamHardEnvelope 的 deny（后者按 Alpha.4 恒为升阶信号、admin 可批）。其终局性属**团队运行策略设计**（备忘 :32/:86/:181 层级），与 externalHard（外部环境能力面，G1/G2/G3/G6）分属两域，与'admin 在环境允许范围内最高权限'不冲突。"
- **保留为装配验收条款（非冲突，非实现偏差）**：PR3/PR4 live 装配 + PR8 内容面必须保证——进入 ToolPolicyDocument 扩权面的 deny 条目，(a) 只来自有权 mutation 可及、admin 可改写的源面（preset/blueprint/overlay seam），且 (b) member/leader 普通 lane 的可上提 deny **不得**被派生进扩权面；否则会把既定"低阶 deny 可上提"语义实现性反转。此为 PR3 验收判据，交由当期计划在 PR3 立项时钉住。

## 附录 D —— 本轮探针原文（与 runs/a5-hard-reaudit/probe-toolpolicy-provenance.mjs 逐字节一致）

（全文 149 行，与上轮附录 A 同构：同 assurance/binding/fixtures；差异仅在 CHAIN A/B 编排与 ladder-face 旁证 A6/A7；原文即该文件，此处不重复转录以免漂移——按 md5 `3a60c9904e7cdb6a458074fcc6c44c0d` 取件。）

## 附录 E —— 探针输出原文（EXIT=0，逐字，无省略）

```text
== GATE G8 (Control resolver availability; same today for both chains) ==
hasAuthorityResolver('human-admin') = false

== CHAIN A — scope maximumEffect=deny ON the ToolPolicyDocument FACE + admin presentation ==
A1 construct: parseToolPolicyDocument({rules:[{realmId,effectKind,matcher,maximumEffect:'deny'}]}) -> ok=true
A2 evaluateEffectSetExpansion(EFFECTS, realm, POLICY_DENY) -> {"allowed":[],"needsApproval":[],"unapprovable":{"effectIndex":0,"plane":"expansion","detail":"effect 0 (tool-invoke) is decided DENY by the policy — Team deny is final; no approval exists for it"}}
A3 planApproval -> {"ok":false,"error":{"code":"IO_POLICY_UNSUPPORTED","message":"admission refused: the request is not approvable as a whole (effect 0 (tool-invoke) is decided DENY by the policy — Team deny is final; no approval exists for it)","details":{"refusal":"effect-policy-denied","effectIndex":0}}}
A4 admit -> {"ok":true,"value":{"kind":"denied","error":{"code":"IO_POLICY_UNSUPPORTED","message":"admission refused: the effect set is not executable as a whole (effect 0 (tool-invoke) is decided DENY by the policy — Team deny is final; no approval exists for it)","details":{"refusal":"effect-set-unapprovable","effectIndex":0,"plane":"expansion"}}}}
A5 issueApprovedGrant(reviewer=human-admin, case=tadm:ts-1:inst-2:sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777:g1) -> {"ok":false,"error":{"code":"IO_POLICY_UNSUPPORTED","message":"admission refused: between approval and issue, effect 0 became non-executable (effect 0 (tool-invoke) is decided DENY by the policy — Team deny is final; no approval exists for it) — stale is a refusal, never a retry","details":{"refusal":"effect-set-unapprovable-at-issue","effectIndex":0}}}
A6 events across the whole A chain = []
A7 ladder face untouched by A: bindingDocs('human-admin', DOCS) = []
   grantCeiling('human-admin', DOCS, SCOPE) = {"status":"decided","effect":"allow","matchedRules":[]}
   evaluateAuthorityCeiling(member->allow, same DOCS) -> outcome=approval-required requiredAuthority=human-admin
   ^ the ladder would escalate to human-admin and ADMIN WOULD ALLOW —
     CHAIN A never reaches these lines: it terminates at A2/A4/A5 on the OTHER document.

== CHAIN B — the SAME deny shape on the teamHardEnvelope FACE + admin presentation ==
B1 evaluateEffectSetExpansion(EFFECTS, realm, POLICY_ASK) -> {"allowed":[],"needsApproval":[0],"unapprovable":null}
B2 planApproval -> {"ok":true,"value":{"approvalCaseId":"tadm:ts-1:inst-2:sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777:g1","requiredAuthority":"human-admin","perEffectRequired":["human-admin"],"effectSetFingerprint":"sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777","authorityGeneration":1}}
B3 verifyEffectSetApproval(reviewer=human-admin) -> ACCEPTED 
B3 verifyEffectSetApproval(reviewer=human-user) -> REFUSED approval-stale (required rung now human-admin)
B3 verifyEffectSetApproval(reviewer=leader) -> REFUSED approval-stale (required rung now human-admin)
B4 admit -> kind=requires-approval reason=one Alpha.4 ApprovalCase (tadm:ts-1:inst-2:sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777:g1) at rung human-admin must legally cover ALL 1 effects; per-effect rungs: 0:human-admin
B5 issueApprovedGrant(admin) -> MINTED grant:2388aeb71ecae73c40ff944a9d51c811 singleUse=true
B6 consumeForExecution -> {"ok":true,"lease":null}
B7 consumeForExecution(again) -> REFUSED grant-consumed
B8 events across the B chain = ["admission-requires-approval","admission-grant-minted","admission-approved-grant-issued"]

== FORK POINT (mechanical): the two faces are TWO documents on TWO ports ==
policy face  = AdmissionKernelOptions.policyDocument()  -> evaluateEffectSetExpansion (expansion plane; no reviewer consulted at all)
ladder face  = AdmissionKernelOptions.documents()       -> planEffectSetApproval/verifyEffectSetApproval (rung walk)
deny on the  policy face short-circuits at approval-case.ts:134-135 BEFORE any rung is computed;
deny on the  ladder  face is an ESCALATION signal at runtime-authority.ts walk (B2: requiredAuthority=human-admin).
probe done.
```

（注：B3 行尾括注 `required rung now human-admin` 取自 A7 对同一 DOCS 的 `evaluateAuthorityCeiling` 结果，与 REFUSED detail 中的 `human-admin` 一致。）

## 7. 一句话清单（本轮结论）

1. ToolPolicyDocument 生产状态：**master 无此对象；PR2 分支仅测试注入**（C1-C7 全清单 + grep 全集见 §1.2；DORMANT 自述 index.ts:30-32；PR3/PR4 装配 + PR8 内容面为计划指派）。
2. maximumEffect=deny 写权：该文档**无任何生产 seam**；其语义源面的有权写者 = Leader（收紧即写、扩权受 carrier/teamHard 封顶）与 Human（`override.mutatePermission`，跳 envelope；超 hard 需 Human Admin，spec §9.4）；TeamHardEnvelope 仅 blueprint 起草面可改。非普通低阶规则别名（不分主体、不读 overlay）。
3. 终局来源：**团队运行策略设计**（Alpha.5 备忘 :32/:86/:181，层级=未来阶段备忘；设计 :197 明分 Team deny ≠ Provider 能力不足），代码上由 `admission-kernel.ts:319-332` 在 rung walk 之前的结构性 return 造成；非 Domain 不变量、非外部能力否决。
4. 与既定语义核对：**不冲突**（admin 经有权 mutation 改文档即可，"改文档"≠"批准覆写"）；无现行实现偏差候选；残余敞口 = PR3 派生规则未定，列为 PR3/PR8 装配验收条款 (a)(b)（§6 末）。
5. 对照 A：ToolPolicyDocument deny + admin → A2/A3/A4/A5 全拒、`events=[]`、admin 批准带着**正确 case id** 也在 mint 前被拒；阶梯面旁证答 allow 但未被咨询。
6. 对照 B：同形状写在 teamHardEnvelope → B2 升 `human-admin`、B3 admin ACCEPTED、B5 MINTED、B6 单次消耗；分叉点 `approval-case.ts:134`（deny 在哪张文档），终局点 A=typed refusal 零事件 vs B=grant 兑现。
