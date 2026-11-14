# 05 — Scripted Model、Contract Oracle、独立副作用证明

[返回索引](README.md) · [World Factory](06-WORLD-FACTORY-AND-FAULTS.md) · [不变量和负控](12-INVARIANTS-AND-NEGATIVE-CONTROLS.md)

## 1. 为什么不能用真实 LLM 当确定性安全测试输入

LLM 的工具选择、重试次数、解释性文字不是稳定的单元测试输入。测试执行基础设施时，应固定模型输出、真实运行工具/权限/审批逻辑；把真实模型性能另列 Evaluation。这样能把“模型决策失败”和“Harness 权限失效”归因分开。

参考 [OpenAI Agents SDK testing](https://openai.github.io/openai-agents-js/guides/testing/) 的 `ScriptedModel` / `assertComplete()`：只替换模型 I/O，模型额外调用与未消费的预定交互都报告失败；沙箱进程、持久化及 OS fidelity 仍在真实 Provider 集成测试中验证。不是引入 OpenAI SDK 为依赖。

## 2. 推荐接入边界

~~~text
Scripted Model Adapter (controlled tool-call envelopes)
   -> real DSH model adapter
   -> real ToolDefinition resolution + agent session/router
   -> real Agent Execution Realm / ControlService / review state
   -> real tool executor / OS-constrained subprocess / trusted scoped service
   -> independent effect witness + structured observations
   -> Contract Oracle
~~~

未来宿主工具路径以 [PR #765](https://github.com/ArmourPiercer1/dsh-agent-team/pull/765) 的受审核新架构为准；本测试设计只要求在 **真实公共工具调用入口** 施加预定输入，不深耦合旧 ToolPlane 内部实现。

- 模型替身应适配 DSH 实际模型 API 及 streaming 特征；不需要模拟完整 DSH Agent Runtime。
- 可以 Mock 网络服务、LLM、MCP peer、故障时钟；禁止在验证工具治理时 Mock 真实审批决策、授权边界、被测路由或实际执行器。
- 允许分层：E0 纯策略函数使用内存输入；E1 真实 Router/Executor 的进程替身；E2 必须真实宿主与受控模型输出。
- 所有 Scripted turn 有顺序/请求匹配与断言；多出一步、缺一步、出现未预期的 ToolCall 均失败。

## 3. 统一测试场景输入（示意）

~~~json
{
  "schema": "agent-script/1",
  "world": "fresh",
  "actor": "member",
  "turns": [
    {
      "expect_request": {"tools_include": ["bash"]},
      "respond": {"kind": "tool-call", "name": "bash", "args": {"command": "printf test > /outside/forbidden"}}
    },
    {
      "expect_tool_result": {"outcome": "DENIED"}
    }
  ],
  "assert_no_unconsumed_turns": true
}
~~~

命令和目标路径仅为受控测试世界的示意，不能向真实宿主关键目录写入。具体 wire 形状必须按目标 DSH ModelProvider 的真实协议适配。

## 4. Contract Oracle 输入与状态

最低输入：
- reference contract version、World identity、Agent/Tool/Execution identities；
- 真实 Host 的入站 ToolCall 与路由/审批事件；
- Durable ledger/recovery 状态（只读），合法执行阶段；
- 独立效果 witness：文件存在/摘要/目录快照，进程/PTY 创建事实，HTTP 代理请求计数与网络出口事实（按合同适用范围）；
- 计划中的观察窗口、可控 barrier 与顺序约束。

Oracle 返回 `SATISFIED`、`VIOLATED`、`INCONCLUSIVE`、`INSTRUMENT_ERROR`；必须保留合同 ID、观测与限制。对必需合同，后三者一律不得通过 CI。Oracle 不能写入真正的 Control/Realm/Authority 状态。

## 5. 安全性质样例

定义 `Authorized(e)` 为请求 e 对 **该执行身份与该时刻** 有有效授权，`EffectObserved(e)` 是独立见证的副作用。安全性质的操作性版本：

~~~text
for each relevant execution e:
  if not Authorized(e):
    assert no matched effects in specified World / observer scope and time window
  assert deny was returned to agent through the real tool path
  assert no unexpected retry/dispatch
~~~

必须说明观察限定：未观察到文件副作用不等于证明任何可能的网络/进程效果均不存在；对未接入的效果域披露 `UNOBSERVED_EFFECT_DOMAIN`，不能无限扩大声明。

针对 Sticky Stop 的有限事件轨迹：
~~~text
Stopped(team) and no AuthorizedManualResume(team)
=> no newly dispatched execution for that team
~~~
不可将日志中的 `STOPPED` 或 `DENIED` 文本当作独立证据；它只是被观察对象的一部分。

## 6. 结构化 Trace 事件

建议最小事件 schema：

~~~json
{
  "schema": "agent-execution-event/1",
  "event_seq": 42,
  "run_id": "<run>",
  "world_id": "<world>",
  "execution_id": "<execution>",
  "actor_id": "<agent>",
  "realm_id": "<realm>",
  "event_type": "tool.execution.denied",
  "authority_ref": "<decision-or-null>",
  "caused_by": "<event-id-or-null>",
  "outcome": "DENIED",
  "effect_id": null
}
~~~

- 单进程排序可用严格序列号，跨进程用 causation / correlation ID 和显式 barrier；不要仅比较墙钟时间。
- 原始数据不足时返回 `INCONCLUSIVE`，不得臆造顺序或把缺失事件当作没有发生。
- Event schema 仅用于观察，不能成为 DSH 权限状态的第二数据库。

## 7. 有针对性的负控

- 在受控测试副本中跳过授权检查，效果 witness 应把契约判红；
- 错绑请求/执行身份、重用审批，Oracle 应判红；
- Stop 后强迫一次派发，应判红；
- Scripted Model 预期两轮但实际三轮，应判红；
- 只有日志出现 `DENIED`、实际外部文件已被写入时，Oracle 必须判红；
- 禁用观察器或损坏 Trace，必须返回 INCONCLUSIVE/INSTRUMENT_ERROR，不能返回 PASS。
