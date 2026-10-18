# census 同池交互轮 — 2026-10-18 (root order, #322 last gate)

Local reproduction of the CI census shape, at this lane's worktree:
`npx vitest run --reporter=json --outputFile.json=<f> --testTimeout=90000` (root config = the nine roots),
`.tmp-fault` cleared before each capture. Six cores here; the CI runner is smaller.

## 1. What the merge tree actually broke, by mechanism

| red | mechanism | fix |
| --- | --- | --- |
| `a5p4-lane-hygiene` law (4) DORMANT | the walk flags EVERY production file referencing `sandbox-provider` / `createConfinedProcessProvider`. At the merge tree two files offend: `plugin/live/plane-effect-backends.mjs` (glue lane — ALREADY red on the master side at `7ab56dbf`, measurable with `git grep -lE` at that commit) and `plugin/live/glob-backend.mjs` (this lane). | restated as law (4) NAMED MOUNTS: a booked list of files, each pinned to ONE import edge at the public face; an UNNAMED reference is still a red; a named row may not deep-import or grow a second edge. Live set is printed by the leg. |
| `a5w-integration-wiring` "provider factory … wired into no live glue" | the same dormancy law, second copy, walking `runtime/src`. | same named-mount restatement, same two names, public-face-only pin. |
| `a5p5-dormant-audit` "no shipped source outside the lane references a5p5-tools" | my OWN spec `runtime/test/alpha5-glob-backend.test.ts` names `packages/tools/a5p5-tools/src/register.ts` — leg P0 reads that TEXT to pin argv parity. A name, not an edge. | booked in `NAMES_ONLY_LEDGER_EXCEPTIONS` (5th entry) + a new form-pinning leg: exactly one line carries the path shape, it is the pinned `readFileSync(join(REPO, ...))`, and no import/require/from-specifier to the lane exists anywhere in the file. Same mechanism the GLUE-2/GLUE-5 rounds used. |

## 2. `a5lsp2-assembly` REAL legs — measured here, not reproduced

Green standalone, green in both full captures (572 files), and green when run while my
6600-walk storm is mid-flight in a second process. Their observation surfaces are
world-scoped (`sampleLaneProcesses(worldRoot)`: `cwd.startsWith(worldRoot)` or the
`a5lsp2-fixture` cmdline), so this lane's `a5glb-*` worlds and children are NOT visible to
them; pid reuse is ruled out by `pid_max = 4194304` against ~13k pids for the whole leg;
fd pressure is ruled out by direct `/proc/<pid>/fd` sampling during the storm (never above 40).
What is left is CPU: the leg's polls are bounded (`pollUntil(..., 8_000/10_000)`), and this
lane's race is the longest, most spawn-dense file in the pool (~4 min of launcher CPU).
Two courtesies are now in place, neither weakening a number:
  - `A5GLB_RACE_PACE_MS` (default 4 ms): a gap after every real walk, lowering the storm's
    duty cycle so a sibling's bounded poll gets room. Counters are byte-identical under it.
  - `A5GLB_RACE_WALKS` (default 6600): a scale dial. If a dialled value is used the LEG NAME
    says so, so a dialled census can never be quoted as the hard gate — the hard gate stays
    the lane run with no env set.

## 3. Both captures, in the open

- capture 1: 19 reds; capture 2: 18 reds; all 9 published ids hit in both captures; nothing in the published set went green by accident.
- reds present in capture 1 only (1): the testkit coverage leg `p4t6-session-event-scan` — position-dependent in-pool flake inside the testkit lane (its own fault-injection `test/.tmp-fault/` files move the scanned-file count the leg pins; the scanner itself names that race at `session-event-scan.mjs:224`). Observed rate here: 1/2. Not a this-lane file; nothing here is softened, the rate is quoted per the baseline's LOAD DISCIPLINE.
- zero reds in either capture from: `alpha5-glob-*`, `a5lsp2-*`, `a5p4-*`, `a5w-*`, `a5p5-*`.

### capture-2 identity minus the published nine (9, all worktree-provisioning)

- `packages/runtime/test/rc2-persona-probe.test.ts > PP1 the probe follows the host persona interface, not an invented one `
- `packages/runtime/test/rc2-persona-probe.test.ts > PP3 the harness residue is gone and stays gone no harness re-inlines a`
- `packages/runtime/test/rc2-persona-probe.test.ts > PP3 the harness residue is gone and stays gone no plugin source import`
- `packages/testkit/test/a4p7-merge-gate.test.ts > A4-PR7 §7.6 — the code merge gate, driven by real commands the compositi`
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `
- `packages/testkit/test/plugin-dsh-compat.test.ts > F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use `

Causes, per file (measured from the failure text, not assumed):

- `packages/runtime/test/rc2-persona-probe.test.ts` — resolves the repo root by finding `tests/deepseek-harness-test-use`; this worktree does not carry that gitignored checkout, so the walk climbed to the PARENT checkout and read files there (measured: ENOENT on `/srv/.../dsh-agent-team/packages/runtime/root-binding/harness/persona-probe.mjs`, a MAIN-checkout path, not this worktree).
- `packages/testkit/test/plugin-dsh-compat.test.ts` — drives the REAL 0.2.0-rc.2 evaluator out of the test-use checkout; absent here it reads the parent checkout manifest (peer `0.1.7-rc.1`) — the published census ran with "pristine host built at @639ed01539".
- `packages/testkit/test/a4p7-merge-gate.test.ts` — the composition smoke arms REFUSE because `packages/client/dist/...` is not built in this worktree (the published capture states "client lane built"). Building it would write committed dist mirrors, which this lane must not dirty.

They are absent from the published baseline because the baseline tree is provisioned
("pristine host built at @639ed01539, client lane built"); none of them mentions an a5glb
path, and none is affected by this round's edits. Provisioning them here would mean either
cloning the 0.2.0-rc.2 host and building it, or building the client lane — the latter writes
COMMITTED dist mirrors, which this lane must not dirty, so the disclosure stands instead.

## 4. p4t6

No file-set change this round (the three law files were already booked in the ledger).
Suite 10/10 and `scanSessionEventVocabulary()` still measures **1184** paths — re-measured,
not assumed, after the law edits.


## 5. 收尾笔：a5lsp2 有界 poll 的 courtesy ceiling（协调批准，2026-10-18 #322 收尾单）

`b78aef3f` 上 census 剩 4 红 = `a5lsp2-assembly` 的 REAL 腿（disposeAll / failure cleanup a、b），
与本报告 §2 的本地不可复现一致：小 CI runner 的 CPU 挤占撞其**有界** `pollUntil(8_000/10_000)`。
本 lane 的 pace 已把 7 条压到 4 条。协调授权一处最小跨 lane 礼让笔（courtesy edit，非语义改动）：

- **改动面**：`packages/runtime/test/a5lsp2-assembly.test.ts` 一个文件，`git diff --stat` =
  34 insertions / 5 deletions = 五条 poll 上限的等位替换 + 一个常量与其注释块。
  5 处上限 `10_000 × 4` / `8_000 × 1` → `POLL_CEILING_MS`（默认 30_000；
  `A5LSP2_POLL_CEILING_MS` 可逐 run 覆盖），与 census 算子既有 `--testTimeout=90000` 同族。
- **逐位不变的东西**：谓词（`!pidAlive(pid)`、`sampleLaneProcesses(world).length === 0`）、
  观测面（`/proc` liveness、world-scoped 进程采样）、断言（`toBe(true)`）、腿的编排与顺序，
  全部未动；放宽的只是**数值上界**，头注里 "the old OS pid EXITS, bounded" 的"有界"语义保留。
- **牙还在（实测）**：直接调用 harness 的 `pollUntil(() => false, 250)` → `false`（254 ms 返回），
  即上界到点仍判失败、永不退出的子进程照旧红；把上界拧到 `1` ms 重跑该文件仍 7/7 绿，
  说明在这台六核宿主上这些谓词首采样即已成立——失败只可能来自被饿到的 runner，而非 teardown。
- **复跑**：`a5lsp2-assembly` 单独 7/7、加 `a5lsp2-streaming` 22/22；我的风暴（6600 真竞态 +
  49 腿套件）mid-flight 时同跑该 lane 22/22 绿（腿时长 0.44–0.49 s → 1.0–1.2 s，离 30 s 上界很远；
  当时 load avg 2.80/5.96/6.78），风暴自身 8/8 与 49/49 exit 0；`tests/homes` 收尾残留 0。
  日志入库：[`lsp2-under-storm.log`](lsp2-under-storm.log)（同目录）。
- **未动的相邻面**：`a5lsp2-streaming` 里 2 处 `5_000` 上界不在授权范围内，保持原样——
  若它日后也翻，同一笔礼让照搬即可，不必再讨论语义。
- **环境披露**：本轮期间宿主磁盘 98 % 满（2.9 G 可用，非本 lane 足迹：本 worktree `tests/` 6.2 MB、
  npm 缓存 632 KB）。census 规模对这个值敏感，故记录而非默不作声。

## 6. census round 2（fed6d723）：a5lsp2 失败现场取证——上限不动

`fed6d723` 上 `a5lsp2` cleanup (a)/(b) 在 **30 s 上限后仍红**。这条事实推翻了我上一轮的
解释强度：CPU 饥饿至多是不充分原因，**证据不足**，我不再拿它当结论。按指令做的不是"再修一次"，
而是**把下一次红变成可诊断事实**：

- **上限一个字节都没动**（`POLL_CEILING_MS` 默认 30_000 与 env 覆盖原样，`git diff` 可证）。
- **6 个失败路径 call site**：policyChange g0→g1 与 g1→g2 的 pid-gone poll、failure cleanup (a)
  的"新进程"检查、failure cleanup (b) 的 pid-gone poll 与 residual 检查、disposeAll 的两个 poll。
  绿路径**零输出**（实测：同场跑的正式文件 stdout 里 `a5lsp2 FORENSIC` 计数 0）。
- **断言真值条件不变**：`expect(x).toBe(true)` / `toEqual([])` 原样保留；唯一形状变化是 (a)
  的 `live.every(...) === true` 等价改写为 `foreign` 数组 `toEqual([])`（同一真值条件，
  失败时可报出具体 pid）。观测面仍是那两条：`/proc` liveness 与 world-scoped `sampleLaneProcesses`。
- **一场取证包含**：world 标签 / 腿名 / 期望 / 观测值；`/proc/loadavg` 与 `/proc/pressure/cpu`（PSI）；
  `sampleLaneProcesses(world)` 全表（pid/cwd/cmdline 截断 180）；每个被盯 pid 的
  `pidAlive` + `stat` 状态位 + `cmdline`；world 递归计数（files/dirs/maxDepth/前 12 项）。
  每个读取都是 best-effort——pid 在取样瞬间消失本身被记成事实（`<unreadable:ENOENT>`），不抛异常。
- **渲染被真实执行过**：用一次性探针副本强制渲染一次（副本跑完即删、未入库），
  样本入库 [`lsp2-forensic-scene-sample.txt`](lsp2-forensic-scene-sample.txt) 见同目录。
- **验证**：lsp2 lane 22/22 绿、`tests/homes` 残留 0、eslint clean。

## 7. census round 2 ①：L3 改成**真 measured 律**（fed6d723 CI 首红）

CI 上首红的正是这条自称 measured 的腿。它当年把**一台内核上的一次观测**写死成断言
（`names` 可见）。按单改造后：现场测两维、四个观测，把实测事实打成**一行 stdout**进 capture，
断言只跟随实测形；**没有放宽任何拒绝或外显断言**——变的只是"期望的 scope 从写死变成实测"。

**改造过程里实测到的两条事实，比修腿本身值钱**：

1. **"`names` 不被 gate"根本不是内核律**。把改造前的旧腿单独跑（`-t "L3 MEASURED confine scope"`）
   在**同一台宿主**上直接红：`expected '' to contain 'secret.txt'`；而它在全文件顺序里是绿的。
   也就是说旧断言成立的是 **leg 顺序**，不是内核——CI 内核报了第三种形，于是红。
   这就是父单要的裁决依据：期望必须来自现场实测。
2. **launcher 不把内层退出码传到父侧**：外部 `cat` 的实测是
   `{bytes=none exit=0 stderr=denied}`。拒绝信号只在子进程 stderr 的 errno 类里，退出码是 0。
   所以退出码不是本行的安全信号（旧腿的 `stderr contains 'Permission denied'` 恰好是把它当信号用）。
   新硬断言因此钉：**外部字节在 stdout 与 stderr 双侧都不出现**；父侧先钉
   `readFileSync(外部文件).length > 0`（前提可验）；且子进程**不得**对已知非空的外部文件
   回答"成功且零 stderr"——silently-empty 比 refusal 更坏，直接红。

**L3 现在的断言面**：

- 硬（与内核形无关）：`bytes=none`（stdout+stderr 都不含 canary）；不得 `exit=0 && stderr==''`。
- 硬且**两形同断**：锚定 verifier 必拒 4 例外部件名（`../outside/secret.txt`、绝对路径、
  `outside/secret.txt`、`leak-inner.txt`），family 必须来自 closed 表（前缀 `a5glb-refused/`），
  且拒绝体**不回显条目名**（A8：`JSON.stringify(verdict)` 不含该名）。
- 只测不断言其值：`names` 维打成 `entry=visible|kernel-denied|empty-listing` 进 stdout 与 parity note。
  本轮全量两次实测均为 `entry=empty-listing stderr=denied`，单跑亦同——与旧"names 可见"记录相反，
  已在 `glob-backend.mjs` 头注里改正（头注此前把那句当事实陈述，属于文档假装知道内核 scope）。
- 无 Landlock 时落既有 refused 形：`probe.ok !== true` → 断言行确实拒走
  （`confined-unavailable` + `a5glb-refused/confined-plane`）；probe 通过但零 enforced 维 →
  **具名弃权** `ctx.skip()`（实测事实已印在前面那行），不装作绿。
- 该 refused 形**在本机被真实执行过**：用错误 launcher 字节 pin 令 probe 拒
  （与"无 Landlock"是同一扇门 `probe.ok!==true`），断言行不裸走。
  触发条件（无 Landlock 的内核）本机不可达，但**行为可达且已断言**——这是披露不是掩盖；
  另注：`confined-unavailable` 在本套件此前无任何其它用例，本腿是第一个。

**门语义已核（父单要求自查 census 容不容）**：census 只比红**身份集**——
`compareCensus` 只接受 titled-red 与 `FILE ` collection 两类 id（scripts/ci-pr-gate.mjs:470-476），
并明写"a census whose file/leg counts differ from it is not a different result"（:436-438）；
一条腿变绿或具名弃权都不进 ids，故不可能把红洗白。`--full` 下"任何 skip 即红"约束的是
**门腿自身**的 `DSH-CI-LEG verdict=skip`（文件头 :49-51，指默认跳过的昂贵门腿），
不是它所评分的语料里单条 vitest 腿的状态。结论：**census 容得下这条腿的具名弃权**。

**身份影响披露**：这条腿的**名字变了**（红集按身份比，名字只在红时进 ids；本腿历次 capture
均为绿，故 census 的 ids 集不受影响）。`parity-table.json` 的 L3 行 note 变成实测串（设计意图：
note 随内核而变，不再是一句写死的话），文件已随本轮重生成并重钉。

**验证**：L3 单跑绿；全对（49+8=57）×2 绿；`parity-table.json` 两次逐字节相同；
`adversarial-counters.json` 未变；`tests/homes` 残留 0；eslint clean。

## 8. 取证上链：失败命令的完整 stdout 现在进 census-run.txt

现象：`1b44da20` 上 lsp2 cleanup(a)/(b) 两红，但 CI 里 **FORENSIC=0**。查到的不是"取证没跑"，
而是**通道断在门自己的转写里**：`ctx.capture()`（scripts/ci-pr-gate.mjs:1194）把命令的完整
stdout/stderr 写进 `census-transcripts/<label>.txt`，而进 `census-run.txt`（工作流 tee 的那份、
也是人实际 grep 的那份）只有 `tail(…, 3)` 三行——取证块正好被这三行埋掉。

**最小笔**（门语义零动，只加转写）：`capture()` 里，**仅当命令失败**（`code !== 0` 或有 spawn error）
时把该命令的完整 stdout+stderr 逐行回显进门自己的 stdout，每行前面加 `| ` 标记；
绿跑一字不多。`| ` 不是装饰：`checkTranscript` 用 `^DSH-CI-LEG` / `^DSH-CI-VERDICT` **锚点**给
这份文件重新定级并计数，被回显的行绝不能长得像 token。超限（400 000 字符）时截断并指名
完整文本所在的 transcript 文件名。`.github/workflows/census-runtime.yml` 的
`Upload census transcripts` 步上方加"红了先读什么"的注释（artifact
`census-runtime-transcripts-<run>` = `census-run.txt` + `census-transcripts/`）。

**没加 `--reporter=verbose` 的理由**（父单给的另一选项）：它不增加内容——vitest 的 worker
console 转发与 reporter 无关，实测同一条 `process.stdout.write` 已经进了 `run.stdout`——
却会把 census-run.txt 多出约 7000 行 per-test 噪声，反而盖住 token 通道。

**实测（一次性探针副本，跑完即删、未入库）**：
1. 合成失败捕获：`a5lsp2 FORENSIC …`、`a5glb L3 MEASURED …`、PSI 行逐行带 `| ` 出现在门输出里；
   并在回显内容里故意塞一行 `DSH-CI-VERDICT pass …`——`--check-transcript` 对该转录仍判
   `class=ok :: 1 leg(s), final token pass`（锚点没被伪造）；
2. **真实 vitest** 走同一 capture 路径（把退出码伪造成 1 以触发回显）：a5p4 腿用
   `process.stdout.write` 打的那行 `a5p4 law(4) live named provider mounts on this tree:
   runtime/src/plugin/live/glob-backend.mjs , …/plane-effect-backends.mjs` 带 `| ` 出现 ⇒
   链路 worker→run.stdout→census-run.txt 打通；
3. `node scripts/ci-pr-gate.mjs --self-test`：`pass 59 assertions` 不变；eslint clean。

于是下一次 census 若这两腿再红，artifact 里就有 CI 侧硬事实（PSI/loadavg、每个被盯 pid 的
`/proc` 状态与 cmdline、world 递归计数），判因不再靠猜：CPU 挤占 vs teardown 真缺陷。

## 9. census 330 崩溃的机制与有界回显（撤回单的执行）

**先纠正我自己**：§8 那笔（2d3e9c76）把"完整 stdout 回显"当成无害转写。它是**洪水**：
真实 census 一次 capture 就是 210-215 KB，两 capture 420 KB+，经 `| tee` 写出时在
64 KiB 管道边界处把被评分的那份转录冲掉——`census-run.txt` 停在 65,953 B、**0 条 DSH-CI-LEG**、
无 VERDICT ⇒ `class=missing-token`。取证通道杀掉了裁决通道。牙没掉（红身份集早就算完），
但门的产物废了。**教训入律**：任何往被评分转录里写的东西都必须有界。

**修法（门语义零动，牙不减）**：

1. `failureEchoLines(label, r, transcriptsEnabled)`（**纯函数**，便于 self-test 直接证界）：
   失败路径只回显 `FORENSIC|MEASURED` 命中行；三重硬界 `ECHO_LINE_LIMIT=200` 行、
   `ECHO_LINE_CAP=300` 字符/行、`ECHO_BYTE_CAP=24_000` 字节/次；命中过多时**头尾各取一半**
   （中间的洪水不得埋掉失败前那一段），并印一行 `echo capped: N matched line(s) not echoed`；
   末尾固定指针行 `| full capture: census-transcripts/<label>.txt (artifact census-runtime-transcripts-<run>)`。
   绿路返回 `[]`：一次通过的 census 与加这个特性之前一字不差。
2. `writeEchoLine()`：逐行 `writeSync(1,…)`，**同步**写 ⇒ 读端已断就在这一行当场暴露，
   不再变成没人听的异步 'error' 事件；只吞 EPIPE/EOF，其它错误照抛（转写可丢，裁决不陪）。
3. `guardStdout()`：给 gate 自己的 stdout/stderr 装同样的"只吞 EPIPE/EOF"守卫；
   丢写不会静默——CI 第二读手按 missing-token 规则重新定级，丢 VERDICT 必判 fail。
4. `| ` 前缀仍是承重件：`checkTranscript` 用 `^DSH-CI-LEG` / `^DSH-CI-VERDICT` 锚点计数，
   回显行永远不可能起一个 token；两个方向都在 self-test 里钉死。

**本机复刻 330 的形状（探针副本 + 假 vitest，跑完即删）**：capture-1=published 9 红、
capture-2=9+`a5lsp2` `failure cleanup (a)/(b)`，每 capture ~210 KB ANSI stdout：

| 场景 | 结果 |
| --- | --- |
| 完整管道（写文件） | 到 VERDICT：`DSH-CI-LEG leg=census verdict=fail` + `DSH-CI-VERDICT fail`，`NEW RED(S) 2:` 逐名点出两条 cleanup 腿，转录重定级 `class=red-run`（忠实红跑，非仪器故障）⇒ **牙在** |
| 回显量 | 48 行 / **12 852 B**（界内）；指针行 2 条 |
| 读端停在 64 KiB（旧洪水版） | 转录停在 66 000 B、0 条 leg、无 VERDICT ⇒ `--check-transcript` 判 **`class=missing-token`**——与 CI 330 同类同形 ⇒ **机制复刻成功** |
| 读端停在 64 KiB（有界版） | 全部输出 15 428 B，转录完整 ⇒ `class=red-run` ⇒ **同类不再发生** |

**机制（已证，CI artifact 对质 + 本机复刻）**：**无界突发把被评分的文件截断**。CI 330 的
`census-run.txt` 第 1-415 行止于**第 414 行 = capture-1 回显中途**，capture-1 的头行与 L3 实测行
都在文件里，`| DSH-CI-VERDICT` 从未出现，截断规模 65,953 B ≈ 单次洪水的 64 KiB 边界；本机用
`| head -c 66000` 复刻出同类同形（旧版 66 000 B 断、`class=missing-token`；有界版 15 428 B 全、
`class=red-run`）。⇒ 病根是**突发规模**，与 `write`/`writeSync` 的异步错误路径无关：先前"EPIPE 杀死
门进程"的假设要求"进程死、后续写全丢"，而实测是**被评分文件停更、其余通道（transcript 文件）照常
写完**——假设作废，此处不留猜测。牙从来不在回显里：红身份集在回显之前就算完了。
逐行同步写与"只吞 EPIPE/EOF"的守卫因此定位成**额外加固**（读端消失时不得带走裁决进程），
不是对病根的断言。

**独立缺口记账（本轮不做，需单独特批）**：转录文件在 `--check-transcript` 之前就已落盘，
任何"晚发生的截断"都晚于最终判定——门自己看不见它被截断（330 的 VERDICT 若写出来也是绿谎）。
真修 = 把 transcript 完整性（末行是否为 token、字节数是否与内存中的输出一致）纳入门**后**步骤的
语义，属工作流/门后步骤改动，需特批；此处先入账，不在本轮动。

**self-test**：59 → **68 assertions**（新增：指针行必在最后、每行带 `| `、界由构造保证、
洪水仍保住两端的现场、绿路零输出、`| DSH-CI-VERDICT` 伪行不被锚点计数、真·重复 token 仍判
`duplicate-token`）。eslint clean；`tests/deepseek-harness-test-use` 与 :3080 未触。

## 10. lsp2 根因＝观察器误认（已定）；membership 改为按身份不按词汇

根因（父单 07:03Z 亲读 `a5lsp2-harness.ts:103` 的词汇判据 + artifact `FOREIGN=[14668]`=同 job 的
eslint 腿互证）。本轮再挖出一条更硬的事实支撑同一结论：**第二臂从来没活过**——
`/proc/<pid>/cwd` 是符号链接，`readFileSync` 对它抛 **EISDIR**（本机实测
`readFileSync('/proc/self/cwd') → EISDIR`，`readlinkSync` 才返回路径），所以 `cwd` 恒为 `''`、
`cwd.startsWith(worldRoot)` 恒假 ⇒ 零残留判断 100 % 依赖那条字符串匹配。两个方向的错因此同时成立：

- 假阳：同 CI job 的 lint 腿（cmdline 里出现 fixture 文件名）被算成本 lane 进程
  ⇒ cleanup(a) `foreign=[14668]` / cleanup(b) `residual=[14668]` 红。
- 假阴：world 里拷贝出来的 `ping.mjs` / `lsp.mjs` **不含**该词汇 ⇒ 真残留本来看不见。

CPU 假说作废（按 artifact 表述）：`cpuPressure some avg10=13.2`（16 核 runner）、两 capture 同
`loadavg=2.67`、无 full pressure ⇒ 不是挤占，是观察器认错人。

**修法（membership 按身份）**：

- harness 每 run 生成 nonce（`LANE_NONCE = sha256(randomUUID)[0:16]`），`laneArgv()` 在 spawn argv
  尾追加 `--lane-token=<nonce>`；四个真实 spawn 点全改（assembly 的正常臂与坏-exec 臂、
  streaming 的 `lsp.mjs` 与 source-ping 臂）。fixture 只读 `argv[2]`，尾参无副作用（22/22 实测）。
- `sampleLaneProcesses(worldRoot)` 判据 = `cwd.startsWith(worldRoot) || cmd.includes(nonce)`，
  cwd 读法改 `readlinkSync`（救活死臂）。
- 原 fixture-子串臂**没有静默删**，改成**具名 source-leak 检查** `sourceFixtureLeaksIn(set)`：
  只在 lane 可归属的成员集合里找"正在执行 SOURCE fixture 路径且不带本 run nonce"，命中=具名红；
  外方 lint/scanner 不再进全域扫。披露其覆盖面边界：cwd 在世界外、又不带 nonce 的源码 fixture
  实例不在扫面内——本 lane 全部 spawn 点 cwd 必在世界内，真泄漏必落集合内。
**救活死臂的连带效果（收紧，非放宽，本轮实测绿）**：`readlinkSync` 生效后 `cwd` 第一次真的有值，
policyChange 腿里那条 `live.some(p => p.cwd === join(world,'ws','A-g0')) === false`（旧 genRoot 不得
再被任何进程当 cwd）从**恒真**变成**有牙**；另外身份判据还消掉一类跨文件假阳——streaming 世界里
带 source-ping 的进程，以前会被 assembly 腿的词汇匹配算成"别人的残留"。零残留本身也第一次覆盖
world 拷贝出的 `ping.mjs`/`lsp.mjs`（词汇臂永远看不见它们）。为防"新判据只是恒空"，cleanup(a)/(b)
各加一条**正向成员断言**（本 run 活实例必须在集合里），7/7 实测绿 ⇒ "无残留"不再是空话。

- cleanup(a)/(b)、disposeAll、world-scan 语义不变（两臂并集为空 = 零残留）；
  **30 s 上限一字未动**，既有拒绝/外显断言零动。

**双向负控**（本机复刻 CI 形；逐字输出 = `lsp2-membership-negative-control.txt`，脚本跑完即删）：
诱饵三枚——(1) 只**提及** fixture 名的外方进程（330 的 eslint 形）；(2) 带 nonce 但 cwd 不在世界内
的本方进程；(3) 真从 SOURCE fixture 起、cwd 在世界内、不带 nonce 的进程。
旧判据命中 2：`(1)` 与 `(3)`（另外还匹配到 `bwrap` 包装与跑测试的 bash 自己）；新判据命中 2：
`(2)` 与 `(3)` —— **把外方 `(1)` 扔掉、把自家 `(2)` 认回来**。

| 检查 | 结果 |
| --- | --- |
| CHECK-A 旧词汇判据把外方进程算成 lane 进程 | **RED — census 330 复刻成功** |
| CHECK-B 身份判据排除同一 pid | GREEN — 修好 |
| CHECK-C nonce 臂认出"cwd 不在世界内"的本方进程 | GREEN — 第二臂可用 |
| CHECK-D 真 SOURCE-fixture 实例被具名报出 | **RED by name — 牙未减** |

## 11. 断管负控 + 退出码断言（gate self-test 68 → 77）

按根 07:03Z 令补进 `--self-test`，只加断言、门语义零动：

- **断管负控**：真 spawn 两个子进程跑在"读端只吃 64 KiB"的管道形里（`| head -c 65536`）。
  有界回显那个：VERDICT 仍完整出现在被评分的流里，且写端 exit=0、stderr 无 EPIPE；
  无界洪水那个（负控）：**≥60 KB 被读走而 VERDICT 不在其中**，`checkTranscript` 判
  `missing-token`——若这条哪天变绿，说明洪水回来了。另有构造性一条：
  `2×ECHO_BYTE_CAP + 8 KiB < 65 536`，即两次 capture 的回显加上门自己的行本就装得下管道预算。
- **退出码断言**：用 `--census-json` 真跑门两次（不起 vitest）——红 census `exit=1` 且 stdout 有
  `DSH-CI-VERDICT fail` 并逐名点出那条红；基线同形报告 `exit=0` 且 `DSH-CI-VERDICT pass`；
  把红跑的转录在 token 之前切断 ⇒ `class=missing-token`（330 的形状永不被当成通过）。
  这两次 spawn 会在被跟踪的 gate scratch 目录留下 JSON，self-test 前后对比目录名集合，
  只删自己新增的文件（不整目录删——上轮 `rm -rf` 误删 49 个在册文件的教训已写进代码注释）。
