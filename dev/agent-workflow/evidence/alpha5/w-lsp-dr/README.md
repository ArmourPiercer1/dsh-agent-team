# W-LSP-DR — 拟裁语义「策略变化→销毁重建 member-isolated 实例」的装配纪律可行性验证

writer = W-LSP-DR（qwen3.8-flash-next；liveness 首报模型行原文：`You are a coding agent powered by the qwen3.8-flash-next model.`）
基 = `origin/master @ 148c3f49be8cf83e4930e58460790f0144ad6955`（fetch 亲验）；一次性 worktree `.worktrees/alpha5-lsp-dr`，branch `alpha5-lsp-dr`；端口 **3183**（开跑前 node bind+release 亲证空闲，runner 内再门一次）；世界 `tests/homes/a5lspdr-<stamp>`（teardown 已删，本文件 §6 留痕）。

## 0. 性质标注（先读，不升格）

- 本轮 = **拟裁语义的装配纪律可行性验证（装配层）**。用户裁决尚未答复（根 05:34Z 冻结面：SpawnReceipt / 新 streaming 启动方法 = 冻结待答，本轮**零生产接口新增或修改**；语义出处 = `alpha5-lsp-rulings` 分支 c73e9af4 `LSP-rulings-brief.md` R-2 + COORDINATION 05:3xZ 行）。
- 验证对象 = 拟议口径「member 策略标签变化 → 销毁并重建其 member-isolated 实例（realm）」在**现有公开面**上的装配等价性：`agent.ctx.isolate` + `realm.plugin(公开 barrel)` + fiber `dispose()`（W-PTC-RE 已 LIVE 在册的同一组面）。
- **这不是 OS 强制、不是接口承诺**：「一 realm 一 (member×策略代际)」是 Team 侧装配纪律（执行面 = 装配约定 + probe 复跑）；公开面仍无策略输入、池键仍是纯路径（`pr6/SEAM-VERDICTS.md` B1/B4 原状，同 realm 内两策略标签共享 pid 的 HAZARD 形状不因本轮而消解；严禁把共享池改名复用冒充策略隔离——SV:60 原文继续有效）。**若用户答复后的语义不同，本证据只作参照。**

## 1. 真跑结论（权威绿跑 = `runs/2026-10-17T05-41-03Z/`，20/20 criteria，runner EXIT=0）

两判据（任务书要求回报的两判据）：

- **判据①（单轮变化全链）**：策略标签 g0→g1 变化的**一步**（row 的 `/policy-change`：dispose 旧 realm 全部 fibers → 新建 isolate realm 挂公开 barrel）满足全部四点——旧 realm 的 OS pid **135 消失**（pidAlive 探针，dispose 11ms 有界）、新 realm 首查即 **新 pid 279 / opens=1 / `/proc/279/cwd`==新 workspaceRoot**、**兄弟实例不受扰**（B pid 194 恒定且热复用 opens 1→2）、**旧 workspaceRoot 热句柄零残留**（runner 进程独立 /proc 全表扫描 cwd+fd：变化前基线 1 个句柄=旧服务器 cwd，dispose 后 **0**；原文 `proc-scan-g0-baseline-wsa-g0.json` / `proc-scan-c1-after-dispose-wsa-g0.json`）。事件台账原文 = `journal.raw.txt`（`policy-change-begin → realm-disposed{gen:g0,lastPid:135,disposeMs:11} → realm-assembled{gen:g1} → policy-change-complete`）。
- **判据②（连续两轮 = 四次生命周期全净）**：g1→g2 同型复现（dispose g1 lastPid 279 / 15ms、旧根零句柄、新 pid 364/opens=1、B 仍 194）；台账合计 **dispose,create,dispose,create 四次转换全在位**（`assembled=[g0,b0,g1,g2]`、`disposed=[{g0,135},{g1,279}]`、policy-change=2）；泄漏净零 = fixture **pid 台账**（`pid-ledger.raw.txt`：boot 4 / exit 4，全部 code=0 优雅退出，booted=[135,194,279,364] 全灭）+ 终态 dispose 后**四个 workspaceRoot 全零句柄**（`proc-scan-final-all-roots.json`）+ host **无僵尸子进程** + host fd 采样 **37→40→41→35**（raw 原文 `leak-samples.jsonl`，收口值低于基线）。

全部 20 判据 = `runs/2026-10-17T05-41-03Z/criteria.json`（含 P-PIN / P-STABLE-UNTOUCHED / P-PRISTINE 红线判据）。

## 2. 方法（只用现有公开面；零生产行装载）

- 装载 = 公开 profile-patch seam（`$DSH_HOME/profiles/web/cordis.patch.yml` 挂 `a5lspdr-row.mjs`），世界零生产行。
- member 实例 = `agent.ctx.isolate('lsp')` realm + `realm.plugin(Lsp / LspStdio / ToolLsp)`（host 自家 built barrels 的 file-URL 公开 import，零 vendored 拷贝、零 patch）+ 捕获插件（`inject:['lsp']`）取 realm 的 `lsp` service。
- 策略标签 = **Team 侧装配状态**（字符串 gen + 其映射的 workspaceRoot 代际目录 `ws/wsa-g{0,1,2}`；每代际根即「策略变化后可观察的资源边界」）。
- 观察面 = 三重独立：①模型真路由 `lsp` 工具（session cwd=代际根；公开 around-seam `tools/execute` 捕获）；②fixture 自报（pid/gen/opens/cwd + 出生/死亡 pid 台账）；③runner 进程 OS 观察（pidAlive、/proc cwd/fd 全表句柄扫描、host fd/子进程/zombie 采样）。
- dispose = 公开 fiber `dispose()`（realm 全部 fibers 逆序 await；底层 = host `LspInstance.tearDown`：shutdown/exit → SIGTERM→SIGKILL → await close）。

## 3. 三轮记录（不粉饰）

| 轮 | 目录/日志 | 结果 | 说明 |
| --- | --- | --- | --- |
| 1 | `runs/2026-10-17T05-40-19Z/` + `runs/runner-attempt1.log` | 无裁决（kit 缺陷） | runner 自身 TypeError（scan 结果取形状错），崩前 10 判据全过；保留不抹 |
| 2 | `runs/2026-10-17T05-40-41Z/` + `runs/runner-attempt2.log` | 19/20 | 唯一 FAIL=**kit 判据算术错**（`realm-assembled` 期望 3，实际世界合法装配 4：A-g0+B-b0+A-g1+A-g2）；其 observed 数值已完整呈现目标序列；保留不抹 |
| 3 | `runs/2026-10-17T05-41-03Z/` + `runs/runner-attempt3-green.log` | **GREEN 20/20，EXIT=0** | 修正后的判据=「四次转换=dispose(g0)+assemble(g1)+dispose(g1)+assemble(g2)，post-change assembled 恰为 [g1,g2]」；此为权威轮 |

## 4. 披露（口径不升格）

- **fixture 口径**：LSP 服务器 = 虚构可全审 stdio fixture（自报 pid/opens/cwd + pid 台账）；被测的池/spawn/dispose/工具路由 = pinned host（0.2.0-rc.2 @639ed01539，porcelain 前后=0、HEAD 未动）真实生产代码，同 W-PTC-RE / PR6 先例。
- 「零热句柄」= 本 fixture 形状下经 /proc 观察的 cwd+fd 句柄归零；它是**装配纪律的 OS 侧观察证据**，不构成对任意真实语言服务器（可能持有其他资源：socket、shm、外部连接）的零残留宣称。
- 「策略变化→销毁重建」在此演示的形状 = 策略代际映射到新 workspaceRoot + 新 session（公开 `session.create{cwd}`）+ 新 realm；**旧 session 对象本身不销毁**（其 realm 已 dispose；session 生命周期归 host，超出本语义面）。
- 旧 realm 的 dispose 计时（11/15ms）是有界 await 完成时刻，OS pid 消失经独立 pidAlive 轮询另行确证（两证据分列，不互相冒充）。
- 本轮**未**验证/不宣称：同 realm 内策略粒度逐出（真缺=上游 SEAM-GAP，`w-ptc-re/probe-gap-lsp-policy.result.json` gap1）、C-PROC streaming-pipe 臂（R-1 待裁）、SpawnReceipt/新 streaming 方法（冻结面零触碰）。任何主张行须标粒度并同引 `LSP-rulings-brief.md`（R-2 §3 许可表述：「realm 粒度隔离为实，policy 粒度逐出未宣称」）。

## 5. 红线自证

CORE PATCH BUDGET=0；test-use 树只读（P-PIN/P-PRISTINE 判据：porcelain 空 + HEAD=pin 前后一致）；`:3080` 稳定实例只读探针 pre=401/post=401 一致（P-STABLE-UNTOUCHED）；端口仅 3183（bind 亲证空闲）；世界零生产行、teardown 已删（`tests/homes/` 无 `a5lspdr-*` 残留）；证据无 token（boot-token/cookie 全程 REDACTED，`grep` 扫描=0 命中）；`:3180` 未触碰；零 force-push；1 task=1 branch=1 worktree=1 writer。

## 6. 文件清单

| 文件 | 角色 |
| --- | --- |
| `a5lspdr-row.mjs` | 装配行：isolate/realm.plugin 挂 host 自家 barrels；`/policy-change` 一步 = dispose 旧 realm → 重建新 realm（事件台账）；hover/dispose/state 证据路由 |
| `fake-lang-server-a5lspdr.mjs` | 虚构可审 stdio fixture（审计行 + pid 出生/死亡台账） |
| `run-a5lspdr-live.mjs` | LIVE runner（端口 3183；预检+20 判据+/proc 观察+收口；EXIT 0/2/1） |
| `runs/2026-10-17T05-41-03Z/` | **权威绿跑**：criteria(20/20) + journal.raw.txt + pid-ledger.raw.txt + leak-samples.jsonl + proc-scan×4 + facts.json + instance.log + prompt×4（redacted） |
| `runs/2026-10-17T05-40-19Z/` · `runs/2026-10-17T05-40-41Z/` | 修复迭代轮（如实保留，理由见 §3） |
| `runs/runner-attempt{1,2}.log` · `runs/runner-attempt3-green.log` | runner stdout 原文（含每判据 PASS/FAIL 行） |

复跑：`node dev/agent-workflow/evidence/alpha5/w-lsp-dr/run-a5lspdr-live.mjs`（可 `--port`/`--keep`；需 sibling worktree `dsh-020rc2-upgrade` 的 test-use 检出在场）。
