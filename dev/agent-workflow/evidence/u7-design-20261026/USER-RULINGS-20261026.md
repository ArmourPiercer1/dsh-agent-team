# U7 用户裁决（2026-10-26，逐字记录）

1. **R-U6P3-1（治理 bash 正控）→ 选 B。** 由人工经公开 `team.resolveControl` 在 governed team session 上解析审批；
   不新增 bind-time lane token，不改权限/envelope 语义。
2. **R-U6P4-1（治理后台 spawn）→ Yes，必修。** 实现既有 `attributeBackgroundJob` 产出者（授权 bash 收据出生后归因），
   并证明 owner fence / cancel / 不确定终止；不得以"全部拒绝"交付必交 job 三件套。
3. **R-G1F-2（Domain family）→ 总体同意 B**，但需先回答：Alpha.5 原始设计中对外来工具/MCP 的接入控制要求是什么
   （必须满足的条件、必须能接入某个控制类型，如控制读/控制写/控制沙箱启动），以及现在能否继续按该设计执行。
   → 见 `docs/plans/memo/unified-baseline-alpha5-20261025/u7/EXTERNAL-TOOL-CONTROL-DESIGN.md`。
4. **bind-time token 缺失 → 有意（current semantics）。** 不新增 token 账本。

配套：决策 1/4 关闭了"是否新增授权表示"这一问题；决策 2 解锁 U7-4 的 jobs 产出者实现；决策 3 的 B 在 MCP 设计
评估完成后落地（若设计要求可执行，则按设计要求交付外来工具接入控制，再据实收窄或扩大发布声明）。
