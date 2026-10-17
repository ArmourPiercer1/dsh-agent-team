# Review — PR#258 文档 follow-up（`alpha5-pr1r-followup` @ `86719028`）

- Reviewer: 独立 reviewer（≠writer 4d990c89；qwen3.8-flash-next，模型/harness 分列）。
- 对象: `86719028`（base master `452a04c0`；tip commit 单独 = +107/-46，两文档；分支相对 base 累计 = +185/-13，含前置 `db3053ce`）。PR draft DO-NOT-MERGE。
- 方式: 全程只读（fetch/read；token / porcelain / :3080 零操作）。Host 回读 = 共享只读基线 `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` @ `639ed01539…`（porcelain 空）。
- 裁决背景: G-a = 维持冻结、不以当前实现倒推合规、不发任何对外 upstream 请求（候选修法仅项目内登记）；G-g = 静默已订阅通道独立开放项，不得默认关闭。

## 判定：**PASS**（无必改点；两条非阻塞 nit）

### ① 对外措辞 = 零对外表述 — **PASS**
全 diff 检索 `upstream|submission|submit|提交|filed`：新增行中的每一次出现都是**否定句或免责句**——s12:252「不向任何外部（含 Host upstream）发起请求；对外提交属将来须用户另行授权的动作」、s12:268「不外部提交，亦不绕行」、seam-record:57-59 / 187-188 / 194（"nothing is filed outside this repository … any submission … would itself require the user's separate authorisation"）、seam-record:120 "waits on and does not request externally"。seam-record:176 "filed evidence" = 项目内证据，非对外。base 中两处真对外措辞（"what upstream would have to provide"、"retires when upstream offers"）已被删除/改写为"本项目等待、不对外请求"。**无任何"已提交/将提交/将向上游提交"断言。**

### ② seam-record 状态行 — **PASS**
状态行（:72）＝「机制已按裁决记录；运行接线与安全验收挂 G-a 冻结，解除须用户裁决」，不含 closed/compliant 断言；:73-76 明示 "neither this file nor any other document … may be read as calling it closed or compliant"；:160-165 "status wording, not a claim of closure … **a measurement is not an acceptance**, and keeping the two apart is exactly what G-a is for"（s12:277 同义：「是**测量**，不是验收——两者分开正是 G-a 的作用」）。base 的 "fail-closed posture" 状态注已降级为 "(was: …)" 历史标注。

### ③ s12 §(j) G-g 五要素 — **PASS**
(配置定义 :287-289：`on` 存在且订阅成功但永不投递，与"订阅抛错→IO_POLICY_UNSUPPORTED"显式区分；当前事实 :291-294：降级为名字级、在飞不取消、settled-edge 撤 Binding+alarm；证据坐标 :296-304；支持矩阵未收口声明 :306-308 「未收口（not settled）… 收口前不得记为 supported/closed/compliant」；契约收口为后续动作 :307 「G-g 需自己的契约收口动作（后续）」，seam-record:171-179 对应"g-g — independent open item … does NOT close together with G-a"）。**证据坐标逐值打开核对**：`runs/kit-r1r-fix1/rereg-window.json` RW-CHANGE-INERT-LOUD 原文 `v2=1 unvalidated=1 issued=0 channel=armed verifiedAfter=false` ✓；RW-AFTER-DOOR-BODY-ZERO 原文 `v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH issued=["grep:p00-c1"]` ✓；`runs/kit-r1r-fix1.log` 第 23 行 = 该判据 PASS 行含 "the moved Body does run (nothing can cancel it)" ✓；`B3-after-door-RED.json` `inner-after-ours`/`guarded-after-body-zero` = v1=0 v2=1 secondCallV2=1 ✓、`B3-after-door-GREEN.json` = v1=0 v2=0 secondCallV2=0 ✓（与 seam-record:103-105 引用一致）。

### ④ 三事实行号引用 @ `639ed01539` — **PASS**
Host `packages/core/tools/src/index.ts`（只读共享基线，porcelain 空）：`:1572` `if (isAborted(signal))` 拒绝检查、先于 resolve ✓；`:1576` `exec.signal = signal`（安装在 1572 检查之后、同一融合信号）✓；`:1578` `resolveExecution(exec.name, exec.agent, …)` ✓；`:1580` `state.bodyInvoked = true`（`cancellationStates` 私有字段）✓。语义逐一与 fact1/2/3 陈述一致。`pending-calls.ts:148-157` = 本 lane 文件 `packages/runtime/tool-dispatch/pending-calls.ts`（文档 :216-218 自己声明双基线回读）：:148-157 恰覆盖 `onRegistryChange` walk→`raise`，无 body-start 判据 ✓。附带核对 stage-order 引用 `:1505-1508`/`:1519`/`:1564`/`:1605-1608` 与契约引用 `index.ts:155-159`（"wrappers may change only `exec.signal`…"）均与基线原文一致 ✓。

### ⑤ 改动范围 — **PASS**
`git diff --name-status 452a04c0..86719028` = 仅 `s12-residual-evidence.md` + `seam-record-post-door-resolution.md`（均 M）；实现/测试/kit/runs 证据零改动；分支 worktree `packages|tests|dev` porcelain 空；本审查轮 token/porcelain/:3080 未触碰。

## 非阻塞 nit（不拦 PASS）
1. s12:179 "**Closed by this round**" 标题下含 post-door 条目——该条目自身已写「本节不写 closed/compliant；…不是验收结论」，但标题字面与 G-a 口径有张力，后续轮可把该 bullet 移出标题或改标题为 "Closed or recorded-by-ruling"。
2. s12:20 "closed or bounded here"（base 遗留措辞）同上，属同类张力，句内 "or bounded" 已缓冲。
