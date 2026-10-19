# DEF-CHANGELOG — guard/dispatcher 定义变化史（Alpha.5，基线=PR #249/阶段计划冻结语义）

C 路对账（只读）；取证 2026-10-19T07:3x–08:1xZ；树 = `.worktrees/a5-guard-schema` @ `d5de7497`。
基线语义源：`docs/plans/memo/alpha5-tool-io-governance/{alpha5-s0-pr0-pr8-implementation-plan.md, post-poc-technical-design.md, tool-fork-debt.md}`（PR #249=b6c99de2 落档）+ `dev/agent-workflow/PENDING-GATES.md`（G-a/G-g/D-1）。
所有日期 UTC。消费方=file:line 现场核于 d5de7497（dist 镜像不计）。

## 0. 版本面速览（谁钉消费方集）

- 治理律/装配面唯一审计：`scripts/audit-a5-tool-governance-imports.mjs:70-92`（PR1_CONSUMERS allow-list）+ `packages/domain/test/a5p0-layer-audit.test.ts`（逐文件钉，防前缀走私）。
- allow-list 现状（同文件注释即史）：`runtime/tool-dispatch/`、`runtime/src/plugin/live/agent-bindings.mjs`、`.../team-tool-plane.mjs`（GLUE-7/#313 feed 面）、`.../ptc-escalation-row.mjs`（#334）、`runtime/tool-admission/`（PR2）、`runtime/controlled-fs/src/`（PR3）、`tools/a5p5-tools/src/`（PR5）。**新增 consumer=设计变更**（audit 注释原话 "a second consumer is a design change, not an import accident"）。

## 1. 主链条目（tool-dispatch Guard + Scoped Dispatcher 本体）

### E1 · db5cb5f7（PR1 #255，合入 2026-10-16T08:06:56Z）——定义诞生
- **变更前**：无按调用闭世界裁决。PR0（domain/tool-governance）只有代数（§5 错误词汇、ToolBinding 迁移表）；Setup Coverage Gate 是一次性诊断。
- **变更后（冻结语义，`tool-dispatch/index.ts:7-31` 头注）**：①覆盖门=DIAGNOSTIC，**按调用单调闭世界裁决**才是门；②Team Agent 形状 STABLE——Binding 变更翻不可变 revision，**名永不卸载让原生 Body 回来**（NEG-1 实测：mask 先撤→晚解析跑了原生 Body 一次）；③teardown 有序自计数：拒新调用→保持 mask→cancel/drain→tombstone→**只在自计数零释放**，不因 Cordis dispose 返回；④非 Team 会话零触达；执行无 Agent 身份到达 Team scope=拒（NEG-2，不洗进 global lane）。
- **偏离计划**：无（=计划 §4/design §4.1/§4.2 的字面实现）。
- **现消费方**：`agent-bindings.mjs:433`（import）/:2311（installScopedToolGuard）/:2766（`alpha5-tool-dispatcher-not-published` 失败形）；dispatcher 本体 `scoped-dispatcher.ts`（668 行）。

### E2 · 452a04c0（PR1r #257，合入 2026-10-16T17:02:20Z）——R-a 归因收紧 + R-b 姿态重写 + revision 修复
- **R-a 前**：native **NAME** 在可信清单上即得 verified Binding（`bindInheritedSurface`）。
- **R-a 后**：三事实齐才 verified（名在可信原生清单 ∧ 本 Agent 可钉 Definition ∧ 可信(scope-less) `tools.get(name)` 解析**同一** Definition）；分歧=UNVERIFIED `native-shadowed`，可信侧不可读=`native-unreadable`，publish 记 `published-surface-shadowed`。显式 Team bind（bindOwnTools/bindMcpTools）是 Team 同名 Definition 唯一准入路。
- **R-b 前**（PR1 姿态）：门只重问 Active；「一次调用暴露后在 settled 边撤验证」。修前独审（dd70ef3c @09:17:33Z）实测证伪：`callEdgeWithdrawal=0`、Body 仍跑（v2=1）→ B1 阻塞。
- **R-b 后（最终冻结语义，=用户 B3 方案(ii) 裁决）**：`tools/execute` 门（离 Body 最近）**重问整个闭世界问题**；门内 `armWrapperSignal` 武装监视持续到 `tools/result` settled 边；`(scope,name)` 定义移动/不可读 ⇒ 取消未执行调用（Host 在 `:1572`、resolveExecution `:1578` **之前**读到抬起的信号 ⇒ bodyInvoked 保持 false）；对已开始 Body=abort 请求传播，`ABORTED`→`dispatcher-call-terminated-after-body-start`（`sideEffectPossible:true`，值保留，绝不标未执行）。
- **revision 修复**：显式 re-bind 现写 `revision=(in force ?? 0)+1`（PR1 恒写 1，文档化"拒+re-bind"恢复路此前不成立）。
- **偏离计划**：**有=已裁扩大取消范围**。原计划要求"refuse the concurrent replacement before the Body"；17:52Z 用户裁决改为「取消关联未执行调用+向已开始调用传播 abort」，PENDING-GATES G-a 在册（含自declared「不回填为 17:02 合并时已批准」）。选项分析：(a) 回归原语义=需公开可信 body-start 检查=D-1 延期（`bodyInvoked` 私有 core `index.ts:1580`）；(b) **承认新语义=现状（既成，G-a 已按此推进验收）**。建议维持 (b)，负披露引 G-g/D-1 既有行。
- **现消费方**：`install.ts:454`（pending-calls 台账）/:503/:764/:954/:961/:975/:989/:999（拒发点）/:722（terminated-after-body-start）/:805-806（endCallById+settle 唯一结算点）/:882/:994（armWrapperSignal）/:1046（onRegistryChange→取消）；`agent-bindings.mjs:2322-2326`（bindingFeed 读 placement 图）。
- 治理注：本条完整事实链（DO-NOT-MERGE 标题/BLOCKED→用户 B3 裁→修后独审 PASS@ d5890103→owner squash）见本目录 `DEF-#257-FREEZE.md`（判定=有留痕裁决解冻，技术面无活缺陷）。

### E3 · 68deccaa（P-B-R2 binding feed v2，合入 2026-10-17T20:13:15Z）——provider 侧接线（律不动，装配收紧）
- **前**：按调用指纹比对已在产（scoped-dispatcher `noteCallEdgeDefinition`），但 **provider 侧=Team placement 的已验 Definition 身份喂入**在一切 ref 上未接（grep bindingFeed=0）；未喂名实测吃「cannot be verified at dispatch time（无原生回退）」。
- **后**：`realmId`+`bindingFeed` 入参 + 导出 `definitionIdentityOf`（provider 与 Guard 共享同一 `def#N` WeakMap 身份代数）；`bindAll(team-own)` 三新门=realm 配对（typed 拒）/placement 归属（名须宣于 `assemblyOwnedNames`，R5 self-pin 形=拒）/placement 完整性（feed 身份≠活作用域解析=拒，绝不重钉 shadow）；全过 ⇒ provider 记录 pin `implementationOrigin:'team-trusted-extension'`（诚实源，不假标 dsh-native）。**无 feed 条目=旧路逐字节不变；guard 律与 dispatcher 未触**。
- **偏离计划**：无（pb-CONTRACT §6 的形式化）。
- **现消费方**：`team-tool-plane.mjs:78`（definitionIdentityOf import）/:739/:752（placement map 填=Guard bindingFeed 之源）；`agent-bindings.mjs:2326`（feed 读取闭包）。

### E4 · 708fb3fe（abort-cause relay #345，合入 2026-10-18T22:51:26Z）——中止原因透传
- **前**：`armWrapperSignal` 转发 abort 用自有 marker `{reason:'inherited-signal',tool}`，**丢弃**宿主 `AgentCancelCause`（实测 `{kind:'user'}` 被吞）⇒ 行闭合法（kind∈{user,parent} 才 mint `cancelled:true`）正确拒 mint——行为对、输入丢。
- **后**：`record.controller.abort(incoming?.reason ?? new DOMException('inherited-signal','AbortError'))`；错误注释更正（Node≥17.3 abort(reason) 语义）。RED 8/9→GREEN 9/9（a5r-cause-relay）。
- **偏离计划**：无（#340 shell-cancel 腿的根因修复，repair-ticket 在案）。
- **现消费方**：install.ts forward（armWrapperSignal 内）；行闭合法消费者=plane `shellCancelled`。
- **在册残留（不擅改，仅列）**：修后独审 MINOR 未采纳=arm 后两条拒发路径（install.ts:989/:999）不显式 settle 台账（settle 唯一调用点 :806，实测 leak-free，不变量依赖 result 边必发）→ 修复队列单 R-C-07（可做不可需，parent 注②已裁「入队列不即动」）。

## 2. 邻面条目（裁决/准入/批准链上改变"何时可执行"语义者）

| # | commit（PR，合入 UTC） | 语义变更（前→后） | 偏离 | 现消费方 file:line |
|---|---|---|---|---|
| N1 | ae3dcf54（PR2 #256，2026-10-16T18:31:47Z） | tool-admission lane 诞生：Operation Admission+多 Effect ApprovalCase+一次性 Grant；Guard 仍外门（deny 不触 Admission）；**合入时 DORMANT**（wiring 随 PR3/PR4）。用户裁 deny 分流：policy deny 带 provenance 入单一 ApprovalCase 非一律终局；来源不可归=`TOOL_BINDING_UNVERIFIED`/deny-source-unattributed；undetermined 整集毒化不变 | 无（§5；deny 分流=用户裁决轮） | 合入时无产线 consumer（audit 注"merges landed the imports without paying the consumer set"=登记账） |
| N2 | 74d947a3 / d69bfc4b / 2cd5185f / fc9f4a07（PR3/PR5/PR4/PR7 #259/#260/#264/#262，2026-10-16T19:25–19:52Z） | ControlledFs / search-shell schema / sandbox provider / jobs cancellation 适配器落树（全 DORMANT） | 无（计划内分批） | consumer 账见 audit 注释（4+6 文件） |
| N3 | 9e75ee83（wiring #268，2026-10-17T00:38:10Z） | compile-plane 接装轮：Lane-D 三门真修+ledger 清偿；**性质=接线准备非 live**（`wiring/WIRING-SURFACE.md:5` 在 ALPHA5-ACCEPTANCE-STATUS:21 引用） | 无 | — |
| N4 | 0027c925（P-A #303，2026-10-17T09:04:18Z） | 生产入口诞生：`createProductionAdmissionAssembly`（真 template capabilities 派生 `deriveTeamPolicyAuthority`）+ `ProductionControlledFsProvider.gateCall`；DORMANT→有产线 consumer（contract-first） | 无 | `team-tool-plane.mjs:76`（import）/:527（assembly） |
| N5 | 28d31f2a（#315 G1 安全修，2026-10-17T19:28:43Z） | 裁决次序变：lane deny/allow 在**同一原生命名空间**比较，**template-deny 现先于 backend 触发**、零副作用（前：次序可被 backend 先吃） | 无（安全修） | live 装配面（agent-bindings 裁决水瀑） |
| N6 | 1fb14c4d（#329）2026-10-18T07:47:31Z | 原生批准执行经 takeover + Gate 0b plane-names 准入（durable ask 不动） | 无 | host 批准水瀑+plane |
| N7 | b6d7c48a（#334，2026-10-18T19:32:49Z） | PTC fs 半臂产线行：一次性 grant 裁决挂上批准水瀑（S1-S6，scoped zero-widen）；grant 消费律逐字复用 PR0（identity→realm→generation→revision→fingerprint→expiry→consumption 最后一步） | 无 | `ptc-escalation-row.mjs:65-66`（grant-mint + parseRequestedEffectSet 直消）/:172（waterfall listener，绝不抛） |
| N8 | 5885e46e（#340，2026-10-18T20:14:30Z） | shell 取消腿：接宿主 `ToolExecutionInput.signal`（**仅 user/parent** mint cancelled:true；平局律 exited>timedOut>aborted） | 无 | shell 行+`shellCancelled`（后由 E4 修因透传） |
| N9 | 46e48218/ca7ab2ab/d5de7497（#342/#344/#343，2026-10-19） | 工具**挂载/关断**面：glob 独立关断键（typed-shut 零默认变）、C-16 保留名钉+双向漂移机检、glob rc-first+可信 exit record（R1）。属 A 路（工具治理）主面，此处只记**不重复计数** | — | glob-backend.mjs 等（A 路面） |

## 3. 偏离冻结计划总表（不擅改，逐条两选项）

| 偏离 | 定性 | 选项 a（回归原语义） | 选项 b（承认新语义为既定） | 现status |
|---|---|---|---|---|
| E2 R-b 取消范围（refuse-before-Body → cancel-unexecuted + abort-propagate） | 用户裁决改形（ROUTER_LOG L6226 + PENDING-GATES G-a 原文在案） | 需 D-1 上游三候选之一先公开（per-call pre-body 事件/`bodyInvoked` 公开读点/resolution-pinned Definition）——现无 ⇒ 现树不可回归 | 现状即 b：验收按 G-a 推进；负披露=G-g 静默通道**非 fail-closed**（G-7 实测被移 Body 实跑+响亮告警）+ D-1 严格属性延期 | **b 既成**；本路建议维持 b，不改 |
| G-g 静默已订阅通道（订阅成功永不投递） | 非偏离——从未宣称 supported；等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL（三项缺项在册 README:60-67） | — | 收口=证据级（PENDING-GATES G-g 行）；增强=独立后续 | 在册，勿再合并措辞（lint-g-g-wording 常跑） |
| MINOR settle 边（install.ts:989/:999） | 非语义偏离（实测 leak-free）；不变量依赖 result 边 | 1 行显式 drop/settle 硬化 | 维持实测依赖 | → 修复队列单 R-C-07（parent 注②：入队列不即动） |

## 4. 计数结论

- 主链语义变更：**4** 条（E1-E4，tool-dispatch 本体史=其 git log 全集，`git log -- packages/runtime/tool-dispatch/` 无遗漏）。
- 邻面语义变更（改"何时可执行/如何裁决"）：**8** 条（N1-N8；N9 移交 A 路面注明）。
- 偏离冻结语义且需裁决位：**0 条未决**（唯一改形 E2 已用户裁决在案；余为登记延期/卫生项）。
