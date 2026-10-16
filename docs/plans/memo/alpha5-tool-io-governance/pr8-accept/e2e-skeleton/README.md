# PR8 E2E 测试骨架（候选态 · 目录约定 · 无断言实现）

> **状态：SKELETON。** 本骨架只钉三件事：①kit 形状（`kit-shape.mjs`）、②套件登记与矩阵/负例的引用关系（`suites/registry.mjs`）、③最终归位与运行环境的目录约定（下文）。**不含任何断言实现**；`run: null` 即"实现归 PR8 正式轮"。

## 1. 最终归位（目录约定）

| 项 | 约定 | 依据 |
|---|---|---|
| kit 正式位 | `tests/kits/alpha5-pr8-e2e/`（tracked，从 `tests/paths.mjs` 取路径，**禁硬编码基线代次**） | TEST_METHODS §4.1、AGENTS.md `tests/` 行 |
| 任务专属证据 | `dev/agent-workflow/evidence/alpha5/pr8/<commit>/`（PR-local） | 计划 §12 (evidence 落位) |
| DSH 源码 | `tests/deepseek-harness-test-use`（pristine，porcelain=0 前后必查） | TEST_METHODS §1/§3 |
| DSH_HOME | `tests/homes/alpha5-pr8-<UTC时间戳>`（临时世界）；teardown 删除，保留必登记 | TEST_METHODS §7 |
| 端口 | `3180` 族（真实 Host 场景沿 stage2b 的 :3185 隔离 world 模式）；**禁 :3080** | TEST_METHODS §1；INTERFACES |
| 宿主基线 | 一律运行时读 `tests/paths.mjs`（`DSH_BASELINE_VERSION`/`TEST_USE_BASELINE_SHA`/`CLIENT_COMMIT_HASH`） | AGENTS.md |
| 衍生来源 | stage2b（run-2026-10-15T22-44-01）/ h6（18/18）/ 10-landlock-lanes / 09-lane 回环 **按需改造且保留 PoC 原始记录**（KIT 断言可更新、原始工件不动） | COORDINATION 审查/回归协议；SUP-09 纪律 |
| 熔断 | storm fuse（oracle 修正 + fuse>300）继承自 SUP-16；token 采集即脱敏 | SUP-16；INTERFACES |

## 2. 本骨架目录

```text
pr8-accept/
├─ README.md                                 本 lane 总说明
├─ ADR-CANDIDATE-blueprint-schema-vnext.md   ① schema ADR 候选
├─ migration-negative-cases.json             ② 迁移负例（33 例，未接线）
├─ acceptance-matrix.json                    ③ 验收矩阵骨架（32 行）
└─ e2e-skeleton/
   ├─ README.md                              本文件
   ├─ kit-shape.mjs                          kit 形状占位（无断言）
   └─ suites/registry.mjs                    套件登记（run:null 桩）
```

## 3. 套件 ↔ 验收关系（登记语义，非断言）

- 每套件在 `suites/registry.mjs` 声明：`ownerPr`、`matrixRows`（③ 行 id）、`negativeCases`（② case id 子集，仅 70 套件消费负例表）、`evidenceTypes`（③ 词汇表内）。
- **矩阵行覆盖自检**（PR8 正式轮机检项，届时实现）：③ 的每条 M-xx 的 `pr_stages` 至少被一个套件 `matrixRows` 覆盖；② 的每个 reject case 必须落为某套件负例。
- 断言实现的四条红线（届时不得违反）：不把 Preview 呈现当 OS syscall 证据；不以 fixture PASS 抵真实 Host 门；UNSUPPORTED 行必须断言"运行时确实拒绝"；性能只测不阈（S0 §4 冻结方法，PR8 测值入发布判断）。
