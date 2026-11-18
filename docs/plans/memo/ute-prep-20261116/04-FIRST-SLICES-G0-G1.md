# 04 — G0/G1 首批纵切：每个都能独立评审的一刀

**[updated 2026-11-16 UTE-Prep]** #765 的 G0–G5 是横向大 Gate（"latest host integration"整层）。本文把它切成**首批 6 个纵切 + 1 个探测**，每个的规模都能在**一次评审**里看完，并且每个都带四件套：**代码 / 真实负控 / 旧路径对照 / 退役条件**。没写退役条件的行不算切片。

> **文件所有权（硬约束，`docs/ROUTER_RULES.md` §0.1）**：`tests/paths.mjs`、共享 Host 装配、产品入口、Authority 指针与快照、Member 生命周期 = **只有 Integration Owner** 可写。能力面自己的 provider/kit/证据 = 对应 Capability Implementer。表中的 "Owner 列" 指评审责任人，不是"可以顺手改共享文件"。

## 1. 矩阵（先看这一张）

| ID | 切片 | 触碰的接口 | 拥有的文件（新增/修改） | 验收四件套（摘要） | 规模 |
|---|---|---|---|---|---|
| **G0-S1** | 第二棵 pinned 宿主树 + 代际登记 | `tests/paths.mjs` 新增符号；无产品接口 | `tests/paths.mjs`（+3 符号/1 band）、`tests/world-factory/host-pin-rc5.test.mjs`（新）、`docs/TEST_METHODS.md` §6（+1 行基线表） | 代码：pin 断言；负控：跨代 home/port 复用必须 typed 拒绝；旧路径：legacy pin 断言逐字不改仍绿；退役：G5 合并代际时删除后缀符号 | 小 |
| **G0-S2** | rc.5 空载启动 + 公开 seam 探针（**零产品代码**） | `ToolsService.resolve()` / `ResolvedToolSet` / `setExecutor` / `tools/result` 形状 | `tests/world-factory/suites/<n>-rc5-seam-smoke.mjs`（新）、`dev/agent-workflow/evidence/ute-prep-rc5-seam/**`（新） | 代码：boot + resolve 断言；负控：未知 agent 的 `resolve` 必须 typed 失败；旧路径：同探针在 legacy 树上跑一遍并记录差异；退役：rc.5 成为唯一代际后删除双跑 | 小 |
| **G1-S1** | FS 纵切：受控 `ctx.fs` 的 read/write 在 rc.5 上跑通 | `ctx.fs`（Provider 侧）；**不碰** `ToolsService` | 能力面 FS provider 适配 + 该面 C1 套件 + 证据目录 | 代码：read/write 正控；负控：workspace 外写入被 `FS_SANDBOX_DENIED` 且文件**不存在**；旧路径：同一场景在 legacy 路径同判；退役：legacy FS Family 只在 G5 且对照基线存在后退役 | 中 |
| **G1-S2** | `web_search` 的 `llmProvider` 路由透传（**语义变化**） | `WebSearchRequest.llmProvider`（rc.5 公开字段）；受控 `ctx.web` 代理 | 该面 web provider/代理 + 套件 + 证据 | 代码：路由透传断言（一路透传到 provider）；负控：代理**丢掉** `llmProvider` 时用例必须红（mutation 证明）；旧路径：rc.3 无此字段，记录为**语义变化**而非等价；退役：无可退役项（新增能力） | 小 |
| **G1-S3** | S1 结算事实：单次原生调用的 fact-or-unknown | `tools/execute` 包装 + Journal（Team 侧） | settlement 适配 + `execution-fact` 套件 + 证据 | 代码：一次调用一条 fact，`ExecutionId` 幂等；负控：dispatch 后 kill -9 → `EXECUTION_UNCONFIRMED`（不是 succeeded）；旧路径：legacy `recordExecutionResult` 投影读得通；退役：旧 result 解析路径在 G5 退役 | 中 |
| **G1-S4** | 旧路径可运行回归基线（**退役前置**） | 无（只读旧路径 + 记录 verdict） | `tests/world-factory/suites/<n>-oldpath-baseline.mjs`（新）、基线 `.tsv` 证据 | 代码：跑旧路径并落基线；负控：基线**不得**因新路径改动而变化（变了就是等价性被破坏）；旧路径：本身即旧路径；退役：无（这是退役的前提，最后才退役它） | 中 |
| **G1-S5** | S2 探测：rc.5 上是否存在"返回前可等待"的公开点（**只调查，不改产品**） | public `ToolExecutor` / `ToolExecutionPipeline` / `tools/post-execute` | 一份 memo + 复现脚本（`scripts/` 之外或一次性脚本） | 产出二选一：可实现的等待点方案，或 `CORE_SEAM_BLOCKER`（含 E2/E3 式证据）；负控：不适用（不是行为切片）；退役：结论被采纳后脚本归档 | 小 |

**顺序**：G0-S1 → G0-S2 →（可并行）G1-S1 / G1-S2 → G1-S3 → G1-S4 → G1-S5。**G1-S4 必须在任何退役动作之前存在**；G1-S5 不阻塞 G1。

## 2. 逐切片的验收细则

### G0-S1 — 代际登记与并存

- **代码**：`tests/paths.mjs` 新增 `TEST_USE_RC5_REL='tests/deepseek-harness-test-use-rc5'`、`DSH_RC5_VERSION='0.2.2-rc.5'`、`TEST_USE_RC5_SHA='9c2670d3bce5275e0d1610272958121af87787bb'`、`HOST_RC5_PORT_BANDS=[[13000,13049]]` + `homeRootRc5()`。**不得**在套件里出现 40-hex 字面量。
- **真实负控**（不是断言函数返回 false，而是真的拒绝一次启动）：
  1. 用 rc.5 的 sha 起 world，但 `DSH_HOME` 指向 legacy 的 `tests/homes/<world>` → 必须在 spawn 之前以 typed code 拒绝（建议 `HOST_PIN_HOME_CROSS_GENERATION`），且**没有进程被创建**（PID 计数/`ss -ltn` 无新监听）。
  2. 用 legacy 的 port band（3181–3199）起 rc.5 world → 拒绝（`HOST_PIN_PORT_OUTSIDE_BAND`）；反向也要测：legacy world 试图租 13000–13049（今天它会溢出到那里）→ 必须被新的分区拒绝。
  3. 把 `TEST_USE_RC5_SHA` 改成 `rc.3` 的 sha → pin 自检红（证明断言真的绑到字面量，而不是"存在即可"）。
- **旧路径对照**：legacy 的 pin 断言与既有 world-factory 套件**逐字不改**并保持绿；两棵树的 `git rev-parse HEAD` 分别等于各自登记的 SHA，且 `realpath` 不同。
- **退役条件**：G5 合并代际（rc.5 成为唯一代际）时，删除 `*_RC5_*` 后缀符号并把三个字面量并入现有名字；那是一次具名换 pin 裁决（R1.2/H-2），不是本切片的后续提交。

### G0-S2 — rc.5 空载启动 + 公开 seam 探针

- **代码**：一个 world-factory 套件：起 rc.5 world → `ToolsService.resolve({agent, modelSelection, signal})` 拿到 `ResolvedToolSet` → 断言 `tools` 与 schema 形状 → 断言 `setExecutor` 可被调用且卸载后不静默降级 → 记录 `tools/result` 的 emit 形状（观测，不判定顺序）。
- **真实负控**：未知/未绑定 agent 的 `resolve` 必须抛 typed 错（不是空 set）；`setExecutor(undefined)` 之后的选择必须拒绝而不是落回更宽 executor。
- **旧路径对照**：同一探针在 legacy `0.2.0-rc.2` 树上跑一遍，把**差异**写进证据（schema/字段名/错误码不同处）。差异不是失败，**未记录的差异**才是。
- **退役条件**：rc.5 成为唯一代际后，探针合并进常驻 smoke（保留负控，删掉双跑分支）。

### G1-S1 — FS 纵切

- **代码**：受控 `ctx.fs` 的 read/write 在 rc.5 上经 Provider 执行；Binding 只提供 service，不改 `ToolDefinition` 业务体（UTE-01/02）。
- **真实负控**（缺一不算过）：
  1. 写 workspace 外 → typed `FS_SANDBOX_DENIED`，并且**事后 stat 该路径不存在**（不是只看返回文案）。
  2. read 一个未授权路径 → 拒绝且**没有发生 open**（用 oracle/观测窗口证明，不靠返回文本）。
  3. 破坏性的：把 Provider 换成"只检查字符串路径"的实现 → 负控必须红（这是对 UTE-12 的可证伪化）。
- **旧路径对照**：同一脚本在 legacy 路径跑，判定相同（允许差异，但必须记录）。
- **退役条件**：legacy FS Family 只在 G5 退役，且必须先有 G1-S4 的基线 + 本切片的等价证据。**FS 的 PASS 不推出** Bash/PTC/PTY 的隔离或恢复安全（见 §3）。

### G1-S2 — `llmProvider` 路由透传（语义变化，需 owner 批准）

- **代码**：受控 `ctx.web` 代理**逐字段透传** `WebSearchRequest`（含 `llmProvider`），只在拒绝时短路。
- **真实负控**：
  1. **mutation**：把代理改成"白名单复制 `query`/`maxResults`"→ 路由断言必须红。这条是本切片存在的理由：没有它，"透传"是口号。
  2. deny 时零连接（沿用既有 network 负控），且**带路由**跑——否则测的是另一条选择分支。
  3. 配置里钉 `searchProvider` → 路由被忽略，`configuredId` 分支胜出（证明我们没有偷偷改上游优先级）。
- **旧路径对照**：**不存在等价物**。rc.3 的 `WebSearchRequest` 没有该字段，所以这是**语义变化**：必须记录"新路径按路由选 provider，旧路径按配置/唯一可用选"，并由 owner 明确批准（[03](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) R3 的顺序：先记录再实施）。
- **退役条件**：无可退役项（新增能力）；若将来 Team 决定固定 provider，则本切片降级为"配置固定 + 披露"，并在证据里写明未覆盖按路由分支。

### G1-S3 — S1 结算事实

- **代码**：`EXECUTION_PREPARED → ADMITTED → DISPATCH_ENTERED → OBSERVED → SETTLED|UNCONFIRMED`，按 `ExecutionId` 幂等落 Journal；对外提供 `recordExecutionResult({callId,outcome})` 的**兼容投影**（读得通，不是第二权威）。
- **真实负控**：
  1. dispatch 之后、settle 之前 `kill -9` host → 冷启动后该 `ExecutionId` 必须是 `EXECUTION_UNCONFIRMED`，**不是** `SETTLED`、**不是**缺失。
  2. 同一 `ExecutionId` 重复回调 → 只有一条终态（第二次不覆盖、不新增）。
  3. rc.5 refusal 路径：模型流 `throw CONTENT_REFUSED` 之后，已 dispatch 的调用仍有 fact（对应 [02](./02-INTERFACE-DELTA-RC3-RC5.md) §1 的加严）。
  4. `exit 1` 且有文件写入 → `bodyOutcome=failed` 但 `effectEvidence=observed`（证明三轴没被压成一个 `isError`）。
- **旧路径对照**：旧 `recordExecutionResult` 投影读同一批调用，结论一致（差异必须记录）。
- **退役条件**：旧的"每个工具体自行解析退出尾文本"路径在 G5 退役，前提是本切片 + G1-S4 基线条目。

### G1-S4 — 旧路径回归基线（退役的前置）

- **代码**：一个**只读**套件：对每个将被替换的旧工具族跑既有场景，落 `verdict`（`.tsv`，一行一族：族 / 场景 / verdict / host pin / 证据路径）。
- **真实负控**：基线是"防退化"的，因此它自己也要有负控——故意让新路径改变一个语义（例如把 deny 改成 allow）→ 基线必须红。**基线不红 = 基线没接上**。
- **旧路径对照**：它本身就是旧路径。
- **退役条件**：不退役；它是别的东西退役的前提，直到所有族退役完成后归档。

### G1-S5 — S2 探测（只调查）

- **产出**：一份 memo，二选一——
  - **可达**：点名 rc.5 上某个**公开且可等待**的返回路径点（含文件/符号/调用栈证据），并给出薄 Adapter 方案；或
  - **不可达**：按 `CORE_SEAM_BLOCKER` 固定格式上报，附"公开 seam 排除表"（plugin `apply()` / `ctx.isolate()` / Service 代理 / `tools.register` / `ToolExecutor` / `ToolExecutionPipeline` / `tools/pre-execute` / `tools/post-execute` 逐条试过 + 失败原文）。
- **禁令**：本切片**不得**产出任何 fork、任何自建 Executor 来"顺手"实现顺序（那会撞 UTE-01/02 与 R3.3 的顺序）。
- **退役条件**：结论被采纳后，一次性脚本归档到证据目录。

## 3. 两条不可协商的规则

### R-S3.1 退役顺序

> **任何工具族都不得在新路径被证明等价、或语义变化已被记录并批准之前退役。** 两者都没有 = 不许动旧路径。

- "证明等价"= G1-S1/S2/S3 该族条目 + **G1-S4 基线在退役前后逐行相同**（除被批准的语义变化行）+ 真实负控在位。
- "语义变化已记录并批准"= 变化写进设计章节（带 `**[updated …]**` banner）+ owner 具名批准 + 证据里写明**未覆盖**的分支。
- 反向禁止：**不得**为了"让新路径看起来等价"而删除旧路径的场景或放宽负控。基线行数为零增长是事故，不是整洁。

### R-S3.2 效果域不可外推

> **FS 的成功永不推出 Bash / PTC / PTY 的隔离或恢复安全。**

- 四个效果域的 evidence 分开记：FS（读写路径、symlink/TOCTOU）、Bash（进程树、退出与终止确认）、PTC（直接 `node:fs/net` + 嵌套工具调用）、PTY（持久终端代际、stop 竞态）。
- 跨域外推的典型违规：用"write 被拒"证明"bash 也逃不出 workspace"；用"FS oracle 没看到越界"证明"PTY 没有副作用"。
- rc.5 的现状是：**只有 filesystem 效果域被观测**；process / PTY / network 三个域仍 `instrumented:false`（M7-B）。所以 G1 任何"完整隔离"的措辞都必须带 scope 限定。

## 4. 每个 PR 的通用门（与 `docs/runbooks/PR-DRAFT-FIRST.md` 一致）

1. 以 **draft** 开；只有 C1–C7 全成立才 `gh pr ready`，Ready 后 head 冻结。
2. 文档门：`docs-sync --check`、`test-catalog --max-uncollected 48`、`dispatch-tests --check`、`eb3-ci-required`、`lint-identities --diff …`（`new 0, resolved 0`）、`git diff --check`。
3. 证据文件只用 `.md` / `.txt` / `.tsv`；不新增 `.json`。
4. 每个切片一个 PR，**不合并切片**：S1 与 S2 混在一个 PR 里，"谁的负控证明什么"会立刻失真。

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
