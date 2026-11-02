# CI 成本削减方案（本地 census 探针 + census 拆层）

> **Dated**: 2026-11-02（UTC）· **状态**: 提案，等待外部独立复审；**未获批准，未修改任何 CI 配置**
> **性质**: 设计/选型 memo（`docs/plans/memo/`），不是当期执行计划的替代，不改变机器权威指针
> **范围**: 仅 CI 门禁结构与本地开发入口；不涉及产品代码、upstream、`AGENTS.md`、`graph.yaml`、权威快照
> **复审请求**: 请按 §10 的八个小问题逐条给出裁决；通过后由用户决定是否进入实施

---

## 0. 摘要

当前每个指向 `master` 的 PR，CI 约 **19–20 分钟墙钟、约 37.5 runner-min** 的计算量。成本几乎全部集中在一处：**九根全量测试人口普查（census）被跑了两遍**，且每次都要从零重建 pinned 测试宿主。

本提案给出两条可以同时采用、但作用不同的措施：

| 提案 | 作用对象 | 预期效果 | 风险等级 |
|---|---|---|---|
| **A. 本地 census 快速探针** | 开发迭代轮 | 迭代轮 **0 runner-min**，本地 5–8 分钟（估计）完成一次与 CI 同源的普查比较 | 低（纯新增本地入口，不改 CI 判定） |
| **B. census 拆出 `ci-full` 并改名** | 每个 PR 的固定成本 | runner-min ≈ 37.5 → ≈ 20（约减半），墙钟 ≈ 19.4 → ≈ 18 分钟；加 host 缓存后可到 ≈ 14 分钟 | 中（改门禁结构，必须一次改全） |

**关键设计判断**：方案 B 的“product 与 census 都绿”应由**现有唯一必需上下文 `ci-required` 的 `needs`** 表达，而**不是**新增第 4 个必需检查。理由见 §4.2。

---

## 1. 背景与约束

### 1.1 仓库红线（任何实施不得触碰）

- `CORE PATCH BUDGET = 0`：不得修改 upstream DSH 源码；不得 import upstream 私有 API。
- 机器权威 = `dev/engineering/current-authority.json` 指针解析到的不可变快照；本提案不触碰该指针、`AGENTS.md`、`docs/plans/active/**`、`dev/agent-workflow/graph.yaml`。
- 1 task = 1 branch = 1 worktree = 1 writer；`SESSION_ROUTER_LOG.md` 只追加；测试端口 3180 族、`DSH_HOME` 必须在 `tests/homes/`、不得影响 `:3080` 稳定实例。
- 本提案属于 CI/工具链变更，不是权威迁移；实施必须走 RED→实现→GREEN→typecheck→回归→独立 Review→PR。

### 1.2 CI 架构现状（EB3-C）

- 分支保护（`strict=true`）只有三个必需上下文：**`pr-gate`、`ci-required`、`pr-settlement-gate`**。
- `ci-required` 是唯一的分层聚合器：`synthesize`（`git merge-tree --write-tree` 合成 base+head，不移动任何分支）→ 四个 reusable workflow 层并行（`ci-fast` / `ci-integration` / `ci-security` / `ci-full`）→ 汇总 job 以 `if: always()` + `toJSON(needs)` 判绿，**absence / skip / refused / cancel / ENV_BLOCK 一律非绿**。
- `dev/ci/eb3-ci-manifest.json` 是“CI 层”的唯一声明；`scripts/eb3-ci-required.mjs` 对实际 workflow 做 YAML AST 形状检查（16 类 finding，含 `CI_LAYER_SKIPPABLE`、`CI_SUMMARY_NEEDS_INCOMPLETE`、`CI_LAYER_LEG_WEAKENED`、`CI_HOST_DEPENDENT_SUITE_IN_HOST_FREE_LAYER`、`CI_DEFERRAL_CONFLICT`）。
- `scripts/eb3-ci-negative-controls.mjs` 本身是一个 CI leg（由 `ci-integration.yml` 执行），用变异测试证明上述规则确实能红；其中 C9/C12/C21/C22 的 fixture **硬编码了四个层名**。
- 延迟层：PR 标签 `ci-defer-full` 可跳过 `ci-full`；被跳过的 Required 聚合按设计是红的——这是刻意的，因为 GitHub 把“被跳过的必需 job”视为通过，所以延迟只能放在**层**上，不能放在聚合上。

### 1.3 census 是什么（拆层不得改语义）

- census = 对九根 `packages/*/test` 全量跑根 vitest（`--reporter=json`），把结果压成**身份集合**（`TEST <file>::<case>`、`FILE <file>::…`），与冻结基线 `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` 做**集合**比对。
- 必须逐字保留的语义：新增身份=红；消失的 titled red 若同文件出现 collection error = **escalation**（不是修复）；**2 次 capture 取并集**；计数漂移不算红；已披露 load family 的红需 ≥3 次重采样并公布比率；`--census-test-timeout 90000` 必须出现在 leg 行里；**禁止** `--allow-refused census` 与 `--skip census`。
- 现基线人口：`626 files / 7936 registered legs / 0 titled reds / 0 collection-error files`；最近一次实测捕获为 `654f/8605l`（计数漂移、集合不变）。

---

## 2. 实测成本（提案的事实基础）

### 2.1 单轮 Required 的构件

| job | 实测耗时 | 来源 |
|---|---|---|
| synthesize-merge-tree | 11s | run `41214261445` |
| **ci-full** | **1028s（17.1 min）** | 同上 |
| ci-fast / ci-integration / ci-security | 77s / 51s / 41s | 同上 |
| ci-required（汇总） | 10s | 同上 |
| **墙钟（创建→完成）** | **19.4 min** | 同上 |

### 2.2 ci-full 内部（job `124575440260`）

| 步骤 | 耗时 | 占比 |
|---|---|---|
| Build pristine host（fetch + install + build） | **245s** | 24% |
| Build this repo | 19s | 2% |
| Host security suites | 3s | 0% |
| **Gate `ci-pr-gate.mjs --full`** | **742s** | 72% |
| └ **census（2 captures）** | **676s** | **66%** |
| └ typecheck / lint identities / artifacts-at-head | 25.2s / 22.1s / 17.4s | 6% |
| └ 其余 leg（install、blueprint-fence、state-freshness、graph-parse） | <2s | 0% |

census leg 实测行（run `41508157238`）：

```
roots: nine (packages/*/test) via the root vitest config; baseline ... = 0 titled reds + 0 collection files;
captured 654f/8605l, 654f/8605l vs baseline-declared 626 / 7936;
2 captures, identical identity sets — clock: --testTimeout=90000 ms, an operator override above the 5000 ms default
```

### 2.3 重复计算

独立工作流 `census-runtime`（run `41508157238`）：host build **264s** + repo build 21s + **census 796s** ≈ **18.3 min**。它不在必需上下文里（manifest `knownNonRequired` 声明为 informational），但每个 master PR 都会跑。

**合计：每 push 约 37.5 runner-min；墙钟 19–20 分钟。**

### 2.4 本地现状（方案 A 的前提）

- `tests/deepseek-harness-test-use` 已存在**且已构建**（`apps/cli/lib` 在），`HEAD` 与 `tests/paths.mjs` 的 pin 一致，`porcelain` 干净。
- 本仓 `node_modules`、`vitest`、`packages/*/dist` 就位（build 产物随 HEAD 提交，`artifacts-at-head` 每次比对 1883 个文件）。
- 本地机器 16 核 / 30GB。**本地 census 墙钟尚未实测**（见 §9）。

---

## 3. 方案 A：本地 census 快速探针

### 3.1 目标

在推送前，用**已构建好的** pinned host 跑一次与 CI 同源的 census 比较，回答“这个 head 有没有新增身份（会不会红）”，且不消耗 runner 分钟、不排队、不重建 host。

### 3.2 形态

新增 `scripts/census-probe.mjs`（纯本地入口，**不改任何 CI 判定**）：

```
node scripts/census-probe.mjs [--captures 2] [--test-timeout 90000] [--census-json <path>] [--base origin/master] [--json]
```

### 3.3 步骤

1. **pin 断言**：`tests/paths.mjs` 的 `TEST_USE_BASELINE_SHA` == host `git rev-parse HEAD`；host `git status --porcelain` 为空。任一不满足即退出码 2 并打印修复命令（不自动 fetch、不自动改 host）。
2. **build 一致性**：复用 `check-artifacts-at-head` 的判定确认仓库 build 与 HEAD 一致；一致则**跳过** install/build，不一致才提示（默认不自动执行）。
3. **合成 merge 树**：用 `scripts/eb3-merge-tree.mjs --synthesize` 在临时 worktree 构造 `base（origin/master 尖端）+ head` 的 merge commit；后续测量都在该树上，保证与 CI 评的是同一棵树。
4. **跑普查**：`node scripts/ci-pr-gate.mjs --full --census-captures <N> --census-test-timeout <ms>`（默认 N=2，保留并集语义）。
5. **输出**：原样打印 gate 的 leg 行 + `added` / `resolved` / `escalations` 身份 diff；`--json` 给机器可读结果。
6. **重评**：`--census-json <path>` 走 gate 已有的 stored-report 路径（秒级，不重跑）。

### 3.4 必须披露的四个局限

| # | 局限 | 后果 | 缓解 |
|---|---|---|---|
| L1 | 本地单机、单次采样；核数与负载和 2 核 runner 不同，`p6t1-parallel` 类 load family 红率不同 | 本地绿 ≠ CI 不 flake | 每次输出固定打印“本地绿只证明无确定性新红，CI 仍是必需” |
| L2 | 必须评 base+head 合成树；只跑工作区 HEAD 会漏掉 master 前进 | 本地绿、CI 红 | 步骤 3 强制合成；输出打印被评的 tree id 与 base sha |
| L3 | 不得写共享只读 baseline host | 污染共享基座 | host 只读断言；产物写 repo 内 gitignored 路径并清理 |
| L4 | `90s` 超时是 claim 的一部分 | 与 CI 不可比 | 输出打印 clock，与 gate 的 leg 行同格式 |

### 3.5 非目标

- 不替代 CI，不改变“最终 head 必须真 CI 绿”的规则；
- 不引入第二套比较逻辑（必须调用 `ci-pr-gate.mjs`，否则语义会漂）；
- 不自动修红、不自动切换 base。

### 3.6 预估成本

单 capture 预计 2–4 分钟（16 核 vs 2 核的 327s/遍），2 captures 约 5–8 分钟；重评路径秒级。**这是估计，不是测量。**

---

## 4. 方案 B：拆出 census，`ci-full` 改名

### 4.1 目标语义

- census 仍然门禁每个 PR；
- `ci-full` 不再包含 census，改名为 **`ci-product`**（备选 `ci-static`）；
- “product 与 census 都绿”由 **`ci-required` 聚合器的 `needs`** 表达；
- **分支保护不变**（仍只 require `ci-required`）。

### 4.2 为什么拒绝“新增第 4 个必需上下文”

| 风险 | 说明 |
|---|---|
| skip 被当作通过 | manifest 的 `deferral.note` 已记录：被跳过的必需 job 报告 `skipped`，branch protection 接受为通过。两个独立必需上下文会把 `ci-required` 花大力气消灭的“缺席/跳过即绿”重新引入 |
| 跨上下文不可比 | 两个 check 各自绑定自己的 sha，没有“两者评的是同一棵树”的保证（现在由 `synthesize` + bind-tree 步骤保证） |
| 延迟语义分裂 | `ci-defer-full` 必须同时影响两个上下文，否则出现“一个绿一个红、无法合并也无法诊断”的死锁 |
| 与 EB3-C 明文冲突 | `ci-required.yml` 头注释与 manifest `aggregate.note` 都声明它是 *the ONE Required branch-protection context* |

### 4.3 目标形态

```
synthesize (11s)
 ├─ ci-fast        (~77s)
 ├─ ci-integration (~51s，含 negative-controls leg)
 ├─ ci-security    (~41s)
 ├─ ci-product     (~1.5–2min，hostFree: true)   ← 原 ci-full 去掉 host 与 census
 └─ ci-census      (~14–18min，hostFree: false)  ← 新层：host + host-security + census
ci-required (if: always()，needs 全部) → 唯一必需上下文
```

manifest 片段（示意，不是最终字节）：

```json
{
  "id": "ci-product",
  "workflow": ".github/workflows/ci-product.yml",
  "mustRunOn": ["workflow_call"],
  "hostFree": true,
  "legs": ["install", "graph-parse", "kit-home-guard", "state-freshness",
           "blueprint-fence", "typecheck", "lint-identities", "artifacts-at-head"]
},
{
  "id": "ci-census",
  "workflow": ".github/workflows/census-runtime.yml",
  "mustRunOn": ["workflow_call"],
  "hostFree": false,
  "suiteList": "tests/checks/eb3-host-security-suites.txt",
  "legs": ["host-security-suites", "census"],
  "forbid": ["--allow-refused", "--skip"]
}
```

`deferral` 改为 `{"layer": "ci-census", ...}`：中间轮省的是普查（贵的那段），静态腿仍跑并给结论；被跳过的 census 仍使聚合红 → 不可合并，语义与今天一致。

### 4.4 改动清单

| # | 文件 | 改动 | 为什么必须 |
|---|---|---|---|
| B1 | `dev/ci/eb3-ci-manifest.json` | 层 `ci-full` → `ci-product`（`hostFree: true`，legs 去掉 host-security 与 census）；新增 `ci-census` 层；`deferral.layer` 改 `ci-census`；`movedSuites[].to` 改 `ci-census`；`knownNonRequired` 处理 `census-runtime` 条目 | manifest 是唯一声明，grader 以它为准 |
| B2 | `.github/workflows/ci-full.yml` → `ci-product.yml` | 删 host provision/build 与 census leg；census 改 `--allow-refused census` 显式声明（真值由 census 层给）；改 `name:` 与注释 | 层文件是 grader 的输入 |
| B3 | `.github/workflows/census-runtime.yml` | 增加 `on: workflow_call` + `outputs.verdict`；**删除 `pull_request` 触发**（否则一个层跑两遍——`ci-full.yml` 头注释已记录该坑） | 不删 PR 触发 = 每 PR 双跑 |
| B4 | `.github/workflows/ci-required.yml` | caller job 改名 + 新增 `ci-census` caller；`needs` 与汇总 job 的 `needs` 同步；`required-deferred` 的 needs 同步 | 漏进 needs = 该层失败而聚合仍绿（grader 会抓，但不应依赖） |
| B5 | `scripts/eb3-ci-required.mjs` | 头注释层名列表；deferral 的 `callerIf` 逐字比对规则（改文本必须与 manifest 完全一致） | 文本不同步报 `CI_LAYER_SKIPPABLE` |
| B6 | `scripts/eb3-ci-negative-controls.mjs` | C9 的 `FULL` 路径、C12 的四层循环、C21/C22 的 fixture 与断言 | 这些 fixture 硬编码了 `ci-full`；不改进程会在 `ci-integration` 层红（这是好事：能抓半成品改名） |
| B7 | `scripts/eb3-security-run.mjs` + `tests/checks/eb3-host-security-suites.txt` | `--layer ci-full` → `--layer ci-census`；文件头注释同步 | 套件归属必须与层一致 |
| B8 | `dev/ci/eb3-impact-graph.json`、`scripts/eb3-ci-manifest.mjs`、`scripts/eb3-merge-tree.mjs` | 检查是否按名字枚举层；如有则同步 | 影响面选择与汇总器可能按名字匹配 |
| B9 | 分支保护 | **不改** | 改动本身就是风险；不需要 |
| B10 | 文档与证据 | `ci-full` 引用更新；`SESSION_ROUTER_LOG.md` **只追加**说明 | 文档是快照，引用错会误导下一轮 |
| B11 | 验收证据 | 同 head 下“新旧 census leg 行逐字一致”的对照记录 | 证明拆分没放水（见 §8.3） |

### 4.5 关键约束

- 层名必须匹配 `^ci-[a-z]+$`（`eb3-security-run.mjs` 的 `--layer` 校验），`ci-product` / `ci-census` 均合规。
- `ci-census` 必须保留 `forbid: ["--allow-refused", "--skip"]`，否则“拒绝/跳过”重新变成绿色路径。
- 命名建议：保留 `census-runtime.yml` 的文件名与 job 名（只加 `workflow_call`），层 id 用 `ci-census`，以减少无关 ripple。
- **一次性改全**：B1–B7 若分批合入，中间态必然红（设计使然），所以建议一个 PR 承载全部结构性改动，并把 B11 作为验收证据。

### 4.6 成本模型

设 `T_synth = 11s`，`T_prod ≈ 85s`（repo build 19s + gate 66s），`T_census ≈ 264 + 21 + 796 = 1081s`（无缓存）：

| 场景 | 墙钟 | runner-min/轮 |
|---|---|---|
| 现状（ci-full 含 census + 独立 census-runtime） | ≈19.4 min | ≈37.5 |
| 方案 B（拆层，退休独立 census-runtime） | ≈18.2 min | ≈20 |
| 方案 B + host build cache（key = pin + lockfile） | ≈14.3 min | ≈20 |
| 方案 A（迭代轮） | 本地 5–8 min（估） | 0 |

**注意**：方案 B 的墙钟收益有限（census 仍是长板），主要收益是计算量减半；真正让迭代变快的是方案 A。把 census 改成 1 capture 可把墙钟降到 ≈9.5 分钟，但削弱并集语义——**本提案明确不做**，需单独裁决。

---

## 5. 组合与实施阶段

| 阶段 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| P0 | 只读基线：记录当前 census leg 行、层耗时、`eb3-ci-required.mjs` 当前 0 错 | 证据 | 无 |
| P1 | 方案 A：`scripts/census-probe.mjs` + 使用说明 + 一次实测校准（本地墙钟、单/双 capture） | PR-A（纯新增，不动 CI） | P0 |
| P2 | 方案 B：B1–B8 一次性改全 + B11 对照验收 | PR-B（结构性） | P1 合入后 |
| P3（可选） | host build 缓存 | PR-C | P2 稳定一段时间后 |

理由：P1 不改任何判定，风险最低，先把迭代成本降下来；P2 改门禁结构，必须一次改全并用负控与对照证据验收。

**回滚**：P2 单 PR revert 即可恢复 `ci-full`；分支保护全程未变，回滚不需要动仓库设置。

---

## 6. 红线/不变量

1. `ci-required` 仍是**唯一**必需上下文；absence/skip/refused/cancel 仍必须非绿。
2. census 比较语义不变（身份集合、并集、escalation、计数漂移不算红、load family 重采样、clock 入行）。
3. `--allow-refused census` 与 `--skip census` 在 **census 层**仍被禁止；product 层的 refusal 是**显式声明**，真值由 census 层提供。
4. 不修改 upstream DSH、不改权威指针/`AGENTS.md`/`graph.yaml`、不影响 `:3080`、不写共享 baseline host。
5. `SESSION_ROUTER_LOG.md` 只追加。
6. 1 task = 1 branch = 1 worktree = 1 writer；每个 PR 走 RED→实现→GREEN→typecheck→回归→独立 Review。

---

## 7. 风险登记

| ID | 风险 | 可能性 | 影响 | 缓解 | 检测 |
|---|---|---|---|---|---|
| R1 | 拆层后 census 被某条路径跳过，聚合仍绿 | 中 | **假绿（最高）** | 层内保留 forbid；grader 的 `CI_LAYER_SKIPPABLE` / `CI_SUMMARY_NEEDS_INCOMPLETE`；C21/C22 负控 | 负控 + `eb3-ci-required.mjs` |
| R2 | 半成品改名使 `ci-integration`（负控）红，被误判为“改动有 bug” | 高 | 低 | 预期行为；B6 同 PR 改全 | 负控 leg |
| R3 | 本地探针绿而 CI 红（flake/负载） | 中 | 中 | 输出显式披露 L1；最终 head 必须真 CI | 对照记录 |
| R4 | 本地探针评错树（base 前进） | 中 | 中 | 强制合成 merge tree；输出 tree id | 探针自检 |
| R5 | host build 缓存命中但 pin 漂移 → 评错宿主 | 低 | 高 | cache key 含 pin；命中后仍跑 pin 断言 | 探针/gate 的 pin 断言 |
| R6 | `deferral` 文本不同步 → `CI_LAYER_SKIPPABLE` | 中 | 低 | 逐字复制 manifest 值 | grader |
| R7 | 拆分后 repo install 重复 | 中 | 低 | product 层复用同一 checkout；只需一次 install | 计时对比 |
| R8 | 分支保护被顺手改成 4 上下文 | 低 | 高 | 本提案明文禁止（B9） | 分支保护 diff |
| R9 | 本地探针被当成“可以不合 CI”的借口 | 低 | 高 | 探针输出固定打印“不替代 CI” | 文档 + Review |
| R10 | 90s 超时/2 captures 被顺手降级以省时 | 中 | 中 | 明确列为非目标；对照 leg 行逐字一致 | B11 |

---

## 8. 验收标准

### 8.1 方案 A

```bash
node scripts/census-probe.mjs --captures 2          # 正常路径，预计 5–8 分钟
node scripts/census-probe.mjs --census-json <产物>  # 重评，秒级
```

**通过条件**：已知绿的 head 上返回 0 且 `added=[]`；在刻意引入新红的临时 commit 上返回非 0 且 `added` 精确列出该身份（负控）。

### 8.2 方案 B

```bash
node scripts/eb3-ci-required.mjs            # 期望 0 findings（静态，无需 install）
node scripts/eb3-ci-negative-controls.mjs   # 期望全绿（含改名后的 C9/C12/C21/C22）
```

**通过条件**：

1. `ci-required` 的 `needs` 完整包含 `ci-product` 与 `ci-census`；
2. `ci-census` 的 leg 行与旧 `ci-full` 的 census 行逐字一致（除耗时字段）；
3. 带 `ci-defer-full` 的对照 run：product 绿、census 红、**聚合红**；
4. 不带标签的正常 run：聚合绿 = product 绿 ∧ census 绿；
5. 分支保护 contexts 仍为三个（未变）。

### 8.3 拆分等价性证据（B11）

同一 head 上记录：

```
[旧] ci-full 的 census leg 行
[新] ci-census 的 census leg 行
```

要求 `roots` / `baseline` / `captured` / `captures` / `clock` 五段逐字相等，差异只允许出现在耗时字段。证据进 `dev/agent-workflow/evidence/` 并在 PR 描述中引用。

---

## 9. 已测量 vs 估计

| 项 | 数值 | 性质 |
|---|---|---|
| ci-full 1028s、census 676s、host 245s、typecheck 25s、lint 22s、artifacts 17s | §2.2 | **实测**（job `124575440260`） |
| census-runtime 18.3 min（host 264s + census 796s） | §2.3 | **实测**（run `41508157238`） |
| 墙钟 19.4 min、runner-min ≈37.5 | §2.1 | **实测** + 算术 |
| 方案 B 后 ≈18.2 min / ≈20 runner-min | §4.6 | **模型推算**（基于上述实测分量） |
| host cache 后 ≈14.3 min | §4.6 | **估计**（假设缓存命中，省 245–264s，未实测） |
| 本地探针 5–8 min；单 capture 2–4 min | §3.6 | **估计**（16 核，未实测；CI 2 核为 327s/遍） |
| `eb3-ci-pr-gate.mjs --self-test` 在只读沙箱内可通过 | — | **未验证**：审计沙箱只读，`mkdtemp` 被拒；需在可写环境跑一次 |

待补测事实（复审可要求）：

- 本地 16 核 2 captures 的真实墙钟；
- 本地 vs runner 的 flake 率差异（同一 head、同一 load family 各跑 5 次）；
- cache 命中率与失效边界；
- GitHub 对“reusable workflow 被调用 job”在 branch protection 中的可见性（当前不依赖它；若复审倾向 4 上下文方案，必须先证实）。

---

## 10. 复审问题

1. **Q1**：方案 A 是否足够可信？是否应把“本地 2 captures + 与 CI 同 tree id”设为硬性前置，而不是可选？
2. **Q2**：方案 B 保持“单一必需上下文”是否正确？还是 census 应独立成第 4 个必需上下文？请给理由与反例。
3. **Q3**：`ci-defer-full` 应否从 `ci-full` 改绑到 `ci-census`？中间轮的 product 绿是否会被误读为“可以合并”（聚合仍红，但 UI 上有绿）？
4. **Q4**：product 层用 `--allow-refused census` 显式声明 refusal 是否可接受？还是应引入 `--skip census` 的“由另一层负责”语义？
5. **Q5**：`census-runtime.yml` 保留 `push: master` 触发（merge 后再跑一次，18 min/merge）是否值得？还是只留 `workflow_call` + `workflow_dispatch`？
6. **Q6**：是否应把“PR 1 capture + master 2 captures”作为独立提案？它能把墙钟降到 ≈9.5 分钟，但削弱并集语义。
7. **Q7**：P1/P2 是否应合成一个 PR（避免“探针先上、结构后改”期间的语义空窗）？还是分开更利于独立 Review？
8. **Q8**：本提案是否遗漏了任何“层被声明但实际未门禁”的路径（尤其 `knownNonRequired` 与 `CI_DECLARED_JOB_ABSENT` 的交互）？

---

## 附录 A：复审阅读顺序

1. `.github/workflows/ci-required.yml`（聚合器与 deferral 语义）
2. `.github/workflows/ci-full.yml`（今天最贵的层）
3. `.github/workflows/census-runtime.yml`（第二份普查，头注释解释了历史原因）
4. `dev/ci/eb3-ci-manifest.json`（唯一声明）
5. `scripts/eb3-ci-required.mjs`（16 类 finding，尤其 deferral 逐字比对与 `CI_SUMMARY_NEEDS_INCOMPLETE`）
6. `scripts/ci-pr-gate.mjs`（`compareCensus` 与 census capture 循环）

## 附录 B：证据索引

| 事实 | 出处 |
|---|---|
| 单轮 job 耗时 | run `41214261445`，job `124575440260`（ci-full） |
| census-runtime 耗时 | run `41508157238` |
| census leg 行 | 上述两次 run 的 step log（`DSH-CI-LEG leg=census …`） |
| 分支保护 contexts | `pr-gate` / `ci-required` / `pr-settlement-gate`，`strict: true` |
| 基线人口 | `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` |
| 负控硬编码层名 | `scripts/eb3-ci-negative-controls.mjs`（C9 `FULL`、C12 四层循环、C21/C22） |

## 附录 C：成本公式

```
墙钟      ≈ T_queue + T_synth + max(T_layers) + T_aggregate
runner-min ≈ Σ T_layers + T_synth + T_aggregate

现状:  T_layers = {fast 77s, integration 51s, security 41s, full 1028s} + census-runtime ≈1100s
方案B: T_layers = {fast 77s, integration 51s, security 41s, product ≈85s, census ≈1081s}
       → max ≈ 1081s；Σ ≈ 1335s（删除独立 census-runtime 后净 ≈20 min）
缓存:  T_census ≈ 21 + 796 + ≈20 = ≈837s
```
