# Gate round 1 — Reviewer 1/3（blind）裁决

- Reviewer: subagent `6cd69006-dcd2-453a-b106-5f3f3076c84e`（qwen3.8-27b，fresh，零流程文档/零前轮知识）
- Worktree: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\PBA-REV1` @ `1a5afc6`（detached，起始 clean）
- 环境: node v24.20.0, pnpm 11.7.0

## 裁决：通过（PASS）

DoD 达成，在 reviewer worktree 端到端独立复现，含可选 step-7 全新世界实证。无实质问题；以下发现全部非阻塞。

## 复现日志（均在 reviewer worktree）

| # | 命令 | Exit | 关键输出 |
|---| --- | --- | --- |
| 1 | `pnpm install` | 0 | Done in 1m 3.6s (pnpm 11.7.0)；resolved 463, reused 463, downloaded 0 |
| 2 | `pnpm typecheck` | 0 | Scope 9 of 10；9 包全 Done |
| 3 | `pnpm build` | 0 | 全部 build: Done |
| 3b | `pnpm build:composition` | 0 | glue byte-identical；85 modules/11 css；client-bundle.js 845690 B；**`[check-artifacts-committed] OK: 1020 files`**（闸随后独立重跑：OK exit 0） |
| 4 | `pnpm test`（vitest 全套） | 1 | 1 failed \| 219 passed (220)；Tests 2395 passed (2395)。唯一失败文件 = `p6t1-parallel.test.ts`（已记录负载依赖 flake；本次死于套件级 teardown 竞态：ENOTEMPTY … destroyDir … .tmp-fault\p6t1x-p1）。2395 + 9 = 2404 = 预期总数 |
| 4b | 隔离重跑（先清其失败运行留下的未跟踪 .tmp-fault 残留）`pnpm vitest run packages/runtime/test/p6t1-parallel.test.ts` | 0 | 9 passed (9)——**隔离重跑绿，满足已记录 flake 协议** |
| 5 | `pnpm lint` | 0 | 无 eslint 输出 |
| 6 | `pnpm smoke:composition` | 0 | host/client/composition 三 PASS |
| 7a | `node …/pba-setup.mjs` | 0 | world `references/.dsh-test-pba-2026-09-05T03-49-48`；**首次 add exit=0 直接成功——零 allowBuilds、零重试**；profile yaml 无 allowBuilds 条目；已安装根 manifest 零生命周期脚本；profile deps 精确 spec；`dsh.profile.bundles` 自动含 dsh-agent-team；8/8 安装面产物内容一致（LF 归一，对 task tree @ 1a5afc6）；尾 `PBA-SETUP-OK` |
| 7b | `node …/pba-boot.mjs boot`（PBA_HOME 固定） | 0（保活） | 127.0.0.1:3180 boot 行 + token；auth cookie；index 200/24453 B 注入 dsh-agent-team/client.js；health ok/ready/rootSessionId=team-root/toolCount=10；未认证 catalog.list → 401；dump 行齐；serve combo 200（4,641,555 B，bundleBytesContained:true）；catalog.list 200 携 my-team-bp-1；4/4 产物 byte-identical（LF 归一）；**PBA-READY** |
| 7c | `node …/pba-gentry.mjs`（PBA_STAMP 固定） | 0 | G0–G4 全 PASS（sidebar 全局 entry → overlay loud-unselected → cancel → fresh draft + shipped blueprint pick → probe 就绪 → team.create 200 → overlay close → §4.3 tab gating → team bound → R121 sidebar 行；G4 二次会话 handoff：prepare 恰好一次、无闪烁）。22 team-remote RPCs，failures: none——GENTRY COMPLETE |
| 7d | `node …/pba-boot.mjs stop` | 0 | ports free 3180/3493；D5-STOPPED；独立 netstat 确认 3180–3186/3493 全空 |

## 发现（全部非阻塞）

1. [非阻塞] **PBA kits 在并发多 reviewer 运行下有竞态**（pba-boot.mjs / pba-gentry.mjs）：boot 的默认世界选择（"最新 references/.dsh-test-pba-*"）与 gentry 的默认 state 选择（"最新 pba-state-*.json"）在两个盲审 reviewer 对同一主仓库跑同一 kit 时冲突——本 gate 的第二位 reviewer 与其实际遇到（其 boot 先选中兄弟的 world …T03-50-29，随后输掉 3180 端口竞态；以固定 PBA_HOME/PBA_STAMP + 等端口解决）。注：setup kit 写 `pba-assertions-<stamp>.json` 入 EV 目录，而 boot 的默认检测文档为匹配"携带 pba-assertions 的世界"——env-pin 规避存在但应成为 gate 运行的文档化默认。
2. [非阻塞] **证据 JSON 标签不精确**：kit 产物条目的 `normalizedBytes` 是字符数而非字节（client-bundle.js 记 "841826 B LF"，真实 LF 字节数为 845690；已验证 kit 的 normalizedSha256 等于真实 LF 字节的 sha256，故一致性断言本身健全）。
3. [非阻塞] **重建后 git status 外观噪声**：~510 产物文件的 index stat 缓存记录 CRLF 时代尺寸（core.autocrlf=true 检出）；fresh 构建写 LF，故 `git status --porcelain` 显示 ` M` 行而 `git diff` 空、内容一致（逐文件验证：hash-object(disk)==index==HEAD blob；单文件内容重哈希后 status 清除）。开发者在 pnpm build 后目视 git status 可能误判为漂移；闸（filter-aware）是权威检查。gate 头或 INSTALL.md 加一行注记可消除困惑。
4. [非阻塞] README.md ~L81：新 quick-install 段落 `§2)` 前多余前导空格（markdown 外观）。
5. [非阻塞，固有 + 部分已记录] 新鲜度闸比对构建输出 vs git index；无法检测增量构建工具静默跳过重发已变更文件（陈旧 .tsbuildinfo）。此系任何构建后检查的固有限制；头注记录的已删源码残留缺口是接受的子集。无需行动；入风险账本。

无阻塞发现。manifest 验证：根 package.json diff 仅触 scripts 块（prepare 移除；setup + check:artifacts 增加；build:composition 现链闸）——files/exports/dsh/deps 未变；根 manifest 无任何生命周期脚本；仓库内仅有的生命周期脚本在 zero-core 测试 fixture（scripts/fixtures/zero-core/plugins/bad-plugin-{a,b}），在 files 白名单外且非 workspace 成员。.gitignore 恰增两条否定规则；git check-ignore 验证：其余 8 个包 dist/ 目录仍忽略、两出货路径下 *.tsbuildinfo 仍忽略、出货路径本身解除忽略。跟踪产物计数：1017（packages/runtime/dist）+ 3（packages/client/composition-shim）= 1020。已提交产物无机器特定路径（git grep clean）；source map 用相对 sources。文档：INSTALL.md/README.md quick-install 无需 allowBuilds；旧流程降级为 ≤ e832d73 的排障；提交纪律注记已加；无残留旧指令（grep 验证）。

## 产物核验（独立）

- **方法 A（git 原生，全部 1020 文件）**：每个跟踪安装面文件 `git hash-object <fresh build 后 worktree 文件>`（clean-filter 应用，与 git add/闸同语义）vs `git rev-parse 1a5afc6:<path>`（已提交 blob）→ **0 失配 / 1020**
- **方法 B**：fresh build 后全 worktree `git diff` = **空**；新鲜度闸 OK: 1020 files（共跑 3 次，含独立 `node scripts/check-artifacts-committed.mjs`）
- **方法 C（raw 字节，抽样）**：errors.d.ts 已提交 blob = 6065 B LF = fresh build 盘字节（sha256 一致）；client-bundle.js blob = 845,690 B LF = fresh build 盘字节（sha256 一致，hash 22c9de41… == index == HEAD）
- **行尾形式**：规范提交形式为 LF（1019/1020 fresh 输出与 blob raw 逐字节一致；唯一例外 = agent-bindings.mjs——字节拷贝 glue，本 Windows checkout 上 CRLF，拷自 CRLF-smudged 源；clean 到其已提交 LF blob，闸 filter-aware——负测见下）。消费端 smudge（CRLF 检出）亦证行为中性：已安装 CRLF 副本 boot 成功且 gentry 通过
- **闸负测（scratch 工作树拷贝 + 共享 index，$TEMP 内）**：T0 基线 OK(1020)；T1 删跟踪文件 → exit 1 A tracked-but-absent；T2 加未跟踪文件 → exit 1 B produced-untracked；T3 内容漂移 → exit 1 C content-drift；T4 加 *.tsbuildinfo → exit 0（ignore-filter 排除生效）；T5 仅 LF→CRLF 变化 → exit 0（无误报，filter-aware）；T6 CRLF + 真实漂移 → exit 1 C（无 CRLF 旁路）；T7 恢复 → OK。脚本逻辑审阅（check-artifacts-committed.mjs）：三方核对 vs index（stale = index−disk，untracked = disk−index，drift = 交集哈希失配）正确；ROOT=process.cwd() + 路径缺失 fail-loud；hash-object --stdin-paths 计数失配守卫；对 **index**（将被提交之物）比对是正确目标。仅余：固有限制（发现 5）与已记录已删源码残留缺口
- **对 kit 消费安装的交叉核对**：已安装 client-bundle.js（859,918 B CRLF-smudged）→ LF 归一 sha256 6a8395ef… == fresh build/已提交 LF 字节的 sha256；已安装 index.js raw sha256 6d054f5d… == 已提交（blob 之 CRLF-smudge）sha256——committed-blob == fresh-build == consumer-install 链成立
- 注：主仓库 task/plugin-prebuilt-artifacts 分支 tip = 006fdf2（同一 3 commits 的再提交线）；`git diff 1a5afc6 006fdf2` = **空**——树恒等，故 kit 的分支固定安装恰好演练了被审树

## 对 brief 的偏离

1. **3180 端口**：首次检查（~11:33）空闲；运行中被并发（第二）gate reviewer 对同一主仓库跑同一 PBA kit 占用（其 world …T03-50-29，其 boot PID 持 3180/3493）。未触碰其进程；固定 PBA_HOME/PBA_STAMP 到其世界（…T03-49-48），轮询至端口释放（11:56:04），随后跑完整 setup→boot→gentry→stop 序列。teardown 验证：3180–3186/3493 全空
2. **step-7 kit 副作用（reviewer worktree 内）**：kit 写证据入其 EV 目录（位于本 worktree）：12 个新**未跟踪**证据文件（pba-setup/assertions/state/boot 日志、dump-config、serve-check、byte-identity、catalog-list、index html、mock-model 日志、首次错选世界尝试的 pba-boot-…T03-50-29.log）——**保留**为其运行记录；9 个**已跟踪** R132 证据文件（7 browser/gentry-* 捕获 + gentry-report.json + 2 instances/*.log）被其 gentry/boot 运行以新世界捕获覆盖——**全部经 git restore 恢复至已提交状态**（最终全仓 git diff 空）。净：其未留任何跟踪文件修改
3. 首次产物比较用 `git archive | tar` 提取，在本 Windows 机上不可靠（bsdtar 提取回来 CRLF-smudged 对 LF blob，早期 PS 管道损坏 tar 流）——弃用该方法，核验基于 git 原生检查（A/B）+ raw 字节 sha256 抽查（C）。无结论倚赖 tar 提取
4. 按 brief 未读 SESSION_ROUTER_LOG.md、graph.yaml、任何 task-brief.md；裁决立于 diff + 自身复现。用 `git -C <主仓库> rev-parse task/plugin-prebuilt-artifacts`（只读）仅为验证 kit 将安装之物

worktree 留于 HEAD 1a5afc6；git diff 空；未跟踪残留 = 上述 12 个 kit 证据文件（加 node_modules/构建输出，全 gitignored）。无 push、无分支、3080 未触、references/deepseek-harness* 未触（test-use checkout 被 kit 只读使用；R132 保留世界实例 PID 76664 早于其会话运行且不听测试端口——既有，非其）。
