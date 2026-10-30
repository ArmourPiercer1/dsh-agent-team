# 在册测试带内的真实外部监听者（dated 2026-10-30T22:16–22:19Z，真实 UTC）

## 现象

跑 `tests/world-factory/world-factory.test.mjs` 的"host band fall-through"leg 时，
`acquirePortLease` 对 **13030** 抛 `EXTERNAL_BIND`。两条独立探针同时确认这不是探针误判：

```
$ node .artifacts/tmp/scratch/probecheck.mjs connect 13030   # 1.5 s 预算
connect-ok 1 ms
$ node .artifacts/tmp/scratch/probecheck.mjs bind 13030
bind-error EADDRINUSE 18 ms
$ awk 'NR>1{split($2,a,":"); p=strtonum("0x" a[2]); if(p>=13029&&p<=13035) print FILENAME,$2,"state="$4}' /proc/net/tcp /proc/net/tcp6
（无输出：Linux 侧无该端口的任何 tcp/tcp6 条目）
$ ss -tlnp
LISTEN 127.0.0.1:3080 | 10.255.255.254:53 | 127.0.0.53%lo:53 | 127.0.0.54:53   # 仅此
```

同法普查在册四段（`3181-3199 / 3491-3500 / 13000-13049 / 13050-13099`，逐端口 bind 试探）：

| 时刻（UTC） | 不可绑端口 |
| --- | --- |
| 22:14 前后 | 3496,3497,3498,3499,3500（EADDRINUSE）+ 13030,13031,13032 |
| 22:19:12 | 13030,13031,13032 |
| 22:19:13（立即重复） | 13030,13031,13032 |

- 13030/13031/13032：connect **应答**（1 ms，写入数据后被 ECONNRESET）+ bind EADDRINUSE + Linux 侧
  无任何 tcp 条目 ⇒ WSL mirrored 网络里 Windows 侧的监听者。稳定复现，非瞬时。
- 3496-3500：一度全部 EADDRINUSE，五分钟后恢复可绑 ⇒ flapping 的镜像态，来源不可见。
- 本机无任何遗留 node 进程（`ps -eo cmd | grep node` 为空），排除"我自己的探针泄漏"。

## 判定

`EXTERNAL_BIND` 对这些端口是**正确答案**：本盒就是绑不上，World 真起在那里也会当场死。
需要修的是 leg 的**前置假设**（"带内每个端口都归我"），不是第二道闸，也不是探针。

## 处置（写进 `tests/world-factory/world-factory.test.mjs` leg 注释）

`port bands: host leasing falls through …` leg 的两处"占满整段"循环改为：
遇 `EXTERNAL_BIND` 记为 foreign（已占用）而非让 leg 崩，并断言
`mine.length + foreign.length === 段长`（低段 19 / 上段 50），同时 `t.diagnostic` 打印 foreign 端口。
**leg Own 的两条律一字未动**：(1) 3181-3199 全占后落点必须落在 13000-13049；
(2) 两段全占后 `acquireFirstFreeLease` 必须 fail closed（`LEASE_HELD` 或 `EXTERNAL_BIND`）。
在干净机器上 foreign 为空数组 ⇒ 行为与原 leg 完全相同。

## 给协调者的 boot 提示

- `acquireFirstFreeLease` 本来就会跨过 EXTERNAL_BIND 端口，boot 不受影响；
  但 MOCK 段低段 3496-3500 若再次 flapping，bw3 的 mock 端口会落到 13050+。
- HOST 段上段 13030-13032 目前不可用；host 端口选择跨过它们即可。
- 若要根治需 Windows 侧排查（`netsh interface ipv4 show excludedportrange protocol=tcp`），
  超出本 lane 权限（不得动 :3080 所在宿主树/真实 `~/.dsh`）。
