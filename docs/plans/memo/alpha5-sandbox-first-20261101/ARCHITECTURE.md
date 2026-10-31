# Alpha.5 Sandbox-First 架构设计（Draft）

> 与 [ADR](./ADR.md) 共同审查；**非产品代码、不激活新执行合同**。Host 事实基于 DSH 0.2.0-rc.2 @ `639ed01539`；与用户本地正在执行的 PoC 独立，以下所有候选实现都标记为未验证。

## 1. 设计原则与边界

**唯一目标**：Blueprint 约束 Member 的文件读取、写入及网络布尔权限；保留以后实现目标地址限制的扩展插槽。Alpha.4 工具级 allow/ask/deny 与审批保留为独立的、先于受管效果的调用准入；任何 Goal/Todo/Present/Jobs 原生业务行为不属于 Alpha.5 的实现目标。不得修改任何 DSH 原生 ToolDefinition 的解析、调用、格式化或算法；不能新增专用工具替代体。

**双模式**，可组合：

1. `service-mediated`：原生/受信工具在 DSH Host 进程内执行，所有承诺受管的 I/O 经 Member-scoped 受控公共 Service。它是**可信代码的能力收窄**，不是 JS 安全沙箱；不允许在无证据下把任意插件的直接 `node:fs` / Socket 调用标为“受控”。
2. `os-confined`：在限制好的 OS 进程域中运行真实有 I/O 的程序（leaf process），或必要时装载整个工具运行时（whole Tool Host）。`bwrap` / Landlock 属候选实现而非 API 合同。运行时默认将长寿命权限域与一次性扩权域分离；不要求每调用创建新 Node Host。

**通用原则**：两模式共用 MemberPolicy；部署/作者选择经过验证的接入模式，不按“高频/低频”划分，更不按工具名称产生新的业务执行器。一个工具可以 `service-mediated` 调用 OS-confined 的子进程（原生 grep）。选择与实际可强制的边界分开报告。

## 2. 建议组件图

```text
Blueprint v3/v4 + existing Alpha.4 authority
       |                  existing tool call allow/ask/deny
       v
[Policy Compiler] -> (Member identity, immutable generation,
       |              read paths, write paths, network allow/deny)
       v
[Invocation Binder] -> (call identity, bounded one-shot delta, cancel/lease)
       |
       +-------- [Trusted Service-Mediated] -------+
       |           - scoped fs provider            |
       |           - scoped web provider           |   Original DSH ToolDefinition
       |           - scoped subprocess provider ---+--- original grep -> rg [OS confined]
       |
       +-------- [OS-Confined] ---------------------+
                   - leaf runner/PTY/PTC/CLI
                   - optional whole Tool Host + explicit IPC
                   - no unconfined fallback
```

`MemberPolicy` 是唯一静态有效策略；`InvocationAuthority` 是调用生命周期相关的授权上下文。Provider 根据**可信调用身份**选择策略，并在真实 I/O 前检查。跨异步调用不能使用共享可变的“当前 Member”变量，也不能将调用 ID 放在未经验证的用户参数或环境变量里当作唯一凭据。

## 3. DSH 真实公共切入点

| 能力 | Host 源码/公共 seam | 本轮机制和已知限制 |
| --- | --- | --- |
| 原生 read/write/edit | `packages/fs/tool-fs/src/read.ts`、`packages/fs/fs/src/index.ts` | `read` 通过 `ctx.fs.streamText/readText`；应按 `ctx.isolate('fs')` 组装工具和受限 Provider。Provider 覆盖 resolve/stat/lstat/read/list/watch/write/edit，不能复制原生窗口算法；原生 write/edit 内部旧内容读取也要符合读权限 |
| grep/glob | `packages/fs/tool-fs-search/src/search-core.ts` | 原生 `ctx.subprocess.spawn({argv: [rg,...], cwd, stdio, signal})`，不是 `ctx.sandbox.confine`；最小公共切入点是受限 `SubprocessRuntime`，主机原生参数与结果处理保留 |
| shell/PTC | `packages/terminal/terminal-bash/src/index.ts`、`packages/ptc-runtime/ptc-runtime-node/src/index.ts` | 已使用 `ctx.sandbox.confine` 的候选路径；`danger-full-access` 分支可跳过 confine，必须从外侧禁止越权切换；保持 PTY、进程组、输出、取消原生语义 |
| web | `packages/web/web/src/index.ts` / `tool-web/src/fetch.ts` | 原生工具 `ctx.web.fetch/search`，应探索受信 provider/隔离装配；禁网按工具数据面执行，Host LLM 控制面独立但不可成为通用出网代理 |
| ToolRuntime | `packages/core/tools/src/index.ts` | `tools/pre-execute` + `guard` 用于准入；`tools/execute` 是 waterfall，不是自动迁移原生 JS 到子进程的公共 seam；不能“包住工具”就宣称内核级隔离 |
| Cordis | `docs/cordis-api/context.md` | `ctx.isolate(name)` 只重映射服务解析；必须确认原生工具是在正确 realm **注册时**捕获其 `ctx`，并验证多 Member / HMR / teardown |
| Subprocess | `packages/subprocess/subprocess/src/index.ts` | `spawn(spec)` **同步返回** `SubprocessHandle`，`spawnTerminal(spec)` 异步。异步准备 sandbox policy 不能粗暴地加 `await` 破坏接口；探索热编译入口/句柄适配/受限 launcher |
| Sandboxed FS | `packages/fs/fs-sandbox/src/index.ts` | 现有模式控制写；读路径不限制。不能将现有 `read-only` 误读为“只读允许列表”。 |
| Sandbox | `packages/sandbox/sandbox/src/index.ts` / `sandbox-local/src/profiles.ts` | 现有 bwrap `--ro-bind / /` 暴露大范围只读；Member read whitelist 和网络 deny 需要新的受限环境/Provider |

公共 seam 能提供一条候选路线，不等于已完成完整执行路径验证：原生插件的注册绑定、同名覆盖、late dispatch、PTC 递归调用、动态 MCP、Host 内部 I/O、远端 Provider 必须在真实 TestWorld 验证；不可给新工具自动打“已隔离”标签。

## 4. 兼容性/安全语义

- **读、写分离**：允许写入路径并不隐式授予读取权限；对于写入前读取、diff、元数据查询，原生工具的内部行为可能导致本次调用拒绝。这是合法的“不保证工具可用”，不可降低权限解决。
- **可观察信息**：路径名、存在性、大小、stat/list/watch/搜索结果也可能披露信息。方案不在未证明时宣称完整信息流不可见；至少保证已定义的文件内容读/写限制和本轮约定的必要 metadata 检查，风险以真实能力矩阵披露。
- **路径识别**：工作区锚定不可变；规范化依真实执行世界，验证符号链接、硬链接、挂载别名、重命名、TOCTOU；不能仅按用户传入字符串匹配前缀。
- **网络布尔**：本轮 `allow` 与 `deny`；禁网需覆盖工具数据面所能使用的网络传输（含 DNS、IPv4/IPv6、代理、子进程），对 loopback/Unix Socket/IPC、trusted Host 代理与远端云 Provider 留清晰的可验证例外或标记 UNSUPPORTED。不实现目的地 ACL；接口先预留但不假装配置已执行。
- **审批权限**：必须在 body/受管效果前完成；一次性扩权只对该调用生效。服务执行可用可信调用上下文或能力句柄，OS Realm 固定上界，新增权限需要新域/受控服务。授权撤销不能自动追溯已发生的副作用。
- **生存期**：shell/PTC/job 子孙进程与持久 PTY 不应在策略变化后继续使用旧权限；必要时关闭或排空旧域。超时/取消必须真实达到进程范围的 quiescence，不能仅返回“取消成功”。
- **外部工具**：命令行可执行程序的 OS-confined 路线最短；未知 JS 工具如果必须作为不可信代码隔离，需要可加载的 whole-tool Host 和 IPC。若只有可信 in-process 运行模式，则明确 `TRUSTED_ONLY`，不得作为隔离承诺。
- **Assurance**：仅在实验范围声称 “在 DSH Host SHA + 实测环境 + 具体负控下未观察到越界”；不得承诺普遍不越界、不承诺第三方远端 I/O 可限制。

## 5. 通用内部接口（草案，不是立即采纳的代码/API）

```ts
type ExecutionMode = "service-mediated" | "os-confined";
type ExecutionForm = "leaf-process" | "whole-tool"; // os-confined internal detail
type NetworkPolicyV1 = { access: "allow" | "deny" }; // destination selector reserved for vNext

interface EnforcementProvider {
  capabilities(): {
    fileRead: boolean; fileWrite: boolean; networkBoolean: boolean;
    supportsOneShotGrant: boolean; supportsPersistentRevocation: boolean;
  };
}
interface ToolIntegration {
  source: "dsh-native" | "third-party" | "standalone";
  entrypoint: string; // imported plugin or independently launchable command, not rewritten body
  mode: ExecutionMode;
  form?: ExecutionForm;
  requiredServices?: readonly ("fs"|"web"|"subprocess"|"sandbox")[];
  // No tool-specific read/grep/web executor callback.
}
```

在已经能安全绑定的原生工具上，`service-mediated` 是低开销候选；在无法验证服务依赖完备或需要隔离任意 JS 时，`os-confined` 是默认边界。对于“是否允许未经测试新工具在 Service-Mediated 上只做 best-effort”，不得将这种模式伪装为强制受控；如需要，另起**显式受信部署**语义讨论，而不是增加第三种沙箱。

## 6. 对原有代码与架构的影响

现有 `packages/runtime/governance-center/contribution-schema.ts` 的 `execution.via` 仅 `family-body/named-bridge`；`packages/runtime/src/plugin/live/family-assembly.mjs` 强制 claimed name 对应同名 Team definition。这是实现形式的历史收窄，不能作为继续开发原生 ToolDefinition 重实现的理由。

新的 Assembly 需要容许**引用原生工具定义及其公开服务依赖**的贡献描述，不以 Team 自研 `family-body` 为默认。优先对受信服务和 OS 受限启动后端建立通用 Provider，保留原有 Guard/ApprovalCase/Kernel 能复用的安全逻辑；对不适用的 EffectSet/Family 机制采取冻结、迁移、退役，而非未经验证地全量移除。

**不得直接将本设计更改为生产**：当期旧执行计划及机器 authority 指针尚未迁移。完整路径见 [TRANSITION-PLAN](./TRANSITION-PLAN.md)。全部未来实验与 Bench 应走仓库 `docs/TEST_METHODS.md` 的隔离 TestWorld，不接触稳定 DSH_HOME/端口。
