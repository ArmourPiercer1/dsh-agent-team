# P5-T6 G5 报告 — Member create/resume residency + G5

- 任务: P5-T6 (Member create/resume residency + G5，P5 收尾任务)
- 分支/worktree: `task/P5-T6-member-residency` @ `.worktrees/P5-T6`（base `83b934a`）
- 权威依据: DevPlan §18.5（MemberInstance 持久 / Session 持久 / Agent residency 易逝；SETTLED 允许 handle 缺失；新工作 → cold resume）与 §18.6（G5 八条判据）
- 性质: **claim-based**。G5 reviewer 可凭本文引用的每个 JSON 字段与 harness-output/ 下的原始产物独立复核；本报告不含未经验证的 PASS。
- 证据根: `dev/agent-workflow/evidence/P5-T6/harness-output/`（canonical run，`--report-dir` 产物）；`summary.json` 为驱动级裁决汇总。

## 0. 运行方式（可复现性）

真实实例 harness（`packages/runtime/member-residency/harness/run.mjs`）按 TEST_METHODS §1 运行：

- 源码树: `references/deepseek-harness-test-use`（pristine upstream；run 前后 `captureGitState` 双重校验，`summary.pristine.before/after`）
- DSH_HOME: `references/.dsh-test-p5t6`（每次 run 全新 `rmSync + mkdirSync`）
- 端口: 3180/3181（boot 奇偶交替）+ mini MCP 3491–3495；run 后端口释放断言（`summary.ports.released`）
- 稳定实例 :3080 run 前后 GET 探测（`summary.stable3080.before/after`）
- 无任何真实 LLM 调用（模型选择走 `p5t6-static` 静态 provider；MCP 走本地 mini server）

Boot 计划（单一 domain-open 约束：同一进程内 `team_domain` 只允许 open 一次，故 T5 row 独占 boot 1–2，T6 row 独占 boot 3–6）：

| boot | port | row | 场景 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | 3180 | p5t5-root-binding | S1 | Root fresh bind（T5 交付，T6 harness 复验） |
| 2 | 3181 | p5t5-root-binding | S2 | Root cold bind（T5 交付，T6 harness 复验） |
| 3 | 3180 | p5t6-member-residency | M1, M5 + I1a 崩溃 | M1 新建成员（四槽位全装）；M5 普通 Agent 不变性 + 负探针；随后 I1a 真实进程崩溃 |
| 4 | 3181 | p5t6-member-residency | M2, I1A, M3, M4 | M2 冷恢复；I1A 崩溃后收敛重放；M3 SETTLED 驱逐；M4 再准入幂等 |
| 5 | 3180 | p5t6-member-residency | I1C | 预 boot 删除成员记录 → 重放幂等 |
| 6 | 3181 | p5t6-member-residency | （预期失败启动） | 预 boot 将 unit version 置 999 → SCHEMA_VERSION_MISMATCH 大声失败 |

**I1a 崩溃机制**（真实 OS 进程 + 真实 StorageDomain，非 file-seam 模拟）：插件侧 audited write proxy 在成员 B 的 `putMemberInstance` 落盘后冻结进程（hold promise 永不 resolve）；驱动轮询 `/__p5t6/i1a/state` 观测到 `recordWritten=true && bindingWritten=false` 窗口后，经 `instance.stop()` 真实 kill 进程。窗口与 kill 事实见 `summary.i1.a`。

## 1. G5 八条判据（DevPlan §18.6 原文逐条）

### 判据 1: `✓ Root fresh bind`

- 证据: T5 row（`p5t5-root-binding`）在 T6 harness 的 boot 1 重放 S1。`S1.json`（boot 1）+ `summary.scenarios.S1.pass` + `summary.rowMounted['p5t5-root-binding-boot1']`。
- 交付状态: **T5 delivered, T6 re-verified**（T5 证据见 `dev/agent-workflow/evidence/P5-T5/`；本次由 T6 harness 以独立 DSH_HOME 重放复核，S1 全部断言 pass=true）。
- 裁决: **PASS** — `S1.json` 15/15 assertions pass=true（boot 1，`summary.scenarios.S1.pass=true`）：durable TeamSession+team-root binding 落盘、blueprint snapshot pin 读回、overlay 固定序安装、事件恰为 3×overlay-installed+1×admission-decided、ADMISSION_OPEN、leader persona 组装 === blueprint、model ref.assembled 于 assembly 边界捕获、capability tools/skills 按 available∩teamResolved∩externalHard 安装 + pre-step/pre-execute listeners 注册、mini-MCP 工具可见（`mcp__p5t5mini__ping`）、model/selection durable 事件、`session.jsonl.zstd` published

### 判据 2: `✓ Root cold bind`

- 证据: T5 row boot 2 重放 S2（restart 后冷绑 root）。`S2.json`（boot 2）+ `summary.scenarios.S2.pass` + `summary.rowMounted['p5t5-root-binding-boot2']`。
- 交付状态: **T5 delivered, T6 re-verified**。
- 裁决: **PASS** — `S2.json` 11/11 assertions pass=true（boot 2，restart 冷路径，`summary.scenarios.S2.pass=true`）：重启后零写读回（wrote:false）、cold re-admit（ADMISSION_OPEN，bound:true 且非 ordinary no-op）、事件恰为 1×scope-restored+1×admission-decided（零 overlay-installed）、本 boot 零 durable 写、model/selection 跨进程重启存活且 ref 于 resume 后首次 assembly 重捕、composed preset 携带 blueprint leader persona、surface restore 为 re-mount（composed 相同不重挂）

### 判据 3: `✓ Member fresh create setup`

- 证据: `M1.json`（boot 3，T6 row 自有证据）。关键断言：
  - 持久身份落盘: 成员记录 + team-member 绑定行（`actual.binding` / `readHandle` 读回一致，identity = (rootSessionId, instanceId)）
  - fresh 路径: `fresh: wrote/bound/installed/admitted` 全真；`installedSlots = [persona, model, capability]`；surface 事件恰为 3×`overlay-installed` + 1×`admission-decided`
  - 四槽位全装: 见 §3 解释（3 个 overlay 槽 + admission guard 决策为第四槽）
  - 会话公开可观察状态: live + durable published（`waitForDurable` 终态产物 `session.jsonl.zstd`）+ model selection 已追加
  - 写序审计: `writes exactly [putMemberInstance, putSessionBinding]`（audited writeLog）
- 裁决: **PASS** — `M1.json` 10/10 assertions pass=true（boot 3，`summary.scenarios.M1.pass=true`）：derived identity 落盘读回一致（instanceId=`inst-1vz9d1n0819t`，childSessionId=`session-child-1vz9d1n0819tzg0x`，invariant 18/23）、binding 行 `{kind:team-member, sessionId, rootSessionId, instanceId}` 读回一致、fresh 路径 `{path:fresh-member, wrote:true, bound:true, installed:true, admitted:true}`、installedSlots=`[persona, model, capability]`、事件恰为 3×overlay-installed+1×admission-decided、persona 组装 === blueprint 成员 persona（"You are the p5t6worker member, executing your assigned step and reporting facts."）、组装变量 `{provider:p5t6-static, model:p5t6-model-v1}`、capability tools `[p5t6-tool-alpha, p5t6-tool-beta]` + skill `[p5t6-skill-one]` + MCP 工具 `mcp__p5t6mini__ping` 可见、session live + durable published + model/selection 追加、写序审计恰为 `[putMemberInstance, putSessionBinding]`

### 判据 4: `✓ Member cold resume setup`

- 证据: `M2.json`（boot 4，T6 row 自有证据；进程经 boot 3 的 I1a kill 后冷启动，child A 持久会话恢复）。关键断言：
  - 冷路径: `rehydrateColdMember` 经 binder `path:'cold-member'`；绑定行预检（身份三元一致）
  - 零 fresh 副作用: `cold: ZERO durable writes this boot`（`scenarioWrites.length === 0` + `durable.wrote === false`）
  - scope 恢复: `restoreScope` 挂载成员 preset（composed 不同才挂，T5 同型 effect），事件恰为 `[scope-restored(member), admission-decided]`
  - 恢复后 scope 深度相等（`restored scope deepEq`）
- 裁决: **PASS** — `M2.json` 9/9 assertions pass=true（boot 4，`summary.scenarios.M2.pass=true`；boot 3 经 I1a 真实进程 kill 后冷启动）：binder `path:'cold-member'`、绑定行预检身份三元一致、本 boot 零 durable 写（scenarioWrites=0，durable.wrote=false）、事件恰为 `[scope-restored(member), admission-decided(ADMISSION_OPEN)]`（零 overlay-installed）、restored scope deepEq `{kind:member, rootSessionId:session-p5t6-root, instanceId:inst-1vz9d1n0819t, slots:[persona,model,capability]}`、model 投影重播（`composePath:sessionProjections`，pending selection 读回）、冷恢复后 persona 组装仍 === blueprint 成员 persona

### 判据 5: `✓ ordinary Agent unaffected`

- 证据: `M5.json`（boot 3，T6 row 自有证据）。关键断言：
  - 普通会话无任何 team 绑定行 / residency bookkeeping / agent-setup 事件
  - M1 成员记录未被本场景改动
  - **负探针**: `subagents.followup(rootAgent, memberChildId, [...], {})` 在 lineage 授权（`authorizeLineage`，先于任何 turn submit）处以 `SubagentError UNAUTHORIZED` 拒绝 —— Member 不是 continuable subagent（无 LLM 调用）
  - 探针零副作用: 成员 child 会话事件计数在探针前后不变（经 `agents.resume` 句柄实测，resume 先于 "before" 读数，delta 只含探针行为）
- 裁决: **PASS** — `M5.json` 6/6 assertions pass=true（boot 3，`summary.scenarios.M5.pass=true`）：普通会话无 team 绑定行 / 无 residency bookkeeping / 无 agent-setup 事件、M1 成员记录未被本场景改动、负探针 `subagents.followup` 于 lineage 授权处拒绝 `{name:SubagentError, code:UNAUTHORIZED, message:'subagent "session-child-1vz9d1n0819tzg0x" belongs to another parent session'}`（先于 fold/activation/turn submit，无 LLM 调用）、成员 child 会话事件计数探针前后不变（delta=0）

### 判据 6: `✓ persona semantics correct`

- 证据（T6 自有，双场景交叉）:
  - M1 fresh: 组装 persona 文本 === blueprint `memberPersonas.p5t6worker`（persona 取自 ROOT substrate + 持久记录 templateId；记录先于 bind 写入）
  - M2 cold: 冷恢复后 persona 仍组装为同一成员 persona（preset restore/mount 后读回），证明 persona 语义由持久记录锚定而非运行时缓存
- 裁决: **PASS** — M1 persona 断言 pass（组装文本 === blueprint `memberPersonas.p5t6worker`）+ M2 persona 断言 pass（冷恢复后组装仍为同一成员 persona）—— persona 语义由持久记录锚定而非运行时缓存（`M1.json`/`M2.json` 均 pass=true）

### 判据 7: `✓ model future-boundary mutation correct`

- 证据（T6 自有，双场景交叉）:
  - M1 fresh: 控制面模型选择（`modelSource.select(blueprint.defaultModel)`，app 时序：成员 setup 后选模）→ 会话 model/selection 事件追加 + 组装变量 provider/model 正确
  - M2 cold: 冷恢复时投影重播（`sessionProjections` 读回 `modelSelection.pending`，composePath 记录）→ 模型选择跨进程边界正确恢复，无未来边界漂移
- 裁决: **PASS** — M1 model 断言 pass（控制面 select 后会话 model/selection durable 事件追加、组装变量 `{provider:p5t6-static, model:p5t6-model-v1}`）+ M2 model 重播断言 pass（`composePath:sessionProjections`，resume 后首次 assembly 重捕 ref）—— 模型选择在进程边界处正确恢复，无未来边界漂移（`M1.json`/`M2.json` 均 pass=true）

### 判据 8: `✓ runtime residency can be dropped without deleting Member`

- 证据: `M3.json` + `M4.json`（boot 4，T6 row 自有证据）。关键断言：
  - M3: SETTLED 成员驱逐 —— `evictSettledMember` 对 live handle（M2 残留 residency）返回 `residencyDropped=true` 并真实 dispose；重复驱逐（handle 缺失）返回 `residencyDropped=false`（DevPlan §18.5：SETTLED 允许 handle 缺失）
  - 持久面零删除: 成员记录（SETTLED）与绑定行均在驱逐后存活；product 持久写 = 0；surface 事件 = 0（驱逐不发事件）
  - SETTLED 种子: 见 §4（P4/P5 范围内无 lifecycle 转换机制，harness 经 row 自有 repository seam 以 `harness-setup-*` 审计条目完成 delete+put）
  - M4: 再准入 = 冷路径（`rehydrateColdMember` ×2 幂等）—— scope 恢复 delta=2，零持久写，成员行/绑定行/会话各一（无重复 Member/Session）
- 裁决: **PASS** — `M3.json` 8/8 + `M4.json` 6/6 assertions pass=true（boot 4，`summary.scenarios.M3.pass=true`、`summary.scenarios.M4.pass=true`）：evict1（live handle）`{path:evict-settled, residencyDropped:true}` 且句柄真实 dispose、evict2（handle 缺失）`{path:evict-settled, residencyDropped:false}`（SETTLED 允许 handle 缺失）、SETTLED 记录与 team-member 绑定行驱逐后存活（身份不变）、product 持久写=0（2 条 `harness-setup-*` 审计条目分离计数）、evict 路径零 agent-setup 事件（场景基线 delta=0）；M4 双次冷再准入均 `{bound:true, wrote:false}`（幂等）、成员行=1/绑定行=1（从未 re-point）/会话=1、restoreScope delta=2、零 product 写

## 2. I-1 硬要求（真实 OS 进程 + 真实 StorageDomain；补充 P4-T5 file-seam 规范套件，后者保持 green）

### I1a — 崩溃窗口（durable 写入中途 kill）

- 机制: 见 §0。`summary.i1.a`: `windowObserved=true`（`recordWritten=true && bindingWritten=false` 被真实观测）、`kill.killed=true`（真实进程终止）、`stateAtKill` 快照。
- 重放正确性: `I1A.json`（boot 4 收敛重放）—— 预检识别 record-missing+binding-present 的 I1C 型 / record-present+binding-missing 的 I1A 型；本例（record 已落盘、binding 未落盘）重放恰写 `[putSessionBinding]`，无重复成员，record+binding 收敛一致，durable published。
- 裁决: **PASS** — `summary.i1.a`: `armed=true`、`windowObserved=true`（`recordWritten=true && bindingWritten=false` 真实观测，windowWaitMs=419）、`stateAtKill={recordPresent:true, bindingPresent:false}`、`kill={killed:true, portFree:true}`（真实 OS 进程终止）；`I1A.json` 5/5 pass=true（boot 4 收敛重放恰写 `[putSessionBinding]`，无重复成员，record+binding 收敛一致，durable published）

### I1b — 版本损坏（fail-loud，无静默迁移）

- 机制: 预 boot 将 `team_domain.json` 的 `unit.version` 置 999（原始字节备份于 `team_domain.json.corrupted-preboot`）→ boot 6 启动。
- 证据: 插件 setup 以 `SCHEMA_VERSION_MISMATCH` 失败（`setup-failure.json`，`summary.i1.b.setupFailureCode`）；失败 boot 后损坏文件字节未变（`summary.i1.b.fileUnchangedAfterFailedBoot === true` —— 无静默迁移/重写）。
- 裁决: **PASS** — `summary.i1.b`: `corruptedVersion=999`、`expectedCode=SCHEMA_VERSION_MISMATCH`、`setupFailureCode=SCHEMA_VERSION_MISMATCH`（boot 6 插件 setup 大声失败，`setup-failure.json` 记录 error/code）、`fileUnchangedAfterFailedBoot=true`（损坏文件字节在失败 boot 后未变 —— 无静默迁移/重写；原始字节备份 `team_domain.json.corrupted-preboot`）

### I1c — 重启幂等（记录丢失重放）

- 机制: 预 boot 经产品 `memberIdentityKey` 计算 key，从持久 unit 删除成员 A 记录（`summary.i1.c.deletedKey`）→ boot 5 重放。
- 证据: `I1C.json` —— 收敛重放恰写 `[putMemberInstance]`（binding 已在且一致），记录重建唯一一行，team 规模 2（A+B 无重复），绑定行存活，会话唯一，零崩溃。
- 裁决: **PASS** — `summary.i1.c`: `deletedKey={"instanceId":"inst-1vz9d1n0819t","rootSessionId":"session-p5t6-root"}`（预 boot 经产品 `memberIdentityKey` 定位并删除持久 unit 中成员 A 记录）、`I1C.json` 6/6 pass=true（boot 5 收敛重放恰写 `[putMemberInstance]`，记录重建唯一一行、team 规模恰 A+B、绑定行存活且从未 re-point、child 会话唯一（resume 非 recreate）、无 crash）

## 3. 解释一: ruling R34 "四槽位全装" 的口径

R34 要求 fresh create 时"四槽位全装"。本模块的实现口径（同时记录于 `packages/runtime/member-residency/README.md`）：

1. `persona` overlay 槽（成员 persona preset 挂载，ROOT substrate 解析）
2. `model` overlay 槽（模型选择能力，控制面 select 在成员 setup 后执行，app 时序）
3. `capability` overlay 槽（工具/技能/MCP 能力面）
4. **admission guard 决策**作为第四槽：fresh 路径在装配完成时记录 `admission-decided`（guard 按 directive 场景策略裁决；binder 记录决定）

M1 的 surface 事件证据（3×`overlay-installed` + 1×`admission-decided`）即"四槽位全装"的可观察对应物。

## 4. 解释二: M3 SETTLED 种子的理由

DevPlan 对象模型中 MemberInstance lifecycle 含 SETTLED，但 P4/P5 范围内**未交付 lifecycle 转换机制**（无 transition API）。M3 判据要求"驱逐一个 SETTLED 成员"，harness 因此以 **harness-setup 操作**（经 row 自有 repository seam，非产品 fresh/cold 路径）完成 `delete + put(settled)`，两条写入以 `harness-setup-member-delete` / `harness-setup-member-put-settled` 审计条目记录于 writeLog，与 product 写入（audited proxy）分离计账。M3 断言"ZERO product durable writes"即验证驱逐本身不产生产品持久写。若未来交付 lifecycle transition API，此种子可替换为 transition 调用（不影响判据语义）。

## 5. 模块边界与公开面

- 产品模块: `packages/runtime/member-residency/`（erasable TS，纯注入句柄；`fresh-member` / `cold-member` / `evict` 三个入口；`createMemberDomainWritePort` / `deriveMemberIdentity` 等工厂）
- 公开面登记: `dev/agent-workflow/evidence/P5-T6/public-surfaces.md`（composition seam、host 服务、vNext 控制面、持久产物、测试基础设施面，全部 file:line 溯源）
- CORE PATCH BUDGET = 0 保持: p4t6 扫描器负向控制 green（257 files，hits 全部在既有 quarantine）；本任务未触碰任何 upstream 源码

## 6. 单元层（mock-first，规范绿）

- `packages/runtime/test/p5t6-{fresh-member,cold-member,evict-readmit}.test.ts` + `p5t6-helpers.ts`（37 测试）
- 全量套件: `node scripts/run-tests.mjs` → 925/925（baseline 888 + 37）
- tsc: `packages/storage` / `packages/domain` / `packages/contracts` / `packages/runtime` 全部 clean

## 7. 汇总（canonical run 已回填 — counted attempt 2，`run-log.txt` VERDICT: PASS）

- 验证链: leg1 install / leg2 全量 925/925 / leg3–5 tsc storage/domain/contracts / leg6 tsc runtime（DEBUG）/ leg7 真实实例 harness —— 7 leg 全 EXIT=0（`run-log.txt` 逐 leg verbatim）
- harness 场景: S1/S2/M1/M2/M3/M4/M5/I1A/I1C —— 9/9（`summary.json` `summary.pass=true`）
- G5 判据: 8/8（§1）
- I-1 组: I1a/I1b/I1c —— 3/3（§2）
- 自检: test-use pristine（前后 head 一致 `cd5ef81…e2bbc`，status 空）、3180/3181/3491 释放、:3080 前后 GET 均 status=200（`run-log.txt` selfcheck-before/after + `summary.json`）
