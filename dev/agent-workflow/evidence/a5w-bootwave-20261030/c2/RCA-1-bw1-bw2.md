# RCA-1（dated 2026-10-30T21:54Z，真实 UTC）— bw1/bw2 同类失败 ×2 → 停线，本文件为停线后 RCA

## 结论
非产品缺陷、非外部监听者、**真实启动消耗 0**（host-starts.jsonl 两行皆无，thisRunCount=0；失败发生在 spawn 前的端口租约预检）。
根因 = 测试基建探针误判：tests/characterization/lib/util.mjs:142 把 **1500ms 连接超时记为 in-use**；
本盒（WSL mirrored 网络，对已关闭 loopback 端口的 SYN 黑洞而非 RST）导致所有 connect 探针超时 →
mock 带 3491..13099 全部误判占用 → 迭代到带尾 13099 抛 EXTERNAL_BIND（措辞"answers TCP"与事实不符：无人应答，是无人应答才超时）。

## 三方探针交叉证据（本机 21:47-21:55Z 实录）
1. ss -tln / /proc/net/tcp 状态 0A 普查：mock 带监听者 = 0（仅 21:51 两次瞬时 3491/3492 幻影条目，无属主 pid，mirrored 网络 Windows 侧状态镜像，与失败时刻不相干）。
2. node 复刻 portInUse（1.5s 超时）：3491/3492/3493/13050/13098/13099 全部"busy"（=超时假阳性）。
3. python connect（0.7s）：同一时刻同带 16 端口 accept 数 = 0；:3080（真监听）connect 正常 401。
   1 与 3 互证无监听者；2 与 3 差异唯一变量=超时→in-use 分类。dry-run 当时"3491 free"= bind 式探针，与 connect 式不冲突。

## 处置
- bw1/bw2 记 ENV 类阻塞（不烧 boot 预算；池仍 C2=4/8）。
- 修复走独立工程基线 lane（探针超时分类 + 负控：真监听仍须判占用；租约竞态测试回归）；修复合入后以 bw3（预登记 ENV 备用格）重试。
- 同类 ×2 停线律已执行：bw2 后未再盲跑，RCA 完成才动 bw3。
