# ALPHA.5 SANDBOX-FIRST — END-STATE TABLE（诚实终态表）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **这份文件回答一个问题**：一个 Member 今天**实际能做什么**，我们能对它说出的**最强真话**是什么，
> 以及读者最容易误信而**没有证据**的那句话是什么。
>
> 每个事实都要能打开一个文件；打不开的写 `UNVERIFIED`。等级与 `V@B` 的机器可读值只在
> `TOOL-ACCEPTANCE-MATRIX.md`，本文件**不复制**它们、也**不改变**它们。
>
> 日期：2026-11-08 · 树：`task/a5sf-consolidate-20261108` @ `dfab3fa5c3a5a5637fb1c02c941cfc1e5c9d05c0`
> · **0 boots** · `CORE_PATCH_BUDGET = 0`。
>
> 术语（`V@B` / arm / face / admission refusal / §7 network bar）各一行，见
> `LIVE-EVIDENCE-LEDGER.md` §0。本文件的“面”采用 `ALPHA5-SANDBOX-BACKLOG.md` §0.1.1 的登记：
> 六个能力面（FS Provider / Subprocess / Shell-PTY / Web / External execution / Non-data-plane）
> 加一个 cross-face 桶；下表把 Non-data-plane 单列一行，Cross-face 也单列一行，因为发布门属于后者。

## 0. 2026-11-09 owner 决策（三条，取代此前的 PD-1 延期）

外部审查与 owner 同日裁决，逐条记录，因为它们改变本文件的结论边界：

1. **Boot 预算（2026-11-09 被 dev-live 裁决取代，原文保留为历史）：有条件预授权 3 次。** 生效条件是
   两个，缺一不可：**(i) `TeamDomain is closed` 得到 host-free 归因**；**(ii) 存在真正可区分的启动前
   负控**（能在启动前判定这一类失败，而不是又一条静态门禁）。在两者满足之前，这 3 次**不可用**。
   跟踪：`dev/agent-workflow/evidence/a5sf-domain-attrib/`。
   > **【2026-11-09 owner 裁决：本条作为正式预算已关闭】** 五次 P2-04 start 池的算术（5 allocated /
   > 5 spent / 0 remain）**只作为候选分配的历史**继续有效；它**不再**是未来开发的预算约束。开发启动
   > 改记为 **`DEV-LIVE`**：由持有面级 `scope: "dev-live"` authorisation 的 Capability Implementer
   > 自行授权、可反复启动、无固定累计上限（每机 2 并发），**不得**计入、也不得从任何候选分配中扣除。
   > `CANDIDATE-C2` 仍需冻结 + 独立复核 + 独立验收。协议 = `docs/ROUTER_RULES.md` §0.1 第 4 条，
   > 操作页 = `docs/DEV-LIVE-OPERATOR-GUIDE.md`。
2. **报告节奏：** 60 轮不再作为收口点，正式阶段性开发报告须在**第 75 轮之前**提交；报告**不等于** Alpha.5 通过验收、
   也不等于停工，之后可继续开发。本文件因此是**阶段性**陈述，不是发布结论。
3. **PD-1：批准"代际明确"的撤销接口**（`revoke` 接收受信 member 身份，含 `teamId`/`memberInstanceId`/
   `instanceGeneration`），**不采用**按 `memberInstanceId` 永久生效的墓碑（那会阻止新代际合法重建 Shell，
   与既有设计冲突）；同时必须封住 **`spawn()` 执行期间 revoke** 的竞态：迟到的创建结果不得获得执行资格。
   §0.1 中 2026-11-09 早些时候的"延期"裁决**被本条取代**（保留为历史）。跟踪：`dev/agent-workflow/evidence/a5sf-pd1-fix/`。
4. **明确不做的事**（审查建议，采纳）：停止为每个未完成项新增治理机制；剩余工作集中在真实缺陷修复、
   未完成范围的准确说明、以及证据可复现性上。

## 1. 终态表（每面一行）

| face | 今天一个 Member 实际能做什么 | 最强真话（有证据） | 最容易被误信、但没有证据的那句话 | 证据指针 | 阻塞 |
|---|---|---|---|---|---|
| **FS Provider**（M-01…M-05） | 在**今天 shipped 的产品里**，Member 的 `read`/`write`/`edit` 走继承的宿主 provider，不受 Alpha.5 车道约束——因为没有任何 shipped composition/preset 声明 `a5sfMemberPolicies`。只有当某个组合**声明了**该面时，受限 realm 才挂载，读写才被中介；`read_image` 在 route-C 下**直接失败**（`GAP-FS-CONTRACT-1`，PD-5） | 20 条 host-free 臂（真 pinned `tool-fs` + 真 `LocalFileSystem` + 产品 route-C seam）表明：在**声明了该面的组合里**，read/write/edit/create 在任何 provider 调用前就按编出的交集判定，`read_image` 的 route-C 失败也是**先抛错、零 provider 读**（fail-closed） | “Member 的 FS 已经被沙箱住了。”——今天的成品没有任何 preset 声明这个面；而且 live 半场（真实 Host 上的 preset、附件 store、模型路由）**未证**，`V@B=no` | `dev/agent-workflow/evidence/a5sf-fs-face/README.md` §2–§6；`dev/agent-workflow/evidence/a5sf-product-assembly/README.md`；`dev/agent-workflow/evidence/a5sf-candidate1/README.md`（11/11，`1484fa4ee`，已被 #606 撤回） | B1、B4、B6（PD-5 `read_image` 死） |
| **Subprocess**（M-06/M-07/M-16） | `grep`/`glob` 只有在组合**自带** P1-07 `ConfinedProcessProvider` + launcher pin、并声明 `subprocess` face 时才受限；没有被声明时，它们是普通宿主工具。第三方 CLI 仍是 `PROBE-GATED`（机制有、端到端无） | 15 条 host-free 臂（`a5sf-sub-contract.test.mjs`，真 pinned `fs-search` + 真 `rg` + 真 Landlock launcher）表明：越界搜索在**任何进程存在之前**被准入层拒绝（`spawns=0->0`、恰一条 deny fact），in-lane 搜索 exit 0/1/2 保真 | “`network: deny` 意味着离线。”——它只意味着**我们自己的准入层拒绝 spawn**（OS 从未被要求拒绝任何连接）；§7 的五项一项都不存在 | `dev/agent-workflow/evidence/a5sf-bl16-grep/README.md`；`dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §3/§5/§7 | B1、B3、B4 |
| **Shell-PTY**（M-08/M-09/M-10/M-13） | **没有受限 shell。** `RealmServiceFaces` 没有 `terminals`，任何消费 `ctx.terminals` 的原生模块在组合期被 `TERMINALS_LEGACY_PTY_REFUSED` 拒绝；没有产品组合声明 shell class，所以 `bash` 在每个产品 realm 上以 `SUBPROCESS_SHELL_NOT_DECLARED` 拒绝 | 14 条 host-free 臂（真 pinned `TerminalSessionService` + 产品 registry + 注入 PTY 端口）表明：分配/复用/撤销/回收的转移、命令门的准入、旧代 PTY 拒绝的**顺序**、并发身份不串；退出状态在产品 registry 被塌缩成 `killed:true`（PD-8） | “Member 有 shell，只是被策略拒绝。”——**没有面**，拒绝是结构性的；真实 PTY 从未在受测路径上出现（端口是 double），live 覆盖为**零**（BL-17 两次启动 `NOT_REACHED`） | `dev/agent-workflow/evidence/a5sf-pty-face/README.md` §1–§7；`dev/agent-workflow/evidence/a5sf-bash/README.md`；`dev/agent-workflow/evidence/a5sf-bl17-live2/README.md` §9 | B2、B3（PD-1/PD-2 是接线前必须先修的治理洞） |
| **Web**（M-14/M-15） | `#608` 之后行侧转发 `compiled.web` 并支持 `a5sfWebFace`；但**没有 shipped preset 声明它**。strict Member **完全不能**承载 `web_fetch`/`web_search`（surfaced ⇒ A2C-2 fatal；denied ⇒ route-C 拒绝 ADD）；唯一可达的 caller 是 preset 已 surface 这对名字的 legacy/non-strict Member | 10 条 host-free 臂（真 pinned `tool-web` + 产品挂载面）表明：deny 车道的拒绝发生在**face 上、provider 之前**（一条 guard fact，fetch/search/transport/dns/connect 全零）；allow 车道在进入 provider 时已有 guard fact | “Web 面已经接线，所以 Member 的 `web_fetch` 被管住了。”——行侧转发 ≠ 有 caller 可达 ≠ 有 shipped preset 声明；live 半场**零启动**（BL-18 allocation #5 未花） | `dev/agent-workflow/evidence/a5sf-web-face/README.md` §3/§5/§7；`dev/agent-workflow/evidence/a5sf-bl18-live/README.md` §2/§3/§6 | B1、B3、B4 |
| **External execution**（M-11/M-12/M-17/M-18） | **什么都不能（就本阶段而言）。** PTC 是 `@deepseek-ai/dsh-tools` 的执行模式、不是可装载工具模块；LSP 模块存在但不在产品 preset；stdio/remote MCP 没有产品接线。三者在矩阵里是 `NOT_WIRED` / `UNSUPPORTED` | 这里没有可被绕过的面：没有 routed-native 接入面，因此本阶段**不作**任何“外部执行受控”的声明；remote MCP/SSH 的“远端效果不承诺”是**披露**，不是保证 | “`UNSUPPORTED` 等于已经限制。”——它等于**没有实现**；把它读成限制是本阶段明令禁止的读法 | `TOOL-ACCEPTANCE-MATRIX.md` §1.1.1 / M-11/M-12/M-17/M-18；`NATIVE-SOURCE-INVENTORY.md` §2/§3 | B5 |
| **Cross-face**（治理/发布） | 没有任何东西“因为完成而可发布”：G2 只有 read/write（且已过期），G3/G4/G5 未开始；10 条产品债里 8 条仍待 owner 裁决（PD-1 是治理洞） | 本阶段的每一条 release 义务都仍未达成；`PRODUCT-DEBT-REGISTER.md` 的十行是“报告过但未修”的完整清单，且每条都带 host-free 臂与验收条件 | “只剩一次 boot 就能收口。”——恢复 current claim 至少需要一次新授权启动；Shell-PTY 的 live 半场需要先有 face；`network: deny` 需要先有后端（BL-42） | `ALPHA5-SANDBOX-BACKLOG.md` §0.3；`PRODUCT-DEBT-REGISTER.md` §1–§3；矩阵 §3 | B1–B7 |
| **Non-data-plane**（M-19/M-20/M-21） | state 工具（`goal`/`todo`/`jobs`/`session`/`ask`）只经 Alpha.4 调用准入，本阶段不另设数据面上限；`present`/`skill`/附件读取若触文件则来源能力另算（`CONDITIONAL`）；未知同进程 JS 明确 `UNSUPPORTED`（`TRUSTED_ONLY`） | 本面对数据面**没有**可被面约束的 I/O，因此加一层上限只会制造伪保证；已知可能读用户文件的工具被标为 `CONDITIONAL` 而不是“无 I/O” | “`present`/`skill` 不会读任意文件。”——那正是 `CONDITIONAL` 的意思：**可能读**，且不在本阶段的读上界内 | 矩阵 §1.1.1 / M-19/M-20/M-21；`ALPHA5-SANDBOX-BACKLOG.md` §6 | B5（BL-25 批量条目未开始） |

**读法**：每一行的“最强真话”都是 **host-free**（C1）或已被撤回的 live（C2†）；**没有一行**的最强真话
是“今天在真实 Host 上成立”。这就是 §2.1 的算术（5 allocated / 5 spent / 0 remain / 0 current live verdicts）在
表格里的样子。

## 2. 十条产品债：当前状态与 owner 决策

状态词只有两个：**`FIXED`（有已合并 PR）** 与 **`OPEN`**。`PRODUCT-DEBT-REGISTER.md` 的正文仍是
逐条详情与验收条件；本表只做“今天值多少”的摘要。

| id | face | 债（一句话） | 后果类别 | 状态 | 仍是 owner 决策？ |
|---|---|---|---|---|---|
| PD-1 (F3) | Shell-PTY | 撤销不绑定“当时还没有 shell”的 Member，之后 `acquire` 仍成功 | governance hole | **OPEN** | **是** — 语义/API（generation 从哪来） |
| PD-2 (F2) | Shell-PTY | deferred PTY 拒绝在 legacy session 已分配**之后**才触发 | governance hole | **OPEN** | **是** — 语义，且被 PD-3 阻塞 |
| PD-3 (GAP-PTY-CONTRACT-1) | Shell-PTY | 没有 confined terminal face，拒绝是**全部**的 | behavioural divergence | **OPEN** | **是** — 语义（一个 face + 一个 backend） |
| PD-4 (P5) | Subprocess | confined child 丢掉上游的 **proxy overlay**（`NODE_USE_ENV_PROXY` 等） | behavioural divergence | **OPEN** | **是** — proxy overlay（依赖/lockfile 或重实现） |
| PD-5 (GAP-FS-CONTRACT-1) | FS | routed `read_image` 解析不到 `fs`，route-C 下**不可用**（修法 = `fs` 进 `ROUTED_SERVICE_NAMES`） | behavioural divergence | **OPEN** | **是** — `fs` in `ROUTED_SERVICE_NAMES`（路由 seam） |
| PD-6 (GAP-SUB-CONTRACT-1) | Subprocess | shipped `bash-local` 执行体（bare `argv[0]` + spill）无法骑 confined face | behavioural divergence | **OPEN** | **是** — shipped `bash-local` executor 的中介包装 |
| PD-7 (F4) | Shell-PTY | stale-but-live shell 被报 `active` | evidence-quality | **FIXED** — PR **#619**，master 提交 `572a7625d` | 否（已修） |
| PD-8 (F1) | Shell-PTY | shutdown 回执分不清“退出”与“被杀” | evidence-quality | **OPEN** | **是** — 语义/API（`PtyHandle.status?()`） |
| PD-9 (GAP-PTY-CONTRACT-2) | Shell-PTY | P1 的 “write”/“read” 实为命令门与 descendant 审计，臂名曾经夸大 | evidence-quality | **FIXED** — PR **#620**，master 提交 `bab33c4c6` | 否（已修） |
| PD-10 (GAP-WEB-CONTRACT-1) | Web | 每个真实 `web_search` fact 记下畸形 marker | evidence-quality | **OPEN** | **是** — 语义（记录值） |

**小计：8 条 OPEN（全部需 owner 决策），2 条 FIXED（有已合并 PR）。**
`PRODUCT-DEBT-REGISTER.md` 把 PD-7/PD-9 写成 “draft PR #619/#620”；`git log origin/master` 显示两者
已 squash 合入（提交号见上表）。这是**状态更新，不是内容改写**。

## 3. 被敌意审阅者最先攻击的三句话（本轮点名，供最终报告直面）

这三句不是“写错了”，而是**在文档里以现在时出现、但只在过去某棵树或某个假设下成立**的句子。
它们是最容易被引用成“项目自称已完成”的材料：

1. **`TOOL-ACCEPTANCE-MATRIX.md` §1.1（2026-11-05 allocation #4 段）**：
   > “于是 `M-01`/`M-02`/`M-06`/`M-07` 四行现均为 `ENFORCE-PARTIAL` / `V@B=yes`。”

   该句写于 #606 之前；同一节 20 行之后就写了四行回到 `V@B=no`。**“现”字已经过期**，但句子本身
   没有被删（历史保留）。敌意读者会拿它证明矩阵自称当前已验证四行。回应方式：指向本节与 §1.2，
   并说明“历史绿 ≠ 新验收”是同一文件开头的规则；撤回依据是
   `dev/agent-workflow/evidence/a5sf-candidate1/README.md` 与合并 `#606` 后的 28 条漂移路径。
2. **`docs/STATUS.md` 顶部最新 CURRENT 快照（2026-11-05T00:22Z）**：
   > “`M-06`/`M-07`（grep/glob）实测树 … 复位 `ENFORCE-PARTIAL` / `V@B=yes`。”

   这是**活快照**里的一句当前断言，而矩阵已按 Q7 撤回。STATUS 是 living 快照、非权威源，但它是最先
   被读的文件。本轮已在 STATUS 顶部追加 dated 更正块（不改原文）。
3. **`ALPHA5-SANDBOX-BACKLOG.md` BL-18 行（2026-11-06 接线轮）**：
   > “`a5sf-realm-row.mjs` 现转发 `compiled.web` … 缺失/不可挂载时以 typed `NETWORK_UNCONFINED_REALM`
   > 在 composition 期 fail-closed”

   它读起来像“Web 面接线可用”，但 `a5sf-bl18-live/README.md` §3 证明：**没有 shipped preset 声明该面**，
   且 strict Member 根本无法承载 `web_fetch`/`web_search`——唯一可达 caller 是 legacy/non-strict Member。
   “接线存在”与“Member 可达”是两件事，这句话把前者写成了后者。BL-18 行已追加 dated 更正。

（第四句候选，供参考：矩阵行 M-01 的 ⑥ 列以 “**live 已实测**” 开头而 ⑨ 列是 `V@B=no`——同一行里
“live measured”和“not current”并存。它没有被列入三句，是因为该行 1.1 节与 §1.2 紧邻解释；
但它同样是扫描式读者会误读的地方。）

## 4. 要把任一行变成“今天成立”，最小需要什么

| 面 | 最小解锁动作 | 谁签 |
|---|---|---|
| FS Provider | 一次新授权 boot，在**当前** baseline 树上重跑 read/write（fixture 拆分已在位），恢复 `V@B=yes`；外加一个 shipped preset 声明 `a5sfMemberPolicies` | owner（预算）+ Integration Owner（preset） |
| Subprocess | 同上（grep/glob 六行）；外加 `grep`/`glob` 的 confined face 由 shipped 组合提供 | owner + Integration Owner |
| Shell-PTY | 先修 PD-1/PD-2，再加 `terminals` face 与 confined backend（PD-3/BL-17），然后才有可测的 live 面 | owner（API 语义）+ infra |
| Web | 先让 shipped/受测 blueprint 有一个 legacy/non-strict caller（preset 已 surface 该 pair），再花一次 boot 测 deny 车道（#626 之后 bundle 已能 `PASS 18/18`） | owner（预算）+ Integration Owner（blueprint） |
| External execution | 先造面（BL-19 等），再谈验收；当前无解锁动作 | owner 范围裁决 |
| Non-data-plane | BL-25 批量条目；若某工具确实读写文件，必须**重新归面** | owner（范围） |
| Cross-face | BL-42（真实 network-deny 后端）、BL-39（`/etc`+`/proc` 例外收窄）、G3–G5 | owner + infra |

## 5. `UNVERIFIED`（本轮不能证实、也不猜的项）

1. **`dev/agent-workflow/evidence/a5sf-bl18-live2/`**：第一版断言该路径不存在、第 5 次启动从未发生——
   **这是错的**（写它时 base 不含 PR #627）。该目录存在且完整，第 5 次启动确实发生并在 boot 阶段中止，
   四个 wiring 项为 **NOT PROVEN**（不是 `UNVERIFIED`）。详见 `LIVE-EVIDENCE-LEDGER.md` §2.1/§2.2。
2. **“5 spent, 0 remain”**：与四份在册 README 的 4/5 算术冲突（`LIVE-EVIDENCE-LEDGER.md` §2.1）。
   本文件采用 **5 allocated / 5 spent / 0 remain**（2026-11-09 更正：第 5 次启动已在 PR #627 上发生并中止于 boot 阶段，`a5sf-bl18-live2/` 存在；此前的 “1 unspent” 基于不含 #627 的树）。
3. **真实 PTY 的 OS 级行为**（`/dev/pts/N`、session leader、`SIGKILL` 到进程组、zombie/fd 计数）：
   端口是注入的 double，任何 OS 级结论都未观测（`a5sf-pty-face/README.md` §5）。
4. **真实 HTTP/DNS/redirect chain/proxy 行为**：所有 web 臂的传输是 recorder，没有 socket
   （`a5sf-web-face/README.md` §5）。
5. **CI 托管 runner 上 layer-B 套件是否真的执行**：无 pinned host 时用例登记为 SKIPPED，CI 在
   `pass 0` 下为绿——这是证据供给缺口，不是通过（`a5sf-fs-face/README.md` §10）。

## 6. 这份表不做什么

- 不改任何 grade、`V@B`、gate、`packages/**`、`.github/**`；不删任何证据。
- 不把 host-free 臂写成 live，不把“拒绝 spawn”写成隔离，不把 `UNSUPPORTED` 写成“已限制”。
- 不复制矩阵等级：要机器可读的等级与 `V@B`，读 `TOOL-ACCEPTANCE-MATRIX.md`。
