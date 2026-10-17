# Alpha.5 接线阶段计划（WIRING-PHASE，2026-10-17 02:0xZ 用户指令恢复原计划）

基线 = master@62cc2b87（PR8 runner/gates/live/acceptance 全在场）。范围 = PR249 计划 §7-§11 既定项，非新裁决。

## 冻结接口（ lanes 不得互改，改动走协调者）
- **IF-1 装配入口**：live 装配沿用已验收模式 = plugin row（profile-patch seam）+ 公开 `ctx.agents` + dist 公开 barrels；生产公共胶水（agent-bindings 系）仅 GLUE owner 可动（原架构：外部插件+公开 seam，CORE=0）。
- **IF-2 端口**：W4=3182, W5=3183, W7=3184, W8=3186（先 netstat 自证空闲；:3080 禁）。
- **IF-3 世界**：`tests/homes/a5w4-* / a5w5-* / a5w7-* / a5w8-*`（TEST_METHODS §7 清理）。
- **IF-4 宿主**：tests/deepseek-harness-test-use @639ed01539（只读复用/§2 链重建，porcelain=0 收口）。
- **IF-5 共享文件唯一 writer = GLUE（e72e4110）**：`packages/*/tsconfig*.json`、各 barrel `index.ts`、`vitest.config.ts`（root）、`p4t6-session-event-scan.test.ts`、`agent-bindings.mjs`、live registry、`scripts/`。lane 需要共享改动 → 回报协调者转 GLUE 队列，不得自改。
- **IF-6 事件/错误名**：master 全前缀发射面为准（install.ts 五名 + spill-settlement-event-unknown + TOOL_BINDING_UNVERIFIED/admission-unbound + IO_POLICY_UNSUPPORTED）；禁新 §5 码除非回报批准。
- **IF-7 判据语言**：三态 PASS/FAIL/NOT_RUN + REQUIRES-LIVE 禁用为本阶段终态（要么转 LIVE 要么 PROBE-GATED+最小复现）；ENFORCE 级需 OS 强制面证据；静默姿态非 fail-closed 口径不变。

## Lane 任务卡
- **W4 (alpha5-wire-pr4)**：provider 工厂→会话装配（公开 seam）；正控=受支持 profile 真实 spawn+执行观测；负控=不可用 profile **启动前 typed 拒**（IO_POLICY_UNSUPPORTED，零 spawn 证据）；OS 正负控=Landlock 在场/撤销对照（ENFORCE 证据分级如实）。
- **W5 (alpha5-wire-pr5)**：search/shell 工具面经 admission 门控注册进测试会话；真实调用：search 结果+spill 生命周期（open/read/close/id-in-use）、shell parity 双腿（governed vs raw 对照）三态原文。
- **W7 (alpha5-wire-pr7)**：jobs 身份/lease 经 jobs-gateway 公开面装配；两 member 同宿主隔离实测（互不可见+lease 互斥+revocation）；pinned absent-anchor（job_start）不因此改变——absent 仍如实。
- **W8 (alpha5-wire-pr8)**：M-04/05/08/09/13 逐行按 W4/W5/W7 装配面执行（依赖其 head，stacked）；产矩阵行 RLW→LIVE/PROBE-GATED 转态提案+runner 挂接；vNext/迁移实施差距检查表。

## 合并序
W4/W5/W7 可并行评审 → 各自双绿守卫合并（互不冲突：不同文件）→ GLUE 汇编 PR（含共享面+ledger 入账）→ W8（stacked 于合并后 master）→ gates 行更新 PR。
每 PR：独立 reviewer（≠writer）+ 最终 SHA pr-gate+census 双绿 + match-head 全 SHA 守卫。
