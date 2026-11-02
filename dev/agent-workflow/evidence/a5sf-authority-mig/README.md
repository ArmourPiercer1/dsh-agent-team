# a5sf-authority-mig — Alpha.5 Sandbox-First 机器权威迁移（2026-11-02）

本目录记录**当前合同六字段**从 `alpha5-tool-io-governance / as20261026r1` 迁移到
`alpha5-sandbox-first / as20261102r1` 的完整事务证据：发布、切换、校验与回滚。

## 1. 为什么迁移

用户 2026-11-02 裁决：旧 PR #346 的 Alpha.5 执行计划废止，旧 `alpha5-tool-io-governance`
执行架构大部分退役；新计划 = `docs/plans/memo/alpha5-sandbox-first-20261101/`（PR #531）。
机器权威必须指向**真实的当期计划载体**，否则 gate 校验的是已废止的合同。

## 2. 事务（唯一 Writer 规则）

1. **publish**：`node scripts/publish-authority.mjs check <draft>` → `publish <draft> --root .`
   写入不可变快照 `dev/engineering/authority-snapshots/as20261102r1.json`。
2. **switch**：`node scripts/switch-authority.mjs switch --root . --snapshot-version as20261102r1
   --expected-digest <snapshot digest> --expect-pointer-digest <old pointer digest>`；旧指针字节前置条件
   + 原子写 + 失败精确恢复。
3. **verify**：`node scripts/current-authority.mjs --print-baseline --root .` +
   `node scripts/ci-pr-gate.mjs --only graph-parse,state-freshness`。

## 3. 六字段取值

| 字段 | 值 |
|---|---|
| `phase_id` | `alpha5-sandbox-first` |
| `active_plan` | `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md` |
| `backlog` | `docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md` |
| `matrix` | `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` |
| `baseline` | 见快照（= #531 合入 master 的 squash commit，40-hex；本文件不复制，读取唯一入口 = 指针） |
| `baseline_collected` | 见快照（ISO8601Z） |

## 4. 回滚

`git revert` 本 PR 的 switch commit set（`docs/STATUS.md` / `AGENTS.md` / `graph.yaml` /
指针与快照文件同一变更集），即可回到 `as20261026r1`；快照文件本身不可变、保留在历史中。
回滚演练记录见 `ROLLBACK-DRILL.txt`（若已执行）。

## 5. 诚实边界

- P1 是**机制级**证据，逐工具验收 G2–G5 未开始，矩阵全 `NOT_WIRED`（见 `TOOL-ACCEPTANCE-MATRIX.md`）。
- 迁移只改**权威指向与文档身份**，不改产品行为；`CORE PATCH BUDGET = 0` 不变。
- `network=restricted` 仍为 `UNSUPPORTED`（无目的地粒度），不得在迁移中被读成已支持。
