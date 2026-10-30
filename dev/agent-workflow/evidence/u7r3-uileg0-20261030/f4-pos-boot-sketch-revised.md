# f4-pos-boot-sketch (REVISED) — UI 族 L4 正向 boot 探针草图（吸收 Q1/Q3 勘察；**仍不花任何 start**）

- 日期（real UTC）：2026-10-30T12:33Z；lane `u7r3-uileg0`；取代 `.artifacts/ops/UI-BLOCKER-SCOPING-20261030.md` §4 的
  「未来 boot 探针草图」——原草图两处被本 lane 证据改写（应答臂、风险面），其余保留。
- World 名建议不变：`080-u7-f-ui` 同族新线 `f4-pos`（kind `u7FsUi` 族扩展或新 kind，装配期定）。

## 与 scoping 草图的差异（本 lane 证据驱动）

1. **应答臂改 headless kit 直驱（主案）**。原案「浏览器在 GUI（ask-question-row）作答」保留为**可选
   GUI 渲染臂**；应答本身走已钉死公开面（lane README Q1 表 A/B/C），夹具已落地并通过：
   `tests/world-factory/lib/u7-uileg0-answer.mjs` + `u7-uileg0-answer-drive.test.mjs`（9/9）。
   ⇒ scoping §6.2（chromium 离线可得性）从正臂关键路径**移除**；auth 两步（boot-line token →
   303 cookie）在 kit 现成（`world-factory.mjs:731,934-941`）。
2. **审批车道序列不再需要现场探索**（Q3 已离线合成，逐步公开性有 live 先例锚）；
   新增 LIVE-确认位 L1–L5（README Q3 §LIVE 点名）。

## World 计划（装配期按 u7-tbash / u7-f-web assembly 惯例展开）

- **Mount**：`uiFamilyEnabled:true`（legacy 变体第一轮；`uiTimedQuestions` 留 f5，见判据 7）。
- **Blueprint**：member 模板 `default: ask`（交互效果=未点名效果 ⇒ 即 Ask，admission-kernel.ts:681）；
  `teamEnvelope.allow` 点名 `request-control`（envelope.ts:105-116，tbash cause-1 律）；
  **leader 模板不点名任何 ask_user_question 能力**（cause-5 律的 UI 直译：root 级 arming 不放大 leader）；
  **blueprint 内零 lane-scoped allow**（R-U6P3-1 复刻律——授权走行作用域 consume-once）。
- **Runner 角色（全公开面）**：
  1. boot 行取 token → `authenticate()` cookie（world-factory 现成）；
  2. 只读探针行 `GET /__u7fui*/controls`（forward `teamRoot.control.listControlState`）读挂起行；
  3. `POST /team-remote/team.resolveControl`（cookie-gated v4 面）逐行结算——
     **decideResolution 只 allow 一行**（pin：requestId + toolName=ask_user_question + 行指纹），
     第二次同题调用开新行、不给授权（tbash cause-4 律）；
  4. **应答腿（新，Q1）**：`$events` 流接 `user-questions/request` waterfall 帧 →
     `POST /api/$events/result` 答 `{answers:[{id,selected}]}`（面 A，开放题正臂）；
     timed 变体（f5）另走超时 → `POST /api/userQuestions/answer`（面 B，`accepted`≠已收编，
     等 `user-question-reply` user message 落盘为收编见证）。
- **mock 脚本**：第一次调用合法 `{label}` 选项形状（f2 教训：closed-world 契约先挡）；
  第二次重复调用（replay 反臂）。

## 判据格（f4-pos suite，全格有离线锚，Q4 表）

| 格 | 判据（全部 witness，不造假） |
| --- | --- |
| `ui:ask-approved-ran` | `governed-ask RAN` observe 行 ×1 + 答案逐字落 tool_result + 盘上 `user-question-reply`/answer 见证（L1,L4） |
| `ui:ask-approval-chain` | durable ledger `control-request-recorded(tool=ask_user_question)→control-decision-recorded(allow)→control-allow-consumed` 三事同 requestId（L1,L5；事实型由 u7-tbash-offline-drive 测锁形） |
| `ui:ask-replay-refused` | 重复调用开**新行**、runner 不授权 → APPROVAL_DENIED 形状，零第二次 RAN |
| `ui:ask-answer-wire` | 面 A 帧序列 fixture 实录回放一致（面形漂移 = 格红，夹具先于 boot 已知形） |
| `ui:live-root-law` | L2 如实记录：member 过 assertLiveRoot 则记 PASS；若 DELEGATED_CALLER 则该臂**挪 leader(root) 车道重排 blueprint**，本格记 NOT_RUN+证据（不造假不重试烧池） |
| `ui:present-env-truth` | present 臂 = `UI_PRESENT_PORT_ABSENT` 环境真值（PRESENT-PUBLISH-GAP-MEMO O1；不造旋钮） |
| `ui:leak-check` | 既有 f3 泄漏格直移（owned pids/ports/home/leases） |
| （f5 候补）timed 正臂 | 面 C `attachWait` 读数 + 超时 `pending`（T-4 逐字）+ 面 B 迟到答案——T 系离线锚全在，boot 腿独立于 f4 |

## 预算与池（仍 NOT SPENDING）

- **池归属建议：`USER-RULING-20261031.md:11`「其他 Family 的 L3/L4 验收（含 State Home）」8-start 池**
  （scoping 原建议维持，本 lane 无异议证据）。
- **starts 预估：1–3**（1 主跑 + 1 blueprint/装配 drift 位 + 1 ENV 重试位）。
  浏览器腿移出关键路径后，**ENV 风险面缩小**（原 chromium 不确定性出清）；新增风险面=L2
  （live-root 律），已被判据格设计成「NOT_RUN+证据不重试」形态，不吸 start。
- 开跑前置门（沿用 USER-RULING §一）：确切源码×Host 绑定预登记；L2 反向时先 RCA 再动第二 start；
  效率门不变。
- **本 lane 未花任何 start；本文件仅登记，排产权在协调者。**
