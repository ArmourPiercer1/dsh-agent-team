# SPACE-MAINT-20261016 — 暂缓项目安全磁盘清理（空间维护 worker）

**边界回执（首行）**：numerical-streak-camera 全程**完全跳过**——未打开/续接/唤醒其任何会话或 worker，未检查/修改其目录、软链接、挂载，未重建其工作树（本轮对其唯一的观测 = 工作区根 `ls` 的不可避免目录名条目，未作任何 du/status/git 操作）。同样未触碰：dsh-external-compute（含 gpt-simulation 子仓与 /mnt/dsh-compute vmhgfs 共享挂载）、DSH 宿主运行树（runner 实证宿主在 `/home/user/deepseek-harness`，非本工作区）、Alpha.5 全部在用依赖（a5-* worktrees、.pnpm-store-wt 2.3G、.pnpm-cache 327M、tests/homes 活跃世界、tests/deepseek-harness-test-use pin @46a7f68b09、playwright-browsers）、凭据与会话历史。

## 0. 最终结果（唯一权威口径；取代下文 §0-old/§3/§4/§5/§7 中的旧行动表述）

- **已落地动作（终态）**：research-control `.worktrees/g0` 实际删除成功 ≈14M（含其注册元数据）；`baseline/g1/g2/g3/g5/maint-0.2.0-rc.2` 六项**仅注册元数据被 prune**，目录内容仍在。
- **≈1.4G 孤儿目录内容 → 最终保留**（均为已推送 origin 分支的干净检出，无唯一数据；恢复=`git worktree add <path> <branch>`，权威链接见 §8/§9）。**不再升级权限重试、不改挂载、不执行宿主侧删除**（用户指令，§9 收尾）。
- **受保护保留**：`.worktrees/g4`（202M，dirty+实验笔记，未入可删判据）；fp32-pic-redesign 整仓 366M 唯一证据（**原地保留**——协调方保守保全，尚无用户裁决条目，见 §9）；deepseek-harness 宿主树（维持保护：node_modules 不清、lock 改动不代决）。
- **47G avail(55%) 的正确解读**：历史混合空闲观测——reviewer 一次性 worktree 回收 ≈29G + 用户清理 + lane 回收等多方叠加（见 §7），**不是本次清理的释放量，也不是当前容量承诺**。
- 清理任务已在安全边界内**收尾**：无剩余可动作、无待执行清理项、不再重试（§9）。

### 0-old. 执行环境与约束（历史计划，已被 §8/§9 取代，勿执行）

- 本 worker 的 bash 运行于 `bwrap --ro-bind / / --bind /srv/workspace/dsh-plugins/dsh-agent-team …`：**除本会话工作区外整个文件系统只读**；PID namespace 隔离（宿主进程不可见）。
- **实证尝试**（非推测）：`git worktree prune`（仅针对确凿失联的 `/tmp/main-baseline`，tmpfs 路径已消失）、`git worktree remove .worktrees/baseline`（干净+已推送 worktree）、定点 `rm -rf`（单一路径）三者均返回 `Read-only file system`（prune exit=0 但元数据未删、remove exit=255、rm exit=1）。
- ⇒ **本 worker 净删除 = 0，全程只读盘点 + 判定 + 可复跑命令清单**。所有清理动作需由具备写权限的主 Agent/用户复跑 §3 命令。
- 进程核对限制：从本沙箱无法枚举宿主进程；`/proc/*/cwd` 可见者仅本沙箱自身（4 个，cwd=dsh-agent-team）。候选项目最近提交活动停在 2026-10-02/03（13 天前），无占用证据；执行前建议主 Agent 侧 `lsof +D` 复核一次。
- Alpha.5 保护核对：本会话所有操作未进入任何 a5-* worktree、未触碰 :3080 宿主、未动共享 git 对象库写路径。

## 1. df 全局基线（ext4, /dev/mapper/ubuntu--vg-ubuntu--lv, 107G）

| 时点 | Used | Avail | Use% |
| --- | --- | --- | --- |
| 会话开始 | 68G | 35G | 67% |
| 会话结束 | 62G | 41G | 60% |

> 差值 −6G **非本 worker 所为**（本 worker 零删除，见 §0 实证）。归因于同窗口其他活跃 lane/系统活动；各候选项目 du 前后逐项复核未变（见下表"清理后"列）。

## 2. 项目盘点与判定（du 单位=该项目总量）

| 项目 | du 前/后 | git 状态 | 判定 |
| --- | --- | --- | --- |
| dsh-plugins/dsh-research-control | 3.8G / 3.8G（未变） | origin 已配；`log --branches --not --remotes` = **0 未推 commit**；main 落后 origin 7；9 分支全部与远端同步；9 个登记 worktree 中 7 个干净 | **部分可清理**（§3-A，约 3.4G），执行受沙箱限制未落地 |
| fp32-pic-redesign | 366M / 366M（未变） | **无任何 remote**；主树脏（README/STATUS/catalog 已改 + artifacts/deliverables、evidence-zips、manifests SHA256SUMS 等大量未跟踪）；research/deliverables 唯一数值结果与证据 | **整体保留**（不满足"已推送可恢复"；研究记录+证据目录）→ 待确认 |
| deepseek-harness | 2.5G / 2.5G（未变） | 独立检出 @ stable-2-0.1.7-rc.1（分支已推送，2026-09-24 授权轮）；**pnpm-lock.yaml 有未提交改动**（5+/5−）；node_modules 2.0G 可能源自脏 lock | **保留**（脏树 + 再生路径不确定）→ 待确认 |
| dsh-stable-3-0.2.0-rc.2 | 440M / 440M（未变） | 干净；detached @ 639ed01539（0.2.0-rc.2 官方发布点，origin 可达）；audit/ 32K 审计文档 | **保留**（已交付审计轮的证据工作树；量小）→ 待确认（可选） |
| numerical-streak-camera | **未测量** | **未检查** | **完全跳过（硬边界）** |
| dsh-external-compute / /mnt/dsh-compute | 未测量 | 未检查 | **保护（硬边界）** |
| dsh-plugins/dsh-agent-team（活跃仓） | 工作区内 | 55 个登记 worktree：a5-* 全部活跃 Alpha.5 lane；20261016 当日轮次（audit-alpha4 / pending-decisions / fix-postalpha4 / exp-alpha5-poc 1.4G）在用；其余为 pre-alpha3/alpha3/alpha4 已交付证据链（pr2–pr5 各≈930M、dsh-020rc2-upgrade 3.0G、a5p1r-fixrev 3.8G 为 detached 证据） | **零改动**——非"暂缓项目"，活跃仓内大项仅列待确认 |
| wsl-init / test.txt / windows-test.txt | 32K / 极小 | — | 保留（无意义量） |

## 3. 可清理清单（判据全满足项；命令供有写权限方复跑）（历史计划，已被 §8/§9 取代，勿执行）

### 3-A. dsh-research-control（潜在回收 ≈ 3.4G + prune）

判据核对：任务已结束（G0–G5+maintenance 分支全部推送、tip==worktree HEAD、main 无本地独有 commit）∧ 无进程占用证据（建议执行前 `lsof +D` 复核）∧ worktree 间无相互依赖（各为独立检出）∧ 内容已推送可恢复（`git worktree add` 即复原）。无 force、无分支删除、无对象删除。

```bash
cd /srv/workspace/dsh-plugins/dsh-research-control
git worktree prune                          # 仅清 /tmp/main-baseline 失联元数据（tmpfs 已消失，实证存在）
git worktree remove .worktrees/baseline     # 200M  clean, @a8d5cb6 == origin/baseline/stage0-docs-gates
git worktree remove .worktrees/g0           # 197M  clean, == origin/feat/g0-reproducible-test-root
git worktree remove .worktrees/g1           # 197M  clean, == origin/feat/g1-trusted-boundary-lifecycle
git worktree remove .worktrees/g2           # 197M  clean, == origin/feat/g2-readonly-tools
git worktree remove .worktrees/g3           # 197M  clean, == origin/feat/g3-semantic-write-tools
git worktree remove .worktrees/g5           # 201M  clean, == origin/feat/g5-real-registry-acceptance
git worktree remove .worktrees/maint-0.2.0-rc.2  # 2.0G clean, == origin/maintenance/dsh-0.2.0-rc.2
（已删除的通配清理建议：不执行——与定点保护边界冲突；只读残留不再执行）
（已删除的通配清理建议：不执行——与定点保护边界冲突；只读残留不再执行）
```

类别与再生方式：以上 ≈ 每 worktree 200M 中 node_modules ≈ 174–191M（实测 baseline=174M、maint=191M）+ 检出文件。再生 = `git worktree add .worktrees/<name> <branch>` + `pnpm install --frozen-lockfile`（lockfile 已提交于 main；共享 store 可加速）。`.main-baseline`（21M，唯一脏项=未跟踪 node_modules，HEAD 9fa74ad ∈ origin/*）如愿先删其 node_modules 再 `git worktree remove .main-baseline` 亦可，本轮保守起见移入待确认。

### 3-B. 本轮未列清理项
其余项目均存在不满足判据的项（见 §4），不执行任何删除。

## 4. 保留项 + 原因 / 待确认清单（9 条）（历史计划，已被 §8/§9 取代，勿执行）

1. **fp32-pic-redesign 全部（366M）**——无 remote、脏树、deliverables/evidence/manifests 未跟踪唯一研究产物；需用户决定备份/远端化后另议。
2. **deepseek-harness（2.5G）**——pnpm-lock 未提交改动使 node_modules 再生路径不确定；待确认：改动去留（还原 lock 后 node_modules 即可再生、回收 ≈2.0G）。
3. **.worktrees/g4（202M，dsh-research-control）**——未跟踪 `.g4-impl-notes.md` + `.g4-logs/`＝实验日志，先归档再议。
4. **.main-baseline（21M）**——仅未跟踪 node_modules 挡路；待确认两步法（§3-A 末）。
5. **.g0-iso（200M）**——非 git 的文件快照副本（含 .tgz），逐文件一致性未核 ⇒ 不确定保留。
6. **.standalone/g1-verify（204M）**——脏树（` M lib/client.js`），疑似验证现场 ⇒ 保留。
7. **dsh-stable-3-0.2.0-rc.2（440M）**——已交付审计轮证据工作树（可再生：clone + `git checkout 639ed01539`），audit/ 文档必须保留；checkout 本体待用户可选清理。
8. **dsh-agent-team 非当日证据 worktrees（合计 ~12G+，如 dsh-020rc2-upgrade 3.0G、pr2–pr5 各 ~930M、browser-carrier-*、rev-*、base-* 等）**——属活跃仓已交付证据链/detached 证据 HEAD，不在"暂缓项目"授权范围，且 detached commit 唯一可达性需先做 `git fsck --connectivity-only` 类核证；列此供主 Agent 裁决。
9. **research-control 日志簇（.g0/.g2/.g3-logs、.baseline-logs、g5-logs 等，~6M）**——实验日志，量小一律保留。

## 5. 恢复步骤（若 §3-A 执行后需复原）（历史计划，已被 §8/§9 取代，勿执行）

```bash
cd /srv/workspace/dsh-plugins/dsh-research-control
git worktree add .worktrees/baseline baseline/stage0-docs-gates
git worktree add .worktrees/g0 feat/g0-reproducible-test-root
git worktree add .worktrees/g1 feat/g1-trusted-boundary-lifecycle
git worktree add .worktrees/g2 feat/g2-readonly-tools
git worktree add .worktrees/g3 feat/g3-semantic-write-tools
git worktree add .worktrees/g5 feat/g5-real-registry-acceptance
git worktree add .worktrees/maint-0.2.0-rc.2 maintenance/dsh-0.2.0-rc.2
# 各 worktree 内：pnpm install --frozen-lockfile
```

分支与提交全程未动（本次盘点锚点：baseline a8d5cb6 / g0 009f7a4 / g1 45de4f8 / g2 8245cfc / g3 f164aca / g4 f5fa2ac / g5 b80245f / maint 0dc9911 / main 0fa2b1a）。

---
末行 df 全局对比：**68G used / 35G avail (67%) → 62G used / 41G avail (60%)**（−6G 为外部同窗口活动所致，本 worker 净删除 0；候选项目 du 逐项未变）。

## §7 主 Agent 复跑结果（2026-10-16 17:1xZ，用户授权升级执行）（历史计划，已被 §8/§9 取代，勿执行）
- research-control：`worktree remove` g0 **成功**（~14M+注册元数据，实际磁盘回收有限）；baseline/g1/g2/g3/g5/maint git 元数据已 prune，但目录内容在**只读文件系统**上，沙箱（含 danger-full-access 复跑）无法删除 ≈1.4G 孤儿目录——**需宿主侧删除**（路径 .worktrees/{baseline,g1,g2,g3,g5,maint-0.2.0-rc.2}，内容=已推送分支干净检出，无唯一数据）。g4 保留=dirty(2)+202M，未入可删判据。
- 本窗口磁盘净变化来自多方叠加（reviewer 一次性 worktree 回收 ≈29G + 用户清理 + lane 回收），非单因子归因；现 47G avail(55%)。
- fp32/deepseek-harness 两项维持"待用户决策"，未动。

## §8 孤儿清单（保留；其"待用户决策"表述已由 §9 更正替代）（用户指令：不再升级权限重试、不改挂载；宿主侧删除路径）

> 口径注：本条题中"宿主侧删除路径"为当时指令时的历史选项描述，**非待执行动作**——孤儿内容终态=保留（见 §0），本节与 §9 为最终处置记录。

- **孤儿 worktree 目录（元数据已 prune；内容=下列分支的干净检出，均已推送 origin，恢复=`git worktree add <path> <branch>`）**：
  - /srv/workspace/dsh-plugins/dsh-research-control/.worktrees/baseline → branch baseline/stage0-docs-gates @a8d5cb6
  - .../g1 → feat/g1-trusted-boundary-lifecycle @45de4f8；g2 → feat/g2-readonly-tools @8245cfc；g3 → feat/g3-semantic-write-tools @f164aca；g5 → feat/g5-real-registry-acceptance @b80245f；maint-0.2.0-rc.2 → maintenance/dsh-0.2.0-rc.2 @0dc9911（合计≈1.4G）
- **fp32-pic-redesign 待决内容明细**：整仓 366M，**无 remote 备份**；未跟踪唯一产物=deliverables/、evidence/、manifests/（数值结果与实验记录）——待决=用户选择(a)建远端备份后部分清理 或(b)原地保留；本轮零操作。
- **deepseek-harness 宿主树（/home/user/deepseek-harness，2.5G）**：按用户指令**保持保护**，node_modules 2.0G 不清（pnpm-lock 未提交改动去留亦不代决）。
- 原则重申：只读文件系统上的目录不再重试删除；一切保留项可恢复；无永久删除动作发生。

## §9 处置记录（协调指令 2026-10-16 17:18Z UTC）+ 可读提交链接
- **fp32=原地保留**：该处置为协调方对"无远端备份+唯一产物"采取的保守保全，**尚无对应的用户裁决条目**；此前"用户终裁"表述不准确，已更正。deepseek-harness 宿主树维持保护。deepseek-harness 宿主树维持保护。清理任务到此**收尾**（安全边界内无剩余可动作）。
- 孤儿目录内容之权威来源（dsh-research-control@origin 实存 tip，逐条可核）：
  - baseline/stage0-docs-gates → github.com/ArmourPiercer1/dsh-research-control/tree/a8d5cb6e65
  - feat/g1-trusted-boundary-lifecycle → .../tree/45de4f81d2 ; g2 → .../tree/8245cfc347 ; g3 → .../tree/f164acaa88 ; g5 → .../tree/b80245fda3 ; maintenance/dsh-0.2.0-rc.2 → .../tree/0dc9911815
