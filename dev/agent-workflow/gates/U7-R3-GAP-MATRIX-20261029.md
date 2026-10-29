# U7-R3 逐工具缺口矩阵（2026-10-29，待用户确认后才动）

数据源 = master 台账 dev/agent-workflow/ledgers/u7-tool-acceptance.json 实测：
L1 31/31 · L2 31/31 PROVEN；L3 14/31 PROVEN → **缺口 17**；L4 19/31 PROVEN → **缺口 12**（11 DISCLOSED + 1 NOT_VERIFIED）。总缺口 29 格，下方四类分派逐格对账 17+12=29，无重复无遗漏。

## 类别① mock-lane 可证（无 boot）→ Owner=主 Agent 整改车道（U7-R2 之后随常规包做）
L3 ×10：team_glob, team_skill, team_cordis_inspect_list（team 面复用 ac:refusal 判据形状 + 新 candidate 绑定）; job_list, job_kill（jobs 车道 C1）; todo_write, create_goal, get_goal, exit_plan_mode（goal/plan 车道，#443 落地的 state-family C1 harness 直接可证）; workflow（其 L3 走 state-family mock 拒绝臂）。

## 类别①/③ 双臂拆分 → mock 臂=整改车道；原生臂=G5 真实主机 C3
edit, bash（L3 ×2）：mock 可证 = 治理层拒绝语义；**不可** mock 的 = 原生 confinement 真实拒绝（Landlock 部分支持是已知缺口），后者并入 G5 候选 C3 清单（用户“有条件放行”范围内）。

## 类别② candidate-bound live C2 复证（boot 预算=用户保留事项，与 G5 候选一起问）→ Owner=G5 候选 C2 腿
L3 ×5：subagent, subagent_fork, send_message, list_agents, list_subagent_models。
L4 ×6：同上 5 工具 + interrupt_agent。
依据 = 台账 DISCLOSED 理由原文：“live re-proof is deferred to the candidate-bound C2 lane”（旧证据绑 teamSha ab8a5f236 前产品码）；send_message 另注“live 需 steer 活成员”。这些格**不单独要预算**，随 G5 候选构建的 boot 包整体裁决。

## 类别③ 真实主机 → G5 C3 清单（上列 edit/bash 原生臂）或裁决
pwsh（L4 正臂）：本机无 pwsh。二选一：装 pwsh 的真实主机腿，或产品裁决“pwsh 不入 alpha.5 支持面”（矩阵 M-07 现状 NOT_VERIFIED 即诚实态）。

## 类别④ 产品范围裁决项（非工程缺口；裁决前台账保持现状，机器门保证不失实）
read_image（L4）：受保护中心准入语法无 grantable rung → 候选裁决“类型化拒绝即 L4 终态法律”。
workflow（L4）：“no recognized public host face at the pin” → 是否纳入 L4 范围。
ask_user_question（L4）：生产 mount 无 UI 端口 → 交互式问答是否属团队面。
present（L4）：host ctx 无 publication 面 → 同上。
web_search（L4）：“we never invent a provider” → 维持 NOT_VERIFIED 法律或另立 provider 集成工作包。

## 对账
L3: ①10 + ①/③2 + ②5 = 17 ✓   L4: ②6 + ③1 + ④5 = 12 ✓   合计 29 ✓
## 建议执行序（供用户确认/修改）
①与①/③mock 臂 → U7-R2 后常规整改（无 boot）。②→并入 G5 候选 C2（boot 预算随 G5 一次裁决）。③原生臂→G5 C3 清单。④→逐项产品裁决，未裁决前不改动台账。
