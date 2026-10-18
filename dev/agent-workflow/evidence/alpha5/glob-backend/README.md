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
| `dev/agent-workflow/evidence/alpha5/glob-backend/` | this README + `parity-table.json` + `adversarial-counters.json` + `channel-matrix.json`（§2d 的全通道表，由 leg X11 生成）+ `red-capture.txt` |

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

- **A8 the unified output law** (23:48Z 修复单: "不许逐条孤立修补"). A7 closed the *byte*
  streams; the root was right that the enumeration data could still leave through **words**.
  The rule is now structural rather than arm-by-arm:
  1. an observable failure is a **closed code + a family word + finite integers**. The helper
     `failure(class, code, counts, debug, debugText)` looks its prose up in a frozen table
     (`GLOB_REFUSAL_TEXT`) and its family in `GLOB_REFUSAL_FAMILIES`, so **a call site cannot
     invent a channel** — there is no parameter that becomes `detail`. Every previously
     echoing arm is gone: the walker's stderr (`rg-walker-error`), the exit arm, the spawn /
     capability refusals that pasted provider messages, the host parser message, the
     anchor-law arms that quoted `/proc` views and path components, and every
     `walk-contaminated`/`walk-unverifiable` that quoted the entry it refused. They now carry
     `{exit}`, `{stderrBytes}`, `{entries, at, depth, reason}`, `{budget}` — arithmetic.
     Semantics stay distinguishable: `family=a5glb-refused/walk-attribution` +
     `code=walk-unverifiable` + `at=3, depth=1` separates every class the reviewer cares
     about, and the *entry* is at index `at` of the walk the caller can re-derive.
  2. an observable success is the admitted array only (A6/A7);
  3. **the audit line face is grammar-pinned**: `anchored-glob <verb words> key=token…`,
     where a token is `[A-Za-z0-9._-]+` and the one exception is
     `family=a5glb-refused/<word>`. No space, no slash, no newline ⇒ no path and no
     ripgrep sentence can *parse* as an audit line (leg X8 checks every emitted line, and the
     live attacker re-checks every line of all 6600 walks);
  4. `run()` **never throws** — the whole walk is wrapped, and an unexpected fault is
     `internal-error` + arithmetic, never an exception string (leg X9);
  5. rich post-mortem text exists only on the **internal face** `internalLog`, **default
     OFF** (see §6: it is not an output channel).
  The sweep also *tightened* behaviour it found: an unrecognised `placement` word used to be
  silently walked as a relative target; the row now refuses to guess (closed set +
  provenance note in the source).

**Disclosed residua (no overclaim).**
- A8 buys "no name on the wire" and pays with *position*: a refusal says
  `at=<index>, depth=<n>, reason=<k>` rather than naming the entry. That is arithmetic over
  the walk, and it does identify a slot for anyone who can re-run the same walk — but it
  writes nothing out, and the entry that tripped attribution was, at that instant, one the
  row could not even read. If a consumer ever needs the name, the row's contract is "re-walk
  and index", not "read the failure".
- The internal face quotes entry names on purpose (that is its use). It is default-off and is
  declared a non-output channel in §6, but a *mount* that wires it to a visible surface would
  reintroduce the leak with our blessing: that is now the integrator's responsibility, and
  the reason §6 states it in the contract text rather than only in this README.
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
| illegal pattern (P9) | exit 2 | `undetermined / walker-error`, `family=a5glb-refused/walker-error`, `counts={exit,stderrBytes}` | restated under A8: still a typed walker error, never a fake-empty list — and rg's own words now go **only** to the internal face (both halves asserted) |
| over-cap (P10) | 105 | **100 inline (`GLOB_MAX_RESULTS`) with `totalMatches = 105`, `truncated: true`** | the full 105 match native when the assembly raises the ceiling to 105 |
| sink bytes (P11) | — | — | `io.sink` received **byte-identical** native stdout |
| newline forgery (N1) | 4 objects | 4 records | **the counterfactual is in the table**: on the SAME bytes, newline framing emits 5 records, duplicates `plain.ts` and loses the object's real name; NUL framing matches native exactly, no duplicate |
| **X1 post-stream refusal → spill** | n/a | 0 bytes | child ran, streamed real rows, verdict refused: sink bytes **0**, answer echoes no rows, execCount still moved |
| **X4 capped spill window** | 105 | 100 | spill carries the **admitted** rows only (NUL-framed), not the whole walk; `totalMatches` still the native 105 |
| X3 timeout arm | n/a | 0 bytes | `settlement:'cancelled'`, empty outcome, sink empty |
| X6 overflow arm | n/a | 0 bytes | narrowing-only buffer (256 B) trips `walk-too-large`: unparsed, nothing written |
| **X7 wire sweep** | — | — | 8 refusal arms in one battery; every returned object: `detail` is a value of the frozen table, `family` a value of the family table, `code` a `[a-z0-9._:-]{1,40}` token, `counts` finite integers — and **none** of the planted names (canary files inside, the outside tree's name and path) appears anywhere in the returned JSON. The contaminated arm is driven through `verifyGlobResultsBeneath` directly (rg does not list symlinks), under the same law |
| **X8 audit sweep** | — | — | every `observe` line matches the pinned grammar (verb words, then `key=token` with tokens free of `/`, space, newline; `family=` pinned to `a5glb-refused/<word>`); rejected shapes include `realm=/srv/...`, `detail src/a.ts`, `stderr=rg: error parsing glob` + newline. `lastRuns` bookkeeping asserted path-free |
| **X9 never-throws sweep** | — | — | 12 malformed calls (missing/nested-wrong shapes, a 9 KB target, unknown `placement`, `..` inside a locator, a NUL locator): all settle typed, **zero throws**, `execCount()` never moves. This leg found the silently-accepted unknown `placement` (fixed: closed set + provenance note) |
| **X10 internal face default off** | — | — | with no `internalLog`: two identical runs return byte-identical JSON, the backend's key set is fixed, nothing retains rg's words; with the face opened the words appear **there** and not in the result |
| **X11 the matrix** | — | — | emits `channel-matrix.json`; asserts each cell names its proving leg and that ≥7 cells were genuinely reachable pre-fix (the fix round is not inflating a non-problem) |
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

## 4d. 根 23:48Z 收口升级单（不许逐条孤立修补 → 全通道数据流治理）

| 单 | 处置 | 证据 |
| --- | --- | --- |
| ① 先列全表再修 | §2d 的 源×汇 全表（7 源 × 10 汇），并落成机器可读件 `channel-matrix.json`（由 leg X11 从测试内的数据生成，cell 点名证明它的 leg，故不会与代码漂移）。表里 `pre: YES` 共 **7** 格 = 本轮真实修复面：条目名→spill、条目名→detail、rg stderr→detail、provider 消息→detail、host parser 消息→detail、验证期解析路径→detail、异常串→throw（`run()` 未全包裹）。 | §2d + `channel-matrix.json` + X11 |
| ② 统一律 | 见 law **A8**：`failure(class, code, counts, debug, debugText)` **没有**能把字符串变成 `detail` 的参数——文案查 `GLOB_REFUSAL_TEXT` 冻结表，族名查 `GLOB_REFUSAL_FAMILIES`，动态内容只剩 `{exit, stderrBytes, entries, at, depth, reason, budget}` 这类有限整数。walker-error / exit / spawn / probe / pattern-invalid / anchor 各臂一次改净，而不是只补被点到的那条。合法语义仍可分辨：`family=a5glb-refused/walk-attribution` + `code=walk-unverifiable` + `at/depth` 与 `walker-error` + `exit=2` 与 `walk-too-large` + `budget` 各自独立。 | `glob-backend.mjs` 表 + X5/X7 |
| ③ 内部排障通道 | 新增 `internalLog`，**默认关闭**（不给 = 什么都不留，leg X10 证两次结果逐字节同、backend 面不含被藏文本、键集固定）。它是**非输出面**：`io`/result/`observe` 任何一条路径都不接它（X5 静态：写点唯一且只在 verdict 后；X8 语法钉死 `observe`）。§6 里对装配方明确写死"不得接到 tool result / spill / 模型可见面"。 | X10 + X5 + §6 |
| ④ 同一活跃攻击器挂全通道探针 | 6600 次真 rg 竞态**每次**都过：return 对象 JSON、spill 字节、每条 audit 行（并逐行语法校验）、**故意打开**的 internalLog 面、以及万一抛出的异常字符串；监视 token = 外部树名/外部路径/canary（内部面只监视外部 token，因它按定义可载被拒条目名）。计数：`allChannelProbe{walks:6600, auditLines:6601, auditBytes:639915, internalLines:3300, resultBytes:1181400, spillBytes:49500, exceptionStrings:0, detailsFromTable:3300, wireTokenHits:0}`。`detailsFromTable == 拒答次数`（3300）即"每次拒答的每个字都出自冻结表"。 | `adversarial-counters.json → allChannelProbe` + A5 腿内逐条断言 |
| ⑤ p4t6/门随修 | 无新增可扫文件（4 个在册文件内容改动不改计数）；p4t6 仍 10/10、scanner 仍 1184。typecheck 9 包 0 错，eslint 干净，零 `a5glb-*` 世界残留。 | §7 |

顺带修掉扫描器自己抓到的一个**行为**缺陷（不是风格）：不认识的 `placement` 词过去被当作
相对目标静默走；现在源内有 closed set + 出处说明（host 的 glob 参数律根本不携带 placement，
`placement` 是 lane 词），未知词一律拒。见 leg X9。

## 4e. 根 census 同池交互轮（2026-10-18，#322 最后门）

CI 的 census 是**九根同池一个进程**（pool=threads），本 lane 的两个套件因此第一次与
`a5lsp2-assembly` / `a5p4-lane-hygiene` 等判面同场。合树 7 条新红的机制、修法与本地两次
capture 的恒等结果都写在 **[`census-round-20261018.md`](census-round-20261018.md)**。要点三条：

1. **三条 law 红是判面语义撞上了合法装配**，不是本产品缺陷：`sandbox-provider` 的
   dormancy law 有两份副本（`a5p4-lane-hygiene` 律 (4) 与 `a5w-integration-wiring`），
   加上 `a5p5-dormant-audit` 的 name-only 台账。修法按 a5p5/a5w 既有先例：
   **具名 + 形钉**——每条装配行按文件名册，钉死"恰一条 public-face import 边、不得深 import、
   不得长第二条边"，**未命名的引用照旧是红**（牙没换，只是把已发生的装配事实公开记账）。
   注意披露：`plane-effect-backends.mjs`（glue lane）在 master 侧 `7ab56dbf` 上就已触发同一条
   红（`git grep -lE` 于该 commit 可复现），本轮把两个名字一起记账，不掩盖也不代其认罪。
2. **本 lane 自己的 name-only 触发**：`alpha5-glob-backend.test.ts` 里 leg P0 会
   `readFileSync` 读 `a5p5-tools/src/register.ts` 的**文本**以钉 argv 平价——那是名字不是边，
   故入 `NAMES_ONLY_LEDGER_EXCEPTIONS` 第五项，并新增一条形钉腿：全文件恰一行携带该路径形状、
   且必须是那条 pinned `readFileSync`，任何 import/require/from-specifier 出现即红。
3. **a5lsp2 的 REAL 腿在本地无法复现**（standalone 绿、两次全量 capture 绿、我的风暴在另一进程
   mid-flight 时亦绿）；其观测面是 world-scoped，看得见我的世界的可能性已被排除（pid_max
   4194304 / 风暴期 fd≤40 实测）。剩余解释是小 runner 上的 CPU 挤占撞上它们的**有界 poll**。
   本侧加了两项**不减少任何断言数字**的礼让：`A5GLB_RACE_PACE_MS`（默认 4 ms，每次真走之后让出
   CPU，计数器逐字节不变）与 `A5GLB_RACE_WALKS`（默认 6600 的规模旋钮；一旦拧小**腿名自己会
   说出来**，故被拧过的 census 不可能被当作硬门引用——硬门仍是不带 env 的 lane 直跑）。

4. **收尾笔（协调批准，见 §5 of `census-round-20261018.md`）**：census 只剩 a5lsp2-assembly 的
   REAL 腿，机制已定位为小 runner 的 CPU 挤占撞其**有界** pollUntil(8s/10s)。按授权做了一处
   **courtesy edit**：该文件 5 处 poll 上限改为 `POLL_CEILING_MS`（默认 30 s，
   `A5LSP2_POLL_CEILING_MS` 可逐 run 覆盖），与 census 算子既有 `--testTimeout=90000` 同族。
   断言与观测面逐位不变（谓词、`/proc` liveness、`sampleLaneProcesses(world)`、`toBe(true)`）；
   放宽的只是**数值上界**，"有界"语义保留——`pollUntil` 实测到点返回 false（250 ms 上界 254 ms
   即返），永不退出的子进程照旧红。`a5lsp2-streaming` 的 5 s 上界不在授权范围内，未动。

## 4f. census round 2（fed6d723）两笔

`fed6d723` 上剩两族红，两笔都在 [`census-round-20261018.md`](census-round-20261018.md) 里：

- **§6**：`a5lsp2` cleanup (a)/(b) 在 30 s 上限后仍红 → 我的 CPU 饥饿解释证据不足，改为
  **失败现场取证**（只在即将失败时印：`sampleLaneProcesses` 全表、被盯 pid 的 `/proc`
  cmdline/状态、world 递归计数、loadavg+PSI）。**上限 30 s 一字未抬**。
- **§7**：`L3 MEASURED confine scope` 在 CI 内核红 → 它自称 measured 却把一台内核的一次观测
  写死。改为现场测 `content`/`names` 两维并把实测形打进一行 stdout；实测发现
  旧"names 可见"是 **leg 顺序副作用**（同宿主单跑即红），且 **launcher 不传播内层退出码**
  （拒绝信号在子进程 stderr 的 errno 类，退出码是 0）。硬断言只增不减：外部字节 stdout+stderr
  双侧不出现、不得对非空外部文件答"成功且空"、四例外部件名必拒且拒绝不回显名。
  无 Landlock 时落既有 refused 形（本机用错误字节 pin 真实执行过）；门语义已核：census 只比
  红身份集，具名弃权不进 ids。

- **§8**：CI 里 FORENSIC=0 的真实断点在门的转写（`ctx.capture` 只把 tail 3 行送进
  `census-run.txt`）→ 失败命令的完整 stdout 现以 `| ` 前缀逐行回显进那份 artifact；
  回显行不能伪装成 `^DSH-CI-*` token（前缀是承重件），绿跑一字不多。

## 5. 对抗腿 (`adversarial-counters.json`)

> 命名说明：本文件里的 **leg 编号 A1–A8 是腿自己的编号**（早于 §2 的 law 编号），与 law A1–A8
> 不是同一套。撞号处（如 leg A5 vs law A5）以"腿/律"区分；下表一律称"腿"。

`rename → symlink` swap race against the anchored path, the attacker flipping it every
iteration between a real directory and a symlink onto the outside canary (`real`/`link`
both observed, `contended=0` means every sample had an unambiguous state):

- **腿 A4 — 5000 iterations: 2500 anchors accepted / 2500 refused, 0 hostile entries
  accepted, 0 leaks.** The leak detector is not a verdict check: every accepted entry is
  *read back* and compared against the canary, and every refused state is counted.
- **腿 A5 — 6600 REAL confined-rg walks under the same swap**（一次 spawn ≈ 45 ms，故这已
  是该 host 上单次可负担的上限）：`liveWitness = {real:5801, link:5800, contended:0,
  okWhileReal:3300, okWhileLink:0, refusedWhileLink:3300, refusedWhileReal:0}` ——
  **link 态零作答**，real 态零拒答（不是靠超时糊过去的"多数拒"）。
- **同一腿的 spill 探针**（23:05Z 单 ③）：`spillProbe = {walks:6600, admittedWithBytes:3300,
  refusedWithBytes:0, attributionMismatch:0, canaryInChannel:0, bytesTotal:49500}` ——
  拒答 ⇒ 通道 0 字节；作答 ⇒ 通道字节 == 呈现行的 NUL 拼接（不是"看起来没漏"，是逐条等式）。
- **同一腿的全通道探针**（23:48Z 单 ④，worst case：`internalLog` **故意打开**）：
  `allChannelProbe = {walks:6600, auditLines:6601, internalLines:3300, exceptionStrings:0,
  detailsFromTable:3300, wireTokenHits:0, watchedTokens:5, internalWatchedTokens:2}`。
  每次走都监视 return 对象 JSON、spill 字节、**每一条** audit 行（并逐行跑 X8 语法）、内部面
  行、以及万一抛出的异常字符串；监视 token = 外部树名 / 外部树里的文件名 / 外部路径 / canary。
  `detailsFromTable == refusedWhileLink` 即"每一次拒答的每个字都出自冻结表"；
  `auditLines = walks + 1`（多的一条是首探 capability OK）⇒ 没有一条走逃过审计检查。
  诊断累加器的**字节数**（result/spill/audit/internal 四长度）**只打印、不入册**：audit 行里带
  pid，其长度逐次必变，而入册件要求三次逐字节同——所以稳定文件里只留"走数/行数/命中数"这类
  与安全性有关的计数。这是对稳定性的让步，不是隐藏：数值在腿上直接可见（stdout 一行），
  且 `spillBytes` 的等式律本来就以**逐条断言**（`bytes == files.join(NUL)+'\0'`）而非总和要求。
- **腿 A1/A2** mid-segment and last-segment symlink escapes refused **before any process
  exists**（`execCount()` 不动）；**腿 A3** root 本身被换成指向外面的 symlink ⇒ 拒
  （`root-symlink-alias`，anchor 永不放宽）；**腿 A6** anchor 飞行中被流放 ⇒ `anchor-drift`，
  从不作答；**腿 A7** 任何 pattern（`../..`、`**/outside/**`、`/etc/**`、`**/leak.ts`）都
  never presents a path outside the root；**腿 A8** 把上述计数器作为产物发布（躲开竞态的套件
  会在这里露形迹）。

## 6. 集成契约 (for the glue writer — nothing here edits the plane)

**两个面的性质必须先读（A8-3 / A8-5）**：`observe` 是**审计面**，其词法被 leg X8 钉死
（`anchored-glob <verb> key=token`，token 不含 `/`、空格、换行 ⇒ 结构上不可能是路径或 rg 句
子）；`internalLog` 是**内部排障面，默认关闭**，装配不给就什么都不会留下。**它不是输出通道**：
装配方不得把它接到 tool result、spill、模型可见或用户可见的任何表面；它存在的唯一理由是让装配方
在本地进程内看到"哪个分量、哪个 errno、rg 说了什么"。若某次集成选择打开它，那次集成需在各自
证据里自证该面未被路由到输出侧（本 lane 的对抗腿 A5 是在**打开**该面的最坏情况下跑的，仍证明外面
的名字与字节从不进入任何通道，包括它）。

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
  maxWalkBytes?: number,                // NARROWING ONLY: may shrink the walk buffer,
                                        // never past GLOB_MAX_WALK_BYTES (8 MiB)
  observe?: (line: string) => void,     // audit lines: grammar-pinned to codes + arithmetic (A8-3)
  internalLog?: (line: string) => void, // INTERNAL FACE — DEFAULT OFF, NOT AN OUTPUT CHANNEL
}): {
  backendId: 'a5glb-anchored-confined-rg-glob',
  run(call, io): Promise<BackendResult>, // never throws; closed triad denied|hidden|undetermined
  execCount(): number,                   // pre-execute refusals never move it
  lastStageTrace: readonly string[],     // probe → prepare → execute → terminate
  lastRuns: readonly { callId, pid, exit, total, capped }[],  // ids + numbers, no paths
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

Last recorded run on this host (the A8 round): **57/57 legs green** (49 row + 8 adversarial;
the two files together ~175 s, the adversarial A5 leg ~156 s at 6600 walks),
`pnpm -r run typecheck` exit 0 across all 9 packages, `eslint` clean on all four lane files,
`p4t6` census 10/10 (scanner still measures 1184 paths, the four lane files booked by name),
and `parity-table.json` + `adversarial-counters.json` + `channel-matrix.json` byte-identical
across **three** consecutive runs, zero leftover `tests/homes/a5glb-*` worlds.

## 8. Dependency registration (`:128`, same stroke)

`@deepseek-ai/dsh-tool-fs-search": "0.2.0-rc.2"` added to
`packages/runtime/package.json` with `pnpm-lock.yaml` in the same commit
(`version: 0.2.0-rc.2(dd915b1c3d0ea66ee534758c47dc32c7)`), OPTIONAL_ONLY BFS carries
`@vscode/ripgrep` → the measured binary is **ripgrep 15.0.0 (rev 3a612f88b8)**
(`@vscode/ripgrep-linux-x64@1.18.0`, 5 728 032 bytes), resolved through the package's own
`resolveRgPath()` and never hardcoded.
