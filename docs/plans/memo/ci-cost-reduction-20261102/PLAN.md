# CI 成本削减方案（本地 census 探针 + census 拆层）

> **Dated**: 2026-11-03（UTC）· **修订**: rev 2，按 2026-11-03 外部独立审查意见修订
> **状态**: 提案，等待授权实施；**未修改任何 CI 配置**
> **性质**: 设计/选型 memo（`docs/plans/memo/`），不是当期执行计划，不改变机器权威指针
> **范围**: 仅 CI 门禁结构与本地开发入口；不涉及产品代码、upstream、`AGENTS.md`、`graph.yaml`、权威快照
> **审查结论**: 方向正确；方案 A 修正快速路径后可先行实施；方案 B 修补两个 P0 与验收口径后可授权实施；host cache / 单 capture 等另行评估

---

## 0. 摘要

当前每个指向 `master` 的 PR，CI 约 **19–20 分钟墙钟**、约 **38.6 runner-min** 的 Actions 计算量（口径见 §2.4）。成本几乎全部集中在一处：**九根全量测试人口普查（census）被跑了两遍**，且每次都要从零重建 pinned 测试宿主。

| 提案 | 作用对象 | 预期效果 | 风险 |
|---|---|---|---|
| **A. 本地 census 快速入口** | 开发迭代轮 | 日常反馈 0 runner-min；**真实耗时以实测为准**（rev 1 的 5–8 分钟是估计，本版删除该承诺） | 低（纯本地入口） |
| **B. census 拆出 `ci-full` 并改名** | 每个 PR 的固定成本 | runner-min ≈ 38.6 → ≈ 22.6（约 −41%）；墙钟 ≈ 19.4 → ≈ 18.3 分钟（**只降约 1 分钟**） | 中（改门禁结构，必须一次改全） |
| C. host build cache（后续独立） | 最慢层 | census 层 −245–264s；总 runner-min ≈ 18.5 | 低，但需独立验收 |

**必须明确区分**：降低 CI 资源消耗 ≠ 缩短开发等待。方案 B 主要省的是 runner 分钟，墙钟收益有限；提高 Agent 吞吐量更依赖方案 A（本地提前失败）与后续的缓存/去重。因此本版把验收指标从单一 runner-min 扩展为两个可观测指标（§2.5）。

### 0.1 rev 2 对审查意见的处置

| 审查项 | 处置 | 本版位置 |
|---|---|---|
| P0-1 `census-runtime` 的 `cancel-in-progress: true` 与新层契约冲突 | **接受**：B3 明确改为 `cancel-in-progress: false` | §4.3、§4.4 B3 |
| P0-2 新层缺合成树绑定、事件与输出契约 | **接受**：补齐 `inputs.merge_tree` + `--assert-tree`（含 `EB3_EVENT`）+ job/workflow outputs 链 + `if: always()` 的 job.status verdict；并改为纯 `workflow_call`（`--assert-tree` 只接受 `pull_request`，旧触发器必须退休） | §4.3、§4.4 B3 |
| P1-3 本地探针“快速复用”与 `check-artifacts-at-head` 行为矛盾（它内部会 worktree+install+build） | **接受**：删除“用它判断是否需要构建”；A 拆成 **HEAD 快速模式** 与 **合成树等价模式**，并说明新 worktree 不继承 `node_modules`/pinned host | §3.2–§3.4 |
| P1-4 `--census-json` 不等价于双 capture 并集 | **接受**：改名为“单报告诊断性复评”，明确它不重放并集、不能证明 timeout/commit | §3.6 |
| P1-5 B11“旧新逐字一致”不是充分等价性证明 | **接受**：改为四类证据（配置不变 / 全人口实跑 / 失败注入 / 拓扑负控）+ `knownNonRequired` 静态负控；并说明 workflow 文件本身在树内，跨改名不可能有相同 tree id | §8.3 |
| P2-6 runner-min 算术与统计口径 | **接受**：更正为 38.6 / 22.6 / 18.5，并把 legacy `pr-gate`、`pr-settlement-gate` 与 informational 工作流纳入账单；建立 P50/P90 基线 | §2.4、§2.5 |
| Q1–Q8 | **全部采纳**（Q4 改为 `--only`，Q5 纯 `workflow_call`，Q6 不做单 capture，Q7 不合并 PR，Q3 改绑 `ci-census` 保留标签名） | §4.5、§10 |

---

## 1. 背景与约束

### 1.1 仓库红线（任何实施不得触碰）

- `CORE PATCH BUDGET = 0`：不得修改 upstream DSH 源码；不得 import upstream 私有 API。
- 机器权威 = `dev/engineering/current-authority.json` 指针解析到的不可变快照；本提案不触碰该指针、`AGENTS.md`、`docs/plans/active/**`、`dev/agent-workflow/graph.yaml`。
- 1 task = 1 branch = 1 worktree = 1 writer；`SESSION_ROUTER_LOG.md` 只追加；测试端口 3180 族、`DSH_HOME` 必须在 `tests/homes/`、不得影响 `:3080` 稳定实例。
- 本提案属于 CI/工具链变更，不是权威迁移；实施必须走 RED→实现→GREEN→typecheck→回归→独立 Review→PR。

### 1.2 CI 架构现状（EB3-C）

- 分支保护（`strict=true`）三个必需上下文：**`pr-gate`、`ci-required`、`pr-settlement-gate`**。
- `ci-required` 是唯一分层聚合器：`synthesize`（`git merge-tree --write-tree`）→ 四个 reusable workflow 层并行（`ci-fast` / `ci-integration` / `ci-security` / `ci-full`）→ 汇总 job 以 `if: always()` + `toJSON(needs)` 判绿，**absence / skip / refused / cancel 一律非绿**。
- `dev/ci/eb3-ci-manifest.json` 是“CI 层”的唯一声明；`scripts/eb3-ci-required.mjs` 用 YAML AST 检查形状，其中与本提案直接相关的四条规则：
  - `CI_LAYER_CANCELLABLE`：层的 `cancel-in-progress` 必须为 `false`（manifest `cancelInProgress: false`）；
  - **merge-tree 绑定也是一个 leg**：必须执行 `node scripts/eb3-merge-tree.mjs --assert-tree "${{ inputs.merge_tree }}"`，且 `EB3_EVENT` 必须绑定 `${{ github.event_name }}`；
  - `CI_WORKFLOW_CALL_OUTPUT_MISSING`：`on.workflow_call.outputs.verdict` 必须存在（job 级 `outputs:` 不跨 reusable workflow 边界）；
  - `CI_LAYER_SKIPPABLE`：层 job 不得带 job 级 `if:`（deferral 是唯一例外，且逐字比对 `deferral.callerIf`）。
- `scripts/eb3-ci-negative-controls.mjs` 本身是一个 CI leg（由 `ci-integration.yml` 执行），用变异测试证明上述规则能红；C9/C12/C21/C22 的 fixture **硬编码了四个层名**。
- 延迟层：PR 标签 `ci-defer-full` 可跳过 `ci-full`；被跳过的 Required 聚合按设计是红的——因为 GitHub 把“被跳过的必需 job”视为通过，延迟只能放在层上。

### 1.3 census 是什么（拆层不得改语义）

- census = 对九根 `packages/*/test` 全量跑根 vitest（`--reporter=json`），把结果压成**身份集合**（`TEST <file>::<case>`、`FILE <file>::…`），与冻结基线 `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` 做**集合**比对。
- 必须逐字保留的语义：新增身份=红；消失的 titled red 若同文件出现 collection error = **escalation**（不是修复）；**2 次 capture 取并集**；计数漂移不算红；已披露 load family 的红需 ≥3 次重采样并公布比率；`--census-test-timeout 90000` 必须出现在 leg 行里；**禁止** `--allow-refused census` 与 `--skip census`。
- 现基线人口：`626 files / 7936 registered legs / 0 titled reds / 0 collection-error files`；最近实测捕获 `654f/8605l`（计数漂移、集合不变）。
- `ci-pr-gate.mjs` 的 leg 顺序（`LEG_ORDER`）：`graph-parse`、`kit-home-guard`、`state-freshness`、`install`、`blueprint-fence`、`typecheck`、`lint-identities`、`artifacts-at-head`、`census`——共 9 条，前 8 条为非 census leg。

---

## 2. 实测成本与口径

### 2.1 单轮 Required 的构件（run `41214261445`，2026-10-31）

| job | 实测耗时 |
|---|---|
| synthesize-merge-tree | 11s |
| **ci-full** | **1028s（17.1 min）** |
| ci-fast / ci-integration / ci-security | 77s / 51s / 41s |
| ci-required（汇总） | 10s |
| **墙钟（创建→完成）** | **19.4 min** |

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

### 2.3 重复计算与波动

- 独立 `census-runtime`（run `41508157238`）：host build **264s** + repo build 21s + **census 796s** ≈ **18.3 min**；它不在必需上下文里，但每个 master PR 都会跑。
- 同一 `census-runtime` 在 2026-11-02 的文档 PR（#538）上实测 **18m31s**；同轮 `ci-full` 实测 **21m26s**（高于 10-31 的 17.1 min）——**单点测量不足**，需要 P50/P90（§2.5）。

### 2.4 更正后的资源账单（口径：一轮 PR 的全部 Actions 计算）

| 分项 | 现状（runner-min） | 方案 B 后 |
|---|---|---|
| synthesize + aggregate | 0.35 | 0.35 |
| ci-fast / ci-integration / ci-security | 1.28 + 0.85 + 0.68 = 2.81 | 同左 |
| `ci-full`（含 census） | **17.13** | —（拆为 product + census） |
| `ci-product`（8 个非 census leg） | — | ≈1.4 |
| `ci-census`（host + repo build + 2 captures） | — | ≈18.0 |
| 独立 `census-runtime`（informational，重复） | **18.33** | 0（退休） |
| **小计（ci-required 体系）** | **38.6** | **22.6** |
| legacy `pr-gate`（install + build:composition + `--full --allow-refused census` + settlement selftest） | ≈2.1 | ≈2.1（本提案不动） |
| `candidate-protection` | 0.2 | 0.2 |
| **全部 Actions 合计** | **≈40.9** | **≈24.9** |
| + host build cache（后续独立项） | — | census 层 ≈ −4.1 → 合计 ≈20.8 |

> 与 rev 1 的差异：rev 1 写 37.5 / 20 / 未列 cache，且未把 legacy `pr-gate` 与 informational 工作流计入。审查指出的算术偏差成立，本表已更正。方案 B 之后，**legacy `pr-gate` 仍在做一遍 install+build+全 leg**，这是下一轮独立优化的目标，不属于本提案。

### 2.5 验收指标（新增）

除 runner-min 外，本提案要求同时观测两个指标：

1. **首次有效失败反馈时间（TTFF）**：从 push/tag 到第一条能定位问题的红灯（通常是 `ci-fast`）之间的墙钟。
2. **单轮迭代墙钟（IWC）**：一次修改从“开始本地验证”到“拿到可用结论（本地红/绿，或 CI 红/绿）”的总时间——这是衡量本地探针是否真的减少等待的指标。

基线方法：取最近 5–10 个正常 PR，记录 `ci-required` 聚合、legacy `pr-gate`、informational 工作流的 P50/P90 墙钟与 runner-min，作为方案 B 的前后对照。**不为统计另开 PoC。**

---

## 3. 方案 A：本地 census 快速入口（两档，互不冒充）

### 3.1 目标

把“这个 head 会不会让 census 变红”的验证从 GitHub 挪到本地，但**不把未经准备的环境称为 CI 等价**。

### 3.2 快速模式（默认，日常反馈）

在**已构建的本地 HEAD** 上只跑 census leg：

```
node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 --census-test-timeout 90000
```

- 不执行 `install` / `typecheck` / `artifacts-at-head` 等 leg（`--only` 只跑列出的 leg，未列出的 leg 不会被报告为 skipped）；
- **明确不证明**合成树正确、不证明 master 前进后的合并结果；
- 前置断言：`tests/paths.mjs` 的 pin == host `HEAD`，host `porcelain` 为空；否则退出码 2；
- 真实耗时必须在 P0 实测后写入文档（rev 1 的 2–4 / 5–8 分钟估计作废）。

### 3.3 合成树等价模式（发布前/可疑时）

1. 用 `scripts/eb3-merge-tree.mjs --synthesize` 构造 `origin/master + head` 的 merge commit；
2. 在**新 worktree** 中检出该 commit，并断言 pinned host 存在且 pin 一致（`tests/paths.mjs` 与 host `HEAD`）；
3. **为该 worktree 单独准备依赖与构建**：新 worktree 不会继承主工作区的 `node_modules`，也不会继承 gitignored 的 `tests/deepseek-harness-test-use`；
4. 在该 worktree 内运行与 CI 相同的 census 调用（`--full --only census`，2 captures，90s clock）；
5. 输出 leg 行、`added` / `resolved` / `escalations`，以及被评的 tree id。

### 3.4 不允许的取巧（rev 1 的错误，已删除）

- **不得**用 `check-artifacts-at-head` 判断“是否需要构建”：该脚本内部会 `git worktree add` → `pnpm install` → `pnpm build` → glue → composition build，本身已是一次完整构建。
- **不得**把快速模式的绿称为 CI 等价；两档必须在输出里互相标注。
- **不得**写共享只读 baseline host；census 产物写 repo 内 gitignored 路径并清理。

### 3.5 交付形态

`scripts/census-probe.mjs`（新文件，纯本地入口）：

```
node scripts/census-probe.mjs [--fast | --merge-tree] [--captures 2] [--test-timeout 90000]
                              [--census-json <path>] [--base origin/master] [--json]
```

默认 `--fast`；`--merge-tree` 走 §3.3。脚本只调用现有 `ci-pr-gate.mjs` 与 `eb3-merge-tree.mjs`，**不实现第二套比较逻辑**。

### 3.6 `--census-json` 的准确定位

`--census-json` 是**单报告诊断性复评**：它把一份已存在的 vitest JSON 交给同一个比较函数，用于复看/调试，**不是** census 重放。

- 它不能复现两次 capture 的并集判定；
- 报告本身不能证明当时的 timeout、被评 commit/tree、host pin、重采样记录；
- 若将来需要完整重放，必须持久化两份 capture + tree + timeout + pin + 重采样，再用同一比较函数计算。**本轮不做**，但在 `--help` 与输出中披露。

---

## 4. 方案 B：拆出 census，`ci-full` 改名

### 4.1 目标语义

- census 仍然门禁每个 PR；
- `ci-full` 改名为 **`ci-product`**，只保留 8 个非 census leg，`hostFree: true`；
- 新增 **`ci-census`** 层（host + host-security + census），`hostFree: false`；
- “product 与 census 都绿”由 **`ci-required` 聚合器的 `needs`** 表达；
- **分支保护不变**（仍只 require `ci-required`）。

### 4.2 为什么拒绝“新增第 4 个必需上下文”

| 风险 | 说明 |
|---|---|
| skip 被当作通过 | 被跳过的必需 job 报告 `skipped`，branch protection 接受为通过；`ci-required` 的全部价值就是消灭这条路径 |
| 跨上下文不可比 | 两个 check 各自绑定自己的 sha，没有“评的是同一棵树”的保证（现在由 `synthesize` + merge-tree binding 保证） |
| 延迟语义分裂 | `ci-defer-full` 必须同时影响两个上下文，否则出现“一绿一红、无法合并也无法诊断”的死锁 |
| 与 EB3-C 明文冲突 | `ci-required.yml` 头注释与 manifest `aggregate.note` 都声明它是 the ONE Required context |

### 4.3 目标形态

```
synthesize (11s)
 ├─ ci-fast        (~77s)
 ├─ ci-integration (~51s，含 negative-controls leg)
 ├─ ci-security    (~41s)
 ├─ ci-product     (~1.4min, hostFree: true)   ← 8 个非 census leg，--only 显式列出
 └─ ci-census      (~18min, hostFree: false)   ← host + host-security + census
ci-required (if: always(), needs 全部) → 唯一必需上下文
```

manifest 片段（示意）：

```json
{
  "id": "ci-product",
  "workflow": ".github/workflows/ci-product.yml",
  "mustRunOn": ["workflow_call"],
  "cancelInProgress": false,
  "hostFree": true,
  "legs": ["graph-parse", "kit-home-guard", "state-freshness", "install",
           "blueprint-fence", "typecheck", "lint-identities", "artifacts-at-head"]
},
{
  "id": "ci-census",
  "workflow": ".github/workflows/census-runtime.yml",
  "mustRunOn": ["workflow_call"],
  "cancelInProgress": false,
  "hostFree": false,
  "suiteList": "tests/checks/eb3-host-security-suites.txt",
  "legs": ["host-security-suites", "census"],
  "forbid": ["--allow-refused", "--skip"]
}
```

### 4.4 改动清单

| # | 文件 | 改动 | 为什么必须 |
|---|---|---|---|
| B1 | `dev/ci/eb3-ci-manifest.json` | 层 `ci-full` → `ci-product`（`hostFree:true`，8 leg，`cancelInProgress:false`）；新增 `ci-census`（`cancelInProgress:false`，legs=`host-security-suites`+`census`，保留 forbid）；`deferral.layer` 改 `ci-census`（标签名仍为 `ci-defer-full`）；`movedSuites[].to` 改 `ci-census`；从 `knownNonRequired` 移除 `census-runtime` 条目 | manifest 是唯一声明 |
| B2 | `.github/workflows/ci-full.yml` → `ci-product.yml` | 删 host provision/build 与 census；改用 `--only` 显式列出 8 个非 census leg；改 `name:`/注释 | 层文件是 grader 输入 |
| B3 | `.github/workflows/census-runtime.yml` | ① `on:` 改为**纯 `workflow_call`**（删 `pull_request`/`push`/`workflow_dispatch`；`--assert-tree` 只接受 `pull_request` 事件，旧触发器无法与之共存）；② `workflow_call.inputs.merge_tree`（string，required）；③ 增加 `node scripts/eb3-merge-tree.mjs --assert-tree "${{ inputs.merge_tree }}"` 步骤并设 `EB3_EVENT: ${{ github.event_name }}`；④ `jobs.census-runtime.outputs.verdict` + `on.workflow_call.outputs.verdict` 完整传递；⑤ verdict 由 `if: always()` 步骤从 `${{ job.status }}` 生成；⑥ **`concurrency.cancel-in-progress: false`** | 缺任一项：grader 红，或新层评错树/输出丢失 |
| B4 | `.github/workflows/ci-required.yml` | caller job 改名 + 新增 `ci-census` caller（`with: merge_tree`）；`needs` 与汇总 job 的 `needs` 同步；`required-deferred` 的 needs 同步 | 漏进 needs = 该层失败而聚合仍绿 |
| B5 | `scripts/eb3-ci-required.mjs` | 头注释层名列表；deferral `callerIf` 逐字比对；确认 merge-tree/输出/取消三条规则对新层生效 | 文本不同步报 `CI_LAYER_SKIPPABLE` |
| B6 | `scripts/eb3-ci-negative-controls.mjs` | C9 的 `FULL` 路径与 census 变异夹具、C12 的四层循环、C21/C22 的 fixture 与断言 | 这些 fixture 硬编码 `ci-full`；不改进程会在 `ci-integration` 层红 |
| B7 | `scripts/eb3-security-run.mjs` + `tests/checks/eb3-host-security-suites.txt` | `--layer ci-full` → `--layer ci-census`；文件头注释同步 | 套件归属必须与层一致 |
| B8 | `dev/ci/eb3-impact-graph.json`、`scripts/eb3-ci-manifest.mjs`、`scripts/eb3-merge-tree.mjs` | 检查是否按名字枚举层；如有则同步 | 影响面选择与汇总器可能按名字匹配 |
| B9 | 分支保护 | **不改** | 改动本身就是风险 |
| B10 | 文档与证据 | `ci-full` 引用更新；`SESSION_ROUTER_LOG.md` **只追加** | 文档是快照，引用错会误导下一轮 |
| B11 | 验收证据 | 改为 §8.3 的四类证据 + 静态负控 | 逐字一致既会误报也不能证明没漏测 |
| B12 | 集合完整性断言（新增） | 静态检查 `--only` 清单 ∪ `{census}` == `LEG_ORDER`，否则红 | 防止未来 `LEG_ORDER` 新增 leg 后 product 层静默漏测 |

### 4.5 已采纳的裁决（Q1–Q8）

| 问题 | 裁决 |
|---|---|
| Q1 探针可信度 | 区分 HEAD 快速诊断与合成树等价检查；只有后者要求双 capture + 合成树 + host pin 一致 |
| Q2 必需上下文数量 | 保留单一 `ci-required`，不新增第四个 |
| Q3 deferral 改绑 | 改绑到 `ci-census`，同步 `required-deferred`，**保留标签名** `ci-defer-full` |
| Q4 product 层如何排除 census | 用 `--only` 显式列出 8 个非 census leg；**不用** `--allow-refused census`，也不新增 `--skip` 语义 |
| Q5 master push census | 首版不保留；改纯 `workflow_call`，需要 master 定期复查时另行设计调度入口 |
| Q6 单 capture | 本轮不做（实质性语义降级） |
| Q7 PR 合并 | 不合并：PR-A（本地工具）与 PR-B（CI 结构）分开 |
| Q8 未门禁路径 | 检查 `knownNonRequired`、新层调用与输出绑定、取消策略、合成树绑定，并补针对性负控 |

### 4.6 成本模型（更正后）

墙钟 ≈ `T_synth + max(T_layers) + T_aggregate`；runner-min = `Σ T_layers + T_synth + T_aggregate`。

- 现状：38.6 runner-min；墙钟 ≈19.4 min。
- 方案 B：22.6 runner-min；墙钟 ≈18.3 min（census 层 ≈18.0 仍是长板）。
- B + host cache：≈18.5 runner-min；墙钟 ≈14.2 min（host build 245–264s → ~20s）。

**结论**：B 的收益是计算量 −41%，墙钟只 −1.1 分钟；TTFF/IWC 的改善主要来自 A。

---

## 5. 实施阶段（按审查意见调整）

| 阶段 | 内容 | 产出 | 验收 |
|---|---|---|---|
| **P0** | 基线测量：5–10 个 PR 的 P50/P90（aggregate / legacy pr-gate / informational）；本地 `--full --only census` 的真实耗时 | 数据表 | 数据进 evidence |
| **P1 / PR-A** | `scripts/census-probe.mjs`（fast + merge-tree 两档）、`--census-json` 定位披露 | PR-A | 真实耗时 + 一个负控（注入新红必须非零退出） |
| **P2 / PR-B** | B1–B12 一次性改全 | PR-B | 静态检查 + 负控 + hosted 验收（§8.2/§8.3） |
| **P3** | hosted 端到端：绿路径 + deferred 红路径 + 分支保护三上下文不变 | 证据 | 合并前最后一步 |
| **P4（独立）** | host cache / pnpm cache / legacy `pr-gate` 去重 | 另开提案 | 独立验收 |

P1 不改任何判定，风险最低；P2 必须一次改全（中间态必然红）；P3 未过不得合并；P4 不与本轮捆绑。

**回滚**：P2 单 PR revert 即可恢复 `ci-full`；分支保护全程未变。

---

## 6. 红线/不变量

1. `ci-required` 仍是唯一必需上下文；absence/skip/refused/cancel 仍必须非绿。
2. census 比较语义不变（身份集合、并集、escalation、计数漂移不算红、load family 重采样、clock 入行）。
3. `--allow-refused census` 与 `--skip census` 在 census 层仍被禁止；product 层用 `--only` 不执行 census，而不是执行后声明 refusal。
4. 不修改 upstream DSH、不改权威指针/`AGENTS.md`/`graph.yaml`、不影响 `:3080`、不写共享 baseline host。
5. `SESSION_ROUTER_LOG.md` 只追加。
6. 1 task = 1 branch = 1 worktree = 1 writer；每个 PR 走独立 Review。

---

## 7. 风险登记

| ID | 风险 | 可能性 | 影响 | 缓解 | 检测 |
|---|---|---|---|---|---|
| R1 | 拆层后 census 被某条路径跳过，聚合仍绿 | 中 | 假绿（最高） | 层内 forbid + grader 三条规则 + C21/C22 负控 | 负控 + `eb3-ci-required.mjs` |
| R2 | 半成品改名使 `ci-integration`（负控）红 | 高 | 低 | 预期行为；B6 同 PR 改全 | 负控 leg |
| R3 | 本地探针绿而 CI 红（flake/负载） | 中 | 中 | 两档标注 + L1 披露；最终 head 必须真 CI | 对照记录 |
| R4 | 探针评错树（base 前进） | 中 | 中 | merge-tree 模式强制合成并打印 tree id | 探针自检 |
| R5 | host cache 命中但 pin 漂移 | 低 | 高 | cache key 含 pin；命中后仍跑断言 | pin 断言 |
| R6 | `deferral` 文本不同步 | 中 | 低 | 逐字复制 manifest 值 | grader |
| R7 | 拆分后 repo install 重复 | 中 | 低 | product 层一次 install；census 层自带 build | 计时对比 |
| R8 | 分支保护被改成 4 上下文 | 低 | 高 | 明文禁止（B9） | 分支保护 diff |
| R9 | 本地探针被当成“可以不合 CI” | 低 | 高 | 输出固定打印“不替代 CI” | 文档 + Review |
| R10 | 90s/2 captures 被顺手降级 | 中 | 中 | 明确非目标；配置差异检查（§8.3） | 证据比对 |
| **R11** | 新层遗漏 `cancel-in-progress: false` | 中 | 中 | B3 明示；grader `CI_LAYER_CANCELLABLE` | 静态检查 |
| **R12** | 新层遗漏 merge-tree 绑定或 `merge_tree` 输入 | 中 | 高（评错树） | B3 四项绑定；grader 逐条检查 | 静态检查 |
| **R13** | `LEG_ORDER` 新增 leg 后 product `--only` 清单漏更新 | 中 | 高（静默漏测） | B12 集合完整性断言 | 静态检查 |
| **R14** | 探针的 merge-tree worktree 缺 `node_modules`/pinned host | 高 | 中（假绿/跑不起来） | §3.3 第 3 步显式准备；快速模式只在主工作区 | 探针前置断言 |
| **R15** | 把单报告复评误读成 census 重放 | 中 | 中 | §3.6 披露 + 输出标注 | 文档 |
| **R16** | `census-runtime` 同时留在 `knownNonRequired` 与新层 | 中 | 中（声明冲突） | B1 移除条目 + 静态负控 | grader/负控 |

---

## 8. 验收标准

### 8.1 方案 A

```bash
# 快速模式（日常）：只跑 census leg，不证明合成树
node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 --census-test-timeout 90000

# 合并树等价模式：先 synthesize，再在准备好的 worktree 内跑同一命令
node scripts/census-probe.mjs --merge-tree

# 单报告诊断性复评（不是重放）
node scripts/census-probe.mjs --census-json <报告>
```

通过条件：已知绿 head 返回 0 且 `added=[]`；注入一个新红的临时 commit 返回非 0 且 `added` 精确列出该身份；`--fast` 必须在输出中标注“非 CI 等价”；真实耗时记录进 P0 数据表。

### 8.2 方案 B（静态 + 负控）

```bash
node scripts/eb3-ci-required.mjs            # 期望 0 findings
node scripts/eb3-ci-negative-controls.mjs   # 期望全绿（含改名后的 C9/C12/C21/C22）
```

通过条件：

1. `ci-required` 的 `needs` 完整包含 `ci-product` 与 `ci-census`；
2. 新层通过 merge-tree 绑定、workflow_call 输出、`cancel-in-progress: false` 三条规则；
3. `--only` 清单 ∪ `{census}` == `LEG_ORDER`（B12 断言）；
4. `census-runtime` 不再出现在 `knownNonRequired`，且静态负控证明“新必需层不会同时被声明为 informational”（R16）。

### 8.3 拆分等价性证据（替代 B11）

workflow 文件本身在被评的树内，因此改名前后**不可能有相同 tree id**，“逐字一致”不是可执行的等价性证明。改为四类证据：

| 检验对象 | 验收要求 | 方法 |
|---|---|---|
| **测试配置不变** | 九根范围、baseline 路径、2 captures、90s clock、forbid 集合在合并前后完全一致 | 对 manifest 与新 workflow 做机器 diff；差异必须为空集（除层名/路径） |
| **全人口实跑** | 新 `ci-census` 在已知绿树上执行全部人口，无意外缺席、无 refusal、无 skip | 检查 leg 行 `roots`/`captured`/`refused=0`，并与基线声明比对 |
| **失败注入** | 注入一条新 red 与一次 collection escalation，`ci-required` 必须变红 | 临时提交 + 一次 hosted run（或本地等价） |
| **拆层拓扑** | census 缺席 / 跳过 / 取消 / 输出缺失 四种情形，`ci-required` 均不能绿 | 负控夹具（C21/C22 扩展）逐一变异 |
| **声明一致** | 新必需层不出现在 `knownNonRequired`；退休的 standalone job 不触发 `CI_DECLARED_JOB_ABSENT` | 静态负控 |

### 8.4 Hosted 验收（P3）

1. 正常绿色路径：五个层全绿、聚合绿、分支保护仍为 3 个上下文；
2. deferred 红色路径：带 `ci-defer-full` 时 `ci-census` 被跳过、product 绿、**聚合红**；
3. 记录该轮 P50/P90 与 TTFF/IWC，作为 §2.5 的对照。

---

## 9. 已测量 vs 估计 vs 未验证

| 项 | 数值 | 性质 |
|---|---|---|
| ci-full 1028s、census 676s、host 245s、typecheck 25s、lint 22s、artifacts 17s | §2.2 | 实测（job `124575440260`） |
| census-runtime 18.3 min（host 264s + census 796s） | §2.3 | 实测（run `41508157238`） |
| 文档 PR 上 ci-full 21m26s、census-runtime 18m31s | §2.3 | 实测（run `41515916542` / `41515916372`） |
| 现状 38.6 runner-min；B 后 22.6；B+cache 18.5 | §2.4 | 实测分量 + 算术 |
| B 后墙钟 ≈18.3 min；B+cache ≈14.2 min | §4.6 | 模型推算 |
| 本地快速模式耗时 | — | **未测量**（P0 必测；rev 1 的 5–8 分钟估计作废） |
| merge-tree 模式的耗时 | — | 未测量（预计接近 CI census 层减去 runner 启动开销） |
| `eb3-ci-pr-gate.mjs --self-test` 在只读沙箱内可跑 | — | **未验证**（沙箱只读，`mkdtemp` 被拒） |

未决事实：本地 vs runner 的 flake 率差异；cache 命中率与失效边界；P50/P90 基线（P0 采集）。

---

## 10. 复审后的剩余问题（不阻塞本轮修订）

1. master 定期 census 的调度入口形式（`schedule` + 单 capture？）——首版不做，单独设计。
2. host build cache 的 key 组成（pin + lockfile hash + 平台）与失效策略。
3. legacy `pr-gate` 与 `ci-required` 的职责边界（是否最终退休 `pr-gate`，还是保留为独立第二意见）。
4. `--only` 集合断言放在 `eb3-ci-required.mjs` 还是单独的静态脚本（B12 的落点）。

---

## 附录 A：复审阅读顺序

1. `.github/workflows/ci-required.yml`（聚合器与 deferral 语义）
2. `.github/workflows/ci-full.yml`（今天最贵的层）
3. `.github/workflows/census-runtime.yml`（第二份普查；注意其 `cancel-in-progress: true` 与缺 merge-tree 绑定）
4. `dev/ci/eb3-ci-manifest.json`（唯一声明）
5. `scripts/eb3-ci-required.mjs`（取消/绑定/输出/skippable 四组规则）
6. `scripts/ci-pr-gate.mjs`（`LEG_ORDER`、`--only`、`compareCensus`、census capture 循环）

## 附录 B：证据索引

| 事实 | 出处 |
|---|---|
| 单轮 job 耗时 | run `41214261445`，job `124575440260`（ci-full） |
| census-runtime 耗时 | run `41508157238`；文档 PR 轮 run `41515916372` |
| census leg 行 | 上述 run 的 step log（`DSH-CI-LEG leg=census …`） |
| 分支保护 contexts | `pr-gate` / `ci-required` / `pr-settlement-gate`，`strict: true` |
| 基线人口 | `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` |
| 负控硬编码层名 | `scripts/eb3-ci-negative-controls.mjs`（C9 `FULL`、C12 四层循环、C21/C22） |

## 附录 C：成本公式（更正）

```
墙钟      ≈ T_queue + T_synth + max(T_layers) + T_aggregate
runner-min ≈ Σ T_layers + T_synth + T_aggregate

现状:  T_layers = {fast 77s, integration 51s, security 41s, full 1028s}
       + 独立 census-runtime ≈1100s
       → 小计 38.6 runner-min（另 legacy pr-gate ≈2.1 + candidate ≈0.2）

方案B: T_layers = {fast 77s, integration 51s, security 41s, product ≈85s, census ≈1081s}
       → Σ ≈ 1356s = 22.6 runner-min；max ≈ 1081s；墙钟 ≈ 18.3 min

缓存:  T_census ≈ 21 + 796 + ≈20 = 837s → Σ ≈ 1112s = 18.5 runner-min；墙钟 ≈ 14.2 min
```
