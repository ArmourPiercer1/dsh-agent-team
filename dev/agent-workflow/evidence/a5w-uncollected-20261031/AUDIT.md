# a5w-uncollected — tracked `*.test.mjs` 未收集集健康审计（workflow C，dated 2026-10-31）

**席位**：工程基线审计席（workflow C）。**纯审计零改动**：本分支只新增本 evidence 目录，未触碰任何测试/产品/CI 文件。
**时间**：真实 UTC 2026-10-31（`date -u` = 2026-10-31T14:07Z 开工，14:2xZ 完成；R-CLOCK-1：本文所有日期 = 书写时刻 `date -u`）。
**基线**：`origin/master @ 8067f631f`（worktree `.worktrees/a5w-uncollected`，分支 `task/a5w-uncollected-audit-20261031`）。
**红线遵守**：零 boot、零端口 3180+ 监听（跑前/跑中/跑后 `ss -ltn` 过滤 `31[89][0-9]` 全部 = 0，见 runlogs 旁注与本文 §5）、`:3080` 与 `~/.dsh` 零触碰、`tests/kits/**` 一律不跑、疑似 boot 立即按纪律 kill（实测无一例需要人为 kill——`timeout 60` 唯一触发者见 world-factory.test.mjs 行）。

---

## 1. 方法（亲做集合差，勿信转述）

1. **全量**：worktree 内 `git ls-files '*.test.mjs'` = **38** 个 tracked 文件 → `tracked-tests.txt`。
2. **显式收集集**（逐源亲核，非仅 grep 文件名）：
   - `dev/ci/eb3-ci-manifest.json`：layer[1] 的三条 node:test 腿（id=`devex+diag node:test suites` / `tests/checks node:test suites` / `scripts node:test suite (eb3-tool-acceptance law fixtures — host-free)`），cmd 均为 `["node","--test"]`，文件在 `check` 数组逐文件列举（devex+diag 2 个、tests/checks 2 个、scripts 1 个）；
   - `.github/workflows/ci-integration.yml` L171/L178/L187：与 manifest 三条腿一一对应的 5 个显式文件；
   - `.github/workflows/pr-gate.yml` L321：`node --test scripts/pr-settlement-gate.test.mjs`（fetch-depth 0 作业；L303 的 fetch-depth:1 作业与此腿无关）；
   - **非收集源（确认不收集 `.test.mjs`）**：`vitest.config.ts` include 仅 `**/*.test.ts` 三组；`scripts/run-tests.mjs`（`test:node`）只枚举 `packages/*/test/*.test.ts`；census（`ci-pr-gate.mjs`）跑 vitest 语料；其余 workflow（candidate-protection / census-runtime / characterization / ci-fast / ci-full / ci-required / ci-security）对 `.test.mjs` 零提及（census-runtime.yml 仅注释提及）。
   - 并集 = **6** 个显式收集文件 → `collected-tests.txt`。
3. **集合差**：`comm -23` 全量(38) − 收集(6) = **未收集 32** → `uncollected-tests.txt`。（背景口径"30+"亲数结果 = **32**。）

## 2. 亲跑纪律

一次一文件、`timeout 60 node --test <file>`、日志逐份存 `runlogs/`；`tests/kits/**` 依席位纪律**绝对不跑**（静态归类）；每批跑前后 `ss -ltn` 抽查 3180–3199。本机 = WSL 镜像网络盒（RCA-1 黑盒环境：对关闭端口的 SYN 黑洞不回 RST，`tests/characterization/lib/util.mjs portInUse` 每次探测吃满 1500ms 超时——该环境特性只影响一条腿的耗时，见下表）。

**runtime 依赖披露**：worktree 内无 gitignored 的 `tests/deepseek-harness-test-use/`；`tests/paths.mjs findTestRepoRoot` 向上解析命中**主 checkout** 的已构建 runtime（只读引用）。凡标"runtime 依赖"的行，挂腿 runner 必须先按 TEST_METHODS §2/§9 provision 该 checkout，否则不可外推本机绿。

## 3. 每文件分类表（32 行；证据 = 亲跑结果 + 代码判读）

分类：**SAFE** = RUN-CI-SAFE ｜ **RED** = RUN-RED ｜ **KIT** = BOOT-KIT ｜ **ENV** = ENV-DEP

| # | 路径 | 分类 | 证据（亲跑｜代码判读） | 建议处置 |
|---|------|------|------------------------|----------|
| 1 | packages/runtime/root-binding/harness/bounded-run.regression.test.mjs | SAFE | 6/6 绿（60s 内）｜ 只 spawn 本机 node stub 子进程组与 `bounded-run.mjs` 包装器，端口断言仅拒绝带外端口（9999），零 host、零 bind、零 DSH_HOME | 挂腿 |
| 2 | scripts/sanitize-evidence.regression.test.mjs | SAFE | 25/25 绿 ｜ spawnSync 仅限 sanitize 工具副本于 scratch，无网络无端口 | 挂腿 |
| 3 | tests/evidence-store/evidence-store.test.mjs | SAFE | 10/10 绿 ｜ spawnSync 仅 git + evidence-store 工具于临时 git 仓，无网络无端口 | 挂腿 |
| 4 | tests/s2-authority/authority-dual-read.test.mjs | SAFE | 1/1 绿 ｜ 纯 fs/JSON 读权威指针与快照 | 挂腿 |
| 5 | tests/s2-authority/authority-snapshot-isolated.test.mjs | SAFE | 1/1 绿 ｜ execFileSync 仅跑 `switch-authority.mjs check` 于临时文件 | 挂腿（历史依赖见注①） |
| 6 | tests/s2-authority/ci-snapshot-reader.test.mjs | SAFE | 1/1 绿 ｜ `git show <钉死SHA 3d6f6aad…>` + 跑 ci-pr-gate 只读腿；临时文件写 `scripts/.tmp-gate-baseline-*` 后即删 | 挂腿（注①） |
| 7 | tests/s2-authority/consumer-candidate.test.mjs | SAFE | 1/1 绿 ｜ `git show 钉死SHA 5f0d0e58…:scripts/gen-current-state.mjs` 纯读 | 挂腿（注①） |
| 8 | tests/s2-authority/current-authority-pointer.test.mjs | SAFE | 1/1 绿 ｜ 纯 fs 指针读写临时副本 | 挂腿 |
| 9 | tests/s2-authority/probe-candidate.test.mjs | SAFE | 1/1 绿 ｜ `git show <钉死SHA 09fd3946…>` + 跑 probe 脚本于临时 git 仓 | 挂腿（注①） |
| 10 | tests/s2-authority/sync-candidate-resolver.test.mjs | SAFE | 1/1 绿 ｜ `git show <钉死SHA 61df0b42…>` + 闭包脚本重放于临时目录 | 挂腿（注①） |
| 11 | tests/world-factory/arm-verdict.test.mjs | SAFE | 17/17 绿 ｜ 纯判决函数 fixture；3199 等端口号只出现在字符串 fixture，零 socket | 挂腿 |
| 12 | tests/world-factory/binding-digests.test.mjs | SAFE | 14/14 绿 ｜ execFileSync 仅 git/digest 于临时目录，启动文件钉为 fixture，零 spawn host | 挂腿 |
| 13 | tests/world-factory/port-probe.test.mjs | SAFE* | 5/5 绿 ｜ 显式自我披露"绑零泄漏（非绑零）"：只在 tests/paths.mjs 核准测试带内刻意 bind-探测并即时 close，断言 3080/3180 缺席；跑中 `ss` 3180+ 恒 0 | 挂腿（独腿或与 boot 腿串行，共享 runner 并行时有核准带内 bind 争用→flaky 风险，隔离 runner 无虞） |
| 14 | tests/world-factory/registries.test.mjs | SAFE | 12/12 绿 ｜ 头注+代码 = 零 boot 零 bind：模块装载、临时目录、createWorld 只造不 boot | 挂腿 |
| 15 | tests/world-factory/u6-arc-d.test.mjs | SAFE | 8/8 绿 ｜ 离线 C1：SUITE_CASES/parseArgs/装配接线，无 spawn | 挂腿 |
| 16 | tests/world-factory/u7-tbash.test.mjs | SAFE | 8/8 绿 ｜ 纯提取/判决函数，fixture 字符串 | 挂腿 |
| 17 | tests/world-factory/u7-tbash-offline-drive.test.mjs | SAFE | 1/1 绿 ｜ 纯判决 fixture | 挂腿 |
| 18 | tests/world-factory/u7-tbash-seam.test.mjs | SAFE | 9/9 绿 ｜ 零 fs 零 boot（导出函数 + spawnSync 仅本地 node 语法检查类） | 挂腿 |
| 19 | tests/world-factory/u7-uileg0-answer-drive.test.mjs | SAFE | 10/10 绿 ｜ fixture RESPONDER 重放录制应答，3183 等只存在于字符串见证，零 socket 零 boot | 挂腿 |
| 20 | tests/world-factory/poc/poc-native-present.test.mjs | SAFE† | 38/38 绿（0.43s）｜ 进程内 import 钉死 runtime 的已构建 lib 构造真 cordis Context，头注+代码 = 零 boot 零端口，scratch 落 `.artifacts/tmp`（非 DSH_HOME 世界）；†依赖已 provision 的 test-use checkout（本机经 findTestRepoRoot 命中主 checkout） | 挂腿（runner 先 provision runtime） |
| 21 | tests/world-factory/world-factory.test.mjs | **ENV** | 亲跑：45 案总数；**44/44 完成案全绿、零 fail**；唯一未竟案 = L263「host leasing falls through to the 13000 band…(simulated, zero binds)」在本机 >60s（单独亲跑亦 60s 未竟）：saturate 对 19+50 个带内端口逐一 acquirePortLease，黑盒盒每端口 portInUse 吃满 1500ms ≈ 100s+，属 RCA-1 环境特性非产品红；其余 44 案分三批亲跑全绿（8+3+33，日志 wf-tail.log 33/33） | 修后挂腿前先重测：RST 正常盒（常规 Linux/GH runner）或 leg timeout≥180s 重测一次再定 SAFE；本机不背书全文件 60s 内绿 |
| 22 | tests/world-factory/host-sandbox-assets.test.mjs | **ENV**（本机见红，见 §4 登记） | 亲跑 28 案 = 11 过 / **17 红**（1.5s 内即红，非挂起）：全部红项 = 钉死 manifest 摘要 vs 本机 runtime 原生资产不符（SOURCE/DESTINATION_DIGEST_MISMATCH on `bin/glibc/system.node`：本机 `75450f92…` ≠ pin `54a9c25c…`）+ T19 ENOENT `/srv/workspace`（本机无共享 baseline）；代码判读 = 套件本身即 TEST_METHODS §9「环境态记 ENV_BLOCK 不记 FAIL」执法的 fixture，本机资产非供给链产物（本机 `/srv/workspace/dsh-stable-3-0.2.0-rc.2` 不存在） | ENV 豁免（按 §9 供给后在参考机重测；若正确供给后仍红 → 升级 RUN-RED 修） |
| 23 | tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs | KIT | 不跑（kits 纪律）；observes 真启动记录（launchUrl/token 记录面），kit 语义面向真 boot 世界 | boot 专属豁免 |
| 24 | tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs | KIT | 不跑；kit 目录裁决（--ui-observe 世界记录面） | boot 专属豁免 |
| 25 | tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs | KIT | 不跑；rc2 **real host** smoke 套件的看门狗回归（spawn+ipc 宿主生命周期） | boot 专属豁免 |
| 26 | tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs | KIT | 不跑；代码明证：`import { spawnHost } from './rc2-real-host-smoke.mjs'` 且测「production spawn owns its child before any boot await」 | boot 专属豁免 |
| 27 | tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs | KIT | 不跑；kit 目录裁决（boot 预飞行脚本 spawnSync） | boot 专属豁免 |
| 28 | tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs | KIT | 不跑；e2e kit：TEST_USE 运行时 jsdom + 浏览器启动语义（"fatal before any browser launch" 判决面） | boot 专属豁免 |
| 29 | tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs | KIT | 不跑；e2e kit：makeWorld/bootTeamRequests/launchUrl 编排面 | boot 专属豁免 |
| 30 | tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs | KIT | 不跑；e2e kit：`chromium.launchServer(...).process()` 进程所有权面 + spawn | boot 专属豁免 |
| 31 | tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs | KIT | 不跑；kit 目录裁决（rail DOM 于 TEST_USE jsdom，kit 语义=boot 证据驱动） | boot 专属豁免 |
| 32 | tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-identity.test.mjs | KIT | 不跑；kit 目录裁决（成员身份 → browser launch 前置判决面） | boot 专属豁免 |

**注①（s2-authority 历史依赖）**：第 5/6/7/9/10 行经 `git show <钉死祖先 SHA>:…` 读历史版本，挂腿必须挂在全历史 checkout 作业（先例：ci-integration.yml L68 `fetch-depth: 0`；pr-gate 的 fetch-depth:1 作业不可放）。第 6 行还会在 `scripts/` 下写后即删 `.tmp-gate-baseline-*` 临时文件（本机跑后零残留已核）。

## 4. RUN-RED 登记（只登记，不修）

本机亲跑出现断言红的文件**只有一个**，且根因判读为环境供给（已列 ENV 类）：

- `tests/world-factory/host-sandbox-assets.test.mjs` — **17/28 fail**。首条（T2）：
  `Error [HostSandboxAssetError]: host-sandbox-assets: DESTINATION_DIGEST_MISMATCH: bin/glibc/system.node in .artifacts/tmp/host-sbx-assets/present-* hashes 75450f9225f5…，the pinned manifest says 54a9c25c0518…`；
  其余 16 红同根（SOURCE_DIGEST_MISMATCH ×13、T19 `ENOENT /srv/workspace`、T23 型期望被摘要先拒错位），全量日志 `runlogs/tests_world-factory_host-sandbox-assets.test.mjs.log`。
  定性 = 本机原生资产不在供给链（本机无 `/srv/workspace` 共享 baseline，见 AGENTS.md 2026-10-03 复核条），套件按设计 fail-closed；**非产品红**，但若参考机正确供给后仍红即产品/manifest 钉死红，须修。
- 除此之外：**RUN-RED 纯类 = 0**（20 个 SAFE 全绿于 60s 内；world-factory.test.mjs 完成的 44 案零 fail）。

## 5. 端口与环境旁证

- `ss -ltn` 过滤 `:(31[89][0-9])$`：跑前基线 0；每批跑后抽查恒 0；全审计结束复测 0。
- 主 checkout `tests/homes/` 无新世界、无 mtime 触碰；`:3080`/`~/.dsh` 零访问。
- 副作用仅两处 gitignored 临时区（TEST_METHODS §8 合规）：worktree 与主 checkout 的 `.artifacts/tmp/`（poc scratch `dsh-pvpoc-*` 目录若干，未删，留供复查）；worktree `git status` 除本 evidence 目录外干净。

## 6. 汇总计数

| 分类 | 数 | 说明 |
|------|----|------|
| RUN-CI-SAFE | **20** | 全部亲跑 60s 内全绿、零 skip；行 13 port-probe 带 SAFE* 披露（核准带内刻意 bind 自清理），行 20 poc 带 runtime-provision 前提 |
| RUN-RED | **0** | 无「代码判读+亲跑」双证的产品红；§4 登记唯一本机见红文件归 ENV |
| BOOT-KIT | **10** | tests/kits/** 全量，零运行 |
| ENV-DEP | **2** | world-factory.test.mjs（RCA-1 黑盒 60s 超时特性，44/44 完成案绿）；host-sandbox-assets.test.mjs（供给链/参考机前提，17/28 红已登记） |
| **未收集合计** | **32** | tracked 38 − 显式收集 6 |

**给挂腿+建门轮的三条要点**：① 20 个 SAFE 可直接入 eb3 layer[1] node:test 腿（沿用"逐文件显式列举 + 加套件必须加腿"惯例，先例 leg[11] why 注）；s2-authority 五文件要求作业 checkout `fetch-depth: 0`。② 两条 ENV 腿在参考盒重测前不入门；world-factory.test.mjs 重测通过即 SAFE。③ 10 个 KIT 建议登记为显式 boot 专属豁免清单（防"未收集=遗漏"复发），豁免清单本身可入建门文件的白名单段。

**复现命令**：`git ls-files '*.test.mjs' | sort`（=tracked-tests.txt）；集合差三件（tracked/collected/uncollected-*.txt 随本目录）；逐文件日志 = `runlogs/*.log`（23 份：32 文件中 22 份单文件 + s2 glob 批 + 4 份分批 world-factory 切片 wf-tail.log 等）。
