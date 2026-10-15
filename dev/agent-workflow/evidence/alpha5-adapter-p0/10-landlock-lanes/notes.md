# Landlock 通路补做（10-landlock-lanes）— Alpha.5 P0 行为级证据（fixture/子进程级）

- **代理**：Alpha.5 P0 landlock 通路补做代理。日期：2026-10-16（worktree `exp/alpha5-poc-20261016`）。
- **模型名（系统提示 powered-by 逐字回报）**：`qwen3.8-flash-next`（由代理注入 result.header，runner 自身不可核验）。
- **前提（已实证，不重做）**：`04-process/landlock-diagnosis.md` = **ENFORCE-WORKS**（ABI v4；diag 的 ctypes 底座逐字复用：syscall 444/445/446、attr16=`pack("@QQ")`、rule=`pack("@Qi")`、c_long 防截断、O_PATH dirfd、prctl NO_NEW_PRIVS）。bwrap/netns/uid_map 维持 ENV_BLOCK，本轮未触碰。
- **判定层级措辞**：本目录全部判定 = **fixture/子进程级 OS_ENFORCED**（landlock 由内核中介 syscall，errno 原文入 JSON），但**规则由测试代码编译**、宿主为当前开发机（Linux 6.8.0-142-generic，uid 1000 非 root）；真实 Team adapter 集成属实施阶段。

## 命令清单（复跑，幂等已实测 2 轮 EXIT=0）

```bash
W=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016
cd "$W/dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes"
bash run-landlock-lanes.sh      # fixture 整体重建 → 7 腿 → diag/run-*.log + diag/results/*.json + lanes-result.json
```

退出码：`0`=全部腿判定符合预期；`2`=landlock ABI 不可用；`7`=混合/未达预期。最近两轮均 **EXIT=0**（开发轮含修复前 FAIL 记录，见「修正记录」）。

## 机制（姿势，实测裁决）

1. **父进程无法在 fork+exec 前为子预设域**：`landlock_restrict_self` 只锁**调用进程**（父调=锁父域）；且 ruleset fd 带 **FD_CLOEXEC=1（实测 `F_GETFD=0x1`，内核置位）**，`execve` 即闭合 ⇒ 父侧预编译 ruleset **不可跨 exec**（L1 MECH 腿：子进程 `readlink /proc/self/fd/N` = **ENOENT**）。
2. **姿势 P1（主）= 子进程入口先自锁再执行任务**：父按 per-member 策略编译产物为 **JSON 数据**（`diag/results/policy-m-a5.json`）；子进程入口 create_ruleset+add_rule（自开 O_PATH dirfd）→ `prctl(PR_SET_NO_NEW_PRIVS,1)`（restrict_self 前置，rc=0 原文；设置后 fork+exec 持久）→ restrict_self → 才执行任务/fork+exec `sh -c`。L1/L2/L3/L4/TOCTOU 用此姿势。
3. **姿势 P2（L1FD，实测可行）= 父编译 + fork（不 exec）继承 + 子只 restrict_self**：fork 不受 CLOEXEC 影响；子半 `restrict_self(rc=0)` 后再 fork+exec 真实任务，域对 exec 后命令同样生效（"restrict 在 exec 前"的合法形态）。
4. **防篡改边界（两姿势共用）**：子进程持有的 ruleset fd 仍可 `add_rule` 扩宽 ⇒ landlock 不可信恶意子进程自律；受信面 = 子进程入口的 **adapter 运行时**（受信代码），其先锁再跑不可信内容（模型生成的命令文本等）。
5. **`PR_SET_NO_NEW_PRIVS` 说明**：restrict_self 的强制前置（否则内核 EBPERR）；由子进程入口设置、经 fork+exec 不可逆继承，属"锁不可解"链的一部分。

## 判定表（lanes-result.json，逐腿 fixture 级）

| 腿 | 内容 | 判定 | rc |
| --- | --- | --- | --- |
| L1 | 受限读面（FS-01 的 OS 级对应）：restrict 后新建 fd 全套 + exec 继承腿 + MECH | **OS_ENFORCED**（13/13） | 0 |
| L1FD | 父编译 ruleset + fork 继承 + 子自锁 + restrict→exec 任务链 | **OS_ENFORCED_FORK_HANDOFF**（6/6） | 0 |
| L2 | 受控 spawn（P0-4 PROC 适用腿）：`sh -c` 域内执行 + 不可信命令文本注入负控 | **OS_ENFORCED**（7/7） | 0 |
| L3 | 锁不可自解（grant 消费类比）+ 三次扩权尝试 | **OS_ENFORCED_LOCK_IRREVERSIBLE**（8/8） | 0 |
| L4 | landlock OS 底 + P0-3 式 open 账本组合：负控双重拒 | **OS_ENFORCED_AND_LEDGER_ZERO_ISSUED**（5/5） | 0 |
| TOCTOU_A | restrict 前已开 / 父继承 fd（无 CLOEXEC）跨 fork+exec+自锁 | **BY_DESIGN_FD_SURVIVES**（2/2） | 0 |
| TOCTOU_B | 同 fd 设 O_CLOEXEC（缓解措施） | **MITIGATED_BY_CLOEXEC**（2/2） | 0 |

驱动 EXIT=0；per-leg rc 全部 0；`MODE_RC L1=0,L1FD=0,L2=0,L3=0,L4=0,TOCTOU_A=0,TOCTOU_B=0`。

## 关键 errno 原文（摘自 legs[*].checks，逐字）

- L1（基线→锁后，干净信号）：`private/secret.txt` 基线 OK → **`EACCES 'Permission denied'`**；`outside/outside.txt` OK → EACCES；fixture `.ssh/id_rsa` OK → EACCES；真实 `~/.ssh/config`（owner 可读，open-only 零字节读取）OK → **EACCES**；`create private/newfile.txt` → EACCES；exec 腿 `cat private/secret.txt` → `rc=1 'cat: …/secret.txt: Permission denied'`；`cat allowed` rc=0（排除二进制不可读假阴性）。
- L1 如实降级腿：`/etc/shadow` 基线=**EACCES（DAC 先拒，非 root）** → 锁后 EACCES（双保险腿，landlock 层不独立可证；干净信号由 private/outside/ssh 腿承担）。真实 `~/.bashrc` append → **`EROFS 'Read-only file system'`** = harness 沙箱只读挂载先于 landlock（判定层=沙箱）；landlock 干净写拒=`outside/newfile.txt` → EACCES。设计行为记录：`listdir(~/.ssh)` 仍 OK（`/` READ_DIR 合并 search+enumerate，仅目录名，diag §3.4 同源）。
- L2（注入负控，全部 OS 层拒，fixture 未审查命令文本）：`cat ../../private/secret.txt` → `rc=1 'cat: ../../private/secret.txt: Permission denied'`；`cat "${A5_DENY_DIR}/secret.txt"`（env 拼接，命令文本零 deny 字面量）→ `Permission denied`；`printf X >> "$HOME/.bashrc"` → `rc=2 'sh: 1: cannot create …/.bashrc: Permission denied'`；`cat "$HOME/.ssh/id_rsa"` → Permission denied；正控 `cat ok.txt` rc=0、`printf > sub/w_ok.txt` rc=0；父侧复核 `.bashrc`/private 树 sha 未变、w_ok 内容正确。
- L3（扩权尝试，syscall 原文）：`create_ruleset: rc=11 errno=OK`、`add_rule(private, access=0x4): rc=0`、`landlock_restrict_self: rc=0`、`add_rule(已消费 rs1): rc=0`、`create_ruleset(VERSION): rc=4` —— **syscall 层全部放行**；能力面探针每次均 **`EACCES`** ⇒ 不可逆性=**域交集语义**（restrict 只收缩），非 syscall 禁令。前提文案预期的 "EPERM" **未复现，如实记录**。
- L4：策略层 `READ_DENIED` 且账本 `open-issued=0 / refused=1`；同路 raw open（模拟 P0-3 未适配旁路，当时可直读）→ **EACCES**；raw `O_CREAT private/l4_new.txt` → EACCES；正控 read OK + `open-issued=1` ⇒ 双层缺一不可。
- TOCTOU_A：父进程 secret fd（清 CLOEXEC）跨 fork+exec+自锁 → `target=SECRET read=READ-OK(32B)`（by-design 不追溯）；同路径新建 fd 对照=EACCES（证明域已生效，非"没锁上"）。TOCTOU_B：CLOEXEC fd 已闭合——fd 号被子进程**自家 ruleset 复用**，身份判定（readlink）判明非 secret ⇒ 缓解成立；**适配要求 = spawn 前对一切非交付 fd 强制 O_CLOEXEC**。

## 与 one-shot grant 的语义差异（L3 写明）

landlock = **进程域终身棘轮**：粗粒度（位×子树）、不可消费单次、不可撤销、对**已开 fd 不追溯**（TOCTOU_A）。one-shot grant（P0-3 账本）= 细粒度（member×tool×对象×一次）、消费即失效。互补：账本管"谁被允许请求什么"，landlock 管"这个进程此后**有能力**做什么"——即便记账层被未适配代码旁路（P0-3 FS-01 bypass 实测可直读），OS 底仍 EACCES（L4）。

## 修正记录（开发轮如实）

1. `probe()` 重复传 expect → TypeError（首跑子进程崩，兜底 JSON 通道暴露）。
2. **Python `os.open` 默认 CLOEXEC**（PEP 446）→ 交付用 result fd 跨 exec 被关（EBADF）；修正=显式 `set_inheritable(True)`。
3. **fd 复用假阳性**：MECH 检查初版放在子进程自家 `create_ruleset` 之后 → 父 fd 空位被自家 ruleset 复用 → 误报 "OPEN target=landlock-ruleset / ruleset fd 非 CLOEXEC"；改为先于任何自家 fd 分配 + readlink 定身份后**结论反转为 ENOENT（FD_CLOEXEC=1）**。同陷阱在 TOCTOU_B 被身份判定正确拦截。
4. L4 子进程在 restrict 后重读策略文件 → by-design EACCES（策略文件在 allow 域外）；修正为锁前读毕。此崩溃本身即域生效的旁证。
5. 真实 `~/.bashrc` 腿 EROFS（沙箱挂载先决）→ 降级为记录腿（任意 errno=拒即计）并新增 `outside/newfile.txt` 干净 landlock 写拒腿。

## 诚实边界（不可省略）

- **fixture 级**：规则由测试代码编译；per-member 策略为合成 JSON；"Team Adapter 模拟" = 本 runner 的父/子结构，不是真实 Team runtime（集成属实施阶段）。
- 非 root 环境 ⇒ `/etc/shadow` 腿 DAC 先拒（见上）；`/` READ_DIR 枚举面按设计存在（内容面封死）。真实 `~/.ssh` 仅 open 探测 + listdir 记录，**任何真实凭据字节零读取、零进入证据**；fixture HOME 腿承担写/读负控干净信号。
- TOCTOU 非竞态窗口测试（rename/symlink 重定向不在本目录，见 03-fs notes 未测清单同项）。
- 未改任何系统设置；未触 `:3080`；未动 junction/宿主树；未 git commit。产物仅本目录：`workspace/`（fixture，仅 allowed/ 有正控新文件 l3_newfile.txt、sub/w_ok.txt；private/ 零新增）、`diag/`（日志+per-leg JSON+policy）、`lanes-result.json`、两个脚本。
