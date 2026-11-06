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
> **2026-11-10 增补（LIVE-DEBT；只追加，§1–§4 的账一字未动）**：文件现在有**两个弧**。§1–§4 是
> **候选分配**（P2-04，5/5/0，已关闭）；**§5–§6 是 `DEV-LIVE` 弧**（31 次自授权开发启动，四条车道），
> 记录它实际用掉多少次、每条车道抓到哪些**仪器缺陷**（含一次靠读原始证据才抓到的**假绿**），
> 以及旧模式与新模式的**时间算术**——只写能算的，不写倍数。两个弧**不可相加**。
>
> 日期：2026-11-08 · 树：`task/a5sf-consolidate-20261108` @ `dfab3fa5c3a5a5637fb1c02c941cfc1e5c9d05c0`
> （`origin/master` = PR #626 tip；本仓历史中**没有** PR #627）· **本文件 0 boots** ·
> `CORE_PATCH_BUDGET = 0` · 不改任何 grade / `V@B` / `packages/**` / `.github/**`。

---

> **【2026-11-09 owner 裁决：本账作为正式预算已关闭】** 这份账记录的是**候选分配**（P2-04 的 5 次
> start）的历史；算术仍是 **5 allocated / 5 spent / 0 remain**，且**不再有**“下一次候选分配”。
> 自 2026-11-09 起，开发用的真实 Host 启动改记为 **`DEV-LIVE`**：面级 `scope: "dev-live"`
> authorisation 即由 Capability Implementer 自行授权、可反复启动（每机 2 并发、无固定累计上限），
> **不得**计入本账的候选分配，也**不得**被读成候选证据——`DEV-LIVE` 记录**永不**产出 `V@B=yes`。
> 正式候选验收仍走 `CANDIDATE-C2`（不可变 SHA + Authority + Host + Oracle + 独立裁决）。
> 协议 = `docs/ROUTER_RULES.md` §0.1 第 4 条；操作页 = `docs/DEV-LIVE-OPERATOR-GUIDE.md`。

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
（2026-11-09：这是**候选分配**的历史算术。之后出现的开发启动一律 `DEV-LIVE`，不进入本式，
也不产生新的候选分配。）

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

---

# 5. 第二个弧：`DEV-LIVE`（31 次启动，四条车道）

> **这一节是新弧，不替换 §1 的五次分配。** §1 记的是**候选分配**（P2-04，已关闭，5/5/0）；
> 本节记的是 2026-11-09 owner 裁决之后、由面级 `scope: "DEV-LIVE"` authorisation 自授权的
> **开发启动**。两者**不能相加**、**不能互抵**：`DEV-LIVE` 记录**永不**产出 `V@B=yes`，
> 也**不得**计入任何候选分配（`docs/DEV-LIVE-OPERATOR-GUIDE.md` §2/§3；
> `docs/ROUTER_RULES.md` §0.1 第 4 条）。这一节的全部数字都取自产物自带的 `at` 字段与
> 各车道 README/RUNS 的表格，未做二次换算。

## 5.1 实际用掉的启动数（数据，不是预算）

| 车道 | 启动 | 首次启动（产物戳记 UTC） | 首个**稳定**结果 | 首个稳定结果那次启动 | 稳定判据 | `DEV-LIVE` 证据 |
|---|---|---|---|---|---|---|
| Web | **7** | `2026-11-06T08:27:50.659Z` | run-06（`2026-11-06T08:51:47.555Z`），与 run-07 逐条一致 | 第 6 次 | 连续两次同 driver、同 head、逐条 fact 相同（`two-run-agreement.json`） | `dev/agent-workflow/evidence/a5sf-web-devlive/` |
| FS/Search | **4** | `2026-11-06T08:37:29.565Z` | run-3（`2026-11-06T08:51:39.071Z`），与 run-4 逐行一致 | 第 3 次 | 14 行表在 **reason 粒度**逐行相同（`driver/runs/INDEX.json`） | `dev/agent-workflow/evidence/a5sf-fs-devlive/` |
| Shell-PTY | **9** | `2026-11-06T10:51:28.404Z` | run-08（`2026-11-06T11:10:23.491Z`），与 run-09 逐条一致 | 第 8 次 | 六条 verdict + 事实逐条相同、期间无代码改动 | `dev/agent-workflow/evidence/a5sf-pty-devlive/`（分支 `task/a5sf-pty-devlive-20261110`） |
| Subprocess | **11** | `2026-11-06T10:53:21.743Z` | boot 10（`2026-11-06T11:15:22.579Z`），与 boot 11 逐条一致 | 第 10 次 | 同 driver 字节（`sha256=a05c62cb…`）、8 个命题 + 4 个 case 相同 | `dev/agent-workflow/evidence/a5sf-sub-devlive/`（分支 `task/a5sf-sub-devlive-20261110`） |
| **合计** | **31** | 最早 `08:27:50.659Z` | 4 个稳定结果（每面一个） | — | — | — |

每次启动都有它自己的 World（`tests/homes/<world>`）、自己的 3180 族端口、自己的 teardown 回执
（`portClosed`/`homeRemoved`/无孤儿进程），以及一条 `DEV-LIVE` 账目行（`budget-intent` + boot +
`dev-live-outcome`）。Web 7 / FS 4 / PTY 9 / Sub 11 = **31**。机器并发上限 2 个 dev Host 未被突破：
Web 与 FS 的启动时刻在 08:27–09:03 交错、PTY 与 Sub 在 10:51–11:17 交错，每条车道各自的 README/RUNS
都记了同一件事（FS：一个槽位、另一个槽位归另一条车道；PTY：`lease.holdsSlot()` 在每次 `boot()` 后断言）。

## 5.2 每条车道抓到的仪器缺陷（这是本节真正的产出）

四条车道的失败**几乎都不是产品失败**，而是仪器把“错误的绿”或“错误的红”交给操作者。逐条列，
因为它们对下一个面是可直接复用的陷阱清单：

| 车道 | 仪器缺陷 | 它会把读者骗成什么 | 修法（留在 driver/预检里） |
|---|---|---|---|
| Web（run-01） | 继承的 mock `makeDecide(request)` 把 `{seq, req}` 信封当成 request body，每一轮都落进无害的 `fallback` 分支 | “两侧都 REFUTED、0 fact”看起来像产品没接线；实际**没有任何 model tool call 被发出** | `decide({seq, req})` 读 `req`；决策按请求持久化；两个 legacy Member 模板各管一个 case |
| Web（run-02） | fetch Member 的**第一个**请求是带 delegation marker 的标题生成轮，driver 按 marker 重新 key 后把唯一一次脚本化的 tool call 花在标题轮上；search 侧把 guard 的 `capability-probe` 行当成 provider entry | “deny 车道泄漏到 provider”/“shot 丢了” | 标题/发现轮不得被 marker 重 key；provider entry 只按 `leg: "provider-entry"` 计 |
| Web（run-03） | driver 仍要求人类可读的拒绝文本复述 `NETWORK_UNCONFINED_REALM` | 产品完全正确却判 REFUTED | `refusalNamesTypedCode` 从 pass 条件降为 observation |
| FS（run-1） | abort 后的 re-judge 拿 **search** 完整性规则去问新的 `fs:edit-*` id | “产品在 `delegate-dispatch` 挂了” | `judgeSettledRows` 跳过 `EDIT_CASE_SET`；abort 路径保留 `failed`/`detail` |
| FS（run-2） | `fs:edit-outside-ceiling` 拿**过期的两行** `plantedContent` 比盘上内容 | 未被动过的文件被读成 `disk_mutated_outside_ceiling` | 单行 planted 值；按**效果**判 edit-outside 拒绝 |
| PTY（run-01） | 判据 ×4：从 **driver 的** PID namespace 读 `/proc/<pid>`、`ps -o tty=`；`MK_PTY_WORKER` 是 `MK_PTY_WORKER2` 的前缀且先匹配；`typedCode` 只读 `error.info.code`（产品不填）；kernel 臂声明了**越界** read | 真 PTY 被看成假 PTY、控制 Member 从未跑 `bash`、两次真拒绝判 FAIL、内核臂根本没被问到 | shell 自己读 `/proc/$$/stat` 的 `tty_nr`；非前缀 marker + 最长优先路由；typed code 四个来源；kernel 臂声明**界内** read |
| PTY（run-02） | 重构残留标识符 `observeSessions is not defined`（`node --check` 查不出） | 启动直接中止，0 verdict | 加 **eslint `no-undef`** 门（四个仪器模块，必须 0 error 才能启动） |
| PTY（run-03） | Q1/Q2 用 `/proc/$$/stat` 第 6 字段（`session`，跨 PID namespace 恒 0）当判据；网络判据要求“恰好一条 guard fact” | 又把真 PTY 判假；把**正确的空 sink** 判失败 | Q1 改用 `tty_nr`↔`fd0` 设备一致性；Q2 去掉 session 门；网络按 typed refusal + 0 进程判，0 fact 记为 **LOCUS** |
| PTY（run-04） | 共享状态命令用**相对** `cd lane/inside`，而 shell 的起始 cwd 是 Host checkout | cwd 断言不可测 | 每 run 插入绝对 lane 路径；先捕获起始 cwd 再 `cd` |
| PTY（**run-05/06，假绿**） | “第二条命令”是把第一条的 `RUN=1` 改名为 `RUN=2` 得到的，于是它**先 re-export、re-cd 再读**——观测制造了它自己报告的状态 | **6 PASS**，且“第二个 Member 也看到了 token”的读法完全错误 | 拆成三条独立命令（`setup` / `read` / `control`）。**这个假绿是靠读控制 Member 的原始 `tool_result` 抓到的**，不是靠判据自检 |
| PTY（run-07） | 控制臂仍用**另一套** mini-parser，从不读 `SHARED_SEEN`/`CWD` | 行为正确的控制被判 FAIL | 所有臂（含控制）共用同一个 `ptyOf` 解析器 |
| Sub（boot 1） | 从**最后**一条 mock 请求读 leader 面，而那是一条标题请求（0 tools） | “leader surface (0)”，产品行为未被观测 | 选携带 `MK_DISC` 且有非空 `tools` 的请求，并记录 `surfaceBasis` |
| Sub（boot 3） | 两条判据写错 + `overall` 硬编码，两次实际 2/3 的运行被报成别的结论 | 账本失真 | boot 4 起从 finalize 后的 record 计算 `overall`；更正行指名缺陷而不改写 |
| Sub（boot 6/7） | fixture：`sandbox-policy` override 行没有 `name` 把整行禁用 → `sandboxPolicy` 服务缺席；补上 `name` 后新判据 `sandbox-root-pinned` 为假 | 一对启动烧在同一个 pin 上 | 保留为点名的阴性结果（boot 7 的假判据变成了 **PD-14** 的实测事实） |

**一处内部口径不一致，如实记录**：`a5sf-sub-devlive/README.md` 的 “Cost, honestly” 写 “Four of the
eleven starts failed for four different reasons”，而同一车道的 `RUNS.md` 索引表列出的非绿启动是
**5** 次（boots 1、2、3、6、7）——其中 boot 2 是**产品**不变量的正确拒绝（native module 往 Member 面
加工具），不是仪器缺陷。本账采用 RUNS 表的 5 次非绿 / 4 条仪器+夹具原因，并把 boot 2 单列为“产品
正确拒绝”。不解决措辞差异，只标注它——两份文件都在库里，读者可自行核对。

## 5.3 这个弧买到了什么、没买到什么

买到了：**四个面各一个两次一致的 live 结果**，以及四个此前只有推断的洞/分歧被**测量**（PD-12、PD-13、
PD-14，以及 PD-10 的 live 复核 + `chmod` 的 `LIVE-REPRODUCED`）。没买到：**任何 candidate 资格、
任何 `V@B`、任何 OS 级隔离证据**（Web 的传输仍是 recorder，PTY 的 `bash` 仍只有宿主自己的
`workspace-write` bwrap，Sub 没有任何 `enforced` 网络后端）。这四份结果**不能**用来关闭 G2–G5。

# 6. 时间算术：旧"正式分配"模式 vs `DEV-LIVE` 模式（只算能算的）

问题（owner 提的）：**到第一个稳定 live 结果用了多久**，两种模式各是多少。

**旧模式（每次启动要 owner 明文分配）**，数字取自 §1 的 `a5sf-candidate1/run-ledger.jsonl` 与
`a5sf-bl18-live2/ledger.json`：

- 第一次分配的 intent 行 `2026-11-05T12:17:52.289Z`（boot 行 `12:17:58.807Z`）；
- 唯一一次产出结论的 PASS 在第二次分配的启动上，intent 行 `2026-11-05T12:33:06.599Z`
  → **距第一次启动 15m14s**，但它**当天就被 #606 的 Q7 漂移撤回**，从未成为“当前”结果；
- 最后一次（第 5 次）启动的 boot 行 `2026-11-06T05:07:39.154Z`
  → 第一次到第五次启动的跨度 **16h49m40s**；
- 稳定结果数：**0**（没有一对连续一致的 live 运行；唯一 PASS 是单次）。

**`DEV-LIVE` 模式**（同一时钟源，各车道“首个启动 → 该车道首个稳定结果”）：

| 车道 | 首个启动 | 首个稳定结果那次启动 | 用时 | 用了几次启动 |
|---|---|---|---|---|
| FS/Search | `08:37:29.565Z` | `08:51:39.071Z` | **14m09.5s** | 3 |
| Shell-PTY | `10:51:28.404Z` | `11:10:23.491Z` | **18m55.1s** | 8 |
| Subprocess | `10:53:21.743Z` | `11:15:22.579Z` | **22m00.8s** | 10 |
| Web | `08:27:50.659Z` | `08:51:47.555Z` | **23m56.9s** | 6 |

四条车道整个弧从最早一次启动（`08:27:50.659Z`）到最后一次启动（`11:17:02.423Z`）是 **2h49m12s**，
产出 **4 个稳定结果**。

**能算的算术（都写出来）**：

- 每次稳定结果摊到的启动数：`DEV-LIVE` = 31 / 4 = **7.75 次/结果**；旧模式 = 5 / 0 —— **分母为零，
  不可计算**（这也是为什么本文不给“快了多少倍”）。
- 每次稳定结果摊到的墙钟：`DEV-LIVE` = 2h49m12s / 4 = **42m18s/结果**；旧模式 = 0 结果，同样**无定义**。
- 旧模式每次启动摊到的墙钟：16h49m40s / 5 = **3h21m56s/启动**（0 结果）。
- 两条最慢的车道（PTY 9 次、Sub 11 次）与最快的车道（FS 4 次）之差是 **7 次启动**，而 FS 是唯一一条
  **从第一次启动起就有会真正执行的 zero-boot preflight**（`driver/preflight-bundle.mjs`，每次
  `PASS 18/18`，不过就不 spawn）的车道。

**必须写在同一段里的三个限制**：

1. **不可比的分母**：旧模式到第一个稳定结果的耗时**不存在**（0 个稳定结果），所以“X 倍提速”
   是算不出来的，本文不写。
2. **摊销**：`DEV-LIVE` 的四条车道是从已经包含旧模式五次启动教训的 master 上切出来的
   （`CASE_LOCATOR_ALIASED`、driver gate 顺序、leader 面选择、caller 面覆盖、admission-refusal 分类、
   bundle case 覆盖都已在预检里）。FS 的 14m09s **不能**单独归功于 dev-live 裁决：它站在旧模式的
   5 次花费上。
3. **时钟标签**：上文所有时刻都是产物自带的 UTC `at` 字段；owner 裁决的**日期标签**是 2026-11-09，
   而四条车道的产物戳记落在 2026-11-06。本账不解释这个差（`docs/ROUTER_RULES.md` 头部记有时钟锚点
   与“会话日历 vs 真实 UTC”的历史），只声明：**上面所有减法都在同一时钟源内做**（同一条车道的
   ledger 行之间，或同一批候选 ledger 行之间），所以差值不受标签偏移影响；跨模式的**绝对日期**
   比较不做。

**一句能 defend 的结论**：*旧模式用 5 次正式分配、16 小时 49 分换来 0 个当前 live 结果；`DEV-LIVE`
用 31 次自授权启动、2 小时 49 分的同一工作窗口换来 4 个两两一致的 live 结果——但这不是同一分子的
比较（旧分子的结果是零），且新模式的每一次“快”都分摊了旧模式 5 次失败留下的预检，所以只能说
“从零到四个稳定结果”，不能说“提速 N 倍”。*
