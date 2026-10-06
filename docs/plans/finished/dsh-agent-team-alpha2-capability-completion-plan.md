# `dsh-agent-team` alpha.2 能力补齐轮实施计划

> 目标版本：`0.1.1-alpha.2` 补充轮（Capability Completion / Static Authorization Closure）  
> 仓库：`ArmourPiercer1/dsh-agent-team`  
> 计划基线：`master @ a99c21305dc1a712a9cd8be03bb078feca6e148a`  
> Pinned upstream DSH：`ArmourPiercer1/deepseek-harness stable @ a66e4702047846cdaa10c66c9d3df3951f5ea70d`  
> 核心约束：`CORE PATCH BUDGET = 0`；只使用 pinned DSH public seams；不得修改 upstream source。  
> 工作模式：主 Agent 建 integration branch；每个功能任务由一个独立 subagent 在独立 worktree 完成；subagent 提 PR；主 Agent 审查并按本计划顺序合并。

---

## 0. 本轮定位

alpha.2 主体已经完成：

```text
Blueprint Template static permissions
        ↓
CanonicalOperation
        ↓
allow / ask / deny
        ↓ ask
synchronous Leader/Human approval
        ↓
exact operationFingerprint
        ↓
allow-once
        ↓
final dispatch
```

本轮**不重写**该架构，而是关闭真人测试与代码复审中发现的 static authorization coverage / introspection / exact-identity 缺口，使 alpha.2 成为 alpha.3 Dynamic Governance 的稳定基线。

本轮必须完成：

```text
A2C-1  pwsh parameter permission
A2C-2  Permission Coverage Gate
A2C-3  team_inspect_config 暴露真实 operation permission
A2C-4  external hard last-mile recheck
A2C-5  read omitted-limit fingerprint debt
A2C-7  subtree resource matcher
```

明确延期：

```text
A2C-6  grep/glob permission-aware search：延期，继续设计
A2C-8  capability preview / Blueprint permission UI：移至 alpha.4 之后
Blueprint 配置/权限交互 UI：整体移至 alpha.4 之后
```

### 0.1 本轮不是 alpha.3

严禁顺手实现：

- `grant_instance`；
- durable permission grant / permission snapshot；
- Leader proactive permission mutation；
- `mutationEnvelope`；
- runtime permission delta `agent.inject`；
- grant archive/restore/dispose lifecycle；
- MemberInstance dynamic permission overlays；
- Remote permission CRUD。

### 0.2 本轮不是 alpha.4

严禁顺手实现：

- `teamHardDeny`；
- Human hard override；
- Leader-gated hard-boundary escalation；
- complete governance UI；
- Permission Administration；
- Blueprint capability editor / permission editor；
- unmanaged-tool 用户 acknowledgement escape hatch。

---

# 1. 总体安全不变量

所有任务都必须保持以下不变量。

## 1.1 Capability 与 Operation Permission 继续分层

```text
Capability selection
= tool / skill / MCP 是否存在于 Agent surface

Operation permission
= 已存在工具的一次具体调用是否允许
```

`builtinToolDeny`、`teamTools`、`skills`、`mcp` 仍属于 capability materialization。

`permissions` 仍只负责具体 operation。

A2C-2 新增的 Coverage Gate **不是新的 allow-list policy**，而是完整性检查：

> 对于启用了 `capabilities.permissions` 的 Agent，最终实际暴露的每一个 tool 都必须能被归属给一个明确 authority owner；无法归属的敏感/未知工具不得静默执行。

## 1.2 Legacy 兼容

Template 没有：

```yaml
capabilities:
  permissions: ...
```

时：

- 不安装 parameter-permission enforcement；
- 不启动 strict Permission Coverage Gate；
- 保持现有 alpha.1 / legacy 行为；
- 本轮不得借 coverage closure 破坏旧 Blueprint。

## 1.3 Managed tool 未显式出现 ≠ coverage failure

例如：

```yaml
permissions:
  default: deny
  allow:
    - tool: read
      resource:
        kind: exact
        path: ./README.md
```

若 preset 还暴露 `write` / `edit` / `pwsh`，且这些工具存在 parameter adapter：

```text
write / edit / pwsh
→ MANAGED
→ no explicit rule
→ runtime permission.default = deny
→ Coverage Gate PASS
```

Coverage Gate 检查的是“有没有 authority owner”，不是“Blueprint 是否逐个列出工具”。

## 1.4 Unknown unmanaged 默认 fail closed

当 `capabilities.permissions` 已启用，最终 surface 出现一个 Team 插件无法归属的工具：

```text
UNKNOWN_UNMANAGED
→ setup / compatibility gate FATAL
```

alpha.2 不提供：

```yaml
acknowledgeUnmanaged:
  - foo
```

之类 escape hatch。

合法修复只有：

1. 用 `builtinToolDeny` 从实际 surface 中移除；或
2. 为其实现/声明经过审查的 authority owner。

## 1.5 不解析 FsTargetKey

所有文件 authority identity 继续遵守 pinned upstream DSH contract：

```text
FsTarget.targetKey = opaque
```

禁止：

- `startsWith(targetKey)`；
- `node:path` 解析 targetKey；
- 自行 lower-case / separator-normalize；
- 假设 targetKey 是本地绝对路径。

A2C-7 subtree 必须使用 pinned DSH public seam：

```ts
FileSystem.contains(parent: FsTarget, child: FsTarget): boolean
```

## 1.6 H1/H4/H5 hardening 不得回退

必须保持：

- hostile prepended `tools/pre-execute` allow 无法绕过 end-cap；
- exact rule 每次 decision fresh canonicalize，无 install-lifetime authority cache；
- mutable symlink/junction topology 改变后 authority 随 fresh resolution 改变；
- shell fingerprint 继续包含 command/effect identity；
- capability-level deny 继续优先于 parameter permission；
- cold resume 重新安装 enforcement。

---

# 2. Git / Worktree / PR 组织方式

## 2.1 Integration branch

主 Agent 首先从冻结基线创建：

```text
int/alpha2-capability-completion
base = a99c21305dc1a712a9cd8be03bb078feca6e148a
```

在开始功能开发前记录：

```text
BASE_SHA
upstream pin
baseline test failure set
baseline build/typecheck state
working tree cleanliness
```

不要让任何 subagent 直接以 `master` 为 PR base。

所有 feature PR：

```text
task/... → int/alpha2-capability-completion
```

最终所有 gate 通过后再：

```text
int/alpha2-capability-completion → master
```

形成一个最终 integration PR。

## 2.2 每个 subagent 一个任务、一个 worktree、一个 PR

推荐分支：

```text
task/a2c-1-pwsh-permission
task/a2c-4-external-hard-last-mile

task/a2c-2-permission-coverage-gate
task/a2c-5-read-fingerprint

task/a2c-7-subtree-matcher

task/a2c-3-inspect-operation-permission
```

对应 worktree：

```text
.worktrees/a2c-1
.worktrees/a2c-4
.worktrees/a2c-2
.worktrees/a2c-5
.worktrees/a2c-7
.worktrees/a2c-3
```

每个 subagent：

1. 只处理自己 Task Contract；
2. 先做 RED；
3. 再做最小 GREEN；
4. 跑规定 focused gates；
5. 写 task report；
6. commit；
7. push 自己的 task branch；
8. 对 integration branch 提 PR；
9. 不自行 merge；
10. 主 Agent review 后才合并。

## 2.3 中央 single-writer 文件

为避免此前多分支频繁出现 bookkeeping / scanner pin 冲突，下列文件原则上由**主 Agent 单写**：

```text
dev/agent-workflow/graph.yaml
dev/agent-workflow/STATUS.md（若存在）
dev/agent-workflow/SESSION_ROUTER_LOG.md
packages/testkit/test/p4t6-session-event-scan.test.ts  # aggregate scanner/pin
package.json / package version fields                 # 除非任务明确要求
generated dist/** / source maps / composition artifact
pnpm-lock.yaml                                         # 本轮预计无需新 dependency
```

Subagent 不应为了让 aggregate scanner 在独立 branch 上变绿而修改共享 pin。

Subagent 报告：

```text
new source/test files added = N
expected scanner delta = N
```

主 Agent 在 integration branch 上统一更新 aggregate pin / ledger，并统一 rebuild committed artifacts。

如果仓库 gate 强制要求 pin 才能运行：

- subagent 只运行不依赖该 aggregate pin 的 focused suite；
- 主 Agent merge 后立即更新 pin 并运行 aggregate gate。

## 2.4 禁止语义性 merge-conflict 猜测

主 Agent merge 时：

- generated/bookkeeping 冲突：按 single-writer 规则处理；
- source conflict：不得“看起来差不多”手工拼接；
- 如果出现本计划未预测的 source conflict，任务分支必须先 rebase 到最新 integration tip，在原 task worktree 重新完成 focused gates，再 merge。

---

# 3. 并行波次与合并顺序

不要追求“6 个 subagent 同时启动”。这些任务存在真实文件重叠，错误并行会显著增加集成成本。

## Wave 1 — 两个独立基础任务，可并行

### W1-A：A2C-1 `pwsh` parameter permission

```text
base = initial integration tip
```

### W1-B：A2C-4 external-hard last-mile recheck

```text
base = same initial integration tip
```

二者预计产品文件基本不重叠，可并行开发。

主 Agent merge 顺序：

```text
A2C-1
→ re-gate
A2C-4
→ re-gate
```

然后冻结新的 integration SHA：

```text
INT_W1
```

## Wave 2 — 两个任务可并行

二者都必须从 `INT_W1` 开始。

### W2-A：A2C-2 Permission Coverage Gate

依赖：A2C-1 的最终 managed shell vocabulary。

### W2-B：A2C-5 read fingerprint debt

依赖：A2C-1，因为两者都会修改 canonical-operation shell/read 相关模块；禁止从旧 base 并行修改同一文件。

主 Agent merge 后冻结：

```text
INT_W2
```

## Wave 3 — A2C-7 单独执行

### W3：A2C-7 subtree matcher

必须从 `INT_W2` 开始。

原因：A2C-7 会横跨：

```text
Blueprint permission schema
canonical rule normalization
permission matcher
pre-execute adapter
live fs seam wiring
```

并会触碰 A2C-1 / A2C-2 已经修改过的热点。

不要与 A2C-2 并行。

merge + re-gate 后冻结：

```text
INT_W3
```

## Wave 4 — A2C-3 最后补 introspection

### W4：A2C-3 `team_inspect_config`

从 `INT_W3` 开始。

这样它一次性展示最终 alpha.2 vocabulary：

```text
pwsh
exact / any / subtree
```

避免先实现 inspect、后又因 A2C-7 再改一次 contract。

---

# 4. 冲突热点矩阵

| 文件/区域 | A2C-1 | A2C-2 | A2C-3 | A2C-4 | A2C-5 | A2C-7 | 策略 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| `domain/blueprint/types.ts` | ✓ |  | 读 |  |  | ✓ | 1 → 7 串行 |
| `domain/blueprint/validate.ts` | ✓ |  |  |  |  | ✓ | 1 → 7 串行 |
| `operation-permission/types.ts` | ✓ | 读 | 读 |  |  | 可能 | 先 1 |
| `canonical-operation.ts` | ✓ |  |  |  | ✓ | 可能 | 1 → 5 → 7 |
| `permission-resolver.ts` |  |  |  |  |  | ✓ | 7 独占 |
| `pre-execute-adapter.ts` | ✓/测试 |  |  | ✓ | 可能测试 | ✓ | 4 在 Wave1；7 最后 |
| `control/service.ts` |  |  |  | ✓ |  |  | A2C-4 独占 |
| `agent-bindings.mjs` |  | ✓ |  |  |  | ✓ | 2 → 7 串行 |
| `action-router/effects.ts` |  |  | ✓ |  |  |  | A2C-3 独占 |
| `admission/types.ts` |  |  | ✓ |  |  |  | A2C-3 独占 |
| central scanner/bookkeeping | 禁 | 禁 | 禁 | 禁 | 禁 | 禁 | main Agent single-writer |

---

# 5. A2C-1 — `pwsh` Parameter Permission

## 5.1 问题

当前 alpha.2 closed permission vocabulary：

```text
read
read_image
write
edit
lsp
bash
```

但 pinned DSH `standard` preset 在 Windows 使用 `pwsh`，且 upstream `tool-pwsh` 的执行参数与 `tool-bash` 基本同构：

```text
command
description
timeoutMs
workdir
run_in_background
sandbox_permissions
justification
```

因此 Windows 真人环境中 `pwsh` 当前属于 unsupported tool，绕过 alpha.2 operation permission。

## 5.2 目标语义

新增：

```text
PermissionTool += pwsh
```

定义统一 shell class：

```text
bash
pwsh
```

均为：

```text
resource.kind = tool
resource.key = exact tool name
```

即：

```text
bash authority != pwsh authority
```

相同 command 不得让 bash approval 授权 pwsh，反之亦然。

## 5.3 规则语义

对 `bash` 与 `pwsh` 一致：

```text
resource:any
  ask  ✓
  deny ✓
  allow ✗

resource:exact   ✗
resource:subtree ✗（A2C-7 加入后仍必须拒绝）
```

继续禁止 shell command regex/prefix/path inference。

## 5.4 Fingerprint

`pwsh` 使用与 H5 bash 相同的 effect projection：

```text
tool
commandHash
canonical workdir key
runInBackground
timeoutMs explicit value | null
sandboxPermissions explicit value | null
```

排除：

```text
description
justification
```

字段 validation 继续发生在 pre-execute 阶段并 fail closed，因为 upstream parameter validation 在 tool body 内更晚发生。

## 5.5 推荐代码结构

避免复制第二套 pwsh canonicalizer。

建议抽出：

```text
SHELL_PERMISSION_TOOL_VALUES = ['bash', 'pwsh']
canonicalizeShellOperation(tool, args, resolveTarget)
extractShellEffects(...)
```

保留必要兼容 export 时可保留 `BASH_*` alias，但 authority core 不得出现两套会漂移的逻辑。

同时更新：

- Blueprint domain `PermissionTool` closed set；
- runtime local vocabulary；
- schema validation；
- `classifyPermissionTool()`；
- canonical operation；
- shell summary；
- end-cap supported-tool classification；
- tests/docs。

## 5.6 RED probes

至少先证明当前 tree：

1. `pwsh` 被分类 `unsupported`；
2. `permissions.default=deny` 不阻止 `pwsh`；
3. `pwsh any ask` 当前 Blueprint schema 拒绝；
4. Windows standard preset 的 `pwsh` 可以在无 builtin deny 时到达 executor。

## 5.7 GREEN acceptance

必须覆盖：

- `pwsh any deny` → zero execution / zero ControlRequest；
- `pwsh any ask` Member → Leader；
- `pwsh any ask` Leader → Human；
- allow-once exact command/effect；
- changed command mismatch；
- changed workdir mismatch；
- background/timeout/sandbox effect mismatch；
- malformed pwsh effect fields fail closed；
- `builtinToolDeny: [pwsh]` 仍在 capability layer 更早隐藏，parameter permission 不得复活；
- sibling Agent unaffected；
- cold resume 重新安装；
- bash 全部既有 hardening tests 不回归；
- hostile pre-execute short-circuit 仍被 end-cap 拦截。

## 5.8 Live proof

Windows real standard preset 必须至少跑：

```text
pwsh static deny
pwsh ask → allow_once → executes exactly once
pwsh ask → deny → zero effect
builtinToolDeny pwsh → unknown/absent + zero permission rows
cold resume
```

---

# 6. A2C-4 — External Hard Last-Mile Recheck

## 6.1 问题

当前 ControlService 在 `resolveControl(ALLOW)` 时检查 `externalPolicyFacts()`，但旧实现的 final `guardOperation()` 不重新读取 external hard。

更重要的是，static permission `allow` 路径无需 ControlRequest，因此必须确认它也受到同一个 live external ceiling 的最终检查。

冻结目标：

> 对每一个 alpha.2 managed operation，不论 static allow 还是 ask→allow_once，进入 tool body 前都必须经过当前 external hard policy 的最后检查。

## 6.2 不得引入

本任务不得实现：

```text
teamHardDeny
Human hard override
new governance hierarchy
```

只补 external ceiling。

## 6.3 推荐最小实现

在现有 ControlService 内建立一个共享的 read-only external check，例如概念接口：

```ts
checkExternalOperation({
  capabilityDomain: 'tools',
  toolName,
}): Promise<{ allowed: boolean; reason?: string }>
```

该接口必须复用：

```text
options.externalPolicyFacts()
existing hard-cell semantics
```

不要复制另一套 hard policy evaluator。

### Static allow path

```text
static resolver → allow
→ checkExternalOperation(live)
→ allowed only then mark authorized execution
→ next()
```

### Ask path

保持 decision-time external check，同时：

```text
durable allow
→ guardOperation
   → live external recheck
   → exact scope
   → only then write allow consumption
→ next()
```

若 external hard 在 decision 后收紧：

```text
block
zero tool effect
prefer zero allow consumption
```

即不要因为 host policy 已经阻止执行而无意义消耗 one-shot。

## 6.4 RED probes

用 mutable `externalPolicyFacts()` provider：

1. static allow 在 provider 改成 deny 后仍执行（当前缺口）；
2. ask 的 decision 已 allow，provider 在 guard 前改成 deny，旧 guard 仍放行/消费。

## 6.5 GREEN acceptance

- static allow + live external deny → zero execution；
- ask allow + decision 后 external tighten → zero execution；
- human allow 不能突破 external hard；
- denied external check 不产生新的 Team permission mutation；
- ask path scope/fingerprint/exactly-once 全部保持；
- external allow 时现有成功路径不变；
- fail/throw reading external facts → fail closed；
- hostile-prepend end-cap 不回归。

---

# 7. A2C-2 — Permission Coverage Gate

## 7.1 设计目标

Coverage Gate 不检查：

> “工具名是否在 Blueprint 中显式声明？”

而检查：

> “最终 model-facing tool surface 上的每一个工具，是否有一个明确 authority owner？”

仅当 Template 声明 `capabilities.permissions` 时启用 strict mode。

## 7.2 Gate 必须检查最终 effective surface

顺序必须在 tool-producing composition 基本完成后：

```text
preset mount
→ builtinToolDeny
→ Team tool registration
→ Team skills registration
→ MCP mount/reconcile
→ FINAL effective tool surface
→ Permission Coverage Gate
→ parameter-permission listener install
→ setup returns
```

如果某个具体 public seam 的真实时序要求略有调整，必须保持核心不变量：

> Gate 看到的是实际准备交给模型的 surface，而不是只检查 preset 配置字符串。

不得直接读取 upstream private registry。

优先使用 pinned DSH public tool-schema enumeration seam（开发前 recon exact API/signature）。

## 7.3 Authority owner 分类

建议纯 evaluator 返回：

```text
MANAGED_OPERATION_PERMISSION
OTHER_MANAGED_TEAM_TOOL
OTHER_MANAGED_MCP
SAFE_UNMANAGED
KNOWN_SENSITIVE_UNMANAGED
UNKNOWN_UNMANAGED
```

### A. `MANAGED_OPERATION_PERMISSION`

来源：最终 `PERMISSION_TOOL_NAMES` / adapter registry，例如：

```text
read
read_image
write
edit
lsp
bash
pwsh
```

无显式 rule 也 PASS；调用时由 `permissions.default` 决定。

### B. `OTHER_MANAGED_TEAM_TOOL`

实际由当前 Team tool catalog 选择并注册的工具。

authority owner：

```text
teamTools capability + Team runtime/control
```

### C. `OTHER_MANAGED_MCP`

只有能证明是**当前被允许并实际 mount 的 MCP surface** 引入的工具才能归类到这里。

不得仅通过名字前缀猜测。

优选方式：通过 public tool-schema surface 在 MCP mount 前后记录实际 delta，或使用 upstream 明确公开的 MCP tool ownership metadata。

### D. `SAFE_UNMANAGED`

这是一个非常小、source-reviewed、closed exact-name registry。

只有在 pinned upstream source 审查证明该工具不具备下列能力时才能加入：

- filesystem content read/write；
- process/shell/code execution；
- network egress；
- arbitrary MCP/tool dispatch；
- generic subagent/agent orchestration；
- job process control；
- 跨 Team governance 的通用 messaging/control；
- 其他明显 external side effect。

名字“看起来安全”不是证据。

### E. `KNOWN_SENSITIVE_UNMANAGED`

已知工具、已知有敏感 effect，但 alpha.2 没有 operation adapter / 其他足够 authority owner。

本轮至少明确把以下类别纳入审查：

```text
grep / glob                     # A2C-6 延期
subagent / subagent_fork
ralph / workflow
web_fetch / web_search
job_* process control
ordinary DSH agent messaging/control surfaces
其他能绕出 Team MemberInstance governance 的工具
```

如果最终 surface 中存在：

```text
FATAL
```

除非先被 `builtinToolDeny` 等 capability layer 移除。

### F. `UNKNOWN_UNMANAGED`

插件完全不知道语义的工具：

```text
FATAL
```

不允许 warning-only。

## 7.4 响应格式

新增稳定 typed setup/compatibility error，例如概念：

```text
alpha2-permission-coverage-unmanaged-tools
```

错误 detail 必须 deterministic（工具名排序），至少包含：

```json
{
  "instanceId": "...",
  "presetId": "...",
  "unmanagedTools": [
    {
      "name": "grep",
      "classification": "known-sensitive-unmanaged",
      "reason": "filesystem search can disclose content outside read permission coverage",
      "remediation": "hide with builtinToolDeny or add a reviewed authority adapter"
    }
  ]
}
```

当前轮不做专门 UI；existing failure surface 显示这条 typed diagnostic 即可。

## 7.5 不做 auto-hide

Gate 发现未知/敏感工具时不要自动执行：

```text
restrict({ deny: ... })
```

原因：自动隐藏会让 runtime 行为偏离 Blueprint/preset 配置且难以解释。

正确行为：

```text
fail loud
→ 用户/Blueprint 明确 builtinToolDeny
→ 或开发 adapter
```

## 7.6 RED probes

至少证明当前 tree：

- `permissions.default=deny` + unknown tool 仍能出现在 surface；
- `permissions.default=deny` 不会自动覆盖 unsupported tool；
- `grep` / `subagent` / `web_fetch` 等可绕出 six-tool permission vocabulary。

## 7.7 GREEN acceptance matrix

### Managed but undeclared

```text
pwsh present
no explicit pwsh rule
default=deny
→ Gate PASS
→ runtime call DENY by default
```

### Hidden sensitive

```text
preset has grep
builtinToolDeny removes grep
→ final surface no grep
→ Gate PASS
```

### Exposed known-sensitive

```text
grep remains exposed
→ FATAL
```

### Unknown

```text
foo_magic remains exposed
→ FATAL
```

### Safe unmanaged

```text
source-reviewed safe tool
→ PASS + optional diagnostic
```

### Team tools

```text
selected team_delegate
→ PASS as Team-managed
```

### MCP

```text
permitted MCP mount introduces tool X
ownership proven by actual mount
→ PASS as MCP-managed
```

### Legacy

```text
permissions absent
→ Gate disabled
→ existing alpha.1 behavior unchanged
```

### Lifecycle

fresh root / fresh member / cold root / cold member 都必须得到相同 coverage verdict。

## 7.8 Gate registry 维护原则

任何 DSH preset 更新新增工具：

```text
unknown by default
→ blocked under permissions
```

必须通过 source review 后显式分类。

这就是 A2C-2 的主要长期价值。

---

# 8. A2C-5 — Read Fingerprint：移除 omitted-limit 假等价

## 8.1 当前债务

当前 canonical read projection 使用：

```text
offset ?? 1
limit  ?? 2000
```

因此：

```text
read(file) == read(file, limit=2000)
```

在 fingerprint 上相同。

若 deployment 的实际 `readLimit` 非 2000，这两个调用实际 effect 不等价。

## 8.2 冻结修法

不需要读取 deployment-private default。

采用保守 identity：

```text
offset:
  omitted → 1        # upstream semantic fixed default，若 recon 确认仍成立

limit:
  omitted → null     # 表示 caller 没有显式给定
  explicit N → N
```

因此：

```text
read(file)
!=
read(file, limit=2000)
```

即使某一 deployment 恰好默认也是 2000，也只会产生**保守的不复用**，不会错误扩大 authorization。

## 8.3 不要做

- 不读取 private tool config；
- 不引入 live readLimit dependency；
- 不修改 read tool 本身；
- 不改变 `offset` 语义，除非 pinned upstream recon 证明原假设已经失效。

## 8.4 Tests

必须证明：

- omitted limit deterministic；
- explicit same limit deterministic；
- omitted vs explicit 2000 fingerprint different；
- explicit 100 vs 200 different；
- resource / offset 改变仍不同；
- allow-once for omitted call 不能被 explicit-2000 call 消费；
- H1/H4/H5 permission hardening 全部不回归。

---

# 9. A2C-7 — `subtree` Resource Matcher

## 9.1 为什么现在可以做

早期 alpha.2 延后 subtree 的原因是：

> 不能通过解析 opaque `targetKey` 或字符串前缀来建立 descendant authority。

Pinned DSH rc.1 public filesystem service 已公开：

```ts
FileSystem.contains(parent: FsTarget, child: FsTarget): boolean
```

其 contract：

> 对同一个 filesystem provider 的两个 canonical targets，判断 child 是否等于 parent 或位于其 descendant subtree；consumer 无需解析 targetKey。

因此 A2C-7 可以在 public seam 上安全完成。

## 9.2 Blueprint grammar

扩展：

```ts
PermissionResource =
  | { kind: 'exact'; path: string }
  | { kind: 'subtree'; path: string }
  | { kind: 'any' }
```

`subtree.path`：

- required；
- string；
- trim；
- non-empty；
- 使用与 exact 相同的长度/control-char 限制。

## 9.3 Tool applicability

允许：

```text
read
read_image
write
edit
lsp
```

在 allow / ask / deny 三个 lane 中均可使用 subtree。

禁止：

```text
bash subtree
pwsh subtree
```

shell 仍只有 `resource:any` ask/deny。

## 9.4 Authority semantics

```text
subtree(root)
```

匹配：

```text
operationTarget == root
OR
operationTarget is canonical descendant of root
```

唯一合法 authority predicate：

```text
fs.contains(rootTarget, operationTarget)
```

禁止：

```text
operation.key.startsWith(root.key)
displayPath.startsWith(...)
node:path.relative(targetKey...)
```

## 9.5 保持 A3 pure

推荐不让 `permission-resolver.ts` import DSH/fs。

由 A5 pre-execute adapter 在**每次 permission decision** 的 rule canonicalization 阶段：

1. 用与 operation 相同的 live `fs.resolve()` basis 解析 subtree root；
2. 保留该 decision 内的真实 `FsTarget` handle（opaque runtime-only）；
3. 对当前 operation target 调用 `fs.contains(rootTarget, opTarget)`；
4. 把 operation-relative containment result 传给 pure A3 matcher。

可采用概念形态：

```ts
CanonicalRule.resource =
  | { kind: 'exact'; key: string }
  | { kind: 'subtree'; rootKey: string; containsOperation: boolean }
  | { kind: 'any' }
```

`rootKey` 仅用于 provenance/debug equality，不用于自行推断 containment。

也可采用等价的纯数据表示，但必须满足：

- A3 保持 deterministic/pure；
- DSH `fs.contains` 只在 A5/live seam 层调用；
- no targetKey parsing；
- no authority cache。

## 9.6 Per-decision resolution batch

为了在不把 upstream `FsTarget` 放进 durable/canonical JSON 的前提下调用 `contains()`，推荐 A5 为每个 decision 建临时 resolution batch：

```text
resolve(path)
→ FsTarget
→ map opaque key → FsTarget  (decision-local only)
→ canonical key/display returned to A2/A3
```

subtree evaluation：

```text
parentKey -> decision-local FsTarget
operationKey -> decision-local FsTarget
fs.contains(parentTarget, operationTarget)
```

Map 只做 opaque equality lookup，不解析 key。

决策结束即丢弃；禁止跨 call/cache。

## 9.7 H4 semantics

subtree 规则必须继承 H4：

```text
fresh canonicalization per decision
```

例如 Windows junction：

```text
rule subtree ./alias
alias initially -> dirA
operation dirA/file → match

retarget alias -> dirB
next decision
→ fresh resolve
→ authority follows dirB
```

不得 install-time freeze root identity。

## 9.8 Failure semantics

至少冻结：

### deny subtree 无法 canonicalize / containment 无法判定

```text
FAIL CLOSED → deny
```

不得把一个本应可能覆盖当前 operation 的 deny rule 静默丢掉。

### allow subtree resolution failure

```text
no positive grant
→ non-match
→ continue priority/default
```

### ask subtree resolution failure

不得把 failure 转换成更宽 allow；最终 outcome 只能等于或严于正常语义。建议沿用现有 exact-rule failure asymmetry并写清测试。

## 9.9 RED/GREEN Tests

必须覆盖：

```text
root itself matches
child matches
deep descendant matches
sibling no match
prefix trap: /src does NOT match /src2
relative/absolute aliases via backend
.. traversal via backend
Windows casing semantics by backend
symlink/junction alias identity
junction retarget fresh decision
exact unchanged
any unchanged
deny > ask > allow unchanged
shell subtree schema rejects
canonicalization failure lanes
cold resume
```

至少一个 real pinned FS backend test 必须真实调用 `FileSystem.contains()`，不能只用 fake `startsWith` double。

---

# 10. A2C-3 — `team_inspect_config` 暴露真实 Operation Permission

## 10.1 当前问题

`team_inspect_config` 当前返回：

```text
effective = generic policy resolver view
```

其中 legacy generic capability set 仍含：

```text
model / tools / permissions / skills / mcp
```

但 alpha.2 真正 enforcement 使用的是独立：

```text
boundTemplate.capabilities.permissions
→ TemplatePermissionPolicy
→ pre-execute adapter
```

因此 current `effective.permissions` 不是实际 operation permission authority。

## 10.2 本轮目标

保留旧字段兼容，不破坏 Remote/tool consumers：

```json
{
  "kind": "config-inspected",
  "effective": { "...legacy generic cells...": "..." },
  "operationPermissions": {
    "mode": "static",
    "default": "ask",
    "allow": [],
    "ask": [],
    "deny": [],
    "managedTools": ["read", "read_image", "write", "edit", "lsp", "bash", "pwsh"],
    "resourceKinds": ["exact", "subtree", "any"]
  }
}
```

permissions absent：

```json
{
  "operationPermissions": {
    "mode": "absent"
  }
}
```

名称可按现有 contract style 微调，但必须是**独立字段**；不得继续让用户/模型误以为 generic `effective.permissions` 就是 alpha.2 parameter authority。

## 10.3 数据来源

必须来自：

```text
TeamSession bound Blueprint snapshot
→ actual target MemberTemplate / LeaderTemplate
→ capabilities.permissions
```

不要从 runtime observation/free text 重建。

由于 alpha.2 尚无 dynamic permission mutation：

```text
static policy == current operation policy
```

A2C-3 不得提前伪造 alpha.3 dynamic overlays/grants。

## 10.4 Tool description

更新 `team_inspect_config` 描述，明确区分：

```text
effective = legacy generic capability policy view
operationPermissions = actual static parameter-aware policy enforced by alpha.2
```

如果希望未来迁移，可给 generic `permissions` 加 presentation warning，但不要在本轮删除/重命名已有 field。

## 10.5 Tests

至少：

- member static policy exact/any/subtree round-trip；
- leader static policy；
- permissions absent → `mode: absent`；
- `pwsh` 出现在 managedTools；
- resourceKinds 含 subtree；
- returned rule order deterministic；
- inspect 是 pure read：zero durable writes；
- remote/tool round-trip 保持 lossless；
- old `effective` consumers 不回归。

---

# 11. A2C-6 — 延期决策：`grep` / `glob`

## 11.1 本轮不实现 parameter adapter

`grep` 可以直接返回文件内容匹配行，`glob` 可以泄露文件存在性/路径结构，因此二者不能简单标成 `SAFE_UNMANAGED`。

但当前也不应仓促把它们建模为普通：

```text
resource = search root
```

因为实际输出 authority 可能跨越大量文件，而 `grep` 的每条结果还包含内容。

## 11.2 当前候选设计（尚未冻结）

后续继续设计一个替代插件，例如：

```text
permission-aware search plugin
```

目标语义：

```text
search candidates
→ 对每一个 candidate 询问 read permission coverage
→ 只返回 read 许可范围内的 path / content matches
```

即用户当前设想：

> 用一个替代 `grep/glob` 插件，使其只返回 `read` 许可范围内的检索结果。

尚未解决的问题至少包括：

- 搜索阶段是否已经泄露 forbidden path 存在性；
- `grep` 在过滤前是否已经读取 forbidden content（authority 应放在什么层）；
- candidate 数量与逐文件 permission check 的性能；
- subtree/any/exact 规则如何快速投影为 searchable scope；
- symlink/junction/TOCTOU；
- spill/truncated result 是否也必须 permission-filter；
- 搜索工具自身是否应该直接消费 permission evaluator，而不是模拟调用 `read`；
- 与未来 dynamic grant 的一致性。

因此 A2C-6 **明确延期**。

## 11.3 A2C-2 对延期状态的处理

在 A2C-6 完成前：

```text
grep / glob = KNOWN_SENSITIVE_UNMANAGED
```

若 Template 开启 `capabilities.permissions`：

```text
exposed grep/glob → Coverage Gate FATAL
```

要使用当前 alpha.2 strict permission 模式，应通过：

```yaml
builtinToolDeny:
  - grep
  - glob
```

移除它们。

---

# 12. A2C-8 与 Blueprint 配置 UI — 延期到 alpha.4 之后

本轮不做：

- New Team capability preview；
- Blueprint permission preview；
- visual rule editor；
- Permission Administration；
- unmanaged-tool acknowledgement UI；
- Blueprint settings UI 重构。

决策原因：

> Blueprint 设置、权限加载与治理行为要到 alpha.4 hard governance 完成后才真正稳定。在 alpha.4 之前投入大量交互层，很可能因权限模型继续变化而返工。

因此交互工作统一移动到：

```text
post-alpha.4 interaction phase
```

届时集中解决：

```text
Blueprint authoring
capability preview
permission rule editor
hard-boundary display
dynamic grant display
pending approvals
provenance
coverage diagnostics
migration UX
```

alpha.2 当前仅要求：

```text
typed deterministic errors
good model-facing introspection (A2C-3)
```

不要求新的 GUI。

---

# 13. 每个 PR 的固定 Task Contract

每个 subagent PR description 必须包含：

```text
Task ID:
Base integration SHA:
Head SHA:
Allowed product files:
Actually changed product files:
Shared/single-writer files touched: MUST BE NONE

RED:
- failing probes before implementation

GREEN:
- focused tests
- typecheck/build subset

Security invariants:
- zero effect on deny
- fail closed cases
- no core patch
- no alpha.3/alpha.4 scope

Conflict forecast:
- files likely touched by later tasks
- assumptions exported to downstream task

Evidence path:
```

PR 不能只写“tests pass”。

---

# 14. Task-specific 文件边界建议

以下是默认修改面；subagent 在 recon 后发现必须扩大时，要在 PR 中解释，不得静默扩大。

## A2C-1

优先：

```text
packages/domain/blueprint/src/types.ts
packages/domain/blueprint/src/validate.ts
packages/domain/blueprint/src/index.ts
packages/runtime/operation-permission/types.ts
packages/runtime/operation-permission/canonical-operation.ts
packages/runtime/operation-permission/pre-execute-adapter.ts (仅必要 shell summary/classification)
relevant tests
```

不得碰 `agent-bindings.mjs`，除非 live wiring 证明 vocabulary 需要；正常应无需。

## A2C-4

优先：

```text
packages/runtime/control/types.ts
packages/runtime/control/service.ts
packages/runtime/operation-permission/pre-execute-adapter.ts
relevant control/pre-execute tests
```

尽量不碰 live glue；通过 existing ControlService dependency 复用 external provider。

## A2C-2

优先新建纯模块：

```text
packages/runtime/operation-permission/permission-coverage.ts
```

以及：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
focused live bridge tests
```

如需 typed error，放在现有 operation-permission/runtime error vocabulary 附近。

不得引入 private upstream registry read。

## A2C-5

只应主要触及：

```text
canonical-operation.ts
canonical-operation tests
approval fingerprint mismatch regression tests
```

不要借机重构 read tool。

## A2C-7

允许横跨：

```text
Blueprint permission schema
operation-permission rule types/resolver/pre-execute
live fs resolver wiring
focused real-backend tests
```

这是本轮唯一被允许做较深 permission matcher 扩展的任务。

## A2C-3

优先：

```text
packages/runtime/admission/types.ts
packages/runtime/action-router/effects.ts
packages/tools/src/tools.ts (description only if needed)
relevant runtime/tools/remote round-trip tests
```

不改 policy authority。

---

# 15. Main Agent Merge Protocol

每个 PR merge 前，主 Agent必须：

1. 查看完整 diff；
2. 验证没有修改 single-writer 文件；
3. 验证 task scope；
4. 验证 RED probe 确实能区分旧/新行为；
5. 重跑该任务 focused suite；
6. 检查 upstream reference porcelain = clean；
7. merge 到 integration；
8. 更新 central scanner pin / bookkeeping（如需要）；
9. 在 integration tip 重跑 cross-task smoke；
10. 才允许启动依赖该 tip 的下一波任务。

不要在全部 subagents 完成后一次性 merge 六个 PR。

---

# 16. Cross-task Integration Tests

除了各任务 focused tests，最终必须建立一组 alpha.2 completion matrix，至少覆盖以下组合。

## 16.1 Strict Windows worker

```yaml
capabilities:
  builtinToolDeny:
    - grep
    - glob
    - subagent
    - subagent_fork
    - ralph
    - workflow
    - web_fetch
    - web_search
    # 其他由 Coverage audit 判定的 sensitive-unmanaged

  permissions:
    default: deny
    allow:
      - tool: read
        resource:
          kind: subtree
          path: ./input
    ask:
      - tool: write
        resource:
          kind: subtree
          path: ./output
      - tool: pwsh
        resource:
          kind: any
    deny:
      - tool: edit
        resource:
          kind: subtree
          path: ./src/protected
```

验证：

```text
Coverage Gate PASS
read input child PASS
read outside DENY
write output → ask
edit protected DENY
pwsh → ask
unknown added tool → Gate FATAL
team_inspect_config returns this real static policy
```

## 16.2 Default semantics

Template 只写：

```yaml
permissions:
  default: deny
  allow: []
  ask: []
  deny: []
```

preset 中仍有 managed `read/write/edit/pwsh`：

```text
Coverage Gate PASS
all managed operation calls → DENY by default
```

证明 Gate 没变成“Blueprint 必须逐工具声明”的隐式 allow-list。

## 16.3 Capability > operation permission

```text
builtinToolDeny pwsh
+ permission ask pwsh
→ pwsh absent
→ zero request
→ zero effect
```

## 16.4 External hard

```text
static allow read
external hard tightened before final dispatch
→ blocked
```

以及：

```text
ask → human allow
external hard tightened before guard
→ blocked
→ no execution
```

## 16.5 Mutable topology

```text
subtree rule through junction alias
retarget alias
next decision follows new target
```

exact-rule H4 旧测试同时继续通过。

## 16.6 Cold resume

重启后：

- coverage classification identical；
- pwsh adapter present；
- subtree semantics identical；
- inspect output identical；
- old allow-once consumed state不复活；
- no stale canonical-rule cache。

---

# 17. Final Live Trial Gate

本轮完成后再进入 alpha.3 前，至少做一次真实 DSH host 的受控真人 smoke。

建议环境：

```text
fresh DSH_HOME
fresh plugin build/install from exact integration SHA
disposable workspace
non-admin Windows account
no secrets
standard preset
ports in 3181/3493 family
never touch existing :3080 instance
```

最低 live checklist：

```text
[ ] standard preset + strict Blueprint boots
[ ] Coverage Gate can PASS after sensitive unmanaged tools are explicitly hidden
[ ] intentionally re-enable one unknown/sensitive unmanaged tool -> setup FATAL
[ ] pwsh deny works
[ ] pwsh ask -> Human/Leader path works
[ ] exact allow-once cannot cross effect change
[ ] subtree read/write behavior works
[ ] junction retarget does not retain stale authority
[ ] team_inspect_config reports real policy
[ ] cold resume reproduces the same policy/coverage
[ ] no unhandled rejection / leaked waiter
```

---

# 18. Full Closure Gates

最终 integration tip 必须运行：

## 18.1 Focused security suites

至少：

```text
A1/A2/A3/A4/A5/A6 original alpha.2 suites
H1a end-cap
H3 hostile live seam
H4 rule identity
H5 shell effects
Issue #2 capability-permission precedence
new A2C-1/2/3/4/5/7 suites
```

## 18.2 Package parity

```text
runtime
domain
tools
storage
testkit
remote/client affected tests
```

允许已记录 baseline failures，但：

```text
new deterministic failure set = 0
```

主 Agent必须记录 baseline vs final failure-set diff，不能只比较总数。

## 18.3 Build gates

在 fresh dependency installation 上：

```text
typecheck
build
build:composition
check committed artifacts
aggregate scanner/pin
```

避免再把 stale `node_modules` 当成源码失败或成功证据。

## 18.4 Repository integrity

```text
CORE PATCH BUDGET = 0
references/deepseek-harness-test-use clean @ pinned SHA
no private upstream registry import
no force-push
no unrelated feature work
```

---

# 19. Completion Report

最终输出：

```text
dev/agent-workflow/evidence/alpha2-capability-completion/closure-report.md
```

建议结构：

```markdown
# Alpha.2 Capability Completion Closure

## 1. Baseline
- master base:
- upstream pin:
- baseline failure set:

## 2. Integrated tasks
- A2C-1:
- A2C-2:
- A2C-3:
- A2C-4:
- A2C-5:
- A2C-7:

## 3. Permission vocabulary
- managed tools:
- resource kinds:

## 4. Coverage Gate
- safe unmanaged registry:
- sensitive unmanaged registry:
- unknown behavior:
- legacy behavior:

## 5. External hard
- static allow proof:
- ask allow proof:

## 6. Fingerprint identity
- read omitted-limit:
- shell effects:

## 7. Subtree authority
- public seam:
- mutable topology proof:

## 8. Introspection
- team_inspect_config:

## 9. Live Windows smoke
- fresh:
- cold:

## 10. Full gates
- runtime/domain/tools/storage/testkit:
- typecheck/build/artifacts:

## 11. Deferred decisions
### A2C-6 grep/glob
- status: DEFERRED
- candidate replacement-plugin design:

### A2C-8 + Blueprint UI
- status: DEFERRED TO POST-ALPHA.4

## 12. Alpha.3 readiness verdict
- GO / NO-GO
```

---

# 20. Definition of Done

只有全部满足，本补充轮才算完成：

```text
[ ] pwsh 是正式 managed shell permission tool
[ ] pwsh 与 bash authority 不串用
[ ] pwsh ask/deny live Windows PASS
[ ] Permission Coverage Gate 只在 permissions-present mode 启用
[ ] managed-but-undeclared tool 由 default 管理，不被 Gate 误杀
[ ] known-sensitive unmanaged exposed -> FATAL
[ ] unknown unmanaged exposed -> FATAL
[ ] builtinToolDeny 后的 hidden tool 不再触发 Gate
[ ] Team tools 有明确 authority owner
[ ] MCP tools 只在 ownership 可证明时归为 managed
[ ] no unmanaged acknowledgement escape hatch
[ ] static allow 也受 live external hard last-mile check
[ ] ask allow 在 consumption/dispatch 前再次受 external hard check
[ ] read omitted limit 与 explicit 2000 fingerprint 不再假等价
[ ] subtree schema 已实现
[ ] subtree 使用 FileSystem.contains public seam
[ ] zero startsWith/opaque targetKey parsing authority
[ ] subtree junction/symlink retarget fresh-resolution PASS
[ ] team_inspect_config 返回真实 operationPermissions
[ ] generic effective.permissions 不再被描述为 parameter authority
[ ] cold resume 全部能力重建
[ ] hostile pre-execute end-cap 不回归
[ ] capability > operation-permission precedence 不回归
[ ] original alpha.2 suites 不回归
[ ] full failure-set delta = no new deterministic failures
[ ] fresh typecheck/build/artifact gates PASS
[ ] CORE PATCH BUDGET = 0
[ ] A2C-6 明确记录 DEFERRED
[ ] A2C-8 + Blueprint configuration UI 明确记录 POST-ALPHA.4
[ ] closure-report 完成
```

---

# 21. Alpha.3 Handoff

本轮完成后，alpha.3 应当得到一个更干净的基础：

```text
actual tool surface
        ↓
coverage complete / fail closed
        ↓
static operation policy
  exact / subtree / any
        ↓
canonical effect identity
        ↓
external hard last mile
        ↓
accurate introspection
```

alpha.3 才在这个基础上增加：

```text
mutationEnvelope
self-frozen authority
Leader proactive mutation
durable permission snapshots
grant_instance
runtime context + inject
grant lifecycle
```

不要让 alpha.3 同时承担 static coverage debt 的修复。
