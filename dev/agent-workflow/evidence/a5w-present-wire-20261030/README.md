# a5w-present-wire — present 产品接线到公开应答面：停笔报告（BLOCKED，含设计）

- Lane: `a5w-present-wire`（工作流 A 产品接线写者；本波唯一 remote/client 安全面写者——**本 lane 实际零 remote/client 写入**，见 §3）
- 分支 `task/a5w-present-wire-20261030` @ 基线 `f1db2a6db`（= origin/master tip，起手实测）；worktree `.worktrees/a5w-present-wire`
- 日期（real UTC，`date -u` 实测）：本 lane 落笔 ≈ **2026-10-30T20:0xZ**（CLOCK-ANCHOR §3 映射：lane 标签日=真实日）
- 对象 = 本仓 master + 只读 `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（porcelain 全程空，复核见 §5）
- 裁决位声明：本 lane **不裁** O2-B §Open 1-4 四问（N2 提案收件方与形状 / G5 呈现 / **N3** 仿写可容性 /
  read_image rung 分离）；协调者简报曾将其概括为「牵头/O3 仿写/正本落位/G5 呈现」，其中「正本落位」实为
  O2-B §Open 6（PROPOSAL-PLACEMENT），记号应为 N3 非 O3。边界本身（不由本 lane 裁）不变。

## 0. 一句话结论

**简报的 wire map（`packages/remote/src/http/events.ts`、`team-remote-server.mjs` 的
`publicPresentFilesProvider`/present-files handler、`packages/tools/src/team-tool-plane.mjs :2829-2875`、
`team-tool-surface.ts :121-148`、`client-plugin/src/user-questions.ts`、LEG-0 目录名
`u7-uileg0-20261030`、UI_DESIGN §16.6）在本仓任何 ref、任何 worktree、只读宿主 pin、
以及本机一切可见目录中都不存在**（逐条证伪 = `WIRE-MAP-VERIFICATION.md`）。
真实拓扑下，「present 产物出现在 session 的公开 GUI 事件流（/api/$events waterfall）」这一
验收目标**没有本 lane 可自行动工的正直实现路径**：唯一的非 upstream 路径（O2-B N3 仿写）被
协调者令保留为 owner 裁决位且其落点触及 ARC-A 保护文件（具名 Center Interface PR + 独立安全
审查门），推荐方向（O2-B N2）是跨仓 Host 公开接口流程。**按任务令停笔条款停笔，交付设计+
阻塞分析**（`PRESENT-WIRE-DESIGN.md` 含最终 wire 形、负控套件、三条路线各自的改动面与解锁条件），
**不新立 CORE_SEAM_BLOCKER**（O2-B (d)N5 的未达判据对本 pin 仍然成立，本 lane 无权也更其前提）。

## 1. 真实拓扑（每锚本会话 spot-verify，非转抄）

| 事实 | 锚 |
| --- | --- |
| GUI 公开事件流（mux `$events`）的下行帧词汇 = 宿主源内**一张闭集 allowlist**，waterfall 模式仅 `approval/request` + `user-questions/request`（简报所称 permission_request/user_question 帧族即此二者的误名）；该文件自称「the one home … both compiler faces」，无外部注册 seam | `tests/deepseek-harness-test-use/packages/api/remotes/src/remote-events.ts:20-48`（waterfall 行 `:22`、`:47`） |
| 宿主原生 present 的 publication = **tool 行亲笔**：open-turn/maxFiles 律在 execute（`:78-80`），session 捕获 = `pending.set(exec,{session:exec.agent.session,…})`（`:96`），durable 发布 = `tools/result` 钩子上 `session.append('deliverables/presented',{turn,callId,files})`（`:105-108`）；事件类型 core 注册 | `tests/deepseek-harness-test-use/packages/deliverables/tool-present/src/index.ts:26,78-80,96,105-108`；`packages/core/session/src/known-event-types.ts:36` |
| GUI 消费面 = 宿主 client deliverables 插件注册的 `/api/present.open|host`（桌面 open/reveal 动作 + 读 durable 行），**非可委托服务** | `packages/client/ui-deliverables/src/presented.ts:7`（open）/`:10`（host） |
| ctx 目录（`cap.hostService(name)` 的可达全集）**无任何 publish/deliverable 键**（91 键，#489 的 128 计数已被 O2-B (a) dated 更正） | `tests/deepseek-harness-test-use/packages/extensions/tool-cordis/src/api-catalog.ts`（SERVICE_API 数组闭于 `:3756`，实测；键范围 `:83-` 承自 O2-B (c)1 复核）；我方 seam `packages/runtime/src/plugin/live/team-tool-plane.mjs:1601-1608`（本会话复核） |
| 我方治理 present 行的 port 解析：injected `backends.uiInteraction` 优先，否则宿主 `userQuestions` 服务过 `createUserQuestionsPort`（**ask+askTimed 两脸，故意无 present 脸**）⇒ 生产 mount 上 present 行恒 `UI_PRESENT_PORT_ABSENT` typed 零效果 | `packages/tools/families/ui.mjs:84-88`；`packages/tools/ui-family/src/ui-interaction-port.mjs:33-40,49,83-94`；`packages/tools/ui-family/src/present-executor.mjs:200-206` |
| present 行既有法（anchor 先于 port 先于 PA；post-consume anchor-drift + 单 fd 身份；引用发布零字节；无 turn 回执=typed 拒绝） | `present-executor.mjs:109-118,183-206,271-326,346-360` |
| `deliverables/presented` 行本身**有** session 绑定（`session.append` 落在该 agent Session 上，带 turn+callId）——简报「present 唯一公开出口…且无 session 绑定」对本 pin 不成立；真实缺口 = 「无受审 publish 服务可委托」（O2-B (a) 原文） | tool-present `:100-108` + O2-B `u7r3-o2memo-20261030/O2-B-present-publish-service.md` (a)(b) |

## 2. 为什么本 lane 无正直代码路径（逐路线）

| 路线 | 改动面 | 本 lane 可否动工 |
| --- | --- | --- |
| 简报原形：往 `/api/$events` waterfall 新增 present 帧词汇 | 宿主源 `remote-events.ts` allowlist（闭集，唯一户口）+ 宿主 publish 服务（不存在） | **否**——upstream source patch，CORE PATCH BUDGET=0 红线 |
| O2-B N2（推荐正解）：Host 侧 `ctx.deliverables.publish(files,{callId,signal})→{turn,files}` | 上游公开接口流程（跨仓周期）；我方仅 adapter 得 present 脸（`createUserQuestionsPort` 同形） | **否**——非本仓可交付；O2-B 提案已落证据待流程 |
| O2-B N3：受信 glue 注入 present 脸仿写原生事件 | 注入点在 **ARC-A 保护文件** `agent-bindings.mjs`（ledger 在册；backends 注入 seam 形状 `:2811-2814` jobs 桥已示）⇒ 具名 Center Interface PR + 独立安全审查（`dev/agent-workflow/gates/USER-RULING-20261031.md:24`）+ **语义仿写 owner 裁决**（协调者令：不由本 lane 裁） | **否**——两道门都在 lane 权限之上 |
| 仓内自有词汇：`packages/remote` 新增帧族 + 取件方法 | 合同版本推进（contracts v-something 冻结流程）+ 新读面；但**生产者不存在**（生产 port 恒无 present 脸 ⇒ 帧恒零 ⇒ 正臂只能 mock 造）= 造旋钮造 witness（`dev/agent-workflow/gates/USER-RULING-20261031.md` §一 六项裁决 §3＝PR #446 无旋钮裁决，禁）+ 面先于受审效果出现（#390 declared==requested 律） | **否**——违两条在案纪律；形状已在设计注记留好 |

## 3. 本 lane 写面（全部）

- `dev/agent-workflow/evidence/a5w-present-wire-20261030/`（本 README + `WIRE-MAP-VERIFICATION.md` + `PRESENT-WIRE-DESIGN.md`）。
- **零** `packages/**`、**零** `tests/**`（⇒ 无 p4t6 booking 需求）、零 MATRIX/BACKLOG/tool-obligations/u7-0/ledgers/BOOT-BUDGET、零宿主树写入、零 boot、零 :3080、零 `~/.dsh`。
- remote/client 独占所有权本波未被消费（无 remote/client 改动发生）。
- CORE PATCH BUDGET=0：未破（无 upstream 写）。

## 4. 协调者需要的下一步裁决（本 lane 不代裁）

1. **改派或改形**：用户直令「present 接线到公开应答面」在真实拓扑下等价于在 R-N2/R-N3 中择一推进
   （三条路线的门与代价见 §6）；两条都在本 lane 权限之上，故本 lane 只能出设计不能出正直实现。
2. **简报纠错回流**：wire map 为虚构/错位（证伪包 = `WIRE-MAP-VERIFICATION.md`）；后续波次任何
   引用同组路径的任务令在派工前应先过同一证伪扫描（本包可直用）。
3. **G5 呈现**（O2-B open question 2 原样保留 OPEN）：`present` L4-positive 维持 DISCLOSED
   （`dev/agent-workflow/ledgers/u7-tool-acceptance.json:653-682`），理由行可加指本包 + O2-B。
4. **不新立 blocker**：CORE_SEAM 前置判据（「证明无既有 public composition path」）仍未达
   （O2-B (d)N5 原文对 pin 仍真），故本 lane 按**任务级 BLOCKED**停笔，CORE_SEAM 形分析已按
   简报格式五字段写入 `PRESENT-WIRE-DESIGN.md` §5，供协调者做 Gate 级分类。

## 5. 两条最锋利事实（供派工回流）

**(A) ask 有真实服务、present 没有 —— 这就是 present 不能照抄 #494 的原因。**
协调者增量③引 #494 (bea813f59) 作先例；该先例（ask O2-A S1）之所以能落 adapter+C1，
是因为 `ask` 骑的宿主服务**真实存在**：`userQuestions` 是 ctx 目录里的公开 SERVICE_API 键
（`tests/deepseek-harness-test-use/packages/extensions/tool-cordis/src/api-catalog.ts:3407 key:'userQuestions'`），`cap.hostService('userQuestions')` 返回活面，
故 `ui.mjs:87` 的 adapter 腿有物可接、可 mock、可测。present 要接的 `deliverables`/publish 面
在 `api-catalog.ts` **零命中**（本 lane grep），`hostService('deliverables')` 恒 `undefined` ⇒
任何我方 adapter 腿生产世界恒 fail-closed（与今日 `UI_PRESENT_PORT_ABSENT` 逐字同），
正臂只能 mock 造（违 #446 无旋钮律），且接口形状是 O2-B open question 1 未决项（我方先钉=可能钉错）。
⇒ **present 缺的不是「写 adapter 的手」，是「宿主侧那个尚不存在的 publish 面」。**

**(B) 我方树内不存在任何 waterfall/`$events` 转发器可改（非路径写错，是根本不存在）。**
穷尽三查：(1) `packages/remote/src/` = `contracts/handlers/push/index.ts`，无 `http/`、无 `events.ts`；
(2) 全包 grep `waterfall|$events|forwarded|permission_request|user_question` 于 remote/contracts
命中的全是 `approvalCaseId` 等**合同字段**，无一为事件词汇表或转发枚举；(3) 我方
`packages/remote/src/push/types.ts:1-30` 自述是**快照式 pull 同步**（P8-T3/T4：`team.getProjection`
整代 + `team.getLedgerPage` 版本分页 + generation 单调），**不是** 事件流转发器，根本没有
「硬编码只转发两类」的那张表。真实那张表在宿主源 `tests/deepseek-harness-test-use/packages/api/remotes/src/remote-events.ts`（W1）。
⇒ 简报「改我方 events.ts 加第三类帧」不是路径写错，是**目标物在本仓从未存在**（`git log --all -S`
对 `team-remote-server`/`publicPresentFilesProvider`/`presentFilesViaPort` 三 token 除本证据包自身 commit 外全 0 命中；审席 `rev-list --all --objects` 对象库路径普查同 0，见 WIRE-MAP 方法栏 S4）。

**(C) 最近邻候选已逐一排除为 publish 语义（承 `u7r3-uileg0-20261030/README.md` Q2 一行摘要，本 lane 不重推导）：**
`attachments`（宿主 `api-catalog.ts:413`=prompt-attachment 存储，即账本 `:121` read_image 结构缺口）、
`fileReferences`/`sessionFileReferences`（`/api/file` 读面）、`workspaceChanges`（只读 summary/diff）、
`sessionProjections`（register/stateOf=派生读态）；皆非「发布产物到公开应答面」的写语义，不能充当缺的那个 publish 服务。

**(D) 同名易混文件已点名排除（§5(B) 补）：** `packages/tools/harness/fence-probe.mjs` 虽在测试树内出现
`$events` 字样（:33/:124），但它是测试侧 **$events 解码记录器**（characterization probe，非生产码），
非事件流转发器、无 present 能力，不是本任务可改的「forwarder」。

## 6. 需要协调者拍的下一步（三选一，本 lane 不代裁）

| 选项 | 内容 | 门 |
| --- | --- | --- |
| R-N2 | 走 O2-B 提案进 Host 公开接口流程，要 `ctx.deliverables.publish(files,{callId,signal})→{turn,files}`；我方 adapter 腿随后（形状随提案冻结，见 OPEN Q6） | 跨仓周期；L4 先随 N1 披露入 G5 |
| R-N3 | 明文裁决仿写可 → 具名 **Center Interface PR**（落 ARC-A 保护文件 `agent-bindings.mjs`）+ 独立安全审查（`dev/agent-workflow/gates/USER-RULING-20261031.md:24`）+ 仿写语义风险归裁决 | 本仓可交付但**两道门在 lane 权限之上** |
| R-OWNED | plane 自有帧词汇入 `packages/remote` + contracts 冻结流程 | 生产者恒缺 ⇒ 违 #446 + #390 两律，owner 反选须同时豁免两律 |

**本 lane 现状 = 任务级 BLOCKED（设计已交，实施包 §7 备好，等上述裁决）**，非 CORE_SEAM 立案
（O2-B (d)N5「证明无 public path」判据仍未达：N2/N3 皆活路）。

**风险携带行（R498 审查席入台账）**：不立 CORE_SEAM 的成立条件 = owner 接受 `present` L4 维持
DISCLOSED（`dev/agent-workflow/ledgers/u7-tool-acceptance.json:653-682`）；若 G5 被裁「必交正控」，
则 `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md:148`（PRODUCT-GATE 逐工具必交正控）
翻转 ⇒ 本 blocker 升为 **Gate 级重分类**（届时按 CORE_SEAM_BLOCKER 固定格式补立案）。

## 7. Gates 复跑记录

- 起手/收笔 `git -C tests/deepseek-harness-test-use status --porcelain` = 0 行；`rev-parse HEAD` = `639ed015397290b3745d163aafe02ffee4aa3f84`（宿主 pin 未动）。账本格复核：`dev/agent-workflow/ledgers/u7-tool-acceptance.json:653-682` `present` 格、L4-positive DISCLOSED、reason 行实存于 `:678`。
- 宿主只读复核只用了 `sed/grep`；我方树除证据目录外 `git status` 空。
- 远端：ONE push of `task/a5w-present-wire-20261030`（任务令授权；零 force）。
- 时间线：lane 起手（读 ROUTER_RULES §0 + TEST_METHODS §1/§5）≈ 19:3xZ；证伪扫描+设计落笔 19:4x–20:0xZ（均 `date -u` 实测）。
