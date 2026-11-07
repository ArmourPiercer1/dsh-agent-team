RECON-REVIEW

# RECON-REVIEW — 五面 DEV-LIVE 侦察报告的独立跨面审查

**这是什么**：对五份 Alpha.5「DEV-LIVE 侦察」报告（PR #656/#655/#660/#658/#657）的**独立复审**。
我不是五个 lane 的作者，**没有**改任何 lane 的报告、产品源码、矩阵 / register / STATUS。
本目录（`dev/agent-workflow/evidence/a5sf-recon-review/`）是本轮唯一新增内容。

| 项 | 值 |
| --- | --- |
| 记录类别 | `DEV-LIVE`（`candidateClaimEligibility.eligible=false`，`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`） |
| 被测树 | `origin/master` = `0230484b7`（各 lane 报告称被测树 `235e1af8b`；两者在我复核的 `packages/**` / `cordis.patch.yml` 上未发现会改变结论的差异，见 §6.3） |
| 宿主 | pinned `639ed015397290b3745d163aafe02ffee4aa3f84` = `0.2.0-rc.2`（`tests/paths.mjs#TEST_USE_BASELINE_SHA`） |
| Authority | 指针 → snapshot `as20261105r2`（`run-record.json#bindings.authority`） |
| 我自己的 boot | **3 次真实 Host start**（boot01 = 仪器迭代；boot02/boot03 = 13/13 全同的 agreeing pair） |
| 端口 | `3188`、`3188`、`3184`（3180 族）；`:3080` 全程未触碰 |
| 宿主树 | `git status --porcelain` 每次 boot 前后均空（`0` 行） |
| 本文件立场 | 工程审查；**不改 `V@B`**、不替代 `Candidate-C2`、**不是合并证据**（合并方需自测） |

**审查方法**：五份报告逐条对照（a）报告自己的证据文件、（b）我在 master 上的 host-free 源码复算、
（c）**我自己的一次真实 Host boot**：一次 boot 里两个受治 Member、两条不同 ceiling、互相读对方的
lane（五个 lane 都**没有**做这个对照）。原始证据在本目录 `runs/boot02/`、`runs/boot03/`；驱动器
`run-boot.mjs`（派生自 `tests/world-factory/drivers/a5sf-live-member/run-boot.mjs`，未新增产品入口）。

---

## 0. 一页结论表

| 报告 | 核心断言 | 独立复核 | 整体可信度 |
| --- | --- | --- | --- |
| **A** FS（PR #657） | 四个原生 FS 工具走 preset 继承的 base `ctx.fs`（`fs-sandbox`），0 条 guard fact，读写越过 Member ceiling | **CONFIRMED**（host-free 源码 + 他们的 boot + 我的 boot：A 的 `read` 一次读走 B lane 的字节、0 fact） | **高** |
| **B** Search（PR #655） | `grep`/`glob` 是 Host 直接子 `rg`（base `ctx.subprocess`），无 confined face，0 fact，越 lane 拿到字节 | **CONFIRMED**（`tool-fs-search` `inject=[tools,systemPrompt,subprocess]` + 我 boot 里 A 的 `grep` 读走 B lane、0 fact） | **高** |
| **C** Shell（PR #660） | 瞬态 `bash` 由 route-C 重挂到 confined terminal face（读轴准入层），持久 PTY / 受管 Job 都是 `NOT_WIRED`，archive 有 ~8.5 s quiesce 窗口 | **CONFIRMED**（我的 boot 复现 bash allow + 跨 lane `IO_READ_DENIED` + 0 字节；preset 无 terminal 行；B-1 窗口我**未重测**） | **高** |
| **D** Web（PR #658） | 受治 Member 的 `web_fetch`/`web_search` 走 confined web face，guard 真的求值，deny 在服务级准入层 | **composition-level CONFIRMED / product-level REFUTED**：那里的 realm 是**测试行**；在**shipped** 受治 preset 上我实测 `web_fetch` **0 条** web fact，被 base provider 的 SSRF 策略拒绝（§2.2） | **中** |
| **E** External（PR #656） | `job_*` / `skill` / `workflow` 在面上、真实执行、**0 条 a5sf fact**；`run_code`/`lsp`/MCP 不在面 | **CONFIRMED**（源码：`workflow-ptc` → `ptc-runtime-node` → base `ctx.subprocess`；我的 boot 面 43 名与 E 的算术一致） | **高** |

一句话：**五份报告在各自声明的装配内基本都成立，问题出在"受治 Member"这个词被五种装配共用**——
只有 C 的 `bash` 在 shipped 产品装配上真正受治；A/B 在其上完全不受治，D 的受治结论只对测试组合成立，
E 的执行体全部不受治。

---

## 1. 三个数字（独立确认 / 推翻）

口径先写死（与五份报告自己的定义一致）：
**受治** = 模型可见工具的执行经过 confined face **且**产生 `a5sf-guard-consult/1` fact；
**表面存在但不受治** = 名字在 Member 的 model-request `tools` 里、可被模型调用、执行时产生 0 条 a5sf fact；
**完全不在面** = 名字不在 `tools` 里（模型无法命名）。

| # | 数字 | 判定 | 依据 |
| --- | --- | --- | --- |
| 1 | **受治工具 = 1**（`bash`，PD-13 confined terminal） | **CONFIRMED** | 我的 boot02/boot03：43 名面上**9 条** fact 全部来自 `bash`（`shellRead` 5、`spawn` 2、`spawn:write` 2），A 5 条 / B 4 条、identity 各自正确；C 的 21 条 fact 同构；A/B/D/E 的其余工具调用均 0 fact。**注意**：`bash` 只有**读轴**在准入层受治；**写轴**与动态路径（`$VAR`/`$(…)`）只在 OS 层（C §2.1 第 5 行，我未重测） |
| 2 | **表面存在但不受治 = 42 名**（`43 − 1`），其中**产品原生执行体 25 个**；可执行面里已被 live 实测"可调用且 0 fact"的是 **10 个** | **CONFIRMED（数字口径见下）** | 我的 boot：surface 43 = 26 产品 + 15 `team_*` + 2 fixture（与 E §2.1 逐名相同）。26 产品中除 `bash` 外 25 个执行时 0 条 a5sf fact。已实测调用的 10 个：`read`,`write`,`edit`,`read_image`（A）、`grep`,`glob`（B）、`job_list`,`skill`,`workflow`（E）、`web_fetch`（我，§2.2）。**`team_*` 15 个要另算**：它们有 Team 工具自己的 request-token/envelope 授权，只是**不产生 a5sf fact**，不能说成"无授权" |
| 3 | **完全不在面 = 10 个具体名字 + MCP 族** | **CONFIRMED** | `run_code`、`lsp`、`str_replace_editor`、`pwsh`、`terminal_open/send/read/signal/close/list`（6）= 10；MCP 族（`mcp__*`、`list_mcp_resources`、`list_mcp_resource_templates`、`read_mcp_resource`）shipped 配置 `mcpServers: []` → 0 个名字（E §2 实测 + matrix M-17/M-18）|

**对"三个数字"的推回**：如果口径是"**数据面/执行面**里真正受治的工具"，第 1 个数字仍是 **1**，但
第 2 个数字应读成 **15 个执行体**（4 FS + 2 search + 2 web + 3 jobs + 1 skill + 1 workflow +
2 subagent）；其中 `subagent`/`subagent_fork`/`job_output`/`job_kill` 的"0 fact"是**读码 + 面在**，
**没有**被任何 lane 真实调用过（`NOT_TESTED`），不要把它们算进"已实测"。

---

## 2. 每份报告的 CONFIRMED / REFUTED / NOT_TESTED

### 2.1 A — FS（PR #657，`a5sf-recon-fs/`）

| 断言 | 判定 | 证据 |
| --- | --- | --- |
| 四个原生工具由 preset 作用域继承的 base `ctx.fs` 服务，0 条 `a5sf-guard-consult/1` | **CONFIRMED** | 源码：`cordis.patch.yml` 的 `preset-a5sf-governed-member` 直接挂 `tool-fs`（`inject=['tools','fs','systemPrompt']`），realm 只 `isolate('fs')` 自己的 scope；road-C native shadow 需 `a5sfNativeToolModules`，shipped preset 不配。实测：`runs/boot02` A 的 `read` 跨 lane 成功 0 fact |
| 读任意主机路径 / 写与改 ceiling 之外的 `<workspace>/not-in-lane` 成功；host 外写入才被 `FS_SANDBOX_DENIED` 拒绝 | **CONFIRMED**（读路径由我独立复算；写/`edit`/`read_image` 我未重测） | `fs-sandbox/src/index.ts:7-8`（reads pass through untouched）+ 他们的 `disk-effects.json`；我的 `read` 跨 lane |
| 同一次 boot 里 `bash` 对同一 locator 给出 `IO_READ_DENIED` + deny fact | **CONFIRMED** | 我的 boot02：A 的 bash 读 B lane = `IO_READ_DENIED`、0 字节，同 locator 上 1 条 deny fact |
| `types.ts` 声明 `fs:'confined'` 与"FS 面 0 fact"**不是**矛盾 | **CONFIRMED** | `packages/runtime/team-services/src/types.ts:231-232` 是 **realm 声明**（"every installed realm shadows fs"），描述 route-C 挂载后的 realm scope；preset 的 `tool-fs` 不在那个 scope。A §5 C-3 已写清，不算自相矛盾 |
| 跨 Member：A 的 `read`/`grep` 能读 B 的 lane | **CONFIRMED（我的补充）** | 见 §3；五个 lane **都没测** |
| `write`/`edit`/`read_image` 的跨 Member 效果 | **NOT_TESTED** | 我只测了 `read`/`grep`（最小的漏字节证明）；同一 base 服务，不改变结论但别把"没测"写成"测了" |

### 2.2 B — Search / Subprocess（PR #655，`a5sf-recon-search/`）

| 断言 | 判定 | 证据 |
| --- | --- | --- |
| `grep`/`glob` 由 pinned `@deepseek-ai/dsh-tool-fs-search` 服务，`inject` 含 `subprocess`，直接 `ctx.subprocess.spawn(['rg',...])`，无 launcher、无 netns | **CONFIRMED** | 源码：pinned `packages/fs/tool-fs-search/src/index.ts:70`（`inject=['tools','systemPrompt','subprocess']`）+ `search-core.ts:194-238`（plain `ctx.subprocess.spawn`，注释自述 "The spawn is unconfined"） |
| 0 条 guard fact；越 ceiling 的 `grep`/`glob` 拿到秘密字节 | **CONFIRMED** | 他们的 `guard-facts.json` = `[]`、`proc-observations.json`（rg ppid=Host，0 launcher）；我的 boot02 A 的 `grep` 对 B lane 返回 `A5SF_RV_LANE_B_BYTES`、0 fact |
| realm row 只 shadow `bash`/terminal，没有 search 的 native module | **CONFIRMED** | `a5sf-realm-row.mjs` 只有 `confinedBashSpecOf` / `confinedTerminalSpecOf`（`expectedTools:['bash']`）；preset 的 `tool-fs-search` 原样保留 |
| 跨 Member：A 的 `grep` 读 B 的 lane | **CONFIRMED（我的补充）** | §3 |

### 2.3 C — Shell / PTY / Managed Job（PR #660，`a5sf-recon-shell/`）

| 断言 | 判定 | 证据 |
| --- | --- | --- |
| 瞬态 `bash` 被 route-C 重挂到 confined terminal face；允许命令 `exit 0` 返回 lane 字节，越 lane 读在 spawn 前被 `IO_READ_DENIED` | **CONFIRMED** | 我的 boot02：A 的 bash 在 lane 内 `exit 0` + lane 字节；跨 lane `IO_READ_DENIED` + deny fact；9 条 fact 的 method 只有 `shellRead`/`spawn`/`spawn:write` |
| 六条独立反 PTY 判据（`tty`/fd0 socket/`ptyHolders=0`/`baseBwrapWithMarkers=0` …） | **CONFIRMED（按其证据；我未重跑 /proc）** | 他们的 `proc-observations.json`；我的 boot 未做 /proc 观测，不冒充 |
| 持久终端 / 受管 Job 是 `NOT_WIRED`（preset 无 `terminal_*`、`bash` 无 `run_in_background`） | **CONFIRMED** | 我的 boot surface：无 `terminal_*`；`bash` schema 只有 `command/description/workdir`（`member-surface.json`） |
| archive 的 quiesce 窗口 ≈8.5 s（撤权不即时） | **NOT_TESTED（我未重测）** | 接受其 `ordering`/`lifecycle` 证据，但这是**权限时效**问题，不是"没测到"——见 §5 第 2 条 |
| A 类"无治理/越权空洞" | **SCOPED**：对 Shell 面成立，但**不能**读成全 Member——同一次 boot 里 FS/Search 面就是空洞（A/B） | C §6 的分级标题没有写"本面限定"，是跨面误读的风险点（§4 第 4 行） |

### 2.4 D — Web（PR #658，`a5sf-recon-web/`）

| 断言 | 判定 | 证据 |
| --- | --- | --- |
| 在其组合里：`web_fetch`/`web_search` 在 Member 面上、guard 每次调用 1 条 fact、deny 在 face 内 provider 之前 | **CONFIRMED（composition-level）** | 他们的 `run-10/run-11` item/counter/endpoint 四路观测；我读了 `web.ts` 的 guard 顺序，与描述一致 |
| 该结论适用于 **shipped 受治 preset** | **REFUTED** | 我的 boot02/boot03：同一 `preset-a5sf-governed-member` 上 `web_fetch` 产生 **0 条** web fact；模型可见拒绝是 `URL hostname "127.0.0.1" resolves to a non-public IP address`（**base provider** 的 SSRF 策略），不是 a5sf lane 决策。源码侧：shipped realm 不装 web face（`product-assembly.ts:599-606` 对 network 收窄直接 `NETWORK_UNCONFINED_REALM`；`a5sf-realm-row.mjs` 只有配置了 `webFace` + route-C 模块才装） |
| "产品路径无法装配 `network=deny`" | **CONFIRMED** | 同上源码；这也是 D 自己 §1 的披露 |
| 方法披露完整 | **部分否定**：D 用 `/__p6t6/tool` **直接派发 `team_delegate`/`team_archive_member`**（`run-boot.mjs:1036,1194`），README 方法节只说"控制器 run-boot.mjs"，未点明委派是直派而非 Leader turn。不影响其 web 断言（Member 自己的工具调用是真实模型 turn），但方法透明度低于 A（A 明写"交叉派发"） |  |
| 在"可被产品装配的 composition"上验证 deny lane | **NOT_TESTED / 不存在**：今天没有产品可装配的 `network=deny` 路径 |  |

### 2.5 E — External / 非数据面（PR #656，`a5sf-recon-external/`）

| 断言 | 判定 | 证据 |
| --- | --- | --- |
| `job_list/job_output/job_kill`、`skill`、`workflow` 在面上、有真实执行体、0 条 a5sf fact | **CONFIRMED**（`job_list`/`skill`/`workflow` 实测；`job_output`/`job_kill` 未调用） | 他们的 `e-face.json`/transcript；源码：`workflow-ptc/src/host.ts:270-290` → `ptc-runtime-node/src/index.ts:225-245`（`this.ctx.subprocess.spawn`，preset 作用域 = base 服务） |
| `workflow` 是真实的 PTC 子进程执行体（`return 42` 真的返回） | **CONFIRMED** | 他们的 transcript：`workflow "…" completed (0 agents). Return value: 42`；0 条新 fact、`confinedTurnLaunchers` 不增 |
| `run_code` 只是 PTC 展示名、`lsp` 零接线、MCP 未配置 | **CONFIRMED** | matrix M-11/M-17/M-18 同口径；我的 surface 无这三个名字 |
| "本面**没有**任何受治执行路径" | **CONFIRMED** | 我的 boot surface + 0 fact 复算 |
| realm 失效后 jobs/skill/workflow 的行为 | **NOT_TESTED（E 自己写 UNVERIFIED）** | 他们没有测，我也不补写 |

---

## 3. 双 Member 串权（五个 lane 的缺口，我的实测）

**一次 boot、两个受治 Member、两条不同 ceiling**（`memberIoCeilings` 按模板：
`lane-a` → `<ws>/lane-a`，`lane-b` → `<ws>/lane-b`），同一 Leader turn 依次 `team_delegate`
（`async:false`）。Member A 在自己的模型 turn 里依次调用：bash 读自己的 lane → bash 读 B 的 lane →
`read` 读 B 的 lane → `grep` 搜 B 的 lane → `web_fetch`；Member B 对称。

| 问题 | 结果 | 证据 |
| --- | --- | --- |
| A 的 lane 读不到 B 的 lane（受治路径） | **是**：`IO_READ_DENIED`，0 个 B 字节，deny fact locator = B 的 `b.txt` | `runs/boot02/member-A-transcript.txt`、`guard-facts.json` |
| A 的 tool 调用不带 B 的 identity | **是**：A 的 5 条 fact 全部 `memberIdentity=inst-1tbexue1i25w`，B 的 4 条全部 `inst-1jxdzet1noi1`；两 Member 的 `policyRevision` 不同（`a5sf1:0c19…` vs `a5sf1:5522…`）；B lane 上的 allow fact **只**属于 B | 同上；`recon-review.json#facts.identities` |
| A 的**原生**路径读不到 B 的 lane | **否（串权）**：`read` 成功返回 `A5SF_RV_LANE_B_BYTES`，0 条 fs fact；`grep` 同样返回 B 的字节、0 fact | `runs/boot02/member-A-transcript.txt` |
| 独立交叉派发（harness `POST /__p6t6/tool`，`as`=A 的子会话）复现同一结论 | **是**：`read` 返回 B 的字节；`bash` 被 `IO_READ_DENIED` 拒绝 | `runs/boot02/cross-dispatch.json`（**仅作交叉验证，不是结论来源**；结论来源是 Member 自己的模型 turn） |
| 跨 Member 的 `write`/`edit`/`read_image`/`glob`/`web` | **NOT_TESTED** | 缺的是同一条 base 服务上的逐工具调用；`read`/`grep` 已证明同一机制 |

**结论**：双 Member 串权**已实测**——受治面（bash）**不串**（identity 与 lane 都正确），
原生面（FS/Search）**串得彻底**（A 读走 B 的 lane 字节）。

复现：`node dev/agent-workflow/evidence/a5sf-recon-review/run-boot.mjs --run-tag <tag>`；
`--plan` 零 boot。两次干净 boot 的一致性：`agreement.txt`（13/13 行 SAME）。

---

## 4. 矛盾表（同一件事，不同报告/文档给出不同说法）

| # | 冲突 | 谁对 | 依据 |
| --- | --- | --- | --- |
| 1 | **FS 面到底受不受治**：A 说"0 fact、base `ctx.fs`、可越权"；`types.ts:231-232` 声明 `fs:'confined'`；matrix M-01/M-02 说"route C 重挂原生模块到 Member 隔离 fs scope" | **A 对**（就 shipped preset 而言） | `fs:'confined'` 是 **realm scope** 的声明；preset 的 `tool-fs` 在 preset scope 解析到 base 服务。matrix M-01 自己留了"工具尚未绑定到生产 preset"的限定，但该限定只出现在 M-01 的技术栏，通用读法仍是"已受治"。这是**文档措辞**问题，不是 A 的错 |
| 2 | **Web 面到底受不受治**：D 说"guard 真的被求值、allow/deny 都有 fact"；matrix M-14/M-15 说 2026-11-10 DEV-LIVE "legacy/non-strict Member 自己的 tool call 上 live 到达"；我的 boot 在 shipped 受治 preset 上 **0 fact** | **按装配分层**：D 与 matrix 各自对其组合成立；**产品 shipped 路径 = 不受治（0 fact）** | D §1 明确披露"TEST COMPOSITION"；matrix 的 live 行也限定 "legacy/non-strict Member"。错的是把三者都叫"受治 Member"而不写装配。**我的 boot 是 shipped 装配的唯一读数** |
| 3 | **Search 面**：B 说"Host 直接子进程、0 fact"；matrix M-06/M-07 写 `service-mediated:subprocess` + route C | **B 对**（shipped 装配未接线）；route-C 机制在 harness/mount 里存在但 **shipped preset 没有配 native module** | `a5sf-realm-row.mjs` 只自动挂 `bash`；`tool-fs-search` 原样保留 |
| 4 | **"治理空洞"结论的范围**：C §6 写 "A 类：无"；同一次 boot 里 A/B 面就是大空洞 | **两者都对但** C 的标题**必须**加"本面（Shell）限定**" | C 正文限界声明在 §8，但 §6 的 "A 类：无" 会被 parent/后续读者当作全 Member 结论；这是跨面误读风险，不是造假 |
| 5 | **43 工具面**：E 说 43 = 26+15+2；master 里 `dev/agent-workflow/evidence/a5sf-live-member/runs/boot01/member-surface.json` 只有 **16** 个名字（bash + 15 `team_*`） | **E 对**；旧 `member-surface.json` 是**被过滤器截断**的产物（`tests/world-factory/drivers/a5sf-live-member/run-boot.mjs:1009` 只留 `bash`/`team_*`） | 我实测 43 名逐名相同；E 的 A1 披露正确，旧文件会误导后来者 |
| 6 | **PTC / 进程内 JS**：matrix M-11 判 `NOT_WIRED`（"无 routed-native 接入面"）；E 说 `workflow` 是真实执行体、`run_code` 是展示名 | **E 对（可达性层面）**；M-11 说的是"**受治**的 routed-native 接入面"不存在——两句话都对，但"NOT_WIRED"读起来像"没有执行路径" | E §2.1 与 M-11 的 "run_code 不是可装载工具模块" 一致；差别在 `workflow` 这个执行体是否被点出。**建议 matrix 给 M-11 加一句 "但有 workflow 展示名执行体，0 fact"** |

---

## 5. 我认为最该先修的三件事（按"会漏字节 / 会漏权限 / 只是体验"排序）

### 1️⃣ 会漏字节：**FS + Search 原生工具在 shipped 受治 preset 上根本没走 confined face**

`read`/`write`/`edit`/`read_image`/`grep`/`glob` 6 个工具可调用、0 fact、越过任何 Member ceiling；
我的双 Member boot 证明 **A 能读走 B 的 lane 字节**。ceiling 在这些工具上是**装饰**。
今天的修法只有两条：把 route-C native module 接进 shipped preset（真修），或者在受治 preset 上
**先 deny 掉**这 6 个工具（fail-closed，先止血）。**理由**：这是唯一一条已被两个独立 lane + 我的
boot 三次复现的**跨 Member 漏字节**路径。

### 2️⃣ 会漏权限：**`web_fetch`/`web_search`/`workflow` 解析到 base 宿主服务，0 fact**

shipped 受治 preset 上 `web_fetch` 0 条 web fact；它的拒绝来自 base provider 的 SSRF 策略，
不是 Member 的 network lane——也就是说 **一旦 URL 是公网地址，就没有任何 Member 级 network 决策**。
`workflow` 同理：模型写的 JS 在宿主 sandbox policy 下真实执行，0 fact，不受 ceiling 约束。
次要但同属"权限时效"：C 的 archive quiesce 窗口（~8.5 s）意味着**撤权不是即时**的，窗口随 turn
时长增长。**理由**：这两条是"能执行但不受治理"的权限面，且证据最完整。

### 3️⃣ 只是体验（但会误导决策）：**"受治 Member"没有装配限定词 + 五份报告都没有双 Member 对照**

同一句"受治 Member"在五份报告里指五种装配：shipped preset（A/B/C/E）、测试行提供 realm（D）、
legacy/non-strict Member（matrix M-14/M-15）。结果是 D 的 web 结论会被读成"web 已受治"，
C 的"A 类无"会被读成"全 Member 无空洞"。建议：
（a）每份报告/矩阵行加一列 **"装配（which row/adapter）"**；
（b）把 **双 Member 串权对照**写进 recon/acceptance 模板（这次只有我补了，代价是一次 boot）。
**理由**：不直接漏字节，但会让下一轮把"机制存在"当成"生产已受治"，从而**推迟**真正的修复。

---

## 6. 我自己的 boot 记录

### 6.1 boot 台账

| # | 时间（UTC） | 结果 | 端口 | World / DSH_HOME | 说明 |
| --- | --- | --- | --- | --- | --- |
| 1 | 17:37:03 | Host start，`overall=FAIL`（2/8） | 3188 | `u5u5a5sfrev1-20261107T17-37-03Z` | 仪器迭代：`bash` 的 `workdir` 放在 ceiling 外，正控与跨 lane 探针都被 `spawn` 轴拒绝；`read` fact 判定用了 locator 后缀（把 bash deny 误计成 fs fact）。**原始产物保留在 `runs/boot01/`，不作为结论依据**（其 `run-record.json`/`teardown.json` 被仪器缺陷覆盖后删除，见 `runs/boot01/NOTES.md`） |
| 2 | 17:40:24 | Host start，`overall=FAIL`（7/8，唯一 FAIL = web 命题被推翻） | 3188 | `u5u5a5sfrev1-20261107T17-40-24Z` | 干净正控（`workdir` = 各自 lane）；双 Member 串权实测 |
| 3 | 17:42:36 | Host start，`overall=FAIL`（7/8，同上） | 3184 | `u5u5a5sfrev1-20261107T17-42-36Z` | 与 boot02 构成 agreeing pair（`agreement.txt` 13/13 SAME） |

**准确说法**：我的 `run-record.json#overall` 是 **FAIL**，因为第 6 条命题
（"shipped 受治 preset 的 `web_fetch` 会走 confined face 并产生 guard fact"）被**推翻**——
这是本轮要报告的发现，不是 driver 坏了。7 条 PASS 的命题见 `runs/boot02/run-record.json#cases`。

### 6.2 装配与纪律

* 真实 Host（`dsh-agent-team/host` shipped 行）+ shipped `preset-a5sf-governed-member`（从
  `cordis.patch.yml` 逐字读出，仅求值 `!!js process.platform==='win32'`）+ 真 `team.create` +
  真 `team_delegate`（`async:false`）+ 真模型 turn（scripted mock，已披露）。
* 每个成员一份 `memberIoCeilings`；两 Member 的 `policyRevision` 不同，fact identity 各自正确。
* `tests/homes/u5a5sfrev1-*` 在工作区内；端口 `3180` 族；`:3080` 未触碰；pinned host 树
  porcelain 前后均空；teardown by identity（`runs/boot03/teardown.json`：Host killed、
  port free、home deleted）。
* 机器并发 ≤2：走 `tests/world-factory/lib/dev-live-slots.mjs`（`DEV_LIVE_SLOT_LIMIT=2`）。
  **观察**：17:42:06 另一个 lane（`a5sf-live-member`，head `0c8539f7…`，world `u5a5sfsub1`）
  在同一 lease root 落了 `0.json`；我**没有**动它（跨 PID namespace 的 liveness 归 #659 的机制）。
  我自己的 slot 每次 boot 后均已释放。
* 对 `/__p6t6/tool` 的使用**仅一次交叉验证**（A 的子会话读 B lane / bash B lane），
  所有结论都另有 Member 自己的模型 turn 作为来源。

### 6.3 关于被测树 SHA

五份报告写 `235e1af8b`（各 lane 的 worktree HEAD），我复核的是 `origin/master` = `0230484b7`。
我**没有**逐字节 diff 两棵树；我核对的五条关键源码（`types.ts`、`mount.ts`、`a5sf-realm-row.mjs`、
`cordis.patch.yml`、pinned `tool-fs`/`tool-fs-search`/`workflow-ptc`）在 `0230484b7` 上支持上述
全部判断。**这是一个 NOT_TESTED**：`235e1af8b..0230484b7` 的产品差异未逐路径核对。

---

## 7. 非声明

* 本文件是 **DEV-LIVE** 工程审查：`eligible=false`，不产出 `V@B`，不关闭任何 G 门，不替代
  `Candidate-C2`，**不是任何 PR 的合并证据**。
* 我**没有**改五份报告、`matrix`/`register`/`STATUS`、产品源码；本目录是唯一新增。
* 我**没有**重测：C 的 archive quiesce 窗口、A 的 `write`/`edit`/`read_image` 跨 Member、
  D 的 compose 内 web deny 细节、E 的 realm 失效后 jobs/skill/workflow。
* 脚本化 mock 模型：工具调用路径真实，**模型行为不代表生产模型**（五份报告与我都这样披露）。

---

## 8. 文件清单

| 路径 | 内容 |
| --- | --- |
| `README.md` | 本文件（结论表 + 逐报告判定 + 矛盾表 + 三个数字 + boot 记录） |
| `run-boot.mjs` | 本审查的驱动器（`--plan` 零 boot；`--run-tag` 选择输出目录） |
| `dev-live-grant.json` | 本 lane 的 DEV-LIVE scope 授权（face `Subprocess`，world `u5a5sfrev1`） |
| `runs/boot02/`、`runs/boot03/` | 两次干净 boot 的原始证据（transcript/guard facts/cross-dispatch/state/run-record/teardown） |
| `runs/boot01/` | 仪器迭代的原始产物（**不作结论依据**，见 `runs/boot01/NOTES.md`） |
| `agreement.json` / `agreement.txt` | boot02 vs boot03 的 13 项一致性（0 differing） |
| `run-ledger.jsonl` | 3 次 boot 的 DEV-LIVE intent/start/outcome 行 |
| `plan-patch.yml` / `driver.log` | 零 boot 的装配计划、boot 日志 |
| `driver/logs/` | 三个 World 的 composed profile（装配证明）与 Host 实例日志（`?token=` 已全部 `<redacted>`） |
