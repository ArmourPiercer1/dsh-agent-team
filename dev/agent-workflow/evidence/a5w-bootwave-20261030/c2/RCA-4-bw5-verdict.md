# RCA-4 — bw5 捕获格：分界裁决 = 产品装配缺口（dated 2026-10-30T23:55Z）

fault 全文（run-bw5.json trace[4] luHead，一字不省存档）：
agent-bindings: alpha.5 Team tool plane refused the mount for 'session-team-child-…': projection refused: the policy carries a subtree rule but no SubtreeContains seam was injected — subtree coverage is unanswerable without the planes containment law and is never guessed (same law as the C-FS wiring face) (code: TOOL_BINDING_UNVERIFIED)；外层 code=TEAM_RUNTIME_DURABLE_WRITE_FAILED / providerCode=ACTIVATION_CHILD_SESSION_CREATION_FAILED。

## 裁决
- 内核 fail-closed 正确（subtree 规则无 seam = 不可猜，永不放行）。发射链 agent-bindings.mjs:2819 ← admission-kernel.ts:1005。
- **缺口 = 生产装配**：agent-bindings 的 plane 构造从不注入 SubtreeContains seam（permission-plane.ts:242 有 C-FS wiring face 同源先例）。后果：任何 blueprint member 策略含 subtree 规则 → 子会话必 mount 失败 → 成员处置 → 委派 target-stale。**read_image L3/L4 与一切 subtree 授权 member 的真实 Host 路径被此装配缺口阻塞**——这正是 boot 波次要抓的产品级缺口，非套件误用。
- 修复 = 产品 lane task/a5w-bindseam-20261030（工作流 A，产品码+负控，见派工单；内核/domain 不动）。

## 预算与有效格
- host-starts.jsonl：bw3/bw4/bw5 共 3 行 = 预登记池 3/3 耗尽；C2 现 7/8。
- 有效格判据：bw3（placement+ui f4+leak 三格首绿=有效）；bw4（trace 定位根因主链+抓到套件 bug-2=有效）；bw5（fault 全文=唯一任务达成=有效）。无 WASTED start。
- 同类×2 停线后未偷跑：bw4/bw5 之间各有 RCA-2/RCA-3 在先，bw5 为预登记末格。修复入 master 后的完整链复跑 = 新 dated 预登记（C2 池余 1，另需时谈扩容=用户事项）。
- bw5 附带事实：leader/uigov 本轮 NOT_REACHED（驱动轮询耗尽时序，leak-check 绿、零泄漏）——不据此判任何产品结论。
