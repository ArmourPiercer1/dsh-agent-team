# dsh-agent-team — alpha.2 Permission Hardening Follow-up 修复计划

> 目标：在进入 alpha.3 前，闭合 alpha.2 permission/security baseline 中剩余的两个 P1 exact-identity 问题。  
> 基线：当前 `master`（审查时 tip `6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925`；alpha.2 hardening 产品代码主体截至 `486edd68f44dd668db089a2ec620fe5af41e10ce`）。  
> 上游契约基线：`deepseek-harness 0.1.2-rc.1 @ a66e4702047846cdaa10c66c9d3df3951f5ea70d`。  
> 优先级：P1 closure。  
> 原则：`CORE PATCH BUDGET = 0`。

## 0. 执行摘要

本轮只修两个问题：

1. **P1-A — exact permission rule 的 successful canonical key 被 install-lifetime 缓存，可能在 symlink/junction/mount identity 变化后形成 stale authority。**
2. **P1-B — Bash operation fingerprint 目前只绑定 `commandHash`，没有完整绑定实际执行 effect（至少 `workdir`、`run_in_background`、`sandbox_permissions`、显式 `timeoutMs`）。**

本轮结束时应满足：

- exact file rule 的 authority identity 与当前操作时刻的 filesystem identity 一致，不保留 install-lifetime stale key；
- Bash durable approval / allow-once fingerprint 可以区分 materially different executions；
- 不引入 dynamic grants、durable grants、`teamHardDeny`、permission admin UI、Remote 协议升级；
- 不修改 DSH core；
- 现有 P0 monotonic end-cap 语义保持不变；
- fresh / cold-resume / legacy 行为无回归。

## 1. Scope Lock

### 1.1 本轮允许修改

主要允许修改：

- `packages/runtime/operation-permission/canonical-operation.ts`
- `packages/runtime/operation-permission/types.ts`（仅当 projection / resolver seam 类型确有需要）
- `packages/runtime/operation-permission/pre-execute-adapter.ts`
- `packages/runtime/operation-permission/errors.ts`（仅在新增 fail-closed Bash 参数错误码确有必要时）
- `packages/runtime/operation-permission/index.ts`
- `packages/runtime/src/plugin/live/agent-bindings.mjs`（仅为构造正确的 Bash effective workdir authority seam）
- 对应 runtime/domain tests
- 对应 build/dist 产物
- `dev/agent-workflow/evidence/alpha2-hardening-followup/**`
- 必要的 testkit pin / DEC 记录

### 1.2 明确禁止

本轮不得引入：

- alpha.3 `grant_instance`
- dynamic / durable permission grants
- mutationEnvelope 的新 governance 语义
- Leader 自助授权
- `teamHardDeny`
- Human persistent override
- permission admin UI
- Remote v5 / 新 RPC 协议
- retry/effect protocol
- DSH core patch
- 为方便测试而改变生产 permission decision precedence
- Bash command shell parsing / AST policy

如修复需要上述任意能力，应停止扩展实现并记录 blocker，而不是越界开发。

# 2. P1-A — stale exact-rule canonical identity

## 2.1 当前问题

当前 `pre-execute-adapter.ts` 中存在 install-owned cache：

```ts
const ruleKeyCache = new Map<string, string>()
```

successful resolution 会永久复用：

```ts
const cached = ruleKeyCache.get(path)
if (cached !== undefined) return cached
```

而 operation 本身每次重新 canonicalize。

pinned upstream `fs-local` 的 identity 是 `realpath` 派生的 `targetKey`。因此 filesystem topology 发生变化时：

```text
T0:
rule "./link/file.txt" -> key A
cache = A

T1:
./link retarget -> B

operation "./link/file.txt" -> key B
rule cache -> key A
```

会导致规则和当前操作使用不同时间点的 authority identity。

对 DENY 规则，可能出现：

```text
static DENY -> 不匹配 -> default ASK -> approval -> execute
```

对 ALLOW 规则，则可能继续授权“首次解析时指向的旧资源”，而不是“当前 rule path 指向的资源”。

## 2.2 修复契约

必须满足：

1. **不得使用 install-lifetime successful exact-rule key 作为 authority。**
2. 每次 managed operation decision 时，所有同 tool 的 exact rules 必须针对当前 resolver basis fresh resolve。
3. operation 与 rule 使用同一 resolver seam、同一当前 session cwd basis、属于同一 permission-decision evaluation。
4. DENY exact rule resolve failure继续保持 fail-closed：任意相关 DENY exact rule canonicalization failure → operation DENY；不进入 A3 resolver；zero request；zero body effect。
5. ALLOW / ASK exact rule resolve failure保持当前裁决：当前 decision 中视为 non-match；不产生正向 authority。
6. `any` rule 不调用 path resolver。
7. 不改变 A3 matcher 语义。

优先采用最简单方案：**直接删除 `ruleKeyCache`，每个 decision fresh resolve。** 不引入 cache invalidation、filesystem generation、TTL、watcher。

## 2.3 实施步骤

### H4-a — 先写 RED probes

#### Probe A1 — DENY retarget

Policy：

```yaml
default: ask
deny:
  - tool: read
    resource:
      kind: exact
      path: alias.txt
```

阶段 1：

```text
alias.txt -> key-A
operation alias.txt -> key-A
=> static DENY
```

随后：

```text
alias.txt -> key-B
```

阶段 2：

```text
operation alias.txt -> key-B
rule alias.txt -> key-B
=> 仍 static DENY
=> zero ControlRequest
=> body 0
```

当前实现必须 RED：若 cache 生效，第二次 rule 仍为 A。

#### Probe A2 — ALLOW retarget 不可保留旧 authority

Policy：

```yaml
default: deny
allow:
  - read exact alias.txt
```

阶段 1：

```text
alias.txt -> key-A
read alias.txt -> ALLOW
```

随后 alias retarget：

```text
alias.txt -> key-B
```

再执行一个当前 canonical key = A、但 path 不是当前 alias 指向对象的调用。

预期：

```text
不得因旧 cached allow key=A 而获得 ALLOW
```

#### Probe A3 — transient DENY failure retry

保持现有 DR-A 类测试：

```text
DENY rule resolve failure
=> fail-closed deny
=> failure 不缓存

下一次 resolver 恢复
=> fresh resolve
=> 按当前 rule identity 决策
```

### H4-b — 删除 lifetime success cache

删除：

```ts
const ruleKeyCache = new Map<string, string>()
```

将 canonical rule resolution 改成 fresh resolver wrapper：

```ts
const canonicalRuleKey = async (path: string): Promise<string | undefined> => {
  try {
    const { key } = await resolveTarget(path)
    return key
  } catch {
    return undefined
  }
}
```

如果 resolver 可能返回 malformed `{key}`，不得悄悄接受；复用已有 target validation 或明确保证 injected seam 的合法性。

### H4-c — 更新契约文档

删除/修正所有：

```text
cached for the scope's lifetime
canonicalized once per agent scope
```

改成：

```text
same-tool exact rules are canonicalized fresh for each permission decision
against the same live resolver/cwd basis as the operation
```

重点检查：

- `pre-execute-adapter.ts` 模块头 R2
- `canonicalRuleKey`
- `canonicalLane`
- `canonicalRulesFor`
- `permission-resolver.ts` 输入契约
- evidence / plan 中旧 cache 描述

### H4-d — cwd basis 回归

当前 production glue 的 `resolveTarget` 在 resolve 时读取：

```js
agentCtx.agent?.session?.header?.cwd
```

测试必须证明：

- operation resolve 与 rule resolve 使用同一 closure；
- cold resume 重建后使用 resumed session 的 cwd；
- 不重新引入“install 时 capture cwd”的旧行为。

# 3. P1-B — Bash fingerprint 未完整绑定 execution effect

## 3.1 当前问题

当前 Bash projection：

```ts
{
  tool: 'bash',
  commandHash: hashString(command),
}
```

但 pinned upstream Bash DTO 包含：

```ts
interface BashToolArgs {
  command: string
  description: string
  timeoutMs?: number
  workdir?: string
  run_in_background?: boolean
  sandbox_permissions?: string
  justification?: string
}
```

其中至少：

- `workdir`
- `run_in_background`
- `sandbox_permissions`
- 显式 `timeoutMs`

会改变实际 execution effect。

因此当前 `operationFingerprint` 还不能完全满足 ControlService 的 exact resource + payload impact identity 契约。

## 3.2 修复原则

不做：

- shell AST 解析；
- 命令语义等价性分析；
- 将 `description` 作为 authority；
- 将 `justification` 文本作为 authority；
- 替换 upstream native sandbox approval。

要做：

Bash resource 继续保持：

```ts
{ kind: 'tool', key: 'bash', display: 'bash' }
```

但 fingerprint projection 至少扩展为：

```ts
{
  tool: 'bash',
  commandHash,
  workdir: <canonical/effective authority representation>,
  runInBackground: boolean,
  timeoutMs: <explicit value | null>,
  sandboxPermissions: <requested mode | null>,
}
```

# 4. Bash 各字段裁决

## 4.1 `command`

继续 hash raw command：

```ts
commandHash = sha256(raw command)
```

不 normalization、不 shell parsing。missing / non-string / whitespace-only 继续 fail-closed。

## 4.2 `description`

排除，不进入 authority fingerprint。不同 description 必须产生相同 fingerprint。

## 4.3 `run_in_background`

必须进入 fingerprint：

```ts
args.run_in_background ?? false
```

如果非法类型可能到达 pre-execute，则 fail-closed。

## 4.4 `timeoutMs`

显式值必须进入 fingerprint：

```ts
timeoutMs: args.timeoutMs ?? null
```

不要自行填 deployment executor 默认 timeout。omitted 与 explicit value 应区分。

若 malformed shape 可达 Team pre-execute：

- 非 finite
- <= 0
- 非 number

应 fail-closed。

## 4.5 `sandbox_permissions`

必须进入 fingerprint：

```ts
sandboxPermissions: args.sandbox_permissions ?? null
```

不在 Team 层重写 sandbox mode legality，但非法类型若可达则 fail-closed。

`justification` 不进入 fingerprint；它是解释文本，authority 是请求的 sandbox mode。

## 4.6 `workdir`

这是本轮最重要的 Bash 细节。

上游语义：

```text
explicit absolute workdir -> use it
explicit relative workdir -> relative to session/sandbox workspace root
omitted -> effective session/sandbox cwd
```

### 推荐实现

绑定 canonical/effective workdir identity，而不只是 raw string。

理想性质：

```text
same effective workdir => same fingerprint
different effective workdir => different fingerprint
```

优先使用公开 seam，不复制 upstream 私有 `resolveWorkdir()` 实现。

如果公开 seam 无法准确复现，允许保守最小方案：

```ts
{
  rawWorkdir: args.workdir ?? null,
  sessionCwd: currentSessionCwd
}
```

要求 relative workdir 至少与 session cwd authority 绑定。

禁止继续只绑定 `commandHash`，也不建议只绑定 raw workdir 而忽略 relative path 的 cwd basis。

# 5. Bash RED/GREEN 测试矩阵

先写 RED probes，再实现。

### B1 — same command / different workdir

```text
command = "pwd", workdir = "/A"
command = "pwd", workdir = "/B"
=> fingerprint MUST differ
```

### B2 — workdir default/equivalence ruling

若实现 effective canonical workdir：

```text
workdir omitted + session cwd /A
workdir "/A"
=> 若 upstream effect相同，则 fingerprint应相同
```

若实现保守 raw+session basis，允许不同，但必须明确记录为 deliberate conservative distinction。

### B3 — foreground vs background

```text
same command
run_in_background omitted/false vs true
=> fingerprint differs
```

### B4 — timeout

```text
same command
timeout omitted vs 10000
=> fingerprint differs

10000 vs 20000
=> fingerprint differs
```

### B5 — sandbox mode

```text
same command
sandbox_permissions absent vs mode
=> fingerprint differs

mode A vs mode B
=> fingerprint differs
```

仅使用 pinned upstream 可构造/允许的 mode。

### B6 — presentation-only fields

```text
same authority fields
description A vs description B
=> fingerprint same

same sandbox_permissions
justification A vs justification B
=> fingerprint same
```

### B7 — raw command distinction继续保持

```text
"echo x"
vs
"echo  x"
=> fingerprint differs
```

### B8 — malformed effect fields fail closed

对实际可达 malformed shape 至少覆盖：

- non-string workdir
- non-boolean run_in_background
- invalid timeoutMs
- non-string sandbox_permissions

要求：

```text
deny
zero durable request
zero tool body
```

若 upstream 在 Team listener 之前保证这些形状不可达，必须提供 pinned upstream 证据。

# 6. Bash approval summary UX

当前：

```text
bash <command preview>
```

建议升级为 bounded non-authority summary：

```text
bash [cwd=<display>] [background] <command preview>
```

可选附加：

```text
[sandbox=<requested-mode>]
[timeout=<n>ms]
```

要求：

- summary 仍是 non-authority；
- 不持久化完整超长 command；
- command preview 保留现有 120-char cap；
- authority 只来自 fingerprint / exact scope。

# 7. P0 monotonic end-cap 不得回归

至少重跑：

1. static deny + hostile prepend allow → end-cap DENY；
2. default ask + hostile prepend allow → end-cap DENY，zero request；
3. static allow + no hostile → execute once；
4. ask→allow + no hostile → execute once、allow-once consumption；
5. unsupported tool → guard abstain；
6. sibling agent marker 不泄漏；
7. cold resume 重新安装 listener + guard；
8. disposer 同时移除 listener + guard；
9. PTC nested managed tool 仍经过 guard；
10. hostile listener force-allow 不得因本轮 Bash/workdir seam 修改重新绕过。

现有 `h1a-pre-execute-endcap.test.ts` 应保持全部 GREEN。

# 8. Production wiring 检查

如果 Bash workdir 修复需要新增 seam，必须覆盖：

```text
fresh root
fresh member
cold-resumed root
cold-resumed member
```

每个 permissions agent：

- exactly one permission listener；
- exactly one end-cap guard；
- Bash authority resolver 使用该 agent 当前 session workspace basis；
- close 后全部 disposer drain；
- permissions absent 的 alpha.1 agent 仍安装 zero permission listener / zero end-cap guard。

不得使用 global `process.cwd()` 取代 session cwd。

# 9. Live 验证

不必再次复制完整 135 项 hostile drill，但需要最小真实 host smoke。

### L1 — exact-rule topology / identity

若环境可构造 symlink/junction：

```text
alias -> A
DENY alias
read alias -> deny

retarget alias -> B
read alias -> 仍 deny
zero request
```

Windows 若 symlink 权限受限，可用 junction 或 production-like mutable backend fixture，并记录原因。

### L2 — Bash scope distinction

真实 host 至少触发两个 ASK Bash：

```text
same command
different workdir
```

确认 ledger：

```text
operationFingerprint differs
requestId differs
summary可辨识
```

再做：

```text
same authority args + new callId
=> same fingerprint
=> correlation 不同，因此 new request
```

### L3 — hostile regression

至少：

```text
managed read + hostile prepend allow
=> exact end-cap reason
=> body no effect
```

### L4 — cold resume

cold-resume 后确认：

- permission listener/guard rebuilt；
- exact rule fresh canonicalization成立；
- Bash fingerprint projection一致。

# 10. 回归门禁

## 10.1 Focused suites

至少：

```text
a1 permission policy
a2 canonical operation
a3 permission resolver
a4 exact control scope
a5 pre-execute
a6 production wiring
h1a end-cap adversarial
h3 hostile seam
```

## 10.2 Full parity

记录：

- runtime full suite
- domain full suite
- testkit
- typecheck
- build
- build:composition / committed artifact check

若 repo 仍有 pre-existing failures，必须列出：

```text
baseline failing set
new tip failing set
diff
```

要求：**NO new deterministic failure**。

## 10.3 Core patch

必须证明：

```text
references/deepseek-harness-test-use @ a66e470204
porcelain clean
CORE PATCH BUDGET = 0
```

# 11. 推荐提交拆分

## Commit H4-a — RED probes: stale exact-rule authority

只加 RED tests/evidence，不改产品代码。

## Commit H4-b — remove lifetime exact-rule authority cache

删除 `ruleKeyCache`；fresh per-decision resolution；更新 R2 docs；GREEN。

## Commit H5-a — RED probes: Bash effect fingerprint

加入 workdir/background/timeout/sandbox/presentation-only tests；旧实现 RED。

## Commit H5-b — Bash effect projection implementation

实现 canonicalizer/seam、必要 fail-closed validation、summary、production wiring；GREEN。

## Commit H6 — closure

focused + parity gates；live smoke；cold resume；evidence；dist/artifacts；bookkeeping。

不得在 H4/H5 中顺手加入 alpha.3 功能。

# 12. 证据文件要求

建议：

```text
dev/agent-workflow/evidence/alpha2-hardening-followup/
  h4-rule-identity/
    red-console.log
    green-console.log
    root-cause.md
  h5-bash-effect/
    red-console.log
    green-console.log
    upstream-contract.md
    projection-ruling.md
  h6-closure/
    matrix.md
    runtime-parity.txt
    live.json
    cold.json
    closure-report.md
```

`upstream-contract.md` 至少定位 pinned DSH：

- `fs-local` targetKey / realpath identity；
- Bash DTO；
- `validateBashArgs`；
- `resolveWorkdir`；
- background execution；
- sandbox escalation path。

必须写 path + commit pin + 关键行为。

# 13. Closure Matrix

| ID | 场景 | 必须结果 |
|---|---|---|
| R1 | exact DENY，identity 未变化 | static deny |
| R2 | exact DENY，rule path retarget | 仍 static deny |
| R3 | exact ALLOW，rule path retarget | 不复用旧 authority |
| R4 | DENY rule transient resolve failure | fail-closed deny |
| R5 | failure 后 resolver 恢复 | fresh re-resolve |
| B1 | same command, workdir A/B | fingerprint different |
| B2 | foreground/background | fingerprint different |
| B3 | timeout A/B | fingerprint different |
| B4 | sandbox mode A/B | fingerprint different |
| B5 | description only changes | fingerprint same |
| B6 | justification only changes | fingerprint same |
| B7 | same authority args | deterministic same fingerprint |
| C1 | same fingerprint + different callId | new request |
| C2 | same callId + different fingerprint | cannot reuse old request/approval |
| P0-1 | hostile prepend allow | managed tool denied by end-cap |
| P0-2 | normal static allow | executes once |
| P0-3 | normal ask→allow | exact allow-once |
| L1 | fresh root/member | listener+guard active |
| L2 | cold root/member | listener+guard rebuilt |
| L3 | permissions absent | zero permission surface |

# 14. Definition of Done

只有同时满足以下条件，才允许重新标记 alpha.2 permission baseline 为 FROZEN：

- [ ] install-lifetime successful exact-rule authority cache 已删除，或有同等强度可证明 invalidation；默认要求删除
- [ ] topology-retarget RED probe 在旧实现可重现
- [ ] GREEN 后 exact DENY 不可降级成 ASK
- [ ] stale ALLOW authority 不可跨 retarget 保留
- [ ] Bash fingerprint 至少绑定 command + workdir authority + foreground/background + explicit timeout + requested sandbox mode
- [ ] description / justification 不作为 authority，并有测试
- [ ] malformed Bash effect fields按实际 reachable contract fail-closed
- [ ] Bash approval summary 可辨识关键 effect
- [ ] ControlService 无架构修改
- [ ] P0 monotonic end-cap focused suite 全绿
- [ ] fresh / member / cold resume lifecycle 无回归
- [ ] legacy / alpha.1 permissions-absent 行为无回归
- [ ] full-suite 无新增 deterministic regression
- [ ] typecheck / build / composition artifact gate 通过
- [ ] `CORE PATCH BUDGET = 0`
- [ ] 无 alpha.3/alpha.4 capability creep
- [ ] closure report 明确列出保留 P2 debt

# 15. 本轮保留到后续的 debt

不要扩大范围修：

1. `read` omitted limit 与 deployment live `readLimit` drift；
2. PF-1 `/state` active-turn chain hold；
3. PF-2 delivery recovery replay；
4. hostile live HTTP seam 的最终删除——记录为 **RC 前必须删除**；
5. repo 原有 baseline failed tests；
6. alpha.3 dynamic governance。

# 16. 给执行 Agent 的最终指令

按以下顺序执行：

```text
1. 读取 pinned upstream 契约，重新验证本计划事实；
2. 实现 H4 RED probes，不改产品代码；
3. 确认旧实现真实 RED；
4. 修 exact-rule stale authority；
5. focused GREEN；
6. 实现 H5 Bash RED probes；
7. 确认 command-only projection真实 RED；
8. 设计并落地最小 Bash effect projection；
9. focused GREEN；
10. 重跑 P0 hostile/end-cap；
11. 跑 production wiring + cold resume；
12. 做最小 live smoke；
13. full parity / typecheck / build / artifact gate；
14. 输出 closure report；
15. 只在所有 DoD 满足后标记 alpha.2 permission baseline FROZEN。
```

若测试证明本计划某项前提与 pinned upstream 不一致：

- 不要强行实现计划；
- 先生成 deviation record；
- 写明 upstream 证据；
- 选择权限更保守的行为；
- 不得用“测试改成通过”代替安全契约修复。
