# u7r3-uileg0 — LEG-0 UI 族公开接口勘察（L4 正向四问）

- Lane: `u7r3-uileg0`（seat qwen3.8-flash-next 已披露；pattern = bounded questions like wfpoc）
- 日期（real UTC）：**2026-10-30T12:33:01Z**（本 lane `date -u` 实测；lane 起手 fetch+worktree ≈
  `2026-10-30T12:27:41Z` 同为实测）。scoping 简报自署「2026-11-01（本会话实测时点）」与本 lane
  系统时钟不一致——按各自在案记录并存，不代裁（引用其文本报锚不受影响）。
- 分支 `task/u7r3-uileg0-20261030` @ 基线 `1d884efdb`（= origin/master tip）；worktree `.worktrees/u7r3-uileg0`
- 对象 = 只读 `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（本会话 rev-parse 实测，porcelain 空）+ 我方 `packages/`
- 授权边界：**零 boot、零 :3080、零 `~/.dsh`、host 树只读**；写入 = 本证据目录 + 两个新测试文件（见 §Gates）
- Foundation：`.artifacts/ops/UI-BLOCKER-SCOPING-20261030.md`（lane 7139f5a2）全读；其关键锚全部**spot-verify 通过**（非重推导）：
  `ledgers/u7-tool-acceptance.json:622-682`（`:647`/`:678` 两条 reason 行逐字复核）、
  `packages/tools/families/ui.mjs:36-38` + `:81`、
  `packages/interaction/user-questions/src/index.ts:79-85`（`extends TypertRemoteService`，`super(ctx,'userQuestions')`）、
  GATE-LEDGER `:20`（#373/FIX-K）`:23`（R-U6P3-1）`:103`（CLOSED via u7-g4r3）、
  `c2/C2-VERDICTS.md:39-45` 与 `:22-24`、`USER-RULING-20261031.md:8-13/:60`、
  `resolve.ts:252-264`（human-override 无 envelope 检查层）与 `envelope.ts:105-116`。

## 四问裁决（各带证据；细节见 f4-pos-boot-sketch-revised.md 与 PRESENT-PUBLISH-GAP-MEMO.md）

### Q1 — userQuestions 应答可达性：**YES，公开面存在，应答臂可 plane 侧实现**

钉死 Host 上应答一条 pending `ask_user_question` 的**全部公开路由**（无一处私有 API；GUI `ui-user-questions`
插件走的就是这些面）。认证一步到位：`dsh web` 启动行打印带 launch token 的 URL
（`packages/bundle/web-app/src/index.ts:262,271`）→ `GET /?token=…` → 303 + `dsh-auth-*` HttpOnly Strict
cookie（`packages/client/connection/src/browser-auth.ts:238-260`；401==401 只读探针语义不变）。
**WorldFactory kit 已经实现这两步**（`tests/world-factory/lib/world-factory.mjs:731` 解析 token、`:934-941`
`authenticate()` 做 303→cookie 交换）——f3 披露的「C2 world 无 HTTP 面可驱」是**该世界的构造事实**，
当场作废为勘察结论。

| 面 | 路由/协议 | 语义 | 钉死锚（test-use @639ed015397） |
| --- | --- | --- | --- |
| A. 开放题（waterfall provider） | WS `/api/remote.mux`（upgrade 带 cookie）→ open 帧 `endpoint:'$events'` `payload:{args:{}}` → 下链 `ready{clientId}` → `waterfall{event:'user-questions/request',eventId,agentId,request}` → `POST /api/$events/result`（client-request 信封，payload.args 恰为 `{clientId,eventId,outcome}`） | 与 GUI 同律：作为 answerer 挂在 Agent-scoped waterfall 上，直接答**未超时**的挂起题 | stream-protocol.ts:7-19,53-95；client/remote-events.ts:219-224（`connection.rpc.call('/api','$events/result',{args:result})`）；forward allowlist `user-questions/request` mode:'waterfall'（api/remotes/src/remote-events.ts:45）；信封=rpc-schema.ts:35-47 + gateway.host.spec.ts:1317-1333；mux 认证=echo-stream.host.spec.ts:45-48 |
| B. 续答题（timed 超时后 `continued`） | `POST /api/userQuestions/answer`，args `{agentId:<root SessionId>, callId, answer:{answers:[{id,selected,custom?}]}}` | `true`=REPLY_QUEUED（等 agent 收编 user message）；`false`=非 continued；码 REPLY_QUEUED/BAD_ANSWER/CALLER_NOT_LIVE/DELEGATED_CALLER | 生成面 `packages/interaction/user-questions/lib/typert.remote-client.d.ts`（`userQuestions/answer` + `agent:` 作用域变体）；服务本体 index.ts:164-205；`continued` 语义 projection.ts（`state:'continued'` 仅 timed fold） |
| C. 倒计时见证（可选） | mux `endpoint:'userQuestions/attachWait'` → `{remainingMs}` 帧 | 持挂起前台等待的读数；关流即释放 claim | d.ts 同表；index.ts:214-223 |

⇒ **f4-pos 应答臂可 plane 侧实现**：草图 + 离线夹具已落地
（`tests/world-factory/lib/u7-uileg0-answer.mjs` + `u7-uileg0-answer-drive.test.mjs`，9/9 绿，
`node --test` 实测）。**浏览器腿降级为可选**（GUI 渲染臂另说）——scoping §6.2 chromium 离线可得性
不再是应答正臂的前置风险。

### Q2 — present publish 面：**gap CONFIRMED（无 ctx 侧 publish 服务）**

穷尽扫描 = 生成的公开 ctx 目录 `packages/extensions/tool-cordis/src/api-catalog.ts`（128 个
`ctx.<key>`，freshness-gated，即 `cap.hostService(name)=agentCtx.get(name)` 的可达全集——
`packages/runtime/src/plugin/live/team-tool-plane.mjs:1602-1604`）。**无任何 deliverable/publish 服务键**；
全目录签名含 publish/deliver/present 字样的四条均为异义（inspector telemetry publish、tool presentation
mode、webhook dispatch、configure presentation）。近邻面逐一排除：`workspaceChanges`（只读
summary/diff）、`attachments`（prompt-attachment 存储；即账本 `:121` read_image 结构缺口）、
`fileReferences`/`sessionFileReferences`（`/api/file` 读面）、`sessionProjections`（register/stateOf=
派生态，非 publish）。Host 原生 present 的「publication」= **tool result 里的 durable file refs +
`session.append('deliverables/presented')` 由 tool 行亲笔**（`packages/deliverables/tool-present/src/index.ts:27`
inject=`['tools','fs','sessionProjections']`，`:105` append；事件类型 core 注册
`packages/core/session/src/known-event-types.ts:36`；消费端 `packages/client/ui-deliverables/`）。

**诚实披露（写进 memo）**：publication 词汇是**事件而非服务**——事件类型在 core known-event-types、
任何持 Session 的行理论上可仿写 append。所以 gap 的精确定义 = 「无**受审的 publish 服务面**可供
治理行委托」；治理行是否可以直接使用原生事件词汇（而非服务）做 publish，是**协调者/接口文书裁决**，
不是本 lane 代裁。⇒ 六问式接口文书草稿已按裁决落**证据目录**（非 memo/，memo 落位=协调者决定）：
**PRESENT-PUBLISH-GAP-MEMO.md**（本草稿同目录）。

### Q3 — 审批车道公开驱动：**YES，序列可离线合成，每步公开性有在案证明；LIVE 位已点名**

C2 公开驱动序列（ask_user_question 正臂的审批车道部分）——bash 线已证形态直移，逐锚：

1. **World 材料化**：profile-patch 行面（production row+glue+seam+p6t6+探针行，file-URL 挂载）——
   u7-f / u7-f-web / u7-tbash 三族 live 先例（`tests/world-factory/lib/u7f-web-assembly.mjs`、
   `u7-tbash-assembly.mjs` 头注）。
2. **车道出生**：member 模板 `default: ask`（交互效果无规则名 ⇒ 未点名效果即 Ask——
   `packages/runtime/tool-admission/admission-kernel.ts:681`「`default:'ask'` needs nothing: the
   no-authority arm IS the Ask」）；`teamEnvelope.allow` 点名 `request-control`
   （`packages/runtime/admission/envelope.ts:105-116` 团队根 ceiling = u7-tbash cause-1 修复，
   assembly 头注 `:12-16`）。
3. **行读面**：runner 扮 Human resolver **读**挂起行 = 只读探针行 `GET /__u7*/controls`
   （forward `teamRoot.control.listControlState`，`tests/world-factory/canary/u7fweb-ctl-probe-host.mjs`
   头注「zero authority」；第二独立面 = p6t6 `/__p6t6/state`）。
4. **结算**：**`team.resolveControl`（v4-only 公开 remote 方法）**，经 cookie-gated
   `POST /team-remote/<method>`（`packages/remote/src/contracts/catalog.ts:89,194-202,202`；
   调用形态 `u6-fs-assembly.mjs:505-512` `remoteCall`；**live 在案**：`tests/world-factory/suites/070-u7-f-web.mjs:156,232`
   ——「two durable PA ask rows…; the Human public seam team.resolveControl v4 answered allow then deny」，
   宿主日志 RAN/APPROVAL_DENIED 见证）。
5. **consume-once**：账本事实型 `control-request-recorded / control-decision-recorded /
   control-allow-consumed` 被离线测锁死（`tests/world-factory/u7-tbash-offline-drive.test.mjs`）；
   live 关闭 = R-U6P3-1 CLOSED（GATE-LEDGER `:103`，引 `u7-g4r3-20261028/arc-b/c2-verdicts-boot1-*.json`
   overall PASS 6/6——引其记录不抄结论：bash 的真解 = 行作用域 consume-once，见 6）。
6. **R-U6P3-1 教训复刻（车道作用域律）**：**不许**在 blueprint 数据里表达 lane-scoped allow——
   冻结规则语法（read|read_image|write|edit|lsp|bash|pwsh）无名交互规则
   （`packages/tools/ui-family/src/ask-executor.mjs:133-136` 原用句式直译），且 leader-resolved
   human-override 必挂 leader 车道（`packages/domain/policy/src/resolve.ts:252-264` 无 callerMember；
   `envelope.ts:113-115`；GATE-LEDGER `:23` 原文）。正解 = 授权**随行作用域走**：
   resolveControl allow 一次性授予**该行**（`ask-executor.mjs:160-166` pa 边带
   `parametersFingerprint`，重复调用开新行、无新授权 = tbash cause-4 律），且 leader 自身不持有
   可被 arming 加宽的同类车道（tbash cause-5 律：leader 无 shell lane ⇒ root 级 request-control
   不放大任何可 spawn 面；ask 直译 = leader 模板不点名 ask_user_question 能力）。

**LIVE-确认位（f4-pos 点名，不可离线证）**：
- L1 `toolName=ask_user_question` 的 PA ask 行确实落 durable ledger（web 族证的是 web_fetch 行；行形状同substrate未试）。
- L2 **member agent 过 `assertLiveRoot`**——f3 的拒答死在我方 row 门之前，`DELEGATED_CALLER`
  （`index.ts:130-141`：human interaction requires the exact live ROOT agent）对 governed member
  行从未被行使；若 member 被判非 root，应答腿改挂 leader（root）车道执行，blueprint 相应挪位。
- L3 面 A 的 `waterfall` 帧能到达 runner 的 `$events` 流（member Agent-scoped 生成）。
- L4 答案逐字落 tool_result + `governed-ask RAN` observe 行 + 盘上 witness
  （`user-question-reply` source 的 user message 事件）。
- L5 resolve→consume-once→行继续 在 UI 行上重演（非 web_fetch 行）。

### Q4 — timed/legacy 变体离线断言锚：**已钉死（两侧）**

| 语义 | 钉死测试/fixture（file:line） |
| --- | --- |
| 变体=mount-time、closed：legacy 默认，timed 仅 `uiTimedQuestions:true` | 我方 `packages/runtime/test/u7-f-ui-c1.test.ts:236`（MF-3 非布尔=PLANE_CONFIG_INCOMPLETE）、`:444`（T-1 host mode mirror）；宿主 `tool-ask-user/tests/tool-ask-user.spec.ts:102`（无 config=blocking legacy）、`:115`（timed 仅 opt-in）、`:203`（Cordis 选形） |
| timeout 律：`-1` keyed-indefinite / 1..2147483 秒界 / mount 默认 120s | 我方 `ui-mechanics.mjs:53-58`（DEFAULT=120、BOUND）、`:91-98`（validateAskTimeout）、C1 `:457`（T-2 毫秒到 port）、`:467`（T-3 keyed arm）、`:506`（T-6 界=先行律，零 port 调用）；宿主 `tool-ask-user.spec.ts:125`（120s fallback）、`user-questions/src/index.ts:234-245`（BAD_TIMEOUT，1..2_147_483_647 ms） |
| pending ≠ 答案（过期永不造答案） | C1 `:478`（T-4 host pendingNotice 逐字）、`:495`（T-5 不诚实 port 的 answers 被 DROPPED）；宿主 `tool-ask-user.spec.ts:452,509`（deadline→pending / unclaimed→pending）；`ui-mechanics.mjs:66-72`（PENDING_NOTICE 唯一户口） |
| timed fold 识别（`timeout` 参数=唯一形征；legacy 调用**从不进** projection） | 宿主 `projection.spec.ts:84`（by wait parameter alone）、`:95`（legacy Session folds empty）、`:138`（continued 可答）、`:148`（close-on-admit）；我方 `ui-mechanics.mjs:58-61`（TIMED_WAIT_PARAMETER=projection.ts:36 mirror） |
| 前台 claim/attachWait 生命 | 宿主 `timed-wait.spec.ts:18-93`（claim/释放/续读全谱） |
| 重复 question id 律 / replay 律 timed 臂 | 宿主 `tool-ask-user.spec.ts:563,585`（dup 拒 / 跨调用复用）；C1 `:520`（T-7 unique ids 零 port）、`:532`（T-8 settled token 答案 cancelled，human waited-for once） |

⇒ 未来 boot 腿的每条判据都有上述离线锚，不存在「靠 boot 探索语义」的残余。

## Gates 遵守与写入面

- **只动了证据目录 + 两个测试文件**：
  `tests/world-factory/lib/u7-uileg0-answer.mjs`（新，纯函数应答臂 wire 夹具）、
  `tests/world-factory/u7-uileg0-answer-drive.test.mjs`（新，node:test，9 tests）。
  Q1 判为「有可离线实现的应答夹具」⇒ 触发门内允许的单元测试；形态=committed-wire-shapes 的
  `u7-tbash-offline-drive.test.mjs` 先例（lib 拆分同 u6/u7 assembly 惯例——lib 文件是该测试的导入物，
  属门内「单元夹具」本体，如实披露）。
- 运行：`node --test tests/world-factory/u7-uileg0-answer-drive.test.mjs` → **9 pass / 0 fail**
  （2026-10-30 实测）；`npx eslint` 两文件零告警。vitest 全量未跑（未触任何 vitest 面；门条款允许）。
- 零 boot、零 :3080、零 `~/.dsh`；test-use 树零写入（porcelain 空复核）。
- 远端：**ONE push** of `task/u7r3-uileg0-20261030`（任务令授权；gated 历史零触碰、零 force）。
- 时间线：lane 起手 ≈ 2026-10-30T12:27:41Z（实测 date -u），勘察+夹具+提交 ≈ 2026-10-30T12:33Z 起。

## NOT_VERIFIED（禁止升格）

1. L1-L5 全部 LIVE 位（Q3 §LIVE）。
2. `/api/$events/result` 经 HTTP 的**外层信封**细节（method 串=`'$events/result'`）由客户端调用点
   （`connection.rpc.call('/api','$events/result',{args:result})`）+ claimsEndpoint(index.ts:326) 合成，
   fixture 已按其记录形钉死，但**未经真宿主回环**（真回环 = f4-pos L3/L4 的一部分）。
3. `attachWait` 流对 governed 行的适用性（面 C 仅形状钉死）。
4. 若 member 判非 live root（L2 反向），leader-lane 挪位方案的完整 blueprint 形状。
5. chromium 浏览器腿（本 lane 已把它移出应答正臂关键路径；GUI 渲染验收若被点名仍需独立勘察）。
