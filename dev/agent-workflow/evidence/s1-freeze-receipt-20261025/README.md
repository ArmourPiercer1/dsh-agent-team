# S1 封存收据（20261025）— 非签发

**目的**：不依赖损坏的 SESSION_ROUTER_LOG，也能凭 `manifest.json` 中"路径 + 实测 sha256 + bytes"定位 PR363/S1 全部存活原件。本件**不签发 G1**（G1-I/G1-F 仍未过），非权威源。

**轮次**：起 2026-10-25T00:36:10.293Z，止 2026-10-25T00:38:18.859Z（≤10 分钟界内）。模式：只读定点核 + 本目录两新文件；0 Host / 0 cleanup / 0 paid / 0 子代理 / 0 广扫；无提权、无覆盖。权限快照：workspace-write / approval=ask。skills 已核（catalog 无适用项）。

**封存面**（详见 manifest.json，全部本轮实测）：
- 三锚：origin/master `4aaaa7b2…`；PR363 计划 commit `1310b959…`（三计划原件 = git tree blob，工作树无 memo 目录）；HTU HEAD `639ed015…` = tag `dsh-v0.2.0-rc.2`。
- M0 v3 种子副本保全：63 文件聚合 `81102fae…` 匹配、93 records、MANIFEST sha 匹配。
- gittrees-1.txt 48 树事实底表 `469000d2…`（47 树行 + 主仓行）；47 树全表 NOT_LOCAL（外部 Library libfile_fb4f94ab…，33439B，本地不存，不编表）。
- Q6/Q7 preserve 回执、0a3/d703 两 final lock 与历史 before 原件 SHA 匹配、package.json 仍候选。
- H0：M1 两 run（首 FAIL / noext PASS）、M2 FAIL 不变、M3 机制 PASS（身份绑定/生命周期/完整 H0 未证）；M1 v5 脚本实体未寻得（具名 UNKNOWN）。
- 日志事故现态：router 1623412B/5135 行 mtime 00:21:05Z，只读记录、非权威、不恢复不 fsck。

**ERRATA 与边界**见 manifest.json `errata` / `write_boundary` / `budget` 字段；未知项保持 UNKNOWN 具名，不扩范围。
