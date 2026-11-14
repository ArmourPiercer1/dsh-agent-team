# TINF M1 — 转录（2026-11-14）

配套说明：`docs/plans/memo/tinf-m1-catalog-20261114/README.md`。
全部文件是工具原样输出（stdout/stderr），未手工改写数字。均为 `.txt`，新增 `.json` = 0（证据配额 6000 只剩 5）。

| 文件 | 是什么 |
| --- | --- |
| `m-catalog.txt` | 严格模式：857 个测试、752 collected、91 uncollected → exit 2 |
| `m-catalog-ratchet.txt` | CI 用的 `--max-uncollected 91`：已知集合允许，增长拒绝 → exit 0 |
| `m-catalog-diff.txt` | 双向差集：`ci_named=49`、`node_unnamed=85`（其中 uncollected 80）、`vitest_via_config=703`、`ci_only=0` |
| `m-catalog-authoring-configs.txt` | 4 个 POC 套件的 `reason`：只被 `vitest.poc.config.ts`（authoring-only，无 lane 传 `--config`）包含 |
| `m-catalog-digest.txt` | 同一 head 两次 `--json` 的 digest 相同 |
| `nc-m1-1-contract-test-deleted.txt` | 合同绑定的测试路径不存在 → `CONTRACT_UNKNOWN_TEST`（exit 2） |
| `nc-m1-2-duplicate-id.txt` | 两个测试抢同一逻辑 id → `DUPLICATE_ID`（exit 2） |
| `nc-m1-3-stale-exclude.txt` | 排除表指向不存在的文件 → `STALE_EXCLUDE`（exit 2） |
| `nc-m1-4-missing-driver.txt` | 登记了不存在的 instrument driver → `INSTRUMENT_DRIVER_MISSING`（exit 2） |
| `nc-m1-5-uncollected-grew.txt` | 新增一个没 lane 的 suite → 92 > 91 → `UNCOLLECTED_GREW`（exit 2） |
| `nc-m1-6-json-not-a-verdict.txt` | `--json` 打印 artifact 但不得吞掉拒绝 → 植入 `CONTRACT_UNKNOWN_TEST` 后 exit 2 |
| `nc-m1-7-contract-ref-not-a-test.txt` | 合同绑到 `src/index.ts`（不是测试）→ `CONTRACT_REF_NOT_A_TEST`（exit 2） |
| `nc-m1-8-scratch-config-not-authority.txt` | 两个探针：根级 recorder 不被任何 config 包含且被根配置 exclude（`EXCLUDED_WITH_REASON`）；`evidence/` 下只被该目录 authoring 配置包含的 recorder → `UNCOLLECTED`（证据目录的配置永远不是权威） |

## 未覆盖

- “是否被收集”是**静态判定**（配置 include/exclude + 显式清单），不是“这次真的装载成功”。原生 `vitest list --json` 需要安装依赖与构建，留给 M5 的 dispatch。
- `--diff` 的 `ci_only` 角度只覆盖“lane 点名了发现不到的文件”；反方向（发现到但没 lane）由 `TEST_UNCOLLECTED`/棘轮负责，不重复计数。
- 三轮修的是同一类错误的三个方向：①按后缀取套件（漏 client 32 个 spec）；②只认默认配置名（看不见 POC/scratch 配置与它的仓库相对 glob）；③把所有 `vitest*.config.ts` 都当收集权威（authoring-only 配置可把根级 scratch recorder 说成 covered —— 过度声明）。最终规则：收集权威 = lane 实际跑的配置（默认发现），非默认配置只解释「为什么没被收集」，glob 相对基准由配置自身判定；三项各有回归测试与转录。
- 没有验证 6 条合同的测试真的能捕获对应语义变异——那是 M2 的 mutation/oracle 工作；这里只保证绑定存在、可追、删不掉而不报错。
