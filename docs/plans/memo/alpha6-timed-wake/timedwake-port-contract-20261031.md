# TimedWakePort — 最小契约草案（Alpha.6 PR-I2 的前置契约；载体仍然阻塞）

- **日期**：2026-10-31
- **作者**：Alpha.6 Lane 2（独立 integrator），本会话
- **状态**：**契约草案**（contract-first）。本 memo 不实现任何东西，不挂载任何东西，不解除任何阻塞。
- **裁决依据**：用户 2026-10-31 裁决一。正本在该裁决的记录 PR **#513** 分支
  （`alpha6/lane2-governance-20261031`：`docs/plans/memo/alpha6-review-separation/rulings-20261031-timed-wake-and-pr-i1.md`
  与 `dev/agent-workflow/blockers/alpha6-pr-i2-timed-wake-carrier-20261031.md`）；**这两个路径在本 PR 的 base
  `7b906b432` 上不存在**，它们随 #513 落库，故此处按 PR 号引用而不是假装本树可见。裁决内容：ScheduleService **不是**
  Alpha.6 的定时唤醒载体；`CORE_SEAM_BLOCKER` 严格限定于 **PR-I2 的 floor-delayed 定时唤醒载体**；#509 继续
  DORMANT；不得建第二套持久化 timer；缺时间触发源时相关请求必须显式拒绝，**不得**报告 `accepted: true`。
- **宿主基线**：DSH `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（pristine，只读复核：本次读取前后
  `git status --porcelain` 均为空，`git rev-parse HEAD` 即上述 SHA）。**本 memo 引用的宿主行号全部由本会话在该
  commit 上逐行打开核对**（`sed -n`，只读），不是转抄。

---

## 0. 为什么先写契约，而不是先写实现

PR-I2 要交付的是"评审唤醒在到点时被重新唤起"。它需要一个能在**任意未来时刻**发起唤醒的时间触发源。公开面上没有
这样的原语（§1），所以按 ROUTER_RULES §5，该子能力停止推进，登记 `CORE_SEAM_BLOCKER`，不自建第二套调度器，不
patch upstream。

但"停止推进"不等于 PR-I2 无事可做，也不等于 upstream 提案可以空着手提。契约先行解决三件事：

1. 让**拒绝**成为可测试的行为，而不是一句注释（§3）；
2. 让 PR-I2 的**即时唤醒子集**（不等待未来时刻，只在 append 时刻触发）与阻塞部分干净切开（§5）；
3. 让未来任何 upstream 通用 seam 出现时，插件侧只需实现一个 port adapter，**不需要**改动折叠与判定逻辑（§4）。

## 1. 公开面缺口的证据（本会话在 `639ed01539` 上实测）

| # | 事实 | 位置（本会话逐行核对） |
| --- | --- | --- |
| E-1 | ScheduleService 属**可选包**，默认关闭；`profile.ts` 的注释明文 "offered switched off by the plugin manager" | `packages/boot/app-boot/src/profile.ts:209`（注释）、`:213-218`（`OPTIONAL_BUNDLES` 列表）、`:217`（`'@deepseek-ai/dsh-experimental-schedule-bundle'` 条目） |
| E-2 | 定时到期动作是**一条用户可见的 user-role 提醒轮**，不是插件回调 | `packages/schedule/schedule/src/runtime.ts:101`（`resolveAgent(task.sessionId)`）、`:118`（`renderReminderFraming(task.record)`）、`:119-121`（`createUserMessage({ …, source: { kind: 'schedule' } })`）、`:123`（`resolved.agent.followup(message)`） |
| E-3 | 该服务对外只发 **payload-less** 事件，且是 emit-mode；消费者只能整体 refetch | `packages/schedule/schedule/src/index.ts:396`（`this.ctx.emit('schedule/changed')`）、`types.ts:468-471`（文档注释「clients refetch global task and Session-active catalogs」+ `@mode emit` + `'schedule/changed'(): void`） |
| E-4 | 定时任务模型（`after` / `at` / `every` / `daily` / `weekly` / `cron`）存在，但挂在一个 **Remote Service + 模型可见 tools** 上，不是插件侧可注册的唤醒 | `packages/schedule/schedule/src/types.ts:17` `AfterScheduleRecord`、`:33` `AtScheduleRecord`、`:47` `EveryScheduleRecord`、`:63/:81/:101` Daily/Weekly/Cron；`index.ts:27`（`registerScheduleTools`）、`index.ts:100`（`class ScheduleService extends TypertRemoteService`） |
| E-5 | `domain/changed` 严格是**写后**事件，只能在 append 时刻触发，不能在任意未来时刻触发 | storage-domain 的 `events.ts` / `domain.ts`（裁决 §1.1 Observed 已记；本 memo 不重复展开） |
| E-6 | 本会话对插件可及面 grep `registerWake\|scheduleWake\|onWake\|wakeAt\|notBefore`：`packages/extensions`、`packages/api`、`packages/hooks` 三组内**零命中**（排除 `node_modules`） | 命令与本 memo 同批记录 |

**限定（必须与结论同处出现）**：E-6 与"没有原语"是**负全称**命题。本会话的测量范围是 §1 列出的包组与 schedule 包；
两轮独立复核（#513 round-1/round-2）记录的是逐点排查（spot-check）。**均未做穷尽证明**。结论是"在已排查范围内不
存在"，不是"在整个宿主中不存在"；若 upstream 提供通用 seam，判据以 §2 的语义要求为准，而不是以某次 grep 为准。

## 2. 契约：`TimedWakePort`

一个 port、两个方法、一条回调。**最小性判据**：PR-I2 的唤醒折叠只需要"到点告诉我"与"取消"，不需要周期语法、
不需要 cron、不需要人类可读时间。任何周期/日历语义都属调用方，不属 port。

```ts
/** Alpha.6 PR-I2 消费的时间触发源。插件侧只提供本 port 的实现（adapter），
 *  绝不自行持有 setInterval/setTimeout 作为持久唤醒（P-4：不建第二套调度器）。 */
export interface TimedWakePort {
  /** 请求在 notBefore（含）之后唤醒一次。实现方必须持久化该保证，或显式拒绝。 */
  schedule(input: {
    readonly wakeId: string;          // 调用方生成的幂等键；重复同 id 不得产生第二个唤醒
    readonly notBeforeEpochMs: number; // UTC epoch ms，必须 ≥ 当前已知墙钟；过去时刻按"立即"处理
    readonly reason: TimedWakeReason;  // 为什么唤醒：折叠靠它归因，不得用于传递权限
  }): Promise<
    | { readonly accepted: true;  readonly scheduledAtEpochMs: number }
    | { readonly accepted: false; readonly code: TimedWakeRefusal }
  >;

  /** 取消。取消不存在的 wakeId 必须返回结构化结果，不得抛。 */
  cancel(input: { readonly wakeId: string }): Promise<
    | { readonly cancelled: true }
    | { readonly cancelled: false; readonly code: 'UNKNOWN_WAKE' | 'ALREADY_FIRED' | 'CANCEL_UNSUPPORTED' }
  >;

  /** 到点投递。实现方在触发时刻调用；投递失败不改变"曾经到点"这一事实。 */
  setHandler(handler: (wake: {
    readonly wakeId: string;
    readonly reason: TimedWakeReason;
    readonly firedAtEpochMs: number;
    readonly dueSinceEpochMs: number;   // 原请求的 notBefore，用于识别迟投
    readonly replay: boolean;           // 重启/补投后重放为 true
  }) => void | Promise<void>): void;
}
```

语义要求（upstream 判据；每条都可被 §4 的验收腿证伪）：

1. **持久性**：`accepted: true` 之后进程重启，唤醒必须仍然到达（宿主重启期间到点的，重启后补投并置 `replay: true`）。
   做不到就必须拒绝，不得"收下再说"。
2. **不丢不重**：同一 `wakeId` 至多一次业务效果。port 允许 at-least-once 投递（重启补投），**幂等归调用方**，
   因此 `wakeId` 必须由调用方生成且进入耐久事实。
3. **墙钟语义**：`notBefore` 是墙钟时刻，不是相对延时；port 不得对调用方隐藏"我其实用 setTimeout 近似"这一事实。
   墙钟回拨导致已过期的唤醒必须立即补投，不得静默丢弃。
4. **归因**：`reason` 只允许携带"为什么醒"（如 `review-wake-deferred-floor`），**不得**携带授权、身份或决策依据；
   权限判定必须走 ControlService 的正规路径，唤醒本身永不成为凭据（PR-I1a/PR-I1b 同一律）。
5. **无隐式第二状态**：port 不得在插件可见范围外维护唤醒集合；取消必须可判定（`ALREADY_FIRED` 与
   `UNKNOWN_WAKE` 必须是不同答案）。
6. **缺失即拒绝**：port 不存在（本阶段全部情形）时，PR-I2 的 floor-delayed 操作**必须**返回
   `{ accepted: false, code: 'TIMED_WAKE_UNAVAILABLE' }`，并在耐久面上留下"该请求被拒绝"的事实；
   **永不**报告 `accepted: true`，**永不**静默丢弃唤醒保证（裁决一第 4 条）。

## 3. 拒绝面（本阶段唯一可实现的部分）

```ts
export type TimedWakeRefusal =
  | 'TIMED_WAKE_UNAVAILABLE'   // 无 port：本阶段全部情形
  | 'NOT_BEFORE_IN_PAST'       // 只在调用方明确要求"不得早于"语义时用于过去时刻
  | 'WAKE_ID_CONFLICT'         // 同 id 已绑定不同 reason
  | 'PORT_REFUSED';            // port 存在但拒绝（其拒绝原因原样透出，不改写）
```

本阶段（无 port 可用）PR-I2 的 floor-delayed 入口只允许一条代码路径：**构造拒绝 + 留痕**。这条路径是可测的，
因此"阻塞"不是一句声明，而是被腿钉住的行为。

## 4. PR-I2 若要实现，需要钉住的验收腿（契约测试，port 用 fake 实现）

1. 无 port ⇒ `TIMED_WAKE_UNAVAILABLE`，且**没有**任何耐久写入、没有任何 `accepted: true`；
2. `schedule` 成功后进程重启（fake 重放）⇒ handler 恰好再收一次且 `replay: true`、`dueSinceEpochMs` 保持原值；
3. 同一 `wakeId` 连续两次 `schedule` ⇒ 第二次不产生第二个唤醒（腿计投递次数）；
4. `notBefore` 早于当前墙钟 ⇒ 立即投递，且 `firedAtEpochMs ≥ notBeforeEpochMs`；
5. 墙钟回拨（fake 把 now 往回拨）⇒ 已到点唤醒补投，不静默丢弃；
6. `cancel` 一个不存在的 id ⇒ `UNKNOWN_WAKE`；已投递 ⇒ `ALREADY_FIRED`；两者不得相同；
7. handler 抛错 ⇒ 不影响"曾经到点"，且错误进入耐久面（不得吞）；
8. `reason` 出现在耐久事实中，但**不出现**任何 authority/permission 键（沿用 PR-I1a 的 payload 屏幕）。

以上每条都必须在**契约层**可测（fake port），不依赖真实宿主，因此不属 C2/ENV_BLOCK；真实宿主端到端仍是
**ENV_BLOCK**，不得冒充。

## 5. 与 PR-I2 其余部分的关系（切分）

| 子集 | 是否依赖本 port | 本阶段可否推进 |
| --- | --- | --- |
| **floor-delayed 唤醒**（"到点再醒"） | 依赖 | **不可**：`CORE_SEAM_BLOCKER`，本 memo §1/§2 |
| **即时唤醒**（append 时刻即触发，走 `domain/changed` 等写后事件） | 不依赖 | **可**：这是 PR-I2 本阶段实际交付的子集 |
| 评审 defer 面（#509） | 不依赖（其唤醒保证不承诺未来时刻） | 继续 **DORMANT**，裁决一 |

## 6. 明确不做

- 不自建第二套持久化 timer / scheduler（P-4）；不在插件内用 `setInterval`/`setTimeout` 充当唤醒载体；
- 不 patch upstream、不用 `pnpm patch`/postinstall 改写宿主；向 upstream 提通用 seam 提案是**下一步**，
  本 memo 只准备判据；
- 不给模型可见面新增任何工具或字段；不启用任何 flag；不改 ARC-A  protected centre；
- 不把"契约已写好"当作"载体已解决"：§1 的缺口仍在，`CORE_SEAM_BLOCKER` 仍 OPEN（范围仅 floor-delayed 载体）。

**授权边界**：开发授权，非合并授权，非生产启用，非放宽门禁。
