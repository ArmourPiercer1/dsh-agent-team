# P0-2 Search Strategy Tournament — 实验代理 notes（fixture 级）

- **角色**：Alpha.5 P0-2 独立实验代理（非协调者）。未 git commit（协调者负责）；未改任何源/配置/权限；pristine host `T=W/tests/deepseek-harness-test-use` 全程只读（runner 内每轮记录 `git status --porcelain` 行数 = **0**）。
- **日期（UTC）**：2026-10-15（runner `recorded_at_utc` 为准）
- **模型名逐字回报**：系统提示 powered-by 原文为 "You are a coding agent powered by the qwen3.8-flash-next model."（模型名 `qwen3.8-flash-next`）。
- **基线**：DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（detached，porcelain 0）；**本 runner 实测时 Team worktree HEAD = `c46ffb76e33c8ce097a84963c72a60d88a9d263e`**（p02-result.json `pins.team_worktree_head`；source-map.md 时点的 `d3c9760d…` 之后协调者已有并行提交）；node v24.21.0；真实 rg = `@vscode/ripgrep-linux-x64` **ripgrep 15.0.0 (rev 3a612f88b8)**（T/node_modules/.pnpm 下，已验证 v15.0.0）。工作树中 `p00/p01-result.json` 的 M 状态 = 并行实验代理重跑（仅时间戳/team_HEAD 字段），非本代理写入；本代理仅写 `02-search/`。
- **前置阅读**：`docs/ROUTER_RULES.md` §0；实施指南 §0/§1/§2/§3 P0-2/§4 SRCH-*/§5（全文）；`00-baseline/source-map.md`；`00-baseline/p00-fixture.mjs`；`01-routing/p01-runner.mjs + p01-result.json`；tool-fs-search 源码实读（src/index.ts、grep.ts、glob.ts、search-core.ts、direct-call.ts + 上游 tools.spec.ts fixture recipe）。

## 0. 复跑方式（幂等）

```
cd W && node dev/agent-workflow/evidence/alpha5-adapter-p0/02-search/p02-search-runner.mjs
# EXIT=0 ⇔ 全部断言 PASS；产出/覆写 p02-result.json + probe-scratch/（fixture-tree 重建）
```

junction：p00 五件套经 `ensureResolvable()`；本任务新增 2 个最小粘合 junction（同守卫模式，缺失才建）：`W/node_modules/@deepseek-ai/dsh-tool-fs-search → T/packages/fs/tool-fs-search`、`@deepseek-ai/dsh-subprocess → T/packages/subprocess/subprocess`（后者是 TEST DOUBLE 继承公开 `SubprocessRuntime` 基类所需——上游自身测试同款做法）。

## 1. TEST DOUBLE 与真实件的界限声明（INV-8/§1.2）

| 件 | 性质 | 声明 |
| --- | --- | --- |
| `FixtureSubprocessDouble` | **TEST DOUBLE**（extends 公开 `SubprocessRuntime`） | 薄真实传输 + **原生体计数代理**（原生 grep/glob 体的唯一 I/O 面 = `ctx.subprocess.spawn`，src/search-core.ts:238 —— 计数 delta 即原生体执行计数，未 monkey-patch 原生定义对象，避免破坏 direct-call.ts:26 身份判断）。**不是**生产 provider：无 env scrubbing、无进程树升级、无 grace ladder、无 managed teardown。 |
| `testDoubleConfine` | **TEST DOUBLE** | async 恒等：只证 confine-先行**时序**可行，**不实施任何 I/O 策略**；不据此声称任何受限读取/INV-5 保证（P0-4 域）。 |
| R3 composed adapter | Team-owned 实验件 | 包根 helpers + **真实 rg**；经 `node:child_process` **直跑 rg，披露性绕过 ctx.subprocess seam**（fixture 无生产该服务）。真实宿主路线应经公开 spawn provider（指南 §3 R3），本 fixture 只证 ToolRuntime 层组合装配与独占分发。 |
| rg 二进制 | **真实**（非替身） | v15.0.0，`resolveRgPath()` 解析路径 = 任务给定 `@vscode+ripgrep-linux-x64` 路径（runner 断言 argv[0] 全等）。 |

## 2. 观测结果概览

### SRCH-03（NATIVE 参照，12/12 PASS ≥8 例要求）
argv 组装镜像 `runRipgrep` 原文：`[await resolveRgPath(), '--no-config', ...buildXxxCommand(parseXxxArgs(args))]`，spawn cwd=fixture workdir，`stdio.stdin=ignore`（seam spec 同构）。每例 raw argv/exit/stdout sha/parse 后 value/expected-vs-actual 全存 `p02-result.json.srch03_cases`。
覆盖：C01 空匹配(exit1 成功语义) / C02 非法 regexp(exit2→SEARCH_INVALID_PATTERN 分类) / C03 glob 无匹配 exit1 / C04 grep 默认 hidden+ignored 排除(265 命中含 bin.dat 占位行) / C05 glob `--no-ignore --hidden`+VCS 排除(.git 不可见) / C06 绝对路径→toWorkdirRelative 相对化 / C07 相对目录 / C08 带空格名(argv 原样元素) / C09 超 100 文件(121>cap100，canonical value 全量) / C10 超 250 命中(260>cap250) / C11 非 UTF-8 命中行(base64 `bytes`→占位行) / C12 parse*Args 入参校验负控。

### SRCH-02（sync/async 形状，可执行断言）
- **(a) async 桥可行**（PASS，最小样例固化）：async execute 中 `await confine(Promise)` → `string[]` argv → spawn 成功。与原生形态同构的源码事实：`runRipgrep` 本就是 async，且 **`await resolveRgPath()` 就写在同步 `spawn({...})` 的 spec 字面量内**（search-core.ts:238-239；编译面 lib/index.js:173 同）——原生调用面**已经**在 spawn 前有 await 点，调用方层面 confine 先行不改变任何既有形状。命名注记：**不存在 `searchRg`**；搜索体 = `runRipgrep`（async）。
- **(b) sync seam 反例**（PASS，可执行）：不 await 时同步面只能拿到 `Promise` 对象（`instanceof Promise`、非 `string[]`）；同步拼装 argv[0] 字符串化 = `"[object Promise]"` → `spawnSync` **ENOENT（负控：rg 未运行）**；原对象直传 → TypeError。正控 = 同查询 awaited 后 exit 0。
- 同步调用面盘点（实读）：ToolRuntime 公开体路径全 async（`execute` index.ts:1369、`dispatchToolBody` :1564）；同步面 = ①服务契约 `ctx.subprocess.spawn` 同步返回 handle（fixture 实证非 Promise + S-07 静态）②`executionMode` 同步返回 `{kind:'exclusive'}`（调度分类，无 argv 语义）。仅固化观测，不提议 API。

### SRCH-01（R2 前置 + 替身组合装配）
- **R2 前置（缺失 subprocess 的确切可观测）**：fixture ctx 只挂 SystemPrompt+ToolRuntime 时 `ctx.plugin(tool-fs-search)` **不抛错**：正常返回 fiber，`fiber.state=0(PENDING)`（cordis PENDING=waiting for required services，fiber.ts:147-156 注释），`tools.schemas()=[]`，logger 无输出——**缺失注入的服务前置=插件悬挂零注册**，与上游自身测试 `"stays pending until ctx.subprocess exists (inject)"`（tools.spec.ts:257-262）钉住的形态一致。R2 所需的 `ctx.isolate('subprocess')` realm + per-call Grant 串联在 fixture 无服务条件下不可测。
- **替身实验**：TEST DOUBLE subprocess 提供后 fiber→ACTIVE、注册 `glob/grep`（装载期零 spawn）。P0-1 冻结接口复用：A 先 `restrict({deny:['grep']})`（A 遮蔽、B 仍见原生）再 own-layer 注册 **R3 型 composed adapter** → A 的 grep 走 Adapter 且 **NATIVE body 计数（double spawn delta）=0**；B 走原生（经 double 真跑 rg，spawn delta=1）；A/B **value 深相等 + content 文本相等**（`Found 2 matches\n\nalpha.txt\nLine 1: …`）；A 的 glob 未被遮蔽仍走原生（restrict 定向生效）。
- **已登记差异（不掩盖）**：A 无 `presentationMeta`（B 有）——`grepSearchMeta` 不在包根导出面（src/index.ts barrel 不含 presentation.ts），R3 卡片投影需自维护或接受 UI 卡退化（观测记录，非 API 提议）。

### SRCH-04（Spill/post-execute）= **NOT_RUN**
fixture 无 `spillStore` 服务且 agent 桩无真实 session 语义完整度：`trySaveFormattedResult` 需 `exec.agent.session.header.id` + `ctx.get('spillStore')`（search-core.ts:382-412）；spill 身份判断需与注册定义对象同一性（direct-call.ts:26）。缺项清单见 result JSON `observations.srch04`。按 §5 规则不计入任何路线正反证。

## 3. 首轮真实失败（诚实记录，非推断）

首轮 runner EXIT=1，三处真实观测/缺陷（均已修复并复跑绿）：
1. **C04 零命中**：`spawnSync` 默认管道 stdin + 无路径参数 → rg `--debug` 原文 `heuristic chose to search stdin`（读空 stdin 而非 `./`）。**原生 seam spec 的 `stdin:'ignore'`（search-core.ts:241-245）正是该行为的防线**——任何 argv 直跑组装配方必须显式处理 stdin（已作为 fixture pitfall 记入 result JSON）。
2. **C11 无命中**：初版 bin.dat 用 `0xff 0xfe` 前缀 = **UTF-16LE BOM**，rg 转码后不命中；改为非 BOM 非 NUL 的非法 UTF-8（`0x80 0x81`）后命中，`lines.bytes` base64 → 占位行按预期。
3. **S4b 崩溃**：`runRipgrep` 读 `exec.agent?.session.header.cwd`——`agent?.` 只护 agent 本体，agent 桩必须带 `session.header.{id,cwd}`（上游 tools.spec.ts 桩同构）；mintScope 补齐。

## 4. 我跑的命令清单（含退出码）

| # | 命令 | 退出码 |
| --- | --- | --- |
| 1 | 前置阅读批（ls/wc/git rev-parse/rg --version/node --version，多批合并） | 0（其中一次 `wc -l 00-baseline 外路径` 的 p00-fixture.mjs 路径不存在 → 该子命令非 0，随后经 ls 定位实际路径） |
| 2 | junction 树列举 + T rev-parse + rg 版本 + lib 面检查 + tools.spec.ts 检读 + cordis fiber 状态 API 检读 + executionMode 检读（read/grep 只读） | 0 |
| 3 | `node …/p02-search-runner.mjs`（首轮） | **1**（2 例 FAIL + 1 崩溃，见 §3；未 tee 文件，控制台输出留存于代理会话记录） |
| 4 | 手工 rg 复现 C04（bash 下 exit 0 有命中） | 0 |
| 5 | `node -e` spawnSync 复现（exit=1 读空 stdin 确认）+ `--debug` 定位 heuristic | 0（进程本身）|
| 6 | bin.dat 重制 + rg 验证 base64 bytes 记录 | 0 |
| 7 | `node …/p02-search-runner.mjs`（二轮，tee p02-run.log） | **0**（24/24 断言 + 12/12 例） |
| 8 | `node …/p02-search-runner.mjs`（三轮幂等复跑）+ result JSON 抽验 | **0** / 0 |

## 5. fixture 局限（= 非真实宿主，勿外推）

- plain node fixture over prebuilt 公共 lib：无真实 DSH Host、无模型、无 `ctx.sandbox`/`ctx.shell`/真实 subprocess provider/真实 spill/session。
- 未覆盖：per-call Grant 串联、`ctx.isolate('subprocess')` 真实隔离、Spill/post-execute（SRCH-04）、presentationMeta 投影等价、timeout/取消/进程树、并发、真实装配路径（S-12）、PTC 内层。原生安全保证未用 mock 出 GO——按 §5，本 runner 只产出 INCONCLUSIVE 级判定。
- 判定汇总：**grep/glob 族 = `INCONCLUSIVE(fixture-supports-R3)`（倾向 R3 候选，禁写 GO）；R2 = `fixture-shows-prereq-missing`（subprocess 服务前置缺失 + sync/async 形状差异实证）；R4 = 未获 Fork 资格（R3 未被最小反例否定）；SRCH-04 = NOT_RUN`**。
