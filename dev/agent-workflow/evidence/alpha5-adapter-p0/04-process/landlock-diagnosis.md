# Landlock 诊断（Alpha.5 P0-4 收紧定性轮，2026-10-15）

**判定：ENFORCE-WORKS（landlock ABI v4 读面强制生效）**
前轮（env-capability-matrix.md §B）ENV_BLOCK 定性**需修正为 SUPPORTED（landlock 读面）**——前轮负控失败是**探针自身配置错误**，非环境无强制。

## 1. 前轮误判根因（实测定位，非推测）

前轮 `landlock_probe.py` 常量行（env-capability-probe.sh §B heredoc 原文）：

```
SYS_CR, SYS_AR, SYS_RS, READ = 444, 445, 446, 3  # x86_64 syscall 号; READ_FILE|READ_DIR
```

`3 = 0x3 = EXECUTE|WRITE_FILE`，而 `READ_FILE|READ_DIR = 4|8 = 12 = 0xC`——**注释正确、常量错误，handled_access_fs 从未包含 READ_FILE**。READ_FILE 不在 handled 集 ⇒ 读根本不被中介 ⇒ "secret 仍可整读"是该配置错的必然产物。复现证据（diag/run-bugrepro.log）：

- handled=0x3（逐字沿用前轮常量）→ `BUGGY(handled=0x3): secret READABLE (32B) == prior NEG-FAIL REPRODUCED`
- 同环境 handled=0x7FFF 正确集 → 负控 `EACCES 'Permission denied'`

## 2. 正确探针实测（可复跑：`bash landlock-diag.sh [scratch]`，ext4 与 tmpfs 双fs均 rc=0）

日志：diag/run-ext4.log、diag/run-tmpfs.log。单进程内、restrict 后新建 fd 测负控，关键原文：

```
[ABI] version=4 supported_fs=0x7fff handled_access_fs=0x7fff（15 位全声明）handled_access_net=0x0（显式不声明）
[SC] create_ruleset(attr16): rc=4 errno=0    [SC] landlock_restrict_self: rc=0 errno=0
[CHK] NEG read private/secret.txt: expect=EACCES got=EACCES strerror='Permission denied' -> MATCH
[CHK] NEG read other/outside.txt:  expect=EACCES got=EACCES -> MATCH
[CHK] NEG create private/new.txt:  expect=EACCES got=EACCES -> MATCH
[CHK] POS read allowed/ok.txt:     expect=OK got=OK -> MATCH
[CHK] POS write allowed/new.txt:   expect=OK got=OK -> MATCH
[EXEC] /usr/bin/cat <allowed/ok.txt> -> rc=0 out=b'SYNTHETIC-OK-CONTROL'
[EXEC] /usr/bin/cat <private/secret.txt> -> rc=1 '...: Permission den(ied)'
VERDICT-selective: ENFORCE-CONFIRMED
VERDICT-denyall: ENFORCE-CONFIRMED   （零规则鉴别器：一切 open 必 EACCES，双命中）
OVERALL: rc=0 ENFORCE-WORKS
```

fork+exec 继承腿同步实测：restrict 后 `cat allowed` 成功、`cat private` 失败（cat 自身可 exec，排除"二进制不可读"假阴性）⇒ 域随 fork+exec 继承。

## 3. 常见探针错误逐条排除（notes）

1. **handled_access 缺 READ_FILE**——前轮实际踩中（§1），且 badhandled 模式演示其后果（`DEMO secret readable (READ_FILE not handled)` MATCH）。
2. **负控 fd 在 restrict 前打开**——本探针 restrict 前额外持 secret fd：restrict 后经其 read **成功**（by-design，Landlock 不追溯已开 fd）；负控全部用 restrict 后 `os.open` 新建 fd，故 EACCES 真实。
3. **测子进程而 restrict 只作用本进程**——本探针主腿同进程；继承腿显式 fork+exec 验证（§2 EXEC 两行），两腿结论一致。
4. **规则/测试对象错**——private 与 other 两个独立目录均"handled 且未 allow"；正控同时含 scratch 内允许目录与域外系统文件（/etc/hostname），三正控不受规则收紧误伤。
5. **`/sys/kernel/security/landlock` 缺失≠无强制**——mainline landlock 不在 securityfs 建目；前轮 B0 该观察与强制在场与否无关（`/sys/kernel/security/lsm` 含 landlock 才是相关信号）。

## 4. 嵌套限制实测（不外推；日志 diag/run-nesting.log）

| 探针 | rc | stderr/输出原文 |
|---|---|---|
| `unshare -U true` | 0 | （成功） |
| `unshare -Um true`（-m=**mount** ns，非 map） | 1 | `unshare: unshare failed: Operation not permitted` |
| `unshare -Ump true` | 1 | 同上（EPERM 在 unshare() 调用层，未到 uid_map 写） |
| `unshare -U --map-root-user true` | 1 | `unshare: write failed /proc/self/uid_map: Operation not permitted` |
| raw `write /proc/self/uid_map`（当前 ns / 新建空 ns） | EPERM | `Operation not permitted`（两处相同） |
| `unshare -Up/-Ui/-Uu` | 1 | `unshare failed: Operation not permitted` |
| bwrap 一条复核 | 1 | `bwrap: No permissions to create new namespace…`（与前轮一致） |

线索（只读）：`unprivileged_userns_clone=1`、`apparmor_restrict_unprivileged_userns=1`、`max_user_namespaces=2147483647`；`aa-status --json` rc=4 `You do not have enough privilege to read the profile set.`；`/sys/kernel/security/apparmor/profiles` = Permission denied；本进程 `bwrap//&unpriv_bwrap (enforce)`、`CapEff/CapBnd=0000000000000000`、`NoNewPrivs=1`。

**实测机制层结论（仅此，不外推"结构性不可能"）**：userns 可创建；拦截点在 (a) 非 user 类 ns 的 `unshare()` 调用层 EPERM（本进程 CapBnd=0，无 CAP_SYS_ADMIN 可达路径），(b) uid_map 写入被内核直接 EPERM（`apparmor_restrict_unprivileged_userns=1` 为在场旋钮，沙箱内读不到 profile 集、无法从内部确证其为唯一联动因）。旋钮值本身均处于"允许"侧。

## 5. 对 adapter 设计的直接含义

前轮"本环境不存在可用的第二层 OS 强制"结论**不成立**：进程自锁 landlock（ctypes/syscall 即可，ABI v4）在本环境**实测可强制读写面收缩**，不依赖 bwrap 嵌套/userns/uid_map 任一失败路径。S-10 的"bwrap `--ro-bind / /` 读面全域开放"缺口可由 landlock 域补（adapter 子进程启动前自锁），可复跑证据 = 本文件 §2 + `landlock-diag.sh`。

范围纪律回执：仅读系统 + 自有进程行为；未改 sysctl/模块/apparmor/limits；未触 :3080；scratch 用毕已清理（diag/ 仅存日志与脚本）。
