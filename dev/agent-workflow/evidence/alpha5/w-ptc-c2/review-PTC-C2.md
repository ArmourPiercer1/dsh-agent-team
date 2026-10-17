# review-PTC-C2 — W-PTC-C2 整行 LIVE 宣称终审（COMPOSED-LIVE）

- reviewer = **W-PTC-C2 独立 reviewer**（session-dbbb6cc1，qwen3.8-flash-next，≠writer 会话）
- 受审 = `alpha5-ptc-chain` @ **`87403917898295a0f1e12f96297f386a0547322e`**（含 `626daeec` 主提交）
- 一次性 worktree = `.worktrees/a5ptc2-rev-c2w`（detached @87403917）；本 reviewer 全部复跑端口 **3184**（跑前 bind 自证空闲 + 跑后自证释放），世界 `a5ptc2-rev-*`（跑毕删除）；宿主 = 共享只读 built 树 @`639ed01539`（porcelain 0 前后亲验）；**:3080 稳定实例 pre/post=401 零触碰**；回报无凭据（token 全 REDACTED/缺席，唯一 grep 命中 = kit 常量 `'a5ptc2-mock-key'` 字面量，与在册 kit 逐字同）。

## 判定

**PASS —— COMPOSED-LIVE 成立**（M-08 `TRANSITIONED-LIVE` 提案值在本 reviewer 终审位成立；五项从严审查全部独立复现，未发现跨 run 拼缝、未发现口径升格。终裁语义按矩阵词表仍归 PR8 正式轮汇总，本文件即该汇总位的 reviewer 证据之一）。

## ① 同链性（终审核心）

**内层执行边确为 Lane C 受限 provider，同一 run 内证据互指，无跨 run 拼缝。** 证据互指（canonical 轮 `runs/compose-2026-10-17T05-07-10Z/`，writer 在册；及本 reviewer 独立复跑轮 `runs/compose-2026-10-17T05-16-31Z/`，同构复现）：

| 互指项 | canonical 轮 | reviewer 复跑轮（本会话亲产） |
| --- | --- | --- |
| 外层 /proc 真进程 | ledger `plugin-apply pid=39` ↔ outerChildren `{pid:110, ppid:39, cmd=…/ptc-runtime-node/lib/process.js}` ↔ **PTC 程序体内自报 `process.pid=110`**（经控制管道飞回 runResult） | `pid=38` ↔ `{pid:109, ppid:38}` ↔ runResult `pid:109` 三方一致 |
| 内层 callId 链 | guard 行 seq2..5 `call-yy0ajd9q:ptc:1..4`，全部 `rootCallId==外层 callId`、`exec.parent` 在场（inner=true）、逐次有序、ceSnapshot 0/1/2/2 | `call-a3vyn8ke:ptc:1..4`，同形状复现 |
| launcher sha | P-LAUNCHER `sha256=cee10ed5…`（tracked 文件） | 本 reviewer 亲自 `sha256sum` = `cee10ed55f12123f84716e57a5d46b3d0e9abe2394161dd061fb846a4ebfb458`，与证据逐字一致；且 spy 代码位 `real.run([launcherPath, …argv.slice(1)])` 证明**实际 execve 的 argv[0] 恒为该 sha 钉记的 tracked 文件**（dist 面 identity 仅记账；见发现 F1） |
| Landlock ABI 行 | 同 ledger `abi-answer abiVersion=4`（05:07:11.471Z）与 exec-answer（05:07:11.778/810Z）同 run 同秒级 | `abi_version=4`（05:16:32.780Z）与 exec-answer pid 117/119（05:16:33Z）同 ledger；宿主内核 6.8.0-142 预检 `--abi-probe` 亦 =4 |
| 同 run_utc 同世界 | 全部证据（criteria/state/ledger/console/receipt）同 stamp `2026-10-17T05-07-10Z`，realm/world 同名，session `f33dce82` 三处一致 | 复跑轮全部互指同 stamp `05-16-31Z`，session `c101c376`；世界 `tests/homes/a5ptc2-rev-2026-10-17T05-16-31Z` 跑毕已删 |
| 拼缝排查 | receipt 四 clause 的 evidence_refs **全部**指向同一 canonical run + probe 日志；W8-W4 原 receipt 另存 `M-08.receipt.w8-w4-legacy.json` 未被 LIVE basis 引用 ⇒ 无拼缝 | — |

### 抽 4 条复跑（本 reviewer 亲产，world `a5ptc2-rev-*`，port 3184）

kit = 在册 `run-a5ptc2-compose.mjs` **单行差分**副本 `run-a5ptc2-rev.mjs`（diff 仅第 46 行世界前缀 `a5ptc2-compose-`→`a5ptc2-rev-`，diff 已留痕于本目录），row 文件一字未改。整链 22/22 PASS，其中判据点名：

| 抽验 | 结果（reviewer 复跑实测） |
| --- | --- |
| (a) 真 spawn 回执 | `C2-CHAIN-POS-REAL-SPAWN` PASS：rc=0 pid=117 lease=terminated stdoutMatch=true spyDelta=1 ceDelta=1；`C2-CHAIN-POS-RECEIPT-FLIGHT` PASS：`receipt=pid:117:plan-mvby21t2-2qtfbm` 经控制管道入 runResult |
| (a2) EACCES 负控 | `C2-CHAIN-DENY-OS` PASS：同策略 cat 私有 fixture rc=1、`/usr/bin/cat: …/private/secret.txt: Permission denied`、leaked=false、ceDelta=1（真 spawn 尝试）；同轮 selective/denyall=ENFORCE-CONFIRMED、badhandled=DEMO-CONFIRMED（假阴性判别器在场）、hardDimensions ['content-read','write'] |
| (b) 启动前拒 | `C2-CHAIN-UNSUPPORTED-ZEROSPAWN` PASS：`IO_POLICY_UNSUPPORTED` stage=provider-refused、**spyDelta=0、ceDelta=0、零 plan/out 路径**，消息原文含 realm 名（本复跑轮 realm `a5ptc2-realm-2026-10-17T05-16-31Z`） |
| (c) guard 拒腿 | `C2-CHAIN-GUARD-DENY`+`GUARD-ZERO-SPAWN` PASS：typed deny（`<RUN>-C2-GUARD-DENY…`）被程序捕获，marker `C2-PROBE-SPAWN-RAN` 在 state/tool-results/transcript/ledger **全缺席**（grep=0），全回合 confined-exec 恒=2、ceSnapshot@probe=2 |

## ② probe-M-08 亲跑

`node probe-M-08.mjs`（一字未改，官方 receipt 路径）→ A1/A2/A3/A4 全 SATISFIED + 装配锚点 runner 行形 grep PRESENT + evidence_refs 逐项存在性亲验 → **`# VERDICT LIVE exit=0`**（本 reviewer 亲跑，2026-10-17T05:17:05Z）。

## ③ 「不予采纳拼 receipt」在册更正行

核对在位、文本一致（四处互证）：machine 矩阵 `M-08.pending_probe.transition_record.basis` 含「**在册更正（04:57Z root 口径）**：…合并即全 SATISFIED ⇒ 行转 LIVE 之提案=不予采纳——拼合不构成 M-08 判据…」；doc 矩阵 M-08 `pending_probe.note` 含「拼 receipt 提案=不予采纳（04:57Z root 口径在册更正）」；`SESSION_ROUTER_LOG.md` 2026-10-17 W-PTC-C2 条同文；receipt `prior_rounds_note` 同文且 legacy receipt 逐字节另存未被引用。

## ④ danger-full-access 口径分离披露

在位：README §5（「不承担 OS 强制口径…二者分离且分别在册」）、row 代码注释 + `modeCensus.os_caliber_note`、判据 `C2-MODE-SCOPED`（pre=workspace-write post=danger-full-access default=workspace-write，本复跑轮同值复现）、matrix basis 尾段、日志条。PTC runtime 自身 bootstrap 子进程 spawn 无公开挂点 = 如实披露不主张（矩阵判据语义 = per-call 载荷执行边，W4 先例同口径）——与本行断言集一致，不构成缺口。

## ⑤ 矩阵改动面与 runner 复跑

- `git diff 8eb93ddd..87403917`：machine 矩阵仅 2 个 hunk（`@@566`/`@@590`，均在 M-08 块内：status_now + transition_record）；doc 矩阵仅 M-08 行 1 处；其余全部为新增证据文件/日志追加 ⇒ **只动 M-08 行成立**。
- pr8 runner（一字未改）本 reviewer 复跑：**PASS=24 FAIL=0 NOT_RUN=3 LIVE=2(M-08,M-13) PROBE-GATED=3(M-04,M-05,M-09) TOTAL=32，exit 0**；M-08 行 `probe-transition: LIVE`（runner 亲验位）——`pr8/runner/runs/matrix-run-2026-10-17T05-17-14-889Z.{json,log}`。
- 自测套件复跑：**35 pass / 0 fail**。

## 发现（均不阻塞）

- **F1（外观缺陷）**：row `view()` 的 `offeredLauncherPaths: [...offeredLauncherPaths]` 在 build 时展开 ⇒ composed-state 恒为 `[]`；offered 身份实际完整在册于 ledger `run-spy offered=` 行。建议后续轮改为惰性展开。不影响任何判据（判据不读此字段）。
- **F2（自指文本，无害）**：`C2-CHAIN-GUARD-DENY` 的 claim 文本含 marker 字面量；缺席检查作用域 = programSource/journal（claim 不在内），本 reviewer 按 state/ledger/transcript 逐文件 grep 复核 = 0。
- **F3（口径边界，已披露）**：OS 强制口径落在 provider Landlock 腿（per-call 执行边），非宿主 PTC runtime 自身 bootstrap；与矩阵 M-08 判据语义（per-call 策略注入负控）严格对齐，README/basis 双处明示，不构成升格。

## 卫生复核（reviewer 本会话）

:3080 pre/post=401 一致；test-use HEAD=`639ed01539…` porcelain=0 前后；port 3184 跑前 bind=IDLE、跑后 bind=RELEASED；世界 `a5ptc2-rev-2026-10-17T05-16-31Z` 跑毕删除（`tests/homes/` 现空）；本 reviewer 仅新增文件、零 tracked 修改（`git status` 五新路径）。

## 本文件随附 reviewer 自产证据

`run-a5ptc2-rev.mjs`（单行差分 runner）、`review-rerun-console.log`（22/22 全文）、`runs/compose-2026-10-17T05-16-31Z/`（criteria/composed-state/ledger/instance/mode-scope/mock-decisions/prompt-body）、`../pr8/runner/runs/matrix-run-2026-10-17T05-17-14-889Z.{json,log}`。
