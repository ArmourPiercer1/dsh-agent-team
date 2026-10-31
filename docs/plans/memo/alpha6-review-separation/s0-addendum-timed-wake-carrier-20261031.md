# S0 具名补遗（2026-10-31）：能力边界新增一条——"在任意未来时刻发起唤醒"不属于公开面

> **本文件是补遗，不是修订。** `s0-revalidation-20261030.md` 的原文、dated banner 与其全部历史结论**保持原样**，
> 不回填、不覆盖、不重排。本文件只追加一条 S0 当轮**未提出**的能力命题，并给出它的证据、裁决与影响面。
> 触发原因：用户 2026-10-31 裁决（正本见同目录 `rulings-20261031-timed-wake-and-pr-i1.md`）。

## 1. S0 说了什么（S0 第 75、79 行逐字引用；§0/§6 条目是**摘要**，非逐字）

- S0 结论 §0 与 §6（**摘要**，非逐字。§6 那句的原文是 `s0-revalidation-20261030.md:115`；§0 是 :8-16 的 CONDITIONAL PASS + C1/C2/C3 条件表（实测 `grep -n '^## ' s0-revalidation-20261030.md`：§0 标题在 :8、§1 标题在 :18、:17 是空行；**round-4 F-R4-4 之前这里写的是 `:8-20`**，那是照抄 reviewer 给的未实测区间，:18-20 属于 §1），其中「无 `CORE_SEAM_BLOCKER`」这条字面结论不在 :115，而本补遗 §4 正是给它划范围的——round-3 G-R3-12 之前这里只指了 :115）：
  **PR3（单飞调度器内核）与 PR0（可信 ReviewPlan/Identity/Mandate 派生）不碰受保护文件，先做**；
  PR1/PR2 的决策与路由入口改造是具名 Center-Interface PR，**排在 C1 条件落地之后**；
  真实 Host 腿（PR4/PR5 的验收形态）在 C2 条件落地之前全部 ENV_BLOCK，不冒充。
  （本条压缩自 S0 的一句话结论：只删去「见同目录…」与「一句话：」两处连接文字，三个限定全部保留——
  可信、排在 C1 条件落地之后、C2 条件落地之前 ENV_BLOCK。）
- S0 §3 能力表第 75 行，逐字（围栏内为源文件该行的原始字节，未去反引号、未改换行）：
  ```text
  | 调度器持久状态 | `storageDomain.open(defineDomain(...))` KvTable（CAS/条件写）+ `domain/changed` | `packages/storage/storage-domain/src/index.ts` |
  ```
  （2026-10-31 round-3 修正：此处原先是一段去格式的重排——四根管道去掉三根（行首、`KvTable` 之后与行尾那三根列边界没了，内嵌的「调度器持久状态 | storageDomain…」那根存活；round-4 F-R4-7 实测：`git show 6937dd32b:…` 该行 `tr -cd '|' | wc -c` = 1，源行 = 4，所以 round-3 写的「管道被去掉」是过度描述，准确说法是**去掉了四分之三**）、内嵌反引号被去掉、并且在源文件有空格的位置断行，按本 lane 的 unwrap 方法复原后会得到 `` `…（CAS/条件写）+domain/changed…` ``，与源文件的 `` `…+ `domain/changed`…` `` 不等；在「逐字引用」标题下这是错的，见 PR #513 round-3 G-R3-1。）
- S0 §3 硬约束第 79 行（逐字）：
  > **硬约束**：`whenIdle()` 等待整个队列抽干（`agent.ts:237-241`），今日控制通知正因此成为多余轮次的放大器
  > （`agent-bindings.mjs:5033`）；`agent/created` / `pre-step` / `turn-stopping` 是**被 await 的**钩子
  > （`runtime-types.ts:252-254` 明文禁止在钩子里 `whenIdle()`）⇒ 调度器只订阅 emit-mode 事件。
- 执行计划 §2 记录 S0-B 判定：**无需 host patch**（CORE PATCH BUDGET = 0 未被触碰）。

**以上结论对本补遗而言仍然成立**（唯一例外见 §4：S0-B 的「无需 host patch」判断，对 N-1 这一条
floor-delayed 载体路径不再成立；其余 Alpha.6 路径不受影响），且已被实际交付复核：PR0（`review-mandate/`）、PR2′（#507）、PR3′
（`review-wake/`）、PR4′（#509 defer 面）四张 PR 累计**消耗 0 个核心补丁**，无一需要 host 改动。

## 2. S0 没有问的那一个问题（本补遗的新增边界）

S0 §3 枚举的是**状态与事件面**（KvTable 持久状态、`domain/changed` 事件、emit-mode 钩子）。它没有提出、因而也
没有回答这个问题：

> **始终存在的公开面上，是否存在一个原语，能让插件在"某个指定的未来时刻"发起一次唤醒？**

这不是 S0 的疏漏式错误，而是 S0 的问题集合里没有这一项：defer/floor（静默到期再唤醒）是 PR4′ 之后才成为需求
的。本补遗把它记为新增命题 **N-1**。

**N-1 的答案（2026-10-31，pristine host `0.2.0-rc.2 @ 639ed01539` 只读复核，逐条 file:line）：不存在。**

1. `domain/changed` 严格是**写后**事件（storage-domain 的 events/domain 实现），只能在 append 落地的那一刻触发，
   不能在任意未来时刻触发 ⇒ S0 第 75 行的组合足以承载**状态与对账**，不足以承载**到期唤醒**。
2. 宿主唯一可达的墙钟原语是 **ScheduleService**，而它在 `app-boot/src/profile.ts:213-218` 的
   `OPTIONAL_BUNDLES` 清单内（条目在 `:217`；注释明文「offered switched off by the plugin manager」在 `:209`）
   ⇒ 可选、默认关，不能充当始终存在的运行时前提。（宿主 `639ed01539` 复核；本轮同一条事实的裁决正本已用同一组行号。）
3. 该原语的到期动作是 `runtime.ts:101` `resolveAgent(...)` → `:118` `renderReminderFraming(...)` →
   `:119-121` `createUserMessage({ source: { kind: 'schedule' } })` → `:123` `agent.followup(...)`
   （行号经 round-1 records review 复核修正），即**一条用户可见的提醒轮**，且 `index.ts:396` 只发
   payload-less 的 `schedule/changed`（`types.ts:471` 声明为 `(): void`）⇒ 唤醒归属、来源语义、取消、去重、恢复
   都无法由该通道承担。
4. 在两轮独立复核对宿主 `setInterval`/timer 出现集的逐点排查中不存在插件注册点（**非穷尽证明**，宿主`639ed01539`；round-3 G-R3-10 之前此处写成无条件断言）；jobs 需先存在 job；goal round 驱动不可注册；插件自建
   `setInterval/setTimeout` 属本阶段红线（S0 自身 P-4：不建第二套调度器）。

## 3. 由 N-1 产生的边界修订（只此一条，scope 严格）

- 登记具名 **`CORE_SEAM_BLOCKER`**：拟名 **Host TimedWakePort**——宿主属主的"在 instant T 唤醒一个已存在
  Session"一次性原语，要求插件可归属、类型化投递回执、可取消、重启可恢复；at-least-once 可接受（去重与恢复归
  既有 Wake Kernel）。固定格式全文 + 最小复现 + 受影响不变量：`rulings-20261031-timed-wake-and-pr-i1.md` §1.1，
  台账条目 `dev/agent-workflow/blockers/alpha6-pr-i2-timed-wake-carrier-20261031.md`。
- **Scope 由用户裁决严格限定为 PR-I2 的 floor-delayed timed wake carrier**：不阻塞 Alpha.6 其余部分，不阻塞
  PR-I2 的事件驱动即时唤醒子集，不阻塞 PR-I1a / PR-I1b / PR5′。
- PR #509 的 defer 面继续 **DORMANT**；缺时间触发源时 floor-delayed 请求必须**显式拒绝**，不得返回
  `accepted: true`，不得静默丢弃未来唤醒保证。
- ScheduleService 仅可作为**未来独立 PoC 的候选适配器**存在；本轮不赋予生产载体地位。

## 4. 明确不受影响、因此不改写的历史结论（列出以免被误读为推翻）

- S0-A（受限委托能否进唯一权威路径）判定不变；PR-I1b 的具名 Center-Interface 路径不变。
- S0-B「无需 host patch」对**除 N-1 以外的全部 Alpha.6 路径**仍然成立；N-1 不是对它的否定，而是它未覆盖的一格。
- S0-C 所有权矩阵、S0-D CI 与同机资源隔离结论不变；真实 Host（C2）腿仍 ENV_BLOCK，不因本补遗而"变得可做"。
- S0 §3 关于调度器持久状态与 emit-mode 订阅的两条约束**继续有效**（PR-I1a 的写入者正是复用 TeamDomain
  Ledger/写入序列/Team 锁，不新增第二套账本）。
