# TINF M1 — 转录（2026-11-14）

配套说明：`docs/plans/memo/tinf-m1-catalog-20261114/README.md`。
全部文件是工具原样输出（stdout/stderr），未手工改写数字。均为 `.txt`，新增 `.json` = 0（证据配额 6000 只剩 5）。

| 文件 | 是什么 |
| --- | --- |
| `m-catalog.txt` | 严格模式：825 个测试、722 collected、91 uncollected → exit 2 |
| `m-catalog-ratchet.txt` | CI 用的 `--max-uncollected 91`：已知集合允许，增长拒绝 → exit 0 |
| `m-catalog-diff.txt` | 双向差集：`ci_named=49`、`node_unnamed=85`（其中 uncollected 80）、`vitest_via_config=673`、`ci_only=0` |
| `m-catalog-digest.txt` | 同一 head 两次 `--json` 的 digest 相同 |
| `nc-m1-1-contract-test-deleted.txt` | 合同绑定的测试路径不存在 → `CONTRACT_UNKNOWN_TEST`（exit 2） |
| `nc-m1-2-duplicate-id.txt` | 两个测试抢同一逻辑 id → `DUPLICATE_ID`（exit 2） |
| `nc-m1-3-stale-exclude.txt` | 排除表指向不存在的文件 → `STALE_EXCLUDE`（exit 2） |
| `nc-m1-4-missing-driver.txt` | 登记了不存在的 instrument driver → `INSTRUMENT_DRIVER_MISSING`（exit 2） |
| `nc-m1-5-uncollected-grew.txt` | 新增一个没 lane 的 suite → 92 > 91 → `UNCOLLECTED_GREW`（exit 2） |

## 未覆盖

- “是否被收集”是**静态判定**（配置 include/exclude + 显式清单），不是“这次真的装载成功”。原生 `vitest list --json` 需要安装依赖与构建，留给 M5 的 dispatch。
- `--diff` 的 `ci_only` 角度只覆盖“lane 点名了发现不到的文件”；反方向（发现到但没 lane）由 `TEST_UNCOLLECTED`/棘轮负责，不重复计数。
- 没有验证 6 条合同的测试真的能捕获对应语义变异——那是 M2 的 mutation/oracle 工作；这里只保证绑定存在、可追、删不掉而不报错。
