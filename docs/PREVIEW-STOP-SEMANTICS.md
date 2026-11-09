# Preview 的 Stop 语义（PD-34 / MEMBER-STOP）

<!-- phase-identity: alpha5-sandbox-first -->

> 适用对象：Alpha.5 Preview 的 Team 视图使用者（人类操作者）与审阅者。
> 状态：**Preview 语义**，不是最终 release 契约；随 PD-34 证据一同提交
> （`dev/agent-workflow/evidence/a5sf-pd34-member-stop/`）。
> `CORE PATCH BUDGET = 0`：本语义完全建立在 shipped 的公开 RPC 上，没有 upstream 补丁。

## 1. 两个不同的问题，两个不同的入口

Team 视图里有两个 **Stop**，它们的语义**不同**，文案也不同：

| 入口 | 位置 | 停止什么 | 不停止什么 |
| --- | --- | --- | --- |
| **停止此成员** (`停止此成员` / *Stop this Member*) | 某个 Member 行下方 | **这个 Member 的目标**（耐久 `paused`）**和它当前的回合**（turn abort） | 其他 Member；Leader；团队本身。也**不是归档**（成员不被结束） |
| **停止 Leader 当前回合** (`停止 Leader 当前回合` / *Stop the Leader's current turn*) | Leader 行下方 | **只**停止 Leader 这一回合 | **已经委派出去的 Member 继续运行**（Preview 不做传播） |

两个入口都**不**是"停止整个团队"：Preview 不提供 team-wide Stop。要结束一个成员，
用它的 **归档 / Archive**（那会走 Team 生命周期并让成员 `ARCHIVED`）；Stop 只暂停目标，
之后仍可 `resume`。

## 2. "停止此成员"在线上做了什么

按下按钮后，前端（`packages/client/src/model/member-stop.ts`）按**固定顺序**发出四个
公开 RPC，全部走 goal bar 自己用的公开命名空间，**不做任何本地状态模拟**：

1. `POST /api/goals/get` `{ agentId: <Member child session> }` — 读当前目标与
   `{id, revision}`；
2. `POST /api/goals/pause` `{ agentId, ref }` — 带 revision 的**耐久 CAS**，把目标置为
   `paused`（这一步先做，关掉"下一轮已经开始"的竞态；Host 的 goal-round driver 会中止
   被 host 暂停的回合）；
3. `POST /api/session/cancel` `{ sessionId }` — 中止该 Member 当前的 turn（与 PD-30 测量
   的同一个停止机制）；
4. `POST /api/goals/get` `{ agentId }` — **再读一次**；这一次读是"是否已停止"的**唯一判据**，
   而不是第 2/3 步的 RPC 返回 200。

因此：**成功的判据是耐久状态，不是 RPC 返回码**。`pause` 被写入之后，结果按**最后一次重读**
分成三类，UI 分别显示不同文案（PD-35，见 §2.2）；读/暂停被拒绝时显示逐字错误
（code + message），不会把失败渲染成绿色。

## 2.1 时序保证：保证的是"pause 确认后不再续轮"，不是"点击后立即没有执行"

Stop **不是瞬时**的。从按下按钮到耐久 `pause` 落盘之间存在**毫秒级窗口**：在这个窗口里
被接纳的调用仍可能**在 pause 之后才完成**（它已经在执行，pause 只是撤掉后续续轮的授权，
不是回滚已经开始的执行）。E2E lane（#682）独立测到了同一件事。

所以本入口可以辩护的保证只有一条：

> **"`goals/pause` 被确认（ACK）之后，不再有新的续轮。"**

不是"点击之后没有任何执行"。闭包条件因此是 **pause 的 ACK + 第二次 `goals/get` 读到的
耐久 `paused`**，而不是按钮的点击时刻：只有第二次读确认 `paused` 时 UI 才显示"已停止"，
其余两种"pause 已写入但未确认"的结果有各自的文案（§2.2），都不宣称停止已完成。文案
也按这个口径写——"暂停该成员的目标并中止其当前回合"，不承诺"立刻"或"已经发生的调用会消失"。

## 2.2 pause 写入后的三种结果（PD-35）

`stopMember()` 只有在**最后一次重读确认 `paused`** 时才返回 `stopped`。其余两种"pause 已写入"
的情况不再被混进成功：

| 情况 | 结果种类 | UI 文案（中文口径） |
| --- | --- | --- |
| 重读确认 `paused` | `stopped` | `已停止：目标 phase=paused（rev {revision}），回合中止={cancel}` |
| 重读得到**非 `paused`**（例如 `active`） | `pause-contradicted` | `暂停已写入（rev {revision}），但最新读取仍是 {phase}：未确认停止，请重试或核对；回合中止={cancel}` |
| 重读**失败/无值**（拒绝、异常、无目标） | `pause-unverified` | `暂停已写入（rev {revision}），但未能确认最终状态（重读失败）；请重试或核对；回合中止={cancel}` |

第二条**不得**渲染成"已停止"：`暂停已写入` 只陈述第 2 步的耐久 CAS 已落盘，`最新读取仍是
active` 陈述最后一次重读观察到的矛盾，两者同时出现时由用户决定重试或核对。第三条把缺失的
观察当作**未知**（`observedPhase=undefined`），不把 `undefined` 归一成 `paused` 或 `active`。
`cancel` 拒绝/未附着仍只是结果里的一个**字段**（回合中止={cancel}），不是停止失败。

这三类由外部审查（P1）指出、经复核确认：旧实现采集了 `observedPhase` 却不参与分类，
且旧测试把"重读 `active` 仍算 `stopped`"固化成了断言；PD-35 把分类拆开并把那条测试改掉。

## 3. 停止之后

- 该 Member 的后续自动回合数为 **0**（PD-34 live：20 000 ms 静默窗内 0 rounds /
  0 tool calls / 0 model requests）。
- 目标保持耐久 `paused`，不会自行 `revived`（同一窗口后的再读仍是 `paused`）。
- 显式 `goals/resume` 可以恢复：恢复后只启动**恰好 1 个**回合（PD-34 live），随后目标
  按正常规则继续——这是"暂停"而不是"销毁"。
- 该 Member 的 Team 生命周期**不变**（Stop 不是 archive，不改变 `RUNNING/SETTLED` 等状态）；
  要结束成员请用 Archive。
- **停止能活过一次冷启动。** 在同一个 `DSH_HOME` 上 SIGTERM + 重启（团队域被 adopt），
  通过本入口停止且**未被 resume** 的 Member，重启后的耐久 phase 仍是 `paused`（同一 goal
  id、rev 不变），重启后 **0 个** goal 轮（PD-34 §3.2，两 boots 一致）。重启后该子会话在
  第一次回合前是 `SETTLED`、没有 live agent，所以此时 `goals/get` 返回"无目标"是正常的；
  判定用的是耐久投影 + 轮数，不是这一读。

## 4. 仍然存在的限制（必须知道）

1. **Leader 的 Stop 不传播。** 停止 Leader 当前回合，不会停止它已经委派出去的 Member；
   PD-30 的 S5 实测（root 回合中止后三个 Member 仍各 +14/+13/+13 轮）。Preview 的 Stop 是
   **按成员**的。
2. **空闲窗口是竞态。** 在两轮之间的空闲窗口按 Stop，依赖 Host 捕获这一瞬间；PD-30 的
   S3 臂在 6/6 次瞄准边界的尝试中都命中（窗口是微秒级），但这不是同步保证——不是
   "按了必然在下一轮启动前生效"。本入口的顺序（先 `pause` 再 `cancel`）正是为缩短该窗口。
3. **没有可信的全局回合预算。** Preview 接受这一点：Member 保留 upstream 可编辑的
   `maxGoalRounds`；Stop 是唯一的"硬停"，而不是预算。
4. **停止不是瞬时的（见 §2.1）。** 点击到耐久 `pause` 落盘之间有毫秒级窗口；窗口内已
   被接纳的调用可能在 pause 之后才完成。可辩护的保证是"pause 被确认后不再续轮"，不是
   "点击后没有执行"。
5. **UI 点击的 headless 验证只在组件层。** PD-34 的 live 证据驱动的是与按钮处理器**完全
   相同**的四个 RPC，但它**没有在真实浏览器里点击 DOM**（驱动无浏览器）；点击路径由
   `packages/client/test/team-member-stop.client.spec.tsx`（真实组件 + jsdom）覆盖。证据
   README 明确写出这一点，不把 RPC 序列冒充为点击。
6. **只对 live 行可见。** 没有 `childSessionId` 的行、`ARCHIVED`/`DISPOSED` 行不出现该按钮
   （前端不自行推导 session id，也不对没有 live 目标的成员伪造动作）。

## 5. 证据与代码锚点

- live 证据：`dev/agent-workflow/evidence/a5sf-pd34-member-stop/README.md`（真实 Host、
  真实 governed Member、≥3 rounds、20 000 ms 静默窗、`paused`、`revived=false`、
  resume 恰好 1 轮）。
- 纯模型：`packages/client/src/model/member-stop.ts`（PD-35 的三类结果分类）；逐调用测试
  `packages/client/test/member-stop-model.test.ts`。
- 视图入口：`packages/client/src/ui/TeamMembers.tsx`（`data-member-stop` /
  `data-leader-stop`）；组件测试 `packages/client/test/team-member-stop.client.spec.tsx`。
- 机制来源：PD-30（#679）的 `interrupt` + durable `goals.pause`；本文件不改变该机制。
