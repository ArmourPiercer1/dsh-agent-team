# GATE P9 master product closure → master — reviewer-6 裁决

- 审查者：reviewer-6（3 名独立 reviewer 之一；本裁决不依赖任何其他审查者的意见或转述）
- facet：fresh-machine 可安装性与红线
- 受审对象：门禁 P9 master product closure → master（int 分支拟 fast-forward 进 master）
- 受审区间：master tip `2c1c200` (R124) → int tip `2359d31`（merge `232316d`，parents = `2c1c200` + `bd38827`；int 增量 `8cf9fcb`、`071080d`、`2359d31`）
- 审查 worktree：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\R2MC-3`（detached @ `2359d31`，已核实 `git rev-parse HEAD` = `2359d31b4b3f486cf8d2f18c9374bc994cf293fb`）
- 环境：Node v24.20.0 / pnpm 11.7.0 / 暖 store `D:/.pnpm-store`
- 日期：2026-09-05

## 裁决

**补充内容**

`packages/client` 仍声明 7 个 `link:../../../../references/deepseek-harness-test-use/...` 形式的
devDependency（指向 gitignored 的机器本地目录）。我已在本机以 `git archive` 重建 fresh-clone
等价物并独立复跑文档链：`pnpm install` 静默创建 7 个**坏 junction**（exit 0、无任何告警），
随后 `pnpm build` 在 `packages/client` 失败（exit 2，40+ 条 TS2307/TS2664/TS7006）——
INSTALL.md §2 记载的独立机器安装链（clone → pnpm install → pnpm build → pnpm build:composition）
**在 fresh machine 上于第 2 步断裂**，client 挂载面（composition-shim，即本 Phase 的 P9 UI 产品面）
无法按文档链生成。host 侧（runtime 5 依赖 + zod，registry 声明）经我独立复跑完全可 fresh-machine
安装；该缺陷范围限于 1 个包的 devDeps 声明，可通过一项简单、机械、产品面零改动的补充修复到通过/投机通过
（见 findings F1 的补充要求）。其余 facet 必做检查全部 PASS（逐项见下表），红线全部守住。

## 路由核验

本会话模型路由为 `qiyuan-self/qwen3.8-27b`（继承自主会话）。

## 范围

1. docs/INSTALL.md 全文审计：§2 链上命令与脚本源码一致性、§3 挂载模板字段级审计（对照 host 配置校验代码）、client 行形态与 R122 验证世界比对；
2. 安装链独立复跑（本 worktree）：`pnpm install --ignore-scripts` → 逐包 tsc（9 包）→ `place-dist-glue.mjs` → `build-client-composition.mjs`，4 产物存在性 + 与 R122 验证世界逐字节比对；
3. 依赖解析 fresh-machine 核心断言：root node_modules 无 @deepseek-ai、6 specifier 解析探针、row-owned 模块 import 冒烟；
4. fresh-clone 模拟（`git archive 2359d31` 全量抽取 → 新目录 `pnpm install` → `pnpm build`）——独立机器安装链的实证复跑；
5. lockfile 审计：`importers.packages/runtime` 6 条目来源与 integrity、全 lockfile 非 registry 协议扫描、npm registry 可达性/发布状态核验；
6. smoke 证据核验（s8-boot.log / state.json / dump-config-s8.txt / r125-gentry.log / gentry-report.json 对照 s8-boot-r125.mjs 源码的自洽性）+ **非浏览器部分独立复跑**（3180 全新世界 boot，farm 禁用模式，跑完即 stop）；
7. 红线：references 受审区间零改动、test-use pristine、冻结 legacy fork 状态、CORE PATCH BUDGET=0（受审区间无 upstream 源码改动/无 patch-package 类改写）、无 gated 历史 force-push 痕迹。

## 逐项检查表

### A. INSTALL.md §2 命令存在性（文档 ↔ 仓库脚本）

| # | 命令/声明 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| A1 | 根 `package.json` 存在 `build` / `build:composition` 脚本 | 存在且与 §2 等价 | `build = pnpm -r run build`；`build:composition = node scripts/place-dist-glue.mjs && node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | PASS |
| A2 | `scripts/place-dist-glue.mjs` 行为 = §2 描述 | 把 `packages/runtime/src/plugin/live/agent-bindings.mjs` 字节级复制到 `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`；fail-closed（src 缺失或 dist 根缺失即 exit 1）；`upstream-resolver.mjs` 不复制（走布局候选列表） | 源码逐行核对：`PLACEMENTS` 恰为上述 1 项，`copyFileSync` 字节级复制，两处 fail-closed 检查存在；`registerUpstreamResolverOnce`（host.ts:170-195）证实 resolver 走 dist/source 双候选 `register()` | PASS |
| A3 | `scripts/build-client-composition.mjs` 行为 = §2 描述 | 把 client tsc ESM dist + CSS 源编译为单文件 `client-bundle.js`（`window.__ModuleLoader__.load` wire 格式、identity CSS class map、`<style>` 注入、基线 external fail-closed）+ `package.json`（`dsh.client` manifest + `./client` export）+ 惰性 Node 半 `index.js` → `packages/client/composition-shim/` | 源码核对：`EXTERNALS` 恰为 {react, react/jsx-runtime, dsh-client-store, dsh-client-ui-primitives} 且越界即 `die`；shimPkg 含 `dsh.client: {platform:'web'}` 与 `./client` export；输出 3 文件与 §2 产物表一致 | PASS |
| A4 | §2 产物表 4 路径在跑通链后全部存在 | 4/4 存在 | 复跑后 4/4 存在（见 B4） | PASS |

### B. 安装链独立复跑（本 worktree，detached @ 2359d31）

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| B1 | `pnpm install --ignore-scripts` | exit 0，lockfile 不漂移 | exit 0（23.7s，"Lockfile is up to date, resolution step is skipped"，316 包全暖 store 复用；日志 `install-r6.log`） | PASS |
| B2 | `pnpm -r run build`（= 逐包 `tsc -p tsconfig.build.json`，9 包） | 9/9 成功 | 9/9 `Done`（contracts/legacy/remote/domain/runtime/storage/testkit/tools/client；exit 0；日志 `build-r6.log`） | PASS |
| B3 | `node scripts/place-dist-glue.mjs` + `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | 各 exit 0 | glue 1 placement（byte-identical）；builder 85 modules / 11 css / entry=plugin/client.js；3 文件写出 | PASS |
| B4 | 4 产物存在 | 4/4 | host.js ✓、dist glue ✓、seam.mjs ✓、composition-shim/ ✓ | PASS |
| B5 | 生成产物与 R122 验证世界逐字节一致 | SHA-256 全等 | client-bundle.js `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997`（845581 B）、index.js `D385C065…`、package.json `B4509233…` 与 `references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/` 三件逐字节一致；dist glue `D50D3B3F…` 与 byte-compare.md 记录一致 | PASS |

### C. §3 挂载模板字段级审计（对照 `validateTeamPluginConfig`，packages/runtime/src/plugin/host.ts:205-276）

校验函数 fail-closed 全字段要求 vs INSTALL.md §3 模板：

| 字段 | 校验要求（源码行） | 模板取值 | 判定 |
|---|---|---|---|
| config 本体 | 非 null 普通对象（L218） | 对象 | PASS |
| `bootPhase` | 恰为 "create" \| "resume"（L219） | `"create"` | PASS |
| `rootSessionId` | 非空字符串（L220） | `"team-root"`（文档注明每世界唯一） | PASS |
| `blueprintSource` | 非空字符串（L221） | 内联 YAML（结构与 R122 验证行同构：schemaVersion/blueprintId/revision/leader/members/requirements/teamEnvelope/memberEnvelopes/policyStates/quotas/metadata） | PASS |
| `generation` | 正整数（L222） | `1` | PASS |
| `defaultWorkspace` | 可选，存在须为 string（L223） | 未给（文档列为可选） | PASS |
| `seedMembers` | 数组；每项 instanceId/templateId/label/childSessionId 字符串（L224-236） | `[]` | PASS |
| `staticModel` | `{provider, model}` 字符串，null 即 fail（L237-244） | `{provider, model}` 占位（文档 §4 要求真实模型） | PASS |
| `deniedSelection` | 必须**显式** null 或普通对象，undefined 即 fail（L245-252） | `null` | PASS |
| `mcpServer` | 必须**显式** null 或 `{name, port:number\|null}`（L253-261） | `null` | PASS |
| `environmentFacts` | 数组（L262） | 3 条（tool/web、skill/base、persona/standard） | PASS |
| `externalPolicyFacts` | `{hard: object, capabilityExists: object}`，null 即 fail（L263-272） | `{hard: {}, capabilityExists: {}}` | PASS |
| `glueUrl` | 非空字符串（L273） | `file:///<REPO>/packages/runtime/dist/.../agent-bindings.mjs`（正斜杠） | PASS |
| `seamUrl` | 可选，存在须为 string（L274） | `file:///<REPO>/packages/runtime/root-binding/harness/seam.mjs` | PASS |

字段集与 R122 验证行（`references/.dsh-test-s8-2026-09-04T12-26-59/profiles/web/cordis.patch.yml` L7-38）逐字段对齐（含 R125(2) 补入的 generation/deniedSelection/mcpServer 三必填）：PASS

### D. client 行形态（文档推荐 = R122 live 验证的相对形态）

| # | 期望 | 实测 | 判定 |
|---|---|---|---|
| D1 | 文档推荐行与 R122 验证世界形态一致 | R122 验证世界：`id: "dsh-agent-team-client", name: "../../s8-client-row/index.js"`（profiles/web 上两级 = DSH_HOME 根，行解析到 DSH_HOME 内 shim 包）；INSTALL.md §3 模板：`name: "../../team-client-row/index.js"` + 指引把 composition-shim 复制为 `DSH_HOME/team-client-row/` —— 相对形态（`../../<dir>/index.js`）逐字同构，仅目录名随用户复制路径变化（文档明示「如 DSH_HOME/team-client-row/」） | PASS |
| D2 | `file:///<REPO>/…` 形态的文档限定 | 文档明示该形态未 live 验证、仅当确认目标 DSH 版本接受时使用 | PASS |

### E. 依赖解析（fresh-machine 核心断言）

| # | 检查 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| E1 | root `node_modules/@deepseek-ai` 不存在（干净安装、无 junction farm 残留） | 不存在 | `Test-Path` = False（pnpm 隔离布局；.pnpm 虚拟仓库下为 registry 产物，非 junction farm） | PASS |
| E2 | 6 specifier 解析探针（packages/runtime 下 probe，`import.meta.resolve`） | 全部解析到 worktree 内且文件存在 | 6/6 INSIDE + exists：dsh-agent/dsh-llm/dsh-mcp-client/dsh-session/dsh-storage-domain → `…/R2MC-3/node_modules/.pnpm/@deepseek-ai+dsh-*/…/lib/index.js`；zod → `…/.pnpm/zod@4.4.3/node_modules/zod/index.js`（probe 已删） | PASS |
| E3 | row-owned 模块 import 冒烟（tsc + place-dist-glue 后动态 import） | 零 missing specifier | `agent-bindings.mjs`（dist glue）import OK（exports: createAgentBindings）；`seam.mjs` import OK（exports: createRealStorageDomainSeam） | PASS |
| E4 | 6 个依赖 npm registry 发布状态 | 已发布、可达 | `npm view` 逐一确认：5 × @deepseek-ai/*@0.1.2-rc.1 + zod 4.4.3 全部已发布；`@deepseek-ai/dsh-agent@0.1.2-rc.1` 的 `dist.integrity`（sha512-lfaqN34v…）与 lockfile L203 条目逐字符一致 | PASS |

### F. lockfile 审计

| # | 检查 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| F1 | `importers.packages/runtime` 6 条目来源 | registry（无 link:/file:/workspace: 协议） | 5 × @deepseek-ai/* specifier `0.1.2-rc.1`、zod `4.4.3`、yaml `^2.9.0`，version 均为 registry 解析串（peer 后缀形式）；`packages:` 段 6 条目全部带 `resolution: {integrity: sha512-…}`（抽查 dsh-agent L203 / dsh-llm L236 / dsh-mcp-client L241 / dsh-session L264 / dsh-storage-domain L270 / zod L1720，6/6 有 integrity） | PASS |
| F2 | 全 lockfile 非 registry 协议扫描 | 除 client 包 7 个 link: 与 2 个内部 workspace link 外无其他 | `references/` 路径 14 处 = 7 条 link: × (specifier+version)；`link:../contracts`、`link:../remote` 为内部包 link（正常）；无 file:/workspace: 指向 6 目标依赖 | **发现 F1（见 findings）** |

### G. fresh-clone 模拟（独立机器安装链实证）

方法：`git archive --format=tar 2359d31` → 抽取到 `.worktrees/R2MC-3/fresh-sim/`（4180 文件，仅 tracked；无 references/、无 node_modules，等价 fresh `git clone` 产物）→ 在其中复跑 §2 链。

| # | 步骤 | 期望（INSTALL.md §2） | 实测 | 判定 |
|---|---|---|---|---|
| G1 | `pnpm install --ignore-scripts` | exit 0 | exit 0（39.8s，316 包）——**但** `packages/client/node_modules/@deepseek-ai/` 下 7 个 junction 指向 `D:\…\.worktrees\references\deepseek-harness-test-use\…`（不存在），7/7 `valid=False`；日志无任何告警（静默坏链接） | **FAIL（发现 F1）** |
| G2 | `pnpm build` | 9/9 成功 | 8/9 Done；`packages/client` **Failed**（exit 2）：40+ 条 `TS2307 Cannot find module '@deepseek-ai/dsh-client-ui-slots' / dsh-client-store / dsh-client-ui-conversation/client / dsh-client-ui-primitives`、`TS2664`（module augmentation）、级联 `TS7006`（日志 `r6-freshsim-build.log`） | **FAIL（发现 F1）** |
| G3 | 推论：`pnpm build:composition` 的 client shim 按文档链不可达 | 可达 | 链在 G2 断裂；（tsc 类型错误不阻断 JS emit，client dist 实际有产出，但文档链以 `pnpm build` 成功为前提，用户按文档执行即止于此） | **FAIL（发现 F1）** |
| G4 | 对照：host 侧在 fresh-sim 的可用性 | runtime 可装可建 | fresh-sim 中 runtime 包 build Done；5 依赖 + zod 全部 registry 解析（G1 的 316 包安装含全部 row-owned 依赖） | PASS |

### H. smoke 证据核验 + 非浏览器部分独立复跑

| # | 检查 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| H1 | 证据自洽性（s8-boot.log × state.json × dump-config-s8.txt × s8-boot-r125.mjs 源码） | S8-READY 各闸（boot 行、401 门、row health、serve、catalog.list）相互印证 | 时间线 17:16:50.489Z（home）→ 50.497（shim 放置，sha256=2097ce5e…，845581 B）→ 53.658（throwaway boot 建 profile）→ 55.549（boot 行）→ 55.560（cookie，pid 58420 = state.json instancePid）→ 55.576（index 200，24493 B）→ 56.597（health ok:true boot:1 toolCount:10，满足代码闸 `ok===true && toolCount===10`）→ 56.613（401 门）→ 56.719（dump rows 3×true）→ 56.770（serve combo 200，4627226 B，sha256=a1db11fe…，bundleBytesContained:true）→ 56.788（catalog.list 200，s8v-bp-1）→ 56.789 S8-READY → 17:19:57.188 S8-STOPPED（ports 3180/3493 free = state.json stoppedAt 同刻）；farm 禁用模式（"0 specifiers, 0 created, 0 preexisting, 1 builtin-skipped, 0 unresolved" = 代码 else 分支日志形态）；`wtLinks.created=[]`；boot 时间（17:16Z）早于 2359d31 提交（17:24Z），且 boot 树 = 071080d，2359d31 相对 071080d 仅 evidence+docs 增量（已独立核对 product-surface diff 为空） | PASS |
| H2 | gentry 结论自洽性（r125-gentry.log × browser/gentry-report.json） | `failures: none` 与报告一致 | 报告 `failures:[]`、`consoleErrors:[]`、`pageErrors:[]`，at=17:18:58Z 落于 S8-READY 与 stop 之间；22 条 team-remote RPC = 日志 "RPCs: 22; failures: none"，响应侧全部 200；rootSessionId（session-ea2ca293…）日志/报告一致（报告内中文为 GBK/UTF-8 捕获伪影，日志原文正确，属证据捕获瑕疵，不影响结论） | PASS |
| H3 | **非浏览器部分独立复跑**（3180 全新世界，farm 禁用，S8_WT=本 worktree，S8_SHIM=本 worktree composition-shim） | S8-READY 后 stop、端口释放、3080 未受影响 | 我执行了 boot→stop 全流程（证据 `dev/agent-workflow/evidence/P9-master-closure-r6/`，boot kit 副本 SHA-256 与原件一致 `B5583D03…`，EV 隔离在 `P9-master-closure-r6/`，未触碰已提交的 R125 证据文件）：全新 home `.dsh-test-s8-2026-09-05T02-10-00-R6`；"0 created" junction（declared-deps 模式）；shim 放置 sha256=2097ce5e…；boot 行 ✓；index 200（24493 B，与 R125 同字节数）；health ok:true boot:1 toolCount:10 ✓；401 门 ✓；dump rows 3×true ✓；serve combo 200 / **4627226 B / sha256=a1db11fe…（与 R125 证据逐字节一致）** / bundleBytesContained:true ✓；catalog.list 200 s8v-bp-1 ✓；S8-READY → stop：S8-STOPPED，3180/3493 释放，3080 稳定实例保持在线（未触碰） | PASS |
| H4 | test-use boot 后复核 | byte-clean | `git status --porcelain` 空 + HEAD 仍 `76fda72979…` | PASS |

### I. 红线

| # | 检查 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| I1 | `git diff --name-only 2c1c200 2359d31 -- references` | 空 | 空（references/ 为 gitignored 本地目录，不在 git 内；见 I3-I5 的机器本地状态核验） | PASS |
| I2 | test-use pristine | `status --porcelain` 空 + HEAD = `76fda72979…` | 空 + `76fda729799fe9b3848dbe2c211d4b231032b81e`（boot 前后各查一次，均成立） | PASS |
| I3 | 冻结 legacy fork 受审区间未动 | 区间（2c1c200=09-04 22:47:51+08 → 2359d31=09-05 01:24:36+08）内无写 | 工作树 clean（status 空）；`.git/HEAD` 最后写入 = 2026-09-04 17:14:33+08（早于 base 提交约 5.5h，reflog `HEAD@{0}` = "checkout: moving from feat/team-vnext-integration-20260829 to master"，属 R122 工作时段）；冻结分支 `feat/team-vnext-integration-20260829` 与 `legacy/agent-team-integration-20260829` 仍在 `a3ab319927…`（未被移动） | PASS |
| I4 | CORE PATCH BUDGET=0（受审区间无 upstream 源码改动、无 patch-package 类改写） | 三个 R125 提交仅含声明文件；无 .patch、无 patch 工具生命周期 | 8cf9fcb = 6 文件（.gitignore/docs/INSTALL.md/eslint.config.mjs/package.json + 2 新脚本）；071080d = 2 文件（packages/runtime/package.json + pnpm-lock.yaml）；2359d31 = evidence 归档 + docs/INSTALL.md（product-surface diff 为空）；区间内无 `*.patch`；仓库 `patch-package` 字样仅出现于**负向扫描器** `scripts/verify-zero-core.mjs`（检测 patch-package 痕迹的 C1 闸实现）与其**负样本 fixture** `bad-plugin-a/package.json`（postinstall: patch-package 的坏插件测试件）；无任何包生命周期脚本引用 patch 工具 | PASS |
| I5 | 无 gated 历史 force-push 痕迹 | master reflog 无 force 更新 | master reflog 为顺序 commit 记录（R124←R123←R122←…），无 "update (force)" 类条目（R124 为记录在案的用户授权一次性推送） | PASS |
| I6 | 产品面同一性（本 facet 顺带核验） | 071080d..2359d31 无产品面改动；bd38827..2359d31 产品面仅 R125 增量文件 | `git diff --name-status 071080d 2359d31`（非 evidence/非 docs）= 空；bd38827..2359d31 产品面恰为 7 文件（.gitignore、eslint.config.mjs、package.json、packages/runtime/package.json、pnpm-lock.yaml、2 脚本） | PASS |

## Findings

### F1（较明显，构成本裁决依据）— fresh-machine 安装链在 `pnpm build` 步断裂：packages/client 的 7 个 link: devDeps 指向 gitignored 机器本地目录

- **事实**：`packages/client/package.json` devDependencies 含 7 条
  `link:../../../../references/deepseek-harness-test-use/…`（cordis/vendor、dsh-client-locale、dsh-client-store、
  dsh-client-test-runtime、dsh-client-ui-conversation、dsh-client-ui-primitives、dsh-client-ui-slots），
  lockfile `importers.packages/client` 同形落账（7×2=14 处 references/ 路径）。相对基准是 importer 目录
  （packages/client）上 4 级：**本仓库布局下该路径落到 clone 根之外**（只有当 clone 恰好位于
  「主 repo 根的 .worktrees/ 子树」时 4 级上才落回主 repo 根、意外命中主树 references/——R122/R125 全部
  绿证据（P9-MC/RC1 worktree 的 install、boot、gentry）正是落在此意外命中之下；fresh-sim 实证见 G1）。
- **实证（fresh-sim，`git archive 2359d31` 等价 fresh clone）**：`pnpm install --ignore-scripts` exit 0 但静默
  创建 7 个指向不存在路径的 junction（7/7 valid=False，零告警）；`pnpm build` 8/9 包 Done、
  packages/client Failed（exit 2，40+ 条 TS2307/TS2664/TS7006）→ 文档链 `pnpm build:composition` 不可达 →
  client 挂载面（P9 UI 产品面）在 fresh machine 上无法按 INSTALL.md §2 生成。
- **影响面**：仅限 packages/client 的 **dev**Dependencies（类型检查/测试用；运行时 external 由 host 模块表提供，
  host 侧 5 依赖 + zod 经我 E1-E4、G4、H3 独立复跑完全 fresh-machine 可用）。产品源码、对象模型、seam 均未受影响。
- **性质**：技术性缺陷（依赖声明面）；R125(1b)「declare row-owned runtime deps」已对 runtime 侧完成同一模式，
  client 侧 devDeps 是同一原则未覆盖的残留；INSTALL.md §2 注释「新机器由 pnpm 直接安装，无需手工 link / junction」
  对 client devDeps 不成立（自动创建的坏 junction 恰是隐性 link 依赖）。

**补充要求（简单、机械、产品面零改动）**：
1. 将 `packages/client/package.json` 上述 7 条 `link:` devDeps 改为已发布的 registry 版本
   （我已逐一核验发布状态：dsh-client-store / dsh-client-ui-primitives / dsh-client-ui-slots /
   dsh-client-ui-conversation / dsh-client-locale / dsh-client-test-runtime @ `0.1.2-rc.1`，
   cordis @ `4.0.2`——与 test-use pristine checkout 的基线 0.1.2-rc.1 同源，与 R125(1b) 对 runtime 5 依赖的
   声明方式完全同构）；`pnpm install` 刷新 lockfile（`importers.packages/client` 7 条 link: → registry 条目）。
2. 复跑并留痕：fresh-clone 模拟（`git archive` 等价物）`pnpm install --ignore-scripts` → `pnpm build` 9/9 →
   `pnpm build:composition`，并断言 composition-shim 三产物 SHA-256 仍为
   `2097CE5E…/D385C065…/B4509233…`（tsc 类型输入变化不改变 JS emit 与 builder 输出，预期逐字节一致；
   不一致则说明发布 tarball 与 rc.1 checkout 的类型面存在差异，需在此记录）。
3. INSTALL.md §2 注释相应更新（client devDeps 亦为 registry 声明）。

**与冻结文档及已验收开发的兼容性**：
- 冻结四文档（Architecture/UI/DevPlan/TaskDoc）无对依赖声明方式的约束；公开 seam 组合面（profile-patch 挂载、
  host 行 config、client shim 形态）完全不变；CORE PATCH BUDGET=0 不受影响（使用上游已发布的 npm 产物，
  正是公开组合路径，非 patch/link upstream 源码）。
- 与已验收开发同构：R125(1b) 已在 packages/runtime 完成同一「link → registry」声明迁移并通过本门禁区间；
  本补充是把同一已验收模式扩展到 client 的 devDeps；`pnpm build:composition` 产物预期逐字节不变（有 SHA 断言兜底），
  不触碰 R122 验证世界承接关系。
- 备选（若发布 tarball 类型面与 rc.1 checkout 不齐）：在库内 vendor 这 7 个 specifier 的最小 .d.ts 类型桩
  （同样产品面零改动、dev-only）。

### F2（轻微，文档修正，不构成门禁障碍）— AGENTS.md 冻结 fork「HEAD 锁」记录已过期

`AGENTS.md` 目录约定表记 `references/deepseek-harness/`「HEAD 锁 `a3ab319927…`」，但该 checkout 的 HEAD
自 2026-09-04 17:14:33+08（R122 工作时段，早于本受审区间 base 2c1c200 约 5.5h）起停在 `master`
（`cd5ef814…` = upstream 0.1.2-alpha.1 release）；冻结分支本体（`a3ab319927…`）未被移动、工作树 clean、
受审区间内零写入（红线 I3 成立）。属文档快照漂移，建议随补充一并修正该行表述（如「冻结分支 `feat/team-vnext-integration-20260829` 锁 `a3ab319927…`；checkout 当前位于 master@cd5ef814（0.1.2-alpha.1），仅参考用途」）。

### F3（轻微，证据捕获瑕疵，不构成门禁障碍）

- `browser/gentry-report.json` 内中文字段为 GBK/UTF-8 捕获伪影（`选择蓝图…` → 乱码），同事件在 r125-gentry.log
  原文正确；不影响 `failures:[]` 结论。
- s8-boot-r125.mjs 的 harness 侧 import 硬依赖 `.worktrees/RC1`（byte-identical 副本可运行，见 H3）——
  属证据工具链的机器本地耦合，非产品面；fresh machine 不执行该脚本（INSTALL.md 链不含它）。

## 裁决理由

1. 门禁出口判据 3（fresh-machine 可安装性：文档链「完整且正确」+「不依赖任何 worktree / junction / 手工 link」）
   已被我的 fresh-clone 独立复跑证伪：`pnpm install` 静默产生 7 个坏 junction，`pnpm build` 在
   packages/client 失败（exit 2），client 挂载面不可按文档链生成。该缺陷范围明确（1 个包的 7 条 devDeps 声明）、
   有已发布的 registry 等价物（逐一核验）、修复机械且产品面零改动、与冻结文档和已验收开发（R125(1b) 同构先例）
   完全兼容——符合「补充内容」定义：不足以通过，但可通过简单补充改善到通过/投机通过。
2. 除 F1 外，本 facet 全部必做检查 PASS：安装链在本 worktree 跑通且产物与 R122 验证世界逐字节一致；
   host 侧（runtime 5 依赖 + zod）fresh-machine 可安装性经四重独立证据成立（registry 发布核验、lockfile
   integrity 抽查、worktree 内 6 specifier 解析探针 + import 冒烟、fresh-sim 中 runtime 包 build Done）；
   §3 模板 14 字段对 `validateTeamPluginConfig` 全部满足（fail-closed 语义逐字段核对）；client 行相对形态与
   R122 live 验证形态一致；smoke 证据自洽且非浏览器部分已独立复跑 S8-READY（serve combo 与 R125 证据
   4627226 B/sha256=a1db11fe… 逐字节一致，0 junction 创建）；红线（references 区间零改动、test-use pristine
   @ 76fda72979、legacy fork 区间未动且冻结分支未移动、CORE PATCH BUDGET=0、无 force-push 痕迹）全部守住。
3. 不构成阻塞：产品代码与对象模型无误，host 侧可安装可用，缺陷有已验证的低风险机械修复路径，
   无冻结语义冲突、无 CORE_SEAM_BLOCKER。

## 我实际执行的独立复跑清单

1. `git rev-parse HEAD` / merge parents / 区间各提交 name-status（worktree R2MC-3 @ 2359d31）；
2. `pnpm install --ignore-scripts`（本 worktree，exit 0，install-r6.log）；
3. `pnpm -r run build`（9 包 tsc，9/9 Done，build-r6.log）；
4. `node scripts/place-dist-glue.mjs` + `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim`；
5. 4 产物存在性 + 4 项 SHA-256 与 R122 验证世界/byte-compare 记录比对（Get-FileHash）；
6. fresh-clone 模拟：`git archive --format=tar 2359d31` → 抽取 4180 文件 → `pnpm install --ignore-scripts`（exit 0 + 7 坏 junction 实证）→ `pnpm build`（8/9 Done，client exit 2，r6-freshsim-install.log / r6-freshsim-build.log）；模拟目录已清理；
7. 6 specifier `import.meta.resolve` 探针（packages/runtime 下临时 probe，6/6 INSIDE+exists，用后删除）；
8. `node -e` 动态 import dist glue（agent-bindings.mjs）与 seam.mjs（零 missing specifier）；
9. `npm view` × 11 个 @deepseek-ai 包发布状态 + dsh-agent dist.integrity 与 lockfile 逐字符比对；
10. lockfile 审计：importers.packages/runtime 6 条目 + packages: 段 6 条目 integrity + 全文件 link:/file:/workspace:/references/ 扫描；
11. smoke 非浏览器部分独立复跑：`S8_WT/R2MC-3 + S8_SHIM/composition-shim + S8_FARM 默认禁用` 下
    `node s8-boot-r125.mjs boot`（byte-identical kit 副本，EV 隔离 P9-master-closure-r6/）→ S8-READY →
    `node s8-boot-r125.mjs stop` → 3180/3493 释放、3080 稳定实例在线复核、test-use boot 后 byte-clean 复核；
12. 红线命令组：`git diff --name-only 2c1c200 2359d31 -- references`、`git -C references/deepseek-harness-test-use status/rev-parse`（前后两次）、legacy fork `status/reflog --date=iso/for-each-ref`、master reflog force 扫描、三包提交 diff 抽查、product-surface 两次 name-status 核对。

## 红线自检（reviewer 自身）

- 未执行任何 git commit/push/branch/tag 操作；未修改 references/ 任何既有内容（boot 仅按 TEST_METHODS 规定
  在 references/ 下新增测试 home `.dsh-test-s8-2026-09-05T02-10-00-R6`，属测试程序留痕产物，既有验证世界
  未触碰）；未触碰 `D:\deepseek-harness\` 与 :3080（3080 全程保持在线、未操作）；测试实例 boot 后已 stop 并
  确认 3180/3493 释放；本 worktree 仅新增 untracked 审查产物（4 日志 + P9-master-closure-r6 证据目录），
  tracked 文件零改动（`git status --porcelain` 复核）；未读取/引用其他审查者意见与转述（主 Agent gate 记录仅作
  待核实的声明处理，每条据以裁决的实质性声明均由我上述独立命令确认）。

## 路由核验（记录）

本会话模型路由为 `qiyuan-self/qwen3.8-27b`（继承自主会话）。
