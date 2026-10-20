# ②b jobs actuator 接通 — PR 级实施方案（B-ACT-1-PR；根 07:30Z 令①）

时刻：2026-10-19T07:38Z。路线=PR#249 已批 **adapter 优先**（现场核后 fork fallback **不需要**，见 §2）；零 core patch。
基线=d5de7497；本分支 a5-jobs-isolation（C1 已在 `594b1fda`）。

## Q② 直答：kit 是否仅因"公开定义读取不足"而停？——**否**。三个独立停因，定义读取只是其一且已被现有事实可解

现场核（pristine @ `639ed01539`，porcelain=0）：
1. **装配缺失（主停因）**：无人调用 `admitTeamJob`——`job_*` 三名只钉不挂（`team-tool-plane.mjs:270`），宿主公开面原样直达成员（W7M FULFILLED 层）。这不是 seam 问题，是**挂载未做**。
2. **创建归属无生产者（次停因）**：后台作业由 bash 臂 `run_in_background` 产生，回执 jobId 无 Team 归属登记钩子。同样非 seam 问题。
3. **定义读取（三停因，且已可解）**：行内空 store 拦 pin-less admit 的"定义公共 seam 缺位"只针对**非我方所有**的定义；本方案中 `job_*` 经同名接管后**定义为我方所有**，mount 时以 placement-feed 已验证身份写入 store（`definitions.register` = 文档化的 host-seam 槽位，assembly:82）。宿主 jobs **服务面**（下）不需要任何定义 seam。
   ⇒ 结论行措辞：**idle-gated 非因宿主缺面，主因是我方挂载与归属两步未做，全部可补**。

## 2. 公开面实证（adapter 优先成立，fork 不需要）

`tests/deepseek-harness-test-use/packages/jobs/jobs/src/index.ts:85-195`（JobRegistry 抽象服务，`super(ctx,'jobs')` ⇒ **`ctx.get('jobs')` 公开取用**，glue 先例 `ctx.get('subagents')` 同型 :136）：
`start(spec) / list(caller?) / get(id,caller?) / read(id,caller?) / readAt(id,from,caller?) / kill(id,caller?,reason?)→'requested'|'already-finished' / wait(...) / remove(...) / events`。
- 三个管理工具（`tool-jobs/src/index.ts:2` = `job_output/job_list/job_kill` 三枚，**无 job_start**，与钉面互证）之下的服务面**全部 caller-scopable**：跨 caller 过滤是宿主公开法律（`:161` "when it is visible to the caller"）。
- ⇒ `job_output→read/readAt`、`job_list→list(caller)`、`job_kill→kill(caller)` 全部公开可达，**工具级 bounded fork 无需启用**（fallback 条款保留：若现场发现某 caller 语义不可复现才升级，预期不发生）。
- kill 返回 `'requested'` = **Cancel requested ≠ terminated** 的宿主原生形——gateway cancellation-boundary 正好承载其语义（法对齐，非新造）。

## 3. 两层 fence 合成（语义=pc-CONTRACT §1 行 + PR7 行原文，零改动）

- **Team 层（新）**：member-scope owner fence（durable MemberInstance 行 = 权威，重启可贯穿——PoC-7b "carrier 贯穿"载体即此）。
- **宿主层（不动）**：registry 按 caller session 过滤（`job … belongs to another session` verbatim 法律保持）。
- 顺序=Team admit-first ⇒ 跨成员时 **team owner-mismatch 先落**，宿主层不再被触达（矩阵逐层 verbatim 记录，两层互不代偿）。
- 无 Team 记录的历史作业（挂载前创建/非受治道创建）：checkManagement 返回 `{ok:true, corded:false}` 透传宿主层，不虚构归属、不冒充 Team 门（如实记录行）。

## 4. 文件清单（C2 段=批准件；C1 段=我的冻结面）

| 段 | 文件 | 改动 | writer |
|---|---|---|---|
| C1 | `packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs` | +`attributeBackgroundJob({hostJobId, owner, scopeKey})`（创建归属=admitJob，pin=**bash 定义身份**〔创建道定义，C-BIND 复核对象=bash〕）；+`checkManagementAccess({jobId, viewer})`（纯读 owner fence：命中记录=ok+record / 跨成员=owner-mismatch typed / 无记录=corded:false）；+`noteKillRequested(jobId)`（kill 的 'requested' → gateway cancel-requested 观测，**零新事件名**：复用既有 gateway 词汇）；头注诚实披露行同步（actuator 腿从"缺位"改"形状在装配、glue 挂载在 C2"）。**零新事件名 ⇒ census 身份集不新增**（除新测试文件的 filesScanned 续链，同法 append-only）。 | B（冻结面内） |
| C1 | `packages/runtime/test/a5p7-jobs-assembly-actuator.test.ts`（新） | RED-first：fake JobRegistry（caller-key，复刻 belongs-to-another-session + 'requested'/'already-finished'）；正=归属登记→B check 拒(owner-mismatch)→A check 通→noteKillRequested→cancelRequested 置位→结算边 settle/lease 归零；负=跨成员 check 不回显身份；无记录透传形；drain 后 checkManagement 拒新、已登记者可 settle。p4t6 续链 1207→1208。 | B |
| C2 | `packages/runtime/src/plugin/live/team-tool-plane.mjs` | 配置键 `jobsLaneEnabled`（缺省 false 零翻转，globEnabled #342 键法同型）；true 时 `job_kill/job_list/job_output` 入 placementNames（三名已在钉表 :270，走 Gate 0b 同校验）。 | A 区（我出 patch，A 落或批文我直改一次） |
| C2 | `packages/runtime/src/plugin/live/agent-bindings.mjs` | :2470 装配块内：mount 时 `definitions.register(scopeKey,'job_*'…, placement-feed 已验证身份)`（store 的**第一个生产写入方**，封闭性不放宽：只写 placement 验证过的行）；bash 臂 effect 后端在 `run_in_background` 回执处调 `attributeBackgroundJob`（回执 jobId 字段现场取）；`job_*` 同名接管后端=checkManagementAccess→`ctx.get('jobs')` 服务调用→结算观测。dispose 链 :5191 不变。 | A 区（同上） |
| C2 | `packages/runtime/src/plugin/live/plane-effect-backends.mjs` | `job_output/job_list/job_kill` 三后端 + bash 归属 hook（形状同上）。 | A 区 |
| C3 | 装面 kit（3188/3496，世界 `tests/homes/a5jobs-*`） | 两成员：A bash 后台→A job_output 正控；B job_output/job_kill(A 的 jobId) ⇒ **team owner-mismatch 原文进 transcript**（宿主层同场不可达，逐层留证）；A job_kill ⇒ 'requested' 形 + gateway cancelRequested；`jobsLaneEnabled` 缺省世界对照=宿主原样零治理观测（Z1 形）；teardown drain 后新调用 gateway-not-active。 | B |

## 5. 测试面与门

RED-first 全程；每段门=定向 GREEN→typecheck 0→changed-file lint→全套无新红→p4t6 续链（实测增量，禁抄链值）→census 身份集不新增（新事件名=0）→独立审。C2 触碰 A 区文件：**以不撞 A 正负验收为准**（A 在飞面=agent-bindings 装配/工具治理；我的 C2 patch 为增量装配块，冲突面=同一 :2463-2491 邻域，需 A 空档或代落）。

## 6. 风险台账

1. 同名接管漂移：三名已钉+placement Gate 0b 真注册来源校验（a5-pindir 律），漂移测试先 RED。
2. 双 fence 词汇混淆：team `owner-mismatch` vs 宿主 `belongs to another session`——矩阵/kit 逐层 verbatim，禁止互相冒充（法：弱化默认拒绝=先落者记账）。
3. caller 映射：Team 成员 child session id（`childSessionIdFor` 派生，glue 现成）= 服务 caller；durable instanceId↔sessionId 由路由成员身份对（PTC 行先例）——映射断裂=fail-closed 透传宿主层并披露，不猜。
4. kill 语义：'requested'≠终止——Team 层只记账 cancelRequested，终止事实=结算边（C-PROC 两形已钉）。
5. 创建归属失败面：bash 回执无 jobId 形态（前台臂）= 不登记，零副作用（无记录透传形覆盖）。
6. bounded fork fallback 保留未启用；启用条件=服务面 caller 语义现场不可复现（预期不发生，若发生报四联）。
