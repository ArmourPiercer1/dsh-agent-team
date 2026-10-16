# review-PR1r-fix.md — PR257 B3 修复轮独立审查（fix-round reviewer, ≠writer）

- reviewed HEAD = **`d5890103`**（父方改钉；链 `2b16de64`→dd70ef3c 基线含→`cf299383`→`bd6310ca`→`ffbc6e9a`→`dfcc0606`→`d5890103`，FF 已核）
- reviewer 会话 = qwen3.8-flash-next（模型/harness 分列；本件为上轮 B1–B3 审查续篇）
- 复现环境 = 一次性 worktree `.worktrees/a5p1r-fixrev-bd6310ca`，world `tests/homes/a5p1-2026-10-16T16-46-29`（kit 自删），port **3185**；`:3080` 只读（C7a before=401 after=401）；pinned test-use `639ed01539` porcelain 净

## 总判定：**PASS（通过，附 1 项 MINOR 台账注记 + 1 项分类裁定）**

所有 ①–⑨ 独立复跑成立；撤回口径干净；无静默通道；无对已运行调用的 abort 劫持。

## 逐项

**① after-door body=0 — PASS（独立复现 RED→GREEN）。** 我侧实跑 `a5p1r-rereg-window.mjs`（13 判据）@d5890103 dist：**13/13**（`RW-AFTER-DOOR-BODY-ZERO v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH`）；再把 lane 源换回 2b16de64 重建 dist 重跑：**8 失败/5 通过**，`guarded-after-body-zero v1=0 v2=1`、`inner-after-ours v2=1` —— 与入库 `runs/B3-after-door-RED.json`（同集合、同数值）逐条一致。B1/B2 场景（inner-after-ours）归零。lane 97/97（我跑）；入库 RED 16 失败/GREEN 97 均在 `runs/`。

**② 根审查点 1 — PASS。** 监视从 dispatch 门（`armWrapperSignal`，identity=门内刚验证的指纹）持续到 `tools/result` settled 边（`install.ts:746 settle`），仅此处解除；不可读=视同移动。**registry change 对已开始 body**：信号是请求，Host 自有语义裁决——`ABORTED`（body 已开始）→ `dispatcher-call-terminated-after-body-start`（`sideEffectPossible:true`，值保留，绝不标未执行）；单位测试 + kit `RW-ABORT-INSIDE-BODY-IS-TERMINATION`（v1=1 code=ABORTED terminated=1/1 cancelledBeforeBody=0）为负控：已开始 body 走既有终止类，未被 abort 路径改写/重标为取消。抢跑失败=`dispatcher-call-completed-after-abort`（按 EXECUTED 上报）。未开始的**全**取消：同 Agent 同工具 3 并发全灭（`RW-MULTI-CALL-ALL-CANCELLED` issued=2 + lane 测试 c1..c3）、同名跨 Agent 真受影响集（全局移动 ⇒ 两 lane 各自取消自己作用域，`a5p1r-change-abort.test.ts` "affected set stays whole"）、邻工具/他 Agent 同名不动（隔离双腿）。台账明示非 drain 工具，teardown 拒绝不变（测试⑤ + `RW-TEARDOWN-NO-LEAK`）。
  **MINOR（不改变裁决）**：门内 `arm()` 之后、`next()` 之前的两条拒发路径（reentry 双身份、wrapper 不可装）不显式 `settle`；实测（`tmp-rev/leak-probe.mjs`）Host 对失败调用仍过 result 边 ⇒ `pendingCalls()=[]` 无泄漏，但不变量依赖 result 边必发——建议后续在 throw 前显式丢弃记录（1 行）。

**③ 根审查点 2（静默通道）— PASS。** 实测该通道现在**静默时 V2 仍跑、仅 alarm**：`RW-CHANGE-INERT-LOUD v2=1 unvalidated=1 channel=armed`（`dispatcher-call-executed-unvalidated` alarm；事后撤销降为 hygiene，未把旧执行算 fail-closed——validate-resolve 测试原文 `bodies:[]` 新断言 + 撤回注释）。**支持判定有真实通道证据**：`changeChannel` 仅在首颗事件送达后 `armed→proven`（`install.ts:959`），"proven" 各臂 laneEvents 原文含 `dispatcher-change-abort-issued` + body=0（送达+生效双原文，我侧 GREEN2.json 复现）。无真实通道 ⇒ ④ typed 拒。

**④ change 缺失/注册失败 — PASS，无静默。** `on` 缺失 / `tools/change` 订阅抛错 ⇒ `IO_POLICY_UNSUPPORTED`（点名通道，四缝回滚零残留：测试②双腿 + 真 registry 臂 `RW-NO-CHANGE-CHANNEL-UNSUPPORTED`）；旧 `tools-change-listener-unavailable` 静默观察路径 grep 零残留；生产 glue（agent-bindings.mjs:2296-2300）拒装配=Agent 不 publish（fail-closed 在装配期，非把已执行洗白）。

**⑤ 取消≠终止 — PASS（原文）。** 两码分流：`ABORTED_BEFORE_DISPATCH`→`dispatcher-call-cancelled-before-body`（lane 发起）/`-cancelled-by-others`（非 lane）；`ABORTED`→`-terminated-after-body-start`；读不到码→`-outcome-unreadable`（alarm，两向都不宣称——测试④末腿）。事件名在 GREEN2.json laneEvents 逐字可核。

**⑥ 正控腿 — 全绿（我侧实跑）。** 无变更（`RW-AFTER-NO-CHANGE v1=1`）、真用户 cancel（单位④ caller abort inside-body→TERMINATED；Host 直调面 mid-body 不可见已探针入档=**披露**，lane 未据此造宣称——判定见下）、MCP 撤回重注册（`RW-MCP-RESYNC…` cancel+rebind 恢复）、hooks/telemetry/结果身份（`RW-HOOKS-RESULT-IDENTITY` 两边各带 callId+Host 码）、teardown/drain（NEG1 九腿 + `RW-TEARDOWN-NO-LEAK`）。**披露 vs fail-closed 再包装的裁定：这是披露**——探针零 lane 对照、lane 的区分只建立在 Host 实际发射的两码上、不可见腿零宣称、可见腿值保留绝不标未执行；不构成"事后撤销充当 fail-closed"。

**⑦ revision 增长测试 — 存在且绿。** `a5p1r-change-abort.test.ts` ⑥（bind→drift→re-bind：revision 严格增、二次移动再增、rebind 后 Body 跑 V3），在 97/97 与 lane-GREEN 日志内。

**⑧ 旧口径全撤 — PASS。** `RW-RESIDUAL-RECORDED`（`v2===1`）判据删除；"exposure = one call"仅存于撤回叙述（README:39-41、s12:12、seam-record:85-96、validate-resolve 测试内联注释）与明示"当时的测量"的 RED 历史摘录；kit/lane 无任何活判据或文案残留。

**⑨ 门禁 — 全过。** lane 79→97 只增（`a5p1-guard-install` 表面清单测试同步扩 = 加严）；kit 23→36（13+10+13，README 点名列出被删判据旧条件，只增不减）；NEG1 九腿/dynRan 强度未降（NEG1-CONTROL native=1；C2a/C2b dynRan FLIP 我跑 PASS）。**全量套件我跑：5 files/10 tests 失败 ⊆ 记录基线集**（t2-blueprint-hash、p6t3-mediation×2、p6t3-restart×5、p6t6-actions、a4p7-merge-gate 环境腿×1；基线记 11 项，本轮少 1，无新增）⇒ **only_in_after=[]**。typecheck：**包自带 tsconfig**（`packages/runtime/tsconfig.json` include 含 `test`）我复跑 exit=0、testkit exit=0 ⇒ ffbc6e9a 自曝"先前 tsc 未含 tests"已闭环（其 include: ["src","tool-dispatch","test",…] 实证）。lint 129 errors/32 warnings = 基线等值、touched 文件 0 problems（新唯一 "LEADER_ID" 提示在 h4-rule-identity 预存文件）。**`check:artifacts:head` 我补跑：verdict=ok compared=1576 drift=0（HEAD 自带构建=新）**。porcelain：tracked 净（我重建 dist 后仍净）；test-use porcelain 净（kit C7b）。token：`p4t6-session-event-scan` 绿（新文件已注册）、`lint-identities` 161 行/76 distinct 不变、universe 1161→1166（+新 spec/double/台账，身份集不变=全新增历史）。`:3080` 前后 401 同值零操作。router log 本轮条目完整含 RED/GREEN 指针。

## 遗留项（登记，非阻塞）

1. MINOR：门内 post-arm 拒发路径未显式 `settle`（实测无泄漏；建议补 1 行显式丢弃）。
2. Host 限制（已披露，勿升级）：调用方 mid-body abort 对直调结果面不可见 ⇒ 该腿仅披露不宣称。
3. seam-record 的"最后 listener→resolveExecution"区间依赖 `tools/change` 投递活性；装配期不可证，运行期以 `armed/proven`+alarm 暴露——上游 seam 请求（PoC-1 三条）维持。

审查件位置即本文件；**不 merge**。
