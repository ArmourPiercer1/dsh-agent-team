# a5ie-r2b — 真机安装面（`dsh plugin add github:…`）× Team 入口真跑 验收排练

> 本轮唯一命题：**把"发布面被真机装进来"与"装进来的面跑得起受治 Team"两件事，在同一轮、同一次运行里，用钉死的 pristine 宿主自己的公开面做完。**
> 一切 mock 只在 LLM 位；被测对象是当前 master 的已提交字节，不是扩展镜像、不是 worktree dist、不是 `file:` 局部路径。
>
> 结论：**GREEN 43/43 + 2 条如实入账，`KIT_EXIT=0`。安装三零实测 missing=0 / extra=0 / sha-mismatch=0（1772/1772）。**

## 0. 基线（自证，不引用他人结论）

| 项 | 实测值 |
| --- | --- |
| `git ls-remote origin refs/heads/master` | `0fa2cd76de2b48ef287ca3bf82ac6b03b30e3ab8`（含 #332 `0fa2cd76` / #331 `1962f879` / #330 `1a7c3c1c`） |
| 本 worktree | `.worktrees/a5ie-r2b` @ 分支 `a5ie-r2b`，`git rev-parse HEAD` = `0fa2cd76de2b48ef287ca3bf82ac6b03b30e3ab8`（无短 SHA 拼接） |
| 测试宿主 | `tests/deepseek-harness-test-use`（pristine，detached @ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2），**运行前后 porcelain 均为 0**（`H1`/`H3`） |
| 端口 | 3183 / 3184（318x 族）+ mock 3492；运行前自证空闲，运行后自证释放（`H2`/`C3`） |
| 稳定实例 :3080 | 只做只读探针，前后同一状态（`H0`：401 → 401），全程未被触碰 |
| DSH_HOME | 全部在 `tests/homes/a5ie-r2b-*` 内（工作区内），运行后 `homes=[]`（`C1`） |

## 1. ① 真机安装：新安装目录 + 严格 manifest 面 + 三零

命令逐字（由钉死宿主自己的 CLI 执行，即公开包面；`node tests/deepseek-harness-test-use/apps/cli/lib/bin.js` = `dsh`）：

```
DSH_HOME=<worktree>/tests/homes/a5ie-r2b-install-<stamp> \
  node tests/deepseek-harness-test-use/apps/cli/lib/bin.js \
  plugin --profile web add 'github:ArmourPiercer1/dsh-agent-team#0fa2cd76de2b48ef287ca3bf82ac6b03b30e3ab8'
```

pnpm 内容库留在工作区：本轮沿用先例——pnpm 11 在本机**不读** `.npmrc`/`PNPM_STORE_PATH`，只认 profile 自己的 `pnpm-workspace.yaml`，所以 kit 在写 profile 之前先落一份 `profiles/web/pnpm-workspace.yaml`（`storeDir: <workspace>/.pnpm-store-a5ie-r2b` + `nodeLinker: hoisted` + `autoInstallPeers: false`）。这是公开配置通道，不是命令行注入。

实测（`runs/2026-10-18T12-14-43Z/install-probe.log`、`install-manifest.json`）：

| 断言 | 实测 |
| --- | --- |
| `I1` 安装退出码 | `exit=0`（暖库 4s） |
| `I2` 严格 manifest 面 | profile `dependencies` = **只有** `dsh-agent-team`（值即上述 spec）；`node_modules` 顶层只有 `dsh-agent-team`；reconcile 追加 bundle 行 = `["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-agent-team"]` |
| `I3a` 计数 | 安装树 **1772 = 1772**（`files:` 声明面 1770 个跟踪文件 + pack 恒含 2 个） |
| `I3b` **missing = 0** | 声明面全部落地（空清单） |
| `I3c` **extra = 0** | 面外零文件（无仓库历史、无源码树、无点目录；空清单） |
| `I3d` **sha-mismatch = 0** | 1772 个文件逐字节等于该 commit 中同路径 blob；面根摘要 `fd127dee31428d7d342f53ddc339dfd9fbfc6d91571575b8192d3044ac90257a` |
| `I3e` 恒含披露 | 面外两字节即 pack 规则的 `package.json` + `README.md`（显式披露，不塞进计数里） |
| `I4` 机器无关 | 已安装 bundle 层无 `file:`/绝对路径，行以包名引用（`dsh-agent-team/host`） |
| `I5` 组合面 | 安装后 `--dump-config`（公开面）里出现 `id: dsh-agent-team / name: dsh-agent-team/host` + 本轮 `teamToolPlane` 配置 + 同层的 `spill-local` 与 `dsh-agent-team-client` 行，无 skipped bundle |
| `I6` 漂移门 | `scripts/check-artifacts-committed.mjs` exit 0（`OK: 1747 files …`）：装上的是提交里那份 dist，安装期不重新编译 |
| `W.*.install` ×3 | 三个 live 世界各自**重新安装**一次，且三次安装与探针安装**字节同一**（同 `rootSha`），三零重复成立 |

### 1.1 发布面缺口（披露，不绕过）——`I8` / `I9`

- `I8`：受治进程提供者的 Landlock 预启动器 `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py` **不在发布面上**（`files:` 只带 dist，`tsc` 从不产出 `.py`）。因此安装方面对 shell 行时，**安装者必须自己供给这份部署输入**——这正是 `docs/INSTALL.md` §3.5 把它写成部署输入 + `trustRoot`/`launcherSha256` 双门的原因。本轮从**同一 commit** 取该 blob 落到世界内 `deployment/` 并字节钉死。
- `I9`（本轮新增，来自一次真实自坑）：这份部署输入的字节在**任何宿主存在之前**就被三重证明——与 commit blob 同 sha、与 HEAD 工作树同 sha（`0049965daacae5bd04197407c584cf7312bb22b10b35a09f01a89bb108cafe77`，23691 B）、以 `#!` 开头，并且直接问它要 ABI 得到 `abi-available / 4`。

## 2. ② Team 入口真跑（mock 只在 LLM 位）

装配只走公开 seam：profile 的 `cordis.patch.yml` 里一条**与已安装 bundle 行同 `id`** 的配置行

```yaml
- id: dsh-agent-team
  name: dsh-agent-team/host
  config:
    teamToolPlane:
      realmId: a5ie-realm…
      fsInstance: { fs: …, rootDir: <world>/workspace/governed, realmId: …, kind: absolute-path }
      confinedProvider:
        trustRoot: sha256:0049965daacae5bd#<world>/deployment/landlock-prelauncher.py
        assembly: { launcherPath: …, launcherSha256: 0049965daacae5bd…, minAbiVersion: 3 }
```

零手写装配、零私有 API、零 `file:` 包路径。运行是真 Team：`team.create` → Leader `team_delegate`（成员 wa）→ 8 条 effect 腿 → `team_collect` → 再 `team_delegate`（成员 wd，shell 被 deny）→ `team_collect` → 收尾；Leader 实测调用序列 `["team_delegate","team_collect","team_delegate","team_collect"]`，成员 A 9 次入模、成员 D 2 次。

三个世界（同一轮、同一安装面）：`installed`（带完整 `teamToolPlane`）/ `preassembly`（只给 `realmId`，看 RED 姿态是否逐字不变）/ `baseline`（完全不给 `teamToolPlane`，控制之控制）。

### 2.1 腿清单（逐行，实测值即证据）

下表由 `runs/2026-10-18T12-14-43Z/criteria.json` 直接生成，未手改：

| 腿 | 判定 | 断言（kit 原文，截断） | 实测（证据同值） |
| --- | --- | --- | --- |
| `H1` | PASS | the test-use host is the pinned pristine runtime @639ed01539, porcelain clean before | head=639ed01539 porcelain=0 |
| `H1b` | PASS | the install spec pins THIS round's verified master SHA (the install face under test is that exact commit, no branch dr | worktree=0fa2cd76de2b spec sha=0fa2cd76de2b |
| `H2` | PASS | ports 3183 AND 3184 self-proved free before the run + a mock port from the 349x family free | mock=3492 |
| `H0` | PASS | the stable :3080 instance answers read-only before this run (probe only, never touched) | status=401 |
| `I1` | PASS | REAL install through the host's own public package face — 'dsh plugin --profile web add github:ArmourPiercer1/dsh-agen | exit=0 in 4s; tail=[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them. ¦ dependencies: ¦ + dsh-agent-team githu |
| `I2` | PASS | STRICT profile face: the profile declares EXACTLY this repo's one plugin (dependencies == {dsh-agent-team: <the pinned | deps=["dsh-agent-team"] nm=["dsh-agent-team"] bundles=["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-agent-team"] |
| `I3a` | PASS | INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry | installed=1772 declared-files-face=1772 (files: entries=1770 + pack-always=2) |
| `I3b` | PASS | INSTALL THREE-ZEROS (2/4 missing = 0): every declared file materialized in the install dir | missing=0 [] |
| `I3c` | PASS | INSTALL THREE-ZEROS (3/4 extra = 0): nothing outside the declared face landed (no repo history, no source tree, no dot | extra=0 [] |
| `I3d` | PASS | INSTALL THREE-ZEROS (4/4 sha ≠ 0): every installed file is BYTE-IDENTICAL to that path at the installed commit | mismatch=0 [] rootSha=fd127dee31428d7d |
| `I3e` | PASS | the two bytes beyond the declared 'files:' list are exactly the pack rules' always-included manifest/document pair (di | alwaysIncluded=["README.md","package.json"] |
| `I4` | PASS | the installed bundle layer is machine-agnostic (rows reference the package by name — no file: URL, no absolute path),  | fileUrlOrAbsPath=false hostRow=true |
| `I9` | PASS | the deployment input the installer supplies for the confined provider is the RIGHT BYTES: the materialized pre-launche | sha=0049965daacae5bd… commit==worktree=true script=true abi=abi-available/4 answer={"kind":"abi-available","abi_version":4,"raw":["[SC] crea |
| `I5` | PASS | the pinned host composes the INSTALLED bundle row through the public profile seam: --dump-config carries id dsh-agent- | exit=0 teamRow=true plane=true subRows=true skipped=false |
| `I6` | PASS | the repo drift gate grades the COMMITTED dist at HEAD with exit 0 — the bytes that installed are the bytes the commit  | status=0 [check-artifacts-committed] OK: 1747 files — working tree equals the git INDEX for both install surfaces (incl. 8 glue placement(s) |
| `I8` | PASS | DISCLOSED FACE GAP (honest, not worked around): the confined provider's Landlock pre-launcher is NOT on the published  | launcherInFace=false launcherSha=0049965daacae5bd… |
| `W.installed.install` | PASS | the installed world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the mea | exit=0 n=1772/1772 miss=0 extra=0 sha≠=0 rootSha=fd127dee3142==probe |
| `W.preassembly.install` | PASS | the preassembly world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the m | exit=0 n=1772/1772 miss=0 extra=0 sha≠=0 rootSha=fd127dee3142==probe |
| `W.baseline.install` | PASS | the baseline world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the meas | exit=0 n=1772/1772 miss=0 extra=0 sha≠=0 rootSha=fd127dee3142==probe |
| `H3` | PASS | :3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after | 401 -> 401; porcelain=0 |
| `W1` | PASS | all three worlds ran on the REAL installed face (row composed from the installed bundle layer, not a file: URL) and we | installed:ok/swept preassembly:ok/swept baseline:ok/swept |
| `A1` | PASS | read POSITIVE on the installed face: the takeover-placed governed read RAN and the member result carries the REAL gove | read#1="[{\"type\":\"text\",\"text\":\"line one\\nA5IE-R2B-READ-TOKEN-77\\nline three\\nA5IE-R2B-GREP-TOK lives here\\n\"}]" |
| `A2` | PASS | read CROSS-ROOT NEGATIVE: the same row refuses a target that escapes the governed root with the typed anchor code, and | read#2="[{\"type\":\"text\",\"text\":\"refused-schema target-outside-governed-root — target lexically escapes the governed root (workspace:  |
| `A3` | PASS | team_grep POSITIVE: the anchored read-only search row RAN (real search over the governed root) and the hit line carryi | grep#1="[{\"type\":\"text\",\"text\":\"search · content · 1 matches\\n> /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b/tests/ |
| `A4` | PASS | team_grep ABSOLUTE NEGATIVE: a pattern that exists nowhere answers an honest ZERO-HIT result (never a refusal, never a | grep#2="[{\"type\":\"text\",\"text\":\"search · content · 0 matches\\n> (no matches)\\na5p5-meta {\\\"kind\\\":\\\"search\\\",\\\"outputMode |
| `A5` | PASS | team_grep ANCHORED NEGATIVE: searching with a prefix that exists ONLY outside the root answers zero hits inside, and t | grep#3="[{\"type\":\"text\",\"text\":\"search · content · 0 matches\\n> (no matches)\\na5p5-meta {\\\"kind\\\":\\\"search\\\",\\\"outputMode |
| `A6` | PASS | team_bash POSITIVE (REAL Landlock on this host, ABI-gated launcher): the confined run RAN — token on stdout, exit=0 —  | bash#1="[{\"type\":\"text\",\"text\":\"bash · exit=0\\n> A5IE-R2B-BASH-TOK\\n> A5IE-R2B-WROTE-9\\n> \\na5p5-meta {\\\"kind\\\":\\\"shell\\\" |
| `A7` | PASS | team_bash OUT-OF-BOUNDS = KERNEL refusal: reading a file outside every allowPath answers 'Permission denied' from insi | bash#2="[{\"type\":\"text\",\"text\":\"bash · exit=0\\n> (empty stdout)\\nstderr:\\n> cat: ../outside/secret.txt: Permission denied\\n> \\na |
| `A8` | PASS | GLOB ROW CURRENT FORM, booked VERBATIM (current master, #333 NOT merged): team_glob lands the typed shut face and the  | r7="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter for |
| `A9` | PASS | the installed world's host log carries the assembly's own witness rows: the placement-feed row list for this realm, th | placement=true capability=true confinedShellRan=2 governedRead=true |
| `A10` | PASS | which search body answered is attributable (no silent substitution): the hit line carries the ANCHORED ABSOLUTE path o | anchoredPathInResult=true metaFace=true mountConfined=false |
| `D1` | PASS | DENY LANE BEFORE ANY BACKEND: the shell-DENYING member answered template-deny-lane and the sentinel was NEVER created  | r0="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=refused-admission code=template-deny-lane detail=sha256:77b14744144ea4ac367ea6695ffebcd |
| `P1` | PASS | RED POSTURE (preassembly row: teamToolPlane WITHOUT fsInstance/confinedProvider): the member read dispatch answers the | read#1="[{\"type\":\"text\",\"text\":\"Error: team tool guard: the Tool Binding for \\\"read\\\" cannot be verified at dispatch time (no fal |
| `P2` | PASS | RED POSTURE: team_grep lands the VERBATIM typed shut face (a landing, never a capability) | grep#1="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter |
| `P3` | PASS | RED POSTURE: team_bash lands the same VERBATIM typed shut face for the shell class | bash#1="[{\"type\":\"text\",\"text\":\"a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter |
| `Z1` | PASS | control of controls: the BASELINE governed leader (same installed artifact, NO teamToolPlane config) shows zero plane  | aliases=[] obs=[] |
| `Z2` | PASS | ZERO EXPANSION (same round): the standard NON-team session shows registry-vs-baseline Δ=[] AND wire-vs-baseline Δ=[] A | regΔ=[] wireΔ=[] |
| `Z3` | PASS | the installed world shows NO IO_POLICY_UNSUPPORTED landing on any driven leg except the glob row, and its host log car | legs=8 ioPolicyLegs=1 hostErrors=[] |
| `Z4` | PASS | the plane reached the model-facing wire on the governed agents (member catalog carries the three aliases plus the read | member plane names=["read","team_bash","team_glob","team_grep"] |
| `G1` | PASS | the flip is honestly NOT claimed here: the installed commit's plane source still says 'glob: shut', the wire landed th | sourceShut=true wireShut=true |
| `B1` | **入账** | CROSS-ROUND DISCLOSURE (booked, not graded): the confined provider's fail-closed lane was exercised for real in an ear | refusalsInEarlierWorld=6 earlierLine=FAIL A6 — team_bash POSITIVE (REAL Landlock on this host, ABI-gated launcher): the confined run RAN — t |
| `B2` | **入账** | BOOKED, NOT CLAIMED (exit-code fidelity): the out-of-bounds payload failed in the kernel yet the shell row rendered ex | kernelRefused=true reportedExitZero=true landing="[{\"type\":\"text\",\"text\":\"bash · exit=0\\n> (empty stdout)\\nstderr:\\n> cat: ../outs |
| `C1` | PASS | world + install-dir cleanup: no a5ie-r2b-* DSH_HOME (and no lock) remains under tests/homes; the installed byte manife | homes=[] locks=[] installHome=true |
| `C2` | PASS | launch-token hygiene: raw instance logs deleted after redaction at capture | rawLeft=[] |
| `C3` | PASS | ports released after the run (host 318x pair + the 349x mock port all self-prove free again) | ports=3183/3184/3492 free=true |

### 2.2 关键落点逐字摘录（已安装面）

```
A1 read 正向            line one\nA5IE-R2B-READ-TOKEN-77\nline three\nA5IE-R2B-GREP-TOK lives here
A2 read 越界负向        refused-schema target-outside-governed-root — target lexically escapes the
                        governed root (workspace: ../outside/secret.txt)          ← 零字节外泄
A3 grep 正向            search · content · 1 matches
                        > <world>/workspace/governed/notes.txt:4: A5IE-R2B-GREP-TOK lives here
                        a5p5-meta {"kind":"search","outputMode":"content",…}
A4 grep 绝对负向        search · content · 0 matches\n> (no matches)             ← 诚实零命中，非拒形
A5 grep 锚定负向        同上（只在根外存在的标记 0 命中，标记字节全程未上线）
A6 bash 受治正向        bash · exit=0\n> A5IE-R2B-BASH-TOK\n> A5IE-R2B-WROTE-9    ← 真 Landlock；根内写盘成功
A7 bash 越界=内核拒      stderr: > cat: ../outside/secret.txt: Permission denied  ← 内核拒读，非通道猜测
A8 glob 现状            a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the
                        production effect-face adapter … the effect body stays refused — never faked
A9 装配自证行           placement-feed rows=[team_grep,team_glob,team_bash,read] realm=a5ie-r2b-realm
                        confined-shell capability OK rows=6 / confined-shell ran ×2 / governed-read RAN
D1 deny 道              a5p5-refused kind=refused-admission code=template-deny-lane detail=sha256:77b147…
                        sentinel-wd-must-not-exist 从未被创建（sentinel=false）
```

## 3. glob 行：现状逐字入账，`#333` 合并后重跑，绝不提前计绿

已安装 commit 的 plane 源仍是 `glob: shut`（`G1` 用 `git show <sha>:…/team-tool-plane.mjs` 钉住），线上落点即上表 `A8` 的 `IO_POLICY_UNSUPPORTED`，逐字存 `runs/…/glob-row-verbatim.txt`。

`runs/…/pending-333.json` 记明 **#333 合并后要重跑的五条控制**（GLOB-POS / GLOB-BOUND / GLOB-WALKER-ERROR / GLOB-SYMLINK / GLOB-OUTSIDE-ANCHOR），并写明 `rerunTrigger: merge of the glob mount (#333)`；本轮它们**既未尝试也未计绿**。

补充归因（`A10`）：本轮 grep 行的答题者是**锚定 search 端口**（命中行带本世界 governed root 的绝对路径 + 受治渲染器 `a5p5-meta`，且该 commit 的 mount 调用未向 search 后端传 `confined`），宿主日志无任何 confined-rg / anchored-glob 声称——不是 rg-parity 行（#330）在答题。

## 4. ③ 收尾核验（实测）

| 项 | 实测 |
| --- | --- |
| `C1` | `tests/homes` 下 `a5ie-r2b-*` 世界与锁 = `[]`，安装目录亦已删除；留档的是逐文件 sha 清单 |
| `C2` | 启动令牌：原始实例日志已在捕获时脱敏后删除（`rawLeft=[]`） |
| `C3` | 3183 / 3184 / 3492 运行后自证空闲 |
| `H3` | :3080 前后同状态（401→401）；测试宿主 porcelain **0** |
| 复核 | 本轮收尾后再次人工复核：`homes=0`、porcelain 行数 0、3183/3184/3492 free、`curl :3080` = 401 |

## 5. 两条如实入账（不记为 PASS，也不藏进 PASS 里）

- **`B1` 跨轮披露：fail-closed 通道被真实触发过。** 本轮早先一次运行（`dev-runs/dev3`）把受治提供者的部署输入取错了字节——`git archive` 输出的是 **tar 容器**（头+载荷），不是脚本；自洽的字节钉因此**通过**，但权威 ABI 探针随后测不到 Landlock ABI，两条 shell 腿被 `SANDBOX_UNAVAILABLE` 拒掉、**没有**回落到非受治执行。这正是"永不非受治回落"这条法度在工作，也是新增 `I9` 的理由。记账引用留存的早先证据，不冒充本轮行为。
- **`B2` 退出码保真度：未声称。** 越界腿的载荷在内核里确实失败（`Permission denied`），但 shell 行渲染出 `exit=0`。因此本轮 `A7` 只声称**内核拒读 + 零外泄**两件事，**不声称**该 commit 上受治 shell 行会携带载荷退出码。（若要声称，需另轮加断言。）

## 6. 本轮 kit 自身缺陷（披露）

`dev-runs/` 下保留全部迭代轮：`dev1-install-only`（只跑安装相，live 腿因跳过而 RED）、`dev2`（kit 传参 bug：`realInstall` 收到对象）、`dev3`（部署输入取 tar 字节 → A6/A7/A9/A10 + P2 红）、`dev4`（`git show` 修好 → 42/43，A9 的 `confined-shell ran` 拼写未匹配）、`dev5-green-preB2`（首次 GREEN，尚无 `B2` 记账）、`repro-abi.mjs` / `boot-abi-probe.mjs` / `abi-probe-row.mjs` / `abi-probe-host.log`（定位探针：在宿主环境内 provider 实测 `landlock ABI v4`，`content-read=enforced / write=enforced`，排除环境嫌疑）。红腿原文均未被改写。

## 7. 复现

```
cd .worktrees/a5ie-r2b/dev/agent-workflow/evidence/alpha5/a5ie-r2b
node a5ie-r2b-kit.mjs                 # 全轮：安装相 + 三个 live 世界
node a5ie-r2b-kit.mjs --only install  # 只跑安装相（live 腿会因跳过而 RED）
# 退出码：0 GREEN / 2 有腿失败 / 1 致命；证据默认落 runs/<UTC-stamp>/
```

前置：`.worktrees/a5ie-r2b/tests/deepseek-harness-test-use` 为 pristine @ `639ed01539…`（porcelain 0），318x 端口空闲，网络可达 GitHub（`dsh plugin add` 真下载；失败即报告失败输出并停止，不改用本地路径安装）。

## 8. 产物索引

| 文件 | 内容 |
| --- | --- |
| `a5ie-r2b-kit.mjs` | 本轮 kit（安装相 + 三个 live 世界 + 三零/三 RED 姿态/零扩张/收尾） |
| `recorded-run.log` | 记录轮逐腿 stdout（`VERDICT GREEN (43/43 +2 booked)`、`KIT_EXIT=0`） |
| `KIT_EXIT` | 退出码与本轮口径摘要 |
| `runs/2026-10-18T12-14-43Z/` | 记录轮全部收据：`install-*.log`、`install-manifest.json`（逐文件 sha256 清单）、`dump-config-install-probe.txt`、`launcher-deployment.json`、`profile-layer-*.yml`、`world-*.json`、`wire-digests-*.jsonl`、`instance-*.log`（已脱敏）、`criteria.json`、`glob-row-verbatim.txt`、`pending-333.json`、`start-sweep.json`、`blueprints/` |
| `dev-runs/` | 迭代轮与定位探针（原文保留） |
