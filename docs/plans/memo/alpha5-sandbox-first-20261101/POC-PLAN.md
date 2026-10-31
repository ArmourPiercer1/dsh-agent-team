# Alpha.5 Sandbox-First PoC 计划（实验优先 / 不启动产品迁移）

> 本计划是 [ADR](./ADR.md) 的**验证方案**，不是“公共 seam 存在即成功”的论证；所有结果必须由本地真实 Host 实验填报。本地 Agent 已在进行 Service Realm 和 leaf-process OS sandbox PoC：**接收其完整证据与代码基线，避免重复执行和冲突写入**。不触碰原生工具实现，不批准更改当前业务生产路径。
>
> **基线**：仓库 `tests/paths.mjs` 的 DSH 0.2.0-rc.2 `639ed015397290b3745d163aafe02ffee4aa3f84`；如本地 Host 已变更，先记录环境并按测试规程重新建立可比基线。每个 PoC 记录实际 UTC、分支 SHA、Node/WSL/Linux/kernel、bwrap/Landlock 版本、Member/Blueprint、进程/目录身份与激活配置。不要将未来 Host master 代码代替钉死 Host。
>
> **执行纪律**：仅使用 `docs/TEST_METHODS.md` 允许的 World 和端口，禁止接触 `:3080`、用户 DSH_HOME、pristine Host 原树。一个独立 PoC 一个隔离分支/worktree；结果进入本计划的审计材料后才允许产品方案选型。超出现行 boot/测试限额须报告，不擅自扩额。单个失败不能直接 Fork 原生工具。

## 0. 决策顺序及候选

候选 A：**service-mediated**：原生 `tool-fs` 和 `web` 在隔离服务 Realm 内运行，经可信受限 `ctx.fs`、`ctx.web` 实现 I/O。

候选 B：**os-confined leaf**：原生 `grep/glob` 的 `ctx.subprocess.spawn`、Bash PTY、PTC 通过受限进程后端运行，原生上层算法保持不动。

候选 C：**os-confined whole-tool**（条件性）：对无法证明只使用公共服务的未知同进程 JS，在受限 Tool Host 运行原生插件，通过通用 IPC 与 Host 通讯；仅当 A/B 不足以覆盖用户希望接入的工具形态时深入研究，不提前开发全功能 DSH Clone。

A/B 的接入需能组合（例如 grep：受信原生 JS + OS 受限 rg）；不得把“只有一个模式可选”作为人为产品限制。

## 1. PoC-A：服务隔离、原生 ToolDefinition 的真实重用

### A1 — 真实原生装配

- 在同一真实 DSH Host 启动两个 Member，使用 `ctx.isolate('fs')`（必要时隔离 `web`、`subprocess`），加载**未修改**的原版 `tool-fs` / `tool-web`。
- 记录工具 `ToolDefinition` 的来源与注册 Scope；验证工具注册时捕获的 `ctx` 实际解析到了该 Member 的隔离 Provider，而非 Host 全局服务。
- 正控：同一工具名、两个不同 Member，在各自允许路径成功读取，交叉路径被拒绝；非 Team Agent 的原生行为保持不变。
- 负控：更换插件注册顺序、复用 scope、HMR/撤销、晚注册同名工具、PTC nested dispatch；原生 body 不得在拒绝后运行。若 DSH public seam 无法保障，记录 **精确 CORE_SEAM_BLOCKER**，不能用 Guard 事后拒绝代替。
- 产出：注册图与运行身份轨迹、原生 ToolDefinition hash/provenance、真实调用结果、Host startup/teardown 证据。**仅能证明受控服务路径，不能证明同进程任意 JS 受控。**

### A2 — FS 能力与读写细节

- 实现最小 **Provider 层**原型（不是 read/write/edit 工具替代体）。权限检查覆盖本轮涉及的内容读/写、resolve、list、stat、lstat、watch、二进制读取、流读取、edit/write 内部隐含旧内容读取（按真实后端能力逐项登记）；未覆盖功能显式 UNSUPPORTED。
- 目录配置：只读目录 A；读写目录 B；不可见目录 C；相同路径多写法、软链接、硬链接、替换、移动、mount alias、相对/绝对路径、`..`/空白、大小写与多线程竞态。
- 正控：原生 read 读取 10 MiB+ 文件的中间窗口，结果及流式内存行为对照原生 Host；原生 write/edit 在充分授权时可运行。不得沿用 Team 现存 1 MiB **源文件**拒绝限制。
- 负控：读不到 C 的文件正文、不能写 A、无读权限时不能因 write/edit 的 diff/旧内容观察获得额外读取授权；权限变化后旧缓存不再放行受禁资源。
- 对存在性、stat、文件名等 metadata 侧信道如不能实施完整限制，必须逐项披露，不得以“读白名单通过”声称全部信息不可见。

### A3 — Web 受限 Service

- 保留原版 `web_fetch` 与 `web_search` 的格式、结果、provider 选择、取消及超时；经公共 `ctx.web` 服务实现联网 allow/deny。
- 负控：未授权联网时初始请求、重定向、DNS、IPv4/IPv6、代理路径均不得产生 Member 数据面出站效果；如平台无法阻止某类 Socket/IPC，应披露精确例外。主 Host LLM 流量不得被误杀，亦不得成为任意 Member 的联网转发代理。
- 受信外部搜索 Provider 与远端执行的内部网络不宣称已经被本机约束。

## 2. PoC-B：最小 OS-confined leaf / 真实原生行为

### B1 — 原生 grep/glob 的公共服务接缝

- 使用原生 `tool-fs-search`，在其**不变的** `ctx.subprocess.spawn` 接口后挂受限 `SubprocessRuntime`。不得写 `grep-executor`、改 `grep.ts` 或仅在入口解析 argv 后手工回放工具输出。
- **关键限制**：上游 `spawn(spec)` **同步返回** `SubprocessHandle`，而 `ctx.sandbox.confine()` 为异步。分别试验：预编译受限 launcher、同步可返回的句柄转发层、真实受限进程后端；要验证其错误/取消语义，不许改为 `async spawn` 冒充兼容。
- 原生 `rg` 无改造，真实子进程测试：普通匹配、无匹配 exit=1、非法 regex、输出过大/Spill、超时、取消、并发和进程树回收；对照原生结果的格式、错误代码及可观察生命周期。
- 权限负控：可读目录检索，受限目录内容/文件名不应被泄露到承诺保护的输出；用故意跨目录软链接、shell preprocessor/配置、继承 FD、子孙进程尝试绕过。区分“rg 不显示文件”与“内核实际拒绝”证据。
- 不允许用 `cwd` 或用户环境变量作为可信 Member 身份。

### B2 — 持久 Bash / PTC / 外部 CLI

- 原生持久 Bash 的 `ctx.terminals`→PTY Backend 与 `ctx.sandbox.confine` 路线；保持单会话多命令、当前目录、前后台进程、退出码、PTY、Ctrl-C、超时及关闭语义。`danger-full-access` 或持久策略切换不得突破 Member 上界。
- 原生 PTC Node 子进程透过同一 OS 边界；验证 nested tool 的准入与可用服务，且工具数据面不得通过 Host IPC 获得超限文件/网络权限。
- 全新第三方 CLI 不写 tool-specific executor：只配置通用 command entrypoint 与 MemberPolicy，正确生效读/写/网络权限；改变 CLI 二进制不要求 Team 代码变动。
- 网络 deny 测试包含实际 TCP/UDP/DNS、IPv4/IPv6、localhost/Unix Socket/Host 代理边界；若 OS backend 在平台无法覆盖指定承诺，必须产生 UNSUPPORTED 或受控失败。

### B3 — 单次审批与进程权限上界

- 同一 Member 同时运行两个调用：调用 1 获单次路径扩权、调用 2 未获授权；后者不得读写该路径。调用结束后调用 3 不得继承权限。
- 持久 shell 不能凭新的单次 grant 扩大既有 Landlock 进程权限；只能新建权限受限域或经经过验证的可信 I/O 服务。
- 蓝图授权收紧时，必须确保此前启动且仍存活的进程、后台工作/子进程不会继续被误判为拥有新权限；测试实际 kill/drain/restart 并标注不能追回已发生效果。
- 测试新旧 source registration、Scope 变化与一次性审批在完成前被撤销的时序；不把“请求取消”当作 OS 进程已终止。

## 3. PoC-C：仅在必要时的完整 Tool Host

- 使用**一个不会调用 `ctx.fs` 的最小未知 JS 工具**（直接读文件 / 直接 Socket）作为负控。正常 service-mediated 执行必须明确宣称 `TRUSTED_ONLY` / 不保证隔离；不得误认为 Provider 可以截获任意 Node API。
- 将未经修改的工具插件装在可隔离的独立 Tool Host：通过通用工具名/参数/调用 ID/信号 IPC 访问；测试 Host 服务依赖、输出、失败、回调、超时、HMR 与关闭；要确保子进程与 IPC 不反向突破成员权限。
- 若无法透明装载该工具，仅报告 `WHOLE_TOOL_UNSUPPORTED`，无需实现专用工具逻辑或为本轮所有内置工具完成 Tool Host。
- 若已有 Agent 的 PoC 已通过 A/B 且当前场景不要求未知同进程 JS 强制隔离，可将 C 标记 **DEFERRED**，不得因此扩大 A/B 的安全承诺。

## 4. Performance 实验（按真实开销拆轴）

对比以下执行形式，必须对同一 Host SHA、相同输入、相同热/冷状态、相同并发数进行测量：

1. pristine 原生工具，无 Team 扩展。
2. Team 已实现旧路径（仅用于回归比较，不作为未来设计准入）。
3. `service-mediated` 原生工具 + Provider 权限检查。
4. `os-confined leaf` 原生工具 + 真实 OS Runner。
5. 可选：whole Tool Host 冷启动与常驻热实例。

用统计量 `p50 / p95 / p99`、绝对延迟、额外 CPU、RSS、峰值内存、启动次数、产物大小报告；场景至少包含：1 KiB 文件、10 MiB 文件的短窗口、1000 小文件 grep、1 GB/大树搜索（资源不足可缩减并披露）、短 Bash、持续 Bash 第 N 条命令、短 Web 模拟调用、连续 1000 次无效果准入、并发 1/4/16 及一次性授权修改。

**禁止伪造速度阈值**：PoC 首先产出数据及对比，不将他处测得的“bwrap 10 ms”直接写作本机保证。结构性 Gate 是不能引入不必要的 Node/完整 DSH 冷启动；是否达到上线性能需在实验后另行裁定明确预算。测量分解为 `policy-check`、`service-dispatch`、`bwrap/landlock setup`、`actual tool process`、`Tool Host startup`、`IPC` 六轴。

## 5. PoC 判定矩阵与报告契约

| 门禁 | READY 的证明 | 失败时的处理 |
| --- | --- | --- |
| native integrity | 原生包 SHA/源码零改造；原生格式/取消/错误正例 | 重做 Provider/调用装配，不准重写 tool |
| A service-mediated | 真 Host 同名原生工具+双 Member+隔离 Provider+并发负控 | `SEAM_BLOCKER` 或 `TRUSTED_ONLY`，不宣称通用强隔离 |
| B os-confined | 正式启动路径覆盖、实际 OS 拒绝、生命周期/权限撤销 | 记录可复现缺口、改通用 Provider 或标记 UNSUPPORTED |
| network boolean | allow 正控 + deny 全部已声明传输的真实负控 | 禁网能力不得宣称已覆盖 |
| one-shot | 并发/复用/撤销/进程环境分离 | 阻断有漏洞路径，不得暂时静默直通 |
| third-party | 新 CLI 无工具自研即可接入；未知 JS 可隔离或诚实拒绝 | 不扩张蓝图安全承诺 |
| performance | 同条件原生/Realm/leaf 对照与不确定度 | 需要优化公共边界，不能为了性能重写工具 |

每条 PoC 记录：`id, hypothesis, pinned host SHA, Team SHA, platform, tool provenance, member blueprint, policy, chosen mode, execution form, scope identity source, actual IPC/provider trace, expected I/O, observed I/O, positive control, negative control, error/cleanup outcome, benchmark raw data, caveat, verdict`。判定仅 `READY / CONDITIONAL / CORE_SEAM_BLOCKER / ENV_BLOCKED / UNSUPPORTED / NOT_TESTED`；**不得凭接口存在给 READY**。

“原生工具可靠”的唯一允许结论模板：

> 在 Host `<SHA>`、系统 `<环境>`、执行模式 `<mode>`、本报告列出的负控 `<IDs>` 中，未观察到访问越过蓝图规定权限范围的情况；不表示所有输入、插件或其他 Host 版本已经获得形式化保证。

## 6. 对接在途 Agent / 下一阶段输出

当前本地 Agent 的 Realm 和 leaf OS PoC 优先受理；读取其真实日志与 commit、确认上述缺口，再执行**差量**补测。不得抢写原 Agent 的 branch/world、不得自动新开并行真实 Host 启动影响预算。

唯一结束交付：`POC-RESULTS.md`（后续工作报告路径由本地执行者确定）、真实机器输出、原生源码完整性核验、两模式能力矩阵、性能比较与 `go/no-go/defer` 决策建议。随后方可按 [TRANSITION-PLAN](./TRANSITION-PLAN.md) 讨论产品迁移。

本文件仅定义实验；未由本 PR 运行以上任何 PoC。
