# U9 — 全量测试与失败分类（0.1.5-rc.2 → 0.1.7-rc.1）

任务来源：`docs/plans/active/dsh-agent-team-0.1.7-rc.1-upgrade-plan.md` §12。
执行：2026-09-24，worktree `.worktrees/dsh-017rc1-upgrade`（U0–U7 已 commit；U8 并行执行中）。

## 升级前 baseline（master @ dc6fb6f，0.1.5 图；U0 记录）

来源：`dev/agent-workflow/evidence/dsh-017rc1-upgrade/baseline-canonical-dc6fb6f.log`

```text
Test Files  10 failed | 305 passed (315)
     Tests  20 failed | 3817 passed (3837)
```

失败文件集（10）：

| # | 文件 | 失败测试数 | 形态 |
| --- | --- | --- | --- |
| 1 | packages/domain/test/t1-capability-schema.test.ts | 9 | 测试级 |
| 2 | packages/domain/test/t2-blueprint-hash.test.ts | 1 | 测试级 |
| 3 | packages/legacy/test/p7t6-teammates-adapter.test.ts | 1 | 测试级 |
| 4 | packages/runtime/test/p6t3-mediation.test.ts | 5 | 测试级 |
| 5 | packages/runtime/test/p6t3-restart.test.ts | 2 | 测试级 |
| 6 | packages/tools/test/p6t6-actions.test.ts | 1 | 测试级 |
| 7 | packages/runtime/test/d3-member-identity-context.test.ts | 1 | 测试级 |
| 8 | packages/runtime/test/p8s3b-result-effects.test.ts | 0 | 文件级（agentPresets service absent from glue deps —— 该套件需要真实 glue 环境） |
| 9 | packages/runtime/test/t12a-b2-child-identity.test.ts | 0 | 文件级（同上环境类） |
| 10 | packages/runtime/test/t12a-glue-handoff-ports.test.ts | 0 | 文件级（同上环境类） |

## 升级后全量（0.1.7 图，U2–U7 全部改动 + U8 期间无新增提交）

来源：`scratch-logs/dsh-017rc1-root-test-u9-final.log`（root `vitest run`，316 文件）

```text
Test Files  10 failed | 306 passed (316)
     Tests  20 failed | 3822 passed (3842)
```

client 包独立套件（不在 root 套件内）：`scratch-logs/dsh-017rc1-client-test-u9-final.log`

```text
Test Files  47 passed (47)
     Tests  649 passed (649)
```

## 集合差分

```text
baseline 失败文件集 F0 = {上述 10 文件}
post    失败文件集 F1 = 同一 10 文件（逐文件相同；逐测试名相同）
F1 − F0 = ∅        → 零新增失败
F0 − F1 = ∅        → 零"消失"的失败（无隐藏修复掩盖）
测试总数 3837 → 3842 = +5（U6 新增回归套件 u6-mcp-017-regression 的 5 个测试，全绿）
```

## A–D 分类（plan §12.1）

| 类 | 集合 | 裁决 |
| --- | --- | --- |
| A. PRE_EXISTING | **全部 10 文件 / 20 测试** —— 升级前 master 已失败、升级后同样失败，逐测试名相同。三个文件级环境类（#8–10，需要真实 glue 宿主环境，root vitest 下按设计不可运行）+ 七个测试级（t1 9、t2 1、p7t6 1、p6t3-mediation 5、p6t3-restart 2、p6t6 1、d3-4 1） | 本轮不修（计划明示"当前仓库已有已知 test debt"） |
| B. UPSTREAM_BASELINE_DRIFT | **∅** —— 零个 0.1.7 驱动的测试失败漂移（0.1.7 的会话 V4 / preset / slot / spill 变化全部在 U2–U6 内以代码+测试适配完成，未落入失败集） | 无需处理 |
| C. REAL_COMPAT_REGRESSION | **∅** —— 零新增失败 ⇒ 无 production 路径真坏信号（且 U8 实宿主垂直为最终 authority） | 无需处理 |
| D. SESSION_RESUME_FOLLOW_UP | **∅（实测无失败）** —— U8 V8 六次运行全部 PASS：host 停止 + 同 profile fresh reboot 后旧 Team 以 strict load-only 重新 adopt（durable TeamSession 加载成功），session 日志全部 V4 命名（`v8-reboot/`，`vertical-summary.md` (b)/(f)）。按 plan §17 仍单列登记为 follow-up F1（**不得声称 B/B+ resume 架构问题已解决**——本轮仅证明 0.1.7 下 fresh Team 主路径与 load-only re-adopt 正常；完整 session-resume 重分析待 U3 0.1.7 重新基线，见 F1/F6-10） | 已登记，本轮不修 |

**G7 判定：无"原因未知的新失败"。** 每一处 0.1.7 图变化要么在 U2–U7 内闭环（适配 + 回归证据），要么被 U8 实宿主垂直裁决。

## Review-supplement 轮 delta（2026-09-25，PR29 review F1–F3 修复轮）

- 测试总数 3842 → **3856** = **+14**（compat 套件 `plugin-dsh-compat.test.ts` 7 + client mount F2/F3 T1–T4 + R1–R3 共 7；client 独立套件 649 → 656）。
- 确定性底（serial 全量 + standalone + 逐包）= **10F|20F|3836P(3856)**，失败集与 F0 逐文件/逐测试名相同（`F1' − F0 = ∅`、`F0 − F1' = ∅` 保持；`review-supplement/static-gates.log` 含逐文件清单）。
- **类 E（本轮新增类别：新暴露的既有不稳定）**：`p6t1-parallel.test.ts`（9 测试，PRE_EXISTING 文件）在 supplement 状态下全量**并行**跑约 40% 间歇失败（`compatibility … (reprobe-failed) … admission fails closed (invariant 50)`）。归因 = 插件自身 compatibility admission 链的**既有并发竞态**（per-request authority → per-prober `withLock` 不覆盖同 root 并发 probe → `replaceState` delete/put/advanceGeneration 交叠 → probe reject → fail-closed），触发器 = 本轮 +14 测试在 vitest `pool:'threads'`（全文件同进程共享事件循环）下扩大调度窗口；**排除**新 lockfile 再解析（隔离行"新 node_modules + 基线源码" 2/2 PASS + 共享 peer 无模块实例分裂）与 OS 负载（基线 +16 核 `yes` 2/2 PASS）。完整 7 行 A/B 矩阵 + 源码级机制 + 建议修复（per-root re-probe 序列化，超本轮文件范围 → follow-up F7-1）→ `review-supplement/p6t1-flake-attribution.md`。
- 其余 10 文件 / 20 测试 PRE_EXISTING 集**未扩张**；B/C/D 裁决维持（supplement 零 production 行为回归信号）。

## 过程中的环境性失败（非图漂移，留痕）

1. **client 包 devDeps 缺口暴露（U6 全量首跑）**：published `dsh-client-store@0.1.7-rc.1` lib import zustand/immer 但 `dependencies` 为空（upstream 打包 quirk，upstream 源码把两者放 devDependencies；真宿主 app 壳自带）。client 包 vitest（redirect 到 test-use 源码）此前无感；root config 走发布件 → 4 个 client .test.ts 文件级 import 失败。修复 = client devDeps 加 `zustand ~4.4.7` + `immer ^10.1.1`（commit d09c010；post-upgrade follow-up：upstream 打包面）。
2. **a2c7 pinned lib 环境耦合（U8 前置清理暴露）**：`a2c7-subtree-matcher.test.ts` 的 REAL 段解析 **test-use checkout 的预构建** `packages/fs/fs-local/lib/index.js`（pinned 权威 `FileSystem.contains()`）。test-use 构建产物被清理时该文件短暂缺失 → 9 测试失败（`REAL.available=false`，按设计降级但断言失败）。test-use 完全重建后复跑 → 10F|20F 复原。留痕：root 套件隐含"test-use 已构建"前提（baseline 测量时该前提成立）；post-upgrade follow-up（test-infra：a2c7 对宿主树构建状态的依赖应显式化）。
3. **test-use checkout 跨代构建残留（U8 前置暴露）**：checkout 在预 checkpoint 状态残留了**另一代树**的构建产物（孤儿 `packages/settings/settings-file/` 目录 + stale 根 `lib/types/` typert 产物，引用 0.1.7 已移除的 `SettingsProvider`）→ 两次构建失败。`git clean -fdx` + 全新 `pnpm install --ignore-scripts`（workspace 内 store：pnpm 全局 store 在沙箱只读区 → EROFS，先例 = git-install-boot.mjs 的 XDG 重定向）+ 重建 → INSTALL_EXIT:0 / BUILD_EXIT:0，pristine 复原。留痕：post-upgrade follow-up（test-infra：test-use 换基线时必须完全重置，不能只 git checkout）。

## 终态 proof

- **zero-core**（最终 commit 集上复跑）：host-only `verify-zero-core.mjs --host tests/deepseek-harness-test-use` → **PASS exit 0，0 findings**（`scratch-logs/dsh-017rc1-u9-zerocore-hostonly.log`）；9 包 C4 扫描 1031 findings 全部 `private-relative-escape`、**0 解析进 host 树**（1030 仓内 sibling 导入 + 1 p8t3 合成负例控制串；无 C1/C2/C3/C4b/C4c/C5）。
- **test-use pristine**：U8 每 leg 后复核 + U9 终核（HEAD 46a7f68b09、porcelain 空）——U8 报告回填。
- **G1 版本一致性**：test-use == 46a7f68b09；全部 `@deepseek-ai/dsh*` 直接依赖 == 0.1.7-rc.1（9 包 manifest 扫描：0 个 0.1.2/0.1.5 pin）；`@deepseek-ai/cordis-plugin-*` 3 个 devDep（1.0.4/1.0.9/1.0.5）属独立 cordis loader 家族（非 dsh 发布族，0.1.5 图同版本，升级未动）。
