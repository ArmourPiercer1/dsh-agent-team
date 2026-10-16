# review-LaneC — Alpha.5 PR4（sandbox-provider/Landlock）独立审查  2026-10-16

代理（模型）=qwen3.8-flash-next / harness=DeepSeek Harness（分列）。**≠writer 独立会话**。
对象 = origin/alpha5-pr4-prov @ `83e0ab9a`（base `db5cb5f7`，区间=1 commit，merge-base=db5cb5f7）。DORMANT。
审查件自身 = 本文件（push 同分支，docs-only）。运行侧 = 一次性 worktree `.worktrees/a5p4-rev`（+ 对照 `.worktrees/a5p4-rev-base` @ db5cb5f7），scratch 世界 `tests/homes/a5p4-*`（kit 自清），收尾回收 + df 行。未启动任何 DSH 实例（本 lane 无此需求，端口 3181 未用）；:3080 只读 GET（前后均 401，零操作）。

## ① C-PROC 契约 — **成立**

- 阶段闭集：`packages/runtime/sandbox-provider/phases.ts:27`（四元组）+ `:45-50`（LEGAL 转移表）+ `:64-68`（terminate 吸收态 / 跳步 typed 拒）。**对抗注入（reviewer 一次性 spec，13 例全拒，跑毕即删）**：probe→execute 跳步拒；execute→prepare / execute→probe / prepare→probe 回退全拒；terminate→任意（含自身）全拒；伪造名（`'EXECUTE'`/`'run'`/`'__proto__'`/`'constructor'`/含 NUL/空格变体）注入 `as` cast 后仍 `value-outside-closed-set`（`:57-63`）。
- 不可伪造阶段序（provider 层）：`provider.ts:159-160`（plans/consumedPlans 私有）+ `:244-246`（execute 仅认 prepare 产出的 planId， forged plan 对象拒且 fake-seam 观测 **零进程**）；二次 execute 拒、run 恰一次（`:244-249`，"second spawn without a second grant"）。
- FD 继承默认拒绝：`fd-inheritance.ts:46`（`close-all-undeclared` 常量）+ `:58-78`（重复 fd/闭集外 purpose/空指纹逐条拒）+ `:82-86`（payload 无松弛字段，结构上只有 declared+inheritDefault；reviewer 断言 keys 恰此二）；机制律 TOCTOU_A 入 `:49-50`，launcher 侧执行 `launcher/landlock-prelauncher.py:229-236,344-346`（close-all-undeclared 在 restrict/exec 之前）。
- 网络维度闭集：`network.ts:23`（`deny|restricted`，**无 unconfined 臂**）；**restricted 与 deny 同等待遇**：`:42-53` 两臂同码 `IO_POLICY_UNSUPPORTED`，且 `provider.ts:193` 在 probe/任何进程存在**之前**评估——reviewer 注入 `'deny'|'restricted'|'unconfined'`（闭集外伪造值）三例均 spawn 前拒、run 零调用。
- terminate≠cancel：`phases.ts:87-91`（settle 唯一裁决点 + `EXECUTION_TERMINATION_UNCONFIRMED`/`sideEffectUnknown` 诚实腿）；`provider.ts:299-325`（cancel 是 lease 上的 REQUEST；非本 provider 租约拒）。abort-before-exec=`prepare→terminate` 合法且构造性零进程（`phases.ts:47`）。

## ② p4t6 pin 疑点 — **动了共用 ledger 测试，构成 INTERFACES-v1 字面违例；但属 PR1/PR2 既立先例，判非实质违例**

- git diff --name-only db5cb5f7..83e0ab9a 逐项核清：31 文件 = 30 A（lane 目录新文件 + evidence）+ **1 M = `packages/testkit/test/p4t6-session-event-scan.test.ts`（+52/−2）**。writer 所报属实；scanner **审计脚本源**、根 registry、tsconfig、barrel 零改动（diff 无他项）。
- 改动性质：**append-only**——新增 `SCANNED_PATHS_A5P4PROV`（17 named files）+ 三处 `+SCANNED_PATHS_A5P4PROV.length` + tie 断言 `expect(…length).toBe(1090 - 1073)`；**未改任何既有 pin/端点他人值**。
- 端点两侧亲测（非转述）：lane 在位 → scanner=1090、p4t6 10/10；reviewer 将 lane 17 件移出树重跑 → `AssertionError: expected 1073 to be 1090`（与 `runs/p4t6-PRE-EXTEND-RED.log` 逐字同形）；base @ db5cb5f7 上 p4t6 10/10（1073 端点自洽）。tie=17 且 17 路径逐件 BY-PATH 断言在场（非仅总数推断）。
- 先例链：PR1 lane 改同文件（`615bdae7`，经集成入 base db5cb5f7 本体）；PR2 lane 改同文件（`alpha5-pr2-admission-grant` @ `4f2dfd08` "p4t6 scanner tie — record the PR2 increment (1073 -> 1087)"）；A4 时代即有 "pay the two instruments the lane owes (p4t6 path tie)"（`bdbccc72`）。**集成侧处置**：本 hunk 随 PR4 正常并入（与 PR1/PR2 hunk 同格）；集成时与 PR2 tie 做字面 rebase（列表并集、总数表达式=长度求和 → 1073+14+17=1104，无双重计数；仅注释端点链应改述 1073→1087→1104），属集成 owner 的常规冲突解决。**不判契约违例回退**；若集成 owner 坚持 INTERFACES 字面（"scanner"含 ledger 测试），唯一替代=hunk 移交集成 owner commit 重放——纯形式，历史失真，不建议。

## ③ PoC4 证据复跑 — **六腿全复现，EXIT=0**

`node dev/agent-workflow/evidence/alpha5/pr4/run-poc4.mjs`（reviewer 亲跑，scratch `tests/homes/a5p4-kit-…` 用毕自删）：abi-probe **abi-available v4**；selective **ENFORCE-CONFIRMED**；denyall **ENFORCE-CONFIRMED**（零规则鉴别器）；badhandled **DEMO-CONFIRMED**；fd-close **FD-CLOSURE-CONFIRMED**；confined-exec rc=0、deny 腿 `Permission denied`、**secret-leaked=false**。与 `runs/poc4-evidence.json` 判定逐项一致（跑后 `git checkout --` 还原被覆写 evidence，porcelain 复净）。
- 裸 syscall 真值独立复核：reviewer 自书 ctypes `syscall(444, NULL, 0, GET_VERSION)` = **rc=4 errno=0**，与 evidence 行 `[SC] create_ruleset(NULL,0,GET_VERSION): rc=4 errno=0` 一致（本宿主 Linux 6.8.0-142）。
- DEMO≠ENFORCE 区分明确：`launcher:195/208/224`（三腿三 verdict）；`realm-evidence.ts:59-64` `legIsClean`——ENFORCE-CONFIRMED 才净，badhandled 独享 DEMO-CONFIRMED 豁免（其存在意义=假 ABSENT 鉴别器），fabrication guard `:108-109`（enforced 的 evidence 必须解析到真实录入腿）。
- 存在性文案无内核断言违例：`probe-abi.ts:173`（`KERNEL_ASSERTION_FORBIDDEN` 含 kernel/landlock/enforc/abi/syscall）+ `:194-223` 全部 note 仅"presence only"句式；spec `a5p4-existence-wording.test.ts:19-51` 逐 banned-token 断言在场（lane 套件内 8 文件 56 例全绿，reviewer 复跑）。

## ④ 无回退 provider + HARD_PROFILE_ENABLED=false — **钉死**

- 无回退律：`provider.ts:8-10`（"run naked 不可表达"）+ `:168-171`（前置缺件拒）+ `:197-201`（**ABI 实测无解⇒SANDBOX_UNAVAILABLE，unconfined fallback forbidden by construction**）+ `:258-262`（launcher 答案不可解析/abi_unavailable⇒拒，never assumed benign）；launcher 无 unconfined 臂：`launcher:316-318,325`（FAIL-CLOSED exit 2）。reviewer 注入 abiVersion=null ⇒ prepare 拒 + run 零调用；unparseable answer ⇒ 拒。
- `HARD_PROFILE_ENABLED = false` 单点 `realm-evidence.ts:45`；双重钉：`a5p4-lane-hygiene.test.ts:147`（值断言）+ `:149`（全 lane 源码扫 `= true` 禁串）；`a5p4-realm-evidence.test.ts:53` 复钉。verifyHardProfileEvidence 负控群（realm 混淆/污腿/无行/非 enforced/无 mechanism/无 trustRoot/伪 evidence）全拒——纯证据问答，永不 grant/enable（`:6-9` 法源 PR2 冻结项 (ii)）。

## ⑤ NEW=0（抽验）— **通过**

lane 56/56（reviewer 复跑同数）+ p4t6 10/10；抽 5 红件 HEAD vs BASE 逐文件 1:1：t2-blueprint-hash **1/1**、p6t3-mediation **5/5**、rc2-persona-probe **3/3**、plugin-dsh-compat **6/6**（gitignored test-use 树缺=环境红，两侧同因）、p6t6-actions **1/1**。与 `runs/new0-baseline-compare.md` 红名单一致（POSTFIX2 21 红=base 21 红口径）。注：reviewer worktree 首跑 hygiene 曾 1 红=本审查环境未链 `packages/*/node_modules`（pnpm 工作区 hoist 件），补链即绿——**非 lane 缺陷**，lane 的 in-process tsc 自检（`a5p4-lane-hygiene.test.ts:91-107`）对 typeRoots 环境敏感属已知性质。

## ⑥ RED-first / token / porcelain / :3080 — **通过**

- RED-first 真实：`runs/a5p4-RED-first.log` = 8 文件全红、`Cannot find module '../sandbox-provider/*'`、0 tests（writer worktree `.worktrees/a5-pr4prov` 路径在场相，实现前中间态）→ GREEN 56/56。56 例=红先规格集合，reviewer 全量复跑绿。
- token：evidence 全件 grep `token=|api[_-]?key|PRIVATE KEY` = 1 命中=lane-c-notes 描述该 grep 的自指行本体，**零真实凭据**；合成字面量仅 TOP-SECRET-*/SYNTHETIC-*。
- porcelain：审查 worktree 除本审查件与 reviewer 注入件（删）外净；`tests/deepseek-harness-test-use` porcelain 空、HEAD=`46a7f68b09`（基线未动）；主检出零接触。
- :3080：仅 GET，操作前后均 401（token 门未触），无任何写操作。

## 观察（非阻塞，随 PR5 装配处置）

1. `provider.ts:250-288`：launcher 回报的子进程退出码（`answer.rc`，含 restrict 失败 127/exec 失败 126）未入 RunOutput/receipt——无泄漏（confine 先于 exec，126/127=未跑裸），但 PR5 消费面需退出码时 seam 缺值。建议 PR5 接线时补 rc 面（集成期评审后的 seam 扩展，非本 lane 回退项）。
2. `provider.ts:202-205`：enforcement-leg verdict 仅在 `hardDimensions` 非空时前置把关；默认未设时 ABI 应答但 leg MIXED 的宿主可 prepare（capability 行诚实报 untested，且 launcher 腿仍 fail-closed，无裸跑腿）。DORMANT 无消费者成立；PR5 装配 hard realm 时必须配 hardDimensions（本 lane 交付的 verifier 即为此备）。
3. 同步 provider 的 `requestCancellation` 直接落 terminated（`:305-308` 注释：spawnSync 语义=已 reap）；`cancelling` 态留待 PR5 异步接线走 `settleTermination`——与 C-GW"已开始/未开始"分型的完全对齐在装配期验证，本 lane 构造（abort-before-exec 零进程腿 + lease 镜像）不与之冲突。

## 判定

**G-d 集成会话 = 可**（投机通过级——证据充分，残余风险均可由下述条件在集成期闭合）：
1. ledger tie 与 PR2 的 1087 链合并（并集+1104 端点注释改述），集成 owner 常规冲突解决；
2. PR5 接线前落实观察 1（退出码面）与观察 2（hard realm⇒hardDimensions 必配）；
3. 维持 DORMANT：audit 消费者集（现 4 件全 PR1）在集成装配前不得引入 lane 消费者。
