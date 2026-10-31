# LEG-SEMANTICS-INVESTIGATION — A/B 双行语义、B 行合法裁决契约、甲/乙裁决（bw7 `read_image` allow→deny）（dated 2026-10-31T02:01Z）

- 席位：workflow C 工程基线独立调查席（零 boot、只读主仓/其他 worktree、除本文件外零写入、不碰 :3080/宿主树）。
- 分支/HEAD：`task/a5w-bwlegs-20261031` @ `8e497e900b7e14309fcb017dcdc16b386a91d12c`（本文件为唯一新增）。
- 法源：`docs/ROUTER_RULES.md` §0/§8、`docs/TEST_METHODS.md` §2/§5（会话首读）；代码 = 本仓 `packages/**`（插件层），宿主 = pristine `tests/deepseek-harness-test-use` @ `639ed01539`（0.2.0-rc.2）。
- 证据：`dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/run-bw7.json`（runId `u5-u7r3-bootwave-bw7-2026-10-31T01-34-09-672Z`，productHead `efbbeb2b5aa0c78710a71a6b2ca022f501b8a4d4`，hostHead `639ed01539…`，port 3181，`bootwaveRun.dateUtc=2026-10-31T01:34:12.936Z`）。世界 `tests/homes/u5bw7-20261031T01-34-09Z` **已回收** → 账本 payload 不可再读（见 §7）。
- 体例：先证据（file:line / row-id），后法源；无引证处显式标 **UNPROVEN**。

---

## 0. 结论速览

**裁决 = 乙（产品缺陷）**，位置在本仓插件层（非 CORE，**不产生 `CORE_SEAM_BLOCKER`**）。

一句话根因：PA→Control 桥的 **resolve/guard 时校验器**在重新推导权限时调用纯核函数**不传 `SubtreeContains` seam**，而本世界 `read_image` 的 ask 规则是 `kind: subtree` —— 无 seam 的 subtree 覆盖判定 = `undeterminable` → 整 scope `undetermined` → 展开面 `unapprovable` → 校验器判 `drift` → 控制服务把这条 v4 allow **改记为持久 DENY 并以成功 resolve 返回**（`ok:true`）。`ask_user_question` 逃过一劫，因为它的世界**没有任何规则**且其效果集**不含文件类效果**，subtree 分支永不被咨询。

一句话修正：把该世界**已经装配好的同一个** seam 谓词（`a5PlaneSubtreeContains`）接到校验器的三处纯核调用上（`pa-control-bridge.ts:773` / `:783-794` / `:837-851`），seam 缺位仍 fail-closed。

---

## 1. 证据基线（bw7 全行；引用点 = `run-bw7.json`）

| 行（requestId 前缀，全 id 见 resolutions） | 形状 | suite 发号 | 账本终值 | consumed | 执行器后果 |
| --- | --- | --- | --- | --- | --- |
| `ctrl-08pl1ft0xvpyxk1j4r9bz088` | A（调用指纹） | allow（via=call, HTTP 200 ok） | **allow** | **是** | 放行至执行器 |
| `ctrl-0wpn9i00y2p0pb0t6n3iq0j6` | B（`PA ask case=…`） | allow（via=case-after-call, 200 ok） | **deny** | 否 | `governed-image pa-refused code=APPROVAL_DENIED detail=durable Control request ctrl-0wpn… answered deny` |
| `ctrl-0144kpx1xuirho0f076un0ql` | A | deny | deny | — | 该调用**只有这一行**（见下更正） |
| `ctrl-0j7x7ht1qk4kbk0dsak0z0pf` | A | allow | allow | **是** | 放行至执行器 |
| `ctrl-08huqe60f2pkid126ywo017x` | B | allow | **deny** | 否 | 第二条 `pa-refused … ctrl-08hu… answered deny` |
| `ctrl-1gmc3a50tt9ej809ig60j0f3` | B（ask） | allow | **allow** | **是** | `u7f-ask: governed-ask RAN answers=1` |

- 行的完整 summary（字节）：A = `read_image <abs path>`；B(image) = `PA ask case=tadm:session-bootwave-team-u5bw7-20261031t01-34-09z:inst-0egqwar129qh:sha256:303972e2…5534fa:g0 rung=leader tool=read_image effects=3`（第二行 `sha256:10a7e57f…3807e`）；B(ask) = `…inst-1xanuvg1igxl:sha256:ac507b38…8d059:g0 rung=leader tool=ask_user_question effects=2`。
- 实例：imgov=`inst-0egqwar129qh`，uigov=`inst-1xanuvg1igxl`（`bootwaveDecideFacts.ids`）。
- 通知字节（`bootwaveDecideFacts.trace[21]` = A 行；`trace[47]`/`trace[88]` = B(image)；`trace[134]` = B(ask)）：**A 行通知含 `approvalCase: case-… / leg: 1 / reviewAuthority: leader`；B 行通知无这三项**，且都指示 "Decide with `team_resolve_control` using this EXACT requestId and a `decision` of `allow` or `deny`"。
- 对 RCA-7 的一处更正（事实而非判断）：RCA-7 写 "deny 调用两行全 deny"。bw7 图像行共 **5** 行（3×A + 2×B），被 deny 的那次调用**只铸了 A 行**（`ctrl-0144kpx1xui…`）——因为 A 行被 deny 后执行器根本不运行，桥不会被走到（见 §2 串联关系）。两条 `pa-refused` 属于两条**发 allow** 的 B 行。

---

## 2. 答问一：两道门各铸哪一行；A 的 allow-consumed 消耗了什么、B 的授予是什么

**门 1（内核准入 / 宿主工具管线）铸 A。**
`packages/runtime/operation-permission/pre-execute-adapter.ts:1905` `controlService.requestApprovalLeg({...})`；summary 组装 `:1795-1801`（`${name} ${operation.resource.display}` → 证据里的 `read_image /…/bootwave-good.png`）。该文件**通篇不出现 `reviewPayload`**（grep 证实）⇒ A 行是 **v3 case leg，无 PA manifest**。
消耗点：`pre-execute-adapter.ts:2130` `controlService.guardOperation(...)` → 写 `control-allow-consumed`（fact 名常量 `packages/runtime/control/service.ts:300`）。

**门 2（执行器 PA 边 → 冻结 A 的桥）铸 B。**
`packages/runtime/operation-permission/pa-control-bridge.ts:397-424` `controlService.requestControl({kind, operationFingerprint: digest, summary: \`PA ask case=${plan.approvalCaseId} rung=${plan.requiredAuthority} tool=${toolName} effects=${n}\`, reviewPayload: manifest, reviewPayloadDigest: digest})`；manifest 组装在 `:378-393`（严格 effect-set 清单，与 `service.ts:2280-2326` 写侧指纹法成对）。桥本身由 `packages/runtime/src/plugin/live/agent-bindings.mjs:2779-2785` 构造（`caller:{kind:'instance',instanceId}`、`beneficiaryAuthority: member`）。

**串联与"消耗"语义：**
1. A 允许 ⇒ 宿主管线放行 ⇒ 执行器（`packages/tools/fs-family/src/image-executor.mjs`）才跑 ⇒ `pa(call)` 才把 B 行铸出来。A 被 deny ⇒ 无 B 行（§1 更正的机制解释）。
2. **A 的 `control-allow-consumed` 只消耗 A 自身**（"这一次调用可进入执行器"）；它对 B 行的授予**零贡献**。B 行是**独立的第二份授予**：桥在 allow 之后还要过 A1-14 阶梯复检（`pa-control-bridge.ts:497-516`）与自身消耗（obligation 6）。
3. 两行不同 case：A = `case-…`（内核路由 case），B = `tadm:<root>:<inst>:sha256:<fp>:g<gen>`（`packages/runtime/tool-admission/approval-case.ts:229-236`）。

**结构不对称①（为何两道门结局不同）：** 控制服务的 resolve 时 PA 门**只对携带 PA manifest 的行生效** —— `service.ts:2741` `paManifestClassOf(request.payload)`：A 行 ⇒ `not-effect-set` ⇒ 整块校验跳过 ⇒ allow 直落 `service.ts:2773-2780`（正常提交并被消耗）；B 行 ⇒ `valid` ⇒ 每次 allow 都必须过全-Effects 校验器。

---

## 3. 答问二：B 行的合法对外裁决契约，以及把 allow 变成记账 deny 的那一行

### 3.1 入口、词表、v4 词映射
- 唯一公共入口 = 契约 v4 的 `team.resolveControl`（人类 ingress；`tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs:67` "only remote control command is v4 `team.resolveControl`"）。
- 词表封闭：`decision: 'allow' | 'deny'`（`packages/runtime/src/plugin/s6-remote.ts:2290-2312`）——**没有 `approve` 这个词**；v4 词到持久决策值是恒等映射：`packages/runtime/src/plugin/root.ts:3718-3726` 原样传给 `control.resolveControl`，再落到 `service.ts:2773-2780`（`allow`→`CONTROL_DECISION_VALUES.ALLOW`）。
- 裁决者身份由**宿主推导**：v4 wire 不带 caller/role 字段（`root.ts:3709-3717` 注释）⇒ 被寻址 root 的操作者 = `human`。
- 可裁决身份表：`packages/runtime/control/types.ts:193-197` `CONTROL_RESOLVER_ROLES['leader-approval'] = ['leader','human']`；B 行 kind 由受益方推出（`pa-control-bridge.ts:317-320`：beneficiary=member ⇒ `leader-approval`；挂载侧 `agent-bindings.mjs:2783`）。rung 由 decider 推出（`pa-control-bridge.ts:273-279`：human→`human-user`，instance/leader→`leader`），阶梯法 `packages/runtime/governance/authority-ceiling.ts:512-521`（`reviewerRank > beneficiaryRank && reviewerRank >= requiredRank`）。
- 结论：**bw7 的裁决身份完全合法**（human ⇒ `human-user` > `member` 且 ≥ 所需 `leader`；两次 allow 均 HTTP 200 `ok:true` 即为 role 门通过的实证）。失败点不在身份。

### 3.2 把 allow 记成 deny 的确切代码行
`packages/runtime/control/service.ts:2741-2772`（在 per-team 锁内，resolve 路径）：

- `:2741` `if (args.decision === 'allow') { const paRead = paManifestClassOf(request.payload) … }`
- `:2753-2771` `valid` 分支：`:2754` `const denyReason = await paEffectsDenyReason('resolve', root, requestId, paRead.manifest, callerRefOf(caller))`
- **`:2761-2770`（就是这一行）**：`if (denyReason !== undefined) return await commitDecision({ value: CONTROL_DECISION_VALUES.DENY /* :2764 */, decider: callerRefOf(caller), reason: denyReason /* :2766 */, … })`。
- 因为它是 `return`，RPC **正常完成** ⇒ 套件看到 `ok:true` 而账本记 `decision=deny`（正是 bw7 的 `RES allow` vs `DEC deny`）。
- deny 词映射：`service.ts:3147-3166` `paEffectsDenyReason` —— 校验器 `ok!==true` 且 reason=`pa-authority-drift` ⇒ 决策原因 `PA_AUTHORITY_DRIFT`（`control/types.ts:266`）；其余任何偏差（无 port/抛错/非布尔）⇒ `AUTHORITY_UNDETERMINED`（`control/types.ts:275`）。
- **同一校验器也站在消耗门**：`service.ts:3605`（`recheckConsumedAuthority`）⇒ 即便 resolve 侥幸通过，消耗照样零消耗拒绝。

### 3.3 校验器为何报 drift（完整链，逐行）
1. `pa-control-bridge.ts:773` `expansion = evaluateEffectSetExpansion(facts.effects, facts.realmId, facts.policyDocument)` —— **第 4 参 `subtreeContains` 缺失**；同样缺失：`:783-794` `planEffectSetApproval({...})`、`:837-851` `verifyEffectSetApproval({...})`。整个 `pa-control-bridge.ts` **不出现字符串 `subtreeContains`**（grep 证实）。
2. `packages/runtime/tool-admission/approval-case.ts:181-205`（`evaluateEffectSetExpansion(effects, realmId, policy, subtreeContains?)`）→ `packages/domain/tool-governance/src/planes.ts:148-159` → `packages/domain/authority-envelope/src/authority-envelope.ts:298-316` `matcherCovers`：`kind==='subtree'` 且 `envelope.resource !== target.resource` 且 `subtreeContains === undefined` ⇒ `{covers:false, undeterminable:true}`。
3. `authority-envelope.ts:455-482` `evaluateMatches`：同类规则中**任一**不可判 ⇒ 整 scope `{kind:'undetermined'}`；`:494-508` `effectiveAuthorityCeiling` ⇒ `UNDETERMINED`。
4. 回到 `approval-case.ts:192-194` ⇒ `expansion.unapprovable = {effectIndex, plane:'expansion', …}`。
5. `pa-control-bridge.ts:777-779` `if (expansion.unapprovable !== null) return drifted('the approved set is no longer approvable on the expansion plane …')` ⇒ reason `pa-authority-drift` → §3.2 的 DENY。
6. 执行器侧终音节：`packages/runtime/src/plugin/live/team-tool-plane.mjs:1207` `durable Control request ${leg.requestId} answered ${leg.decision}` → `packages/tools/fs-family/src/image-executor.mjs:207` `governed-image pa-refused …`。ranCount=0。

### 3.4 为什么 image 的 B-allow 变 deny、ask 的 B-allow 却 RAN（结构差，不是身份/顺序差）
- **世界政策差**：imgov 带 subtree ask 规则 —— `tests/world-factory/suites/140-u7r3-bootwave.mjs:298`（`- tool: read_image` / `resource: kind: subtree / path: ${planeRootDir()}`）；uigov **零规则** —— 同文件 `:332`（`allow: [] / ask: [] / deny: []`，`default: ask`）。
- **投影**：`packages/runtime/tool-admission/admission-kernel.ts:703-708` `RESOURCE_EFFECT_KINDS`（`read_image: ['read','meta']`）+ `:960-999`（`:983` `matcher = {kind:'subtree', resource:`${realmId}|${canonical}`}`，`:996-998` 对每个 effectKind 推一条）⇒ 文件类规则以 **subtree matcher** 进入政策文档；`tool-invoke` 臂用 **exact** matcher（`:928`/`:984` `invokeMatcher`），不经 seam。
- **效果集差**：`packages/tools/fs-family/src/image-executor.mjs:157-169` = `[tool-invoke read_image, read <abs>, domain-ref ATTACHMENT_STORE]`（`effects=3`）；`packages/tools/ui-family/src/ask-executor.mjs:126-131` = `[tool-invoke ask_user_question, domain-ref USER_INTERACTION]`（`effects=2`）。
- **判别子（唯一变量）**：效果集里是否含"撞上 subtree 规则的文件类效果"。image 的 `read` 效果 ⇒ 撞 seam 缺位 ⇒ drift；ask 的两类效果（`tool-invoke`/`domain-ref`）在本世界**无任何同类规则**、且 `tool-invoke` 规则本就是 exact ⇒ `matcherCovers` 永不再问 seam ⇒ 重新推导与快照一致 ⇒ allow 落地并被消耗（§1 表）。
- **排除 rung/代次说**：两行 `rung=leader`、同为 `:g0`（§1 字节 summary）⇒ 阶梯与权威代次无差（先前 UNPROVEN 项现由证据关闭）。

### 3.5 已排除的备择解释
- **稀疏/短 `perEffectRequired` 破坏 manifest**：不可能——写侧强制严格解析（`service.ts:2280-2326` 重算 `canonicalJsonFingerprint` 并要求 `operationFingerprint === reviewPayloadDigest`；`packages/runtime/control/types.ts:1117-1124` 要求 `perEffect.length === effects.length` 且每项为合法 rung）。行能存在 ⇒ 它是稠密的。
- **commit-then-throw 两臂**（instance-stale `stale-denied` `service.ts:2658-2693`；external-policy `:2694-2727`）：两者**抛错** ⇒ 不可能给出 `ok:true`。
- **`corrupt` 臂**（`service.ts:2743-2753`，reason=`authority-undetermined`）：要求指纹配对不成立，而写侧强制配对成立 ⇒ 不适用；且它与 §3.2 的 `valid` 臂在外部表征上可分（reason 词），见 §7。

---

## 4. 答问三：今天让 image 的 B 行获批的公开路径 / 升级 / 放弃 / 之后听哪一行

1. **今天的公开路径 = 不存在。** 唯一合法动作就是 bw7 做的：对 B 行**精确 requestId** 用 v4 发 `allow`（产品自己在通知里这样指示：`trace[47]`）。在世界携带 subtree ask 规则的前提下，该动作**必然**被改记 DENY（§3.3 链）；换 decider（leader 身份同样在允许角色表内）、调顺序（先 A 后 B，正是 bw7 的 via=call→case-after-call）、换 note/payload 均不改变结局。**L4（approved-ran）对 subtree 治理下的 `read_image` 当前不可达**——这正是 RCA-4 预言的 "read_image L3/L4 被装配缺口阻塞" 的第二面。
2. **B 行不可升级（leader `team_resolve_control`/escalate 都救不了）。** `requestControl` 未带 `leg:`（`pa-control-bridge.ts:397-424`；leg 字段仅在 `service.ts:2440-2462` `legFieldsOf(args.leg)` 存在时写入）⇒ payload 无 `approvalCaseId`/`legOrdinal`/`reviewAuthority` ⇒ `escalateApprovalLeg` 以 malformed 拒：**"a pre-Alpha.4 row with no approval-case identity — there is no case to rise (escalation requires a leg row)"（`service.ts:4843-4851`）**。字节印证：A 行通知有 `approvalCase/leg/reviewAuthority` 三项，B 行通知没有（§1）。
3. **升级 A 行也救不了本次调用。** 升级写三行：① 原 leg 终局 DENY（`reason=escalated`，`service.ts:4928-4941`）② `control-escalation-recorded`（`:4948-4956`，常量 `:307`，payload 带 `previousRequestId=被升行 id`）③ risen leg（`:4982-5010`：`legOrdinal+1`、`reviewAuthority=successor`、冻结身份；新行的 requestId 就是要监听的新 id，fact 常量 `:296`）——**注意 `writeLegRowLocked`（`:4546-4559`）没有 `reviewPayload` 入参 ⇒ 升上来的 leg 仍无 PA manifest ⇒ 它是 `not-effect-set` 行，其 allow 会被 honor**；若 ladder 之上没有更高裁决者（`mintsRisenLeg=false`）则**不铸 risen leg**，直接返回 `caseOutcome: AUTHORITY_UNAVAILABLE`（`:4975-4980`）。但原 leg 已被记 DENY ⇒ 等待方（内核 `awaitControlDecision`）settle 于 deny ⇒ 调用已死。**升级 = 复核卫生路径，不是让在途调用复活的路径。**
4. **`control-request-abandoned` 的触发条件**：只有 `abandonControlRequest`（`service.ts:2879`，fact 常量 `:303`，封闭 reason `:335-338`）写它，生产唯一调用方是**等待桥的中止级联**：`packages/runtime/action-router/router.ts:576`（wait 以 abort/`CONTROL_REQUEST_ABANDONED` 失败 ⇒ `reason=String(waitError.code)`）与 `:651`（frozen signal 在 settle 后中止 ⇒ `reason='wait-aborted'`）。即：**由请求方调用被取消/实例被杀触发，裁决者永远写不出这行**。bw7 零 abandon 与法一致。
5. **套件应监听哪一行**：**没有第三行可听**。B 行既不可升、也不会被替换；正确的监听集永远是"同一次调用的 A 行 + B 行"两行，两行都 allow 且 B 行被消耗，`ranCount` 才 +1。
6. 附带披露（与缺陷相互独立）：产品通知指示使用 `team_resolve_control`，而本蓝图 leader **依 u7-f-web 之法不持任何控制工具**（`tests/world-factory/suites/140-u7r3-bootwave.mjs:280-282`："NO team_resolve_control / team_list_pending_control: the Human public seam is the ONLY resolver in this record"）⇒ 文案与世界的可用品不一致，属可用性/契约披露项，非本失败原因。

---

## 5. 答问四：甲/乙裁决

### 乙 —— 产品缺陷（成立；且在我们自己的插件层）
命名（全部本仓 `packages/**`）：
- **缺陷点**：`packages/runtime/operation-permission/pa-control-bridge.ts:773`（`evaluateEffectSetExpansion` 少传 seam），同族缺失 `:783-794`（`planEffectSetApproval`）、`:837-851`（`verifyEffectSetApproval`）。
- **为何配置救不了**：校验器依赖集 `PaEffectsVerifierDeps`（`pa-control-bridge.ts:641-670`）只有 `readCallFacts` / `allowFactsInjection` / `onObserve`——**没有 seam 入口**；12 字段调用事实契约（`packages/runtime/src/plugin/live/pa-mount-registry.mjs:296-332`，"the named contract is exactly the 12 fields" 注记在 `:302-305`）里也**没有 seam 成员**。⇒ seam 无法经任何配置抵达，属**结构性装配缺口**。
- **组合现场**：`packages/runtime/src/plugin/root.ts:2357-2369`（`createPaEffectsVerifier({readCallFacts})`，未传 seam、未传 `onObserve`）。
- **同一谓词早已存在于本世界**：`packages/runtime/src/plugin/live/agent-bindings.mjs:2868` `fs: { subtreeContains: a5PlaneSubtreeContains }`（定义与法则 `:773-805`，自述 "THREE CONSUMER FACES, ONE PREDICATE"）；plane 面 `packages/runtime/src/plugin/live/team-tool-plane.mjs:835` / `:1401-1403` / `:1549` / `:1621`；`packages/runtime/src/plugin/permission-plane.ts:242`；`packages/runtime/operation-permission/approval-routing.ts:105/404/701` + `agent-bindings.mjs:3516`（`{ ...facts, subtreeContains: containOverlayKeys }`，注记：a subtree requirement is never answered by a guess）。**RCA-4/#508 的装配修正喂给了三个消费面，漏掉第四个 = Control 侧 resolve/guard 校验器。**
- **非 CORE**：纯核三函数**早已接受** seam 参数（`tool-admission/approval-case.ts:181-205` 第 4 参、`:245-261` opts、`:446-517`），`authority-envelope.ts:301` 亦然；宿主树 pristine @ `639ed01539` 未被涉及 ⇒ **无 `CORE_SEAM_BLOCKER`**（依 AGENTS.md 红线定义：只有需要 upstream patch 才算阻塞）。

### 甲 —— 套件误用（**不成立**，仅余两处证据/文案更正）
- 套件的裁决契约本就正确：v4 `team.resolveControl` + 精确 requestId + 封闭词 `allow|deny`（`tests/world-factory/suites/140-u7r3-bootwave.mjs:1069-1072`），且顺序正确（`decisionFor` `:1026-1048`：先 call 行 `via:'call'`，随后 `PA ask` 行 `via:'case-after-call'`；RCA-5/RCA-6 的同调用同决策律被遵守）。**没有任何 payload/时机改动能让 B 行今天被 honor**（§4.1）。
- **u7-f-web C2 的 resolve 面已足够**：本 HEAD 的 `tests/kits/`（23 项）**不含名为 u7-f-web 的 kit**——u7-f-web 在本 suite 中是**法源引用**（`:31` "the runner plays the Human resolver exactly as u7-f-web / u7r3-uif4 proved"、`:281` "the Human public seam is the ONLY resolver in this record"），其裁决面就是 v4 `team.resolveControl`（封闭词 allow/deny + 精确 requestId），而套件已在用它（`140-u7r3-bootwave.mjs:1069-1072`；同款用法 `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs:1175`、`tests/kits/exec-contract-live-smoke/exec-contract-live-smoke.mjs:891`，两处 allow 都落成 allow）。bw7 里它把 allow 送达（HTTP 200、`ok:true`）——不足只发生在产品把该 allow 改记 deny。**套件无需改 resolve 面，也不存在需要新增的 resolve 面。**
- 两处更正交给协调者/后续 RCA（本席单 commit 不得改他文件）：① RCA-7 "deny 调用两行全 deny" → 实为"deny 调用只铸 A 行一行，两条 `pa-refused` 属于两条 allow 的 B 行"；② RCA-7 的判别子描述可升级为"rung/代次相同，唯一变量 = 效果集是否含撞 subtree 规则的文件类效果"（现由 §1 字节 summary 证实）。

---

## 6. 最小修正清单（全部插件层；修正由协调者按本契约派发，本席未改一码）

1. **传 seam 到三处纯核调用**：`pa-control-bridge.ts:773`（`evaluateEffectSetExpansion` 第 4 实参）、`:783-794`（`planEffectSetApproval` 的 `subtreeContains` 字段）、`:837-851`（`verifyEffectSetApproval` 的 `subtreeContains` 字段）。
2. **把 seam 送进校验器**：扩 `PaEffectsVerifierDeps`（`pa-control-bridge.ts:641-670`，现只有 `readCallFacts` / `allowFactsInjection` / `onObserve`）新增 `subtreeContains`（或 `resolveSubtreeContains(mount)`），在 `root.ts:2357-2369` 组合时注入**同一个** `a5PlaneSubtreeContains`（`agent-bindings.mjs:2868`）。抵达路径二选一，均属我们层内的契约变更（需在 pa-mount-registry 头注留 AUTH 记录）：(a) mount 面暴露 seam（`team-tool-plane.mjs` 挂载面 `:1930-1990` 现只有 `governance`/`assembly`/`realmId`/`livePaPlan`）再经 `publishPaMount`（`agent-bindings.mjs:3225-3260`）传递；(b) 12 字段调用事实契约新增第 13 成员（`pa-mount-registry.mjs:306-332`）。**倾向 (a)**：seam 是 mount/平面局部能力，不是每次调用的事实。
3. **两门一致性由 1+2 自然覆盖**（resolve `service.ts:2754` 与 guard `service.ts:3605` 共用同一 port）；修正后必须同时验 allow 落地**与** `control-allow-consumed` 出现，否则等于只修了半道门。
4. **fail-closed 法不得弱化**：无 seam + 有 subtree 规则仍必须 `undetermined`（`admission-kernel.ts:1005` 的 `TOOL_BINDING_UNVERIFIED` 律与 `authority-envelope.ts:311-315` 保持不动）；修的是"seam 是否可达"，绝不是"猜测覆盖"。
5. **可观测（本轮的元凶级教训）**：`root.ts:2357` 现**不传 `onObserve`** ⇒ `pa-verifier` 的 gate/outcome/detail 从不进实例日志，boot 事后无法点名失败臂。传 `onObserve` → 插件 observations 通道（桥侧 `agent-bindings.mjs:2784` 已有同款用法），或把 `verdict.detail` 带进 resolve 的 note，使账本可自证。
6. **负控制（先红后绿）**：(i) 挂载策略含 subtree ask 规则 + 含 `read` 效果的多效果集 ⇒ 断言 B 行 `control-decision-recorded=allow` + `control-allow-consumed` + 执行器 RAN；(ii) 对偶：抽掉 seam 的世界仍 deny（reason 词应为 `pa-authority-drift`）；(iii) ask 路径零回归（其效果集无文件类效果）。
7. **证据更正**：§5 甲的两处（RCA-7 行计数、判别子表述）。

---

## 7. UNPROVEN / 证据边界

- **账本里的 reason 词与其 detail 全文**：代码推证为 `pa-authority-drift`（§3.2/§3.3 链）。世界 `tests/homes/u5bw7-20261031T01-34-09Z` 已回收（TEST_METHODS §7），且生产校验器未接 `onObserve`（`root.ts:2357`）⇒ 任何 bw7 工件都不含该词 → **UNPROVEN（离线代码推证；须由 §6.5/§6.6 重跑证实）**。
- **drift 落在哪个 effect 索引**：推定 index 1（`read` 效果）撞 `read`/`meta` 类 subtree 规则；`tool-invoke` 臂为 exact matcher（`admission-kernel.ts:928/984`）不经 seam ⇒ **UNPROVEN（索引级）**。
- **`corrupt` 臂 vs `valid`-drift 臂的外部可分性**：两者都会 "allow→记 deny + ok:true"，区分依据是 reason 词与写侧指纹配对法（`service.ts:2280-2326`、`types.ts:1117-1124`）⇒ 索引/reason 级结论同样待重跑闭环。
- **修正后 ask 路径零回归**：结构性推定（无文件类效果 ⇒ seam 永不被咨询），由 §6.6(iii) 证实。
- 本席动作集：只读 + 本文件写入；零 boot、零端口、零宿主树触碰、零套件/产品码改动；EF-05 N/A。
