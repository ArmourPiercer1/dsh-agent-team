# candidate-package — Alpha.5 候选终装配「安装 + 回滚 + 试用」预装配包

> ## 本包状态 = **PRE-ASSEMBLED，占位未填即不可发布**
>
> 本包按根 22:39Z 令**提前备好**：安装/回滚/试用脚本与本文档在最终 SHA 定稿前装配完毕，
> 使终装轮只需**填占位 + 跑回执**，不再串行等待文档。所有待定事实以 `{{...}}` 显式标记。
> **只要任何一个 `{{...}}` 未填，本包不得发布、不得对外称"可安装候选"。**
>
> | 占位 | 含义 | 终装配时由谁/何时填 |
> | --- | --- | --- |
> | `{{FINAL_CANDIDATE_SHA}}` | 最终候选 = 终装时 live master 的全量 40-hex SHA（本包预装配参照 = `52d73534f92e69efe12c72c347d435f66f3f85fe`，双源核于 2026-10-19 装配轮，**不是**终值声明） | 终装轮开头，`git ls-remote origin refs/heads/master` 现场值 |
> | `{{C1_INSTALL_RECEIPT}}` | 取消腿真 RPC **四条件**装面复验回执（abort 命中 / 进程终止 / 无继续副作用 / 模型明确见中止且非成功，**四缺一不算过**） | a5ie-r5 形取消腿在最终 SHA 上复跑，runs 目录路径 + 四条件逐项 |
> | `{{PR343_MERGE_STATUS}}` | rc-first 判据线（#337 ① 步骤 B `178bea59…`）经 **#343** 的合并状态与装面复验绿证（stderr 代理判据洞闭合 = 入头 + 复验绿 双条件） | #343 合并轮 + glob 五控装面重跑 |
> | `{{ROLLBACK_REHEARSAL_RECEIPT}}` | 回滚演练记录（`--to-last` 与 `--uninstall` 各一次，最终 SHA 上） | 终装轮，runs/rollback-* + runs/reinstall-* 路径 |
> | `{{INSTALL_RECEIPT}}` / `{{TRIAL_RECEIPT}}` | 最终 SHA 的 `install-candidate.sh` 三零回执（rootSha）与三腿全链试用回执（KIT_EXIT=0 的 runs 路径） | 终装轮各跑一次 |
> | `{{PIN_TABLE_RECEIPT}}` | 13+2 名钉表在最终 SHA 的双向漂移机检绿证（防钉轮含 subagent_codex/subagent_claude_code 启用/禁用翻转测试） | 终装轮 a5-pindir 机检 |

装配双源记（本包字节基线，非终值）：`git ls-remote origin master` = `git rev-parse origin/master` =
`52d73534f92e69efe12c72c347d435f66f3f85fe`（2026-10-19 装配轮现场，两源同值）；**装配轮内 tip 已前移至
`708fb3fed6555ad664d9817cea64db06150eeff1`（轮末现场 `ls-remote` 值）**——一切"最终"声明以终装轮现场双源核为准。
launcher 部署输入 @该 SHA = `sha256 1264ea584e3438d6…`（26 992 B，`--exit-passthrough` 在体；与 `5885e46e`/`b6d7c48a` 线同字节，见 release-candidate-r1 `ROLLBACK-AND-TRIAL.md` §1）。
安装面 declared face @该 SHA = **1773**（`files:` 条目 1771 + pack-always `README.md`/`package.json` 2；I3e 单列口径）。

---

## 0. 文件清单

| 文件 | 角色 |
| --- | --- |
| [install-candidate.sh](./install-candidate.sh) | SHA-pin 安装脚本（CANDIDATE_SHA **必填无默认**；缺则报错退出） |
| [face-check.mjs](./face-check.mjs) | 安装面度量件：三零对照清单 + rootSha + launcher 字节/ABI + `--dump-config` 装配树 |
| [rollback-candidate.sh](./rollback-candidate.sh) | 回滚：`--to-last`（重装上一 INSTALLED 状态）/ `--uninstall`（完全卸载）；**按名清理，禁宽 glob** |
| [try-candidate.sh](./try-candidate.sh) | 试用编排器（`--dry-run` / `--probe` 最快腿 / 全三腿） |
| [try-candidate-kit.mjs](./try-candidate-kit.mjs) | 试用驱动：三最小试用链 + 世界/端口自证 + 具名清理（mock 仅在 LLM 位） |
| [helpers/](./helpers/HELPROOT.sha256) | mock-deepseek / preset-seam / paths 的**同 commit 字节副本**（HELPROOT.sha256 记 pin） |
| runs/ | 各跑证据目录（install-<stamp> / trial-<stamp> / rollback-<stamp>） |

派生谱系（未造新轮子）：安装链与三零律 = `release-candidate-r1/rc-trial-kit.mjs`（master 字节，r5 终态 28/0 GREEN @`5885e46e`）；
glob-off 判据 = `glob-off-install` kit（`a5glob-off-off-*` 判定期 49/50+3，唯一红为钉条件红 H1b）；
骨架判据律 = `a5ie-r5`（真安装全量 40/41+3，唯一红 C1）。

## 1. 前置条件（如实引用，不美化）

| 项 | 要求 | 出处 |
| --- | --- | --- |
| 宿主运行时 | `tests/deepseek-harness-test-use` @ **0.2.0-rc.2 `639ed01539…`**（pin 唯一来源 `tests/paths.mjs`），porcelain 0 | TEST_METHODS §1/§2 |
| 构建/启动链 | `pnpm install --ignore-scripts` → `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build`（必须经 `pnpm run`）→ 产物入口 `node apps/cli/lib/bin.js`（禁 tsx 路径） | TEST_METHODS §2 |
| node / pnpm | node `^22.19 \|\| >=24`；pnpm `11.7.0`（packageManager pin） | INSTALL §1 |
| **Landlock** | 内核 Landlock **ABI ≥ 3** 可用（`python3 <launcher> --abi-probe` 答 `abi-available`；本仓装面验收轮实测 **ABI 4**），python3 在场。ABI 不可用 = 受治 shell/glob 行的**执行**不成立，安装面本身不受影响（face-check 以 BOOK 记录） | glob-off-install README「宿主」行（Landlock ABI 4 可用）；INSTALL §3.5 |
| ripgrep | 打包 rg（`@vscode/ripgrep`）可解析（glob/search 行经宿主 resolver spawn 它） | glob-off-install README（`ripgrep 15.0.0 (rev 3a612f88b8)`） |
| 网络 | 到 GitHub 的可达性（安装 = 公开包面 `github:ArmourPiercer1/dsh-agent-team#<SHA>`；TLS 抖动先例=重试即愈） | a5ie-r5 尝试账 run-2 |
| 端口 | `3180` 族（3180-3186 / 3491-3500），**禁 3080**；并发撞埠先例（r6 EADDRINUSE）→ 脚本自选空闲+自证 | TEST_METHODS §1；SMOKE.md r6 |
| 红线 | `:3080` 稳定实例只读探测、其 DSH_HOME 禁触；测试世界必须在工作区内 `tests/homes/` | TEST_METHODS §3/§5/§7 |
| 真试用（真人） | 真实 provider/model 凭据；`staticModel` 指真模型、mock 换下（其余装配不变）；测试世界的假模型配置**不可**当真测用 | INSTALL §4 |

## 2. 安装步骤

```bash
# 在 dsh-agent-team checkout 内（世界落 tests/homes/，TEST_METHODS §7）：
CANDIDATE_SHA={{FINAL_CANDIDATE_SHA}} ./install-candidate.sh
```

脚本执行的法（不可软化）：

1. **CANDIDATE_SHA 必填、全量 40-hex、无默认**——未设即报错退出。**「最新 master」语义被禁**：
   脚本从不把移动 ref 当安装对象；SHA ≠ 现场 `ls-remote` tip 时默认拒绝（`CANDIDATE_ALLOW_ANCESTOR=1`
   只接受"更早的已验证 commit 作为 tip 的祖先"，且该事实被记录——镜像 a5glob-off H1b/H1d 的钉条件纪律）。
2. **双源核**：源① clone 外 `git ls-remote refs/heads/master`；源② clone 内 `checkout --detach <SHA>` 后
   `rev-parse HEAD`（另加 `merge-base --is-ancestor` 可达性核）。不拼贴、不猜测。
3. **安装链按 TEST_METHODS §2 实形 + INSTALL §2 快速安装**：
   `DSH_HOME=<world> node <test-use>/apps/cli/lib/bin.js plugin --profile web add 'github:ArmourPiercer1/dsh-agent-team#<SHA>'`，
   profile `pnpm-workspace.yaml` 把 pnpm store 钉在工作区内（`storeDir`）。无 file: 路径、无手工装配、零上游补丁。
4. **装面三零校验（对照清单）**：对照清单 = `package.json` `files:` 在 CANDIDATE_SHA 现场重数的声明面
   （1773 = 1771 + pack-always 2，I3e 单列）；missing=0 / extra=0 / 逐文件 sha≠=0，rootSha 记录；
   launcher 部署输入（不在发布面，I8 披露缺口）从**同 commit** `git show` 提取 + 自跑 `--abi-probe`；
   `--dump-config` 证装配树含 team 行 + spill-local + client 行。任一非零 → **拒装**（不写 INSTALLED.json）。
5. **写 `INSTALLED.json`**（`tests/homes/candidate-INSTALLED.json`）：
   `sha` / `lsRemoteMasterAtVerify`（双源）/ `rootSha` / launcher `sha256`+`bytes`+ABI / 安装与记录时间戳 /
   世界与 store 路径 / 宿主 pin；并把被覆盖的旧状态追加进 `candidate-INSTALLED.history.jsonl`（回滚链）。

回执落 `runs/install-<stamp>/`（install-output.log、face-check.json + transcript、dump-config 全文）。
最终安装回执 = `{{INSTALL_RECEIPT}}`。

## 3. 试用步骤

```bash
./try-candidate.sh --dry-run   # 语法+接线+计划（不启动任何东西、不建世界）
./try-candidate.sh --probe     # 最快腿：已装面 boot（boot 行 + 401/303 + --dump-config），预装配冒烟即此
./try-candidate.sh             # 三腿全链 —— 仅终装轮随最终回执跑（见占位 {{TRIAL_RECEIPT}}）
```

三条最小试用链（mock 仅在 LLM 位；世界 `tests/homes/candidate-<mode>-<stamp>`；端口自选+空闲自证；用毕按精确名清理）：

| 腿 | 世界 | 内容 | 判据要点 |
| --- | --- | --- | --- |
| **A 正例链** | `candidate-pos-*` | `team.create` → Leader `team_create_member` → `team_list_members` → `team_delegate`（按实例寻址，async:false，**实例形 `label` 必填**——工具 schema 如此，见未验收面 §C-15）→ 成员受治 `team_bash` 正写 → `team_collect` 读回 | W 腿：本世界重装三零且 rootSha == INSTALLED.json（漂移即红）；L2a/b/c：链在 wire 上逐项成立、写盘真实存在 |
| **B 关断腿** | `candidate-gloff-*` | 逐字节同配置 + `teamToolPlane.globEnabled: false`；成员调 `team_glob` | G0：关断门在**已装 dist 字节**里；G1：挂载不变（`team_glob` 名仍到成员 wire）；G2：落既有 typed 拒形原文（`a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED`，detail 句从已装字节读出比对）；G4：seed 名 0 上 wire（无 fallback） |
| **C 越界负控** | （pos 世界第二腿） | 成员 `team_bash cat ../outside/secret.txt` | L3a：`bash · exit=1` + 内核 `Permission denied` 原文 + meta `exitCode:1`（#336 出口码面）；L3b：外标记**零字节**上 wire + 无取消时 `cancelled:false` |

真人试用：把 `DEEPSEEK_BASE_URL/mock` 换下，`staticModel` 指真实 provider/model（行 config 面见 INSTALL §3.2/§3.5；
本包 `try-candidate-kit.mjs` 的 `rowConfig` 即产品化模板）。**首启 bootPhase 注意**：全新世界用 `create`，
复入已装世界用 `create-or-open`（kit 已分形处理）。

## 4. 回滚步骤

```bash
./rollback-candidate.sh --to-last              # 回到上一 INSTALLED 状态（公开面重装上一记录 SHA，三零重跑）
./rollback-candidate.sh --uninstall            # 完全卸载（按名清理世界/源克隆/锁；状态文件移入证据目录留痕）
./rollback-candidate.sh --uninstall --purge-store   # 连工作区 pnpm store 一并删（仍按精确记录名）
```

- 回退法 = **同一安装命令换 `#<旧全量 SHA>`**（release-candidate-r1 `ROLLBACK-AND-TRIAL.md` §2 先例），
  部署输入（launcher）随同 commit 字节自动跟随；混用会被 `launcherSha256`/trustRoot 双门 fail-closed 拒。
- **删除只认 `candidate-INSTALLED.json` / `.history.jsonl` 记录的精确名**。目录里任何未被记录的
  `candidate-*` 条目只报告、不删除（本仓纪律：gitignore 不能防误删 tracked 文件；宽 glob 清理已三次撞坑）。
- `--to-last` 只有在重装**重新通过三零**后才算完成；重装红 = 什么都不扫。
- 演练记录 = `{{ROLLBACK_REHEARSAL_RECEIPT}}`（终装轮在最终 SHA 上各演一次并回填 runs 路径）。

## 5. 已知限制页（占位引用；逐条含出处，不折叠）

1. **C1 取消腿 = 模型 wire 死亡形（宿主法律，已登记 `CORE_SEAM_BLOCKER`）**。
   `session/cancel`(user 臂) 命中成员在途腿时，执行层/观察层已通，但 wire 落宿主统一 `Error: tool call aborted`
   死亡形，`bash · cancelled` + `"cancelled":true` 不达模型可见面。这不是缺陷而是宿主
   「started outcome → ABORTED 整体替换」法律；插件侧类型化取消事实**无合法公开登记通道**——
   已按固定格式登记：宿主需求条目 + 当前限制条目两条，见
   [../c1-swallow-diag/core-seam-blocker.md](../c1-swallow-diag/core-seam-blocker.md)（CORE PATCH BUDGET = 0，
   不改宿主、不用私有 API、不做文案改写绕行；post-execute 改写路线已被政策否决）。
   装面现状 = a5ie-r5 在册 RED（`c44f51e4`，runs `2026-10-18T20-36-13Z`）。
   **真 RPC 四条件装面复验 = 待填占位 `{{C1_INSTALL_RECEIPT}}`**（四缺一不算过；"换文案"不算修复）。
2. **glob 行 rc-first 判据线 = #343 待合状态占位 `{{PR343_MERGE_STATUS}}`**。
   stderr 非空=walker-error 的**代理判据洞**在 rc-first 判据（步骤 B `178bea59…`，双独审回：A GO / B 投机通过[必办五项在册]）
   经 #343 入头 + 装面复验绿之前**未闭**；stdout 完整性门 `203cac85` 同线。独立关断键本身已由
   glob-off-install 装面验收（四工具矩阵 typed 拒原文 + 零带外 spawn + 无 fallback + 缺省零变化）。
3. **PTC：fs 半臂行已装（#334，boot census 见证行），模型侧提示词工程未接入**——宿主侧强制为真源，
   模型侧不感知 PTC 文案不构成缺陷，也**不得**当已交付宣称。
4. **v4 执行面 = fail-closed 既定延期**（v4 语义不在本候选验收面内）。
5. **native 审批后执行 = 接管形已交付（#329），剩余 = 非接管原生名面**：RC 形下原生 `bash` 派发被
   `request-control` 包络门派发前 fail-closed（r6b M9 第三分支原文）；其余原生保留拼写一律拒
   （`PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`）。
6. **13+2 名钉表语义**：`PLANE_RESERVED_NATIVE` = 宿主 `0.2.0-rc.2@639ed01539` 发布面穷尽表——原始 13 名钉
   +双向漂移机检已落（`c8ad9c4a`）+ 预防保留 2 名（`subagent_codex`/`subagent_claude_code`，含启用/禁用
   翻转漂移测试）；**新增名必须来自真实注册，禁猜名扩表**；宿主基线一动钉测即 RED。最终 SHA 机检绿证 =
   `{{PIN_TABLE_RECEIPT}}`。
7. **披露缺口（非绕过）**：Landlock 预启动器不在发布面（tsc 永不发射 `.py`），安装器以**部署输入**形态
   从同 commit 提供并被 `launcherSha256`/trustRoot 双门钉死（face-check I8/I9）。
8. **`team_delegate` 实例形 `label` 必填**的行文差（工具 schema 与 SKILL 行文不一致，②§C-15 在册）——
   试用脚本文档按 schema 写，不据此推断语义。

## 6. 未验收禁止项（发布/试用中不得越的线）

- **占位未填不得发布**；不得把本包或其中任何"可跑"外观当发布候选宣称。
- 不得用「最新 master」/移动 ref 安装；`CANDIDATE_SHA` 之外的安装对象一律非法。
- **取消腿未验收**：不得在任何回执/文档写"取消端到端已通"；C1 保持 RED 原文在册直至 `{{C1_INSTALL_RECEIPT}}` 四条件齐。
- 不得依赖模型侧 PTC 感知（未接入）；不得声称 v4 执行面可用（延期）；不得给非接管原生名配置期望行为（fail-closed）。
- 不得把 master alpha 线直接推进 `stable`（分支策略红线）；不得移动冻结锚点。
- 不得触 `:3080` 稳定实例及其 DSH_HOME；不得在世界命名/清理上用宽 glob（只按记录名删）。
- 不得 upstream 打补丁 / `pnpm patch` / postinstall 改写宿主（CORE PATCH BUDGET = 0）。
- 假模型（LLM 位 mock）不得作为"真实功能测试"证据；真测须按 INSTALL §4 指真模型。
- 本包脚本自身不 push、不动 master；任何远端写操作在授权记录之外即禁止。

## 7. 预装配轮实录（2026-10-18 装配轮；本包自身的 dry-run + 冒烟 + 回滚演练）

全部 runs 见 `runs/`（脱敏后入库；token 残留 grep = 0）。冒烟用 CANDIDATE_SHA=`52d73534`（装配时点 live tip，**非终值声明**；
**轮内实证 master 已前移至 `708fb3fe…`**——脚本按法拒旧 pin、`CANDIDATE_ALLOW_ANCESTOR=1` 记录通道放行，
`{{FINAL_CANDIDATE_SHA}}` 纪律的现场价值又一例）。

| 实录 | 结果 |
| --- | --- |
| 真装 ×N（`install-candidate.sh`） | 三零 1773/1773（missing=extra=sha≠=0），rootSha `91984080a41ea694…`（与 glob-off 验收轮同面字节形）；launcher `1264ea584e3438d6…`/26992 B，`--abi-probe`=`abi-available/4`；I5 装配树含 team/spill/client 行；`runs/install-*` |
| `--dry-run` ×2 | bash -n×3 + node --check×2 过；计划行（端口 3180/3491 空闲自证、世界按名规划）；D1/D2 PASS |
| `--probe` 最快腿 | **9/9 绿**：boot 标记 + 401/303 token 门 + dump-config 装配树 + boot 日志零错误 + :3080 前后 401→401 + 宿主 porcelain 0；`runs/trial-2026-10-18T22-54-00Z` |
| **事故①（如实）**：`argValue` 不识别 `--legs=<v>` 单 token 形 → 首条 `--probe` 误按默认腿集**实跑了三腿全链** | 结果 **24/24 全绿**（A：create-member→list→delegate(实例形)→collect + bash 正写落盘；B：glob-off typed 拒原文 + seed 0 上 wire；C：越界 exit=1 + 内核拒原文 + 零泄露；W 腿两世界重装 rootSha==INSTALLED；C1 具名扫净）= `runs/trial-2026-10-18T22-51-56Z`（KIT_EXIT=0）。**该全绿不替代终装轮按令重跑的 `{{TRIAL_RECEIPT}}`**；解析缺陷已修（双 token 形均支持）并重跑 probe-only 干净回执 |
| 回滚演练（`{{ROLLBACK_REHEARSAL_RECEIPT}}` 的预装配预演，终值仍待最终 SHA 正式演练） | ①单状态 `--to-last` 正确拒绝（无历史=fail-closed）；②tip 前移拒装（上）；③`--to-last`：重装上一记录 SHA 重过三零→按名扫被替换世界→`foreign=[]`；④`--uninstall`：扫全部记录名（当前+历史 4 世界）→`tests/homes/` 零 `candidate-*` 残留，状态文件移 `runs/rollback-2026-10-18T22-57-23Z/` 留痕，store 按精确名留给处置。演练中修两处：history pretty-JSON 尾空行解析、recorded-set 须含重装后的新世界（`foreign` 与 `leftButRecorded` 分列可见） |

残留足迹（供清理对照）：本 worktree `.worktrees/a5-candidate-pkg`（本分支）+ `.pnpm-store-candidate`（工作区 pnpm store；预装配轮收尾已按精确名删除，终装轮自会重热）+ 上列 `runs/` 证据。稳定 `:3080` 全程只读 401，其 DSH_HOME 未触；宿主 `tests/deepseek-harness-test-use` 跑前/跑后 porcelain 均 0。
