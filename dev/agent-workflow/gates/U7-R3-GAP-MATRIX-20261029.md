# U7-R3 逐工具缺口矩阵 v3（2026-10-29；USER-RULING-20261029B：主 Agent 自主修订、独立审查+机器门禁后自合；先两工具试点）

数据源 = master 台账 dev/agent-workflow/ledgers/u7-tool-acceptance.json 实测：
L1 31/31 · L2 31/31 PROVEN；L3 14/31 PROVEN → **缺口 17**；L4 19/31 PROVEN → **缺口 12**（11 DISCLOSED + 1 NOT_VERIFIED）。总缺口 29 格，下方分派逐格对账 17+12=29，无重复无遗漏。

## v2 修订记录（外部架构审查 2026-10-29，两条 P1 均经核实属实）
1. **验收语义律（采纳，作为本矩阵铁律）**：台账契约原文 L3-refusal = "**live** typed refusal with zero effect"、L4-positive = "**live** authorized call whose real effect was read back"。因此 **(a) 纯 mock/C1 证据永不提升 L3 为 PROVEN**——mock 只能证明拒绝逻辑（C1 层），提升必须拿到真实 Host 拒绝的 RUN 记录；**(b) 类型化拒绝永不可重新定义为 L4 正向终态**——拒绝属 L3 或产品范围裁决，改"成功"语义消缺口为非法。v1 把类别①写成"mock-lane 可证"、把 workflow L3 派往 State Family mock 臂（跨越被审工具身份边界）、把 read_image"类型化拒绝即 L4 终态"列为候选裁决——三处措辞均已按律改写。
2. 每格增列 **生产接口可用性前提**：Agent Control 数格在真实 Host 接口本身缺位时，重跑 C2 不可能产生正向证明（外部审查 P1-2，已核 agent-runtime-port.mjs：workflow 的 runWorkflow 无生产接线；send_message/interrupt_agent 以 agentTeams 服务在场为前提；list_subagent_models 默认 Tier A 无 allowed 路由时可空转）。此类格先做接口可用性 PoC/接线（涉中心则走具名 Center Interface PR + 用户裁决），再进 C2 批次。

## 类别① C1 拒绝逻辑包（无 boot）→ Owner=主 Agent 整改车道
**产出 = C1 拒绝逻辑就绪（台账 L3 保持 NOT_VERIFIED，note 更新为 "C1-ready, live refusal pending"）；提升 PROVEN 必须等真实 Host 拒绝 RUN 记录（随类别②/G5 boot 包）。**
L3 ×10：team_glob, team_skill, team_cordis_inspect_list（复用 ac:refusal 判据形状 + candidate 绑定，但拒绝用例必须打各工具**自身**守卫路径）; job_list, job_kill（jobs 车道 C1）; todo_write, create_goal, get_goal, exit_plan_mode（goal/plan 车道，state-family C1 harness）; workflow（**改：C1 必须打 workflow 自身守卫路径；跨用 State Family mock 臂作废**——身份证据不可借）。

## 类别①/③ 双臂拆分 → mock/C1 臂=整改车道；原生臂=G5 真实主机 C3
edit, bash（L3 ×2）：C1 可证 = 治理层拒绝语义（不提升 L3）；**不可** mock 的 = 原生 confinement 真实拒绝（Landlock 部分支持是已知缺口），后者并入 G5 候选 C3 清单（用户"有条件放行"范围内）。

## 类别② candidate-bound live C2 复证（**Agent Control 家族**——5×L3+6×L4，此前口头汇报误称 agent-state，以本矩阵为准；boot 预算=USER-RULING-20261029B 专项 12 starts，先证接口可行）→ Owner=G5 候选 C2 腿
**前置（v2 新增）**：下表每格进 C2 前先过"生产接口可用性"核查；缺接口者先接线/PoC，不得仅凭重跑宣布完成。
L3 ×5：subagent, subagent_fork, send_message, list_agents, list_subagent_models。
L4 ×6：同上 5 工具 + interrupt_agent。
接口前提：send_message/interrupt_agent 以正式 Host 配置含 agentTeams 服务为前提（缺位=先裁决 Host 配置或接线）；list_subagent_models 需 Tier A allowed 路由非空的真实配置；subagent/subagent_fork 已有 subagents.start() 生产接线（外部审查核对）。
依据 = 台账 DISCLOSED 理由原文："live re-proof is deferred to the candidate-bound C2 lane"（旧证据绑 teamSha ab8a5f236 前产品码）。这些格**不单独要预算**，随 G5 候选构建的 boot 包整体裁决。

## 类别③ 真实主机 → G5 C3 清单（上列 edit/bash 原生臂）或裁决
pwsh（L4 正臂）：本机无 pwsh。二选一：装 pwsh 的真实主机腿，或产品裁决"pwsh 不入 alpha.5 支持面"（矩阵 M-07 现状 NOT_VERIFIED 即诚实态）。

## 类别④ 产品范围裁决项 —— 已由 USER-RULING-20261029B 裁决（2026-10-29），台账终态按裁决更新
read_image（L4）：**纳入 Alpha.5 必交**。真图输入+读取效果端到端 L4；类型化拒绝不可替代。现有 closed admission grammar 无 grantable rung → 先具名接口设计+PoC（不绕治理内核），实现腿入 U7-R3 批量。
pwsh（L4）：**不属 Alpha.5 必交**。保持 NOT_VERIFIED 诚实态并写入版本范围说明；部分实现保持安全隔离、不得影响原生工具。
workflow（L4）：**暂不纳入亦不排除**——先有界 Host Public API PoC（编排/权限继承/取消/生命周期/结果接口），PoC 后纳入/排除建议提交用户裁决；此前其 L4 保持 DISCLOSED，拒绝≠完成。
ask_user_question / present（L4）：**纳入承诺范围**。需真实生产 mount（UI 端口/publication 面）；缺接口先 PoC/接线（涉中心=具名 Center Interface PR）。
web_search（L4）：**纳入承诺范围**。需 Provider 集成工作包（"we never invent a provider" 法律保持——集成走正式配置，不虚构）。

## 对账
L3: ①10 + ①/③2 + ②5 = 17 ✓   L4: ②6 + ③1 + ④5 = 12 ✓   合计 29 ✓
## 执行序（USER-RULING-20261029B 已批准）
①C1 包（无 boot）可先行，**但不产生任何 L3 提升**。提升全在 boot 包（类别②+①/③原生臂，一次预算裁决）。试点建议（外部审查门禁 3）：先取 team_glob（①+C2）与 job_list（①+C2）两格走通"C1→分支 C2→合并后跨 Family C2→台账升级"全链，再批量。④逐项产品裁决，未裁决前台账不动。
