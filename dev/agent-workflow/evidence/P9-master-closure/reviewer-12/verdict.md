# P9 Master Closure Gate — reviewer-12 verdict

- Gate: **P9 master product closure → master**（int/P9-master-product-closure @ `d23c606` fast-forward 进 master @ `2c1c200`）
- Reviewer: **reviewer-12**（三独立 reviewer 之一，互不可见；本裁决不依赖任何其他 reviewer 意见）
- 裁决 facet: **fresh-machine installability + red lines（新机器可安装性 + 红线）**
- 执行环境: 我的 worktree `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\R4MC-3`（detached @ `d23c606`），全部命令在 my worktree 内执行
- 本会话模型路由为 qiyuan-self/qwen3.8-27b（继承自主会话）

## VERDICT: 通过

我 facet 的全部退出标准均以**我自己实际执行的命令**确认为绿（不是读日志）：五闸在最终树 `d23c606` 上全绿；新机器等价安装（git archive 干净树，无 .git，全部依赖来自 npm registry）install + 9 包 build 成功且 mount 产物与 R122 世界逐字节一致；INSTALL.md §3 模板字段级满足宿主配置校验（fail-closed 已用负控证明），模板 `blueprintSource` 被宿主侧 `parseBlueprint` 管线接受（负控证明检查有效）；红线四项全部未触碰。

---

## Scope（我的 facet 范围）

1. `d23c606` 最终树上五闸独立重跑：install / per-package tsc（9 包）/ vitest（root + per-package）/ eslint / smoke **非浏览器部分**（必须独立重跑）。
2. 谱系 + 产品面身份（vs `bd38827`）：int tip、ff 能力、`refs/` 与产品文件增量声明核对。
3. fresh-machine installability：**实际执行**干净克隆等价树（无 .git）的 install+build；依赖全部来自 npm registry；9 包 build；mount 产物与 R122 世界逐字节一致；模板字段级满足宿主 `validateTeamPluginConfig`（fail-closed）；模板 `blueprintSource` 通过宿主侧 `parseBlueprint`（含负控）。
4. 红线：CORE PATCH BUDGET=0；冻结 fork `references/deepseek-harness` 分支/tag 未移动 + 干净；`references/deepseek-harness-test-use` 逐字节 pristine；gated 历史无 force-push 痕迹。
5. 冻结文档语义合规（我的 facet 相关部分：plugin composition / release & install / Release gates）。

---

## 逐项检查表（命令 → 预期 → 实际 → 结论）

### A. 五闸 @ d23c606（全部我执行）

| # | 检查 | 命令 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| A1 | install | `pnpm install --ignore-scripts`（my worktree） | exit 0，workspace 链接完整 | exit 0（295.8 s），9 包全部链接 | PASS |
| A2 | per-package tsc（9 包） | 逐包 `node_modules/typescript/bin/tsc -b`（9× tsc，INSTALL.md §2 `pnpm build` 的等价展开） | 9/9 成功 | 9/9 build + 8/8 typecheck（`legacy` 无 tsconfig.json，无 build script，按 R122 先例不计数） | PASS |
| A3 | vitest root | `node_modules/vitest/vitest.mjs run`（root config） | 全绿 | 219 files / **2395 tests 全过** | PASS |
| A4 | vitest per-package | 逐包 vitest（legacy 经 root-config filter） | 全绿 | **2630/2630**（contracts 150 / domain 312 / storage 269 / runtime 1070 / tools 35 / remote 92 / client 480 / testkit 124 / legacy 98） | PASS |
| A5 | eslint | `node_modules/eslint/bin/eslint.js .` | exit 0，无输出 | exit 0，零输出 | PASS |
| A6 | smoke 非浏览器（**独立重跑**） | 我自写 harness `rev12-smoke/rev12-boot.mjs`：全新 DSH_HOME `references/.dsh-test-rev12-s8-2026-09-04T18-39-59`，port **3182**（mock 3494；启动前确认 3180/3181/3182/3493/3494 空闲），pristine 宿主树 `references/deepseek-harness-test-use` @ `76fda72979`，挂载 = INSTALL.md §3 模板原样（<REPO>→my worktree、<your-provider>/<your-model>→deepseek-official/rev12-model）+ client 行 `../../team-client-row/index.js`（composition-shim 按 §3 复制到 home）+ p6t6 观测行（§7 测试世界设备） | G1 boot 行 / G2 401 / G3 dump-config 3 行 / G4 p6t6 health ready / G5 bundle 字节一致 / G6 catalog.list 200 + 模板蓝图 | **ALL PASS**：G1 boot（pid 69788，token 交换 303+cookie）；G2 未认证 `catalog.list` → **401**；G3 dump-config 3 行全在（host dist / team-client-row index.js / p6t6 harness）；G4 `health={"ok":true,"boot":1,"ready":true,"rootSessionId":"team-root","liveSessions":["team-root"],"toolCount":10}`；G5 combo 4,580,853 B，845,581 B bundle 字节包含于响应体（sha256 `2097ce5e…` 与 R122 记录值一致）；G6 `catalog.list` 200，`blueprints=[{"blueprintId":"my-team-bp-1","revisions":[1]}]`（= 模板 blueprintSource 在行注册时被宿主 `parseBlueprint` 接受）；teardown 后 3182/3494 释放确认、实例进程消失、mock 请求 0（非浏览器垂直无模型轮次，与 R125 boot 段一致） | PASS |

### B. 谱系 + 产品面身份（vs bd38827）

| # | 检查 | 命令 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| B1 | int tip | `git rev-parse int/P9-master-product-closure` | = 最终树 | `d23c606`（= my worktree HEAD） | PASS |
| B2 | ff 能力 | `git merge-base --is-ancestor master int/...` | exit 0 | exit 0（master `2c1c200` 是 `d23c606` 祖先） | PASS |
| B3 | merge 结构 | `git log --format=%P 232316d` / parents 核验 | 合并 master + task 支 | parents = `2c1c200` + `bd38827` | PASS |
| B4 | refs/ 漂移 | `git diff 2c1c200..d23c606 -- refs/` | 空 | 0 行（refs 目录零增量） | PASS |
| B5 | 产品面增量 | `git diff --stat bd38827..d23c606` | 仅声明的 int-increment 产品文件 | 1431 个 dev/ 证据 + **8 个产品文件**（`.gitignore`、`eslint.config.mjs`、`package.json`、`packages/client/package.json`、`packages/runtime/package.json`、`pnpm-lock.yaml`、新增 `scripts/place-dist-glue.mjs`、`scripts/build-client-composition.mjs`）+ 4 docs/ + `AGENTS.md`/`README.md` —— 与 int 分支声明的增量逐一对应；`2359d31`/`39fe1df`/`d23c606` 三个增量提交中 **零产品文件**改动（`d23c606` 仅 docs） | PASS |
| B6 | lockfile 完整性 | `pnpm-lock.yaml` 解析 + 抽查 | 所有 registry 依赖带 integrity | 58 个 `@deepseek-ai/*` + `zod` 条目全部 `resolution: {integrity: sha512-…}`；唯一 `link:` 条目 = 2 个内部 workspace 链接（client→contracts/remote）；3 个 registry 抽查经 web_fetch 与 lockfile integrity 逐字节一致（dsh-agent@0.1.2-rc.1、zod@4.4.3、cordis@4.0.2） | PASS |

### C. fresh-machine installability（实际执行，非读日志）

| # | 检查 | 命令 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| C1 | 干净树 | `git archive d23c606 \| tar -x` → `references/.fresh-clone-rev12-d23c606/` | 无 .git 的完整工作树 | 4185 文件，无 .git | PASS |
| C2 | install | `pnpm install --ignore-scripts`（sim 树，registry-only） | exit 0，依赖全部落在树内 | exit 0（121.8 s）；无根目录 `@deepseek-ai` 农场；junction 扫描 10 个 reparse 条目**全部指向树内**（0 泄漏、0 坏链） | PASS |
| C3 | 9 包 build | 逐包 tsc（sim 树） | 9/9 | 9/9 | PASS |
| C4 | hermetic 解析 | 自写 probe `rev12-hermetic-probe.mjs`：13 个 registry specifier（5× `@deepseek-ai/dsh-*` 运行时 + 2× client 行依赖 + zod 等）+ 2 个 workspace 链接，从行内模块锚点解析 | 全部 INSIDE sim 树 | **15/15 INSIDE**（0 泄漏） | PASS |
| C5 | composition 链 | `node scripts/place-dist-glue.mjs && node scripts/build-client-composition.mjs packages/client packages/client/composition-shim`（sim 树） | exit 0，产物齐全 | exit 0（85 modules / 11 css）；dist glue 落位 | PASS |
| C6 | mount 产物字节一致 | 4 个安装面产物 SHA-256（我重算）vs R122 世界 | 逐字节一致 | `client-bundle.js`=`2097CE5E…`、`index.js`=`D385C065…`、`package.json`=`B4509233…`、dist glue `agent-bindings.mjs`=`D50D3B3F…`（= sim src = RC1 dist 参照 = 记录值）—— **4/4 BYTE-IDENTICAL** | PASS |
| C7 | 模板 → 宿主校验 | 自写 `rev12-template-audit.mjs`：从 INSTALL.md §3 抽取 `blueprintSource: |` 字面块（YAML clip 语义，759 字符含 CRLF / 725 字符 LF 归一化，2 个 `---` 分隔行）→ 编译产物 `parseBlueprint`（`packages/runtime/dist/packages/domain/blueprint/src/index.js`，与 host glue 相对导入同一文件） | 正例通过；负控（删 `---` 分隔行）必须抛错 | **正例 PASS**：`my-team-bp-1` rev 1，leader.templateId=leader，members=1，contentHash=`sha256:a4374629…`；**负控 PASS**：`MALFORMED_DTO reason=frontmatter-missing`（检查有牙齿） | PASS |
| C8 | 模板行配置 → 宿主 fail-closed | 同上脚本：模板 12 字段配置（占位符代入）→ 编译产物 `validateTeamPluginConfig`（`packages/runtime/dist/packages/runtime/src/plugin/host.js`）；再负控：分别删除 `generation` / `deniedSelection` / `mcpServer` | 正例通过；每个负控抛 `TEAM_PLUGIN_CONFIG_INVALID` | **PASS**：12 字段配置接受（bootPhase=create, rootSessionId=team-root, generation=1）；3 个负控全部按字段级信息抛 `TEAM_PLUGIN_CONFIG_INVALID`（generation must be a positive integer / deniedSelection must be a plain object or null / mcpServer must be { name, port: number\|null } or null） | PASS |
| C9 | 字段级对 R122 | 自写 `field-compare.mjs` + `cfg-cmp.cjs`（js-yaml 解析两份 patch，逐字段比） | 字段集一致；差异仅限实例特定值 | host 行：模板 12 配置字段 vs R122 13（R122 多 `defaultWorkspace` —— 模板标注 optional，校验器接受其缺席）；共有字段类型全同，值差异仅 `rootSessionId`（team-root/s8v-root）、3 个文件 URL（build 树路径）、`staticModel.model`（rev12-model/s8v-model）；`environmentFacts`/`externalPolicyFacts` 逐字节同构；client 行同键，仅 shim 目录名差异（§3 文档化 `team-client-row` vs R122 测试世界 `s8-client-row`） | PASS |
| C10 | 组合 boot 图对 R122 | 解析我 boot 的 index HTML 与 R122 `index-s8.html` 的 `??` combo URL 逐条 diff | 产品面一致，差异仅限测试世界设备行 | 各 46 条，**45 条共享**，唯一差异 = R122 挂载 `dsh-client-ui-directory-picker-browse`（其 §7 测试世界行）、我默认 `directory-picker-native`；两图均含 `@dsh-agent-team/client/client.js`；combo 体积差 46,373 B 完全由该 picker 变体解释 | PASS |
| C11 | 冒烟证据自洽（交叉核对） | 读 evidence：s8-boot.log / state.json / dump-config-s8.txt / r125-gentry.log / browser/gentry-report.json / serve-check.json + 时间线核对 | 互洽 | s8-boot.log（S8-READY 17:16:56.789Z，pid 58420，port 3180，mock 3493，shim sha `2097ce5e…` 845,581 B）↔ state.json（startedAt 17:16:56.788 / stoppedAt 17:19:57.188，instancePid 58420，mockPort 3493，bundleBytesContained true）↔ dump-config-s8.txt（3 行，host→P9-MC dist、client→home s8-client-row、p6t6→P9-MC harness）↔ gentry-report.json（`failures:[]`，`consoleErrors:[]`，`pageErrors:[]`，22 RPC 全 200，team.create 200，`s8v-bp-1 (rev 1)` 可选项）↔ serve-check.json（combo 4,627,226 B，sha256MatchesShim=false 符合 combo 语义）↔ browser/ 14 个产物文件齐备；gentry 时间 17:18:58 落在实例存活窗 [17:16:56, 17:19:56] 内 | PASS |

### D. 红线

| # | 检查 | 命令 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| D1 | CORE PATCH BUDGET=0 | test-use 工作树 status；lockfile 机制扫描；zero-core fixture 检查 | upstream 零改动、零 patch 机制 | `references/deepseek-harness-test-use` 测试前后两次 `git status --porcelain` 均空（pre: 76fda72979；post: 同，STATUS-CLEAN）；`patch-package` 字样仅存在于测试 fixture `scripts/fixtures/zero-core/`（非真实改写）；无 postinstall 改写 | PASS |
| D2 | 冻结 fork 未移动 + 干净 | `git -C references/deepseek-harness rev-parse`（分支/tag/peel）+ `cat-file -t` + `status --porcelain` | 分支 tip = tag peel = `a3ab319927…`；工作树干净 | 分支 `feat/team-vnext-integration-20260829` tip = `a3ab31992762c5d6560797eabc7e0885a9320ade`；tag `legacy-agent-team-pre-vnext` 为**注释 tag**（object `276b3f8b…`，peel 后 = `a3ab319927…`）；工作树 clean（checkout HEAD 在 `cd5ef814`，AGENTS.md 记录的 2026-09-04 基线对比检出） | PASS |
| D3 | test-use pristine | `rev-parse HEAD` + `status --porcelain` | = `76fda72979…`（0.1.2-rc.1 基线），空 | `76fda729799fe9b3848dbe2c211d4b231032b81e`，porcelain 0 行（测试前后均核） | PASS |
| D4 | 无 force-push 痕迹 | 7 个 `origin/*` 逐一 `merge-base --is-ancestor origin/X localX`；reflog 扫描 | 全部 YES（远端均为本地祖先 → 不可能有后移/改写） | 7/7 YES（origin/master `a733e9f` ⊂ master `2c1c200`，差 1 个 push 后记账提交 R124；origin/int/* 3 个、origin/task/* 3 个全部是本地祖先）；reflog 为纯 commit 链（无 reset/force 痕迹） | PASS |
| D5 | 我自身无越界写 | 自查：git commit/push/branch/tag 计数 = 0；对 `references/` 的写入仅限 gitignored 临时区 | 0 次 git 变更；无越界 | 本会话零 git 变更；`references/` 仅新增 `.fresh-clone-rev12-d23c606/` 与 `.dsh-test-rev12-s8-*`（均 gitignored 隔离区，未触碰 frozen fork 与 test-use 树本身） | PASS |

### E. 冻结文档语义合规（facet 相关部分）

| # | 检查 | 依据 | 实际 | 结论 |
|---|---|---|---|---|
| E1 | Gate G10 — Release 清单 | DevPlan §23.5 | upstream source diff = 0（D1/D3）✓；no private imports（C4/C10 行内解析全部公开 registry 包 + 工作区内部链接）✓；no fork-only hard dependency（C1–C6 registry-only 干净树安装+build）✓；plugin independent build/test pass（A1–A5）✓（其余项如 UI invariants/recovery suite 属其他 reviewer facet） | PASS（本 facet 覆盖部分） |
| E2 | Release Compliance C1–C4 | DevPlan §33 | C1 pristine Host（D1/D3 前后双核）✓；C2 no private import（C4）✓；C3 no patch mechanism（D1）✓；C4 no fork-only hard dep（C1–C6）✓ | PASS |
| E3 | 第一版生产发布定义 | DevPlan §40 | pristine upstream install/run ✓（C 节全部 + A6 实例在 pristine 宿主树上 boot 成功）；Team-required Host diff = 0 ✓（D1/D3） | PASS |
| E4 | Blueprint identity | Architecture §5.2/§5.3 | 模板蓝图 `my-team-bp-1` 携带 stable blueprintId + revision + contentHash（`sha256:a4374629…`，parseBlueprint 计算）；恰一个完整 LeaderTemplate（`leader.templateId=leader`，validate 通过即满足 §5.3）；identity 不依赖文件系统路径 | PASS |

---

## Findings（非阻塞）

1. **INSTALL.md §2 `pnpm build` = `pnpm -r run build`**：行为等价性已按 gate 方法学以逐包 tsc 等价核验（R122 先例；沙箱下 pnpm 包装器 EPERM 绕行 = 直接调 node 二进制，TEST_METHODS §5 文档化边界）。不构成缺口。
2. **`patch-package` 字样**：仅出现于 `scripts/fixtures/zero-core/` 测试 fixture（用于断言零核心不变量），非真实 upstream 改写（D1）。
3. **模板 vs R122 的 `defaultWorkspace`**：模板将其列为 optional 且不写；R122 测试世界写了。`validateTeamPluginConfig` 接受两者（C8 正例即无 `defaultWorkspace` 的 12 字段形态），无行为差异。
4. **combo 图 1 条差异**（picker-browse vs picker-native）：R122 世界多挂的 §7 测试世界设备行所致，产品面（client 行）完全一致（C10）。
5. **tag 形态提示（供记账）**：`legacy-agent-team-pre-vnext` 是注释 tag（tag object `276b3f8b…`，peel `a3ab319927…`）。AGENTS.md 所述"均锁 a3ab319927"指 peel 后 commit，与实测一致。
6. **我的临时产物**：留在 my worktree（`rev12-*.ps1/.mjs/.log`、`rev12-smoke/`、node_modules/dist）与 `references/` 两个 gitignored 临时区，不影响 gated 树。

## Rationale

facet 内每一项退出标准都有我自己执行的命令输出背书：五闸在最终树全绿（A1–A6，其中 smoke 非浏览器部分为全新 DSH_HOME、全新端口、自写 harness 的完整独立重跑，六道 gate 全过且 teardown 后端口/进程/宿主树全部复原）；新机器等价性以真实 `git archive` 干净树 + registry-only 安装 + 9 包 build + 15/15 hermetic 解析 + 4/4 安装面产物逐字节一致闭环（C1–C6）；模板可安装性的两道宿主侧闸门（行配置 fail-closed 校验 + blueprint 解析管线）均用同一编译产物的正例 + 负控双向证明（C7/C8），字段级与已验证的 R122 世界完全对齐（C9/C10）；红线四项逐一实测（D1–D4），并含测试前后双时点 pristine 核验（C1 gate 语义）。未发现任何阻塞级缺陷；findings 均为非阻塞记录。故裁决 **通过**。

## 独立重跑清单（我实际执行的命令汇总）

- `pnpm install --ignore-scripts`（worktree 295.8 s / sim 树 121.8 s，均 exit 0）
- 逐包 `tsc -b`（worktree 9/9 + typecheck 8/8；sim 树 9/9）
- `vitest run` root（2395/2395）+ 逐包 vitest（2630/2630）
- `eslint .`（exit 0）
- `git archive d23c606` → 干净树 + install + build + hermetic probe（15/15）
- `place-dist-glue.mjs` + `build-client-composition.mjs`（worktree 与 sim 树各一次）
- 4 产物 SHA-256 重算 × 2 树 vs R122 世界（8/8 BYTE-IDENTICAL）
- `rev12-template-audit.mjs`（parseBlueprint 正例 + 负控；validateTeamPluginConfig 正例 + 3 负控）
- `rev12-resolve-audit.mjs`（dist glue + source seam 动态导入 + 12/12 createRequire 解析 INSIDE）
- `rev12-smoke/rev12-boot.mjs`（全新世界 S8-READY 等价六闸，port 3182/mock 3494，pid 69788）
- `preparse-patch.mjs` / `field-compare.mjs` / `cfg-cmp.cjs` / combo 图 diff
- 红线命令组：`rev-parse`（分支/tag/peel）、`cat-file -t`、`status --porcelain`（×4 时点）、`merge-base --is-ancestor`（×8）、`for-each-ref`、`reflog`
- lockfile integrity 抽查 ×3（web_fetch 对照 registry）

## 红线自查（本会话自身纪律）

- git commit/push/branch/tag/apply：**0 次**（只读 git 命令）
- `references/` 写入：仅 gitignored 临时区（`.fresh-clone-rev12-d23c606/`、`.dsh-test-rev12-s8-*`）；frozen fork 与 test-use 树零触碰（前后 status 双核空）
- `D:\deepseek-harness\` 与 :3080：零触碰
- 启动的实例（pid 69788，port 3182）与 mock（3494）已停止，端口释放确认，无残留进程
- 未向共享 evidence 目录写入任何文件；本 verdict 写入指定 reviewer-12 路径

## Routing

本会话模型路由为 qiyuan-self/qwen3.8-27b（继承自主会话）
