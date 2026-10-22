# 正式 Schema ADR — Blueprint `schemaVersion: 4`（vNext v4）：单点翻档、双解析窗口 {3,4}、「翻档 ≠ 退役」
> **[2026-10-22 banner] historical / superseded-by `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md`** — 本文档的阶段状态与采纳状态（含 PROPOSED 提案）为记录时点，当前执行以该入口为准。设计约束/需求正文**仍有效**（本 banner 不宣告设计失效）；正文未改动。

> **状态：FORMAL（转正随 flip 候选 PR 呈审；采纳裁决 = 本 PR 的 ADR Gate 正常通道：起草者提案 + 三门客观看审）。**
> 本文件是 [S0+PR0–PR8 计划 §11:171](./alpha5-s0-pr0-pr8-implementation-plan.md) 点名 PR8 记录的「正式 Schema ADR」
> （原文：『PR8 再选择明确的 vNext 版本（**建议 4，但须记录正式 Schema ADR**）实现 toolBindings、Read/Write/Network
> I/O Policies、Provider/Execution Boundary Binding、Assurance 引导与诊断；将 Alpha.4 两份 authority envelopes 的
> Scope 语法合法扩展至新操作类型，不引入新 Role Ladder，也不改变已绑定 Blueprint 的生命周期』）。
> 它**转正**候选决策集 [ADR-CANDIDATE-blueprint-schema-vnext.md](./pr8-accept/ADR-CANDIDATE-blueprint-schema-vnext.md)
> （CAND D-01…D-11：转正即采纳，条款正文以 CAND 文件为准，本 ADR 不改写其论证；CAND 头部『状态：CANDIDATE』的
> 三处生产状态声明在本 ADR 采纳后由本文取代，历史原文保留不删）。
> 依据的口径基石（复述，非本 ADR 新裁）：根 17:54Z 台账更正（COORDINATION.md:97）——『**"启用 v4 且保留 v3" ≠
> "退役 v3"**；A-4 真待裁**仅**后者（窗口时长/退出）』；#312 独审结论——『最小真裁决点仍仅 T-1；M-3/M-7=排程非新裁』。

**Owner：** alpha5-v4-flip 轮（V4-ENABLEMENT-ROUTE 阶段②+③ 原子件）。
**落点：** `packages/domain/blueprint/src/schema.ts`（run set 单点）+ `validate.ts` 第四支 dispatch + 同笔 M-3/M-7/套件。
**上游权威：** VNEXT-SCHEMA-ADR（`dev/agent-workflow/evidence/alpha5/prod/VNEXT-SCHEMA-ADR.md` A1–A8/D1–D5/M-1…M-7）
→ V4-ENABLEMENT-ROUTE（`dev/agent-workflow/evidence/alpha5/vnext-semantics/V4-ENABLEMENT-ROUTE.md` 四阶段表）
→ flip-PREP（`dev/agent-workflow/evidence/alpha5/schema-rev/runs/v4-flip-PREP.md`）→ CAND（D-01…D-11 正文）。

---

## 1. 版本决定（CAND D-01 转正 = SHIPPED）

vNext = 整数 **`schemaVersion: 4`**。运行时对版本做**严格成员检查**（精确成员，禁 `>=`/区间推断，CAND D-01 原文），
类型必须是 JSON number（字符串 `"4"` 即拒）；**逐版本钉死独立解析器**——v4 的解析面是 `blueprint-v4.ts` 的平行第四支，
其 core 面**委托**冻结的 v3 校验器（delegation，非 fork），v3 分支禁改由版本洁净 fence 机检。

本轮落地的机面事实（转正「为文」对应的「为实」）：

| 常量（`packages/domain/blueprint/src/schema.ts`） | 翻档前 | 翻档后 |
| --- | --- | --- |
| `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` | `[3]` | `[3, 4]` ← 单点翻档 |
| `DEFINED_BLUEPRINT_DOCUMENT_VERSIONS` | `[1, 2, 3]` | `[1, 2, 3, 4]` |
| `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`（派生） | `[1, 2]` | `[1, 2]` — **不动** |

错误名登记（CAND 附1 的 candidate→shipped 映射已在册逐腿可检：`a5sr5` N-V 负例表）：
`SCHEMA_VERSION_UNSUPPORTED`（非正整数/类型不符，parser 层）· `SCHEMA_VERSION_MISMATCH`（∉SUPPORTED，parser 层）·
`BLUEPRINT_MIGRATION_REQUIRED`（defined-未-run 文档，身份可读，operator-owns）· `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`
（从未定义版本）——两名三臂纪律（A1-21）翻档前后**不变**，门臂真值表逐腿钉死于
`packages/domain/test/a5fl1-blueprint-v4-flip.test.ts`。

## 2. 双解析窗口声明（本文的「窗口」= 解析/运行窗口，非退役窗口）

本 build 同时解析并运行 **`{3, 4}`** 两版本文档：

- **v3**：冻结分支，**load-time 零变形**（CAND D-07①）——v3 文档的解析、规范化、内容哈希、deep-freeze 全部行为
  字节不变；翻档前后同一 v3 样章哈希恒等（`a5fl1` 以翻档前亲录常量钉死：
  `sha256:1723a…daf4f`，见 `dev/agent-workflow/evidence/alpha5/v4-flip/runs/pre-flip-entry-capture.txt`）。
- **v4**：= v3 全部核心面 **+ 可选 `toolBindings` effect-governance 家族**（core 面委托冻结 v3 校验器逐字段校验；
  家族按 D-02/D-03/D-05 封闭词表拒绝式解析）。`toolBindings` 进入内容哈希的 v4 投影：**只有 `toolBindings` 不同
  的两篇 v4 文档必须哈希不同**（家族不落进哈希 = 身份洗白，`a5fl1` 专腿钉死）。
- 未定义版本（现 = `max(DEFINED)+1` 起）保持原 typed 拒绝臂不变；已退役版本（1/2）保持
  migration-required/MISMATCH 双臂不变。生产入口三态（ok / migration-required / rejected）语义零漂移。

## 3. 「翻档 ≠ 退役」原文条款（本 ADR 的核心声明，逐字收录）

本 PR **只翻档、零退役**。不可逆性的准确位置与「翻档 demits nothing」的原文（flip-PREP `:22-30`，逐字）：

> Why THIS step (not the grammar) is the irreversible one: the flip itself
> demits nothing — v3 keeps running and the derived retired set stays
> [1, 2] (nothing is demoted by adding the new version).
> Irreversibility arrives the moment the first document is AUTHORED in the new
> format: rolling the run set back afterwards would strand stored documents
> that no longer validate. That is the point of no return the A-4 window
> ruling prices — a WRITE-format decision, not a constant edit.
> Retirement of v3 (removing it from the run set) is a SEPARATE later ruling;
> 翻档 ≠ 退役, and this round declares neither.

因此：**第一篇 v4 文档写成 = 不可逆点**（写格式决定，非本常量编辑）；本 ADR 与 flip PR 均不构成对 v3 的任何
退役宣布、退役时间表或 trim 授权。

## 4. RETIRED 派生臂不动声明

`RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` **保持派生、永不手写**（`DEFINED.filter(v => !SUPPORTED.includes(v))`）。
翻档「向 run set 添加版本」在数学上不可能降级任何版本：翻档前后派生集恒为 `[1, 2]`（`a5fl1` 以恒等式双腿钉死：
值恒等 + 「RETIRED === 派生重算」）。v1/v2 的 discoverable-refusal（身份可读、operator-owns、不静默丢）双臂
不变；对 v3 的任何未来退役都是**另一条独立裁决**，走派生机制自然落定，无需也不允许本文件预写。

## 5. 窗口时长 / 退出 = T-1 待裁（本文件不预设）

`{3, 4}` 双解析窗口的**时长与退出条件 = T-1（A-4）待裁参数**（用户仅需批『发布代下限 + 退出谓词』两参数；
V4-ENABLEMENT-ROUTE §4）。本 ADR 与 flip PR **不预设、不暗示**任何窗口时长、退出时刻或退出形态；
T-1 未裁**不**阻塞本文与翻档（根 17:54Z『不得一概冻在翻档待裁下』），T-1 已裁也**不**自动触发退役——
退役动作属 V4-ENABLEMENT-ROUTE 阶段④，另行裁决与另行落笔。

## 6. 生产语义三钉（转正的验收面，逐腿机检在场）

1. **v3 行为逐字节不变**：root vitest 与已发布 9-identity 红集恒等（零增减）；v3 全量回归 diff=空；样章哈希
   翻档前后恒等（§2）；v3 分支禁改由 fence 机检。
2. **v4 文档经生产入口真实可解析可运行**：`parseBlueprint`/`validateBlueprintDocument` 运行 v4（`a5fl1` 15 腿）；
   权限面 run-set 规则随常量派生（ceiling reader 与 warnings comparator 对 v4 给**治理态**、对未定义版本仍拒——
   `a5fl3` 重测腿）；live 宿主腿（真实宿主起服 + mock-LLM 位 + v4 blueprint 建队 + 真实 delegate 小步）见
   `dev/agent-workflow/evidence/alpha5/v4-flip/` 运行记录。
3. **未定义版本 typed 拒形不变**：门臂真值表「never-defined」行翻档前后同形（`a5fl1`/fixtures 派生见证）。

## 7. M-3 语法原子的在册声明（§11:171 Scope 扩展条款的「原子同笔」面）

§11:171 的 Scope 语法扩展条款（D1【迁】）与翻档**同笔**落地的部分是**语法与镜像**：新操作类型
（fs metadata、network destination、Domain reference）的封闭 delta 表 + matcher 形态律（映射入既有闭集
{exact,subtree,fingerprint}，**零新 rung、零新 matcher kind、零新 envelope**），coverage/kernel 镜像测试
（`a5fl2`/`a5fl3`）。文档面**接受**这些 token 属 effect-queue 行为轮（独立 PR、独立审查）：在那之前文档仍按名
拒绝——先钉死的方向是「parse-accept ⇒ runtime 可映射」，本文件不制造反向裂缝。

## 8. 转正映射与后续

| CAND 条目 | 本 ADR 状态 |
| --- | --- |
| D-01（版本=4，严格成员） | **转正 SHIPPED**（本文 §1，机面已落） |
| D-02…D-11（封闭表/无隐式默认/删除字段按名拒/枚举/`..`/迁移报告/三平面映射等） | 随本 ADR **采纳**（grammar 半已在 #316 在产，语义逐腿 = a5sr1…a5sr5 在册钉） |
| CAND 头部三处「当前只支持 v3」状态声明 | 被本文 §1/§2 取代（CAND 原文保留为历史） |

后续（全部在册、非本文新裁）：阶段④ = T-1 门后的窗口退出与 v3 退役讨论（另行裁决）；M-4/M-5/M-6 等剩余
映射条目按 VNEXT-SCHEMA-ADR §3 排程；effect 生产面重接线 = effect-queue 轮（行为改动，其 PR 其审）。
