# TINF M0 — 负控与测量转录（2026-11-14）

配套说明：`docs/plans/memo/tinf-m0-baseline-20261114/README.md`。
全部文件是工具原样输出（stdout+stderr 合并），**没有**手工改写数字。均为 `.txt`，不占 `BOUNDS.maxCandidates` 的 `.json` 配额（该配额 6000，本 PR 新增 0 个 `.json`）。

| 文件 | 是什么 | 记录时的 head |
| --- | --- | --- |
| `nc-1-ready-before-settlement.txt` | PR #767 在写 settlement 之前被 `pr-ready-check` 判为 REFUSED，原因只有 marker 与无 settlement | `f867a4c18`（#767 分支） |
| `nc-2-wrong-git-state.txt` | 在 M0 worktree 对 #767 运行：head 不是 PR head、分支超前 → `LOCAL_HEAD_NOT_PR_HEAD, UNPUSHED_COMMITS` | `a9e4201c4` |
| `nc-3-dirty-worktree.txt` | 同 NC-2 加一个未跟踪文件 → 追加 `WORKTREE_DIRTY` | 同上 |
| `nc-4-unpushed-commit.txt` | 一个本地空 commit、不 push → 仍含 `UNPUSHED_COMMITS`（跑完即 `git reset --hard` 回退） | 同上 |
| `nc-5-uncollected-suite.txt` | `git add -N tests/checks/tinf-m0-nc-uncollected.test.mjs` 后，该路径出现在 UNCOLLECTED，`total 98→99` | `a9e4201c4` |
| `nc-6-binary-evidence.txt` | 临时 git 仓：1 MiB PNG + 12 B json → `1,048,588 B`（#761 的 numstat 解析会把 PNG 记 0） | 临时仓 `798c22cb6a` |
| `nc-7-unknown-named.txt` | `coverage-audit` 40 个 commit：21 undetermined（53%），kit 24 次 / root-scratch 10 次 / 脚本 2 次 / other 0 | `origin/master` `3a7303ca2` |
| `nc-8-profile-refusal.txt` | 只喂全 skipped 的 census job → exit 2 拒绝，不报 0 秒 | 无（离线 fixture） |
| `m-evidence-commits.txt` | 近 30 个 first-parent commit 的证据字节：p50 701,506 B / p90 2.31 MB / max 3.28 MB / 5 个超 2 MiB | `origin/master` |
| `m-evidence-dirs.txt` | 累计证据树：413 个目录、153.2 MiB、27 个目录超 2 MiB | `origin/master` |
| `m-collection.txt` | tracked node:test：98 in-scope、19 collected、79 uncollected | `b68685de0` |
| `m-census-profile.txt` | n=3 census job 的 step 中位数：census 1100 s（77%）、host build 272 s（19%）、job p50 1427 s | Actions API，2026-11-14 |

## 复现命令

见 memo §6。NC-2/3/4 需要两个 worktree（一个在被评 PR 的分支、一个在别处）；NC-5 需要 `git add -N` 后在跑完时 `git rm --cached`；NC-6 在临时仓里 `git init` 后提交二进制文件再 `--rev HEAD --commits 1`。

## 未覆盖

- `pr-ready-check` 没有覆盖“settlement 在第 101 条之后”的真实 GitHub 数据（分页逻辑由单测与代码路径保证，未构造 >100 评论的线上 PR）。
- `census-profile` 的 n=3 全部来自同一宿主升级轮；跨轮对比未做。
- 没有测量 M0 对 L1 墙钟的影响（新增 leg 约 0.2 s）。
