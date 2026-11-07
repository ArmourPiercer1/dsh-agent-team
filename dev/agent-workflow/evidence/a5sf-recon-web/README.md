# RECON-WEB — D 面（Web）DEV-LIVE 侦察轮：allow/deny 两车道的归因

> **Draft PR 首行标识：`RECON-WEB`**
> 本文件是**侦察证据**，不是候选证据：`recordClass=DEV-LIVE`、`eligible=false`、`V@B` **不变**。
> 未改任何产品源码、矩阵、register 或 STATUS。所有新增文件都在 `dev/agent-workflow/evidence/a5sf-recon-web/`。

**三句结论**

1. **两个工具在受治理 Member 上都可达**：真实 Model turn 的 `tools` 数组里出现 `web_fetch` 与 `web_search`（24 名工具 = Leader 的 22 名 + 这 2 名），并且 Member 的两条调用都真的打到了我们控制的本地端点（allow 车道：端点收到 2 个请求、返回 `A5SF_RECON_WEB_ALLOW_BYTES` / `A5SF_RECON_WEB_SEARCH_BYTES`）。
2. **guard 真的被求值**：每次 `ctx.web.*` 调用都产生 1 条 `a5sf-guard-consult/1` fact（allow 2 条 `decision=allow`；deny 3 条 `decision=deny`），fact 从产品 sink 落盘、带 `memberIdentity` / `method` / `locator` / `policyRevision`。
3. **deny 在“服务级准入”层被拒，不是被 OS 拒**：拒绝发生在我们自己的 confined web face 内、provider 之前（`NETWORK_UNCONFINED_REALM`，端点收到 **0** 个请求、provider entry **0** 条、capability probe 3 次）。这条链上 OS 从未被要求拒绝任何东西；BL-42 的 subprocess netns 证明对本面**不适用**（`NETWORK_PROOF_FACE_MISMATCH`，PD-15）。**因此本报告任何地方都不说“网络被 OS 拒绝”。**

---

## 0. 冻结身份表

| 字段 | 值 |
| --- | --- |
| Product SHA（本 worktree HEAD） | `235e1af8bab954bbca4852d2f5a538de043b66e8`（`235e1af8b`） |
| 分支 / worktree | `recon/d-web-20261113` / `.worktrees/recon-d-web` |
| Host SHA（只读 pinned upstream） | `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2） |
| Host 树 | `tests/deepseek-harness-test-use`（porcelain 空；本车道只读，从未写入） |
| Authority | 指针 `dev/engineering/current-authority.json` → snapshot `as20261105r2`，`content_digest=sha256:d28bdf46c8c7…`，`baseline=1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`，指针文件 `sha256=31ac81fb4c4818b4…` |
| World / DSH_HOME | `a5sfreconweb` / `tests/homes/u5a5sfreconweb-<stamp>`（工作区内；每次 boot 一个，teardown 后删除） |
| Grant | `dev-live-grant.json`：`scope=DEV-LIVE`、`face=Web`、`world=a5sfreconweb` |
| Record | `recordClass=DEV-LIVE`、`eligible=false`、`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`；`V@B` 未动 |
| 端口 | Host `3185`（WorldFactory 租约）、mock `34xx`、受控端点 `127.0.0.1:<ephemeral>`；`:3080` 从未接触 |
| 控制器 | `run-boot.mjs`（`--plan` 零 boot；`--evidence <dir>` 恰好 1 次 Host start） |
| 受控端点 | `recon-web-offer-row.mjs` 内建 in-process 传输 → `127.0.0.1:<ephemeral>`；**无任何真实外部 egress** |

**证据目录**：`run-10/`、`run-11/` = 达成一致的一对（agreement pair，见 §7）；`run-01…run-09` = 仪器迭代（各自的 `verdict.json` 保留，失败原因见 §9 D-3）；host-free arms = `arms-hostfree.json`（A1…A11）。

---

## 1. 方法与边界（先声明再测量）

* **受控本地端点**：每次 boot 启一个 `127.0.0.1:0` 的 HTTP server，`/page` 返回 `A5SF_RECON_WEB_ALLOW_BYTES`、`/search` 返回 `A5SF_RECON_WEB_SEARCH_BYTES`，记录它**自己**收到的每个请求（server-side observation）。除 loopback 外没有任何网络副作用。
* **TEST COMPOSITION（必须披露）**：allow 车道与 deny 车道的两个 Member 由 `recon-web-offer-row.mjs` 这个**测试行**提供 realm（`teamA5sfRealm.compiledFor()`），车道由**同一个**编译器 `compileEffectiveIo` 编译。产品路径**无法**装配 `network=deny` 的蓝图（§9 E-1），所以 deny 车道在今天的仓库里**只有组合可达**。这不是产品能力，是测量装置。
* **面本身是产品代码**：confined web face、guard 顺序、capability probe、`NETWORK_PROOF_FACE_MISMATCH` 全部来自 `packages/runtime/dist` 的**已构建产品模块**（`team-services/src/web.js`、`member-io-policy`、`sandbox-provider/network.js`），测试行只提供 lane 与 transport。
* **OS 隔离不是本面**：本报告的“拒绝”一律指 `NETWORK_UNCONFINED_REALM` 这种**服务级准入拒绝**。证明 OS 层隔离需要 subprocess 面的 netns 证据（BL-42），`evaluateNetworkRequirement` 对跨面证明直接回 `NETWORK_PROOF_FACE_MISMATCH`（`packages/runtime/sandbox-provider/network.ts:102,165-179`），所以 BL-42 的证据**不能**搬到 Web 面（PD-15）。

---

## 2. 七项 × 两工具

下表每一格都对应 `run-10/item-web-{allow,deny}.json` 与 `run-10/`…`run-11/` 的产物；括号内是观测通道（C1…C6，见 §3）。

| 项 | `web_fetch` | `web_search` |
| --- | --- | --- |
| **Surface**（面） | 出现在 Member 的 model request `tools` 中；Leader 面（22 名）**没有**这两个名字 → 面是 route-C 在 realm scope 上重挂的，不是 Leader 面的继承（C1） | 同左；Member 面 24 名 = Leader 22 + `web_fetch` + `web_search`（C1） |
| **Dispatch**（派发） | 模型发 1 个 tool call → 产品 `ctx.web.fetch({url})` → confined face `fetch()`（`web.ts:283`）→ guard → provider（C1→C2→C3→C4） | 模型发 1 个 tool call（`queries:[…]`）→ 钉死工具对**每个** query 调一次 `ctx.web.search({query,maxResults})`（`tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js:189-211`）→ face `search()`（`web.ts:296,299`）→ guard → provider |
| **Provider**（提供者） | 本次 boot 的**组合行 transport**（in-process，无子进程、无 DNS）；继承的 host web service 被只读包成 tripwire，`host-web-call` 计数 **0** | 同左；`requestKeys=["maxResults","query"]`、`hasQueriesArray=false` 证明到达 provider 的是钉死工具的**内部形状**，不是模型的 `queries` |
| **Allow** | 1 条 fact：`method=web:fetch`、`decision=allow`、`decidedBy=ALLOW`、`locator=http://127.0.0.1:<ep>/page?lane=allow`；provider entry 1 条；端点 1 个请求；模型拿到 `Fetched … (HTTP 200)` + `A5SF_RECON_WEB_ALLOW_BYTES` | 1 条 fact：`method=web:search`、`allow`、`ALLOW`、`locator=<search:malformed-request>`（PD-10，见 §9 B-1）；provider entry 1 条；端点 1 个请求；模型拿到 `Sources: - [A5SF recon local endpoint](…/search) — A5SF_RECON_WEB_SEARCH_BYTES` |
| **Deny（层）** | **准入层（face 内、provider 之前）**：probe=`unsupported` → `NETWORK_UNCONFINED_REALM`（`web.ts:185-217`）；fact 1 条 `deny/NETWORK_UNCONFINED_REALM`；provider entry 0；端点 0 请求；模型拿到 refusal 句（不含类型码，见 B-3） | 同层；两个 query → **2** 条 deny fact（1 个 tool call、2 次 provider 求值）；entry 0；端点 0 |
| **Evidence**（证据面/定位器/方法） | face=`web`；locator=声明 URL（不解析、不取 header）；method=`web:fetch`；证据=guard fact + provider entry + 端点日志 + 模型可见文本，四路独立 | face=`web`；locator 对**所有** search 都是 `<search:malformed-request>`（PD-10 未修）；method=`web:search`；其余同上 |
| **Lifecycle**（realm 失效后） | 归档后 `team_follow_up` 被产品拒绝：`status=blocked, reason=target-stale`（HTTP 200 信封 `ok:true`，判定在 `value.status`）；端点随后 **0** 请求 → **模型可达路径关闭**。**未测**：被保留的 in-process face 对象引用是否仍可 fetch（本轮不声称） | 同左 |

---

## 3. 六类观测通道（每条结论的可复核来源）

| 通道 | 观测物 | 落盘文件 | 本轮读数（run-10 / run-11） |
| --- | --- | --- | --- |
| **C1 surface** | mock 记录的 model request `tools` | `surface.json`、`item-web-*.json#surface` | Leader 22（无 web）；Member 24（含 `web_fetch`,`web_search`） |
| **C2 guard fact** | 产品 sink `a5sf-consult.jsonl` | `guard-facts.json`、`item-web-*#guardFacts` | allow 2 条 allow；deny 3 条 deny（fetch 1 + search 2） |
| **C3 provider entry** | 组合 transport 的入口计数 | `counter-rows.json`、`item-web-*#providerEntries` | allow 2（`fetch` 1、`search` 1）；deny 0 |
| **C4 endpoint request** | 受控端点**自己**的请求日志 | `endpoint-observations.json`、`item-web-*#endpoint` | allow 2（`/page?lane=allow`、`/search`）；deny 0（全生命周期总计 2，全部属于 allow 车道） |
| **C5 model-facing result** | Member turn 里工具返回给模型的文本 | `item-web-*#model.toolResults`、`mock-requests.json` | allow：2 条成功文本含真实字节；deny：2 条 error 文本含 refusal 句 |
| **C6 lifecycle state** | `/__p6t6/state` 的 Member `lifecycle` | `state.json`、`state-final.json`、`lifecycle.json` | 归档前 `SETTLED` → 归档后 `ARCHIVED`；follow-up `blocked/target-stale` |

> C3/C4 是**互相独立**的：C3 数的是我们自己的代码进入点，C4 是**另一个进程**（端点）数到的连接。deny 车道两者都为 0，才排除了“其实连了但没记账”。

### 3.1 端点侧观测（server-side，逐窗口）

| 窗口 | 端点请求数 | 路径 | 归属 |
| --- | --- | --- | --- |
| discovery（Leader 面探测） | 0 | — | 无 web 调用（Leader 面不含 web 对） |
| allow Member turn | **2** | `GET /page?lane=allow`、`GET /search` | 与 allow 的 2 条 provider entry、2 条 fact 一一对应 |
| deny Member turn | **0** | — | 与 deny 的 0 条 provider entry 一致；3 次 capability probe **不产生连接** |
| 归档后 follow-up | **0** | — | 产品在签名前就拒绝（`target-stale`） |
| 全 run 总计 | **2** | — | 全部属于 allow 车道；无外部地址 |

---

## 4. 逐条证据（可复制的原文）

### 4.1 allow 车道（`run-10/item-web-allow.json`，PROVEN）

```text
fact  web:fetch  allow  ALLOW  locator=http://127.0.0.1:46379/page?lane=allow  revision=a5sf-recon-web:inst-1msngdn0q2ln:g1  seq=1
fact  web:search allow  ALLOW  locator=<search:malformed-request>             revision=a5sf-recon-web:inst-1msngdn0q2ln:g1  seq=2
entry {channel:"fetch",  url:"http://127.0.0.1:46379/page?lane=allow"}
entry {channel:"search", requestKeys:["maxResults","query"], hasQueriesArray:false}
tool  "Fetched http://127.0.0.1:46379/page?lane=allow (HTTP 200)\n\n…\n\nA5SF_RECON_WEB_ALLOW_BYTES"
tool  "…Sources:\n- [A5SF recon local endpoint](http://127.0.0.1:46379/search) — A5SF_RECON_WEB_SEARCH_BYTES…"
```

### 4.2 deny 车道（`run-10/item-web-deny.json`，PROVEN）

```text
fact  web:fetch  deny  NETWORK_UNCONFINED_REALM  locator=http://127.0.0.1:46379/page?lane=deny   revision=…:inst-1fq2hno0l8w8:g1 seq=1
fact  web:search deny  NETWORK_UNCONFINED_REALM  locator=<search:malformed-request>              revision=…:inst-1fq2hno0l8w8:g1 seq=2
fact  web:search deny  NETWORK_UNCONFINED_REALM  locator=<search:malformed-request>              revision=…:inst-1fq2hno0l8w8:g1 seq=3
probe level=unsupported ×3（guard 问后端的能力问题；不进入 fetch/search/transport/dns/connect 任何通道）
entry 0 条；endpoint 0 个请求
tool  "Error: the effective lane requests network=deny, but the web provider's capability probe reports
       network-destination='unsupported' (…); refusing before any provider call instead of fetching under a
       deny claim this host cannot enforce. A backend that proves 'enforced' is the only configuration that
       admits this call"
```

`capability probe` 的 `unsupported` 是**诚实的宿主现状**：本组合的 provider 没有“已强制执行”的网络能力证明，因此 deny 车道必然拒绝；这不是配置失误。

### 4.3 编译车道（`counter-rows.json#compiledLanes`）

```text
{"leg":"compiled-lane","realm":"member:inst-1msngdn0q2ln","templateId":"weballow","networkAccess":"allow","policyRevision":"a5sf-recon-web:inst-1msngdn0q2ln:g1"}
{"leg":"compiled-lane","realm":"member:inst-1fq2hno0l8w8","templateId":"webdeny","networkAccess":"deny","policyRevision":"a5sf-recon-web:inst-1fq2hno0l8w8:g1"}
```

两条车道由 `compileEffectiveIo`（`packages/runtime/member-io-policy/src/index.ts` 公开面）编译，generation=`g1`。**没有产品 authority revision**：组合车道不消费 `a5sfMemberPolicies` 的产品授权（授权指针只用于 run-record 绑定，见 §0）。

---

## 5. host-free arms（`arms-hostfree.json`，A1…A11）

| arm | 车道/证明 | 观测 | 含义 |
| --- | --- | --- | --- |
| A1 | allow + fetch | fact 1 allow、entry 1、端点 1、返回字节 | allow = 普通 in-process egress |
| A2a | allow + search `{queries:[…]}` | locator `queries:1`、允许 | `declaredUrlOf` 的 `queries` 分支存在 |
| A2b | allow + search `{query,maxResults}` | locator `<search:malformed-request>`、允许 | **PD-10 在 face 层复现**（钉死工具的实际形状） |
| A3 | deny + probe unsupported | `NETWORK_UNCONFINED_REALM`、entry 0、端点 0 | 准入拒绝（与 live 一致） |
| A4 | deny + enforced + proof `face:'subprocess'` | `NETWORK_PROOF_FACE_MISMATCH`、entry 0、端点 0 | **PD-15**：BL-42 证明不能用于 Web 面 |
| A5 | deny + enforced + proof `face:'web'`（负对照） | **admitted**，fact `allow/ALLOW`，真实 loopback 连接，端点 1 | 有“web 面 enforced 证明”时 deny 车道**直接放行** → 今天的 deny 只是“别开 web”，不是“限制 web” |
| A6 | allow + provider 无 `search` | `IO_POLICY_UNSUPPORTED`，**0 条 guard fact** | 能力缺失在 guard **之前**拒绝 |
| A7 | allow + transport 抛错 | 1 条 allow fact，错误原样透传（`ECONNRESET`） | allow 车道的错误传播不包装 |
| A8 | allow + provider 跟随重定向 | **1 条 fact、2 个 wire 请求** | face 不中介重定向：locator 只描述第一次声明 |
| A9 | deny + enforced 无 proof | `NETWORK_UNCONFINED_REALM`、端点 0 | 无证明不放行 |
| A10 | deny + web proof 但 probe unsupported | `NETWORK_UNCONFINED_REALM`、端点 0 | probe 与 proof 分开判定 |
| A11 | **装配层**：v4 蓝图 `memberIoCeilings.network={mode:'deny'}` | `deriveProductRealmPlanFromBlueprint` → `NETWORK_UNCONFINED_REALM`；`parseProductRealmDeclaration` → 同码 | deny 在**装配层**就被产品拒绝，早于任何 realm / Member turn / guard fact / provider |

---

## 6. 关于 “deny 究竟在哪一层”

| 层 | 是否发生 | 证据 | 拒绝码 |
| --- | --- | --- | --- |
| **装配层**（产品蓝图/声明） | **会**：`network.mode!=='allow'` 被产品装配直接拒 | A11；`packages/runtime/team-services/src/product-assembly.ts:602,955`（入口 `874,1083,1138`） | `NETWORK_UNCONFINED_REALM` |
| **挂载层**（native web 模块 + 无 confined face） | **会** | `packages/runtime/team-services/src/mount.ts:1486,1666`（`A5SF_NETWORK_UNCONFINED_REALM`） | 同上 |
| **准入层**（face 内 guard，provider 之前） | **会**（本轮 live 测得） | `packages/runtime/team-services/src/web.ts:185-217`；run-10/11 | `NETWORK_UNCONFINED_REALM` |
| **provider 内部** | deny 车道**从未到达**；allow 车道到达并做普通 loopback I/O | `item-web-allow#providerEntries`、`endpoint-observations.json` | — |
| **OS / netns** | **从未被要求**。本面没有、也不该有 OS 层拒绝的证据 | A4（跨面证明被拒）、A5（web 面证明被放行） | `NETWORK_PROOF_FACE_MISMATCH`（PD-15） |

一句话：**今天的 `network=deny` 在 Web 面是“不装配 / 不挂载 / 不准入”，而不是“限制已存在的网络能力”。** 三者都在我们自己的代码里，OS 没参与。

---

## 7. 达成一致的一对 boot

| 项 | `run-10` | `run-11` |
| --- | --- | --- |
| overall | PASS（4/4） | PASS（4/4） |
| allow / deny item verdict | PROVEN / PROVEN | PROVEN / PROVEN |
| allow facts | `web:fetch allow ALLOW`、`web:search allow ALLOW` | 同 |
| deny facts | `web:fetch deny NETWORK_UNCONFINED_REALM`、`web:search deny NETWORK_UNCONFINED_REALM` ×2 | 同 |
| provider entries (allow/deny) | 2 / 0 | 2 / 0 |
| endpoint requests (allow/deny) | 2 / 0 | 2 / 0 |
| capability probes (deny) | 3 | 3 |
| host-web tripwire | 0 | 0 |
| lifecycle | `ARCHIVED` → follow-up `blocked/target-stale`，端点 0 | 同 |
| 端口 / 端点 | `3185` / `:46379` | `3185` / 另一 ephemeral |

`run-09` 是第三个完全相同的 boot（同一仪器、同一读数）；`run-01…run-08` 是仪器迭代，保留以便复核（§9 D-3）。
**注意**：Member 的 `instanceId` / `childSessionId` 在多次运行间**相同**（`inst-1msngdn0q2ln`…）：它们由 team root + 模板 + label 确定性派生，不是跨 run nonce；区分 run 的是 `at` 时间戳、端点端口与 run 目录。

---

## 8. 生命周期

1. allow Member `SETTLED` → `team_archive_member` → `state.members[].lifecycle=ARCHIVED`（`archive.effect.from=SETTLED,to=ARCHIVED,sequence=13`）。
2. 随后 `team_follow_up`（带 `targetInstanceId`）→ 产品拒绝：HTTP 200 信封 `ok:true`，但 `value.status="blocked"`、`value.reason="target-stale"`；端点请求 **0**。
3. 因此**模型可达路径**在归档后关闭。**未测量**：被保留的 in-process face 对象引用（例如组合行仍持有 `compiledFor()` 的返回值）在 realm 失效后是否仍能 fetch——本轮不声称任何一侧。`item-web-*/lifecycle.json` 里已显式写明这一点。

---

## 9. 问题分类（A / B / C / D / E）

### A 类 —— 机制按设计工作，无需改动

| # | 结论 | 代码位置 |
| --- | --- | --- |
| A-1 | allow 车道：guard 先求值、fact 落盘、provider 进入、真实字节返回 | `packages/runtime/team-services/src/web.ts:203,283,296` |
| A-2 | deny 车道：probe → 无证明 → 准入前拒绝（typed） | `packages/runtime/team-services/src/web.ts:185-217` |
| A-3 | 跨面证明被 typed 拒绝（PD-15） | `packages/runtime/sandbox-provider/network.ts:102,165-179` |
| A-4 | native web 模块而无 confined face → 挂载期拒绝 | `packages/runtime/team-services/src/mount.ts:1486,1666` |
| A-5 | Member 的 web 面来自 realm scope 重挂（继承的 host web service 0 次调用） | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:711`；`packages/runtime/src/plugin/host.ts:2393` |

### B 类 —— 工具面 / 契约缺口（影响归因精度，不改变本轮裁决）

| # | 结论 | 代码位置 |
| --- | --- | --- |
| B-1 | **PD-10 仍在**：`web_search` 的 fact locator 恒为 `<search:malformed-request>`，因为钉死工具传 `{query,maxResults}` 而 `declaredUrlOf` 只认 `url`/`queries[]`。结合 A2b：**live 与 host-free 双向确认**。后果：search 的 fact 无法回答“查了什么、去了哪个 URL” | 工具：`tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js:190,200`；face：`packages/runtime/team-services/src/web.ts:313-326` |
| B-2 | **1 个 tool call ≠ 1 条 fact**：`queries` 有 N 项时钉死工具并发发 N 次 `ctx.web.search`（`runSearchQueries`），每次都是一次 guard 求值。deny 车道因此 1 个调用 2 条 fact（A2b/A4 的 2 query 用例同源）。未来的 grader 若按“调用数 = fact 数”断言会误判 | `tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js:189-211` |
| B-3 | deny 的**模型可见错误文本不含类型码**（只有 refusal 句）；`NETWORK_UNCONFINED_REALM` 只在 sink fact 的 `decidedBy` 上。归因必须读 fact，不能只读 tool result | `packages/runtime/team-services/src/web.ts:185-217`（错误构造处），`item-web-deny.json#model.toolResults` |
| B-4 | fact 里**没有** `callId`/`invocationId` 字段：只能靠 `memberIdentity` + `sequence` 串联，无法与模型侧 tool_call id 直接对齐 | `packages/runtime/team-services/src/web.ts` 的 fact 形状（`a5sf-guard-consult/1`） |

### C 类 —— 判定仪器缺口（本轮无法用现成仪器出 PASS）

| # | 结论 | 代码位置 |
| --- | --- | --- |
| C-1 | 共享 preflight **无法**给 ALLOW web 用例出 PASS：`network=restricted` 的 allow 期望被判 `POLICY_EXPECTATION_CONTRADICTS_LANE`，且 network 轴无条件追加 `POLICY_NETWORK_PROBE_NOT_ENFORCED`。本轮如实记录 4 条，gate 只容忍“点名 allow 用例的这两码”，其余任何 finding 一律 block | `tests/world-factory/lib/a5sf-acceptance-preflight.mjs:1537-1538`；证据根目录的 `preflight-bundle.json`、`preflight.log`、`plan-preflight.json` |
| C-2 | `CASE_LOCATOR_ALIASED` 迫使两条车道声明不同 locator → 我让 **deny 车道用 2 个 query** 来区分。这是**仪器要求的产物**，不是产品语义；已在此披露 | `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`（locator 唯一性检查） |
| C-3 | 仪器只认 `connection-denial | admission-refusal` 两类；没有“admitted egress”这一类，所以 allow 车道永远在词汇之外 | 同上（closed case classes） |

### D 类 —— 基础设施缺陷（会挡住别人的 boot，不只是本轮）

| # | 结论 | 代码位置 |
| --- | --- | --- |
| D-1 | 本 SHA 的 dev Host 并发上限常量仍是 **2**，与 2026-11-13 owner 裁决（机器级 2→6）不一致；达到上限时错误文本仍说“owner ruling caps development boots at 2” | `tests/world-factory/lib/dev-live-slots.mjs:42`（`DEV_LIVE_SLOT_LIMIT = 2`）、`:207,237` |
| D-2 | **陈旧 slot 会永久占位**：slot 文件记录的是 boot 子进程的 `pid`，在 PID namespace 里读到的可能是 `3`；兄弟车道跑完后 `kill(3,0)` 已 `ESRCH`，但两个 slot 文件仍在，于是 `DEV_LIVE_LIMIT_REACHED`（本轮 `run-03` 因此在 `boot-host` abort）。建议：记录 boot 自身的 host-visible pid，或把 `ESRCH` 视作可回收 + TTL | `tests/world-factory/lib/dev-live-slots.mjs:206-207`；`run-03/boot.log`、`run-03/verdict.json` |
| D-3 | 本轮仪器自身的历史缺陷（`boot.log`/`verdict.json`/`marker-routing.jsonl` 全部保留；为控制仓库体积，`run-01…08` 的 416K `mock-requests.json` 已删除，`run-09…11` 保持完整）：`run-01` mock 以 wrapper 当 body → 全 turn 落 `fallback`，0 fact；`run-02/04/05` 工具结果重复计数与 refusal 文本断言错误；`run-07/08` Member turn 过滤用“最后一条 user 消息”（dsh 把 tool result 也建模为 user 消息）→ 0 请求；`run-03` slot 容量；`run-06` 只差拒绝文本检查。修复点均在 `run-boot.mjs`/`recon-marker-mock.mjs` 注释里指名 | `run-01…run-09/` |

### E 类 —— 产品语义边界（需要裁决，不是“修 bug”）

| # | 结论 | 代码位置 |
| --- | --- | --- |
| E-1 | **产品蓝图无法表达“deny 的 web”**：`memberIoCeilings.network.mode!=='allow'` 在装配期被拒，因此 Member 根本不会被创建。deny 车道今天**只能由组合提供**（本报告已披露为 TEST COMPOSITION） | `packages/runtime/team-services/src/product-assembly.ts:602,955`；入口 `874,1083,1138` |
| E-2 | **没有一种配置真的“限制”了网络**：有 web 面 `enforced` 证明时 deny 车道**被放行**（A5，负对照，真实 loopback 连接）；没证明时整个能力被拒（A3/A9/A10）。二者都不是“限制已授予的网络” | A5/A3/A9/A10；`packages/runtime/team-services/src/web.ts:185-217` |
| E-3 | **face 不中介重定向**：1 条 fact 对应 2 个 wire 请求（A8）。locator 只描述模型声明的第一个 URL，“最终落到哪个地址”不在证据里 | `packages/runtime/team-services/src/web.ts:283`（`provider.fetch(request)` 直传） |
| E-4 | 归档后的拒绝**没有 typed code**：`team_follow_up` 返回 `ok:true` + `value.status="blocked"` + `reason="target-stale"`。只查 HTTP/`ok` 的判定器会把“关闭”读成“可达” | `lifecycle.json`（run-10/11）；产品侧 tool 信封语义 |

---

## 10. 未测量 / 开放项

1. **保留的 in-process face 引用**在 realm 失效后是否仍能 fetch —— 未测，不声称。
2. **装配层拒绝的 live 传播**（`team.create` 在 v4 deny 蓝图上失败、没有 Member turn / 没有 guard fact）—— 只在 host-free 用两个产品入口测量（A11：`deriveProductRealmPlanFromBlueprint` / `parseProductRealmDeclaration` 均抛 `NETWORK_UNCONFINED_REALM`）。live 侧的同构实验属于 governed-preset 车道，本轮未跑；因此“装配拒绝 → 无 Member turn”是**由抛出点推出的必然**，不是本轮观测。
3. **真实外部网络**：本轮刻意只用 loopback，没有对任何公网地址取证。
4. **多 Member 并发**、**跨生成（g2+）** 的车道重建：未测。
5. **`web_search` 的 `queries` 上限语义**（`maxQueries`）与 deny 车道 fact 数的关系：只测到 N=1/N=2。

---

## 11. 复现

```bash
cd .worktrees/recon-d-web

# 1) 零 boot：组装 + 跑共享 preflight（如实记录它的 FAIL 与 4 条 allow-vocabulary finding）
node dev/agent-workflow/evidence/a5sf-recon-web/run-boot.mjs --plan

# 2) host-free arms（A1…A11；本地端点自行起停，不占 boot 配额）
node dev/agent-workflow/evidence/a5sf-recon-web/arms-hostfree.mjs

# 3) 一次 boot（恰好 1 次 Host start；每 run 一个目录，run-ledger 必须新鲜）
node dev/agent-workflow/evidence/a5sf-recon-web/run-boot.mjs \
  --evidence dev/agent-workflow/evidence/a5sf-recon-web/run-12
```

* boot 前置：`dev-live-grant.json` 的 `scope/face/world`、HEAD=`235e1af8b`、authority 指针未移动、preflight 只剩被容忍的 allow-vocabulary findings、`run-ledger.jsonl` 为空。
* boot 纪律：`dev-live-slots.mjs` 租约（每 boot 一个）、`3180` 族端口、`:3080` 不碰、`DSH_HOME` 在 `tests/homes/`、pinned host 只读、teardown 后端口关闭且 home 删除（`teardown.json` 逐项记录）。
* 产物：`health.json`、`surface.json`、`main-blueprint.json`、`create-team.json`、`state*.json`、`item-web-{allow,deny}.json`、`guard-facts.json`、`counter-rows.json`、`endpoint-observations.json`、`marker-routing.json`、`mock-requests.json`、`lifecycle.json`、`teardown.json`、`run-record.json`、`verdict.json`、`ledger.json`。

---

## 12. 给父 Agent 的三句（同文末报告）

1. `web_fetch` / `web_search` 在**受治理 Member 上可达**：Member 的 model request 带这两个名字，两条调用都真的打通到受控端点并返回字节。
2. **guard 真的被求值**：每次调用产生 1 条 `a5sf-guard-consult/1` fact（allow 2 条 / deny 3 条），落盘在产品的 consult sink 里，带 Member 身份、method、locator、policyRevision。
3. **deny 在“服务级准入”被拒，不是 OS**：`NETWORK_UNCONFINED_REALM` 在 confined web face 内、provider 之前抛出（端点 0 请求、provider entry 0、probe `unsupported`）；有 web 面 `enforced` 证明时反而**放行**（A5），跨面的 BL-42 证明被 `NETWORK_PROOF_FACE_MISMATCH` 拒绝（PD-15）。**这不是 OS 网络隔离。**
