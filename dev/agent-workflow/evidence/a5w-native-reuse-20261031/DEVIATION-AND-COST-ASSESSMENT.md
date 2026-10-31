# DEVIATION-AND-COST-ASSESSMENT — 偏移定位与成本评估

> 书写时刻 = **2026-10-31T05:32Z（整改轮 `date -u` 实测）**——首版锚点 05:05Z 系笔误（晚于自身 commit `d121b4ba3` @04:58:05Z，不可能成立；R-CLOCK-1 违例经独立审查发现，正文其余时刻不动）；基线 = `f995ce7814`；判定输入 = 同目录 ORIGINAL-INTENT-TRACE.md（意图/收窄）与 NATIVE-REUSE-AUDIT.md（逐工具证据）。
> 纪律：不因「存在偏移」而否定合理安全实现成本（用户红线）；本文件对 ②/③ 类一律不计偏移成本，只在 ①/④ 类计。

## 1. 结构性偏移（一处，全局性）

**偏移 = 治理装配合同（family-body 唯一常态 + named-bridge 例外）把「执行体复用原生」降格为不可声明的工程暗道（`hostService` 注入端口 / bridge 注入），导致同一复用意图在不同 Family 里实现深度不一致**：jobs 做到 byte-identical（100% 复用），agent-control/ui-ask/inspect/read_image 做到服务级复用，而 web/state/skill 滑向实现级复制。收窄本身未经选型审查（详见 ORIGINAL-INTENT-TRACE.md D 节），且与用户裁决①②③（优先复用已存在公开实现；公开服务重装优先于重实现）方向性冲突。

**修复该偏移的最小架构动作（不改安全语义、不动 33 条保护路径）**：给 `execution.via` 的放宽走 PR #369 自己写明的既有通道 ——「widening is the reviewed path」。两个候选形状（都保留 definitions==claims 同名装配与 kernel 三义务）：

1. **最小**：新增 `execution.via:'host-service'`（或允许 `provider-backed` + 新 backing 名）= 「定义壳 Family-owned、执行体 = 命名宿主公开 service，经注入端口绑定」——把已经存在于四个 Family 的事实升格为可声明、可被 CI/账本核验的第一等模式（贡献 schema 增加 backing 词表项即可；schema 校验器/assembly 均已有 provider-backed→named-bridge 先例可循）。
2. **更省**：不动 schema——承认现状，只把「复用宿主公开 service 的执行腿」列为各 Family 的**审计字段**（contribution `notes` 或 natexe 账本列），并在 obligations 生成器加 `reuse_surface` 字段，使 CI 能问「这一行为什么不复用 X」。

两者取舍 = 架构席裁决；本审计仅证明**不加声明位也能工作**（jobs/agent-control 为活证）与**缺声明位导致复制漂移已经发生**（web/state/skill 为活证）。

## 2. 逐工具偏移成本（仅 ①/④ 类；成本三轴 = 维护面 / 上游升级风险 / 验收路径长度）

| 项 | 维护面成本 | 升级风险（宿主 pin 639ed01539 → 未来版本） | 验收路径成本 | 偏移定性 |
|---|---|---|---|---|
| `web_fetch` 自有 transport + 输出语义复制（vs `ctx.web.registerFetchProvider` seam，宿主 web/web/src/types.ts:111-119） | web-transport/fetch-executor ≈1,850 行整包中 fetch 侧持续自维；宿主 tool-web 演进（截断/渲染/provider 行为）零传导 | **高**：宿主 fetch 语义任何变化 Team 无感（truncated 三源语义已各自漂移一格：宿主 fetch.ts:264-384 vs Team 自有契约） | 现状 L1-L4 已 PROVEN——**迁移反而重验 L2/L4 + C2 目的地负臂**；不迁移则每次宿主升级需人工 diff 语义 | ①+④；③动机（redirect-hop 门）与 seam 兼容，不豁免复制 |
| `web_search` 无官方 provider 适配（宿主 web-search-deepseek/exa/perplexity + registerSearchProvider） | 低（shape 层 ~百行级）；但 L4 缺口长期挂账 | 低-中：provider 接口漂移影响适配器 | 缺口不迁 = U7-R3 ④「集成走正式配置」工作包迟早仍要做；做 = 直接复用 L4 正臂材料 | 缺失型偏移（该复用未复用） |
| goal 三行状态机/store 复制（vs 宿主 `ctx.goals` 公开 service） | agent-state-family 2,351 行中 goal 域自维；宿主 tool-goal 502 行演进零传导（goal 语义含 max_rounds/blocked 判据等已见漂移面） | **高**：goal 语义在宿主活跃演进（本仓 #364 U6 线自身即在改 goal 用法） | L4 全 PROVEN；迁移 = 五格重验 + L3 缺口补齐合并做 | ④+裁决③命中；R2/适配未试 = 无失败证明 |
| `todo_write` 校验/投影复制（宿主无公开 todo service） | law 复刻面 ~250 行级；宿主 tool-todo 373 行演进需人工盯 | 中：todo 语义稳定但投影 shape 属宿主 UI 契约 | 同上（同 Family 同 boot） | ④弱偏移：无 service 对象，复制有客观理由；缺最小复现证明归档（裁决④程序未走） |
| `team_skill` loader 复制（vs `ctx.skills`） | loader 语法+限额 ~数百行内；宿主 skill frontmatter 语法演进零传导 | 中：skill 生态在宿主活跃（技能目录/字段扩展） | L3 缺口本就要补（类别①） | ④轻偏移 |
| 结构层：hostService 无声明位 | 每 Family 各自发明端口形状（5 种已分化） | schema 升级无法机械校验复用腿是否断裂（端口缺席 = 运行期 typed refusal，账本静态不可见） | 每新增复用 = 一次 bespoke review | ① 制度成本（一次性架构动作可消除） |

**不计偏移（②/③ 类，明确豁免）**：ControlledFs read/write/edit、ConfinedProcess bash/pwsh、rg spawn confine、GovernanceKernel/PA-Control-Grant、PTC escalation 行、Jobs owner/cancel 诚实边界、全部 admission/grant 前置、Tier A ceiling、destination/meta-arm 效果声明、anchor/pre-spawn 检查、read/write L3 live 缺口的诚实账（G5 预算）——这些是「为独立权限判断增加的检查」与「实际执行边界不可替代的安全中介」，按用户原则保留。

## 3. KEEP 裁决清单（不主动返工，除非后续审计证明例外）

按用户直接指令 + 本审计复核，以下维持 KEEP 且**不进入任何迁移队列**：

1. **ControlledFS**（fs-family read/write/edit）：S0 M-01..M-03 原文即要求 Team 受控 FS 中介；宿主读/写工具无治理读窗公开 seam（ctx.fs = 写向 sandbox，post-poc §0 行）；read_image 已按正确姿势复用 ctx.attachments。**例外条件**：若宿主未来暴露 realm-scoped read-window provider，走 widening 评审。
2. **受限进程**（process-family + sandbox-provider）：Landlock OS_ENFORCE 在 exec 前沿施加，宿主 terminals service 无该 hook；S0 M-07 原文「不实现 PTY 生命周期」由 confined provider 路线兑现；PTY 语义未被复制。**例外条件**：宿主提供 per-exec confine seam。
3. **GovernanceKernel / PA-Control-Grant / 三义务（admission/grantMint/grantConsume='kernel'）**：G1-F 冻结资产 + 33 保护路径 + byte-pin 体系；偏移问题全部发生在其**外围装配合同**，kernel 本体无偏移证据。
4. **PTC/MCP 现有安全边界**（ptc-escalation-row 六腿语义、approval/request 公开瀑布、run_code 保留传输）：post-poc §3.4「保留传输不可覆盖」原文；MCP 未交付面属 scope 裁决非复用问题。
5. **Jobs named-bridge**：复用形态即正确形态，无返工理由。
6. **agent-control 七行治理壳 + hostService 执行腿**：执行体已在宿主；若 §1 架构动作落地，此 Family 是 host-service backing 的示范迁移对象（仅声明层搬家，零语义改动），**非功能返工**。
7. **team_grep/team_glob（R3）**：上游 helper import 即用户裁决①③的样板实现。
8. **原生 grep/glob 直通不接管、team_* Leader 域、str_replace_editor（NONE_SHIPPED）**：均为 S0/账本允许形态，无需迁移。

## 4. 风险登记（若维持现状不动）

- **升级断层**：web/state/skill 三域的宿主语义演进无传导机制（唯一切片 = 宿主 pin 升级轮的人工 diff；当前 pin 升级即需一次性重 diff）。
- **账本-实现漂移**：TOOL-CAPABILITY-MATRIX-9b2 已实证先例（write/edit 行 NOT_IMPLEMENTED 落后于 #390/台账 PROVEN）；复用面若不进账本字段，同类漂移会复制到「复用/复制」维度。
- **制度漂移**：无声明位 ⇒ 下一个新 Family 仍可能默认全自研（收窄自我强化）。
