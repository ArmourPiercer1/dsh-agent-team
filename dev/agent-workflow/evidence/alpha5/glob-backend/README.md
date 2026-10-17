# alpha5 glob-backend — the anchored confined-rg GLOB row (a5glb)

Writer lane: **`alpha5-glob-backend`** (disposable worktree `.worktrees/a5glb-backend`),
base = master **`382e5fb6f872e75937d389e96c5059f2945af8e5`** (fetch-verified at branch
creation). Worlds: `tests/homes/a5glb-*` (TEST_METHODS §5/§7), all self-removed by the
suites (`afterAll` → `destroyWorld`, and the `afterAll` *asserts* the worlds are gone — a
leaked world fails the run); **no retained world** on this lane. The harness also runs an
age-guarded **start sweep** of this lane's own `a5glb-*` leftovers (>20 min old, so a
sibling suite's fresh world is never touched — house precedent
`alpha5-glue7-backend` `07580728`); what it swept is published in
`parity-table.json → startSweepOfStaleWorlds` rather than hidden. Port family untouched —
this lane needs no server, and `:3080` was never contacted.

Closes the glob gap the plan names (`docs/plans/memo/alpha5-tool-io-governance/
alpha5-s0-pr0-pr8-implementation-plan.md` `:33` glob row, `:128` named dependency物,
`:132` native-vs-Team parity 判据, `:136` typed-shape law) **inside my own new files
only** — no plane / agent-bindings / install.ts / `plane-effect-backends.mjs` edit.
ONE exception, by the root's explicit 23:3xZ order: the **p4t6 census ledger**
(`packages/testkit/test/p4t6-session-event-scan.test.ts`) had to *name* this lane's four
scannable files, because a lane that adds scannable files without booking them turns the
census red (`expected 1184 to be 1180`). The edit is booking-only: a named
`SCANNED_PATHS_A5GLB` list (the four paths, nothing else), its term in both sums, its entry
in the "every name is a file on disk" union, and the measured tie
`expect(SCANNED_PATHS_A5GLB.length).toBe(1184 - 1180)` — chain re-tied from the scanner run
on this tree (base master `382e5fb6` at 1180 after alpha5-schema-rev → 1184 with this lane),
not copied from anyone else's number. Suite is green (10/10). Integration is the glue
writer's call; the mount contract is in §6 below.

## 1. Files this lane owns (the whole diff)

| path | kind |
| --- | --- |
| `packages/runtime/src/plugin/live/glob-backend.mjs` | NEW — `createAnchoredGlobBackend` + the anchor/verify law |
| `packages/runtime/test/alpha5-glob-harness.ts` | NEW — fixture tree, hand-written native oracle, TS faces |
| `packages/runtime/test/alpha5-glob-backend.test.ts` | NEW — RED pin + rg PARITY + FRAMING law + LIVE + typed-shape + fixture hygiene (44 legs) |
| `packages/runtime/test/alpha5-glob-backend-adversarial.test.ts` | NEW — anchoring under attack: 5000 anchor-law iterations + **6600 real confined rg walks**, every real walk spill-probed (8 legs) |
| `packages/runtime/package.json` + `pnpm-lock.yaml` | `@deepseek-ai/dsh-tool-fs-search@0.2.0-rc.2` registered **in the same stroke** (`:128`) |
| `dev/agent-workflow/evidence/alpha5/glob-backend/` | this README + `parity-table.json` + `adversarial-counters.json` + `red-capture.txt` |

`plane-effect-backends.mjs` (the same-dir reference) is **not modified** — read only.

## 2. The anchoring law (self-contained, following the controlled-fs 道律 — NOT "只 realpath")

`realpath` before the spawn is the shape this lane refuses to ship: between the check and
the walk the tree can move. The row's law, in the order it runs:

- **A1 open-time handle, per component.** The governed root AND every component of the
  target are opened `O_RDONLY | O_DIRECTORY | O_NOFOLLOW` from the *root's own verified
  fd view*. A symlink component fails the open (`ELOOP`/`ENOTDIR`) and is refused —
  `symlink-alias` (an `lstat` only *names* the reason; the failed open is the verdict).
  Missing → `target-unresolvable`, non-directory → `not-a-directory`, and **the root path
  itself being a symlink → `root-symlink-alias`** (leg A3: `realpath(rootDir)` alone walks
  the outside tree the moment the root is swapped).
- **A2 exec-time re-read.** Every opened fd is re-read through
  `/proc/self/fd/<n>` (`fdPath`), canonicalised *without* following links
  (`canonicalOrSelf`, per-component `realpathSync` with `lstat` so a trailing symlink is
  kept visible) and required to sit **beneath the root's own anchor** — else
  `exec-time-escape` / `anchor-unverifiable`. This is the C-FS lane's
  `verifyOpenedHandle` shape, re-implemented here rather than imported.
- **A3 the handle stays open for the whole call.** The walk-root fd is carried on the
  anchor, closed only in a `finally`, and its `{dev, ino}` (plus the root's `{dev, ino}`)
  is re-checked at result time — a tree renamed/exiled/swapped mid-flight settles as
  `anchor-drift` / `root-drift`, never as an answer (leg A6).
- **A4 result-side verification.** Every path the walker emitted is proven to be a real,
  non-symlink **file** inside the anchor (same component law). One bad entry refuses the
  WHOLE walk — `walk-contaminated` / `walk-unverifiable` — instead of silently dropping a
  row. A `..`-crossing or absolute entry cannot be presented.
- **A5 output framing is NUL, not newline** (fix-list ①). The row appends **exactly one
  token** to the host's argv — `--null` (`GLOB_OUTPUT_PROTOCOL_ARGV`) — which changes how
  records are *delimited*, never what the walk selects (measured on one fixture: identical
  set, identical mtime order, leg P0 pins the argv diff to that one token). The reason is a
  forgery class, not tidiness: leg N1. A NUL byte cannot exist in a filename, so NUL
  framing is **injective** — one record, one filesystem object; an embedded newline is
  ordinary data inside the name.
- **A6 single producer of presented paths** (fix-list ②). `verifyGlobResultsBeneath`
  returns the array the outcome presents; the only string operation between verification
  and presentation happens *inside it*, from `anchor.walkRel` (fixed when the anchor was
  taken, never derived from the walker's bytes). After that return the caller takes an
  array **window** for the inline cap and nothing else — no second parse, re-split,
  re-join or re-resolution. Attribution is handle-based end to end: every entry is opened
  under the pinned anchor fd (`/proc/self/fd/<n>`, an inode-bound view, `O_NOFOLLOW` on the
  final component) before its string is allowed into that array. Leg **N3** is the
  mechanical static argument, **N4** pins the window and the anchor-owned prefix, **S1**
  keeps the teeth on a hostile entry list.

- **A7 the channel law** (23:05Z 修复单 ①+②). A walk touches **five** channels and each is
  closed *before* the verdict, not after: **C-STREAM** (stdout is buffered, bounded; the data
  handler holds no channel object at all — no `io`, no sink, no log call carrying rows);
  **C-SPILL** (`io.sink` is written **exactly once per call, after the verdict**, from the
  admitted array only — a refused walk writes **zero bytes**, an admitted one writes precisely
  what it presents, in the walker's own NUL framing); **C-RESULT** (the outcome is built from
  `verdict.entries` only; refusal arms echo no rows); **C-STDERR** (a bounded diagnostic —
  `GLOB_MAX_STDERR_BYTES` — never a channel, never in an `ok:true` result); **C-TIMEOUT**
  (`settlement:'cancelled'`, empty outcome, no write). The defect this law closes was real in
  this row: the stream used to be written to the sink *as it arrived*, so a walk refused a
  moment later had already leaked its raw rows into spill. The refusal class that exposes it
  is not hypothetical and is not a race — leg **X1** induces it deterministically (a listed
  regular file that cannot be opened at verification time, i.e. after the child streamed).

**Disclosed residua (no overclaim).**
1. `/proc/self/fd/<n>` re-resolves **by path**, not by inode pin, so an attacker who swaps
   a component *between* the re-read and the walker's own traversal is stopped by A1+A2
   (the walker's cwd/argv never name it) but the pin is not an `openat2(RESOLVE_BENEATH)`
   — the host exposes no such face to a plugin, and this lane invents none. What is proven
   is: what the row *accepts and presents* was opened, re-read and verified beneath the
   governed root.
2. ~~A filename carrying a newline ends typed~~ **closed by A5** (leg S3 is now the
   positive form: such a file is walked, verified through the anchor's fd chain and
   returned under its true name). What remains downstream of this row: the presented name
   still *contains* a newline, so whoever renders it must not re-frame it by line — the
   row's own outcome is a string array and needs no framing.
3. A walk whose entries cross an escaping symlink is **refused whole** — a deliberate
   divergence from native rg, disclosed in §4.
4. No network claim: the confined request carries no network profile, and the row does not
   assert more than the provider's probe reported.

## 3. live 腿 — the real rg inside the existing confined provider

The row calls the provider's **public face only**
(`packages/runtime/sandbox-provider/index.js` → `createConfinedProcessProvider`,
`.probe()`, `.spawnStreaming(SpawnRequest)`); no private deep-link, no host edit.
Measured on this host (Leg L1 / `parity-table.json` row `L1 confine probe`):
**Landlock ABI v4, `content-read = enforced`**; a confined walk takes ≈45 ms and moves
`execCount()` with the closed stage trace `probe → prepare → execute → terminate` (L2).

Two **measurements that changed the design** (both are legs, not prose):

- **L3 — the confine guards BYTES, not NAMES.** Inside a confined child,
  `cat <outside>/secret.txt` → `Permission denied`, but `ls <outside>` **succeeds**.
  So "the sandbox is the backstop" only covers content; path-name disclosure is the row's
  own responsibility — which is exactly why A4 exists and why a realpath-only row is not
  enough. (Worth the plane's attention: the same asymmetry applies to every row that
  reports paths.)
- **L5 — the interface boundary for fix-list ②, measured:** the provider's fd face is a
  *declaration* (`declaredFds → fd_plan`) and the streaming arm spawns the launcher on a
  fixed four-pipe stdio (`provider.ts`: `['pipe','pipe','pipe','pipe']`), with fd 3
  launcher-owned and refused as a payload fd by `compileFdPlan`. Declaring fd 7 in a
  request changes nothing: the child's `/proc/self/fd` shows the streaming pipes and the
  launcher's own reserved descriptor, **nothing of the caller's** — so a caller-opened
  directory fd cannot cross into the child, and same-fd semantics are impossible on the
  child side without a new host interface (not invented here). They are therefore placed
  where the existing interface does allow them, which is also the side that presents the
  answer: A4 + A6 on the caller's pinned handle.
- **L3b — a `/proc/self/fd/N` child cwd does not work here.** Passing the verified dir
  fd's magic link as the spawn `cwd` yields exit 0 with **zero rows and zero stderr**
  through this provider, while the identical argv from the anchored *path* cwd walks fine.
  A silently-empty answer is worse than a refusal, so this row passes the anchored path as
  `cwd` (argv carries no search path at all) and puts its trust in A1–A4.

## 4. rg PARITY 判据 (`:132`) — native vs Team, same parameters

The native side is invoked with the **hand-written** argv in the harness, and leg **P0**
pins that spelling to the host's public `buildGlobCommand` — so a parity match cannot be
true by construction. Fixed fixture tree (17 files, frozen mtimes; VCS stores;
`.gitignore`d subtree; a hidden dotdir; a `node_modules` copy). Full numbers:
[`parity-table.json`](parity-table.json) — **22 rows, 21 exact order-matches, 1 disclosed
divergence** (`L3b`, which is a measurement of an alternative design, not a walk).

| class (leg) | native | Team | verdict |
| --- | --- | --- | --- |
| basic `**/*.ts` (P1) | 6 | 6 | same paths, **same modification-time order** |
| hidden (P2 / P2b) | 6 / 18 | 6 | dotfiles + `dotdir/.secret.log` in on both sides; control legs show `--hidden` is what admits hidden entries when no positive glob names them |
| ignore (P3) | 6 | 6 | governed argv is `--no-ignore`: `ignored/drop.ts`, `node_modules/...` present; control leg (`--no-ignore` off) hides both |
| VCS (P4) | 12 | 12 | all six `GLOB_VCS_EXCLUDES` stores out on both sides; without the negations native leaks `.git/config` |
| subtree target (P5) | 3 | 3 | sub-directory walk, presented root-relative |
| absolute target inside the root (P6) | 1 | 1 | `absolute-path` placement, same order |
| sort stability (P7) | 6 | 6 | identical order across three re-runs; order is mtime, not name |
| sort tie (P7b) | 2 | 2 | equal mtimes: same set, and OUR order never moves between runs (rg's tie order is unspecified — we do not claim it) |
| empty (P8) | exit 1 | 0 rows | typed empty shape; native exit 1 is NOT an error |
| illegal pattern (P9) | exit 2 | `undetermined / rg-walker-error` | carries rg's own words (`error parsing glob`), never a fake-empty list |
| over-cap (P10) | 105 | **100 inline (`GLOB_MAX_RESULTS`) with `totalMatches = 105`, `truncated: true`** | the full 105 match native when the assembly raises the ceiling to 105 |
| sink bytes (P11) | — | — | `io.sink` received **byte-identical** native stdout |
| newline forgery (N1) | 4 objects | 4 records | **the counterfactual is in the table**: on the SAME bytes, newline framing emits 5 records, duplicates `plain.ts` and loses the object's real name; NUL framing matches native exactly, no duplicate |
| **X1 post-stream refusal → spill** | n/a | 0 bytes | child ran, streamed real rows, verdict refused: sink bytes **0**, answer echoes no rows, execCount still moved |
| **X4 capped spill window** | 105 | 100 | spill carries the **admitted** rows only (NUL-framed), not the whole walk; `totalMatches` still the native 105 |
| X3 timeout arm | n/a | 0 bytes | `settlement:'cancelled'`, empty outcome, sink empty |
| X6 overflow arm | n/a | 0 bytes | narrowing-only buffer (4 KiB) trips `walk-too-large`: unparsed, nothing written |
| **newline forgery (N1)** | 4 objects | 4 records | **the counterfactual is in the table**: on the SAME bytes, newline framing emits 5 records, duplicates `plain.ts` and loses the object's real name; NUL framing equals the native NUL walk exactly, no duplicate |
| escaping symlink (S1) | 8 | 8 | rg neither follows nor lists it (so parity holds); A4's teeth are proven separately against a hostile entry list (`../outside/secret.txt`, absolute, an in-tree escaping symlink) |

## 4b. 根 22:30Z 修复单（本轮，逐项对应）

| 单 | 处置 | 证据 |
| --- | --- | --- |
| ① NUL 分隔解析 | 采纳并实现为 law **A5**：spawn argv 追加**唯一**一个 token `--null`；`parseWalkOutput` 按 `\0` 切分、注入性由「NUL 不能出现在文件名」保证；流中出现的空记录 = typed `walk-protocol-error`。P11 字节律在 NUL 形下**保持**（sink 字节 == 同 argv 原生 stdout）。 | P0 / N1 / N2 / P11 |
| ② 归属与 cwd 竞态 | 采纳为 law **A6**（单生产者）：presented 数组由验证器产生、前缀取自 anchor（`walkRel`），此后调用方只做**数组窗口**（上限）；每条记录的字符串进入该数组前都已在 pinned anchor fd 的 `/proc/self/fd/<n>` 下以 `O_NOFOLLOW` 打开过。**子进程侧同 fd 不可能**：公开 fd 面只是声明、streaming 臂 stdio 固定四管道、fd 3 launcher-owned 被 `compileFdPlan` 拒——实测声明 fd 7 后子进程内不存在该 fd（L5）。故句柄语义落在**呈现侧**。 | N3（静态论证）/ N4（窗口与前缀）/ S1（敌意条目）/ L3b + L5（接口边界实测） |
| ③ live attacker witness | 竞态腿的 witness 变为**可计数**：每次 swap 按状态记账，并把每次真 rg 走的答案/拒答与当时状态对齐。120 次真 rg 竞态维持并随 ② 修后重跑：`real=2561 link=2560`，`okWhileReal=60 refusedWhileLink=60 okWhileLink=0 refusedWhileReal=0 contended=0`（**link 态从不作答**即是要害）。 | `adversarial-counters.json → liveWitness` |
| ④⑤⑥ 表/套件/门重出 | parity 表 19 行 / 18 顺序全等（1 行为替代设计测量）；对抗 8 腿；门全套（typecheck exit 0 / 4 新文件 eslint 净 / 46 腿 / 世界 0 残留 / 证据两次运行逐字节同）。 | 本目录 |

## 4c. 根 23:05Z 硬门修复单（spill = 安全 FAIL 轮，逐项对应）

Reviewer 判定成立：修前 `run()` 在 `stdout.on('data')` 里**边到边写 `io.sink`**，于是"稍后被
拒的 walk"已经把原始行写进了 spill —— 那是**未验字节先到通道**，与 verdict 无关。本轮把它变成
law **A7**（见 §2），并按 ①–④ 逐项给证据：

| 单 | 处置 | 证据（静态 + 行为） |
| --- | --- | --- |
| ① sink 写门控 | 流处理器改为**只缓冲**（已有上限；本轮再加：assembly 只能**收窄**该缓冲 `maxWalkBytes`，永不放宽）；全模块**唯一**一处 `sink.write` 位于 verdict 之后、来源只能是 admitted 数组（`files.join(NUL)` + 终结符）。被拒 walk 写入 **0 字节**。 | X1（决定性诱发：被列出的普通文件在**验证时**打不开 ⇒ 子进程已流完才拒；sink 字节 == `''`，答案不复述任何行，execCount 仍 +1）/ X5(a)(b)(e) |
| ② 全通道审计 | §2 A7 的五通道表；逐通道给"verdict 前是否有未验字节可达"的静态与行为论证：C-STREAM 无通道对象 / C-SPILL 单点写在 verdict 后 / C-RESULT 只由 `verdict.entries` 构造 / C-STDERR 只作 diagnostic 且有上限（新 `GLOB_MAX_STDERR_BYTES`）/ C-TIMEOUT 空结果零写。 | 静态 X5（写点计数=1、位置晚于 verdict 与窗口、stream 处理器不含 `sink`/`io`/`observe`、成功臂不含 `stderr`、写点之后不再有拒绝分支）；行为 X1（后验拒）/ X2（walker-error、缺 target、越界 target、target 是文件四臂 sink 皆空）/ X3（超时臂）/ X4（上限窗只写 admitted）/ X6（溢出臂不解析不写） |
| ③ 活攻击全套重跑 | 真 confined-rg 竞态由 120 提到 **6600**，且**每一次**都挂 spill 探针：拒答 ⇒ 通道 0 字节；作答 ⇒ 通道字节 == 呈现行的 NUL 拼接；任何通道字节含 canary 即记泄露。link 态**零作答**继续作为断言。 | `adversarial-counters.json → liveWitness` + `spillProbe`（A5 腿内逐条断言） |
| ④ parity/门随修重出 | P11 字节律在门控后**仍然成立**（root 锚定走：sink 字节 == 同 argv 原生 stdout 逐字节），新增 X4 表明有上限时通道只承载 admitted；全套门重跑见 §7。 | 本目录两份 JSON（两次运行逐字节同） |

## 5. 对抗腿 (`adversarial-counters.json`)

`rename → symlink` swap race against the anchored path, attacker flipping it every
iteration between a real directory and a symlink onto the outside canary
(`real`/`link` both observed):

- **A4 — 5000 iterations: 2500 anchors accepted / 2500 refused, 0 hostile entries
  accepted, 0 leaks.** The leak detector is not a verdict check: every accepted entry is
  *read back* and compared against the canary, and every refused state is counted.
- **A5 — 120 REAL confined-rg walks under the same swap**: 60 `symlink-alias` refusals,
  the other 60 answering only with `live/…` entries that read back as the inside marker.
  (The loop against the real child is bounded at 120 because a confined spawn measures
  ≈45 ms here; the law itself is exercised 5000× in A4.)
- **A1/A2** mid-segment and last-segment symlink escapes refused **before any process
  exists** (`execCount()` does not move); **A3** root swapped to a symlink → refused;
  **A6** anchor exiled out of the governed root mid-flight → `anchor-drift`, never an
  answer; **A7** no pattern (`../..`, `**/outside/**`, `/etc/**`, `**/leak.ts`) ever
  presents a path outside the root; **A8** publishes the counters.

## 6. 集成契约 (for the glue writer — nothing here edits the plane)

Export signature (`packages/runtime/src/plugin/live/glob-backend.mjs`, plain `.mjs`, node
imports only):

```js
export function createAnchoredGlobBackend(options: {
  realmId: string,                      // confined provider realm
  rootDir: string,                      // the GOVERNED root (workspace root of the plane)
  confined: {                           // same conf the plane already carries for the shell row
    trustRoot: string, scratchRoot: string,
    assembly: { launcherPath: string, launcherSha256: string, minAbiVersion: number },
    runnerCommand?: [string, ...string[]],
  },
  maxResults?: number,                  // default GLOB_MAX_RESULTS (host public root)
  timeoutMs?: number,                   // default GLOB_WALK_TIMEOUT_MS (60_000)
  observe?: (line: string) => void,     // the row's own log lines (echo style is the plane's)
}): {
  backendId: 'a5glb-anchored-confined-rg-glob',
  run(call, io): Promise<BackendResult>, // never throws; closed triad denied|hidden|undetermined
  execCount(): number,                   // pre-execute refusals never move it
  lastStageTrace: readonly string[],     // probe → prepare → execute → terminate
  lastRuns: readonly { pid, exit, ms, rows, truncated, code }[],
}
// also exported for review/verification: GLOB_BACKEND_ID, GLOB_WALK_TIMEOUT_MS,
// GLOB_MAX_RESULTS_CEILING, GLOB_MAX_WALK_BYTES, globIsBeneath, openAnchoredWalkRoot,
// verifyGlobResultsBeneath, globArgv, parseWalkOutput
```

`run()` returns the lane's own outcome shape
`{ ok: true, outcome: { outputMode: 'files_with_matches', matches: [], counts: {}, files, totalMatches, truncated }, settlement: { kind: 'completed' | 'cancelled' } }`
— i.e. what `formatGlobOutput` in the host package consumes. **`formatGlobOutput` is
intentionally not called here** (spill-bound and rendering stay single-owned by the plane,
the same ruling the glue lane disclosed); `toWorkdirRelative` remains available if the
integrator prefers presentation to move. `parseGlobArgs` IS reused as a second validation
gate, and `resolveRgPath` as the binary locator — both from the host package's public root.

Mount line (the plane **already** accepts this input; `register.ts:118` falls back to
`searchBackend` when it is absent — that fallback is exactly what leg R1 pins):

```js
// where the plane assembly is built (glue writer's file, one line):
backends: {
  glob: createAnchoredGlobBackend({
    realmId, rootDir: <the same governed root the fs row uses>,
    confined: <the same confined conf the shell row uses>,
    observe: (line) => { stdoutEcho(`[team-tool-plane] ${line}`) },
  }),
}
```

One mount must be chosen: the `alpha5-glue7-backend` lane carries its own inline
`createAnchoredGlobBackend` (`backendId 'a5g7-confined-rg-glob'`) inside
`plane-effect-backends.mjs`. Two rows for one verb is not a merge state; the reviewer's
gap list for that row (no parity table, no result-side verification, its race leg at 200
iterations, one failure class outside the closed triad) is in the parent's report of
this lane.

## 7. Reproduction

```bash
cd .worktrees/a5glb-backend
pnpm install --offline --ignore-scripts --store-dir ../../.pnpm-store-a5g7   # or the shared store
npx vitest run packages/runtime/test/alpha5-glob-backend.test.ts \
               packages/runtime/test/alpha5-glob-backend-adversarial.test.ts
# regenerate the evidence artifacts (proven byte-stable: identical across two runs,
# no timestamps, no per-run world paths — the only `a5glb` string in them is the backend id):
A5GLB_EVIDENCE_DIR=$PWD/dev/agent-workflow/evidence/alpha5/glob-backend \
  npx vitest run packages/runtime/test/alpha5-glob-backend.test.ts \
                 packages/runtime/test/alpha5-glob-backend-adversarial.test.ts
pnpm -r run typecheck && npx eslint packages/runtime/src/plugin/live/glob-backend.mjs packages/runtime/test/alpha5-glob-*.ts
```

Leg **H1** is the fixture-hygiene law itself (a stale `a5glb-*` world is swept, a world
created microseconds earlier survives — a first draft of the sweep got the age parsing
wrong and swept a live sibling's world, so both halves are now pinned, not just noted).

`red-capture.txt` is the pre-row state, captured verbatim off the shipped plane (the
`R1` leg keeps that text pinned forever, so the RED face stays checkable after the row
lands). The suites need this host's Landlock (probe enforces it); on a host without it
the live/adversarial-real legs fail loudly — the row refuses, it never fakes.

**Fixture hygiene, corrected this round.** A single `destroyWorld` + `existsSync` check
used to pass while the world was left on disk: the confined provider can land a scratch
write (`<world>/scratch/probe-*`) *after* teardown, re-creating the directory a beat after
the check. Both suites now clean through `destroyWorldVerified` (destroy → settle → re-look,
repeating until the tree stays gone) and fail if it is still there; the repeat count is
printed rather than hidden. Two worlds found leaking this way were removed by hand and are
named here rather than quietly deleted.

**p4t6 census booking (root order, 23:3xZ).** The four scannable files of this lane are
booked by name in the p4t6 ledger with a scanner-measured tie `1180 → 1184`; the suite is
green (10/10). See §1 for the scope of that one-file exception.

Last recorded run on this host: **52/52 legs green** (44 row + 8 adversarial, the adversarial file alone ~168 s at 6600 walks),
`pnpm -r run typecheck` exit 0 across all 9 packages, `eslint` clean on all four new
files, `parity-table.json` + `adversarial-counters.json` byte-identical across two
consecutive runs, zero leftover `tests/homes/a5glb-*` worlds.

## 8. Dependency registration (`:128`, same stroke)

`@deepseek-ai/dsh-tool-fs-search": "0.2.0-rc.2"` added to
`packages/runtime/package.json` with `pnpm-lock.yaml` in the same commit
(`version: 0.2.0-rc.2(dd915b1c3d0ea66ee534758c47dc32c7)`), OPTIONAL_ONLY BFS carries
`@vscode/ripgrep` → the measured binary is **ripgrep 15.0.0 (rev 3a612f88b8)**
(`@vscode/ripgrep-linux-x64@1.18.0`, 5 728 032 bytes), resolved through the package's own
`resolveRgPath()` and never hardcoded.
