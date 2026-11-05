# a5sf-org — capability-face reorganisation（2026-11-06，owner 指令）

**这是一次文档 + 测试基础设施的重组，不改变任何产品语义、等级、`V@B`、Q7、CI 门或 Authority 快照。**
`packages/**` 一行未改；所有 adapter 层面的代码建议都以**提案**形式写在 §2，不落 commit。

本目录的四个产物：

| 文件 | 是什么 |
|---|---|
| `README.md` | 本文件：重组说明、adapter 审查、**实测指标**、以及“没有改什么” |
| `preflight-clean.log` / `preflight-aliased.log` | 共享零 boot 预检在干净 bundle 与别名 bundle 上的原始输出（各一行机器可读 verdict）；`--repo` = 本分支 worktree，`--host-root` 只重定向 gitignore 的 pristine host |
| `preflight-nohost-failclosed.log` | 同一个干净 bundle、**不给** `--host-root`：`assembly.usable` 红（`ASSEMBLY_HOST_MODULE_MISSING`）——证明该 check 不是装饰 |
| `preflight-negative-control.json` | 负控结果的结构化记录（哪条 check 红、红的 code、为什么可归因） |

指标只在 §3 一处（不另存副本，避免两份数字漂移）。

---

## 1. 为什么按能力面重组（一句话版）

按工具逐条验收时，**同一个共享边界的缺陷会在不同工具上重复暴露**（BL-14 的 read、BL-16 的 grep、
BL-18 的 web 各自花了一次 boot 去发现“面本身”的问题），而**面与面之间的相互作用**（跨面候选验收）
没有任何一条流程负责。于是：验收按面（A 层）→ 契约按工具（B 层）→ 候选跨面（C 层），
boot 只花在 C 层。

改动落在四个既有文件（不新增治理系统）：

- `docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md`：按 face 重排（44 条条目**逐行逐字**保留：
  41 BL + 3 BR，脚本校验“每条旧行在文件中逐字存在”），新增 §0.1（面登记、A/B/C 定义、C1/C2 台账）。
- `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`：新增 §7（Integration Track vs
  Candidate Track、冻结/合并/重切规则、Q7 成本结构）与 §8（下一批任务表，唯一 owner 文件）。
- `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md`：新增 §1.1.1 行→面归属与“本行证据
  满足哪一层”。**主矩阵仍是 9 格**（解析器要求），**⑧/⑨ 一格未动**。
- `docs/ROUTER_RULES.md`：新增 §0.1（三角色、共享文件单一所有权、新面先设计正/负测试、boot 前置 preflight）。

---

## 2. Adapter 审查（`subprocess.ts` / `web.ts` / 未来 terminal face）

分类口径（owner 指令）：**权限约束** / **Provider-OS 装配** / **仅公共接口适配** / **疑似重复上游**
（进程管理、输出缓冲、argv 解释、网络客户端、生命周期）。每块给出 `file:line` 与**一个** verdict；
只有具体实例才给代码提案，否则写 `no change`。

### 2.1 `packages/runtime/team-services/src/subprocess.ts`（1600 行）

| 块 | 位置 | 分类 | verdict |
|---|---|---|---|
| `createConfinedOutputReader`（有界内存尾部收集器） | `:231-296` | 输出缓冲 | **no change**（不是无意的重复，见下） |
| `CONFINED_SUBPROCESS_STATIC_PROGRAMS = ['rg']` + `rgArgvRefusal` | `:299`、`:412-454` | argv 解释（纵深防御） | **no change**；必须显式声明它不是通用安全模型 |
| `shellClassAdmissionRefusal` / `readIntentsOf` / `laneSafeSearchArgv` | `:582-653`、`:679-732`、`:733-886` | 权限约束 | **no change**（面本身的准入，不是上游的重复） |
| `confinedSpawnAllowPaths` / `systemRuntimeAllowPaths` / `compileExecutionProfile` | `:1029-1070` | Provider-OS 装配 | **no change** |
| `confinedChildEnvironment` | `:1071-1085` | 环境构造 | **疑似重复上游，且已发生行为分歧 → 提案 P-1** |
| `assertSpawnSpec` / `assertStdio` | `:1189-1247` | 仅公共接口适配 | **no change**（校验的是本模块自己的 `ConfinedSpawnSpec` 结构子集） |
| `createConfinedSubprocessClass`（类装配、句柄生命周期、terminate/abort） | `:1276-1577` | Provider-OS 装配 + 生命周期 | **no change**：句柄生命周期委托给 provider 的 `ConfinedStreamProcess`，不自己 spawn/kill |
| `spawnTerminal(): Promise<never>` | `:1591` | 权限约束（拒用） | **no change**：终端面按设计不在此处接入 |

**为什么 `createConfinedOutputReader` 不算“漏掉复用”**：上游同语义的实现是
`tests/deepseek-harness-test-use/packages/subprocess/subprocess-local/src/output.ts:129` 的
`OutputCollector`，它在 **`@deepseek-ai/dsh-subprocess-local` 这个具体 provider 实现**里，只通过
`./output` 子路径导出，**不在抽象 seam `@deepseek-ai/dsh-subprocess` 上**。Team 的这一层消费的是
`ConfinedProcessProvider` **契约**（provider 在装配期注入），直接 import 一个具体 provider 的模块会把
“provider 可替换”这一条缝焊死。更强的一条：上游 collector 会**在溢出时写 spill 文件**，而受限 spawn
的输出若落到临时目录，就是一条**未在 lane 里声明的写路径**——本实现故意只保留内存尾部
（`finalize().truncated` 仍是 `lossy` 语义）。所以这是“同一算法的**故意更窄**变体”，不是复制粘贴事故。
**唯一要补的是文字**：把上述上游位置与“何时可以删掉本地副本”（上游把有界 collector 提升到抽象 seam）
写进该函数的 doc comment。这属于注释，不需要产品行为变更。

### 2.2 提案 P-1（具体、可执行，但**不在本 PR 提交**）

**问题**：`confinedChildEnvironment`（`:1071-1085`）复刻了“敏感名 + `DSH_*` 剔除”，但**漏掉了上游
`scrubbedParentEnv()` 的代理叠加**。上游
（`tests/deepseek-harness-test-use/packages/subprocess/subprocess/src/index.ts:66`，**抽象 seam 的公开导出**，
team 侧其它产品代码已在 import `@deepseek-ai/dsh-scope`/`dsh-tools`/`dsh-session` 等公开包）在剔除之后还会
叠加 `proxyEnvironmentForChild()`：把用户导出的代理变量恢复回去、并删除用户从未设置的代理名。上游注释
写明原因：“A child Node ignores the inherited proxy variables unless the flag this adds is set, so an MCP
stdio server or subagent CLI would connect directly while its parent proxies.”

**后果**：Team 受限子进程（M-16 第三方 CLI、将来的 MCP stdio）**丢掉父进程的代理归一化**，在
`network: allow` 的 lane 里可能绕过用户配置的代理直连；同时本地正则
`/KEY|PASSWORD|SECRET|TOKEN/i` 与上游 `SENSITIVE_ENV_PATTERN` 是两份，上游收紧时本侧不会跟随。
**这不是 lane 放宽**（`network: deny` 根本不会 spawn），是**环境保真度分歧**，且恰好落在“谁是网络
出口”这一敏感处。

**建议改动**（单一文件）：`packages/runtime/team-services/src/subprocess.ts` 的
`confinedChildEnvironment` 改为先取 `scrubbedParentEnv()` 再合并显式条目/墓碑（与上游 `childEnv`
同形），保留现有 `Record<string,string>` 返回类型；新增一条 host-free 臂断言“代理变量与
`proxyEnvironmentForChild()` 的叠加结果一致”。**风险**：需要 `@deepseek-ai/dsh-subprocess` 在构建图里
可解析（它本来就在宿主运行时里，其它产品文件已有同类 import 先例），因此是依赖声明问题，不是架构变更。
**未提交原因**：触碰 `packages/**`，本 PR 的红线是“文档 + 测试基础设施”。

### 2.3 `packages/runtime/team-services/src/web.ts`（250 行）

| 块 | 位置 | 分类 | verdict |
|---|---|---|---|
| `createWebNetworkGuard`（lane + `probeNetworkDenial`） | `:148-172` | 权限约束 | **no change** |
| `createConfinedWebClass`（继承宿主类身份、替换 `fetch`/`search`） | `:182-232` | Provider-OS 装配 | **no change** |
| `declaredUrlOf` | `:240-250` | 仅公共接口适配 | **no change**（soft-fail：形状变了只降低 locator 精度，**从不放行**） |

**结论：本面没有网络客户端重复**。它不实现 HTTP、不解析 URL、不重试、不跟随跳转——每一次 `fetch`
都是一次 `provider.fetch(request, signal)`，且 guard 的 `await` 在 provider 那一行**之前**。
`web.ts` 唯一“重新解释请求形状”的地方是 `declaredUrlOf`，它是为**事实记录**服务的，不是为决策。

### 2.4 未来的 terminal face（`packages/runtime/team-sandbox/src/terminal.ts`，290 行）

现状：**纯领域状态机**，进程 I/O 全部通过注入的 `PtyHandle`（`:51-57`，只有 `kill`/`wait`），
没有 PTY 分配、没有读循环、没有 ioctl、没有 grace 计时。因此**今天没有重复**。

前向风险（写下来给接线的那个 PR，不是现在改）：未来终端面必须把 `TerminalAcquireSpec`（`:38`）
映射到 provider 的 `spawnTerminal`，**而不是**自己实现 TERM→KILL 宽限、进程组回收、`SIGWINCH`。
一旦本地实现这三件事，就与上游 `subprocess-local/src/terminal.ts` 的 `LocalTerminalHandle`
重复，且两份生命周期必然漂移。**接线时的验收臂**：并发 acquire 同一 Member、撤权先于首个
`await`、`signal` 交付失败路径——三条都能 host-free 断言。

### 2.5 `rg` allow-list 的定位（BL-41，必须显式）

`CONFINED_SUBPROCESS_STATIC_PROGRAMS`（`:299`）+ `rgArgvRefusal`（`:412`）是**一个固定原生工具的
纵深防御**：它防的是“已声明的 `rg` 被喂进越界 flag”，**不是**任意 shell/Python/LSP/MCP 的通用安全
模型。通用性只能来自 OS confinement（`compileExecutionProfile` 的 Landlock profile）与
“未知程序 fail-closed 的准入”（`programAttributionRefusal`，`:359`）。把 allow-list 当成“CLI 类工具
都可以这样接”的许可证，是本阶段最危险的误读。

---

## 3. 实测指标（只从既有记录读取，不新建跟踪系统）

`class` = `measured`（可直接从引用的文件/命令读出）或 `estimated`（由两个以上 measured 事实推算）。
`source` 一律给到文件或命令。

| # | 指标 | 值 | class | source |
|---|---|---|---|---|
| M1 | 有记录以来消耗的 Host 启动 | **≥12 次** = P2-01 专用 start 3（第三跳 8/8，前两次 driver 缺陷）+ BL-16 live ≥4 轮 + candidate-1 2 + search-live 3 | measured（逐 driver 计数相加，不重复计同一 start） | `evidence/a5sf-candidate1/run-ledger.jsonl`（2 intent + 2 boot）、`evidence/a5sf-search-live/README.md` §attempt 表（3）、`evidence/a5sf-acceptance/README.md` §7、矩阵 §1.1、`SESSION_ROUTER_LOG.md` 2026-11-06T06:20Z（池 2/5） |
| M2 | **无可用 verdict 的启动**（driver/仪器缺陷；非产品缺陷） | **4 次 = 33%** ＋1 次“verdict 部分无效”（别名 fixture，2 行 REFUTED） | measured | search-live attempt 1（composition handoff，0 行）、`ALPHA5-SANDBOX-BACKLOG.md` BL-16 “尝试 1–2 … 0/6 行未测得”、candidate1 README §2（allocation #1 两行 REFUTED → #4 重跑） |
| M3 | **被测树 vs 会合入树的失效事件**（Q7） | 候选级 **1 次**（`#606` → 28 条产品路径 → 4 行 `V@B=no`）；基线级 **2 次**（`#598/#599/#600` → 6 行；`#601`/`#597` 重切） | measured | 矩阵 §1.1；`gh pr list` 的 mergedAt |
| M4 | FS Provider 面：首个产品实现 → C1 / → C2 | `#546` 2026-11-03T02:02Z → C1 同 PR；→ 首个判定 C2 `#575` 2026-11-04T00:10Z（**≈22 h**），其间 3 次 start，前 2 次为 driver 缺陷 | measured（时间取 `gh` mergedAt，boot 取 §1.1 记录） | `gh pr view 546/575 --json mergedAt`；矩阵 §1.1 “三个专用 P2-01 start 走完，第三跳 8/8” |
| M5 | Subprocess 面：首个产品实现 → C2 | `#586` 2026-11-04T14:30Z → 六行 PASS `#596` 2026-11-05T00:13Z（**≈9.7 h**），≥3 轮 live、≥2 轮 0 判定行 | measured／estimated（轮次为 measured，“≥6 start”为 estimated） | `gh pr view 586/591/596`；BL-16 条目；`evidence/a5sf-search-live/README.md` |
| M6 | Shell-PTY 面：产品 → C2 | 产品 `#605` 2026-11-05T10:52Z；**C2 = 0**（allocation #2 暂缓） | measured | `gh pr view 605`；README §8（21 臂 host-free，live 未跑） |
| M7 | Web 面：产品 → C2 | 产品 `#606` 2026-11-05T12:46Z；**C2 = 0**（行不转发 `web` face；allocation #3 暂缓） | measured | `#606`；`evidence/a5sf-web/README.md` §8 steps 3–8 BLOCKED |
| M8 | External execution / Non-data-plane 面 | 产品 0、C1 0、C2 0（`NOT_WIRED`/`UNSUPPORTED`） | measured | 矩阵 M-11/M-12/M-17/M-18/M-19/M-21 |
| M9 | 冻结候选因产品合并而重验 | **1 次**（`#606`，4 行） | measured | 矩阵 §1.1 |
| M10 | 未完成集成工作项 | **27 条 BL 未 DONE**（其中 25 条可执行；`BL-38` DEFERRED owner-owned、`BL-41` standing rule） | measured（按 §3 条目状态计数：DONE 14） | `ALPHA5-SANDBOX-BACKLOG.md` |
| M11 | CI 失败归因（内容 / 环境 / 驱动） | **不可完整重建**：CI 日志无归档，只能逐次 `gh run view` 重放；本次唯一可测的一项 = `state-freshness` 的 Q4 红，归因 **Authority 结构（指针指向候选）**，非内容 | estimated／无法测量（记录缺口本身是结论） | `node scripts/ci-pr-gate.mjs --only state-freshness` 输出 |
| M12 | 共享零 boot 预检的拦截力 | 13 条 check；2 个 bundle：干净 **PASS 13/13**，别名 **FAIL 12/13** 且恰为 `CASE_LOCATOR_ALIASED` + `CASE_GUARD_KEY_ALIASED`（唯一红 check = `cases.isolation`） | measured | `preflight-clean.log` / `preflight-aliased.log` / `preflight-negative-control.json` |

### 3.1 瓶颈排序（只按上表可测事实）

1. **仪器缺陷吞掉三分之一起动（M2）**——4 次启动没有 verdict，全部是 driver/fixture 缺陷：
   composition handoff 未交付、空 config、缺 `sampleOverCapGlobResults`、FIFO 在 lane 外、两案共用一个
   locator。**没有一次是产品放宽**。这是唯一“改了就能立刻省 boot”的一项。
2. **单线性 baseline 模型 vs 并行产品合并（M3/M9）**——一次产品合并让候选的四行同时 `V@B=no`；
   Q7 本身没错，错的是“在冻结窗口里继续合产品”。§7 的规则直接对着这条。
3. **C1 与产品同 PR，C2 滞后 10–22 h（M4/M5）**——C1 不是瓶颈；**C2 的等待成本来自“要先攒够一个
   可冻结的树”**，而冻结又依赖“产品面静默”，两者互为前提。所以 C2 的延迟是**调度结构**，不是技术难度。
4. **boot 稀缺（3 次/25 条可执行项，M10）**——按面组织后，“哪 3 次值得花”才有答案：BL-17、BL-18、
   一次 FS/Search 重验（§8 表）。
5. **集成轨被结构性地挡住（M11）**——Q4 红不是内容问题，是 Authority 指针指着候选；它同时挡住
   “候选被判 green 后快速合并”的路径。处置权在 owner（§4-Q1）。
6. **Adapter 层 3 处疑似重复，1 处已分歧（§2）**——频率最低但最隐蔽：环境构造的分歧不会让任何测试变红。

---

## 4. 需要 owner 决定的问题（只列真正需要裁定的）

**Q1（原「指针指向哪一侧」）已由 #609 关闭**：`#609` 用**真 merge**（非 squash）把候选 `1484fa4ee`
并入 master 历史，`git merge-base --is-ancestor` 随之为真，`state-freshness` 的 `Q4` 转绿，
派生视图 `baseline_is_ancestor_of_head` 也回到 `true`。**本 PR 未移动指针、未改快照**，只是不再
被这个结构性红拖住。剩下的候选轨政策问题属于 #611（两轨 claim 方案），不是本 PR 的裁定。

**Q2（产品语义）**：受限子进程的代理行为是否可以与不受限子进程不同？（§2.2 提案 P-1）。若不接受，
需要一笔单文件产品 PR。

**Q3（安全边界）**：external execution 面（LSP/MCP/PTC）连 A 层矩阵都还没有。是否维持本轮的规则
「接线前先给出该面的最小正/负测试」？若允许先接线，那么 A 层就只剩下事后补写，这会与 owner
「测试先于实现」的裁决相反。

**Q4（文档合并顺序，新增）**：#611（候选轨机制，`verifiedFor` 字段 + gate provider）目前**未合并**，
它给 `current-implementation-plan.md` 也加了一个 §7。本 PR 的 §7 是同名的组织性章节。两者不能
同时以 §7 存在：建议 #611 先合、再由我把它的 §7.1–7.5 收进我的 §7 之下（或反过来）。本 PR
**没有**折入 #611 的 plan 章节，因为它声明了一个**尚未实现**的机制（`scripts/ci-pr-gate.mjs` 未改），
折进来就是文档声称机制存在。

## 5. 没有改什么（可核验）

- `packages/**`：0 行改动（`git diff --stat`）。
- 任何矩阵等级 / `V@B`：0 处改动；主矩阵 9 格结构未动（Q5 解析器仍通过）。
- Q7 / CI 门 / `dev/ci/eb3-ci-manifest.json` / `.github/**`：0 改动（新增套件未登记进 CI，
  是**已知的后续项**：登记需要改 workflow，属 ROUTER_RULES §10.8 的 stop condition，不在本 PR）。
- Authority 指针与快照：0 改动（§4-Q1 未裁定前不动）。**派生视图** `dev/engineering/current-state.json` 由
  `node scripts/docs-sync.mjs --write` 重新生成：唯一变化 `baseline_is_ancestor_of_head: true → false`，
  与该树的事实一致（候选 `1484fa4ee` 不在本分支祖先链上），也是 CI `docs:sync --check` 的硬要求；
  视图不反向裁定权威，六字段仍由指针+快照唯一决定。
- 预算：**0 次 Host boot**（本 PR 全程 host-free）；剩余 3 次仍按 BL-17、BL-18、一次重试保留。
- 已存在、与本 PR 无关的红：`state-freshness` 的 `Q4`（见 §4-Q1），本 PR 前后同一 finding、同一文案。

### 5.1 CI 实测（PR #610，head `bf1e90d28`；**已被 §5.2 取代，留作历史**）

| 层 | 结论 | 归因 |
|---|---|---|
| `candidate-protection` | success | — |
| `synthesize-merge-tree` | success | — |
| `ci-fast` | **success**（在 `bf1e90d28` 修掉 `docs:sync --check` 的 `STALE_GENERATED_VIEW` 之后） | 修复项：派生视图 |
| `ci-security` | success | — |
| `ci-integration` | failure — step `Gate legs — graph-parse + state-freshness` | **Authority pin**：`Q4` baseline 非 HEAD 祖先 |
| `ci-product` | failure — step `Gate — the eight host-free legs` | 同上（该 step 含 `state-freshness`） |
| `ci-census` | failure — step `Precheck — the authority's two git pins are present and HEAD-ancestors` | 同上，**显式点名同一个 pin** |
| `pr-gate` | failure — `docs:sync --check`（首次推送）→ 修后 step `Authority docs checks` 待复评；本地 `docs-sync --check` + `docs-probe --base e78bfd8af` 均 `blocking=0` | 已修；其余为同一 pin |
| `pr-settlement-gate` | failure — `NO_SETTLEMENT_CANDIDATE` | **按 owner 指令“do not settle”，这是期望结果**，不补 settlement |

三条失败 job 的失败 step 全部落在同一个事实上：`git merge-base --is-ancestor 1484fa4ee HEAD` 为假。
该 pin 早于本分支（`#607` 合并后 master 自身的 `pr-gate` 也是 failure，run `42039830042`），因此归因是
**既有状态 + owner 未决的 §4-Q1**，不是本 PR 的内容。**没有任何一条失败可以靠改本 PR 的文档修掉**；
能修的两条（`docs:sync` 视图、引用行号）已经修在 `bf1e90d28`。

## 6. master 合并与冲突解决（head 见文末；合并基线 `52a95fe0b`）

### 6.1 冲突实际是什么（先纠正一处前提）

合入 `origin/master` `52a95fe0b` 时，`ALPHA5-SANDBOX-BACKLOG.md` 冲突。**实测 master 相对 merge base
`e78bfd8af` 只改了 1 行**（`git diff --stat` → `1 insertion(+), 1 deletion(-)`），那一行是 **BL-18**
的 `#608` 接线轮状态文本。**master 上没有 BL-42，也没有 2026-11-06 的 §0 裁决块**：

- `git grep -n BL-42 origin/master -- docs dev` → 无匹配；
- `git diff e78bfd8af..52a95fe0b -- …/ALPHA5-SANDBOX-BACKLOG.md` → 仅 BL-18 一行；
- `BL-39` 在 master 与 merge base 上**逐字相同**（它的 `/etc`+`/proc` 归属文本早于本分支）。

BL-42、§0 裁决块与 BL-39 的归属更正都在 **#611**（`task/a5sf-ruling-20261106`，`gh pr view 611` =
`OPEN`）。因此「master 已带 #611 的裁定」不成立；本轮按指令**从 #611 的分支逐字取文本**折入，而不是
自己编一条 BL-42——这样 #611 合并时两侧字节一致，冲突至多是位置。

### 6.2 逐项取舍

| 区域 | 取自 | 处理 |
|---|---|---|
| 文件整体结构（§0.1 六面 + A/B/C + C1/C2 台账 + 按面的分节） | 本分支 | 保留（这是本 PR 的目的） |
| `BL-18` 状态文本 | **master**（`#608`） | 逐字替换本分支的同名行 |
| `BL-39` 行 | **#611** | 逐字替换；归属更正为「`/etc`+`/proc` 文件读取例外收窄，**不是**网络隔离」 |
| `§0` 2026-11-06 owner 裁决（5 条） | **#611** | 逐字插入在 2026-11-03 裁决之后（旧 7 条一字未动） |
| `BL-42` 行 | **#611** | 逐字插入 **Shell-PTY 的 P2 表**（唯一具名阻塞消费者 = BL-17），不在别处复制 |
| §0.1.1 面登记 Shell-PTY 的条目列 | 本分支 | 追加 `BL-42` |
| §0.1.3 台账 | 本分支 | `BL-39` 说明改为归属更正后的措辞；新增 `BL-42` 行并标 **cross-face 阻塞** |
| §3 Shell-PTY 面注 | 本分支 | 新增四条硬边界（fail-closed、拒绝启动≠验收、web deny≠子进程隔离、BL-42 前只能验拒绝路径） |
| §7 Cross-face 桶 | 本分支 | 新增「跨面阻塞」段：BL-42 同时阻塞 Bash/CLI、第三方 CLI、external execution；**行不复制** |
| 其余 44 条旧行 | 原样 | 逐字保留（脚本校验：每条旧行在新文件中逐字存在） |

### 6.3 合并提交的形状（披露，非隐瞒）

`81ff35a84` 是一个 **内容为空的 merge commit**：`git show --stat` 无文件，tree 仍等于合入前的本分支。
原因是合并在**结果未入 index** 时就被提交。它的第二父存在，所以 **ancestry 是真的**（#611 §7.3 的
「真 merge，不 squash」要求满足）；**合并内容全部落在紧随其后的解析提交里**。没有 force-push、
没有改写已推送历史——空 merge 保留在原位，只在报告里点名，避免读者以为合并丢了东西。

## 7. 13 条 check 的承重审计（合并树上重跑）

合并后重跑：干净 bundle **PASS 13/13**（`--repo .` + `--host-root` 指向 pristine host）；
别名 bundle **FAIL 12/13**，唯一红 check = `cases.isolation`，恰带 `CASE_LOCATOR_ALIASED` +
`CASE_GUARD_KEY_ALIASED`；**不给** `--host-root` 时干净 bundle **FAIL 12/13**（仅
`ASSEMBLY_HOST_MODULE_MISSING`）。46 条 node:test 全绿（D1–D17）。

| check | 承重？ | 它真的能抓到的缺陷（合并树上仍可发生） |
|---|---|---|
| `assembly.usable` | **是**（本轮亲自演示） | 声明了原生模块但 checkout 里没有 → 世界根本不可组合；本轮在 worktree 里就是这个红的（host 是 gitignored，worktree 永远没有） |
| `identity.roots` | 是 | `#575` 的 create-root ≠ observe-root（真实历史缺陷，D5 复刻） |
| `identity.blueprints` / `.member-tool-binding` | 是 | blueprint 无 id、Member 无 binding → 组合期才炸 |
| `identity.authority` | **弱**（伪造防火墙） | 只抓「bundle 自称观察的 snapshot ≠ 指针六字段」。它不检测产品缺陷；保留是因为它让「证据与权威错配」在 boot 前变成一条红，而不是事后解释 |
| `native.module-config` | 是 | BL-16 attempt 4/5 的真空 config 与缺 key（各花过一次启动） |
| `policy.paths`（read/write） | 是 | allow 在 lane 外、deny 在 lane 内、deny 落在 OS runtime allowance 内（`#598-600` 类） |
| `policy.paths`（network） | **部分** | 只抓「bundle 的 network 期望与 lane 冲突」。**抓不到**本轮裁决明令禁止的推论「Web service-level deny ⇒ 任意子进程已隔离」——见 §7.1 缺口 G-1 |
| `policy.fifo` | 是 | BL-16 attempt 6（FIFO 在 lane 外） |
| `cases.isolation` | 是（本 PR 的核心） | 两案共用 locator / 共用 guard key（candidate-1 allocation #1 的真实缺陷；D2/D3） |
| `collector.shape` | 是 | 空 corpus、return-shape 缺键、无 terminate/archive → 行不可判 |
| `wiring.candidate` / `wiring.grant` | 是 | sha 形状错、grant 不绑该 commit、maxStarts 不够覆盖 |
| `wiring.run-record` | **条件性** | 它的 `productTreeProof` 分支只在 `teamSha ≠ baseline` 时才有意义；当前候选运行都在 baseline 上（`teamSha === candidate.head`），该分支**事实上是死的**。留着是因为一旦出现「在 baseline 之外树上跑」的批次，它立刻变成唯一的拦截点 |
| `LEDGER_ARITHMETIC` | 是 | `plannedStarts` 与实际 boot 行不等（预算纪律） |
| `BUNDLE_SCHEMA` | 是 | 版本错配的 bundle 被拒，而不是被当新版解释 |

### 7.1 两个具名缺口（保留红/保留弱，而不是假装绿）

- **G-1（network 归因）**：`policy.paths` 的 network 轴不检查**归因来源**。裁决要求的「Web
  service-level deny 不得被推广为子进程网络隔离」需要第 14 条 check：当 bundle 的 `networkAccess`
  为 `deny` 且 `networkProbe*` 的来源是 web-provider 时，若任何 case 走 subprocess/shell lane，
  必须红（新 code `POLICY_NETWORK_ATTRIBUTION_UNPROVEN`）。**未实现**：它属于 BL-42 接线前的
  工作，且需要新 fixture + 正负两条控制，本轮不夹带。
- **G-2（`wiring.run-record` 的死分支）**：如上表。要么在 BL-17/BL-18 live 时故意在一棵
  non-baseline 树上跑一次以激活它，要么在 live 之后删掉该分支——**现在是零覆盖**。

### 5.2 CI 实测（PR #610，合并 + 冲突解决后 head `5927b688e`）

合并 master `52a95fe0b` 并把 BL-18/#611 文本折入面结构之后，**每一个先前为红的 job 都转绿**：

| job | 结论 | 与 §5.1 的差异 |
|---|---|---|
| `pr-gate` | **success** | 先前 `docs:sync --check` 红；`docs-sync --write`（§5.1 的 `bf1e90d28`）之后转绿 |
| `ci-required` → `synthesize-merge-tree` | success | — |
| `ci-required` → `ci-fast` | **success** | 先前红在 `docs:probe (mandatory)`（同一条 stale 视图） |
| `ci-required` → `ci-security` | success | 一直绿 |
| `ci-required` → `ci-integration` | **success** | 先前红在 `Gate legs — graph-parse + state-freshness`（Q4 pin）；`#609` 的 true-merge ancestry 修好 |
| `ci-required` → `ci-product` | **success** | 先前红在 `Gate — the eight host-free legs`（同一 Q4） |
| `ci-required` → `ci-census` | **success** | 先前红在 `Precheck — the authority's two git pins are present and HEAD-ancestors`（同一 pin） |
| `ci-required` → `ci-required` | **success** | 六层全绿 |
| `pr-settlement-gate` | failure — `NO_SETTLEMENT_CANDIDATE` | **按 owner 指令不 settle，期望结果**；由协调者补 settlement |

一句话：**先前三条红 job 是同一个事实（candidate pin 不是 HEAD 祖先），master 的 `#609` 修掉它之后
全部转绿；另一条（`docs:sync` 视图）是本 PR 自己的，已在 `bf1e90d28` 修掉。** 本地复跑同结论：
`docs-sync --check`、`docs-probe --base 52a95fe0b`（blocking=0）、`ci-pr-gate` 的
graph-parse/state-freshness/kit-home-guard/blueprint-fence/lint-identities 五腿全 pass、
46 条 node:test 全绿。

**没有归因不明的红**：唯一剩余的红是 settlement，且它按指令不修。
