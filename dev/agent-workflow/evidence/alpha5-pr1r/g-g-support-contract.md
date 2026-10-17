# G-g 支持契约（条款草案）— 静默已订阅通道的排除门：可判定技术证据门

> **状态**：DRAFT 条款草案。起草人 = G-g 起草 owner（PENDING-GATES.md:24，17:54Z 指派：`4dac3d04 起草支持契约条款`；qwen3.8-flash-next）。**落文 = 4d990c89 系文档 writer**；本文件不 commit、不 push，交回协调者转集成。
> **本文件不改变任何既有裁决**：G-a 取消语义裁决（2026-10-16 17:52Z）保持原样；D-1（NO-ABORT-AFTER-BODY-START）延期不受本文影响；G-g 的矩阵定位在本文收口前仍 = **UNSUPPORTED/待证**（PENDING-GATES.md:19）。
> **本轮不跑例**：主检出只读，未新建任何 runs；全部证据为已登记在册的引用。

## 0. 引用基线与路径约定

| 记号 | 含义 |
| --- | --- |
| `[followup]` | 分支 `alpha5-pr1r-followup` @ `c9d30ec4`（PENDING-GATES.md 权威版所在树；`dev/agent-workflow/evidence/alpha5-pr1r/` 目录**不在主检出工作树**，下文该目录路径一律按此分支解释） |
| `[master]` | `origin/master` @ `ae3dcf54`（lane 源文件观察面）。已验证：`install.ts` / `scoped-dispatcher.ts` / `pending-calls.ts` 在 `ae3dcf54` 与 `[followup]` 之间 **diff 为空**，行号两边通用 |
| 事件面 | `handle.observations()`（`[master] packages/runtime/tool-dispatch/install.ts:147` 的 `ScopedGuardHandle.observations`），下文事件名均为该行面原文 |

**证据分级所用的三个既有观察面**（全部公开、可机检，无新权限）：

1. **通道状态** `handle.changeChannelStatus(): 'armed' | 'proven'` — `[master] install.ts:153-156`（`armed`=订阅成功、`proven`=**至少一次真实投递**）；初值 `'armed'` `:403`；翻转点唯一 = `onEvent('tools/change', …)` 回调首行 `changeChannel = 'proven'` `:958-959`；对外读出 `:1174`。
2. **settled-edge 响亮上报** `dispatcher-call-executed-unvalidated`（`severity:'alarm'`、`changeChannel`、`pinned`/`current` 指纹）— `[master] install.ts:762-773`；触发条件 = 该调用带 watch、`!watch.abortedByLane`、且 settled 时指纹已移动。
3. **Binding 降级对** `noteCallEdgeDefinition`（`verified=false` + `unverifiedReason:'definition-drift'`，伴随 `dispatcher-definition-change-at-call-edge` 与 `dispatcher-binding-revised` 事件）— `[master] scoped-dispatcher.ts:351-382`、`:334`；Binding 状态读出 `surface.entryOf(name).verified`（`scoped-dispatcher.ts:211/:221/:306`）。

`verifiedAfter` 语义 = 探针后该名字 Binding 的 `verified` 值（kit 读数 = `handle.dispatcher.surface.entryOf('grep')?.verified`，`[followup] tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs:264/:491`）。

## 1. 判定目标命题（编号；禁止语义扩大）

**范围上界**：只覆盖**已订阅 `tools/change` 通道（`on` 存在且 `subscribe` 未抛错）的静默检测**——"订阅成功但发射不到"这一配置的可观测行为、上报义务与验收定位。
**范围外（逐条排除，不得被本文任何措辞吞入）**：取消范围语义（G-a 已于 17:52Z 裁决，本文不回摆、不改写、不重述其边界——PENDING-GATES.md:14）；已开始 Body 的 abort 属性（D-1 延期项）；provider 卸载自动杀全团队（G-a 边界①）；G-d 各 lane 集成确认；向 Host upstream 的任何外部请求（项目内登记纪律，s12 §(i) 增补）。

| # | 命题（要证明/证伪的**确切技术命题**） |
| --- | --- |
| **P1** | 存在如下可运行配置：`tools/change` 的 `on` 存在、订阅返回合法 disposer、装配 `install.ok && publish.ok`，但该事件**一次也不投递**；且在**装配时刻**其对外可观测形状与一个将会投递的健康订阅**逐字段相同**（含 `changeChannelStatus()==='armed'`）。⇒ 静默配置在装配期不可区分，这是一个**观测命题**，不是能力命题。 |
| **P2** | 在静默配置下，对"已通过 dispatch 门、定义随后被合法 re-register 移动"的在飞调用：**没有任何东西能取消它**——被移动的 Body 实际执行（body 计数 `v2=1`），且 lane 不发 `dispatcher-change-abort-issued`（计数=0）、不发 `dispatcher-call-cancelled-before-body`。⇒ **证伪**"静默通道 = fail-closed"；静默配置的机制降级为名字级。 |
| **P3** | 在静默配置下，每个"已验证定义在飞行中移动"的调用在 settled edge **恰好一条** `dispatcher-call-executed-unvalidated`（`severity:'alarm'`、`changeChannel:'armed'`、`pinned≠current`），且同调用伴随 Binding 降级（`verified=false`，`unverifiedReason='definition-drift'`，事件 `dispatcher-definition-change-at-call-edge`+`dispatcher-binding-revised`）。 |
| **P4** | 在静默配置下，**同一 arm 内完整测得**：被漂移名字在降级后的**下一次调用被拒**（无新 Body），显式 `bindOwnTools` re-bind 后恢复执行（`thirdCallV2=1`、`verifiedAfter=true`）。即 §(j) 允许说法"名字级钉住直到 re-bind"必须在**静默配置自身**里被测量，不得由投递 arm 的结果外推。 |
| **P5** | （**对偶对照**，非重新裁决）通道**确实投递**时，同一注入 ⇒ 在飞未执行调用被取消（`v1=0 v2=0`、Host 原生 `ABORTED_BEFORE_DISPATCH`、`issued≥1`）、下一调用仍拒（`secondCallV2=0`）。本命题**只承担对照观测职责**（确立"投递 vs 静默"的观测对比，供 P2/P3 的分级使用）；其取消语义的验收依据是 G-a 行与既有判据 RW-AFTER-DOOR-BODY-ZERO，本文不改动它。 |
| **P6** | `armed→proven` 跃迁自身可机检：**正向**——订阅处于 armed 后注入一次真实 registry-change，期望恰好一次发射到达 ⇒ `changeChannelStatus()===='proven'`；**反向**——静默 arm 全程（含 run 结束）保持 `'armed'`。两半都必须有**断言**（不是记录字段）。 |
| **P7** | 无误报：静默配置下、定义**未**移动的调用 ⇒ 零 `dispatcher-call-executed-unvalidated`、`verifiedAfter=true`、零取消事件。 |
| **P8** | （**定位条款**）"已订阅但永不投递"配置在支持/验收矩阵中 = **UNSUPPORTED/待证**，直至本契约的 P1–P7 全部达到 §2 定义的收口分级；它**不随 2026-10-16 17:52Z 裁决关闭**（裁决边界②原文）；对外措辞禁则见 §4。条款的机检形式 = §3-G-5 措辞 lint。 |
| **P9** | （**对照条款，非 G-g 子命题**）另一配置——`on` 缺失或订阅抛错——在**装配期**被 typed `IO_POLICY_UNSUPPORTED` 点名 `tools/change` 拒绝（不装弱、不静默降级）。列出仅为钉死"静默 ≠ 拒装"的分界：P9 已证，不能用来给 P1–P4 顶替证据。 |

## 2. 支持证据分级定义与当前分级

### 2.1 分级定义（每级 = 需要哪些可机检观测）

| 级 | 名称 | 收口要求（全部为可机检观测：body/事件计数、状态字段、事件流原文；散文与截图不算） |
| --- | --- | --- |
| **E** | ENFORCE-CONFIRMED | 命题的**完整谓词**已进入常跑断言网（`packages/runtime/test/*.test.ts`，root vitest 套件），且**对偶负控同在断言网内**（同文件控制臂证明观测面失明时该检查必红）；回归即 CI 红。 |
| **D** | DEMO-CONFIRMED | 命题的完整谓词以**钉定 Host 上的 kit 判据**存在（`check()` 判定 + `runs/*.json` 的 `criteria`/`arms` 原文 + PASS/FAIL 日志行 + exit 码），有 RED→GREEN 对偶对或控制臂；但重跑为手动动作、未挂常跑 CI。记录字段≠判据：**未进 `check()` 的字段最高只能记 D 的"记录级"，不得记 E**。 |
| **UR** | UNTESTED-REFUSAL | 该配置的**唯一被支持姿态是拒绝装配**，拒绝本身有 E 或 D 级机检（typed 码 + 点名 + 无残留断言）；配置下的正能力无证据亦**不需要**证据。禁止把 UR 读作"该配置下能力可用"。 |
| **U** | UNSUPPORTED（=待证） | 缺上述任一要素（无断言/无判据/无同配置测量 ⇒ **NO-EVIDENCE**）。该配置/命题在验收矩阵中记 UNSUPPORTED/待证；不得写 supported/closed/fail-closed/compliant。 |

### 2.2 G-g 各子命题当前分级（引用现有 runs 文件/行）

| # | 分级 | 已有证据（原文可复核） | 缺口 |
| --- | --- | --- | --- |
| P1 | **D**（记录级） | `[followup] runs/kit-r1r-fix1/rereg-window.json` → `arms.guarded-after-change-inert`：install/publish 成功（arm 完成即隐含）+ `changeChannel:'armed'`；注入方式=装配后 dispose 已受理的订阅 disposer（kit mjs:322-325 捕获、:425 执行）。单元层 `[followup] packages/runtime/test/a5p1r-change-abort.test.ts:245-251` 已是 E 形状（订阅存在、Host 永不投递、status 保持 armed）。 | Host 级**无独立判据**命名"装配不可区分"⇒ 补 G-1a |
| P2 | **D** + unit 部分 E | 判据 `RW-CHANGE-INERT-LOUD`（kit mjs:582-584：`v2===1 ∧ executedUnvalidated≥1 ∧ changeAbortIssued===0 ∧ channel==='armed' ∧ verifiedAfter===false`）；PASS 行 `[followup] runs/kit-r1r-fix1.log:23`；原文 `runs/kit-r1r-fix1/rereg-window.json`。控制对偶 `RW-CONTROL`（`v1=0 v2=1`，无 lane 时 harness 可见 V2 Body——观测敏感性已证）。unit `:259`（`run.bodies===['V2.grep']`）为 E，但"零 abort 发射"断言仅存在于 kit 谓词（unit inert 腿无 `not.toContain('dispatcher-change-abort-issued')`，对照 `:191` 只在正控腿）。 | kit 判据未挂常跑 CI；unit 腿补 `issued=0` 一行即升 E ⇒ 并入 G-1b |
| P3 | **E**（主字段）+ 事件流 D | unit `:262-267`：`alarms.length===1 ∧ severity==='alarm' ∧ changeChannel==='armed' ∧ entryOf('grep').verified===false`（CI 常跑）。事件流半（`dispatcher-definition-change-at-call-edge` reason=`definition-drift` + `dispatcher-binding-revised`）源在 `[master] scoped-dispatcher.ts:351-382/:334`、kit `laneEvents` 字段有记录，但**无计数断言**。 | 事件流计数断言并入 G-4 谓词组 |
| P4 | **U — 同配置部分 NO-EVIDENCE** | `verified=false` 状态本身有 E（unit `:267`）；但**"后续调用被拒→re-bind 恢复"只在投递配置测过**：RW-AFTER-DOOR-BODY-ZERO `secondCallV2=0`（kit mjs:551-554；`runs/kit-r1r-fix1.log:16`）、MCP re-bind 腿（kit mjs:577-580；unit `:449`）。`guarded-after-change-inert` arm 无 second/third 调用探针（`runs/kit-r1r-fix1/rereg-window.json`：该 arm `secondCallV2:null`）。⇒ §(j):316 允许说法在静默配置内**尚未被测量**，不得由投递 arm 外推。 | **G-2**（必补，P4 收口的前提） |
| P5 | **D** + unit E | 判据 `RW-AFTER-DOOR-BODY-ZERO`（kit mjs:551-554）+ `runs/kit-r1r-fix1.log:16` + RED→GREEN 对 `runs/B3-after-door-RED.json`/`runs/B3-after-door-GREEN.json`（RED `v1=0 v2=1` → GREEN `v1=0 v2=0`）；unit ① `[followup] a5p1r-change-abort.test.ts:142-181`（含 `second.bodies=[]` 的下调后拒）。 | 对照用途，无收口义务；措辞仍受 §4 禁则约束 |
| P6 | **U — NO-EVIDENCE** | 反向半有断言（kit mjs:583 `changeChannel==='armed'`；unit `:251/:269`）。正向半**零断言**：全检 `git grep "'proven'" -- packages/runtime/test tests/kits/a5-pr1-guard-dispatch`（本轮执行）**仅命中 install.ts 源三处**（`:156/:403/:959`），测试/kit 网内零命中；`proven` 仅作为**记录字段**出现于 `runs/kit-r1r-fix1/rereg-window.json`（`guarded-after-body-zero` 等 arm `changeChannel:'proven'`）与 `runs/B3-after-door-GREEN.json`。⇒ "送达⇒proven" 从未被断言过。 | **G-3**（任务钦定补测项：armed 后注入一次真实 registry-change ⇒ 期望发射） |
| P7 | **U — 判据缺口** | 记录字段在：`runs/kit-r1r-fix1/rereg-window.json` `arms.guarded-after-no-change`：`executedUnvalidated:0 verifiedAfter:true`；但判据 `RW-AFTER-NO-CHANGE`（kit mjs:558-562）谓词**不含** `executedUnvalidated===0` ⇒ 记录级，非判据。 | G-1b（把该谓词补进 check） |
| P8 | **U（机检缺失；裁决已登记）** | 裁决/文本在册：`[followup] dev/agent-workflow/PENDING-GATES.md:19`（G-g 行：开放、不得默认 SUPPORTED）与 `:24`（Owner：起草=4dac3d04、落文=4d990c89）；`s12-residual-evidence.md:290-318`（§(j)：定位未收口 :311、允许/不允许措辞 :316-317）、`:335`（矩阵 G 行=未收口/UNSUPPORTED）；`seam-record-post-door-resolution.md:99-122`（RETRACTION：`v2===1` 旧宣称撤回、"One call, then withdrawn…may not be cited as [fail-closed]"）、`:113-121`（what is still open：armed/proven + `RW-CHANGE-INERT-LOUD` 义务）。 | 措辞/矩阵定位的 lint 机检 = NO-EVIDENCE ⇒ **G-5** |
| P9 | **UR** | 装配期拒绝有 E+D：unit `:198-214`（无事件缝⇒拒装、无残留）、`:215-244`（订阅抛错⇒typed 拒绝）；判据 `RW-NO-CHANGE-CHANNEL-UNSUPPORTED`（kit mjs:525-528）+ `runs/kit-r1r-fix1.log:13`（`code=IO_POLICY_UNSUPPORTED message=cannot subscribe to the public notification "tools/change"`）。源：`[master] install.ts:981-984`。 | 无（对照条款；其存在**不得**被用来关闭 P1–P4） |

**分级小结**：E 1（P3）；D 3（P1、P2、P5）；UR 1（P9，对照）；U 4（P4、P6、P7、P8）。⇒ **G-g 整体未达收口**：两条硬缺口 = P4（同配置恢复路径未测）与 P6（送达⇒proven 零断言）。

## 3. 最小补测清单（既定架构内；不扩权限、不碰 :3080）

通用约束：kit 腿跑在 `tests/kits/a5-pr1-guard-dispatch/`（p00-fixture 为纯 in-process 钉定 registry，**不占端口**、无 server——`[followup] dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-fixture.mjs` 头注）；unit 腿进 `packages/runtime/test/`（root vitest）。凡需 live 装配（真实 Host server + 生产 composition）者标 **LIVE-WIRING-GATED=PR3 后**，届时端口一律 `3495` 前缀自占自弃、DSH_HOME=`tests/homes/a5p7rev-*`（TEST_METHODS §7 命名/清理协议）、**严禁触碰 :3080 及其 DSH_HOME**。

| # | 项 | 内容（可执行到判据名/断言行） | 期望可机检观测 | 状态 |
| --- | --- | --- | --- | --- |
| G-1 | kit 判据补齐（P1/P7/P2） | (a) 新判据 `RW-INERT-ASSEMBLY-INDISTINGUISHABLE`：inert arm 断言 `install.ok ∧ publish.ok ∧ 注入前 changeChannelStatus==='armed'`（用已记录字段即可，kit mjs results 已含）；(b) `RW-AFTER-NO-CHANGE` 谓词追加 `executedUnvalidated===0`（误报守卫）；(c) unit inert 腿追加 `expect(events(handle)).not.toContain('dispatcher-change-abort-issued')` | 三条 check 全 PASS；(c) 进 CI | 可立即执行（改判据，不改产品码） |
| G-2 | inert arm 恢复路径（P4，**收口硬前提**） | 扩 `guarded-after-change-inert`：静默调用 settled 后 `second=f.run('grep')`（期望被拒、`v2` 计数不涨）→ `handle.bindOwnTools(names)` → `third=f.run('grep')`（期望 `thirdCallV2=1`、`verifiedAfter===true`）。新判据 `RW-CHANGE-INERT-PINNED-UNTIL-REBIND`（谓词形状对齐 `RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES`，kit mjs:577-580） | `secondV2===1 ∧ rebindOk===true ∧ thirdCallExecuted ∧ verifiedAfter===true`；unit 同步腿：`:245` 腿后接 `runCall` 拒→rebind→跑 | 可立即执行 |
| G-3 | **armed⇒proven 正断言（P6，任务钦定）** | 订阅 armed 后注入一次真实 registry-change ⇒ 期望恰好一次发射。kit：新判据 `RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY`（body-zero arm 已有真实 re-register 投递——断言其 `changeChannel==='proven'`；或 no-change arm 前置一次不涉在飞调用的合法 re-register，避免污染 P7）。unit：`①` 腿 `registerOwn` 投递后 `expect(handle.changeChannelStatus()).toBe('proven')` | 判据 PASS + unit 绿；且与 inert arm 的 `==='armed'` 反向断言成对（P6 两半齐） | 可立即执行 |
| G-4 | "订阅存活但发射被吞"故障注入（P1–P3 的注入等价性） | 新 arm `guarded-after-change-swallow`：包一层交给 lane 的 `on`——`'tools/change'` 订阅**被接受、handler 留在 host 监听表**，但分发永不轮到它（与 inert 的"先订阅后 dispose"是两种注入，lane 视角应不可区分）。新判据 `RW-CHANGE-SWALLOWED-LOUD`：谓词 = `RW-CHANGE-INERT-LOUD` 五件套 **加**事件流计数：`dispatcher-definition-change-at-call-edge(reason=definition-drift)≥1 ∧ dispatcher-binding-revised(verified=false)≥1 ∧ dispatcher-change-abort-issued===0 ∧ dispatcher-call-cancelled-before-body===0 ∧ dispatcher-call-executed-unvalidated(severity=alarm)≥1` | 全谓词 PASS；`changeChannelStatus()` 全程 `'armed'`；与 G-2 组合后同 arm 亦测恢复路径 | 可立即执行 |
| G-5 | 措辞/定位 lint（P8 的机检形态） | 仓库级 CI grep：对 `dev/agent-workflow/**` 支持矩阵/契约语境禁 `fail-closed`/`已合规`/`compliant`/无引注 `SUPPORTED` 指向 G-g 配置（引注/RETRACTION 上下文进 allowlist，锚 = `seam-record-post-door-resolution.md:99-122`）；并断言 PENDING-GATES 的 G-g 行与 G-a 行不得在同一修订里被同判 closed | lint 绿；命中即红并指名 file:line | 可立即执行（CI 脚本级） |
| G-6 | live 装配通道状态观察 | 生产 composition 挂 G-d 接线后，live Host 上一次合法 MCP resync ⇒ 诊断面可读 `changeChannelStatus()==='proven'` + `dispatcher-change-abort-issued` 事件原文；端口 3495 前缀自占自弃、home=`tests/homes/a5p7rev-*` | 事件流+状态读数入 `runs/`；**计分项挂 G-d lane 集成确认，不计入 G-g** | **LIVE-WIRING-GATED=PR3 后** |
| G-7 | live 静默通道姿态 | live 装配注入 swallow 型静默 ⇒ 生产观察面仍 `'armed'` + 每调用 alarm；live 矩阵该配置保持 UNSUPPORTED/待证，**不得**被 G-d 集成确认顺带计入 | 同 G-4 谓词组在 live 面复现；矩阵行仍"未收口" | **LIVE-WIRING-GATED=PR3 后** |

**合计**：7 项 = 5 项既定架构内可立即执行（G-1..G-5，全部零产品码改动或仅测试/kit 改动）+ 2 项 **LIVE-WIRING-GATED=PR3 后**（G-6、G-7）。

## 4. 判据与不通过措辞

### 4.1 每子命题 PASS/FAIL 判据（未来 kit/vitest 断言式；FAIL = 任一 conjunct 不成立）

```
PASS(P1) = check('RW-INERT-ASSEMBLY-INDISTINGUISHABLE'):
  inert.installOk && inert.publishedOk && inert.channelBeforeInjection === 'armed'
PASS(P2) = check('RW-CHANGE-INERT-LOUD'):
  inert.v2 === 1 && inert.executedUnvalidated >= 1 && inert.changeAbortIssued === 0
  && inert.cancelledBeforeBody === 0 && inert.changeChannel === 'armed' && inert.verifiedAfter === false
  且对偶 control.v2 === 1 && control.v1 === 0            // RW-CONTROL：harness 必须看得见 V2
PASS(P3) = vitest: expect(rowsFor(handle,'dispatcher-call-executed-unvalidated'))
    .toMatchObject([{ severity:'alarm', changeChannel:'armed' }])
  && expect(alarms[0].pinned).not.toBe(alarms[0].current)
  && 事件流计数（G-4 谓词组）: definition-change-at-call-edge.reason === 'definition-drift'
PASS(P4) = check('RW-CHANGE-INERT-PINNED-UNTIL-REBIND'):
  inert.secondCallRefused && inert.secondCallV2 === inert.v2 && inert.rebindOk === true
  && inert.thirdCallExecuted && inert.verifiedAfter === true        // 同一静默 arm 内，禁止外推
PASS(P5) = check('RW-AFTER-DOOR-BODY-ZERO')（既有，仅引用不改动）
PASS(P6) = check('RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY'): delivered.changeChannel === 'proven'
  && vitest: expect(handle.changeChannelStatus()).toBe('proven')    // 注入一次真实 registry-change 后
  且既有反向: inert.changeChannel === 'armed'（run 末尾重读一次）
PASS(P7) = check('RW-AFTER-NO-CHANGE' 扩展): noChange.executedUnvalidated === 0
  && noChange.verifiedAfter === true && noChange.changeAbortIssued === 0
PASS(P8) = 措辞 lint 绿 && PENDING-GATES G-g 行状态与证据分级表一致（P4/P6 未达收口 ⇒ G-g 行必须仍"开放"）
```

FAIL 处置：任一 P 不 PASS ⇒ 该子命题在 §2.2 表按实际落 **D/U**，PENDING-GATES G-g 行保持"开放"；**不允许**以"部分 PASS"或"其余腿全绿"合并升格（G-f census 纪律同款）。

### 4.2 FAIL/静默配置下的对外措辞规范（禁则先于允许式）

- **禁用**（对静默配置的一切场合）：`fail-closed`、`closed`、`已合规`、`compliant`、无引注的 `SUPPORTED`、"暴露恰为一次调用"（该口径已被明文撤回——`seam-record-post-door-resolution.md:99-122`）、"被漂移名字的进行中调用被取消"（仅通道确实投递时成立——`s12-residual-evidence.md:317`）。
- **允许**（静默配置，逐字锚 = `s12-residual-evidence.md:316`）："被漂移的名字在其下一次调用前被钉住（并响亮上报）"。
- **缺证声明模板**：`G-g（订阅成功但永不投递）= UNSUPPORTED/待证：P<编号> 缺 <判据名|断言>（NO-EVIDENCE），收口前不得记为 SUPPORTED；引用 PENDING-GATES.md G-g 行`。
- P6 未收口期间：`changeChannelStatus()` 的任何读数只作**诊断**引用，不得写成"通道已验证可用"。
- 涉及 P5 的对照结果时：只引 G-a 行原文口径，不得把对照绿升格为对新场景的承诺。

## 5. 证据台账（claim → file:行 / runs 路径；无证据处明写）

| claim | 出处 | 级别 |
| --- | --- | --- |
| G-g 开放、不得默认 SUPPORTED、不随 G-a 关闭 | `[followup] dev/agent-workflow/PENDING-GATES.md:19`；裁决边界② `:14` | 裁决（权威登记） |
| Owner：起草=4dac3d04 / 落文=4d990c89 | `[followup] dev/agent-workflow/PENDING-GATES.md:24` | 裁决 |
| 静默配置定义与"矩阵定位未收口" | `[followup] …/s12-residual-evidence.md:290-318`（§(j)，:311） | 契约文本 |
| 矩阵 G 行=未收口/UNSUPPORTED | `[followup] …/s12-residual-evidence.md:335`（§(k)） | 契约文本 |
| fail-closed"恰一次暴露"宣称**已撤回** | `[followup] …/seam-record-post-door-resolution.md:99-122` | 契约文本 |
| armed/proven 语义与唯一翻转点 | `[master] install.ts:153-156, :403, :958-959, :1174`（与 followup 树 diff 为空，已验） | 源 |
| 静默⇒响亮 alarm 的触发码 | `[master] install.ts:762-773` | 源 |
| settled-edge 降级（definition-drift） | `[master] scoped-dispatcher.ts:351-382, :334, :211/:221/:306` | 源 |
| F 配置装配期拒绝 | `[master] install.ts:981-984`；unit `[followup] packages/runtime/test/a5p1r-change-abort.test.ts:198-244`；`runs/kit-r1r-fix1.log:13` | E+D（UR） |
| 静默五件套判据与 PASS 原文 | kit `[followup] tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs:582-584`；`runs/kit-r1r-fix1.log:23`；`runs/kit-r1r-fix1/rereg-window.json`（criteria + `arms.guarded-after-change-inert`） | D |
| 静默注入方式（订阅后 dispose） | 同上 mjs:322-325, :425 | 方法在册 |
| unit 静默腿（alarm 字段断言） | `[followup] …/a5p1r-change-abort.test.ts:245-270` | E |
| 投递对照（取消+下调后拒） | mjs:551-554；`runs/kit-r1r-fix1.log:16`；`runs/B3-after-door-RED.json`↔`runs/B3-after-door-GREEN.json`；unit `:142-181` | D+E |
| 无误报记录字段（非判据） | `runs/kit-r1r-fix1/rereg-window.json` `arms.guarded-after-no-change.executedUnvalidated=0` | D（记录级） |
| P4：静默配置内"后续被拒→re-bind 恢复" | **NO-EVIDENCE**（同 arm 无 second/third 探针；仅有投递配置证据 mjs:551-554/:577-580、unit `:449`，不得外推） | U |
| P6：送达⇒`'proven'` 断言 | **NO-EVIDENCE**（测试/kit 全检零命中，仅 `runs/*.json` 记录字段 `'proven'`：rereg-window.json `arms.guarded-after-body-zero` 等、B3-after-door-GREEN.json） | U |
| P8 措辞 lint | **NO-EVIDENCE**（不存在任何 CI 检查） | U |

## 6. 不扩大声明与交接

- 本文只把 G-g 从挂账推进为**可判定证据门**（命题+分级+判据+补测项）；不改实现、不改支持矩阵、不宣布任何收口。收口动作 = G-1..G-5 落地并复跑留 runs，G-6/G-7 待 PR3 接线。
- 取消范围语义一律以 PENDING-GATES.md:14 裁决原文为准；本文出现的取消字样仅在 P5 对照与引用语境。D-1、G-a、G-d 各行不因本文移动。
- 交接：本文件（含 §2.2 分级表与 §3 清单）交 **4d990c89 系文档 writer 落文**至 PENDING-GATES.md G-g 行/支持矩阵；集成 owner（p4t6/tsconfig/接线）负责 G-5 lint 的 CI 挂载与 G-6/G-7 的 PR3 后排期。
