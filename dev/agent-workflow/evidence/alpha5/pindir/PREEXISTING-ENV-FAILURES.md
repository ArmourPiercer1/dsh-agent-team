# PREEXISTING-ENV-FAILURES — 满跑既有失败全集（CI 判读基线；协调者请求，非根令）

样本 = 本分支满跑两套件：runtime `4674 passed / 10 failed + 1 collect-fail (4 files)`
（`runtime-full-suite-final.log`）、testkit `358 passed / 20 failed (4 files)`
（`testkit-full-suite-full.log`）。

**判定法（全件统一，非按名字猜）**：`git stash push -- <本单全部改动> → 同树复跑对应文件 →
git stash apply`（显式 ref；对照日志 `control-4files-pristine-master.log`、
`control-testkit-*-pristine.log`）——**失败集与修复前完全同集**（testkit 满跑有 ±1 flake，见 S13）
⇒ 全集判 = 既有基线红（本单无关）。分类列进一步按现场根因线索分 `环境型`（本 worktree 语境特有，
主检出/CI 语境可不同）与 `基线红`（与语境无关的既有红）；判定法=对照同集 + 首行根因行读码。

主检出污染注记（本宿主环境事实，影响多腿）：**主检出 `/srv/workspace/dsh-plugins/dsh-agent-team`
HEAD 陈旧于 `6259cf4b`（宿主升级代前）**，且本 worktree 缺自己的 `tests/deepseek-harness-test-use`
→ `findTestRepoRoot` 上溯落到主检出；多条 ENOENT/路径断言直指主检出路径，即此因。

## runtime（4 文件；10 test-fail + 1 collect-fail；对照：control-4files-pristine-master.log 同集同数）

| # | 测试腿（文件 > describe > 名） | 失败原文首行 | 分类 | 判定法/根因注记 |
|---|--------------------------------|--------------|------|------------------|
| R1 | a4pr0a-fact-type-closed-set.test.ts（**collect**，整件不加载） | `Error: FACT_TYPE_CATEGORY block not found — the guard has no subject` | 环境型 | 对照同集；被解析源面按陈旧主检出（6259cf4b 代）取，该代源无此块 |
| R2 | p6t3-mediation > 1. no grant → MEDIATED via the leader | `AssertionError: expected 'session-root-p6t1' to be 'session-child-p6t3-leader'` | 环境型（疑） | 对照同集；根因未深挖（非本单责任），证据行 |
| R3 | p6t3-mediation > 3. grants are PER-SENDER | `TypeError: Cannot read properties of undefined (reading 'sessionId')` | 环境型（疑） | 同上 |
| R4 | p6t3-mediation > 4. newer overlay generation revokes | `TypeError: Cannot read properties of undefined (reading 'sessionId')` | 环境型（疑） | 同上 |
| R5 | p6t3-mediation > 5. authority beats mediation | `AssertionError: expected 4 to be 1` | 环境型（疑） | 同上 |
| R6 | p6t3-mediation > 7. relay text + attribution | `TypeError: Cannot read properties of undefined (reading 'attribution')` | 环境型（疑） | 同上 |
| R7 | p6t3-restart > 2. pending MEDIATED recovered | `TypeError: Cannot read properties of undefined (reading 'sessionId')` | 环境型（疑） | 同上 |
| R8 | p6t3-restart > 5. recovery aborts on first hard failure | `Error: assertMessagingCode: expected MessagingError 'MESSAGING_DELIVERY_FAILED', got undefined` | 环境型（疑） | 同上 |
| R9 | rc2-persona-probe > PP1 the probe names the slots by host constants | `Error: ENOENT ... open '/srv/workspace/dsh-plugins/dsh-agent-team/packages/runtime/root-binding/harness/persona-probe.mjs'` | 环境型 | 对照同集；ENOENT 路径**直指主检出**（陈旧 HEAD 无该文件）——路径解析落主检出实锤 |
| R10 | rc2-persona-probe > PP3 no plugin source imports PERSONA_SECTION | `AssertionError: expected [ …(4) ] to deeply equal []` | 环境型 | 同 R9 族（残留守卫扫到陈旧主检出面） |
| R11 | rc2-persona-probe > PP3 no harness re-inlines persona lookup | `AssertionError: expected [ { …(2) }, … ] to deeply equal []` | 环境型 | 同 R9 族 |

## testkit（4 文件；20 test-fail；对照：control-testkit-4files-pristine.log 19f 同集，S13 为 ±1 flake）

| # | 测试腿 | 失败原文首行 | 分类 | 判定法/根因注记 |
|---|--------|--------------|------|------------------|
| T1 | a4p7-blueprint-version-clean > the scan ran | `AssertionError: scan did not run: cwd /srv/.../. worktrees/a5-pindir/packages/testkit is not the repository [root]` | 环境型 | 对照同集；首行即根因——fence 要求 repo-root cwd，worktree cwd 判失败，整件 12 腿连锁红（T1-T12 同因） |
| T2-T12 | a4p7-blueprint-version-clean 其余 11 腿（invoking the script by name / every ADVISORY line / the fence reports sites / YAML-string factory file / [] v [101] / serialization REFUSED / policy-state multi-team :101 advisory / stale ledger row / adjudication-ledger 打印 / f22 REFUSED / real in-scope file） | 各自首行见 `per-leg-firstlines.txt`（`expected 1 to be +0`、`expected [ …(6) ] to deeply equal []`、`expected 'scan: ...' to contain 'OFFENDING ...'` 等） | 环境型 | 同 T1 因（scan-not-run 连锁）；终态复跑仍 12f（`仍在`） |
| T13 | a4p7-merge-gate > composition smoke leg | `AssertionError: the composition arms have to RUN ... It read "ref..."` | 环境型 | 对照同集；composition 构建产物/臂未在本 worktree 语境就位 |
| T14 | a4p7-merge-gate > static legs > committed install surface is fresh | `AssertionError: check:artifacts did not pass. why: verdict=stale drift=1 ...` | **本轮已修的既有红** | 满跑/对照时 drift=1=本单 dist 镜像**当时未提交**；镜像入 commit 后终态单腿复跑 **1 passed**（`-t "install surface is fresh"`）——判读基线：此腿在主检出/CI 须绿 |
| T15 | plugin-dsh-compat > the root manifest declares the exact-RC DSH peer | `AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]` | 环境型 | 对照同集；读到的 root manifest peer=**0.1.7-rc.1**（陈旧主检出 package.json），非本树 0.2.0-rc.2 |
| T16 | plugin-dsh-compat > positive: runtime 0.2.0-rc.2 compatible | `AssertionError: expected { name: 'dsh-agent-team', …(4) } to be undefined` | 环境型 | 同 T15 族 |
| T17 | plugin-dsh-compat > negative: runtime 0.1.7-rc.1 unmet | `AssertionError: expected undefined to be defined` | 环境型 | 同 T15 族 |
| T18 | plugin-dsh-compat > negative: 0.2.0-rc.3/0.2.0 also unmet | `AssertionError: expected { '@deepseek-ai/dsh': '0.1.7-rc.1' } to deeply equal { ... '0.2.0-rc.2' }` | 环境型 | 首行自证（读到陈旧主检出 manifest） |
| T19 | plugin-dsh-compat > mechanics: exact-version exemption | `AssertionError: expected undefined to deeply equal { '@deepseek-ai/dsh': '0.2.0-rc.2' }` | 环境型 | 同 T15 族 |
| T20 | rc2-sanitize-evidence > S13 file aliases, quoted values... | `Error: Test timed out in 5000ms.` | 环境型（flaky） | 满跑 1f；单飞/终态两次复跑均过——负载超时，判 flaky ±1（testkit 满跑 19↔20 之差即此腿） |

## 汇总（判读基线口径）

- **本轮已修**：T14（dist 镜像入 commit，终态单腿绿）。C-16 修复本身的负控族（13 名矩阵/两装配注入/
  forward 漂移）是**新增腿的先红**，不属于既有红。
- **仍在（本 worktree 语境）**：R1-R11（11 条，其中 R2-R8 根因未深挖仅判"对照同集"）、
  T1-T13、T15-T19（既有红/环境型），T20 flaky。
- 换到主检出（HEAD 对齐后）或 CI 语境复跑时，R9-R11/T15-T19/T1 族（路径/cwd 根因实锤类）**预期转绿**；
  若仍红则升为真基线红需另案。R2-R8（p6t3 messaging 族）在两种语境下的表现差是本清单留给 CI 判读的
  观察点。
- 本清单的"红/绿"仅陈述**本分支基线时点**的本宿主事实；任何后续轮引用时须以同法（stash 同树对照
  或同集比对）重新锚定，禁止按名字背书。

## 增补观察（21:15Z 补钉轮复跑，同法登记）

- **runtime r2 满跑出现第 5 个红件 `a5lsp2-streaming.test.ts`（2 腿）**：
  `expected 27104 to be less than 5000`（握手超时上界腿）与 `Test timed out in 5000ms.`
  （SIGTERM→SIGKILL 升级腿）——两条都是计时敏感腿；**单飞复跑 15/15 全绿**
  （补钉轮定向套件 48/48 亦含它全绿）。判 = 环境型（负载 flake，S13 同族）；
  基线 r1/对照 r1 均未现，登记为**观察项**：若后续满跑再现则并入 flaky 族，若在
  静默环境稳定复现则升真基线红另案。r3 复跑（runtime-full-suite-r3.log）为该判的
  可复现性测量：**r3 结果=满跑回到 4 failed 文件/10 failed 测试，与基线集逐文件一致（r3 中 a5lsp2 全绿）——判 flake 成立（负载族），维持登记不升案**。
