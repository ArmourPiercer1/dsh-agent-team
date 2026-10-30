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

## 预登记（registeredAt 2026-10-30T14:21Z，真实 UTC）— lane=u7r3-xval（受控并行验证试验，用户直接指令 2026-10-30），池 **C1（环境验证池）** 申请 3 starts

- **目的**（用户指令原文要点）：核验 TestWorldFactory 双 worktree 真并发（共享租约根/独立 HOME/独立 Workspace/独立日志/固定 Host SHA/原生沙箱预检），C1 串行vs并行对照，及一组「真实 Host 启动 + 轻量 C1」共转试验；产资源效率对照报告。
- **池归类声明**：本试验按 USER-RULING §一 池按**用途**归类——所购全部为「非验收验证（装配/环境）」= C1 池；**不得为任何 Family 记验收格**（分支 C2 不冒充合并后候选 C2；World 启动 RUN Record 来源绑定试验 lane，证据目录独立）。
- 三 start 用途：x1/x2 = P0 双 worktree 双 World 同转（各 1）；x3 = P2 真实 Host 与轻量 C1 共转。P0/P2 各自出 RUN Record 或点名 blocker；沙箱预检必须落 Record；同类失败 RCA 停线；:3080/真实 ~/.dsh 红线与全套既有纪律不变。

## 已用追加（append-only used-count）
- **C1 +3**（记 3/8；lane=u7r3-xval 受控并行验证试验，真实 2026-10-30，用户直接指令，零验收格）：账本 `dev/agent-workflow/evidence/u7r3-xval-20261030/host-start-budget.jsonl` 恰 3 行——line1 token x1 14:56:53Z（真实启动后被 lane 探针脚本缺陷崩溃消耗，RCA=探针 TypeError，孤儿 World 经 reclaimWorld 回收留痕，同类失败律先 RCA 后重试）；line2 token x1 15:02:45Z 与 line3 token x2 15:04:23Z = P0 双 worktree 双 World 同转（:3189/:3190，RUN Record 各 17/17 PASS）。注册用途 x3 **未动用**（预算上限 ≤3 行下的 P2 共转测量折叠进 P0 重叠窗口，见 XVAL-REPORT.md 披露）。:3080/真实 ~/.dsh 只读不变式全程 byte-witness 未动。
