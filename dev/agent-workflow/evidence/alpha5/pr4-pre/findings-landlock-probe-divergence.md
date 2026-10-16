# PR4 前置诊断 — S0 冲突（landlock 探针分歧）取证  2026-10-16

代理=qwen3.8-flash-next / harness=DeepSeek Harness（分列）。宿主 Linux 6.8.0-142-generic（本会话在 harness bwrap 沙箱内）。协调者代存（代理 /tmp 跨命令不持久，findings 全文经消息交付；正式落库归 PR4 writer）。

## 1. 两代探针形状 + 当前宿主逐字重跑（各 1 次）
(a) host bash 后端（pinned 0.2.0-rc.2 @639ed01539，W=.worktrees/exp-alpha5-poc-20261016/tests/deepseek-harness-test-use）：Linux 链=两 rung ['bwrap','landlock']（packages/sandbox/sandbox-local/src/index.ts:161）；rung1 defaultProbeBwrap=spawnSync('bwrap',[read-only profile],'true')（同文件 :65-72）；rung2=spawnSync(launcherPath(),['--probe'])（native/system/packages/entry/src/index.ts:116-125）；launcherPath=require.resolve('@deepseek-ai/node-addon-system-linux-x64/package.json')→bin/landlock-run（:69-82），注释逐字："a missing binary probes `unusable` the same way an unenforcing kernel does"（存在性=唯一可用性信号）；双 rung 皆 unusable → SandboxUnavailableError（packages/sandbox/sandbox/src/index.ts:135-136）。探测对象=预编译 launcher 二进制+bwrap 功能跑；不探测 landlock syscall/ABI、不探测 securityfs feature 文件、全树 grep 无 ENVOBJ——"Landlock-enforcing kernel" 是错误文案指引语，不是测量值。当前重跑：bwrap rc=1 EPERM 原文；which landlock-run=1；pinned bin/ 实测无 landlock-run → 'unusable' ⇒ 宿主后端同结论现仍现存，且仍=存在性/spawn 层。
(b) ctypes/裸 syscall ABI v4（04-process/landlock-diag.sh 一次）：DIAG_RC=0 ENFORCE-WORKS；abi_version=4；selective+denyall 双 ENFORCE-CONFIRMED；badhandled 腿复现旧假 ABSENT（"DEMO secret readable…MATCH"）；prior 腿 secret=DENIED；逐权限 get_abi：fs 15 位（v1/v2/v4 分层）+net 2 位（v4）全 SUPPORTED。

## 2. 分歧根因（输入差异逐项）
1) 探测对象不同：host landlock rung=launcher 可 spawn --probe（缺件≡内核无强制，源码自认不可区分）；ctypes 探针=直接 GET_VERSION+真实强制负控 ⇒ 存在性检查被错误文案伪装成能力结论。
2) 旧 §B ENV_BLOCK=探针常量 bug（env-capability-probe.sh:83 READ=3，handled 缺 READ_FILE ⇒ 读不被中介），今日 badhandled 腿同内核复现。
3) userns/AppArmor 干扰仍在（apparmor_restrict_unprivileged_userns=1/unprivileged_userns_clone=1/max_user_namespaces=2147483647/lsm 含 landlock/securityfs landlock 目不存在=正常形态 SUP-02/apparmor profiles=EPERM 原文/attr=bwrap//&unpriv_bwrap (enforce)/CapBnd=0/NoNewPrivs=1）但仅作用 bwrap/netns/uid_map 腿，与 landlock 能力判定无关。

## 3. PR4 探针设计建议
权威面=裸 syscall GET_VERSION（best-effort+partial，同 entry/src/main.c:231-237）+真实 enforcement 双证（restrict 后新建 fd 负控 errno 原文+零规则鉴别器，diag/lanes 形态）；存在性检查（launcher/PATH CLI/securityfs 目）仅作前置条件报告，其失败文案不得含内核断言。
landlock-run 缺件对宿主内置链=硬阻塞（fail-closed 文案不变），对 PR4 信任预启动器=非硬阻塞：P1 子进程入口自锁/P2 fork-not-exec 交接均裸 syscall 444/445/446（lanes notes.md 机制§1-3 实证），不链接 liblandlock、不依赖 npm 预编译件（host 自家 main.c 亦 static-musl 裸 syscall）；Config.runnerCommand 为既有公开逃逸口。

## 4. S0 登记复核
SUP-01 文字与实测一致（OS_ENFORCED/常量根因/bwrap·netns·uid_map 维持 ENV_BLOCK 三点均合）。勘误两处：任务句"常量 bug=SUP-16"为误引（SUP-16=exit134/V8 堆，矩阵:34；常量 bug 载于 SUP-01/SUP-03）；review-S0.md §3 五类冲突编号 landlock=①、④=H6 dynRan——按任务事实复核结论=一致。
