# 八、现有代码的重构与退役方案

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 迁移原则
以现有功能/安全回归为原点，`freeze old → build new under new DSH → real parity → switch per family → delete old`；不是先删 FamilyBody 再重新实现。v0.1.6 在 #758 合并后按既有程序冻结；本提案不修补 v0.1.6，也不移动现行 Authority 或 Host pin。

## 2. 资产与目标
| 当前文件/包 | 目标 | 必须保留/验证 |
|---|---|---|
| `member-io-policy` | 保留作为纯 EffectiveBoundary 编译与 invocation/trust 辅助 | Member × Tool 三轴不可突破；版本兼容 |
| `team-services/src/install.ts` | 收敛统一 scoped FS/Web/Subprocess/Terminal service | Provider 绑定身份、fail-closed |
| `team-services/src/mount.ts` | 通用 NativeBindingAssembler | apply、延迟注册、真实 source/Definition 校验、dispose |
| `sandbox-provider` | 保留并强化为 OS SandboxGateway | Landlock/bwrap/netns、租约、取消、真实退出 |
| `team-services/src/terminal-pty.ts` | 收敛到统一 OS Domain Adapter | 持久 PTY 原生能力、策略代际 |
| `tool-dispatch` | 保留 Guard/lease、瘦身 | setup→ACTIVE、teardown drain、change 事件 |
| `operation-permission` | 权限逻辑保留、边界统一 | 不把参数权限适配变成第二执行结算权威 |
| `control/service.ts` | 扩展 ExecutionId Journal/投影 | 原有 ControlCase/Grant/Stop 不迁移成第二授权系统 |
| `team-tool-plane.mjs` | 分解非重复资产，退役自己的原生替代执行链 | Team 原生业务工具保留，审批事实不丢 |
| `a5p5-tools` | 功能与黄金向量迁出，逐步淘汰重复 pipeline | 不误删仍使用的 Team 专属工具逻辑 |
| `tools/families/{fs,search,process,web}` | 逐项撤回对同类上游工具的业务替代 | 同版本 Native parity + I/O 负控 |
| `native-bash-tool.mjs` | 新共享 admission/settlement 生效后退役特殊 wrapper | 保留 Bash schema/render/PTY/错误一致性 |
| `agent-bindings.mjs` | 拆出装配、绑定、Guard、Provider 接线 | 不改变 Team 身份/冷启动与 Stop |

## 3. 减少目录重排
可用现有目录形成逻辑五组：`execution-binding`、`execution-boundary`、`execution-services`、`execution-sandbox`、`execution-settlement`。不是一开始必须新增五个包或重命名所有代码，先冻结接口与责任/唯一 Writer，再移动实现。DSH 的工具注册、Executor、Pipeline、Session 使用原版，不在 Team 内建立等效替代类。

## 4. 三项禁止性迁移
- 不能把旧受限 Family 的 PASS 当成新原生/新版 Host 的 PASS；重新做真实效果负控。
- 不能因删掉 ToolPlane 就意外删除 Team 自己的 `team_*` 业务工具和 Control/Approval 不变量。
- 不能在未关闭旧 Scope 在途调用或旧 Process Domain 之前解除旧 Guard/deny mask，导致 inherited 原生工具绕路执行。

## 5. 与单独设计工作包关系
[AER](../../active/alpha5-sandbox-first/WP-AGENT-EXECUTION-REALM.md)：作为下一版本扩展 Leader/Officer/Member I/O Boundary 的输入，但不借此重写 Role/Review 决策。[F-2 Goal Domain](../../active/alpha5-sandbox-first/WP-F2-GOAL-DOMAIN-AUTHORITY.md)：Goal 属于 Host Domain，不应因 A2C-2 分类错误被迫与 Bash 分配到不同 Member；其调整需独立审批，不由工具重构自动修改 Blueprint/deny。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
