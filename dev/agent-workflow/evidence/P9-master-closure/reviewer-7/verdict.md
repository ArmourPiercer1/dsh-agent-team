# Reviewer-7 裁决 — P9 master product closure（int → master）

**路由核验**（ROUTER_RULES §1）：本会话模型路由为 `qiyuan-self/qwen3.8-27b`（继承自主会话）。

**Facet**：谱系、合并身份与产品面同一性（只读 + git 检查 + 一次受控构建重放，全部在我的专属 worktree `.worktrees/R3MC-1` @ 39fe1df 内执行）。

**日期**：2026-09-05。审查区间：master tip `2c1c200` (R124) → int tip `39fe1df`。

---

## 裁决：通过

## 范围

- 受审区间全量提交谱系（110 commits）的结构分解；
- 产品面（packages/、scripts/、tests/、pnpm-lock.yaml、根配置、.github）在 merge 点与 int tip 的同一性；
- references/ 在受审区间的零改动 + 冻结 fork（`references/deepseek-harness`）状态 + gated 历史 force-push 痕迹扫描；
- byte-compare 独立复算：R122 验证世界（`references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/`）三件产物 SHA-256 重算 + 在我 worktree 内对 39fe1df 的完整构建重放（install → 9 包 tsc build + typecheck → place-dist-glue → build-client-composition PLAIN）→ 4 件安装面产物与参考世界逐字节对比；
- 生成器 provenance：`scripts/build-client-composition.mjs` 与 `dev/agent-workflow/evidence/P9/P9/s8/s8-bundle.mjs` 的代码同一性。

未裁决（非本 facet）：五闸中 test/lint/smoke 的独立复跑（非浏览器部分）、浏览器 vertical、fresh-machine 端到端安装链的宿主侧启动验证。我的构建重放覆盖了 install/typecheck+build 两闸的重放证据（见下），但不替代其他 reviewer 对 test/lint/smoke 的独立裁决。

---

## 逐项检查表

### 检查 1：合并身份

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 1a | `git log -1 --format='%H parents: %P' 232316d` | parents 恰为 2c1c200… 与 bd38827… | `232316db0e…` parents = `2c1c200268… bd388272a5…` | PASS |
| 1b | `git merge-base 2c1c200 bd38827` | 存在分叉点 | `959e36358e…` | PASS |
| 1c | `git merge-base --is-ancestor 2c1c200 39fe1df` | exit 0（ff 前提） | exit=0；`bd38827` 亦为 39fe1df 祖先（exit=0） | PASS |
| 1d | `git rev-list --count 2c1c200..39fe1df` | 110 = 104 task 谱系 + 1 merge + 5 int | 110；`rev-list 2c1c200..39fe1df --not bd38827` 恰为 {232316d, 8cf9fcb, 071080d, 2359d31, ad0a869, 39fe1df}；`rev-list --count 2c1c200..bd38827` = 104（= merge message 声明的 102 P9 + 2 rc1） | PASS |
| 1e | 逐 commit 归类（全量枚举 110 条） | 合并 / int 增量 / task 既有谱系，无意外提交 | 1 merge（232316d，message 与 parents 一致）+ 5 int（R125(1/2)→(3b)，message 与文件面一致）+ 104 task 侧（P9/T12/P8/rc1 谱系，与 merge message "Content = …" 声明一致） | PASS |

### 检查 2：产品面同一性

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 2a | `git diff --stat bd38827 232316d -- packages scripts tests pnpm-lock.yaml package.json tsconfig.json vitest.config.ts eslint.config.mjs .github` | 空 | 空（merge 未改动任何产品文件相对 task tip） | PASS |
| 2b | `git diff --name-status 2c1c200 39fe1df` 全量分类 | 1267 文件 = 产品/文档/证据/配置可完全归类 | 375 产品 + 1 docs（docs/INSTALL.md）+ 889 dev（全部 dev/agent-workflow/）+ 2 根级（AGENTS.md、.gitignore，均见 2e 声明） | PASS |
| 2c | `git diff --name-only bd38827 39fe1df -- <产品路径>` 与 5 个 int commit（`<c>^..c` 并集，产品限定）双向集合差 | 两侧差均为 0 | 产品 diff 恰 7 文件：`eslint.config.mjs, package.json, packages/client/package.json, packages/runtime/package.json, pnpm-lock.yaml, scripts/build-client-composition.mjs (A), scripts/place-dist-glue.mjs (A)`；`prodBd38 − intUnionProd` = 0，`intUnionProd − prodBd38` = 0 | PASS |
| 2d | `git diff --name-only ad0a869 39fe1df` | 无产品路径 | AGENTS.md + 5 个 dev/agent-workflow/evidence/P9-master-closure/ 文件；零产品路径 | PASS |
| 2e | 逐 int commit 文件声明核对 | 产品文件 = commit 声明 | 8cf9fcb：eslint.config.mjs、package.json、2 个新脚本（+.gitignore、docs/INSTALL.md）；071080d：packages/runtime/package.json、pnpm-lock.yaml；2359d31：628 文件全部非产品（证据归档）；ad0a869：packages/client/package.json、pnpm-lock.yaml；39fe1df：6 文件全部非产品（AGENTS.md + 5 证据）。全部与 commit message 声明一致 | PASS |

### 检查 3：references/ 零改动 + 冻结 fork + force-push 痕迹

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 3a | `git diff --name-only 2c1c200 39fe1df -- references` | 空 | 空；且 `git ls-tree 2c1c200 -- references` / `git ls-files references` 均为空（references/ 整体 untracked/gitignored，diff 平凡为空，实体状态见 3b–3e） | PASS |
| 3b | `git -C references/deepseek-harness rev-parse feat/team-vnext-integration-20260829` | a3ab319927… | `a3ab31992762c5d6560797eabc7e0885a9320ade` | PASS |
| 3c | `git -C … rev-parse 'legacy-agent-team-pre-vnext^{commit}'` | 同冻结点 | 同 `a3ab319927…`；branch==tag=True | PASS |
| 3d | `git -C … status --porcelain` + `rev-parse HEAD` | 工作树 clean | clean（porcelain 空）；HEAD=`cd5ef81481…`（本地 master，upstream 0.1.2-alpha.1 基线检出，behind origin/master 755、无 ahead 提交）——与 AGENTS.md 目录约定行描述逐项一致（"冻结点均锁 a3ab319927…；工作树 checkout HEAD 现于 cd5ef814…；状态 clean"），无 finding | PASS |
| 3e | 冻结分支 reflog | 未移动 | 单条 `branch: Created from refs/remotes/origin/…`，之后零移动 | PASS |
| 3f | gated 分支 reflog 扫描（master / int / task，`reflog show --all` 全量 1287 行 grep reset/amend/reword/fixup/force/forced） | 无 gated 历史改写/force-push 痕迹 | master 全前向 `commit:` 条目，零 reset/amend；int/P9-master-product-closure = created-from-master + merge + 5 commit；task/upstream-rc1-compat = created + 2 commit；remote-tracking reflog 全部 `update by push`，零 `forced update`。改写类条目仅见于 task 开发分支（P9/T12 开发期 amend/rebase/reset，gate 之前、已被合入历史吸收） | PASS |
| 3g | `origin/master` 与 local master 关系 | 远端为本地祖先（无 force） | `origin/master`=a733e9f 是 master=2c1c200 的祖先（is-ancestor exit 0） | PASS |

### 检查 4：byte-compare 复算（本 facet 核心断言）

参考值来源：我对参考世界文件的**独立重算**（非转录 byte-compare.md）：

| 参考世界文件 | 我独立重算 SHA-256 | byte-compare.md 记录值 | 一致性 |
|---|---|---|---|
| s8-client-row/client-bundle.js (845581 B) | `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997` | 同 | 一致 |
| s8-client-row/index.js (328 B) | `D385C065BBFAA8A2ABE3A98FE67FBC763A959A1FFB5DB05E9E177337CE3D2273` | （未记录，本次新算） | — |
| s8-client-row/package.json (497 B) | `B4509233321F8D293BE0A1C6679F3AA3400B7C94B3425D13A6E2CB71846FFA6A` | （未记录，本次新算） | — |
| glue 参考副本（`references/.fresh-clone-r125-ad0a869/packages/runtime/dist/…/agent-bindings.mjs`，gitignored 模拟区） | `D50D3B3FBE371078B31208DC1E87F2DA1D5DE309D243E99E6AE9BB452B40225B` | 同 | 一致 |

**受控构建重放（我的 worktree @ 39fe1df，环境 Node v24.20.0 / pnpm 11.7.0 / tsc 6.0.3 / 暖 store D:/.pnpm-store）：**

| 步骤 | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 4a | `pnpm install --ignore-scripts` | exit 0，依赖仅从 registry 解析 | exit 0，"resolved 463, reused 463, downloaded 0"（lockfile 未变、全量 store 复用即 registry 缓存）；1m12s；`✓ Lockfile passes supply-chain policies` | PASS |
| 4a' | registry 存在性独立核验（14 个 pinned spec 逐一 GET packument + 版本键检查，含对照组 react/@eslint/js） | 全部 PRESENT | @deepseek-ai/{dsh-agent,dsh-llm,dsh-mcp-client,dsh-session,dsh-storage-domain}@0.1.2-rc.1、cordis@4.0.2、dsh-client-{locale,store,test-runtime,ui-conversation,ui-primitives,ui-slots}@0.1.2-rc.1、zod@4.4.3、yaml@2.9.0 全部 PRESENT | PASS |
| 4b | `pnpm -r run build`（9 包 tsc -p tsconfig.build.json） | 9/9 exit 0 | 9/9 Done，BUILD_EXIT=0（contracts/legacy/domain/runtime/storage/testkit/tools/client 全过） | PASS |
| 4c | `pnpm -r run typecheck`（9 包 tsc -p tsconfig.json） | 9/9 exit 0 | 9/9 Done，TYPECHECK_EXIT=0 | PASS |
| 4d | `node scripts/place-dist-glue.mjs` | 放置成功 | exit 0，1 placement（src→dist 逐字节复制，fail-closed 逻辑在脚本内核对过：src 缺失或 dist 根缺失即 exit 1） | PASS |
| 4e | `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim`（PLAIN，无 --probe） | 构建成功 | exit 0：85 modules、11 css、entry=plugin/client.js、externals=[react, react/jsx-runtime, @deepseek-ai/dsh-client-store, @deepseek-ai/dsh-client-ui-primitives]、client-bundle.js 845581 B（与参考世界文件大小相同） | PASS |
| 4f | 4 件安装面产物 SHA-256 vs 参考世界 | 全部 byte-identical | client-bundle.js `2097CE5E…` = 参考 `2097CE5E…` **BYTE-IDENTICAL**；shim index.js `D385C065…` = 参考 **BYTE-IDENTICAL**；shim package.json `B4509233…` = 参考 **BYTE-IDENTICAL**；dist glue agent-bindings.mjs `D50D3B3F…` = 记录/参考副本 **BYTE-IDENTICAL** | PASS（核心断言成立） |

含义：在 39fe1df 上 `pnpm install --ignore-scripts && pnpm build && pnpm build:composition` 得到的安装面（client bundle + shim 两件 + dist glue），与 R122 在 0.1.2-rc.1 上 live 验证过的 s8-client-row 安装面逐字节一致。byte-compare.md 记录在 8cf9fcb 上计算，39fe1df 相对 8cf9fcb 的产品面差异仅 packages/client/package.json（devDeps 钉版，不改 tsc 输出）+ pnpm-lock.yaml，4f 的 byte-match 实证了不变性。

挂载模板同一性（辅助）：参考世界 `profiles/web/cordis.patch.yml` 的 host 行 config 字段集（bootPhase/rootSessionId/blueprintSource/seedMembers/generation/deniedSelection/mcpServer/staticModel/environmentFacts/externalPolicyFacts/glueUrl/seamUrl）与 `docs/INSTALL.md` §3 模板逐字对齐（含三个 fail-closed 必填字段），client 行为同一相对形态（`../../s8-client-row/index.js` ↔ `../../team-client-row/index.js`），p6t6 观测行与 directory-picker pin 属测试装置（INSTALL.md §7 明示 local-only）。

### 检查 5：生成器 provenance

| # | 检查 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 5a | `git diff --no-index -U1 evidence/P9/P9/s8/s8-bundle.mjs scripts/build-client-composition.mjs` | 仅文件头/日志前缀/未用 import 差异，无 emit 逻辑差异 | 25 insertions / 14 deletions，全部 6 个 hunk 逐一归类：① 头注释重写 + provenance 声明（doc）；② import 行移除未用的 `readdirSync, statSync`；③ usage 错误信息字符串；④ `die()` 前缀 `s8-bundle:`→`build-client-composition:`（log）；⑤⑥ 尾部 6 行 console.log 前缀（log）。`transformModule`/`resolveImport`/scanner/`parts[]` 组装/`bundleText`/`nodeHalf`/`shimPkg` 零差异 | PASS（且被 4f byte-match 终裁） |

注：brief 中路径 `evidence/P9/s8/s8-bundle.mjs` 在树内的实际路径为 `dev/agent-workflow/evidence/P9/P9/s8/s8-bundle.mjs`（P9/P9 嵌套），内容即 S8 适配器。

---

## Findings

1. **F1（INFO，文档级）**：`docs/INSTALL.md` §2 注释称 runtime row-owned 依赖为 "5 × @deepseek-ai/*@0.1.2-rc.1 + zod 4.4.3"，而 `packages/runtime/package.json` 实际还声明 `yaml ^2.9.0`（更早由 task 分支谱系 T12-V1 `3075d7a` 声明并记录）。注释不完整；lockfile 与安装链完整（yaml@2.9.0 在 registry PRESENT，install 463 包解析无缺口）。不影响安装面正确性。
2. **F2（INFO）**：2c1c200..39fe1df 全量 diff 中根级 `.gitignore` 与 `AGENTS.md` 两处改动在字面意义外于 "其余差异全部在 docs/ 与 dev/agent-workflow/ 下"，但两者均为 int 增量提交所声明文件（8cf9fcb 增加 `packages/client/composition-shim/` gitignore 条目——生成产物；39fe1df 更新 AGENTS.md 冻结 fork 描述行，与本次 3b–3d 实测一致），不构成本 facet 判据 "产品面差异 = int 增量声明文件" 的例外。
3. **F3（INFO）**：local master（2c1c200）领先 remote-tracking `origin/master`（a733e9f）一个 commit；R124 commit message 声称用户授权一次性 push 已执行。本地 reflog 证据（远端为本地祖先、零 forced update）与"无 force-push"一致；远端实际 ref 状态无法在本地独立验证（未发起网络查询远端 refs，属 push 记账面，非本 facet 红线）。

无 MAJOR/CRITICAL finding。

## 裁决理由

本 facet 的全部五项独立检查均 PASS，且关键断言均由我自己的命令实证而非日志转录：

1. **谱系同一性精确成立**：int tip = master 2c1c200 + task/upstream-rc1-compat bd38827（merge 232316d，parents 恰为其二）+ 5 个有记录的 R125 int 增量；110 个区间提交零意外；ff 前提成立（2c1c200 与 bd38827 均为 39fe1df 祖先）。
2. **产品面同一性精确成立**：merge 相对 task tip 产品面零改动；int tip 相对 task tip 的产品面差异恰为 7 个文件且双向集合差为零，逐一映射到 5 个 int 增量提交的声明；最终两个提交（2359d31 证据归档、39fe1df 文档）零产品触碰。
3. **红线面干净**：references/ 受审区间零改动（且 untracked）；冻结 fork 分支与 tag 同锁 a3ab319927…、工作树 clean、冻结分支 reflog 仅创建一条；test-use 保持 pristine（HEAD=76fda72979…、porcelain 空）；全部 reflog 扫描零 forced update，gated 分支历史纯前向。
4. **安装面字节可复现（核心）**：干净重放（install → 9 包 build+typecheck → glue 放置 → composition 构建）在 39fe1df 上复现出与 R122 live 验证世界逐字节一致的 4 件安装面产物；生成器与 S8 适配器 emit 逻辑零差异。"fresh clone 安装链的挂载产物与 R122 验证世界逐字节一致" 这一门禁判据在本 facet 范围内得到最强形式（byte-level）的独立确认。
5. 三条 INFO finding 均不改变安装面字节同一性、谱系同一性或任何红线状态，且 F1/F2 属文档措辞层面（F1 甚至指向 lockfile 实际覆盖更完整这一有利事实）。

据此，本 facet 范围内有充分证据支持门禁要求已实现，且为后续开发（master 成为可安装产品、后续 Phase 在 master 之上继续）形成可靠基础。

## 我实际执行的独立复跑清单

1. git 谱系：`git log -1`/`merge-base`/`merge-base --is-ancestor`（×2）/`rev-list --count`（×3）/`rev-list --not bd38827`/全量 `log --oneline 2c1c200..39fe1df` 逐条归类；
2. git 产品面：`diff --stat bd38827 232316d -- <产品路径>`；`diff --name-status 2c1c200 39fe1df`（1267 文件全量分类）；`diff --name-only bd38827 39fe1df -- <产品路径>` 与 5 个 int commit `diff --name-only <c>^..c` 并集双向集合比较；`diff --name-only ad0a869 39fe1df`；逐 int commit 产品文件声明核对；`.gitignore`/`AGENTS.md` diff 内容审阅；
3. git 红线：`ls-tree`/`ls-files references`（untracked 证明）；冻结 fork `rev-parse`（branch/tag/HEAD/local master）+ `status --porcelain` + 冻结分支 reflog + `branch -vv`；`reflog show master/int/task` 全量 + `reflog show --all`（1287 行）改写/forced 关键词扫描；remote-tracking reflog 逐条审阅；`origin/master` 祖先关系验证；test-use `rev-parse HEAD` + `status --porcelain`；
4. 哈希：参考世界 s8-client-row 三件产物 + fresh-clone 模拟区 glue 副本 SHA-256 独立重算（Get-FileHash）；
5. registry：14 个 pinned spec 的 packument GET + 版本键核验（含对照组）；
6. 构建重放（我的 worktree @ 39fe1df）：`pnpm install --ignore-scripts`（exit 0，463 包，0 下载）→ `pnpm -r run build`（9/9）→ `pnpm -r run typecheck`（9/9）→ `node scripts/place-dist-glue.mjs`（exit 0）→ `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim`（exit 0，85 modules/11 css）；
7. byte-compare：4 件安装面产物（client-bundle.js、shim index.js、shim package.json、dist glue）SHA-256 与参考世界逐字节对比（4/4 BYTE-IDENTICAL）；
8. provenance：`git diff --no-index` 全量 hunk 归类（6 hunk 全属允许类别）；
9. 清理：我的 worktree 内 9 个 .reviewer7-* 探针文件已删除；tracked 文件零改动（`git diff --name-only` 空）；build 产物（node_modules/dist/composition-shim，gitignored）留在我的 worktree 内。

## 红线自检

- 未执行任何 git commit/push/branch/tag 操作（全部 git 调用为只读；仅 `diff --no-index` 与 reflog/rev-parse 族）；
- 未修改 references/ 下任何内容（仅读哈希/状态；.fresh-clone-r125-ad0a869 仅只读取哈希）；
- 未触碰 D:\deepseek-harness\ 与 3080 端口（期间观测到两个运行中的 `dsh web` 实例，未做任何操作）；
- 未启动任何不终止的长驻服务（全部命令为有界构建/哈希/查询；pnpm install/build 均自然结束）；
- 写入仅限：我的 worktree 内构建产物与临时探针（已清理）、本裁决文件；
- CORE PATCH BUDGET=0 在本 facet 范围内无违例证据：受审区间 git 树零 references/ 改动，test-use byte-clean @ 76fda72979，冻结 fork 未动；无 patch-package 类改写的受审区间痕迹（受审区间产品 diff 中无任何 upstream 相关改写，install 463 包全部 registry 来源、0 本地 link/junction）。
