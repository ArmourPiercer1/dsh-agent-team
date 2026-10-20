# CORRECTION（root 纠正，2026-10-20）：ROOT-CAUSE.md §5 选项②"最贴 §15.4 字面"系误引

原文（`docs/plans/finished/DSH_Agent_Team_vNext_Team_Create_Minimal_Fix_Plan_20260905.md`）：
- **§15.4**（:999-）：v1 initialWork **"它仍然会在 RPC返回前投递，因此只作为旧 client compatibility行为；新 client必须使用 v2两阶段顺序 team.createV2 → open Root → team.admitInitialWorkV2"**。
- **§15.6**（:1059-）：Remote v1 = "字段和response保持；initialWork改走 Root-specific strategy；**旧 client时序保持兼容**"；v2 方法（createV2/admitInitialWorkV2，requestToken/replay/mismatch 规则）为新建非耦合路径。

**判读纠正**：原计划**明文规定** v1 在 RPC 返回前投递（=冻结兼容时序本身），并为新 client 提供 v2 两阶段。故"Phase A 即返回/B-C detached"**不是**对 v1 的自动获批修复（§15.4 字面恰恰相反）；本单 §5 三选项中②的引用不成立，作废。响应时序语义=**HOLD 候根查后续 supersession**；本 lane 未做任何时序改动。实操注记（非语义改动）：ask 世界回归走 **async 委派或 v2 两阶段**可避开 compat 耦合等待。
