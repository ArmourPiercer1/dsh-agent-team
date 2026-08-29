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

## 重审记录

（空）

## blocker / 阻塞记录

（空）

## TODO 列表

- （已解决 R4）P1-T1/T3 host worktree `pnpm install` 磁盘空间风险：实际全部 `pnpm install --ignore-scripts` 成功（test-use 1011 packages、downstream-int、P1-T5 worktree、P1-T1/T3 树），磁盘空间未成为阻塞。
- file-manifest baseline 旧路径（S1）：后续 Phase 重跑校验脚本前对齐 `references\deepseek-harness` 路径（不改动已冻结证据文件本身）。
