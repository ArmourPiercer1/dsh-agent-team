# PRESENT-WIRE-DESIGN — present 产物 → 公开应答面的最终 wire 形（设计注记，真实拓扑版）

> DRAFT 设计注记（非裁决）。真实 UTC 2026-10-30T20:0xZ（`date -u` 实测）；lane `a5w-present-wire`。
> 宿主权威 = 只读 `tests/deepseek-harness-test-use` @ `639ed01539…`（本 lane 逐锚实读）；
> 我方权威 = master `f1db2a6db`。本 lane **零 packages/ 改动、零新帧、零 boot**——设计先行，
> 实施等待 §7 的 OPEN QUESTIONS 裁决。简报原形的逐锚证伪 = 同目录 `WIRE-MAP-VERIFICATION.md`。

## 1. 事件词汇最终形状（简报设计点 1 的回答）

**不需要新造词汇。** 真实拓扑里产物-可观察性的既有闭形就是原生事件行：

- 事件名 `deliverables/presented`，core 注册（`core/session/src/known-event-types.ts:36`），
  payload 形状 = `{ turn: number, callId: ToolCallId, files: [{ path, description? }] }`
  （生产者亲笔 `tool-present/src/index.ts:105-107`；`files` 闭形与我方 `ui-mechanics.mjs:195-231`
  的 `parsePresentArgs` 已互为镜像）。
- GUI 消费端已在（宿主 client deliverables 插件读 durable 行 + `/api/present.open|host`
  桌面动作，`ui-deliverables/src/presented.ts:7,10`）。
- 词汇权威核对（简报「先查 packages/contracts 是否持有事件枚举」）：**packages/contracts 不持有
  任何事件枚举**（全包 grep `permission_request|user_question` 零命中，src 树无事件表）；
  `/api/$events` waterfall 的词汇权威在**宿主源**（`api/remotes/src/remote-events.ts:20-48`，
  the-one-home 闭集）。⇒ 走本设计（N2 真实）时 **contracts 冻结流程不触发**；若 owner 反选
  「plane 自有帧词汇」路线，新枚举才首次入 contracts 并须附兼容注记+正负控（§7 R-OWNED）。
- 与 `approval/request`/`user-questions/request` 帧族的关系：**不同层**。那两族是 mux 实时
  waterfall（人答题/审批下行）；present 是 durable session 事实行（产物上行），其"实时腿"由宿主
  既有 session 事件通道承载。要求 present 挤进那两族的 waterfall 模式 = 改宿主闭集 allowlist
  = upstream patch（红线，§5 seam 分析）。

## 2. session 绑定强制（简报设计点 2）

绑定由构造保证、不新增机制：原生行的 `session` 参数**就是调用方 agent 的 Session**
（`tool-present:77 exec.agent.session`，`:105 session.append`）。A-session 的行不在 B-session
读面出现是宿主 session 作用域既有律（GUI 每 session 读自己的事件流；`/api/present.*` 同理）。
我方治理行经 port receipt 只回整数 `turn`（`present-executor.mjs:327-369`），**永不持有/传递
session 句柄** ⇒ 跨 session/跨 realm 泄漏在 plane 侧无通路。401/授权面零改动（不触 auth）。

## 3. 元数据+可寻址，不嵌字节（简报设计点 3）

与既有读侧最小一致 = **引用形**：帧带 `path`(+`description?`)+`turn`+`callId`，字节永不入流
（宿主法「the user opens the current files; their contents are not copied」+ 我方执行器
`present-executor.mjs:109-118` 计量字节即弃）。取件 = 既有 `/api/present.*`。简报假定的
「present-files 按 session 取件 handler」不存在（W2/W5），但其设计偏好（引用 id + 既有取件面、
避免复制大字节）恰好被原生形完整满足——**无新取件面需要建**。

## 4. 零授权语义变化（简报设计点 4 + 协调者令④）

不动：present 仍是 `tool-invoke + domain-ref(ui-presentation) + 每文件 read` 声明集过 PA
（`present-executor.mjs:207-262`）；anchor→port-gate→PA 次序律；ask 法（approval 车道）零接触；
**port 不可用臂 `UI_PRESENT_PORT_ABSENT` 保持唯一诚实终态**（`:200-206`；协调者令④ = 本设计的
NC1）。任何后续接线只替换「port 脸缺席」为「port 脸接到受审服务」，不改行内任何门。

## 5. CORE_SEAM 形分析（简报要求的五字段；**不作为 blocker 立案**，理由=末段）

- **seam 名**：Host forwarded-event waterfall allowlist（`API_REMOTE_FORWARDED_EVENTS`，
  `packages/api/remotes/src/remote-events.ts` @ `639ed01539…`）。
- **Required behavior**：治理 present 的产物帧能出现在其所属 session 的公开 GUI 事件流，
  与 `approval/request`/`user-questions/request` 同层可达。
- **Observed public behavior**：该 allowlist 是宿主源内单一 `as const satisfies` 闭集
  （"the one home … both compiler faces"），无插件/外部注册 seam；ctx 目录（`cap.hostService`
  可达全集，91 键，O2-B (a) dated 更正）**无任何 publish/deliverable 服务键**；唯一 publication =
  tool 行亲笔 `session.append`（`:100-108`）。
- **Minimal reproduction**：真宿主 mount 治理 UI family → `present` 行恒
  `refused-admission UI_PRESENT_PORT_ABSENT` 零效果（live 在案：PR #491
  `u7r3-uif4-20261030` `ui:present-env-truth` PASS + 盘上 SHA 不变 oracle）；即便有 port 脸，
  allowlist 无 deliverable 条目 ⇒ 新帧词汇不可达 mux。
- **Affected invariant**：`present` L4-positive（`u7-tool-acceptance.json:653-682`，reason `:678`）
  与 G5 逐工具正控判据（`execution-plan.md:148`）；以及「产物对 session 的 GUI 侧可观察」的
  用户直令目标。
- **为何不立案**：blocker 前置判据「证明无既有 public composition path」（ROUTER_RULES :130，
  O2-B (d)N5 原文）**仍未达**——N2 公开接口路线未被答复、N3 技术上可达（仅等 owner 裁决）。
  本 lane 以任务级 BLOCKED 停笔，本节供协调者做 Gate 级分类。

## 6. 负控套件（设计冻结；已绿=既有 C1 锁死，未建=裁决后实施轮）

| # | 负控 | 状态 |
| --- | --- | --- |
| NC1 | 无 publish 服务/port 缺席 → `UI_PRESENT_PORT_ABSENT` typed 零效果 + **一切面上零帧**（协调者令④） | 已绿（C1 + f3/f4 活体 witness）；裁决后复跑不回退 |
| NC2 | A-session 的 present 行不出现在 B-session 读面（跨 session 不可见） | 裁决后实施轮（宿主 session 作用域正控 + 我方 receipt 无 session 句柄断言） |
| NC3 | 未授权连接 401 面不变（auth 零接触证明） | 既有 401 面测试复跑即可 |
| NC4 | 坏引用取件 → typed 错误（无字节回落） | 裁决后（宿主 `/api/present.*` 既有语义 + 我方不新增取件面） |
| NC5 | present 失败（port 抛/取消）→ `UI_PRESENT_PORT_FAILED`/cancelled typed，零帧 | 已绿（`present-executor.mjs:337-345` C1） |
| NC6 | 帧 schema 漂移 → 消费端 typed 拒绝（消费=宿主 client；我方镜像 `parsePresentArgs` 闭键拒绝在案） | 已绿（ui-mechanics C1 unknown-parameter 族） |
| NC7 | port 报成功但回执无整数 turn → `UI_PRESENT_RECEIPT_INVALID`（携带 sideEffectPossible） | 已绿（`:355-360`，F-405-3） |

## 7. 实施路线与改动面（裁决后执行包，均本仓内、零 upstream 写）

- **R-N2（推荐，等 N2 形状被 Host 流程接住）**：~半天。`packages/tools/ui-family/` 两处——
  (i) `ui-interaction-port.mjs` 新增受审服务适配器（`deliverables.publish(files,{callId,signal})
  → {turn,files}` 形，receipt-turn 律即 `:25-31` 既有契约），(ii) `families/ui.mjs` `portRef`
  组合两宿主服务（userQuestions→ask/askTimed + deliverables→present，任一缺席=该行 fail-closed
  不变）。测试=离线 C1 vitest mock transport（简报点 6 原形）；新可扫描文件则 p4t6 booking 一条
  （协调者令⑤）。CAPABILITY_KEYS/ARC-A/contracts/remote 面 **字节不变**（#494 形 CLASSIFICATION
  照抄）。**不触发 contracts 冻结。**
- **R-N3（仅当 owner 明文裁决仿写可）**：注入点在 **ARC-A 保护文件** `agent-bindings.mjs`
  （ledger 在册；backends 注入 seam 形状 `:2811-2814`）⇒ **具名 Center Interface PR + 独立安全
  审查**（USER-RULING :24），且须原样重实现 open-turn/maxFiles/tools-result 配对或诚实缩形；
  语义仿写风险由裁决承担。本 lane 不代裁。
- **R-OWNED（不推荐）**：plane 自有帧词汇入 `packages/remote`（合同版本推进 + contracts 冻结流程
  + 取件方法）。生产世界生产者恒缺（port 无 present 脸）⇒ 正臂只能 mock 造 = 违 #446 无旋钮律 +
  #390 declared==requested 律；形状已留此段，owner 若反选需同时裁决上述两律的豁免。
- **简报原形（往 /api/$events 加帧族）**：= §5 的 seam，upstream 流程，本仓不可交付。

## 8. OPEN QUESTIONS（原样保留 O2-B 四问 + 新增两问，不由本 lane 裁）

1-4. O2-B open questions 1-4（N2 提案收件方与形状 / G5 呈现 / N3 仿写可容性与安全审查 /
read_image rung 分离）——见 `u7r3-o2memo-20261030/O2-B-present-publish-service.md` §Open。
5. 简报（工作流 A 派工单）wire map 虚构已证伪并回流（`WIRE-MAP-VERIFICATION.md`）：
   **派工前证伪扫描是否入后续波次固定门？**
6. 若 owner 选择 R-N2 预接线（先落我方 adapter 腿、fail-closed 等 Host 服务），**接口形状
   `deliverables.publish(files,{callId,signal})` 是否随 O2-B 提案一并冻结**，以免我方先钉后改？
