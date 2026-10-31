# BLOCKER · CORE_SEAM_BLOCKER · alpha6-pr-i2-timed-wake-carrier

- **状态**：OPEN（用户 2026-10-31 裁决登记）
- **登记时间**：2026-10-31（真实 UTC）
- **登记人 / owner**：Alpha.6 Lane 2（independent integrator clone，本会话）
- **scope（严格，不得扩大）**：仅 **Alpha.6 PR-I2 的 floor-delayed timed wake carrier**（"quiet 到期后仍会唤醒"这一
  子能力）。**不阻塞** Alpha.6 其余部分、PR-I2 的事件驱动即时唤醒子集、PR-I1a、PR-I1b、PR5′、Alpha.5。
- **Host 基线**：DSH `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（pristine，只读复核，未写入）
- **正本记录**（固定格式全文、最小复现、受影响不变量、可能的 upstream 通用 seam 提案）：
  `docs/plans/memo/alpha6-review-separation/rulings-20261031-timed-wake-and-pr-i1.md` §1.1
- **能力边界补遗**：`docs/plans/memo/alpha6-review-separation/s0-addendum-timed-wake-carrier-20261031.md`（N-1）
- **公开面缺口一句话**：在两轮独立复核（round-1/round-2 records review）对宿主 `0.2.0-rc.2 @ 639ed01539` 公开面与 timer 出现集的逐点排查中，始终存在的公开面上没有发现任何能让插件在"指定的未来时刻"发起唤醒的原语（**非穷尽证明**：负全称命题未被穷尽验证，两轮均记录为 spot-check）；唯一墙钟可达项是
  可选、默认关闭的 ScheduleService，且其到期动作是用户可见的 user-role 提醒轮 + payload-less 事件。
- **停止动作（ROUTER_RULES §5 要求）**：该子能力停止推进；不为其自建第二套持久化 timer/scheduler；不 patch
  upstream；缺时间触发源时相关请求必须显式拒绝，不得报告 `accepted: true`，不得静默丢弃唤醒保证。
- **不受影响的既有交付**：PR0 / PR2′（#507）/ PR3′ / PR4′（#509）累计核心补丁消耗 = 0；#509 继续 DORMANT。
- **候选适配器（非授权、非本轮）**：ScheduleService 可作为未来独立 PoC 的适配器候选，需另行用户授权与独立审查。
- **收口条件**：宿主提供 TimedWakePort 语义的公开原语（一次性、指定时刻、可取消、重启可恢复、类型化投递回执），
  或用户另行裁决一个可接受的公开载体。收口时在本文件追加收口记录，不抹除本条目。
