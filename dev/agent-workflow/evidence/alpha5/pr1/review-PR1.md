# PR1 独立 Review — PR #253 `alpha5-pr1-guard-dispatcher` @ `f6eeec02`

- **Reviewer**: Alpha.5 PR1 独立 reviewer（≠实现者；模型 `qwen3.8-flash-next`，powered-by 逐字；独立会话，未参与实现）
- **审查对象**: PR #253 head `f6eeec025b9a610070ecf22284c9d855b16c844e`（stacked on #252 `cd13f781`；`2b5e2d27..f6eeec02` 两提交经独立 diff 核实 = 仅 s12 口径措辞 + file-hashes 重算，零代码/kit 语义变化，Receipt 不变）
- **语义权威**: `docs/plans/memo/alpha5-tool-io-governance/post-poc-technical-design.md` §4.1/§4.3/§5；PoC 原始记录 `dev/agent-workflow/evidence/alpha5-adapter-p0/`（diff `cd13f781..f6eeec02` 对其 **0 改动**，独立核实"untouched"声明成立）
- **复现方式**: worktree `.worktrees/a5pr1-review`（detached @ f6eeec02）只读取证 + 一次性复现脚本（用已提交 `dist`，未改任何仓库文件）+ 目标包 vitest 实跑（head 与 base 各一）；不 merge 不 push（除本审查件）

## 总判定：**FAIL**（4 BLOCKER R1–R4 全部按定向反例在已提交 dist 上复现成立；另有 4 MINOR）

四条 BLOCKER 均为**安全语义缺陷（防护可被绕过/防护未闭合）**而非代码质量问题；按用户裁决"任一确认=BLOCKER，Gate 挂起，修复归 writer"。PR 其余工程面（CORE=0、baseline、证据卫生、状态机骨架、测试改造诚实性）独立复核为真。

---

## 1. R1–R4 定向反例复现（复现命令 / 结果原文 / 判定）

一次性脚本 `/srv/…/.rt-review-scratch/repro.mjs`（已删）import 已提交 `packages/runtime/dist/packages/runtime/tool-dispatch/index.js`，逐条驱动编译产物。**四条全部复现。**

### R1 inherited 洗白 — **BLOCKER，CONFIRMED**

- 复现：publish 前在 Agent own-scope 面（`tools.schemas(runtimeAgent)`）存在非 Team、未绑定的 `evil_own_tool`（真实场景 = 同 scope 第三方行在 setup 窗口内 `tools.register`；publish 的 `readSurface` 必含 own-layer 注册，C2 的 `team_follow_up` 正证明 own 注册可被该面看见）。
- 结果原文：`entry(evil_own_tool) = {"origin":"inherited-native","verified":true,"bindingId":"native:evil_own_tool","implementationOrigin":"dsh-native"}`；`decide(evil_own_tool) => kind=abstain reason=governed-and-verified`。
- 判定：未知 own 工具被洗白为 **可信 dsh-native 继承名**并放行。三重违背：①设计 §4.1 "任何未知 exec.name…由持续生效的单调 Guard 拒绝"；②本模块自己的 docstring（[closed-world-guard.ts:209-214](../../../../../packages/runtime/tool-dispatch/closed-world-guard.ts#L209)："names the Team did not review are bound UNVERIFIED — refused at dispatch"）与实现（[:318](../../../../../packages/runtime/tool-dispatch/closed-world-guard.ts#L318) `verified: true` 无条件）**直接矛盾**；③PR 正文把 inherited 类披露为"已存在的原生名"，洗白超出披露面。要求语义（原生允许须来自明确可信来源；未知 own 工具=拒）不成立。

### R2 同名换体沿旧 verified — **BLOCKER，CONFIRMED**

- 复现：绑定名发布后同 scope 以**不同 body** 重注册同名 → 名称表不变；`revalidate()` 按 name diff 返回 `{"added":[],"removed":[],"denied":[]}`；`decide(team_follow_up) => kind=abstain`。
- 结果原文：`entry still revision=1 bindingId=team-own:session-repro-1:team_follow_up definitionIdentity=team-own:team_follow_up — never compared against the live registry definition at call time`。
- 判定：Guard 每次调用只查名称表+世代+revision（[closed-world-guard.ts:348-383](../../../../../packages/runtime/tool-dispatch/closed-world-guard.ts#L348)），从不核对当前 definition/provider 身份；PoC 01-routing 已实测 dispatch 晚期重解析 ⇒ 新 body 沿旧 verified 执行。设计 §4.1 ACTIVE "每次执行…还要在 Guard 与 Dispatcher 处检查绑定" 未闭合；`revise()` 在生产 glue **零调用者**（grep 证实），热替换永远到不了 revision 通道。docstring"re-reads the surface… cannot be raced"（[:345-346](../../../../../packages/runtime/tool-dispatch/closed-world-guard.ts#L345)）overclaim。

### R3 缺接缝仍发布 — **BLOCKER，CONFIRMED**

- 复现：(a) `agentCtx.on` 缺失；(b) `tools/pre-execute` 注册抛错。
- 结果原文：(a) `install ok=true`、`publish ok=true state=ACTIVE`、`disposeOrdered ok=true state=RELEASED maskLifts=1`，事件流里无任何 gate/lease 安装记录——**恒零自计数下全机器"成功"走完**；(b) `fatal observations: ["pre-execute-gate-unavailable"]` 后 `publish ok=true dispose ok=true`。
- 判定：[install.ts:321](../../../../../packages/runtime/tool-dispatch/install.ts#L321) `if (typeof input.agentCtx.on === 'function')` 无 else；[:350-354](../../../../../packages/runtime/tool-dispatch/install.ts#L350) 的 catch 自述"Without the outer door a parked call could resume into a re-resolved Definition — the NEG-1 hazard itself"，却只 observe `fatal:true` 继续。设计 §4.1 PREPARING "任一失败不发布该 Agent" 违反；要求（缺关键接缝=组装失败）不成立。

### R4 endCall 无体返回证明 — **BLOCKER，CONFIRMED（有已披露成分，见判定）**

- 复现：pre-execute 门取 lease →（早期 result 事件到达，body 仍在执行）post-execute 边 `endCallById` → `disposeOrdered`。
- 结果原文：`after result edge: inFlight=0 (body STILL running: true)` → `disposeOrdered ok=true state=RELEASED maskLifts=1 guardDisposed=yes`。
- 判定：lease 边界"outer door → result event"弱于"无体在飞"这一点，install.ts:306-314 与 README `NEG1-SEAM` 已诚实披露；**但** (i) [install.ts:355-357](../../../../../packages/runtime/tool-dispatch/install.ts#L355) 注释自称 "the first public moment at which the Body has returned" 与前段自相矛盾；(ii) 设计 §4.1 RELEASED 要求"无在飞 Body/ExecutionLease **的证据成立后**清理"，lane 在 kit 自己测得 `postExecuteBeforeRelease=true`（order-hazard 判据）的情况下仍把 result 事件当作充分证据并升 RELEASED、撤 mask、卸 Guard——late callback 类按用户口径钉为 BLOCKER。设计 §4.3"Grant 失效与 Lease 的终止保证要分开记录"未满足。

### 反证控制（同时成立，防止把 lane 判成纸糊）

同一脚本对照组：未发布态 `decide(read) => deny:dispatcher-not-active`、外身份 deny、`guardDecision` 无 allow 类型、DRAINING 首瞬拒新调用——骨架方向正确；四条 BLOCKER 都在**闭合性**（来源信任、身份核对、接缝完备、终止证据）而非方向性。

## 2. 必查 1：安全断言未被弱化 — **成立（dynRan 对合通过）**

- PoC 原文（不可篡改基线）：`07-integration/03-stage2b/run-h6-*/hc-dyn-observation.json` `"dynRan": true` + notes.md:184 + h6-kit.mjs:983（"body-reachable-at-runtime=true；runtime guard abstains；Coverage Gate 是 fail-closed 线——记录为 finding"）。
- PR1 断言方向：**翻转而非弱化**——同一"发布后注册、无人绑定"类在真实 Host 上必须**不执行**：final/kit.log `C2a/C2b` 结果原文 = `Error: team tool guard: "team_follow_up" has no Team Tool Binding…(closed world: an un-governed tool never executes…)`，`guard-observations.txt` 含 `guard-denial tool=team_follow_up`，且不对称文本（Guard 文本 vs `unknown tool`）自证拒绝来自 Guard。
- NEG-1 防护对照：PoC negative-cases.md NEG-1 行（原体 native=1 / 对照 native=0）↔ [a5p1-order-hazard.mjs:223-237](../../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs#L223)：`NEG1-CONTROL hazard.native === 1`（对照**必须能**执行——方向正确、对照保留未软化）vs `NEG1-PARKED native=0 adapter=0`（正式路径**不能**执行）；final/order-hazard.json 8/8 PASS 含 `NEG1-CONTROL native=1 bodies=NATIVE.grep`。
- MINOR-1：C2b 的"无副作用"半程是 transcript 文本判定（无 `executed/queued`），弱于 PoC 的磁盘 marker；主证据（guard seam 先拒 + 观察行）在位，但补 marker 更合"counters not prose"的自家法则。
- MINOR-2：final/undeclared-name-evidence.json 的 note（"refused on the governed lane…leaves no file behind"）与同文件实测（`governedLaneWriteRan: true`，strict/ctl 双文件均写出，inherited-native-observation 双 lane 成行）自相矛盾——run-14 遗留的过期措辞，数据诚实、note 过期。

## 3. 必查 2：Guard 语义对设计 §4.1 — **部分成立，被 R1/R2/R3 击穿**

typed deny 五元组（unknown/binding 不可验证/外身份/无身份/非 ACTIVE）与 §4.1 逐条对上（[closed-world-guard.ts:21-27,348-383](../../../../../packages/runtime/tool-dispatch/closed-world-guard.ts#L21)；`ADAPTER_DRAINING/TEAM_TOOL_UNGOVERNED/TOOL_BINDING_UNVERIFIED` 均为 PR0 冻结 §5 词汇子集，[:386-388](../../../../../packages/runtime/tool-dispatch/closed-world-guard.ts#L386)）；`tools/change` 纯诊断不绑定不裁决（[scoped-dispatcher.ts:308-325](../../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts#L308) + [install.ts:246-275](../../../../../packages/runtime/tool-dispatch/install.ts#L246)）；Coverage Gate 降为诊断在装配点措辞落实（[agent-bindings.mjs:429-433](../../../../../packages/runtime/src/plugin/live/agent-bindings.mjs#L429)）。Agentless 零干预**代码级成立**：Guard 仅在 `permissionPolicy !== undefined` 安装（agent-bindings diff @2191 段），legacy lane 零 listener；Host 实证 C4/C4b（见 §7-B）。**但**未知 own 名洗白（R1）与同名换体（R2）使"持续生效的单调 Guard 覆盖未知/改变的 Binding"在两个入口上不闭合；缺接缝发布（R3）违反 PREPARING 失败不发布。

## 4. 必查 3：五态机与竞态 — **成立**

转移表线性冻结（[binding.ts:46-53](../../../../../packages/domain/tool-governance/src/binding.ts#L46)：DRAINING 仅→TOMBSTONED，RELEASED 终态，不可回 ACTIVE）；DRAINING 先拒新调用（[scoped-dispatcher.ts:216-224](../../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts#L216) beginDrain 内先 transition 后 cancel；`beginCall` 非 ACTIVE 一律 `ADAPTER_DRAINING` [:242-245](../../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts#L242)），`maskMayLift() === (state==='RELEASED')`（[:278](../../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts#L278)）；lease/token 自计数、`noteHostDisposeReturned` 明示"记录但永不充分"（[:226-241,273-277](../../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts#L226)），release 在自计数非零时 `EXECUTION_TERMINATION_UNCONFIRMED + sideEffectUnknown:true`；TOMBSTONED late-callback 拒（[a5p1-scoped-dispatcher.test.ts:140-150](../../../../../packages/runtime/test/a5p1-scoped-dispatcher.test.ts#L140) + install disposeOrdered 撤序 mask 先/Guard 后仅 RELEASED，[install.ts:460-496](../../../../../packages/runtime/tool-dispatch/install.ts#L460)）。缺口即 R3（无接缝=恒零假零）与 R4（早 result 假零），已由 BLOCKER 覆盖。

## 5. 必查 4：CORE=0 红线 — **成立**

`git diff --name-only cd13f781..f6eeec02` 中 `tests/deepseek-harness-test-use|references/deepseek-harness` 命中数 = **0**；宿主侧改动全部在本仓 Team 层 `packages/runtime/**`（root packages = vNext 自有结构，非 upstream 树）。新 lane 全部 export 的生产消费者经 grep = **仅** [agent-bindings.mjs](../../../../../packages/runtime/src/plugin/live/agent-bindings.mjs)（import-audit 白名单行同步，[audit-a5-tool-governance-imports.mjs](../../../../../scripts/audit-a5-tool-governance-imports.mjs)；实跑 lane+a6a 102/102 绿，数字与 PR 正文 18/14/11/59=102 一致）。既有测试改造（a6a/alpha2-explicit-agent-setup/rc2a1/a3p4/p4t6）全部为**按监听器函数名身份分类**或链式驱动（`a5p1GuardPreExecuteGate/DispatchGate/ResultEdge`），计数 pin 1/1/0 原样在位（a6a:881-898），无弱化。

## 6. 必查 5：baseline no-new-red — **成立**

`baseline-identity-diff.json`：`only_in_after = []`（身份口径零新红）；抽 3 条实跑复验（head worktree 与 base worktree `cd13f781` 各一次）：`t2-blueprint-hash > projects absent optional singles as explicit null` 与 `p6t6-actions > messaging: worker -> leader is delivered direct to the leader bound session` 在两树**同身份同败**；第 3 条 `a2c7-subtree-matcher`（基线表 13 红）在两处本地为绿——MINOR-3：该文件红疑似实现环境的跨文件/环境依赖，方向与 no-new-red 相容但表内应注环境条件。typecheck/lane 数字抽查一致。

## 7. 必查 6 + 追加 A/B/C

- **证据卫生**：自扫 `alpha5-pr1-host/**` 全部 `token=[A-Za-z0-9_-]{24,}` 命中 = **0**（final/instance.log 含 REDACTED 指纹行；与协调侧独立扫描结论一致）；storm fuse 在 [a5p1-kit.mjs:602](../../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs#L602)（>300 请求即 abort）+ Receipt 行 916；失败史 **run-6..run-15 目录完整在库**（含 run-2..5），未被删。
- **A（oracle 过滤器=非消音器）**：对 [a5p1-kit.mjs:850-851](../../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs#L850) 原谓词一次性注入——planned `tool=team_follow_up` guard-denial → 不计数（其存在反而由 C2a 独立正向要求）；未计划 `TOOL_BINDING_UNVERIFIED`/`not ACTIVE` → **计数→C5 FAIL**；未计划 `tool=read|write` guard-denial → **计数→FAIL**。残余：从未被 served 的其他名的 ungoverned-denial 不进 drift（但该类不在 C5 断言域，且 served 调用的用户可见失败被 C3/C5 的 SEED_CONTENT 结果侧独立钉死）。run-15 失败原文（`drift=["…guard-denial agent=session-a5p1-team-…"]`）证明修复前过滤器确过宽、修复即收窄为名特异——**过滤器不是消音器，钉住成立**。
- **B（13 Host 判据正控完备）**：C3（governed read 出内容）、C5（re-drive 再出内容）、C1b/c（payload 级 accepted）、C1d（publishes≥2 本身即正控）、C2a/C2b（正控=C4 同定义在 legacy lane 真跑 + PoC dynRan 基线 + Guard 专属文本不对称）、C4/C4b（**native 真实落盘**：`wroteFile('ctl') === A5P1_RAN_ctl_<stamp>` 精确内容断言，非 mock 计数——agentless 断言的证据形态合格）、C6（正控=guard-released/mask-lifted 观察在 guard-observations）、C7a/b（读侧对照）。无"只有负侧、无正控"的判据。
- **C（失败路径清理实证）**：三路在位——成功 [kit.mjs:883](../../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs#L883)、FATAL `dieFatal→sweepWorld` [:184-189](../../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs#L184)、throw 经 finally:866 后由 `main().catch(dieFatal)` :958 兜底；`sweep-worlds.mjs` 为 SIGKILL 缺口补救。实证：criteria-failed 腿 run-9..run-15 全部 `(removed at teardown)` 留痕；**MINOR-4**：FATAL 腿无修复后（5f1e0142 起）真实失败 run 的删除留痕（旧 run 的 fatal summary `world: None`）——要求 writer 跑一次故意 FATAL 腿（如假 port 冲突）留证；有 sweep-worlds 兜底不升级。

## 8. Findings 汇总

| 级别 | 编号 | 位置 | 一句话 |
| --- | --- | --- | --- |
| BLOCKER | R1 | closed-world-guard.ts:300-322（vs 自身 docstring :209-214） | publish 面未知 own 名洗白为 trusted `native:`/verified:true 放行 |
| BLOCKER | R2 | closed-world-guard.ts:348-383 + scoped-dispatcher.ts:308-325 | 同名换体沿旧 verified 执行；definition 身份从不按调用核对 |
| BLOCKER | R3 | install.ts:321,350-354,367-371 | 缺/抛关键接缝仅记 fatal 日志仍发布并以恒零计数 RELEASE |
| BLOCKER | R4 | install.ts:355-357（矛盾注释）+ 306-314/NEG1-SEAM | body 晚于 result 存活时照样 RELEASED+撤 mask；RELEASED 无终止证据 |
| MINOR | M-1 | a5p1-kit.mjs:816-819 | C2b"无效果"为文本判定，缺磁盘 marker 级正证 |
| MINOR | M-2 | final/undeclared-name-evidence.json note | note 与同文件实测矛盾（run-14 过期措辞） |
| MINOR | M-3 | baseline-identity-diff / PR 表 | a2c7 13 红在本地双树不复现，表未注环境条件 |
| MINOR | M-4 | a5p1-kit.mjs:184-189 | FATAL 腿 world 删除有代码无修复后实证；要求故意失败腿一次 |

**建议用户抽查点**：① repro 脚本三行输出——R1 `entry(evil_own_tool)` 与 R3a 事件流（洗白与恒零假成功的原图）；② `install.ts:306-314` 对 `:355-357` 的注释自相矛盾（R4 语义核心）；③ `closed-world-guard.ts:209-214` docstring 对 `:318` 实现（R1 的仓内自证）。

## 9. 复现物清单

- head 更新核验：`git diff --stat 2b5e2d27..f6eeec02` = 2 文件（s12 措辞 + file-hashes 重算），零代码。审查期间 writer 又推 `aff65f31`（s12 两条红 composition-smoke 腿归因说明，12 行 docs-only）——本审查件即 rebase 于其上，R1–R4 复现对象仍为 f6eeec02 的已提交 dist（该提交未动代码，dist 哈希一致）。
- vitest 实跑：lane 4 文件 102/102 绿；红身份复验 head+base 各一轮（见 §6）。
- R1–R4 一次性脚本与 drift 过滤器注入脚本：运行于 `.rt-review-scratch/`（用后即删，仓库零污染）；对照组证明状态机方向面为真。
