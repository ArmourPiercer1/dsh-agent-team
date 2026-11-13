# 五、各工具族如何通过同一架构接入

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 接入选择是服务机制，不是工具名分支
NativeBindingAssembler 接受声明式 `source(package/version/digest)`、`toolNames`、`requiredServices`、`executionMode`、`nativeModule`，使用 DSH 公开 `apply()`、`tools.register()`、`ctx.isolate()`，验证实际 ToolDefinition、延迟注册和服务捕获。它不是第三套工具运行时；每个工具在 Agent Scope 中仅有一个确认的实际来源。即便某个工具没有 I/O，也不得因名称而默认豁免其真实 Host 文件/网络效果。源清单见 [Alpha.5 Native Inventory](../../active/alpha5-sandbox-first/NATIVE-SOURCE-INVENTORY.md)。

## 2. 接入矩阵
| 工具族 | 原生逻辑 | 接入/Boundary | 限制与验收 |
|---|---|---|---|
| read/write/edit | `dsh-tool-fs` | Scoped `ctx.fs` | 真实 read/write，symlink、edit 内部读与原生窗口 |
| read_image/attachment | 原生 FS + attachment | Scoped FS + 显式附件入口 | 不能把附件读误归于 FS 自动覆盖 |
| grep/glob | `dsh-tool-fs-search` | `ctx.subprocess.spawn` → OS sandbox rg | 原生 spawn 同步返回，保留 rg 输出、退出与取消 |
| 瞬态 bash/pwsh | 原生 shell ToolDefinition | shell/subprocess → OS confined | 环境选择不能绕过硬上界 |
| 持久 bash/terminal | 原生 persistent ToolDefinition/PTY backend | 受控 terminal + launch-time OS profile | 命令状态保留，按 revision 失效，不自动扩权 |
| web_fetch/web_search | `dsh-tool-web` | Scoped `ctx.web` | network deny 前无连接，Host LLM 通道独立 |
| skill/present | 原生工具 | Scoped FS/skills/attachment | 根据真实 I/O trace 检查第二服务 |
| PTC run_code | DSH PtcExecutor + ptc-runtime-node | PTC 本地程序 OS 域；嵌套调用共享 Pipeline | 直接 Node I/O 和工具内部 I/O 双覆盖 |
| 本地 MCP/LSP/CLI | 原生 provider/协议 | Scoped subprocess/OS 域 | server 进程及后代、FD/UDS/IPC 负控 |
| 远端 MCP/API | 可信传输 | Web/net egress 准入 | 不能约束远端进程内 I/O，记录 delegated |
| Goal/Todo/Jobs/Workflow | 上游 Host Domain | 领域原生授权 + 实际 I/O 的服务面 | 不复制状态机，按可核验 Domain owner 分类 |
| Team 自有 team_* | Team 业务工具 | 共享原生 Pipeline + Team-domain APIs | 不把团队控制操作错归为 FS Shell 工具族 |
| 未知 JS | 部署者审阅并登记来源 | 只有可信服务能验证时使用 service-mediated | 未知同进程直接 Node I/O = UNSUPPORTED（whole-tool 不实现） |

## 3. 统一 FS/Web
为 Trusted JS 绑定受控 `ctx.fs` 与 `ctx.web`。FS Provider 在真实操作边界评估路径、读/写轴、PolicyRevision；Web Provider 在真正网络请求前评估 network allow/deny。Web 上游 provider 选择、重定向、代理与远端服务的副作用另行披露；禁网不能因为 Host LLM/API 要联网而失效。Ctrl 服务使用独立可信 Host 能力，不可作为工具转发代理。

## 4. 统一 Process/PTY
`SandboxGateway` 提供 Profile preflight、真实 launch、进程租约、termination confirmed、FD/UDS/IPC 证据。保留原生 `ctx.subprocess.spawn(): SubprocessHandle` **同步**签名与 `spawnTerminal` 的异步 PTY 合约；应预编译 Profile 或以同步句柄立即成立的方式适配，不得直接将 async confine 返回给同步接口。持久 Bash/PTC/LSP/MCP 在进程创建时固定 Profile；旧域不能为新一轮单次批准就地扩权。

## 5. PTC 特别路径
`PtcExecutor` 外层 `run_code` 由 Host PTC runtime 执行本地 Node 程序；直接 `node:fs/net` I/O 由 OS Profile 控制；`tools.*` 嵌套调用重新走共享 `ToolExecutionPipeline` 和自身 ToolBinding/Guard，父级授权不可洗白子级权限。PTC 是保留传输名，不应被普通 ToolDefinition 注册/Shadow。新版 `PtcRuntimeNode` 支持 retained state，须与 Host 的 policy invalidation 与 worker release 机制核对。

## 6. 真实边界与保证
Landlock 独立 READ/WRITE、truncate、syscall、预打开 FD 等依 ABI/平台验证；bwrap `--ro-bind / /` + mask **不等于**严格 read allowlist；VFS `0300/0200` 可被同 UID owner chmod 并不构成通用只写不读保证。Network namespace 负责本地 OS 进程禁网；可信 Web Provider 的 deny 不应冒称内核隔离。详见 [第 9 节](./09-INFRASTRUCTURE-FORKS.md) 与 [第 10 节](./10-IMPLEMENTATION-GATES.md)。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
