# L2 独立 Review — upstream rc.1 兼容性适配提交 c6bae9c

- **Lane**：L2（独立 review 子代理，不与主 Agent 共享上下文；纯 review，零写入仓库工作树）
- **评审对象**：`c6bae9c8cee6b12bedfc34c71fabf9f0a73e7872`（branch `task/upstream-rc1-compat`，RC1 worktree 单笔）
- **仓库状态（评审前）**：RC1 worktree HEAD = `c6bae9c…`，porcelain 0；TU（`references\deepseek-harness-test-use`）HEAD = `76fda729799fe9b3848dbe2c211d4b231032b81e`，porcelain 0 —— 均与任务书一致
- **交叉核对基准**：`dev/agent-workflow/evidence/upstream-rc1-compat/compat-matrix.md`（builder 产物，下称「矩阵」）

---

## 1. 任务 1 — 独立 diff review

### 1.1 提交元数据

- 提交信息：`R122 compat(rc1): point harness build-pin at dsh 0.1.2-rc.1 (cd5ef814 -> 76fda72979)`
- 规模：**6 文件，+7/−7**（`git show --numstat`：legacy e2e run.mjs 2/2，其余 5 文件各 1/1）
- `git show --check c6bae9c`：**EXIT=0，无任何空白错误**（无行尾空白、无混用缩进、无意外格式改动）

### 1.2 hunk 清单与逐条判定

| # | 文件 | hunk 头 | 变更行 | 变更内容 | 判定 |
|---|---|---|---|---|---|
| H1 | `packages/legacy/session-reader/e2e/run.mjs` | `@@ -2,7 +2,7 @@` | L5 | 头注释 `pin cd5ef814` → `pin 76fda72979`（纯注释，与 H2 一致性） | ✅ 仅 pin/文档，无语义 |
| H2 | `packages/legacy/session-reader/e2e/run.mjs` | `@@ -56,7 +56,7 @@` | L59 | `const CLIENT_COMMIT_HASH = 'cd5ef814'` → `'76fda72979'` | ✅ 仅常量 pin |
| H3 | `packages/runtime/member-residency/harness/run.mjs` | `@@ -91,7 +91,7 @@` | L94 | 同上常量 pin | ✅ 仅常量 pin |
| H4 | `packages/runtime/root-binding/harness/README.md` | `@@ -58,7 +58,7 @@` | L61 | 文档 `DSH_CLIENT_COMMIT_HASH=cd5ef814` → `=76fda72979`（与 H5 一致性） | ✅ 仅文档，无语义 |
| H5 | `packages/runtime/root-binding/harness/run.mjs` | `@@ -66,7 +66,7 @@` | L69 | 同上常量 pin | ✅ 仅常量 pin |
| H6 | `packages/tools/harness/run.mjs` | `@@ -114,7 +114,7 @@` | L117 | 同上常量 pin | ✅ 仅常量 pin |
| H7 | `packages/tools/harness/t12-vertical.mjs` | `@@ -155,7 +155,7 @@` | L158 | 同上常量 pin | ✅ 仅常量 pin |

**逐条核实结论**：
- 7 个 hunk 恰好 = 5 个 `CLIENT_COMMIT_HASH` 常量（H2/H3/H5/H6/H7）+ 2 处文档一致性引用（H1 注释、H4 README），与提交声称「5 处常量 + 2 处文档一致性」**完全一致**；
- 每个 hunk 上下文行均无改动，无任何其他代码/行为变化，无意外空白混入（`--check` 通过双重佐证）;
- 变更行号（L5/L59/L94/L61/L69/L117/L158）与矩阵 §5 P1–P7 的逐行定位**一一对应**；
- 语义边界核实：`DSH_CLIENT_COMMIT_HASH` 仅被 TU `scripts/client-build-environment.ts` 的 `repositoryCommitHash()` 消费（显式值走校验/截断 7 位路径），只盖浏览器构建元数据戳，非 API seam，不被五道门执行（仅 PENDING-LIVE 启动链触发 TU 重建时才消费）——与矩阵 §5 Semantics 段一致，零行为风险。

### 1.3 历史证据指针保留核验（任务书第 3 条）

RC1 树全量 `git grep cd5ef814` 确认以下 3 处**未被本提交触碰、原样保留**（与矩阵 L101–105「Deliberately NOT changed」清单一致）：

| 文件 | 行 | 内容 |
|---|---|---|
| `packages/client/src/plugin/team-mount-core.ts` | L15 | `…host-seam-map.md pinned at cd5ef814` |
| `packages/client/src/transport/host-seams.ts` | L24 | `P9-T0 / cd5ef814` |
| `packages/client/test/client-plugin-mount.test.ts` | L6 | `pinned cd5ef814` |

✅ 保留未改，无需上报改动。

### 1.4 全树残留引用分类（非本提交范围，均非缺陷）

全树 `git grep` 分类结果：
- `76fda72979`：恰好 6 个文件 = 本提交触碰的 6 文件，无多余；
- 其余 `cd5ef814` 全部落在**冻结基线/历史证据**范畴，均不应改且未改：`.github/workflows/characterization.yml`（characterization CI 冻结基线 ref + 构建 pin）、`dev/agent-workflow/`（append-only 日志、briefs、evidence——历史记录不得重写）、`docs/`（协议文档）、`tests/characterization/`（golden fixtures，`host-version.json` 记录 0.1.2-alpha.1 基线版本，属冻结基线记录）;
- 观察项（非阻塞，非本提交缺陷）：`docs/TEST_METHODS.md` §1 基线描述仍写 alpha.1/cd5ef814，而 TU 树已就地升到 rc.1/76fda72979。该文档属用户裁决协议文档，本提交未声称触碰，是否同步由主 Agent 在 gate 流程中裁决，不在本 review 判罚范围。

### 1.5 与矩阵结论一致性判定

矩阵 §6 Verdict：`破坏-需验证`=none、`语义适配`=none、`机械适配`=P1–P7、`不变`=其余全部 seam。
**独立 diff 核实：本提交恰好且仅实现了 P1–P7 机械适配，无第 8 处改动，无越界，无遗漏。✅ 与矩阵「仅机械适配、无语义适配、无破坏」结论一致。**

---

## 2. 任务 2 — 独立门复跑（全部在 RC1 worktree 内，逐包 `pnpm -C <包目录> <script>`，未用 `pnpm -r`）

包级脚本实测：9 包均有 `build = tsc -p tsconfig.build.json`；8 包（legacy 无）另有 `typecheck = tsc -p tsconfig.json` 与 `test = vitest run`；根 `lint = eslint .`。

### 2.1 typecheck（8 包，期望 8/8 EXIT=0）

| 包 | EXIT | 耗时 |
|---|---|---|
| contracts | 0 | 1s |
| domain | 0 | 1s |
| storage | 0 | 1s |
| testkit | 0 | 1s |
| tools | 0 | 2s |
| remote | 0 | 1s |
| client | 0 | 3s |
| runtime | 0 | 3s |

**8/8 EXIT=0 ✅**（legacy 无 typecheck 脚本，符合基线）。
真实性抽验：`tsc -p … --listFilesOnly` 实测程序集 domain=385 文件、runtime=702 文件（含 node_modules 类型依赖），非空转。

### 2.2 build（9 包，期望 9/9 EXIT=0）

| 包 | EXIT | 耗时 |
|---|---|---|
| contracts | 0 | 1s |
| domain | 0 | 1s |
| storage | 0 | 1s |
| testkit | 0 | 1s |
| tools | 0 | 2s |
| remote | 0 | 1s |
| client | 0 | 2s |
| legacy | 0 | 1s |
| runtime | 0 | 2s |

**9/9 EXIT=0 ✅**。说明：本次 build 为增量校验（tsbuildinfo 已最新，无重写，故 1–2s）；产物实证存在——frozen-legacy mirror `packages/runtime/dist/packages/legacy/session-reader/index.js` 在位（1172 B，builder 构建时间戳 2026/9/4 19:53），`contracts/dist` 等产物齐备。tsc 增量校验 EXIT=0 证明 dist 与源码一致（否则必触发重建）。

### 2.3 vitest（8 包，期望 8/8，合计 2532/2532）

前置检查（矩阵 §7 环境约束 (b)）：`packages/testkit/test/.tmp-fault` 存在但**为空目录，无残留域**，无需清理，未触发 fail-closed 假失败。

| 包 | EXIT | 文件 | 测试数 | 基线测试数 | 文件数基线 |
|---|---|---|---|---|---|
| contracts | 0 | 13 passed (13) | 150 | 150 | — |
| domain | 0 | 17 passed (17) | 312 | 312 | — |
| storage | 0 | 21 passed (21) | 269 | 269 | — |
| testkit | 0 | 15 passed (15) | 124 | 124 | — |
| tools | 0 | 4 passed (4) | 35 | 35 | — |
| remote | 0 | 9 passed (9) | 92 | 92 | — |
| client | 0 | 33 passed (33) | 480 | 480 | 33 ✅ |
| runtime | 0 | 116 passed (116) | 1070 | 1070 | 116 ✅ |
| **合计** | **8/8 EXIT=0** | — | **2532/2532** | **2532** | — |

**8/8 EXIT=0，合计 2532/2532，全部计数与基线一致 ✅**（legacy 无 vitest，符合基线）。runtime 明细见 §3 环境记录。

### 2.4 lint（根级，期望 EXIT=0）

`pnpm -C <RC1 根> lint`（= `eslint .`）：**EXIT=0，零输出（零问题）✅**。

### 2.5 与基线差异

**无任何差异。** typecheck 8/8、vitest 8/8（2532/2532，分包计数逐一相符）、build 9/9、lint EXIT=0 —— 与 builder 报告值完全一致。

---

## 3. 环境问题处理记录

1. **p6t1-parallel 已知 flaky（既有，非 rc.1 缺陷）**：
   - 首跑（runtime vitest 与根级 lint 并发执行）：`1 failed | 115 passed (116)`，`5 failed | 1065 passed (1070)`，EXIT=1；失败全部集中于 `test/p6t1-parallel.test.ts`（激活竞态断言 `expect(p3?.memberCount).toBe(2)` 得 1，5/5 同文件）。
   - 处置：按任务书规则（「恰好只有该单项失败 → 隔离重跑一次再判定」）在**零并发**下隔离重跑 runtime 整包 vitest。
   - 隔离重跑结果：**`116 passed (116)` / `1070 passed (1070)`，EXIT=0**，绿。
   - 判定：与 builder 矩阵 §7 环境记录（「isolated rerun green；仅并发重负载触发，与 rc.1 无关」）完全吻合，**非真失败，不判罚**。其余 7 包无任何失败。
2. **增量 build 时间偏快**：已用 `--listFilesOnly` 程序集计数（domain 385 / runtime 702 文件）+ 产物实证（mirror 在位）排除空转，见 §2.1/§2.2。
3. **表面性工具噪声（非门结果问题）**：Windows PowerShell 5.1 将 pnpm/eslint 写入 stderr 的回显（如 `$ tsc -p tsconfig.json`、eslint 内部 stderr）渲染为 NativeCommandError/ErrorRecord，不影响任何 EXIT 码判读；`git show` 重定向默认 UTF-16，改用 `Set-Content -Encoding utf8` 落盘供读取（dossier 本身为无 BOM UTF-8）。

---

## 4. 收尾状态核验（红线核验）

| 检查项 | 结果 |
|---|---|
| TU `references\deepseek-harness-test-use` HEAD | `76fda729799fe9b3848dbe2c211d4b231032b81e`（= 76fda72979）✅ |
| TU `git status --porcelain` | **0 行（clean）** ✅ |
| RC1 worktree HEAD | `c6bae9c8cee6b12bedfc34c71fabf9f0a73e7872`（未变）✅ |
| RC1 worktree `git status --porcelain` | **0 行（clean）** ✅ |
| 红线：未改 references\ 源码 / 未 push / 未建分支 / 未 commit / 未启动 :3180 / 未触碰 `D:\deepseek-harness\` 与 :3080 | **全部遵守** ✅ |

---

## 5. 最终裁决

**GO**

- 提交 `c6bae9c` 与声称严格一致：7 hunk = 5 常量 pin + 2 文档一致性引用，纯构建元数据，零语义改动，零空白/格式混入（`--check` 干净）;
- 3 个历史证据指针（team-mount-core.ts L15 / host-seams.ts L24 / client-plugin-mount.test.ts L6）原样保留;
- 与矩阵「仅机械适配（P1–P7）、无语义适配、无破坏」结论**逐行吻合**;
- 五道门独立复跑全绿且计数与基线零差异：typecheck 8/8、vitest 8/8（2532/2532，含 runtime 隔离重跑后 1070/1070）、build 9/9、lint EXIT=0;
- 唯一非绿事件为既有 p6t1-parallel 并发 flaky，隔离重跑即绿，有完整处置记录，非 rc.1 缺陷、非本提交引入;
- 收尾 TU/RC1 双 clean、双 HEAD 锁定。smoke 仍为 PENDING-LIVE（3180 垂直属主 Agent lane），不在本 lane 裁决范围。

（L2 review 子代理，独立执行，2026-09-04）
