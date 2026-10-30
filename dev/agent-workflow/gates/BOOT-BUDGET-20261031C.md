# BOOT BUDGET LEDGER — USER-RULING-20261031（C 册：总额 **36 starts**，从零另计；B 册 24 的已用 12 不迁入本册，B 册封卷保留全部历史收据）

裁决来源：USER-RULING-20261031 §1（外部审查意见经用户背书，2026-10-31 下达）。基准 master=`89d96a13d`。

## 分池（新可用 24 starts）
| 池 | 用途 | 额度 | 已用 | 明细 |
| --- | --- | --- | --- | --- |
| C1 | Agent Control 真实 Host 复证 | 8 | 0/8 | — |
| C2 | 其他 Family 的 L3/L4 验收（含 State Home） | 8 | 2/8 | u7r3-shomev2：2026-10-30T12:22:33Z / 12:26:11Z 两次 spawn（写臂 + 重启臂），预登记=215362c844（push 确认 11:20Z，分支 task/u7r3-shomev2-reg-20261030），收据 dev/agent-workflow/evidence/u7r3-shomev2-20261030/（host-start-budget.jsonl 恰 2 行） |
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

## 已用登记（只追加）
- **2026-10-30T12:27Z（真实 UTC，R-CLOCK-1）lane=u7r3-shomev2 池 C2：2 starts 已用（2/2，登记额度精确用尽；C2 累计 2/8）。** 被测对象=origin/master tip `1d884efdb`（#483 后生产 Home 法）；Host=pristine test-use @ `639ed01539`。start#1 12:22:33Z（写臂：DSH_HOME unset + HOME=<workspace 内 operator home> + testHomeGuard 键缺省 → agent-state 落 <home>/team-state/agent-state/<realmId>/，member todo_write / leader goal 写腿 typed-OK，真实 ~/.dsh 零沾染）；start#2 12:26:11Z（重启臂：/proc 证 DSH_HOME 缺失持久化、boot-1 realm 逐字节读回 IDENTICAL、新 store 实例读回、STATE_APPLY_REPLAY 拒绝 + 零写、0 ALIAS）。裁决 PASS；披露：boot-1 驱动在工件捕获后 ReferenceError 崩溃（非产品类，未重 spawn，run-shv2-1.json 离线重建 recover-boot1.mjs，其 /proc-only 两格记 NOT_CAPTURED_PERSISTED_JOINT_WITNESS 未洗白）；boot-1 宿主由沙箱 PID-namespace 收尾回收（端口释放已验）；p6t6 观察行因自身拒 DSH_HOME 缺省而不出席（改 boot-marker+/team-remote 就绪）。收据：`dev/agent-workflow/evidence/u7r3-shomev2-20261030/`（host-start-budget.jsonl 恰 2 行、run-shv2-{1,2}.json、logs token 已脱敏）。
