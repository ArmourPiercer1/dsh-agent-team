# P9 master product closure — Gate 裁决（reviewer-11）

**裁决：通过**

**路由核验（ROUTER_RULES §1）**：本会话模型路由为 qiyuan-self/qwen3.8-27b（继承自主会话）。

**Facet**：构建与 gate 证据（独立全链复跑）——在专属 worktree（`.worktrees/R4MC-2`，detached @ d23c606，起始状态：无 node_modules、无 dist、无 composition-shim，`git status` 干净）内从零复跑五闸全部非浏览器门 + smoke 非浏览器部分。
**受审对象**：门禁 P9 master product closure → master（int tip d23c606，= master 2c1c200 + task/upstream-rc1-compat bd38827 + int 增量 8cf9fcb/071080d/2359d31/ad0a869/39fe1df/d23c606）。
**独立性声明**：未读取、未引用任何其他 reviewer 的裁决或意见；每条据以裁决的实质性声明均由本人独立命令确认（读日志仅作对账输入）。

---

## 一、逐项检查表（命令 → 期望 → 实测 → 判定）

| # | 门 | 命令（worktree 根，除注明外） | 期望 | 实测 | 判定 |
|---|---|---|---|---|---|
| 1 | install | `pnpm install --ignore-scripts`（干净环境：剥离自 :3080 稳定实例泄漏的 `npm_*`/`pnpm_config_*` 变量，CI=true；全新 worktree 无 node_modules） | exit 0，463 包全部落盘，lockfile 不被改写，row-owned 依赖在位 | exit 0；`resolved 463, reused 463, downloaded 0, added 463`；`Done in 3m 38.4s`（221.3s）；`git status` 无 pnpm-lock/package.json 变更；`packages/runtime/node_modules/@deepseek-ai/` 5 包在位；tsc/vitest/eslint 二进制在位；node v24.20.0 满足 engines | **PASS** |
| 2 | typecheck+build | 逐包 `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json`（9 包） | 9/9 exit 0 | contracts 0 (7.7s) / domain 0 (0.2s) / storage 0 (7.1s) / runtime 0 (14.7s) / tools 0 (21.1s) / remote 0 (6.7s) / client 0 (7.3s) / legacy 0 (0.4s) / testkit 0 (0.2s)；BUILD-ALL-FAIL=0（legacy 仅有 tsconfig.build.json，无 plain tsconfig.json，与 gate-summary 表述一致） | **PASS** |
| 3 | test（根配置） | `node node_modules/vitest/vitest.mjs run` | 219 files / 2395 tests 全绿，exit 0 | run1：218 passed + **1 failed**（`packages/runtime/test/p6t1-parallel.test.ts` > "exactly three fail QUOTA_MEMBER_MAX_INSTANCES"，期望 `ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES` 实得 `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL (reprobe-failed)`）→ 隔离复跑该文件 **2/2 绿（各 9/9，exit 0）** → 全量复跑 run2：**219 passed (219) / 2395 passed (2395)，exit 0**（20.7s）。失败模式与证据目录记录的 p6t1-parallel 已知并发负载 flake（R122 r122d 先例）一致；按 brief 协议隔离复跑确认，非缺陷 | **PASS**（已知 flake，隔离协议复验成立） |
| 4 | test（逐包） | client 包本地配置：`cd packages/client; node ..\..\node_modules\vitest\vitest.mjs run`；legacy 包根配置+路径过滤：`node node_modules/vitest/vitest.mjs run packages/legacy` | 与证据逐包计数一致（client 33/480，legacy 7/98），恒等式闭合 | client：**33 files / 480 tests 全绿，exit 0**（9.8s）；legacy：**7 files / 98 tests 全绿，exit 0**；补充实测 client UI 套件单独计数（本地配置 + `client.spec` 过滤）：**16 files / 235 tests 全绿**。恒等式（本人实测）：根配置 2395 = 逐包合计 2630 − client UI 235；client 逐包 480 = 根配置含 245 + UI 235；文件数 219 = 235 − 16。与 gate-test-perpkg.log 逐项一致 | **PASS** |
| 5 | lint | `node node_modules/eslint/bin/eslint.js .` | exit 0、无输出 | exit 0，输出 0 字节（5.1s）。核验 eslint.config.mjs：ignores = dist/composition-shim/node_modules/dev/docs/tests/references/.worktrees，实际覆盖 9 包 src + scripts（非空跑） | **PASS** |
| 6 | 证据对账 | 与 `gate-*.log` 逐门比对 | 一致 | 见 §三 对账表 | **PASS** |
| 7 | smoke（非浏览器） | `S8_WT=<我的 worktree> S8_SHIM=<我的 worktree>/packages/client/composition-shim node s8-boot-r125.mjs boot`（前置：本会话 tsc + place-dist-glue + build-client-composition；3180/3493 预先确认空闲） | 全新世界 boot 至 S8-READY；stop 后端口释放 | 见 §二 smoke 记录：S8-READY 全 gate 通过（boot 行 / 401 / rows 3×true / serve 200 / catalog 200），stop 后 `3180:true 3493:true`，S8-STOPPED；boot 全程仅读 `references/deepseek-harness-test-use`（运行后 byte-clean，HEAD 76fda72979 未动） | **PASS** |
| 8 | composition byte-match（附） | `node scripts/place-dist-glue.mjs` + `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` → SHA-256 对照 R122 验证世界 | 4/4 byte-identical（2097CE5E/D385C065/B4509233/D50D3B3F） | 构建 exit 0（0.2s）；client-bundle.js=2097ce5e…（845581 B）MATCH；shim index.js=d385c065…（328 B）MATCH；shim package.json=b4509233…（497 B）MATCH；放置 glue=d50d3b3fbe37…（71965 B，= src 逐字节 = 证据声称值）MATCH | **PASS** |
| 9 | 模板 blueprintSource（附） | `node r125-template-audit.mjs <我的 worktree>`（parser = runtime dist 内编译的 domain parseBlueprint，即 host glue 行注册实际执行的管线） | 正例 PASS + 负例 MALFORMED_DTO/frontmatter-missing | 正例 PASS（blueprintId=my-team-bp-1 revision=1 leader.templateId=leader members=1 contentHash=sha256:a4374629…）；负例（剥离 `---` 定界符）PASS → `MALFORMED_DTO reason=frontmatter-missing`；exit 0。注：我 checkout 为 CRLF，抽取 759 字符（证据 LF 世界 725 字符），parseBlueprint 对 CRLF 容错接受——语义等价 | **PASS** |

## 二、smoke 非浏览器复跑记录（本人 worktree 树，3180）

- 前置产物（全部本会话生成）：runtime dist（tsc）+ glue 放置（place-dist-glue）+ composition-shim（build-client-composition，sha 2097ce5e…）。
- 全新 DSH_HOME：`references/.dsh-test-s8-2026-09-04T18-30-21`（gitignored 临时区，boot kit 设计行为，留作证据）；junction farm **禁用**（R125 fresh-machine 模式，依赖声明的 registry 运行时依赖，`0 created, 0 preexisting`）。
- 关键行（完整留痕见本目录 `reviewer-11/runs` 下 `gate7-boot-mine-lines.log` / `gate7-boot-console.log` / `gate7-stop-console.log`）：
  - `boot line: dsh web: http://127.0.0.1:3180/?token=5cM0Q9Bd2q…`（18:30:25.105Z）
  - `row ready — health={"ok":true,"boot":1,"ready":true,"rootSessionId":"s8v-root","liveSessions":["s8v-root"],"toolCount":10}`
  - `401 gate: unauthenticated catalog.list → HTTP 401`
  - `rows={"dsh-agent-team":true,"dsh-agent-team-client":true,"p6t6-team-tools":true}`
  - `serve check: status 200, 4627226 B, sha256=a1db11fea2…` —— 与证据 state.json 记录的 combo URL sha **逐字节一致**；`bundleBytesContained: true`
  - `catalog.list with cookie: HTTP 200`（blueprint s8v-bp-1 rev 1）
  - `S8-READY`（18:30:26.411Z）
  - stop：`stop: ports free — 3180:true 3493:true` → `S8-STOPPED`（18:31:04）
- 收尾核验：3180/3493 释放（独立 Test-NetConnection 复测 False/False）；稳定实例 :3080 仍在线未触碰；`references/deepseek-harness-test-use` `git status --porcelain` 空 + HEAD=76fda72979（0.1.2-rc.1 基线）byte-clean；boot 覆盖的 9 个证据文件（state.json、s8-boot.log 等）已恢复至 d23c606 提交基线，我的运行版本留痕于 `reviewer-11/boot-artifacts-mine/` 与 console 日志；worktree `git status` 仅剩 untracked `reviewer11-runs/`（本人临时产物，brief 允许留置于 worktree 内）。

## 三、与证据目录 gate-*.log 对账

| 门 | 证据（gate-*.log / state.json / s8-boot.log，P9-MC @ 071080d→ad0a869） | 本人实测（R4MC-2 @ d23c606） | 一致性定性 |
|---|---|---|---|
| install | gate-install.log：`Already up to date / Done in 154ms / EXIT=0`（**暖树 no-op 复核**，非全新安装）；全新安装证据在 fresh-clone-sim（ad0a869：463 包 54.8s exit 0） | 全新冷安装 463 包 221.3s exit 0，lockfile 未动 | **一致且更强**：本人补足了 d23c606 上的全新安装实证；注意 gate-install.log 本身是 no-op 复核，fresh-install 断言的独立支撑 = sim 日志 + 本人冷装（证据不对称已留痕） |
| build | gate-build.log：9/9 tsc EXIT=0 | 9/9 exit 0 | 一致 |
| test（根） | gate-test.log：219/2395 全绿 ROOT-EXIT=0 | run1 2394/2395（1 flake，已知套件）→ 隔离 2/2 绿 → run2 2395/2395 全绿 | 一致（唯一差异 = 已记录的 p6t1-parallel 负载 flake，处置协议与 R122 r122d 先例一致） |
| test（逐包） | gate-test-perpkg.log：client 33/480、legacy 7/98、合计 2630；根 2395，delta=client UI 235 | client 33/480、legacy 7/98、UI 16/235（均本人实测） | 逐项一致；恒等式 2395+235=2630 闭合 |
| lint | gate-lint.log：exit 0、空输出 | exit 0、0 字节 | 一致 |
| smoke | s8-boot.log + state.json（P9-MC 世界 17:16–17:19）：S8-READY、rows 3×true、serve sha a1db11fe…、stop 端口释放 | 本人世界 18:30–18:31：全 gate 同构，serve sha 逐字节同值，shim sha 2097ce5e…，stop 端口释放 | 一致（本人在 d23c606 树上独立复现了完整非浏览器 smoke 链） |

## 四、Findings（非阻塞）

1. **p6t1-parallel 负载 flake 在本会话复现（1 次）**：全量并行根配置 run 中 quota-race 断言受 reprobe 时序竞争影响（`ACTIVATION_COMPATIBILITY_BLOCKED_FATAL/reprobe-failed` 代替 quota code）。隔离 2/2 绿 + 二次全量 run 全绿，与证据记录的已知 flake 及处置先例完全吻合——非缺陷，但属于**并发关键区域的负载敏感测试**，后续 CI 全并行跑仍可能偶发单测红；建议后续开发保留隔离复跑协议并评估为该套件降载或加时序护栏（与冻结文档无冲突：不改产品行为、不改契约，纯测试基建加固）。
2. **client UI 套件（235 tests）测试基建依赖本机 test-use 树**：`packages/client/vitest.config.ts` 的 `buildSrcMap()` 扫描 `references/deepseek-harness-test-use/`、`uesWithSelector` alias 直指该树内文件 → 真正干净 clone（无 references/）上该 UI 套件无法按现配置运行；**根配置套件（2395，canonical test 闸）无此依赖**（根配置无 redirect，client 测试文件不 import references/ 路径，本人 grep 核验）。门禁判据 3 的安装链（install→build→build:composition→挂载→dsh web）不含 `pnpm test`，且 TEST_METHODS 本就规定 test-use 为**本机测试设施**，故不阻塞本闸；但后续开发若需在干净机器跑 client UI 套件，需先消除该依赖（风险可控、已知、与本闸已验收形态兼容）。另：该配置头部注释仍称 "link: devDependencies"，与 ad0a869 钉版后的 registry 依赖事实不符（陈旧注释，纯文档瑕疵）。
3. **gate-install.log 是暖树 no-op 复核**（154ms "Already up to date"），全新安装性断言实际依赖 fresh-clone-sim 日志 + 本人本次冷装（§三已留痕）。非不一致，但证据链上 install 门的"全新"语义由 sim + 独立复跑共同承载。
4. **环境异常留痕（非产品问题）**：(a) 本会话 pwsh 继承 :3080 稳定实例 `pnpm run` 泄漏的 `npm_lifecycle_*` 变量，Gate 1 采用剥离后环境（更接近真机）；(b) 本人首个 install 调用因脚本漏 `Set-Location` 实际跑在主仓根（no-op "Already up to date"，未产生任何变更，主仓 git status 无 lockfile/package.json 改动）——已在 §一#1 以正确 cwd 重跑；(c) 会话中途 harness spawn 瞬态 EPERM（含 trivial 命令，约 1 分钟后自恢复），与本树无关，期间未产生半截运行（唯一超时的 debug install 已清理进程并删除半成品 node_modules 后重跑）。

## 五、裁决理由

本人 facet 的全部必做独立复跑（install、逐包 tsc ×9、根配置 vitest、逐包 vitest + 计数恒等式、eslint）在**全新 worktree、最终树 d23c606** 上从零执行，全部绿；附加独立复现了 smoke 非浏览器全链（全新世界 S8-READY → stop → 端口释放）、composition 4/4 产物 byte-match（= R122 验证世界）、INSTALL.md 模板 blueprintSource 的正/负例 parseBlueprint 审计。与证据目录 gate-*.log 逐门对账一致，唯一测试差异恰为证据自身已记录并给出处置先例的已知负载 flake，且本人的隔离复跑 + 二次全量复跑证实了该先例的可复现性。五闸非浏览器门 + 非浏览器 smoke 在最终树上形成了**可从零复现、字节级锚定 R122 验证世界**的完整证据闭环，构成后续开发的可靠基础。上述 findings 均为已记录的既有约束或纯测试基建风险，不在本闸出口判据内、与冻结文档及已验收开发兼容。故裁决：**通过**。

## 六、本人实际执行的独立复跑清单（命令与退出码）

| 步骤 | 命令（worktree 根，缩写） | 结果 |
|---|---|---|
| G1-pre | `pnpm install --ignore-scripts`（首个 job，**误跑于主仓根**——no-op，exit 0，无变更；记录在案） | exit 0（no-op） |
| G1 | `pnpm install --ignore-scripts`（R4MC-2，剥离泄漏 env，CI=true，冷装） | **exit 0**，463 包，221.3s |
| G1-verify | `git status --porcelain`（lockfile 检查）+ node_modules 结构/二进制检查 + `packages/runtime/node_modules/@deepseek-ai` 列举 | 全部在位，lockfile 未动 |
| G2 | 逐包 `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json` ×9 | **9/9 exit 0** |
| G2b | `node scripts/place-dist-glue.mjs`；`node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | 均 **exit 0**（0.2s） |
| G2c | `Get-FileHash` 对照 4 件产物 vs R122 世界（references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/*）+ glue dist vs src | **4/4 MATCH**（含 glue 全哈希 d50d3b3fbe37…） |
| G2d | `node r125-template-audit.mjs <worktree>`（正例 + 负例） | **exit 0**（双 PASS） |
| G3 | `node node_modules/vitest/vitest.mjs run`（根配置，run1） | exit 1：2394/2395（1 flake，p6t1-parallel） |
| G3b | `node node_modules/vitest/vitest.mjs run packages/runtime/test/p6t1-parallel.test.ts` ×2（隔离） | **2/2 exit 0**（各 9/9） |
| G3c | `node node_modules/vitest/vitest.mjs run`（根配置，run2） | **exit 0：219/219 files，2395/2395 tests** |
| G4 | `cd packages/client; node ..\..\node_modules\vitest\vitest.mjs run`（本地配置） | **exit 0：33/480** |
| G4b | `node node_modules/vitest/vitest.mjs run packages/legacy`（根配置+过滤） | **exit 0：7/98** |
| G4c | `cd packages/client; node ..\..\node_modules\vitest\vitest.mjs run 'client.spec'`（UI 套件单独计数） | **exit 0：16 files / 235 tests** |
| G5 | `node node_modules/eslint/bin/eslint.js .` | **exit 0，0 字节输出** |
| G7-pre | 3180/3493 端口空闲核验（boot 前 + stop 后各一次） | 空闲/释放 |
| G7 | `S8_WT=<R4MC-2> S8_SHIM=<R4MC-2>/packages/client/composition-shim node s8-boot-r125.mjs boot`（后台）→ 轮询至 S8-READY → `node s8-boot-r125.mjs stop` | **S8-READY**（全 gate：boot 行/401/rows 3×true/serve 200 sha a1db11fe…/catalog 200）→ **stop exit 0，3180/3493 释放，S8-STOPPED** |
| G7-post | `git -C references/deepseek-harness-test-use status --porcelain` + `rev-parse HEAD`；:3080 存活核验；boot 覆盖的 9 个证据文件恢复至提交基线（`git checkout -- <paths>`，非 commit/push/branch/tag） | test-use byte-clean（HEAD 76fda72979）；:3080 在线；worktree 仅余 untracked reviewer11-runs/ |
| 附 | R122 参照世界 3 件产物独立哈希复核（读前） | 2097ce5e/d385c065/b4509233 与证据声称值一致 |
| 附 | `grep pnpm-lock.yaml 'link:\|file:'`（依赖来源核查） | 仅 workspace 内部 link（client→contracts/remote），@deepseek-ai/* 全 registry 钉版 |

## 七、红线自检（本人操作面）

- **无** git commit / push / branch / tag（仅 git status/log/rev-parse + 恢复被 boot 覆盖的 tracked 文件用 `git checkout -- <paths>`，非历史操作）。
- `references/`：仅只读哈希复核 + boot kit 按其设计新建 gitignored 临时 home `references/.dsh-test-s8-2026-09-04T18-30-21`（与 .fresh-clone-* 同类隔离区，留作本人运行证据）；**未修改** references/ 下任何既有内容。
- `references/deepseek-harness-test-use`（pristine upstream 角色）：boot 后 `git status --porcelain` 空，HEAD 76fda72979 未动 = byte-clean。
- **未触碰** `D:\deepseek-harness\` 与 :3080（结束前复测 :3080 仍在线）。
- 无长驻服务遗留：测试实例 boot 后已 stop，3180/3493 端口释放（双重确认：stop 内校验 + 独立 Test-NetConnection）。
- CORE PATCH BUDGET=0（本人操作面）：零 upstream 源码改动、零 patch 类改写；受审树产品面 diff = 0（本人构建产物均在 gitignored 路径）。
