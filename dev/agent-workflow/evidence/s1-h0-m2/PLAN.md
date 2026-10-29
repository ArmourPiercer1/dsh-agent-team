# S1 H0-M2 最小方案（准备稿 · 未运行 · 等 root 唯一 GO）

范围声明：只用自有 fixture 与自有运行器，沿用 **no-ext-contributors** 限定；Host / Core / 产品中心 **0 改动**；`mock-deepseek.mjs` **0 改动**（回复脚本由运行器的 `decide` 注入）；不起文档轮、不做通用平台。

## 0. 先引用既有 H0 review（不新建评审体系）

- `dev/agent-workflow/SESSION_ROUTER_LOG.md:5120-5142` — M1 首跑登记与终态 **FAIL**（`REQUEST_EXTENSION`，PoC 1/20、Host 1/12）。
- 同文件 `:5143-5161` — 差分补试登记与终态 **PASS**（PoC 2/20、Host 2/12，同假设到顶）。
- `dev/agent-workflow/evidence/s1-h0-m1/README.md` — fixture 设计与公开 seam 引用（`profiles/web/cordis.patch.yml` → `DshInstance.mountRows` `instance.mjs:194`）。
- 原件：`s1-h0-m1/runs/s1-h0-m1-20261024T222400Z/`（FAIL 全件）与 `runs/s1-h0-m1-noext-20261024T225300Z/`（PASS 全件：`tool/call`×1、`tool/result`×1、`turn/end {kind:"completed"}`，root 已亲核）。
- root 复核裁决（本轮指令）：仅该 mock 变体正控、**不升级 Gate**；默认 profile 的扩展错误保留为 ENV 限制；**M1 禁第三次**。故 M2 的运行前置必须是 no-ext 变体，否则 turn-1 仍死于同一 `REQUEST_EXTENSION`。

## 1. 唯一科学问题

在**真实 `tools/execute` 异步 fence** 内部，用**公开 API**把已注册工具 A 注销、注册**同名** B（不同 body、不同 output schema），分辨"名字→实现"的解析时机与各阶段各自验证了谁。固定 Host `639ed015…` 的管线（源码行号全部 @pin）：

| 阶段 | 源码 | 该阶段读到的是 A 还是 B |
| --- | --- | --- |
| 授权门 `tools/pre-execute` | `packages/core/tools/src/index.ts:1493-1508`，`ask → serviceAsk :1509-1511`，`guardReason :1519` | 只按 **(name, parsed arguments, agent)** 决策；guard 限制是注册期编译的**名字集合** `ToolRestriction :700-711` → **对 A/B 不可区分** |
| 调度分类 `executionMode` | `:1303-1312` → `resolveExecution :1304` | 读到 **A**（fence 之前），读 `isConcurrencySafe` |
| 异步 around-dispatch fence | `:1601-1608` `ctx.waterfall(carrier,'tools/execute', exec, () => dispatchToolBody(exec))` | 实验注入点（公开 scoped waterfall） |
| 实现解析 + body | `:1578` `resolveExecution(exec.name,…)` → `:1581 await tool.execute(...)` | **fence 之后 live 查表** → 期望解析到 **B** |
| 输出校验/投影 | `createSuccessResult :1832-1835` `validateJsonSchemaValue(tool.output.schema,…)` → `ToolOutputError` | **绑定 :1578 解析到的定义** → 换成 B 即按 **B 的 output schema** 校验 |

公开 API 依据：`register(definition): () => void`（注销闭包）`:1063`；live 可见表 `get/resolve → view(scope).visible.get(name) :1231`；`tools/change :208/:835`。

## 2. 明确不声称"绕过授权"

授权门与 guard 只按**名字与参数**决策，本实验 A/B 同名 ⇒ 决策对两者不可区分。**M2 不产生任何"绕过授权"的证据，也不得如此表述**；它只测"解析时机 + 谁验证了 A"。若要授权维度，需要"不同名 / 不同 restriction"的另一假设，M2 不覆盖。

## 3. 最小 diff（1 新文件 + 1 文件追加，Host/mock 0 改动）

**(1) 新文件 `dev/agent-workflow/evidence/s1-h0-m2/probe-m2-plugin.mjs`**（从现有 probe 派生）
- 在 effect 内 `const unregisterA = ctx.tools.register(DEF_A)`（`DEF_A` 与现 probe 同 body：校验 `tag`、写 `markers/<tag>.marker`），effect 回收时 `unregisterA()`。
- 公开 fence 监听：`ctx.waterfall('tools/execute', (exec, next) => …)`，仅当 `exec.name === 's1_m1_probe'`：
  - 首次：记 ledger `fence-enter`（name + `tag`）→ `await sleep(200, exec.signal)`（**真异步 fence**）→ 若 `ctx.tools.executionMode` 可达则记 `scheduler_mode_before_swap`（不可达记 `unknown`，不猜）→ `unregisterA()` → `unregisterB = ctx.tools.register(DEF_B)`（**同 name**，body 写 `B1.marker`，output schema 故意收窄）→ 记 `fence-swap` → `return next()`；`next()` 落地后 `unregisterB()` 并 `unregisterA = ctx.tools.register(DEF_A)`（**恢复 A，供 run 内对照**）。
  - 第二次同名调用：不再 swap，直接 `next()` → 应执行 **A**。
  - 全程只用 `register` 返回的公开闭包；**无私有 Map、无 monkeypatch、不注销注册表、不改 Guard/registry**。
- `DEF_B` 的 body 只写 marker 与 ledger 腿，不新增外部副作用（sentinel 仍只读）。

**(2) `m1-run.mjs` 只追加分支**（`VARIANT_DEFAULT` / `VARIANT_NO_EXT` 字节必须不变）
- `VARIANT_M2 = 'm2-fence-swap'`：`buildPatchText(VARIANT_M2)` = 现有 insert 行（`id: s1m1-probe` 换成 `name: "./s1m2-probe-plugin.mjs"`，仍**一个普通插件行**）+ **保留 no-ext 两行** `config.enabled:false`。
- `makeDecideM2({seq, req})`：第 1 请求→tool-call（`tag:A1`，id `s1m2-tc-1`）；**按 `req.body.messages[].tool_result` 形状**判定"结果已回送"后再发第 2 个 tool-call（`tag:A2`，id `s1m2-tc-2`），其余→ text。mock 文件不动（`decide` 注入 `:147`、调用点 `mock-deepseek.mjs:265`）。
- 新增 `evaluateM2Oracle`（**不改** `evaluateOracle`）；`summary` 记 `variant`；`steps.jsonl` 记 `patch-variant`（实际落盘 sha）。

**M2 判据（事前固定，禁止事后挑）**：`fence_enter_once`、`fence_swap_once`、`executed_body_is_B_on_call1`（`B1.marker` 存在且 `A1.marker` 尚不存在）、`b_body_exactly_once`、`b_side_effects_limited_to_marker_and_ledger`、`control_second_call_body_is_A`（`A1.marker` 出现且计数 1）、`output_validation_bound_to_B`（**预写期望**：`DEF_B` 的返回故意不满足其收窄 schema ⇒ 期望 `tool/result` 携 `ToolOutputError` 且 `turn/end` 仍 `completed`）、`b_body_count_and_a_body_count`（数值 1/0 与 0/1 两阶段核对），并沿用 M1 安全/协议判据：`token_gate_401`、`session_created`、`prompt_admitted_200`、`call_terminal_determined`、`tool_result_returned`、`untriggered_name_zero`，watchdog / 有界 owned 收尾 / port 释放 / env scrub 全部原样。

**结果的两种可能，语义事前写死**：
- call#1 执行 **B** ⇒ "`:1578` 是 live 解析；pre-dispatch 授权与调度分类属 A（名字级），`:1834` 输出校验绑定 B"。
- call#1 执行 **A** ⇒ "实现早于 fence 已被上游捕获/快照，`:1578` 的 live 查表对本例不生效" —— 同样是有效结论。
- 两者都算 M2 完成；**不重试、不换配置再跑**。

## 4. 运行前置（仅当 root GO）

计数：**PoC 3/20、Host 3/12**（当前 2/20、2/12），M2 只用 1 次，失败同样计数，无自动第三次。封存：`m1-run.mjs` 新 hash、`probe-m2-plugin.mjs` 新 hash、`probe-plugin.mjs`/`instance.mjs`/`util.mjs`/`s1m1-session-client.mjs`/`mock-deepseek.mjs` 原 hash 不变、HTU `639ed015397…` 三聚合 `e72d7d0c212b8e41`·`a3353facc7e98f0b`·`e80728be886b0e7e`、现场 patch sha。约束：独立新 World `s1-h0-m2-<stamp>`、端口 3180、≤30 min + 原有界 owned 收尾、禁 :3080、真实 provider 零调用（env key 名本不存在 + fake key + mock loopback）、不 install/build/换包/换模型/改判据。

## 5. 停止条件（fail-closed）

1. World 或 `.lock` 已存在 → 停，不换名；2. 3180 非空闲 → 停；3. 实际落盘 patch sha ≠ 封存值 → 停；4. turn-1 再现 `REQUEST_EXTENSION` 或非预期错误 → 立即有界收尾记 **FAIL**（含义：no-ext 之外还有第二个致因，属有效差分信息）；5. 无 body 执行且无可解释的 deny/not-found → FAIL 并保留全部 wire 观察；6. watchdog / teardown / `mock.close` 任一超时 → **永不 PASS**；7. 出现 §3 未预先声明的第三种结果 → 记 **NEEDS-RULING**，不得解释成 PASS。

## 6. 预算与仍具名未闭合项

Owner 累计 16 h、截止 **Oct 25 13:00Z**（准备时间计入）；本轮实际钟点：Q7 退役 23:03:36Z→23:04:13Z、M2 方案准备至本文件写完。
未闭合（具名）：**F0 census 未签名**；**build provenance NOT_VERIFIED**（三聚合只证当前内容，不证构建来源）；**HTU 来源 NOT_VERIFIED**；`tests/homes/*/.credentials.yaml` 0600 未读正文；默认 profile 的 `REQUEST_EXTENSION` cause 仍 **UNKNOWN**（两贡献者中具体是哪一个未分辨）。M2 不声称解决其中任何一项，也 **不授 G1-F / 产品 GO**。

## 7. Lane A 串行事实

当前**只有我一个执行者**（付费子任务已由 root 终止、root 指定 main Qwen 为唯一 writer）。Lane A（工具来源 / 回收价值盘点）现被我的串行占用阻塞——**请 root 拆分**：该盘点是纯只读文件/git 事实收集，不需要强模型、不需要 Host，可另派 child 并行。
