# pc-CONTRACT — PR7 jobs-gateway 生产装配契约（gateway 实例化点 = 宿主注入面）

- writer = **P-C writer（PR7 gateway 实际 owner/lease 接入生产模块）**；分支 `alpha5-prod-pr7`，base = `origin/master`（本文件写入时 fetch 所见 tip，见文末 head）。
- 性质 = **装配契约 + GLUE-5 live row 草案**。本 PR 只落 `packages/runtime/jobs-gateway`（src + 其测）、本 lane 的 kit（`tests/kits/a5-w7-jobs-wiring`）、本契约与复跑证据。**live 装配行不落**（= GLUE owner 的 live row，IF-5 共享文件零改）；gateway lane 在本 PR 之后仍是 **DORMANT（无生产 import 边）**——变的是"DORMANT 的精确层"从"语义未固化"收敛为"仅缺 live row 一行"。
- 语义来源 = kit 实证：W7（`tests/kits/a5-w7-jobs-wiring`，22 criteria）、W7M（`tests/kits/a5-w7m-m13-domain-veto`，24/24）、W7M-2（`dev/agent-workflow/evidence/alpha5/wiring/w7m2`，green 16/16）+ bind-diag Jobs promised-goal 表（`wiring/bind-diag/README.md:91-97`）。本 PR 把这些**行级(row-local)常量与行级纪律**固化为**生产类的注入式源 + 生产类自身执法**。

## 0. 一句话

> 行不再"持有真相、替 gateway 把关"；生产类接受宿主注入的 **identity / lease / definition** 三源并**自己执法**：owner 不由 caller 口头声明（durable 源确认，先于 lease）、lease 窗口归装配所有（注入对象即驱动对象）、定义身份在 admit 边经注入 reader 现读（读不到 ⇒ 类型拒绝，零注册）。

## 1. gateway 实例化点（装配契约的"插座"）

实例化点 = **一个第三方 plugin row**（p6t6 形状，profile-patch seam 挂载；kit 行 = 已实证形状）。cordis 注入：

```js
export const inject = ['webServer', 'teamRoot', 'jobs']   // jobs = 宿主公开 jobs registry（w7m2 实证）
```

三个宿主事实源 + 一个披露位：

| 注入位 | 生产类型 | 宿主真源（已实证） | 注入缺位时的封闭世界 |
| --- | --- | --- | --- |
| `identity` | `GatewayIdentitySource`（`resolve(claimed): JobOwner \| null`） | `teamRoot.domain.repositories.memberInstances.list(rootSessionId)`（生产装配自己的 durable repository，W7/W7M-2 的公开读） | 不注入 ⇒ 保持 fixture 形状（caller 声明照单全收，= base 行为，a5p7 fixtures 不回归） |
| `lease` | `LeaseWindow`（`createLeaseWindow(sink)` 造的**装配自有**窗口） | 装配生命周期归装配：teardown 动作 drain/release/giveUp 打在**同一个对象**上；未来 GLUE 可注入 PR1 dispatcher lease 的 job 侧镜像适配器 | 不注入 ⇒ gateway 私有窗口（base 行为） |
| `resolveDefinition` | `DefinitionIdentityProbe`（`(scopeKey,name) => {ok,identity}`） | admit 时 pin（`pinnedIdentity` 省略时现读）+ `onRegistryChange` 复核。**宿主今日无公开 seam 供第三方行移它 scope 的 Definition**（W7/W7M-2 重测不议论）⇒ 生产装配今日仍注入 row-local store，**披露** | 无 reader + pin 省略 ⇒ `mapping-rejected`（closed world：不给读不到的调用立项）；change 复核无 reader ⇒ 全部视为 moved |
| `jobs`（ctx.jobs） | 不在 gateway options 内（gateway **不是** registry） | 宿主 `@deepseek-ai/dsh-jobs` 公开面：`start/wait/readAt/list/get(caller)`（w7m2 真注册/真 fence 实证）。装配层把 gateway admit（TeamPermit 语义）通过后接 actuator → `ctx.jobs.start`；**两层 fence 各自独立**：registry 按 caller session fence（`job … belongs to another session` 原文），gateway 按 member-scope fence | 缺位 ⇒ 装配没有效应面，gateway 只做投影/lease/取消适配（今日受治理 team 的用户 jobs 能力仍 = 宿主公开面，非本 lane 宣称） |

### 1.1 构造样例（宿主注入 = 契约的可执行定义）

```js
// —— 装配行内（kit 行已实测形状；GLUE-5 落地时代码归 live row）——
import { createJobsGateway, createLeaseWindow } from '<committed-dist>/packages/runtime/jobs-gateway/index.js'

// ① identity provider：durable MemberInstance 行是身份权威
const identity = {
  resolve: (claimed) => {
    try {
      const rows = teamRoot.domain.repositories.memberInstances.list(String(claimed.rootSessionId))
      const hit = rows.find((m) => String(m.instanceId) === String(claimed.instanceId))
      return hit === undefined ? null
        : { rootSessionId: String(claimed.rootSessionId), instanceId: String(hit.instanceId) } // AUTHORITY COPY
    } catch { return null } // 读不到 = 不确认（closed world）
  },
}
// 契约：仅当 durable 状态存在**恰好这两分量**的行才返回；返回对象被 gateway 冻结为 ownerKey。
// 执法位置 = admitJob 的第一道门，先于 lease.acquire ⇒ 拒绝 = 零注册（无 job 记录、无 lease token、零状态增量，仅一条 alarm）。

// ② lease store：装配自有窗口，注入进去；teardown 打在它身上
const lease = createLeaseWindow((o) => assemblyLedger.push(o))   // sink = 装配自己的观察面
// 契约：gateway.lease === lease（W6 实证同物）。drain 起新 admit 立拒；跨边界 settle 类型拒绝且
// token 保留；giveUp 后 release 永久拒绝——这些是窗口自己的法，装配只管对象。

// ③ definition reader：admit 边 pin + C-BIND 复核（今日 = 披露的 row-local store）
const resolveDefinition = (scopeKey, name) =>
  store.has(k(scopeKey, name)) ? { ok: true, identity: store.get(k(scopeKey, name)) }
                               : { ok: false, identity: 'never-registered' }

// ④ 组装
const gateway = createJobsGateway({ identity, lease, resolveDefinition, onObserve: (o) => assemblyLedger.push(o) })

// ⑤ 生产形状的 admit（无 caller 常量：owner 被 durable 源确认；pin 被 reader 现读）
gateway.admitJob({ jobId, owner: { rootSessionId, instanceId }, scopeKey, toolName })
// → 未确认 owner：{ ok:false, code:'owner-not-durable' }（先于 lease）
// → 定义不可读：      { ok:false, code:'mapping-rejected' }（先于 lease）
// → 成功：job.pinnedIdentity = reader 当下所报（执行时锚，后续改名不改锚）
```

对外面（Web/Jobs 消费）纪律不变：路由只出 owner-scoped 投影、类型拒绝、窗口 STATE + outstanding call ids；**lease 句柄永不过面**（review-LaneF cond.3），lifecycle 只走装配自有 teardown 动作。

## 2. kit 语义 → src 固化对照（本 PR 的固化清单）

| kit 实证（原持有者=行） | 现固化于（执法者=生产类） | 证据 |
| --- | --- | --- |
| W3 identity：owner 由驱动从 durable 行读回再传入，行纪律保 pin | `identity.resolve` 先于一切状态；`owner-not-durable` 新拒绝码；冻结用 AUTHORITY COPY | `jobs-gateway.ts` GATE 1；spec `a5p7 injected identity source`（4 tests）；W3 腿复跑 |
| W7M-2 veto=零注册：拒绝面零副作用（registry delta=0） | GATE 1/GATE 2 均在 `lease.acquire` 之前 ⇒ 拒绝零 token 零记录 | spec `zero state delta` / `gate runs BEFORE the lease`；w7m2 C7/三格复跑 |
| W5/kit 行 `pinnedIdentity:'def-v1'` 常量 | admit 省略 pin ⇒ 经注入 reader 现读（`mapping-rejected` 封闭）；显式 pin 保留为 fixture 形状 | `jobs-gateway.ts` GATE 2；spec `admit-time definition pin`（3 tests）；W5b 改走 reader |
| W6/W7 行持有窗口 + 行路由 teardown | `lease` 注入：gateway 驱动装配对象 | spec `injected lease window`（3 tests）；W6 `assemblyOwnsWindow=true` |
| W4 隔离（投影/列表互不可见） | 不变（已 src 化：canonical key + 静态 detail 不泄身份） | spec 既有 + W4 复跑 |
| C-BIND cancel-only-what-moved + 执行时归因 | 不变（已 src 化），production-shape 腿把三注入合到一条链 | spec `PRODUCTION SHAPE`（第 7 tests）|
| W7M/W7M-2 域侧 veto/CAS/device 互锁 | **不固化**（域语义归 domain lane，M-13 台账；gateway 只保自己 TeamPermit 腿的零注册） | w7m2 README 缺项台账 |

## 3. GLUE-5 live row 草案（给 GLUE owner；本 PR 不落）

落点建议 = 与 `plugin/live/agent-bindings.mjs` 同一 live 装配层的**一行**（或 `plugin/live/jobs-gateway-assembly.mjs` 由 host glue import——import 边即"PR7 的 production import 边"，由 GLUE 亲手落）。最小形状（kit 行的生产化，删除驱动面路由，只留装配生命周期 + 消费投影）：

```js
// GLUE-5 草案（shared/live 面，owner=GLUE；此处为草案样例，非本 PR 落地物）
import { createJobsGateway, createLeaseWindow } from '../jobs-gateway/index.js' // dist 镜像内相对 import

export function createLiveJobsGatewayAssembly({ teamRoot /* , jobs = ctx.jobs */ }) {
  const ledger = []
  const lease = createLeaseWindow((o) => ledger.push(o))
  const gateway = createJobsGateway({
    identity: durableMemberIdentitySource(teamRoot),   // §1.1 ① 的提法
    lease,
    resolveDefinition: <live definition reader>,        // 宿主 seam 落地前=披露位
    onObserve: (o) => ledger.push(o),
  })
  return {
    gateway,
    // 效应腿（w7m2 已实证）：TeamPermit(gateway.admitJob) → 域裁决 → actuator(ctx.jobs.start, owner=child session)
    // 装配 teardown：
    drain: () => lease.drain(),
    release: () => lease.release(),
    giveUp: (why) => lease.giveUp(why),
    observations: () => ledger,
  }
}
```

GLUE 落地时的检查单（本契约的验收面）：
1. **import 边只进 dist 镜像**（`packages/runtime/dist/packages/runtime/jobs-gateway/*`，已随本 PR 刷新且 W0a 证新鲜）；`check:artifacts` 过。
2. live row 是新增 scannable 文件 ⇒ **p4t6 census bump 归 GLUE**（本 PR 未加 packages/** 新文件，census 数不动；lane 文件集 pin 不变）。
3. 注入三源按 §1 表；`jobs` 缺位时装配仍自洽（gateway 不假造宿主 jobs 能力；`job_start` absent anchor 不许被行"补"出来）。
4. teardown 语义进装配生命周期（装配代际重建 = 新窗口或按装配决定复用；kit 已证两代形状）。
5. 拒绝码面：`owner-not-durable` / `mapping-rejected` / `gateway-not-active` / `duplicate-job` / `owner-mismatch` / `late-settle-across-boundary` / `release-with-outstanding` / `drain-given-up`（closed set，types.ts）。

## 4. 兼容性矩阵（零回归口径）

| 消费者 | 消费面 | 本 PR 后 |
| --- | --- | --- |
| a5p7 单测（27→38） | barrel，全部 fixture 形状（显式 pin、无注入） | 行为逐字不变（新行为 opt-in）；新增 11 spec 固化注入语义 |
| W7 kit（22 criteria） | 原 kit-local 编译 → **committed dist + 注入三源**；W5b 走 reader-pin，W1b/W6 加注入证据断言；criteria 数 22 不变 | 本 PR 改（kit 归本 lane） |
| W7M-2 kit green（16 criteria） | **committed dist 原样**（8 值导出、显式 pin、option 子集） | **零改动复跑**；barrel sha 随 src 演进（kit 只测 run 内稳定，无钉死） |
| W7M kit | 不 import gateway（公开 jobs 面 + veto 台账） | 零改动 |
| 生产装配 | 零 import 边 | 不变——hygiene spec 依旧绿；live row 归 GLUE-5 |

## 5. 残余（不随本 PR 变，逐项指主）

- **live row 一行** = GLUE-5（本契约 §3 草案）；G-d 集成确认未闭（在册）。
- G-g OPEN：abort 传播 COOPERATIVE，无终止保证（W7b 原样复证）。
- definition 身份源今日无宿主 seam ⇒ row-local 披露位（W7/W7M-2 重测）；宿主 registry 形状链 = fixture（a5p7-mcp-rebind-chain 7/7）。
- `job_*` coverage 注册 = 计划外 + 缺 operations adapter（w7m2 缺项 1，门禁自己的 remediation 两案在册）；受治理会话内 model-driven bash→ctx.jobs 的 preset-realm 拒绝 = bind-diag 已归因（(i) 装配补全，H-world C5-bg 实证公开修法）。
- `final_declaration` 恒 null 纪律不变；本契约不作生产就绪宣称。
