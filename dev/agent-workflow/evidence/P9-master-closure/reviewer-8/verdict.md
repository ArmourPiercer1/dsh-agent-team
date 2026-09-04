# Gate 裁决 — P9 master product closure → master（int 39fe1df 拟 ff 进 master 2c1c200）

**reviewer-8（facet：构建与 gate 证据 — 独立全链复跑）**
日期：2026-09-05。所有命令在专属 worktree `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\R3MC-2` 内运行。

**路由核验（ROUTER_RULES §1）**：本会话模型路由为 qiyuan-self/qwen3.8-27b（继承自主会话）。

---

## 1. 裁决

## 投机通过

实际工作可以通过门禁：五闸全部非浏览器门 + smoke 非浏览器部分在我方 worktree（39fe1df）从零独立复跑全部成立，挂载产物与 R122 已验证世界逐字节一致，计数恒等式实测精确成立。但**不能充分排除**一项后续风险：已记录的 p6t1-parallel 并发负载 flake 在本机全套件并行负载下以 2/2 频率复现（与记录证据的单遍全绿不一致），即「根配置单次 run 全绿」对本机存在机器/负载敏感性。该风险有界、已被门禁协议（隔离复跑判据）覆盖、不触及产品语义，后续开发风险可控。

---

## 2. 范围

- 受审对象：39fe1df（detached @ 我的 worktree R3MC-2）。提交链实测：`39fe1df ← ad0a869 ← 2359d31 ← 071080d ← 8cf9fcb ← 232316d（merge，parents 2c1c200 + bd38827）← 2c1c200`（`git log --oneline -7`）。
- 我的 facet：install / typecheck+build（逐包 tsc）/ test（根配置 + 逐包 + 恒等式）/ lint 五闸中全部非浏览器门的独立复跑，smoke 非浏览器部分（全新世界 3180 boot，可选项，我选择复跑），gate-*.log 对账，byte-compare 独立复算。
- 不属于我 facet：谱系/产品面 diff 审查、fresh-clone 模拟、浏览器 vertical、冻结文档语义审查。
- 环境实测：Node v24.20.0（满足 engines）、pnpm 11.7.0、暖 store D:/.pnpm-store。复跑前我的 worktree **无 node_modules**（真·从零）。

## 3. 逐项检查表（命令 → 期望 → 实测 → 结论）

### 0. 受审树同一性

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 0a | `git rev-parse HEAD`；`git branch --show-current`；`git status --porcelain` | 39fe1df…，detached，clean | `39fe1df42f03aabec549d18bfd6527feb7f9f49d`，无分支，porcelain 空（复跑前） | PASS |
| 0b | `git log --oneline -7` | 声明的树构成 | 与声明完全一致（见 §2） | PASS |

### 1. install 闸

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 1 | `pnpm install --ignore-scripts`（全新：先无 node_modules） | EXIT 0，依赖全部解析 | **EXIT 0**；57.0s（pnpm 自报 56.5s）；`resolved 463, reused 463, downloaded 0`（全部暖 store）；10 workspace projects | PASS（log: `r8-logs/r8-install.log`） |

### 2. typecheck+build 闸（逐包 tsc）

命令（9 包各一次）：`node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json`，p ∈ contracts, domain, storage, runtime, tools, remote, client, **legacy**, testkit。

| # | 期望 | 实测 | 结论 |
|---|---|---|---|
| 2 | 9/9 EXIT 0（legacy 按 gate-build.log 记载做法：legacy 无 `tsconfig.json` 但有 `tsconfig.build.json`，对其跑 `tsc -p packages/legacy/tsconfig.build.json`） | **9/9 EXIT 0**，TSC-FAIL-COUNT=0（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit 各 EXIT=0） | PASS（logs: `r8-logs/r8-tsc-<p>.log`） |

### 3. test 闸 — 根配置单次 run

命令：`node node_modules/vitest/vitest.mjs run`（worktree 根）。

| # | 期望 | 实测 | 结论 |
|---|---|---|---|
| 3a | 记录声明：219 files / 2395 tests 全绿，EXIT 0 | run1：`Test Files 1 failed \| 218 passed (219)`，`Tests 1 failed \| 2394 passed (2395)`，EXIT 1。失败项 = `packages/runtime/test/p6t1-parallel.test.ts` > P3 quota race（期望 `ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES`，实得 `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL … reprobe-failed`）。run2（scratch 清理后全新）：同套件 P2（N=5 并行，errors.length=4≠0），同计数。**两次失败均在已记录已知负载 flake 套件 p6t1-parallel，且子测试不确定（两次不同）** | 见 3b 判定 |
| 3b | 按 facet 判据：若恰为该套件负载性失败 → 隔离复跑确认；隔离仍失败才构成缺陷 | 干净隔离复跑（先删 `packages/testkit/test/.tmp-fault`，单独跑 `vitest run packages/runtime/test/p6t1-parallel.test.ts`）：**3/3 × 9/9 全绿，EXIT 0**。注：紧随失败根 run 之后的第一次「隔离」跑（1 failed）与两次背靠背跑（ENOTEMPTY / `malformed-medium … schema_meta.json` 缺失）经排查为**固定 scratch basename 跨进程污染**（见 F2），非产品缺陷；scratch 清理后全绿 | **PASS（非缺陷）**，按记录 flake 处置；本机负载频率 2/2 记为 finding F1 |

### 4. test 闸 — 逐包 + 恒等式

| # | 命令 | 期望（记录声明） | 实测 | 结论 |
|---|---|---|---|---|
| 4a | client 本地配置：`Push-Location packages\client; node ..\..\node_modules\vitest\vitest.mjs run`（含 .client.spec UI 套件） | 33 files / 480 tests | **33 files / 480 tests，EXIT 0**（11.7s） | PASS |
| 4b | legacy 根配置+路径过滤：`node node_modules/vitest/vitest.mjs run packages/legacy`（root） | 7 files / 98 tests | **7 files / 98 tests，EXIT 0** | PASS |
| 4c | 我的补充测量：client 根配置+路径过滤 `vitest run packages/client`（root，测 client 在根 run 中的份额） | 245（声明值） | **17 files / 245 tests，EXIT 0** | PASS |
| 4d | 恒等式 1（逐包合计 vs 根单次 run，差异应恰为 client UI 套件数） | 2395 + 235 = 2630 | 实测：2395（根 run 总数）+ (480−245)=235（client UI 套件，仅本地配置 include）= **2630** = 声明逐包合计 | **PASS（恒等式 1 成立）** |
| 4e | 恒等式 2（client 本地 = 根份额 + UI 套件） | 480 = 245 + 235 | 实测：**480 = 245 + 235** 精确成立 | **PASS（恒等式 2 成立）** |
| 4f | 根 run 逐文件聚合（我自行解析 `r8-logs/r8-vitest-root2.log` 全部 per-file 行）vs 证据逐包声明计数 | 150/312/269/1070/35/92/480/124/98 | 我的聚合：contracts 13f/150、domain 17f/312、storage 21f/269、runtime 116f/1070、tools 4f/35、remote 9f/92、client 17f/245（根份额）、testkit 15f/124、legacy 7f/98；根合计 219f/2395 —— **与声明逐包计数全部一致** | PASS |

### 5. lint 闸

| # | 命令 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 5 | `node node_modules/eslint/bin/eslint.js .` | EXIT 0、无输出 | **EXIT 0，0 输出行**（5.8s） | PASS（log: `r8-logs/r8-eslint.log`） |

### 6. 与证据目录 gate-*.log 对账

| 门 | 证据声明 | 我的实测 | 一致性判定 |
|---|---|---|---|
| install | gate-install.log：EXIT 0（154ms「Already up to date」@071080d 重捕）；gate-summary：44.3s | 全新 install EXIT 0，57.0s | **一致（EXIT 0 成立）**。差异备注：归档 gate-install.log 是增量 no-op 重捕，与 gate-summary 的 44.3s 非同一次运行数字（F3，文档级，不影响裁决） |
| typecheck/build | gate-build.log：9/9 EXIT 0（legacy 经 tsconfig.build.json），BUILD-ALL-FAIL=0 | 9/9 EXIT 0 | **完全一致** |
| test（根） | gate-test.log：219 files / 2395 全绿，ROOT-EXIT=0 | 测试集合完全相同（219/2395；逐文件计数逐包一致）；本机全套件负载下 2/2 各 1 项 flake（p6t1-parallel，不同子测试），隔离 3/3 全绿 | **实质一致**；差异 = 已记录已知 flake 的机器/负载频率差异（F1）。按门禁协议判据不构成缺陷 |
| test（逐包） | gate-test-perpkg.log：合计 2630；9 包计数 | 4a/4b/4c + 4f 全部复现 | **完全一致** |
| lint | gate-lint.log：EXIT 0，0 error 0 warning | EXIT 0，无输出 | **完全一致** |
| smoke | gate-summary：本轮不重复执行，以 byte-identical + R122 已验证世界承接 | 我独立复跑了非浏览器 boot（§7），并独立复算 byte-compare | **证据链成立且被我的独立复跑强化**（见 §7） |

### 7. smoke 非浏览器部分（可选项 — 我选择复跑；3180 复跑前空闲）

前置（全部我的 worktree 内新构建）：
- `node scripts/place-dist-glue.mjs` → EXIT 0；`node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` → EXIT 0（85 modules，11 css；client-bundle.js 845581 B）。

| # | 检查 | 期望 | 实测 | 结论 |
|---|---|---|---|---|
| 7a | **byte-compare 独立复算**（`Get-FileHash SHA256`）：我的 39fe1df 新构建 vs R122 已验证世界 `references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/` | 4 个记录哈希 2097CE5E/D385C065/B4509233/D50D3B3F；3 shim 件与 R122 world 逐字节一致 | client-bundle.js=`2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997`（=R122，match=True）；index.js=`D385C065BBFAA8A2ABE3A98FE67FBC763A959A1FFB5DB05E9E177337CE3D2273`（match=True）；package.json=`B4509233321F8D293BE0A1C6679F3AA3400B7C94B3425D13A6E2CB71846FFA6A`（match=True）；dist glue `agent-bindings.mjs`=`D50D3B3F…`（=源文件=记录值） | **PASS：4/4 记录哈希复现，安装面与 R122 live 验证面逐字节一致** |
| 7b | 全新世界 boot（probe 副本 `r8-logs/s8/s8-boot-r8.mjs` = s8-boot-r125.mjs 原文件（SHA256 `B5583D03…`）的 3 处外科式改动：EV 输出目录重定向到 `r8-logs/s8/out`（不写受审证据目录）、2 个 `.worktrees/RC1` 库 import 改为 `file:///` 绝对路径；其余逐字未动。`S8_WT`=我的 worktree，`S8_SHIM`=我的 composition-shim，S8_FARM 默认禁用=declared-deps fresh-machine 模式） | S8-READY，然后 stop 并确认 3180/3493 释放 | **S8-READY**（18:05:20→18:05:25）：fresh home `references/.dsh-test-s8-2026-09-04T18-05-20`；worktree link reconciliation **0 specifiers / 0 created**（declared-deps 模式成立，无需 junction farm）；shim 放置 sha256=2097ce5e…；throwaway boot 建 profile；cordis.patch.yml 写入；mock 3493 in-process；**boot line** `dsh web: http://127.0.0.1:3180/?token=u7gaGIk8…`；**401 闸**（unauthenticated catalog.list → 401）；**health** `{"ok":true,"boot":1,"ready":true,"rootSessionId":"s8v-root","liveSessions":["s8v-root"],"toolCount":10}`；dump rows dsh-agent-team / dsh-agent-team-client / p6t6-team-tools 全在；combo bundle serve 200 且 `bundleBytesContained=true`；catalog.list（cookie）200 含 `s8v-bp-1` | **PASS** |
| 7c | stop + 端口释放 + 测试树 byte-clean | S8-STOPPED；3180/3493 无监听；test-use porcelain 空 | `stop`：instance pid 78504 signaled → `ports free — 3180:true 3493:true` → **S8-STOPPED**；独立复核 `Get-NetTCPConnection`：**3180/3493 均 0 listeners**；`git -C references/deepseek-harness-test-use status --porcelain` 为空；boot job exit 0 | **PASS** |

## 4. Findings

- **F1（flake 频率，本机可复现；记录 flake 类，非产品缺陷）**：p6t1-parallel 在本机全套件并行负载下 2/2 根 run 各失败 1 项（run1：P3 quota race，期望 `ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES` 实得 `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL/reprobe-failed`；run2：P2 N=5 并行 errors.length=4），子测试不确定。记录证据（gate-test.log / gate-test-perpkg.log @071080d「single pass, no flake」）为其运行当次的真实结果，但本机未能复现单遍全绿。干净隔离复跑 3/3 × 9/9 全绿 → 按 facet 判据不构成缺陷；**残留风险：后续任何本机/类似负载的全套件 run 可能再见 1 项 flake，门禁复跑需沿用隔离复跑协议（R122 先例）**。此为本裁决「投机通过」的主要风险项。
- **F2（测试卫生，既存特性，非受审区间引入）**：testkit `scratchDir` 固定 basename（`packages/testkit/test/.tmp-fault/<name>`）跨**进程**运行不清理（文档明示由测试 finally 的 destroyDir 负责）；一次失败运行会把世界弄脏，后续同 basename 运行开脏世界（我实测到 `ENOTEMPTY` destroyDir 与 `malformed-medium … missing table file 'schema_meta.json'` 两类连带失败，均在我背靠背探测后出现，清理 scratch 后消失）。属测试基础设施卫生项，建议后续（非本门禁）为 flake 排查路径加 scratch 预清理或唯一化 basename；与冻结文档及已验收开发兼容（纯测试侧，不动产品代码与冻结语义）。
- **F3（证据溯源，文档级，不影响裁决）**：归档 `gate-install.log` 为 154ms 增量 no-op 重捕（「Already up to date」），而 `gate-summary.md` 载 44.3s，两者非同一次运行；summary 的复跑史已说明日志为 @071080d 重捕，但未说明 44.3s 来源。我的全新 install（57.0s，EXIT 0）独立成立 install 闸，量级一致。

## 5. 裁决理由

1. **五闸非浏览器门在 39fe1df 独立复跑全部成立**：从零 install（EXIT 0，暖 store 全解析）、逐包 tsc 9/9、根配置 vitest 测试集合 219/2395 与记录完全一致（唯一失败为已记录负载 flake，隔离 3/3 全绿）、逐包恒等式 1（2395+235=2630）与恒等式 2（480=245+235）实测精确成立、eslint 零输出。
2. **安装面与 R122 live 验证面逐字节同一**：我的 39fe1df 全新构建（tsc + place-dist-glue + build-client-composition）4/4 记录哈希复现，3 shim 件与 R122 world byte-identical。
3. **fresh-machine 语义在 boot 中独立验证**：declared-deps 模式（S8_FARM 禁用）下 0 junction 创建、全新世界 S8-READY 全门绿（boot line/401/health/dump/serve/catalog）、干净 stop、端口释放、test-use byte-clean。
4. **不足以给「通过」的唯一原因**：我的独立复跑可复现地观察到（2/2）记录证据的单遍全绿在本机不成立——「根配置单次 run 全绿」存在机器/负载敏感性。我**不能充分排除**后续开发在全负载 run 中再现 1 项 flake 的风险；但该风险有界（单一套件、已记录类、既有隔离协议、不触及产品语义——2394 项其余测试与完整 boot/health/catalog vertical 全绿证明产品侧无碍），风险可控 → **投机通过**。主 Agent 应按 ROUTER_RULES §6 将 F1（及 F2 卫生项）记入风险台账。

## 6. 我实际执行的独立复跑清单

| 序 | 命令（worktree R3MC-2） | 退出码 | 日志（我的 worktree `r8-logs/`） |
|---|---|---|---|
| 1 | `git rev-parse HEAD` / `git status --porcelain` / `git log --oneline -7` | 0 | （stdout 记录于本文件 §2/§3.0） |
| 2 | `pnpm install --ignore-scripts`（全新） | 0 | r8-install.log |
| 3 | `node node_modules/typescript/bin/tsc -p packages/<p>/tsconfig.build.json` × 9 | 各 0 | r8-tsc-<p>.log × 9 |
| 4 | `node node_modules/vitest/vitest.mjs run`（根，run1） | 1（1 flake，p6t1-parallel P3） | r8-vitest-root.log |
| 5 | `node node_modules/vitest/vitest.mjs run packages/runtime/test/p6t1-parallel.test.ts`（根配置，紧随 run1，scratch 被 run1 弄脏） | 1（1 failed，P2） | r8-vitest-p6t1-iso.log |
| 6 | 同命令 ×3 背靠背（run2–4，scratch 跨进程竞争） | 1/1/1（P1 断言 / ENOTEMPTY / malformed-medium） | r8-vitest-p6t1-iso-{2,3,4}.log |
| 7 | 删 `packages/testkit/test/.tmp-fault` 后 `vitest run packages/runtime/test/p6t1-parallel.test.ts`（clean iso ×3：含 run 前的 rm+sleep） | 0 / 0 / 0（各 9/9） | r8-vitest-p6t1-clean{,-5,-6}.log |
| 8 | `node node_modules/vitest/vitest.mjs run`（根，run2，scratch 全新） | 1（1 flake，p6t1-parallel P2） | r8-vitest-root2.log |
| 9 | `Push-Location packages\client; node ..\..\node_modules\vitest\vitest.mjs run` | 0（33f/480t） | r8-vitest-client-local.log |
| 10 | `node node_modules/vitest/vitest.mjs run packages/legacy`（根） | 0（7f/98t） | r8-vitest-legacy-root.log |
| 11 | `node node_modules/vitest/vitest.mjs run packages/client`（根） | 0（17f/245t） | r8-vitest-client-root.log |
| 12 | `node node_modules/eslint/bin/eslint.js .` | 0（无输出） | r8-eslint.log |
| 13 | `node scripts/place-dist-glue.mjs`；`node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | 0 / 0 | r8-place-glue.log、r8-build-composition.log |
| 14 | SHA256 对比：我的 shim×3 vs R122 world s8-client-row×3；dist glue vs 源 vs 记录值 | — | （记录于 §3.7a） |
| 15 | `node r8-logs/s8/s8-boot-r8.mjs boot`（S8_WT=我的 worktree，S8_SHIM=我的 shim；background job pwsh-30）→ **S8-READY** → `node r8-logs/s8/s8-boot-r8.mjs stop` → **S8-STOPPED**，3180/3493 独立复核 0 listeners，test-use porcelain 空 | boot job exit 0 | r8-logs/s8/out/s8-boot.log、state.json、dump-config-s8.txt、serve-check.json、catalog-list-s8.json、instances/ |

方法论差异 vs 证据目录 `gate-perpkg.ps1`：(a) 脚本硬编码 `.worktrees/P9-MC` 与 worktree 根日志落盘；我等同命令在 R3MC-2 运行、日志入 `r8-logs/`（不写受审文件）；(b) 其 legacy 过滤与客户本地配置跑法与我 4a/4b 相同；(c) 其 flake 分支只处理逐包 runtime 失败（per-package cwd 隔离）；我的触发是根配置 run 失败，隔离用根配置+路径过滤，判据相同；(d) 我额外跑了 client 根配置+过滤（4c）以独立测出 245。

## 7. 红线自检（我的会话足迹）

- **git 写操作**：无 commit / push / branch / tag（仅只读 git 查询）。worktree reflog 仅既有 checkout 条目；tracked 树零改动（porcelain 仅我的 untracked `r8-logs/` + gitignored 构建产物 node_modules/dist/composition-shim）。
- **references/**：仅写入新建 `references/.dsh-test-s8-2026-09-04T18-05-20/`（gitignored 隔离区，任务书明令允许）；`deepseek-harness-test-use` 运行后 `git status --porcelain` 为空（byte-clean）；冻结 fork `references/deepseek-harness`：分支 `feat/team-vnext-integration-20260829` = `a3ab31992762…`、tag `legacy-agent-team-pre-vnext`（annotated，object `276b3f8b…` → commit `a3ab31992762…`）均未动、工作树 clean。
- **:3080 与 `D:\deepseek-harness\`**：全程未触碰；我的实例仅 3180/3493。
- **长驻服务**：boot 实例已 stop，3180/3493 独立复核 0 listeners；无遗留进程。
