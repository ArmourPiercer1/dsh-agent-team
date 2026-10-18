# Alpha.5 可试用候选 — release-readiness 独立审计（release-candidate-r1）

- **审计员**：Alpha.5 release-readiness 独立审计（qwen-only，只读+隔离世界；不 push、不触 :3080、不改产品码、不放宽任何门）。
- **审计基线（现场双源，两次实测）**：开轮 `git ls-remote origin refs/heads/master` = `b6d7c48a9730d230758749dc05abad87cea5e41f`（=#334 PTC fs 半臂）；**r4 轮 kit fail-closed 拦到窗口内推进 → 终基线 = `5885e46ec2bcbfa7bfa58882d835801ec8b79e1f`（=#340 shell cancel leg，现场 ls-remote+log 复核，b6d7c48a→5885e46e 安装面 added 0/removed 0/changed 12）**。审计工作树 `.worktrees/rc-trial-audit` detached @ 终基线（H1b 腿实测相等）。
- **测试宿主 pin（master 权威源 `tests/paths.mjs`）**：`TEST_USE_BASELINE_SHA = CLIENT_COMMIT_HASH = 639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）；`tests/deepseek-harness-test-use` 实测同 SHA、porcelain 0（每轮运行前后）。
- **安装法** = 固定安装链（docs/INSTALL.md §2/§3.5 + TEST_METHODS §2）：`node tests/deepseek-harness-test-use/apps/cli/lib/bin.js plugin --profile web add github:ArmourPiercer1/dsh-agent-team#<全量 master SHA>`，pnpm storeDir 走 profile `pnpm-workspace.yaml` 公开通道。

## 交付物

| 件 | 文件 |
| --- | --- |
| ① 可试用机制/工具清单（配置键+最小验证命令+字节证据路径） | [INVENTORY.md](./INVENTORY.md) |
| ② 未验收/禁用项清单 | [NOT-ACCEPTED.md](./NOT-ACCEPTED.md) |
| ③ 固定 SHA + 回退链语义 + 最小试用脚本（<20 行） | [ROLLBACK-AND-TRIAL.md](./ROLLBACK-AND-TRIAL.md) + [rc-trial.sh](./rc-trial.sh) |
| ④ 隔离安装 smoke 真跑（`tests/homes/rc-trial-1`，3183/3184+mock 3491，具名清理） | [SMOKE.md](./SMOKE.md) + `runs/<stamp>/` |
| ⑤ 返工表（根 20:2xZ 六条：三层口径 Q1/Q2+词表逐名；当前态账本在上级 `../ALPHA5-CURRENT-STATE.md`） | [REWORK-2026-10-18.md](./REWORK-2026-10-18.md) |

## 安装清单计数（现场重数，不沿用旧口径）

- 终基线 `5885e46e` 声明安装面 = `files:` 覆盖跟踪文件 **1771** + pack 恒含 2 = **1773**；**b6d7c48a→5885e46e：added 0 / removed 0 / changed 12**（plane-effect-backends + a5p5-tools backend-contract/pipeline/register 族 dist；#340 语义变更=12 文件）。历史口径链：1772 止于 `2d1fa21c`，#334 起 1773。逐点字节差异表=ROLLBACK-AND-TRIAL.md §2。
- 真装三零实测：**@b6d7c48a** rootSha `9e421d239f6b99a6…`（r3）；**@5885e46e** rootSha `3a3911a8fb494034…`（r5，missing/extra/sha-mismatch=0）。

## 一句话结论

**今日可试用候选 = 可试用（受限 alpha）**：六条机制均有已合并字节证据+本轮真装真跑复核。**终态 smoke r5 = 28 PASS / 0 FAIL（KIT_EXIT=0）** @`5885e46e`（含 #340）；r6b（+M9 native-bash 见证腿，#341-④）= 28 PASS / 1 FAIL，**该红=我方判据未预设第三分支的工件，而红 receipt 本身即新事实**：RC 形状 native bash 派发被 `request-control` 包络门派发前 fail-closed（verbatim+三形状矩阵=REWORK §④）。装面三零 **1773/1773** rootSha `3a3911a8fb494034…`、launcher `1264ea58…`/26992B/abi4 在场、`team.create→create-member→按实例委派→collect` 全链、`bash · exit=0` 真落盘 + `bash · exit=1` 内核 `Permission denied` verbatim、`cancelled:false`（无取消路径语义正确）、`a5ptc census-boot pinned (sha256:1264ea584e3438d6)` 同场见证；历史 r3 两红=kit 判据转义工件（红原文保留标 SUPERSEDED-BY-regex-fix，④ 单口径）。**缺**的是——**取消腿装面端到端未通**（#340 已合=代码/CI 层事实；**a5ie-r5 已驱动=RED(C1) 在册**：判别器命中仍落死亡形，`c44f51e4` runs `20-36-13Z`）、glob 行 live stderr 代理判据洞**方向已根准实施中**（R1+rc-first；rc-first 判据 `178bea59` **双独审回**[A GO/B 投机通过，必办五项]、**merge-sync 收口进行中**+stdout 门 `203cac85`，均未入头）、**native 审批后执行=接管形已交付（#329 `1fb14c4d`），剩余=非接管原生名**（REWORK §④）、PTC 模型侧提示词工程未接入（宿主侧强制为真源）、v4 执行面=fail-closed 既定延期、`team_delegate` 实例形 `label` 行文差（②§C-15）、**词表覆盖缺口 13 名未钉名**（已裁：13 名钉+双向漂移机检=`c8ad9c4a`、证据笔=`b7deacbc` 已落，**预防钉轮进行中**；三段实况=②§C-16）。逐条边界见 ②。
