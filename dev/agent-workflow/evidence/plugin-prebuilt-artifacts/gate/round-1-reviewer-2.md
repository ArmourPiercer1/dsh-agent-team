# Gate round 1 — Reviewer 2/3（blind）裁决

- Reviewer: subagent `9e6ac7b9-a0e5-43be-b105-6a7924367f5a`（qwen3.8-27b，fresh，零流程文档/零前轮知识）
- Worktree: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\PBA-REV2` @ `1a5afc6`（detached）
- 环境: node v24.20.0, pnpm 11.7.0（packageManager 精确 pin）

## 裁决：通过（PASS）

DoD 达成，无实质问题。四项 DoD 在 reviewer 独立 worktree 全部复现验证，含可选 step-7 全新世界实证：pnpm 11.7.0 下首次 `add` exit 0 零 allowBuilds、零生命周期脚本已安装 manifest、健康 boot、client bundle 服务、浏览器建队垂直 G0–G4 全绿。

## 复现日志（均在 reviewer worktree）

1. `pnpm install` → exit 0（"Lockfile is up to date, resolution step is skipped"，463 包，1m1.9s）
2. `pnpm typecheck` → exit 0（9/9 包 Done）
3. `pnpm build` → exit 0（"Scope: 9 of 10 workspace projects"，全部 tsc Done；pnpm 正确排除自递归根脚本）；`pnpm build:composition` → exit 0，新鲜度闸行：**`[check-artifacts-committed] OK: 1020 files; committed install-surface artifacts match the fresh build`**
4. `pnpm test` → **exit 0**：`Test Files 220 passed (220)`，`Tests 2404 passed (2404)`。已知 flake `p6t1-parallel.test.ts` 在**全套运行内** 9/9 通过（无需隔离重跑；协议结果 = 全套绿）
5. `pnpm lint` → exit 0（eslint clean）
6. `pnpm smoke:composition` → exit 0（host/plugin/composition 三 PASS）
7. **可选全新世界实证 — 已运行**（3180 复验空闲：初始 Test-NetConnection "IN USE" 仅为 TIME_WAIT 残留——无 listener、ECONNREFUSED、bind probe OK）：
   - `pba-setup.mjs` → PBA-SETUP-OK（exit 0），world `references/.dsh-test-pba-2026-09-05T03-50-29`。核心判据：*"first add exit=0 … SUCCEEDED directly — zero allowBuilds, zero retries"*；profile pnpm-workspace.yaml **无 allowBuilds**（目视确认：仅 packages/nodeLinker/autoInstallPeers）；已安装根 manifest scripts 零生命周期脚本；`dsh.profile.bundles` 自动含 dsh-agent-team（无手写行）；8 安装面产物齐 + 与 task tree @ 1a5afc6 **LF 归一内容一致**
   - `pba-boot.mjs boot`（S8_WT=reviewer worktree）→ PBA-READY：3180 boot 行携 dsh-agent-team/client.js；serve 200 + bundleBytesContained:true；row health ok/boot=1/ready=true/rootSessionId=team-root/toolCount=10；401 闸生效；catalog.list 200 携 my-team-bp-1；4 产物 byte-identity PASS
   - `pba-gentry.mjs` → GENTRY COMPLETE — all checks passed（exit 0）：G0 shell+entry，G1/G2 overlay，G3 显式 blueprint 选择 → team.create 200 → 团队绑定（zero state 消失），§4.3 message-gated 团队 tab，sidebar 无孤儿行，G4 handoff 垂直（prepare 恰好一次、无闪烁）。`team-remote RPCs: 22; failures: none`
   - `pba-boot.mjs stop` → D5-STOPPED，kit 核验 ports free 3180/3493
   - teardown 后注记：~19s 后 3180/3493 出现新 node listener（pids 55416/63348，11:56:09 本地启动——晚于其 boot job 11:55:50 结算）。非其进程；几乎必为并发 reviewer 的 kit 运行。未触碰。

## 发现（全部非阻塞）

1. [非阻塞] 新鲜度闸执行范围：闸仅经 `pnpm build:composition`/`pnpm setup` 触发（链尾，package.json:34）；`pnpm build` 单跑与 test/lint 闸不触发，无 CI job 跑 `check:artifacts`（唯一 workflow `.github/workflows/characterization.yml` 是较老的 P2-T1 self-test）。符合 DoD-3 "构建时 fail-loud" 的规范链，但无 CI 兜底——执行仅开发机构建时。
2. [非阻塞] 闸比对 worktree 对 git **index**（staged blobs）而非 HEAD（check-artifacts-committed.mjs:93–107）。正确捕获目标失败模式（源码变更未重建产物 → A/B/C 命中 exit 1）。刻意绕过——源码变更后手工还原陈旧产物字节以匹配 index——会通过与任何 worktree-vs-index 比较固有，无意图下不具实操性。
3. [非阻塞] 已记录接受缺口经脚本头（L30–34）确认：tsc 不清理已删源码的过期输出，此类残留通过 A/C（接受为非行为死重量）。
4. [非阻塞] CRLF/git-status 外观伪像：autocrlf=true 机器上 `pnpm setup` 后完整 `git status` 显示 ~511 个 " M" 而 `git diff`/`git diff HEAD` 为**空**（文件原地以相同 LF 内容重写，index stat 记录 smudged-CRLF 检出状态；逐文件 update-index --refresh 清除各自）。无内容漂移（§4 三路验证）。闸的 filtered hash-object 判据正是其在此正确通过的原因——基于 git status 的闸会误报。Windows 上每次构建后可能困惑（"为何显示 modified？"）。
5. [非阻塞，minor doc] `docs/INSTALL.md:89` 称 "build:composition 两步"，而 INSTALL.md:76 列举三步（glue + composition + 新鲜度闸）；第三步在相邻 blockquote（L82–87）有解释——仅措辞不一致。
6. [非阻塞，信息] DoD-1 仅在 pnpm 11.7.0 实证；"pnpm ≥ 10" 覆盖基于结构论证（包声明零生命周期脚本，pnpm git-dep 构建脚本政策——针对*声明*脚本的包——无从拦截）。机制在 10+ 内版本无关。
7. [非阻塞，信息] 跨机构建确定性：已提交产物无机器特定内容（client-bundle.js 与 host.js 中 0 绝对路径模式；确定性相对 source map；无时间戳），加 intra-machine 一致性由 reviewer 验证；跨机逐字节一致性由先前 R125 fresh-clone 证据覆盖（未重跑）。

## 产物核验（独立，三路一致）

- **(a)** reviewer worktree 内 fresh `pnpm build && pnpm build:composition` → 闸 OK: 1020 files；之后 `git diff HEAD --name-only` = **0 文件**（worktree 与已提交树内容一致）
- **(b)** 全部 1020 个已提交 blob（`git cat-file blob 1a5afc6:<path>`，Node 读原始字节避免 PowerShell 字符串捣乱）vs 盘上新构建输出二进制级比较：**1019/1020 raw 逐字节一致**；唯一 raw 差异 = `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`（dist glue = CRLF-smudged 源文件的字节拷贝，提交为 LF）——**LF 归一 diff = 0/1020**。全部已提交产物 blob 为纯 LF（0 含 CR 字节）、全部 mode 100644（无 symlink）
- **(c)** 全新世界 kit：8 安装面产物（host.js、glue、seam.mjs、upstream-resolver.mjs、cordis.patch.yml、client-bundle.js、shim index.js、shim package.json）LF 归一 sha256 与 task tree 一致；boot kit 对已安装副本复验其中 4 件

**结论：已提交产物精确等于 fresh `pnpm build && pnpm build:composition` 输出**（按规范的 LF 归一后一致）。产品面检查亦成立：根 package.json 仅 scripts 块变更（prepare 移除；setup/check:artifacts 增加；闸链入 build:composition），files/exports/dsh 块未动；.gitignore 恰增两条否定规则，其他 dist/ 目录 + *.tsbuildinfo 仍被忽略（fresh 构建恰产出 1020 个已提交文件——忽略排除路径被演练且正确）；文档与实现行为一致，旧 allowBuilds 流程降级为 ≤ e832d73 commit 的排障项，无残留旧指令。

## 对 brief 的偏离

1. 按指令运行 step-7 kit 覆盖了 reviewer worktree 中 **8 个已跟踪**证据文件（kit 写固定文件名，已在 1a5afc6 提交：6× browser/gentry-03/05/06/*.{html,png} + browser/gentry-report.json + 2× instances/{dump-config,instance}-port3180.log）。brief 关于复现"只写 gitignored 文件"的假设对已提交证据不成立。全部 8 个经 `git checkout -- <paths>` 恢复，复验 `git diff HEAD` = 0；最终 worktree 零跟踪修改。
2. worktree 现带 22 个未跟踪文件：11× .review-*.log（gate 日志，保留为佐证）+ 11× 新 stamp kit 证据（pba-*-2026-09-05T03-50-29.*）。仅未跟踪——未提交、未推送、未分支。
3. 新世界 `references/.dsh-test-pba-2026-09-05T03-50-29`（gitignored）按 kit 设计留在主仓库（brief 注明世界保留；R132 世界同惯例保留）。主仓库跟踪树与 test-use 树均验证 clean（0 变更）。
4. 3180 初始被 Test-NetConnection 报 "IN USE"；调查确认仅 TIME_WAIT 残留——按端口实际空闲继续 step 7。teardown 后 ~19s 并发（非其）进程绑定 3180/3493；未触碰。
5. 未读 SESSION_ROUTER_LOG.md、graph.yaml、evidence/*/task-brief.md；kit 与 JSON/日志数据仅作复现工具/数据，裁决立足于 diff + 自身复现。

## 流程注记

按 AGENTS.md 先读了 docs/ROUTER_RULES.md 与 docs/TEST_METHODS.md。红线遵守：未触 upstream 源码、无 push/branch、:3080 / D:\deepseek-harness\ 未触、所有实例操作可逆且限于 references/ 下测试 DSH_HOME。
