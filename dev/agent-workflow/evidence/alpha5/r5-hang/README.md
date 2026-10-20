# R-5 独立单：人类 remote v4 `team.resolveControl` 对 leader-rung 案例「挂死」——最小复现与根因

- 路线 = G3 探针单（qwen-only）；基线 = **`bc97ad0c33f96d1aabab5fd4d4e799c385a16af1`**（`a5-tools-gov` tip，已 fetch 核对；父单令「先查 bc97ad0c 是否已修」→ **未修**：`tools-gov/TOOLS.md` R-5 条目在 `bc97ad0c` 与本分支脏树里逐字不变，仍写「转产品小账（候独立单）」，A kit 注释仍写该车道 "HANGS in this build"）。
- 宿主基线 = `tests/deepseek-harness-test-use` @ `639ed01539`（pristine，porcelain 0，跑前跑后各测一次）。
- 不变量：`:3080` 仅只读探针（H0/T3 跑前跑后同答 401），未碰 `:3180`；自有端口段 **3191/3491 与 3192/3492**；homes = `tests/homes/a5r5-*`（跑毕扫干净）。主检出只读；未 push。
- 证据面 = 本目录（`dev/agent-workflow/evidence/alpha5/r5-hang/`）；`runs/<stamp>/` 为 kit 自动写出的逐轮证据。

## 0. 结论速览（详见 `ROOT-CAUSE.md`）

**R-5 观测为真、归因为伪。** 在 `bc97ad0c` 的**真安装 ask 世界**里，对**真 PENDING 的 leader-rung guarded 案例**，人类 remote v4 `team.resolveControl` 实测 **11-25 ms 落 durable 决策行 + 触发一次性消费 + 停车成员复活**；那次 240s 无响应实为 **`team.create` 的 fetch abort**（A 现场 partial 无 `teamCreate` 事实、`criteria:[]`，与我在 run `06-37-39Z`/`06-42-53Z` 复现出的签名逐字同形）。真挂形 = v1 create 内嵌 `initialWork` 时响应被**领队首回合**同步扣住（`root-initial-work.ts:758-770`），首回合若含「同步委派 + 治理写停在 guarded ask 段」，响应期就是人类等待期。

## 1. 现场（A 路红账 R-5 原文要点）

`dev/agent-workflow/evidence/alpha5/tools-gov/TOOLS.md:97`（run `2026-10-19T09-36-46Z`，kit 人类车道版本）：

- 成员写 park 出真 durable 行：`control-request-recorded`，carrier=`leader-approval`、`reviewAuthority=leader`、`executionCoupling=guarded`；
- kit 以 boot-root 人类身份打 `team.resolveControl` v4 → **HTTP 240s 无响应**（`TimeoutError: The operation was aborted due to timeout`）；
- 期间/之后**无任何决策行**、零副作用；宿主日志无该 RPC 痕迹；
- 同案例走领队工具道（`team_list_pending_control` → `team_resolve_control`）全链通（run `09-43-04Z` 15/15）。

## 2. 消除法（先把「不可能是谁」钉死，file:line 均在 `bc97ad0c`）

两条车道**进的是同一个服务入口**：工具道 `packages/tools/src/tools.ts:1017-1073`（`ctx.options.controlService.resolveControl`，caller=leader 实例）与人类线 `packages/runtime/src/plugin/root.ts:3644` → `ControlService.resolveControl`（caller=`{kind:'human'}`，由 `s6-principal.ts:431` 同步派生）。因此差异只可能在**入口之前**（线/派生/门禁）或**caller 身份相关的分支**。

- 线层无线程挂形：`s6-remote.ts:2290` 端口（缺端口即 typed `TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE`，`:2301`）→ 分派 `:4106`；`createS6RemoteDispatcher`（`:4719`）throw-proof；readiness 门（`:4810` 邻域）只回 typed `internal-error`/`runtime-not-ready`；`createS6RemoteSurfaces`（`:5032`）无队列/无等待。
- 宿主 HTTP/RPC 层无挂形：pristine test-use `packages/client/connection/src/rpc-host.ts` + `src/http-bridge.ts` 里唯一能「无响应」的形 = **handler promise 永不 settle**。
- 服务层 `resolveControl`（`control/service.ts:2501`）锁前全同步（parseRoot/isActionCaller/resolveCaller/resolveTeamAndTarget）；锁 = 服务私有 per-team 链 `teamLocks`（`:1649`，`withTeamLock` `:2537`）；锁内 await 只有两处：`externalPolicyFacts()`（`:2647`，仅 allow 且带 capabilityDomain 的臂）与 `commitDecision`。
  - `externalPolicyFacts` 在生产是**静态 config 对象**（`root.ts:1367`；`host.ts:709-716` 启动期校验形状）→ 不可能不 settle。
  - A4-PR7 权威复核 `recheckConsumedAuthority`（`:3014`）不在裁决路径上：它由 **guard/消费点** 调用（`:3417`），人类裁决那一跳根本不经过它（本单曾把它列为头号嫌疑，已排除）。
  - `awaitControlDecision`（`:3562`）轮询、**不持锁**；`requestControl` 的领队通知在锁外 fire-and-forget。
  - 锁序 (a) router chain → (b) control lock，永不反向；唯一 (a)→(b) 站点 `action-router/router.ts:900/1028` 的 `commitEffectIfAuthorized`，且仅 recovery 派发带 `recovery.controlRequestId` 时才走。

## 3. 装配级最小复现（`code/a5r5-assembly-probe.test.ts`，实跑于 `packages/runtime/test/a5r5-resolve-hang.test.ts`）

真 `ControlService` + 真 `createS6RemotePorts` + 真 `createS6RemoteDispatcher` + 真 T12-B4 派生（p6t4 世界）；四个场景各世界独立、每次裁决 5s 超时竞速（挂=记 HANG，不卡 runner）：

| 场景 | 行形 | 停车 waiter | 车道 | 结果 |
| --- | --- | --- | --- | --- |
| S1 | **R-5 形**：`requestApprovalLeg(kind=leader-approval, reviewAuthority=leader, executionCoupling=GUARDED, authorityScope=exact, operationFingerprint)` | 有 | 人类 v4 allow | **SETTLED 3ms，决策行 1** |
| S2 | 同上 | 无 | 人类 v4 allow | SETTLED 1ms，决策行 1 |
| S3 | 同上 | 有 | 领队 caller（A 说通的那条） | SETTLED 2ms，决策行 1 |
| S4 | 旧形 `requestControl`（无 coupling/无 leg） | 有 | 人类 v4 allow | SETTLED 1ms，决策行 1 |

`node_modules/.bin/vitest run packages/runtime/test/a5r5-resolve-hang.test.ts` → **4/4 PASS**；同世界的既有发货套件 `f9-control-exactly-once.test.ts` 亦 10/10 PASS。

**装配级不复现**：R-5 的行形 + 停车 waiter + 人类 v4 车道，在纯装配层 3ms 内落决策行。

## 4. 活体世界探针（`code/a5r5-r5-probe-kit.mjs`，A 四世界 kit 的分叉）

自有端口 3191/3491、homes `a5r5-*`、`--only ask`（`MODES=['ask']`）。真安装（`plugin --profile web add github:…#bc97ad0c`）+ 真宿主 + 真 ask 蓝图；kit 自带探针（写 `r5-probe-ask.json`）：

- **P0** `catalog.list` v4（通道基线活体）
- **P0b** 同一 v4 方法、**不存在的 requestId**、park 之前 —— 若这里 typed `CONTROL_REQUEST_NOT_FOUND`，说明该世界该车道端到端活着
- **P1** 等一条**真 PENDING** 行（durable ledger 或 wire 上领队 pending 列表首见）
- **P2** 对那条 PENDING 行打**人类 v4 allow**（30s 预算；无响应=记 `NO_RESPONSE`，即 R-5 形）
- **P3/P4** P2 在飞期间并发打 `catalog.list` 与「bogus id 的 v4 resolve」——判「整通道死」还是「仅该法/该锁死」，并判控制锁是否被 P2 卡住
- **P5/P6** 探针后世界收尾（非探针模式才跑领队道复跑）

### 4a. 已实得活体事实（run `2026-10-20T06-16-26Z`、`06-18-27Z`；ask 世界，真安装面）

- 宿主日志：`remote mount: MOUNTED channel=/team-remote`；
- **P0 `catalog.list` v4 = HTTP 200 / 10-14ms**；
- **P0b 人类 v4 `team.resolveControl`（bogus id，park 前）= HTTP 200 / 6ms，typed `CONTROL_REQUEST_NOT_FOUND`**（逐字含 team id）；
- **P6/P2 对「已被领队道裁决的同一 requestId」再打 = HTTP 200 / 5-11ms，typed `CONTROL_REQUEST_DECIDED`**；
- 同世界领队工具道照旧全通（A 判据 A1-A4 在探针轮仍 15/15 PASS）。

⇒ 「该 ask 世界里人类 v4 车道整条是死的/没挂载」**不成立**：同一通道、同一方法、同一 cookie，typed 拒词在 5-15ms 内可达。

### 4b. 对真 PENDING 行的那一跳（决定性一跳）—— **答：不挂**

两次独立捕获，同一 SHA，真安装面，真 A4 `guarded`/`leader-approval` 行：

| 捕获 | 请求行 | 人类 v4 `allow` | 后果 |
| --- | --- | --- | --- |
| kit 内探针 `runs/2026-10-20T06-54-47Z/r5-probe-ask.json` | `ctrl-1sh2u0e0ljn68l1fht6nc0ws`（P1 检测时**确为 PENDING**：`pendingFromLedgerRightBeforeCall=true`） | **HTTP 200 / 11 ms**，`ok:true` | 决策行落账；P3/P4 并发探针 18-19 ms 同时到达 |
| 外部独立客户端 `runs/2026-10-20T06-42-53Z/external-human-allow-{shot,rows}.json` | `ctrl-1rgtfos0eioazz1tzuf2209d`（与 R-5 逐字同形：`kind=leader-approval / reviewAuthority=leader / executionCoupling=guarded / approvalCaseId / legOrdinal=1 / operationFingerprint / authorityScope{write,exact} / toolName=write`） | **HTTP 200 / 25 ms**，`decider={kind:"human",…}` | 台账 seq6 `control-decision-recorded:allow` → **seq7 `control-allow-consumed`** → seq8 成员下一段新请求（**停车的成员真复活**）；重复裁决 = 10 ms typed `CONTROL_REQUEST_DECIDED` |

### 4c. 顺手抓到的真挂形（watchdog 白捡的）

`runs/2026-10-20T06-42-53Z/r5-watchdog.json`：kit 自己的 **`team.create`** 挂 **300 000 ms**（影子重发再挂 300 642 ms），**同时刻同通道 `catalog.list` = 200 / 32-33 ms ×2**，机器 loadavg **0.31** / 空闲 **9475 MB**。A 的 09-36 现场有**同一签名**（partial 里无 `teamCreate` 事实、`criteria:[]`、`fatal=TimeoutError: The operation was aborted due to timeout`）。根因与 file:line 见 `ROOT-CAUSE.md` §2。

## 5. 结论（三选一出口）—— 走 **(b) 需语义裁决**，且 R-5 这条**无需改码可关**

- **R-5 观测为真、归因为伪**：人类 remote v4 `team.resolveControl` 对**真 PENDING 的 leader-rung guarded 案例**在 `bc97ad0c` 实测 **11-25 ms 落 durable 决策行并触发一次性消费**（§4b）。装配级 4/4 同判（§3）。⇒ 这条「产品小账」应关账，不是缺陷。
- **A 那次 240s 无响应是 `team.create` 的 fetch abort**：其自身 partial 无 `teamCreate` 事实、`criteria:[]`；kit 在 await create 的下一行才写该事实，而人类那一跳必须先有 team 才能发 ⇒ abort 的那次调用不可能是 resolve（`ROOT-CAUSE.md` §3）。
- **真问题（建议另立一条）**：v1 `team.create` 内嵌 `initialWork` 时，响应被 Phase B（领队首回合）同步扣住（`packages/runtime/action-router/root-initial-work.ts:758-770` → `:458-493`）；首回合若含「同步委派 → 治理写停在 guarded ask 段」，则该建团队请求的响应期 = 人类等待期，**无界、无 typed 拒词、缝上明写不接受 abort signal**。四件套（问题/表现/选项/影响）见 `ROOT-CAUSE.md` §5：现状成契约 / Phase A 即返回 / Phase B 给可观测上界。

## 6. 复现命令

```bash
# 装配级（无世界、无端口；本单不把测试文件留在产品测试树里，跑时拷回去）
cd .worktrees/a5-r5-probe
cp dev/agent-workflow/evidence/alpha5/r5-hang/code/a5r5-assembly-probe.test.ts packages/runtime/test/a5r5-resolve-hang.test.ts
node_modules/.bin/vitest run packages/runtime/test/a5r5-resolve-hang.test.ts   # 4/4 PASS，随后 rm 掉
# 活体（自有端口段 3191/3491；homes=tests/homes/a5r5-*；跑毕自清）
cd .worktrees/a5-r5-probe/dev/agent-workflow/evidence/alpha5/r5-hang/code
node a5r5-r5-probe-kit.mjs --src-root <worktree> --main-checkout <main> \
  --sha bc97ad0c33f96d1aabab5fd4d4e799c385a16af1 --host-port 3191 --mock-port 3491
```

## 7. 环境注记（本轮实测，非产品事实）

- 每次 bash 调用是独立 bwrap（`--unshare-pid`），跨调用看不见彼此进程；**端口是主机全局的**（run `06-35-04Z` 因上一轮残留 mock 撞 `3491 busy` 而响亮失败，非静默）。后台日志必须写工作区内（`/tmp` 是每次调用的 tmpfs）。
- kit 进程内存上限 ~2GB（`--max-old-space-size` 未抬起）：**被扣住的领队道若持续吃轮**，每轮重发全史 → 37-85s 内 OOM（runs `06-28-06Z`、`06-30-12Z` 实撞，已改为「同步委派出停车 + 探针即止 + 220 轮熔断」形态）。此为本探针工装属性，不是产品行为。
