# F3B 监视腿证据索引（v1/v2/v3 三跑 + 边界文件逐项归因）

面：`a5-abort-cause@a1bf18fa`（修复面，commit-pin 安装）。全部三跑同一 kit 骨架，仅监视器判据演进（v1→v3），世界/链/取消臂完全同形。
基准时钟 = `cancel-leg.json.FiredAt`（cancel RPC 发出 tick；watcher 自身 firedAtRef 与其同语句邻接，同步余量 ≤10ms，全表同一时钟域）。

---

## ① v1 / v2 = FAIL 原文（如实保留，不判绿）

**v1**（run `2026-10-18T22-46-29Z`，kit-b1.out）——判据：全 workspace 窗口零新文件（除 exit.json）：

> `FAIL F3b — cond-3b out-of-band seed watch: cancelled payload froze within +2s of FiredAt AND created nothing new across the 25s window [lastMtimeDeltaMs=-951 samples=78 new=["/workspace/governed/plans/plan-mvef234o-u5pjqn.json","/workspace/governed/probe-mvef230g-hffb2c/badhandled/allowed/ok…`

**v2**（run `2026-10-18T22-55-03Z`，kit-b2.out）——判据：限域「被取消腿子树」：

> `FAIL F3b — cond-3b out-of-band scoped seed watch (realm law): cancelled leg subtree frozen (seed+all files mtime<=FiredAt+2s) AND zero new files in-subtree across 25s [seedΔ=-939ms subΔ=5317ms samples=83 new=["/plans/plan-mvefd38u-xh177p.json","/probe-mvefd34j-t2jagg/badhandled/allowed/ok.txt","…`

两跑共同事实：**种子（被杀 payload 的指定写通道）在取消前即冻结（-951 / -939ms），取消后 25s 零增长**。FAIL 的来源是**监视归因口径缺陷**：v1 全 workspace 扫、v2 限「子树」——现场推翻 v2 前提：**同实例各腿共享同一 realm 写域（payload cwd=`workspace/governed`，盘上不存在单腿子树）**，于是取消后 ~+5s 启动的**另一条腿**（kit 直控腿，见③）的 launcher 探针/plan 文件被误计为「新文件」。修正过程披露：`TRIAGE.md` K10/K11。

## ② v3 三则合取判据（定稿，run `2026-10-18T23-05-55Z` = PASS）

归因前提（现场法律，v1/v2 实测所得）：沙箱写域=realm 根、各腿共享 ⇒ 路径限域不可归因，改按**通道+时刻+种类**三则：

| 则 | 定义 | 实测 |
|---|---|---|
| (a) 种子冻结 | 被杀 payload 指定通道 `a5c1fixb-seed.log`（1Hz append）mtime ≤ FiredAt+2s | **-955ms**，83 采样零增长 |
| (b) 既存零触碰 | 监视起点在场全部文件（15 个，exit.json 监督簿除外）此后任何 mtime > FiredAt+2s = violation | **preViolators=[]** |
| (c) 新文件归因 | 新文件仅允许「后续腿边界种类」= `probe-*`（launcher 逐 exec access 探针）与 `plans/plan-*.json`（宿主逐请求 plan 簿）；**任何其他新文件=violation**；且 (b) 已封「改既存」型续写 | **newNonBoundary=[]**，boundarySeen=12 |

**规则(c)限定**：`probe-`/`plans/plan-` 类别豁免**仅由本跑逐项归因表（③节，12 项各自五重依据）支撑**，**不构成「任意同名新文件均安全」的一般化规则**——其它世界/其它跑使用规则(c)必须自带逐项归因，不得引用本表豁免同名文件。

kit 判词行（kit-b3.out verbatim）：
> `PASS F3b — cond-3b out-of-band attributed seed watch v3: seed frozen <=+2s AND pre-existing files never touched after +2s AND zero new files other than next-leg boundary kinds (probe-/plan-) [seedΔ=-955ms preViol=[] newNonBoundary=[] samples=83]`

## ③ 12 项边界文件逐项归因（根逐项核用；判定依据与结论分离列）

数据独立于监视器：`scratch-capture2.tgz`（teardown 快照，tar 保 mtime；复现：`tar xzf runs/2026-10-18T23-05-55Z/scratch-capture2.tgz` 后 stat）。同跑时间线源：`instance.log`（probe enter/witness pid）、`scratch-forensics-mit.json`（exit.json 内容+pid+rc）、`direct-control.json`（kit 直控腿结果）。

**时间线锚（Δ=FiredAt 差）**：bash-1(true) enter -4257ms｜bash-2(seed, pid215) enter -3994ms｜cancel 0ms（bash-2 rc=-15 @+7.2ms，forensics）｜**直控腿 leader-bash-1(pid254) dispatch ≈+4974ms**（其 plan/probe 同毫秒簇）｜RESUME 后 bash-3(kill-9) enter **+35035ms**（窗口外）｜MIT 腿 ≈+38s（窗口外）。

| # | 路径（`/workspace/governed/` 下） | Δmtime | 种类规则 | 归属判定 | 判定依据（独立于结论） |
|---|---|---|---|---|---|
| 1-3 | `probe-mvefrcjh-a8xmvg/denyall/{private/secret,other/outside,allowed/ok}.txt` | +4974ms | `probe-*` = landlock launcher 每次 exec 启动时的 access 自检目录（来源=`landlock-prelauncher.py` 逐 exec 行为；结构固定 denyall/badhandled/selective×3） | **直控腿 leader-bash-1（pid 254）** | ①Δ=+4974=直控 dispatch 时刻（≠被杀腿 enter -3994）；②同毫秒簇含 `plans/plan-mvefrcny-sddfjb.json`（#12）；③该 plan 的 `out/plan-mvefrcny-sddfjb/exit.json` 内容 pid=254 rc=-15；④pid254 ↔ witness 行 `team-inst-leader-bash-1`（instance.log）= **leader 实例 ≠ 被杀成员腿 pid215**；⑤该腿由 kit 直控 HTTP 发起（direct-control.json，landing=`bash · cancelled`+`"cancelled":true`，kit 有意取消） |
| 4-6 | `probe-mvefrcjh-a8xmvg/badhandled/{private/secret,other/outside,allowed/ok}.txt` | +4974ms | 同上（badhandled 组） | 同上 | 同上（同一探针目录 #1-5 同簇） |
| 7-11 | `probe-mvefrcjh-a8xmvg/selective/{private/secret,other/outside,allowed/ok,allowed/new}.txt` + `selective/allowed/exec-leg.out` | +4974ms | 同上（selective 组） | 同上 | 同上 |
| 12 | `plans/plan-mvefrcny-sddfjb.json` | +4974ms | `plans/plan-*.json` = 宿主逐 bash 请求 plan 簿 | 同上 | 同上②③④ |
| （13） | `out/plan-mvefrcny-sddfjb/exit.json` | +4974ms | 监督簿（launcher waitpid 落笔） | 同上 | watcher 按名排除（(c) 则明文）；列此完整性。内容 `{pid:254,rc:-15}` = 直控腿被 `{kind:'user'}` 有意终止 |

**pid 维度总账（最强归因）**：被取消 payload=**pid 215**（`out/plan-mvefr5gx-bx0k83/exit.json` = `{pid:215,rc:-15}`，mtime=FiredAt+7.2ms）——**除 pid215 自身 +7.2ms 的 rc=-15 终止记录（其 exit.json）外，窗口内无任何新的 pid215 足迹**（无探针、无 plan、无第二份 exit.json、无既存文件 mtime 变动）；窗口内唯一新 pid 足迹=254=leader 直控腿。bash-3 的 pid257/exit.json（Δmit=-3082≈绝对 +35s）在窗口外。

## ④ 窗口边界如实声明（根原话口径）

**监视=取消后 25s 窗口内的带外实测**（300ms×83 采样）；它证明的是「被取消 payload 在该窗口内无继续副作用」，**不外推为无限期保证**。窗口的覆盖边界如实：窗内**仅覆盖到直控腿 leader-bash-1 的启动**（Δ+4974ms 在窗内）；**RESUME 腿（+35035ms）与 MIT 腿（~+38s）均在窗口之外**——它们的归属依据是**窗口外独立记录**（plan 簇 / exit.json pid 链 / instance.log 时刻），不属本监视的覆盖面。进程级旁证（rc=-15@+7.2ms SIGTERM 完成、1Hz 通道 -955ms 冻结）表明终止在毫秒级发生，但同样只是旁证，不改变窗口声明。

---
v1/v2/v3 kit 源码演进在 `a5c1fix-b-kit.mjs`（git 未跟踪目录内以本索引+TRIAGE 披露）；三跑判定文件=各 `runs/<stamp>/world.json` `seedWatch` 字段 + `kit-b{1,2,3}.out` 账目行。快照复现命令见③表头。
