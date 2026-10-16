# 05-ptc — Alpha.5 P0-5 PTC 腿（PTC-02-lite）实验笔记

- **角色**：独立实验代理（非协调者）。日期（UTC）：2026-10-16。
- **模型名逐字回报**：系统提示 powered-by 原文 = `You are a coding agent powered by the qwen3.8-flash-next model.`（模型名 `qwen3.8-flash-next`）。
- **基线**：T = `W/tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（前后 `git status --porcelain` 均空，见 p05-result.json `host_env`）。W HEAD 会话开始时实测 `d523a7d4af…`，运行 runner 时实测已变为 `c46ffb76e3…`（本代理零 git 写操作，移动来自仓外/协调者，如实记录）。
- **环境**：node v24.21.0，linux x64，Linux 6.8.0-142-generic。无模型密钥、无 Host 服务器、未触碰 :3080。
- **导入机制（约束合规）**：复用 `00-baseline/p00-fixture.mjs`（只读：`countingTool`/`tag`；其 5 个 junction 已存在，**未新增任何 W/node_modules junction**）。T 内其余包（`@deepseek-ai/dsh-ptc-runtime` 等）经 `p05-ai-hook.mjs`（ESM resolve hook）把 `@deepseek-ai/*` 映射到 T 内 `lib/index.js` 的**绝对 file URL**——即“绝对 file URL import 其 lib/index.js”机制对传递依赖的推广；测试工装面，非产品路径。

## TEST DOUBLE 声明（诚实纪律）

`ctx.ptcRuntime` 为本 runner 实现的**测试替身**（`@deepseek-ai/dsh-ptc-runtime` Service Definition 的抽象类子类，程序体在 fixture 进程内执行）。被测的 `run_code` 桥与 `ToolRuntime` 调度管线是 **pinned 生产 lib 真码**（`registry[TOOL_RUNTIME_SCHEDULER]` 全管线）。上游自己的 `packages/core/tools/tests/ptc.spec.ts:39-75` 用同角色 FakeRuntime，本腿不冒充真实 worker-thread 运行时，也**不**冒充真实外层进程 OS I/O。

## 命令与退出码

| 命令 | 退出码 |
| --- | --- |
| `node p05-runner.mjs`（05-ptc/ 下，2026-10-16） | **0** |
| `git -C T rev-parse HEAD` / `git -C T status --porcelain`（runner 内，前后各一次） | 0 / 0（porcelain 均空） |

幂等：runner 可直接重跑；重写 `p05-result.json` 与 `probe-scratch/`。

## 判定表（每条含判据/文件:行；细节 JSON 见 p05-result.json）

| Leg | 判定 | 判据要点（pinned 树文件:行） |
| --- | --- | --- |
| P05-PTC-1 config {mode:'ptc'} 挂载 | **PASS** | `ctx.plugin(ToolRuntime, {mode:"ptc"})` 公开可传 config：`ToolRuntime.static Config z{mode:native|ptc|both}`（`packages/core/tools/src/index.ts:810-813`）；同形状调用 = pristine `packages/core/tools/tests/ptc.spec.ts:68`。无需替代装配面、无 BLOCKED |
| P05-PTC-2 ptc 模式 run_code 保留传输呈现 | **PASS** | 模型 wire 面（`assembly.tools` = `ctx.systemPrompt.tools(wireSchemas)` 产物，system-prompt `src/index.ts:578-595,622`）= **仅 `run_code`**；collapse 过滤 home `index.ts:1022-1026`；`tools:ptc-only` 指令段存在（`:876-884`）；`tools:sdk` 段声明 grep（`:896-914`）。诚实区分：注册表投影 `tools.schemas(agent)` = [grep, run_code] **不**collapse（`:1260-1262`）；模型可见 run_code，同名注册禁令引用 L7 |
| P05-PTC-3 模型直调 grep 被拒 | **PASS** | `unknown tool "grep": only \`run_code\` is callable directly…`；`collapses()` `index.ts:1351-1352`、拒绝结果 `:1453-1472`；**原体计数 0** |
| P05-PTC-4 内层 dispatch 正控 | **PASS** | run_code 程序 `tools.grep({})` → 原体计数 +1、`tool/ptc-dispatch-start`/`tool/ptc-dispatch` 事件各 1、程序取回 `ran:grep@native-grep-double`。调度证据：binding 闭包读 `registry[TOOL_RUNTIME_SCHEDULER]`（`ptc.ts:557`）走 `scheduler.prepare/dispatch/finalize/finish`（`ptc.ts:622-638` → `index.ts:816-821`）= 与原生循环**同一** ToolRuntime 分级管线（pre-execute→guard→body→post-execute） |
| P05-PTC-5 guard deny → 原体 0（负控，Team-guard 类比） | **PASS** | `ctx.tools.guard`（`index.ts:1136-1142`，单调拒绝 `:1144-1154`）在 `prepare` 内命中（`:1519`，denial 体 `:1521-1530` 原样携带 reason）：外层 isError、guard reason 到达程序、**原体计数增量 0**、isError settle 事件 1 |
| P05-PTC-6 PTC-01 引用 | **CITED-PASS** | 不复跑（按任务令）。`01-routing/p01-result.json` leg `L7.PTC-01.reserved-run-code` = PASS（register/restrict 对 run_code 显式 throw；静态 home `index.ts:1080-1082`、`:1111-1113`） |
| P05-PTC-7 桥构造面 / 公开 seam 判定 | **PASS-CITED** | `createRunCodeTool(registry, RunCodeBridgeOptions)`（`ptc.ts:333`；options 为 registry 私有闭包，仅 `ToolRuntime.requirePtcTransport` `index.ts:944-961` 铸造）。**内层 dispatch 可公开构造**：实现 `ctx.ptcRuntime`（抽象类 `PtcRuntime`，`@deepseek-ai/dsh-ptc-runtime` 包根）+ `ctx.tools.execute({name:'run_code'})` 即可——P05-PTC-4/5 即执行过的正/负控对 ⇒ **该问题不需要 CORE_SEAM_BLOCKER** |
| P05-PTC-8 外层 Node 直接 I/O | **NOT_RUN** | 本环境无 ptc 外层 Node 真实进程（替身在 fixture 进程内跑程序）。补全需：真实 pinned host + worker-thread 后端（`T/packages/ptc-runtime/ptc-runtime-node` lib 在树）+ P0-4 OS 强制。禁止以本腿证据宣称 PTC-02 全量通过 |

## 缺口清单（NOT_RUN/BLOCKED 精确缺项）

- P05-PTC-8：缺真实外层进程 + OS 强制（bwrap/landlock provider，归 P0-4）+ 真实宿主装配；无 BLOCKED 项。

## 综合 verdict 候选

`run_code/PTC`：**BOUNDED-DEFER（严格保证待真实宿主外层进程证据）**；“内层调用经同一 ToolRuntime + guard 单调拒绝 → 原体 0”已在 pinned 生产码上以测试替身运行时证明；“模型可见 run_code / wire 面 collapse / 直调被拒”证明；PTC-01 引用 L7 PASS；**内层问题无需 CORE_SEAM_BLOCKER**。
