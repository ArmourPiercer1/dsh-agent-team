# a5w-portprobe — RCA-1 复核 + 探针修复实录（dated 2026-10-30T22:0x–22:3xZ，真实 UTC）

任务分支 `task/a5w-portprobe-20261030`，base `origin/master` @ `3e7fd25e0ba32004f427a235c7691fdc4fdfec37`。
上游 RCA 正本在协调者分支 `origin/task/a5w-bootwave-20261030` @ `48c06b353c177785052ef9e278bdfc239a91f4a1`
路径 `dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/RCA-1-bw1-bw2.md`（**未进 master，故本文件自带复核数据，
本仓一切引用以本文件为准**；读正本：`git show origin/task/a5w-bootwave-20261030:dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/RCA-1-bw1-bw2.md`）。

## 1. 独立复核（改动前，本机 node v24.21.0）

同一进程内 connect / bind 双探针（`.artifacts/tmp/scratch/probecheck.mjs`，gitignored 草稿）：

| 目标 | connect 探针 | bind 探针 |
| --- | --- | --- |
| 3493（带内，无监听） | CONNECT-TIMEOUT 1502 ms | bind-ok 6 ms |
| 13099（带尾，无监听） | CONNECT-TIMEOUT ~1502 ms | — |
| 13050（带内，无监听） | CONNECT-TIMEOUT ~1501 ms | bind-ok ~6 ms |
| 3080（真实监听，红线不动） | connect-ok 2 ms | bind-error EADDRINUSE 4 ms |

`/proc/net/tcp` + `/proc/net/tcp6` 状态 0A 普查：本盒仅有 `:53 ×3` 与 `:3080` 五个监听条目，
mock/host 带内监听者 = 0。**结论与 RCA-1 一致**：本盒对已关闭 loopback 端口的 SYN 黑洞（超时，无 RST），
`tests/characterization/lib/util.mjs` 旧实现把 1500 ms connect 超时记为 in-use ⇒ 全带误判占用。

## 2. 修复（唯一改动文件：`tests/characterization/lib/util.mjs`）

`portInUse(port, timeoutMs = 1500)` 导出签名与其余导出（含 `waitForPortFree`）逐字节不变；
新增模块私有 `bindProbeInUse`。三态分类：connect 应答→true（快路径不变）、connect 报错→false（不变）、
connect 超时→**不再判占用**，交给一次性 bind 探针：EADDRINUSE→true，bind 成功→close→false。

披露三条（全部写进函数头注释）：
1. **残余窗口**：只绑在非 loopback 接口、且 backlog 永不应答 loopback SYN 的监听者，bind 探针会成功 ⇒ 判 FREE。
   本盒无此类监听者（普查见上），普通监听者（含 0.0.0.0）仍被 connect 快路径先抓住。
2. **fail-closed**：EACCES/EPERM 或 bind 探针自身超时 ⇒ 仍判 IN USE（保留旧保守意图，只去掉假阳性）。
3. **副作用**：仅走不确定路径时该函数会真绑定该端口数毫秒后释放（ms 级窗口，非泄漏）。

bind 探针看门狗取 `Math.max(timeoutMs, 1000)`：调用方给极小 connect 预算时也不能抢在本地 bind 答案之前
fail-closed，否则每个空闲端口都会被误判占用（RCA-1 换一张脸）。NC-5 专门钉这条。

## 3. 本机探针"预热"现象（新事实，写给协调者的 boot 预算）

一个从未被本地绑定过的端口：connect = 黑洞超时（1.5 s）。
**同一端口一旦被本地 bind+close 之后**：connect 改为快速 ECONNREFUSED（实测 13077、3492、3491）。
后果：(a) 第一次探测每个空闲端口多花 ~1.5 s，之后同端口变快（boot 首波端口预算要按 ~1.5 s/端口预留）；
(b) 负控测试不能"先 bind 证明空闲、再断言黑洞"，那会自我污染——NC-2 的"确无监听"证明改用 `/proc/net/tcp`
普查，且每轮消耗一个未预热端口（前向行走，不复用）。

## 4. 在册带内真实外部监听者（非探针问题）

见同目录 `foreign-band-listeners.md`。要点：13030/13031/13032 在多次测量中 connect 应答 + bind EADDRINUSE
但 `/proc/net/tcp` 无条目（WSL mirrored 的 Windows 侧监听者）；3496-3500 一度 EADDRINUSE 后恢复可绑（flapping）。
`acquirePortLease` 对它们抛 EXTERNAL_BIND 是**正确行为**（那些端口本盒就是不可用），boot 侧
`acquireFirstFreeLease` 会自动跨过它们。
