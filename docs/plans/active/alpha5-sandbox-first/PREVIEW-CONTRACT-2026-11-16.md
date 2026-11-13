# Alpha.5 Preview 契约（冻结版）

> **日期**：2026-11-16 ｜ **状态**：冻结（frozen） ｜ **范围**：仅 `a5sf-governed-member` opt-in 预设的 Preview
> **上位文档**：`PREVIEW-READINESS-2026-11-15.md`（判定与证据正本）。本文件**不改写**其中任何判定、
> 等级或 `V@B`；它只把**对外可承诺的语义**与**部署前置条件**固定成一份可引用的契约，并登记两条
> 2026-11-16 的更正（名册 34/36、归因措辞），更正以**追加**方式落在本文件与 §5 点名的文件里。
>
> 冻结的含义：从本日起，Preview 的对外表述**以本文件为准**；任何与这里冲突的旧句式（例如"每次工具调用
> 都可归因"、"36 个工具"）视为被本文件收窄，而不是另一种同样有效的读法。

---

## 1. 版本与范围标识（version / scope identifier）

| 项 | 值 |
| --- | --- |
| 产品包 | `dsh-agent-team@0.1.1-alpha.2`（workspace 版本；`package.json` 与 `packages/runtime` 同源） |
| 测量基线 | `origin/master` @ **`87484ded13db97ea688484e85c67a85107a72d1f`**（本文件所在的 lane 从该提交切出；`git log -1` 可复核）；本 lane 之后 rebase 到 `41a272c6d`（PD-35 STOP-OUTCOME 合并），产品文件零差异 |
| 交付形态 | **一个 bundle 包**：`pnpm pack` 产出的 tarball `dsh-agent-team-0.1.1-alpha.2.tgz`，**4 208 998 字节**，`sha256 = bea32690ba57661f4a940b3f2f3efa71e9789818c64bbad7520db4df290ce366` |
| 安装命令 | `dsh plugin --profile web add <tarball>`（`docs/INSTALL.md` §2 的普通安装路径；CLI 自动把 `dsh-agent-team` 追加进 `dsh.profile.bundles`） |
| 组成的行 | host 行 `dsh-agent-team/host`、client 行 `dsh-agent-team/client`、预设行 `a5sf-governed-member`（bundle 自带，**默认不启用**） |
| 启用方式 | profile 层**整行覆盖** `dsh-agent-team` host 行，且同时给 `memberPresetId: a5sf-governed-member` **与** `a5sfGovernedRealm: true`；`blueprintSource` 必须是 `schemaVersion: 4` 且带 `memberIoCeilings` 的蓝图 |
| 不包含 | 没有 `release`。`release` 仍 **BLOCKED**；本 Preview 的 `PREVIEW-GO`（2026-11-15）只覆盖上面这个 opt-in 预设 |
| **本版本是否"装完即可用"** | **否。** 2026-11-16 的六臂实测：打包、安装、启动、`team.create`、真实模型回合全部成立，但**第一个工具调用就结束回合**（`Cannot read properties of undefined (reading 'prepare')`）。理由与全部读数 = §2.3 与 `dev/agent-workflow/evidence/a5sf-pd35-install-smoke/control-matrix.txt`（A–F 六臂）；登记 = **PD-36 (INSTALL-SMOKE)** |

**范围边界的一句话**：这是**内部、opt-in 的 governed team runtime 预览**，不是默认团队形态，也不是发布候选。
`CORE PATCH BUDGET = 0` 在本版本上仍然成立：宿主 `@deepseek-ai/dsh@0.2.0-rc.2` 未被修改。

**本版本的可信度边界（一句话）**：上表的 sha 与预设是**能装、能起、能建队、能跑真实模型**的证明；
它**不是**"能跑主流程"的证明——那条证明在**普通安装**里失败，理由不是推断而是六臂控制矩阵：A（不装插件）绿、
B/C（装插件，tarball 与 World 链接两种形态）同错、D/E（本机 npm 宿主，无插件）同错但属环境隔离项、F（受治行）
同样在第一个工具调用处失败。**因此本契约既不声称"装完可用"，也不把 D/E 当成上游缺陷的证据。**

---

## 2. 部署前置条件（deployment preconditions）

以下三条不是"注意事项"，而是**前置条件**：任一条不满足，Preview 的行为就不是本契约描述的行为。

### 2.1 `web_search`：需要 Exa 兼容端点 + key，否则是 typed 拒绝

- **满足前置条件时**：`web_search` 走 governed web 面（`tool-web` 的 realm 行），请求经 guard 记 fact 后发出。
- **不满足时（默认安装）**：每次调用返回 **typed `WEB_PROVIDER_UNAVAILABLE`**，**0 个搜索请求离开进程**
  （实测：`searchServer.connections = 0`，1 条 deny fact），**不是**"搜了但没结果"，**不是**降级为宿主的 base web。
- **明确不承诺**：不承诺"装完就能上网搜"。Exa 端点与 key 是**部署方**的输入；本仓库的默认安装图里没有 Exa provider。

### 2.2 `read_image`：需要模型路由声明 `image`

- **满足前置条件时**：路由声明了 `image`，图片内容进入该路由的输入，`read_image` 的受管 fs 面照常记 fact。
- **不满足时**：默认的 `['text']` 路由**在 provider I/O 之前**拒绝（实测：**0 facts / 0 bytes**），而不是"读了再报错"。
- **明确不承诺**：不承诺"能看图"。本 Preview 的实测只覆盖**拒绝分支**（脚本化 mock 路由是 `text`）。

### 2.3 安装形态：**普通安装的主流程尚未被证明可跑**（2026-11-16 新增，实测）

这是本契约**最重要的一条前置条件**，也是对外部审查"装完能不能跑"的直接回答（证据：
`dev/agent-workflow/evidence/a5sf-pd35-install-smoke/`）：

| 事实 | 实测 |
| --- | --- |
| 打包与安装**机制**成立 | `pnpm pack` → tarball（sha 见 §1）→ 干净目录里的真实 CLI `dsh plugin add <tgz>` → profile 的 `dsh.profile.bundles` 自动追加 `dsh-agent-team` → 真实 `dsh web` 启动 → 插件挂载（2 个 bundled skill 注册、`/team-remote` MOUNTED）→ `team.create` / `team.ensureRootLive` 成功 → **真实模型**（`deepseek-official`，凭据取自用户的 `$DSH_HOME/.credentials.yaml`）产生真实回合并发出工具调用 |
| **主流程不成立** | **每一次工具调用**都以 `turn/end {kind:'error', error:{message:"Cannot read properties of undefined (reading 'prepare')"}}` 结束；`tool/result` 是"已记录但未落定"的中断结果。因此 `web_fetch` / 文件读写 / goal / Stop / 结果收集**一条都没能在普通安装里跑通** |
| 不是打包差异 | 同一个插件以 **WorldFactory 的链接形态**装进同一 profile，**同样失败**（链接形态 `home4`，记录见控制矩阵 C） |
| 是插件装载后的差异 | 同一宿主、**不装插件**的普通会话 `bash` **成功**（`pinned-ok`，`turn/end completed`）；装上插件后**任何**工具调用失败（控制矩阵 A vs B/C） |
| 与本插件无关的一条环境事实（披露，不据此归因） | 本机 **npm 装的宿主**（`@deepseek-ai/dsh@0.2.0-rc.2`，pnpm isolated 与 npm flattened 两种布局）**即使不装插件**也复现同一错误；native 包的 install script 在本环境被挡（`@deepseek-ai/dsh-subprocess-local`、`koffi`、`node-pty` 等）。这只说明"本环境的 npm 安装不可用作证据"，**不能**推出上游发布缺陷 |

**因此**：本契约的**全部 live 证据仍然只在 WorldFactory harness 形态下成立**。harness 与普通安装的差别
（见 `dev/agent-workflow/evidence/a5sf-pd35-install-smoke/control-matrix.txt` 与
`tests/world-factory/lib/profile-module-graph.mjs` 的注释）**尚未被消除**，这正是外部审查点名的
"测试替身"缺口：**在普通用户安装里跑主流程这件事，本 Preview 尚未证明**。登记为 **PD-36 (INSTALL-SMOKE)**（原 PD-35；PD-35 已被 STOP-OUTCOME `41a272c6d` 占用）。

对外表述只能是：**"在 WorldFactory harness 下可跑；普通安装的主流程待修复（PD-36）"**。
不得表述为"装完即可用"。

### 2.3.1 PD-37 修复后的实测：**普通安装的工具执行已成立**（2026-11-09 追加，不改 §2.3 行文）

§2.3 是 2026-11-16 的读数，它成立并且**保留**；本节是它被修复后的**追加**读数。缺陷与修复都在**我们自己的
清单**里，宿主未被修改（`CORE PATCH BUDGET = 0` 仍成立）。

**根因（实测，不再是假设）**：`@deepseek-ai/dsh-tools` 的调度器键是**普通 `Symbol(...)`**
（`packages/core/tools/src/index.ts:480`，不是 `Symbol.for`），因此**模块实例**决定符号身份。
基础清单把 6 个 `@deepseek-ai/*` 写成**运行时 dependency**，`dsh plugin add` 于是把它们的闭包（含
`dsh-tools`）装进 **profile**；app-boot 的 profile 层优先用 profile 里的拷贝回答 `tools` 行，而宿主进程里的
`dsh-agent-loop` 只有自己那份 → `tools[symbol] === undefined` → 每次工具调用在 `prepare` 处死亡。
PD-36 的 H1 命中；H2（我们的 router/isolate）与 H3（WorldFactory 多给了一行）**均被证伪**（不装插件、只放一份
profile 内 `dsh-tools` 也能复现同一错误）。证据：`dev/agent-workflow/evidence/a5sf-pd37-installed-tools/`
（`08-module-instances.json` 记录同一进程里**两个** `dsh-tools` 模块 URL、`sameSymbol=false`）。

**修复**：5 个由宿主提供的包（`dsh-skill`/`dsh-tool-fs`/`dsh-tool-web`/`dsh-tools`/`dsh-web-fetch-http`，
`09-host-provides-six.txt` 逐个证明宿主能解析）改为 **peer（exact `0.2.0-rc.2` + `optional: true`）**，
因此**永远不会被装进 profile**；第 6 个 `@deepseek-ai/dsh-web-search-exa` 宿主不提供，保留为 dependency，
且**不拖入 `dsh-tools`**（`01-install-fixed.txt`：profile 里 `@deepseek-ai/*` 只剩 3 个，`dsh-tools` 为零）。

**安装形态实测（同一 tarball 连续两轮）**：`dsh-agent-team-0.1.1-alpha.2.tgz`，
**4 210 077 字节**，`sha256 61fd2e48d4d78593d2d8cd16efe8c737f50d794d80d4a93b96dd8d695169efb4`，
装进 CLI 自己写出的 pristine profile（`nodeLinker: hoisted`、`autoInstallPeers: false`）后：

| 动作 | 结果（两轮一致） |
| --- | --- |
| `web_fetch`（本地端点） | 工具**执行到底**，返回宿主的 typed 拒绝 `WEB_BLOCKED_URL`（宿主对非公网地址**无条件**拒绝，无开关；这不是调度失败） |
| `web_fetch`（公网） | **HTTP 200**，正文返回 |
| fs `write` + `read` | 写入并读回 `PD37_FS_OK` |
| `create_goal` + 续轮 | goal 建立，**续跑 5 轮 / 4 轮**（`roundsStarted=5` / `4`） |
| Stop（`goals/pause` + `session/cancel`） | `active → paused`、`armed → disarmed`，在跑回合以 `turn/end {kind:'aborted', reason:{kind:'user'}}` 结束，**Stop 后 4 秒内零新模型请求** |

**反向对照**：同一 profile 形态、同一驱动器，换回**修复前**的清单（基础 `package.json`）→ profile 里 **11** 个
`@deepseek-ai` 包（`dsh-tools` 在、`dsh-agent-loop` 不在）→ 第一次 `bash` 就复现
`Cannot read properties of undefined (reading 'prepare')`（`07-negative-control-session.jsonl`）。

**因此本契约的对外表述改为（只此一句）**：**"普通安装（`dsh plugin add` + `dsh web`）的工具执行自本 lane 起可用：
2026-11-09 两轮实测通过（fetch / fs / goal ≥2 轮 / Stop）。"** §2.3 的"待修复（PD-36）"由本句取代，PD-36 作为
**历史读数**保留——它记录的是**已发布产物里真实存在过的阻塞**，不是措辞问题。

### 2.3.2 真实模型 × 真实安装：**同一次运行里**四件事都发生（2026-11-09 追加）

§2.3.1 的两轮用的是**脚本化模型**（工具调用由脚本决定），PD-36 用的是**真实模型**但只到"第一次工具调用"。
外部审查要的那句话是两者**同时**成立。本节是一次把两者放在一起的运行：**同一个已安装 artifact**
（`sha256 61fd2e48…`）、**真实 provider**（`qiyuan-self` / `deepseek-v4.1-flash-1017`，走 profile 的
`llm-pi-ai` provider 行 + `agent-default-model`，凭据取本机 credential store）、**模型自己决定调什么工具**
（没有任何 tool-call 脚本）。证据：`10-real-model-install.txt`、`11-real-model-session.jsonl`（91 个事件）、
`12-real-model-summary.json`。

| 回合 | 模型自己发出的调用 | 结果 |
| --- | --- | --- |
| 1 | `web_fetch` `https://registry.npmjs.org/-/ping` → `write` → `read` | **HTTP 200**（`meta.statusCode=200`）；写入并读回 `PD37_REAL_OK`；`turn/end completed` |
| 2 | `create_goal`（`max_goal_rounds: 5`）→ `bash` 追加清单第 1 条 → `read` | goal `active`、`revision 1`；`turn/end completed`（goal 第 1 轮） |
| 3 | `write` → `read`（改第 1 条措辞） | `turn/end completed`（goal 第 2 轮；`roundsStarted=2`） |
| 4 | （Stop 打断） | `goal/change pause` → `phase=paused`、`armed → disarmed`；`turn/end {kind:'aborted', reason:{kind:'user'}}`；**abort 之后零事件**（`events_after_abort=0`，日志最后一条就是这次 `turn/end`） |

**三个断言，一句一个，不合并**：
1. **真实安装上工具会执行**——脚本化模型两轮（§2.3.1）+ 真实模型一轮（§2.3.2）都测到了。
2. **真实模型会在真实安装上跑回合并发起工具调用**——PD-36 测到"发起"，§2.3.2 测到"发起并完成"。
3. **四件事（fetch / fs 读写 / goal ≥2 轮 / Stop）在一次真实模型 × 真实安装的运行里全部发生**——§2.3.2，**n=1**
   （一个 provider、一个模型、一次运行）。

**这次运行没有证明的（同样一句一条）**：`team.create` → Leader 回合未在本 lane 重测；Stop 走的是按钮发出的同一组
RPC（无 headless 浏览器，未点击 DOM）；重启后不续跑未测；`n=1` 不同于"稳定"，它是"存在性证明"。

**因此对外表述（替换 §2.3.1 末句，仍然只此一句）**：**"普通安装（`dsh plugin add` + `dsh web`）的工具执行可用：
真实模型在已安装 artifact 上完成了 fetch / 文件读写 / goal 两轮 / Stop（2026-11-09，一次运行）。"**
PD-36 的"待修复"由本句取代；PD-36 作为**历史读数**保留——它记录的是**已发布产物里真实存在过的阻塞**。

**这次修复没有证明的东西（逐条披露）**：
1. **未重测** `team.create` → Leader 回合：PD-36 里该链路在"第一次工具调用"之前是绿的，本 lane 只跑了普通会话；
   代码未变，但**没有**在本 lane 重新测量，`team_collect` 同理。
2. **未点击** UI 的 Stop 按钮（本机无 headless 浏览器）：驱动的是该按钮发出的**同一组 RPC**，abort 在会话日志里可见。
3. **未测**重启后不续跑。
4. **CI 覆盖缺口**：真正的回归钉子是"**装好的 profile 里启动并让一次工具调用成功**"，它需要 `pnpm pack`、
   真实 `pnpm add`、真实 `dsh web` 与脚本化模型（网络/注册表/writable `DSH_HOME`/分钟级墙钟），**主机侧无宿主
   CI 跑不了**。所以 CI 里放的是**清单级替身**（`packages/testkit/test/plugin-dsh-compat.test.ts`：15 个 peer
   逐个 exact + optional、peer 不得是 dependency、**任何 `@deepseek-ai/*` 不得是 dependency/optionalDependency**，
   唯一例外是上面那个宿主不提供的名字）；**而那次 boot 是本 lane 明确点名的手工门**（README §4）。

---

## 3. 语义承诺（只承诺能辩护的部分）

### 3.1 Stop 的保证

**承诺**：Stop 保证的是 **"durable `pause` 被 ACK 之后不再有 continuation"** —— 也就是
`goals.pause` 落定、`goals/get` 重读为 `paused` 之后，**不会**再开始新一轮、不会再发起新的模型请求。

**不承诺**："点下按钮之后立刻没有执行"。从点击到 `pause` ACK 之间有一个毫秒级窗口，窗口内**可能**
已有一条工具调用开始；本报告已把它测出来（`PREVIEW-READINESS` §4.4），不假装它不存在。

实测数字（S1c，PD-34 控件序列 `goals/get → goals.pause → session.cancel → goals/get`）：
6 轮 / 7 调用 → **0 轮 / 0 请求 / durable pause 之后新开始的调用 0**，重读 `paused`，lifecycle 仍 `SETTLED`。

### 3.2 Stop 的作用域

- **只停目标 Member**。这是设计，不是缺陷。
- **停 Leader 的当前回合不会停已委派的异步工作**：`team_delegate` 一旦被接受，Member 的回合在它自己的
  会话里推进；停 Leader 只结束 Leader 当前回合，**不**级联到 Member。
- **Stop ≠ Archive**：Stop 停的是目标（goal / 回合），Member 记录、绑定、可读状态都还在；Archive 是
  生命周期终态（S4：107 轮 / 108 调用 → 0/0，`ARCHIVED`）。

### 3.3 结果收集

`team_collect` 在 Stop 之后仍可读：`running` 的 Member 返回终态，已完成的 Member 直接返回
`memberResult.body`（实测：A 从 `running` 到终态，B 直接返回 body）。**不承诺**"Stop 会补写没落盘的结果"：
中断的调用按"outcome unknown"呈现，这是 agent-loop 的上游语义。

---

## 4. 明确"不是"（explicit is-not）

四条来自 `PREVIEW-READINESS` §7.1，逐字保留；第 5 条是 2026-11-16 因安装实测新增。

1. **不是"默认能上网搜"**：`web_search` 是部署条件性的，默认安装是 typed `WEB_PROVIDER_UNAVAILABLE`、0 请求（§2.1）。
2. **不是 per-host 网络策略**：网络轴是**单一布尔** allow/deny；deny 是**准入层的前置拒绝**，不是 per-host ACL、
   **不是 OS 隔离**。
3. **不是 team-wide Stop**：Stop 只停目标 Member；停 Leader 的当前回合不停已委派的异步工作（§3.2）。
4. **不是对恶意 Member 的安全边界**：它是"治理可归因"，不是"隔离不可逃逸"。`bash` 的越界写由 OS profile 兜
   （BL-17），网络只有单一布尔，shell 体不由服务轴归属。**"防住恶意 Member"是正式 Alpha.5 的题目，不是 Preview 的承诺。**
5. **不是"普通安装即可用"**：见 §2.3 / PD-36。当前只在 WorldFactory harness 形态下有 live 证据。

---

## 5. 两条 2026-11-16 的更正的（append-only，不改判定）

外部审查点名了两处措辞，它们**在旧文本里是过宽/含混的**。更正按仓库惯例**追加**，旧判定（`PREVIEW-GO`、
`V@B`、等级、`release BLOCKED`）**一字不动**。

### 5.1 名册更正：受治面 36 个名字 = **34 个产品工具名 + 2 个 World 注入的测试仪器**

- 实测表面 = **36 个工具名**，这一点不变（`PREVIEW-READINESS` §2 的表格）。
- 但其中 **2 个是测试仪器**（`u5_canary`、`u6fs_probe`，由 WorldFactory harness 行注册，出现在**每个** agent 的表面），
  **不是产品工具**。
- 因此：**用户可见的产品工具数是 34**（10 受管 I/O + 5 同族 + `read_image` + 3 Goal + 15 `team_*` = 34）。
- 旧句"`19（preset 产品工具）+ 15（team）+ 2（仪器）= 36`"本身没错，但被读成"产品有 36 个工具"是错的。
  更正后的对外表述：**"受治面 36 个名字，其中产品工具 34 个，2 个是测试仪器"**。
- 落点（均为追加，带日期）：
  - 本文件 §5.1；
  - `PREVIEW-READINESS-2026-11-15.md` §2（表后更正块）；
  - `PHASE-REPORT-2026-11-10.md` §2（更正块）；
  - `docs/STATUS.md` 顶部快照的第 (2) 条。

### 5.2 归因措辞收紧：三种机制，不是一种

旧句"**每一次工具调用都可归因**"太宽。冻结后的表述**逐字**如下（本句必须同时出现在
`PREVIEW-READINESS` §7.1 与 `docs/STATUS.md` 顶部快照）：

> **Preview 提供的是可归因的 guard fact / typed deny，覆盖受治的 I/O 调用；`team_*` 控制工具沿用既有的
> TeamDomain / envelope 审计；Goal 三件套走上游 Goal 状态服务。这是三种不同的机制，不是一种。**

推论（必须一起说）：

- "可归因"的**强度不同**：受治 I/O 是"每条调用一条 fact 或一条 typed deny"；`team_*` 是**请求令牌 + envelope +
  生命周期**审计；Goal 是**上游状态机**（`paused` / `roundsStarted` 等），不是 guard fact。
- **不得**把三者合并成"统一审计面"，也不得说"所有调用都有 guard fact"。

### 5.3 安装可用性更正：§1 的"装完即可用 = 否"被 PD-37 取代（2026-11-09 追加）

- 旧文本：§1 表"**本版本是否'装完即可用'**"= **否**；§2.3 标题 = "普通安装的主流程尚未被证明可跑"。
- 新事实：**PD-37** 定位并修复了那条阻塞（我们清单里的重复核心拷贝），并在**安装形态**下连续两轮实测通过
  （`web_fetch` / fs 读写 / goal ≥2 轮 / Stop）。全部读数 = §2.3.1 与
  `dev/agent-workflow/evidence/a5sf-pd37-installed-tools/`。
- 因此：**"装完即可用"这一句自本 lane 起成立**，条件与范围逐条固定为：§2.1/§2.2 的部署前置条件照旧；成立的是
  **工具执行**（真实模型在已安装 artifact 上完成 fetch / fs / goal 两轮 / Stop，§2.3.2，n=1）；**不**覆盖本 lane
  **未重测**的 `team.create` 之后链路、DOM 点击 Stop、重启不续跑。
- 旧判定（`PREVIEW-GO`、`V@B`、等级、`release BLOCKED`）**一字不动**；本节只更正措辞，不移动任何裁决。
- 落点：本文件 §2.3.1 与 §5.3（均为追加）；`PRODUCT-DEBT-REGISTER.md` 的 **PD-37** 行。

---

## 6. 引用方式（给下游文档的硬约束）

1. 引用本 Preview 时必须带 **§1 的 commit + tarball sha + 预设 id**；只写"Preview"不算引用。
2. 说 Stop 时必须带 §3.1 的"durable `pause` 被 ACK 之后"限定语。
3. 说工具数时必须用 §5.1 的 **34（产品）/ 36（含仪器）** 双数，不得只写一个。
4. 说归因时必须用 §5.2 的整句，不得截断成"每次调用都可归因"。
5. 说"能跑"时必须带 §2.3 的限定：**WorldFactory harness 形态**；普通安装见 PD-36。

---

## 7. 0.1.6 的范围取代（append-only，2026-11-09；不改写 §1–§6）

本节只做**范围指向**，不重写本文件任何历史判定、措辞、等级或证据。

- 自 **0.1.6** 起，本契约的**对外适用范围**由同目录
  `RELEASE-NOTES-0.1.6.md` 取代：0.1.6 把 Alpha.5 受治运行时与 Alpha.6 审批路由面放进
  **同一个 artifact**，并在 Release Notes §2 重新陈述两面的稳定性边界（Alpha.5 受治面稳定；
  Alpha.6 审批面 **opt-in experimental**）。
- 因此：凡引用"本 Preview 的对外语义"时，**以 Release Notes 的 0.1.6 范围为当前表述**；
  本文件 §1–§6 仍是 **2026-11-15/16 那次 Preview 判定与测量**的历史正本，其 tarball sha、
  `V@B`、等级与 `PREVIEW-GO` 判定**不因本节移动**。
- 本文件 §6 的五条引用硬约束，在被 Release Notes 收窄或替换的范围内失效；未被替换的部分
  （尤其是 §5.2 的归因整句与 §3.1 的 Stop 限定语）继续有效。
- 0.1.6 的 Alpha.6 面**不在**本契约的 Preview 承诺内；它的已知缺陷 A6-26 与恢复流程见
  Release Notes §5 与 `RUNBOOK-CONTROL-ABANDONED.md`。

---

## 8. 裁决权威按 scope（append-only，2026-11-13；invariant 37 后继规则，issue #756）

本节只澄清**文本**，不改任何判定、等级、机制或 `V@B`。撤回的是"member 永不是 resolver"这类绝对化
表述——它从来不是冻结 Architecture 的原文：§25.1 是 Control/Approval 的目的，invariant 37 的原文是
"Member 不能 unrestricted self-escalate"。

- **后继规则**：裁决权威**按 case/leg 归属**——请求所属 case/leg 的被指派评审实例可以裁决；被禁止的
  是**执行者本人裁决自己的操作**（reviewer 与 reviewed 必须是不同实例），不是"任何 member 都不能裁决"。
- **双通道现状（含边界）**：

| 通道 | 谁可以裁决 |
| --- | --- |
| `leader-approval` | Leader 或 human；启用 Alpha.6 `reviewRouting` 的团队上 = 该 case/leg 当前被指派的 Officer（团队内唯一在读的 Officer 实例） |
| Alpha.6 Officer 评审 | 该 case/leg 的被指派 Officer（实例级、case/leg-scoped ReviewCapability；durable 记录真实 decider）；leg 转交 Leader 后原 Officer 不再可裁决 |
| `user-approval` | **仅 human**（Leader 不得代替用户） |
| `envelope-mutation` | Leader 或 human |

- **发现面的真实状态**：`team_list_pending_control` **按调用者分流**——Leader 看到每个 open approval
  case 的当前 leg（含 `user-approval`，故它不是对 Leader 不可见）；被指派的 Officer 经
  `listMyReviewTasks` 看到自己的当前 leg；未被指派的 member 被 `TEAM_TOOL_PENDING_LIST_NOT_LEADER`
  在任何读取之前拒绝。issue #756 里**已登记、未实现**的是**单一角色化、带 resolver kind/identity 的
  "全部请求"视图**，不是上面的按调用者列表；读本节不得得出"该全量视图已实现"，也不得得出"发现面
  没修"。
- **证据边界**：J06 实测（`dev/agent-workflow/evidence/joint-acceptance/j05j06-run1/joint-arms.md`）
  显示 ask 路由到 Officer、`routedToOfficer=true`、`identityCarried=t`，durable decider 为
  `{"instanceId":"inst-…","kind":"instance","role":"member"}`。本节**不**声称任何 `resolver=officer`
  之类的 durable 字段命名——代码与 J06 都没有这个字段。
