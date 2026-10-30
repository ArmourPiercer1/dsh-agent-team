# PRESENT-PUBLISH-GAP-MEMO — `present` L4 正向的公开接口问题（**草稿**）

> **状态：DRAFT，非 memo 正本。** 按本 lane 任务令落证据目录；是否/何时/以何名入
> `docs/plans/memo/…` = 协调者决定。格式比照 `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`
> 的六问式（格位/接线权威/迁移/绑定/守卫/验收），对象从「正式 Home」换成「publish 面」。
> 日期（real UTC）：2026-10-30T12:33Z；lane `u7r3-uileg0`（evidence README 同目录）；
> 宿主源 = 只读 test-use @ `639ed015397…`（0.2.0-rc.2）。

## 0. 一句话

钉死 Host 上 **不存在任何 ctx 侧 deliverable-publish 服务**（六问之问 2 的答案 = 现面无面可接）；
`present` 的 L4 正向因此不是「缺一条 boot 腿」而是**公开接口问题**——capability-gap-class，
与 read_image 的 attachment-store 格（账本 `u7-tool-acceptance.json:121`）同形。
**尚不构成 CORE_SEAM_BLOCKER**：阻断判定的前置问题（§5 问 5）尚未裁决。

## (a) 格位的冲突，三行

| 行 | 事实 | 锚 |
| --- | --- | --- |
| 验收格 | `present` L1/L2/L3=PROVEN，**L4=DISCLOSED**：「the present publication face exists on no host ctx service」 | `dev/agent-workflow/ledgers/u7-tool-acceptance.json:653-682`（reason `:678`）；G5 PRODUCT-GATE 逐工具正控 = PR #364 `execution-plan.md:148` |
| 我方行律 | family 适配面对 userQuestions 只镜像 ask+askTimed，**故意不带 present 面**；present 行 fail closed（f3 已在真宿主Witness 该 typed refusal `UI_PRESENT_PORT_ABSENT` + 零效果盘上 Oracle） | `packages/tools/families/ui.mjs:36-38`；`packages/tools/ui-family/src/ui-interaction-port.mjs:36-38,49`；`u7-f-ui-20261026/c2/C2-VERDICTS.md`（present refused 段） |
| Host 现实 | 原生 present 的 publication **不是服务**：tool 行亲笔 = durable file refs 进 tool result + `session.append('deliverables/presented')`；ctx 目录 128 键无任何 publish/deliverable 面 | `tests/deepseek-harness-test-use/packages/deliverables/tool-present/src/index.ts:27,75-77,105`；`packages/core/session/src/known-event-types.ts:36`；`packages/extensions/tool-cordis/src/api-catalog.ts`（128 键穷尽，publish/deliver/present 字样签名逐条异义：inspector telemetry `publish(topic,…)`、`presentAs(mode)`、webhook `dispatch`、`configure(presentation)`——逐条在 lane README Q1 扫描记录） |

## (b) 面在哪——穷尽扫描的四个近邻与排除理由

1. `sessionProjections`（register/stateOf）——派生读态不是 publish 语义；present 原生实现自己只是**读**
   `turnBoundary` 的开 turn 律（tool-present `:75-77`）。
2. `attachments`（saveFile/saveFileStream…）——prompt-attachment 存储面，作用域是**提示词附件**不是
   Session 交付声明；其 domain-ref 连 admission 授予 rung 都没有（账本 `:121`，protected center）。
3. `fileReferences`/`sessionFileReferences`/`workspaceFiles`/`workspaceChanges`——全部是**读/查看**面
   （`/api/file`、changes summary/diff），无写入发布语义。
4. 消费端 `packages/client/ui-deliverables/`（`/api/present.open|host`、turn-deliverables 折叠器）——
   只读 `deliverables/presented` 事件的 GUI 侧，不构成可委托的服务面。

**结论（问 2 答案）**：无面。gap CONFIRMED。

## (c) 关键披露——「事件词汇在 core，服务面不在」的精确形状

`deliverables/presented` 事件**类型**注册在 core（`known-event-types.ts:36`），append 通道 = Session 本体
的公开 API，理论上任何持 Session 的行都能**仿写** append。所以本 gap 不是「磁盘上没有任何路可走」，
而是：**没有受审的 publish 服务可供治理行委托**。仿写原生事件词汇意味着 plane 行直接冒充原生 tool 的
落盘形状（tool-present 的 turn 律、`tools/result` 钩子配对、`maxFiles` 律都在 tool 行自身），语义
冒领风险与环境真值污染风险由治理体系承担。**本 memo 不代裁可否仿写**——这是协调者/用户裁决位
（同 STATE_HOME「先公开接口、改中心前独立安全审查、不碰 `~/.dsh` 防护」的路径结构，
`USER-RULING-20261031.md` §一.2）。

## (d) 选项排序（比照 PRODUCTION-HOME-DESIGN (b)）

| 选项 | 内容 | 代价/风险 | 判定辅助 |
| --- | --- | --- | --- |
| O1 环境真值披露（**当下现状，推荐维持**） | f4 正臂轮里 present 臂记 typed refusal `UI_PRESENT_PORT_ABSENT` 环境真值（不造旋钮，USER-RULING §三.3/#446 律 `:32-35` 原文引用其文义）；账本 L4 维持 DISCLOSED，理由行改指本 memo | 零；诚实性由既有 C1 I-臂 + f3 Witness 支撑 | 不花 start；G5 前一直可行 |
| O2 公开接口文书 → Host 侧 publish 服务（正解方向） | 以本 memo 为底稿向 Host 公开接口流程提案「ctx 侧 deliverable-publish 服务面」（最小面 = 一次受审 publish(files)→{turn,refs}）；中心改动前独立安全审查；**不 patch upstream** | 跨仓周期；面形状需与 tool-present 律对齐 | 满足六问之问 2「优先复用/仅当证明不足才新增最小中心 capability」 |
| O3 plane 行仿写 `deliverables/presented` | 治理行自己 append 原生事件 | (c) 段冒领风险；等价于把 Host 语义抄进 plane = 治理面自扩权 | **不推荐**，除非协调者明文裁决其语义边界 |
| O4 证明只能 patch upstream | — | AGENTS 红线 ⇒ `CORE_SEAM_BLOCKER` | **未达**：O2 未被证明不可能 ⇒ 现在宣布 CORE_SEAM_BLOCKER 过早 |

## (e) 守卫保持不动（实现轮 no-regression 清单）

- `present` 行现状律：anchor-refusal 先于 port 检查先于 PA（OUTSIDE canary + 字节同一律已 live 在案）；
  任何后续面改动不得放松。
- 盘上 Oracle 独立于 tool 行（u7-f 的 runner-own-disk-reads 模式）必须在正臂轮保留。
- 账本机检 `scripts/eb3-tool-acceptance.mjs`（honesty checker，GATE-LEDGER R-G4R-3 注记）继续跑。
- read_image 格（`:121`）与 present 格**不得合并裁决**：同为 gap-class 但事件词汇/授予 rung 细节不同。

## (f) 验收核心（若走 O2，正臂轮判据）

1. 正臂：governed present 行 →（受审 publish 面）→ 交付行在 GUI 消费面可见（`/api/present.*` 读回）+
   tool_result 逐字 refs + 盘上 witness；
2. 反臂回归：port-absent typed refusal 零效果臂必须在有面世界仍可按 knob 关闭复现；
3. 全程 ONE World ONE boot、`--max-host-starts ≤3`（f1-f3 先例），池=USER-RULING `:11` 的 8-start 池。

## 问 6 —— 本 lane 留下的开放问题（供协调者）

1. O2 的最小面形状归 Host 公开接口流程——谁牵头、是否并入既有接口问题文书序列？
2. `present` L4 的 G5 呈现：随 O1 披露进 G5 材料（结构同 `:678` 理由行），还是等 O2 面落地？
3. 仿写问题（(c) 段）若要裁，需要独立安全审查吗？（STATE_HOME 先例是「改中心接口前必须」——仿写不改中心，
   但语义冒领面在 plane 侧。）
4. memo 正本落位（`docs/plans/memo/unified-baseline-alpha5-20261025/` 下新目录 vs 证据目录直提 PR）。
