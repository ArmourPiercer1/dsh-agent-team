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

## 7. 追加实测（同日晚些，只读 pristine host `/home/armourpiercer/deepseek-harness`）：immediate-wake 一侧的载体**存在且公开**

裁决一把 `CORE_SEAM_BLOCKER` 限定在 **floor-delayed** 载体上。§5 当时写下"immediate-wake 子集不需要 port"，但只给了
推理；本节把它换成 file:line 实测（宿主版本 `0.2.0-rc.2` @ `639ed01539…`）。

| 实测事实 | 位置 |
| --- | --- |
| `DomainChangedBase { domain: string; table: string; key: string }`，且 `table`/`key` 在全局单例写时为 `''` | `packages/storage/storage-domain/src/events.ts:11-18` |
| `operation:'put'` 携 `value`，注释明写"**inserted or overwritten**"；`operation:'deleted'` 的 tombstone 不带 value | `events.ts:21-25`、`:28-31` |
| `DomainChanged = DomainChangedPut | DomainChangedDeleted` 是**闭合 union**（"switch on `operation`"） | `events.ts:33` |
| 事件名通过 `declare module '@deepseek-ai/cordis' { interface Events { 'domain/changed'(change: DomainChanged): void } }` 声明，注释两条语义：**"emitted once per write strictly after the backend acknowledged durability"** 与 **"Events of one domain arrive in its write-chain order"**，`@mode emit` | `events.ts:35-48` |
| 宿主自己也用 `ctx.on('domain/changed', (change: DomainChanged) => …)` 实现不变量 ⇒ 这是插件可见的事件总线，不是宿主内部私有回调 | `packages/workspace/workspace/src/invariant.ts:29-35` |

**由此可以写成事实的句子（只写它保证的）**：`ReviewAssignment` 落账之后的即时唤醒**不需要新 port、不需要计时器、
不需要核心补丁**——存在一个公开 emit-mode 事件，语义是"后端确认耐久之后、每次写一次、同域按写链顺序到达"，正是
wake-at-append 需要的形状。

**由此不可以写的句子**：它不保证跨域顺序；不保证同一 key 只发一次（`put` 覆盖 insert 与 overwrite 两种）；不保证
对"插件自己 `storageDomain.open(defineDomain(...))` 打开的域"同样发（上表最后一行证明的是宿主自己的 workspace 域）。
因此即时唤醒的 handler 必须：按 `(domain, table, key)` 过滤、按 `operation` 分派、并且**幂等**——把"顺序与唯一性"
当成宿主的承诺来写，就是本 lane 这一整轮在反对的那类越 claim。

**floor-delayed 载体仍然阻塞（裁决一范围不变）**：这条事件只在写发生之后到达，没有任何公开面能把一个动作安排到
未来某个时刻自己发生。缺的还是那件事，`CORE_SEAM_BLOCKER` 对该子集仍 OPEN；#509 继续 DORMANT。

**实现前必测（不测即不得当事实引用）**：V-1 本 lane writer 实际落的 `domain`/`table` 字符串是什么（取
`defineDomain(...)` 的名字与表名，逐字钉进测试）；V-2 该事件对插件自开的域是否同样发（造一个最小插件域，写一行，
断言收到 `put`）；V-3 两个 TeamDomain 并行写时顺序是否按域独立（同域有序即可，跨域不得依赖）。

## 8. §7 的 V-1/V-2/V-3 实测收束（同夜，只读宿主 + 读本仓）+ 两条把设计钉死的宿主语义

§7 留下三个待测。两个在源码层面就答了，一个**没有**，写清楚差别比三个都打勾有用。

### 8.1 发射点：四条写路径全部在写链内发（V-3 结构级已定）

| 路径 | 位置 | 形态 |
| --- | --- | --- |
| `KvTable.put` | `packages/storage/storage-domain/src/domain.ts:307-313` | `host.enqueue(async () => { await unit.putRecord(...); records.set(...); emitPut(key,value) })` |
| `KvTable.delete` | `:315-332` | 同一 `enqueue` 内，存在性在本 job 的链位决定，然后 `emitChanged{operation:'deleted'}` |
| `KvTable.update` | `:334-348` | 同一 `enqueue` 内 `emitPut(key,next)` |
| 全局单例写 | `:197` | `emitChanged({domain:this.name, table:'', key:'', operation:'put', value})` |

⇒ **每域有序是结构性的**：emit 就发生在该域写链的那个 job 里，链串行 ⇒ 同域通知顺序=写顺序（宿主注释"Events of one
domain arrive in its write-chain order"与代码一致）。**跨域没有任何顺序可依赖**——每个域各有一条链，交错是合法行为。
wake handler 只能按"本域内有序"写，任何跨 TeamDomain 的先后假设都是我们这一轮在反的那类越 claim。

### 8.2 发射是通用的，不是宿主自用（V-2 机制已定；V-2b 未定，不打勾）

`emitChanged` 用的键是 `this.host.domainName` / `this.tableName`，不看谁开的域。公开访问子是设施提供的
`storageDomain`（`storage-domain/src/index.ts:37` 类型面、`:236` `domainCtx.provide('storageDomain', facility)`），
消费方式 `static inject = ['storageDomain', …]` + `await ctx.storageDomain.open(spec)`——宿主自己三处：
`workspace/src/index.ts:171,198`、**`schedule/src/index.ts:101,126`**（裁决一判定"不是我们的载体"的那个服务，
恰好坐在我们正要用的这条 seam 上）、`session/session-projection-cache/src/index.ts:105,118`。

**仍未证明（V-2b）**：插件自己的 `ctx.on('domain/changed')` 是否与域发射所在的 ctx 在同一条总线上——设施把域装在
**子 ctx**（`domainCtx`）上，这一点读源码判不了，必须由 L-1 那条运行时腿回答。在此之前"插件收得到自己域的写事件"
是待验证，不是事实。

### 8.3 两条硬语义，直接把 wake handler 的形状钉死

1. **发射是链内同步派发**：`emitChanged`（`:251-258`）的注释明写 "emit dispatches listeners inline and nothing
   else runs in the try"，而它跑在 `enqueue` 的 job 里 ⇒ 监听器的**同步前缀占用该域的写链**。
   ⇒ wake handler **只能入队**（把自己的 work 丢进自有队列/微任务后立即返回）；内联做任何实际工作都会拖慢同域后续写。
2. **监听器异常被吞**：同一个 `emitChanged` 注释——"the write is already committed … containment (with a log) is
   the only correct outcome"。⇒ writer **永远看不见** wake 侧失败，重试也不会发生。
   ⇒ 即时唤醒面必须自带可观测性（自己的失败计数 + 一条断言它存在的腿），不得假设异常会传到写入方或被外层捕获。

### 8.4 V-1 的答案形态：机制到底，字面量交给运行时腿

本仓已经坐在这条 seam 上：`packages/runtime/src/plugin/host.ts:1104` 注入 `storageDomain`，`:1753-1777` 用
`ctx.get('storageDomain')` 造 seam，模块路径是 `rowConfig.seamUrl ?? resolveDefaultSeamUrl(import.meta.url)`
（**位置导出的动态 import**）；`packages/runtime/root-binding/harness/seam.mjs:33,55-58` 把
`StorageDomainSpec {name, version, tables: string[]}` 翻成 `defineDomain` + 每表 `domainTable(z.string())`。
⇒ 事件里的 `domain` = `spec.name`，`table` = 仓库的表名。但 spec 跨动态 import 边界，**静态读不是权威**：
字面量必须由 L-1 在真实世界里断言（写一行，看收到的四元组），不许把某个文件里的字符串当凭据抄进实现。

### 8.5 立即唤醒面的验收腿（红先行）

| 腿 | 断言 | 为什么要它 |
| --- | --- | --- |
| L-1a | 在本域写一行 ⇒ handler（注册时带 `{ global: true }`）收到恰好一次 `{domain,table,key,operation:'put'}`，四元组逐字等于实测字面量 | 同时回答 V-2b 与 V-1 |
| L-2 | 同 key 覆盖写两次 ⇒ 两次 `put` ⇒ handler 结果幂等（按 value 版本去重） | `put` 覆盖 insert 与 overwrite（`events.ts:21-25`） |
| L-3 | handler 抛 ⇒ 写仍 `ok`（宿主 containment），且**我们自己的失败计数 +1** | 8.3-2：不自带观测就是隐身失败 |
| L-4 | 造一个刻意忙等的 handler ⇒ 同域下一次 `put` 的完成时间被推迟（可测差值） | 把 8.3-1 的"内联派发"钉成回归门，防未来重构悄悄把 wake 工作内联回去 |
| L-5 | 两个域并发写 ⇒ 每域内部有序，跨域交错合法 ⇒ 断言只写前者 | 8.1：跨域无序是结构事实 |
| L-6 | 世界里没有 `ctx.on` ⇒ 接线**拒绝并点名**（不静默不装），且默认关闭世界里字节不变 | 本仓自身先例：`host.ts:1171/2248` 全部有 `typeof ctx.on === 'function'` 守卫；静默不装=永远不醒=最难查的活锁 |

floor-delayed 载体不受本节任何影响：以上全部发生在"写已经发生之后"，没有哪个面能把动作安排到未来自己发生。
`CORE_SEAM_BLOCKER` 对该子集仍 OPEN，#509 仍 DORMANT，仍不新建第二套持久化计时器。

**L-1 的必测变体（本会话实测所得，别凭想象接线）**：本插件里**每一条跨切订阅**都带第三个参数 `{ global: true }`
——`packages/runtime/src/plugin/host.ts:1171-1183`（`agent/created`、`agent/disposed`）与 `:2251-2256`
（`approval/request` 还加了 `prepend: true`），且全部包在 `typeof ctx.on === 'function'` 守卫里。宿主 storage-domain
把域装在**子 ctx**（`domainCtx`）上，所以"要不要 `global`"不是风格问题而是能否收到的问题。**但本会话没能从可读的
宿主源里读到 `on()` 第三个参数的语义**（`packages/*/src` 内查不到 `global?: boolean` 的声明；`@deepseek-ai/cordis`
运行时包不在这台机器的宿主树里）——这是 ENV 缺口，不是结论。故 L-1 拆成两条腿：
- **L-1a**：订阅带 `{ global: true }` ⇒ 必须收到；
- **L-1b**：订阅不带 ⇒ 记录实际行为（收到 / 收不到都写进证据，不许把"没测"写成"需要 global"或"不需要"）。
两条都跑完之前，接线代码里按本仓先例写 `{ global: true }`，并把这条理由写在注释里指向本 memo，而不是指向我的记忆。

**授权边界**：开发授权，非合并授权，非生产启用，非放宽门禁。

## 9. dated 2026-10-31：§8.5 那六条腿**在本机跑不了**——这是环境缺口，写清楚它挡什么、不挡什么

实测（绝对路径 + 原样错误，不粉饰）：

```
$ ls -d .worktrees/alpha6-pri2/tests/deepseek-harness-test-use
ls: cannot access '...': No such file or directory
$ ls tests/homes            # 本 worktree 与 lane 根都查过
ls: cannot access 'tests/homes': No such file or directory
$ ls -d /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness
No such file or directory
```

`tests/paths.mjs` 在（版本 pin 读得到），但 TEST_METHODS §2/§5 的**运行时检出本体不存在**，而它唯一的来源——共享
只读 baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`——这台机器上没有。于是：

- **挡住**：L-1a/L-1b（订阅能否收到自己域的写、`global` 到底改变什么）、L-3 的包含性与自有失败计数、
  L-4 的忙等回归（要真实写链才谈"下一次同域 put 被推迟"）、L-5 的跨域次序实测——即 §8.5 里所有**需要真实宿主
  进程**的腿。分类上这是 **环境入口缺口**，不是 `CORE_SEAM_BLOCKER`：按 2026-10-31 裁决一，`CORE_SEAM_BLOCKER`
  只限 PR-I2 的 floor-delayed timed-wake 载体；本机缺检出**不新增**任何 blocker 类目，也不构成改宿主的理由。
- **不挡**：不需要宿主进程的部分——判定核（给定四元组 + 耐久 wake 记录，判"该醒/该忽略"与闭合理由码）、
  默认关时的字节等价、无时间源 ⇒ `TIMED_WAKE_UNAVAILABLE` 拒绝路径、`typeof ctx.on === 'function'` 缺失 ⇒
  拒绝并点名。这些在 `packages/*/test` 的既有 vitest 世界里就是可测的。
- **因此这条 memo 强制的分解**：立即唤醒子集拆成 **(a) 纯判定核 + 其单测（本 lane 现在能做）** 与
  **(b) 订阅接线（等 L-1a/L-1b 先跑，跑不了就不接线）**。(b) 不得用"假定 `global` 语义"冒充已验证——上一节
  已经为此把 L-1 拆成两条腿。缺 (b) 的运行时证据时，正确的产物是**拒绝接线并点名这条环境缺口**，
  而不是先写接线再补一个跑不到的测试。

谁在别的机器上补齐这六条腿，请连同**它跑在哪个检出、哪个 DSH_HOME、哪个 commit** 一起交；`ENV-REFUSED` 不是
PASS，"我本地能跑"也不是答案（同一份 memo 就是为这个区别写的）。

## 10. dated 2026-10-31：接线位置**不需要猜**——本仓的宿主胶水已经在注入 `storageDomain`

写 §9 那条分解时留了个未决问题：立即唤醒的订阅到底接在哪。实测把它关掉了：

- `packages/runtime/src/plugin/host.ts` **是本仓 tracked 文件**（`git ls-files --error-unmatch` 命中），不是宿主文件；
- 它的 `inject` 数组第 1104 行原文：`export const inject = ['agents', 'storageDomain', 'sessions',
  'sessionPersistence', 'workspaceRegistry']` —— 也就是说**本仓的插件宿主已经拿到 `storageDomain` 这条 facility**，
  §8.4 那条"V-1 机制"在本仓的落点不是假设；
- 同一文件 `:1171` 起就是这个形状：`if (typeof ctx.on === 'function') { ctx.on('agent/created', …`，
  即"有总线就订、没有就不订"的守卫写法在本仓已是既有先例（§8.5 L-6 引的就是它）。
- 卫生屏侧：`a6-pr2-lane-hygiene.test.ts:63-69` 的 `PROTECTED_PREFIXES` 里与 `src/plugin` 有关的只有
  `src/plugin/live/pa-mount-registry.mjs` 与 `src/plugin/live/agent-bindings.mjs` 两个具名文件；
  `host.ts` 本身不在保护前缀内。

**因此本次实现的位置决定（先写后码，免得实现时随手挑一个目录）**：

1. **判定核放新模块**，不塞进 `host.ts`：纯函数、可单测、不需要宿主进程——正是 §9 分解里的 (a)。
   `host.ts` 已经够大，把"该不该醒"的判定埋进宿主胶水，等于让唯一能测它的地方变成 boot 世界。
2. **接线只在 `host.ts` 里加一处调用**，写在既有 `typeof ctx.on === 'function'` 守卫之内，与
   `agent/created`/`approval/request` 同一形状；默认关，关时不注册任何订阅、既有事件序列字节等价。
3. **不新建受保护前缀下的文件，也不碰那两个具名 live 文件。** 若卫生屏要求新增模块入册，走
   `EXTRA_MODULES_ALLOWED` 那条例（PR-I1a 已在里面留了先例与理由），并在 PR 描述里点名。
4. **接线的前置条件仍是 L-1a/L-1b 真跑过**（§9：本机跑不了 ⇒ 本 lane 只交 (a) + "拒绝接线并点名缺口"）。
   `storageDomain` 已经在 inject 里，只证明"拿得到域"，**不**证明"`domain/changed` 会送到我这里"——
   这两件事之间隔着子 ctx 与 `global` 语义，正是 L-1 的两条腿。

## 11. dated 2026-10-31：§3 的拒绝面**已经有实现和腿了**，以及 §4.1 与 §2.6 那句话怎么同时成立

实现落在 `packages/runtime/timed-wake/decision.ts`（+ `index.ts` 桶 + `test/a6-pr-i2-timed-wake.test.ts`，13 条腿），
`tsconfig.build.json` 加了 `timed-wake` 一行编译面。**没有任何计时器**：deps 注入 port / 墙钟 / 耐久 sink /
幂等查询，模块内零 `setTimeout`、零存储句柄、零宿主 import；`host.ts` 一个字节都没动，因为 §10 的接线前置条件
（L-1a/L-1b 真跑过）在本机是 ENV-REFUSED。

§4.1 写"无 port ⇒ …没有任何耐久写入"，§2.6 写"必须…在耐久面上留下该请求被拒绝的事实"。两句同读会打架，实现按这个
裁决落地，并把它当成契约的一部分写进测试：**"没有耐久写入"指的是没有任何"授予唤醒保证"的写入**——绝不允许出现
`timed-wake-scheduled` 这类事实；而拒绝留痕是 §2.6 明写的义务。于是腿 1 的断言形状是"恰好一条事实，且它是
`timed-wake-refused`"，两类写入各用一个 kind 钉死，读者不需要靠猜。这条裁决写在这里，是为了将来真接上宿主的人
不必再重新解释一次这两句话。

实现里另外两条不显然的形状，都是被 §3/§4 逼出来的：port 自己的拒绝码**原样透出**（外层 `PORT_REFUSED` + 内层
`portCode`），因为改写它就会把"哪一层说不"藏起来；carrier **抛异常**不算拒绝——记 `timed-wake-schedule-error`
后原样重抛，把异常洗成一个 code 就是撒谎。

仍然没有解决、也仍然不许被这份实现冒充的东西：§1 的公开面缺口、floor-delayed 载体的 `CORE_SEAM_BLOCKER`、
§8.5 的宿主端到端腿。这份实现证明的是"拒绝面可测"，不是"到点会醒"。

## 12. dated 2026-10-31（同日晚些）：§9 缺的是一条路径，不是一种能力——运行时今天在本机物化了，L-1a/L-1b 真跑过了（V-2b 关闭），floor-delayed 的阻塞从推断升级为测量

证据正本已入 tracked：`dev/agent-workflow/evidence/alpha6-pri-i2-runtime/`（`feasibility-report.md` 是本轮 run 的
主记录，`probe-out.json`、`preflight-check.txt` 是两张原样捕获，`MEASURED-LINES.txt` 收着本节所有被引用命令/输出
行的逐字文本）。本节不复述记录，只回答：这次测量把本 memo 的哪些话**从推断换成了事实**，哪些话**没被换成**。

### 12.1 运行时在本机**可以**物化，而且今天物化了

`docs/TEST_METHODS.md` §1 第 16 行把 fresh-worktree 落位写的是泛称：`git clone --local --no-hardlinks <只读 baseline 树>
tests/deepseek-harness-test-use` + `checkout --detach <TEST_USE_BASELINE_SHA>`——那一行把源写作"**只读 baseline 树**"，
没有把它限定为 `/srv/workspace/…`（该路径只出现在 §9 的资产来源里）。所以从本机同 SHA 只读树
`/home/armourpiercer/deepseek-harness` 克隆是**被允许的**，不是绕行。实测（逐字见 `MEASURED-LINES.txt`）：clone exit 0
（`real 0m1.862s`），detached @ `639ed01539…`、porcelain 0；`INSTALL_EXIT=0`；`BUILD_EXIT=0`
（`build: recorded 347 client artifact(s) with 2 public value(s)`）；宿主真实启动于 **3181**（`HOST_PORT_BANDS` 段；
:3080 全程未触碰，探测记 `stable_3080_status=401` (untouched)）；`DSH_HOME=tests/homes/a6pri2-20261031T11-33-49Z` 在工作区
内；无 token `401` / 带 token `303`；世界用毕按 §7 拆除。宿主仓 BEFORE/AFTER porcelain 均 0，CORE PATCH BUDGET 消耗 0。

**重分类，直说**：本 lane 此前以"缺运行时"为由记 `ENV-REFUSED` 的一切腿（§9 那批、PR-I1b 的真机腿），今天量出来的
结论是——**那是拒绝于一条不存在的路径，不是拒绝于一种不存在的能力**。lane 把"目录不在"当科学限制用了几个钟头，
这个错不是靠措辞改掉的，是靠跑出来的。不变的纪律是"ENV-REFUSED 不是通过、跑过才写 PASS"；变掉的是"缺运行时"
这三个字在本机不再是拒绝理由。

### 12.2 §9 的 host-sandbox 资产**仍然供不上**——两个事实并记，谁也不许抹掉谁

`node tests/world-factory/provision-host-sandbox.mjs --check` 依旧 exit 1：`probe: before-provision=unusable ->
after-provision=unusable`、`backend: unusable (usable: false)`、`launcher: ABSENT`；`landlock-run` 本机不存在，本地编译的
`system.node` 是 17352 B / sha `75450f92…`，不等于 pinned 的 17360 B / `54a9c25c…`。**而这没有阻止宿主启动并服务**：
本轮用到的 HTTP 应答、插件行挂载、remote 调用应答全部发生（`backend unusable` 的完整影响面本轮**没有**测，本 memo
不说它只挡什么）。§9 的资产缺口成立；12.1 不抹掉它，它也不抹掉 12.1。

### 12.3 L-1a/L-1b 已实测：两条都收到，V-2b 关闭，`{global:true}` 在本 SHA 不是必需

探针插件只经世界的 `profiles/web/cordis.patch.yml` 挂载，经注入的 `ctx.storageDomain` 开自己的域，写一行，看两条订阅
（l1a 带 `{global:true}`、l1b 无第三参）——两条都收到 `{domain:"a6pri2wakeuprobe",table:"rows",key:"probe-key-1",
operation:"put"}`，事件逐字相同。

- §8.2 那句"**仍未证明（V-2b）**：插件自己的 `ctx.on('domain/changed')` 是否与域发射所在的 ctx 在同一条总线上"
  ——**已证：同一条总线，插件收得到自己域的写**。L-1b 按定义记录的是实际行为：收到了。
- 机制侧：克隆内 `vendor/cordis/src/events.ts:114-116` 的 `global?: boolean` = "Receive the event regardless of
  context filter checks"，`:171-173` `.filter(hook => hook.global || !filter || filter.call(thisArg, hook.ctx))`——发射侧
  无 filter 时非 global 监听者收到。故 `{global:true}` **不是**本事件在本 SHA 的必要条件。§8.5 的"本会话没能从可读的
  宿主源里读到 `on()` 第三个参数的语义"当时为真（它的范围是那台可读宿主树），今天按测量重新贴标：cordis 运行时源
  在 baseline 树的 `vendor/cordis/` 里，克隆即读到。
- **这次测量的边界**：它只回答"收得到吗、第三参改变什么"。L-2（覆盖去重）、L-3（containment 与自有失败计数）、
  L-4（内联忙等回归）、L-5（跨域交错）**本轮没跑**，不得由本节的阳性结果回溯成已完成；"本 SHA 不必需"也不等于
  "任何 SHA、任何 filter 下都不必需"。§10.4 的接线前置（L-1a/L-1b 真跑过）由本次测量满足——但本轮只交 docs/evidence，
  接线在后续实现轮做；接线代码怎么写 `{global:true}`，由那一轮拿着本节证据裁决。

### 12.4 floor-delayed 载体：从读源推断升级为活宿主测量，阻塞分毫不动

五项测量（逐字见 `MEASURED-LINES.txt` §5）：

1. 默认 profile 里 `inject: ['schedule']` 永不激活：`pending (waiting for service: schedule)`；
2. 开上 experimental schedule bundle 后 `ctx.schedule`（ctorName `ScheduleService`）方法面为 `catalog, create, delete,
   emitChanged, getDomain, history, initialized, list, serialize, stopSessionTasks, update`——**没有 callback/handler
   注册面**；
3. 活体 `ctx.schedule.create(sessionId, {after_seconds: 3})` 持久落了 due time（`scheduledAt:"2026-10-31T11:45:17.987Z"`），
   插件可见的事件只有 **CREATE 时刻（11:45:15.016）一条无 payload 的 `schedule/changed`**，due 时刻什么都没有，
   `pluginReceivedWakeCallback:false`；
4. due 动作的来源：`packages/schedule/schedule/src/runtime.ts:101-123` — `resolveAgent → createUserMessage →
   agent.followup`，一个 session-bound 的 user-role turn，不是插件 callback；
5. 对 baseline 树 162 个 `interface Context` 成员的普查：时间形状的只有 `schedule, jobs, jobController, ptcRuntime,
   webhookRuntime, vmTimeoutMs`；`ctx.jobs`（`LocalJobRegistry`）无任何 delayed-start 面。

⇒ PR-I2 floor-delayed 子集的 `CORE_SEAM_BLOCKER` **维持 OPEN**，性质升级：§1/§2 的负断言现在坐在活宿主测量上，
不再只坐在 grep 上。负断言的范围声明不变——"no primitive exists"仍**不是**对全宿主的穷尽证明，这条升级不把它变成
穷尽证明。#509 继续 DORMANT；不新建第二套持久化计时器。

### 12.5 生产 ControlService 的 resolve 路径端到端执行了——PR-I1b 的真机腿从今天起是"可实现"

本 lane 自己构建的 `packages/runtime/dist/packages/runtime/src/plugin/host.js` 只经 patch seam 挂载：
`team.getLedgerPage` v1 → `ok:true`；`team.resolveControl` v4（bogus id）→ `CONTROL_REQUEST_NOT_FOUND` 配 durable-storage
措辞（`"ControlService: no durable control request … (a decision without a request)"`）。**必须原样保留的区分**：挡 PR-I1b
真机腿的是**规则**（只读探针不得编辑 tracked 测试），**不是环境**——那条腿从今天起是可实现的（implementable），
不是已跑完的。边界：真实 pending request 没有造出来（需要 mock-model fixture 走 member ask-lane），S-7 真实世界字节差
没跑。

### 12.6 事故披露：一次 boot 把家指向了工作区外（零字节写入）

一次后台 boot 未显式设 `DSH_HOME`，继承了 `/home/armourpiercer/.dsh`，尝试写
`/home/armourpiercer/.dsh/profiles/web/cordis.yml` → `EROFS` + 沙箱拒绝，exit 1，**写入零字节**；此后每一次 boot 都显式
把工作区内路径设为 `DSH_HOME`。发布这条不是因为有损害，是因为"lane 起过宿主，且其中一次 boot 的家指过工作区外"
是读者信任其余记录所需要的事实。

### 12.7 重新贴标清单（旧语句一字不删，此处只换性质标签）

| 本 memo 的语句（未改写） | 当时的性质 | 现在的状态 |
| --- | --- | --- |
| §9 "§8.5 那六条腿**在本机跑不了**……环境入口缺口" | 缺路径的事实 + "本机跑不了"的推断 | 路径可补、运行时已物化（12.1）；L-1a/L-1b 已跑（12.3），L-2…L-5 仍未跑 |
| §8.2 "V-2b 未定，不打勾" | 待验证（正确的克制） | 关闭——两条腿均收到，活测量（12.3） |
| §8.5 "on() 第三个参数的语义读不到" | 当时可读范围的陈述（当时为真） | 被 12.3 替代：`vendor/cordis/src/events.ts:114-116,171-173` 可读，且与实测一致 |
| §8.5/§10.4 "接线前置 = L-1a/L-1b 真跑过" | 纪律 | 前置已由测量满足；接线不在本轮 |
| §1/§2、§8.5 末段 floor-delayed `CORE_SEAM_BLOCKER` | 读源推断 | 维持，升级为活宿主测量（12.4） |

**仍未证明（不得由本节回溯）**：L-2/L-3/L-4/L-5；一条真实 pending control request 的端到端（需 mock-model fixture）；
S-7 真实世界字节差；任何"到点会醒"的能力。§9 的资产缺口未修复。
**授权边界**：开发授权，非合并授权，非启用，非放宽门禁。
