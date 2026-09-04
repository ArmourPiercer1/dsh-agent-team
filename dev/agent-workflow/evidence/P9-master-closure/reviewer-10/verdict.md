# Gate P9（master product closure → master）独立裁决 — reviewer-10

- 裁决者编号：reviewer-10（3 名独立 reviewer 之一，互不可见；本裁决不依赖任何其他审查者的意见或转述）
- 受审门禁：int/P9-master-product-closure → master（int tip 拟 fast-forward 进 master）
- 受审区间：master tip `2c1c200` (R124) → int tip `d23c606`（完整 SHA 见 §1）
- 审查 facet：谱系、合并身份与产品面同一性（只读 + git 检查 + 一次受控构建重放，全部在本审查者专属 worktree `.worktrees/R4MC-1`（detached @ d23c606）内执行）
- 日期：2026-09-05（审查执行日）

**路由核验（ROUTER_RULES §1）**：本会话模型路由为 `qiyuan-self/qwen3.8-27b`（继承自主会话）。核验记录：会话以 qwen3.8-27b 模型启动并继承主代理路由，未混用其他模型；本节按 §1.4 要求记录核验结论。

---

## 裁决

**通过**

受审区间的谱系严格等于「master + task/upstream-rc1-compat + 6 个有记录的 int 增量」；产品面（packages/、scripts/、tests/、pnpm-lock.yaml、根配置）相对 task 分支 tip `bd38827` 的差异恰好等于 6 个 int 增量提交所触及的 7 个文件，其余差异全部在 docs/、dev/agent-workflow/ 与根文档层；references/ 零改动；冻结 fork 分支/tag 未动、test-use byte-clean；受控构建重放在 d23c606 上真实重建的 4 件安装面产物与 R122 验证世界**逐字节一致**（核心断言成立）；生成器与证据 s8-bundle.mjs 代码同一性成立（emit 逻辑零差异）。无阻塞项，无较明显后续风险项，形成后续开发的可靠基础。

---

## 范围

1. 合并身份与谱系（facet 必做 1）
2. 产品面同一性（facet 必做 2）
3. references/ 零改动 + 冻结参照（facet 必做 3）
4. byte-compare 复算 + worktree 内受控构建重放（facet 必做 4，核心断言）
5. 生成器 provenance 代码同一性（facet 必做 5）
6. 红线自检（CORE PATCH BUDGET=0 的区间内可核查部分 + force-push 痕迹本地核查）

不在本 reviewer facet 内：五闸其余四项的独立复跑（install/typecheck+build/test/lint 中仅 install 与 build 为构建重放的一部分已执行；vitest/eslint 由其他 reviewer 负责）、浏览器 smoke、INSTALL.md 语义与 host 配置校验、blueprintSource 解析管线验收——本裁决仅对上述 facet 项负责。

---

## 逐项检查表（命令 → 期望 → 实测 → PASS/FAIL）

### 1. 合并身份

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 1.1 | `git rev-parse 2c1c200 bd38827 d23c606 232316d 39fe1df` | 短 SHA 可唯一解析 | `2c1c2002687eb257c70c01f82d96c51e346bbcda` / `bd388272a5b46386a8f5315d38a2f00f575cbc4a` / `d23c606c5d77cfdb917c1338194be876d76cfddb` / `232316db0e395fc8e616e9c67f4eaac0496f133a` / `39fe1df42f03aabec549d18bfd6527feb7f9f49d` | PASS |
| 1.2 | `git log -1 --format='%H%nparents: %P' 232316d` | parents 恰为 master 2c1c200… 与 task tip bd38827… | `parents: 2c1c2002687eb257c70c01f82d96c51e346bbcda bd388272a5b46386a8f5315d38a2f00f575cbc4a` | PASS |
| 1.3 | `git merge-base 2c1c200 bd38827` | 存在共同基（P7 谱系内） | `959e36358ee7244ff8c7e1e0b8396e70dfef4562`（= int/P7-advanced-semantics tip） | PASS |
| 1.4 | `git merge-base --is-ancestor 2c1c200 d23c606; echo $?` | exit 0（ff 前提） | exit=0 | PASS |
| 1.5 | `git log --format='%H\|%P\|%s' 2c1c200..d23c606`（全量枚举）+ `git rev-list --count` | = 1 merge + 6 int 增量 + task 分支既有谱系，零意外提交 | 共 **111** = 1 merge（232316d，唯一双父提交）+ 6 int 增量（8cf9fcb / 071080d / 2359d31 / ad0a869 / 39fe1df / d23c606，均单父线性）+ 104 task 谱系；`--no-merges --count`=110；`--merges`=仅 232316d | PASS |
| 1.6 | 集合相等：`rev-list 232316d^2 --not 232316d^1` vs `rev-list 959e3635..bd38827` | 两集合相等（task 谱系恰为 104 个既有提交） | a=104, b=104, equal=True（Compare-Object 无差异） | PASS |
| 1.7 | `git branch --format=... \| Select-String int/master/task` | 本门禁 int 分支 = int/P9-master-product-closure @ d23c606；master @ 2c1c200；task/upstream-rc1-compat @ bd38827 | `refs/heads/int/P9-master-product-closure d23c606c…`、`refs/heads/master 2c1c2002…`、`refs/heads/task/upstream-rc1-compat bd388272…` | PASS |
| 1.8 | `git merge-base --is-ancestor 2c1c200 origin/master` 及 `git log 2c1c200..origin/master` | origin/master 为本地 master 祖先（本地纯领先，符合"禁止 push，Gate 后由主 Agent 推送"） | origin/master=`a733e9f376501fc414ca36e95d7505a7688d88c0`（R123 提交）；2c1c200..origin/master=0 commits；merge-base(2c1c200, origin/master)=a733e9f3 本身 → 本地 master 领先 1 提交（R124），无分歧 | PASS |
| 1.9 | 对 5 个有远端跟踪的 ref（master、int/P8-S-backend-closure、int/P8-remote-projection、int/T12-production-closure、task/upstream-rc1-compat）：`git merge-base --is-ancestor origin/<r> refs/heads/<r>` | 全部 exit 0（远端均为本地祖先，无分歧、无 force-push 后分叉迹象） | 5/5 exit=0 | PASS |

补充结构性事实（强化 1.2–1.6）：master 侧 base 之后谱系 `git rev-list --count 959e3635..2c1c200` = 51 个提交，其中触及产品路径的提交数 = **0**（`git diff --name-only 959e3635 2c1c200 -- <产品路径>` = 空；51 提交改动全部为 dev/agent-workflow 962 文件 + docs 3 + AGENTS.md + README.md，即 R50–R124 编排留痕线）。因此 merge 在构造上不可能丢弃任何 master 侧产品状态——全部产品工作（T12/P8-S/P9/R122 compat）都位于 task 分支谱系内。

### 2. 产品面同一性

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 2.1 | `git diff --stat bd38827 232316d -- packages scripts tests pnpm-lock.yaml package.json tsconfig.json vitest.config.ts eslint.config.mjs .github` | 空（merge 产品树 == task tip 产品树） | 空（无任何输出） | PASS |
| 2.2 | `git diff --name-only bd38827 d23c606 -- <产品路径>`（记为集合 F） | 恰好 = 6 个 int 增量产品文件并集 | F = 7 文件：`eslint.config.mjs`、`package.json`、`packages/client/package.json`、`packages/runtime/package.json`、`pnpm-lock.yaml`、`scripts/build-client-composition.mjs`、`scripts/place-dist-glue.mjs` | 见 2.3 |
| 2.3 | 并集 U：对 6 个 int 增量逐个 `git diff --name-only <c>^ <c> -- <产品路径>` 取并集 | F == U（集合相等） | U（unique）= 同 7 文件；Compare-Object 判定 **SET EQUAL: F == U**；逐增量明细：8cf9fcb=4（eslint.config.mjs, package.json, scripts/build-client-composition.mjs, scripts/place-dist-glue.mjs）、071080d=2（packages/runtime/package.json, pnpm-lock.yaml）、2359d31=0、ad0a869=2（packages/client/package.json, pnpm-lock.yaml）、39fe1df=0、d23c606=0（共 8 处触及、7 个唯一文件） | PASS |
| 2.4 | 逐增量声明一致性（commit message 声明 vs 实际触及） | 各增量实际文件 ⊆ 其声明范围 | 8cf9fcb「productize the client composition build + dist glue placement」→ 恰为 2 个构建脚本 + 根 package.json（build:composition 接线）+ eslint.config.mjs；071080d「declare row-owned runtime deps」→ 恰为 runtime package.json + lockfile；ad0a869「client link: devDeps -> registry-published pins」→ 恰为 client package.json + lockfile；2359d31/39fe1df/d23c606 声明 docs/evidence/doc-only → 产品文件恰为 0 | PASS |
| 2.5 | `git diff --name-only 2c1c200 d23c606`（全量枚举 1269 文件）分类 | 产品面 / 文档 / 证据 / 根文档；references/ 零 | 分类：PRODUCT 375、EVIDENCE(dev/agent-workflow) 891、DOCS 1（docs/INSTALL.md）、根文档 2（AGENTS.md、.gitignore）、OTHER 0、**references 0**（375 产品文件中 368 个来自 task 谱系经 merge 进入 + 7 个 int 增量文件，与 2.1/2.2 自洽） | PASS |
| 2.6 | `git diff --name-only 39fe1df d23c606` | 不含任何产品路径 | 恰 3 文件：`dev/agent-workflow/evidence/P9-master-closure/r125-template-audit.log`、`…/r125-template-audit.mjs`、`docs/INSTALL.md` | PASS |
| 2.7 | `git diff --name-status 2c1c200 bd38827 -- <产品路径>` | 无 task 侧删除（task 产品树 ⊇ master 产品树，merge 采用 task 侧不丢产品文件） | M:144 / A:228 / **D:0**（372 文件） | PASS |

### 3. references/ 零改动 + 冻结参照

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 3.1 | `git diff --name-only 2c1c200 d23c606 -- references` | 空 | 空 | PASS |
| 3.2 | `git ls-tree -r --name-only d23c606 -- references \| 计数` | 0（references/ 从不被 track） | 0 | PASS |
| 3.3 | `git -C references/deepseek-harness for-each-ref refs/heads/feat/team-vnext-integration-20260829` + `rev-parse 'legacy-agent-team-pre-vnext^{commit}'` | 分支 tip 与 tag（annotated）均锁 `a3ab319927…` | 分支=`a3ab31992762c5d6560797eabc7e0885a9320ade`；tag object `276b3f8b…`（type=tag）→ 解引用 commit=`a3ab31992762c5d6560797eabc7e0885a9320ade`；两者相同 | PASS |
| 3.4 | `git -C references/deepseek-harness status --porcelain`（计数） | 空（工作树 clean） | 0 行 | PASS |
| 3.5 | `git -C references/deepseek-harness rev-parse HEAD` + log -1 | 与 AGENTS.md 目录约定行一致：工作树 checkout HEAD 现于 `cd5ef814…`（upstream 0.1.2-alpha.1 基线，2026-09-04 基线对比用检出，状态 clean） | HEAD=`cd5ef8148158c3a752a658978873241fdf8e2bbc`（"Merge pull request #3248 … release/dsh-0.1.2-alpha.1"），porcelain 0 行 → 与 AGENTS.md 行逐字段一致 | PASS |
| 3.6 | `git -C references/deepseek-harness-test-use rev-parse HEAD` + `status --porcelain` | 基线 0.1.2-rc.1 @ `76fda72979…`，byte-clean pristine | HEAD=`76fda729799fe9b3848dbe2c211d4b231032b81e`；porcelain 0 行 | PASS |

### 4. byte-compare 复算（核心断言）

参考世界：`references/.dsh-test-s8-2026-09-04T12-26-59/`（只读参照）。

**4a. 参考产物 SHA-256 复算（`Get-FileHash -Algorithm SHA256`）**

| 产物 | 自算 SHA-256 | 与 byte-compare.md 记录 | 结论 |
|---|---|---|---|
| s8-client-row/client-bundle.js（845581 B） | `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997` | 一致（记录值 2097CE5E…B86997） | PASS |
| s8-client-row/index.js（328 B） | `D385C065BBFAA8A2ABE3A98FE67FBC763A959A1FFB5DB05E9E177337CE3D2273` | byte-compare.md 未记录（本 reviewer 独立首算，留作重建比对基准） | 基准建立 |
| s8-client-row/package.json（497 B） | `B4509233321F8D293BE0A1C6679F3AA3400B7C94B3425D13A6E2CB71846FFA6A` | 同上 | 基准建立 |
| dist glue 参考（byte-compare.md 记录"RC1 dist 已验证副本"） | 记录值 `D50D3B3FBE371078B31208DC1E87F2DA1D5DE309D243E99E6AE9BB452B40225B`；磁盘旁证：P9-MC/P9/RC1/R2MC-1..3/R3MC-1..3 各 worktree 的 src 与 dist 副本均为同 hash | 自洽 | PASS（参考基准） |

**4b. 受控构建重放（本 worktree `.worktrees/R4MC-1` @ d23c606，初始无 node_modules/dist/composition-shim、无 references/、无 junction farm）**

| 步骤 | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 4b.1 | `pnpm install --ignore-scripts` | exit 0；依赖全部从 npm registry（暖 store D:/.pnpm-store）解析，lockfile 不变，无 worktree/junction/手工 link | 首次后台运行中途 exit 1（无错误输出，环境性中断）；前台重跑 exit 0：`Lockfile is up to date, resolution step is skipped`，463 包 `reused 463, downloaded 0`，"Lockfile passes supply-chain policies" | PASS（重跑后） |
| 4b.2 | 逐包 tsc：对 9 包（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit）各 `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json` | 9/9 exit 0 | 9/9 exit=0（耗时 0.2s–26.7s；client 26.7s、runtime 25.5s、tools 21.1s 为主要构建） | PASS |
| 4b.3 | `node scripts/place-dist-glue.mjs` | exit 0；byte-identical 放置 1 件（agent-bindings.mjs src→dist） | exit 0：`place-dist-glue: … (byte-identical)`、`done (1 placement(s))` | PASS |
| 4b.4 | `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim`（= `pnpm build:composition` 后半） | exit 0；产出 client-bundle.js + index.js + package.json | exit 0：`85 modules, 11 css files`；entry=plugin/client.js；externals 恰为基线 4 项；bundle 845581 B（与参考同尺寸） | PASS |
| 4b.5 | 4 件安装面产物 SHA-256 复算并逐一比对参考 | 4/4 byte-identical（核心断言） | client-bundle.js `2097CE5E…B86997` = 参考 ✓；index.js `D385C065…D2273` = 参考 ✓；package.json(shim) `B4509233…FFA6A` = 参考 ✓；dist glue agent-bindings.mjs `D50D3B3F…40225B` = 记录参考 ✓（且 glue src==dist byte-identical=True，src 本身即 `D50D3B3F…`）。**ALL FOUR BYTE-IDENTICAL: True** | PASS（核心断言） |

### 5. 生成器 provenance

| # | 命令/方法 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 5.1 | `git diff --no-index -U0 dev/agent-workflow/evidence/P9/P9/s8/s8-bundle.mjs scripts/build-client-composition.mjs`（机器级逐行比对，全文 578/589 行通读） | 仅允许文件头/日志前缀/未用 import 差异；不允许 emit 逻辑差异 | 全部差异恰 7 组，逐组归类：(1) 文件头标题+Provenance 注释块；(2) 头内 "adapter"→"builder" 措辞；(3) Usage 行（脚本名+repo root 说明）；(4) import 行：删除未用 `readdirSync`/`statSync`（显式允许项）；(5) usage 错误消息字符串（console.error，harness 侧，不进产物）；(6) `die()` 前缀 `s8-bundle:`→`build-client-composition:`；(7) 末尾 6 行 console.log 前缀同上。**emit 逻辑零差异**：全部 `parts.push(...)` 字符串、transformModule/statementAt/parseImportDecl/makeScanner/resolveImport/可达性遍历/nodeHalf 文本/shimPkg JSON 逐字节相同；与 4b.5 的 byte-match 互相印证 | PASS |
| 5.2 | 实际路径核验 | provenance 引用的证据文件存在 | 实际文件位于 `dev/agent-workflow/evidence/P9/P9/s8/s8-bundle.mjs`（evidence/P9 下嵌套 P9/ 子目录）；见 Findings F1 | 记录 |

---

## Findings

- **F1（轻微，文档级，不阻塞）**：`scripts/build-client-composition.mjs` 头注释与 `byte-compare.md` §1 引用的证据路径写作 `dev/agent-workflow/evidence/P9/s8/s8-bundle.mjs`，而实际文件位于 `dev/agent-workflow/evidence/P9/P9/s8/s8-bundle.mjs`（`evidence/P9/s8` 不存在）。纯路径引用不精确，不影响任何行为或产物字节；provenance 声称本身（代码逐字源出 s8-bundle.mjs）已由 5.1 独立证实。
- **F2（环境观察，非仓库缺陷）**：本 reviewer 首次后台 `pnpm install --ignore-scripts` 在约 258/463 包处无错误输出地 exit 1；同命令前台重跑完整成功（463/463，exit 0），无残留状态影响。记录为沙箱/环境瞬断观察，与受审内容无关。
- **F3（上下文注记，非缺陷）**：origin/master 停留在 `a733e9f3`（R123），本地 master 领先 1 提交至 `2c1c200`（R124，"push executed (user-authorized one-time) + bookkeeping sync" 之后未再推送）——符合红线"禁止 push（用户明确许可的一次性推送除外）；master 的 push 由主 Agent 在每个 Gate 通过后执行"。本门禁 ff 进 master 后，master 将含受审区间全部内容。

## 裁决理由

facet 五项必做检查全部 PASS 且均由本人独立命令/检查确认（未采信任何日志结论，未引用其他审查者意见）：

1. 谱系无杂质：111 提交 = 1 merge（parents 恰为 2c1c200+bd38827）+ 6 个与门禁记录一一对应的 int 增量 + 104 个 task 分支既有谱系（集合相等验证），零意外提交；ff 前提成立；所有远端 ref 均为本地 ref 祖先，无分歧/force-push 后分叉迹象。
2. 产品面同一性在构造与实测两层成立：merge 产品树 == task tip（2.1 空 diff），且 master 侧 base 之后 51 提交产品零改动（构造性保证 merge 不丢产品状态）；int tip 相对 bd38827 的产品差异恰为 7 个 int 增量文件（F==U 集合相等）；1269 文件全量归类无 references/、无未声明产品路径；d23c606 相对 39fe1df 纯 docs+evidence。
3. 冻结参照未动：冻结分支与 tag 同锁 a3ab319927…（annotated tag 解引用一致），冻结 fork 工作树 clean @ cd5ef814…（与 AGENTS.md 目录约定行逐字段一致），test-use byte-clean @ 76fda72979…。
4. 核心断言经真实重建成立：干净 worktree 内 registry-only install（lockfile 不变、463 包全复用）→ 9 包 tsc 全绿 → place-dist-glue → build-client-composition，4 件安装面产物与 R122 验证世界逐字节一致（3 件对参考文件直算比对，1 件对 byte-compare.md 记录的 RC1 已验证副本 hash 比对且 src==dist）。
5. 生成器 provenance 成立：机器 diff 确认 emit 逻辑零差异，且由 4 的 byte-match 最终印证。

未发现任何阻塞性缺陷或"较明显后续风险"：产品面差异完全有记录且可逐 commit 归因；安装链在本机真实重放成立；红线（区间内 CORE PATCH BUDGET=0、冻结参照未动、无 force-push 分叉）在本 facet 可核查范围内全部满足。据此按 ROUTER_RULES §3.2 判 **通过**。

---

## 独立复跑清单（本 reviewer 实际执行）

1. worktree 状态核验：`git status`（clean，detached @ d23c606c5d77cfdb917c1338194be876d76cfddb）
2. 谱系：rev-parse 5 SHA；232316d parents；merge-base(2c1c200,bd38827)=959e3635；is-ancestor 2c1c200→d23c606=0；全量 log 枚举（111 条含 parents 与 subject）；rev-list 计数与集合相等（104=104）；--no-merges/--merges 计数；branch 列表；origin/master 关系（0 commits 领先检查、is-ancestor、merge-base）；5 个远端 ref 祖先检查
3. 产品面：diff bd38827..232316d（产品路径）=空；diff bd38827..d23c606（产品路径）=7 文件；逐增量 diff <c>^..c（产品路径）×6；F==U 集合相等；diff 2c1c200..d23c606 全量 1269 文件分类；diff 39fe1df..d23c606；diff --name-status 2c1c200..bd38827（M144/A228/D0）；master 谱系 959e3635..2c1c200 全量 oneline 枚举 + 产品路径 diff=0 + 顶层分组
4. 冻结参照：frozen fork for-each-ref + tag 解引用 + worktree HEAD + porcelain×2；test-use HEAD + porcelain
5. 构建重放：pnpm install --ignore-scripts（1 次后台失败 + 1 次前台成功，463 包）；逐包 tsc ×9（node 直调）；place-dist-glue；build-client-composition；Get-FileHash SHA-256 ×（参考 3 件 + 重建 4 件 + glue src/dist）逐一比对
6. provenance：git diff --no-index -U0 全量比对 + 两文件全文通读
7. 红线 grep：patch-package（tracked 树，命中全部为规则文本/边界日志/负向 fixture）；pnpm-lock.yaml patchedDependencies（无）；package.json pre/postinstall（无）；patches/ 目录（无）；references/ tracked 文件数=0

## 红线自检（本 reviewer facet 范围）

- **CORE PATCH BUDGET=0（区间内可核查部分）**：受审区间 1269 个变更文件中 references/ 零改动（3.1/3.2）；tracked 树无 patchedDependencies、无 pre/postinstall lifecycle 脚本、无 patches/ 目录；`patch-package` 字样仅出现于规则文档、reviewer 边界检查日志与零核扫描器的**负向测试 fixture**（scripts/fixtures/zero-core/plugins/bad-plugin-a/package.json 为 verify-zero-core.mjs 的故意恶意样本）。task 分支 R122 两提交的自述"upstream 零改动、全部适配在本仓库侧"与本 facet 的 diff 证据一致（区间内无任何 upstream 路径变更）。**PASS**
- **冻结 legacy fork**：分支/tag 未动（a3ab319927…）、工作树 clean（3.3–3.5）。**PASS**
- **test-use pristine**：byte-clean（porcelain 0 行）@ 76fda72979…（3.6）。**PASS**
- **无 gated 历史 force-push 痕迹（本地可核查范围）**：5/5 远端跟踪 ref 均为本地 ref 祖先，无任何 ref 分叉迹象；本地 reflog 未作改写迹象检查（非本 facet 手段，且不改变上述结论）。**PASS（本地证据范围）**
- **本 reviewer 未执行**：git commit/push/branch/tag/fetch/任何写 refs 操作；未触碰 D:\deepseek-harness\ 与 3080 端口；未启动任何长驻服务（构建重放全部为有界命令并已终止）；允许写入范围内仅在本 worktree 内产生 node_modules/dist/composition-shim 构建产物与本裁决文件。

## 路由核验行

本会话模型路由为 **qiyuan-self/qwen3.8-27b**（继承自主会话），符合 ROUTER_RULES §1.1/§1.3/§1.4 要求；审查全程未混用其他模型。
