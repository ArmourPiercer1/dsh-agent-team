# SEAM-RECHECK-OUTER — 外层约束注入公开面穷举（只读，root 06:53Z 授权，零改动）

writer = BIND-DIAG（同轮授权续件）。方法 = 对 pinned host 树 `tests/deepseek-harness-test-use`
@ `639ed01539`（porcelain 前后 0）纯静态读面 + 既有 w-ptc-re 行证据复引；零世界、零端口、零文件
改动（本文件之外）。全部行号对 pin 树可复核。

## 0. 缺口口径（逐字钉住）

`docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json` rows[M-08]：
notes = "保留传输不可覆盖（同名双侧 throw）；外层真实进程+内层复入同一管线；**per-call 策略注入
未证**"；untested_carried_over = "并发 Member 不同 one-shot、**外层直接 fs/net OS 级拒绝负控**、
父取消/子调用排空 drain"。本件回答：是否存在**原计划支持的**公开面，可在不改 Core、不改网络姿态
下把外层程序（run_code 真实进程）自身 I/O 纳入 per-call 治理。

## 1. 逐面裁决（一面一行）

| # | 公开面 | 裁决 | 锚点（file:行，pin 树）| 一句理由 |
| --- | --- | --- | --- | --- |
| F1 | `tools.register` / `tools.restrict` 系（root+scoped） | **不能**（外层程序直接 I/O；内层复入已闭合另计） | w-ptc-re README M-08-A4 四侧 throw 记录（`runs/*/criteria.json`）+ closed-world-guard 法则针（bind-diag `runs/*/repo-citation-anchors.json`） | 该面治理**工具名表面**与绑定；外层程序直接 fs/net 不是工具调用，restrict 的校验域=名字（w-ptc-re 实测三态），不触及进程 I/O |
| F2 | fiber `ctx.*` 服务面（`ctx.sandboxPolicy.resolve`、`ctx.get('ptcRuntime')`、`ctx.approval`）——**观察/解析侧** | **不能（单独）** | `packages/sandbox/sandbox-policy/lib/types/index.d.ts:88`（`resolve(request?)`）；`packages/core/tools/lib/types/ptc.d.ts:45-53`（`RunCodeBridgeOptions` = **Registry-private**：`resolveSandboxPolicy: (exec: ToolRunContext) => SandboxExecutionPolicy` 闭包只有属主 registry 能铸） | run_code 外层的策略由 registry 私有闭包解析（standing Session authority）；行只能读/解析同一面，无处喂 per-call Grant 进该闭包——但它是 F4/F5 包装件的原料 |
| F3 | sandbox API 面（策略对象与执行回读） | **fs 能 / net 不能** | `packages/sandbox/sandbox/lib/types/index.d.ts:19`（SandboxMode 三值词表）、`:16-17`（"**Network and process visibility are outside this vocabulary**"）、`:48-55`（SandboxPolicy "carried PER CALL, not fixed on the provider…an approved escalated retry is a new call with a wider policy"）；`packages/sandbox/sandbox/lib/types/escalation.d.ts:84-101`（`EscalationApprover.request({agent, toolName, callId, …})` = 原生 per-callId 加宽通道）；`packages/ptc-runtime/ptc-runtime/lib/types/types.d.ts`（`PtcRunSandbox{mode, denied, enforcement}` 每跑回读） | fs 臂：策略对象天生 per-call 形、有 OS 强制消费方（与 Bash 同一 sandbox service）、有每跑回读；net 臂：**词表里不存在**——任何面都驮不动（见 F6） |
| F4 | provider 装配面（profile-patch 行） | **能（fs 臂）** | `packages/bundle/base/cordis.patch.yml:390-391`（`- id: ptc-runtime / name: '@deepseek-ai/dsh-ptc-runtime-node'` = 普通可寻址行，**无 config**）；同文件头 + `packages/bundle/web-app/cordis.patch.yml:4-7`（公开语法：按 id 覆写、last-write-wins、`disabled: true` 行动词）；`packages/ptc-runtime/ptc-runtime/lib/types/index.d.ts:58-63`（`ctx.ptcRuntime` = 服务槽，"Registers one implementation"）；`packages/core/tools/lib/types/ptc.d.ts:55`（run_code `requireRuntime: () => PtcRuntime` 消费的正是 `ctx.ptcRuntime`） | 公开 patch 语法允许 disable+insert 覆写 `ptc-runtime` 行 ⇒ 装配方可换上一个 **PtcRuntime 包装实现**（同槽唯一注册），run_code 无感消费 ⇒ per-call Grant 在外层 bootstrap 前夜落笔（草案 §2） |
| F5 | ptcRuntime 相关导出 | **能（fs 臂）/ net 无字段** | `packages/ptc-runtime/ptc-runtime/lib/types/types.d.ts:69-96`（`PtcRunRequest.sandboxPolicy?: SandboxExecutionPolicy` = 每次运行的**输入参数**；`PtcRunSpec` 继承；**无 callId/net 字段**）；`packages/ptc-runtime/ptc-runtime-node/lib/types/index.d.ts`（`NodePtcRuntime` 公开类 + `resolve()/run()`；"direct file effects use the same sandbox service as Bash"；`LaunchConfig.nodeExecutable`（launch.d.ts:5-7）另供 launcher 覆写点） | 外层权威本来就是 per-run 注入点（设计如此）；Team 自有工具可直接 `ctx.ptcRuntime.run({... sandboxPolicy})`（w-ptc-re A1 行已证行能持有并驱动该 runtime）；net 维度**在所有请求/结果类型里都不存在** |
| F6 | net 约束的其它候选面（穷尽扫描） | **不能** | 声明面全树扫描 `network` 语境 + `netns/egress/firewall/proxy/socket/networkAccess` 词族：命中全部落在 telemetry/otel、inspector（观测 store）、credentials、windows-acl（SID 语境）、web/search/http 工具族（工具级 URL 策略）与会话投影文档，**无一例 confined-execution network arm**；`packages/bundle/*/cordis.patch.yml` 亦无进程级 net 行 | 外层程序的 net 无任何公开词表/行/字段可驮； blunt 断网 = 改网络姿态（本件前提禁止）⇒ 需 Core 词表扩展（上游需求，非装配可行项） |

## 2. 最小装配草案（F4+F5+F3-fs，仅 fs 臂；本件不实施）

```yaml
# profiles/<p>/cordis.patch.yml —— 全公开语法（base 头注释逐条允许）
- id: ptc-runtime
  disabled: true
- insert:
    - id: a5ptc-guarded-provider
      name: 'file:///…/a5ptc-provider-row.mjs'   # 行 = PtcRuntime 唯一实现（文件 URL 行已有先例）
```

行内装配（全部已证公开原料）：`import { NodePtcRuntime } from '@deepseek-ai/dsh-ptc-runtime-node'`
（公开默认导出），注册一个 `resolve(request)`/`run(spec)` 包装：**resolve 时**用行自持的 per-call
Grant 状态（同一行的 Guard 见证腿每次 dispatch 记录 callId+args+session；run 粒度关联用
session+program 指纹，并行 run_code 串行化以保序——草案如实标注此相关性约束）解析出本次
`SandboxExecutionPolicy{mode, workspaceRoot, sessionId}` 写入 spec（缺失=调用方误用，provider
契约自拒）；`run()` 委托 NodePtcRuntime ⇒ OS 强制走与 Bash 同一 sandbox service；每跑结果
`PtcRunSandbox{mode, denied, enforcement}` 公开回读入账。**并行原生通道（更贴原计划）**：不换
provider，走 host 自家升级链——程序请求更宽模式 → `peekApprover/ctx.approval` →
`EscalationApprover.request({callId})`（per-call 逐次）→ 批准=新调用更宽策略
（sandbox/index.d.ts:48-53 原文），Team resolver（leader/human，ask-lane 既有裁决人）充当批准方。
两路都只覆盖 fs；net 都不覆盖（F6）。

## 3. 总结论

- **存在途径（fs 臂）**：per-call Grant → 外层 bootstrap 的注入有**公开、原计划一致**的两条装配路
  （F4 provider 换装 / F5+原生 escalation per-callId），OS 强制与每跑回读都是公开面。seam 意义
  上 M-08 "per-call 策略注入未证" 的 fs 半臂**可装配可证**；本机 OS 拒绝负控仍受环境门
  （无 bubblewrap/Landlock 后端 = ENV_BLOCK，属环境非属缝——w-ptc-re 已按 NOT-EXECUTED 如实入账）。
- **不存在途径（net 臂）**：外层程序网络约束在全部公开词表中**不存在**（SandboxMode 明文排除，
  sandbox/index.d.ts:16-17），任何公开面都驮不动 ⇒ **局部阻塞维持**，出路只有 Core 词表扩展
  （上游最小需求一句话：confined-execution 策略增加 per-call network arm，或声明性出口代理
  行）——按 CORE_PATCH_BUDGET=0 属上游需求登记，不是本仓待办。
