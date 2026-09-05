# Gate round 1 — Reviewer 3/3（blind）裁决

- Reviewer: subagent `1e2be500-23c5-473e-8f78-3f03ff388a5a`（qwen3.8-27b，fresh，零流程文档/零前轮知识）
- Worktree: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\PBA-REV3` @ `1a5afc6`（detached）
- 环境: node v24.20.0, pnpm 11.7.0, core.autocrlf=true, clean start

## 裁决：通过（PASS）

DoD 达成，无实质问题。四项 DoD 在 reviewer 独立 worktree 全部复现验证；可选 step-7 全新世界垂直全绿。全部发现均为非阻塞流程健壮性备注。

## 复现日志（reviewer worktree 内）

1. `pnpm install` → EXIT 0（1m 1.5s；无构建脚本拦截、无 allowBuilds 提示、无生命周期脚本执行）
2. `pnpm typecheck` → EXIT 0（9/9 workspace 包 Done）
3. `pnpm build` → EXIT 0（9/9 tsc Done）；`pnpm build:composition` → EXIT 0（place-dist-glue byte-identical；client-bundle.js 845690 B；**`[check-artifacts-committed] OK: 1020 files`**）
4. `pnpm test` → EXIT 1（flake 协议触发：仅 `p6t1-parallel.test.ts` 3 失败——已记录的负载依赖 flake；其余 219 文件全绿）。隔离重跑 `pnpm vitest run packages/runtime/test/p6t1-parallel.test.ts` → EXIT 0，9 passed (9)。两结果均记录 → 测试闸按已记录协议满足。
5. `pnpm lint` → EXIT 0
6. `pnpm smoke:composition` → EXIT 0（host/plugin/composition 三 PASS）
7. **可选 kit 序列 — 已运行**（3180–3186 + 3493 用前核验空闲、用后复验空闲）：
   - `pba-setup.mjs` → EXIT 0，`PBA-SETUP-OK`。新世界 `references\.dsh-test-pba-2026-09-05T03-42-20`；bare clone；spec `git+file:///…#task/plugin-prebuilt-artifacts`（reviewer 验证 task tip `006fdf2` 安装面与产品 commit `bc3fa05` 逐字节一致）。**首次 add 18s exit 0、零 allowBuilds、零重试**；profile pnpm-workspace.yaml 无 allowBuilds 条目；已安装根 manifest 零生命周期脚本；deps 精确 spec；`dsh.profile.bundles` 自动含 dsh-agent-team；用户 patch 无产品行；8/8 安装面产物存在且内容一致（LF 归一，host.js raw 30479 B / LF 29801 B，installed=baseline=`a00020335461…`）。
   - `pba-boot.mjs boot` → `PBA-READY`。row ready ok/boot=1/toolCount=10；401 闸；dump-config bundle 层行；serve combo 200 + bundleBytesContained:true；catalog.list 200 携 my-team-bp-1；4/4 产物 byte-identity（LF 归一）。
   - `pba-gentry.mjs` → EXIT 0，`GENTRY COMPLETE — all checks passed`。G0–G4 全 PASS；`team-remote RPCs: 22; failures: none`。
   - `pba-boot.mjs stop` → EXIT 0 `D5-STOPPED`，端口全空（3180/3493 等 8 口复验）。
   - 交叉核对（纯数据）：reviewer 世界的 8 个 LF 归一 SHA-256 与原运行已提交证据 JSON `pba-assertions-2026-09-05T03-28-20.json` **8/8 一致**。

## 发现（全部非阻塞）

1. [非阻塞] `check-artifacts-committed.mjs` 锚定 git **index**（`git ls-files -s`，L94）而非 HEAD。绕过路径：闸通过 → 暂存重建产物 → 只提交源码文件（产物留 staged 未提交）→ 后续闸仍按 worktree-vs-index 通过而 HEAD 携带陈旧产物。干净工作树（index==HEAD）下行为与规范一致；典型失败模式（忘重建→C / 忘 add→B / 清理已删输出→A）全部捕获。建议：加断 index==HEAD（`git diff --cached --quiet -- <paths>`）使同 commit 纪律结构化。
2. [非阻塞] 闸仅接构建时（build:composition 尾 + 独立 check:artifacts）；无 pre-commit hook。与 DoD 措辞（"构建时 fail-loud"）一致，但从不跑构建链的 commit 会跳过闸——同族残余流程缺口。
3. [非阻塞] 已记录的接受缺口（脚本头 L30–34）：tsc 不清理已删源码的输出 → 孤儿陈旧 dist 文件（tracked、在盘、内容未变）以死重量通过 A/C。定性正确（悬空 import 会构建失败，孤儿无引用）；与 brief 一致。
4. [非阻塞] PBA kits 以**固定名**写 `EV/instances/` 日志（instance-port3180.log / dump-config-port3180.log）：在已提交这些文件的 worktree 重跑 pba-boot.mjs 会**覆盖已提交证据**。reviewer 本次即遇到并已用 `git checkout --` 恢复、核验 clean（见 §偏离）。pba-gentry.mjs 对 `browser/gentry-*.png/.html` + `gentry-report.json` 同类（reviewer 用 scratch 拷贝规避）。建议：stamp 后缀或写 `instances/<stamp>/`。
5. [非阻塞，trivial] `gitBlobShas`（L64）以换行连接路径列表喂 `--stdin-paths`；含换行的文件名会使配对失同步——被 count-mismatch 检查捕获（exit 1，fail-safe 非 fail-open）。非现实 tsc/esbuild 输出情形。
6. [观察，非发现] 新构建后 511/1020 产物文件在 `git status` 显示 ` M` 而 `git diff` 为空：提交 blob 为 LF，checkout smudge 成 CRLF，tsc/esbuild 重写为 LF；status 标记在盘形式差异，内容（clean-filter 后）一致。与 brief CRLF 判据一致；外观。`git diff --quiet HEAD -- <两路径>` = 0 为决定性检查。

## 产物核验（独立方法，不依赖闸脚本）

fresh `pnpm build && pnpm build:composition` 后 `git diff --quiet HEAD -- packages/runtime/dist packages/client/composition-shim` → exit 0；`git diff --numstat HEAD -- <同路径>` → 0 行。**全部 1020 文件**新构建输出与已提交产物内容一致（LF 归一经 git clean filter；盘上状态在 core.autocrlf=true 下可为 CRLF）。构建后 dirty 严格限于该两路径（外部 0 文件）。佐证：(a) 闸自身 clean-filter 感知哈希 1020/1020 OK；(b) reviewer 新世界安装的 8 关键产物 LF 归一 SHA-256 与原运行已提交证据 JSON 8/8 一致；(c) `.gitignore` 语义经 `git check-ignore -v` 验证：`*.tsbuildinfo`（L10）在否定 dist 目录下仍压制 tsbuildinfo 文件（尾斜杠否定只解除目录级，文件级模式仍赢），`packages/tools/dist/*` 仍被忽略；仓库无 tsconfig 使用 incremental/composite/tsBuildInfoFile，dist 内不可能产生 .tsbuildinfo。

## 对 brief 的偏离

1. `pba-gentry.mjs` 从 scratch 拷贝（`.worktrees/PBA-REV3-GENTRY`，kit+state 拷入、PBA_STAMP 固定）运行而非原地：原地运行会覆盖**已跟踪**固定名证据文件（browser/gentry-*.png/.html + gentry-report.json），违反"不改跟踪文件"约束。gentry 全部结果来自对 3180 上活动世界的真实运行。
2. `pba-boot.mjs boot`/`stop`（按 brief 原地运行）覆盖了两个**已跟踪**固定名日志（instances/instance-port3180.log + dump-config-port3180.log）。teardown 后立即 `git checkout --` 恢复两文件，核验 `git status`/`git diff` 无跟踪修改。即发现 #4。
3. step-7 运行残留（全部未跟踪或 gitignored，不属于任何 commit）：worktree 证据目录 11 个新 stamp 文件（`*2026-09-05T03-42-20*`）、世界目录 `references\.dsh-test-pba-2026-09-05T03-42-20`（gitignored，与实现方保留世界同惯例）、上述 scratch 目录。跟踪树其余逐字节等同 HEAD。
4. 因检查时全部必需端口空闲，运行了**完整**可选 step 7（未跳过）；teardown 后 3180–3186（及 3493）空闲，stop 后复验。

## 约束遵守

未读禁止流程文档（SESSION_ROUTER_LOG.md / graph.yaml / task-brief.md 未触碰；证据 JSON/日志仅作数据交叉核对）；无 push/branch/remote 活动；:3080 与 `D:\deepseek-harness\` 零触碰；test-use checkout 仅作构建 CLI host 只读使用；最终 worktree 零跟踪文件修改。
