# Alpha.5 Sandbox-First — 历史机制迁移、执行权威及独立交付门禁

> **Draft，非 Authority Migration PR。** 与 [ADR](./ADR.md)、[架构](./ARCHITECTURE.md)、[五阶段实施计划](./IMPLEMENTATION-PLAN.md) 同步。此处不自行启用新方案、不影响目前已有工作树、原生工具或运行 Host。

## 0. 现行状态与冲突面

本 Draft PR #531 仅为用户 2026-11-02 产品裁决的**目标设计**；当前机器权威仍由 `dev/engineering/current-authority.json` 指向的不可变 snapshot 决定，实施入口仍为已合并 PR #364 的 `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md`。本轮不得修改该指针、`AGENTS.md`、`docs/plans/active` 或 `dev/agent-workflow/graph.yaml` 的权威记录。

存在必须经独立 PR 处理的冲突：

| 旧体系 | 新裁决 | 迁移方式 |
|---|---|---|
| `FamilyAssembly`、`contribution-schema` 默认 `family-body/named-bridge` 和 Team 自研执行体 | 原生 `ToolDefinition` 零修改、通用 `service-mediated/os-confined` | 在 P3-05 开辟原生服务绑定模式，最后替换默认路径并下线旧业务体 |
| v4 `toolBindings[].io` 已有逐工具 read/write/network，而 Member 硬上界未完整表达 | Member × Tool 两轴全局硬上界，网络本轮只承诺布尔 | P1-01 **优先复用 v4 语法/映射**，只补缺失的 Member ceiling 作者载体；封闭语法确需版本增量才最小升级；保留 v3/v4 旧语义与 hash |
| 旧 `controlled-fs` 对 `nlink>1` 拒绝 | Member 授权路径允许 hardlink 别名 | P1-03/P4-02 引入新路径契约；仅对新的 Member 数据面废止旧拒绝，控制面完整性不变 |
| 上游“不得 vendor 修改源码”旧红线 | 用户允许小范围**执行基础设施**插件 Fork，模型工具禁止 Fork | 独立权威迁移 PR 精确定义允许清单、upstream SHA/许可证/diff 与维护者 |
| 全工具副作用 EffectSet、网络端点 restricted 的旧交付范围 | 本轮唯一 read/write/network boolean | 新矩阵与 release gate 减去无关业务要求；历史证据作为事实保留，不能假造新测试 PASS |
| 旧“三层 Full I/O 可证”的安全措辞 | 仅在已测条件下未观察到越界；受信 JS 不抗恶意旁路 | 审计/发布文档的 Assurance 映射，TRUSTED_ONLY 与 OS 证据分层 |

## 1. 现有成果的复用表

- Alpha.4 工具 allow/ask/deny、ApprovalCase、单次 Grant、Control/Authority Envelope、Guard：**保留为调用准入与授权治理来源**。单次批准不扩大 Member/Tool I/O 硬上界；合法硬上界变更须明确的策略变更与代际更新。不新建第二审批系统。
- PR #26 `team-spill-local`：外部插件通过 `disable+insert` 替换同名受信服务成功、非 Team 不受影响；复用**装配方法**，不同新 Provider 必须自己证明真正绑定。
- 当前 `tests/world-factory`、`tests/paths.mjs`、C1/C2/C3 工具与资产预检：保留、复用，避免复制大型 Host checkout、重复开新 launcher 和无谓 CI 重跑。
- `packages/runtime/sandbox-provider` 的 Linux launcher、Fd、probe、租约、退出码和进程树清理代码：可评估**提取通用执行能力**，不要求全部照搬其旧 EffectSet/`network:restricted` 语义，严格保持原生 `SubprocessHandle`。
- `controlled-fs` 的路径与版本核验：仅提取与新 `ctx.fs` ABI 能匹配的机制，避免用旧接口强行取代原生 FS 的流式读/编辑。P1 必须实现 `MemberCeiling ∩ ToolRestriction`，而非从 Member 或 Tool 两者任选其一。
- 旧工具 Family 和所有历史 Evidence：**暂不删除**。先通过真实原生纵切验证替代后再按 Gate 逐一退役，必要时旧路径只能用于明确隔离的历史测试世界，不能在声称受限的生产执行路径上静默回退。

## 1A. B2R2 / IOAXIS / WRITEONLY 已完成的技术证据与实施路线

证据分支的 B2R2 已将原生持久 Bash 成员写域的 `CORE_SEAM_BLOCKER` 改为公开零复制 wrapper 可承载；IOAXIS 又利用公开 `sandboxPolicy.resolve → sandbox.confine` 代理确认 bwrap 的受限读掩码与写根可传递给原生工具；WRITEONLY 提供 VFS 固定 owner 位下只写不读 EACCES 的实验（15/15 + 13/13）。这些结果证明基础设施接缝和有限内核机制可行，**架构 PoC 收口**，不要求在定稿前开展更多独立探索。

但边界必须准确：bwrap `--ro-bind / /` 加目录掩码不是默认拒绝的 read allowlist，VFS 0300/0200 也不能阻止同 UID 文件 owner `chmod` 或新建文件出现可读权限。严格独立读写执行的生产首选 Landlock 文件规则（适用 ABI 与实际内核能力必须 P1/P2 验收）；本 WSL2 Landlock `add_rule=EBADF` 仅为 ENV_BLOCK。若目标环境无法兑现受管策略，不得静默退化到 VFS 或权限更宽的 bwrap，必须对该配置拒绝或标出明确支持子集。

实施路线：公开 Provider/原版装配 → 零复制 `apply`/Context/Service wrapper → 具名缺口时最小基础设施 Fork → **绝不修改 Core/原生 ToolDefinition**。真实 TeamDomain 身份、Policy revision 与旧 PTY 失效处理在 P1/P2 实施；v4 已启用文档解析但 I/O effect 未执行，`toolBindings.owner` 为工具来源而非 Member 身份，不能借旧字段改语义。更多验证直接由 P1–P5 Gate 承接，而非再次派发 PoC。

证据：[B2R2](https://github.com/ArmourPiercer1/dsh-agent-team/blob/18e3823e3/dev/agent-workflow/evidence/a5x-sandboxpoc-20261101/B2R2-DELTA-RESULT.md) · [IOAXIS](https://github.com/ArmourPiercer1/dsh-agent-team/commit/9b261060c) · [WRITEONLY](https://github.com/ArmourPiercer1/dsh-agent-team/commit/9c56f94a12cd241ffdb8c27eaab0696813f0dbff)。


## 2. 真实 PoC 与新阶段之间如何衔接

`POC-PLAN.md` 和 `FORK-POC-RESOLUTION-PROPOSAL.md` 是本架构的历史实验依据。可由本地 Agent 将已推送完整源码、真实 Host 运行记录、测试与设备环境绑定到 P1/P2 对应 Gate；对已证明、相同 Host SHA/相同边界/相同权限契约的实验，不必重复。**只凭摘要或截图不能判 PASS**；差异点产生最小补测列表。

五阶段实施顺序以 `IMPLEMENTATION-PLAN.md` 为准：

```text
Draft PR #531: 目标架构/任务设计与用户审查
    ↓
P1 Policy + Provider/OS 基础设施 → G1
    ↓
P2 代表工具实装正向/拒绝 → G2
    ↓
P3 全原生工具接入与原生行为等价 → G3
    ↓
P4 每原生工具读写网权限矩阵 → G4（限定范围的内部试用候选）
    ↓
P5 漏洞/性能/升级复验 → G5（发布候选）
    ↓
单独用户批准的 Authority Migration PR + Final Release Review
```

注意：**实施授权与生产权威切换必须分开**，不再把执行计划的时间顺序当作需要重新裁决的产品语义。P1/P2 可以在 test-only/profile-gated 模式做原型，而不能既要求全生产授权来源在旧合同下生效、又阻止迁移 PR 直到 P5。建议分成两个正交裁决：**设计实施授权/受控 Feature Flag**（在 P1 前经用户审查，隔离在 Team 测试 Preset）与**正式生产 Authority 指针切换**（P3 接入稳定、发布前进行独立 PR）。任何功能需要进生产 Host 时，须先完成相应 Authority Migration，而非假装 Draft 具有运行权限。

## 3. 工程和文档 Owner 的最小变更面

| Owner | 可以修改 | 禁止 |
|---|---|---|
| Blueprint/Policy | v4 词汇投影复用、最小 Member ceiling 扩展、`member-io-policy` | 先验创建 v5 全套新词汇、直接修改冻结 v3/v4 历史、二次实现 Alpha.4 Authority |
| Service | `team-services` 的公共 FS/Web/Sp-Provider | Fork 原生 `read/web/grep` 业务 |
| OS | `team-sandbox` + 必要的基础设施 Fork | 修改上游 Host checkout、重写 PTY/Process 状态机 |
| Native Integrator | Team Preset/`cordis.patch.yml`、`host.ts`、`agent-bindings.mjs`、装配索引 | 并发多 Writer、静默 native fallback |
| Test/Security | TestWorldFactory 新 suites、Oracle、基准与审计 | 改稳定 :3080、假绿/将 ENV_BLOCK 当 PASS |
| Authority Writer | 经批准的 snapshot/pointer、`AGENTS.md`、`docs/plans/active` | 用户未批准提前改变唯一权威、直接覆盖旧 snapshot |

每个 PR 先交 C1/源码检查，涉及 Host 时按 `docs/TEST_METHODS.md` 提交 C2/C3 证据；主仓库 `master/stable` 合并始终需相应明确授权。唯一对外“原生可靠”的正向陈述必须限定为“在所列测试中未观察到越界”。

## 4. 内部试用与完整发布分开

- **内测候选**：新架构的目标工具组通过 G1/G2、P3 原生正向、对应 P4 基础权限矩阵、真实非 Team 回归，且部署文档将不支持工具/OS 和 Trusted JS 的保证边界写明。内部试用不自动允许 merge/release。
- **完整候选**：G3 所有声明支持的原生工具有 source/binding/正向功能测试；G4 的读写网/审批/生命周期覆盖完整；G5 的已知高优先级越界漏洞得到修复或拒绝支持；性能与上游 Fork 维护计划完整。
- **正式切换**：独立 Authority Migration PR（唯一 Writer、对照旧指针及快照、回滚实验）、独立功能与边界审查、用户合并/发布裁决；文档/产品状态统一后方能宣称新 Alpha.5 正式生效。

## 5. 特别的禁止项

不得因原有开发投入和历史任务数而扩大这次需求；不得复活“一工具一执行器”或逐 EffectSet 系统；不得把 `whole-tool` 全功能隔离做成本轮强制交付；不得因工具频率区别架构；不得替换原生工具 schema/render；不得把外部 MCP/远端服务器的内部 I/O 宣称为本地 OS 已限制。

**本文件取代先前 T0–T4 研究式方案作为本 Draft 的迁移规划；它仍不是激活的机器执行权威。**
