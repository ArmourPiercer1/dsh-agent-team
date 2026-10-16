# Alpha.5 PR2 — hard-ceiling 对象映射复核（re-audit of `hard-envelope-admin-audit.md` @ `375920aa`）

- powered-by: DeepSeek Harness
- model: qwen3.8-flash-next（harness 名称另列 = DeepSeek Harness）
- 性质：**纯证据**，零语义变更、零代码改动、合并冻结不变。主检出只读；本文件为主检出唯一写入（未跟踪证据路径）。未 commit / 未 push。
- 审计对象 HEAD：worktree `.worktrees/a5-pr2`，branch `alpha5-pr2-admission-grant`，HEAD `375920aa…`（前版审计提交），code head `af3e046bebf86c8879a3428f879e5494fc1c2be2`，dist 已提交（探针免构建）。
- **方法修正（用户指示）**：不得因"两侧都含 hard 字样"就把「Alpha.4 允许 Admin 批到 Team Hard 之上」与「externalHard 连 admin 不可越」判成同一对象的冲突。拆成两个命题分别证明：
  - **P1（ceiling 建模范围）**："外部边界事实未被纳入 Team mutation ceiling"——可能只是未建模 / 另层承担，不是允许绕过。
  - **P2（最终执行放行）**："最终执行可以绕过外部边界"——须证明工具执行面真存在 external-hard 判定被 admin 呈报穿透的路径。

## 0. 结论摘要

| 问 | 答 |
| --- | --- |
| 对象映射 | `externalHard` ≠ `teamHardEnvelope` —— **不同对象**。`teamHardEnvelope` 的冻结侧同族 = ADR-001 `teamHardDeny` / Team autonomy boundary（Human **可**显式越过）；`externalHard` 的实现对应物 = `ExternalPolicyFacts` lane（domain/policy stage 2 + Control guard 面）；Alpha.4 权威阶梯 / PR2 kernel 的 ceiling 面对 externalHard **无对应物**（有意不建模，ADR-a4 §4） |
| P1 | **成立（狭义）**：ceiling/审批平面输入是闭集两元 `{teamHardEnvelope, permissionMutationEnvelope}`（`authority-ceiling.ts:524`），外部事实不进阶梯——这正是 ADR-a4 `:111` 的规定；冻结侧把外部硬承担放在**执行守卫面**（§25.4），属"另层承担"而非放行 |
| P2 | **不成立**：执行面不存在"external-hard 判定被 admin 呈报穿透"的路径。PR2 kernel 无外部事实输入位（grep=0；探针 ARM B1 注入不被读）；external-hard 形状经 `ToolPolicyDocument` 路由时 kernel 终局拒绝（ARM B2 原文）；live 执行面三道闸含外部事实、其中两道在批准之后（17/17 PASS，含 "a HUMAN allow cannot beat the external hard at the last mile"）；且今天 human-admin leg 根本无法存在（`hasAuthorityResolver('human-admin') = false`） |
| 冲突缩窄 | **撤回 C1 / C2 / C3**（映射澄清：非冲突）。剩余且仅一条语义争点 **R-1：Alpha.5 的 "definite deny / definite denial" 是否涵盖 `teamHardEnvelope` 的 deny**（§5） |

## 1. 文档权威地位标注（层级显式处理——旧 finished/paused 与 active Alpha.5 不自动同级）

裁决序 = AGENTS.md「文档权威序」+ `docs/ROUTER_RULES.md:20-21`（"upstream public contract → Architecture 文档 → …"）+ 本分支 worktree AGENTS.md 同文 + ROUTER_RULES §0（当期计划优先）。

| 引用侧 | 路径 | 地位 |
| --- | --- | --- |
| 冻结基线（语义唯一权威） | `docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` | 20260829 冻结四份之一。**路径注**：主 AGENTS.md/ROUTER_RULES 记作 `docs/plans/paused/`，现树（主检出 `6259cf4b` 与本分支 `375920aa`）实际在 `docs/plans/finished/`（`paused/` 现仅含 Alpha.1 时代文档）；本件按实际路径引用，冻结地位不变 |
| ADR 历史（Alpha.1 时代） | `docs/plans/paused/ADR-001-hierarchical-self-frozen-permission-governance.md` | paused 目录内，但**不在 20260829 冻结四份之列**——历史词汇参考层（`teamHardDeny`/`externalHard` 这对命名出自此），只作对象映射词源证据，不与冻结四份同级 |
| active 当期权威（Alpha.4） | `docs/plans/active/alpha4-permission-governance/{ADR-alpha4-hard-governance.md, alpha4-permission-governance-spec.md, alpha4-implementation-plan.md}` | 本分支当期阶段计划（worktree AGENTS.md：当前阶段 = Alpha.4 硬治理）；其自载执行协议优先于 ROUTER_RULES 过时条款 |
| 未来阶段备忘录（Alpha.5） | `docs/plans/memo/alpha5-tool-io-governance/{ADR-alpha5-tool-io-governance.md, architecture.md, alpha5-s0-pr0-pr8-implementation-plan.md, post-poc-technical-design.md}` | Alpha.5 未来阶段设计备忘。其**自身 `:63` 即地位声明**："it proposes a **future stage-local implementation contract**, not an in-place amendment to the accepted Alpha.4 production schema or the 2026-08-29 frozen historical plans. Any prospective contradiction must be listed as an intentional Alpha.5 change … and approved/validated under the repository's precedence rules." → 不与 Alpha.4 active / 冻结基线平级，冲突须上交 |
| 历史归档 | `docs/plans/finished/` 的 alpha2 / pre-alpha3 各计划（亦含 external hard 提法） | 历史，非当期需求来源 |
| 实现 | `packages/**`（本分支） | 证据，非权威 |

## 2. 对象映射表（定义与全使用面）

### 2.1 externalHard / External Hard Policy（冻结原文逐字）

- 定义（冻结基线）`docs/plans/finished/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`：
  - `:1429` `## 19.2 External Hard Policy`（首行）；
  - `:1441` "任何 Team actor，包括 human override，都不能越过真正的 external hard policy。"
  - `:1483`（§19.5 Explicit Human Override 不能清单）"cannot override External Hard Policy"
  - `:1505-1509`（§19.6）"`P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved`"
  - `:1864-1866`（§25.4）"## 25.4 不允许借 approval 绕过 External Hard Policy / Leader/User 的 Team control decision 只能改变 Team-owned admission/autonomy；最终 operation 仍必须通过 DSH external hard guard。"
  - `:2889`（invariant 34）"34. **Human override 可以超过 Team autonomy boundary，但不能超过 External Hard Policy。**"
  - `:3089`（术语表）"External Hard Policy | Team 和用户都不能越过的宿主安全/能力上限"
- 定义（ADR 历史）`docs/plans/paused/ADR-001-…:91-92` "- Human is the highest authority inside the Team plugin. / - `externalHard` remains above Human and cannot be bypassed by the plugin."；`:130` "- `externalHard`: absolute plugin-external ceiling; Human cannot override it through this plugin."
- **注意**：冻结 §25.4 把该对象的强制位置明写在**执行守卫面**（"最终 operation 仍必须通过 DSH external hard guard"），从未要求把它做成 Team 权威阶梯的一级——"above Human"（ADR-001:92）说的是 plugin 权威机制整体，其落点是插件外/执行边界的 guard。
- 实现（当前在用 lane）：`packages/domain/policy/src/types.ts:342` `export interface ExternalPolicyFacts`（注释 `:336-340` "no Team actor, human override included, can bypass them (invariant 34; §25.4 …)"）；`packages/domain/policy/src/resolve.ts:326-330` "// Invariant 34 / §25.4: the external hard denies the cell for everyone."（`note:'externalHardDeny'`）；host 配置校验 `packages/runtime/src/plugin/host.ts:664-671`；live 端口 `packages/runtime/control/types.ts:1433` `readonly externalPolicyFacts: () => Promise<…ExternalPolicyFacts>`；装配 `packages/runtime/src/plugin/root.ts:1367-1368` + `live/agent-bindings.mjs:1177-1189`（boot config 注入，T12-B3）；判定 `packages/runtime/control/service.ts:1575 hardCellAllows`。
- 投影/展示面（非权威）：`packages/contracts/src/projection/effective-config.ts:65`（"Set by an external hard policy (winning over every Team factor)."）、`model-state.ts:29`、remote/client 词表。

### 2.2 teamHardEnvelope / Team Hard Envelope（冻结侧检索 = 0 命中）

- 定义（Alpha.4 active，实现）`packages/runtime/governance/authority-ceiling.ts`：
  - `:291-309` 位置表（`BOUND_AUTHORITY_DOCUMENTS`）：`:298 member: []`（非 reviewer，读取函数在该行 refuse）；`:302 leader: ['teamHardEnvelope','permissionMutationEnvelope']`；`:306 'human-user': ['teamHardEnvelope']`；`:308 'human-admin': Object.freeze([])`（注释 `:307`：Spec §7.4:302 — `{ }`, "top of ladder; no envelope binds it"）
  - `:524` `export type AuthorityDocumentName = 'teamHardEnvelope' | 'permissionMutationEnvelope'`（**闭集两元**）
  - `:198-199` `AuthorityEnvelopeDocuments { /** The Human User hard ceiling. v3-only, required at v3 (spec §3.2). */ readonly teamHardEnvelope … }`
- Blueprint v3：`packages/domain/blueprint/src/types.ts:342` "`teamHardEnvelope`（the Human User hard ceiling, **new at v3**）"、`:461` "the Alpha.4 `teamHardEnvelope` — the **HUMAN USER** hard expansion ceiling"、`:479` 字段。
- 文档（Alpha.4 active）：`ADR-alpha4-hard-governance.md:87-99` 阶梯 "Human Admin > Team Hard Envelope > Human User > Leader Permission Mutation Envelope > Leader > Member"；`alpha4-permission-governance-spec.md:308` "bindingDocs(human-admin) = { } (top of ladder; no envelope binds it)"；`:322` "**Human Admin is bound by no envelope (ADR A5-1/§3.2):** a case beyond Team Hard is approvable by Human Admin, and is the only shape that reaches Human Admin."；`:1102`（§26.1）"…Reading this line as 'both documents bind every reviewer' would cap Human Admin operations that A5-1 leaves uncapped, which is a ceiling relaxation in the wrong direction and therefore forbidden…"。
- **冻结四份中 `Team Hard`/`teamHard` = 0 命中**（对冻结 Architecture 全文 grep）：冻结侧没有这个名。其对应族 = "Team autonomy boundary"（§19.3；invariant 34 前半 + `ADR-001:129` "- `teamHardDeny`: Team Agents cannot override it; **Human may override it explicitly**."）。

### 2.3 对象映射结论

| 对象 | 映射 | 判定 |
| --- | --- | --- |
| Alpha.4 `teamHardEnvelope` | ↔ ADR-001 `teamHardDeny` / 冻结 "Team autonomy boundary（Team-owned hard，Human 可越）"族 | **同一对象族**（不同代际命名）。证据：bindingDocs 语义（绑 human-user、不绑 human-admin）↔ ADR-001:129 "Human may override it explicitly"；blueprint 自述 "HUMAN USER hard ceiling, new at v3" |
| 冻结 `External Hard Policy` / ADR-001 `externalHard` | ↔ 实现 `ExternalPolicyFacts` lane（`resolve.ts` stage 2 + control guard 端口） | **同一对象族**；强制在执行/事实面，不在权威阶梯面（冻结 §25.4 原文即如此放置） |
| 上两行之间 | — | **不同对象**：spec:322 的"beyond Team Hard 可批"完全不触及 External Hard；后者从未在阶梯出现（也不应出现，ADR-a4 §4） |
| externalHard 在 Alpha.4 阶梯 / PR2 kernel | 无对应物 | **无对应物**（有意，见 §4 P1）；`permissionMutationEnvelope` = Leader 扩权天花板（ADR-001 mutationEnvelope 族），非 hard ceiling，与本案无关 |
| ADR-a4 `:111` 的措辞对象 | "The existing external/host capability facts are not an additional Team mutation ceiling."（`:109` 节标题 "## 4. External runtime constraints are not permission authority"） | 建模范围声明：外部事实**不作为** mutation ceiling 进入阶梯；≠ "可绕过"声明（同节 `:124` "an authorized concrete operation may still fail with a capability/environment error;" 恰表明另层承担） |

## 3. 各终闸清单（工具调用最终执行前；逐闸标 file:line + 输入是否含外部边界事实）

| # | 闸（时机） | file:line | 输入含外部边界事实？ |
| --- | --- | --- | --- |
| G1 | capability preflight（live；在开审批 case **之前**） | `packages/runtime/operation-permission/pre-execute-adapter.ts:1192`（定义）→ `:1300` 调用；`packages/runtime/control/service.ts:2926 checkExternalOperation`（`:2951` live port、`:2968 hardCellAllows`） | **是**（`externalPolicyFacts()` live port；adapter `:1291-1298` "asked BEFORE any Team question is answered and BEFORE any durable approval case is opened"） |
| G2 | Control allow 写入闸（呈报决定时） | `packages/runtime/control/service.ts:2640-2668`（"External hard policy (allow only — Architecture 25.4 / invariant 34: no Team decision, human included, bypasses it)." → 记 DENY `external-policy` + 抛 `CONTROL_EXTERNAL_POLICY_DENIED`） | **是** |
| G3 | last-mile guardOperation（批准**之后**、消费之前） | `pre-execute-adapter.ts:2000-2002` → `control/service.ts:3393-3403`（零消耗法 `:3384-3392`；adapter 映射 `:2041-2061` "the host runtime stopped allowing … between the approval and the last-mile guard … the one-shot allow was not consumed"） | **是** |
| G4 | PR1 closed-world Guard | `packages/runtime/tool-dispatch/closed-world-guard.ts:445 guardDecision`（输入 = exec/scope/surface/active/definition） | **无**（身份/绑定/指纹闭世界；`grep -rn "external" packages/runtime/tool-dispatch/*.ts` = 0） |
| G5 | PR2 kernel（**DORMANT**）：mint 前 expansion 复查 + 逐 effect verify + consume | `packages/runtime/tool-admission/admission-kernel.ts:401-406`（只读 `options.policyDocument()`）、`:386-393`→`approval-case.ts:276-346`（两份 Envelope）、`:417 mintFor`、`:423 consumeForExecution`（ledger） | **无输入位**——`AdmissionKernelOptions`（`:93-118`）字段 = clock/authorityGeneration/documents/policyDocument/beneficiaryAuthority/assuranceProbe/requiredAssurance/ledger/subtreeContains/grantExpiry/onObserve，无外部事实端口；`AuthorityDocumentName` 闭集两元（`authority-ceiling.ts:524`）；grep（§6）= 0。探针 ARM B1 实证注入不被读。DORMANT 自述 `tool-admission/index.ts:30-32`（"no shipped glue imports this barrel yet … Live assembly wiring rides with the first PR that executes through it (PR3/PR4)"） |
| G6 | domain/policy stage 2（capability cell 物化） | `packages/domain/policy/src/resolve.ts:326-330` | **是**（`EffectivePolicyInput.external: ExternalPolicyFacts`，`types.ts:394-395`；探针 ARM D 三形态均终局 deny） |
| G7 | PR3 将接入的 I/O 强制点（计划） | `packages/domain/tool-governance/src/interfaces.ts:71+`（"ControlledFs (PR3) — trusted Host mediation, grant-per-call … every operation runs its check BEFORE the open"）；`alpha5 architecture.md:183` "All required enforcement is DERIVED from the effective policy; do not let optional assurance declarations weaken it."；`plan:87` "守卫用于**不可绕过的最终拒绝**，pre-execute/Control Flow 用来**等待 Ask**，不可用其他 Listener 强行允许。" | 计划（"DERIVED from the effective policy" ⇒ effective policy 含外部事实 ⇒ PR3 装配义务；属计划义务非已证旁路） |
| G8 | Control 权威 resolver 可用性闸（今天挡住整个 admin leg） | `packages/runtime/control/types.ts:341-353`（`CONTROL_UNRESOLVABLE_AUTHORITIES = ['human-admin']`）+ `control/service.ts:4502-4531`（durable 零评审关闭，从不 pending） | 否（authority 可用性）——但它是今天事实上挡住 human-admin 呈报的最外层闸（探针 G8 行原文） |

live 装配供给：`packages/runtime/src/plugin/root.ts:1367-1368` + `live/agent-bindings.mjs:1177-1189`（外部硬事实来自 boot config，由宿主注入——与冻结 §19.2 的注入面一致）；master 在用的 `guardDecision` 不含 Envelope 也不含外部事实（G4），外部硬在 live 由 G1/G2/G3/G6 承担。

## 4. P1 / P2 终判

**P1（"外部边界事实未被纳入 Team mutation ceiling"）——成立（狭义），且是规定性分工而非缺陷**：
1. ceiling/审批平面输入闭集两元（`authority-ceiling.ts:524`），外部事实不在其中——ADR-a4 `:109/:111/:125/:126/:127`（逐字见 §2.3/§5）明文如此规定："external capability failure does not enter the approval chain"（`:125`）、"does not produce a `requiredApprovalAuthority`"（`:126`）。
2. 冻结侧不要求把它做进 ceiling：§25.4 原文把强制放在**执行守卫**（"最终 operation 仍必须通过 DSH external hard guard"）。实现确实在另层承担：G1/G2/G3/G6（§3）。
3. 结论措辞：P1 = "未纳入 ceiling 平面（另层承担）"成立；"Alpha.4 允许绕过外部边界"是前一版把建模范围声明误读为放行声明。

**P2（"最终执行可以绕过外部边界"）——不成立**，证据（原文见附录 B/C）：
1. PR2 kernel（DORMANT，master 零生产 importer）：**无外部事实输入位**；ARM B1 把 externalHard 形状的精确 deny 规则塞进 `documents` 的多余槽位——输出与基线完全相同（同一 `grant:2388aeb7…`，grant id 内容确定性），证明该注入从未被读取；能"批过去"的对象只有 `teamHardEnvelope`（ARM A），而它按 §2 映射是 Human 可越的 Team-owned 对象，**不是**外部边界。
2. kernel 内唯一能终局拒绝的形状 = expansion 平面 policy deny：ARM B2 原文 `IO_POLICY_UNSUPPORTED … decided DENY by the policy — Team deny is final; no approval exists for it`（admit 与 issue 两处都拒，`events=[]`）。⇒ 若装配把外部硬事实路由进 `ToolPolicyDocument`（PR3 义务，`architecture.md:183`），kernel 面同样不可穿透。
3. live 执行面（今天真正跑的路径）：外部事实在 G1（开 case 前）、G2（allow 写入前）、G3（批准后、消耗前）三次生效；测试 17/17 PASS，关键断言逐字（附录 C）："a hard-deny tools cell blocks even a HUMAN allow (fail closed)"（p6t4）、"G7: a HUMAN allow cannot beat the external hard at the last mile: the guard blocks with external-policy, the one-shot is NOT consumed…"（a2c4）、"G5: ask allow + external tighten after the decision -> zero execution, the guard verdict is external-policy, ZERO allow consumption…"。R1/R2 两个 "gap" 命名块是历史 RED 探针名，其断言已钉住修复后行为（`deny`/零执行/零消耗，源码 `:959-985` 可核）。
4. human-admin 呈报今天还过不了 G8：探针原文 `hasAuthorityResolver('human-admin') = false`。
5. 残余义务（只报事实）：PR3 接线时必须把外部硬事实接入 policy/guard 面（`architecture.md:183` "DERIVED from the effective policy"）；在那之前 PR2 lane 到不了执行（`index.ts:30-32` DORMANT 自述 + master 无 importer）。此系装配义务，非已证旁路。

附注（两平面法，只报事实）：ARM C 显示 policy=allow 且硬 Envelope deny 在场时 admit 直接 admitted——这符合 Alpha.4 两平面规则（审批平面 "无匹配 narrowing 不增加限制" vs 扩权平面；`post-poc-technical-design.md:173` 明令保持该差异），teamHardEnvelope 从来不是执行闸；执行闸 = ToolPolicyDocument（G5 内部）+ G1/G2/G3/G4/G6。

## 5. 前版 C1–C4 重裁（冲突缩窄）

前版 = `dev/agent-workflow/evidence/alpha5/pr2/hard-envelope-admin-audit.md` @ `375920aa` §5 冲突对 1–4。

- **C1（"是否存在连可信管理员也不可越过的边界"）→ 撤回冲突判定，记：映射澄清——非冲突。**
  Alpha.4 侧三引（ADR `:111/:127/:129`）是 §4 "External runtime constraints are not permission authority"（`:109`）内的**建模范围声明**：它声明外部事实不进 Team 治理权威模型，并未声明该边界不存在或可越；同节 `:124` 反而预告操作仍会在能力/环境层失败。冻结侧要求的强制位置在 §25.4 执行守卫，实现（G1/G2/G3）已照办。两侧各说一层：不冲突。
- **C2（"hard 上限之上的请求是否可批"）→ 撤回，记：映射澄清——非冲突。**
  Alpha.4 引文（spec `:322/:429/:964`、ADR `:905-910`）的对象是 `teamHardEnvelope`；前版配对的冻结引文（§25.4、invariant 34、`resolve.ts:326-330`）的对象是 `externalHard`。**"beyond Team Hard" ≠ "beyond External Hard"**。Team Hard 之可被 Human 批越正是冻结侧自己的语义（`ADR-001:129`；invariant 34 前半"可以超过 Team autonomy boundary"）。kernel 实测批过去的是 teamHard deny（ARM A/B1），其中无任何外部事实输入。
- **C3（"hard 一词两侧指不同对象，需裁定"）→ 撤回冲突判定，落为映射结论（§2）**：`teamHardEnvelope` = 冻结侧 teamHardDeny/Team-autonomy 族（Human 可越），**不是** externalHard；externalHard 无同名对象于 Alpha.4 阶梯/PR2 kernel，其对象由 `ExternalPolicyFacts` lane 承担。
- **C4 → 保留并缩窄为唯一剩余争点 R-1（下）**。

**R-1（唯一剩余冲突，交用户裁）：Alpha.5 的 "definite deny / definite denial" 是否涵盖 `teamHardEnvelope` 里的 deny。**（若采"且仅这一条"判据——本报告即此结论：C1–C3 均系对象混同，唯余此一条语义点。）

- Alpha.5 侧原文（**未来阶段备忘**，层级 = 其 `ADR:63` 自述非修正案、冲突须上交 precedence 批准）：
  - `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md:86`："明确批准→执行间世代改变、Scope 变化、目标身份变化、Domain Gate 变化的 stale 处理；不自动裁剪和重试。禁止批准包含确定 deny/undetermined Effect 的请求。"
  - `docs/plans/memo/alpha5-tool-io-governance/architecture.md:181`："An unknown authority or definite denial refuses the whole invocation; no automatic truncation or partial execution."
  - 旁证（Alpha.5 自限）：`architecture.md:184` "No new generic Team reviewer rung, domain-policy database or **super-envelope**."；`ADR:71` "no reviewer hierarchy changes"。
- Alpha.4 侧原文（**active 当期权威**）：
  - `alpha4-permission-governance-spec.md:313`："the Leader is capped by both, a Human User by the hard ceiling alone, a Human Admin by neither, and a Member cannot review at all."
  - 同文件 `:322`："a case beyond Team Hard is approvable by Human Admin, and is the only shape that reaches Human Admin."
  - 同文件 `:1102`（§26.1）：把 Envelope 约束推广到 Human Admin 的读法是 "a ceiling relaxation in the wrong direction and therefore **forbidden**"。
  - 实现：`authority-ceiling.ts:308`（admin 空绑定）/`:566-573`（identity ceiling）；bound Envelope 的审批面 deny 是**升阶信号**（`runtime-authority.ts:201` walk；探针 ARM A：hard deny → `requiredAuthority=human-admin`），不是终局拒绝；终局拒绝 = expansion 平面 policy deny（ARM B2）与 undetermined/无 reviewer 形状。
- 裁断提示：狭义读（"确定 deny" = expansion/policy 平面确定 deny + undetermined）⇒ 两侧相容、零冲突；广义读（bound Envelope 的 deny 也整组拒批）⇒ 与 Alpha.4 spec §26.1:1102 的 forbidden 正撞，须按 `ADR-a5:63` 走用户 precedence 裁决并在 Alpha.5 当期计划显式列 intentional change。
- **【追加轮注记，2026-10-27，不改动上文】** 用户已裁定：权限体系中没有名为 externalHard 的团队限制层（外部环境能力限制，非团队运行限制；环境允许范围内 admin 最高，不新增"超 admin"层）。据此 R-1 按狭义读收口、广义读分支前提被排除；ToolPolicyDocument 来源、deny 写权、终局律种与 A/B 对照实测见同目录 `toolpolicy-provenance.md`（§6 追加轮）。

## 6. 复现方式（免构建；全部只读）

- 探针文件：`.worktrees/a5-pr2/runs/a5-hard-reaudit/probe.mjs`（untracked scratch；md5 `7f2a9561f2bc700d1994595bf37fb24a`；全文 = 附录 A，无省略；node v24.21.0；只 import 审计分支已提交 dist，不写任何状态）。运行：`cd .worktrees/a5-pr2 && node runs/a5-hard-reaudit/probe.mjs`。
- 探针输出原文：`.worktrees/a5-pr2/runs/a5-hard-reaudit/probe-output.txt`（md5 `0f5c960b58797221c36fdd32cb5c51c`）= 附录 B。
- Control lane 外部闸测试：`cd .worktrees/a5-pr2 && node_modules/.bin/vitest run packages/runtime/test/p6t4-external-policy.test.ts packages/runtime/test/a2c4-external-lastmile.test.ts --reporter=verbose` → `Test Files 2 passed (2) / Tests 17 passed (17)`；原文 `.worktrees/a5-pr2/runs/a5-hard-reaudit/vitest-external-gates.txt`（md5 `7cb95ddf0316662135aad76eeb00f39e`）= 附录 C。
- "注入不可达" grep 证据（在 `.worktrees/a5-pr2` 下执行，均返回 0）：
  `grep -rn "externalHard\|external hard\|external-hard" packages/runtime/tool-admission/ packages/domain/tool-governance/src/ | wc -l` → `0`
  `grep -rn "ExternalPolicyFacts" packages/domain/tool-governance/src/planes.ts packages/domain/tool-governance/src/interfaces.ts | wc -l` → `0`
  `grep -rn "external" packages/runtime/tool-dispatch/*.ts | wc -l` → `0`（G4 无外部输入）

## 附录 A —— 完整探针（可整体复制运行；与 runs/a5-hard-reaudit/probe.mjs 逐字节一致）

```javascript
// probe.mjs — Alpha.5 PR2 hard-ceiling re-audit probe (READ-ONLY, no state outside this process).
// Pinned to the audited commit: worktree .worktrees/a5-pr2 @ branch alpha5-pr2-admission-grant
// code head af3e046bebf86c8879a3428f879e5494fc1c2be2 (committed dist, no build required).
// Run: node <this file>   (node v24.21.0 used; dist is plain ESM)
const W = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2'
const D = `${W}/packages/runtime/dist`

import { createAdmissionKernel, createGrantLedger, createStubAssuranceProbe,
  evaluateEffectSetExpansion, verifyEffectSetApproval }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/tool-admission/index.js'
import { bindingDocs, grantCeiling }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/governance/authority-ceiling.js'
import { evaluateAuthorityCeiling }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/governance/runtime-authority.js'
import { parseToolBinding, parseRequestedEffectSet, parseToolPolicyDocument }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/domain/tool-governance/src/index.js'
import { resolveEffectivePolicy }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/domain/policy/src/index.js'
import { hasAuthorityResolver, CONTROL_UNRESOLVABLE_AUTHORITIES }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/runtime/control/types.js'
import { parseRootSessionId, parseTeamSessionId, parseInstanceId, createMemberIdentity }
  from '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2/packages/runtime/dist/packages/domain/policy/src/contracts-mirror.js'

const J = (x) => JSON.stringify(x)
const LINE = (s) => console.log(s)
const FIXED_NOW = 1_737_000_000_000
const REALM = 'realm-a'
const MEMBER = { teamSessionId: 'ts-1', instanceId: 'inst-2' }

// ---------- assurance contract / binding (a5p2-fixtures.ts verbatim shapes) ----------
function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'landlock-abi4-selflock' : null, realmId: REALM,
    trustRoot: real ? 'os:kernel-6.12' : null, evidence: real ? 'evidence/a5p4/probe.json' : null }
}
function assuranceContract() {
  const dims = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel']
  const assurance = {}
  for (const d of dims) assurance[d] = dimensionRecord('untested')
  return { implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', assurance }
}
function makeBinding(toolName) {
  const assurance = assuranceContract()
  const parsed = parseToolBinding({
    bindingId: 'bind-p2-secret-1', agentScopeKey: 'session-m1', toolName,
    definitionIdentity: `def:${toolName}`, providerId: 'team-adapter',
    implementationOrigin: assurance.implementationOrigin, executionBoundary: assurance.executionBoundary,
    assurance, policyGeneration: 1, authorityGeneration: 1, revision: 1, status: 'ACTIVE',
  })
  if (!parsed.ok) throw new Error(`binding rejected: ${J(parsed.problems)}`)
  return parsed.value
}

// ---------- shared inputs (previous audit §1.2: THE only variable is who reviews) ----------
const EFFECTS_PARSED = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: 'p2.secret', resource: null }])
if (!EFFECTS_PARSED.ok) throw new Error(`effects rejected: ${J(EFFECTS_PARSED.problems)}`)
const EFFECTS = EFFECTS_PARSED.value
const BINDING = makeBinding('p2.secret')
const SCOPE = { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${REALM}|tool:p2.secret` } }
const HARD_DENY_RULE = { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${REALM}|tool:p2.secret` }, maximumEffect: 'deny' }
const UNRELATED_ALLOW_RULE = { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: `${REALM}|tool:other` }, maximumEffect: 'allow' }
const DOCS = Object.freeze({
  teamHardEnvelope: { rules: [HARD_DENY_RULE] },          // hard ceiling: deny on this scope
  permissionMutationEnvelope: { rules: [UNRELATED_ALLOW_RULE] }, // unrelated to this case
})
const policyDoc = (maximumEffect) => {
  const p = parseToolPolicyDocument({ rules: [{ realmId: REALM, effectKind: 'tool-invoke',
    matcher: { kind: 'exact', resource: `${REALM}|tool:p2.secret` }, maximumEffect }] })
  if (!p.ok) throw new Error(`policy rejected: ${J(p.problems)}`)
  return p.value
}
const POLICY_ASK = policyDoc('ask')
const POLICY_DENY = policyDoc('deny')
const POLICY_ALLOW = policyDoc('allow')

function makeKernel(documents, policyDocument, events) {
  return createAdmissionKernel({
    clock: () => FIXED_NOW, authorityGeneration: () => 1,
    documents: () => documents, policyDocument: () => policyDocument,
    beneficiaryAuthority: 'member', assuranceProbe: createStubAssuranceProbe({}),
    requiredAssurance: () => ({}), ledger: createGrantLedger(),
    onObserve: (e) => events.push(e.event),
  })
}
const REQUEST = { binding: BINDING, member: MEMBER, callId: 'call-1', realmId: REALM,
  parametersFingerprint: `sha256:${'a'.repeat(64)}`, requestedEffects: EFFECTS }
const approvalFor = (reviewer, caseId) => ({
  approvalCaseId: caseId, reviewerAuthority: reviewer, beneficiaryAuthority: 'member',
  requiredAuthorityAtCreation: reviewer, effectSetFingerprint: EFFECTS.fingerprint,
  authorityGenerationAtCreation: 1,
})
const CALL = { currentAuthorityGeneration: 1, member: MEMBER, callId: 'call-1', realmId: REALM,
  bindingId: 'bind-p2-secret-1', bindingRevision: 1, parametersFingerprint: `sha256:${'a'.repeat(64)}`,
  requestedEffects: EFFECTS }

// ===========================================================================
LINE('== GATE G8 (Alpha.4 Control resolver-availability gate) ==')
LINE(`CONTROL_UNRESOLVABLE_AUTHORITIES = ${J(CONTROL_UNRESOLVABLE_AUTHORITIES)}`)
LINE(`hasAuthorityResolver('human-admin') = ${hasAuthorityResolver('human-admin')}`)

// ===========================================================================
LINE('')
LINE('== ARM A (baseline reproduction: teamHardEnvelope deny + human-admin reviewer) ==')
for (const rung of ['member', 'leader', 'human-user', 'human-admin']) {
  let bd, gc
  try { bd = J(bindingDocs(rung, DOCS).map(d => d.rules.length)) } catch (e) { bd = `REFUSED ${e.code}/${e.problem}` }
  try { gc = J(grantCeiling(rung, DOCS, SCOPE)) } catch (e) { gc = `REFUSED ${e.code}/${e.problem}` }
  LINE(`${rung.padEnd(12)}: bindingDocs = ${bd}   grantCeiling = ${gc}`)
}
const ev = evaluateAuthorityCeiling({ beneficiaryAuthority: 'member', initiatorAuthority: 'member',
  operationClass: SCOPE.operationClass, matcher: SCOPE.matcher, desiredEffect: 'allow', documents: DOCS })
LINE(`evaluateAuthorityCeiling   -> outcome=${ev.outcome} requiredAuthority=${ev.requiredAuthority ?? 'n/a'} roseBecauseInsufficient=${J(ev.roseBecauseInsufficient ?? null)}`)
LINE(`evaluateEffectSetExpansion -> ${J(evaluateEffectSetExpansion(EFFECTS, REALM, POLICY_ASK))}`)
const planK = makeKernel(DOCS, POLICY_ASK, [])
const planned = planK.planApproval(REQUEST)
LINE(`planApproval               -> ${J(planned)}`)
const caseId = planned.value.approvalCaseId
for (const reviewer of ['human-admin', 'human-user', 'leader']) {
  const v = verifyEffectSetApproval({ effects: EFFECTS, realmId: REALM, approval: approvalFor(reviewer, caseId),
    currentAuthorityGeneration: 1, documents: DOCS })
  LINE(`verifyEffectSetApproval(reviewer=${reviewer}) -> ${v.ok ? 'ACCEPTED' : 'REFUSED'} ${J(v.ok ? v.value : v.error)}`)
}
const eventsA = []
const kernelA = makeKernel(DOCS, POLICY_ASK, eventsA)
const admitted = await kernelA.admit(REQUEST)
LINE(`admit()                    -> ${J({ kind: admitted.ok ? admitted.value.kind : 'error',
  reason: admitted.ok ? admitted.value.reason : admitted.error })}`)
const minted = await kernelA.issueApprovedGrant(REQUEST, approvalFor('human-admin', caseId))
LINE(`issueApprovedGrant()       -> ${minted.ok ? `MINTED grant ${minted.value.grantId} singleUse=${minted.value.singleUse} expiresAt=${J(minted.value.expiresAt ?? null)}` : `REFUSED ${J(minted.error)}`} events=${J(eventsA)}`)
if (minted.ok) {
  const c1 = kernelA.consumeForExecution(minted.value, CALL)
  LINE(`consumeForExecution(grant) -> ${J(c1.ok ? { ok: true, lease: c1.value.lease } : c1.error)}`)
  const c2 = kernelA.consumeForExecution(minted.value, CALL)
  LINE(`consumeForExecution(again) -> ${c2.ok ? 'ACCEPTED (BUG)' : `REFUSED ${J(c2.error)}`}`)
}

// ===========================================================================
LINE('')
LINE('== ARM B1 (inject external-hard-shaped DENY as an extra document slot) ==')
const DOCS_B1 = { ...DOCS, externalHard: { rules: [HARD_DENY_RULE] } }
const eventsB1 = []
const kernelB1 = makeKernel(DOCS_B1, POLICY_ASK, eventsB1)
await kernelB1.admit(REQUEST)
const mintedB1 = await kernelB1.issueApprovedGrant(REQUEST, approvalFor('human-admin', caseId))
LINE(`documents carries externalHard:{rules:[deny]} -> ${mintedB1.ok ? `MINTED grant ${mintedB1.value.grantId} (injection NOT READ by kernel)` : `REFUSED ${J(mintedB1.error)}`} events=${J(eventsB1)}`)
const cB1 = mintedB1.ok ? kernelB1.consumeForExecution(mintedB1.value, CALL) : null
LINE(`consumeForExecution        -> ${cB1 ? J({ ok: cB1.ok, lease: cB1.ok ? cB1.value.lease : undefined }) : 'n/a'}`)
LINE(`grantCeiling('human-admin', DOCS_B1) = ${J(grantCeiling('human-admin', DOCS_B1, SCOPE))}`)

// ===========================================================================
LINE('')
LINE('== ARM B2 (external-hard fact routed as ToolPolicyDocument deny) ==')
const eventsB2 = []
const kernelB2 = makeKernel(DOCS, POLICY_DENY, eventsB2)
const admittedB2 = await kernelB2.admit(REQUEST)
LINE(`admit(policy=deny)         -> ${J({ kind: admittedB2.ok ? admittedB2.value.kind : 'error',
  value: admittedB2.ok ? admittedB2.value : admittedB2.error })}`)
const mintedB2 = await kernelB2.issueApprovedGrant(REQUEST, approvalFor('human-admin', caseId))
LINE(`issueApprovedGrant()       -> ${mintedB2.ok ? `MINTED ${mintedB2.value.grantId}` : `REFUSED ${J(mintedB2.error)}`} events=${J(eventsB2)}`)

// ===========================================================================
LINE('')
LINE('== ARM C (policy allow, hard Envelope deny still present) ==')
const eventsC = []
const kernelC = makeKernel(DOCS, POLICY_ALLOW, eventsC)
const admittedC = await kernelC.admit(REQUEST)
LINE(`admit()                    -> ${J(admittedC)} events=${J(eventsC)}`)

// ===========================================================================
LINE('')
LINE('== ARM D (domain/policy stage-2 external-hard face, Invariant 34 / §25.4) ==')
const ROOT = parseRootSessionId('session-root-1')
const TEAM = parseTeamSessionId('session-root-1')
const IDN = createMemberIdentity(ROOT, parseInstanceId('inst-a'))
const ALLOW_ITEMS = ['p2.secret']
const baseIn = (external, extra = {}) => ({ teamSessionId: TEAM, member: IDN,
  blueprint: {}, template: {}, policyState: { stateId: 'default' }, external, ...extra })
const cellOf = (out, cap) => {
  const cell = out.cells[cap]
  return { effective: cell.effective, note: cell.external.note, removedItems: cell.external.removedItems }
}
const d1 = resolveEffectivePolicy(baseIn({ hard: { tools: { kind: 'deny' } }, capabilityExists: {} },
  { humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: { kind: 'allow', items: ALLOW_ITEMS } } } }))
LINE(`D1 humanOverride allow + external hard deny -> ${J(cellOf(d1, 'tools'))}`)
const d2 = resolveEffectivePolicy(baseIn({ hard: { tools: { kind: 'allow', items: ['other'] } }, capabilityExists: {} },
  { humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: { kind: 'allow', items: ALLOW_ITEMS } } } }))
LINE(`D2 humanOverride allow + hard allow-list excludes item -> ${J(cellOf(d2, 'tools'))}`)
const d3 = resolveEffectivePolicy(baseIn({ hard: {}, capabilityExists: { tools: false } },
  { humanOverride: { overrideId: 'ovh-1', scope: 'team', values: { tools: { kind: 'allow', items: ALLOW_ITEMS } } } }))
LINE(`D3 humanOverride allow + capabilityExists:false -> ${J(cellOf(d3, 'tools'))}`)
LINE('probe done.')
```

## 附录 B —— 探针输出原文（EXIT=0，逐字，无省略）

```text
== GATE G8 (Alpha.4 Control resolver-availability gate) ==
CONTROL_UNRESOLVABLE_AUTHORITIES = ["human-admin"]
hasAuthorityResolver('human-admin') = false

== ARM A (baseline reproduction: teamHardEnvelope deny + human-admin reviewer) ==
member      : bindingDocs = REFUSED AUTHORITY_BINDING_DEFECT/position-is-not-a-reviewer   grantCeiling = REFUSED AUTHORITY_BINDING_DEFECT/position-is-not-a-reviewer
leader      : bindingDocs = [1,1]   grantCeiling = {"status":"decided","effect":"deny","matchedRules":[0]}
human-user  : bindingDocs = [1]   grantCeiling = {"status":"decided","effect":"deny","matchedRules":[0]}
human-admin : bindingDocs = []   grantCeiling = {"status":"decided","effect":"allow","matchedRules":[]}
evaluateAuthorityCeiling   -> outcome=approval-required requiredAuthority=human-admin roseBecauseInsufficient=null
evaluateEffectSetExpansion -> {"allowed":[],"needsApproval":[0],"unapprovable":null}
planApproval               -> {"ok":true,"value":{"approvalCaseId":"tadm:ts-1:inst-2:sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777:g1","requiredAuthority":"human-admin","perEffectRequired":["human-admin"],"effectSetFingerprint":"sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777","authorityGeneration":1}}
verifyEffectSetApproval(reviewer=human-admin) -> ACCEPTED {"reviewer":"human-admin"}
verifyEffectSetApproval(reviewer=human-user) -> REFUSED {"code":"APPROVAL_STALE","message":"admission refused: the presented approval does not cover this execution (effect 0: the required rung rose to human-admin after the leg opened — the old reviewer cannot allow what the escalated ladder now needs)","details":{"refusal":"approval-stale","detail":"effect 0: the required rung rose to human-admin after the leg opened — the old reviewer cannot allow what the escalated ladder now needs"}}
verifyEffectSetApproval(reviewer=leader) -> REFUSED {"code":"APPROVAL_STALE","message":"admission refused: the presented approval does not cover this execution (effect 0: the required rung rose to human-admin after the leg opened — the old reviewer cannot allow what the escalated ladder now needs)","details":{"refusal":"approval-stale","detail":"effect 0: the required rung rose to human-admin after the leg opened — the old reviewer cannot allow what the escalated ladder now needs"}}
admit()                    -> {"kind":"requires-approval","reason":"one Alpha.4 ApprovalCase (tadm:ts-1:inst-2:sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777:g1) at rung human-admin must legally cover ALL 1 effects; per-effect rungs: 0:human-admin"}
issueApprovedGrant()       -> MINTED grant grant:2388aeb71ecae73c40ff944a9d51c811 singleUse=true expiresAt=null events=["admission-requires-approval","admission-grant-minted","admission-approved-grant-issued"]
consumeForExecution(grant) -> {"ok":true,"lease":null}
consumeForExecution(again) -> REFUSED {"code":"APPROVAL_STALE","message":"grant \"grant:2388aeb71ecae73c40ff944a9d51c811\" refused at the consumption edge: grant-consumed (frozen PR0 precedence; no retry, no fallback, design §4.3)","details":{"refusal":"grant-consumed"}}

== ARM B1 (inject external-hard-shaped DENY as an extra document slot) ==
documents carries externalHard:{rules:[deny]} -> MINTED grant grant:2388aeb71ecae73c40ff944a9d51c811 (injection NOT READ by kernel) events=["admission-requires-approval","admission-grant-minted","admission-approved-grant-issued"]
consumeForExecution        -> {"ok":true,"lease":null}
grantCeiling('human-admin', DOCS_B1) = {"status":"decided","effect":"allow","matchedRules":[]}

== ARM B2 (external-hard fact routed as ToolPolicyDocument deny) ==
admit(policy=deny)         -> {"kind":"denied","value":{"kind":"denied","error":{"code":"IO_POLICY_UNSUPPORTED","message":"admission refused: the effect set is not executable as a whole (effect 0 (tool-invoke) is decided DENY by the policy — Team deny is final; no approval exists for it)","details":{"refusal":"effect-set-unapprovable","effectIndex":0,"plane":"expansion"}}}}
issueApprovedGrant()       -> REFUSED {"code":"IO_POLICY_UNSUPPORTED","message":"admission refused: between approval and issue, effect 0 became non-executable (effect 0 (tool-invoke) is decided DENY by the policy — Team deny is final; no approval exists for it) — stale is a refusal, never a retry","details":{"refusal":"effect-set-unapprovable-at-issue","effectIndex":0}} events=[]

== ARM C (policy allow, hard Envelope deny still present) ==
admit()                    -> {"ok":true,"value":{"kind":"admitted","grant":{"grantId":"grant:2388aeb71ecae73c40ff944a9d51c811","member":{"teamSessionId":"ts-1","instanceId":"inst-2"},"callId":"call-1","realmId":"realm-a","bindingId":"bind-p2-secret-1","bindingRevision":1,"authorityGeneration":1,"parametersFingerprint":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","effects":{"effects":[{"kind":"tool-invoke","toolName":"p2.secret","resource":null}],"fingerprint":"sha256:f6c6efc971fc0f63895e429d81e4bd8b3e4a56ca892bd533fd68472056ba7777"},"singleUse":true,"issuedAt":1737000000000,"expiresAt":null}}} events=["admission-grant-minted","admission-admitted"]

== ARM D (domain/policy stage-2 external-hard face, Invariant 34 / §25.4) ==
D1 humanOverride allow + external hard deny -> {"effective":{"kind":"deny"},"note":"externalHardDeny","removedItems":["p2.secret"]}
D2 humanOverride allow + hard allow-list excludes item -> {"effective":{"kind":"deny"},"note":"externalHardRemovedAll","removedItems":["p2.secret"]}
D3 humanOverride allow + capabilityExists:false -> {"effective":{"kind":"deny"},"note":"capabilityMissing","removedItems":["p2.secret"]}
probe done.
```

## 附录 C —— Control lane 外部闸测试原文（vitest v4.1.11，EXIT=0）

```text
 RUN  v4.1.11 /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pr2

 ✓ packages/runtime/test/p6t4-external-policy.test.ts > p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible) > a hard-deny tools cell blocks even a HUMAN allow (fail closed); the durable deny reason is external-policy and the request is closed 1ms
 ✓ packages/runtime/test/p6t4-external-policy.test.ts > p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible) > an allow-list that does not NAME the tool fails closed (an unnamed tool matches no item) 0ms
 ✓ packages/runtime/test/p6t4-external-policy.test.ts > p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible) > capabilityExists:false fails closed even with a matching allow-list 0ms
 ✓ packages/runtime/test/p6t4-external-policy.test.ts > p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible) > a matching allow-list lets the allow pass (absent capabilityExists = the capability is assumed present) 0ms
 ✓ packages/runtime/test/p6t4-external-policy.test.ts > p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible) > an operation that names NO capability (no toolName, no capabilityDomain) is not probed: it passes despite a hard deny on tools (documented boundary) 0ms
 ✓ packages/runtime/test/p6t4-external-policy.test.ts > p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible) > an explicit capabilityDomain uses THAT cell: a skills hard-deny blocks a skills-domain request; a tools deny does not (live re-probe on the next request) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 RED probes — the pre-fix external hard last-mile gaps (plan §6.4) > R1: a static allow still EXECUTES after the live external provider hard-denies the tools cell (gap: the static path carries no external check) 1ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 RED probes — the pre-fix external hard last-mile gaps (plan §6.4) > R2: a durable allow whose external cell tightened before the guard still EXECUTES and CONSUMES the one-shot (gap: guardOperation re-reads no external facts) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G1 (=R1): static allow + live external hard deny -> zero execution, a deny decision, zero durable control rows (the static path has no request) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G2: static allow + an allow-list that does NOT name the tool -> zero execution; the static path never mints a control row 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G9: hostile-prepend end-cap non-regression (H1): the externally-allowed exec was marked (end-cap abstains); the externally-denied exec was NEVER marked (end-cap still denies it with the stable reason) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G3: static allow + a THROWING facts provider -> fail closed (deny, zero execution, the fault reason is surfaced; zero control rows) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G4: static allow + a permissive host -> the existing success path is unchanged (one execution, zero control rows); the live probe IS consulted on the allow path; an unsupported tool pass-through never probes 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G5: ask allow + external tighten after the decision -> zero execution, the guard verdict is external-policy, ZERO allow consumption, and NO new durable control rows (the recheck is read-only) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G6: the surviving one-shot (zero consumption pays off): re-presentation under the tightened policy blocks AGAIN without consumption; after the host relaxes the SAME approval executes EXACTLY ONCE (the consumption row appears exactly then); the next re-presentation is allow-consumed (scope/fingerprint identity + exactly-once preserved) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G7: a HUMAN allow cannot beat the external hard at the last mile: the guard blocks with external-policy, the one-shot is NOT consumed, and the durable decision stays a plain human allow (no new decision row, no reason minted) 0ms
 ✓ packages/runtime/test/a2c4-external-lastmile.test.ts > A2C-4 GREEN acceptance — the external hard last-mile recheck (plan §6.5) > G8: the shared read-only check semantics: hard deny / allow-list (named vs unlisted) / capabilityExists:false / absent cell / explicit domain / no-cell-not-probed / thrown probe / malformed domain / tools derivation — all fail closed, never throw, and the check writes ZERO durable rows 0ms

 Test Files  2 passed (2)
      Tests  17 passed (17)
   Start at  09:36:50
   Duration  1.05s (transform 1.39s, setup 0ms, import 1.86s, tests 6ms, environment 0ms)
```

（注：R1/R2 的 "gap" 字样是历史 RED 探针的**命名**；其断言体（`a2c4-external-lastmile.test.ts:959-985`）已钉住修复后行为：`phaseBDecision.kind==='deny'`、`phaseBExecuted===0`、`verdictReason===EXTERNAL_POLICY`、`consumptions===0`。）

## 7. 结论区

- **映射澄清清单（撤回）**：C1 → 撤回（Alpha.4 引文 = 建模范围声明，非存在/放行声明）；C2 → 撤回（"beyond Team Hard" ≠ "beyond External Hard"，两侧对象不同）；C3 → 撤回冲突判定，落为 §2 映射结论（`teamHardEnvelope` ↔ teamHardDeny/Team-autonomy 族 = Human 可越；externalHard ↔ `ExternalPolicyFacts` lane = 执行面强制；阶梯内无对应物）。
- **剩余冲突（且仅一条）R-1**：Alpha.5 `plan:86` "禁止批准包含确定 deny/undetermined Effect 的请求。" + `architecture.md:181` "An unknown authority or definite denial refuses the whole invocation" 中的 "确定 deny / definite denial" **是否涵盖 `teamHardEnvelope`（bound Envelope）的 deny**——狭义读（policy/expansion 平面 + undetermined）与 Alpha.4 相容；广义读直撞 Alpha.4 spec `:1102` 的 forbidden。层级：Alpha.5 侧 = 未来阶段备忘（其 `ADR:63` 自述须上交裁决）；Alpha.4 侧 = active 当期权威；冻结基线对该阶梯问题未述（其 hard 只指 externalHard）。→ 交用户按 precedence 裁决。
- **P2 可达性终判：不成立**（附探针原文 §4 + 附录 B/C）：PR2 kernel 无外部事实输入位且 DORMANT；外部硬形状经 policy 面即终局拒（ARM B2）；live 执行面 G1/G2/G3 三道外部闸（两道在批准后）17/17 实测不可穿透；admin leg 今日被 G8 挡住。P1 成立（外部事实不在 ceiling 平面 = 规定性分工，另层承担），P1 成立而 P2 不成立即本轮终局结论。
