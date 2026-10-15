# P0-7 独立 Reviewer 报告 — R2（delta 复核，R1 之后新增提交面）

> **Reviewer**: Alpha.5 P0 **第二独立 Reviewer（R2，delta 复核）**（非实验执行者、非 R1、独立会话）。
> **模型逐字自报（powered-by）**：系统提示原文 = `You are a coding agent powered by the qwen3.8-flash-next model.`（模型名 `qwen3.8-flash-next`）。
> **复核起点 HEAD**：`afc5e039413ee4a0e3d84a22ee391ef200b791cd`（= 预期 afc5e039…，分支 `exp/alpha5-poc-20261016`，本会话第一条命令实测）。
> **⚠ HEAD 会话中漂移（如实记录）**：本 Reviewer 复跑期间协调者又落一提交 `9e422ff5b37a219f4ce87e5175165ce66d357400`（2026-10-15T21:51:49Z，`docs: decision.md`，+29 行，纯文档）。本会话最终实测 HEAD = `9e422ff5…`；delta 裁决面 = `git log --oneline c46ffb76..HEAD` 的 **8 个提交**（df5b27df / 6fbeb2fe / eaec6c55 / 7233f2ed / 42867b7b / 25cfa3c1 / afc5e039 / 9e422ff5）。decision.md 全文已读，无 GO 主张（见 §4）。
> **pinned test-use HEAD**：`639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）；`git status --porcelain` = **0 行**，且**在全部脚本复跑（含 strace 子进程）之后复测仍为 0**（会话首尾各实测）。
> **裁决口径**（同 R1）：VERIFIED = 本 Reviewer 亲手复跑/亲读源码直接证实；REFUTED = 亲手证据与声称矛盾；NOT_VERIFIED = 本轮无行为级证据可裁（含已如实声明的 PENDING/NOT_RUN/ENV_BLOCK，不算缺陷）。
> **前置阅读**：`08-review/p07-review-R1.md`（PASS @ c46ffb76）、`docs/ROUTER_RULES.md` §0、guide §6.2（`docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md`）。

## 0. 复跑造成的证据面变更（诚实披露）

亲手复跑（脚本均为 re-runnable 设计）按脚本自身行为**重写**了以下 tracked 工件（非手改；`git diff` 逐行核对：仅 `recorded_at`/`team_HEAD`/`worktree_HEAD`/pid/strace 时间戳/rg 运行序抖动字段，**无任何 verdict 翻转**）：

- `00-baseline/p00-result.json`、`01-routing/p01-result.json`、`02-search/p02-result.json`、`03-fs/p03-result.json`、`05-ptc/p05-result.json`、`06-lsp/p05-result.json`（经逐脚本复跑 ×2 + `run-all.sh` ×2）；
- `03-fs/probe-scratch/`（fixture-tree 整体重建 + 11 份 per-leg strace log 重写）；`02-search/probe-scratch/fixture-tree` 重建；`05-ptc/`、`06-lsp/` 的 `probe-scratch/` 重写（含虚构服务器脚本）；
- `03-fs`/`05-ptc`/`06-lsp` result header 中 worktree HEAD 字段前进（25cfa3c1 → afc5e039 → 9e422ff5，因漂移分轮记录，脚本自身行为）；
- 本 Reviewer 手写文件 = **仅本报告**。`:3080` 全程未触碰；无 commit/push；无扩权；`p06-host-smoke.sh`/`04-process` 探针未复跑（不在本轮指令复跑清单）。

## 1. delta 裁决表（R1 之后新增面）

| # | 裁决项 | 裁决 | 亲手证据（命令→关键输出/退出码） |
|---|---|---|---|
| 1 | **P0-2 复跑真实性（12/12 真 rg 对照）** | **VERIFIED（fixture 级）** | `node 02-search/p02-search-runner.mjs` ×2 → EXIT=0/0，两轮日志逐字一致（除 `recorded_at`）；24/24 断言 + 12/12 例。抽 3 例（C04/C08/C09）用 result JSON 内**原样 argv** 在记录 cwd 下亲手重跑 rg：exit 全对（0/0/0）；C08 value digest **逐字节复现**；C09 stdout raw sha **逐字节复现** + value digest 按 `--sort=modified` 序复现；C04 265 命中**多重集逐条相等**（顺序不可复现系 rg 并行遍历 + JSON footer elapsed 计时 → 见 §4-N1）。argv[0] = pinned `@vscode+ripgrep-linux-x64` 真实 rg 15.0.0（非替身）。 |
| 2 | **R2 前置缺失（fiber PENDING）原文与 result JSON 对合** | **VERIFIED** | result JSON `observations.srch01_r2_prereq`：`plugin_call_threw=null, fiber_state=0(PENDING), registered_tools=[], grep_resolution="undefined", logger_lines=[]`（我的复跑复现）。引文对合 pinned 树：`tool-fs-search/tests/tools.spec.ts:257` = `it('stays pending until ctx.subprocess exists (inject)', …)` **逐字命中**；`vendor/cordis/src/fiber.ts` `PENDING — waiting for required services` 注释实存（精确行 140-146，result 引 147-156 = enum 本体，一线之偏，§4-N3）。 |
| 3 | **P0-3 复跑真实性（11 腿 + strace 双通道）** | **VERIFIED（fixture 级）** | `node 03-fs/p03-fs-runner.mjs` ×2 → EXIT=0/0，11/11 腿 PASS、`strace_available=true`、`junctions_unchanged=true`；committed vs 复跑 strace 计数**逐位一致**（FS-01.neg secret=0 / native-bypass secret=1 / FS-02.neg=0 / FS-03 specialA=1 / FS-04.hardlink 双路径=0 / traversal /etc/passwd=0 / spaces `sp␠`=1+trimmed 仅失败探针=1）。 |
| 4 | **FS-01.neg 反"恒真"亲手 strace 复跑（--child 孵化形态）** | **VERIFIED** | 在 runner 之外亲手：`strace -f -qq -e trace=openat,openat2,open,creat -s 512 -o <log> -- node p03-fs-runner.mjs --child=FS-01.neg` → EXIT=0、child verdict=PASS、log 中**无任何 `private/secret.txt` open 行**（成功 open=0；连失败尝试都没有——检查先于 open 的操作性定义成立；仅 `private/` 目录被 readdir 用于策略编译）。**同通道正控**：`--child=FS-01.native-bypass` → `openat(AT_FDCWD,…/private/secret.txt, O_RDONLY\|O_CLOEXEC) = 20`（1 次成功 open）⇒ 观测通道有检出能力，0 计数是真信号非测量失效。 |
| 5 | **FS-04.hardlink (dev,ino) 拒绝非自我实现** | **VERIFIED** | 亲读 runner 源码：拒绝账 = `compileDenySets()` 对**真实 `private/*` 现场 stat** 的 `dev:ino` 集合（策略编译期）；`resolveTarget` 第(4)步 `!deniedRealPaths.has(rp) && deniedInodes.has(inoKey) ⇒ ALIAS_DENIED`。该腿路径 `allowed/secret-alias.txt` 在 m-alice 的 allowed readDirs 内（第(5)步 containment 必过；FS-01.pos 读 allowed/ 成功证明 allowed 路径本身可读）⇒ 拒绝只能来自 inode 查表；若别名是独立拷贝（不同 inode）则读取会成功——非恒真。腿内 `sameInode` 由现场 stat 自证。亲手 `--child=FS-04.hardlink` strace：`secret.txt` 与 `secret-alias.txt` **两条路径 0 条 open 行**、verdict=PASS、EXIT=0。 |
| 6 | **P05-PTC-5 原体增量由 obs 计数而非文本** | **VERIFIED** | 亲读 `00-baseline/p00-fixture.mjs`：`countingTool` 在 ToolDefinition.execute **体内** `obs.push({event:'body',…})`（"counters are the primary evidence channel, not return text"）；`05-ptc/p05-runner.mjs` `countOf()` 数 `obs` 中 body 事件。复跑输出：P4 后 `native_body_counter=1`，P5 guard-deny 后 `native_body_counter_delta_after_guard: 0`（=1-1），断言式 `countOf(...)===1` 若不满足即 FAIL；guard reason/runLog 仅为辅证。两轮 EXIT=0，8 腿 = 5 PASS + PASS-CITED/CITED-PASS + NOT_RUN(PTC-8 如实)。 |
| 7 | **06-lsp L3 共享 pid 判定来自真实 spawn** | **VERIFIED（虚构服务器声明在案）** | pid 由**被 spawn 的服务器进程自身** `process.pid` 经 stdio 回报（hover 文本 `pid=` 字段）；L8 用 `process.kill(pid,0)` 证明两 pid dispose 前存活、dispose 后消失（⇒ 真实 OS 进程）；L5 不同 workspace → 不同 pid（共享由键驱动）。我的两轮：run1 pid 42/42 共享 + 42 vs 51 分离；run2 pid 129/129 + 129 vs 138——**每轮 pid 变化**证明来自现场 spawn。`timeout 120 node 06-lsp/p05-runner.mjs` ×2 → EXIT=0/0。FICTIONAL 服务器与"策略仅为调用方侧标签（seam 无通道=结论本体）"在 notes.md/result header 双重声明。 |
| 8 | **P0-5 PTC 腿复跑** | **VERIFIED（fixture 级）** | `node 05-ptc/p05-runner.mjs` ×2 → EXIT=0/0；P3 拒绝原文 + 原体 0；P4 正控原体 1 + dispatch 事件对；P5 见 #6；P8 维持 NOT_RUN（无外层真实进程，声明未越界）。 |
| 9 | **run-all.sh 全绿 + 幂等** | **VERIFIED** | `bash run-all.sh` ×2 → EXIT=0/0；内部 P0-0/P0-1/P0-2/P0-3/P0-5-ptc/P0-5-lsp 六段 EXIT 全 0（两轮）。 |
| 10 | **P0-3/P0-5 报告行、NEG-9..12、EXECUTION-LOG 行 vs result.json** | **VERIFIED（1 条计数小瑕疵，低报方向）** | 报告 P0-3 行"11/11 PASS + strace 孵化"、P0-5 行"8 腿(7 绿+1 NOT_RUN)"与 result 逐一吻合；NEG-9（L3 opens=2 同 pid、L5 分离、L7 keyA===keyB）/NEG-10（L4/L6 forbidden 读 ok=true，虚构数据）/NEG-11（ALIAS_DENIED + 双路径 strace=0，我亲手复现）/NEG-12（bypass dispatchable+泄漏+strace=1，我亲手复现 open=1）全部与复跑事实一致；EXECUTION-LOG P0-2 行"首轮1(3实缺)→二轮0→三轮幂等0"与 notes §3 三处真实失败记录一致。**瑕疵**：EXECUTION-LOG 写 "LSP 10 腿"，实际 11 腿（P05-LSP-0..10）——少计，低报方向，§4-N2。 |
| 11 | **族 verdict 表无 GO** | **VERIFIED（零误用）** | `grep -n 'GO'` 于 P0-SELECTION-REPORT.md（5 处）/decision.md（2 处）/02+03+05+06 notes（2 处）：逐处判定全部为否定/边界语境（"本报告不含任何 GO""GO 只能来自真实 pinned Host""禁写 GO""本文件不是产品 GO""未用 mock 出 GO"等）；§2 族 verdict 实际值 = INCONCLUSIVE×3 / ENV_BLOCK / BOUNDED-DEFER / NOT RUN，**无 GO-R2/GO-R3/FORK-ELIGIBLE**。 |
| 12 | **R1 报告（08-review 内 tracked 版）与 R2 所见一致** | **VERIFIED** | 所读 = HEAD tracked 版（工作树无 M）；其对 c46ffb76 面的主张与我本轮间接复现不冲突（p00 5/5、p01 12/12 经本轮 run-all 再次 EXIT=0 且 result diff 仅时间戳）；R1 findings 处置属实：F1 `dev/tests/` **已不存在**（实测 `No such file or directory`，EXECUTION-LOG 有 rm 留痕行）；F2 P0-0 行已回填 **5/5**；F3 工件已 tracked。 |
| 13 | **pinned Host 未变（本轮全程）** | **VERIFIED** | 会话开始与**全部复跑之后**：`git -C W/tests/deepseek-harness-test-use rev-parse HEAD` = `639ed015397290b3745d163aafe02ffee4aa3f84`，`status --porcelain` = 0 行。 |

## 2. 亲手复跑记录（命令 → 结果）

1. `node …/02-search/p02-search-runner.mjs` → EXIT 0 / 0（幂等两轮；日志一致）。
2. `node …/03-fs/p03-fs-runner.mjs` → EXIT 0 / 0（11/11，strace=true，junctions 不变；~2s/轮）。
3. `node …/05-ptc/p05-runner.mjs` → EXIT 0 / 0。
4. `timeout 120 node …/06-lsp/p05-runner.mjs` → EXIT 0 / 0。
5. `bash …/run-all.sh` → EXIT 0 / 0（六段全 EXIT=0）。
6. `strace -f -qq -e trace=openat,openat2,open,creat -s 512 -o … -- node p03-fs-runner.mjs --child=FS-01.neg|FS-01.native-bypass|FS-04.hardlink` → EXIT 0/0/0（负控 0 open；正控 1 open 检出；硬链接双路径 0 open）。
7. 3 例 rg 独立重放（C04/C08/C09，原样 argv+cwd）+ digest 复算；pinned 引证锚点亲读（tools.spec.ts:257 逐字、fiber.ts PENDING 注释）。
8. `git -C W/tests/deepseek-harness-test-use rev-parse HEAD` / `status --porcelain`（前后各测）；`git -C W rev-parse HEAD`（漂移记录）；`grep -n 'GO'` 各报告面；`ls W/dev/tests`。

## 3. §6.2 三项 R1-NOT_VERIFIED 的 delta 裁决

| §6.2 项 | R1 状态 | R2 delta 裁决 |
| --- | --- | --- |
| **同 Agent 并发 Grant（FS-03）** | NOT_VERIFIED（P0-3 未提交） | **VERIFIED（fixture 级）**：FS-03.race 已提交且我两轮复跑 PASS——同成员两份 one-shot grant 并发：B 在 I/O 前事件栅栏 await，期间 A 消费 GA；B 用自身 grant 越界=`GRANT_SCOPE_DENIED`、用他人 grant=`GRANT_CALL_MISMATCH`、已消费重放=`GRANT_CONSUMED`；B 输出零泄漏；special-a OS 级 open 恰 1（strace 复现 committed 计数）。grant 消费账本为 adapter 级、callId+member+scope 三查先于任何 open。**真实宿主级串扰仍未裁**（族 verdict 保持 INCONCLUSIVE，报告一致）。 |
| **read-before-write（+Spill）** | NOT_VERIFIED | **read-before-write：VERIFIED（fixture 级，FS-02.refusal）**：write-only grant 下 str_replace 得 typed `READ_REQUIRED_FOR_EDIT`；旧内容**从未被读**（strace 0 open——非"读了不返回"）；返回体无旧内容子串；文件 sha256+mtimeNs 不变。Spill（SRCH-04）：仍 **NOT_VERIFIED**（NOT_RUN，缺项清单已登记），无夸大。 |
| **缺失 Sandbox fail-closed** | NOT_VERIFIED | **NOT_VERIFIED（如实维持）**：本轮新增证据仅 = SRCH-01 前置缺失形态（fiber PENDING **静默悬挂、零注册**——这本身不是 fail-closed，是"静默消失"，decision.md 硬约束 #3 已正确要求实施侧必须 throw）+ P0-4 OS 强制缺失 ENV_BLOCK。**"缺 Sandbox 时组合被拒绝"的行为级实验仍不存在**，任何族不得据此称 INV-9 已证。 |

## 4. Observations（不影响裁决，登记）

- **N1（复现性注记）**：p02 部分 case 的 `stdout_summary.sha256` 非跨运行复现锚（rg JSON footer 计时 + 并行遍历顺序；committed vs 复跑 diff 即此）。各例断言均落在 exit/classification/value 集/计数面，故判定稳定——建议 notes 注明 sha 属"当轮快照"。
- **N2（低报）**：EXECUTION-LOG "LSP 10 腿" 实为 11 腿（P05-LSP-0..10）。
- **N3（一线之偏）**：R2 前置引文标 `fiber.ts:147-156 注释`，PENDING 语义注释精确在 140-146（147-156 = enum 本体）。
- **N4（HEAD 漂移）**：见文首——本 delta 复核实际覆盖 afc5e039 + 9e422ff5；若 Gate 以"精确终态 HEAD"为准，该终态在评审期间仍可能前进（分支与协调者共享，03-fs notes 已预先声明此性质）。

## 5. 总体裁决

**PASS（对 R1→9e422ff5 的 delta 复核面）**：R1 之后全部已提交主张（P0-2 SRCH-03 12/12 真 rg 对照 + R2 前置 PENDING 原文、P0-3 11/11 腿 + strace 双通道、P0-5 PTC 8 腿 + LSP 11 腿（HAZARD/CORE 素材为记录性判定非安全 PASS）、NEG-7..12、集成报告/decision.md/EXECUTION-LOG 行、R1 findings F1/F2/F3 处置）经我**亲手复跑（各≥2 次含幂等轮）/亲读源码/独立 strace 负控+正控/独立 rg 重放**逐条 VERIFIED（fixture 级口径），**零 REFUTED**；反"恒真"四抽验（FS-01.neg 0-open 且同通道正控 1-open、FS-04 对象身份拒绝非路径自我实现、PTC-5 原体增量=obs 计数、LSP pid=真实 spawn）全部通过；`grep GO` 零误用；族 verdict 无一项被写成 GO；PENDING/NOT_RUN/ENV_BLOCK 声明与 result JSON 事实一致。**§6.2 三项 delta：FS-03 与 read-before-write 升格为 fixture 级 VERIFIED；缺 Sandbox fail-closed 行为级仍 NOT_VERIFIED。**

**声明：本 PASS 仅指"delta 证据面诚实、可复现、无夸大"。PASS ≠ P0 关闭（P0 = EXECUTED-PARTIAL：SRCH-04/PTC 外层/LSP 真实宿主/Team world stage2b/真实宿主 INV-1 全覆盖仍 PENDING/BOUNDED-DEFER/ENV_BLOCK）≠ 任何工具族 GO（GO 只能来自 pinned 真实 Host 实证，guide §5/§6.2 明文）。**

## 6. 本 Reviewer 实际使用的全部命令与退出码

```bash
git -C W rev-parse HEAD / branch --show-current / log --oneline c46ffb76..HEAD   # 0（afc5e039 起步）; 后续同 #0（9e422ff5 终态）
git -C W/tests/deepseek-harness-test-use rev-parse HEAD                          # 0 → 639ed015397290b3745d163aafe02ffee4aa3f84
git -C W/tests/deepseek-harness-test-use status --porcelain                      # 0 → 0 行（会话开始 + 全部复跑后各测）
git -C W status --porcelain / diff --stat / diff -U0 <六个 result.json>          # 0（复跑副作用核对）
git -C W show HEAD:…/p03-result.json（strace 计数 committed vs 复跑对合）          # 0
node …/02-search/p02-search-runner.mjs                                           # EXIT=0, EXIT=0
node …/03-fs/p03-fs-runner.mjs                                                   # EXIT=0, EXIT=0
node …/05-ptc/p05-runner.mjs                                                     # EXIT=0, EXIT=0
timeout 120 node …/06-lsp/p05-runner.mjs                                         # EXIT=0, EXIT=0
bash …/run-all.sh                                                                # EXIT=0, EXIT=0（内部六段 EXIT=0）
strace -f -qq -e trace=openat,openat2,open,creat -s 512 -o <log> -- node p03-fs-runner.mjs --child=FS-01.neg            # EXIT=0（secret open=0）
strace … --child=FS-01.native-bypass                                             # EXIT=0（正控 open=1 检出）
strace … --child=FS-04.hardlink                                                  # EXIT=0（双路径 open=0）
node（3 例 rg 原样 argv 重放 + digest 复算；obs/leg 计数提取；result JSON 字段核对）  # EXIT=0
sed/grep（pinned fiber.ts / tools.spec.ts 引文锚点；grep -n 'GO' 各报告面；ls W/dev/tests）  # 0/0/0（ls=2=不存在=预期）
```

（W=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016；全程未触碰 :3080，未 commit/push，未扩权，除本报告外零手写文件。）

## 7. Addendum — 第二轮复跑确认（对 HEAD `9e422ff5` 全套各再 ×2）与协调者工作树变更披露

- **复跑确认轮（本 Reviewer，均对 HEAD 9e422ff5）**：`node 02-search/p02-search-runner.mjs` EXIT=0 ×2；`node 03-fs/p03-fs-runner.mjs` EXIT=0 ×2（11/11 PASS、strace=true、junctions_unchanged=true）；`node 05-ptc/p05-runner.mjs` EXIT=0 ×2；`timeout 120 node 06-lsp/p05-runner.mjs` EXIT=0 ×2；`bash run-all.sh` EXIT=0 ×2（内部 P0-0/P0-1/P0-2/P0-3/P0-5-ptc/P0-5-lsp 六段 EXIT 全 0）。**至此每脚本在本 Reviewer 会话内累计 ≥4 次 EXIT=0（含幂等轮）**。
- **复跑后终测**：`git -C W/tests/deepseek-harness-test-use rev-parse HEAD` = `639ed015397290b3745d163aafe02ffee4aa3f84`、`status --porcelain` = **0 行**；HEAD 未再移动（仍 9e422ff5）。
- **协调者工作树变更（非本 Reviewer 所为，如实披露）**：确认轮期间 `EXECUTION-LOG.md`（tracked）出现**未提交**工作树修改：① N2 已修（"LSP 10 腿"→"LSP **11 腿**（P05-LSP-0..10…）"，与我实测一致）；② 新增一行登记本次 R2 delta 复核（代理 de223951，其摘要与本报告一致，N3 精确行注记入内）。该 diff 属协调者对 R2 findings 的处置，**未 commit**（HEAD 仍 9e422ff5）；其内容与我所见事实一致，不改变任何裁决。本 Reviewer 对该文件的唯一动作=读。
- 裁决不变：**PASS（delta 复核面）；PASS ≠ P0 关闭 ≠ GO。**
