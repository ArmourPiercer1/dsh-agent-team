# TINF M6 — 退役手写测试清单（single authority）

dated: 2026-11-15 ｜ 分支 `task/tinf-m6-retire-handlists-20261115` ｜ 基线 `origin/master e5bf05670f5a4867ff02834b033af4bbcc45b836`（M5 已合并，PR #773）
判据来源：`docs/plans/memo/agent-testing-infrastructure-20261114/11-MIGRATION-AND-ACCEPTANCE.md` §M6；`10-GITHUB-ACTIONS-INTEGRATION.md`；`12-INVARIANTS-AND-NEGATIVE-CONTROLS.md`；`docs/TEST_METHODS.md` §2/§5/§7。

**删除 commit = `f517a5194`**（`ci(tinf-m6): the manifest leg is the ONE test list; workflows dispatch, catalog owns the predicate`）。本文件的 commit 只含账本、指标与日志，不含行为改动；所以「哪一次提交删掉了这个清单」有唯一答案，且回滚只需要 revert 一个 commit。

## 0. 一句话结论

M6 之前，「这次 CI 要跑哪些 node:test 文件」有**两份**手写副本：workflow 的 `node --test <files>` argv，和 `dev/ci/eb3-ci-manifest.json` 里每个 leg 的 `check[]` token。`eb3-ci-required.mjs` 逐字比对这两份，所以它们既不能独立演进，也不能只改一份。M6 把人口（population）**一次**声明在 manifest leg 里，workflow 只写 leg 名；`scripts/dispatch-tests.mjs` 把它解析成显式 argv 再执行。**node:test 的文件清单从这个仓库里消失了**（vitest 的两份清单还在，理由见 §3）。同时关掉了四类「同一个事实有两个真相」的判定分支（§2.2），并用可重放的证据证明**跑的文件集合一个都没变**（§4）。

## 1. 现在只有一条权威链

```
dev/ci/eb3-ci-manifest.json  leg          ← 人口只在这里声明一次
        │   suites[]（显式子集） 或 areas[]（整个目录，按 discovery 收集）
        ▼
scripts/dispatch-tests.mjs                 ← 解析成显式 argv；拒绝未知 leg / 未跟踪文件 /
        │                                    空 area / 空 argv
        │   argv = node --test <每个文件各一个 token>
        ▼
scripts/test-suite-paths.mjs#isNodeSuitePath   ← 「什么算 node:test 套件」只有这一个定义
        │
        ▼
node --test（显式 argv，永不通配）           ← workflow 里只剩 `--run --leg <id>`
```

- **workflow 不再回答「跑哪些文件」**，只回答「哪个 leg」。`.github/workflows/*.yml` 里已经没有任何 `node --test <file>` 行（由 `scripts/test-catalog.test.mjs` 的 `no workflow enumerates a single node:test file` 定律钉住）。
- **manifest 不再有 `check[]`**：`check[]` 是给「按行读 argv 的比对器」用的第二份声明；人口改由 `suites[]`/`areas[]` 承载，`eb3-ci-required.mjs` 用四条具名拒绝去grade它（见 §4）。
- **catalog 不决定「这次跑哪些」**：它只回答「这个路径是不是一个 test / 是哪个 runner」，并提供 digest 与 uncollected 计数。两个工具争当权威比一份清单更糟，所以 catalog 的角色被写进它的文件头（M6 改掉了原来「shadow、workflow 仍是权威」的表述）。

### 1.1 为什么 13 个 leg 保留 `suites[]` 而不是全部 `areas[]`

`areas[]` 只能表达「整个目录」。有 13 个 leg 是**更大目录里的一个子集**，例如 `tests/world-factory` 里有 65 个套件而某个 leg 只要其中 9 个；把它们改成 `areas[]` 会把 56 个未收集套件拉进 CI——那是**行为变化**，M6 明确禁止。于是：

| 形态 | leg 数 | 例子 | 新增套件是否需要改清单 |
| --- | --- | --- | --- |
| `areas[]`（整个目录） | 4 | `tests-checks`（`tests/checks/`）、`devex-diag`、`a5sf-golden-corpus`、`a5sf-diag-r4` | **不需要**：目录里新增的 node:test 套件自动进入该 leg |
| `suites[]`（显式子集） | 14 | 从 65 个 `tests/world-factory` 套件里选 9 个的 leg | 需要（但只改**一处**，不再需要同步 workflow） |

`suites[]` 不是「另一种形状的手写清单」：它不再是 argv 的副本，而是**唯一**的那一份；workflow 侧已经没有可对照的第二份。判据是「同步两份」这件事是否消失，不是「有没有列出文件名」。

## 2. 退役账本

### 2.1 清单（file lists）

| # | 清单 | 位置 | 原来是什么 | owner | 替代机制 | 删除 commit | 回滚 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ci-integration 的 `node --test` argv | `.github/workflows/ci-integration.yml` 的 **17 个步骤**（16 条单行 `run:` + TINF 步骤的 `run: |` 块；共 24 个唯一文件） | 每个步骤一行、把该 leg 的文件名全写出来；删一个文件名就是 `CI_LAYER_LEG_WEAKENED` | ci-integration（host-free） | `run: node scripts/dispatch-tests.mjs --run --leg <id>`，人口来自 manifest leg | `f517a5194` | 见 §5（必须与 #2 成对回滚） |
| 2 | manifest 的 `check[]` token | `dev/ci/eb3-ci-manifest.json`，17 个 leg 的 `check[]`（24 个 token，与 #1 逐字相同） | 「该 leg 的 argv 里必须出现这些 token」的第二份副本，供 `eb3-ci-required` 的按行读器比对 | 同一批 leg | 同 leg 的 `suites[]`/`areas[]`；`eb3-ci-required` 改grade人口本身（`CI_LAYER_LEG_NO_SUITES`/`CI_SUITE_ABSENT`/`CI_SUITE_AREA_ABSENT`/`CI_LAYER_LEG_SUITE_INVALID`） | `f517a5194` | 见 §5 |
| 3 | pr-gate settlement 的单文件 argv | `.github/workflows/pr-gate.yml` 的 `Unit tests (node --test, scripts convention)` 步骤 | `run: node --test scripts/pr-settlement-gate.test.mjs` —— 仓库里**最后一条**手写 `node --test` 行 | `pr-gate.yml#settlement`（第三个 Required context；其「非聚合必需」性质仍声明在 `knownNonRequired`，leg 挂在同一条目下） | `run: node scripts/dispatch-tests.mjs --run --leg pr-settlement-unit`；人口 = `knownNonRequired[].legs[].suites[]` | `f517a5194` | 见 §5 |
| 4 | 第二份 node:test 谓词 `TEST_RE` | `scripts/test-collection-audit.mjs:52`（`/\.test\.(mjs|cjs|js)$/`） | 与 catalog 的 `NODE_SUITE_RE`（`/\.(?:test|spec)\.(?:mjs|cjs|js)$/`）**差一个 alternative** 的同义正则 | audit | 从 `scripts/test-suite-paths.mjs` 导入并 `TEST_RE = NODE_SUITE_RE`（保持旧名）；三处消费者共享同一绑定 | `f517a5194` | `git checkout f517a5194^ -- scripts/test-collection-audit.mjs scripts/test-catalog.mjs && git rm scripts/test-suite-paths.mjs` |
| 5 | 谓词的第二个定义点 | `scripts/test-catalog.mjs` 内联的 `TEST_LIKE_RE` / `NODE_SUITE_RE` / 两个 `is*Path()` | 定义在 catalog 里 → audit 想用就必须 `import test-catalog`，而那会成环（catalog 已经 import audit），于是只能各写一份 | catalog + audit + dispatcher | 搬进**叶子模块** `scripts/test-suite-paths.mjs`（不 import 任何本地模块），catalog 与 audit 都从它取；catalog 仍 re-export 旧符号 | `f517a5194` | 同上 |

两处谓词在本树上的**人口完全相同**（110 个文件，`only-catalog=[]`、`only-audit=[]`），所以 #4 是零行为变化的去重，不是「顺手改语义」；`scripts/test-catalog.test.mjs` 用 `assert.equal(TEST_RE, NODE_SUITE_RE)` 钉住「同一个绑定」。

### 2.2 被替换的判定分支（不是清单，但同属「一个事实两个真相」）

| 分支 | 原来 | 现在 | 为什么必须改 | commit |
| --- | --- | --- | --- | --- |
| `verifyEvidenceRefs` 的「存在即有效」 | `existsSync(target)` 通过就算指针成立；尾部 digest 从不校验；目录/逃逸符号链接也算「有证据」 | 解析（含 realpath）必须落在 artifact 目录内 → `RESULT_EVIDENCE_OUTSIDE`；必须是普通文件 → `RESULT_EVIDENCE_NOT_REGULAR`；尾部 `sha256:` 必须等于文件字节 → `RESULT_EVIDENCE_DIGEST_MISMATCH`（形状不对 → `RESULT_EVIDENCE_DIGEST_INVALID`） | M5 定稿评论记录的 round-1 doctored directory 之所以还能 PASS，就是因为这一条只查存在；尾部 digest 是**没人读的字段**，本身就是第二真相 | `f517a5194` |
| 证据引用尾部的 digest | 写 `canonical-json{root,capture,state,files,assertions,skipped}`（per-root 摘要，无消费者） | 写**文件字节**的 `sha256`（写完再从磁盘读回、用校验器同一个读取器算），并被上面那条校验 | 让字段变成可falsify 的：替换/编辑 artifact 立刻具名拒绝 | `f517a5194` |
| 「证据链 = 独立验证」的措辞 | M5 memo 与 `ci-pr-gate.mjs` 注释暗示 aggregator「能打开它所评分的东西」、链条可走通 | 明确写成 **integrity / self-attestation**：写 artifact 的进程就是派生数字的同一个进程；它只证明指针与字节一致，不证明独立执行 | 措辞比机制更强 = 一种 verdict 分支的失真 | `f517a5194` |
| `--verify-plan` 的重推导 | 永远 `deriveRoots({cwd})`，不带 plan 自己记录的 `allowed` drop → 用 `--allow-dropped-root` 造出的合法 plan **永远** `ROOT_DROPPED_BY_EXCLUDE` | 先用无许可推导；只有拒绝码是 dropped-root 时，才用 plan 自己 `allowed: true` 的条目重试；未记录的 drop 仍拒绝；记录过而树已不再 drop → `PLAN_TASK_SET_CHANGED` | 「planner 祝福过的 plan，verifier 拒绝」= 两条判定不一致 | `f517a5194` |
| `DIGEST_RE` 与其 header | header 声称接受「任何 sha256 git object id」（裸 64 hex），正则只接受 `sha256:<64>` 与 `<40>`；sha256-object-format 仓库无法记录自己的 tree id | 正则接受三形；header 逐形列出；plan 侧与 shard 侧都测「接受/拒绝」两向 | header 与代码不一致时，读者只能猜哪边是真的 | `f517a5194` |
| `census-aggregate` 的 `scope` | `shadow: true, wired_to_ci_required: false`（M5 之后这是**假的**：summary 就是 census leg verdict，而该 leg 是 ci-required 下的 ci-census 层） | `shadow: false, execution_mode: 'plan', wired_to_census_leg: true, decides_census_leg_verdict: true, read_by_ci_required_job: false, writes_required_context_artifact: false, branch_protection_authority: false, decides_what_ci_runs: false` | 一个能让读者以为「红 census 不挡合并」的字段，比没有字段更危险 | `f517a5194` |

## 3. 明确**没有**退役的清单（以及为什么）

按 M6 的规则：**不能证明已被 M1–M5 覆盖的清单不删**。以下每一条都仍然是唯一权威，且不在 M6 的替换范围内。

| 清单 | 位置 | 规模 | 为什么保留 | 若要退役需要什么 |
| --- | --- | --- | --- | --- |
| vitest 安全层套件清单 | `tests/checks/eb3-security-suites.txt` | 65 行 | 这是 **vitest** 的人口，不是 node:test；该文件被 `layer.suiteList` 读取后展开成 vitest argv，**行的顺序与分组**参与超时/阈值行为。M6 的 dispatcher 只解析 node:test（`isNodeSuitePath` 明确不含 `.ts`），没有 vitest 版的 parity 证据，删掉就是行为变化 | 一个 vitest 版 dispatcher + 与今天 argv 逐字相同的 parity 证据（M7 候选） |
| vitest host 层套件清单 | `tests/checks/eb3-host-security-suites.txt` | 12 行 | 同上；且该层 `hostFree=false`，读取 pinned host，任何误改都会把 hosted 运行变成 host-dependent | 同上 |
| `LEG_ORDER` / `productLegs` | `scripts/ci-pr-gate.mjs`、manifest `layers[].productLegs` | 12 个 leg 名 | 这是「哪些 **gate leg** 跑、按什么顺序」的清单，不是测试文件清单；`CI_PRODUCT_LEGS_INCOMPLETE`/`CI_PRODUCT_LEGS_DRIFT` 已经在grade「YAML 的 `--only` 与 manifest 声明是否一致」 | 与 M6 无关的另一件事（census leg 的调用图） |
| 契约→测试引用 | `dev/ci/test-contracts.json` | 20 个契约 | 它是**契约**权威（哪条不变量由哪个测试背书），catalog 会校验每个 `test_refs[].path` 存在；它不是「这次 CI 跑什么」 | 契约注册表退役是契约里程碑的事 |
| 套件迁移记录 | manifest `movedSuites` | 1 条 | 记录一次「为什么这个 host-dependent 套件从 ci-security 移到 ci-census」，是审计线索不是运行人口 | 保留（删掉等于删掉理由） |
| L0 本地选择谓词 | `scripts/ci-local.mjs` 的 `TEST_RE` | 1 条正则 | 回答的是「改这些路径时**本地**该跑哪些测试」，包含 vitest `.ts/.tsx`，与「CI 这次跑哪些 node:test」是不同问题；它没有第二份副本 | 若要统一，需要先有「本地选择 vs CI 人口」的同一套谓词语义 |
| `pr-gate.yml#gate` 的 shell 步骤 | `.github/workflows/pr-gate.yml` | 若干 | 是命令序列（curl/node 调用），不是测试文件清单 | — |

### 3.1 无法用 discovery 表达的部分（必须写下来的限制）

`areas[]` 依赖「目录 = leg 的全部人口」这一前提。#1.1 已说明 13 个 leg 不满足该前提。因此 M6 的完整claim是：**「跑哪些文件」不再有第二份副本**，而不是「每个 leg 都由 discovery 自动扩张」。前者是可证明的（§4），后者对 13 个 leg 会立刻改变 CI 行为。

## 4. 证明：集合没变（不是声明，是重放）

| 证据 | 命令 | 结果 |
| --- | --- | --- |
| 旧 argv vs 新 argv，逐步骤排序比对 | `node scripts/dispatch-tests.mjs --parity --old-ref origin/master` | `DISPATCH-PARITY IDENTICAL steps=18 old_files=25 new_files=25 problems=0`（`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`） |
| 新集合的 digest（防静默漂移） | 同上，`union ... set=sha256:5de65f5e…` | 已提交；`test-catalog.test.mjs` 用**今天**解析出的集合重算并比对，改了集合就必须重生成证据 |
| 人口/谓词不变 | `node scripts/test-catalog.mjs --max-uncollected 91` | `tests=865 digest=sha256:2497b8f9…`，`UNCOLLECTED 91`（与 M5 基线逐字相同；只许降不许升） |
| 每个 leg 都能 resolve 到已跟踪的 node:test 套件 | `node scripts/dispatch-tests.mjs --check` | `DSH-TEST-DISPATCH-CHECK PASS legs=18 bad=0` |
| 18 个 leg 与 18 个 dispatch 步骤一一对应（ci-integration 17 + settlement 1） | `test-catalog.test.mjs` 的 `every dispatch step maps to one manifest leg` | 两个 workflow 各自逐 leg 比对 |
| 四条新定律真的会红 | `negative-controls.mjs`（9 个变异，含 settlement leg） | `DSH-M6-NEGATIVE-CONTROLS PASS cases=9 failed=0` |
| 删除「定律保护的东西」会红 | `mutation-controls.mjs`（7 个删改） | `DSH-M6-MUTATION kill=7/7 rate=100%` |

## 5. 回滚

**整体回滚（唯一推荐）**：

```bash
git revert f517a5194          # 单 commit，行为与文档/证据一起回退
```

**不要只回滚一侧**：只把 workflow 的 `node --test` 行恢复、而 manifest 仍是 dispatch leg，会让 `eb3-ci-required` 报 `CI_LAYER_LEG_UNPROVEN`；反过来只恢复 `check[]` 而 workflow 已是 dispatcher，会报 `CI_LAYER_LEG_MISSING`。半回滚不是「部分回滚」，是「两套都不完整」。

**单条清单回滚（成对，且必须重跑证据）**：

```bash
# #1+#2：ci-integration 的 17 个 node:test leg（恢复 argv 与 check[] 两份旧形态）
git checkout f517a5194^ -- .github/workflows/ci-integration.yml dev/ci/eb3-ci-manifest.json
node scripts/eb3-ci-required.mjs           # 期望 pass workflows=10 findings=0

# #3：pr-gate settlement 的单文件 argv（同时删掉 knownNonRequired 里的 legs[]）
git checkout f517a5194^ -- .github/workflows/pr-gate.yml
# 手工删除 dev/ci/eb3-ci-manifest.json 中 settlement 条目的 "legs": [...]
node scripts/eb3-ci-required.mjs

# #4+#5：谓词去重
git checkout f517a5194^ -- scripts/test-collection-audit.mjs scripts/test-catalog.mjs
git rm scripts/test-suite-paths.mjs
```

回滚任何一条之后，`--parity` 的「before」参照已经变了（`origin/master` 上仍是旧形态，但本树不再是新形态），必须重新生成 `dev/agent-workflow/evidence/tinf-m6-dispatch-parity/*`，否则 `test-catalog.test.mjs` 的集合 digest 定律会红——这是有意的：证据必须与代码同一时刻。

## 6. 残留与已知偏差（不隐藏）

1. **一个步骤名仍写着「M1 catalog shadow」**（`ci-integration.yml` 的 `test catalog + TINF instruments (M1 catalog shadow, …)`）。M6 没有改名：`--parity` 的 before/after 两侧以**步骤名**为键（`scripts/dispatch-tests.mjs` 的 `oldArgvByStep`/`legByStep` 都按 `- name:` 分块建索引），改名会让这条证明失去配对。**这不削弱任何定律**：`CI_LAYER_LEG_DISPATCH_SHAPE` 只读 manifest 的 `leg.cmd`（`--run` 是否存在、是否是最后一个 token），步骤归属由 `mentions()` 读该步骤的 `run:` 文本决定，两者都不读步骤 `name:`；名字只是 CI 界面上的标签，也是 `--parity` 的配对键。要改名就必须同时重生成证据。
2. **`--parity` 是一次性证据**：合并之后 `origin/master` 会包含本改动，`--old-ref origin/master` 将变成「新 vs 新」的恒等比对。因此**提交的 `.txt` 才是证据**，命令只用于复现本分支时刻的对比；`test-catalog.test.mjs` 用集合 digest 而不是 `--parity` 做长期回归。
3. **`pr-settlement-unit` 挂在 `knownNonRequired[].legs[]`**：这不是新权威面，而是承认「job 的 Required-ness」与「该 job 跑哪些套件」是两个问题；M6 对两者都用同一套 leg 定律grade，但它确实让 manifest 多了一个 `legs[]` 位置（只有 1 处），已在 §2.1 #3 记录。
4. **`areas[]` 会在目录里出现新套件时自动改变 CI 人口**：这是 M1 想要的，但它也意味着 `--parity` 的 union digest 会变；改动的正确流程是「新增套件 → 重生成证据 → 在 PR 里说明」，而不是让 digest 定律变红后改断言。
5. **早先一条记录是错的，此处更正**：本会话最初宣称 `docs/runbooks/PR-DRAFT-FIRST.md` 不存在、并据此说「按 ROUTER_RULES §0 + 计划文件执行」。**该文件存在**（`docs/runbooks/PR-DRAFT-FIRST.md`，与 `REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md` 同目录，由 `3a7303ca2`（A6 cold-wake，#758）引入）；当时是在**落后的仓库根 checkout** 上看的（本次复核实测 `git rev-list --count HEAD..origin/master` = 32；协调者指出时记为 28），而不是本 worktree。该 runbook 已在本分支的 worktree 内读过并按其顺序执行（draft → C1–C7 → settlement → ready → merge 的**状态机**；本任务被明确要求不开 PR，所以状态机停在 `DRAFT` 之前，见 §7）。

## 7. 与 `docs/runbooks/PR-DRAFT-FIRST.md` 的关系（本分支实际处于哪一步）

任务书要求「不要建 PR，commit 后报 SHA」，因此 **draft-first 状态机没有启动**：没有 `gh pr create`、没有 `gh pr ready`、没有 push。据此对 runbook 逐条如实记账，**不声称任何未经检查的合规**：

| runbook 条款 | 本分支状态 |
| --- | --- |
| §2 状态机 / 「`gh pr ready` 之后不得再 push」 | **未触发**：无 PR、无 ready、无 push。C7 的「冻结 head」在协调者 ready 之前不适用；本分支的 head 在 ready 之后若再移动，settlement 与 L2 都作废（runbook §2/§5.6），这条约束的是后续操作者，不是本 memo |
| C1 变更完成 | 是：`git status` 干净、三个 commit（代码、账本、文档更正）、无 «fix after CI» TODO；但 `@{u}` 未设（分支未推送），C1 的 upstream 检查要等协调者 push 后才能评估 |
| C2 与 master 同步 | 是：base `e5bf05670` 即当前 `origin/master`，`git merge-base --is-ancestor origin/master HEAD` 退出 0（本分支本地实测，非推断） |
| C3 L1 绿（四层 + `ci-required-deferred`） | **未测**：本分支未推送，没有任何 run。本地等价物（七套件 263/263、catalog、`eb3-ci-required`、`--check`、parity）已列入 §4，但**它们不等于 L1 的四个层 job** |
| C4 独立审查 PASS | **未进行**：M6 没有召集独立审查席位。这是协调者的动作，不由本 memo 代称 |
| C5 文档/证据 | 是：本 memo + `METRICS.md` + 证据目录 + `docs:sync --check` findings=0（本地实测） |
| C6 settlement | **未写，且不应由本 memo 冒充**：settlement 必须是 PR 上以 `**[dated settlement, …]**` 开式的评论、覆盖当时 40-hex head、含 §8.5.2 四要素。**该评论由协调者（或其指定的合并席位）在本 PR 上发布**——本分支既无 PR 也无 dated 开式语境，写了也不算数 |

**PR 打开后 settlement 必须补齐的四要素**（`docs/ROUTER_RULES.md` §8.5.2；本 memo 只提供材料，不代替记录）：

| 要素 | 本分支可提供的材料 | 缺什么 / 由谁补 |
| --- | --- | --- |
| 审查裁决（review verdict） | 无。M6 未经独立审查 | **协调者召集审查席位**并给出 PASS/CHANGES；本 memo 不代填 |
| 审查者席位与模型披露（seat + model） | 作者侧可披露：实现席位 = 本 M6 writer 子会话，模型 `deepseek-v4.1-flash-1017` | 审查席位的 seat+model 只能由该席位自报 |
| 报告 / 证据引用 | `docs/plans/memo/tinf-m6-retire-handlists-20261115/{README,METRICS}.md`；`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/{old-vs-new-argv,negative-controls}.txt`；`SESSION_ROUTER_LOG.md` 的 M6 条 | — |
| 覆盖的 head sha | **不能照抄本文档**：本文档自身每改一次 head 就前进一次。发布时刻的权威 = `gh pr view <n> --json headRefOid`。到目前为止的链：`f517a5194`（代码）→ `cbcf2f3ee`（账本/指标/日志）→ 本文档所在的文档更正 commit | 协调者在写 settlement 的同一时刻读取并写入 40-hex |
