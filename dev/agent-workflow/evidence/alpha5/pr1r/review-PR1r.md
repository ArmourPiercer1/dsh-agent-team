# Review — Alpha.5 PR1r（PR #257 残余边界收口）独立审查件

- **对象**：PR #257 head `2b16de64`（`Alpha.5 PR1-residual — evidence set, seam record, kit README and router log`），base master `db5cb5f7`（已合并 PR1）。审查用一次性 detached worktree（`.worktrees/a5pr1r-review-2b16de64`）；**未 merge、未 push 任何非本件分支**。
- **审查者**：独立 reviewer（≠实现者会话）。模型（逐字）：`You are a coding agent powered by the qwen3.8-flash-next model.`；Harness：**DeepSeek Harness**（两者分列，不合并表述）。
- **轮次**：一轮三值（通过 / 补充内容 / 阻塞）。用户追加指令（经 parent 转达）把 **B1/B2/B3 列为阻断项**，本件按该口径裁决；`2b16de64` 不按"记录即合格"放行。
- **方法**：只读主目录；`git fetch` 后对 `db5cb5f7..2b16de64` 逐文件读码；我侧实跑 lane/kit/runner + 四个一次性探针（跑完即删，见附录）。裁决只基于代码、测试、pinned 宿主源码与我自己的复现，不引用其他 reviewer 意见。

---

## 0. 判定摘要

| 项 | 内容 | 三值 |
| --- | --- | --- |
| **B1** | R-b"一次调用+事后撤回"作为验收姿态 | **阻塞（FAIL）** |
| **B2** | seam-record 对 `tools/result` 边撤销的归因 vs 同臂 raw json | **阻塞（FAIL，归因矛盾成立）** |
| **B3** | CORE=0 下公开 seam 能否钉住"实际执行的已核验 definition" | **可行但不等价 → 交用户裁决**（不是"seam 不足"） |
| 必查 1 | R-a 规则 = 裁决原话（双读比较、非显式 bind 即拒） | **通过** |
| 必查 2 | R-b 空洞修复 + seam 诚实性（按 B1/B2 重裁） | **阻塞** |
| 必查 3 | 无放松（kit 22 条原腿 / dynRan / NEG1 / agentless / 测试断言） | **通过** |
| 必查 4 | `bindAll` revision 顺修 | **补充内容**（修复正确，**无独立测试**，s12 的"钉住"声明不成立） |
| 必查 5 | 门禁抽验（lane 79 / only_in_after / token / porcelain / dist↔源） | **通过** |
| **总判定** | — | **阻塞：PR #257（及依赖 PR #256）维持合并冻结** |

---

## B1 — R-b"恰好一次调用 + settled 边撤回"不构成验收：**阻塞**

**计划要求的形状**（当期口径，非本审查者添加）：
- `docs/plans/memo/alpha5-tool-io-governance/architecture.md:161`：`对于同一 Scope 的其他可信插件热注册/抢注，需串行装配或拒绝并发替换；不声称能够防御恶意同进程 Host 插件任意改写注册表。` ⇒ 普通同作用域热替换在**支持范围内**，义务是"**拒绝并发替换**"（先拒后行），被排除的只有"恶意改写注册表内存"一类。
- 同文件 `:210`（真值来源 D1 行）出口判据：`H6 未治理动态 Body 从执行→拒绝`，且该行处置为 `证明 public seam 本质不足才记 Core blocker`。

**PR 实际交付的形状**：门（`tools/execute`，`packages/runtime/tool-dispatch/install.ts:658`）之后到解析（pinned `packages/core/tools/src/index.ts:1578 resolveExecution` → `:1581 tool.execute`）之间没有可拒点，于是把撤回放到该次调用自己的 settled 边（`install.ts:615-630` → `scoped-dispatcher.ts:350 noteCallEdgeDefinition`），并以此宣称暴露上界。

**我侧复现（pinned registry，`a5p1r-rereg-window.mjs` + 我自有探针，非复用其断言）**：

```
arm inner-after-ours（第三方 tools/execute listener 挂在我方门之后，合法 dispose+register）
obs = third-party-execute-listener > legal-re-register > body:V2      ← V2 = 未校验 Body 真执行
v1=0 v2=1  verifiedAfter=false
我自有探针（同拓扑，逐臂独立计数）：
  A1 tools/change 可用   → v2=1, callEdgeEvents=0, revalidateDrift=1
  A2 tools/change 不可用 → v2=1, callEdgeEvents=1, revalidateDrift=0
```

⇒ **一次未校验 Body 确实执行**，两种配置下都是；`RW-RESIDUAL-RECORDED` 证明的是"我方记录了这个绕过 + 下一次被拒"，不是"未校验 Body 不可达"。把它写成验收姿态即与本计划"拒绝并发替换 / 执行→拒绝"不符。

**实现者是否把话说反了？没有全说反，但用词越界**：`s12-residual-evidence.md:21`（决策 4）自陈钉的是 "the honest fact (the Body ran)"，runner 判据也确以 `v2===1` 为 PASS 前提——这一点是老实的。越界在措辞与判据两处：
- `s12-residual-evidence.md:21` 同条把它称作 `so the exposure is one call and never a standing state`；
- `seam-record-post-door-resolution.md:69-83` 把它列在字段 `fail-closed posture taken in the meantime` 之下（同字段首行 `cannot refuse.` 是老实的，见 B2 引文）；
- `s12-residual-evidence.md:184` 把整段称作 `the fail-closed posture taken meanwhile`。
"记录到 + 下一次拒"是**事后收敛（eventually refused）**，不是 fail-closed；用 `fail-closed` 描述一个"未校验 Body 已执行"的状态，会让 Gate 读者把未闭合项读成已选择姿态。本件的 B1 阻断正是针对这一格：**记录 ≠ 收口**。

**并且"恰好一次"不是普遍上界**（代码级反证，两条，均不依赖我的推测）：
1. `scoped-dispatcher.ts:353` — `if (!entry.verified) return { checked:false, detail:'already unverified' }`：settled 边的比较在 entry 已被 `tools/change` 降级时被整体跳过（这正是 PR 自己那条 GREEN 臂的情形，见 B2），即"钉住一次"的那条路径在被测量的配置里**没有运行**。
2. `install.ts:623-627` — `noteCallEdgeDefinition` 只在 `endCallById(...)` 返回 `ended.ended` 时被调用，而 `'settled'` 证据**只在 ACTIVE 态被接受**（`scoped-dispatcher.ts:549-557`：`if (status !== 'ACTIVE') { … return { ended:false } }`，即 PR1 自己的 R4 规矩）。⇒ Body 在 drain 开始后才返回的那次调用，其 settled 边被记为 refused，**call-edge 撤回不发生**，被移动定义的 verified 状态原地保留。`never a standing state` 的措辞（`seam-record-post-door-resolution.md:83`、`s12-residual-evidence.md:21`）在该窗口不成立。

**要求**：R-b 必须改为 before-body 拒绝（见 B3 两条可测路线），或按 B3 的 fail-closed 选项把该拓扑在严格档禁用并记 M-xx；在那之前不得以"一次调用"作为门/kit 的通过判据（`RW-RESIDUAL-RECORDED` 现把 `v2===1` 写成 PASS，等于把绕过固化成基线）。

**公平性一并记录（可达性不是零，但不是零风险）**：base 轮实测 `a preset row cannot register a tool on this Host (measured)`（`dev/agent-workflow/evidence/alpha5-pr1-implementation/s12-evidence.md:253-259`；本轮 kit README 亦重申 `Post-publish registration by a third-party row is not reachable on this Host (measured)`，`tests/kits/a5-pr1-guard-dispatch/README.md:170-172`）⇒ 本 Host 上"预设 row 抢注"这条具体路径不可达；但 runner 臂用的形状是**任何持有 Agent `ctx` 的贡献者**（M-12 的 MCP bridge 即此类）都能做的合法 dispose+register，且 lane 自己的威胁陈述把它列为支持范围内 ⇒ 不变式仍须成立，只是紧急度低于"host 上已可达"。本件的阻断判定基于不变式，不基于紧急度。

---

## B2 — seam-record 的机制归因与同臂 raw json 矛盾：**阻塞**

**seam-record 原文**（`dev/agent-workflow/evidence/alpha5-pr1r/seam-record-post-door-resolution.md:70-83`，逐字）：

> `taken in the meantime : cannot refuse. … (3) A Body re-registered AFTER our door runs exactly once, and at that same call's settled edge (tools/result) noteCallEdgeDefinition compares the pinned identity with what the name now resolves and WITHDRAWS the verification (dispatcher-definition-change-at-call-edge), so the next call is refused and only an explicit re-bind by the trusted assembly restores it — measured by RW-RESIDUAL-RECORDED: v2=1 (one un-validated Body) then secondCall v2=1 (the next call ran nothing). The exposure is therefore ONE call per move, never a standing state.`

该字段块标题 `cannot refuse.` 一行是老实的——本件 B1 因此不把本项判为"隐瞒"，而判为"把未收口当作上界交付"。矛盾发生在 (3) 的**机制归因**上：

**同一轮同一臂的 raw 证据**（`dev/agent-workflow/evidence/alpha5-pr1r/runs/Rb-rereg-window-GREEN.json`，`arms.inner-after-ours`）：

```json
"callEdgeWithdrawal": 0, "driftViaChange": 1, "verifiedAfter": false,
"obsTail": ["third-party-execute-listener","legal-re-register","body:V2"]
```

⇒ 被引用的那条臂里 **`dispatcher-definition-change-at-call-edge` 事件计数为 0**：撤的是 `tools/change` 诊断（`dispatcher-revalidate-drift`），不是 settled 边。而同一轮的证据集把该通道明文排除在安全机制之外（`s12-residual-evidence.md:24`：`tools/change is proven **not** to be a safety mechanism in this window`），于是这份记录同时主张：撤回靠 A、A 不是安全机制、上界靠 A。**归因矛盾成立**，不是措辞问题：读者会据此相信 settled 边被量过，实际那一臂它没跑。

**要求的复跑（tools/change 缺席的 after-door 同款臂）——我侧结果**：撤销**确实发生**（`callEdgeEvents=1`，`verified=false`，`revision 2`，第二次调用被拒），但**未校验 Body 仍跑了 1 次**（`v2=1`）。所以：
- "撤销根本不发生" 不成立（B2 的反设不成立）；
- 但该日志**不得**被推为"普遍最多一次"的上界：被引用的臂靠的是被自己否定的通道，而 settled 边自身在 drain 窗口还会跳过（B1 反证 2）。

**另记两处一致性问题（同一阻断项内）**：
- `a5p1r-rereg-window.mjs:246` 的 `secondCallV2 = f.counters('V2')` 是**累计**计数，不是"第二次调用的增量"；判据文字 `the next call ran nothing` 与字段名会误导读者（该断言本身因 `v1/v2` 也在第二次调用后读取而仍然成立）。
- kit runner 没有 `inner-after-ours` 的 `noChange` 臂（`guarded-pre-execute` 有），所以"settled 边独立成立"在**真 registry runner** 里从未被量过；lane 的双（`a5p1r-validate-resolve.test.ts` RECORDED BOUNDARY）因双从不 fire `tools/change` 而隐性隔离了它——这是巧合的覆盖，不是设计的覆盖。

---

## B3 — CORE PATCH BUDGET = 0 下的正解探索（实测，非推理）：**可行但不等价 → 交用户裁决**

先固定"事实"而非推理：pinned 宿主公开 tool 事件全集只有 `tools/pre-execute` / `tools/execute` / `tools/post-execute` / `tools/ptc-dispatch-log` / `tools/result` / `tools/change`（`packages/core/tools/src/index.ts` 的 `Events` 声明 + 全部 waterfall 调用点 `:1325/:1505/:1605/:1782`），`tools/execute` 的 waterfall 最内步就是 `dispatchToolBody`（`:1605-1608 → :1564`），Body 唯一调用点在 `:1581`，其定义解析在 `:1578`。**解析前不存在更后的公开 listener 位**——我方 listener 之后必然可以挂别人（这正是要测的臂）。

在此之上我实测了四条候选路线（pinned registry，一次性探针）：

| 候选 | 结果（原文计数） | 结论 |
| --- | --- | --- |
| **(i) 门内自执行已核验 definition**（我方 door listener 不调 `next()`，自己 `await pinnedDef.execute(...)` 并 `return { value }`） | `bodies=[V1]`，V2 `v2=0`（未校验 Body **一次都没跑**）；`text="ran:grep@V1"` `isError=false`；`post-execute` 与 `tools/result` 边照常 fire；`inFlight=0`；`disposeOrdered → ok` | **执行侧可在公开 seam 内闭合**；但代价见下 |
| **(ii) 门内装可取消 signal wrapper + 由同步 `tools/change` 通知 abort**（事件契约明文允许：pinned `index.ts:156` `wrappers may change only exec.signal`） | `seq=[door-installed-wrapper, change-sees:V2, lane-abort-from-change, third-party-re-registered]`，`bodies=[]`，`text="Error: tool call aborted before dispatch"`；对照臂（无移动）`bodies=[V1]` 正常执行 | **也能 before-body 停下**，且不改执行者：pinned `:1568` 在全部 listener 落定后读 `wrapperSignal` → `:1572 if (isAborted(signal)) return toolAbortedBeforeDispatchResult()`，**早于 `:1578 resolveExecution`**。代价=拒绝形状变成 abort 而非 typed guard 拒词 |
| **(iii) 由 `tools/change` 把已核验 definition 重新注册回去** | `lane-repin-verified-definition` → `Error: tool "grep" is already registered in this scope`，`v1=0 v2=0`，`verified` 仍为 true（**未撤回**） | **不可行**：change emit 在对方的 insert 栈内同步触发，重注册与之竞态；且 throw 落进对方的 `register()` |
| **(iv) `tools/change` 是否够早（learning）** | `seen=["change-sees:none","change-sees:V2","after-register"]`（在 `body:V2` 之前） | **够早**：能同步得知"名字已移动"，但该上下文没有拒绝权（`tools/change` 是 emit，且携带 exec 的只有别的边） |

**(i) 的语义代价（必须一起裁决，不得当免费午餐）**：
1. 我方门之后的别人 `tools/execute` wrapper（超时/重试/计量）被跳过；
2. `dispatchToolBody` 未走 → `state.bodyInvoked` 保持 false（pinned `:1580`），取消/终止归类语义（"按 body 是否已调用替换结果"）随之改变——**未测**，采纳前必须有腿；
3. `normalizeDispatchResult`（pinned `:1865`，其内 `:1876 const tool = this.resolveExecution(exec.name, …)`）会用**重新按名解析**的 definition 去 `createSuccessResult` ⇒ 执行被钉住了，**结果的形状/归属身份仍来自被移动的那一行**，未闭合。我实测的第一次尝试（返回 `{content:[…]}`）被规范化直接拒回 `Error: tool "grep" returned invalid output: value is not lossless JSON`，改成返回 `{ value }` 才被接受（`C1`）——即该路线必须模仿 registry 的内部结果协议，不是公开契约；
4. 现有漂移撤回仍会把第二次调用拒掉（我实测 `A4` 第二调=拒），所以该路线需要自己的 re-bind/重钉叙事；
5. 只在本进程 pinned registry 上证过，真 Host（带 model/preset）未证。

**(ii) 的语义代价**：拒绝形状是 `tool call aborted before dispatch`（与用户取消不可区分），需在 lane 侧另发 typed 观测 + 仍要撤 verification；abort 目标可由 lane 自己的 lease 自计（`beginCall(callId, toolName)`）按名选取。**且必须按 (agent, name) 精确选取**：`tools/change` 是全局 emit（不带 exec、不区分 scope），不加筛选就是自我 DoS。

**(i)/(ii) 的覆盖差异（也是实测得出的，不是推演）**：(i) 不依赖任何通知（我方从不让 registry 解析），所以对"注册另一个对象"这一类移动天然免疫；但它同样**不防原地改写同一对象的 `.execute`**（拿到的是同一对象引用）——那一类属于计划明文排除的"改写 Host 内存"类，两条路线都不声称覆盖。(ii) 的上界则是"会通知的改动"——`(iv)` 显示通知早于解析，但没有通知就没有 abort。

**因此 B3 的结论不是"公开 seam 不足"**：执行侧的 before-body 闭合存在可测路线（i/ii），本件不接受"只能记录"的说法。同时，**最小上游能力请求仍然成立且更干净**，形状（对现有 seam 的差额）：
- **W-1（首选）**：`tools/execute` waterfall 的**最内步之内**、`resolveExecution` 之后、`tool.execute` 之前的一次 waterfall，携带**已解析的 `ToolDefinition`**，`deny` 走既有 typed 拒形（等价于 seam-record 的选项 1）。为什么现有面不可达：上表 `Events` 全集 + `:1578/:1581` 相邻，解析与调用之间无任何 emit/waterfall 点；`(iii)` 实测不可行；`(ii)` 只能以 abort 形状表达拒绝。
- **W-2**：解析稳定执行——`createExecution`（pinned `:1391`）已早解析一次并在 `:1436` 快照 finalizer，把它钉进 execution 并让 `dispatchToolBody` 跑该 definition 而非按名再解析。它同时消掉 pre-execute 窗口与"结果形状由移动后的行决定"（上面第 3 条），是 `(i)` 做不到的部分。
- seam-record 的选项 3（只在 exec 上暴露已解析 definition）**单独不够**：可见≠可拒，本件已按此降级。

**替代路线（若用户不采任何 before-body 改法）**：按既有先例的 fail-closed 措辞把该拓扑在严格档禁用——装配期无法确证"该 Agent own-layer 的治理名只有 Team 一个贡献者"时，typed `IO_POLICY_UNSUPPORTED` 拒装（先例：M-01 `M-12` 行的"strict Profile 拒绝 / `IO_POLICY_UNSUPPORTED`"），并把披露写进矩阵而不是只在 kit README。

**受影响支持矩阵行（S0-SELECTION-MATRIX.md）**：
- **M-12**（MCP）：该行选型的字面要求是"动态注册/撤回/**重注册**/同名遮蔽**全量进 closed-world Guard**"——R-b 这条腿（重注册）当前不满足 ⇒ 该行状态必须回落（不得沿用 PR1 的"全量"表述）。
- **M-06**（`grep`/`glob` R3 adapter）：其"未尽事项"已列 `tools/post-execute` 定义身份；且 kit 的 `pr1-*` 四条 arm 正是该 adapter 的形状 ⇒ R-b 未闭合前该行"host 级验收"表述需加注。
- **M-01 / M-02 / M-03 / M-14**：其拒绝姿态以"治理名身份不被移动"为前提（M-01 末列原文：`PR1 覆盖不变式未闭合前拒绝`）⇒ 该行前置条件在 R-b 上尚未满足，需显式记 `partial`。
- **交用户裁决**：B1/B2 的整改路线（i / ii / 上游 W-1|W-2 / 严格档禁用）+ M-12、M-06 的状态回落，均不得由实现者单方选。

---

## 必查 1 — R-a 是否等于裁决原话：**通过**

**用户规则逐字**：`用公开 tools.get 比较全局可信 definition 与 agent 解析 definition 的身份，若不同且非 Team 显式 bind，应拒或声明该装配不支持`。

**实现对照**（逐处）：
- 两次读同一个公开 seam：`install.ts:356-372 readTrustedDefinition` = `tools.get(name)`（无 scope），`install.ts:324-340 readDefinition` = `tools.get(name, scope)`；无自加语义、无第三条来源。pinned 宿主语义核对：`index.ts:1227-1231`（`get(name, scope?)`，`omitted = the global view`）、`:1202`（own registrations last，`shadowing an inherited name`）、`:747`（同名 per-agent 变体的官方建议原文）。
- 裁决只由比较产生：`closed-world-guard.ts:432-456`（`isNative = claimsNative && hasPinnedIdentity && hasTrustedIdentity && trustedIdentity === pinned`；否则四选一 reason），非 native 路径一律 UNVERIFIED ⇒ "不同且非显式 bind ⇒ 拒"，无名字即算数的旁路。
- 显式 bind = 正门：`install.ts:695-731 bindAll` 只读 agent 侧 definition 并 `verified: true` ⇒ 同名异体被显式绑定是**允许**（等价于规则的"非…显式 bind"排除项）。
- 拒的形式=「拒」而非「声明不支持」：`guardDecision` 的 `native-shadowed` / `native-unreadable` typed 拒（`closed-world-guard.ts:184/188/582-592`）。**可诊断性**到位：publish 侧 `install.ts:770-786` 发 `published-surface-shadowed` 带两侧指纹（我探针实测：`grep: the trusted global definition is def#2 but this Agent resolves def#1`）。
- **无"把正常热注册划入恶意类"的口径漂移**：威胁模型文件本轮**零改动**（`architecture.md` / `post-poc-technical-design.md` / `P0-*-guide.md` 对 `db5cb5f7..2b16de64` 全部 UNCHANGED）；runner 头 `a5p1r-rereg-window.mjs:11-16` 明文"not re-worded"；我实测正常类未被误伤：装配后新增名仍是 PR1 原拒词 `has no Team Tool Binding … closed world`（不是 shadow 拒词），一致同意的 native 名两条世界都照常执行（`readBodies=["NATIVE.read"]`）。
- **RED 场景我侧重放（真 registry，自有断言）**：装配前第三方同名 `grep` ⇒ `verified=false reason=native-shadowed`、**两个 Body 都不跑**（`grepBodies=[]`，既不是 `THIRD_PARTY.grep` 也不是 `NATIVE.grep`）、拒词点名 shadow；显式 `bindOwnTools(['grep'])` ⇒ `verified=true bindingId=team-own:A:grep bodies=[THIRD_PARTY.grep]`。kit 腿 `R1R-SHADOW` 我侧独立跑 PASS，lane 79/79 我侧实跑 PASS。
- 一条**收紧副作用需知悉（不是缺陷）**：可信侧读不到（`hasTrustedIdentity=false`）时本轮改为拒（`native-unreadable`），合并版会计入；该改动只会多拒不会少拒，且已在 s12 §(g) 披露。

---

## 必查 2 — R-b 空洞修复与 seam 诚实性：**阻塞**（判据见 B1/B2）

- runner 5 arm 逐条读码：`a5p1r-rereg-window.mjs:87`（5 臂）、`:117-127`（确定性 park = 真 fence + 忙等 `armed`，非 sleep）、`:133/:174`（before/after 挂载位）、`:150-156`（`noChange` 把 `tools/change` 注册做成 throw，隔离 F2）——**park 与 arm 语义诚实**，`RW-CONTROL` 有牙（`v2=1 resolution=V2`）。
- 门重问确在 Body 解析前：`install.ts:658` 在 `tools/execute` listener 内；pinned `:1605-1608` 的 inner step 才是 `dispatchToolBody`（`:1564`）→ `:1578` 解析 → `:1581` 调用。Guard 位在 `:1519`（pre-execute `:1505-1508` 之后）⇒ "Guard 后、门前"这段真空被闭合：**我侧 RED 复跑 `v2=1 text=ran:grep@V2` → 本轮 GREEN `v1=0 v2=0`**（`RW-INNER-DOOR`，我独立跑 PASS）。
- 门后那半区：seam-record 四要素齐（要什么 / 解析实际在哪 / 现有 seam 给什么 / 上游三选一），且**逐行号核对无误**（`:1505-1508`、`:1519`、`:1605-1608`、`:1564`、`:1578`、`:747`、`:1202`、`:1227-1231` 我全部在 pinned 树里对上）。**但姿态段对 `tools/result` 边的归因与 raw json 冲突（B2）**，且"never a standing state"有代码级反例（B1）⇒ 该项不诚实到可验收的程度。
- 威胁模型文字：见必查 1，diff 零改动 ✓。

---

## 必查 3 — 无放松：**通过**

- **lane 测试名逐条对合**：base 63 条（24+23+16，我侧 base worktree 实跑 63 passed）→ head 79 条（27+23+16 a5p1-* + 8+5 a5p1r-*，我侧实跑 **79 passed**）；`removed test names: []`，新增 3 条全为 `R1R*`。断言计数：`a5p1-closed-world-guard` expect 76→92、`a5p1-guard-install` 123→123、`a5p1-scoped-dispatcher` 100→100。
- **测试面全量删除行核对（`git diff db5cb5f7..2b16de64 -- packages/runtime/test/` 只有 12 行 `-`）**：8 行是 `bindInheritedSurface(...)` 加第三个 `trusted` 实参的调用点改写（`verifiedBound).toBe(3)` / `.toBe(1)` 等期望值**原值保留**）、1 行是 fixture 的 `get`（改为真全局视图，见下）、3 行是被收紧的断言。**没有任何断言被删除或放宽，没有方向翻转**（无 `toBe`→`not.toBe`、无 `===`→`!==` 类改动）。
- **方向性改动只有收紧，共 3 处**：`toContain('cannot be verified')` → `toContain('different ToolDefinition')`（1 处 `host.runGuards` + 2 处 `dispatcher.guard`）。代码侧对应：base 这一类只有 1 条泛化消息（head 仍保留为 `closed-world-guard.ts:199`），head 为漂移单开专用消息（`:209`）⇒ 断言从"泛化措辞"改为"钉住具体 reason"，方向更严。
- **双的"忠实性修复"不是放水**：`a5p1-guard-install.test.ts` 把 `tools.get(name)` 从假 `undefined` 改成真全局视图（默认与 agent 侧同一注册对象 ⇒ 原有 23 条语义不变，`seamBroken` 仍能表达全局侧读不到）。
- **kit 22→23**：`a5p1-kit.mjs` 与 `sweep-worlds.mjs` **零改动**（diff 仅 +3 行 `index.ts` 导出）⇒ 13 条 Host 腿（含 `C2` dynRan、`C4/C4b` agentless/legacy 零干涉、`C7a/b`）原文原方向；9 条 `NEG1-*` 在 head 全部存在且 `check(` 调用文本逐字节未变（diff 只 +1 条 `R1R-SHADOW`）。我侧两遍实跑：**head 23/23 PASS**（`C1d publishes=4 refused=0`，全程无 `published-surface-shadowed`/`dispatcher-native-unreadable`），**base 22/22 PASS**（同 worktree 依赖布局下的前后对照）。
- **`pr1-*` 改显式 bind 的合理性有证据**：base 注释自陈该 arm 的 pinned 定义是"the one the scope actually resolves (the shadowing adapter)"，且 base `alpha5-pr1-implementation/s12-evidence.md` 残留披露原文：`a native name ALREADY shadowed by a scope-local definition at publish time is pinned from that scope's own resolution and so enters governance as verified` ⇒ 这四条腿确实**以洞为承重墙**；改显式 bind 后 `NEG1-*` 九条仍全过，且新 `R1R-SHADOW` 在**同一世界**证明去掉 bind 会空测（`verified=false` + 两个 Body 都不跑）。

---

## 必查 4 — `bindAll` revision 顺修：**补充内容**

- 修复本身必要且**有效**（我实测）：`surface.bind` 要求 `revision` 严格更高（`closed-world-guard.ts:378-385`），旧常量 `revision: 1` 使漂移后文档承诺的 re-bind 被 `"must carry a strictly higher revision (2 in force, got 1)"` 拒死；新 `install.ts:714/726` ⇒ `rev0=1 → 撤回后 rev=2 → re-bind ok → rev=3 verified=true → ran:grep@V2`。
- **但没有任何独立测试**：全仓 `bindOwnTools/bindMcpTools` 使用点（3 个测试 + 3 个 runner）里**没有一次二次 bind**；`a5p1-guard-install.test.ts:371` 的 `bindMcpTools` 是**首次** bind（revision 1，旧新行为一致）。`s12 §(a)5` 声称"observable in the second half of `R1R-SHADOW`"——那条只 bind 一次，旧代码同样通过 ⇒ **声明与钉住不符**。
- 要求（小补，属兼容性补充）：lane 加一条"bind → 合法移动 → 撤回 → 再 bind 成功且 `revision = inForce+1` 且可再执行"的测试；或把 `s12 §(a)5` 的钉住声明改为"未钉住"。不改变 PR1 其余已审语义（`bind` 的 bindingId 稳定族规则、`revise` 语义均未动）。

---

## 必查 5 — 门禁抽验：**通过**

| 门 | 我侧结果 |
| --- | --- |
| lane 79 | `node node_modules/vitest/vitest.mjs run packages/runtime/test/a5p1` → **Test Files 5 / Tests 79 passed**；base 同法 **63 passed** |
| kit 真 Host | head **23/23**（`.tmp-review-kit/`，port 3185，world 已清；`C7a before=401 after=401`，`C7b` porcelain 空）；base **22/22** |
| `a5p1r-rereg-window` | 5/5 PASS（`RW-CONTROL` 有牙）；`order-hazard` 10/10 PASS |
| `only_in_after=[]` | 按身份（去掉耗时后缀）归一后对两份全套日志求差：**only_in_after = 0**（22 after ⊂ 49 before）。**抽 3 身份我侧双跑**：`t2-blueprint-hash>projects absent optional singles as explicit null`、`p6t6-actions>messaging: worker -> leader …`、`p6t3-mediation>1./3./4./5./7.` —— head 与 base 均为同样 7 条失败 ⇒ 无回归 |
| token 扫描（diff 面） | 11033 行 diff 逐行扫 secret/credential 模式 + 26+ 位高熵串：命中仅 `REDACTED-<sha8>`（`?token=<REDACTED-f09b1ac9>`）、SHA、session id、路径；**可用凭据 0**；无 `host-stdout.raw` 入库 |
| test-use porcelain | 两棵树 `git status --porcelain` 均 0 行；kit `C7b` 亦 PASS；我侧探针只读该树 |
| dist↔源 | `check:artifacts` → `verdict=ok compared=1572 glue=1`；**并做真重建**：`tsc -p packages/runtime/tsconfig.build.json` 后 `git status --porcelain packages/runtime/dist` = **0 行**；反证：往源文件加一行注释后重建 → 恰好 2 个文件变脏，还原后复归 0（该检查有牙，不是空跑） |

---

## 附录 A — 我侧复现命令（一次性脚本已删除）

```bash
# lane（head 79 / base 63）
node node_modules/vitest/vitest.mjs run packages/runtime/test/a5p1
# registry 腿与 R-b runner
node tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs --out order.json     # 10/10
node tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs --out rereg.json     # 5/5
# 真 Host kit（head 23/23；base 同法 22/22）
node tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs --evidence-dir <dir>
# 我自有探针（一次性，跑完即删；不复用 PR 断言）：
#   1) R-a RED/bind 双向 + 正常类未被误伤 + 二次 bind revision 序列（A/A'/B/D）
#   2) after-door 撤回归因：change 可用 vs 不可用（A1/A2）
#   3) 门内自执行 / 由 change 触发 abort / change 重注册竞态 / change 时机（A3/A4/C1..C4）
# 重建比对：node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.build.json
```

### A.1 探针原始输出（B1/B2/B3 全部结论的唯一数据源）

```jsonc
// 拓扑：装配（bind+publish）→ 第三方 tools/execute listener 挂在我方门之后
//       该 listener 内做合法 dispose+register（同名 V2）→ next()
{ "A1_change_available":  { "firstText": "ran:grep@V2",
    "afterFirstCall": { "v1":0, "v2":1, "verified":false, "revision":2,
                        "callEdgeEvents":0, "revalidateDriftEvents":1, "inFlight":0 },
    "secondText": "Error: team tool guard: \"grep\" now resolves to a different ToolDefinition than its Binding p…",
    "obs": ["third-party-listener","legal-re-register-V2","body:V2"] } }

{ "A2_change_absent":     { "firstText": "ran:grep@V2",
    "afterFirstCall": { "v1":0, "v2":1, "verified":false, "revision":2,
                        "callEdgeEvents":1, "revalidateDriftEvents":0, "inFlight":0 },
    "obs": ["third-party-listener","legal-re-register-V2","body:V2"] } }

{ "A3_repin_from_change": { "firstText": "Error: tool \"grep\" is already registered in this scope",
    "afterFirstCall": { "v1":0, "v2":0, "verified":true, "revision":1,
                        "callEdgeEvents":0, "revalidateDriftEvents":0 },
    "obs": ["third-party-listener","lane-repin-verified-definition","third-party-listener"] } }

{ "A4_self_execute_at_door": { "firstText": "ran:grep@V1",
    "afterFirstCall": { "v1":1, "v2":0, "verified":false, "revision":2,
                        "callEdgeEvents":0, "revalidateDriftEvents":1, "inFlight":0 },
    "teardown": "ok",
    "obs": ["third-party-listener","legal-re-register-V2","lane-self-execute","body:V1"] } }

// 短接（不调 next()）后的调用是否正常 settle（不带 lane，纯 registry 事实）
{ "A5_settling_of_short_circuit": {
    "seen": ["pre-execute","post-execute(isError=false)","result(isError=false)"],
    "text": "ran:read@V1", "isError": false, "bodies": ["V1"] } }

// (ii) signal-wrapper + change 触发 abort
{ "C3_abort_from_change": {
    "seq": ["door-installed-wrapper","change-sees:none","change-sees:V2",
            "lane-abort-from-change","third-party-re-registered"],
    "bodies": [], "text": "Error: tool call aborted before dispatch", "isError": true } }
{ "C4_control_no_move":  { "bodies": ["V1"], "text": "ran:grep@V1", "isError": false } }
{ "C2_change_before_resolve": {
    "seen": ["change-sees:none","change-sees:V2","after-register"],
    "bodies": ["V2"], "text": "ran:grep@V2" } }   // 通知早于解析，但没有拒绝权

// (i) 自执行返回 { value }（结果被 registry 正常规范化）
{ "C1_self_execute_value": { "text": "ran:grep@V1", "isError": false, "bodies": ["V1"] } }
```

kit runner 侧同拓扑（实现者自己的证据，`runs/Rb-rereg-window-GREEN.json`）：

```jsonc
"inner-after-ours": { "v1":0, "v2":1, "verifiedAfter":false, "secondCallV2":1,
                      "driftViaChange":1, "callEdgeWithdrawal":0,
                      "obsTail": ["third-party-execute-listener","legal-re-register","body:V2"] }
```

## 附录 B — 对 `s12-residual-evidence.md` 空 reviewer slots 的映射

| slot | 本件三值 | 依据 |
| --- | --- | --- |
| R1（R-a 归因 vs 威胁模型无改写） | 通过 | 必查 1 |
| R2（R-b 姿态："一次调用+撤回"是否老实、seam 记录是否完整） | **阻塞** | B1 + B2 |
| R3（kit 诚实：22→23、显式 bind 是否削弱） | 通过（附必查 4 的补充要求） | 必查 3 + 必查 4 |

## 附录 C — 建议用户抽查点

1. 亲跑 `a5p1r-rereg-window.mjs`，只看 `arms["inner-after-ours"]`：`v2` 是不是 1、`callEdgeWithdrawal` 是不是 0——这两格即 B1/B2 的全部。
2. 读 `seam-record` posture 段第 (3) 条与 `Rb-rereg-window-GREEN.json` 同臂字段并排对照（本件 B2 已逐字引）。
3. 对 B3 做裁决：门内自执行（钉执行、不钉结果形状）/ signal-abort（钉执行、拒词变 abort）/ 上游 W-1|W-2 / 严格档禁用；并要求 M-12、M-06 的状态回落到矩阵而不是 kit README。
4. 抽 `pr1-*` 四条 arm：删掉 `bindOwnTools(['grep'])` 后 `NEG1-*` 是否立刻变空测（`R1R-SHADOW` 就是这条的反证腿，别"顺手简化"）。
