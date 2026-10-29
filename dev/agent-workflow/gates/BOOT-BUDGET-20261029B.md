# BOOT BUDGET LEDGER — USER-RULING-20261029B（24 starts，从零计数）

| # | 用途预留 | 已用 | 明细（seq/登记/裁决） |
|---|---|---|---|
| U7-R2 收口：#446 Web C2（≤4） | **4/4 用尽** | 见下 | lane=u7r3-envblock-c2，head baa26f567（证据 dev/agent-workflow/evidence/u7r3-envblock-c2-20261029/ @ 4eff9811a 于 #446 分支）：#1 未触发行 PASS 7/7；#2 harness-abort 对照 v1 MISS（诚实记录 induced FAIL，控制自身缺陷非产品缺陷）；#3 v2 守卫正确弃权 → PASS 7/7 复现；#4 v3 ledger-poll mid-create kill → induced FAIL（结构性发现来源）。义务判定：(a)PASS臂实机 ✓ (b)实机NOT_REACHED=结构性不可达（team.create 同步驱动首 ask；in-suite 旋钮=改被测对象，未造） (c)ENV_BLOCK 缺席如实记录（0/4）✓ (d)零洗白 ✓。#446 维持 DO-NOT-MERGE；(b) 旋钮提案=用户决策项。 |
| U7-R2 收口：#448 crash 复验（≤2） | 0/2 | 待波次合并后执行（覆盖最终态） |
| U7-R2 收口：#449 受影响生产路径（≤2） | 0/2 | 同上 |
| U7-R3 AC candidate-bound C2（12） | 0/12 | 接口先行铁律生效中（矩阵 v3） |
| 机动（4） | 4/4 用尽 | **U7-R3 pilot lane-C2（#458）**：boot#1 u6-arc-a（18:25Z 账本行；farm provisioning 缺口 → bootstrap ERR_MODULE_NOT_FOUND，计入）；boot#2 u6-jobs（18:31Z；世界形态墙=committed u7-t1 基线 parity，计入）；boot#3 u6-arc-a re-boot（float，账本行 18:53:39Z；10/11 PASS，新 glob arm 全部产品见证落地，判法 token 误杀记 FAIL 保持原判；**violation-on-record：该 boot 为 post-registration（登记文件 birth 18:56:57Z > spawn），RULING-B 硬律违例，主 Agent F-1 定性，纠正=boot#4 严格先登后启且等 push 确认**）。boot#4 u7-4a-jobs（19:14:05Z 账本行；登记先行+push 确认后启动，F-1 纠正生效）：overall FAIL 12/13，re-home 案例 u74a:list-deny-leg-honest-zero 实机 PASS → job_list L3-refusal 升 PROVEN(CASE)；唯一 FAIL 为既有独立案例 u74a:kill-live-requested（早读 delta 竞态，按测得记录不改判）。机动 4/4 用尽，总账 8/24。 |

**总额：8/24。**（2026-10-29 #458 审查后补记同步：pilot lane-C2 前三 boot 入账；违规与预留见机动行与 SESSION_ROUTER_LOG 2026-10-29 BACKFILL 条。） 同类失败停线律：#2/#4 属对照设计的诱导失败（控制实验），非同类产品失败，不构成停线；两 PASS 运行互证稳定性。:3080 与 ~/.dsh 全程未触（401==401 探针在案），世界全拆除。
