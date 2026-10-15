# decision.md — Alpha.5 P0 路线决定记录（PoC 级，供后续实施计划直接引用）

> 状态：**P0 = EXECUTED-PARTIAL**（fixture 面完成 + 真实宿主冷启动/装配面 PASS + 宿主级 Team world BND 为 BOUNDED-DEFER）。
> 本文件不是产品 GO；每族决定均附"进入实施前的强制前提"。证据指针见 P0-SELECTION-REPORT.md §1 与 EXECUTION-LOG.md。

## 1. 机制基座（已由 R1/R2 独立复跑证明，fixture 级）
- **D-1 R1 装配单元 = 选型主路线**：`own-scope 同名注册即独占分发`（BND-01/preset 拓扑腿）+ `restrict 先行遮蔽` + `原子有序卸载`。实施计划必须把"装配/卸载"实现为单一有序单元：**先卸 Adapter → 排空在飞调用 → 才撤 mask**；反向时序有确定性危险反例（NEG-1：dispatch 期 index.ts:1578 晚期重解析回到原体，原体 1 次）。
- **D-2 guard 是唯一不可绕过的拒绝面**：pre-execute 前段 allow 不绕过 guard（NEG-6）；guard 注册于 Team 作用域即层隔离。实施中一切安全拒绝走 guard/restrict，不走 listener 约定。
- **D-3 agentless lane 必须显式处置**（NEG-2）：无 agent 作用域的 dispatch 走全局层，Team Adapter 不覆盖。实施计划的 binding 检查必须把该 lane 纳入（deny 或绑定专用策略）。
- **D-4 覆盖不变式**：`T_dispatchable ⊆ T_governed` 违反时缺口立即被利用（NEG-12 直接实证）；"隐藏但仍可执行/消失但仍可达"两类都要测（preset PENDING 形态 NEG-8 = 服务缺失时静默零注册，装配必须显式校验服务）。

## 2. 逐族决定
| 族 | P0 决定 | 实施前强制前提 |
| --- | --- | --- |
| grep/glob | **R3 组合 Adapter**（包根 7 helper + async confine 桥；fixture 12/12 真 rg parity）。R2 服务隔离保留为 fallback：需真实 subprocess 服务前置 | presentationMeta 非包根可复现→渲染层要么自绘要么上游导出；spill/取消/并发在宿主级补证 |
| read/write/edit/move | **进程内 Controlled FS Adapter**（策略在自身 node:fs 调用点，§14.5 语义）。策略必须：realpath **+ (dev,ino) 对象身份**双检（NEG-11）、路径**不 trim**（NEG/FS-04.spaces，NRM-1 同源）、one-shot grant 消费账本（FS-03 设计可用） | INV-1 全覆盖（含 agentless lane）+ 宿主复核；TOCTOU/rename 竞态登记为后续项 |
| bash/pwsh（confined spawn） | **ENV_BLOCK（本宿主）**——嵌套 bwrap/landlock/netns 全部实测不可行；harness 会话本身已是宿主 bwrap 产物 | 需要宿主/管理员动作清单（开放 userns 映射或提供受控 landlock-run 通道）后重跑 §P0-4 正负控；**不是** fork 触发器（guide R4 明文） |
| run_code/PTC | **保留传输 + 内层同管线 guard 治理 = 可行**（内层 dispatch 走同一分级管线，guard 可断内层，原体 0）。族分类 BOUNDED-DEFER | 外层直接 I/O 待真实 ptc-runtime-node 宿主；桥公开构造（PtcRuntime 抽象类）已证，无需 blocker |
| LSP | **严格 Profile fail-closed（拒绝常驻语言服务器）为当前安全兜底**；per-member 隔离在现 seam **结构性不可表达**（池键=仅路径，seam 无策略通道；§6.1 十一字段素材已录 06-lsp/p05-result.json） | 上游接口讨论（池键入策略/每 Agent ctx.lsp/realm 级隔离服务）；本 PoC 不做 fork 也不宣告 CORE_SEAM_BLOCKER（素材移交后续计划） |
| web/jobs/MCP | **NOT RUN**（本轮无网络授权） | 后续轮在允许网络的宿主上跑 P0-2 同型竞速 |

## 3. 对后续实施计划的硬约束（从本轮证据直接可引）
1. 装配/卸载=原子有序单元 + 在飞排空证明（D-1）。
2. binding 覆盖检查必须枚举：preset 继承面、own 层、MCP 后到面、**agentless lane**、pre-execute 后挂 listener 面（S-12 顺序为审计基准）。
3. 服务前置缺失必须 **throw**，不接受 fiber PENDING 静默（NEG-8）。
4. FS 策略三要素：realpath+(dev,ino)、不 trim 保留语义名、grant 一次性消费账本。
5. spill 语义：替换 ToolDefinition 会因精确对象同一性丢 spill（S-09）→ Adapter 需自管 spill/大输出语义并显式声明。
6. 一切 GO 判定的最后一步 = 在 pinned 真实宿主重跑对应反例集（本轮 stage1/2a 已打通装配路径；stage2b 用 c1 kit 链：profiles 行+蓝图 world+mock model+会话驱动，机制两段已分别实证）。
7. 环境动作申请清单（唯一允许的"非代码前置"）：userns 映射或 landlock 强制通道（P0-4）、网络访问（web/jobs/MCP）、可选：真实宿主上的 GUI 维度。
