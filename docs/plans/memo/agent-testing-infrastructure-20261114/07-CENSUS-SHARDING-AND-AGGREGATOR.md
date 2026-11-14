# 07 — 完整 Census 的分片、聚合与不降级证明

[返回索引](README.md) · [分层](04-IMPACT-PLANNER-AND-TIERS.md) · [GitHub Actions](10-GITHUB-ACTIONS-INTEGRATION.md)

## 1. 绝对不变量：分片不改变验证总体

当前 CI 中 `census-runtime.yml` 需要真实 Host，在完整验证中有九个 root、两轮 capture。新实现必须以 **当前 census 的权威执行清单** 枚举全部任务，不能仅根据旧报告中的 702 文件 / 9167 tests 硬编码数量，也不能假定两次 capture 可以无损并行。

设完整任务 ID 多重集为 C，某次执行生成 S1..Sk。每个任务具有唯一 `task_id`（包含 root、capture 及必要的依赖/环境隔离维度）。对当前被批准为可并行的任务，要求：

~~~text
multiset_union(S1..Sk) == C
no task omitted
no unintended duplicate
every required task yielded terminal result
all result identities == plan identities
~~~

若 capture 共享 World、阶段状态或必须按顺序观察，整个相依组作为一个不可拆 TaskGroup 放入同一 shard。并行是执行布局变化，不是合同强度变化。

## 2. Plan 准备

独立的 `prepare-census-plan` 从当前测试发现/环境要求生成：
- 合成 merge tree、Host pin、Product build digest、Catalog/Policy/Plan digest；
- root、capture、task ID、所属互斥组及资源预算；
- 每条任务的执行 command/runner（现有工具产生，不从文档手输）；
- 估计历史耗时（仅用于负载均衡，不影响选择总体）；
- 计划签名/哈希及格式版本。

在每个 shard 上执行前校验 plan digest，若 plan 与当前合成树变化则拒绝。

## 3. Shard 策略

初期对比 1 / 2 / 4 路分片，并记录 wall、runner-minutes、缓存命中、宿主启动数。优先按耗时和互斥资源均衡，而不是盲目把测试文件均匀切分。每个 shard 获取独立 World（可共享只读 Host build），不得有端口/数据库串用。

GitHub Actions matrix `fail-fast: false` 用于在一个 shard FAIL 时保留其余结果；所需 shards `continue-on-error: false`。job 出错时仍上传部分诊断 artifacts，但不能通过任务汇总洗白失败。

## 4. 聚合结果格式（建议）

~~~json
{
  "schema": "census-summary/1",
  "identity": {
    "merge_tree_sha": "<sha>",
    "host_sha": "<sha>",
    "plan_digest": "<digest>",
    "catalog_digest": "<digest>"
  },
  "expected_task_ids": ["<task-a>", "<task-b>"],
  "observed_task_ids": ["<task-a>", "<task-b>"],
  "shards": [
    {"id": 1, "status": "COMPLETED", "artifact_digest": "<sha256>"},
    {"id": 2, "status": "COMPLETED", "artifact_digest": "<sha256>"}
  ],
  "census_verdict": "PASS"
}
~~~

原始结果需逐 task 具备 `PASS/FAIL/INCOMPLETE/INFRA_ERROR/CANCELLED` 的终态及原始引用。Aggregator 不能只看 shard exit 0 或 README PASS 字样。

## 5. Fail-closed 判定顺序

1. 校验 Aggregator 自身使用的受信 Policy 与计划摘要。
2. 校验每个 plan task ID 唯一、所有 shard 清单和 artifacts 可解析且未缺失。
3. 校验每个 result 的 `merge_tree/host/plan/catalog/build` 身份完全一致。
4. 校验预期 task ID 多重集与观察结果一致、每个任务有终态。
5. 校验所有必需 Oracle 合同结果都可判定且通过。
6. 任一失败/超时/取消/环境拒绝不绿；全部通过才产生 PASS。
7. 聚合结果作为 **ci-census** 的唯一执行汇总。实际消费路径是：census job 输出 layer verdict token，`ci-required` 的 `eb3-ci-required.mjs` 按 job 结果与 `needs` 判形（`eb3-merge-tree.mjs --grade-needs`），**不存在**一个被聚合器写入、再由 `ci-required` 读取的 aggregate artifact；若未来需要该 artifact，必须显式改 manifest 形状并过负控。Aggregator 本身不成为独立分支保护权威。

## 6. Shadow 对照迁移

- 第一步只加入 step profiling，不修改旧判定；保留当前完整 census。
- 第二步在可隔离的测试条件/独立非合并影子工作流中运行新 planner + shards，不让影子结果决定合并。
- 第三步对同一合成树、相同 Host、相同样本计划比较旧完整 census 与新汇总的 task 集合和 Oracle 结论。
- 第四步注入故意删 shard、重复 task、错误 SHA、失败但 exit 0、文件被截断、错误 Host、遗漏第二 capture 等负控。
- 第五步只有在新聚合语义经过严格对照审查后，才替换现有 ci-census 的内部执行，不改变 Required context。

不承诺线性缩短到 6 分钟；L2 P50≤10min 为测量目标。性能改善不能通过减少 C 或失去独立 World 获得。
