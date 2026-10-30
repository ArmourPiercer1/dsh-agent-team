# BOOT BUDGET LEDGER — USER-RULING-20261031（C 册：总额 **36 starts**，从零另计；B 册 24 的已用 12 不迁入本册，B 册封卷保留全部历史收据）

裁决来源：USER-RULING-20261031 §1（外部审查意见经用户背书，2026-10-31 下达）。基准 master=`89d96a13d`。

## 分池（新可用 24 starts）
| 池 | 用途 | 额度 | 已用 | 明细 |
| --- | --- | --- | --- | --- |
| C1 | Agent Control 真实 Host 复证 | 8 | 0/8 | — |
| C2 | 其他 Family 的 L3/L4 验收（含 State Home） | 8 | 0/8 | — |
| C3 | 固定候选的跨 Family 集成和回归 | 4 | 0/4 | 候选冻结前不得动用（G5 域，用户单独放行） |
| C4 | 机动与故障归因 | 4 | 0/4 | — |

"不是要求使用完 24 次，而是提供不需要频繁请示的执行空间。正式 G5 PRODUCT-GATE 的放行仍然另行裁决。"

## 控制（全池强制，沿承 + 新增）
1. **预登记律**（沿用）：每次启动前登记确切源码 SHA 与 Host 绑定（PRE-REGISTRATION commit push 确认后方可 spawn；事后登记=违规）。
2. **同类失败停线律**（沿用）：同类失败必须先 RCA 后重试。
3. **禁探索律**（裁决原文列于"三项控制"保留项内；本册首次成文落档）：接口尚未证明存在的工具不得靠反复 boot 探索。
4. **效率门**（新增）：连续数次 boot 未推进任何验收格 → 停耗预算，先优化 World/Oracle/测试编排，回报协调者复核后再续。
5. ENV_BLOCK/NOT_REACHED 不得洗为 PASS；合成注入必须标注合成，不得冒充自然真实 Host C2（USER-RULING-20261031 §3）。
6. :3080 与 ~/.dsh 只读不变式继续全局有效；boot 世界全部工作区内 homes、3180 族端口、用毕拆除。

## 封卷注记
B 册（`BOOT-BUDGET-20261029B.md`，24 starts）于此封卷：已用 12/24（pilot 4、#446 boot 4、crash 复验 2、State Store 生产路径 2）全部收据保留于 B 册原文不改写；本 C 册为自 2026-10-31 起唯一预算权威。

## 预登记（registeredAt 2026-10-30T11:20Z，真实 UTC；R-CLOCK-1 合规）— lane=u7r3-shomev2，池 C2 申请 2 starts

- 目标：V2 = 真实 Host **生产默认 Home** 活体腿（#483 合并后的 master 为被测对象）：
  (1) start#1：operator 环境 = HOME=<workspace 内 tmp operator home>、DSH_HOME **unset**、agentStateEnabled=true、**testHomeGuard 不设**（production arm）→ 写入臂：agent-state 落 <home>/team-state/agent-state/<realmId>/ 且 typed 结果 OK；(2) start#2：同环境重启 → 持久化读回 + 非法路径拒绝腿（显式相对/不存在 Home 仍 typed refusal）。
- 计数=2 starts（写 + 重启，per-spawn 记法，先例 crash 对 2/2）；池 C2（其它族含 State Home）0/8 内。
- 控制随附：同族失败 RCA 停线（boot 类失败先归因再重启）；无 boot 探索（spawn 仅按本登记）；效率门（每 start 必须产出 RUN Record 或点名 blocker）。
- World 纪律：DSH_HOME/tests homes 不用于本腿（本腿验证的正是非 World 默认路径）；:3080 与真实 ~/.dsh 零触碰（operator home 在 workspace 内）；port 3180 族。
