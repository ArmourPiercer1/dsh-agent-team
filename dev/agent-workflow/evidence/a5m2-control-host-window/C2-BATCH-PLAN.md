# M0-B171–173 五工具 CONTROL 合同 × 现有矩阵短核 + 合批方案（无 GO，未 boot）

冻结合同要求（root 2026-10-24 明述）：83 request → **合法 reviewer** resolve → **业务消费**；
85 list / 87 grant / 88 revoke 正控；**伪 reviewer / 跨 root / 低 rung / 部分 effects = 不 allow**（负控）。
当前 B 纵切（83→85→84+身份负控）是**最小子集，非五工具全 C2**。

## 短核矩阵（tier 如实；三窗 raw：runs-…T12-13-10Z / T13-08-17Z / T13-22-29Z）

| 合同项 | 现有证据 | tier |
|---|---|---|
| 83 request 正控 | 腿已编排（L2），三窗均在 root-start 断点前终止 | **UNREACHED**（kit 旧证据=pre-arm 面，不为本合同背书） |
| 84 合法 reviewer resolve 正控 | 腿已编排（L3），同上 | UNREACHED |
| 84 伪 reviewer/低 rung 负控 | 腿已编排（L4 member-resolve；身份负控判据收紧后仅认 CONTROL_RESOLVER_NOT_AUTHORIZED/明确不可见） | UNREACHED |
| 85 list 正控 | 腿已编排（L3 前段 list 必须答出 r83） | UNREACHED |
| 87 grant 正控 | **未编排**（当前场景无 grant 腿） | GAP |
| 88 revoke 正控 | **未编排** | GAP |
| 业务消费 | 明确未测（早前缩圈裁定如实保留） | GAP |
| 跨 root 负控 | 未编排 | GAP |
| 部分 effects 负控 | 未编排 | GAP |
| 外层全链（boot→MOUNTED→mount gate） | 三窗实测 PASS polls=1（新包上重复） | 已测（非五工具本体） |

断点轨迹（非验收）：no-native-subagent-visible → 84 placement 双注册 → `sandboxPolicy without inject`（每步严格后移；当前 raw 保，专家只读核中）。

## 合批方案（复用现 driver/公开接口；单窗合批，禁每条单开 Host）

前置=主 sandbox 暗态小修落地新包 → 仅换 pin（既定程序）。同一窗口内按 mock 场景顺序加腿
（每腿=1 个模型回合，估 +6 回合 < 300s 外层；HOME 增量 << 64MiB）：

- L5 业务消费：84 ALLOW 后 member 依被批 effect 执行标记动作，transcript 断言消费事件存在
- L6 87 grant 正控：合法 reviewer grant → 断言 effect 生效；L6b 88 revoke → 断言撤权后再 request/resolve 链改变
- L7 跨 root 负控：以 foreign rootSessionId/requestToken 变体 resolve → 断言拒绝 typed 错误
- L8 部分 effects 负控：resolve ALLOW 携带篡改子集 effects → 断言拒绝（合同"部分effects不allow"）
- 复用既有 L1–L4（83/85/84/身份负控）不重写；每腿独立 callId 唯一、role=tool isError 解析判据不变
- 判据法不变：任何腿未达=UNREACHED，不得以"最小子集"名义记五工具全 C2；失败原样停

**执行边界**：现无 GO；本文件仅方案+短核；不装、不改产品、不新框架、不新 matcher/ledger；
三窗 raw 原样；A 独立余项不跟跑。
