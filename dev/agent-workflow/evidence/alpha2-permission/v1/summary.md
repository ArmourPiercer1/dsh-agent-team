# V1 — 0.1.1-alpha.2 验证矩阵 + 冻结准备（final summary）

**任务**：0.1.1-alpha.2 计划 V1（§12 live 主机冒烟 + §17 DoD + 版本 bump + 冻结证据提交）— master 冻结前的最后一个任务。
**Worktree**：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2-v1`（branch `task/alpha2-v1-verification`）
**分支谱系**：int tip `802cea5`（A6 production wiring）→ `edf17ae`（version bump 0.1.1-alpha.2）→ `61724e2`（V1-1 fs-seam）→ `9f82bcb`（V1-2 root base tools + blueprint envelope，= 本分支 tip，全部 live 证明）
**执行日**：2026-07-11（会话时区日界前，日志戳 2026-09-10T20:xx–21:xxZ）
**FINAL VERDICT：GO**（§17 DoD 22/22，证据指针见 §5；产品 diff = 0；红线全保持）

---

## 1. 方法

- **被测对象**：int 树（9-package 插件 @ `9f82bcb`）经 `git+file://` bare clone 装入每轮全新的世界 home（`references/.dsh-test-a2perm-<stamp>` / `...a2permlegacy-<stamp>`），实例 :3181 + mock 模型 :3493（boot 进程内），观测面 = p6t6 harness routes（`/tool` `/state` `/health` `/residency/drop`）+ `/team-remote` 版本化 wire（v1–v4）+ **raw team ledger**（`team.getLedgerPage`，未截断投影）+ 工作区文件 + mock 模型日志（appendFileSync 精确时间戳）。
- **世界**：`team.a2perm`（leader + worker-a + worker-b；teamEnvelope 6 ops：read perm-a allow / read perm-b deny / 其余 default；worker-a 3 ops（read perm-a allow、read perm-b deny、其余 default ask→leader-approval）；worker-b 0 ops → default deny 空 lanes）。
- **脚本化模型**：mock 按 persona 标记识别身份，按 callId 返回固定工具链（leader：readA→readB→readC→writeC1→writeC2→LEADER-DONE；worker-a：readA→readB→readC→writeC1(member-a-payload-1)→readD→MEMBER-A-DONE；worker-b：readE→writeE→MEMBER-B-DONE）——权限行为全部由产品决定，模型只发工具调用。
- **矩阵**：§12 的 live 矩阵（leader lanes L1–L7、member-a M1–M7、member-b B1–B2、negatives N0–N6、final files）→ cold-resume 矩阵（13 项）→ legacy 探针（p6t6-only）。
- **设计裁决（parent ruling，"or equivalently" 替代路径）**：每 creation 只有 1 个 initial-work 槽位（`root-initial-work.ts` L63-64，`INITIAL_WORK_ALREADY_ADMITTED`）→ 5-admit 设计不可能 → 每个身份**一次** admit/send，链式工具调用跑在**一个模型回合内**；零请求断言**作用域化**到本 lane 的 correlations（`READ_LANES`/`MEMBER_READ_LANES`，raw ledger）以避开同回合后续 ask 的竞态（v12 发现）。

## 2. Part 1 — 聚焦测试矩阵（int 树，`9f82bcb`）

| 套件 | 结果 | 备注 |
| --- | --- | --- |
| alpha.2 全套（A2 canonical / A3 resolver / A4 scope / A5 adapter / A6 wiring / p4t6） | **162 pass / 0 fail** | 含 V1-1 的 10 个 a6a fs-seam legs（F1–F3：fs service 缺席 → resolver-threw → 类型化拒绝 + 零 next() 调用 + 零 control 行） |
| targeted 回归（V1-1/V1-2 相关选择集） | **258 pass / 0 fail** | V1-2 后与 V1-1 完全相同（无回归） |
| domain 套件 | 372 pass / 11 fail | 11 = 冻结基线预存失败（int tip 802cea5 同一组，逐条比对一致） |
| testkit | **124 pass / 0 fail** | p4t6 pin 665→666（A6 已含） |
| remote 套件 | 188 pass / 5 fail | 5 = 预存（基线一致） |
| runtime 主套件 | d1 3/6（预存）→ **7/7**（V1-2 重写 d1 spec 为 v3：7 tests）；其余与基线逐条一致 | |
| typecheck | **10/10 packages clean** | |
| build | build:composition OK（1080 files），dist 随 V1-1/V1-2 重建 | |

## 3. Part 2 — live 主机冒烟（§12 矩阵）

### 3.1 运行台账

| 轮次 | 角色 | 结果 | 关键事件 |
| --- | --- | --- | --- |
| **v12** | 证明轮（V1-1/V1-2/envelope 首跑） | live **25 PASS / 7 FAIL**（5 个独立失败，parent 全裁 kit） | 5 个 kit 缺陷全部定位并修复（§8）；mock seq=5 写重放 = **await-bridge 活证**（allow 落地后阻塞的 /tool 调用被唤醒重执行） |
| **v13** | 诊断轮 #1 | live **47 PASS / 1 FAIL**（L7 wire shape）+ member 阶段崩溃 | 发现并活修 **PRINCIPAL_INVALID**（kit 的 humanId 必须是 root session id，见 §7-PF0）；L7 失败 = kit 读 `body.ok` vs wire `body.result.ok`；**a2-mA-1 at-least-once/dedup 活证据**（parent 指令 2，§6.2） |
| **v14** | 诊断轮 #2 | 首个**全绿 leader drill（含 L7）**+ M1/M2 绿 + member readC 处崩溃 | 发现 **/state 链锁阻塞**（PF-1）与**重投递/重放环**（PF-2）；fp decision-reuse 活证（probe turn 0.8s 收敛，零新请求）；wake latency 实测 **0.27–0.44s**（PF-3）；member.send admission **0.077s**（非产品锁泄漏——v13 "stall" = kit 忽略 PRINCIPAL_INVALID 错误响应） |
| **v15** | 官方候选 | live **109/115**（6 FAIL 全 kit，parent 逐条裁决，§6.3） | leader + 两条 member 腿首次全程绿（M5/M5b/M7 全部 **tool 路由**解析——leader-approval 闭包 live 生效）；N 阶段 6 个 kit 缺陷（N2 前提错、N0 value 形状、N6 旧快照、计数泄漏×2） |
| **v16** | 诊断轮 #3 | live **115/115 PASS**（首次全绿 live）+ cold **24/26**（2 个 value-形状 kit 缺陷，同 N0） | 全矩阵绿：L1–L7 / M1–M7 / B1–B2 / N0–N6 / final files 4/4；mock 18 请求、**零重放**（PF-2 的自然对照：无 /state 轮询 → 无恢复扫描触发）；M5/M5b/M7 再次全 tool 路由；N4 abort 传播 117.7s（两轮一致） |
| **v17** | **官方运行** | live **115/115 PASS** / cold **26/26 PASS** / legacy **12/12 PASS** | 三腿（live/cold/legacy）全绿；正式冻结证据（合计 **153/153，0 FAIL**） |

### 3.2 断言计数（Part 2 汇总，官方 v17）

- **live**：115/115（Phase 0 基线 15 + leader 24 + member-a 18 + member-b 7 + negatives 36 + final 4 + settle/turn 11；含 8 个 tool 探针）
- **cold-resume**：26/26（拓扑 4 + 即时策略 5 + ask-read 重建 3 + 持久兼容 7 + writeC 重建 6 + no-drill-rerun 1；逐项见 `a2perm-check-cold-v17-*.console.log`）
- **legacy**：12/12（p6t6-only 探针：health/toolCount/leader-only/blueprint-shipped/control-zero/catalog/full-10-catalog/defaultworkspace/write-executes/file-on-disk/read-executes/zero-control-rows — 见 `legacy-probe-v17-*.json` + console）
- 全矩阵合计：**153/153 PASS，0 FAIL**（v17 官方）

### 3.3 v17 关键证据行（live 115/115，节选）

- `live-L3a-scope-exact` / `live-L3a-fingerprint-bound`：请求 scope = 精确操作（root + leader caller + leader target + action + tool + correlation），fingerprint = `sha256:…`（payload 顶层）— raw ledger 证据
- `live-L4-leader-self-approval-negative`：leader 自批被拒，类型化 `CONTROL_RESOLVER_NOT_AUTHORIZED`，role=leader，allowedRoles=[human]
- `live-L5-executed` / `live-L6-re-ask` / `live-L6-fingerprint-bound`：allow 执行；同 lane 新调用重新 ask；两个 write 的 fingerprint 不同（内容不同 → 操作不同）
- `live-M3a-kind-leader-approval` / `live-M5-leader-resolves-member`（route: tool）/ `live-M4-member-self-approval-negative`：member ask 路由 leader-approval，leader 工具路由解析，member 自批无工具
- `live-B1-deny-default-reason` / `live-B1-write-deny-default-reason`：空 lanes 默认 deny（读 + 写），静态策略 reason（非 canonicalization 失败）
- `live-N2-canonicalization-failure-deny` / `-reason`：经普通文件的路径（`perm-a.txt/child.txt`）→ resolver-threw → 类型化 canonicalization 失败拒绝（跨平台，parent 给出源码依据 fsio.ts L146-184）
- `live-N4-abort-deny` / `live-N4-still-pending`：residency drop → CONTROL_WAIT_ABORTED → deny 不执行、请求保持 pending（取消从不裁决）
- `live-N5-double-consumption-blocked` / `live-N6-old-allow-unusable`：allow 恰好一次；fp1 的 allow 不可用于 fp2
- `live-final-perm-c` = `member-a-payload-1`、`live-final-perm-d` = `a2-fp-one`（与预期终态一致）

## 4. 版本 bump（`edf17ae`）

`chore(release): 0.1.1-alpha.2 version bump` — 11 files（全部 package.json 版本字段）：
`package.json`（根）、`packages/{client,client/composition-shim,contracts,domain,legacy,remote,runtime,storage,testkit,tools}/package.json` — 11 insertions(+), 11 deletions(-)，无其他改动。

## 5. §17 DoD — 22/22（官方 v17 证据指针）

| # | DoD 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | Blueprint permissions schema 可解析 | ✅ | v17 setup（蓝图 6 ops 装入 + A1 contentHash 验证）+ `live-blueprint-team.a2perm` / `live-contenthash-recorded`（`live-perm-v17-*.json`） |
| 2 | legacy / alpha.1 Blueprint 完全兼容 | ✅ | v17 legacy 探针 12/12（`legacy-probe-v17-*.json` + `a2perm-legacy-v17-*.console.log`）：legacy 蓝图（BUNDLE 层 ship 默认 my-team-bp-1）启动、leader-only、全 10 工具（无 capability 选择）、write+read 执行无权限否决、**零 control 行**（alpha.2 权限面缺席） |
| 3 | canonical operation 只使用 public seam | ✅ | V1-1（61724e2）：resolveTarget 走 host row 惰性 `ctx.get('fs')`；live `N2`（resolver-threw 走 public seam 失败路径）+ `L2/M2/B1`（seam 解析出的资源进入静态策略）+ a6a F1–F3 unit（fs service 缺席 → 类型化拒绝） |
| 4 | read/read_image/write/edit 至少实现 parameter-aware policy | ✅ | 实现：`canonical-operation.ts`（read {resourceKey,offset,limit} / read_image {resourceKey} / write {resourceKey,contentHash} / edit 投影）；live：read（L1/L2/L3a/M1/M2/M3a/M7/N0/N4）+ write（L3/L5/L6/M3/M5/B1/N5/N6）全 lane 实跑；read_image/edit 参数感知 = alpha.2 套件 162/0 覆盖（§12 矩阵范围 = read/write 实机腿） |
| 5 | default 仅 ask\|deny | ✅ | live 两支均实测：default-ask（M7/N4/N0）+ default-deny 空 lanes（B1 读/写）；A3 值域校验 = unit 162/0 |
| 6 | deny > ask > allow | ✅ | live：同一策略下 deny lane（L2/M2/B1 拒绝）、ask lane（L3a/M3a/M7 请求）、allow lane（L1/M1 执行）三分支共存；优先级顺序 = A3 unit 162/0 |
| 7 | allow executes | ✅ | live：`L3a-executed`/`L5-executed`/`L6-executed`/`M3a-executed`/`M5-executed`/`M7-executed`/`N0-executed`/`N5-first-executed`/`N6-fp1-executed`；cold：`cold-policy-rebuilt-executes`（perm-c = a2-cold-c） |
| 8 | deny zero execution | ✅ | live：`L2-deny-file-unchanged`、`B1-file-unchanged`（读+写双 deny）、`N4-no-execution-without-decision`/`N4-file-unchanged`、`N6-fp2-denied`+`N6-file-unchanged`、`N1/N2`（canonicalization 失败：never next()，unit `f1.nextCalls=0` + live 文件不变） |
| 9 | ask creates durable ControlRequest | ✅ | live：`L3a-ask-request-created`/`M3a-ask-request`/`N4-ask-created`；**持久性**：cold `cold-policy-rebuilt-ask-read`（重启后新 ask）+ `cold-pending-survives`（pending 跨重启存活） |
| 10 | Member ask → Leader | ✅ | live：`M3a-kind-leader-approval`（kind=leader-approval，target=请求 member）+ `M5-leader-resolves-member`（route: tool，leader 解析）+ `M4-member-self-approval-negative`（member 无解析权） |
| 11 | Leader ask → Human | ✅ | live：`L3a-kind-user-approval`（human-only 闭包）+ `L3a-human-allow`（remote v4）+ `L4-leader-self-approval-negative`（leader 自批类型化拒绝） |
| 12 | allow 只授权当前 exact operation | ✅ | live：`L6-re-ask`（allow 消耗后同 lane 新调用重新 ask）+ `L3-scope-exact`/`M3a-scope-exact`（scope = root+caller+target+action+tool+correlation，raw ledger）+ `N6-old-allow-unusable` |
| 13 | operationFingerprint participates in scope | ✅ | live：`L3a/L3/L6/M3a/M7 fingerprint-bound`（sha256 顶层 payload）+ `N6-fingerprints-distinct`（内容不同 → fp 不同）；机制：`guardOperation` scopeKey 含 operationFingerprint（control/service.ts L1120+） |
| 14 | allow exactly once | ✅ | live：9 个 `*-consumed` 断言（`control-allow-consumed` 各恰 1 行）+ `N5-first-consumed`/`N5-still-one-consumption`；v17 sidecar：consumptions=9 与 9 个 allow 决策一一对应 |
| 15 | payload/resource mismatch 不可复用 approval | ✅ | live `N6`：a2-fp1 allow（消耗）不授权 a2-fp2（contentHash 不同 → fp 不同）——仍 pending、文件不变，随后 deny 生效 |
| 16 | cancellation 不泄漏 waiter | ✅ | live `N4`：residency drop → 阻塞的 /tool 等待以类型化 abort 落定（`CONTROL_WAIT_ABORTED` → deny，不执行），请求保持 pending（取消从不裁决）；waiter 有界落定（两轮实测 117.7s，见 §7-PF3） |
| 17 | cold resume 重建 static permission | ✅ | cold v17 26/26：`cold-policy-allow-lane`/`cold-policy-deny-lane`（重启后策略即刻生效）+ `cold-policy-rebuilt-ask-read`/`cold-policy-rebuilt-ask`（新请求携带新 fp，绑定重建策略） |
| 18 | existing Control rows 兼容 | ✅ | cold：`cold-pending-survives`（a2-n4 跨重启 pending）+ `cold-no-decision-for-n4` + `cold-decisions-preserved` + `cold-consumptions-preserved`（≥5）+ `cold-n5-request-persists` + `cold-double-consumption-still-blocked`（重启后 allow-consumed 仍阻塞） |
| 19 | alpha.1 tools/skills/MCP/builtin deny 不回归 | ✅ | targeted 258/0（含 alpha.1 兼容腿）+ live `N3-passthrough`（不支持类工具零干扰通过）+ 8 个 tool 探针（capability 选择：leader 无 team_delegate、member-b 无 team_request_control 等） |
| 20 | CORE PATCH BUDGET = 0 | ✅ | test-use 树（`references/deepseek-harness-test-use`）HEAD = `a66e470204`（0.1.2-rc.1），porcelain **0 行**（V1 全程零 upstream 源改动；世界 home 均在其外） |
| 21 | build/typecheck/artifacts clean | ✅ | typecheck 10/10；build:composition OK（1080 files）；V1-1/V1-2 提交均含 dist 重建；testkit pin 666 |
| 22 | targeted real-host smoke PASS | ✅ | **v17 官方**：live 115/115 + cold 26/26 + legacy 12/12 = 153/153（§3） |

## 6. Parent 指令答复

### 6.1 指令 1 — member.send 必须 await + 记录完整响应体与 wall-clock 延迟；9.5 分钟阻塞 = 产品锁泄漏 vs kit 伪影，先区分
- **kit 已改**：v15+ 的 `leaderAdmit`/`memberASend`/`memberBSend` 三处全部 await 响应并记录 `{firedAt, latencyMs, httpStatus, body}` 入证据 JSON。
- **v17 官方实测（`live-perm-v17-*.json` → `evidence.*`）**：
  - `leaderAdmit`：firedAt 21:57:07.396，**latencyMs 3698**，HTTP 200，`result.ok=true`（mode=fresh）
  - `memberASend`：firedAt 21:57:11.096，**latencyMs 3339**，HTTP 200，`result.ok=true`，`outcome.status=delivered`，`callerRole=human`
  - `memberBSend`：firedAt 21:57:14.445，**latencyMs 809**，HTTP 200，`result.ok=true`，`outcome.status=delivered`
- **区分结论：v13 的 "9.5 分钟 stall" 是 kit 伪影，不是产品锁泄漏**。机制：v13 kit 的 humanId 写死 `kit-v1`（非 root session id）→ `/team-remote` 返回类型化 `TEAM_REMOTE_PRINCIPAL_INVALID`（spoofed-human，零持久效果）→ kit 从未检查响应（fire-and-forget）→ 误读为 stall。**v14 实测（humanId 修复后）：fire → `team-coordination-recorded` 提交 = 0.077s；readC ask 提交 = admission 后 0.63s（回合运行中）。** v15 中 member 阶段的"长阻塞"是 kit 轮询 /state 撞上 PF-1（/state 链锁）+ 无人解析 ask，非 admission 锁。v17 全程：member-a 整链（3 ask + 3 allow + 2 读 + 1 写）= **3.34s**（mock seq=8→14），远小于 120s 预算。

### 6.2 指令 2 — v13 a2-mA-1 对 = at-least-once/dedup 活证，验证后写入 summary
**验证成立**（v13 持久 ledger，14 行，`.tmp-v13-ledger2.mjs` 转储）：
- 原始 20:46:32.805 的 send：**零事实**（PRINCIPAL_INVALID 在 admission 前拒绝，无部分状态——零事实 = 无 RUNNING/无结算/无请求）
- 20:56 重发（**同一 requestToken**）：恰好**一条** `team-coordination-recorded`（@ 20:56:00.893，payload.at 20:56:00.847）+ 其后正常链（pending a2A-readC @ 20:56:01.461）
- **零重复**（无第二条 coordination 事实）、无结算事实（轮次在 readC 处被 kit 中断）
- 即：第一次调用零效果，第二次同 token 完整链 + 恰好一条协调事实 = 重试协议（at-least-once 投递 + requestToken 去重）的活证据 ✅

### 6.3 指令 3 — v13 L7 FAIL：dump 实际 leaderWork 响应体；ok:false 在该 wire shape 下何意
- **v13 L7 失败 = kit wire-shape 误读**：`/team-remote` 响应 = `{type:'server-response', rpcId, result:{ok, value|error}}`；kit 读 `body.ok`（恒 undefined）→ 误判 FAIL。
- **实际 body（v14 run1 首绿，v15/v16/v17 同形，完整体在 `evidence.leaderAdmit.body`）**：`result.ok === true`（admitted root work 成功）——`ok:false` 在该 wire shape 下表示 RPC 层拒绝（版本/参数/principal 类错误，`result.error` 携带类型化 code），**不是**"工作未执行"。v17 证据：`evidence.leaderAdmit = {firedAt: 21:57:07.396Z, latencyMs: 3698, httpStatus: 200, body:{type:'server-response', result:{ok:true, value:{data:{mode:'fresh', rootSessionId:'a2root', ...}}}}}`。

## 7. 产品发现（parent 参考；V1 产品 diff = 0，均为观测/行为特性记录）

### PF-0（已修，kit 侧）principal 模型
`s6-principal.ts` `deriveAdmissionCaller`：`caller:{kind:'human'}` 必须 `ownsRoot(humanId)`——**humanId 即 root session id**（本世界 `a2root`）；否则类型化 `TEAM_REMOTE_PRINCIPAL_INVALID`（spoofed-human，零持久效果）。kit v14+ 两个 member send 均用 `humanId: rootSessionId`。

### PF-1（观测路由限制，V2 候选，非 DoD 阻塞）/state 在 active member turn 期间阻塞
- 现象（v14 活测）：member 回合运行（含阻塞在 control ask）期间，p6t6 `/__p6t6/state` 路由 **15s+ 客户端超时**（~6 分钟阻塞窗内持续）；**同一世界同一时刻** `/team-remote` ledger 29ms、resolveControl 147–203ms、`/health` 21ms、`/tool` 正常；回合落定后 /state 1065ms→19ms/3ms。
- 机制：/state 路由的 `teamRoot.control.listControlState`（plugin.mjs L394）+ `teamRoot.messaging.recoverPendingDeliveries`（L396）取**每团队工作链**——阻塞中的 /tool 控制等待持有该链。**root 回合不受影响**（root-initial-work.ts Phase B：chain 在 ROOT TURN 启动前释放）→ leader 阶段 /state 始终可用。
- 影响：harness 观测路由限制；remote 契约完全正常（同期全部可证）→ **文档化，V2 候选**，非 DoD 阻塞。kit 对策：member 阶段观测走 **raw ledger**（`team.getLedgerPage`，无锁路径）+ 解析走 tool 优先/remote-v4 兜底。

### PF-2（重投递/重放环——设计内 at-least-once，幂等）
- 现象（v14）：member 回合终了文本（21:14:12.318）与终端事实 `team-message-delivered` 提交（21:14:21.506）之间 **9.2s 窗口**，delivery-recovery 环（coordinator R2/R3：pending intent 无确认事实 → 重投递）重投递工作消息 ~13–23 次，每次重放整条脚本链（mock 174 行）。
- **幂等性活证**：重放经 **fingerprint decision-reuse**（`guardOperation` L1120-1239：ALLOW+consumed → `ALLOW_CONSUMED` 错误结果、不新建请求；DENY → 立即重拒）→ probe turn 0.8s 收敛、**零新 control 事实**、文件不变、零新决策/消耗（v16 sidecar：requests=11/decisions=10/consumptions=9 恰等于原始链；v16 无 /state 轮询 → 窗口 0.2s → **零重放**——自然对照）。
- 定性：R2/R3 文档语义（session input at-least-once、ledger exactly-once 确认）的正常表现；alpha.2 fp 复用使其幂等。**V1 无产品 diff**；记录为观察（窗口大小与恢复扫描触发路径可作 V2 跟进）。

### PF-3（延迟实测，两轮一致）
- **wake latency**（决策提交 → 工具结果到达模型）：v14 实测 **0.27–0.44s**（mock seq=13/14/15 vs 决策提交时间戳）；v16 member 链 3 ask 全程 3.4s。
- **residency-drop abort 传播**：N4 两轮一致 **117.7s**（drop → 阻塞 /tool 等待以 CONTROL_WAIT_ABORTED 落定）——有界、类型化、不执行（DoD #16 满足）；量级值得 V2 关注。
- **member.send admission**：0.077s（v14）；响应落定 = 终端事实提交（v16：3.4s 整链）。

### PF-4（存在宽容解析，parent 源码依据）
上游 `fs.resolve` 为存在宽容（test-use `packages/fs/fs-local/src/fsio.ts` `resolveLocalTarget` L146-184：缺失文件按最近存在祖先 realpath + 重拼后缀，"key 在目录创建前后稳定"）→ 缺失文件 read 正常 canonicalize 走 default ask（v15 实测第 7 请求）；真正 resolver-threw 需要**经普通文件的路径**（`perm-a.txt/child.txt`：POSIX ENOTDIR → FS_NOT_FOUND L157；Windows ENOENT + stat 修复 L174-178）→ v16/v17 N2 即此目标，跨平台失败闭合。

## 8. Kit 修复台账（全部 kit 侧，产品零改动）

| # | 缺陷 | 修复 | 证据/依据 |
| --- | --- | --- | --- |
| K1 | v12：零请求断言无作用域（同链后续 ask 竞态） | READ_LANES/MEMBER_READ_LANES 作用域化（raw ledger） | v13+ 全绿 |
| K2 | v12：mock 截断 160 字符（工具结果断言失配） | 400 字符 | v13+ |
| K3 | v12：scope/fp 断言走 /state（投影缺 rootSessionId/requester/operationFingerprint） | raw ledger（`team.getLedgerPage` entries.payload） | v13+ |
| K4 | v12：L4 断言形状（typed rejection 是 ok:true + value.status='rejected' + details.role/allowedRoles） | 按实际类型化形状断言 | v13+ |
| K5 | v12：writeC1 90s 超时（fs read-before-overwrite：write 前必须 read 过该文件） | leader/member 链加 readC 步（read 后 write） | v12 mock seq=5 活证 + v13+ 全绿 |
| K6 | v13：humanId 写死 `kit-v1` → PRINCIPAL_INVALID（kit 未查响应 → 误 stall） | `humanId: rootSessionId` + 响应必查 | v14 admission 0.077s |
| K7 | v13：L7 读 `body.ok`（wire 实为 `body.result.ok`） | 读 `result.ok` + 完整 body 入证据 | v14 L7 首绿 |
| K8 | v14：/state 链锁（PF-1）→ member 阶段观测崩溃 | member 阶段观测全转 raw ledger + 解析 tool 优先/remote-v4 兜底 | v15/v16 member 全程绿 |
| K9 | v15：N2 前提错（缺失文件 ≠ canonicalization 失败——存在宽容解析，PF-4） | N2 目标改 `perm-a.txt/child.txt`（经文件路径 → resolver-threw）+ 计数断言回 6 | parent 源码裁决（fsio.ts L146-184）；v16/v17 绿 |
| K10 | v15：N0/cold 读断言假设 value 为字符串（实为结构化 `{path,offset,lines,totalLines}`） | 断言走 `lines[].text` | v16 cold 24/26 → v17 26/26 |
| K11 | v15：N6 用旧 /state 快照（a2-fp2 时尚未入快照 + /state 被活动回合阻塞） | 状态改从 raw ledger 读（request 事实存在且无对应 decision 事实 = pending） | v16/v17 绿 |
| K12 | mock 每会话首条 user 消息触发独立 title-gen 请求（无 persona → `identity=unknown → text-fallback`，会话标题 "unknown-drill-fallback ok"） | 记录为表面现象（3 条/世界，入 mock 日志，无断言依赖） | v12–v17 mock 日志 |
| K13 | cold sidecar 与 live sidecar 同名互覆 | 分文件（`a2perm-live-counts-` / `a2perm-cold-counts-`） | v15+ |
| K14 | N0 排在 N4 前（N4 drop 后 a2root fs 读状态丢失 → N5/N6 write 需要重读） | N0 移到 N4 后（重解析 agent 中先读 perm-d，为 write 的 read-before-overwrite 铺垫） | v13+ |
| K15 | v15：M4 member 自批负例在 active 回合中 /tool 可能超时 | boot 探针锚点（`probes['session-a2a-a:team_resolve_control']='not-registered'`）双路径断言 | v15/v16/v17 绿（v16/v17 走 live unknown-tool 路径） |
| K16 | v15→v16：member 响应 await 化（parent 指令 1） | leaderAdmit/memberASend/memberBSend await + latency + 完整 body | v15+ 证据 JSON |

## 9. 环境清洁度（终态）

- **:3080（pid 11652）+ `D:\deepseek-harness\`**：ZERO-TOUCH（V1 全程未碰；未启替代服务器）
- **:3180 用户 tsx（pid 104004）**：未杀
- **3181/3493**：v17 三腿全部 stop 后释放（最终 `A2-STOPPED` + ports free 记录于各 stop 日志）
- **test-use 树**：HEAD `a66e470204`（0.1.2-rc.1），porcelain 0 行（CORE PATCH BUDGET = 0）
- **世界 home 保留在盘**（可复核）：v1、v11、v12、v13（脏诊断）、v14（脏诊断）、v15、v16、v17 + v13/v14/v15/v16/v17 legacy
- **worktree**：最终证据提交后 `git status` 干净（删除 3 个 dispatch 输入 + 全部 `.tmp-*.mjs`；证据目录 `dev/agent-workflow/evidence/alpha2-permission/v1/` 入库）
- **主仓库**：未触碰（HEAD 3aa6838 及其预存脏状态保持原样）
- **无 push**（分支仅本地）

## 10. 偏差记录

1. **5-admit leader 设计不可行**（每 creation 单 initial-work 槽位，产品不变量）→ 采用 parent "or equivalently" 替代：每身份单次 admit/send + 回合内工具链 + 作用域化零断言。
2. **N2 计划假设修正**（§12 原假设"missing file → canonicalization-failed"）：live 实测缺失文件正常 canonicalize（存在宽容解析，PF-4）→ N2 目标改经文件路径；parent 源码裁决确认。
3. **v13/v14 世界保留在盘（脏诊断态）**：作为诊断证据不回收（与 v1–v12 惯例一致）。
4. **mock title-gen 伪影**（K12）：表面现象，无行为影响。
5. **N4 abort 传播 117.7s**（PF-3）：有界、类型化、零执行——满足 DoD #16；量级记录为 V2 观察。

## 11. 红线状态

| 红线 | 状态 |
| --- | --- |
| CORE PATCH BUDGET = 0（references/** 零源改动） | ✅ test-use @ a66e470204 porcelain 0 行 |
| :3080（pid 11652）+ D:\deepseek-harness ZERO-TOUCH | ✅ |
| 不杀 :3180 用户 tsx（pid 104004） | ✅ |
| 无 push | ✅（分支 `task/alpha2-v1-verification` 本地） |
| 3181/3493 终态释放 | ✅（v17 三腿 stop 后） |
| 世界 home 保留在盘 | ✅（v1…v17 + legacies） |
| 删 3 个 dispatch 输入 + 全部 `.tmp-*.mjs`（26 个） | ✅（最终提交前） |
| 证据在 `dev/agent-workflow/evidence/alpha2-permission/v1/` | ✅ |

## 12. 证据索引（`dev/agent-workflow/evidence/alpha2-permission/v1/`）

- **kit**（untracked → 入库）：`a2perm-check.mjs` / `a2perm-boot.mjs` / `a2perm-setup.mjs` / `a2perm-legacy.mjs` / `run-v11-targeted.mjs`
- **v17（官方）**：`a2perm-setup-v17-*.console.log`、`a2perm-boot-v17-*.console.log`（create / resume / legacy）、`a2perm-check-live-v17-*.console.log`、`a2perm-check-cold-v17-*.console.log`、`a2perm-legacy-v17-*.console.log`、`live-perm-v17-*.json`、`cold-resume-v17-*.json`、`legacy-probe-v17-*.json`、`a2legacy-assertions-v17-*.json`（setup 生成）、`a2perm-live-counts-v17-*.json`、`a2perm-cold-counts-v17-*.json`、`mock-model-a2perm-v17-*.log`、`a2state-*.json`、`dump-config-*.txt`、`summary.md`（本文件）、`environment-cleanliness.txt`
- **诊断轮**：v12（live 25/7）、v13（47/1 + ledger 转储）、v14（全绿 leader drill + chain-hold 发现）、v15（109/115 + cold 24/26 同轮）的 console/evidence/mock/state/dump 全保留
- **临时探针**（已删）：26 个 `.tmp-*.mjs`（含 v14 诊断链：`.tmp-v14-{release,tooltest,tooltest2,timeline,mock2,ledger,dump}.mjs`、v13 ledger 转储、v15 shape/clean 探针）
