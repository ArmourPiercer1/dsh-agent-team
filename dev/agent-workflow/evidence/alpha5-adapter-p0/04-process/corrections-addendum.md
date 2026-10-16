# corrections-addendum — env-capability-matrix.md 判定修正行（2026-10-15 收紧定性轮）

> 本文件**不改** env-capability-matrix.md 原文；以下为追加修正行，证据 = landlock-diagnosis.md + diag/run-{ext4,tmpfs,bugrepro,nesting,prior-script}.log + landlock-diag.sh。

| 行 | 原判定 | 修正判定 | 依据（实测） |
|---|---|---|---|
| §矩阵 B「Landlock 受限读」 | ENV_BLOCK（"接口应答、本环境观察不到强制"） | **SUPPORTED（landlock 读面可强制）**；原行内负控作废 | 原负控为探针 bug：`READ=3`（EXECUTE|WRITE_FILE）缺 READ_FILE 位 → 读未被中介；同常量逐字复跑复现 NEG-FAIL，handled=0x7FFF 后负控 `EACCES 'Permission denied'`、正控/零规则鉴别器/fork+exec 继承腿全过（ext4+tmpfs 双fs，OVERALL rc=0 ENFORCE-WORKS） |
| §B B0「/sys/kernel/security/landlock 不存在（异常候选）」 | 记为环境异常事实 | **撤销该信号意义**：mainline landlock 不在 securityfs 建目，缺失是正常形态，与强制在场无关 | landlock-diagnosis.md §3.5 |
| §B B1 复核行（"零拦截…未从内部定论根因"） | 环境异常，根因未定 | 根因已定 = 上述探针配置错（handled_access 不全），环境无异常 | diag/run-bugrepro.log 对照实验 |
| §结论 1「本环境内不存在可用的第二层 OS 强制」 | 成立 | **不成立（部分撤销）**：进程自锁 landlock 是本环境实测可用的第二层强制（读写面收缩，不依赖 userns/bwrap 嵌套）；bwrap/netns/uid_map 三行维持原判定 | landlock-diagnosis.md §2/§5 |
| §结论 2「受限读需宿主级动作」 | 成立 | **部分撤销**：受限读可由 adapter 在子进程 exec 前 landlock 自锁达成（syscall ABI v4，ctypes 可复跑脚本已证）；仅 bwrap 嵌套与 uid 映射降权仍需宿主级动作 | 同上 |
| §矩阵 D「userns 可创建、不可映射」 | ENV_BLOCK | **维持**，措辞收紧到实测机制层：拦截点①= uid_map 写入内核直接 EPERM（raw write 于当前 ns 与新建空 ns 均 `Operation not permitted`）；拦截点②= mount/pid/ipc/uts 类 ns 在 `unshare()` 调用层即 EPERM（本进程 CapEff/CapBnd=0000000000000000；`apparmor_restrict_unprivileged_userns=1` 在场，但沙箱内 profiles 不可读，不确证其为唯一因）。**不写"结构性不可能"** | diag/run-nesting.log；`unshare -Um/-Ump` 的 EPERM 发生在 unshare() 层（-m=mount，非 map），与 uid_map 是两个拦截点 |
| §矩阵 A「bwrap」 | ENV_BLOCK | **维持**（一条复核 rc=1 文案与前轮逐字一致） | diag/run-nesting.log |

适用面声明：修正仅覆盖 **landlock 文件读写面**能力行；网络隔离（C）与前轮其余判定不受本 addendum 影响。原 matrix"负控失败⇒绝不记 SUPPORTED"的诚实纪律本身无误——本轮负控以 errno 原文（EACCES）+双鉴别器（零规则 denyall、badhandled 反向演示）满足其要求后方可改判。
