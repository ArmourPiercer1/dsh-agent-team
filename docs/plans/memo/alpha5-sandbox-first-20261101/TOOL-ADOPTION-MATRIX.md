# Alpha.5 Sandbox-First 原生工具接入与验证矩阵（设计基线）

> **DRAFT / NOT TESTED**。本表是 P3-00 的**静态种子**而非运行时真实全部工具清单；一切 `Status` 初始均为 `PENDING`。必须在 pinned DSH `639ed01539` 的真实 `ToolRuntime`/Preset/动态来源下重新导出库存才能声称覆盖完整，禁止从名称猜测真正 I/O 效果。依据 [架构](./ARCHITECTURE.md)、[实施计划](./IMPLEMENTATION-PLAN.md)、[ADR](./ADR.md)。

## 1. 工具类型与统一执行路径

| 代表原生工具 / 类型 | 原生事实或待验证假设 | 推荐接入模式 | P2 代表测试 / P3 批量接入 | 最低验收 & 残余风险 |
|---|---|---|---|---|
| `read` | `ctx.fs.resolve/stat/readText/streamText`；上游负责窗口/呈现 | `service-mediated:fs` | P2-01 → P3-01 | 大文件中间窗口、正常渲染；禁读真实拒绝、双 Member；可信 JS 可直接绕 `ctx.fs` |
| `write` | `ctx.fs.writeText`，实际可能读取旧文件信息 | `service-mediated:fs` | P2-02 → P3-01 | 允许创建/覆盖、禁写不变、读写独立、原子写语义 |
| `edit` | `ctx.fs.editText` / guarded write | `service-mediated:fs` | P3-01 | 正常替换/版本冲突，禁写；工具读取旧内容也需读权限 |
| `read_image` | 原生 FS/Attachment 具体绑定待真实 trace | `service-mediated:fs` + 可能需要可信附件服务 | P3-01 | 原生像素/大小上界/工具展示等价；附件来源无法绑定则 UNSUPPORTED |
| `str_replace_editor` | 若在该 Host Preset 登记，具体写入服务待 trace | `service-mediated:fs`（有条件） | P3-01 | 保留原生编辑与原子写，逐工具拒绝 |
| `grep` | 原生 JS → `ctx.subprocess.spawn` → `rg --json` | `service-mediated:subprocess` + `os-confined:leaf` | P2-03 → P3-02 | exit 0/1、无匹配、非法模式、流/取消；真实 OS 禁读 |
| `glob` | 原生 JS → `ctx.subprocess.spawn` → `rg` | `service-mediated:subprocess` + `os-confined:leaf` | P3-02 | 目录/过滤/无结果、异常、禁读；不能退回裸 spawn |
| `bash` 持久 | 原生 `tool-bash-persistent` → `ctx.terminals` → PTY | `os-confined:leaf`，受信装配 `team-shell` Backend | P2-04 → P3-02 | 原生命令连续性、cwd/信号/取消、禁读写网、撤权/旧进程排空 |
| `bash` 瞬态 | 原生工具 → `ctx.shell` → `bash-sandbox` | `os-confined:leaf`，必要时最小 `bash-sandbox` Fork | P3-02 | 与持久终端分别验收，`danger-full-access` 不越 Member ceiling |
| `pwsh` 持久/瞬态 | Windows/Posix backend 选择待证实 | `os-confined:leaf`（可用平台） | P3-02（条件性） | 不虚称 Linux PASS 等于 Windows/Pwsh；平台不支持则 ENV_BLOCK |
| `run_code` / PTC | Node 子进程和嵌套调用 | `os-confined:leaf` + 受控 Host bridges | P2-06 → P3-02 | 允许/拒绝 I/O；nested tool、IPC/环境 FD/取消 |
| `lsp` / language server | Server 生命周期/启动位置待 trace | `os-confined:leaf` + scoped service | P3-02（条件性） | 持久服务受限，cwd/代码库只读、通信/退出，无法覆盖 UNSUPPORTED |
| `terminal_open/send/read/*` | PTY API 与 host service 依赖待 trace | `os-confined` 的已装 Terminal Backend | P3-02 | 终端 opening/发送/读/close/kill；失效不回裸 backend |
| `web_fetch` | 原生 `ctx.web.fetch` → provider | `service-mediated:web` | P2-05 → P3-03 | provider 选择、HTML 显示、禁网前置请求拒绝 |
| `web_search` | 原生 `ctx.web.search` → provider | `service-mediated:web` | P3-03 | source/truncation/provider error 兼容、禁网 |
| 本机 CLI（未来） | 通用 argv+stdio/cwd | `os-confined:leaf` | P2-07 → P3-04 | 不写 CLI 专属 Team executor 即可允/拒 |
| stdio MCP | MCP server 在本机进程执行；启动服务待 trace | `os-confined:leaf` | P3-03 | 子进程本地 I/O 受 OS 限制，RPC 取消、生命周期正确 |
| HTTP/SSH/Remote MCP | Provider 在远端执行，内部 I/O 不能由本机 bwrap 控制 | `trusted-delegation`，若无远端保证则 UNSUPPORTED | P3-03 | 本机联网入口可禁，但不承诺远端文件/网络效果被限制 |
| Goal/Todo/Jobs/Plan/Session 工具 | 主要影响宿主状态，无关工作区 I/O 不另限制 | Alpha.4 调用准入；若有实际数据 I/O 再路由可信服务 | P3-04 | 不复刻状态机，保留原业务行为和权限 |
| `present` / `skill` / attachment | 可能读取用户文件或宿主服务；不能按“无 I/O”猜测 | `service-mediated` / 可信宿主代理，待 trace | P3-04 | 上传/读取/渲染与来源能力分开；已知不受管的 Host I/O 标 CONDITIONAL |
| 未知同进程第三方 JS | 可直接 `node:fs`/Socket，不承诺依赖 `ctx.fs` | 默认 `os-confined:whole-tool`（有通用 Tool Host 时）否则 UNSUPPORTED；已信任可 `TRUSTED_ONLY` | P3-04 | **hash 登记非 sandbox**；whole-tool 未实施时不提供伪保证 |

## 2. P3-00 必填的真实库存字段

每个实际 ToolRuntime 记录形成单独一行；最少需要：

```text
toolName | actualPreset | sourcePackage/version/SHA | registeredDefinitionIdentity
scope/member/call binding | effective provider id | I/O dimensions
selected mode(s) | trust registry digest | P2/P3/P4 suite IDs
native output oracle | permission-effect oracle | C1/C2/C3 status
failure/cancel/teardown status | assurance label | exception & owner
```

- 当工具实际是外部代码、复数 Provider 或无可执行 body 时，标明来源，**不能按工具名称硬编码判定**。
- `PENDING / NOT_TESTED / ENV_BLOCK / UNSUPPORTED` 不能转写为 PASS。
- 工具实现变化、工具别名变化、Scope 重绑、Provider/Host SHA 改变应触发受影响的重新验证。
- 对已可信 `service-mediated` 模式只用 `TRUSTED_ONLY` 保证标签；在 OS 受控环境下还需实际拒绝测试才能写 `TESTED_NO_BYPASS_OBSERVED`。
- “所有 DSH 原生工具已受限”要求以真实版本下的**动态来源清单**完整覆盖及模式能力记录为依据，而不是本初始表的长度。

## 3. 每个工具的标准验收包

**正向（P3）**：原生 ToolDefinition provenance、参数输入/输出 schema、真实结果/错误、窗口与流/取消行为、必要的宿主服务、非 Team 参照与性能。

**权限（P3 最小拒绝 + P4 完整矩阵）**：每个工具实际执行的 `read/write/network` 维度至少一个真实允许和一个禁止用例（无法执行对应效果则注明 NOT_APPLICABLE），单次审批、双 Member、旧资源存活/撤销按实际能力覆盖。

**审计（P5）**：导入/注册/执行链路能证明不涉及修改 DSH 原生 ToolDefinition；失效、重绑定和前置拒绝的路径不允许不受限 fallback，别名/TOCTOU/FD/网络绕过依据用户接受的信任范围判定。

## 4. 门禁对应关系

| Gate | 实际证明 |
|---|---|
| G1 | Team 通用 MemberPolicy、可信注册、Service/OS provider、排他装配 |
| G2 | 每真实执行机制代表工具正向+基本拒绝 |
| G3 | 本表实际来源逐工具正向等价、最小权限负控 |
| G4 | 实际来源 × I/O 维度完整权限/审批/生命周期矩阵 |
| G5 | 对抗性测试、上游升级、性能、非 Team 回归、权威迁移授权 |

此表是 **P3-00 的输入**，不是 release coverage ledger 的替代品。真实执行结果应存入新的 `dev/agent-workflow/evidence/a5sf-*` 与 WorldFactory RUN 清单；不要更改已有的历史 Gate 证据。
