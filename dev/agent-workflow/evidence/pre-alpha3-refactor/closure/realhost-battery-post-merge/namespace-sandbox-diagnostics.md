# Namespace / sandbox backend 可复现诊断（closure real-host battery 环境 blocker）

> 用途：DoD #20 实宿主电池中"依赖宿主 bash 真实执行的侧效检查"（pr-d C1/C2a、prf G6 等）在本环境不可验证的**精确根因与能力状态**。全部探测为只读命令；未弱化任何安全设置、未改内核/运行时配置、未绕过任何拒绝。用户已获告知此环境阻塞；补齐属**用户环境动作**（宿主级），不在本 closure 范围，也不构成 Alpha3 范围。

## 1. 被阻塞的测试腿（影响面）

| Kit | 检查 | 机制 | 阻塞点 |
|---|---|---|---|
| pr-d-control-real-host | C1 / C2a 侧效文件存在性 | leader allow 消费后，worker 的 bash 命令（`echo <marker> > <file> && echo <x>-executed`）由宿主 bash 工具真实执行 | 宿主 bash 工具的沙箱后端不可用 → 命令被拒绝执行（fail-closed） |
| pr-f-closure-smoke | G6（300KB stdout → 64KB inline cap → spill → `artifact-read-granted` 持久事实链） | 宿主 bash 工具真实执行 300KB 输出命令 | 同上（`grants=0 settleMs=null` = 命令从未执行） |

不依赖宿主 bash 真实执行的腿（F15 全部、pr-c 全部、E.12 各腿、pr-d 其余 38 项控制面检查）不受此阻塞影响。

## 2. 宿主侧拒绝（原始证据）

DSH 宿主 bash 工具返回给 worker 的精确 tool_result（`is_error=true`；来源 `prd-control-2026-10-01T11-13-39/mock.log`，`call-prd-g0d36xo0`）：

```
Error: sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.
```

抛出点：test-use `packages/sandbox/sandbox/lib/index.js` L256-261（`SandboxUnavailableError`，`SANDBOX_UNAVAILABLE`）——upstream 设计为 **fail-closed**：请求受限模式而无可用后端时，拒绝 unconfined 执行（不是静默放行）。

## 3. 可复现探测（本环境实际执行，2026-10-01 ~11:5xZ，全部只读）

```console
$ command -v bwrap
/usr/bin/bwrap
$ bwrap --version
bubblewrap 0.9.0

# [A] bwrap 完整探测（只读命名空间，运行 'true'）
$ bwrap --ro-bind / / --dev /dev --proc /proc true
bwrap: No permissions to create new namespace, likely because the kernel does not allow non-privileged user namespaces. See <https://deb.li/bubblewrap> or <file:///usr/share/doc/bubblewrap/README.Debian.gz>.
EXIT=1
$ bwrap --ro-bind / / true
（同上错误）EXIT=1
$ bwrap --unshare-user --unshare-pid --ro-bind / / true
（同上错误）EXIT=1

# [B] 细粒度 unshare 组合（bwrap 所需能力的分解）
$ unshare -U true
EXIT=0                                    # 单独的 user namespace 可创建
$ unshare -U -m true
unshare: unshare failed: Operation not permitted
EXIT=1                                    # user + mount namespace（bwrap ro-bind 所需）被拒
$ unshare -U -m -p -f true
unshare: unshare failed: Operation not permitted
EXIT=1
$ unshare -U --map-root-user true
unshare: write failed /proc/self/uid_map: Operation not permitted
EXIT=1                                    # uid_map 写入（bwrap uid 映射所需）被拒

# [C] 内核 sysctl（说明：限制不在内核全局开关）
$ cat /proc/sys/user/max_user_namespaces
2147483647
$ cat /proc/sys/kernel/unprivileged_userns_clone
1

# [D] 运行环境身份
$ uname -r
6.8.0-142-generic
$ id -u
1000
$ grep -E "^Seccomp:|^NoNewPrivs:|^CapEff:" /proc/self/status
CapEff:	0000000000000000
Seccomp:	0
NoNewPrivs:	1
（/proc/1/cgroup 无 docker/containerd/kubepods 标记；apparmor sysfs 不存在、apparmor 模块不存在）

# [E] 内核构建能力
$ grep -E "^CONFIG_LANDLOCK|^CONFIG_USER_NS" /boot/config-6.8.0-142-generic
CONFIG_USER_NS=y
（CONFIG_LANDLOCK 行不存在 = 该内核未构建 Landlock 支持）
```

## 4. 能力状态矩阵（已确认）

| 能力 | 状态 | 证据 |
|---|---|---|
| bwrap 二进制 | 已安装（0.9.0） | [1] |
| 内核 user namespace 构建（CONFIG_USER_NS） | =y | [E] |
| 内核 userns sysctl | 允许（2147483647 / clone=1） | [C] |
| 单独 user namespace 创建（非特权） | **可用** | [B] `unshare -U` EXIT=0 |
| user + mount namespace 组合（非特权） | **拒绝（EPERM）** | [B] `unshare -U -m` EXIT=1 |
| uid_map 写入（userns 内 uid 映射） | **拒绝（EPERM）** | [B] `--map-root-user` EXIT=1 |
| bwrap 实际运行 | **失败 EXIT=1** | [A] |
| Landlock 内核支持 | **未构建**（config 无 CONFIG_LANDLOCK） | [E] |
| seccomp / AppArmor | 无（0 / 不存在）——拒绝来自容器运行时层，非 seccomp/LSM 可辨识 | [D] |
| 进程能力 | CapEff=0（无能力），uid=1000，NoNewPrivs=1 | [D] |

**结论**：内核本身构建并允许 user namespace，但**本容器运行时层**拒绝非特权进程"userns 内嵌套 mount namespace"（`CLONE_NEWUSER|CLONE_NEWNS` 组合 → EPERM）与 `uid_map` 写入 —— bwrap 的受限沙箱机制因此不可用；Landlock 又未构建。两者都不存在 ⇒ DSH 宿主沙箱包（upstream）无可用后端 ⇒ 宿主 bash 工具按 fail-closed 设计拒绝一切受限执行。

## 5. 这两类侧效测试所需的独立能力（精确描述）

补齐 pr-d C1/C2a / prf G6（及任何未来依赖宿主 bash 真实执行的 kit 腿）需要：**DSH 宿主 bash 沙箱包拥有一个可工作的受限后端**，在本 Linux 环境下即以下任一（均为宿主/运行时级动作，非仓库内动作）：

1. **可工作的 bubblewrap 路径**：运行时允许非特权进程创建 user namespace 并在其中嵌套 mount namespace、且可写 `/proc/self/uid_map`（标准裸机/VM 或相应配置的容器运行时；当前容器恰好拒绝了这两个环节）；或
2. **Landlock 内核**：`CONFIG_LANDLOCK=y` 且宿主进程可用（当前内核 6.8.0-142-generic 未构建）。

（macOS = sandbox-exec；Windows = ACL restricted-token runner —— 与本 Linux 环境无关，列出仅为完整。）

## 6. 处置（按用户裁决口径）

- **不**禁用/弱化 sandbox、**不**改内核/运行时配置、**不**安装、**不**绕过拒绝 —— 已确认 TEST_METHODS 亦无已文档化的此类安全绕行（隔离 host 配置未"漏接"已文档化路径）。
- 受阻塞检查在 closure 报告中记为 **"未验证（具体环境 blocker：宿主沙箱后端不可用 — 内核/运行时能力缺失）"**；control-plane 通过与侧效未验证**分开记录**；**不宣称** pr-d 整 kit 或 DoD 全部 PASS。
- 收尾表述：**剩余环境验收 gate（宿主 bash 沙箱侧效腿）需用户环境动作**（具备 userns 嵌套/uid_map 或 Landlock 的宿主上以同一 tracked kit 零改动重跑即可补验）。
- 浏览器维度与本文档的 bash-sandbox blocker 是**两个独立维度**，分别单列（见 closure 报告 §3.1/§6）。

## 7. 执行层补证（2026-10-01 11:5xZ 追加，全部只读；回答"限制在哪一层"）

> 目的：区分"VM kernel 无 userns"与"嵌套沙箱子树的特权链限制"。**结论：后者。** VM kernel 构建并允许 userns（裸 `-U` 在本会话子树内成功；§3 [B] 在案）；被拒步骤发生在 **harness bwrap wrapper 子树内**的第二层非特权命名空间操作。

```console
# [F1] 本会话子树的 uid_map（读 /proc/self/uid_map；格式 = 内UID 外UID 计数）
$ cat /proc/self/uid_map
      1000          0          1        # inner 1000 ← outer 0：本会话已在 wrapper 创建的 userns 内（outer root 映射为 inner 1000）
$ cat /proc/self/setgroups
deny

# [F2] wrapper 进程（我的 pid-ns 的 PID 1 = harness 的 bwrap）
$ cat /proc/1/comm
bwrap
$ grep -E "^(CapEff|CapBnd|Seccomp|NoNewPrivs|Uid)" /proc/1/status
Uid:        1000 1000 1000 1000
CapEff:     0000000000000000
CapBnd:     0000000000000000            # 空 bounding set（wrapper 子树无任何可继承能力）
NoNewPrivs: 1
Seccomp:    0
（wrapper 命令线，来自 ps：bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent
  --tmpfs /tmp --bind <workspace> <workspace> -- bash -c … —— mountns+pidns，无 --unshare-user 字样
  但 uid_map 证明 wrapper 在 exec 前已建 userns（root 权限创建，随后以 inner 1000 运行子命令））

# [F3] VM/容器痕迹：非 docker，systemd 直跑
$ cat /proc/version
Linux version 6.8.0-142-generic (buildd@lcy02-amd64-049) … #142-Ubuntu SMP PREEMPT_DYNAMIC Wed Sep  2 14:24:27 UTC 2026
$ head -2 /proc/1/cgroup        # 注意：我的 pid-ns 内 PID 1 = bwrap；cgroup 行继承自父
0::/system.slice/dsh.service    # systemd cgroup v2：DSH harness = systemd 服务（VM 上直接运行，非容器）
$ ls -la /.dockerenv
ls: cannot access '/.dockerenv': No such file or directory

# [F4] SELinux：未激活（/sys/fs/selinux 不存在）

# [F5] 决定性探针：纯 mount ns（无 userns）—— 状态读取，零写入
$ unshare -m true
unshare: unshare failed: Operation not permitted
EXIT=1                                # 空 bounding set 下不能创建 mountns（与 -U -m 失败同轴）
```

**层结论**：
- 执行链 = VM（Ubuntu 24.04 / 6.8.0-142，systemd `dsh.service` root）→ **harness bwrap wrapper**（userns outer-root→inner-1000 + mountns + pidns）→ 会话进程（uid 1000，**CapBnd=0**，**NoNewPrivs=1**，setgroups=deny，Seccomp=0，无 AppArmor/SELinux）→ kit → DSH host → **宿主 bwrap（第 3 层嵌套，失败点）**。
- 被拒 = **第二层非特权** `CLONE_NEWUSER|CLONE_NEWNS` 组合 + uid_map 写入（空 bounding set + no_new_privs + setgroups deny 三重继承）；**不是** kernel 全局禁止（裸 `unshare -U` EXIT=0；sysctl 全开；§3 [B][C] 在案）。
- **活证据**：root 层（dsh.service）的 userns+mountns+pidns 创建在本 VM 上此刻可用（wrapper 本身）—— VM kernel 不是 blocker；限制在 wrapper 子树特权链。
- **bwrap 错误文案勘误**：bwrap 打印的 "the kernel does not allow non-privileged user namespaces" 是其泛化诊断，与本环境实测（裸 userns 允许）不符；精确被拒步骤以 §3 [B] + 本节 [F5] 为准。

**用户侧可执行验证（不改任何配置；只回答"该 VM 上 wrapper 之外能否嵌套"**：
```
# 在 VM 上的普通用户终端（非本 harness 会话）执行：
$ unshare -U -m true && echo NESTED-OK
```
- NESTED-OK → 从该上下文（wrapper 之外）以同一 tracked kit 零改动重跑即解锁宿主 bash 侧效腿（pr-d C1/C2a + prf G6）；kernel/config 零改动。
- 同样 EPERM → 限制在 VM/云策略层（非 harness 子树）→ 需运行时/VM 级策略调整（用户环境决策）。
- 替代后端 = Landlock（本内核未构建，不现实）；`danger-full-access` = 安全弱化（按用户裁决不采用）。

## 8. OBSERVED vs INFERRED 澄清（2026-10-01 追加；用户指令：勿把机制当本机已逐步骤证明）

> 本节将前文（§3/§7 及会话答复）中的**直接观测**与**推断**明确分开。前文行零改写；冲突处以本节口径为准。

**OBSERVED（本机实测/只读，逐条可复现）**：
1. 本会话子树：`unshare -U true` EXIT=0；`unshare -U -m true` EXIT=1（"unshare failed: Operation not permitted"）；`unshare -m true` EXIT=1（同文案）；`unshare -U --map-root-user true` EXIT=1（"write failed /proc/self/uid_map: Operation not permitted"）；`bwrap --ro-bind / / --dev /dev --proc /proc true` EXIT=1（bwrap 自打印泛化文案）。
2. 本会话子树状态（只读）：`/proc/self/uid_map` = `1000 0 1`；`/proc/1` = bwrap（Uid 1000×4，CapEff=0，CapBnd=0，NoNewPrivs=1，Seccomp=0，setgroups=deny）；cgroup `0::/system.slice/dsh.service`；无 `/.dockerenv`；内核 6.8.0-142-generic（Ubuntu SMP）；`/boot/config` 有 CONFIG_USER_NS=y、无 CONFIG_LANDLOCK；`max_user_namespaces=2147483647`、`unprivileged_userns_clone=1`；无 SELinux/AppArmor。
3. 二进制状态（只读）：`/usr/bin/bwrap` = `-rwxr-xr-x nobody:nogroup`（**无 setuid 位**），getcap 无输出（**无 file capabilities**），bubblewrap 0.9.0。
4. mountinfo：工作区挂载设备 252:0（ext4 /dev/mapper/ubuntu--vg-ubuntu--lv），源路径 = 目标路径 = `/srv/workspace/dsh-plugins/dsh-agent-team`，master:1（自全局 mount ns 传播）。
5. **用户普通 SSH 实测（用户回报，2026-10-01）**：`unshare -U true` EXIT=0；`unshare -U --map-root-user -m` 写 `/proc/self/uid_map` EPERM EXIT=1；`bwrap --ro-bind / / --dev /dev --proc /proc /usr/bin/true` EXIT=0。

**INFERRED（由上述观测推出的机制解释；未在本机逐步证明，标注为推断）**：
1. "bwrap 0.9.0 无特权时自动创建 user-namespace fallback 并写**恒等** uid_map（调用者 uid→同号），该恒等映射被允许、而 `--map-root-user` 的 inner-0 映射被本 VM 的 uid_map 策略拒绝" —— 这是对观测 5（bwrap 成功 vs --map-root-user 失败）的**机制假设**，与 bubblewrap 上游设计一致，但**未**在本机以 strace/逐映射实验证明（本会话子树内 bwrap 本身失败，无法在此复现其成功路径）。
2. "wrapper 由 dsh.service（root）在 exec 子命令前创建 userns（outer root→inner 1000），随后以 inner 1000 运行" —— 由观测 2 的 `uid_map "1000 0 1"` + cgroup 行**推断**（who/when 未直接观测）。
3. "本 VM 内核对非特权 uid_map 写入实行恒等-only 限制" —— 由观测 5 的两条 SSH 结果**推断**；标准 Ubuntu 24.04 的默认行为是否如此未核对（也可能是 sshd/运行时层策略）。
4. 宿主 bash 工具失败链中"bwrap 先尝试 CLONE_NEWNS 再走 fallback"的**步骤顺序** —— 未在本机观测（子树内仅见最终 EPERM + 泛化文案）。

**对本轮结论的影响**：核心结论不依赖任何 INFERRED 项 —— 它仅由 OBSERVED 支撑：(a) 本会话（harness wrapper 子树）内 bwrap 失败（观测 1）、用户 SSH 内 bwrap 成功（观测 5）→ **嵌套外层 wrapper 层是差异源**；(b) 所需能力 = 用户 SSH 上下文已具备（bwrap 成功 = 宿主 sandbox 后端可用的直接证据）。机制解释（INFERRED 1–4）仅供用户侧排查参考，不作为报告判定依据。

## 9. Landlock 链只读研究 + 更正（2026-10-01 追加；用户目标 = Alpha3/4 自动验收配置方案研究，仅研究不实施）

> 本轮全部为只读（源码/配置/运行时状态/已安装 man 页）；**零实施、零安全设置变更**。pinned 运行时 = test-use @ 46a7f68b 源码。

**更正 1（kernel Landlock 状态 —— 运行时证据推翻 config 文件）**：
- **OBSERVED（运行时权威）**：`/sys/kernel/security/lsm` = `lockdown,capability,landlock,yama,apparmor` → **运行内核 landlock LSM 已编译且 active**（6.8.0-142-generic；/proc/version = Ubuntu 官方构建）。
- OBSERVED（config 文件）：`/boot/config-6.8.0-142-generic` 无 `CONFIG_LANDLOCK` 条目（grep 零命中；文件头 = "Linux/x86 6.8.12 Kernel Configuration" —— Ubuntu 6.8.0-142 对应上游 6.8.12，版本映射本身一致）。
- **裁决**：两证据矛盾 → 运行时 lsm 列表权威（LSM 只能来自已编译内建；lsm 列表在 = 内核有 landlock）→ **前文/报告中"CONFIG_LANDLOCK 未构建/Landlock 未构建"结论作废**（该表述仅基于 config 文件；config 文件判不可靠/疑 stale）。修正后事实 = **内核层 Landlock 可用（active）；DSH landlock 轮失败原因在 helper 缺失，不在 kernel**。

**更正 2（外层 userns 创建者 —— root 结论证据不支持）**：
- OBSERVED：dsh.service unit（/etc/systemd/system/dsh.service）= `User=user`（uid 1000）、无硬化指令（无 NoNewPrivs/CapabilityBoundingSet 等）；ExecStart = /home/user/bin/start-dsh.sh = 纯用户脚本（nvm node 24.21.0 + `pnpm dsh web --no-open --port 3080` + 代理 env；无 sudo/setpriv/unsetuid 环节）；/usr/bin/bwrap 无 setuid 位、无 file caps（§3 在案）。
- OBSERVED：本会话 uid_map = `1000 0 1`（outer **0** → inner 1000）；kernel 规则下非 CAP_SETUID（init ns）进程不可写 outer-0 映射。
- bwrap 0.9.0 自身帮助（已安装，可引用）：`--unshare-user` = "Create new user namespace (**may be automatically implied if not setuid**)"（= 文档化的自动 fallback）；`--disable-userns` = "Disable further use of user namespaces inside sandbox"（**该 flag 存在**，但 wrapper argv 未含；wrapper argv 亦未含 `--unshare-user`）。
- **裁决**：dsh.service 进程树内无 root（OBSERVED）；观测映射与"uid-1000 进程写 outer-0"矛盾、亦与 bwrap 自动 fallback 的调用者身份映射形态不吻合 → **外层 userns 创建者 = 未观测/未定**（前文"root 的 dsh.service 创建"推断撤回，不再推演）。用户侧一条只读核验命令（普通 SSH）：
  `ps -eo pid,ppid,uid,args | awk -v mp=$(systemctl show dsh.service -p MainPID --value) '$1==mp || $2==mp' && grep -E "^(Name|Uid|CapBnd|NoNewPrivs)" /proc/$(systemctl show dsh.service -p MainPID --value)/status`

**pinned 运行时 Landlock 链事实（源码行号可核）**：
- Linux backend chain = `['bwrap', 'landlock']`（sandbox-local/src/index.ts L160-163；顺序功能探测，bwrap 在前）。
- bwrap 轮探测 = 同形 profile 跑 `-- true`（index.ts L70）—— 本会话子树内 EXIT=1（§3 [B] 观测）。
- landlock 轮探测 = `launcherPath()` + `--probe`（entry/src/index.ts L116-127：spawnSync，默认 timeout 2000ms，`stdio: ['ignore','pipe','ignore']` = **stderr 丢弃**（用户判断正确）；exit!=0 → 'unusable'；stdout 含 "partially enforced" → partial，否则 full）。
- `launcherPath()`（entry/src/index.ts L69-83）：解析 `@deepseek-ai/node-addon-system-<platform>-<arch>`（本树 = **workspace 链接** `link:../../native/system/packages/entry`，非注册表包；entry/node_modules 平台链接在位）→ `bin/landlock-run`；**不检查存在性，probe 是唯一可用性信号**（源码注释原文："a missing binary probes 'unusable' the same way an unenforcing kernel does"）。
- **实测（pinned 树）**：`native/system/packages/linux-x64/bin/` = 仅 `glibc/system.node`（常规 build 的 --host-addon-only 产物）；**`landlock-run` 不存在**（build.ts L45-46：`--host-addon-only` 跳过 non-node-api binaries；landlock-run = kind `static-musl` → L55 编译器 = **musl-gcc**）。
- 工具链（只读）：musl-gcc = **NOT FOUND**；gcc/cc/clang 在（/usr/bin）。
- 对照物：插件仓 worktree node_modules 中注册表版 `@deepseek-ai/node-addon-system-linux-x64@0.1.2` 的 prebuilt `bin/landlock-run` 在盘（-rwxr-xr-x，ELF x86-64 静态，38552B，v0.1.2 = 与 entry 包同版本）—— pinned 运行时**不使用**它（workspace 链接优先），仅作"prebuilt 可得"对照。
- **四类失败区分（本环境 pinned runtime）**：(a) 路径不存在 = **命中**（helper 从未构建）；(b) optional 包缺失 = 不适用（workspace 链接在位）；(c) 执行位/架构 = 不适用（先于 (a) 不适用；对照物在盘可执行）；(d) kernel LSM 拒绝 = **未被触达**（链在 (a) 即不可用）—— DSH probe 从未测到 kernel。
- `landlockProfileArgs`（workspace-write，profiles.ts）= `--ro /` + `--rw /dev/null /tmp <workspaceRoot>`（fs allow-list 形态）；dist runner-failure signature landlock = `["permission denied"]`（bwrap = EROFS/[sandbox: file access denied]）→ 若切 landlock 后端，kit 的 deny-lane 断言（按 bwrap 文案写）需适配（披露项，未实施）。
- `bin/` gitignore 状态（pinned 树 `native/system/.gitignore` L4：`packages/*/bin/`）→ helper 落位**不脏 H1 porcelain**（可逆 = 删文件）。

**受支持选项与影响（仅报告；执行待用户 action-time 确认；agent 零实施）**：
| 选项 | 依据 | 影响 |
|---|---|---|
| O1 prebuilt landlock-run 落位 pinned 树 bin/（gitignored，可逆）→ landlock 轮 probe 过（kernel landlock active）→ 后端自动切 landlock | 上列源码 + 运行时 lsm + 盘上 prebuilt | 保留 fs 隔离（allow-list）；隔离维度变化：无新 pid/mount ns（bwrap 有 --unshare-pid）；probe full/partial 判定为准；kit deny-lane 文案适配 |
| O2 musl-gcc + 完整 native build | build.ts L55 | 同 O1（构建同类 helper）；需装工具链 |
| O3 用户普通 SSH 手工跑（脚本已备，非当前优先） | 用户实测 bwrap EXIT=0 | 零配置变更；保留被测 bwrap |
| O4 per-call 宽模式/danger-full-access/escalation | sandbox schema + escalation 模块 | **安全弱化**（bypass confinement）—— 按用户裁决不采用 |
| O5 外层 wrapper 机制调整（NNP/Caps/userns 创建） | 未定（创建者未观测） | 安全设置变更 —— 用户明令当前禁止 |
