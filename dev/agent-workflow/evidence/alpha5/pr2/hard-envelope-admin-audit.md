# Alpha.5 PR2 — hard envelope / human-admin 呈报审批：证据定位（只读审计）

- powered-by: DeepSeek Harness
- model: qwen3.8-flash-next（harness 名称另列 = DeepSeek Harness）
- 任务性质：范围外观察的**证据定位**（PR2 review-PR2.md §7 "Observation, outside PR2's scope"，`dev/agent-workflow/evidence/alpha5/pr2/review-PR2.md:78`）；不改代码、不开 PR。
- 审计对象 HEAD：worktree `.worktrees/a5-pr2`，branch `alpha5-pr2-admission-grant`，HEAD `af3e046bebf86c8879a3428f879e5494fc1c2be2`（code head `7ab7599d`，stack base `45425a30`，merge-base(origin/master) `abda8dbd`）。origin/master = `db5cb5f7`。
- 本文件位置：主检出 `dev/agent-workflow/evidence/alpha5/pr2/`，**未提交、不在任何 branch 上**（1 task=1 writer 纪律；由 parent 决定归入 `alpha5-pr2-admission-grant` 或另处）。

## 0. 结论摘要

| 问 | 答 |
| --- | --- |
| 精确复现 | 已复现；接受点是 `grantCeiling(human-admin) = CEILING_IDENTITY`（Alpha.4 冻结表 `authority-ceiling.ts:308` + `:573`），PR2 delta **未触碰**这两个文件（`git diff --name-only 45425a30..af3e046b` 对 `governance/`、`authority-envelope` = 空） |
| 最终 gate | **不止 helper**：`issueApprovedGrant` 真的铸出 grant，`consumeForExecution` 真的消耗成功（实测 能；原始输出见 §2）。mint 前的 expansion 复查只看 `ToolPolicyDocument`，硬 Envelope 不是它的输入 |
| 可达性 | master 上 `tool-admission` 整条 lane 不存在；分支上 DORMANT（零生产 importer）。今天唯一实际挡住该路径的是 Alpha.4 Control 面的 `hasAuthorityResolver('human-admin') === false`（`authority-unavailable`），而**该 gate 不在 PR2 kernel 内** |
| 裁决 | **B — 两权威语义真冲突**（冲突对见 §5，每条带两侧原文） |

---

## 1. 精确复现：哪一层读哪份文档，逐调用链

### 1.1 输入面事实（本 lane 根本没有 externalHard 输入）

`AdmissionKernelOptions`（`packages/runtime/tool-admission/admission-kernel.ts`）的权威输入只有：

- `documents(): AuthorityEnvelopeDocuments`，其文档名集合是**闭集两元**：
  `packages/runtime/governance/authority-ceiling.ts:524`
  `export type AuthorityDocumentName = 'teamHardEnvelope' | 'permissionMutationEnvelope'`
- `policyDocument(): ToolPolicyDocument`（realm-scoped 工具策略文档）
- 可选 `subtreeContains`

`packages/domain/tool-governance/src/planes.ts:148` `evaluateToolPolicyExpansionAuthority(policy, scope, contains)` 与 `:169` `evaluateToolPolicyApprovalNarrowing(...)` 的形参里**没有 Envelope**；`grep -rn "hasAuthorityResolver\|CONTROL_UNRESOLVABLE" packages/runtime/tool-admission/` = 无命中。

真正的 `externalHard` 是另一条**在用**的 lane（Alpha.2/3 capability cell）：`packages/domain/policy/src/types.ts:11-13`（`P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved`）、`packages/domain/policy/src/resolve.ts:326-330`。它**从未**作为 PR0/PR2 admission 的输入。

### 1.2 探针输入（唯一变量：谁呈报）

```
documents:
  teamHardEnvelope            rules: [ { operationClass: 'tool-invoke',
                                         matcher: { kind: 'exact', resource: 'tool:p2.secret' },
                                         effect: 'deny' } ]        // 硬上限：该 scope deny
  permissionMutationEnvelope  rules: [ { operationClass: 'tool-invoke',
                                         matcher: { kind: 'exact', resource: 'tool:other' },
                                         effect: 'allow' } ]       // 与本案无关
policyDocument（ToolPolicyDocument）: { tool:p2.secret → ask }      // 触发 Ask
effectSet: 1 effect { kind: 'tool-invoke', target: { kind: 'tool', toolName: 'p2.secret' } }
```

### 1.3 逐函数调用链（presentation → verify → mint）

| # | 位置 | 读什么 | 该步对硬 Envelope 的态度 |
| --- | --- | --- | --- |
| 1 | `admission-kernel.ts:305 admit` → `:307` clock(H1) → `:313` identity → `:316` assurance(H2) | request/binding | 未述（无 Envelope 输入） |
| 2 | `admission-kernel.ts:319-324` `evaluateEffectSetExpansion(..., options.policyDocument(), ...)` | **只有** `ToolPolicyDocument` | **不读** Envelope（`approval-case.ts:119/131` → `planes.ts:148`）→ `needsApproval=[0]` |
| 3 | `admission-kernel.ts:334 plan` → `approval-case.ts:178 planEffectSetApproval` → `:196 evaluateAuthorityCeiling` | `documents`（两份 Envelope） | 见步骤 4 |
| 4 | `governance/runtime-authority.ts:201 evaluateAuthorityCeiling`，阶梯 `:295 ladderFrom`，循环 `:248-268`（`:264 ceilingReaches`，`:268 roseBecauseInsufficient.push`） | `grantCeiling(rung, documents, scope)` | leader/human-user 被 `teamHardEnvelope` deny 压住 → 升阶；实测 `roseBecauseInsufficient=["leader","human-user"]`，`outcome=direct requiredAuthority=human-admin` |
| 5 | `governance/authority-ceiling.ts:566 grantCeiling` → `:363 bindingDocs` → `boundDocumentNames` ← 表 `:291-309` | 位置表 | **`:308 'human-admin': Object.freeze([])`**（注释即引 spec §7.4:302 "top of ladder; no envelope binds it"）→ `:573 if (bound.length === 0) return CEILING_IDENTITY` → 无规则 = `effect:'allow'` |
| 6 | `admission-kernel.ts:354 issueApprovedGrant`：`:355` clock → `:357` identity → `:359` assurance → `:369-385` **F-1** case-identity 三条腿（`toolAskApprovalCaseId` 由请求自身 member+fingerprint+generation 重算） | 呈报对象 | 只查身份，不查 Envelope |
| 7 | `admission-kernel.ts:386-393 verifyEffectSetApproval`（`approval-case.ts:276`）：`:288` fingerprint、`:291` generation、`:294-345` 每 effect `:299 evaluateAuthorityCeiling` + `:317/:322 mayReview` + `:335 grantCeiling` + `:342 ceilingReaches` | 两份 Envelope | 步骤 5 同一张表 → `:346 return { ok: true, value: { reviewer } }` |
| 8 | `admission-kernel.ts:401-406` **mint 前 expansion 复查**：`evaluateEffectSetExpansion(..., options.policyDocument(), ...)` | **只有** `ToolPolicyDocument` | **不读** Envelope；`expansionCeiling`（`authority-ceiling.ts:395`，Envelope 的扩权平面读法）在 Alpha.4 只被 `governance/service.ts:1416-1419` 的权限突变 lane 使用，**PR2 kernel 未用** |
| 9 | `admission-kernel.ts:417 mintFor` → `:423 consumeForExecution` → ledger 一次性消耗 | grant | 无 Envelope 输入 |
| 10 | 执行面 PR1 Guard `tool-dispatch/closed-world-guard.ts:445 guardDecision`（输入 = `exec/scope/surface/active/definition`） | 绑定身份/闭世界 | 无 Envelope、无 grant ceiling |

即：**presentation → helper → mint 全链上，唯一会因 `teamHardEnvelope: deny` 改变行为的地方是"该由谁批"（升阶到 human-admin），没有任何一处把它当作终局拒绝。**

---

## 2. helper 接受 ≠ 全部：最终 gate 究竟拒不拒（实测）

探针跑在**已提交的编译产物** `packages/runtime/dist/packages/runtime/tool-admission/*.js`（含 F-1 腿 `approval-case-identity-mismatch`），无需构建。原文输出（截取关键行）：

```
bindingDocs(human-admin)          = []
grantCeiling(human-admin)         = {status:'decided', effect:'allow', matchedRules:[]}
grantCeiling(leader)              = {status:'decided', effect:'deny',  matchedRules:[0]}
grantCeiling(human-user)          = {status:'decided', effect:'deny',  matchedRules:[0]}
evaluateAuthorityCeiling          -> outcome=direct requiredAuthority=human-admin
                                      roseBecauseInsufficient=["leader","human-user"]
evaluateEffectSetExpansion        -> {"allowed":[],"needsApproval":[0],"unapprovable":null}   (硬 deny 存在时)
verifyEffectSetApproval(reviewer=human-admin)  -> ACCEPTED   {ok:true,value:{reviewer:'human-admin'}}
verifyEffectSetApproval(reviewer=human-user)   -> REFUSED    APPROVAL_STALE: required rung rose to human-admin
verifyEffectSetApproval(reviewer=leader)       -> REFUSED    APPROVAL_STALE (rung)
admit()                          -> requires-approval  case=tadm:ts-1:inst-2:sha256:cddb…:g1  requiredAuthority=human-admin
planApproval()                   -> 同 caseId / 同 rung
issueApprovedGrant()             -> MINTED grant grant:ac9de886a5359143b9bdf581ac11434e singleUse=true expiresAt=null
                                    events=["admission-grant-minted","admission-approved-grant-issued"]
consumeForExecution(grant)       -> {ok:true, lease:null}   consumedCount=1
consumeForExecution(grant) again -> REFUSED APPROVAL_STALE :: grant-consumed
-- 控制组 B：把 deny 写进 ToolPolicyDocument（而非 Envelope）
issueApprovedGrant()             -> REFUSED IO_POLICY_UNSUPPORTED :: … decided DENY by the policy —
                                    Team deny is final; no approval exists for it      events=[]
-- 控制组 C：policy=allow 且硬 Envelope deny 仍在
admit()                          -> admitted（直接 grant，根本不产生审批）
```

**"能不能既 mint 又执行"：能。** mint 成功 + 一次性消耗成功，事件序列两条都在；第二次消耗按 one-shot 正确拒绝。因此该观察**不是** helper 单独点头、后面还有终闸兜住——PR2 lane 内没有那个闸；控制组 B 证明闸确实存在但只作用于 `ToolPolicyDocument` 的 deny。

---

## 3. 权威条款逐字对合（对"admin 呈报可否触达 hard 上限之上"）

### 3.1 Alpha.4 侧（当期阶段权威）= **允许**

| 路径:行 | 逐字 | 判定 |
| --- | --- | --- |
| `docs/plans/active/alpha4-permission-governance/ADR-alpha4-hard-governance.md:87-97` | 阶梯 `Human Admin > Team Hard Envelope > Human User > Leader Permission Mutation Envelope > Leader > Member` | 允许 |
| 同文件 `:99` | "`Human Admin` is the highest authority inside this Team runtime governance model." | 允许 |
| 同文件 `:111` | "The existing external/host capability facts are not an additional Team mutation ceiling." | 允许（明确不建模外部硬上限为 ceiling） |
| 同文件 `:127` | "- Alpha.4 does not model a hypothetical host security boundary that even a trusted administrator must never bypass." | 允许（明文拒绝该不变量） |
| 同文件 `:129` | "The Team governance model assumes Human Admin is trusted and has full Team governance authority." | 允许 |
| 同文件 `:905-910`（A5-1） | "`bindingDocs(human-admin) = { }` — the top of the ladder is bound by no envelope; if it were, the §3.2 row 'Human Admin → allow \| deny' would be unsatisfiable and every unapprovable case would dead-end with nobody able to act." | 允许 |
| `docs/plans/active/alpha4-permission-governance/alpha4-permission-governance-spec.md:308` | "`bindingDocs(human-admin) = { }` (top of ladder; no envelope binds it)" | 允许 |
| spec `:313` | "…a Human User by the hard ceiling alone, a Human Admin by neither, and a Member cannot review at all." | 允许 |
| spec `:322` | "**Human Admin is bound by no envelope (ADR A5-1/§3.2):** a case beyond Team Hard is approvable by Human Admin, and is the only shape that reaches Human Admin." | 允许（最直接） |
| spec `:429` | "A mutation beyond `teamHardEnvelope` requires Human Admin." | 允许 |
| spec `:964` | "- beyond Team Hard -> Admin required;" | 允许 |
| spec `:1102` §26.1 | "…the Human Admin by neither. **Reading this line as 'both documents bind every reviewer' would cap Human Admin operations that A5-1 leaves uncapped, which is a ceiling relaxation in the wrong direction and therefore forbidden**…" | 允许（并明文禁止反向改法） |
| spec `:153-155` / ADR `:105` | "No Remote payload field may create `human-admin`. / Alpha.4 has no production Human Admin resolver." / "Alpha.4 exposes no production path that can construct or claim such a principal." | 可达性另论（§4） |
| 实现落点 | `packages/runtime/governance/authority-ceiling.ts:298/302/306/308` 位置表 + `:566-573` identity 返回；`packages/runtime/governance/runtime-authority.ts:201/248-268/295` 升阶 walk | 允许（忠实实现） |

### 3.2 冻结 20260829 基线 + 其现行实现 = **禁止（对象是 externalHard）**

| 路径:行 | 逐字 | 判定 |
| --- | --- | --- |
| `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md:1441`（§19.2） | "任何 Team actor，包括 human override，都不能越过真正的 external hard policy。" | 禁止 |
| 同文件 `:1483`（§19.5，Explicit Human Override 能/不能清单） | "cannot override External Hard Policy" | 禁止 |
| 同文件 `:1505-1509`（§19.6） | "`P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved`" | 禁止 |
| 同文件 `:1864-1866`（§25.4 标题+正文） | "## 25.4 不允许借 approval 绕过 External Hard Policy" / "Leader/User 的 Team control decision 只能改变 Team-owned admission/autonomy；最终 operation 仍必须通过 DSH external hard guard。" | 禁止（闸在执行边界） |
| 同文件 `:2889`（invariant 34） | "**Human override 可以超过 Team autonomy boundary，但不能超过 External Hard Policy。**" | Team Hard=允许 / 外部硬=禁止 |
| 同文件 `:3087` / `:3089`（术语表） | "Explicit Human Override \| 用户明确设置、可越过 Team autonomy 但不可越过 external hard policy 的 durable override" / "External Hard Policy \| Team 和用户都不能越过的宿主安全/能力上限" | 同上 |
| `docs/plans/paused/ADR-001-hierarchical-self-frozen-permission-governance.md:91-92` | "- Human is the highest authority inside the Team plugin. - `externalHard` remains above Human and cannot be bypassed by the plugin." | 禁止（对象 externalHard） |
| 同文件 `:128-130` | "- `deny`: reject … do **not** create an approval request. - `teamHardDeny`: Team Agents cannot override it; **Human may override it explicitly**. - `externalHard`: absolute plugin-external ceiling; Human cannot override it through this plugin." | Team Hard=允许 / 外部硬=禁止 |
| 现行实现 | `packages/domain/policy/src/types.ts:11-13`（"…can never be bypassed by any Team layer, human override included"）、`:480-482`；`packages/domain/policy/src/resolve.ts:326-330`（"// Invariant 34 / §25.4: the external hard denies the cell for everyone."） | 禁止（在 capability-cell lane 已实现） |

### 3.3 Alpha.5 侧 = **未述**（且明文禁止自行新增"超 Envelope 层"）

| 路径:行 | 逐字 | 判定 |
| --- | --- | --- |
| `docs/plans/memo/alpha5-tool-io-governance/ADR-alpha5-tool-io-governance.md:17`（§2.3） | "Retain Alpha.4 `deny < ask < allow`, ApprovalCase, reviewer hierarchy, `teamHardEnvelope` and `permissionMutationEnvelope`. No new approval levels, no rewriting the authority model. An external/Core approval cannot reverse Team denial." | 未述（只约束 Core 批准不得翻转 Team 拒绝） |
| ADR `:71`（§8.3-V2） | "Determine the minimum reviewer lawfully covering EVERY requested effect under existing envelopes; no automatic clipping, **no reviewer hierarchy changes**, no approval from missing/undetermined rules." | 未述 + 禁止改层级 |
| ADR `:63`（§7） | "Any prospective contradiction must be listed as an intentional Alpha.5 change … and approved/validated under the repository's precedence rules. This document is not authorization to alter persistent permission meanings…" | 冲突须上交 |
| `post-poc-technical-design.md:32`（invariant 3） | "复用 Alpha.4 … `teamHardEnvelope`、`permissionMutationEnvelope`、世代与 CAS；未引入第四层审批，也不允许 Core 的批准覆写 Team 拒绝。…审批者必须合法覆盖**全部**效果" | 未述 admin 与 hard 的关系 |
| 同文件 `:173`（§4.2） | "所有 Effect 逐一核验合法共同审批权威。审批平面'无匹配 narrowing 不增加限制'与扩权平面'无匹配不授予扩权权威'是 Alpha.4 两种不同规则，不能误合并。" | 未述（且要求保持两平面差异） |
| `alpha5-s0-pr0-pr8-implementation-plan.md:15`（红线 3） | "不修改 Alpha.4 既有 Role/Reviewer Authority、Envelope、不把用户不可认证的角色字段当作真实 Admin、Domain Gate 不能被 Team 审批覆盖。" | 未述 + 禁止改 Envelope 语义 |
| plan `:86`（§5 实现） | "…禁止批准包含确定 deny/undetermined Effect 的请求。" | 歧义：未写明"确定 deny"包含哪份文档的 deny |
| plan `:87` | "守卫用于**不可绕过的最终拒绝**，pre-execute/Control Flow 用来**等待 Ask**，不可用其他 Listener 强行允许。" | 未述（终闸在执行守卫） |
| plan `:90`（§5 测试） | "Leader/Human User/Human Admin 不可用阶梯、禁止自批、…批量 Effect 中任一超天花板整组拒绝…" | 未述 |
| plan `:92`（验收） | "无模型输入可信角色/Grant…数据库不出现'第二套授权事实'…" | 未述 |
| `docs/plans/memo/alpha5-tool-io-governance/architecture.md:181`（§14.1 Admission） | "An unknown authority or definite denial refuses the whole invocation; no automatic truncation or partial execution." | 歧义（"definite denial"未指明文档来源） |
| 同文件 `:184`（§14.1 Domain authority） | "No new generic Team reviewer rung, domain-policy database or **super-envelope**." | 禁止新增超 Envelope 层 |
| 同文件 `:256`（§14.7 P0 gates） | "Verify whole requested effect set approval authority against Alpha.4 `teamHardEnvelope` / `permissionMutationEnvelope`, with mismatched, missing and changed resources failing closed." | 未述 admin 之上 |
| 检索事实 | `grep -c "human-admin\|Human Admin"`：ADR=0 / architecture.md=0 / design=0 / POC guide=0 / S0 matrix=0 / tool-fork-debt=0 / plan=1（仅 `:90` 测试清单） | Alpha.5 侧对此问题**未述** |

---

## 4. 当前 master（含 DORMANT lane）运行时可达性

- **master 上该路径不存在**：`git ls-tree -r origin/master -- packages/runtime/tool-admission` = 空。`verifyEffectSetApproval` / `issueApprovedGrant` 在 master 上无定义、无调用者。master 在用的是 PR1 Guard：`packages/runtime/src/plugin/live/agent-bindings.mjs:433` `import { installScopedToolGuard } from '../../../tool-dispatch/index.js'`（其 `guardDecision` 不读 Envelope）。
- **PR2 分支上 DORMANT**：`tool-admission` 的全部 importer 只有测试与审计 allow-list（`packages/testkit/test/p4t6-session-event-scan.test.ts:2237-242`、`packages/domain/test/a5p0-layer-audit.test.ts:40-44`、`scripts/audit-a5-tool-governance-imports.mjs:60`、tsconfigs）；`packages/runtime/tool-admission/index.ts:30-32` 自述 "DORMANT-BY-DEFAULT … no shipped glue imports this barrel yet … Live assembly wiring rides with the first PR that executes through it (PR3/PR4)"。`OperationAdmission` 无生产实现者/调用者；`a5p2-composition.test.ts` 头部同义。
- **今天真正挡住它的是 Alpha.4 Control 面的"该阶无人可任"闸**：`packages/runtime/control/types.ts:341-343` `CONTROL_UNRESOLVABLE_AUTHORITIES = ['human-admin']` + `:351-353 hasAuthorityResolver`，在 `packages/runtime/control/service.ts:4502-4531` 同步以 `AUTHORITY_UNAVAILABLE`（`terminalReason: 'resolver-unavailable'`）关闭案例、从不进入 pending（ADR A1-12 / spec §11.6）。Alpha.4 的 live 呈报入口 `packages/runtime/operation-permission/pre-execute-adapter.ts:1779 controlService.requestApprovalLeg({ reviewAuthority: approvalRouting.requiredAuthority … })` 因此**不可能**产生一个 human-admin leg；`packages/runtime/operation-permission/approval-routing.ts:200-204` 虽然给 human-admin 分配了 `USER_APPROVAL` carrier，落到 Control 仍被上述闸关闭。
- **Alpha.4 的两个 live 呈报入口都在这条闸后面**：`packages/runtime/governance/service.ts:1016-1020`（权限突变 lane `requestApprovalLeg({ … reviewAuthority: ask.required })`）与 `packages/runtime/operation-permission/pre-execute-adapter.ts:1779-1783`；两者用的都是 Alpha.4 自述 "FROZEN `evaluateAuthorityCeiling` walk reused, never re-implemented"（`packages/runtime/governance/permission-approval.ts:7`）、"starting one rung ABOVE the beneficiary … batched ALL-OR-NOTHING at the highest rung any region needs"（同文件 `:239-243`）的同一条 walk —— 即 PR2 复用的正是 Alpha.4 在用的同一份语义。
- **该闸不在 PR2 kernel 内**：`grep -rn "hasAuthorityResolver|CONTROL_UNRESOLVABLE" packages/runtime/tool-admission/` 无命中。`PresentedApproval.reviewerAuthority` 是装配方提供的**受信输入**，F-1 只闭合了 case 身份三条腿（`admission-kernel.ts:369-385`），没有"此阶在本 build 是否可能存在审批人"这条腿。
- **PR3 接线后将如何可达**：`README.md:113-121`（D-3 wiring instruction）要求 live installer 从 `kernel.planApproval()` / `admission-requires-approval` 事件取 canonical caseId 并回呈 `issueApprovedGrant`。一旦 PR3/PR4 把这条链装起来，可达性完全由装配方提供的 `reviewerAuthority` 决定：只要装配链（或未来任何 Admin resolver / Admin 认证注入，spec `:157` "Future authentication may inject trusted Human Admin identity through a dedicated server principal context seam"）能给出 `human-admin`，本路径即 mint + consume 成功，**PR2 代码无需再改**。

---

## 5. 裁决：**B — 两权威语义真冲突**（交用户裁）

判据：把该路径改成"硬 Envelope deny 对 admin 也终局拒绝"，**不是**恢复一条已存在的既定不变量，而是要推翻 Alpha.4 侧四处明文（其中 spec §26.1 明文把该改法称为 "forbidden"）并新增 Alpha.5 ADR/architecture 明文禁止的 "super-envelope / reviewer hierarchy change"。因此这不是 A（实现缺失），而是两侧权威在同一问题上给了不同答案。

### 冲突对（每条两侧原文）

1. **是否存在"连可信管理员也不可越过"的边界**
   - Alpha.4（允许/不建模）`ADR-alpha4-hard-governance.md:127`："Alpha.4 does not model a hypothetical host security boundary that even a trusted administrator must never bypass."（并 `:129` "assumes Human Admin is trusted and has full Team governance authority."）
   - 冻结基线（禁止）`DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md:1441`："任何 Team actor，包括 human override，都不能越过真正的 external hard policy。" ＋ `ADR-001…:92` "`externalHard` remains above Human and cannot be bypassed by the plugin."

2. **hard 上限之上的请求是否"可批"**
   - Alpha.4（允许）`alpha4-permission-governance-spec.md:322`："a case beyond Team Hard is approvable by Human Admin, and is the only shape that reaches Human Admin."（＋ `:429`、`:964`、ADR `:905-910` A5-1）
   - 冻结基线＋现行实现（禁止）`Architecture…:1864-1866`："## 25.4 不允许借 approval 绕过 External Hard Policy … 最终 operation 仍必须通过 DSH external hard guard。"；`packages/domain/policy/src/resolve.ts:326-330`："// Invariant 34 / §25.4: the external hard denies the cell for everyone."

3. **"hard 上限"这个词在两侧指不同对象（映射问题，须用户裁定）**
   - 冻结侧把两层分开：`ADR-001…:129-130` "`teamHardDeny`: Team Agents cannot override it; **Human may override it explicitly**." / "`externalHard`: absolute plugin-external ceiling; Human cannot override it through this plugin."（＋ invariant 34 `:2889`）
   - Alpha.4 只有一层且把它放在 admin 之下：`ADR-alpha4-hard-governance.md:87-93` 阶梯 `Human Admin > Team Hard Envelope > …`，且 `:111` "external/host capability facts are not an additional Team mutation ceiling."
   - 需裁定：Alpha.4 的 `teamHardEnvelope` 是冻结侧的 `teamHardDeny`（Human 可越）还是 `externalHard`（不可越）。若是前者，则本观察不是违规；若是后者，则 PR2/Alpha.4 需要一条 Alpha.5 侧新语义（须按 ADR `:63` 走 precedence 批准）。

4. **"确定 deny"由哪份文档决定**
   - Alpha.5（读作终局拒绝）`alpha5-s0-pr0-pr8-implementation-plan.md:86`："禁止批准包含确定 deny/undetermined Effect 的请求。"＋ `architecture.md:181`："An unknown authority or definite denial refuses the whole invocation"
   - Alpha.4（同一 scope 的 hard deny 只升阶、不终局）`alpha4-permission-governance-spec.md:314`："rises only because `desiredEffect` exceeds the candidate reviewer's `grantCeiling`" ＋ `:322`；实现 `authority-ceiling.ts:566-573`
   - 附：Alpha.5 自身禁止用实现手段私自收口：`ADR-alpha5-tool-io-governance.md:71` "no reviewer hierarchy changes"、`architecture.md:184` "No new generic Team reviewer rung … or super-envelope."

### 与裁决无关的独立事实（只报事实，不自创语义）

- **F-a** Alpha.5 admission 平面**没有任何 externalHard 输入位**：`AuthorityDocumentName` 只有两元（`authority-ceiling.ts:524`），`AdmissionKernelOptions` 无外部事实端口；`externalHard` 仅在 `packages/domain/policy`（capability cell）被消费。若用户裁"admin 不可越过硬上限"，还需先决定外部硬事实如何进入工具效果平面（当前只有 PR3/PR4 的真实 I/O 强制点在计划里承担此责，见 plan §6/§7、`architecture.md` §14.1 Enforcement）。
- **F-b** PR2 kernel 缺 Alpha.4 自有的"该阶无审批人 → `authority-unavailable`"一条腿（§4）：Alpha.4 的等价接受路径今天被 Control 面挡住，PR2 lane 无对应检查，属 PR3 装配义务（可与 F-1 同类呈报信任问题并列，但不在本次 A/B 判定内）。
- **F-c** 归因核对：reviewer 的"继承 Alpha.4 冻结 walk"**属实**——`git diff --name-only 45425a30..af3e046b | grep -E "governance/|authority-envelope"` 为空；`authority-ceiling.ts` / `runtime-authority.ts` 最近一次修改均为 `bc10e1a7 feat(a4-pr2): lane A — the runtime authority ladder, mayReview, and the minimum-authority evaluator`。

---

## 附：探针复现方式（一次性脚本，未入库）

`/tmp` 在本沙箱按 bash 调用隔离，脚本必须与 `node` 同一次 bash 调用内写入并执行：

```bash
D=/tmp/a5p2probe; mkdir -p "$D"; cat > "$D/probe.mjs" <<'EOF'
import * as A from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/tool-admission/index.js'
import { bindingDocs, grantCeiling, evaluateAuthorityCeiling }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/governance/authority-ceiling.js'
// … 见 §1.2 输入；createAdmissionKernel({ documents: () => DOCS, policyDocument: () => POLICY, … })
// 依次打印 bindingDocs/grantCeiling(三阶)、evaluateAuthorityCeiling、evaluateEffectSetExpansion、
// verifyEffectSetApproval(三阶)、admit/planApproval/issueApprovedGrant/consumeForExecution(×2)
EOF
node "$D/probe.mjs"
```

编译产物即分支已提交 dist（含 F-1 腿），无需构建。原始完整输出见 §2 与协调记录 `dev/agent-workflow/evidence/alpha5/COORDINATION.md`（本审计条目 `d6115cfd`）。
