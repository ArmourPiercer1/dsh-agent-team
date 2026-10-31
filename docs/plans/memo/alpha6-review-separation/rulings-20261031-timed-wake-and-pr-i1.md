# Alpha.6 裁决记录（2026-10-31 真实 UTC）：定时唤醒载体阻塞 + PR-I1 职责拆分

> 本文件是**具名裁决记录**，来源是用户对 Lane 2 两项待答问题的直接裁决（2026-10-31）。它不覆盖、不改写任何历史
> 结论：S0 的能力边界由同目录 `s0-addendum-timed-wake-carrier-20261031.md` 以**具名补遗**方式修订，原 S0 文本与
> 其 dated banner 保持原样。执行计划侧的依赖与优先级修订见 `alpha6-lane2-execution-plan-20261030.md` 末尾的
> 「修订记录（2026-10-31）」一节。

## 1. 裁决一：PR-I2 定时唤醒载体 = 具名 `CORE_SEAM_BLOCKER`，scope 严格限定

用户裁决选择 **A（登记阻塞）而非 B（把 ScheduleService 当载体）**，并把阻塞范围**严格限定为 PR-I2 的
floor-delayed timed wake carrier**，明确不扩大为整个 Alpha.6，也不扩大为 PR-I2 全部。

裁决理由（用户原文要点，非本 lane 的再解释）：

1. ScheduleService 是可选、默认不启用的 Host 服务，不能作为始终存在的运行时前提；
2. 它到期产生的是 `source.kind='schedule'` 的 user-role reminder，而非插件归属明确的内部 Review Wake；
3. `schedule/changed` 仅通知任务集合变化，不能替代指定时刻的唤醒回调；
4. 没有充分证据证明把该提醒路径改作审批调度通道仍能保持消息来源、授权边界、取消、去重与恢复语义。

本 lane 对上述四点的独立复核（只读 pristine host `0.2.0-rc.2 @ 639ed01539`，逐条 file:line）：
`packages/boot/app-boot/src/profile.ts:209`（注释明文「offered switched off by the plugin manager」）与该注释
所属的 `OPTIONAL_BUNDLES` 清单 `:213-218`（条目在 `:217`）把
`@deepseek-ai/dsh-experimental-schedule-bundle` 列为可选包；
`packages/schedule/schedule/src/runtime.ts:101` `sessionController.resolveAgent(...)` →
`:118` `renderReminderFraming(...)` → `:119-121` `createUserMessage({ source: { kind: 'schedule' } })` →
`:123` `agent.followup(...)`（行号经 round-1 records review 复核：原引 `:103` / `:117-121` 偏两行）；`src/index.ts:396` `this.ctx.emit('schedule/changed')` 且
`src/types.ts:471` `'schedule/changed'(): void`（无 payload）。四点全部成立。

### 1.1 固定格式的 blocker 记录（ROUTER_RULES §5 / 开发计划 §32）

```
类型：CORE_SEAM_BLOCKER
seam 名：Host TimedWakePort（拟名；宿主属主的「在指定时刻唤醒一个已存在 Session」一次性原语）
Host SHA：0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84（pristine，只读复核）
Required behavior：
  插件可以针对任意给定 sessionId 注册一次性唤醒「在 instant T 唤醒该 Session」，并且：
  (a) 唤醒归属明确（插件可证明该轮由自己触发，不伪装成用户/调度提醒）；
  (b) 有类型化投递回执（accepted/messageId | refused/reason）；
  (c) 可取消（按注册标识）；
  (d) 重启后可恢复（不丢已登记的一次性唤醒）；
  (e) 允许 at-least-once 投递——去重与恢复属既有 Wake Kernel 的职责，不由该原语承担。
Observed public behavior：
  始终存在的公开面上不存在该能力。宿主唯一可达的墙钟原语是可选 ScheduleService，其到期路径
  （runtime.ts:101-145）把唤醒实现为一条 user-role 提醒消息（source.kind='schedule'），并且只发
  payload-less 的 `schedule/changed`；`domain/changed` 严格是写后事件（storage-domain
  events.ts / domain.ts），只能在 append 时刻触发，不能在任意未来时刻触发；宿主 `setInterval` 全集中
  不存在插件注册点；jobs 需先存在 job；goal round 驱动不可注册。插件自建 setInterval/setTimeout 被本
  阶段红线禁止（P-4：不建第二套调度器）。
Minimal reproduction：
  dsh-agent-team-lane-2 @ 98c25a091（PR #509 defer 面）：对一个已登记 floor 的 quiet，写路径与读路径均
  不持有任何 timer（a6-pr4-lane-hygiene.test.ts @ 98c25a091 的 needle 集实际为
  `Date.now / setTimeout / setInterval / process. / readFileSync / writeFileSync / Math.random`；`new Date` 当时
  **不在**其中，它是 round-3 finding R3-3 之后于 `45211aa1f` 才进入 needle 集——本记录引用的是被引 commit 的实际
  列表，不是后续加宽后的列表）；
  内核只在 `created:true` 时发一次通知（control/service.ts:2535-2545，幂等重试静默 :2408-2421，
  risen leg 从不通知 :4546-4645），因此不存在任何「floor 到期时」的唤醒来源。结论：quiet 无法到期。
Affected invariant（受影响能力，逐条）：
  - Alpha.6 PR-I2 的 floor-delayed timed wake（唯一受影响项，也是本 blocker 的全部 scope）；
  - PR #509 defer 面的"到期后仍会唤醒"承诺（该面继续 DORMANT，不构成回归）；
  - 不影响：事件驱动即时唤醒、单飞合并、确定性 MessageId、进度检测、Stop、Crash Recovery、授权隔离；
    不影响 PR-I1a/PR-I1b/PR5′；不影响 Alpha.5。
既有 public composition path 证明：见上 Observed 段（可选 bundle 不算始终存在；domain/changed 时点错位；
  jobs/goal 无注册语义；插件 timer 属红线）。
可能的 upstream generic seam proposal：
  把 ScheduleService 内部的 `resolveAgent → followup(user message) → flush` 拆为两层：一层是"到点唤醒
  一个 Session"的内部能力（typed receipt + cancel + 重启恢复），一层是面向用户的提醒呈现。本 blocker
  只需要前者。**注意：这只是可能的 upstream 通用 seam 提案记录，本轮不向 upstream 提交任何东西**
  （对外提交需另行授权）。
停止动作：PR-I2 中"到期唤醒"这一子能力停止推进；不为其自建第二套持久化 timer/scheduler；不 patch host。
```

### 1.2 由该裁决产生的硬执行要求（Lane 2 承诺，逐条可查）

- PR #509 继续 **DORMANT**：不恢复 `team_review_defer`、不恢复配置开关、不恢复生产接线；hygiene 规格
  `ALLOWED_CONSUMERS` 仍为 `[]`。
- 缺时间触发源时，**floor-delayed 操作必须显式拒绝**：不得返回 `accepted: true`，不得把"未来唤醒保证"降级为
  静默丢弃（PR #509 §8.5 已写入 PR-I2 的验收条件）。
- ScheduleService 只能作为**未来独立 PoC 的候选适配器**，本轮不赋生产载体地位，且不作为 PR-I1a 的任何前置。
- 为未来 TimedWakePort 维护**最小接口契约**（指定时刻唤醒、插件归属、唯一标识、可取消、可恢复、投递回执；
  at-least-once，由 Wake Kernel 去重/恢复）。契约正本 = `packages/runtime/review-wake/types.ts` 的唤醒来源
  （该文件导出的 `WAKE_EVENT_KINDS` 含 `'timer-elapsed'` 与投递 accepted/refused 词汇）+ 本记录 §1.1；
  任何实现前必须先有该接口的独立契约 PR。

## 2. 裁决二：进入 PR-I1 实际实现，但 PR-I1 按职责拆为 I1a / I1b

用户批准 Lane 2 从"架构文档/PoC/纯函数内核"进入真实代码实现，并要求先澄清命名与职责边界，**不允许静默重定义
历史 PR 编号**。因此下表是**具名职责映射**，把 2026-10-30 计划的原始编号与本轮实际使用的编号对齐。

### 2.1 职责映射（原始计划 → 当前编号）

| 原始计划节点（`alpha6-lane2-execution-plan-20261030.md` §1） | 本轮实际编号 | 映射说明 |
| --- | --- | --- |
| **PR2′**：ReviewRouter 分派 + `ReviewAssignment` ledger fact + 投影 booking + 同级 handoff | **PR2′（#507 已交付待审：Draft + DO-NOT-MERGE，未合并）** + **PR-I1a（本轮新开）** | 原计划把"归属事实"整体放在 PR2′。#507 实际交付的是**路由内核 + factType 双侧登记 + 投影 booking**，**持久化 Writer 不在其中**（该面无写入者，保持 dark）。用户裁决把这块缺失的写入者正式命名为 **PR-I1a**，它是原 PR2′ 行中被递延的那一半，不是新造的历史编号。 |
| **PR-I1**（原计划）：4 个 role-closure 站点的 case-scoped Mandate 准入 OR 支 + arc-a ledger override（具名 Center-Interface PR） | **PR-I1b** | 内容、受保护面、override 要求完全不变，仅编号细化为 **I1b**，以腾出 I1a 给写入者。**不改内容，只消歧编号**。 |
| **PR-I2**（原计划）：`live/agent-bindings.mjs` 注入 acceptance-only 投递面 + 与旧 notifier 的互斥开关 | **PR-I2（不变）**，内部区分两个能力子集 | 子集 A「事件驱动即时唤醒 + 单飞合并 + 确定性 MessageId + 进度检测 + Stop + Crash Recovery + 授权隔离」：允许继续开发（用户裁决明确不受阻塞）。子集 B「floor-delayed 定时唤醒」：被 §1.1 的具名 blocker 停掉。**不为此新建 PR 编号**，避免历史编号漂移；PR-I2 的 PR 描述必须显式声明只含子集 A。 |
| **PR4**（真实 Host PoC）、**PR5**（Alpha.4/5 组合回归） | 维持原编号；**PR5′** = 只读展示收窄版 | 用户裁决：PR5′ 仅允许基于**现有真实事实**做只读展示，优先级低于 PR-I1。原 PR5 的组合回归语义不变。 |
| **PR1**（Reviewer 决策真正接 `allow`） | 维持原编号 | BL-01 仍为 OPEN RELEASE BLOCKER ⇒ `allow` 接线与发布验收等 Alpha.5 审批路径有可核验关闭证据并完成组合回归后才可动。 |

### 2.2 PR-I1a 的范围与验收（本轮立即开始）

必须覆盖（用户裁决六条，逐条对应测试）：

1. Assignment **创建 / 转交 / 退休**的持久化写入与恢复；
2. **Epoch/CAS**、幂等、并发冲突、写入失败的明确处理（不得"看起来成功"）；
3. **Ledger 所有权校验**、跨 Case/Team 隔离、损坏记录诊断；
4. Host 与 Client 的 **factType/category 一致性**，以及重启后 Projection 重建；
5. Assignment 仅是**处理者归属事实**，绝不是授权凭据；
6. 条件无法证明时**退回 Leader**；禁止以空 Assignment 或缺失记录推导出"允许执行"。

硬约束：复用既有 TeamDomain Ledger、写入序列、Team 锁与投影；**不得建设第二套审批 Ledger**；factType 若新增
必须 host `FACT_TYPE_CATEGORY` 与 client 镜像同 commit 落账（PR2′ 已有先例 commit `dcef2a56b`）；默认关闭，未
启用的 Team 行为**逐字节**不变（G-6 / 执行计划 R-4 同一标准）。

### 2.3 PR-I1b 的范围与前置（可并行开发，不得混入 I1a）

- 保留 `CONTROL_RESOLVER_ROLES` 原闭集，不直接新增 Member 审批角色；
- 仅对"拥有有效 `approvalCaseId` + 可信 ReviewPlan + 匹配实例身份 + 当前有效 Mandate"的 Case 引入受限准入分支；
- 决策继续走 ControlService **唯一权威写入路径**，EffectSet / ExecutionGrant / ExternalHard / PA 与执行时重验
  语义全部保留；
- 任何保护中心改动必须是**具名接口 PR**，提前在本 Issue #502 公告文件所有权与和 Alpha.5 的潜在冲突，并附正确
  的 ARC-A override；
- 严格默认关闭；未启用该面的 Team 行为**逐字节不变**（G-6 / 执行计划 R-4 同一标准，不以"行为一致"弱化）；
  未经审查不得合并。

## 3. 发布纪律（同批裁决，逐条生效）

- **BL-01 维持 OPEN RELEASE BLOCKER**：不阻止 Alpha.6 独立代码开发与审查，但阻止把新的 Reviewer 决策入口作为
  生产功能启用；真实 `allow` 接线与发布验收必须等 Alpha.5 相关审批路径取得可核验关闭证据并完成组合回归。
- 两个 clone 继续只通过 GitHub 协作；不借用对方工作区、运行时状态或测试租约。
- 所有 Alpha.6 开发 PR 暂保持 **Draft + `DO-NOT-MERGE`**；独立 Code/Security Review、完整 C1、精确 HEAD 证据是
  必要条件；真实 Host C2 在资源隔离未证明前仍为 **ENV_BLOCK**，不得计作 PASS；最终候选 HEAD 必须完成单所有者
  C2 验证。
- 本轮开发授权**不等于**自动合并、生产启用或放宽安全门禁的授权。
