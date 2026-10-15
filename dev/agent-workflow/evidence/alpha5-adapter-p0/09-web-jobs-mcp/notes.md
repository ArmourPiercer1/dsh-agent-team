# notes.md — Alpha.5 P0-9 web/jobs/MCP（fixture 级本地回环/mock 实验）

**模型（逐字）**：`You are a coding agent powered by the qwen3.8-flash-next model.`
**基线**：pristine test-use @ `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2），全程 `git status --porcelain` = 0 行（run-all.sh hygiene 复核）。
**授权面**：合成回环（127.0.0.1）与 mock（用户确认）；**零第三方外联**：全局 `fetch` 套回环 tripwire（非白名单目标=记录 BLOCK+拒绝，从未发出）；进程内删除 proxy 环境变量（HTTP(S)_PROXY=192.168.223.1:7897 已删除并记录于 result header，杜绝经代理出网）；不触 :3080；无扩权；无 commit。
**导入机制**：复用 00-baseline/p00-fixture.mjs 五 junction（cordis/dsh-scope/dsh-system-prompt/dsh-tools/dsh-llm）；额外包全部走绝对 file-URL import `T/packages/<group>/<pkg>/lib/index.js`（**零新增 junction**；realpath 去重保证与 bare import 同模块实例）。

## 三族在 pinned 树的原生定义与注入面（grep 亲验，先于运行记录）

| 族 | 包（pinned 位置） | 注入面 | 模型可见工具 |
| --- | --- | --- | --- |
| web | `packages/web/web`=WebRuntime Service（`ctx.web` seam）；`packages/web/tool-web` 工具层；`packages/web/web-fetch-http` 生产 'http' provider（另有 search-deepseek/exa/perplexity provider 未挂载） | tool-web `inject=['tools','web','systemPrompt']`（src/index.ts:25）；web-fetch-http `inject=['web']` | `web_search`/`web_fetch`（本轮 config 关 search） |
| jobs | `packages/jobs/jobs`=抽象 JobRegistry（`ctx.jobs`，直接装载**故意 throw**）；`packages/jobs/jobs-local`=LocalJobRegistry（进程内 provider）；`packages/jobs/tool-jobs`=模型面 | tool-jobs `inject=['tools','jobs','systemPrompt']` | **仅** `job_output`/`job_list`/`job_kill`（src/index.ts:311/352/372 grep 证实）；**pinned 树无 job-start 类模型工具**——作业由 producer（kind map bash/subagent）经 `ctx.jobs.start` 产生 → "独立 jobs 工具族"在 pinned=0.2.0-rc.2 的实际形态即此三工具+producer seam，如实记录 |
| mcp | `packages/mcp/mcp-client`（stdio/streamable-http→`mcp__<server>__<raw>` 公开名注入 ToolRuntime；传输经 `@modelcontextprotocol/client` SDK 2.0.0 自持 spawn）；`packages/mcp/mcp-resources` 资源面未扩 | `inject=['tools']` | `mcp__<serverName>__<rawName>` 动态 |

## 三族判定（fixture 级 → 最多 INCONCLUSIVE(方向性)，无 GO）

| 族 | 判定 | 关键证据 | 退出码 |
| --- | --- | --- | --- |
| web | **INCONCLUSIVE(方向性：supports 组合 Adapter)** — 10/10 PASS | A=restrict 先行+同名 Adapter 拿合成页 token；名单外（127.0.0.1:9 / 10.255.255.1）**在 fetch 调用点之前**被拒：invoker +0 / intercepted +2 / 服务器 access-log +0 / tripwire 对该目标 0 尝试（未发起连接、未 DNS）；同/跨源重定向、declared/stream 超限、404-as-result、慢端点超时闭环；**B 不受影响**且生产 provider 对回环预 socket fail-closed（`WEB_BLOCKED_URL "resolves to a non-public IP address"`，access-log +0）；卸载顺序（Adapter 撤、mask 存→UNKNOWN 零泄漏）复证 | 0 |
| jobs | **INCONCLUSIVE(方向性：生产 service 直调闭环可行)** — 12/12 PASS | start/wait/kill/read/list/remove 全生产 LocalJobRegistry 直调：completed（ring chunks+result 一次性）、kill（stopping→killed，reason 逐字达 producer、并入 detail）、failed、throwing-starter 零注册（list 3→3）；无 controller 时 start fail-closed 原文；三工具经 ToolRuntime 执行 PASS；P0-1 装配结论在 jobs 注入路径复现（A=Adapter/B=原生）。owner-scoped 隔离腿 **NOT_RUN**（缺 dsh-agent，生产 fail-loud 原文 `"background job ownership requires the agent registry (load @deepseek-ai/dsh-agent)"` 已录，不伪测） | 0 |
| mcp | **INCONCLUSIVE(方向性：MCP 注入路径与 P0-1 结论一致)** — 8/8 PASS | 生产 mcp-client 插件 + 手写 stdio mock（真 OS 子进程，pid 自报，`/proc/<pid>/cmdline` 亲验，pid≠runner）：tools/list→注册 `mcp__mock__echo`→tools/call 回声闭环；遮蔽复现：A=Adapter 且**子进程侧 tools/call +0**（原生 wire 未触），B=原生 +1（echo 携存活 pid）；dispose→注销+**全部 spawn 代际回收**（37=sigterm/45=stdin-end） | 0 |

## TEST FIXTURE / TEST DOUBLE 声明（INV 诚实面）

- p09-mcp-mock-server.mjs = Team-owned mock（NDJSON JSON-RPC 手写，实现 initialize/initialized/tools/list/tools/call(echo)/ping）；pinned 客户端/桥体为生产代码。
- web 合成服务器（3187 主 + 3188 跨源重定向 tripwire）与 Team Adapter = Team-owned fixture 代码；生产代码面 = dsh-web/dsh-tool-web/dsh-web-fetch-http（B 腿真实触达其 fail-closed 策略）。
- jobs producer = 合成计时器 producer（走公开 JobSpec seam）；kind='synthetic'（runtime 视 kind 为不透明命名空间；pinned JobKindMap 声明 bash/subagent）。
- 观测纪律：主证据通道 = 计数器（Adapter body、子进程侧 call-log、access-log、tripwire attempts），返回文本仅辅证（plan §1.2）。

## 已知观测（记录不断言，勿在此轮深挖）

- mcp-client supervisor 首代连接可被**静默换代**：child gen1 spawn 后 ~5ms 收 SIGTERM（预握手，无 warn/error 日志），gen2 服务；`reconnect.enabled=false` 亦复现（3/3 次）。断言面按"存活代际=echo 自报 pid，回收=全部 spawn pid"设计。换代根因 = 上游/装配面问题，超出本 fixture 简报。
- 宿主环境有 HTTP(S)_PROXY 指向 192.168.223.1:7897——fixture 进程内删除后运行（header.proxy_env_removed 留痕），保证回环腿不经代理。
- 端口注记：3187/3188 为用户本轮明文指定的合成回环 fixture 端口（非 DSH 测试实例；TEST_METHODS 3180 族约束的对象是 DSH 实例，此处以用户明文指令为准并留痕）。

## 文件与复跑

- runners：p09-web-runner.mjs / p09-jobs-runner.mjs / p09-mcp-runner.mjs（幂等；退出码 0/1/2=通过/断言失败/环境）
- mock：p09-mcp-mock-server.mjs；共享：p09-shared.mjs；机制探针：p09-probe.mjs（BLOCKED-SKIPPED 腿记录于 header/probe-scratch）
- 电池：`bash run-all.sh`（本轮实测：10/10+12/12+8/8=30/30 PASS，三次重跑幂等；hygiene=端口 FREE/无残留子进程/T 树 porcelain 0）
- 结果：p09-{web,jobs,mcp}-result.json + p09-*-run.log；probe-scratch/ 为复跑残留 scratch（可删）

## NOT_RUN 清单（不计入正反证）

web：真实宿主 cordis.yml 装配、web_search 真实 provider、spill/取消在 web 体、代理语义与 Team 策略交互。
jobs：owner-scoped fence/隔离（需 dsh-agent+Session）、pull-source 真实子进程 producer、completion wakeup 投递。
mcp：真实第三方 server（禁外联）、streamable-http、mcp-resources、reconnect 稳定性窗口语义。
