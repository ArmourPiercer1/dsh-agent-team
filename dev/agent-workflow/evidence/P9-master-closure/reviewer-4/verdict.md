# Gate Reviewer-4 裁决 — P9 master product closure（int/P9-master-product-closure → master）

**facet**：reviewer-4 — 谱系、合并身份与产品面同一性（只读 + git 检查 + 一次受控构建重放）
**审查者**：独立子代理（无会话继承、未参与该 Phase 实现、未接触其他审查者意见）
**worktree**：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\R2MC-1`（detached @ 2359d31，审查开始时 `git status --porcelain` 为空）
**环境**：Node v24.20.0 / pnpm 11.7.0 / 暖 store `D:/.pnpm-store`；`pnpm install --ignore-scripts`；tsc 直接调 node 二进制
**裁决日期**：2026-09-05（本地）

---

## 路由核验

本会话模型路由为 **qiyuan-self/qwen3.8-27b**（继承自主会话）。

---

## 裁决

## 通过

门禁出口判据中本 facet 承担的部分（判据 1 谱系与产品面同一性、判据 4 中可由 git/文件系统核验的红线子集、以及 byte-compare 核心断言）均有**独立复跑证据**支持：int tip 的树 = master(2c1c200) + task/upstream-rc1-compat(bd38827) 的 merge(232316d) + 3 个有记录的 R125 增量，产品面与 bd38827 逐字节相同（除 R125 增量的 7 个产品文件外），受审区间内 references/ 冻结资产零改动，fresh clone 链（pnpm install → tsc → place-dist-glue → build-client-composition）在审查者 worktree 内复现出与 R122 验证世界**逐字节一致**的 4 件安装面产物。

两项非阻塞 finding（F1：审查 brief 对 master 内容的分类预期与仓库实际不符，属 brief 表述问题而非树缺陷；F2：AGENTS.md "HEAD 锁 a3ab319927" 文档行过期，frozen fork 冻结内容实际完好）均不影响受审树与门禁要求，建议主 Agent 作文档性补充（不计实质性补充次数）。

---

## 范围

- **受审区间**：master tip `2c1c200`（R124）→ int tip `2359d31`。树构成 = merge `232316d`（parents = `2c1c200` + `bd38827`）+ int 增量 `8cf9fcb`、`071080d`、`2359d31`。
- **本 facet 判定对象**：谱系/合并身份、产品面同一性（对 bd38827）、references/ 零改动与冻结 fork 完整性、byte-compare 核心断言（受控构建重放）、生成器 provenance、CORE PATCH BUDGET=0 与 force-push 红线（git/文件系统可核验部分）。
- **不在本 facet**（不裁决、不复跑）：五闸全绿的 typecheck/test/lint 数值、3180 全新世界 boot 与浏览器 vertical 的行为面验证（其证据在 `dev/agent-workflow/evidence/P9-master-closure/` 与 R122 证据目录；本 facet 仅独立核验了这些证据所依赖的 byte-identity 桥梁）。

---

## 逐项检查表（命令 → 期望 → 实测 → 判定）

### 1. 合并身份

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 1.1 | `git log -1 --format='H+parents' 232316d` | parents 恰为 `2c1c200…` 与 `bd38827…` | `H=232316db0e395fc8e616e9c67f4eaac0496f133a`，`parents=2c1c2002687eb257c70c01f82d96c51e346bbcda bd388272a5b46386a8f5315d38a2f00f575cbc4a`；subject = "Merge branch 'task/upstream-rc1-compat' into int/P9-master-product-closure" | **PASS** |
| 1.2 | `git merge-base 2c1c200 bd38827` | 唯一共同祖先（3-way 合并成立） | `959e36358ee7244ff8c7e1e0b8396e70dfef4562`（= int/P7-advanced-semantics tip，master 祖先） | **PASS** |
| 1.3 | `git merge-base --is-ancestor 2c1c200 2359d31` | exit 0（ff master 前提） | exit=0 | **PASS** |
| 1.4 | `git rev-list --count 2c1c200..2359d31`；`git rev-list 2c1c200..2359d31 ^bd38827` | 区间内无合并/R125 之外的 int 侧提交 | 总 108 = 104（task 分支侧，即已验收的 P8/P9/T12/rc1-compat 谱系）+ 4；4 者恰为 `232316d`（merge）、`8cf9fcb`（R125(1/2)）、`071080d`（R125(1b)）、`2359d31`（R125(2)） | **PASS** |
| 1.5 | `git show --name-only --format='' <commit>`（逐 R125 提交） | 8cf9fcb=6 文件、071080d=2 文件、2359d31=证据/文档 | 8cf9fcb：`.gitignore, docs/INSTALL.md, eslint.config.mjs, package.json, scripts/build-client-composition.mjs, scripts/place-dist-glue.mjs`（恰 6）；071080d：`packages/runtime/package.json, pnpm-lock.yaml`（恰 2）；2359d31：628 文件 = 627×`dev/agent-workflow/` + 1×`docs/` | **PASS** |
| 1.6 | `git log -1 232316d`（merge 自身改动） | merge 不改产品面 | `git show --name-only` = 0 文件（纯合并树） | **PASS** |

### 2. 产品面同一性

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 2.1 | `git diff --stat bd38827 232316d -- packages scripts tests pnpm-lock.yaml package.json tsconfig.json vitest.config.ts eslint.config.mjs .github` | 空输出（merge 树产品面 = task tip 产品面，byte-identical） | exit=0，输出 0 行 | **PASS** |
| 2.2 | `git diff --name-only bd38827 2359d31`（R125 增量树差） | 产品面改动 = R125 的 7 个产品文件（8cf9fcb 的 6 文件中含 1 个 docs/INSTALL.md） | 产品面恰 7 文件：`.gitignore, eslint.config.mjs, package.json, packages/runtime/package.json, pnpm-lock.yaml, scripts/build-client-composition.mjs, scripts/place-dist-glue.mjs`；其余 = 1426×`dev/agent-workflow/` + 4×`docs/` + `AGENTS.md` + `README.md`（后两者系 merge 带入的 master bookkeeping 版本，见 2.4） | **PASS** |
| 2.3 | `git diff --name-only 2c1c200 2359d31`（全区间树差）分类 | 见 F1：区间自身提交的分类与 brief 预期一致；整树 diff 的产品面文件数由 merge 带入 | 总 1263 文件；产品面 376（全部来自 merge 带入的 task 分支产品树，见 F1）；非产品面 = `docs/` + `dev/agent-workflow/` + 根 `AGENTS.md`/`README.md` | **PASS**（附 F1） |
| 2.4 | `git diff --name-only bd38827 232316d`（merge 相对 task tip 的全部差异） | 产品面 0；差异限于 bookkeeping | 804 文件 = 799×`dev/agent-workflow/` + 3×`docs/` + `AGENTS.md` + `README.md`；产品面 0 | **PASS** |
| 2.5 | merge 冲突表核验（merge-audit.md §3 三个 blob） | branch/master/merged blob 与记录一致，merged 取 master 侧 | `tc-s6-chain-dist.log`：branch=`8c644c0e…` master=`4d3d951c…` merged=`4d3d951c…`；`tc-s6-chain-fresh.log`：`ea4819ae…`/`43c89672…`/`43c89672…`；`tc-s6-live-17-scenarios.log`：`02ef34ee…`/`e4d23484…`/`e4d23484…`；3/3 merged==master，全部位于 `dev/agent-workflow/evidence/P8-S/` | **PASS** |
| 2.6 | 071080d 内容核验 | 仅依赖声明（5×@deepseek-ai/*@0.1.2-rc.1 + zod 4.4.3）+ lockfile registry 闭包 | diff 与提交信息一致：`packages/runtime/package.json` +6 依赖行（`yaml` 保留）；`pnpm-lock.yaml` +1023 行全部为带 integrity 的 registry 解析条目 | **PASS** |

### 3. references/ 零改动 + 冻结 fork

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 3.1 | `git diff --name-only 2c1c200 2359d31 -- references`；同法 `bd38827 232316d -- references` | 空 | 均 0 行（references/ gitignored，git 层天然无 track；文件系统层见 3.5） | **PASS** |
| 3.2 | `git -C references/deepseek-harness status --porcelain` | 空（工作树 clean） | 0 行 | **PASS** |
| 3.3 | `git -C references/deepseek-harness rev-parse HEAD` | brief 期望 `a3ab319927` 前缀 | **`cd5ef81481…`（master = upstream 0.1.2-alpha.1）** — 与 brief/AGENTS.md "HEAD 锁 a3ab319927" 不符；冻结内容核验见 3.4，差异定性与处置见 F2 | **附 F2**（冻结内容完好） |
| 3.4 | frozen fork 冻结内容：`git -C <fork> reflog show feat/team-vnext-integration-20260829`；`tag -l`；`for-each-ref refs/tags`；`merge-base --is-ancestor`；分支列表 | 冻结分支未移动、tag 指向 a3ab319927、与 origin 一致 | 分支 reflog 仅 1 条：`2026-08-29 18:30:55 branch: Created from refs/remotes/origin/feat/team-vnext-integration-20260829`（a3ab319927，**此后零移动**）；`legacy/agent-team-integration-20260829` 同；tag `legacy-agent-team-pre-vnext` 为 annotated（tag 对象 276b3f8b8e）peel 后 = **a3ab319927**；本地分支与 `origin/feat/team-vnext-integration-20260829` 均 = a3ab319927 | **PASS** |
| 3.5 | 区间（2026-09-04 22:47:51 → 09-05 01:24:36）内 references/ 文件系统改动扫描（LastWriteTime > 区间起点，递归） | 两个 fork 内容零改动；R122 参照世界 T12-26-59 零改动 | 仅：(a) `.dsh-test-s8-2026-09-04T17-16-50/`（R125 验证世界，state.json 确认 home）内 19 文件 = 00:45:35 s8-client-row 三件 shim 重部署（重部署后 bundle 复算 = `2097CE5E…` 不变）+ 01:16:50–01:18:56 新一轮 boot 的 profiles/sessions/storages 写入（与 R125(2) "fresh-machine boot/gentry verification" 提交 01:24:36 时间吻合）；(b) `deepseek-harness/.git/index` 1 文件（mtime 刷新，无对象/引用/工作树变化——reflog 无任何 17:14:33 之后的条目，status 空）。T12-26-59 世界零改动（三件产物 mtime = 09-04 16:36/19:51，区间前） | **PASS**（附注：.git/index 系状态探测的 stat 缓存刷新） |
| 3.6 | frozen fork 区间前状态：HEAD reflog；`origin/master` reflog | 区间内无任何 fork 操作 | HEAD 最后移动 = `2026-09-04 17:14:33 checkout: moving from feat/team-vnext-integration-20260829 to master`（**早于区间起点 22:47:51**）；`origin/master` 最后 fetch = `2026-09-04 16:58:36 pull: fast-forward`（早于区间起点） | **PASS** |
| 3.7 | test-use fork：`rev-parse HEAD` + `status --porcelain` | `76fda72979…` + 空（pristine 角色，TEST_METHODS 基线） | `76fda729799fe9b3848dbe2c211d4b231032b81e` + 0 行 | **PASS** |

### 4. byte-compare 复算（本 facet 核心断言）

| # | 命令/步骤 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 4.1 | `Get-FileHash -Algorithm SHA256` 重算 R122 参照世界 `references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/{client-bundle.js,package.json,index.js}` | 与 byte-compare.md 记录一致（bundle = `2097CE5E…`） | bundle `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997`（= 记录值）；package.json `B4509233…`、index.js `D385C065…`（记录未载，留底本裁决） | **PASS** |
| 4.2 | 受控重放：`pnpm install --ignore-scripts`（R2MC-1） | exit 0 | exit 0，"resolved 316, reused 316, downloaded 0"，49.2s | **PASS** |
| 4.3 | `node node_modules/typescript/bin/tsc -p packages/client/tsconfig.build.json` | exit 0 无诊断 | exit 0，无输出 | **PASS** |
| 4.4 | `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.build.json`（place-dist-glue 的前置 dist 根） | exit 0 无诊断 | exit 0，无输出 | **PASS** |
| 4.5 | `node scripts/place-dist-glue.mjs` | 放置 1 件 byte-identical glue | "packages/runtime/src/plugin/live/agent-bindings.mjs -> packages/runtime/dist/…/agent-bindings.mjs (byte-identical)"，exit 0 | **PASS** |
| 4.6 | `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | PLAIN 变体产出 3 件 | "85 modules, 11 css files, entry=plugin/client.js"，写出 client-bundle.js（**845581 B**，与参照同尺寸）+ index.js + package.json，exit 0 | **PASS** |
| 4.7 | 重算生成物 SHA-256 并与参照世界/RC1 dist 记录值对比 | 4 件全部 byte-identical | bundle：gen=`2097CE5E…` = 参照 = 记录值（**MATCH-ALL**，二进制 845581 B 逐字节一致）；shim package.json：gen=`B4509233…` = 参照（MATCH）；shim index.js：gen=`D385C065…` = 参照（MATCH）；glue：gen=`D50D3B3FBE371078B31208DC1E87F2DA1D5DE309D243E99E6AE9BB452B40225B` = RC1 worktree（@bd38827）dist 副本 = 记录值（**MATCH-ALL**） | **PASS**（核心断言成立） |
| 4.8 | 旁证：R125 重部署的 T17-16-50 shim 复算；R125 证据 state.json 记载 | bundle = `2097ce5e…` | 复算 = `2097CE5E…`；state.json `shim.bundleSha256 = 2097ce5e…`（845581 B）；serveCheck 含 `@dsh-agent-team/client/client.js`（client 行实际在服务） | **PASS** |

### 5. 生成器 provenance

| # | 命令/步骤 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 5.1 | `scripts/build-client-composition.mjs` vs `dev/agent-workflow/evidence/P9/P9/s8/s8-bundle.mjs` 代码段（header docblock 之后）逐行对比 | 仅允许：文件头/日志前缀/未用 import 差异 | 两侧代码段各 539 行；差异恰 9 对：import 行（s8 侧多 `readdirSync, statSync` 未用 import）、usage 文本行（脚本名）、7 行 `s8-bundle:` → `build-client-composition:` 日志前缀。**无任何 emit-into-bundle 的字符串差异** | **PASS** |
| 5.2 | 差异不影响产物字节 | 以 4.7 的 byte-match 为准 | 4.7 全 MATCH（独立复现，非转录） | **PASS** |

### 6. 红线（git/文件系统可核验子集）

| # | 检查 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 6.1 | CORE PATCH BUDGET=0：`Select-String` 扫描根 + 9 包 `package.json` 的 `patchedDependencies|patch-package|postinstall` | 无 | 0 匹配 | **PASS** |
| 6.2 | 受审区间无 upstream 源码改动：区间产品面 diff 全部在库内 `packages/|scripts/|pnpm-lock.yaml|根配置`（2.2/2.3）；references/ 零改动（3.1/3.5） | 无 | 无 | **PASS** |
| 6.3 | 无 force-push 痕迹：`git reflog show master` / `int/P9-master-product-closure`；`git ls-remote origin` 对比 | 线性追加；远端引用均为本地祖先或同值 | master reflog：R89→R90→R91→R122→R123→R124 纯 commit 追加；int reflog：`branch: Created from master` + 4 commit；远端：`origin/master=a733e9f`（= 本地 R123，R124 为 push 后 bookkeeping、未推送，与 R124 提交信息一致），`origin/task/upstream-rc1-compat=bd38827`、`origin/int/{P8-S,P8-remote,T12}`、`origin/task/{P9-ui-legacy-reuse,T12-vertical-slice}` 均与本地同值；`int/P9-master-product-closure` 未上远端（本地 only，"No push" 记录属实） | **PASS** |
| 6.4 | 冻结分支 `feat/team-vnext-integration-20260829` 未移动 | a3ab319927 | a3ab319927，reflog 自创建（2026-08-29）零移动 | **PASS** |
| 6.5 | 审查者操作面：worktree 内仅构建/安装产物 + 本裁决文件；无 commit/push/branch/tag；未触碰 D:\deepseek-harness\ 与 :3080；未启动长驻服务 | — | 重放后 `git status --porcelain` 仅 `?? .reviewer4-tmp/`（本审查分析目录，node_modules/dist/composition-shim 均 gitignored）；未执行任何写 git ref 的命令；未接触稳定实例 | **PASS** |

---

## Findings

**F1（非阻塞，brief 表述与仓库事实不符 — 文档/brief 层）**
审查 brief 检查 2 的整树分类预期（"`git diff --name-only 2c1c200 2359d31` … 产品面改动恰好 = 8 个 R125 文件，其余全部在 docs/ 或 dev/agent-workflow/ 下"）按字面整树 diff 不成立：实测整树 diff 产品面 = 376 文件。原因是 brief 预期隐含"master R124 已含完整 P8/P9 产品树"，而仓库实际为：**master 线是 bookkeeping 线**（P9-PROTO R87–R91 + R122/R123/R124 记录同步，产品面停留在 P7 时代内容，merge-base = int/P7 tip 959e363），本 closure gate 的 merge 正是把已验收的 P8/P9/T12 完整产品树（376 A + 153 M 产品文件）首次带入 master —— 这正是 "P9 master product closure" 的语义。按区间自身（非 merge）提交分类时，brief 预期完全成立：8cf9fcb = 恰 6 文件（5 产品 + docs/INSTALL.md）、071080d = 恰 2 产品文件、2359d31 = 627×dev/agent-workflow + 1×docs。门禁出口判据的原文断言（"产品面与 bd38827 逐字节相同，除 R125 增量文件"）经 2.1+2.2 树级 byte-diff 验证为真。**建议**：主 Agent 在 gate 记录中注明 master 线构成（bookkeeping 线），避免后续 gate brief 复用同一错误预期。

**F2（非阻塞，文档过期 — R123 型文档对齐事项）**
AGENTS.md 目录约定行（及本 brief 的对应预期）称 frozen fork "HEAD 锁 `a3ab319927…`"。实测 fork HEAD = `cd5ef81481`（upstream master，0.1.2-alpha.1）：2026-09-04 17:14:33 的一次 checkout（a3ab319927 分支 → master）所致，早于受审区间起点（22:47:51）；`origin/master` fetch（16:58:36）亦在区间前。冻结内容本身完好：冻结分支 a3ab319927 零移动且与 origin 一致、annotated tag `legacy-agent-team-pre-vnext` peel 后 = a3ab319927、工作树 clean、区间内 fork 内容/引用零变化（仅 `.git/index` stat 缓存 mtime）。产品链不依赖该 fork 的 HEAD（产品面用 test-use 76fda72979 + registry 已发布的 rc.1 包；TEST_METHODS §3.3 禁止把该 fork 用作测试运行时）。**建议**：主 Agent 将 AGENTS.md 该行更新为"冻结分支 `feat/team-vnext-integration-20260829`/tag `legacy-agent-team-pre-vnext` 锁 a3ab319927（HEAD 当前 checkout 于 upstream master cd5ef814，仅作参照）"（纯文档性，不计补充次数）。

**F3（信息性）**
gate-summary.md 记载主 Agent 五闸复跑环境为 Node v26.0.0；本审查在 Node v24.20.0 下完成受控重放并得到逐字节一致的产物（tsc 6.0.3，lockfile pin）——跨 Node 版本（v24/v26）构建输出确定性获得一个独立数据点。

---

## 裁决理由

1. **谱系同一性**：merge parents 恰为 master tip + task tip（1.1），merge-base 唯一（1.2），ff 前提成立（1.3），区间 108 提交 = 104（task 分支已验收谱系）+ 1 merge + 3 R125 增量，无意外提交（1.4），逐提交文件集与 R125 记录完全吻合（1.5）。
2. **产品面同一性**：merge 树产品面对 bd38827 零 byte-diff（2.1，byte 级），R125 增量产品面恰 7 文件（2.2），merge 自身 0 改动（1.6），merge 相对 task tip 的 804 文件差异全部为 bookkeeping（2.4），3 处 add/add 冲突全部在 evidence/ 且取 master 侧、blob 逐项复核一致（2.5）。
3. **byte-compare 核心断言由独立重放证实**（4.1–4.8）：全新 worktree 内 `pnpm install --ignore-scripts` → tsc（client+runtime）→ place-dist-glue → build-client-composition，4 件安装面产物（client-bundle.js / shim package.json / shim index.js / dist glue）与 R122 验证世界及 RC1 dist 逐字节一致；生成器 provenance 差异全部在 bundle 输出字符串之外（5.1/5.2）。"fresh clone + 标准构建链 = R122 live 验证过的安装面"这一门禁关键桥梁成立。
4. **红线**（可核验子集）：CORE PATCH BUDGET=0（6.1/6.2）、frozen fork 冻结内容与冻结分支完好且区间内未动（3.2–3.6）、test-use pristine（3.7）、无 force-push 痕迹（6.3）。
5. 两项 finding 均为文档/brief 层，不触及受审树内容、不改变门禁判据真值，不构成"较明显风险"，故不升格为补充内容。

## 独立复跑清单（本审查者实际执行）

1. worktree 状态核验（detached @ 2359d31、status 空）
2. `git log -1`/`merge-base`/`--is-ancestor`/`rev-list` 全套谱系检查（1.1–1.4）
3. `git show --name-only` 逐提交文件集（1.5/1.6；8cf9fcb、071080d、2359d31、232316d）
4. 产品面 diff 三连：`bd38827→232316d`（产品路径，空）、`bd38827→2359d31`、`2c1c200→2359d31` + `2c1c200→bd38827`（全路径，程序化分类计数）
5. merge 冲突表 3×blob 复核（`git rev-parse <tree>:<path>`）
6. references/ git 层 diff ×2；frozen fork / test-use fork 的 `rev-parse`+`status --porcelain`；fork 全套 reflog（HEAD/冻结分支/tag/origin/master）；tag peel；`branch -a`；fork clone 谱系（clone/pull 记录）
7. 区间文件系统扫描：references/ 递归 mtime > 区间起点（按顶层目录分组 + fork 内部逐文件）
8. `pnpm install --ignore-scripts`（R2MC-1，exit 0）
9. `tsc -p packages/client/tsconfig.build.json`（exit 0）；`tsc -p packages/runtime/tsconfig.build.json`（exit 0）
10. `node scripts/place-dist-glue.mjs`（1 placement）；`node scripts/build-client-composition.mjs packages/client packages/client/composition-shim`（85 modules/11 css）
11. `Get-FileHash` SHA-256 ×8（参照世界 3 件 + RC1 dist glue + 生成 4 件）+ 二进制逐字节比较（845581 B）
12. 生成器 provenance 逐行对比（539 行代码段，9 对差异枚举）
13. `Select-String` 补丁红线扫描（10 个 package.json）
14. master/int reflog + `git ls-remote origin`（只读）+ 远端/本地引用逐一比对
15. T17-16-50 世界重部署 shim 复算 + state.json/s8-boot.log 交叉核对 + R122 世界产物 mtime 核验

## 红线自检（审查者自身）

- 未执行任何 `git commit/push/branch/tag`（含 fork 内）；未修改 references/ 任何内容（仅读取/哈希）
- 未触碰 `D:\deepseek-harness\`、:3080；未启动任何长驻服务（重放全部为一次性命令，已自然结束）
- 写入面 = R2MC-1 内构建/安装产物（node_modules、packages/*/dist、packages/client/composition-shim）+ `.reviewer4-tmp/`（分析临时目录）+ 本裁决文件
- 本裁决不引用任何其他审查者的意见或转述；house rules 仅用于了解协议，未作为裁决依据
