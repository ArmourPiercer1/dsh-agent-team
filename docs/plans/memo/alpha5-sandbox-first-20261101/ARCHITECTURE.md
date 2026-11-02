# Alpha.5 Sandbox-First 技术架构（2026-11-02 Draft）

> **用户已裁决方向；技术方案待阶段 Gate 实证。** ADR = [ADR.md](./ADR.md)，任务 = [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)。仅更改 Team 外部插件与服务装配，不碰 DSH 原生 ToolDefinition、Core 或宿主源码树。Pinned DSH 0.2.0-rc.2 @ `639ed01539`。

## 1. 最小产品边界

`Blueprint(MemberCeiling, existing ToolBindings) → Member × Tool 全局有效的 read/write/network 硬上界`，调用准入继续来自 Alpha.4。只做这三项 I/O；网络对象约束为未来接口、不可配置/不可验收。工具没有 I/O 的只走 Alpha.4 调用准入。未知工具允许不兼容，不能默许无约束运行。

两种执行机制：**service-mediated**（可信同进程原生工具 + 受控公共服务）和 **os-confined**（真实子进程/PTY/PTC/CLI 在受限 OS 域）。它们可以组合，`grep` 正是可信 JS → 受控 `ctx.subprocess` → OS 沙箱化 `rg`。`whole-tool` 只是 OS 模式的候选内部实现，**不在 Alpha.5 交付中承诺完整 DSH 插件迁移能力**。信任由部署者工具注册表、来源摘要和安装绑定决定，Hash ≠ 防恶意 JS。可靠性措辞仅为「指定测试范围未观察到越界」。

## 2. 数据流、边界、进程生存期

```text
Blueprint Member ceiling + existing v4 toolBindings.io    Alpha.4 Tool Admission/Approvals
                |                                   |
                +--------- Policy Compiler ---------+
                                |
             MemberCeiling(member) ∩ ToolRestriction(member,tool)
                                |
             InvocationAuthority {member,tool,call,policyRevision,lease,withinCeiling}
                                |
                         Execution Binder
                            /        \
               trusted service       os-confined
                  scope              process launcher
              ctx.fs/web/            (Bash/rg/PTC/CLI)
              subprocess                 |
                  \-------> confined subprocess
                                |
                  native DSH tools return native result
```

- Member ceiling 是所有工具共享的硬上界；工具级 v4 限制可以进一步收窄，不能反向扩权。最终 `EffectiveIo(member,tool,call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member,tool)`；工具调用审批不扩大这两个硬上界。确需调整 ceiling 时走明确授权的策略变更并更新代际。InvocationAuthority 从现有一次性审批借用，不建立第二个 GrantStore；按调用的可信上下文绑定，不能用 argv/cwd 环境变量或全局 mutable currentMember 当唯一身份。
- 每次权限检查 ≠ 每次启动沙箱。Trusted Provider 对 I/O 检查调用身份、策略代际；OS Runner 在 spawn 前编译不可突破的权限上界，持久进程重用同一上界。单次 OS 扩权新建执行域；权限收紧对旧进程需停止/排空、不能声称既有副作用撤销。
- 禁网是 Member 工具**数据面**，不误关主 Host 模型网络；Unix Socket、host bridge、预打开 FD 与 remote-MCP 的执行边界须真实披露。OS 禁网必须包含 TCP/UDP/DNS/IPv4/IPv6 等已承诺类别的负控；无法提供后端就 UNSUPPORTED。
- 读/写允许已存在硬链接别名，按本次使用的授权路径生效；禁止路径不能直接打开，但不能承诺同 inode 的其他名字不被授权路径访问所影响。软链接越界仍做负控，原生 atomic-write 的 rename 语义须保留。Team 内部 authority/evidence 的完整性限制不受此放宽影响。

## 3. 五个公共模块与明确职责

| 模块 | 唯一责任 | 候选 Team 源码位置 | 不做什么 |
|---|---|---|---|
| Policy Compiler | Blueprint Member ceiling ∩ 现有 v4 toolBindings 约束 → 每次调用不可突破的 `EffectiveIoPolicy` | `packages/runtime/member-io-policy/` | 不重新实现审批器/工具效果解析 |
| Invocation Binder | 信任身份、调用代际及一次性许可、终止/排空 | `packages/runtime/member-io-policy/invocation.ts` | 不创建第二 Grant 账本 |
| Trusted Tool Registry | 源包版本/摘要、绑定代际、模式声明；HMR 重验 | `packages/runtime/member-io-policy/trust-registry.ts` | 不扫描证明 JS 无恶意 |
| Service-Mediated | 受控 `ctx.fs`、`ctx.web`、`ctx.subprocess`，可信工具原样装载 | `packages/runtime/team-services/` | 不替换 read/grep/web 业务 |
| OS-Confined | 最小受限进程后端、PTY/Node 子进程、取消与上下文绑定 | `packages/runtime/team-sandbox/` | 不复制上游 subprocess/PTY 状态机 |

这是**职责**而不是必须建立五个新类/包。先继承原版 `fs-sandbox` / `bash-sandbox` / `sandbox-local` 或公共 Provider；只在缺少安全接缝时维护小型基础设施 Fork，保留功能原样。新增文件/exports/packaging 仅在相应任务 Gate 执行，不提前修改根 `package.json`。

## 4. DSH 接缝（以当前固定源码为准）

| 工具类 | 真实调用链 | 首选方式 | 已知风险与 Gate |
|---|---|---|---|
| `read/write/edit` | 原生 ToolDefinition → `ctx.fs` （`streamText/readText/readByteRange/writeText/editText`） | 受控 FS Provider/必要时继承 `fs-sandbox` | 注册时 Scope、方法覆盖完全性、原生原子编辑和大文件窗口、write 内部读 |
| `grep/glob` | 原生搜索 → `ctx.subprocess.spawn` → `rg` → 原生解析/裁剪 | 受控 Subprocess Provider，在 OS 域运行 `rg` | `spawn` **同步返回** `SubprocessHandle`；`sandbox.confine` 异步，不可直接 await 改签名 |
| 持久 `bash` | 原生工具 → `ctx.terminals` → `terminal-bash` Backend → `spawnTerminal` | `team-shell` 后端/最小基础设施 Fork | 注册时 `ctx` 捕获、`danger-full-access` 越界、PTY/后台状态、进程树撤权 |
| 瞬态 `bash` | 原生工具 → `ctx.shell` (`bash-sandbox`) → `ctx.sandbox` | 最小 `bash-sandbox` Fork（条件性） | 原生后端模式越过 Member 上界、退出/流/取消 |
| `run_code/PTC` | 原生 PTC Runtime → Node subprocess/嵌套工具调用 | OS-Confined + 受控 Host 服务桥 | direct Node I/O、nested dispatch、host IPC 绕行 |
| `web_fetch/search` | 原生 ToolDefinition → `ctx.web` → Web Provider | 受控 Web Provider 或 scoped WebRuntime | provider 选择、重定向及 network deny、Host 联网不可被转借 |
| UI/Goal/Jobs 等 | DSH 受信宿主服务 | 仅调用准入或显式受控 I/O service | 若涉及用户文件/网络 I/O，不能仅凭名字豁免 |

上游 `SandboxPolicy` 只有 `read-only/workspace-write/danger-full-access`，不足以表达 Member 读白名单和禁网；避免改 Core 类型，在 Team 自己的受信上下文附加 Policy。现有 `sandbox-local` 的 bwrap profile `--ro-bind / /` 放开全盘读，不能原样使用为读限制实现。Landlock 的网络 ABI 不等于完整禁网。`ctx.isolate()` 只隔离 Cordis 服务，不隔离任意同进程 Node I/O。

## 5. Fork 的维护契约

- PR #26 `spill-local` disable + Team Provider 插入/继承已经证明「在外部插件替换一个公共服务」可实施；**不表示本次 FS/PTY/Subprocess 的 Member 绑定已经通过**。
- 先走公开插件装配/继承；不能满足时 Fork **基础设施**，保留原行为和签名，基于 DSH 固定 SHA、包版本、改动 diff、许可证及升级 Owner。Team 自己的 `cordis.patch.yml` 用 `disable+insert` 或 Member 预设下专用 `backendType`，不让两个服务实例争夺名字；非 Team 仍走上游原路径。
- 仅可 Fork 已验证的公共基础设施插件（如 `terminal-bash`、`bash-sandbox`、`sandbox-local`、`fs-sandbox`、`subprocess-local`）；**不是自动批准全部 Fork**。完整模块复制时保存上游文件 hash + 上游 diff 的最小化说明；支持继承优先继承。根 `AGENTS.md` 现有 vendor 禁令与用户新的有界批准存在文件权威冲突，正式生产迁移 PR 必须调整其界定，仅允许基础设施 Fork 且不容许修改原生工具业务。
- 每次升级上游 DSH：对照接口及原生黄金向量、重放最小 Fork diff、重跑受影响 C1/C2/C3。Fork 失败=受控路径不可执行，不静默落回原版。
- Team 原 `FamilyAssembly` 限定 `family-body/named-bridge` 是旧架构实现合同，不再是新设计规范。迁移需让原生 `ToolDefinition`/受控 Service 成为一等接入，不可强制开发 Team owned family-body 以匹配旧贡献 Schema。保留已有 Alpha.4 ApprovalCase/Guard/Control 的有效实现，删除/退役另起 Gate，禁止提前清理旧全部代码。

## 6. Blueprint 复用优先，必要增量扩展

**禁止预设必须新建 v5 全套权限语法**。当前 v4 的 `toolBindings[].io` 已经包含 read/write/network 与 allow/ask/deny、路径限制词汇，解析/映射已存在但生产 I/O 执行未完成。其 `owner/name` 定义工具绑定，不直接区分 Member。P1-01 先做三组对照：同一工具的 Member A/B 不同 ceiling；同一 Member 的 bash/read 有不同额外约束；Leader/新 CLI 也受 Member 上界。优先复用既有工具级规则、路径匹配器、Alpha.4 审批，并仅为**确实缺失的 Member ceiling 作者载体**增加最小字段/映射。

若 v4 封闭语法不能兼容新增字段，才考虑**最小加法式**新版本；保留 v3/v4 哈希和语义，不能凭字段名称复用去静默改写旧文档。v4 的 `network.restricted` 必须继续如实解析；新运行时只承诺 network boolean，若无法兑现旧文档的目的地限制，则受限调用应明确 UNSUPPORTED/拒绝或依授权的兼容策略，绝不把 restricted 直接当 allow。任何工具未写独立 I/O 约束时不能因此突破 Member ceiling；默认处理须在 P1 契约门禁明确。

## 6A. 跨平面一致性与真实策略消费

- 真实调用需要联结 `memberId + toolDefinitionIdentity + callId + policyRevision`，从 Alpha.4 准入到 Team Service/OS 后端全部一致。批准调用、拒绝其中一次 I/O **可以同时正确**，但 UI 与记录必须如实说明哪个层拒绝。
- Gate 需要**真实消费证据**，不接受仅 `plugin applied`：有效 Provider/Backend 绑定身份 → 相同调用的 `policy consulted` 决策记录 → 独立文件/网络效果 Oracle。缺失某一段即 FAIL，不能用 fake denial 文本代替。
- OS 域上界按 Member ∩ Tool 编译；持久 Bash 若需要改变 ceiling 必须安全重建，不能因工具自身复用进程继承上一调用的宽权限。
- 后续上游升级演习还需记录每个有限 Fork 的 patch 差分、冲突及维护工作量，而不止测试绿灯。

## 7. 验收与测试层级

| 层级 | 证据 | 覆盖 |
|---|---|---|
| C1 | 定向单元/接口测试、源代码哈希/导入/装配检查 | Policy/Identity/Fork ABI/单次 grant、路径许可、no-fallback |
| C2 | `tests/world-factory` 真实 pinned Host + 受限进程 + 独立 FS/联网副作用 Oracle | 原生正向+拒绝、不同 Member/并发、Bash/PTY/进程树 |
| C3 | 独立 World 并行、异常取消、升级/恢复、构建产物/包安装 | 跨机制、权限撤销、非 Team 对照、性能与 release |
| C4（可选） | 未知插件恶意代码/硬链接强隔离等超产品威胁模型测试 | **只披露信任边界**，不把不支持的保证强行加回需求 |

所有 REAL Host 必须遵循 `docs/TEST_METHODS.md`：`tests/deepseek-harness-test-use` pristine @ `tests/paths.mjs` pin、`tests/homes/<world>`、许可端口、真实沙箱二进制预检、`:3080` 零触碰。证据 verdict 显式 PASS/FAIL/ENV_BLOCK/UNSUPPORTED/NOT_TESTED；跳过不能冒充 PASS。P1-P5 阶段 Gate 见 [IMPLEMENTATION-PLAN](./IMPLEMENTATION-PLAN.md)，逐工具路线见 [TOOL-ADOPTION-MATRIX](./TOOL-ADOPTION-MATRIX.md)。

## 8. 严格上线范围

Alpha.5 内部候选 = P1/P2 + 目标原生工具 P3 正控 + 目标 P4 基础负控；最终公开候选 = P3 全承诺覆盖 + P4 全矩阵 + P5 重要漏洞修复及复验。任何时刻不能因“一种工具测试正常”宣称所有工具/所有直接 I/O 都已受限。

本 Draft PR 不改变现行 Authority 和已合并 PR #364 的运行合同。迁移的明确 Gate 写在 [TRANSITION-PLAN](./TRANSITION-PLAN.md)。
