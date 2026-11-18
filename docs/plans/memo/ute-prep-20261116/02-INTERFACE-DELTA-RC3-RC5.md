# 02 — 接口差量 rc.3 → rc.5：逐区判定"UTE 设计是否受影响"

**[updated 2026-11-16 UTE-Prep]** 范围：`dsh-v0.2.2-rc.3@38a6a5c965aa99ab525161efb7cc5cf1fe62fced` → `dsh-v0.2.2-rc.5@9c2670d3bce5275e0d1610272958121af87787bb`。判定只针对 #765 的 11 章设计，不评审上游。

## 0. 差量的测量方式（可复现）

```bash
git init --bare .upstream.git
git -C .upstream.git fetch --depth=20 --filter=blob:none https://github.com/deepseek-ai/deepseek-harness \
  'refs/tags/dsh-v0.2.2-rc.3:refs/tags/rc3' 'refs/tags/dsh-v0.2.2-rc.5:refs/tags/rc5'
git -C .upstream.git diff --name-status rc3 rc5 | wc -l     # 448
```

GitHub compare API 同区间返回 `status=ahead, ahead_by=13, behind_by=0, total_commits=13`，但它的 `files` 数组**在 300 条处截断**；448 这个数字来自上面的本地 diff，不是 API。别引用 API 的 300 条列表当全集。

448 条路径的构成：**380 个 `package.json`**（纯版本号 `0.2.2-rc.3` → `0.2.2-rc.5`）、约 40 条文档/snapshot/upgrade-guide、约 28 条真实源码/测试。下面按任务要求的四个区逐条判。

## 1. 模型响应处理（model response handling）

| 文件 | 改动 | 判定 |
|---|---|---|
| `packages/llm/llm/src/error.ts` | `LLM_FAILURE_CODES` 新增 `CONTENT_REFUSED`（+1 行） | **受影响（方向单一）** |
| `packages/llm/llm-deepseek/src/translate.ts` | `message_delta.stop_reason === 'refusal'` 时构造 `LlmError('…content safety review: <explanation>', 'CONTENT_REFUSED')`；`usage.totalTokens` 计算上移到 `message_stop` 分支顶部；refusal 路径**先 `yield {type:'usage'}` 再 `throw`** | **受影响（方向单一）** |
| `packages/llm/llm-deepseek/tests/stream.spec.ts`、`loader-composition.spec.ts`、`README*` | 测试/文档跟随 | 否 |
| `docs/upgrade-guide/v0.2.2-rc.3/deepseek-refusal-code/guide.md`（新增） | 上游自述该升级语义 | 参考 |

**对 UTE 的准确影响**：refusal 是**模型流**的终态失败，不是工具调用的终态。它发生在"某个 model step 的 SSE 流"上，因此可能出现：工具 batch 已经被分发/执行 → 该 step 的流以 `CONTENT_REFUSED` 抛出 → 模型侧永远拿不到这一 step 的 tool result 汇总。这正是 #765 §七 §5 与 UTE-17 已经在防的那类风险（"结果没送到模型 ≠ 没有执行"）。

- **需要改设计的地方**：无机制改动；但它把 UTE-15/17 的一条隐含前提变成**显式要求**——**ExecutionFact 的写入不得以"模型回合正常结束"为触发条件**。任何"回合收尾时批量 flush execution facts"的实现都会被 refusal 路径打穿（流抛出，收尾不执行）。G1-S3 的验收据此加一条负控：refusal/throw 之后，已 dispatch 的调用仍有 fact 或 `unknown`。
- **不需要改的地方**：`usage` 先 yield 再 throw 不改变 #765 的任何主张（它不解析 usage）；`CONTENT_REFUSED` 不进入工具结果分类。

## 2. Web / Search provider 默认

这是本区间**唯一**真正改变 UTE 工具面语义的区域。

| 文件 | 改动 | 判定 |
|---|---|---|
| `packages/bundle/base/cordis.patch.yml` | `- id: web` 的 `config` 删除 `searchProvider: deepseek-search-api`，只剩 `fetchProvider: http`；注释改写为"按模型 provider 路由选择" | **受影响（语义变化）** |
| `packages/bundle/base/tests/base.spec.ts` | pin 断言从 `{searchProvider, fetchProvider}` 改为 `{fetchProvider}` | 否（上游测试） |
| `packages/web/web/src/index.ts` | 新增 `DEEPSEEK_MODEL_ROUTES = {deepseek-official, deepseek-account}`、`DEEPSEEK_ROUTE_SEARCH_PROVIDER='deepseek-official'`、`OTHER_ROUTE_SEARCH_PROVIDER='deepseek-search-api'`；`Selection` 增 `preferredId?`；未配置 `searchProvider` 时**按 `llmProvider` 路由**优先选择，否则退回"唯一可用 provider" | **受影响（公开选择语义）** |
| `packages/web/web/src/types.ts` | `WebSearchRequest` 增 `readonly llmProvider?: string` | **受影响（公开请求字段）** |
| `packages/web/tool-web/src/search.ts` | `runSearchQueries` 增 `llmProvider` 形参并透传到每次 `ctx.web.search`；值来自 `exec.agent?.session.requestContext()?.provider` | **受影响（读 exec 上下文的既有公开面）** |
| `packages/web/web-search-deepseek/src/{provider,types}.ts` | 结果项可自带 `snippet`（优先于 citation 拼接）；描述文案改为"搜索不按次收费"；错误提示文案改 "DeepSeek server-side search" | 部分（snippet 优先级是输出差异，非 Boundary 语义） |
| `packages/extensions/tool-cordis/src/api-catalog.ts` | 生成式 API catalog：`WebSearchRequest` 声明与 web 选择语义文案跟随 | 否（生成物） |
| `apps/web/tests/*`、`snapshots/session/web-search-*`、`docs/subsystems/web.md`、`docs/config-catalog.md` | 跟随 | 否 |

**对 UTE 的准确影响（三条，必须写进 [五](../unified-tool-execution-dsh-022-20261114/05-TOOL-ADOPTION.md) §3）**：

1. **转发义务**：Team 的受控 `ctx.web` 代理（#765 §五 §3"Web Provider 在真正网络请求前评估 network allow/deny"）如果**重建** request 对象而不是透传，就会丢掉 `llmProvider`，从而把 provider 选择从"按路由"降级为"唯一可用/歧义"。这是**静默语义变化**：网络准入判定没变，但被调用的 provider（以及它的计费、endpoint、可用性）变了。规则：代理必须**逐字段透传** `WebSearchRequest`（含未来新增的可选字段），只允许在拒绝时短路；不允许"白名单复制已知字段"。
2. **测试义务**：`web_search` 的负控（"deny 时零连接"）现在必须**带路由**跑——否则测的是另一条选择路径。`WEB_PROVIDER_AMBIGUOUS` / `WEB_PROVIDER_CONFIGURED_MISSING` / `_UNAVAILABLE` 的语义**未变**（改的是"未配置时选谁"），所以旧断言不失效，只是不足以覆盖新分支。
3. **显式配置优先**：配置里钉了 `searchProvider` 时路由被忽略（`Selection.configuredId` 分支在前）。Team 若为了确定性而钉 provider，就必须在证据里写明"本次运行固定 provider=X，未覆盖按路由选择"，否则就是把一条未测分支当成已测。

**不是** UTE 的 `network: deny` 语义变化：禁网仍是"连接前拒绝"，与选哪个 provider 无关。反过来也不成立——"provider 选择正确"不证明禁网。

## 3. 版本管线（version plumbing）

| 事实 | 判定 |
|---|---|
| 380 个 `package.json` 的 `version` 从 `0.2.2-rc.3` → `0.2.2-rc.5` | 否（机械） |
| `packages/core/*` 全部只改 `package.json`：`tools`、`tool-executor-native`、`tool-executor-ptc`、`agent-loop`、`agent`、`session`、`scope`、`system-prompt`、`agent-tool-presentation`、`agent-default-model` | **否（关键结论）** |
| 根/各 `apps/*` `package.json` 同步 | 否 |

**对 UTE 的影响**：pin 必须钉 **tag+commit**，不能钉 `package.json` 版本串——版本串是 380 处一致改写的产物，任何"读 package.json 判断宿主版本"的代码在两代之间都会得出相同答案。既有纪律（`tests/paths.mjs` 唯一来源）已经正确，rc.5 延续即可。另一条：包版本与资产包版本**不同步**（见 [01](./01-BASELINE-REFRESH.md) §2 H-5），别把 `0.2.2-rc.5` 与 `0.1.2` 当同一套版本号。

## 4. tool-executor / `ToolsService` / `Pipeline` 面

**结论：源码零改动。**

- `packages/core/tools/src/**`、`packages/core/tool-executor-native/src/**`、`packages/core/tool-executor-ptc/src/**`、`packages/core/agent-loop/src/**`：**不在** 448 条路径里（只有它们的 `package.json`）。
- 448 条里没有任何 `ToolExecutionPipeline`、`ResolvedToolSet`、`executeToolBatch`、`setExecutor`、`tools/result`、`tools/post-execute` 相关源码文件。
- 唯一"像工具面"的改动是 `packages/extensions/tool-cordis/src/api-catalog.ts`（生成式 Service/Type API 目录，3 增 3 删，内容就是 web 选择语义与 `WebSearchRequest.llmProvider`）——它是**文档生成物**，不是可执行接缝。

**对 UTE 的影响**：#765 [三](../unified-tool-execution-dsh-022-20261114/03-EXECUTION-FLOW.md) §1 的时序图（`resolve → executeToolBatch → pipeline.prepare/dispatch/complete → tools/result`）在 rc.5 上**逐字有效**；[七](../unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md) §5 关于 `tools/result` 是 `emit` 且不等待异步 handler 的判断**未被修复**——rc.5 没有给"先落账后返回"提供新钩子。所以 S2（commit-before-return）仍然是独立强化门，不能因为"换了个 rc"就假设上游已经解决。

**一处需要记录的间接影响**：`tool-web/src/search.ts` 通过 `exec.agent?.session.requestContext()?.provider` 取路由，说明 rc.5 的公开 exec 上下文里**存在** agent/session 引用。UTE 的 Binding 侧如果需要"这一次调用属于哪个模型路由"，这是 rc.5 上**已存在**的公开读法，不需要自建旁路；但它是 `.provider` 字符串，不是结构化路由对象——把字符串当身份用是错的（UTE-13/15：身份必须有可信来源，不能从字符串推断）。

## 5. 其余改动（不在 UTE 面上，列出以免被误当遗漏）

| 文件 | 改动 | 判定 |
|---|---|---|
| `packages/experimental/liveshare/src/host/tunnel-worker.ts`（+14/−0）及其 2 个 spec | tunnel worker 逻辑 | 否 |
| `docs/upgrade-guide/v0.2.2-rc.4/web-search-deepseek-model-default/guide.md`（新增） | 上游自述"web search 默认按模型路由"，与本文件 §2 同源 | 参考 |
| `snapshots/session/deepseek-content-refusal/`（新增）、`web-search-*` 快照 | 上游 snapshot | 否 |
| `apps/web/tests/search-api-provider.overlay.yml`（新增） | 上游 e2e 覆盖层 | 否 |

## 6. 判定汇总（一行一区）

| 区域 | UTE 是否受影响 | 处理 |
|---|---|---|
| 模型响应处理（refusal） | **是**，方向单一 | 不改机制；把"fact 写入不得依赖回合收尾"写成 G1-S3 负控 |
| Web/Search provider 默认 | **是**，语义变化 | [五](../unified-tool-execution-dsh-022-20261114/05-TOOL-ADOPTION.md) §3 增"逐字段透传 + 带路由跑负控 + 钉 provider 必须披露"；`llmProvider` 记为需要 owner 批准的语义变化 |
| 版本管线 | 否（但钉法有纪律含义） | pin 用 tag+commit；资产包版本独立 |
| tool-executor / ToolsService / Pipeline | **否**（源码零改动） | 时序图与 `tools/result` 判断不变；S2 仍需独立门 |
| 其余（liveshare / 快照 / 文档） | 否 | 无 |

## 7. UNKNOWN（本文件没有解决、也不假装解决的）

- **UNKNOWN（部分消解）**：rc.5 的**运行期行为**。以上全部来自源码/测试/文档差量与生成式 API 目录；本 memo **没有在 rc.5 上启动 host**，也没有跑 `web_search` 的真实路由分支。**2026-11-18 更新**：#787 已让 rc.5 宿主真正 boot 并通过六条 native-API 断言（`tests/next-host/`），所以"rc.5 能不能起"不再是未知；但**本文件 §1/§2 的差量结论仍未经运行期验证**——尤其 `llmProvider` 的透传分支从未被跑到，refusal 下的"先 yield usage 再 throw"也只在源码层确认。G1-S2/G1-S3 正是为了消掉这一条。
- **UNKNOWN**：`deepseek-official` 路由上的 legacy Messages 搜索在 DeepSeek 账号下是否真的"不按次计费"——这只被上游文案与升级指南声称，属于产品条款，不是我可验证的源码事实。
- **UNKNOWN**：rc.5 是否在 `packages/core/tools` 里保留了 rc.3 的**同名私有符号**（`ResolvedToolSet` 等）之外还悄悄加了行为（例如 batch 调度细节）。名称级 diff 只能证明"文件没动"，不能证明"行为没动"；行为等价要靠 G1 的实测对照，不能靠本节。
- **UNKNOWN**：`WebSearchRequest.llmProvider` 在 rc.4 引入还是在 rc.5 引入——本 diff 只到区间粒度，不区分中间 rc；如需按 rc 归因，要单独 diff rc.4。（对 UTE 判定无影响。）

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
