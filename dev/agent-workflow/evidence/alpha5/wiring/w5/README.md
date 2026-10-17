# W5 tools-wiring LIVE round — search/shell 工具面经 admission 门控装配（Alpha.5 接线阶段）

基线 = `origin/master @ 62cc2b87`（分支 `alpha5-wire-pr5`，一次性 worktree `.worktrees/a5w5`）。
宿主 = `tests/deepseek-harness-test-use` pinned pristine @ `639ed01539`（0.2.0-rc.2，复用已构建，porcelain 前后各=0）（IF-4）。
端口 3183 · mock model 3493 · 世界 `tests/homes/a5w5-<mode>-<stamp>`（IF-2/IF-3，用后即删）。
`:3080` 全程只读探测（401/401 不变）。装配 = plugin row（公开 profile-patch seam）+ 公开 `ctx.agents` + dist/lane 公开 barrels（IF-1）；IF-5 共享面 porcelain 全程空（runner 每次运行自带 L-W5-IF5 判据）。

## 文件

| 文件 | 角色 |
| --- | --- |
| [`build-lane-esm.mjs`](./build-lane-esm.mjs) | DORMANT a5p5-tools lane → 纯 ESM 编译驱动（tsc 纯命令行旗标，逐面复现 tsconfig.base；不新建任何 packages/ 下配置，IF-5 零触；产物落 gitignored `tests/homes/.a5w5-build`，收口删除，重建命令=本文件 usage） |
| [`a5w5-fixtures.mjs`](./a5w5-fixtures.mjs) | 平面 ESM 装配构件：lane 单一模块图加载、PR2 bind→grant 全流程端口（tool-invoke 作用域键 `<realm>|tool:<name>`，port of a5p2-fixtures:145）、真实 grep/shell 后端（deny-before-spawn exec-edge）、RAW 对照腿、spill 生命周期 LIVE 驱动、六事件 LIVE 驱动 |
| [`a5w5-assembly-row.mjs`](./a5w5-assembly-row.mjs) | 测试侧 LIVE 装配 row：注册 `a5w5_search`/`a5w5_bash`（lane grep/bash 的 alias，wiring 只 alias 不扩集）→ PR1 Guard install → bindOwnTools → publish → **publish 后**注册 `a5w5_unbound_probe`（unbound 负控走真实 dispatch 路径）；body = parse→derive→bind→grant→exec-edge→`pipeline.runToolCall`→真实执行→spill→render；routes `/__a5w5/{health,journal,state,agents,raw-parity,assemble}` |
| [`run-w5-live.mjs`](./run-w5-live.mjs) | runner：boot→create→setup→assemble→脚本化真实模型驱动六调用链→live route 读回→34 条判据→teardown；token 捕获即脱敏 |
| `W5-RED-UNGATED.log` + `runs/ungated-2026-10-17T02-14-28Z/` | **RED（先跑）**：同一判据集、同一套 tool defs、无 guard/无 admission 面 → 25/34，红的全是门控腿（见下） |
| `runs/gated-2026-10-17T02-14-40Z/` | 首次 gated 32/34：两条判据钉错（channel 期望 armed 而实测 **proven**=注册变更已投递；stream census 未含 master 自有 begin/end/refused 名）。判据修正记录在案，复测=下一条 |
| `W5-GATED-GREEN.log` + `runs/gated-2026-10-17T02-15-32Z/` | **GREEN 34/34**（本报告引用之；events6.md/parity.json 在该目录） |
| `W5-tools-lane-suite.log` | tools lane 套件 68/68（零回归；dormant-audit 在场且绿） |

## 结果（三态；IF-7：本阶段终态只有 LIVE / PROBE-GATED）

**① search+shell 经 admission 门控注册进真实测试会话 — LIVE-CONFIRMED。**
Guard install→bindOwnTools→publish（publish 时 channel=armed；publish 后注册探针 → 活订阅投递 → channel 实测 **proven**，比 armed 更强的投递事实，与 PR3 G-6 live 观测一致）。真实模型驱动调用：search 与 bash 各 ≥1 次走完 bind→grant（grantId 铸出，如 `grant:6da2a3057e4f…`）→ exec-edge 消费（首耗 ok、故意重放 typed 拒 `grant-consumed`，ledger consumed=1）→ 真实 grep/`/bin/sh` 执行 → presented 且呈现字节进入真实 transcript（`search · content · 2 matches …`、`bash · exit=0 … a5p5-meta` 页脚俱在 mock 捕获里）。

**② spill 生命周期 LIVE（三门修后的 live 行为，全部逐字在 `runs/gated-…/live-state.json`）— LIVE-CONFIRMED。**
open（ACTIVE 写入 1856B）→ read（授权放行，payload 逐字节等值 + attribution 在）→ 授权重查 deny → typed `spill-read-denied`，**readText 端口增量=0**（全端口增量=0）→ settle(completed)→finalize→close → close 后写=typed `spill-write-after-close` → **id-in-use 重放**：同 spillId 重开 typed 拒 `spill-id-in-use`（写端口增量=0，payload+meta 逐字节不变、归属不被覆盖）→ 全新 handle 枚举残留（attribution+settlement 在盘不在内存，law 3）。模型驱动大输出腿：`seq 1 4000` → 指针 `bash-w5-bash-4` bytes=18893，盘上文件字节=18893。

**③ shell parity 双腿（governed vs raw 对照，同输入）— LIVE-CONFIRMED。**（表：`runs/gated-…/parity.json`）

| 输入 | governed（bind→grant→exec） | raw 对照 | 等值 |
| --- | --- | --- | --- |
| `printf 'alpha\nbeta\n'` | exit=0 sha(e49c81e2…) 11B | sha 同 / exit 同 | ✓ |
| `echo out; echo err>&2; exit 3` | exit=3 stdout(54034ac5…) stderr(2ccde487…) | 三值全同 | ✓ |
| `seq 1 4000` | exit=0 stdout b5522725… 18893B | 全同 | ✓ |
| grep（argv 同一份） | **spill payload 字节 == raw stdout**（297B，sha 同） | 297B | ✓ |

denied 呈现零字节腿 live 复测：over-priv 调用 presented payloadBytes=**0**、spill 目录增量=**0**、backend exec 增量=**0**（L-W5-DENY-ZERO）。

**④ 六事件名 live 事件流计数（全前缀；越集=spill-settlement-event-unknown）— LIVE-CONFIRMED。**
六名逐个在活 store 的活 lease 上 settle **全 accepted**；退役短形 `call-cancelled-before-body` settle 被拒 **`spill-settlement-event-unknown`**（逐字）。live 观测流 census：六名计数全 0（正常路径无取消边，如实）；流上出现的 dispatcher-call-* 名全部为 master 自发射名（begin=7/end=5/refused=2，scoped-dispatcher.ts:528/535/545/559），退役短形 0 出现；`guard-denial=2` 与 `dispatcher-call-refused=2` 与探针两次调用边拒绝一一对账。表：`runs/gated-…/events6.md`。

**⑤ unbound/越权负控 — LIVE-CONFIRMED（未 grant 调用 typed 拒原文）。**
- unbound（真实 dispatch 路径，publish 后注册名）：transcript 原文
  `Error: team tool guard: "a5w5_unbound_probe" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes; declare it or bind it)`；body 执行计数=**0**。
- 越权（策略外资源，真实模型驱动）：PR2 kernel 返回自有词汇 arms——`requires-approval`（完整 decision JSON 在 live-state），呈现仅
  `A5W5-REFUSED kind=requires-approval code=requires-approval payloadBytes=0 …`，exec=0/残留=0。

**RED-first（ungated 对照）**：同一判据集下无门控装配红掉且仅红掉门控腿：GUARD、E2E-SEARCH/BASH（无 grant 执行）、ONESHOT、OVERPRIV（策略外内容 154B **被呈现**）、DENY-ZERO、UNBOUND（探针 body 跑了 2 次）、SPILL-POINTER/PARITY-SEARCH（无 admitted 流）；同时 lane-law 腿（生命周期/六事件/parity-shell/pristine）照样绿——门承载拒绝，非文字承载。

## Level statement（测量≠验收）

- 以上全部 = **LIVE-CONFIRMED**：pin 定生产配置宿主进程、真实会话、真实 dispatch 路径、live 读回。
- **ENFORCE-CONFIRMED 未达**（如实，同 PR3 轮口径）：无 OS 强制面（guard/gated 组成为同进程构造）；kernel 信任输入（clock/generation/policy/ledger）为 fixture 级；参数指纹为装配声明的 canonical digest（law-2 绑装配所声明者）。ENFORCE 维度属 W4 的 Landlock 对照线。
- G-g 语义边界不变：本 round 只验事件**名**在所得结算上的合法性，不对通道投递作任何宣称（PENDING-GATES G-g OPEN 引用）。

## 披露

- row 内 lane 模块图 = `tests/homes/.a5w5-build` 单一编译副本（含其自带 domain 相对依赖）；PR1/PR2 构件来自提交在库的 `packages/runtime/dist`（与 PR3 live 轮同源）——row 不实现任何律。
- 判据修正（首 gated 32/34 → 复测 34/34）均为**判据钉法错误**（channel 期望值、census 宇宙），非被测行为变化；旧 run 目录保留作实测史。
- bash 效应集=仅 tool-invoke（S0 M-07：禁以命令文本预测副作用）——bash 的命令文本越权面属 confined-execution/OS 维度（W4），本 lane 的 bash 负控=exec-edge 重放拒 + unbound。
- 探针在链上发了两次（第二次为脚本推进保险）：两次均在调用边被拒，与 census guard-denial=2 对账。

## 收口

3 个 run 目录在册；`tests/homes/a5w5-*` 世界 0 残留（teardown 删除）；lane build 目录已清；3183/3493 已释放；宿主 porcelain=0、HEAD 未动；全部 instance log 捕获即脱敏（`REDACTED-<sha8>`），证据树内 0 raw token；`:3080` 只读 401 探测；IF-5 共享面（packages/、scripts/、root vitest.config）porcelain 空——**零生产面改动**，本 PR 全部为证据 + 测试侧装配 row。
