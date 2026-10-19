# ②a jobs actuator 缺位 — 精确改动单（缺项单号 **B-ACT-1**，交协调者排队 A 路）

时刻：2026-10-19T07:29Z；分栏定性补记 07:34Z（协调者 07:3xZ 补充线索+冻结计划现场核）。
提出人=B 路（writer 冻结面外，全部落在 A 路 writer 区）。
基线=d5de7497。语义源=pc-CONTRACT §1 `jobs` 行（"装配层把 gateway admit（TeamPermit 语义）通过后接 actuator → 宿主 jobs 公开面；两层 fence 各自独立：registry 按 caller session，gateway 按 member-scope"）+ 行头已披露缺口（actuator 腿缺位）。

## 定性两栏（按冻结语义核后：`alpha5-s0-pr0-pr8-implementation-plan.md` §10 现场读）

**PR7 Jobs 行原文**：「`job_output/list/kill` 的执行身份、Job Owner、创建时 Grant/ExecutionLease，Cancel requested vs terminated，长期 Job 作用域与跨 Member 输出隔离；停止结果不代表已撤销已发生效果。」+ PoC-7b 原文：「dsh-agent 真实 owner carrier 可否贯穿已启动/重启 Job？通过→直接复用原生 jobs 服务；否则 Team Job Gateway 强制 owner 映射、**或禁止跨 Member 查询和控制**；不能证明跨源授权时不授予该能力。」

⇒ 语义 = **治理宿主 job_output/job_list/job_kill 三管理调用 + 创建时归属 + 跨 Member 输出隔离**；**非** team 内建作业启动面。

| 栏 | 内容 | 定性 |
|---|---|---|
| **我方可补**（=下面改动单 (1)-(3)） | 三管理调用的 admit-first 门+owner fence+跨 Member 输出隔离；**创建时归属**=bash 臂 `run_in_background` 回执登记（宿主无启动工具，创建入口=已受治 team_bash 行——"创建时 Grant/ExecutionLease"半边已由 PR2 grant 消费+PR4 provider lease 承载，gateway 侧只补 owner 登记） | 实现级，A writer 区，B-ACT-1 执行 |
| **宿主缺位（记录，不扩）** | 宿主 `639ed01539` **无 job 启动工具面**（`job_start` 全树 grep=0 与钉面缺席互证，协调者现场+we2 A5 双在册）⇒ "启动即拦截"作为工具形=宿主法律不存在该面，**非我方实现缺口**；gateway idle-gated 如实入账。若未来宿主出启动面=新 seam 新单。 | 记录（不属 CORE_SEAM_BLOCKER——语义未要求启动拦截工具形） |
| **载体贯穿（待测）** | PoC-7b 的"贯穿已启动/**重启** Job"：owner carrier=durable MemberInstance 行（重启可恢复，assembly 身份源现成）+宿主 registry caller-session 层；重启恢复验收腿=计划原文"重启恢复"在案=未测（③矩阵入账，B 装面 kit 可驱动） | 未测腿，非缺位 |

## 现场事实（先钉死，防形状做歪）

1. **宿主无 `job_start` 工具名**：W7 `absent-anchor` 全树 grep=0 在册（we2 A5 同）。后台作业由 **bash 臂 `run_in_background:true` 产生**，宿主公开面=`job_kill/job_list/job_output`（plane 钉表现名 `team-tool-plane.mjs:270`）+ `@deepseek-ai/dsh-jobs` 服务面 `start/wait/readAt/list/get(caller)`（pc-CONTRACT 行）。⇒ actuator 腿的真实形状是**治理三个 job_* 管理调用 + bash-后台臂产生的作业归属登记**，不是"job_start 拦截"。
2. glue 现无任何 `ctx.jobs` 消费点（全文件仅 :2466 注释一处）。装配 `admitTeamJob`（jobs-gateway-assembly.mjs:124）零生产调用点。
3. 装配行内 definition 读源=row-local store（空起步，`register` = 文档化的 host-seam 槽位，assembly:82 注："production callers today have no path that writes it"）。本单第 (2) 步就是给它**第一个生产写入方**（受治理 mount 用 placement-feed 已验证身份注册），不新造 seam。

## 改动单（三文件，均在 A 路 writer 区）

### (1) `packages/runtime/src/plugin/live/team-tool-plane.mjs`
- 新增配置键 `jobsLaneEnabled`（boolean，**缺省=false 零翻转**，law 形照 `globEnabled` #342 先例：默认 true/false 不可翻、改名不可恢复、非 boolean fail-closed——键语义由 A 按既有先例定形）。
- `jobsLaneEnabled=true` 时把 `job_kill/job_list/job_output` 从"钉 only"翻为 **placement 名单成员**（走 `verifyPlaneNames`/Gate 0b 同一条装配前校验；三名已在钉表 :270，冒名 CLAIMS 面零变化）。

### (2) `packages/runtime/src/plugin/live/agent-bindings.mjs`（:2470 GLUE-5 装配块内）
- mount 成功且 `jobsLaneEnabled` 时，对每个 placement-feed 中已验证的 `job_*` 名调用 `assembly.definitions.register(scopeKey, name, identity)`——identity 用 **placement-feed 已验证定义身份**（`a5PlanePlacementFeed`/`placed` 现有事实，:2458 邻域），使 admit 边 `mapping-rejected` 只对"未过 placement 验证的名"生效（closed world 不放宽）。
- 新增 per-member actuator 桥（effect backend 注册进 plane-effect-backends 装配面）：
  `job_{kill|list|output}(args)` body 形状 =
  1. `assembly.admitTeamJob({ jobId: <宿主 callId/作业键，见下'待定项'>, owner: <路由成员 durable 对>, scopeKey: <agent scope>, toolName: 'job_*' })`；
  2. `ok:false` → 原样 typed 拒形出（`owner-not-durable/owner-mismatch/mapping-rejected/gateway-not-active` 逐字，零副作用——**B 不能 kill/list/output A 的作业**即 owner-mismatch 形）；
  3. `ok:true` → 调宿主公开面（`ctx.get('jobs')` 服务 `kill/list/readAt/get(caller)`，caller=成员 session 事实）；
  4. 宿主调用返回/终止 → `assembly.gateway.observeDispatchEvent(...)`（结算边=settled/refused 二形，PR1 事件名逐字），lease token 由 self-count 归零。
  - 后台作业归属：bash 臂 `run_in_background` 成功回执（宿主 jobId）在同一 effect 后端里 `admitTeamJob` 登记（owner=成员），使 job_* 管理腿的 owner fence 有据可依。
- **两层 fence 独立不动**：宿主 registry 仍按 caller-session 拒（`job … belongs to another session` 原文层），gateway 层加 member-scope——两者不互相代偿（pc-CONTRACT 行原文）。

### (3) `packages/runtime/src/plugin/live/plane-effect-backends.mjs`
- `job_*` 三后端按 (2) 形状落（同 bash/read 行的后端注册形）。

## 待定项（实施时现场定，勿拍脑袋）
- jobId 取键：宿主 jobId 还是 callId——以 `dsh-jobs` 公开面 caller-fence 键为准（W7M kit 实证过 `get(caller)` 形状，直接复用其读法）。
- bash-后台臂回执里 jobId 字段名与形态（现场读 `run_in_background` 回执原文，a5ie-r2b 世界现成）。
- `wait` 语义是否入 lane（建议先不入：等待=观测，不产生副作用；入 admit 只增争议面）。

## 测试面（B 路可承接测试腿，A 落装配后）
- 单元：扩 `a5p7-jobs-assembly.test.ts`——fake `ctx.jobs`（start/kill/list 记录调用）：admit 通过后**才**见宿主调用；owner-mismatch ⇒ 宿主调用计数=0；drain  ⇒ gateway-not-active 零调用；settle 后 lease 归零。
- 装面（B 的 3188/3496 kit）：`jobsLaneEnabled` 两成员世界：A bash-后台→A job_output 正控；B 对 A jobId job_kill/job_output 负控=owner-mismatch 原文进 transcript、宿主 registry 层拒形同场可分（两层 fence 各自 verbatim）；关断键缺省=零翻转（对照 Z1 形）。
- census：新拒形词全为既有 closed set（owner-mismatch/gateway-not-active/owner-not-durable/mapping-rejected），零新码预期。

## 风险与替代
- 若不翻 placement（保持 job_* 钉 only），本单第 (1) 步可拆——但那样 job_* 走宿主原样，Team 治理面=零，矩阵行只能永远"未测"。翻法=与 glob 同路（关断键+装面正反控），风险受控且有先例。
- 本单不改任何已裁语义；admit-first/两 fence 独立/R2b closed-world 全部照 pc-CONTRACT 原文。
