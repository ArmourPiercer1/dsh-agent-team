# A2C-5 — Read Fingerprint：移除 omitted-limit 假等价 — 实施报告

> Task A2C-5（计划 §8；alpha.2 capability-completion 轮 Wave 2）。
> Status: **COMPLETE**（GREEN 全过，gate 全过，1–2 commits，未 push）。

## 0. PR Contract（计划 §13）

```text
Task ID: A2C-5
Base integration SHA: 9c9a9ff (INT_W1 = A2C-1 + A2C-4 merged; 工作起点 b96faf3 = 同 tip 的 W2 briefs commit)
Head SHA: <本 evidence commit（见 §3 第 2 行）；product state = 26e3543>
Allowed product files: canonical-operation.ts (read 投影/fingerprint 区) + canonical-operation tests + approval fingerprint mismatch regression tests (计划 §14)
Actually changed product files:
  - packages/runtime/operation-permission/canonical-operation.ts（read 投影区：effectiveReadWindow omitted→null identity + 模块头/常量文档）
  - packages/runtime/test/a2-canonical-operation.test.ts（既有 a2 suite 更新到新 identity 契约：T1 伪等价断言翻转 + offset 默认腿 + 新 fixture）
  - packages/runtime/test/a2c5-read-fingerprint.test.ts（新增：RED probes + §8.4 全矩阵）
Shared/single-writer files touched: MUST BE NONE —— NONE（graph.yaml / SESSION_ROUTER_LOG.md / p4t6 pin / package.json / pnpm-lock.yaml / dist / composition-shim 全部未动；dist 仅盘上 build 后已 git checkout 还原）
```

## 1. 修复内容

`effectiveReadWindow`（canonical-operation.ts）：`limit: limit ?? READ_LIMIT_DEFAULT` → **`limit: limit ?? null`**（omitted = null identity，投影携带 absence）；`offset: offset ?? READ_OFFSET_DEFAULT`（=1）**不变**（recon 确认 pinned upstream 固定语义）。显式值逐字保留；显式非正整数的 fail-closed 校验（`read-limit-invalid` / `read-offset-invalid`）逐字保留。`READ_LIMIT_DEFAULT = 2000` 常量保留导出（A2 public surface + a2 suite 引用），但不再代入投影（文档改为 DOCUMENTATION ONLY）。消费链（pre-execute-adapter / control service+types / permission-resolver / types+index）**零结构改动**——fingerprint 被 opaque 消费（T9 + a4a/a5a/a2c4 suites 全绿证明）。

结果：`read(file)` 与 `read(file, limit=2000)` 铸造**不同** fingerprint / 不同 control scope；旧 in-flight pending-ask 行自然 fail-closed 失效（计划可接受的 strictness 提升，主 Agent 裁决记录在案）。

## 2. 交付物

```text
new source/test files added = 1   （packages/runtime/test/a2c5-read-fingerprint.test.ts，395 行，10 tests）
expected scanner delta      = 1   （p4t6 filesScanned 692 → 693；pin 未改——主 Agent 单写）
```

## 3. Commit 列表

```text
26e3543  A2C-5: omitted read limit is a null identity in the canonical projection (plan §8.2)（src + tests，3 files：canonical-operation.ts + a2 suite 更新 + 新 a2c5 suite）
（本 evidence commit）  A2C-5: evidence — RED/GREEN logs, gate logs, recon ruling, report（dev/agent-workflow/evidence/alpha2-capability-completion/a2c-5/）
```

未 push。

## 4. RED 证据指针

- `red-run.log`（@ b96faf3 pre-fix；`git stash push` = "No local changes to save"——tracked tree 本就 pristine，probe 文件 untracked 留盘；文件 LOADS 干净）：
  - **T1 FAIL**：`expected 'sha256:841a4401…' not to be 'sha256:841a4401…'`（omitted == explicit-2000，伪等价存在）
  - **T6 FAIL**：`expected true to be false`（explicit-2000 attempt 消费 omitted 的 one-shot allow）
  - **T7 FAIL**：对称方向同样跨 identity 消费
  - 7 条 invariant 腿 pre-fix 全 pass（守卫"不得移动的身份"）
- `red-green-comparison.md`：逐 test RED→GREEN 对照。

## 5. Gate 结果表

| # | Gate | 结果 | 证据 |
|---|---|---|---|
| 1 | RED-first（pre-fix 判别性测试） | ✅ 3 probes FAIL（按契约）/ 7 invariants pass | red-run.log |
| 2 | focused vitest（a2c5 + a2 + a3 + a4a + a5a + a2c1 + a2c4 + h1a + h4 + h5 = 10 suites） | ✅ 270/270 | focused-gate.log |
| 3 | `node scripts/run-tests.mjs runtime`（plain-node 链） | ✅ FAIL 集与 A2C-1 @ INT_W1 同链基线 **1:1 相同**（10 个 harness-env 文件：a6a / bp1-blueprint-authority / bp1-dual-team-gate / bp1-red-glue-probe / d1-member-base-tools / d1-s6-remote-v3 6/14 / d1-team-ownership-index 5/16 / d2-s6-ensure-root-live 5/10 / d3 / d5 2/9——shim 受限 matcher / paths.mjs 解析 / async-it 类，均预存在）；本任务 7 个 op-perm suite 在 node 链全 PASS | runtime-node-suite.log（对照 a2c-1/gate-plain-node.log） |
| 4 | root vitest 全量（solo，baseline 对照） | ✅ **11 files / 21 tests = 基线 10/20 + p4t6 预期 delta 1/1**——零新增失败（逐文件 1:1 映射 baseline.md） | root-vitest-solo.log |
| 5 | p4t6 scanner（solo） | ✅ 预期 delta：filesScanned **693** vs pin 692（= +1，本任务唯一新文件）；9/10 pass（denylist 违规 = 0，新文件 scanner-clean）；pin 未改 | p4t6-scan.log |
| 6 | `pnpm --filter @dsh-agent-team/runtime run typecheck` | ✅ exit 0 | typecheck.log |
| 7 | `pnpm build` | ✅ exit 0；dist/composition-shim 已 `git checkout --` 还原（不入 commit） | build.log |
| 8 | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use` | ✅ PASS（0 findings；仅 INFO = upstream 自有 node-pty 第三方 patch） | zero-core-host.log |
| 9 | private-import 检查（C4 over packages/runtime） | ✅ C4b（upstream 私有 subpath）/ C4c（未解析 @deepseek-ai 范围）= **0**；本任务 3 个文件**零** `@deepseek-ai/*` import（唯一命中 = 既有 doc 注释）；578 条 C4a `private-relative-escape` = 本仓跨包相对 import 布局噪音（全树预存在，base 即有） | private-import-check.log |
| 10 | upstream test-use 复核 | ✅ porcelain 0 + HEAD `a66e470204`（运行前后两次） | 本文件 §7 |

## 6. Recon 裁决（计划 §8 授权）

`recon-ruling.md`：**offset 假设成立，无偏离**——pinned `a66e470204` `parseReadArgs`（tool-fs read.ts L57）：`offset === undefined ? 1`（固定 one-based 默认，schema 文档 "Defaults to 1"）→ offset 语义不变。`limit === undefined ? maxLimit`（L58）：omitted 实际值 = deployment `readLimit` 配置（默认 2000、可配置——index.ts L37 `z.number().default(READ_LIMIT)`）→ 旧投影代入 2000 = 伪等价；按 §8.2 改 null identity。`limit > maxLimit` 拒绝**不镜像**（deployment-private cap，§8.3 禁读；upstream 执行时拒绝，Team 层不铸造永不执行的调用的 authority）。

## 7. 偏差清单

| # | 偏差 | 说明 |
|---|---|---|
| D-1 | RED 步骤的 `git stash push` 为 no-op | 协议假设 RED 前有 tracked 编辑可 stash；本任务 RED 在 pristine tracked tree 上执行（GREEN 实现发生在 RED 之后），`git stash push` → "No local changes to save"，stash list 空，status 天然还原。协议意图（pre-fix tree 上跑 probe）完全满足。 |
| D-2 | 首次 root-vitest 为双 job 并发执行（node 链 + vitest 同时） | 并发下 `p6t1-parallel` 1 test 竞争性 flake（standalone 复跑 9/9 pass）；已 solo 重跑全量得到决定性基线对照（11/21 = baseline+p4t6 精确）。 |
| D-3 | `.tmp-t12a-b2-home/` 泄漏（我的并发 root run 的 t12a 模块级失败产物，17:52:45Z 创建） | 已 `rm -rf` 清除（本会话产物，可逆操作留痕于此）；从未入 commit。 |

无其他偏差；offset recon 未触发偏离条款。

## 8. Open risks

1. **旧 in-flight read pending-ask 行失效**（计划声明可接受）：滚动部署期间旧规则铸造的 omitted-limit 行在新代码下失配 → fail-closed（无错误扩大）。
2. **A2C-7（Wave 3）merge 冲突预测**：A2C-7 触及 canonical-operation.ts（matcher/resolveTarget 区 + 模块头）——与本任务的 read 投影区/模块头 read 条目可能有**上下文**重叠；A2C-7 base = INT_W2（含本任务 merge），rebase 后按 §2.4 规则处理，无语义冲突预期（subtree 是 resource 级 matcher，不触碰 window identity）。
3. 导出给下游的假设：read 投影 omitted = `limit: null`（fingerprint 内）；explicit identity 逐字节稳定；control one-shot scope key = (correlation, …, operationFingerprint)。

## 9. Security invariants（计划 §13 模板）

- zero effect on deny：是（deny lane 未动；cross-identity attempt = read-only `no-request` 阻断；T10 fail-closed 逐字保留）
- fail closed cases：是（非法显式窗口值 = typed failure；跨 identity = no-request，永不猜测）
- no core patch：是（zero-core PASS 0 findings；upstream 零改动，test-use 前后 pristine）
- no alpha.3/alpha.4 scope：是（diff 仅限 read 投影区 + 测试）
- H1/H4/H5 零回退：是（h1a 49/49、h4 10/10、h5 25/25、a3 28/28、a4a 28/28、a5a 50/50、a2c1 28/28、a2c4 11/11——fresh canonicalize per decision / end-cap / shell effect-identity 全保持）
