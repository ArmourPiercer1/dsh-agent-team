# Alpha.5 P0-4 — OS 强制能力探测矩阵（env-capability-matrix）

```
run_utc        : 2026-10-15T21:36Z（正式复跑节；原始逐项探测 21:31Z 起）
pwd            : /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016/dev/agent-workflow/evidence/alpha5-adapter-p0/04-process
host/kernel    : dsh-plugin-dev / Linux 6.8.0-142-generic #142-Ubuntu SMP x86_64
probe script   : ./env-capability-probe.sh   sha256=63273a5bdabaab6abb4a0272f84a12763cff595dba2ff4277d35e2fb76077637
run log        : ./env-capability-probe-run.log sha256=5f122c81ded54a05f2798d070b5781a7d75f6e81cd534e4847b6cbc9f426e462
pinned 源码基线 : tests/deepseek-harness-test-use @ 639ed015397290b3745d163aafe02ffee4aa3f84（0.2.0-rc.2，porcelain 空）
secret fixture : probe-scratch/private/secret.txt = "SYNTHETIC-NOT-SECRET-DO-NOT-CARE"（虚构；已随脚本 trap 销毁）
```

## 0. 决定性环境事实（本轮实测，非推断）

**本会话一切命令运行在一个由 dsh.service 启动的 bubblewrap 沙箱内部**，其 PID 1 cmdline（实测 `/proc/1/cmdline`）=
`bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp --bind <workspace> <workspace> -- bash -c …`
——与 pinned `bwrapProfileArgs({mode:'workspace-write'})`（§F）逐参数一致，即 **DSH harness 自身就是本轮所探测机制的宿主级实例**。

配套实测事实：

| 事实 | 证据 | 值 |
| --- | --- | --- |
| `apparmor_restrict_unprivileged_userns` | `cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns` rc=0 | `1`（原文记录） |
| AppArmor 标签 | `cat /proc/self/attr/current` rc=0 | `bwrap//&unpriv_bwrap (enforce)` |
| 沙箱 userns 映射 | `cat /proc/1/uid_map` rc=0 | `1000 0 1`（单 uid 映射，父进程以 root 创建） |
| NoNewPrivs | `grep NoNewPrivs /proc/self/status` rc=0 | `1`（继承态；`Seccomp: 0`） |
| 当前 netns | `readlink /proc/self/ns/net` rc=0 | `net:[4026531840]` = **宿主初始 netns**（沙箱零网络隔离；lo+ens32+ens34 可见） |
| LSM 堆栈 | `cat /sys/kernel/security/lsm` rc=0 | `lockdown,capability,landlock,yama,apparmor` |

含义：在 harness 会话**内部**再建立任何"嵌套"OS 强制（bwrap/netns/uid 映射）都受此环境约束；以下逐项判定均为该环境内的实测结论。

## 1. 判定表

| 项 | 能力 | 关键实测 | 判定 |
| --- | --- | --- | --- |
| A | bwrap 文件效果沙箱 | 二进制在（0.9.0，非 setuid）；三条功能命令（含预期成功的正控）全部 rc=1 `bwrap: No permissions to create new namespace` | **ENV_BLOCK** |
| B | Landlock 受限读 | ABI v4；`create_ruleset/add_rule/restrict_self` 全部 rc=0，但 restrict 后 `/etc/passwd` 与负控 secret 仍可整读（无 EACCES）→ 强制未生效；`/sys/kernel/security/landlock` 目录不存在 | **ENV_BLOCK**（接口应答、本环境观察不到强制；负控失败 ⇒ 绝不记 SUPPORTED） |
| C | 非特权 netns 网络隔离 | `unshare --net` rc=1 EPERM；`unshare --user --net` rc=1 EPERM；且当前已在宿主初始 netns | **ENV_BLOCK** |
| D | userns 身份映射 | `unshare --user` rc=0（可创建）；`--map-root-user` rc=1 `write failed /proc/self/uid_map: Operation not permitted`；嵌套 ns 内 uid_map 为空 | **ENV_BLOCK**（仅可创建、不可映射，作降权/隔离原语不可用） |
| E | 前轮旁证 | FINAL-REPORT.md §八 L112-115：chromium 沙箱失败 + 同根因旋钮实测 | **REF（前轮证据，非本轮）** |
| F | pinned 源码侧 | `profiles.ts:17`：两种 mode 均以 `--ro-bind / /` 起始 → 全盘可读、仅写受限 | **CONFIRMED（源码级）**：S-10 "对受限读不合格"表述成立 |

诚实纪律声明：A3/A4 负控与正控均为 bwrap **启动即败**（同一 EPERM 文案），不存在"读到了但没打印"的歧义空间；B 的负控以"成功读出 32 字节"实证失败；一切不能运行的项记 ENV_BLOCK，无一推断为 SUPPORTED。

## 2. 逐项明细（命令原文 → rc / 耗时 / 关键输出 / 判定）

耗时均取自正式复跑 log（`env-capability-probe-run.log`，全部 ≤2ms，B 为 27ms）。

### A. bwrap（ENV_BLOCK）

| # | 命令 | rc | 关键输出 |
| --- | --- | --- | --- |
| A1 | `which bwrap` | 0 | `/usr/bin/bwrap`（owner nobody:nogroup，mode 0755，**非 setuid**，getcap 空） |
| A2 | `bwrap --version` | 0 | `bubblewrap 0.9.0` |
| A3-负控 | `bwrap --ro-bind allowed allowed --dev /dev --proc /proc cat private/secret.txt`（于 probe-scratch） | 1 | `bwrap: No permissions to create new namespace, likely because the kernel does not allow non-privileged user namespaces.` |
| A4-正控 | 同 mount 组合 `cat /allowed/read.txt` | 1 | 同上（沙箱根本没起来 → 负控的"失败"不代表读限制生效） |
| A5 | `bwrap --unshare-all --ro-bind / / echo inside-ok` | 1 | 同上 |

机制注记（实测支撑）：非 setuid bwrap 需 userns+uid_map；D 项实测 uid_map 写入 EPERM（NoNewPrivs=1 继承抑制嵌套 ns 特权获取 + 旋钮=1）⇒ setuid 回退路径不存在（A1 已实测无 setuid/cap）⇒ 无法运行，以实测为准未做推断。

### B. Landlock（ENV_BLOCK：接口在、强制未生效）

| # | 命令 | rc | 关键输出 |
| --- | --- | --- | --- |
| B0 | `uname -r` | 0 | `6.8.0-142-generic` |
| B0 | `/sys/kernel/security/lsp` | 1 | `No such file or directory` |
| B0 | `/sys/kernel/security/landlock/` 目录 | 2 | 不存在（但 LSM 串含 landlock；`/boot/config-*`：`CONFIG_SECURITY_LANDLOCK=y`、`CONFIG_LSM="landlock,lockdown,yama,integrity,apparmor"`） |
| B0 | `which landlock-run landlock` | 1 | 不存在（pinned checkout 的 `node-addon-system/bin` 亦空，产品 landlock-run CLI 未安装；`/boot/config` grep rc=0） |
| B1 | `python3 landlock_probe.py`（ctypes 绑定，x86_64 syscall 444/445/446；仅作用于探测进程自身） | **5** | `ABI_VERSION=4`；`ruleset_fd=3`；`add_rule(allowed/) rc=0`；`restrict_self rc=0`；`POS: allowed/read.txt READ OK (21B)`；**`NEG-FAIL: secret READABLE (32B) -> enforcement ABSENT`** |

复核实验（landlock_debug.py，rc=0）：restrict_self 后进程内再开 `/etc/hostname`、`/etc/passwd` 均 ALLOWED ⇒ 领域虽 rc=0 挂载但零拦截。`NoNewPrivs` 前置已满足（rc=0，prctl 返回 0）。**未从内部定论根因**（候选：AppArmor `unpriv_bwrap` enforce 域与 Ubuntu userns 限制联动 / landlock securityfs 面缺失即初始化不完整），记录为环境异常事实：接口应答 ≠ 强制在场。判定按用途（受限读强制）取 ENV_BLOCK。

### C. 网络隔离（ENV_BLOCK）

| # | 命令 | rc | 关键输出 |
| --- | --- | --- | --- |
| C1 | `unshare --net -- echo ok` | 1 | `unshare: unshare failed: Operation not permitted`（非特权无 CAP_SYS_ADMIN） |
| C2 | `unshare --user --net -- echo ok` | 1 | 同上（userns 联合作为跳板同样 EPERM） |
| C3-loopback fixture | `ip -o link show` | 0 | `lo` UP（mtu 65536）+ ens32/ens34 —— 当前即宿主初始 netns `net:[4026531840]`；新 netns 进不去，lo 隔离实验无从执行 |
| C4 | `ip netns list` | 0 | 空列表（可列不可建） |

### D. 用户命名空间（ENV_BLOCK：可创建、不可映射）

| # | 命令 | rc | 关键输出 |
| --- | --- | --- | --- |
| D1 | `unshare --user -- echo ok` | 0 | `ok` —— 创建本身被放行（尽管旋钮=1；以实测记录，不套用"旋钮=1 必然拒绝创建"的推断） |
| D2 | `unshare --user --map-root-user -- echo ok` | 1 | `unshare: write failed /proc/self/uid_map: Operation not permitted` |
| D3 | `unshare --user -- cat /proc/self/uid_map` | 0 | （空输出 = 未映射 ns，无任何身份变化） |

结论：嵌套 userns 只是空壳，无法承载降权/身份映射语义。

### E. 前轮证据引用（旁证，REF，非本轮实测）

`/srv/workspace/dsh-plugins/dsh-agent-team/audit-reports/20261016-postalpha4-fix/FINAL-REPORT.md` §八（L110-115，2026-10-16 前轮实测）：批准探针 `probe-about-blank.mjs`（`chromiumSandbox: true`）报 **"Chromium sandboxing failed!"**；根因实测 `apparmor_restrict_unprivileged_userns = 1`；`landlock-run` 当时不存在。与本轮 A/C/D 失败**同根因方向**（chromium 沙箱同样依赖 unprivileged userns）。注明：该记录是前轮证据，作旁证不作本轮判定依据。

### F. pinned 源码侧事实（CONFIRMED）

来源：`tests/deepseek-harness-test-use`（detached @ `639ed01539…`，porcelain 空）`packages/sandbox/sandbox-local/src/profiles.ts` L16-23：

```ts
export function bwrapProfileArgs(policy: SandboxPolicy): string[] {
  const args = ['--ro-bind', '/', '/', '--dev', '/dev', '--unshare-pid', '--proc', '/proc', '--die-with-parent']
  if (policy.mode === 'workspace-write') {
    args.push('--tmpfs', '/tmp')
    args.push('--bind', policy.workspaceRoot, policy.workspaceRoot)
  }
  return args
}
```

判读：`read-only` 与 `workspace-write` 两个 profile 都以 `--ro-bind / /` 为底——**根文件系统整体仍可读**，机制只限制写（+ workspace 例外可写）。故 S-10 的 "`--ro-bind / /` 对受限读不合格" 表述 **CONFIRMED（源码级）**：该 profile 不提供任何读收缩能力。关联旁注：`index.ts:70-75` 的 `defaultProbeBwrap` 用同一 profile 跑 `true` 作功能探针（存在探针，不改变读语义）；本沙箱 PID 1 cmdline（§0）正是此函数的 workspace-write 产物实跑。

## 3. 每命令退出码清单（正式复跑节）

`0a-knob=0 0b-uname=0 0c-lsm=0 0d-secfs-landlock=2 0e-pid1-sandbox=0 0f-uidmap=0 0g-nnp=0 0h-apparmor-label=0 0i-netns=0 0j-id=0 | A1=0 A2=0 A3-neg=1 A4-pos=1 A5-unshare-all=1 | B1-landlock=5 | C1-netns=1 C2-user-netns=1 C3-loopback-baseline=0 | D1-userns=0 D2-map-root=1 D3-uidmap-empty=0`；脚本整体 exit=0；probe-scratch 由 trap 销毁（实测 `ls probe-scratch` rc=2 No such file）。

## 4. 对 P0-4 的结论性摘要

1. **本环境内不存在可用的第二层 OS 强制**：bwrap 嵌套 ENV_BLOCK、Landlock 观察不到强制、netns/userns 映射均 EPERM。任何假设"adapter 在 harness 会话内再套一层 OS 沙箱"的设计在当前宿主**不能记为可运行**。
2. OS 强制事实上由 **harness 自身的 bwrap**（§0）提供：写面收束到 workspace（内核级），但**读面全域开放**（`--ro-bind / /`，§F 源码级确认）→ "受限读"需求若为硬需求，需要宿主级动作（放开 userns 旋钮/换宿主/提供真实生效的 landlock），属管理员边界，超出本探测授权。
3. 本矩阵全部判定基于实测退出码与错误原文；前轮旁证（E）与源码级判定（F）已明确标注证据类别。
