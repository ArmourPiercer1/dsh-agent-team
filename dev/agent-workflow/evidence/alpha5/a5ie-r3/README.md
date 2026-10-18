# a5ie-r3 — 触发令轮：#333 合并后，五条 glob 控制在真机安装面上逐条跑通

> 本轮命题（触发令原文口径）：#333 已合并 → 在 `.worktrees/a5ie-r2b` 里 `git merge` 新 master → 重装四世界做字节同一复验 → 跑 **GLOB-POS / GLOB-BOUND / GLOB-WALKER-ERROR / GLOB-SYMLINK / GLOB-OUTSIDE-ANCHOR** 五控（真宿主 Team 入口，形制照 a5ie-r2b 的 A 腿，mock 只在 LLM 位）+ A8 更新为翻转后现形（旧逐字保留为历史）+ A3/A10 归因腿按实测复核 + B2 仍 booked 不声称。
>
> 结论：**GREEN 50/50 + 4 条如实入账，`KIT_EXIT=0`。** 安装三零实测 **missing=0 / extra=0 / sha-mismatch=0**（1772/1772，face rootSha `9936ffad182550412a9af481f410ed3d4adb704677b01109a26d2f96b73c0db0`）。五控**全部 RUN、全部 PASS**，逐字现形见 §3。B2（出口码保真）**仍 booked，不声称**。

## 0. 基线（自证，不引用他人结论）

| 项 | 实测值 |
| --- | --- |
| `git ls-remote origin refs/heads/master`（kit 内部现场执行，非引用） | `104b499173687daa0f5c537bc37ae7600089576c` = `feat(runtime): mount flip - search confined, glob live-anchored, shell native pair (int-r3; CANDIDATE-A disclosed; integration legs) (#333)` |
| 本轮 merge 结果 | 分支 `a5ie-r2b`，`git merge 104b4991…` → `git rev-parse HEAD` = **`baa697f047143ce21ccbd12b5ea73bb7f9f80f7b`**，porcelain 0，`git merge-base --is-ancestor 104b4991 HEAD` = true（`H1b` 腿就是断言这三件事） |
| 安装 spec | `github:ArmourPiercer1/dsh-agent-team#104b4991…`（真网络安装，非 `file:` 局部路径；本轮从未触发"装不上就停"的条款） |
| 测试宿主 | `tests/deepseek-harness-test-use`（pristine，detached @ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2），运行前后 porcelain 均 0（`H1`/`H3`） |
| 端口 | 3183 / 3184（318x 族）+ mock 3491；运行前自证空闲、运行后自证释放（`H2`/`C3`）；本轮实测 349x 会被同机其它进程抢占，故 kit 改为**绑定时再证一次并顺延**（见 §8） |
| 稳定实例 :3080 | 只读探针，前后同一状态（`H0`：401 → 401），全程未被触碰 |
| DSH_HOME | 全部在 `tests/homes/a5ie-r3-*` 内（工作区内），运行后 `homes=[]`（`C1`） |
| **flip 的部署前提（新测）** | glob/search 行要 spawn 打包 ripgrep。实测宿主模块图可解析：`@vscode/ripgrep@1.18.0` → `…/tests/deepseek-harness-test-use/node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/…/bin/rg`，`rg --version` = **`ripgrep 15.0.0 (rev 3a612f88b8)`**，与 #333 自测所用同版本同行。解析失败时行会落 `rg-unavailable`（`a5glb-refused/walker-setup`）；本轮**未出现**，五控全部真走 walker |

## 1. merge + 四世界重装：字节同一复验仍在同一轮里做完

安装命令逐字（钉死宿主自己的公开包面）：

```
DSH_HOME=<worktree>/tests/homes/a5ie-r3-install-<stamp> \
  node tests/deepseek-harness-test-use/apps/cli/lib/bin.js \
  plugin --profile web add 'github:ArmourPiercer1/dsh-agent-team#104b499173687daa0f5c537bc37ae7600089576c'
```

| 复验项 | 实测 |
| --- | --- |
| 新安装目录 + 严格 manifest 面（`dependencies` 只有本仓一个插件、`node_modules` 顶层无杂物、reconciler 追加本仓 bundle row） | `I2` PASS：`deps=["dsh-agent-team"] nm=["dsh-agent-team"] bundles=[base, web-app, dsh-agent-team]` |
| 三零（`I3a`–`I3d`） | `1772/1772`（`files:` 1770 条 + pack 恒含 `README.md`/`package.json` 两条，`I3e` 单独披露）、`missing=0`、`extra=0`、`sha-mismatch=0`，rootSha `9936ffad1825…` |
| 四世界字节同一（安装探针 + installed + preassembly + baseline 各自重装） | 四次全部 `1772/1772 miss=0 extra=0 sha≠=0 rootSha=9936ffad1825 == probe`（`W.*.install`/`W1`） |
| 漂移门（装进去的字节 == 提交里的字节，不在安装期构建） | `I6` PASS：`[check-artifacts-committed] OK: 1747 files` |
| 公开配置面合流（`--dump-config` 经 profile seam 组出 `dsh-agent-team/host` + 本轮 teamToolPlane） | `I5` PASS |
| **披露的发布面缺口（不绕过）** | `I8`：Landlock pre-launcher 是 `.py`，tsc 永不产出 → 不在已装面；安装方必须作为部署输入提供。`I9`：本轮物化的部署输入字节 = `sha256:0049965daacae5bd…`（与提交字节逐字同，直接 `--abi-probe` 答得出现实 **ABI v4**） |
| **flip 是否在已装面上（不是只在 git 里）** | `G6` PASS：`packages/runtime/dist/.../live/glob-backend.mjs` 与 `.../search-backend.mjs` **都出现在已装 manifest** 里 |

## 2. A3/A10 归因复核：现在 mount 到底传没传 confined handle（实测答题者）

触发令点名要实测的问题。答案：**传了，答题的是 confined rg 行，不是 grep(1) 端口**。三条独立证据都在同一次运行里：

1. **源（已装 commit 的 blob）**：`104b4991:packages/runtime/src/plugin/live/team-tool-plane.mjs` 的 mount 现在两处都带 `confined: confinedCfg`（`createAnchoredSearchBackend` 与 `createAnchoredGlobBackend`）——`A10` 断言里 `mountSearchConfined=true mountGlobConfined=true`。
2. **宿主日志里行自己的 per-call 见证**：`anchored-search OK realm=… records=… total=…` 出现 **3 次**（三条 grep 腿各一次；grep(1) 端口从不发这行，a5ie-r2b 那次日志里就是 0 次）；`anchored-glob ran` 出现 **4 次**（4 条给出答案的 glob 腿）。`A9`/`A10` 就断言这些行的存在与条数。
3. **答案落在受治渲染面上**：`a5p5-meta {"kind":"search","outputMode":"content",…}` 同帧到达。

**A3c（测量入账，不判绿）**——翻转带来的真实差异不在"谁来答题"，也在"两行怎么报路径"：

- search 行 hit：`/…/tests/homes/a5ie-r3-installed-…/workspace/governed/notes.txt:4: A5IE-R3-GREP-TOK lives here` → **锚定绝对路径**，与 a5ie-r2b 的 grep(1) 端口同类（所以"绝对锚定"不是两行的差异点，别拿它当翻转证据）；
- glob 行条目：`gpos/beta.txt` → **根相对**。

## 3. 五控逐腿（口径取自 a5ie-r2b 的 `pending-333.json` 原文，不重写为更软的说法）

每条控制各占自己的子树；三个"对 walk 有毒"的夹具（越界 symlink、symlink 目录、内核拒绝的子树）**只在自己那条腿的窗口内存在**（发那条调用时建、发下一条时拆）——原因见 §8：a5ie-r2b 形制的 grep 腿搜的是 `.`，任何全根 walk 都会被这些夹具决定答案。

| 控制 | 夹具 | 现形（逐字） | 判定 |
| --- | --- | --- | --- |
| **GLOB-POS**（`G1`） | `gpos/{alpha.txt,beta.txt,gamma.md}` | `search · files_with_matches · 2 matches` + `> gpos/beta.txt`、`> gpos/alpha.txt`，`gamma.md` 正确缺席，全腿无 refusal | PASS |
| **GLOB-BOUND**（`G2`） | `gbound/` 140 个 `.txt`（> `GLOB_MAX_RESULTS=100`） | 头部真总数 `140 matches`，内联页**正好 100 条** + 诚实标记行 `> … truncated …`，meta `"totalMatches":140,"truncated":true` | PASS |
| **GLOB-SYMLINK**（`G3`） | `gsym/real.txt` + `gsym/link.txt -> ../../outside/secret.txt` | 只列出 `> gsym/real.txt`；越界别名**不作为受治对象出现**（`linkSurfaced=false`），秘密字节 0（腿内 0、全 wire `markerOnWire=0`） | PASS |
| **GLOB-OUTSIDE-ANCHOR**（`G4` + 追加 `G3b`） | `goutside/inside.txt` + `goutside/ext -> ../../outside`（外面另有 `outside-only-name-A5IE-R3-NOPE-7788.txt`） | `G4`：只列出 `> goutside/inside.txt`，外面文件名与其字节**无处出现**；`G3b`（把越界 symlink 直接当 walk 目标）：`a5p5-refused kind=backend-failed code=symlink-alias detail=a path component of the target is an alias`——锚由 handle 打开，不是可换路径串 | PASS |
| **GLOB-WALKER-ERROR**（`G5`） | `gwalk/readable.txt` + `gwalk/denied/`（mode 000，仅本腿存在） | `a5p5-refused kind=backend-failed code=walker-error detail=the walker process reported an error on its diagnostic stream`——**闭码表内**、不是静默零、walker 原句 `Permission denied` 不在线上 | PASS |

`G6` 把台账收在开账处：这五条正是 a5ie-r2b 写进 `pending-333.json` 的 `notCountedGreen`，本轮全部 RUN，逐条结果 + 历史 shut 逐字都记在 `runs/<stamp>/glob-333-rerun.json`。

`G3-law`（入账不判绿）：这个形状下 refusal 法**根本没被触发**——rg 15 `--files --no-ignore --hidden` 不把未跟随的 symlink 列为条目，所以条目到不了 `verifyGlobResultsBeneath`；该行"诚实现形 = 别名不出现"，而其 refusal 法由 `G3b` 真正走到位。

## 4. A8 现形（翻转后）与历史逐字

- 本轮现形：六条 glob 腿（installed 世界）**零** `IO_POLICY_UNSUPPORTED`，每条要么答在受治 meta 面上、要么带行自己的 typed code（`A8`：`legs=6 ioPolicy=0 metaOrTypedRefusal=true`）。
- 历史：a5ie-r2b 的逐字 shut 现形原样保留在本目录 `glob-row-shut-historical-a5ie-r2b.txt`，本轮**不重写、不改写**；`runs/<stamp>/glob-legs-verbatim.txt` 是本轮新逐字。

## 5. 红姿势与零扩面（翻转是配置scoped，不是环境弥漫）

| 腿 | 实测 |
| --- | --- |
| `P4`（新） | preassembly 世界（`teamToolPlane` 只带 `realmId`）**六条 glob 腿全部**仍落逐字 shut 面 → 给 assembled 世界挂上行，没有把 glob 体漏进未挂载的世界 |
| `P1`/`P2`/`P3` | read 走 preassembly 守卫逐字（"cannot be verified at dispatch time，无 native 回退"），grep/bash 落同一 typed shut 面 |
| `Z1` | 同一已装产物、无 `teamToolPlane` 的 baseline governed leader：`aliases=[] obs=[]` |
| `Z2` | 非 team 会话：registry Δ=[]、wire Δ=[]、`team_*` 别名 0 |
| `Z3`（本轮收紧） | assembled 世界 13 条被驱腿上 `IO_POLICY_UNSUPPORTED` 计数 **0**，宿主日志无 module/bootstrap 错误 |
| `D1` | DENY 车道：`a5p5-refused kind=refused-admission code=template-deny-lane detail=sha256:77b147…`，哨兵文件**从未产生** |

## 6. 收尾核验（实测）

`homes=[] locks=[]`；3183/3184/3491 运行后自证释放（`C3`）；测试宿主 porcelain 0；:3080 探针 401 → 401；原始含 token 日志已删（`C2`，脱敏副本留存）。

## 7. 仍入账不声称

- **B1**（承自 a5ie-r2b）：fail-closed 车道确实被真走过一次（因我方部署输入取错字节），证据留在 `a5ie-r2b/dev-runs/dev3`；本轮 `I9` 与两条 `confined-shell ran` 是反证。
- **B2**（本轮维持，不扩语义）：越界载荷在内核里失败（`cat: ../outside/secret.txt: Permission denied`）而 shell 行仍渲染 `exit=0`。本轮只声称 **A7 的内核拒绝 + 零泄露**，**不声称**出口码保真。#333 自身也把这写进披露：pre-launcher 监督子进程并无条件 `sys.exit(0)`，这张面上没有可读的载荷出口码（`/bin/sh -c 'exit 7'` 结算为 `{code: 0}`）。
- 两条测量注记：`A3c`（两行路径类别不同）、`G3-law` / `G4-note`（symlink 形状下 refusal 法的位置与答案形状）。

## 8. 本轮 kit 自身缺陷（披露，不改写历史）

| 迭代 | 现象 | 定性 |
| --- | --- | --- |
| `dev1`（RED 8 腿） | A3/A4/A5 三条 grep 腿落 `walker-permission-refused` | **我方夹具污染**：walker-error 的 000 模式夹具在 boot 时就存在，全根 walk（grep 腿搜 `.`）被它决定。→ 改为 per-leg 夹具机（§3）。产品侧的教训同时被记下：这一行在这种情况下**拒绝而不是假零**，正是它该有的行为 |
| `dev2`（RED 1 腿） | G2 `metaTruncated=false`、`inline=0` | **我方解析伪影**：工具结果在 wire 上是 JSON 内容数组、体内换行被转义，直接在转义信封上数行/匹配 meta 必然错。→ 统一 `wireText()` 解包后再读 |
| `dev3` | 后台方式起错（进程随其 bash 调用一起死），留下两个 world | 已清（`tests/homes` 现为空），产物在 `dev-runs/dev3-…` |
| `dev4`（GREEN） | `A3c` 记到空串 | 同上解析伪影的残留路径，修 `firstEntry()` 后在 `dev5`/recorded run 里为真值 |
| `dev5`（GREEN） | `Z3` 断言文案仍写 "twelve"（实际 13 条腿）、header 把上一轮误写成 a5ie-r3 | 文案与测量不符 → 文案修正后**重跑整轮**，留存记录run = `2026-10-18T12-52-34Z` |

## 9. 复现

```
cd .worktrees/a5ie-r2b/dev/agent-workflow/evidence/alpha5/a5ie-r3
node a5ie-r3-kit.mjs                 # 全量：H/I/W/A/P/Z/D/G/C，退出码 0=GREEN 2=RED
node render-table.mjs runs/<stamp>   # 从留存 criteria.json 重渲染 §10 的腿表
```

## 10. 全部腿（由 `runs/2026-10-18T12-52-34Z/criteria.json` 自动渲染）

| 腿 | 判定 | 断言（kit 原文，截断） | 实测（证据同值） |
| --- | --- | --- | --- |
| `H1` | PASS | the test-use host is the pinned pristine runtime @639ed01539, porcelain clean before | head=639ed01539 porcelain=0 |
| `H1b` | PASS | the install spec pins the LIVE master SHA the kit itself measured with git ls-remote, the worktree CARRIES it (merged, | ls-remote=104b499173687daa0f5c537bc37ae7600089576c merged-HEAD=baa697f04714 ancestor=true row=104b4991 feat(runtime): mount flip - search confined, gl |
| `H2` | PASS | ports 3183 AND 3184 self-proved free before the run + a mock port from the 349x family free | mock=3491 |
| `H0` | PASS | the stable :3080 instance answers read-only before this run (probe only, never touched) | status=401 |
| `I1` | PASS | REAL install through the host's own public package face — `dsh plugin --profile web add github:ArmourPiercer1/dsh-agen | exit=0 in 6s; tail=[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them. \| dependencies: \| + dsh-agent-team github:Armour |
| `I2` | PASS | STRICT profile face: the profile declares EXACTLY this repo's one plugin (dependencies == {dsh-agent-team: <the pinned | deps=["dsh-agent-team"] nm=["dsh-agent-team"] bundles=["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-agent-team"] |
| `I3a` | PASS | INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry | installed=1772 declared-files-face=1772 (files: entries=1770 + pack-always=2) |
| `I3b` | PASS | INSTALL THREE-ZEROS (2/4 missing = 0): every declared file materialized in the install dir | missing=0 [] |
| `I3c` | PASS | INSTALL THREE-ZEROS (3/4 extra = 0): nothing outside the declared face landed (no repo history, no source tree, no dot | extra=0 [] |
| `I3d` | PASS | INSTALL THREE-ZEROS (4/4 sha ≠ 0): every installed file is BYTE-IDENTICAL to that path at the installed commit | mismatch=0 [] rootSha=9936ffad18255041 |
| `I3e` | PASS | the two bytes beyond the declared `files:` list are exactly the pack rules' always-included manifest/document pair (di | alwaysIncluded=["README.md","package.json"] |
| `I4` | PASS | the installed bundle layer is machine-agnostic (rows reference the package by name — no file: URL, no absolute path),  | fileUrlOrAbsPath=false hostRow=true |
| `I9` | PASS | the deployment input the installer supplies for the confined provider is the RIGHT BYTES: the materialized pre-launche | sha=0049965daacae5bd… commit==worktree=true script=true abi=abi-available/4 answer={"kind":"abi-available","abi_version":4,"raw":["[SC] create_ruleset |
| `I5` | PASS | the pinned host composes the INSTALLED bundle row through the public profile seam: --dump-config carries id dsh-agent- | exit=0 teamRow=true plane=true subRows=true skipped=false |
| `I6` | PASS | the repo drift gate grades the COMMITTED dist at HEAD with exit 0 — the bytes that installed are the bytes the commit  | status=0 [check-artifacts-committed] OK: 1747 files — working tree equals the git INDEX for both install surfaces (incl. 8 glue placement(s)). This sc |
| `I8` | PASS | DISCLOSED FACE GAP (honest, not worked around): the confined provider's Landlock pre-launcher is NOT on the published  | launcherInFace=false launcherSha=0049965daacae5bd… |
| `W.installed.install` | PASS | the installed world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the mea | exit=0 n=1772/1772 miss=0 extra=0 sha≠=0 rootSha=9936ffad1825==probe |
| `W.preassembly.install` | PASS | the preassembly world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the m | exit=0 n=1772/1772 miss=0 extra=0 sha≠=0 rootSha=9936ffad1825==probe |
| `W.baseline.install` | PASS | the baseline world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the meas | exit=0 n=1772/1772 miss=0 extra=0 sha≠=0 rootSha=9936ffad1825==probe |
| `H3` | PASS | :3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after | 401 -> 401; porcelain=0 |
| `W1` | PASS | all three worlds ran on the REAL installed face (row composed from the installed bundle layer, not a file: URL) and we | installed:ok/swept preassembly:ok/swept baseline:ok/swept |
| `A1` | PASS | read POSITIVE on the installed face: the takeover-placed governed read RAN and the member result carries the REAL gove | read#1="[{\"type\":\"text\",\"text\":\"line one\\nA5IE-R3-READ-TOKEN-77\\nline three\\nA5IE-R3-GREP-TOK lives here\\n\"}]" |
| `A2` | PASS | read CROSS-ROOT NEGATIVE: the same row refuses a target that escapes the governed root with the typed anchor code, and | read#2="[{\"type\":\"text\",\"text\":\"refused-schema target-outside-governed-root — target lexically escapes the governed root (workspace: ../outside |
| `A3` | PASS | team_grep POSITIVE: the anchored read-only search row RAN (real search over the governed root) and the hit line carryi | grep#1="[{\"type\":\"text\",\"text\":\"search · content · 1 matches\\n> /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b/tests/homes/a5ie |
| `A4` | PASS | team_grep ABSOLUTE NEGATIVE: a pattern that exists nowhere answers an honest ZERO-HIT result (never a refusal, never a | grep#2="[{\"type\":\"text\",\"text\":\"search · content · 0 matches\\n> (no matches)\\na5p5-meta {\\\"kind\\\":\\\"search\\\",\\\"outputMode\\\":\\\"c |
| `A5` | PASS | team_grep ANCHORED NEGATIVE: searching with a prefix that exists ONLY outside the root answers zero hits inside, and t | grep#3="[{\"type\":\"text\",\"text\":\"search · content · 0 matches\\n> (no matches)\\na5p5-meta {\\\"kind\\\":\\\"search\\\",\\\"outputMode\\\":\\\"c |
| `A6` | PASS | team_bash POSITIVE (REAL Landlock on this host, ABI-gated launcher): the confined run RAN — token on stdout, exit=0 —  | bash#1="[{\"type\":\"text\",\"text\":\"bash · exit=0\\n> A5IE-R3-BASH-TOK\\n> A5IE-R3-WROTE-9\\n> \\na5p5-meta {\\\"kind\\\":\\\"shell\\\",\\\"exitCod |
| `A7` | PASS | team_bash OUT-OF-BOUNDS = KERNEL refusal: reading a file outside every allowPath answers `Permission denied` from insi | bash#2="[{\"type\":\"text\",\"text\":\"bash · exit=0\\n> (empty stdout)\\nstderr:\\n> cat: ../outside/secret.txt: Permission denied\\n> \\na5p5-meta { |
| `A8` | PASS | GLOB ROW POST-FLIP FORM: on the installed #333 face the typed shut landing is GONE from every glob leg (no IO_POLICY_U | legs=6 ioPolicy=0 metaOrTypedRefusal=true first="[{\"type\":\"text\",\"text\":\"search · files_with_matches · 2 matches\\n> gpos/beta.txt\\n> gpos/alp |
| `A9` | PASS | the installed world's host log carries the assembly's own witness rows: the placement-feed row list for this realm, th | placement=true confinedShellRan=2 anchoredGlobRan=4 anchoredSearchOk=3 governedRead=true |
| `A10` | PASS | which search body answers is attributable AFTER the flip (no silent substitution): the installed commit's mount passes | mountSearchConfined=true mountGlobConfined=true rgRows=3 meta=true |
| `A3c` | BOOK | MEASURED (booked, not graded): the post-flip PATH CLASS of each row - a5ie-r2b measured the grep(1) port printing the  | searchRowHit="/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b/tests/homes/a5ie-r3-installed-2026-10-18T12-52-34Z/workspace/governed/note |
| `D1` | PASS | DENY LANE BEFORE ANY BACKEND: the shell-DENYING member answered template-deny-lane and the sentinel was NEVER created  | r0="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=refused-admission code=template-deny-lane detail=sha256:77b14744144ea4ac367ea6695ffebcdc03c603c4b |
| `P1` | PASS | RED POSTURE (preassembly row: teamToolPlane WITHOUT fsInstance/confinedProvider): the member read dispatch answers the | read#1="[{\"type\":\"text\",\"text\":\"Error: team tool guard: the Tool Binding for \\\"read\\\" cannot be verified at dispatch time (no fallback to t |
| `P2` | PASS | RED POSTURE: team_grep lands the VERBATIM typed shut face (a landing, never a capability) | grep#1="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter for this  |
| `P3` | PASS | RED POSTURE: team_bash lands the same VERBATIM typed shut face for the shell class | bash#1="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter for this  |
| `P4` | PASS | RED POSTURE, POST-FLIP (the flip is config-scoped, never ambient): with teamToolPlane carrying ONLY realmId, ALL SIX g | globLegs=6 shut=6 first="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face  |
| `Z1` | PASS | control of controls: the BASELINE governed leader (same installed artifact, NO teamToolPlane config) shows zero plane  | aliases=[] obs=[] |
| `Z2` | PASS | ZERO EXPANSION (same round): the standard NON-team session shows registry-vs-baseline Δ=[] AND wire-vs-baseline Δ=[] A | regΔ=[] wireΔ=[] |
| `Z3` | PASS | TIGHTENED POST-FLIP: the assembled installed world shows NO IO_POLICY_UNSUPPORTED landing on ANY of the thirteen drive | legs=13 ioPolicyLegs=0 hostErrors=[] |
| `Z4` | PASS | the plane reached the model-facing wire on the governed agents (member catalog carries the three aliases plus the read | member plane names=["read","team_bash","team_glob","team_grep"] |
| `G1` | PASS | GLOB-POS (as booked in pending-333.json): the anchored rg walk answers a REAL match set over the wire - both seeded .t | names=["gpos/beta.txt","gpos/alpha.txt"] head="[{\"type\":\"text\",\"text\":\"search · files_with_matches · 2 matches\\n> gpos/beta.txt\\n> gpos/a" |
| `G2` | PASS | GLOB-BOUND: more seeds than the row's cap (140 > 100) answers a CAPPED inline page of EXACTLY the cap (100 names) plus | total=140 inline=100 cap=100 markerLine=true metaTruncated=true |
| `G3` | PASS | GLOB-SYMLINK (measured landing): in a directory holding one plain file and one symlink whose own target is the outside | names=["gsym/real.txt"] linkSurfaced=false markerOnWire=0 |
| `G3-law` | BOOK | WHERE THE REFUSAL LAW SITS for this shape (measured, booked not graded): rg 15 --files --no-ignore --hidden does not l | legBody="search · files_with_matches · 1 matches\n> gsym/real.txt\na5p5-meta {\"kind\":\"search\",\"outputMode\":\"files_with_matches\",\"to" |
| `G3b` | PASS | GLOB-OUTSIDE-ANCHOR (the anchor law itself): making the ESCAPING SYMLINK the walk target lands the row's TYPED anchor- | landing="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=symlink-alias detail=a path component of the target is an alias\"}]" mar |
| `G4-note` | BOOK | measured shape of the outside-anchor leg: the answer carries the inside entry only - the symlinked directory is not en | names=["goutside/inside.txt"] refused=false body="search · files_with_matches · 1 matches\n> goutside/inside.txt\na5p5-meta {\"kind\":\"search\",\"out |
| `G4` | PASS | GLOB-OUTSIDE-ANCHOR: with a symlinked DIRECTORY inside the walk root pointing at the outside tree, neither the outside | names=["goutside/inside.txt"] refused=false markerOnWire=0 |
| `G5` | PASS | GLOB-WALKER-ERROR: a subtree the kernel refuses (mode 000, created only for this leg) lands a TYPED walker error from  | landing="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=walker-error detail=the walker process reported an error on its diagnost |
| `G6` | PASS | the ledger closes where it was opened: the five controls a5ie-r2b wrote as pending-333.json are now RUN and recorded i | flipBodiesInstalled=[true,true] historical=true |
| `B2` | BOOK | BOOKED, NOT CLAIMED (exit-code fidelity): the out-of-bounds payload failed in the kernel yet the shell row rendered ex | kernelRefused=true reportedExitZero=true landing="[{\"type\":\"text\",\"text\":\"bash · exit=0\\n> (empty stdout)\\nstderr:\\n> cat: ../outside/secret |
| `C1` | PASS | world + install-dir cleanup: no a5ie-r3-* DSH_HOME (and no lock) remains under tests/homes; the installed byte manifes | homes=[] locks=[] installHome=true |
| `C2` | PASS | launch-token hygiene: raw instance logs deleted after redaction at capture | rawLeft=[] |
| `C3` | PASS | ports released after the run (host 318x pair + the 349x mock port all self-prove free again) | ports=3183/3184/3491 free=true |

<!-- graded=50 pass=50 fail=0 booked=4 -->

## 11. 产物索引

| 文件 | 内容 |
| --- | --- |
| `a5ie-r3-kit.mjs` | 本轮 kit（H/I/W/A/P/Z/D/G/C + booked B1/B2） |
| `runs/2026-10-18T12-52-34Z/` | 留存记录：`install-manifest.json`（1772 条逐文件 sha256 + rootSha）、`install-*.log`、`world-*.json`、`wire-digests-*.jsonl`、`instance-*.log`（脱敏）、`glob-legs-verbatim.txt`、**`glob-333-rerun.json`（五控台账）**、`criteria.json`、`blueprints/` |
| `glob-row-shut-historical-a5ie-r2b.txt` | 翻转**前** glob 行的逐字现形（历史，未改写） |
| `dev-runs/` | 未被改写的迭代现场（dev1–dev5 + install-only 冒烟） |
| `KIT_EXIT` | 本轮结论与三零/端口/porcelain/:3080 实测 |
