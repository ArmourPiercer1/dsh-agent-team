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
