# Alpha.5 Preview 就绪报告 — 2026-11-15（PD-33 / `PD33-PREVIEW-E2E`）

> **本报告不是 Alpha.5 候选验收。** 证据类 `DEV-LIVE`（`eligible=false`），不构成 `V@B`、不改矩阵等级、
> 不改 Q7/Authority/Required CI、**不移动 `release` 门（仍 BLOCKED）**。`CORE PATCH BUDGET = 0`。
>
> **时钟锚点**：本环境真实 UTC 为 **2026-11-08**；任务/文档日期为 2026-11-15。证据里的 `at`/`observedAt`
> 是真实时钟，文件名与标题使用任务日期；两者不一致是已知事实，不修正、不重写证据。
>
> **测量树**：`origin/master` @ `a2e0df3c9` + 本判定 lane 的 `task/pd33-preview-verdict-flip-20261115`（相对 master 0 个产品文件），详见 §1.2。主机 pin `639ed015397290b3745d163aafe02ffee4aa3f84`
> （DSH 0.2.0-rc.2，唯一允许的测试运行时）；阶段基线 `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`；
> upstream 宿主树在本轮从未被写入（每次启动前后 `git status --porcelain` 均为空）。

---

## 1. 集成基线、PR 状态与「实际改变了哪些产品文件」

### 1.1 PR 状态（先确认，后动手）

| PR | 分支 | 状态 | 备注 |
| --- | --- | --- | --- |
| **#679** `PD29-GOAL-STOP` | `task/pd29-goal-stop-20261114` | **已合并** | `0c2a8f422`；Stop 的 durable CAS + 目标面恢复 |
| **#680** `PD31-READ-IMAGE` | `task/pd31-read-image-20261112` | **已合并** | `ece8d5a1c`；`read_image` 走模型路由声明，**因此本报告能实测路由门** |
| **#681** `PD32-INSTRUMENT-GRAPH` | `task/pd32-instrument-graph-20261112` | **已合并** | `3101ca08f`；本报告的全部数字是在它**合并之后**的 master 上重测的（§1.2） |
| **#682** `PD33-PREVIEW-E2E` | `task/pd33-preview-e2e-20261115` | **已合并** | `edca478bd`；本报告的**上一版**（判定 `PREVIEW-NO-GO`），保留原文不重写（§7.2） |
| **#683** `PD34-MEMBER-STOP` | `task/pd34-member-stop-20261115` | **已合并** | `a2e0df3c9`；Member 行的一等公民 Stop 控件，S1c 测的就是它发出的序列（§4.3/§4.5） |
| **#684** `CHORE` | — | **已合并** | `32889a2a8`；移除了 #681 误提交在仓库根的 `.g.log`。本判定基于**移除之后**的 master |

### 1.2 测量树

```
origin/master  a2e0df3c9   （#679 + #680 + #681 + #682 + #684 + #683）
      │
      └─ task/pd33-preview-verdict-flip-20261115（本 lane：driver / evidence / 本报告；
                    相对 master 0 个产品文件）
```

**测量树就是 master。** 上一版报告测的是 `master + 未合并的 #681`，那是最弱的一条；#681 合并后本 lane
**整个放弃了叠加的 base**（`git rebase --onto 3101ca08f 9f2a16d87`），在 master 上重跑了两 boot。
本判定的每个数字来自 **`a2e0df3c9`（含 #683）上的第三次两 boot 复跑**：这是一次 clean rebase，
没有叠加 base，也没有把任何未合并的分支算进测量树。`git diff --name-only origin/master...HEAD -- packages
cordis.patch.yml scripts package.json` 为**空**，所以"master 的行为"与"本 HEAD 的行为"在这份证据里是同一件事。

**为什么这件事值得写下来**：`#681` 不是"可选的测试改进"，而是**能否构造 governed Member 的前置条件**。
没有它，World 的 `profiles/web/node_modules/` 为空，shipped 行无法 import，一个 row 起不来会**整只
governed Member** 起不来，下游症状是"0 个 Member / 没有 goal"——**一个起不来的 preset 会读成行为失败**。
诚实的顺序只能是：**仪器先修好并合入，验收才能开始**。本报告现在是按这个顺序做完的。

### 1.3 产品文件（由 diff 导出，不手写）

- **本 lane 相对 `origin/master`**：产品文件 **0 个**
  （`git diff --name-status origin/master...HEAD -- packages cordis.patch.yml scripts package.json` → 空）；
  本 lane 只新增 `tests/**`、`docs/**`、`dev/agent-workflow/evidence/**`。
- **本阶段累计（`1484fa4ee` → `a2e0df3c9`）**：**158 个产品文件**，命令
  `git diff --name-only 1484fa4ee...a2e0df3c9 -- packages cordis.patch.yml scripts package.json`：
  `cordis.patch.yml` 1、根 `package.json` 1、`packages/runtime/dist/**` 76、`packages/runtime/src/**` 15、
  `packages/runtime` 其余 28、`packages/client/**` 11、`packages/testkit/**` 13、
  `packages/tools/src` 1、`scripts/**` 12。
- **#683 自身** 12 个，全部在客户端与测试：`packages/client/src/model/member-stop.ts`（控件本体）、
  `packages/client/src/plugin/team-mount-core.ts`（注入 `remote.goals` / `remote.session`）、
  `TeamMembers{.tsx,.module.css}` + `locales.ts`、`composition-shim/client-bundle.js`（它自带构建产物），
  以及 5 个 client 测试 + `packages/testkit/test/p4t6-bookings/a5sfpd34.json`。
- **#679 自身** 7 个：`cordis.patch.yml`、`packages/runtime/src/plugin/host.ts`、
  `packages/runtime/src/plugin/live/agent-bindings.mjs` + 4 个 `dist` 产物。
- **#680 / #681 都已合并进 master**：前者交付 live 测量 + 矩阵/寄存器行 + driver/test，后者交付 World 的
  install graph + 前置条件；两者相对 master 都是 **0 个产品文件**（#681 的唯一产品面影响由 WorldFactory 承担，
  不在 `packages/**` 里）。因此本 HEAD 与 master 的**行为**差异为零，证据对 master 直接成立。
- 完整逐文件清单：**附录 A**。

---

## 2. 工具表面完整名册（四类）

一个 governed Member 的实测表面 = **36 个工具名**（从 mock 请求的 `tools` 列表逐字读出；A、B 一致）：

| 类 | 名称 | 数量 | 授权系统 | live 证据 |
| --- | --- | --- | --- | --- |
| **① 受管 I/O** | `read` `write` `edit` `grep` `glob` `bash` `skill` `present` `web_fetch` `web_search` | 10 | fs / fs-search / shell-PTY / skill provider / present listener / web guard，每面一个 | **本报告全部实测** |
| ①（同族，不计入 I/O 上界） | `job_list` `job_output` `job_kill` `todo_write` `exit_plan_mode` | 5 | 无 I/O 面 | 在表面上、本场景未调用 |
| ①（同族） | `read_image` | 1 | 模型路由声明 + fs 面（#680） | **实测**：`text` 路由在 provider I/O 之前拒绝，0 facts / 0 bytes |
| **② Goal 面** | `create_goal` `get_goal` `update_goal` | 3 | goal service + 上游 goal-round driver | **实测**：create / 3 轮 / `complete` |
| **③ Team 原生控制面** | `team_list_members` `team_list_templates` `team_inspect_config` `team_create_member` `team_delegate` `team_follow_up` `team_collect` `team_send_message` `team_report_progress` `team_request_control` `team_resolve_control` `team_list_pending_control` `team_archive_member` `team_grant_permission` `team_revoke_permission` | 15 | **另一套授权**（envelope / request token / 生命周期），**不是** I/O 上界 | 用了 `team_delegate` / `team_collect` / `team_list_members` / `team_archive_member` |
| **④ 延后面** | `workflow` `subagent` `subagent_fork` `send_message` `interrupt_agent` `list_agents` `ask_user_question` | **0** | — | **实测关闭**：7/7 不在表面、7/7 typed `unknown tool`、7/7 **0 facts** |
| 仪器（非产品） | `u5_canary` `u6fs_probe` | 2 | WorldFactory harness | 见披露 1 |

**19（preset 产品工具）+ 15（team）+ 2（仪器）= 36。**

**披露 1**：`u5_canary` / `u6fs_probe` 由 WorldFactory 的 harness 行注册，出现在**每个** agent 的表面；
名册单列，不从 preset 的 17 行推导（仪器泄漏；产品行为不受影响，但名册必须单列）。
**披露 2**：**Goal 三件套明确不是 I/O 上界工具**——它们受 goal service 生命周期约束，不参与
`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction` 的交集证明。
**披露 3**：`read_image` 的受管面是**模型路由**：路由不声明 `image` 时，工具在 provider I/O 之前拒绝（§5.3）；
"读到图"只在声明了 `image` 的路由上发生——本报告只测了拒绝分支（脚本化 mock 的路由是 `text`）。

---

## 3. Web：allow / deny / search 的真实结果与残余限制

### 3.1 实测（本地 fixture，真实 socket）

| 腿 | 结果 | 数字 |
| --- | --- | --- |
| **allow**（`GET <fixture>/known`） | 放行、逐字返回 | **1** 条 TCP 连接、`/known` **1** 次、**26** 字节（`bytesServed=26`）、含 `A5SF_PD33_KNOWN_BODY_BYTES`、**1** 条 ALLOW fact |
| **deny**（`GET <另一个 origin>/known`） | transport 之前拒绝，typed `WEB_DESTINATION_FORBIDDEN` | 该 origin **0** 连接、**1** 条 deny fact、**0** 字节 |
| **search**（`web_search`） | **typed `WEB_PROVIDER_UNAVAILABLE`**（本安装图无 Exa provider） | **0** 个 `POST /search`（`searchServer.connections=0`）、**1** 条 deny fact、**没有编造答案** |

### 3.2 `web_search` 是**部署条件性**的，不是"能上网搜"

- **默认安装**：Exa provider 包不可解析 → 每次调用都是 typed `WEB_PROVIDER_UNAVAILABLE`，**0 个请求**离开进程。
  这是**正确的失败**，不是搜索能力。
- **配置了 Exa 兼容 endpoint + key**：真实 `POST /search` + 真实解析（PD-30/#678 的阳性臂测到真实 POST 与真实
  snippet；它自己的"恰好一次 POST"条款当时为 **REFUTED**，所以本报告只说"可接线、会真实 POST 并解析"，
  不说"重试/计数已证明"）。
- 因此 Preview 只能声称 **"安全调用搜索的路径已接线"**，不能声称"默认安装能搜网页"。

### 3.3 残余限制

1. **网络轴是单一布尔 allow/deny**：没有 per-host ACL、没有端口白名单、没有方法/大小分轴。
2. **deny 是准入层前置拒绝**，不是 OS 隔离：它阻止**这一次** transport 调用；进程仍可解析 DNS、仍可尝试连接。
3. **受管 web 工具的网络限制 ≠ `bash` 子进程的网络限制**：`bash` 的网络由 OS profile 决定，**不经过** web guard；
   把"web 面 deny"读成"这个 Member 不能联网"是错的（PD-12 家族的已披露边界）。
4. **`testEndpoints` 是 composition 值，不是策略**：它只把声明的 origin 解析到本地；策略只有一处（web guard）。
5. **继承的 base `web` 不是回退执行路径**：tripwire 本场景 **0 次**调用（负控见 §7）。

---

## 4. Goal：生命周期、连续轮次与 Stop 语义（S1–S8）

### 4.1 Preview 的 Stop 语义（正面陈述，不扩张）

**停止一个 Member = 停止这个 Member 的 goal continuation。** 两个入口都实测：

- **该 Member 自己的会话通道**：`POST /api/session/cancel` 落在目标 Member 的 session 上（S1）；
- **Leader 的 Team 生命周期通道**：`team_archive_member` 指向**正在跑轮次的那个** Member（S4）。

**停止 Leader 的当前回合不会停止已经委派出去的异步工作——这是 Preview 的设计，不是缺陷。**
（#679 的 S5 已测到这个事实；本报告不把它当 bug，也不建 Team-wide Stop：那会扩大本阶段明确延后的范围。）

**结果分类（PD-35 对齐，只描述"停止此成员"的显示口径）**：「已停止」只有在最后一次
`goals/get` 重读确认 `paused` 时才显示。pause 已写入、但重读仍是非 `paused`（例如 `active`）时，
UI 显示「暂停已写入（rev …），但最新读取仍是 …：未确认停止，请重试或核对」；pause 已写入、
但重读失败/无值时，显示「暂停已写入（rev …），但未能确认最终状态」。`cancel` 的拒绝/未附着
仍只是结果里的一个字段（回合中止=…），不等于停止失败。第二次重读是三类结果的唯一判据，
不是"pause 返回 200"。

### 4.2 实测（20 000 ms 静默窗口，读 Member 自己的 durable 日志）

| 臂 | 动作 | 结果 |
| --- | --- | --- |
| **S1c 控制面 Stop（PD-34）** | 一等公民控件发出的**同一序列** `goals/get → goals/pause → session/cancel → goals/get`（控件本身不可 headless 点击，见 §4.3） | 首读 `active`、pause 200、cancel 200、**重读 `paused`**；Stop 前 **6** 轮 / **7** 调用 → **0 轮 / 0 请求**，且**durable pause 落地之后新开始的调用 = 0**、行数增量为 0；lifecycle 仍 `SETTLED`（停的是 continuation，不是 Member） |
| S1 轮内 Stop | 目标 Member 自己的 `session/cancel` | Stop 前 **7** 轮 / **8** 调用 → 窗口内 **0 轮 / 0 调用 / 0 模型请求**，durable `paused`，`turn/end aborted` |
| S4 Leader 归档 | `team_archive_member` 指向正在跑轮次的 Member（归档前 **107** 轮 / **108** 调用） | `status=executed`，`SETTLED→ARCHIVED`，**0 轮 / 0 调用 / 0 请求**，durable `paused` |
| S2 边界竞态 | 24 次 cancel burst 覆盖 queued/claimed 窗口 | burst 后 **0** 轮，`lost=false` |
| S2(b) 受支持通道 | `goals/pause`（先发 `goals/resume`；goal 已被 burst 暂停故 `resumedOk=false`，披露） | `pausedSeen=true`，窗口内 **0 轮 / 0 请求**（`roundsAtPause=153`，本 pair 实测） |
| GAP 空闲窗口 | 瞄准 `turn/end` 的 6 次 stop | **6/6 landed，0 dropped** |
| S6 冷恢复 | SIGTERM（**236** 轮在跑）→ 同 `DSH_HOME` 重启（`health=true`，7 个 Member 全在）→ 真实 `team_follow_up` | 恢复时仍 **236** 轮，之后 **0** 轮，`revived=false`；被 Stop 的 Member 仍 `paused` |
| S7 显式恢复 | 恢复后 `/goal resume`（`activation=disarmed`） | `rpcStatus=200`，**1** 轮 |
| S8 未停止 | Member B 的 goal | **3** 轮 → `complete` → **0** 后续轮次 |

### 4.3 一等公民控件（PD-34）与"headless 不可点击"的诚实说明

PD-34 的控件是**客户端模型** `packages/client/src/model/member-stop.ts` 里的 `stopMember()`：
`goals.get → goals.pause（durable CAS） → session.cancel → goals.get`，**唯一 oracle 是最后那次重读**，
不做任何乐观本地改写。它由 UI 按钮触发，本 lane 没有 DOM harness，**点不到**。

所以 S1c 的做法是：**发同一序列的四条公开 RPC**（同一 order、同一参数形状），在**正在跑轮次**的 Member 上测同一个
20 000 ms 窗口；**顺序一致性**由 judge 的 `control-sequence-issued` 子句钉住（与我写进臂里的常量比对），
点击 → 模型这一段由 PD-34 自己的 client 规格覆盖。**本报告不声称"我点了那个按钮"**，只声称
"控件所发序列，在我这里实测到 0/0/0 + durable `paused`，且不摧毁 Member"。

**#683 已合并进 master `a2e0df3c9`**：所以本节测的序列，与 master 上实际发布的那个控件发出的序列是同一条，
不是「预先按设计文档写一遍」。这也是判定从 NO-GO 翻到 GO 的唯一原因（§7.2）。

### 4.4 停止不是瞬时的（以及一条被自己的判据判红的子句）

**结论先行**：Stop 的保证是 **"durable `pause` 被确认之后不再有 continuation"**，不是"点下按钮之后不再有执行"。
这两句的差别不是措辞，是产品语义：用户动作与 durable `pause` 落地之间存在**毫秒级窗口**，
窗口内**可以**准入一个调用；而一个在 pause 之前被准入的调用，可以在 pause 之后**完成**并写下它的行。

第一次在 PD-34 的树上跑 S1c 时，判据以 `calls-after-zero: 1` 判红。我们没有把它当噪声改掉，而是查了来源：

- 原始计数器是**行数增量**：pause 之前准入、pause 之后补行的调用会让它 +1；
- 从动作到 pause 落地之间**新开始**的调用，一个尚未落地的 stop 本来就管不着。

于是子句被重述成它真正该断言的事：**`no-call-started-after-durable-pause`**——以 pause 被确认的那一刻为界；
三个数全部印在子句 detail 里，一个都不藏：**从动作起算 / 从 pause 起算 / 原始行数增量**。
重测：`0 started / 0 rows / 0 rounds / 0 requests`。

保留"第一条子句是错的"这件事，因为 **"一个不能证伪的控制是发现，不是尴尬"同样适用于我们自己的断言**——
这是本阶段第二次学到同一课。

同一边界也决定结果分类：pause ACK 之后的最后一次重读既是「是否已停止」的唯一判据，也是
`no-call-started-after-durable-pause` 的起点。pause 与非 `paused` 重读同时存在时，本报告
不允许把前者读成停止（§4.1 的 PD-35 对齐段）。

### 4.5 继承的断言会带着源驱动的先决条件（PD-34 的 `cold-recovery-no-revival`）

PD-34 的 `cold-recovery-no-revival` 子句断言某个 Member「仍然处于停止状态」——但那个 Member 是**它自己那条臂
先显式 resume 过**的，于是子句读到 `active` 并判红。评审在**自己的 boot** 上连着看到两次；
而 PD-34 自己的运行看起来是绿的，因为**那些运行从来没有执行 S6 这条臂**。

这是本报告要单独记下来的**一般性危险**：

- **断言可以活得比它被写出来的场景更久**：一句话在被复制进另一个 driver 之后，仍然按旧场景的先决条件成立；
- **继承的子句带着源驱动的先决条件**，而先决条件通常没有被一起继承。

它产出的两条规则，本报告自己也遵守：

1. **先决条件写在子句旁边**，而不是只写在源 driver 的注释里（本报告每个 case 的 clauses 都写明它假设的起点）；
2. **`null` 永远不被读成 `active`**：缺失的观测是一个**未知**，不是一个阶段；把 `undefined`/`null` 归一成 `active`
   会把"没测到"伪装成"测到了"。

### 4.6 从 #679 继承的「仍然不成立」（逐条复核，不重写）

1. **仍不成立**：存在可信的**全局轮次预算**。`maxGoalRounds` 仍由调用方写（本场景 `100000`）；S6 的 236 轮就是证据。
2. **仍不成立**：Leader 停止会传播到 Member 的 goal——**本报告按设计陈述**（§4.1），但事实不变。
3. **仍不成立**：Team 之外的 idle 期 cancel 可被观测。上游契约里 idle 期 cancel 是**不发事件的 no-op**；
   本场景的 GAP 臂测的是驱动器发起的 stop，不是任意第三方。
4. **仍不成立**：goal bar 的 RPC 面与 `/team-remote` 是同一契约。
5. **仍不成立**：合并后的 preset 无需部署步骤即可启动——本场景靠 WorldFactory 的 install graph 才起；
   没有图时失败**不自我说明**（这正是 #681 的存在理由）。

---

## 5. Leader → Member → 工具 → 产物 → Leader：实测数字（两 boot 一致）

`--boots 2`，一个 composition，两 boot **逐项一致**（`agreeing=true`，各 19/19）。下列为 boot01 原始数字，
boot02 在 `runs/boot02/`。

### 5.1 Leader

- 第一回合**一次** `team_delegate` × **7** 个 Member（a、b、s1、s2、cold、stop2、stop3），**7/7 被接受**
  （Leader + 7 = 8 个实例，仍在配额内；`stop3` 只服务 S1c，不参与 E2E 的 A/B 链）；
- 第二回合 `team_collect`（按 **2** 个 request token）+ `team_list_members`：`status=executed`；
  B 的条目直接返回 `memberResult.body = "A5SF_PD33_B_DONE created"`；
  A 首次读回是 `status=running`（**读回可以先于结算**），第二次 collect 读到终态——两次都 200；
- Leader 没有 I/O 授权动作，也拿不到 Member 的 guard fact。

### 5.2 Member A（受管 I/O 全链）

| 工具 | 结果 | facts |
| --- | --- | --- |
| `read`（lane 内） | 返回正文 | 2 ALLOW（stat + readText） |
| `grep` / `glob` | 命中 1 行 / 1 文件 | 1 + 1 ALLOW |
| `write` / `edit` | 落盘并把 `…_BEFORE` 改成 `…_AFTER` | 1 + 1 ALLOW |
| `bash`（`printf A5SF_PD33_A_BASH_OK`） | exit 0、stdout 逐字 | 2 ALLOW（spawn + spawn:write） |
| `skill`（lane 内 `pd33-inlane`） | `<skill_content>` 含 fixture body | 1 ALLOW |
| `present` | `Presented …/probe-written.txt` | 2 ALLOW（lstat + stat） |

- **产物**：`probe-written.txt` = `"probe line\nA5SF_PD33_A_EDIT_AFTER"`（编辑后的内容，on-disk 校验）；
- **A 的 guard fact 合计 15 条**（in-lane 11 + 授权尝试 4）；
- 授权尝试：lane 外 `read` → **`IO_READ_DENIED`**（1 deny fact，0 字节）；lane 外 `web_fetch` →
  **`WEB_DESTINATION_FORBIDDEN`**（1 deny fact，0 连接）；lane 外 `bash` 写 `../…` → **guard 放行（2 条 ALLOW）、
  OS 拒绝**（`Permission denied`，exit 1，文件不存在，0 字节）——见 §6.2 的 BL-17 披露；
- **延后面**：7 个名字全部不在表面，逐个 `Error: unknown tool "<name>"`，每个 **0 facts**。

### 5.3 Member B（Web + Goal + 路由门）

- `web_fetch`：**1** 连接、**26** 字节、逐字命中；**1** 条 ALLOW fact；
- `web_search`：**0** POST、typed `WEB_PROVIDER_UNAVAILABLE`、**1** 条 deny fact；
- `skill`（lane 外 body）：**`IO_READ_DENIED`**、**1** 条 deny fact、**0 字节**；
- `read_image`：路由未声明 `image` → **在 provider I/O 之前拒绝**，**0 facts / 0 bytes**，
  文本 = `model "deepseek-v4-flash" does not declare image input; switch to an image-capable model to read images`；
- goal：**3** 轮连续自动轮次 → `complete` → **0** 后续轮次；
- **B 的 guard fact 合计 9 条**（fetch 1 + search 1 + skill 1 + 3 轮 × 2 bash facts）。

### 5.4 计数与"没有回退到 base"

- base 宿主 `web`（tripwire）：**0**；base `fs`：**0**（A 的 8 个 I/O 工具全部有 guard fact，deny 在 provider 之前）；
- dev-live 槽每 boot 1 个，端口 3180 族（本 pair 3190/13053），`:3080` 从未被触碰；
- 以上都只到"这次测量"。

---

## 6. 剩余阻塞：Preview 必修 vs 正式 Alpha.5 延后

### 6.1 Preview 必修

| # | 阻塞 | 依据 | 最小修点 |
| --- | --- | --- | --- |
| ~~M1~~ **已关闭** | ~~#681 未合并~~：silent 的 preset 行让整只 governed Member 起不来 | 合并后 `3101ca08f` 上重跑：7 个 Member 全部启动、两 boot 19/19（§7） | —（已由 #681 合并 + 本 lane rebase 重跑关闭） |
| ~~M2~~ **已关闭** | ~~Stop 没有一等公民入口~~：PD-34 已合并（`#683`），Member 行控件按 `goals/get → goals.pause → session.cancel → goals/get` 发出停止，durable 重读是唯一 oracle | 合并后复跑 `--boots 2`：19/19 两 boot 一致，`pd34:control-stops-member` PROVEN（§4.2）。**关闭时点名了一条判错的子句**：PD-34 的 `cold-recovery-no-revival` 断言"仍然停止"的那个 Member 是它自己的臂先 resume 过的（§4.5），两次判红，且在没执行 S6 的运行里看起来是绿的 | —（由 PD-34 合并 + 本 lane 复测关闭） |

### 6.2 正式 Alpha.5 延后（Preview 接受，不假装已做）

1. **PTC 设计**（`workflow`/`subagent` 等延后面）——Preview 明确关闭。
2. **Team-wide Stop / Leader 停止向 Member 传播**——本阶段**明确不做**（§4.1 的正面语义）。
3. **shell 体的路径归属（BL-17 / PD-13 家族）**：`bash` 只按声明的根（= cwd）授权 spawn，**不解析命令体**，
   越界写由 OS profile 兜住。本报告把它**测成披露的边界**（2 条 ALLOW + OS `Permission denied` + 0 字节），
   **不声称服务轴拒绝**。最小修点（未做）：在 `spawn:write` 判定里规范化命令体目标路径并在 spawn 前拒绝。
4. **三步网络隔离**（布尔 → per-host ACL → OS 隔离）——只到第一步。
5. **全局轮次预算**——Preview 接受缺失。
6. **`web_search` 默认无 backend**——见 §3.2，部署条件性。
7. **`team_*` 15 个工具在 Member 表面上**——另一套授权系统，设计债。
8. **仪器泄漏**（`u5_canary`/`u6fs_probe`）——名册单列。

### 6.3 负控（说明"治理面不是摆设"）

两个变异都跑了，且都**没有**按最初设想的方式变红——所以按实测写，不按设想写：

- `A5SF_PD33_MUTATE=no-realm`（只去掉 `a5sfGovernedRealm` 键）：Host 根本起不来（`p6t6 health=false`、0 个 Member），
  于是"base `web` 计数上升"这件事**观测不到**。它证明的是 realm 键承重，不是 guard 在拦。
- `A5SF_PD33_MUTATE=no-web-row`（保留 realm、从 preset 去掉 `tool-web` 行）：行为不变（`fetchConn=1`、`hostWebCalls=0`），
  说明 governed web 面来自 realm 行而不是 preset 行。

**guard 级 allow-all 变异需要产品旋钮，本阶段没有 → 不声称做过。** 表格与日志见 §7。

---

## 7. 结论

### 7.1 这个 Preview 是干什么的（一句话），以及它明确不是什么

**一句话**：Alpha.5 Preview 是一个**内部的、opt-in 的 governed team runtime 预览**——每一次工具调用都可归因
（guard fact / typed deny），每一次停止都可测量（20 000 ms 静默窗口 + durable `paused`）。

**stop 的保证是「durable `pause` 被确认之后不再有 continuation」，不是「点下按钮之后不再有执行」**：
两者之间有一个毫秒级窗口，本报告把它测出来了（§4.4），也没有假装它不存在。

**它明确不是**（这四条写在这里，是为了让人不能从本报告推出我们没测过的保证）：

1. **不是"默认能上网搜"**：`web_search` 是部署条件性的，默认安装是 typed `WEB_PROVIDER_UNAVAILABLE`、0 请求（§3.2）。
2. **不是 per-host 网络策略**：网络轴是**单一布尔** allow/deny，deny 是准入层前置拒绝，不是 per-host ACL、不是 OS 隔离（§3.3）。
3. **不是 team-wide Stop**：Stop 的语义是"停目标 Member"；停 Leader 的当前回合**不会**停已委派的异步工作，这是设计（§4.1）。
4. **不是对恶意 Member 的安全边界**：它是"治理可归因"，不是"隔离不可逃逸"——`bash` 的越界写由 OS profile 兜（BL-17，§6.2）、
   网络只有单一布尔、shell 体不由服务轴归属。要"防住恶意 Member"是正式 Alpha.5 的题目，不是 Preview 的承诺。

### 7.2 判定

> **这个 GO 的范围**：它是**一个 opt-in preset 的 Preview 放行**。**`release` 仍然是 BLOCKED**；
> 没有 `V@B`、没有矩阵等级变更、没有 Q7/Authority/Required-CI 变更、`CORE PATCH BUDGET = 0`。
> 把 `PREVIEW-GO` 读成"发布门移动了"是本报告最可能被误读的地方，所以这句话写在这里，而不是脚注里。

> **2026-11-15 的判定（当时 #683 未合并）：`PREVIEW-NO-GO`** —— 唯一的阻断是 M2（一等公民 Stop 控件未落地）。
> 该判定原文保留在 PR #682 的合并提交 `edca478bd` 里，本文件不重写它：读者应当能同时看到两个判定，
> 以及第一个判定**为什么**改变（缺件消失，而不是证据变多）。

**`PREVIEW-GO`** —— 判定日期 **2026-11-15**，依据 **`a2e0df3c9` 上的 `--boots 2` pair**
（`RESULT PASS (2/2 boots; agreeing pair=true)`，boot1/boot2 各 **19/19**；S1c 见 §4.2），
测量树 = master `a2e0df3c9` + 本判定提交，相对 master **0 个产品文件**。

- **M1 已关闭**：`#681` 合并后，本 lane 丢弃叠加 base、在 master 上重跑两 boot。
- **M2 已关闭**：`#683` 合并，Member 行控件按 `goals/get → goals.pause → session.cancel → goals/get` 发出停止，
  `pd34:control-stops-member` 在本 pair 中 PROVEN（§4.2）。**关闭时点名了一条判错的子句**：
  PD-34 自己的 `cold-recovery-no-revival` 断言"仍然停止"的那个 Member 是它自己的臂先 resume 过的，
  两次判红，且在**没有执行 S6** 的运行里看起来是绿的（§4.5）。
- **两个 boot 19/19 且 `agreeing=true`**；S1c：6 轮/7 调用 → **0 轮 / 0 请求 / durable pause 之后新开始的调用 0**，
  重读 `paused`，lifecycle 仍 `SETTLED`。
- **没有别的东西移动**：产品文件 0 个；两个负控、`web_search` 的部署条件性、`read_image` 的路由条件性、
  §6.2 的 8 条延后项，全部与 NO-GO 那一版逐字一致。

**判定为什么变了**：唯一的阻断是**产品缺件**（控件未落地），不是证据不足；缺件落地并复测后，它就不存在了。
**放行之后仍然成立的限制**：§6.2 的 8 条延后项，加上 §7.1 的四条"不是"。

**已经成立、不需要重做的部分**（本报告实测，均可复现）：

- Leader 一次建 **7** 个 Member（a、b、s1、s2、cold、stop2、stop3，7/7 被接受）、二次 `team_collect`（A 从 `running` 到终态，B 直接返回 `memberResult.body`）；
- Member A：8 个受管 I/O 工具 **15** 条 fact、产物逐字落盘、3 次授权尝试（2 个 typed deny + 1 个 OS 兜底）；
- Member B：真实 fetch **1** 连接 / **26** 字节 / **1** allow fact；`web_search` 0 POST 的 typed gap；
  `read_image` 在 `text` 路由下 0 facts / 0 字节拒绝；goal **3** 轮 → `complete`；
- 延后面 **7/7** `unknown tool`、**0** facts；
- Stop：S1 7 轮/8 调用 → 0/0 `paused`；**S1c（PD-34 控件序列）6 轮/7 调用 → 0 轮 / 0 请求 / durable pause 之后新开始的调用 0**，重读 `paused`，lifecycle 仍 `SETTLED`；S4 **107** 轮/108 调用 → **0/0** `ARCHIVED`；S2 burst 24 次 `lost=false`；
  GAP 6/6 landed；S6 **236** 轮 → 之后 **0** 轮、`revived=false`；S7 显式 resume **1** 轮；
- 继承的 base `web` **0** 次；base `fs` **0** 次；`:3080` 从未被触碰。

**负控（两个，都是实测；不做"设计上会红"的推断）**：

| 变异 | 结果 | 读法 |
| --- | --- | --- |
| `A5SF_PD33_MUTATE=no-realm`（去掉 `a5sfGovernedRealm` 键） | Host 起不来：`p6t6 health=false`、**0 个 Member**、`RESULT FAIL` | 证明 **realm 键是承重的**；它太粗，**不能**用来看 base `web` 计数上升 |
| `A5SF_PD33_MUTATE=no-web-row`（保留 realm，只从 preset 去掉 `tool-web` 行） | 行为不变：仍 `fetchConn=1`、`hostWebCalls=0`、`pd33:no-base-web` 仍 PROVEN | 证明 **governed web 面来自 realm 行，不由 preset 行提供**；也没把 base `web` 变成回退路径 |

因此"base 宿主 `web` 不是回退执行路径"的依据是：正向跑的 tripwire **0 次** + 这两个变异各自的结论；
**guard 级的 allow-all 变异需要产品旋钮，本阶段没有，故不声称做过**。日志：
`dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/negative-control-no-realm.log` 与
`negative-control-no-web-row.log`。

**证据路径**：

- 驱动器：`tests/world-factory/drivers/a5sf-pd33-preview-e2e/`（`run-boot.mjs`、`pd33-base-web-tripwire.mjs`、`README.md`）
- host-free pin：`tests/world-factory/a5sf-pd33-preview-e2e.test.mjs`（8/8）
- 证据：`dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/`（`README.md`、`driver.log`、`run-ledger.jsonl`、
  `runs/boot01|boot02/{e2e.json,guard-facts.json,arms.json,verdicts.json,run-record.json,preset-effective.json,precondition.json}`）
- 逐条判定：`runs/boot01/verdicts.json`（每 case 的 `clauses[].detail` 就是本报告引用的数字）

---

## 附录 A — 本阶段累计产品文件清单（`1484fa4ee` → 本 HEAD，`git diff --name-only`）

> `git diff --name-only 1484fa4ee...HEAD -- packages cordis.patch.yml scripts package.json`（146 个；
> #679 贡献 7 个；#680 / #681 / 本 lane 贡献 **0** 个）

```
# cordis.patch.yml (1)
  cordis.patch.yml
# package.json (1)
  package.json
# packages/runtime/dist (76)
  packages/runtime/dist/packages/runtime/lifecycle/admission-state.d.ts
  packages/runtime/dist/packages/runtime/lifecycle/admission-state.d.ts.map
  packages/runtime/dist/packages/runtime/lifecycle/admission-state.js
  packages/runtime/dist/packages/runtime/lifecycle/admission-state.js.map
  packages/runtime/dist/packages/runtime/lifecycle/quiesce.d.ts
  packages/runtime/dist/packages/runtime/lifecycle/quiesce.d.ts.map
  packages/runtime/dist/packages/runtime/lifecycle/quiesce.js
  packages/runtime/dist/packages/runtime/lifecycle/quiesce.js.map
  packages/runtime/dist/packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py
  packages/runtime/dist/packages/runtime/sandbox-provider/network.d.ts
  packages/runtime/dist/packages/runtime/sandbox-provider/network.d.ts.map
  packages/runtime/dist/packages/runtime/sandbox-provider/network.js
  packages/runtime/dist/packages/runtime/sandbox-provider/network.js.map
  packages/runtime/dist/packages/runtime/sandbox-provider/probe-abi.d.ts
  packages/runtime/dist/packages/runtime/sandbox-provider/probe-abi.d.ts.map
  packages/runtime/dist/packages/runtime/sandbox-provider/probe-abi.js
  packages/runtime/dist/packages/runtime/sandbox-provider/probe-abi.js.map
  packages/runtime/dist/packages/runtime/sandbox-provider/provider.d.ts
  packages/runtime/dist/packages/runtime/sandbox-provider/provider.d.ts.map
  packages/runtime/dist/packages/runtime/sandbox-provider/provider.js
  packages/runtime/dist/packages/runtime/sandbox-provider/provider.js.map
  packages/runtime/dist/packages/runtime/src/plugin/host.d.ts.map
  packages/runtime/dist/packages/runtime/src/plugin/host.js
  packages/runtime/dist/packages/runtime/src/plugin/host.js.map
  packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-governed-realm.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-realm-row.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-skill-provider.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-web-transport.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/closed-tool-arguments.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/confined-bash-tool.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/confined-fs-tool.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/confined-search-tool.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/confined-terminal-tool.mjs
  packages/runtime/dist/packages/runtime/src/plugin/live/confined-web-tool.mjs
  packages/runtime/dist/packages/runtime/src/plugin/types.d.ts
  packages/runtime/dist/packages/runtime/src/plugin/types.d.ts.map
  packages/runtime/dist/packages/runtime/src/plugin/types.js.map
  packages/runtime/dist/packages/runtime/team-services/src/fs.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/fs.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/fs.js
  packages/runtime/dist/packages/runtime/team-services/src/fs.js.map
  packages/runtime/dist/packages/runtime/team-services/src/guard-observability.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/guard-observability.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/guard-observability.js
  packages/runtime/dist/packages/runtime/team-services/src/guard-observability.js.map
  packages/runtime/dist/packages/runtime/team-services/src/install.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/install.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/install.js
  packages/runtime/dist/packages/runtime/team-services/src/install.js.map
  packages/runtime/dist/packages/runtime/team-services/src/mount.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/mount.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/mount.js
  packages/runtime/dist/packages/runtime/team-services/src/mount.js.map
  packages/runtime/dist/packages/runtime/team-services/src/product-assembly.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/product-assembly.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/product-assembly.js
  packages/runtime/dist/packages/runtime/team-services/src/product-assembly.js.map
  packages/runtime/dist/packages/runtime/team-services/src/subprocess.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/subprocess.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/subprocess.js
  packages/runtime/dist/packages/runtime/team-services/src/subprocess.js.map
  packages/runtime/dist/packages/runtime/team-services/src/terminal.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/terminal.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/terminal.js
  packages/runtime/dist/packages/runtime/team-services/src/terminal.js.map
  packages/runtime/dist/packages/runtime/team-services/src/types.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/types.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/types.js
  packages/runtime/dist/packages/runtime/team-services/src/types.js.map
  packages/runtime/dist/packages/runtime/team-services/src/web.d.ts
  packages/runtime/dist/packages/runtime/team-services/src/web.d.ts.map
  packages/runtime/dist/packages/runtime/team-services/src/web.js
  packages/runtime/dist/packages/runtime/team-services/src/web.js.map
  packages/runtime/dist/packages/tools/src/tools.js
  packages/runtime/dist/packages/tools/src/tools.js.map
# packages/runtime/lifecycle (2)
  packages/runtime/lifecycle/admission-state.ts
  packages/runtime/lifecycle/quiesce.ts
# packages/runtime/package.json (1)
  packages/runtime/package.json
# packages/runtime/sandbox-provider (4)
  packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py
  packages/runtime/sandbox-provider/network.ts
  packages/runtime/sandbox-provider/probe-abi.ts
  packages/runtime/sandbox-provider/provider.ts
# packages/runtime/src (15)
  packages/runtime/src/plugin/host.ts
  packages/runtime/src/plugin/live/a5sf-governed-realm.d.mts
  packages/runtime/src/plugin/live/a5sf-governed-realm.mjs
  packages/runtime/src/plugin/live/a5sf-realm-row.mjs
  packages/runtime/src/plugin/live/a5sf-skill-provider.mjs
  packages/runtime/src/plugin/live/a5sf-web-transport.mjs
  packages/runtime/src/plugin/live/agent-bindings.mjs
  packages/runtime/src/plugin/live/closed-tool-arguments.mjs
  packages/runtime/src/plugin/live/confined-bash-tool.mjs
  packages/runtime/src/plugin/live/confined-fs-tool.mjs
  packages/runtime/src/plugin/live/confined-search-tool.mjs
  packages/runtime/src/plugin/live/confined-terminal-tool.mjs
  packages/runtime/src/plugin/live/confined-web-tool.mjs
  packages/runtime/src/plugin/node-min.d.ts
  packages/runtime/src/plugin/types.ts
# packages/runtime/team-sandbox (2)
  packages/runtime/team-sandbox/src/index.ts
  packages/runtime/team-sandbox/src/terminal.ts
# packages/runtime/team-services (10)
  packages/runtime/team-services/src/fs.ts
  packages/runtime/team-services/src/guard-observability.ts
  packages/runtime/team-services/src/index.ts
  packages/runtime/team-services/src/install.ts
  packages/runtime/team-services/src/mount.ts
  packages/runtime/team-services/src/product-assembly.ts
  packages/runtime/team-services/src/subprocess.ts
  packages/runtime/team-services/src/terminal.ts
  packages/runtime/team-services/src/types.ts
  packages/runtime/team-services/src/web.ts
# packages/runtime/test (9)
  packages/runtime/test/a5p4-lane-hygiene.test.ts
  packages/runtime/test/a5sf-bl16-grep-realm.test.ts
  packages/runtime/test/a5sf-confined-subprocess.test.ts
  packages/runtime/test/a5sf-pd17-fs-policy.test.ts
  packages/runtime/test/a5sf-pd20-admission-close.test.ts
  packages/runtime/test/a5sf-pd20-closed-arguments.test.ts
  packages/runtime/test/a5sf-subprocess-contract.test.ts
  packages/runtime/test/a5sf-terminal-lifecycle.test.ts
  packages/runtime/test/a5w-integration-wiring.test.ts
# packages/testkit/test (12)
  packages/testkit/test/p4t6-bookings/a5sfgovpreset.json
  packages/testkit/test/p4t6-bookings/a5sfpd12.json
  packages/testkit/test/p4t6-bookings/a5sfpd13.json
  packages/testkit/test/p4t6-bookings/a5sfpd16.json
  packages/testkit/test/p4t6-bookings/a5sfpd17.json
  packages/testkit/test/p4t6-bookings/a5sfpd17b.json
  packages/testkit/test/p4t6-bookings/a5sfweb.json
  packages/testkit/test/p4t6-bookings/pd20-lifecycle.json
  packages/testkit/test/p4t6-bookings/pd27-confined-web.json
  packages/testkit/test/p4t6-bookings/pd29-service-seam.json
  packages/testkit/test/p4t6-bookings/pd30.json
  packages/testkit/test/plugin-dsh-compat.test.ts
# packages/tools/src (1)
  packages/tools/src/tools.ts
# scripts (12)
  scripts/a5sf-governed-preset-surface.mjs
  scripts/a5sf-preflight.mjs
  scripts/dist-placements/130-a5sf-pd12-confined-bash.json
  scripts/dist-placements/140-a5sf-pd13-confined-terminal.json
  scripts/dist-placements/150-a5sf-governed-preset.json
  scripts/dist-placements/160-a5sf-pd16-confined-search.json
  scripts/dist-placements/170-a5sf-pd17-confined-fs.json
  scripts/dist-placements/180-a5sf-pd20-closed-arguments.json
  scripts/dist-placements/190-a5sf-pd29-service-seam.json
  scripts/dist-placements/200-a5sf-pd27-confined-web.json
  scripts/dist-placements/210-a5sf-pd30-web-transport.json
  scripts/integration-order.mjs
```
