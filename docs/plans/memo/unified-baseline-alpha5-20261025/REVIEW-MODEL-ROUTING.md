# 审查模型动态路由（REVIEW-MODEL-ROUTING）

> **来源与地位**：用户 2026-10-28 指令（会话内下达，操作性全文即本文件；路由决策台账 =
> `dev/agent-workflow/evidence/review-routing-20261028/ROUTING-LEDGER.md`，其 DEV-1/DEV-2 条目记录指令的
> 执行背景与偏离披露）。本文件把该指令落为本仓库可执行的审查路由规范 +
> 决策台账入口。它**只管理审查任务的路由与额度**，不改变开发执行体、权限治理、既有门禁规范与 PR 合并权限；
> 与 `docs/ROUTER_RULES.md` §0 的关系：本指令是"审查模型选择"这一子问题的当期计划级偏好，其余仍以
> ROUTER_RULES 与门禁为准。
>
> **注册面事实（2026-10-28 接管轮实测）**：`dsh-opencode-go`（DSH OpenCode Go）通道在新会话实测可用
> （工具回合探针通过，见 §一）；`deepseek-v4-pro` **已注册**（接管时会话内 UNKNOWN）；旧
> `qiyuan-inter/*` 面的事故史与 `-1017` 后缀 ID 只作历史记录保留。

## 一、本机实际可用路由（2026-10-28 接管轮实测，勿凭记忆引用）

来源 = `list_subagent_models`（DSH 实际注册面）+ 工具回合实测，**不是**理想模型名列表。

| 指令中的模型名 | 本机实际 route | 状态 | 备注 |
| --- | --- | --- | --- |
| `qwen3.8-flash-next` | `qiyuan-self/qwen3.8-flash-next` | 可用，默认执行体 | 可兼任初步审查；自审结论必须记 `independence: self_check` |
| `deepseek-v4.1-flash` | `dsh-opencode-go/deepseek-v4.1-flash` | **可用（R1/R2 日常独立审查默认）** | 工具回合实测通过（≤4 调用窄任务逐字正确 + #431/#428/#429 全部审查回合零死亡，14–16 调用上限） |
| `deepseek-v4-pro` | `dsh-opencode-go/deepseek-v4-pro` | **已注册（R2 升级路径）** | efforts off/high/max；本轮尚未承担完整审查，首个实例建议用于 remediation PR 复核 |
| `glm-5.3` | `dsh-opencode-go/glm-5.3` | 可用（R3 阶段验收点） | 工具回合实测通过（指针键值逐字正确）；稀缺额度，仅关键架构门禁 |
| （历史）`qiyuan-inter/deepseek-v4.1-flash-1017` 等 | `qiyuan-inter/*` | **不得再用于审查派发** | 2026-10-28 事故：6 个审查子代理无输出死亡 + 4 死 1 慢；通道是否修复未验证，且 og 面已是正源 |

**规则**：任何审查派发前必须重新确认 route 存在（`list_subagent_models`）；模型不可用与"额度不足"是两件事，
都必须在台账里区分记录。路由是否真正可用以**工具回合实测**为准（单发探针不算，DEV-2 教训）；新会话首次
使用某通道时先跑一个 ≤6 工具调用的探针任务。

## 二、风险分级 → 路由（本机落地版）

| 级别 | 本仓库典型对象 | 路由 |
| --- | --- | --- |
| R0 | 纯格式/注释、不改语义的文字修订、不改测试逻辑的机械变更 | `qwen3.8-flash-next` 自审 + 确定性检查；可不启外部模型 |
| R1 | 局部 bug 修复、单模块实现、接口不变的整理、一般单测/局部回归 | `dsh-opencode-go/deepseek-v4.1-flash` 一次独立审查 |
| R2 | 跨模块接口、状态/生命周期/异步、测试基础设施实质调整、复杂故障修复 | `deepseek-v4.1-flash` 主审；升级位 `deepseek-v4-pro`（已注册；不可用时标 `HOLD` 或记 `independence: unverified`，不伪造升级） |
| R3 | 中心 Host 装配/工具接线/模块边界、Leader/Review Router/审批节点职责、权限与 IO 与网络隔离治理、关键状态机与并发所有权、测试世界与验收机制与工程基线的系统性重构、决定下一阶段能否开始的阶段验收点 | Qwen 整理证据 → `v4.1-flash` 常规独立审查 → 修复 + 确定性验证 → **阶段验收点**用 `glm-5.3` 做关键架构审查 |

**本仓库判定要点（避免把 R3 判低）**：涉及**判据语义、验收台账、等价性论证、宿主沙箱 ENV_BLOCK 判定、
boot 预算**的变更一律 ≥R2；G4/G5 这类"决定下一阶段能否开始"的晋级审查是 R3。**涉及设计契约、工程纪律、
权限、安全、测试判定规则的文档变更不是 R0**（例如 gate 文档、路由文档、判据说明）。

## 三、额度治理（本机现状）

- 本机 shell **无 OpenCode Go 额度 API 可见**（`env` 无相关变量，`~/.dsh` 为红线不可读）→ 所有
  `budget_status` 一律记 `unknown`，`estimated_cost`/`actual_cost` 记 `null`（**不填 0**）。
- GLM-5.3 内部软预算（官方 5h $3 / 周 $7.5 / 月 $15 的 50% 为默认上限）：只用于 R3 阶段验收点，
  单 PR 至多 1 次完整审查 + 1 次针对性复核；预计超出软预算不自动启动。
- `deepseek-v4.1-flash`：可较高频，但每次仍须限上下文（≤ ~30 文件、命令输出必须截断）与限工具调用。
- 不得用自动重试绕过额度或不可用；不得把同一底层模型的不同别名当独立交叉审查。
- 降级链：`glm-5.3` 不可用 → `v4.1-flash` 做完可执行部分 + 高级门禁保持 `HOLD`；
  `v4-pro` 不可用 → `v4.1-flash`；`v4.1-flash` 不可用 → Qwen 初检并显式标注"缺独立模型审查"，
  R2/R3 不得伪造 PASS，输出 `HOLD`。**额度不足绝不降低风险等级。**

## 四、每个审查任务的硬约束（存活纪律；这不是风格偏好，是可用性前提）

1. **窄幅**：一个审查子代理只查一个维度（供给完整性 / 判据保真 / 叙事与字节一致 / 范围冻结回执…）。
2. **输出封顶**：所有命令输出 `head -25`/`tail -12`；回复 ≤12–20 行。
3. **增量落盘**：报告文件**先创建后追加**，每完成一检查项立即 append（qiyuan-inter 事故后此纪律 0 死亡）。
4. **硬工具调用上限**：≤16–18 次；brief 写明 "YOU MUST FINISH ALL STEPS IN THIS TURN" + pwd/branch 自检。
5. 审查者**只读**：不改代码、不扩范围、不启 Host、不碰 `:3080`/`~/.dsh`；**一律独立 detached worktree**
   （`git worktree add .worktrees/rv-<pr>-<n> <head>`），绝不进实现 lane 占用的 worktree。
6. 上下文按 §五清单给，**不发全仓/全日志/全会话**；发现并屏蔽令牌类内容。

## 五、审查者必须读到的最小上下文

变更目标与契约摘要 → 相关 diff + 最小源文件 → 适用验证规则（`docs/TEST_METHODS.md` §9、判据文件、
`DEPENDENCY-EQUIVALENCE.md`）→ 测试结果与失败证据 → **必须回答的具体问题**。
本仓库两条硬性证据规则：等价性行必须引用记录**自身**的 `teamSha` + 参照 commit + **逐字 diff 输出**
（散文 "is empty" 不算证据）；SKIP/REFUSED/ENV_BLOCK 永不等于 PASS。
补充（R-G4R 轮教训）：**引用他文档的结论时必须逐字核对被引段落**——以"意译+指向"冒充"出处"会在
closure 复核中被判 NOT-CLOSED（R431 finding 4 实例）。

## 六、决策台账

每次路由/审查结束追加一条 YAML（格式见用户指令 §七）到
`dev/agent-workflow/evidence/review-routing-20261028/ROUTING-LEDGER.md`（tracked；接管会话在 gitignored
scratch `.artifacts/review-routing/LOG.md` 维护的条目已随本文件所在 PR 一次性入库，此后新增一律进 tracked
台账）。缺 findings 输出空数组；`PASS` 只代表"本审查范围内无未解决阻塞项"，不代表工程门禁通过；主代理
不得自判 PASS。审查发现中**不属于当期 PR 范围**的整改项登记同目录 `REVIEW-REMEDIATION-20261028.md`
（含登记时的候选冻结/时序约束）。
