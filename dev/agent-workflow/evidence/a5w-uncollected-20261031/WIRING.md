# a5w-uncollected — 挂腿 + 防复发门实施（workflow C 实施席，dated 2026-10-31）

**席位**：工程基线实施席（workflow C）。零 boot、零端口 3180+ 监听、零产品码；改动面 = 2 个 CI 配置件 + 1 个新门脚本 + 本 evidence 目录。
**时间**：真实 UTC 2026-10-31（本文写作时刻 `date -u` = 2026-10-31T14:25Z；R-CLOCK-1：所有日期取书写时刻）。
**基线**：worktree `.worktrees/a5w-collect`，分支 `task/a5w-uncollected-wire-20261031` = `origin/master @ 8067f631f` + merge `task/a5w-uncollected-audit-20261031 @ 8982d026f`（审计在前=merge commit 承载，实施在后=单 commit；单 PR 承载审计+实施）。
**正本依据**：本目录 `AUDIT.md`（32 未收集 = SAFE 20 / BOOT-KIT 10 / ENV-DEP 2 / RED 0）。

## 0. 结果速览

- 挂腿 19 文件进 ci-integration（3 新步 + 3 新腿），每步本地亲跑全绿后写入：41/41、7/7、84/84。
- 新门 `scripts/eb3-node-test-collection.mjs`（注册 = manifest 腿 + workflow 步，置于 eb3-ci-required 步之后）：`EB3-NODE-TEST-COLLECTION pass files=38 exempt=13 findings=0 warnings=0`。
- 四门全绿（§3）；负控双向自证红/警路径（§4）；fetch-depth 实况 = 已是 0，无需改动（§2）。
- 38 = 已收集 25（原有 6 + 本 PR 19）+ 豁免 13（§5），集合账目闭合。
- **poc-native-present 不挂**（§1 末行披露），入豁免表。

## 1. 挂腿清单（A：3 新步 × ci-integration，照 tests/checks 先例=步骤注释+单行 `node --test`；manifest ci-integration 层各加同名 required-token 腿，check=全部文件路径）

| 新步（workflow 步名） | 文件 | 本地亲跑 | runlog |
| --- | --- | --- | --- |
| root-binding + scripts + evidence-store regressions (node:test, host-free) | `packages/runtime/root-binding/harness/bounded-run.regression.test.mjs`、`scripts/sanitize-evidence.regression.test.mjs`、`tests/evidence-store/evidence-store.test.mjs` | 41/41 绿（1.8s） | `runlogs/wire-group1-rootbinding-scripts-evidencestore.log` |
| tests/s2-authority suites (node:test; needs the fetch-depth: 0 checkout above) | `tests/s2-authority/` 全 7 件（authority-dual-read / authority-snapshot-isolated / ci-snapshot-reader / consumer-candidate / current-authority-pointer / probe-candidate / sync-candidate-resolver） | 7/7 绿（1.3s） | `runlogs/wire-group2-s2-authority.log` |
| tests/world-factory offline suites (host-free) (arm-verdict, binding-digests, port-probe, registries, u6-arc-d, u7-tbash trio, u7-uileg0) | `tests/world-factory/` 9 件（arm-verdict / binding-digests / port-probe / registries / u6-arc-d / u7-tbash / u7-tbash-offline-drive / u7-tbash-seam / u7-uileg0-answer-drive） | 84/84 绿（6.1s） | `runlogs/wire-group3-world-factory-offline.log` |

步注披露（写入 workflow 步骤注释与腿 `why`）：

- **port-probe = 带内自清理绑口**：在 tests/paths.mjs 核准测试带内刻意 bind-探测并即时 close（"bind-no-leak" 断言），跑中/跑后 `ss -ltn` 过滤 3180+ 恒 0（本席复测同）。作业步骤串行于隔离 runner，无带内争用；boot 套件永不加入该步。
- **s2 历史依赖（注①修正）**：AUDIT 注①把 5 件列为 git show 钉死祖先 SHA；本席逐文件亲查=**运行时 git show 的是 4 件**（3d6f6aad ci-snapshot-reader / 5f0d0e58 consumer-candidate / 09fd3946 probe-candidate / 61df0b42 sync-candidate-resolver），authority-snapshot-isolated 仅在注释中引用 291165d7（负控基线说明），不读 git 历史。fetch-depth:0 要求仍按最严（4 件）成立，步注钉死四个 SHA 防止日后浅化。
- **tmp 副作用**：ci-snapshot-reader 写 `scripts/.tmp-gate-baseline-*`、consumer-candidate 写 `scripts/.tmp-gcs-baseline-*`，均测内即删；本席跑后 `git status scripts/` 零残留已核。
- **poc-native-present.test.mjs 不挂**：PoC 证据件 + 需 runner provision `tests/deepseek-harness-test-use` 运行时（GitHub-hosted runner 无该运行时，AUDIT §2 runtime 依赖披露）。豁免入 B 表（POC 类）；**复评触发**=若转常设合同件且 runner 供给成立，重测后挂腿。

## 2. fetch-depth 实况（s2 五件历史依赖的前提核查）

- `ci-integration.yml` 作业 Checkout（`actions/checkout@v4`）**已是 `fetch-depth: 0`**（原文件 L66-68，devex E4/E5/D11 早先需 origin/master 全历史）→ **无需改动**；已在 s2 步注写明「此作业 checkout 必须保持 fetch-depth: 0」及原因，防日后"优化"浅化。
- 本地验证：`git fetch --unshallow` 在本仓不适用——`fatal: --unshallow on a complete repository does not make sense`（本仓非浅仓）。**如实回报替代验证**：`git rev-parse --is-shallow-repository` = false；钉死件直跑 `git show <pin>:file` 全过（3d6f6aad→scripts/ci-pr-gate.mjs ok、5f0d0e58→scripts/gen-current-state.mjs ok、61df0b42→scripts/ci-pr-gate.mjs ok、09fd3946→scripts/docs-probe.mjs ok、291165d79a/bab57048 cat-file 可达）；且 s2 组整体 7/7 绿（其运行时 git show 即最硬证明）。**CI 面依赖 = fetch-depth: 0 已在位**，此为本席可见性的全部披露。

## 3. 防复发门 B（`scripts/eb3-node-test-collection.mjs`）与四门输出

门逻辑：`git ls-files '*.test.mjs'` 全量 → 收集集 =（manifest 全部层全部腿的 cmd/check 中 `*.test.mjs` 令牌）∪（**已解析** yml 的 pr-gate.yml + ci-*.yml 中显式 `run:` 行里 `node --test` 行的文件令牌；YAML 解析天然排除注释=correct-by-construction，census-runtime 的注释提及不被计入）→ 差集对照脚本内 EXEMPT 表（13 条，每条=路径|类别|理由|复评触发）。未收集未豁免 → 红 `CI_NODE_TEST_UNCOLLECTED <path>`（exit 1）；豁免件已被收集 → `WARNING CI_NODE_TEST_EXEMPT_NOW_COLLECTED <path>` 不红（提示删豁免）；豁免件已不在 tracked → `WARNING CI_NODE_TEST_EXEMPT_STALE`；无法判级（非仓/manifest 缺失/收集源为空）→ exit 2 拒判，绝不静默绿。输出样式仿 eb3-ci-required：`EB3-NODE-TEST-COLLECTION pass|fail files=N exempt=N findings=N warnings=N`。

注册：manifest ci-integration 层新腿 `eb3-node-test-collection` + workflow 新步「EB3-NODE-TEST-COLLECTION: …」**置于 eb3-ci-required 步之后**。⚠️ **形状偏离披露**：brief 要求「cmd 完整命令，check 含脚本自身路径」——该形状被 eb3-ci-required 实测判红（gradeLeg 的 check 对照发生在 cmd 前缀之后的 argv，脚本腿 rest 恒空），逐字红输出与根因判读见 `runlogs/wire-gate-negative-control-demos.log` §3；处置=按仓内治理脚本先例（eb3-ci-required 等同款）cmd 钉全命令、无 check，脚本路径仍为腿的钉死令牌（删步/改名 = CI_LAYER_LEG_MISSING）。收集强度不变，仅报的 finding code 不同。

**四门输出行（终态文件上亲跑，日志随本目录）**：

```
EB3-CI-REQUIRED pass workflows=9 findings=0                     # runlogs/wire-gate-ci-required.log
24/24 control(s) behaved as required                            # runlogs/wire-gate-negative-controls.log (exit 0)
EB3-TOOL-ACCEPTANCE pass tools=31 L4-proven=19 L4-disclosed=11 L4-unverified=1   # runlogs/wire-tool-acceptance.log (exit 0)
EB3-NODE-TEST-COLLECTION pass files=38 exempt=13 findings=0 warnings=0           # runlogs/wire-gate-node-test-collection.log (exit 0)
```

## 4. 负控自证（不改真实脚本；复制件演示，逐字输出在 `runlogs/wire-gate-negative-control-demos.log`）

1. **去豁免必红**：临时复制件删掉 `tests/world-factory/world-factory.test.mjs` 豁免条目 →
   `CI_NODE_TEST_UNCOLLECTED tests/world-factory/world-factory.test.mjs …` +
   `EB3-NODE-TEST-COLLECTION fail files=38 exempt=12 findings=1 warnings=0`，exit=1。✅
2. **豁免已收集件=警告不红**：复制件加一条指向已收集 `scripts/sanitize-evidence.regression.test.mjs` 的豁免 →
   `WARNING CI_NODE_TEST_EXEMPT_NOW_COLLECTED …` + `… pass … warnings=1`，exit=0。✅
   两复制件（`scripts/.tmp-ntc-negctl.mjs` / `scripts/.tmp-ntc-warndemo.mjs`）演示后即删，`git status` 干净；真实脚本全程未改。

## 5. 豁免表原文（EXEMPT，13 条；正本 = `scripts/eb3-node-test-collection.mjs`，此处逐字段照录）

| 路径 | 类别 | 理由 | 复评触发 |
| --- | --- | --- | --- |
| tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs | BOOT-KIT | observes real launch records (launchUrl/token record face); kit semantics target booted worlds (AUDIT row 23) | a CI job that boots a world exists (boot lane) — re-run inside it, else keep exempt |
| tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs | BOOT-KIT | kit-directory adjudication over the --ui-observe world record face (AUDIT row 24) | a CI job that boots a world exists (boot lane) |
| tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs | BOOT-KIT | watchdog regression of the rc2 REAL-HOST smoke suite (spawn+ipc host lifecycle) (AUDIT row 25) | a CI job that boots a world exists (boot lane) |
| tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs | BOOT-KIT | imports spawnHost from ./rc2-real-host-smoke.mjs and tests production spawn owning its child before any boot await (AUDIT row 26) | a CI job that boots a world exists (boot lane) |
| tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs | BOOT-KIT | kit-directory adjudication over the boot preflight script (spawnSync) (AUDIT row 27) | a CI job that boots a world exists (boot lane) |
| tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs | BOOT-KIT | e2e kit: TEST_USE runtime jsdom + browser-launch semantics ("fatal before any browser launch" verdict face) (AUDIT row 28) | a CI job that boots a world exists (boot lane) |
| tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs | BOOT-KIT | e2e kit: makeWorld/bootTeamRequests/launchUrl orchestration face (AUDIT row 29) | a CI job that boots a world exists (boot lane) |
| tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs | BOOT-KIT | e2e kit: chromium.launchServer(...).process() process-ownership face + spawn (AUDIT row 30) | a CI job that boots a world exists (boot lane) |
| tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs | BOOT-KIT | kit-directory adjudication: rail DOM on TEST_USE jsdom, kit semantics = boot-evidence driven (AUDIT row 31) | a CI job that boots a world exists (boot lane) |
| tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-identity.test.mjs | BOOT-KIT | kit-directory adjudication: member identity → pre-browser-launch verdict face (AUDIT row 32) | a CI job that boots a world exists (boot lane) |
| tests/world-factory/world-factory.test.mjs | ENV-DEP | 44/44 completed cases green; the one unfinished saturation case (host leasing → 13000 band) is RCA-1 black-hole-box timeout arithmetic (portInUse eats 1500ms per probed port across 19+50 leases > 60s), an environment property, not a product red (AUDIT row 21, runlogs/wf-tail.log) | re-run once on a normal-RST box (regular Linux/GH runner) OR with a leg timeout >= 180s; green => SAFE, wire it into a step+leg and delete this entry |
| tests/world-factory/host-sandbox-assets.test.mjs | ENV-DEP | 17/28 red on this box, fail-closed BY DESIGN against unprovisioned native assets (SOURCE/DESTINATION_DIGEST_MISMATCH on bin/glibc/system.node; T19 ENOENT /srv/workspace — this box has no shared baseline). Registered, NOT fixed; TEST_METHODS §9 supply command owns the precondition (AUDIT row 22, §4) | after the reference machine is provisioned per TEST_METHODS §9, re-run; still red after a CORRECT provisioning => escalate to RUN-RED and fix (product/manifest pin defect) |
| tests/world-factory/poc/poc-native-present.test.mjs | POC | 38/38 green in 0.43s but it is a PoC evidence artifact importing the built lib of a PROVISIONED tests/deepseek-harness-test-use checkout — GitHub-hosted runners do not provision that runtime (AUDIT row 20, runtime-dependency disclosure §2) | if it graduates from PoC evidence to a standing contract file AND runner provisioning of the test-use runtime exists, re-measure and wire it; until then keep exempt |

## 6. 端口与环境旁证

- `ss -ltn` 过滤 `:(31[89][0-9])$`：组跑前后与 registries 双证后全部 = 0；`:3080`/`~/.dsh` 零触碰；`tests/homes/` 零新世界。
- 副作用仅 gitignored `.artifacts/tmp/a5w-collect-logs/`（本目录日志的母本）+ 本 evidence 目录（tracked）。

## 7. 复现命令

```bash
# 三个挂腿步（逐字 = workflow 步骤 run 行）
node --test packages/runtime/root-binding/harness/bounded-run.regression.test.mjs scripts/sanitize-evidence.regression.test.mjs tests/evidence-store/evidence-store.test.mjs
node --test tests/s2-authority/authority-dual-read.test.mjs tests/s2-authority/authority-snapshot-isolated.test.mjs tests/s2-authority/ci-snapshot-reader.test.mjs tests/s2-authority/consumer-candidate.test.mjs tests/s2-authority/current-authority-pointer.test.mjs tests/s2-authority/probe-candidate.test.mjs tests/s2-authority/sync-candidate-resolver.test.mjs
node --test tests/world-factory/arm-verdict.test.mjs tests/world-factory/binding-digests.test.mjs tests/world-factory/port-probe.test.mjs tests/world-factory/registries.test.mjs tests/world-factory/u6-arc-d.test.mjs tests/world-factory/u7-tbash.test.mjs tests/world-factory/u7-tbash-offline-drive.test.mjs tests/world-factory/u7-tbash-seam.test.mjs tests/world-factory/u7-uileg0-answer-drive.test.mjs
# 四门
node scripts/eb3-ci-required.mjs && node scripts/eb3-node-test-collection.mjs \
  && node scripts/eb3-ci-negative-controls.mjs && node scripts/eb3-tool-acceptance.mjs
# registries 双证（组跑 84/84 之外的独走）
node --test tests/world-factory/registries.test.mjs   # 12/12 绿 (222ms)
```

## 5. CI-reality correction (dated 2026-10-31T14:56Z, real UTC at push) — first real CI run went red; this section is the correction record

- **What CI measured**: ci-integration failed exactly one step — tests/s2-authority, one case:
  `FAIL C10 structure_same=false bytes_same=true` … the C10 block at
  consumer-candidate.test.mjs:160-185: `git show 5f0d0e58e…:scripts/gen-current-state.mjs`
  threw (object absent on the runner). Sibling stderr in the same run confirms the machine state:
  `fatal: Not a valid commit name 9b2ee57bc…`, `fatal: Not a valid object name origin/master`.
  The other six s2 files passed; no other step failed.
- **Root cause (measured, not theorized)**: for pull_request, actions/checkout lands on the merge
  ref and — despite `fetch-depth: 0` in the workflow — the runner repo is effectively shallow at
  the merge point (reachable ancestor commits return `could not get object info`) AND no
  `refs/remotes/origin/master` is created. The pre-correction step annotation asserted the
  opposite ("the job already checked out full history … devex needs origin/master the same
  way"); devex passes anyway because it tolerates the absence. The lane seat and the review seat
  both verified that annotation against LOCAL worktrees — locally the repo is complete, so the
  claim was unfalsifiable there. This is exactly the collected-but-unexercised failure mode this
  whole PR is about, in the meta direction: even the fix's own CI assumptions were only proven
  where they had always run.
- **Reproduction (throwaway clone, single bash call, /tmp disposable)**: `git fetch --depth 1
  origin refs/pull/530/merge` + checkout ⇒ `FAIL C10: Command failed: git show 5f0d0e58…`
  (identical to CI). Then `git fetch --no-tags --unshallow origin master:refs/remotes/origin/master`
  ⇒ `5f0d0e58 = commit`, `origin/master = 8067f631f3`, consumer-candidate PASS, and the FULL
  seven-file s2 command run after the fetch: **tests 7 / pass 7 / fail 0**.
- **Fix in-workflow**: new step immediately before the s2 step — single simple command
  `git fetch --no-tags --unshallow origin master:refs/remotes/origin/master` (eb3-ci-required
  rejects ||-grouped legs: CI_LAYER_LEG_UNPROVEN was observed verbatim for the || form and the
  command was rewritten; a complete-checkout future would make the step fail LOUD, not grade
  wrong), declared as manifest leg `Fetch master as refs/remotes/origin/master` (drop ⇒
  CI_LAYER_LEG_MISSING). The s2 step's own annotation now records the correction.
- **Gates at the correction head**: eb3-ci-required pass workflows=9 findings=0;
  eb3-node-test-collection pass files=38 exempt=13 findings=0 warnings=0; negative controls
  24/24; consumer-candidate 1/1 in the lane worktree; faithful-CI seven-file suite 7/7 (above).
- **Disclosure**: this correction commit is authored by the coordinator directly (integrator
  fix to the PR's own CI files after CI-measured failure), reviewable as the third commit.

## 6. correction² (dated 2026-10-31T15:19Z): section 5's shallow diagnosis was itself wrong — the real fact is SHAPE DRIFT between CI runs

- **Run 2 measured the opposite shape**: the same fetch-depth: 0 job, head e03dc212b, died in the
  §5 fetch step with `fatal: --unshallow on a complete repository does not make sense`
  (raw log job of run 41212415646, line ~1174) — that day GitHub shipped a COMPLETE merge-ref
  checkout. Same workflow, two runs, two shapes. §5's sentence "the PR-merge checkout IS shallow"
  is falsified by run 2 and stands corrected here; original text kept (append-only).
- **Why run 1 reds the way it does (corrected mechanism)**: run 1's C10 failure string was
  `structure_same=false bytes_same=true` — NOT `Command failed` (that string only exists in my
  §5 depth-1 repro, a DIFFERENT failure mode I wrongly accepted as identical because the case
  name matched). On a history-missing checkout the NEW gen-current-state's cited-paths /
  merged-claim legs see cat-file/merge-base failures (the run-1 fatals on 9b2ee57/5f0d0e58/
  origin/master were those probes) and emit findings the 5f0d0e58 baseline cannot (those legs
  postdate it) → structure diverges exactly there; rendered view bytes stay equal. Local proof
  the fatals are missing-history symptoms, not noise: probe-candidate on a COMPLETE repo prints
  ZERO 9b2ee57 fatals. Race theory considered and rejected: 5× full-file parallel runs, zero
  flips — scheduling untouched (no --test-concurrency added; no assertions touched).
- **Lesson booked**: matching a failure by CASE NAME + locally constructing a repro that shares
  the symptom label but not the failure STRING let a misdiagnosis through one review seat (the
  seat reviewed the fix against the §5 story, not against run 2 — run 2 did not exist yet).
  Correction commits must quote failure STRINGS verbatim side by side, and "reproduced exactly"
  requires the same string, not the same test id.
- **Fix (2nd)**: fetch step rewritten shape-agnostic, guard form, UNDECLARED (||/&& cannot be
  graded; the s2 step itself goes LOUD-red if the helper is dropped on a history-missing day —
  measured as run 1): shallow ⇒ --unshallow fetch (creates the ref too); complete ⇒ plain fetch
  creates refs/remotes/origin/master; §5's declared manifest leg withdrawn (17 legs again).
- **Both shapes verified locally, single bash call each, clones deleted**: shallow(depth-1 of
  the real merge ref refs/pull/530/merge) + guard + full seven-file s2 command = tests 7 / pass 7
  / fail 0; complete(file:// full fetch) + guard = ok, origin/master resolves to the real tip.
- Gates at this head: eb3-ci-required pass workflows=9 findings=0 · collection pass 38/13/0 ·
  negative controls 24/24 · YAML parses (block scalar; a bare run starting with [ was parsed as
  a flow sequence — caught locally by the same yaml gate family before push).
