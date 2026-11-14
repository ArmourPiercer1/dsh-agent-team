# 03 — Test Catalog 与 Critical Contract Registry

[返回索引](README.md) · [Planner](04-IMPACT-PLANNER-AND-TIERS.md) · [不变量](12-INVARIANTS-AND-NEGATIVE-CONTROLS.md)

## 1. 三维属性：Purpose / Environment / Tier

- Purpose：`unit`、`contract`、`integration`、`e2e`、`resilience`、`evaluation`。
- Environment：`E0` 纯函数/进程内、`E1` 隔离进程+受控服务、`E2` 真实 DSH + Mock LLM、`E3` 真实 DSH + 真实模型或外部服务。
- Tier：`L0` 本地、`L1` Draft、`L2` Ready 合并前、`L3` 合并后/定时。

这三个维度严格正交。E2 不自动等于 L2；某条安全合同可以由 E0 的快速测试与 E2 的真实端到端测试共同验证。

## 2. 发现流程

1. 在固定合成树中通过原生 Vitest 收集命令（核对当前 Vitest 版本下 `vitest list --json` 的实际输出）得到 package 测试。
2. 通过 `git ls-files -z` + 明确的文件命名规则发现 `node:test` 文件；与既有显式列表做差集，避免新增文件被遗漏。
3. 为无标准 `.test.*` 命名的 `tests/kits` 和 World Factory driver 保留少量显式“可执行测试仪器”登记及对应自身 contract tests。
4. 读取关键契约表，检查每个 mandatory contract 至少绑定明确的测试集合，不用测试总数来替代覆盖承诺。
5. 生成一个带 `catalog_digest` 的可再生 artifact；不提交生成索引为新的权威文件。
6. 预先执行收集负控：新增未收集测试、删除必需测试、未经批准排除测试，均不得报告绿色。

**重要迁移**：仓库 PR [#530](https://github.com/ArmourPiercer1/dsh-agent-team/pull/530) 已实现/提出 node:test 未收集的负控与豁免表。M1 必须先检视它的代码和覆盖边界，优先延伸而非平行重写，不可让两套名单成为永久权威。

## 3. 建议的最小测试条目（生成物，非全部手写）

~~~json
{
  "schema": "test-catalog/1",
  "catalog_digest": "sha256:<digest>",
  "tests": [
    {
      "id": "approval.identity-binding",
      "path": "packages/domain/test/approval-identity.test.ts",
      "runner": "vitest",
      "kind": "contract",
      "environment": "E0",
      "contract_ids": ["AUTH-01", "REVIEW-01"],
      "critical": true,
      "resources": [],
      "estimated_cost": "short"
    }
  ],
  "instruments": [
    {
      "id": "census-runtime",
      "driver": "tests/kits/<kit>/run.mjs",
      "contract_tests": ["tests/kits/<kit>/driver.test.mjs"]
    }
  ]
}
~~~

上例中的 ID、文件路径、测试数量均为示意，需由执行端从仓库事实导出。`id` 不应仅由易变化文件路径生成；测试移动时若语义不变，应保留逻辑 ID，冲突 ID 拒绝。

## 4. Critical Contract Registry

仅安全关键合同显式登记，例如：
- `AUTH-01`：一次执行主体/Realm 身份必须明确且与授权绑定；
- `EXEC-01`：未授权请求不产生对应真实副作用；
- `REVIEW-01`：审批不能跨 Request/Execution identity 复用；
- `LIFE-01`：Sticky Stop 后无显式人工恢复就不能新调度；
- `RECOVERY-01`：崩溃恢复不得盲目重试副作用不确定的执行；
- `ISOLATION-01`：工具执行不得越过所声明的 OS/受信 service 限制。

建议记录字段 `id`、`scope`（工具/Realm/宿主）、`obligations`、`required_tiers`、`test_refs`、`witness_type`、`limitations`。不能用单个“critical=true”替代实际工具族覆盖矩阵。

## 5. 未收集与排除的精确定义

- `DISCOVERED_AND_COLLECTED`：runner 确认能装载该测试。
- `EXPLICIT_INSTRUMENT`：专用 kit driver 被登记并拥有仪器合同测试；是否执行由 Policy 决定。
- `EXCLUDED_WITH_REASON`：文件不应进入该 runner，并具备原因、复核触发事件和另一种覆盖责任。
- `UNCOLLECTED`：应当是测试却无法收集；必须拒绝。
- `UNKNOWN_CLASSIFICATION`：不能确定是测试还是工具；不允许转换为 `docsOnly` 或 `coverage=determined`。

排除不应只凭文档备注；应能被自动检查并审计。测试仪器具有真实逻辑，不能因为“只生成 evidence”而无需自测。

## 6. 自身负控

- 新建一个 `foo.test.mjs` 但故意不让 Node runner 收集，Catalog 必须拒绝；
- 删除一个关键合同唯一的测试，必须拒绝；
- 在合法排除表中写入不存在路径，要产生陈旧登记告警/错误；
- 同一个逻辑测试重复 ID、所属环境矛盾、测试计划引用不存在 ID，必须拒绝；
- 修改 kit driver 后，不能因 `selected_tests=0` 宣称影响已确定且充分验证。
