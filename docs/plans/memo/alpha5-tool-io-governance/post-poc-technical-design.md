# Alpha.5 — PoC 后技术方案完整设计：DSH 原生工具接管分类与执行控制
> **[2026-10-22 banner] historical / superseded-by `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md`** — 本文档的阶段状态与采纳状态（含 PROPOSED 提案）为记录时点，当前执行以该入口为准。设计约束/需求正文**仍有效**（本 banner 不宣告设计失效）；正文未改动。

**状态：实施选型规范草案（设计方向已获用户认可；NOT PRODUCT GO）。**  
**日期：2026-10-16；证据快照：PR #249 / `a2e741a02c4f0126f0aa6615c02c51877f7f3dba`。**  
**宿主固定基线：DSH 0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`。**  
**配套计划：** [Alpha.5 S0 + 9 PR 实施计划](./alpha5-s0-pr0-pr8-implementation-plan.md)。本文件是未来 Alpha.5 的设计规范，不是当前 Blueprint v3 或 DSH Host 的已发布 API，也不授权合并设计 PR 或修改上游代码。

依据：[Alpha.5 ADR `8](./ADR-alpha5-tool-io-governance.md)、[Architecture `14](./architecture.md)、[P0 原始选型报告](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/P0-SELECTION-REPORT.md)、[PoC 反例](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/negative-cases.md)、[Landlock 增补](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/notes.md)、[有界工具 Fork 债务](./tool-fork-debt.md)及现有 [Alpha.4 治理规范](../../active/alpha4-permission-governance/alpha4-permission-governance-spec.md)。

## 0. 最新证据的权威顺序与边界

证据的权威不是“最近一次 test PASS 即产品可用”。原始 PoC 记录保留完整；后续有明确反例或修正的记录优先于旧判定，任何 GO 均须满足本文与实施计划各自的真实 Host 门。

| 议题 | 原始记录或早期假设 | 本设计采用的最新事实 |
| --- | --- | --- |
| Scoped Adapter | 同名注册可能遭晚期重解析原体回落 | `restrict` 先于自注册 + 有序卸载避免了已测回落；错误撤 mask 次序确定性导致原体运行一次（NEG-1） |
| Coverage | Setup 时检查完成即可 | 真实 Host H6 的后注册未知工具确实执行（`dynRan=true`）：必须增加持续的 closed-world 最终 Guard |
| `grep/glob` | 原生工具体可能必须 Fork | 包根公开辅助函数的 R3 路线已有真实 ripgrep 对照；R2 仅缺服务前置实验，**暂无 Fork 资格** |
| Controlled FS | `realpath` 防别名足够 | 硬链接绕过已实证（NEG-11）；`(dev,ino)` 快照仅封已登记对象；动态别名/TOCTOU 尚未闭合 |
| Landlock | 最早被记为 `ENV_BLOCK` | 修复测试常量错误后 Landlock ABI v4 **文件读写域 OS_ENFORCED**；bwrap/mount/net namespace 在当前嵌套环境仍受阻 |
| 网络 | Landlock 成立即能 network deny | **错误**。Landlock ABI4 不是任意网络通信全隔离；`network:deny` 必须有独立证明 |
| PTC | 无法注册 `run_code` 即不可治理 | 保留传输不可覆盖；真实 Node PTC 外层与嵌套 Guard 已有 PoC，**每调用真实策略注入仍需专项验证** |
| LSP | 原生语言服务器只读 | 真实 Provider + 虚构 LSP 服务器复现同 Workspace 跨策略 PID 复用及任意 OS 文件读取；每成员独立服务装配仍需小 PoC |
| Web/Jobs/MCP | `NOT RUN` | 回环/mock 实验 10+12+8=30/30；真实外网、Job owner 隔离、远端保证仍无产品 GO |

**不可上升为已完成产品的事实：** P0 报告总状态 `EXECUTED-PARTIAL / P0 NOT CLOSED`；真实 Host Stage2b 10/10、H6 18/18 和独立 Reviewer PASS 是 *特定测试集* 的完成，而不是所有工具族安全合格。旧 `decision.md` 仍有 Landlock ENV_BLOCK、Web/Jobs/MCP NOT RUN 等过期项；S0 应制作唯一选择矩阵，引用修正事实而不抹除历史。

## 1. 架构不变量：一个 Team 权威，多个实际执行边界

1. **完整分发治理。** 对每个 Team Agent，`T_dispatchable(agent) ⊆ T_governed(agent)`，包括 Preset 继承、自注册、Team 工具、动态 MCP、复合工具和 PTC 内层调用；不能把 `tools.schemas()` 的模型可见集合当作全部有效执行面。明确 `deny` 也算受治理。
2. **不干预非 Team Host。** DSH 的普通 Agent 与无 `agent` 身份的 Host 调用并非自动属于 Team；Team 自己发起的子调用不得丢失可信 Agent 身份来走全局原生路径。恶意同进程 Host 插件/直接拿到 Host 文件系统的代码超出本阶段“可信插件”威胁模型，不得声称可以沙箱化。
3. **单一 Team 审批权威。** 复用 Alpha.4 `deny < ask < allow`、`ApprovalCase`、`teamHardEnvelope`、`permissionMutationEnvelope`、世代与 CAS；未引入第四层审批，也不允许 Core 的批准覆写 Team 拒绝。多项 Team-side Ask 为一次不可变 `RequestedEffectSet`；审批者必须合法覆盖**全部**效果。
4. **授权与强制分离。** Tool Policy 决定可否调用；I/O Policy 决定读、写、网络的真实范围；Assurance 从有效 Policy **推导所需执行能力**，不是可放宽权限的第二组开关。Provider 必须完整兑现其声称支持的维度。
5. **不回退、不重试副作用。** 授权、Grant、绑定或执行保证不可用时，工具体零执行；无默认原生-body fallback、无 Bash 故障后动态 Ask、无部分副作用自动重放。`shadow-run` 是真实受限执行，**不是** COW/rollback。
6. **领域权威独立。** Team 管“谁能发起”；受信 Domain Provider 在实际副作用处负责科研状态/CAS、HPC Job 或设备联锁的最终有效性。`TeamPermit ∧ DomainPermit`，任何一方拒绝均不能被另一方覆盖。
7. **安全边界诚实。** Trusted Host FS 中介只能保证走该中介的操作；Landlock 不能追溯旧 FD 或全面隐藏 `stat` 信息；本地进程沙箱不能管远端服务器的内部访问。

## 2. 接管技术的四个基础路线

| 路线 | 实现方法 | 允许使用情形 | 成功条件 | 失败与债务 |
| --- | --- | --- | --- | --- |
| **R1：Scoped Binding** | 对继承工具先 `tools.restrict({deny:[name]})`，在 Agent Own Scope 注册稳定同名 Dispatcher/Definition | **所有普通可注册工具的基础装配** | 原体被遮蔽；跨 Agent 不互扰；运行时持续 Guard；有序销毁 | 若公共执行接缝不能保证独占，精确 `CORE_SEAM_BLOCKER` |
| **R2：原生体隔离重装** | 通过公开 `ctx.isolate(service)` + 受信 Service Provider，在正确 Scope 重装原生工具插件 | 工具体经清晰 `ctx.fs`/`ctx.shell`/`ctx.subprocess` 接口产生全部相关效果，且 Grant 可安全传递 | 真实服务依赖全部 READY、无全局污染、并发/生命周期封闭 | R2 的 Service 缺失 PENDING 是**前置漏检**，非根本不可行；先转 R3 |
| **R3：公开辅助 API 重组** | Team Own `ToolDefinition`，调用上游包**根导出**的解析/渲染/构造函数，Team 自己处理危险 I/O | `grep/glob` 首选；其他原生体不能安全在 per-call Policy 下重装的工具 | 结果、错误、Spill、取消及真实效果与声明等价 | 某一 helper 不公开→最小粘合实现或上游公共接口建议 |
| **R4：有界工具级 Fork** | 独立注册下游工具级改造代码；仅复制必需工具代码、保留溯源/许可/升级监测 | 同一工具 R1+R2+R3 均以最小复现证明不满足**必要**保证且 Fork 可以修复 | 无 Core/上游原地补丁、无私有导入、独占路由、完整负控 | 产生具名 `A5-FORK-<family>` 技术债务；上游 seam 可用且等价回归后强制移除 |

**重要：** R1 是路由基础，不与 R2/R3 互斥；R2/R3 是工具体实现的替代方案。R4 不是“更方便就 Fork”，也不能修复原本属于 Core late-dispatch 或远端能力不足的缺陷。

### 2.1 三条独立执行维度

- `implementationOrigin`：DSH native / Team trusted extension / standalone runner / remote Provider；
- `executionBoundary`：trusted Host / confined subprocess / delegated remote；
- `assurance`：按内容读取、目录/元数据、写入、别名、网络目的地、继承/取消逐项记录机制、作用 Realm、可信根、证据与 `enforced | author-trusted | partial | unsupported | untested`。

不要再把旧 `native/custom/shadow-run` 写成互斥“安全等级”。某个 DSH 原生工具完全可能由 Team Own Adapter 启动 Landlock 进程，而第三方 Standalone Runner 可以采用相同 OS 限制。

## 3. DSH 工具的八类实际接管方式

下表按**谁真正实施 I/O**分类，不按工具名称推断副作用。

| 类别 | DSH 工具/方法 | 原生 effect 路径 | Alpha.5 的接管 | OS Sandbox? |
| --- | --- | --- | --- | --- |
| **A：可信 FS API** | `read`、`read_image`、`write`、`edit`、`str_replace_editor`（按子命令） | `ctx.fs.resolve/stat/listDir/readText/streamText/readBytes/writeText/editText` 等 | R1 + Team `ControlledFs`，以每调用 Grant 控制实际 open/metadata/write/输出；固定策略才考虑 R2 | **无须**对可信 Host 工具体另开沙箱；但依赖其可信中介 |
| **B：外部搜索进程** | `glob`、`grep` | `tool-fs-search` → `ctx.subprocess.spawn` → 真 `rg` | R1+R3：公开 parse/build/format helpers，Team 异步 confine 后启动 rg，自有 Spill/Result 适配 | **需要** Confined Process |
| **C：通用 Shell** | `bash`、`pwsh` | `ctx.shell.resolve/execute` → Subprocess/Job/Sandbox | R1 + Team ShellAdapter /隔离 `ShellExecutor`，先准入再建进程保护；保留工作目录、环境、job/超时协议 | **需要** Confined Process；不同 OS 不自动等价 |
| **D：保留的复合 Transport** | `run_code`（PTC）及其 `tools.*` 子调用 | ToolRuntime 内部保留工具 + `ctx.ptcRuntime`；子调用通过 ToolRuntime | **不能 R1 同名注册**：保留 DSH `run_code`，对外层执行实施可信 Runtime/Policy Gate，内层每次 R1/Admission/Guard | 外层 Node **需要**受限进程；内层按各工具自身路由 |
| **E：持久服务进程** | `lsp` | `ctx.lsp` → `lsp-stdio` 常驻实例池 → `ctx.subprocess.spawn` | Team per-Member/Policy/Realm 实例池 + Host 预读 `ControlledFs` + 服务器 Confined Spawn；R2 小 PoC | **需要**，且生命周期随权限变化 |
| **F：可信外部服务** | `web_fetch`、`web_search`、`job_output/list/kill` | `ctx.web`、`ctx.jobs` | R1 或受信 Provider Gateway；各自实际资源/目的地与 Job Owner 检查 | 控制器通常**不需要**新 OS 沙箱；远端效果由 Provider |
| **G：扩展协议与领域服务** | MCP stdio / MCP HTTP、HPC/RPC/研究状态/设备工具 | 本地 stdio 子进程、远程网络/领域服务或可信 in-process Plugin | 注册最终动态工具、全量 Guard；本地 stdio 用受限进程；远端经可信 API + Domain Authority | 本地 stdio **视能力要求需要**；本地沙箱**管不到远端** |
| **H：Team/会话内部工具** | Team 管理、委托、`todo_write` 等 | Trusted Host 内部服务/会话状态 | 已知安全归属与权限规则（包括明确静态允许的普通状态操作），复用 Alpha.4/域内部授权 | **不需要**，但不是一概 allow |

**工具列表的来源与范围**：固定 DSH 0.2.0-rc.2 实现；`move` 是可能的文件变更效果，不代表一定存在同名 DSH 原生 Model Tool。原生 Job 模型面以本版本实际暴露的 `job_output`、`job_list`、`job_kill` 为准，不杜撰 `job_start`。本表的 “支持” 均以执行 Provider 的保证矩阵和产品 Gate 判定为准。

### 3.1 A 类：Controlled FS 的权限映射

| 动作 | 最低所需效果 | 特殊条件 |
| --- | --- | --- |
| `read` / `read_image` | file content read；按操作加 stat/metadata | ``read_image` 的附件/渲染存储必须保持其授权身份 |
| `glob` 结果的目录展示（若可信 FS 搜索实现） | directory listing 与目标身份观察 | 无读权限不得用名字/元数据偷偷返回秘密范围信息 |
| `write` 新建 | parent write/create 与必要的存在性检查 | 不默认返回现有文件内容；存在性本身受观察政策控制 |
| `write` 覆盖且返回 `before/diff` | read existing + write replacement | 只有 write 权限时要么严格无旧内容输出，要么拒绝；不能通过 Diff 偷读 |
| `edit` | read target + write target | 原有 read-before-edit 观测前置仍须正确执行 |
| `str_replace_editor` view | read/list/stat 依具体子命令 | 子命令级 I/O，不把整个 editor 当成纯写工具 |
| `str_replace_editor` create/insert/str_replace | create/write，必要时 read old content | 同一授权内核，不允许读与写来自不同的可变作用域 |
| rename/link/delete/watch | 根据真实源/目标及观察/变更语义 | 不因工具 Schema 没有同名操作而遗漏底层副作用 |

**选型：** per-call 一次性 Grant 必须以可信 ToolExecution identity 直接绑定 Controlled FS，禁止 Agent 共享可变 `currentGrant`。优先 Team-own 受控执行代码/后端；R2 “将原生工具注入固定 Agent FS 服务”只有在每调用差异、异步任务、Grant/Result Identity 均能保持隔离时才允许作为优化。TS `node:fs` 在受信 Adapter 内实施的检查，不是对所有 same-process JS 的 OS 级隔离。

**文件对象身份：** 相对路径固定在 immutable Workspace（非当前 shell cwd），`~/` 属可信执行 Realm Home；拒绝相对 `..`，保留合法路径首尾空格；判定基于实际执行 Realm 的真实对象。NEG-11 证明单 `realpath` 无法拦硬链接。`(dev,ino)` 快照只能防编译时已知被禁 inode，不能涵盖动态换 inode / unlink / rename / check-open race。Linux 安全打开的候选为针对可信目录 FD 的 `openat2` + `RESOLVE_BENEATH` **或** `RESOLVE_IN_ROOT`（按语义择一）、`RESOLVE_NO_MAGICLINKS`、必要时 `NO_SYMLINKS/NO_XDEV`，再对实际 FD 做 `fstat`；不能把 `openat2`/`fstat` 当作任意硬链接/动态 Deny 的自动完整证明。被拒别名/检查-使用竞态若无法穷尽，某 Profile 必须 `IO_POLICY_UNSUPPORTED`，或者将资源树约束为受信管理、不可由其他主体添加别名。

**过程副作用：** 安全创建、临时文件及原子替换必须验证父目录/rename 两端的实际身份，保证无不经检查的 raw path write；如果强制保证依赖内核 API，测试应以实际 FS/FD 证据而非字符串过滤认定 PASS。对于不存在、刚创建、正在被替换的目标，要有明确“操作时决策”行为和失败类型。

### 3.2 B 类：`grep/glob` 的 R3 精确执行路径

`tool-fs-search` 的公开包根函数包括 `parseGrepArgs`、`buildGrepCommand`、`parseGrepMatches`、`parseGlobArgs`、`buildGlobCommand`、`resolveRgPath`、`toWorkdirRelative`、若干格式化函数；不要引用 `src/*` 或 ToolRuntime 私有调度符号。

`ToolDefinition.execute(args, exec)` 是异步的，故可以先完成 Operation Admission/Confined Process 准备，再调用 DSH **同步返回 `SubprocessHandle`** 的 `ctx.subprocess.spawn()`。绝对不在同步的 `spawn()` 内直接 `await sandbox.confine()`，也不通过可变共享 Grant 将另一调用的策略放大。所有 argv 是明确数组（无外层 shell）。

执行与返回数据链：

`parse args → canonical target/resource scope → OperationGrant → async build verified confinement → spawn real rg → collect bounded stdout/stderr → parse → normalize structured value → render/presentationMeta → optional SpillStore`。

**原生行为等价不可漏项：** 无匹配、非法 regex、二进制/非 UTF8、隐藏/忽略文件、VCS excludes、路径参数/排序、原始输出超限、搜索错误/超时/取消、PTC 内层调用、并发 Member；大结果 Spill 和 `tools/post-execute` 直接调用的**定义对象身份判断**必须由 Team Own Adapter 实现或等效补足，不能期望原生 listener 在替换 Definition 后自动处理。Spill 产物与其后续读取都要有授权和归属。

**R2 竞争路线：** `ctx.isolate('subprocess')` + Provider + 原生 `applyGrepTool/applyGlobTool`；必须验证所需服务 READY（Cordis fiber PENDING 不是“成功注册”），异步 confinement 与同步 spawn 的可信预准备，以及实际注册 Owner、取消与卸载。R3 通过产品等价门时不必因 R2 尚未解决就 Fork。

### 3.3 C 类：Shell / Confined Process

`bash/pwsh` 任意程序的文件/网络行为不能通过正则扫描命令文本可靠预测；在启动前，由操作提供经批准的**范围**（预设基础权限与 one-shot 扩展），由实际 OS/Provider 限制所有子程序。

推荐 Team Shell Adapter 或隔离 `ShellExecutor`，保留 DSH `resolve`/`execute`、同步/后台结果、Signal、Job ID、stderr/exit、timeout、用户审批语义。底层运行 `ConfinedProcessProvider`，不重新实现 shell 语法，不静默跳过原生 Read/Write/Network 约束。

**Linux 文件强制主力：Landlock。** 10-landlock-lanes 已验证 ABI4 read/write、fork+exec 继承、按进程域不可逆收缩；首选可信独立入口先编译并施加 Landlock 后 `exec` 不可信命令。可评估 fork-but-not-exec 的规则句柄交接作为受控优化。不能在主 DSH Host 调用 `landlock_restrict_self()`，也不能将未验证的用户空间检查冒充内核封禁。

**必须正视 PoC TOCTOU_A：** 预先打开且非 CLOEXEC 的 Secret FD 在进程自锁后仍可读。所有非交付 FD 必须关闭或置 `FD_CLOEXEC`；可信控制通道的 FD、环境代理和 Socket 的例外必须按真实 Provider 单列。测试“禁止路径可否被 **新** open”和“旧 FD 能否跨进程逃逸”是不同测试。

**不能偷换网络/元数据保证：** Landlock ABI4 本身不等于禁止所有 IPv4/IPv6/UDP/Unix Socket，不保证完整 `stat` 等元数据隐私，也不能按 hostname/IP 执行通用网络 ACL。若 Blueprint `read:restricted` 包含元数据（本设计沿用既定契约）或 `network:deny` 要求完整禁止，必须有额外经过验证的隔离视图/Network Provider，否则返回 Unsupported，**不能从“Landlock READ_FILE 已拦截”推导严格 Profile 全绿**。本测试宿主嵌套 bwrap、netns、uid_map 受阻，但并不表示其他受信 Runner 必然不可用。

Windows `pwsh` 的“部分写保护”不能等价于 Linux 强读隔离；功能按 Provider capability 按 OS 显式发布。

### 3.4 D 类：PTC 保留 Transport 的专门路径

DSH 将 `run_code` 保留在 ToolRuntime 内部；公开 `tools.register/restrict` 明确拒绝该名字，所以**不能**与 `read/grep` 一样同名接管。内层 `tools.*` 由同一 Agent 作用域重新进入 ToolRuntime，必须逐调用 Admission/ClosedWorldGuard；外层 Node 进程直接 `fs`/`net` 访问则由独立受限 PTC Runtime 负责。

需在 PR6 验证 `ToolRuntime` 自有根 `ctx` 对 `ptcRuntime/sandboxPolicy` 的读取与 Agent 作用域策略交接：可信 root/scoped provider 或公共 `tools/execute` around seam 是否能把 **精确本次** `OperationGrant` 传给真实 NodePtcRuntime。测试必须包含并发 Member、不同 one-shot scope、outer code 直接 I/O、inner deny、父取消/子调用排空。不得用模型编写的 `code`/env 自称 Grant。

- **PoC 成功**：保留上游传输、Team Own 受限运行时；经真实 Host 验证的 Profile 才启用。
- **公开接缝不存在但单独可运行的 Team PTC Runtime 可用**：使用受信进程 Service 替代，同样不得修改 Core。
- **均不成立**：严格 Profile 中 `run_code` 明确禁用；记录 precise blocker / 上游 seam，不宣布普通 native tool 失败。

### 3.5 E 类：LSP 持久池 + 有界二次 PoC

PoC 06-lsp 已在真实生产 `lsp-stdio` 池化代码、虚构 stdio server 下观察到：共享 Workspace 不同策略标签复用**同一个 PID**，服务器自行读被禁文件成功；原生池键仅 Workspace identity，未包含 Member/Policy。这足以判定**原生共享池不可直接作为严格 Profile 保证**，但未排除独立重装服务。

首先验证公开 `ctx.isolate('lsp')` / `ctx.isolate('subprocess')` 和 per-Member Provider 是否能在实际调用的 `ctx.lsp` 路由中生效。通过则池键至少包含 `memberInstanceId + realm + provider + workspaceIdentity + policyGeneration/hash`，生命周期随权限收缩取消/重建；Host 预读与服务器真实 I/O 分别走 Controlled FS / Confined Process。

若公开服务重装不能解决实际调用链，再尝试 Team Own LSP Adapter 和独立 Instance Pool（仅用公开协议接口）；若连后者所需的公开服务接缝缺失，**严格 Profile 默认拒绝 lsp**，同时产生可复现 upstream seam 请求。这里 Fork 的资格需要单独判断，不能因目前的危险共享自动 Fork Core。

### 3.6 F/G/H：Web、Jobs、MCP、Domain 与 Team 工具

**Web：** 工具调用范围与受信 `ctx.web` 网络目的地是两层授权；Provider 在首次请求、重定向每一跳、DNS/IP 变化、代理/本地地址/SSRF 上实施自己真实支持的目的地过滤。`web_search` 与外部搜索服务的实际通信目标不等于搜索结果 URL；不要把 URL Path、响应内容或远端二次访问误称为本地 ACL 保证。PoC 回环 10/10 不代替真实外网端点能力认证。

**Jobs：** `job_list/output/kill` 需要 Job Owner、创建时来源 Grant/ExecutionLease 与可信 Session 身份；`kill requested` != 已终止，未知状态与重试必须保持不确定性。不能因为 Job 输出是文本就绕过其所有权限制。PoC 12/12 未含完整 Member owner-scoped 实证。

**MCP：** 工具名动态出现、撤回、重注册、同名 scope 遮蔽均经过 closed-world guard。stdio MCP 是实际本地子进程，需要 Confined Spawn 保护其文件/网络范围；HTTP MCP 是委托远端，Team 只能约束请求/认证/本地调用，并要求可信远端 Provider 兑现其内部效果。任何测试 mock server 的强制行为不自动提升为第三方远端保证。

**Domain Authority：** 由可信部署绑定，科研状态版本/CAS、HPC Job 业务规则、设备安全限制在实际 effect commit 的服务端实施；Human Team 审批不是领域事实校验。模型不可取消 Domain Gate 或通过一般 Bash/网络接口持有真实设备绕行凭据。同进程可信自定义 Provider 的内部 I/O 属作者信任范围，非 OS 级安全承诺。

## 4. Scoped Dispatcher、授权与生命周期契约

### 4.1 装配：R1 的安全状态机（不是任意 HMR 顺序）

`UNBOUND → PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED`。

- `PREPARING`：绑定来自受信 Team Agent 对象的 Member 身份；**先安装**匹配 Team 的 closed-world 末端 Guard；对所有计划接管的继承原生名安装 mask；再注册稳定 Team Dispatcher；校验预设/MCP/Scope/输出定义和 Provider 能力。任一失败不发布该 Agent。
- `ACTIVE`：同名 ToolDefinition 形状稳定，内部切换不可变 Binding Revision；不得先卸旧 Definition 再任凭工具名回落。每次执行即使通过前置 Listener，还要在 Guard 与 Dispatcher 处检查绑定/世代/参数指纹、Grant、abort。
- `DRAINING`：阻止新操作和新 Ask，取消/排空在飞调用；维持 mask 和可信身份 tombstone。禁止任何“先撤 restrict”的 teardown。
- `TOMBSTONED`：旧 Agent 对象可能仍被外部 Promise/异步回调引用；仅对 Team Agent 的受信身份保持最终拒绝，不干扰普通 Host Session。若无法证明旧句柄已失活，不能安全移除遮蔽。
- `RELEASED`：无在飞 Body/ExecutionLease 且旧 Agent 不可再调用的证据成立后清理。外部长期 Job 的 Lease/Provider 必须先完成责任转移或终止。

**原生回落竞态 NEG-1**：因 ToolRuntime 在 dispatch 时晚期解析 Body，`restrict` 生命周期必须长于 Adapter 和全部可能的在飞/迟发分发。对于同一 Scope 的其他可信插件热注册/抢注，需串行装配或拒绝并发替换；不声称能够防御恶意同进程 Host 插件任意改写注册表。

**动态工具 NEG-12/H6**：现有 Setup Coverage Gate 仍做前置诊断，但绝不是安全最终闸。Team Agent 运行中的任何未知 `exec.name`、改变的 Binding 或不可验证身份均由**持续生效**、单调的 Tool Guard 拒绝，直到合法重新绑定。`tools/change` 用于无权限的重新校验/诊断，不代替执行时检查。`tools.restrict` 不限制当前 Own Layer 的新注册，所以必须有 final Guard。

**Agentless NEG-2**：没有 `exec.agent` 的正常 Host 调用不是 Team Agent；Team 的任何内部嵌套分发都必须传递其可信 Agent，否则拒绝 Team-origin 操作。不能承诺拦截 hostile same-process 插件绕过 Team 工具表而直接访问 Host 文件系统。

### 4.2 内部契约形状（概念类型，待 PR0 固定）

`ToolBinding` 包含 Agent/Scope Key、可执行 Tool 名与 Definition 身份、Provider ID/Origin、executionBoundary、assuranceContract、policy/authority generation、revision、状态；`ResourceRef` = `{realmId,kind,canonicalLocator,rights}`；`RequestedEffectSet` 为不可变 canonical effects，包含 tool invoke、read/write/list/meta/connect/Domain reference，具有 Fingerprint；`OperationGrant` 绑定 Member、tool Binding revision、参数 Fingerprint、effects、authority generation、call identity、一次消费、可选到期；`ExecutionLease` 绑定后台执行实例、进程树/远端 Job、scope 与取消语义，不会扩大原 Grant。

上面这些都不是 LLM 参数。Grant 不能做为模型可持有的可重放 Bearer；许可检查应复用当前 Alpha.4 Control/AuthorityCeiling，严禁另建不同语义的权限台账。

针对未知目标的 Bash 等进程执行，必须在启动前声明允许的资源范围，不能依靠解析命令文本列出全部将发生的文件调用。若依赖额外 Ask，则一次性审批的 **整个** `RequestedEffectSet` 必须在 Body 启动前完成；所有 Effect 逐一核验合法共同审批权威。审批平面“无匹配 narrowing 不增加限制”与扩权平面“无匹配不授予扩权权威”是 Alpha.4 两种不同规则，不能误合并。

### 4.3 拟定顺序（逻辑顺序，不断言上游新 API 已出现）

`Agent assembly → complete binding → per-call canonical effects → Team Admission + existing ApprovalCase → single-use OperationGrant → capability/Domain preflight → monotonic guard → actual stable Dispatcher → controlled FS / confined process / delegated provider → final domain effect gate → normalized ToolResult + evidence`。

对已执行副作用的异常：超时不表示没执行；批准一次不等于允许自动重试；父调用取消不保证远端 job 已停。Grant 失效与 Lease 的终止保证要分开记录。

## 5. Assurance/Provider 的硬交付边界

| 所需能力 | 目前 PoC 证明的内容 | 严格 Policy 的处理 |
| --- | --- | --- |
| Trusted FS per-call `read/write` | fixture 11/11、部分真实 Host | 需完全治理的 Tool Surface、对象/竞态边界与真实 I/O 验收；否则拒绝对应 Profile |
| 子进程中新打开文件的内容拒绝 | Linux Landlock ABI4 OS_ENFORCED | 可作为受验证 `fs.content-read` 能力，不冒充完整元数据保密 |
| 文件名/目录/`stat` 等全部观察禁止 | Landlock 不保证；PoC 仍可列部分目录名 | 额外隔离视图或可信路径中介；无则 `IO_POLICY_UNSUPPORTED` |
| Linux “禁止一切网络” | 当前 netns/bwrap 在本测试宿主受阻，Landlock 不涵盖全部通道 | 独立受信 Network Isolation Provider；未通过正负控时不启动要求此保证的命令 |
| 指定域名/IP/CIDR/端口/协议 | 没有通用已验证 Provider | 注册有确切能力的 NetworkPolicyProvider，否则拒绝 restricted 组合 |
| fork/exec 继承文件约束 | Landlock 继承已证 | 另测旧 FD、可信 control channel、进程树终止 |
| PTC direct Node I/O | 外层 NodePtcRuntime 真实进程 PoC | 仍需每调用 Grant 注入/OS 拒绝负控 |
| LSP server per-Member policy | 默认池危险共享已证 | 仅独立作用域/池经 PoC 成功后允许 Strict 使用 |
| Windows 对等严格保证 | 未证明 | 显式按 OS Unsupported，不宣称等价 |

Assurance 运行时必须有：(1) backend/OS/权限功能探测（不仅是 `bwrap` 文件存在），(2) 该 policy 能否被准确编译，(3) 每调用在**不可信 Body 前**完成的隔离建立，(4) 作用范围、不可管辖项和停止效果。缓存必须绑定实际环境版本/权限能力，不能使后端升级后旧验证自动生效。

**错误类型建议（尚未发布）**：`TOOL_BINDING_UNVERIFIED`、`TEAM_TOOL_UNGOVERNED`、`APPROVAL_STALE`、`IO_POLICY_UNSUPPORTED`、`SANDBOX_UNAVAILABLE`、`ADAPTER_DRAINING`、`DOMAIN_DENIED`、`EXECUTION_TERMINATION_UNCONFIRMED`。区分 Team deny、审批不存在、Provider 能力不足、Domain deny 和未知是否已发生副作用；错误不能为 LLM 自动重试/绕行开门。

## 6. 性能、维护与非目标

- **低成本路径**：可信 in-process FS 直接中介；`grep/glob` 保持单次真 `rg`，避免再实现搜索引擎；LSP 热实例只在同安全策略身份下缓存；shell 使用可重用宿主进程管理，禁止为了性能降低授权强度。
- **必须有对照**：原生 vs Adapter `small/large file, rg small/big tree, Bash startup, PTC outer, LSP cold/hot` 的 p50/p95、CPU、RSS、Spill I/O、进程启动成本；性能回退分为优化债务或发布阻断，不得变成放宽规则的理由。
- **维护**：禁止 Core patch、私有 API、`patch-package`、上游 checkout 原地修改、全局偷偷覆盖。每个实际工具级 Fork 由精确 public seam blocker 触发，登记原版 SHA、许可、最小 diff、审计者、测试/升级归责和清偿 PR；当前无实际 fork。
- **明确不做**：恶意同进程 JS 沙箱、通用污点追踪、全网络协议透明通配 ACL、跨域分布式事务、设备物理安全逻辑移入 Team、COW/Shadow Execute/rollback、未经验证的跨 OS 同等保证、运行中 Blueprint 自动演进。

## 7. 仍需最小 PoC 与结果分叉（不得阻塞已证基本工具）

| 剩余 PoC | 验证问题 | 成功后 | 失败/不可用后 |
| --- | --- | --- | --- |
| **D1** 动态分发和卸载的真实 Host 安全对照 | H6 未治理动态 Body 从执行→拒绝；NEG-1 mask 长于在飞执行 | 以 stable Dispatcher + ClosedWorldGuard 进入通用门 | 本类工具不开放；证明 public seam 本质不足才记 Core blocker |
| **D2** 文件真实句柄/并发与别名 | Safe open、hardlink、rename/symlink race、隐含旧内容、FS-03 并发 | 对通过的平台/Policy 启用明确 `fs` 保证 | 对不能精确实现的形态拒绝；不拿快照充永久保证 |
| **D3** 进程执行 Provider/FD/network | Landlock 自锁、闭旧 FD、真实子程序、metadata 和 network 独立负控 | 宣布**逐维**可实施的 capability | 对整个严格 Profile 缺一维即 fail-closed；切受信额外 Runner 而非裸进程 |
| **D4** 搜索原生等价 | R3 的 Spill、cancel、并发、完整呈现 | 正式选 R3；R2 保留可选 | R2 实际服务隔离竞赛；二者均严格失败才触发 R4 最小反例 |
| **D5** PTC 外层策略通道 | per-Member/per-call OS 文件网络效果与内层逐次 Guard | 启用符合保证的 `run_code` | 严格 Profile 中禁用；明确缺失 public seam |
| **D6** LSP per-Member 实例池 | R2 隔离 LSP+subprocess 是否被实际 query 路径使用，重绑是否终止旧 PID | 按 Policy/Realm 池化启用 | 严格 Profile 禁用，提交 upstream seam 材料；Fork 非自动 |
| **D7** Web/Jobs/MCP/Domain trusted edge | DNS/redirect、Job owner、动态 MCP、远端最终否决 | 仅支持已验证的具体 Provider/范围 | 按 Provider 失效关闭，无虚假全局隔离保证 |

以上 PoC 的实施位置、测试 ID、PR 合并门及不同结果的技术路线详见 [S0 + 9 PR 实施计划](./alpha5-s0-pr0-pr8-implementation-plan.md)。

## 8. 版本、配置与实施完成条件

**当前生产 Blueprint v3 是封闭 Schema。** 本文件新术语/`toolBindings`/`io`/`Assurance` 均不应被认为已可以直接写入 v3。先在 PR0 冻结内部类型及明确默认拒绝策略，PR8 再处理具备正式 ADR 的 schema vNext（**v4 只是候选版本号**）与迁移；任何版本变更不得静默扩权或修改 Alpha.4 已绑定的 Authority Envelope 生命周期。

一个工具能力只有满足以下条件才进入产品 Supported Matrix：准确的原生行为契约与安全范围、真实 pinned Host 的正/负控、真实执行层侧效、精确 Scope/Binding/Grant/Realm 证明、并发/取消/冷恢复回归、独立 Reviewer 复现同一 HEAD、无上游 Core 修改。其余明确 `UNSUPPORTED` / `BOUNDED-DEFER` / `CORE_BLOCK`；`INCONCLUSIVE`、单一 PASS 或 P0 Fixture 不等于 GO。

**设计总结：** Team 只管理操作权威与可委托边界；Controlled FS 与 Confined Process 兑现真正的执行约束；Domain Authority 持有领域业务的最终决定权。主要工具走 R1 + A/B/C 对应 Provider，`grep/glob` 实施 R3，PTC/LSP 单独处理，工具级 Fork 始终为证据驱动、可清偿的回退。
