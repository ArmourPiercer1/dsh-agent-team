# WEB-NATIVE-POC — web_search / web_fetch 原生复用 PoC 判据表（A5W）

- 记录时间（真实 UTC）：**2026-10-31T05:07Z**（写入时刻 `date -u`；测试运行时刻见 §0 运行日志）
- 会话：workflow A 产品原型 PoC 子代理（Native Reuse First 裁决下的 web 双工具可达性验证）
- 基线：Team 仓 @ `f995ce7814`（branch `task/a5w-wspoc-20261031`）；宿主 = pristine `tests/deepseek-harness-test-use` @ `639ed01539`（0.2.0-rc.2 发布点）；npm `@deepseek-ai/dsh-*@0.2.0-rc.2` + cordis 4.0.4 与 pristine pin 同一发布点
- 纪律履行：**零真实 Host boot**（真实 cordis Context 进程内组装，未启动任何 dsh 实例；:3080、真实 ~/.dsh、其它 worktree 未触碰）；**中心代码零改动**（生产 center code 一行未动；需要中心改动的发现全部登记 §7 接口缺口）；mock 端口全部取自 `portsOfBands(MOCK_PORT_BANDS)`，租还式；host 树只读
- ⚠ **本目录全部产物为路线裁决 PoC 证据，不入生产验收判据**（矩阵行状态不因本目录自动改变；每格评级严格区分"接口存在 / 安全可接入 / 等价实现 / 产品验收通过"，UNKNOWN 与 MOCK-PASS 一律不给 GO）

## 0. 证据文件与复现

| 文件 | 内容 |
| --- | --- |
| [poc-w1-native-shape.test.ts](../../../tests/poc-web-native-reuse/poc-w1-native-shape.test.ts) | P-W1 八臂（N-0…N-7）：原生 web 工具定义（pristine tool-web 真件）注册进真实 ToolRuntime，经真实封闭世界 Guard（`packages/runtime/tool-dispatch`）在治理成员面执行 |
| [poc-w2-ctx-web-adapter.test.ts](../../../tests/poc-web-native-reuse/poc-w2-ctx-web-adapter.test.ts) | P-W2 十七臂：S-1…S-6 ctx.web 选择法则（真实 WebRuntime）；A-1…A-5 Team 受治行经薄适配走 ctx.web（PA 链见证）；D-0…D-5 真实 DeepSeekSearchProvider 打 MOCK 段假 Messages 端点（真线形状） |
| [poc-w3-fetch-parity.test.ts](../../../tests/poc-web-native-reuse/poc-w3-fetch-parity.test.ts) | P-W3 二十二臂：H-0…H-11 原生 HttpFetchProvider 行为与目的地法则；T-1…T-8 Team 受治 row/transport 同臂对照；X-1/X-2 线上头观察 |
| [poc-run-log.txt](poc-run-log.txt) | 全绿运行日志（47 passed / 0 failed） |

复现（工作树内，无需安装——裸导入经上溯命中主仓 node_modules；cordis/dsh-* 经 `vitest.poc.config.ts` 的 alias 固定到主仓 `packages/runtime` 同一安装面）：

```bash
cd /home/armourpiercer/projects/dsh-agent-team/.worktrees/a5w-wspoc
../../node_modules/.bin/vitest run --config tests/poc-web-native-reuse/vitest.poc.config.ts
```

## 1. P-W1 —「原生工具直接治理」实测结论

**核心实测事实（N-1）：把原生 web_search/web_fetch 留在全局面、让受治成员继承，Guard 判定为 verified-native 后直接放行原生函数体——该调用不经过任何 Team lane：无 PA、无 permission gate、无 effect 声明、无审计。** 这不是缺陷而是封闭世界 Guard 的既定语义（guard 只保证"不脱离治理面"，verified native 的"治理"由宿主自身承担），但对 Team per-destination / PA 需求而言，"继承放行"= 治理旁路。

| 臂 | 形状 | 实测结果 |
| --- | --- | --- |
| N-0 | 根面基线 | pristine tool-web 真定义 + 真实 ctx.web seam：web_search 正常执行，provider 计数器见证 |
| N-1 | 全局面非空、webEnabled 缺省 | 成员继承 web_search/web_fetch 为 **verified-native**，`guard-denial` 零条，**原生体运行**（搜索命中 1）——直接治理 = 无 lane 直通 |
| N-2 | 受信原生清单为空（fail-closed 收割形状） | 每个继承名 `TOOL_BINDING_UNVERIFIED` 拒绝，**provider 零命中** |
| N-3 | publish 后同名 scoped 恶意注册 | 恶意体 0 运行、provider 0 命中——Binding 指纹在派发时复测，报 definition-drift 拒绝 |
| N-4 | 全局同名重复注册 | 注册表当场 throw（`already registered`）——同名抢占全局不可行 |
| N-5 | publish 后 scoped 晚注册新名 | `TEAM_TOOL_UNGOVERNED` 拒绝，恶意体 0 运行 |
| N-6 | 原生注册被 dispose 后派发 | `definition-unreadable` 拒绝（不坠落原生 fallback），provider 0 命中 |
| N-7 | plane takeover（webEnabled true）+ 空原生清单 | takeover 行遮蔽原生名；行经 placement feed **verified 绑定（无需全局面）**；default-deny 下 `WEB_SEARCH_NO_PROVIDER` 拒绝且**原生 seam 零命中**（原生体被自家名字遮蔽不可达）；webEnabled 缺省时 plane 不挂任何 web 行 |

**webEnabled=false 不隐藏原生**（`web.mjs disabledOwned:()=>[]` 零翻转法则，源码钉死）：关闭 Team web 行只让 plane 不挂行，全局原生照常被继承。第二道闸是静态 setup coverage：`web_fetch/web_search ∈ KNOWN_SENSITIVE_TOOL_NAMES`，strict surface 下未 `builtinToolDeny` 即 FATAL——**"直接治理"路线的收敛手段全部是静态配置排除（禁用/不可见），不是运行期治理**。

**结论：路线 A（原生直接治理）不满足 Team 的运行期 IO 治理要求（R1/R2/R3/R8）。它可用且防护真实（R7 定义保护是已验收机制，N-3…N-6 复测通过），但"防护"是防劫持，不是管出口。**

## 2. P-W2 — Host Service Adapter 路线实测结论

适配原型 = **全部**以下内容：调 `webRuntime.search()` + 把 `WebError.code` 映射成 Team provider-port 形状（`{ok:false,code,detail}` / `WEB_ABORTED`→`{ok:false,cancelled:true}`）+ 把逐 query 结果合并成行的模型可见面。**零新搜索客户端、零凭据接触、零 provider 选择逻辑拷贝**——选择法则完整留在宿主：

| 法则（S 系列，真实 WebRuntime 实测） | 码 |
| --- | --- |
| 0 个可用 provider | `WEB_PROVIDER_UNAVAILABLE` |
| 配置 id 不存在 / 不可用 | `WEB_PROVIDER_CONFIGURED_MISSING` / `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` |
| 多可用未配置（选择与注册顺序无关） | `WEB_PROVIDER_AMBIGUOUS` |
| 重复注册同 id | `WEB_DUPLICATE_PROVIDER` |
| seam 侧 sources 截断 | `maxResults` 截断 + `truncated:true` |

PA 链见证（A 系列）：**批准腿的审批指纹恰为 [tool-invoke(web_search), connect@声明 origin]**（指纹复算相等）；拒批腿与无 provider 腿 `seamCalls=[]` 且宿主 provider 零命中；预取消返回行级 `cancelled:true`；声明目的地为字面非公网主机时**挂载当场拒绝**（`PLANE_WEB_PROVIDER_REFUSED`）。即：**调用授权（①层）确实由 Team 行强制，且在 seam 之前**。

真实 DeepSeek 原生线形状（D 系列，打本地假 Messages 端点）：搜索 = 模型调用 `POST {baseURL}/messages`，`tools[0].type='web_search_20250305'`、`max_uses` 透传；**凭据只走请求头（x-api-key + authorization），请求体与 recordRequest 零泄漏**；无凭据时 `available()=false`（不被选中）且直调 `WEB_PROVIDER_CREDENTIAL_MISSING` 零外呼；`redirect:'error'`（302→类型化错误，重定向目标零触达）；mid-flight abort→`WEB_ABORTED`；结果映射 sources 取 `web_search_tool_result` + citation 片段（模型正文被忽略）。

**已实测的路线边界（不是缺陷，是必须写进裁决的语义差）：**
1. **多查询扇出**：Team 行把 `queries` 当一批交给 provider port；宿主 seam 是 per-query。适配器必须逐 query 扇出（N queries = N 次宿主调用，宿主 tool-web 层同样如此）——成本/限流语义要在行侧声明。
2. **错误码精度**：行的失败码统一 `WEB_SEARCH_FAILED`，宿主原生码（如 `WEB_PROVIDER_AMBIGUOUS`）只活在 detail 里——生产化需 executor 加透传表（§7-3）。
3. **上限差异**：行 maxItems=8 vs 原生 tool-web maxQueries=4 / maxResults=8——同一 Provider 两种调用形状，产品面需择一并披露。
4. **per-destination**：行的 connect 声明取 `provider.destination()`（配置固定 origin）。**声明==请求在准入时刻成立；执行时刻 socket 目的地由宿主 Provider 自治**，Team 无法对其做 per-call 目的地裁决（search 类端点固定，实际收窄；fetch 类逐 URL 则完全失效——见 §3）。

## 3. P-W3 — 三层保证区分 + web_fetch transport 逐项实测

**三层定义（本 PoC 执行口径）：①调用准入 = Team 在派发前强制的授权/声明（PA、gate、指纹）；②Provider 自身保证 = 宿主 Provider/Team transport 代码内自证的传输法则；③Provider 内部网络活动 = 两者都无法向对方验证的网络行为（上游后端、代理、DNS 基础设施、OS 网络栈）。非目的地绑定的传输保证一律记 ②，不得与 ① 的 per-destination 强制混记同级。**

web_fetch transport 逐项对照（H=原生 HttpFetchProvider 实测，T=Team 受治 row/transport 实测）：

| 项 | 原生 ②层保证（H 臂） | Team ①+②层（T 臂） | 评级注记 |
| --- | --- | --- | --- |
| DNS 非公网拒连 | **真法则**：回环/私网/链路本地/CGNAT/IPv6 本地/IPv4-mapped/NAT64 全拒（10 个字面目的地 + localhost 真解析），**socket 前拒绝、stub 零触达**（H-11） | transport 同源法则（resolve-once/check-all/pin），loopback 例外仅在 trusted mount opt（T-1 正向即走此 opt） | 原生此处**更严**（loopback 无豁免）；两者都是 ② 层自证 |
| 地址绑定（防 DNS rebinding） | pin 已验证地址集（源码级） | pinned lookup 为唯一可见 DNS 答案（U7 链已验，本轮 T-6/T-7 复跑通路） | 同级 ② |
| 代理 | 支持：proxied hop **跳过本地解析与 pin**（目的地法则委托代理 = ③层；`network.ts` 源码级，真机 env 腿 ENV 待测） | **无代理**（grep 空；直连+自解析+pin） | 原生接代理即出现 ③ 层不可验证活动，Team 面无法约束 |
| 重定向 | 不自动跟随超限；跨 origin 拒 `WEB_REDIRECT_BLOCKED`，**victim 零触达**（H-2）；循环 5 跳上限（H-3） | 跨 origin 拒 `WEB_REDIRECT_DENIED`，victim 零触达（T-2）；循环 `WEB_REDIRECT_LIMIT`（T-3），hop 上限 5 同源 | 法则对齐，码名不同 |
| 字节上限行为 | Content-Length 超限整拒 `WEB_FETCH_TOO_LARGE`（H-5）；**流式超限截断交付 `truncated:true`**（H-4，4KiB cap 实测） | **任何超限整拒 `WEB_RESPONSE_TOO_LARGE`，零交付**（T-4，512KiB 默认） | **语义分歧**：原生部分交付，Team 全拒——模型可见差异，产品需择一 |
| 字符上限 | `maxBodyChars` 截到帽 + truncated（H-6） | 无字符帽概念（字节帽整拒在先） | 分歧 |
| 超时 | `WEB_FETCH_TIMEOUT`（H-7，300ms 实测） | `WEB_TIMEOUT`（T-6） | 对齐，码名不同 |
| 取消 | 预 abort `WEB_ABORTED`、socket 前（H-8）；mid-flight D-4 | `cancelled:true`（T-7；行级 A-4） | 对齐 |
| content-type | 仅 html/text：`application/octet-stream` 拒 `WEB_UNSUPPORTED_CONTENT_TYPE`（H-9） | 类型不可知，octet 按 utf8 文本**交付**（T-5） | **语义分歧**：Team 对二进制垃圾更不设防 |
| scheme | **http+https 皆可**（公网地址法则只管地址，H-10） | https-only；http 仅 loopback trusted opt；非 loopback http `WEB_SCHEME_NOT_ALLOWED` 零线（T-8） | **分歧**：原生接受明文 |
| 请求头 | UA=provider 名（X-1 桩端实测），无 cookie | `accept:*/*` + host，**无 UA**、无 cookie（X-2 桩端实测） | 指纹可区分（③ 层观察，Team 无法改原生 UA） |

**结论（三层裁决）：** 原生 fetch 的 ② 层保证清单真实且个别项强于 Team（loopback 无豁免），但**全部是 Provider 自治保证**——Team 既不能 per-call 覆写（scheme/上限/content-type/UA 皆 provider 配置时刻固定），也无法向 ③ 层（代理、上游、DNS）延伸。凡需求为"按 Team 策略对每次调用的目的地与传输行为做运行期强制"，适配路线只能到 CONDITIONAL；**fail-closed 原则保留：per-destination-enforcement-required 的验收位不给 B 路线 GO**。

## 4. 裁决判据表（§10 路线表）

> 列 = 四路线：A 原生直接治理（P-W1）；B ctx.web Host Service Adapter（P-W2）；C Team 自有实现现状；D Team 自实现 Search API Provider。行 = 指标。**格值 ∈ GO / CONDITIONAL / NO-GO / MOCK-PASS / ENV-PENDING / N-A**；依用户裁决"本轮不交付自实现 Search API Provider"，D 列按裁决整体 NO-GO。GO 仅授予有既有验收证据链或本轮实测完整闭合且无 ENV 依赖的格；MOCK-PASS = mock 证据齐、生产化/真机未证。
> **披露**：§10 裁决定原文不在仓库内（grep 无果），本表四列行集为按裁决要点（四路线×逐指标、web_search 与 web_fetch 各一张表）推断的结构，供主 Agent 校正格式而不改事实。

### 4.1 web_search

| 指标 | A 原生直接治理 | B ctx.web Adapter | C Team 自有现状 | D 自实现 Provider |
| --- | --- | --- | --- | --- |
| R1 调用授权（PA/权限 lane 在路径上） | **NO-GO**（N-1 实测无 lane 直通） | MOCK-PASS（A-1/A-2 审批指纹=声明 effectSet，拒批零线） | GO（U7 验收链，本轮 T 系复跑） | NO-GO（裁决否） |
| R2 per-destination 策略强制 | **NO-GO**（无 per-call 裁决点） | CONDITIONAL（endpoint=配置固定 origin 的声明；socket 层非 Team 管辖） | GO（connect effect per-destination + gate，U7 链） | NO-GO |
| R3 declared==requested（端到端一致） | **NO-GO**（无声明） | MOCK-PASS（准入时刻指纹实测；socket 时刻 ENV-PENDING） | GO（U7 链：effect→transport 目的地同源） | NO-GO |
| R4 凭据边界（Team 零接触密钥） | GO（宿主自持） | GO（D-0/D-1 实测：无凭据→不可用/类型化错误，key 仅头部——D-2） | GO（路线无凭据概念） | NO-GO |
| R5 取消语义 | CONDITIONAL（宿主 signal 语义，Team 传播链不在此路线） | MOCK-PASS（A-4 行级 cancelled + D-4 原生 WEB_ABORTED；mid-flight 全链 ENV-PENDING） | GO（U7 链） | NO-GO |
| R6 结果/多查询契约等价 | GO（原生语义本体；披露：maxQueries=4、并行扇出） | CONDITIONAL（逐 query 扇出 + 行 cap 8 vs 原生 4 语义差，§2-2/3） | GO（行契约自身；**无 search 后端 = 见 R9**） | NO-GO |
| R7 动态定义保护（劫持/晚注册/改名） | GO（N-3…N-6 实测 + a5natexe/C1 既有验收） | GO（同一 Guard 公共层；N-7 feed-verified 绑定实测） | GO（同一 Guard 公共层） | NO-GO |
| R8 旁路闭合 | **NO-GO**（继承直通即旁路；收敛=静态 builtinToolDeny，非运行期；翻转 webEnabled=中心改动，本轮禁止） | MOCK-PASS（N-7 遮蔽行实测闭合；依赖 mount-before-publish 序纪律） | GO（行遮蔽 + U7 链） | NO-GO |
| R9 产品验收状态 | **NO-GO** | **CONDITIONAL**（ENV-PENDING：E-1/E-3；且生产化需 §7-1 中心改动） | **NO-GO**（矩阵行 NOT_VERIFIED：机制在、**无后端 Provider**；补位唯一路径=自建 client = 本轮被否） | **NO-GO**（本轮裁决否；登记为 backlog 候选而非本表路线） |

### 4.2 web_fetch

| 指标 | A 原生直接治理 | B ctx.web Adapter | C Team 自有现状 | D（fetch 不适用） |
| --- | --- | --- | --- | --- |
| R1 调用授权 | **NO-GO**（N-1） | MOCK-PASS（同 search 链，行侧机制同源） | GO（U7 验收链 + 本轮 T 系） | N-A |
| R2 per-destination 策略强制 | **NO-GO**（目的地法则=②层 Provider 自治，非 Team per-call 策略；H-10/H-11） | CONDITIONAL（gate 核 declared URL，但 scheme/上限/UA 固定在 provider 配置时刻；重定向与 socket 由原生自治） | GO（每次调用 effect→transport 目的地同源，U7 + T-2/T-8） | N-A |
| R3 declared==requested | **NO-GO** | CONDITIONAL（声明核对实测；原生 transport 无 Team 指纹链，②层等价≠①层证明） | GO（U7 链） | N-A |
| R4 凭据边界 | GO（匿名 fetcher 无凭据，H-0 `available()≡true`） | GO | GO | N-A |
| R5 取消语义 | CONDITIONAL（H-8 原生语义） | MOCK-PASS（H-7/H-8 + T-7 双侧实测；全链 mid-flight ENV-PENDING） | GO（U7 链） | N-A |
| R6 契约等价 | GO（原生本体） | **CONDITIONAL**（分歧实测表 §3：字节帽截断交付 vs 整拒、octet 交付 vs 拒、UA、字符帽——模型可见语义差需产品择一） | GO（行语义已验收） | N-A |
| R7 动态定义保护 | GO（N-3…N-6） | GO（N-7） | GO | N-A |
| R8 旁路闭合 | **NO-GO**（同 4.1-R8） | MOCK-PASS | GO | N-A |
| R9 产品验收状态 | **NO-GO** | **CONDITIONAL**（E-2/E-3/E-4 ENV 腿 + §7 中心改动） | **GO**（既有 U7 验收链为据；矩阵现行行状态以权威矩阵为准，本表不代改） | N-A |

## 5. ENV-PENDING 登记（真机腿，本机零真网 = ENV_BLOCK）

| 编号 | 腿 | 状态 |
| --- | --- | --- |
| E-1 | 真 `api.deepseek.com` web_search 端到端（真凭据、真 `server_tool_use`/配额行为、真 sources 质量） | ENV-PENDING（本机禁真网；mock 端点已钉死线形状 D-2） |
| E-2 | 真 TLS 证书链 + 真 DNS rebinding 对抗（pin 与再解析窗口） | ENV-PENDING（宿主有既有验收，本 PoC 不复测） |
| E-3 | 代理环境真机行为（原生 proxied hop 跳过本地 resolve/pin 的 env 级证据；Team 无代理） | ENV-PENDING（源码级事实已录 §3） |
| E-4 | `resolvePublicAddresses` 公网 accept 腿（unicast 地址真解析） | ENV-PENDING（reject 全集已零 DNS 实测 H-11） |
| E-5 | B 路线 GUI/端到端 boot 验证 | ENV-PENDING（本轮禁 boot） |

## 6. 测量缝与有效性披露

1. 原生 fetch 行为腿（H-1…H-10）经 **HttpFetchProvider 公开构造参数 `resolveAddresses`** 注入 loopback 地址集——这是宿主文档化的策略化地址 seam，非 monkey-patch；目的地法则本身（H-11）用**未注入**的出厂 provider 直测。
2. `ctx.web` seam 为直接构造的 pristine `WebRuntime`（Service ctor 仅需结构 `reflect.provide`/`effect` shim）；选择/注册/截断法则即宿主法则本体，非复刻。
3. DeepSeek 线形状腿打本地 MOCK 段假 Messages 端点：证明的是**请求形状/头/错误/取消/重定向语义**，不是真服务行为（真服务 = E-1）。
4. 测试从 worktree 运行、依赖主仓 node_modules（cordis/dsh-* 经 config alias 固定到 `packages/runtime` 同安装面 = 0.2.0-rc.2 同发布点）；pristine web 栈经 `tests/paths.mjs` 定位后只读动态导入。
5. 本目录与 `tests/poc-web-native-reuse/` 全部标注 **"PoC 不入生产判据"**；矩阵、backlog、authority 文件零改动。

## 7. 接口缺口登记（需中心代码改动，本轮全部未动）

1. **B 路线生产化落点**：web-family `search-executor` 的 provider port 现由 blueprint backends 注入；"经 ctx.web 的适配器"作为标准 backend（含逐 query 扇出、码透传、cap 调和）需要 web-family 中心改动。PoC 的 `makeCtxWebAdapter` 证明端口形状兼容，落位=中心决策。
2. **webEnabled 语义翻转**（关闭时连带压制原生继承）：触及 `web.mjs` 零翻转法则 + Guard verified-native 语义，中心级裁决，本轮仅披露。
3. **错误码透传表**：行失败码丢失宿主原生码（§2-2），生产化需在 executor 加映射（中心改动）。
4. **UA/头策略**：Team 侧无法为原生 Provider 覆写 UA/scheme/上限（②层配置时刻固定）；如需统一出站指纹，须中心在 host 配置面开 seam。

## 8. 一句话结论（供主 Agent 直接引用）

- **P-W1 裁决事实**：治理成员继承的全局面原生 web_search 会**无 lane 直通运行**（N-1 实测，零拒绝零 PA）；遮蔽原生名的唯一机制是 plane takeover 行（N-7 实测）；"原生直接治理"作为产品路线 NO-GO。
- **P-W3 三层结论**：原生 Provider 的传输保证是真实的 ② 层自证（个别强于 Team：loopback 无豁免、字面非公网全拒零 socket），但**不可 per-call 覆写、不可向 ③ 层（代理/上游/DNS）延伸**；凡 per-destination-enforcement-required 的验收位，B 路线封顶 CONDITIONAL，fail-closed 保留。
- **推荐格值**：web_search 表 = A(NO-GO)/B(CONDITIONAL, 余格 MOCK-PASS)/C(R1…R8 多为 GO 但 R9 NO-GO 无后端)/D(NO-GO 裁决)；web_fetch 表 = A(NO-GO)/B(CONDITIONAL)/C(**GO**，引 U7 既有验收链)/D(N-A)。全表无 MOCK-PASS 升 GO、无 UNKNOWN。
