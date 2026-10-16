# §6 用户裁定下的 ToolPolicyDocument 来源诊断（hard-ceiling 复核追加轮）

- powered-by: DeepSeek Harness；model: qwen3.8-flash-next（harness 名称另列 = DeepSeek Harness）
- 性质：**纯证据追加**（接 `hard-ceiling-object-mapping-reaudit.md`，本件为其 §6 追加轮，独立成件以免重编号）。零实现恢复、零产品语义新增、合并冻结不变；主检出（写作时本地检出 `6259cf4b`）只读，本件与既有未跟踪证据目录 `dev/agent-workflow/evidence/alpha5/pr2/` 为唯一写入；未 commit / 未 push；未用 /tmp。〔修订轮 2026-10-16：用户不接受"R-1 消解/闭环/无现行偏差"结论；本轮四处修订见 §8 勘误与题注，①④ 改 §2/§4/§7，② 改 §3.2/§6，③ 全文 master 论断按固定 SHA 重查并勘误〕
- 审计对象：worktree `.worktrees/a5-pr2`，branch `alpha5-pr2-admission-grant`，HEAD `375920aa…`（code head `af3e046b`，dist 已提交，探针免构建）；master 对照：原文 = 主检出本地 ref `6259cf4b`——**修订轮更正：该本地 ref 陈旧，此后一律以 origin/master `db5cb5f7dda80ab85a2e1e31ed56b2a43ff5d1ef`（`git ls-remote origin master` 实证；`6259cf4b` 为其祖先）或显式 SHA 对照**，逐条重查见 §8。

## 0. 用户裁定（已给前提，直接引用，不再论证）

> 权限体系中**没有**名为 externalHard 的团队限制层——它是**外部环境能力限制**，非团队运行限制；在环境支持允许范围内 **admin 具有最高权限**；不新增"超 admin"层。

据此修正上轮措辞：上轮 §5 R-1 曾把"definite deny 是否涵盖 teamHardEnvelope deny"作为开放争点、并保留"若广义读则与 Alpha.4 :1102 相撞须上交"的分支——在本裁定下该开放分支的**前提**（"可能存在一个连 admin 也封顶的团队内 hard 层"）不再成立：externalHard 形状属环境能力面（本仓 = G1/G2/G3/G6 lane，`hard-ceiling-object-mapping-reaudit.md` §3），落在阶梯外，与"admin 在环境允许范围内最高"不冲突；R-1 只能按"狭义读"收口（见 §5 本件改写）。

## 1. ToolPolicyDocument 逐节点构造来源（类型 → 解析 → 装配 → 运行时）

### 1.1 类型与代数（定义链；〔修订轮更正〕原文误称"全部 PR2 分支文件"——`tool-governance` 属 PR0 冻结代数，**已落地 origin/master `db5cb5f7`**，本表引用的 planes.ts/index.ts 文件与分支逐字节一致（md5 `c6c904ddeba84096c07731a2684f48dd`），行号在两处同样成立；`tool-admission` 各文件仍仅存在于 PR2 分支）

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
   〔修订轮更正：以上两行仅对陈旧本地 ref 6259cf4b 成立。对 origin/master db5cb5f7 重查：
    `git grep -ln "ToolPolicyDocument" db5cb5f7 -- packages` **非空**（domain 层 planes.ts、
    index.ts、a5p0-* 三个测试 + 已提交 dist 共 9 文件）；`packages/domain/tool-governance/`
    目录**存在**（PR0 冻结代数）；仅 `packages/runtime/tool-admission/` 确不存在。见 §8〕
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

**生产接线状态（明写）：仅测试注入。** 〔修订轮更正措辞〕原文"对象在 master（`6259cf4b`）根本不存在（tool-governance/tool-admission 未跟踪、`ToolPolicyDocument` grep=0）"有误：对 **origin/master（`db5cb5f7`）**，`ToolPolicyDocument` **类型与解析器确实存在**（domain 层 `tool-governance/src/planes.ts:64-66/:83` + `index.ts:95` barrel，文件与审计分支逐字节一致；另有 domain 测试与 dist），但 **`tool-admission` kernel 整体不存在**、生产构造点仍 = **0**（全仓 `parseToolPolicyDocument` 非测试命中 = 定义 + barrel 自身）。故"**无生产写者、DORMANT**"的结论在 origin/master 上依旧成立（且更强：kernel 连目录都没有），但"**master 无此对象**"的措辞作废（§8 勘误 E2/E3）。在 **PR2 分支为 DORMANT**——`packages/runtime/tool-admission/index.ts:30-32` 自述逐字："no shipped glue imports this barrel yet … **Live assembly wiring rides with the first PR that executes through it (PR3/PR4)**"。

### 1.3 PR3 计划谁接

- `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md:31`：PR3 = Trusted Controlled FS Adapter；`:38` 关键路径 `S0 → PR0 → PR1 → PR2 → (PR3 ∥ PR4) → PR5 → PR8`。
- 装配义务来源 = `architecture.md:183` "All required enforcement is **DERIVED from the effective policy**"（层级：Alpha.5 未来阶段备忘）；`index.ts:30-32` 把 live 装配归给"第一个穿过它执行的 PR（PR3/PR4）"。**计划没有点名比"PR3/PR4 装配"更具体的 policyDocument 供给者**；工具权限内容面（preset/blueprint 的 allow/ask/deny 注册面，`architecture.md` §1）要等 **PR8**（Blueprint vNext，plan `:36`）才有产品化 schema。⇒ "谁构造它"在计划层 = PR3/PR4 装配 + PR8 内容面，**未指派到比这更细的责任点**（如实报告）。

## 2. maximumEffect=deny 的写权

**（a）ToolPolicyDocument 本身：今天没有任何有权 mutation 路径能写它。** 它不落存储、无更新入口、无 seam——唯一供给方式是装配方（trusted assembly，`admission-kernel.ts:90-91`）经 `policyDocument()` 端口注入；而装配方接线本身尚未存在（§1.2）。"谁能把某 scope 的 maximumEffect 写成 deny" 的现实答案 = **今天只有测试与探针**；计划答案 = PR3/PR4 装配从 effective policy 派生（§1.3），届时写权实际落在"谁能改 effective policy 的源"。

**（b）effective policy 的源面（真实存在的写权阶梯）**——若 PR3 从这些面派生 ToolPolicyDocument，则 deny 的有权写者是：

| 源面 | 公开 mutation 面（seam） | file:行 | 触发 rung 与规则 |
| --- | --- | --- | --- |
| 成员持久权限 overlay（`PermissionOverlayRule.effect: allow|ask|deny`——**最接近用户所称 "TeamPolicyDocument" 的真实对象**；该名全仓 grep=0，见 §2-d） | 唯一写权威 `GovernanceMutationService.mutatePermission`（authenticate→validate→CAS→commit→provenance） | 服务本体 `packages/runtime/governance/service.ts:581-596`；纯半部 `permission-mutation.ts:1443`（plan）与 `:265-275`（direction 分类） | `service.ts:582-583` "leader and operator act, an ordinary **member is unauthorized on this lane**"（= Alpha.4 spec §9.1 `:409`）；**收紧（写 deny）无需扩权权威**（`permission-mutation.ts:93` "TIGHTENING / identity … needs NO expansion authority"；`service.ts:589-591`），Leader 直写即时生效；Leader 扩权须 carrier 覆盖，v3 blueprint 上超 `teamHardEnvelope` 或超自身 carrier = typed 拒绝 `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`（"needing higher authority is a REFUSAL, never a pending request, until the escalation path lands"，`packages/tools/src/tools.ts:1379` 工具自述） |
| 同上（Leader 公开面） | team 工具 `team_grant_permission` / `team_revoke_permission` | `packages/tools/src/tools.ts:1373`（命名）、`:1467-1479`（authority 由宿主解析的调用者身份派生、`{kind:'leader'}` 永不作参数） | 〔修订轮更正〕原文"**仅 PR2 分支**（master 无此工具）"对 origin/master `db5cb5f7` **不成立**：该处 `packages/tools/src/tools.ts:38-39/:1373/:1379` 已有这两个工具（仅陈旧本地 ref `6259cf4b` 上缺失）。见 §8 E4 |
| 同上（Human/Operator 公开面） | remote v7 端点 `override.mutatePermission` | `packages/remote/src/contracts/params.ts:1467-1483`（"the human/operator grant/revoke into the durable permission overlay via the ONE governance mutation authority"；effect 闭集含 deny；"the server derives it from the session binding"）；目录 `packages/remote/src/contracts/catalog.ts:105,239` | 〔修订轮更正〕原文"**仅 PR2 分支**"对 origin/master `db5cb5f7` **不成立**：该处 `packages/remote/src/contracts/params.ts`、`catalog.ts:105/:239` 与 `src/handlers/dispatch.ts` 已含 `override.mutatePermission`（仅陈旧本地 ref `6259cf4b` 缺失，§8 E5）；Human 变更**跳过 envelope 检查**（`service.ts:592-593` "Human mutations skip the envelope check (ADR §7)"），actor 仅是审计数据非权威。admin 在此面 = 顶级：Alpha.4 spec §9.4 `:427-429` "Human User may initiate Member/Leader permission mutation. A mutation **beyond `teamHardEnvelope` requires Human Admin**"——即 admin 对 deny 写入无任何 envelope 封顶（admin 可写；今天 Control 呈报腿另有 G8 可用性闸，`control/types.ts:341-353`，与本写权无关的 resolver 未接线事实） |
| `teamHardEnvelope` 本身（deny 形状能拦住 human-user 的那张文档） | **无运行面写权**——blueprint v3 文档字段（`packages/domain/blueprint/src/types.ts:479`，"the HUMAN USER hard expansion ceiling, new at v3" `:461`），只能由 human 侧**重新起草/换绑 blueprint** 改变（blueprint 起草面 = 用户/主 Agent 产物，见 team-blueprint-authoring 约定） | — | 无 team 工具可写它。〔修订轮改写，消除与链 B 的矛盾：**两个机制必须分离陈述**〕**(a) 修改 Envelope 本身** = blueprint 起草面（重新起草/换绑，无运行面 mutation）——ADR-001:129 族"Human may override it explicitly"在此机制下经**改文档**实现；**(b) 越过它签一次批准** = Alpha.4 审批阶梯的 **human-admin rung**（一次性、不改文档）——Alpha.4 spec `:322` 明文授权 "a case beyond Team Hard is approvable by Human Admin, and is the only shape that reaches Human Admin"，**本件 §5 链 B 实测走的正是 (b)**（B2 顶格 human-admin → B3 admin ACCEPTED → B5 MINTED）。原文"admin 越过它靠**改文档**（起草面），不靠呈报批准本身"只描述了 (a) 并否定 (b)，与本件链 B 实测直接矛盾，**撤回** |

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

**终局性的律种判定（修订轮重写，撤销原律种归因与语义推广）**：该终局**不是** Domain 不变量（`domain/tool-governance` 无此断言，planes.ts 只求 ceiling 不宣称终局），**不是**外部能力否决（设计 :197 明令区分）。上轮曾把它判为"团队运行策略设计决策"，并把备忘"单一 Team 审批权威"不变量推广为"*团队自己的工具政策文档上一条在地的 deny，不由任何'批准'动作（无论更高 rung 还是 Core/human 审批面）覆写；要变它只能变文档本身*"——该推广**撤销**：`post-poc-technical-design.md:32` 该不变量限定的对象逐字是 **Core 的批准**（"也不允许 Core 的批准覆写 Team 拒绝"），它**不能**用来支撑"Team 自身的 human-admin 一次性批准也不能覆写任何 Team policy deny"。

**原始授权决策检索（修订轮；grep+读，词串 `禁止批准|不可批准|unapprovable|no approval|覆写|overrid.*deny|definite|确定 deny|final|终局|Human Admin`；范围 = `docs/plans/memo/alpha5-tool-io-governance/` 全部七件〔已核与其在 origin/master `db5cb5f7` 上版本 md5 逐字节一致〕+ `ADR-alpha5-tool-io-governance.md` 含 §8 V2 + Alpha.4 active 三份 + `ADR-001` + 冻结 Architecture）= 未找到**明确授权"人类 admin 的一次性批准对被标终局的 Team policy deny 也不可行"的原始设计决策。最近的四条候选及其不足以支撑的原因（层级均已标注）：

| 候选 | 逐字原文 | 出处与层级 | 为何不支撑 |
| --- | --- | --- | --- |
| 单一 Team 审批权威 | "未引入第四层审批，也不允许 Core 的批准覆写 Team 拒绝。" | `post-poc-technical-design.md:32`（Alpha.5 未来阶段备忘） | 限定对象 = **Core 批准**；对 Team 自身最高 rung 未置一词 |
| 禁批确定 deny | "禁止批准包含确定 deny/undetermined Effect 的请求。" | `alpha5-s0-pr0-pr8-implementation-plan.md:86`（同层备忘） | 禁令**未限定批准主体、未点名 human-admin rung**；"确定 deny"范围本身即 R-1 争点（用户已裁定狭义读），且未按 `ADR-a5:63` 把与 Alpha.4 spec `:322`/`:1102` 的张力登记为 intentional Alpha.5 change |
| 整组拒绝 | "An unknown authority or definite denial refuses the whole invocation; no automatic truncation or partial execution." | `architecture.md:181`（同层备忘） | 同上：无主语限定，只说"refuses the whole invocation"，未处理"Team 自身 admin rung 是否被排除" |
| V2 决定 3 | "no approval from missing/undetermined rules" | `ADR-alpha5-tool-io-governance.md:71`（§8，同层备忘） | 只覆盖 **undetermined**，对 definite deny 的可批性未置一词 |

反向证据（只报事实）：`docs/plans/paused/ADR-001-hierarchical-self-frozen-permission-governance.md:142`（Alpha.1 时代历史层）"An ordinary `deny` is a normal Team policy value. A lawful higher Team policy layer may override a lower ordinary deny."——方向相反（更低普通 deny 可被**更高的合法 Team 政策层**覆写；经由政策层而非批准）。代码侧：`approval-case.ts:24-29`（实现，非设计）把 plan `:86` 泛化为 "WHAT NO APPROVAL CAN EVER REACH … This layer decides that from the policy documents, **before any reviewer is involved**"，而其引用的唯一设计句正是对象受限的那条（"(Core approval overwriting a Team deny is forbidden, design §1.3)"）——泛化没有独立设计来源。

**⇒ 判定：未找到原始授权决策。`admission-kernel.ts:319-332` 的"先于任何 reviewer"短路属实现自行收紧；以现行实现为准绳反推设计正确是禁止的（不得以代码短路反推设计正确）。该语义的正当性未证，待用户裁。** 层级诚实保留：上述备忘诸律全部出自 **Alpha.5 未来阶段备忘**（非冻结基线、非 active Alpha.4；冻结 Architecture 对"团队工具政策 deny 可否被批准覆写"未置一词，其 hard 只指 externalHard）。

## 4. 与既定语义核对（Alpha.4："普通低阶 deny 可经更高 rung 批准上提、不可越过自身 hard"）

- **(3) 的终局 deny 属哪类**：按设计自身分类（:197）属 **团队运行策略**（Team deny），**不属**外部环境能力面（环境面 = `ExternalPolicyFacts` lane G1/G2/G3/G6，上轮 §3 已证其在执行守卫面强制、阶梯外）。
- **与 admin 最高权限的关系（修订轮重写：撤销"闭环"宣布，改为条件未证）**：先分离两机制（§2(b) 表末行同款区分）——**(a) 修改源面/文档本身**；**(b) 签一次批准越过**（审批阶梯 rung）。对 ToolPolicyDocument 扩权面：**(b)** 被 `admission-kernel.ts:319-332` 在 rung walk 之前结构性短路（链 A 实测 `events=[]`，admin 携正确 case id 亦在 mint 前被拒），而该"任何批准皆不可达"语义**未找到原始授权决策**（§3.2 修订，正当性待用户裁）；**(a)** **当前根本没有生产路径**——本件 §1.2/§2(a) 已证 ToolPolicyDocument **无任何生产构造/更新面、派生规则未定**（PR3/PR4 装配仅是计划指派），而 overlay mutation（`override.mutatePermission`）与 blueprint 重新起草写入的是**另外两张文档**（permission overlay / blueprint），**mutation 面已实现 ≠ "写入该新文档"存在**——两者是两个对象，前者的存在不能推断后者。故原论断"不冲突，条件是写权回路闭合——admin 经有权 mutation 改文档即可"把 (a) 用作了对 (b) 类问题的回答且预设了一条**未证的**从 admin 可改源面到该文档的派生边，属误用，**撤销**。修订后措辞：**若**未来装配建立"进入扩权面的 deny 条目皆源自 admin 可合法改写的源面并可被重新派生"，则 (a) 可闭合、与"环境允许范围内 admin 最高"相容；**当前无此路径，闭环不成立；亦不判偏差**（对象 DORMANT、零生产写者）——**属未闭合项**。"改文档 ≠ 批准覆写"的区分保留（两机制本不同），但不得据此宣布语义闭合；"必须先永久改策略才能放行单次执行"同样只是实现的现状形状，**非已获设计认可的语义**（§3.2：无原始授权决策；用户本轮只要求诊断）。残余：PR3+ 若装配出**无**任何有权改写源面的 deny 条目，将事实性构成"超 admin"层——该敞口连同 (a) 之未证一并列为 **PR3/PR8 装配义务与验收条款**（见 §6 末）。
- **是否实现把 TeamHard 形状误标终局**：**没有**。对照实测（§5 探针）：teamHardEnvelope deny 在 kernel 两文档口中走升阶（B2 `requiredAuthority=human-admin`→B5 MINTED），从未被判终局；终局只发生在 ToolPolicyDocument 面（A2-A5）。TeamHard 形状与终局形状在代码中是**两张文档、两个端口**（`documents()` vs `policyDocument()`，`admission-kernel.ts:96-97`），无混标。〔修订轮更正〕但本件**不宣布"无现行实现偏差候选"**：终局实现中"任何批准（含 Team 侧 human-admin 一次性批准）皆不可达、先于任何 reviewer"的语义短路（`:319-332`）**未找到原始授权决策**（§3.2 修订），属实现自行收紧、正当性未证——不判偏差、亦不判合规，**属未闭合项待用户裁**。其余残余 = PR3 派生规则未定（若 PR3 把 member/leader 普通 lane deny 灌进扩权面，就会把"可上提的低阶 deny"变成"终局 deny"，与 Alpha.4 既定语义相撞——只报告，不改，归 PR3 装配验收）。

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
- **R-1 改写（终稿措辞；〔修订轮更正其后半律种句〕）**："Alpha.5 'definite deny' 仅指 ToolPolicyDocument（扩权面）decided deny 与 undetermined 形状；它**不**是团队权限阶梯的一级，**不**涵盖 teamHardEnvelope 的 deny（后者按 Alpha.4 恒为升阶信号、admin 可批）。就'扩权面 decided deny 对任何批准（含 Team 侧 human-admin 一次性批准）不可达'这一语义：**未找到原始授权决策**——备忘 `:32` 限定对象为 Core 批准、`plan:86`/`architecture:181` 为不点名 rung 的无限定禁令（§3.2 修订），代码短路属实现自行收紧，其正当性**待用户裁**，本件不宣布其与设计相容或不相容；它与 externalHard（外部环境能力面，G1/G2/G3/G6）分属两域。"
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

1. ToolPolicyDocument 生产状态：〔修订轮更正〕**origin/master（`db5cb5f7`）已有类型+解析器（domain 层 PR0 代数，与分支逐字节一致）但无 tool-admission kernel、生产构造点 = 0；PR2 分支仅测试注入**（C1-C7 全清单 + grep 全集见 §1.2；DORMANT 自述 index.ts:30-32；PR3/PR4 装配 + PR8 内容面为计划指派）。"master 无此对象"旧措辞作废（§8 E2/E3）。
2. maximumEffect=deny 写权：该文档**无任何生产 seam**；其语义**候选**源面的有权写者 = Leader（收紧即写、扩权受 carrier/teamHard 封顶）与 Human（`override.mutatePermission`，跳 envelope；超 hard 需 Human Admin，spec §9.4）——但这些源面 mutation 写入的是 permission overlay/blueprint，**是否/如何被派生进 ToolPolicyDocument 未定**，源面可写 ≠ 该文档可写。TeamHardEnvelope **本身**仅 blueprint 起草面可改（机制 (a)）；另有机制 **(b)** = human-admin 批准 rung 一次性越过（spec `:322` 授权 + 本件链 B B5 MINTED 实测）——两机制不得混同（§2(b) 表末行修订）。非普通低阶规则别名（不分主体、不读 overlay）。
3. 终局来源：代码上由 `admission-kernel.ts:319-332` 在 rung walk 之前的结构性 return 造成；非 Domain 不变量、非外部能力否决（设计 :197 明分 Team deny ≠ Provider 能力不足）。〔修订轮更正〕其"任何批准不可达"语义的**原始授权决策未找到**：备忘 :32 限定 **Core 批准**，plan :86/architecture :181 为不点名 human-admin rung 的无限定禁令（层级 = Alpha.5 未来阶段备忘）⇒ **实现自行收紧，语义正当性未证，待用户裁**（§3.2 修订）。
4. 与既定语义核对：〔修订轮更正〕**不宣布"不冲突/闭环"**——(b) 单次批准被代码短路（链 A）且无原始授权决策；(a) 源面改写**当前无任何生产路径**进入 ToolPolicyDocument（无构造/更新面、派生未定，overlay mutation ≠ 写入该文档）。**若**未来装配建立 admin 可改写源面则可闭合；当前闭环不成立、亦不判偏差，**属未闭合项**。"改文档"≠"批准覆写"的区分保留，但不构成语义闭合；"须永久改策略方可单次放行"非已获认可语义。残余敞口 = PR3 派生规则未定，列为 PR3/PR8 装配验收条款 (a)(b)（§6 末）。
5. 对照 A：ToolPolicyDocument deny + admin → A2/A3/A4/A5 全拒、`events=[]`、admin 批准带着**正确 case id** 也在 mint 前被拒；阶梯面旁证答 allow 但未被咨询。
6. 对照 B：同形状写在 teamHardEnvelope → B2 升 `human-admin`、B3 admin ACCEPTED、B5 MINTED、B6 单次消耗；分叉点 `approval-case.ts:134`（deny 在哪张文档），终局点 A=typed refusal 零事件 vs B=grant 兑现。

## 8. 勘误与检索补记（修订轮 2026-10-16，零扩题：仅修本件既有论断，不新增分析对象）

### 8.1 基址更正

上轮 master 对照用的是主检出**本地 ref `6259cf4b`（陈旧）**。实测：`git ls-remote origin master` = **`db5cb5f7dda80ab85a2e1e31ed56b2a43ff5d1ef`**；`git merge-base --is-ancestor 6259cf4b db5cb5f7` 成立（6259cf4b 是其祖先，本地 ref 落后于 origin）。`db5cb5f7` 树内含 **PR0 冻结代数 `packages/domain/tool-governance/`**、Alpha.4 各 lane（`governance/service.ts`、`governance/authority-ceiling.ts`、`domain/blueprint/src/types.ts`、`docs/plans/active/alpha4-permission-governance/*`）、**PR1 guard `packages/runtime/tool-dispatch/closed-world-guard.ts`**、`docs/plans/memo/alpha5-tool-io-governance/*`（与审计分支 md5 逐字节一致）。**本件与同目录 `hard-ceiling-object-mapping-reaudit.md` 的一切 master 论断此后一律以 origin/master 或显式 SHA（本表用 `db5cb5f7`）复核，不得使用本地 ref。**

### 8.2 勘误表（本件内）

| # | 原论断（位置） | 纠正 | 证据（对 `db5cb5f7`） |
| --- | --- | --- | --- |
| E1 | "master 对照 = 主检出 `6259cf4b`"（头部） | 基址陈旧；master = `db5cb5f7…` | `git ls-remote origin master`；`merge-base --is-ancestor` |
| E2 | "`ToolPolicyDocument` master grep=0；master 连 tool-governance 目录都不存在；对象在 master 根本不存在"（§1.2 grep 块、§1.2 末段、§7.1） | **不成立**：`packages/domain/tool-governance/` 存在（PR0）；`ToolPolicyDocument` 类型/解析器/barrel/domain 测试/dist 共 9 文件命中；**生产构造点仍 = 0**（非测试命中仅 planes.ts:83 定义 + index.ts:95 barrel）⇒ "无生产写者/DORMANT"结论不变，"无此对象"措辞作废 | `git ls-tree db5cb5f7 packages/domain/tool-governance/`；`git grep -ln ToolPolicyDocument db5cb5f7 -- packages`；`git grep -n parseToolPolicyDocument db5cb5f7` 非测试命中=定义+barrel |
| E3 | "tool-admission 在 master 不存在"（同位置） | **仍成立**：目录整体不存在（比"零 importer"更强） | `git ls-tree db5cb5f7 packages/runtime/tool-admission/` = 空 |
| E4 | "`team_grant_permission`/`team_revoke_permission` 仅 PR2 分支，master 无"（§2(b) 表第 2 行） | **不成立**：origin/master 已有（对陈旧 6259cf4b 缺失为真） | `git grep -n team_grant_permission db5cb5f7 -- packages/tools/src/tools.ts` → `:38/:1373`（`team_revoke_permission` `:39/:1373/:1379`）；对照 6259cf4b = NONE |
| E5 | "`override.mutatePermission` 仅 PR2 分支"（§2(b) 表第 3 行） | **不成立**：origin/master remote v7 契约已含（对陈旧 6259cf4b 缺失为真） | `git grep -ln override.mutatePermission db5cb5f7 -- packages/remote` → `contracts/params.ts`、`catalog.ts:105/:239`、`src/handlers/dispatch.ts`；对照 6259cf4b `remote/src` = 空 |
| E6 | §1.1 "定义链，全部 PR2 分支文件" | **更正**：`tool-governance` 文件属 PR0 代数，已落地 origin/master 且与分支逐字节一致（行号两处同立）；`tool-admission` 文件仍仅分支有 | `git show db5cb5f7:packages/domain/tool-governance/src/planes.ts \| md5sum` = `c6c904ddeba84096c07731a2684f48dd` = 分支同文件 md5 |
| E7 | memo 引用（§1.3/§3.2 引 plan:31/:38、:86、architecture:181/:183、post-poc:32/:197） | **成立**，且经固定 SHA 复核：memo 三件在 `db5cb5f7` 与审计分支 md5 一致，行号引用可直接迁移 | plan `fd7808c17ef8ca2195597d230b46cb0e` / architecture `88428eed8cf732cb016db2b7b5b30e24` / post-poc `6a2bbbf1af277d3c30cb0154f9755892` 两处相同 |

### 8.3 ②检索结论登记（详见 §3.2 修订正文）

"Team 自身 human-admin 一次性批准对被标终局的 Team policy deny 亦不可行"——**未找到原始授权决策**（全仓检索范围与四条最近候选见 §3.2 修订表：post-poc:32 限定 Core 批准；plan:86、architecture:181 无限定、不点名 rung；ADR-alpha5:71 仅 undetermined；反向证据 ADR-001:142；泛化仅见于代码头注 approval-case.ts:24-29 且其引用源即受限条款本身）。⇒ `:319-332` 短路属实现自行收紧，语义正当性未证，待用户裁；不得以代码短路反推设计正确。
