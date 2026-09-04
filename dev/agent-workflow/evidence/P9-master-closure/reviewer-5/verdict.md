# P9 master product closure → master 门禁裁决 — reviewer-5（构建与 gate 证据：独立全链复跑）

日期：2026-09-05。裁决方：reviewer-5（3 名独立 gate reviewer 之一；本裁决完全独立，未读取/依赖任何其他审查者意见或转述）。
受审对象：int/P9-master-product-closure @ `2359d31`（fast-forward 进 master @ `2c1c200` 拟议）。
审查 facet：构建与 gate 证据 —— 在专属 worktree 内从零复跑五闸全部非浏览器门 + smoke 非浏览器部分 + fresh-machine 可安装性独立核验。

## 路由核验

本会话模型路由为 `qiyuan-self/qwen3.8-27b`（继承自主会话），满足 ROUTER_RULES §1 要求。

## 裁决

**通过（PASS）**

## 范围

- 受审区间：master tip `2c1c200`（R124）→ int tip `2359d31`；树 = merge `232316d`（parents `2c1c200` + task/upstream-rc1-compat tip `bd38827`）+ R125 增量 `8cf9fcb`、`071080d`、`2359d31`。
- 我的 worktree：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\R2MC-2`，detached @ `2359d31`，会话开始时 clean（无 node_modules / 无 dist），全部复跑在该 worktree 完成。
- 环境：Node v24.20.0（满足 engines `^22.19.0 || >=24.0.0`）、pnpm 11.7.0、暖 store `D:/.pnpm-store`。证据会话环境为 Node v26.0.0（gate-summary.md 记载）；两版本均在支持矩阵内，结果一致（差异处已注明）。
- 未复跑项（非本 facet）：浏览器 vertical（gentry）——仅对证据记录做事实性核对（r125-gentry.log：全部 PASS，team-remote RPC 22 次，failures: none；gentry-report.json 存在）。
- 冻结基线文档核对：`docs/plans/paused/` 开发计划 §33 Release Compliance Gates（C1–C7）中与本 facet 相关者（C1 pristine Host、C3 no patch mechanism、C4 no fork-only hard dependency）已按其要求独立核验。

## 逐项检查表（命令 → 期望 → 实测 → 结论）

| # | 门 | 命令（我的 worktree 内） | 期望 | 实测 | 结论 |
|---|----|--------------------------|------|------|------|
| 1 | install | `pnpm install --ignore-scripts`（从零：worktree 无 node_modules） | EXIT 0 | EXIT 0，40.6s（ELAPSED_MS=40573），316 packages，resolution skipped（lockfile up to date） | PASS |
| 2 | typecheck+build | 逐包 `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json`，9 包（contracts, domain, storage, runtime, tools, remote, client, legacy, testkit） | 9/9 EXIT 0 | 9/9 EXIT 0（legacy 有 `tsconfig.build.json` 而无 plain `tsconfig.json`；与证据目录做法一致） | PASS |
| 3 | test（根配置） | `node node_modules/vitest/vitest.mjs run` | 全绿，2395（与证据一致），EXIT 0 | Test Files 219 passed (219)；Tests 2395 passed (2395)；EXIT 0；Duration 18.63s；`p6t1-parallel.test.ts` 9/9 绿（本次未触发已知负载 flake，无需隔离复跑） | PASS |
| 4 | lint | `node node_modules/eslint/bin/eslint.js .` | EXIT 0、无输出 | EXIT 0，输出为空 | PASS |
| 5a | test（逐包抽验：client） | `packages/client` cwd + 本地 `vitest.config.ts`：`node ..\..\node_modules\vitest\vitest.mjs run` | 480 含 UI 套件，EXIT 0 | Test Files 33 passed (33)；Tests 480 passed (480)；EXIT 0 | PASS |
| 5b | test（逐包抽验：legacy） | 根配置 + 路径过滤：`node node_modules/vitest/vitest.mjs run packages/legacy`（worktree root） | 98，EXIT 0 | Test Files 7 passed (7)；Tests 98 passed (98)；EXIT 0 | PASS |
| 5c | 计数对账 | 算术核验（用我实测数） | 2630 逐包合计与 2395 根配置一致可解释 | 逐包实测/证据数：150+312+269+1070+35+92+480+124+98 = 2630；根配置 2395 = 2630 − 235（client `.client.spec.ts(x)` UI 套件，仅 client 本地配置 include：16 文件 235 tests）；根配置 client 部分 = 17 文件 245 tests（我实测数）；480 = 245 + 235 ✓；文件数 219 = 235（逐包文件合计）− 16（client UI spec 文件）✓ | PASS（注：见 F3 关于 brief 所给表达式） |
| 6 | 与 gate-*.log 对账 | 逐门比对（见下节） | 一致 | install/build/test/lint 四门全一致；一处文档性不一致（F1） | PASS（带注记） |
| 7 | smoke 非浏览器（独立复跑） | `node r5-s8-boot.mjs boot`（R125 boot kit 的路径修正副本，S8_WT=我的 worktree，S8_SHIM=产品 composition-shim，S8_FARM 未设 = farm-free 声明依赖模式）→ `stop` | 全新 3180 世界 S8-READY，五道 gate 全过，stop 后端口释放 | 见"独立复跑清单"第 8 条：全新 home `.dsh-test-s8-2026-09-05T00-00-r5`；row ready（ok/ready/toolCount=10，rootSessionId=s8v-root）；401 gate 未认证 catalog.list→401；dump-config 3 行全 true；serve combo 200 且 bundleBytesContained=true；catalog.list 带 cookie 200（s8v-bp-1 rev 1）；S8-READY；stop 后 3180/3493 均释放（S8-STOPPED） | PASS |
| 8 | fresh-machine 依赖声明 | `npm view @deepseek-ai/<pkg>@0.1.2-rc.1`（5 包） | 均已发布、可解析 | 5 包（dsh-agent/dsh-llm/dsh-mcp-client/dsh-session/dsh-storage-domain）全部 0.1.2-rc.1 在 registry.npmjs.org 有 tarball（access public） | PASS |
| 9 | fresh-machine 解析闭包（hermetic） | 自写 createRequire 审计：自 dist glue + source seam 两锚点解析 6 个 row-owned 裸 specifier | 全部落在本 worktree 内（无 TU 树泄漏） | AUDIT-PASS：12/12 INSIDE（全部解析到 worktree `.pnpm` 虚拟 store；根 node_modules 无 `@deepseek-ai`，即无 junction farm；packages/runtime/node_modules 内为 pnpm 原生 junction→本 worktree store） | PASS（注：见 F4） |
| 10 | 挂载产物与 R122 世界逐字节一致 | `Get-FileHash SHA256`：`packages/client/composition-shim/{client-bundle.js,index.js,package.json}` vs `references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/` 同名三件 | 三件 byte-identical | bundle `2097CE5E…`、index.js `D385C065…`、package.json `B4509233…` 全部一致（且与 byte-compare.md / state.json 记载值一致） | PASS |
| 11 | 挂载模板满足 host 配置校验 | INSTALL.md §3 模板 vs R122 验证世界 `cordis.patch.yml` 字段集比对 + 我 live boot 复跑中 host 行 apply 成功 | 字段集一致、校验通过 | 字段集逐字对齐（bootPhase/rootSessionId/blueprintSource/seedMembers/generation/deniedSelection/mcpServer/staticModel/environmentFacts/externalPolicyFacts/glueUrl/seamUrl + 相对形态 client 行）；我的 live boot 中 host 行 ready（配置校验 fail-closed 未触发） | PASS |
| 12 | 产品面同一性（interval 内 diff） | `git diff --stat bd38827 2359d31 -- packages scripts tests pnpm-lock.yaml package.json tsconfig.base.json vitest.config.ts eslint.config.mjs .github pnpm-workspace.yaml` | 仅 R125 增量文件 | 恰 6 文件：eslint.config.mjs(+1，ignore composition-shim)、package.json(+1，build:composition script)、packages/runtime/package.json(+6 deps)、pnpm-lock.yaml(+1023)、scripts/build-client-composition.mjs(+589)、scripts/place-dist-glue.mjs(+54) | PASS |
| 13 | references/ 区间零改动 | `git log --name-only 2c1c200..2359d31 -- references/` | 空 | 空（且 references/ 被 gitignore；实质核验见红线自检） | PASS |

## 与 gate-*.log 逐门对账（复跑 6）

| 门 | 证据记载（gate-*.log @ 071080d） | 我的实测（@ 2359d31） | 判定 |
|----|----------------------------------|------------------------|------|
| install | EXIT 0（"Already up to date / 154ms"，增量、warm tree） | EXIT 0（全新 install，40.6s，316 包） | 一致（我的为更强证据：从零安装） |
| typecheck+build | 逐包 tsc 9/9 EXIT 0（BUILD-ALL-FAIL=0） | 9/9 EXIT 0 | 一致 |
| test（根） | 219 files / 2395 tests 全绿，EXIT 0 | 219 / 2395 全绿，EXIT 0 | 一致 |
| test（逐包） | 9 包合计 2630（150/312/269/1070/35/92/480/124/98），单遍无 flake | 抽验 client 480、legacy 98 全绿；合计与根配置差额 235 = client UI 套件（逐项算术核验成立） | 一致 |
| lint | EXIT 0，输出空 | EXIT 0，输出空 | 一致 |

不一致项：仅 F1（gate-summary.md 标题 @ 8cf9fcb vs 各 gate log @ 071080d，见下）。定性：证据记录瑕疵（文档性），非测试失败、非运行环境差异导致的实质分歧。

## findings（全部非阻塞）

- **F1（证据记录瑕疵，文档性）**：`gate-summary.md` 标题写"@ 8cf9fcb"，但其引用的全部 gate log（install/build/test/test-perpkg/lint）头行均写"@ 071080d (post R125(1b) deps)"。即五闸实际在 R125(1b) 声明依赖**之后**（071080d）复跑过，summary 标题未随之更新。实质影响：无 —— (a) 071080d 与最终树 2359d31 的产品面逐字节相同（2359d31 仅追加 evidence/ + 修改 docs/INSTALL.md，我 diff 核实）；(b) 我在 2359d31 上独立全链复跑全绿，gate 证据对最终树有效。
- **F2（证据强度注记）**：`gate-install.log` 为 warm tree 增量安装（154ms "Already up to date"），非从零安装；fresh-machine 判据的安装面由我的从零 install（#1）+ hermetic 解析审计（#9）+ 5 包 registry 发布核验（#8）补强为直接证据。
- **F3（brief 表达式注记，非证据缺陷）**：本审查 brief 所给对账式 "2630 = 2395 − 245 + 480 − 0 + 98" 按其字面算术不成立（=2728）——因为根配置 run 的 2395 **已包含** legacy 98（根配置 include `packages/*/test/**/*.test.ts`，我的根 run 日志含 7 个 legacy 文件 98 tests），该式重复加了 98。经我逐项实测的正确恒等式：**2630 = 2395 + 235**（= 2395 − 245 + 480），其中 235 = client 本地 UI 套件（16 文件）= 480 − 245；219 = 235（逐包文件数合计）− 16。证据目录自身的 cross-check 记载（"delta vs per-package sum = client .client.spec.ts(x) UI suite"）与此一致且正确。此项只纠正 brief 笔误，不影响裁决。
- **F4（运行环境差异注记）**：证据目录 `r125-resolve-audit.mjs` 使用 `import.meta.resolve(spec, parentUrl)` 的 parent-URL 语义（Node v26 行为）；在我的 Node v24.20.0 上同式解析锚定到脚本自身位置，产生假 LEAKED（12/12 假阳性）。我用 `createRequire(anchor).resolve` 的确定性等价审计（v2）复验：12/12 INSIDE，AUDIT-PASS。定性：审计脚本的版本敏感性问题（证据工具层面），产品解析闭包经独立手段确认 hermetic，非产品缺陷。
- **F5（既有状态观察，非区间行为）**：冻结 legacy fork `references/deepseek-harness` 当前 HEAD = `cd5ef814`（master，为锁定点 `a3ab319927` 的祖先；tag `legacy-agent-team-pre-vnext` 完好指向 `a3ab319927`），reflog 显示该 checkout 发生于 2026-09-04 17:14:33 —— **早于**受审区间起点（R124 = 09-04 22:47 提交；区间内零触碰），fork 无 commit/amend、工作树 clean。属区间前既有状态（疑似 R122 对照工作遗留），不构成区间内红线违例。

## 裁决理由

1. **五闸在最终树（2359d31）上由我独立全链复跑全绿**：install（从零，EXIT 0）→ 逐包 tsc 9/9 → 根配置 vitest 219/2395 全绿 → eslint 干净 → 逐包抽验（client 480 含 UI 套件 / legacy 98）计数与证据完全一致，对账算术逐项成立（2630 = 2395 + 235）。p6t1-parallel 已记录负载 flake 在我复跑中未触发（根 run 9/9 绿）。
2. **smoke 非浏览器部分由我独立复跑通过**：全新 3180 世界（全新 DSH_HOME，profile 经 throwaway boot 初始化）、farm-free（S8_FARM 未设，依赖声明模式）下 R125 生产宿主 boot 到 S8-READY，kit 五道 gate（boot 行 / 401 门 / dump-config 3 行 / bundle 字节级 serve / live catalog.list）全过；stop 后端口 3180/3493 确认释放，测试实例零残留。结果与证据记录（s8-boot.log、state.json、serve-check.json、catalog-list-s8.json）逐项一致。
3. **fresh-machine 可安装性成立**：row-owned 运行时依赖（5 × @deepseek-ai/*@0.1.2-rc.1 + zod 4.4.3）已声明于 `packages/runtime/package.json`，全部在 npm registry 公开发布可解析；从零 pnpm install 在干净 worktree 上以 pnpm 原生布局落位（无 junction farm、无 worktree 依赖）；两锚点（dist glue / source seam）的 6 个裸 specifier 解析全部 hermetic 落在本 worktree 闭包内；挂载产物三件与 R122 验证世界逐字节一致；INSTALL.md 挂载模板字段集与 R122 验证行逐字对齐且经我 live boot 通过 host fail-closed 配置校验。docs/INSTALL.md 记载的安装链（clone → pnpm install → pnpm build → pnpm build:composition → 挂载 → dsh web）与我的实际复跑链一一对应、无遗漏步骤。
4. **与 gate 证据对账一致**，唯一不一致为 F1 标题陈旧（文档性），且被我对最终树的直接复跑覆盖。
5. **红线在本 facet 范围内全部守住**（见自检）：CORE PATCH BUDGET=0、冻结 fork 区间未动、test-use byte-clean、无 gated 历史 force-push 痕迹、ff 成立。

未发现任何需要停止继续开发的问题或重大风险项；剩余 findings 均为文档性/环境性注记，不构成本 facet 的后续开发风险。按 ROUTER_RULES §3.2，裁决为**通过**。

## 我实际执行的独立复跑清单

| # | 动作 | 命令/方式 | 结果 |
|---|------|-----------|------|
| 1 | 全新 install | worktree 内 `pnpm install --ignore-scripts`（无 node_modules 起点） | EXIT 0，40.6s，316 包 |
| 2 | 逐包 tsc ×9 | 逐包 `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json` | 9/9 EXIT 0 |
| 3 | 根配置 vitest | `node node_modules/vitest/vitest.mjs run` | 219 files / 2395 tests 全绿，EXIT 0 |
| 4 | eslint | `node node_modules/eslint/bin/eslint.js .` | EXIT 0，无输出 |
| 5 | client 包 vitest | `packages/client` cwd + 本地配置 | 33 files / 480 tests 全绿 |
| 6 | legacy 包 vitest | 根配置 + `packages/legacy` 路径过滤 | 7 files / 98 tests 全绿 |
| 7 | 计数对账 | 对 #3/#5/#6 实测数 + 证据逐包数做恒等式核验 | 2630 = 2395 + 235 = 2395 − 245 + 480；219 = 235 − 16 |
| 8 | smoke 非浏览器复跑 | R125 boot kit 路径修正副本（仅改 import 绝对路径化 + REPO 常量，逻辑零改动）：`boot`（S8_WT=我的 worktree、S8_SHIM=产品 shim、farm-free）→ 五 gate → `stop` | S8-READY（五 gate 全过）→ S8-STOPPED，端口 3180/3493 释放 |
| 9 | registry 发布核验 | `npm view @deepseek-ai/<5 包>@0.1.2-rc.1` | 5/5 有 tarball（registry.npmjs.org，public） |
| 10 | hermetic 解析审计 | 自写 createRequire 审计（v2，替代 Node 版本敏感的 v1 式） | 12/12 INSIDE，AUDIT-PASS |
| 11 | 挂载产物哈希比对 | SHA-256：composition-shim 三件 vs R122 世界 s8-client-row 三件 | 3/3 byte-identical |
| 12 | 挂载模板比对 | INSTALL.md §3 vs R122 世界 cordis.patch.yml 字段集 | 逐字对齐 |
| 13 | 产品面 diff | `git diff --stat bd38827 2359d31 -- <产品面路径集>` | 恰 6 个 R125 增量文件 |
| 14 | references 区间检查 | `git log --name-only 2c1c200..2359d31 -- references/` | 空 |
| 15 | 谱系/ff 核验 | `git merge-base --is-ancestor 2c1c200 2359d31` | exit 0（ff 成立） |
| 16 | force-push 痕迹检查 | master/int 及各 ref reflog（reset/force/rebase 扫描） | master 线性提交，无 force/reset 改写；仅区间前任务分支 rebase 与 worktree 创建时的 no-op `reset: moving to HEAD` |
| 17 | test-use pristine（C1） | boot 前后 `git status --porcelain` + `git diff --exit-code` | 前后均空 / exit 0 |
| 18 | 冻结 fork 状态 | status/reflog/tag 检查 | 区间内零触碰；tag 完好；工作树 clean（F5 既有状态注记） |
| 19 | patch 机制扫描（C3） | lock 无 patchedDependencies；package.json 无 pre/postinstall；`patch-package` 命中均为 zero-core 合规扫描器/负样本 fixture（scripts/verify-zero-core.mjs、fixtures/zero-core/plugins/bad-plugin-a）——即红线执法工具本身，非改写机制 | 干净 |
| 20 | 边界确认 | 全程未触碰 `D:\deepseek-harness\` / :3080；测试实例 :3180 已 stop 并确认端口释放 | 合规 |

## 红线自检（本 facet 范围内）

- **CORE PATCH BUDGET=0**：受审区间产品面 diff 仅 6 个本仓库文件；无 upstream 源码改动；无 patch-package / pnpm patch / postinstall host 改写（扫描见 #19）；pnpm-lock +1023 行全为 registry 解析闭包。✓
- **冻结 legacy fork 未动**：受审区间内零触碰（reflog 最后一次 HEAD 移动早于区间起点）；tag `legacy-agent-team-pre-vnext` 完好；工作树 clean。✓（F5 既有状态注记，非区间行为）
- **test-use pristine**：boot 前后 byte-clean（porcelain 空 + diff --exit-code 0）。✓
- **无 gated 历史 force-push 痕迹**：master 线性（reflog 无 force/reset 改写）；int 分支自 master 创建后 4 提交线性追加；ff 成立。✓
- **可逆性**：我创建的唯一运行实例（:3180）已 stop、端口确认释放；我新建的 S8 home（`.dsh-test-s8-2026-09-05T00-00-r5`）为 gitignored 测试世界，未触碰任何既有 world（含 R122 参照 world，哈希复验未变）；我的中间日志/脚本全部在 `%TEMP%\r5-review\`（worktree 外、仓库外），worktree 内仅允许类别的构建产物（node_modules / dist / composition-shim，均 gitignored）。✓

## 独立复跑环境差异披露

- 证据会话：Node v26.0.0、`.worktrees/P9-MC`、一次性 full-access 授权（vitest/vite spawn）。
- 本会话：Node v24.20.0、`.worktrees/R2MC-2`（detached @ 2359d31，从零）、会话级 file policy 允许直接运行。
- 两版本均在 `engines` 支持范围内；除 F4 所述证据脚本版本敏感点外，所有 gate 结果一致。
