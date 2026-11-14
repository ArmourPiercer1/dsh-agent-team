# Agent Testing Infrastructure vNext — 工程基础设施目标架构（设计基线）

> Dated: 2026-11-14 · Status: **DRAFT / OWNER REVIEW / DESIGN ONLY**  
> 目标：dsh-agent-team 的持续测试、CI、Agent 安全契约及证据基础设施；面向后续 DSH 宿主，但不修改运行时代码。
> 本文档集是实施设计，不是已经生效的 CI Policy、已完成的 C2 验收或现有 Authority 的替代物。

## 0. 最重要的已确认决策

1. **每个 Ready PR 在合并前仍需完整 census**。不采纳 #762 的 B4（默认跳过）及 B5（默认移到 master 之后）作为当前合并门优化；下一轮先以构建缓存、按实测分析的分片和避免重复执行降低成本。
2. **Draft-first + 最终 head 一次 L2**。Draft 中允许多次便宜反馈；当前 Required contexts 恰好三个——`pr-gate`、`ci-required`、`pr-settlement-gate`——不变；合成 merge tree 与 fail-closed 聚合由 `ci-required` 内部实现，settlement/head 绑定由 `pr-gate` 里的 settlement job 实现——它们是不变量，不是 context，也不新增 context。
3. **测试代码自动发现，关键契约显式声明**。不新建一个维护所有测试文件路径的第二权威名单；普通单元测试由既有 Vitest / node:test 收集。对测试仪器也要验证其可信度，绝不将 `evidence-only` 等价为零测试已覆盖。
4. **Agent 行为测试尽可能确定性**：通过 Scripted Model 将外部模型决策固定，同时保留真实 DSH 工具路由、审批、执行器及独立副作用观测。真实模型评估属于单独的质量维度。
5. **不以 CI PASS 代替 Candidate C2**；不以 PASS 字符串代替执行证据；不得借本工程项目变更产品 Authority、Candidate 或 v0.1.6 发布。
6. **工程复杂度必须净减少**：新检查器若接管旧机制，必须给出唯一权威、旧机制退役与净成本评估；不再向 manifest/YAML/脚本加入相互复制的测试文件列表。

## 1. 文档导航（每篇各自可独立 review）

| 文档 | 解决的问题 |
| --- | --- |
| [01-DECISIONS-AND-SCOPE.md](01-DECISIONS-AND-SCOPE.md) | 基线数据、当前决策、不做清单和范围 |
| [02-ARCHITECTURE-AND-AUTHORITY.md](02-ARCHITECTURE-AND-AUTHORITY.md) | 七个职责、权威源、信息流与信任边界 |
| [03-TEST-CATALOG-AND-CONTRACTS.md](03-TEST-CATALOG-AND-CONTRACTS.md) | 自动测试发现、契约登记、schema、失效逻辑 |
| [04-IMPACT-PLANNER-AND-TIERS.md](04-IMPACT-PLANNER-AND-TIERS.md) | L0–L3、受影响测试选择、UNKNOWN 升级 |
| [05-SCRIPTED-MODEL-AND-ORACLE.md](05-SCRIPTED-MODEL-AND-ORACLE.md) | Mock 边界、真实执行链、安全 Oracle |
| [06-WORLD-FACTORY-AND-FAULTS.md](06-WORLD-FACTORY-AND-FAULTS.md) | 实例隔离、崩溃窗口、并发/恢复 |
| [07-CENSUS-SHARDING-AND-AGGREGATOR.md](07-CENSUS-SHARDING-AND-AGGREGATOR.md) | 全量 census 不降级的分片与聚合契约 |
| [08-BUILD-CACHE-AND-PROVENANCE.md](08-BUILD-CACHE-AND-PROVENANCE.md) | 环境分层、缓存身份、信任与复现 |
| [09-RESULTS-EVIDENCE-AND-RELEASE.md](09-RESULTS-EVIDENCE-AND-RELEASE.md) | Result/Policy/C2 边界、证据格式 |
| [10-GITHUB-ACTIONS-INTEGRATION.md](10-GITHUB-ACTIONS-INTEGRATION.md) | 兼容现有 3 个 Required contexts 的迁移方案 |
| [11-MIGRATION-AND-ACCEPTANCE.md](11-MIGRATION-AND-ACCEPTANCE.md) | M0–M6 可拆独立 PR、验收与回滚 |
| [12-INVARIANTS-AND-NEGATIVE-CONTROLS.md](12-INVARIANTS-AND-NEGATIVE-CONTROLS.md) | TINF 不变量、反例测试与定义的非保证 |
| [13-REFERENCES-AND-RECONCILIATION.md](13-REFERENCES-AND-RECONCILIATION.md) | 外部工程参考与仓库历史 PR 协同 |

## 2. 当前基线（只作历史测量，不冒充长期目标）

参照仓库 PR #759–764，2026-11-13 样本：Draft CI 墙钟中位约 2m18s；Ready CI 约 23m55s；长尾主要是 ci-census。#764 报告 40 个提交中 20 个对 L0 选测为 undetermined（这 **不是** 50% 代码覆盖率）。#761 的 `git --numstat` 新增行数误标为字节数，其“每 PR 证据 KiB”统计必须重算，不能用于实施体积上限。

[PR #530](https://github.com/ArmourPiercer1/dsh-agent-team/pull/530) 的 uncollected-test gate 尚有可复用内容；[PR #765](https://github.com/ArmourPiercer1/dsh-agent-team/pull/765) 是未来工具执行架构，不与本测试工程平面合并授权。上游宿主 0.2.0-rc.2 的当前 pin 与目标 DSH 0.2.2 的适配测试分开报告。

## 3. 开发执行总原则

- 文档 PR 必须保持 Draft、DO-NOT-MERGE；没有代码、workflow、分支保护或 Candidate/Authority 修改。
- 后续每一实施 PR 必须声明基线 SHA、所实施的不变量 ID、显式未覆盖范围、负控、执行计划和回滚。
- 所有优化先量化、再影子对照验证、最后切换；性能提升不得来自遗漏必需测试。
- 出现冲突：当前仓库受保护的正式政策与现行机器合并门优先；本设计仅形成目标合同。
