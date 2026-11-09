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

---

## 6. 引用方式（给下游文档的硬约束）

1. 引用本 Preview 时必须带 **§1 的 commit + tarball sha + 预设 id**；只写"Preview"不算引用。
2. 说 Stop 时必须带 §3.1 的"durable `pause` 被 ACK 之后"限定语。
3. 说工具数时必须用 §5.1 的 **34（产品）/ 36（含仪器）** 双数，不得只写一个。
4. 说归因时必须用 §5.2 的整句，不得截断成"每次调用都可归因"。
5. 说"能跑"时必须带 §2.3 的限定：**WorldFactory harness 形态**；普通安装见 PD-36。
