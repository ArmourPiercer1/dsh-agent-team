# ③ LSP / MCP / subagent — 生产接线 × 验收 × 兼容矩阵（Alpha.5 收口轮 · B 路）

基线=d5de7497。枚举法=从注册点现场读（glue/plane/套件头注），非记忆。
列义：**产线接线**=生产装配是否在路径上；**验收**=在册套件/kit；**兼容组合**=成员数×工具面×审批道。未测=如实未测。

## 1. LSP

| 面 | 事实（现场锚点） |
|---|---|
| 产线接线 | **装配纪律 API 已产**：a5lsp2-assembly=R-2 裁定形"policy change⇒销毁重建该成员隔离 LSP 实例"（realm 粒度=每员×每 policy 代一个 provider 实例+一个 confined OS 进程；launcher path+sha 双闸复用）。宿主 `lsp` 名=钉面保留（`team-tool-plane.mjs:263`），**Team 不冒充挂载**。**live 挂载腿未驱动**（agent-bindings 无 lsp 接线=grep 0；R M28 同记） |
| 验收 | a5lsp2-assembly（R-2 形）+ a5lsp2-streaming（R-1 spawnStreaming 平行腿，旧 API 零字节回归=a5p4 66/66 复跑）+ REAL-LSP 30/30×2（R M28 在案） |
| 兼容组合 | 1员×preset-lsp×无审批=**未测**（装面腿即测：preset 翻转+两成员世界各挂一实例）；2员×同 realm 不同 policy 代=互不可见（单元面 R-2 已钉 realm 粒度，装面**未测**）；审批道交叉=LSP 调用属 ask/allow 道的 blueprint 分类=**未测** |
| 宿主依赖 | 真实 language server 二进制=preset 世界自带（REAL-LSP 已实证可用）；无缺位 |

## 2. MCP

| 面 | 事实（现场锚点） |
|---|---|
| 产线接线 | **在产**：glue mcp 挂载机（`agent-bindings.mjs:1445-1693` mcpMountCtx/每 serverName scope 上下文/mcpFibers 重挂守卫）；blueprint 初始静态授权（mcp-blueprint-initial-grant=真实 live glue 复跑）；C-BIND 重绑链（a5p7-mcp-rebind-chain：in-flight 钉定义→tools/change→按 (scope,name) 重读自判）；f15 断供/恢复族（L1/§9.4/L2/L6/L7/L3/L4/L5/多 MCP 隔离） |
| 验收 | 上列全绿在册；kit=mcp-initial-grant-smoke（Gate D 真宿主弧） |
| 兼容组合 | 1员×stdio×grant=绿（套件族）；2员×同名 tool×**各自 scope**=f15 §9.5 多 MCP 隔离腿在册；跨成员 grant 代偿=NC-3 形已钉（异根不保）；**MCP 效果体经 confined provider 执行=无行**（M30：stdio 子进程读/写/网络未过 PR4 治理执行面——PR7 计划原文"stdio 本地进程的读/写/网络需实际 ConfinedProcess"=**未实现面，未测如实**）；remote HTTP MCP 强制在真实 Provider 端=**宿主/上游缺位记录**（计划原文"Team 本地只能准入和可信绑定"） |
| 宿主依赖 | stdio 子进程=宿主 mcp 管理在产；真实外网=ENV 受限记录（PoC-7a 条款） |

## 3. subagent

| 面 | 事实（现场锚点） |
|---|---|
| 产线接线 | **部分在产**：池=宿主 SubagentRuntime（上游 M29 记录，Team 不建池）；glue 取用=`deps.subagents` 懒式（:4934 先例）；**成员排水链在产**（:4715-4772：whenIdle+drainContinuableDescendants+listDescendants 诚实计数 typed 形）；`subagent_*` 四名=钉面保留+flip-drift 律在册（a5-pindir-subagent-flip：preset 翻转不改钉态，双向同文拒） |
| 验收 | 排水链=c1/t12a 系在册；钉面/翻转=a5-pindir 双套件 |
| 兼容组合 | **成员内 subagent 车道端到端=无行**（R 盘点原话；成员派 subagent→排水→结算过 Team 门的端到端组合=未测）；2员×各自 subagent 树互见性=**未测**（池 caller-fence=宿主层，Team 层未加行——如实记）；审批道交叉=未测 |
| 宿主依赖 | 池语义/递归深度=上游（M29 记录，勿代偿） |

## 4. jobs（衔接件，详见 05 号矩阵 D4）

产线接线=C2 已落（`jobsEnabled` 缺省关）；验收=单元 43/43 双档+RED 存档；装面端到端=待 B-ACT-1-DEP+C3；创建生产者=无（confined shell 按名拒 background=在册法律，corded:false 透传为现存活形）。

## 收口口径

- 三族全部**产线状态=分面判定**（接线有的在产/有的仅 API/有的缺行），验收格全部给到 文件:套件 级锚点，未测格不涂绿。
- 缺行三处入账（均为计划原文要求、当前无实现/无证据面）：MCP×ConfinedProcess 执行、remote MCP Provider 端强制、subagent 成员车道端到端。
- 兼容组合矩阵（成员数×工具面×审批道）中除在册格外=**未测**；可补优先级：LSP 装面腿（preset 即测）> job_* 装面（待 DEP）> subagent 车道端到端（需行先于测）。
