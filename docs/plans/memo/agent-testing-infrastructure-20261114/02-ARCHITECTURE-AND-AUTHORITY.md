# 02 — 目标架构、模块职责、信息流和唯一权威

[返回索引](README.md) · [Catalog](03-TEST-CATALOG-AND-CONTRACTS.md) · [Result](09-RESULTS-EVIDENCE-AND-RELEASE.md)

## 1. 逻辑组件不是七个新服务

~~~text
Git diff + source tests + contract declarations
      │
      ├─ Test Catalog (discover & normalize tests)
      └─ Impact Planner (dependency / contract closures)
              │
       Immutable Test Plan
              │
       Test Orchestrator
        ├─ Vitest/Node runner
        └─ Existing World Factory + Scripted Model + live host
              │                          │
       Test result events        Contract Oracle + independent Effect Witness
              └────────────┬─────────────┘
                    Result & Evidence
                            │
                       Policy Grader
                   ├─ CI Required status
                   └─ Release/C2 consumer (separate policy/authority)
~~~

建议主要在已有 `scripts/`、`tests/world-factory/`、`tests/kits/`、`dev/ci/` 中实现增量模块，而非一律引入新框架。

## 2. 责任 / 权威矩阵

| 组件 | 单一事实来源与输入 | 唯一输出 | 不得拥有的权威 |
| --- | --- | --- | --- |
| Catalog | 被当前合成树收集的测试源 + 少量关键契约配置 | 测试索引、未收集错误 | 不决定 PASS |
| Planner | diff、依赖图、Catalog、层级 Policy | 被选中任务、UNKNOWN 说明、plan digest | 不擅自放宽必需测试 |
| Orchestrator | 固定 plan + 环境描述 | 执行记录、任务终态 | 不改变断言与预期集合 |
| World Factory | 宿主 pin、World 资源配额 | 唯一 World 身份、实际启动/清理事实 | 不假造产品审批/执行状态 |
| Contract Oracle | 事件、独立副作用 witness、预定义合同 | 每条合同的满足/违反/不可判定 | 不授权真实执行 |
| Evidence | 验证身份、原始结果和内容哈希 | 可追溯、可校验 Run Record | 不据此自动发布候选 |
| CI Grader | plan 和一组完整结果 | CI PASS/FAIL/INCOMPLETE/INFRA_ERROR | 不代替 C2-A/B 人类/Agent 裁决 |

## 3. 五条信息流不变量

1. **源码不可被测试结果改写**：测试计划消费合成 merge tree，不由日志或 README 回写判断产品行为。
2. **生成 Catalog 不产生第二权威**：测试文件来自 runner 枚举，必须的关键契约来自小登记表；缓存和生成索引可丢弃重建。
3. **观察与执行分离**：Trace 只读记录真实事件，不可经 Trace 衍生另一套 Policy/Stop/Auth 状态源。
4. **策略与事实分离**：Test Result 不决定运行阶段；Planner/Grader 使用受信、版本化 Policy 对结果作判定，不可现场改写 FAIL。
5. **构建身份与运行身份分离**：共享 Host/Product immutable artifact，不共享 `DSH_HOME`、PTY、令牌、数据库、审批准入状态。

## 4. 信任域

- **Trusted policy**：受保护分支上冻结的判定法则、必须存在的关键契约及 CI 检查脚本；修改它们属于专门的门禁变更。
- **Under-test tree**：本次 PR 的合成合并代码与测试；执行它可能有副作用，必须运行在最低权限隔离 Runner/World。
- **External host**：固定 DSH commit 的宿主，先校验 sha/构建输入，再作为测试依赖使用。
- **Observed effects**：文件变化、进程状态、请求计数等独立可见量；不可信任产品自己宣称“DENIED”的文本。

不得在有高权限凭据的 Runner 上直接执行可由 PR 控制的代码或脚本；变更 CI Policy 时应使用受保护 Policy 对 PR 进行 self-change 检查，详见 [10](10-GITHUB-ACTIONS-INTEGRATION.md)。

## 5. 仓库映射

- 保留 `vitest.config.ts`、`scripts/ci-local.mjs`、`tests/paths.mjs`、`tests/world-factory`、`tests/kits`。
- 使 `scripts/eb3-impact.mjs` 和本地 L0 选测共享一份规则，不允许两套“影响面”互相矛盾。
- `dev/ci/eb3-ci-manifest.json` 逐渐只登记必需 CI 层、关键检查和合同，普通文件路径由 Catalog 自动发现。
- 不在本设计 PR 中实施以上变化；迁移必须遵守 [11](11-MIGRATION-AND-ACCEPTANCE.md)。
