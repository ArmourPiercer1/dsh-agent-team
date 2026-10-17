# review-W7 — W7 jobs-gateway-wiring 轮（独立 reviewer 裁决）

- **Reviewer**：W7 独立 reviewer（qwen3.8-flash-next；≠ writer 会话 f156d85d）
- **受审**：`alpha5-wire-pr7 @ d87e641c`（base `62cc2b87`），一次性 worktree `.worktrees/w7-rev-w7`（detached 固定 SHA，审中零改受审文件）
- **裁决：通过（PASS）**，附 4 条 MINOR 记录性注记（措辞/健壮性级，不阻塞、不构成补充内容）

## 0. 零生产面（IF-5，亲验）

`git diff --name-status 62cc2b87..d87e641c` = **55 文件、全部 `A`、0 修改**，全部位于 `dev/agent-workflow/evidence/alpha5/wiring/w7/**` 与 `tests/kits/a5-w7-jobs-wiring/**`；packages/、scripts/、根 vitest.config、shared tsconfig、agent-bindings/live-registry 零触（唯一含 "tsconfig" 的新文件是 kit-local `tsconfig.lane.json`，非共享面）。kit 运行期写面代码级审计 = 仅世界目录、evidence 目录、gitignored `node_modules/.a5w7-jobs-build`。宿主 `@639ed01539` porcelain=0，审中审后皆然。

## ① 隔离三件判据 = 真钉，非宽松 — 成立

- **互不可见=exact set（非"未见即通过"）**：W4a 双侧钉死——`visible` 为排序后**精确数组**（A=`[w7-a-1,w7-a-2]`、B=`[w7-b-3,w7-b-4,w7-pin-1]`），且 `refused` 恰为对方全部 jobId 且码全 `owner-mismatch`（A 侧 3 条/B 侧 2 条，计数+集合双钉）；W4b 追加 boot-root leader（真实第二会话）`visible=[] / refused=5/5` 与 same-instanceId/异-root 观察者=另一 owner 同样全拒。**本审用自己的断言（非 kit 的 `check()`）从复跑原始件 `isolation-comparison.json` 重推四视图，逐集合恒等复现。**
- **观测面披露诚实**：拒绝采用 lane 明文设计的 refusal-over-absence（`web-projection.ts`），故跨域 list 的 `refused[]` 会**枚举对方 jobId**——本审复核：refused 面只含 `{jobId→code}`，detail 全为静态原文，ownerKey/instanceId/childSessionId/rootSessionId 零出现（全比较文件内 `session-team-child` 命中=0）。"互不可见"的钉法是**投影/状态不可见**，存在性按设计不隐藏且逐字披露在证据里——口径成立（MINOR-1 措辞）。
- **lease drain 首刻拒（时间语义）**：`drain()` 在宿主进程内同步翻转状态（单线程），W7a 钉的是边界返回后的**第一次** admit 即 `gateway-not-active`（detail 即 lane 原文 "refused from the first instant"），不存在可表示的宽限窗；mutex 半边（A 持有 ⇒ B 被拒）钉的是 gateway 层 jobId 归属律（`owner-mismatch` + W3b 告警计数），非 lease-window 的 duplicate-callId 律（MINOR-2 口径注）。
- **revocation neighbour-safe 观测面**：`moved` 为**恰等于** `[w7-a-1]` 的精确集（覆盖当时全部 5 笔在册 job ⇒ 所有邻居被否证式钉死），flag 三面 `a1=true/a2=false/b3=false`；unreadable-read-counts-as-moved 被真实驱动且**预先注册全部四对 (scope,name)**——排除"未注册即假移动"的宽松通道；C-BIND 旧 job 钉在执行期身份 `def-v1`（W5b 投影读回）。

## ② PROBE-GATED 诚实性（本轮核心）— 成立

- **`job_start` 0 命中亲验**：本审在**自建的** pristine 克隆（`clone --local --no-hardlinks` @`639ed01539`，porcelain=0，含 node_modules+构建 dist）上跑**无 include 过滤**的 `grep -rn --exclude-dir=.git job_start` → **0**（7.2s）；源码子集再跑 0。kit 的 pre/post 过滤腿同为 0 且钉 HEAD/porcelain。活体 roster=15 个 `team_*`，`rosterHasJobStart=false`，kit 未注册任何 host 工具。
- **row-local store 披露是否足以支撑"host-registry chain 未入账"**：足以。披露在四层——plugin 头注释、**每一次 defPut/defWithdraw 响应体** `source:'row-local-definition-store (disclosed: NOT a host registry fact)'`（本审在本方复跑 ledger 内验 6/6 条全带）、revocation-leg note、README/receipt claim caliber。host-registry 形态链**只引用不入账**：被引 fixture `a5p7-mcp-rebind-chain` 实存且本审独立跑到 **6/6**。**未发现任何把 fixture 级偷渡成 live 的措辞或证据**：live 腿钉的全是 gateway 律（活体装配、host 派生身份），输入面自报 row-local。
- MINOR-3：`anchorGrep` 未断言 grep 自身退出码——spawn 失败/超时会读成 hits=0（vacuous-0）。本轮事实已被本审独立复现证真，此为后续加固项。

## ③ 22/22 与 RED 9/22 对照 = 同判据集 — 成立

判据 id 全 22 恒等；名称除 W10c（名字内嵌当次世界路径，天然随 run 变）外逐字相同；单一代码路径，`--without-row` 仅不挂 row。**本审独立复跑 RED 对照：9/22，通过集合 `{W0a,W0b,W1a,W2a,W2b,W9,W10a,W10b,W10c}` 与提交版逐条相同**，13 条红腿全为 op-leg 404（W8 亦红：roster 读回依赖 row，属保守红非宽松红）。MINOR-4：RED 的 W2b 走已披露的 fallback 支（`childSessionId:"fallback-inst-…"`），对照腿的"distinct child sessions"一半为合成值（明细里逐字可见）；GREEN 走 durable 读回，不受影响。

## ④ tsc-first-pass 声明抽查 — 实质成立，措辞一条

- kit-local `tsconfig.lane.json`：extends 仓库 strict base（`strict`+`noUncheckedIndexedAccess`+`verbatimModuleSyntax`…），`include` **只**含 `packages/runtime/jobs-gateway/**/*.ts`，无放宽性覆盖；emit 入 gitignored 构建目录；本审亲手 `tsc -p` → **exit 0** 且 worktree porcelain 保持 0（**确未改 sources**，diff 亦 0 个 `M`）。
- 但"lane 从未进过 tsc / first tsc run"按字面不精确：`packages/runtime/tsconfig.json` include 含 `test`，而已合入的 a5p7 测试 import 该 barrel ⇒ 共享 noEmit typecheck 程序**已**把 6 个 lane 文件纳入（本审 `--listFiles | grep -c jobs-gateway` = 6，且无错误）。精确口径 = "首次**直接/独立 emit** 编译"。偏差方向是保守面（此前已在共享面下被绿过），不伤实质。

## ⑤ G-g / 取消措辞 — 守线

本审对**全部** evidence+kit 文件自扫：终止保证类措辞命中=0，唯二含 "termination" 的句子均为否定式（"offers no termination guarantee" / "REFUSES to call an unsettled lease done"）；W7b 只钉 `terminated-after-start`+`sideEffectPossible:true`、giveUp 后 release **两次**都拒 `drain-given-up`、`windowState=GIVEN_UP`、outstanding=`[w7-m-1]`——无终止保证形状真钉。G-g 引用全带 OPEN/PENDING-GATES（W9 self-scan offenders=[]，mentions=10）；`node scripts/lint-g-g-wording.mjs .` 在 HEAD **violations=0**。引用 G-g 为 OPEN 相对注册表行（证据级收口、取消协作式在册）方向保守，无任何闭合宣称。

## 复跑分布（本审，环境全独立）

- 独立环境=一次性 worktree + 自装依赖 + 自建 pristine 宿主克隆 + 自构建（writer 的 `.worktrees/a5-w7` 全程未用未触）。端口 3184 跑前 `ss` 自证空闲；世界用 kit 自带 IF-3 命名 `a5w7-<stamp>`（新名、跑毕 W10c 自动删除并经 `ls` 复核，brief 期望的 `a5w7-rev-*` 前缀差异在此披露）；`:3080` 仅 401 只读探测、前后同值。
- **全量 GREEN 复跑 22/22**；**RED 复跑 9/22（红腿集合恒等）**。
- **抽 ≥6 条定向独立复跑（自建断言，不信 kit `check()`）**：W4a 双向精确集 / W4b leader+swapped 5 拒 / W4c 静态 detail+身份零出现 / W5a 精确 moved 集+三 flag / W6 五笔 settle→drain→RELEASED / W7b 边界外记事实+release 阻塞+giveUp 永拒——**全部复现**。
- 附加亲验：无过滤 `job_start`=0；lane tsc exit 0；a5p7 fixture 6/6；lint-g-g-wording 0；full-suite 捕获的 9 条 FAIL 身份与 nine-root-319a60d7 容忍集**规范化后集合完全相等**（双向差=∅，零新增）；IF-6：kit 消费的全部事件名/码在 lane 基座源码中先存（如 `gateway-not-active`×5、`drain-given-up`×4、两支 dispatcher 事件名各×2），无新造名。

## MINOR（记录性，不阻塞）

1. README "boot-root leader **sees nothing**" 是 visible 集合口径；按 refusal-over-absence 设计其 refused 面仍枚举 5 个 jobId（证据已逐字披露）。加一短语即可完全消歧。
2. W7a 名为 "lease mutex" 的腿实为 gateway 层归属拒绝；lease-window duplicate-callId 律未在 live 面单独驱动（fixture 级已覆盖）。
3. `anchorGrep` 建议断言 grep 退出码（0/1），封死 vacuous-0。
4. "first tsc run / 从未进过 tsc" 精确化为 "首次直接/独立 emit 编译"（见④）。

## 收口

本提交仅新增本文件（token 扫描自证干净；提交前 porcelain 只含本文件，提交后=0；ff push 同分支，循 W5 先例 `c5931ca5`）。本审复跑证据（GREEN/RED 两份 kit 原始产出）落在一次性 worktree 之外的一次性 scratch 目录（协调树 `dev/agent-workflow/evidence/alpha5/wiring/reviewer-scratch/w7rev/`，未入任何提交），随本轮回收一并删除；本文件为唯一持久产出。宿主克隆与构建目录随 `.worktrees/w7-rev-w7` 整体回收。
