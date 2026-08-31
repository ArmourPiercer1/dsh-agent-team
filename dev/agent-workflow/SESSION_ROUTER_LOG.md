# SESSION_ROUTER_LOG — Team vNext 无人值守执行日志（只追加）

> 协议：`docs/ROUTER_RULES.md` §7。本日志只追加；随每轮工作落盘提交。

## 执行启动（2026-08-29）

- **模型路由核验**（ROUTER_RULES §1.4）：当前会话主代理运行于 `qiyuan-self/qwen3.8-27b`（系统运行时声明 "coding agent powered by the qwen3.8-27b model"）。结论：**PASS**，开始执行。
- **审计基线**：
  - upstream `deepseek-ai/deepseek-harness` master = `cd5ef8148158c3a752a658978873241fdf8e2bbc`
  - legacy fork `feat/team-vnext-integration-20260829` @ `references/deepseek-harness` = `a3ab31992762c5d6560797eabc7e0885a9320ade`（ahead 39 commits / 470 changed files）
- **用户裁决记录**（2026-08-29）：
  1. ROUTER_RULES 改写对齐 20260829 计划（G0–G10）后继续作无人值守协议；
  2. 命名以 `dsh-agent-team` 与 `deepseek-harness-fork/` 为准，不改文档；
  3. fork 侧旧执行日志（SESSION_ROUTER_LOG 旧版、WAVE2/S0 记录）留在原处不动。
- **环境修复记录**（P0 前置，已验证）：
  - 新仓库 origin 由 HTTPS 切换为 `git@github.com:ArmourPiercer1/dsh-agent-team.git`（HTTPS 无凭据，SSH key 认证通过）；
  - 仓库本地 `core.sshCommand = C:/WINDOWS/System32/OpenSSH/ssh.exe`（正斜杠；沙箱禁止命名管道导致 Git 自带 ssh/sh 无法启动，系统原生 ssh 正常）；
  - 验证 commit `8e19844` 推送成功，远端 `refs/heads/master` 与本地一致。

## 任务记录

### 轮次 R1：P0 执行 + 集成（2026-08-29）

- **执行方式**：workflow 工具 4 个并行子代理，全部 `provider: qiyuan-self / model: qwen3.8-27b`；每任务独立 worktree（`.worktrees/P0-Tx`）、独立分支、1 次执行即 SELF_VERIFIED，无返工。
- **P0-T1 legacy-freeze**（class C）：分支 `task/P0-T1-legacy-freeze` @ `616600c`；交付 `dev/agent-workflow/evidence/P0-T1/freeze-note.md`；在 `references/deepseek-harness` 打 annotated tag `legacy-agent-team-pre-vnext` @ LEGACY_SHA `a3ab319927` 并推送 fork remote（用户裁决 3 许可的一次性推送）。**SELF_VERIFIED**。
- **P0-T2 commit-provenance**（class B）：分支 `task/P0-T2-commit-provenance` @ `6d77938`；交付 `evidence/provenance/commit-manifest.json`（39 ahead commits：TEAM_OWNED 20 / MIXED 13 / GENERIC_FORK_CAPABILITY 2 / UNRELATED_FORK_FEATURE 3 / GENERATED_FROM_TEAM 1）+ 验证报告 + `validate-commit-manifest.ps1`。**SELF_VERIFIED**。
  - 集成期诊断备注：早前会话中 pwsh `ConvertFrom-Json` 对 commit-manifest.json 报 char 1017 解析失败，判定为控制台/编码显示伪影。本轮三方核验：文件无 BOM（首字节 `7B 0A`）、node `JSON.parse` 通过（39 commits）、pwsh `ConvertFrom-Json` 通过、worker 自带 `validate-commit-manifest.ps1` exit 0 且 SHA 集合与 git log 一致。结论：manifest 有效，无需修订。
- **P0-T3 file-provenance**（class A）：分支 `task/P0-T3-file-provenance` @ `58f8985`；交付 `evidence/provenance/file-manifest.json`（470 文件：TEAM_OWNED 315 / GENERIC_FORK_CAPABILITY 70 / GENERATED_FROM_TEAM 64 / UNRELATED_FORK_FEATURE 10 / MIXED 11；处置 SPLIT 136 / REFERENCE_ONLY 133 / REPLACE 49 / GENERATED_REVERT 64 / KEEP 44 / MIGRATE 25 / DELETE 19；11 个 MIXED 均带 mixed_hunks）+ `mixed-hunk-report.md` + 验证 + `validate-file-manifest.ps1`。**SELF_VERIFIED**。
- **P0-T4 behavior-inventory**（class A）：分支 `task/P0-T4-behavior-inventory` @ `b58dcb4`；交付 `docs/migration/legacy-behavior-inventory.md`（11 行为域）+ `docs/migration/reuse-map.md` + 验证材料。**SELF_VERIFIED**。携带发现：TeamMarker "1 event = 1 Chat row" 语义弃用（仅 REFERENCE_ONLY）；`resolveTeamView` 存在双副本需去重；`formatTeamDuration` 硬编码中文（i18n 缺陷，移植时修复）；`known-event-types` 含 4 个疑似未用的 `team/*` 词表条目待净化。
- **集成（主 Agent）**：`git checkout -b int/P0-freeze-provenance master(5ecf11d)`；按 T1→T2→T3→T4 顺序 `cherry-pick -x` 四笔任务提交，无冲突；int head = `1c4f2435b0e1e7e233fc5c384d112ed9fd874d5f`。cherry-pick 后 SHA 映射：T1 `ce86d21` / T2 `a9e6f3e` / T3 `9671a54` / T4 `1c4f243`。graph.yaml 已更新（4 任务 INTEGRATION_READY，G0-REVIEW READY）。

### 轮次 R2：G0 Gate 裁决 + 合入 + 进入 P1（2026-08-29）

- 见下方 Gate 记录（G0-REVIEW round 1 PASS 3/3）。
- **P1 环境预检（主 Agent）**：node v24.20.0 / pnpm 11.7.0 / npm 11.19.0；npm registry HTTP 200 可达；legacy checkout 无 node_modules（host worktree 需 `pnpm install`）；pnpm store 解析为 workspace-local `.pnpm-store`（已加入 .gitignore）；DSH 现有安装（`D:\deepseek-harness\`，35 个顶层 node_modules，packageManager pnpm@11.7.0、engines node ^22.19||>=24）证明本机 install 可行；D 盘剩余空间在沙箱内不可查询（WMI/fsutil 均被拒），若 install 因空间失败按 TEST_INFRA_BLOCKER 处理。

## Gate 记录

### G0-REVIEW round 1 — PASS（2026-08-29）

- **方式**：workflow 工具 3 个独立并行 reviewer（G0-R1/R2/R3），全部 `qiyuan-self/qwen3.8-27b`，无会话继承、互不可见；brief 仅含 G0 判据（DevPlan §12.3 六条）+ 冻结文档段落（DevPlan §12、TaskDoc §11.1）+ 审查范围 + 复现命令（V1–V9），不含任何先前轮次意见；禁止读 ROUTER_RULES / SESSION_ROUTER_LOG / graph.yaml。
- **审查范围**：`5ecf11d..2dadcb0`（任务内容 `5ecf11d..1c4f243`，`2dadcb0` 为编排状态元数据）。
- **裁决**：**通过 / 通过 / 通过**（3/3，gate_passed=true）。六条判据全部 PASS；V1–V9 每条均由 reviewer 亲自执行（tag/SHA 核验、legacy clean 核验、两个校验脚本重跑 exit 0、diff-set 39/470 双向差集为空、MIXED 抽样逐 hunk 交叉核对、tag message no-vNext 标记、11 行为域覆盖、node JSON.parse 独立验证、owned-boundary 12 路径全落在 evidence/+docs/migration/ 下）。
- **补充内容（随 通过 裁决，非阻塞，已记录）**：
  - S1（G0-R1）：file-manifest.json 的 baseline.legacy_checkout / diff_command 记录的是迁移前路径 `D:\AgentDev\deepseek-harness`，当前 legacy 检出位于 `references\deepseek-harness`；对象全 SHA 锚定，从当前路径重推导 100% 吻合（470/470 差集为空），不影响正确性；后续重跑脚本前先对齐路径即可。
  - S2（G0-R1）：freeze-note.md L29 声称 tag object 与远端一致（`ls-remote --tags origin` 返回同一 SHA）。该声明为 P0-T1 执行期联网核验记录，沙箱离线不可重验；主 Agent 确认该一次性推送在 P0-T1 轮次实际发生（用户裁决 3 许可）。无需行动，留档。
  - R2/R3 全文存于 workflow 运行记录（本次轮次工具返回）；两者裁决均为 通过，无阻塞项。
- **Gate 后动作**：`int/P0-freeze-provenance` fast-forward 合入 master（5ecf11d..2dadcb0），已推送 origin（远端 master = 2dadcb0）；P0 四个 worktree 已清理（P0-T3 因 untracked .scratch/ 中间产物使用 --force 移除，产物为 worker 临时 dump，无未提交任务内容）；P0 task 分支保留（历史留痕）。

## 投机通过风险台账

（空）

## 补充记录

- G0-REVIEW round 1：G0-R1 随 通过 裁决附 2 条非阻塞补充（S1 manifest baseline 旧路径；S2 freeze-note ls-remote 离线不可重验声明）。全文见 Gate 记录 G0 条目。

### 轮次 R3：P1-B1 集成 + 测试实例搭建 + 权限模式实测（2026-08-29）

- **P1 集成（主 Agent）**：`int/P1-host-foundation` @ master `9267522`（docs commit）；`cherry-pick -x` 顺序 T1 `24dd3d74`→T2 `c98a0649`→T3 `473f65f9`→T4 `7d491b17`，**零冲突**（提前把预存在的 npm-init 占位根 package.json 移出工作树至 `.worktrees/package.json.pre-T4-scratch`；`.gitignore` 为两侧并集，T4 已正确处理）。int head（集成后）`932edb1c`。
- **downstream 集成**：`host/downstream-int-20260829` = `host/downstream-clean-20260829`（57fa482f）⊕ merge `host/unrelated-features-20260829`（74ac91e5）→ `02f3094c`，file-disjoint 两 lane 合并干净。
- **用户裁决（第三次）**：测试 DSH_HOME 改为工作区内 `references/.dsh-test`（原因：workspace-write 下工作区外写入被拒；"替我审批"自动批准实测不生效——升级请求仍到达用户并被拒一次；此后不再发起升级请求）。端口/源码不变。AGENTS.md + TEST_METHODS.md（§1/§2/§4/§5 新增/§6 裁决历史）已更新。
- **测试实例搭建（全部 workspace-write，零批准）**：install `--ignore-scripts` PASS（1011 包）；build 绕行链 = `node scripts/build.ts`（v24 原生 type-stripping 绕开 tsx）+ `DSH_CLIENT_COMMIT_HASH=cd5ef814`（跳过 build 内 git spawn）→ **build:lib PASS**（50 个 lib/client.js + apps/cli/lib/bin.js）；`build:web` FAIL（vite→esbuild service spawn EPERM，沙箱全模式不可行；前端 bundle 缺失仅影响浏览器页面，**非 G1 判据**，DevPlan §13.6 冻结文本已核对）。启动 `node apps/cli/lib/bin.js web --port 3180 --no-open` **PASS**：boot URL 行出现、无 token GET 401（token 鉴权门）、DSH_HOME 初始化完整（profiles/web 公开 seam 文件就位）；稳定实例 :3080 全程 200 未触碰。验证后实例已停止，端口释放（P1-T5 worker 自行管理生命周期）。
- **证据**：`dev/agent-workflow/evidence/test-infra/setup-20260829.md`（权限探测矩阵、绕行链、执行记录、验证输出、public seam 记录）。
- **graph**：P1-T1..T4 → INTEGRATED（head_shas 已录），P1-T5 → READY；`integration_sha: 932edb1c`。

### 轮次 R4：P1-T5 执行 + 集成（2026-08-29）

- **执行方式**：workflow 工具 1 个 worker，`qiyuan-self/qwen3.8-27b`；worktree `.worktrees/P1-T5`、分支 `task/P1-T5-zero-core`（基于 `957cce6c`）；执行 1/3，**SELF_VERIFIED**。
- **交付**：
  - `scripts/verify-zero-core.mjs` —— zero-core 改写扫描器（plain node、**零子进程**、对 host 树只读）：C1a/C1b patch-package（lifecycle 引用 + 指向 host 自身 workspace 包的 patches/ 文件）、C2 pnpm.patchedDependencies、C3 写文件 lifecycle 脚本（pnpm patch / git apply|am / sed / perl / patch -x / Node fs 写 API 标记）、C4a 相对 import 逃出插件根进入 host 树、C4b bare import 子路径不在 host 包 exports 白名单（白名单由先读 host 树全部非 node_modules package.json 构建）、C4c 未解析 @deepseek-ai/* 、C5 git 快照文件存在且 trim-空；**校准**：upstream 自身第三方依赖补丁（node-pty）报 INFO 而非 finding（"改写 upstream 源码" 的定义 = 补丁目标属于 host 自身 workspace 包）。
  - `scripts/fixtures/zero-core/` 负例（每违规类型一个样本 + 第三方校准样本 + good-plugin）；scanner 自检全部命中并逐条命名（fixture-selfcheck.json）。
  - `scripts/run-tests.mjs` / `run-tests-hooks.mjs` / `test-vitest-shim.mjs` —— plain-node vitest 等价测试跑手：18/18 PASS（`pnpm test` 因 vitest→vite→esbuild spawn 在沙箱 EPERM，D-05 记录精确栈 `Error: spawn EPERM ... optimizeSafeRealPathSync`）。
- **双侧 smoke**：
  - **Pristine upstream**（`references/deepseek-harness-test-use` @ cd5ef814）：before 快照空 → 启动成功行 → 经公开 seam `references/.dsh-test/profiles/web/cordis.patch.yml`（insert 块，file:/// 两行 host+client 插件）挂载 → dump-config 证明两行进入 composed entry list → 启动成功（`assertEntriesActivated` 在任一 entry import/activation 失败时拒绝启动，成功行 = 机器级加载证明）→ **负例对照**：行指向不存在模块 → 启动大声失败 exit 1 `ERR_MODULE_NOT_FOUND`（非空洞证明）→ 恢复行 → 停止 → after 快照 status/diff 0 字节、HEAD 不变 → scanner exit 0（0 findings / 2 INFO）。
  - **Downstream**（`.worktrees/P1-int-downstream` @ 02f3094c）：同链（独立 DSH_HOME `references/.dsh-test-downstream`，profile 路径改写为 downstream 树）→ 同结论；该树 status --porcelain 空（node_modules/lib/.dsh-build 均为 ignored）。
- **骨架独立构建**：`pnpm install --ignore-scripts` ✓ → `pnpm -r run build` EPERM（pnpm 本体是 node 发起 piped-spawn，矩阵 (b) 推论，与 vitest 同因）→ 每包直接 tsc → **ALL 9 PACKAGES BUILT GREEN**（legacy 为有意空参考槽，无 build script）→ eslint 直接跑全绿 → `composition-smoke`（node scripts/composition-smoke.mjs）绿 → vitest EPERM（已记录）→ run-tests 18/18 PASS + 负例对照。
- **主 Agent 独立复核**：test-use `git status --porcelain` 空 + `git diff` 空；downstream-int status 空；端口 3180 已释放；证据文件清单与分支内容一致；dump-config-after-mount / negative-control / vitest 栈抽查与报告一致。
- **集成**：`cherry-pick -x 21f4d45 f718b47` → int `5bac15f` + `384a645d`，零冲突。
- **Profile 状态**：`references/.dsh-test/profiles/web/cordis.patch.yml` 保留两挂载行（带 revert 注释，供 G1-REVIEW 复用；downstream 侧在 `.dsh-test-downstream`）。
- **graph**：P1-T5 → INTEGRATED（head `f718b47e`，attempts 1）；G1-REVIEW → READY；`integration_sha: 384a645d`。

### G1-REVIEW round 1 — PASS（2026-08-29/30）

- **方式**：workflow 工具 3 个独立并行 reviewer（G1-R1/R2/R3），全部 `qiyuan-self/qwen3.8-27b`，无会话继承、互不可见；brief 仅含 G1 判据（DevPlan §13.6 七条）、冻结文档段落（TaskDoc §11）、审查范围 + 复现清单 V1–V12、沙箱约束与启动绕行链；盲审（禁读 SESSION_ROUTER_LOG / graph.yaml / evidence/，唯一例外为 G0 已批准的 provenance 清单 file-manifest.json；禁止引用彼此结论）。
- **资源隔离**：每 reviewer 独立 detached worktree（.worktrees/G1-R{1,2,3} @ 384a645d）、独立端口（3181–3183 / 3191–3193）、独立 DSH_HOME（references/.dsh-test-g1r{1,2,3}[-downstream]）；共享 .dsh-test / .dsh-test-downstream 与 test-use / downstream 树只读。
- **裁决**：**通过 / 通过 / 通过**（3/3，gate_passed=true）。G1-R1 = 通过（G1-R1-SUMMARY.log 存 7/7 PASS + Verdict 全文）；G1-R3 = 通过（workflow 记录尾注）；G1-R2 ∈ {通过, 投机通过}（workflow 聚合 gate_passed=true 判定；原文存 workflow 运行记录）。七条判据均由三位 reviewer 各自独立机器级复现（V1–V12 日志存 evidence/G1-REVIEW/G1-R*/）：
  - G1-1 独立 Git 仓库：独立 remote、无 .gitmodules、无任何指向 legacy fork 的 remote；嵌套 legacy 仓库 untracked（非 submodule）。
  - G1-2 legacy 分支非依赖：packages/ 与 scripts/ 内对 a3ab319927 / packages/team / legacy 路径零引用；packages/legacy 为空槽（package.json+README，无 src）。
  - G1-3 骨架独立构建：pnpm install --ignore-scripts → 每包直接 tsc 全绿（8 包 + legacy 空槽）→ eslint 全绿 → composition-smoke 绿 → 18/18 测试（plain-node vitest 等价跑手，reviewer 独立审计其等价性）；vitest EPERM 记录为环境限制。
  - G1-4 插件与 pristine upstream 组合：公开 seam 挂载（cordis.patch.yml 两行 file:///）→ dump-config 两行在 composed entry list → boot 成功（assertEntriesActivated 使 entry 激活失败即拒绝启动）→ **负例对照**（行指向不存在模块 → boot 大声失败 exit 1）证明非空洞。
  - G1-5 测试后 pristine upstream byte/source clean：before/after `git status --porcelain` 与 `git diff` 均空、HEAD = cd5ef814 不变。
  - G1-6 downstream host 无 Team-required patch：scanner 对 downstream-int @ 02f3094c exit 0；V11 blob 级对照：10/10 UNRELATED + 70/70 GENERIC byte-identical，11 个 MIXED 文件 SPLIT 正确（非 Team hunk 在位、全部 Team hunk 缺席）。
  - G1-7 unrelated fork 特性按 provenance 保留：按 file-manifest.json，downstream 相对 upstream 基点的 diff 仅含非 Team fork hunk、无 Team-owned hunk；≥3 个 UNRELATED 文件内容抽查在位。
- **Gate 后动作**：`int/P1-host-foundation` ff 合入 master（`9267522..ac2be32`）；push origin（远端 master = ac2be32，2dadcb0 以来首次推送）；G1 reviewer 证据入库（dev/agent-workflow/evidence/G1-REVIEW/G1-R{1,2,3}/，共 154 文件）；3 个 reviewer worktree 已 prune；g1r DSH_HOME 实例已删（可再生产物）；共享基线实例 .dsh-test / .dsh-test-downstream 保留（cordis.patch.yml 挂载行带 revert 注释）；P1 task 分支保留（历史痕迹）。
- **环境新发现（留档）**：`docs/plans/active/` 四份冻结文档在文件系统层出现间歇性读取失败（listing 正常、open 偶发 ENOENT，亚秒级 flapping）；绕行 = 镜像复制到 `references/.scratch-freedocs/`（gitignored）后从副本读取；不影响冻结文档内容，后续 Phase 的 reviewer/worker 若遇同样现象按此绕行（已写入各 brief）。

### 轮次 R5：G1 合并 + push + P2 启动（2026-08-30）

- **Gate**：G1 PASS（见上）→ int 合入 master 并 push（远端 master = ac2be32）。
- **P2 启动**：TaskDoc §11.3 已读（P2 — Public Seam Characterization；依赖图 P2-T1 → {T2||T3||T4||T5} → T6 → G2）；`int/P2-seam-characterization` 自 master @ ac2be32 创建；P2-T1 worktree/分支已建，worker 已派发（qiyuan-self/qwen3.8-27b）。
- **graph**：current_phase P2；G1-REVIEW → PASSED（verdicts 已录）；P2-T1 → READY；P2-T2..T6、G2-REVIEW → DEFINED。

### 轮次 R6：P2-T1 执行 + 集成（2026-08-30）

- **执行方式**：workflow 工具 1 个 worker，`qiyuan-self/qwen3.8-27b`；worktree `.worktrees/P2-T1`、分支 `task/P2-T1-char-harness`（基于 `cc6199b`）；执行 1/3，**SELF_VERIFIED**（head `1f06ff3`，3 commits：309e062 harness / a7414ba CI / 1f06ff3 evidence）。
- **交付**：
  - `tests/characterization/` —— pristine characterization harness：`run.mjs` 单命令入口（self-test + 实例生命周期 + 负例 + 字节清洁断言）；`lib/{harness-core,instance,public-surface,private-import,fixture,tree-clean,util}.mjs` 共享库；`fixtures/host-version.json` 固定 UPSTREAM_SHA=cd5ef814 + public surface 指纹（272 packages，v0.1.2-alpha.1）；`probes/smoke/` 演示组（good-host 公开 import 启动 / bad-host private-import 运行时拒绝 ERR_PACKAGE_PATH_NOT_EXPORTED + 机器可读归因 / 恢复 / 停止 / 端口释放）；junction farm `probes/node_modules`（gitignored、幂等重建）为 probe bare-import 唯一运行时管线。
  - `.github/workflows/characterization.yml` —— CI job（`node tests/characterization/run.mjs`；本环境未执行，留 CI）。
  - `dev/agent-workflow/evidence/P2-T1/` —— compliance-report.md（§1 目标/owned-path/复用合规；§8 KNOWN LIMITATIONS 逐条带 G2 状态；§9 发现并修复的 9 个 harness bug）+ dryrun/zero-core 自检日志。
- **主 Agent 独立审计（全部通过）**：
  - owned-path：全部改动文件均在 `tests/characterization/**`、`.github/workflows/**`、`dev/agent-workflow/evidence/P2-T1/**` ✓
  - test-use @ cd5ef814 byte-clean（status/diff 空、HEAD 不变）✓
  - 独立重跑 `node tests/characterization/run.mjs`（`.worktrees/P2-T1` 内）：EXIT=0 / 40s / 全节绿（实例 3281 启动、good 行公开 import 启动、bad 行运行时拒绝+归因、恢复启动、停止、端口释放、运行后 byte-clean、HEAD 不变）；`router-rerun.log` 归档 ✓
  - compliance-report §1.1 目标 / §1.2 owned-path / §1.3 复用 P1-T5 zero-core 扫描器 均合规 ✓
- **集成**：cherry-pick -x 三 commit → `int/P2-seam-characterization` @ `10ce2fc`（5e306c1 / 77b1965 / 10ce2fc）；graph：P2-T1 → INTEGRATED（base cc6199b、head 1f06ff3、attempts 1），integration_sha = `10ce2fc`，ready → [P2-T2, P2-T3, P2-T4, P2-T5]。
- **下一步**：workflow 并行拉起 P2-T2..T5（4 worker，`qiyuan-self/qwen3.8-27b`；各自独立 worktree/分支/端口/DSH_HOME；base = `10ce2fc`，复用 P2-T1 harness lib；完成后 P2-T6 → G2-REVIEW）。

### 轮次 R7：P2-T2..T5 并行执行 + 集成（2026-08-30）

- **执行方式**：workflow 工具 4 worker 并行，全部 `qiyuan-self/qwen3.8-27b`；base = `45a8f38a`（int/P2 T1 集成后）；独立 worktree/分支/端口/DSH_HOME：
  - P2-T2 `.worktrees/P2-T2` / task/P2-T2-agent-lifecycle @ `380a8969`，端口 3381/3391，DSH_HOME `.dsh-test-p2t2` — SELF_VERIFIED，attempts 1
  - P2-T3 `.worktrees/P2-T3` / task/P2-T3-preset-persona-model @ `681199ca`，端口 3382/3392，DSH_HOME `.dsh-test-p2t3` — SELF_VERIFIED，attempts 2（attempt 1 失败：踩中 P2-T1 harness 潜在缺陷，见"集成修复"）
  - P2-T4 `.worktrees/P2-T4` / task/P2-T4-capabilities @ `e1916b25`，端口 3383/3393，DSH_HOME `.dsh-test-p2t4` — SELF_VERIFIED，attempts 2（attempt 1 RED：payload 重复声明 SyntaxError；debug 跑不计 attempt）
  - P2-T5 `.worktrees/P2-T5` / task/P2-T5-storage-fork-descendants @ `c8dfc74e`，端口 3384/3394，DSH_HOME `.dsh-test-p2t5` — SELF_VERIFIED，attempts 3（attempt 1 run-log 截断异常、attempt 2 `ctx.get('sessionQuery')` late registration → payload 有界等待循环）
- **Seam 结果（零 CORE_SEAM_BLOCKER，全 PASS）**：
  - T2 4/4：fresh create / member resume（`rootLive=false` 时 sidecar-only 恢复）/ root cold binding（marker round-trip、source=resume）/ ordering trace（14/14 valid，子序列 6/6 + 5/5）；负例：late-binding 拒绝（P2T2_ROOT_BINDING_MISSING）、读侧词汇白名单拒绝 custom event。行为发现：awaited session/flush 非 durable publication barrier（200 ms write-behind）→ 记为 known limitation + upstream generic-seam 提案（sidecar durable-on-resolve 契约不受影响，不发 blocker）。
  - T3 6/6：preset standing composition / persona scope（零跨 scope 泄漏）/ complete:true 可检测可阻断（1A 决策，seam-report 引冻结 Architecture 文档原文为据）/ ModelSelection future boundary / preset switch lock / cold resume。
  - T4 20/20 矩阵（pre-step / pre-execute / tool visibility / skills / MCP × creation / cold resume / tighten / disappear）；skills 与 MCP 独立判定，无 private registry。
  - T5 3/3：external persistence（byte-equal + 跨 DSH_HOME 隔离负例）/ fork lineage 可见性（root/member fixture + lineage JSON）/ descendant enumeration/interrupt/drain（完备性 + 中断生效 + unknown id 大声失败）。
- **主 Agent 独立审计（全部通过）**：
  - owned-path：62 / 49 / 37 / 135 文件，全部在各自 probe 组目录 + evidence 目录内，零越界；4 个 worktree 状态干净。
  - 独立重跑（各任务 worktree + 各任务端口/DSH_HOME）：T2 48s / T3 44s / T4 44s / T5 50s，均 EXIT=0、全节绿、byte-clean、HEAD 不变；`router-rerun.log` 归档各任务 evidence。
  - T3 重跑副作用：probe 组重写自身 observations/ 证据 JSON（设计行为）；重跑后已把 T3 worktree 恢复到 worker canonical 版本。
- **集成**：cherry-pick -x 8 commit 至 int/P2；随后裸命令整合验证（Quickstart/CI 契约）发现 **2 个跨任务集成缺陷**，主 Agent 修复：
  1. T2/T5 组硬依赖 `--report-dir`，裸 `node tests/characterization/run.mjs`（README Quickstart + CI job）整合后 FAIL → 两组 reportDir 为 null 时 fallback 到 `<DSH_HOME>/characterization-obs`（commit `2679316`）；同 commit 将 `tests/characterization/.run-logs/`（T4 组裸跑默认观察目录，每次运行可变）加入 .gitignore。
  2. P2-T1 潜在缺陷：`lib/instance.mjs` `resetPatchLayer(header)` 把数组直接传给 `writeFileSync` 必抛 TypeError（README 承诺的 `ctx.instance` 契约；T3 attempt 1 暴露，T3 当时经 `patchFile` getter 做字节等价的 revert 绕过并在代码中留 NOTE）→ 写入前 `join('\n')`（commit `4f70960`）；T6 及后续组可直接使用文档 API。
  - 修复后裸命令整合验证全绿：5 个 probe group（agent-lifecycle / capabilities / preset-persona-model / smoke / storage-fork-descendants）+ 7 节，EXIT=0 / 64s，byte-clean（`evidence/P2/integrated-rerun.log`）。
- **Graph**：P2-T2..T5 → INTEGRATED（attempts 1/2/2/3），integration_sha = `4f709608c2e810e617732bf454d543c24888c15d`，ready → [P2-T6]。
- **下一步**：P2-T6（remote/client/additive UI seams + seam manifest 汇总 + G2 audit 前置）→ G2-REVIEW（3 名盲审）。

### 轮次 R8：P2-T6 执行 + 集成 + 主 Agent 独立复验（2026-08-30）

- **执行方式**：workflow 工具 1 个 worker，`qiyuan-self/qwen3.8-27b`；worktree `.worktrees/P2-T6`、分支 `task/P2-T6-remote-client`（基于 `484e735`）；端口 3401/3411、DSH_HOME `references/.dsh-test-p2t6`；执行 1/3，**SELF_VERIFIED**（head `d66f6eb`，2 commits：5cb406c probe 组 / d66f6eb 证据 + 3 报告），零 CORE_SEAM_BLOCKER。
- **交付**（owned-path 审计 119 文件 / 0 越界）：
  - `tests/characterization/probes/remote-client/` — remote/client/additive-UI seam probe 组：B1 discovery（26 remote client 行；registry 读嵌套 `pkg.dsh.client`，flat `"dsh.client"` key 被静默忽略 → quirk L6-4）/ B2 RPC + reconnect R1–R5（子进程崩溃后行自动重连）/ B3 missing-bundle 负例 boot / B4 malformed-decl 负例 boot（均 `ClientPackageCompositionError` + 子进程 exit 1，fail-loud-at-boot 契约，dump-config 留存）/ B5 slot seats（TEAM_VIEW_SLOT + NEW_TEAM_ENTRY 架构关键；INPUT_DOCK 非关键 frozen fallback seat `conversation.input.dock`）。
  - `tests/characterization/seam-manifest/manifest.json` — 26 行全 verdict PASS（5 行 architecture-critical：CLIENT_MODULE / TEAM_REMOTE×2 / TEAM_VIEW_SLOT / NEW_TEAM_ENTRY）+ 24 knownLimitations（每条 status + evidence）；组内 7 校验规则（rows≥15 / critical-rows≥4 / evidence 存在 / critical-executable / verdicts 一致 / zero-private-imports（扫描 27 文件，2 处命中均在指定 negative-fixture 区）/ limitations 完备）canonical run 全 PASS（`run/logs/obs/seam-manifest-validation.json`）。
  - `dev/agent-workflow/evidence/P2-T6/` — seam-report.md（8/8 seams PASS）/ compliance-report.md（attempt ledger：D1/D2 debug 不计，C1 canonical PASS 21:37:44→21:39:11Z，C2 裸命令契约跑）/ g2-pre-audit.md（DevPlan §15.4 六判据 6/6，criterion 原文逐字引自冻结文档）/ debug-b1/ / run/ canonical 工件。
- **主 Agent 独立审计（全部通过）**：
  - owned-path：119 文件（evidence 104 / probe 组 14 / manifest 1）全部在 owned paths，0 越界；任务 worktree 干净。
  - 三份报告全文通读 + manifest 结构机器核验（26 行 / 24 limitations / 5 critical 行均带 evidence 路径）。
  - 独立重跑暴露 **2 个真实缺陷**（均在 int/P2 上以主 Agent post-integration commit 修复）：
    1. **相对路径分歧（9 项失败）**：主 Agent 以相对 `--report-dir` 重跑 → payload 实例子进程 cwd = 固定树（lib/instance.mjs `cwd: hostTree`），相对 env/directive/scratch-DSH_HOME 把观察文件与空 home（含 node_modules farm）写入 pristine 树，而组代码从调用根读取 → T2 readObs ENOENT ×5 + T6 B1/B2/B5 激活超时 ×3 + byte-clean 违规 ×1（`router-rerun.log`）。清理全部污染目录（含首次中止调用残留的 main-repo 空目录）。中心修复：`resolveConfig` 强制 `hostTree`/`dshHome`/`reportDir` 绝对化（commit `870abc7`）+ README 记契约（相对输入在调用根解析后才跨进程边界）。
    2. **T3 seed→resume flake（2/2 复现）**：boot 2 冷恢复 `SessionPersistenceNotFoundError` — 磁盘证据：失败 seed 会话仅留 `session.jsonl.zstd.<hex>.tmp`（write-behind staging），成功会话有最终 `.zstd`；awaited `session/flush` 非 durable publication barrier（~200 ms write-behind，known-limitation 类 L2-1/L2-2；T2 组有 waitForDurable，T3 缺）（`fix-verify-relative-paths{,-2}.log`）。修复：T3 main.js 移植 durability gate（commit `7e7560d`）：`diskFilesFor` + `waitForDurable(sessionId, 30s)`（50 ms 轮询最终 `.zstd`），done-main.completed 反映 seed 成败，失败时 resume-seed.json 携带最后磁盘态、可归因。后续：`7e7560d` 漏 `readdirSync/statSync` import（运行期 `readdirSync is not defined`，由新增可归因失败路径精确捕获 — `fix-verify-3.log`）→ 补 import（commit `00c7e99`，node --check 通过）。
- **修复后验证矩阵**：

  | 场景 | 日志 | 结果 |
  | --- | --- | --- |
  | 绝对路径重跑（870abc7 后） | `router-rerun2.log` | EXIT=0 全绿 byte-clean |
  | 裸命令整合（CI 契约） | `integrated-bare-run.log` | EXIT=0（5 probe 组 + 7 节） |
  | 相对路径（修复前基线） | `fix-verify-relative-paths{,-2}.log` | 2/2 RED（T3 flake；9 失败根因已由 870abc7 消除） |
  | 相对路径（修复后第 1 次） | `fix-verify-4.log` | EXIT=0 全绿 byte-clean（T3 seed→resume 11/11 PASS） |
  | 相对路径（修复后第 2 次，flake 置信） | `fix-verify-5.log` | EXIT=0 全绿 byte-clean |
- **说明**：
  - T6 的 g2-pre-audit 早于上述两项主 Agent 修复；修复为 additive robustness（路径绝对化 + T3 durability gate），修复后全场景重跑均绿，审计结论不受影响。
  - T6 attempt 数按 worker ledger = 1（D1/D2 debug 与 C2 裸命令契约跑在 compliance report 单独入账；主 Agent 重跑属审计，不计 attempt）。
  - 卫生清理：`.dsh-test-p2t6/sessions/` 累积 140 个陈旧 probe 会话目录（p2t2-/p2t3-/p2t4-/p2t5- 前缀，跨 3 个 project-hash 目录；含 9 失败事件期间以固定树为 project 根的产物）→ 清理，仅保留 5 个 `11111111-*` fixture 会话（145→5）；套件重跑可再创建，无判据依赖。
- **Graph**：P2-T6 → INTEGRATED（base `484e735`、head `d66f6eb`、attempts 1）；integration_sha = `00c7e99fde5da36b0e0f1e3250173d47fdcc4d7b`（bookkeeping 前 int head）；ready → [G2-REVIEW]。
- **下一步**：G2-REVIEW — workflow 3 个 fresh 独立盲审（`qiyuan-self/qwen3.8-27b`）；各自 detached worktree @ integration SHA、端口 3481–3483/3491–3493、DSH_HOME `references/.dsh-test-g2r{1,2,3}`；盲审（禁读 SESSION_ROUTER_LOG / graph.yaml / evidence/，唯一例外 `dev/agent-workflow/evidence/provenance/file-manifest.json`）；brief 含 must-reads + 沙箱矩阵 + never-escalate + 冻结文档 flapping 绕行 + TaskDoc §11.3 “G2 Gate 执行方法”逐字 + DevPlan §15.4 六判据逐字 + 沙箱内复现清单（--dsh-home/--report-dir 用绝对路径）。

### 轮次 R9：G2-REVIEW 通过（3/3）+ P2 合并 master 并推送（push #2）+ P3 启动准备（2026-08-30）

- **G2 执行方式**：workflow `g2-review-p2-seam-characterization`；3 个 fresh 独立盲审 reviewer，全部 `qiyuan-self/qwen3.8-27b`（leaf agent，不拉子代理）；审查对象 = int/P2 集成 head `00c7e99`（审查范围 cc6199b..00c7e99 = 20 commits / 466 files：tests/characterization 42 + dev/agent-workflow 422 + .github/workflows 1 + .gitignore 1；packages/references/docs/apps/scripts 下 **零文件**）。
- **隔离**：每 reviewer 独立 detached worktree @ `00c7e99`（`.worktrees/G2-R{1,2,3}`，审毕移除）、独立端口 3481–3483 / 3491–3493、独立 DSH_HOME `references/.dsh-test-g2r{1,2,3}`（均 gitignored，未入库）。
- **盲审规则**：禁读 SESSION_ROUTER_LOG.md / graph.yaml / evidence/（白名单仅 `dev/agent-workflow/evidence/provenance/file-manifest.json`）。因 `docs/plans` 未 track（git ls-files 计数 = 0，仅存在于主 worktree），brief 内嵌冻结文档逐字摘录：DevPlan §15.4 六判据 + §15 seam 矩阵行、TaskDoc §11.3 “G2 Gate 执行方法”六步 + architecture-critical blocker 语义；provenance manifest 提供哈希交叉核验。
- **裁决**（3/3 ∈ {通过, 投机通过} → **G2 PASSED**，0 blockers；3 个 reviewer 均独立复跑全套件绿：EXIT=0，350 PASS / 0 FAIL，worktree byte-clean，HEAD 不变；均映射 6/6 DevPlan §15.4 判据 PASS 并附各自证据）：
  - G2-R1 **投机通过**：V4 裸命令步骤与 G2-R2 撞共享默认资源（端口 3281/3291 + 默认 DSH_HOME `references/.dsh-test-p2t1`），brief 指定的 180 s 重试仍被占用；但裸命令接线（resolveConfig 默认路径链）经读源码验证、V1–V3 绝对路径全绿 → 偏差仅限 V4 步骤执行时序，按 Gate 规则判投机通过（偏差如实登记）。
  - G2-R2 **投机通过**：同上（与 R1 互撞）。
  - G2-R3 **通过**：V4b 于安静窗口成功（裸命令全绿）。
- **非阻塞发现台账**（记录、本轮不修）：
  - F1/O4：`.github/workflows` 测试命令 = bare + `--report-dir` + `CH_DSH_HOME`，与本地裸命令行为等价；CI 从未本地执行（继承 L1-2）。
  - O5：remote-client probe B1 timeout → 级联失败缺口（未来 hardening 项）。
  - O7：seam-manifest 校验产物 ACTUAL 路径 = `tests/characterization/.run-logs/obs/seam-manifest-validation.json`（remote-client/index.mjs L94/587）；brief 猜测路径 `characterization-obs/logs/obs/` 更正。
  - R3 备注：B1 日志 46 条 baseline client 行与 “26”（manifest seam 行数 26/26 PASS）为两个口径。
- **环境备注**：预存 node 进程 PID 5820（2026-08-29 22:43 本地启动；无 TCP listener；沙箱拒 WMI cmdline 查询）——身份未明，按 no-kill 政策保留；端口 3281/3291 前后均验证 FREE。
- **Worktree 清理事故**：3 个 G2 worktree `git worktree remove --force` 均 “Filename too long”（Windows 260 字符限制，node_modules 深路径）→ 日志先归档后 `cmd /c rmdir /s /q` 清残留（每目录 tests/ + tsconfig.base.json + vitest.config.ts）+ `git worktree prune`；主树 `tests/characterization/probes/node_modules/@deepseek-ai/` junction farm 12 包验证完好。
- **证据归档**：13 份 reviewer 日志 → `dev/agent-workflow/evidence/G2-REVIEW/G2-R{1,2,3}/`（含 G2-R3 根目录 scratch G2-R3-diff-names.txt / G2-R3-tree.txt 移入）；根目录 6 个 P2-T4 debug scratch（scratch-p2t4-* ×5、scratch-zstd.mjs）删除（正式证据在 evidence/P2-T4/）。
- **合并 + 推送（授权 push #2）**：`git switch master` + `git merge --ff-only int/P2-seam-characterization` → master = `4eaad19`（merge-base --is-ancestor 验证可 ff，零冲突）；本 bookkeeping commit（R9 + graph + G2 证据）随同一次 push 推送，ls-remote 验证结果记于 R10 开头。
- **graph**：G2-REVIEW → PASSED（verdicts [通过, 投机通过, 投机通过]，gate 3/3 PASS，merged_to_master `4eaad19`，pushed）；current_phase → P3；integration_branch → int/P3-contracts-domain；integration_sha → null；ready → [P3-T1]；P3-T1..T6 + G3-REVIEW → DEFINED（依赖按 TaskDoc §11.4）。
- **Carry-forward（P3 起）**：O5 B1 timeout 级联 hardening；未来 Gate 并行评审的裸命令步骤须错峰或 per-reviewer CH_* env（避免共享默认端口/DSH_HOME 互撞）；`.dsh-test-p2t1` 共享运行残留 housekeeping；P3-T1 为 P3 shared write lock owner（contracts 冻结 v1），完成后 graph `locks.contracts` 置位，其余任务禁改 `packages/contracts/**`。
- **下一步**：建 `int/P3-contracts-domain` + `.worktrees/P3-T1`（task/P3-T1-contract-freeze），派发 P3-T1 worker（单 worker，`qiyuan-self/qwen3.8-27b`）。

### 轮次 R10：P3 启动 — P3-T1（contract freeze）派发（2026-08-30）

- **分支**：`int/P3-contracts-domain` 自 master `4bb1ca3`（R9 bookkeeping，远程已验证 = 4bb1ca3，push #2 完成）；主 worktree 切换至 int/P3。
- **P3-T1 worktree**：`.worktrees/P3-T1` @ `task/P3-T1-contract-freeze`（base `4bb1ca3`）；证据目录 `dev/agent-workflow/evidence/P3-T1/` 已建（worktree 内）。
- **派发**：workflow `p3-t1-contract-freeze-exec`，单 worker `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；brief 内容 = must-reads（ROUTER_RULES + TEST_METHODS）+ TaskDoc §11.4 P3-T1 卡片逐字 + owned-path（`packages/contracts/**` + `evidence/P3-T1/**`）+ 全局禁止项 + Architecture 冻结文档关键事实（TeamSessionId=RootSessionId、(rootSessionId, instanceId) 运行时 identity、templateId 静态、legacy MemberId 反模式；冻结文档未 track → 绝对路径读主 worktree）+ 沙箱测试链（`pnpm install --ignore-scripts` → `node scripts/run-tests.mjs contracts` → `node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json`；禁 pnpm run/exec/vitest CLI）+ erasable TS only + audited matcher surface（toBe/toEqual/toBeGreaterThan/toThrow + .not，禁扩 shim）+ ≤3 attempts + TaskResult JSON 契约 + never-escalate + 崩溃恢复重试注记。
- **任务卡片要点**：目标 = TeamSessionId/InstanceId/TemplateId + DTO 基础 + errors + schema version → 共享 contract v1；必须测试 = type / serialization / illegal ID-input；验收 = 不含 legacy MemberId authority 或 live Agent；输出物 = contracts v1 + contract changelog；P3 shared write lock owner（冻结后其余任务禁改 `packages/contracts/**`，届时 graph `locks.contracts` 置位）。
- **graph**：P3-T1 → RUNNING（branch task/P3-T1-contract-freeze，base `4bb1ca3`）；ready → []。
- **P3-T1 结果**（worker `qiyuan-self/qwen3.8-27b`，canonical attempts 1/3，SELF_VERIFIED，3 commits e757a93→d950a7d→b866d13，head `b866d131bee30f642e25f1155d5c5a2ccaa18d3a`）：
  - **contract v1 内容**（packages/contracts，15 模块，零依赖，src 纯）：schema v1（closed set [1]，SCHEMA_VERSION_MISMATCH / UNSUPPORTED 两码）；branded string IDs — SessionId/RootSessionId/ChildSessionId（opaque ≤255、无控制/空白字符）、**TeamSessionId = RootSessionId 类型别名**（invariant 9，teamSessionIdOf）、InstanceId `inst-<1..32 小写字母数字>`、TemplateId slug、BlueprintId/Revision/ContentHash（blueprintId@revision 键）；**MemberIdentity = (rootSessionId, instanceId)**（invariant 18，canonical sorted-key 序列化）+ LEADER_INSTANCE_ID='inst-leader'（invariant 14）+ IDENTITY_SCOPE_MISMATCH 跨 scope 拒绝；DTO — TeamSessionRecordDto（invariants 8/10）、MemberInstanceRecordDto（invariant 23、§29 五态 lifecycle）、SessionBindingDto ordinary|team-root|team-member（§14.3）、BlueprintSnapshotRef；全 lossless-JSON + canonical-JSON byte-stable + deepFreeze + remote-safe；**20-code TeamContractError** 词汇；**legacy 隔离** — memberId 在所有 DTO surface 拒绝（LEGACY_MEMBER_ID_REJECTED），5 个 legacy Team SessionEvent 名 detection-only（invariant 42；invariant 65 legacy read-only）；CHANGELOG.md v1 FROZEN + 冻结规则（变更须新版本 + 显式授权 + main-agent 批准）。
  - **测试 87/87**（contracts 2 / errors 7 / identity 12 / ids 18 / negative 21 / remote-safe 10 / serialization 16 / types 1）+ tsc clean（TS 6.0.3 strict + noUncheckedIndexedAccess）。
  - **Debug ledger**（D1–D6，不计 attempt）：D4 的 11 失败暴露 2 个 shim matcher 缺口（toBeInstanceOf/toBeUndefined 不在 audited surface → 改用 node:assert/plain try-catch，**未扩 shim**）、1 个错误测试假设（Object.isFrozen 对 primitive vacuously true）、**1 个真实 source bug**（absent optional 字段被按 own property 断言 → parser 改为 “absent 或显式 null” 语义）；D3 TS2591（workspace 无 @types/node）→ 测试 helper 改 plain try/catch 捕获。
- **主 Agent 独立复验**（不依赖 worker 自述）：
  - owned-path 审计：31/31 文件 ⊆ `packages/contracts/**`（28）+ `evidence/P3-T1/**`（3）；零越界；worktree clean；3 commits 全归本任务。
  - worktree 内独立重跑测试链：87/87 EXIT=0；tsc EXIT=0。
  - 冻结语义核对：Architecture L2862（invariant 9）/ L2867（14）/ L2871（18）/ L2872（19）/ L2895（42）/ L2918（65）与源码注释逐条一致；18 个 src 文件 import 全为相对路径（零外部依赖，零 process/require/fetch/node:）。
  - 集成态复验（主 worktree @ int/P3 `fba817c`）：pnpm install 13 s → 87/87 EXIT=0 → tsc EXIT=0。
  - 小记：run-log.txt 含非 UTF-8 字节（疑 pnpm 输出编码残留），不影响 ledger/summary 记录 — 记为 minor observation，非 gate 判据。
- **集成**：cherry-pick -x ×3 → int/P3 `984bb3c/af360cd/ba817c`，零冲突；int head = `fba817cef345ced3fcae374e86ae110dca878c63`。
- **graph**：P3-T1 → INTEGRATED（attempts 1）；**locks.contracts = fba817c**（contract v1 冻结，其余任务禁改 `packages/contracts/**`）；integration_sha = fba817c；ready → [P3-T2, P3-T3, P3-T4, P3-T5]。
- **下一步**：读 TaskDoc §11.4 P3-T2..T6 卡片 → 建 4 worktree（P3-T2..T5，base = int/P3 fba817c）→ workflow 4 并行派发（各自独立 worktree/分支/证据目录）；P3-T6 + G3 待 4 项集成后。

### 轮次 R11：P3 D1 并行 — P3-T2..T5 派发（2026-08-30）

- **Base**：int/P3 `39a5d22`（R10 bookkeeping；contract v1 已冻结，locks.contracts = fba817c）。
- **D1 结构决策（主 Agent，记录在案）**：TaskDoc §11.4 D1 卡片 owned path `packages/domain/<subdir>/**` 与仓库 sanctioned 测试链（runner 只发现 `packages/<pkg>/test/*.test.ts`；包 tsconfig 只 include src/test）结构不兼容 → 以最小偏差解决，**零共享文件写入**：
  - 代码：按卡片原样 `packages/domain/<subdir>/**`（T2 blueprint / T3 member + lifecycle / T4 policy / T5 compatibility）；建议子目录内 `src/**` + 子目录自有 `tsconfig.json`（owned、extends 根 base、noEmit、include 自身 src + 自身 test 文件）。
  - 测试：`packages/domain/test/<t{n}>-*.test.ts`（命名空间文件名，4 worker 只新增文件、零重叠、永不触碰骨架 domain.test.ts）→ sanctioned `node scripts/run-tests.mjs domain` 可发现。
  - contracts v1 导入：相对路径 `../../contracts/src/index.js`（NodeNext .js→.ts 映射 + runner hook 同映射；零 dist 构建）。
  - 共享文件（domain package.json / src/index.ts / tsconfig.json / vitest.config.ts / test/domain.test.ts）：D1 期间无人编辑；最终接线由 P3-T6 集成处理。
  - T3 卡片 owned path `member*；lifecycle*` 解释为 `packages/domain/member/**` + `packages/domain/lifecycle/**`。
  - T2 “standard YAML/markdown parser” 允许依赖：若需第三方依赖（如 yaml），T2 为唯一被授权修改 packages/domain/package.json 的 worker（单写者例外，记录于本条）；亦可自包含实现 parser。
- **Worktrees**：`.worktrees/P3-T{2,3,4,5}` @ task 分支（base `39a5d22`），各自证据目录 `evidence/P3-T{2,3,4,5}/`。
- **派发**：workflow `p3-d1-parallel-domain`，4 worker 并行，全部 `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；无共享资源（纯包工作，无端口/DSH_HOME/实例）；各自 worktree 独立 pnpm install（warm store ~15 s；store lock 竞争 → 重试）。
- **graph**：P3-T2..T5 → RUNNING（branches 已录）；ready → []。
- **结果**（4 worker 全部返回，`qiyuan-self/qwen3.8-27b`）：
  - **P3-T2**（blueprint catalog，head `a4fe261`，**attempts 3/3 预算用尽**）：a1 RED（TS1005 缺右括号）；a2 RED（yaml v2 CJS named-export 事件 — 导出 `YAMLError` 而非 v1 `YAMLException` + TS2305/TS2322）；a3 GREEN。104/104 测试（102 自有 + 2 骨架），tsc blueprint 干净，包级 tsc TS6059 结构性（18×，0 语义，按 R11 裁决接线延后）。唯一被授权共享文件编辑：`packages/domain/package.json` 加 `yaml@2.9.0`（单写者例外）+ `pnpm-lock.yaml`（接受副作用）。
  - **P3-T3**（member + lifecycle，head `cbd2619`，attempts 2/3）：72/72（70 自有 + 2 骨架），两个子目录 tsc 均干净，包级 tsc TS6059。worker 就包级 tsc 腿自报 `BLOCKED_CORE_SEAM`（owned paths 内不可修：冻结 P1-T4 tsconfig 三件套 vs 卡片强制的 contracts 相对导入）— 主 Agent 按 R11 结构裁决定性为**集成接线项**而非协议阻塞（非 upstream seam、非 core patch，main-agent post-integration fix 可解），于 R12 以 `b660e90` 修复并验证 EXIT=0。
  - **P3-T4**（policy resolver，head `92a5fa6`，attempts 1/3）：65/65（63 自有），两个 tsc 均绿。**观察**：T4/T5 的包级 tsc 未把 contracts src 拉入包程序（耦合深度与 T2/T3 不同）— G3 reviewer 应核查四子目录对 contracts 的耦合深度差异。
  - **P3-T5**（compatibility engine，head `caab380`，attempts 1/3）：77/77（75 自有），两个 tsc 均绿。下游注记：P7-T1 只读消费（`evaluateCompatibility` 准入闸、`isCompatibilityResultValidForEnvironment` 漂移重探，DevPlan §20.1）。
  - **主 Agent 独立审计（全部通过）**：逐 worktree 重跑测试链 — 104/104、72/72、65/65、77/77 全 PASS；子目录 tsc 全干净；T4/T5 包级 tsc 绿、T2/T3 仅 TS6059 结构性（与 worker 自报一致）。owned-path 审计：T2 越界 = `pnpm-lock.yaml` 唯一（授权单写者例外，接受）；T3/T4/T5 全部在界内；证据目录均在界内。

### 轮次 R12：P3 D1 集成（P3-T2..T5 → int/P3）+ TS6059 主 Agent 修复（2026-08-30）

- **集成**：cherry-pick -x ×10（T2 ×3 `d000212/5aef611/7891c79`、T3 ×2 `1ec17cc/1b74dbd`、T4 ×2 `8950962/98e1e90`、T5 ×3 `ffa409b/88c0008/4f857a8`）→ int/P3 零冲突，head `4f857a8`。
- **整合验证事故与过程规则**：int 树首次验证 210/216（6 失败 = 全部 t2 测试文件 import 失败）+ tsc blueprint `Cannot find module 'yaml'` + 2×TS18046 — 根因 = 主 worktree node_modules 为 T2 之前安装（依赖新增型集成未同步）。`pnpm install --ignore-scripts`（warm 2.1 s）后 **312/312 PASS EXIT=0**。过程规则（记入）：**凡集成触碰 package.json/lockfile 的任务后，主 worktree 必须先 pnpm install 再验证**。
- **TS6059 修复（主 Agent post-integration fix，precedent `870abc7/7e7560d/00c7e99`）**：D1 测试经 `../../contracts/src/index.js` 相对导入 contracts src，contracts `.ts` 文件进入 domain 类型检查程序且位于旧 rootDir（`packages/domain`）之外 → 结构性 TS6059（T2/T3 各 18×，0 语义错误）。修复 = `packages/domain/tsconfig.json`（noEmit 类型检查配置；`tsconfig.build.json` rootDir `src` 不动、emit 布局不受影响）`rootDir "." → "../.."`，commit `b660e90`。验证：`tsc -p packages/domain/tsconfig.json` EXIT=0 + `run-tests domain` 312/312 PASS。T3 worker 的 `BLOCKED_CORE_SEAM` 自报至此按 R11 裁决闭环（非协议阻塞，见 R11 结果条）。
- **已知后续**：P4+ 凡 import contracts 的包将复现同一 TS6059 rootDir 模式 — 按本修复模式处理（记录于 carry-forward）。
- **Graph**：P3-T2 → INTEGRATED（head `a4fe261`，attempts 3/3）；P3-T3 → INTEGRATED（head `cbd2619`，attempts 2/3）；P3-T4 → INTEGRATED（head `92a5fa6`，attempts 1/3）；P3-T5 → INTEGRATED（head `caab380`，attempts 1/3）；integration_sha = `b660e90681cc09b612be98b4537b1ea8f061c237`；ready → [P3-T6]。
- **下一步**：P3-T6 — 建 `.worktrees/P3-T6` + `task/P3-T6-domain-integration`（base int/P3 `b660e90`），单 worker 派发（`qiyuan-self/qwen3.8-27b`）：组合 Blueprint/Member/Policy/Compatibility + architecture property suite；owns `packages/testkit/domain` + `docs/contracts`；P3 四包只读；不新增功能；合同缺口走 CONTRACT_CHANGE_REQUEST。

### 轮次 R13：P3-T6 启动 — Domain integration/property review + G3 派发（2026-08-30）

- **Base**：int/P3 `ba293ec`（R12 bookkeeping；D1 全部集成完毕，TS6059 已修 `b660e90`，全量基线 413/413 PASS）。
- **T6 结构裁决（主 Agent，记录在案，D1 模式）**：TaskDoc §11.4 T6 卡片 owned path `packages/testkit/domain` + `docs/contracts` 与仓库 sanctioned 测试链结构不兼容（runner 只发现 `packages/testkit/test/*.test.ts`；包 tsconfig `rootDir "."` 对跨包导入触发 TS6059）→ 最小偏差解决：
  - 代码：`packages/testkit/domain/**`（按卡片）；子目录自有 `packages/testkit/domain/tsconfig.json`（owned；extends 根 base、noEmit、**不设显式 rootDir** — T2 子目录模式，无 rootDir ⇒ 无 TS6059；include 自身 src + `../test/t6-*.test.ts`）。
  - 测试：`packages/testkit/test/t6-*.test.ts` **仅新增文件**（授权例外；永不触碰骨架 testkit.test.ts）→ sanctioned runner 可发现。
  - `packages/testkit/tsconfig.json`（noEmit 类型检查配置；`tsconfig.build.json` rootDir `src` 不动）：`rootDir "." → "../.."` 起始即置（b660e90 模式，预置 TS6059 修复；T6 为 P3 期间 testkit 唯一写者）— 授权例外。
  - `packages/testkit/package.json`：**零改动**（不新增依赖；跨包访问一律相对导入）。
  - `docs/contracts/`：T6 文档区 — G3 report（criterion→evidence）+ contracts v1 freeze confirmation。
- **Worktree**：`.worktrees/P3-T6` @ `task/P3-T6-domain-integration`（base `ba293ec`）；证据目录 `dev/agent-workflow/evidence/P3-T6/`（worktree 内）。
- **派发**：workflow `p3-t6-domain-integration-exec`，单 worker `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；无共享资源（纯包工作，无端口/DSH_HOME/实例）；worktree 内 pnpm install。
- **任务卡片要点**：目标 = 组合 Blueprint/Member/Policy/Compatibility + 执行 architecture property suite；只读各 P3 package；不新增功能；contract 缺口走 CONTRACT_CHANGE_REQUEST；必须测试 = cross-module property / serialization round-trip / negative matrix；验收 = G3 每条 criterion 有独立证据 + contracts v1 freeze confirmed；输出物 = G3 report + domain test bundle；审查重点 = reviewer 核对 owned-path、frozen semantics、negative tests、zero-core 约束，不得仅凭 worker 自述批准。
- **基线**（派发前主 Agent 全量跑，int/P3 `ba293ec`）：`node scripts/run-tests.mjs`（无参 = 全 9 包）413/413 PASS EXIT=0（contracts 87 + domain 312 + testkit 骨架 2 + client/remote/runtime/storage/tools 骨架 12）；testkit/domain/contracts 包级 tsc 全绿。
- **graph**：P3-T6 → RUNNING（branch task/P3-T6-domain-integration，base `ba293ec`）；ready → []。
- **结果**（worker `qiyuan-self/qwen3.8-27b`，canonical attempts **2/3**，SELF_VERIFIED，2 commits `6763892`→`d05dcfb`，head `d05dcfb510a8c3244cecfcabb228b3d0fa728293`）：
  - **交付**：79 个新 t6 测试（10 个 t6 文件 + `packages/testkit/domain/src/{import-graph,index,scenario}.ts` + helpers），逐条编码 DevPlan §16.4 全部 7 条 G3 criterion 为跨模块 property：
    - G3-1 no live Agent dependency：import-graph 闭包 63 specifier 静态断言（9 direct + 54 transitive），唯一 bare dep = `yaml`，banned 段（runtime/tools/remote/client/legacy/team）全覆盖（6 tests）；
    - G3-2 template→N instances：N∈{1..8,12} property + 无上限语义（t6-2）；
    - G3-3 lifecycle matrix：9 边/25 对固定矩阵 + 5×5 operation sweep（t6-3）；
    - G3-4 policy precedence：六层优先级穷举（t6-4）；
    - G3-5 complete:true FATAL：36 格立方 + ack 不可降级（`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` / `COMPLETE_REQUIREMENT_NOT_MET`）（t6-5）；
    - G3-6 snapshot immutability：deep-frozen + BOM/CRLF/键序归一 hash + 派生 hash 防夹带（t6-6）；
    - G3-7 fresh_per_delegation：new-instance policy property（非 context reset）（t6-7）；
    - 另：serialization round-trip（t6-8，canonicalJsonStringify byte-stable）+ 88 例 negative matrix（t6-9，封闭 20-code 词汇 + 错误族不相交）+ 组合管线（t6-10）。
  - **Canonical 链**：attempt 1 RED（leg 3 testkit tsc 15 处 test-side 类型错误，全部测试侧修复，contracts 零改动）；attempt 2 GREEN 六腿全过 = 492/492（413 基线 + 79 t6）+ 4× tsc EXIT=0。
  - **Contract gap**：无。所有 mismatch 均为 test-side 对冻结 v1 文档化行为的期望错误 → 测试侧修复，`packages/contracts/**` 零改动，**无 CONTRACT_CHANGE_REQUEST**。
  - **G3 report**：`docs/contracts/g3-report.md`（criterion→test 文件→count→rerun 命令，verdict G3 PASS）+ `docs/contracts/freeze-confirmation.md`（CHANGELOG v1 FROZEN 原文引用 + freeze rule 逐字 + 9 项 spot-check）。
  - **主 Agent 独立审计（全部通过）**：head 与自报一致；worktree 干净；31 文件全部在 owned paths（`packages/testkit/**`、`docs/contracts/**`、`evidence/P3-T6/**`），越界检查为空；独立重跑 492/492 PASS EXIT=0 + 4× tsc EXIT=0（与自报完全一致）；G3 report 与 freeze-confirmation 通读（结构完整、证据可复现、freeze rule 引用带行号）。

### 轮次 R14：P3-T6 集成（→ int/P3）+ G3 准备（2026-08-30）

- **集成**：cherry-pick -x ×2（`6763892`→`189414f`、`d05dcfb`→`7839f7a`）→ int/P3 零冲突，head `7839f7a`。
- **整合验证（int/P3 主 worktree）**：`pnpm install --ignore-scripts`（already up to date，无新依赖）+ 全量 `node scripts/run-tests.mjs` **492/492 PASS EXIT=0** + testkit/testkit-domain/domain/contracts 4× tsc 全 EXIT=0。
- **contracts v1 冻结再确认**：T6 全程零改 `packages/contracts/**`；graph `locks.contracts = fba817c` 保持。
- **Graph**：P3-T6 → INTEGRATED（head `d05dcfb`，attempts 2）；integration_sha = `7839f7a3db8c610c50975f2facc220df3ce80c62`；ready → [G3-REVIEW]。
- **下一步**：G3-REVIEW — workflow 3 个 fresh 独立盲审（`qiyuan-self/qwen3.8-27b`）；各自 detached worktree @ integration SHA（纯包 Gate：无端口/DSH_HOME/实例）；盲审（禁读 SESSION_ROUTER_LOG / graph.yaml / evidence/，唯一例外 provenance manifest）；brief 嵌 TaskDoc “G3 Gate 执行方法”逐字 + DevPlan §16.4 七判据逐字 + 沙箱测试链 + V-checklist 复现清单。

### 轮次 R15：G3-REVIEW 通过（3/3）+ P3 合并 master 并推送（push #3）+ P4 启动准备（2026-08-30）

- **G3 执行方式**：workflow `g3-review-p3-domain`；3 个 fresh 独立盲审 reviewer，全部 `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；各自 detached worktree @ integration SHA `7839f7a`（`.worktrees/G3R{1,2,3}`；纯包 Gate：无端口/DSH_HOME/实例）；盲审纪律 = 禁读 SESSION_ROUTER_LOG / graph.yaml / evidence/（唯一例外 `dev/agent-workflow/evidence/provenance/file-manifest.json` 仅哈希交叉）+ `docs/contracts/g3-report.md`（worker 产物）只作 claim 不作证据 + 冻结文档绝对路径读（flap 重试一次）。
- **裁决（3/3 ∈ {通过, 投机通过} → G3 PASS）**：
  - **Reviewer 1：投机通过** — 7/7 PASS；独立重跑 492/492 EXIT=0 + tsc 4/4 EXIT=0；zero-core（`4bb1ca3..HEAD` 21 commits / 144 files 全部在 `packages/**`、`docs/contracts`、`dev/agent-workflow/**` + `pnpm-lock.yaml`；无 references/ 或 upstream 路径；无 patches/ 目录；11 个 package.json 无 postinstall/patch-package；lockfile 唯一 delta = 授权 `yaml@2.9.0`）/ private-import（仅相对导入 + 唯一 bare `yaml`；无 node: 内置）/ owned-boundary（per-commit 全清，3 项记录在案例外均核实）；6 项 cross-task invariants 全成立（TeamSessionId=RootSessionId inv 9、identity=(rootSessionId,instanceId) templateId 静态 inv 18/19、恰好 5 个 member 状态 inv 51、20-code 封闭词汇、legacy MemberId 四 DTO 面全拒、5 个 legacy SessionEvent 名 detection-only inv 42）；非阻塞观察 D-1（provenance manifest 无冻结文档哈希条目，记录 observed SHA-256）+ O-1（policy mirror 观察）。
  - **Reviewer 2：投机通过** — 7/7 PASS；492/492 + tsc 4/4；zero-core / private-import / owned-boundary 全 PASS；同样观察 provenance manifest 无冻结文档哈希条目（记录 observed SHA-256）。
  - **Reviewer 3：投机通过** — 7/7 PASS；492/492 + tsc 4/4；独立 criterion→file 映射与 g3-report.md（claim）无差异（计数 492 = 413 + 79 t6、88-case negative matrix、attempt 1/2 历史）；20-code 词汇独立计数 + 封闭测试；5 个 legacy team event 名冻结 detection-only 与 migration inventory 一致。
- **归档**：3 份 `g3-review.md` → `dev/agent-workflow/evidence/G3-REVIEW/reviewer-{1,2,3}/`（主 worktree）；G3R worktree 移除（`remove --force` + 磁盘残留 rmdir + prune；评审证据 commit `8980a09/687b38b/34851fc` 已先归档）。
- **合并与推送**：ff-merge `int/P3-contracts-domain` → master（fast-forward 至 `5d0bdfc86f3b1c0ca3f15383050b4732669213da`）；push #3（用户授权每 Gate 一次）后 ls-remote 验证。
- **graph**：G3-REVIEW → PASSED（verdicts [投机通过, 投机通过, 投机通过]，gate 3/3 PASS，merged_to_master = `5d0bdfc`，pushed: true）；current_phase → P4；ready → [P4-T1]；integration_branch → `int/P4-teamdomain-journal`（待建）；integration_sha → null；**locks.contracts = fba817c 保持**（v1 freeze rule 持续有效：任何改动需新版本 + 显式授权 + 主 Agent 批准，CHANGELOG §Freeze rule；G2 时代置 null 是因 contracts 尚未存在，P3 后冻结为既成事实）。
- **Carry-forward（本轮新增）**：(a) D-1/O-2（R1+R2 共同观察）：`file-manifest.json`（provenance）无四份冻结文档的哈希条目（其为 legacy-fork diff manifest）→ 后续每 Gate 盲审继续记录 observed SHA-256；下次 evidence housekeeping 时为 manifest 补冻结文档条目；(b) TS6059 rootDir 模式：P4+ 凡 import contracts 的新包复现同模式 — 按 b660e90（domain）/ R13（testkit 预置）模式处理。
- **下一步**：读 TaskDoc §11.5 P4-T1..T6 卡片 → 建 `int/P4-teamdomain-journal` + `.worktrees/P4-T1`（task/P4-T1-…）→ 派发 P4-T1 worker（单 worker，`qiyuan-self/qwen3.8-27b`）。P4 = TeamDomain / Journal / Recovery（E 序列）。

### 轮次 R16：P4 启动 — P4-T1（TeamDomain schema/meta repositories）派发（2026-08-30）

- **Base**：master `3ccff7b`（R15 bookkeeping，= remote master，push #3 已验证）；`int/P4-teamdomain-journal` 自建 master；主 worktree 切换至 int/P4。
- **P4 依赖图（TaskDoc §11.5，录入 graph）**：P4-T1 → {P4-T2 ‖ P4-T3} → P4-T4 → P4-T5 → P4-T6 → G4（E0..E4，全部 Class A；P4-T1 R5/C5/T5，P4-T2 R5/C5/T5，P4-T3 R5/C4/T5，P4-T4 R5/C5/T5，P4-T5 R5/C4/T5，P4-T6 R5/C1/T5）。
- **P4-T1 结构裁决（主 Agent，记录在案）**：
  - 卡片 owned path `packages/storage/schema/**` + `packages/storage/repositories/**`；授权例外（同 R13 模式）：`packages/storage/test/p4-*.test.ts`（仅新增；骨架 storage.test.ts 不动）+ `packages/storage/tsconfig.json`（noEmit 配置 rootDir 起始即 `../..`，预置 TS6059；T1 为 E0 唯一 storage 写者）。
  - `packages/storage/package.json`：零改动（零新依赖，跨包一律相对导入）。
  - `packages/storage/src/index.ts`：**不动**（D1 先例：骨架共享 entry 由后续集成接线；P4 序列内 T2..T5 继续新增子目录，最终接线留 G4 前主 Agent post-integration 处理）。
  - **StorageDomain seam 裁决**：卡片允许依赖 = "public StorageDomain only"。仓库内 vNext 包不得 import references/**（零 vendoring、零上游路径依赖）→ 仓库层定义**窄 typed seam 接口**（置于 `packages/storage/schema/**`，逐面镜像 upstream 公开 StorageDomain surface，来源 = 主 worktree 绝对路径只读 `references/deepseek-harness-test-use/packages/storage/storage-domain/`（README.md + lib/index.js + lib/types/*.d.ts），flap 重试一次）；repositories 接受**注入的 seam handle**（依赖注入），测试用 in-memory fake（p4-helpers.ts）。运行期真实 StorageDomain 绑定属后续阶段（P4-T5 fault-injection 起的持久化测试 / P5 runtime）。若所需能力不在公开 surface 上 → `STOP → CORE_SEAM_BLOCKER:<seam>`（协议阻塞，不得绕过）。
  - **schema write-lock owner**：T1 定义 version policy（每 store schema version stamp + upgrade policy；无内置 migration ⇒ mismatch 必须 fail loudly — G4 判据 "schema version mismatch fails loudly"）。
- **Worktree**：`.worktrees/P4-T1` @ `task/P4-T1-teamdomain-schema`（base `3ccff7b`）；证据目录 `dev/agent-workflow/evidence/P4-T1/`（worktree 内）。
- **任务卡片要点**：目标 = 建立 schema_meta、team_sessions、member_instances、session_bindings、overrides、compatibility、operations、ledger 八个 store；必须测试 = open/create/read/write、schema mismatch、record validation；验收 = Team control-plane authority 可独立于 SessionEvent 存储（测试须证明 storage 包对 SessionEvent/Team-event 词汇零依赖）；输出物 = schema v1 + repository tests。
- **G4 判据预读（DevPlan §17.5，T1 相关）**：TeamDomain is sole Team control-plane authority / no Team SessionEvent persistence / schema version mismatch fails loudly（crash matrix、retries、SessionBinding integrity、recovery 属后续任务）。
- **基线**（int/P4 = master `3ccff7b`）：全量 492/492 PASS + tsc 各包绿（R15 后未变）。
- **派发**：workflow `p4-t1-teamdomain-schema-exec`，单 worker `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；纯包工作，无端口/DSH_HOME/实例；worktree 内 pnpm install。
- **graph**：P4-T1..T6 + G4-REVIEW 行已录（DEFINED）；P4-T1 → RUNNING（branch task/P4-T1-teamdomain-schema，base `3ccff7b`）；ready → []。
- **结果**（worker `qiyuan-self/qwen3.8-27b`，canonical attempts **1/3**，SELF_VERIFIED，2 commits `b5795d9`→`4a7131a`，head `4a7131a731c358b3c5d485bc7d7634de93f84e8b`）：
  - **交付**：TeamDomain schema v1 = 窄 typed `StorageDomainSeam`（`packages/storage/schema/seam.ts`，仅镜像 upstream 公开 surface：KvTable get/entries/keys/size/put/delete/update、Domain open/close、DomainError codes）+ 8 个 stamped store（schema_meta / team_sessions / member_instances / session_bindings / overrides / compatibility / operations / ledger）+ version policy（SUPPORTED=[1]；create-on-stamped 拒绝 `TEAM_DOMAIN_EXISTS`；open 按 canonical 顺序重验 stamps；backend 版本错配映射 `SCHEMA_VERSION_MISMATCH`；无内置 migration）+ repository 层（canonical-byte 校验、put 时 legacy 字段拒绝 `assertNoLegacyFields`（冻结 contracts factory 会静默丢未知字段）、typed conflict/NOT_OPEN 归一化）。
  - **测试**：72 p4（8 文件 p4-01..p4-08 + p4-helpers）：open/create/read/write（8 stores）、schema mismatch 负面、per-store record validation、crash/durability（roll-forward、no rollback）、SessionEvent 独立负面（import closure、legacy vocabulary、bare specifiers、live import markers）。
  - **Canonical 链**：attempt 1 五腿一次全绿（install / 564/564 全量 / tsc storage + domain + contracts 全 EXIT=0）。
  - **主 Agent 独立审计（全部通过）**：head 与自报一致；worktree 干净；35 文件全部在 owned paths（越界检查为空）；独立重跑 564/564 PASS EXIT=0 + 3× tsc EXIT=0；summary.json 通读（per-leg 证据 + acceptance_evidence 完整：open/create/read/write、schema mismatch、record validation、SessionEvent 独立四类判据均带 test 文件 + count + rerun 命令）。
- **集成**：cherry-pick -x ×2 → `8c4d8fa`/`f441d1f`，零冲突；int/P4 head `f441d1f`。整合验证（主 worktree）：`pnpm install --ignore-scripts`（无新依赖）+ 全量 **564/564 PASS EXIT=0** + storage/domain/contracts 3× tsc 全 EXIT=0。
- **Seam 结论**：public StorageDomain surface 充足，**无 CORE_SEAM_BLOCKER**；真实 StorageDomain 绑定按计划延后 P4-T5/P5（R16 裁决记录在案）。
- **Graph**：P4-T1 → INTEGRATED（head `4a7131a`，attempts 1）；integration_sha = `f441d1f50fb5aedac1696069f86d50a554014d67`；ready → [P4-T2, P4-T3]。
- **下一步**：读 TaskDoc §11.5 P4-T2/T3 完整卡片 → 建 2 worktree（`.worktrees/P4-T{2,3}`，base `f441d1f`）→ workflow 2 worker 并行派发（`qiyuan-self/qwen3.8-27b`）。

### 轮次 R18：P4 E1 并行 — P4-T2（OperationJournal）+ P4-T3（SessionBinding）派发（2026-08-30）

- **Base**：int/P4 `f6d7da5`（R17 bookkeeping；基线 564/564 + tsc 绿；T1 schema v1 已就位）。
- **E1 并行结构裁决（主 Agent，记录在案，D1/R13 模式）**：
  - T2 owned `packages/storage/operations/**`；T3 owned `packages/storage/bindings/**` — 子目录零重叠。
  - 测试命名空间：T2 = `packages/storage/test/p4t2-*.test.ts`，T3 = `packages/storage/test/p4t3-*.test.ts`（仅新增文件；T1 的 p4-0X 与骨架 storage.test.ts 永不触碰；`p4t2-helpers.ts` / `p4t3-helpers.ts` 各自私有）。
  - 共享文件：两者均**不编辑**（包 tsconfig rootDir 已 `../..`（T1 预置）；`package.json` 零改动、零新依赖；`src/index.ts` 不动；T1 的 `schema/**` / `repositories/**` 对两者只读）。
  - 各自 worktree 独立 pnpm install（warm store；store lock 竞争 → 重试一次）。
- **Worktrees**：`.worktrees/P4-T2` @ `task/P4-T2-operation-journal`、`.worktrees/P4-T3` @ `task/P4-T3-binding-reconciliation`（base `f6d7da5`）；证据目录 `evidence/P4-T{2,3}/`。
- **任务卡片要点**：
  - T2：实现 PREPARED→effects→ledger→COMMITTED、lastAppliedOperationId、generation CAS；允许依赖 = TeamDomain repositories only；不假设 cross-table ACID、roll-forward first；必须测试 = retry same operation / generation conflict / duplicate ledger prevention；验收 = 重复执行收敛到同一 durable result；输出物 = journal engine + tests。
  - T3：实现 root/member/ordinary binding、双向 integrity、orphan/missing binding diagnostics；允许依赖 = contracts/domain/repositories；**不创建 live Agent，只处理 durable binding**；必须测试 = missing child / duplicate binding / wrong root / ordinary fork no binding；验收 = binding 查询可支撑 cold hydration/fork reconciliation；输出物 = binding repo/reconciler + tests。
- **派发**：workflow `p4-e1-parallel-journal-bindings`，2 worker 并行，全部 `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；纯包工作，无端口/DSH_HOME/实例。
- **graph**：P4-T2/T3 → RUNNING（branches 已录）；ready → []。
- **结果**（2 worker 全部返回，`qiyuan-self/qwen3.8-27b`）：
  - **P4-T2**（OperationJournal 引擎，head `4efef29`，attempts **2/3**）：a1 RED（tsc-storage 单处测试侧 TS2551，SessionBindingDto union narrowing，测试侧修复）；a2 GREEN。PREPARED→idempotent effects→ledger fact→COMMITTED；generation CAS（absent row 满足 expectedGeneration 0）；idempotency-identity 检查（同 operationId 异 payload → typed idempotency-conflict）；staged child-session 记录；effect 错误分类（typed pass-through vs unclassified-effect-error）；team-scoped fact ownership；zero-delete roll-forward recovery（DevPlan §17.3）。56 p4t2（journal 12 + conflicts 25 + crash-recovery 19 + helpers）。三项必测全过：retry same operation → byte-stable durable result 零写收敛；generation conflict → 任何写入前拒绝；duplicate ledger → 每 operationId 一条 fact、无 sequence 复用、丢失分配留永久 gap、COMMITTED put 丢失时 fact 复用。开发中 2 处引擎自修（verifyGeneration absent-row 语义；driveRow foreign-fact scope check 前移于 terminal 短路之前）+ 6 处 stale final-state 断言修正。
  - **P4-T3**（SessionBinding integrity/reconciliation，head `bdf16bc`，attempts **1/3**，一次全绿）：SessionBindingService（cold-hydration resolve、幂等 create、typed cross-record 拒绝）+ 只读双向 reconciler（10 个封闭 diagnostic codes、fail-closed）；root/member/ordinary 三类 binding 按冻结 SessionBindingDto；无 live Agent（in-memory seam、仅 durable records）。46 p4t3：missing child / duplicate binding / wrong root / ordinary fork no binding 四项必测全覆盖 + 双向 integrity + orphan/missing diagnostics + cold-hydration 查询支撑。
  - **P4-T1 缺陷**：两 worker 均报 none（T2 的 2 处自修属其自身引擎代码）。
  - **主 Agent 独立审计（全部通过）**：两 worktree head 与自报一致、干净；owned-path 审计越界检查均为空（T2 = operations/** + p4t2-* + evidence；T3 = bindings/** + p4t3-* + evidence）；独立重跑 T2 = 620/620、T3 = 610/610 PASS EXIT=0 + 各 3× tsc EXIT=0。
- **集成**：cherry-pick -x ×4（T2 `4d6a94a`→`31a3d2e` + `4efef29`→`f8da356`；T3 `c14bf51`→`4e110a4` + `bdf16bc`→`d5300dd9`）→ int/P4 零冲突，head `d5300dd9`。整合验证（主 worktree）：pnpm install（无新依赖）+ 全量 **666/666 PASS EXIT=0**（564 + 56 + 46）+ storage/domain/contracts 3× tsc 全 EXIT=0。
- **Graph**：P4-T2 → INTEGRATED（head `4efef29`，attempts 2）；P4-T3 → INTEGRATED（head `bdf16bc`，attempts 1）；integration_sha = `d5300dd9c39254f1aa63938edfe358f011ed47db`；ready → [P4-T4]。
- **下一步**：读 TaskDoc §11.5 P4-T4 完整卡片 → 建 `.worktrees/P4-T4`（base `d5300dd9`）→ 单 worker 派发（`qiyuan-self/qwen3.8-27b`）。

### 轮次 R20：P4-T4（Provisioning state machine）派发（2026-08-30）

- **Base**：int/P4 `4a58702`（R19 bookkeeping；基线 666/666 + tsc 绿；T2 journal + T3 bindings 已就位）。
- **T4 结构裁决（主 Agent，记录在案）**：
  - 代码：`packages/storage/provisioning/**`（按卡片）；测试命名空间 `packages/storage/test/p4t4-*.test.ts`（仅新增 + p4t4-helpers.ts）；证据 `evidence/P4-T4/**`。
  - 共享文件零编辑（包 tsconfig/package.json/src-index/T1-T3 代码全只读）。
  - **Agent factory adapter 裁决**：卡片允许依赖 = "public Agent factory adapter interface（mock first）"→ provisioning 模块内定义**窄 AgentFactoryAdapter 接口**（外部效果面：child session 创建/最小必需面，来源以冻结 Architecture 文档为准；真实实现属 P5 runtime），本 task 只写 **fake** 实现 + 测试；**不创建 live Agent、不调 DSH runtime、不起进程、零新依赖**。
  - 构建于：T2 journal 引擎（`packages/storage/operations`，只读）+ T3 binding service/reconciler（`packages/storage/bindings`，只读）+ T1 repositories（只读）。
- **Worktree**：`.worktrees/P4-T4` @ `task/P4-T4-provisioning-sm`（base `4a58702`）。
- **任务卡片要点**：目标 = ALLOCATED→CHILD_SESSION_CREATED→CHILD_BOUND→INSTANCE_COMMITTED 的 durable protocol adapter；必须测试 = 每阶段 retry / orphan detect / one committed instance invariant；验收 = 重复 provisioning/recovery 最终收敛、不会形成两个 committed MemberInstance；输出物 = provisioning coordinator + fake tests。
- **收敛判据（DevPlan §17.4 逐字预期）**：故障注入后最终只允许 "one committed MemberInstance OR no committed MemberInstance + diagnosable orphan"（crash 注入本体属 P4-T5，T4 状态机必须暴露 §17.4 的 10 个 durable boundary 作为可注入点）。
- **派发**：workflow `p4-t4-provisioning-sm-exec`，单 worker `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；纯包工作，无端口/DSH_HOME/实例。
- **graph**：P4-T4 → RUNNING（branch task/P4-T4-provisioning-sm，base `4a58702`）；ready → []。
- **结果**（worker 返回，`qiyuan-self/qwen3.8-27b`）：**SELF_VERIFIED**，head `7f3f6a2`，attempts **2/3**（a1 RED @ leg2：3 处测试侧 bug + 4 处生产侧 tsc 错误，均为任务内部；a2 全 5 leg 绿）。
  - **交付**：`packages/storage/provisioning/**`（adapter.ts 窄 AgentFactoryAdapter 接口 + coordinator.ts 四阶段 durable 状态机 + stages.ts + identity.ts 确定性 per-(root,instance) operation identity + diagnostics.ts diagnosable-orphan 词汇 + fake-adapter.ts 确定性内存 fake（scriptable failures、幂等 child minting）+ index.ts）；74 p4t4 测试（adapter / per-stage-retry / orphan-detect / one-committed-invariant + helpers）。
  - **三项必测**：per-stage retry = 0-write 幂等重跑、无 adapter 重调、seam-write delta 精确（1/2/1/4/8）；orphan detect = 全部 boundary 状态 + team scoping + 排序枚举；one-committed-invariant = §17.4 十 boundary 完整 crash matrix（每 boundary fresh world、seam-armed crash + re-drive、剩余写算术精确），全部收敛至 exactly one committed member / one fact / stable operationId / 0 orphan；B2/B3 与 B6/B8 记录为共享 seam boundary。
  - **T1/T2/T3 缺陷报告**：none（开发中 1 处失败系 worker 自身测试期望错误——root session id 为上游 opaque 结构规则——生产验证正确，已记录）。

### 轮次 R21：P4-T4 主 Agent 审计 + 集成（2026-08-30）

- **独立审计（全部通过）**：`.worktrees/P4-T4` head `7f3f6a2` 与自报一致、工作树干净；owned-path 越界检查为空（provisioning/** + test/p4t4-* + evidence/P4-T4/**，共 15 文件）；独立重跑 = pnpm install EXIT=0 + 全量 **740/740 PASS EXIT=0**（666 + 74）+ storage/domain/contracts 3× tsc 全 EXIT=0。
- **集成**：cherry-pick -x ×2（code `db6dde6`→`8c50e4c` + evidence `7f3f6a2`→`194c224`）→ int/P4 零冲突，head `194c224`。整合验证（主 worktree）：全量 **740/740 PASS EXIT=0** + storage/domain/contracts 3× tsc 全 EXIT=0。
- **Graph**：P4-T4 → INTEGRATED（head `7f3f6a2`，attempts 2）；integration_sha = `194c2240b00ed33626087bce53d0d3c4eeccf96d`；ready → [P4-T5]。
- **下一步**：读 TaskDoc §11.5 P4-T5 完整卡片 → 建 `.worktrees/P4-T5`（base `194c224`）→ 裁决隔离形态（TEST_METHODS 端口/DSH_HOME 规则 vs 纯 in-process 模拟，卡片允许 "test-only filesystem/process harness"）→ 派发。

### 轮次 R22：P4-T5（Fault-injection/restart testkit）派发（2026-08-30）

- **Base**：int/P4 `28466ac`（R21 bookkeeping；基线 740/740 + tsc 绿；T4 provisioning 状态机已就位）。
- **T5 结构裁决（主 Agent，记录在案）**：
  - 卡片（TaskDoc §11.5 逐字）：目标 = 为每个 durable boundary 注入 crash，并跨 process/reopen recovery；owned = `packages/testkit/fault-injection*；persistence tests`；前置 = P4-T2,T3,T4；允许依赖 = test-only filesystem/process harness；必须测试 = all crash points / double retry / restart / corrupt version；验收 = 最终只有 one committed instance 或 diagnosable orphan；输出物 = fault matrix report + fixtures；Class A / R5/C4/T5 / E3。
  - **harness 形态**：`packages/testkit/fault-injection/**` = **file-backed StorageDomainSeam**（实现 T1 seam 接口，KvTable 逐表 JSON 文件，tmp+rename 原子写），harness 代码用 **.mjs**（node:fs 仅限 .mjs；任何 .ts 不得 import node: builtin——TS2591 不变量），配相邻 **.d.mts** 声明作 tsc 类型面；runner 对 .mjs 原生解析、.js→.ts hook 不受影响。
  - **crash 注入**：seam 级 armed fault（可设 afterWrites/指定 durable 写点，触发 `CrashFault`，realm 丢弃、内存状态全失）；**restart = 同一 scratch 目录上全新 repository/journal/provisioning 栈 reopen**。TeamDomain 只经 seam 触达 OS → file-backed realm restart 对 TeamDomain 全部代码路径与 OS 进程重启观测等价（fault matrix report 必须显式论证此等价，并映射 §17.5 判据 7；真实 OS 进程 + 真 StorageDomain 绑定属 P5 runtime）。
  - **scratch 纪律**：`packages/testkit/test/.tmp-fault*/`（workspace 内；逐测试建 + finally 清；沙箱禁 workspace 外写）。
  - **corrupt version 必须测试**：(a) schema version stamp 篡改 → open fail-loudly SCHEMA_VERSION_MISMATCH；(b) durable record 正文字节损坏（截断/garbage）→ 开放/水合时 typed parse 错误、不静默；(c) crash 遗留 tmp garbage 文件不得污染 reopen。
  - 测试命名空间 `packages/testkit/test/p4t5-*.test.ts`（仅新增 + p4t5-helpers.ts）；t6-* / testkit.test.ts 不动；report → `dev/agent-workflow/evidence/P4-T5/fault-matrix-report.md`；fixtures → `packages/testkit/fault-injection/fixtures/**`。
  - 共享文件零编辑（storage/** 全只读含 T1-T4 代码、domain/**、contracts/** FROZEN、testkit/src/index.ts、testkit tsconfig×2/package.json、runner/hooks/shim、.gitignore）；零新依赖。
  - **额外验证 leg（debug 记账，非 canonical 5 leg）**：`tsc -p packages/testkit/tsconfig.json` 必须 EXIT=0（canonical 5 leg 只 typecheck storage/domain/contracts）。
  - 无端口、无 DSH_HOME、无 DSH 实例（无 live Agent——T4 fake adapter 不变）；稳定实例 :3080 / `D:\deepseek-harness\` 零接触。
- **Worktree**：`.worktrees/P4-T5` @ `task/P4-T5-fault-injection-testkit`（base `28466ac`）。
- **派发**：workflow `p4-t5-fault-injection-testkit-exec`，单 worker `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）；无端口/DSH_HOME/实例。
- **graph**：P4-T5 → RUNNING（branch task/P4-T5-fault-injection-testkit，base `28466ac`）；ready → []。

### 轮次 R23：P4-T5 结果 + 主 Agent 审计 + 集成（2026-08-30）

- **结果**（worker 返回，`qiyuan-self/qwen3.8-27b`）：**SELF_VERIFIED**，head `3a5ac2b`，attempts **1/3**（canonical a1 全 5 leg 绿 + DEBUG testkit-tsc 绿；9 次 debug 运行单独记账）。
  - **交付**：`packages/testkit/fault-injection/`（file-seam.mjs FileStorageSeam = file-backed StorageDomainSeam，node:fs 仅 .mjs、tmp+renameSync 原子写、armCrashAfterWrites 触发 CrashFault 于 mid-atomic-write、write 计数/crash 状态查询；file-seam.d.mts 类型面；fixtures/committed-world/ 确定性已提交世界 fixture，8 个表文件 + meta，被 4 个测试流消费）+ 33 p4t5 测试（crash-matrix 13 / retry-restart 10 / corrupt-version 10 + helpers）。
  - **验收映射**：all crash points = 10 boundary 全部（W1–W8 精确 seam-write 算术 offset+recovery=8、每 crash 恰好 1 个 tmp 落在精确表上、reopen 后收敛 exactly one committed MemberInstance + 0-write no-op recover、B2==B3 与 B6==B8 共享 seam 状态）；double retry（B2/B9：7+1 剩余写后 0-write no-op、同 ledger sequence）；restart（committed-world fixture 0-write 读回；stamped-empty NONE + member-not-provisioned 后 8-write commit；第二 member inst-beta 7 写至 ledger seq 2 且存活二次 restart）；corrupt version（a1 stamp SCHEMA_STAMP_MISMATCH / a2 domain meta SCHEMA_VERSION_MISMATCH / b1 SEAM_FAILURE / b2-b3 RECORD_INVALID（MALFORMED_DTO、SCHEMA_VERSION_MISMATCH）/ c1-c2 遗留 tmp 不污染 reopen）。
  - **report**：`evidence/P4-T5/fault-matrix-report.md`（10-boundary 表 + 进程等价论证 + §17.5 判据映射，G4 criterion 7 等价性显式声明、真进程/真 StorageDomain 绑定属 P5）。
  - **T1-T4 缺陷报告**：none（唯一 harness bug 在 T5 自身新 file-seam.mjs update 返回值，任务内修复）。
- **独立审计（全部通过）**：`.worktrees/P4-T5` head `3a5ac2b` 与自报一致、工作树干净；owned-path 越界检查为空（fault-injection/** + fixtures + test/p4t5-* + evidence/P4-T5/**，共 18 文件）；独立重跑 = pnpm install EXIT=0 + 全量 **773/773 PASS EXIT=0**（740 + 33）+ storage/domain/contracts/testkit 4× tsc 全 EXIT=0；fault-matrix-report.md 抽查（W1–W8 算术、boundary 表、等价论证、判据映射齐全）。
- **集成**：cherry-pick -x ×2（code `5605584`→`3adddf4` + evidence `3a5ac2b`→`c874a7f`）→ int/P4 零冲突，head `c874a7f`。整合验证（主 worktree）：全量 **773/773 PASS EXIT=0** + storage/domain/contracts/testkit 4× tsc 全 EXIT=0。
- **Graph**：P4-T5 → INTEGRATED（head `3a5ac2b`，attempts 1）；integration_sha = `c874a7f1605ef1fb2ecfb8c89377c5ba74e86ac6`；ready → [P4-T6]。
- **下一步**：读 TaskDoc §11.5 P4-T6 完整卡片（TeamDomain independent audit + G4，owned = review artifacts only；Gate reviewer 不参与 P4-T1..T5 实现——主 Agent 执行独立审计并产出 G4 候选证据）→ 建 `.worktrees/P4-T6` → 派发。

### 轮次 R24：P4-T6（TeamDomain independent audit + G4）派发（2026-08-30）

- **Base**：int/P4 `4a61394`（R23 bookkeeping；基线 773/773 + 4× tsc 绿；T1-T5 全部就位）。
- **T6 结构裁决（主 Agent，记录在案）**：
  - 卡片（TaskDoc §11.5 逐字）：目标 = 独立审查 authority、SessionEvent 禁用、recovery convergence；owned = review artifacts only；minor test-only additions if assigned；前置 = P4-T5；允许依赖 = read-only production code；实现要点 = Gate reviewer 不参与 P4-T1..T5 实现；必须测试 = zero Team SessionEvent scan / fault suite / restart suite / schema mismatch；验收 = G4 PASS；否则明确 blocking invariant；输出物 = G4 report；Class A / R5/C1/T5 / E4。
  - **独立性**：P4-T6 worker = 全新 leaf agent（未参与 T1-T5 实现，满足"Gate reviewer 不参与实现"的 task 级要求）；G4-REVIEW 另加 3 名 fresh blind reviewer（worker 的 G4 report 对它们只是 CLAIM，不是证据）。
  - **分配的 minor test-only addition**：zero Team SessionEvent scan = 提交的测试 `packages/testkit/test/p4t6-*.test.ts` + scanner `packages/testkit/fault-injection/session-event-scan.{mjs,d.mts}`（仅新增；不改既有 fault-injection 文件）。
  - **denylist（冻结，源自 legacy `references/deepseek-harness/packages/team/team/src/events.ts` 逐字 + reuse-map）**：事件类型串 `team/member-bound`、`team/progress`、`team/control-request`、`team/control-decision`、`team/message`；对 `@deepseek-ai/dsh-session/types` 的 `SessionEventMap` team 合并；legacy payload 符号 `TeamMemberBoundData`/`TeamProgressData`/`TeamControlRequestData`/`TeamControlDecisionData`/`TeamMessageData`。扫描面 = `packages/**` 生产+测试源码（.ts/.mjs/.mts，排除 node_modules/dist）；断言零命中；若出现疑似 false positive，记录并精化 denylist（禁止整文件 blanket 排除）。
  - **fault/restart/schema-mismatch 必测**：复用既有 p4t5（crash-matrix/retry-restart/corrupt-version）+ p4t4（per-stage retry）+ T1 version policy 测试——P4-T6 必须实际运行（canonical chain 内含）并在 G4 report 中按 suite 逐条引用通过数。
  - **G4 report**：`dev/agent-workflow/evidence/P4-T6/g4-report.md`——7 条 §17.5 判据逐条 PASS/FAIL + 证据（文件/测试/行）；FAIL 必须给明确 blocking invariant（禁止含糊）。
  - 共享文件零编辑（packages/** 全只读——含 P4-T5 新文件；testkit 既有测试/tsconfig/package.json/scripts/.gitignore）；零新依赖；无端口/DSH_HOME/实例；稳定实例 :3080 / `D:\deepseek-harness\` 零接触。
  - 额外验证 leg（debug 记账）：`tsc -p packages/testkit/tsconfig.json` EXIT=0。
- **Worktree**：`.worktrees/P4-T6` @ `task/P4-T6-teamdomain-audit`（base `4a61394`）。
- **派发**：workflow `p4-t6-teamdomain-audit-exec`，单 worker `qiyuan-self/qwen3.8-27b`（leaf，禁子代理）。
- **graph**：P4-T6 → RUNNING（branch task/P4-T6-teamdomain-audit，base `4a61394`）；ready → []。

### 轮次 R25：P4-T6 结果 + 主 Agent 审计 + 集成（2026-08-30）

- **结果**（worker 返回，`qiyuan-self/qwen3.8-27b`）：**SELF_VERIFIED**，attempts **3/3**（a1 RED @ leg2：p4t6 漏 vitest shim import；a2 被 TS2532（noUncheckedIndexedAccess）superseded；a3 全 5 leg 绿——两处缺陷均在 T6 自身新测试文件，未触碰任何既有文件；3 次 canonical 用尽但任务完成）。G4 verdict（worker 报告）：**PASS 7/7，0 blocking invariant**（1/2/3/4/6 direct，5/7 to the extent P4 evidence exists，final call = G4-REVIEW）。
  - **交付（3 新文件，592 insertions，0 既有文件修改）**：`packages/testkit/fault-injection/session-event-scan.mjs`（frozen denylist scanner：5 事件串 exact quoted-literal 匹配、5 payload 符号 word-bounded、SessionEventMap 合并 file-level 检测；确定性 walk、node_modules/dist skip 有记录、symlink-cycle guard、unreadable fail-loud、恰好 2 个 self-reference 排除）+ `session-event-scan.d.mts`（token-free 类型面，本身被扫描）+ `packages/testkit/test/p4t6-session-event-scan.test.ts`（10 测试）。
  - **扫描结果**：190 文件（9 包目录、legacy documented sourceless）；quarantine 之外 **0 违规**（无文件跳过）；payload 符号 0；declaration-merge 0；15 个 event-string 命中全部落在冻结 2 文件 quarantine（`contracts/src/legacy-vocabulary.ts` + `contracts/test/negative.test.ts`）并逐条 pin（file:line:col:token）；positive control（declaration-merge + emitter）与 near-miss negative control（`team/unknown`、`user/message`、`team/progress-report`、`TeamProgressDataX` → 0 命中）入测试。
  - **T1-T5 缺陷报告**：none（read-only 独立审计；具体核对：coordinator.ts:392-397 无双外部效果路径、version-policy.ts:38-61 + team-domain.ts:94-109 无 built-in migration、team-domain.ts:173-176/211-214 无 handle 泄漏、stages 从 durable 状态派生、journal 零删除）。
  - **head_sha 自报更正（主 Agent 审计发现）**：worker 自报 head `d3bf92c` 实为 code commit；分支真 HEAD = `bd97476`（evidence commit 叠加其上）。graph 记录真值。
- **独立审计（全部通过）**：`.worktrees/P4-T6` 工作树干净；owned-path 越界检查为空（session-event-scan.{mjs,d.mts} + p4t6 测试 + evidence/P4-T6/**，共 8 文件）；quarantine 裁决核验 = 合法（contracts v1 FROZEN 的 `legacy-vocabulary.ts` 是 invariant 42/65 的 **detection vocabulary**：LEGACY_TEAM_SESSION_EVENT_NAMES 冻结为仅检测用途 + 拒绝发射（LEGACY_TEAM_SESSION_EVENT_REJECTED）+ 只读 legacy import 识别，非 vNext 权威词汇，符合红线"不得把 legacy 词汇当 vNext 权威"）；测试设计核验（exclusion contract 恰好 2 文件、15-hit pin、正/近失配 control）；独立重跑 = pnpm install EXIT=0 + 全量 **783/783 PASS EXIT=0**（773 + 10）+ storage/domain/contracts/testkit 4× tsc 全 EXIT=0；g4-report.md 逐判据证据抽查（file:line + 执行 suite + 计数齐全，attempt 历史诚实）。
- **集成**：cherry-pick -x ×2（code `d3bf92c`→`92368d2` + evidence `bd97476`→`cdc7f95`）→ int/P4 零冲突，head `cdc7f95`。整合验证（主 worktree）：全量 **783/783 PASS EXIT=0** + storage/domain/contracts/testkit 4× tsc 全 EXIT=0。
- **Graph**：P4-T6 → INTEGRATED（head `bd97476`，attempts 3）；integration_sha = `cdc7f9506f1e84b53c381b6f5e4641f88e3b2b07`；ready → [G4-REVIEW]。
- **下一步**：G4-REVIEW 派发——3 名 fresh blind reviewer（各自 detached worktree @ `cdc7f95`，G3 协议：禁 SESSION_ROUTER_LOG/graph/evidence 除 provenance manifest；worker 的 g4-report = CLAIM 非证据；verdict 通过/投机通过/补充内容/阻塞，3/3 ∈ {通过,投机通过} 才 PASS）→ 若 PASS：ff-merge master + push #4 → P5。

### 轮次 R26：G4-REVIEW 派发（2026-08-30）

- **Review target**：int/P4 integration head `cdc7f95`（P4 全 phase：`3ccff7b..cdc7f95`，P4-T1..T6 全部交付；R25 bookkeeping commit `69a7968` 属主 Agent 状态记录，不在 review 范围——与 G3 先例一致：review 前置 integration head，master 随后吸收 bookkeeping）。
- **协议（G3 先例，盲审）**：3 名 fresh reviewer（全部 `qiyuan-self/qwen3.8-27b`，从未参与 P4 实现，leaf，禁子代理）；各自 detached worktree @ `cdc7f95`（`.worktrees/G4-R1/R2/R3`）；**禁读** `dev/agent-workflow/SESSION_ROUTER_LOG.md`、`dev/agent-workflow/graph.yaml`、`dev/agent-workflow/evidence/**`（白名单仅 `evidence/provenance/file-manifest.json`）；worker 自述/report = CLAIM，必须从源码 + 独立执行验证；先读 ROUTER_RULES + TEST_METHODS（worktree 内）。
- **必审项**：canonical chain 独立重跑（783/783 + tsc）；7 条 §17.5 G4 判据逐条（源码 file:line + 执行计数）；P4 全 phase owned-path 纪律（按任务 diff 核对）；zero-core（无 upstream import、.ts 无 node: builtin、无 live Agent/端口/DSH_HOME）；contracts v1 FROZEN 未被 P4 触碰（`git diff --name-only 3ccff7b..cdc7f95 -- packages/contracts` 必须为空 + lock hash `fba817c`）；domain/** 未被 P4 触碰；no Team SessionEvent persistence（独立跑 p4t6 scan + 自抽查）；crash matrix 收敛（§17.4 十 boundary）；retry 幂等；SessionBinding integrity；version mismatch fail-loudly；restart recovery（含进程等价性声明的成立与否）。
- **verdict**：通过 / 投机通过 / 补充内容 / 阻塞；gate PASS 当且仅当 3/3 ∈ {通过, 投机通过}。review 全文写入各自 worktree `dev/agent-workflow/evidence/G4-REVIEW/reviewer-<N>/g4-review.md`（主 Agent 在移除 worktree 前归档）。
- **graph**：G4-REVIEW → RUNNING（target `cdc7f95`）；ready → []。

### 轮次 R27：G4-REVIEW 结果 + Gate PASS + merge/push #4（2026-08-30）

- **Verdicts（3/3，独立盲审，全部 `qiyuan-self/qwen3.8-27b`，各自 detached worktree @ `cdc7f95`）**：
  - **R1：投机通过**——7/7 PASS（canonical 783/783 + 12 个 P4 关键 suite 单独重跑 189 tests 全绿）；C7 = 进程重启 proxy（ruling R22）经独立核验成立（TeamDomain 仅经 seam 触达 OS，无 seam 外代码路径）；findings：D-01 minor（file-manifest 缺 frozen-doc 哈希条目）、D-02 minor（P4-T1 一行 tsconfig rootDir 在 card glob 外，test typecheck 必需胶水）、R-A reservation（C7 真实 OS 进程 + 真 StorageDomain 绑定属 P5）、R-B（编排器自述全部独立复验，无矛盾）；无 blocking/material。
  - **R2：投机通过**——7/7 PASS（canonical 6/6 leg + 子集 testkit 124/124、storage 250/250 + scanner 独立运行 190 files/15 hits/0 payload/0 merge）；0 blocking、0 material、2 minor（M-1 manifest 哈希；M-2 T1-T4 测试/一行 tsconfig 判为 test-area 产出）、2 reservation（R-1：C7 真进程/真 StorageDomain 属 P5；R-2：C4 在 durable child 记录丢失场景依赖成文 real-factory 幂等契约，real binding 属 P5）。
  - **R3：通过**——7/7 PASS；MINOR-1（manifest 哈希）、MINOR-2（tsconfig rootDir）、NOTE-1（storage/src/index.ts 为 P1 skeleton 未动，后续 phase 的 API 面）、NOTE-2（invariant 42 → Arch §14.2）。
- **Gate G4：PASS（3/3 ∈ {通过, 投机通过}）**。
- **Carry-forwards（记录在案，供 P5 与后续 gate）**：
  - **I-1（P5 硬性要求）**：G5 前须在真实 OS 进程 + 真 StorageDomain 绑定下重跑 crash/restart/corrupt suites（三名 reviewer R-A/R-1 一致）；P5 任务必须含真实 AgentFactoryAdapter + 真实 seam 绑定。
  - **R-2**：C4 的 durable child 记录丢失场景依赖成文 real-factory 幂等契约（P5 真绑定时验证）。
  - **M-1/D-01（manifest）——本轮已解决**：`evidence/provenance/file-manifest.json` 新增 `frozen_docs` 节（4 份 frozen doc SHA-256，主 Agent 重算并与 3 reviewer 记录值核对一致：Arch `030dfb8e…`、UI `3ef3ab69…`、DevPlan `a05d237f…`、TaskDoc `2b457cc0…`）；后续 gate 对该节 cross-check。
  - **M-2/D-02（tsconfig）**：P4-T1 的 `packages/storage/tsconfig.json` rootDir 一行 = formal owned-path exception（test typecheck 必需胶水、零生产代码），无需行动，记录在案。
  - **Standing check（R1 要求）**：后续每个 gate，p4t6 denylist scanner 负控必须保持绿（quarantine 2 文件之外零命中）。
- **归档**：3 份 g4-review.md 已归档至 `dev/agent-workflow/evidence/G4-REVIEW/reviewer-{1,2,3}/`；G4-R1/R2/R3 worktree 归档后移除。
- **merge/push #4（sanctioned，每 Gate 一次）**：int/P4（含本 bookkeeping）ff-merge master → `git push origin master` → `ls-remote` 核验。
- **Graph**：G4-REVIEW → PASSED（verdicts [投机通过, 投机通过, 通过]，gate 3/3 PASS，merged_to_master `cdc7f95`，pushed true）；current_phase → P5；ready → []（P5 cards 待读后 define）。
- **下一步**：R28 —— 读 TaskDoc §11.5 P5 完整卡片组 + DevPlan §18（Agent Binding / Member Lifecycle Substrate）→ define P5 tasks（含 I-1 真进程/真绑定任务）→ int/P5 分支 + kickoff。

### 轮次 R28：P5 kickoff —— P5 cards 读毕 + graph define + int/P5 + P5-T1 ruling（2026-08-30）

- **P5 卡片组**（TaskDoc §11.5，逐字读毕）：DAG `P5-T1 → {T2||T3||T4} → T5 → T6 → G5`。T1 binder（A/F0，dep P4-T6）；T2 persona+preset（A/F1）；T3 model（B/F1）；T4 capability（A/F1）；T5 root-binding（A/F2，deps T2–T4）；T6 member-residency + G5 集成（A/F3，dep T5）。
- **DevPlan §18 全文已读**：§18.1 TeamAgentBinder（owns persona / Team prompt-policy / Team tools / resolved guard / model overlay / skills-MCP adapter / context policy / admission guard；fresh Root / fresh Member / cold Root / cold Member 四路径皆须幂等）；§18.2 AgentPreset（public preset 语义；Member 继承 Root substrate；禁止 per-member preset selector；禁止把 preset plugin graph 抄进 Blueprint）；§18.3 Persona（兼容 preset → scoped identity；`complete:true` → `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` FATAL before work；不得引入 dsh-persona 私有语义）；§18.4 Model（public ModelSelection；在飞请求 N 保持 A，并发 override B 不改 N，N+1 起用 B）；§18.5 Residency（MemberInstance durable / Session durable / Agent residency ephemeral；SETTLED 允许 Agent handle 缺席；新工作 = cold resume）；§18.6 G5 八项判据（Root fresh bind / Root cold bind / Member fresh create / Member cold resume / ordinary Agent 不受影响 / persona 语义 / model 未来边界变异 / residency 可丢弃而不删 Member）。
- **I-1 carry-forward 落位**：P5-T5/T6 交付真实 AgentFactoryAdapter + 真实 seam 绑定（TEST_METHODS：`references/deepseek-harness-test-use` 源码、DSH_HOME `references/.dsh-test`（每任务独立）、port 3180、稳定实例 :3080 绝对不碰）；G5 前在真 OS 进程 + 真 StorageDomain 下重跑 crash/restart/corrupt suites（R-2 的 real-factory 幂等契约同批验证）。
- **Git**：`int/P5-agent-binding-binder` 自 master `602590d` 建出；主 Agent 预置 glue commit `06bd13b`（`packages/runtime/tsconfig.json` noEmit rootDir `"."`→`"../.."`，canonical TS6059 修复，同 storage `b660e90` / testkit R13 先例，先于 P5-T1 落账以杜绝 M-2/D-02 类 finding 复现，零生产代码）；worktree `.worktrees/P5-T1` @ `task/P5-T1-team-agent-binder`（base `06bd13b`）。
- **P5-T1 ruling（主 Agent 结构裁决，随 brief 下发）**：
  - **owned**：`packages/runtime/agent-setup/binder/**`（新模块，`agent-setup/` 不在 runtime tsconfig include 根集内，但被 test 文件 import 后进入 program，rootDir 已预置可覆盖）+ `packages/runtime/test/p5t1-*.test.ts`（可含 `p5t1-helpers.ts`）+ `dev/agent-workflow/evidence/P5-T1/**`。
  - **只读共享面**：runtime `src/index.ts`、`src/plugin/host.ts`、`test/runtime.test.ts`、runtime 两个 tsconfig、`package.json`（零新增依赖）、storage/domain/contracts/testkit 全部、四份 frozen docs、upstream（仅只读查公开契约）。
  - **设计边界**：单一 `TeamAgentBinder` 幂等编排核心，同一类覆盖四 bind 路径（fresh Root / fresh Member / cold Root / cold Member）；owns 编排顺序 + overlay 槽位契约 + admission 决策点（admission 前 fail-closed，T2 的 FATAL 落在此闸之前）；**不 owns** TeamDomain 真相（只经注入的只读 handle 读）与外部 Agent 运行时；binder 不 import 任何 legacy `packages/team` 词汇（p4t6 scanner 负控须保持绿）。
  - **注入面（narrow，mock-first）**：`TeamAgentSetupSurface` 最小接口（worker 按最小必要面设计并逐成员记录理由）+ 测试 fake（call-recording + 可脚本化故障注入）；persona/model/capability 三个 overlay 槽位 T1 只定义契约 + 恒等默认实现，T2/T3/T4 填实现；真实 DSH 公开面绑定属 T5/T6。若所需面非 DSH 公开 API：`STOP → CORE_SEAM_BLOCKER:<seam>`，不得绕。
  - **必测**：① double bind 幂等（同目标二次 bind = 无重复 install、无重复 session event、稳定身份）；② fresh/cold mock 四路径全绿（fresh = 首装全效果；cold = 自 durable TeamDomain 记录 rehydrate、不重跑 fresh 期副作用）；③ ordinary agent no-op（非 team 目标零效果、零记录写入）。
  - **验收**：单一 binder 类覆盖四 bind 路径；零新增依赖；canonical 链 5 leg（baseline 783/783 不回归）+ 附加 DEBUG leg `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json` EXIT=0（记录为 DEBUG，不计 canonical）；T1 零 live agent、零端口、零 DSH_HOME。
- **Graph**：P5-T1..T6 + G5-REVIEW 落账（T1 RUNNING，余 DEFINED）；integration_branch → `int/P5-agent-binding-binder`；integration_sha `06bd13b`；ready `[P5-T1]`。
- **下一步**：P5-T1 单一 leaf worker 经 workflow 派单（`qiyuan-self/qwen3.8-27b`，禁止再派生子代理，≤3 次执行）；返回后标准主 Agent 审计（owned-path diff / 干净树 / 独立重跑 783+N + runtime tsc）→ `cherry-pick -x` → R29 → ready `[P5-T2, P5-T3, P5-T4]`。

### 轮次 R29：P5-T1 结果 + 主 Agent 审计 + DEC-1 裁决 + integration（2026-08-30）

- **Worker 自报**（workflow 单 leaf，`qiyuan-self/qwen3.8-27b`）：DONE，1/3 attempts，827/827（基线 783 + 新增 44：double-bind 8 / fresh-cold 8 / ordinary-noop 5 / overlay-slots 8 / binder-core 15）；head `bc9f8b4`（evidence 提交，叠在 code 提交 `366ccfd` 之上）；5 次纯 debug run 已入账不占预算；自曝 DEC-1（p4t6 覆盖计数 190→202）。
- **主 Agent 审计**：HEAD 自验 `bc9f8b43531e2935a57b59f4254b55054d03715e` 与自报一致；worktree 干净树；diff 16 文件 = 12 owned（6 binder 模块 + 6 测试）+ 3 evidence + 1 例外（`packages/testkit/test/p4t6-session-event-scan.test.ts`）；grep 全 runtime 包零 legacy 词汇命中、零 `node:` import；`binder.ts` 抽核确认单类四方法（bindFreshRoot/bindFreshMember/rehydrateColdRoot/rehydrateColdMember）、注入窄 `TeamAgentSetupSurface` + 只读 `TeamDomainReadHandle`（投影三方法、无写面）、admission 决策点 fail-closed、事件 (sessionId,name,detail) 去重、overlay 槽位 persona/model/capability 仅契约+恒等默认（业务留 T2/T3/T4）。
- **DEC-1 裁决（主 Agent，记入 graph P5-T1 note）**：批准为正式 owned-path 例外。理由：p4t6 覆盖计数断言是常设不变量，树增长 12 文件后必须随动，否则全链恒红（worker 无 owned 内替代路径）；改动仅标题 + 2 个 toBe 断言 + 推导注释，scanner `.mjs`/`.d.mts` 逐字节未动、denylist/隔离集/自排除契约/匹配逻辑零改动，9 项违规检查改动前后均绿，4 个 token 可回退。G5 reviewer 须复核（常设检查追加项：scanner .mjs 保持字节同一，计数断言随树增长）。同 M-2/D-02 先例（worker 卡外 test-area 一行/数行胶水，主 Agent 裁决入账，零生产代码）。
- **独立重跑（int/P5，审计性质不计 attempt）**：Leg2 `node scripts/run-tests.mjs` 827/827 PASS；Leg3/4/5 tsc storage/domain/contracts 全 EXIT=0；DEBUG tsc runtime EXIT=0。
- **Git**：cherry-pick -x `366ccfd`→`fe7571c`（code）、`bc9f8b4`→`6618d65`（evidence）入 `int/P5-agent-binding-binder`，无冲突；integration_sha → `6618d65c648be0117b6b914c3052e600f67a2389`。
- **Graph**：P5-T1 → INTEGRATED（head `bc9f8b4`，attempts 1，DEC-1 note）；ready → `[P5-T2, P5-T3, P5-T4]`（F1 并行组）。
- **下一步**：R30 —— 建 P5-T2/T3/T4 三个 worktree（base `6618d65`）→ 单 workflow 一次扇出 3 leaf worker（全 `qiyuan-self/qwen3.8-27b`，各自 ≤3 attempts）→ 返回后三审计 → 依次 cherry-pick → R31 → ready `[P5-T5]`（I-1 真绑定任务：真 AgentFactoryAdapter + 真 seam 绑定 + TEST_METHODS 端口 3180 / 独立 DSH_HOME）。

### 轮次 R30：P5-T2/T3/T4（F1 并行组）kickoff —— ruling + worktree + dispatch（2026-08-30）

- **Git**：三个 worktree 建出于 base `6618d65`（int/P5 含 P5-T1 全部工作）：`.worktrees/P5-T2` @ `task/P5-T2-persona-preset-overlay`、`.worktrees/P5-T3` @ `task/P5-T3-model-selection-overlay`、`.worktrees/P5-T4` @ `task/P5-T4-capability-guard-adapters`。
- **共同 ruling（三任务适用，随 brief 下发）**：
  - P5-T1 binder（`packages/runtime/agent-setup/binder/**`）为只读共享依赖；overlay 实现必须精确匹配 T1 的 `OverlaySlot` 槽位契约（`binder/types.ts`），经 binder 装配验证；不得修改 binder 任何文件。
  - 零 live agent / 零端口 / 零 DSH_HOME / 零实例（真实 DSH 绑定属 T5/T6）；mock-first。
  - canonical 链 baseline 更新为 **827/827**（P5-T1 后）；改动后 827+N 全绿；tsc 四包 + runtime DEBUG leg 全 EXIT=0。
  - **p4t6 覆盖计数冲突预裁决（F1 并行特有）**：三 worker 的新文件都会抬高 scanner 覆盖计数（当前 202）。各 worker 若计数断言失败，按 R29 DEC-1 先例只更新 `p4t6-session-event-scan.test.ts` 的标题 + 2 个 toBe 断言 + 推导注释（scanner `.mjs` 逐字节不动、其余断言不动）；此为预裁决 owned-path 例外。integration 时主 Agent 在每个 cherry-pick 后把断言重同步到累计树并重跑 p4t6 suite。
- **P5-T2 ruling（A/F1）**：owned `packages/runtime/agent-setup/persona/**` + `preset/**` + `test/p5t2-*.test.ts` + evidence。允许依赖：public preset/system-prompt seams；compat engine（P2 产出，testkit 只读）。实现要点：compatible preset → scoped identity（persona adapter）；`complete:true` → `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` FATAL 且必须发生在 admission 之前（T1 admission 决策点之前抛出，Team work 永不启动）；不得复制/解析 dsh-persona private internals（upstream 仅只读证据）。必须测试：no persona；complete=false；complete=true；cold bind。验收：compatible preset 保留 upstream assembly semantics；complete:true 永不启动 Team work。
- **P5-T3 ruling（B/F1）**：owned `packages/runtime/agent-setup/model/**` + `test/p5t3-*.test.ts` + evidence。允许依赖：public ModelSelection。实现要点：实现 T1 model 槽位；effective selection 按请求时刻解析——在飞请求 N 保持 A，并发 override B 不改 N，N+1 起用 B（DevPlan §18.4 逐字语义）。必须测试：A in-flight + override B + next request B；restart。验收：模型 mutation 与 frozen semantics 一致。
- **P5-T4 ruling（A/F1）**：owned `packages/runtime/agent-setup/capability/**` + `test/p5t4-*.test.ts` + evidence。允许依赖：policy resolver + public seams only。实现要点：tools/permissions、skills、MCP、pre-step/pre-execute 的 resolved adapter；**effective capability = available ∩ teamResolved ∩ externalHard**；任何未通过 G2 的 capability 不得 private workaround（fail-closed）。必须测试：tighten；external hard；capability disappear；cold resume。验收：交集公式成立（负测试覆盖每一侧）。
- **Graph**：P5-T2/T3/T4 → RUNNING（attempts 0）。
- **下一步**：单 workflow 一次扇出 3 leaf worker（全 `qiyuan-self/qwen3.8-27b`，各自 ≤3 attempts，禁止再派生）；返回后三审计（diff 面 / 独立重跑 / head 自验）→ 依次 cherry-pick + p4t6 计数重同步 → R31 → ready `[P5-T5]`。

### 轮次 R31：P5-T2/T3/T4（F1 并行组）结果 + 三审计 + integration（2026-08-30）

- **Worker 自报**（单 workflow 3 leaf 并发，全 `qiyuan-self/qwen3.8-27b`，各自 2/3 attempts）：
  - **T2**：DONE。preset 三态词汇（absent/standard/complete）+ 仅以 Root 会话 id 为键的窄 `AgentPresetSeam`（Member 继承 Root substrate 为结构性保证）；persona adapter 填 T1 persona 槽位：absent 不装身份；standard 经真实 P3-T5 compat 引擎（PASS/SATISFIED，零 probe 泄漏）→ 深冻结 `ScopedPersonaIdentity`（blueprint 文本 + 继承 presetId + personaOrigin）装 scoped-prompt 面；complete:true → 引擎 BLOCKED_FATAL + contracts v1 冻结码 `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` 自槽位 apply 抛出（binder admission 之前），binder 包成封闭 `BINDER_OVERLAY_FAILED`（cause 链携带冻结码）——Team work 永不启动（无 surface 安装、无 admission、无事件、无注册）；cold bind 零 fresh 副作用。自报 835/835。
  - **T3**：DONE。model 槽位：`TeamModelSelectionSource` 注入点 + `resolveEffective` 请求时刻解析（in-flight 保持 A、并发 override 切源不改 N、N+1 用 B）；restart 重载当前源无 stale A；`ModelSelectionMirror` 为 public ModelSelection 的结构镜像（T5/T6 绑真实 seam）。自报 837/837。
  - **T4**：DONE。capability 槽位：三面 resolver（tools-permissions/skills/MCP）+ `G2CapabilityMatrix` 封闭枚举（public seam 有/无显式区分）+ `resolveEffectiveCapability = available ∩ teamResolved ∩ externalHard` 三面一致性；pre-step/pre-execute 钩子点 fail-closed（未知 capability 拒绝、无 bypass 路径）；cold resume 只读重建 resolver 不重跑 fresh 副作用。自报 843/843。
- **主 Agent 三审计**：三 worktree 均干净树；diff 面 = owned + evidence + p4t6 计数预裁决例外（三处均仅标题+2 断言+注释，scanner `.mjs`/`.d.mts` 未动）；负向 grep 零 legacy 词汇、零真实 `node:` import（命中全部为 doc 注释纯度声明）；**逐 worktree 独立重跑**：T2 **839/839**、T3 **839/839**、T4 **843/843** 全绿。
- **上报缺陷（记录在案，非阻塞，已入 graph note）**：T2 TaskResult 报 835（真 839）且 notes 引陈旧 code SHA `8106a04`（真 `4e998be`，attempt-1 中间提交）；T3 TaskResult 报 837（真 839）且 notes 引陈旧 SHA `8f6d218`/`28d547e`（真 `6ea3ec9`/`416d2ac`）；T4 数字与 SHA 均准。教训固化：worker notes 的 SHA/数字可能是中间态——**一律以 worktree `git rev-parse`/`log`/独立重跑为准**（P4-T6 规则第三次验证）。
- **Integration 事件**：首次 cherry-pick 误用 T2 陈旧 code SHA `8106a04`（bad revision），T2 evidence `7e07525` 先行落上 int/P5 成为孤儿提交 → 主 Agent 立即 `reset --hard 56cc9ed` 清除，按真 SHA 顺序重放：T2（`4e998be`+`7e07525`）→ T3（`6ea3ec9`+`416d2ac`，p4t6 计数冲突解为累计 219）→ T4（`40a6140`+`1094a4c`，p4t6 冲突解为累计 227，含清除一行残留 `>>>>>>>` 标记）；全部 `-x`。
- **独立终验（int/P5）**：`node scripts/run-tests.mjs` **867/867 PASS**（827+12+12+16）；tsc storage/domain/contracts/runtime 全 EXIT=0。
- **Git**：int/P5 head `4d150028671c9d1da7a8df8853bf2075bb2b28dc`（含 T2/T3/T4 全部 code+evidence）；integration_sha 已更新。
- **Graph**：P5-T2/T3/T4 → INTEGRATED（attempts 2/2/2，note 记录上报缺陷）；ready → `[P5-T5]`。
- **下一步**：R32 —— P5-T5 kickoff（**I-1 真绑定任务**：真实 AgentFactoryAdapter + 真 StorageDomain seam 绑定；TEST_METHODS 端口 3180、每任务独立 DSH_HOME（`references/.dsh-test-p5t5`）、稳定实例 :3080 绝对不碰；先重读 TEST_METHODS 全文再 ruling/dispatch）。

### 轮次 R32：P5-T5（I-1 真绑定任务）kickoff —— ruling + worktree + dispatch（2026-08-30）

- **上下文重读**：TEST_METHODS.md 全文（§1 测试实例 / §2 启动链与验证语义 / §3 硬性禁止 / §5 沙箱边界 / §6 裁决史）；P2-T1 char harness 机制（`tests/characterization/lib/instance.mjs`：FILE-FD stdio spawn 绕 piped-stdio EPERM；boot marker = `dsh web: http://127.0.0.1:<port>/?token=...`；**row 挂载公开 seam = `DSH_HOME/profiles/web/cordis.patch.yml` patch 层 + resolution symlink**（`dump-config --profile web` 可验证 mounted row）；P2-T1 实测端口 3281/3291、DSH_HOME `.dsh-test-p2t1` 先例）。
- **Git**：`.worktrees/P5-T5` @ `task/P5-T5-root-binding`（base `870c001` = int/P5 含 F1 全部工作）。
- **P5-T5 ruling（主 Agent，I-1 落位）**：
  - **owned**：`packages/runtime/root-binding/**`（产品化模块 + real-instance harness + fixtures）+ `packages/runtime/test/p5t5-*.test.ts`（注入 handle 的 unit 层，mock-first）+ `dev/agent-workflow/evidence/P5-T5/**`。
  - **只读复用**：binder + 三 overlay（T1–T4 全部）；storage repositories + StorageDomainSeam（P4 真 seam）；testkit fault-injection（T6 的 I-1 crash/corrupt 重跑将复用）；`tests/characterization/lib/**`（DshInstance/util）；P2-T1 evidence（挂载机制证据）；test-use 树（pristine，进出必须 clean）；legacy fork（仅证据）。
  - **设计**：① 产品化 root-binding 模块（erasable TS、纯、注入 handle）= ROOT_COLD_BINDING 产品化——fresh Team root（root agent 创建 → 经注入 surface 跑 T1 binder 四槽位全装 + session binding 落 TeamDomain durable）/ cold root（进程重启 → 自 durable rehydrate，首个 Team-sensitive step 前 scope 完整恢复，无 fresh 副作用）/ admission fail-closed（guard 拒绝 → 无 Team-sensitive step、可观测、实例健康）/ ordinary root（非 team 零记录零效果）。② real-instance harness（`.mjs`，放 owned 内，复用 DshInstance）：DSH_HOME `references/.dsh-test-p5t5`（每任务隔离、workspace 内、gitignored）、端口 3180 主 / 3181 备（TEST_METHODS §1）；Team plugin host row 只经 profile-patch 公开 seam 挂载，插件代码从 team 仓库供给（.mjs 入口或 v24 原生 type-stripping 加载 erasable .ts——worker 自选并记录）；零写 test-use 树、零碰 :3080（harness 须自检）。③ 四场景经**公开面**驱动、断言公开可观测状态（dump-config / 公开 session 状态 / scoped surface / DSH_HOME 下 TeamDomain 文件），无需真实 LLM 调用。④ harness 须可复用并留短 README：P5-T6 将用它做 I-1 的 crash/restart/corrupt 真进程重跑。
  - **逃逸阀**：任何所需公开机制缺失（如 root agent 创建/生命周期无公开钩子、scoped surface 无公开可观测面）→ `STOP → CORE_SEAM_BLOCKER:<seam>`，不得私有绕路。
  - **验证**：canonical 5 leg（baseline **867/867**，unit 层 +N）+ EXTRA leg（harness 四场景，run-log 标注 EXTRA，非 canonical）；tsc 四包 + runtime DEBUG leg；harness 前后 test-use 树 pristine 证明 + 端口释放证明 + :3080 未扰动记录。
  - p4t6 计数：本轮单 worker，新文件 227→227+Δ 由本 worker 落终值（T6 后续再增）。
- **下一步**：单 workflow 派 P5-T5 leaf worker（`qiyuan-self/qwen3.8-27b`，≤3 attempts，最重任务，attempt 预算谨慎使用）；返回后主 Agent 审计（含独立重跑 harness 四场景）→ cherry-pick → R33 → ready `[P5-T6]`（G5 报告 + I-1 重跑落位）。

### 轮次 R33：P5-T5（I-1 真绑定）结果 + 主 Agent 审计 + 独立 harness 重跑 + integration（2026-08-30）

- **Worker 自报**（workflow 单 leaf，`qiyuan-self/qwen3.8-27b`）：DONE，1/3 attempts，canonical 888/888（基线 867 + 21 unit：p5t5-fresh 8 / cold 7 / admission 6）+ EXTRA harness 四场景全绿（S1 fresh 15 断言 / S2 cold 11 / S3 fail-closed 8 / S4 ordinary 5）；head `2b38c11`（evidence，叠在 code `f1fc8fd` 上，已自验）；p4t6 计数 227→243（+10 模块/测试 .ts、+6 harness .mjs，仅标题/2 断言/注释）；14 次纯 debug run 入账（含 pwsh-103 误启动与 Tee-Object 混合编码 run-log 字节级重组修复）。
- **主 Agent 审计**：worktree 干净树，HEAD 与自报一致，2 提交结构正确；diff 43 文件全部在 owned（root-binding 8 模块 + harness 7 文件含 README/plugin.mjs + 4 测试）+ evidence + p4t6 例外；零 legacy 词汇命中；test-use 树 pristine（0 dirty，head `cd5ef81` 前后一致）；harness summary 核验：boot1 3180 / boot2 3181 / mini-MCP 3481 全部释放、stable :3080 200→200、pristine before/after、rowMounted 双 boot true、boot marker（token URL）在档；public-surfaces.md 逐面 file:line 出处（profile-patch seam / dump-config / 公开 session API / dsh-scope / model-selection waterfall 等，全公开面）；run-log 168 行逐字完整（7 leg 分明，leg2 888/888，leg7 EXTRA 全轨迹）。
- **独立终验（int/P5，审计性质）**：Leg2 **888/888 PASS**；tsc storage/domain/contracts/runtime 全 EXIT=0；**EXTRA harness 主 Agent 重跑**（独立 report dir `harness-output-main-audit/`，不覆盖 worker 证据）：**PASS，failures=0**，S1/S2/S3/S4 全 pass（15/11/8/5 断言），pristine/3080/ports 全绿，EXIT=0。
- **基线更正说明**：worker 记录任务指令中 978/998 为错误沿用值，实际 worktree 基线 867（主 Agent 终验一致）；本程序基线链更新为 **888**。
- **Git**：cherry-pick -x `f1fc8fd`→`3c99ee4`（code）、`2b38c11`→`b961511`（evidence）入 int/P5，无冲突；integration_sha → `b9615116ce2957fd8cadc06d733f65b5dae95cb4`；主 Agent 审计 harness 输出目录随本轮 bookkeeping 提交。
- **Graph**：P5-T5 → INTEGRATED（head `2b38c11`，attempts 1）；ready → `[P5-T6]`（P5 末任务：member residency + G5 报告 + I-1 crash/restart/corrupt 真进程重跑落位）。
- **下一步**：R34 —— 读 P5-T6 卡片全文（含被截行）→ T6 ruling（harness 复用、I-1 重跑矩阵、G5 八项判据报告格式）→ worktree → dispatch。

### 轮次 R34：P5-T6（末任务：member residency + G5 报告 + I-1 重跑）kickoff —— ruling + worktree + dispatch（2026-08-30）

- **卡片逐字读毕**（TaskDoc §11.5 P5-T6 + G5 Gate 执行方法）：目标=接通 MemberInstance durable identity、child Session、ephemeral Agent residency，SETTLED 可无 handle；owned=`packages/runtime/member-residency*`+P5 integration tests；允许依赖=public agents.create/resume；实现要点=Member 不是 continuable subagent、nested generic subagents 仍可用；必须测试=fresh create setup；cold resume；evict settled；re-admit；ordinary agent invariance；验收=G5 全部 criterion PASS；输出物=member residency module + G5 report。
- **Git**：`.worktrees/P5-T6` @ `task/P5-T6-member-residency`（base `83b934a` = int/P5 含 T5 全部工作 + 主 Agent 审计证据）。
- **P5-T6 ruling（主 Agent）**：
  - **owned**：`packages/runtime/member-residency/**`（模块 + 自己的 real-instance harness + fixtures）+ `packages/runtime/test/p5t6-*.test.ts`（unit 层，mock-first）+ `dev/agent-workflow/evidence/P5-T6/**`（含 g5-report.md）。T5 的 `root-binding/**`（含 harness）只读可 import 复用，不得修改。
  - **设计**：① member-residency 模块（产品化）：MemberInstance durable identity + child Session + ephemeral Agent residency（§18.5）；fresh create setup（binder bindFreshMember 四槽位全装、Member 继承 Root AgentPreset substrate §18.2）；cold resume（新 work = 自 durable rehydrate）；evict settled（SETTLED 驱逐：residency 丢弃、Member 不删、handle 可缺席）；re-admit（驱逐后重新准入 = cold resume 路径、幂等）；Member ≠ continuable subagent（负测试：member 不能被当 continuable subagent resume；generic subagent 路径不受影响）。② real-instance harness（新 DSH_HOME `references/.dsh-test-p5t6`、端口 3180/3181、复用 DshInstance + profile-patch seam；挂载 row 可含 T5 root-binding row + T6 member row，均从 team 仓库供给）跑五场景：fresh create setup / cold resume / evict settled / re-admit / ordinary agent invariance，全部经公开面驱动、断言公开可观测状态。③ **I-1 硬性要求（G4 carry-forward，G5 前必须完成）**：真 OS 进程 + 真 StorageDomain 绑定下重跑 P4-T5 的 crash/restart/corrupt 语义——在真实实例上：写 durable TeamDomain 期间 kill 真进程（crash）→ 重启后恢复行为正确（无半写/可恢复）；版本文件损坏 → SCHEMA_VERSION_MISMATCH fail-loudly 不静默迁移；重启幂等（R-2：durable child 记录丢失场景下 real-factory 幂等契约成立）。P4-T5 原 file-seam 三套测试保持 canonical 绿（888 含其 33 测试），I-1 是真实进程版补充而非替代。④ **G5 报告**（`evidence/P5-T6/g5-report.md`）：DevPlan §18.6 八项判据逐条 criterion → evidence（unit 测试名 + harness 场景报告 file:line + 公开面出处）→ PASS/FAIL；报告是 CLAIM，G5 reviewer 将独立复验，禁止夸大。
  - **验证**：canonical 5 leg（baseline **888/888**，+N unit）+ tsc 四包 + runtime DEBUG + EXTRA leg（harness 五场景 + I-1 三组真进程重跑，run-log 标注 EXTRA）；pristine/3080/ports 自检同 T5。
  - **逃逸阀**：public agents.create/resume 或所需公开钩子缺失 → `STOP → CORE_SEAM_BLOCKER:<seam>`。
  - p4t6 计数：243→243+Δ 由本 worker 落终值（G5 reviewer 复核）。
  - attempt 预算 ≤3（真进程 crash 场景最重，优先 unit 层绿、harness 最后收敛）。
- **下一步**：单 workflow 派 P5-T6 leaf worker（`qiyuan-self/qwen3.8-27b`）；返回后主 Agent 审计（含独立重跑 harness 五场景 + I-1 重跑）→ cherry-pick → R35 → G5-REVIEW kickoff（三独立盲审 @ integration SHA，G4 协议 + 常设检查 + I-1 复核 + DEC-1 计数复核）。

### 轮次 R35：P5-T6 INTEGRATED（2/3 attempts；925/925 + 主 Agent 独立 harness 重跑 PASS 含 I-1 三组）（2026-08-30）

- **Worker TaskResult**：DONE，2/3 attempts；head `3d59505a1c8161c2bb8b5257e072e1c94ccd59c0`（rev-parse 自检）；code `ec14a3f`（17 files）+ evidence `3d59505`（48 files）；**925/925**（baseline 888 + 37 units）；harness 6 boot 9 场景全绿（S1/S2 = T5 row 复验 15+11 断言，M1 10 / M2 9 / M3 8 / M4 6 / M5 6，I1A 5，I1C 6，共 76 断言）；I-1 三组 3/3；G5 报告 8/8；self-checks（test-use pristine、:3080 200→200、端口释放）齐。
- **主 Agent 审计（全部对工作区 git truth 独立复核，不采信 worker 自报）**：
  - worktree 干净（0 dirty）；HEAD 与自报一致；`83b934a..HEAD` 仅 `ec14a3f` + `3d59505` 两提交。
  - **scope 干净**：65 files = `member-residency/` 12 + `runtime/test/p5t6-*` 4 + evidence 48 + p4t6 1（DEC-1 例外路径）；`agent-setup/**`（T1–T5）0 触碰；新增代码无 `node:` builtin import（0 hits）；contracts quarantine 外无 legacy-vocabulary hits（0）。
  - **p4t6 计数**：真实 base 243 → **258**（新增 15 个 scannable files，diff 逐一点名核验）。worker 报告/注册文档行文 "257→258" 为 prose 误记（g5-report §5、public-surfaces 首段、TaskResult 三处写 257）；**committed 断言 toBe(258) 为唯一真值**且 Leg 2 绿。记 minor defect（行文错、代码对；与 T2/T3 缺陷同族、方向相反）。
  - **证据完整性**：g5-report 八判据 criterion→evidence→PASS 齐（Root fresh/cold 如实标注 "T5 delivered, T6 re-verified"；M3 主动披露 lifecycle transition API 缺口——SETTLED 种子经 row 自有 repository seam 的 harness-setup 写入，与 product audited proxy 写分离计账，语义不改）；summary.json 顶层 pass=true，`i1.a`（windowObserved、kill 时 recordWritten=true && bindingWritten=false 真实半写窗口、kill.killed=true、window 419ms）/ `i1.b`（version 999 → SCHEMA_VERSION_MISMATCH、fileUnchangedAfterFailedBoot=true）/ `i1.c`（pre-boot 删 member 记录 key、boot 5 I1C 6 断言）；run-log 7 legs verbatim EXIT=0 + selfcheck before/after 完整；attempt-1（driver `& $cmd` 整串调用 → tsc leg 从未执行、日志捕获陈旧 leg-2 文本）如实归档为 INVALID（`attempt-1-broken-chain.log`），两次 attempt 间产品代码零变更。
- **独立验证（主 Agent @ int/P5，非 worker 产物）**：
  - Leg 2：`node scripts/run-tests.mjs` → **925/925**，EXIT=0。
  - tsc：storage / domain / contracts / runtime 全部 EXIT=0（无输出）。
  - **EXTRA harness main-audit 重跑**（`evidence/P5-T6/harness-output-main-audit/`，43 files，主 worktree 集成代码）：pass=true、9/9 场景、**I-1 三组全部复现**（I1a 窗口+真 kill / I1b 999→MISMATCH+文件不变 / I1c 幂等）、pristine before/after（cd5ef814）、:3080 200→200、3180/3181/3491 释放、rowMounted 6/6。
  - **G4 carry-forward I-1 裁决：在集成树上独立重跑 PASS → closed**；R-2（durable child 记录丢失下 real-factory 幂等）经 I1c 真进程版验证成立。
- **Git**：cherry-pick -x `ec14a3f`→`ce010a3b7932aba2c4509f9d623e33ad67ff7939`（code）、`3d59505`→`33e462ad9860f55980f352e2355e5482181b9584`（evidence）入 int/P5，无冲突（p4t6 243→258 干净落位，单 worker 轮无计数碰撞）；integration_sha → `33e462ad9860f55980f352e2355e5482181b9584`；主 Agent 审计 harness 输出目录随本轮 bookkeeping 提交。
- **Graph**：P5-T6 → INTEGRATED（head `3d59505`，attempts 2）；ready → `[]`；P5 全部任务（T1–T6 + F1）INTEGRATED。
- **下一步**：R36 —— G5-REVIEW kickoff：3 独立盲审子代理 @ pre-bookkeeping integration SHA `33e462ad9860f55980f352e2355e5482181b9584`，G4 协议（各独立 detached worktree；禁读 SESSION_ROUTER_LOG/graph.yaml/evidence/ 仅白名单 provenance manifest；briefs 内嵌冻结文档逐字段 + `frozen_docs` 四哈希交叉核验；worker 报告 = CLAIM 非证据）；常设检查（p4t6 负向控制 green + scanner .mjs byte-identical + DEC-1/F1 计数维护复核）；**I-1 独立真进程重跑验证（G4 三 reviewer 一致要求，主 Agent R35 重跑 PASS 为参考，各 reviewer 须自行重跑）**；R-2 幂等；G5 八判据按 DevPlan §18.6 + TaskDoc §11.5 G5 Gate 执行方法（checkout SHA → 读 gate entry → 重跑关键正/负测试 → zero-core/private-import/owned-boundary 检查 → 跨任务不变量组合复核 → criterion→evidence→PASS/FAIL）。Gate 过后：archive reviews → ff-merge master → push #5。

### 轮次 R36：G5 Round-1 I1A 缺陷 adjudicated + P5-T6 attempt 3（FINAL）修复 integrated + G5 Round-2 准备完成（2026-08-30）

- **G5-REVIEW round 1 处置（VOID + 真实发现）**：orchestrator payload bug —— `verdictPrompt()` 以 `String(obj)` 嵌入 phase-1/2 结果 → 三个 verdict agent 全部收到字面 `"[object Object]"`（R1 rationale 文本中实证）→ 三项裁决（R1 阻塞 / R2 补充内容 / R3 投机通过）全部无效，记 VOID。但 phase-2 真实实例 harness artifacts 有效：R2/R3 全绿，**R1 I1A red**（`p5t6: child session 'session-child-0eeg6ty1oe6h9p1g' is not durable — a cold-resume scenario requires the persisted child`，resumeChildWithSetup plugin.mjs:799 ← runCrashReplay plugin.mjs:1226；kill 窗口 ~397ms、落在 putMemberInstance fsync 之后；R2 窗口 512ms 绿 → 约 1-in-5 时序竞争）。
- **缺陷 adjudication（genuine product defect，非 harness over-strictness）**：`createFreshMember` 在 child session artifact 可能尚未 materialized 时即提交 TeamDomain durable rows（putMemberInstance→putSessionBinding）—— `agents.create` 为 upstream lazy（coordinator.ts L679-680 "Pure lazy: record intent only. No artifact until the first append"），首个 append（model/selection）是 commit 之后才产生的 write-behind 批。窗口内 crash 留下引用无盘上 artifact 的 child session 的 durable MemberInstance → 违反 DevPlan §18.5 settled state（"MemberInstance durable / Session durable / Agent residency ephemeral" —— Session durable 为硬性成员），cold resume 不可能（cold path 零 durable writes by construction、无法自修）。harness I1A 前置条件（resumeChildWithSetup 要求 persisted child）忠实编码 §18.5，非 over-strict。
- **修复（attempt 3/3 FINAL，budget-0 纯公开 seam；主 Agent 下发前逐条在 upstream 源码核验 seam 事实）**：`types.ts` 新增 REQUIRED port `sessionDurability: SessionDurabilityPort.ensureDurable(childSessionId)`；`fresh-member.ts` 插入新 step 3（read-only root resolution 之后、首个 durable write 之前）`await ports.sessionDurability.ensureDurable(childSessionId)` —— 无条件（convergent replay / idempotent re-run 亦调用；upstream `ensureMaterialized` 对 resumed session 为 no-op：commitPrepared L1034-1038 置 materialized=true），fail-closed（reject → 零 durable writes、binder 不运行）；真实 seam = `sessionPersistence.ensureMaterialized(liveSession)`（catalog 公开 ctx service，api-catalog L1455-1484；flush 全部 write-behind 批 + header-only materializeHeader = temp-write+fsync+publish `session.jsonl.zstd`；ACP precedent：inject L61 / 调用 L227；harness 侧 `svc.agents.get(SessionId)` catalog L316 + `agent.session` 用法已被本 harness L815 实证）。harness 只增不减：M1 新增 must-assert（createFreshMember resolve 后、model/selection 之前同步确认 child final artifact 已在盘上，无 polling）；I1A 前置条件 byte-unchanged；I1B expected-fail 原因不变（SCHEMA_VERSION_MISMATCH，corruptedVersion=999，fileUnchangedAfterFailedBoot=true）；I1c "唯一 durable write 为 binding put" 保持。
- **Worker incident（入档）**：第一 workflow 实例完成全部代码+测试编辑（未提交，7 files）后死于任何验证之前；第二（resuming）实例审计 diff、修正唯一真实偏差（M1 must-assert 缺失）并一次跑通全链。
- **Worker TaskResult（attempt 3）**：DONE green；code `3a02709` + evidence `be3232a`（主 Agent rev-parse 复核：worktree HEAD `be3232a`、branch task/P5-T6-member-residency、0 dirty）；**929/929**（925 + 4 个 S12 units：barrier→record→binding 顺序 / idempotent re-run 无条件 / convergent replay barrier-first / reject→零 durable writes+binder 不运行）；tsc 四包全 0；harness 3/3 绿（每 run 9 场景 77 断言，I1A 5 断言 ×3）；p4t6 258 不变（DEC-1 未触发、scanner byte-identical）；self-checks 齐（pristine、:3080、端口）。
- **主 Agent 独立验证（audit，非 attempt）**：
  - git truth：worktree HEAD/`be3232a`+`3a02709` 与自报一致；diff 逐 hunk 对照 locked design（types/fresh-member/plugin.mjs/index/tests 全符合；service 缺失 / live agent 缺失 fail-loud 路径齐备）。
  - Leg2 复跑 929/929；tsc ×4 全 0（worktree）。
  - cherry-pick -x → int/P5：code pick `ad5e252` + evidence pick `9f5bd12`（full `9f5bd12647e4ba8da35f19c31782e5e21384848c`）；post-pick 主工作区复跑 Leg2 929/929 + tsc ×4 全 0。
  - **主 Agent 独立 harness ×2（main-audit-runs/1..2）：均 PASS，I1A 5/5 断言绿、failures=[]；postflight :3080 200、test-use pristine、端口释放**。
  - **I1A 修复后 5/5 绿（worker 3 + main 2）—— 对比修复前 ~1-in-5 red；且 write-behind 窗口被 barrier 结构性关闭（首个 TeamDomain write 前 artifact 已 durable），非仅经验性降低。**
- **Graph**：P5-T6 attempts 3/3、head `be3232a`；integration_sha `9f5bd12`；G5-REVIEW note round-1 VOID + round-2 计划。
- **G5 round 2 准备完成**：G5-R1/R2/R3 worktree re-checkout detached @ `9f5bd12`（round-1 旧 `g5-review-harness-output/` 与垃圾 `review-report.md` 已删、0 untracked）；prompts 已修（JSON.stringify 嵌入；verdict agents 自读磁盘 summary.json；全部 agent provider qiyuan-self / model qwen3.8-27b；harness 运行严格串行 —— 共享 DSH_HOME + 固定 MCP 端口）。
- **下一步**：R37 —— 启动 G5-REVIEW round 2（workflow：phase1 并行盲分析 → phase2 SEQUENTIAL harness 重跑 → phase3 并行 verdicts）；gate 过：archive → ff-merge master → push #5 → P6。

### 轮次 R37：Gate G5 PASS（3/3 投机通过）—— P5 完成，ff-merge + push #5，current_phase → P6（2026-08-30）

- **G5 round 2 执行**（workflow `g5-review-round2`，9 agents 全部 qiyuan-self/qwen3.8-27b；3 并行盲分析 → 3 严格串行独立 chain+harness 重跑 → 3 并行 verdicts；payload 缺陷已修：JSON.stringify 嵌入 + verdict agents 自读磁盘 summary.json；worktrees G5-R1/R2/R3 detached @ `9f5bd12`（post-fix int/P5 tip），round-1 旧 artifacts 执行前已清）。
- **裁决 3/3：投机通过**（gate 规则：all ∈ {通过, 投机通过} → PASS）。三名 reviewer 各自独立：frozen-docs 4/4 hash ok（+ manifest `frozen_docs` 节交叉核对）；8/8 criteria PASS（criterion→file:line evidence，phase 3 逐条重读复核）；leg2 **929/929**；tsc 4/4 exit 0；harness **9/9 场景绿**（I1A 5/5 断言 ×3，I1B expected-fail by design）；zero-core / private-import / owned-boundary 全净（私有 import 0；cross-task touches 仅 2 处已识别：runtime tsconfig rootDir 胶水、p4t6 覆盖计数 pin）；invariants 组合无矛盾。
- **Findings 14 条（4+5+5），全 LOW/minor/INFO，无 HIGH/CRITICAL**（主 Agent 已逐条读磁盘报告核验）：R1：①member-residency README 任务号笔误（"P5-T3 root binding" 应为 P5-T5，纯 prose，后续 doc pass 修）；②T6 harness mini-MCP 3491-3495 与 P2-T4 band 复用（串行 + pre-check + release assert，无争用观测；未来并发使用需注意）；③I1A 时序依赖为 managed residual risk（本 run 观测窗口 420ms 绿、convergent replay 过、确定性 barrier 由 units S12/S13 钉死；投机通过而非通过的主因，ROUTER_RULES §3.2 判可控制）。R2：minor findings 见归档报告。R3：F1 p4t6 prose 257 vs 断言 258（worker 行文误记，断言为真值，standing）；F2 M3 以 row 自有 repository seam 种子 SETTLED（无 lifecycle transition 机制的 documented scope stand-in，延后任务）；F4 I1B 错误文本 "schema version null" vs 实际 corrupt 999（P4 版本抽取把被篡改 stamp 读为 null——cosmetic）；F5 :3080 listener 观测（in-run 记录 before/after 均 200 括住 harness 窗口，post-run 停止状态在窗口外——informational）。
- **Round 1 处置（记录在案）**：round 1（@ `33e462a`）VOID（orchestrator `String(obj)` payload bug → 三 verdict agents 收到 `[object Object]`）；其 phase-2 artifacts 真实有效：R2/R3 全绿、**R1 I1A red = genuine product defect**（R36 已 adjudicate 并在 T6 attempt 3 修复）；round-1 原始 harness 目录在 round-2 准备时按计划清除（防 stale 读取），发现保全于 R35/R36 日志与截断的 workflow spill。
- **主 Agent 独立验证（disk is truth，不采信 workflow 嵌入值）**：3× 磁盘 `g5-review-harness-output/summary.json` pass=true、failures=[]、9/9 场景（I1A pass ×3）；3× 磁盘 `review-report.md` 裁决行 = 投机通过；14 条 findings 逐条重读。
- **merge/push #5（sanctioned，每 Gate 一次）**：int/P5 tip `0338f8a764337c7caf6ca15aaf7ede9d46bcc620`（R36 bookkeeping）ff-merge master → `git push origin master` → `ls-remote` 核验（commit 记录见下）。
- **归档**：3× `review-report.md` + 3× `harness-summary.json` → `dev/agent-workflow/evidence/G5-REVIEW/round-2/reviewer-{1,2,3}/`；G5-R1/R2/R3 worktree 归档后移除。
- **Carry-forwards（入 P6 背景，非阻塞）**：README 任务号笔误；MCP band 文档化；I1A residual risk 接受（barrier + S12/S13 + 实测窗口 420ms 绿）；p4t6 prose 257；M3 lifecycle stand-in（延后任务）；I1B version-null 文本（P4 cosmetic）。
- **Graph**：G5-REVIEW → PASSED（verdicts [投机通过, 投机通过, 投机通过]，gate 3/3 PASS，merged_to_master `0338f8a`，pushed true）；current_phase → P6；ready []（P6 cards 待读后 define）。
- **下一步**：R38 —— 读 TaskDoc P6 卡片组 + DevPlan §19（Activation / Runtime / Coordination）→ define P6 tasks（DAG `P6-T1 → P6-T2 → {T3||T4||T5} → P6-T6 → G6`；P6-T1 ActivationProvider 为所有新 MemberInstance creation 唯一入口，owns `packages/runtime/activation/**`，dep P5-T6）→ int/P6 分支 + kickoff。

### 轮次 R39：P6-T1 ActivationProvider 执行（1/3 attempts）+ 主 Agent 独立验证 + INTEGRATED（2026-08-30）

- **执行**：workflow `p6-t1-activation-provider`（单 leaf worker，qiyuan-self/qwen3.8-27b）；worktree `.worktrees/P6-T1` 分支 `task/P6-T1-activation-provider` @ base `11b0584`；worker 自报 COMPLETE。
- **Worker 报告（CLAIM）**：2 commits `085ef11`（feat：activation 7 模块 + p6t1 测试 6 文件，共 13 新文件）/ `265c5e3`（evidence run-log）；1022/1022（+93 新测试）；tsc runtime+testkit exit 0；outside-owned：p4t6 scan 计数 258→271（13 新文件，DEC-1 模式，已声明；scanner .mjs 未动）；findings：admit-once 以稳定 operation identity `(rootSessionId, source, requestToken)` 实现（同 token replay 恒为 activated+replayed:true，persistent 与 fresh_per_delegation 两 policy 下均成立；PREPARED roll-forward / COMMITTED replay / FAILED 显式 OPERATION_FAILED——journal protocol 永不 roll-forward FAILED 行；retry 永不重跑 admission/quota/compatibility）；crash wrapping 注意（testkit seam CrashFault 被 repository 层包成 TeamDomainError）；:3080 前后 200；未跑 real-instance harness（P6-T6/G6 范围），3180/3181/3491-3495 未占用，无 push。
- **主 Agent 独立验证（disk is truth）**：①git truth：task 分支 tip `265c5e3`（=worker 报告），base `11b0584`，diff 15 文件 = 7 activation + 6 p6t1 测试 + 1 run-log + 1 p4t6（全在 owned + 已声明 glue 内，contracts 零改动）；②zero-core：activation 模块全部 import 均在本 9 包内（contracts/domain/storage/runtime 内部），无 upstream、无 node: builtin；③full chain 独立重跑（leg1）：**1022/1022 PASS**（与 worker 报告一致）；p4t6 suite 10 tests PASS，assert filesScanned=271；④tsc ×5（contracts/domain/storage/runtime/testkit）全 exit 0；⑤:3080 = 200；⑥结构 spot-check：provider.ts 头注 16 步顺序 + 三分支收敛（new / PREPARED roll-forward / COMMITTED replay）+ continuedResult（delegation 解析到既有 member → invariant 24 同 child Session，read-only 无写）；p6t1-explicit S1 断言 durable write sequence（operations → operations → member → binding → (ledger) → operations）。
- **主 Agent hygiene fixup**：p4t6 scan 测试标题 "258 files scanned" → "271 files scanned"（worker 更新了 assert + 枚举注释但漏标题；与 standing prose-miscount 同类）→ fixup commit `9c04815`（task 分支）；fixup 后 full chain 再跑 1022/1022 + tsc ×5 全绿。
- **Integration**：cherry-pick -x ×3 → int/P6-activation-runtime：`d1d6d55`（feat）/ `794f3d1`（evidence）/ `e32e737`（fixup）；int 分支 tip `e32e737`；int 分支独立 sanity 重跑 1022/1022 PASS。
- **证据**：worktree `dev/agent-workflow/evidence/P6-T1/run-log.txt`（已 pick）；主 worktree `dev/agent-workflow/evidence/P6-T1/main-audit-runs/leg1-full-tests.txt`（本轮独立重跑）。
- **Graph**：P6-T1 → INTEGRATED（attempts 1/3，head `e32e737`）；P6-T2 → READY（base `e32e737`）；integration_sha → `e32e737`；ready [P6-T2]。
- **Carry-forwards（P6-T2 上下文）**：P6-T2（TeamRuntime admission/policy，owns `packages/runtime/admission*` + `action-router*`）构建于 P6-T1 provider 的 check 面之上；G6 gate 预览 = DevPlan 19.7 六判据；admit-once 语义与 operation identity 是 P6-T2 runtime API 的既有资产。
- **下一步**：R40 —— P6-T2 kickoff（workflow 单 leaf worker，同路由 `qiyuan-self/qwen3.8-27b`，brief 结构同 P6-T1：first-reads → frozen docs hash-verify → 卡面 verbatim → owned surface → 实现要求 → canonical chain（基线 1022+N）→ commits → structured report）。

### 轮次 R40：P6-T2 TeamRuntime admission/policy 执行（1/3 attempts）+ 主 Agent 独立验证 + INTEGRATED（2026-08-30）

- **执行**：workflow `p6-t2-runtime-admission`（单 leaf worker，qiyuan-self/qwen3.8-27b）；worktree `.worktrees/P6-T2` 分支 `task/P6-T2-runtime-admission` @ base `e32e737`（int/P6 tip，含 P6-T1）；worker 自报 COMPLETE。
- **Worker 报告（CLAIM）**：2 commits `7a34379`（feat：admission 7 模块 + action-router 3 模块 + p6t2 测试 5 文件，共 15 新源文件）/ `186ecf5`（evidence 5 文件）；1080/1080（+58）；p4t6 271→286（title+assert 对齐，上轮教训已吸取）；tsc runtime+testkit exit 0；outside_owned 自报 []（p4t6 更新按 DEC-1 约定，主 Agent 核验认可）；findings：createTeamRuntime 统一 authority facade，documented enforcement order steps 0-6（request validation → instanceId-first target resolution，label/template token 拒绝 ACTION_ADDRESSING_REJECTED → caller identity+role from TeamDomain → caller authority + mutation envelope → compatibility/admission gate（仅 NEW work，inv 50）→ quota → durable effects under per-team lock）；quota 语义裁决：count+1 > limit 拒绝、== limit 在界内允许、team-then-template 检查序、**quota 仅在 ActivationProvider step-7 内执行（单一事实源，router 无独立计数器）**；fail-closed 全 typed error + 零 durable 副作用。
- **主 Agent 独立验证（disk is truth）**：①git truth：task 分支 tip `186ecf5`（=报告），base `e32e737`；diff 22 tracked = 5 evidence + 15 源（action-router 3 + admission 7 + p6t2 测试 5；271→286 吻合）+ 1 p4t6 修改；working tree 残留 = run-log 未提交 append + 3 个 chain-#2 未跟踪证据文件（worker 自述"commit 不能包含自己的 SHA"——合理，主 Agent 补提交 `001f0de` evidence close，4 files）；②zero-core：两模块全部 import（含多行 import 的 from 子句逐行核）均在本 9 包内（contracts/domain/storage/runtime 内部），无 upstream、无 node: builtin；③full chain 独立重跑（补提交后）：**1080/1080 PASS**；tsc ×5（contracts/domain/storage/runtime/testkit）全 exit 0；p4t6 suite 绿（assert 286）；④:3080 = 200。
- **Integration**：cherry-pick -x ×3 → int/P6-activation-runtime：`bebd5a6`（feat）/ `496d6f9`（evidence）/ `4fa5d12`（evidence close）；int tip `4fa5d1254d2ba9f1b5afface40c76963177271b2`；int 分支 sanity 重跑 1080/1080 PASS。
- **证据**：worktree `dev/agent-workflow/evidence/P6-T2/`（baseline、frozen-doc-verification、full-tests-1/2、runtime-tests-first-run、tsc-2、self-check-2、run-log，全部已 pick）。
- **Graph**：P6-T2 → INTEGRATED（attempts 1/3，head `4fa5d12`）；P6-T3/T4/T5 → READY（base `4fa5d12`，并行组 G2）；integration_sha → `4fa5d12`；ready [P6-T3, P6-T4, P6-T5]。
- **Carry-forwards（P6-T3/4/5 上下文）**：三者均构建于 createTeamRuntime facade 之上（action 经 router 授权；durable 写经 per-team lock）；quota 单一事实源在 activation step-7（勿在 router 侧再造计数器）；p4t6 计数现 286（新文件须再更新 title+assert+枚举注释，三者并行会互相踩计数——brief 已各自内嵌 286 基线并要求在集成时由主 Agent 统一核对最终计数）。
- **下一步**：R41 —— P6-T3（messaging）/ P6-T4（control）/ P6-T5（activity）并行 kickoff（单 workflow 3 leaf workers，同路由；三 worktree 独立、owned surface 不相交、无 real-instance harness → 可并行；各自基于 `4fa5d12`，p4t6 计数各按 286+自身新文件独立更新，集成时由主 Agent 串行 pick 并统一收敛计数）。

### 轮次 R41：P6-T3/T4/T5 并行执行（各 1/3 attempts）+ 主 Agent 独立验证 + 串行 INTEGRATED（p4t6 计数收敛 318）（2026-08-31）

- **执行**：workflow `p6-t345-parallel`（3 并行 leaf workers，全部 qiyuan-self/qwen3.8-27b）；worktrees `.worktrees/P6-T3|T4|T5` 分支 `task/P6-T3-messaging-coordination` / `task/P6-T4-control-approval` / `task/P6-T5-activity-ledger`，全部 @ base `4fa5d12`（int/P6 tip，含 P6-T1/T2）；三 owned surface 不相交、无 real-instance harness → 并行安全；worker 均自报 COMPLETE。
- **Worker 报告（CLAIM）**：T3：`b9430b5`/`847dc87`，1100/1100（+20），p4t6 286→295；T4：`72cfdc5`/`c9330d7`，1112/1112（+32），p4t6 286→297；T5：`61644c8`/`02246a5`，1129/1129（+49），p4t6 286→298。三者均自述残留未提交证据（run-log final append ± chain 输出文件，"commit 不能包含自己的 SHA"惯例）。
- **主 Agent 独立验证（disk is truth，逐 worktree）**：①git truth：三 worktree tip/log/base 全与报告一致；diff 全在 owned + 已声明 glue（p4t6 计数更新）+ evidence：T3 = messaging 5 模块 + 测试 4（9 源 → 295 吻合）；T4 = control 4 模块 + 测试 7（11 源 → 297 吻合）；T5 = activity 6 模块（含 projection seeds）+ 测试 6（12 源 → 298 吻合）；p4t6 三处 title+assert 全对齐（P6-T1 标题漏改教训未再犯）；②zero-core：三模块组全部 import（含多行 from 子句）均在本 9 包内（admission/action-router/activation 只读依赖 + contracts/domain/storage），无 upstream、无 node: builtin；③full chain 独立重跑（job pwsh-151）：T3 **1100/1100**、T4 **1112/1112**、T5 **1129/1129** 全 PASS；tsc ×5 ×3 worktree 全 exit 0；④:3080 = 200；⑤结构 spot-check：T3 双记录拆分（facade ledger `team-coordination-recorded` + SessionInputPort 注入口写 ordinary attributed input，无 Team SessionEvent，admission 不重实现）；T4 createControlService（request/resolve/list/guardOperation；3 类 durable ledger facts；first decision authoritative；inv 45 无缓存 authority；external hard policy 不可被 allow 突破；kebab 词汇与 denylist 结构性不相交）；T5 两阶段写（facade 授权 + guarded commit）、out-of-order REJECT 严格 head+1（stale 永不覆盖、gap 永不静默填补）、每 (instanceId, subject, correlation) 至多一个 open interval、纯 projection seeds、结构性无 workflow authority。
- **主 Agent 收尾**：三 worktree 各补 1 个 evidence close commit（T3 `b74cd4e`、T4 `5eacdf4`、T5 `1f80f67`）；close 后各分支 full chain 再跑全 PASS。
- **Integration（串行 pick + p4t6 冲突收敛，R40 预案执行）**：checkout int/P6 → pick T3×3（`0e7e060`/`3d59b14`/`586ad7c`，p4t6 286→295 无冲突）→ pick T4×3（`61ea373`/`b294381`/`069564a`，p4t6 冲突按预案手工收敛 295+11=**306**，枚举注释三方 union）→ pick T5×3（`bc96108`/`e600e2f`/`760e736`，冲突收敛 306+12=**318**，union 注释）；全部 `-x` 带来源归因。int tip `760e7369650fe7e082772368f67569730cd80912`。
- **int 分支独立验证**：full chain **1181/1181 PASS**（= 1080+20+32+49，与预测精确一致；p4t6 suite 以 318 断言通过）；tsc ×5 全 exit 0。
- **证据**：三 worktree `dev/agent-workflow/evidence/P6-T3|T4|T5/`（全部已 pick）；主 worktree `dev/agent-workflow/evidence/P6-T3/main-audit-chain.txt`（本轮三 worktree 独立重跑记录，随本条 bookkeeping 提交）。
- **Graph**：P6-T3/T4/T5 → INTEGRATED（各 attempts 1/3，head = 各自 task 分支 head）；P6-T6 → READY（base `760e736`）；integration_sha → `760e736`；ready [P6-T6]。
- **Carry-forwards（P6-T6 上下文，关键）**：①T6 的 tool 层必须 wire T4 的 `guardOperation` last-mile guard（control 的 allow 不自动执行，tool 执行前必须查询）；②T6 的 tool 层只可调 Runtime（createTeamRuntime / ActivationProvider / control / activity / messaging 的公开 API），禁止直接写 TeamDomain 或 agents.create（tool bypass scan 是 G6 判据）；③T6 是 real-instance headless E2E 的责任方（G6 六判据：same template N instances、instance-addressed、follow-up 同 Session、fresh_per_delegation 新 instance、message/control/progress survive restart、quota race 不过量）——E2E harness 须串行（共享 DSH_HOME + 固定 MCP 端口 3491-3495，与 P2-T4 band 复用注意）；④T3 SessionInputPort 的真实 public Session input API 在 T6 plugin wiring 落地；⑤p4t6 现 318。
- **下一步**：R42 —— P6-T6 kickoff（workflow 单 leaf worker，同路由；brief 含 G6 六判据 verbatim + 上述 wire 要求 + headless E2E 设计要求 + canonical chain 基线 1181+N）。

## R42 — P6-T6 kickoff（2026-08-31，主 Agent）

- **状态**：P6-T1..T5 INTEGRATED；int/P6 @ `760e736`（主 Agent 已独立验证 1181/1181 + tsc ×5 + zero-core/owned-boundary；p4t6 318）。P6-T6 为 P6 最后任务，Class A，R5/C5/T5。
- **Kickoff 执行（主 Agent，全绿）**：
  - worktree `.worktrees/P6-T6` + 分支 `task/P6-T6-team-tools-e2e` 创建 @ base `760e7369650fe7e082772368f67569730cd80912`（int/P6 tip；rev-parse 验证）。
  - 冻结文档 hash kickoff 前新复核：TaskDoc `2b457cc…` / DevPlan `a05d237…` / Arch `030dfb8…` / UI `3ef3ab6…` — 4/4 与 file-manifest.json `frozen_docs`（CRLF）一致。
  - test-use pristine：head `cd5ef8148158c3a752a658978873241fdf8e2bbc`，porcelain 空；稳定实例 :3080 = 200。
- **Worker 派发**：workflow `p6-t6-tools-e2e` 单 leaf worker，provider qiyuan-self，model qwen3.8-27b（counted attempt 1/3）。Brief：`dev/agent-workflow/briefs/P6-T6-brief.md`（TaskDoc P6-T6 卡 verbatim + G6 执行方法 verbatim + DevPlan 19.6 tool 列表 verbatim + 19.7 七判据 verbatim；carry-forwards a–g：①T4 guardOperation last-mile guard；②tools 仅走 Runtime public 面（禁 TeamDomain 直写 / agents.create / legacy SessionEvent 词汇）；③T6 负责真实实例 headless E2E（FILE-FD stdio spawn；boot `node apps/cli/lib/bin.js web --port N --no-open`；env DSH_HOME=`references/.dsh-test-p6t6`（新建、任务专属）+ DSH_CLIENT_COMMIT_HASH（同 P5 先例）；cordis.patch.yml 行挂载缝；SessionInputPort→真实 public Session input seam；public Cordis tool registration；harness 串行；端口 3180/3181 + mini-MCP 3491–3495）；④基线 1181 + p4t6 318（DEC-1 三处一致 + 实扫防 prose-miscount）；⑤canonical chain ×2（含 leg0-baseline 1181 验证）+ 结构化 P6T6_REPORT + ≤3 attempts；⑥P6 tool 范围裁决（archive/restore/dispose = P7-T3，本任务不实现，记录 scoping decision）；⑦E2E 场景 E1–E7 一一映射 G6 七判据且必须经注册的 tool handler 发起（driver 不得绕过 tool 层直调 Runtime）。
- **先例锚点（brief 内指向）**：`packages/runtime/member-residency/harness/{run.mjs, plugin.mjs, slots-t6.mjs}` + `dev/agent-workflow/evidence/P5-T6/{run-log.txt, public-surfaces.md, g5-report.md}`（boot/directive/scenario/summary.json 机制与 public seam 注册表）。
- **Post-worker 协议（主 Agent）**：git truth 审计（rev-parse / diff vs base / zero-core 含多行 from 子句 / owned-boundary）→ 独立全链重跑（full tests + tsc ×5 + p4t6）→ 独立 E2E 重跑（串行）→ 任务分支 evidence-close commit → cherry-pick -x 至 int/P6 → R43 bookkeeping → G6-REVIEW（3 个全新独立盲审 reviewer @ int/P6 tip；TaskDoc 11.7 六步方法 + DevPlan 19.7 七判据；裁决 通过/投机通过/补充内容/阻塞，3/3 ∈ {通过, 投机通过} 方过）。

## R43 — P6-T6 INTEGRATED（2026-08-31，主 Agent）

- **Worker 报告（CLAIM）**：head `39749bd`，base `760e736`（报告/ledger 中的 base SHA 为 41 字符转录错误；disk merge-base 验证真 base 无误），63 文件 +10473/−18，3/3 attempts 全 full green（1214/1214 = 1181+33：14 actions+9 guard+10 bypass-scan；tsc ×5 全 0；p4t6 318→330；E2E E1–E7 7/7 真实实例；:3080 200/200；test-use 前后 pristine）。
- **主 Agent 独立验证（disk is truth）**：①git truth：HEAD 39749bd、merge-base=760e736、单 commit、status 干净、diff 63 文件与报告吻合；②owned-boundary：仅 packages/tools/** + DEC-1 p4t6 测试（assertion 330×2 + it-title "330 files scanned" 三处一致；scanner 字节不变，diff 空）+ evidence；docs/graph/scripts/其他包零改动；③zero-core：.ts import 全部为 vNext 9 包相对路径 + vitest，无 node: 内建、无 upstream/私有 import；共享 harness 库（tests/characterization/lib、root-binding/harness/{mini-mcp,ts-loader}.mjs）与 base 字节一致（diff 空）只读复用；④结构 spot-check：tools 全部动作经 `ctx.options.teamRuntime.performAction`（10 个 model-facing tools）；`consultGuard` 执行前即时调用、无 tool 层缓存、非 allowed 理由全 fail-closed 零副作用（SD-GUARD：no-request→proceed 为 documented deviation，pinned by p6t6-guard 套件 + E5b fresh-token 用例，交 G6 复核）；harness 行 `p6t6-team-tools`：tools 经 `agentCtx.tools.register` 注册、`ctx.tools.execute` 执行、SessionInputPort 落真实 public Session input API、driver 仅经 HTTP `/__p6t6/tool` 发起（不绕过 tool 层）；spawn 链 = P2-T1 instance.mjs FILE-FD stdio + `bin.js web --port N --no-open` + DSH_HOME/DSH_CLIENT_COMMIT_HASH（TEST_METHODS §2 合规）；⑤独立链重跑（worktree）：1214/1214 + tsc ×5 exit 0；⑥独立 E2E 重跑（串行、fresh DSH_HOME）：7/7 PASS、端口 3180/3181/3491 全释放、test-use 前后 pristine、rowMounted ×2（dump-config 双 boot）、:3080 200（main-audit-harness-output）。
- **集成**：任务分支 evidence-close commit `7fc7352`（main-audit 证据 21 文件）；cherry-pick -x `293db58`（feature）+ `54950fb`（main-audit）至 int/P6，tip = `54950fb60f60d2318cc2e10af800e37c50f87192`；int/P6 链重跑 1214/1214 + tsc ×5 exit 0。
- **Findings（均 LOW，交 G6-REVIEW）**：(1) SD-GUARD no-request→proceed deviation（设计理由：tool 层同时承载受控/非受控操作，leader 普通自治路径必须保持开放；runtime facade 仍强制 identity/authority/envelope/quota；与 P6-T4 fake pipeline 单操作模型差异已显式记录）；(2) p4t6 枚举注释含 phantom "actions" 名（列 14 名实为 +12 文件；assert+title=330 正确且与 live 扫描一致）；(3) worker 报告/ledger prose 中 base SHA 转录错误（41 字符；实际工作 disk 验证无误）；(4) chain leg 日志 UTF-16 编码（raw evidence，UTF-8 console 副本并列）；(5) tools 测试跨包 import runtime 包 test 目录 p6t1/p6t2/p6t4 helpers（test-only 依赖）。
- **Attempt ledger**：3/3（attempt 1 = 变更前 baseline 1181 绿；attempt 2 = 变更后 1214 绿；attempt 3 = 第二次连续 1214 绿；harness 开发迭代不计 chain attempt，g6-report 内记录）。
- **下一步**：R44 —— G6-REVIEW kickoff（3 个全新独立盲审 reviewer @ int/P6 tip `54950fb`；TaskDoc 11.7 六步方法 + DevPlan 19.7 七判据；裁决 通过/投机通过/补充内容/阻塞，3/3 ∈ {通过, 投机通过} 方过；过闸 → ff-merge master + 授权 push #6 + P6 完结）。

## R44 — G6-REVIEW（Gate G6 PASS 3/3；master 合并 + push #6；P6 完结）（2026-08-31，主 Agent）

- **状态**：P6-T1..T6 全部 INTEGRATED；int/P6 @ `54950fb`（R43 主 Agent 独立验证 1214/1214 + tsc ×5 + E2E 7/7）。G6-REVIEW 为 P6 最后闸门。
- **Gate kickoff（主 Agent）**：workflow `g6-review`，3 个并行全新独立盲审 reviewer（均 provider qiyuan-self / model qwen3.8-27b）；worktrees `.worktrees/G6-R1|R2|R3` @ `54950fb`（fresh 分支 `g6-review-r1|r2|r3`）。Brief `dev/agent-workflow/briefs/G6-REVIEW-brief.md`（随本条提交）：TaskDoc 11.7 六步方法 verbatim + DevPlan 19.7 七判据 verbatim + delta `11b0584..54950fb` + 冻结文档 4/4 hash + E2E lockfile 串行协议（共享 DSH_HOME + 固定端口禁并行：`references/.dsh-test-p6t6.lock` fresh<10min → 20s 重试 ≤45；stale → 删除；写 id+timestamp；finally 删除）+ 盲审规则（无主 Agent 结论 / 无 prior round / reviewer 间不互查；in-tree reports 只是 claims）+ 红线（禁改受审代码；findings only）+ G6R<N>_REPORT 输出格式。
- **R2 传输丢失（记录、不计票）**：workflow 返回值 >50KB 中段裁剪 → reviewer-2 的最终 `G6R2_REPORT` 块（含裁决 token）在传输中丢失。磁盘证据分支 `7438e52` 完整（findings.md：7/7 criteria PASS + 明确 "No HIGH findings. No MED findings." + 7 项验证记录含 live external-policy probe `CONTROL_EXTERNAL_POLICY_DENIED`），但 workflow 子代理不可续接（list_agents/send_message 实测：不可 resumable）→ 裁决不可恢复。按 G5 round-1 VOID 先例（verdict 传输损坏 → 裁决无效），R2 不计入 quorum；其证据 + 分支已完整归档（见 Closeout），作为额外审计留痕。
- **R4 补位（主 Agent）**：新 worktree `.worktrees/G6-R4` @ `54950fb`（分支 `g6-review-r4`）；workflow `g6-review-replacement` 单 agent（qiyuan-self/qwen3.8-27b），同 brief（N=4；evidence `reviewer-4/`；块 `G6R4_REPORT`）。R4 全项独立重验：chain **1214/1214** + tsc ×5 exit 0；zero-core 0 serious（test-use pristine pre+post `cd5ef814`）；75/75 delta 文件在 owned paths 内（DEC-1 330 三处一致 + scanner byte-identical）；E2E harness lockfile 协议下 **7/7 PASS**（E1:14 / E2:3 / E3:6 / E4:5 / E5a:11 / E5b:13 / E6:6 / E7:2 = 60 assertions，failures []；summary `pass:true`）；ports 释放；:3080=200 pre/post；evidence 提交 `a6fa733`。
- **裁决（全部取自磁盘已提交证据；workflow 返回值仅作旁证）**：
  - R1 `6f77473`：findings.md L72 `## Verdict: 通过 (PASS)` → **通过**（2 LOW informational：F1 SD-GUARD no-request 偏差 = recorded scoping decision（tool 层承载全部 team 面，leader 普通自治路径必须开放；proceed 路径终结于 performAction，facade 仍强制 identity/role/envelope/addressing/quota）；F2 at-least-once session-input delivery = documented durability ruling；均非缺陷）。
  - R3 `5257378`：findings.md `## Verdict` — "7/7 criteria PASS … No HIGH/MED findings → verdict **通过 (PASS)**" → **通过**（3 INFO：lockfile 并发串行化被 live 观察到按设计工作；E2E 复用 pinned test-use 树既有 lib/ 构建产物（build.required=false，pristine 前后独立验证）；scan-imports.mjs 行号归属 cosmetic note）。
  - R4 `a6fa733`：findings.md L140–142 `## 8. Verdict` — "**verdict = 通过 (PASS)**" → **通过**（3 INFO：ledger phase-2 guard 失败 crash-window 语义（documented，audit fact 持久）；SD-GUARD no-request→proceed（documented deviation，pinned p6t6-guard:305/:395）；harness 16s 为 warm-cache（经 boot markers / health probes / 端口 bind-release / 进程 kill 验证为真实运行））。
  - R2 `7438e52`：传输丢失 → 不计票（见上）。
  - → 有效裁决 R1/R3/R4 = 3/3，全部 ∈ {通过, 投机通过}（实为全 通过）→ **Gate G6 PASS（3/3）**。
- **Findings 汇总（无 HIGH/MED；全部非结构性；无需修复）**：R2 F-1 LOW（同一 worktree 内 chain + harness 并行时 p4t6 scanner `packageDirs` 瞬态 `node_modules` 窗口 → 操作规程：同一 worktree 内测试 chain 不得与 harness 并行；后续阶段沿用）；R2 F-2 INFO（E2 absent-instanceId 拒绝仅 unit-pinned，label/template 拒绝 live 验证）；R2 F-3 INFO（harness throwaway profile-init boot）；R1 F1/F2（如上）；R3 3 INFO（如上）；R4 3 INFO（如上）。
- **Closeout（主 Agent，全部 disk-verified）**：
  - **证据先行归档**：4 个 `dev/agent-workflow/evidence/G6-REVIEW/reviewer-{1,2,3,4}/`（29/35/48/45 = 157 文件，与各 evidence 分支 `git diff --name-only 54950fb..g6-review-rN` 计数 1:1 精确一致）复制入主 worktree，随本条与 brief 一并提交。
  - **合并**：int/P6 与 master 分叉 @ `11b0584`（P6 期 R38–R43 bookkeeping 6 commits 在 master；int/P6 17 picks）→ int/P6 上 `git merge master --no-edit`（无冲突；merge commit `6dac9f6`，parents `54950fb`+`006c85e`）→ master 上 `git merge --ff-only` → **master = int/P6 tip `6dac9f625a3681a64f75da712b324c9518c136cc`**（G5 ff-merge 语义：master 快进到 int 分支 tip）。
  - **授权 push #6**：origin master ← `6dac9f6`（每 gate 一次 sanctioned push；主 Agent 执行；无 force-push）。
  - **Worktree 清理**：G6-R1..R4 worktree 注销 + 目录删除（含 untracked node_modules 残留），分支 `g6-review-r1..r4` 删除（证据已先行完整归档；分支 head SHA 已记录如上）；P6-T6 任务 worktree/分支保留（P1–P6 任务 worktree 保留惯例）。
  - **收尾健康检查**：主 worktree test-use pristine `cd5ef814` porcelain 空；:3080=200；ports 3180/3181/3491–3495 全 free；lockfile 不存在。
- **Graph**：G6-REVIEW → PASSED（verdicts [通过, 通过, 通过]，gate 3/3 PASS，merged_to_master `6dac9f6`，pushed true）；current_phase → P7；ready []（P7 任务 R45 kickoff 定义）。**P6 COMPLETE**。
- **下一步**：R45 —— P7 kickoff（TaskDoc §11.8 DAG：{P7-T1 ∥ P7-T3 ∥ P7-T4 ∥ P7-T5 ∥ P7-T6} → P7-T2（after T1）→ all → P7-T7 → G7；新 int/P7-… 分支 @ master `6dac9f6`）。

## R45 — P7 kickoff（TaskDoc §11.8 定义 P7-T1..T7 + G7-REVIEW；int/P7-advanced-semantics；H1 五并行第一波派发）（2026-08-31，主 Agent）

- **状态**：P6 COMPLETE（R44）；master = `6732601`（origin 同步，push #6 已执行）。P7 = Advanced Semantics / Fork / Handoff / Legacy（TaskDoc §11.8）。
- **DAG（TaskDoc §11.8 verbatim）**：`{P7-T1 || P7-T3 || P7-T4 || P7-T5 || P7-T6} → P7-T2(after T1) ; all → P7-T7 → G7`。第一波 READY = P7-T1/T3/T4/T5/T6（并行组 H1）；P7-T2 = H2（after T1）；P7-T7 = H3（legacy reader + G7 phase e2e）。
- **定义（graph 行已写入，卡片 verbatim 摘要）**：
  - P7-T1（A, H1）：compatibility drift + ACK lifecycle；owns `packages/runtime/compatibility/**`；probe generation + warning ACK fingerprint + drift→new work admission（in-flight settle / new work block）；必须测试 fingerprint change / stale ACK / cold resume / in-flight drift；验收 drift semantics 与 frozen spec 一致（DevPlan 20.1）。
  - P7-T3（A, H1）：Archive/Restore/Dispose + descendant drain；owns `packages/runtime/lifecycle*`；close admission→interrupt→drain→release→commit；Restore 只 ARCHIVED→SETTLED 绝不 agents.resume；Dispose 保历史；必须测试 archive running / nested subagent drain / restore no agent / dispose race；验收 quiescence 与 durable lifecycle 一致（DevPlan 20.3）。
  - P7-T4（A, H1）：Fork reconciliation；owns `packages/runtime/fork*；persistence reconciliation`；lazy root fork sidecar（same Blueprint snapshot + zero members）；Member fork ordinary Session；不 patch session.fork；repeat reconcile 幂等；必须测试 root/member/ordinary fork / crash during sidecar / repeat reconcile；验收 Root/Member fork exact frozen semantics（DevPlan 20.4）。
  - P7-T5（A, H1）：Start Team from Here；owns `packages/runtime/handoff*`；source canonical surface freeze→one-shot summary/handoff→new TeamIntent/Root；无 live link；必须测试 snapshot once / source mutate / target inspect / failure before root create；验收 handoff 一次性上下文、不建立 cross-session memory（DevPlan 20.5）。
  - P7-T6（B, H1）：Legacy teammate adapter；owns `packages/legacy/teammates-adapter*`；`.dsh/teammates` one-time Blueprint import only；无 watcher / 无 live runtime authority；必须测试 import valid/invalid / duplicate / source changes after snapshot；验收 legacy definition 可生成新 Blueprint 但不控制既有 TeamSession（DevPlan 20.6）。
  - P7-T2（A, H2, PENDING）：Runtime mutation/provenance；owns `packages/runtime/mutation*；policy adapters`；base = T1 pick 后（派发时定）。
  - P7-T7（A, H3, PENDING）：Legacy Team Session read-only reader + G7 e2e；owns `packages/legacy/session-reader*；P7 e2e`；base = T1..T6 picks 后。
  - G7-REVIEW（PENDING）：3 全新独立盲审 reviewer（TaskDoc 11.8 六步方法）；criteria DevPlan 20.7（9 项：warning/fatal admission semantics、ack fingerprint invalidation、human override precedence、lifecycle quiescence、Restore does not create/resume Agent、Root fork exact semantics、Member fork ordinary semantics、handoff one-shot/no-live-link、legacy old Team cannot mutate/resume）。
- **Branch**：`int/P7-advanced-semantics` @ master `673260198e2f90474678087fa7518bdd241403b8`（rev-parse 验证）；integration_sha 更新；ready [P7-T1, P7-T3, P7-T4, P7-T5, P7-T6]。
- **Worker 派发（本轮，workflow `p7-first-wave`，5 并行 leaf worker，全部 qiyuan-self/qwen3.8-27b，各 counted attempt 1/3）**：worktrees `.worktrees/P7-T1|T3|T4|T5|T6` + 分支 `task/P7-T1-compat-drift-ack / task/P7-T3-lifecycle-archive / task/P7-T4-fork-reconciliation / task/P7-T5-handoff-start-from-here / task/P7-T6-legacy-teammate-adapter` 各 @ `6732601`（主 Agent 创建；1 task=1 branch=1 worktree=1 writer）。Brief：`dev/agent-workflow/briefs/P7-first-wave-brief.md`（5 任务卡 verbatim + 共享协议：冻结 4 文档 hash 复核、canonical chain 1214 基线 + tsc ×5、zero-core/private-import/owned-boundary、DEC-1 p4t6 330 维护（三处一致 + scanner byte-identical）、P7T<N>_REPORT 报告格式、红线、≤3 attempts、失败处理）。**本波不启动真实 DSH 实例**（单元/集成级 negative+positive 测试；phase 级 real-instance E2E 归 P7-T7）→ 5 worker 无共享资源、可安全并行。
- **Post-worker 协议（主 Agent）**：每 worker 返回 → 独立审计（rev-parse/status/log 验证 + 该 worktree chain 重跑 + tsc ×5 + zero-core/owned-boundary + p4t6 计数 union 收敛）→ 串行 pick `-x` 到 int/P7 → int 独立 chain 重跑 → INTEGRATED；T1 集成后 P7-T2 READY。
- **下一步**：R46 —— 第一波 worker 结果审计 + 集成（视 attempt 情况含缺陷修复）。

## R46 — P7 第一波主 Agent 独立审计 + 集成（int/P7 @ `3aa146c`，1399/1399；ready → P7-T2）（2026-08-31，主 Agent）

- **状态**：P7 第一波（H1 五并行）workers 全部 settled（R45 经 workflow `p7-first-wave` 派发，均 qiyuan-self/qwen3.8-27b；报告文本按设计不可恢复，磁盘为真：5 条任务分支 + evidence）。本轮 = 主 Agent 独立审计 + 串行集成 + 基线复验 + R45 勘误。
- **分支普查（主 Agent）**：5 分支各 1 个干净 worktree（T4 分支为 2 commits：`bab3b3a` code + `1e721b0` evidence，其余各 1 commit）；新增文件全部在卡片 owned paths + p4t6（DEC-1）+ evidence 内；T6 的 12 个 .md fixtures 位于 `packages/legacy/test/fixtures/teammates*/`（scanner 不计，作为测试交付物可接受）；worker 报告的 SHA 全部 rev-parse 复核一致。
- **p4t6 逐分支核验（DEC-1）**：分支断言 341（T1=330+11）/ 343（T3=+13）/ 341（T4=+11）/ 342（T5=+12）/ 334（T6=+4）与主 Agent 独立重算全部一致（scanner 仅计 `packages/<pkg>/` 下 .ts/.mts/.mjs，.md 不计）；scanner `.mjs` 五分支 byte-identical；集成并集预期 = **381**。
- **审计事故（R1 作废，记录在案）**：5 条并行后台审计链中 —— (a) T3/T4/T5/T6 的 run-tests leg 实际在**主仓库**执行（workdir 配置错误）：主仓库 `packages/testkit/test/.tmp-fault` scratch 被并行同名测试互踩 → 3 个文件 import/evaluation 错误（p4t5-corrupt-version / p4t5-crash-matrix / p6t6-guard，错误路径指向主仓库，为"主仓库执行"的决定性证据）；totals 1214/1185/1206/1206 均偏离 worktree 预期值；(b) 五 worktree 的 tsc leg 全部无效（TS5023：`'-p <path>'` 被作为单参数传入）。R1 裁决：仅 T1（1275/1275）有效，其余四条链整体作废；主 Agent 审计重跑不消耗 worker 的 ≤3 次/task 协议额度。
- **R2 重审（串行，磁盘证据）**：每 worktree 先落 `git toplevel` + `HEAD` 证明再执行（`pnpm install --ignore-scripts` → `node scripts/run-tests.mjs` 全量 → tsc ×5，参数修正为 `'-p'` 与路径两个独立参数）：T1 `b17187d` **1275/1275**（=1214+61）、T3 `1fb3e6a` **1238/1238**（=+24）、T4 `1e721b0` **1261/1261**（=+47）、T5 `2da480c` **1247/1247**（=+33）、T6 `11b7978` **1234/1234**（=+20）；各分支 tsc ×5 全 exit 0；主基线复验 `1d0c8d0` **1214/1214** + tsc ×5。日志内 LOCATION MISMATCH 标记为 `/` 与 `\` 路径比较假阳性（toplevel 路径本身全部正确）。证据：`evidence/P7-TN/main-audit-chain-r2.log` + `evidence/baseline-main-r2.log`。
- **zero-core / import-face 抽查**：主 Agent 对 5 模块新文件（compatibility / lifecycle / fork-reconciliation / handoff / legacy adapter）specifier 扫描：仅 intra-repo 相对 import + vitest（测试文件）+ node: 内建（仅 .mjs/.d.mts seam，允许）；无 upstream 私有路径；与 worker zero-core 证据（T1/T3/T4 日志）一致。
- **T5 卫生发现（LOW）**：worktree 根 0 字节未跟踪临时文件 `_tmp_54076_1e0f24e55f31b312ea3a62c17747dc39`，集成前已删除。
- **集成（`int/P7-advanced-semantics`：`6732601` → `3aa146c`）**：串行 `cherry-pick -x`：T1 `b17187d`→`f13f963`（无冲突）→ T3 `1fb3e6a`→`ec53da7` → T4 `1e721b0`→`db4a0d4`（evidence）+ `bab3b3a`→`3ddbe47`（code）→ T5 `2da480c`→`da339fc` → T6 `11b7978`→`3aa146c`。p4t6 每 pick 必冲突（五分支同区域）：新工具 `dev/agent-workflow/tools/resolve-p4t6-conflicts.mjs` 按 DEC-1 累积并集裁决（354→365→377→381 + T6 标题翻转 "nine carry source, legacy carries the P7-T6 adapter"；withSource 8→9 / legacy 0→4 由 git 自动合并）。
- **集成事故（2 个污染 commit，均当场修复，int 分支无残留）**：(1) resolver v1 循环漏自增索引（RangeError）崩溃 exit 1 后，误将仍含冲突标记的文件 `git add` + `--continue` → 污染 commit `9c2d2c6`；经 reflog 定位 → `reset --hard HEAD~1` + 重 pick。(2) 重 pick 中 resolver v2 被 CRLF `endsWith` 误判 → v3（按文件原生 EOL split/join）成功；但该次 `--continue` 又产出污染 commit `f800d70`（p4t6 含标记；CHERRY_PICK_HEAD 状态异常机制未定）→ `git commit --amend --no-edit` 修复为 `ec53da7`（int 分支仅本地、未 push，amend 安全）。**新增常设规则**：每次 cherry-pick 后必须 grep HEAD 内 p4t6 的冲突标记 + 累积计数验证，再继续下一 pick；发现污染 commit 立即 amend 或 reset+重 pick 并记录。
- **int 链（主 Agent 独立）**：int tip `3aa146c`：**1399/1399**（=1214+61+24+47+33+20，与预期精确一致）+ tsc ×5 全 exit 0；p4t6 扫描 381 文件（并集）断言通过。证据：`evidence/int-P7/main-audit-chain.log`。
- **R45 勘误（补记）**：R45 kickoff 记账（brief `P7-first-wave-brief.md` + log "## R45 — P7 kickoff" 18 行 + graph P7 八行）经 `git show 1d0c8d0` 确认完整在 master；本轮早前"graph 缺 P7 行"的判断系误读——当时读文件位于 int 分支工作树（int 派生自 `6732601`，不含 R45 记账），非 master 状态缺失。另有 R45 不精确更正：worktree 实际创建于 `1d0c8d0`（含 R45 bookkeeping commit，代码等价于 `6732601`），graph 各 T 行 base_sha 已更正为 `1d0c8d0`；int 分支创建基点 `6732601` 无误（int 确从该点分叉）。
- **状态更新**：graph：P7-T1/T3/T4/T5/T6 → INTEGRATED（attempts 1/3）；ready `[P7-T2]`（base = int tip `3aa146c`）；P7-T7、G7-REVIEW PENDING；integration_sha → `3aa146c801ed7509cc23c1b414665de5a5363180`。push #7 仍仅限 G7（origin master `6732601`；local master 领先 1 commit = 本条记账）。
- **下一步**：R47 —— P7-T2 派发（单 worker，qiyuan-self/qwen3.8-27b；owns `packages/runtime/mutation*` + policy adapters；验收：Effective Configuration 每项有来源、非法 escalation 被拒；DevPlan 20.2；卡片 TaskDoc §11.8）。

## R47 — P7-T2 worker 执行 + 主 Agent 独立审计 + 集成（int/P7 @ `c53f1b0`，1510/1510；ready → P7-T7）（2026-08-31，主 Agent）

- **Brief**：`dev/agent-workflow/briefs/P7-T2-brief.md`（master `3b1c2de`，R47 kickoff commit）：TaskDoc §11.8 L1595–1608 卡片 verbatim + DevPlan 20.2 语义 + seam matrix failure codes（MODEL_SELECTION/TOOLS_SCOPE/SKILL_SCOPE/MCP_SCOPE）；基线固定 base `3aa146c` = 1399/1399 + tsc ×5、p4t6 起点 381；明示禁止 real-instance E2E（unit/integration only，注入 fake ports）；§5 工具链纪律显式写入 tsc 独立参数规则（TS5023 教训）与 p7t2 测试须落 `packages/runtime/test/` 顶层目录的发现规则。
- **派发**：workflow 单 leaf，provider `qiyuan-self` / model `qwen3.8-27b`；worker attempts 1/3。
- **Worker 结果（P7T2_REPORT，已 disk-verify）**：分支 `task/P7-T2-runtime-mutation` @ `.worktrees/P7-T2`；code commit `75e32ad`（parent = base `3aa146c` ✓）+ evidence commit `20f7617`；13 个新 countable 文件（`packages/runtime/mutation/{types,errors,envelope,service,index}.ts` + `policy-adapter.ts` + 7 测试文件 = helpers + 6 suites）+ p4t6；全链 1399 → **1510/1510**（+111：future-boundary 16 / escalation 40 / override-precedence 12 / policy-state 18 / creation-fields 13 / provenance 12）；tsc ×5 exit 0；p4t6 381 → **394**（N=13；withSource 9、legacy 4 不变；title 增 "runtime carries the P7-T2 mutation files" 从句——与 T6 title flip 同种的事实性扩展，不影响断言）；zero-core pass（13 个 .ts 文件 `node:` import 0 命中；主 Agent 独立复扫亦 0）。Worker 自报 deviations（与 design-note 核对一致）：suppression dedupe key = capability|layer|policyStateId；`StoredMutationRecord.member` 存 null 而非 undefined（lossless JSON）；fake-store 防御性拷贝；baseline 首次 attempt 遇瞬态 ENOTEMPTY（环境性）→ 记录在案的 baseline 为 clean 重跑（1399/1399）；index.ts re-export 重复疑虑核实为 false alarm。
- **主 Agent 独立审计（R46 教训：在 T2 worktree 内串行执行，日志含 git toplevel/HEAD 证明）**：1510/1510、0 failures、tsc ×5 exit 0 → `evidence/P7-T2/main-audit-chain.log`；p4t6 marker 扫描 0；worktree status clean（无 stray 文件）。
- **集成（cherry-pick -x → int/P7；本轮新建 worktree `.worktrees/int-P7`）**：`75e32ad` → `c9c3b76`（clean——T2 base 即当时 int tip，p4t6 上下文一致未冲突；pick 后 HEAD p4t6 验证：0 markers / 394 / P7-T2 enumeration comment L119，standing rule 执行）→ `20f7617` → `c53f1b0`。新 int tip = `c53f1b008d59b803f51d2c107ffffb7846a8bb9c`。
- **int 链（主 Agent 独立，in-worktree @ 新 tip）**：**1510/1510**（=1399+111）+ tsc ×5 全 exit 0 → `evidence/int-P7/main-audit-chain-r47.log`。
- **健康检查**：:3080=200；test-use pristine @ `cd5ef814`（0 dirty lines）；ports 3180/3181 free。
- **状态更新**：graph：P7-T2 → INTEGRATED（attempts 1/3，head `20f7617`）；ready `[P7-T7]`（base = int tip `c53f1b0`，base_sha 已定）；P7-T7 → READY；integration_sha → `c53f1b0…`。push #7 仍仅限 G7（origin master `6732601`；local master 领先 4 commits：R45 `1d0c8d0`、R46 `e57f25a`、R47 brief `3b1c2de`、本条记账）。
- **下一步**：R48 —— P7-T7 派发（legacy Team Session 只读 reader + G7 e2e；owns real-instance E2E + lockfile 协议；H3；criteria DevPlan 20.7 ×9；method TaskDoc 11.8 六步）→ 其后 G7 gate（3 fresh 盲审 reviewer，verdicts 以 disk 证据为准，PASS 则 push #7）。

## R48 — P7-T7 worker 执行 + 主 Agent 独立审计 + 集成（int/P7 @ `298d636`，1588/1588；ready → G7-REVIEW）（2026-08-31，主 Agent）

- **Brief**：`dev/agent-workflow/briefs/P7-T7-brief.md`（master `0c9ad46`，R48 kickoff commit）：TaskDoc §11.8 L1670–1683 卡片 verbatim + DevPlan 20.7 九准则 verbatim；本任务为 P7 唯一 real-instance E2E（owns e2e + lockfile 协议）：模板 = P6-T6 `packages/tools/harness/{run.mjs,plugin.mjs}`（copy-and-adapt，原件禁改），落位 `packages/legacy/session-reader/e2e/`（TEST-ONLY）；机制全量沿用 TEST_METHODS §2/§5 + P6-T6 实证（FILE-FD stdio、DSH_HOME=`references/.dsh-test-p7t7` fresh-per-run、DSH_CLIENT_COMMIT_HASH=`cd5ef814`、row-mount `cordis.patch.yml`、ports 3180(+3181)/mini-MCP 3491–3495、lockfile `references/.dsh-test-p7t7.lock` 20s×≤45 重试/10min stale）；e2e 最低场景 L1 legacy view / L2 mutation reject / L3 native degradation（G7 准则 9 端到端）；**严格回退**（预授权）：仅当 environmental/sandbox 原因 + ≥1 次完整 harness 尝试留痕 → 交付 A+C（in-process 全准则证据）+ 报告末行 `BLOCKER:E2E_ENV`，主 Agent 裁决；禁止静默跳过报 PASS。基线固定 base `c53f1b0` = 1510/1510 + tsc ×5、p4t6 起点 394。
- **派发**：workflow 单 leaf，provider `qiyuan-self` / model `qwen3.8-27b`；worker attempts 1/3。
- **Worker 结果（P7T7_REPORT，已 disk-verify）**：分支 `task/P7-T7-legacy-session-reader` @ `.worktrees/P7-T7`；3 commits（`acf04b0` code 18 files / `6dd7e91` evidence 10 files / `5475cd8` harness-output，parent 链 = base `c53f1b0` ✓）；17 新 countable 文件（reader 5 × .ts + e2e 5 × .mjs + 测试 7 = helpers + 6 suites：legacy-read / mutation-reject / integrated-{drift-ack, override-admission, lifecycle-restore, fork-handoff}）+ p4t6；全链 1510 → **1588/1588**（+78）；tsc ×5 exit 0；p4t6 394 → **411**（N=17；withSource 9 不变；legacy 4 → 21；title 增 "and the P7-T7 session reader"）；**e2e run #3 PASS**（L1 17/17、L2 11/11、L3 7/7；runs #1/#2 分别暴露本任务自有 harness bug A/B——fixture-planting 解构错 / zstd session backend 拒绝 boot 前 plain .jsonl → fixtures 改 post-boot 植入，均已在 owned e2e 文件内修复并留痕）；test-use pristine before+after（`cd5ef814`、status/diff 空）；ports 3180+3491 释放；:3080=200 before+after；g7-report **9/9 PASS**；zero-core pass（.ts 0 `node:` import；4 处 `node:`/`require(` 命中全为注释）。Worker 自报 deviations D1–D4（与 design-note §3 表格核对一致）：D1 lenient roster parse（逐缺陷 `ROSTER_WARNING_REASONS` 记录，best-effort 授权）；D2 lenient header recognition；D3 不施加 legacy leader-demotion（read-only 检视范围，vNext 语义归 runtime 包，集成套已在真实 runtime 对象上证明）；D4 无 seq 的 team-event 行容忍。
- **主 Agent 独立审计（在 T7 worktree 内串行，git toplevel/HEAD 证明入日志）**：1588/1588、0 failures、tsc ×5 exit 0 → `evidence/P7-T7/main-audit-chain.log`；import-face 复扫 12 个新 .ts 文件 0 命中；p4t6 HEAD 0 markers / 411 / 21 / title 完整；worktree status clean（lockfile 已 finally 删除、无 stray）；g7-report 与 harness-output（summary.json + L1/L2/L3.json + boot logs + git-diff/status 空）逐项 disk-verify。
- **集成（cherry-pick -x → int/P7，worktree `.worktrees/int-P7`）**：`acf04b0` → `2417856`、`6dd7e91` → `f9f11df`、`5475cd8` → `298d636`，三 pick 全 clean（T7 base = 当时 int tip，无 p4t6 冲突；pick 后 HEAD p4t6 验证 0 markers / 411）。新 int tip = `298d6364d2ebcb03eff0073c352e2174b0fd433f`。
- **int 链（主 Agent 独立，in-worktree @ 新 tip）**：**1588/1588**（=1399+111+78）+ tsc ×5 全 exit 0 → `evidence/int-P7/main-audit-chain-r48.log`。
- **健康检查**：:3080=200；test-use pristine @ `cd5ef814`（0 dirty）；ports 3180/3181/3491–3495 全 free；lockfile 无残留（main repo 与 T7 worktree 均无）。
- **状态更新**：graph：P7-T7 → INTEGRATED（attempts 1/3，head `5475cd8`）；ready `[G7-REVIEW]`（base = int tip `298d636`，base_sha 已定）；integration_sha → `298d636…`。push #7 仍仅限 G7（origin master `6732601`；local master 领先 5 commits：R45 `1d0c8d0`、R46 `e57f25a`、R47 brief `3b1c2de`、R47 bookkeeping `dd73b04`、R48 brief `0c9ad46`、本条记账为第 6 个）。
- **下一步**：R49 —— G7-REVIEW gate：3 fresh independent blind reviewer（workflow 三 leaf，均 `qiyuan-self`/`qwen3.8-27b`；TaskDoc 11.8 六步法：checkout int SHA `298d636` → 读上位文档 Gate 条目 → 重跑关键 pos/neg tests → zero-core/private-import/owned-boundary → cross-task invariant 组合审查 → criterion→evidence PASS/FAIL ×9）；verdicts 以 committed disk 证据为准（通过/投机通过/补充内容/阻塞）；3/3 ∈ {通过, 投机通过} → ff-merge master + **push #7**；任一 补充内容/阻塞 → 按 ROUTER_RULES 处置。worktree 清理（P1–P7 全部任务 worktrees + 残留 R1 日志）留待 G7 PASS 后。

## R49 — G7-REVIEW gate：3 fresh independent blind review → **PASS（3/3 通过）** + close-out（int/P7 @ `298d636`，1588/1588）（2026-08-31，主 Agent）

- **Brief**：`dev/agent-workflow/briefs/G7-review-brief.md`（master `8fce4e1`）：严格 blind 规则（禁开/禁 grep `dev/agent-workflow/` 一切内容，唯一例外 = 在自己 worktree 写自己的 report）+ TaskDoc 11.8 六步法 + DevPlan 20.7 九准则 + real-instance e2e 重跑（lockfile 串行化）+ 四裁决 + 固定 `G7RN_VERDICT` 末消息格式。e2e 重跑在 reviewer 各自 worktree 执行；harness 硬编码主 repo 共享 `DSH_HOME=references/.dsh-test-p7t7` → 必须用外部 PowerShell 锁包装（`references/.dsh-test-p7t7.lock`，75×20s 预算 / stale ≥10min 删除 / ownership 校验 finally 删除）；ports 3180/3181/3182 + mini-MCP 3491–3495 auto。注：worker 的 `run.mjs` 未实现 brief 要求的内建 lockfile（R49-prep 发现的 gap）；裁决 = 可接受（gate 的外部包装完整覆盖串行化要求），记录为已知偏差。
- **派发**：workflow `g7-blind-review`（3 parallel leaves，`parallel()` 屏障），每个 `agent()` 显式 `provider:'qiyuan-self'` + `model:'qwen3.8-27b'`；brief 全文内嵌每 prompt 并做 RN/`<N>`/reviewer-N → 1/2/3 替换；leaf 禁止再拉子代理。review 轮次不消耗 worker attempts（ROUTER_RULES：review round ≠ worker attempt）。
- **Verdicts（以各 reviewer worktree disk 证据为准；与 workflow 返回文本交叉核对一致）**：
  - **R1 通过**（`.worktrees/G7-1` @ `298d636`，命名偏离 brief 的 `G7-R1`，无实质影响）：全链 **1588/1588**（0 failures）+ tsc ×5 exit 0；zero-core PASS（lockfile vs base `6732601` 无变化；唯一 postinstall/patch-package 命中为 base SHA 已存在的负例 fixture `scripts/fixtures/zero-core/plugins/bad-plugin-a/package.json`，由 `scripts/verify-zero-core.mjs` 消费）；private-import PASS；owned-boundary PASS（94-file diff vs base 全部映射进 P7 owned globs + DEC-1 例外）；e2e 一次绿、无锁竞争（:3180 + MCP :3491，L1 17/17 / L2 11/11 / L3 7/7，postflight pristine + ports released + :3080 未受影响）；九准则全 PASS（逐条证据表：probe/gateNewWork/settleWork、acknowledge 指纹绑定 + stale generation 重阻、六层 override 序经真实 T2 MutationService、quiesce 五步 fail-closed、restore ARCHIVED→SETTLED 单 COMMIT_RESTORE 零 live-contact、root fork crash-safe 序 + 幂等、member fork 零写普通 AgentSession、handoff one-shot、legacy 拒绝 + home sha256 字节一致）；自报：一处模板歧义（hard-rule 4 `G7R1_VERDICT` vs §7 模板 `G71_VERDICT`）按 hard rule 裁决。
  - **R2 通过**（`.worktrees/G7-2` @ `298d636`）：全链 **1588/1588** + tsc ×5 exit 0（含逐包时间戳）；zero-core / private-import / owned-boundary（94/94）PASS；e2e L1/L2/L3 PASS + 独立 test-use pristine 复核；九准则全 PASS。自报非阻塞观察：e2e wall ~5s 因 build chain 跳过既有 farm artifacts（test-use node_modules 由早前 T7 run 自同一 pristine `cd5ef814` 安装，源码树 pristine 已验证 HEAD/porcelain）—— boot 仍真实（marker 行、dump-config row mount、live MCP handshake、35 tool-call assertions）。**Blinding 事件（自报，已文档化于重生成 boundary-checks.log）**：初稿 faulty `git grep` pathspec 使一个 scan window 带入 `dev/agent-workflow/SESSION_ROUTER_LOG.md` 数行（G6 时代、不同 gate）；该文件从未被打开、无任何引用，日志已重生成以消除泄漏。
  - **R3 通过**（`.worktrees/G7-3` @ `298d636`）：全链 **1588/1588**（0 failures）+ tsc ×5 exit 0；五项 boundary 检查 PASS；lockfile 串行 real-instance E2E **35/35 assertions** 绿（:3182 + MCP :3491；bootMarkerLine `dsh web: http://127.0.0.1:3182/...` 已验证）+ 独立 pristine/ports 验证；九准则全 PASS（全部 P7 模块 source-level 系统级阅读：admission↔mutation provenance、quiesce×admission、fork/handoff 不绕过 policy、session-reader read-only-by-construction）；无阻塞 concerns。
- **Gate 裁决**：3/3 ∈ {通过, 投机通过} → **G7 PASS**（ROUTER_RULES）。
- **Post-gate 环境验证（全绿）**：:3080=200（稳定实例未受影响）；ports 3180–3182 + 3491–3495 全部释放；无 lockfile 残留；test-use pristine（HEAD `cd5ef81481`，porcelain 0）；main worktree 干净。
- **证据归档**：46 files 从三个 reviewer worktrees → `dev/agent-workflow/evidence/G7-REVIEW/reviewer-{1,2,3}/`（各含 report.md + chain-rerun.log + boundary-checks.log（+ .ps1）+ owned-boundary-diff.txt + e2e-run.log + harness-output/（summary.json、per-scenario JSON、boot logs、git logs）），归档在 worktree 清理之前完成。
- **Close-out（已执行）**：(a) merge master 入 int/P7（bookkeeping catch-up，仅 dev/agent-workflow/ 路径，clean）；(b) ff master 至 int tip；(c) **push #7**（sanctioned，每 Gate 一次推送）；(d) graph.yaml：G7-REVIEW PASSED + current_phase → P8 + ready []。
- **下一步**：R50 —— P8 kickoff（Team Remote + Projection；DevPlan §21：projection source = TeamDomain + optional live overlay，禁扫 Root+child Session logs；Remote API 类别 catalog.list/get、intent.probe 等）：读冻结文档 P8 任务卡 → 声明 P8 任务条目 + `int/P8-*` 集成分支 → brief + 派发（全部 `qiyuan-self/qwen3.8-27b`）。worktree 清理（P1–P7 任务 worktrees + G7-{1,2,3} + int-P7 + 残留 R1 日志）推迟到 P8 第一波稳定后，以保留 P7 回滚选项。

## R50 — P8 kickoff（TaskDoc §11.9 P8-T1..T5 + G8；int/P8-remote-projection @ `959e363`；P8-T1 派发）（2026-08-31，主 Agent）

- **P7 完结回顾（R49 收尾）**：G7-REVIEW **PASS 3/3**（R1/R2/R3 全部 通过；各自 1588/1588 + tsc ×5 + boundary 3/3 + lockfile 串行 e2e 35/35）；46 证据文件归档 `dev/agent-workflow/evidence/G7-REVIEW/reviewer-{1,2,3}/`；int/P7 并入 master（merge commit）后 ff master 至 `959e363`；**push #7 完成**（origin `6732601` → `959e363`，每 Gate 一次 sanctioned push）；graph current_phase → P8。
- **P8 任务声明**（TaskDoc §11.9 + DevPlan §21；严格串行 DAG `T1→T2→T3→T4→T5(G8)`，无并行波）：
  - P8-T1（I0, A）：冻结 TeamProjection DTO v1 — owns `packages/contracts/src/projection/**`；前置 P7-T7（✓）；baseline 1588/1588 + p4t6 411。
  - P8-T2（I1, A）：Projection service — owns `packages/runtime/projection/**`；TeamDomain + live overlay only，禁扫 Session logs。
  - P8-T3（I2, A）：Remote contract v1 + Host handlers — owns `packages/remote/contracts*` + `handlers*`；separation 按 21.3 固定。
  - P8-T4（I3, B）：push/generation/reconnect/pagination — owns `packages/remote/push*` + test client。
  - P8-T5（I4, A）：Remote contract 独立 review + G8 — review/e2e only；DevPlan 21.5 六准则。
- **集成分支**：`int/P8-remote-projection` @ `959e363` + worktree `.worktrees/int-P8`（node_modules install 日志 → `dev/agent-workflow/evidence/int-P8/install-r50.log`）。
- **Brief**：`dev/agent-workflow/briefs/P8-T1-brief.md`（§0–§12：base `959e363` / branch `task/P8-T1-projection-dto` / owned glob + DEC-1 / sanctioned chain + tsc 分参规则 / p4t6 411→411+N / 必须测试 serialization+generation monotonic+nullable overlay + negative tests / zero-core 红线 / code+evidence 两提交 / 固定 `P8T1_REPORT` 格式 / attempts 1/3 / BLOCKER 固定格式 / :3080 前后健康检查）。
- **派发**：workflow 单 leaf，`agent()` 显式 `provider:'qiyuan-self'` + `model:'qwen3.8-27b'`；worker attempts 1/3；leaf 禁止再拉子代理。
- **下一步**：P8-T1 交付 → 主 Agent in-worktree 独立审计（int-P8 worktree：chain + tsc ×5 + import-face + p4t6 markers）→ cherry-pick -x 至 int/P8 → P8-T2（base = P8-T1 后的 int tip）→ … → G8（3 blind reviewers，同 G7 机制）→ **push #8**。注意：P8-T1 冻结新 projection contract 后，需按先例核对 graph `locks.contracts` 哈希是否需更新（P3-T1 冻结先例）。

## R51 — P8-T1 worker 执行 + 主 Agent 独立审计 + 集成（int/P8 @ `48b3334`，1638/1638；ready → P8-T2）（2026-08-31，主 Agent）

- **Brief**：`dev/agent-workflow/briefs/P8-T1-brief.md`（master `d8971c6`，R50 kickoff commit）：TaskDoc §11.9 P8-T1 卡片 verbatim + DevPlan §21 设计约束（21.2 source 边界 / 21.4 generation 模型 / 21.3 类别覆盖 / Arch 对象模型与冻结 lifecycle states）+ base `959e363` + owned glob + sanctioned chain + tsc 分参 + p4t6 411→411+N + 必须 3 测试 + negative tests + zero-core 红线 + code/evidence 两提交 + 固定 `P8T1_REPORT` 格式 + :3080 前后健康检查。
- **派发**：workflow 单 leaf，`agent()` 显式 `provider:'qiyuan-self'` + `model:'qwen3.8-27b'`；worker attempts 1/3。
- **Worker 结果（P8T1_REPORT，已 disk-verify）**：分支 `task/P8-T1-projection-dto` @ `.worktrees/P8-T1`；2 commits（`2e89897` code 17 files / `c3e5b36` evidence 4 files，parent 链 = base `959e363` ✓，worktree clean）；12 projection src 模块（schema / states / common / effective-config / compatibility / activity / template / root / member / ledger / projection / index）+ 纯增量 `packages/contracts/src/index.ts`（+123 行 export block，既有 surface 零改动）+ 5 测试文件（fixtures + serialization/generation/overlay/negative 四 suite）+ p4t6；全链 1588 → **1638/1638**（+50：serialization 11 / generation 8 / overlay 8 / negative 23）；tsc ×5 exit 0；p4t6 411 → **428**（N=17；withSource 9 不变；legacy 21 不变）。
- **主 Agent 独立审计**：task worktree 全链 **1638/1638** + tsc ×5 exit 0（log `evidence/P8-T1/main-audit-chain.log`）；zero-core/import-face：17 新 .ts 文件 0 `node:` import、0 upstream/references import；`contracts/src/index.ts` diff 纯增量核对 ✓；**int 链**（post-pick，`.worktrees/int-P8` worktree 内运行，toplevel/HEAD 留痕） **1638/1638** + tsc ×5（log `evidence/int-P8/main-audit-chain-r51.log`）。
- **集成**：cherry-pick -x 两提交 → int/P8（`c39cc90` code / `48b3334` evidence，clean，无 p4t6 冲突：任务分支自 int tip 分出）；post-pick HEAD 验证 0 markers / 428。
- **Contract-freeze bookkeeping**：P3-T1 冻结核心 Team contracts（graph `locks.contracts` = `fba817c…` = 当时 int/P3 tip SHA，R10 置位）；P8-T1 为冻结 TaskDoc 指定的 "P8 shared write lock owner"，纯增量新增 `projection` 契约区（自有 schema-version track `PROJECTION_SCHEMA_VERSION`，既有冻结 export surface 零改动，negative suite 钉住字段边界）→ `locks.contracts` 保持原值（记录 P3 冻结点），P8-T1 卡片授权在此留痕。
- **偏差/concerns**：worker 无；主 Agent 无。
- **下一步**：R52 —— P8-T2 派发（Projection service，owns `packages/runtime/projection/**`，base = int tip `48b3334`，同协议 brief + `P8T2_REPORT`；必须测试 cold projection / 50 instances / live overlay / disposed+archived；验收 = 与 durable truth 一致、复杂度不依赖完整 child logs）。

## R53 — P8-T2 worker 执行 + 主 Agent 独立审计 + 集成（int/P8 @ `67c3d4e`，1669/1669；ready → P8-T3）（2026-08-31，主 Agent）

- **Brief**：`dev/agent-workflow/briefs/P8-T2-brief.md`（master `8566d3b`，R52 kickoff commit）：TaskDoc §11.9 P8-T2 卡片 verbatim + DevPlan §21 约束（21.2 by-construction 边界 / 21.4 generation）+ P8-T1 DTO 冻结只读 + base `48b3334` + owned glob `packages/runtime/projection/**` + sanctioned chain + tsc 分参 + p4t6 428→428+N + 必须 4 测试（cold / 50 instances / live overlay / disposed+archived）+ negative（无 log-read 面 + 复杂度 guard）+ `P8T2_REPORT` 格式。
- **派发**：workflow 单 leaf，`agent()` 显式 `provider:'qiyuan-self'` + `model:'qwen3.8-27b'`；worker attempts 1/3。
- **Worker 结果（P8T2_REPORT，已 disk-verify）**：分支 `task/P8-T2-projection-service` @ `.worktrees/P8-T2`；3 commits（`8c9acc3` design-note / `0c51c42` code 13 files / `4f7573b` evidence 3 files，parent 链 = base `48b3334` ✓，worktree clean）；6 src（types / errors / ledger / fold / service / index）+ 6 测试文件（helpers + cold/fifty/overlay/terminal/negative）+ p4t6；全链 1638 → **1669/1669**（+31：cold 7 / fifty 6 / overlay 7 / terminal 5 / negative 6）；tsc ×5 exit 0；p4t6 428 → **440**（N=12；withSource 9 / legacy 21 不变）。
- **主 Agent 独立审计**：task worktree 全链 **1669/1669** + tsc ×5 exit 0（log `evidence/P8-T2/main-audit-chain.log`）；zero-core/import-face：12 新 .ts 文件 0 `node:` import、0 upstream/references import；**int 链**（post-pick，`.worktrees/int-P8` worktree 内运行，toplevel/HEAD 留痕） **1669/1669** + tsc ×5（log `evidence/int-P8/main-audit-chain-r53.log`）。
- **集成**：cherry-pick -x 三提交 → int/P8（`ba007cf` design / `ca02ffe` code / `67c3d4e` evidence，全部 clean，无 p4t6 冲突：任务分支自 int tip 分出）；post-pick HEAD 验证 0 markers / 440。
- **验收交叉核对（主 Agent 读 design-note + 测试）**：durable 字段 = TeamDomain verbatim（fold 纯函数）；live overlay 仅进 nullable `liveActivity` lane（不触碰 identity/generation/workspace）；复杂度 guard = 读面（port + source type）无 log-read 面 + 50-member canonical JSON 在 childLogVolume 0 vs 5,000,000 下 byte-identical、21.2 trap counter = 0；ledger pagination 单独处理（ledger.ts 独立读路径，不在 whole fold 内）。
- **偏差/concerns**：worker 将 design-note 拆为独立首提交（3 提交结构，brief 只要求 code/evidence 分离）—— cherry-pick 无碍，可接受，留痕。
- **下一步**：R54 —— P8-T3 派发（Remote contract v1 + Host handlers，owns `packages/remote/contracts*` + `handlers*`，base = int tip `67c3d4e`；seam = P2-T6 实证 `TEAM_REMOTE`：`connection` 服务 `rpc.handle` 注册 public handlers，wire `{"type":"client-request","rpcId","method","payload"}`，envelope `result:{ok,value|error:{code,message}}`；必须测试 round-trip / invalid IDs / admission errors / version mismatch）。

## R54 — P8-T3 派发（Remote contract v1 + Host handlers，base int/P8 @ `67c3d4e`，1669/1669；R52 台账修复）（2026-08-31，主 Agent）

- **R52 台账修复（本轮新发现）**：R53 条目所引 “master `8566d3b`，R52 kickoff commit” 经 `git cat-file -t` 验证**不存在**（master 历史 959e363 ← d8971c6 ← de46f52 ← 97b834d，无 R52 提交；无 `## R52` 日志条目）。R52 轮实际执行过（brief 写出 + workflow 派发，内容已由 R53 条目覆盖），但 P8-T2 brief 文件**从未提交**（在 master 工作区遗留 untracked）。处理：磁盘 untracked 副本以 `fb80e48` 提交（与 R53 条目描述逐项核对一致：base `48b3334` / owned `packages/runtime/projection/**` / `P8T2_REPORT` / 55 行）。旧条目不重写（append-only），本条目为更正记录。**教训**：每轮台账 commit 后必须 `git rev-parse`/`git log` 验证落盘（R52 漏做）。
- **Brief**：`dev/agent-workflow/briefs/P8-T3-brief.md`（本轮提交，136 行）：TaskDoc §11.9 P8-T3 卡片 verbatim + 4 冻结文档 sha256 复核 + 21.3 类别分离（固定：catalog/intent/team/member/override/policy/compat/handoff/legacy，方法名可自定）+ P2-T6 seam 实证摘要（`connection` 服务 `rpc.handle` 注册 public handlers；wire `POST /<channel>/<endpoint>` body `{"type":"client-request","rpcId","method","payload"}`；envelope `result:{ok:true,value}` / `result:{ok:false,error:{code,message}}`；negative contract：no cookie 401 / wrong content-type 415 / method≠endpoint 200 bad-request / handler typed error 200 ok:false / **handler throw → 500，故 handler 必须返回 typed error 结果，禁止 throw**）+ base `67c3d4e`（int/P8 tip，1669/1669 + tsc ×5 + p4t6 440）+ owned `packages/remote/src/contracts/**` + `handlers/**`（+ additive index）+ DEC-1 p4t6 440→440+N + 必须 4 测试（round-trip / invalid IDs / admission errors / version mismatch）+ negative（无 SessionController Team mirror、无 session-log-derived Team truth、全错误 typed）+ 三 commit 分离（design-note / code / evidence，-x per commit）+ `P8T3_REPORT` 固定格式。
- **派发**：workflow 单 leaf `p8-t3-remote-contract`，`agent()` 显式 `provider:'qiyuan-self'` + `model:'qwen3.8-27b'`；brief 以主 worktree 绝对路径引用（worker 只读，禁止写主 worktree）；worker attempts 1/3。
- **下一步**：R55 —— P8-T3 worker 结果审计 + 集成（HEAD/files/status/p4t6 440+N/markers 验证；task worktree 全链 + zero-core/import-face；cherry-pick -x 上 int/P8 + post-pick p4t6 检查；int chain（log `evidence/int-P8/main-audit-chain-r55.log`）；台账 ready → P8-T4）。

## 重审记录

（空）

## blocker / 阻塞记录

（空）

## TODO 列表

- （已解决 R4）P1-T1/T3 host worktree `pnpm install` 磁盘空间风险：实际全部 `pnpm install --ignore-scripts` 成功（test-use 1011 packages、downstream-int、P1-T5 worktree、P1-T1/T3 树），磁盘空间未成为阻塞。
- file-manifest baseline 旧路径（S1）：后续 Phase 重跑校验脚本前对齐 `references\deepseek-harness` 路径（不改动已冻结证据文件本身）。
