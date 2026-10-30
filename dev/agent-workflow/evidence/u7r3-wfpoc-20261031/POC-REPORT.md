# u7r3-wfpoc — workflow bounded Public-API PoC (USER-RULING-20261031 §4)

Lane: U7-R3-WFPOC. Mandate = the ruling's five questions (§4): ① Host 是否有可用的公开编排接口；②
工作流步骤如何继承权限；③ 取消如何传播到子任务；④ 生命周期如何保证安全收束；⑤ 结果如何被可信地归属和读取.
Method = 有界 Public API PoC. **Verdict: route B — defer the workflow positive function to Alpha.6.**

## 席位与模型披露（seat + model disclosure）

- 席位：独立只读调查子代理（delegated subagent seat）。**非 participant**：本席位未参与任何被审 PR 的实现，
  未改动 Host 树、未改动本产品树任何执行文件、未 boot、未占 pool。
- 模型：`qwen3.8-flash-next`（DSH harness 下运行）。
- 覆盖 head sha：本报告断言的对象 = `origin/master` @ `89d96a13d3219aa52b49d3c4b94adfb512b3fb95`
  （本分支 `task/u7r3-wfpoc-20261031` 的基座）与 pristine Host @ `639ed015397290b3745d163aafe02ffee4aa3f84`。

## 基线与可复核性

| anchor | value |
| --- | --- |
| Host（引用唯一对象） | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` = `0.2.0-rc.2`，porcelain 实测空（探针内建断言） |
| pins 来源 | `tests/paths.mjs` `DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA`（唯一来源，本目录不复制硬编码） |
| 产品基座 | `origin/master` @ `89d96a13d3219aa52b3492beb42d30a1ba59daf7` |
| 离线探针 | `probe-citations.mjs` → `probe-output.txt`：**62 claims / 0 failures**，exit 0（37 条 Host 正面引用 + 6 条 negative「缺失即结论」+ 19 条本树引用）。纯文本读取：无 boot、无端口、无 pool、无网络；pristine 树 HEAD/porcelain 不匹配即 exit 2 |

引用行号全部经该探针机械校验（`H:` = Host 根，`P:` = 本产品树，两侧都在机器校验范围内）；本树断言的对象 = 本分支 head，Host 断言的对象 = pinned pristine。

---

## ① 公开编排接口 — **存在（PASS），但在已发货组成里不在 host plane**

**答案：有。** 唯一公开入口 = Cordis Service Definition `ctx.workflowEngine`，一个抽象 Service，
一个方法：

- `H:packages/workflow/workflow/src/index.ts:31-34` — `declare module '@deepseek-ai/cordis' { interface Context { workflowEngine: WorkflowEngine } }`；
- `H:packages/workflow/workflow/src/index.ts:157-168` — `abstract class WorkflowEngine extends Service` / `abstract start(request: WorkflowStartRequest): WorkflowRun`；
- `H:packages/workflow/workflow/src/runtime-types.ts:19-34`（`WorkflowStartRequest`：`script` / `meta` / `args` / `subagentProvider` / `maxTotalAgents` / `parent` / `signal`）、`:40-48`（`WorkflowRun{result never rejects, cancel, dispose}`）；
- 包 `@deepseek-ai/dsh-workflow` `publishConfig.access: public`，exports `.` / `./types` / `./invariant`；公开文档 `H:docs/subsystems/workflow.md`。
- 提供方 `@deepseek-ai/dsh-workflow-ptc`（PTC 沙箱引擎）；模型侧消费者 `@deepseek-ai/dsh-tool-workflow`（`inject: ['tools','workflowEngine','systemPrompt']`，`H:packages/workflow/tool-workflow/src/index.ts:41`）。

**realm caveat（这是本 lane 的第一个非显然结论）**：在已发货 web-app 组成里，host plane 的 `workflow-ptc`
被显式停用（`H:packages/bundle/web-app/cordis.patch.yml:537-538` `- id: workflow-ptc` / `disabled: true`），
引擎被挂进 preset 的 `delegation` 组且 `isolate: workflowEngine: true`
（`H:packages/bundle/web-app/presets/standard.patch.yml:83-84, :119-120`）。isolate realm 的实现存于 realm-private
symbol（`H:vendor/cordis/src/reflect.ts:238` `const key = this.ctx[symbols.isolate][name]`），preset 服务向 root realm
泄漏会在挂载期直接抛错（`H:packages/preset/agent-preset-registry/src/mount.ts:267`
`Preset services require isolate realms`）。

⇒ 我们现有 seam 的取法 `cap.hostService('workflowEngine')`（= `agentCtx.get(name)`，
`P:packages/runtime/src/plugin/live/team-tool-plane.mjs:1602-1606`）在该组成下**返回 undefined**，
这不是 bug 而是 isolate 的设计语义（base bundle 里反而是 host plane：
`H:packages/bundle/base/cordis.patch.yml:393-396`）。

**公开替代取法（不是私有 import）**：`agentPresets.serviceFor(agent, 'workflowEngine')` —
`H:packages/preset/agent-preset-registry/src/index.ts:297` 实现，且位于 **generated public catalog**
（`H:docs/subsystems/core.md:545`，`### ctx.agentPresets` 节 @ `:487`，块内标记
`BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts)`）。`agentPresets` 本身在 host plane
（`H:packages/bundle/web-app/cordis.patch.yml:561-565`）。我们的 mount 已持有 DISPATCH 提供的 `exec.agent`
（`P:packages/tools/agent-control-family/src/workflow-row.mjs:34`）并已 join preset
（`P:packages/runtime/src/plugin/live/agent-bindings.mjs:2295` `presets.composedPreset(agentCtx)` 探针、
`:2306` `presets.mount(agentCtx, …)`，id 缺省 ⇒ deployment default），条件齐备。

**presence 是 preset 事实、不是保证**：`minimal` preset 一个 workflow 行都不挂
（`H:packages/bundle/web-app/presets/minimal.patch.yml` grep `workflow` = 0）；`standard`（deployment default）挂。

## ② 步骤权限继承 — **不通过（FAIL）：继承由 Host 侧固定，调用方没有可写入口**

**答案：继承存在，但继承什么由引擎决定，不由调用方决定；统一 PA/Control 授权链无法沿公开 seam 保持。**

事实链（决定性）：

1. 引擎**自己**起子任务，不回调调用方：
   `H:packages/workflow/workflow-ptc/src/host.ts:200-211` —
   `this.subagents.start(this.provider, { prompt, parent, signal, outputSchema?, agentOptions? })`。
   请求体里**没有 `toolFilter`**（探针 negative claim：`host.ts` 全文无 `toolFilter`）。
2. 公开 start 契约里**也没有**给调用方留任何收窄位：
   `H:packages/workflow/workflow/src/runtime-types.ts:19-34` 全文无 `toolFilter`（探针 negative claim）。
3. 子任务工具视图只在"有人传了 filter"时才收窄：
   `H:packages/subagent/subagent/src/child-agent.ts:218`
   `if (composition.toolFilter !== undefined) childCtx.tools.restrict(composition.toolFilter)` — 无人传 ⇒ 不收窄。
4. 脚本自己可以挑路由：`H:packages/workflow/workflow-ptc/src/runtime.ts:33`
   `SUPPORTED_AGENT_OPTIONS = new Set(['label','phase','schema','provider','model'])`，
   经 `host.ts:205-210` 变成 `agentOptions:{provider,model}`；`agentOptions` 能力位由 provider 声明
   （`H:packages/subagent/subagent/src/index.ts:645-649` `assertCapabilities`）。
5. **公开继承的到底是什么**：父 session 的文件策略
   （`H:packages/workflow/workflow-ptc/src/index.ts:166`
   `runCtx.sandboxPolicy.resolve({ session: request.parent.session })`）、lineage（`parent`）、
   preset composition（`child-agent.ts:206` `composeFrom(childCtx, parent.ctx)`）。

对照我方现行法律：Tier A 要求每个子任务强制 `toolFilter:{allow:[]}` 且 spec 禁带
provider/model/agentOptions（`P:packages/tools/agent-control-family/src/agent-runtime-port.mjs:82-83, :198-205`）；
law (c) 要求工作流只能经 caller-bound delegate 触达 agent
（`P:packages/tools/agent-control-family/src/agent-control-executor.mjs:203-237`）。
Host 引擎的 `start()` **不接收**这两样东西——它根本不看调用方的 delegate。

**唯一候选 route-A seam（公开、非私有、无 Host 改动）**：`ctx.subagents.registerProvider()`
（`H:packages/subagent/subagent/src/index.ts:512-528`，effect-scoped，`DUPLICATE_PROVIDER` 守卫）注册一个我方
governed provider，再用 `WorkflowStartRequest.subagentProvider`
（`H:packages/workflow/workflow/src/runtime-types.ts:27`，解析点
`H:packages/workflow/workflow-ptc/src/index.ts:67-79`）把工作流的孩子整体改道到我方 provider。

**为什么它仍不满足"保持统一 PA/Control 授权链"（三条，逐条可驳）**：

- **授权来源退化**。我方现行法要求 caller 由 DISPATCH 携带、绝不由环境推导
  （`P:.../workflow-row.mjs:34` 原文："DISPATCH-provided, never derived from the ambient session — the native
  callingAgent law"）。provider 被引擎调用时，唯一可用的是 `request.parent`（一个 Agent）——authority 必须**反推**，
  正是本仓明令禁止的 ambient-derived caller。
- **law (c) 的执法点消失**。executor 的 `workflow:` 行现在把 `spawn`/`steer`/`enumerate` delegate 交给 port leg
  （`P:.../agent-control-executor.mjs:245-275`）；Host 引擎从不接收它们。若把 fence 搬进 provider，fence 就搬到
  **PA 门之外的另一块自造 authority surface** 上——即 ruling §4 所推迟的"自建"路径，不是公开 seam 的既成能力。
- **逐步准入不可审计**。一次 `workflow` 行调用 = 一次 PA admission + 一个声明效果集；其内 N 个孩子由引擎自行 spawn。
  "第 k 个孩子由哪次准入授权"因此无法重建——这与 AC-16（C1 现测得"一步一 spawn"，
  `P:packages/runtime/test/u7-f-agent-control-c1.test.ts:307-315`）所假设的形状直接冲突。

我方 law (c) 的原文判据也直接把它排除在"公开 seam 既成能力"之外——它要求脚本**只能**经
executor  supplied、caller-bound 的 delegate 触达其他 agent，且每一腿重过 fence
（`P:packages/tools/agent-control-family/src/workflow-row.mjs:3-8` "a workflow script reaches other agents ONLY
through the executor-supplied, caller-bound spawn/steer delegates"；
`P:packages/tools/agent-control-family/src/agent-control-executor.mjs:204-206` "the legs run as THIS caller and no
other, and every spawn re-passes the no-amplification fence"）。
Host 引擎的形态是"引擎自己 `subagents.start`"，与这一判据**形状不符**：要在 route A 满足它，
等于由我方新造一个 authority surface，属 §4 所推迟的"自建"分支。

## ③ 取消传播 — **通过（PASS），但粒度只到 run**

**答案：公开面完备。** 三条通道都在公开契约上：

- 请求侧 `signal?: AbortSignal`（`H:.../workflow/src/runtime-types.ts:33`）；外部 abort →
  `H:packages/workflow/workflow-ptc/src/host.ts:137-139` → `cancel('workflow signal aborted')`；
- run 侧 `cancel(reason?)`（`H:.../workflow/src/runtime-types.ts:46`；实现 `H:.../workflow-ptc/src/host.ts:148-153`
  abort controller + 对每个孩子 `disposeChild`）与 `dispose()`（`H:.../workflow-ptc/src/host.ts:159-163`）；
- 孩子侧：孩子的 `signal` 就是 run 的 controller signal（`H:.../workflow-ptc/src/host.ts:203`），
  abort 即驱动 `child.cancel`；abort 后才发布的迟到孩子也被就地 dispose（`:214-218`）；
  `childResult` 与 abort 赛跑（`:222-238`）。后台形态：job kill → `run.cancel`
  （`H:packages/workflow/tool-workflow/src/index.ts:307`）。

诚实边界：**单个一次性（one-shot）工作流孩子不可被点名打断**——工作流孩子经
`subagents.start()`（one-shot 形态，非 continuable；`H:packages/workflow/workflow-ptc/src/host.ts:200`）产生，
而 `ctx.subagents.interrupt()` 对 one-shot/未知 id 是"accepted no-op"
（`H:packages/subagent/subagent/src/index.ts:320-322` 原文 "An absent target — including a one-shot or unknown id —
is an accepted no-op"；实现 `:328-330` 只转投 `this.continuations`）。取消只能整 run 撤，不能逐步撤。

## ④ 生命周期安全收束 — **不通过（FAIL）：Host 侧没有任何收束保证**

**答案：没有保证。** 公开面提供的是"请求取消"和"释放资源"，不提供"必然终止"：

- 引擎**无整体时钟**：`H:docs/subsystems/workflow.md:95` "The PTC engine has no overall elapsed deadline …
  without an independent workflow cleanup deadline"；PTC 调用直接 `timeoutMs: null`
  （`H:packages/workflow/workflow-ptc/src/host.ts:281`），引擎 Config 只有
  `provider/maxConcurrentAgents/maxTotalAgents/maxItemsPerCall/syncTimeoutMs`，**无任何 run deadline**
  （`H:packages/workflow/workflow-ptc/src/index.ts:32-43, :105-111`）——探针 negative claim：该文件全文无
  `deadline|reap|maxRuntime`。
- `syncTimeoutMs` 只约束初始同步片（`H:packages/workflow/workflow-ptc/src/runtime.ts:107`），不约束 run 全程。
- `dispose()` 无清理截止：它无条件 await 子任务 quiescence（`H:.../workflow-ptc/src/host.ts:159-163`、
  finally 块 `:296-302`）——一个不收束的孩子能把 dispose 永远挂住。
- **无 service-side reaper**：`H:packages/workflow/workflow/README.md:131` "Runs are holder-owned, not
  service-tracked"。引擎卸载不追踪独立句柄。
- 超时 guard 是**协作式**且需要工具自声明：`H:packages/guard/timeout-policy/src/index.ts:2`
  "Cooperative tool-call timeout enforcer. A tool declares `timeoutMs`…"——`tool-workflow` 未声明 ⇒ 永不适用。
- 上游自认 teardown 可能卡死：`H:packages/jobs/jobs-local/src/index.ts:662`
  "…remains indistinguishable from a slow stop and may stall"。

调用方**可以**用 `@deepseek-ai/dsh-timeout` 自造 deadline（`clampTimeout()` `:45`、`deadline()` `:91`、
`idleWatchdog()` `:126`、`timeoutOf()` `:184`，
`H:packages/util/timeout/src/index.ts`）再 `run.cancel()`——这是公开件、无 Host 改动。
但那只是**发起**取消：`dispose()` 的收束仍无界，且放弃 dispose 就留下无主活跃孩子。"取消"是保证，"终止"不是。

## ⑤ 结果可信归属与读取 — **不通过（FAIL）：身份可归，值不在任何持久记录里**

**答案：身份/生命周期可公开归属与读回；结果值不在任何 workflow 持久记录中；而我方直驱引擎时，Host 一条记录都不写。**

可归的部分（公开）：

- 4 类持久记录 run-start / agent-start / agent-end / run-end
  （`H:packages/workflow/tool-workflow/src/types.ts:14-39`），append 于
  `H:packages/workflow/tool-workflow/src/index.ts:140, :115-136, :146`；
- 公开读回路径 `ctx.sessionQuery.readSession(sessionId)`
  （`H:packages/session-query/session-query/src/index.ts:184`）；seq 稠密 + replay 连续性。

不可归的部分（逐条 NOT FOUND，全部与探针 negative claim 对齐）：

- **结果值：拿得到，但不被归属。** 持有者能从 live handle 读到值——
  `H:packages/workflow/workflow/src/types.ts:72-74` `WorkflowResult{ value: unknown, stopReason, error?, agentsStarted }`。
  问题在于这个值**不落任何耐久 workflow 记录**：`workflow/end` 事件刻意不带值
  （`H:docs/subsystems/workflow.md:120` "workflow/end deliberately omits the result value"），其载荷类型
  `H:.../workflow/src/types.ts:124` `WorkflowResultInfo{stopReason, error?, agentsStarted}` **无 `value` 字段**
  （探针 negative claim）。后台值 = 内存 `JobOutcome.result`，只发一次
  （`H:packages/jobs/jobs-local/src/index.ts:592` `job.result = outcome.result`，registry 为 `Map`，`:160`）。
  前台值只以渲染后的 `tool/result` 文本形态耐久。**没有任何 runId ↔ 值 的耐久绑定**——
  值在调用者手里，runId 在日志里，二者不在同一可复核对象里。
- **我方驱动 = 零 Host 记录**：耐久记录只由原生消费者在 `exec.parent === undefined` 时写
  （`H:packages/workflow/tool-workflow/src/index.ts:440` 与后台路径 `:423`）。我方 governed row 直接
  `engine.start()` 落在该记录器之外 ⇒ 归属完全由我方 RUN Record 自建，Host 不作证。
- **childId 未经 Host 交叉核验**：guest 上报、仅形状校验
  （`H:packages/workflow/workflow-ptc/src/host.ts:63-72`）。
- **无篡改证据**：持久层无 checksum/hash chain；协议校验器 `H:packages/workflow/tool-workflow/src/invariant.ts`
  只在 `sdk-minimal` 装载（`H:packages/bundle/sdk-minimal/cordis.patch.yml:106-119`），已发货组成不载。

---

## VERDICT — **route B**

`①/③ 通过；②/④/⑤ 不通过`。按 §4 的判据（公开 API 可完成五问**且**保持统一 PA/Control 授权链 ⇒ route A），
route A 不成立。**建议：workflow 正向功能推迟至 Alpha.6；正式 scope 决定权归用户。**

逐项点名的缺失公开能力：

| Q | 缺失的那一项公开能力（点名，不是"难做"） |
| --- | --- |
| ② | `WorkflowStartRequest`（`runtime-types.ts:19-34`）**没有**任何 caller 侧工具收窄字段；引擎 `host.ts:200-211` 自起子任务且**从不**读 caller 的 delegate/authority。⇒ 缺的是"caller-carried per-step authorization + tool narrowing 的公开入口"。`registerProvider`+`subagentProvider` 是绕道，不是该入口，且使授权来源退化为 ambient-derived。 |
| ④ | 缺"run 级 elapsed deadline"与"cleanup deadline"两个公开能力，且缺 service-side reaper（`workflow/README.md:131` 明文 holder-owned）。调用方只能保证**发起**取消，不能保证**终止**。 |
| ⑤ | 缺"durable runId ↔ result-value 绑定"这一公开能力；且耐久记录的产生条件（`exec.parent === undefined`）把我方直驱排除在 Host 作证之外。 |

## 若用户仍选 route A：AC-4 seam scope estimate

零 Host 改动、零私有 import 前提下**最小**改动面（不含 C2/C3 boot 证据，那属另 lane）：

| # | 文件 | 改动 | 量 |
| --- | --- | --- | --- |
| 1 | `P:packages/tools/agent-control-family/src/agent-runtime-port.mjs:324-327` | 现在的 `default:`（"runWorkflow stays unwired at AC-1"）换成 `runWorkflow` resolver；引擎句柄取法必须是 `hostService('agentPresets').serviceFor(agent,'workflowEngine')`，**不是** `hostService('workflowEngine')` | ~60-90 行 |
| 2 | 新增 `P:packages/tools/agent-control-family/src/workflow-engine-adapter.mjs` | 我方行契约 → `WorkflowStartRequest` 翻译；自带 deadline + `finally dispose`；`meta` 合成 | ~150 行 |
| 3 | `P:packages/tools/agent-control-family/src/agent-control-executor.mjs:245-275` | 现 leg 形状 `{caller,script,spawn,steer,enumerate,signal}` 是我方发明，Host 引擎不认；须改为 engine-request 形状 ⇒ 连带 AC-51 声明效果集断言（`P:packages/runtime/test/u7-f-agent-control-c1.test.ts:774-788`） | ~40-70 行 |
| 4 | `P:packages/runtime/src/plugin/live/team-tool-plane.mjs:1598-1607, :1629` | `cap.hostService` 面须能取到 `agentPresets` 与 `subagents`（两者均在 host plane，可达；`workflowEngine` 本身在 preset realm，不可达） | ~10-20 行 |
| 5 | `P:packages/runtime/test/u7-f-agent-control-c1.test.ts` | workflow 正向 case 现跑在 FAKE port 上（`:74-103` `makeFakeRuntime`，`:307-315` AC-16）——改真引擎后这些断言形状全部失效 | 测试面重写 |

≈ 4 个产品文件 + 1 个测试文件，**~260-330 行**，零 Host patch。

**且必须一并披露的语义变更**：`workflow` 行现参数是封闭 `{description, prompt}` + `additionalProperties:false`
（`P:packages/tools/agent-control-family/src/workflow-row.mjs:19-27`），而引擎要的是 `script` = 一段 **JS 程序**
（`runtime-types.ts:19-21`）。route A 必然把"模型自撰 JS 程序在父 session 文件策略下的 PTC Node 沙箱中执行"
引入受治理面——这是产品语义变更，属用户 scope 决定，不是本 lane 可以顺手取得的。

## 本轮不改动的真相（保持原样，不借光）

- `runWorkflow` 仍 **UNWIRED**：`P:.../agent-runtime-port.mjs:324-327` 返回 null，executor 逐腿拒
  `LEG_UNWIRED`（`P:.../agent-control-executor.mjs:182-183`，`:248-249` 点名 "leg 'runWorkflow'"）。
  AC-81 未接线发现**维持**。
- `workflow` 矩阵行维持 `UNKNOWN`（`P:docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md:110`），
  **L3/L4 一律 NOT_VERIFIED**：本 lane 无 boot、无 pool、无运行时观测，任何 L3/L4 声称都无证据基础，不借用他行结论。
- C1 套件的 workflow 正向断言（`u7-f-agent-control-c1.test.ts:307-315` 等）证明的只是**我方 port 契约**，
  从未触及 Host 引擎——本报告不把它读作 Host 能力证据。

## 本目录文件

| file | what it is |
| --- | --- |
| `POC-REPORT.md` | 本文件：五问裁决 + 引用 + route A/B 判定 + AC-4 seam scope estimate |
| `probe-citations.mjs` | 离线引用探针：62 项 file:line 断言：Host 树 37 正 + 6 negative（"缺失即结论"）+ 本树 19；pristine HEAD/porcelain 与 `tests/paths.mjs` pin 不符即 exit 2；纯读文本 |
| `probe-output.txt` | 该探针的一次完整输出（`claims=62 failures=0`，exit 0） |

探针运行：`node dev/agent-workflow/evidence/u7r3-wfpoc-20261031/probe-citations.mjs`（工作区内，离线，只读）。
