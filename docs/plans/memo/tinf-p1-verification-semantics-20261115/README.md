# TINF P1 — 验证语义补丁（契约层逐测试量词 + aggregator 必需元数据）

**日期**：2026-11-15
**分支**：`task/tinf-p1-contract-quantifier-20261115`（worktree `.worktrees/tinf-p1-20261115`，base `origin/master 32b132017`）
**范围**：外部评审在接受 PR #775（`32b132017`）后仍指出的两个验证语义缺口。只改 `scripts/contract-tiers.mjs`、`scripts/census-aggregate.mjs`、对应测试、`dev/ci/contract-tier-exceptions.json` 的 note、以及文档；无新模块，无 Required-context 变更，无 workflow 变更。
**结论先行**：两个缺口都已修复并有负控；六个 contract 仍 `met=6 excepted=0`；committed exception registry 仍为空；**F-06 仍不在范围**，`required_oracles` 仍为空，L2 P50 ≤ 10 min 仍未达成，91 个未收集测试仍是 set-diff 债务。

## P1-1 — 契约层用错了量词

**旧行为**：`evaluateContracts()` 把所有绑定测试的执行层取并集，再问“required tier 在不在并集里”，即
`∀c ∀l∈Required(c) ∃t∈Tests(c): Runs(t,l)`。因此一个 contract 绑定 A（L1）和 B（仅 L2）、`required_tiers:["L1"]` 会被报 `met`。

**新行为**：逐测试量词
`∀c ∀l ∀t: Runs(t,l)`。
对每个 contract、每个 required tier，**每一个**绑定测试都必须在该层执行。缺口按测试报告：

```json
{ "missing": [{ "tier": "L1", "tests": ["packages/b/test/b.test.mjs"] }] }
```

`missing` 是测量（所有不跑该层的绑定测试）；`unmet` 是其中没有被例外覆盖的部分。`executed_tiers` 仍保留为“绑定文件执行层的并集”，只作信息展示，**不再参与 met 判定**。`status` 仍是 `no-requirement | met | unmet | excepted`。

### 例外作用域（选定方案）

- 例外行可以携带 `tests: [...]`；此时它**只**覆盖 `tests[]` 里点名、且确实属于该 (contract, tier) 缺口的测试。
- 不带 `tests[]` 时覆盖该缺口的全部绑定测试，但 `reason` 必须明说 **`all bound tests`**（大小写不敏感）。否则该行 `CONTRACT_TIER_EXCEPTION_INVALID`，不覆盖任何东西。
- 例外仍按 (contract, tier) 匹配。任一缺口测试未被覆盖 → `CONTRACT_TIER_UNMET` 点名这些测试；全部被覆盖 → 该 tier 进入 `excepted`，`status=excepted`（不是 `met`）。
- 结果：对 `TIERS` 内的层级，一个例外**不可能静默覆盖它没点名的测试**。只点名 A 的例外不覆盖 B，B 仍是 `CONTRACT_TIER_UNMET`。
- 边界：`tier: "oracle"` 的例外不点名测试——census plan 不记录 oracle 结果，所以 oracle 例外只能表示「这个 oracle 缺口已评审」，其 `reason` 必须写明；今天没有契约声明 `required_oracles`，因此这条路径是空真，接 World Factory 时必须重新审视。
- 选择“无 `tests[]` 需 reason 明说”的理由：既允许人工写“整个 (contract, tier) 豁免”，又让这句话成为可审计的显式声明，而不是省略字段的默认值。

### owner 规则

`UNASSIGNED` / `TBD` / `TODO` / `nobody`（trim + case-insensitive）不再是“非空 owner”。它们（以及 `null`/缺失/空串）→ `CONTRACT_EXCEPTION_UNOWNED`，该行不构成豁免。
`measuredExceptions()` 生成的行 `owner: null`、并携带确切的 `tests[]`；在人工把 owner 改成真人之前，同一个 `CONTRACT_EXCEPTION_UNOWNED` 会拒绝它。因此**生成的 registry 不能被误读为已评审 registry**。committed registry 当前为空（六个 contract 全 met），本次只改 note，不新增行。

### 每个授层 leg 都必须过 `gradeLeg()`

旧版只有 `contract-tiers --run --tier <T>` leg 用 `gradeLeg(job, leg)` 对 workflow step 交叉校验；普通 dispatcher leg 只凭 manifest 的 `--run` 声明就授予 L1，于是“改 `suites[]` 但不改 workflow”可以凭空造出一个 L1。现在**所有**授层 leg 都先过同一个 `gradeLeg()`：workflow step 存在（`CI_LAYER_LEG_MISSING`）、未被弱化（`CI_LAYER_LEG_WEAKENED` / `CI_LAYER_LEG_UNPROVEN`）、whole-argv 合法（`CI_LAYER_LEG_EXTRA_ARGUMENT` / `CI_LAYER_LEG_ARGUMENT_MISSING`）。manifest-only 的 `--run` 声明授予零层，拒绝原因记入 `sources.dispatch_runs_rejected`。

### 证明（测试名）

`scripts/contract-tiers.test.mjs`：

- `P1-1: A runs L1 and B runs only L2 — required L1 is UNMET and names B (the old union said met)`
- `P1-1: an exception naming only A does not cover B — the tier stays UNMET and names B`
- `P1-1: an exception naming B covers B — the tier is excepted, not met`
- `P1-1: a tests[]-less exception covers all bound tests ONLY when its reason says "all bound tests"`
- `P1-1: placeholder owner "UNASSIGNED" ... refuses as CONTRACT_EXCEPTION_UNOWNED and excuses nothing`（以及 `unassigned`/`TBD`/`todo`/`Nobody`）
- `P1-1: a dispatcher leg with --run in cmd but NO workflow step grants no tier (manifest-only claim)`
- `F-03 CLI: the real tree passes --check...` 仍断言 `contracts=6 met=6 excepted=0 unmet=0 findings=0`

### 反例输出（verbatim）

真实树 `node scripts/contract-tiers.mjs --check` 的 token：见本 memo 末尾门禁。评审反例在测试内的具体断言：

```
status=unmet
missing=[{"tier":"L1","tests":["packages/b/test/b.test.mjs"]}]
CONTRACT_TIER_UNMET tests=["packages/b/test/b.test.mjs"]
```

## P1-2 — aggregator 容忍缺失的执行计数

**旧行为**：`assertions_executed` 被当作可选；缺失时用 `skipped === assertions ? 0 : null` 推断，只有推断结果恰好为 0 才拒绝；`files_observed` 只在“每个结果都有数字”时才做总数比较。于是手写的 `{state:'PASS', assertions:10, skipped:0}`（没有 `assertions_executed`）通过，且它的 10 条断言被算作“已执行”。

**新行为**：对每个“会让 census PASS”的结果（plan 内且 `state=PASS`）强制：

| 要求 | 拒绝码 |
| --- | --- |
| `assertions` / `assertions_executed` 存在 | `RESULT_EXECUTED_METADATA_MISSING` |
| 二者均为非负整数（`-1`、`1.5`、`"10"` 都被拒） | `RESULT_EXECUTED_METADATA_INVALID` |
| `0 ≤ executed ≤ assertions` 且 `executed + skipped === assertions` | `RESULT_METADATA_INCONSISTENT` |
| `files_observed` 存在 | `RESULT_FILES_OBSERVED_MISSING` |
| `files_observed` 为非负整数且等于 plan 该 root 的 `files_expected.length` | `RESULT_FILES_OBSERVED_MISMATCH` |

这些是 graded codes（verdict 变 `INCOMPLETE`，不是 refusal）：shard 已经产出，aggregator 要给出“不绿 + 点名原因”，而不是拒绝分级。

### fallback 决策：一个都不保留

`skipped === assertions ? 0` 的推断被**整体删除**，包括 REPLAY。理由：录制也是输入；一个能自报 `state=PASS` 的 REPLAY 同样可以把 10 条断言伪造成“已执行”。保留任何 fallback 都需要在输出里标注“这个数字是推断的”，而 REPLAY/LIVE 的边界又只由 shard 自报，等于把可绕过的标签当成安全边界。代价明确写出：**字段出现之前的旧录制会 `INCOMPLETE`，必须重新录制**；本 PR 不做旧录制兼容。LIVE 路径不受影响——`census-execution.mjs` 一直写全 `assertions` / `assertions_executed` / `skipped`。

### summary counts 只从合法字段求和

`assertions_total` / `assertions_executed_total` / `skipped_total` 只累加通过非负整数检查的字段；畸形值贡献 0，并且**不是静默的**：`counts.metadata_invalid` 记录受影响的结果数。一个缺 `assertions_executed` 的结果不再让 total 假装知道它执行了多少。

### 证明（测试名）

`scripts/census-aggregate.test.mjs`：

- `positive control: the complete, consistent shard set aggregates to PASS`（同时断言 `assertions_total=40`、`assertions_executed_total=40`、`skipped_total=0`、`metadata_invalid=0`）
- `P1-2: a PASS result with no assertions_executed is not PASS and its assertions are not counted as executed`
- `P1-2: assertions_executed=-1 is RESULT_EXECUTED_METADATA_INVALID (not a count)`、`...1.5...`、`..."10"...`
- `P1-2: assertions_executed > assertions is RESULT_METADATA_INCONSISTENT`
- `P1-2: assertions_executed + skipped ≠ assertions is RESULT_METADATA_INCONSISTENT`
- `P1-2: a PASS result with no files_observed is RESULT_FILES_OBSERVED_MISSING`
- `P1-2: files_observed off by one is RESULT_FILES_OBSERVED_MISMATCH`
- `LIVE: one stamped invocation per capture, graded from the report it just wrote`（`scripts/census-cutover.test.mjs`）断言真实 live 产物每条 result 都有三个字段且 `executed + skipped === assertions`，2 capture 合计 `1432 / 1410 / 22`

生产端实证：L2 采集记录的每 capture `assertions_executed=9213 assertions_total=9213 skipped_total=0`；live 测试用 705 文件 × 2 capture 的合成报告确认聚合端在同样字段下 PASS。

## baseline 语义更正

`checkPopulationBaseline()` **不比较 catalog digest**：

- 它按 per-root **membership** 比较 `files_expected` 集合。
- baseline 之外的新文件/新 root → `POPULATION_GREW`（非阻塞，token 报告 `growth=POPULATION_GREW added=<n>` 与路径）。
- 删除文件、删除 root、同数替换 → `POPULATION_SHRANK`，要求同一 PR 用 `--accept-population-change <reason>` 重生成。
- `catalog_digest` 只是 baseline 的元数据字段；函数参数名是 `_catalogDigest`，**不参与比较**；digest 漂移本身**不会**被拒绝。
- 旧文档“catalog digest 漂移 → `POPULATION_BASELINE_UNREVIEWED`”的表述是错误的，已在本 patch 中删除/更正。`POPULATION_BASELINE_UNREVIEWED` 仍存在，但只针对缺少 review 元数据（`generated_at`/`catalog_digest`/`accepted_reason`/`accepted_by` 缺失或空）或行结构问题。

## 仍然开放

- **F-06 不在范围**：effect witness 真实性、PTY/process/network 观测、`instrumented` 独立性、真 host E2 负控都未做。
- **`required_oracles` 仍为空**：`CONTRACT_ORACLE_UNPLANNED` 是真空绿的占位闸门；没有 oracle 覆盖可声称。
- **L2 P50 ≤ 10 min 未达成**：无性能改动；M5/M6 实测仍在 ~22 min/job 量级。
- **91 个未收集测试仍是 set-diff 债务**：`--max-uncollected 91` 是路径集合闸门，不等于 0；降到 0 是后续工作。

## 门禁（本 patch 实测）

在**干净 clone**（`git clone --no-hardlinks`，checkout 真实 base `32b132017`，再 cherry-pick 本分支两个 commit）内实测；cherry-pick 后的 tree 与本分支 commit tree 相等（`git rev-parse <commit>^{tree}` 已逐对核对）：

- TINF 十文件命令（`test-catalog` / `tinf-timing` / `host-cache-key` / `census-plan` / `census-aggregate` / `census-cutover` / `dispatch-tests` / `eb3-ci-required` / `tinf-trust-closeout` / `contract-tiers`）：`tests 326 / pass 326 / fail 0`
- `node scripts/eb3-ci-required.mjs` → `EB3-CI-REQUIRED pass workflows=10 findings=0`
- `node scripts/dispatch-tests.mjs --check` → `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0`
- `node scripts/test-catalog.mjs --max-uncollected 91` → exit 0，`tests=869`、`UNCOLLECTED 91`、`digest=sha256:d00bf53a…`、`refused=0 findings=0`
- `node scripts/contract-tiers.mjs --check` → `DSH-CONTRACT-TIERS contracts=6 met=6 excepted=0 unmet=0 findings=0`
- `node scripts/docs-sync.mjs --check` → `docs=159 … findings=0 blocking=0 contracts=20 pairs compared`，exit 0
- `node scripts/lint-identities.mjs` → exit 0（`1684 file(s) linted`，`0` gitignored）
- eslint（5 个改动脚本/测试）：exit 0；`node --check`：全部通过

未验证：CI 上的真实 workflow 执行（本机 clone 验证）；L2 的 P50（无性能改动）；F-06（不在范围）。
