# 执行台账（用户规则 7：commit/环境/命令/退出码/日志/耗时/判定/条款映射）

环境（全程恒定）：Linux 6.8.0-142-generic x86；node v22；worktree `exp/alpha5-poc-20261016` @PR249 head `d3c9760d…`；pinned host 克隆 `tests/deepseek-harness-test-use` @`639ed01539…`（install 226s + `pnpm run build` 153s，porcelain 全程 0）；模型全 qwen3.8-flash-next。
统一复跑：`bash run-all.sh`（fixture 腿）；`RUN_P04=1` 含 OS 探针；`bash 07-integration/p06-host-smoke.sh`（宿主腿）。

| 项 | 命令 | 退出码 | 耗时 | 判定 | 条款 | commit |
| --- | --- | --- | --- | --- | --- | --- |
| host install+build | pnpm install; pnpm run build | 0/0 | 226s+153s | OK（前置） | TEST_METHODS §2 | 树 gitignored |
| E1 源码锚定 | 子代理 dc3421e3（read/grep 清单见 source-map.md） | 0 | ~6m | 12/12 CONFIRMED | §0.1 | 74151aad |
| P0-0 | node 00-baseline/p00-runner.mjs | 0 | <1s | PASS 5/5 | §P0-0 | 74151aad+aaf327a8 |
| P0-1 | node 01-routing/p01-runner.mjs | 0 | 1s | PASS 12/12（含危险序反例） | §P0-1,BND-01..06 | 74151aad |
| P0-4 OS 探针 | bash 04-process/env-capability-probe.sh | 0（判定腿 ENV_BLOCK×4） | ~40s | ENV_BLOCK | §P0-4 前置 | 5406a21e |
| P0-6 s1 冷启动 | TEST_METHODS §2 链 :3181 | boot OK, 401/303 | ~12s | PASS | §P0-6 公共前置 | d523a7d4 |
| P0-6 s2a seam 插件 | 同上 :3182 + patch 行 | 0 | ~14s | PASS（registered:true） | §P0-6 装配面 | 7559b652 |
| smoke 脚本化 | bash 07-integration/p06-host-smoke.sh :3183 | 0 SMOKE_OK | ~13s | PASS（复跑证明） | §6.1 可复跑 | c46ffb76 |
| run-all 入口 | bash run-all.sh | 0 | ~2s | PASS | 同上 | c46ffb76 |
| P0-2 | 代理 937ef64e → node 02-search/p02-search-runner.mjs | 首轮1(3实缺)→二轮0→三轮幂等0 | ~8m | INCONCLUSIVE(fixture-supports-R3)；R2=prereq-missing；SRCH-04 NOT_RUN | §P0-2 | df5b27df |
| P0-3 | 代理 3aac5394 → node 03-fs/p03-fs-runner.mjs（内含每腿 strace 孵化重跑） | 首轮1(3腿fixture缺陷)→后两轮幂等0 | ~15m | 11/11 PASS；族 INCONCLUSIVE（方向支持进程内 Controlled FS；前置=INV-1 全覆盖+宿主复核） | §P0-3 | 25cfa3c1 |
| P0-5 | 代理 f5f944b8 → node 05-ptc/p05-runner.mjs; timeout 120 node 06-lsp/p05-runner.mjs | 0/0（各含幂等重跑 0） | ~12m | PTC 8 腿（7 绿+1 NOT_RUN）→族 BOUNDED-DEFER；LSP **11 腿**（P05-LSP-0..10；含 HAZARD×2/UNCONFINED-READ/CORE 素材）→族 INCONCLUSIVE+Profile 兜底 | §P0-5 | eaec6c55 |
| P0-6 s2b Team world | （未执行：c1 kit 全链=profiles 行+蓝图 world+mock model+会话驱动） | — | — | BOUNDED-DEFER（缺项=c1 链组合，机制两段已分别实证） | §P0-6 | 记录于 p06-stage1-note.md |
| P0-7 独立复核 | 代理 81a39aec 复跑 p00/p01/probe/smoke@:3184 等（HEAD c46ffb76） | 其复跑全 0 | ~18m | **R1 PASS（复核面；PASS≠P0 关闭）**；F1/F2/F3 已处置 | §6.2 | 08-review/p07-review-R1.md |
| P0-7 R2 delta 复核 | 代理 de223951：4 runner×2+run-all×2+独立 strace 负/正控+3 例 rg argv 重放（HEAD afc5e039→9e422ff5） | 其复跑全 0 | ~8m | **R2 PASS（delta 面，13/13 VERIFIED 零 REFUTED）**；FS-03 与 read-before-write 升格 fixture 级 VERIFIED；缺 Sandbox fail-closed 行为级维持 NOT_VERIFIED；N2（10→11 腿）已修、N3（fiber 引文 147-156→精确 140-146）记录于此 | §6.2 | 08-review/p07-review-R2.md |
| 续-1 SRCH-04 spill | 代理 5a44532d → node 02-search/spill-runner.mjs | 0（幂等复跑 0） | ~9m | **PASS 4/4**：生产 grep+spill handler+LocalSpillStore+真 rg；S-09 对象身份弃权行为级复现（Δ0+footer；他 scope Δ1；dispose 恢复）| §P0-2 SRCH-04 | 2b61441a |
| 续-2 PTC-08 外层 | 同上 → node 05-ptc/ptc-outer-runner.mjs | 0（幂等 0） | 同 | **PASS 5/5**：dsh-ptc-runtime-node EXISTS-PUBLIC；外层真实 pid45/内层真实 pid59；guard 拒内层原体=0，durable isError；同管线 exec.parent=true。前轮 NOT_RUN→PASS | §P0-5 | 2b61441a |
| 续-3 P0-4 修正诊断 | 代理 3f019dcc → 04-process/landlock-diag.sh | 0（ENFORCE-WORKS） | ~10m | **landlock=ENFORCE-WORKS**（前轮 ENV_BLOCK 系探针 handled_access 常量 bug，逐字复现假 ABSENT+正确正负控+继承腿+denyall 鉴别器，ext4/tmpfs 双 fs）；嵌套按实测层表述（uid_map EPERM 与 unshare() EPERM 两拦截点；aa profiles 不可读不外推）；bwrap/netns/uid-map 维持 ENV_BLOCK | §P0-4 | da67ed8e |
| 影响面留痕 | `rm -rf dev/tests/`（21:42 一次 smoke 脚本路径缺陷遗留的世界目录 a5p0-smoke-20261015T214220Z，gitignored，非测试证据） | 0 | <1s | 已删（TEST_METHODS §7 留痕） | §7 | 本行 |

web/jobs/MCP 族 = NOT RUN（本会话无网络授权，非阻塞项：§5 允许登记后补）。
| 续-4 web/jobs/MCP 回环/mock | 代理 e2630132 → 09-web-jobs-mcp/run-all.sh（web/jobs/mcp 三 runner） | 0（幂等×2） | ~13m | web=INCONCLUSIVE(方向支持组合 Adapter；30 断言中 10：拒绝在 fetch 前、零 socket/零 DNS、tripwire 0、重定向/超限/超时闭环、卸载零泄漏)；jobs=INCONCLUSIVE(生产 service 直调闭环 12/12；族形态钉死：无 job-start 工具面，owner-scoped 腿 NOT_RUN)；MCP=INCONCLUSIVE(mcp-client 注入路径与 P0-1 一致 8/8，真 OS 子进程+代际回收)；raw-SDK 腿 BLOCKED-SKIPPED 留痕 | §P0-2/§P0-5 同型 | 本轮提交 |
