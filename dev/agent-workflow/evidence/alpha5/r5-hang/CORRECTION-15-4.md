# CORRECTION（root 纠正，2026-10-20）：ROOT-CAUSE.md §5 选项②"最贴 §15.4 字面"系误引

原文（`docs/plans/finished/DSH_Agent_Team_vNext_Team_Create_Minimal_Fix_Plan_20260905.md`）：
- **§15.4**（:999-）：v1 initialWork **"它仍然会在 RPC返回前投递，因此只作为旧 client compatibility行为；新 client必须使用 v2两阶段顺序 team.createV2 → open Root → team.admitInitialWorkV2"**。
- **§15.6**（:1059-）：Remote v1 = "字段和response保持；initialWork改走 Root-specific strategy；**旧 client时序保持兼容**"；v2 方法（createV2/admitInitialWorkV2，requestToken/replay/mismatch 规则）为新建非耦合路径。

**判读纠正**：原计划**明文规定** v1 在 RPC 返回前投递（=冻结兼容时序本身），并为新 client 提供 v2 两阶段。故"Phase A 即返回/B-C detached"**不是**对 v1 的自动获批修复（§15.4 字面恰恰相反）；本单 §5 三选项中②的引用不成立，作废。响应时序语义=**HOLD 候根查后续 supersession**；本 lane 未做任何时序改动。实操注记（非语义改动）：ask 世界回归走 **async 委派或 v2 两阶段**可避开 compat 耦合等待。

## 追加校正（root，第二轮）：supersession 精确化
计划头 :938「CONDITIONAL GO — 原第 2–14 节方案存在 blocker，已由本节收缩修订版取代」+ :943「本节取代前文中与其冲突的设计和任务说明」⇒ **旧 §2.4 的三态 phase（admitted|delivered|delivery-failed）非当前授权依据**；§15.7 以**两个 factType**（`team-work-admitted` + `team-root-work-delivered`，同 team category）替代单 fact 多 phase 表示。故协调早前"§2.4 phase 模型支持分离生命周期"的阅读辅助**双重失效**（既被 supersede，推断本身亦过度）。当前授权依据=仅 §15（§15.4/§15.6=v1 RPC 前投递为冻结 compat 时序；§15.7=两 factType durable 表示）。响应时序契约=**保持现状**，任何改动属产品决策，候真正用户决定（不急询）。
