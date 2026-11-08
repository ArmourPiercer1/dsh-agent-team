# Alpha.5 Preview 就绪报告 — 2026-11-15（PD-33 / `PD33-PREVIEW-E2E`）

> **本报告不是 Alpha.5 候选验收。** 证据类 `DEV-LIVE`（`eligible=false`），不构成 `V@B`、不改矩阵等级、
> 不改 Q7/Authority/Required CI。`CORE PATCH BUDGET = 0`。
>
> **时钟锚点**：本环境真实 UTC 为 **2026-11-08**；任务/文档日期为 2026-11-15。证据里的 `at`/`observedAt`
> 是真实时钟，文件名与标题使用任务日期；两者不一致是已知事实，不修正、不重写证据。
>
> **测量树**：`task/pd33-preview-e2e-20261115`，HEAD 见 §1。主机 pin `639ed015397290b3745d163aafe02ffee4aa3f84`
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

### 1.2 测量树

```
origin/master  3101ca08f   （#679 + #680 + #681，PD-32 仪器已合并）
      │
      └─ 53db856e1  task/pd33-preview-e2e-20261115（本 lane：driver / evidence / 本报告；
                    相对 master 0 个产品文件）
```

**测量树就是 master。** 上一版报告测的是 `master + 未合并的 #681`，那是最弱的一条；#681 合并后本 lane
**整个放弃了叠加的 base**（`git rebase --onto 3101ca08f 9f2a16d87`），在 master 上重跑了两 boot，
本报告引用的每个数字都来自这次重跑。`git diff --name-only origin/master...HEAD -- packages
cordis.patch.yml scripts package.json` 为**空**，所以"master 的行为"与"本 HEAD 的行为"在这份证据里是同一件事。

**为什么这件事值得写下来**：`#681` 不是"可选的测试改进"，而是**能否构造 governed Member 的前置条件**。
没有它，World 的 `profiles/web/node_modules/` 为空，shipped 行无法 import，一个 row 起不来会**整只
governed Member** 起不来，下游症状是"0 个 Member / 没有 goal"——**一个起不来的 preset 会读成行为失败**。
诚实的顺序只能是：**仪器先修好并合入，验收才能开始**。本报告现在是按这个顺序做完的。

### 1.3 产品文件（由 diff 导出，不手写）

- **本 lane 相对 `origin/master`**：产品文件 **0 个**
  （`git diff --name-status origin/master...HEAD -- packages cordis.patch.yml scripts package.json` → 空）；
  本 lane 只新增 `tests/**`、`docs/**`、`dev/agent-workflow/evidence/**`。
- **本阶段累计（`1484fa4ee` → 本 HEAD）**：**146 个产品文件**，命令
  `git diff --name-only 1484fa4ee...HEAD -- packages cordis.patch.yml scripts package.json`：
  `cordis.patch.yml` 1、根 `package.json` 1、`packages/runtime/dist/**` 76、`packages/runtime/src/**` 15、
  `packages/runtime/{lifecycle,team-sandbox,team-services,sandbox-provider,test}` 27、`packages/testkit/test` 12、
  `packages/tools/src` 1、`scripts/**` 12。
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

### 4.2 实测（20 000 ms 静默窗口，读 Member 自己的 durable 日志）

| 臂 | 动作 | 结果 |
| --- | --- | --- |
| S1 轮内 Stop | 目标 Member 自己的 `session/cancel` | Stop 前 **2** 轮 / **3** 调用 → 窗口内 **0 轮 / 0 调用 / 0 模型请求**，durable `paused`，`turn/end aborted` |
| S4 Leader 归档 | `team_archive_member` 指向正在跑轮次的 Member（归档前 **58** 轮 / **59** 调用） | `status=executed`，`SETTLED→ARCHIVED`，**0 轮 / 0 调用 / 0 请求**，durable `paused` |
| S2 边界竞态 | 24 次 cancel burst 覆盖 queued/claimed 窗口 | burst 后 **0** 轮，`lost=false` |
| S2(b) 受支持通道 | `goals/pause`（先发 `goals/resume`；goal 已被 burst 暂停故 `resumedOk=false`，披露） | `pausedSeen=true`，窗口内 **0 轮 / 0 请求**（`roundsAtPause=124`） |
| GAP 空闲窗口 | 瞄准 `turn/end` 的 6 次 stop | **6/6 landed，0 dropped** |
| S6 冷恢复 | SIGTERM（**189** 轮在跑）→ 同 `DSH_HOME` 重启（`health=true`，6 个 Member 全在）→ 真实 `team_follow_up` | 恢复时仍 **189** 轮，之后 **0** 轮，`revived=false`；被 Stop 的 Member 仍 `paused` |
| S7 显式恢复 | 恢复后 `/goal resume`（`activation=disarmed`） | `rpcStatus=200`，**1** 轮 |
| S8 未停止 | Member B 的 goal | **3** 轮 → `complete` → **0** 后续轮次 |

### 4.3 从 #679 继承的「仍然不成立」（逐条复核，不重写）

1. **仍不成立**：存在可信的**全局轮次预算**。`maxGoalRounds` 仍由调用方写（本场景 `100000`）；S6 的 189 轮就是证据。
2. **仍不成立**：Leader 停止会传播到 Member 的 goal——**本报告按设计陈述**（§4.1），但事实不变。
3. **仍不成立**：Team 之外的 idle 期 cancel 可被观测。上游契约里 idle 期 cancel 是**不发事件的 no-op**；
   本场景的 GAP 臂测的是驱动器发起的 stop，不是任意第三方。
4. **仍不成立**：goal bar 的 RPC 面与 `/team-remote` 是同一契约。
5. **仍不成立**：合并后的 preset 无需部署步骤即可启动——本场景靠 WorldFactory 的 install graph 才起；
   没有图时失败**不自我说明**（这正是 #681 的存在理由）。

---

## 5. Leader → Member → 工具 → 产物 → Leader：实测数字（两 boot 一致）

`--boots 2`，一个 composition，两 boot **逐项一致**（`agreeing=true`，各 18/18）。下列为 boot01 原始数字，
boot02 在 `runs/boot02/`。

### 5.1 Leader

- 第一回合**一次** `team_delegate` × **6** 个 Member（a、b、s1、s2、cold、stop2），**6/6 被接受**
  （Leader + 6 = 7 个实例，配额 8）；
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
| ~~M1~~ **已关闭** | ~~#681 未合并~~：silent 的 preset 行让整只 governed Member 起不来 | 合并后 `3101ca08f` 上重跑：6 个 Member 全部启动、两 boot 18/18（§7） | —（已由 #681 合并 + 本 lane rebase 重跑关闭） |
| **M2** | **Stop 没有一等公民入口**：机制对（API 实测 0/0/0 + `paused`），UI 上没有"停止这个 Member"的 affordance；`team_archive_member` 也不是为"停 goal"设计的 | S1/S4 都是驱动器直接调 API | 加一个 Member 行 Stop 入口，**并确认它调用的是同一 lifecycle 机制**（`session/cancel` → durable `pause` → `goals.disarm`），不是新的 no-op 端口 |

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

**它明确不是**（这四条写在这里，是为了让人不能从本报告推出我们没测过的保证）：

1. **不是"默认能上网搜"**：`web_search` 是部署条件性的，默认安装是 typed `WEB_PROVIDER_UNAVAILABLE`、0 请求（§3.2）。
2. **不是 per-host 网络策略**：网络轴是**单一布尔** allow/deny，deny 是准入层前置拒绝，不是 per-host ACL、不是 OS 隔离（§3.3）。
3. **不是 team-wide Stop**：Stop 的语义是"停目标 Member"；停 Leader 的当前回合**不会**停已委派的异步工作，这是设计（§4.1）。
4. **不是对恶意 Member 的安全边界**：它是"治理可归因"，不是"隔离不可逃逸"——`bash` 的越界写由 OS profile 兜（BL-17，§6.2）、
   网络只有单一布尔、shell 体不由服务轴归属。要"防住恶意 Member"是正式 Alpha.5 的题目，不是 Preview 的承诺。

### 7.2 判定

**`PREVIEW-NO-GO`**（#681 已合并、测量树已是 master；剩下的唯一阻断是 M2）。功能面是干净的：**两个 boot 各 18/18 PASS、`agreeing=true`**。
**M1 已关闭**：#681 合并（`3101ca08f`）后，本 lane 丢弃叠加 base、在 master 上重跑两 boot，18/18 一致。
剩下的唯一阻断是**产品事实**，不是"证据还不够"：

- **M2 —— Stop 没有一等公民入口**：机制是对的（两条通道都实测到 0/0/0、durable `paused`），
  但 UI 上没有"停止这个 Member"的按钮；Preview 要求"可操作"。

**最小放行集（只剩一条）**：给 Member 行加一个 Stop 入口，**并确认它调用的是同一 lifecycle 机制**
（`session/cancel` → durable `pause` → `goals.disarm`）；PD-34 落地后，本报告会 rebase 一次、加一条
"通过该控件停 Member"的臂，然后重新出判定。不需要改代码的部分：把 §6.2 的 8 条延后项写进
Preview 的"已知限制"，其中 **BL-17（shell 体不由服务轴归属）** 与 **`web_search` 部署条件性** 必须出现在发布说明里。

**已经成立、不需要重做的部分**（本报告实测，均可复现）：

- Leader 一次建 6 个 Member、二次 `team_collect`（A 从 `running` 到终态，B 直接返回 `memberResult.body`）；
- Member A：8 个受管 I/O 工具 **15** 条 fact、产物逐字落盘、3 次授权尝试（2 个 typed deny + 1 个 OS 兜底）；
- Member B：真实 fetch **1** 连接 / **26** 字节 / **1** allow fact；`web_search` 0 POST 的 typed gap；
  `read_image` 在 `text` 路由下 0 facts / 0 字节拒绝；goal **3** 轮 → `complete`；
- 延后面 **7/7** `unknown tool`、**0** facts；
- Stop：S1 2 轮/3 调用 → **0/0/0** `paused`；S4 **58** 轮/59 调用 → **0/0** `ARCHIVED`；S2 burst 24 次 `lost=false`；
  GAP 6/6 landed；S6 **189** 轮 → 之后 **0** 轮、`revived=false`；S7 显式 resume **1** 轮；
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
