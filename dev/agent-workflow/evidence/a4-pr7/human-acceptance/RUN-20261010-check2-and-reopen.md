# RUN 2026-10-10 — 验收第 2 项实测 + 重启后恢复会话的已知问题

实例：`tests/homes/a4-w5-corrupt-acceptance`，:3082（mock :3493），构建 = W6（产品代码同 `20e04c38`）。
警告条在屏、损坏条目 `#18` 在场，全程未清除损坏行。

## 1. 验收第 2 项（"警告条在屏时团队照常运行"）——协调者实测

| 步骤 | 结果 | 耐久证据 |
| --- | --- | --- |
| 人类点"创建成员实例" | 成功，未被损坏条目阻断 | `sequence 19` `provision-member-instance`（`inst-06eg5yi0kp3d`，模板 `worker`） |
| 人类对该实例"发送任务…"（消息下发） | 成功 | `sequence 20` `team-coordination-recorded`、`sequence 21` `team-message-delivered` |
| 全程 | 损坏腿**未增未改**、**无审批迂回** | v9 仍 `corruptCount 1 / #18`；`decision`/`abandonment`/`consumption` 行数 = **0** |

⇒ 与 round 56 的代码结论一致：不可归属的损坏行**没有阻断能力**（`corruptLegDisclosesMember` 为 false 即非候选），守卫既不放过它也不被它挡住。

**这一项没有覆盖到的**：Leader 自己调用 `team_delegate` 的完整委派腿。原因是这个世界的方法车道是 **SIMULATED**（mock 只回执、不发 team 工具调用：第 3 轮跑完账本零新增），且远端面**不暴露** delegate 方法（`packages/remote/src/contracts/catalog.ts` 无匹配）。⇒ **委派腿在本实例上无法驱动，属世界限制，不是产品结论**；需要它请用真实模型车道或带脚本化工具调用的 mock（`tests/mock/scripts/call-result.mjs` 方向）。

本世界因此**多出** `inst-06eg5yi0kp3d` 与 `sequence 19-21` 三行。整目录删除即回滚：`rm -rf tests/homes/a4-w5-corrupt-acceptance`。

## 2. 重启后端后恢复会话：必须先切入 Team 模式**再刷新页面**

现象：后端重启后进入既有 Team 会话，composer 显示 **"会话不可用"**（输入框与工具条均禁用）。

操作者提供并验证的流程（2026-10-10）：**团队标签 → 成员组 Leader 的"以 Team 模式打开 / 回到 Leader" → 等按钮右侧出现"Team 模式" → 刷新页面**，之后 composer 恢复可用。协调者按此流程实测：刷新后 `@textbox 发消息或创建任务…` 无 `disabled`，随后的守卫操作（上表）全部成功。

机制（**操作者提供，非本仓库实测**）：后端重启后的会话重建由**上游 core** 管理且缺少合适切入接口，会话会被重建为**普通会话**；该按钮只驱动后端更新，不会刷新前端缓存，因此需要一次页面刷新。

**与归档 gate 的冲突（需裁决，不要静默）**：`docs/plans/finished/pr31_supplemental_fix_guide.md` 的 **INV-7** 把"点一次、**不 reload**、composer 立即 usable"写成最终产品 hard gate，并禁止把 reload/切会话当 acceptance path。当前实测与操作者记录都表明**这一步 reload 是承重的**。两种可能：INV-7 已因上游限制被改判但**改判记录不在本仓库**（我在 `docs/**`、`SESSION_ROUTER_LOG.md`、`evidence/**` 全搜过 `会话重建/普通会话/前端缓存/Session unavailable/需要刷新页面/INV-7`，只找到 INV-7 本身），或 INV-7 从未达成（同文自己列了四个待答问题并要求 real-host evidence 才算收口）。⇒ 待操作者指认改判出处，或本条目即为记录。
