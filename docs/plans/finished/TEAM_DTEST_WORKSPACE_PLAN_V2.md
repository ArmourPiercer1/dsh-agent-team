# tests\mock Team 全功能测试计划 V2 —— bug 修复后回归 + 提速执行版

日期：2026-09-07 ｜ **状态：已归档｜仅完成 P0 T0.2/T0.3 资产冒烟；正式回归未执行，计划中途停止/归档。**  
**真正执行进度：** 全部 §6 脚本已建并通过语法与冒烟；冒烟使用 round-1 存量 home/dist，明确不构成产品回归结论。由于产品修复前置条件未满足，未启动 §0–§5 正式回归、未产生 REPORT-V2.md，也未宣称回归通过。  
**归档时间：** 2026-09-07T14:50 UTC（NOTES-V2 P0 收尾）。  
**归档原因：** P0 资产准备完成，但正式回归所需的产品 BUG 修复、fresh home 与回归范围裁决未完成；因此按“只验证脚本正常、不虚报产品结论”的用户口径停止。  
**冒烟口径**（用户裁决"修复未开始，只要测试脚本正常即可"）：存量 `.dsh-home` + round-1 未修复 dist + 沿用 API key，仅验证脚本自身正确性（消耗 3 个"OK"微 turn），**不构成任何回归结论**。正式回归待下一轮 BUG 修复完成后按 §0–§5 拉起（fresh home + 新 dist + 回归范围裁决）。
上位文档：`TEAM_DTEST_WORKSPACE_PLAN.md`（V1，已执行完毕；round-1 结果见 `tests/mock/evidence/REPORT.md`，已随 `9b582a1` 推送）

## 0. 定位与红线

**定位**：V2 = **回归验证 + 补完**轮。产品侧完成 round-1 findings 的 BUG 修复后，本轮目标：
1. **逐条回归** round-1 的 9 项 finding（§3 回归判据表）；
2. **补完** round-1 两个 blocked 任务：T2.6（report_progress，blocked-by-F3）与 T4.1 allow 半程（blocked-by-F9 人类裁决通道）；
3. **复跑** P1–P6 全矩阵（结构照 V1，执行方式按 §2 提速重构）。

**继承红线（与 V1 相同，无变化）**：
- 产品代码**零修改**、只记录不修复（回归失败 = 新 finding，同样只记录）；不 push（用户单独授权除外）。
- 不触碰 `:3080` / `D:\deepseek-harness`；`references/deepseek-harness-test-use` 保持 pristine（本轮基线沿用 `a66e4702`，除非用户改判）；API key 永不打印。
- 执行模式 = **Playwright 全自动**；宿主 file policy = **workspace-write**；模型 = **qwen3.8-27b 真实模型**。

**前置条件（用户侧，拉起跑前）**：
- 产品 BUG 修复完成（本仓库 `packages/*`，含 dist 重建，经 freshness gate）；
- 明确本轮回归范围（哪些 finding 已修、哪些明确不修——不修者本轮只复核"行为未变"）；
- fresh DSH_HOME 重建（`.credentials.yaml` ref 重新写入或由 boot 脚本从用户提供的 ref 落盘）。

## 1. 环境（继承 V1 §1/§2，差异项）

工作区布局、cordis 5 行挂载、双 mini-MCP（3491 facet `dtest-mini` / 3492 宿主 `dtesthttp`）、端口 3181、模型路由——**全部沿用 V1**（`boot.mjs` 已是 round-1 末态）。差异项：

| # | 差异 | 说明 |
|---|---|---|
| D1 | **workspace 注册表预置** | `boot.mjs` 新增 `MOCK_PRESEEDED_WORKSPACES=1`（默认开）：boot 前把 `storages/workspace.json` 置 `initialized:false` 并由首启按 session header 一次性 bootstrap（round-1 T1.2 手工改文件 + root 轮转的 ~15min 绕行消除；root 不再轮转，G1 观察直接用 create-phase 零 turn root） |
| D2 | **boot 收尾自动化** | `boot.mjs` 收尾自动完成：token-303 换 cookie → 落 `state/cookie-header.txt` → `{}` 探针验证 → 输出 `BOOT_URL` + playwright 导航命令序列（round-1 手动 4 步 + 偶发 401 重换 → 0） |
| D3 | **known-good 蓝图** | `dtest-bp@1` 沿用 round-1 **F8 修正后**版本：`memberEnvelope`（worker/collector）allow = `[send-message, report-progress, request-control, resolve-control]`；`teamEnvelope` allow = `[assign-task, create-member, send-message, report-progress, archive-member, restore-member, request-control, resolve-control]`；`requirements[].domain: mcp`（小写 slug 契约）。round-1 踩过的坑（F6/F8/domain-slug）不再重踩 |
| D4 | **F3 防护条款常备** | 所有成员 prompt 默认携带"本轮禁止调用 team_report_progress 工具（在回复文本中说明进展即可）"；**唯一例外** = §4 P2 的 F3 canary（T2.6a，带 180s watchdog） |
| D5 | **turn watchdog 纪律** | 每个模型 turn 投递后跑 `scripts/wait-turn.mjs <log> <turn> <timeout=180s>`：超时 = hang → 记 finding（附指纹：末行 call/无 result/无 turn-end）→ kill + wait-end-seed + 重启（round-1 配方）。watchdog 同时是 F3 回归的探测器 |
| D6 | **kill→重启配方固化** | kill boot 作业 → 直接重启；**撞 live 冲突**（被杀会话处于 open 态：新进程 revive 与 team prepare 冲突）→ 跑 `wait-end-seed.mjs` 确认失败进程已 retire 会话（追加 `session/end-seed` 边界行，~秒级）→ 重试一次。**idle 态 kill 预期首次成功**（= R-B7 断言）。语义注意（2026-09-07 scratch 冒烟澄清）：`session/end-seed` 由**新进程** revive/retire 时写入（upstream session.md "The end-seed boundary"），被杀进程关机时不写——**不得在重启前等待 end-seed**（force-kill 场景前置等待必然超时） |

## 2. 提速设计（round-1 实测 320min → 目标 150–190min）

### 2.1 boot 拓扑：3 次（round-1 为 8 次，其中 5 次事故驱动）

| boot | 配置 | 承载 |
|---|---|---|
| **#1 create（plain）** | 新 nonce，hardTools=false | P1 → P2（含 F3 canary + 错误矩阵）→ **R6 E2E 前移** → P3 → P4 常规（T4.1–T4.6/8，含 F9 回归）→ fixture 填充（§5，放 P3/P4 间隙） |
| **#2 resume（hardTools=true）** | 同 root，注入 `externalPolicyFacts.hard.tools=deny` | T4.7a–c（external hard policy）→ G4 gate |
| **#3 resume（plain）** | 同 root，hardTools 关 | P5 checkpoint（T5.2/T5.4）→ R-F2 / R-F11 回归 → 拆机 |

**P5 不是 phase，是 boot#3 开场的 checkpoint**（round-1 boot#8 已验证该形态：确定性 id / 工具面 / 持久记录恢复用只读探针 2 分钟内完成）。boot#1→#2 与 #2→#3 的两次 kill 各承担一个 R-B7 回归观测点（D6 配方，断言首次 boot 成功）。

### 2.2 turn 批量化与账本

**账本口径**：每个触发成员工作的 leader 调用都带**成员 turn 对偶**（产品语义不可省——成员工作在成员会话执行）；可批量化的是 **leader 侧调用成组**（round-1 T6.1 已验证：leader 单 turn 连发 3 个 follow_up 全成功；枚举式子案例指令遵守率 100%）。

实际账本：**实质性模型 turn ≈ 43**（round-1 约 50，其中 ~8 个是 F3 恢复/再验证浪费）+ **fixture 微 turn 15 个**（仅"请只回复 OK"，~30s 每个，§5）。模型等待墙钟 ≈ 43×90s + 15×30s ≈ **72min（硬地板，真实模型推理不可压）**。

leader 侧批表（相对 round-1 的 leader turn 数）：

| 批 | 内容 | round-1 | V2 |
|---|---|---|---|
| B1 | T2.1 list_templates + T2.2 create W1/W2（+ identity 块断言） | 3 | **1** |
| B2 | T2.7 list_members + T2.8 inspect_config | 2 | **1** |
| B3 | T2.9 错误矩阵 a–e + T2.11 quota = **6 子案例单 turn**（逐字枚举） | 6+ | **1** |
| B4 | P4 成员请求批：W1 单 turn 连发 4× request_control（user-approval 1 + leader-approval 2 + 自升级 1）；**自升级子案例在成员 turn 内闭环**（request 后立即自 resolve → 预期 NOT_AUTHORIZED） | ~5 | **1** |
| B5 | P4 leader 裁决批：单 turn 连发 4× resolve（T4.2 越权裁决 user-approval→拒 / T4.3 allow / T4.4 deny / T4.5 复用已消费 token） | ~4 | **1** |
| B6 | T4.7a：W1 request（1 leader+1 W1）→ leader 单 turn：resolve allow（预期 EXTERNAL_POLICY_DENIED）+ 重试（预期 REQUEST_DECIDED）+ send_message 纯协调对照（T4.7c） | 3–4 | **2** |
| B7 | 工具面复证：并发 API prompt 全部 live 团队会话（"请只回复 OK"）→ 各 log turn/end 后并行 last-tools 断言 | 串行 2+ | **1 墙钟 turn**（`suite-face-verify.mjs`） |
| B8 | R6 E2E 本体（round-1 实测 ~2min 含 3 工作流） | 不变 | 不变 |

### 2.3 验证并行化（每 phase 结束一次，三并发，全只读）

- `scripts/forensics-batch.mjs`：tool-lines / call-result / log-tail / 域查询并发；
- `scripts/suite-domain-diff.mjs`：`team_domain.json` 事实 vs 本 phase 预期事实清单（JSON 声明式）；
- `scripts/suite-ledger-complete.mjs`：经 cookie 调 `team.getLedgerPage` 逐页至 cursor=null，断言 `Σ条目 == total` 且尾部 seq 与域一致（**F11 的服务端/客户端完整性检查**，见 §3 R-F11）。

### 2.4 UI 降频为 5 个 gate（round-1 每 op 查一次）

| gate | 时机 | 内容（`scripts/ui-gate.mjs <label>` 一趟完成：goto→选 root→团队 tab→成员态/ledger 尾行/治理区断言→快照） |
|---|---|---|
| G1 | boot#1 + P1 后 | 基线：会话树、G1 零 turn root 行为、T1.3 面、**R-T14 UI 建团（= team B 创建）** |
| G2 | R6 E2E 后 | 成员 settled、磁盘产物旁证、**F5 无 reload 收敛检查**（先不 reload 断言，未收敛才 reload 并记 F5 路径） |
| G3 | P4 常规后 | pending 徽章/裁决详情（R-F9 呈现）、ledger 控制行 |
| G4 | boot#2 T4.7 后 | external-policy 行语义（round-1 T4.7b 断言集）+ F5 检查 |
| G5 | boot#3 收尾 | P5 恢复项、**R-F11 UI 半程**（team B ledger 尾行可见）、R-F2 UI 半程（打开 team B）、终态 |

定点 UI 探针（不等 gate）仅 3 处：T3.2/3.4/3.5 override 编辑器操作、T4.1 人类裁决点击（R-F9）、T2.10 archive/restore 行操作。

### 2.5 E2E 前移

R6（T6 哨兵任务）从 P6 末位前移到 **P2 之后、P3 之前**（同 boot#1、同世界）：E2E 只依赖"团队能干活"，先跑 fail-fast；P3 override / P4 控制流会改变世界状态（round-1 的 T4.1 pending 残留带入 T6 即为噪声）。T6 提示词按 F3 canary 结果双轨（§4）。

## 3. 回归判据表（round-1 findings → V2 任务）

| ID | round-1 结论 | V2 回归任务 | PASS 判据 | FAIL 行为（仅记录） |
|---|---|---|---|---|
| R-F2 | 非 directive root 冷恢复丢 leader 面（UI 仍显示 leader 活跃，实际 base 面 27 工具） | boot#3：UI 打开 **team B**（非 directive root）→ 冷复活 → team B leader 发 1 turn（"请只回复 OK"）→ durable log last-tools | 面 = 10 team_* + mcp（11 工具）且 UI 成员组/徽章与实际一致 | 记回归失败 + UI/面不一致证据；team B 后续断言降级为 durable-only |
| R-F3 | 成员 team_report_progress 非确定性挂起（3 挂 vs 1 成功）→ root 死锁 | **T2.6a canary**（P2 首个成员任务，1 次 report_progress，180s watchdog）；PASS 后 T2.6 全量（completed + UI 活动与进度 + ledger 落账） | canary：tool/result 返回 + `progress-recorded` fact + turn 正常 end（180s 内） | 记回归失败（附指纹）→ D6 恢复（消耗 ~10min 封顶）→ 全轮启用 D4 禁令，T2.6/T6 按"blocked 复核"记录 |
| R-F5 | UI 状态需整页 reload 才收敛 | G2/G4/G5 各做一次"先不 reload"断言 | 无 reload 下成员态/ledger 尾行收敛 = 修复成立；需 reload 才收敛 = 记"未修/部分修"（两者都继续，reload 为 fallback） | 记录收敛路径（不阻断） |
| R-F9 | user-approval 无人类裁决通道（client 只读 + 无 host resolve 路径；resolver=['human']） | **T4.1 allow 半程**：G3 前 UI 打开 pending user-approval 详情 → 执行人类 allow → 成员 guarded write 放行（经 DSH 审批 lane 允许一次）→ 落盘 + `control-allow-consumed` | 存在可用的人类裁决 UI 且全链路执行落账 | 记回归失败；请求保持 pending（round-1 同态）；T4.1 半程结论同 round-1 |
| R-F11 | ledger UI 静默截断（store 完整性判据 `frontier>=total` 单位错配；非首个团队且 >50 条必现；partial 指示器被 `complete` 判定抑制） | 双半程：**API**（`suite-ledger-complete.mjs` 对 team A/B 逐页至尾，Σ==total）+ **UI**（team B 为 ≥50 facts 的 fixture 团队，G5 断言其 ledger 渲染 durable 尾行） | 两半程均过 | 记回归失败；附截断证据（渲染尾行 vs durable 尾 seq） |
| R-T14 | 含必需非 persona 需求的蓝图 UI 建团结构性阻断（预创建探针只吃 persona fact → FATAL 不可降级） | G1：经 UI 以 `dtest-bp@1`（含 `mcp` 必需需求）建 **team B** | 创建成功 + team B root 入会话树 + 可打开 | 记回归失败；fallback = 第 4 次 directive boot 建 team B（额外 boot，拓扑 3→4），fixture 用简化蓝图 |
| R-B7 | kill→立即重启同 root 撞 live 冲突（bootstrap FAILED，重试成功） | boot#1→#2、#2→#3 两次过渡：D6 配方（kill→重启；撞冲突时 wait-end-seed→重试一次） | **两次均首次 boot 成功**（idle 态 kill） | 记回归失败 + 重试（配方不变） |
| R-F4/F7/F10 | 语义澄清（quota per-template / 蓝图快照不可变 / guard 4-op 包裹）——round-1 判定机制正确 | 随矩阵复跑自然覆盖：B3 的 quota 子案例（typed `…_TEMPLATE_INSTANCES`）、错误矩阵、T4.5 exactly-once | typed 结果与 round-1 指纹一致 | 行为变化 = 新 finding（记录） |

## 4. 任务清单（V2）

> 判据约定继承 V1 §3：模型非确定性——"模型应调用某工具"类断言以 durable log 为准；提示词重试 ≤3 次后记 MODEL-NONCOMPLIANCE（非 FAIL）。turn 总账见 §2.2（实质 ~43 + 微 15）。

### P0 — 前置（拉起跑前，~20min）✅ 已完成（2026-09-07，见 NOTES-V2 P0 节）
- **T0.1 构建核验**：本仓库 `pnpm build`（或 freshness gate 直过）→ dist 新鲜；test-use 树 clean @ 基线；API key ref 就位。
- **T0.2 干跑**（沿用 V1，含死 url loud-fail 负向）：boot → health gate（ok/toolCount=10）→ row dump → 拆机。✅（scratch home 干跑 + 存量 home resume 干跑，两次均含 D1/D2/D6 验证）
- **T0.3 资产冒烟**：§6 全部"待建"脚本语法 + 空跑（干跑宿主上各跑一次）。✅（10 脚本 `node --check` + 全量实跑；暴露并修复 10 项脚本缺陷 OBS-1..10）

### P1 — 启动与基线（boot#1；2 turn）
- **T1.1**：boot#1 → health + boot-state + **G0 pre-flight**（`preflight-check.mjs`：envelope 交集 dump 确认 request/resolve-control 在集、blueprint hash 绑定校验、workspace 注册表非空、MCP 双端点 ping、cookie 有效）。pre-flight 失败 = 1 分钟暴露，不进模型 turn。
- **T1.2**：G1 零 turn root 观察（round-1 静默 no-op 基线；修复与否只记录）。
- **T1.3**（2 turn，`suite-face-verify.mjs` 并发断言）：标准会话探针 + leader"请只回复 OK"（此时 W1/W2 未建；成员面在 P2 B1 后与 boot#3 B7 复证）。
- **R-T14（G1 gate 内）**：UI 建团 **team B**（= fixture 团队，蓝图 `dtest-bp@1` 本身，见 §5）。

### P2 — Tools（boot#1；11 turn）
- **B1**（1 leader turn）：T2.1 + T2.2（W1=worker / W2=collector；确定性 instance id；W1 首请求 identity 块）。
- **T2.6a R-F3 canary + T2.6 全量**（2×(leader follow_up + W1)，W1 侧 D5 watchdog 180s）：第 1 轮 = W1 调一次 `team_report_progress`（in-progress，合法 token，挂起探针）；第 2 轮（仅 canary PASS）= W1 报 completed → UI 活动/进度 + ledger `progress-recorded` 断言。
  - **PASS** → T2.6 关闭；后续成员 prompt **解除** D4 禁令（T6 用原案提示词"各 report progress 一次"）；
  - **FAIL** → 记回归失败（指纹三件套，180s 内暴露）→ D6 恢复 → 全轮启用 D4 禁令（T6 用禁令版提示词）→ T2.6 记 blocked 复核。
- **T2.3 + T2.4 + T2.5**（1 leader turn + W1×2 + W2×1）：leader 单 turn 连发 delegate W1（`work/alpha.md` sentinel 逐字）→ follow_up W1 → send_message leader→W2（wire 形态断言，round-1 OBS 口径）；W1 两个工作 turn、W2 一个 relay turn。
- **B2**（1 leader turn）：T2.7 + T2.8。
- **B3**（1 leader turn）：T2.9 a–e + T2.11（6 子案例逐字枚举；e 由 T1.3 覆盖）。
- **T2.10**（UI 定点，0 额外 turn）：archive/restore W2（含 CREATED→ARCHIVED 非法迁移的 typed 拒绝子断言）。

### R6 — E2E 哨兵（boot#1，P2 后前移；3 turn；round-1 T6 全断言集）
- **T6.1**（leader 1 + W1 1 + W2 1）：单 leader turn 编排 3 工作流；提示词双轨（canary PASS = 原案"各 report progress 一次"；FAIL = D4 禁令版）。
- **T6.2**：磁盘逐字（sentinel 93B / summary / final 含两路径+sentinel+要点）+ durable 时间线（work-admitted×3 + interval + lifecycle SETTLED×3）+ G2 gate（成员 settled + **F5 无 reload 检查** + ledger 尾行）+ leader 回报全路径。
- **T6.3**：W1 durable log sentinel 逐字计数。

### P3 — MCP 治理（boot#1；11 turn）
- **T3.1**（脚本，0 turn）：双轨面（W1/W2 无 `mcp__dtest-mini__ping`、`mcp__dtesthttp__ping` 在）。
- **T3.2**（UI 定点）：override W2 mcp/allow/dtest-mini → generation+1 + ledger override 行。
- **T3.3**（leader 1 + W2 1，边界）：W2 面 +1 且 `mcp__dtest-mini__ping` → `pong:` 回环；**同 turn 顺带 T3.7 的 W2 dtesthttp ping**；W1 面不变（per-instance 作用域，脚本断言）。
- **T3.4 + T3.5**（UI 定点连做：set deny → reset）→ 边界 turn ×2（deny 后 W2 面无该工具；reset 后回到 Inherited 不挂载）。
- **T3.6**（G3 gate 内）：hard-policy lane 空态 + "不得把 override 展示为压过 hard policy" 契约核查。
- **T3.5 边界 + T3.7 合并**（leader 1 + W2 1 + W1 1）：T3.5 边界 leader turn 连发 3 调用：`mcp__dtesthttp__ping`（leader 自身，T3.7）→ follow_up W1（ping，T3.7）→ follow_up W2（T3.5 验证）。
- **T3.8b**（kill/reconnect；leader 2 + W2 2）：**先** kill mini#2（3492），其自动重连验证**并入 T3.7 合并 turn 的 leader dtesthttp ping**（时序：mini#2 kill 在该 turn 之前）；再 kill mini#1（3491）→ W2 follow_up typed `WORK_DELIVERY_FAILED` + ledger `delivery-failed`（leader 1 + W2 1）；重启 mini#1 → 下一边界自动重挂（leader 1 + W2 1，`pong:` 验证）。

### P4 — Control/Approval 常规（boot#1；7 turn）
- **B4**（leader 1 + W1 1）：W1 单 turn 连发 4× request_control（user-approval 目标=`tests\mock-outside\probe\` 越界写；leader-approval ×2；自升级 1）；自升级子案例 turn 内自 resolve → 预期 `CONTROL_RESOLVER_NOT_AUTHORIZED (allowed: [leader, human])`（T4.6 闭环）。
- **B5**（1 leader turn）：T4.2（leader 越权裁决 user-approval 请求 → `NOT_AUTHORIZED (allowed: [human])`，**此刻该请求仍未被消费，断言成立**）+ T4.3 allow（裁决执行 + 消费）+ T4.4 deny（`blocked/decision-deny`，零副作用）+ T4.5 复用已消费 token（`allow-consumed`）。
- **T4.3 执行半程**（leader follow_up 1 + W1 1）：同 correlation follow_up → W1 guarded write 执行（落盘 + 消费复验）。
- **R-F9 / T4.1 allow 半程**（UI 定点 + leader 1 + W1 1，G3 前）：打开 pending user-approval 详情 → **人类 allow**（修复后的通道）→ leader follow_up（同 correlation）→ W1 越界 write 执行 → DSH 审批 lane"允许一次" → 落盘 + 消费 fact。**T4.8 随此流程覆盖**（审批提示出现即环境注记转正）。
- **G3 gate**：pending 徽章/裁决详情/ledger 控制行。

### boot#2 — T4.7 External Hard Policy（2 turn；G4）
- **B6**（leader 1 + W1 1 → leader 1）：W1 request（leader-approval，硬策略下可建请求）→ leader 单 turn：resolve allow（预期 `CONTROL_EXTERNAL_POLICY_DENIED`，capability 'tools'，durable deny reason=external-policy 先落账）+ 重试（预期 `CONTROL_REQUEST_DECIDED`）+ send_message 纯协调对照（T4.7c，delivered）。T4.7d 维持跳过（optional，facts 无 mcp 条目）。
- **G4 gate**：ledger `deny · external-policy` 行语义（round-1 T4.7b 断言集：徽章 data-decision/data-ledger-state-reason；非"审批失败"非成功）+ F5 检查。

### boot#3 — P5 checkpoint + 收尾回归（3 turn）
- **P5 checkpoint**（只读探针 + B7 面复证）：T5.2（确定性 instance id 跨重启不变——域查询；工具面 `suite-face-verify.mjs` 并发复证；ledger/治理/成员态恢复 = domain-diff + G5）；T5.4（team_domain 存在且与 UI 一致）。
- **R-F2**（1 turn）：UI 打开 team B（非 directive）→ 冷复活 → team B leader"请只回复 OK" → last-tools 断言（判据表）。
- **R-F11 API 半程**（脚本）：team A/B `suite-ledger-complete.mjs`。
- **R-F11 UI 半程**（G5 内）：team B ledger 渲染 durable 尾行。
- **拆机 + post-flight**：D6 配方 kill；3181/3491/3492 释放；:3080 / test-use / 仓库 tracked 三查；API key 未打印；Playwright close。

## 5. team B（ledger fixture 团队）规程

目的：为 R-F11 的"非首个团队且 >50 facts"触发条件 + R-F2 的"非 directive root 冷复活"提供单一 fixture。
- 创建：G1 内经 UI，蓝图 = **`dtest-bp@1` 本身**（含 `mcp` 必需需求）——R-T14 回归验证与 fixture 一石二鸟：创建成功即修复成立；创建失败按判据表 FAIL 行为 fallback（第 4 次 directive boot + 简化蓝图 leader+1 worker）。
- 事实填充（boot#1 内 P3/P4 间隙；3 个 leader 批 turn × 5× follow_up"请只回复 OK" × 4 facts/条 ≈ 60 facts）：3 leader turn + 15 个成员微 turn（仅"OK"，~30s 每个），合计 ~10min，不占关键路径。**事实量必须 ≥50**，否则 bug 未修时也不会触发（判据空转）。
- 消耗：R-F11 双半程（API + G5 UI）、R-F2（boot#3）。

## 6. 自动化资产清单

| 资产 | 状态 | 职责 |
|---|---|---|
| `boot.mjs`（D1/D2 扩展 + `MOCK_DSH_HOME`） | ✅ 已建（T0.2 冒烟通过） | workspace 预置 + cookie 持久化/导航打印；D6 助手独立为 `wait-end-seed.mjs` |
| `scripts/common.mjs` | ✅ 已建 | 共享库：zstd 多帧解码（尾部半帧容错）/domain 表访问/RPC 封装（session/prompt + team-remote）/日志助手 |
| `scripts/preflight-check.mjs` | ✅ 已建 | G0 契约预检（cookie/row health/envelope 交集/blueprint hash 变体匹配/workspace/MCP 端口/team-remote seam） |
| `scripts/wait-turn.mjs` | ✅ 已建 | D5 watchdog（log 轮询 turn/end，超时非零退出 + F3 挂死指纹：末行 call/无 result） |
| `scripts/wait-end-seed.mjs` | ✅ 已建 | D6 失败后 retire 确认（end-seed 边界行；用法=失败重启后，见 §1 D6 语义澄清） |
| `scripts/suite-face-verify.mjs` | ✅ 已建 | B7 面复证（leader 路由 1 prompt / direct 并发 prompt 双模式 + 并行 wait-turn + last-tools 断言） |
| `scripts/suite-ledger-complete.mjs` | ✅ 已建 | R-F11 API 半程（getLedgerPage 逐页至尾，Σ==total + durable domain 对账） |
| `scripts/suite-domain-diff.mjs` | ✅ 已建 | phase 结束域真值 vs 预期清单（expected JSON 驱动） |
| `scripts/forensics-batch.mjs` | ✅ 已建 | 只读取证合一（team/members/ledger 直方图/overrides/ops/log 尾/各面 last-tools） |
| `scripts/ui-gate.mjs` + `scripts/gates/*.json` | ✅ 已建 | gate 一趟式 UI 断言 + 快照/截图（playwright-cli 编排，配置驱动） |
| `scripts/prompts/*.md`（13 个） | ✅ 已建 | 逐字批量化提示词（canary×2 / ok×2 / B1 / T2345 链 / B2 / B3 矩阵 / B4 / B5 / T4.3 / T4.1 / B6×2 / E2E 双轨 / fixture 填充） |
| 取证脚本族（dump/log-tail/tool-lines/call-result/last-tools/control-facts 等） | ✅ round-1 已有 | 沿用 |

> 本轮启动前（P0 内）由主 Agent 建齐并冒烟（T0.3）；均为 tests/mock scaffold 扩展，符合"允许 scaffold 使计划可执行"裁决（逐项留痕）。

## 7. 预估

| 项 | round-1 实测 | V2 预估 |
|---|---|---|
| boot 次数 | 8 | **3**（R-T14 FAIL 时 4） |
| F3 类空等 | ~45min | **~0**（canary 180s 封顶；FAIL 情形消耗 ~10min） |
| 实质模型 turn | ~50（含 ~8 个 F3 恢复/再验证浪费） | **~43** + 15 fixture 微 turn（§2.2 账本） |
| 模型等待墙钟 | ~75min | **~72min**（硬地板：真实模型推理，不可压） |
| 世界重建 / root 轮转 | ~35min | **0**（pre-flight 拦截 + D1 预置） |
| 额外事故 boot | 5 次 | **0**（D4/D5/D6 三纪律） |
| UI 检查 | 每 op | **5 gate + 3 定点** |
| **总时长（单宿主）** | **320min** | **~150–190min**（FAIL 分支 +20–30min 内） |

约 130–170min 的降幅主要来自**死时间消除**（F3 空等 45 + 重建/绕行 35 + 事故 boot 25 + UI/导航 25）；模型 turn 等待是不可压缩的硬地板。进一步压缩的唯一结构选项是双宿主并行（fixture 团队放独立 3183 宿主与主世界并行，再省 ~20–30min，代价是 2× home/端口/凭据管理）——**默认不开**，用户要求时可切换。

## 8. 交付与记录

- `tests/mock/evidence/NOTES-V2.md`（逐任务证据链；round-1 NOTES.md 保持不动）；
- `tests/mock/evidence/REPORT-V2.md`（中文：回归判据表逐条裁决 + 矩阵结果 + 新 finding + 合规）；
- post-flight 合规清单同 round-1（:3080 / test-use / tracked 文件 / key / 端口）；
- 证据入库需用户再次授权 push（V2 产物 untracked 待命）。

## 9. 执行模型

同 V1 §5：主 Agent 全量执行（host 侧 + playwright + 取证 + 记录）；用户 = 拉起跑（bug 修复完成后）+ 回归范围裁决（§0 前置条件）+ 报告审阅。
