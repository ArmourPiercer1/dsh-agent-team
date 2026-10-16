# PR8 提前件（Lane G · C-VNEXT 契约 owner）— 候选与骨架

> **状态：CANDIDATE / DORMANT。** 本目录全部为**候选态文件**：schema ADR 是 PR8 正式 Schema ADR 之前的候选记录，负例集**未接任何运行器**，验收矩阵是 PR8 机器可读矩阵的**骨架权威**（启用/整体验收在最后，见下）。**v3 生产文档与本目录之外的一切既有权威文档零改动**（INTERFACES-v1 C-VNEXT 条款）。

- **Lane**：Alpha.5 PR8 提前件 · writer = Lane G（qwen3.8-flash-next；模型/harness 分列）
- **分支/worktree**：`alpha5-pr8-accept` @ `.worktrees/a5-pr8`，baseSHA = `db5cb5f7dda80ab85a2e1e31ed56b2a43ff5d1ef`（=origin/master 固定基线）
- **契约依据**：`dev/agent-workflow/evidence/alpha5/INTERFACES-v1.md` §C-VNEXT —— ①字段映射**默认拒绝**、无隐式默认；②v3 生产文档不改；③**机器可读验收矩阵 = PR8 骨架权威**。
- **上游权威序**：S0 矩阵 → 设计（post-poc-technical-design.md）→ ADR §8 / Architecture §14 → S0+PR0–PR8 计划 §11/§12；协调事实 = `dev/agent-workflow/evidence/alpha5/COORDINATION.md` + `DECISION-PACK-20261016.md`（协调者维护，只追加）。

## 交付物

| # | 文件 | 性质 |
|---|---|---|
| ① | [ADR-CANDIDATE-blueprint-schema-vnext.md](./ADR-CANDIDATE-blueprint-schema-vnext.md) | Schema vNext 候选决策（字段映射默认拒绝 + vNext 对象模型对齐），逐条含备选与被拒理由；**不是**正式 Schema ADR（计划 §11 要求 PR8 落正式 ADR） |
| ② | [migration-negative-cases.json](./migration-negative-cases.json) | 机器可读迁移负例清单（旧字段 / 隐式默认 / 未知枚举 / 错误版本 / 迁移扩权五类）；**先成 JSON 表，不接运行器** |
| ③ | [acceptance-matrix.json](./acceptance-matrix.json) | 机器可读验收矩阵骨架：S0 `M-01…M-14` × `SUP-01…SUP-18` 共 32 行 × PR 阶段 × 证据类型 × 当前状态；含已知 partial（M-12/M-06/M-01/02/03/14 待 PR1r 落地更新，`pending_update` 字段留位） |
| ④ | [e2e-skeleton/](./e2e-skeleton/README.md) | E2E 测试骨架：kit 形状占位（`kit-shape.mjs`）+ 目录约定 + 套件登记（`suites/registry.mjs`），**不含断言实现** |

## 边界与启用条件（全部满足前本目录内容不得当作已裁决）

1. **启用时机**：PR8 正式 Schema ADR + 产品级总 Gate 轮（计划 §11）；在此之前 `schemaVersion: 3` 且字段封闭不变，v3 文件格式/生命周期不改。
2. **PR1r/PR2 依赖**：矩阵 6 行 partial 的更新由 PR1r（#257，B3=用户裁决方案 (ii)）修复轮与 PR2（#256）合并序落地后驱动；本 lane 只留字段不代填。
3. **不宣称验证**：本 lane 无端口、不起服务、不跑宿主；任何"对 fixture/骨架验证"的表述也不得扩张为"整链已验证"（INTERFACES 集成规则）。
4. **共用文件零触碰**：根 registry、live glue、tsconfig、barrel、scanner、`packages/**`、`tests/kits/**`、既有 memo 权威文档均不在本 lane 写集内；E2E 骨架最终归位（`tests/kits/`，TEST_METHODS §4.1）属 PR8 正式轮。
