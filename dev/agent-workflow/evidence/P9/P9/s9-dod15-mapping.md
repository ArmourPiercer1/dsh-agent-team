# P9 S9 — DoD-15 证据映射（计划 §21 L2199–2217）

> 基线：audited tip = `47b41df`（S9 提交将落于其顶；reviewer 对最终 tip 复核）。
> 树：主树 `D:\AgentDev\dsh-plugins\dsh-agent-team` + 任务 worktree `.worktrees/P9`（task/P9-ui-legacy-reuse）。
> 状态标注：`✓` = 证据已落盘；`⏳` = 证据将随对应步骤落盘（本行给出预计来源）。
> 裁决权：reviewer（P9_VERDICT 三选一）。

| # | DoD 条件（§21 原文要点） | 证据 | 状态 |
|---|---|---|---|
| 1 | `@dsh-agent-team/client` 不再是 skeleton，真实 mount 到 public DSH client seam | `packages/client/src/plugin/client.ts`（77L，sync `apply(ctx, config?)` → `applyTeamMount`，inject 6 条 public seam，`name='dsh-agent-team-client'`）；`packages/client/src/plugin/team-mount-core.ts` L277/L280/L289+；生产入口 `packages/client/dist/packages/client/src/plugin/client.js` 由 S8 boot 实际加载；`scripts/composition-smoke.mjs` client 目标（contract `throw`）对真实 dist 断言入口契约 | ✓ |
| 2 | root/member/ordinary/legacy perspective 正确显示 | S8-D attempt-32 浏览器垂直证据（`dev/agent-workflow/evidence/P9/s8/s8-browser.mjs` 及 attempt-32 产物：S1–S9 全绿 clean-world）；client jsdom specs（`packages/client/test/*.client.spec.tsx`，10 个文件运行于 vitest）覆盖各视角渲染断言 | ✓ |
| 3 | Projection state 使用 P8 generation guard，不被 stale response 回退 | `packages/client/src/state/`（generation-guard store，T0–T10 交付）+ 对应 testkit/runtime 单测（2170/2170 plain-node 面 + client vitest 面）；P8 交付物继承 | ✓ |
| 4 | Ledger 使用 frozen cursor rule，历史加载不依赖 Session messages | `packages/client/src/model/team-ledger-model.ts`（L40–44 `TEAM_LEDGER_INITIAL_LIMIT/STEP=200` 注明 legacy `TEAM_FEED_*` 出处；cursor 推进规则）+ `model/ledger-adapter.ts`（+466/-165，frozen 契约 adapter）；audit §A 行 3/4 | ✓ |
| 5 | New Team flow 可执行或按 frozen native seam 明确降级 | client `model/team-member-commands.ts` + New Team 流程降级路径（frozen native seam 判定在 host seam 层）；T12 GO 已确认 frozen remote 契约（2026-09-02 用户预授权）；S8 垂直中 New Team 降级表现于浏览器证据 | ✓ |
| 6 | Team Members/Timeline/Dock/Team tab 大量复用旧实现 | `dev/agent-workflow/evidence/P9/reuse-audit.md` §B：4 个 module.css byte-identical（TeamDock/TeamSettingsSection/TeamTasks/TeamTimeline）；TeamFeed→TeamLedger +18/-0、TeamView +94/-0（additions-only）；members +88/-11；band 对比表（MET/BORDERLINE/MISS + 计划强制理由） | ✓ |
| 7 | vNext-only member/config/policy/compat commands 走 frozen Remote | `packages/client/src/transport/host-seams.ts`（6 seam 重导出 + command 通道）+ `model/team-member-commands.ts`；命令只经 frozen Remote/`teamRoot` facade（`packages/runtime/src/plugin/host.ts` L580–607 `ctx.provide('teamRoot', …)`），不触碰上游私有 API | ✓ |
| 8 | native Chat/Trajectory/Fork 不被复制或 synthetic injection | audit §A/§C：无 native 面板复制文件；`references/deepseek-harness-test-use`（pristine upstream）零改动（TEST_METHODS.md 约束 + 冒烟/构建链未 patch）；client 树 38 文件清单中无 Chat/Trajectory/Fork 复制件（§3 DROP 清单） | ✓ |
| 9 | synthetic marker 和 DOM navigation hack 已删除 | legacy `TeamMarker.tsx`（synthetic marker）/`team-marker-jump.ts`（DOM navigation hack）→ P9 落 `ui/TeamLedger.tsx` 内 fragment + `model/team-ledger-model.ts` L190 行导航（数据驱动，非 DOM hack）；audit §A marker 行 + F-6（无 `New*` 平行文件，R9-3 PASS） | ✓ |
| 10 | 14 legacy tests 每个都有 migrate/drop evidence | `reuse-audit.md` §C：14 行测试表（migrate→P9 spec 映射 / drop 理由），与 worktree S1 原稿 §2（L96–114）一致；R9-2 八组 scenario 全映射（§E） | ✓ |
| 11 | full repo test/typecheck/build/smoke 通过 | 五闸（计划 L1741–1749 五命令）：typecheck `pnpm -r run typecheck` 9/9 ✓；build `pnpm -r run build` 9/9 ✓（tools TS6059 已修，`packages/tools/tsconfig.build.json` rootDir→`../..`）；smoke `pnpm smoke:composition` 2/2 ✓（生产 dist 契约 pin）；lint `pnpm lint` ⏳（首跑 778 错误=既有债，builder 修复中→0）；test `pnpm -r run test` ⏳（testkit vitest 面 2 spec 既有缺陷修复中；client 面因 pnpm -r bail 未跑，Task C 全量面补跑）——最终全绿以 builder 报告 + 本闸重跑为准 | ⏳ |
| 12 | 至少一条 honest production-host UI vertical path 有证据 | S8-D / attempt-32：test-use DSH（:3180）真实 boot + 浏览器垂直（`s8-boot.mjs`/`s8-browser.mjs`/`s8-mock.mjs`/`s8-bundle.mjs`/`s8-validate.mjs` + shim），S1–S9 全绿 = final clean-world 证据；无 mock-host 替代 | ✓ |
| 13 | `reuse-audit.md` 证明没有发生第二次 clean rewrite | `reuse-audit.md` §A 47 行（Legacy file / P9 file / Reuse class / Legacy SHA / diff summary / Preserved tests / Semantic changes / Justification / Reviewer verdict），retained% 启发式（§17 L1956，辅助性）；§B band 对比；R9-1 九项高复用资产全部 ≥ MECHANICAL；R9-3 `New*` 停止条件 PASS | ✓ |
| 14 | CORE PATCH BUDGET = 0 | 上游 `references/deepseek-harness-test-use` pristine 未改（构建/启动绕行链见 TEST_METHODS §2/§5，无 patch-package/postinstall/vendored 改动）；legacy fork `references/deepseek-harness` 冻结 HEAD `a3ab319…` 未动；S8/冒烟证据无 core patch 行 | ✓ |
| 15 | backend frozen contract 未被 P9 silent-edit | 冻结面未触碰清单（红线）：master 提交历史、冻结分支 `feat/team-vnext-integration-20260829`、`graph.yaml` `p9_prototype:`/`current_phase`、`references/` 两棵冻结树、T12 落盘 remote 契约文件；P9 全部改动在 `task/P9-ui-legacy-reuse` 单分支 + 主树 bookkeeping（uncommitted，未混入契约面） | ✓ |

## 收口说明

- 第 11 行两个 ⏳ 的解除条件：builder（3706d46a）Task A（lint 778→0）+ Task B（testkit 2 spec）+ Task C（全量面五闸重跑，含 client 面）全绿，且主代理对最终 tip 重跑确认。
- 第 9 行与 §B 中 marker 行（BORDERLINE/部分 MISS）的裁决、§D 新增模块预算合符性，一并交 reviewer 在 P9_VERDICT 中裁定。
- 本表为 DoD 逐条对照；与 reuse-audit §G verdict 行同由 reviewer 签核。
