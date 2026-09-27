# §17 验收标准 — 最终验收（16/16）— restart-recovery 0.1.7-rc.1

- **日期**: 2026-09-26（Commit 5 验收轮）
- **构建**: 分支 `task/team-restart-017rc1` tip = `2a3df15`（Commit 4 证据入库）；产品代码 = `61419de` + fix `f3d5a71b`（runOwned AWAITED-lifetime）
- **宿主基线**: test-use = `46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1 官方发布点），本轮验收时点复测 pristine（porcelain 0）
- **验证纪律**: 全部数据为主代理独立复跑/独立解析（kit 世界断言 = 子代理执行、主代理复核关键 JSON 与日志；root suite = 主代理直跑 3 次）

## 16 条逐条验收

| # | 标准（guide §17 原文） | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | `DSH_HOME` 未设置时仍可恢复 | **PASS** | `sessionPersistence.exists` 公共 seam（`stat !== undefined`，服务缺失 → `TEAM_PLUGIN_SERVICE_MISSING` fail-closed，非物理路径探测）：unit = team-session-durability D1–D4 + d2-s6-ensure-root-live R1–R8（最终套件全绿）；live = kit 每 world fresh DSH_HOME 全流程（World A–E）。legacy 物理 probe（`$DSH_HOME/sessions` readdir/文件名）已于 Commit 2 删除并静态钉死（G 套件 call-site pin） |
| 2 | product code 零 session persistence 文件名扫描 | **PASS** | 主代理独立 grep 产品 src（packages/*/src，排除 dist/测试）：upstream 0.1.7 会话持久化文件名形态（`…-session.v4.jsonl.zstd` / `session.lock` / `v4.jsonl`）**零命中**。唯一近邻命中 = `packages/legacy/session-reader`（经 `plugin/legacy-surface.ts` 类型面）的 `logArtifact: 'session.jsonl' \| 'session.jsonl.zstd'` —— legacy 证据读取器读取**自有 legacy 工件**的契约类型联合，非 upstream 持久化文件名、非 durable/ownership 判据（guide §18 禁止的是"以物理文件名当 authority"，此处无此用途）。readdir 命中仅 team-skills/blueprint-source-index 对**插件自有目录**的扫描。p4t6 拒绝清单扫描（pin 本轮勘误 754→755，见 #15 注记）最终套件 10/10 绿 |
| 3 | dynamic Team root 跨 backend restart 可恢复 | **PASS** | World A（run 4，38P/0F）：boot-1 动态 root 创建+对话 → host 重启 → boot-2 `session.follow`（ordinary 面）→ fence 精确措辞 veto（api-session/error lane 抛出）→ exact-generation rollback → UI/wire takeover `ensureRootLive` ok:true live:true → leader 恢复 live、history 23→34 完整、首请求 Team model selection |
| 4 | dynamic Team member 跨 backend restart 可恢复 | **PASS** | World B（run 10，30P/0F）：member child 冷 resume 七项断言（worker role / owning root / member persona 无 leader 面 / base tools / 13 team_* 闭集 / 单 writer / 干净投递） |
| 5 | browser `session.follow` 不能抢走 Team ownership | **PASS** | World A A4/A4b/A4c（veto + 精确措辞 + exact-generation 回滚，无 silent adopt）+ A7q1（veto 窗口内 foreign agent 模型请求 = 0）+ World D（re-takeover typed fail-closed `TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM`）；unit = fence A2/A5/A9 |
| 6 | Team Agent 最终由 Team glue 持有真实 `AgentHandle` | **PASS** | World A A7(3)（恰 1 个 live Agent）+ A7(6)（resumed leader 挂全 13 team_*）+ A7(8)（team_list_members 真实执行，非仅挂载）+ gate-5 应答落在 leader 面（13 team_* + row staticModel）；unit = G 套件（glue 持 handle、一重试恢复、close 门） |
| 7 | ordinary non-Team Session 行为完全 unchanged | **PASS** | World C（7/7）：非 Team 普通会话创建/重启/follow 全链 upstream-equivalent（最重要的非回归世界，kit bug 全程未触碰其流程） |
| 8 | explicit ordinary mode 若保留，可真正继续 ordinary 对话 | **PASS** | World D（run 9，30P/0F）：v5 `team.prepareOrdinaryOpen`（typed 拒绝面 fail-closed，permit 一次消费）→ native `openSession` + 'ordinary' mark → ordinary prompt 成功应答；Team ensure 调用数 = 0；restart 后 ordinary owner 消失、Team 可再 takeover |
| 9 | writer-held race 压测无 unresolved collision | **PASS** | World E（20× race）：followOk 20/20 · ensureOk(HTTP200+ok:true) 20/20 · teamLive 20/20 · singleWriter 20/20 · created=20 · **disposed=0**（主代理独立解析 race-iterations.json 复核同数；delayMicro 分布 0×4/1×4/2×7/3×5） |
| 10 | Team tools / persona / model / MCP / permissions 首请求即完整 | **PASS** | World A A7(6)/(7)/(10)/(12) + A7q1（13 team_* / 动态 Team persona 在 system block / 首请求 row staticModel / 无 MCP double mount / 无重复 model-selection listener 副作用）+ World B B9(3)/(4)/(5)（member 面 persona/tools/闭集） |
| 11 | `close()` / archive / dropResidency 生命周期仍正确 | **PASS** | 既有 lifecycle 套件在最终 root 套件中全绿（失败集 = 债务，零 lifecycle 文件）：fence A8（close 后 runOwned reject + 全部 waiter settle + 无悬挂 promise）、G 套件（close 门/回滚屏障/dropResidency 路径）、runtime p8s lifecycle 测试族 |
| 12 | zero-core scan PASS | **PASS** | `node scripts/verify-zero-core.mjs --host <test-use>` 本轮复跑：**PASS exit 0，0 findings**（仅 upstream 自有的第三方依赖 patch = INFO 排除项，非 Team 改写） |
| 13 | upstream test-use checkout pristine | **PASS** | 验收时点复测：HEAD = `46a7f68b0922371ce7144b668b90e377d8e799f4`，`git status --porcelain` = 空（本轮全部 kit 运行 S0 preflight 亦逐 run 钉死） |
| 14 | typecheck/build/build:composition/check:artifacts 全绿 | **PASS** | 本轮 battery（final-battery.log）：typecheck exit 0 / build exit 0 / build:composition exit 0 / check-artifacts-committed **OK: 1180 files**（committed install-surface = fresh build 逐字节一致） |
| 15 | root suite 新失败集合为空 | **PASS** | 主代理直跑 3 次（root-full-suite*.log）：run 3（静载）= **10 files / 20 tests failed = 债务基线逐文件逐数相同**（3897 passed of 3917），新失败集合 = ∅。两处瞬态观察均已归因留痕：(a) p4t6 pin 漂移 754→755 = Commit 3 新增 `packages/remote/test/c1-remote-v5.test.ts` 的簿记增量（pin 设定于 Commit 2 之前该文件不存在；扫描器本体健康、denylist 命中集不变 = 15；已按单写者规程勘误 pin 并留 ledger 注释）；(b) `p6t1-parallel` 负载 flake（run 2 失败、静载 7/8 + 12/12 序列复跑通过）= **与分支全部产品改动隔离**（该测试 import 图仅含 activation provider + storage repos + testkit fakes；本分支 21 个产品文件全部位于 plugin/UI/remote 层，fence 与 agent-bindings 均不在其 import 图内）→ 判定既有负载敏感 flake，非本轮新增，登记 follow-up F-rc2 |
| 16 | 0.1.7 real-host restart kit deterministic green | **PASS** | Worlds A–E + 20× race 全绿（f3d5a71 构建；worlds-verdict.md 重发版：A wire 38P/0F · A browser 金标准 22P/0F · B 30P/0F · C 7/7 · D 30P/0F · E 20/20）；:3080 全程 UNCHANGED（每 run post-probe 401，pre==post）；端口自清理；首跑 BLOCKED（产品缺陷）完整保留为记录并在 fix `f3d5a71b` 后重跑转绿 —— 该缺陷本身即 kit 价值的证明（unit CI 漏掉的实宿主语义缺陷被世界断言抓住） |

## 附加验收面（红线守纪）

- **CORE PATCH BUDGET = 0**：upstream 零修改（#12/#13 双证）；全部能力 = 外部插件 + 公开 seam。
- **零吞错**：veto 措辞走用户可见 lane（抛出非 console）；ordinary 拒绝 typed fail-closed；无任何 client 吞错（run 6 的 driver 误落空会话被 check-5 leader 面守卫正确拦截 = 无假 PASS 可能）。
- **:3080 / :3180（GUI）零触碰**：本轮所有探测只读（401-reachable，验收时点复测 401）。
- **home 账目**：`tests/homes/` 现存 32 个 rst017* 世界 = 15 个 Phase-0 spike（保留）+ 15 个 rst017-c4-*（Commit 4，按 kit 策略全部保留：A 无条件保留、失败 run 作证据保留）+ 孤儿 `rst017-spike-2026-09-25T16-26-55`（用户裁决未动）+ 早期 rs-/u8-/mpr- 注册世界；scratch `rst017-bisect-2026-09-26T04-50-21`（278M）按 TEST_METHODS §7 于本轮删除留档（5 处引用均为保留日志中的路径字符串，无内容依赖）。
- **git 纪律**：1 task = 1 branch = 1 worktree = 1 writer（轮间交替写，串行不并发）；提交链 = `9cf57a0`（Commit 1 表征）→ `e951344`（Commit 2 C1 core）→ `61419de`（Commit 3 ordinary permit + client）→ `f3d5a71b`（fix runOwned）→ `2a3df15`（Commit 4 实宿主证据）→ 本提交（Commit 5 验收 + 簿记）。

## Follow-ups（非阻塞，登记）

- **F-rc1**：same-session takeover 后 veto 页 composer 粘性态不自动 reconcile（0.1.7 client selection 模型：同 session 重开 = no-op；无 reload 经合法 in-app 导航即恢复、零 stranded、零吞错 —— 已实测闭合裁决条件三要素）。自动 reconcile 需 client-mount 扩展或 upstream 变更，超出本轮红线；guide §10/§17 未要求。候选后续轮次。
- **F-rc2**：`p6t1-parallel` 负载敏感 flake（既有、与本轮改动隔离，见 #15(b)）。建议后续单独轮次做负载复现 + activation 并行路径稳定性调查。

**终裁决：16/16 PASS —— 本轮可交付（push + PR）。**
