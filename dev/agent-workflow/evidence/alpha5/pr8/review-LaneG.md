# review-LaneG — Alpha.5 PR8 提前件（Lane G）独立审查

- **审查对象**：`origin/alpha5-pr8-accept` @ `e1269eb9`（含前置 `4643cddd`；base `db5cb5f7` = origin/master 固定 SHA，已验 ancestor）
- **审查者**：Lane G 独立 reviewer（≠writer；qwen3.8-flash-next；模型/harness 分列）；审查时刻 2026-10-16（对象 commit=16:44Z，晚于 14:51Z B3 裁决、早于 17:5xZ G-a 裁决与 PENDING-GATES 17:22 正本——对表按最新正本执行）
- **依据**：ROUTER_RULES（§3.2 裁决制）+ S0-SELECTION-MATRIX.md（@tree）+ INTERFACES-v1 §C-VNEXT（正本 b0d636eb）+ PENDING-GATES.md（origin alpha5-decision-pack-20261016@b0d636eb 之后最新正本=workspace 17:22 未提交版）+ DECISION-PACK-20261016.md（b0d636eb）+ COORDINATION.md（workspace 17:19）
- **裁决**：**投机通过** —— G-d 集成会话**可**（条件见文末）。无阻塞项、无与用户裁决抵触项。

## ① ADR 候选 D-01..D-11 —— PASS

- 11/11 条均含"候选决定 + 备选与被拒理由"（grep 计数 11/11），无空壳条目。
- **字段映射默认拒**：D-02（closed-world，未知键 typed 拒、禁剥离放行/别名折叠）与 D-03（无隐式默认，缺失永不展开为权限，含 B-b"默认 restricted"同拒的对称论证）与 C-VNEXT 条款字面一致；D-03 引计划 §11 原文（tree 内已核：§实现"建议 4……不自动从缺省字段推断 unrestricted"）。
- **未知枚举禁 coerce-to-deny**：D-08 + N-E02 note 明确"拒绝与降级 deny 在审计面不同"，与 C-ADM `deny-source-unattributed` 律同构，一致。
- **externalHard=能力面非团队层 / admin 环境内最高**：ADR 全文不涉 externalHard/admin 覆写面（grep 零命中）——未复述亦未抵触；D-10（assurance 声明零授权力、probe 才生效）与 D-06（零新 Rung/super-envelope）不与决策 2 的 P1/P2 裁决冲突，N-F05/N-M03 反向封堵 envelope 重绑与新 rung 字段面。**未发现任何"顺推扩权"措辞**；候选错误名全部标注 proposed-not-shipped（设计 §5 纪律）。
- 三轴枚举（implementationOrigin/executionBoundary/assurance 五值）与 S0 §3 二义词表逐值对齐；D-05 正确把旧 `native/custom/shadow-run` 置于"被拒旧字段"侧。
- NIT-1：D-04/D-11 无②负例回链（结构性决定，候选态可接受；PR8 正式轮宜补绑定身份/哈希面负例）。

## ② 迁移负例 33 例 —— PASS

- `python json.load` 解析通过；33 例无重复 id；verdict 计数 reject 27 / report-requires-decision 2 / accept-verbatim 4 与 `_meta.count` 逐项吻合；六类（含控制正例）齐。
- `adr_ref` 回链全部存在（0 dangling；覆盖 D-01/02/03/05/06/07/08/09/10）。
- `runner_wiring: false` **如实**：全树 grep 无任何运行器/套件 import 或消费本表（仅 e2e 骨架声明"PR8 正式轮消费"，registry `run: null` 佐证）。
- 与裁决对齐正/负控质量高：N-V04（缺版本不选默认解析器）、N-D01..07（各缺失面逐一拒）、N-M01/04（迁移扩权拒）、N-M05（收窄也 requires-decision）、N-P02（尾随空格 accept-verbatim，NRM-1 对齐）。

## ③ 验收矩阵 32 行 —— PASS（含重点核 M-12/PR1r）

- 32 行齐：M-01..M-14 连续 + SUP-01..SUP-18 连续（脚本校验 id 序列）；行源与 S0 §1/§2 存在性吻合。
- 6 partial 行 = `M-01/02/03/06/12/14`，与 DECISION-PACK 决策 1 点名行逐字吻合；`partial_rows_source` 引原文并注记"B3 已选 (ii)（COORD 14:51Z 双裁决），本件即'写入矩阵'，PR1r 落地后更新"——时序与事实正确（commit 16:44Z 晚于裁决 14:51Z）。
- **重点核（G-a 冻结 vs 已验收）**：**未违**。M-12 `current_status=partial-pending-pr1r-update`、`final_declaration=null`、notes"PR1r 落地前不可定稿（DECISION-PACK 点名行）"；M-14 明言撤销/结果身份腿属冻结面→partial；全矩阵 32 行 `final_declaration` 均为 null——**无任何行宣称已验收/SUPPORTED**，与 G-a"解除冻结须用户另行裁决；涉该保证接线解除前不得计入验收"及 G-d"OpenAtPort 前禁宣称 Supported"完全兼容。`pending_update_template` 为纯留位（fields_reserved），不含承诺性完成语义。
- `stage_snapshot_at_base` 自带"PR8 正式轮必须重取快照，不得沿用"防线。
- NIT-2：快照内"修复轮 by `4d990c89`"该 SHA 不在本仓 origin 任何 ref（现 followup 正本=PR #258 @ `86719028`）——沿 COORD 台账所引、且快照已声明必重取，不构成失真主张，但 G-d 集成时应改引在册 head。
- NIT-3：M-06 note"B3 选定前本行身份列不可定稿"措辞滞后于 _meta（B3 已选定）——方向保守（更严），非违规。
- G-g（静默已订阅通道）为 17:5xZ 后独立开放项：本件无任何 SUPPORTED 宣称故无抵触；**PR8 正式矩阵须按 G-g 把该配置登记 UNSUPPORTED/待证**——列为 G-d 转交项。

## ④ E2E 骨架 —— PASS

- `node --check` 两文件均通过；`registry.mjs` 可 import，**9 套件**桩齐。
- 引用图自洽：全部 `matrixRows` 指向 ③ 真实 row_id（0 bad refs）；每条 M 行至少被一套件覆盖（0 缺口）；② 33 例 `suite` 字段全部指向 70 套件且该套件声明负例全表；`evidenceTypes` 全部落 ③ 词汇表（0 violation）。
- **无断言实现冒充测试**：`run: null`×9、`resolve: null`、`COVERAGE_CHECK` 三槽位全 null（TODO(PR8-formal) 标注）；kit-shape 仅形状声明，`status: "SKELETON"` 恒定；覆盖自检在 README §3 登记为"届时实现"。
- 目录约定与 TEST_METHODS 对齐（paths.mjs 唯一 pin 源、homes 临时世界、3180 族、禁 :3080、PoC 原始记录不动/SUP-09、storm fuse>300/SUP-16、token 采集即脱敏）。
- INFO：90 套件 `matrixRows` 为非数组字符串"ALL-M + 展开后行"（自述语义，PR8 机检需特判）。

## ⑤ v3 生产文档零改动 + token —— PASS

- `git diff --name-status db5cb5f7..e1269eb9` = 7 个 **A**（全部新增，皆在 `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/`）；S0/ADR/architecture/设计/计划与既有 memo 权威文档零触碰。
- 两条 commit message 均含 `[DORMANT; v3 零改动]` token（末条 + `候选态`）；lane README 首行 CANDIDATE/DORMANT 声明 + 边界四条。
- token 卫生：diff 无凭据泄露（扫描命中均为 fixture 字面量 `./secret` 类）；kit-shape 显式 `tokenPolicy: 采集即脱敏`。
- 无端口/服务/宿主触碰；共用文件（根 registry/live glue/tsconfig/barrel/scanner/packages/tests/kits）零写集（README 边界 4 + diff 佐证）。

## NIT 汇总（G-d 集成会话转交项，不阻塞）

1. ③ `authority_refs` 中 COORDINATION/DECISION-PACK 相对路径在 e1269eb9 树内不可解析（该 evidence 目录仅 pr0/pr1/s0 入册 master 线；正本=decision-pack 分支 b0d636eb + workspace 未提交版）——集成 owner 应把引用钉到分支+SHA 或快照入册。
2. 快照 `4d990c89` 非 origin 在册对象，现应引 #258 @ 86719028（待 G-b 复核并入）。
3. M-06 "B3 选定前"措辞更新为"B3 (ii) 修复轮落地前"。
4. PR8 正式轮：G-g 配置行登记 + D-04/D-11 负例补链 + 90 套件 matrixRows 形状机检特判。

## 裁决

**投机通过**：G-d 集成会话 **可** 纳入本件。条件=①G-a 冻结维持期间六 partial 行与全部 SUP 行按本审原文保持 partial/null，不得借本件任何行宣称已验收/SUPPORTED；②上述 NIT-1/2 引用钉 SHA 在 G-d 集成时处理；③PR1r/PR2 落地后矩阵更新只经 `pending_update_template` 预留字段由 PR8 writer/集成 owner 执行；④G-g 收口前相关配置矩阵登记不得默认 SUPPORTED。
