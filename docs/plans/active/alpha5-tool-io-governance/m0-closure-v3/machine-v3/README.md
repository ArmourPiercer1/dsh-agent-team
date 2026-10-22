# machine-v2 — P3 修订候选（根有界单：只修 P3；旧 `../machine/` 原件保留未动）
> 状态（2026-10-23，PR357 收口）：当前有效 fixture=**44 例（4 正 + 40 负）**，终态收据=run7 44/44 rc=0（键集负控=run6-probe，均在 receipts/）。文中 25 例（4+21）与 40/40 均为历史轮次计数，保留为历史，非当前有效值。checker/fixtures 未改、未重跑。

中心合同=`../M0-A-LIFECYCLE-CONTRACT-v1.1.md`（17609 B `208ba98c…`）＝选定候选，非已实现、非 M0 冻结。

## 精确命令（唯一入口，read-only）
```
cd <本目录> && node check.mjs [recordsFile] [examplesDir]
# 默认 recordsFile=../route-records-v3c.json(55233426…)、examplesDir=./examples
# 覆盖对象也校验固定矩阵：../../TOOL-CAPABILITY-MATRIX-9b2.md（b7062a9d…，运行时 sha 断言）
```
副作用披露：仅 `fs.readFileSync/readdirSync` + `crypto.createHash`（纯计算）；无网络/子进程/产品/Host/写操作——**checker 不写盘**，收据由外层 shell 重定向。rc：0=两 PASS 齐，1=任一失败。

## 三态输出
- `fixtureSuitePass`：25 fixture（4 正 + 21 负）全部 actual==expected **精确多重集**（按 error-priority 排序后逐位相等）；负例预期错误**不计入全局**。
- `candidateShapePass`：仅对 `route-records-v3c.json`：meta/enum/eff 词表/own-layer 双向/N-A-surface/ceiling/**覆盖精确集合**（矩阵附录 A 实时解析 83 名 + 别名 3 + surface 4 + trio 双列规则；矩阵 sha 断言）。
- `freezeEligible`：**恒 false**（P1/P4 未闭 + 中心合同 PROPOSED + v2 冻结线保留），与两 PASS 分立。

## 运行收据账（receipts/，全保留）
| run | rc | 结果 | 说明 |
|---|---|---|---|
| run1 | **1** | 崩溃 ENOENT（stderr 存 run1.err） | 我的编码错误：把 `coverage.source`（解析法描述名）当路径。node v24.21.0，2026-10-22T17:54:35Z |
| run2 | **1** | 1 负例失败 + candidateShape 20×E_MISSING | 编码错误×2：①checker 空串判定未按 spec.required/nonempty 区分（可选 note:'' 误报）；②neg-ceiling-missing fixture 生成式写错（`{"k":v for…}` 字典推导）产出空记录。**未改任何 expected 语义** |
| run3 | **0** | fixtureSuitePass=True，candidateShapePass=True，freezeEligible=False | 上述两处局部修复后；17:55:35Z |

## 独审 P3-A/B/C 闭合映射
A1 undefined `unique`→新实现无此标识符；A2 三桶分离（candidate/fixture-expected/actual），负例预期不污染；A3 执行入口+精确命令（上）+run1-3 收据。B 严格状态图（`schema.lifecycleGraph` 边集，[BODY] 跳链、ASK 跳 consume 均触发 E_TRANSITION——run2/3 实证 neg-body-jump/neg-ask-prepare 拦截）；身份实检：grant↔correlation/fingerprint/consumptionProof↔request/decision、hostToken.serialized=false、fixtureRef 披露"仅测试可信 fixture，不证明真实 Host/不可伪造身份/OS 安全/C2"；PA 消费≠Control 消费≠invocation 终态三分字段（bodyStarted/paConsumed/cancel.ledgerUnchanged），LEASE_UNCONFIRMED=pos-lease-unconfirmed-pa-consumed 正例、cancel-before 零 ledger 正例、两类谎报负例（E_LEDGER_CLAIM）。C enum 三方同源生成（schema=checker=d.ts 同一 schema 文件）；覆盖=精确集合等值非计数；eff-vocabulary 与 error-priority **实际被 checker 读取消费**；metaFields 实检；own-layer 双向；d.ts Scope=20 实值同 schema。README 计数=25 例 4+21；freezeReasons 无 d2 旧态。

## 边界声明
本件只证明合同样例一致性；不等于真实 Host、不可伪造身份、OS 安全或 C2；不授权把 PASS 读作 M0 冻结；fixture token 是测试可信引用。遗留：无（本工作单内）；跨包遗留仍在 P2 §9 索引（P1/P4 侧字段属其工作单）。

---
# machine-v3 增补（根 P3 最小闭合单 8 条，2026-10-22）
machine-v2 原件与 run1/2/3 收据原样保留（`../machine-v2/` + 本目录 `receipts-history/` 副本）。v3=同一 checker 的 8 条有限合同检查，非架构重写。
**固定 93 键**=`coverage-keys-expected.json`（来源=已核 P1 route-records-v3c.json pin `55233426…`，sourceSha256 运行时断言）；矩阵附录读取加 `mx.size===matrixNameCount(83)` 层级断言；键集双向差分（数量不变不豁免，实跑 probe=run6：单 scope 翻转 → 恰 2×E_COVERAGE，rc=1）。
**收据**：run4 rc=1（2 fixture 不齐：其一为 fixture 建模错 Prepare 失败例残留 paConsume=true——修 fixture 本体；其二 decision 缺失伴 consumptionProof 悬空 E_IDENTITY 系规则 7 正确事实——expected 对齐，两处均非降合同）；run5 rc=0 **fixtureSuitePass=true(40/40) · candidateShapePass=true · freezeEligible=false**；run6-probe rc=1（预期拒，argv 探针）。
三态分立与边界声明同 v2 节（不声称运行时安全/C2/M0 冻结）。
