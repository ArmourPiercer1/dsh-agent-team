# PR0 独立 Review — PR #252 `alpha5-pr0-contracts` @ `ac6b720f`

- **Reviewer**: Alpha.5 PR0 独立 reviewer（≠实现者；模型 `qwen3.8-flash-next`，powered-by 逐字；独立会话，未参与实现）
- **审查对象**: PR #252 head `ac6b720f86bb7e2d493d4c8d18064ddc026ec35a`（stacked on #251 `96ea3cad`；单提交，diff 面 22 文件）
- **语义权威**: `post-poc-technical-design.md` §2.1/§4.1/§4.2/§5/§8；`alpha5-s0-pr0-pr8-implementation-plan.md` §0.6/§3；Alpha.4 `domain/authority-envelope`（ADR A1-4/A3-9）
- **复现方式**: worktree `.worktrees/a5-pr0` 实跑（见 §7），只读取证，未 merge、未 push（除本审查件）

## 总判定：**PASS**（0 BLOCKER / 0 MAJOR / 4 MINOR + INFO 若干）

依据 ROUTER_RULES §3.2 三值口径：所有关键声明经独立复现成立，无扩权路径、无 DORMANT 违例、无 v3 触碰、无 baseline 漂移。MINOR 均不阻断合并；M-1 为收尾义务（证据入库），M-2/M-3 为冻结面诚实性建议，M-4 为类型面收紧建议。

---

## 1. 授权代数纯度 — PASS

- **默认全拒 / deny 优先**：策略文档是唯一权威来源，无匹配即 `no-authority`（[planes.ts:148-159](../../../../../packages/domain/tool-governance/src/planes.ts#L148) → [authority-envelope.ts:409](../../../../../packages/domain/authority-envelope/src/authority-envelope.ts#L409)）；`deny < ask < allow` 由共享 rank 表支配（[authority-envelope.ts:71](../../../../../packages/domain/authority-envelope/src/authority-envelope.ts#L71)），meet 表 `undetermined` 吸收（authority-envelope.ts:313-329）。matcher 语法**无 `any`**，测试钉死（[a5p0-schema-negatives.test.ts:290-297](../../../../../packages/domain/test/a5p0-schema-negatives.test.ts#L290)）。
- **隐式扩权路径 = 无**：所有解析器 closed-shape（`unknown-field` 拒收，[parse-util.ts:66-77](../../../../../packages/domain/tool-governance/src/parse-util.ts#L66)），无默认值注入：`expiresAt: null` 显式表"无到期"而非 0（[grant.ts:53-54](../../../../../packages/domain/tool-governance/src/grant.ts#L53)）； assurance 缺维度直接拒收、不隐式 `untested`（[assurance.ts:105-108](../../../../../packages/domain/tool-governance/src/assurance.ts#L105)）；`singleUse` 必须字面 `true`（[grant.ts:196-198](../../../../../packages/domain/tool-governance/src/grant.ts#L196)）。`hard` 需求只被 `enforced` 满足、`partial/unsupported/untested` 永不满足（[assurance.ts:139](../../../../../packages/domain/tool-governance/src/assurance.ts#L139)）→ 设计 §1.4 "Assurance 不是第二组开关" 成立。
- **不可变性**：所有成功解析经 `finish → deepFreezeContracts` 深冻（[parse-util.ts:158-171](../../../../../packages/domain/tool-governance/src/parse-util.ts#L158)）；`ToolBinding/ResourceRef/RequestedEffectSet/OperationGrant/ExecutionLease` 输出皆深冻（测试实证 [a5p0-contracts.test.ts:179,213](../../../../../packages/domain/test/a5p0-contracts.test.ts#L179)）；状态推进（binding/lease）全部返回新建冻结对象，无 setter、无原地改写（binding.ts:169、lease.ts:195,218）。审查中曾疑 `openExecutionLease` 浅冻（lease.ts:107 `Object.freeze`）——**证伪**：其外层即 `finish`，深冻在位。
- **canonical fingerprint**：镜像 = contracts `canonicalJsonStringify` 逐行同构（CODE-UNIT 键序、数组保序、非无损 JSON 抛错；对照 [canonical-json.ts:54-63](../../../../../packages/domain/tool-governance/src/canonical-json.ts#L54) ↔ contracts/src/remote-safe.ts:151-160）；hash 用域内既有纯 `sha256Hex`（blueprint/src/hash.ts，先例 = runtime canonical-operation）。
- **冲突/稳定性测试真实且非恒真**：键序无关（fingerprint-negatives:28-33）、数组序敏感（35-37）、ABSENCE 携带不被默认替换（39-45，三向断言 `omit/null/2000` 互异）、隐藏参数不可忽略（77-88，额外 key 改 digest）、Realm 不可混淆 + 跨 realm 子集拒收（91-109）、read→write 右扩非子集（123-132）。全部为不同输入产不同 digest 的判别断言，无恒真式。

**条款映射**：plan §3 "Canonical Fingerprint 的稳定性与冲突、隐藏参数不可忽略、资源 Realm 不可混淆、复合 Effect 去重顺序、不可变快照" ✓；design §4.2 类型清单逐字段在位 ✓。

## 2. 双平面差异 — 判定：**语义未坍缩，复用是设计要求的复用**（审查重点，结论=通过侧）

实现者自述 "EFFECT_RANK 与 AUTHORITY_EFFECT_PRECEDENCE 同一冻结对象（toBe）"（[planes.ts:50](../../../../../packages/domain/tool-governance/src/planes.ts#L50)，[a5p0-planes.test.ts:62-68](../../../../../packages/domain/test/a5p0-planes.test.ts#L62)）。判定：

1. 同一对象只是 **rank 表**（deny<ask<allow 的序），设计 §1.3 本身要求"复用 Alpha.4 `deny < ask < allow`"——共享它正是"严禁另建不同语义的权限台账"（design §4.2）的正解；若复制表才是违规。
2. **no-match 语义在两条独立函数**：`evaluateToolPolicyExpansionAuthority` → `effectiveAuthorityCeiling`（no-match ⇒ `no-authority`，[planes.ts:143-159](../../../../../packages/domain/tool-governance/src/planes.ts#L143)）与 `evaluateToolPolicyApprovalNarrowing` → `narrowingForApproval`（no-match ⇒ **identity/allow**，即 no-narrowing，[planes.ts:161-179](../../../../../packages/domain/tool-governance/src/planes.ts#L161)），分别委托 kernel 的两个不同出口（authority-envelope.ts:409-455，两条 switch 的 no-match 臂各自返回 `CEILING_NO_AUTHORITY` / `CEILING_IDENTITY`）。
3. **表驱动测试覆盖两向**：6 行规则表每行同时跑两平面，no-match 行断言 expansion=`no-authority` 而 approval=`decided/allow`（[a5p0-planes.test.ts:99-141](../../../../../packages/domain/test/a5p0-planes.test.ts#L99)）；匹配行断言两平面一致（85-92）；另有与 kernel 原函数的 rule-for-rule 等值交叉核对（178-199）与 Realm 隔离行（165-176：realm-B 的 deny 在 realm-A 既不授权也不收窄，在自己的 realm 内生效）。
4. Realm 维度是**前置 scope 过滤**（[planes.ts:135-141](../../../../../packages/domain/tool-governance/src/planes.ts#L135)）：异 realm 规则"匹配不到任何东西"，随后原样进共享 walk——不是第二 lattice，也不触碰 A1-6（realm 是闭集身份字段，非"相关性猜测"）。

按审查指令的分级标准（no-match 处理分离 + 表驱动两向覆盖 ⇒ 至多 MINOR）：此处连 MINOR 都不构成——判 **语义保持为两条独立规则，通过**。

## 3. Realm/Grant/Lease — PASS

- **kind 未塌成裸 string**：`RESOURCE_KINDS` 6 值闭集 + kind↔rights 闭矩阵（[resource.ts:66-73](../../../../../packages/domain/tool-governance/src/resource.ts#L66)）；locator 规则按 kind 分治（workspace 相对 / realm-home `~/` / absolute-path 绝对、`..` 全拒、空白保留、scheme 只属于目的地，resource.ts:88-125）；effect↔resource 强耦合（`list`→directory、`connect`→destination、`read` 永不见 metadata-only，[effects.ts:122-131](../../../../../packages/domain/tool-governance/src/effects.ts#L122) + schema-negatives:193-252）。
- **Grant 一次性/盗用/过期**：重放拒收（ledger view，[a5p0-grant-replay.test.ts:82-86](../../../../../packages/domain/test/a5p0-grant-replay.test.ts#L82)）、跨 Member 拒（117-121）、authority generation 陈旧拒（95-99）、wall-clock 到期拒且 `null`≠0（100-108）、binding revision 漂移拒（109-113）、参数指纹漂移拒（127-131）、超集 effect 拒（135-148）、跨 realm effect 拒（149-158）。校验优先序显式声明且消费判定最后（grant.ts:117-145），无第二 ApprovalCase、无持久化（consumption 是注入的只读 view，PR0 不写）。
- **Lease 不扩 Grant，无 widen 路径**：构造双检（scope 与 grant.effects 双向子集 + fingerprint 全等，[lease.ts:72-106](../../../../../packages/domain/tool-governance/src/lease.ts#L72)）；解析锚定 `scope.fingerprint === grantFingerprint`（lease.ts:159-169，测试 [a5p0-contracts.test.ts:327-349](../../../../../packages/domain/test/a5p0-contracts.test.ts#L327)）；类型面 `ExecutionLease.scope: RequestedEffectSet` 无放宽出口；`terminated` 吸收态、`cancel requested ≠ terminated`、未先请求取消不得以 `confirmed:false` 结算（lease.ts:188-218），`termination-unconfirmed` ↔ `EXECUTION_TERMINATION_UNCONFIRMED` 语义接通（lease.ts:14-18 + errors.ts:44-48 `sideEffectUnknown` 一等字段）。

**INFO（不分级）**：策略 matcher 面（realm+effectKind+locator 字符串）不含 ResourceKind 维度——kind 在 effect identity/grant containment 层保留并参与指纹，但同 realm 同 locator 跨 kind（如 directory `src` vs workspace-file `src` 的 `meta`）在策略文档上不可分辨；字符串形态学使 workspace/realm-home/absolute 天然不相交，残余面窄且 fail-closed 方向。建议 PR2 决定是否给 `ToolPolicyRule` 增 kind 字段，并显式记录该裁决。

## 4. DORMANT 证据 — PASS

- 审计脚本实查三事（[audit-a5-tool-governance-imports.mjs](../../../../../scripts/audit-a5-tool-governance-imports.mjs)）：①lane 纯度（禁 `node:*`、禁裸 specifier、跨层边只放行 authority-envelope 与 blueprint/hash 两个登记叶，:98-126）；②全图无环（:130-147）；③**零生产消费者**：扫 `packages/**` 全部 shipped `.ts`（跳过 `test/`、`*.test.ts`、`node_modules`、`dist*`），任何文件内容出现 `tool-governance` 即 finding（:149-165）。非恒真保证：laneFiles/edgeCount 下限 pin（[a5p0-layer-audit.test.ts:32-35](../../../../../packages/domain/test/a5p0-layer-audit.test.ts#L32)）+ 测试侧独立注释剥离再核（:37-75）。
- **独立复核（不经脚本）**：全仓 grep `tool-governance` ⇒ 命中仅 1 脚本 + 8 个 `.test.ts`（p4t6/a3p3/a5p0×6），**shipped 源文件零命中**。"export 但无 import = 合格 DORMANT" 对纯类型 lane 成立，且 v3/schema/UI/存储零变化的另一半由 diff 面证明（下条）。
- **v3 确未触**：`git diff 96ea3cad..ac6b720f` 非 lane 面只有 4 文件（domain/tsconfig.json 的 include 条目、a3p3 与 p4t6 两个台账测试的加性修正、审计脚本）；`packages/contracts`、`packages/domain/blueprint` diff 为空。Blueprint v3 closed 声明（design §8）成立。
- 两个台账修正核阅为**加性、非弱化**：p4t6 走其文档化程序（18 文件具名 + 双 endpoint 实测 1048→1066 + 逐路径在场断言，[p4t6-session-event-scan.test.ts diff]）；a3p3 仅把 `planes.ts` 加进两个 plane 函数的 importer 允许名单（组合者身份，未从任何名单删除项）。

**MINOR M-4**：消费者扫描跳过**任意深度**名为 `test` 的目录且只看 `.ts`（audit 脚本 :155,:160）——藏在 `src/test/` 下的 shipped 消费者或经 shipped 非-.ts 源的引用可绕过该单脚本；现实中 p4t6 全量扫描 + check:artifacts + 逐 PR review 兜底，属纵深建议（把 skip 收窄到 `packages/*/test` 并覆盖 .mjs/.js 源）。

## 5. baseline-diff 复核 — PASS（数字、身份、归因全部独立复现）

- 复现物：worktree 内 `.baseline-test.json`（**树 = base `96ea3cad`、0 tracked 文件改动**，见 `.baseline-test.log` 头部披露）与 `.final-test.json`（head）。程序化集合差：**24 → 22，NEW=0，GONE=2**，与声明一致。
- **GONE=2 归因成立（非 diff 掩盖）**：两条都是 `packages/testkit/test/a4p7-merge-gate.test.ts` 的 client lane 腿（该文件本 PR 未改）；root 套件新出现的 80 个测试全部来自 `packages/client/test/*`（50+22+6+2=80，`numTotalTests 6419→6593 = 94 lane + 80 client` 精确闭合）——client `node_modules` 就位后 collectible；本审查独立验证 client 测试现可运行通过（client.test.ts 2/2），且 `.client-errors-base.txt` 与 `.client-errors-current.txt` 逐行相同（client 错误面未被本 diff 移动）。共同测试的状态漂移 = 恰这 2 条 failed→passed，其余零漂移。
- **抽 3 条 22 失败身份确认在基线**：`.baseline-test.json`（base 树实跑）含全部 22 条；且既有台账（SESSION_ROUTER_LOG Alpha.3 收口/H3 稳定债务条目、本分支 log :5181 的 24/23/25/24/23 抖动实测）逐名在册——抽样签名实证为环境性/预存债务：`t2-blueprint-hash`（hashable-projection 预存 1F）、`rc2-kit-preset-seam`（`expected '0.1.7-rc.1' to contain '0.2.0-rc.2'` = test-use 宿主 checkout 滞后）、`rc2-persona-probe`（ENOENT 指向**主 worktree** 路径 = 跨树环境依赖）。三者所在文件均不在 22 文件 diff 面内，字节级与 base 相同，本 PR 无因果面。

**MINOR M-1（收尾义务）**：上述证据件（baseline/final JSON+log、client-errors、RED run#1 记录）目前**untracked 在 worktree 根**，分支上不存在；plan §0.6 要求"基线测试失败身份集合"等与 Base/HEAD **同时留痕**，RED-first（run#1 collection 失败×6）亦只能依赖这些未入库日志（单提交分支无 RED 历史可考）。收尾提交必须把它们与本体审查件一起落 `dev/agent-workflow/evidence/alpha5/pr0/`（纯文档性补充，不计实质性次数）。

## 6. 冻结接口 / 错误码对合 — PASS

- plan §3 接口冻结点逐名：**`OperationAdmission`**（interfaces.ts:66）、**`ControlledFs`**（:107）、**`ConfinedProcessProvider`**（:155）、**`ProviderGateway`**（:196）、**Result/Error contracts** = `GovernanceResult`/`GovernanceError`（errors.ts:39-55）——全部在位且从 barrel 导出（index.ts:99-120），并有编译期负例腿（`@ts-expect-error` 群，a5p0-contracts.test.ts:372-404）。
- 类型面纪律与声明一致：admission 无"先跑后决"臂；grant-per-call 参数化（无共享 currentGrant）；`spawn` 无"裸跑"可表达面；Domain 否决独立回程（`DomainVeto`）。
- **错误码 8 枚与设计 §5 逐字**：`TOOL_BINDING_UNVERIFIED, TEAM_TOOL_UNGOVERNED, APPROVAL_STALE, IO_POLICY_UNSUPPORTED, SANDBOX_UNAVAILABLE, ADAPTER_DRAINING, DOMAIN_DENIED, EXECUTION_TERMINATION_UNCONFIRMED`（errors.ts:24-33 测试逐字钉 [a5p0-contracts.test.ts:158-171](../../../../../packages/domain/test/a5p0-contracts.test.ts#L158)），恰 8、拼写含 `ADAPTER_DRAINING` 逐符核对设计原文一致。
- plan §3 契约记录六名 `ToolBinding/ResourceRef/RequestedEffectSet/OperationGrant/ExecutionLease/AssuranceContract` + 三独立维度（origin/boundary/assurance-level-per-dimension）全部在位；`executionBoundary` 三元组与 `native/custom/shadow-run` 禁用（schema-negatives:142-158 实证旧词汇拒收）。

**MINOR M-2（冻结面诚实性）**：design §2.1 要求 per-dimension assurance 记录"机制、作用 Realm、可信根、证据**与** 等级"；冻结的 `AssuranceContract` 只携带等级（assurance.ts:70-74），机制/Realm/可信根/证据仅剩 `ProcessCapability.note` 自由字符串（interfaces.ts:128-132）。这是 PR3/PR4 并行的**冻结点**——后续补字段=接口变更。要么现在补，要么在 interfaces.ts 文件头显式记录"§2.1 evidence 维度延后至 PR4 SPI"的裁决。
**MINOR M-3（类型收紧）**：`grantRefusalErrorCode` 返回裸 `string`（grant.ts:79-94），未用 errors.ts 的 `GovernanceErrorCode` 联合——冻结映射表若手滑打错码名，typecheck 不拦。一行之改，建议随 PR2 前落地。

## 7. 独立复现记录（本审查实跑，非引用实现者摘要）

| 项 | 结果 |
| --- | --- |
| 6 个 a5p0 spec | **94/94 绿**（19+14+18+29+11+3） |
| `pnpm -r typecheck` | **exit 0**；lane 12 文件确认在 typecheck program 内（`tsc --listFiles`） |
| `node scripts/audit-a5-tool-governance-imports.mjs` | exit 0："12 lane files, 44 edges"，OK |
| p4t6 台账套件 | 10/10 绿（1066 端点闭合） |
| a3p3 hygiene 套件 | 21/21 绿（planes.ts 允许名单修正有效且未弱化） |
| 全仓 `tool-governance` 引用 grep | shipped 源零命中（仅脚本+测试） |
| diff 面核对 | contracts/blueprint 零字节；非 lane 面仅 4 文件 |
| baseline/final JSON 集合差 | 24→22、NEW=0、GONE=2、+174=94+80、共同测试零漂移 |
| 3 条失败签名抽样 | 均为环境性/预存债务（见 §5） |

## 8. 分级汇总

| 级别 | # | 位置 | 摘要 |
| --- | --- | --- | --- |
| BLOCKER | — | — | 无 |
| MAJOR | — | — | 无（双平面判定=未坍缩，§2） |
| MINOR | M-1 | worktree 根 untracked 证据件 | baseline/final/RED 日志未入库；收尾提交须落 `evidence/alpha5/pr0/`（plan §0.6；文档性） |
| MINOR | M-2 | assurance.ts:70-74 / interfaces.ts:128-132 | §2.1 evidence/mechanism/realm/trust-root 字段未入冻结面或显式记录延后裁决 |
| MINOR | M-3 | grant.ts:79-94 | `grantRefusalErrorCode` 返回 `string` 而非 `GovernanceErrorCode` 联合 |
| MINOR | M-4 | audit 脚本 :155,:160 | DORMANT 消费者扫描 skip 任意深度 `test/` 且仅 .ts；纵深收窄建议 |
| INFO | I-1 | grant.ts:86 | `effect-outside-grant → TOOL_BINDING_UNVERIFIED` 的映射语义可在 PR2 前复议（候选 APPROVAL_STALE？） |
| INFO | I-2 | planes.ts:56-73 | 策略 matcher 无 kind 维度（§3 INFO），PR2 记录裁决 |
| INFO | I-3 | parse-util.ts:122 | `closedValue` lane 内未用（内部死辅助，无 barrel 暴露） |

## 9. 对 PR #252 合并门的抽查建议（供用户/parent）

1. 亲自跑 `node scripts/audit-a5-tool-governance-imports.mjs` + 全仓 grep `tool-governance`（30 秒即复核 DORMANT）。
2. 开读 `packages/domain/test/a5p0-planes.test.ts` 的 no-match 行 + 交叉核对段，确认双平面独立性裁决（本审查最高风险项即此项）。
3. 合并前确认收尾提交已把 `.baseline-test.json/.final-test.json/.baseline-test.log/.final-test.log/.client-errors-*.txt` 与 RED run#1 记录入库（M-1），否则 §0.6 留痕断链。
4. 就 M-2（assurance evidence 字段）与 I-1（effect-outside-grant 错误码映射）在 PR2 冻结前给一句裁决——两者都是"晚改=接口变更"型决定。
