# A5SF — B2-R 之后的最小差量 PoC（2026-11-02）

> **状态：历史任务表，已由 B2R2、IOAXIS、WRITEONLY 执行结果收口（2026-11-03）；剩余项转入实施 Gate，禁止继续按本表启动泛化 PoC。** 来源：PR #531 评论 #6576045610 / #6576078330；证据锚点 task/a5x-envpoc-20261031 @ 6205df337948d5a219440698600a9862ab118dbc。真实 Host 基线从 tests/paths.mjs 获取。仅用 docs/TEST_METHODS.md 允许的隔离 World，严禁 :3080、稳定 DSH_HOME 和修改 pristine DSH。PoC 只补足原结果无法证明的边界，**不重新证明已经实测通过的 disable/insert 或原生 grep 正控**。

## 0. 判定基线

B2-R **CONDITIONAL**：公开导出零复制 wrapper → native terminal-bash apply(proxy(ctx)) → sandboxPolicy.resolve() 按会话条件钳制。实际 OS 写入效果：rootA 内成功，rootA 外失败；读 secret **仍成功**；sessionId 使用 includes('M1')，缺少映射时直接 return base；传给原生持久 bash 的 sandbox_permissions 并非其模型参数（原生参数只有 command），故 **danger 模式实际提权路径未验证**。这组事实**不得被标为 Member 全部 I/O 的 READY**。

R-B1 grep/glob 的受限 subprocess 已有代表正控；文件级白名单、成员身份来源、服务/OS 的交集、持久域授权变更另测。P1-01 的 v4 静态投影是**词汇复用证据**，非 Member × Tool 全局上界完整可表达性证明。v4 network.restricted 不得默认为布尔 allow/deny；不能兑现时拒绝执行并指明需显式迁移。

## 1. 差量任务与判据

| ID | 目标及运行样本 | 独立副作用 / consulted 证据 | READY 的必要条件 |
|---|---|---|---|
| D-BIND-01 | **真实 TeamDomain** 启动 2 Member：相同原生 bash，Member A 只读 A/只写 B，Member B 只读 C/只写 D；同一 Member 两工具的额外收窄 | 记录真实 agent/member identity 与 session 绑定、toolDefinitionIdentity、callId、policyRevision；两侧独立文件字节 Oracle | 不使用 includes/人工 session key；错配/缺少/重绑定时**前置 fail-closed**，非 Team 会话对照不变；真实调用命中 wrapper |
| D-FS-02 | 独立读/写上界：A 只读而不可写，B 只写而不可读（测试原生 Bash 的 cat/echo、原生 read/write/edit），外加单文件与目录规则 | OS 层真实 EACCES/ENOENT 或可信服务层拒绝 + 内容 Oracle；记录每条操作绑定的执行域 ID | 两轴分别兑现；仅 workspace-write 模式的“写边界”不算本项 PASS；原生 edit 所需读权限不能隐式赠送 |
| D-BASH-03 | 通过**原生真实可用的** session sandbox/mode 配置/授权入口申请 danger-full-access，而非向仅有 command 的工具传无效参数 | 标准模式变更是否有效、实际 resulting mode、OS 文件效果、Alpha.4 approval 记录 | Member ceiling 永不因模式升级被突破；改变 ceiling 需要明确有权的策略变更 |
| D-PTY-04 | 同一 Member 创建持久 PTY，改变工具约束/Member ceiling、撤销和恢复；并发一次性审批和不同 Member 终端 | PTY PID/域身份、版本前后 old-domain drain/terminate、新域创建、策略 consulted 记录 | 不使用不兼容的旧域；无法收敛时拒绝；本次授权不可漂移到另一调用或后续命令 |
| D-OS-05 | bwrap/Landlock 在允许目录内分别实现读、写，禁止其他路径；访问允许目录内硬链接与外部别名、软链接、/proc/self/fd | 文件内容、link inode、进程 OS deny 与允许效果；记录硬链接跨路径内容变化 | 合法硬链接别名允许但**保留完整泄露证据**；禁止路径不能直接打开；未证明文件级读白名单则 UNSUPPORTED |
| D-NET-06 | 同一 Member 的 web_fetch、bash、子进程分别 allow/deny，DNS、TCP/UDP、IPv4/IPv6；v4 network.restricted 输入 | Mock server 连接计数 + OS 阻断 + provider consulted；记录原生 search/fetch 正向 | 本轮布尔网络真的覆盖受管效果；restricted **保留原语义**，不可兑现时明确拒绝，不静默强制转换 |
| D-PLANE-07 | Alpha.4 tool allow/ask/deny（含 by-action-name）交叉 Member/Tool ceiling，审批 allow 但文件 I/O 被拒的场景 | 同一 member/tool/call/revision 的 Alpha.4 决策、受控 Provider/域咨询、独立 I/O 效果 | OperationAuthorization 与 I/O ceiling 各司其职；旧 Alpha.4 fingerprint 不被重新解释为 ceiling 扩权；UI 能区分工具准入与文件拒绝 |
| D-UP-08 | 用真实 DSH 后续 commit/release 在独立 Host tree 重放公开包裹件（若必要再重放最小 infrastructure fork） | Source diff/公开出口变化、人工适配行数/冲突、原生行为/权限负控 | 可量化维护成本；不将纯模拟升级写成真实升级 |

## 2. 执行顺序、复用与停止规则

1. **优先 D-BIND-01 / D-FS-02**：判定生产 Member 绑定与真正的独立读写；此二者若不成立，B2 仍为 CONDITIONAL，不启动全族推广。
2. **D-BASH-03 / D-PTY-04**：确认真实权限升级与持久进程生命周期。可与 D-OS-05 的独立后端验证并行，但不共用运行 World/Writer。
3. **D-NET-06 / D-PLANE-07**：复用既有 Web 布尔 PoC、Alpha.4 审批数据及 TestWorldFactory，只补未证实的 OS 及 cross-plane 情形。
4. **D-UP-08**：不阻塞 P1 方案设计，但应进入 G5 上游升级门。已有 B1、A3、PR #26 证据有效的部分不重跑。
5. **任何意外越界都记录 RED + 最小复现 + 原生工具来源与受信边界**；仅修 Team Service/OS/包裹件，不得新增工具专属 executor，不触碰 DSH Core。
6. 若能力需要新全功能 Tool Host、改变上游 ToolDefinition 或无法满足硬上界，应标 UNSUPPORTED/CORE_SEAM_BLOCKER 并报告其影响的工具，不偷偷扩大本轮需求。

**证据格式**：每腿 {id, hostSha, teamSha, wrapperSourceSha, policy, memberId, toolDefinitionIdentity, callId, policyRevision, backendId, consultedTrace, OS/domain identity, positiveOracle, deniedOracle, teardown, verdict, limitations}。输出按 READY / CONDITIONAL / UNSUPPORTED / ENV_BLOCK / FAIL / NOT_TESTED 判断，不以 applied ≡ consulted、stderr ≡ OS 阻断或 mock-only ≡ 真实 Host PASS。

## 3. P1-01 的文档对表（无新增 PoC 代码优先）

用真实 v4 `toolBindings[].io`、Alpha.4 模板权限与 Member ceiling 的候选最小扩展，分别人工列出 (Member A, bash), (Member B, bash), (Member A, read), (Member A, 未绑定 CLI)。按 read/write/network 三轴明确来源、默认值、ask 的批准边界、ToolRestriction 未声明的含义和 effective ceiling。**不得把“逐工具语法能投影到某条执行策略”当作“已存在不同 Member 上界作者载体”的证据。**

**建议判定**：零复制 wrapper 是新的首选候选，B2-R 为 **CONDITIONAL（写边界纵切通过）**；D-BIND-01 + D-FS-02 必须完成才可能升级整个 Member 读写路径结论。
## 4. 结束记录（2026-11-03；覆盖本文件原待测状态）

- D-BIND-01：精确 session-id、无映射拒绝与双会话写上界已通过 PoC；**真实 TeamDomain Member 绑定在 P1 实施**。
- D-FS-02：bwrap 目录写根、掩码和文件暴露可行（IOAXIS kernel 19/19、接缝 12/12）；VFS 0300/0200 的固定权限只写不读样本可行（WRITEONLY kernel 15/15、接缝 13/13），但**不足以作为执行者不可放宽的任意 Bash 硬上界**：同 UID owner 可 chmod，新文件可能默认可读。完整读 allowlist 优先由 Landlock 实装；本 WSL2 的 Landlock add_rule=EBADF 是 ENV_BLOCK；该环境能力须在 P1/P2 能力探测与真实实施验收中验证，而非继续 PoC。
- D-BASH-03：真实 session-mode 提权及上界钳制已完成；D-PTY-04：stale 域危害已捕获，终止/代际重建列为 P1-08/P2-04。
- D-OS-05/D-NET-06/D-PLANE-07：复用既有证据，未证实的完整矩阵属于 P2–P4；D-UP-08 留在 P5 升级验收。不能把有限 PoC 数字直接当生产 PASS。
- 结束依据：[B2R2](https://github.com/ArmourPiercer1/dsh-agent-team/blob/18e3823e3/dev/agent-workflow/evidence/a5x-sandboxpoc-20261101/B2R2-DELTA-RESULT.md) · [IOAXIS](https://github.com/ArmourPiercer1/dsh-agent-team/commit/9b261060c) · [WRITEONLY](https://github.com/ArmourPiercer1/dsh-agent-team/commit/9c56f94a12cd241ffdb8c27eaab0696813f0dbff)。
