# MIGRATION-DECISION-TABLE — 最小真实迁移清单

> 书写时刻 = **2026-10-31T05:32Z（整改轮 `date -u` 实测）**——首版锚点 05:08Z 系笔误（晚于自身 commit `d121b4ba3` @04:58:05Z，不可能成立；R-CLOCK-1 违例经独立审查发现，正文其余时刻不动）；基线 = `f995ce7814`；输入 = 同目录四份文档。
> 「迁移」定义 = 改变某工具执行体/复用面的产品代码动作。本审计席零产品码，只给决策表；每行给出理由、前置、验收影响。**「无需迁移」是合法结论并被大量采用**：31 行中 21 行 KEEP + 2 行 BLOCKED = 23 行不动；真实迁移候选 = **4 项**（含 1 项裁决前置）。

## A. 迁移队列（最小集）

| # | 迁移项 | 动作（最小描述） | 理由（引用） | 前置条件 | 验收影响 | 优先级 |
|---|---|---|---|---|---|---|
| M1 | **web_search：官方 provider 适配器** | 写「宿主 `web-search-deepseek/exa/perplexity` → Team provider shape{destination(), search()}」适配包，经正式配置挂载；不虚构 provider 法律不变 | 用户裁决③（公开服务适配优先）；post-poc §3.6「R1 或受信 Gateway」；宿主 seam `ctx.web.registerSearchProvider`（web/web/src/types.ts:99-107）；U7-R3 ④「集成走正式配置」本就是待办 | 无架构前置（shape 现成）；选哪家 provider = 运营配置项 | **缩短**验收路径：L4 正臂从「等外部 provider」变「宿主官方 provider 可跑」；不新增格（web_search L1/L2 不动，L3/L4 材料复用） | P0 |
| M2 | **web_fetch：gated transport 装入 `ctx.web.registerFetchProvider`** | 现 web-transport 的 https-only/origin 锁/hop/bytes/timeout 门改实现为 `WebFetchProvider.fetch(request,signal)`，注册进宿主 seam；治理行保留 admission/destination 效果声明；输出/截断语义对齐宿主 fetch.ts 渲染 | 用户裁决①③；DEVIATION §2 行 1（①+④ + 高升级风险）；③动机（hop 门）与 provider 接口兼容性已论证（types.ts:111-119 自管 fetch） | 建议先走 §1 结构动作（可选，不阻塞）；**无 CORE_SEAM_BLOCKER**——若适配中发现 seam 真不足，那才是第一个合法 blocker 报告点 | 迁移轮重验：L2-mounted + L4-positive + C2 目的地负臂全套（declared==requested、零网络拒绝臂）；现 PROVEN 账作废重计 | P0 |
| M3 | **agent-state：goal 三行复用面调查 → `ctx.goals` 适配（或补失败证明）** | 第一步（零码）：验证 `ctx.goals` 在 Team 挂载 ctx 的可达性与 per-call realm 语义；可达 ⇒ 授权壳 + goals 服务适配；不可达 ⇒ 把不可达证据写成最小复现归档，现实现转正 | 用户裁决③④顺序（先适配，证明失败才自研）；DEVIATION §2 行 3（高升级风险，宿主 goal 语义活跃演进） | State Home V2 lane 协调（todo/plan 同 lane）；todo_write/exit_plan_mode 同场定夺（todo=补证明或收敛；plan=先调查） | 若迁移：五名 L1-L4 重验 + L3 缺口（类别①）并桶做；若不迁移：账本加 reuse_surface 披露字段即可 | P1 |
| M4 | **team_skill：`ctx.skills` 复用面评估（轻量）** | 评估「宿主 skills 快照 + Team bounded anchored 读」组合替代 loader 语法复制；不成则归档证明保留现实现 | ④轻复制 + 裁决③；宿主 tool-skill 全走 ctx.skills（index.ts 实读） | 无 | L3 缺口本需补（类别①），评估并桶；迁移则 L2-L4 重验 | P2 |

**架构伴随动作（非单工具迁移，单列）**：`execution.via` widening（host-service backing 声明位）或 natexe 账本 `reuse_surface` 字段（DEVIATION §1 两候选）。建议随 M1 一并提交评审——PR #369 body 自证「widening is the reviewed path」，走评审即合法，无红线冲突。**不做它 M1–M4 也能做**（jobs/agent-control 先例），做了才防再漂移。

## B. 明确不迁移（高置信「无需迁移」）

| 集合 | 理由 |
|---|---|
| read / write / edit / read_image | S0 M-01..M-03 原文要求 Team 中介；无治理读/写窗 seam；read_image 复用形态已正确（#488） |
| bash / team_bash / pwsh | ③ confine 在 exec 前沿；PTY 未复制；S0 M-07 原文 |
| team_grep / team_glob | R3 原文形态 = 目标状态本身 |
| job_output / job_list / job_kill | named-bridge byte-identical = 复用终点形态 |
| ask_user_question | 已复用宿主 userQuestions（#491/#494）；后续只剩账本 sync 升格 |
| subagent / subagent_fork / send_message / interrupt_agent / list_agents / list_subagent_models | 执行体已在宿主服务；至多在 widening 后搬家声明层（零语义） |
| team_cordis_inspect_list / query | hostService('cordisInspect') 复用中 |
| 原生 grep/glob 直通、team_* Leader 15 名、run_code、plugin_manager | S0/账本允许形态或非原生问题域 |

## C. 非迁移类阻塞（等裁决，不等工程）

| 项 | 等什么 |
|---|---|
| present | 用户 O2-B 裁决：N2 = 向宿主提 `ctx.deliverables.publish` 公开接口 issue（推荐，#498 R-N2 包就绪）vs N3 = 授权模仿注入（需具名 Center Interface PR + 独立安全审查）。裁决前 `UI_PRESENT_PORT_ABSENT` 诚实维持 |
| workflow | U7-R3 ④「暂不纳入亦不排除」：有界 PoC → 纳入/排除裁决；现 LEG_UNWIRED 诚实拒绝 |
| MCP bridge / LSP | REQUIRED 但未交付 = scope 裁决项（bridge:MCP 交付开工批准 / lsp 严格拒绝为 §3.5 既定） |

## D. 总判断

31 个受治理行中真正「复制了原生且可复用而未复用」的最小集 = **web_fetch、web_search、goal×3（一个调查单元）、todo_write、exit_plan_mode（同调查单元）、team_skill**；其中两个「调查单元」允许以「补最小复现证明」收尾 = 合法不迁移。其余 21 行或已处复用形态、或属不可替代安全中介。**全账本无一工具构成 FORK-CANDIDATE；无一行需要 CORE PATCH**（所有候选路径均落在宿主公开 seam/service：registerFetchProvider / registerSearchProvider / ctx.goals / ctx.skills / userQuestions / subagents / attachments / JobRegistry）。
