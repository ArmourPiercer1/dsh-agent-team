# R-5 根因判决：挂的是 `team.create`，不是人类 `team.resolveControl`

基线 = **`bc97ad0c33f96d1aabab5fd4d4e799c385a16af1`**（`a5-tools-gov` tip；宿主 = pristine `tests/deepseek-harness-test-use` @ `639ed01539`）。以下所有 file:line 均在该 SHA。

## 0. 一句话

**红账 R-5 的观测为真、归因为伪。** ask 世界里确实存在一个「人类等不到回、请求永不 settle、零决策行、宿主日志无痕」的挂形——但它是 **v1 `team.create`（内嵌 `initialWork`）的响应被焊死在领队首个回合上**：该回合内一次同步委派停在 ask 车道，create 的 HTTP 响应就一直不返回。人类 remote v4 `team.resolveControl` 对**真 PENDING 的 leader-rung 案例**实测 **11-25 ms 落 typed 决策行**，不是挂。

## 1. 反证：人类车道对该案例可用（两次独立捕获，同一 SHA，真安装面）

| 捕获 | 行形（真 durable 行） | 人类 v4 allow | 后果 |
| --- | --- | --- | --- |
| kit 内探针 `runs/2026-10-20T06-54-47Z/r5-probe-ask.json` | `ctrl-1sh2u0e0ljn68l1fht6nc0ws`（P1 检测时**确为 PENDING**） | **HTTP 200 / 11 ms**，`ok:true` | 决策行落账 |
| 外部独立客户端（自带 token gate + 自己的 cookie） `runs/2026-10-20T06-42-53Z/external-human-allow-{shot,rows}.json` | `ctrl-1rgtfos0eioazz1tzuf2209d` | **HTTP 200 / 25 ms**，`decider={kind:"human",humanId:"session-a5tools-gov-team-ask-…"}` | 台账 seq6 `control-decision-recorded:allow` → **seq7 `control-allow-consumed`（一次性消费）** → seq8 成员下一段新请求 ⇒ **停车的成员真的复活了** |

外部那次抓到的请求行与 R-5 描述**逐字同形**：`kind:leader-approval`、`reviewAuthority:leader`、`requiredAuthorityAtCreation:leader`、`executionCoupling:guarded`、`beneficiaryAuthority:member`、`approvalCaseId`、`legOrdinal:1`、`operationFingerprint:sha256:…`、`authorityScope{operationClass:"write",matcher:{kind:"exact",…}}`、`toolName:"write"`、`requester={kind:"instance",role:"member"}`。

配套（同世界、同 cookie，同一分钟内）：`catalog.list` v4 = 27 ms / 200；bogus id 的 v4 resolve = 6-10 ms / typed `CONTROL_REQUEST_NOT_FOUND`；重复裁决 = 10 ms / typed `CONTROL_REQUEST_DECIDED`。⇒ **通道活、方法活、门禁活。**

装配级另证：`code/a5r5-assembly-probe.test.ts`（R-5 行形 + 停车 waiter + 人类 v4 车道）4/4 PASS，SETTLED 1-3 ms（详见 README §3）。

## 2. 真凶：`team.create` 的响应等的是「领队首回合跑完」

响应路径（v1 内嵌 `initialWork` 口味）：

1. `packages/runtime/src/plugin/s6-remote.ts:4006-4030` —— `team.create` 按 flavor 路由，v1 = embedded-work → `ports.teamCreateEmbeddedWork.create(...)`。
2. `packages/runtime/src/plugin/s6-remote.ts:2633` 起 —— 该端口的注释：创建期初始工作「**admitted before the RPC returns**」（走 §15.8 那条闭包，与 v2 `team.admitInitialWork` 同一策略）。
3. `packages/runtime/src/plugin/root.ts:2077-2131` —— §15.8 闭包 `createAdmitRootInitialWork({ teamLocks: coordination.chains, …, deliverRootWork: rootWorkDelivery })`；`rootWorkDelivery` 就是宿主真实入口缝 `live.deliverRootWork`（`root.ts:2091-2101`）。
4. `packages/runtime/action-router/root-initial-work.ts:458-493` —— **Phase B**：`await deps.deliverRootWork.deliverRootWork({...})`，注释写明这就是「**the ROOT TURN runs**」，**故意不持共享链**（领队自己的 team 工具会在同一条链上重入 = 文档化的 N1 挂形），且**不接受 abort signal**。
5. `packages/runtime/action-router/root-initial-work.ts:758-770` —— `completeRootInitialWorkAfterAdmission`：**先 `await deliverRootInitialWork(deps)`（Phase B），再 Phase C 落终态事实**，而这一整串就在 `team.create` 的**响应路径内**。

⇒ 语义事实：**v1 create 带回 `initialWork` 时，RPC 响应要等领队第一回合整个跑完。** 只要该回合里发生了「同步委派 + 成员停在 ask 车道的人类等待」，这个 HTTP 响应就会被一个人类决定扣住——**无界、无 typed 拒词、无超时**（该缝明确「accepts no abort signal」）。这就是 240s 无响应。

实测（`runs/2026-10-20T06-42-53Z/r5-watchdog.json`）：

- `team.create` 挂 **300 000 ms** 不返回；影子重发再挂 **300 642 ms**（`fetch failed`=世界拆除）；
- 同时刻同通道 `catalog.list` **HTTP 200 / 32-33 ms** ×2；机器 **loadavg 0.31 / 空闲 9475 MB** ⇒ **不是资源饥饿，不是通道死，不是控制锁**；
- 挂起期间世界照常推进：外部读台账已见 seq1-5（成员 RUNNING、ask 段 PENDING），外部人类 allow 后立刻 seq6/7/8 继续走。

复现开关（唯一变量）：ask 世界领队首回合的 `team_delegate` 用 **`async:false`** → 世界必挂（runs `06-37-39Z`、`06-42-53Z`：`fatal=TimeoutError: The operation was aborted due to timeout`，partial 里 **无 `teamCreate` 事实**）；改回 **`async:true`** → `team.create` 立刻返回、探针 11 ms 裁决（run `06-54-47Z`）。

## 3. R-5 为什么会被记错（证据自身说话）

A 的现场 `../tools-gov/runs/2026-10-19T09-36-46Z/`：

- `world-ask.partial.json` 的事实链停在 `catalogPreflight`，**`teamCreate` 事实不存在**，`criteria: []`（create 之后的任何东西都没跑到）；
- `fatal.json` = `TimeoutError: The operation was aborted due to timeout` —— 与我复现出的挂形**逐字同签名**；
- kit 在 `await` 完 create 的下一行就写 `facts.teamCreate`，而人类车道那次调用**必须有 team 才能发**（要 teamSessionId + 真 requestId）。⇒ **那次 abort 只能是 `team.create`，人类 `team.resolveControl` 那一跳根本没发生。**

旁证：A 现行 kit 的 ask 分支已经写死 `async: true` 并留注释「delegate ASYNC（成员停在它自己的 ask-lane 等待里；领队继续吃轮）」（`../tools-gov/code/a5tools-gov-kit.mjs:1023-1029`）——这条正是绕开本挂形的动作；同 kit 在 `09-43-04Z` 那次 ask 世界 15/15 通过，`teamCreate` 事实存在。

## 4. 消除法（为什么不是别的）

- **控制锁不是它**：`ControlService` 用的是服务私有 per-team 链（`control/service.ts:1649`），与 router 共享链是两条，锁序 (a)router → (b)control 且从不反向；router 链被扣住不会挡住 resolve（实测 11-25 ms）。
- **resolve 路径上没有可挂的 await**：锁前全同步；锁内只有 `externalPolicyFacts()`（`:2647`，生产值是**启动期校验过的静态 config**：`root.ts:1367`、`host.ts:709-716`）与 `commitDecision`；A4-PR7 权威复核 `recheckConsumedAuthority`（`:3014`）只由**消费点** `guardOperation` 调（`:3417`），人类裁决那一跳不经过它；`awaitControlDecision`（`:3562`）轮询但**不持锁**。
- **传输层无挂形**：pristine 宿主 RPC/HTTP 桥里唯一「无响应」的形就是 handler promise 永不 settle——与 §2 完全吻合。
- **不是宿主行为/不是非法形状漏 typed 拒**：同形状的非法调用（bogus id / 重复裁决）在 6-10 ms 内给出 `CONTROL_REQUEST_NOT_FOUND` / `CONTROL_REQUEST_DECIDED`。

## 5. 出口与待裁决语义（本单走 (b)）

R-5 这条**不需要改产品码**：人类 v4 车道对该 rung 已被证明可用（§1）。该关账，并把真问题另立一条：

> **CR-新**：v1 `team.create`（内嵌 `initialWork`）的响应被 Phase B（领队首回合）同步扣住；若首回合内含「同步委派 → 治理写停在 guarded ask 段」，该 create 请求的响应期 = 人类等待期（无界、无 typed 拒词、缝上明写不接受 abort signal）。

**裁决问题**：v1 create 带初始工作时，"admitted before the RPC returns"（`s6-remote.ts:2652` 注释的字面承诺）与「响应等回合跑完」（`root-initial-work.ts:758-770`）二者取哪个为契约？候选：

1. **维持现状**：写进契约/文档——v1 create + `initialWork` = 领队首回合跑完才回；客户端超时预算与 kit 必须按此设定（ask 世界必须 async 委派）。零码改，风险：每个 ask 世界都是地雷，红账会再长出来。
2. **Phase A 即返回**：durable `team-work-admitted` 落账即响应，Phase B/C 脱离请求生命周期。最贴 §15.4 字面，但改变所有 v1 create 客户端的可见时序（UI「建团队」何时算成、终态事实何时可读）。
3. **给 Phase B 一个可观测上界**：超时返回 typed（例如 `ROOT_TURN_STILL_RUNNING` + requestToken 可续），终态事实仍由 Phase C 落。语义改动最小，但引入一个新的 typed 结果族。

**影响面**：任何「首回合含同步委派 + ask 停车」的世界都会把建团队请求变成人质等待；等待期间团队其余车道仍可服务（实测）⇒ 不是治理缺口，是**响应耦合**；UI/kit/回归套件的超时预算全都被它绑住（本单 90s→300s 才不被误判成产品挂）。

## 6. 探针工装自曝（不是产品事实）

- 本 fork 为拿到 PENDING 窗口，一度把领队首回合改为同步委派（= §2 的复现开关），并把被扣住的领队回合做成「文本 + 每 2 轮听一次 pending」——工装属性。
- kit 进程 ~2 GB 堆上限：被扣住的领队若高频吃轮，每轮重发全史 → 37-85 s OOM（runs `06-28-06Z`、`06-30-12Z`）；已加 220 轮熔断。
- 探针模式（`--r5-probe-only`，默认开）在世界建好、探针打完后直接收尾，**不跑 A1-A4**：因此 run `06-54-47Z` 的 `KIT_EXIT=2` 且恰好 A1-A4 四条 FAIL（`requests=0` 之类）是**探针模式签名**，不是产品判据失败；该轮其余 13 条（含 H0/H1/H1b/I1-I3/T1-T3）全绿。
- 本盒与 A 路四世界 kit 共享（其 `06-0xZ`/`06-32Z` 轮与我的重叠过）：`machine.loadavg` 已随 watchdog 记录，本单结论都在 loadavg ≤ 0.31 下取得。
