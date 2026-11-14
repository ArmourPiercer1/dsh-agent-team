# 04 — Impact Planner 与 L0/L1/L2/L3 分层语义

[返回索引](README.md) · [Catalog](03-TEST-CATALOG-AND-CONTRACTS.md) · [Census](07-CENSUS-SHARDING-AND-AGGREGATOR.md)

## 1. 层级和验收义务

| Tier | 触发 | 必需验证 | 运行失败意味着什么 |
| --- | --- | --- | --- |
| L0 | 本地修改 / pre-push | 受影响单元/Contract 测试、适用的静态校验 | 只能决定是否值得 push，不是合并凭据 |
| L1 | Draft 的每次 push | 适用静态校验 + 受影响测试 + 低成本安全关键集合 | 输出 `ci-required-deferred` 等 Draft 判据，仍非合并通行证 |
| L2 | Ready 最终 head | 完整 census + 必需安全与产品检查，绑定合成 merge tree | 缺一不可，必须全部完成才能合并 |
| L3 | master/nightly/显式请求 | 长时间、压力、外部模型、升级兼容、扩展故障注入 | 形成额外告警/回滚线索，不替代 L2 |

L2 不采取“选测即全量”，只是把**同一个已定义的完整任务总体**进行并行调度。当前 census 九个 root、两轮 capture 的语义必须按现有实现解读，不假设它们是 18 个完全独立任务。

## 2. Planner 输入及输出

输入：`base_sha`、`head_sha`、`merge_tree_sha`、Catalog digest、关键契约版本、依赖/反依赖关系、changedPaths、Tier Policy（来自受信策略）。必须标注数据来源、构建失败和未知分类。

建议可复现输出：

~~~json
{
  "schema": "ci-test-plan/1",
  "tier": "L1",
  "identity": {
    "base_sha": "<sha>",
    "head_sha": "<sha>",
    "merge_tree_sha": "<sha>",
    "catalog_digest": "<digest>",
    "policy_digest": "<digest>"
  },
  "selected_test_ids": ["approval.identity-binding"],
  "selection_reasons": {
    "approval.identity-binding": ["critical_fast", "affected:packages/domain"]
  },
  "unknown_impact_paths": ["scripts/new-adapter.mjs"],
  "full_census_required_before_merge": true
}
~~~

实际 plan 应对字段规范化排序，计算 `plan_digest` 并在所有 shard 强制一致；不能把未经确认的用户标签当作删减安全合同的授权。

## 3. 保守影响面演算

定义 `Affected(Δ)` 为变更路径沿 package import/导出、动态绑定和显式契约边的反向闭包；对解析不了的依赖标记 UNKNOWN。

~~~text
L1 selected = affected tests ∪ mandatory fast contracts ∪ mandatory static checks
UNKNOWN -> conservative fallback selection + report UNKNOWN
L2 selected = complete census plan + mandatory L2 safety checks
~~~

- 对 Catalog/Runner/CI 配置变更，触发 Catalog 自身负控与较大的测试集合；不能让修改后的 Selector 单独判断自己的影响。
- 对未知配置、顶层脚本、动态 ToolDefinition 或影响面解析失败，L0 可以返回 `undetermined`；L1 必须有明确 fallback 或将未知记录为残余未覆盖，且不因此改变 L2 的必跑要求。
- 改变产品源码但没有找到测试，必须披露 `NO_AFFECTED_TEST_DISCOVERED` 并由关键契约/静态门补充判断，不得把计数 0 当成覆盖结论。

## 4. Planner 必须满足的性质

- **Soundness 偏向**：优先多选，绝不悄悄少选；静态导入图不包含动态注册时必须增加显式契约边或升级。
- **Monotonicity**：相同 Catalog/Policy 下，变更集合增加不应导致被选测试减少（除非新增冲突直接转 ERROR）。
- **Determinism**：相同 SHA/Policy/Catalog 得到相同任务集合和 plan digest。
- **Traceability**：每个包含/排除决定有机器可读理由；不得只有“影响面较小”自由文本。
- **Fallback**：缺依赖图、Catalog 或 import 解析失败，不能返回全绿零测试。

## 5. 现有行为的兼容

第一阶段保留 `scripts/ci-local.mjs` 的入口和 exit 0/1/2 调用习惯，内部以影子模式逐步比较新 Planner。`scripts/eb3-impact.mjs` 最终复用同一核心规则，不再形成第二套影响面权威。

#764 的 20/40 是 L0 *影响面不确定率* 而不是代码覆盖率；C1“kit driver=0 tests→determined”不可直接采用。

## 6. 性能与选择算法的验收

- 记录不同类别变更的 `selected_tests`、`UNKNOWN` 比率、Planner 墙钟及 L1 P50/P90；
- 在历史变更窗口和人为注入变更上影子对照现有 L1 测试集合；
- 针对非显式导入、Root config、删除/重命名测试、动态工具注册做负控；
- 第一阶段 L2 永远跑完整 census，因此 Planner 出错不会变成 L2 漏测；但仍必须修复 L0/L1 假通过。
