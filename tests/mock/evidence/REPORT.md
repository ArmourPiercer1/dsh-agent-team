# tests\mock 全量 Mock 测试报告（REPORT.md）

> 战役：`docs/plans/active/TEAM_DTEST_WORKSPACE_PLAN.md` 全计划（T0.1 → P6），Playwright 全自动化执行。
> 用户裁决（全程有效）：**发现仅记录、不进一步诊断、不修复**；允许 tests\mock scaffold 扩展使计划可执行（逐项留痕）；产品代码零修改；报告中文。
> 执行日期：2026-09-07（UTC+8 08:25 – 13:45）。全程日志见 `NOTES.md`（259 行，逐任务证据链）。

---

## 1. 结论摘要

**整体裁决：计划范围内全部可执行任务完成（PASS / 记录性偏离 / blocked-by-finding 三类均已留痕）。** 端到端哨兵业务任务（T6）在最终世界完整跑通：两个成员工作流 + leader 汇总，磁盘产物逐字正确，durable 时间线完整，UI 终态收敛。

- **发现（product finding，均仅记录、未修复）**：**9 项**（F2 冷恢复丢 leader 面 / F3 progress 提交非确定性挂起 / F4 quota per-template 语义 / F5 UI 需整页 reload 收敛 / F7 蓝图快照不可变 / F9 user-approval 无人类裁决通道 / F11 ledger UI 静默截断 / T1.4 UI 建团结构性阻断 / boot#7 live 冲突与 G1 边缘 B 同族——其中 F4/F7 为"计划文案 vs 产品语义"偏差，机制本身正确）。
- **架构语义澄清（非缺陷，记录）**：F6（envelope 交集 fail-closed 正确）、F8（有效 envelope = team ∩ template）、F10（last-mile guard 只包 4 个 team work 操作、no-request 放行、correlation=请求 token、check-and-reserve exactly-once）。
- **blocked 项**：T2.6（blocked-by-F3）、T4.1 allow 半程（blocked-by-F9）——两项均为产品能力缺口导致，非测试失败。
- **合规**：产品代码零修改（仓库 tracked 文件 0 变更，HEAD `3f06525` 未推送）；test-use 树 clean @ `a66e4702`；`:3080` 稳定部署全程未触碰；API key 未打印未落盘；端口全部释放。

## 2. 测试环境

| 项 | 值 |
|---|---|
| 被测宿主 | `references/deepseek-harness-test-use` @ `a66e4702`（stable，pristine upstream 角色，用户裁决切换 + clean/install/build） |
| 插件 | 本仓库 `packages/*` 9 包构建产物，cordis 4 行挂载：`dsh-agent-team`（host）/ `dsh-agent-team-client`（client）/ `p6t6-team-tools`（宿主 MCP row）/ `dtest-mcp-http`（宿主 MCP client row） |
| DSH_HOME | `tests\mock\.dsh-home`（fresh，每 boot 按 directive 恢复/续用） |
| 端口 | 宿主 3181；外部 mini MCP 3491（facet `dtest-mini`）/ 3492（宿主级 `dtesthttp`）；稳定部署 3080（禁触） |
| 模型 | qiyuan-self / qwen3.8-27b（真实模型，key 经 `.credentials.yaml` ref，未打印） |
| 宿主文件策略 | `workspace-write`（preset 默认；审批 enabled → 越界写触发 GUI 审批提示） |
| 启动 | `tests\mock\scripts\boot.mjs`（开关：`MOCK_ROOT_SESSION_ID` / `MOCK_EXTERNAL_MINIS` / `MOCK_HARD_TOOLS` / `MOCK_BOOT_LABEL` / `MOCK_DEAD_MCP_URL` / `MOCK_PROFILE_MODE`），共 8 次 boot（boot#1…boot#8） |
| 测试通道 | (a) 公开 API `POST /api/session/prompt`（boot token 303→cookie 鉴权）向 leader/member 投递 turn；(b) Playwright（session `mocktest`）全 UI 操作与断言（sidebar/团队 tab/治理区/审批 lane/ledger）；(c) durable log 取证（多帧 zstd `session.jsonl.zstd` 解析脚本族）+ `team_domain.json` 域真值 + 磁盘 ground truth |

**三个世界（root 演进，均为环境构造留痕，非产品事件）**：
1. `session-dtestmtr0i8cxb3de`（旧运营团队，T1–T3；因 F7 蓝图快照不可变 + F3 死锁冻结）；
2. `session-dtestp41011041031171125012199120`（P4 首次尝试，W1'=inst-05lerpm0ydqe / W2'=inst-05bf60n0ynq0；因 F8 scaffold 配错 + F3 再发弃用）；
3. **`session-dtestp61051185350112102111120115117`（最终运营团队，P4 后半–P6；W1=inst-1yabcoe00jed / W2=inst-0zb3tna1drgr / leader=inst-leader）**。

## 3. 结果总表

| 任务 | 结果 | 一句话依据 |
|---|---|---|
| T0.1 搭建 | PASS | scaffold 全量 + profile junction 树 + fresh 初始化 |
| T0.2 干跑（含 T3.8a） | PASS | 死 MCP url → 宿主 exit 1 loud fail（ECONNREFUSED 根因行） |
| T1.1 全新 home 启动 | PASS | 4 行挂载、health gate ok、toolCount=10；blueprint `domain` slug 契约发现（scaffold 修正） |
| T1.2 G1 观察 | PASS（+2 边缘记录） | fresh-home 零 turn root "以 Team 模式打开"=静默 no-op 复现成立；边缘 A（无 durable artifact → typed `NO_DURABLE_ARTIFACT`）、边缘 B（session live 但 team 未绑定 → `START_FAILED`，无恢复分支） |
| T1.3 基线工具清单 | PASS | 标准会话 27 工具 = B0 26 + `mcp__dtesthttp__ping`，team_*=0（N-a 边界）；`baseline-inventory.json` 落盘 |
| T1.4 UI 新建团队 | **FINDING（记录）** | 含必需非 persona 需求（mcp）的蓝图，UI 创建路径结构性不可达（预创建探针只吃 persona fact → unmet 强制 FATAL 不可降级）；用户裁决仅记录；R1 余项改由 directive root 承载并 PASS |
| T2.1 list_templates | PASS | 3 模板（leader/worker/collector），persistent |
| T2.2 create_member ×2 | PASS | W1/W2 激活，确定性 instance id + child session；成员 identity 块逐字 ✓ |
| T2.3 delegate 首工作 | PASS | work/alpha.md 哨兵逐字落盘（93B）；成员面 37 = 26+10+1（无 facet mcp，fail-closed ✓） |
| T2.4 follow_up | PASS | work-admitted fromLifecycle SETTLED，追加成功，同 child session |
| T2.5 send_message | PASS（OBS） | 送达 wire = `delivered/factSequence/deliveredSequence`（计划误把 memberResult 形态安给本工具；该形态实属 delegate/follow_up） |
| T2.6 report_progress | **BLOCKED-by-F3** | 3/3 挂起指纹（合法参数→无返回无落账→root 死锁；非法参数→typed 拒绝）；按裁决不修复 |
| T2.7 list_members | PASS | 与实况一致（RUNNING 残留 OBS） |
| T2.8 inspect_config | PASS | effective 全 deny（无定向覆盖，与真值一致） |
| T2.9 错误矩阵 a–e | PASS | a label 寻址拒 / b 缺参拒 / c token 复用=幂等重放（OBS）/ d target-stale / e T1.3 覆盖 |
| T2.10 archive/restore | PASS | UI lifecycle 全链 + `LIFECYCLE_ILLEGAL_STATE`（CREATED→ARCHIVED 非法）+ 恢复回 SETTLED |
| T2.11 第 5 成员 quota | **F4（语义澄清）** | `maxInstances` = **per-template** 非全局（worker 第 5 实例 `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES` typed 拒绝）；计划文案按全局写错预期 |
| T3.1 facet fail-closed | PASS | 双轨：宿主 dtesthttp 在、facet dtest-mini 默认拒（37 面） |
| T3.2 GUI override | PASS | per-member override 编辑器（mcp/allow/dtest-mini）→ 域记录 g0 + "Pending next boundary" |
| T3.3 下一边界挂载 | PASS | W2 面 38（+1）；`mcp__dtest-mini__ping` → pong；W3 同批 37（per-instance 作用域 ✓） |
| T3.4 卸载 deny | PASS | g0 保留 + 新增 g1 deny；下 turn 面 37 |
| T3.5 重置 | PASS（OBS） | 语义 = 逐条回退 undo 栈（非一次归零）；0 记录后 Inherited 重算 |
| T3.6 hard-policy lane | 部分（空态） | 无外部 facts 时空 lane ✓；facts 在场核查由 T4.7b 承接 |
| T3.7 宿主 MCP 三类会话 | PASS | leader/W1/W2 各 1 次 ping 全通 |
| T3.8b kill/reconnect | PASS（scaffold 扩展后） | 宿主行：kill→`Error: fetch failed`→重启自动重连 `pong:t38b-recovered`；facet 行：kill→follow_up typed `WORK_DELIVERY_FAILED` + 账本 `delivery-failed`→重启后下一边界自动重挂 `pong:t38b-facet-recovered` |
| T4.1 user-approval 全链路 | 请求半程 **PASS** / allow 半程 **BLOCKED-by-F9** | 请求 admitted pending + UI 三处"待裁决"呈现；allow 半程因 F9（无人类裁决通道）不可执行 |
| T4.2 resolver 角色闭包 | PASS | leader 裁决 user-approval → `CONTROL_RESOLVER_NOT_AUTHORIZED (allowed: [human])`，零副作用 |
| T4.3 leader-approval 全链路 | PASS | allow → 越界 write → 宿主 sandbox 拒 → 升级审批（"等待审批"+允许一次）→ `probe-w1b.txt` 逐字落盘 |
| T4.4 deny 路径 | PASS | deny → 同 correlation follow_up 43ms `blocked/decision-deny`，runtime 未调用 |
| T4.5 exactly-once | PASS | allow → 第一次执行 + `control-allow-consumed` fact；第二次 42ms `blocked/allow-consumed` |
| T4.6 自升级禁止 | PASS | member 裁决自己请求 → `CONTROL_RESOLVER_NOT_AUTHORIZED (allowed: [leader, human])`（角色闭包先于 envelope） |
| T4.7a external hard policy | PASS | hard deny 下 allow → `CONTROL_EXTERNAL_POLICY_DENIED`（capability 'tools'），durable deny（reason=external-policy）先行落账；重试 → `CONTROL_REQUEST_DECIDED`（首裁决权威） |
| T4.7b UI 外部策略语义 | PASS | ledger 行 `deny · external-policy`（data-decision/data-ledger-state-reason 徽章）；非"审批失败"非成功 |
| T4.7c 纯协调对照 | PASS | send_message 无控制 scope → delivered（hard policy 只 gate allow 裁决） |
| T4.7d | 跳过（optional） | 注入 facts 无 mcp 条目，无可断言对象 |
| T4.8 DSH approval lane | 环境注记 | 宿主策略非 permissive → 实测"出现审批提示"分支且功能有效（非 fail） |
| T5.1 F5 页面刷新 | PASS | 整页 reload 后 Team tab/成员组/治理/ledger（含 external-policy 行 + 等待裁决徽章）全恢复 |
| T5.2 boot#8 冷复活 | PASS | child session id 与确定性 instance id 跨重启不变；工具面复证（W1 37 / leader 11，boot#8 进程内新请求）；持久记录恢复；follow_up 全链路 1.6s |
| T5.3 | = boot#7 已执行 | T4.7 组 + hard facts 注入（durable 痕 seq 114） |
| T5.4 team_domain 持久化 | PASS | 文件存在（106KB，8 tables）；dtestp6 行集与 UI 一致（6 requests/5 decisions/1 consumed/2 progress） |
| T6.1 哨兵业务任务 | PASS（1 项 F3 偏离） | leader 三步编排（W1 哨兵写 / W2 总结写 / W2 汇总落盘），全部 executed + settle |
| T6.2 断言 | PASS（UI ledger 区受 F11 影响） | 磁盘三产物逐字 ✓ / durable 时间线 125–136 完整 ✓ / UI 成员态收敛 ✓ / leader 回报全路径 ✓ |
| T6.3 sentinel durable 痕 | PASS | W1 持久日志含哨兵逐字串 34 次 |

## 4. 发现清单（均仅记录、未修复）

### F2 — 非 directive root 冷恢复后丢失 leader 面（P2 前置）
宿主重启后，旧（非 directive）团队 root 经 UI 按需冷恢复时，其会话以**标准 base 面**运行（27 工具，team_*=0），leader 面/团队绑定丢失；而团队 UI 仍显示持久化的"leader · 1 活跃 / 运行中"（陈旧状态与实际 agent 面脱节）。后果：旧 root 不可作为运营团队（P2–P6 因此改在 directive root / 新团队执行）。

### F3 — 成员 `team_report_progress` 非确定性挂起 → root 死锁（4+1 数据点）
- 指纹（3 次挂起）：参数**非法** → 立即 typed `TEAM_TOOL_BAD_ARGUMENTS`（校验路径正常）；参数**合法**（提交 ledger 路径）→ **无限挂起**：无 tool/result、无 ledger fact、无域更新，成员 turn 永不 end → leader 的 delegate/follow_up 同步等待 member settle → **整个 root 死锁**（后续 queue 提示全部排队）。
- 三种上下文均触发（follow_up turn ×2、delegation 新工作 turn ×1，含模型自发调用 ×1）。
- **本次新数据点（P6 期）**：W2 于 21:15 在 relay turn 中自发调用 2 次（in-progress → completed）**均正常返回并落账**（seq 117/118），turn 正常结束 → F3 修正为**非确定性挂起**（3 挂起 vs 1 成功），仍维持运营禁令（成员提示词逐字携带"本轮禁止调用 team_report_progress 工具"）。
- 推论（记录为止）：activity ledger 提交与 leader 工作准入关键区在同一 per-team 串行链上互相等待。

### F4 — quota 语义 = per-template（计划文案偏差）
`members.maxInstances=4` 按**模板**执行（每个 member template 各限 4 实例），非全队总量。消歧探针：worker 第 5 实例 `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES`（typed + 零副作用）。机制正确，计划 T2.11"全局第 5 成员拒绝"预期写错。

### F5 — UI 状态需整页 reload 才收敛（多实例）
团队视图（ledger/成员态/治理）在持久化事实推进后不实时收敛；整页 reload 后恢复。实例：T5.1（全量恢复 ✓）、T2.10（归档后需 reload 同步）、**T6 新增**：W2 两次 work-settled（13:27:53/13:28:32）后 UI 仍显示"已创建"（滞后跨越 2 次 lifecycle 变更），重载后收敛为"已结算"。

### F6 — 成员 envelope 缺 request-control（scaffold 蓝图配错；产品行为正确）
dtest-bp 原 member envelope allow 仅 `[send-message, report-progress]` → P4 全部 control 流前提不成立；envelope 门 fail-closed 行为本身验证通过（`TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS` typed + 零副作用 + 模型忠实停止）。处置：boot.mjs 蓝图源补 `request-control`/`resolve-control`（scaffold 调整，留痕）。

### F7 — 团队绑定蓝图快照不可变（产品不变量）
蓝图源在团队存续期变更（revision 不变）→ 首次 work-admission typed 拒绝 `TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH`（bound vs resolved contentHash）；语义 = 已绑定团队的蓝图内容不可中途变更，变更只对新建团队生效。typed、零副作用、turn 正常结束。本战役旧世界冻结的直接原因（环境性后果，已按 F8 修正重建新世界）。

### F8 — 成员有效 envelope = teamEnvelope.allow ∩ memberTemplateAllow（数据模型语义）
`packages/runtime/admission/envelope.ts`：仅给 member 模板加 op 无效（团队 allow 不含时被交集裁掉）；减 deny、再减 instance autonomy overlay。本战役 dtestp4 配错根因；修正后新世界全链路正常。产品行为一致且 fail-closed，无缺陷。

### F9 — user-approval 请求无人类裁决通道（产品缺口）
三证：(a) 客户端对 control request 仅**只读**呈现（member card "N 项待裁决" / TeamDock 计数 / ledger "等待裁决" badge），无 decision 提交 UI；(b) 宿主 remote 方法闭集（create/admitInitialWork/ensureRootLive/listRoots/getProjection/getLedgerPage）**无 control resolve**；(c) `team_resolve_control` caller 恒为调用方 instance，而 `user-approval → ['human']` 仅 human 可裁决。后果：pending user-approval 请求（`ctrl-064wd6o1ft4y810lq7zvy07u`）在世界内**永不可裁决**，T4.1 allow 半程不可执行；该请求作为 F9 残留留档。

### F10 — last-mile guard 架构语义（澄清，非缺陷）
`executeGuarded` 仅包裹 4 个受管 team work 操作（delegate / follow-up / send-message / report-progress），scope = {root, targetInstanceId, actionName, toolName, **correlation=该调用的 requestToken**}（请求 token 即关联）。verdict：`allowed` → 执行且 **CONSUMED**（check-and-reserve，exactly-once）；`no-request` → **放行**（文档化偏离 blanket block，保 leader 日常自治）；其余（request-pending / decision-deny / request-stale / allow-consumed / scope-mismatch / target-stale）→ fail-closed `{status:"blocked"}`，runtime 永不调用。base 工具（write 等）不经此 guard（宿主 file sandbox 为独立前置闸）——T4.3 中 allow 未消费、物理路径走 base write + sandbox 升级即此语义的实证。

### F11 — ledger UI 静默截断：完整性判据单位错配（本战役新发现，代码级确认）
- **schema 事实**：`ledger` store 为**单一全局序列空间**（`packages/storage/schema/ledger.ts`：counter 行 `__ledger_sequence_counter`="最高已分配序列"，事实行 key=`String(sequence)`；本 home 实测跨 root 连续：旧 root 1–64 / dtestp4 65–68 / dtestp6 **69–136**）。
- **契约事实**：`team.getLedgerPage` 返回 `total` = **per-team 条目计数**（`packages/remote/src/handlers/team.ts` L384 `countEntries(teamSessionId)`；contracts 注释 "total fact-entry count"）+ cursor `nextAfterSequence` = 末条 sequence。
- **判据错配**：`packages/client/src/state/team-ledger-store.ts` L246 `nextComplete = total !== null && frontier >= total`——frontier 是**全局序列数值**（最高已载入），total 是**条目计数**，单位混比。dtestp6：首页 50 条（seq 69–118，cursor 118，total 68）→ 118 ≥ 68 → catch-up 当页即止，**剩余 18 条（119–136）永不拉取**。
- **静默性**：snapshot 模型同一比较（`team-ui-snapshot.ts` L283：`completeThrough < total` 才为 partial）→ 判定 `completeness='complete'` → partial/剩余计数指示器不渲染 → **截断无任何 UI 提示**。
- **触发条件**：任何"序列首值+49 ≥ per-team 条目数"的团队——即 home 中**非首个团队且条目 >50 时必然**；首个团队（seq 从 1 起）不受影响。
- **实测**（boot#8）：重载后仅 1 次 getLedgerPage 请求；UI 末行止于 21:15:14（seq 118），而 durable ledger 末 fact = seq 136（21:28:32）；T6 任务 12 条 facts（125–136）UI 不可见。
- **影响面**：团队事件面板 + 一切"已知完整 ledger"门控的 UI（按 plan §7.3，pending 徽章等由完整 ledger 推导）在多团队 home 中对非首团队系统性失真。

### 环境事件 — boot#7 重启事故（kill→立即重启同 root 的 live 冲突）
kill boot → 立即重启同 root：宿主先把被 kill 时 open 的会话 revive 为 live → 团队插件 `prepare` 冲突（`cannot prepare session "…" while it is live`，PersistenceCoordinator.prepare）→ bootstrap FAILED → 退出时宿主把已 revive 会话干净 retire（`session/end-seed` 落账）→ **重试一次即成功**。操作规则：**kill 后立即重启同 root 可能撞 live；失败后重试一次即可**。G1 边缘 B（T1.2 点击 3）为同族语义缺口（ensure 路径对"session 已 live 但团队绑定缺失"无恢复分支）。

### T1.4 — UI 建团路径结构性阻断（蓝图含必需非 persona 需求时）
预创建探针为纯域探针且客户端只构造 persona fact → 缺失 fact 视为 available:false → 蓝图非 optional 需求映射 `complete:true` → unmet = 强制 FATAL 不可 ack → **含必需 mcp 类需求的蓝图，UI 创建按钮永久 disabled**（"需求 req-mcp-dtest-mini — complete:true requirement unmet: dtest-mini (structural FATAL, not downgradeable)"）。directive/row 路径不受影响（row prober 用 row 声明 facts）。catalog 闭集（仅 row 绑定蓝图）与快照不可变（F7）排除了常规绕过。**用户裁决：仅记录。**

### OBS 汇总（均仅记录）
1. send-message wire 形态与计划文案不符（memberResult 实属 delegate/follow_up）。
2. token 复用：读操作不消费照常执行；变更操作 = 幂等重放（`replayed:true`，零副作用）。
3. 成员 lifecycle=RUNNING 可跨宿主重启残留（F3 挂起工作的域状态不归位）。
4. progress 合法枚举 = in-progress / completed / blocked（计划用词 "done" 偏差）。
5. T3.5 reset 语义 = 逐条回退 undo 栈（计划假设一次归零）。
6. 每 turn 上下文仅首次落 tools 数组（后续 turn 不落 log——取证时需以最近模型请求为准）。
7. 治理区"审查"按钮 playwright click 超时（UI 交互问题，不影响断言）。
8. ledger 面板 `total===0` 空态吞掉 tracker 错误提示（错误提示只在 total>0 分支渲染，TeamLedger.tsx）。
9. 旧 dtestp4 团队 ledger 仅 4 条（seq 65–68，域真值如此，非截断）——与 F11 无涉。
10. domain compatibility 行 computedAt 与 UI "最后探测于" 时间戳口径可能不同（无功能影响）。
11. T2.9b 超长 label 变式：leader 面无 base 工具无法构造 10000 字符参数，模型自行计数拼串耗尽 turn → MODEL-NONCOMPLIANCE（非 FAIL）。
12. T3.8b "activation error 记录" 实测形态 = 类型化投递失败工具结果 + 账本 `delivery-failed` fact（无独立 activation-error 对象）。
13. :3180 `dsh web` 实例（TEST_METHODS home `references/.dsh-test`）于 13:05:37 由 explorer→交互式 powershell 启动，非本战役基础设施——保持运行、未触碰。
14. T6 期间 W2 UI 状态滞后 2 次 lifecycle 变更（F5 实例，见上）。

## 5. T6 端到端业务整合（哨兵任务）详情

**任务**（计划逐字，经 root API 投递至 leader，仅 1 处 F3 偏离修正）：读 `fixtures/requirements.md`；① W1 把 `fixtures/sentinel.txt` 内容**逐字**写入 `work/alpha.md`；② W2 用工具读 `fixtures/seed-note.txt` 并总结写入 `work/summary.md`；（偏离：原"各 report progress 一次"→ 逐字携带"本轮禁止调用 team_report_progress 工具（在回复文本中说明进展即可）"）；leader 汇总 `work/final.md`（含两路径 + sentinel 原文 + W2 要点）。

**执行链**（leader t21 三步编排，durable seq 125–136）：
| 步骤 | 工具 | 目标 | token | 结果 |
|---|---|---|---|---|
| ① | team_follow_up | W1（inst-1yabcoe00jed） | t52-w1-alpha-1 | executed → work-admitted 125 → interval 126/127 → **SETTLED 128** |
| ② | team_follow_up | W2（inst-0zb3tna1drgr） | t52-w2-summary-1 | executed → 129（首工作，from CREATED）→ 130/131 → **SETTLED 132** |
| ③ | team_follow_up | W2 | t52-w2-final-1 | executed → 133 → 134/135 → **SETTLED 136** |

**磁盘 ground truth（UTF-8 逐字核验）**：
- `work/alpha.md`（94B）= sentinel 逐字（93B 正文 + LF）：`DTEST-SENTINEL-20260907-7f3a-k9v2 :: the quick brown fox jumps over the lazy dog (0123456789)`；W1 自报 SHA256 `D895A205…B1838F67` 与源文件字节一致（match=True）。
- `work/summary.md`（673B）：W2 对 seed-note.txt 4 条事实的完整总结（部署环境 / MCP 双端点各 1 ping 工具 / Blueprint worker+collector 配额 4 / 外部硬策略优先级最高）。
- `work/final.md`（1373B）：含两产物路径（相对 + 绝对）、sentinel 逐字、W2 要点、W1 核验记录。

**断言**：磁盘 ✓；durable 时间线 ✓（12 条 facts 完整链）；UI 成员态 ✓（重载后 leader 运行中 / W1 已结算"1 项待裁决"=F9 残留 / W2 已结算）；leader 回报 ✓（t21 最终消息逐字报告全部确切路径 + sentinel + SHA256 + F3 条款遵守）；**UI 团队事件区 ✗（F11 截断：仅渲染至 seq 118，T6 的 12 条 facts UI 不可见——durable 完整，仅 UI 面失真）**。哨兵在 W1 持久日志出现 34 次 ✓（T6.3）。

## 6. 合规与拆机

| 项 | 结果 |
|---|---|
| 产品代码修改 | **0**（全部发现仅记录；无 fix、无 patch、无 upstream 触碰） |
| 仓库 tracked 文件 | 0 变更（战役期 T0.1 曾向 `.gitignore` 追加 tests/mock 忽略规则 3 行，**拆机时已还原**）；HEAD = `3f06525`（= origin/master，**未推送**） |
| test-use 树 | `references/deepseek-harness-test-use` @ `a66e4702`，porcelain 0（clean） |
| 稳定部署 `:3080` / `D:\deepseek-harness` | 未触碰（拆机时 listener pid 11676 运行中） |
| 其他进程 | PilotDeck 进程树、:3180 交互式 dsh 实例（外部启动）均未触碰（留痕 OBS-13） |
| 端口 | 3181 / 3491 / 3492 全部释放，无孤儿进程 |
| API key | 全程未打印、未落盘（仅宿主经 ref 读取） |
| Playwright | session `mocktest` 已关闭 |
| scaffold 扩展（允许项，逐项留痕） | `boot.mjs`（directive/开关/蓝图源修正 F6/F8）、`mini-standalone.mjs` + `MOCK_EXTERNAL_MINIS`（T3.8b 拓扑）、取证脚本族（dump/log-tail/log-tail-raw/tool-lines/call-result/call-args/domain-member-record/hash-blueprint/control-decision/control-facts/t5-*/t6-*/last-tools/last-assistant-text） |

## 7. 证据索引

| 类别 | 位置 |
|---|---|
| 全程执行日志（逐任务证据链） | `tests/mock/evidence/NOTES.md`（259 行） |
| Playwright 快照 | `tests/mock/state/teamtab-snap*.yml`（snap9=T4.7 ledger / snap10=T5.1 重载 / snap11=T5.2 boot#8 / snap12=T6.2 终态）+ `snap.txt` 系列 |
| 截图 | `tests/mock/evidence/screenshots/`（T1.2 G1 四张 / P2 旧 root base 面 / 等） |
| 业务产物（磁盘 ground truth） | `tests/mock/work/{alpha.md, summary.md, final.md}`；`tests/mock-outside/probe/probe-w1b.txt`（T4.3 审批链产物） |
| 域真值 | `tests/mock/.dsh-home/storages/team_domain.json`（8 tables；dtestp6：68 ledger facts / 6 requests / 5 decisions / 1 consumed / 2 progress / 0 overrides） |
| durable 日志 | `tests/mock/.dsh-home/sessions/*/{session.jsonl.zstd}`（root / W1 / W2 + 历史世界） |
| 取证脚本 | `tests/mock/scripts/`（zstd 多帧解析 + 域查询 + 控制面事实提取） |
| 基线清单 | `tests/mock/state/baseline-inventory.json`（B0=26 / member 37 / leader 11 预期） |
| 计划 | `docs/plans/active/TEAM_DTEST_WORKSPACE_PLAN.md` |

---

*报告完。全程遵循"仅记录、不修复"裁决；全部发现与偏离均可经上述证据链复核。*
