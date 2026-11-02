# Alpha.5 Sandbox-First — PoC 成果接收与差量验证计划

> **历史 PoC 的输入/验收索引，不是第二套实施计划。** 五阶段产品开发与任务 Gate 以 [IMPLEMENTATION-PLAN](./IMPLEMENTATION-PLAN.md) 为准，实验前提与产品语义以 [ADR](./ADR.md)、[ARCHITECTURE](./ARCHITECTURE.md) 为准。
> **状态：用户表示本地 Agent 已完成 PoC 并推 GitHub；本 PR 没有把其完整日志与源码证据作为本文件内已验证结果。** 已有 PoC 要复用，绝不为形式重跑；未核对的机制仍记 NOT_VERIFIED。DSH pin = `tests/paths.mjs`。

## 1. 从已有事实可直接引用的工程基础

| 证据 | 可复用的结论 | 不能据此声称 |
|---|---|---|
| PR #26 `team-spill-local` 及后续真实 Host 验收 | Cordis `disable+insert`/公共服务 Provider 替代与继承有成熟先例 | 所有新 Provider 的 Member 级身份都正确 |
| DSH 原生 `ctx.isolate()` / `ctx.fs` / `ctx.web` / `ctx.subprocess` | 公开服务的结构与操作可源码确认 | 同进程任意 JS 被强制隔离；特定原生工具已绑定正确 realm |
| DSH Bash/terminal `backendType` 与 `terminal-bash` | 可能通过 Team 专属 `team-shell` 排他注册 | MemberPolicy 能可靠绑定旧持久 PTY 的 live 权限 |
| 本地 Agent 的 Realm + OS PoC（上传待核实） | 有望证明具体 Host 版本/真实 runner 的纵切 | 无证据登记前全部自动通过 |
| 存量 `tests/world-factory`、沙箱原生资产 preflight | 已有真实 Host 测试/隔离运行能力 | 新 profile/网络布尔及 hardlink 语义已验收 |

## 2. 收证任务（P1-00，必要但非全新实验）

- [ ] 从 GitHub 本地 Agent 结果提取准确 repo/branch/commit/文件 SHA；记录哪条 PoC 实际修改了哪些 Provider 以及程序真实调用入口。
- [ ] 每条 PoC 抽取原始 command、Host/Team SHA、系统/kernel/bwrap/landlock、沙箱资产、政策、Mock、实际效果 Oracle、正控、负控、异常与性能计数，记录 `PASS / CONDITIONAL / ENV_BLOCK / UNSUPPORTED / NOT_TESTED`。
- [ ] 仅对因版本、证据缺口、语义修订（可信 Hash、硬链接允许、网络仅 boolean）而**不再等价**的实验做差量补测，复用现有 WorldFactory。
- [ ] 输出 `P0-REUSE-MAP.md` 与 `POC-EVIDENCE-INDEX.md`（实施阶段保存到 `dev/agent-workflow/evidence/a5sf-p1/`，本 Draft 不凭空生成），逐项指向 G1/P2 的验证项。

## 3. 差量 PoC 关键矩阵

| 机制 | 真正需要的证据 | 阻塞/处理 |
|---|---|---|
| 真实 `service-mediated` | 原版 `tool-fs` 在 Member A/B 相同工具名、不同 Scope 下访问相互拒绝；同一 Member 不同工具再收窄；Provider 接收可信 invocation context | 仅 `ctx.isolate()` 调用正常不能 PASS；改装配或标 UNSUPPORTED |
| TrustedToolRegistry | 加载源 hash、scope/Definition generation 正确匹配；更换字节、HMR、同名换源后失效 | Hash 只是信任登记；same-realm 恶意 JS 旁路不当作本轮缺陷 |
| 原生 FS 全方法 | `streamText/readByteRange`、write/edit 的真实 Provider 方法和副作用；读取 10MiB 中间窗口无源文件 1MiB 限制 | 禁读/写零实际越界，未覆盖 Provider 方法列 UNSUPPORTED |
| `ctx.subprocess` | 原生 grep → `spawn(spec)` **同步返回 handle** → OS 禁读的真实 `rg`；退出码、输出与取消 | 不得把 `spawn` 改 async 或自己写 grep 算法 |
| PTY/瞬态 Bash | `team-shell` 实际注册、非 Team `shell` 正常，危险 Full Access 不能突破 Member 权限 | 持久进程旧策略不能直接扩权；需重建/拒绝 |
| OS file allowlist | 真实允许/拒读写、单文件与子树、正确的执行依赖挂载；`--ro-bind / /` 不得成为受限世界所有文件可读的原因 | 后端不支持时明确 UNSUPPORTED，而非只是输出拒绝 |
| OS network boolean | allow 正控、deny 下实际 HTTP/TCP/UDP/DNS/IPv4/IPv6、proxy/host bridge；主 Host 模型网络独立 | 仅 Landlock TCP 功能不能算全禁网；无可用 netns 的机器记 ENV_BLOCK |
| hardlink 新语义 | `/allowed/link` 与 `/denied/secret` 同 inode：通过允许路径读取/适用的写入成功、直接禁止路径打不开，必须记录跨路径影响 | 不自动把允许别名当 bug，**但绝不能省略泄露/别名影响证据**；原生 write 可能 atomically replace |
| 单次授权/策略缩紧 | 一个批准调用≠另一并发调用；持久进程新策略前必须确认旧域结束或标不确定 | 不允许 silent fallback/replay |
| 未知工具 | 新 CLI 不写专属 Team ToolDefinition 直接通过 OS Runner；未知 JS 需标 TRUSTED_ONLY/UNSUPPORTED | 不强迫完成 whole-tool Host |

## 4. 测试操作标准

- **真实 Host C2/C3 只通过 `tests/world-factory`**。独立 DSH_HOME 为 `tests/homes/<world>`，只用 `tests/paths.mjs` 许可端口，`:3080` 与稳定 DSH_HOME 零写。
- 使用既有 `tests/world-factory/provision-host-sandbox.mjs --check` 预检；原生二进制缺失、内核/Namespace 不支持与产品失败分开判，不得自动转成 PASS。
- 每次受限调用记录并配对 `memberId/toolBindingIdentity/callId/policyRevision`、Alpha.4 admission、实际 Provider `consulted` 决策与独立 I/O Oracle。`applied` 不等于 `consulted`；缺任一环节不能 PASS。
- 对 I/O 授权负控用**独立观察到的文件字节/进程行为/网络 server logs**，不要仅凭工具文本。
- 引入新故障测试需先 RED（植入可见的越界/绕过错误），修复后 GREEN；记录失败日志与 run manifest。
- 同一源码、policy、Host SHA、test world 的有效实验可复用；受影响的 Provider/Fork 改动后重跑对应 Gate，不做全仓无意义重复。
- 性能记录只报告测试环境下原生 vs service-mediated vs OS leaf 的 `p50/p95/p99`、CPU/RSS、冷/热启动；不能借别人的 `bwrap 10ms` 数字当本机验收承诺。

## 5. 此文档与阶段计划的关系

- P1 对应策略/信任/服务/OS 后端机制与装配；P2 对应 **read/write/grep/bash/web/ptc/new CLI** 代表性正向 + 基础拒绝。验证完成解锁对应 P3 接入。
- P3 对照 [TOOL-ADOPTION-MATRIX.md](./TOOL-ADOPTION-MATRIX.md) 逐个原生工具做正向与最少负控；P4 完整读/写/网/审批/撤权矩阵；P5 系统性对抗性测试。
- 已完成的 PoC 不等于运行时已经生效；用户确认设计方向不等于此前 PR #364 权威已经被替换。发布/实装必须走 [TRANSITION-PLAN](./TRANSITION-PLAN.md) 的受控迁移。

**最终允许的安全表述**：在所标明版本、执行后端、环境和列举负控中，未观察到 Alpha.5 承诺 I/O 范围之外的实际效果；这不是通用安全证明。
