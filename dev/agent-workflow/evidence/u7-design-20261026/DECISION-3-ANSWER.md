# 决策 3 答复与落地（2026-10-26）

用户提问（逐字）：**"Alpha.5 的原始设计案中应该对于外来工具/mcp 的管理有要求，需要它们满足一定的条件、保证能接入
某个控制类型中（例如，控制读、控制写、控制沙箱启动等）。Alpha.5 对于外来工具接入的控制设计原本是怎样的？
目前能否继续按照设计执行？"**

调查正本 = `docs/plans/memo/unified-baseline-alpha5-20261025/u7/EXTERNAL-TOOL-CONTROL-DESIGN.md`（62 行，
逐条带 S0 memo / center-assembly-architecture / 生产代码行号引用）。本文只记录结论与落地裁决。

## 1. 原始设计要求（回答"原本是怎样的"）

Alpha.5 原始设计**不是**按"控制读/控制写/控制沙箱启动"这种枚举给外来工具分类的。它用三条正交轴
（`architecture.md` §14.3）：

| 轴 | 取值 | 含义 |
|---|---|---|
| `implementationOrigin` | DSH-native / Team-or-trusted-extension / standalone runner / remote provider | 谁提供实现，**不蕴含隔离** |
| `executionBoundary` | trusted Host / **confined process** / delegated remote | 真实效果在哪发生 |
| `assurance` | per-capability：Team-enforced / provider-enforced / author-trusted / unsupported | 谁真正保证读/写/网络/子进程/取消 |

在此之上，外来工具（含 MCP）必须满足的**条件集**（`center-assembly-architecture.md:214-234`、S0 M-12）：

1. 来源身份/选择器 + digest；Provider 身份 + digest；
2. schema/契约版本、family/version、闭合输入输出契约；
3. native 名与别名、**实际** Scope/Profile 绑定；
4. required/optional capability 的 **closed-world 协商**；
5. **声明的 effects 与 targets**，且要与 Provider 实际能力核对（不得虚报）；
6. 执行边界 + provider-backed 时**具名 Bridge**；
7. kernel 掌管的 lifecycle / drain / 取消边界 / 结果关联；
8. evidence/RUN digest、审批主体与时间、policy generation、**expiry**、撤销状态；
9. 每次调用仍走 PA/Control/Grant：参数与效果指纹、fresh 重检、**一次性消费**。

并且控制类型是**效果类**（read/list/metadata、write/mutation、process/child、network/connect、Domain 引用）
加 lifecycle/取消/不确定终止，落到三类执行边界之一，**不是**现有代码里的 `ALL_MUTATION_OPS` / `ENVELOPE_EXEC_OPS`
词表（后两者分别是 Team 治理动作上限与 `bash|pwsh` 授权集，语义不同，不可混算）。

**外来工具的准入顺序**（不可跳步）：发现/隔离 → 校验来源/契约/Provider/Host seam → **只有既授权配置权威**可签
不可变 `DynamicSourceAdmissionRecord` → Registry 校验 digest 转候选 → 每次调用仍需 PA/Control/Grant；任一
来源/Provider/Scope/Profile/契约/Host-pin 变化即令旧记录失效并重验。Family / Registry / Kernel **不得自升权**。
撤销序：阻断新派发并标记 revoked → 递增 generation/epoch → 失效缓存/Binding/未消费 Grant → Provider drain/cancel
→ 确认终态或记 UNCERTAIN → 只有新记录才能重新启用。

**Alpha.5 原始范围里 MCP 的地位**：是**必交工具族**，但作为 PR7 的**延后外部 Provider/Bridge 义务**（S0 M-12：
动态注册/撤回/重注册/同名遮蔽全量进 closed-world Guard；stdio = 真本地受限子进程；HTTP = 可信远端 Provider，
Team 本地只能准入 + 可信绑定）。原实现从未关闭它——矩阵至今 M-12 = `WIRED-NOT-ACCEPTED` / `NOT_VERIFIED`。
所以它属于**本 alpha 的必交范围但历史未交付**，不是"留给后续 alpha 的活"。

## 2. 现状差距（回答"现在能不能按设计执行"）

**已实现（可真接）**：Contribution schema 的闭合校验、source/provider digest、`dynamic-source → not_verified`、
Kernel 的 `NOT_VERIFIED_SOURCE` / `SCOPE_UNVERIFIED` 与 generation 绑定、revoke/tombstone；MCP 侧有 mount/filter/
reconcile 与 `mcp__` 排除出 native 信任面。PoC-4b 已实证**body 前**拒绝晚到源与同名遮蔽不继承。

**缺口（设计自己判为 CORE_SEAM_BLOCKER 的那些）**：

- 没有 `DynamicSourceAdmissionRecord` 的类型/签名/授权签署方/expiry/policy generation/evidence 绑定；
- `effects.kinds` 目前接受任意字符串，未校对外来效果词表、target 语义、Provider 能力；
- **stdio 侧无受限启动**：宿主 `dsh-mcp-client` 的 stdio transport 直连 `StdioClientTransport`，不过
  `ctx.subprocess` / `ctx.sandbox`；且宿主 sandbox 只声明 **FILE effects**（`SandboxMode` 明确不宣称 network 与
  process visibility），bwrap/lss profile 无 `--unshare-net`；
- **HTTP 侧无远端效果治理**：Team 现行只把 `streamable-http` 指向 loopback mini-MCP 端口，本地沙箱对远端效果
  无管辖权，需可信远端 Provider；
- resource 三件（`list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource`）在矩阵里是
  **UNKNOWN 独立静态名**，未适配。

## 3. 结论与落地

**判定：完整设计 `blocked-with-reason`；收窄后的声明 `executable-with-narrowing`。**

- **不可宣称**：Alpha.5"外来效果已受控"（stdio 受限子进程、远端 HTTP 效果、动态记录签名链均未真正交付）。
- **可宣称（收窄）**："未在中心登记/绑定前，未知、晚到、同名遮蔽的 MCP 来源一律在 body 前被拒；不对远端隔离作任何承诺。"
- **必须显式延后**：受控 MCP 效果、resource 三件、动态晋升——直到具名 Bridge/Provider 交付并留证。

CORE PATCH BUDGET = 0 下可执行的部分（已列为 U7-8 分解，见设计 §5）：center 侧记录/效果契约（protected-set
中性）、**具名 MCP Bridge**、resource 三件适配器、以及钉住真实 Host 的证据重跑。

**stdio 受限启动的可行性已亲核（无需改宿主源码）**：宿主 `dsh-mcp-client` 的 `StdioConfig` 接受
`command: string` + `args: string[]`（"passed directly, without shell interpolation"），而宿主
`ctx.sandbox.confine(argv, policy, signal?)` 的契约正是"返回**替代 spawn 的 argv**"（`sandbox/src/index.ts`
`ConfinedArgv.argv` = runner + profile + separator + caller argv）。所以具名 Bridge 可以 `confine()` 出受限 argv，
再以 `command: wrapped.argv[0]` / `args: wrapped.argv.slice(1)` 挂 mcp-client —— 纯公开 seam + 公开 Config，
零 core patch。**但必须诚实收窄**：宿主 `SandboxMode` 明确只声称 **FILE effects**（"network and process visibility
are not claimed"），bwrap profile 只有 `--ro-bind/--dev/--unshare-pid/--proc/--die-with-parent`，**无
`--unshare-net`**。因此 MCP stdio 能做到的是 **文件效果受限 + PID 命名空间**，**网络不受限**。设计原文要求
stdio 走 "file/network/process" 三面封套；其中 network 面在当前宿主 seam 上不可得 → 该面要么按"声明收窄为
file-effect 受限"落地并写进发布声明，要么在需要网络隔离时升级为 `CORE_SEAM_BLOCKER` 并停下等范围裁决。

因此本裁决按用户"总体同意 B"执行：**Domain（R-G1F-2）从 Alpha.5 发布声明中排除并记录边界**；MCP 保持必交但
按上述收窄声明 + 具名 Bridge 分阶段交付，未交付部分不得计入 G5 通过。

## 4. 本机实测（2026-10-26，只读探针，无 Host 启动）

- `bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- /bin/sh -c …` →
  `bwrap: No permissions to create new namespace`（本机内核禁用非特权 user namespace）。宿主 runner 链会回落 Landlock。
- `/sys/kernel/security/lsm` = `lockdown,capability,landlock,yama,apparmor`。
- 宿主自带 `native/system/packages/linux-x64/bin/landlock-run --ro / --rw /dev/null -- /bin/sh -c 'echo x > /tmp/…'`
  → stderr `landlock-run: partial enforcement (older Landlock ABI)`；写被拒（`Permission denied` → `WRITE-DENIED`）。

含义：本机上 MCP stdio 受限启动**可行但为 `partial` file enforcement**（宿主 `SandboxEnforcement='partial'`），
且 Landlock 旧 ABI 不含 TCP 网络规则 → 网络面在本机**确定不可控**。具名 MCP Bridge 必须把
`enforcement` 原样写进 assurance 记录，`partial` 不得被上报成 `full`；需要 `full` 或网络隔离的声明在本环境
只能 typed refusal（`SANDBOX_UNAVAILABLE`/assurance 不足），不得静默弱化启动。
