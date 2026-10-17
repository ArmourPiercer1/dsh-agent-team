# review-PTC-OUTER — W-PTC-OUTER 外层程序 I/O 旁路负控（PR#290 评论 6230116007 闭合位）独立终审

**裁决：PASS（通过）** —— 五项审查全部独立复现/亲验；PROBE-GATED 局部阻塞（分支③）成立；范围判定（"外层 fs/net 在 M-08 原计划受控对象内，非范围澄清"）**准确**。

- 独立 reviewer：qwen3.8-flash-next 会话（≠ 实现会话 9b944224），未参与本任务实现。
- 受审固定 SHA：`alpha5-ptc-outer` @ **`2bd9b2e2`**（基线 `c0333d8f` + 证据 commit `348f9989` + 收口件 `2bd9b2e2`）；一次性 worktree `.worktrees/alpha5-ptc-outer`。
- 评审复跑：port **3184** 预检自证空闲（跑毕 `P-PORT-RELEASED free=true`）；评审世界 `tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z`（runner 以 RUN 名命名并跑毕删除，`P-WORLD-DELETED`；前缀为 kit 硬编码，未改用 `a5ptc3-rev-*` 名——世界隔离性/一次性不受影响）；`:3080` pre/post 均 401 零触碰。
- 复跑证据：**`runs/reviewer-console.log` 末行 `== 27/27 criteria pass; failing=0`**（全套 38 行 PASS/INFO 在册）。

## ① 范围判定 ＝ 成立（我同意；无反证）

逐行亲查原文（grep -n 实点，非转述）：

| 出处 | 亲验结果 |
| --- | --- |
| `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md:55` | M-08 行未测项列逐字含「**外层直接 fs/net OS 级拒绝负控**」；禁止路径列逐字含「以"内层 guard 通过"替代外层防护」；默认处理列「Strict `run_code` 禁用直至 PoC-6a 通过（或明示窄固定策略）；两案皆不成→禁用+记录 precise seam」 ✓ |
| `post-poc-technical-design.md:123 / :125 / :66 / :191 / :214 / :22 / :21` | 逐行在位且引文逐字相符：`:123` 外层 Node 直接 `fs`/`net` 由独立受限 PTC Runtime 负责；`:125` 测试必须包含 outer code 直接 I/O；`:66` 外层 Node 需要受限进程；`:191` 仍需每调用 Grant 注入/OS 拒绝负控；`:214` D5 受控对象=per-Member/per-call OS 文件网络效果；`:22` 每调用真实策略注入仍需专项验证；`:21` network:deny 必须有独立证明 ✓ |
| `dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json:552/569/574/616` | M-08 `row_id`@552、`status_now=TRANSITIONED-LIVE`@569、`allowed_transitions=[LIVE,PROBE-GATED]`@570-573、`forbidden_outcomes=[PASS,SUPPORTED,REQUIRES-LIVE-WIRING-as-terminal]`@574-578、`acceptance_scope=criterion-level-fixture`@616 ✓ |

⇒ 外层程序自身 fs/net 效果**确在** M-08 原计划受控对象内；本轮**不是**「外层明确不保证」的范围澄清。裁决走分支③（实测有缺口/注入不能）而非范围豁免，方向正确。

## ② 抽 4 复跑 ＝ 全部独立复现（评审侧全量真跑 REALM+LIVE，27/27）

| # | 复跑项 | 评审实测（新路径、新世界、新会话） |
| --- | --- | --- |
| 1 | 真 Landlock 域（ABI v4 亲探 `{"kind":"abi-available","abi_version":4}`）fs 写禁区 | **`R-CONFINED-WRITE-OSDENIED` PASS**：`EACCES: permission denied, open '…/realm-world/confined/forbidden/write-target.txt'` 且 `exists=false`（文件不创建，评审侧普查独立于程序自报） |
| 2 | 直接 spawn 子进程继承域 | **`R-CONFINED-SPAWN-WRITE-OSDENIED` PASS**：`spawn` 本身直通（`A5PTC3-SPAWN-RAN`+uid），子进程写禁区 rc=2 `/bin/sh: cannot create …: Permission denied`，`childTarget=false` ⇒ 域跨 fork/execve 继承复现 |
| 3 | `net.connect` 真域腿 | **直通复现：1 conn / 62 B**，listener 实收 `A5PTC3-OUTER-HELLO …-confined\n`（与 canonical 62 B 逐字节同形）⇒ 网络非文件效果、域零覆盖 = **缺口如实登记**；`invert-check.mjs` 离线复算（已录数据）：net 判据 `discriminates=false`，文件写族判据 `discriminates=true` ⇒ 负控有判别力、缺口未被计成防护 |
| 4 | LIVE 默认姿态整程序 fail-closed | **`A-TYPED-REFUSAL-BEFORE-EXECUTION` PASS**，typed 答复逐字复现：`Error: code run failed (sandbox-unavailable): sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. … File sandbox: workspace-write.`；`A-ZERO-SIDE-EFFECTS`（连工作区内 CONTROL 写都未发生）+ `A-NO-OUTER-OS-CHILD`（/proc 采样零外层子进程）⇒ **拒绝在 spawn 之前**复现 |

配套面同样复现：能力未暴露分支不适用（realm 内 `node:fs/child_process/net` 动态 import 全成功、`process.env` 键=空）；LEG B 加宽面 `approval/asked` 后**无** `tool/result`（canonical 会话日志末三事件 seq31/32/33 亲验）；LEG C 披露腿完整跑通且 LEG A 目标此后逐字节未变。

## ③ 「公开 seam 不能注入 per-call Grant」复现文件 ＝ 实跑复现

评审复跑中由 `a5ptc3-outer-row.mjs` 真打公开面（`A-SEAM-CENSUS`，`runs/reviewer-console.log` 在册），与 canonical `legA-state.json → throwCensus` 逐字一致：

- `root_register` / `scope_register` → typed throw：`tool name "run_code" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`；
- `scope_restrict_deny` / `scope_restrict_allow` → typed throw：`tools.restrict() cannot name reserved PTC mode presentation transport "run_code"; restrict end-capability tools instead`；
- `ctx.set('ptcRuntime', …)` → 拒：`cannot set property "ptcRuntime" in multiple fibers`。

四处 typed throw + ctx.set 拒 ⇒ 「本次 Grant」无法经公开 seam 变成外层进程的真实文件域；外层 bootstrap spawn 无公开挂点。精确局部阻塞的表述（整程序级 mode 粒度之外注入不能）与实测一致。

## ④ host-identity 实测行 ＝ 在位且 == pin；retest 项声明＝基本成立（附一条注记）

- `host-identity.json`/`host-identity-post.json`（pre/post，`identityUnchanged=true`）+ `criteria.json` `P-HOST-IDENTITY` PASS 在位。
- 评审独立活测（非读记录）：`.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use` **HEAD `639ed015397290b3745d163aafe02ffee4aa3f84` == `tests/paths.mjs` `TEST_USE_BASELINE_SHA`、porcelain=0**；launcher `cee10ed55f12…`（17587 B，本人 sha256sum 重算相符）、子入口 `1a5631d2a929…`、`bin.js` `1a03dee18683…`（活树重算相符）。评审复跑自证 `runnerBranch=alpha5-ptc-outer@2bd9b2e2`。
- **注记 N2**：TESTUSE-WINDOW-AUDIT T1 的字面处方是「在 ptc-chain worktree（或等价重建）**复跑 matrix 轮**，或把该轮主张句改成带出处的实测行」。本轮以**同构建身份的机测行**（另一 host-依赖轮、同升级树）覆盖，且措辞已限定为「同构建身份复测」——机测实质已供，但 ptc-chain 05:08:09 那轮的相对路径树身份仍未被直接实测（该树现已不存在）。审计自评风险=中低且「判定不依赖 host 读数」，故记 **note 级**，不构成缺口。

## ⑤ 矩阵行未翻 + COMPOSED-LIVE 收窄措辞三处一致 ＝ 成立

- `git diff c0333d8f..2bd9b2e2 -- pr8/matrix-machine.json docs/plans/memo/alpha5-tool-io-governance/` **空**；M-08 `status_now` 仍 `TRANSITIONED-LIVE`、`final_declaration=null` ⇒ writer 未翻行，行级 LIVE 仍=提案值。
- 收窄措辞三处在位且语义一致（「仅内层 per-call 载荷执行边」/「per-call 载荷执行边」）：`w-ptc-outer/pr290-comment.md:89`（"只覆盖**内层 per-call 载荷执行边**……**不是**外层防护的证据"）、`w-ptc-c2/README.md:63`（"矩阵判据语义 = per-call 载荷执行边"，bootstrap spawn 无公开挂点不主张）、`w-ptc-c2/review-PTC-C2.md:45`（同口径）。与 S0:55 禁止路径（以内层 guard 通过替代外层防护）无冲突。

## 其余亲验（红线与卫生）

- 零上游改/零私有 API/零权限扩：row 只经公开 seam（profile-patch row insert、presentAs('ptc')、guard、around-seam、`sandboxPolicy.resolve` 公开读；判断腿 `writeCallsByThisRow=0`）；`:3080` 仅 GET 探针 pre/post=401。
- 已提交证据泄漏扫描（含 zstd 会话日志解码）：无 `token=`/`dsh-auth-` 残留；`instance.log` 已脱敏。
- **注记 N1（微小，不改判）**：README/commit 宣称的「exit 0」——runner 结尾只设 `process.exitCode` 且未关自有 decoy listener，进程打完 `== 27/27` 行后不会自行退出（评审复跑实测需外部终止）。应读作 **GREEN 判定（failing=0，`criteria.json` 在册）**；建议后续 kit 收尾时 `close()` 监听器或显式 `process.exit`。

## 结论

W-PTC-OUTER 对 PR#290 评论 6230116007 的闭合成立：范围判定准确（外层 fs/net 在原计划受控对象内，非范围澄清）；三态裁决 **分支③ PROBE-GATED + 精确局部阻塞**（外层可信文件域只能整程序级给定、公开 seam 不能注入 per-call Grant、网络效果无 OS 机制覆盖）经评审侧全量复跑（27/27，8 INFO）独立证实；缺口与披露面均如实登记、未被计成防护；矩阵行未动。**PASS**。行级 LIVE 终裁仍归 PR8 正式轮汇总位（本轮不代行）。

*评审复跑证据全集：`runs/reviewer-rerun-outer-2026-10-17T06-53-28Z/`（criteria/host-identity pre-post/realm 真值表/legA-C 状态/会话日志/`reviewer-console.log`）。*
