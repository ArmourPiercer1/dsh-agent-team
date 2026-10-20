# ① jobs 身份 lease — 接线真相判定与验收收口（append-only）

工作树 `.worktrees/a5-jobs-isolation` @ `d5de74974b0320b191b310ead82407d478477ed7`。
语义源=pc-CONTRACT.md §0/§1.1 + R2b 线（unreadable=拒，非"没变"）；**语义未改**，只收口现状核实+验收补测。

## 结论行：三套 lease 词汇面，三个不同平面，无相互冒充（不构成语义冲突）

| lease 面 | 入口 | 生产消费方 | 生产可达性（d5de7497 现场） |
|---|---|---|---|
| **域 ExecutionLease**（授权代数：scope==grant、cancel≠terminated、termination-unconfirmed 诚实态） | `packages/domain/tool-governance/src/lease.ts`（219 行） | `runtime/tool-admission/admission-kernel.ts` `consumeForExecution`（openExecutionLease L604；requestCancellation/settleTermination L626-632） | **生产路径永不打开 lease**：生产装配唯一执行边 `createFsAdmissionPort.recheckCall`（admission-kernel.ts:1116）**不传 executionKind** → 恒 `{grant, lease:null}` 分支。open 分支有域测（a5p0-contracts:288-405）+kernel 测，但生产不可达=已披露的"只有模块"面，非缺陷（executionKind 属 provider 平面输入）。 |
| **网关 lease-window**（job 侧 self-counted 窗口：ACTIVE→DRAINING→RELEASED/GIVEN_UP，跨边界 settle 拒、token 保留） | `packages/runtime/jobs-gateway/lease-window.ts`（171 行） | `jobs-gateway.ts`（339 行）驱动；生产装配=GLUE-5 LIVE ROW `runtime/src/plugin/live/jobs-gateway-assembly.mjs`（132 行，identity/lease/definition 三注入源自己执法） | **装配 LIVE 挂载**：`agent-bindings.mjs:2470-2488` 每 owning-root 一份（governed mount 下），dispose 摘除 :5191-5192，只读见证口 `liveJobsGatewayFor` :5431（NON-AUTHORITY）。但 **`admitTeamJob`（assembly:124）今日零生产调用点**——actuator 腿 `ctx.jobs.start` 缺位=行头已披露缺口（w7m2 缺项 1，`job_*` 覆盖不在计划）。即：身份门/lease 镜像/owner 围栏代码 LIVE 装配、宿主 `job_*` 热路径空闲，仅 kit/测试经见证口驱动。 |
| **ProviderLease**（冻结 lease 词汇镜像；spawn 收据+有界确认窗 default 8000ms→termination-unconfirmed） | `packages/runtime/sandbox-provider/provider.ts:111-141,368-386` | confined-provider（exec/shell 行、LSP realm 清理 `lsp-assembly.ts:225` 引用 lease settle 状态） | **唯一在生产真实走完 lease 生命周期的面**（confinedProvider 挂载的世界；a5ie-r2b A6-A7 真 Landlock 实证）。termination-unconfirmed 有测（a5p4-provider/a5p4-phases/a5lsp2-streaming）。 |

**不一致是否构成缺陷=否**：三面对应授权代数/准入计数/进程收据三个平面；pc-CONTRACT §0 明文把 identity/lease/definition 定为生产类注入执法点，ProviderLease 是词汇镜像非第二权威。**真实缺口（如实）**：网关门在生产为"LIVE-mounted, idle-gated"（actuator 缺位）；域 ExecutionLease open 分支生产不可达（生产只跑 lease:null 分支）。两者均为在册披露态，非本路可修（需宿主 seam）=记录。

## 三验收形态现状（判定 + 补测）

| 形态 | 既有覆盖（现场核） | 缺口 | 本路补测 |
|---|---|---|---|
| 同 ID 争用 | 网关级已钉：`a5p7-job-owner.test.ts:41-52`（owner-mismatch+alarm / duplicate-job）、`:154-161`（注入源下码不变）；lease-window re-arm 拒=lease-cancellation:87 | **装配（生产行）级零覆盖**：durable MemberInstance 行源下的争用、权威拷贝 ownerKey、被拒方零扰动，全部无测（此前仅 lane-hygiene 钉 import 边） | 新 `a5p7-jobs-assembly.test.ts`：same-ID cross-member=owner-mismatch+alarm+A 记录/token 零扰动；same-owner=duplicate-job |
| 过期回收 | grant 层 `grant-expired`→APPROVAL_STALE 已钉（domain grant.ts:142 + a5p2-admission-clock.test.ts:171）；provider 层有界确认窗→termination-unconfirmed 已钉（a5p4-provider）；**lease 层无 TTL=法**（lease-window 头："does not time on its own"；giveUp=外部决定且终态，release 永久拒） | 装配级 teardown 法（drain 立拒新 admit 零注册/outstanding 阻 release/giveUp 终态/重组新窗口）无测 | 同上：drain→gateway-not-active 零注册；跨 drain settle token 保留；giveUp→release 永久拒；re-assembly 新窗口对象 |
| 跨成员不可用 | 网关级：projectFor 非 owner 拒且不回显 owner 身份（a5p7-job-owner:56-66）；credential 采集即脱敏（:68-90） | 装配级：两成员 durable 世界 B 读 A、跨 root claim、行不可读=未确认，无测 | 同上：B projectFor 拒（无 inst-1/ownerKey 外泄）；cross-root claim=owner-not-durable；repository throw=全拒（closed world） |

## 运行记录

- `vitest run packages/runtime/test/a5p7-job-owner.test.ts packages/runtime/test/a5p7-lease-cancellation.test.ts` → **27/27 PASS**（基线现状绿，未改语义）。原文：`runs/vitest-owner-cancel-green.log`。
- 新 `packages/runtime/test/a5p7-jobs-assembly.test.ts`（14 tests）→ **14/14 PASS**。原文：`runs/vitest-jobs-assembly-green.log`。

## RED 原文留档（先红后绿，append-only）

首跑（fixture 缺陷：drain 测试中 OWNER_B 未注册 agent:wb 定义 → 在 GATE 2 `mapping-rejected` 就被拒，未达 lease 门）：

```text
FAIL packages/runtime/test/a5p7-jobs-assembly.test.ts > a5p7 live row — row-local definition store (closed world) and teardown > drain refuses new admits from the first instant; release needs the self-counted zero; giveUp ends release forever
AssertionError: expected false to be true // Object.is equality
 ❯ packages/runtime/test/a5p7-jobs-assembly.test.ts:233:60
    231|     expect(asm.drain().ok).toBe(true)
    232|     const late = asm.admitTeamJob({ jobId: 'j2', owner: OWNER_B, scope…
    233|     expect(!late.ok && late.code === 'gateway-not-active').toBe(true)
Tests  1 failed | 13 passed (14)
```

判定=测试 fixture 缺陷（门序 identity→jobId 冲突→definition pin→lease 门；被测门未被触达），非产品缺陷。修正=为 B 注册合法定义使声明达 lease 门；复跑 14/14。红原文未改写。

## 登记披露（进矩阵 ③ 用）

- 显式 `pinnedIdentity` 透传=网关 fixture 形（pc-CONTRACT §1 行 3）：行内空 store 只拦 pin-less admit；caller-declared pin 可过 admit，但 C-BIND 复核仍走行 store（不可读=移动 ⇒ 取消）。今日无生产调用方可用（actuator 缺位）。已钉 `explicit caller pins stay the fixture shape` 防漂。
- 域 ExecutionLease 与网关 window 的"两套 lease"判定见结论行：平面不同、不互相冒充，不构成语义冲突（无需四联停项）。
