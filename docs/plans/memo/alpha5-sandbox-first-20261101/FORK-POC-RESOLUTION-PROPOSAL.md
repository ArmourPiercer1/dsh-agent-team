# Alpha.5 Fork 路线复核与契约调整提案（历史审计记录）

> **HISTORICAL RECORD — 后续裁决已并入 [ADR.md](./ADR.md)，正式执行顺序见 [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)。本文件保留最初问题与当时判断作为审计证据，不再是未决裁决清单。**
>
> **原始状态（当时）：DRAFT ADDENDUM / NOT RATIFIED.** 这是对 [ADR.md](./ADR.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)、[POC-PLAN.md](./POC-PLAN.md) 的**候选修订**，不修改已采纳 ADR、不切换当前 `current-authority.json`，不允许据此启用受限 Host、合并产品代码或宣称 PoC 全部通过。
>
> 输入：用户 2026-11-02 提供的本地 PoC **缺口对照截图**（B2 绑定、全权限直通、瞬态 Shell、文件读粒度、恶意同 Realm 旁路、硬链接、生命周期），以及 Host `0.2.0-rc.2 @639ed01539` 源码。此仓库当前可见的设计 PR #531 内尚无截图所依赖的完整本地 PoC 复现实录；逐项结论为**源码核对 + 截图主张的设计评估**，不是独立重跑的 PASS。

## 1. 用户提出的两项契约修改

### R-T — Trust is an operator decision, not an OS sandbox

**接受作为候选**：部署者在 Team 启动前为特定工具/版本/服务组合登记可信来源及摘要；在工具绑定或调用时对照实际生效的 Definition / Scope / 版本。已选择且通过基础兼容性测试的受信 DSH 原生工具可使用 `service-mediated`（同进程、Trust-Based）模式。

**不可过度声明**：摘要仅确认“当前加载/绑定对象与被选择对象相同”，不是对代码行为的安全证明。相同代码可以直接调用 `node:fs`、`node:net` 绕开 Provider；Hash 不能修复 PoC 中三次复现的 same-realm bypass。正式保证必须写为 **`TRUSTED_ONLY / best-effort I/O mediation; no malicious same-process tool containment`**，不得把它标为 OS-confined。用户明确接受基于工具可信的部署假设。

建议登记条目：`{sourcePackage, version, digest, dependencyLockDigest, presetScope, toolName, definitionBindingGeneration, mediatedServiceIds}`。启动时校验包与依赖基线；调用前核对有效 Scope/definition generation 与信任登记，重绑定/HMR 则重新验证。不要每次调用重新哈希整个 `node_modules`（重试/延迟放大且无法防同进程恶意程序）。若实例的 JS 运行时不受信，该证明整体失效；禁止宣称“抗敌对插件”。

### R-H — Hardlinks are permitted path aliases

**接受作为候选**：Member 工作区的路径授权解释为**执行时被实际访问的路径名/受限 mount 命名空间**，而不是“该文件 inode 在全宿主只存在允许范围内”。因此，允许在有权限的路径下读取/修改已有硬链接，即使同一 inode 还有其他名字。

**必须明确说明的后果**：`/denied/secret` 和 `/allowed/link` 若为同一 inode，`read /allowed/link` 可能得到秘密内容；`write /allowed/link` 会改变 `/denied/secret` 的内容。这是经过用户明确接受的路径别名例外，**不能继续宣称“禁止读取/修改任何具有禁止路径别名的底层内容”**。路径下的软链接逃逸与硬链接不同，仍应按既定路径语义独立校验。

**实施边界**：该放宽只调整 Member 对用户文件的受控 I/O 契约与相应测试。不能顺手移除 Team 自身的 authority 指针、账本、证据文件的 link-count/原子写入保护；这些是 Team 内部一致性，不属于 Member 路径权限产品目标。历史 `controlled-fs` 的 `nlink===1` 规则及其测试是旧语义，需在未来独立迁移 PR 中显式退役/重标；本 Draft 不删除旧测试。

## 2. 从截图映射到最小 Fork 列表

| 已报告缺口 | 公开代码切入点 | 候选动作 | 判断 |
|---|---|---|---|
| B2 `terminal-bash` 注册时捕获 `ctx.sandboxPolicy`，每 Member 策略被锁死 | `packages/terminal/terminal-bash/src/index.ts` `BashTerminalBackend.spawn(spec)` 中 `spec.owner.session` 已知 | **基础设施 Fork**：在启动 confine 前，从 Team `MemberPolicy` 查询受信 `session→member` 映射；不再把原砂箱模式当作唯一权限 | 适合最小 Fork；需验证真实 Profile 中原版后端已被卸载/替代 |
| 原生 `danger-full-access` 绕过 `confine` | 同一 `terminal-bash` 的 `spawnArgv`；瞬态 `bash-sandbox` 有相似跳过 | MemberPolicy 始终是上界；原生模式只在这上界之内选择。禁止在 Team 受限路径上无保护 `return argv` | 可在同类启动插件修复；需 fail-closed 正反控制 |
| 瞬态 Bash | `packages/shell/bash-sandbox/src/index.ts` | 条件性小 Fork，将调用准入已批准的权限带至真实 `ctx.sandbox.confine` | 可以作为同源策略实现；不准复制 Bash 工具算法 |
| 文件级 read allowlist | `packages/sandbox/sandbox-local/src/profiles.ts` | 去除 `--ro-bind / /` 暴露全宿主的默认读面；按需要 mount 最小执行依赖、允许路径，并通过 Landlock `path_beneath` 规则约束受管访问；注意 **Landlock 不是“任意 inode 全局拥有者校验器”** | 需要 OS 真负控；不能只依据 Kernel 版本判定 |
| grep/glob 绕过 `ctx.sandbox` | `tool-fs-search` 直接调用 `ctx.subprocess.spawn` | **通用 Subprocess Provider 适配/Fork 候选**；保持同步 `spawn(spec): SubprocessHandle`、stdout、取消、树收束语义 | 上述三个 Fork **不能单独覆盖 grep** |
| 原生 read/write/edit 的 Provider 与调用权限 | `ctx.fs`、`fs-sandbox` | **通用受限 FS Provider**（若必要，局部 Fork `fs-sandbox`），保持 `streamText` 等原生方法 | 上述三个 Fork **不能单独覆盖 Host 内 read** |
| web_fetch/search 网络 allow/deny | `ctx.web` | 优先使用 DSH Provider 注册接口与受限 Web 服务，无需 Fork 工具；不能控制远端服务内部效果 | 最少可为独立 Gateway/Provider |
| same-realm 恶意 JS 绕过（三例） | JS 同进程直接系统调用 | 在 `service-mediated` 模式宣布 `TRUSTED_ONLY`；不自动构建完整 Tool Host | Fork/Hash 都不能消除此越界机制；产品风险按用户信任假设接受 |
| 一次性审批/HMR/kill-drain | Team Alpha.4 + MemberPolicy 执行域 | 既有 Team 权限与执行生命周期实现；变更时排空/销毁旧持久环境 | 与某个原生工具 Fork 无关；不能将权限扩张留在已活跃进程 |

**Fork 个数不是设计常量**：`terminal-bash`、`bash-sandbox`、`sandbox-local` 是已指明的起点，不是覆盖全部工具的充分性证明。增加任何 Fork 必须为服务/启动基础设施、能解释具体缺失的共享 hook；保留上游源码原始行为，仅修改已定位的少量策略注入点。

## 3. 安全与可维护性界面

### 3.1 MemberPolicy 只控制效果边界

```text
Alpha.4 approved invocation
  -> MemberPolicy {member identity, revision, read, write, network bool}
    -> trusted original tool through scoped public Services [TRUSTED_ONLY]
    -> or original tool's OS-confined leaf [OS_BOUNDARY_TESTED]
         -> original DSH result handling
```

所有 Team 限制通过该运行体施加；工具名本身不产生隐含授权，哈希登记只决定它能否进入受信执行模式。没有资格的同进程 JS 插件需在真实隔离下执行或标记 `UNSUPPORTED`；禁止把“可安装”误述为“可完全约束”。

### 3.2 预留网络拓展，但本轮严格布尔

`network: allow|deny`。OS leaf 的禁网可以通过 `bwrap --unshare-net` 或经过真实验证的等效机制；不能单靠在可能不支持 UDP 的 Landlock ABI 上禁 TCP 就声称“无法联网”。可信 `ctx.web` 的禁网需要在有效请求前拒绝。Host LLM/control 通道单独存在，但不能作为工具的任意转发代理。参考 Linux 官方 [Landlock 文档](https://docs.kernel.org/userspace-api/landlock.html)。

### 3.3 原生替换发生在真实 Preset/Backend 装配位置

上游 `TerminalSessionService.registerBackend()` 对相同 `backendType` 拒绝重复注册；原生 `tool-bash-persistent` 支持配置 backendType（默认 `shell`）。因此优先研究 **Team Preset 专用 backend type**，例如 `team-shell`，或在同一个作用域**排他替换**原版 backend 后再装 Fork：不能同时让两个同名 backend 竞争，更不能在 fork 失败时落回原版不受控 backend。利用上游 `agent-preset-registry` 的独立 preset scope，只影响 Team，不碰其他会话。

`SandboxPolicy` 原始类型仅 `read-only/workspace-write/danger-full-access`，不包含 Member 读集合/布尔网络权限：优先通过 Team 独立 `MemberPolicy` 服务向 Fork 传入编译策略，并在 fork 处对 `sessionId/owner` 做可信绑定，而不是修改上游全局类型/文档管理生成物。

### 3.4 与不变量的关系

- 保留 `A5-NATIVE-02` 与 `A5-BOUNDARY-01`：不改变 `ToolDefinition` 解析/业务执行算法，Fork 只动公共 Provider/Backend 启动策略。
- `A5-NATIVE-01` 的文字须精确：**禁止 Fork 原生“模型可见工具”业务实现；允许经用户审批的小型启动后端/基础设施插件 Fork**。不可将修改原生工具 `execute` 的行为隐藏在所谓基础设施 Fork 下。
- `A5-GENERIC` 不因信任哈希登记而失效：信任分类按来源/能力，真正执行仍经两种既有通用模式；未知工具并非默认可信。
- `A5-FALLBACK-01` 必须保留：任何受限后台进程、FS 或 Web Provider 未能加载/验证时不得悄然使用未经限制的原版服务。

## 4. 必做的差量 PoC（不得“Fork 后天然 PASS”）

1. **安装位置**：在真实 Team Preset 中排他装入 Fork 后端，普通非 Team Agent 使用上游原版 backend；原生工具 `ToolDefinition` 的代码/输出/生命周期对照不变。触发原生 backend 故意加载失败，Team 受限工具必须拒绝而不是退回全局原版。
2. **签名信任**：正确 digest + binding generation 接受；内容变化、依赖变化、同名不同源、HMR 换代、在飞卸载均被发现；同时用一个**完全相同摘要但恶意直接调用 `node:fs`** 的负控证明“digest 不是沙箱”，报告 Trust boundary，而非期待哈希阻止程序行为。
3. **硬链接**：创建同 inode 的 `/allowed/link` 与 `/denied/secret`；沿允许路径读写成功，另一别名内容变化必须在报告中**显式作为契约允许效果**；未经允许路径不可直接打开（若进程有事先开放 FD，则列入未覆盖或封堵 inherited FD）。
4. **读白名单**：拒绝直接读取白名单外目标；允许文件与目录两种粒度；symlink/mount/`/proc/self/fd` 与已打开 FD、二进制库依赖、元数据泄露面均报告真实结论。观察 `bwrap --ro-bind / /` 不再存在于受限 profile。
5. **网络布尔**：禁网时实际 IPv4/IPv6/TCP/UDP/DNS/代理连线均不能通向受限制域；若无法创建网络 namespace，则明确不能对该 OS backend 承诺禁网；不能悄悄当作 `allow`。
6. **一次性审批**：并发同 Member 一次扩权不能传递给另一调用；Landlock 既有进程不可就地扩权，持久 Bash 必须重建进程域或拒绝该扩权调用；策略收紧需真实 kill/drain 后重建。
7. **成本/升级**：统计 Fork 插件数、每插件改动行数、上游包/依赖 digest、冲突重应用率、启动/内存/p50-p95 延迟与原生输出黄金向量。不能用“插件 Fork 少于 X 个”代替功能覆盖证据。

## 5. 阶段裁决建议

- **GO（设计方向）**：受信工具注册 + 小型基础设施 Fork + path-name hardlink semantics 与 Alpha.5 目标兼容。
- **CONDITIONAL（实现）**：必须验证真实 Team 作用域中的 Fork 互斥安装、`SubprocessRuntime`/FS/Web 覆盖、权限变化与禁网能力，并重置旧工具自研交付的覆盖账；原有“几百测试通过”不直接迁移成新架构的保证。
- **明确舍弃的要求**：禁止一切同进程恶意代码越界、禁止硬链接跨名底层数据共享、保证所有未知 JS 一键完整沙箱兼容、按域名/IP 本轮限网。
- **保留的强制边界**：蓝图读/写/联网对所选择执行模式的真实能力要求、权限使用前准入、无静默 fallback、调用身份不混淆及可观察受限进程的生命周期。

**后续记录（2026-11-02）**：用户已采纳 R-T（受信工具绑定）与 R-H（硬链接路径语义）；两项已进入 [ADR.md](./ADR.md) 和 [ARCHITECTURE.md](./ARCHITECTURE.md)，PoC 判据已进入 [POC-PLAN.md](./POC-PLAN.md)，实施规划见 [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)。生产 Authority 指针仍待独立迁移，本文件本身不构成执行授权。
