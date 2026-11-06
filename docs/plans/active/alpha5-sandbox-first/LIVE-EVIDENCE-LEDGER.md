# ALPHA.5 — LIVE-EVIDENCE LEDGER（五次 P2-04 启动的账）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **写这份账的原因**：本阶段最反复出现的失败模式不是产品缺陷，而是**仪器为错误的原因报绿**
> （a gate that reported green for the wrong reason）。矩阵记录的是“哪一行有证据”，backlog 记录的
> 是“哪一条还没做”，两者都可以被措辞磨平；**一份“花掉了几次启动、每次买到了什么”的账不能被磨平**，
> 因为每一次启动都是 owner 明文批准的稀缺资源，而且账本本身在 git 里。
>
> 本文件只做一件事：把五次已分配的 P2-04 启动逐个列出，写清它要测什么、花了什么、产出了什么、
> **为什么没有产出结论**，以及**今天哪一条 host-free 检查会先挡住同一个失败**。
> 所有事实都能在 `dev/agent-workflow/evidence/` 下打开；不能打开的写 `UNVERIFIED`。
>
> 日期：2026-11-08 · 树：`task/a5sf-consolidate-20261108` @ `dfab3fa5c3a5a5637fb1c02c941cfc1e5c9d05c0`
> （`origin/master` = PR #626 tip；本仓历史中**没有** PR #627）· **本文件 0 boots** ·
> `CORE_PATCH_BUDGET = 0` · 不改任何 grade / `V@B` / `packages/**` / `.github/**`。

---

## 0. 六个词，各一行（给第一次读这个项目的人）

- **`V@B`**（verified-at-baseline）：某一行的证据是否产自**当前权威快照的 baseline 树**；只有 `yes` 才算
  “当前断言”，`no` 表示证据仍存在、但被测的树不是今天要发的树（`TOOL-ACCEPTANCE-MATRIX.md` §0/§1.1）。
- **arm**（测试臂）：一条**可执行的断言**，针对一个具名行为；`host-free` arm 不启动 Host、不占端口、
  不建 `DSH_HOME`，`live` arm 必须在真实 Host 上跑（backlog §0.1.3 的 C1/C2 分类）。
- **face**（能力面）：**一条共享权限机制 + 骑在它上面的一簇原生工具**；同面工具共用同一个编译结果、
  同一个 guard 传输、同一个 OS profile，所以缺陷会跨工具传播，验收也按面做（backlog §0.1.1）。
- **admission refusal**（准入拒绝）：**我们自己的准入代码在任何 provider / 进程 / OS 调用之前**给出的
  带类型拒绝；它证明的是“我的决定”，**不是** OS 的强制，因此永远不能当隔离证据。
- **§7 network bar**：`dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7 规定网络隔离声明必须
  同时具备的五项可观测事实（带 mechanism + evidence 的能力行、真实内核/传输拒绝、同调用的正控、
  带外传输观测、第二条消费路径）——“拒绝 spawn”一项都不是。
- **zero-boot preflight**：启动前的共享检查器（`scripts/a5sf-preflight.mjs` +
  `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`），对**声明的计划**判 PASS/FAIL；它不启动 Host。

## 1. 账本（每次一行）

“分配”列是 P2-04 的五次 start 槽位编号；owner 2026-11-06 的裁决原文「批准5次P2-04预算」见
`dev/agent-workflow/evidence/a5sf-candidate1/run-ledger.jsonl` 的 `grantedBy` 字段。

| # | 分配与用途 | 花了什么 | 产出了什么 | 为什么没有产出结论 | 今天挡住同一失败的 host-free 检查 |
|---|---|---|---|---|---|
| 1 | **#1 / 冻结候选上的 FS+Search 重测**：把 `1484fa4ee` 冻成快照 `as20261105r2` 的 baseline，在**该 commit 上**重跑 read/write/grep/glob 验收，使 M-01/M-02/M-06/M-07 脱离 `NEEDS_REVALIDATION` | 1 次 Host start；port 3184；`DSH_HOME tests/homes/u5a5sfc1-20261105T12-17-52Z`（已 teardown）；运行 `a5sf-candidate1-2026-11-05T12-17-52-246Z` | `overall=FAIL`，11 案 **9 PASS / 2 FAIL**；两行判 REFUTED（FS read B、search row3），失败条款都是 `exactlyOneDenyFact` / `everyReadPathFactOnBindingLane`，行为条款全绿 | **仪器的 locator 别名**：两条 lane 共用 `workspace/lane/outside-restriction.txt`，两个 judge 都按 locator 收 fact，各自多看见另一条 lane 的一条 deny fact。不是产品放宽，但也不是 PASS | **`cases.isolation` 的 `CASE_LOCATOR_ALIASED`**（`tests/world-factory/lib/a5sf-acceptance-preflight.mjs:1285`，报文里直接点名 “this is candidate-1 allocation #1”）：两个 case 共用 locator / guard-fact key 时在启动前就 FAIL |
| 2 | **#4 / 同一候选的重试**：只改 fixture——FS read B 迁到自己的 `workspace/lane/fs/outside-restriction.txt`，search row3 的操作数不动，两个 judge 文件字节不变 | 1 次 Host start；port 3184；`DSH_HOME tests/homes/u5a5sfc1-20261105T12-33-06Z`（已 teardown）；运行 `a5sf-candidate1-2026-11-05T12-33-06-567Z` | **`overall=PASS`，11/11**；被执行树 `25e106b4…` 的**产品路径**与冻结候选 `1484fa4ee` 逐项相同（run record `bindings.productTreeProof`） | **这一条产出了结论，只是结论已经过期**：同日合入 `#606`（`a5bd88b85`）移动 **28 条产品路径**（含 `team-services/src/subprocess.ts`、`mount.ts`、`install.ts`），Q7 因此撤回 current claim；四行回到 `NEEDS_REVALIDATION` / `V@B=no` | **Q7 漂移门**（`scripts/ci-pr-gate.mjs` 的 `state-freshness` leg）：baseline..HEAD 有产品路径漂移时，任何 `V@B=yes` 行点名红。它不阻止启动，但阻止把旧 PASS 当 current |
| 3 | **#3 / BL-17 Shell-PTY live 半场**：四个 live 问题——同 PTY 多命令、只写不读的读轴拒绝、`chmod` 缺口、`network: deny` 拒绝位置 | 1 次 Host start；port 3184；`DSH_HOME tests/homes/u5a5sfbl17-20261106T00-16-23Z`（已 teardown）；intent 00:16:23Z → teardown 00:18:14Z（约 111 s） | Host 启动健康（`ok:true`）；`overall=NOT_REACHED`，四个 case 全部 `NOT_REACHED`；teardown 干净（pid 55 killed、端口释放、home 删除、无孤儿） | **driver 的 gate 顺序缺陷**：在 `team.create` **之前**就 gate 了 `GET /__p6t6/state`，而该 root 还没有 team session，路由返回 500，90 s gate 永远不开。不是产品失败，也不是 Team row 失败 | **`driver.gate-order`**（PR #622；`a5sf-acceptance-preflight.mjs:2868`）：每个 gate 必须声明它消费的事实，消费方必须排在生产方之后 |
| 4 | **#4 / BL-17 重跑**：同一组四个问题，用修好 gate 顺序的 driver | 1 次 Host start；port 3184；`DSH_HOME tests/homes/u5a5sfbl17-20261106T02-21-57Z`（已 teardown）；02:21:57Z → 02:22:18Z（约 21 s） | Host 启动健康、锚点 15 工具；`team.create` 返回 200 `ok=false` `TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED`——权限覆盖门拒绝 leader（2 个 unmanaged 工具）；`overall=NOT_REACHED` ×4；**零 model 请求**（`final-mock-requests.json` = `[]`） | **run construction**：World 恒装配的 `u5_canary` / `u6fs_probe` 不在 leader 的 `builtinToolDeny` 里，A2C-2 覆盖门在校验面就拒绝启动 leader。产品是对的，计划不完整。**附带发现**：这次启动前的 `PASS 16/16` 自身是“绿错了原因”（漏列第 4 个 case），见矩阵 §1.2.2 | **`driver.leader-surface`**（PR #624；`:2869`）与 **`driver.caller-surface`**（PR #626；`:2870`）：启动前按声明的模型可见面算覆盖，strict Member 不能当 web caller |
| 5a | **#5 就绪检查（未花预算）**：在真实 Host 上第一次测 `teamA5sfRealm` seam 的 deny 面——一条 guard fact、零 provider entry 的**准入拒绝** | **0 boots**：无端口、无 `DSH_HOME`、无 pristine 写入。lane 明确**没有申请**这一次 start | host-free：装配证明（`assembly-proof.mjs`，deny lane 真挂载、拒绝发生在 face 上、零 provider fetch/search）、marker-routed mock（6 种顺序）、两个 bundle。真话 bundle 当时 **FAIL 16/17**；#626 之后同一计划 **PASS 18/18** | **NO-GO**：当时预检的 network 规则只承认“连接被拒”（要求探测报告 `enforced`），而本机探测报告 `unsupported`；唯一的 PASS 只能靠声明 `networkProbeEnforced: true`——一个被 §7 与本机探测同时否定的**假声明**，等于买一次测不到东西的启动 | **`caseClass: "admission-refusal"`**（PR #626）：第四类 case，按“一条 guard fact + 精确 typed code + 五通道计数全零 + `claimsConfinement:false`”判，并且**永不能满足** network-confinement 行；配套 **`bundle.case-coverage` 的 `BUNDLE_CASE_UNDECLARED`**：driver 声明要跑、`cases` 没列的 case 立即 FAIL |
| 5b | **#5 / BL-18 Web deny 车道的真实启动**：第一次在真 Host 上测 `teamA5sfRealm` seam 的 deny 面（一条 guard fact、零 provider entry 的准入拒绝） | 1 次 Host start（**预算内第 5/5 次，池已空**）；port 3184；`DSH_HOME` 在工作区内并已删除；intent/boot 两条账本行 | Host 起来了：auth 200、`/team-remote` 挂上；随后 `GET /__p6t6/health` → **404**，因为 team bootstrap 先失败：`TeamDomainError: store 'session_bindings' operation 'get' was rejected: the TeamDomain is closed`（`bindFreshTeamRoot` → `putSessionBinding` → `createAndStartTeam`）。**零 agent turn、零 model 请求、零 tool call、零 guard fact**；四个 wiring 项全部 NOT_PROVEN，每个都有独立 artefact；teardown 记录在案 | **boot 阶段顺序**：p6t6 观察者要等 team bootstrap 成功后才注册路由，而这次 bootstrap 以 typed 域错误中止。**一次启动无法区分**这是"我们这五行的组合触发了 boot 期缺陷"还是"产品 boot 期缺陷"，而池里已经没有第六次 | **无**。这是本阶段唯一一类**没有被转成 host-free 检查**的失败：要区分两种成因至少需要再一次启动，而预算为 0。README §6 记下了"若还有一次启动"所需的 host-free 复现路径，并明确说明不存在 |

## 2. 算术，以及一句后果

```
P2-04 分配         5
已花               5   (#1/#4 FS+Search、#3/#4 BL-17、#5 BL-18；见 §1 与 §2.3 的更正)
未花               0
live 结论（current）0   两条历史结论被 #606 的 Q7 撤回；BL-17 两次、BL-18 一次启动 0 case 到达
```

**Arithmetic: 5 allocated · 5 spent · 0 remain · 0 live verdicts that remain current.**

一句话后果：**Alpha.5 没有任何一个 live 性质仍被证明；矩阵里每一个等级都只靠 host-free 臂加上
明文拒绝（declared refusal）支撑。**

### 2.1 一条被推翻的更正（必须保留，因为它是这一轮最典型的错误形状）

本账第一版写的是 **“5 allocated · 4 spent · 1 unspent”**，理由是：`a5sf-bl18-live/README.md:17` 写着
“4 of 5 spent; 1 remains. This lane asks for none of it.”，`a5sf-refusal/README.md:18-20` 说 allocation #5
“still needs its own grant and boot”，而当时的 `master` 上确实只有 4 条 boot 账本行。

**这个更正是错的，而且错的原因正是本项目反复出错的那一类**：写它的 lane 的 base 是 `dfab3fa5c`，
**不含 PR #627**——第 5 次启动的证据与账本行（`dev/agent-workflow/evidence/a5sf-bl18-live2/ledger.json`，
`boots: 1`、`plannedStarts: 1`，`grantedBy` 写明 “this run is start 5 of 5, the LAST start”）
在那条分支上，尚未合入。于是“在册证据里没有第五条 boot 行”这个陈述，在它的树里为真，
**在事实层面为假**。

保留这段而不是删除，是因为它示范了两件事：① “按在册证据核对”只有在树是最新的时候才成立；
② 一份 README 写的“还剩一次”是**当时**的事实，不是**现在**的事实——账本必须以 boot 账本行为准，
而不是以叙述为准。

### 2.2 对 `a5sf-bl18-live2/` 的更正（同样是上面那个错误的一部分）

第一版断言 `dev/agent-workflow/evidence/a5sf-bl18-live2/` **不存在**、第 5 次启动从未发生。事实相反：
该目录在分支 `task/a5sf-bl18-live-20261108`（PR #627）上存在且完整——`README.md`、`preflight.log`
（`PASS 18/18`）、`grant.json`、`ledger.json`、`run-record.json`（`overall: FAIL`、`abortedAt: health-gate`）、
`health.json`、`setup-failure.json`、`teardown.json`、四个 `item-*.json`、`guard-facts.json`（空）、
`marker-routing.json`（零请求）、`surface.json`（空）。

因此：**BL-18 在 #626 之后确实启动过，结果是 boot 阶段以 typed `TeamDomainError` 中止，四个 wiring
项全部未证。** 这不是 UNVERIFIED，是 **NOT PROVEN**——两者不同：前者是“我们不知道”，后者是“我们知道没有”。

### 2.3 结论不变，理由变了

“0 live verdicts” 这个结论**没有**因为上面两处更正而改变，但它现在建立在一个更硬的事实上：
五次分配全部花掉、五次启动全部在到达 case 之前止步（两次 FS/Search 里有一次 PASS 但已被 #606 的 Q7 撤回），
**零个 live 性质仍然成立**。差别在于：第一版说“还剩一次机会”，事实是**没有下一次**——而这恰好让
“把每次失败转成 host-free 检查”成为唯一能对下一阶段交代的产出。

## 3. 这份账买到的三件事（不是结论）

1. **两条真实产品结论**（已过期但未删除）：FS/Search 在冻结候选树上 11/11，且负控 PROVEN。
   证据在 `dev/agent-workflow/evidence/a5sf-candidate1/README.md`，矩阵 §1.1/附录 A 保留。
2. **两条 run-construction 缺陷**（boot #3 gate 顺序、boot #4 leader 面覆盖），**都修在 driver 与
   host-free 检查里，而不是靠重试**；两次修复各自留下一个预检检查项。
3. **一次被明确拒绝的启动**（BL-18）：拒绝的理由是“这次启动买不到可判定的观测”，
   证据是 `dev/agent-workflow/evidence/a5sf-bl18-live/README.md` §6/§7。

## 4. 这份账不说什么

- **不证明任何 live 性质**，也不把 host-free 臂升级为 live 证据。
- **不改变任何 grade / `V@B`**；“0 current live verdicts”是读数，不是新裁决。
- **不否定 #606 之前的结论**：11/11 仍是那棵树上的事实，只是不是今天这棵树的 current claim。
- 未逐条复跑已归档的 run log；本文件的每个数字都直接取自 §1 点名文件，凡文件未记载的写 `UNVERIFIED`
  （唯一一处 = §2.2 的“BL-18 若启动会怎样”）。
