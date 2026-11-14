# 13 — 外部 Agent 工程参考与本仓库既有工作对齐

[返回索引](README.md) · [决策](01-DECISIONS-AND-SCOPE.md) · [迁移计划](11-MIGRATION-AND-ACCEPTANCE.md)

## 1. 可引用的公开实践（直接来源）

### OpenAI Agents SDK — deterministic model tests
[Testing guide](https://openai.github.io/openai-agents-js/guides/testing/) 描述 `ScriptedModel`、`assertComplete()`、工具循环、guardrails 和 sandbox/transport 的模拟边界。我们仅采纳“模型替身可控 + 运行逻辑真实 + 交互消费完整”的测试思想，**不引入 SDK 成为 DSH 运行时依赖**。

### OpenHands — Mock LLM + Full App
[playwright.mock-llm.config.ts](https://github.com/OpenHands/OpenHands/blob/main/playwright.mock-llm.config.ts) 展示 Mock LLM server 启动真实 App E2E 测试、独立端口和预编译 build。我们借鉴真实宿主+模拟模型，保留现有 DSH 的服务边界。

### LangGraph — isolate state in tests
[LangGraph test guide](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/test.mdx) 建议独立 checkpointer 和部分图运行测试；[checkpointer guide](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/checkpointers.mdx) 给出 checkpoint/resume 的原理。我们借鉴状态独立与可恢复性验证，但必须遵循自身 Stop/UNKNOWN 语义，而不是照搬自动恢复策略。

### SWE-bench — layered environment & content-aware result reuse
[SWE-bench harness](https://www.swebench.com/SWE-bench/reference/harness/) 描述 Base/Environment/Instance 分层缓存；[Evaluation guide](https://www.swebench.com/SWE-bench/guides/evaluation/) 说明历史结果按 run_id + instance_id 复用可能忽略不同 patch。我们只复用可核对输入身份的 Host/Product 构建产物，不把旧 PASS 缓存当作本次验证。

### GitHub Actions — matrix and cache security
[Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) 说明 matrix fail-fast 和 continue-on-error；[Dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching) 区分 artifacts/caches 并披露低信任 cache poisoning 风险。分片是新编排而非新的安全权限。

## 2. #759–764 不应被“一键合并”代替目标设计

| PR | 可复用内容 | 必须修订/限制 |
| --- | --- | --- |
| [#759](https://github.com/ArmourPiercer1/dsh-agent-team/pull/759) | Draft-first + 基线计时 + Ready helper | helper 的 pending/unknown、HEAD 与 upstream 同一性、评论分页缺口 |
| [#760](https://github.com/ArmourPiercer1/dsh-agent-team/pull/760) | Candidate 身份与 C2 状态分离的只读表 | 不准把 2 条 eligible flag 当全部 C2 证明；历史元数据缺陷不能阻断所有新候选 |
| [#761](https://github.com/ArmourPiercer1/dsh-agent-team/pull/761) | 累积 evidence tree 字节数统计 | git --numstat 是文本行数不是字节数；每 PR KiB 与 2 MiB 结论无效 |
| [#762](https://github.com/ArmourPiercer1/dsh-agent-team/pull/762) | census 实测瓶颈、B1 profile 与 B2 分片备选 | 不采纳默认跳过/后移 census 的 B4/B5；B3 必须考虑 Required 的 cancel 约束 |
| [#763](https://github.com/ArmourPiercer1/dsh-agent-team/pull/763) | git install/package 与 boot 的 DEV-LIVE 证据 | 独立发布链、不得升级为 Candidate C2 |
| [#764](https://github.com/ArmourPiercer1/dsh-agent-team/pull/764) | L0 UNKNOWN/证据 traceability 定量警示 | 20/40 非代码测试覆盖率；不采纳 kit=0 tests/coverage determined 的 C1 |

## 3. #530 与 #765 必须纳入依赖评审

- [#530 未收集 Node test gate](https://github.com/ArmourPiercer1/dsh-agent-team/pull/530)：该 PR 已有“未收集测试禁止绿”的实现与负控。**M1 先复用或整合其实际代码**，不能为 Catalog 再造一个独立名单。其局限/对 Host-dependent test 的豁免需逐条复审。
- [#765 UTE 目标架构](https://github.com/ArmourPiercer1/dsh-agent-team/pull/765)：新的 DSH 0.2.2 工具执行层与 Realm/Boundary/Attempt/Observation 契约尚是设计，实施本测试架构时要按公开 Host 入口与真实副作用断言，不写死旧 ToolPlane 实现。每个新 UTE 不变量可以接入本项目的 Contract Registry。

## 4. 与现有仓库文件的映射

| Existing | Target |
| --- | --- |
| `vitest.config.ts`、`pnpm test` | 继续作为 Vitest 收集/执行事实源 |
| `scripts/run-tests.mjs`、`scripts/ci-local.mjs` | 保留入口；接入统一 Catalog/Plan，避免新 CLI 与旧入口并行永久维护 |
| `scripts/eb3-impact.mjs` | 与 L0 Planner 共用一套影响算法 |
| `dev/ci/eb3-ci-manifest.json` | 保留 Required 层/关键合同，减少普通文件硬编码路径 |
| `tests/world-factory`、`tests/kits` | 增强 Scripted Model、独立 witness、故障注入和驱动 self-test |
| `tests/paths.mjs`、`docs/TEST_METHODS.md` | 保留唯一测试世界路径与稳定实例隔离边界 |
| `.github/workflows/ci-required.yml` | 保留 Required 汇总 fail-closed 与 synthetic merge tree |
| `.github/workflows/census-runtime.yml` | profile→可信 Host cache→完整分片→汇总，先 shadow |
| `.github/workflows/pr-gate.yml` | 暂时保留；M6 才审查是否有可安全删除的重复检查 |
| `dev/engineering/candidates`、`current-authority.json` | 本工程 PR 不写，C2/发布另行授权 |

## 5. Review 时必须区分事实、建议、未实证三种语言

- **事实**：代码/工作流/测试基线上的已存在行为与引用的具体测量。
- **设计**：本系列文档的目标合同和默认建议。
- **待验证**：L2 能否实现 10min、shard 1/2/4 的真实性能、缓存是否净收益、目标 0.2.2 宿主上哪些测试有效。

禁止将设计目标写成“当前已经 PASS”。本设计可以作为本地 Agent 的实施基线，但实际修改仍需按 [11](11-MIGRATION-AND-ACCEPTANCE.md) 逐段小 PR 验证。
