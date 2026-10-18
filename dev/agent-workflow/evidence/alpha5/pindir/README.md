# a5-pindir — C-16 补钉 + 双向漂移机检（实施单 B）

分支 `a5-pindir` @ 基线 master `5885e46ec2bcbfa7bfa58882d835801ec8b79e1f`。
双源记：`git ls-remote origin master` = `5885e46e…`；`git fetch origin master` 后 `git rev-parse origin/master` = 同值。
所有权：本单只触 `PLANE_RESERVED_NATIVE` 清单区 + 漂移机检区（plane .mjs 头注/数组、新 spec、p4t6 账本、dist 镜像）。**零触 planeCfg 消费区**（并行单 a5-globoff-key 属区；其 `stash@{0}` 属他人，未动）。

## ① 复现（先红，负控入证据）

装配级注入 = `createTeamToolPlaneAssembly({..., plane: {fsInstance, confinedProvider, names: {...DEFAULT, glob: 'run_code'}}})`。
pre-fix（stash 掉本单修复后实跑，`repro-red-prefix-full.log`）：

- Gate 0b 不拒：`verifyPlaneNames` 对 13 名全放行；
- **装配接受、行真实挂载**：`{"ok":true,"ownNames":["team_grep","run_code","team_bash","read"]}`（run 日志 L28-31）；
- `names.bash='schedule_list'` 同形（第二个装配腿）；
- 双向漂移腿 FORWARD=13 全红（名单与 ③ 逐字一致）；
- 五腿同红（13 名矩阵/两装配注入/漂移 forward/注册含名回归），host-pin 与 fork 处置腿为 host 事实、pre/post 恒绿。

## ② 修复：13 名补钉入 PLANE_RESERVED_NATIVE

`run_code`（@deepseek-ai/dsh-tools 注册表自带 PTC 保留通道，catalog 行 mode:ptc/both）、
`plugin_manager`（packages/boot/plugin-manager/src/tools.ts:20）、
`schedule_create|delete|list|update`（packages/schedule/schedule/src/tools.ts:452 等）、
`workflow`（packages/workflow/tool-workflow/src/index.ts:36 toolName 缺省）、
`stagehand_act|extract|navigate|observe|screenshot|tabs`（packages/experimental/browser-use-stagehand-native）。
洞因（清单头注已记）：第一刀用 `name: '<n>'` 源 grep，漏掉一切**非字面量注册路径**（注册表自带名 / tools.ts 映射 / toolName-config 路由 / 实验包）。

测试：13 名 × 4 挂载面（grep/glob/bash 行 + readName）逐名具名腿全落
`PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` + `reserved native name '<n>'` 原文
（`pindir-pername-verbose.log`，13 条 ✓ 逐名实录）；两装配注入腿在 Gate 0b 拒、零挂载。

## ③ 双向漂移机检（权威源=宿主 catalog harvest，同源复用）

harvest 机制复用 = 宿主 `scripts/gen-tool-catalog.ts` 启动式收割 + 其承诺工件
`docs/tool-catalog.md`（宿主自身 guarantee spec `packages/core/tools/tests/gen-tool-catalog.spec.ts`
在 pin 处 --check 验新鲜）。从本仓无法 boot 宿主 workspace，消费其 pin 处工件即同源复用
（工件新鲜度=宿主保证）。口径=schemas 列 ∪ shippedNames 列（生成器文档口径：toolName 装载名由
per-package shippedNames 注记），`mcp__` 前缀族前缀钉不枚举。
列序实测：生成行恒 8 字段（cells 无竖线），schemas=col2、shippedNames=col5（col6=note 永不收割）。

- pre-fix census（`census-pre-fix.txt` / `census-vs-catalog.mjs` 可重放，exit=1 红）：
  FORWARD=**恰 13**（与本单钉名逐字相同）、REVERSE=0；catalog=66=53+13。
- 机检腿（spec 内）：宿主树 HEAD ≠ `TEST_USE_BASELINE_SHA` 即红（先重derive再移pin）；
  **漏钉=红**；反向（pinned∉catalog）必须在 `REVERSE_DISPOSITIONS` 有显式理由条目，否则红——当前
  reverse=0、map 空=合法（两种合法处置 kept/retired 都在注释中给出）。

## ④ subagent_fork 特判（根点名）——处置=保留（现装实注册，非 forward-looking）

@639ed01539 现场核据：
- 宿主生成器清单 shippedNames 明载：`scripts/gen-tool-catalog.ts:538` `shippedNames: ['subagent','subagent_fork']`；
- 承诺工件在表：`docs/tool-catalog.md:40`（shippedNames 列）+ 注记 “`subagent_fork` remains fixed-route”；
- bundle 路由启用态：`packages/bundle/base/cordis.patch.yml:387` `toolName: subagent_fork`（无 disabled），
  web-app presets `cordis.patch.yml:100 / ptc.patch.yml:101 / standard.patch.yml:101` 同**启用**；
- boot-harvest names 列无它（fork 是 tool-subagent 的第二 bundle-组合实例，名字来自装载 config）——
  **属 harvest names 口径覆盖不到、artifact shippedNames 口径覆盖到**，故非“catalog 真无”。

处置：**保留**。清单数组处注释完整记录上述核据；机检腿每次运行现场再核（bundle 四文件逐块
断言 fork 路由存在且无 disabled 标记 + catalog 工件含 subagent_fork + 数组含名），未来 harvest
口径若丢它，红在此处而非静默删钉。

同族观察项（如实上报，未越权钉）：`subagent_codex`/`subagent_claude_code` 为同包
provider 路由名，**在每个 shipped preset 均 `disabled: true`**
（cordis/ptc/standard.patch.yml，如 standard:105/113），不在 catalog 工件、默认不挂载 → 本单
未钉；一行翻转即可挂载=同型冒名面，建议另行裁决。（bundle 全域 toolName 路由穷举=仅 subagent 系
四名，`grep -rn toolName: packages/bundle --include=*.yml` 4/3/3/4 计数已录。）

## ⑤ 测试与门

- 新 spec `packages/runtime/test/a5-pindir-reserved-native.test.ts`：**19/19 绿**
  （13 具名逐名腿 + 2 装配注入腿 + 双向漂移腿 + host-pin 腿 + fork 处置腿 + 零回归腿；
  `pindir-pername-verbose.log`、`suite-green-post-fix.log`）。
- 邻居套件：`a5natexe-native-takeover + alpha5-glue7 + a5-pindir` 3 文件 **31/31 绿**
  （`natexe-glue7-pindir-green.log`）。natexe 无注册表计数钉（其 drift-pin 只 toContain 子集），
  增名零冲击，实测印证。
- p4t6 具名重 tie：`SCANNED_PATHS_A5PINDIR`（1 path，具名条款+两处求和+join+`toBe(1201-1200)`
  +覆盖标题尾款）。锚=现场 scanner print `MEASURED_TOTAL=1201`（`p4t6-anchor.txt`，非抄链值）。
  p4t6 **10/10 绿**（`p4t6-green.log`）。
- 全套：runtime `4662 passed / 10 failed(4 files)`、testkit 满跑 `358-359 passed / 19-20 failed(3-4 files)`。
  **对照实验（本单修复 stash 后现钉 master 复跑）失败完全同集**（`control-4files-pristine-master.log`
  10f/4f 同；`control-testkit-4files-pristine.log` 19f/3f 同，满跑有 ±1 flake）——
  这些是本宿主既有环境失败（FACT_TYPE_CATEGORY 源面漂移、PERSONA_SECTION 残留扫描、
  install-surface 新鲜腿、peer evaluator 腿），与本单无关，如实记录不冒充新增。
- typecheck：runtime `tsc` 首跑抓到我 spec 一处 TS2345（matchAll 索引类型）→ 修后 **exit 0**
  （`tsc-runtime.log` 空）；testkit tsc OK。
- dist 镜像律：`IDENTICAL-AT-HEAD` 实测 + `check-artifacts-committed` 指我 drift=1 →
  src→dist 同步为字节一致镜像（同 commit）。commit 后复跑 verdict 见 git log 附注。

## 足迹/注意

- 本仓 stash 栈跨 worktree 共享：并行单 a5-globoff-key 的 `stash@{0}`（WIP）出现过一次与我的
  bare `git stash pop` 竞争（git 自动中止，零损伤）。本单此后只用显式 ref；**该 stash 属他人，未动**。
- 满跑套件在 cwd 留过 `packages/runtime/out|plans` 运行残渣（非 gitignore 覆盖），已按名删除两轮；
  若 CI/他单满跑再现，属既有残渣模式，非本单文件。
- 测试世界 `tests/homes/a5pindir-unit-*` 由 afterAll 自删；端口/mock LLM 位未用（纯装配级）。

## 附记：根 21:15Z 裁决轮（(b)+(c)，正向第二笔）

- **两名补钉**：`subagent_codex`/`subagent_claude_code` 入 PLANE_RESERVED_NATIVE（现 68 名）。
  注释=真实注册来源（宿主 index.ts:108 路由名 + presets cordis :107/:115、ptc :108/:116、
  standard :108/:116，disabled 同块 standard :105/:113）+"默认 disabled 不构成冒名许可"。
  **零启用**：spec 腿断言两路由在全部 bundle/preset 仍无 enabled 块；工具本体保持 shipped 禁用。
- **翻转漂移**：新 spec `a5-pindir-subagent-flip.test.ts`（4 腿：事实+fixture 精准性、
  逐名双向往返（钉态不变×4 面×verify+assembly、两向 verdict 字符串恒等）、零启用）。
  双向原文=flip-drift-raw.txt（含完整拒绝 message 与 assembly verdict；fixture 纯内存，
  宿主 bundle porcelain="" 自证）。fixture 修注：split 吞换行需 join('\n')（首轮红即此，已修）。
- **来源反查**：双向机检新增"钉名须有真实注册来源"腿（字面量/`toolName:` 路由/命名模板三类，
  stagehand 六名走显式命名模板；猜名=红）。现场 census=source-provenance-census.txt：
  66 名全过（两名入表后 spec 腿现场重跑亦过）。
- **REVERSE_DISPOSITIONS 首次启用**：两名以 root 21:15Z 理由入表（catalog 不含 disabled 路由名，
  属合法反向，须显式理由——正是该机制的用武示例）。
- **stagehand 六名销案**（根 21:15Z ③）："现装才钉"口径撤回后无冲突悬案，维持已钉不动；
  ADVERSARIAL-SWEEP.md 附记同步销案。
- **p4t6 重 tie**：新增第二 spec → 现场 scanner 亲数 MEASURED_TOTAL=1202
  （p4t6-anchor-1202.txt），名册 SCANNED_PATHS_A5PINDIR 具名两条、tie `toBe(1202-1200)`、
  覆盖标题字面=1202。p4t6 10/10 绿。
- 邻居矩阵 4 文件 **48/48**（natexe-glue7-pindir-flip-green.log）；tsc 双包 0；
  全套复跑=runtime-full-suite-r2.log（判读按 PREEXISTING-ENV-FAILURES.md，同法重锚）。

## 附记：merge-sync @46e48218（#342=a5-globoff-key 已合，master 前进）

- 双源核：`git ls-remote origin master` = fetch 后 `git rev-parse origin/master` =
  `46e48218e48314662586ff053ca3825e2889a6bb`（一致）。正向 `git merge`（祖先链保持，无 rebase/amend/force）。
- **冲突清单**：仅 `packages/testkit/test/p4t6-session-event-scan.test.ts`（双单同抢 1201 账位：
  globoff 钉 1200→1201，本单 1201→1202/1202→锚区）。解=**union 重锚**：globoff 条款与 tie 原样保留
  （1201-1200），本单条款上移为 1201→1203，标题=master 版+A5-PINDIR 尾款合并，合并树现场亲数
  `MEASURED_TOTAL=1203`（p4t6-anchor-1203.txt，pindir=true/true globoff=true 三路径在场自证），
  tie=`toBe(1203-1201)`，禁抄纪律合规。
- plane .mjs src+dist 双双 **auto-merge 干净**；亲读合并块归因：master 侧 5 hunk 全落
  :473-:677 装配体/闭合键区（globoff 属区），零触钉名清单区；本单对 master diff=65 行全在清单/注释区。
  合并后 src↔dist 镜像 `diff -q` 字节一致。
- 证据脚本 census 假阳性修正：其裸正则把新注释里的 `default('subagent')` 计数成第三遍 'subagent'
  →"duplicate pin" 假警报；加注释行过滤（与 provenance-census 同法）。合并树复量：
  catalog=66、pinned=68、FORWARD=0、REVERSE=2（两名均有 REVERSE_DISPOSITIONS 理由）=设计内
  （census-merged-tree.txt）。
- 整合树必跑全表（旧头绿不豁免，全部在合并树现场跑）：装配邻域 11 件（含 pindir 全组+flip+natexe+
  glue7+globoff+glob-backend+g1-deny+g6-install+a5b2+a5b3+a5int-r3）**149/149**；p4t6 10/10@1203；
  tsc runtime+testkit 双 0；lint-identities exit 0（161 行/76 distinct/1291 files）；
  drift at-head=census 复量+spec host-pin/drift 腿绿+镜像字节一致；freshness verdict=ok(1748/glue=9)。
